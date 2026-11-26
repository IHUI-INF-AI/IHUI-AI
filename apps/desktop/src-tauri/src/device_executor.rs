// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 跨设备执行器的本机托管（桌面端一键开关，G4）。
//!
//! 执行逻辑**不在这里**：跑任务的常驻进程是 `ihui device start`（CLI，已实现配对/指纹/
//! 工作区白名单/心跳租约/认领/执行/写回会话）。桌面端只回答三个问题：配没配、跑没跑、
//! 开/关。这样避免两套执行器各自实现一份任务状态机 —— 手机派单永远落到同一条链上。
//!
//! 安全边界：
//! - 只按固定任务名/固定命令名拉起，不接受渲染端传路径或命令；
//! - 启动前必须已配对（没有 `~/.ihui/device.json` 就拒绝，不替用户"默默生成一个身份"）；
//! - 派生进程一律隐藏控制台窗口（仓库 §5b），输出追加到 `~/.ihui/device.log`。

use serde::Serialize;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::menu::CheckMenuItem;
use tauri::{AppHandle, Manager, Wry};

/// Windows 计划任务名（与 CLI `ihui device install` 同名；本模块读的正是那份注册）
pub const DEVICE_EXECUTOR_TASK: &str = "IHUI-Device-Executor";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceExecutorStatus {
    /// 当前平台是否支持托管（目前只有 Windows 桌面端）
    pub supported: bool,
    /// 本机是否已用配对码接入（有合法 device.json）
    pub paired: bool,
    /// 配对时登记的设备名（展示用；未配对为 None）
    pub device_name: Option<String>,
    /// 常驻进程是否活着（pid 文件 + 判活，不看"上次是否启动过"）
    pub running: bool,
    /// 常驻进程 pid（仅 running 时有值）
    pub pid: Option<u32>,
    /// 开机自启的计划任务是否已注册
    pub task_registered: bool,
}

fn ihui_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE"))?;
    Some(PathBuf::from(home).join(".ihui"))
}

pub fn credential_path() -> Option<PathBuf> {
    ihui_dir().map(|d| d.join("device.json"))
}

pub fn pid_path() -> Option<PathBuf> {
    ihui_dir().map(|d| d.join("device.pid"))
}

fn log_path() -> Option<PathBuf> {
    ihui_dir().map(|d| d.join("device.log"))
}

/// 从 `device.json` 原文提取设备名。
/// 形状坏 = 未配对（与 CLI 同口径：版本不对/字段缺失一律不猜语义）。
pub fn device_name_from_credential(raw: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    if v.get("version")?.as_u64()? != 1 {
        return None;
    }
    for key in ["apiUrl", "deviceId", "deviceToken", "fingerprint", "name"] {
        if v.get(key)?.as_str()?.trim().is_empty() {
            return None;
        }
    }
    let name = v.get("name")?.as_str()?.trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn read_trimmed(path: Option<PathBuf>) -> Option<String> {
    let p = path?;
    let raw = std::fs::read_to_string(p).ok()?;
    let t = raw.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

#[cfg(windows)]
fn pid_alive(pid: u32) -> bool {
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::winnt::PROCESS_QUERY_LIMITED_INFORMATION;
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return false;
        }
        let _ = CloseHandle(h);
        true
    }
}

#[cfg(not(windows))]
fn pid_alive(pid: u32) -> bool {
    std::path::Path::new(&format!("/proc/{pid}")).exists()
}

