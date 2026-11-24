// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 沙箱能力探测平行面 —— **支持 / 不支持 / 未判定三态，不支持即拒**。
//!
//! 来源（2026-11-23 五程序原生取证 B2-01，`docs/benchmark-evidence/2026-11/deep-native-2026-11-23/`）：
//! Trae `resources/app/modules/sandbox/sbox_sdk.dll` 导出 `SBoxSDK_Init` / `InitV2` /
//! `IsSBoxSupported` / `CreateSandbox` / `GetSBoxInfo` / `Action` / `GetLastError` / `UnInit`，
//! `unified/vm_sdk.dll` 同型 `VMSDK_*`；`trae-sandbox.exe` 里逐字命中一组「不支持原因码」枚举串
//! （见 [`UnsupportedReason`]）。只取**接口形态 + fail-closed 纪律**，不搬运任何专有源码、
//! 不加载任何专有 DLL。
//!
//! 三条纪律（对齐本仓 `terminal_session.rs` / `startup_guard.rs`）：
//!
//! 1. **三态不可压成二态**。探测结果只有「支持 / 不支持（带原因码）/ 未判定（带原因）」三种。
//!    未判定 ≠ 支持：探测没跑成（后端缺失、超时、IO 错）时**按最严处理**，同样拒执行。
//!    这条直接照抄 `workspace_index.rs` 的「判不出就 Undetermined，不截断放行」。
//! 2. **不支持即拒，绝不回落裸跑**。`SandboxGate::run` 是唯一执行入口：只有 `Supported`
//!    才会调用传入的执行闭包；`Unsupported` / `Unjudged` 一律返回 [`Refusal`]，
//!    闭包**一次都不会被调用**——「不支持时不创建进程」是结构保证，不是调用方自觉。
//! 3. **作业级复用、VM 级只留桩**。`JobObjectBackend` 复用 `terminal_session::JobObject`
//!    （同一份 `CreateJobObjectW` + `KILL_ON_JOB_CLOSE` 建立逻辑，单一真相源）；
//!    微虚拟机级只提供 `Unjudged(BackendAbsent)` 探测与原因码，不做后端实现——如实承认
//!    「没有就是没有」，不拿空壳冒充能力。

// 本模块是**能力面**：gate / spec / alive 等条目当前只被单测与能力查询命令使用，
// 真正的沙箱执行入口（guarded spawn）还没接。这里显式标注而不是删掉——
// 删了等于把 P0-4 的判据退回成「文档里的设计」。一旦有执行入口接上，撤掉本条即可。
#![allow(dead_code)]

use std::path::PathBuf;

/// 后端形态：对齐 `sbox_sdk`（作业/容器级）与 `vm_sdk`（微虚拟机级）两套平行导出。
pub const TIER_JOB_OBJECT: &str = "job-object";
pub const TIER_MICRO_VM: &str = "micro-vm";

/// 不支持原因码。
///
/// 前 11 条是 `trae-sandbox.exe` 里**逐字命中**的枚举串（复核：`rizin -qc "iz"` 后关键词过滤）。
/// 第 12 条 [`SdkNotLoaded`] 来自同二进制里的错误串 `SDK not loaded`——取证 README 记「12 个原因码」
/// 但只逐字列出 11 条，第 12 条按该错误串落定，标注为**推断**（[`Self::is_verbatim`] 为 false），
/// 不假装逐字命中。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UnsupportedReason {
    OsFailed,
    FileMissX64Ipc,
    FileMissX64Biz,
    FileMissX86Ipc,
    FileMissX86Biz,
    SignatureFailed,
    FileVersionMismatch,
    WineNotSupported,
    ArchUnsupported,
    ShmUnavailable,
    UdsUnavailable,
    SdkNotLoaded,
}

impl UnsupportedReason {
    /// 全部原因码（顺序即对外台账顺序，测试钉住长度与无重复）。
    pub const ALL: [UnsupportedReason; 12] = [
        UnsupportedReason::OsFailed,
        UnsupportedReason::FileMissX64Ipc,
        UnsupportedReason::FileMissX64Biz,
        UnsupportedReason::FileMissX86Ipc,
        UnsupportedReason::FileMissX86Biz,
        UnsupportedReason::SignatureFailed,
        UnsupportedReason::FileVersionMismatch,
        UnsupportedReason::WineNotSupported,
        UnsupportedReason::ArchUnsupported,
        UnsupportedReason::ShmUnavailable,
        UnsupportedReason::UdsUnavailable,
        UnsupportedReason::SdkNotLoaded,
    ];

