// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! P3-01 ALPC 通道抽象层 —— 边界 trait + 外部 SD 入参契约 + fail-closed 构造纪律。
//!
//! 对照 Trae `aiep_ipc.dll`（取证见 `docs/benchmark-evidence/2026-11/native-functions-2026-11-24.md`
//! P3-01）：四个导出名、12 条 ALPC 导入、两套对象布局尺寸、空参返回 0、建段失败/缓冲失败走
//! 错误分支、错误码 `0xc000000d`（STATUS_INVALID_PARAMETER）属**观察**；ALPC 收发帧格式、
//! SDDL/ACL 主体、端口名、SD 在调用方何处构造仍属**未知**。
//!
//! 纪律（三档口径，未知不臆造）：
//! - 本层**不实现** `NtAlpcSendWaitReceivePort` 收发循环；真实 ALPC 后端在取证补齐前落
//!   `Unjudged`，不假装可用；
//! - 外部安全描述符由调用方传入，本层**不构造 SD、不解析其中 SID、不读客户端身份就放行**；
//!   形状校验归调用方 / 兜底层；
//! - fail-closed：空参、建段失败、缓冲分配失败均显式返回错误码；构造中途失败，已开出的
//!   句柄令牌随栈展开由 Drop 收回，不留半初始化句柄。
//!
//! 分层（与 `ipc_channel_acl.rs` 不重复、不合并、不改它的逻辑）：
//! - `ipc_channel_acl.rs`：命名管道 DACL 兜底层（SDDL 构造 + 两条 ACE 复核 + 受限管道句柄）；
//! - 本层：通道抽象（open / close / attach_security_descriptor）+ 错误码族 + RAII 句柄槽；
//!   兜底路径复用 `ipc_channel_acl::create_restricted_pipe`。

use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// 对照方观察到的参数非法状态码：`STATUS_INVALID_PARAMETER = 0xc000000d`。
pub const STATUS_INVALID_PARAMETER: u32 = 0xC000_000D;

/// 外部传入的安全描述符（不透明 blob）。
///
/// 本层不碰其中内容：不构造 SD、不解析 SID、不因"看起来像合法主体"而放行。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecurityDescriptorInput {
    pub descriptor: Vec<u8>,
}

/// 通道打开配置。配置指针为空 / 通道名为空 ⇒ `InvalidParameter`（fail-closed，不回落裸通道）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChannelConfig {
    pub name: String,
    pub security: Option<SecurityDescriptorInput>,
    pub section_size: usize,
    pub buffer_size: usize,
}

/// 通道错误码族。不许用裸 `io::Error` 把语义吞掉：每一档都带机器可读码 + 具名原因。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChannelError {
    /// 空参 / 配置指针为空（映射 `STATUS_INVALID_PARAMETER = 0xc000000d`）。
    InvalidParameter {
        raw_status: u32,
        detail: String,
    },
    /// 端口创建失败。
    PortCreateFailed { detail: String },
    /// 建段失败（对照方 `NtAlpcCreatePortSection` 返回负值分支）。
    SectionCreateFailed { detail: String },
    /// 消息池缓冲分配失败。
    BufferAllocFailed { detail: String },
    /// 当前平台不支持该后端（点名原因，不假装有）。
    UnsupportedPlatform { reason: &'static str },
    /// 后端能力未取证：不假装可用。
    Unjudged { reason: String },
}

impl ChannelError {
    /// 机器可读错误码（对齐对照方"具名错误分支"形态）。
    pub fn code(&self) -> &'static str {
        match self {
            ChannelError::InvalidParameter { .. } => "STATUS_INVALID_PARAMETER",
            ChannelError::PortCreateFailed { .. } => "PORT_CREATE_FAILED",
            ChannelError::SectionCreateFailed { .. } => "SECTION_CREATE_FAILED",
            ChannelError::BufferAllocFailed { .. } => "BUFFER_ALLOC_FAILED",
            ChannelError::UnsupportedPlatform { .. } => "UNSUPPORTED_PLATFORM",
            ChannelError::Unjudged { .. } => "UNJUDGED",
        }
    }
}