#[cfg(windows)]
fn hidden_command(program: &str) -> Command {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW：派生进程不弹控制台（仓库 §5b）。schtasks/taskkill 都是控制台程序。
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut c = Command::new(program);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

#[cfg(not(windows))]
fn hidden_command(program: &str) -> Command {
    Command::new(program)
}

fn task_registered() -> bool {
    if !cfg!(windows) {
        return false;
    }
    hidden_command("schtasks")
        .args(["/query", "/tn", DEVICE_EXECUTOR_TASK])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

pub fn read_status() -> DeviceExecutorStatus {
    let device_name =
        read_trimmed(credential_path()).and_then(|raw| device_name_from_credential(&raw));
    let pid = read_trimmed(pid_path()).and_then(|raw| raw.parse::<u32>().ok());
    let alive_pid = pid.filter(|v| *v > 0 && pid_alive(*v));
    DeviceExecutorStatus {
        supported: cfg!(windows),
        paired: device_name.is_some(),
        device_name,
        running: alive_pid.is_some(),
        pid: alive_pid,
        task_registered: task_registered(),
    }
}

/// 找 CLI 的调用形态。**内置优先**：安装包 resource_dir/cli 里带一份与桌面端同版本发布的
/// CLI(npm-dist 产物)，PATH 里用户自己装的 ihui 只作兜底 —— 反过来的话，用户装了旧版全局
/// 包就会命中旧版(连 `device adopt` 子命令都没有)，而"一键启用"又没有可见的失败原因。
/// CLI 是 JS，运行时同样随包分发(resource_dir/node/node.exe)，见 `find_node`。
struct IhuiCmd {
    program: String,
    pre_args: Vec<String>,
}

impl IhuiCmd {
    fn command(&self) -> Command {
        let mut c = hidden_command(&self.program);
        for a in &self.pre_args {
            c.arg(a);
        }
        c
    }
}

fn where_first(name: &str) -> Option<String> {
    #[cfg(windows)]
    let probe = "where";
    #[cfg(not(windows))]
    let probe = "which";
    let out = hidden_command(probe).arg(name).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let first = String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()?
        .trim()
        .to_string();
    if first.is_empty() {
        None
    } else {
        Some(first)
    }
}

/// 找 Node 运行时。**内置优先**:安装包 resource_dir/node/node.exe 与桌面端同包发布,
/// 用户不必先装 Node。2026-11-26 实测:"用户机器没有 Node"和"没有 ihui 命令"一样常见,
/// 两种都不该让「一键启用」退化成一句看不懂的报错。PATH / 常见安装位只作兜底。
fn find_node(app: Option<&AppHandle>) -> Option<String> {
    if let Some(app) = app {
        if let Ok(dir) = app.path().resource_dir() {
            #[cfg(windows)]
            let cand = dir.join("node").join("node.exe");
            #[cfg(not(windows))]
            let cand = dir.join("node").join("node");
            if cand.is_file() {
                return Some(cand.to_string_lossy().to_string());
            }
        }
    }
    if let Some(n) = where_first("node") {
        return Some(n);
    }
    #[cfg(windows)]
    for p in [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ] {
        if std::path::Path::new(p).is_file() {
            return Some(p.to_string());
        }
    }
    None
}

fn find_ihui(app: Option<&AppHandle>) -> Option<IhuiCmd> {
    // 1) 安装包内置 CLI(与桌面端版本绑定,永不漂)
    if let Some(app) = app {
        if let Ok(dir) = app.path().resource_dir() {
            let js = dir.join("cli").join("dist").join("index.js");
            if js.is_file() {
                if let Some(node) = find_node(Some(app)) {
                    return Some(IhuiCmd {
                        program: node,
                        pre_args: vec![js.to_string_lossy().to_string()],
                    });
                }
            }
        }
    }
    // 2) 用户自己装的全局 ihui
    where_first("ihui").map(|p| IhuiCmd {
        program: p,
        pre_args: Vec::new(),
    })
}

pub fn start_executor(app: &AppHandle) -> Result<DeviceExecutorStatus, String> {
    if !cfg!(windows) {
        return Err("当前平台暂不支持：执行器托管只在 Windows 桌面端提供".into());
    }
    let status = read_status();
    if !status.paired {
        return Err(
            "这台电脑还没接入：先在手机/网页「设置-设备」签发配对码，再在终端执行 ihui device pair <8位码>"
                .into(),
        );
    }
    if status.running {
        return Ok(status);
    }
    if status.task_registered {
        let out = hidden_command("schtasks")
            .args(["/run", "/tn", DEVICE_EXECUTOR_TASK])
            .output()
            .map_err(|e| format!("启动计划任务失败: {e}"))?;
        if !out.status.success() {
            let msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(format!("启动计划任务失败: {msg}"));
        }
    } else {
        let ihui = find_ihui(Some(app)).ok_or_else(|| {
            "没找到 ihui：安装包内置 CLI 需要宿主 Node(PATH 里没有 node)。装上 Node 后重试，\
             或在命令行 npm i -g ihui-cli 用全局版兜底"
                .to_string()
        })?;
        let log = log_path().ok_or_else(|| "定位日志目录失败".to_string())?;
        // 追加写：每次启动不让上一轮现场（含失败原因）消失。
        let out_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log)
            .map_err(|e| format!("打开日志失败: {e}"))?;
        let err_file = out_file
            .try_clone()
            .map_err(|e| format!("复制日志句柄失败: {e}"))?;
        // CLI 自己解析 device start 的参数；这里只负责把它拉到常驻。
        let mut cmd = ihui.command();
        cmd.arg("device")
            .arg("start")
            .stdin(Stdio::null())
            .stdout(Stdio::from(out_file))
            .stderr(Stdio::from(err_file));
        cmd.spawn().map_err(|e| format!("启动执行器失败: {e}"))?;
    }
    // CLI 启动时会写 pid 文件；给一点时间再复读，避免"点了没反应"。
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(150));
        let s = read_status();
        if s.running {
            return Ok(s);
        }
    }
    Err("执行器已拉起但 4.5 秒内没有写出运行标记：看 ~/.ihui/device.log 末尾".into())
}

