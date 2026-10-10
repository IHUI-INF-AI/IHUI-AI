// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! WorkBuddy 程序一键重置（2026-10-10 立）。
//!
//! 目标程序：WorkBuddy Desktop（Electron）。本地状态面（2026-10-10 只读侦察实测）：
//! - `~/.workbuddy/` 用户数据目录（本机 19 GB）：logs 7.9G / traces 4.3G / workspace 2.9G /
//!   projects 1.1G / binaries 610M / plugins 427M / app 242M / …
//! - 登录态 = `app/session/`（Chromium webview 档案：Local Storage/IndexedDB/Cookies/Cache）；
//! - 设备身份 = `device-id`（36 字符 GUID 文本文件）；
//! - 可再生缓存 = `logs/`、`traces/`、`tmp/`、`shell-snapshots/`、`file-tree-manifests/`、
//!   `app/CodeCache`、`app/cache`、`app/Crashpad`、`app/session/{Cache,Code Cache,GPUCache,…}`。
//!
//! 三档能力（与前端向导一一对应）：
//! ① 维护清理：只删可再生缓存与日志（保留登录态/记忆/技能/工作区）——本机实测可回收 ~12.4 GB；
//! ② 登出重置：清 `app/session`（下次启动回登录页），可选连带清除 device-id
//!    （**本地清除→由 WorkBuddy 自行重新注册**；不做任何指纹伪造，服务端设备限制不受本地清除影响）；
//! ③ 出厂重置：把 `~/.workbuddy/` 顶层条目**整体搬移到同卷隔离目录**（rename，秒级、零数据丢失、
//!    可逆——把隔离目录条目搬回即恢复），应用下次启动自动重建全新状态。
//!
//! 安全网（与 checkin_capture 同纪律）：
//! - 层⓪ 强杀 WorkBuddy 进程（重置窗口内保持目标死亡，避免文件锁与并发写）；
//! - 根目录 sanity 护栏：必须命中特征标记（device-id/app/logs/workbuddy.db/…），
//!   且不得是用户主目录本身——env 误注入时拒绝动手而不是清掉任意目录；
//! - 核心函数一律 root 显式传参（测试用临时夹具，不用进程级 env 全局）；
//! - 每层逐条目报告，锁文件只记错误不 panic，照实呈现（不谎报全绿）。

use serde::{Deserialize, Serialize};

use crate::IpcError;

// ================== 报告结构 ==================

#[derive(Debug, Clone, Serialize)]
pub struct WbLayerReport {
    pub layer: u8,
    pub name: &'static str,
    pub ok: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WbResetReport {
    pub layers: Vec<WbLayerReport>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WbEntry {
    pub path: String,
    /// maintenance | webview_logout | device_identity | user_asset | never
    pub tier: &'static str,
    pub size_mb: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WbProbeReport {
    pub root: String,
    pub workbuddy_running: bool,
    pub total_mb: f64,
    /// 维护档 + 登出档合计（即"不丢任何用户数据可回收"的体量）
    pub reclaimable_mb: f64,
    pub entries: Vec<WbEntry>,
}

/// 执行进度事件（Tauri Channel 逐条目回传）。
#[derive(Debug, Clone, Serialize)]
pub struct WbProgressEvent {
    pub layer: u8,
    /// 已完成条目数（含失败）
    pub done: usize,
    pub total: usize,
    /// 当前条目相对路径
    pub item: String,
}

pub type WbProgressCb<'a> = &'a (dyn Fn(WbProgressEvent) + Send + Sync);

/// 隔离区信息（列表命令返回）。
#[derive(Debug, Clone, Serialize)]
pub struct WbQuarantineInfo {
    pub name: String,
    pub path: String,
    /// 隔离目录名后缀时间戳（unix 秒）
    pub created_unix: u64,
    /// factory | logout | unknown(manifest 缺失/损坏)
    pub mode: String,
    /// 记录的原始根目录
    pub original_root: String,
    /// 数据条目数（不含 manifest）
    pub entries: usize,
    pub size_mb: f64,
}

/// 单条计划动作。
#[derive(Debug, Clone, Serialize)]
pub struct WbPlanAction {
    pub path: String,
    /// delete_file | delete_dir | quarantine
    pub action: &'static str,
    pub size_mb: f64,
}

/// 计划预览报告（执行前"会动什么"的精确清单）。
#[derive(Debug, Clone, Serialize)]
pub struct WbPlanReport {
    /// maintenance | logout | factory
    pub mode: String,
    pub include_device_id: bool,
    pub actions: Vec<WbPlanAction>,
    pub total_mb: f64,
}

/// 历史台账条目（reset-history/<ts>-<mode>.json）。
#[derive(Debug, Clone, Serialize)]
pub struct WbHistoryItem {
    pub file: String,
    pub ts_unix: u64,
    pub mode: String,
    pub ok: bool,
    pub summary: String,
}

// ================== 隔离区 manifest（恢复依据） ==================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WbManifestEntry {
    /// 隔离区内的条目名
    name: String,
    /// 原始相对路径（相对用户根目录）
    original_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WbQuarantineManifest {
    /// factory | logout
    mode: String,
    created_unix: u64,
    /// 原始用户根目录（绝对路径字符串）
    root: String,
    entries: Vec<WbManifestEntry>,
}

/// 隔离目录命名前缀（工厂/登出共用；恢复与删除命令以此作护栏）。
pub const QUARANTINE_PREFIX: &str = ".workbuddy-quarantine-";
/// 隔离区 manifest 文件名。
pub const QUARANTINE_MANIFEST: &str = "quarantine-manifest.json";
/// 历史台账目录（顶层；分类判据落 user_asset 档，维护清理不动它）。
pub const HISTORY_DIR: &str = "reset-history";
/// 台账上限：只留最近 N 份，防止 reset-history 无限增长（真实文件名为 10 位 unix 秒，
/// 字典序 == 数值序；超出按文件名升序即最旧的先删）。
pub const HISTORY_KEEP: usize = 50;

/// 台账裁剪：超出 keep 份时删除最旧的文件，返回删除数。
pub fn prune_history(dir: &std::path::Path, keep: usize) -> usize {
    let Ok(rd) = std::fs::read_dir(dir) else { return 0 };
    let mut names: Vec<String> = rd
        .flatten()
        .filter(|e| e.path().is_file())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.ends_with(".json"))
        .collect();
    if names.len() <= keep {
        return 0;
    }
    names.sort();
    let excess = names.len() - keep;
    let mut removed = 0usize;
    for n in names.into_iter().take(excess) {
        if std::fs::remove_file(dir.join(&n)).is_ok() {
            removed += 1;
        }
    }
    removed
}

// ================== 分类判据（纯函数，可单测） ==================

/// 维护档顶层目录（内容可整体清空，目录壳保留）。
pub const MAINTENANCE_TOP_DIRS: &[&str] = &[
    "logs",
    "traces",
    "tmp",
    "shell-snapshots",
    "file-tree-manifests",
    "clipboard-images",
];
/// app/ 下维护档子目录（整目录删除，应用自行重建）。
pub const MAINTENANCE_APP_DIRS: &[&str] = &["CodeCache", "cache", "Crashpad"];
/// app/session/ 下 webview 缓存子目录（维护档；session 目录本身属登出档）。
pub const MAINTENANCE_SESSION_DIRS: &[&str] = &[
    "Cache",
    "Code Cache",
    "GPUCache",
    "DawnGraphiteCache",
    "DawnWebGPUCache",
    "DIPS",
    "DIPS-wal",
];
/// 登录态目录（webview 档案整目录）。
pub const WEBVIEW_SESSION_DIR: &str = "session";
/// 设备身份文件。
pub const DEVICE_ID_FILE: &str = "device-id";
/// 根目录 sanity 特征标记：命中任意一个才认这是 WorkBuddy 用户目录。
pub const SANITY_MARKERS: &[&str] = &[
    "device-id",
    "app",
    "logs",
    "workbuddy.db",
    "sessions",
    "workspace",
    "memory",
];

/// 顶层条目分类（纯函数）。返回 tier 字符串：
/// maintenance / device_identity / user_asset。
pub fn classify_top_level(name: &str) -> &'static str {
    if name == DEVICE_ID_FILE {
        return "device_identity";
    }
    if MAINTENANCE_TOP_DIRS.contains(&name) {
        return "maintenance";
    }
    "user_asset"
}

/// app/ 子条目分类（纯函数）。
pub fn classify_app_child(name: &str) -> &'static str {
    if name == WEBVIEW_SESSION_DIR {
        return "webview_logout";
    }
    if MAINTENANCE_APP_DIRS.contains(&name) {
        return "maintenance";
    }
    "user_asset"
}

