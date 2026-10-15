// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! MiniMax 程序一键重置（2026-10-16 立，与 Qoder/WorkBuddy 重置同架构，补齐第四平台风控面）。
//!
//! 目标程序：MiniMax Code / MiniMax Agent（CN）。本地状态面（2026-10-15 捕获侧只读侦察实测）：
//! - 根① `~/.minimax/`（CLI/Code 核心）：登录态 = `auth/`（`auth/prod/<region>/<client>/auth.json`
//!   OAuth token **明文** + refresh_token + expires_at，捕获侧同源实证）；可再生日志/缓存 = logs/tmp/cache 类；
//! - 根② `%APPDATA%/MiniMax/`（Agent 壳面）：账号身份 = `minimax-agent-cn-config.json`
//!   （uid/nickname 明文；变体 `MiniMax Agent/minimax-agent-config.json` 一并纳入审计）；
//!   Electron 渲染缓存 = Cache / Code Cache / GPUCache / Crashpad 等。
//!
//! 三档能力（与 Qoder/WorkBuddy 重置一一对应）：
//! ① 维护清理：根① logs/tmp/cache 类子条目清空 + 根② 渲染缓存整删——登录态与账号身份一律不碰；
//! ② 登出重置：根① `auth/` 隔离（token 清除→下次启动回登录页）+ 可选连带根② 账号身份文件
//!    （**本地清除→由 MiniMax 自行重新注册**；不做任何指纹伪造）；
//! ③ 出厂重置：两根顶层条目分别整体搬移到各自同卷隔离目录（rename，秒级、零数据丢失、可逆）。
//!
//! 安全网（与 qoder_reset 同纪律）：层⓪强杀 MiniMax 进程（映像含 "minimax"，跳过自身）；
//! 双根 sanity 护栏（各根特征标记 + 拒绝主目录本身）；root 显式传参（测试走 temp 夹具）；
//! 逐条目报告不 panic；manifest 随隔离区落盘=恢复唯一依据；历史台账上限裁剪；
//! 逃生门 env `IHUI_MINIMAX_RESET_DISABLE` 应急拦截全部计划与执行。

use serde::{Deserialize, Serialize};

use crate::workbuddy_reset::{
    prune_history, WbEntry, WbHistoryItem, WbLayerReport, WbProgressCb, WbProgressEvent,
    WbProbeReport, WbQuarantineInfo, WbResetReport,
};
use crate::IpcError;

// ================== 判据表（纯数据，可单测） ==================

/// 根①（~/.minimax）维护档顶层目录：清空内容、保留壳。
pub const MM_MAINTENANCE_TOP_DIRS: &[&str] = &["logs", "tmp", "cache", "caches", "shell-snapshots"];
/// 根① 登录态目录（登出档隔离对象）。
pub const MM_AUTH_DIR: &str = "auth";
/// 根② 维护档整删条目（Electron 渲染缓存,可再生）。
pub const MM_MAINTENANCE_ROAMING_DIRS: &[&str] = &[
    "Cache",
    "Code Cache",
    "GPUCache",
    "DawnGraphiteCache",
    "DawnWebGPUCache",
    "DIPS",
    "DIPS-wal",
    "Crashpad",
    "logs",
];
/// 根② 账号身份文件（登出档可选隔离对象）。
pub const MM_IDENTITY_FILES: &[&str] =
    &["minimax-agent-cn-config.json", "minimax-agent-config.json"];
/// 根① sanity 特征标记。
pub const MM_SANITY_MARKERS_HOME: &[&str] = &["auth", "logs", "tmp", "cache", "caches"];
/// 根② sanity 特征标记。
pub const MM_SANITY_MARKERS_ROAMING: &[&str] = &[
    "minimax-agent-cn-config.json",
    "minimax-agent-config.json",
    "Cache",
    "Code Cache",
    "GPUCache",
    "logs",
];
/// 隔离目录命名前缀（恢复/删除护栏依据）。
pub const MM_QUARANTINE_PREFIX: &str = ".minimax-quarantine-";
/// 隔离区 manifest 文件名。
pub const MM_QUARANTINE_MANIFEST: &str = "quarantine-manifest.json";
/// 历史台账目录（落在根①顶层）。
pub const MM_HISTORY_DIR: &str = "reset-history";
/// 进程映像判据关键词（不区分大小写）。
pub const MM_PROCESS_KEYWORD: &str = "minimax";
/// 逃生门变量名:置任意非空且非 "0" 的值 → MiniMax 重置的计划与执行全部拦截。
pub const MM_RESET_DISABLE_ENV: &str = "IHUI_MINIMAX_RESET_DISABLE";

/// 逃生门判据（纯函数,reader 注入可单测）:置位 → Err(明确原因)。
pub fn mm_reset_gate_with(read: impl Fn(&str) -> Option<String>) -> Result<(), String> {
    match read(MM_RESET_DISABLE_ENV) {
        Some(v) if !v.trim().is_empty() && v.trim() != "0" => Err(format!(
            "逃生门生效:环境变量 {MM_RESET_DISABLE_ENV}={v} 已置位,MiniMax 重置的计划与执行已全部拦截;如需恢复,请移除该变量或将其设为 0"
        )),
        _ => Ok(()),
    }
}

/// 真实逃生门读取（进程环境变量）。
fn mm_reset_gate() -> Result<(), String> {
    mm_reset_gate_with(|k| std::env::var(k).ok())
}

/// 聚合层(一键全平台重置)专用 sanity 出口:目录在 + 特征标记命中 + 非主目录。
/// 编排层(minimax_*_reset)内部是 expect("sanity") panic 语义,聚合层必须先走本出口探测,
/// 不满足则跳过该平台而不是炸整个一键流程。
pub fn minimax_sanity_check(
    home: &std::path::Path,
    roaming: &std::path::Path,
) -> Result<(), String> {
    sanity_check_dir(home, MM_SANITY_MARKERS_HOME)?;
    sanity_check_dir(roaming, MM_SANITY_MARKERS_ROAMING)
}

/// 聚合层专用双根解析出口(失败=本机未安装/环境缺 APPDATA,聚合层据此跳过)。
pub fn minimax_resolve_dirs() -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    Ok((resolve_home_dir()?, resolve_roaming_dir()?))
}

/// 根①顶层条目分类（纯函数）。
pub fn classify_home_top_level(name: &str) -> &'static str {
    if name == MM_AUTH_DIR {
        return "webview_logout";
    }
    if MM_MAINTENANCE_TOP_DIRS.contains(&name) {
        return "maintenance";
    }
    "user_asset"
}