pub fn stop_executor() -> Result<DeviceExecutorStatus, String> {
    if !cfg!(windows) {
        return Err("当前平台暂不支持：执行器托管只在 Windows 桌面端提供".into());
    }
    let status = read_status();
    if status.task_registered {
        let _ = hidden_command("schtasks")
            .args(["/end", "/tn", DEVICE_EXECUTOR_TASK])
            .stdin(Stdio::null())
            .status();
    }
    if let Some(pid) = status.pid {
        let _ = hidden_command("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .status();
    }
    // pid 文件本该由 CLI 退出时清理；这里兜底删掉，避免"停止后仍显示运行中"。
    if let Some(p) = pid_path() {
        if p.exists() {
            let _ = std::fs::remove_file(p);
        }
    }
    Ok(read_status())
}

// ===== 托盘勾选态（G4，2026-11-26）=====
//
// 托盘是**不开窗也看得见**的入口：勾选 = 常驻执行器在跑。三件事：
//  1. `build_tray` 建菜单时把 CheckMenuItem 交到这里保存（重建托盘会换新句柄）；
//  2. 点击 = 翻转（起/停），失败只写日志并立刻把勾选态对齐真实进程 —— 不假装成功；
//  3. 15s 一次对齐：进程可能被系统/崩溃/用户在命令行拉起或杀掉，勾选态不能靠"上次点了什么"。

#[derive(Default)]
pub struct TrayItemState {
    pub item: Mutex<Option<CheckMenuItem<Wry>>>,
    pub watch_started: AtomicBool,
}

/// 保存当前托盘里的「本机执行器」勾选项（build_tray 每次重建都调，覆盖旧句柄）
pub fn store_tray_item(app: &AppHandle, item: CheckMenuItem<Wry>) {
    if let Some(state) = app.try_state::<TrayItemState>() {
        if let Ok(mut guard) = state.item.lock() {
            *guard = Some(item);
        }
        return;
    }
    let state = TrayItemState::default();
    if let Ok(mut guard) = state.item.lock() {
        *guard = Some(item);
    }
    app.manage(state);
}

fn set_tray_checked(app: &AppHandle, running: bool) {
    if let Some(state) = app.try_state::<TrayItemState>() {
        if let Ok(guard) = state.item.lock() {
            if let Some(item) = guard.as_ref() {
                let _ = item.set_checked(running);
            }
        }
    }
}

/// 托盘上的静默失败 = "点了没用"：把原因用非阻塞对话框说清楚（同 relay 失败的处理）。
fn notify_tray_failure(app: &AppHandle, msg: &str) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    log::warn!("[device-executor] {msg}");
    app.dialog()
        .message(msg)
        .title("本机执行器")
        .kind(MessageDialogKind::Warning)
        .show(|_| {});
}

