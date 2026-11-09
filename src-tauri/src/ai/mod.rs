//! 敏感信息检测模块（一期骨架）。
//!
//! 二期计划：
//! - 规则库：手机号、身份证、银行卡、API 密钥等正则模式，填充 [`RuleDetector::rules`]
//! - 可选 AI 后端：Ollama / Claude API，实现 [`SensitiveDetector`] 接入
//! - 检测结果同步到 `clips.is_sensitive`，前端在列表中警示、上传同步前需用户确认

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Detection {
    /// 命中的规则名，如 "phone"、"api_key"
    pub rule: String,
    /// 命中片段（脱敏展示）
    pub excerpt: String,
}

pub trait SensitiveDetector: Send + Sync {
    fn detect(&self, content: &str) -> Vec<Detection>;
}

/// 规则匹配检测器（一期占位：规则库留空，二期填充）
#[derive(Default)]
pub struct RuleDetector {
    #[allow(dead_code)]
    rules: Vec<(String, regex::Regex)>,
}

impl SensitiveDetector for RuleDetector {
    fn detect(&self, _content: &str) -> Vec<Detection> {
        // TODO(二期): 遍历规则库匹配手机号 / 身份证 / 银行卡 / API 密钥等模式
        Vec::new()
    }
}