/// 根②顶层条目分类（纯函数）。
pub fn classify_roaming_top_level(name: &str) -> &'static str {
    if MM_IDENTITY_FILES.contains(&name) {
        return "device_identity";
    }
    if MM_MAINTENANCE_ROAMING_DIRS.contains(&name) {
        return "maintenance";
    }
    "user_asset"
}

/// 进程映像判据（纯函数）：映像名(不区分大小写)含 "minimax"。
pub fn is_minimax_process_image(image_name: &str) -> bool {
    image_name.to_ascii_lowercase().contains(MM_PROCESS_KEYWORD)
}

// ================== 动作清单（与执行判据同源） ==================

#[derive(Debug, Clone)]
struct MMActionItem {
    /// 展示相对路径（home/xxx 或 roaming/xxx）
    path: String,
    /// 原始相对路径（manifest 里记录）
    orig: String,
    /// 隔离区内的条目名
    qname: String,
    /// delete_file | delete_dir | quarantine
    action: &'static str,
    reason: String,
    full: std::path::PathBuf,
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

/// 根①：MINIMAX_HOME_DIR env 覆盖（测试/自定义）→ ~/.minimax。
fn resolve_home_dir() -> Result<std::path::PathBuf, String> {
    if let Ok(p) = std::env::var("MINIMAX_HOME_DIR") {
        if !p.is_empty() {
            return Ok(std::path::PathBuf::from(p));
        }
    }
    let home = resolve_home().ok_or("无法定位用户主目录(USERPROFILE/HOME 均缺)")?;
    Ok(home.join(".minimax"))
}

/// 根②：MINIMAX_ROAMING_DIR env 覆盖 → %APPDATA%/MiniMax。
fn resolve_roaming_dir() -> Result<std::path::PathBuf, String> {
    if let Ok(p) = std::env::var("MINIMAX_ROAMING_DIR") {
        if !p.is_empty() {
            return Ok(std::path::PathBuf::from(p));
        }
    }
    let appdata = if let Ok(p) = std::env::var("APPDATA") {
        if !p.is_empty() {
            std::path::PathBuf::from(p)
        } else {
            return Err("APPDATA 为空,无法定位 MiniMax Agent 数据目录".into());
        }
    } else {
        return Err("APPDATA 缺失(非 Windows?),无法定位 MiniMax Agent 数据目录".into());
    };
    Ok(appdata.join("MiniMax"))
}

/// sanity 护栏（与 qoder_reset 同判据）：目录存在 + 命中任一特征标记 + 不得是主目录本身。
fn sanity_check_dir(root: &std::path::Path, markers: &[&str]) -> Result<(), String> {
    if !root.exists() {
        return Err(format!("目录不存在: {}", root.display()));
    }
    if let Some(home) = resolve_home() {
        if root == home {
            return Err(format!(
                "sanity 拒绝:{} 是用户主目录本身(env 误注入?),拒绝动手",
                root.display()
            ));
        }
    }
    let hit = markers
        .iter()
        .any(|m| root.join(m).exists());
    if !hit {
        return Err(format!(
            "sanity 拒绝:{} 未命中任何特征标记({markers:?}),疑似非 MiniMax 数据目录,拒绝动手",
            root.display()
        ));
    }
    Ok(())
}

/// 列目录子条目 → 逐条 delete_dir 动作（清空内容、保留壳）。
fn list_children_delete_items(
    root: &std::path::Path,
    dir: &str,
    prefix: &str,
    reason: &str,
    items: &mut Vec<MMActionItem>,
) {
    let d = root.join(dir);
    if !d.is_dir() {
        return;
    }
    if let Ok(rd) = std::fs::read_dir(&d) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            let full = e.path();
            let action = if full.is_dir() { "delete_dir" } else { "delete_file" };
            items.push(MMActionItem {
                path: format!("{prefix}{dir}/{name}"),
                orig: format!("{dir}/{name}"),
                qname: format!("{dir}-{name}"),
                action,
                reason: reason.to_string(),
                full,
            });
        }
    }
}

/// 维护档动作清单：根① logs/tmp/cache 类清空 + 根② 渲染缓存整删。
fn build_maintenance_items(home: &std::path::Path, roaming: &std::path::Path) -> Vec<MMActionItem> {
    let mut items = Vec::new();
    for dir in MM_MAINTENANCE_TOP_DIRS {
        list_children_delete_items(
            home,
            dir,
            "home/",
            "维护档:logs/tmp/cache 等可再生内容,清空即回收(目录壳保留)",
            &mut items,
        );
    }
    for name in MM_MAINTENANCE_ROAMING_DIRS {
        let dir = roaming.join(name);
        if dir.exists() {
            items.push(MMActionItem {
                path: format!("roaming/{name}"),
                orig: name.to_string(),
                qname: (*name).to_string(),
                action: "delete_dir",
                reason: "Electron 渲染缓存/崩溃转储,可再生,整删即回收".to_string(),
                full: dir,
            });
        }
    }
    items
}

/// 登出档动作清单：根① auth 隔离；可选根② 账号身份文件隔离。
fn build_logout_items(
    home: &std::path::Path,
    roaming: &std::path::Path,
    include_device_id: bool,
) -> Vec<MMActionItem> {
    let mut items = Vec::new();
    let auth = home.join(MM_AUTH_DIR);
    if auth.exists() {
        items.push(MMActionItem {
            path: MM_AUTH_DIR.into(),
            orig: MM_AUTH_DIR.to_string(),
            qname: MM_AUTH_DIR.to_string(),
            action: "quarantine",
            reason: "登录凭据目录(OAuth token 明文):隔离后 MiniMax 下次启动回登录页,可从隔离区原样恢复".to_string(),
            full: auth,
        });
    }
    if include_device_id {
        for f in MM_IDENTITY_FILES {
            let p = roaming.join(f);
            if p.exists() {
                items.push(MMActionItem {
                    path: (*f).to_string(),
                    orig: (*f).to_string(),
                    qname: (*f).to_string(),
                    action: "quarantine",
                    reason: "账号身份文件(uid/nickname):本地清除后 MiniMax 下次启动自行重新注册,不做指纹伪造".to_string(),
                    full: p,
                });
            }
        }
    }
    items
}

