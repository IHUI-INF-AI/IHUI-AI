// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! B2-02 IPC 安全描述符边界。
//!
//! 对照 TRAE 的命名管道通道：管道不是「能连上就行」，创建时必须把 DACL 钉死在
//! **当前用户 + SYSTEM**，不能带 Everyone / Authenticated Users / Builtin Users。
//!
//! 分层：
//!   - `build_restricted_sddl` / `validate_restricted_sddl` 是纯判据，跨平台可测；
//!   - `create_restricted_pipe` 只在 Windows 走 advapi32 / kernel32 原始 FFI，
//!     失败一律返回 Err，不退回「无 DACL 的裸管道」；
//!   - `selftest` 给 Tauri 命令一个真实创建→关闭的探测入口。
//!
//! 本层不读客户端输入里的 SID 就放行：调用方传进来的 SID 必须通过形状校验，
//! 且生成的 SDDL 要再过一遍「恰好两条 ACE」的复核。

use std::fmt;

const SDDL_REVISION_1: u32 = 1;
const PIPE_ACCESS_DUPLEX: u32 = 0x0000_0003;
const PIPE_TYPE_BYTE: u32 = 0x0000_0000;
const PIPE_READMODE_BYTE: u32 = 0x0000_0000;
const PIPE_WAIT: u32 = 0x0000_0000;
/// `PIPE_REJECT_REMOTE_CLIENTS`:拒绝 SMB 远端连接,只允许本机进程接入。
const PIPE_REJECT_REMOTE_CLIENTS: u32 = 0x0000_0008;
const PIPE_UNLIMITED_INSTANCES: u32 = 255;
const PIPE_PREFIX: &str = r"\\.\pipe\";

/// 受限管道创建标志(byte 模式 + 拒绝远端)。单列常量,测试可直接钉位。
pub const RESTRICTED_PIPE_MODE: u32 =
    PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AclError {
    InvalidSid(String),
    InvalidPipeName(String),
    SddlRejected(String),
    CreateFailed(String),
    Unsupported(&'static str),
}

impl fmt::Display for AclError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AclError::InvalidSid(s) => write!(f, "invalid user sid: {s}"),
            AclError::InvalidPipeName(s) => write!(f, "invalid pipe name: {s}"),
            AclError::SddlRejected(s) => write!(f, "sddl rejected: {s}"),
            AclError::CreateFailed(s) => write!(f, "create pipe failed: {s}"),
            AclError::Unsupported(s) => write!(f, "unsupported: {s}"),
        }
    }
}

/// SID 形状校验：只认 `S-1-...`，不允许分号/括号/空白混进 SDDL。
pub fn validate_user_sid(sid: &str) -> Result<(), AclError> {
    if !sid.starts_with("S-1-") || sid.len() < 6 {
        return Err(AclError::InvalidSid(sid.to_string()));
    }
    if !sid
        .chars()
        .all(|c| c.is_ascii_digit() || c == '-' || c == 'S')
    {
        return Err(AclError::InvalidSid(sid.to_string()));
    }
    Ok(())
}

/// 管道名必须落在 `\\.\pipe\` 命名空间内，且只有一层名字（不允许 `..` / 斜杠）。
pub fn validate_pipe_name(name: &str) -> Result<(), AclError> {
    let Some(leaf) = name.strip_prefix(PIPE_PREFIX) else {
        return Err(AclError::InvalidPipeName(name.to_string()));
    };
    if leaf.is_empty()
        || leaf.contains('\\')
        || leaf.contains('/')
        || leaf.contains("..")
        || leaf.chars().any(|c| c.is_control())
    {
        return Err(AclError::InvalidPipeName(name.to_string()));
    }
    Ok(())
}

/// 生成「当前用户 + SYSTEM」的受保护 DACL。
pub fn build_restricted_sddl(user_sid: &str) -> Result<String, AclError> {
    validate_user_sid(user_sid)?;
    Ok(format!(
        "O:{sid}G:{sid}D:P(A;;GA;;;{sid})(A;;GA;;;SY)",
        sid = user_sid
    ))
}