    /// 对外原因码（逐字对齐原生串，不含驼峰改写）。
    pub fn code(self) -> &'static str {
        match self {
            UnsupportedReason::OsFailed => "OSFailed",
            UnsupportedReason::FileMissX64Ipc => "FileMissX64Ipc",
            UnsupportedReason::FileMissX64Biz => "FileMissX64Biz",
            UnsupportedReason::FileMissX86Ipc => "FileMissX86Ipc",
            UnsupportedReason::FileMissX86Biz => "FileMissX86Biz",
            UnsupportedReason::SignatureFailed => "SignatureFailed",
            UnsupportedReason::FileVersionMismatch => "FileVersionMismatch",
            UnsupportedReason::WineNotSupported => "WineNotSupported",
            UnsupportedReason::ArchUnsupported => "ArchUnsupported",
            UnsupportedReason::ShmUnavailable => "ShmUnavailable",
            UnsupportedReason::UdsUnavailable => "UdsUnavailable",
            UnsupportedReason::SdkNotLoaded => "SdkNotLoaded",
        }
    }

    /// 是否逐字命中原生枚举串。`SdkNotLoaded` 为证据串推断，返回 false。
    pub fn is_verbatim(self) -> bool {
        !matches!(self, UnsupportedReason::SdkNotLoaded)
    }
}

/// 未判定原因：探测本身没跑成，**不等于**「不支持」，但处置相同（拒）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UnjudgedReason {
    /// 该形态在本机没有后端（微虚拟机级就是这一条）。
    BackendAbsent,
    /// 探测超时（后端初始化挂住）。
    ProbeTimeout,
    /// 探测 IO 错（枚举文件 / 读版本失败）。
    ProbeIoError,
    /// 探测过程被权限挡住（无权限不代表不支持）。
    ProbePermissionDenied,
}

impl UnjudgedReason {
    pub const ALL: [UnjudgedReason; 4] = [
        UnjudgedReason::BackendAbsent,
        UnjudgedReason::ProbeTimeout,
        UnjudgedReason::ProbeIoError,
        UnjudgedReason::ProbePermissionDenied,
    ];

    pub fn code(self) -> &'static str {
        match self {
            UnjudgedReason::BackendAbsent => "probe_backend_absent",
            UnjudgedReason::ProbeTimeout => "probe_timeout",
            UnjudgedReason::ProbeIoError => "probe_io_error",
            UnjudgedReason::ProbePermissionDenied => "probe_permission_denied",
        }
    }
}

/// 探测结果三态。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ProbeState {
    Supported,
    Unsupported(UnsupportedReason),
    Unjudged(UnjudgedReason),
}

impl ProbeState {
    pub fn is_supported(self) -> bool {
        matches!(self, ProbeState::Supported)
    }

    /// 对外状态码：`supported` / 原因码 / 未判定原因。
    pub fn code(self) -> &'static str {
        match self {
            ProbeState::Supported => "supported",
            ProbeState::Unsupported(r) => r.code(),
            ProbeState::Unjudged(r) => r.code(),
        }
    }
}

// ---------------------------------------------------------------------------
// P3-02：双判定值留痕（原始 raw + 归一三态 + 来源 API 名）
// ---------------------------------------------------------------------------

/// 作业级探测来源 API 名（对照方 TLS 槽位写入的 `api=...` 一栏）。
pub const API_JOB_OBJECT_PROBE: &str = "job_object_probe";
/// 微虚拟机级探测来源 API 名。
pub const API_MICRO_VM_PROBE: &str = "micro_vm_probe";

/// 一次探测的双判定值留痕：原始判定值 + 归一后的三态 + 来源 API 名。
///
/// 对齐对照方两套同构 `Is*Supported`：判定函数先出原始结果，归一函数再出归一值，
/// 两者都留；本仓额外保留「未判定」态（对照方没有这一档，见模块头注纪律 1）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProbeRecord {
    /// 来源 API 名（对照方非 0 时写进 TLS 槽位的那条）。
    pub source_api: &'static str,
    /// 判定函数直出的原始值；`None` = 判定函数本身没跑成（未判定）。
    pub raw: Option<u32>,
    /// 归一后的三态。
    pub state: ProbeState,
}

impl ProbeRecord {
    /// 归一判据（纯函数，夹具可注入）：原始值 → 三态。
    ///
    /// - `Some(0)` ⇒ 不成立 ⇒ `Unsupported(zero_reason)`；
    /// - `Some(nonzero)` ⇒ 成立 ⇒ `Supported`；
    /// - `None` ⇒ 判定函数没跑成 ⇒ `Unjudged(unavailable)`（不默认支持）。
    pub fn normalize(
        source_api: &'static str,
        raw: Option<u32>,
        zero_reason: UnsupportedReason,
        unavailable: UnjudgedReason,
    ) -> Self {
        let state = match raw {
            Some(0) => ProbeState::Unsupported(zero_reason),
            Some(_) => ProbeState::Supported,
            None => ProbeState::Unjudged(unavailable),
        };
        Self {
            source_api,
            raw,
            state,
        }
    }

    /// 判定是否成立：仅原始值非 0 算成立；未判定 / 不成立都不算。
    pub fn established(&self) -> bool {
        matches!(self.raw, Some(n) if n != 0)
    }
}