/// 出厂档动作清单：两根全部顶层条目（隔离区内排除 reset-history 自身,防止台账被搬走后不可追溯）。
fn build_factory_items(home: &std::path::Path, roaming: &std::path::Path) -> Vec<MMActionItem> {
    let mut items = Vec::new();
    if let Ok(rd) = std::fs::read_dir(home) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name == MM_HISTORY_DIR {
                continue;
            }
            items.push(MMActionItem {
                path: format!("home/{name}"),
                orig: name.clone(),
                qname: name,
                action: "quarantine",
                reason: "出厂档:根①顶层条目整体隔离(可逆),应用下次启动重建全新状态".to_string(),
                full: e.path(),
            });
        }
    }
    if let Ok(rd) = std::fs::read_dir(roaming) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            items.push(MMActionItem {
                path: format!("roaming/{name}"),
                orig: name.clone(),
                qname: name,
                action: "quarantine",
                reason: "出厂档:根②顶层条目整体隔离(可逆),应用下次启动重建全新状态".to_string(),
                full: e.path(),
            });
        }
    }
    items
}

// ================== 隔离区（manifest=恢复唯一依据） ==================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MMManifestEntry {
    name: String,
    original_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MMQuarantineManifest {
    /// factory | logout
    mode: String,
    created_unix: u64,
    root: String,
    entries: Vec<MMManifestEntry>,
}

fn is_minimax_quarantine_dir_name(name: &str) -> bool {
    let Some(suffix) = name.strip_prefix(MM_QUARANTINE_PREFIX) else {
        return false;
    };
    !suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_digit())
}

/// 建隔离区并写 manifest。
fn create_quarantine(
    root: &std::path::Path,
    mode: &str,
    entries: &[MMActionItem],
) -> Result<std::path::PathBuf, String> {
    let parent = root
        .parent()
        .ok_or_else(|| format!("根目录无父目录,无法建隔离区: {}", root.display()))?;
    let mut ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let quarantine = loop {
        let q = parent.join(format!("{MM_QUARANTINE_PREFIX}{ts}"));
        if !q.exists() {
            break q;
        }
        ts += 1;
    };
    std::fs::create_dir_all(&quarantine)
        .map_err(|e| format!("隔离区创建失败 {}: {e}", quarantine.display()))?;
    let manifest = MMQuarantineManifest {
        mode: mode.to_string(),
        created_unix: ts,
        root: root.display().to_string(),
        entries: entries
            .iter()
            .map(|i| MMManifestEntry { name: i.qname.clone(), original_path: i.orig.clone() })
            .collect(),
    };
    let body =
        serde_json::to_string_pretty(&manifest).map_err(|e| format!("manifest 序列化失败: {e}"))?;
    std::fs::write(quarantine.join(MM_QUARANTINE_MANIFEST), body)
        .map_err(|e| format!("manifest 写入失败: {e}"))?;
    Ok(quarantine)
}

fn mm_layer_from(
    name: &'static str,
    layer: u8,
    errors: &[String],
    acted: usize,
    noun: &str,
) -> WbLayerReport {
    if errors.is_empty() {
        WbLayerReport {
            layer,
            name,
            ok: true,
            detail: if acted == 0 {
                "无待处理条目(本就不存在或已清空)".into()
            } else {
                format!("已{noun} {acted} 项")
            },
        }
    } else {
        WbLayerReport {
            layer,
            name,
            ok: false,
            detail: format!("已{noun} {acted} 项; 失败 {} 项: {}", errors.len(), errors.join("; ")),
        }
    }
}

/// 执行动作清单。quarantine 传入时 quarantine 类动作 rename 进隔离区。
fn execute_items(
    items: Vec<MMActionItem>,
    layer: u8,
    name: &'static str,
    noun: &str,
    quarantine: Option<&std::path::Path>,
    progress: Option<WbProgressCb>,
) -> WbLayerReport {
    let total = items.len();
    let mut errors: Vec<String> = Vec::new();
    for (idx, item) in items.iter().enumerate() {
        let r = match (item.action, quarantine) {
            ("delete_file", _) => std::fs::remove_file(&item.full),
            ("delete_dir", _) => std::fs::remove_dir_all(&item.full),
            ("quarantine", Some(q)) => std::fs::rename(&item.full, q.join(&item.qname)),
            ("quarantine", None) => Err(std::io::Error::other("隔离区未就位")),
            _ => Err(std::io::Error::other("未知动作类型")),
        };
        if let Err(e) = r {
            errors.push(format!("{}: {e}", item.path));
        }
        if let Some(cb) = progress {
            cb(WbProgressEvent { layer, done: idx + 1, total, item: item.path.clone() });
        }
    }
    mm_layer_from(name, layer, &errors, items.len(), noun)
}

