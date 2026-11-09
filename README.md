# EasyClip

轻量级 Windows 剪贴板管理器：实时捕获、本地持久化、自动分类，支持全局快捷键与系统托盘；跨端同步与 AI 敏感信息检测规划于二期。

## 功能特性（一期）

- 📋 **实时监听**：自动捕获复制的文本、文件列表、图片（统一转 PNG 存储）
- 💾 **本地持久化**：SQLite 存储（WAL 模式），关机不丢数据
- 🗂️ **自动分类**：文本 / 代码 / 链接 / 文件 / 图片，支持手动改分类
- 📌 **置顶**：常用条目常驻列表顶部，不受过期清理影响
- 🔍 **搜索筛选**：关键词搜索 + 类型下拉 / 分类页签过滤
- 🔁 **一键回贴**：双击条目或点「复制」写回系统剪贴板（含图片与文件）
- ⏳ **过期清理**：默认 14 天自动清理未置顶条目，时长可配置
- ⌨️ **全局快捷键**：`Ctrl+Shift+V` 随时唤起窗口
- 🖥️ **系统托盘**：关闭窗口即驻留托盘，不占任务栏
- 🔒 **内容去重**：同一内容重复复制自动合并并置顶，不产生重复条目

## 二期规划

- 🌐 **跨端同步**：WebSocket 自建服务器（`src-tauri/src/sync/` 骨架已就绪，`sync-server/` 独立工程）
- 🛡️ **敏感信息检测**：规则匹配（手机号 / 身份证 / 密钥等）+ 可选 AI 后端（Ollama / Claude API），同步上传前警示用户
- 🔐 **SQLCipher 加密**：本地数据库加密（可选增强，当前为普通 SQLite）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Zustand + Tailwind CSS v4（Tauri WebView） |
| 桌面后端 | Rust + Tauri v2；clipboard-win / windows-sys 剪贴板操作；rusqlite (bundled SQLite) |
| 同步服务器（二期） | Rust + tokio + tokio-tungstenite |

## 环境要求

- Windows 10 / 11（WebView2 系统自带）
- Rust（MSVC toolchain）+ Visual Studio Build Tools（C++ 桌面开发工作负载）
- Node.js ≥ 20，pnpm ≥ 10

> pnpm v10+ 默认拦截依赖构建脚本，本仓库已通过 `pnpm-workspace.yaml`（`allowBuilds`）白名单 esbuild，克隆后直接 `pnpm install` 即可。

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm tauri dev

# 构建生产版本（产出 NSIS 安装包）
pnpm tauri build
# → src-tauri/target/release/bundle/nsis/EasyClip_<版本>_x64-setup.exe

# 运行 Rust 单元测试
cargo test --manifest-path src-tauri/Cargo.toml

# 纯浏览器预览 UI（mock 数据，无需 Tauri 环境）
pnpm dev
```

## 项目结构

```
easyclipo/
├── src-tauri/          # Rust 后端（Tauri）
│   └── src/
│       ├── main.rs     # 入口：托盘、快捷键、周期清理
│       ├── commands.rs # Tauri 命令层（前端 invoke 入口）
│       ├── clipboard/  # 剪贴板监听 / 写回 / 分类 / DIB 转换
│       ├── storage/    # SQLite 存储模块
│       ├── sync/       # 同步模块（二期骨架）
│       └── ai/         # 敏感信息检测（二期骨架）
├── src/                # React 前端
│   ├── components/     # ClipList / ClipItem / SearchBar / CategoryTabs / SettingsDialog
│   ├── stores/         # Zustand 状态管理
│   ├── hooks/          # 后端事件订阅（clip:new / clip:purged）
│   └── utils/          # Tauri API 封装（浏览器环境回退 mock）
├── sync-server/        # 同步服务器（二期独立工程）
└── scripts/            # 图标生成脚本
```

## 使用说明

- `Ctrl+Shift+V` 唤起窗口；双击条目复制回贴
- 数据位置：`%APPDATA%\com.young86.easyclip\`（`easyclip.db`，WAL 模式）
- **隐私**：所有数据仅存本机，无遥测、无云端上传；二期同步为自建服务器的可选功能，可完全禁用

## 图标

占位图标由 `scripts/gen-icon.mjs` 生成。替换应用图标时，覆盖 `scripts/app-icon.png` 后执行：

```bash
pnpm tauri icon scripts/app-icon.png
```
