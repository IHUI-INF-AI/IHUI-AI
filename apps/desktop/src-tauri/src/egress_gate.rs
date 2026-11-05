// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面端(Tauri / Rust 侧)出站网络出口门 —— 与 CLI 那把尺**同源**的接线腿(goal-b49 Z17)。
//!
//! 立因:前票 Z3(`.ihui-agent/tmp/rea-goal-b49/Z3-impl.md` §4 第 1 条)把 CLI 侧三条腿入库后
//! 点名「desktop 同源腿交主席另票」。现读 `apps/desktop/src-tauri/src/**` 的出站点
//! (`reqwest` 命中处:`auto_refresh.rs:249/441`、`checkin_web_login.rs:138/171`、
//! `checkin_trae_web_login.rs:171`、`checkin_capture.rs:3265`)在本模块之前**零出口判定**:
//! 主机名直接进 `Client::*`,拒与放都无声音(§0.9「判过没出声 = 没判」的反面:连判都没有)。
//!
//! 同源的**边界**(本模块只接能同源的格,不造第二把尺,§0.6):
//! - ✅ 接:机主经 env 声明的那份名单与档位。键名唯一源 = `apps/cli/src/sandbox/egress/policy.ts`
//!   的 `EGRESS_ENV`;本模块 `EGRESS_ENV_KEYS` 是**同一份声明的消费者**(两引擎读同一个 env),
//!   腐烂由 `apps/desktop/tests/egress-env-keys-parity.test.mjs` 机器对账(它 import 那份源文本,
//!   不复制判据,§22c)。装配语义(取值认不出 ⇒ 落更严一侧 + warning)同 `policy-source.ts`。
//! - ✅ 接:裁决判序与稳定 ASCII 原因码(同 `policy.ts` `judgeEgressTarget`:target-missing /
//!   policy-unavailable / rule-allow / rule-deny / default-allow / default-deny),以及
//!   「出声去重」出口(同 `env-inject.ts` `reportEgressWarnings`)。
//! - ❌ **刻意不接**:内置内网名段/域名族表(`packages/shared/src/utils/ssrf-guard.ts` 的
//!   `DENIED_HOST_NAMES` / `DENIED_HOST_SUFFIXES` 与 `ip-literal.ts` 的 `DENIED_CIDRS`)与
//!   `glob-pattern.ts` 的通用匹配器。一手证据:`packages/shared/package.json` 的 `exports` 把
//!   公开路径直接指向 `./src/*.ts`,而 `apps/cli` 无 `dist` 产物 ⇒ Rust 侧既不能 import、
//!   运行时也没有可读的机器可消费形态(打包后的二进制不持有仓库路径)。**把 8 条字面量与
//!   CIDR 表粘进 Rust 就是 §0.6 的第二把尺**,故本模块对这两层一律返回 `unjudged`
//!   (`builtin-table-unwired` / `ip-literal-unwired`)并在装载时点名一次(§0.3:取不到输入
//!   ⇒ 显式「未判定」,绝不冒 allow)。解锁前置见交付报告「未竟」:shared 侧产出 JSON 名单件
//!   (需动 `packages/**` + `scripts/**`,不在本票白名单)后本模块 `include_str!` 该件;
//!   或经 IPC 向 CLI/服务端取裁决。反向锁:parity 用例断言本文件**不得出现**那些字面量。
//! - ❌ 不接:DNS 地址证据腿与 TCP relay 腿(`dns-resolver-adapter.ts` / `proxy-relay.ts` 是
//!   Node 载体,桌面端无宿主),同样只点名不假执法。
//!
//! 失效方向:默认档位与 CLI 一致(**advisory**:出声 + 不拦),`IHUI_EGRESS_ENFORCE=1` 才让
//! env 声明的 deny 行真的拒绝出站点;`IHUI_EGRESS_DEFAULT` 取值认不出 ⇒ 落 `deny`(更严)。
//! 通配形态认不出(`*` 不在最左标签位)⇒ 该行按**更严**结算为 `unjudged`,绝不折成 allow。

