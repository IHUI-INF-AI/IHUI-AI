// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面端(Tauri / Rust 侧)出站网络出口门 —— 与 CLI 那把尺**同源**的接线腿(goal-b49 Z17)。
//!
//! 立因:前票 Z3(`.ihui-agent/tmp/rea-goal-b49/Z3-impl.md` §4 第 1 条)把 CLI 侧三条腿入库后
//! 点名「desktop 同源腿交主席另票」。现读 `apps/desktop/src-tauri/src/**` 的出站点
//! (`reqwest` 命中处:`auto_refresh.rs:249/441`、`checkin_web_login.rs:138/171`、
//! `checkin_capture.rs:3265`)在本模块之前**零出口判定**:
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
//! - ✅ **已接线(goal-b49 Z26)**:内置内网名段/域名族表(`packages/shared/src/utils/ssrf-guard.ts` 的
//!   `DENIED_HOST_NAMES` / `DENIED_HOST_SUFFIXES` 与 `ip-literal.ts` 的 `DENIED_CIDRS`)与
//!   `glob-pattern.ts` 的通用匹配器。一手证据:`packages/shared/package.json` 的 `exports` 把
//!   公开路径直接指向 `./src/*.ts`,而 `apps/cli` 无 `dist` 产物 ⇒ Rust 侧既不能 import、
//!   运行时也没有可读的机器可消费形态(打包后的二进制不持有仓库路径)。**把 8 条字面量与
//!   CIDR 表粘进 Rust 就是 §0.6 的第二把尺**,件不可用时这两层仍返回 `unjudged`
//!   (`builtin-table-unwired` / `ip-literal-unwired`)并在装载时点名一次(§0.3:取不到输入
//!   ⇒ 显式「未判定」,绝不冒 allow)。解锁前置见交付报告「未竟」:shared 侧产出 JSON 名单件
//!   (需动 `packages/**` + `scripts/**`,不在本票白名单)后本模块 `include_str!` 该件;
//!   或经 IPC 向 CLI/服务端取裁决。反向锁:parity 用例断言本文件**不得出现**那些字面量。
//!   **〔Z26 补上的就是那一格〕** 名单本体经 `include_str!` 读派生态件
//!   `packages/shared/src/utils/egress-builtin-list.json`(生成器
//!   `scripts/generate-egress-builtin-list.mjs`;件⇄源⇄include 三格对账尺
//!   `scripts/check-egress-builtin-list-sync.mjs`);件 schema 不认/解析不了/枚举为空 ⇒
//!   `manifest()` 给 `None`,那两条腿**原地回到上面的 `unjudged` 形态**(§0.3 取不到输入
//!   不冒 allow)。跨语言行为向量钉在 `e13`(向量本身也来自那张件)。
//! - ❌ 不接:DNS 地址证据腿与 TCP relay 腿(`dns-resolver-adapter.ts` / `proxy-relay.ts` 是
//!   Node 载体,桌面端无宿主),同样只点名不假执法。
//!
//! 失效方向(档位):
//! - **硬规则恒 Enforce**:`IHUI_EGRESS_DEFAULT=deny`(`default-deny` 层)与内网 IP 段命中
//!   (`internal-range` 层)**一律按 `Enforce` 结算**,不受全局 advisory 档影响。立因:策略是硬规则,
//!   若设置面写着 deny、实际只出声,那就是伪开关(F-105);档位判定与执行落点必须是同一个值。
//! - 机主经 `IHUI_EGRESS_DENY_DOMAINS`/`IHUI_EGRESS_ALLOW_DOMAINS` 点名的行同样天生 Enforce。
//! - `IHUI_EGRESS_ENFORCE` 只结算**兜底白名单**那一层(`default-allow` 的放行档位);默认
//!   advisory ⇒ 出声不拦。`IHUI_EGRESS_DEFAULT` 取值认不出 ⇒ 落 `deny`(更严)。
//! - 通配形态认不出(`*` 不在最左标签位)⇒ 该行按**更严**结算为 `unjudged`,绝不折成 allow。
//!
//! **覆盖范围(如实,不是"全量生效")**:本门只作用于本仓自己代码里的出站点,现有 6 处调用点
//! (3 个文件):`auto_refresh.rs`(健康检查 / 前端 URL)、`checkin_web_login.rs`(2 处)、
//! `checkin_capture.rs`(2 处 IP 探测)。**不过门**:`tauri-plugin-http`(`lib.rs` 的
//! `tauri_plugin_http::init()`)与内嵌 WebView 里的页面请求 —— 这些请求由插件/webview 自己发起,
//! 不经过本模块;前端 JS 直接 `fetch` 同样不过门。故本模块**不是**桌面端全量出站网关,
//! 只是"自家 Rust 出站点"的门;接管插件不在本模块职责内。

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