/// 探测留痕槽（对照方 TLS 槽位的进程内等价物）。
///
/// 对齐对照方观察：判定为 0 清空留痕；非 0 才在槽位写来源 API 名。判定没跑成（`None`）
/// 同样清空——不许把“没判”留成“支持”。
#[derive(Debug, Default)]
pub struct ProbeTrace {
    record: Option<ProbeRecord>,
}

impl ProbeTrace {
    pub fn new() -> Self {
        Self::default()
    }

    /// 写入一次探测留痕；不成立 / 未跑成 ⇒ 清空槽位。
    pub fn record(&mut self, record: ProbeRecord) {
        self.record = record.established().then_some(record);
    }

    /// 最近一次成立的探测留痕；无成立记录 ⇒ `None`。
    pub fn last(&self) -> Option<&ProbeRecord> {
        self.record.as_ref()
    }

    /// 显式清空。
    pub fn clear(&mut self) {
        self.record = None;
    }
}

/// 形态对齐的探测日志：`stage=support_check native_domain=support_status native={}`。
pub fn log_support_check(record: &ProbeRecord) {
    log::info!(
        "stage=support_check native_domain=support_status native={} source_api={} state={}",
        record.raw.unwrap_or(0),
        record.source_api,
        record.state.code()
    );
}

/// 拒绝执行的回执。`reasons` 至少一条，调用方可直接展示给模型。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Refusal {
    pub tier: &'static str,
    pub state: ProbeState,
    /// 至少一条。未知形态会把 tier 名带进来，故为 String 而非 &'static str。
    pub reasons: Vec<String>,
}

impl Refusal {
    fn from_state(tier: &'static str, state: ProbeState) -> Self {
        Self {
            tier,
            state,
            reasons: vec![state.code().to_string()],
        }
    }
}

/// 执行入口的两种失败：**被拒**（策略）与**执行失败**（真跑了但炸了）。
///
/// 分开是给上层做不同处置：被拒可换档/提示，执行失败要报错并清理。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExecError {
    Refused(Refusal),
    Failed { tier: &'static str, detail: String },
}

impl ExecError {
    pub fn is_refused(&self) -> bool {
        matches!(self, ExecError::Refused(_))
    }
}

/// 要执行的东西（只描述，不持有句柄）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SandboxSpec {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: Option<PathBuf>,
    pub timeout_ms: Option<u64>,
}

impl SandboxSpec {
    pub fn new(program: impl Into<String>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            cwd: None,
            timeout_ms: None,
        }
    }

    pub fn arg(mut self, a: impl Into<String>) -> Self {
        self.args.push(a.into());
        self
    }
}

/// 对会话的动作（对齐 `SBoxSDK_Action` 的动作面，只留本仓用得上的两条）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SandboxAction {
    Kill,
}

/// 等待一次沙箱会话的结果。
///
/// `TimedOut` 不是失败:会话仍在跑,句柄仍有效;只有 `Exited` 才会从后端的
/// `children` 表里摘掉。未知 handle 走 `Err`,不折成超时——两者原因不同。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WaitOutcome {
    Exited { code: Option<i32> },
    TimedOut,
}

/// 在跑沙箱会话的只读快照。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AliveInfo {
    pub handle: u64,
    pub pid: u32,
}

/// 后端统一接口（导出名映射：`init`↔`Init/InitV2`、`is_supported`↔`IsSBoxSupported`、
/// `create`↔`CreateSandbox`、`action`↔`Action`、`wait`↔`WaitSandbox`、
/// `get_alive_infos`↔`GetSBoxInfo`、`uninit`↔`UnInit`；`kill_all` 是本仓补的批量善后，
/// 原生由 `Action` 承担）。
pub trait SandboxBackend {
    fn tier(&self) -> &'static str;
    fn init(&mut self) -> Result<(), String>;
    fn is_supported(&self) -> ProbeState;
    fn create(&mut self, spec: &SandboxSpec) -> Result<u64, String>;
    fn action(&mut self, handle: u64, action: SandboxAction) -> Result<(), String>;
    /// 等会话结束(`timeout_ms=None` = 一直等)。超时返回 [`WaitOutcome::TimedOut`],
    /// 会话句柄保留;未知 handle 返回 Err,不冒充超时。
    fn wait(&mut self, handle: u64, timeout_ms: Option<u64>) -> Result<WaitOutcome, String>;
    fn kill_all(&mut self) -> usize;
    fn get_alive_infos(&self) -> Vec<AliveInfo>;
    fn uninit(&mut self);
}

/// **唯一执行入口**：只有 `Supported` 才调用 `exec`，其余一律 [`Refusal`]。
///
/// `run` 收闭包而不是 `&SandboxBackend` 是有意的：这样「不支持时不创建进程」
/// 可以被测试用一个计数闭包直接断言（闭包调用次数必须为 0），不必去信调用方自律。
pub struct SandboxGate {
    tier: &'static str,
    probe: ProbeState,
}

impl SandboxGate {
    pub fn new(tier: &'static str, probe: ProbeState) -> Self {
        Self { tier, probe }
    }

