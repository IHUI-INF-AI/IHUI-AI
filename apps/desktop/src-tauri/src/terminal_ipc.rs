// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


//! 终端会话 IPC 胶水 —— **只放 `#[tauri::command]` + wire DTO，不碰纯逻辑**。
//!
//! 分层纪律与 `git_channel_ipc.rs` 一致：`terminal_session.rs` 是执行层（只用 std +
//! 平台 API，可 `rustc --test` 单独跑单测）；本文件把它映射成 Tauri 命令与 serde DTO，
//! **不含任何终端状态判定**——混进 command 会污染可测性。
//!
//! 命令面（照 Trae `icube/command_execution/` 的 start/poll/write_stdin/list_owned +
//! `icube/terminal/` 的 run/status/cleanup 收敛）：
//! `terminal_start` / `terminal_poll` / `terminal_read` / `terminal_write` /
//! `terminal_kill` / `terminal_list` / `terminal_remove`。
//! 全部经 `State<TerminalManager>` 串行化访问；`kill_all` 由退出钩子调，不走命令。

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::State;

use crate::terminal_session::{SessionInfo, SessionState, TerminalManager, WriteErr};

/// 一个会话的对外快照（serde）。`state` 用小写字符串，与前端分派口径一致。
#[derive(Debug, Clone, Serialize)]
pub struct SessionWire {
    pub id: u64,
    pub state: String,
    pub exit_code: Option<i32>,
    pub elapsed_ms: u128,
    pub seq: usize,
}

impl From<SessionInfo> for SessionWire {
    fn from(i: SessionInfo) -> Self {
        Self {
            id: i.id,
            state: state_name(i.state).to_string(),
            exit_code: i.exit_code,
            elapsed_ms: i.elapsed_ms,
            seq: i.seq,
        }
    }
}

/// 状态枚举 → 线上名（单一出处，前端据此分派）。
fn state_name(s: SessionState) -> &'static str {
    match s {
        SessionState::Starting => "starting",
        SessionState::Running => "running",
        SessionState::Exited => "exited",
        SessionState::Killed => "killed",
        SessionState::TimedOut => "timed_out",
        SessionState::Failed => "failed",
    }
}

/// 读取输出响应。`dropped > 0` 表示开头已被环形缓冲覆盖——前端必须提示
/// 「窗口不完整」，不得当完整历史用（诚实纪律，与 workspace_index 同源）。
#[derive(Debug, Serialize)]
pub struct ReadReply {
    /// 输出（按时间顺序，最多 `max` 字节的最新窗口）。
    pub text: String,
    /// 累计因覆盖丢失的字节（环形缓冲封顶所致）。
    pub dropped: usize,
    /// 累计产出字节序号（前端做「读到哪了」去重）。
    pub seq: usize,
    pub state: String,
    /// 是否终态（终态后前端应停止轮询）。
    pub terminal: bool,
}

/// `terminal_start` 入参。`program` + `args` + 可选 `cwd` + 可选 `timeout_ms`。
#[derive(Debug, Deserialize)]
pub struct StartArgs {
    pub program: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[tauri::command]
pub fn terminal_start(
    args: StartArgs,
    mgr: State<'_, TerminalManager>,
) -> Result<serde_json::Value, String> {
    let cwd = args.cwd.as_deref().map(std::path::Path::new);
    let timeout = args.timeout_ms.map(Duration::from_millis);
    let id = mgr.start(&args.program, &args.args, cwd, timeout)?;
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub fn terminal_poll(id: u64, mgr: State<'_, TerminalManager>) -> Result<serde_json::Value, String> {
    let snap = mgr
        .with_session(id, |s| {
            s.poll();
            s.info()
        })
        .ok_or_else(|| format!("会话 {id} 不存在"))?;
    let w: SessionWire = snap.into();
    serde_json::to_value(w).map_err(|e| format!("序列化会话快照失败: {e}"))
}

#[tauri::command]
pub fn terminal_read(
    id: u64,
    max: Option<usize>,
    mgr: State<'_, TerminalManager>,
) -> Result<ReadReply, String> {
    let max = max.unwrap_or(64 * 1024).min(1024 * 1024);
    let (bytes, dropped, seq, state) = mgr
        .with_session(id, |s| s.read_out(max))
        .ok_or_else(|| format!("会话 {id} 不存在"))?;
    // 输出按 UTF-8 丢失替换解码：终端输出可能是分片多字节，lossy 是终端场景的正确选择
    // （不假装它是合法 UTF-8，也不因一个坏字节丢整段）。
    Ok(ReadReply {
        text: String::from_utf8_lossy(&bytes).into_owned(),
        dropped,
        seq,
        state: state_name(state).to_string(),
        terminal: state.is_terminal(),
    })
}

#[tauri::command]
pub fn terminal_write(
    id: u64,
    data: String,
    mgr: State<'_, TerminalManager>,
) -> Result<(), String> {
    mgr.with_session(id, |s| s.write_stdin(data.as_bytes()))
        .ok_or_else(|| format!("会话 {id} 不存在"))?
        .map(|_written| ())
        .map_err(|e| match e {
            WriteErr::AlreadyFinished => format!("会话 {id} 已结束，无法写入"),
            WriteErr::NoStdin => format!("会话 {id} 无 stdin"),
            WriteErr::BrokenPipe => format!("会话 {id} 管道已断"),
        })
}

#[tauri::command]
pub fn terminal_kill(id: u64, mgr: State<'_, TerminalManager>) -> Result<serde_json::Value, String> {
    let snap = mgr
        .with_session(id, |s| {
            s.kill();
            s.info()
        })
        .ok_or_else(|| format!("会话 {id} 不存在"))?;
    let w: SessionWire = snap.into();
    serde_json::to_value(w).map_err(|e| format!("序列化会话快照失败: {e}"))
}

#[tauri::command]
pub fn terminal_list(mgr: State<'_, TerminalManager>) -> Vec<SessionWire> {
    mgr.list().into_iter().map(Into::into).collect()
}

#[tauri::command]
pub fn terminal_remove(id: u64, mgr: State<'_, TerminalManager>) -> Result<(), String> {
    mgr.remove(id)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
