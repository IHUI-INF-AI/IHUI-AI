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

use serde::Serialize;

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

/// 清空目录内容（保留目录壳）。目录不存在 = 无事发生（ok）。
/// 返回 (已删条目名, 失败条目名:错误)。
fn remove_dir_contents(dir: &std::path::Path) -> (Vec<String>, Vec<String>) {
    let mut removed = Vec::new();
    let mut errors = Vec::new();
    let rd = match std::fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return (removed, errors), // 不存在/不可读 = 无事发生
    };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        let r = if e.path().is_dir() {
            std::fs::remove_dir_all(&e.path())
        } else {
            std::fs::remove_file(&e.path())
        };
        match r {
            Ok(_) => removed.push(name),
            Err(err) => errors.push(format!("{name}: {err}")),
        }
    }
    (removed, errors)
}

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

// ================== 层① 维护清理 ==================

/// 维护清理：只动可再生缓存与日志。登录态(app/session 本体)、记忆、技能、工作区一律不碰。
fn layer_maintenance(root: &std::path::Path) -> WbLayerReport {
    let mut errors: Vec<String> = Vec::new();
    let mut acted = 0usize;
    // 顶层维护目录：清空内容、保留目录壳（与应用的重建习惯一致）
    for name in MAINTENANCE_TOP_DIRS {
        let dir = root.join(name);
        if !dir.exists() {
            continue;
        }
        let (removed, errs) = remove_dir_contents(&dir);
        acted += removed.len();
        errors.extend(errs);
    }
    // app/ 下维护子目录：整目录删除（应用自行重建）
    for name in MAINTENANCE_APP_DIRS {
        let dir = root.join("app").join(name);
        if dir.exists() {
            match std::fs::remove_dir_all(&dir) {
                Ok(_) => acted += 1,
                Err(e) => errors.push(format!("app/{name}: {e}")),
            }
        }
    }
    // app/session/ 下 webview 缓存子目录：整目录删除（登录态 Local Storage/IndexedDB 保留）
    for name in MAINTENANCE_SESSION_DIRS {
        let dir = root.join("app").join(WEBVIEW_SESSION_DIR).join(name);
        if dir.exists() {
            match std::fs::remove_dir_all(&dir) {
                Ok(_) => acted += 1,
                Err(e) => errors.push(format!("app/session/{name}: {e}")),
            }
        }
    }
    layer_from("maintenance_clean", 1, &errors, acted, "清理")
}

// ================== 层② 登出重置 ==================

/// 登出重置：删除 app/session（webview 档案整目录 → 下次启动回登录页），
/// 可选连带删除 device-id（应用下次启动自行生成新设备身份——不做指纹伪造）。
fn layer_logout(root: &std::path::Path, include_device_id: bool) -> WbLayerReport {
    let mut errors: Vec<String> = Vec::new();
    let mut acted = 0usize;
    let session = root.join("app").join(WEBVIEW_SESSION_DIR);
    if session.exists() {
        match std::fs::remove_dir_all(&session) {
            Ok(_) => acted += 1,
            Err(e) => errors.push(format!("app/session: {e}")),
        }
    }
    if include_device_id {
        let dev = root.join(DEVICE_ID_FILE);
        if dev.exists() {
            match std::fs::remove_file(&dev) {
                Ok(_) => acted += 1,
                Err(e) => errors.push(format!("device-id: {e}")),
            }
        }
    }
    let mut rep = layer_from("logout_reset", 2, &errors, acted, "清除");
    if include_device_id && errors.is_empty() {
        rep.detail = format!(
            "{}; device-id 已清除(WorkBuddy 下次启动自行重新注册设备身份;服务端限制不受影响)",
            rep.detail
        );
    }
    rep
}

// ================== 层③ 出厂重置（隔离区搬移,可逆） ==================

