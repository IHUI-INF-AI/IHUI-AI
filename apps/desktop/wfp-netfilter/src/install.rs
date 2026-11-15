// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 安装层：把 [`crate::policy::InstallPlan`] 落到 WFP（Windows Filtering Platform）。
//!
//! # 对侧实测的调用序列（观察）
//!
//! `codex-windows-sandbox-service.exe` 导入表证明对侧用**事务化**方式装 filter：
//!
//! ```text
//! FwpmEngineOpen0            ← 打开引擎会话
//! FwpmTransactionBegin0      ← 事务开始
//!   FwpmProviderAdd0         ← 具名 provider（标识"谁加的规则"）
//!   FwpmSubLayerAdd0         ← 子层（决定优先级分组）
//!   FwpmFilterAdd0           ← 实际规则
//! FwpmTransactionCommit0     ← 全成或全不成
//! FwpmTransactionAbort0      ← 任一失败则回滚
//! ```
//!
//! 为什么必须事务化：多条 filter 若中途失败，会留下**半开的网络策略**——
//! 那是安全漏洞（用户以为被拦，实际放行了）。对侧把
//! `{Begin, Commit, Abort}` 三件套全导入，说明这条被认真对待过。
//!
//! # 本模块的诚实边界
//!
//! **字段值已取证，但行为未端到端验证 —— 因此仍不宣称「可用」。**
//!
//! ## 已取证（2026-11-15，调用点级，见
//! `.ihui-agent/tmp/goal-codex/evidence/wfp-fwpm-filter0-fields.md`）
//!
//! 上轮「导入表只见函数名、不见调用点结构体」的缺口已补上：对
//! `codex-windows-sandbox-service.exe` objdump 反汇编，定位到**全二进制唯一**
//! `call [FwpmFilterAdd0]` 调用点 `0x1413b30df`，读出 `FWPM_FILTER0` 字段值：
//!
//! ```text
//! FwpmFilterAdd0(engine, &filter, NULL /*sd*/, &id)   ; 四参，security descriptor = NULL
//! filter.action.type = 0x1001 = FWP_ACTION_PERMIT     ; 对侧这条 filter 是「放行」语义
//! filter.weight.type = 0                              ; 不设静态权重，交引擎自动定权
//! filter.flags       = 1
//! 条件数组：运行时堆分配，每个 FWPM_FILTER_CONDITION0 = 40 字节
//! 三个常量 GUID 模板（.rdata 实测字节，LE 解码）：
//!   af043a0a-b34d-4f86-979c-c90371af6e66
//!   3971ef2b-623e-4f9a-8cb1-6e79b806b9a7
//!   c35a604d-d22b-4e1a-91b4-68f674ee674b
//! ```
//!
//! ⇒ **对侧用 PERMIT filter 表达白名单**（允许特定 layer/sublayer 命中的流量，
//! 其余靠引擎默认拒绝），这是 WFP 白名单惯用法。
//!
//! ## 仍未宣称可用（§0.9）
//!
//! 字段值补齐 ≠ 行为验证过。端到端验证需**管理员会话 + 真实网卡**，且失败路径
//! （驱动拒绝、与现有规则冲突、provider 已存在）无法在无人值守环境复现。
//! 因此 [`InstallOutcome::is_effective`] 仍恒为 `false`，`reason` 从
//! 「字段未取证」更新为「**字段已取证、行为未端到端验证**」——更精确，同样不冒充实效。
//!
//! ## 本模块可被静态验证的三样
//!
//! - [`fwp_action_type`]：`Decision` → `FWP_ACTION_*` 常量的确定性映射（对侧只取证到
//!   PERMIT，本 crate 补齐双向 BLOCK/PERMIT，**这是对侧没做的**）
//! - [`ProviderIdentity`]：GUID 形状校验（防止每次运行换 GUID 导致残留规则无法清理）
//! - [`InstallOutcome`]：安装结果的显式状态机，**含 Aborted 与 NotSupported**
//! - [`install_plan`]：签名与错误面完整的入口，当前在非 Windows 返回 `NotSupported`，
//!   在 Windows 上返回 `Unverified`
//!
//! 接线方拿到 `Unverified` 必须自行完成真机验证后才能宣称生效。

use crate::policy::{Decision, InstallPlan};