    /// 探测结果（只读）。
    pub fn probe(&self) -> ProbeState {
        self.probe
    }

    /// 执行。`Supported` 才跑 `exec`；`Unsupported` / `Unjudged` 直接拒。
    pub fn run<T>(&self, exec: impl FnOnce() -> Result<T, String>) -> Result<T, ExecError> {
        match self.probe {
            ProbeState::Supported => exec().map_err(|detail| ExecError::Failed {
                tier: self.tier,
                detail,
            }),
            other => Err(ExecError::Refused(Refusal::from_state(self.tier, other))),
        }
    }
}

// ---------------------------------------------------------------------------
// 作业级实现（Windows）：复用 terminal_session 的 Job Object
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod job_object_impl {
    use super::*;
    use std::collections::BTreeMap;
    use std::process::{Child, Command};

    /// 作业级后端：一条作业对象 + 若干挂进去的子进程。
    ///
    /// 建立逻辑**复用** `terminal_session::JobObject::create_kill_on_close`
    /// （`KILL_ON_JOB_CLOSE | BREAKAWAY_OK`，同一份代码，不复制）。
    pub struct JobObjectBackend {
        job: Option<std::sync::Arc<crate::terminal_session::JobObject>>,
        children: BTreeMap<u64, Child>,
        pids: BTreeMap<u64, u32>,
        next_handle: u64,
    }

    impl Default for JobObjectBackend {
        fn default() -> Self {
            Self::new()
        }
    }

    impl JobObjectBackend {
        pub fn new() -> Self {
            Self {
                job: None,
                children: BTreeMap::new(),
                pids: BTreeMap::new(),
                next_handle: 1,
            }
        }
    }

    impl SandboxBackend for JobObjectBackend {
        fn tier(&self) -> &'static str {
            TIER_JOB_OBJECT
        }

        fn init(&mut self) -> Result<(), String> {
            if self.job.is_some() {
                return Ok(());
            }
            let job = crate::terminal_session::JobObject::create_kill_on_close()
                .ok_or_else(|| "CreateJobObjectW/SetInformationJobObject 失败".to_string())?;
            self.job = Some(std::sync::Arc::new(job));
            Ok(())
        }

        fn is_supported(&self) -> ProbeState {
            // 作业对象是 Windows 内核自带能力：init 未跑过 ⇒ 未判定（不假定支持）。
            if self.job.is_some() {
                ProbeState::Supported
            } else {
                ProbeState::Unjudged(UnjudgedReason::BackendAbsent)
            }
        }

        fn create(&mut self, spec: &SandboxSpec) -> Result<u64, String> {
            let job = self
                .job
                .as_ref()
                .ok_or_else(|| "作业对象未初始化（先 init）".to_string())?;
            let mut cmd = Command::new(&spec.program);
            cmd.args(&spec.args)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            if let Some(dir) = &spec.cwd {
                cmd.current_dir(dir);
            }
            let child = cmd
                .spawn()
                .map_err(|e| format!("spawn 失败 program={:?}: {e}", spec.program))?;
            let pid = child.id();
            if !crate::terminal_session::assign_to_job(job, &child) {
                // 挂不进作业 ⇒ 这个子进程没有整树保证：杀掉并如实报错，不降级放行。
                let mut child = child;
                let _ = child.kill();
                let _ = child.wait();
                return Err("AssignProcessToJobObject 失败".to_string());
            }
            let handle = self.next_handle;
            self.next_handle += 1;
            self.pids.insert(handle, pid);
            self.children.insert(handle, child);
            Ok(handle)
        }

        fn action(&mut self, handle: u64, action: SandboxAction) -> Result<(), String> {
            match action {
                SandboxAction::Kill => {
                    let mut child = self
                        .children
                        .remove(&handle)
                        .ok_or_else(|| format!("未知 handle={handle}"))?;
                    let _ = child.kill();
                    let _ = child.wait();
                    self.pids.remove(&handle);
                    Ok(())
                }
            }
        }

        fn wait(&mut self, handle: u64, timeout_ms: Option<u64>) -> Result<WaitOutcome, String> {
            let child = self
                .children
                .get_mut(&handle)
                .ok_or_else(|| format!("未知 handle={handle}"))?;
            let outcome = match timeout_ms {
                None => WaitOutcome::Exited {
                    code: child
                        .wait()
                        .map_err(|e| format!("wait 失败 handle={handle}: {e}"))?
                        .code(),
                },
                Some(ms) => {
                    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(ms);
                    loop {
                        if let Some(status) = child
                            .try_wait()
                            .map_err(|e| format!("try_wait 失败 handle={handle}: {e}"))?
                        {
                            break WaitOutcome::Exited {
                                code: status.code(),
                            };
                        }
                        if std::time::Instant::now() >= deadline {
                            break WaitOutcome::TimedOut;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(20));
                    }
                }
            };
            if matches!(outcome, WaitOutcome::Exited { .. }) {
                self.children.remove(&handle);
                self.pids.remove(&handle);
            }
            Ok(outcome)
        }

        fn kill_all(&mut self) -> usize {
            let n = self.children.len();
            for (_, mut child) in std::mem::take(&mut self.children) {
                let _ = child.kill();
                let _ = child.wait();
            }
            self.pids.clear();
            n
        }

        fn get_alive_infos(&self) -> Vec<AliveInfo> {
            // 只报本后端还持有句柄的会话（不查作业内野进程：那一路要
            // QueryInformationJobObject + 变长 pid 数组，等真有消费方再加）。
            self.pids
                .iter()
                .map(|(h, pid)| AliveInfo {
                    handle: *h,
                    pid: *pid,
                })
                .collect()
        }

        fn uninit(&mut self) {
            self.kill_all();
            self.job = None;
        }
    }
}

