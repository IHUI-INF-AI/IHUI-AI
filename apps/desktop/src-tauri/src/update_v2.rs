// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 稳定 Launcher 的壳侧更新链（Windows 优先）。
//!
//! 原则：运行中的版本一个字节都不碰。
//! 1. 读 feed v2（兼容旧 Tauri feed）→ 灰度/撤版/回退/minSupported 判定
//! 2. 后台下载 zip 到 `updates/`，流式 sha256；minisign 验签（签名覆盖整包）
//! 3. 解压到 `versions/<ver>.tmp-*`，逐文件比对 manifest sha256/大小 → 原子改名
//! 4. 只写 `state.pending` + `update-ready.json`，发 `update-v2` 事件
//! 5. 前端常驻胶囊点“立即重启” → 壳 flush 后退出码 42 → Launcher 切指针并重启
//!
//! 这里不弹进度窗、不调安装器、不 `std::process::exit` 逼用户退出。

use fs2::FileExt;
use ihui_launcher::feed::{self, Evaluation, Feed, Verdict};
use ihui_launcher::state::{app_exe, now_secs, version_dir, State};
use minisign_verify::{PublicKey, Signature};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

/// 与 tauri.conf.json `plugins.updater.pubkey` 同一把 minisign 公钥。
/// CI 必须校验两处一致，避免换钥只换一处。
const UPDATE_PUBKEY_B64: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEI1RDdFNjdFQTJCMURCMDgKUldRSTI3R2lmdWJYdFJuYXhoQ1pQekNOcUNKOUplWWQ1QVJPK25OakFrL2NmS0ZrREZDbThwbEUK";
const DEFAULT_FEED_URL: &str = "https://aizhs.top/desktop-feed.json";
const MAX_FEED_BYTES: u64 = 2 * 1024 * 1024;
const MAX_ZIP_BYTES: u64 = 300 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED: u64 = 500 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 300 * 1024 * 1024;
const MAX_ENTRIES: usize = 10_000;
const MIN_FREE_MARGIN: u64 = 120 * 1024 * 1024;
const RESTART_EXIT_CODE: i32 = 42;
const EVENT_NAME: &str = "update-v2";
const READY_FILE: &str = "update-ready.json";
/// 更新漏斗的本地账本：不弹窗、不联网，供“更新没生效”时按事件链定位。
const TELEMETRY_FILE: &str = "update-telemetry.jsonl";

static STAGING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub supported: bool,
    pub current: String,
    /// none / update / rollback
    pub kind: String,
    pub available: Option<String>,
    /// 已经解压完成、只等重启；不是“正在下载”。
    pub ready: bool,
    pub mandatory: bool,
    pub requires_bootstrap: bool,
    pub notes: Option<String>,
    pub reason: String,
}

impl UpdateStatus {
    fn unsupported(current: String, reason: impl Into<String>) -> Self {
        Self {
            supported: false,
            current,
            kind: "none".into(),
            available: None,
            ready: false,
            mandatory: false,
            requires_bootstrap: false,
            notes: None,
            reason: reason.into(),
        }
    }

