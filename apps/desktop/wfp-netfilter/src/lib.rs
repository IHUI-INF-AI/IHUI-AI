// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! Windows Filtering Platform 网络策略编译层 —— 遵循统一工程规范。
//!
//! # 取证依据（2026-11-15，Round 10）
//!
//! 对侧 `codex-windows-sandbox-service.exe` 的导入表实测（craft-anything
//! `native-library-calls-list`，363 条导入）含 WFP 全套事务化 API：
//!
//! ```text
//! FwpmEngineOpen0      FwpmEngineClose0
//! FwpmTransactionBegin0 FwpmTransactionCommit0 FwpmTransactionAbort0
//! FwpmProviderAdd0     FwpmProviderDeleteByKey0
//! FwpmSubLayerAdd0     FwpmSubLayerDeleteByKey0
//! FwpmFilterAdd0       FwpmFilterDeleteByKey0
//! ```
//! 均来自 `fwpuclnt.dll`。
//!
//! 策略侧 schema 实测（`codex-command-runner.exe` .rdata）：
//! `network_rule` 的 `protocol` 值域恰为
//! **`http` / `https` / `socks5_tcp` / `socks5_udp`**，
//! `host` 五条校验含「**必须是具体主机，不允许通配符**」。
//!
//! # 本模块的分层（为什么这样切）
//!
//! ```text
//! ┌─────────────────────────────────────────────────┐
//! │ 1. 策略编译层（纯逻辑，无 FFI，全平台可测）        │  ← 本文件主体
//! │    NetworkRule → FilterSpec                      │
//! │    host 规范化 / 协议映射 / 决策映射 / 去重幂等     │
//! ├─────────────────────────────────────────────────┤
//! │ 2. 安装层（FFI 骨架，需管理员）                    │  ← 仅 Windows 编译
//! │    FilterSpec → FwpmFilterAdd0（事务包裹）         │
//! ├─────────────────────────────────────────────────┤
//! │ 3. 接线层（不加：属主在合并窗口完成）              │
//! └─────────────────────────────────────────────────┘
//! ```
//!
//! **第 1 层是本模块的交付重心**：它是纯函数，可以在任何平台 `cargo test`，
//! 且策略正确性（host 规范化、协议映射、幂等）完全可验证 —— 不依赖提权。
//! 第 2 层需要管理员与真实 WFP 环境，本模块只提供**结构构造与错误映射**，
//! 不在本轮宣称可用（见 `install` 模块文档）。
//!
//! # 显式不做
//!
//! - 不做实际 filter 安装的端到端验证：需要管理员会话 + 真实网卡状态，
//!   且失败用例（驱动拒绝、策略冲突）无法在容器内复现 ⇒ 不做无验证的宣称。
//! - 不做 WFP provider 的 GUID 分配：由安装层调用方传入稳定 GUID，
//!   本模块只校验形状（避免每次运行换 GUID 导致残留规则无法清理）。
//! - 不碰 `src-tauri/lib.rs`：该文件当前为他席在飞件（见 AGENTS.md §2）。

#![deny(unsafe_op_in_unsafe_fn)]
#![warn(missing_docs)]

pub mod host_executable;
pub mod install;
pub mod policy;
// 静态接线层：手写 WFP FFI 绑定。整层都是**纯声明 + 纯逻辑构造**（结构体/GUID/条件），
// 在任意平台可编译可测；只有 `extern "system"` 函数绑定块用 #[cfg(windows)] 门禁
// （Linux 无 fwpuclnt.dll 供链接）。本层不调用任何改系统状态的函数——见模块文档。
pub mod wfp_ffi;

pub use wfp_ffi::{
    build_conditions_for_spec, FilterAction, FilterCondition, FilterConditionValue,
    FWPM_CONDITION_IP_PROTOCOL, FWPM_CONDITION_IP_REMOTE_ADDRESS,
    FWPM_LAYER_ALE_AUTH_CONNECT_V4, FWPM_LAYER_ALE_AUTH_CONNECT_V6,
};

pub use host_executable::{
    compile_host_executables, HostExecutableBinding, HostExecutableClaim, HostExecutableCompilation,
    HostExecutableError, HostExecutableId,
};
pub use policy::{
    compile_rules, CompileError, Decision, FilterSpec, InstallPlan, NetworkProtocol, NetworkRule,
    RuleId,
};

/// 本 crate 的版本（供安装层写入 provider 描述，便于按版本排查残留规则）。
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
#[path = "wfp_ffi_test.rs"]
mod wfp_ffi_test;
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