#[cfg(windows)]
pub use job_object_impl::JobObjectBackend;

// ---------------------------------------------------------------------------
// 微虚拟机级：只留探测桩，不冒充能力
// ---------------------------------------------------------------------------

/// 微虚拟机级后端桩：`is_supported` 恒 `Unjudged(BackendAbsent)`，
/// `create` 恒 Err。**没有**就是没有——不拿作业级实现顶替 VM 级语义。
#[derive(Debug, Default)]
pub struct MicroVmBackend;

impl MicroVmBackend {
    pub fn new() -> Self {
        Self
    }
}

impl SandboxBackend for MicroVmBackend {
    fn tier(&self) -> &'static str {
        TIER_MICRO_VM
    }

    fn init(&mut self) -> Result<(), String> {
        Err("micro-vm 后端未实现".to_string())
    }

    fn is_supported(&self) -> ProbeState {
        ProbeState::Unjudged(UnjudgedReason::BackendAbsent)
    }

    fn create(&mut self, _spec: &SandboxSpec) -> Result<u64, String> {
        Err("micro-vm 后端未实现".to_string())
    }

    fn action(&mut self, _handle: u64, _action: SandboxAction) -> Result<(), String> {
        Err("micro-vm 后端未实现".to_string())
    }

    fn wait(&mut self, _handle: u64, _timeout_ms: Option<u64>) -> Result<WaitOutcome, String> {
        Err("micro-vm 后端未实现".to_string())
    }

    fn kill_all(&mut self) -> usize {
        0
    }

    fn get_alive_infos(&self) -> Vec<AliveInfo> {
        Vec::new()
    }

    fn uninit(&mut self) {}
}

/// 按形态取后端：作业级给真后端，VM 级给桩（**永不**把作业级当 VM 级的替代）。
pub fn backend_for(tier: &str) -> Result<Box<dyn SandboxBackend>, Refusal> {
    match tier {
        #[cfg(windows)]
        TIER_JOB_OBJECT => Ok(Box::new(JobObjectBackend::new())),
        #[cfg(not(windows))]
        TIER_JOB_OBJECT => Ok(Box::new(PortableJobBackend::new())),
        TIER_MICRO_VM => Ok(Box::new(MicroVmBackend::new())),
        other => Err(Refusal {
            tier: TIER_JOB_OBJECT,
            state: ProbeState::Unjudged(UnjudgedReason::BackendAbsent),
            reasons: vec![format!("unknown_tier:{other}")],
        }),
    }
}

// ---------------------------------------------------------------------------
// 非 Windows 的作业级：进程组等价物（POSIX），未知平台一律未判定
// ---------------------------------------------------------------------------

#[cfg(not(windows))]
#[derive(Debug, Default)]
pub struct PortableJobBackend {
    children: std::collections::BTreeMap<u64, std::process::Child>,
    pids: std::collections::BTreeMap<u64, u32>,
    next_handle: u64,
    initialized: bool,
}

#[cfg(not(windows))]
impl PortableJobBackend {
    pub fn new() -> Self {
        Self {
            next_handle: 1,
            ..Default::default()
        }
    }
}

