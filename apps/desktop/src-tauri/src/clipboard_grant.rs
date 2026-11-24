// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 剪贴板「一次性读取令牌」(2026-11-23 立 B3-06)。
//!
//! 来由(五程序原生取证 B3-06):取证件读剪贴板走"先发一次性票据、凭票读一次"的形态 ——
//! 读到的凭据不会被同一次会话里的后台循环反复重读。本仓 `clipboard_get` 是**无状态直读**:
//! 任何一处拿到命令权限的代码都能无限次重读剪贴板(用户复制过的密码/token 一直在里面)。
//!
//! 本模块只做**票据这一层**,不做"要不要允许读"的闸(那条闸仍是 `require_computer_control`,
//! 单一真相源不动)。票据语义四条:
//!   ① 一次性:同票第二次消费 ⇒ `AlreadyConsumed`(fail-closed,不给"再读一点"的缝隙);
//!   ② 有时限:到点即过期(`expires_at_ms <= now` 判 `Expired`,边界不算有效);
//!   ③ 有界:未消费票据最多 `MAX_PENDING_GRANTS` 张,超出先丢**最早到期**的一张(不无限涨);
//!   ④ 不认识就拒:未知票据 ⇒ `Unknown`,不猜成"没发过所以放行"。
//!
//! 诚实边界:token 只为"同一进程内的票据对齐",不是跨进程安全边界 —— 真正的准入是
//! `require_computer_control` 与操作系统剪贴板权限。

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

/// 票据有效期:30 秒。够"读一次并回填",又短到不覆盖一整轮对话。
pub const GRANT_TTL_MS: u64 = 30_000;

/// 未消费票据上限。超过即丢最早到期的一张(有界优先,与"任意时刻都能发新票"不冲突)。
pub const MAX_PENDING_GRANTS: usize = 8;

/// 消费裁决四态(封闭集;调用方据此给错误码,不自己造字符串)。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GrantVerdict {
    /// 首次消费:放行读剪贴板。
    Ok,
    /// 票据不存在(从未发放 / 已过期回收 / 已被有界淘汰)。
    Unknown,
    /// 票据到点(`now >= expires_at_ms`)。
    Expired,
    /// 已经消费过一次 —— 二次消费即拒。
    AlreadyConsumed,
}

impl GrantVerdict {
    /// 错误码(ASCII,前端/日志直接可判)。
    pub fn code(self) -> &'static str {
        match self {
            GrantVerdict::Ok => "ok",
            GrantVerdict::Unknown => "grant-unknown",
            GrantVerdict::Expired => "grant-expired",
            GrantVerdict::AlreadyConsumed => "grant-consumed",
        }
    }
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrantIssue {
    pub token: String,
    pub expires_at_ms: u64,
}

#[derive(Clone, Copy, Debug)]
struct GrantEntry {
    expires_at_ms: u64,
    consumed: bool,
}

/// 票据库(进程内单例)。`Mutex` 而非 `RwLock` —— 消费是写操作,读面只有计数。
pub struct GrantStore {
    entries: Mutex<HashMap<String, GrantEntry>>,
    counter: AtomicU64,
}

