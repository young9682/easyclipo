//! Tauri 命令层：前端 invoke 的入口。

use std::sync::MutexGuard;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::Serialize;
use tauri::State;

use crate::clipboard::{self, classify::ClipContent};
use crate::storage::{ClipRow, ContentType, ListQuery, Storage};
use crate::AppState;

fn storage<'a>(
    state: &'a State<'a, AppState>,
) -> Result<MutexGuard<'a, Storage>, String> {
    state
        .storage
        .lock()
        .map_err(|_| "存储被占用，请重试".to_string())
}

fn content_type_from(s: &str) -> Option<ContentType> {
    match s {
        "text" => Some(ContentType::Text),
        "image" => Some(ContentType::Image),
        "code" => Some(ContentType::Code),
        "link" => Some(ContentType::Link),
        "file" => Some(ContentType::File),
        _ => None,
    }
}

#[tauri::command]
pub fn get_clips(
    state: State<'_, AppState>,
    query: Option<String>,
    content_type: Option<String>,
    category: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<ClipRow>, String> {
    let s = storage(&state)?;
    let lq = ListQuery {
        query: query.filter(|q| !q.trim().is_empty()),
        content_type: content_type.as_deref().and_then(content_type_from),
        category: category.filter(|c| !c.is_empty() && c != "全部"),
        offset: offset.unwrap_or(0),
        limit: limit.unwrap_or(100).clamp(1, 500),
    };
    s.list_clips(&lq).map_err(|e| e.to_string())
}

/// 返回图片条目的 PNG base64 data URL（列表中按需懒加载）
#[tauri::command]
pub fn get_image_base64(state: State<'_, AppState>, id: String) -> Result<Option<String>, String> {
    let s = storage(&state)?;
    match s.get_image(&id).map_err(|e| e.to_string())? {
        Some(png) => Ok(Some(format!(
            "data:image/png;base64,{}",
            BASE64.encode(png)
        ))),
        None => Ok(None),
    }
}

/// 复制条目回系统剪贴板（并刷新其时间置顶）
#[tauri::command]
pub fn copy_clip(state: State<'_, AppState>, id: String) -> Result<ClipRow, String> {
    let (row, content) = {
        let s = storage(&state)?;
        let row = s
            .get_clip(&id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "条目不存在".to_string())?;
        let content = match row.content_type {
            ContentType::Image => ClipContent::Image(
                s.get_image(&id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "图像数据缺失".to_string())?,
            ),
            ContentType::File => ClipContent::Files(
                row.text_content
                    .as_deref()
                    .unwrap_or_default()
                    .lines()
                    .filter(|l| !l.trim().is_empty())
                    .map(String::from)
                    .collect(),
            ),
            _ => ClipContent::Text(row.text_content.clone().unwrap_or_default()),
        };
        (row, content)
    };

    // 先登记内容哈希，监听线程据此跳过自身写回产生的变更
    *state
        .internal_hash
        .lock()
        .map_err(|_| "内部状态被占用".to_string())? = Some(row.content_hash.clone());
    if let Err(e) = clipboard::write_clipboard(content) {
        *state.internal_hash.lock().unwrap() = None;
        return Err(e);
    }

    let s = storage(&state)?;
    s.bump_created(&id).map_err(|e| e.to_string())?;
    s.get_clip(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "条目不存在".to_string())
}

#[tauri::command]
pub fn delete_clip(state: State<'_, AppState>, id: String) -> Result<(), String> {
    storage(&state)?
        .delete_clip(&id)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pin(state: State<'_, AppState>, id: String) -> Result<ClipRow, String> {
    let s = storage(&state)?;
    s.toggle_pin(&id).map_err(|e| e.to_string())?;
    s.get_clip(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "条目不存在".to_string())
}

#[tauri::command]
pub fn set_category(
    state: State<'_, AppState>,
    id: String,
    category: String,
) -> Result<ClipRow, String> {
    let category = category.trim().to_string();
    if category.is_empty() || category.len() > 24 {
        return Err("分类名不合法（1-24 字符）".into());
    }
    let s = storage(&state)?;
    s.set_category(&id, &category).map_err(|e| e.to_string())?;
    s.get_clip(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "条目不存在".to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub retention_days: i64,
    pub device_id: String,
    pub hotkey: String,
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<SettingsDto, String> {
    let s = storage(&state)?;
    Ok(SettingsDto {
        retention_days: s.retention_days().map_err(|e| e.to_string())?,
        device_id: state.device_id.clone(),
        hotkey: "Ctrl+Shift+V".into(),
    })
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    match key.as_str() {
        "retention_days" => {
            let days: i64 = value
                .trim()
                .parse()
                .map_err(|_| "保留天数须为整数".to_string())?;
            if !(1..=3650).contains(&days) {
                return Err("保留天数须在 1-3650 之间".into());
            }
            storage(&state)?
                .set_setting("retention_days", &days.to_string())
                .map_err(|e| e.to_string())
        }
        _ => Err("不支持修改该设置项".into()),
    }
}

#[tauri::command]
pub fn clear_all(state: State<'_, AppState>) -> Result<usize, String> {
    storage(&state)?.clear_all().map_err(|e| e.to_string())
}
