//! 敏感信息检测模块。
//!
//! 本地规则库（正则 + 校验算法）实时检测剪贴板文本中的敏感信息，
//! 命中置 `clips.is_sensitive`，前端列表警示。
//! 二期同步上传前需用户确认；可选 AI 后端（Ollama / Claude API）后续接入
//! [`SensitiveDetector`] trait 即可。

use serde::Serialize;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize)]
pub struct Detection {
    /// 命中的规则名，如 "phone"、"id_card"
    pub rule: String,
    /// 脱敏后的命中片段
    pub excerpt: String,
}

pub trait SensitiveDetector: Send + Sync {
    fn detect(&self, content: &str) -> Vec<Detection>;
}

/// 检测内容长度上限（截断超长文本，避免拖慢捕获线程）
const MAX_DETECT_CHARS: usize = 20_000;
/// 最多返回的命中数
const MAX_DETECTIONS: usize = 5;

/// 本地规则检测器
pub struct RuleDetector {
    rules: Vec<(&'static str, regex::Regex)>,
}

impl Default for RuleDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl RuleDetector {
    pub fn new() -> Self {
        // Rust regex 不支持环视，边界统一用 (?:^|非数字) 分组实现
        let pats: [(&'static str, &str); 5] = [
            // 中国大陆手机号：11 位，1[3-9] 开头，前后为非数字
            ("phone", r"(?:^|\D)(1[3-9][0-9]{9})(?:\D|$)"),
            // 身份证 18 位：年份 19/20 开头、合法月日，校验码在检测中验证
            (
                "id_card",
                r"(?:^|[^0-9Xx])([1-9][0-9]{5}(?:19|20)[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])[0-9]{3}[0-9Xx])(?:[^0-9Xx]|$)",
            ),
            // 银行卡 16-19 位（3-6 开头），Luhn 校验在检测中验证
            ("bank_card", r"(?:^|\D)([3-6][0-9]{15,18})(?:\D|$)"),
            // 常见 API 密钥形态：OpenAI/AWS/Slack/GitHub/GitLab/Bearer
            (
                "api_key",
                r"(?i)(sk-[a-z0-9_-]{20,}|akia[0-9a-z]{16}|xox[baprs]-[a-z0-9-]{10,}|gh[pousr]_[a-z0-9]{30,}|glpat-[a-z0-9_-]{20,}|bearer\s+[a-z0-9._-]{32,})",
            ),
            // PEM 私钥块标记
            (
                "private_key",
                r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----",
            ),
        ];
        let rules = pats
            .iter()
            .filter_map(|(name, pat)| {
                regex::Regex::new(pat)
                    .map(|re| (*name, re))
                    .ok()
            })
            .collect();
        Self { rules }
    }
}

impl SensitiveDetector for RuleDetector {
    fn detect(&self, content: &str) -> Vec<Detection> {
        if content.is_empty() {
            return Vec::new();
        }
        // 按字符边界截断
        let text = &content
            [..content
                .char_indices()
                .nth(MAX_DETECT_CHARS)
                .map(|(i, _)| i)
                .unwrap_or(content.len())];

        let mut out = Vec::new();
        for (name, re) in &self.rules {
            if out.len() >= MAX_DETECTIONS {
                break;
            }
            for caps in re.captures_iter(text) {
                // 目标串为第一捕获组；private_key 规则用整体匹配
                let Some(m) = caps.get(1).or_else(|| caps.get(0)) else {
                    continue;
                };
                let value = m.as_str();
                let valid = match *name {
                    "id_card" => id_card_checksum_valid(value),
                    "bank_card" => luhn_valid(value),
                    _ => true,
                };
                if !valid {
                    continue;
                }
                let excerpt = if *name == "private_key" {
                    "PEM 私钥块".to_string()
                } else {
                    mask(value)
                };
                out.push(Detection {
                    rule: (*name).to_string(),
                    excerpt,
                });
                break; // 每条规则只报一个命中，控制噪音
            }
        }
        out
    }
}

/// 脱敏展示：保留前 3 后 2 字符，中间打码
fn mask(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= 6 {
        return "*".repeat(chars.len());
    }
    let head: String = chars[..3].iter().collect();
    let tail: String = chars[chars.len() - 2..].iter().collect();
    format!("{head}***{tail}")
}

/// 银行卡 Luhn 校验
fn luhn_valid(digits: &str) -> bool {
    let sum = digits.chars().rev().enumerate().try_fold(0i32, |acc, (i, c)| {
        let d = c.to_digit(10)? as i32;
        let v = if i % 2 == 1 {
            let d2 = d * 2;
            if d2 > 9 {
                d2 - 9
            } else {
                d2
            }
        } else {
            d
        };
        Some(acc + v)
    });
    matches!(sum, Some(s) if s % 10 == 0)
}

/// 身份证校验码（GB 11643-1999，MOD 11-2）
fn id_card_checksum_valid(id: &str) -> bool {
    const WEIGHTS: [u32; 17] = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const CODES: [char; 11] = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    let chars: Vec<char> = id.chars().collect();
    if chars.len() != 18 {
        return false;
    }
    let mut sum: u32 = 0;
    for (i, c) in chars.iter().take(17).enumerate() {
        let Some(d) = c.to_digit(10) else {
            return false;
        };
        sum += d * WEIGHTS[i];
    }
    CODES[(sum % 11) as usize] == chars[17].to_ascii_uppercase()
}

/// 全局共享检测器（正则只编译一次）
static RULE_DETECTOR: OnceLock<RuleDetector> = OnceLock::new();

pub fn global_rule_detector() -> &'static RuleDetector {
    RULE_DETECTOR.get_or_init(RuleDetector::new)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(s: &str) -> Vec<Detection> {
        global_rule_detector().detect(s)
    }