/// 内置名单腿的**消费面**(goal-b49 Z26):名单本体是派生态件,由
/// `scripts/generate-egress-builtin-list.mjs` 从 `packages/shared/src/utils/{ssrf-guard,ip-literal}.ts`
/// 与 `apps/cli/src/sandbox/egress/builtin-rules.ts` 重算,逐字节对账尺 =
/// `scripts/check-egress-builtin-list-sync.mjs`(件 ⇄ 源 ⇄ 本 include 三格)。
/// 本模块**不写任何名单字面量**(§0.6 第二把尺;Z17 反向锁仍生效)。
const EGRESS_BUILTIN_LIST_JSON: &str =
    include_str!("../../../../packages/shared/src/utils/egress-builtin-list.json");

const EGRESS_BUILTIN_LIST_SCHEMA: &str = "ihui-egress-builtin-list/v1";

#[derive(serde::Deserialize)]
pub struct ManifestRow {
    pub id: String,
    pub domain: String,
    pub effect: String,
    pub enforcement: String,
    pub why: String,
}

#[derive(serde::Deserialize)]
pub struct EmbeddedPrefix {
    pub cidr: String,
    #[serde(rename = "v4BitOffset")]
    pub v4_bit_offset: u32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVector {
    pub target: String,
    pub decision: String,
    pub layer: String,
    pub reason: String,
    pub rule_id: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub schema: String,
    pub host_names: Vec<String>,
    pub host_suffixes: Vec<String>,
    pub denied_cidrs: Vec<String>,
    pub ipv6_embedded_v4_prefixes: Vec<EmbeddedPrefix>,
    pub rows: Vec<ManifestRow>,
    pub vectors: Vec<ManifestVector>,
}

/// 读件:schema 不认、解析不了、名单枚数为 0 ⇒ `None`(= 该腿不可用,judge 落更严一侧,
/// 绝不折成 allow,也不静默当成"表里没有这条")。解析结果只算一次。
pub fn manifest() -> Option<&'static Manifest> {
    static CACHE: OnceLock<Option<Manifest>> = OnceLock::new();
    CACHE
        .get_or_init(|| match serde_json::from_str::<Manifest>(EGRESS_BUILTIN_LIST_JSON) {
            Ok(m) if m.schema == EGRESS_BUILTIN_LIST_SCHEMA => {
                if m.rows.is_empty() || m.denied_cidrs.is_empty() || m.vectors.is_empty() {
                    eprintln!("⚠ egress: builtin list artifact enumerates empty tables -> builtin legs unavailable (never folded into allow)");
                    None
                } else {
                    Some(m)
                }
            }
            Ok(m) => {
                eprintln!("⚠ egress: builtin list artifact schema \"{}\" is not the one this shell reads -> builtin legs unavailable", m.schema);
                None
            }
            Err(e) => {
                eprintln!("⚠ egress: builtin list artifact could not be parsed ({e}) -> builtin legs unavailable");
                None
            }
        })
        .as_ref()
}

