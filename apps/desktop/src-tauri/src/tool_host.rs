// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! W4-06 第一步：独立 `tool-host` 进程 + 命名管道 JSON-RPC。
//!
//! 目标：把「执行」从 UI 进程切出去。UI/会话进程只持客户端句柄；tool-host 独立重启，
//! 工具崩溃不带走会话。执行语义在宿主内完成，不在调用方进程里跑 `Command`。
//!
//! 契约要点（比源产品多的一维）：
//! - 每条请求带 `turnId + toolCallId` **双键**；同一双键重复请求返回缓存结果并标
//!   `replayed=true`，不重复执行——网络抖动/客户端重连不会产生第二次副作用。
//! - 命名管道名随机、首包 `service/Hello` 必须带 32 字节随机 token（`BCryptGenRandom`），
//!   不对 token 就断连；同机其它用户进程猜不到。
//! - 执行默认落在 **AppContainer** 子进程（`sandbox_spawn`）：令牌无 `internetClient`，
//!   网络栈直接拒绝出网；cwd 默认落在包自己的
//!   `%LOCALAPPDATA%\Packages\IHUI.ToolHost\AC\IHUI\sandbox\...`。可写根之外的写操作
//!   被 AppContainer/AC 边界拒——这是"能写自己的沙箱、写不了用户工作区"的默认边界。
//!   显式 `integrity=inherit` 只保留给需要写工作区的 CLI/Git 路径。
//!
//! 边界（如实登记）：
//! - 交互式终端（stdin 双向流）仍走 `TerminalSession`，不塞进本协议；本协议只做
//!   一次性执行（agent 工具语义）。
//! - MCP raw relay：宿主拉起并拥有 MCP stdio 子进程，CLI 通过 loopback + 一次性 token
//!   连接后继续用自己的 ndjson/content-length framing；宿主不解析 MCP 帧，因此不丢
//!   notification / progress，也不破坏并发 id 分派。旧的同步 `service/InitMcp` 保留给
//!   测试与简单探针，不作为生产 MCP 客户端路径。
//! - tool-host 自身以当前用户中完整性运行（要读写工作区）；默认被执行的命令是
//!   AppContainer，`inherit` 档则保留完整性与网络。MCP 仍走宿主普通子进程，未套
//!   AppContainer。

#![cfg(windows)]

use std::collections::{BTreeMap, HashMap, VecDeque};
use std::ffi::OsStr;
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Write};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{mpsc, Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, GetLastError, HANDLE};
use windows::Win32::Security::Cryptography::{
    BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG,
};
use windows::Win32::Storage::FileSystem::{
    ReadFile, WriteFile, PIPE_ACCESS_DUPLEX,
};
use windows::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, PIPE_READMODE_BYTE,
    PIPE_TYPE_BYTE, PIPE_WAIT,
};

use crate::sandbox_spawn::{self, IntegrityMode, SandboxSpec};

const PROTOCOL_VERSION: u8 = 1;
const OUTPUT_CAP_BYTES: usize = 1_048_576;
const HOST_VERSION: &str = "0.1.0";
/// 幂等缓存上限：只保最近 4096 次调用，防止长会话无限涨内存。
/// 被淘汰的旧双键再到达会重新执行——这是缓存，不是持久账本。
const IDEMPOTENCY_CACHE_MAX: usize = 4096;

/// 一条 JSON-RPC 请求（一行一条，UTF-8）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub v: u8,
    pub id: String,
    #[serde(rename = "turnId")]
    pub turn_id: String,
    #[serde(rename = "toolCallId")]
    pub tool_call_id: String,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

/// 一条 JSON-RPC 响应。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub v: u8,
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default)]
    pub replayed: bool,
}

impl RpcResponse {
    fn ok(id: String, result: Value, replayed: bool) -> Self {
        Self { v: PROTOCOL_VERSION, id, ok: true, result: Some(result), error: None, replayed }
    }
    fn err(id: String, message: impl Into<String>) -> Self {
        Self { v: PROTOCOL_VERSION, id, ok: false, result: None, error: Some(message.into()), replayed: false }
    }
}

#[derive(Debug, Serialize)]
struct PingResult<'a> {
    #[serde(rename = "hostPid")]
    host_pid: u32,
    #[serde(rename = "hostVersion")]
    host_version: &'a str,
    #[serde(rename = "sandboxTier")]
    sandbox_tier: &'a str,
    #[serde(rename = "sandboxSupported")]
    sandbox_supported: bool,
    #[serde(rename = "writableRoot")]
    writable_root: String,
}

#[derive(Debug, Deserialize)]
struct ExecuteParams {
    program: String,
    #[serde(default)]
    args: Vec<String>,
    cwd: Option<String>,
    #[serde(rename = "timeoutMs")]
    timeout_ms: Option<u64>,
    /// `low`（默认，MIC 写隔离）或 `inherit`（只做 Job 限额，保留当前完整性）。
    /// 显式取值，未知值拒绝；不把"没写"当成 inherit。
    integrity: Option<String>,
}

fn resolve_integrity(name: Option<&str>) -> Result<(IntegrityMode, &'static str), String> {
    match name.unwrap_or("low") {
        // 产品默认的“low”档现在落 AppContainer：低完整性之外，还切断网络。
        "low" => Ok((IntegrityMode::AppContainer, "appcontainer")),
        "appcontainer" => Ok((IntegrityMode::AppContainer, "appcontainer")),
        "inherit" => Ok((IntegrityMode::Inherit, "inherit")),
        other => Err(format!(
            "integrity 只支持 low|appcontainer|inherit，收到 {other:?}；不静默回落"
        )),
    }
}

#[derive(Debug, Deserialize)]
struct TaskPrepareParams {
    source: String,
    #[serde(rename = "taskId")]
    task_id: String,
}

#[derive(Debug, Deserialize)]
struct TaskIdParams {
    #[serde(rename = "taskId")]
    task_id: String,
}

#[derive(Debug, Deserialize)]
struct FileWriteParams {
    #[serde(rename = "taskId")]
    task_id: String,
    path: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct FileDeleteParams {
    #[serde(rename = "taskId")]
    task_id: String,
    path: String,
}

// ==================== MCP stdio 子进程（宿主内托管） ====================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum McpFraming {
    Ndjson,
    ContentLength,
}

impl McpFraming {
    fn parse(value: Option<&str>) -> Result<Self, String> {
        match value.unwrap_or("ndjson") {
            "ndjson" => Ok(Self::Ndjson),
            "content-length" => Ok(Self::ContentLength),
            other => Err(format!("MCP framing 只支持 ndjson|content-length，收到 {other:?}")),
        }
    }
}

#[derive(Debug, Deserialize)]
struct McpStartParams {
    #[serde(rename = "sessionId")]
    session_id: String,
    command: String,
    #[serde(default)]
    args: Vec<String>,
    cwd: Option<String>,
    /// `Some` 时用 `env_clear` 后只放这些键，避免把 CLI 的凭据环境带进第三方 MCP server；
    /// `None` 仅测试/本地直接调用时继承宿主环境。
    env: Option<BTreeMap<String, String>>,
    framing: Option<String>,
}

#[derive(Debug, Deserialize)]
struct McpRequestParams {
    #[serde(rename = "sessionId")]
    session_id: String,
    method: String,
    #[serde(default)]
    params: Value,
    #[serde(rename = "timeoutMs")]
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct McpNotifyParams {
    #[serde(rename = "sessionId")]
    session_id: String,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Deserialize)]
struct McpCloseParams {
    #[serde(rename = "sessionId")]
    session_id: String,
}

struct McpSession {
    child: Child,
    stdin: ChildStdin,
    messages: mpsc::Receiver<Value>,
    stderr_tail: Arc<Mutex<String>>,
    framing: McpFraming,
    next_id: u64,
}

fn cmd_quote(value: &str) -> String {
    if value.contains([' ', '\t', '"']) {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

fn mcp_command(params: &McpStartParams) -> Command {
    // `npx`/`.cmd` 不能直接 CreateProcess：走 cmd /d /s /c；.exe 直接起，避免多一层壳。
    let lower = params.command.to_ascii_lowercase();
    let via_cmd = lower.ends_with(".cmd") || lower.ends_with(".bat") || !lower.ends_with(".exe");
    if via_cmd {
        let mut line = cmd_quote(&params.command);
        for arg in &params.args {
            line.push(' ');
            line.push_str(&cmd_quote(arg));
        }
        let mut command = Command::new("cmd.exe");
        command.args(["/d", "/s", "/c", &line]);
        command
    } else {
        let mut command = Command::new(&params.command);
        command.args(&params.args);
        command
    }
}

fn read_mcp_message<R: BufRead>(reader: &mut R, framing: McpFraming) -> std::io::Result<Option<Value>> {
    match framing {
        McpFraming::Ndjson => loop {
            let mut line = String::new();
            let n = reader.read_line(&mut line)?;
            if n == 0 {
                return Ok(None);
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            return serde_json::from_str(trimmed)
                .map(Some)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e));
        },
        McpFraming::ContentLength => {
            let mut content_length = None;
            loop {
                let mut line = String::new();
                let n = reader.read_line(&mut line)?;
                if n == 0 {
                    return Ok(None);
                }
                let trimmed = line.trim_end();
                if trimmed.is_empty() {
                    break;
                }
                if let Some((name, value)) = trimmed.split_once(':') {
                    if name.trim().eq_ignore_ascii_case("content-length") {
                        content_length = value.trim().parse::<usize>().ok();
                    }
                }
            }
            let length = content_length.ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::InvalidData, "MCP content-length 缺失")
            })?;
            let mut body = vec![0u8; length];
            reader.read_exact(&mut body)?;
            serde_json::from_slice(&body)
                .map(Some)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        }
    }
}