    fn none(current: String, reason: impl Into<String>) -> Self {
        Self {
            supported: true,
            current,
            kind: "none".into(),
            available: None,
            ready: false,
            mandatory: false,
            requires_bootstrap: false,
            notes: None,
            reason: reason.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateEvent {
    phase: String,
    version: Option<String>,
    percent: Option<u8>,
    message: Option<String>,
    code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadyMark {
    version: String,
    /// update / rollback
    kind: String,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    mandatory: bool,
    at: u64,
}

struct Context {
    root: PathBuf,
    current: String,
    machine_id: String,
    launcher_version: String,
    /// Launcher 自动回滚后留下的已知坏版本：同一版本号不再自动推给用户，
    /// 否则会形成“下载→崩溃→回滚→再下载”的死亡循环。发布方修复后必须发新版本号。
    bad: Option<String>,
}

struct StageFlag;

impl Drop for StageFlag {
    fn drop(&mut self) {
        STAGING.store(false, Ordering::SeqCst);
    }
}

/// 跨进程 stage 互斥：AtomicBool 只挡得住同一个 payload 进程里的两次点击，
/// 挡不住两个实例/壳与设置页并发下载同一个版本。锁文件随进程退出自动释放。
struct StageLock {
    file: File,
}

impl StageLock {
    fn acquire(root: &Path) -> std::io::Result<Self> {
        let dir = root.join("updates");
        fs::create_dir_all(&dir)?;
        let file = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .open(dir.join(".stage.lock"))?;
        file.try_lock_exclusive()?;
        Ok(Self { file })
    }
}

impl Drop for StageLock {
    fn drop(&mut self) {
        let _ = self.file.unlock();
    }
}

struct TempTree {
    path: PathBuf,
    keep: bool,
}

impl TempTree {
    fn new(path: PathBuf) -> Self {
        Self { path, keep: false }
    }
    fn keep(&mut self) {
        self.keep = true;
    }
}

impl Drop for TempTree {
    fn drop(&mut self) {
        if !self.keep {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn update_v2_check(app: AppHandle) -> Result<UpdateStatus, String> {
    let ctx = match context(&app) {
        Ok(ctx) => ctx,
        Err(err) => {
            return Ok(UpdateStatus::unsupported(
                app.package_info().version.to_string(),
                err,
            ))
        }
    };
    let local = local_status(&ctx);
    if local.ready {
        // 本地已经 stage 好一版：仍然要联网看服务端有没有把这版撤掉。
        // 旧实现直接 return local，会让已下载的坏版本永远弹胶囊、永远装不上/退不掉。
        let pending = local.available.clone().unwrap_or_default();
        if let Ok(feed) = fetch_feed().await {
            let eval = feed.evaluate(
                &ctx.current,
                &ctx.launcher_version,
                &ctx.machine_id,
                platform_tag(),
            );
            append_log(
                &ctx.root,
                &format!(
                    "recheck-staged: pending={pending} feed={} verdict={} target={}",
                    feed.version,
                    eval.verdict.as_str(),
                    eval.version
                ),
            );
            let still_offered = matches!(eval.verdict, Verdict::Offer | Verdict::Rollback)
                && eval.version.trim_start_matches('v') == pending.trim_start_matches('v');
            if !still_offered {
                cancel_staged(
                    &ctx,
                    &format!(
                        "staged {pending} no longer offered: verdict={} target={}",
                        eval.verdict.as_str(),
                        eval.version
                    ),
                );
                return Ok(status_from_eval(&ctx, &eval));
            }
        }
        return Ok(local);
    }

    let feed = match fetch_feed().await {
        Ok(feed) => feed,
        Err(err) => {
            append_log(&ctx.root, &format!("check failed: {err}"));
            return Ok(UpdateStatus::none(ctx.current, err));
        }
    };
    let eval = feed.evaluate(
        &ctx.current,
        &ctx.launcher_version,
        &ctx.machine_id,
        platform_tag(),
    );
    append_log(
        &ctx.root,
        &format!(
            "check: current={} feed={} verdict={} reason={}",
            ctx.current,
            feed.version,
            eval.verdict.as_str(),
            eval.reason
        ),
    );
    if matches!(eval.verdict, Verdict::Offer)
        && ctx.bad.as_deref() == Some(eval.version.trim_start_matches('v'))
    {
        append_log(
            &ctx.root,
            &format!(
                "check: {} is known-bad after rollback; suppressed",
                eval.version
            ),
        );
        telemetry(&ctx.root, "check", &eval.version, "known-bad");
        return Ok(UpdateStatus::none(
            ctx.current.clone(),
            "known-bad version suppressed after rollback".to_string(),
        ));
    }
    telemetry(&ctx.root, "check", &eval.version, eval.verdict.as_str());
    Ok(status_from_eval(&ctx, &eval))
}

/// 立即返回，真正的下载/验签/解压在后台跑；界面只会在 ready 时出胶囊。
#[tauri::command]
pub async fn update_v2_stage(app: AppHandle) -> Result<(), String> {
    if STAGING.swap(true, Ordering::SeqCst) {
        return Err("already-staging".into());
    }
    let ctx = match context(&app) {
        Ok(ctx) => ctx,
        Err(err) => {
            STAGING.store(false, Ordering::SeqCst);
            return Err(format!("context: {err}"));
        }
    };
    let lock = match StageLock::acquire(&ctx.root) {
        Ok(lock) => lock,
        Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
            STAGING.store(false, Ordering::SeqCst);
            return Err("already-staging".into());
        }
        Err(err) => {
            STAGING.store(false, Ordering::SeqCst);
            return Err(format!("stage lock: {err}"));
        }
    };
    let app_for_task = app.clone();
    tauri::async_runtime::spawn(async move {
        let _lock = lock;
        let _flag = StageFlag;
        if let Err(err) = stage_inner(&app_for_task).await {
            let code = err.0.clone();
            let message = err.1.clone();
            if let Ok(ctx) = context(&app_for_task) {
                append_log(&ctx.root, &format!("stage failed [{code}]: {message}"));
                telemetry(&ctx.root, "stage-fail", "", &code);
                cleanup_parts(&ctx.root);
            }
            emit(
                &app_for_task,
                UpdateEvent {
                    phase: "error".into(),
                    version: None,
                    percent: None,
                    message: Some(message),
                    code: Some(code),
                },
            );
        }
    });
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackNotice {
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub at: u64,
    #[serde(default)]
    pub reason: String,
}

/// 读取并删除 Launcher 写的自动回滚通知（一次性展示，避免每轮启动重复弹）。
#[tauri::command]
pub fn update_v2_take_rollback_notice(app: AppHandle) -> Result<Option<RollbackNotice>, String> {
    let ctx = context(&app)?;
    let path = ctx.root.join("rollback-notice.json");
    if !path.is_file() {
        return Ok(None);
    }
    let text = fs::read(&path).map_err(|e| format!("rollback notice: {e}"))?;
    let notice: RollbackNotice =
        serde_json::from_slice(&text).map_err(|e| format!("rollback notice json: {e}"))?;
    let _ = fs::remove_file(path);
    telemetry(&ctx.root, "rollback", &notice.to, "starts");
    Ok(Some(notice))
}

#[tauri::command]
pub fn update_v2_ready(app: AppHandle) -> Result<UpdateStatus, String> {
    let ctx = context(&app)?;
    Ok(local_status(&ctx))
}

/// 前端已 flush 草稿/窗口状态后调用。Launcher 是父进程时用 42 交棒；
/// 没有 Launcher（开发/直接跑 payload）才回落到 Tauri 自带 restart。
#[tauri::command]
pub fn update_v2_restart(app: AppHandle) -> Result<(), String> {
    let _ = crate::save_window_state(Some("main".to_string()), app.clone());
    let _ = crate::save_window_state(Some("admin".to_string()), app.clone());
    if let Some(root) = install_root() {
        append_log(&root, "restart: handoff exit=42");
        telemetry(&root, "restart", "", "handoff");
    }
    // 只有父 Launcher 还活着，42 才有人接。父进程已退出（用户关掉启动器、
    // 任务管理器结束、首启失败）时再 exit(42) 就是静默关窗，没人会拉起新版本。
    if launcher_parent_alive() {
        app.exit(RESTART_EXIT_CODE);
    } else {
        if let Some(root) = install_root() {
            append_log(
                &root,
                "restart: launcher parent missing, fallback app.restart",
            );
            telemetry(&root, "restart", "", "launcher-missing");
        }
        app.restart();
    }
    Ok(())
}

#[cfg(windows)]
fn launcher_parent_alive() -> bool {
    let Ok(pid) = std::env::var("IHUI_LAUNCHER_PID") else {
        return false;
    };
    let Ok(pid) = pid.parse::<u32>() else {
        return false;
    };
    pid_is_alive(pid)
}

#[cfg(windows)]
fn pid_is_alive(pid: u32) -> bool {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    if pid == 0 {
        return false;
    }
    // SAFETY: 只查询退出码，不写进程；句柄在返回前关闭。
    unsafe {
        let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return false;
        };
        let mut code = 0u32;
        let alive = GetExitCodeProcess(handle, &mut code).is_ok() && code == 259; // STILL_ACTIVE
        let _ = CloseHandle(handle);
        alive
    }
}

#[cfg(not(windows))]
fn launcher_parent_alive() -> bool {
    // 非 Windows 没有 Launcher 交接协议；保持原来的环境变量判定。
    std::env::var("IHUI_LAUNCHER_PID").is_ok()
}

/// 设置页“退回上一版”：只写 pending，下次启动/点胶囊时由 Launcher 切。
#[tauri::command]
pub fn update_v2_rollback(app: AppHandle) -> Result<UpdateStatus, String> {
    let ctx = context(&app)?;
    let mut state = State::load(&ctx.root).map_err(|e| format!("state: {e}"))?;
    if !state.request_manual_rollback() {
        return Err("no-previous-version".into());
    }
    state.save(&ctx.root).map_err(|e| format!("state: {e}"))?;
    let target = state.pending.clone().unwrap_or_default();
    write_ready(
        &ctx.root,
        &ReadyMark {
            version: target.clone(),
            kind: "rollback".into(),
            notes: Some("已准备好退回上一版，重启后生效。".into()),
            mandatory: false,
            at: now_secs(),
        },
    );
    append_log(&ctx.root, &format!("manual rollback pending={target}"));
    telemetry(&ctx.root, "rollback-prepare", &target, "manual");
    Ok(local_status(&ctx))
}

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

async fn stage_inner(app: &AppHandle) -> Result<(), (String, String)> {
    let ctx = context(app).map_err(|e| ("not-installed".into(), e))?;
    let feed = fetch_feed().await.map_err(|e| ("feed".into(), e))?;
    let eval = feed.evaluate(
        &ctx.current,
        &ctx.launcher_version,
        &ctx.machine_id,
        platform_tag(),
    );
    append_log(
        &ctx.root,
        &format!(
            "stage: verdict={} version={}",
            eval.verdict.as_str(),
            eval.version
        ),
    );

    match eval.verdict {
        Verdict::Offer => stage_offer(app, &ctx, &eval).await,
        Verdict::Rollback => stage_rollback(app, &ctx, &eval),
        Verdict::Excluded => Err(("rollout".into(), "当前机器不在灰度范围".into())),
        Verdict::UpToDate => Err(("up-to-date".into(), "已经是最新版本".into())),
        Verdict::Revoked => Err(("revoked".into(), "该版本已被撤版".into())),
        Verdict::NoPayload => Err(("no-payload".into(), "feed 没有当前平台载荷".into())),
        Verdict::Invalid => Err(("invalid-feed".into(), eval.reason)),
    }
}

fn stage_rollback(
    app: &AppHandle,
    ctx: &Context,
    eval: &Evaluation,
) -> Result<(), (String, String)> {
    let target = eval.version.clone();
    let exists = app_exe(&ctx.root, &target)
        .map(|p| p.is_file())
        .unwrap_or(false);
    if !exists {
        return Err((
            "rollback-missing".into(),
            format!("本地没有 {target} 版本目录"),
        ));
    }
    let mut state = State::load(&ctx.root).map_err(|e| ("state".into(), e.to_string()))?;
    if state.current == target {
        return Err(("up-to-date".into(), "当前已经是该版本".into()));
    }
    state.pending = Some(target.clone());
    state
        .save(&ctx.root)
        .map_err(|e| ("state".into(), e.to_string()))?;
    write_ready(
        &ctx.root,
        &ReadyMark {
            version: target.clone(),
            kind: "rollback".into(),
            notes: eval.notes.clone(),
            mandatory: false,
            at: now_secs(),
        },
    );
    emit(
        app,
        UpdateEvent {
            phase: "ready".into(),
            version: Some(target.clone()),
            percent: None,
            message: Some("rollback ready".into()),
            code: None,
        },
    );
    Ok(())
}

async fn stage_offer(
    app: &AppHandle,
    ctx: &Context,
    eval: &Evaluation,
) -> Result<(), (String, String)> {
    let payload = eval
        .payload
        .as_ref()
        .ok_or_else(|| ("no-payload".to_string(), "feed 没有 payload".to_string()))?;
    let target = eval.version.clone();
    if eval.requires_bootstrap {
        return Err((
            "launcher-too-old".into(),
            "需要先升级启动器；zip 更新不能自举 Launcher".into(),
        ));
    }
    if ctx.current == target {
        return Err(("up-to-date".into(), "已经是最新版本".into()));
    }
    if ctx.bad.as_deref() == Some(target.trim_start_matches('v')) {
        return Err((
            "known-bad".into(),
            "该版本已被 Launcher 自动回滚过，禁止再次暂存".into(),
        ));
    }
    if payload.size > MAX_ZIP_BYTES {
        return Err((
            "too-large".into(),
            format!("zip 超过 {}MB", MAX_ZIP_BYTES / 1024 / 1024),
        ));
    }
    let free = fs2::available_space(&ctx.root).map_err(|e| ("disk".into(), e.to_string()))?;
    if free
        < payload
            .size
            .saturating_mul(2)
            .saturating_add(MIN_FREE_MARGIN)
    {
        return Err((
            "disk-space".into(),
            "磁盘剩余空间不足（需要约 2 倍包体 + 120MB）".into(),
        ));
    }

    let updates = ctx.root.join("updates");
    fs::create_dir_all(&updates).map_err(|e| ("disk".into(), e.to_string()))?;
    let part = updates.join(format!("{target}.zip.part"));
    let _ = fs::remove_file(&part);

    emit(
        app,
        UpdateEvent {
            phase: "download".into(),
            version: Some(target.clone()),
            percent: Some(0),
            message: None,
            code: None,
        },
    );
    append_log(&ctx.root, &format!("download: {target} {}", payload.url));
    telemetry(&ctx.root, "download", &target, "start");

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(600))
        .user_agent("IHUI-AI-Updater/0.1")
        .build()
        .map_err(|e| ("network".into(), e.to_string()))?;
    let mut response = client
        .get(&payload.url)
        .send()
        .await
        .map_err(|e| ("network".into(), e.to_string()))?;
    if !response.status().is_success() {
        return Err(("network".into(), format!("HTTP {}", response.status())));
    }
    if let Some(len) = response.content_length() {
        if len != payload.size {
            return Err((
                "size".into(),
                format!("Content-Length {len} != feed size {}", payload.size),
            ));
        }
    }

    let mut file = File::create(&part).map_err(|e| ("disk".into(), e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut total = 0u64;
    let mut last_pct = 0u8;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| ("network".into(), e.to_string()))?
    {
        total = total.saturating_add(chunk.len() as u64);
        if total > payload.size || total > MAX_ZIP_BYTES {
            return Err(("size".into(), format!("下载超过预期大小 {total}")));
        }
        file.write_all(&chunk)
            .map_err(|e| ("disk".into(), e.to_string()))?;
        hasher.update(&chunk);
        let pct = ((total * 100) / payload.size.max(1)) as u8;
        if pct >= last_pct.saturating_add(5) || pct == 100 {
            last_pct = pct;
            emit(
                app,
                UpdateEvent {
                    phase: "download".into(),
                    version: Some(target.clone()),
                    percent: Some(pct),
                    message: None,
                    code: None,
                },
            );
        }
    }
    file.sync_all()
        .map_err(|e| ("disk".into(), e.to_string()))?;
    drop(file);

    if total != payload.size {
        let _ = fs::remove_file(&part);
        return Err((
            "size".into(),
            format!("下载大小 {total} != feed {}", payload.size),
        ));
    }
    let digest = hex_digest(&hasher.finalize());
    if digest != payload.sha256.to_lowercase() {
        let _ = fs::remove_file(&part);
        return Err(("sha256".into(), "下载包 sha256 与 feed 不一致".into()));
    }
    append_log(&ctx.root, &format!("download: sha256 ok {digest}"));

    emit(
        app,
        UpdateEvent {
            phase: "verify".into(),
            version: Some(target.clone()),
            percent: Some(100),
            message: None,
            code: None,
        },
    );
    let zip_bytes = fs::read(&part).map_err(|e| ("disk".into(), e.to_string()))?;
    verify_signature(&zip_bytes, &payload.signature).map_err(|e| ("signature".into(), e))?;
    append_log(&ctx.root, &format!("verify: minisign ok {target}"));
    telemetry(&ctx.root, "verify", &target, "ok");

    emit(
        app,
        UpdateEvent {
            phase: "stage".into(),
            version: Some(target.clone()),
            percent: None,
            message: None,
            code: None,
        },
    );
    let tmp = updates.join(format!(
        "{target}.tmp-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| ("disk".into(), e.to_string()))?;
    let mut tree = TempTree::new(tmp.clone());

    let extracted = extract_zip(&part, &tmp, &target, platform_tag())?;
    if !extracted.contains_key("ihui-app.exe") {
        return Err(("manifest".into(), "zip 缺少根目录 ihui-app.exe".into()));
    }

    let final_dir = version_dir(&ctx.root, &target)
        .ok_or_else(|| ("manifest".into(), "非法版本目录".to_string()))?;
    if final_dir.exists() {
        let manifest = final_dir.join("manifest.json");
        if !manifest.is_file()
            || !app_exe(&ctx.root, &target)
                .map(|p| p.is_file())
                .unwrap_or(false)
        {
            return Err((
                "version-dir-exists".into(),
                format!("{} 已存在但不完整", final_dir.display()),
            ));
        }
        // 上一次已经完整暂存过同一个版本：复用前必须按磁盘内容重算清单，
        // 不能只看两个文件存在——半截目录/同号热修包会“更新了但没变化”。
        verify_manifest_dir(&final_dir, &target, platform_tag()).map_err(|(code, msg)| {
            (
                "version-dir-exists".into(),
                format!("{} 已存在但校验失败: {code}: {msg}", final_dir.display()),
            )
        })?;
        let _ = fs::remove_dir_all(&tmp);
        tree.keep();
    } else {
        fs::rename(&tmp, &final_dir).map_err(|e| ("disk".into(), e.to_string()))?;
        tree.keep();
    }

    let mut state = State::load(&ctx.root).map_err(|e| ("state".into(), e.to_string()))?;
    if state.current == target {
        return Err(("up-to-date".into(), "当前已经是该版本".into()));
    }
    state.pending = Some(target.clone());
    state
        .save(&ctx.root)
        .map_err(|e| ("state".into(), e.to_string()))?;
    write_ready(
        &ctx.root,
        &ReadyMark {
            version: target.clone(),
            kind: "update".into(),
            notes: eval.notes.clone(),
            mandatory: eval.mandatory,
            at: now_secs(),
        },
    );
    let _ = fs::remove_file(&part);
    append_log(
        &ctx.root,
        &format!("ready: {target} pending ({} bytes)", zip_bytes.len()),
    );
    telemetry(&ctx.root, "ready", &target, "staged");

    emit(
        app,
        UpdateEvent {
            phase: "ready".into(),
            version: Some(target.clone()),
            percent: Some(100),
            message: eval.notes.clone(),
            code: None,
        },
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// Local state / feed / status
// ---------------------------------------------------------------------------

fn context(app: &AppHandle) -> Result<Context, String> {
    let root = install_root().ok_or_else(|| "not-installed".to_string())?;
    let current = app.package_info().version.to_string();
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data: {e}"))?;
    let _ = fs::create_dir_all(&app_data);
    let machine_id = install_id(&root, &app_data);
    let launcher_version = fs::read_to_string(root.join("launcher-version.txt"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "0.1.0".into());
    let bad = State::load(&root)
        .ok()
        .and_then(|state| state.bad)
        .map(|value| value.trim_start_matches('v').to_string());
    Ok(Context {
        root,
        current,
        machine_id,
        launcher_version,
        bad,
    })
}

fn install_root() -> Option<PathBuf> {
    if let Ok(raw) = std::env::var("IHUI_INSTALL_ROOT") {
        let path = PathBuf::from(raw);
        if path.join("versions").is_dir() {
            return Some(path);
        }
    }
    let exe = std::env::current_exe().ok()?;
    let parent = exe.parent()?;
    if parent.join("versions").is_dir() {
        return Some(parent.to_path_buf());
    }
    let grand = parent.parent()?;
    if grand.join("versions").is_dir() {
        return Some(grand.to_path_buf());
    }
    // 直接双击 / 旧自启绕过 Launcher 时，exe 在 root/versions/<ver>/ihui-app.exe：
    // parent=v，grand=versions，great=root；必须再上溯一层才能找到安装根。
    let great = grand.parent()?;
    if great.join("versions").is_dir() {
        return Some(great.to_path_buf());
    }
    None
}

/// 已 stage 的版本被服务端撤版/被更强的回退目标取代：清 pending + ready，
/// 让胶囊消失；下一次 check 会按 feed 重新决定。
fn cancel_staged(ctx: &Context, reason: &str) {
    if let Ok(mut state) = State::load(&ctx.root) {
        state.pending = None;
        let _ = state.save(&ctx.root);
    }
    let _ = fs::remove_file(ctx.root.join(READY_FILE));
    cleanup_parts(&ctx.root);
    append_log(&ctx.root, &format!("cancel-staged: {reason}"));
}

fn local_status(ctx: &Context) -> UpdateStatus {
    let mut state = match State::load(&ctx.root) {
        Ok(state) => state,
        Err(_) => return UpdateStatus::none(ctx.current.clone(), "state-unreadable"),
    };
    let ready = read_ready(&ctx.root);

    // 已经切到 ready 里的版本 = 胶囊使命结束，清掉陈旧 ready，避免新版界面误报。
    if let Some(mark) = ready.as_ref() {
        if mark.version == ctx.current {
            let _ = fs::remove_file(ctx.root.join(READY_FILE));
            let pending_is_current = state.pending.as_deref() == Some(ctx.current.as_str());
            if state.pending.is_none() || pending_is_current {
                state.pending = None;
                let _ = state.save(&ctx.root);
                return UpdateStatus::none(ctx.current.clone(), "current");
            }
        }
    }

    let Some(pending) = state.pending.clone() else {
        return UpdateStatus::none(ctx.current.clone(), "current");
    };
    if pending == ctx.current {
        state.pending = None;
        let _ = state.save(&ctx.root);
        return UpdateStatus::none(ctx.current.clone(), "current");
    }
    if !app_exe(&ctx.root, &pending)
        .map(|p| p.is_file())
        .unwrap_or(false)
    {
        return UpdateStatus::none(ctx.current.clone(), "pending-missing");
    }
    // ready 文件与 pending 不一致（旧版残留/手动改指针）时不拿旧 kind/notes 误导用户。
    let ready = ready.filter(|mark| mark.version == pending);
    let kind = ready
        .as_ref()
        .map(|r| r.kind.clone())
        .unwrap_or_else(|| "update".into());
    UpdateStatus {
        supported: true,
        current: ctx.current.clone(),
        kind,
        available: Some(pending),
        ready: true,
        mandatory: ready.as_ref().map(|r| r.mandatory).unwrap_or(false),
        requires_bootstrap: false,
        notes: ready.and_then(|r| r.notes),
        reason: "staged".into(),
    }
}

fn status_from_eval(ctx: &Context, eval: &Evaluation) -> UpdateStatus {
    match eval.verdict {
        Verdict::Offer => UpdateStatus {
            supported: true,
            current: ctx.current.clone(),
            kind: "update".into(),
            available: Some(eval.version.clone()),
            ready: false,
            mandatory: eval.mandatory,
            requires_bootstrap: eval.requires_bootstrap,
            notes: eval.notes.clone(),
            reason: eval.reason.clone(),
        },
        Verdict::Rollback => UpdateStatus {
            supported: true,
            current: ctx.current.clone(),
            kind: "rollback".into(),
            available: Some(eval.version.clone()),
            ready: false,
            mandatory: false,
            requires_bootstrap: false,
            notes: eval.notes.clone(),
            reason: eval.reason.clone(),
        },
        _ => UpdateStatus::none(ctx.current.clone(), eval.reason.clone()),
    }
}

async fn fetch_feed() -> Result<Feed, String> {
    let url = std::env::var("IHUI_FEED_URL").unwrap_or_else(|_| DEFAULT_FEED_URL.to_string());
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(30))
        .user_agent("IHUI-AI-Updater/0.1")
        .build()
        .map_err(|e| format!("http: {e}"))?;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("feed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("feed HTTP {}", response.status()));
    }
    if let Some(len) = response.content_length() {
        if len > MAX_FEED_BYTES {
            return Err(format!("feed too large: {len}"));
        }
    }
    let bytes = response.bytes().await.map_err(|e| format!("feed: {e}"))?;
    if bytes.len() as u64 > MAX_FEED_BYTES {
        return Err("feed too large".into());
    }
    Feed::from_json(&String::from_utf8_lossy(&bytes))
}

fn platform_tag() -> &'static str {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "windows-x86_64"
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        "windows-aarch64"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "darwin-aarch64"
    } else if cfg!(target_os = "macos") {
        "darwin-x86_64"
    } else {
        "linux-x86_64"
    }
}

// ---------------------------------------------------------------------------
// minisign / zip
// ---------------------------------------------------------------------------

fn verify_signature(zip: &[u8], signature: &str) -> Result<(), String> {
    if cfg!(debug_assertions)
        && std::env::var("IHUI_UPDATE_ALLOW_UNSIGNED").ok().as_deref() == Some("1")
    {
        return Ok(());
    }
    let public_key = PublicKey::from_base64(UPDATE_PUBKEY_B64)
        .map_err(|e| format!("minisign public key: {e}"))?;
    let signature = Signature::decode(signature).map_err(|e| format!("minisign signature: {e}"))?;
    public_key
        .verify(zip, &signature, false)
        .map_err(|e| format!("minisign verify: {e}"))
}

#[derive(Debug, Deserialize)]
struct Manifest {
    schema: u32,
    version: String,
    platform: String,
    files: Vec<ManifestFile>,
}

#[derive(Debug, Deserialize)]
struct ManifestFile {
    path: String,
    sha256: String,
    size: u64,
}

/// 返回 `相对路径 -> (sha256, size)`，包含 manifest 以外的所有文件。
fn extract_zip(
    zip_path: &Path,
    tmp: &Path,
    target: &str,
    platform: &str,
) -> Result<HashMap<String, (String, u64)>, (String, String)> {
    let file = File::open(zip_path).map_err(|e| ("zip".into(), e.to_string()))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| ("zip".into(), e.to_string()))?;
    if archive.len() > MAX_ENTRIES {
        return Err(("zip".into(), format!("条目数 {} 超过上限", archive.len())));
    }
    let mut manifest_text: Option<String> = None;
    let mut extracted: HashMap<String, (String, u64)> = HashMap::new();
    let mut seen = HashSet::new();
    let mut total = 0u64;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| ("zip".into(), e.to_string()))?;
        let raw_name = entry.name().to_string();
        if raw_name.contains('\\') || raw_name.contains(':') || raw_name.starts_with('/') {
            return Err(("zip".into(), format!("非法路径: {raw_name}")));
        }
        let Some(relative) = entry.enclosed_name() else {
            return Err(("zip".into(), format!("路径穿越: {raw_name}")));
        };
        let relative_text = relative.to_string_lossy().replace('\\', "/");
        if entry.is_dir() {
            continue;
        }
        if let Some(mode) = entry.unix_mode() {
            if mode & 0o170000 == 0o120000 {
                return Err(("zip".into(), format!("拒绝符号链接: {relative_text}")));
            }
        }
        if !seen.insert(relative_text.clone()) {
            return Err(("zip".into(), format!("重复条目: {relative_text}")));
        }
        if entry.size() > MAX_FILE_BYTES {
            return Err(("zip".into(), format!("单文件过大: {relative_text}")));
        }
        total = total.saturating_add(entry.size());
        if total > MAX_TOTAL_UNCOMPRESSED {
            return Err(("zip".into(), "解压总量超过上限".into()));
        }

        if relative_text == "manifest.json" {
            if entry.size() > 1024 * 1024 {
                return Err(("manifest".into(), "manifest 超过 1MB".into()));
            }
            let mut text = String::new();
            entry
                .read_to_string(&mut text)
                .map_err(|e| ("manifest".into(), e.to_string()))?;
            fs::write(tmp.join("manifest.json"), &text)
                .map_err(|e| ("disk".into(), e.to_string()))?;
            manifest_text = Some(text);
            continue;
        }

        let dest = tmp.join(&relative);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| ("disk".into(), e.to_string()))?;
        }
        let mut out = File::create(&dest).map_err(|e| ("disk".into(), e.to_string()))?;
        let mut hasher = Sha256::new();
        // 注意：不能用 `Vec::with_capacity(64k)` 再 `clear()` 后传给 `read` ——
        // Vec 的 len 是 0，`&mut Vec<u8>` 会退化成零长度切片，read 恒返回 0，
        // 解压出来的每个文件都是 0 字节（manifest 哈希必挂）。用固定数组。
        let mut buffer = [0u8; 64 * 1024];
        let mut written = 0u64;
        loop {
            let read = entry
                .read(&mut buffer)
                .map_err(|e| ("zip".into(), e.to_string()))?;
            if read == 0 {
                break;
            }
            out.write_all(&buffer[..read])
                .map_err(|e| ("disk".into(), e.to_string()))?;
            hasher.update(&buffer[..read]);
            written = written.saturating_add(read as u64);
            if written > entry.size() {
                return Err((
                    "zip".into(),
                    format!("文件解压超过声明大小: {relative_text}"),
                ));
            }
        }
        out.sync_all().map_err(|e| ("disk".into(), e.to_string()))?;
        extracted.insert(relative_text, (hex_digest(&hasher.finalize()), written));
    }

    let text = manifest_text
        .ok_or_else(|| ("manifest".to_string(), "zip 缺少 manifest.json".to_string()))?;
    let manifest: Manifest =
        serde_json::from_str(&text).map_err(|e| ("manifest".into(), e.to_string()))?;
    if manifest.schema != 2 {
        return Err((
            "manifest".into(),
            format!("manifest schema={}", manifest.schema),
        ));
    }
    if manifest.version != target {
        return Err((
            "manifest".into(),
            format!("manifest version={} target={target}", manifest.version),
        ));
    }
    if manifest.platform != platform {
        return Err((
            "manifest".into(),
            format!("manifest platform={} target={platform}", manifest.platform),
        ));
    }
    verify_manifest_files(&manifest, &extracted)?;
    Ok(extracted)
}

fn verify_manifest_files(
    manifest: &Manifest,
    actual: &HashMap<String, (String, u64)>,
) -> Result<(), (String, String)> {
    if manifest.files.len() != actual.len() {
        return Err(("manifest".into(), "manifest 文件数与实际目录不一致".into()));
    }

    let mut declared = HashSet::new();
    for entry in &manifest.files {
        let path = normalize_manifest_path(&entry.path).ok_or_else(|| {
            (
                "manifest".into(),
                format!("非法 manifest path: {}", entry.path),
            )
        })?;
        if path == "manifest.json" {
            return Err(("manifest".into(), "manifest 不得把自身列入 files".into()));
        }
        if !declared.insert(path.clone()) {
            return Err(("manifest".into(), format!("manifest 重复路径: {path}")));
        }
        if !feed::is_sha256(&entry.sha256) {
            return Err(("manifest".into(), format!("sha256 非法: {path}")));
        }
        let Some((actual_hash, actual_size)) = actual.get(&path) else {
            return Err(("manifest".into(), format!("缺少文件: {path}")));
        };
        if actual_hash != &entry.sha256.to_lowercase() {
            return Err(("manifest".into(), format!("sha256 不匹配: {path}")));
        }
        if actual_size != &entry.size {
            return Err(("manifest".into(), format!("大小不匹配: {path}")));
        }
    }
    for path in actual.keys() {
        if !declared.contains(path) {
            return Err(("manifest".into(), format!("多出未声明文件: {path}")));
        }
    }
    Ok(())
}

/// 复用已存在的 `versions/<ver>` 前，必须用磁盘内容重算一遍清单。
/// `extract_zip` 只保证本次 zip 的字节；上次 stage 在 rename 后、写 pending 前
/// 被杀会留下半截目录，若只看 manifest.json + ihui-app.exe 存在就复用，坏目录
/// 会被切上去。这里逐文件重算 sha256/大小，并检查未声明文件。
fn verify_manifest_dir(dir: &Path, target: &str, platform: &str) -> Result<(), (String, String)> {
    let text = fs::read_to_string(dir.join("manifest.json"))
        .map_err(|e| ("manifest".into(), format!("读取 manifest 失败: {e}")))?;
    let manifest: Manifest =
        serde_json::from_str(&text).map_err(|e| ("manifest".into(), e.to_string()))?;
    if manifest.schema != 2 {
        return Err((
            "manifest".into(),
            format!("manifest schema={}", manifest.schema),
        ));
    }
    if manifest.version != target {
        return Err((
            "manifest".into(),
            format!("manifest version={} target={target}", manifest.version),
        ));
    }
    if manifest.platform != platform {
        return Err((
            "manifest".into(),
            format!("manifest platform={} target={platform}", manifest.platform),
        ));
    }

    let mut actual: HashMap<String, (String, u64)> = HashMap::new();
    collect_dir_files(dir, "", &mut actual)?;
    verify_manifest_files(&manifest, &actual)
}

fn collect_dir_files(
    dir: &Path,
    prefix: &str,
    out: &mut HashMap<String, (String, u64)>,
) -> Result<(), (String, String)> {
    let entries = fs::read_dir(dir).map_err(|e| ("disk".into(), e.to_string()))?;
    for entry in entries {
        let entry = entry.map_err(|e| ("disk".into(), e.to_string()))?;
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };
        let file_type = entry
            .file_type()
            .map_err(|e| ("disk".into(), e.to_string()))?;
        if file_type.is_symlink() {
            return Err(("manifest".into(), format!("拒绝符号链接: {rel}")));
        }
        if file_type.is_dir() {
            collect_dir_files(&entry.path(), &rel, out)?;
            continue;
        }
        if !file_type.is_file() {
            return Err(("manifest".into(), format!("不支持的目录项: {rel}")));
        }
        if rel == "manifest.json" {
            continue;
        }
        let bytes = fs::read(entry.path()).map_err(|e| ("disk".into(), e.to_string()))?;
        out.insert(
            rel,
            (hex_digest(&Sha256::digest(&bytes)), bytes.len() as u64),
        );
    }
    Ok(())
}

fn normalize_manifest_path(value: &str) -> Option<String> {
    if value.is_empty() || value.contains('\\') || value.contains(':') {
        return None;
    }
    let path = Path::new(value);
    if path.is_absolute() {
        return None;
    }
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            _ => return None,
        }
    }
    Some(value.replace('\\', "/"))
}

