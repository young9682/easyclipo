//! Windows 剪贴板 DIB（CF_DIB）→ PNG 转换。
//!
//! 支持 24/32bpp 的 BI_RGB / BI_BITFIELDS / BI_ALPHABITFIELDS，
//! 兼容自底向上（正高）与自顶向下（负高）两种行序。

/// 将剪贴板读出的 DIB 字节转为 PNG
pub fn dib_to_png(dib: &[u8]) -> Result<Vec<u8>, String> {
    if dib.len() < 40 {
        return Err("DIB 数据过短".into());
    }
    let le_u32 = |off: usize| -> u32 {
        u32::from_le_bytes([dib[off], dib[off + 1], dib[off + 2], dib[off + 3]])
    };
    let le_i32 = |off: usize| -> i32 {
        i32::from_le_bytes([dib[off], dib[off + 1], dib[off + 2], dib[off + 3]])
    };

    let header_size = le_u32(0) as usize;
    if dib.len() < header_size || header_size < 40 {
        return Err("DIB 头不完整".into());
    }
    let width = le_i32(4);
    let height_raw = le_i32(8);
    let bpp = u16::from_le_bytes([dib[14], dib[15]]);
    let compression = le_u32(16);

    let top_down = height_raw < 0;
    let (w, h) = (width as u32, height_raw.unsigned_abs() as u32);
    if width <= 0 || h == 0 || w > 32768 || h > 32768 {
        return Err(format!("无效的图像尺寸 {width}x{height_raw}"));
    }

    // 调色板大小（仅低色深有）
    let clr_used = if header_size >= 36 { le_u32(32) as usize } else { 0 };
    let palette_entries = if bpp <= 8 {
        if clr_used > 0 {
            clr_used
        } else {
            1usize << bpp
        }
    } else {
        0
    };
    let data_offset = header_size + palette_entries * 4;
    if dib.len() < data_offset {
        return Err("DIB 像素数据不完整".into());
    }
    let pixels = &dib[data_offset..];

    let w = w as usize;
    let h = h as usize;
    let row_stride = (w * bpp as usize + 31) / 32 * 4;
    if pixels.len() < h * row_stride {
        return Err("DIB 像素数据不足".into());
    }

    // V4/V5 头部的 alpha 掩码（偏移 52）
    let alpha_mask_present =
        header_size >= 108 && le_u32(52) != 0;

    let mut rgba = vec![0u8; w * h * 4];
    match (bpp, compression) {
        (32, 0) | (32, 3) | (32, 6) => {
            // 字节序 B, G, R, A
            for y in 0..h {
                let src = &pixels[y * row_stride..];
                let dst = &mut rgba[y * w * 4..(y + 1) * w * 4];
                for x in 0..w {
                    dst[x * 4] = src[x * 4 + 2];
                    dst[x * 4 + 1] = src[x * 4 + 1];
                    dst[x * 4 + 2] = src[x * 4];
                    dst[x * 4 + 3] = if alpha_mask_present {
                        src[x * 4 + 3]
                    } else {
                        255
                    };
                }
            }
        }
        (24, 0) => {
            for y in 0..h {
                let src = &pixels[y * row_stride..];
                let dst = &mut rgba[y * w * 4..(y + 1) * w * 4];
                for x in 0..w {
                    dst[x * 4] = src[x * 3 + 2];
                    dst[x * 4 + 1] = src[x * 3 + 1];
                    dst[x * 4 + 2] = src[x * 3];
                    dst[x * 4 + 3] = 255;
                }
            }
        }
        _ => {
            return Err(format!("暂不支持的位图格式 bpp={bpp} compression={compression}"));
        }
    }

    let mut img = image::RgbaImage::from_raw(w as u32, h as u32, rgba)
        .ok_or("图像缓冲区尺寸不匹配")?;
    if !top_down {
        img = image::imageops::flip_vertical(&img);
    }

    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Png)
        .map_err(|e| format!("PNG 编码失败：{e}"))?;
    Ok(out.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::GenericImageView;

    /// 构造一张 2x2 的 32bpp 自底向上 DIB（BI_RGB），颜色：
    /// 顶行 = 红(255,0,0)、绿(0,255,0)；底行 = 蓝(0,0,255)、白(255,255,255)
    fn sample_dib_bottom_up() -> Vec<u8> {
        let mut dib = Vec::new();
        dib.extend_from_slice(&40u32.to_le_bytes()); // biSize
        dib.extend_from_slice(&2i32.to_le_bytes()); // width
        dib.extend_from_slice(&2i32.to_le_bytes()); // height（正 = 自底向上）
        dib.extend_from_slice(&1u16.to_le_bytes()); // planes
        dib.extend_from_slice(&32u16.to_le_bytes()); // bpp
        dib.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
        dib.extend_from_slice(&0u32.to_le_bytes()); // size image
        dib.extend_from_slice(&0u32.to_le_bytes()); // xppm
        dib.extend_from_slice(&0u32.to_le_bytes()); // yppm
        dib.extend_from_slice(&0u32.to_le_bytes()); // clr used
        dib.extend_from_slice(&0u32.to_le_bytes()); // clr important
        // 像素行序：底行在前；字节序 B,G,R,A
        dib.extend_from_slice(&[255, 0, 0, 255, 255, 255, 255, 255]); // 蓝、白
        dib.extend_from_slice(&[0, 0, 255, 255, 0, 255, 0, 255]); // 红、绿
        dib
    }

    #[test]
    fn converts_bottom_up_32bpp() {
        let png = dib_to_png(&sample_dib_bottom_up()).unwrap();
        let img = image::load_from_memory(&png).unwrap();
        assert_eq!((img.width(), img.height()), (2, 2));
        let px = img.to_rgba8();
        assert_eq!(px.get_pixel(0, 0).0, [255, 0, 0, 255], "左上应为红色");
        assert_eq!(px.get_pixel(1, 0).0, [0, 255, 0, 255], "右上应为绿色");
        assert_eq!(px.get_pixel(0, 1).0, [0, 0, 255, 255], "左下应为蓝色");
        assert_eq!(px.get_pixel(1, 1).0, [255, 255, 255, 255]);
    }

    #[test]
    fn converts_top_down_32bpp() {
        let mut dib = sample_dib_bottom_up();
        // 改为负高（自顶向下）并按自然行序重排像素
        dib[8..12].copy_from_slice(&(-2i32).to_le_bytes());
        let mut natural = Vec::new();
        natural.extend_from_slice(&[0, 0, 255, 255, 0, 255, 0, 255]); // 红、绿
        natural.extend_from_slice(&[255, 0, 0, 255, 255, 255, 255, 255]); // 蓝、白
        dib.truncate(40);
        dib.extend_from_slice(&natural);
        let img = image::load_from_memory(&dib_to_png(&dib).unwrap()).unwrap();
        assert_eq!(img.get_pixel(0, 0).0, [255, 0, 0, 255]);
    }

    #[test]
    fn rejects_unsupported() {
        assert!(dib_to_png(&[0u8; 10]).is_err());
        // 8bpp 无调色板声明 → 数据不足
        assert!(dib_to_png(&[0u8; 40]).is_err());
    }
}