impl McpSession {
    fn start(params: &McpStartParams) -> Result<Self, String> {
        if params.command.trim().is_empty() {
            return Err("MCP command 不能为空".to_string());
        }
        let framing = McpFraming::parse(params.framing.as_deref())?;
        let mut command = mcp_command(params);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(0x0800_0000);
        if let Some(cwd) = params.cwd.as_ref().filter(|c| !c.trim().is_empty()) {
            command.current_dir(cwd);
        }
        if let Some(env) = &params.env {
            command.env_clear();
            for (key, value) in env {
                command.env(key, value);
            }
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("拉起 MCP server 失败: {e}"))?;
        let stdin = child.stdin.take().ok_or_else(|| "MCP stdin 不可用".to_string())?;
        let stdout = child.stdout.take().ok_or_else(|| "MCP stdout 不可用".to_string())?;
        let stderr = child.stderr.take();
        let stderr_tail = Arc::new(Mutex::new(String::new()));
        if let Some(stderr) = stderr {
            let tail = stderr_tail.clone();
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap_or(0) == 0 {
                        break;
                    }
                    if let Ok(mut tail) = tail.lock() {
                        tail.push_str(&line);
                        if tail.len() > 4096 {
                            let keep = tail.len().saturating_sub(4096);
                            tail.drain(..keep);
                        }
                    }
                }
            });
        }
        let (tx, messages) = mpsc::channel::<Value>();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            while let Ok(Some(value)) = read_mcp_message(&mut reader, framing) {
                if tx.send(value).is_err() {
                    break;
                }
            }
        });
        Ok(Self { child, stdin, messages, stderr_tail, framing, next_id: 1 })
    }

    fn pid(&self) -> u32 {
        self.child.id()
    }

    fn stderr_suffix(&self) -> String {
        let tail = self
            .stderr_tail
            .lock()
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if tail.is_empty() {
            String::new()
        } else {
            format!(" (stderr: {tail})")
        }
    }

    fn write_message(&mut self, message: &Value) -> Result<(), String> {
        let body = serde_json::to_vec(message).map_err(|e| format!("MCP 编码失败: {e}"))?;
        let bytes = match self.framing {
            McpFraming::Ndjson => {
                let mut bytes = body;
                bytes.push(b'\n');
                bytes
            }
            McpFraming::ContentLength => {
                let mut bytes = format!("Content-Length: {}\r\n\r\n", body.len()).into_bytes();
                bytes.extend_from_slice(&body);
                bytes
            }
        };
        self.stdin
            .write_all(&bytes)
            .map_err(|e| format!("写 MCP stdin 失败{}{}", e, self.stderr_suffix()))
    }

    fn request(&mut self, method: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let message = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });
        self.write_message(&message)?;
        let deadline = Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(format!(
                    "MCP 请求超时: {method} ({}ms){}",
                    timeout.as_millis(),
                    self.stderr_suffix()
                ));
            }
            match self.messages.recv_timeout(remaining) {
                Ok(response) => {
                    if response.get("id").and_then(Value::as_u64) == Some(id) {
                        return Ok(response);
                    }
                    // notification / 其它请求的响应：本次同步请求不消费，继续等自己的 id。
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    return Err(format!(
                        "MCP 请求超时: {method} ({}ms){}",
                        timeout.as_millis(),
                        self.stderr_suffix()
                    ))
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err(format!(
                        "MCP 进程已退出，未返回 {method}{}",
                        self.stderr_suffix()
                    ))
                }
            }
        }
    }

    fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        let message = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        self.write_message(&message)
    }

    fn close(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for McpSession {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn start_mcp(state: &mut HostState, params: McpStartParams) -> Result<Value, String> {
    if params.session_id.trim().is_empty() {
        return Err("MCP sessionId 必填".to_string());
    }
    if state.mcp.contains_key(&params.session_id) {
        return Err(format!("MCP sessionId 已存在: {}", params.session_id));
    }
    let session = McpSession::start(&params)?;
    let pid = session.pid();
    state.mcp.insert(params.session_id.clone(), session);
    Ok(json!({ "sessionId": params.session_id, "pid": pid }))
}

// ==================== MCP raw relay（宿主归属 + CLI 原有 framing 不变） ====================
//
// `service/InitMcp` 的同步 request API 只能覆盖"宿主代替 CLI 发一条 MCP 请求"，
// 它会丢弃 server 主动 notification / progress，且无法并发多 id。要迁移真实 MCP
// 客户端而不降级语义，宿主只负责**拥有子进程**，把 stdin/stdout 原样桥接给 CLI：
// CLI 仍用自己的 ndjson/content-length 编解码、id 分派与 notification 处理。
//
// 数据面走 loopback：随机端口 + 32 字节一次性 token（首行校验），只接受一个连接；
// 不用可被同机进程猜测的固定管道名。控制面仍走 tool-host 命名管道。

struct McpRelay {
    child: Child,
    port: u16,
    stderr_port: u16,
    token: String,
}

impl McpRelay {
    fn start(params: &McpStartParams) -> Result<Self, String> {
        if params.command.trim().is_empty() {
            return Err("MCP command 不能为空".to_string());
        }
        let mut command = mcp_command(params);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(0x0800_0000);
        if let Some(cwd) = params.cwd.as_ref().filter(|c| !c.trim().is_empty()) {
            command.current_dir(cwd);
        }
        if let Some(env) = &params.env {
            command.env_clear();
            for (key, value) in env {
                command.env(key, value);
            }
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("拉起 MCP relay server 失败: {e}"))?;
        let stdin = child.stdin.take().ok_or_else(|| "MCP relay stdin 不可用".to_string())?;
        let stdout = child.stdout.take().ok_or_else(|| "MCP relay stdout 不可用".to_string())?;
        let stderr = child.stderr.take();
        let listener = TcpListener::bind(("127.0.0.1", 0))
            .map_err(|e| format!("MCP relay 绑定 loopback 失败: {e}"))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("MCP relay 读取端口失败: {e}"))?
            .port();
        let stderr_listener = TcpListener::bind(("127.0.0.1", 0))
            .map_err(|e| format!("MCP stderr relay 绑定 loopback 失败: {e}"))?;
        let stderr_port = stderr_listener
            .local_addr()
            .map_err(|e| format!("MCP stderr relay 读取端口失败: {e}"))?
            .port();
        let token = random_token();
        let expected = token.clone();
        let expected_stderr = token.clone();
        std::thread::spawn(move || {
            if let Err(e) = relay_loop(listener, stdin, stdout, expected) {
                eprintln!("[tool-host] MCP relay: {e}");
            }
        });
        if let Some(stderr) = stderr {
            std::thread::spawn(move || {
                if let Err(e) = stderr_relay_loop(stderr_listener, stderr, expected_stderr) {
                    eprintln!("[tool-host] MCP stderr relay: {e}");
                }
            });
        }
        Ok(Self { child, port, stderr_port, token })
    }

    fn pid(&self) -> u32 {
        self.child.id()
    }

    fn close(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for McpRelay {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn relay_loop(
    listener: TcpListener,
    mut stdin: ChildStdin,
    mut stdout: ChildStdout,
    expected_token: String,
) -> Result<(), String> {
    let (mut socket, _) = listener
        .accept()
        .map_err(|e| format!("MCP relay 接受连接失败: {e}"))?;
    socket.set_nodelay(true).ok();

    // 首行 token 是握手，不进入 MCP 帧。逐字节读到换行，避免 BufReader 预读吞掉
    // 紧随其后的第一个 MCP 帧。
    let mut token_line = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        let n = socket
            .read(&mut byte)
            .map_err(|e| format!("MCP relay 读 token 失败: {e}"))?;
        if n == 0 {
            return Err("MCP relay 连接在 token 前关闭".to_string());
        }
        if byte[0] == b'\n' {
            break;
        }
        if token_line.len() >= 128 {
            return Err("MCP relay token 过长".to_string());
        }
        token_line.push(byte[0]);
    }
    if String::from_utf8_lossy(&token_line).trim() != expected_token {
        return Err("MCP relay unauthorized".to_string());
    }

    let mut socket_reader = socket
        .try_clone()
        .map_err(|e| format!("MCP relay 复制读端失败: {e}"))?;
    let mut socket_writer = socket
        .try_clone()
        .map_err(|e| format!("MCP relay 复制写端失败: {e}"))?;
    let outbound = std::thread::spawn(move || {
        let copied = std::io::copy(&mut stdout, &mut socket_writer);
        let _ = socket_writer.shutdown(Shutdown::Both);
        copied
    });
    let _ = std::io::copy(&mut socket_reader, &mut stdin);
    let _ = socket.shutdown(Shutdown::Both);
    let _ = outbound.join();
    Ok(())
}

fn stderr_relay_loop(
    listener: TcpListener,
    mut stderr: ChildStderr,
    expected_token: String,
) -> Result<(), String> {
    let (mut socket, _) = listener
        .accept()
        .map_err(|e| format!("MCP stderr relay 接受连接失败: {e}"))?;
    socket.set_nodelay(true).ok();
    let token = read_relay_token(&mut socket)?;
    if token != expected_token {
        return Err("MCP stderr relay unauthorized".to_string());
    }
    let copied = std::io::copy(&mut stderr, &mut socket);
    let _ = socket.shutdown(Shutdown::Both);
    copied.map(|_| ()).map_err(|e| format!("MCP stderr relay 复制失败: {e}"))
}

fn read_relay_token(socket: &mut std::net::TcpStream) -> Result<String, String> {
    let mut token_line = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        let n = socket
            .read(&mut byte)
            .map_err(|e| format!("MCP relay 读 token 失败: {e}"))?;
        if n == 0 {
            return Err("MCP relay 连接在 token 前关闭".to_string());
        }
        if byte[0] == b'\n' {
            break;
        }
        if token_line.len() >= 128 {
            return Err("MCP relay token 过长".to_string());
        }
        token_line.push(byte[0]);
    }
    Ok(String::from_utf8_lossy(&token_line).trim().to_string())
}

fn start_mcp_relay(state: &mut HostState, params: McpStartParams) -> Result<Value, String> {
    if params.session_id.trim().is_empty() {
        return Err("MCP sessionId 必填".to_string());
    }
    if state.mcp.contains_key(&params.session_id) || state.mcp_relays.contains_key(&params.session_id) {
        return Err(format!("MCP sessionId 已存在: {}", params.session_id));
    }
    let relay = McpRelay::start(&params)?;
    let pid = relay.pid();
    let port = relay.port;
    let stderr_port = relay.stderr_port;
    let token = relay.token.clone();
    state.mcp_relays.insert(params.session_id.clone(), relay);
    Ok(json!({
        "sessionId": params.session_id,
        "host": "127.0.0.1",
        "port": port,
        "stderrPort": stderr_port,
        "token": token,
        "pid": pid,
    }))
}

struct HostState {
    token: String,
    root: PathBuf,
    sandbox_tier: &'static str,
    sandbox_supported: bool,
    /// `turnId|toolCallId` → 已完成的 result（幂等重放）
    completed: BTreeMap<String, Value>,
    /// 完成顺序，用于缓存超限时淘汰最旧的键
    completed_order: VecDeque<String>,
    /// MCP stdio 子进程；宿主退出时全部回收。
    mcp: BTreeMap<String, McpSession>,
    /// MCP raw relay；子进程归宿主，数据面由 CLI 自己 framing。
    mcp_relays: BTreeMap<String, McpRelay>,
    /// 任务工作副本；键是 taskId，Drop 时目录自动删除。
    tasks: BTreeMap<String, crate::task_workspace::TaskWorkspace>,
    /// 允许作为 TaskPrepare 源的已授权工作区根（canonical）；空集合 = 全部拒绝。
    approved_roots: Vec<PathBuf>,
}

fn wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

fn random_token() -> String {
    let mut buf = [0u8; 16];
    let status = unsafe { BCryptGenRandom(None, &mut buf, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
    if status.is_ok() {
        return buf.iter().map(|b| format!("{b:02x}")).collect();
    }
    // 极端兜底：时间 + pid 哈希（仍然不可预测到"下一条"，只是不是密码学随机）
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}{:x}", std::process::id())
}

/// 会话级可写根：默认 `%LOCALAPPDATA%\Packages\IHUI.ToolHost\AC\IHUI\sandbox\<pid>-<nonce>`；
/// 显式 `IHUI_SANDBOX_APPCONTAINER=0` 才回退旧的低完整性根并打 `(OI)(CI)L` 标签。
///
/// AppContainer 的 AC 目录天然可写，不需要放宽用户工作区 ACL；低完整性回退档才需要
/// `icacls /setintegritylevel`。两条都保留"有地方写，但写不进中完整性工作区"的边界。
fn prepare_writable_root(nonce: &str) -> Result<PathBuf, String> {
    // 默认跟执行档一致：AppContainer 的 AC 目录天然可写且不需要放宽用户工作区 ACL。
    // 只有显式 IHUI_SANDBOX_APPCONTAINER=0 才回退旧的低完整性根，便于排障。
    if std::env::var("IHUI_SANDBOX_APPCONTAINER").as_deref() != Ok("0") {
        return sandbox_spawn::appcontainer_sandbox_root(nonce);
    }
    let local = std::env::var("LOCALAPPDATA")
        .map_err(|_| "LOCALAPPDATA 未设置，无法建立沙箱可写根".to_string())?;
    let root = PathBuf::from(local)
        .join("IHUI")
        .join("sandbox")
        .join(format!("host-{}-{}", std::process::id(), nonce));
    std::fs::create_dir_all(&root)
        .map_err(|e| format!("创建沙箱可写根失败 {}: {e}", root.display()))?;
    let out = Command::new("icacls")
        .arg(&root)
        .arg("/setintegritylevel")
        .arg("(OI)(CI)L")
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("调用 icacls 失败: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "icacls 打低完整性标签失败 status={:?} stderr={}",
            out.status.code(),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(root)
}

/// TaskPrepare 的源工作区授权：只从宿主环境读，空 = 全部拒绝。
/// 由拉起宿主的调用方设置（CLI 用当前工作区；Desktop 用用户选中的根）。
fn approved_workspace_roots_from_env() -> Vec<PathBuf> {
    let raw = std::env::var("IHUI_TOOL_HOST_WORKSPACE_ROOTS").unwrap_or_default();
    raw.split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter_map(|s| PathBuf::from(s).canonicalize().ok())
        .collect()
}

/// 命名管道读端：按行切分，保留半行缓冲。
struct PipeReader {
    handle: HANDLE,
    buf: Vec<u8>,
}

impl PipeReader {
    fn new(handle: HANDLE) -> Self {
        Self { handle, buf: Vec::new() }
    }

    fn next_line(&mut self) -> Result<Option<String>, String> {
        loop {
            if let Some(pos) = self.buf.iter().position(|b| *b == b'\n') {
                let line = String::from_utf8_lossy(&self.buf[..pos]).trim().to_string();
                self.buf.drain(..=pos);
                if line.is_empty() {
                    continue;
                }
                return Ok(Some(line));
            }
            let mut chunk = [0u8; 8192];
            let mut read = 0u32;
            let res = unsafe { ReadFile(self.handle, Some(&mut chunk), Some(&mut read), None) };
            if let Err(e) = res {
                // ERROR_BROKEN_PIPE = 109：客户端断开，按 EOF 处理
                if e.code().0 as u32 == 0x8007_006D {
                    return Ok(None);
                }
                return Err(format!("ReadFile: {e}"));
            }
            if read == 0 {
                return Ok(None);
            }
            self.buf.extend_from_slice(&chunk[..read as usize]);
        }
    }
}

fn write_line(handle: HANDLE, line: &str) -> Result<(), String> {
    let bytes = format!("{line}\n").into_bytes();
    let mut offset = 0usize;
    while offset < bytes.len() {
        let mut written = 0u32;
        unsafe {
            WriteFile(
                handle,
                Some(&bytes[offset..]),
                Some(&mut written),
                None,
            )
        }
        .map_err(|e| format!("WriteFile: {e}"))?;
        if written == 0 {
            return Err("WriteFile 返回 0 字节".to_string());
        }
        offset += written as usize;
    }
    Ok(())
}

fn create_pipe(name: &str) -> Result<HANDLE, String> {
    let pipe_name = wide(&format!(r"\\.\pipe\{name}"));
    let handle = unsafe {
        CreateNamedPipeW(
            PCWSTR(pipe_name.as_ptr()),
            PIPE_ACCESS_DUPLEX,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
            1,
            65_536,
            65_536,
            0,
            None,
        )
    };
    if handle.is_invalid() {
        return Err(format!("CreateNamedPipeW 失败: {:?}", unsafe { GetLastError() }));
    }
    Ok(handle)
}

fn accept(handle: HANDLE) -> Result<(), String> {
    match unsafe { ConnectNamedPipe(handle, None) } {
        Ok(()) => Ok(()),
        Err(e) if e.code().0 as u32 == 0x8007_0217u32 => Ok(()), // ERROR_PIPE_CONNECTED
        Err(e) => Err(format!("ConnectNamedPipe: {e}")),
    }
}

fn decode_output(raw: &[u8]) -> String {
    // 1. UTF-16 BOM 优先：PowerShell / 部分 Windows 工具会输出 UTF-16LE。
    if raw.starts_with(&[0xFF, 0xFE]) {
        return decode_utf16(&raw[2..], true);
    }
    if raw.starts_with(&[0xFE, 0xFF]) {
        return decode_utf16(&raw[2..], false);
    }
    // 2. UTF-8 BOM 去掉后再按 UTF-8 解。
    let utf8_body = raw.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(raw);
    if let Ok(s) = std::str::from_utf8(utf8_body) {
        return s.to_string();
    }
    // 3. 无 BOM 但含大量 NUL 的偶数长度流：按 UTF-16LE 试解；解不出可读文本就放弃。
    if raw.len() >= 4 && raw.len() % 2 == 0 {
        let nul_ratio = raw.iter().filter(|b| **b == 0).count() as f32 / raw.len() as f32;
        if nul_ratio >= 0.25 {
            let decoded = decode_utf16(raw, true);
            if !decoded.contains('\u{FFFD}') {
                return decoded;
            }
        }
    }
    // 4. 中文 Windows 的 cmd 默认输出 GBK；GBK 有错时再退到 Windows-1252
    //    （后者对任意字节都不会失败，至少不会把整段输出变成 U+FFFD）。
    let (cow, _, had_errors) = encoding_rs::GBK.decode(raw);
    if !had_errors {
        return cow.into_owned();
    }
    let (fallback, _, _) = encoding_rs::WINDOWS_1252.decode(raw);
    fallback.into_owned()
}

fn decode_utf16(raw: &[u8], little_endian: bool) -> String {
    let units: Vec<u16> = raw
        .chunks_exact(2)
        .map(|pair| {
            if little_endian {
                u16::from_le_bytes([pair[0], pair[1]])
            } else {
                u16::from_be_bytes([pair[0], pair[1]])
            }
        })
        .collect();
    let mut out = String::with_capacity(units.len());
    for ch in char::decode_utf16(units) {
        out.push(ch.unwrap_or('\u{FFFD}'));
    }
    out
}

fn drain_stream(mut file: Option<File>, cap: usize) -> String {
    let Some(ref mut file) = file else {
        return String::new();
    };
    let mut raw = Vec::new();
    let mut buf = [0u8; 8192];
    loop {
        match file.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if raw.len() < cap {
                    let remaining = cap - raw.len();
                    let take = n.min(remaining);
                    raw.extend_from_slice(&buf[..take]);
                    if take < n {
                        raw.extend_from_slice(b"\n[output truncated at 1MiB]");
                        break;
                    }
                }
            }
            Err(_) => break,
        }
    }
    decode_output(&raw)
}

/// 宿主侧程序名收口：只接受真实存在的绝对路径，或唯一放行的 `cmd.exe` 别名。
///
/// 这不是要替代调用方的命令白名单，而是防止宿主被一个坏掉的客户端直接喂
/// `..\..\x.exe` / 相对路径 / 不存在的 PATH 名字；命令行内容策略仍由 CLI/桌面
/// 业务层负责（宿主没有 settings，不能假装自己知道用户的 allowlist）。
fn normalize_program(program: &str) -> Result<String, String> {
    if program.is_empty() {
        return Err("program 不能为空".to_string());
    }
    let path = Path::new(program);
    if path.is_absolute() {
        if !path.is_file() {
            return Err(format!("program 不存在: {}", path.display()));
        }
        return Ok(path.to_string_lossy().into_owned());
    }
    if path.components().count() != 1 {
        return Err(format!(
            "program 不允许相对路径（只接受绝对路径或 cmd.exe）: {program}"
        ));
    }
    if program.eq_ignore_ascii_case("cmd.exe") {
        let comspec = std::env::var("ComSpec")
            .unwrap_or_else(|_| r"C:\Windows\System32\cmd.exe".to_string());
        let comspec_path = Path::new(&comspec);
        if comspec_path.is_file() {
            return Ok(comspec);
        }
        return Ok(r"C:\Windows\System32\cmd.exe".to_string());
    }
    Err(format!(
        "program 不是绝对路径，且不在宿主唯一放行别名里: {program}"
    ))
}

fn execute(state: &HostState, params: ExecuteParams) -> Result<Value, String> {
    let (integrity, integrity_label) = resolve_integrity(params.integrity.as_deref())?;
    if integrity == IntegrityMode::AppContainer && !state.sandbox_supported {
        return Err("本机 AppContainer 沙箱不可用，拒绝执行（不回落裸跑）".to_string());
    }
    if params.program.contains('\0') {
        return Err("program 含 NUL，拒绝执行".to_string());
    }
    if params.args.len() > 1024 {
        return Err("args 数量超过宿主上限 1024".to_string());
    }
    let args_bytes: usize = params.args.iter().map(|a| a.len()).sum();
    if args_bytes > 256 * 1024 {
        return Err("args 总长度超过宿主上限 256KiB".to_string());
    }
    let program = normalize_program(params.program.trim())?;
    let timeout_ms = params
        .timeout_ms
        .unwrap_or(120_000)
        .clamp(1, 600_000);
    let mut spec = SandboxSpec::new(program);
    let is_cmd = Path::new(&spec.program)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.eq_ignore_ascii_case("cmd.exe"))
        .unwrap_or(false);
    if is_cmd && params.args.len() >= 3
        && params.args[0].eq_ignore_ascii_case("/d")
        && params.args[1].eq_ignore_ascii_case("/s")
        && params.args[2].eq_ignore_ascii_case("/c")
    {
        // cmd /d /s /c 有自己的引号规则，不能把每个参数按 CommandLineToArgvW 转义：
        // 否则 `> "C:\path"` 里的引号会变成 `\"`，cmd 报“文件名语法不正确”。
        // 这里把 /c 之后的完整命令作为一个字符串，外面只包一层引号交给 /s 规则。
        let command = params.args[3..].join(" ");
        let exe = if spec.program.contains([' ', '\t']) {
            format!("\"{}\"", spec.program)
        } else {
            spec.program.clone()
        };
        spec = spec.with_raw_command_line(format!("{exe} /d /s /c \"{command}\""));
    } else {
        spec.args = params.args;
    }
    spec.integrity = integrity;
    spec.cwd = Some(match params.cwd {
        Some(c) if !c.trim().is_empty() => PathBuf::from(c),
        _ => state.root.clone(),
    });
    if let Some(dir) = spec.cwd.as_ref() {
        if !dir.is_absolute() {
            return Err(format!("cwd 必须是绝对路径: {}", dir.display()));
        }
        if !dir.exists() {
            return Err(format!("cwd 不存在: {}", dir.display()));
        }
    }
    let started = Instant::now();
    let mut child = sandbox_spawn::spawn(&spec)?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let (out_tx, out_rx) = mpsc::channel::<String>();
    let (err_tx, err_rx) = mpsc::channel::<String>();
    let out_handle = std::thread::spawn(move || {
        let _ = out_tx.send(drain_stream(stdout, OUTPUT_CAP_BYTES));
    });
    let err_handle = std::thread::spawn(move || {
        let _ = err_tx.send(drain_stream(stderr, OUTPUT_CAP_BYTES));
    });

    let timeout = Duration::from_millis(timeout_ms);
    let (exit_code, timed_out) = match child.wait(Some(timeout)) {
        Ok(code) => (Some(code as i32), false),
        Err(e) if e == "wait timeout" => {
            let _ = child.kill();
            let _ = child.wait(Some(Duration::from_secs(5)));
            (None, true)
        }
        Err(e) => {
            let _ = child.kill();
            return Err(e);
        }
    };
    let stdout = out_rx.recv_timeout(Duration::from_secs(10)).unwrap_or_default();
    let stderr = err_rx.recv_timeout(Duration::from_secs(10)).unwrap_or_default();
    let _ = out_handle.join();
    let _ = err_handle.join();

    Ok(json!({
        "exitCode": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "timedOut": timed_out,
        "durationMs": started.elapsed().as_millis() as u64,
        "sandboxed": integrity == IntegrityMode::AppContainer,
        "jobIsolated": true,
        "integrityMode": integrity_label,
        "hostPid": std::process::id(),
        "cwd": spec.cwd.as_ref().map(|p| p.to_string_lossy().into_owned()),
    }))
}

impl HostState {
    /// 记一次成功执行；超上限时淘汰最旧的键（缓存，不是持久账本）。
    fn remember(&mut self, key: String, result: Value) {
        if self.completed.len() >= IDEMPOTENCY_CACHE_MAX {
            if let Some(oldest) = self.completed_order.pop_front() {
                self.completed.remove(&oldest);
            }
        }
        self.completed.insert(key.clone(), result);
        self.completed_order.push_back(key);
    }
}

fn dispatch(state: &mut HostState, req: &RpcRequest, authed: &mut bool, shutdown: &mut bool) -> RpcResponse {
    if req.v != PROTOCOL_VERSION {
        return RpcResponse::err(req.id.clone(), format!("协议版本不支持: {}", req.v));
    }
    if req.method == "service/Hello" {
        let token = req.params.get("token").and_then(Value::as_str).unwrap_or("");
        if token != state.token {
            return RpcResponse::err(req.id.clone(), "unauthorized");
        }
        *authed = true;
        return RpcResponse::ok(req.id.clone(), json!({ "ok": true, "protocol": PROTOCOL_VERSION }), false);
    }
    if !*authed {
        return RpcResponse::err(req.id.clone(), "unauthorized: 首包必须是 service/Hello");
    }
    match req.method.as_str() {
        "service/Ping" => RpcResponse::ok(
            req.id.clone(),
            serde_json::to_value(PingResult {
                host_pid: std::process::id(),
                host_version: HOST_VERSION,
                sandbox_tier: state.sandbox_tier,
                sandbox_supported: state.sandbox_supported,
                writable_root: state.root.to_string_lossy().into_owned(),
            })
            .unwrap_or(Value::Null),
            false,
        ),
        "service/Execute" => {
            if req.turn_id.is_empty() || req.tool_call_id.is_empty() {
                return RpcResponse::err(
                    req.id.clone(),
                    "turnId/toolCallId 必填：没有双键就无法判定幂等",
                );
            }
            let key = format!("{}|{}", req.turn_id, req.tool_call_id);
            if let Some(result) = state.completed.get(&key) {
                return RpcResponse::ok(req.id.clone(), result.clone(), true);
            }
            let params: ExecuteParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("params 非法: {e}")),
            };
            match execute(state, params) {
                Ok(result) => {
                    state.remember(key, result.clone());
                    RpcResponse::ok(req.id.clone(), result, false)
                }
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/InitMcp" | "service/McpStart" => {
            let params: McpStartParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("MCP params 非法: {e}")),
            };
            match start_mcp(state, params) {
                Ok(result) => RpcResponse::ok(req.id.clone(), result, false),
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/McpOpen" => {
            let params: McpStartParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("MCP params 非法: {e}")),
            };
            match start_mcp_relay(state, params) {
                Ok(result) => RpcResponse::ok(req.id.clone(), result, false),
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/McpRequest" => {
            let params: McpRequestParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("MCP params 非法: {e}")),
            };
            let timeout = Duration::from_millis(params.timeout_ms.unwrap_or(10_000));
            let session = match state.mcp.get_mut(&params.session_id) {
                Some(s) => s,
                None => {
                    return RpcResponse::err(
                        req.id.clone(),
                        format!("MCP session 不存在: {}", params.session_id),
                    )
                }
            };
            match session.request(&params.method, params.params, timeout) {
                Ok(response) => {
                    let peer_answered = response.get("result").is_some() || response.get("error").is_some();
                    RpcResponse::ok(
                        req.id.clone(),
                        json!({ "response": response, "peerAnswered": peer_answered }),
                        false,
                    )
                }
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/McpNotify" => {
            let params: McpNotifyParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("MCP params 非法: {e}")),
            };
            let session = match state.mcp.get_mut(&params.session_id) {
                Some(s) => s,
                None => {
                    return RpcResponse::err(
                        req.id.clone(),
                        format!("MCP session 不存在: {}", params.session_id),
                    )
                }
            };
            match session.notify(&params.method, params.params) {
                Ok(()) => RpcResponse::ok(req.id.clone(), json!({ "ok": true }), false),
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/McpClose" => {
            let params: McpCloseParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("MCP params 非法: {e}")),
            };
            if let Some(mut session) = state.mcp.remove(&params.session_id) {
                session.close();
                return RpcResponse::ok(req.id.clone(), json!({ "ok": true }), false);
            }
            if let Some(mut relay) = state.mcp_relays.remove(&params.session_id) {
                relay.close();
                return RpcResponse::ok(req.id.clone(), json!({ "ok": true, "relay": true }), false);
            }
            RpcResponse::ok(req.id.clone(), json!({ "ok": true, "alreadyClosed": true }), false)
        }
        "service/TaskPrepare" => {
            let params: TaskPrepareParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("Task params 非法: {e}")),
            };
            let source = match PathBuf::from(&params.source).canonicalize() {
                Ok(p) => p,
                Err(e) => {
                    return RpcResponse::err(req.id.clone(), format!("源工作区不可读: {e}"))
                }
            };
            if let Some(existing) = state.tasks.get(&params.task_id) {
                // 同一 taskId + 同一源 = 上一次响应丢包后的重放，返回同一副本，不重复建树；
                // 同 taskId 换源则视为客户端串号，拒绝。
                if existing.source() == source {
                    return RpcResponse::ok(
                        req.id.clone(),
                        json!({
                            "taskId": existing.task_id(),
                            "source": existing.source().to_string_lossy(),
                            "root": existing.stage_root().to_string_lossy(),
                            "replayed": true,
                        }),
                        false,
                    );
                }
                return RpcResponse::err(
                    req.id.clone(),
                    format!("taskId 已被另一个源占用: {}", params.task_id),
                );
            }
            if !state.approved_roots.iter().any(|root| root == &source) {
                return RpcResponse::err(
                    req.id.clone(),
                    "source_not_approved: 源工作区不在宿主已授权的 workspace roots 内",
                );
            }
            match crate::task_workspace::TaskWorkspace::prepare(&source, &params.task_id) {
                Ok(task) => {
                    let result = json!({
                        "taskId": task.task_id(),
                        "source": task.source().to_string_lossy(),
                        "root": task.stage_root().to_string_lossy(),
                    });
                    state.tasks.insert(params.task_id, task);
                    RpcResponse::ok(req.id.clone(), result, false)
                }
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/FileWrite" => {
            let params: FileWriteParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("FileWrite params 非法: {e}")),
            };
            let task = match state.tasks.get(&params.task_id) {
                Some(t) => t,
                None => return RpcResponse::err(req.id.clone(), format!("task 不存在: {}", params.task_id)),
            };
            match task.write_file(&params.path, &params.content) {
                Ok(bytes) => RpcResponse::ok(
                    req.id.clone(),
                    json!({
                        "taskId": params.task_id,
                        "path": params.path,
                        "bytes": bytes,
                    }),
                    false,
                ),
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/FileDelete" => {
            let params: FileDeleteParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => {
                    return RpcResponse::err(
                        req.id.clone(),
                        format!("FileDelete params 非法: {e}"),
                    )
                }
            };
            let task = match state.tasks.get(&params.task_id) {
                Some(t) => t,
                None => {
                    return RpcResponse::err(
                        req.id.clone(),
                        format!("task 不存在: {}", params.task_id),
                    )
                }
            };
            match task.delete_file(&params.path) {
                Ok(()) => RpcResponse::ok(
                    req.id.clone(),
                    json!({ "taskId": params.task_id, "path": params.path, "deleted": true }),
                    false,
                ),
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/TaskDiff" => {            let params: TaskIdParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("Task params 非法: {e}")),
            };
            let task = match state.tasks.get(&params.task_id) {
                Some(t) => t,
                None => return RpcResponse::err(req.id.clone(), format!("task 不存在: {}", params.task_id)),
            };
            match (task.diff_patch(), task.changed_files()) {
                (Ok(patch), Ok(changed_files)) => RpcResponse::ok(
                    req.id.clone(),
                    json!({ "taskId": params.task_id, "patch": patch, "changedFiles": changed_files }),
                    false,
                ),
                (Err(e), _) | (_, Err(e)) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/TaskPublish" => {
            let params: TaskIdParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("Task params 非法: {e}")),
            };
            let task = match state.tasks.get(&params.task_id) {
                Some(t) => t,
                None => return RpcResponse::err(req.id.clone(), format!("task 不存在: {}", params.task_id)),
            };
            match task.publish() {
                Ok(report) => RpcResponse::ok(
                    req.id.clone(),
                    json!({
                        "taskId": params.task_id,
                        "changedFiles": report.changed_files,
                        "patchBytes": report.patch_bytes,
                    }),
                    false,
                ),
                Err(e) => RpcResponse::err(req.id.clone(), e),
            }
        }
        "service/TaskAbandon" => {
            let params: TaskIdParams = match serde_json::from_value(req.params.clone()) {
                Ok(p) => p,
                Err(e) => return RpcResponse::err(req.id.clone(), format!("Task params 非法: {e}")),
            };
            if let Some(task) = state.tasks.remove(&params.task_id) {
                match task.abandon() {
                    Ok(()) => RpcResponse::ok(req.id.clone(), json!({ "ok": true }), false),
                    Err(e) => RpcResponse::err(req.id.clone(), e),
                }
            } else {
                RpcResponse::ok(req.id.clone(), json!({ "ok": true, "alreadyAbsent": true }), false)
            }
        }
        "service/Shutdown" => {
            for (_, mut session) in std::mem::take(&mut state.mcp) {
                session.close();
            }
            for (_, mut relay) in std::mem::take(&mut state.mcp_relays) {
                relay.close();
            }
            *shutdown = true;
            RpcResponse::ok(req.id.clone(), json!({ "ok": true }), false)
        }
        other => RpcResponse::err(req.id.clone(), format!("unknown_method: {other}")),
    }
}