/// 历史台账：落在根① reset-history/（pub prune_history 复用,上限 50）。
fn write_history(home: &std::path::Path, mode: &str, report: &WbResetReport) {
    let dir = home.join(MM_HISTORY_DIR);
    if std::fs::create_dir_all(&dir).is_err() {
        return;
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
    let _ = prune_history(&dir, 50);
}

// ================== 层⓪ 强杀 MiniMax 进程 ==================

fn kill_minimax_processes() -> WbLayerReport {
    #[cfg(windows)]
    {
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
            let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
                return WbLayerReport {
                    layer: 0,
                    name: "kill_minimax_processes",
                    ok: false,
                    detail: "进程快照失败".into(),
                };
            };
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            if Process32FirstW(snap, &mut entry).is_ok() {
                loop {
                    let image = String::from_utf16_lossy(
                        &entry.szExeFile
                            [..entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(0)],
                    );
                    let pid = entry.th32ProcessID;
                    if is_minimax_process_image(&image) && pid != self_pid {
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
                "无运行中的 MiniMax 进程".to_string()
            } else {
                format!("无进程被杀但有异常: {}", errors.join("; "))
            };
            WbLayerReport { layer: 0, name: "kill_minimax_processes", ok: errors.is_empty(), detail }
        } else {
            std::thread::sleep(std::time::Duration::from_millis(1500));
            WbLayerReport {
                layer: 0,
                name: "kill_minimax_processes",
                ok: errors.is_empty(),
                detail: format!("已强杀 {} 个 MiniMax 进程: {};{}", killed.len(), killed.join(", "), errors.join("; ")),
            }
        }
    }
    #[cfg(not(windows))]
    {
        WbLayerReport {
            layer: 0,
            name: "kill_minimax_processes",
            ok: true,
            detail: "skipped(非 Windows 平台未实现进程终止)".into(),
        }
    }
}

fn mm_kill_or_skip(kill_running: bool) -> WbLayerReport {
    if kill_running {
        kill_minimax_processes()
    } else {
        WbLayerReport {
            layer: 0,
            name: "kill_minimax_processes",
            ok: true,
            detail: "skipped(kill_running=false)".into(),
        }
    }
}

// ================== 三档层实现 ==================

fn layer_maintenance(
    home: &std::path::Path,
    roaming: &std::path::Path,
    progress: Option<WbProgressCb>,
) -> WbLayerReport {
    let items = build_maintenance_items(home, roaming);
    execute_items(items, 1, "maintenance_clean", "清理", None, progress)
}

fn layer_logout(
    home: &std::path::Path,
    roaming: &std::path::Path,
    include_device_id: bool,
    progress: Option<WbProgressCb>,
) -> WbLayerReport {
    let home_items: Vec<MMActionItem> = build_logout_items(home, roaming, include_device_id)
        .into_iter()
        .filter(|i| i.full.starts_with(home))
        .collect();
    let roaming_items: Vec<MMActionItem> = build_logout_items(home, roaming, include_device_id)
        .into_iter()
        .filter(|i| i.full.starts_with(roaming))
        .collect();
    let mut errors: Vec<String> = Vec::new();
    let mut acted = 0usize;
    let mut quarantine_notes: Vec<String> = Vec::new();
    for (root, items) in [(home, home_items), (roaming, roaming_items)] {
        if items.is_empty() {
            continue;
        }
        match create_quarantine(root, "logout", &items) {
            Ok(q) => {
                quarantine_notes.push(q.display().to_string());
                let rep = execute_items(items, 2, "logout_reset", "搬移", Some(&q), progress);
                acted += 1;
                if !rep.ok {
                    errors.push(rep.detail);
                }
            }
            Err(e) => errors.push(e),
        }
    }
    if errors.is_empty() {
        let mut detail = if acted == 0 {
            "无待处理条目(本就不存在或已清空)".to_string()
        } else {
            format!("已搬移 auth/账号身份; 隔离区={}", quarantine_notes.join(" + "))
        };
        if include_device_id && acted > 0 {
            detail = format!(
                "{detail}; 账号身份已隔离(MiniMax 下次启动自行重新注册;服务端限制不受影响)"
            );
        }
        WbLayerReport { layer: 2, name: "logout_reset", ok: true, detail }
    } else {
        WbLayerReport {
            layer: 2,
            name: "logout_reset",
            ok: false,
            detail: errors.join("; "),
        }
    }
}

fn layer_factory(
    home: &std::path::Path,
    roaming: &std::path::Path,
    progress: Option<WbProgressCb>,
) -> WbLayerReport {
    let all = build_factory_items(home, roaming);
    let home_items: Vec<MMActionItem> =
        all.iter().filter(|i| i.full.starts_with(home)).cloned().collect();
    let roaming_items: Vec<MMActionItem> =
        all.iter().filter(|i| i.full.starts_with(roaming)).cloned().collect();
    let mut errors: Vec<String> = Vec::new();
    let mut quarantine_notes: Vec<String> = Vec::new();
    let mut moved = 0usize;
    for (root, items) in [(home, home_items), (roaming, roaming_items)] {
        if items.is_empty() {
            continue;
        }
        match create_quarantine(root, "factory", &items) {
            Ok(q) => {
                quarantine_notes.push(q.display().to_string());
                let rep = execute_items(items, 3, "factory_reset", "搬移", Some(&q), progress);
                moved += 1;
                if !rep.ok {
                    errors.push(rep.detail);
                }
            }
            Err(e) => errors.push(e),
        }
    }
    if errors.is_empty() {
        WbLayerReport {
            layer: 3,
            name: "factory_reset",
            ok: true,
            detail: format!(
                "已搬移两根顶层条目; 隔离区={} (恢复命令可原样搬回)",
                quarantine_notes.join(" + ")
            ),
        }
    } else {
        WbLayerReport {
            layer: 3,
            name: "factory_reset",
            ok: false,
            detail: format!("已搬移 {moved} 根; 失败: {}", errors.join("; ")),
        }
    }
}

// ================== 编排层（root 显式传参,单测直入） ==================

pub fn minimax_maintenance_reset(
    home: &std::path::Path,
    roaming: &std::path::Path,
    kill_running: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_dir(home, MM_SANITY_MARKERS_HOME).expect("sanity");
    sanity_check_dir(roaming, MM_SANITY_MARKERS_ROAMING).expect("sanity");
    let layers = vec![mm_kill_or_skip(kill_running), layer_maintenance(home, roaming, progress)];
    let rep = WbResetReport { layers };
    write_history(home, "maintenance", &rep);
    rep
}

pub fn minimax_logout_reset(
    home: &std::path::Path,
    roaming: &std::path::Path,
    kill_running: bool,
    include_device_id: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_dir(home, MM_SANITY_MARKERS_HOME).expect("sanity");
    sanity_check_dir(roaming, MM_SANITY_MARKERS_ROAMING).expect("sanity");
    let layers = vec![
        mm_kill_or_skip(kill_running),
        layer_logout(home, roaming, include_device_id, progress),
    ];
    let rep = WbResetReport { layers };
    write_history(home, "logout", &rep);
    rep
}

pub fn minimax_factory_reset(
    home: &std::path::Path,
    roaming: &std::path::Path,
    kill_running: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_dir(home, MM_SANITY_MARKERS_HOME).expect("sanity");
    sanity_check_dir(roaming, MM_SANITY_MARKERS_ROAMING).expect("sanity");
    let layers = vec![mm_kill_or_skip(kill_running), layer_factory(home, roaming, progress)];
    let rep = WbResetReport { layers };
    write_history(home, "factory", &rep);
    rep
}

// ================== 计划预览 / 探针 / 隔离区生命周期 / 历史 ==================

/// 单条计划动作（含中文理由,与执行判据同源）。
#[derive(Debug, Clone, Serialize)]
pub struct MMPlanAction {
    pub path: String,
    /// delete_file | delete_dir | quarantine
    pub action: &'static str,
    pub size_mb: f64,
    pub reason: String,
}

/// 保护面条目（声明不动什么;用户资产逐条列名）。
#[derive(Debug, Clone, Serialize)]
pub struct MMProtectedAsset {
    pub path: String,
    pub reason: String,
    pub exists: bool,
}

/// 计划预览报告（执行前"会动什么/为什么/保护什么"的精确清单）。
#[derive(Debug, Clone, Serialize)]
pub struct MMPlanReport {
    /// maintenance | logout | factory
    pub mode: String,
    pub include_device_id: bool,
    pub actions: Vec<MMPlanAction>,
    /// 资产保护层:任何档位都不动的用户资产(出厂档仅整体隔离、可原样恢复)
    pub protected: Vec<MMProtectedAsset>,
    pub total_mb: f64,
}

fn dir_size_recursive(p: &std::path::Path) -> u64 {
    if p.is_file() {
        return std::fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    }
    let mut total = 0u64;
    if let Ok(rd) = std::fs::read_dir(p) {
        for e in rd.flatten() {
            total += dir_size_recursive(&e.path());
        }
    }
    total
}

/// 资产保护层清单（MiniMax 双根用户资产,照 qoder 的 user_asset 档粒度）。
fn mm_protected_assets(home: &std::path::Path, roaming: &std::path::Path) -> Vec<MMProtectedAsset> {
    let defs: [(&str, &str, bool); 3] = [
        ("home/auth/prod", "OAuth 凭据正文:维护档不动;登出档仅随 auth/ 整体隔离且可原样恢复;出厂档整体隔离", false),
        ("roaming/minimax-agent-cn-config.json", "账号身份(uid/nickname):维护档不动;登出档可选隔离;出厂档整体隔离", true),
        ("roaming/Session Storage", "webview 会话存储:维护档不动;出厂档整体隔离", true),
    ];
    defs.iter()
        .map(|(path, reason, in_roaming)| {
            let full = if *in_roaming {
                roaming.join(path.trim_start_matches("roaming/"))
            } else {
                home.join(path.trim_start_matches("home/"))
            };
            MMProtectedAsset {
                path: (*path).to_string(),
                reason: (*reason).to_string(),
                exists: full.exists(),
            }
        })
        .collect()
}

/// 计划预览:与执行层共用 build_*_items 判据,逐层带中文理由 + 保护面自动包含。
pub fn minimax_plan(
    home: &std::path::Path,
    roaming: &std::path::Path,
    mode: &str,
    include_device_id: bool,
) -> MMPlanReport {
    let items: Vec<(String, &'static str, String)> = match mode {
        "maintenance" => build_maintenance_items(home, roaming)
            .into_iter()
            .map(|i| (i.path, i.action, i.reason))
            .collect(),
        "logout" => build_logout_items(home, roaming, include_device_id)
            .into_iter()
            .map(|i| (i.path, i.action, i.reason))
            .collect(),
        "factory" => build_factory_items(home, roaming)
            .into_iter()
            .map(|i| (i.path, i.action, i.reason))
            .collect(),
        _ => Vec::new(),
    };
    let actions: Vec<MMPlanAction> = items
        .iter()
        .map(|(path, action, reason)| {
            let rel = path.split_once('/').map(|(_, r)| r).unwrap_or(path);
            let full_root = if path.starts_with("home/") { home } else { roaming };
            let full = full_root.join(rel);
            MMPlanAction {
                path: path.clone(),
                action: *action,
                size_mb: dir_size_recursive(&full) as f64 / 1024.0 / 1024.0,
                reason: reason.clone(),
            }
        })
        .collect();
    let total_mb = actions.iter().map(|a| a.size_mb).sum();
    MMPlanReport {
        mode: mode.to_string(),
        include_device_id,
        actions,
        protected: mm_protected_assets(home, roaming),
        total_mb,
    }
}

/// 探针:双根只读盘点（条目按 tier 分类,reclaimable=维护+登出档合计）。
pub fn minimax_probe(home: &std::path::Path, roaming: &std::path::Path) -> WbProbeReport {
    let mut entries: Vec<WbEntry> = Vec::new();
    if let Ok(rd) = std::fs::read_dir(home) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name == MM_HISTORY_DIR {
                continue;
            }
            let tier = classify_home_top_level(&name);
            if tier == "user_asset" {
                continue;
            }
            let size_mb = dir_size_recursive(&e.path()) as f64 / 1024.0 / 1024.0;
            entries.push(WbEntry { path: format!("home/{name}"), tier, size_mb });
        }
    }
    if let Ok(rd) = std::fs::read_dir(roaming) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            let tier = classify_roaming_top_level(&name);
            if tier == "user_asset" {
                continue;
            }
            let size_mb = dir_size_recursive(&e.path()) as f64 / 1024.0 / 1024.0;
            entries.push(WbEntry { path: format!("roaming/{name}"), tier, size_mb });
        }
    }
    let total_mb = dir_size_recursive(home) as f64 / 1024.0 / 1024.0
        + dir_size_recursive(roaming) as f64 / 1024.0 / 1024.0;
    let reclaimable_mb = entries
        .iter()
        .filter(|e| e.tier == "maintenance" || e.tier == "webview_logout" || e.tier == "device_identity")
        .map(|e| e.size_mb)
        .sum();
    WbProbeReport {
        root: home.display().to_string(),
        workbuddy_running: probe_minimax_running(),
        total_mb,
        reclaimable_mb,
        entries,
    }
}