/// WFP provider 身份。用稳定 GUID，**不得每次运行重新生成**——
/// 否则进程崩溃后残留的 filter 无法按 key 精确清理。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderIdentity {
    /// provider GUID 的规范字符串形态（小写带花括号）。
    pub guid: String,
    /// 人读名（写入 provider 描述，便于按版本排查）。
    pub display_name: String,
}

impl ProviderIdentity {
    /// 校验并构造。GUID 必须是 `{8-4-4-4-12}` 小写十六进制形态。
    pub fn new(guid: &str, display_name: &str) -> Result<Self, InstallError> {
        let normalized = guid.trim().to_ascii_lowercase();
        if !is_canonical_guid(&normalized) {
            return Err(InstallError::InvalidProviderGuid { got: guid.to_string() });
        }
        if display_name.trim().is_empty() {
            return Err(InstallError::EmptyDisplayName);
        }
        Ok(Self {
            guid: normalized,
            display_name: display_name.to_string(),
        })
    }
}

fn is_canonical_guid(s: &str) -> bool {
    let inner = match s.strip_prefix('{').and_then(|x| x.strip_suffix('}')) {
        Some(v) => v,
        None => return false,
    };
    let groups: Vec<&str> = inner.split('-').collect();
    let want = [8usize, 4, 4, 4, 12];
    if groups.len() != want.len() {
        return false;
    }
    for (g, expected_len) in groups.iter().zip(want.iter()) {
        if g.len() != *expected_len {
            return false;
        }
        if !g.bytes().all(|b| b.is_ascii_hexdigit()) {
            return false;
        }
    }
    true
}

/// 安装错误。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InstallError {
    /// provider GUID 不是规范形态。
    InvalidProviderGuid {
        /// 传入值。
        got: String,
    },
    /// provider 显示名为空。
    EmptyDisplayName,
    /// 平台不支持 WFP（非 Windows）。
    PlatformNotSupported {
        /// 当前目标平台。
        target_os: &'static str,
    },
    /// 需要管理员权限但当前不是。
    RequiresAdministrator,
    /// 引擎会话打开失败（携带 Win32 错误码）。
    EngineOpenFailed {
        /// Win32 错误码。
        code: u32,
    },
}

impl std::fmt::Display for InstallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InstallError::InvalidProviderGuid { got } => {
                write!(f, "provider GUID 不是规范形态 {{8-4-4-4-12}}（得到 {got:?}）")
            }
            InstallError::EmptyDisplayName => write!(f, "provider 显示名不能为空"),
            InstallError::PlatformNotSupported { target_os } => {
                write!(f, "WFP 仅 Windows 支持（当前 target_os={target_os}）")
            }
            InstallError::RequiresAdministrator => write!(f, "安装 WFP filter 需要管理员权限"),
            InstallError::EngineOpenFailed { code } => {
                write!(f, "FwpmEngineOpen0 失败（Win32 错误码 {code}）")
            }
        }
    }
}

impl std::error::Error for InstallError {}

/// 安装结果状态机。
///
/// **`Unverified` 是本模块的核心表达**：它明确区分「代码跑过了」与
/// 「验证过真的生效」。当前实现只能到前者。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InstallOutcome {
    /// 计划为空，无需安装（正常情形，不是错误）。
    NothingToInstall,
    /// 平台不支持（非 Windows）。
    NotSupported {
        /// 当前目标平台。
        target_os: &'static str,
    },
    /// 代码路径已执行但**未做端到端验证**，不得宣称生效。
    Unverified {
        /// 计划摘要（便于与后续真机验证结果对账）。
        plan_digest: u64,
        /// 为何未验证的可读说明。
        reason: String,
    },
    /// 安装被事务回滚（任一 filter 失败）。
    Aborted {
        /// 计划摘要。
        plan_digest: u64,
        /// 回滚原因。
        reason: String,
    },
}

impl InstallOutcome {
    /// 是否可宣称「策略已生效」。**只有真正验证过才能返回 true**，
    /// 当前实现恒为 false —— 这是刻意的：不让未验证的路径冒充实效。
    pub fn is_effective(&self) -> bool {
        false
    }

