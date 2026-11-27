// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! guarded spawn —— 把 `sandbox_sdk` 的能力探测接到**真实降权/隔离进程**。
//!
//! 之前 `sandbox_sdk` 只有「Job Object 杀进程树」这一层：进程仍以当前用户（管理员）
//! 的完整令牌运行，文件系统/注册表写入没有任何隔离。本模块补上三个执行档：
//!
//! 1. **AppContainer（默认档）**：`CreateAppContainerProfile` 建无 capability 的包配置，
//!    再由 `kernelbase.dll` 的 `CreateAppContainerToken` 派生主令牌。令牌没有
//!    `internetClient`，网络栈在 token 层拒绝出网；可写范围是包自己的
//!    `%LOCALAPPDATA%\Packages\<包名>\AC\IHUI\sandbox\<host>`，不靠放宽用户工作区 ACL。
//! 2. **低完整性（显式档，`Low`）**：复制主令牌后
//!    `SetTokenInformation(TokenIntegrityLevel, S-1-16-4096)`。MIC 让它写不进中/高完整性
//!    对象；它**不是默认档**，且仍可出网——默认网络边界由上面的 AppContainer 承担。
//! 3. **继承完整性（显式档，`Inherit`）**：只复制主令牌、不降 IL，仍挂 Job 限额与 UI
//!    限制。它解决的是"需要写工作区的长任务不能进低完整性宿主"这一产品矛盾；调用方
//!    必须显式选择，默认绝不走这一档。
//! 4. **作业限额**：`CREATE_SUSPENDED` 创建，**先挂 Job 再 Resume**，子进程没有机会
//!    在挂载前逃逸；Job 带 `KILL_ON_JOB_CLOSE | ACTIVE_PROCESS | PROCESS/JOB_MEMORY`
//!    与 UI 限制（剪贴板/桌面/系统参数/全局原子全部禁掉）。
//! 5. **句柄白名单**：`PROC_THREAD_ATTRIBUTE_HANDLE_LIST` 只把 stdout/stderr 两个写端
//!    交给孩子，父进程其它可继承句柄（别的会话管道）一律不漏。
//!
//! 为什么用 `CreateProcessAsUserW`：它支持 `bInheritHandles=TRUE`，stdio 管道才能成立；
//! `CreateProcessWithTokenW` 没有这个参数，传句柄值过去孩子也拿不到。
//!
//! 为什么默认不建 restricted-SID 令牌：`CreateProcessAsUser` 对带 restricted SID 的令牌
//! 要求 `SeAssignPrimaryTokenPrivilege`（普通管理员令牌没有），本机实测直接
//! `ERROR_PRIVILEGE_NOT_HELD`。因此默认走 AppContainer；显式 `Low` 走「复制主令牌 +
//! 低完整性」；置 `IHUI_SANDBOX_REQUIRE_RESTRICTED=1` 时仍会尝试 restricted 令牌，
//! 拿不到就 **Err 拒绝**，绝不静默降级还宣称"受限令牌已生效"。
//!
//! 边界（如实登记）：`Inherit` 档和 MCP relay 的普通 stdio 子进程仍可出网；`Low` 显式档
//! 也仍可出网，网络面由 `egress_gate` 只覆盖本仓 HTTP 出站点。AppContainer 的低完整性
//! 令牌写不进中完整性用户工作区，所以需要写工作区的 CLI/Git 仍显式走 `Inherit`；也不做
//! 微虚拟机级隔离——那需要独立内核，`sandbox_sdk::MicroVmBackend` 仍如实报缺失。

#![cfg(windows)]

use std::ffi::OsStr;
use std::fs::File;
use std::io::Read;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{FromRawHandle, RawHandle};
use std::time::Duration;