// ---------------------------------------------------------------------------
// Ready marker / log / ids
// ---------------------------------------------------------------------------

fn write_ready(root: &Path, mark: &ReadyMark) {
    let path = root.join(READY_FILE);
    let text = match serde_json::to_vec_pretty(mark) {
        Ok(text) => text,
        Err(_) => return,
    };
    let tmp = root.join(format!("{READY_FILE}.tmp"));
    if fs::write(&tmp, text).is_ok() {
        let _ = fs::remove_file(&path);
        let _ = fs::rename(&tmp, &path);
    }
}

fn read_ready(root: &Path) -> Option<ReadyMark> {
    let text = fs::read(root.join(READY_FILE)).ok()?;
    serde_json::from_slice(&text).ok()
}

fn cleanup_parts(root: &Path) {
    let updates = root.join("updates");
    let Ok(entries) = fs::read_dir(&updates) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("part") {
            let _ = fs::remove_file(path);
        }
    }
}

fn telemetry(root: &Path, event: &str, version: &str, code: &str) {
    let line = serde_json::json!({
        "schema": 1,
        "at": now_secs(),
        "event": event,
        "version": version,
        "code": code,
    });
    let path = root.join(TELEMETRY_FILE);
    if let Ok(meta) = fs::metadata(&path) {
        if meta.len() > 1024 * 1024 {
            let old = root.join(format!("{TELEMETRY_FILE}.1"));
            let _ = fs::remove_file(&old);
            let _ = fs::rename(&path, old);
        }
    }
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{}", line);
    }
    // 远端漏斗是可选能力：只有部署环境显式配置 IHUI_UPDATE_TELEMETRY_URL 才发，
    // 不默认联网、不带任何用户内容；失败完全静默，绝不影响更新主流程。
    if let Ok(url) = std::env::var("IHUI_UPDATE_TELEMETRY_URL") {
        if url.starts_with("https://") {
            let body = line.to_string();
            tauri::async_runtime::spawn(async move {
                let client = match reqwest::Client::builder()
                    .timeout(Duration::from_secs(5))
                    .build()
                {
                    Ok(client) => client,
                    Err(_) => return,
                };
                let _ = client
                    .post(url)
                    .header(reqwest::header::CONTENT_TYPE, "application/json")
                    .body(body)
                    .send()
                    .await;
            });
        }
    }
}