impl Default for GrantStore {
    fn default() -> Self {
        GrantStore {
            entries: Mutex::new(HashMap::new()),
            counter: AtomicU64::new(0),
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl GrantStore {
    /// 发一张票据。先回收过期项,再按"有界"淘汰最早到期的一张。
    pub fn issue(&self, now_ms: u64) -> GrantIssue {
        let seq = self.counter.fetch_add(1, Ordering::Relaxed) + 1;
        let token = format!("g{now_ms}-{seq}");
        let expires_at_ms = now_ms.saturating_add(GRANT_TTL_MS);
        let mut map = lock(&self.entries);
        map.retain(|_, entry| entry.expires_at_ms > now_ms);
        if map.len() >= MAX_PENDING_GRANTS {
            if let Some(earliest) = map
                .iter()
                .min_by_key(|(_, entry)| entry.expires_at_ms)
                .map(|(token, _)| token.clone())
            {
                map.remove(&earliest);
            }
        }
        map.insert(
            token.clone(),
            GrantEntry {
                expires_at_ms,
                consumed: false,
            },
        );
        GrantIssue {
            token,
            expires_at_ms,
        }
    }

    /// 消费一张票据:成功即标记已消费(同票第二次必拒)。
    pub fn consume(&self, token: &str, now_ms: u64) -> GrantVerdict {
        let mut map = lock(&self.entries);
        let verdict = match map.get(token) {
            None => GrantVerdict::Unknown,
            Some(entry) => classify_grant(true, entry.consumed, entry.expires_at_ms, now_ms),
        };
        if verdict == GrantVerdict::Ok {
            if let Some(entry) = map.get_mut(token) {
                entry.consumed = true;
            }
        }
        verdict
    }

    /// 现读未消费票据数(测试与诊断用;不做判据)。
    pub fn pending(&self, now_ms: u64) -> usize {
        let map = lock(&self.entries);
        map.values()
            .filter(|entry| !entry.consumed && entry.expires_at_ms > now_ms)
            .count()
    }

    /// 回收过期票据,返回回收数。
    pub fn purge(&self, now_ms: u64) -> usize {
        let mut map = lock(&self.entries);
        let before = map.len();
        map.retain(|_, entry| entry.expires_at_ms > now_ms);
        before - map.len()
    }
}

/// 纯判据:票据是否存在 × 是否已消费 × 是否过期 → 四态裁决。
///
/// 判序是 **存在性 → 已消费 → 过期**:已消费的票即使已过期也报"已消费"
/// (调用方要区分"这张票你用过"与"这张票过期了"),未知票不给任何"可能有效"的余地。
pub fn classify_grant(
    present: bool,
    consumed: bool,
    expires_at_ms: u64,
    now_ms: u64,
) -> GrantVerdict {
    if !present {
        return GrantVerdict::Unknown;
    }
    if consumed {
        return GrantVerdict::AlreadyConsumed;
    }
    if expires_at_ms <= now_ms {
        return GrantVerdict::Expired;
    }
    GrantVerdict::Ok
}

/// 进程内单例(命令层唯一入口;测试自建 `GrantStore` 实例,不污染单例)。
pub fn store() -> &'static GrantStore {
    static STORE: OnceLock<GrantStore> = OnceLock::new();
    STORE.get_or_init(GrantStore::default)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_carries_expiry_derived_from_ttl() {
        let store = GrantStore::default();
        let issue = store.issue(1_000);
        assert_eq!(issue.expires_at_ms, 1_000 + GRANT_TTL_MS);
        assert!(!issue.token.is_empty());
    }

    #[test]
    fn first_consume_is_ok() {
        let store = GrantStore::default();
        let issue = store.issue(1_000);
        assert_eq!(store.consume(&issue.token, 1_001), GrantVerdict::Ok);
    }

    #[test]
    fn second_consume_is_rejected() {
        let store = GrantStore::default();
        let issue = store.issue(1_000);
        assert_eq!(store.consume(&issue.token, 1_001), GrantVerdict::Ok);
        assert_eq!(
            store.consume(&issue.token, 1_002),
            GrantVerdict::AlreadyConsumed
        );
    }

    #[test]
    fn unknown_token_is_not_a_pass() {
        let store = GrantStore::default();
        assert_eq!(store.consume("never-issued", 1_000), GrantVerdict::Unknown);
    }

    #[test]
    fn expiry_boundary_is_expired_not_ok() {
        let store = GrantStore::default();
        let issue = store.issue(1_000);
        assert_eq!(
            store.consume(&issue.token, issue.expires_at_ms),
            GrantVerdict::Expired,
            "到点即过期,边界不得算有效"
        );
        assert_eq!(
            store.consume(&issue.token, issue.expires_at_ms - 1),
            GrantVerdict::Ok
        );
    }

    #[test]
    fn tokens_are_independent() {
        let store = GrantStore::default();
        let first = store.issue(1_000);
        let second = store.issue(1_000);
        assert_ne!(first.token, second.token);
        assert_eq!(store.consume(&first.token, 1_001), GrantVerdict::Ok);
        assert_eq!(store.consume(&second.token, 1_001), GrantVerdict::Ok);
    }

    #[test]
    fn pending_is_bounded_and_drops_earliest_expiry() {
        let store = GrantStore::default();
        let mut issued: Vec<GrantIssue> = Vec::new();
        for step in 0..(MAX_PENDING_GRANTS + 2) {
            issued.push(store.issue(1_000 + step as u64));
        }
        assert!(store.pending(1_000) <= MAX_PENDING_GRANTS);
        // 最早那两张已被淘汰 ⇒ 未知,不是"还能用"
        assert_eq!(
            store.consume(&issued[0].token, 1_001),
            GrantVerdict::Unknown
        );
        // 最新那张仍在
        let last = issued.last().unwrap();
        assert_eq!(store.consume(&last.token, 1_001), GrantVerdict::Ok);
    }

    #[test]
    fn purge_reclaims_expired_and_reports_count() {
        let store = GrantStore::default();
        // 同一时刻发两张:第二张 issue 时的过期回收不会提前清掉第一张
        store.issue(1_000);
        store.issue(1_000);
        let reclaimed = store.purge(1_000 + GRANT_TTL_MS + 1);
        assert_eq!(reclaimed, 2);
        assert_eq!(store.pending(1_000 + GRANT_TTL_MS + 1), 0);
    }

    #[test]
    fn classify_covers_all_four_verdicts() {
        assert_eq!(classify_grant(false, false, 10, 0), GrantVerdict::Unknown);
        assert_eq!(
            classify_grant(true, true, 10, 0),
            GrantVerdict::AlreadyConsumed,
            "已消费优先于过期:调用方要分清\"用过\"与\"过期\""
        );
        assert_eq!(classify_grant(true, false, 10, 10), GrantVerdict::Expired);
        assert_eq!(classify_grant(true, false, 10, 9), GrantVerdict::Ok);
    }

    #[test]
    fn concurrent_consume_of_same_token_yields_exactly_one_ok() {
        let store = GrantStore::default();
        let issue = store.issue(1_000);
        let ok_count = std::sync::atomic::AtomicUsize::new(0);
        std::thread::scope(|s| {
            for _ in 0..8 {
                s.spawn(|| {
                    if store.consume(&issue.token, 1_001) == GrantVerdict::Ok {
                        ok_count.fetch_add(1, Ordering::SeqCst);
                    }
                });
            }
        });
        assert_eq!(ok_count.load(Ordering::SeqCst), 1);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
