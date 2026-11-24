// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 令牌降权与 DACL 装配的**判据层**（对照 WorkBuddy `tsbx_sdk.dll` 的 `LsSDK_*`，取证 P3-03）。
//!
//! ## 这一层判什么
//!
//! 对照方把沙箱执法拆成三层：受限令牌降权 → 自定义 DACL → Job 兜底。本仓第三层（Job）
//! 早已在 [`crate::orphan_guard`] / [`crate::sandbox_sdk`] 落地，**前两层一直是空白** ——
//! 取证复评时 `Grep "CreateRestrictedToken|InitializeSecurityDescriptor|
//! SetSecurityDescriptorDacl|SetEntriesInAcl|CreateProcessAsUser|AdjustTokenPrivileges"`
//! 在 `src/` 下 0 命中。
//!
//! ## 为什么只做判据、不接真实 Win32 构造
//!
//! 按取证文档给的最小复现范围：「令牌降权与 DACL 本轮只留 trait 桩，不接真实受限令牌」。
//! 所以这里是**纯判定函数 + 可注入 trait**，生产实现留二期。这样切的实际好处：判据能在
//! 任何平台跑单测，不必依赖 MSVC、也不必真的降权一次才能验证。
//!
//! ## 三处刻意不照抄对照方（取证文档点名的弱点）
//!
//! ① **恒真桩必须被判成未判定**。对照方 `LsSDK_IsSupported(void)` 的函数体就是 `return 1`，
//!    探测零信息量。本层 [`normalize_probe`] 见到 [`RawVerdict::ConstantTrue`] 一律落
//!    [`TokenDaclProbe::Unjudged`]，**绝不**转成 `Available` —— "读不出就不许当可用"。
//! ② 未初始化时的**创建入口从类型上就不可达**。对照方返回码 3 表示未初始化，但调用方
//!    不一定检查；本层把生命周期提到类型上，[`Lifecycle::Uninitialized`] 拿不到创建函数。
//! ③ 配置结构尺寸不足时**先校验再读**，且「读不到」单列一档，不混进「参数无效」。对照方
//!    在尺寸不足时仍按偏移取字段，读出来的是什么取决于调用方留了什么。

/// 沙箱生命周期态。
///
/// 对照方用全局初始化标志（0 / 非 0）表达，本层提到类型上：拿到
/// [`Lifecycle::Uninitialized`] 就**没有**创建入口，从而构造性排除「未初始化仍建沙箱」。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Lifecycle {
    Uninitialized,
    Initialized,
}

/// 建沙箱的结局。
///
/// 返回码族语义对齐对照方观察值（1 = 参数/结构无效，3 = 未初始化），但**不把它们当作唯一
/// 判据**：本仓另立「尺寸不足」一档，避免与「参数无效」混同。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CreateOutcome {
    /// 建成。
    Created,
    /// 参数或上下文为空（对照方返回码 1 的一种）。
    InvalidArgument,
    /// 未初始化（对照方返回码 3）。正常路径由 [`Lifecycle`] 前置排除，保留此档只为对齐回执。
    NotInitialized,
    /// 配置结构尺寸不足，必需字段根本读不到。
    ConfigTooSmall {
        got: usize,
        need: usize,
    },
}

impl CreateOutcome {
    /// 对外码：成功无码，其余给稳定串。
    pub fn code(self) -> &'static str {
        match self {
            CreateOutcome::Created => "created",
            CreateOutcome::InvalidArgument => "invalid_argument",
            CreateOutcome::NotInitialized => "not_initialized",
            CreateOutcome::ConfigTooSmall { .. } => "config_too_small",
        }
    }

    /// 是否可继续（只有建成才算）。
    pub fn is_created(self) -> bool {
        matches!(self, CreateOutcome::Created)
    }
}

/// 配置结构的最小可读字节数。
///
/// 取证观察值：对照方配置结构首字段（尺寸）**小于 `0x38` 直接返回 1**。
pub const CONFIG_MIN_BYTES: usize = 0x38;

