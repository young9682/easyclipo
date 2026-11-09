//! OLE IDataObject 剪贴板读取。
//!
//! 覆盖经典 `GetClipboardData` 读不到的延迟渲染内容——典型是 Edge/Chromium
//! 「复制图片」把图片以虚拟文件（CFSTR_FILECONTENTS + TYMED_ISTREAM）放在
//! 数据对象上，只能通过 OLE 接口按流读出。

use std::sync::OnceLock;

use windows::Win32::System::Com::{
    CoInitializeEx, COINIT_MULTITHREADED, DVASPECT_CONTENT, FORMATETC, IDataObject, IStream,
    STGMEDIUM, TYMED_ISTREAM,
};
use windows::Win32::System::Ole::{OleGetClipboard, ReleaseStgMedium};

/// 单张图片读取上限，防止异常数据撑爆内存
const MAX_IMAGE_BYTES: usize = 64 * 1024 * 1024;

static COM_INIT: OnceLock<()> = OnceLock::new();

/// 从剪贴板数据对象读取 FileContents 流内容（仅当数据像图片时返回）
pub fn read_file_contents_stream() -> Option<Vec<u8>> {
    unsafe {
        // 监听线程首次调用时初始化 COM；已初始化（S_FALSE）或模式不符均可忽略
        if COM_INIT.get().is_none() {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let _ = COM_INIT.set(());
        }

        let data_object: IDataObject = OleGetClipboard().ok()?;

        let cf_file_contents = crate::clipboard::win32::registered_file_contents()?;
        let formatetc = FORMATETC {
            cfFormat: cf_file_contents,
            ptd: std::ptr::null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: TYMED_ISTREAM.0 as u32,
        };
        let mut medium = data_object.GetData(&formatetc).ok()?;
        let bytes = read_stream(&medium);
        ReleaseStgMedium(&mut medium);
        bytes.filter(|b| !b.is_empty() && b.len() <= MAX_IMAGE_BYTES)
    }
}

/// 读完整 IStream（1MB 分块循环）
unsafe fn read_stream(medium: &STGMEDIUM) -> Option<Vec<u8>> {
    // ManuallyDrop<Option<IStream>> 克隆（AddRef）取引用，原引用交由 ReleaseStgMedium 释放
    let stream: IStream = (*medium.u.pstm).clone()?;
    let mut out = Vec::new();
    let mut chunk = vec![0u8; 1024 * 1024];
    loop {
        let mut read = 0u32;
        let hr = stream.Read(
            chunk.as_mut_ptr().cast(),
            chunk.len() as u32,
            Some(&mut read),
        );
        if hr.is_err() || read == 0 {
            break;
        }
        out.extend_from_slice(&chunk[..read as usize]);
        if out.len() > MAX_IMAGE_BYTES {
            return None;
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn com_init_and_ole_call_do_not_crash() {
        // 无图片类剪贴板内容时返回 None，不应 panic
        let _ = read_file_contents_stream();
    }
}
