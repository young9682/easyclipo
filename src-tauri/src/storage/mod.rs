//! SQLite 本地存储模块。
//!
//! 加密说明：一期使用普通 SQLite（用户决策），SQLCipher 加密留作后续增强，届时需重建库文件。

use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;
use uuid::Uuid;

pub const DEFAULT_RETENTION_DAYS: i64 = 14;
/// 自动分类的默认分类名（二期同步分类映射使用）
#[allow(dead_code)]
pub const CATEGORIES: [&str; 5] = ["文本", "图片", "代码", "链接", "文件"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    Text,
    Image,
    Code,
    Link,
    File,
}

impl ContentType {
    pub fn as_str(self) -> &'static str {
        match self {
            ContentType::Text => "text",
            ContentType::Image => "image",
            ContentType::Code => "code",
            ContentType::Link => "link",
            ContentType::File => "file",
        }
    }

    pub fn from_db(s: &str) -> Self {
        match s {
            "image" => ContentType::Image,
            "code" => ContentType::Code,
            "link" => ContentType::Link,
            "file" => ContentType::File,
            _ => ContentType::Text,
        }
    }
}

/// 列表 DTO（不含图片二进制，前端按需请求缩略图）
#[derive(Debug, Clone, Serialize)]
pub struct ClipRow {
    pub id: String,
    #[serde(rename = "contentType")]
    pub content_type: ContentType,
    #[serde(rename = "textContent")]
    pub text_content: Option<String>,
    #[serde(rename = "hasImage")]
    pub has_image: bool,
    pub category: String,
    #[serde(rename = "sourceDevice")]
    pub source_device: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
    #[serde(rename = "isSynced")]
    pub is_synced: bool,
    #[serde(rename = "isSensitive")]
    pub is_sensitive: bool,
    pub pinned: bool,
    /// 用于内部写回去重，不序列化到前端
    #[serde(skip)]
    pub content_hash: String,
}

#[derive(Debug, Clone)]
pub struct NewClip {
    pub content_type: ContentType,
    pub text_content: Option<String>,
    pub image_blob: Option<Vec<u8>>,
    pub content_hash: String,
    pub source_device: String,
}

#[derive(Debug, Default, Clone)]
pub struct ListQuery {
    pub query: Option<String>,
    pub content_type: Option<ContentType>,
    pub category: Option<String>,
    pub offset: i64,
    pub limit: i64,
}

pub struct Storage {
    conn: Connection,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("系统时钟早于 1970")
        .as_millis() as i64
}

