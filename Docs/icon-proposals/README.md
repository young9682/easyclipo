# 应用图标候选（花笺纸墨风格）

六个矢量候选，配色与应用设计令牌同源（`src/index.css`）：暖纸 / 四级墨色 / 竹青 / 朱砂。

| 文件 | 方案 |
| --- | --- |
| `icon-a-paper-ink.svg` | A 笺纸墨痕：云白笺纸卡 + 四级墨条 + 竹青纸夹 + 朱砂小印 |
| `icon-b-cinnabar-seal.svg` | B 朱砂印「剪」：宋体白文方印 + 竹青梅纹水印 |
| `icon-c-ink-dark.svg` | C 墨底纸笺：墨色主题版纸卡 |
| `icon-d-bamboo-slips.svg` | D 竹简：五片竹简两道青绳 |
| `icon-e-plum-blossom.svg` | E 梅笺：竹青勾白梅 + 朱砂花蕊 |
| `icon-f-folded-note.svg` | F 竹青折笺：竹青底 + 折角素笺 |

## 选定后的落地步骤

1. 将选中 SVG 以 1024×1024 渲染为 PNG（透明圆角，来源即本 SVG）。
2. `pnpm tauri icon <png>` 重新生成 `src-tauri/icons/` 全套（ico/icns/png）。
3. 更新或退役 `scripts/gen-icon.mjs` 占位生成脚本。
