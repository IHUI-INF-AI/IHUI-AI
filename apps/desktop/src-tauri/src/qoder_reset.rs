// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! Qoder 程序一键重置（2026-10-10 立，与 WorkBuddy 重置同架构）。
//!
//! 目标程序：Qoder CN（Electron/VS Code 血统 AI IDE）。本地状态面（2026-10-10 只读侦察实测）：
//! - 根① `~/.qoder-cn/`（agent 核心，本机 ~7.3G）：logs 5.1G / file-history 1.3G / tmp 434M /
//!   projects 378M(用户资产) / plugins 79M(资产)；
//!   登录态 = `.auth/`（凭据 + machine_id）；设备身份 = `installation_id`(GUID) + `umid-cache.json`；
//! - 根② `%APPDATA%/com.qodercn.app.stable/`（Electron 壳，~630M）：logs 353M / main.sqlite 103M
//!   (聊天记录=用户资产) / Cache 76M / Partitions 38M(webview 登录态) / Code Cache / GPUCache。
//!
//! 三档能力（与 WorkBuddy 重置一一对应）：
//! ① 维护清理：清 logs/tmp/.cache/shell-snapshots/session-env/host-actions/file-history(可再生
//!    的文件编辑历史快照) 子条目 + 壳面 logs 子条目与 Cache/Code Cache/GPUCache 整删——登录态、
//!    聊天记录、记忆、技能、项目一律不碰；
//! ② 登出重置：`.auth` 与 `Partitions` 搬入同卷隔离区（可逆）；可选连带设备身份
//!    (installation_id + umid-cache.json)——本地清除→应用自行重新注册，不做指纹伪造；
//! ③ 出厂重置：两根顶层条目分别整体搬移到各自同卷隔离目录（rename，秒级、零丢失、可逆）。
//!
//! 安全网（与 workbuddy_reset 同纪律）：层⓪强杀 Qoder 进程（映像含 "qoder"，跳过自身）；
//! 双根 sanity 护栏（各根特征标记 + 拒绝主目录本身）；root 显式传参（测试走 temp 夹具）；
//! 逐条目报告不 panic；manifest 随隔离区落盘=恢复唯一依据；历史台账上限裁剪。

use serde::{Deserialize, Serialize};

use crate::workbuddy_reset::{
    prune_history, WbEntry, WbHistoryItem, WbLayerReport, WbProgressCb, WbProgressEvent,
    WbProbeReport, WbQuarantineInfo, WbResetReport,
};
use crate::IpcError;

// ================== 分类判据（纯函数，可单测） ==================

/// 根①（~/.qoder-cn）维护档顶层目录：清空内容、保留壳。
pub const Q_MAINTENANCE_TOP_DIRS: &[&str] = &[
    "logs",
    "tmp",
    "shell-snapshots",
    "session-env",
    "host-actions",
    "file-history",
    ".cache",
];
/// 根① 登录态目录（凭据 + machine_id）。
pub const Q_AUTH_DIR: &str = ".auth";
/// 根① 设备身份文件。
pub const Q_DEVICE_ID_FILES: &[&str] = &["installation_id", "umid-cache.json"];
/// 根②（Electron 壳）维护档整删子目录（Electron 标准可再生缓存;存在才动,不存在即无操作;
/// 2026-10-11 分层扩展:比照 workbuddy_reset 的 MAINTENANCE_APP_DIRS 粒度补齐）。
pub const Q_MAINTENANCE_ROAMING_DIRS: &[&str] = &[
    "Cache",
    "Code Cache",
    "GPUCache",
    "Crashpad",
    "DawnGraphiteCache",
    "DawnWebGPUCache",
    "DIPS",
    "DIPS-wal",
];
/// Partitions/<p>/ 下 webview 可再生缓存子目录（维护档;登录态子目录一律不动;
/// 比照 workbuddy_reset 的 MAINTENANCE_SESSION_DIRS 粒度)。
pub const Q_MAINTENANCE_PARTITION_CACHE_DIRS: &[&str] = &[
    "Cache",
    "Code Cache",
    "GPUCache",
    "DawnGraphiteCache",
    "DawnWebGPUCache",
    "DIPS",
    "DIPS-wal",
];
/// 根② webview 登录态目录。
pub const Q_PARTITIONS_DIR: &str = "Partitions";

// ================== 环境变量逃生门（应急禁用整个 Qoder 重置面） ==================

/// 逃生门变量名:置任意非空且非 "0" 的值 → Qoder 重置的计划与执行全部拦截。
/// 仓内 env 开关惯例为 IHUI_ 前缀(checkin_capture 的 IHUI_RESET_* / git 的 IHUI_GIT_BIN),
/// WorkBuddy 重置版本身无禁用门,故按同前缀惯例命名;语义:禁用是安全侧,默认放行。
pub const Q_RESET_DISABLE_ENV: &str = "IHUI_QODER_RESET_DISABLE";

/// 逃生门判据（纯函数,reader 注入可单测）:置位 → Err(明确原因)。
pub fn q_reset_gate_with(read: impl Fn(&str) -> Option<String>) -> Result<(), String> {
    match read(Q_RESET_DISABLE_ENV) {
        Some(v) if !v.trim().is_empty() && v.trim() != "0" => Err(format!(
            "逃生门生效:环境变量 {Q_RESET_DISABLE_ENV}={v} 已置位,Qoder 重置的计划与执行已全部拦截;如需恢复,请移除该变量或将其设为 0"
        )),
        _ => Ok(()),
    }
}

/// 真实逃生门读取（进程环境变量）。
fn q_reset_gate() -> Result<(), String> {
    q_reset_gate_with(|k| std::env::var(k).ok())
}

/// 根②维护档整删条目的中文理由（按名字细分,计划面透出）。
fn roaming_maintenance_reason(name: &str) -> &'static str {
    match name {
        "Cache" | "Code Cache" | "GPUCache" => "Electron 渲染缓存,可再生,整删即回收",
        "Crashpad" => "崩溃转储目录,可再生,整删即回收",
        _ => "GPU/着色器缓存与 DIPS 记录,可再生,整删即回收",
    }
}
/// 根① sanity 特征标记。
pub const Q_SANITY_MARKERS_CN: &[&str] =
    &[".auth", "logs", "projects", "settings.json", "installation_id"];
/// 根② sanity 特征标记。
pub const Q_SANITY_MARKERS_ROAMING: &[&str] =
    &["main.sqlite", "logs", "Cache", "Partitions"];
/// 隔离目录命名前缀（恢复/删除护栏依据）。
pub const Q_QUARANTINE_PREFIX: &str = ".qoder-quarantine-";
/// 隔离区 manifest 文件名。
pub const Q_QUARANTINE_MANIFEST: &str = "quarantine-manifest.json";
/// 历史台账目录（落在根①顶层）。
pub const Q_HISTORY_DIR: &str = "reset-history";
/// 进程映像判据关键词（不区分大小写）。
pub const Q_PROCESS_KEYWORD: &str = "qoder";

/// 根①顶层条目分类（纯函数）。
pub fn classify_cn_top_level(name: &str) -> &'static str {
    if name == Q_AUTH_DIR {
        return "webview_logout";
    }
    if Q_DEVICE_ID_FILES.contains(&name) {
        return "device_identity";
    }
    if Q_MAINTENANCE_TOP_DIRS.contains(&name) {
        return "maintenance";
    }
    "user_asset"
}

/// 根②顶层条目分类（纯函数）。
pub fn classify_roaming_top_level(name: &str) -> &'static str {
    if name == Q_PARTITIONS_DIR {
        return "webview_logout";
    }
    if Q_MAINTENANCE_ROAMING_DIRS.contains(&name) {
        return "maintenance";
    }
    "user_asset"
}

/// 进程映像判据（纯函数）：映像名(不区分大小写)含 "qoder"。
pub fn is_qoder_process_image(image_name: &str) -> bool {
    image_name.to_ascii_lowercase().contains(Q_PROCESS_KEYWORD)
}

// ================== 根解析与 sanity 护栏 ==================

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

/// 根①：QODER_CN_DIR env 覆盖（测试/自定义）→ ~/.qoder-cn。
fn resolve_cn_dir() -> Result<std::path::PathBuf, String> {
    if let Ok(p) = std::env::var("QODER_CN_DIR") {
        if !p.is_empty() {
            return Ok(std::path::PathBuf::from(p));
        }
    }
    let home = resolve_home().ok_or("无法定位用户主目录(USERPROFILE/HOME 均缺)")?;
    Ok(home.join(".qoder-cn"))
}