impl fmt::Display for ChannelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ChannelError::InvalidParameter { raw_status, detail } => {
                write!(f, "{} (status=0x{raw_status:08x}): {detail}", self.code())
            }
            ChannelError::PortCreateFailed { detail } => write!(f, "{}: {detail}", self.code()),
            ChannelError::SectionCreateFailed { detail } => {
                write!(f, "{}: {detail}", self.code())
            }
            ChannelError::BufferAllocFailed { detail } => {
                write!(f, "{}: {detail}", self.code())
            }
            ChannelError::UnsupportedPlatform { reason } => {
                write!(f, "{}: {reason}", self.code())
            }
            ChannelError::Unjudged { reason } => write!(f, "{}: {reason}", self.code()),
        }
    }
}

/// 句柄台账（可注入假工厂断言残留）。
///
/// 真实后端的句柄关闭由 `HandleToken` 的 Drop 负责；这里只计数"开出几枚 / 收回几枚"，
/// 测试据此断言构造失败后零残留（leak == 0）。
#[derive(Debug, Default)]
pub struct HandleTracker {
    open: AtomicU64,
    closed: AtomicU64,
}

impl HandleTracker {
    pub fn opened(&self) -> u64 {
        self.open.load(Ordering::SeqCst)
    }

    pub fn closed(&self) -> u64 {
        self.closed.load(Ordering::SeqCst)
    }

    /// 未收回句柄数（构造失败后必须为 0）。
    pub fn leak(&self) -> u64 {
        self.opened().saturating_sub(self.closed())
    }
}

/// RAII 句柄令牌：Drop 时登记关闭。构造中途失败，已开出的令牌随栈展开被 Drop 收回。
pub struct HandleToken {
    #[allow(dead_code)]
    id: u64,
    tracker: Option<Arc<HandleTracker>>,
}

impl Drop for HandleToken {
    fn drop(&mut self) {
        if let Some(tracker) = &self.tracker {
            tracker.closed.fetch_add(1, Ordering::SeqCst);
        }
    }
}

/// 通道后端工厂（可注入；测试用假工厂强制某一步失败并计数句柄）。
pub trait ChannelBackend {
    /// 创建端口；失败返回具名错误，不允许回落无保护的裸通道。
    fn create_port(
        &self,
        config: &ChannelConfig,
        tracker: &Arc<HandleTracker>,
    ) -> Result<HandleToken, ChannelError>;

    /// 创建共享段（建段）。
    fn create_section(
        &self,
        config: &ChannelConfig,
        tracker: &Arc<HandleTracker>,
    ) -> Result<HandleToken, ChannelError>;

    /// 申请消息池缓冲（对照方两块 0xc839 字节消息池；尺寸按配置走）。
    fn allocate_buffers(
        &self,
        config: &ChannelConfig,
        tracker: &Arc<HandleTracker>,
    ) -> Result<Vec<HandleToken>, ChannelError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ChannelState {
    Idle,
    Open,
    Closed,
}

/// 通道边界 trait：三面 —— 打开 / 关闭 / 挂接外部 SD。
pub trait IpcChannel {
    /// 打开（创建）通道；空参即拒。
    fn open(&mut self, config: &ChannelConfig) -> Result<(), ChannelError>;
    /// 关闭通道；RAII 兜底，重复关闭安全。
    fn close(&mut self);
    /// 挂接调用方传入的外部 SD；本层不构造 SD。
    fn attach_security_descriptor(
        &mut self,
        sd: &SecurityDescriptorInput,
    ) -> Result<(), ChannelError>;
}

/// 抽象通道：持有后端、句柄槽与已挂接的外部 SD。
pub struct AbstractChannel<B: ChannelBackend> {
    backend: B,
    tracker: Arc<HandleTracker>,
    state: ChannelState,
    port: Option<HandleToken>,
    section: Option<HandleToken>,
    buffers: Vec<HandleToken>,
    attached_sd: Option<SecurityDescriptorInput>,
}

impl<B: ChannelBackend> AbstractChannel<B> {
    pub fn new(backend: B) -> Self {
        Self {
            backend,
            tracker: Arc::new(HandleTracker::default()),
            state: ChannelState::Idle,
            port: None,
            section: None,
            buffers: Vec::new(),
            attached_sd: None,
        }
    }