    /// 人读说明（供日志）。
    pub fn describe(&self) -> String {
        match self {
            InstallOutcome::NothingToInstall => "无规则需要安装".to_string(),
            InstallOutcome::NotSupported { target_os } => {
                format!("平台不支持 WFP（target_os={target_os}）")
            }
            InstallOutcome::Unverified {
                plan_digest,
                reason,
            } => format!("未验证（plan_digest={plan_digest:016x}）：{reason}"),
            InstallOutcome::Aborted {
                plan_digest,
                reason,
            } => format!("已回滚（plan_digest={plan_digest:016x}）：{reason}"),
        }
    }
}

/// `Decision` → WFP `FWP_ACTION_*` 常量的确定性映射。
///
/// # 取证依据（对侧值 + SDK 枚举）
///
/// 对侧 `FWPM_FILTER0.action.type = 0x1001` 实测 = `FWP_ACTION_PERMIT`（见模块文档）。
/// SDK `fwpmtypes.h`：`FWP_ACTION_BLOCK = 0x1000`，`FWP_ACTION_PERMIT = 0x1001`。
///
/// 对侧只取证到**单条 PERMIT filter**（白名单放行），本 crate 补齐**双向**映射：
///
/// | [`Decision`] | `fwp_action_type` | 语义 |
/// |---|---|---|
/// | [`Decision::Allow`] | `FWP_ACTION_PERMIT` (0x1001) | 放行 |
/// | [`Decision::Prompt`] | `FWP_ACTION_BLOCK` (0x1000) | 先阻断再问（见 `Decision::blocks_traffic`） |
/// | [`Decision::PromptUser`] | `FWP_ACTION_BLOCK` (0x1000) | 必须本人确认，同样先阻断 |
/// | [`Decision::Forbidden`] | `FWP_ACTION_BLOCK` (0x1000) | 拒绝 |
///
/// 这是**对侧没做的**：对侧二进制里只有 PERMIT（白名单惯用法，靠引擎默认拒绝），
/// 本 crate 把四值 decision 显式落到两条 WFP action 常量上，语义更明确。
///
/// 返回的 `u32` 是 `FWP_ACTION_*` 的原始值，可直接写入
/// `FWPM_FILTER0.action.type`（接线方在合并窗口接 FFI 时使用）。
pub fn fwp_action_type(d: Decision) -> u32 {
    // FWP_ACTION_PERMIT = 0x1001, FWP_ACTION_BLOCK = 0x1000
    if d.blocks_traffic() {
        0x1000 // FWP_ACTION_BLOCK
    } else {
        0x1001 // FWP_ACTION_PERMIT
    }
}

/// ALE（Application Layer Enforcement）层 GUID —— 对侧 `FWPM_FILTER0.layerKey`
/// 实测透传落到的**字面 GUID 池**。
///
/// # 取证依据（2026-11-15，round 11）
///
/// Ghidra 追 `FWPM_FILTER0.layerKey` 的数据来源链（`wfp-layerkey-guid-transparency.md`）：
/// 静态反汇编追到**第 5 层**才落到 `.rdata` 字面 GUID 池，定性为「编译期常量数组按
/// index 寻址、运行时按规则特征选择」。追不动的是「运行时如何选 index」（需动态取证），
/// 但**字面值本身确定**，与 SDK `fwpmu.h` 的 ALE layer 名逐一匹配：
///
/// | 字面 GUID | SDK 名 | 语义 |
/// |---|---|---|
/// | `fd45dd17-17f0-4454-a8f5-1a335f9b1d5c` | `FWPM_LAYER_ALE_AUTH_CONNECT_V4` | IPv4 建连授权 |
/// | `105e6e93-8a97-4a64-b4e5-09f5ff7a0115` | `FWPM_LAYER_ALE_AUTH_CONNECT_V6` | IPv6 建连授权 |
/// | `4b2b7a2c-2ee6-4916-91b4-8f223a5c0ba9` | `FWPM_LAYER_ALE_FLOW_ESTABLISHED_V4` | IPv4 流建立 |
/// | `09e40e90-8f1c-4834-a375-9b7a3d5a4d0e` | `FWPM_LAYER_ALE_FLOW_ESTABLISHED_V6` | IPv6 流建立 |
///
/// # 本 crate 的超越点
///
/// 对侧这些 GUID 是散落的透传字面值（编译期常量数组）；本 crate 把它们结构化为
/// **带语义的具名常量 + `ALL` 有序表 + 形状校验**，让接线方将来选 layer 时有
/// 确定依据（按 V4/V6 × AUTH_CONNECT/FLOW_ESTABLISHED 两个轴查表），
/// 而不是复刻对侧的 index 寻址黑箱。**不宣称**已复刻对侧的运行时选择逻辑——
/// 那部分仍未取证。
pub mod ale_layer {
    /// IPv4 建连授权层（`FWPM_LAYER_ALE_AUTH_CONNECT_V4`）。
    pub const AUTH_CONNECT_V4: &str = "{fd45dd17-17f0-4454-a8f5-1a335f9b1d5c}";
    /// IPv6 建连授权层（`FWPM_LAYER_ALE_AUTH_CONNECT_V6`）。
    pub const AUTH_CONNECT_V6: &str = "{105e6e93-8a97-4a64-b4e5-09f5ff7a0115}";
    /// IPv4 流建立层（`FWPM_LAYER_ALE_FLOW_ESTABLISHED_V4`）。
    pub const FLOW_ESTABLISHED_V4: &str = "{4b2b7a2c-2ee6-4916-91b4-8f223a5c0ba9}";
    /// IPv6 流建立层（`FWPM_LAYER_ALE_FLOW_ESTABLISHED_V6`）。
    pub const FLOW_ESTABLISHED_V6: &str = "{09e40e90-8f1c-4834-a375-9b7a3d5a4d0e}";