fn append_log(root: &Path, message: &str) {
    let path = root.join("update.log");
    if let Ok(meta) = fs::metadata(&path) {
        if meta.len() > 1_000_000 {
            let old = root.join("update.log.1");
            let _ = fs::remove_file(&old);
            let _ = fs::rename(&path, old);
        }
    }
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "[{}] {message}", now_secs());
    }
}

/// 登录自启的注册表值必须指向稳定 Launcher，而不是 versions/<ver>/ihui-app.exe。
///
/// 壳进程无论从快捷方式、深链还是自启（直接拉起某个 payload）启动，都会在 setup 里
/// 调一次本函数：只要 HKCU Run 里存在属于本安装目录的值，就把它改写成
/// `"<安装根>/智汇AI.exe" --minimized`；值不存在（用户没开自启）则绝不新建。
/// 这样即使旧插件把 payload 绝对路径写进 Run，下一次开机也会回到 Launcher。
#[cfg(windows)]
pub fn sync_autostart(app: &AppHandle) {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    let Some(root) = install_root() else {
        return;
    };
    let Some(launcher) = launcher_exe_for(&root, &app.package_info().name) else {
        return;
    };
    let root_lower = root.to_string_lossy().to_lowercase();
    let desired = format!("\"{}\" --minimized", launcher.display());
    let Ok(run) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(
        r"Software\Microsoft\Windows\CurrentVersion\Run",
        KEY_READ | KEY_WRITE,
    ) else {
        return;
    };
    // 枚举而不是硬编码值名：插件过去可能用产品名/包名两种写法，避免漏改。
    let names: Vec<String> = run.enum_values().flatten().map(|(name, _)| name).collect();
    for name in names {
        let Ok(current) = run.get_value::<String, _>(&name) else {
            continue;
        };
        let normalized = current.replace('/', "\\").to_lowercase();
        if !normalized.contains(&root_lower) {
            continue;
        }
        if current != desired {
            let _ = run.set_value(&name, &desired);
        }
    }
}

