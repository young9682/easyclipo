#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

//! EasyClip —— 轻量级剪切板管理器（一期：核心功能）。

mod ai;
mod clipboard;
mod commands;
mod storage;
mod sync;

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use storage::Storage;

pub struct AppState {
    pub storage: Mutex<Storage>,
    /// 程序自身写回剪贴板的内容哈希，监听线程据此跳过一次变更
    pub internal_hash: Mutex<Option<String>>,
    pub device_id: String,
}

fn main() {
    // 全局快捷键：Wayland 下合成器可能拒绝注册，降级为仅托盘唤起，不阻塞启动
    let shortcut_builder = match tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts(["ctrl+shift+v"])
    {
        Ok(builder) => builder
            .with_handler(|app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    show_main_window(app);
                }
            })
            .build(),
        Err(e) => {
            eprintln!("注册全局快捷键 Ctrl+Shift+V 失败（{e}），可通过托盘唤起窗口");
            tauri_plugin_global_shortcut::Builder::new().build()
        }
    };

    tauri::Builder::default()
        .plugin(shortcut_builder)
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let storage = Storage::open(&data_dir.join("easyclip.db"))?;
            storage.init_schema()?;

            let device_id = match storage.get_setting("device_id") {
                Some(id) => id,
                None => {
                    let id = Uuid::new_v4().to_string();
                    storage.set_setting("device_id", &id)?;
                    id
                }
            };

            app.manage(AppState {
                storage: Mutex::new(storage),
                internal_hash: Mutex::new(None),
                device_id,
            });

            // 剪贴板监听线程
            clipboard::start_watcher(app.handle().clone());

            // 周期性过期清理：启动即清一次，之后每 6 小时
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    purge_expired(&handle);
                    tokio::time::sleep(std::time::Duration::from_secs(6 * 3600)).await;
                }
            });

            // 同步模块骨架（二期实现 WebSocket 传输）
            let _sync = sync::SyncManager::new();

            setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 关闭窗口 → 隐藏到托盘，进程常驻
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clips,
            commands::get_image_base64,
            commands::copy_clip,
            commands::delete_clip,
            commands::toggle_pin,
            commands::set_category,
            commands::get_settings,
            commands::set_setting,
            commands::clear_all,
        ])
        .run(tauri::generate_context!())
        .expect("EasyClip 启动失败");
}

fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn purge_expired(app: &AppHandle) {
    let state = app.state::<AppState>();
    let deleted = match state.storage.lock() {
        Ok(s) => match s.purge_expired() {
            Ok(n) => n,
            Err(e) => {
                eprintln!("过期清理失败：{e}");
                return;
            }
        },
        Err(_) => return,
    };
    if deleted > 0 {
        let _ = app.emit("clip:purged", deleted);
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show_item = MenuItem::with_id(app, "show", "显示 EasyClip", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().expect("缺少应用图标").clone())
        .tooltip("EasyClip 剪贴板")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}
