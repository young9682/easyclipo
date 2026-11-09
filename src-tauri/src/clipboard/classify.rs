//! 内容类型识别与内容哈希。

use sha2::{Digest, Sha256};

use crate::storage::ContentType;

#[derive(Debug, Clone)]
pub enum ClipContent {
    Text(String),
    Files(Vec<String>),
    /// PNG 编码的图片
    Image(Vec<u8>),
}

impl ClipContent {
    /// 用于去重的哈希输入
    pub fn hash_bytes(&self) -> Vec<u8> {
        match self {
            ClipContent::Text(t) => t.as_bytes().to_vec(),
            ClipContent::Files(files) => files.join("\n").into_bytes(),
            ClipContent::Image(png) => png.clone(),
        }
    }
}

/// SHA-256 前 16 字节的十六进制串，作为内容指纹
pub fn content_hash(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest[..16].iter().map(|b| format!("{b:02x}")).collect()
}

/// 文本内容自动分类：链接 → 代码 → 普通文本
pub fn detect_content_type(text: &str) -> ContentType {
    if is_link(text) {
        ContentType::Link
    } else if is_code(text) {
        ContentType::Code
    } else {
        ContentType::Text
    }
}

fn is_link(s: &str) -> bool {
    let t = s.trim();
    if t.contains('\n') || t.len() < 8 {
        return false;
    }
    let looks_like_url = (t.starts_with("http://")
        || t.starts_with("https://")
        || t.starts_with("www."))
        && t.contains('.');
    looks_like_url && t.split_whitespace().count() == 1
}

fn is_code(s: &str) -> bool {
    let t = s.trim();
    if t.len() < 20 {
        return false;
    }
    let lines: Vec<&str> = t.lines().collect();
    if lines.len() < 3 {
        return false;
    }
    let indented = lines
        .iter()
        .filter(|l| l.starts_with(' ') || l.starts_with('\t'))
        .count();
    const KEYWORDS: [&str; 16] = [
        "{", "}", ";", "function ", "def ", "import ", "from ", "class ", "fn ", "pub ",
        "let ", "const ", "var ", "return ", "=>", "<",
    ];
    let structural = KEYWORDS.iter().filter(|k| t.contains(**k)).count();
    // 命中规则：多行缩进 + 结构符号，或结构符号密集（如 JS 顶层函数体）
    (indented >= 2 && structural >= 2) || (structural >= 3 && indented >= 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_stable_hex() {
        let a = content_hash(b"hello");
        let b = content_hash(b"hello");
        let c = content_hash(b"world");
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_eq!(a.len(), 32);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn classifies_links() {
        assert_eq!(
            detect_content_type("https://github.com/rust-lang/rust"),
            ContentType::Link
        );
        assert_eq!(
            detect_content_type("http://example.com/path?q=1"),
            ContentType::Link
        );
        assert_eq!(detect_content_type("www.example.com"), ContentType::Link);
        // 多词或多行不算链接
        assert_eq!(
            detect_content_type("看看这个 https://example.com"),
            ContentType::Text
        );
        assert_eq!(
            detect_content_type("https://a.com\nhttps://b.com"),
            ContentType::Text
        );
    }

    #[test]
    fn classifies_code() {
        let code = "fn main() {\n    let x = 1;\n    println!(\"{}\", x);\n}";
        assert_eq!(detect_content_type(code), ContentType::Code);

        let js = "function add(a, b) {\n  return a + b;\n}\nconst s = add(1, 2);";
        assert_eq!(detect_content_type(js), ContentType::Code);
    }

    #[test]
    fn classifies_plain_text() {
        assert_eq!(detect_content_type("今天天气不错，适合写代码。"), ContentType::Text);
        // 短行、无结构特征
        assert_eq!(detect_content_type("第一行\n第二行\n第三行"), ContentType::Text);
        assert_eq!(detect_content_type(""), ContentType::Text);
    }

    #[test]
    fn hash_bytes_by_variant() {
        assert_eq!(
            ClipContent::Text("ab".into()).hash_bytes(),
            b"ab".to_vec()
        );
        assert_eq!(
            ClipContent::Files(vec!["a".into(), "b".into()]).hash_bytes(),
            b"a\nb".to_vec()
        );
        assert_eq!(ClipContent::Image(vec![1, 2]).hash_bytes(), vec![1, 2]);
    }
}