/// 根②：QODER_ROAMING_DIR env 覆盖 → %APPDATA%/com.qodercn.app.stable。
fn resolve_roaming_dir() -> Result<std::path::PathBuf, String> {
    if let Ok(p) = std::env::var("QODER_ROAMING_DIR") {
        if !p.is_empty() {
            return Ok(std::path::PathBuf::from(p));
        }
    }
    let appdata = if let Ok(p) = std::env::var("APPDATA") {
        if !p.is_empty() {
            std::path::PathBuf::from(p)
        } else {
            return Err("APPDATA 为空,无法定位 Electron 壳数据目录".into());
        }
    } else {
        return Err("APPDATA 未设,无法定位 Electron 壳数据目录".into());
    };
    Ok(appdata.join("com.qodercn.app.stable"))
}

/// sanity 护栏：目录必须存在且命中 ≥1 特征标记，且不得是用户主目录本身。
fn sanity_check_dir(root: &std::path::Path, markers: &[&str]) -> Result<(), String> {
    if !root.is_dir() {
        return Err(format!("目标目录不存在: {}", root.display()));
    }
    if let Some(h) = resolve_home() {
        if root == h {
            return Err("护栏拒绝：目标目录是用户主目录本身".into());
        }
    }
    let hit: Vec<&str> = markers
        .iter()
        .filter(|m| root.join(m).exists())
        .copied()
        .collect();
    if hit.is_empty() {
        return Err(format!(
            "护栏拒绝：{} 不含任何 Qoder 特征标记({:?})——疑似 env 误注入，拒绝动手",
            root.display(),
            markers
        ));
    }
    Ok(())
}

// ================== 动作清单引擎（计划与执行共用同一份判据） ==================

#[derive(Debug, Clone)]
struct QActionItem {
    /// 相对路径标签（UI/进度展示；前缀 cn/ 或 roaming/）
    path: String,
    /// manifest 恢复原路径（相对所属根,无显示前缀;仅 quarantine 类使用）
    orig: String,
    /// 隔离区内的条目名
    qname: String,
    /// delete_file | delete_dir | quarantine
    action: &'static str,
    /// 中文理由（该层为什么动/为什么属于此档,计划面透出）
    reason: String,
    full: std::path::PathBuf,
}

fn list_children_delete_items(
    root: &std::path::Path,
    dir: &str,
    prefix: &str,
    reason: &str,
    out: &mut Vec<QActionItem>,
) {
    if let Ok(rd) = std::fs::read_dir(root.join(dir)) {
        for e in rd.flatten() {
            let child = e.file_name().to_string_lossy().to_string();
            let is_dir = e.path().is_dir();
            out.push(QActionItem {
                path: format!("{prefix}{dir}/{child}"),
                orig: format!("{prefix}{dir}/{child}"),
                qname: child,
                action: if is_dir { "delete_dir" } else { "delete_file" },
                reason: reason.to_string(),
                full: e.path(),
            });
        }
    }
}

/// 维护档动作清单：根① 清空壳目录子条目 + 根② logs 子条目与 webview 缓存整删
/// + Partitions/<p>/ webview 可再生缓存子层（2026-10-11 分层扩展,登录态子目录不动）。
fn build_maintenance_items(cn: &std::path::Path, roaming: &std::path::Path) -> Vec<QActionItem> {
    let mut items = Vec::new();
    for dir in Q_MAINTENANCE_TOP_DIRS {
        list_children_delete_items(
            cn,
            dir,
            "cn/",
            "维护档:logs/tmp/编辑历史快照等可再生内容,清空即回收(目录壳保留)",
            &mut items,
        );
    }
    list_children_delete_items(
        roaming,
        "logs",
        "roaming/",
        "维护档:壳面日志,可再生,清空即回收(目录壳保留)",
        &mut items,
    );
    for name in Q_MAINTENANCE_ROAMING_DIRS {
        let dir = roaming.join(name);
        if dir.exists() {
            items.push(QActionItem {
                path: format!("roaming/{name}"),
                orig: name.to_string(),
                qname: (*name).to_string(),
                action: "delete_dir",
                reason: roaming_maintenance_reason(name).to_string(),
                full: dir,
            });
        }
    }
    // 分层扩展:Partitions/<p>/ 下 webview 可再生缓存子目录(维护档,登录态子目录不动)
    if let Ok(rd) = std::fs::read_dir(roaming.join(Q_PARTITIONS_DIR)) {
        for p in rd.flatten().filter(|e| e.path().is_dir()) {
            let part = p.file_name().to_string_lossy().to_string();
            for cache in Q_MAINTENANCE_PARTITION_CACHE_DIRS {
                let dir = p.path().join(cache);
                if dir.exists() {
                    items.push(QActionItem {
                        path: format!("roaming/Partitions/{part}/{cache}"),
                        orig: format!("Partitions/{part}/{cache}"),
                        qname: (*cache).to_string(),
                        action: "delete_dir",
                        reason: "webview 可再生缓存子目录,清理不触碰登录态(Local Storage/IndexedDB/Cookies 保留)".to_string(),
                        full: dir,
                    });
                }
            }
        }
    }
    items
}

/// 登出档动作清单：.auth + Partitions 隔离；可选设备身份两文件。
fn build_logout_items(cn: &std::path::Path, roaming: &std::path::Path, include_device_id: bool) -> Vec<QActionItem> {
    let mut items = Vec::new();
    let auth = cn.join(Q_AUTH_DIR);
    if auth.exists() {
        items.push(QActionItem {
            path: Q_AUTH_DIR.into(),
            orig: Q_AUTH_DIR.to_string(),
            qname: Q_AUTH_DIR.to_string(),
            action: "quarantine",
            reason: "登录凭据目录:隔离后 Qoder 下次启动回登录页,可从隔离区原样恢复".to_string(),
            full: auth,
        });
    }
    let partitions = roaming.join(Q_PARTITIONS_DIR);
    if partitions.exists() {
        items.push(QActionItem {
            path: Q_PARTITIONS_DIR.into(),
            orig: Q_PARTITIONS_DIR.to_string(),
            qname: Q_PARTITIONS_DIR.to_string(),
            action: "quarantine",
            reason: "webview 登录态整目录:隔离可逆,恢复即回到原登录态".to_string(),
            full: partitions,
        });
    }
    if include_device_id {
        for f in Q_DEVICE_ID_FILES {
            let p = cn.join(f);
            if p.exists() {
                items.push(QActionItem {
                    path: (*f).to_string(),
                    orig: (*f).to_string(),
                    qname: (*f).to_string(),
                    action: "quarantine",
                    reason: "设备身份文件:本地清除后 Qoder 下次启动自行重新注册,不做指纹伪造".to_string(),
                    full: p,
                });
            }
        }
    }
    items
}