/// 点击托盘项：翻转常驻状态。失败说清原因 + 立刻对齐真实进程（勾选态不假绿）。
pub fn toggle_from_tray(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let running = matches!(
            tauri::async_runtime::spawn_blocking(read_status).await,
            Ok(s) if s.running
        );
        let outcome = if running {
            tauri::async_runtime::spawn_blocking(stop_executor).await
        } else {
            let app_for_start = app.clone();
            tauri::async_runtime::spawn_blocking(move || start_executor(&app_for_start)).await
        };
        match outcome {
            Ok(Ok(_)) => {}
            Ok(Err(msg)) => notify_tray_failure(&app, &msg),
            Err(e) => notify_tray_failure(&app, &format!("托盘开关任务失败: {e}")),
        }
        let now_running = matches!(
            tauri::async_runtime::spawn_blocking(read_status).await,
            Ok(s) if s.running
        );
        set_tray_checked(&app, now_running);
    });
}

/// 只启动一次的对齐循环（build_tray 可能被调用多次：重建托盘不重复起 loop）
pub fn spawn_tray_watch(app: &AppHandle) {
    let Some(state) = app.try_state::<TrayItemState>() else {
        return;
    };
    if state.watch_started.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(15)).await;
            let running = matches!(
                tauri::async_runtime::spawn_blocking(read_status).await,
                Ok(s) if s.running
            );
            set_tray_checked(&app, running);
        }
    });
}

// ===== Tauri commands（渲染端只拿状态，不传命令/路径）=====

/// 读取本机设备执行器状态(只读)
#[tauri::command]
pub async fn device_executor_status() -> Result<DeviceExecutorStatus, String> {
    tauri::async_runtime::spawn_blocking(read_status)
        .await
        .map_err(|e| format!("读取执行器状态失败: {e}"))
}

/// 启动本机设备执行器(供远端设备任务调度使用)
#[tauri::command]
pub async fn device_executor_start(app: AppHandle) -> Result<DeviceExecutorStatus, String> {
    let app_for_start = app.clone();
    tauri::async_runtime::spawn_blocking(move || start_executor(&app_for_start))
        .await
        .map_err(|e| format!("启动执行器失败: {e}"))?
}

/// 停止本机设备执行器
#[tauri::command]
pub async fn device_executor_stop() -> Result<DeviceExecutorStatus, String> {
    tauri::async_runtime::spawn_blocking(stop_executor)
        .await
        .map_err(|e| format!("停止执行器失败: {e}"))?
}

/// 主机名（自助接入时的默认设备名；带后缀在设置页拼，避免与 CLI 已配对行撞名）
#[tauri::command]
pub fn device_executor_host_name() -> String {
    std::env::var("COMPUTERNAME")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "desktop".to_string())
}

/// 弹原生目录选择（工作区白名单的落点；取消返回 Err 让前端区分"没选"）。
fn pick_workspace(app: &AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app
        .dialog()
        .file()
        .set_title("选择本机执行器的工作区目录")
        .blocking_pick_folder();
    match picked {
        Some(path) => path
            .into_path()
            .map(|p| p.to_string_lossy().to_string())
            .map_err(|e| format!("目录路径不可用: {e}")),
        None => Err("已取消选择工作区".to_string()),
    }
}

/**
 * G5(2026-11-26)自助接入：把**已登录会话**签发的设备令牌交给 CLI 落盘，不需要配对码。
 *
 * 桌面端刻意不自己写 `~/.ihui/device.json`：那份凭证的指纹与工作区白名单只有 CLI 有
 * 唯一实现（写第二份必然漂移）。这里只做 CLI 做不了的三件事：
 *  1. 原生目录选择（工作区白名单的落点）；
 *  2. 令牌经 **stdin** 交给 CLI（不进 argv，进程列表里看不到）；
 *  3. 成功后立刻读回真实状态，让 UI 看到"已配对 / 是否在跑"。
 *
 * `payload` 是前端拼的 JSON（device_id / device_token / name / api_url）。字段语义的唯一真相源
 * 仍在本仓 CLI 的 adopt 命令；Rust 只做两件它必须做的事：长度闸（>8KB 直接拒），
 * 以及把**用户选定的工作区**注入 payload —— 因为 CLI 子命令的 `--workspace` 会被根命令的
 * `-w, --workspace` 先吃掉（2026-11-26 自验实测：传了目录却落盘成 cwd，任务跑错目录），
 * stdin 是这条路上唯一不会被 argv 解析抢走的通道。
 */