/// 件里的规则行 ⇒ 本模块的 Rule。行形认不出(档位字符串不在档 / 通配表达不了)⇒
/// 标 `supported=false` + Deny,由 `judge` 的"更严一侧"结算成 `unjudged`(绝不折 allow)。
fn builtin_rules() -> Vec<Rule> {
    let Some(m) = manifest() else { return Vec::new(); };
    m.rows
        .iter()
        .map(|row| {
            let known_effect = row.effect == "deny" || row.effect == "allow";
            Rule {
                id: row.id.clone(),
                domain: row.domain.to_lowercase(),
                effect: if row.effect == "allow" { Effect::Allow } else { Effect::Deny },
                enforcement: if row.enforcement == "advisory" { Enforcement::Advisory } else { Enforcement::Enforce },
                why: format!("{} (builtin list artifact)", row.why),
                supported: known_effect && pattern_supported(&row.domain),
            }
        })
        .collect()
}

/// IPv4 点分四段 ⇒ 32 位值(严格四段、每段 1-3 位十进制、≤255;不认前导零之外的花招)。
fn parse_ipv4(text: &str) -> Option<u32> {
    let parts: Vec<&str> = text.split('.').collect();
    if parts.len() != 4 {
        return None;
    }
    let mut value: u32 = 0;
    for part in parts {
        if part.is_empty() || part.len() > 3 || !part.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }
        let octet: u32 = part.parse().ok()?;
        value = (value << 8) | octet;
    }
    Some(value)
}

fn ipv6_groups(chunk: &str) -> Option<Vec<u16>> {
    if chunk.is_empty() {
        return Some(Vec::new());
    }
    let mut out: Vec<u16> = Vec::new();
    for part in chunk.split(':') {
        if part.is_empty() {
            return None;
        }
        if part.contains('.') {
            let v4 = parse_ipv4(part)?;
            out.push((v4 >> 16) as u16);
            out.push((v4 & 0xffff) as u16);
            continue;
        }
        if part.len() > 4 || !part.chars().all(|c| c.is_ascii_hexdigit()) {
            return None;
        }
        out.push(u16::from_str_radix(part, 16).ok()?);
    }
    Some(out)
}

/// IPv6(含 `::` 压缩、尾段 IPv4 形态、IPv4-mapped/compatible 折回 v4)⇒ (值, 族)。
fn parse_ipv6(text: &str) -> Option<(u128, u8)> {
    let (first, rest) = match text.find("::") {
        Some(idx) => (&text[..idx], Some(&text[idx + 2..])),
        None => (text, None),
    };
    let left = ipv6_groups(first)?;
    let right = match rest {
        Some(r) => ipv6_groups(r)?,
        None => Vec::new(),
    };
    let mut groups: Vec<u16> = Vec::with_capacity(8);
    if rest.is_some() {
        let fill = 8usize.checked_sub(left.len() + right.len())?;
        if left.len() + right.len() >= 8 && !(left.is_empty() && right.is_empty() && fill == 8) {
            return None;
        }
        groups.extend_from_slice(&left);
        groups.resize(left.len() + fill, 0);
        groups.extend_from_slice(&right);
    } else {
        groups = left;
    }
    if groups.len() != 8 {
        return None;
    }
    let mut value: u128 = 0;
    for g in &groups {
        value = (value << 16) | u128::from(*g);
    }
    let top96 = value >> 32;
    if top96 == 0 || top96 == 0xffff {
        return Some(((value & 0xffff_ffff) as u128, 4));
    }
    Some((value, 6))
}

/// 主机名 ⇒ (值, 族)。解析不了由调用方落 `unjudged`(更严一侧),绝不折 allow。
fn parse_ip_address(host: &str) -> Option<(u128, u8)> {
    if host.contains(':') {
        return parse_ipv6(host).map(|(v, f)| (v as u128, f));
    }
    parse_ipv4(host).map(|v| (v as u128, 4))
}

fn cidr_parts(text: &str) -> Option<((u128, u8), u32)> {
    let (addr, prefix) = text.split_once('/')?;
    let parsed = parse_ip_address(addr)?;
    let bits = if parsed.1 == 4 { 32 } else { 128 };
    let prefix: u32 = prefix.parse().ok()?;
    if prefix > bits {
        return None;
    }
    Some((parsed, prefix))
}

