// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 内嵌浏览器「书签 / 最近历史」持久化(2026-10-17 立)。
//!
//! 为什么单开一个文件:内嵌浏览器的标签会话在 `embedded_browser.rs` 里是**内存态**
//! (关窗即散),而书签/历史必须跨重启存活。这里把**纯函数**(Chrome/Edge 书签树展开、
//! URL 过滤、去重/截断)与**薄胶水**(6 个 `#[tauri::command]`)分开,纯函数可在没有
//! tauri 运行时的情况下真跑单测。
//!
//! 落点:`<app_data_dir>/browser-bookmarks.json`(与 `desktop_prefs` 的 app_config_dir
//! 分家:书签属于用户内容,不是行为偏好)。结构体统一 `rename_all = "camelCase"`,
//! 与前端消费的字段名逐字对齐;时间戳为 Unix 毫秒。
//!
//! 安全边界:只接受 `http` / `https` 地址(复用 `embedded_browser::is_browsable_url`),
//! 系统书签导入只读 Chrome/Edge 的 Bookmarks JSON,不触碰其它文件。

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::embedded_browser::is_browsable_url;

/// 持久化文件名(位于 app_data_dir 根下)。
const STORE_FILE_NAME: &str = "browser-bookmarks.json";

/// 书签条数上限(防御性:导入超大书签树时不无限膨胀)。
const MAX_BOOKMARKS: usize = 2_000;

/// 最近历史条数上限(超出丢最旧)。
const MAX_HISTORY: usize = 500;

/// 同进程内书签 id 的序号,避免同一毫秒内连续添加撞 id。
static ID_SEQ: AtomicU64 = AtomicU64::new(0);

/// 一条书签。字段名即前端消费名(`id` / `url` / `title` / `createdAt`)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: String,
    pub url: String,
    pub title: String,
    /// Unix 毫秒。
    pub created_at: i64,
}

/// 一条最近访问记录。同一 URL 只保留最近一次。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub url: String,
    pub title: String,
    /// Unix 毫秒。
    pub visited_at: i64,
}

/// 落盘结构:书签与历史同一个 JSON 文件(原子性一次写,读取一次到位)。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct BrowserData {
    pub bookmarks: Vec<Bookmark>,
    pub history: Vec<HistoryEntry>,
}

/// 系统书签导入结果(前端据此提示「导入 N 条 / 跳过 M 条」)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    /// 本次新增的书签数。
    pub imported: usize,
    /// 已存在(按 URL 去重)而跳过的条数。
    pub skipped: usize,
    /// 从系统浏览器读到的有效书签总数。
    pub total: usize,
    /// 实际读取到书签的浏览器名(如 `Chrome` / `Edge`)。
    pub sources: Vec<String>,
}

// ==================== 纯函数:归一化 / 时间 / 解析 ====================

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn new_bookmark_id(now_ms: i64) -> String {
    let seq = ID_SEQ.fetch_add(1, Ordering::Relaxed);
    format!("bm-{now_ms}-{seq}")
}

/// 就地归一:丢非法 URL、按 URL 去重(保留靠前/较新的那条)、按上限截断。
fn normalize(data: &mut BrowserData) {
    data.bookmarks
        .retain(|b| !b.id.trim().is_empty() && is_browsable_url(&b.url));
    let mut seen = HashSet::new();
    data.bookmarks.retain(|b| seen.insert(b.url.clone()));
    data.bookmarks.truncate(MAX_BOOKMARKS);

    data.history.retain(|h| is_browsable_url(&h.url));
    let mut seen = HashSet::new();
    data.history.retain(|h| seen.insert(h.url.clone()));
    data.history.truncate(MAX_HISTORY);
}

/// 从 Chrome/Edge 的 Bookmarks JSON 里递归收集 `(url, title)`。
///
/// 结构固定为 `roots.{bookmark_bar,other,synced}.children[]`,文件夹再嵌套
/// `children`;只认 `type == "url"` 且地址可浏览的节点。
fn collect_bookmarks(node: &Value, out: &mut Vec<(String, String)>) {
    if let Some(children) = node.get("children").and_then(Value::as_array) {
        for child in children {
            collect_bookmarks(child, out);
        }
    }
    if node.get("type").and_then(Value::as_str) != Some("url") {
        return;
    }
    let Some(url) = node.get("url").and_then(Value::as_str) else {
        return;
    };
    if !is_browsable_url(url) {
        return;
    }
    let title = node
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .unwrap_or(url);
    out.push((url.trim().to_string(), title.to_string()));
}

