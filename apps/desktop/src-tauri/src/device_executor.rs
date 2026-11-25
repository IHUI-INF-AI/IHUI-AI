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

fn find_ihui() -> Option<String> {
    #[cfg(windows)]
    let probe = "where";
    #[cfg(not(windows))]
    let probe = "which";
    let out = hidden_command(probe).arg("ihui").output().ok()?;
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

pub fn start_executor() -> Result<DeviceExecutorStatus, String> {
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
        let exe = find_ihui().ok_or_else(|| {
            "没找到 ihui 命令：请先安装 CLI 并执行 ihui device pair <配对码>".to_string()
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
        let mut cmd = hidden_command(&exe);
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

// ===== Tauri commands（渲染端只拿状态，不传命令/路径）=====

#[tauri::command]
pub async fn device_executor_status() -> Result<DeviceExecutorStatus, String> {
    tauri::async_runtime::spawn_blocking(read_status)
        .await
        .map_err(|e| format!("读取执行器状态失败: {e}"))
}

#[tauri::command]
pub async fn device_executor_start() -> Result<DeviceExecutorStatus, String> {
    tauri::async_runtime::spawn_blocking(start_executor)
        .await
        .map_err(|e| format!("启动执行器失败: {e}"))?
}

#[tauri::command]
pub async fn device_executor_stop() -> Result<DeviceExecutorStatus, String> {
    tauri::async_runtime::spawn_blocking(stop_executor)
        .await
        .map_err(|e| format!("停止执行器失败: {e}"))?
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