/// 根目录 Launcher 的实际文件名。安装器固定写 `${PRODUCTNAME}.exe`；不能只信
/// `package_info().name`（不同打包配置下它可能是包名 `ihui-desktop`，会指到不存在的
/// 旧主程序）。优先稳定产品名，再回退打包名。
fn launcher_exe_for(root: &Path, package_name: &str) -> Option<std::path::PathBuf> {
    let preferred = root.join("智汇AI.exe");
    if preferred.is_file() {
        return Some(preferred);
    }
    let packaged = root.join(format!("{package_name}.exe"));
    if packaged != preferred && packaged.is_file() {
        return Some(packaged);
    }
    None
}
#[cfg(not(windows))]
pub fn sync_autostart(_app: &AppHandle) {}

/// 前端在 `plugin:autostart|enable` 之后立刻调用：把刚写进去的 payload 路径
/// 当场改回 Launcher，用户不必等下一次启动才生效。关闭自启不需要调用。
#[tauri::command]
pub fn update_v2_sync_autostart(app: AppHandle) {
    sync_autostart(&app);
}

fn install_id(root: &Path, app_data: &Path) -> String {
    let path = app_data.join("update-install-id");
    if let Ok(text) = fs::read_to_string(&path) {
        let id = text.trim().to_lowercase();
        if id.len() == 32 && id.chars().all(|c| c.is_ascii_hexdigit()) {
            return id;
        }
    }
    let _ = fs::create_dir_all(app_data);
    let seed = format!(
        "{}:{}:{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0),
        std::process::id(),
        root.display()
    );
    let digest = Sha256::digest(seed.as_bytes());
    let id = hex_digest(&digest)[..32].to_string();
    if fs::write(&path, &id).is_ok() {
        return id;
    }
    // app_data 不可写（只读安装/权限异常）时，灰度桶仍必须稳定：
    // 用安装根目录的哈希兜底，绝不让同一台机器每次启动换一个 rollout 桶。
    let fallback = Sha256::digest(root.to_string_lossy().as_bytes());
    hex_digest(&fallback)[..32].to_string()
}

