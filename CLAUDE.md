# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EasyClip** - 轻量级剪切板管理器，支持跨端同步，可选AI敏感信息检测。

**当前状态**：一期（核心功能）+ 敏感检测规则库 + 花笺风格双主题已完成；**跨平台已适配 Linux**（arboard，文本/图片），Windows 保留完整链路（OLE 虚拟文件等）。CI（.github/workflows/build-release.yml）按 tag 双平台构建并自动发 Release。二期待做：WebSocket 同步、AI 检测后端、SQLCipher、Linux 文件列表捕获、macOS。

## Tech Stack

- **Frontend**: React + TypeScript (Tauri WebView)
- **Backend**: Rust (Tauri v2)
- **Local Storage**: SQLite (rusqlite)
- **Sync Server**: Rust (WebSocket, 用户自建)
- **AI Detection**: 规则匹配 + 可选AI (Ollama/Claude API)

## Project Structure

```
easyclipo/
├── src-tauri/          # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs     # 入口：状态管理、托盘、快捷键、清理任务
│   │   ├── commands.rs # Tauri 命令层（前端 invoke 入口）
│   │   ├── clipboard/  # 剪贴板监听模块（轮询/读取/写回/classify 分类/dib 转换/win32）
│   │   ├── storage/    # SQLite 存储模块（CRUD/搜索/清理/settings）
│   │   ├── sync/       # WebSocket 同步模块（二期骨架）
│   │   └── ai/         # AI 敏感信息检测模块（二期骨架）
│   ├── capabilities/   # Tauri v2 权限配置
│   ├── icons/          # 应用图标（node scripts/gen-icon.mjs 生成源图 + tauri icon 产出）
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                # React 前端
│   ├── components/     # UI 组件（ClipList/ClipItem/SearchBar/CategoryTabs/SettingsDialog/EmptyState）
│   ├── hooks/          # useClips（订阅 clip:new / clip:purged 事件）
│   ├── stores/         # Zustand 状态（clips.ts）
│   ├── utils/          # tauri.ts（invoke 封装 + 浏览器 mock）、time.ts
│   └── types.ts
├── scripts/            # gen-icon.mjs 占位图标生成
├── sync-server/        # 同步服务器（独立项目，二期实现）
└── package.json
```

## Core Features

1. **剪切板监听**: 实时监听系统剪切板变化，自动保存
2. **持久化存储**: SQLite 本地存储，关机不丢数据
3. **分类管理**: 自动/手动分类（文本、图片、代码、链接等）
4. **过期清理**: 可配置保存时长，默认14天自动清理
5. **跨端同步**: WebSocket 同步，用户自建服务器
6. **敏感信息检测**: 规则匹配 + 可选AI，上传前警告用户

## Development Commands

```bash
# 安装依赖（本机镜像故障时走代理）
pnpm install

# 开发模式（Windows）
pnpm tauri dev

# 构建生产版本
pnpm tauri build

# 运行测试
cargo test --manifest-path src-tauri/Cargo.toml

# 仅检查 Rust 编译
cargo check --manifest-path src-tauri/Cargo.toml

# ⚠️ 生产可运行的前端资源需 custom-protocol feature（tauri build 自动开启；
#    用裸 cargo build --release 构建的 exe 会因缺少它而去连 devUrl，报"拒绝连接"）
cargo build --release --features custom-protocol

# 启动同步服务器（二期）
cd sync-server && cargo run

# 纯浏览器预览 UI（mock 数据，无需 Tauri）
pnpm dev
```

## Implementation Notes

- **跨平台剪贴板**：`clipboard/` 按平台实现——Windows（`win_watcher`：seq 轮询 + clipboard-win + Win32/OLE）与 Linux（`linux.rs`：arboard，哈希比对检测变更；文件列表暂缺）。共享管线在 `mod.rs`（handle_new_content/skip_internal_write），共享图像工具在 `imageutil.rs`。
- **剪贴板监听**：Windows 无变更回调，专用线程每 800ms 轮询 `GetClipboardSequenceNumber`（windows-sys），变化时按以下链路读取：文本 → 真实文件列表（路径须存在）→ `image/png` 注册格式（浏览器复制图片）→ CF_DIB 直读 → OLE FileContents 流（Edge/Chromium 虚拟文件形态，见 `clipboard/ole.rs`）→ CF_BITMAP 兜底。Linux 同间隔轮询 + 内容哈希比对。
- **发布**：打 `v*` tag 推送即触发 GitHub Actions 双平台构建（nsis/deb/appimage）并自动创建 Release；手工 `cargo build` 注意 custom-protocol（见下）。
- **读取失败重试**：剪贴板被占用/延迟渲染中时保留序号重试（最多 5 次），避免内容被永久错过。
- **自写回去重**：`copy_clip` 写回剪贴板前把内容哈希登记到 `AppState.internal_hash`，监听线程跳过一次匹配变更。
- **内容去重**：`content_hash`（SHA-256 前 16 字节）相同的新条目合并到已有条目（刷新 created_at 置顶）。
- **敏感信息检测**：本地规则库（手机号/身份证/银行卡/API 密钥/私钥块），含银行卡 Luhn 校验与身份证校验码，命中置 `is_sensitive`；二期同步上传前需确认。
- **图片**：入库统一 PNG 存 BLOB（`normalize_image_bytes` 归一化）；列表经 `get_image_base64` 懒加载；复制回贴时 PNG→32bpp DIB 写 CF_DIB。
- **pnpm**：包管理器 v11，构建脚手架白名单在 `pnpm-workspace.yaml`（allowBuilds: esbuild）。

## Key Rust Crates

- `tauri` - 桌面应用框架
- `rusqlite` - SQLite 存储
- `tokio` - 异步运行时
- `tokio-tungstenite` - WebSocket
- `serde` / `serde_json` - 序列化
- `chrono` - 时间处理
- `regex` - 正则匹配（敏感信息检测）
- `reqwest` - HTTP 客户端（AI API调用）

## Data Model

```rust
struct ClipEntry {
    id: String,
    content: String,
    content_type: ContentType,  // Text, Image, Code, Link, etc.
    category: String,
    source_device: String,
    created_at: DateTime,
    expires_at: DateTime,
    is_synced: bool,
    is_sensitive: bool,
}

enum ContentType {
    Text,
    Image,
    Code,
    Link,
    File,
}
```

## Security Considerations

- **本地存储**：一期使用普通 SQLite（用户决策，未加密）；SQLCipher 加密留作后续增强，届时需重建库文件
- 同步通信使用 WSS (WebSocket Secure)
- 敏感信息上传前需用户确认
- 用户可完全禁用云同步