pub fn probe_minimax_running() -> bool {
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
                    if is_minimax_process_image(&image) {
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

// ================== 隔离区生命周期 / 历史 ==================

fn mm_parse_manifest(q: &std::path::Path) -> Result<MMQuarantineManifest, String> {
    let raw = std::fs::read_to_string(q.join(MM_QUARANTINE_MANIFEST))
        .map_err(|e| format!("manifest 读取失败 {}: {e}", q.display()))?;
    serde_json::from_str(&raw).map_err(|e| format!("manifest 解析失败: {e}"))
}

pub fn minimax_quarantine_list_impl(
    home: &std::path::Path,
    roaming: &std::path::Path,
) -> Result<Vec<WbQuarantineInfo>, String> {
    let mut out: Vec<WbQuarantineInfo> = Vec::new();
    for root in [home, roaming] {
        let Some(parent) = root.parent() else { continue };
        let Ok(rd) = std::fs::read_dir(parent) else { continue };
        for e in rd.flatten().filter(|e| is_minimax_quarantine_dir_name(&e.file_name().to_string_lossy())) {
            let q = e.path();
            // 双根夹具/真实布局可能共享同一 parent(home 与 roaming 同父),按 path 去重防重复计数
            if out.iter().any(|x| x.path == q.display().to_string()) {
                continue;
            }
            let manifest = mm_parse_manifest(&q)?;
            let entries = manifest.entries.len();
            let size_mb = dir_size_recursive(&q) as f64 / 1024.0 / 1024.0;
            out.push(WbQuarantineInfo {
                name: e.file_name().to_string_lossy().to_string(),
                path: q.display().to_string(),
                created_unix: manifest.created_unix,
                mode: manifest.mode,
                original_root: manifest.root,
                entries,
                size_mb,
            });
        }
    }
    out.sort_by(|a, b| b.created_unix.cmp(&a.created_unix));
    Ok(out)
}

/// 恢复:按 manifest 逐条目 rename 回原根;目标已存在同名条目时报错不覆盖。
pub fn minimax_quarantine_restore_impl(quarantine: &std::path::Path) -> WbResetReport {
    let mut layers: Vec<WbLayerReport> = Vec::new();
    let manifest = match mm_parse_manifest(quarantine) {
        Ok(m) => m,
        Err(e) => {
            layers.push(WbLayerReport { layer: 0, name: "restore", ok: false, detail: e });
            return WbResetReport { layers };
        }
    };
    let root = std::path::PathBuf::from(&manifest.root);
    let mut errors: Vec<String> = Vec::new();
    let mut restored = 0usize;
    for entry in &manifest.entries {
        let src = quarantine.join(&entry.name);
        let name = entry
            .original_path
            .split(['/', '\\'])
            .next()
            .unwrap_or(&entry.original_path)
            .to_string();
        let dst = root.join(&name);
        if !src.exists() {
            errors.push(format!("{}: 隔离区条目缺失", entry.name));
            continue;
        }
        if dst.exists() {
            errors.push(format!("{name}: 目标已存在,拒绝覆盖"));
            continue;
        }
        match std::fs::rename(&src, &dst) {
            Ok(_) => restored += 1,
            Err(e) => errors.push(format!("{name}: {e}")),
        }
    }
    if errors.is_empty() && restored > 0 {
        let _ = std::fs::remove_dir_all(quarantine);
    }
    layers.push(WbLayerReport {
        layer: 0,
        name: "restore",
        ok: errors.is_empty(),
        detail: if errors.is_empty() {
            format!("已恢复 {restored} 项到 {}", manifest.root)
        } else {
            format!("已恢复 {restored} 项; 失败: {}", errors.join("; "))
        },
    });
    WbResetReport { layers }
}

pub fn minimax_quarantine_delete_impl(
    quarantine: &std::path::Path,
    confirm: bool,
) -> WbResetReport {
    let mut layers: Vec<WbLayerReport> = Vec::new();
    if !confirm {
        layers.push(WbLayerReport {
            layer: 0,
            name: "delete",
            ok: false,
            detail: "未确认(confirm=false),拒绝删除隔离区".into(),
        });
        return WbResetReport { layers };
    }
    if !is_minimax_quarantine_dir_name(
        quarantine
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .as_deref()
            .unwrap_or(""),
    ) {
        layers.push(WbLayerReport {
            layer: 0,
            name: "delete",
            ok: false,
            detail: format!("sanity 拒绝:{} 不是 MiniMax 隔离区", quarantine.display()),
        });
        return WbResetReport { layers };
    }
    match std::fs::remove_dir_all(quarantine) {
        Ok(_) => layers.push(WbLayerReport {
            layer: 0,
            name: "delete",
            ok: true,
            detail: format!("已删除隔离区 {}", quarantine.display()),
        }),
        Err(e) => layers.push(WbLayerReport {
            layer: 0,
            name: "delete",
            ok: false,
            detail: format!("删除失败 {}: {e}", quarantine.display()),
        }),
    }
    WbResetReport { layers }
}

pub fn minimax_read_history(home: &std::path::Path) -> Vec<WbHistoryItem> {
    let dir = home.join(MM_HISTORY_DIR);
    let mut out: Vec<WbHistoryItem> = Vec::new();
    let Ok(rd) = std::fs::read_dir(&dir) else {
        return out;
    };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if !name.ends_with(".json") {
            continue;
        }
        let Ok(body) = std::fs::read_to_string(e.path()) else { continue };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&body) else { continue };
        out.push(WbHistoryItem {
            file: name,
            ts_unix: v.get("ts_unix").and_then(|x| x.as_u64()).unwrap_or(0),
            mode: v
                .get("mode")
                .and_then(|x| x.as_str())
                .unwrap_or("unknown")
                .to_string(),
            ok: v.get("ok").and_then(|x| x.as_bool()).unwrap_or(false),
            summary: v
                .get("summary")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
        });
    }
    out.sort_by(|a, b| b.ts_unix.cmp(&a.ts_unix));
    out
}