    /// 一条具名 ALE 层：SDK 名 + 字面 GUID。
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct NamedLayer {
        /// SDK `fwpmu.h` 里的层名（人读 + 便于与 SDK 头核对）。
        pub sdk_name: &'static str,
        /// 规范形态（带花括号、小写）的字面 GUID。
        pub guid: &'static str,
    }

    /// 全部已取证 ALE 层，按 **V4/V6 × AUTH_CONNECT/FLOW_ESTABLISHED** 有序排列。
    ///
    /// 顺序刻意稳定：同输入同顺序，便于安装层按固定次序下发 filter，
    /// 也便于与取证报告逐条对账。
    pub const ALL: &[NamedLayer] = &[
        NamedLayer { sdk_name: "FWPM_LAYER_ALE_AUTH_CONNECT_V4", guid: AUTH_CONNECT_V4 },
        NamedLayer { sdk_name: "FWPM_LAYER_ALE_AUTH_CONNECT_V6", guid: AUTH_CONNECT_V6 },
        NamedLayer { sdk_name: "FWPM_LAYER_ALE_FLOW_ESTABLISHED_V4", guid: FLOW_ESTABLISHED_V4 },
        NamedLayer { sdk_name: "FWPM_LAYER_ALE_FLOW_ESTABLISHED_V6", guid: FLOW_ESTABLISHED_V6 },
    ];
}

/// 对侧实测的 provider / sublayer 对象标识（**仅参考，安装时不冒用**）。
///
/// # 取证依据（2026-11-15，round 12）
///
/// objdump 全量反汇编定位 `FwpmProviderAdd0`（唯一调用点 `0x1413b2a1d`）与
/// `FwpmSubLayerAdd0`（唯一调用点 `0x1413b2bcd`），读栈上 `FWPM_PROVIDER0` /
/// `FWPM_SUBLAYER0` 字段，`.rdata` 抠出字面 GUID 与人读名（见
/// `evidence/wfp-provider-sublayer-fields.md`）：
///
/// | 对象 | 字面 GUID | 人读名 | flags |
/// |---|---|---|---|
/// | provider | `{2e31d31c-3948-4753-9117-e5d1a6496f41}` | `Persistent WFP provider for Codex Windows sandbox filters` | `1` (PERSISTENT) |
/// | sublayer | `{e65054fd-4d32-4c7c-95ef-621f0cf6431a}` | `Persistent WFP sublayer for Codex Windows sandbox filter` | `1` (PERSISTENT) |
///
/// 两者 `sd` 均为 `NULL`，安装顺序 = **Begin → Provider → SubLayer → Filter → Commit**
/// （失败 Abort）。
///
/// # 为什么只参考、不冒用
///
/// 对侧用 `flags = FWPM_PROVIDER_FLAG_PERSISTENT`，对象**跨重启存活**，按 key 清理。
/// 若本 crate 直接抄这两个 GUID，会与对侧已装的持久化 provider/sublayer **撞 key**：
/// 轻则 `FwpmProviderAdd0` 返回 `FWP_E_ALREADY_EXISTS`，重则本 crate 的清理逻辑
/// 误删对侧规则（或反之）。因此本模块只把对侧值钉成**具名参考常量**，供取证对账与
/// 兼容性判断；本 crate 真正安装时仍用调用方传入的 [`ProviderIdentity`]（自分配 GUID）。
pub mod provider_object {
    /// 对侧 provider 的字面 GUID（`Persistent WFP provider for Codex Windows sandbox filters`）。
    pub const CODEX_PROVIDER_GUID: &str = "{2e31d31c-3948-4753-9117-e5d1a6496f41}";
    /// 对侧 provider 人读名。
    pub const CODEX_PROVIDER_NAME: &str =
        "Persistent WFP provider for Codex Windows sandbox filters";
    /// 对侧 sublayer 的字面 GUID（`Persistent WFP sublayer for Codex Windows sandbox filter`）。
    pub const CODEX_SUBLAYER_GUID: &str = "{e65054fd-4d32-4c7c-95ef-621f0cf6431a}";
    /// 对侧 sublayer 人读名。
    pub const CODEX_SUBLAYER_NAME: &str =
        "Persistent WFP sublayer for Codex Windows sandbox filter";

