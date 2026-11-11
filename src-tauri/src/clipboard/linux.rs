//! Linux 剪贴板实现（`arboard`：X11 选择区 + Wayland data-control）。
//!
//! Linux 无类似 Windows 的全局变更序号，采用「内容哈希比对」检测变更：
//! 每 800ms 读取一次内容并计算哈希，与上次不同即视为新内容。
//!
//! 当前支持：文本、图片（RGBA→PNG）。文件列表捕获（text/uri-list、
//! x-special/gnome-copied-files）暂未实现，回贴文件时以文本路径形式写入。

use std::borrow::Cow;

use arboard::Clipboard;

use super::classify::{self, ClipContent};
use super::imageutil;
use super::{handle_new_content, skip_internal_write, MAX_READ_RETRIES, POLL_INTERVAL};
use crate::AppState;
use tauri::{AppHandle, Manager};

pub(super) fn start(app: AppHandle) {
    std::thread::spawn(move || watcher_loop(app));
}

fn watcher_loop(app: AppHandle) {
    // Clipboard 持有 X11/Wayland 连接，须在监听线程内创建并复用
    let mut clip: Option<Clipboard> = None;
    let mut last_hash: Option<String> = None;
    let mut retries = 0u32;

    loop {
        std::thread::sleep(POLL_INTERVAL);
        let Some(content) = read(&mut clip) else {
            // 空剪贴板属常态；计数仅用于防止对被占用的内容无限自旋
            retries += 1;
            if retries >= MAX_READ_RETRIES {
                retries = 0;
            }
            continue;
        };
        retries = 0;

        let hash = classify::content_hash(&content.hash_bytes());
        if last_hash.as_deref() == Some(hash.as_str()) {
            continue; // 内容未变
        }
        if skip_internal_write(&app, &hash) {
            last_hash = Some(hash);
            continue;
        }

        last_hash = Some(hash.clone());
        handle_new_content(&app, content, &hash);
    }
}

/// 读取剪贴板内容（文本 → 图片）
fn read(clip: &mut Option<Clipboard>) -> Option<ClipContent> {
    if clip.is_none() {
        match Clipboard::new() {
            Ok(c) => *clip = Some(c),
            Err(e) => {
                eprintln!("打开 Linux 剪贴板失败：{e}");
                return None;
            }
        }
    }
    let c = clip.as_mut()?;

    // 1. 文本（普通文本/代码/链接统读，类型入库时细分）
    if let Ok(text) = c.get_text() {
        let text = text.trim_end_matches('\0').trim_end_matches('\r').to_string();
        if !text.trim().is_empty() {
            return Some(ClipContent::Text(text));
        }
    }
    // 2. 图片（RGBA 像素 → PNG）
    if let Ok(img) = c.get_image() {
        let png = imageutil::rgba_to_png(
            &img.bytes,
            img.width as u32,
            img.height as u32,
        );
        if let Some(png) = png {
            return Some(ClipContent::Image(png));
        }
    }
    None
}

/// 写回剪贴板（复制条目时调用）
pub(super) fn write(content: ClipContent) -> Result<(), String> {
    let mut clip = Clipboard::new().map_err(|e| format!("打开剪贴板失败：{e}"))?;
    match content {
        ClipContent::Text(text) => clip
            .set_text(text)
            .map_err(|e| format!("写回文本失败：{e}")),
        ClipContent::Image(png) => {
            let img = image::load_from_memory(&png)
                .map_err(|e| format!("解码图片失败：{e}"))?
                .to_rgba8();
            let (width, height) = (img.width() as usize, img.height() as usize);
            clip.set_image(arboard::ImageData {
                width,
                height,
                bytes: Cow::Owned(img.into_raw()),
            })
            .map_err(|e| format!("写回图片失败：{e}"))
        }
        ClipContent::Files(files) => {
            // Linux 暂以文本路径列表形式回贴（uri-list 写入待后续支持）
            clip.set_text(files.join("\n"))
                .map_err(|e| format!("写回文件路径失败：{e}"))
        }
    }
}
