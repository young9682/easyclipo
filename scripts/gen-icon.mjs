// 生成应用图标设计源 app-icon.svg（花笺纸墨 · 梅笺方案，512×512 矢量）
// 再由 `pnpm tauri icon app-icon.svg` 产出 src-tauri/icons/ 全套（ico/icns/png）。
// 用法: node scripts/gen-icon.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 配色与应用设计令牌（src/index.css）同源：暖纸底 / 四级墨色 / 竹青 / 朱砂
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<title>EasyClip 梅笺</title>
<defs>
<linearGradient id="e-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9f6f0"/><stop offset="1" stop-color="#ebe5d6"/></linearGradient>
<filter id="e-sh" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#1a1a18" flood-opacity="0.12"/></filter>
</defs>
<rect width="512" height="512" rx="112" fill="url(#e-bg)"/>
<g filter="url(#e-sh)">
<g transform="rotate(0 256 200)"><ellipse cx="256" cy="122" rx="52" ry="74" fill="#fbf9f2" stroke="#3a7a52" stroke-width="3"/></g>
<g transform="rotate(72 256 200)"><ellipse cx="256" cy="122" rx="52" ry="74" fill="#fbf9f2" stroke="#3a7a52" stroke-width="3"/></g>
<g transform="rotate(144 256 200)"><ellipse cx="256" cy="122" rx="52" ry="74" fill="#fbf9f2" stroke="#3a7a52" stroke-width="3"/></g>
<g transform="rotate(216 256 200)"><ellipse cx="256" cy="122" rx="52" ry="74" fill="#fbf9f2" stroke="#3a7a52" stroke-width="3"/></g>
<g transform="rotate(288 256 200)"><ellipse cx="256" cy="122" rx="52" ry="74" fill="#fbf9f2" stroke="#3a7a52" stroke-width="3"/></g>
<circle cx="256" cy="200" r="30" fill="#f7f4ec" stroke="#3a7a52" stroke-width="3"/>
</g>
<circle cx="256" cy="184" r="6.5" fill="#b45454"/>
<circle cx="271.2" cy="195.1" r="6.5" fill="#b45454"/>
<circle cx="265.4" cy="212.9" r="6.5" fill="#b45454"/>
<circle cx="246.6" cy="212.9" r="6.5" fill="#b45454"/>
<circle cx="240.8" cy="195.1" r="6.5" fill="#b45454"/>
<rect x="166" y="334" width="180" height="14" rx="7" fill="#1a1a18"/>
<rect x="166" y="376" width="116" height="14" rx="7" fill="#2d5a3d"/>
</svg>`;

const out = fileURLToPath(new URL("../app-icon.svg", import.meta.url));
writeFileSync(out, SVG);
console.log(`生成 app-icon.svg（${SVG.length} bytes）`);