/// app/session/ 子条目分类（纯函数）。
pub fn classify_session_child(name: &str) -> &'static str {
    if MAINTENANCE_SESSION_DIRS.contains(&name) {
        return "maintenance";
    }
    "user_asset"
}

/// 根目录 sanity 护栏：目录必须存在且命中 ≥1 特征标记；
/// 且不得是用户主目录本身（env 误注入的最后一道闸）。
pub fn sanity_check_root(root: &std::path::Path) -> Result<(), String> {
    if !root.is_dir() {
        return Err(format!("目标目录不存在: {}", root.display()));
    }
    let home = resolve_home();
    if let Some(h) = home {
        if root == h {
            return Err("护栏拒绝：目标目录是用户主目录本身".into());
        }
    }
    let hit: Vec<&str> = SANITY_MARKERS
        .iter()
        .filter(|m| root.join(m).exists())
        .copied()
        .collect();
    if hit.is_empty() {
        return Err(format!(
            "护栏拒绝：{} 不含任何 WorkBuddy 特征标记({:?})——疑似 env 误注入，拒绝动手",
            root.display(),
            SANITY_MARKERS
        ));
    }
    Ok(())
}

fn resolve_home() -> Option<std::path::PathBuf> {
    if let Ok(p) = std::env::var("USERPROFILE") {
        if !p.is_empty() {
            return Some(std::path::PathBuf::from(p));
        }
    }
    if let Ok(p) = std::env::var("HOME") {
        if !p.is_empty() {
            return Some(std::path::PathBuf::from(p));
        }
    }
    None
}

/// 命令层根目录解析：WB_USER_DIR env 覆盖（测试/自定义）→ ~/.workbuddy。
fn resolve_user_dir() -> Result<std::path::PathBuf, String> {
    if let Ok(p) = std::env::var("WB_USER_DIR") {
        if !p.is_empty() {
            return Ok(std::path::PathBuf::from(p));
        }
    }
    let home = resolve_home().ok_or("无法定位用户主目录(USERPROFILE/HOME 均缺)")?;
    Ok(home.join(".workbuddy"))
}

// ================== 体量与删除辅助 ==================

fn dir_size_recursive(p: &std::path::Path) -> u64 {
    let meta = match std::fs::symlink_metadata(p) {
        Ok(m) => m,
        Err(_) => return 0,
    };
    if meta.is_dir() {
        let mut total = 0u64;
        if let Ok(rd) = std::fs::read_dir(p) {
            for e in rd.flatten() {
                total += dir_size_recursive(&e.path());
            }
        }
        total
    } else {
        meta.len()
    }
}

/// 层报告汇总：无失败 = ok。
fn layer_from(name: &'static str, layer: u8, errors: &[String], acted: usize, acted_noun: &str) -> WbLayerReport {
    if errors.is_empty() {
        WbLayerReport {
            layer,
            name,
            ok: true,
            detail: if acted == 0 {
                "无待处理条目(本就不存在或已清空)".into()
            } else {
                format!("已{acted_noun} {acted} 项")
            },
        }
    } else {
        WbLayerReport {
            layer,
            name,
            ok: false,
            detail: format!(
                "已{acted_noun} {acted} 项; 失败 {} 项: {}",
                errors.len(),
                errors.join("; ")
            ),
        }
    }
}

// ================== 层⓪ 强杀 WorkBuddy 进程 ==================

/// 进程映像判据（纯函数，可单测）：映像名(不区分大小写)含 "workbuddy"。
/// 智汇AI 自身(ihui-desktop/智汇AI.exe)与 TRAE 不命中。
pub fn is_workbuddy_process_image(image_name: &str) -> bool {
    image_name.to_ascii_lowercase().contains("workbuddy")
}

#[cfg(windows)]
fn kill_workbuddy_processes() -> WbLayerReport {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

    let self_pid = std::process::id();
    let mut killed: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    unsafe {
        let snap = match CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            Ok(h) => h,
            Err(e) => {
                return WbLayerReport {
                    layer: 0,
                    name: "kill_workbuddy_processes",
                    ok: false,
                    detail: format!("进程快照失败: {e}"),
                }
            }
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                let image = String::from_utf16_lossy(
                    &entry.szExeFile[..entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(0)],
                );
                let pid = entry.th32ProcessID;
                if is_workbuddy_process_image(&image) && pid != self_pid {
                    match OpenProcess(PROCESS_TERMINATE, false, pid) {
                        Ok(h) => {
                            if TerminateProcess(h, 1).is_ok() {
                                killed.push(format!("{}({})", image, pid));
                            } else {
                                errors.push(format!("{}({pid}): 终止失败", image));
                            }
                            let _ = CloseHandle(h);
                        }
                        Err(e) => errors.push(format!("{}({pid}): 打开失败({e})", image)),
                    }
                }
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
    }
    if killed.is_empty() {
        let detail = if errors.is_empty() {
            "无运行中的 WorkBuddy 进程".to_string()
        } else {
            format!("无进程被杀但有异常: {}", errors.join("; "))
        };
        WbLayerReport { layer: 0, name: "kill_workbuddy_processes", ok: errors.is_empty(), detail }
    } else {
        // 给句柄释放留时间（Electron 全家桶退出有尾流）
        std::thread::sleep(std::time::Duration::from_millis(1500));
        WbLayerReport {
            layer: 0,
            name: "kill_workbuddy_processes",
            ok: errors.is_empty(),
            detail: format!(
                "已强杀 {} 个 WorkBuddy 进程: {};{}",
                killed.len(),
                killed.join(", "),
                errors.join("; ")
            ),
        }
    }
}

