//! 剪贴板监听与写回模块（Windows）。
//!
//! Windows 没有系统级剪贴板变更回调，采用专用线程轮询
//! `GetClipboardSequenceNumber`，变化时读取内容、分类、入库并发事件。

pub mod classify;
mod dib;
mod ole;
mod win32;

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::ai::SensitiveDetector;
use crate::storage::{NewClip, DEFAULT_RETENTION_DAYS};
use crate::{ai, AppState};

use classify::ClipContent;

const POLL_INTERVAL: Duration = Duration::from_millis(800);
/// 剪贴板读取失败后的最大重试次数（避免把被占用的内容永久错过）
const MAX_READ_RETRIES: u32 = 5;

/// 当前剪贴板序号（进程内全局缓存最近一次观察值）
static LAST_SEQ: AtomicU64 = AtomicU64::new(0);
static READ_RETRIES: AtomicU32 = AtomicU32::new(0);

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

        // 读取失败（剪贴板被占用/延迟渲染中）时保留序号，下个周期重试
        let Some(content) = read_clipboard() else {
            let retries = READ_RETRIES.fetch_add(1, Ordering::Relaxed) + 1;
            if retries >= MAX_READ_RETRIES {
                READ_RETRIES.store(0, Ordering::Relaxed);
                LAST_SEQ.store(seq, Ordering::Relaxed);
                eprintln!("剪贴板读取重试 {retries} 次后放弃（seq={seq}）");
            }
            continue;
        };
        READ_RETRIES.store(0, Ordering::Relaxed);
        LAST_SEQ.store(seq, Ordering::Relaxed);

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

/// 读取剪贴板内容，按可靠性与质量取第一个可读格式。
///
/// 顺序：文本 → 真实文件列表 → PNG 注册格式（浏览器复制图片）→ CF_DIB →
/// OLE FileContents 虚拟文件（Edge/Chromium 延迟渲染）→ CF_BITMAP 兜底。
fn read_clipboard() -> Option<ClipContent> {
    // 1. 文本（普通文本/代码/链接在此统读，类型入库时细分）
    if let Ok(text) = clipboard_win::get_clipboard::<String, _>(clipboard_win::formats::Unicode) {
        let text = text.trim_end_matches('\0').trim_end_matches('\r').to_string();
        if !text.trim().is_empty() {
            return Some(ClipContent::Text(text));
        }
    }
    // 2. 文件列表（CF_HDROP）：仅当路径真实存在才采纳；
    //    浏览器虚拟文件的合成 HDROP 指向不存在的路径，留给后面的图片分支
    if let Ok(files) =
        clipboard_win::get_clipboard::<Vec<String>, _>(clipboard_win::formats::FileList)
    {
        let files: Vec<String> = files
            .into_iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !files.is_empty() && std::path::Path::new(&files[0]).exists() {
            return Some(ClipContent::Files(files));
        }
    }
    // 3. PNG 注册格式（Chromium/Firefox 网页复制图片提供，无损）
    if let Some(png) = read_png_format() {
        return Some(ClipContent::Image(png));
    }
    // 4. CF_DIB 直读（截图工具、办公软件；浏览器延迟渲染下经合成也可得）
    if let Ok(dib) =
        clipboard_win::get_clipboard::<Vec<u8>, _>(clipboard_win::formats::RawData(CF_DIB))
    {
        if let Ok(png) = dib::dib_to_png(&dib) {
            return Some(ClipContent::Image(png));
        }
    }
    // 5. OLE FileContents IStream（Edge「复制图片」的虚拟文件形态）
    if let Some(bytes) = ole::read_file_contents_stream() {
        if let Some(png) = dib::normalize_image_bytes(&bytes) {
            return Some(ClipContent::Image(png));
        }
    }
    // 6. CF_BITMAP 兜底（个别程序只提供 HBITMAP）
    if let Ok(dib) = clipboard_win::get_clipboard::<Vec<u8>, _>(clipboard_win::formats::Bitmap) {
        if let Ok(png) = dib::dib_to_png(&dib) {
            return Some(ClipContent::Image(png));
        }
    }
    None
}

const CF_DIB: u32 = 8;
const PNG_FORMAT_NAME: &str = "image/png";

/// 注册并读取 "image/png" 注册格式（HGLOBAL，含 PNG 魔数校验）
fn read_png_format() -> Option<Vec<u8>> {
    let id = win32::register_format(PNG_FORMAT_NAME)?;
    let bytes = clipboard_win::get_clipboard::<Vec<u8>, _>(clipboard_win::formats::RawData(id))
        .ok()?;
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(bytes)
    } else {
        None
    }
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