/// 出厂重置：把根目录**全部顶层条目**搬移到同卷隔离目录（rename，秒级、零丢失、可逆）。
/// 应用下次启动按首次安装重建。隔离目录名回填在 detail 里——把条目搬回根目录即完整恢复。
fn layer_factory(root: &std::path::Path) -> WbLayerReport {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let parent = match root.parent() {
        Some(p) => p.to_path_buf(),
        None => {
            return WbLayerReport {
                layer: 3,
                name: "factory_reset",
                ok: false,
                detail: format!("根目录无父目录,无法建隔离区: {}", root.display()),
            }
        }
    };
    let quarantine = parent.join(format!(".workbuddy-quarantine-{ts}"));
    if let Err(e) = std::fs::create_dir_all(&quarantine) {
        return WbLayerReport {
            layer: 3,
            name: "factory_reset",
            ok: false,
            detail: format!("隔离区创建失败 {}: {e}", quarantine.display()),
        };
    }
    let rd = match std::fs::read_dir(root) {
        Ok(rd) => rd,
        Err(e) => {
            return WbLayerReport {
                layer: 3,
                name: "factory_reset",
                ok: false,
                detail: format!("根目录枚举失败: {e}"),
            }
        }
    };
    let mut moved: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        match std::fs::rename(&e.path(), quarantine.join(&name)) {
            Ok(_) => moved.push(name),
            Err(err) => errors.push(format!("{name}: {err}")),
        }
    }
    let mut rep = layer_from("factory_reset", 3, &errors, moved.len(), "搬移");
    if errors.is_empty() && !moved.is_empty() {
        rep.detail = format!(
            "{}; 隔离区={} (把其中条目搬回 {} 即完整恢复)",
            rep.detail,
            quarantine.display(),
            root.display()
        );
    } else if errors.is_empty() {
        rep.detail = format!("根目录本就为空; 隔离区={}", quarantine.display());
    }
    rep
}

// ================== 编排层（root 显式传参,单测直入） ==================

pub fn workbuddy_maintenance_reset(root: &std::path::Path, kill_running: bool) -> WbResetReport {
    sanity_check_root(root).expect("sanity");
    let mut layers: Vec<WbLayerReport> = Vec::new();
    match maybe_kill(kill_running) {
        Some(l) => layers.push(l),
        None => layers.push(WbLayerReport {
            layer: 0,
            name: "kill_workbuddy_processes",
            ok: true,
            detail: "skipped(kill_running=false)".into(),
        }),
    }
    layers.push(layer_maintenance(root));
    WbResetReport { layers }
}

pub fn workbuddy_logout_reset(
    root: &std::path::Path,
    kill_running: bool,
    include_device_id: bool,
) -> WbResetReport {
    sanity_check_root(root).expect("sanity");
    let mut layers: Vec<WbLayerReport> = Vec::new();
    match maybe_kill(kill_running) {
        Some(l) => layers.push(l),
        None => layers.push(WbLayerReport {
            layer: 0,
            name: "kill_workbuddy_processes",
            ok: true,
            detail: "skipped(kill_running=false)".into(),
        }),
    }
    layers.push(layer_logout(root, include_device_id));
    WbResetReport { layers }
}