/// 在独立进程里跑 tool-host：`ihui-tool-host.exe --pipe <name> --token <token>`。
pub fn run_tool_host(pipe_name: &str, token: &str) -> Result<(), String> {
    let nonce = token.get(0..8).unwrap_or("nonce");
    let root = prepare_writable_root(nonce)?;
    let probe = sandbox_spawn::probe();
    let mut state = HostState {
        token: token.to_string(),
        root,
        sandbox_tier: probe.tier,
        sandbox_supported: probe.supported,
        completed: BTreeMap::new(),
        completed_order: VecDeque::new(),
        mcp: BTreeMap::new(),
        mcp_relays: BTreeMap::new(),
        tasks: BTreeMap::new(),
        approved_roots: approved_workspace_roots_from_env(),
    };
    let handle = create_pipe(pipe_name)?;
    let mut should_exit = false;
    while !should_exit {
        accept(handle)?;
        let mut reader = PipeReader::new(handle);
        let mut authed = false;
        loop {
            match reader.next_line() {
                Ok(Some(line)) => {
                    let req: RpcRequest = match serde_json::from_str(&line) {
                        Ok(r) => r,
                        Err(e) => {
                            let resp = RpcResponse::err(String::new(), format!("bad_json: {e}"));
                            let text = serde_json::to_string(&resp).unwrap_or_else(|_| "{}".to_string());
                            let _ = write_line(handle, &text);
                            continue;
                        }
                    };
                    let resp = dispatch(&mut state, &req, &mut authed, &mut should_exit);
                    let text = serde_json::to_string(&resp)
                        .unwrap_or_else(|e| format!(r#"{{"v":1,"id":"","ok":false,"error":"serialize: {e}"}}"#));
                    if write_line(handle, &text).is_err() {
                        break;
                    }
                    // Shutdown 的响应写出去就收口，不能等客户端关管道——
                    // 否则客户端等 host 退出、host 等 EOF，双方互等（真机踩过）。
                    if should_exit {
                        break;
                    }
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }
        unsafe {
            let _ = DisconnectNamedPipe(handle);
        }
    }
    unsafe {
        let _ = CloseHandle(handle);
    }
    Ok(())
}

fn host_candidates_in(dir: &Path) -> Vec<PathBuf> {
    vec![
        dir.join("ihui-tool-host.exe"),
        dir.join("tool-host").join("ihui-tool-host.exe"),
        dir.join("resources").join("tool-host").join("ihui-tool-host.exe"),
    ]
}

/// tool-host 客户端：负责拉起子进程、握手、发请求、收响应。
pub struct ToolHostClient {
    child: Child,
    pipe: File,
    token: String,
    next_id: u64,
    buf: Vec<u8>,
}

/// 宿主拉起时的环境面收口：不把 UI/CLI 进程里的凭据变量原样带进宿主，
/// 只保留系统命令、Git 与 MCP 子进程正常运行所需的最小键。
///
/// 为什么不等 MCP 的 `env_clear`：`run_command` 的普通子进程继承宿主环境，
/// 若宿主继承了 App 的 API key，命令本身就能读走。这里先砍掉宿主这一层。
fn apply_host_env(command: &mut Command) {
    const KEEP: &[&str] = &[
        "SystemRoot",
        "SystemDrive",
        "windir",
        "ComSpec",
        "PATH",
        "PATHEXT",
        "TEMP",
        "TMP",
        "USERPROFILE",
        "HOME",
        "HOMEDRIVE",
        "HOMEPATH",
        "APPDATA",
        "LOCALAPPDATA",
        "PROGRAMDATA",
        "PROGRAMFILES",
        "PROGRAMFILES(X86)",
        "COMMONPROGRAMFILES",
        "COMMONPROGRAMFILES(X86)",
        "NUMBER_OF_PROCESSORS",
        "PROCESSOR_ARCHITECTURE",
        "OS",
        "LANG",
        "LC_ALL",
        "PSModulePath",
    ];
    command.env_clear();
    for key in KEEP {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    // TaskPrepare 的源根授权：只传这一项，空集合仍由宿主侧 fail-closed。
    if let Some(value) = std::env::var_os("IHUI_TOOL_HOST_WORKSPACE_ROOTS") {
        command.env("IHUI_TOOL_HOST_WORKSPACE_ROOTS", value);
    }
}

impl ToolHostClient {
    /// 找 `ihui-tool-host.exe`：`IHUI_TOOL_HOST_EXE` 显式覆盖优先；否则依次找
    /// 主程序同目录、`tool-host/`（Tauri resources 安装位）、`resources/tool-host/`（macOS
    /// bundle 形态）；debug 构建再找 `src-tauri/resources/tool-host/` 的开发态副本。
    pub fn spawn_default() -> Result<Self, String> {
        let exe = Self::find_default_exe().ok_or_else(|| {
            format!(
                "找不到 ihui-tool-host.exe；已查: {}",
                Self::default_exe_candidates()
                    .iter()
                    .map(|p| p.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        })?;
        Self::spawn_with_exe(&exe)
    }

    /// 只回答“默认布局里有没有宿主”，不拉起进程；给需要在启动前决定
    /// 「走宿主还是走本进程 Command」的业务通道用（git 通道的首个消费方）。
    /// `IHUI_TOOL_HOST_EXE` 显式指向但文件不存在时返回 `None`，不静默改走别的路径。
    pub fn find_default_exe() -> Option<PathBuf> {
        if let Ok(p) = std::env::var("IHUI_TOOL_HOST_EXE") {
            let path = PathBuf::from(p);
            return path.is_file().then_some(path);
        }
        Self::default_exe_candidates().into_iter().find(|p| p.is_file())
    }

    fn default_exe_candidates() -> Vec<PathBuf> {
        let mut candidates = Vec::new();
        if let Ok(current) = std::env::current_exe() {
            if let Some(dir) = current.parent() {
                candidates.extend(host_candidates_in(dir));
            }
        }
        #[cfg(debug_assertions)]
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("tool-host")
                .join("ihui-tool-host.exe"),
        );
        candidates
    }

    /// 按安装布局在指定目录找宿主：先根目录，再 Tauri resources 的 `tool-host/`，
    /// 再 macOS bundle 的 `resources/tool-host/`。这是安装后端到端判据的可测入口。
    pub fn spawn_from_dir(dir: &Path) -> Result<Self, String> {
        for exe in host_candidates_in(dir) {
            if exe.is_file() {
                return Self::spawn_with_exe(&exe);
            }
        }
        Err(format!(
            "{} 下找不到 ihui-tool-host.exe（查过根目录、tool-host/、resources/tool-host/）",
            dir.display()
        ))
    }

    pub fn spawn_with_exe(exe: &Path) -> Result<Self, String> {
        if !exe.is_file() {
            return Err(format!("tool-host 可执行文件不存在: {}", exe.display()));
        }
        let token = random_token();
        let pipe_name = format!(
            "ihui-tool-host-{}-{}",
            std::process::id(),
            &token[..token.len().min(12)]
        );
        let mut command = Command::new(exe);
        command
            .arg("--pipe")
            .arg(&pipe_name)
            .arg("--token")
            .arg(&token)
            .creation_flags(0x0800_0000);
        apply_host_env(&mut command);
        let child = command
            .spawn()
            .map_err(|e| format!("拉起 {exe:?} 失败: {e}"))?;
        let path = format!(r"\\.\pipe\{pipe_name}");
        let pipe = connect_retry(&path, Duration::from_secs(5))?;
        let mut client = Self { child, pipe, token, next_id: 1, buf: Vec::new() };
        let hello = client.call("service/Hello", "", "", json!({ "token": client.token.clone() }))?;
        if hello.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err(format!("tool-host 握手失败: {hello}"));
        }
        Ok(client)
    }

    pub fn ping(&mut self) -> Result<Value, String> {
        self.call("service/Ping", "", "", json!({}))
    }

    /// 在宿主授权的 workspace root 下准备一个可丢弃任务副本。
    pub fn task_prepare(&mut self, source: &Path, task_id: &str) -> Result<Value, String> {
        self.call(
            "service/TaskPrepare",
            "",
            "",
            json!({ "source": source.to_string_lossy(), "taskId": task_id }),
        )
    }

    /// 读取任务副本的变化；返回 `{patch, changedFiles}`。
    pub fn task_diff(&mut self, task_id: &str) -> Result<Value, String> {
        self.call("service/TaskDiff", "", "", json!({ "taskId": task_id }))
    }

    /// 显式把任务 patch apply 回源工作区。
    pub fn task_publish(&mut self, task_id: &str) -> Result<Value, String> {
        self.call("service/TaskPublish", "", "", json!({ "taskId": task_id }))
    }

    /// 丢弃任务副本（幂等）。
    pub fn task_abandon(&mut self, task_id: &str) -> Result<Value, String> {
        self.call("service/TaskAbandon", "", "", json!({ "taskId": task_id }))
    }

    /// 一次性执行，默认 `low` 档（MIC 写隔离）。`turn_id` + `tool_call_id` 双键决定幂等。
    pub fn execute(
        &mut self,
        turn_id: &str,
        tool_call_id: &str,
        program: &str,
        args: &[&str],
        cwd: Option<&Path>,
        timeout_ms: Option<u64>,
    ) -> Result<Value, String> {
        self.execute_with_integrity(turn_id, tool_call_id, program, args, cwd, timeout_ms, "low")
    }

    /// 显式指定完整性档：`low`（默认）或 `inherit`（需要写工作区的长任务）。
    #[allow(clippy::too_many_arguments)]
    pub fn execute_with_integrity(
        &mut self,
        turn_id: &str,
        tool_call_id: &str,
        program: &str,
        args: &[&str],
        cwd: Option<&Path>,
        timeout_ms: Option<u64>,
        integrity: &str,
    ) -> Result<Value, String> {
        self.call(
            "service/Execute",
            turn_id,
            tool_call_id,
            json!({
                "program": program,
                "args": args,
                "cwd": cwd.map(|p| p.to_string_lossy().into_owned()),
                "timeoutMs": timeout_ms,
                "integrity": integrity,
            }),
        )
    }

    /// 启动一个由宿主托管的 MCP stdio 子进程。`env=None` 仅测试/本地直接调用用；
    /// 生产调用方应传过滤后的环境，避免凭据变量进第三方 server。
    pub fn mcp_start(
        &mut self,
        session_id: &str,
        command: &str,
        args: &[&str],
        cwd: Option<&Path>,
        env: Option<&BTreeMap<String, String>>,
        framing: &str,
    ) -> Result<Value, String> {
        self.call(
            "service/InitMcp",
            "",
            "",
            json!({
                "sessionId": session_id,
                "command": command,
                "args": args,
                "cwd": cwd.map(|p| p.to_string_lossy().into_owned()),
                "env": env,
                "framing": framing,
            }),
        )
    }

    pub fn mcp_open(
        &mut self,
        session_id: &str,
        command: &str,
        args: &[&str],
        cwd: Option<&Path>,
        env: Option<&BTreeMap<String, String>>,
    ) -> Result<Value, String> {
        self.call(
            "service/McpOpen",
            "",
            "",
            json!({
                "sessionId": session_id,
                "command": command,
                "args": args,
                "cwd": cwd.map(|p| p.to_string_lossy().into_owned()),
                "env": env,
            }),
        )
    }

    pub fn mcp_request(
        &mut self,
        session_id: &str,
        method: &str,
        params: Value,
        timeout_ms: u64,
    ) -> Result<Value, String> {
        self.call(
            "service/McpRequest",
            "",
            "",
            json!({
                "sessionId": session_id,
                "method": method,
                "params": params,
                "timeoutMs": timeout_ms,
            }),
        )
    }

    pub fn mcp_notify(&mut self, session_id: &str, method: &str, params: Value) -> Result<Value, String> {
        self.call(
            "service/McpNotify",
            "",
            "",
            json!({ "sessionId": session_id, "method": method, "params": params }),
        )
    }

    pub fn mcp_close(&mut self, session_id: &str) -> Result<Value, String> {
        self.call("service/McpClose", "", "", json!({ "sessionId": session_id }))
    }

    pub fn shutdown(&mut self) -> Result<(), String> {
        let _ = self.call("service/Shutdown", "", "", json!({}));
        let _ = self.child.wait();
        Ok(())
    }

    fn call(&mut self, method: &str, turn_id: &str, tool_call_id: &str, params: Value) -> Result<Value, String> {
        let id = format!("req-{}", self.next_id);
        self.next_id += 1;
        let req = RpcRequest {
            v: PROTOCOL_VERSION,
            id: id.clone(),
            turn_id: turn_id.to_string(),
            tool_call_id: tool_call_id.to_string(),
            method: method.to_string(),
            params,
        };
        let line = serde_json::to_string(&req).map_err(|e| format!("序列化请求失败: {e}"))?;
        (&self.pipe)
            .write_all(format!("{line}\n").as_bytes())
            .map_err(|e| format!("写管道失败: {e}"))?;

        loop {
            if let Some(pos) = self.buf.iter().position(|b| *b == b'\n') {
                let line = String::from_utf8_lossy(&self.buf[..pos]).trim().to_string();
                self.buf.drain(..=pos);
                if line.is_empty() {
                    continue;
                }
                let resp: RpcResponse =
                    serde_json::from_str(&line).map_err(|e| format!("解析响应失败: {e} 原文={line}"))?;
                if resp.id != id {
                    // 单客户端串行请求，理论上不该有别的 id；有就丢弃并继续等
                    continue;
                }
                if !resp.ok {
                    return Err(resp.error.unwrap_or_else(|| "unknown tool-host error".to_string()));
                }
                let mut result = resp.result.unwrap_or(Value::Null);
                if let Some(obj) = result.as_object_mut() {
                    obj.insert("replayed".to_string(), Value::Bool(resp.replayed));
                }
                return Ok(result);
            }
            let mut chunk = [0u8; 8192];
            let n = self.pipe.read(&mut chunk).map_err(|e| format!("读管道失败: {e}"))?;
            if n == 0 {
                return Err("tool-host 连接已断开".to_string());
            }
            self.buf.extend_from_slice(&chunk[..n]);
        }
    }
}

impl Drop for ToolHostClient {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// 会话侧持有的宿主句柄池：懒启动、按需扩容、传输出错即丢弃重建。
///
/// `max` 默认 2（`IHUI_TOOL_HOST_POOL_SIZE` 可调 1..8）。池内每条客户端各自持有
/// 一条命名管道和一个宿主进程；并发调用拿不同客户端，不再把整个桌面端串行化。
/// 宿主崩溃只丢它自己那条；幂等缓存随该宿主重启清空，调用方不能把重放当跨重启保证。
struct ClientPool {
    idle: Vec<ToolHostClient>,
    live: usize,
    max: usize,
}

/// 管理器级幂等缓存：池里有多个宿主时，单靠每个宿主自己的缓存不够——
/// 同一个 `turnId|toolCallId` 重试可能被调度到另一个宿主，于是第二次副作用。
/// 这里在调度之前先按双键串行化并缓存最终结果；不同键仍可并行走不同客户端。
struct ManagerCache {
    values: BTreeMap<String, Value>,
    order: VecDeque<String>,
    gates: HashMap<String, Arc<Mutex<()>>>,
}

impl ManagerCache {
    fn new() -> Self {
        Self { values: BTreeMap::new(), order: VecDeque::new(), gates: HashMap::new() }
    }

    fn gate(&mut self, key: &str) -> Arc<Mutex<()>> {
        self.gates
            .entry(key.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    fn get(&self, key: &str) -> Option<Value> {
        self.values.get(key).cloned().map(|mut value| {
            if let Some(object) = value.as_object_mut() {
                object.insert("replayed".to_string(), Value::Bool(true));
            }
            value
        })
    }

    fn remember(&mut self, key: String, value: Value) {
        if self.values.insert(key.clone(), value).is_none() {
            self.order.push_back(key);
        }
        while self.order.len() > IDEMPOTENCY_CACHE_MAX {
            if let Some(oldest) = self.order.pop_front() {
                self.values.remove(&oldest);
                self.gates.remove(&oldest);
            }
        }
    }

    fn clear(&mut self) {
        self.values.clear();
        self.order.clear();
        // 正在飞的同一双键不能把闸门一起清掉，否则 restart 后重试会拿新闸门
        // 与旧执行并行，跨宿主去重出现一个窄窗口。只保留仍被持有的闸门；
        // 执行结束后由 execute_with_integrity / remember 自己 remove。
        self.gates.retain(|_, gate| gate.try_lock().is_err());
    }
}

pub struct ToolHostManager {
    exe: Option<PathBuf>,
    pool: Mutex<ClientPool>,
    cv: Condvar,
    cache: Mutex<ManagerCache>,
}

impl Default for ToolHostManager {
    fn default() -> Self {
        Self::new(None)
    }
}

fn pool_size_from_env() -> usize {
    std::env::var("IHUI_TOOL_HOST_POOL_SIZE")
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(2)
        .clamp(1, 8)
}

impl ToolHostManager {
    /// `exe=None` 时按 `ToolHostClient::spawn_default` 的规则找同目录宿主。
    pub fn new(exe: Option<PathBuf>) -> Self {
        Self::new_with_max(exe, pool_size_from_env())
    }

    /// 显式池上限（测试和嵌入式调用用）；生产走 `new` 的环境变量规则。
    pub fn new_with_max(exe: Option<PathBuf>, max: usize) -> Self {
        let max = max.clamp(1, 8);
        Self {
            exe,
            pool: Mutex::new(ClientPool { idle: Vec::new(), live: 0, max }),
            cv: Condvar::new(),
            cache: Mutex::new(ManagerCache::new()),
        }
    }

    /// 是否有可启动的宿主：只查文件，不懒启动。业务通道据此决定走宿主还是
    /// 本进程 `Command`；宿主存在但 RPC 失败时不再回退（避免同一命令两条路径）。
    pub fn available(&self) -> bool {
        match self.exe.as_ref() {
            Some(path) => path.is_file(),
            None => ToolHostClient::find_default_exe().is_some(),
        }
    }

    /// 池上限（测试/诊断可见）。
    pub fn pool_size(&self) -> usize {
        self.pool.lock().map(|p| p.max).unwrap_or(0)
    }

    fn with_client<T>(
        &self,
        f: impl FnOnce(&mut ToolHostClient) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut pool = self
            .pool
            .lock()
            .map_err(|_| "tool-host manager 锁已中毒，拒绝继续".to_string())?;
        let mut client = loop {
            if let Some(client) = pool.idle.pop() {
                drop(pool);
                break client;
            }
            if pool.live < pool.max {
                pool.live += 1;
                drop(pool);
                let spawned = match self.exe.as_ref() {
                    Some(path) => ToolHostClient::spawn_with_exe(path),
                    None => ToolHostClient::spawn_default(),
                };
                match spawned {
                    Ok(client) => break client,
                    Err(e) => {
                        let mut pool = self
                            .pool
                            .lock()
                            .map_err(|_| "tool-host manager 锁已中毒，拒绝继续".to_string())?;
                        pool.live = pool.live.saturating_sub(1);
                        self.cv.notify_one();
                        return Err(e);
                    }
                }
            }
            pool = self
                .cv
                .wait(pool)
                .map_err(|_| "tool-host manager 锁已中毒，拒绝继续".to_string())?;
        };
        let result = f(&mut client);
        let mut pool = self
            .pool
            .lock()
            .map_err(|_| "tool-host manager 锁已中毒，拒绝继续".to_string())?;
        if result.is_ok() {
            // 业务非零退出走 Ok(result)，客户端可复用；传输层/RPC 错误走 Err，
            // 丢掉这一条，下一次调用重建，避免把坏管道放回池里。
            pool.idle.push(client);
        } else {
            pool.live = pool.live.saturating_sub(1);
        }
        self.cv.notify_one();
        result
    }

    pub fn ping(&self) -> Result<Value, String> {
        self.with_client(|c| c.ping())
    }

    pub fn execute(
        &self,
        turn_id: &str,
        tool_call_id: &str,
        program: &str,
        args: &[&str],
        cwd: Option<&Path>,
        timeout_ms: Option<u64>,
    ) -> Result<Value, String> {
        self.execute_with_integrity(
            turn_id,
            tool_call_id,
            program,
            args,
            cwd,
            timeout_ms,
            "low",
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn execute_with_integrity(
        &self,
        turn_id: &str,
        tool_call_id: &str,
        program: &str,
        args: &[&str],
        cwd: Option<&Path>,
        timeout_ms: Option<u64>,
        integrity: &str,
    ) -> Result<Value, String> {
        let key = format!("{turn_id}|{tool_call_id}");
        let gate = {
            let mut cache = self
                .cache
                .lock()
                .map_err(|_| "tool-host manager 缓存锁已中毒，拒绝继续".to_string())?;
            if let Some(hit) = cache.get(&key) {
                return Ok(hit);
            }
            cache.gate(&key)
        };
        // 同一双键只允许一个执行在飞；跨宿主的重试也不会产生第二次副作用。
        let _serial = gate
            .lock()
            .map_err(|_| "tool-host manager 幂等闸门已中毒，拒绝继续".to_string())?;
        {
            let cache = self
                .cache
                .lock()
                .map_err(|_| "tool-host manager 缓存锁已中毒，拒绝继续".to_string())?;
            if let Some(hit) = cache.get(&key) {
                return Ok(hit);
            }
        }

        let result = match self.with_client(|c| {
            c.execute_with_integrity(
                turn_id,
                tool_call_id,
                program,
                args,
                cwd,
                timeout_ms,
                integrity,
            )
        }) {
            Ok(result) => result,
            Err(error) => {
                if let Ok(mut cache) = self.cache.lock() {
                    cache.gates.remove(&key);
                }
                return Err(error);
            }
        };
        {
            let mut cache = self
                .cache
                .lock()
                .map_err(|_| "tool-host manager 缓存锁已中毒，拒绝继续".to_string())?;
            cache.remember(key.clone(), result.clone());
            cache.gates.remove(&key);
        }
        Ok(result)
    }

    /// 主动重启空闲宿主：先优雅关，下一次调用懒启动。返回新宿主的 Ping。
    /// 正在执行的客户端不在池里，不会被这次重启打断。
    pub fn restart(&self) -> Result<Value, String> {
        let drained = {
            let mut pool = self
                .pool
                .lock()
                .map_err(|_| "tool-host manager 锁已中毒，拒绝继续".to_string())?;
            let drained: Vec<ToolHostClient> = pool.idle.drain(..).collect();
            pool.live = pool.live.saturating_sub(drained.len());
            self.cv.notify_all();
            drained
        };
        for mut client in drained {
            let _ = client.shutdown();
        }
        if let Ok(mut cache) = self.cache.lock() {
            cache.clear();
        }
        self.ping()
    }
}

fn connect_retry(path: &str, timeout: Duration) -> Result<File, String> {
    let deadline = Instant::now() + timeout;
    loop {
        match std::fs::OpenOptions::new().read(true).write(true).open(path) {
            Ok(f) => return Ok(f),
            Err(e) => {
                if Instant::now() >= deadline {
                    return Err(format!("连接 {path} 超时: {e}"));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
}

/// 供 bin 入口解析参数。
pub fn run_from_args() -> Result<(), String> {
    let mut pipe = None;
    let mut token = None;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--pipe" => pipe = args.next(),
            "--token" => token = args.next(),
            other => return Err(format!("未知参数: {other}")),
        }
    }
    let pipe = pipe.ok_or_else(|| "--pipe 必填".to_string())?;
    let token = token.ok_or_else(|| "--token 必填".to_string())?;
    run_tool_host(&pipe, &token)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> HostState {
        HostState {
            token: "secret".to_string(),
            root: std::env::temp_dir(),
            sandbox_tier: "low-integrity-job",
            sandbox_supported: true,
            completed: BTreeMap::new(),
            completed_order: VecDeque::new(),
            mcp: BTreeMap::new(),
            mcp_relays: BTreeMap::new(),
            tasks: BTreeMap::new(),
            approved_roots: Vec::new(),
        }
    }

    fn request(method: &str, token: &str) -> RpcRequest {
        let mut req = request_with_params(method, json!({ "token": token }));
        req.id = "req-test".to_string();
        req
    }

    fn request_with_params(method: &str, params: Value) -> RpcRequest {
        RpcRequest {
            v: PROTOCOL_VERSION,
            id: "req-test".to_string(),
            turn_id: String::new(),
            tool_call_id: String::new(),
            method: method.to_string(),
            params,
        }
    }

    #[test]
    fn task_rpc_requires_approved_source_and_abandons_stage() {
        let source = std::env::temp_dir().join(format!("ihui-task-rpc-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&source);
        std::fs::create_dir_all(&source).unwrap();
        let git = |args: &[&str]| {
            let out = Command::new("git").arg("-C").arg(&source).args(args).output().unwrap();
            assert!(out.status.success(), "git {:?}: {}", args, String::from_utf8_lossy(&out.stderr));
        };
        git(&["init", "--quiet"]);
        git(&["config", "user.name", "Test"]);
        git(&["config", "user.email", "test@ihui.local"]);
        std::fs::write(source.join("a.txt"), "before\n").unwrap();
        git(&["add", "a.txt"]);
        git(&["commit", "--quiet", "-m", "init"]);

        let approved = source.canonicalize().unwrap();
        let mut state = state();
        state.approved_roots = vec![approved.clone()];
        let mut authed = true;
        let mut shutdown = false;

        let prep = request_with_params(
            "service/TaskPrepare",
            json!({ "source": approved.to_string_lossy(), "taskId": "rpc-task" }),
        );
        let prep_resp = dispatch(&mut state, &prep, &mut authed, &mut shutdown);
        assert!(prep_resp.ok, "授权源应可准备: {:?}", prep_resp.error);
        assert!(state.tasks.contains_key("rpc-task"));

        // 同一 taskId + 同一源的重放：返回同一副本，不重复建树、不报“task 已存在”。
        let replay = request_with_params(
            "service/TaskPrepare",
            json!({ "source": approved.to_string_lossy(), "taskId": "rpc-task" }),
        );
        let replay_resp = dispatch(&mut state, &replay, &mut authed, &mut shutdown);
        assert!(replay_resp.ok, "同源同 taskId 重放应成功: {:?}", replay_resp.error);
        assert_eq!(state.tasks.len(), 1, "重放不能新建第二个副本");

        // 宿主网关写入任务副本；源工作区在 publish 前不得变化。
        let write = request_with_params(
            "service/FileWrite",
            json!({ "taskId": "rpc-task", "path": "a.txt", "content": "after\n" }),
        );
        let write_resp = dispatch(&mut state, &write, &mut authed, &mut shutdown);
        assert!(write_resp.ok, "任务副本网关写入应成功: {:?}", write_resp.error);
        assert_eq!(
            std::fs::read_to_string(state.tasks.get("rpc-task").unwrap().stage_root().join("a.txt")).unwrap(),
            "after\n"
        );
        assert_eq!(std::fs::read_to_string(source.join("a.txt")).unwrap(), "before\n");

        // FileDelete 同样只作用于任务副本；删除一个本任务新建的文件不应影响源。
        let temp_write = request_with_params(
            "service/FileWrite",
            json!({ "taskId": "rpc-task", "path": "temp.txt", "content": "tmp\n" }),
        );
        assert!(dispatch(&mut state, &temp_write, &mut authed, &mut shutdown).ok);
        let delete = request_with_params(
            "service/FileDelete",
            json!({ "taskId": "rpc-task", "path": "temp.txt" }),
        );
        let delete_resp = dispatch(&mut state, &delete, &mut authed, &mut shutdown);
        assert!(delete_resp.ok, "任务副本网关删除应成功: {:?}", delete_resp.error);
        assert!(!state.tasks.get("rpc-task").unwrap().stage_root().join("temp.txt").exists());
        assert!(!source.join("temp.txt").exists());

        // 同一 taskId 换源必须拒绝，不能把 A 的副本句柄交给 B。
        let other = std::env::temp_dir().canonicalize().unwrap();
        state.approved_roots.push(other.clone());
        let conflict = request_with_params(
            "service/TaskPrepare",
            json!({ "source": other.to_string_lossy(), "taskId": "rpc-task" }),
        );
        let conflict_resp = dispatch(&mut state, &conflict, &mut authed, &mut shutdown);
        assert!(!conflict_resp.ok, "taskId 换源必须拒绝");

        let diff = request_with_params("service/TaskDiff", json!({ "taskId": "rpc-task" }));
        let diff_resp = dispatch(&mut state, &diff, &mut authed, &mut shutdown);
        assert!(diff_resp.ok, "网关写入后应能返回 diff");
        let diff_result = diff_resp.result.unwrap_or_default();
        assert_eq!(diff_result["changedFiles"].as_array().map(Vec::len), Some(1));

        let publish = request_with_params("service/TaskPublish", json!({ "taskId": "rpc-task" }));
        let publish_resp = dispatch(&mut state, &publish, &mut authed, &mut shutdown);
        assert!(publish_resp.ok, "干净源应可 publish: {:?}", publish_resp.error);
        assert_eq!(std::fs::read_to_string(source.join("a.txt")).unwrap(), "after\n");

        let abandon = request_with_params("service/TaskAbandon", json!({ "taskId": "rpc-task" }));
        let abandon_resp = dispatch(&mut state, &abandon, &mut authed, &mut shutdown);
        assert!(abandon_resp.ok);
        assert!(!state.tasks.contains_key("rpc-task"));

        let bad = request_with_params(
            "service/TaskPrepare",
            json!({ "source": std::env::temp_dir().to_string_lossy(), "taskId": "rpc-bad" }),
        );
        state.approved_roots = vec![approved.clone()];
        let bad_resp = dispatch(&mut state, &bad, &mut authed, &mut shutdown);
        assert!(!bad_resp.ok, "未授权源必须拒绝");
        assert!(bad_resp.error.unwrap_or_default().contains("source_not_approved"));
        let _ = std::fs::remove_dir_all(&source);
    }

    #[test]
    fn hello_rejects_wrong_token_and_requires_first_packet() {
        let mut state = state();
        let mut authed = false;
        let mut shutdown = false;

        let bad = request("service/Hello", "wrong");
        let bad_resp = dispatch(&mut state, &bad, &mut authed, &mut shutdown);
        assert!(!bad_resp.ok, "错 token 必须拒绝");
        assert!(!authed, "错 token 不能建立会话");

        let early = request("service/Ping", "");
        let early_resp = dispatch(&mut state, &early, &mut authed, &mut shutdown);
        assert!(!early_resp.ok, "首包不是 Hello 时 Ping 必须拒绝");

        let good = request("service/Hello", "secret");
        let good_resp = dispatch(&mut state, &good, &mut authed, &mut shutdown);
        assert!(good_resp.ok);
        assert!(authed);

        let ping = request("service/Ping", "");
        let ping_resp = dispatch(&mut state, &ping, &mut authed, &mut shutdown);
        assert!(ping_resp.ok);
        assert_eq!(
            ping_resp.result.unwrap_or(Value::Null)["hostPid"],
            json!(std::process::id())
        );
    }

    #[test]
    fn idempotency_cache_evicts_oldest_at_cap() {
        let mut state = state();
        for i in 0..=IDEMPOTENCY_CACHE_MAX {
            state.remember(format!("turn-{i}|call-{i}"), json!({ "i": i }));
        }
        assert_eq!(state.completed.len(), IDEMPOTENCY_CACHE_MAX);
        assert_eq!(state.completed_order.len(), IDEMPOTENCY_CACHE_MAX);
        assert!(!state.completed.contains_key("turn-0|call-0"), "最旧键应被淘汰");
        assert!(state
            .completed
            .contains_key(&format!("turn-{IDEMPOTENCY_CACHE_MAX}|call-{IDEMPOTENCY_CACHE_MAX}")));
    }

    #[test]
    fn manager_cache_clear_keeps_inflight_gates() {
        let mut cache = ManagerCache::new();
        let gate = cache.gate("turn-live|call-live");
        let guard = gate.lock().unwrap();
        cache.clear();
        assert!(
            cache.gates.contains_key("turn-live|call-live"),
            "restart 清缓存不能把正在飞的闸门删掉，否则同双键重试会并行"
        );
        drop(guard);
        cache.clear();
        assert!(!cache.gates.contains_key("turn-live|call-live"), "执行结束后闸门应可清");
    }

    #[test]
    fn output_decoder_handles_utf8_gbk_utf16_and_never_emits_replacement_for_1252() {
        assert_eq!(decode_output("中文-utf8".as_bytes()), "中文-utf8");

        let (gbk, _, _) = encoding_rs::GBK.encode("中文-gbk");
        assert_eq!(decode_output(&gbk), "中文-gbk");

        let utf16le: Vec<u8> = "中文-utf16"
            .encode_utf16()
            .flat_map(|unit| unit.to_le_bytes())
            .collect();
        assert_eq!(decode_output(&utf16le), "中文-utf16");

        // 0x81/0x8D 在 GBK 里不是合法双字节；必须退到 Windows-1252，而不是整段 U+FFFD。
        let undecodable = [0x81u8, 0x8D];
        assert!(!decode_output(&undecodable).contains('\u{FFFD}'));
    }

    #[test]
    fn normalize_program_rejects_relative_and_missing_paths_but_allows_comspec_alias() {
        assert!(normalize_program(r"..\evil.exe").is_err());
        assert!(normalize_program(r"C:\definitely-not-exist\evil.exe").is_err());
        let comspec = normalize_program("cmd.exe").expect("cmd.exe 别名");
        assert!(Path::new(&comspec).is_file());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
