// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! L03 审批反向通道:命名管道(ACL 限当前用户)+ 新行分帧的一问一答。
//!
//! 分工:ACL 与受保护句柄归 `ipc_channel_acl`(B2-02,当前用户 + SYSTEM,已复核
//! SDDL 两条 ACE);本模块只加"连接 → 收一帧 → 回一帧"的审批传输,不另造 ACL。
//!
//! 为什么是一问一答而不是长连接:审批队列(`packages/agent-sdk` 的
//! `ApprovalChannel`)负责排序、断线补发与审计;管道只承担桌面壳 ↔ 本地代理之间
//! 最窄的一条传输面。每次请求一条连接,没有跨请求状态,断线重连天然幂等。
#![cfg(windows)]

use std::ffi::OsStr;
use std::io;
use std::os::windows::ffi::OsStrExt;
use std::process::Command;
use std::thread;
use std::time::Duration;

use windows_sys::Win32::Foundation::{
    CloseHandle, GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Storage::FileSystem::{CreateFileW, ReadFile, WriteFile, OPEN_EXISTING};
use windows_sys::Win32::System::Pipes::PIPE_REJECT_REMOTE_CLIENTS;

use crate::ipc_channel_acl::create_restricted_pipe;

pub const APPROVAL_PIPE_PREFIX: &str = r"\\.\pipe\ihui-approval-";
/// 单条消息上限;超过即拒绝,避免本地进程用大包打爆壳侧内存。
pub const APPROVAL_PIPE_MAX_MESSAGE: usize = 64 * 1024;
const CONNECT_RETRIES: usize = 100;
const CONNECT_RETRY_DELAY: Duration = Duration::from_millis(20);

/// 把 sessionId 映射成合法且不撞名的管道名。
///
/// 只保留 ASCII 字母数字与 `-`/`_`,再拼 8 位 FNV-1a 摘要:即使两个 sessionId
/// 清洗后相同(如 `a/b` 与 `a\b`),摘要也能区分;空串走 `default`,长度封顶 80。
pub fn pipe_name(session_id: &str) -> String {
    let mut cleaned = String::with_capacity(session_id.len());
    for ch in session_id.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            cleaned.push(ch);
        } else {
            cleaned.push('_');
        }
    }
    if cleaned.is_empty() {
        cleaned.push_str("default");
    }
    cleaned.truncate(64);
    let digest = fnv1a32(session_id.as_bytes());
    format!("{APPROVAL_PIPE_PREFIX}{cleaned}-{digest:08x}")
}

fn fnv1a32(bytes: &[u8]) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in bytes {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash
}

fn wide(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
}

/// 取当前登录用户 SID。命名管道 ACL 由 `ipc_channel_acl` 按这个 SID 生成,
/// 不读客户端传入的身份,避免"客户端自称是谁"就放行。
fn current_user_sid() -> io::Result<String> {
    let output = Command::new("whoami")
        .args(["/user", "/fo", "csv", "/nh"])
        .output()?;
    if !output.status.success() {
        return Err(io::Error::new(io::ErrorKind::Other, "whoami /user 执行失败"));
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.split(|c: char| c == '"' || c == ',' || c.is_whitespace())
        .find(|part| part.starts_with("S-1-5-21-"))
        .map(str::to_string)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "whoami 输出里没有用户 SID"))
}

/// 服务端:建受限管道 → 等连接 → 读一条请求 → 写一条应答。
pub fn serve_once(session_id: &str, response: &str) -> io::Result<String> {
    let sid = current_user_sid()?;
    let name = pipe_name(session_id);
    let pipe = create_restricted_pipe(&name, &sid).map_err(to_io)?;
    pipe.connect().map_err(to_io)?;
    let request = read_server_frame(&pipe)?;
    let mut reply = response.as_bytes().to_vec();
    reply.push(b'\n');
    pipe.send(&reply).map_err(to_io)?;
    Ok(request)
}

/// 客户端:连管道 → 发一条请求 → 读一条应答。
pub fn request_once(session_id: &str, request: &str) -> io::Result<String> {
    if request.len() > APPROVAL_PIPE_MAX_MESSAGE {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "审批请求超过单条上限"));
    }
    let name = pipe_name(session_id);
    let handle = open_client(&name)?;
    let result = (|| {
        let mut framed = request.as_bytes().to_vec();
        framed.push(b'\n');
        write_all(handle, &framed)?;
        read_client_frame(handle)
    })();
    unsafe {
        CloseHandle(handle);
    }
    result
}