#[cfg(not(windows))]
fn kill_workbuddy_processes() -> WbLayerReport {
    WbLayerReport {
        layer: 0,
        name: "kill_workbuddy_processes",
        ok: true,
        detail: "skipped(非 Windows 平台未实现进程终止)".into(),
    }
}

fn maybe_kill(kill_running: bool) -> Option<WbLayerReport> {
    if kill_running {
        Some(kill_workbuddy_processes())
    } else {
        None
    }
}

// ================== 动作清单引擎（计划与执行共用同一份判据） ==================

/// 单条待执行动作。计划预览与实际执行都从这里出，杜绝"说的和做的不一致"。
#[derive(Debug, Clone)]
pub struct WbActionItem {
    /// 相对路径标签（UI/进度展示）
    pub path: String,
    /// 隔离区内的条目名（维护清理执行时不使用）
    pub qname: String,
    /// delete_file | delete_dir | quarantine
    pub action: &'static str,
    pub full: std::path::PathBuf,
}

/// 维护档动作清单：顶层维护目录逐子条目删除（壳保留）+ app/session 维护子目录整删。
fn build_maintenance_items(root: &std::path::Path) -> Vec<WbActionItem> {
    let mut items = Vec::new();
    for top in MAINTENANCE_TOP_DIRS {
        let dir = root.join(top);
        if let Ok(rd) = std::fs::read_dir(&dir) {
            for e in rd.flatten() {
                let child = e.file_name().to_string_lossy().to_string();
                let is_dir = e.path().is_dir();
                items.push(WbActionItem {
                    path: format!("{top}/{child}"),
                    qname: child,
                    action: if is_dir { "delete_dir" } else { "delete_file" },
                    full: e.path(),
                });
            }
        }
    }
    for name in MAINTENANCE_APP_DIRS {
        let dir = root.join("app").join(name);
        if dir.exists() {
            items.push(WbActionItem {
                path: format!("app/{name}"),
                qname: (*name).to_string(),
                action: "delete_dir",
                full: dir,
            });
        }
    }
    for name in MAINTENANCE_SESSION_DIRS {
        let dir = root.join("app").join(WEBVIEW_SESSION_DIR).join(name);
        if dir.exists() {
            items.push(WbActionItem {
                path: format!("app/session/{name}"),
                qname: (*name).to_string(),
                action: "delete_dir",
                full: dir,
            });
        }
    }
    items
}

/// 登出档动作清单：session 整目录 + 可选 device-id，全部走隔离区搬移（可逆）。
fn build_logout_items(root: &std::path::Path, include_device_id: bool) -> Vec<WbActionItem> {
    let mut items = Vec::new();
    let session = root.join("app").join(WEBVIEW_SESSION_DIR);
    if session.exists() {
        items.push(WbActionItem {
            path: "app/session".into(),
            qname: WEBVIEW_SESSION_DIR.to_string(),
            action: "quarantine",
            full: session,
        });
    }
    if include_device_id {
        let dev = root.join(DEVICE_ID_FILE);
        if dev.exists() {
            items.push(WbActionItem {
                path: DEVICE_ID_FILE.into(),
                qname: DEVICE_ID_FILE.to_string(),
                action: "quarantine",
                full: dev,
            });
        }
    }
    items
}

/// 出厂档动作清单：根目录全部顶层条目。
fn build_factory_items(root: &std::path::Path) -> Vec<WbActionItem> {
    let mut items = Vec::new();
    if let Ok(rd) = std::fs::read_dir(root) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            items.push(WbActionItem {
                path: name.clone(),
                qname: name,
                action: "quarantine",
                full: e.path(),
            });
        }
    }
    items
}

/// 建隔离区并写 manifest（恢复的唯一依据）。
fn create_quarantine(
    root: &std::path::Path,
    mode: &str,
    entries: &[WbActionItem],
) -> Result<std::path::PathBuf, String> {
    let parent = root
        .parent()
        .ok_or_else(|| format!("根目录无父目录,无法建隔离区: {}", root.display()))?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let quarantine = parent.join(format!("{QUARANTINE_PREFIX}{ts}"));
    std::fs::create_dir_all(&quarantine)
        .map_err(|e| format!("隔离区创建失败 {}: {e}", quarantine.display()))?;
    let manifest = WbQuarantineManifest {
        mode: mode.to_string(),
        created_unix: ts,
        root: root.display().to_string(),
        entries: entries
            .iter()
            .map(|i| WbManifestEntry { name: i.qname.clone(), original_path: i.path.clone() })
            .collect(),
    };
    let body = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("manifest 序列化失败: {e}"))?;
    std::fs::write(quarantine.join(QUARANTINE_MANIFEST), body)
        .map_err(|e| format!("manifest 写入失败: {e}"))?;
    Ok(quarantine)
}

/// 执行动作清单。quarantine=Some 时 quarantine 类动作 rename 进隔离区，否则报错兜底。
/// 返回 (层报告, 实际执行数)。
fn execute_items(
    items: Vec<WbActionItem>,
    layer: u8,
    name: &'static str,
    acted_noun: &str,
    quarantine: Option<&std::path::Path>,
    progress: Option<WbProgressCb>,
) -> (WbLayerReport, usize) {
    let total = items.len();
    let mut acted = 0usize;
    let mut errors: Vec<String> = Vec::new();
    for (idx, item) in items.iter().enumerate() {
        let r = match (item.action, quarantine) {
            ("delete_file", _) => std::fs::remove_file(&item.full),
            ("delete_dir", _) => std::fs::remove_dir_all(&item.full),
            ("quarantine", Some(q)) => std::fs::rename(&item.full, q.join(&item.qname)),
            ("quarantine", None) => Err(std::io::Error::other("隔离区未就位")),
            _ => Err(std::io::Error::other("未知动作类型")),
        };
        match r {
            Ok(_) => acted += 1,
            Err(e) => errors.push(format!("{}: {e}", item.path)),
        }
        if let Some(cb) = progress {
            cb(WbProgressEvent { layer, done: idx + 1, total, item: item.path.clone() });
        }
    }
    (layer_from(name, layer, &errors, acted, acted_noun), acted)
}

/// 历史台账：每次操作后在 reset-history/ 落一份 JSON（顶层 user_asset 档，维护清理不动）。
fn write_history(root: &std::path::Path, mode: &str, report: &WbResetReport) {
    let dir = root.join(HISTORY_DIR);
    if std::fs::create_dir_all(&dir).is_err() {
        return; // 台账失败不阻断主流程,但主报告不受影响
    }
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let summary = report
        .layers
        .iter()
        .map(|l| format!("L{} {} {}", l.layer, l.name, if l.ok { "ok" } else { "FAIL" }))
        .collect::<Vec<_>>()
        .join("; ");
    let doc = serde_json::json!({
        "ts_unix": ts,
        "mode": mode,
        "ok": report.layers.iter().all(|l| l.ok),
        "summary": summary,
    });
    let _ = std::fs::write(dir.join(format!("{ts}-{mode}.json")), doc.to_string());
    let _ = prune_history(&dir, HISTORY_KEEP);
}

// ================== 层① 维护清理 ==================