/// 展开整份 Bookmarks JSON:优先走 `roots`,缺失时退化为整棵树扫描。
fn parse_bookmarks_json(json: &Value) -> Vec<(String, String)> {
    let mut out = Vec::new();
    match json.get("roots") {
        Some(roots) if roots.is_object() => {
            if let Some(map) = roots.as_object() {
                for root in map.values() {
                    collect_bookmarks(root, &mut out);
                }
            }
        }
        _ => collect_bookmarks(json, &mut out),
    }
    out
}

/// 系统浏览器书签文件清单:`(Bookmarks 文件路径, 浏览器名)`。
///
/// 覆盖 Chrome / Edge 的 `Default` 与 `Profile *` 配置目录(多用户配置常见形态)。
fn system_bookmark_files() -> Result<Vec<(PathBuf, &'static str)>, String> {
    let local = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "无法读取 LOCALAPPDATA 环境变量,无法定位系统浏览器书签".to_string())?;
    let browsers = [
        (local.join("Google").join("Chrome").join("User Data"), "Chrome"),
        (local.join("Microsoft").join("Edge").join("User Data"), "Edge"),
    ];
    let mut files = Vec::new();
    for (user_data, browser) in browsers {
        if !user_data.is_dir() {
            continue;
        }
        let default = user_data.join("Default").join("Bookmarks");
        if default.is_file() {
            files.push((default, browser));
        }
        let mut profiles: Vec<PathBuf> = std::fs::read_dir(&user_data)
            .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).collect())
            .unwrap_or_default();
        profiles.sort();
        for profile in profiles {
            let name = profile.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with("Profile ") {
                let file = profile.join("Bookmarks");
                if file.is_file() {
                    files.push((file, browser));
                }
            }
        }
    }
    Ok(files)
}

// ==================== 持久化 I/O ====================

fn store_path_in(data_dir: &Path) -> PathBuf {
    data_dir.join(STORE_FILE_NAME)
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("解析应用数据目录失败: {e}"))?;
    Ok(store_path_in(&data_dir))
}

/// 损坏文件的备份路径:`<file>.bak-<源文件修改时间秒>`。
///
/// T9:用源文件 mtime 而不是当前时间,同一份损坏内容重复读取时复用同名备份,
/// 不会每次访问都堆一份 `.bak`。
fn corrupt_backup_path(path: &Path) -> PathBuf {
    let stamp = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(format!(".bak-{stamp}"));
    path.with_file_name(name)
}

/// 复制原文件到备份路径;备份已存在视为完成(幂等)。
fn backup_corrupt(path: &Path, backup: &Path) -> Result<(), String> {
    if backup.exists() {
        return Ok(());
    }
    std::fs::copy(path, backup)
        .map(|_| ())
        .map_err(|e| format!("备份损坏书签文件失败({}): {e}", backup.display()))
}

/// 读取结果:可写或只读降级。
enum LoadOutcome {
    Ready(BrowserData),
    /// 解析失败:先备份再降级为只读,写命令一律拒绝,绝不落回空数据把原文件覆盖掉。
    Degraded {
        backup: Option<PathBuf>,
        error: String,
    },
}

/// 读 + 归一。文件缺失/损坏一律回退空数据(首次运行属正常形态,不冒泡成错误)。
fn load_outcome_from(path: &Path) -> LoadOutcome {
    let raw = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(_) => return LoadOutcome::Ready(BrowserData::default()),
    };
    // 与 desktop_prefs 同一先例:Windows 侧非 Rust 写手会留 UTF-8 BOM。
    let body = raw.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&raw);
    match serde_json::from_slice::<BrowserData>(body) {
        Ok(mut data) => {
            normalize(&mut data);
            LoadOutcome::Ready(data)
        }
        Err(e) => {
            let backup_path = corrupt_backup_path(path);
            let backup = match backup_corrupt(path, &backup_path) {
                Ok(()) => {
                    log::error!(
                        "[browser-bookmarks] {} 解析失败({e}),已备份为 {},进入只读降级",
                        path.display(),
                        backup_path.display()
                    );
                    Some(backup_path)
                }
                Err(berr) => {
                    log::error!(
                        "[browser-bookmarks] {} 解析失败({e}),备份亦失败({berr}),进入只读降级",
                        path.display()
                    );
                    None
                }
            };
            LoadOutcome::Degraded {
                backup,
                error: e.to_string(),
            }
        }
    }
}