/// 出厂档动作清单：两根全部顶层条目。
fn build_factory_items(cn: &std::path::Path, roaming: &std::path::Path) -> Vec<QActionItem> {
    let mut items = Vec::new();
    if let Ok(rd) = std::fs::read_dir(cn) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            items.push(QActionItem {
                path: format!("cn/{name}"),
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
            items.push(QActionItem {
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
struct QManifestEntry {
    name: String,
    original_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QQuarantineManifest {
    /// factory | logout
    mode: String,
    created_unix: u64,
    root: String,
    entries: Vec<QManifestEntry>,
}

fn is_qoder_quarantine_dir_name(name: &str) -> bool {
    let Some(suffix) = name.strip_prefix(Q_QUARANTINE_PREFIX) else {
        return false;
    };
    !suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_digit())
}

/// 建隔离区并写 manifest。
fn create_quarantine(
    root: &std::path::Path,
    mode: &str,
    entries: &[QActionItem],
) -> Result<std::path::PathBuf, String> {
    let parent = root
        .parent()
        .ok_or_else(|| format!("根目录无父目录,无法建隔离区: {}", root.display()))?;
    let mut ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 同父目录同秒创建多枚隔离区(如双根同父的夹具)时递增时间戳防相撞
    let quarantine = loop {
        let q = parent.join(format!("{Q_QUARANTINE_PREFIX}{ts}"));
        if !q.exists() {
            break q;
        }
        ts += 1;
    };
    std::fs::create_dir_all(&quarantine)
        .map_err(|e| format!("隔离区创建失败 {}: {e}", quarantine.display()))?;
    let manifest = QQuarantineManifest {
        mode: mode.to_string(),
        created_unix: ts,
        root: root.display().to_string(),
        entries: entries
            .iter()
            .map(|i| QManifestEntry { name: i.qname.clone(), original_path: i.orig.clone() })
            .collect(),
    };
    let body =
        serde_json::to_string_pretty(&manifest).map_err(|e| format!("manifest 序列化失败: {e}"))?;
    std::fs::write(quarantine.join(Q_QUARANTINE_MANIFEST), body)
        .map_err(|e| format!("manifest 写入失败: {e}"))?;
    Ok(quarantine)
}

fn q_layer_from(name: &'static str, layer: u8, errors: &[String], acted: usize, noun: &str) -> WbLayerReport {
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
    items: Vec<QActionItem>,
    layer: u8,
    name: &'static str,
    noun: &str,
    quarantine: Option<&std::path::Path>,
    progress: Option<WbProgressCb>,
) -> WbLayerReport {
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
    let _ = acted;
    q_layer_from(name, layer, &errors, items.len(), noun)
}

/// 历史台账：落在根① reset-history/（pub prune_history 复用,上限 50）。
fn write_history(cn: &std::path::Path, mode: &str, report: &WbResetReport) {
    let dir = cn.join(Q_HISTORY_DIR);
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

// ================== 层⓪ 强杀 Qoder 进程 ==================

fn kill_qoder_processes() -> WbLayerReport {
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
                    name: "kill_qoder_processes",
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
                    if is_qoder_process_image(&image) && pid != self_pid {
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
                "无运行中的 Qoder 进程".to_string()
            } else {
                format!("无进程被杀但有异常: {}", errors.join("; "))
            };
            WbLayerReport { layer: 0, name: "kill_qoder_processes", ok: errors.is_empty(), detail }
        } else {
            std::thread::sleep(std::time::Duration::from_millis(1500));
            WbLayerReport {
                layer: 0,
                name: "kill_qoder_processes",
                ok: errors.is_empty(),
                detail: format!("已强杀 {} 个 Qoder 进程: {};{}", killed.len(), killed.join(", "), errors.join("; ")),
            }
        }
    }
    #[cfg(not(windows))]
    {
        WbLayerReport {
            layer: 0,
            name: "kill_qoder_processes",
            ok: true,
            detail: "skipped(非 Windows 平台未实现进程终止)".into(),
        }
    }
}

fn q_kill_or_skip(kill_running: bool) -> WbLayerReport {
    if kill_running {
        kill_qoder_processes()
    } else {
        WbLayerReport {
            layer: 0,
            name: "kill_qoder_processes",
            ok: true,
            detail: "skipped(kill_running=false)".into(),
        }
    }
}

// ================== 三档层实现 ==================

fn layer_maintenance(cn: &std::path::Path, roaming: &std::path::Path, progress: Option<WbProgressCb>) -> WbLayerReport {
    let items = build_maintenance_items(cn, roaming);
    execute_items(items, 1, "maintenance_clean", "清理", None, progress)
}

fn layer_logout(
    cn: &std::path::Path,
    roaming: &std::path::Path,
    include_device_id: bool,
    progress: Option<WbProgressCb>,
) -> WbLayerReport {
    let cn_items: Vec<QActionItem> = build_logout_items(cn, roaming, include_device_id)
        .into_iter()
        .filter(|i| i.full.starts_with(cn))
        .collect();
    let roaming_items: Vec<QActionItem> = build_logout_items(cn, roaming, include_device_id)
        .into_iter()
        .filter(|i| i.full.starts_with(roaming))
        .collect();
    let mut errors: Vec<String> = Vec::new();
    let mut acted = 0usize;
    let mut quarantine_notes: Vec<String> = Vec::new();
    for (root, items) in [(cn, cn_items), (roaming, roaming_items)] {
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
            format!("已搬移 .auth/Partitions; 隔离区={}", quarantine_notes.join(" + "))
        };
        if include_device_id && acted > 0 {
            detail = format!(
                "{detail}; 设备身份已隔离(Qoder 下次启动自行重新注册;服务端限制不受影响)"
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

fn layer_factory(cn: &std::path::Path, roaming: &std::path::Path, progress: Option<WbProgressCb>) -> WbLayerReport {
    let cn_all = build_factory_items(cn, roaming);
    let cn_items: Vec<QActionItem> = cn_all.iter().filter(|i| i.full.starts_with(cn)).cloned().collect();
    let roaming_items: Vec<QActionItem> =
        cn_all.iter().filter(|i| i.full.starts_with(roaming)).cloned().collect();
    let mut errors: Vec<String> = Vec::new();
    let mut quarantine_notes: Vec<String> = Vec::new();
    let mut moved = 0usize;
    for (root, items) in [(cn, cn_items), (roaming, roaming_items)] {
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

pub fn qoder_maintenance_reset(
    cn: &std::path::Path,
    roaming: &std::path::Path,
    kill_running: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_dir(cn, Q_SANITY_MARKERS_CN).expect("sanity");
    sanity_check_dir(roaming, Q_SANITY_MARKERS_ROAMING).expect("sanity");
    let layers = vec![q_kill_or_skip(kill_running), layer_maintenance(cn, roaming, progress)];
    let rep = WbResetReport { layers };
    write_history(cn, "maintenance", &rep);
    rep
}

pub fn qoder_logout_reset(
    cn: &std::path::Path,
    roaming: &std::path::Path,
    kill_running: bool,
    include_device_id: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_dir(cn, Q_SANITY_MARKERS_CN).expect("sanity");
    sanity_check_dir(roaming, Q_SANITY_MARKERS_ROAMING).expect("sanity");
    let layers = vec![
        q_kill_or_skip(kill_running),
        layer_logout(cn, roaming, include_device_id, progress),
    ];
    let rep = WbResetReport { layers };
    write_history(cn, "logout", &rep);
    rep
}

pub fn qoder_factory_reset(
    cn: &std::path::Path,
    roaming: &std::path::Path,
    kill_running: bool,
    progress: Option<WbProgressCb>,
) -> WbResetReport {
    sanity_check_dir(cn, Q_SANITY_MARKERS_CN).expect("sanity");
    sanity_check_dir(roaming, Q_SANITY_MARKERS_ROAMING).expect("sanity");
    let layers = vec![q_kill_or_skip(kill_running), layer_factory(cn, roaming, progress)];
    let rep = WbResetReport { layers };
    write_history(cn, "factory", &rep);
    rep
}

// ================== 计划预览 / 探针 / 隔离区生命周期 / 历史 ==================

/// 单条计划动作（含中文理由,与执行判据同源）。
#[derive(Debug, Clone, Serialize)]
pub struct QPlanAction {
    pub path: String,
    /// delete_file | delete_dir | quarantine
    pub action: &'static str,
    pub size_mb: f64,
    pub reason: String,
}

/// 保护面条目（声明不动什么;用户资产逐条列名,2026-10-11 分层扩展）。
#[derive(Debug, Clone, Serialize)]
pub struct QProtectedAsset {
    pub path: String,
    pub reason: String,
    pub exists: bool,
}

/// 计划预览报告（执行前"会动什么/为什么/保护什么"的精确清单）。
#[derive(Debug, Clone, Serialize)]
pub struct QPlanReport {
    /// maintenance | logout | factory
    pub mode: String,
    pub include_device_id: bool,
    pub actions: Vec<QPlanAction>,
    /// 资产保护层:任何档位都不动的用户资产(出厂档仅整体隔离、可原样恢复)
    pub protected: Vec<QProtectedAsset>,
    pub total_mb: f64,
}

/// 资产保护层清单（Qoder 双根实际存在的用户资产,照 workbuddy 的 user_asset 档粒度）。
fn q_protected_assets(cn: &std::path::Path, roaming: &std::path::Path) -> Vec<QProtectedAsset> {
    let defs: [(&str, &str, bool); 5] = [
        ("cn/projects", "用户项目资产:维护/登出档不动;出厂档仅整体隔离且可原样恢复", false),
        ("cn/plugins", "已安装插件资产:维护/登出档不动;出厂档仅整体隔离且可原样恢复", false),
        ("cn/settings.json", "用户设置文件:维护/登出档不动;出厂档仅整体隔离且可原样恢复", false),
        ("cn/memory.md", "记忆文件:维护/登出档不动;出厂档仅整体隔离且可原样恢复", false),
        ("roaming/main.sqlite", "聊天记录(用户资产):维护/登出档不动;出厂档仅整体隔离且可原样恢复", true),
    ];
    defs.iter()
        .map(|(path, reason, in_roaming)| {
            let full = if *in_roaming {
                roaming.join(path.trim_start_matches("roaming/"))
            } else {
                cn.join(path.trim_start_matches("cn/"))
            };
            QProtectedAsset {
                path: (*path).to_string(),
                reason: (*reason).to_string(),
                exists: full.exists(),
            }
        })
        .collect()
}

/// 计划预览:与执行层共用 build_*_items 判据,逐层带中文理由 + 保护面自动包含。
pub fn qoder_plan(cn: &std::path::Path, roaming: &std::path::Path, mode: &str, include_device_id: bool) -> QPlanReport {
    let items = match mode {
        "logout" => build_logout_items(cn, roaming, include_device_id),
        "factory" => build_factory_items(cn, roaming),
        _ => build_maintenance_items(cn, roaming),
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
        actions.push(QPlanAction {
            path: i.path.clone(),
            action: i.action,
            size_mb: size as f64 / 1048576.0,
            reason: i.reason.clone(),
        });
    }
    actions.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    QPlanReport {
        mode: mode.to_string(),
        include_device_id,
        protected: q_protected_assets(cn, roaming),
        total_mb: total as f64 / 1048576.0,
        actions,
    }
}

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

/// 探针：两根逐条目分档 + 汇总（root 字段=两根路径拼接展示）。
pub fn qoder_probe(cn: &std::path::Path, roaming: &std::path::Path) -> WbProbeReport {
    let mut entries: Vec<WbEntry> = Vec::new();
    let mut total = 0u64;
    let mut reclaimable = 0u64;
    let mut scan_root = |root: &std::path::Path, prefix: &str, classify: fn(&str) -> &'static str| {
        if let Ok(rd) = std::fs::read_dir(root) {
            for e in rd.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                let size = dir_size_recursive(&e.path());
                total += size;
                let tier = classify(&name);
                if tier == "maintenance" || tier == "webview_logout" {
                    reclaimable += size;
                }
                entries.push(WbEntry {
                    path: format!("{prefix}{name}"),
                    tier,
                    size_mb: size as f64 / 1048576.0,
                });
            }
        }
    };
    scan_root(cn, "cn/", classify_cn_top_level);
    scan_root(roaming, "roaming/", classify_roaming_top_level);
    entries.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    WbProbeReport {
        root: format!("cn={}; roaming={}", cn.display(), roaming.display()),
        workbuddy_running: probe_qoder_running(),
        total_mb: total as f64 / 1048576.0,
        reclaimable_mb: reclaimable as f64 / 1048576.0,
        entries,
    }
}

/// 目标进程是否在运行（进程快照只读枚举,关键词 qoder）。
pub fn probe_qoder_running() -> bool {
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
                    if is_qoder_process_image(&image) {
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

/// 列出两根各自同卷的全部 Qoder 隔离区。
pub fn qoder_quarantine_list_impl(cn: &std::path::Path, roaming: &std::path::Path) -> Result<Vec<WbQuarantineInfo>, String> {
    let mut out = Vec::new();
    let mut scanned: Vec<std::path::PathBuf> = Vec::new();
    for root in [cn, roaming] {
        let parent = root
            .parent()
            .filter(|p| p.is_dir())
            .ok_or_else(|| format!("根目录父目录不存在,无法扫描隔离区: {}", root.display()))?;
        // 双根同父(如测试夹具)时只扫一次,防重复列出
        if scanned.iter().any(|p| p == parent) {
            continue;
        }
        scanned.push(parent.to_path_buf());
        let rd = std::fs::read_dir(parent).map_err(|e| format!("父目录枚举失败: {e}"))?;
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if !is_qoder_quarantine_dir_name(&name) || !e.path().is_dir() {
                continue;
            }
            let created_unix = name[Q_QUARANTINE_PREFIX.len()..].parse().unwrap_or(0);
            let mut size = 0u64;
            let mut entries = 0usize;
            let (mut mode, mut original_root) = ("unknown".to_string(), String::new());
            if let Ok(qrd) = std::fs::read_dir(e.path()) {
                for qe in qrd.flatten() {
                    if qe.file_name().to_string_lossy() == Q_QUARANTINE_MANIFEST {
                        continue;
                    }
                    entries += 1;
                    size += dir_size_recursive(&qe.path());
                }
            }
            if let Ok(body) = std::fs::read_to_string(e.path().join(Q_QUARANTINE_MANIFEST)) {
                if let Ok(m) = serde_json::from_str::<QQuarantineManifest>(&body) {
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
    }
    out.sort_by(|a, b| b.created_unix.cmp(&a.created_unix));
    Ok(out)
}

/// 从隔离区恢复：按 manifest 原样搬回；目标已存在拒绝覆盖；搬空清壳。
pub fn qoder_quarantine_restore_impl(quarantine: &std::path::Path) -> WbResetReport {
    let name = quarantine
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let fail = |detail: String| WbResetReport {
        layers: vec![WbLayerReport { layer: 4, name: "quarantine_restore", ok: false, detail }],
    };
    if !is_qoder_quarantine_dir_name(&name) {
        return fail(format!("护栏拒绝：{name} 不是 Qoder 隔离区目录名({Q_QUARANTINE_PREFIX}<时间戳>)"));
    }
    if !quarantine.is_dir() {
        return fail(format!("隔离区不存在: {}", quarantine.display()));
    }
    let body = match std::fs::read_to_string(quarantine.join(Q_QUARANTINE_MANIFEST)) {
        Ok(b) => b,
        Err(e) => return fail(format!("manifest 读取失败: {e}")),
    };
    let manifest: QQuarantineManifest = match serde_json::from_str(&body) {
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
            continue;
        }
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
    let mut leftover = false;
    if let Ok(rd) = std::fs::read_dir(quarantine) {
        leftover = rd.flatten().any(|e| e.file_name().to_string_lossy() != Q_QUARANTINE_MANIFEST);
    }
    if !leftover {
        let _ = std::fs::remove_dir_all(quarantine);
    }
    WbResetReport {
        layers: vec![q_layer_from("quarantine_restore", 4, &errors, acted, "恢复")],
    }
}

/// 删除隔离区（护栏：目录名格式 + 父目录必须匹配两根之一的父目录）。
pub fn qoder_quarantine_delete_impl(
    quarantine: &std::path::Path,
    expected_parents: &[std::path::PathBuf],
) -> WbResetReport {
    let name = quarantine
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let fail = |detail: String| WbResetReport {
        layers: vec![WbLayerReport { layer: 5, name: "quarantine_delete", ok: false, detail }],
    };
    if !is_qoder_quarantine_dir_name(&name) {
        return fail(format!("护栏拒绝：{name} 不是 Qoder 隔离区目录名({Q_QUARANTINE_PREFIX}<时间戳>)"));
    }
    let ok_parent = quarantine
        .parent()
        .map(|p| expected_parents.iter().any(|e| e.as_path() == p))
        .unwrap_or(false);
    if !ok_parent {
        return fail("护栏拒绝：隔离区不在 Qoder 两根的父目录之下".into());
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

/// 读取历史台账（根① reset-history/*.json，按时间倒序）。
pub fn qoder_read_history(cn: &std::path::Path) -> Vec<WbHistoryItem> {
    let mut out = Vec::new();
    let Ok(rd) = std::fs::read_dir(cn.join(Q_HISTORY_DIR)) else {
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

// ================== tauri 薄胶水（只转发,不含判定） ==================

use tauri::ipc::Channel;

fn q_progress_channel(on_progress: Channel<WbProgressEvent>) -> impl Fn(WbProgressEvent) + Send + Sync {
    move |ev: WbProgressEvent| {
        let _ = on_progress.send(ev);
    }
}

fn q_resolve_both() -> Result<(std::path::PathBuf, std::path::PathBuf), IpcError> {
    let cn = resolve_cn_dir().map_err(|e| IpcError::internal(e))?;
    let roaming = resolve_roaming_dir().map_err(|e| IpcError::internal(e))?;
    Ok((cn, roaming))
}

fn q_sanity_both(cn: &std::path::Path, roaming: &std::path::Path) -> Result<(), IpcError> {
    sanity_check_dir(cn, Q_SANITY_MARKERS_CN).map_err(|e| IpcError::permission(e))?;
    sanity_check_dir(roaming, Q_SANITY_MARKERS_ROAMING).map_err(|e| IpcError::permission(e))?;
    Ok(())
}

#[tauri::command(async)]
pub async fn qoder_reset_probe() -> Result<WbProbeReport, IpcError> {
    let (cn, roaming) = q_resolve_both()?;
    q_sanity_both(&cn, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || qoder_probe(&cn, &roaming))
        .await
        .map_err(|e| IpcError::internal(format!("Qoder 探针任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn qoder_reset_plan(
    mode: String,
    include_device_id: bool,
) -> Result<QPlanReport, IpcError> {
    q_reset_gate().map_err(IpcError::permission)?;
    let (cn, roaming) = q_resolve_both()?;
    q_sanity_both(&cn, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || {
        qoder_plan(&cn, &roaming, &mode, include_device_id)
    })
    .await
    .map_err(|e| IpcError::internal(format!("Qoder 计划预览任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn qoder_reset_maintenance(
    kill_running: bool,
    on_progress: Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    q_reset_gate().map_err(IpcError::permission)?;
    let (cn, roaming) = q_resolve_both()?;
    q_sanity_both(&cn, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || {
        let cb = q_progress_channel(on_progress);
        qoder_maintenance_reset(&cn, &roaming, kill_running, Some(&cb))
    })
    .await
    .map_err(|e| IpcError::internal(format!("Qoder 维护清理任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn qoder_reset_logout(
    kill_running: bool,
    include_device_id: bool,
    on_progress: Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    q_reset_gate().map_err(IpcError::permission)?;
    let (cn, roaming) = q_resolve_both()?;
    q_sanity_both(&cn, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || {
        let cb = q_progress_channel(on_progress);
        qoder_logout_reset(&cn, &roaming, kill_running, include_device_id, Some(&cb))
    })
    .await
    .map_err(|e| IpcError::internal(format!("Qoder 登出重置任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn qoder_reset_factory(
    kill_running: bool,
    on_progress: Channel<WbProgressEvent>,
) -> Result<WbResetReport, IpcError> {
    q_reset_gate().map_err(IpcError::permission)?;
    let (cn, roaming) = q_resolve_both()?;
    q_sanity_both(&cn, &roaming)?;
    tauri::async_runtime::spawn_blocking(move || {
        let cb = q_progress_channel(on_progress);
        qoder_factory_reset(&cn, &roaming, kill_running, Some(&cb))
    })
    .await
    .map_err(|e| IpcError::internal(format!("Qoder 出厂重置任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn qoder_quarantine_list() -> Result<Vec<WbQuarantineInfo>, IpcError> {
    let (cn, roaming) = q_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || qoder_quarantine_list_impl(&cn, &roaming))
        .await
        .map_err(|e| IpcError::internal(format!("Qoder 隔离区扫描任务异常退出: {e}")))?
        .map_err(|e| IpcError::internal(e))
}

#[tauri::command(async)]
pub async fn qoder_quarantine_restore(
    quarantine_path: String,
) -> Result<WbResetReport, IpcError> {
    tauri::async_runtime::spawn_blocking(move || {
        qoder_quarantine_restore_impl(&std::path::PathBuf::from(&quarantine_path))
    })
    .await
    .map_err(|e| IpcError::internal(format!("Qoder 恢复任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn qoder_quarantine_delete(
    quarantine_path: String,
) -> Result<WbResetReport, IpcError> {
    let (cn, roaming) = q_resolve_both()?;
    let parents = [
        cn.parent().map(|p| p.to_path_buf()),
        roaming.parent().map(|p| p.to_path_buf()),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    tauri::async_runtime::spawn_blocking(move || {
        qoder_quarantine_delete_impl(&std::path::PathBuf::from(&quarantine_path), &parents)
    })
    .await
    .map_err(|e| IpcError::internal(format!("Qoder 删除任务异常退出: {e}")))
}

#[tauri::command(async)]
pub async fn qoder_reset_history() -> Result<Vec<WbHistoryItem>, IpcError> {
    let (cn, _) = q_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || qoder_read_history(&cn))
        .await
        .map_err(|e| IpcError::internal(format!("Qoder 历史读取任务异常退出: {e}")))
}

// ================== 残留审计（只读清点,镜像 TRAE checkinAuditTraeResidual 思路） ==================

/// 单条残留审计条目:只报存在与路径,不读内容、不删除任何东西。
#[derive(Debug, Clone, Serialize)]
pub struct QResidualEntry {
    /// 所属根:cn(~/.qoder-cn) | roaming(%APPDATA%/com.qodercn.app.stable)
    pub root: &'static str,
    /// 相对所属根的路径
    pub path: String,
    /// auth_credential | machine_id | device_identity | runtime_info | local_state | chat_db | webview_login
    pub kind: &'static str,
    pub exists: bool,
    /// 文件字节数(目录或不存在=None)
    pub size: Option<u64>,
}

/// Qoder 残留审计报告(签到/登录残留只读清点)。
#[derive(Debug, Clone, Serialize)]
pub struct QResidualAuditReport {
    pub cn_root: String,
    pub roaming_root: String,
    pub entries: Vec<QResidualEntry>,
    /// 在场条目数
    pub present: usize,
    pub message: String,
}

fn push_audit_entry(
    entries: &mut Vec<QResidualEntry>,
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
    entries.push(QResidualEntry { root, path: rel.to_string(), kind, exists, size });
}

/// 残留审计主流程(纯同步,可单测;坐标来自 2026-10-10 只读侦察与签到捕获实装):
/// 根① .auth(凭据+machine_id)、installation_id、umid-cache.json(runtime-info 产物);
/// 根② auth.v1.dat(登录凭据)、auth.machine-id、Local State(AES 密钥面)、
/// main.sqlite(聊天记录)、Partitions(webview 登录态)。
pub fn qoder_audit_residual_impl(
    cn: &std::path::Path,
    roaming: &std::path::Path,
) -> QResidualAuditReport {
    let mut entries: Vec<QResidualEntry> = Vec::new();
    push_audit_entry(&mut entries, "cn", ".auth", &cn.join(Q_AUTH_DIR), "auth_credential");
    push_audit_entry(
        &mut entries,
        "cn",
        ".auth/machine_id",
        &cn.join(Q_AUTH_DIR).join("machine_id"),
        "machine_id",
    );
    push_audit_entry(&mut entries, "cn", "installation_id", &cn.join("installation_id"), "device_identity");
    push_audit_entry(&mut entries, "cn", "umid-cache.json", &cn.join("umid-cache.json"), "runtime_info");
    push_audit_entry(&mut entries, "roaming", "auth.v1.dat", &roaming.join("auth.v1.dat"), "auth_credential");
    push_audit_entry(&mut entries, "roaming", "auth.machine-id", &roaming.join("auth.machine-id"), "machine_id");
    push_audit_entry(&mut entries, "roaming", "Local State", &roaming.join("Local State"), "local_state");
    push_audit_entry(&mut entries, "roaming", "main.sqlite", &roaming.join("main.sqlite"), "chat_db");
    push_audit_entry(&mut entries, "roaming", "Partitions", &roaming.join(Q_PARTITIONS_DIR), "webview_login");
    let present = entries.iter().filter(|e| e.exists).count();
    let missing = entries.len() - present;
    QResidualAuditReport {
        cn_root: cn.display().to_string(),
        roaming_root: roaming.display().to_string(),
        present,
        message: format!(
            "只读清点 Qoder 双根 {} 类签到/登录残留坐标:在场 {} 项、缺席 {} 项(只报存在与路径,不读内容、不删除任何东西)",
            entries.len(),
            present,
            missing
        ),
        entries,
    }
}

/// 残留审计命令:双根只读扫描,不做任何写入(重置面之外的独立取证口)。
#[tauri::command(async)]
pub async fn checkin_audit_qoder_residual() -> Result<QResidualAuditReport, IpcError> {
    let (cn, roaming) = q_resolve_both()?;
    tauri::async_runtime::spawn_blocking(move || qoder_audit_residual_impl(&cn, &roaming))
        .await
        .map_err(|e| IpcError::internal(format!("Qoder 残留审计任务异常退出: {e}")))
}

// ================== 测试（临时夹具,绝不触碰真实 ~/.qoder-cn） ==================

#[cfg(test)]
mod tests {
    use super::*;

    /// 独立容器夹具：temp/<tag>-<nanos>/{cn,roaming} —— 双根各自带 sanity 特征标记。
    fn fixture_roots(tag: &str) -> (std::path::PathBuf, std::path::PathBuf) {
        let container = std::env::temp_dir().join(format!(
            "qoder-reset-test-{tag}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let cn = container.join("cn");
        let roaming = container.join("roaming");
        // 根①:agent 核心面
        std::fs::create_dir_all(cn.join("logs/20261010")).unwrap();
        std::fs::write(cn.join("logs/20261010/main.log"), "log").unwrap();
        std::fs::create_dir_all(cn.join("file-history/fh1")).unwrap();
        std::fs::write(cn.join("file-history/fh1/v1"), "h").unwrap();
        std::fs::create_dir_all(cn.join("tmp/x")).unwrap();
        std::fs::write(cn.join("tmp/x/t"), "t").unwrap();
        std::fs::create_dir_all(cn.join(".auth")).unwrap();
        std::fs::write(cn.join(".auth/machine_id"), "0123456789abcdef0123456789abcdef0123").unwrap();
        std::fs::write(cn.join("installation_id"), "4e1d76a5-cf6e-426d-bd07-f7fd94ae3f7d").unwrap();
        std::fs::write(cn.join("umid-cache.json"), "{}").unwrap();
        std::fs::write(cn.join("settings.json"), "{}").unwrap();
        std::fs::create_dir_all(cn.join("projects/demo")).unwrap();
        std::fs::write(cn.join("projects/demo/f.txt"), "w").unwrap();
        std::fs::write(cn.join("memory.md"), "# m").unwrap();
        // 根②:Electron 壳面
        std::fs::create_dir_all(roaming.join("logs")).unwrap();
        std::fs::write(roaming.join("logs/a.log"), "l").unwrap();
        std::fs::create_dir_all(roaming.join("Cache/js")).unwrap();
        std::fs::write(roaming.join("Cache/js/x"), "c").unwrap();
        std::fs::create_dir_all(roaming.join("Partitions/p1/Local Storage")).unwrap();
        std::fs::write(roaming.join("Partitions/p1/Local Storage/m"), "ls").unwrap();
        std::fs::create_dir_all(roaming.join("Partitions/p1/Cache/js")).unwrap();
        std::fs::write(roaming.join("Partitions/p1/Cache/js/x"), "c").unwrap();
        std::fs::create_dir_all(roaming.join("Partitions/p1/DawnWebGPUCache")).unwrap();
        std::fs::write(roaming.join("Partitions/p1/DawnWebGPUCache/g"), "g").unwrap();
        std::fs::create_dir_all(roaming.join("Crashpad/reports")).unwrap();
        std::fs::write(roaming.join("Crashpad/reports/a.dmp"), "d").unwrap();
        std::fs::write(roaming.join("Local State"), "{}").unwrap();
        std::fs::write(roaming.join("main.sqlite"), "db").unwrap();
        (cn, roaming)
    }

    fn cleanup(cn: &std::path::Path, roaming: &std::path::Path) {
        if let Some(c) = cn.parent() {
            let _ = std::fs::remove_dir_all(c);
        }
        if let Some(c) = roaming.parent() {
            if Some(c) != cn.parent() {
                let _ = std::fs::remove_dir_all(c);
            }
        }
    }

    fn find_quarantines(cn: &std::path::Path, roaming: &std::path::Path) -> Vec<std::path::PathBuf> {
        let mut out = Vec::new();
        let mut scanned: Vec<std::path::PathBuf> = Vec::new();
        for root in [cn, roaming] {
            let parent = root.parent().unwrap();
            if scanned.iter().any(|p| p == parent) {
                continue;
            }
            scanned.push(parent.to_path_buf());
            if let Ok(rd) = std::fs::read_dir(parent) {
                for e in rd.flatten() {
                    if is_qoder_quarantine_dir_name(&e.file_name().to_string_lossy()) {
                        out.push(e.path());
                    }
                }
            }
        }
        out
    }

    #[test]
    fn classify_slots_are_stable() {
        assert_eq!(classify_cn_top_level("logs"), "maintenance");
        assert_eq!(classify_cn_top_level("file-history"), "maintenance");
        assert_eq!(classify_cn_top_level(".cache"), "maintenance");
        assert_eq!(classify_cn_top_level(".auth"), "webview_logout");
        assert_eq!(classify_cn_top_level("installation_id"), "device_identity");
        assert_eq!(classify_cn_top_level("umid-cache.json"), "device_identity");
        assert_eq!(classify_cn_top_level("projects"), "user_asset");
        assert_eq!(classify_roaming_top_level("Partitions"), "webview_logout");
        assert_eq!(classify_roaming_top_level("Cache"), "maintenance");
        assert_eq!(classify_roaming_top_level("main.sqlite"), "user_asset");
        // 进程映像判据
        assert!(is_qoder_process_image("Qoder CN.exe"));
        assert!(is_qoder_process_image("qoder-cli"));
        assert!(!is_qoder_process_image("WorkBuddy.exe"));
        assert!(!is_qoder_process_image("Trae CN.exe"));
        assert!(!is_qoder_process_image("explorer.exe"));
        // 隔离目录名判据
        assert!(is_qoder_quarantine_dir_name(".qoder-quarantine-1728537600"));
        assert!(!is_qoder_quarantine_dir_name(".qoder-quarantine-"));
        assert!(!is_qoder_quarantine_dir_name(".workbuddy-quarantine-123"));
    }

    #[test]
    fn sanity_guards_reject_foreign_dirs() {
        let foreign = std::env::temp_dir().join("qoder-reset-guard-empty");
        std::fs::create_dir_all(&foreign).unwrap();
        assert!(sanity_check_dir(&foreign, Q_SANITY_MARKERS_CN).is_err(), "无特征标记必须拒");
        let (cn, roaming) = fixture_roots("guard");
        assert!(sanity_check_dir(&cn, Q_SANITY_MARKERS_CN).is_ok());
        assert!(sanity_check_dir(&roaming, Q_SANITY_MARKERS_ROAMING).is_ok());
        cleanup(&cn, &roaming);
    }

    #[test]
    fn maintenance_keeps_auth_and_assets_clears_caches() {
        let (cn, roaming) = fixture_roots("maint");
        let rep = qoder_maintenance_reset(&cn, &roaming, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        // 缓存/日志/编辑历史被清
        assert!(!cn.join("logs/20261010").exists());
        assert!(!cn.join("file-history/fh1").exists());
        assert!(!cn.join("tmp/x").exists());
        assert!(!roaming.join("Cache").exists());
        assert!(!roaming.join("logs/a.log").exists());
        // 登录态/聊天记录/项目/设备身份原封不动
        assert!(cn.join(".auth/machine_id").exists(), "登录态不得被动");
        assert!(cn.join("installation_id").exists());
        assert!(roaming.join("main.sqlite").exists(), "聊天记录不得被动");
        assert!(cn.join("projects/demo/f.txt").exists());
        assert!(roaming.join("Partitions/p1/Local Storage/m").exists());
        // 历史台账落档
        let h = qoder_read_history(&cn);
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].mode, "maintenance");
        cleanup(&cn, &roaming);
    }

    #[test]
    fn maintenance_progress_events_monotonic() {
        let (cn, roaming) = fixture_roots("progress");
        use std::sync::{Arc, Mutex};
        let events: Arc<Mutex<Vec<WbProgressEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let sink = events.clone();
        let cb = move |ev: WbProgressEvent| {
            sink.lock().unwrap().push(ev);
        };
        let rep = qoder_maintenance_reset(&cn, &roaming, false, Some(&cb));
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        let got = events.lock().unwrap();
        assert!(!got.is_empty());
        assert_eq!(got[0].layer, 1);
        assert!(got[0].total >= 2);
        for w in got.windows(2) {
            assert_eq!(w[1].done, w[0].done + 1);
        }
        assert_eq!(got.last().unwrap().done, got[0].total);
        cleanup(&cn, &roaming);
    }

    #[test]
    fn logout_quarantines_auth_and_partitions_then_restores() {
        let (cn, roaming) = fixture_roots("logout");
        let rep = qoder_logout_reset(&cn, &roaming, false, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!cn.join(".auth").exists(), ".auth 必须已搬离");
        assert!(!roaming.join("Partitions").exists(), "Partitions 必须已搬离");
        assert!(cn.join("installation_id").exists(), "未勾选时设备身份必须保留");
        assert!(roaming.join("main.sqlite").exists());
        // 两个隔离区(manifest 记录各自根)
        let qs = find_quarantines(&cn, &roaming);
        assert_eq!(qs.len(), 2, "双根各一隔离区");
        for q in &qs {
            let body = std::fs::read_to_string(q.join(Q_QUARANTINE_MANIFEST)).unwrap();
            let m: QQuarantineManifest = serde_json::from_str(&body).unwrap();
            assert_eq!(m.mode, "logout");
            assert_eq!(m.entries.len(), 1);
        }
        // 一键恢复:两个隔离区都搬回
        for q in &qs {
            let rrep = qoder_quarantine_restore_impl(q);
            assert!(rrep.layers.iter().all(|l| l.ok), "{:?}", rrep.layers);
        }
        assert!(cn.join(".auth/machine_id").exists());
        assert_eq!(
            std::fs::read_to_string(cn.join(".auth/machine_id")).unwrap(),
            "0123456789abcdef0123456789abcdef0123",
            "machine_id 必须逐字节恢复"
        );
        assert!(roaming.join("Partitions/p1/Local Storage/m").exists());
        cleanup(&cn, &roaming);
    }

    #[test]
    fn logout_with_device_id_restores_all() {
        let (cn, roaming) = fixture_roots("logout-dev");
        let rep = qoder_logout_reset(&cn, &roaming, false, true, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!cn.join("installation_id").exists());
        assert!(!cn.join("umid-cache.json").exists());
        assert!(rep.layers.last().unwrap().detail.contains("设备身份"));
        let qs = find_quarantines(&cn, &roaming);
        assert_eq!(qs.len(), 2);
        for q in &qs {
            let rrep = qoder_quarantine_restore_impl(q);
            assert!(rrep.layers.iter().all(|l| l.ok), "{:?}", rrep.layers);
        }
        assert!(cn.join("installation_id").exists());
        assert!(cn.join("umid-cache.json").exists());
        assert!(cn.join(".auth/machine_id").exists());
        cleanup(&cn, &roaming);
    }

    #[test]
    fn restore_rejects_existing_target_without_overwrite() {
        let (cn, roaming) = fixture_roots("restore-conflict");
        let _ = qoder_logout_reset(&cn, &roaming, false, false, None);
        let qs = find_quarantines(&cn, &roaming);
        // 预先占位 .auth 目标
        std::fs::create_dir_all(cn.join(".auth")).unwrap();
        std::fs::write(cn.join(".auth/sentinel"), "keep").unwrap();
        let cn_q = qs
            .iter()
            .find(|q| q.parent().map(|p| p == cn.parent().unwrap()).unwrap_or(false))
            .unwrap();
        let rrep = qoder_quarantine_restore_impl(cn_q);
        assert!(!rrep.layers[0].ok, "目标已存在必须拒绝");
        assert!(rrep.layers[0].detail.contains("拒绝覆盖"));
        assert_eq!(std::fs::read_to_string(cn.join(".auth/sentinel")).unwrap(), "keep");
        cleanup(&cn, &roaming);
    }

    #[test]
    fn quarantine_list_reports_both_roots() {
        let (cn, roaming) = fixture_roots("qlist");
        let _ = qoder_logout_reset(&cn, &roaming, false, false, None);
        let list = qoder_quarantine_list_impl(&cn, &roaming).unwrap();
        assert_eq!(list.len(), 2, "双根各一隔离区");
        assert!(list.iter().all(|i| i.mode == "logout"));
        assert!(list.iter().all(|i| i.entries == 1));
        assert!(list.iter().all(|i| i.created_unix > 0));
        cleanup(&cn, &roaming);
    }

    #[test]
    fn quarantine_delete_has_hard_guards() {
        let (cn, roaming) = fixture_roots("qdel");
        // 名字护栏
        let bogus = cn.parent().unwrap().join("not-quarantine");
        std::fs::create_dir_all(&bogus).unwrap();
        std::fs::write(bogus.join("x"), "y").unwrap();
        let rep = qoder_quarantine_delete_impl(&bogus, &[cn.parent().unwrap().to_path_buf()]);
        assert!(!rep.layers[0].ok);
        assert!(bogus.exists());
        let _ = std::fs::remove_dir_all(&bogus);
        // 父目录护栏:不在两根父目录之下
        let _ = qoder_logout_reset(&cn, &roaming, false, false, None);
        let qs = find_quarantines(&cn, &roaming);
        assert_eq!(qs.len(), 2);
        let far = std::env::temp_dir().join(format!(
            "qoder-other-parent-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&far).unwrap();
        let rep2 = qoder_quarantine_delete_impl(&qs[0], &[far.clone()]);
        assert!(!rep2.layers[0].ok, "父目录不匹配必须拒");
        assert!(qs[0].exists());
        // 正名+对父 → 删除
        let parents = vec![cn.parent().unwrap().to_path_buf(), roaming.parent().unwrap().to_path_buf()];
        for q in &qs {
            let rep3 = qoder_quarantine_delete_impl(q, &parents);
            assert!(rep3.layers[0].ok);
            assert!(!q.exists());
        }
        cleanup(&cn, &roaming);
        let _ = std::fs::remove_dir_all(&far);
    }

    #[test]
    fn plan_reports_actions_without_executing() {
        let (cn, roaming) = fixture_roots("plan");
        let p = qoder_plan(&cn, &roaming, "maintenance", false);
        assert!(p.actions.iter().any(|a| a.path.starts_with("cn/logs/") && a.action == "delete_dir"));
        assert!(p.actions.iter().any(|a| a.path == "roaming/logs/a.log" && a.action == "delete_file"));
        assert!(p.actions.iter().any(|a| a.path.starts_with("cn/file-history/")));
        assert!(p.actions.iter().any(|a| a.path == "roaming/Cache" && a.action == "delete_dir"));
        assert!(p.total_mb > 0.0);
        assert!(cn.join("logs/20261010/main.log").exists(), "计划绝不能执行");
        let pl = qoder_plan(&cn, &roaming, "logout", false);
        assert!(pl.actions.iter().any(|a| a.path == ".auth" && a.action == "quarantine"));
        assert!(pl.actions.iter().any(|a| a.path == "Partitions" && a.action == "quarantine"));
        assert!(!pl.actions.iter().any(|a| a.path == "installation_id"));
        let pld = qoder_plan(&cn, &roaming, "logout", true);
        assert!(pld.actions.iter().any(|a| a.path == "installation_id"));
        assert!(pld.actions.iter().any(|a| a.path == "umid-cache.json"));
        let pf = qoder_plan(&cn, &roaming, "factory", false);
        assert_eq!(
            pf.actions.len(),
            std::fs::read_dir(&cn).unwrap().count() + std::fs::read_dir(&roaming).unwrap().count()
        );
        assert!(pf.actions.iter().all(|a| a.action == "quarantine"));
        cleanup(&cn, &roaming);
    }

    #[test]
    fn factory_moves_both_roots_to_quarantine_and_restores() {
        let (cn, roaming) = fixture_roots("factory");
        let rep = qoder_factory_reset(&cn, &roaming, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(cn.is_dir() && roaming.is_dir(), "两根壳必须保留");
        // 根①唯一遗留=历史台账;根②全空
        let cn_left: Vec<String> = std::fs::read_dir(&cn)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(cn_left, vec![Q_HISTORY_DIR.to_string()]);
        assert_eq!(std::fs::read_dir(&roaming).unwrap().count(), 0);
        // 双隔离区 → 一键恢复两根
        let qs = find_quarantines(&cn, &roaming);
        assert_eq!(qs.len(), 2);
        for q in &qs {
            let rrep = qoder_quarantine_restore_impl(q);
            assert!(rrep.layers.iter().all(|l| l.ok), "{:?}", rrep.layers);
        }
        assert!(cn.join(".auth/machine_id").exists());
        assert!(cn.join("projects/demo/f.txt").exists());
        assert!(roaming.join("main.sqlite").exists());
        assert!(roaming.join("Partitions/p1/Local Storage/m").exists());
        cleanup(&cn, &roaming);
    }

    #[test]
    fn probe_reports_both_roots_and_reclaimable() {
        let (cn, roaming) = fixture_roots("probe");
        let rep = qoder_probe(&cn, &roaming);
        assert!(rep.total_mb > 0.0);
        assert!(rep.reclaimable_mb > 0.0);
        assert!(rep.root.contains("cn=") && rep.root.contains("roaming="));
        let has_logs = rep.entries.iter().any(|e| e.path == "cn/logs" && e.tier == "maintenance");
        let has_auth = rep.entries.iter().any(|e| e.path == "cn/.auth" && e.tier == "webview_logout");
        let has_partitions =
            rep.entries.iter().any(|e| e.path == "roaming/Partitions" && e.tier == "webview_logout");
        let has_db = rep
            .entries
            .iter()
            .any(|e| e.path == "roaming/main.sqlite" && e.tier == "user_asset");
        assert!(has_logs && has_auth && has_partitions && has_db, "{:?}", rep.entries);
        cleanup(&cn, &roaming);
    }

    #[test]
    fn history_prune_applies_to_qoder_ledger() {
        let (cn, roaming) = fixture_roots("qprune");
        let dir = cn.join(Q_HISTORY_DIR);
        std::fs::create_dir_all(&dir).unwrap();
        for i in 0..55u64 {
            std::fs::write(dir.join(format!("{i:010}-maintenance.json")), "{}").unwrap();
        }
        assert_eq!(prune_history(&dir, 50), 5);
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 50);
        cleanup(&cn, &roaming);
    }

    #[test]
    fn env_escape_gate_blocks_plan_and_reset() {
        // 未置位 / 置 0 / 空值 → 放行
        assert!(q_reset_gate_with(|_| None).is_ok());
        assert!(q_reset_gate_with(|_| Some("0".into())).is_ok());
        assert!(q_reset_gate_with(|_| Some(String::new())).is_ok());
        // 置位 → 拦截且原因点名变量
        let err = q_reset_gate_with(|_| Some("1".into())).unwrap_err();
        assert!(err.contains(Q_RESET_DISABLE_ENV), "{err}");
        assert!(err.contains("拦截"));
        assert!(
            q_reset_gate_with(|_| Some(" 1 ".into())).is_err(),
            "空白包裹值同样视作置位"
        );
        // 真实读取路径:测试进程未设该变量 → 放行
        assert!(q_reset_gate().is_ok());
    }

    #[test]
    fn audit_reports_present_and_missing_without_reading() {
        let (cn, roaming) = fixture_roots("audit");
        let rep = qoder_audit_residual_impl(&cn, &roaming);
        let find =
            |p: &str| rep.entries.iter().find(|e| e.path == p).unwrap_or_else(|| panic!("缺条目 {p}"));
        // 在场类(目录只报存在不报 size)
        let auth = find(".auth");
        assert!(
            auth.exists && auth.root == "cn" && auth.kind == "auth_credential" && auth.size.is_none(),
            "{:?}",
            auth
        );
        let mid = find(".auth/machine_id");
        assert!(mid.exists && mid.kind == "machine_id" && mid.size == Some(36), "{:?}", mid);
        let inst = find("installation_id");
        assert!(inst.exists && inst.kind == "device_identity" && inst.size.is_some());
        let umid = find("umid-cache.json");
        assert!(umid.exists && umid.kind == "runtime_info", "umid-cache=runtime-info 产物");
        let state = find("Local State");
        assert!(state.exists && state.root == "roaming" && state.kind == "local_state");
        let db = find("main.sqlite");
        assert!(db.exists && db.kind == "chat_db");
        let parts = find("Partitions");
        assert!(parts.exists && parts.kind == "webview_login");
        // 缺席类(夹具不含 auth.v1.dat / auth.machine-id)
        let av = find("auth.v1.dat");
        assert!(!av.exists && av.size.is_none() && av.root == "roaming");
        assert!(!find("auth.machine-id").exists);
        assert_eq!(rep.present, rep.entries.iter().filter(|e| e.exists).count());
        assert!(rep.present > 0);
        assert!(rep.message.contains("只读"));
        assert!(rep.cn_root.ends_with("cn") && rep.roaming_root.ends_with("roaming"));
        // 审计绝不写入:跑前后条目都在原位
        assert!(cn.join(".auth/machine_id").exists() && roaming.join("main.sqlite").exists());
        cleanup(&cn, &roaming);
    }

    #[test]
    fn audit_all_missing_on_empty_roots() {
        let base = std::env::temp_dir().join(format!(
            "qoder-audit-empty-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let cn = base.join("cn");
        let roaming = base.join("roaming");
        std::fs::create_dir_all(&cn).unwrap();
        std::fs::create_dir_all(&roaming).unwrap();
        let rep = qoder_audit_residual_impl(&cn, &roaming);
        assert_eq!(rep.present, 0, "空根必须全缺席");
        assert!(rep.entries.iter().all(|e| !e.exists && e.size.is_none()));
        assert_eq!(rep.entries.len(), 9);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn plan_includes_extended_layers_and_factory_covers_them() {
        let (cn, roaming) = fixture_roots("plan-ext");
        let p = qoder_plan(&cn, &roaming, "maintenance", false);
        // 新层①:根②整删扩充(Crashpad 等)带中文理由
        assert!(
            p.actions
                .iter()
                .any(|a| a.path == "roaming/Crashpad" && a.action == "delete_dir" && a.reason.contains("崩溃转储")),
            "{:?}",
            p.actions
        );
        // 新层②:Partitions/<p>/ webview 缓存子层(维护档,登录态子目录不动)
        assert!(p.actions.iter().any(|a| a.path == "roaming/Partitions/p1/Cache" && a.action == "delete_dir"));
        assert!(
            p.actions
                .iter()
                .any(|a| a.path == "roaming/Partitions/p1/DawnWebGPUCache" && a.action == "delete_dir")
        );
        // 每层都有中文理由
        assert!(p.actions.iter().all(|a| !a.reason.is_empty()));
        // 危险层不得出现在维护计划
        for danger in [".auth", "Partitions", "installation_id", "umid-cache.json"] {
            assert!(
                !p.actions.iter().any(|a| a.path == danger),
                "维护计划不得含危险层 {danger}"
            );
        }
        // 保护面:用户资产逐条列名+理由
        assert!(p.protected.iter().any(|x| x.path == "cn/projects" && x.exists && !x.reason.is_empty()));
        assert!(p.protected.iter().any(|x| x.path == "roaming/main.sqlite" && x.exists));
        // 出厂档覆盖新层所在顶层条目(整体隔离,子层被连带覆盖)
        let pf = qoder_plan(&cn, &roaming, "factory", false);
        assert!(pf.actions.iter().any(|a| a.path == "roaming/Partitions" && a.action == "quarantine"));
        assert!(pf.actions.iter().any(|a| a.path == "roaming/Crashpad" && a.action == "quarantine"));
        // 计划绝不执行
        assert!(roaming.join("Partitions/p1/Cache/js/x").exists());
        // 执行档验证:维护清掉 webview 缓存子层与 Crashpad,登录态子目录保留
        let rep = qoder_maintenance_reset(&cn, &roaming, false, None);
        assert!(rep.layers.iter().all(|l| l.ok), "{:?}", rep.layers);
        assert!(!roaming.join("Partitions/p1/Cache").exists());
        assert!(!roaming.join("Partitions/p1/DawnWebGPUCache").exists());
        assert!(!roaming.join("Crashpad").exists());
        assert!(roaming.join("Partitions/p1/Local Storage/m").exists(), "登录态子目录必须保留");
        assert!(roaming.join("Local State").exists(), "Local State 属登录面,维护不动");
        cleanup(&cn, &roaming);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
