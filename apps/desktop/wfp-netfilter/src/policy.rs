// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 策略编译层：把 `network_rule` 编译成可安装的 filter 规格。
//!
//! 这一层**没有 FFI、没有 unsafe、全平台可测**。它是本 crate 的交付重心：
//! 策略正确性（host 规范化、协议映射、决策映射、去重幂等、失败方向）
//! 全部在这里被钉住，不与"能不能提权"耦合。
//!
//! # 与对侧的对齐点
//!
//! | 对侧（Codex `network_rule`） | 本模块 |
//! |---|---|
//! | `protocol ∈ {http, https, socks5_tcp, socks5_udp}` | [`NetworkProtocol`] 恰四值 |
//! | `host` 必须具体主机、禁通配符 | [`normalize_host`] 五条校验 |
//! | `host` 不含 scheme 或 path | [`normalize_host`] 显式拒绝 |
//! | `[IPv6]` 方括号字面量 | [`normalize_host`] 剥括号后按 IP 校验 |
//! | `decision ∈ {allow, prompt, prompt_user, forbidden}` | [`Decision`] 四值 |
//!
//! # 本模块超越对侧的三处
//!
//! 1. **编译期可比较**：[`InstallPlan`] 带稳定 `plan_digest`，同输入同摘要，
//!    可用于"这次下发的策略与上次是否相同"的幂等判定，对侧未取证到该能力。
//! 2. **冲突显式化**：同一 host+protocol 出现两条不同 decision ⇒
//!    [`CompileError::ConflictingDecision`] 并点名两条规则，而不是后者静默覆盖前者。
//! 3. **失败方向恒定**：任何"认不出"都返回 `Err`，绝不回落成 allow
//!    （对应 AGENTS.md §0.10「失效方向必须是多要一次定向说明，绝不能是多放一次跳门」）。

use std::collections::BTreeMap;
use std::fmt;

/// 规则标识（供安装层与日志引用；不参与 WFP 语义）。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct RuleId(pub String);

impl fmt::Display for RuleId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// 网络协议 —— 与对侧 `network_rule` 的 protocol 值域**逐字对齐**（恰四值）。
///
/// 对侧原文（`codex-command-runner.exe` .rdata）：
/// `network_rule protocol must be one of http, https, socks5_tcp, socks5_udp (got ...)`
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum NetworkProtocol {
    /// 明文 HTTP。
    Http,
    /// TLS（含 HTTP over TLS 与其它 TLS 流量）。
    Https,
    /// SOCKS5 over TCP。
    Socks5Tcp,
    /// SOCKS5 over UDP。
    Socks5Udp,
}

impl NetworkProtocol {
    /// 对侧 wire 形态的字符串。
    pub fn as_str(self) -> &'static str {
        match self {
            NetworkProtocol::Http => "http",
            NetworkProtocol::Https => "https",
            NetworkProtocol::Socks5Tcp => "socks5_tcp",
            NetworkProtocol::Socks5Udp => "socks5_udp",
        }
    }

    /// 从 wire 形态解析。**认不出返回 `None`，不回落默认值。**
    pub fn parse(raw: &str) -> Option<Self> {
        // 对侧只接受这四个精确值；这里额外做 trim + ASCII 小写，属于宽松的
        // 输入归一（写在文档里，避免别人以为对侧也这么做）。
        match raw.trim().to_ascii_lowercase().as_str() {
            "http" => Some(NetworkProtocol::Http),
            "https" => Some(NetworkProtocol::Https),
            "socks5_tcp" | "socks5-tcp" => Some(NetworkProtocol::Socks5Tcp),
            "socks5_udp" | "socks5-udp" => Some(NetworkProtocol::Socks5Udp),
            _ => None,
        }
    }

    /// 该协议是否为 UDP 承载（决定 filter 的 IP protocol 条件）。
    pub fn is_udp(self) -> bool {
        matches!(self, NetworkProtocol::Socks5Udp)
    }
}