    /// 句柄台账引用（测试断言残留用）。
    pub fn tracker(&self) -> Arc<HandleTracker> {
        self.tracker.clone()
    }

    pub fn is_open(&self) -> bool {
        self.state == ChannelState::Open
    }
}

impl<B: ChannelBackend> IpcChannel for AbstractChannel<B> {
    fn open(&mut self, config: &ChannelConfig) -> Result<(), ChannelError> {
        // ① 空参即拒：通道名为空 = 配置指针 / 必填字段为空，走 STATUS_INVALID_PARAMETER。
        if config.name.trim().is_empty() {
            return Err(ChannelError::InvalidParameter {
                raw_status: STATUS_INVALID_PARAMETER,
                detail: "channel name is empty (config pointer / required field null)".into(),
            });
        }

        // ② 建端口；失败即返，此时还没有任何已开出句柄可漏。
        let port = self.backend.create_port(config, &self.tracker)?;
        self.port = Some(port);

        // ③ 建段；失败 ⇒ 端口令牌 Drop 收回，再返回错误。
        let section = match self.backend.create_section(config, &self.tracker) {
            Ok(section) => section,
            Err(err) => {
                self.port.take();
                return Err(err);
            }
        };
        self.section = Some(section);

        // ④ 缓冲分配；失败 ⇒ 段、端口依次 Drop 收回，再返回错误。
        let buffers = match self.backend.allocate_buffers(config, &self.tracker) {
            Ok(buffers) => buffers,
            Err(err) => {
                self.section.take();
                self.port.take();
                return Err(err);
            }
        };
        self.buffers = buffers;
        self.state = ChannelState::Open;

        // 外部 SD 在 open 后挂接；本层只持有不解析。
        if let Some(sd) = &config.security {
            self.attach_security_descriptor(sd)?;
        }
        Ok(())
    }

    fn close(&mut self) {
        // 令牌 Drop 即登记关闭；显式 close 与 Drop 同路径，重复关闭安全。
        self.buffers.clear();
        self.section.take();
        self.port.take();
        self.attached_sd = None;
        self.state = ChannelState::Closed;
    }

    fn attach_security_descriptor(
        &mut self,
        sd: &SecurityDescriptorInput,
    ) -> Result<(), ChannelError> {
        if sd.descriptor.is_empty() {
            return Err(ChannelError::InvalidParameter {
                raw_status: STATUS_INVALID_PARAMETER,
                detail: "security descriptor input is empty".into(),
            });
        }
        self.attached_sd = Some(sd.clone());
        Ok(())
    }
}

impl<B: ChannelBackend> Drop for AbstractChannel<B> {
    fn drop(&mut self) {
        self.close();
    }
}

/// 传输探测回执（命令面 DTO 由 sandbox_ipc 映射；本层只给纯数据）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransportReport {
    /// 实际兜底传输：`pipe-dacl` / `none`。
    pub transport: &'static str,
    /// ALPC 后端状态：`unjudged` / `unsupported` / `available`。
    pub alpc_status: &'static str,
    /// 具名原因（未取证 / 不支持 / 兜底失败原文）。
    pub reason: String,
}