/// 维护清理：只删可再生缓存与日志。登录态(app/session 本体)、记忆、技能、工作区一律不碰。
fn layer_maintenance(root: &std::path::Path, progress: Option<WbProgressCb>) -> WbLayerReport {
    let items = build_maintenance_items(root);
    let (rep, _) = execute_items(items, 1, "maintenance_clean", "清理", None, progress);
    rep
}

// ================== 层② 登出重置（隔离区搬移,可逆） ==================

/// 登出重置：app/session 搬入隔离区（下次启动回登录页），可选连带 device-id。
/// 不再真删——与出厂同款可逆设计，恢复命令可原样搬回。
fn layer_logout(
    root: &std::path::Path,
    include_device_id: bool,
    progress: Option<WbProgressCb>,
) -> WbLayerReport {
    let items = build_logout_items(root, include_device_id);
    if items.is_empty() {
        return WbLayerReport {
            layer: 2,
            name: "logout_reset",
            ok: true,
            detail: "无待处理条目(本就不存在或已清空)".into(),
        };
    }
    let quarantine = match create_quarantine(root, "logout", &items) {
        Ok(q) => q,
        Err(e) => {
            return WbLayerReport { layer: 2, name: "logout_reset", ok: false, detail: e };
        }
    };
    let (mut rep, acted) = execute_items(
        items,
        2,
        "logout_reset",
        "搬移",
        Some(&quarantine),
        progress,
    );
    if rep.ok {
        rep.detail = format!(
            "{}; 隔离区={} (恢复命令可原样搬回)",
            rep.detail,
            quarantine.display()
        );
        if include_device_id {
            rep.detail = format!(
                "{}; device-id 已隔离(WorkBuddy 下次启动自行重新注册设备身份;服务端限制不受影响)",
                rep.detail
            );
        }
        let _ = acted;
    }
    rep
}

// ================== 层③ 出厂重置（隔离区搬移,可逆） ==================

/// 出厂重置：把根目录**全部顶层条目**搬移到同卷隔离目录（rename，秒级、零丢失、可逆）。
/// 应用下次启动按首次安装重建。manifest 记录全部条目与原始根——恢复命令一键搬回。
fn layer_factory(root: &std::path::Path, progress: Option<WbProgressCb>) -> WbLayerReport {
    let items = build_factory_items(root);
    let quarantine = match create_quarantine(root, "factory", &items) {
        Ok(q) => q,
        Err(e) => {
            return WbLayerReport { layer: 3, name: "factory_reset", ok: false, detail: e };
        }
    };
    let (mut rep, _) = execute_items(items, 3, "factory_reset", "搬移", Some(&quarantine), progress);
    if rep.ok {
        rep.detail = format!(
            "{}; 隔离区={} (恢复命令可原样搬回)",
            rep.detail,
            quarantine.display()
        );
    }
    rep
}

// ================== 编排层（root 显式传参,单测直入） ==================

fn kill_or_skip(kill_running: bool) -> WbLayerReport {
    match maybe_kill(kill_running) {
        Some(l) => l,
        None => WbLayerReport {
            layer: 0,
            name: "kill_workbuddy_processes",
            ok: true,
            detail: "skipped(kill_running=false)".into(),
        },
    }
}

pub fn workbuddy_maintenance_reset(
    root: &std::path::Path,
    kill_running: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_root(root).expect("sanity");
    let mut layers: Vec<WbLayerReport> = Vec::new();
    layers.push(kill_or_skip(kill_running));
    layers.push(layer_maintenance(root, progress));
    let rep = WbResetReport { layers };
    write_history(root, "maintenance", &rep);
    rep
}

pub fn workbuddy_logout_reset(
    root: &std::path::Path,
    kill_running: bool,
    include_device_id: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_root(root).expect("sanity");
    let mut layers: Vec<WbLayerReport> = Vec::new();
    layers.push(kill_or_skip(kill_running));
    layers.push(layer_logout(root, include_device_id, progress));
    let rep = WbResetReport { layers };
    write_history(root, "logout", &rep);
    rep
}

pub fn workbuddy_factory_reset(
    root: &std::path::Path,
    kill_running: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_root(root).expect("sanity");
    let mut layers: Vec<WbLayerReport> = Vec::new();
    layers.push(kill_or_skip(kill_running));
    layers.push(layer_factory(root, progress));
    let rep = WbResetReport { layers };
    write_history(root, "factory", &rep);
    rep
}

// ================== 计划预览 / 隔离区生命周期 / 历史台账 ==================

/// 计划预览：与执行层共用 build_*_items 判据，返回"会动什么"的精确清单（含体量）。
pub fn workbuddy_plan(root: &std::path::Path, mode: &str, include_device_id: bool) -> WbPlanReport {
    let items = match mode {
        "logout" => build_logout_items(root, include_device_id),
        "factory" => build_factory_items(root),
        _ => build_maintenance_items(root),
    };
    let mut actions = Vec::new();
    let mut total = 0u64;
    for i in &items {
        let size = if i.action == "delete_file" {
            std::fs::metadata(&i.full).map(|m| m.len()).unwrap_or(0)
        } else {
            dir_size_recursive(&i.full)
        };
        total += size;
        actions.push(WbPlanAction {
            path: i.path.clone(),
            action: i.action,
            size_mb: size as f64 / 1048576.0,
        });
    }
    actions.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    WbPlanReport {
        mode: mode.to_string(),
        include_device_id,
        total_mb: total as f64 / 1048576.0,
        actions,
    }
}

/// 隔离区目录名护栏（纯函数）：必须 `<前缀><纯数字时间戳>`。
pub fn is_quarantine_dir_name(name: &str) -> bool {
    let Some(suffix) = name.strip_prefix(QUARANTINE_PREFIX) else {
        return false;
    };
    !suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_digit())
}

/// 列出同卷全部隔离区（从根目录父目录扫描；工厂重置后根目录为空壳,不依赖根内容）。
pub fn quarantine_list_impl(root: &std::path::Path) -> Result<Vec<WbQuarantineInfo>, String> {
    let parent = root
        .parent()
        .filter(|p| p.is_dir())
        .ok_or_else(|| format!("根目录父目录不存在,无法扫描隔离区: {}", root.display()))?;
    let mut out = Vec::new();
    let rd = std::fs::read_dir(parent).map_err(|e| format!("父目录枚举失败: {e}"))?;
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if !is_quarantine_dir_name(&name) || !e.path().is_dir() {
            continue;
        }
        let created_unix = name[QUARANTINE_PREFIX.len()..].parse().unwrap_or(0);
        let mut size = 0u64;
        let mut entries = 0usize;
        let (mut mode, mut original_root) = ("unknown".to_string(), String::new());
        if let Ok(qrd) = std::fs::read_dir(e.path()) {
            for qe in qrd.flatten() {
                if qe.file_name().to_string_lossy() == QUARANTINE_MANIFEST {
                    continue;
                }
                entries += 1;
                size += dir_size_recursive(&qe.path());
            }
        }
        if let Ok(body) = std::fs::read_to_string(e.path().join(QUARANTINE_MANIFEST)) {
            if let Ok(m) = serde_json::from_str::<WbQuarantineManifest>(&body) {
                mode = m.mode;
                original_root = m.root;
            }
        }
        out.push(WbQuarantineInfo {
            original_root,
            name,
            path: e.path().display().to_string(),
            created_unix,
            mode,
            entries,
            size_mb: size as f64 / 1048576.0,
        });
    }
    out.sort_by(|a, b| b.created_unix.cmp(&a.created_unix));
    Ok(out)
}

