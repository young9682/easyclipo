//! Win32 剪贴板底层操作：变更序号轮询、文件（CF_HDROP）/图片（CF_DIB）格式写回。

use windows_sys::Win32::Foundation::{GlobalFree, POINT};
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardSequenceNumber, OpenClipboard, SetClipboardData,
};
use windows_sys::Win32::System::Memory::{
    GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
};
use windows_sys::Win32::UI::Shell::DROPFILES;

const CF_DIB: u32 = 8;
const CF_HDROP: u32 = 15;

/// 剪贴板全局变更序号
pub fn clipboard_sequence_number() -> u32 {
    unsafe { GetClipboardSequenceNumber() }
}

/// 写回文件列表（CF_HDROP）
pub fn set_files(paths: &[String]) -> Result<(), String> {
    if paths.is_empty() {
        return Err("文件列表为空".into());
    }
    let mut wide: Vec<u16> = Vec::new();
    for p in paths {
        wide.extend(p.encode_utf16());
        wide.push(0);
    }
    wide.push(0); // 双 null 结尾

    let dropfiles = DROPFILES {
        pFiles: std::mem::size_of::<DROPFILES>() as u32,
        pt: POINT { x: 0, y: 0 },
        fNC: 0,
        fWide: 1,
    };
    // DROPFILES 是 #pragma pack 结构，按 C 布局逐字节序列化
    let header = unsafe {
        std::slice::from_raw_parts(
            &dropfiles as *const DROPFILES as *const u8,
            std::mem::size_of::<DROPFILES>(),
        )
    };
    let mut payload = header.to_vec();
    payload.reserve(wide.len() * 2);
    for w in &wide {
        payload.extend_from_slice(&w.to_le_bytes());
    }
    unsafe { set_clipboard_raw(CF_HDROP, &payload) }
}

/// 写回图片（PNG → 32bpp DIB → CF_DIB）
pub fn set_image(png: &[u8]) -> Result<(), String> {
    let img = image::load_from_memory(png).map_err(|e| format!("解码图片失败：{e}"))?;
    let rgba = img.to_rgba8();
    let (w, h) = (rgba.width() as usize, rgba.height() as usize);
    let raw = rgba.as_raw();

    // BITMAPINFOHEADER(40) + 自底向上 BGRA 行
    let mut dib = Vec::with_capacity(40 + raw.len());
    dib.extend_from_slice(&40u32.to_le_bytes()); // biSize
    dib.extend_from_slice(&(w as i32).to_le_bytes()); // biWidth
    dib.extend_from_slice(&(h as i32).to_le_bytes()); // biHeight（正 = 自底向上）
    dib.extend_from_slice(&1u16.to_le_bytes()); // biPlanes
    dib.extend_from_slice(&32u16.to_le_bytes()); // biBitCount
    dib.extend_from_slice(&0u32.to_le_bytes()); // biCompression = BI_RGB
    dib.extend_from_slice(&((w * 4 * h) as u32).to_le_bytes()); // biSizeImage
    dib.extend_from_slice(&[0u8; 16]); // 分辨率与调色板字段
    for y in (0..h).rev() {
        let row = &raw[y * w * 4..(y + 1) * w * 4];
        for px in row.chunks_exact(4) {
            dib.push(px[2]);
            dib.push(px[1]);
            dib.push(px[0]);
            dib.push(px[3]); // 保留 alpha
        }
    }
    unsafe { set_clipboard_raw(CF_DIB, &dib) }
}

/// 打开剪贴板、写入指定格式的原始字节
unsafe fn set_clipboard_raw(fmt: u32, bytes: &[u8]) -> Result<(), String> {
    if OpenClipboard(std::ptr::null_mut()) == 0 {
        return Err("打开剪贴板失败（可能被其他程序占用）".into());
    }
    let result = write_data(fmt, bytes);
    CloseClipboard();
    result
}

unsafe fn write_data(fmt: u32, bytes: &[u8]) -> Result<(), String> {
    EmptyClipboard();
    let handle = GlobalAlloc(GMEM_MOVEABLE, bytes.len());
    if handle.is_null() {
        return Err("全局内存分配失败".into());
    }
    let locked = GlobalLock(handle);
    if locked.is_null() {
        GlobalFree(handle);
        return Err("全局内存锁定失败".into());
    }
    std::ptr::copy_nonoverlapping(bytes.as_ptr(), locked.cast::<u8>(), bytes.len());
    GlobalUnlock(handle);
    if SetClipboardData(fmt, handle).is_null() {
        GlobalFree(handle);
        return Err("写入剪贴板失败".into());
    }
    Ok(())
}