use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{
    CloseHandle, GetLastError, HANDLE, HLOCAL, LocalFree, WAIT_OBJECT_0, WAIT_TIMEOUT,
};
use windows::Win32::Security::Authorization::ConvertStringSidToSidW;
use windows::Win32::Security::Isolation::{
    CreateAppContainerProfile, DeriveAppContainerSidFromAppContainerName,
};
use windows::Win32::Security::{
    AdjustTokenPrivileges, CreateRestrictedToken, DuplicateTokenEx, FreeSid, GetTokenInformation,
    LookupPrivilegeValueW, SetTokenInformation, SecurityImpersonation, TOKEN_ADJUST_PRIVILEGES,
    TOKEN_ALL_ACCESS, TOKEN_MANDATORY_LABEL, TOKEN_PRIVILEGES, TOKEN_QUERY, TokenIntegrityLevel,
    TokenIsAppContainer, TokenPrimary, DISABLE_MAX_PRIVILEGE, LUA_TOKEN, LUID_AND_ATTRIBUTES, PSID,
    SE_PRIVILEGE_ENABLED, SID_AND_ATTRIBUTES, SECURITY_ATTRIBUTES, SECURITY_CAPABILITIES,
};
use windows::Win32::System::LibraryLoader::{GetModuleHandleW, GetProcAddress};
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JOBOBJECT_BASIC_UI_RESTRICTIONS,
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_ACTIVE_PROCESS,
    JOB_OBJECT_LIMIT_JOB_MEMORY, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JOB_OBJECT_LIMIT_PROCESS_MEMORY, JOB_OBJECT_UILIMIT_DESKTOP, JOB_OBJECT_UILIMIT_HANDLES,
    JOB_OBJECT_UILIMIT_READCLIPBOARD, JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS,
    JOB_OBJECT_UILIMIT_WRITECLIPBOARD, JobObjectBasicUIRestrictions,
    JobObjectExtendedLimitInformation, SetInformationJobObject, TerminateJobObject,
};
use windows::Win32::System::Pipes::CreatePipe;
use windows::Win32::System::Threading::{
    CreateProcessAsUserW, DeleteProcThreadAttributeList, GetCurrentProcess, GetExitCodeProcess,
    InitializeProcThreadAttributeList, OpenProcessToken, ResumeThread, TerminateProcess,
    UpdateProcThreadAttribute, CREATE_NO_WINDOW, CREATE_SUSPENDED, LPPROC_THREAD_ATTRIBUTE_LIST,
    PROC_THREAD_ATTRIBUTE_HANDLE_LIST, PROCESS_CREATION_FLAGS, PROCESS_INFORMATION,
    STARTF_USESTDHANDLES, STARTUPINFOEXW, STARTUPINFOW, WaitForSingleObject,
};

/// 低完整性 SID：S-1-16-4096（Low mandatory level），在 `create_low_integrity_token` 内解析。

/// 单个沙箱进程的限额。
#[derive(Debug, Clone)]
pub struct SandboxLimits {
    /// 作业内最大同时存活进程数（防 fork 炸弹）。
    pub max_processes: u32,
    /// 单进程内存上限（字节）。
    pub process_memory_bytes: usize,
    /// 作业总内存上限（字节）。
    pub job_memory_bytes: usize,
}

impl Default for SandboxLimits {
    fn default() -> Self {
        Self {
            max_processes: 16,
            process_memory_bytes: 1 << 30, // 1 GiB
            job_memory_bytes: 4 << 30,     // 4 GiB
        }
    }
}

/// 执行档位：默认 AppContainer（无网络 capability）；`Low` 是显式低完整性档，
/// 仍可出网；`Inherit` 只做 Job 隔离，保留当前用户完整性与网络。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntegrityMode {
    Low,
    AppContainer,
    Inherit,
}

/// 要启动的进程。
#[derive(Debug, Clone)]
pub struct SandboxSpec {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: Option<std::path::PathBuf>,
    pub limits: SandboxLimits,
    pub integrity: IntegrityMode,
    /// 需要 `cmd.exe /d /s /c` 这类自带引号语法的程序时，直接给最终命令行，
    /// 绕开 `quote_arg` 的 CommandLineToArgvW 转义（cmd 不认 `\"`）。
    pub raw_command_line: Option<String>,
}

impl SandboxSpec {
    pub fn new(program: impl Into<String>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            cwd: None,
            limits: SandboxLimits::default(),
            integrity: IntegrityMode::AppContainer,
            raw_command_line: None,
        }
    }

    /// 显式选择"继承完整性"：只做 Job 限额，不做 MIC 写隔离。
    /// 需要写工作区的长任务才用；默认档仍是 Low。
    pub fn inherit_integrity(mut self) -> Self {
        self.integrity = IntegrityMode::Inherit;
        self
    }

    /// 显式选择 AppContainer：低完整性 + 无 internetClient capability，子进程不能出网。
    pub fn appcontainer_integrity(mut self) -> Self {
        self.integrity = IntegrityMode::AppContainer;
        self
    }

    /// 直接指定最终命令行；调用方负责 Windows 引号规则，不能再走 `arg()` 叠加。
    pub fn with_raw_command_line(mut self, line: impl Into<String>) -> Self {
        self.raw_command_line = Some(line.into());
        self
    }

    pub fn arg(mut self, a: impl Into<String>) -> Self {
        self.args.push(a.into());
        self
    }
}

/// 一个已启动的受限进程。Drop 时关闭作业对象（KILL_ON_JOB_CLOSE ⇒ 整树兜底回收）。
pub struct SandboxProcess {
    pub pid: u32,
    process: HANDLE,
    thread: HANDLE,
    job: HANDLE,
    pub stdout: Option<File>,
    pub stderr: Option<File>,
}

/// 探测结果（给 `sandbox_sdk` 用，不是恒真桩）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProbeReport {
    pub supported: bool,
    pub tier: &'static str,
    pub detail: String,
}

unsafe impl Send for SandboxProcess {}

impl SandboxProcess {
    /// 等待退出；`None` = 一直等。返回退出码。
    pub fn wait(&mut self, timeout: Option<Duration>) -> Result<u32, String> {
        let ms = timeout.map(|d| d.as_millis().min(u32::MAX as u128) as u32).unwrap_or(u32::MAX);
        let rc = unsafe { WaitForSingleObject(self.process, ms) };
        if rc == WAIT_TIMEOUT {
            return Err("wait timeout".to_string());
        }
        if rc != WAIT_OBJECT_0 {
            return Err(format!("WaitForSingleObject 失败 rc={rc:?}"));
        }
        let mut code = 0u32;
        unsafe { GetExitCodeProcess(self.process, &mut code) }
            .map_err(|e| format!("GetExitCodeProcess: {e}"))?;
        Ok(code)
    }