fn emit(app: &AppHandle, event: UpdateEvent) {
    let _ = app.emit(EVENT_NAME, event);
}

fn hex_digest(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

// ---------------------------------------------------------------------------
// 版本三处一致：安装器 DisplayVersion / state.json / 载荷 package_info
// ---------------------------------------------------------------------------

/// zip 更新不会经过安装器，注册表 DisplayVersion 会停留在首装版本。
/// 新版本第一次启动时把当前用户/机器卸载项的 DisplayVersion 对齐到载荷版本；
/// 没有权限（perMachine 且非管理员）时静默跳过，不阻塞启动。
#[cfg(windows)]
pub fn sync_display_version(app: &AppHandle) {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_SET_VALUE};
    use winreg::RegKey;

    let version = app.package_info().version.to_string();
    let subkey = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\智汇AI";
    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(subkey, KEY_SET_VALUE) {
            let _ = key.set_value("DisplayVersion", &version);
        }
    }
}

#[cfg(not(windows))]
pub fn sync_display_version(_app: &AppHandle) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_id_is_stable_when_app_data_is_writable() {
        let root = std::env::temp_dir().join(format!(
            "ihui-install-id-{}-{}",
            std::process::id(),
            now_secs()
        ));
        let app_data = root.join("app-data");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let first = install_id(&root, &app_data);
        let second = install_id(&root, &app_data);
        assert_eq!(first, second);
        assert_eq!(first.len(), 32);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn install_id_falls_back_stably_when_app_data_is_not_writable() {
        let root = std::env::temp_dir().join(format!(
            "ihui-install-id-fallback-{}-{}",
            std::process::id(),
            now_secs()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        // 把 app_data 做成文件，create_dir_all / write 都会失败，模拟只读/异常安装根。
        let app_data = root.join("app-data-as-file");
        fs::write(&app_data, b"not-a-directory").unwrap();
        let first = install_id(&root, &app_data);
        let second = install_id(&root, &app_data);
        assert_eq!(first, second);
        assert_eq!(first.len(), 32);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn launcher_exe_prefers_product_name() {
        let root = std::env::temp_dir().join(format!(
            "ihui-launcher-path-{}-{}",
            std::process::id(),
            now_secs()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("智汇AI.exe"), b"launcher").unwrap();
        fs::write(root.join("ihui-desktop.exe"), b"legacy").unwrap();
        let found = launcher_exe_for(&root, "ihui-desktop").unwrap();
        assert_eq!(found.file_name().unwrap(), "智汇AI.exe");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn launcher_exe_falls_back_to_package_name() {
        let root = std::env::temp_dir().join(format!(
            "ihui-launcher-fallback-{}-{}",
            std::process::id(),
            now_secs()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("custom-app.exe"), b"launcher").unwrap();
        let found = launcher_exe_for(&root, "custom-app").unwrap();
        assert_eq!(found.file_name().unwrap(), "custom-app.exe");
        let _ = fs::remove_dir_all(&root);
    }
    #[test]
    fn stage_lock_is_exclusive() {
        let root = std::env::temp_dir().join(format!(
            "ihui-stage-lock-{}-{}",
            std::process::id(),
            now_secs()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let first = StageLock::acquire(&root).unwrap();
        assert!(StageLock::acquire(&root).is_err());
        drop(first);
        assert!(StageLock::acquire(&root).is_ok());
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(windows)]
    #[test]
    fn pid_liveness_detects_dead_parent() {
        assert!(pid_is_alive(std::process::id()));
        assert!(!pid_is_alive(u32::MAX));
        assert!(!pid_is_alive(0));
    }

    #[test]
    fn existing_version_dir_must_match_manifest() {
        let dir = std::env::temp_dir().join(format!(
            "ihui-stage-reuse-{}-{}",
            std::process::id(),
            now_secs()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let bytes = b"payload-v1";
        let hash = hex_digest(&Sha256::digest(bytes));
        fs::write(dir.join("ihui-app.exe"), bytes).unwrap();
        fs::write(
            dir.join("manifest.json"),
            format!(
                r#"{{"schema":2,"version":"0.1.94","platform":"windows-x86_64","files":[{{"path":"ihui-app.exe","sha256":"{}","size":{}}}]}}"#,
                hash,
                bytes.len()
            ),
        )
        .unwrap();
        assert!(verify_manifest_dir(&dir, "0.1.94", "windows-x86_64").is_ok());

        fs::write(dir.join("ihui-app.exe"), b"tampered").unwrap();
        assert!(verify_manifest_dir(&dir, "0.1.94", "windows-x86_64").is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn manifest_path_rejects_traversal() {
        assert!(normalize_manifest_path("ihui-app.exe").is_some());
        assert!(normalize_manifest_path("resources/a.dll").is_some());
        assert!(normalize_manifest_path("../evil.exe").is_none());
        assert!(normalize_manifest_path("/abs.exe").is_none());
        assert!(normalize_manifest_path("C:/abs.exe").is_none());
        assert!(normalize_manifest_path("a\\b.exe").is_none());
    }

    #[test]
    fn hex_digest_is_lowercase() {
        assert_eq!(hex_digest(&[0xab, 0x01]), "ab01");
    }

    #[test]
    fn extract_accepts_release_zip_layout() {
        use std::io::Write as _;
        use zip::write::SimpleFileOptions;

        let root = std::env::temp_dir().join(format!(
            "ihui-zip-test-{}-{}",
            std::process::id(),
            now_secs()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let zip_path = root.join("payload.zip");

        let exe_bytes = b"fake-app-payload";
        let exe_digest = Sha256::digest(exe_bytes);
        let manifest = serde_json::json!({
            "schema": 2,
            "version": "0.1.99",
            "platform": "windows-x86_64",
            "files": [{
                "path": "ihui-app.exe",
                "sha256": hex_digest(exe_digest.as_slice()),
                "size": exe_bytes.len() as u64
            }]
        });
        {
            let file = File::create(&zip_path).unwrap();
            let mut writer = zip::ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
            writer.start_file("ihui-app.exe", options).unwrap();
            writer.write_all(exe_bytes).unwrap();
            writer.start_file("manifest.json", options).unwrap();
            writer
                .write_all(serde_json::to_string(&manifest).unwrap().as_bytes())
                .unwrap();
            writer.finish().unwrap();
        }

        let out = root.join("out");
        let extracted = extract_zip(&zip_path, &out, "0.1.99", "windows-x86_64").unwrap();
        assert_eq!(
            extracted.get("ihui-app.exe").map(|v| v.1),
            Some(exe_bytes.len() as u64)
        );
        assert!(out.join("ihui-app.exe").is_file());
        let _ = fs::remove_dir_all(&root);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