/// 含宽字符串字段的档位。
///
/// 取证观察值：对照方**只有尺寸 `>= 0x80` 才读取其中的宽字符串字段**。
pub const CONFIG_WIDE_FIELD_BYTES: usize = 0x80;

/// 配置结构的可读档位。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum ConfigTier {
    /// `CONFIG_MIN_BYTES..CONFIG_WIDE_FIELD_BYTES`：够读基础字段，读不到宽字符串。
    Narrow,
    /// `>= CONFIG_WIDE_FIELD_BYTES`：宽字符串字段可读。
    Wide,
}

impl ConfigTier {
    pub fn code(self) -> &'static str {
        match self {
            ConfigTier::Narrow => "config_narrow",
            ConfigTier::Wide => "config_wide",
        }
    }

    /// 该档是否包含宽字符串字段。
    pub fn has_wide_field(self) -> bool {
        matches!(self, ConfigTier::Wide)
    }
}

/// 按尺寸校验配置结构够不够读。
///
/// **先校验再读**是对照方那处的正解：不够读就直接拒，绝不按偏移硬取。
pub fn check_config_size(bytes: usize) -> Result<ConfigTier, CreateOutcome> {
    if bytes < CONFIG_MIN_BYTES {
        return Err(CreateOutcome::ConfigTooSmall {
            got: bytes,
            need: CONFIG_MIN_BYTES,
        });
    }
    Ok(if bytes >= CONFIG_WIDE_FIELD_BYTES {
        ConfigTier::Wide
    } else {
        ConfigTier::Narrow
    })
}

/// 原生探测返回的**原始**判定形态。
///
/// 分出 [`RawVerdict::ConstantTrue`] 这一支是本层的重点：它专门用来表达「探测实现是个恒真桩」，
/// 而不是「探测说可用」。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RawVerdict {
    /// 探测实现恒真（如对照方 `IsSupported` 直接 `return 1`）。**零信息量**。
    ConstantTrue,
    /// 探测给的是明确两态之一。
    TwoState { available: bool },
    /// 探测本身失败，带原因。
    Failed(ProbeFailure),
}

/// 探测失败的原因（≠ 不支持）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ProbeFailure {
    /// 原生接口没加载。
    NotLoaded,
    /// 调用超时。
    Timeout,
    /// IO / 权限挡住。
    IoOrPermission,
    /// 非本平台，本层没有后端。
    BackendAbsent,
}

impl ProbeFailure {
    pub fn code(self) -> &'static str {
        match self {
            ProbeFailure::NotLoaded => "probe_not_loaded",
            ProbeFailure::Timeout => "probe_timeout",
            ProbeFailure::IoOrPermission => "probe_io_or_permission",
            ProbeFailure::BackendAbsent => "probe_backend_absent",
        }
    }
}

/// 令牌 / DACL 能力探测的三态结果。
///
/// 与 [`crate::sandbox_sdk::ProbeState`] 同为「可用 / 不可用 / 未判定」骨架，但**值域不同**
/// （那是文件/签名/架构原因码，这里是令牌与 DACL 面），强行共用一个枚举只会逼出空变体，
/// 故不合并。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TokenDaclProbe {
    /// 探测真跑过且给了可用结论。
    Available,
    /// 探测真跑过，明确不可用。
    Unavailable,
    /// 探测没跑成，或跑成了但没有信息量。**处置与 Unavailable 相同（拒）**。
    Unjudged(UnjudgedCause),
}

/// 未判定成因。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UnjudgedCause {
    /// 探测实现是恒真桩 —— 读不出任何东西。
    ConstantStub,
    /// 探测失败，附原始原因。
    Failed(ProbeFailure),
}

impl UnjudgedCause {
    pub fn code(self) -> &'static str {
        match self {
            UnjudgedCause::ConstantStub => "unjudged_constant_stub",
            UnjudgedCause::Failed(f) => f.code(),
        }
    }
}