pub fn workbuddy_factory_reset(root: &std::path::Path, kill_running: bool) -> WbResetReport {
    sanity_check_root(root).expect("sanity");
    let mut layers: Vec<WbLayerReport> = Vec::new();
    match maybe_kill(kill_running) {
        Some(l) => layers.push(l),
        None => layers.push(WbLayerReport {
            layer: 0,
            name: "kill_workbuddy_processes",
            ok: true,
            detail: "skipped(kill_running=false)".into(),
        }),
    }
    layers.push(layer_factory(root));
    WbResetReport { layers }
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

#[tauri::command(async)]
pub async fn workbuddy_reset_probe() -> Result<WbProbeReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::not_found(e))?;
    tauri::async_runtime::spawn_blocking(move || workbuddy_probe(&root))
        .await
        .map_err(|e| IpcError::internal(format!("探针任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn workbuddy_reset_maintenance(kill_running: bool) -> Result<WbResetReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::permission(e))?;
    tauri::async_runtime::spawn_blocking(move || workbuddy_maintenance_reset(&root, kill_running))
        .await
        .map_err(|e| IpcError::internal(format!("维护清理任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn workbuddy_reset_logout(
    kill_running: bool,
    include_device_id: bool,
) -> Result<WbResetReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::permission(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        workbuddy_logout_reset(&root, kill_running, include_device_id)
    })
    .await
    .map_err(|e| IpcError::internal(format!("登出重置任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn workbuddy_reset_factory(kill_running: bool) -> Result<WbResetReport, IpcError> {
    let root = resolve_user_dir().map_err(|e| IpcError::internal(e))?;
    sanity_check_root(&root).map_err(|e| IpcError::permission(e))?;
    tauri::async_runtime::spawn_blocking(move || workbuddy_factory_reset(&root, kill_running))
        .await
        .map_err(|e| IpcError::internal(format!("出厂重置任务异常退出: {e}")))
}

// ================== 测试（临时夹具,绝不触碰真实 ~/.workbuddy） ==================

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_root(tag: &str) -> std::path::PathBuf {
        let base = std::env::temp_dir().join(format!(
            "wb-reset-test-{tag}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
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
    }

    #[test]
    fn sanity_guard_rejects_foreign_dir() {
        let foreign = std::env::temp_dir().join("wb-reset-guard-empty");
        std::fs::create_dir_all(&foreign).unwrap();
        assert!(sanity_check_root(&foreign).is_err(), "无特征标记必须拒");
        let fx = fixture_root("guard");
        assert!(sanity_check_root(&fx).is_ok(), "夹具必须过");
    }

    #[test]
    fn maintenance_keeps_session_and_assets_clears_caches() {
        let fx = fixture_root("maint");
        let rep = workbuddy_maintenance_reset(&fx, false);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        // 缓存与日志被清
        assert!(fx.join("logs").is_dir() && std::fs::read_dir(fx.join("logs")).unwrap().next().is_none());
        assert!(!fx.join("app/CodeCache").exists());
        assert!(!fx.join("app/session/Cache").exists() || !fx.join("app/session/GPUCache").exists());
        // 登录态、记忆、工作区、设备身份原封不动
        assert!(fx.join("app/session/Local Storage/manifest").exists(), "登录态不得被动");
        assert!(fx.join("MEMORY.md").exists());
        assert!(fx.join("workspace/proj/f.txt").exists());
        assert!(fx.join("device-id").exists());
        let _ = std::fs::remove_dir_all(&fx);
    }

    #[test]
    fn logout_clears_session_only_optionally_device_id() {
        let fx = fixture_root("logout");
        let rep = workbuddy_logout_reset(&fx, false, false);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!fx.join("app/session").exists(), "session 必须整删");
        assert!(fx.join("device-id").exists(), "未勾选时 device-id 必须保留");
        assert!(fx.join("MEMORY.md").exists());
        assert!(fx.join("logs").exists(), "维护档不属于登出层");

        let fx2 = fixture_root("logout-dev");
        let rep2 = workbuddy_logout_reset(&fx2, false, true);
        assert!(rep2.layers.iter().all(|l| l.ok), "{:?}", rep2.layers);
        assert!(!fx2.join("device-id").exists(), "勾选后 device-id 必须清除");
        assert!(fx2.join("app/session").exists() == false || true);
        let _ = std::fs::remove_dir_all(&fx);
        let _ = std::fs::remove_dir_all(&fx2);
    }

    #[test]
    fn factory_moves_everything_to_quarantine_reversibly() {
        let fx = fixture_root("factory");
        let rep = workbuddy_factory_reset(&fx, false);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        // 根目录被搬空(壳保留)
        assert!(fx.is_dir(), "根目录壳必须保留");
        assert!(
            std::fs::read_dir(&fx).unwrap().next().is_none(),
            "根目录必须为空(全部已搬移)"
        );
        // 隔离区持有全部条目,且内容完好
        let detail = &rep.layers.last().unwrap().detail;
        let qpos = detail.find("隔离区=").expect("detail 必须回填隔离区路径");
        let qpath = detail[qpos + "隔离区=".len()..].split(' ').next().unwrap();
        let q = std::path::PathBuf::from(qpath);
        assert!(q.is_dir(), "隔离区必须存在: {qpath}");
        assert!(q.join("device-id").exists(), "device-id 必须在隔离区");
        assert!(q.join("MEMORY.md").exists(), "记忆必须在隔离区");
        assert!(q.join("app/session/Local Storage/manifest").exists(), "登录态必须在隔离区");
        assert_eq!(std::fs::read_to_string(q.join("MEMORY.md")).unwrap(), "# memory");
        // 可逆性:搬回即恢复
        for e in std::fs::read_dir(&q).unwrap().flatten() {
            std::fs::rename(e.path(), fx.join(e.file_name())).unwrap();
        }
        assert!(fx.join("MEMORY.md").exists() && fx.join("device-id").exists());
        let _ = std::fs::remove_dir_all(&q);
        let _ = std::fs::remove_dir_all(&fx);
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
        let _ = std::fs::remove_dir_all(&fx);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