/// 命名管道 byte 模式不保消息边界:必须按换行分帧,不能假设一次 ReadFile 就是一条。
fn read_server_frame(pipe: &crate::ipc_channel_acl::RestrictedPipe) -> io::Result<String> {
    let mut accumulated = Vec::new();
    loop {
        let chunk = pipe.recv(APPROVAL_PIPE_MAX_MESSAGE).map_err(to_io)?;
        if chunk.is_empty() {
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "审批请求在帧结束前断开"));
        }
        accumulated.extend_from_slice(&chunk);
        if let Some(end) = accumulated.iter().position(|byte| *byte == b'\n') {
            accumulated.truncate(end);
            break;
        }
        if accumulated.len() > APPROVAL_PIPE_MAX_MESSAGE {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "审批请求过长"));
        }
    }
    String::from_utf8(accumulated)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "审批请求不是 UTF-8"))
        .map(|text| text.trim_end_matches('\r').to_string())
}

fn read_client_frame(handle: HANDLE) -> io::Result<String> {
    let mut accumulated = Vec::new();
    loop {
        let mut buffer = vec![0u8; 4096];
        let mut read: u32 = 0;
        let ok = unsafe {
            ReadFile(
                handle,
                buffer.as_mut_ptr().cast(),
                buffer.len() as u32,
                &mut read,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(io::Error::last_os_error());
        }
        if read == 0 {
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "审批应答在帧结束前断开"));
        }
        accumulated.extend_from_slice(&buffer[..read as usize]);
        if let Some(end) = accumulated.iter().position(|byte| *byte == b'\n') {
            accumulated.truncate(end);
            break;
        }
        if accumulated.len() > APPROVAL_PIPE_MAX_MESSAGE {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "审批应答过长"));
        }
    }
    String::from_utf8(accumulated)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "审批应答不是 UTF-8"))
        .map(|text| text.trim_end_matches('\r').to_string())
}

fn to_io(error: crate::ipc_channel_acl::AclError) -> io::Error {
    io::Error::new(io::ErrorKind::Other, error.to_string())
}

fn open_client(name: &str) -> io::Result<HANDLE> {
    let wide_name = wide(name);
    let mut last_error = None;
    for _ in 0..CONNECT_RETRIES {
        let handle = unsafe {
            CreateFileW(
                wide_name.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                0,
                std::ptr::null(),
                OPEN_EXISTING,
                0,
                0,
            )
        };
        if handle != INVALID_HANDLE_VALUE {
            return Ok(handle);
        }
        let error = io::Error::last_os_error();
        let code = error.raw_os_error();
        // ERROR_PIPE_BUSY(231)=所有实例忙;ERROR_FILE_NOT_FOUND(2)=服务端还没建好。
        if code != Some(231) && code != Some(2) {
            return Err(error);
        }
        last_error = Some(error);
        thread::sleep(CONNECT_RETRY_DELAY);
    }
    Err(last_error.unwrap_or_else(|| io::Error::new(io::ErrorKind::TimedOut, "命名管道连接超时")))
}

fn write_all(handle: HANDLE, bytes: &[u8]) -> io::Result<()> {
    let mut offset = 0usize;
    while offset < bytes.len() {
        let remaining = &bytes[offset..];
        let mut written: u32 = 0;
        let ok = unsafe {
            WriteFile(
                handle,
                remaining.as_ptr().cast(),
                remaining.len() as u32,
                &mut written,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(io::Error::last_os_error());
        }
        if written == 0 {
            return Err(io::Error::new(io::ErrorKind::WriteZero, "审批应答写入 0 字节"));
        }
        offset += written as usize;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipe_names_are_stable_and_sanitized() {
        assert_eq!(
            pipe_name(""),
            format!(r"\\.\pipe\ihui-approval-default-{:08x}", fnv1a32(b""))
        );
        assert!(pipe_name("session/with spaces").ends_with(&format!(
            "session_with_spaces-{:08x}",
            fnv1a32(b"session/with spaces")
        )));
        assert_ne!(pipe_name("a/b"), pipe_name("a_b"));
        assert!(crate::ipc_channel_acl::validate_pipe_name(&pipe_name("a/b")).is_ok());
    }

    #[test]
    fn remote_clients_are_rejected_by_pipe_flags() {
        // 受限管道的创建标志必须含 PIPE_REJECT_REMOTE_CLIENTS(0x8);
        // 只断言 windows-sys 常量等于 8 是空转,这里钉的是本仓真正传给 CreateNamedPipeW 的值。
        assert_eq!(
            crate::ipc_channel_acl::RESTRICTED_PIPE_MODE & PIPE_REJECT_REMOTE_CLIENTS,
            PIPE_REJECT_REMOTE_CLIENTS
        );
    }

    #[test]
    fn pipe_roundtrip_carries_request_and_response() {
        let session = "test-session-l03";
        let server = thread::spawn(move || serve_once(session, r#"{"approved":true}"#));
        // 给服务线程一点建管道的时间;request_once 自身也会重试。
        thread::sleep(Duration::from_millis(30));
        let reply = request_once(
            "test-session-l03",
            r#"{"sessionId":"test-session-l03","tool":"shell"}"#,
        )
        .expect("审批管道往返失败");
        assert_eq!(reply, r#"{"approved":true}"#);
        let request = server.join().expect("服务线程 panic").expect("服务端失败");
        assert!(request.contains("test-session-l03"));
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