/// 决策 —— 与对侧四值对齐（含 `prompt_user`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Decision {
    /// 放行。
    Allow,
    /// 提示（系统可代答）。
    Prompt,
    /// 必须本人确认（对侧 `PromptUser`）。
    PromptUser,
    /// 拒绝（对侧 wire 为 `deny`）。
    Forbidden,
}

impl Decision {
    /// 对侧 wire 形态（`forbidden` 序列化为 `deny`，与既有
    /// `exec_policy_amendments._DECISION_MAPPING` 同源）。
    pub fn as_wire(self) -> &'static str {
        match self {
            Decision::Allow => "allow",
            Decision::Prompt => "prompt",
            Decision::PromptUser => "prompt_user",
            Decision::Forbidden => "deny",
        }
    }

    /// 解析。认不出返回 `None`。
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "allow" => Some(Decision::Allow),
            "prompt" => Some(Decision::Prompt),
            "prompt_user" | "promptuser" => Some(Decision::PromptUser),
            "forbidden" | "deny" => Some(Decision::Forbidden),
            _ => None,
        }
    }

    /// 是否在 WFP 层是「阻断」语义（`Prompt` / `PromptUser` 都需要先阻断再问）。
    pub fn blocks_traffic(self) -> bool {
        !matches!(self, Decision::Allow)
    }
}

/// 一条 `network_rule`（对侧 schema 的 Rust 侧镜像）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NetworkRule {
    /// 规则标识（仅用于留痕）。
    pub id: RuleId,
    /// 目标主机（必须是具体 host 或 IP 字面量，禁通配符）。
    pub host: String,
    /// 协议。
    pub protocol: NetworkProtocol,
    /// 决策。
    pub decision: Decision,
    /// 人读理由（对侧 `justification`，要求非空）。
    pub justification: String,
}

/// 编译错误。**每一种都点名具体规则与原因**，不汇成一个字符串。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompileError {
    /// host 为空。
    EmptyHost {
        /// 出错的规则。
        rule: RuleId,
    },
    /// host 含空白。
    HostContainsWhitespace {
        /// 出错的规则。
        rule: RuleId,
        /// 原始输入。
        raw: String,
    },
    /// host 含通配符（对侧明确禁止）。
    HostWildcardNotAllowed {
        /// 出错的规则。
        rule: RuleId,
        /// 原始输入。
        raw: String,
    },
    /// host 带 scheme 或 path。
    HostHasSchemeOrPath {
        /// 出错的规则。
        rule: RuleId,
        /// 原始输入。
        raw: String,
    },
    /// IPv6 方括号字面量非法。
    InvalidBracketedIpv6 {
        /// 出错的规则。
        rule: RuleId,
        /// 原始输入。
        raw: String,
    },
    /// host 既不是合法主机名也不是 IP 字面量。
    HostNotHostnameOrIp {
        /// 出错的规则。
        rule: RuleId,
        /// 原始输入。
        raw: String,
    },
    /// justification 为空（对侧同款约束）。
    EmptyJustification {
        /// 出错的规则。
        rule: RuleId,
    },
    /// 同一 host+protocol 出现两条不同决策。
    ConflictingDecision {
        /// host。
        host: String,
        /// 协议。
        protocol: NetworkProtocol,
        /// 前一条规则的决策。
        first: Decision,
        /// 后一条规则的决策。
        second: Decision,
    },
}

impl fmt::Display for CompileError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CompileError::EmptyHost { rule } => write!(f, "规则 {rule}: host 不能为空"),
            CompileError::HostContainsWhitespace { rule, raw } => {
                write!(f, "规则 {rule}: host 不能含空白（得到 {raw:?}）")
            }
            CompileError::HostWildcardNotAllowed { rule, raw } => write!(
                f,
                "规则 {rule}: host 必须是具体主机，不允许通配符（得到 {raw:?}）"
            ),
            CompileError::HostHasSchemeOrPath { rule, raw } => write!(
                f,
                "规则 {rule}: host 不能带 scheme 或 path（得到 {raw:?}）"
            ),
            CompileError::InvalidBracketedIpv6 { rule, raw } => {
                write!(f, "规则 {rule}: IPv6 方括号字面量非法（得到 {raw:?}）")
            }
            CompileError::HostNotHostnameOrIp { rule, raw } => {
                write!(f, "规则 {rule}: host 必须是主机名或 IP 字面量（得到 {raw:?}）")
            }
            CompileError::EmptyJustification { rule } => {
                write!(f, "规则 {rule}: justification 不能为空")
            }
            CompileError::ConflictingDecision {
                host,
                protocol,
                first,
                second,
            } => write!(
                f,
                "host={host} protocol={} 出现冲突决策：{} vs {}",
                protocol.as_str(),
                first.as_wire(),
                second.as_wire()
            ),
        }
    }
}