/// 探测当前可用通道传输。
///
/// - 非 Windows：ALPC 与受限命名管道均为 Windows 专有能力 ⇒ `unsupported`，不假装可用；
/// - Windows：ALPC 后端（12 条 `NtAlpc*` 原语）本轮未函数级取证 ⇒ `unjudged`；
///   兜底复用 `ipc_channel_acl::create_restricted_pipe`（当前用户 + SYSTEM 两条 ACE）。
pub fn probe_transport(user_sid: &str, pipe_leaf: &str) -> TransportReport {
    if cfg!(not(windows)) {
        return TransportReport {
            transport: "none",
            alpc_status: "unsupported",
            reason: "ALPC 与受限命名管道 DACL 均为 Windows 专有能力；当前平台未取证等价实现".into(),
        };
    }

    let alpc_status = "unjudged";
    let name = format!(r"\\.\pipe\{pipe_leaf}");
    match crate::ipc_channel_acl::create_restricted_pipe(&name, user_sid) {
        Ok(pipe) => {
            drop(pipe);
            TransportReport {
                transport: "pipe-dacl",
                alpc_status,
                reason: "ALPC 后端未取证；已回落当前用户+SYSTEM 两条 ACE 的受限命名管道".into(),
            }
        }
        Err(err) => TransportReport {
            transport: "none",
            alpc_status,
            reason: format!("受限管道兜底亦失败: {err}"),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeBackend {
        tracker: Arc<HandleTracker>,
        fail_port: bool,
        fail_section: bool,
        fail_buffer: bool,
    }

    impl FakeBackend {
        fn token(&self) -> HandleToken {
            let id = self.tracker.open.fetch_add(1, Ordering::SeqCst) + 1;
            HandleToken {
                id,
                tracker: Some(self.tracker.clone()),
            }
        }
    }

    impl ChannelBackend for FakeBackend {
        fn create_port(
            &self,
            _config: &ChannelConfig,
            _tracker: &Arc<HandleTracker>,
        ) -> Result<HandleToken, ChannelError> {
            if self.fail_port {
                return Err(ChannelError::PortCreateFailed {
                    detail: "fake: port creation rejected".into(),
                });
            }
            Ok(self.token())
        }

        fn create_section(
            &self,
            _config: &ChannelConfig,
            _tracker: &Arc<HandleTracker>,
        ) -> Result<HandleToken, ChannelError> {
            if self.fail_section {
                return Err(ChannelError::SectionCreateFailed {
                    detail: "fake: section creation rejected".into(),
                });
            }
            Ok(self.token())
        }

        fn allocate_buffers(
            &self,
            _config: &ChannelConfig,
            _tracker: &Arc<HandleTracker>,
        ) -> Result<Vec<HandleToken>, ChannelError> {
            if self.fail_buffer {
                return Err(ChannelError::BufferAllocFailed {
                    detail: "fake: buffer allocation rejected".into(),
                });
            }
            Ok(vec![self.token(), self.token()])
        }
    }

    fn config(name: &str) -> ChannelConfig {
        ChannelConfig {
            name: name.into(),
            security: None,
            section_size: 0x1000,
            buffer_size: 0xC839,
        }
    }

    #[test]
    fn empty_parameter_is_rejected_with_invalid_parameter_status() {
        let tracker = Arc::new(HandleTracker::default());
        let backend = FakeBackend {
            tracker: tracker.clone(),
            fail_port: false,
            fail_section: false,
            fail_buffer: false,
        };
        let mut channel = AbstractChannel::new(backend);

        let err = channel.open(&config("")).expect_err("空通道名必须拒绝");
        assert_eq!(err.code(), "STATUS_INVALID_PARAMETER");
        match err {
            ChannelError::InvalidParameter { raw_status, .. } => {
                assert_eq!(raw_status, STATUS_INVALID_PARAMETER);
            }
            other => panic!("应为 InvalidParameter, 实得 {other:?}"),
        }
        assert_eq!(tracker.leak(), 0, "空参拒绝不得开出任何句柄");
    }

    #[test]
    fn section_failure_returns_section_error_and_leaks_no_handle() {
        let tracker = Arc::new(HandleTracker::default());
        let backend = FakeBackend {
            tracker: tracker.clone(),
            fail_port: false,
            fail_section: true,
            fail_buffer: false,
        };
        let mut channel = AbstractChannel::new(backend);

        let err = channel.open(&config("ihui-test-channel")).expect_err("建段必须拒绝");
        assert_eq!(err.code(), "SECTION_CREATE_FAILED");
        assert_eq!(tracker.leak(), 0, "建段失败: 端口句柄必须被 Drop 收回");
        assert!(!channel.is_open());
    }

    #[test]
    fn buffer_failure_returns_buffer_error_and_leaks_no_handle() {
        let tracker = Arc::new(HandleTracker::default());
        let backend = FakeBackend {
            tracker: tracker.clone(),
            fail_port: false,
            fail_section: false,
            fail_buffer: true,
        };
        let mut channel = AbstractChannel::new(backend);

        let err = channel.open(&config("ihui-test-channel")).expect_err("缓冲必须拒绝");
        assert_eq!(err.code(), "BUFFER_ALLOC_FAILED");
        assert_eq!(tracker.leak(), 0, "缓冲失败: 段与端口句柄必须被 Drop 收回");
    }

    #[test]
    fn successful_open_then_close_balances_handle_tokens() {
        let tracker = Arc::new(HandleTracker::default());
        let backend = FakeBackend {
            tracker: tracker.clone(),
            fail_port: false,
            fail_section: false,
            fail_buffer: false,
        };
        let mut channel = AbstractChannel::new(backend);
        channel
            .open(&config("ihui-test-channel"))
            .expect("假后端应建成功");
        assert!(channel.is_open());
        let opened = tracker.opened();
        assert!(opened >= 3, "端口 + 段 + 两块缓冲, 实得 {opened}");

        channel.close();
        assert_eq!(tracker.leak(), 0, "close 后不得残留句柄");
    }

    #[test]
    fn dropped_channel_recovers_all_tokens() {
        let tracker = Arc::new(HandleTracker::default());
        let backend = FakeBackend {
            tracker: tracker.clone(),
            fail_port: false,
            fail_section: false,
            fail_buffer: false,
        };
        {
            let mut channel = AbstractChannel::new(backend);
            channel.open(&config("ihui-test-channel")).expect("open");
        }
        assert_eq!(tracker.leak(), 0, "Drop 路径必须收回全部令牌");
    }

    #[test]
    fn empty_sd_input_is_rejected() {
        let tracker = Arc::new(HandleTracker::default());
        let backend = FakeBackend {
            tracker,
            fail_port: false,
            fail_section: false,
            fail_buffer: false,
        };
        let mut channel = AbstractChannel::new(backend);
        let err = channel
            .attach_security_descriptor(&SecurityDescriptorInput { descriptor: Vec::new() })
            .expect_err("空 SD 必须拒绝");
        assert_eq!(err.code(), "STATUS_INVALID_PARAMETER");
    }

    #[test]
    fn non_windows_probe_is_unsupported_not_fake_ok() {
        // 与 acl 层同口径:Windows 上跑兜底探测;非 Windows 编译期分支必须落 unsupported,
        // 不得在回执里冒充可用。
        if cfg!(windows) {
            let report = probe_transport("S-1-5-21-1", "ihui-ipc-probe");
            assert!(report.alpc_status == "unjudged", "ALPC 后端未取证, 实得 {}", report.alpc_status);
            assert!(report.transport == "pipe-dacl" || report.transport == "none");
            assert!(!report.reason.is_empty());
        } else {
            let report = probe_transport("S-1-5-21-1", "ihui-ipc-probe");
            assert_eq!(report.alpc_status, "unsupported");
            assert_eq!(report.transport, "none");
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
