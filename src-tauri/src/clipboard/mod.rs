//! 剪贴板监听与写回模块（Windows）。
//!
//! Windows 没有系统级剪贴板变更回调，采用专用线程轮询
//! `GetClipboardSequenceNumber`，变化时读取内容、分类、入库并发事件。

pub mod classify;
mod dib;
mod win32;

use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::ai::SensitiveDetector;
use crate::storage::{NewClip, DEFAULT_RETENTION_DAYS};
use crate::{ai, AppState};

use classify::ClipContent;

const POLL_INTERVAL: Duration = Duration::from_millis(800);

/// 当前剪贴板序号（进程内全局缓存最近一次观察值）
static LAST_SEQ: AtomicU64 = AtomicU64::new(0);

pub fn start_watcher(app: AppHandle) {
    thread::spawn(move || watcher_loop(app));
}

fn watcher_loop(app: AppHandle) {
    // 初始序号设为 0：首次轮询即捕获应用启动时剪贴板中的现有内容
    loop {
        thread::sleep(POLL_INTERVAL);
        let seq = win32::clipboard_sequence_number() as u64;
        let last = LAST_SEQ.load(Ordering::Relaxed);
        if seq == 0 || seq == last {
            continue;
        }
        LAST_SEQ.store(seq, Ordering::Relaxed);

        let Some(content) = read_clipboard() else {
            continue;
        };

        // 内部写回守卫：程序自身写回剪贴板的内容只跳过一次
        let hash = classify::content_hash(&content.hash_bytes());
        if app
            .state::<AppState>()
            .internal_hash
            .lock()
            .expect("internal_hash 锁中毒")
            .take()
            .as_deref()
            == Some(hash.as_str())
        {
            continue;
        }

        handle_new_content(&app, content, &hash);
    }
}

fn handle_new_content(app: &AppHandle, content: ClipContent, hash: &str) {
    let (content_type, text_content, image_blob) = match &content {
        ClipContent::Text(text) => (classify::detect_content_type(text), Some(text.clone()), None),
        ClipContent::Files(files) => (crate::storage::ContentType::File, Some(files.join("\n")), None),
        ClipContent::Image(png) => (crate::storage::ContentType::Image, None, Some(png.clone())),
    };

    let state = app.state::<AppState>();
    let retention = {
        let storage = match state.storage.lock() {
            Ok(s) => s,
            Err(_) => {
                eprintln!("剪贴板入库失败：存储被占用");
                return;
            }
        };
        match storage.retention_days() {
            Ok(days) => days,
            Err(_) => DEFAULT_RETENTION_DAYS,
        }
    };

    // 敏感信息检测（一期为规则骨架，恒为无标记；二期填充规则库与 AI 后端）
    let detector = ai::RuleDetector::default();
    let is_sensitive =
        !detector.detect(text_content.as_deref().unwrap_or("")).is_empty();

    let clip = NewClip {
        content_type,
        text_content,
        image_blob,
        content_hash: hash.to_string(),
        source_device: state.device_id.clone(),
    };

    let row = {
        let storage = match state.storage.lock() {
            Ok(s) => s,
            Err(_) => {
                eprintln!("剪贴板入库失败：存储被占用");
                return;
            }
        };
        match storage.insert_clip(&clip, retention, is_sensitive) {
            Ok(row) => row,
            Err(e) => {
                eprintln!("剪贴板入库失败：{e}");
                return;
            }
        }
    };
    let _ = app.emit("clip:new", &row);
}

/// 读取剪贴板内容（文本 → 文件列表 → 图片，取第一个可读格式）
fn read_clipboard() -> Option<ClipContent> {
    // 文本（普通文本/代码/链接在此统读，类型入库时细分）
    if let Ok(text) = clipboard_win::get_clipboard::<String, _>(clipboard_win::formats::Unicode) {
        let text = text.trim_end_matches('\0').trim_end_matches('\r').to_string();
        if !text.trim().is_empty() {
            return Some(ClipContent::Text(text));
        }
    }
    // 文件列表（CF_HDROP）
    if let Ok(files) =
        clipboard_win::get_clipboard::<Vec<String>, _>(clipboard_win::formats::FileList)
    {
        let files: Vec<String> = files
            .into_iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !files.is_empty() {
            return Some(ClipContent::Files(files));
        }
    }
    // 位图（CF_DIB → PNG）
    if let Ok(dib) = clipboard_win::get_clipboard::<Vec<u8>, _>(clipboard_win::formats::Bitmap) {
        if let Ok(png) = dib::dib_to_png(&dib) {
            return Some(ClipContent::Image(png));
        }
    }
    None
}

/// 写回剪贴板（复制条目时调用）
pub fn write_clipboard(content: ClipContent) -> Result<(), String> {
    match content {
        ClipContent::Text(text) => clipboard_win::set_clipboard(
            clipboard_win::formats::Unicode,
            &text,
        )
        .map_err(|e| format!("写回文本失败：{e}")),
        ClipContent::Files(files) => win32::set_files(&files),
        ClipContent::Image(png) => win32::set_image(&png),
    }
}