    /// 对侧 provider / sublayer 共同的 `flags` 值：`FWPM_PROVIDER_FLAG_PERSISTENT`（= 1）。
    ///
    /// ⇒ 对象跨重启存活，必须按 key 精确清理。这是本 crate
    /// [`super::ProviderIdentity`] 强制「不得每次运行换 GUID」的直接依据。
    pub const FWPM_FLAG_PERSISTENT: u32 = 1;
}

/// 安装入口。
///
/// 当前实现：
/// - 计划为空 ⇒ [`InstallOutcome::NothingToInstall`]
/// - 非 Windows ⇒ [`InstallOutcome::NotSupported`]
/// - Windows ⇒ [`InstallOutcome::Unverified`]（**不假装成功**）
///
/// 真正的 `FwpmFilterAdd0` FFI 调用留在后续票：**字段值已取证**（见模块文档），
/// 但端到端行为未验证，按 §0.9 不宣称生效。接线方应：
///
/// 0. 按对侧实测顺序开装（Begin → **ProviderAdd0 → SubLayerAdd0** → FilterAdd0 → Commit，
///    任一步失败 Abort，见 `provider_object` 模块文档与
///    `evidence/wfp-provider-sublayer-fields.md`）：
///    - Provider / SubLayer 均 `flags = FWPM_FLAG_PERSISTENT (1)`、`sd = NULL`
///    - **不要**用 [`provider_object`] 里的对侧 GUID：会与对侧持久化对象撞 key
///      （`FWP_E_ALREADY_EXISTS` 或误清对方规则）；用调用方传入的 [`ProviderIdentity`] 自分配
/// 1. 用 [`fwp_action_type`] 填 `FWPM_FILTER0.action.type`
/// 2. `weight.type = 0`（对侧实测：不设静态权重）
/// 3. 条件数组运行时堆分配（对侧 40 字节/条，`FWPM_FILTER_CONDITION0` 原生大小）
/// 4. `security descriptor` 传 `null`（对侧实测 sd = NULL）
pub fn install_plan(
    plan: &InstallPlan,
    provider: &ProviderIdentity,
) -> Result<InstallOutcome, InstallError> {
    if plan.specs.is_empty() {
        return Ok(InstallOutcome::NothingToInstall);
    }
    if provider.guid.is_empty() {
        return Err(InstallError::InvalidProviderGuid { got: String::new() });
    }

    #[cfg(windows)]
    {
        // 这里将来接 FwpmEngineOpen0 / TransactionBegin0 / ProviderAdd0 /
        // SubLayerAdd0 / FilterAdd0 / Commit0（失败则 Abort0）。
        // 当前**故意不接**：缺 FWPM_FILTER0 字段取证，硬猜结构体比不做更危险。
        Ok(InstallOutcome::Unverified {
            plan_digest: plan.plan_digest,
            reason: "FWPM_FILTER0 字段值已取证（action.type=PERMIT、weight.type=0、sd=NULL、\
                     条件 40B/条），但端到端行为未在真机（管理员+真实网卡）验证；\
                     按 §0.9 不宣称生效"
                .to_string(),
        })
    }

    #[cfg(not(windows))]
    {
        Ok(InstallOutcome::NotSupported {
            target_os: std::env::consts::OS,
        })
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