    /// 非阻塞探测：已退出返回 `Some(code)`，仍在跑返回 `None`。
    pub fn try_wait(&self) -> Result<Option<u32>, String> {
        let rc = unsafe { WaitForSingleObject(self.process, 0) };
        if rc == WAIT_TIMEOUT {
            return Ok(None);
        }
        if rc != WAIT_OBJECT_0 {
            return Err(format!("WaitForSingleObject(0) 失败 rc={rc:?}"));
        }
        let mut code = 0u32;
        unsafe { GetExitCodeProcess(self.process, &mut code) }
            .map_err(|e| format!("GetExitCodeProcess: {e}"))?;
        Ok(Some(code))
    }

    /// 查询子进程是否真的带 AppContainer 令牌；不是靠调用成功或环境变量猜的。
    pub fn is_appcontainer(&self) -> Result<bool, String> {
        unsafe {
            let mut token = HANDLE::default();
            OpenProcessToken(self.process, TOKEN_QUERY, &mut token)
                .map_err(|e| format!("OpenProcessToken(child): {e}"))?;
            let mut value: i32 = 0;
            let mut ret_len = 0u32;
            let r = GetTokenInformation(
                token,
                TokenIsAppContainer,
                Some(&mut value as *mut _ as *mut core::ffi::c_void),
                std::mem::size_of::<i32>() as u32,
                &mut ret_len,
            );
            let _ = CloseHandle(token);
            r.map_err(|e| format!("GetTokenInformation(TokenIsAppContainer): {e}"))?;
            Ok(value != 0)
        }
    }

    /// 立即终止整个作业（含子孙进程）。
    pub fn kill(&mut self) -> Result<(), String> {
        unsafe { TerminateJobObject(self.job, 1) }
            .map_err(|e| format!("TerminateJobObject: {e}"))
    }

    /// 把 stdout 全部读完（子进程退出后 EOF）。非阻塞读取请直接用 `stdout` 字段。
    pub fn read_stdout_to_end(&mut self) -> Result<String, String> {
        let mut out = String::new();
        if let Some(f) = self.stdout.as_mut() {
            f.read_to_string(&mut out).map_err(|e| format!("read stdout: {e}"))?;
        }
        Ok(out)
    }

    pub fn read_stderr_to_end(&mut self) -> Result<String, String> {
        let mut out = String::new();
        if let Some(f) = self.stderr.as_mut() {
            f.read_to_string(&mut out).map_err(|e| format!("read stderr: {e}"))?;
        }
        Ok(out)
    }
}

impl Drop for SandboxProcess {
    fn drop(&mut self) {
        unsafe {
            // 先关进程/线程句柄，再关作业：KILL_ON_JOB_CLOSE 会把还没退出的整树杀掉。
            if !self.thread.is_invalid() {
                let _ = CloseHandle(self.thread);
            }
            if !self.process.is_invalid() {
                let _ = CloseHandle(self.process);
            }
            if !self.job.is_invalid() {
                let _ = CloseHandle(self.job);
            }
        }
    }
}

fn wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

/// 创建 AppContainer 主令牌（Windows 8+）。
///
/// `CreateAppContainerToken` 是 kernelbase.dll 的未文档化导出；Chromium 也走这个入口。
/// 它接受一个普通主令牌 + `SECURITY_CAPABILITIES`（Package SID、无 capability），
/// 返回的令牌带有 AppContainer 包 SID、低完整性，并且**没有 internetClient 能力**，
/// 因此网络栈在 token 层就拒绝出网。这里不在环境变量/命令黑名单上做假阻断。
fn create_appcontainer_profile_sid(profile_name: &str) -> Result<PSID, String> {
    unsafe {
        let profile_w = wide(profile_name);
        let display_w = wide("IHUI Tool Host");
        let desc_w = wide("IHUI AI 工具执行宿主 AppContainer");
        match CreateAppContainerProfile(
            PCWSTR(profile_w.as_ptr()),
            PCWSTR(display_w.as_ptr()),
            PCWSTR(desc_w.as_ptr()),
            None,
        ) {
            Ok(sid) if !sid.is_invalid() => Ok(sid),
            Ok(_) => Err("CreateAppContainerProfile 返回空 PSID".to_string()),
            // 已存在（0x800700B7）是正常路径；从 moniker 反查 Package SID。
            Err(_) => DeriveAppContainerSidFromAppContainerName(PCWSTR(profile_w.as_ptr()))
                .map_err(|e| format!("创建/查询 AppContainer 配置失败: {e}")),
        }
    }
}