impl Storage {
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.busy_timeout(std::time::Duration::from_millis(2000))?;
        Ok(Self { conn })
    }

    pub fn init_schema(&self) -> Result<(), rusqlite::Error> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                text_content TEXT,
                image_blob BLOB,
                category TEXT NOT NULL DEFAULT '未分类',
                source_device TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                is_synced INTEGER NOT NULL DEFAULT 0,
                is_sensitive INTEGER NOT NULL DEFAULT 0,
                pinned INTEGER NOT NULL DEFAULT 0,
                content_hash TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_clips_hash ON clips(content_hash);
            CREATE INDEX IF NOT EXISTS idx_clips_category ON clips(category);
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        )
    }

    /// 插入新条目；若与已有条目内容哈希相同则合并（刷新时间置顶），返回条目行
    pub fn insert_clip(
        &self,
        clip: &NewClip,
        retention_days: i64,
        is_sensitive: bool,
    ) -> Result<ClipRow, rusqlite::Error> {
        let now = now_ms();
        let expires_at = now + retention_days.saturating_mul(86_400_000);

        let existing: Option<String> = self
            .conn
            .query_row(
                "SELECT id FROM clips WHERE content_hash = ?1 ORDER BY created_at DESC LIMIT 1",
                params![clip.content_hash],
                |r| r.get(0),
            )
            .ok();

        let id = match existing {
            Some(id) => {
                // 合并去重：刷新时间，敏感标记取并集
                self.conn.execute(
                    "UPDATE clips SET created_at = ?1, expires_at = ?2, is_sensitive = MAX(is_sensitive, ?3) WHERE id = ?4",
                    params![now, expires_at, is_sensitive as i64, id],
                )?;
                id
            }
            None => {
                let id = Uuid::new_v4().to_string();
                let category = match clip.content_type {
                    ContentType::Text => "文本",
                    ContentType::Image => "图片",
                    ContentType::Code => "代码",
                    ContentType::Link => "链接",
                    ContentType::File => "文件",
                };
                self.conn.execute(
                    "INSERT INTO clips (id, content_type, text_content, image_blob, category, source_device, created_at, expires_at, is_sensitive, content_hash)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        id,
                        clip.content_type.as_str(),
                        clip.text_content,
                        clip.image_blob,
                        category,
                        clip.source_device,
                        now,
                        expires_at,
                        is_sensitive as i64,
                        clip.content_hash,
                    ],
                )?;
                id
            }
        };
        self.get_clip(&id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    /// 按条件分页查询（置顶优先，其余按创建时间倒序）
    pub fn list_clips(&self, q: &ListQuery) -> Result<Vec<ClipRow>, rusqlite::Error> {
        let sql = "SELECT id, content_type, text_content, image_blob IS NOT NULL, category, source_device, created_at, expires_at, is_synced, is_sensitive, pinned, content_hash
                   FROM clips
                   WHERE (?1 IS NULL OR instr(lower(COALESCE(text_content, '')), lower(?1)) > 0)
                     AND (?2 IS NULL OR content_type = ?2)
                     AND (?3 IS NULL OR category = ?3)
                   ORDER BY pinned DESC, created_at DESC
                   LIMIT ?4 OFFSET ?5";
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(
            params![
                q.query.clone(),
                q.content_type.map(|t| t.as_str().to_string()),
                q.category.clone(),
                q.limit,
                q.offset,
            ],
            row_to_clip,
        )?;
        rows.collect()
    }

    pub fn get_clip(&self, id: &str) -> Result<Option<ClipRow>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content_type, text_content, image_blob IS NOT NULL, category, source_device, created_at, expires_at, is_synced, is_sensitive, pinned, content_hash
             FROM clips WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(params![id], row_to_clip)?;
        match rows.next() {
            Some(row) => row.map(Some),
            None => Ok(None),
        }
    }

    pub fn get_image(&self, id: &str) -> Result<Option<Vec<u8>>, rusqlite::Error> {
        self.conn
            .query_row(
                "SELECT image_blob FROM clips WHERE id = ?1 AND content_type = 'image'",
                params![id],
                |r| r.get(0),
            )
            .optional()
    }

    /// 刷新条目时间到当前（复制回贴时置顶）
    pub fn bump_created(&self, id: &str) -> Result<(), rusqlite::Error> {
        let now = now_ms();
        self.conn.execute(
            "UPDATE clips SET created_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn delete_clip(&self, id: &str) -> Result<usize, rusqlite::Error> {
        self.conn
            .execute("DELETE FROM clips WHERE id = ?1", params![id])
    }

    pub fn toggle_pin(&self, id: &str) -> Result<bool, rusqlite::Error> {
        self.conn.execute(
            "UPDATE clips SET pinned = 1 - pinned WHERE id = ?1",
            params![id],
        )?;
        let pinned: i64 = self
            .conn
            .query_row("SELECT pinned FROM clips WHERE id = ?1", params![id], |r| {
                r.get(0)
            })?;
        Ok(pinned != 0)
    }

    pub fn set_category(&self, id: &str, category: &str) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "UPDATE clips SET category = ?1 WHERE id = ?2",
            params![category, id],
        )?;
        Ok(())
    }

    /// 删除过期未置顶条目，返回删除数量
    pub fn purge_expired(&self) -> Result<usize, rusqlite::Error> {
        self.conn.execute(
            "DELETE FROM clips WHERE pinned = 0 AND expires_at < ?1",
            params![now_ms()],
        )
    }

    pub fn clear_all(&self) -> Result<usize, rusqlite::Error> {
        self.conn.execute("DELETE FROM clips", [])
    }

    pub fn get_setting(&self, key: &str) -> Option<String> {
        self.conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |r| r.get::<_, String>(0),
            )
            .ok()
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn retention_days(&self) -> Result<i64, rusqlite::Error> {
        Ok(self
            .get_setting("retention_days")
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(DEFAULT_RETENTION_DAYS))
    }
}