    fn rule_names(s: &str) -> Vec<String> {
        detect(s).into_iter().map(|d| d.rule).collect()
    }

    #[test]
    fn detects_phone_number() {
        assert!(rule_names("我的手机号是 13800138000，联系我").contains(&"phone".to_string()));
        assert!(rule_names("13800138000").contains(&"phone".to_string()));
        // 固话/非手机号 11 位不命中
        assert!(!rule_names("010-88888888").contains(&"phone".to_string()));
        assert!(!rule_names("12345678901").contains(&"phone".to_string()));
        // 更长数字串中不误报
        assert!(!rule_names("13800138000123456").contains(&"phone".to_string()));
    }

    #[test]
    fn detects_id_card_with_checksum() {
        // 校验码合法的标准样例
        assert!(rule_names("身份证：11010519491231002X").contains(&"id_card".to_string()));
        // 校验码错误 → 不报
        assert!(!rule_names("身份证：110105194912310021").contains(&"id_card".to_string()));
    }

    #[test]
    fn detects_bank_card_with_luhn() {
        // Visa 测试号，Luhn 合法
        assert!(rule_names("卡号 4111111111111111").contains(&"bank_card".to_string()));
        // Luhn 不合法 → 不报
        assert!(!rule_names("卡号 4111111111111112").contains(&"bank_card".to_string()));
        // 普通长数字（订单号等）不报
        assert!(!rule_names("订单 1234567890123456").contains(&"bank_card".to_string()));
    }

    #[test]
    fn detects_api_keys() {
        assert!(rule_names("key: sk-proj-abcdefghij1234567890ABCD").contains(&"api_key".to_string()));
        assert!(rule_names("AKIAIOSFODNN7EXAMPLE").contains(&"api_key".to_string()));
        assert!(rule_names(
            "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB"
        ).contains(&"api_key".to_string()));
        assert!(rule_names("Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456")
            .contains(&"api_key".to_string()));
    }

    #[test]
    fn detects_private_key_block() {
        assert!(rule_names("-----BEGIN RSA PRIVATE KEY-----")
            .contains(&"private_key".to_string()));
        assert!(rule_names("-----BEGIN OPENSSH PRIVATE KEY-----")
            .contains(&"private_key".to_string()));
    }

    #[test]
    fn normal_text_is_clean() {
        assert!(detect("今天天气不错，适合写代码。").is_empty());
        assert!(detect("function add(a, b) {\n  const sum = a + b;\n  return sum;\n}\nconst result = add(1, 2);").is_empty());
        assert!(detect("会议改到明天下午三点。").is_empty());
        assert!(detect("").is_empty());
    }

    #[test]
    fn excerpt_is_masked() {
        let d = detect("我的手机号是 13800138000，联系我").remove(0);
        assert_eq!(d.excerpt, "138***00");
        assert!(!d.excerpt.contains("13800138000"), "脱敏后不应包含完整号码");
    }

    #[test]
    fn checksum_helpers() {
        assert!(luhn_valid("4111111111111111"));
        assert!(!luhn_valid("4111111111111112"));
        assert!(luhn_valid("79927398713"), "Luhn 经典样例");
        assert!(id_card_checksum_valid("11010519491231002X"));
        assert!(!id_card_checksum_valid("110105194912310021"));
    }
}