impl std::error::Error for CompileError {}

/// 规范化后的主机：要么是主机名，要么是 IP 字面量。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Host {
    /// 小写后的主机名（无尾点）。
    Name(String),
    /// 解析成功的 IP（v4 或 v6）。
    Ip(std::net::IpAddr),
}

impl Host {
    /// 用于 filter 条件与去重的稳定字符串。
    pub fn canonical(&self) -> String {
        match self {
            Host::Name(n) => n.clone(),
            Host::Ip(ip) => ip.to_string(),
        }
    }
}

/// 规范化 host —— 对侧五条校验的 Rust 侧实现。
///
/// 顺序刻意如此：先查空、再查空白、再查通配符、再查 scheme/path，
/// 每种失败给**不同的错误变体**（对侧也是五条独立文案），便于排障定位。
pub fn normalize_host(rule: &RuleId, raw: &str) -> Result<Host, CompileError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(CompileError::EmptyHost { rule: rule.clone() });
    }
    if trimmed.split_whitespace().count() > 1 {
        return Err(CompileError::HostContainsWhitespace {
            rule: rule.clone(),
            raw: raw.to_string(),
        });
    }
    // 通配符：对侧明令 "must be a specific host; wildcards are not allowed"
    if trimmed.contains('*') || trimmed.contains('?') {
        return Err(CompileError::HostWildcardNotAllowed {
            rule: rule.clone(),
            raw: raw.to_string(),
        });
    }
    // scheme 或 path：对侧明令 "without scheme or path"
    if trimmed.contains("://") || trimmed.contains('/') || trimmed.contains('\\') {
        return Err(CompileError::HostHasSchemeOrPath {
            rule: rule.clone(),
            raw: raw.to_string(),
        });
    }
    // 方括号 IPv6：[::1]
    if trimmed.starts_with('[') {
        let inner = trimmed
            .strip_prefix('[')
            .and_then(|s| s.strip_suffix(']'))
            .ok_or_else(|| CompileError::InvalidBracketedIpv6 {
                rule: rule.clone(),
                raw: raw.to_string(),
            })?;
        return inner
            .parse::<std::net::IpAddr>()
            .map(Host::Ip)
            .map_err(|_| CompileError::InvalidBracketedIpv6 {
                rule: rule.clone(),
                raw: raw.to_string(),
            });
    }
    // 裸 IP 字面量（v4 / v6）
    if let Ok(ip) = trimmed.parse::<std::net::IpAddr>() {
        return Ok(Host::Ip(ip));
    }
    // 主机名：ASCII 小写、去尾点，逐标签校验
    let lower = trimmed.to_ascii_lowercase();
    let no_dot = lower.strip_suffix('.').unwrap_or(&lower);
    if no_dot.is_empty() || !is_valid_hostname(no_dot) {
        return Err(CompileError::HostNotHostnameOrIp {
            rule: rule.clone(),
            raw: raw.to_string(),
        });
    }
    Ok(Host::Name(no_dot.to_string()))
}

fn is_valid_hostname(s: &str) -> bool {
    if s.len() > 253 {
        return false;
    }
    for label in s.split('.') {
        if label.is_empty() || label.len() > 63 {
            return false;
        }
        let bytes = label.as_bytes();
        // 首尾不得为连字符
        if bytes.first() == Some(&b'-') || bytes.last() == Some(&b'-') {
            return false;
        }
        if !bytes
            .iter()
            .all(|b| b.is_ascii_alphanumeric() || *b == b'-')
        {
            return false;
        }
    }
    true
}