fn row_to_clip(r: &Row) -> rusqlite::Result<ClipRow> {
    Ok(ClipRow {
        id: r.get(0)?,
        content_type: ContentType::from_db(&r.get::<_, String>(1)?),
        text_content: r.get(2)?,
        has_image: r.get::<_, i64>(3)? != 0,
        category: r.get(4)?,
        source_device: r.get(5)?,
        created_at: r.get(6)?,
        expires_at: r.get(7)?,
        is_synced: r.get::<_, i64>(8)? != 0,
        is_sensitive: r.get::<_, i64>(9)? != 0,
        pinned: r.get::<_, i64>(10)? != 0,
        content_hash: r.get(11)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_storage(name: &str) -> Storage {
        let dir = std::env::temp_dir().join(format!(
            "easyclip-test-{}-{}",
            name,
            Uuid::new_v4().simple()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let s = Storage::open(&dir.join("test.db")).unwrap();
        s.init_schema().unwrap();
        s
    }

    fn text_clip(text: &str) -> NewClip {
        NewClip {
            content_type: ContentType::Text,
            text_content: Some(text.to_string()),
            image_blob: None,
            content_hash: format!("hash-{}", text),
            source_device: "test-device".into(),
        }
    }

    #[test]
    fn insert_and_list() {
        let s = temp_storage("insert-list");
        s.insert_clip(&text_clip("hello world"), 14, false).unwrap();
        s.insert_clip(&text_clip("second entry"), 14, false).unwrap();
        let rows = s
            .list_clips(&ListQuery {
                limit: 100,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(rows.len(), 2);
        // 最新的在前
        assert_eq!(rows[0].text_content.as_deref(), Some("second entry"));
        assert_eq!(rows[0].category, "文本");
    }

    #[test]
    fn dedupe_merges_same_hash() {
        let s = temp_storage("dedupe");
        let first = s.insert_clip(&text_clip("dup"), 14, false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let second = s.insert_clip(&text_clip("dup"), 14, false).unwrap();
        assert_eq!(first.id, second.id, "同内容应合并为同一条目");
        let count: i64 = s
            .conn
            .query_row("SELECT COUNT(*) FROM clips", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        assert!(second.created_at >= first.created_at);
    }

    #[test]
    fn pin_toggle_and_ordering() {
        let s = temp_storage("pin");
        let a = s.insert_clip(&text_clip("old"), 14, false).unwrap();
        s.insert_clip(&text_clip("new"), 14, false).unwrap();
        let now_pinned = s.toggle_pin(&a.id).unwrap();
        assert!(now_pinned);
        let rows = s
            .list_clips(&ListQuery {
                limit: 100,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(rows[0].id, a.id, "置顶条目应排在最前");
        assert!(rows[0].pinned);
    }

    #[test]
    fn purge_expired_keeps_pinned() {
        let s = temp_storage("purge");
        // 直接连库构造过期数据
        s.conn
            .execute(
                "INSERT INTO clips (id, content_type, text_content, category, source_device, created_at, expires_at, is_synced, is_sensitive, pinned, content_hash)
                 VALUES ('old', 'text', 'expired', '文本', 'dev', 1, 2, 0, 0, 0, 'h-old')",
                [],
            )
            .unwrap();
        s.conn
            .execute(
                "INSERT INTO clips (id, content_type, text_content, category, source_device, created_at, expires_at, is_synced, is_sensitive, pinned, content_hash)
                 VALUES ('pin', 'text', 'pinned-expired', '文本', 'dev', 1, 2, 0, 0, 1, 'h-pin')",
                [],
            )
            .unwrap();
        let fresh = s.insert_clip(&text_clip("fresh"), 14, false).unwrap();
        let deleted = s.purge_expired().unwrap();
        assert_eq!(deleted, 1, "只应删除未置顶的过期条目");
        assert!(s.get_clip("old").unwrap().is_none());
        assert!(s.get_clip("pin").unwrap().is_some());
        assert!(s.get_clip(&fresh.id).unwrap().is_some());
    }

    #[test]
    fn list_filters() {
        let s = temp_storage("filters");
        s.insert_clip(&text_clip("苹果香蕉"), 14, false).unwrap();
        s.insert_clip(
            &NewClip {
                content_type: ContentType::Link,
                text_content: Some("https://example.com".into()),
                image_blob: None,
                content_hash: "h-link".into(),
                source_device: "dev".into(),
            },
            14,
            false,
        )
        .unwrap();

        let by_type = s
            .list_clips(&ListQuery {
                content_type: Some(ContentType::Link),
                limit: 100,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(by_type.len(), 1);
        assert_eq!(by_type[0].content_type, ContentType::Link);

        let by_query = s
            .list_clips(&ListQuery {
                query: Some("苹果".into()),
                limit: 100,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(by_query.len(), 1);
        assert_eq!(by_query[0].category, "文本");

        let by_category = s
            .list_clips(&ListQuery {
                category: Some("链接".into()),
                limit: 100,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(by_category.len(), 1);
    }

    #[test]
    fn settings_roundtrip_and_retention() {
        let s = temp_storage("settings");
        assert_eq!(s.retention_days().unwrap(), DEFAULT_RETENTION_DAYS);
        s.set_setting("retention_days", "30").unwrap();
        assert_eq!(s.retention_days().unwrap(), 30);
        // 覆盖写入
        s.set_setting("retention_days", "7").unwrap();
        assert_eq!(s.get_setting("retention_days").as_deref(), Some("7"));
    }

    #[test]
    fn set_category_and_clear_all() {
        let s = temp_storage("category-clear");
        let clip = s.insert_clip(&text_clip("要改分类"), 14, false).unwrap();
        s.set_category(&clip.id, "重要").unwrap();
        let row = s.get_clip(&clip.id).unwrap().unwrap();
        assert_eq!(row.category, "重要");

        s.clear_all().unwrap();
        let count: i64 = s
            .conn
            .query_row("SELECT COUNT(*) FROM clips", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

}