/// 复核生成的 SDDL：必须受保护、恰好两条 ACE、只含当前用户与 SYSTEM。
/// 任何 `WD`/`AU`/`AN`/`BU`/`BA` 出现即拒绝。
pub fn validate_restricted_sddl(sddl: &str, user_sid: &str) -> Result<(), AclError> {
    validate_user_sid(user_sid)?;
    let expected_prefix = format!("O:{user_sid}G:{user_sid}D:P(");
    if !sddl.starts_with(&expected_prefix) {
        return Err(AclError::SddlRejected("missing protected owner/group prefix".into()));
    }
    if !sddl.ends_with(')') {
        return Err(AclError::SddlRejected("unterminated dacl".into()));
    }
    if sddl.matches("(A;").count() != 2 {
        return Err(AclError::SddlRejected("dacl must contain exactly two allow aces".into()));
    }
    if !sddl.contains(&format!("(A;;GA;;;{user_sid})")) {
        return Err(AclError::SddlRejected("current user ace missing".into()));
    }
    if !sddl.contains("(A;;GA;;;SY)") {
        return Err(AclError::SddlRejected("system ace missing".into()));
    }
    for broad in ["WD", "AU", "AN", "BU", "BA", "IU", "SU", "CO", "CG"] {
        if sddl.contains(&format!(";;;{broad})")) {
            return Err(AclError::SddlRejected(format!("broad principal {broad} present")));
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AclReport {
    pub ok: bool,
    pub sddl: String,
    pub detail: String,
}

/// 真实创建一次受限管道再立即关闭；返回 SDDL 与结果，供命令面取证。
pub fn selftest(user_sid: &str, pipe_leaf: &str) -> AclReport {
    let name = format!("{PIPE_PREFIX}{pipe_leaf}");
    match build_restricted_sddl(user_sid) {
        Ok(sddl) => match create_restricted_pipe(&name, user_sid) {
            Ok(pipe) => {
                drop(pipe);
                AclReport {
                    ok: true,
                    sddl,
                    detail: "pipe created and closed".into(),
                }
            }
            Err(err) => AclReport {
                ok: false,
                sddl,
                detail: err.to_string(),
            },
        },
        Err(err) => AclReport {
            ok: false,
            sddl: String::new(),
            detail: err.to_string(),
        },
    }
}

#[cfg(windows)]
mod win {
    use std::ffi::c_void;

    pub type Handle = *mut c_void;

    #[repr(C)]
    pub struct SecurityAttributes {
        pub n_length: u32,
        pub lp_security_descriptor: *mut c_void,
        pub b_inherit_handle: i32,
    }

    #[link(name = "advapi32")]
    extern "system" {
        pub fn ConvertStringSecurityDescriptorToSecurityDescriptorW(
            string_sd: *const u16,
            revision: u32,
            security_descriptor: *mut *mut c_void,
            size: *mut u32,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn LocalFree(mem: *mut c_void) -> *mut c_void;
        pub fn CreateNamedPipeW(
            name: *const u16,
            open_mode: u32,
            pipe_mode: u32,
            max_instances: u32,
            out_buffer_size: u32,
            in_buffer_size: u32,
            default_timeout: u32,
            security_attributes: *const SecurityAttributes,
        ) -> Handle;
        pub fn ConnectNamedPipe(handle: Handle, overlapped: *mut c_void) -> i32;
        pub fn ReadFile(
            handle: Handle,
            buffer: *mut c_void,
            bytes_to_read: u32,
            bytes_read: *mut u32,
            overlapped: *mut c_void,
        ) -> i32;
        pub fn WriteFile(
            handle: Handle,
            buffer: *const c_void,
            bytes_to_write: u32,
            bytes_written: *mut u32,
            overlapped: *mut c_void,
        ) -> i32;
        pub fn CloseHandle(handle: Handle) -> i32;
    }
}

#[cfg(windows)]
pub struct RestrictedPipe {
    handle: win::Handle,
}

#[cfg(windows)]
impl Drop for RestrictedPipe {
    fn drop(&mut self) {
        unsafe {
            win::CloseHandle(self.handle);
        }
    }
}

#[cfg(windows)]
impl RestrictedPipe {
    /// 阻塞等待客户端接入;`ERROR_PIPE_CONNECTED(535)` 视为已连接。
    pub fn connect(&self) -> Result<(), AclError> {
        let ok = unsafe { win::ConnectNamedPipe(self.handle, std::ptr::null_mut()) };
        if ok != 0 {
            return Ok(());
        }
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(535) {
            Ok(())
        } else {
            Err(AclError::CreateFailed(format!("ConnectNamedPipe: {error}")))
        }
    }

    /// 读一帧(命名管道 byte 模式,帧边界由调用方按换行/长度自行切)。
    pub fn recv(&self, max_bytes: usize) -> Result<Vec<u8>, AclError> {
        let mut buffer = vec![0u8; max_bytes];
        let mut read: u32 = 0;
        let ok = unsafe {
            win::ReadFile(
                self.handle,
                buffer.as_mut_ptr().cast(),
                max_bytes as u32,
                &mut read,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(AclError::CreateFailed(format!(
                "ReadFile: {}",
                std::io::Error::last_os_error()
            )));
        }
        buffer.truncate(read as usize);
        Ok(buffer)
    }

    /// 写一帧,必须整段写完;短写按失败处理,不把半帧当成功。
    pub fn send(&self, payload: &[u8]) -> Result<(), AclError> {
        let mut written: u32 = 0;
        let ok = unsafe {
            win::WriteFile(
                self.handle,
                payload.as_ptr().cast(),
                payload.len() as u32,
                &mut written,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(AclError::CreateFailed(format!(
                "WriteFile: {}",
                std::io::Error::last_os_error()
            )));
        }
        if written as usize != payload.len() {
            return Err(AclError::CreateFailed(format!(
                "short write: {written}/{}",
                payload.len()
            )));
        }
        Ok(())
    }
}

#[cfg(not(windows))]
impl RestrictedPipe {
    pub fn connect(&self) -> Result<(), AclError> {
        Err(AclError::Unsupported("named pipes are Windows-only"))
    }

    pub fn recv(&self, _max_bytes: usize) -> Result<Vec<u8>, AclError> {
        Err(AclError::Unsupported("named pipes are Windows-only"))
    }

    pub fn send(&self, _payload: &[u8]) -> Result<(), AclError> {
        Err(AclError::Unsupported("named pipes are Windows-only"))
    }
}

#[cfg(windows)]
fn to_utf16(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
pub fn create_restricted_pipe(name: &str, user_sid: &str) -> Result<RestrictedPipe, AclError> {
    validate_pipe_name(name)?;
    let sddl = build_restricted_sddl(user_sid)?;
    validate_restricted_sddl(&sddl, user_sid)?;

    unsafe {
        let sddl_utf16 = to_utf16(&sddl);
        let mut sd: *mut std::ffi::c_void = std::ptr::null_mut();
        let mut sd_size: u32 = 0;
        let converted = win::ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl_utf16.as_ptr(),
            SDDL_REVISION_1,
            &mut sd,
            &mut sd_size,
        );
        if converted == 0 || sd.is_null() {
            return Err(AclError::CreateFailed(
                "ConvertStringSecurityDescriptorToSecurityDescriptorW returned 0".into(),
            ));
        }

        let sa = win::SecurityAttributes {
            n_length: std::mem::size_of::<win::SecurityAttributes>() as u32,
            lp_security_descriptor: sd,
            b_inherit_handle: 0,
        };
        let name_utf16 = to_utf16(name);
        let handle = win::CreateNamedPipeW(
            name_utf16.as_ptr(),
            PIPE_ACCESS_DUPLEX,
            RESTRICTED_PIPE_MODE,
            PIPE_UNLIMITED_INSTANCES,
            64 * 1024,
            64 * 1024,
            0,
            &sa,
        );
        win::LocalFree(sd);
        if handle.is_null() || handle as isize == -1 {
            return Err(AclError::CreateFailed(
                "CreateNamedPipeW returned INVALID_HANDLE_VALUE".into(),
            ));
        }
        Ok(RestrictedPipe { handle })
    }
}

#[cfg(not(windows))]
pub struct RestrictedPipe;

#[cfg(not(windows))]
pub fn create_restricted_pipe(_name: &str, _user_sid: &str) -> Result<RestrictedPipe, AclError> {
    Err(AclError::Unsupported("named pipes with SDDL are Windows-only"))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SID: &str = "S-1-5-21-1111111111-2222222222-3333333333-1001";

    #[test]
    fn sddl_pins_current_user_and_system() {
        let sddl = build_restricted_sddl(SID).expect("sddl");
        assert_eq!(
            sddl,
            format!("O:{SID}G:{SID}D:P(A;;GA;;;{SID})(A;;GA;;;SY)")
        );
        assert!(validate_restricted_sddl(&sddl, SID).is_ok());
    }

    #[test]
    fn validator_rejects_world_or_extra_ace() {
        let world = format!("O:{SID}G:{SID}D:P(A;;GA;;;{SID})(A;;GA;;;WD)");
        assert!(validate_restricted_sddl(&world, SID).is_err());
        let extra = format!("O:{SID}G:{SID}D:P(A;;GA;;;{SID})(A;;GA;;;SY)(A;;GA;;;BA)");
        assert!(validate_restricted_sddl(&extra, SID).is_err());
    }

    #[test]
    fn invalid_sid_cannot_break_sddl() {
        assert!(build_restricted_sddl("S-1-5-21-1);(A;;GA;;;WD").is_err());
        assert!(build_restricted_sddl("everyone").is_err());
    }

    #[test]
    fn pipe_name_requires_namespace_and_single_leaf() {
        assert!(validate_pipe_name(r"\\.\pipe\ihui-test").is_ok());
        assert!(validate_pipe_name(r"ihui-test").is_err());
        assert!(validate_pipe_name(r"\\.\pipe\..\evil").is_err());
        assert!(validate_pipe_name(r"\\.\pipe\a\b").is_err());
    }

    /// Windows 的 CreateNamedPipeW 会把 SDDL 里的 owner SID 拿去解析/校验;
    /// 假 SID 在部分机器上直接 INVALID_HANDLE_VALUE(本机 2026-11-25 全 lib 实测),
    /// 所以自检必须用当前登录用户的真 SID,而不是常量假号。
    fn current_user_sid() -> Option<String> {
        let out = std::process::Command::new("whoami")
            .args(["/user", "/fo", "csv", "/nh"])
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        String::from_utf8_lossy(&out.stdout)
            .split(|c: char| c == '"' || c == ',' || c.is_whitespace())
            .find(|part| part.starts_with("S-1-5-21-"))
            .map(str::to_string)
    }

    #[test]
    fn selftest_returns_reason_instead_of_unprotected_pipe() {
        // Windows 上应能创建;非 Windows 必须是明确 Unsupported,不能假装 ok。
        if cfg!(windows) {
            let sid = current_user_sid().expect("whoami /user 取不到当前用户 SID");
            let report = selftest(&sid, "ihui-acl-selftest");
            assert!(report.ok, "sid={sid} detail={}", report.detail);
        } else {
            let report = selftest(SID, "ihui-acl-selftest");
            assert!(!report.ok);
            assert!(report.detail.contains("Unsupported") || report.detail.contains("unsupported"));
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