/// 用一次性接入载荷接入/接管执行器(载荷超过 8KB 直接拒收)
#[tauri::command]
pub async fn device_executor_adopt(
    app: AppHandle,
    payload: String,
    workspace: Option<String>,
) -> Result<DeviceExecutorStatus, String> {
    if payload.len() > 8 * 1024 {
        return Err("接入载荷过大(>8KB),已拒绝".to_string());
    }
    let chosen = match workspace.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        Some(dir) => dir,
        None => {
            let app_for_pick = app.clone();
            tauri::async_runtime::spawn_blocking(move || pick_workspace(&app_for_pick))
                .await
                .map_err(|e| format!("目录选择任务失败: {e}"))??
        }
    };
    if !std::path::Path::new(&chosen).is_dir() {
        return Err(format!("工作区不存在或不是目录: {chosen}"));
    }
    let ihui = find_ihui(Some(&app)).ok_or_else(|| {
        // 内置 CLI 需要宿主 Node;两条路都没有时给出可执行的一条命令。
        "没找到可用的 ihui：装上 Node(安装包内置 CLI 依赖它),或在命令行执行 npm i -g ihui-cli 后重试"
            .to_string()
    })?;
    // 把工作区注入载荷：CLI 侧 workspace 的优先级是 stdin > --dir > cwd,这里两条都给。
    let mut payload_value: serde_json::Value =
        serde_json::from_str(&payload).map_err(|e| format!("接入载荷不是合法 JSON: {e}"))?;
    match payload_value.as_object_mut() {
        Some(obj) => {
            obj.insert(
                "workspace".to_string(),
                serde_json::Value::String(chosen.clone()),
            );
        }
        None => return Err("接入载荷必须是 JSON 对象".to_string()),
    }
    let payload_for_child =
        serde_json::to_string(&payload_value).map_err(|e| format!("接入载荷序列化失败: {e}"))?;
    let dir = chosen.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let mut cmd = ihui.command();
        cmd.arg("device")
            .arg("adopt")
            .arg("--dir")
            .arg(&dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("启动 ihui device adopt 失败: {e}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            stdin
                .write_all(payload_for_child.as_bytes())
                .map_err(|e| format!("写入设备令牌失败: {e}"))?;
        }
        let out = child
            .wait_with_output()
            .map_err(|e| format!("等待 adopt 退出失败: {e}"))?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(if err.is_empty() {
                "ihui device adopt 失败(无 stderr 输出)".to_string()
            } else {
                err
            });
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("接入任务失败: {e}"))??;
    Ok(read_status())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cred(name: &str) -> String {
        format!(
            r#"{{"version":1,"apiUrl":"https://aizhs.top","deviceId":"d1","deviceToken":"t","fingerprint":"f","name":"{name}","workspaces":{{"repo":"D:\\repo"}},"pairedAt":"2026-11-26T00:00:00Z"}}"#
        )
    }

    #[test]
    fn credential_ok() {
        assert_eq!(
            device_name_from_credential(&cred("公司电脑")).as_deref(),
            Some("公司电脑")
        );
    }

    #[test]
    fn wrong_version_is_unpaired() {
        let raw = cred("公司电脑").replace("\"version\":1", "\"version\":2");
        assert_eq!(device_name_from_credential(&raw), None);
    }

    #[test]
    fn missing_field_is_unpaired() {
        let raw = cred("公司电脑").replace("\"fingerprint\":\"f\",", "");
        assert_eq!(device_name_from_credential(&raw), None);
    }

    #[test]
    fn bad_json_is_unpaired() {
        assert_eq!(device_name_from_credential("{not json"), None);
        assert_eq!(device_name_from_credential(""), None);
    }

    #[test]
    fn blank_name_is_unpaired() {
        assert_eq!(device_name_from_credential(&cred("   ")), None);
    }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
