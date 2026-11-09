// 生成占位应用图标 scripts/app-icon.png（512x512，剪贴板造型）
// 用法: node scripts/gen-icon.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 512;
const pixels = Buffer.alloc(SIZE * SIZE * 4, 0);

function put(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

function fillRoundedRect(x0, y0, x1, y1, rad, color) {
  const [r, g, b, a = 255] = color;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const cx = Math.min(Math.max(x, x0 + rad), x1 - rad);
      const cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) put(x, y, r, g, b, a);
    }
  }
}

// 背景：深色圆角方块 + 轻微纵向渐变
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const cx = Math.min(Math.max(x, 108), SIZE - 1 - 108);
    const cy = Math.min(Math.max(y, 108), SIZE - 1 - 108);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= 108 * 108) {
      const t = y / SIZE;
      put(x, y, Math.round(15 + 8 * t), Math.round(23 + 9 * t), Math.round(42 + 14 * t));
    }
  }
}

// 剪贴板主体（浅色板面）
fillRoundedRect(150, 104, 362, 440, 20, [241, 245, 249]);
// 顶部夹子（天蓝）
fillRoundedRect(196, 84, 316, 132, 12, [14, 165, 233]);
// 板面文本线条（蓝色深浅交替）
fillRoundedRect(180, 176, 332, 194, 9, [2, 132, 199]);
fillRoundedRect(180, 226, 300, 244, 9, [56, 189, 248]);
fillRoundedRect(180, 276, 320, 294, 9, [2, 132, 199]);
fillRoundedRect(180, 326, 264, 344, 9, [56, 189, 248]);

// ---- PNG 编码 ----
function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[12] = 0; // no interlace

const stride = SIZE * 4 + 1; // 每行前 1 字节 filter
const raw = Buffer.alloc(SIZE * stride);
for (let y = 0; y < SIZE; y++) {
  raw[y * stride] = 0;
  pixels.copy(raw, y * stride + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("scripts/app-icon.png", png);
console.log(`生成 scripts/app-icon.png (${png.length} bytes)`);