// ================== Tauri 命令层 ==================

fn mm_progress_channel(on_progress: tauri::ipc::Channel<WbProgressEvent>) -> impl Fn(WbProgressEvent) + Send + Sync {
    move |evt| {
        let _ = on_progress.send(evt);
    }
}

fn mm_resolve_both() -> Result<(std::path::PathBuf, std::path::PathBuf), IpcError> {
    mm_reset_gate()
        .map_err(IpcError::internal)
        .and_then(|_| {
            let home = resolve_home_dir().map_err(IpcError::internal)?;
            let roaming = resolve_roaming_dir().map_err(IpcError::internal)?;
            Ok((home, roaming))
        })
}

fn mm_sanity_both(home: &std::path::Path, roaming: &std::path::Path) -> Result<(), IpcError> {
    sanity_check_dir(home, MM_SANITY_MARKERS_HOME).map_err(IpcError::internal)?;
    sanity_check_dir(roaming, MM_SANITY_MARKERS_ROAMING).map_err(IpcError::internal)?;
    Ok(())
}

#[tauri::command(async)]
pub async fn minimax_reset_probe() -> Result<WbProbeReport, IpcError> {
    let (home, roaming) = mm_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || minimax_probe(&home, &roaming))
        .await
        .map_err(|e| IpcError::internal(format!("MiniMax 探针任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn minimax_reset_plan(
    mode: String,
    include_device_id: Option<bool>,
) -> Result<MMPlanReport, IpcError> {
    let (home, roaming) = mm_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || {
        minimax_plan(&home, &roaming, &mode, include_device_id.unwrap_or(false))
    })
    .await
    .map_err(|e| IpcError::internal(format!("MiniMax 计划任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn minimax_reset_maintenance(
    kill_running: Option<bool>,
    on_progress: tauri::ipc::Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    let (home, roaming) = mm_resolve_both()?;
    mm_sanity_both(&home, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || {
        minimax_maintenance_reset(&home, &roaming, kill_running.unwrap_or(true), Some(&mm_progress_channel(on_progress)))
    })
    .await
    .map_err(|e| IpcError::internal(format!("MiniMax 维护清理任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn minimax_reset_logout(
    kill_running: Option<bool>,
    include_device_id: Option<bool>,
    on_progress: tauri::ipc::Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    let (home, roaming) = mm_resolve_both()?;
    mm_sanity_both(&home, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || {
        minimax_logout_reset(
            &home,
            &roaming,
            kill_running.unwrap_or(true),
            include_device_id.unwrap_or(false),
            Some(&mm_progress_channel(on_progress)),
        )
    })
    .await
    .map_err(|e| IpcError::internal(format!("MiniMax 登出重置任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn minimax_reset_factory(
    kill_running: Option<bool>,
    on_progress: tauri::ipc::Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    let (home, roaming) = mm_resolve_both()?;
    mm_sanity_both(&home, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || {
        minimax_factory_reset(&home, &roaming, kill_running.unwrap_or(true), Some(&mm_progress_channel(on_progress)))
    })
    .await
    .map_err(|e| IpcError::internal(format!("MiniMax 出厂重置任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn minimax_quarantine_list() -> Result<Vec<WbQuarantineInfo>, IpcError> {
    let (home, roaming) = mm_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || minimax_quarantine_list_impl(&home, &roaming))
        .await
        .map_err(|e| IpcError::internal(format!("MiniMax 隔离区列表任务异常退出: {e}")))?
        .map_err(IpcError::internal)
}

#[tauri::command(async)]
pub async fn minimax_quarantine_restore(
    quarantine: String,
    on_progress: tauri::ipc::Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    mm_reset_gate().map_err(IpcError::internal)?;
    let _ = on_progress;
    let q = std::path::PathBuf::from(quarantine);
    tauri::async_runtime::spawn_blocking(move || minimax_quarantine_restore_impl(&q))
        .await
        .map_err(|e| IpcError::internal(format!("MiniMax 隔离区恢复任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn minimax_quarantine_delete(
    quarantine: String,
    confirm: bool,
) -> Result<WbResetReport, IpcError> {
    mm_reset_gate().map_err(IpcError::internal)?;
    let q = std::path::PathBuf::from(quarantine);
    tauri::async_runtime::spawn_blocking(move || minimax_quarantine_delete_impl(&q, confirm))
        .await
        .map_err(|e| IpcError::internal(format!("MiniMax 隔离区删除任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn minimax_reset_history() -> Result<Vec<WbHistoryItem>, IpcError> {
    let (home, _) = mm_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || minimax_read_history(&home))
        .await
        .map_err(|e| IpcError::internal(format!("MiniMax 历史任务异常退出: {e}")))
}

// ================== 残留审计 ==================

/// 单条残留审计条目（只读清点,不读内容、不删除）。
#[derive(Debug, Clone, Serialize)]
pub struct MMResidualEntry {
    /// home | roaming | variant
    pub root: &'static str,
    pub path: String,
    pub kind: &'static str,
    pub exists: bool,
    /// 文件字节数(目录或不存在=None)
    pub size: Option<u64>,
}

/// MiniMax 残留审计报告(签到/登录残留只读清点)。
#[derive(Debug, Clone, Serialize)]
pub struct MMResidualAuditReport {
    pub home_root: String,
    pub roaming_root: String,
    pub entries: Vec<MMResidualEntry>,
    /// 在场条目数
    pub present: usize,
    pub message: String,
}

fn push_audit_entry(
    entries: &mut Vec<MMResidualEntry>,
    root: &'static str,
    rel: &str,
    full: &std::path::Path,
    kind: &'static str,
) {
    let exists = full.exists();
    let size = if exists && full.is_file() {
        std::fs::metadata(full).ok().map(|m| m.len())
    } else {
        None
    };
    entries.push(MMResidualEntry { root, path: rel.to_string(), kind, exists, size });
}

/// 残留审计主流程(纯同步,可单测;坐标来自 2026-10-15 捕获侧只读侦察):
/// 根① auth/(OAuth 凭据)、auth/prod/cn/mcode-public/auth.json(token 正文);
/// 根② minimax-agent-cn-config.json(账号 uid/nickname)、minimax-agent-config.json(变体);
/// 变体根 %APPDATA%/MiniMax Agent(Agent 桌面端数据面)。
pub fn minimax_audit_residual_impl(
    home: &std::path::Path,
    roaming: &std::path::Path,
) -> MMResidualAuditReport {
    let mut entries: Vec<MMResidualEntry> = Vec::new();
    push_audit_entry(&mut entries, "home", "auth", &home.join(MM_AUTH_DIR), "auth_credential");
    push_audit_entry(
        &mut entries,
        "home",
        "auth/prod/cn/mcode-public/auth.json",
        &home.join("auth/prod/cn/mcode-public/auth.json"),
        "oauth_token",
    );
    push_audit_entry(
        &mut entries,
        "roaming",
        "minimax-agent-cn-config.json",
        &roaming.join("minimax-agent-cn-config.json"),
        "account_identity",
    );
    push_audit_entry(
        &mut entries,
        "roaming",
        "minimax-agent-config.json",
        &roaming.join("minimax-agent-config.json"),
        "account_identity",
    );
    let variant = roaming
        .parent()
        .map(|p| p.join("MiniMax Agent"))
        .unwrap_or_else(|| roaming.to_path_buf());
    push_audit_entry(&mut entries, "variant", "MiniMax Agent", &variant, "variant_root");
    let present = entries.iter().filter(|e| e.exists).count();
    let missing = entries.len() - present;
    MMResidualAuditReport {
        home_root: home.display().to_string(),
        roaming_root: roaming.display().to_string(),
        present,
        message: format!(
            "只读清点 MiniMax 双根 {} 类签到/登录残留坐标:在场 {} 项、缺席 {} 项(只报存在与路径,不读内容、不删除任何东西)",
            entries.len(),
            present,
            missing
        ),
        entries,
    }
}

/// 残留审计命令:双根只读扫描,不做任何写入(重置面之外的独立取证口)。
#[tauri::command(async)]
pub async fn checkin_audit_minimax_residual() -> Result<MMResidualAuditReport, IpcError> {
    let (home, roaming) = mm_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || minimax_audit_residual_impl(&home, &roaming))
        .await
        .map_err(|e| IpcError::internal(format!("MiniMax 残留审计任务异常退出: {e}")))
}

// ================== 测试（临时夹具,绝不触碰真实 ~/.minimax） ==================

#[cfg(test)]
mod tests {
    use super::*;

    /// 独立容器夹具：temp/<tag>-<nanos>/{home,roaming} —— 双根各自带 sanity 特征标记。
    fn fixture_roots(tag: &str) -> (std::path::PathBuf, std::path::PathBuf) {
        let container = std::env::temp_dir().join(format!(
            "minimax-reset-test-{tag}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let home = container.join("home");
        let roaming = container.join("roaming");
        // 根①:CLI/Code 面
        std::fs::create_dir_all(home.join("logs/20261016")).unwrap();
        std::fs::write(home.join("logs/20261016/main.log"), "log").unwrap();
        std::fs::create_dir_all(home.join("tmp/x")).unwrap();
        std::fs::write(home.join("tmp/x/t"), "t").unwrap();
        std::fs::create_dir_all(home.join("auth/prod/cn/mcode-public")).unwrap();
        std::fs::write(
            home.join("auth/prod/cn/mcode-public/auth.json"),
            r#"{"schemaVersion":1,"records":{"token":"tok","refresh_token":"r"}}"#,
        )
        .unwrap();
        // 根②:Agent 壳面
        std::fs::create_dir_all(roaming.join("Cache/js")).unwrap();
        std::fs::write(roaming.join("Cache/js/x"), "c").unwrap();
        std::fs::create_dir_all(roaming.join("Crashpad/reports")).unwrap();
        std::fs::write(roaming.join("Crashpad/reports/a.dmp"), "d").unwrap();
        std::fs::write(
            roaming.join("minimax-agent-cn-config.json"),
            r#"{"user":{"uid":"u-1","nickname":"李总"}}"#,
        )
        .unwrap();
        (home, roaming)
    }

    fn cleanup(home: &std::path::Path, roaming: &std::path::Path) {
        if let Some(c) = home.parent() {
            let _ = std::fs::remove_dir_all(c);
        }
    }

    #[test]
    fn classify_and_process_image() {
        assert_eq!(classify_home_top_level("auth"), "webview_logout");
        assert_eq!(classify_home_top_level("logs"), "maintenance");
        assert_eq!(classify_home_top_level("workspace"), "user_asset");
        assert_eq!(classify_roaming_top_level("minimax-agent-cn-config.json"), "device_identity");
        assert_eq!(classify_roaming_top_level("Cache"), "maintenance");
        assert_eq!(classify_roaming_top_level("main.sqlite"), "user_asset");
        assert!(is_minimax_process_image("MiniMax.exe"));
        assert!(is_minimax_process_image("minimax-agent.exe"));
        assert!(!is_minimax_process_image("explorer.exe"));
    }

    #[test]
    fn escape_gate() {
        assert!(mm_reset_gate_with(|_| None).is_ok());
        assert!(mm_reset_gate_with(|k| (k == "IHUI_MINIMAX_RESET_DISABLE").then(|| "1".to_string())).is_err());
        assert!(mm_reset_gate_with(|k| (k == "IHUI_MINIMAX_RESET_DISABLE").then(|| "0".to_string())).is_ok());
    }

    #[test]
    fn sanity_rejects_home_and_non_markers() {
        let (home, roaming) = fixture_roots("sanity");
        // 命中标记 → 放行
        assert!(sanity_check_dir(&home, MM_SANITY_MARKERS_HOME).is_ok());
        // 无标记目录 → 拒绝
        let empty = home.parent().unwrap().join("empty");
        std::fs::create_dir_all(&empty).unwrap();
        assert!(sanity_check_dir(&empty, MM_SANITY_MARKERS_ROAMING).is_err());
        cleanup(&home, &roaming);
    }

    #[test]
    fn maintenance_clears_caches_keeps_auth_and_identity() {
        let (home, roaming) = fixture_roots("maint");
        let rep = minimax_maintenance_reset(&home, &roaming, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        // 可再生内容被清
        assert!(std::fs::read_dir(home.join("logs")).unwrap().next().is_none() || !home.join("logs").exists());
        assert!(!roaming.join("Cache").exists());
        assert!(!roaming.join("Crashpad").exists());
        // 登录态与身份保留
        assert!(home.join("auth/prod/cn/mcode-public/auth.json").exists());
        assert!(roaming.join("minimax-agent-cn-config.json").exists());
        cleanup(&home, &roaming);
    }

    #[test]
    fn logout_quarantines_auth_restorable() {
        let (home, roaming) = fixture_roots("logout");
        let rep = minimax_logout_reset(&home, &roaming, false, true, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!home.join("auth").exists());
        assert!(!roaming.join("minimax-agent-cn-config.json").exists());
        let list = minimax_quarantine_list_impl(&home, &roaming).unwrap();
        assert_eq!(list.len(), 2, "{list:?}");
        // 恢复 auth 隔离区
        let q_auth = list
            .iter()
            .find(|q| q.entries >= 1 && q.mode == "logout" && q.original_root.contains("home"))
            .unwrap();
        let rep = minimax_quarantine_restore_impl(std::path::Path::new(&q_auth.path));
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(home.join("auth/prod/cn/mcode-public/auth.json").exists());
        cleanup(&home, &roaming);
    }

    #[test]
    fn factory_quarantines_both_roots_and_restores() {
        let (home, roaming) = fixture_roots("factory");
        let rep = minimax_factory_reset(&home, &roaming, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!home.join("auth").exists());
        assert!(!roaming.join("Cache").exists());
        let list = minimax_quarantine_list_impl(&home, &roaming).unwrap();
        assert_eq!(list.len(), 2);
        for q in &list {
            let rep = minimax_quarantine_restore_impl(std::path::Path::new(&q.path));
            assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        }
        assert!(home.join("auth/prod/cn/mcode-public/auth.json").exists());
        assert!(roaming.join("Cache/js/x").exists());
        cleanup(&home, &roaming);
    }

    #[test]
    fn plan_reports_actions_and_protected_assets() {
        let (home, roaming) = fixture_roots("plan");
        let p = minimax_plan(&home, &roaming, "logout", true);
        assert_eq!(p.mode, "logout");
        assert!(p.actions.iter().any(|a| a.action == "quarantine" && a.path == "auth"));
        assert!(p.actions.iter().any(|a| a.path.contains("minimax-agent-cn-config.json")));
        assert!(!p.protected.is_empty());
        cleanup(&home, &roaming);
    }

    #[test]
    fn audit_residual_counts_presence() {
        let (home, roaming) = fixture_roots("audit");
        let rep = minimax_audit_residual_impl(&home, &roaming);
        // 在场:auth + auth.json + cn-config = 3(config.json 变体与 MiniMax Agent 变体夹具里不存在)
        assert_eq!(rep.present, 3, "{:?}", rep.entries);
        assert!(rep.message.contains("在场 3 项"));
        cleanup(&home, &roaming);
    }

    #[test]
    fn delete_requires_confirm_and_prefix() {
        let (home, roaming) = fixture_roots("delete");
        let rep = minimax_factory_reset(&home, &roaming, false, None);
        assert!(rep.layers.iter().all(|l| l.ok));
        let list = minimax_quarantine_list_impl(&home, &roaming).unwrap();
        let q0 = std::path::PathBuf::from(&list[0].path);
        // 未确认 → 拒绝
        let rep = minimax_quarantine_delete_impl(&q0, false);
        assert!(!rep.layers.iter().all(|l| l.ok));
        assert!(q0.exists());
        // 确认 → 删除
        let rep = minimax_quarantine_delete_impl(&q0, true);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!q0.exists());
        // 非隔离区路径 → sanity 拒绝
        let rep = minimax_quarantine_delete_impl(&home, true);
        assert!(!rep.layers.iter().all(|l| l.ok));
        cleanup(&home, &roaming);
    }
}