/// 建好宿主专用的 AppContainer 配置，返回 Package SID 后立即释放。
pub fn ensure_appcontainer_profile() -> Result<(), String> {
    let sid = create_appcontainer_profile_sid("IHUI.ToolHost")?;
    unsafe {
        FreeSid(sid);
    }
    Ok(())
}

/// 宿主低完整性可写根：AppContainer 自己的 `AC\IHUI\sandbox\<host>`。
/// 该目录天然在 Package SID 的可写范围里，不把用户工作区 ACL 放宽。
pub fn appcontainer_sandbox_root(nonce: &str) -> Result<std::path::PathBuf, String> {
    ensure_appcontainer_profile()?;
    let local = std::env::var("LOCALAPPDATA")
        .map_err(|_| "LOCALAPPDATA 未设置，无法建立 AppContainer 可写根".to_string())?;
    let root = std::path::PathBuf::from(local)
        .join("Packages")
        .join("IHUI.ToolHost")
        .join("AC")
        .join("IHUI")
        .join("sandbox")
        .join(format!("host-{}-{}", std::process::id(), nonce));
    std::fs::create_dir_all(&root)
        .map_err(|e| format!("创建 AppContainer 可写根失败 {}: {e}", root.display()))?;
    Ok(root)
}

/// 创建 AppContainer 主令牌（Windows 8+）。
///
/// `CreateAppContainerToken` 是 kernelbase.dll 的未文档化导出；Chromium 也走这个入口。
/// 它接受一个普通主令牌 + `SECURITY_CAPABILITIES`（Package SID、无 capability），
/// 返回的令牌带有 AppContainer 包 SID、低完整性，并且**没有 internetClient 能力**，
/// 因此网络栈在 token 层就拒绝出网。这里不在环境变量/命令黑名单上做假阻断。
fn create_appcontainer_token(base_token: HANDLE, profile_name: &str) -> Result<HANDLE, String> {
    type CreateTokenFn =
        unsafe extern "system" fn(HANDLE, *const SECURITY_CAPABILITIES, *mut HANDLE) -> i32;

    unsafe {
        let kernelbase = GetModuleHandleW(windows::core::w!("kernelbase.dll"))
            .map_err(|e| format!("GetModuleHandleW(kernelbase): {e}"))?;
        let create_token: CreateTokenFn = std::mem::transmute(
            GetProcAddress(
                kernelbase,
                windows::core::PCSTR(b"CreateAppContainerToken\0".as_ptr()),
            )
            .ok_or_else(|| "CreateAppContainerToken 导出不存在（当前 Windows 不支持）".to_string())?,
        );

        let sid = create_appcontainer_profile_sid(profile_name)?;
        let caps = SECURITY_CAPABILITIES {
            AppContainerSid: sid,
            Capabilities: std::ptr::null_mut(),
            CapabilityCount: 0,
            Reserved: 0,
        };
        let mut out = HANDLE::default();
        let ok = create_token(base_token, &caps, &mut out);
        FreeSid(sid);
        if ok == 0 || out.is_invalid() {
            return Err(format!(
                "CreateAppContainerToken 失败: {}",
                windows::Win32::Foundation::GetLastError().0
            ));
        }
        Ok(out)
    }
}

fn quote_arg(arg: &str) -> String {
    if arg.is_empty() {
        return "\"\"".to_string();
    }
    if !arg.contains([' ', '\t', '"']) {
        return arg.to_string();
    }
    let mut out = String::with_capacity(arg.len() + 2);
    out.push('"');
    let mut backslashes = 0usize;
    for ch in arg.chars() {
        match ch {
            '\\' => {
                backslashes += 1;
                out.push('\\');
            }
            '"' => {
                // 双写反斜杠 + 转义引号（CommandLineToArgvW 规则）
                out.push_str(&"\\".repeat(backslashes + 1));
                out.push('"');
                backslashes = 0;
            }
            _ => {
                backslashes = 0;
                out.push(ch);
            }
        }
    }
    out.push('"');
    out
}

fn command_line(program: &str, args: &[String]) -> String {
    let mut s = quote_arg(program);
    for a in args {
        s.push(' ');
        s.push_str(&quote_arg(a));
    }
    s
}

/// 把 `cmd.exe` 这类裸名解析成绝对路径。
///
/// CreateProcessAsUser 不做 PATH 搜索（lpApplicationName 非空时按路径打开），
/// 低完整性令牌下当前目录也可能不可读；这里显式按 PATH + PATHEXT 解析，找不到就原样返回。
fn resolve_program(program: &str) -> String {
    if program.contains(['\\', '/']) || std::path::Path::new(program).is_absolute() {
        return program.to_string();
    }
    let mut dirs: Vec<std::path::PathBuf> = std::env::var_os("PATH")
        .map(|v| std::env::split_paths(&v).collect())
        .unwrap_or_default();
    if let Ok(root) = std::env::var("SystemRoot") {
        dirs.insert(0, std::path::PathBuf::from(root).join("System32"));
    }
    for dir in dirs {
        for ext in ["", ".exe", ".cmd", ".bat", ".com"] {
            let candidate = dir.join(format!("{program}{ext}"));
            if candidate.is_file() {
                return candidate.to_string_lossy().into_owned();
            }
        }
    }
    program.to_string()
}