#[cfg(all(not(windows), unix))]
impl SandboxBackend for PortableJobBackend {
    fn tier(&self) -> &'static str {
        TIER_JOB_OBJECT
    }

    fn init(&mut self) -> Result<(), String> {
        self.initialized = true;
        Ok(())
    }

    fn is_supported(&self) -> ProbeState {
        if self.initialized {
            ProbeState::Supported
        } else {
            ProbeState::Unjudged(UnjudgedReason::BackendAbsent)
        }
    }

    fn create(&mut self, spec: &SandboxSpec) -> Result<u64, String> {
        use std::os::unix::process::CommandExt;
        if !self.initialized {
            return Err("未初始化（先 init）".to_string());
        }
        let mut cmd = std::process::Command::new(&spec.program);
        cmd.args(&spec.args)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .process_group(0);
        if let Some(dir) = &spec.cwd {
            cmd.current_dir(dir);
        }
        let child = cmd
            .spawn()
            .map_err(|e| format!("spawn 失败 program={:?}: {e}", spec.program))?;
        let handle = self.next_handle;
        self.next_handle += 1;
        self.pids.insert(handle, child.id());
        self.children.insert(handle, child);
        Ok(handle)
    }

    fn action(&mut self, handle: u64, action: SandboxAction) -> Result<(), String> {
        match action {
            SandboxAction::Kill => {
                let mut child = self
                    .children
                    .remove(&handle)
                    .ok_or_else(|| format!("未知 handle={handle}"))?;
                let _ = child.kill();
                let _ = child.wait();
                self.pids.remove(&handle);
                Ok(())
            }
        }
    }

    fn wait(&mut self, handle: u64, timeout_ms: Option<u64>) -> Result<WaitOutcome, String> {
        let child = self
            .children
            .get_mut(&handle)
            .ok_or_else(|| format!("未知 handle={handle}"))?;
        let outcome = match timeout_ms {
            None => WaitOutcome::Exited {
                code: child
                    .wait()
                    .map_err(|e| format!("wait 失败 handle={handle}: {e}"))?
                    .code(),
            },
            Some(ms) => {
                let deadline = std::time::Instant::now() + std::time::Duration::from_millis(ms);
                loop {
                    if let Some(status) = child
                        .try_wait()
                        .map_err(|e| format!("try_wait 失败 handle={handle}: {e}"))?
                    {
                        break WaitOutcome::Exited {
                            code: status.code(),
                        };
                    }
                    if std::time::Instant::now() >= deadline {
                        break WaitOutcome::TimedOut;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(20));
                }
            }
        };
        if matches!(outcome, WaitOutcome::Exited { .. }) {
            self.children.remove(&handle);
            self.pids.remove(&handle);
        }
        Ok(outcome)
    }

    fn kill_all(&mut self) -> usize {
        let n = self.children.len();
        for (_, mut child) in std::mem::take(&mut self.children) {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.pids.clear();
        n
    }

    fn get_alive_infos(&self) -> Vec<AliveInfo> {
        self.pids
            .iter()
            .map(|(h, pid)| AliveInfo {
                handle: *h,
                pid: *pid,
            })
            .collect()
    }

    fn uninit(&mut self) {
        self.kill_all();
        self.initialized = false;
    }
}

