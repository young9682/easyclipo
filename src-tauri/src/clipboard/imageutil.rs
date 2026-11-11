//! 图像字节工具（跨平台共享）：任意常见格式归一化为 PNG、原始 RGBA 编码 PNG。

/// 将任意常见图片格式字节归一化为 PNG（PNG 原样返回，JPEG/GIF/WebP/BMP 解码重编码）
pub fn normalize_image_bytes(bytes: &[u8]) -> Option<Vec<u8>> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some(bytes.to_vec());
    }
    let img = image::load_from_memory(bytes).ok()?;
    let mut out = std::io::Cursor::new(Vec::new());
    img.to_rgba8()
        .write_to(&mut out, image::ImageFormat::Png)
        .ok()?;
    Some(out.into_inner())
}

/// 将原始 RGBA8 像素编码为 PNG（Linux 剪贴板图片路径；Windows 编译时仅测试使用）
#[allow(dead_code)]
pub fn rgba_to_png(rgba: &[u8], width: u32, height: u32) -> Option<Vec<u8>> {
    if rgba.len() != (width as usize).saturating_mul(height as usize) * 4 {
        return None;
    }
    let img = image::RgbaImage::from_raw(width, height, rgba.to_vec())?;
    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Png).ok()?;
    Some(out.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_png() -> Vec<u8> {
        // 2x2 纯色 PNG，由 dib 测试同款构造路径生成
        let img = image::RgbaImage::from_pixel(2, 2, image::Rgba([255, 0, 0, 255]));
        let mut out = std::io::Cursor::new(Vec::new());
        img.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }

    #[test]
    fn normalize_passthrough_png() {
        let png = sample_png();
        assert_eq!(normalize_image_bytes(&png).as_deref(), Some(png.as_slice()));
    }

    #[test]
    fn normalize_rejects_garbage() {
        assert!(normalize_image_bytes(b"not an image at all").is_none());
        assert!(normalize_image_bytes(&[]).is_none());
    }

    #[test]
    fn rgba_roundtrip() {
        let png = sample_png();
        let img = image::load_from_memory(&png).unwrap().to_rgba8();
        let reencoded =
            rgba_to_png(img.as_raw(), img.width(), img.height()).expect("RGBA 编码应成功");
        let decoded = image::load_from_memory(&reencoded).unwrap();
        assert_eq!(decoded.to_rgba8().as_raw(), img.as_raw());
    }

    #[test]
    fn rgba_rejects_bad_size() {
        assert!(rgba_to_png(&[0u8; 3], 2, 2).is_none());
    }
}