/// 只读入口:解析失败时仍返回空数据供 UI 渲染,原文件保持不动。
fn load_data_from(path: &Path) -> BrowserData {
    match load_outcome_from(path) {
        LoadOutcome::Ready(data) => data,
        LoadOutcome::Degraded { .. } => BrowserData::default(),
    }
}

/// 写入口:解析失败时拒绝覆盖(原文件已备份,用户可手工修复后重启)。
fn load_writable_from(path: &Path) -> Result<BrowserData, String> {
    match load_outcome_from(path) {
        LoadOutcome::Ready(data) => Ok(data),
        LoadOutcome::Degraded { backup, error } => {
            let where_ = match backup {
                Some(path) => format!(",已备份为 {}", path.display()),
                None => ",备份失败".to_string(),
            };
            Err(format!(
                "书签文件解析失败({error}){where_};当前为只读降级,拒绝覆盖"
            ))
        }
    }
}

fn save_data_to(path: &Path, data: &BrowserData) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("创建书签目录失败({}): {e}", dir.display()))?;
    }
    let bytes = serde_json::to_vec_pretty(data)
        .map_err(|e| format!("序列化书签数据失败: {e}"))?;
    std::fs::write(path, bytes)
        .map_err(|e| format!("写入书签文件失败({}): {e}", path.display()))
}

// ==================== Tauri 命令(薄胶水)====================

/// 读取全部书签与最近历史。
#[tauri::command]
pub fn embedded_browser_data(app: AppHandle) -> Result<BrowserData, String> {
    Ok(load_data_from(&store_path(&app)?))
}

/// 添加书签(按 URL 去重:已存在则只刷新标题,返回既有条目)。
#[tauri::command]
pub fn embedded_browser_add_bookmark(
    app: AppHandle,
    url: String,
    title: Option<String>,
) -> Result<Bookmark, String> {
    let url = url.trim().to_string();
    if !is_browsable_url(&url) {
        return Err(format!("只能收藏 http/https 地址: {url}"));
    }
    let path = store_path(&app)?;
    let mut data = load_writable_from(&path)?;
    let title = title
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| url.clone());

    if let Some(idx) = data.bookmarks.iter().position(|b| b.url == url) {
        if data.bookmarks[idx].title != title {
            data.bookmarks[idx].title = title;
            save_data_to(&path, &data)?;
        }
        return Ok(data.bookmarks[idx].clone());
    }

    let bookmark = Bookmark {
        id: new_bookmark_id(now_ms()),
        url,
        title,
        created_at: now_ms(),
    };
    data.bookmarks.insert(0, bookmark.clone());
    normalize(&mut data);
    save_data_to(&path, &data)?;
    Ok(bookmark)
}

/// 按 id 删除书签(id 不存在视为已删除,幂等成功)。
#[tauri::command]
pub fn embedded_browser_delete_bookmark(app: AppHandle, id: String) -> Result<(), String> {
    let path = store_path(&app)?;
    let mut data = load_writable_from(&path)?;
    let before = data.bookmarks.len();
    data.bookmarks.retain(|b| b.id != id);
    if data.bookmarks.len() != before {
        save_data_to(&path, &data)?;
    }
    Ok(())
}

/// 清空最近历史(书签不动)。
#[tauri::command]
pub fn embedded_browser_clear_history(app: AppHandle) -> Result<(), String> {
    let path = store_path(&app)?;
    let mut data = load_writable_from(&path)?;
    if data.history.is_empty() {
        return Ok(());
    }
    data.history.clear();
    save_data_to(&path, &data)
}