#[cfg(all(not(windows), not(unix)))]
impl SandboxBackend for PortableJobBackend {
    fn tier(&self) -> &'static str {
        TIER_JOB_OBJECT
    }
    fn init(&mut self) -> Result<(), String> {
        Err("本平台无作业级隔离".to_string())
    }
    fn is_supported(&self) -> ProbeState {
        ProbeState::Unsupported(UnsupportedReason::OsFailed)
    }
    fn create(&mut self, _spec: &SandboxSpec) -> Result<u64, String> {
        Err("本平台无作业级隔离".to_string())
    }
    fn action(&mut self, _h: u64, _a: SandboxAction) -> Result<(), String> {
        Err("本平台无作业级隔离".to_string())
    }
    fn wait(&mut self, _h: u64, _t: Option<u64>) -> Result<WaitOutcome, String> {
        Err("本平台无作业级隔离".to_string())
    }
    fn kill_all(&mut self) -> usize {
        0
    }
    fn get_alive_infos(&self) -> Vec<AliveInfo> {
        Vec::new()
    }
    fn uninit(&mut self) {}
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    /// 计数闭包：断言「被拒不执行」靠它，不靠调用方自律。
    fn counting_exec(calls: &Cell<usize>) -> impl FnOnce() -> Result<u32, String> + '_ {
        move || {
            calls.set(calls.get() + 1);
            Ok(7)
        }
    }

    #[test]
    fn unsupported_reasons_are_twelve_unique_and_mostly_verbatim() {
        assert_eq!(UnsupportedReason::ALL.len(), 12);
        let mut set = std::collections::BTreeSet::new();
        for r in UnsupportedReason::ALL {
            assert!(set.insert(r.code()), "原因码重复: {}", r.code());
        }
        // 11 条逐字 + 1 条推断（SdkNotLoaded）。把「几条算逐字」钉住，
        // 将来补到第 12 条逐字证据时这里会红，提醒改标注而不是悄悄漂移。
        let verbatim = UnsupportedReason::ALL
            .iter()
            .filter(|r| r.is_verbatim())
            .count();
        assert_eq!(verbatim, 11);
        assert!(!UnsupportedReason::SdkNotLoaded.is_verbatim());
    }

    #[test]
    fn every_unsupported_reason_refuses_and_never_executes() {
        for reason in UnsupportedReason::ALL {
            let calls = Cell::new(0usize);
            let gate = SandboxGate::new(TIER_JOB_OBJECT, ProbeState::Unsupported(reason));
            let got = gate.run(counting_exec(&calls));
            assert!(got.is_err(), "{} 必须被拒", reason.code());
            match got.unwrap_err() {
                ExecError::Refused(r) => {
                    assert_eq!(r.reasons, vec![reason.code().to_string()]);
                    assert_eq!(r.tier, TIER_JOB_OBJECT);
                    assert_eq!(r.state, ProbeState::Unsupported(reason));
                }
                other => panic!("{} 应为 Refused，实得 {other:?}", reason.code()),
            }
            assert_eq!(calls.get(), 0, "{} 命中时不得创建进程", reason.code());
        }
    }

    #[test]
    fn every_unjudged_reason_also_refuses() {
        for reason in UnjudgedReason::ALL {
            let calls = Cell::new(0usize);
            let gate = SandboxGate::new(TIER_MICRO_VM, ProbeState::Unjudged(reason));
            let got = gate.run(counting_exec(&calls));
            assert!(got.is_err());
            let refused = got.unwrap_err();
            assert!(refused.is_refused());
            assert_eq!(calls.get(), 0, "未判定时不得创建进程");
        }
    }

    #[test]
    fn supported_executes_exactly_once() {
        let calls = Cell::new(0usize);
        let gate = SandboxGate::new(TIER_JOB_OBJECT, ProbeState::Supported);
        let v = gate.run(counting_exec(&calls)).expect("支持时应放行");
        assert_eq!(v, 7);
        assert_eq!(calls.get(), 1);
    }

    #[test]
    fn execution_failure_is_not_a_refusal() {
        let gate = SandboxGate::new(TIER_JOB_OBJECT, ProbeState::Supported);
        let err = gate
            .run(|| Err::<(), _>("spawn 失败".to_string()))
            .unwrap_err();
        assert!(!err.is_refused(), "真跑了但炸了 ≠ 被拒");
        match err {
            ExecError::Failed { tier, detail } => {
                assert_eq!(tier, TIER_JOB_OBJECT);
                assert!(detail.contains("spawn"));
            }
            other => panic!("应为 Failed，实得 {other:?}"),
        }
    }

    #[test]
    fn micro_vm_backend_is_unjudged_not_supported() {
        let b = MicroVmBackend::new();
        assert_eq!(
            b.is_supported(),
            ProbeState::Unjudged(UnjudgedReason::BackendAbsent)
        );
        assert_eq!(b.tier(), TIER_MICRO_VM);
        let mut b = MicroVmBackend::new();
        assert!(b.create(&SandboxSpec::new("cmd.exe")).is_err());
        assert_eq!(b.kill_all(), 0);
    }

    #[test]
    fn backend_for_maps_tiers_and_refuses_unknown() {
        match backend_for(TIER_MICRO_VM) {
            Ok(b) => assert_eq!(b.tier(), TIER_MICRO_VM),
            Err(r) => panic!("micro-vm 应给桩后端: {r:?}"),
        }
        match backend_for(TIER_JOB_OBJECT) {
            Ok(b) => assert_eq!(b.tier(), TIER_JOB_OBJECT),
            Err(r) => panic!("job-object 应给真后端: {r:?}"),
        }
        let refused = backend_for("no-such-tier").err().expect("未知形态必须拒");
        assert!(refused.reasons[0].starts_with("unknown_tier:"));
    }

    #[cfg(windows)]
    #[test]
    fn job_object_backend_needs_init_before_supported() {
        let b = JobObjectBackend::new();
        // 未 init ⇒ 未判定（不假定支持）
        assert_eq!(
            b.is_supported(),
            ProbeState::Unjudged(UnjudgedReason::BackendAbsent)
        );
        assert!(b.get_alive_infos().is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn job_object_backend_init_then_supported_and_spawn_guarded() {
        let mut b = JobObjectBackend::new();
        b.init().expect("作业对象应能在 Windows 建起来");
        assert_eq!(b.is_supported(), ProbeState::Supported);

        // 不支持路径：把探测结果压成 Unsupported，真后端也不得被调用
        let calls = Cell::new(0usize);
        let gate = SandboxGate::new(
            TIER_JOB_OBJECT,
            ProbeState::Unsupported(UnsupportedReason::SignatureFailed),
        );
        assert!(gate.run(counting_exec(&calls)).is_err());
        assert_eq!(calls.get(), 0);

        // 支持路径：真 spawn 一个立即退出的进程，能拿到 handle
        let mut spec = SandboxSpec::new("cmd.exe");
        spec.args = vec!["/C".into(), "exit 0".into()];
        let handle = b.create(&spec).expect("应能 spawn");
        assert!(handle >= 1);
        assert!(b.get_alive_infos().iter().any(|i| i.handle == handle));
        assert_eq!(b.kill_all(), 1);
        assert!(b.get_alive_infos().is_empty());
        b.uninit();
    }

    #[cfg(windows)]
    #[test]
    fn job_object_backend_wait_reports_exit_and_timeout_without_eating_handle() {
        let mut b = JobObjectBackend::new();
        b.init().expect("作业对象应能建起来");

        // 超时:进程还没退 ⇒ TimedOut,句柄仍在(不是"没等到就当失败")
        let mut slow = SandboxSpec::new("cmd.exe");
        slow.args = vec!["/C".into(), "ping -n 4 127.0.0.1 > nul".into()];
        let slow_handle = b.create(&slow).expect("应能 spawn");
        assert_eq!(
            b.wait(slow_handle, Some(50)).expect("wait 不应炸"),
            WaitOutcome::TimedOut
        );
        assert!(b.get_alive_infos().iter().any(|i| i.handle == slow_handle));
        b.action(slow_handle, SandboxAction::Kill)
            .expect("超时后应能 kill");
        assert!(b.get_alive_infos().is_empty());

        // 正常退出:拿得到真实 exit code,并从存活表摘掉
        let mut quick = SandboxSpec::new("cmd.exe");
        quick.args = vec!["/C".into(), "exit 3".into()];
        let quick_handle = b.create(&quick).expect("应能 spawn");
        assert_eq!(
            b.wait(quick_handle, Some(5_000)).expect("wait 不应炸"),
            WaitOutcome::Exited { code: Some(3) }
        );
        assert!(b.get_alive_infos().is_empty());
        b.uninit();
    }

    #[cfg(windows)]
    #[test]
    fn wait_without_timeout_blocks_until_exit() {
        let mut b = JobObjectBackend::new();
        b.init().expect("作业对象应能建起来");
        let mut spec = SandboxSpec::new("cmd.exe");
        spec.args = vec!["/C".into(), "exit 5".into()];
        let handle = b.create(&spec).expect("应能 spawn");
        // timeout_ms=None ⇒ 一直等到退出,拿到真实 code,并从存活表摘掉
        assert_eq!(
            b.wait(handle, None).expect("wait 不应炸"),
            WaitOutcome::Exited { code: Some(5) }
        );
        assert!(b.get_alive_infos().is_empty());
        b.uninit();
    }

    #[cfg(windows)]
    #[test]
    fn wait_unknown_handle_is_err_not_timeout() {
        let mut b = JobObjectBackend::new();
        b.init().expect("作业对象应能建起来");
        let err = b.wait(999, Some(10)).expect_err("未知 handle 必须报错");
        assert!(err.contains("未知 handle=999"));
    }

    #[test]
    fn normalize_maps_raw_to_state_and_keeps_source_api() {
        let ok = ProbeRecord::normalize(
            API_JOB_OBJECT_PROBE,
            Some(1),
            UnsupportedReason::OsFailed,
            UnjudgedReason::BackendAbsent,
        );
        assert_eq!(ok.state, ProbeState::Supported);
        assert!(ok.established());
        assert_eq!(ok.source_api, API_JOB_OBJECT_PROBE);
        assert_eq!(ok.raw, Some(1));

        let zero = ProbeRecord::normalize(
            API_MICRO_VM_PROBE,
            Some(0),
            UnsupportedReason::OsFailed,
            UnjudgedReason::BackendAbsent,
        );
        assert_eq!(
            zero.state,
            ProbeState::Unsupported(UnsupportedReason::OsFailed)
        );
        assert!(!zero.established());

        let missed = ProbeRecord::normalize(
            API_MICRO_VM_PROBE,
            None,
            UnsupportedReason::OsFailed,
            UnjudgedReason::BackendAbsent,
        );
        assert_eq!(
            missed.state,
            ProbeState::Unjudged(UnjudgedReason::BackendAbsent)
        );
        assert!(!missed.established());
    }

    #[test]
    fn trace_clears_on_non_established_and_keeps_on_established() {
        let mut trace = ProbeTrace::new();
        let zero = ProbeRecord::normalize(
            API_JOB_OBJECT_PROBE,
            Some(0),
            UnsupportedReason::OsFailed,
            UnjudgedReason::BackendAbsent,
        );
        trace.record(zero);
        assert!(trace.last().is_none(), "不成立必须清空留痕");

        let missed = ProbeRecord::normalize(
            API_MICRO_VM_PROBE,
            None,
            UnsupportedReason::OsFailed,
            UnjudgedReason::BackendAbsent,
        );
        trace.record(missed);
        assert!(trace.last().is_none(), "未判定必须清空留痕");

        let ok = ProbeRecord::normalize(
            API_JOB_OBJECT_PROBE,
            Some(7),
            UnsupportedReason::OsFailed,
            UnjudgedReason::BackendAbsent,
        );
        trace.record(ok);
        assert_eq!(trace.last().unwrap().source_api, API_JOB_OBJECT_PROBE);
        trace.clear();
        assert!(trace.last().is_none());
    }

    #[test]
    fn support_check_log_path_is_callable_with_raw_and_api() {
        let rec = ProbeRecord::normalize(
            API_JOB_OBJECT_PROBE,
            Some(1),
            UnsupportedReason::OsFailed,
            UnjudgedReason::BackendAbsent,
        );
        // 不打断言:确保留痕记录可走进日志路径;形态串由 log 宏承载。
        log_support_check(&rec);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