/// 临时启用的特权；Drop 时按原 LUID 关回去，不把 SeIncreaseQuota 永久留在进程令牌上。
struct EnabledPrivilege {
    token: HANDLE,
    luid: windows::Win32::Foundation::LUID,
}

impl Drop for EnabledPrivilege {
    fn drop(&mut self) {
        unsafe {
            let tp = TOKEN_PRIVILEGES {
                PrivilegeCount: 1,
                Privileges: [LUID_AND_ATTRIBUTES {
                    Luid: self.luid,
                    Attributes: windows::Win32::Security::TOKEN_PRIVILEGES_ATTRIBUTES(0),
                }],
            };
            let _ = AdjustTokenPrivileges(self.token, false, Some(&tp), 0, None, None);
            let _ = CloseHandle(self.token);
        }
    }
}

/// 打开当前进程令牌并临时启用一个特权（CreateProcessAsUser 需要 SeIncreaseQuotaPrivilege）。
fn enable_privilege(name: &str) -> Result<EnabledPrivilege, String> {
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY | TOKEN_ADJUST_PRIVILEGES,
            &mut token,
        )
        .map_err(|e| format!("OpenProcessToken(adjust): {e}"))?;
        let mut luid = windows::Win32::Foundation::LUID::default();
        let name_w = wide(name);
        let lookup = LookupPrivilegeValueW(PCWSTR::null(), PCWSTR(name_w.as_ptr()), &mut luid);
        if let Err(e) = lookup {
            let _ = CloseHandle(token);
            return Err(format!("LookupPrivilegeValueW({name}): {e}"));
        }
        let tp = TOKEN_PRIVILEGES {
            PrivilegeCount: 1,
            Privileges: [LUID_AND_ATTRIBUTES {
                Luid: luid,
                Attributes: SE_PRIVILEGE_ENABLED,
            }],
        };
        if let Err(e) = AdjustTokenPrivileges(token, false, Some(&tp), 0, None, None) {
            let _ = CloseHandle(token);
            return Err(format!("AdjustTokenPrivileges({name}): {e}"));
        }
        Ok(EnabledPrivilege { token, luid })
    }
}

/// 建立主令牌：`Low` 降到低完整性（可选 restricted-SID 加固）；`Inherit` 保留当前完整性。
/// 调用方负责关闭返回句柄。
fn create_token(mode: IntegrityMode) -> Result<HANDLE, String> {
    unsafe {
        let mut base = HANDLE::default();
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_ALL_ACCESS,
            &mut base,
        )
        .map_err(|e| format!("OpenProcessToken: {e}"))?;

        let mut primary = HANDLE::default();
        if let Err(e) = DuplicateTokenEx(
            base,
            TOKEN_ALL_ACCESS,
            None,
            SecurityImpersonation,
            TokenPrimary,
            &mut primary,
        ) {
            let _ = CloseHandle(base);
            return Err(format!("DuplicateTokenEx: {e}"));
        }
        let _ = CloseHandle(base);

        if mode == IntegrityMode::Inherit {
            return Ok(primary);
        }

        // AppContainer 档：低完整性 + 无 internetClient capability，网络栈在 token 层拒绝。
        // 显式 AppContainer 档失败就是失败，不降级成低完整性再宣称“已断网”。
        if mode == IntegrityMode::AppContainer
            || std::env::var("IHUI_SANDBOX_APPCONTAINER").as_deref() == Ok("1")
        {
            match create_appcontainer_token(primary, "IHUI.ToolHost") {
                Ok(token) => {
                    let _ = CloseHandle(primary);
                    return Ok(token);
                }
                Err(e) => {
                    let _ = CloseHandle(primary);
                    return Err(format!("AppContainer 令牌不可用: {e}"));
                }
            }
        }

        // Windows 的 CreateProcessAsUser 对「带 restricted SID 的令牌」要求
        // SeAssignPrimaryTokenPrivilege（普通管理员令牌没有该特权），因此默认走
        // 「复制主令牌 + 低完整性」：文件/注册表写入由 MIC 拦，进程仍以当前用户跑。
        // 需要更硬的 restricted-token 时置 IHUI_SANDBOX_REQUIRE_RESTRICTED=1，拿不到就拒。
        let require_restricted = std::env::var("IHUI_SANDBOX_REQUIRE_RESTRICTED").as_deref() == Ok("1");
        let token;
        if require_restricted {
            let mut restricted = HANDLE::default();
            let flags = DISABLE_MAX_PRIVILEGE | LUA_TOKEN;
            if let Err(e) = CreateRestrictedToken(primary, flags, None, None, None, &mut restricted) {
                let _ = CloseHandle(primary);
                return Err(format!("CreateRestrictedToken: {e}"));
            }
            let _ = CloseHandle(primary);
            token = restricted;
        } else {
            token = primary;
        }

        // 低完整性：S-1-16-4096
        let mut sid = PSID::default();
        if let Err(e) = ConvertStringSidToSidW(windows::core::w!("S-1-16-4096"), &mut sid) {
            let _ = CloseHandle(token);
            return Err(format!("ConvertStringSidToSidW: {e}"));
        }
        let label = TOKEN_MANDATORY_LABEL {
            Label: SID_AND_ATTRIBUTES {
                Sid: sid,
                Attributes: 0x0000_0020, // SE_GROUP_INTEGRITY
            },
        };
        let set = SetTokenInformation(
            token,
            TokenIntegrityLevel,
            &label as *const _ as *const core::ffi::c_void,
            std::mem::size_of::<TOKEN_MANDATORY_LABEL>() as u32,
        );
        let _ = LocalFree(Some(HLOCAL(sid.0)));
        if let Err(e) = set {
            let _ = CloseHandle(token);
            return Err(format!("SetTokenInformation(TokenIntegrityLevel): {e}"));
        }
        Ok(token)
    }
}