/// 记录一条访问:同 URL 只保留最近一次,插到最前,超过上限丢最旧。
#[tauri::command]
pub fn embedded_browser_record_history(
    app: AppHandle,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    let url = url.trim().to_string();
    if !is_browsable_url(&url) {
        return Err(format!("只能记录 http/https 地址: {url}"));
    }
    let path = store_path(&app)?;
    let mut data = load_writable_from(&path)?;
    let title = title
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| url.clone());

    data.history.retain(|h| h.url != url);
    data.history.insert(
        0,
        HistoryEntry {
            url,
            title,
            visited_at: now_ms(),
        },
    );
    normalize(&mut data);
    save_data_to(&path, &data)
}

/// 从本机 Chrome / Edge 的 Bookmarks JSON 导入书签。
///
/// 只读、不修改系统文件;按 URL 与既有书签去重。找不到任何书签文件时返回可读错误,
/// 而不是静默成功。
#[tauri::command]
pub fn embedded_browser_import_system_bookmarks(
    app: AppHandle,
) -> Result<ImportSummary, String> {
    let path = store_path(&app)?;
    let mut data = load_writable_from(&path)?;

    let files = system_bookmark_files()?;
    if files.is_empty() {
        return Err(
            "未找到 Chrome / Edge 的书签文件,请先启动对应浏览器并至少添加一个书签".to_string(),
        );
    }

    let mut parsed: Vec<(String, String)> = Vec::new();
    let mut sources: Vec<String> = Vec::new();
    let mut read_errors: Vec<String> = Vec::new();
    for (file, browser) in &files {
        match std::fs::read_to_string(file) {
            Ok(text) => {
                let body = text.strip_prefix('\u{feff}').unwrap_or(&text);
                match serde_json::from_str::<Value>(body) {
                    Ok(json) => {
                        let before = parsed.len();
                        parsed.extend(parse_bookmarks_json(&json));
                        if parsed.len() > before && !sources.iter().any(|s| s == browser) {
                            sources.push((*browser).to_string());
                        }
                    }
                    Err(e) => read_errors.push(format!("{}: {e}", file.display())),
                }
            }
            Err(e) => read_errors.push(format!("{}: {e}", file.display())),
        }
    }

    if parsed.is_empty() {
        let detail = if read_errors.is_empty() {
            String::new()
        } else {
            format!("(读取失败: {})", read_errors.join("; "))
        };
        return Err(format!("系统浏览器中没有可导入的 http/https 书签{detail}"));
    }

    let total = parsed.len();
    let mut existing: HashSet<String> = data.bookmarks.iter().map(|b| b.url.clone()).collect();
    let now = now_ms();
    let mut imported_entries: Vec<Bookmark> = Vec::new();
    for (url, title) in parsed {
        if !existing.insert(url.clone()) {
            continue;
        }
        imported_entries.push(Bookmark {
            id: new_bookmark_id(now),
            url,
            title,
            created_at: now,
        });
    }
    let imported = imported_entries.len();
    imported_entries.append(&mut data.bookmarks);
    data.bookmarks = imported_entries;
    normalize(&mut data);
    save_data_to(&path, &data)?;

    Ok(ImportSummary {
        imported,
        skipped: total.saturating_sub(imported),
        total,
        sources,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chrome_json() -> Value {
        serde_json::from_str(
            r#"{
                "roots": {
                    "bookmark_bar": {
                        "children": [
                            { "type": "url", "name": "智汇AI", "url": "https://aizhs.top/" },
                            { "type": "folder", "name": "子文件夹", "children": [
                                { "type": "url", "name": "示例", "url": "http://example.com/" }
                            ]},
                            { "type": "url", "name": "脚本", "url": "javascript:alert(1)" }
                        ]
                    },
                    "other": { "children": [] }
                }
            }"#,
        )
        .expect("fixture json")
    }

    #[test]
    fn parses_nested_bookmark_tree_and_skips_non_http() {
        let out = parse_bookmarks_json(&chrome_json());
        assert_eq!(out.len(), 2);
        assert_eq!(out[0], ("https://aizhs.top/".to_string(), "智汇AI".to_string()));
        assert_eq!(out[1].0, "http://example.com/");
    }

    #[test]
    fn normalize_dedupes_by_url_and_drops_invalid() {
        let mut data = BrowserData {
            bookmarks: vec![
                Bookmark {
                    id: "a".into(),
                    url: "https://aizhs.top/".into(),
                    title: "A".into(),
                    created_at: 2,
                },
                Bookmark {
                    id: "b".into(),
                    url: "https://aizhs.top/".into(),
                    title: "B".into(),
                    created_at: 1,
                },
                Bookmark {
                    id: "c".into(),
                    url: "file:///etc/passwd".into(),
                    title: "C".into(),
                    created_at: 3,
                },
            ],
            history: vec![
                HistoryEntry {
                    url: "https://aizhs.top/".into(),
                    title: "A".into(),
                    visited_at: 2,
                },
                HistoryEntry {
                    url: "https://aizhs.top/".into(),
                    title: "A2".into(),
                    visited_at: 1,
                },
            ],
        };
        normalize(&mut data);
        assert_eq!(data.bookmarks.len(), 1);
        assert_eq!(data.bookmarks[0].id, "a");
        assert_eq!(data.history.len(), 1);
        assert_eq!(data.history[0].visited_at, 2);
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ihui-bm-{tag}-{}", now_ms()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn corrupt_backups(dir: &Path) -> Vec<PathBuf> {
        let prefix = format!("{STORE_FILE_NAME}.bak-");
        std::fs::read_dir(dir)
            .expect("read temp dir")
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with(&prefix))
            .map(|e| e.path())
            .collect()
    }

    /// T9 红夹具:解析失败必须先把原文件备份成 `<file>.bak-<ts>`,再进入只读降级。
    /// 旧实现直接回退空数据,下一次写命令会把用户原文件覆盖成 `{bookmarks:[]}`。
    #[test]
    fn 解析失败先备份再只读降级() {
        let dir = temp_dir("corrupt-read");
        let path = store_path_in(&dir);
        std::fs::write(&path, b"{broken").expect("write corrupt fixture");

        let data = load_data_from(&path);
        assert!(data.bookmarks.is_empty(), "降级读取仍应返回空数据供 UI 渲染");
        assert_eq!(
            std::fs::read(&path).expect("read original"),
            b"{broken",
            "读取阶段不得改写原文件"
        );
        assert_eq!(
            corrupt_backups(&dir).len(),
            1,
            "解析失败必须先落一份 <file>.bak-<ts> 备份"
        );
    }

    /// T9 写侧夹具:损坏文件写入被拒、原文件不被覆盖、重复访问只备一份。
    #[test]
    fn 损坏文件写入被拒且只备一份() {
        let dir = temp_dir("corrupt-write");
        let path = store_path_in(&dir);
        std::fs::write(&path, b"{broken").expect("write corrupt fixture");

        let first = load_writable_from(&path).expect_err("损坏文件必须拒绝写入");
        assert!(
            first.contains("只读降级") && first.contains(".bak-"),
            "错误必须点明已备份且处于只读降级: {first}"
        );
        let second = load_writable_from(&path).expect_err("再次读取仍须拒绝");
        assert!(second.contains("只读降级"), "第二次错误: {second}");

        assert_eq!(
            std::fs::read(&path).expect("read original"),
            b"{broken",
            "拒绝写入后原文件必须保持原样"
        );
        assert_eq!(
            corrupt_backups(&dir).len(),
            1,
            "同一份损坏内容重复访问只应留一份备份"
        );
    }

    #[test]
    fn 正常文件不备份且可写() {
        let dir = temp_dir("healthy");
        let path = store_path_in(&dir);
        let data = BrowserData {
            bookmarks: vec![Bookmark {
                id: "a".into(),
                url: "https://aizhs.top/".into(),
                title: "智汇AI".into(),
                created_at: 1,
            }],
            history: vec![],
        };
        save_data_to(&path, &data).expect("write fixture");

        let loaded = load_writable_from(&path).expect("正常文件必须可写");
        assert_eq!(loaded.bookmarks.len(), 1);
        assert!(corrupt_backups(&dir).is_empty(), "正常文件不应产生备份");
    }

    #[test]
    fn store_path_is_inside_app_data_dir() {
        let dir = std::path::Path::new("C:/app-data");
        assert_eq!(
            store_path_in(dir),
            std::path::Path::new("C:/app-data").join(STORE_FILE_NAME)
        );
    }
}