/// 从隔离区恢复：按 manifest 逐条目 rename 回原位。护栏：目录名前缀 + manifest 可解析
/// + 目标已存在则拒绝覆盖（绝不静默覆盖用户现有数据）。全空后删除隔离区壳。
pub fn quarantine_restore_impl(
    quarantine: &std::path::Path,
) -> WbResetReport {
    let name = quarantine
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let fail = |detail: String| WbResetReport {
        layers: vec![WbLayerReport { layer: 4, name: "quarantine_restore", ok: false, detail }],
    };
    if !is_quarantine_dir_name(&name) {
        return fail(format!("护栏拒绝：{name} 不是隔离区目录名({QUARANTINE_PREFIX}<时间戳>)"));
    }
    if !quarantine.is_dir() {
        return fail(format!("隔离区不存在: {}", quarantine.display()));
    }
    let body = match std::fs::read_to_string(quarantine.join(QUARANTINE_MANIFEST)) {
        Ok(b) => b,
        Err(e) => return fail(format!("manifest 读取失败: {e}")),
    };
    let manifest: WbQuarantineManifest = match serde_json::from_str(&body) {
        Ok(m) => m,
        Err(e) => return fail(format!("manifest 解析失败: {e}")),
    };
    let root = std::path::PathBuf::from(&manifest.root);
    if root.parent().is_none() {
        return fail(format!("manifest 记录的根目录非法: {}", manifest.root));
    }
    let mut acted = 0usize;
    let mut errors: Vec<String> = Vec::new();
    for entry in &manifest.entries {
        let target = root.join(&entry.original_path);
        if target.exists() {
            errors.push(format!("{}: 目标已存在,拒绝覆盖", entry.original_path));
        } else {
            let src = quarantine.join(&entry.name);
            if let Some(parent) = target.parent() {
                if let Err(e) = std::fs::create_dir_all(parent) {
                    errors.push(format!("{}: 父目录创建失败({e})", entry.original_path));
                } else if let Err(e) = std::fs::rename(&src, &target) {
                    errors.push(format!("{}: {e}", entry.original_path));
                } else {
                    acted += 1;
                }
            }
        }
    }
    // 搬空（只剩 manifest）后清掉隔离区壳
    let mut leftover = false;
    if let Ok(rd) = std::fs::read_dir(quarantine) {
        leftover = rd.flatten().any(|e| e.file_name().to_string_lossy() != QUARANTINE_MANIFEST);
    }
    if !leftover {
        let _ = std::fs::remove_dir_all(quarantine);
    }
    WbResetReport {
        layers: vec![layer_from("quarantine_restore", 4, &errors, acted, "恢复")],
    }
}

/// 删除隔离区（数据已确认不要时的人工清理出口）。护栏：目录名格式 + 父目录匹配。
pub fn quarantine_delete_impl(
    quarantine: &std::path::Path,
    expected_parent: &std::path::Path,
) -> WbResetReport {
    let name = quarantine
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let fail = |detail: String| WbResetReport {
        layers: vec![WbLayerReport { layer: 5, name: "quarantine_delete", ok: false, detail }],
    };
    if !is_quarantine_dir_name(&name) {
        return fail(format!("护栏拒绝：{name} 不是隔离区目录名({QUARANTINE_PREFIX}<时间戳>)"));
    }
    if quarantine.parent() != Some(expected_parent) {
        return fail(format!(
            "护栏拒绝：隔离区不在预期父目录 {} 下",
            expected_parent.display()
        ));
    }
    match std::fs::remove_dir_all(quarantine) {
        Ok(_) => WbResetReport {
            layers: vec![WbLayerReport {
                layer: 5,
                name: "quarantine_delete",
                ok: true,
                detail: format!("已删除隔离区 {}", quarantine.display()),
            }],
        },
        Err(e) => fail(format!("删除失败: {e}")),
    }
}

/// 读取历史台账（reset-history/*.json，按时间倒序）。
pub fn workbuddy_read_history(root: &std::path::Path) -> Vec<WbHistoryItem> {
    let mut out = Vec::new();
    let Ok(rd) = std::fs::read_dir(root.join(HISTORY_DIR)) else {
        return out;
    };
    for e in rd.flatten() {
        let fname = e.file_name().to_string_lossy().to_string();
        if !fname.ends_with(".json") {
            continue;
        }
        let Ok(body) = std::fs::read_to_string(e.path()) else { continue };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&body) else { continue };
        out.push(WbHistoryItem {
            ts_unix: v.get("ts_unix").and_then(|x| x.as_u64()).unwrap_or(0),
            mode: v.get("mode").and_then(|x| x.as_str()).unwrap_or("unknown").to_string(),
            ok: v.get("ok").and_then(|x| x.as_bool()).unwrap_or(false),
            summary: v.get("summary").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            file: fname,
        });
    }
    out.sort_by(|a, b| b.ts_unix.cmp(&a.ts_unix));
    out
}

// ================== 探针（重 I/O,命令层包 spawn_blocking） ==================

pub fn workbuddy_probe(root: &std::path::Path) -> WbProbeReport {
    let mut entries: Vec<WbEntry> = Vec::new();
    let mut total = 0u64;
    let mut reclaimable = 0u64;
    if root.is_dir() {
        if let Ok(rd) = std::fs::read_dir(root) {
            for e in rd.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                let size = dir_size_recursive(&e.path());
                total += size;
                if name == "app" {
                    // app/ 特殊：逐子条目分档
                    if let Ok(app_rd) = std::fs::read_dir(&e.path()) {
                        for a in app_rd.flatten() {
                            let aname = a.file_name().to_string_lossy().to_string();
                            let asize = if a.path().is_dir() {
                                dir_size_recursive(&a.path())
                            } else {
                                std::fs::metadata(&a.path()).map(|m| m.len()).unwrap_or(0)
                            };
                            let tier = classify_app_child(&aname);
                            if tier == "maintenance" || tier == "webview_logout" {
                                reclaimable += asize;
                            }
                            entries.push(WbEntry {
                                path: format!("app/{aname}"),
                                tier,
                                size_mb: asize as f64 / 1048576.0,
                            });
                        }
                    }
                    continue;
                }
                if name == WEBVIEW_SESSION_DIR {
                    continue; // 顶层不会有,防御
                }
                let tier = classify_top_level(&name);
                if tier == "maintenance" {
                    reclaimable += size;
                }
                entries.push(WbEntry {
                    path: name,
                    tier,
                    size_mb: size as f64 / 1048576.0,
                });
            }
        }
    }
    // session 的 webview 缓存子目录体量并入可回收估算（简化:按 webview_logout 档整体计）
    entries.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    WbProbeReport {
        root: root.display().to_string(),
        workbuddy_running: probe_workbuddy_running(),
        total_mb: total as f64 / 1048576.0,
        reclaimable_mb: reclaimable as f64 / 1048576.0,
        entries,
    }
}