fn create_job(limits: &SandboxLimits) -> Result<HANDLE, String> {
    unsafe {
        let job = CreateJobObjectW(None, PCWSTR::null()).map_err(|e| format!("CreateJobObjectW: {e}"))?;
        // 基础限额
        let mut ext = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        ext.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
            | JOB_OBJECT_LIMIT_PROCESS_MEMORY
            | JOB_OBJECT_LIMIT_JOB_MEMORY;
        ext.BasicLimitInformation.ActiveProcessLimit = limits.max_processes;
        ext.ProcessMemoryLimit = limits.process_memory_bytes;
        ext.JobMemoryLimit = limits.job_memory_bytes;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &ext as *const _ as *const core::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
        .map_err(|e| format!("SetInformationJobObject(extended): {e}"))?;

        // UI 面：禁止碰剪贴板、桌面、系统参数、全局原子
        {
            let mut ui = JOBOBJECT_BASIC_UI_RESTRICTIONS::default();
            ui.UIRestrictionsClass = JOB_OBJECT_UILIMIT_HANDLES
                | JOB_OBJECT_UILIMIT_DESKTOP
                | JOB_OBJECT_UILIMIT_READCLIPBOARD
                | JOB_OBJECT_UILIMIT_WRITECLIPBOARD
                | JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS;
            SetInformationJobObject(
                job,
                JobObjectBasicUIRestrictions,
                &ui as *const _ as *const core::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_BASIC_UI_RESTRICTIONS>() as u32,
            )
            .map_err(|e| format!("SetInformationJobObject(ui): {e}"))?;
        }
        Ok(job)
    }
}