use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

/// env 键名表 —— 与 `apps/cli/src/sandbox/egress/policy.ts` 的 `EGRESS_ENV` 逐名对齐
/// (对账尺:`apps/desktop/tests/egress-env-keys-parity.test.mjs`)。
pub const EGRESS_ENV_KEYS: [&str; 8] = [
    "IHUI_EGRESS_DEFAULT",
    "IHUI_EGRESS_DENY_DOMAINS",
    "IHUI_EGRESS_ALLOW_DOMAINS",
    "IHUI_EGRESS_ADDRESS_PROOF",
    "IHUI_EGRESS_ENFORCE",
    "IHUI_EGRESS_PROXY_URL",
    "IHUI_EGRESS_AUDIT_LOG",
    "IHUI_EGRESS_DNS_TTL",
];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Effect {
    Allow,
    Deny,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Enforcement {
    Enforce,
    Advisory,
}

#[derive(Clone, Debug)]
pub struct Rule {
    pub id: String,
    pub domain: String,
    pub effect: Effect,
    pub enforcement: Enforcement,
    pub why: String,
    /// false = 本模块无法安全表达该通配形态;命中不了时按更严一侧结算(不折 allow)。
    pub supported: bool,
}

#[derive(Clone, Debug)]
pub struct GatePolicy {
    pub rules: Vec<Rule>,
    pub default_deny: bool,
    pub enforcement: Enforcement,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Decision {
    Allow,
    Deny,
    Unjudged,
}

#[derive(Clone, Debug)]
pub struct Judgement {
    pub target: String,
    pub decision: Decision,
    pub layer: &'static str,
    pub reason: &'static str,
    pub hint: Option<String>,
    pub enforcement: Enforcement,
}

fn env_get(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.trim().is_empty())
}

/// 主机名归一(口径同 `policy.ts` `normalizeEgressHost`):小写、去端口(仅 host:port 数字尾段)、
/// 去 IPv6 方括号与 zone id、去尾点。留痕只存这一形态,不含 path/query/userinfo。
///
/// 与 CLI 的分工差(照实点名,不是放宽):CLI 由 `dns-adjudicator.ts` 先从命令行取词再喂裁决,
/// 本模块的调用点交进来的是**整条 URL**(`auto_refresh.rs` 的 health_url 等),故此处先剥
/// scheme 与 path/query/fragment/userinfo,只留权威段 —— 剥完之后两侧的归一尺逐字节同形。
pub fn normalize_target_host(raw: &str) -> String {
    let trimmed = raw.trim();
    let after_scheme = match trimmed.find("://") {
        Some(idx) => &trimmed[idx + 3..],
        None => trimmed,
    };
    let authority = after_scheme
        .split('/')
        .next()
        .or_else(|| after_scheme.split('?').next())
        .unwrap_or(after_scheme);
    let authority = authority.split('?').next().unwrap_or(authority);
    let authority = authority.split('#').next().unwrap_or(authority);
    let authority = match authority.rfind('@') {
        Some(idx) => &authority[idx + 1..],
        None => authority,
    };
    let lowered = authority.to_lowercase();
    let mut bare = lowered.as_str();
    if bare.starts_with('[') && bare.ends_with(']') {
        bare = &bare[1..bare.len() - 1];
    }
    if let Some(pos) = bare.find('%') {
        bare = &bare[..pos];
    }
    let colon = bare.rfind(':');
    let mut host = bare.to_string();
    if let Some(idx) = colon {
        if idx > 0 && bare.matches(':').count() == 1 {
            let tail = &bare[idx + 1..];
            if !tail.is_empty() && tail.chars().all(|c| c.is_ascii_digit()) && tail.len() <= 5 {
                host = bare[..idx].to_string();
            }
        }
    }
    while host.ends_with('.') {
        host.pop();
    }
    host
}

fn rev_labels(value: &str) -> Vec<&str> {
    value.split('.').rev().collect()
}

/// 通配语义(与 `policy.ts` + `glob-pattern.ts` 声明一致,逐条对齐):
/// - `*.example.com` 只吃**一层**(`api.example.com` 中,`deep.api.example.com` 不中);
/// - `**.example.com` 吃其下**任意深度但不含根层本身** —— 内置表正是为此把
///   `local` 与 `**.local` 写成**两行**(`builtin-rules.ts` 头注「根层单列族」);
/// - 裸域名只吃逐字相等。
/// 返回 `None` = 形态认不出(`*` 不在最左标签位)⇒ 调用方按更严一侧结算,不折 allow。
fn pattern_matches(pattern: &str, host: &str) -> Option<bool> {
    let p = pattern.trim().to_lowercase();
    if p.is_empty() || host.is_empty() {
        return Some(false);
    }
    if p == "*" {
        return Some(true);
    }
    if let Some(base) = p.strip_prefix("**.") {
        let (bp, hp) = (rev_labels(base), rev_labels(host));
        return Some(hp.len() > bp.len() && hp[..bp.len()] == bp[..]);
    }
    if let Some(base) = p.strip_prefix("*.") {
        if base.contains('*') {
            return None;
        }
        let (bp, hp) = (rev_labels(base), rev_labels(host));
        return Some(hp.len() == bp.len() + 1 && hp[..bp.len()] == bp[..]);
    }
    if p.contains('*') {
        return None;
    }
    Some(p == host)
}

/// 该模式形态能否被本模块安全表达(= `pattern_matches` 恒不返回 `None`)。
fn pattern_supported(pattern: &str) -> bool {
    let p = pattern.trim().to_lowercase();
    if p == "*" || !p.contains('*') {
        return true;
    }
    let base = match p.strip_prefix("**.").or_else(|| p.strip_prefix("*.")) {
        Some(b) => b,
        None => return false,
    };
    !base.contains('*')
}

/// env → 生效策略(装配语义同 `policy-source.ts`:内置行永远在场 —— 本模块以
/// `builtin-table-unwired` 点名它不在场;显式声明行排在任何隐式档之前;认不出落更严)。
pub fn load_policy(env: &dyn Fn(&str) -> Option<String>) -> (GatePolicy, Vec<String>) {
    let mut warnings: Vec<String> = Vec::new();
    let mut default_deny = false;
    let raw_default = env("IHUI_EGRESS_DEFAULT").map(|v| v.trim().to_lowercase());
    match raw_default.as_deref() {
        None | Some("") => {}
        Some("allow") => default_deny = false,
        Some("deny") => default_deny = true,
        Some(other) => {
            default_deny = true;
            warnings.push(format!(
                "egress: unknown IHUI_EGRESS_DEFAULT=\"{other}\"; using \"deny\" (strictest)"
            ));
        }
    }

    let mut rules: Vec<Rule> = Vec::new();
    for (key, effect) in [
        ("IHUI_EGRESS_DENY_DOMAINS", Effect::Deny),
        ("IHUI_EGRESS_ALLOW_DOMAINS", Effect::Allow),
    ] {
        let raw = match env(key) {
            Some(v) => v,
            None => continue,
        };
        let mut empty_entries = 0usize;
        for part in raw.split(',') {
            let domain = part.trim().to_lowercase();
            if domain.is_empty() {
                empty_entries += 1;
                continue;
            }
            let supported = pattern_supported(&domain);
            if !supported {
                warnings.push(format!(
                    "egress: {key} row \"{domain}\" uses a wildcard shape this shell cannot express -> graded unjudged, never folded into allow; rewrite it as *.label.tld or **.label.tld"
                ));
            }
            if domain.starts_with("**.") {
                warnings.push(format!(
                    "egress: {key} row \"{domain}\" covers subdomains only, not the bare root {}; declare the root as its own row (same two-row shape the CLI builtin table uses)" ,
                    domain.trim_start_matches("**.")
                ));
            }
            rules.push(Rule {
                id: format!("env:{key}:{domain}"),
                why: format!("declared by operator via {key}"),
                domain,
                effect,
                // 机主点名的行天生 enforce(同 policy-source.ts)。
                enforcement: Enforcement::Enforce,
                supported,
            });
        }
        if empty_entries > 0 {
            warnings.push(format!(
                "egress: {key} has {empty_entries} empty entr{}; skipped",
                if empty_entries == 1 { "y" } else { "ies" }
            ));
        }
    }

    let mut enforcement = Enforcement::Advisory;
    match env("IHUI_EGRESS_ENFORCE").map(|v| v.trim().to_string()).as_deref() {
        None | Some("") => {}
        Some("1") => enforcement = Enforcement::Enforce,
        Some("0") => enforcement = Enforcement::Advisory,
        Some(other) => {
            enforcement = Enforcement::Enforce;
            warnings.push(format!(
                "egress: unknown IHUI_EGRESS_ENFORCE=\"{other}\"; using \"enforce\" (strictest)"
            ));
        }
    }

    if rules.is_empty() {
        warnings.push(
            "egress: no operator-declared rows on this surface (IHUI_EGRESS_DENY_DOMAINS/IHUI_EGRESS_ALLOW_DOMAINS); the builtin internal-name/CIDR table lives only in @ihui/shared/utils/ssrf-guard and is deliberately NOT reimplemented here (see egress_gate.rs header) -> those layers report unjudged, never allow"
                .to_string(),
        );
    }
    if env("IHUI_EGRESS_ADDRESS_PROOF").is_some() {
        warnings.push(
            "egress: IHUI_EGRESS_ADDRESS_PROOF declared but the DNS address-proof leg is Node-carrier only (dns-resolver-adapter.ts) -> not enforced from the desktop shell (named gap, not a pass)"
                .to_string(),
        );
    }
    if env("IHUI_EGRESS_PROXY_URL").is_some() {
        warnings.push(
            "egress: IHUI_EGRESS_PROXY_URL declared but the shell's own HTTP client is not routed through it by this module (relay leg is CLI-carried) -> not enforced from the desktop shell (named gap, not a pass)"
                .to_string(),
        );
    }

    (GatePolicy { rules, default_deny, enforcement }, warnings)
}

fn judgement(
    target: &str,
    decision: Decision,
    layer: &'static str,
    reason: &'static str,
    hint: Option<String>,
    enforcement: Enforcement,
) -> Judgement {
    Judgement { target: target.to_string(), decision, layer, reason, hint, enforcement }
}

/// 按名裁决(零网络动作),判序与 `policy.ts` `judgeEgressTarget` 逐步一致,
/// 每一步只往更保守方向走。
pub fn judge(raw_target: &str, policy: &GatePolicy) -> Judgement {
    let host = normalize_target_host(raw_target);
    if host.is_empty() {
        return judgement(
            "<empty-target>",
            Decision::Unjudged,
            "input",
            "target-missing",
            Some("pass an http(s) URL or an IP literal; an empty target is never a pass".to_string()),
            Enforcement::Advisory,
        );
    }
    if policy.rules.is_empty() {
        return judgement(
            &host,
            Decision::Unjudged,
            "rule",
            "policy-unavailable",
            Some(
                "read the egress rule table (built-in table plus IHUI_EGRESS_DENY_DOMAINS/IHUI_EGRESS_ALLOW_DOMAINS); an empty table is never \"no egress limit\""
                    .to_string(),
            ),
            Enforcement::Advisory,
        );
    }

    let mut saw_unsupported_deny = false;
    for rule in &policy.rules {
        if !rule.supported {
            // 装载时已点名该行;表达不了的 deny 行按更严一侧结算(不折成 allow)。
            if rule.effect == Effect::Deny && rule.enforcement == Enforcement::Enforce {
                saw_unsupported_deny = true;
            }
            continue;
        }
        match pattern_matches(&rule.domain, &host) {
            Some(true) => {
                let enf = rule.enforcement;
                if rule.effect == Effect::Allow {
                    return judgement(&host, Decision::Allow, "rule", "rule-allow", None, enf);
                }
                return judgement(
                    &host,
                    Decision::Deny,
                    "rule",
                    "rule-deny",
                    Some(format!(
                        "{} - allow it explicitly via IHUI_EGRESS_ALLOW_DOMAINS, or keep it advisory with IHUI_EGRESS_ENFORCE=0",
                        rule.why
                    )),
                    enf,
                );
            }
            Some(false) => {}
            None => {
                if rule.effect == Effect::Deny && rule.enforcement == Enforcement::Enforce {
                    saw_unsupported_deny = true;
                }
            }
        }
    }
    if saw_unsupported_deny {
        return judgement(
            &host,
            Decision::Unjudged,
            "rule",
            "deny-pattern-unsupported",
            Some("the operator named a wildcard this shell cannot express; refusing to fold it into allow - rewrite it as *.label.tld or **.label.tld".to_string()),
            Enforcement::Advisory,
        );
    }

    if looks_like_ip_literal(&host) {
        return judgement(
            &host,
            Decision::Unjudged,
            "ip-literal",
            "ip-literal-unwired",
            Some("internal-range table (DENIED_CIDRS) is TS-only; name this literal in IHUI_EGRESS_DENY_DOMAINS to block it from the desktop shell".to_string()),
            policy.enforcement,
        );
    }

    let enf = policy.enforcement;
    if policy.default_deny {
        return judgement(
            &host,
            Decision::Deny,
            "default",
            "default-deny",
            Some("add an allow rule via IHUI_EGRESS_ALLOW_DOMAINS if this destination is meant to be reachable".to_string()),
            enf,
        );
    }
    judgement(&host, Decision::Allow, "default", "default-allow", None, enf)
}

/// 仅判「这是不是 IP 字面量形态」(零名单、零网段判定)—— 与 `ip-literal.ts` 的解析数学无关。
fn looks_like_ip_literal(host: &str) -> bool {
    if host.contains(':') && host.matches(':').count() >= 2 {
        return true; // IPv6 字面量
    }
    let parts: Vec<&str> = host.split('.').collect();
    parts.len() == 4
        && parts.iter().all(|p| !p.is_empty() && p.len() <= 3 && p.chars().all(|c| c.is_ascii_digit()))
}

/// 出站点唯一入口:`Err(具名理由)` = 该拒绝(仅 enforce 档真的拒绝),`Ok(())` = 放行或只出声。
/// 调用方必须把理由一路带到用户能看见的地方,不得 `let _ =` 吞掉。
pub fn guard_egress_target(raw_target: &str) -> Result<(), String> {
    let (policy, load_warnings) = load_policy(&env_get);
    let verdict = judge(raw_target, &policy);

    let mut out: Vec<String> = load_warnings;
    match verdict.decision {
        Decision::Unjudged => out.push(format!(
            "egress unjudged: {} ({}, layer={}) -> {}",
            verdict.target,
            verdict.reason,
            verdict.layer,
            verdict.hint.clone().unwrap_or_default()
        )),
        Decision::Deny if verdict.enforcement == Enforcement::Advisory => out.push(format!(
            "egress advisory deny: {} ({}) -> {}",
            verdict.target,
            verdict.reason,
            verdict.hint.clone().unwrap_or_default()
        )),
        _ => {}
    }
    report_egress_warnings(&out);

    if verdict.decision == Decision::Deny && verdict.enforcement == Enforcement::Enforce {
        return Err(format!(
            "egress_denied: {} ({}, layer={})",
            verdict.target, verdict.reason, verdict.layer
        ));
    }
    Ok(())
}

/// 出声出口:同一签名只喊一次(同 `env-inject.ts` 的 `reportedSignatures` —— 每次拨号都喊会刷屏,
/// 静默则敞口不可见)。写 stderr,不进任何请求体。
pub fn report_egress_warnings(lines: &[String]) {
    if lines.is_empty() {
        return;
    }
    static SEEN: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    let seen = SEEN.get_or_init(|| Mutex::new(HashSet::new()));
    for line in lines {
        let mut guard = match seen.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        if guard.contains(line) {
            continue;
        }
        guard.insert(line.clone());
        drop(guard);
        eprintln!("⚠ egress: {line}");
        log::warn!("[egress] {line}");
    }
}

#[cfg(test)]
mod egress_gate_tests {
    use super::*;

    fn policy_from(deny: Option<&str>, allow: Option<&str>, default: Option<&str>, enforce: Option<&str>) -> GatePolicy {
        let map = |k: &str| -> Option<String> {
            match k {
                "IHUI_EGRESS_DENY_DOMAINS" => deny.map(str::to_string),
                "IHUI_EGRESS_ALLOW_DOMAINS" => allow.map(str::to_string),
                "IHUI_EGRESS_DEFAULT" => default.map(str::to_string),
                "IHUI_EGRESS_ENFORCE" => enforce.map(str::to_string),
                _ => None,
            }
        };
        let (policy, _) = load_policy(&map);
        policy
    }

    #[test]
    fn e1_empty_target_is_unjudged_never_a_pass() {
        let policy = policy_from(Some("evil.com"), None, None, Some("1"));
        let v = judge("   ", &policy);
        assert_eq!(v.decision, Decision::Unjudged);
        assert_eq!(v.reason, "target-missing");
        assert_eq!(v.layer, "input");
    }

    #[test]
    fn e2_no_declared_rows_is_unjudged_and_names_the_gap() {
        let policy = policy_from(None, None, None, None);
        let v = judge("https://aizhs.top/", &policy);
        assert_eq!(v.decision, Decision::Unjudged);
        assert_eq!(v.reason, "policy-unavailable");
    }

    #[test]
    fn e3_operator_deny_is_enforced_and_named() {
        let policy = policy_from(Some("evil.example"), None, None, Some("1"));
        let v = judge("https://evil.example/path?q=1", &policy);
        assert_eq!(v.decision, Decision::Deny);
        assert_eq!(v.reason, "rule-deny");
        assert_eq!(v.target, "evil.example");
        assert!(v.hint.unwrap().contains("IHUI_EGRESS_ALLOW_DOMAINS"));
    }

    #[test]
    fn e4_single_label_wildcard_does_not_recurse() {
        let policy = policy_from(Some("*.example.com"), None, None, Some("1"));
        assert_eq!(judge("api.example.com", &policy).decision, Decision::Deny);
        assert_eq!(judge("deep.api.example.com", &policy).reason, "default-allow");
        assert_eq!(judge("example.com", &policy).reason, "default-allow");
    }

    #[test]
    fn e5_double_star_recurses_but_not_the_root_layer() {
        // 「根层单列族」对齐 builtin-rules.ts:com/example/** 不吃 com/example 本身。
        let policy = policy_from(Some("**.example.com"), None, None, Some("1"));
        assert_eq!(judge("deep.api.example.com", &policy).decision, Decision::Deny);
        assert_eq!(judge("example.com", &policy).reason, "default-allow");
        assert_eq!(judge("notexample.com", &policy).reason, "default-allow");
        let both = policy_from(Some("**.example.com,example.com"), None, None, Some("1"));
        assert_eq!(judge("example.com", &both).decision, Decision::Deny);
    }

    #[test]
    fn e5b_unsupported_and_root_layer_rows_are_named_at_load() {
        let map = |k: &str| -> Option<String> {
            match k {
                "IHUI_EGRESS_DENY_DOMAINS" => Some("mid*dle.example,**.victim.example".to_string()),
                _ => None,
            }
        };
        let (_, warnings) = load_policy(&map);
        assert!(warnings.iter().any(|w| w.contains("mid*dle.example") && w.contains("cannot express")), "{warnings:?}");
        assert!(warnings.iter().any(|w| w.contains("covers subdomains only")), "{warnings:?}");
    }

    #[test]
    fn e6_declaration_order_named_allow_outranks_default_deny() {
        let policy = policy_from(None, Some("aizhs.top"), Some("deny"), Some("1"));
        assert_eq!(judge("https://aizhs.top/api/health", &policy).decision, Decision::Allow);
        assert_eq!(judge("https://other.example", &policy).decision, Decision::Deny);
        assert_eq!(judge("https://other.example", &policy).reason, "default-deny");
    }

    #[test]
    fn e7_unknown_strict_values_fall_to_the_stricter_side() {
        let (policy, warnings) = {
            let map = |k: &str| -> Option<String> {
                match k {
                    "IHUI_EGRESS_DEFAULT" => Some("maybe".to_string()),
                    "IHUI_EGRESS_ENFORCE" => Some("yes".to_string()),
                    _ => None,
                }
            };
            load_policy(&map)
        };
        assert!(policy.default_deny);
        assert_eq!(policy.enforcement, Enforcement::Enforce);
        assert!(warnings.iter().any(|w| w.contains("IHUI_EGRESS_DEFAULT")), "{warnings:?}");
        assert!(warnings.iter().any(|w| w.contains("IHUI_EGRESS_ENFORCE")), "{warnings:?}");
        assert!(
            warnings.iter().filter(|w| w.contains("unknown IHUI_EGRESS")).count() == 2,
            "更严结算点名必须恰为 2 条: {warnings:?}"
        );
    }

    #[test]
    fn e8_ip_literal_is_unjudged_not_copied() {
        let policy = policy_from(Some("evil.example"), None, None, Some("1"));
        for host in ["127.0.0.1", "169.254.169.254", "::1", "10.0.0.5"] {
            let v = judge(host, &policy);
            assert_eq!(v.decision, Decision::Unjudged, "{host} -> {v:?}");
            assert_eq!(v.reason, "ip-literal-unwired", "{host}");
        }
    }

    #[test]
    fn e9_host_normalization_matches_cli_surface() {
        let policy = policy_from(Some("evil.example"), None, None, Some("1"));
        for raw in ["Evil.Example:8443", "http://Evil.Example/path", "  evil.example.  "] {
            assert_eq!(judge(raw, &policy).decision, Decision::Deny, "{raw}");
        }
    }

    #[test]
    fn e10_unsupported_deny_wildcard_never_folds_into_allow() {
        let policy = policy_from(Some("mid*dle.example"), None, None, Some("1"));
        let v = judge("anything.example", &policy);
        assert_eq!(v.decision, Decision::Unjudged);
        assert_eq!(v.reason, "deny-pattern-unsupported");
    }

    #[test]
    fn e11_env_declared_rows_are_enforce_while_default_layer_is_advisory() {
        // 档位与 CLI `policy-source.ts` 一致:机主点名的行**天生 enforce**,
        // `IHUI_EGRESS_ENFORCE` 只结算 ip-literal / default 两层(0 也降不掉具名行)。
        let declared = policy_from(Some("evil.example"), None, None, Some("0"));
        let v = judge("evil.example", &declared);
        assert_eq!(v.decision, Decision::Deny);
        assert_eq!(v.enforcement, Enforcement::Enforce);
        let defaulted = policy_from(Some("keep.example"), None, Some("deny"), Some("0"));
        let d = judge("anything.else", &defaulted);
        assert_eq!(d.decision, Decision::Deny);
        assert_eq!(d.reason, "default-deny");
        assert_eq!(d.enforcement, Enforcement::Advisory);
    }

    #[test]
    fn e12_env_key_surface_is_the_cli_table() {
        // 形状锁:8 枚键名与本模块头注声明的 CLI 源逐一对应;字符串面清单由
        // apps/desktop/tests/egress-env-keys-parity.test.mjs 与 policy.ts 对账。
        assert_eq!(EGRESS_ENV_KEYS.len(), 8);
        for key in EGRESS_ENV_KEYS.iter() {
            assert!(key.starts_with("IHUI_EGRESS_"), "{key}");
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
