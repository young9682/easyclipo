//! 跨端同步模块（一期骨架）。
//!
//! 二期计划：
//! - WebSocket (WSS) 传输层，服务端见仓库根 `sync-server/`
//! - 设备配对与鉴权（设备 ID + 配对码）
//! - 增量同步：`Push` 新条目 / `Pull` 按 since 拉取 / `Ack` 确认，落库置 `is_synced`
//! - 敏感条目上传前需用户确认（见 `ai` 模块）

#![allow(dead_code)]

use serde::{Deserialize, Serialize};

/// 设备间传输的剪贴板条目载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipPayload {
    pub id: String,
    pub content_type: String,
    pub text_content: Option<String>,
    pub content_hash: String,
    pub category: String,
    pub source_device: String,
    pub created_at: i64,
}

/// 同步协议消息（tagged enum，二期扩展图片分块传输）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SyncMessage {
    Push { clip: ClipPayload },
    Pull { since_ms: i64 },
    Ack { ids: Vec<String> },
}

/// 同步管理器（一期空壳）
pub struct SyncManager {
    #[allow(dead_code)]
    server_url: Option<String>,
}

impl Default for SyncManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SyncManager {
    pub fn new() -> Self {
        Self { server_url: None }
    }

    /// 推送条目到同步服务器。
    /// TODO(二期): 建立 WSS 连接、设备配对、增量同步。一期恒返回未实现。
    pub fn push(&self, _clip: &ClipPayload) -> Result<(), String> {
        Err("同步功能二期实现".into())
    }
}