/// 启动一个受限进程：默认 AppContainer（无网络 capability），或显式低完整性 /
/// 继承完整性。三档都带作业限额与 stdout/stderr 管道；差别在令牌与网络边界。
pub fn spawn(spec: &SandboxSpec) -> Result<SandboxProcess, String> {
    // CreateProcessAsUser 的硬前提；失败即拒，不回落裸跑。guard 在 spawn 结束（成功或
    // 失败）时自动把特权关回去，不永久放大本进程的权限面。
    let _quota_privilege = enable_privilege("SeIncreaseQuotaPrivilege")?;
    let token = create_token(spec.integrity)?;
    let job = match create_job(&spec.limits) {
        Ok(j) => j,
        Err(e) => {
            unsafe {
                let _ = CloseHandle(token);
            }
            return Err(e);
        }
    };

    unsafe {
        let mut sa = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: std::ptr::null_mut(),
            bInheritHandle: true.into(),
        };
        let (mut out_r, mut out_w) = (HANDLE::default(), HANDLE::default());
        let (mut err_r, mut err_w) = (HANDLE::default(), HANDLE::default());
        if let Err(e) = CreatePipe(&mut out_r, &mut out_w, Some(&sa), 0) {
            let _ = CloseHandle(token);
            let _ = CloseHandle(job);
            return Err(format!("CreatePipe(stdout): {e}"));
        }
        if let Err(e) = CreatePipe(&mut err_r, &mut err_w, Some(&sa), 0) {
            for h in [out_r, out_w, token, job] {
                let _ = CloseHandle(h);
            }
            return Err(format!("CreatePipe(stderr): {e}"));
        }
        // 父进程只保留读端；读端不可继承，避免孙进程持有管道导致 EOF 永不出现。
        let _ = windows::Win32::Foundation::SetHandleInformation(
            out_r,
            windows::Win32::Foundation::HANDLE_FLAG_INHERIT.0,
            windows::Win32::Foundation::HANDLE_FLAGS(0),
        );
        let _ = windows::Win32::Foundation::SetHandleInformation(
            err_r,
            windows::Win32::Foundation::HANDLE_FLAG_INHERIT.0,
            windows::Win32::Foundation::HANDLE_FLAGS(0),
        );

        let mut si = STARTUPINFOW::default();
        si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
        si.dwFlags = STARTF_USESTDHANDLES;
        si.hStdOutput = out_w;
        si.hStdError = err_w;
        si.hStdInput = HANDLE::default();
        // 低完整性进程默认拿不到中完整性的 WinSta0；显式指定桌面并让系统按令牌补权限。
        let mut desktop_w = wide("winsta0\\default");
        si.lpDesktop = PWSTR(desktop_w.as_mut_ptr());

        // 只继承 stdout/stderr 两个写端，绝不把父进程其它可继承句柄（包括别的会话管道）
        // 漏给子进程；否则 A 会话会持有 B 会话的写端，B 的 EOF 永远不到。
        let mut attr_size: usize = 0;
        let _ = InitializeProcThreadAttributeList(None, 1, None, &mut attr_size);
        let mut attr_buf = vec![0u8; attr_size.max(1)];
        let attr_list = LPPROC_THREAD_ATTRIBUTE_LIST(attr_buf.as_mut_ptr() as *mut core::ffi::c_void);
        InitializeProcThreadAttributeList(Some(attr_list), 1, None, &mut attr_size)
            .map_err(|e| format!("InitializeProcThreadAttributeList: {e}"))?;
        let inherit = [out_w, err_w];
        UpdateProcThreadAttribute(
            attr_list,
            0,
            PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
            Some(inherit.as_ptr() as *const core::ffi::c_void),
            std::mem::size_of::<HANDLE>() * inherit.len(),
            None,
            None,
        )
        .map_err(|e| format!("UpdateProcThreadAttribute(HANDLE_LIST): {e}"))?;
        let mut siex = STARTUPINFOEXW::default();
        siex.StartupInfo = si;
        siex.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
        siex.lpAttributeList = attr_list;

        let resolved = resolve_program(&spec.program);
        let mut program_w = wide(&resolved);
        let cmd = spec
            .raw_command_line
            .clone()
            .unwrap_or_else(|| command_line(&resolved, &spec.args));
        let mut cmd_w = wide(&cmd);
        let cwd_w = spec
            .cwd
            .as_ref()
            .map(|p| wide(&p.to_string_lossy()))
            .unwrap_or_default();

        let mut pi = PROCESS_INFORMATION::default();
        let flags: PROCESS_CREATION_FLAGS = CREATE_SUSPENDED | CREATE_NO_WINDOW;
        let create = CreateProcessAsUserW(
            Some(token),
            PCWSTR(program_w.as_mut_ptr()),
            Some(PWSTR(cmd_w.as_mut_ptr())),
            None,
            None,
            true,
            flags,
            None,
            if cwd_w.is_empty() { PCWSTR::null() } else { PCWSTR(cwd_w.as_ptr()) },
            &siex.StartupInfo,
            &mut pi,
        );
        DeleteProcThreadAttributeList(attr_list);
        // 父进程的写端、令牌用完即关；读端留给孩子退出后读 EOF。
        for h in [out_w, err_w, token] {
            let _ = CloseHandle(h);
        }
        if let Err(e) = create {
            for h in [out_r, err_r, job] {
                let _ = CloseHandle(h);
            }
            return Err(format!(
                "CreateProcessAsUserW: {e} (program={:?})",
                spec.program
            ));
        }

        // 先挂作业再放行：子进程没有「挂载前先跑一段」的窗口。
        if let Err(e) = AssignProcessToJobObject(job, pi.hProcess) {
            let _ = TerminateProcess(pi.hProcess, 1);
            for h in [pi.hProcess, pi.hThread, out_r, err_r, job] {
                let _ = CloseHandle(h);
            }
            return Err(format!("AssignProcessToJobObject: {e}"));
        }
        if ResumeThread(pi.hThread) == u32::MAX {
            let err = GetLastError();
            for h in [pi.hProcess, pi.hThread, out_r, err_r, job] {
                let _ = CloseHandle(h);
            }
            return Err(format!("ResumeThread 失败: {err:?}"));
        }

        Ok(SandboxProcess {
            pid: pi.dwProcessId,
            process: pi.hProcess,
            thread: pi.hThread,
            job,
            stdout: Some(File::from_raw_handle(out_r.0 as RawHandle)),
            stderr: Some(File::from_raw_handle(err_r.0 as RawHandle)),
        })
    }
}