impl TokenDaclProbe {
    pub fn code(self) -> &'static str {
        match self {
            TokenDaclProbe::Available => "available",
            TokenDaclProbe::Unavailable => "unavailable",
            TokenDaclProbe::Unjudged(c) => c.code(),
        }
    }

    /// 是否允许据此放行降权通道。**只有 `Available` 可以。**
    pub fn permits_enforcement(self) -> bool {
        matches!(self, TokenDaclProbe::Available)
    }
}

/// 把原生原始判定归一成三态。
///
/// 这一条就是本层与对照方的分水岭：恒真桩**永远**归到未判定，不给它变成 `Available` 的路。
pub fn normalize_probe(raw: RawVerdict) -> TokenDaclProbe {
    match raw {
        RawVerdict::ConstantTrue => TokenDaclProbe::Unjudged(UnjudgedCause::ConstantStub),
        RawVerdict::TwoState { available: true } => TokenDaclProbe::Available,
        RawVerdict::TwoState { available: false } => TokenDaclProbe::Unavailable,
        RawVerdict::Failed(f) => TokenDaclProbe::Unjudged(UnjudgedCause::Failed(f)),
    }
}

/// 令牌降权方案（**桩**，二期接真实 `CreateRestrictedToken`）。
///
/// 桩的价值不在"能真降权"，而在于把"要剔哪些权限、失败时怎么办"先钉成判据，等实现层
/// 接进来时不必再改语义。
pub trait RestrictedTokenPlan {
    /// 产出方案；失败必须给原因，不许返回"勉强可用"。
    fn plan(&self, probe: TokenDaclProbe) -> Result<TokenPlan, PlanRefusal>;
}

/// 一份降权方案（只描述，不含句柄）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TokenPlan {
    /// 要剔除的权限名（如 `SeDebugPrivilege`）。空表示不剔 —— 但**不表示**已降权。
    pub drop_privileges: Vec<&'static str>,
    /// 是否要求新令牌为受限令牌。
    pub restricted: bool,
}

impl TokenPlan {
    /// 空方案：什么都不要求。仅用于"探测未判定时拒绝之前"的占位，**不可当作降权成功**。
    pub fn empty() -> Self {
        Self {
            drop_privileges: Vec::new(),
            restricted: false,
        }
    }

    /// 是否真提了要求（空方案返回 false）。
    pub fn is_effective(&self) -> bool {
        self.restricted || !self.drop_privileges.is_empty()
    }
}

/// 方案被拒的原因。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PlanRefusal {
    /// 探测未判定（恒真桩 / 失败），**不许**据此降权。
    ProbeUnjudged,
    /// 探测明确不可用。
    ProbeUnavailable,
}

impl PlanRefusal {
    pub fn code(self) -> &'static str {
        match self {
            PlanRefusal::ProbeUnjudged => "refused_probe_unjudged",
            PlanRefusal::ProbeUnavailable => "refused_probe_unavailable",
        }
    }
}

/// 把探测三态折成「可否据此降权」，拒绝时给出可展示的原因。
pub fn gate_enforcement(probe: TokenDaclProbe) -> Result<(), PlanRefusal> {
    match probe {
        TokenDaclProbe::Available => Ok(()),
        TokenDaclProbe::Unavailable => Err(PlanRefusal::ProbeUnavailable),
        TokenDaclProbe::Unjudged(_) => Err(PlanRefusal::ProbeUnjudged),
    }
}