/// 目标进程是否在运行（进程快照只读枚举）。
pub fn probe_workbuddy_running() -> bool {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        };
        unsafe {
            let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
                return false;
            };
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            let mut found = false;
            if Process32FirstW(snap, &mut entry).is_ok() {
                loop {
                    let image = String::from_utf16_lossy(
                        &entry.szExeFile
                            [..entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(0)],
                    );
                    if is_workbuddy_process_image(&image) {
                        found = true;
                        break;
                    }
                    if Process32NextW(snap, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snap);
            found
        }
    }
    #[cfg(not(windows))]
    {
        false
    }
}

// ================== tauri 薄胶水（只转发,不含判定） ==================

use tauri::ipc::Channel;

#[tauri::command(async)]
pub async fn workbuddy_reset_probe() -> Result<WbProbeReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::not_found(e))?;
    tauri::async_runtime::spawn_blocking(move || workbuddy_probe(&root))
        .await
        .map_err(|e| IpcError::internal(format!("探针任务异常退出: {e}")))
}

/// 计划预览：执行前把"会动什么/多大"逐条列给用户（与执行层共用判据）。
#[tauri::command(async)]
pub async fn workbuddy_reset_plan(
    mode: String,
    include_device_id: bool,
) -> Result<WbPlanReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::permission(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        workbuddy_plan(&root, &mode, include_device_id)
    })
    .await
    .map_err(|e| IpcError::internal(format!("计划预览任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn workbuddy_reset_maintenance(
    kill_running: bool,
    on_progress: Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::permission(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        let cb = move |ev: WbProgressEvent| {
            let _ = on_progress.send(ev);
        };
        workbuddy_maintenance_reset(&root, kill_running, Some(&cb))
    })
    .await
    .map_err(|e| IpcError::internal(format!("维护清理任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn workbuddy_reset_logout(
    kill_running: bool,
    include_device_id: bool,
    on_progress: Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::permission(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        let cb = move |ev: WbProgressEvent| {
            let _ = on_progress.send(ev);
        };
        workbuddy_logout_reset(&root, kill_running, include_device_id, Some(&cb))
    })
    .await
    .map_err(|e| IpcError::internal(format!("登出重置任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn workbuddy_reset_factory(
    kill_running: bool,
    on_progress: Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::permission(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        let cb = move |ev: WbProgressEvent| {
            let _ = on_progress.send(ev);
        };
        workbuddy_factory_reset(&root, kill_running, Some(&cb))
    })
    .await
    .map_err(|e| IpcError::internal(format!("出厂重置任务异常退出: {e}")))
}

/// 隔离区列表（工厂重置后根目录为空壳也能列——扫描父目录,不依赖根内容）。
#[tauri::command(async)]
pub async fn workbuddy_quarantine_list() -> Result<Vec<WbQuarantineInfo>, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    tauri::async_runtime::spawn_blocking(move || quarantine_list_impl(&root))
        .await
        .map_err(|e| IpcError::internal(format!("隔离区扫描任务异常退出: {e}")))?
        .map_err(|e| IpcError::internal(e))
}

/// 从隔离区一键恢复（按 manifest 原样搬回;目标已存在拒绝覆盖）。
#[tauri::command(async)]
pub async fn workbuddy_quarantine_restore(
    quarantine_path: String,
) -> Result<WbResetReport, IpcError> {
    tauri::async_runtime::spawn_blocking(move || {
        quarantine_restore_impl(&std::path::PathBuf::from(&quarantine_path))
    })
    .await
    .map_err(|e| IpcError::internal(format!("恢复任务异常退出: {e}")))
}

/// 删除隔离区（二次确认后的人工清理出口;护栏：目录名格式 + 父目录必须匹配用户根）。
#[tauri::command(async)]
pub async fn workbuddy_quarantine_delete(
    quarantine_path: String,
) -> Result<WbResetReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    let parent = root
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| IpcError::internal("根目录无父目录"))?;
    tauri::async_runtime::spawn_blocking(move || {
        quarantine_delete_impl(&std::path::PathBuf::from(&quarantine_path), &parent)
    })
    .await
    .map_err(|e| IpcError::internal(format!("删除任务异常退出: {e}")))
}

/// 历史台账（每次重置操作留档,按时间倒序）。
#[tauri::command(async)]
pub async fn workbuddy_reset_history() -> Result<Vec<WbHistoryItem>, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    tauri::async_runtime::spawn_blocking(move || workbuddy_read_history(&root))
        .await
        .map_err(|e| IpcError::internal(format!("历史读取任务异常退出: {e}")))
}

// ================== 测试（临时夹具,绝不触碰真实 ~/.workbuddy） ==================

#[cfg(test)]
mod tests {
    use super::*;

    /// 独立容器夹具：temp/wb-reset-test-<tag>-<nanos>/root —— root.parent() 全局唯一,
    /// 隔离区写进父目录,多测试并行互不串扰(cargo test 默认多线程)。
    fn fixture_root(tag: &str) -> std::path::PathBuf {
        let container = std::env::temp_dir().join(format!(
            "wb-reset-test-{tag}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let base = container.join("root");
        std::fs::create_dir_all(base.join("logs/20261010")).unwrap();
        std::fs::write(base.join("logs/20261010/main.log"), "log").unwrap();
        std::fs::create_dir_all(base.join("app/session/Local Storage")).unwrap();
        std::fs::write(base.join("app/session/Local Storage/manifest"), "ls").unwrap();
        std::fs::create_dir_all(base.join("app/CodeCache/js")).unwrap();
        std::fs::write(base.join("app/CodeCache/js/x"), "c").unwrap();
        std::fs::create_dir_all(base.join("app/data")).unwrap();
        std::fs::write(base.join("app/data/expert-history.json"), "{}").unwrap();
        std::fs::write(base.join("device-id"), "0123456789abcdef0123456789abcdef0123").unwrap();
        std::fs::write(base.join("MEMORY.md"), "# memory").unwrap();
        std::fs::create_dir_all(base.join("workspace/proj")).unwrap();
        std::fs::write(base.join("workspace/proj/f.txt"), "w").unwrap();
        base
    }

    /// 清理整个容器（隔离区与 root 一并清,测试零残留）。
    fn cleanup(fx: &std::path::Path) {
        if let Some(c) = fx.parent() {
            let _ = std::fs::remove_dir_all(c);
        }
    }

    /// 在夹具父目录里找本测试创建的隔离区。
    fn find_quarantine(fx: &std::path::Path) -> std::path::PathBuf {
        let parent = fx.parent().unwrap();
        for e in std::fs::read_dir(parent).unwrap().flatten() {
            if is_quarantine_dir_name(&e.file_name().to_string_lossy()) {
                return e.path();
            }
        }
        panic!("未找到隔离区于 {}", parent.display());
    }

    #[test]
    fn classify_slots_are_stable() {
        assert_eq!(classify_top_level("logs"), "maintenance");
        assert_eq!(classify_top_level("traces"), "maintenance");
        assert_eq!(classify_top_level("device-id"), "device_identity");
        assert_eq!(classify_top_level("workspace"), "user_asset");
        assert_eq!(classify_app_child("session"), "webview_logout");
        assert_eq!(classify_app_child("CodeCache"), "maintenance");
        assert_eq!(classify_app_child("data"), "user_asset");
        assert_eq!(classify_session_child("Cache"), "maintenance");
        assert_eq!(classify_session_child("Local Storage"), "user_asset");
        // 隔离区目录名判据
        assert!(is_quarantine_dir_name(".workbuddy-quarantine-1728537600"));
        assert!(!is_quarantine_dir_name(".workbuddy-quarantine-"));
        assert!(!is_quarantine_dir_name(".workbuddy-quarantine-12a"));
        assert!(!is_quarantine_dir_name("workbuddy-quarantine-123"));
        assert!(!is_quarantine_dir_name(".workbuddy-quarantine-1-2"));
    }

    #[test]
    fn sanity_guard_rejects_foreign_dir() {
        let foreign = std::env::temp_dir().join("wb-reset-guard-empty");
        std::fs::create_dir_all(&foreign).unwrap();
        assert!(sanity_check_root(&foreign).is_err(), "无特征标记必须拒");
        let fx = fixture_root("guard");
        assert!(sanity_check_root(&fx).is_ok(), "夹具必须过");
        cleanup(&fx);
    }

    #[test]
    fn maintenance_keeps_session_and_assets_clears_caches() {
        let fx = fixture_root("maint");
        let rep = workbuddy_maintenance_reset(&fx, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        // 缓存与日志被清
        assert!(fx.join("logs").is_dir() && std::fs::read_dir(fx.join("logs")).unwrap().next().is_none());
        assert!(!fx.join("app/CodeCache").exists());
        // 登录态、记忆、工作区、设备身份原封不动
        assert!(fx.join("app/session/Local Storage/manifest").exists(), "登录态不得被动");
        assert!(fx.join("MEMORY.md").exists());
        assert!(fx.join("workspace/proj/f.txt").exists());
        assert!(fx.join("device-id").exists());
        // 历史台账落档
        let h = workbuddy_read_history(&fx);
        assert_eq!(h.len(), 1, "维护清理必须留一档历史");
        assert_eq!(h[0].mode, "maintenance");
        assert!(h[0].ok);
        cleanup(&fx);
    }

    #[test]
    fn history_prune_keeps_newest_only() {
        let fx = fixture_root("prune");
        let dir = fx.join(HISTORY_DIR);
        std::fs::create_dir_all(&dir).unwrap();
        for i in 0..55u64 {
            std::fs::write(dir.join(format!("{i:010}-maintenance.json")), "{}").unwrap();
        }
        assert_eq!(prune_history(&dir, HISTORY_KEEP), 5, "55 份必须裁掉最旧 5 份");
        let left = std::fs::read_dir(&dir).unwrap().count();
        assert_eq!(left, HISTORY_KEEP);
        assert!(!dir.join("0000000000-maintenance.json").exists(), "最旧必须被删");
        assert!(dir.join("0000000005-maintenance.json").exists(), "留下的必须是最新的");
        assert_eq!(prune_history(&dir, HISTORY_KEEP), 0, "幂等:不超上限必须 0 删除");
        cleanup(&fx);
    }

    #[test]
    fn maintenance_progress_events_monotonic() {
        let fx = fixture_root("progress");
        use std::sync::{Arc, Mutex};
        let events: Arc<Mutex<Vec<WbProgressEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let sink = events.clone();
        let cb = move |ev: WbProgressEvent| {
            sink.lock().unwrap().push(ev);
        };
        let rep = workbuddy_maintenance_reset(&fx, false, Some(&cb));
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        let got = events.lock().unwrap();
        assert!(!got.is_empty(), "必须逐条目发进度");
        assert_eq!(got[0].layer, 1);
        let total = got[0].total;
        assert!(total >= 2, "夹具至少有 logs 子条目与 app/CodeCache,实际 {total}");
        for w in got.windows(2) {
            assert_eq!(w[1].done, w[0].done + 1, "done 必须单调 +1");
            assert_eq!(w[1].total, total);
        }
        assert_eq!(got.last().unwrap().done, total, "收尾必须到 total");
        assert!(!got[0].item.is_empty());
        cleanup(&fx);
    }

    #[test]
    fn logout_quarantines_session_and_restores_exactly() {
        let fx = fixture_root("logout");
        let rep = workbuddy_logout_reset(&fx, false, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        // session 已不在原位;device-id/记忆/维护档不属登出层
        assert!(!fx.join("app/session").exists(), "session 必须已搬离");
        assert!(fx.join("device-id").exists(), "未勾选时 device-id 必须保留");
        assert!(fx.join("MEMORY.md").exists());
        assert!(fx.join("logs/20261010/main.log").exists(), "维护档不属于登出层");
        // 隔离区持有 session,manifest 记录 mode=logout + 原路径 app/session
        let q = find_quarantine(&fx);
        let body = std::fs::read_to_string(q.join(QUARANTINE_MANIFEST)).unwrap();
        let m: WbQuarantineManifest = serde_json::from_str(&body).unwrap();
        assert_eq!(m.mode, "logout");
        assert_eq!(m.root, fx.display().to_string());
        assert!(m.entries.iter().any(|e| e.original_path == "app/session" && e.name == "session"));
        assert!(q.join("session/Local Storage/manifest").exists(), "登录态内容必须完好在隔离区");
        // 一键恢复:原样搬回 + 隔离区壳清掉
        let rrep = quarantine_restore_impl(&q);
        assert!(rrep.layers.iter().all(|l| l.ok), "{:?}", rrep.layers);
        assert!(fx.join("app/session/Local Storage/manifest").exists(), "恢复后登录态必须原位");
        assert!(!q.exists(), "搬空后隔离区壳必须清除");
        cleanup(&fx);
    }

    #[test]
    fn logout_with_device_id_restores_both() {
        let fx = fixture_root("logout-dev");
        let rep = workbuddy_logout_reset(&fx, false, true, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!fx.join("device-id").exists(), "勾选后 device-id 必须隔离");
        assert!(rep.layers.last().unwrap().detail.contains("device-id"), "detail 必须披露设备身份处置");
        let q = find_quarantine(&fx);
        let rrep = quarantine_restore_impl(&q);
        assert!(rrep.layers.iter().all(|l| l.ok), "{:?}", rrep.layers);
        assert!(fx.join("device-id").exists());
        assert_eq!(
            std::fs::read_to_string(fx.join("device-id")).unwrap(),
            "0123456789abcdef0123456789abcdef0123",
            "device-id 内容必须逐字节恢复"
        );
        assert!(fx.join("app/session/Local Storage/manifest").exists());
        cleanup(&fx);
    }

    #[test]
    fn restore_rejects_existing_target_without_overwrite() {
        let fx = fixture_root("restore-conflict");
        let _ = workbuddy_logout_reset(&fx, false, false, None);
        let q = find_quarantine(&fx);
        // 预先占位目标（模拟应用已重建 session）
        std::fs::create_dir_all(fx.join("app/session")).unwrap();
        std::fs::write(fx.join("app/session/sentinel"), "keep").unwrap();
        let rrep = quarantine_restore_impl(&q);
        assert!(!rrep.layers[0].ok, "目标已存在必须拒绝");
        assert!(rrep.layers[0].detail.contains("拒绝覆盖"));
        assert_eq!(
            std::fs::read_to_string(fx.join("app/session/sentinel")).unwrap(),
            "keep",
            "现有数据绝不能被覆盖"
        );
        cleanup(&fx);
    }

    #[test]
    fn factory_moves_everything_to_quarantine_and_restores() {
        let fx = fixture_root("factory");
        let top_count = std::fs::read_dir(&fx).unwrap().count();
        let rep = workbuddy_factory_reset(&fx, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        // 根目录被搬空(壳保留);唯一遗留 = 操作后新写的 reset-history 台账(设计行为)
        assert!(fx.is_dir(), "根目录壳必须保留");
        let leftover: Vec<String> = std::fs::read_dir(&fx)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(leftover, vec![HISTORY_DIR.to_string()], "出厂后根目录只应留历史台账");
        // manifest 校验:mode=factory + 原根 + 条目数=顶层条目数
        let q = find_quarantine(&fx);
        let body = std::fs::read_to_string(q.join(QUARANTINE_MANIFEST)).unwrap();
        let m: WbQuarantineManifest = serde_json::from_str(&body).unwrap();
        assert_eq!(m.mode, "factory");
        assert_eq!(m.root, fx.display().to_string());
        assert_eq!(m.entries.len(), top_count, "manifest 条目必须覆盖全部顶层条目");
        assert!(q.join("device-id").exists(), "device-id 必须在隔离区");
        assert!(q.join("MEMORY.md").exists(), "记忆必须在隔离区");
        assert!(q.join("app/session/Local Storage/manifest").exists(), "登录态必须在隔离区");
        assert_eq!(std::fs::read_to_string(q.join("MEMORY.md")).unwrap(), "# memory");
        // 历史台账:出厂落档(根目录壳上)
        let h = workbuddy_read_history(&fx);
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].mode, "factory");
        // 一键恢复:全部条目原样搬回 + 隔离区壳清掉
        let rrep = quarantine_restore_impl(&q);
        assert!(rrep.layers.iter().all(|l| l.ok), "{:?}", rrep.layers);
        assert!(fx.join("MEMORY.md").exists() && fx.join("device-id").exists());
        assert!(fx.join("app/session/Local Storage/manifest").exists());
        assert_eq!(std::fs::read_to_string(fx.join("MEMORY.md")).unwrap(), "# memory");
        assert!(!q.exists(), "搬空后隔离区壳必须清除");
        cleanup(&fx);
    }

    #[test]
    fn quarantine_list_reports_mode_entries_size() {
        let fx = fixture_root("qlist");
        let _ = workbuddy_logout_reset(&fx, false, false, None);
        let list = quarantine_list_impl(&fx).unwrap();
        assert_eq!(list.len(), 1, "必须恰好列出本夹具的隔离区");
        let info = &list[0];
        assert_eq!(info.mode, "logout");
        assert_eq!(info.entries, 1, "数据条目= session(manifest 不计)");
        assert!(info.created_unix > 0);
        assert_eq!(info.original_root, fx.display().to_string());
        assert!(info.size_mb > 0.0);
        assert!(info.name.starts_with(QUARANTINE_PREFIX));
        cleanup(&fx);
    }

    #[test]
    fn quarantine_delete_has_hard_guards() {
        let fx = fixture_root("qdel");
        // 名字护栏:非隔离区名拒绝
        let bogus = fx.parent().unwrap().join("not-quarantine");
        std::fs::create_dir_all(&bogus).unwrap();
        std::fs::write(bogus.join("x"), "y").unwrap();
        let rep = quarantine_delete_impl(&bogus, fx.parent().unwrap());
        assert!(!rep.layers[0].ok, "非隔离区名必须拒");
        assert!(bogus.exists(), "被拒目标必须原样保留");
        let _ = std::fs::remove_dir_all(&bogus);
        // 父目录护栏:正名+错父拒绝
        let _ = workbuddy_logout_reset(&fx, false, false, None);
        let q = find_quarantine(&fx);
        let other_parent = std::env::temp_dir().join(format!(
            "wb-reset-other-parent-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&other_parent).unwrap();
        let rep2 = quarantine_delete_impl(&q, &other_parent);
        assert!(!rep2.layers[0].ok, "父目录不匹配必须拒");
        assert!(q.exists());
        // 正名+对父 → 删除
        let rep3 = quarantine_delete_impl(&q, fx.parent().unwrap());
        assert!(rep3.layers[0].ok);
        assert!(!q.exists());
        cleanup(&fx);
        let _ = std::fs::remove_dir_all(&other_parent);
    }

    #[test]
    fn plan_reports_actions_without_executing() {
        let fx = fixture_root("plan");
        // 维护计划:列 CodeCache 整删 + logs 子条目;执行前后根目录不变
        let p = workbuddy_plan(&fx, "maintenance", false);
        assert!(p.actions.iter().any(|a| a.path == "app/CodeCache" && a.action == "delete_dir"));
        assert!(p.actions.iter().any(|a| a.path == "logs/20261010" && a.action == "delete_dir"));
        assert!(p.total_mb > 0.0);
        assert!(fx.join("app/CodeCache/js/x").exists(), "计划绝不能执行");
        // 登出计划:session 走 quarantine;勾选 device-id 后多一条
        let pl = workbuddy_plan(&fx, "logout", false);
        assert!(pl.actions.iter().any(|a| a.path == "app/session" && a.action == "quarantine"));
        assert!(!pl.actions.iter().any(|a| a.path == "device-id"));
        let pld = workbuddy_plan(&fx, "logout", true);
        assert!(pld.actions.iter().any(|a| a.path == "device-id" && a.action == "quarantine"));
        // 出厂计划:条目数=顶层条目数,全走 quarantine
        let pf = workbuddy_plan(&fx, "factory", false);
        assert_eq!(pf.actions.len(), std::fs::read_dir(&fx).unwrap().count());
        assert!(pf.actions.iter().all(|a| a.action == "quarantine"));
        cleanup(&fx);
    }

    #[test]
    fn process_image_matcher_scoped_to_workbuddy() {
        assert!(is_workbuddy_process_image("WorkBuddy.exe"));
        assert!(is_workbuddy_process_image("workbuddy-helper"));
        assert!(!is_workbuddy_process_image("Trae CN.exe"));
        assert!(!is_workbuddy_process_image("ihui-desktop.exe"));
        assert!(!is_workbuddy_process_image("explorer.exe"));
    }

    #[test]
    fn probe_reports_tiers_and_reclaimable() {
        let fx = fixture_root("probe");
        let rep = workbuddy_probe(&fx);
        assert!(rep.total_mb > 0.0);
        assert!(rep.reclaimable_mb > 0.0, "维护缓存必须计入可回收");
        let has_logs = rep.entries.iter().any(|e| e.path == "logs" && e.tier == "maintenance");
        let has_session = rep
            .entries
            .iter()
            .any(|e| e.path == "app/session" && e.tier == "webview_logout");
        let has_mem = rep.entries.iter().any(|e| e.path == "MEMORY.md" && e.tier == "user_asset");
        assert!(has_logs && has_session && has_mem, "{:?}", rep.entries);
        cleanup(&fx);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