fn top_bits(value: u128, family: u8, prefix: u32) -> u128 {
    let bits = u32::from(family == 6) * 96 + 32;
    if prefix == 0 {
        return 0;
    }
    value >> (bits - prefix)
}

fn hits_cidr(value: u128, family: u8, base: u128, cidr_family: u8, prefix: u32) -> bool {
    family == cidr_family && top_bits(value, family, prefix) == top_bits(base, cidr_family, prefix)
}

/// 落进件里那张 CIDR 表?(含 6to4 / DNS64 嵌入 v4 的**折回复检** —— 语义同源 `ip-literal.ts`:
/// 那一族按前缀一律拒会误杀真实公网目的,所以取嵌进来的 v4 再走一遍 v4 名单。)
fn ip_hits_denied(parsed: (u128, u8)) -> bool {
    let Some(m) = manifest() else { return true; };
    let (value, family) = parsed;
    for text in &m.denied_cidrs {
        if let Some(((base, cidr_family), prefix)) = cidr_parts(text) {
            if hits_cidr(value, family, base, cidr_family, prefix) {
                return true;
            }
        }
    }
    if family != 6 {
        return false;
    }
    for row in &m.ipv6_embedded_v4_prefixes {
        let Some(((base, cidr_family), prefix)) = cidr_parts(&row.cidr) else { continue };
        if cidr_family != 6 || !hits_cidr(value, 6, base, 6, prefix) {
            continue;
        }
        if row.v4_bit_offset + 32 > 128 {
            continue;
        }
        let inner = (value >> (128 - row.v4_bit_offset - 32)) & 0xffff_ffff;
        if m.denied_cidrs.iter().any(|text| {
            cidr_parts(text).map_or(false, |((base, fam), prefix)| {
                fam == 4 && hits_cidr(inner, 4, base, 4, prefix)
            })
        }) {
            return true;
        }
    }
    false
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

    if manifest().is_none() {
        warnings.push(
            "egress: the wired builtin list artifact (packages/shared/src/utils/egress-builtin-list.json, read via include_str!) is unreadable / schema-mismatched / enumerates empty -> the internal-name and CIDR legs are UNAVAILABLE on this surface and judge() falls to unjudged, never allow (reconcile with scripts/check-egress-builtin-list-sync.mjs)"
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

    let wired: Vec<Rule> = builtin_rules().into_iter().chain(rules.into_iter()).collect();
    (GatePolicy { rules: wired, default_deny, enforcement }, warnings)
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
        if manifest().is_none() {
            return judgement(
                &host,
                Decision::Unjudged,
                "ip-literal",
                "ip-literal-unwired",
                Some("the wired internal-range table is unreadable -> refusing to guess: name this literal in IHUI_EGRESS_DENY_DOMAINS, or fix scripts/generate-egress-builtin-list.mjs --write".to_string()),
                policy.enforcement,
            );
        }
        let parsed = match parse_ip_address(&host) {
            Some(p) => p,
            None => {
                return judgement(
                    &host,
                    Decision::Unjudged,
                    "ip-literal",
                    "ip-form-unparsable",
                    Some("this shell cannot parse the address form -> unjudged, never folded into allow".to_string()),
                    policy.enforcement,
                )
            }
        };
        if ip_hits_denied(parsed) {
            // 内网段命中是硬规则:全局 advisory 档不得把它降成"只出声"(F-105)。
            return judgement(
                &host,
                Decision::Deny,
                "ip-literal",
                "internal-range",
                Some("the literal lands in the wired internal-range table (hard rule, always enforced); allow it explicitly via IHUI_EGRESS_ALLOW_DOMAINS".to_string()),
                Enforcement::Enforce,
            );
        }
        return judgement(&host, Decision::Allow, "ip-literal", "public-literal", None, policy.enforcement);
    }

    if policy.default_deny {
        // `IHUI_EGRESS_DEFAULT=deny` 是硬规则:全局 advisory 档不得把它降成"只出声"(F-105)。
        return judgement(
            &host,
            Decision::Deny,
            "default",
            "default-deny",
            Some("add an allow rule via IHUI_EGRESS_ALLOW_DOMAINS if this destination is meant to be reachable".to_string()),
            Enforcement::Enforce,
        );
    }
    judgement(
        &host,
        Decision::Allow,
        "default",
        "default-allow",
        None,
        policy.enforcement,
    )
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

/// `guard` 的拒绝判据(纯,可单测):只有被 `Enforce` 结算的 `Deny` 才真的拒绝。
/// 判定与执行读的是**同一个** `Judgement`,不另算一份档位(F-105:两者分离就是伪开关)。
fn enforced_refusal(verdict: &Judgement) -> Option<String> {
    if verdict.decision == Decision::Deny && verdict.enforcement == Enforcement::Enforce {
        Some(format!(
            "egress_denied: {} ({}, layer={})",
            verdict.target, verdict.reason, verdict.layer
        ))
    } else {
        None
    }
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

    if let Some(denied) = enforced_refusal(&verdict) {
        return Err(denied);
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
    fn e2_wired_builtin_rows_are_always_present_and_an_empty_table_is_unjudged() {
        let policy = policy_from(None, None, None, None);
        assert!(!policy.rules.is_empty(), "内置行必须永远在场(名单件已接线)");
        assert_eq!(judge("https://aizhs.top/", &policy).reason, "default-allow");
        let mut bare = policy.clone();
        bare.rules.clear();
        let v = judge("https://aizhs.top/", &bare);
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
    fn e8_ip_literal_is_judged_by_the_wired_cidr_table() {
        let policy = policy_from(Some("evil.example"), None, None, Some("1"));
        for host in ["127.0.0.1", "169.254.169.254", "::1", "10.0.0.5"] {
            let v = judge(host, &policy);
            assert_eq!(v.decision, Decision::Deny, "{host} -> {v:?}");
            assert_eq!(v.reason, "internal-range", "{host}");
            assert_eq!(v.layer, "ip-literal", "{host}");
        }
        let public = judge("8.8.8.8", &policy);
        assert_eq!(public.decision, Decision::Allow);
        assert_eq!(public.reason, "public-literal");
    }

    /// 跨语言行为向量对账(Z17 §四-2):期望值由 TS 生产判据本体算出并**存在件里**,
    /// 本用例逐值比对 decision/layer/reason。档位面刻意不比对:Rust 侧 IHUI_EGRESS_ENFORCE
    /// 结算 ip-literal/default 两层,TS 侧 builtin 行恒 advisory —— 已点名的分工差,不是漂移。
    #[test]
    fn e13_cross_language_vectors_match_the_ts_engine() {
        let map = |_: &str| -> Option<String> { None };
        let (policy, _) = load_policy(&map);
        let m = manifest().expect("内置名单件必须可解析,否则本用例直接失败(不静默跳过)");
        let mut checked = 0usize;
        for v in m.vectors.iter() {
            let j = judge(&v.target, &policy);
            let expected = match v.decision.as_str() {
                "deny" => Decision::Deny,
                "allow" => Decision::Allow,
                _ => Decision::Unjudged,
            };
            assert_eq!(j.decision, expected, "target={} ts={}", v.target, v.decision);
            assert_eq!(j.layer, v.layer, "target={} ts-layer={}", v.target, v.layer);
            assert_eq!(j.reason, v.reason, "target={} ts-reason={}", v.target, v.reason);
            if v.layer == "rule" {
                assert!(v.rule_id.is_some(), "rule 层向量必须带行身份: {}", v.target);
            }
            checked += 1;
        }
        assert!(checked >= 40, "向量现读 {} 枚,少于源表规模 ⇒ 语料被裁剪,判失败", checked);
    }

    /// 「认不出落更严」那一格:行档位不在档 / 通配表达不了 ⇒ 绝不折成 allow,结算 unjudged。
    #[test]
    fn e14_unmappable_builtin_row_shape_falls_to_the_stricter_side() {
        let m = manifest().expect("内置名单件必须可解析");
        for row in m.rows.iter() {
            assert!(
                matches!(row.effect.as_str(), "deny" | "allow"),
                "件里的行档位不在档: {} {}",
                row.id,
                row.effect
            );
        }
        let bad = Rule {
            id: "probe".to_string(),
            domain: "mid*dle.example".to_string(),
            effect: Effect::Deny,
            enforcement: Enforcement::Enforce,
            why: "probe".to_string(),
            supported: false,
        };
        let policy = GatePolicy { rules: vec![bad], default_deny: false, enforcement: Enforcement::Advisory };
        let v = judge("anything.example", &policy);
        assert_eq!(v.decision, Decision::Unjudged);
        assert_eq!(v.reason, "deny-pattern-unsupported");
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
    fn e11_env_declared_rows_and_hard_layers_are_always_enforce() {
        // 档位与 CLI `policy-source.ts` 一致:机主点名的行**天生 enforce**;
        // F-105 起 `IHUI_EGRESS_ENFORCE` 只结算兜底白名单层,`default-deny` / `internal-range`
        // 是硬规则 —— 全局 advisory(含显式 0)也降不掉它。
        let declared = policy_from(Some("evil.example"), None, None, Some("0"));
        let v = judge("evil.example", &declared);
        assert_eq!(v.decision, Decision::Deny);
        assert_eq!(v.enforcement, Enforcement::Enforce);
        let defaulted = policy_from(Some("keep.example"), None, Some("deny"), Some("0"));
        let d = judge("anything.else", &defaulted);
        assert_eq!(d.decision, Decision::Deny);
        assert_eq!(d.reason, "default-deny");
        assert_eq!(d.enforcement, Enforcement::Enforce, "default-deny 是硬规则");
        // 兜底 allow 层仍由全局档位结算(advisory 只出声)。
        let open = policy_from(Some("keep.example"), None, None, Some("0"));
        assert_eq!(open.enforcement, Enforcement::Advisory);
        assert_eq!(judge("https://aizhs.top/", &open).enforcement, Enforcement::Advisory);
    }

    /// F-105:全局档位是 advisory(未设 / 显式 0)时,`default-deny` 仍必须被 `guard` 拒绝。
    #[test]
    fn e15_default_deny_is_refused_even_when_the_global_knob_is_advisory() {
        for enforce in [None, Some("0")] {
            let policy = policy_from(Some("keep.example"), None, Some("deny"), enforce);
            assert_eq!(policy.enforcement, Enforcement::Advisory, "全局档位仍是 advisory");
            let v = judge("https://anything.else/path", &policy);
            assert_eq!(v.reason, "default-deny");
            assert_eq!(v.enforcement, Enforcement::Enforce, "default-deny 必须按 Enforce 结算");
            let refused = enforced_refusal(&v);
            assert!(refused.is_some(), "advisory 全局档下 default-deny 仍必须被拦: {v:?}");
            assert!(refused.unwrap().contains("default-deny"));
        }
    }

    /// F-105:同上,`internal-range`(内网 IP 段)在 advisory 全局档下也必须被拦。
    #[test]
    fn e16_internal_range_is_refused_even_when_the_global_knob_is_advisory() {
        for enforce in [None, Some("0")] {
            let policy = policy_from(None, None, None, enforce);
            assert_eq!(policy.enforcement, Enforcement::Advisory, "全局档位仍是 advisory");
            for host in ["127.0.0.1", "10.0.0.5", "169.254.169.254", "::1"] {
                let v = judge(host, &policy);
                assert_eq!(v.decision, Decision::Deny, "{host}: {v:?}");
                assert_eq!(v.reason, "internal-range", "{host}");
                assert_eq!(v.enforcement, Enforcement::Enforce, "{host} 必须按 Enforce 结算");
                assert!(enforced_refusal(&v).is_some(), "{host} 在 advisory 下仍必须被拦");
            }
        }
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