/// **未初始化就无法创建**：把生命周期做成前置条件，返回拒绝原因。
///
/// 这不是"多一道 check"，而是把对照方的返回码 3 提前到构造期 —— 类型拿不到创建入口，
/// 比"跑起来再返回一个码"更难漏看。
pub fn require_initialized(lifecycle: Lifecycle) -> Result<(), CreateOutcome> {
    match lifecycle {
        Lifecycle::Initialized => Ok(()),
        Lifecycle::Uninitialized => Err(CreateOutcome::NotInitialized),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 尺寸不足单列一档且不混进参数无效() {
        // 0x37 差一字节 ⇒ 必须是 ConfigTooSmall，而不是 InvalidArgument。
        assert_eq!(
            check_config_size(0x37),
            Err(CreateOutcome::ConfigTooSmall {
                got: 0x37,
                need: CONFIG_MIN_BYTES
            })
        );
        assert_eq!(check_config_size(0x37).unwrap_err().code(), "config_too_small");
        assert_ne!(check_config_size(0x37).unwrap_err().code(), "invalid_argument");
    }

    #[test]
    fn 尺寸阈值逐字对齐取证观察值() {
        assert_eq!(CONFIG_MIN_BYTES, 56);
        assert_eq!(CONFIG_WIDE_FIELD_BYTES, 128);
        // 边界:0x38 恰好够读基础字段,但读不到宽字符串。
        assert_eq!(check_config_size(0x38), Ok(ConfigTier::Narrow));
        assert!(!check_config_size(0x38).unwrap().has_wide_field());
        // 0x7f 仍窄;0x80 才宽。
        assert_eq!(check_config_size(0x7f), Ok(ConfigTier::Narrow));
        assert_eq!(check_config_size(0x80), Ok(ConfigTier::Wide));
        assert!(check_config_size(0x80).unwrap().has_wide_field());
    }

    #[test]
    fn 恒真桩绝不折算成可用() {
        // 对照方 IsSupported 就是 return 1。这里必须落未判定。
        let p = normalize_probe(RawVerdict::ConstantTrue);
        assert_eq!(p, TokenDaclProbe::Unjudged(UnjudgedCause::ConstantStub));
        assert!(!p.permits_enforcement());
        assert_eq!(p.code(), "unjudged_constant_stub");
        // 而明确的可用才可用:
        assert!(normalize_probe(RawVerdict::TwoState { available: true }).permits_enforcement());
    }

    #[test]
    fn 未判定与不可用处置相同但原因可区分() {
        let unjudged = normalize_probe(RawVerdict::ConstantTrue);
        let unavailable = normalize_probe(RawVerdict::TwoState { available: false });
        // 两者都不许放行:
        assert!(!unjudged.permits_enforcement());
        assert!(!unavailable.permits_enforcement());
        // 但拒绝原因必须不同,否则排障时会被误导去查"能力不支持"。
        assert_eq!(gate_enforcement(unjudged).unwrap_err().code(), "refused_probe_unjudged");
        assert_eq!(gate_enforcement(unavailable).unwrap_err().code(), "refused_probe_unavailable");
    }

    #[test]
    fn 探测失败带出原始原因不吞掉() {
        let p = normalize_probe(RawVerdict::Failed(ProbeFailure::Timeout));
        assert_eq!(p.code(), "probe_timeout");
        assert!(!p.permits_enforcement());
        assert_eq!(
            normalize_probe(RawVerdict::Failed(ProbeFailure::BackendAbsent)).code(),
            "probe_backend_absent"
        );
    }

    #[test]
    fn 未初始化拿不到创建入口() {
        assert_eq!(
            require_initialized(Lifecycle::Uninitialized),
            Err(CreateOutcome::NotInitialized)
        );
        assert_eq!(require_initialized(Lifecycle::Initialized), Ok(()));
        // 与对照方返回码 3 的语义对齐(但本仓是前置排除):
        assert_eq!(CreateOutcome::NotInitialized.code(), "not_initialized");
    }

    #[test]
    fn 空方案不算降权成功() {
        let plan = TokenPlan::empty();
        assert!(!plan.is_effective());
        // 非空方案才算提了要求:
        assert!(TokenPlan {
            drop_privileges: vec!["SeDebugPrivilege"],
            restricted: true
        }
        .is_effective());
    }

    #[test]
    fn 成功结局只有一种() {
        assert!(CreateOutcome::Created.is_created());
        for o in [
            CreateOutcome::InvalidArgument,
            CreateOutcome::NotInitialized,
            CreateOutcome::ConfigTooSmall { got: 1, need: 2 },
        ] {
            assert!(!o.is_created());
            assert!(!o.code().is_empty());
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