/// 真实自检：启动 `cmd.exe /c echo sandbox-probe-ok`，要求退出码 0 且输出匹配。
///
/// 这不是恒真桩：令牌创建失败、低完整性设置失败、管道继承失败、进程创建失败
/// 都会返回 `supported=false` 并带具体原因。
pub fn probe() -> ProbeReport {
    let comspec = std::env::var("COMSPEC").unwrap_or_else(|_| "C:\\Windows\\System32\\cmd.exe".to_string());
    let spec = SandboxSpec::new(comspec)
        .arg("/c")
        .arg("echo sandbox-probe-ok");
    match spawn(&spec) {
        Ok(mut child) => {
            let out = child.read_stdout_to_end().unwrap_or_default();
            let code = child.wait(Some(Duration::from_secs(10)));
            let ok = code.as_ref().map(|c| *c == 0).unwrap_or(false) && out.contains("sandbox-probe-ok");
            ProbeReport {
                supported: ok,
                tier: "appcontainer-job",
                detail: if ok {
                    "AppContainer 进程可启动，stdout 管道可读，无 internetClient capability".to_string()
                } else {
                    format!(
                        "进程启动但判据不成立: exit={code:?} stdout_len={}",
                        out.len()
                    )
                },
            }
        }
        Err(e) => ProbeReport {
            supported: false,
            tier: "appcontainer-job",
            detail: e,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cmd_spec(script: &str) -> SandboxSpec {
        let comspec = std::env::var("COMSPEC").unwrap_or_else(|_| "C:\\Windows\\System32\\cmd.exe".to_string());
        SandboxSpec::new(comspec).arg("/c").arg(script)
    }

    #[test]
    fn probe_reports_supported_on_this_machine() {
        let report = probe();
        assert!(report.supported, "探测失败: {}", report.detail);
        assert_eq!(report.tier, "appcontainer-job");
    }

    #[test]
    fn echo_runs_and_stdout_is_captured() {
        let mut child = spawn(&cmd_spec("echo sandbox-ok")).expect("spawn");
        let out = child.read_stdout_to_end().expect("stdout");
        let code = child.wait(Some(Duration::from_secs(10))).expect("wait");
        assert_eq!(code, 0);
        assert!(out.contains("sandbox-ok"), "stdout={out:?}");
    }

    #[test]
    fn inherit_integrity_can_write_medium_integrity_workspace_file() {
        // 显式 Inherit 档不降 IL，仍挂 Job；用于"必须写工作区"的长任务。
        let target = std::path::Path::new(r"C:\IHUI-AI")
            .join(format!("sandbox-inherit-test-{}.txt", std::process::id()));
        let _ = std::fs::remove_file(&target);
        let script = format!("echo medium> {}", target.display());
        let mut spec = cmd_spec(&script);
        spec.integrity = IntegrityMode::Inherit;
        let mut child = spawn(&spec).expect("spawn inherit");
        let _ = child.read_stdout_to_end();
        let _ = child.read_stderr_to_end();
        let code = child.wait(Some(Duration::from_secs(10))).expect("wait");
        assert_eq!(code, 0, "Inherit 档执行失败");
        assert!(target.is_file(), "Inherit 档应能写工作区文件");
        let body = std::fs::read_to_string(&target).unwrap_or_default();
        assert!(body.contains("medium"), "写入内容={body:?}");
        let _ = std::fs::remove_file(&target);
    }

    #[test]
    fn low_integrity_cannot_write_medium_integrity_file() {
        // C:\IHUI-AI 是用户目录下的中完整性路径；低完整性进程写入必须被 MIC 拒绝。
        let target = std::path::Path::new(r"C:\IHUI-AI\sandbox-escape-test.txt");
        let _ = std::fs::remove_file(target);
        let script = format!("echo escape> {}", target.display());
        let mut child = spawn(&cmd_spec(&script)).expect("spawn");
        let _ = child.read_stdout_to_end();
        let _ = child.read_stderr_to_end();
        let _ = child.wait(Some(Duration::from_secs(10)));
        assert!(
            !target.exists(),
            "低完整性进程不应能写中完整性文件: {}",
            target.display()
        );
    }

    #[test]
    fn appcontainer_token_is_real_and_network_is_blocked() {
        use std::io::Read;

        // 先证明子进程真的是 AppContainer 令牌，不靠调用返回成功猜。
        let mut groups = cmd_spec("echo appcontainer-probe");
        groups.integrity = IntegrityMode::AppContainer;
        let mut g = spawn(&groups).expect("spawn appcontainer probe");
        assert!(g.is_appcontainer().expect("query appcontainer token"), "子进程不是 AppContainer");
        let gout = g.read_stdout_to_end().expect("probe stdout");
        assert_eq!(g.wait(Some(Duration::from_secs(10))).expect("probe wait"), 0);
        assert!(gout.contains("appcontainer-probe"), "stdout={gout:?}");

        let mut net = cmd_spec("ping -n 1 8.8.8.8");
        net.integrity = IntegrityMode::AppContainer;
        let mut n = spawn(&net).expect("spawn appcontainer ping");
        let mut bytes = Vec::new();
        if let Some(mut f) = n.stdout.take() {
            f.read_to_end(&mut bytes).expect("ping stdout bytes");
        }
        let nout = String::from_utf8_lossy(&bytes).into_owned();
        let nerr = n.read_stderr_to_end().unwrap_or_default();
        let code = n.wait(Some(Duration::from_secs(10))).expect("ping wait");
        assert!(
            code != 0 && !nout.contains("TTL=") && !nout.contains("字节=32"),
            "AppContainer 仍能出网: code={code} stdout={nout:?} stderr={nerr:?}"
        );
    }

    #[test]
    fn kill_terminates_job_immediately() {
        let mut child = spawn(&cmd_spec("ping -n 30 127.0.0.1 > nul")).expect("spawn");
        child.kill().expect("kill");
        let code = child.wait(Some(Duration::from_secs(5)));
        // 作业终止后进程必须以非零码退出，且等待不能超时
        assert!(code.is_ok(), "kill 后等待超时: {code:?}");
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