/// 一条可安装的 filter 规格（**不含任何 FFI 结构体**，便于跨平台断言）。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct FilterSpec {
    /// 来自哪条规则。
    pub rule: RuleId,
    /// 目标主机（规范化后）。
    pub host: Host,
    /// 协议。
    pub protocol: NetworkProtocol,
    /// 决策。
    pub decision: Decision,
}

impl FilterSpec {
    /// 稳定去重键（host, protocol）。同一键不允许出现两条不同决策。
    pub fn key(&self) -> (String, NetworkProtocol) {
        (self.host.canonical(), self.protocol)
    }
}

/// 一次下发的完整计划。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallPlan {
    /// 已排序、已去重的 filter 规格。排序键为 (host, protocol)，保证同输入同顺序。
    pub specs: Vec<FilterSpec>,
    /// 计划摘要：对 specs 的稳定哈希。同输入必然同摘要。
    pub plan_digest: u64,
    /// 被跳过的重复规则（同 host+protocol 同决策），仅留痕用。
    pub deduped: Vec<RuleId>,
}

impl InstallPlan {
    /// 需要阻断的规格数（`Prompt` / `PromptUser` / `Forbidden` 都算）。
    pub fn blocking_count(&self) -> usize {
        self.specs.iter().filter(|s| s.decision.blocks_traffic()).count()
    }

    /// 需要放行的规格数。
    pub fn allowing_count(&self) -> usize {
        self.specs.len() - self.blocking_count()
    }
}

/// FNV-1a 64 —— 用纯 std 实现稳定摘要，避免为了一个哈希引入依赖。
fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        hash ^= u64::from(*b);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

/// 把一组 `network_rule` 编译成安装计划。
///
/// 语义（逐条对应测试）：
/// 1. 每条规则都过 [`normalize_host`] 与 justification 非空校验，**任一失败即整体失败**
///    （不做"跳过坏规则继续"的静默降级）。
/// 2. 同 (host, protocol) 同决策 ⇒ 去重，记入 `deduped`。
/// 3. 同 (host, protocol) 不同决策 ⇒ [`CompileError::ConflictingDecision`]。
/// 4. 输出按 (host, protocol) 排序，摘要基于排序后内容 ⇒ 输入顺序不影响摘要。
pub fn compile_rules(rules: &[NetworkRule]) -> Result<InstallPlan, CompileError> {
    let mut chosen: BTreeMap<(String, NetworkProtocol), FilterSpec> = BTreeMap::new();
    let mut deduped: Vec<RuleId> = Vec::new();

    for rule in rules {
        let host = normalize_host(&rule.id, &rule.host)?;
        if rule.justification.trim().is_empty() {
            return Err(CompileError::EmptyJustification {
                rule: rule.id.clone(),
            });
        }
        let spec = FilterSpec {
            rule: rule.id.clone(),
            host,
            protocol: rule.protocol,
            decision: rule.decision,
        };
        let key = spec.key();
        match chosen.get(&key) {
            None => {
                chosen.insert(key, spec);
            }
            Some(existing) if existing.decision == spec.decision => {
                deduped.push(rule.id.clone());
            }
            Some(existing) => {
                return Err(CompileError::ConflictingDecision {
                    host: key.0,
                    protocol: key.1,
                    first: existing.decision,
                    second: spec.decision,
                });
            }
        }
    }

    let specs: Vec<FilterSpec> = chosen.into_values().collect();

    // 摘要：逐条拼稳定形态，再用 FNV-1a。不含 RuleId（改名不该改语义摘要），
    // 但含 decision —— 决策变了必须换摘要，否则幂等判定会漏。
    let mut material = Vec::new();
    for spec in &specs {
        material.extend_from_slice(spec.host.canonical().as_bytes());
        material.push(b'\x1f');
        material.extend_from_slice(spec.protocol.as_str().as_bytes());
        material.push(b'\x1f');
        material.extend_from_slice(spec.decision.as_wire().as_bytes());
        material.push(b'\x1e');
    }

    Ok(InstallPlan {
        plan_digest: fnv1a64(&material),
        specs,
        deduped,
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
