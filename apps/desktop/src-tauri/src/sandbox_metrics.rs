// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 沙箱出站拦截的只增计数埋点(纯观测,不改判定)。
//!
//! 来由(五程序原生取证 B2-10):对方的沙箱只报"拦了几次",放行与"只出声不拦"混在
//! 一个数里 —— 拦截数降了分不清"威胁变少"还是"规则没生效"。本模块把每次判定按
//! **四桶**记账,并把恒等式
//! `total == allow + deny_enforced + deny_advisory + unjudged`
//! 做成可断言的不变量:四桶对上 ⇒ `consistent`;对不上 ⇒ `drifted`(记账点漏接,
//! 不许静默);一次判定都没有 ⇒ `empty`(不是"零拦截",是没量到);计数器溢出/不可读
//! ⇒ `unjudged`。
//!
//! 纪律三条:
//! ① 只增不减,每桶独立 `AtomicU64`,不做"先读后写"复合(并发下会互相吃增量);
//! ② 判定语义零变化 —— 埋点挂在判定之后,拒绝与否仍由 `egress_gate::guard_egress_target`
//!    的 `enforced_refusal` 决定;
//! ③ 桶里只有计数,不留目标主机名(清单留痕仍归 egress_gate,一处一份)。

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

/// 判定桶:与 `egress_gate::Decision` × `Enforcement` 的组合一一对应。
///
/// 映射实现放在 `egress_gate` 侧(`bucket_for`)——依赖方向必须是"判据 → 埋点",
/// 反过来本模块 import 判据模块会成环。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EgressBucket {
    /// 放行(含 enforce 档下的 allow)。
    Allow,
    /// 判定拒绝且真的拒(deny + enforce):真正被拦下的请求数。
    DenyEnforced,
    /// 判定拒绝但只出声(deny + advisory):"保留"桶 —— 被放过去的必须与真拒绝分开计。
    DenyAdvisory,
    /// 判据给不出结论:既不是放行也不是拒绝。
    Unjudged,
}

static ALLOW: AtomicU64 = AtomicU64::new(0);
static DENY_ENFORCED: AtomicU64 = AtomicU64::new(0);
static DENY_ADVISORY: AtomicU64 = AtomicU64::new(0);
static UNJUDGED: AtomicU64 = AtomicU64::new(0);
static TOTAL: AtomicU64 = AtomicU64::new(0);

/// 记一次判定,返回该桶累计值(仅供日志;返回值不是判据)。
///
/// 顺序:先桶后总数。进程若死在两者之间,`total` 落后于桶和 ⇒ `drifted` 可见;
/// 反过来(total 先加)会把"桶和 > total"读成一致率更高的假象。
pub fn record(bucket: EgressBucket) -> u64 {
    let cell = match bucket {
        EgressBucket::Allow => &ALLOW,
        EgressBucket::DenyEnforced => &DENY_ENFORCED,
        EgressBucket::DenyAdvisory => &DENY_ADVISORY,
        EgressBucket::Unjudged => &UNJUDGED,
    };
    let value = cell.fetch_add(1, Ordering::Relaxed) + 1;
    TOTAL.fetch_add(1, Ordering::Relaxed);
    value
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EgressSnapshot {
    pub allow: u64,
    pub deny_enforced: u64,
    pub deny_advisory: u64,
    pub unjudged: u64,
    pub total: u64,
}

impl EgressSnapshot {
    /// 四桶和(以 u128 求,溢出不上卷成 0)。
    pub fn bucket_sum(&self) -> u128 {
        u128::from(self.allow)
            + u128::from(self.deny_enforced)
            + u128::from(self.deny_advisory)
            + u128::from(self.unjudged)
    }
}

/// 现读一份快照(各桶分别读,读的那一刻不是同一个时间点 —— 判据只看"是否对得上",
/// 不看"对不对得齐"。
pub fn snapshot() -> EgressSnapshot {
    EgressSnapshot {
        allow: ALLOW.load(Ordering::Relaxed),
        deny_enforced: DENY_ENFORCED.load(Ordering::Relaxed),
        deny_advisory: DENY_ADVISORY.load(Ordering::Relaxed),
        unjudged: UNJUDGED.load(Ordering::Relaxed),
        total: TOTAL.load(Ordering::Relaxed),
    }
}

/// 记账一致性四态(纯判据,夹具可枚举)。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Consistency {
    /// 四桶和 == total 且有过判定。
    Consistent,
    /// 四桶和 != total:埋点漏接或有第三方写坏。
    Drifted,
    /// total == 0:一次判定都没有 —— "没量到",不是"零拦截"。
    Empty,
    /// 计数器带溢出标记(任一桶或 total 达到 u64::MAX)。
    Unjudged,
}

/// 溢出标记:任何一维到顶都按未判定处理 —— 到顶之后的计数不再可信。
const OVERFLOW_MARK: u64 = u64::MAX;

pub fn classify_consistency(snap: &EgressSnapshot) -> Consistency {
    if snap.allow == OVERFLOW_MARK
        || snap.deny_enforced == OVERFLOW_MARK
        || snap.deny_advisory == OVERFLOW_MARK
        || snap.unjudged == OVERFLOW_MARK
        || snap.total == OVERFLOW_MARK
    {
        return Consistency::Unjudged;
    }
    if snap.total == 0 {
        return Consistency::Empty;
    }
    if snap.bucket_sum() == u128::from(snap.total) {
        Consistency::Consistent
    } else {
        Consistency::Drifted
    }
}

/// 一行 ASCII 读数(不折行;empty / unjudged 也逐字点名,不渲染成 0)。
pub fn render_line(snap: &EgressSnapshot) -> String {
    let state = match classify_consistency(snap) {
        Consistency::Consistent => "consistent",
        Consistency::Drifted => "drifted",
        Consistency::Empty => "empty",
        Consistency::Unjudged => "unjudged",
    };
    format!(
        "[sandbox-egress] state={state} total={} allow={} denyEnforced={} denyAdvisory={} unjudged={}",
        snap.total, snap.allow, snap.deny_enforced, snap.deny_advisory, snap.unjudged
    )
}

/// 命令层报告:快照 + 一致性四态字符串(前端不必再算一遍判据)。
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EgressMetricReport {
    pub allow: u64,
    pub deny_enforced: u64,
    pub deny_advisory: u64,
    pub unjudged: u64,
    pub total: u64,
    pub consistency: &'static str,
}

pub fn report() -> EgressMetricReport {
    let snap = snapshot();
    let consistency = match classify_consistency(&snap) {
        Consistency::Consistent => "consistent",
        Consistency::Drifted => "drifted",
        Consistency::Empty => "empty",
        Consistency::Unjudged => "unjudged",
    };
    EgressMetricReport {
        allow: snap.allow,
        deny_enforced: snap.deny_enforced,
        deny_advisory: snap.deny_advisory,
        unjudged: snap.unjudged,
        total: snap.total,
        consistency,
    }
}

// ---------------------------------------------------------------------------
// P3-03：双路审计事件队列（进程/文件类 + 网络类）
//
// 对照 `ReadAuditEvents` / `ReadNetworkAuditEvents` 两条平行导出。与上面的 egress
// 计数链并存：egress 只记桶计数，这里记可 drain 的事件摘要；两者互不改写。
// ---------------------------------------------------------------------------

/// 审计事件双路：进程/文件类 与 网络类 各一条队列。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuditChannel {
    /// 进程 / 文件类审计（对照 `ReadAuditEvents`）。
    Process,
    /// 网络类审计（对照 `ReadNetworkAuditEvents`）。
    Network,
}

/// 一条审计事件（类别 + 序号 + 摘要；不留主机名等清单明细，明细归 egress_gate）。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuditEvent {
    pub seq: u64,
    pub channel: AuditChannel,
    pub summary: String,
}

/// 单路队列有界容量；超出后丢最旧一条并记溢出计数（显式标记，不静默丢）。
const AUDIT_QUEUE_CAPACITY: usize = 256;

static PROCESS_AUDIT: Mutex<VecDeque<AuditEvent>> = Mutex::new(VecDeque::new());
static NETWORK_AUDIT: Mutex<VecDeque<AuditEvent>> = Mutex::new(VecDeque::new());
static PROCESS_SEQ: AtomicU64 = AtomicU64::new(0);
static NETWORK_SEQ: AtomicU64 = AtomicU64::new(0);
static PROCESS_DROPPED: AtomicU64 = AtomicU64::new(0);
static NETWORK_DROPPED: AtomicU64 = AtomicU64::new(0);

fn audit_queue(channel: AuditChannel) -> &'static Mutex<VecDeque<AuditEvent>> {
    match channel {
        AuditChannel::Process => &PROCESS_AUDIT,
        AuditChannel::Network => &NETWORK_AUDIT,
    }
}

fn audit_seq(channel: AuditChannel) -> &'static AtomicU64 {
    match channel {
        AuditChannel::Process => &PROCESS_SEQ,
        AuditChannel::Network => &NETWORK_SEQ,
    }
}

fn audit_dropped(channel: AuditChannel) -> &'static AtomicU64 {
    match channel {
        AuditChannel::Process => &PROCESS_DROPPED,
        AuditChannel::Network => &NETWORK_DROPPED,
    }
}

/// 记一条审计事件；队列满时丢最旧一条并记溢出计数（溢出可见，不静默丢弃）。
pub fn record_audit(channel: AuditChannel, summary: String) {
    let seq = audit_seq(channel).fetch_add(1, Ordering::Relaxed) + 1;
    let mut q = audit_queue(channel).lock().unwrap_or_else(|p| p.into_inner());
    if q.len() >= AUDIT_QUEUE_CAPACITY {
        q.pop_front();
        audit_dropped(channel).fetch_add(1, Ordering::Relaxed);
    }
    q.push_back(AuditEvent {
        seq,
        channel,
        summary,
    });
}

/// 取走一路全部事件并清空队列；重复 drain 不重复给（第二次返回空）。
pub fn drain_audit(channel: AuditChannel) -> Vec<AuditEvent> {
    let mut q = audit_queue(channel).lock().unwrap_or_else(|p| p.into_inner());
    std::mem::take(&mut *q).into_iter().collect()
}

/// 一路队列的只读快照（长度 / 容量 / 溢出丢弃数 / 是否溢出）。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuditQueueSnapshot {
    pub len: usize,
    pub capacity: usize,
    pub dropped_on_overflow: u64,
    pub overflowed: bool,
}

pub fn audit_snapshot(channel: AuditChannel) -> AuditQueueSnapshot {
    let q = audit_queue(channel).lock().unwrap_or_else(|p| p.into_inner());
    let dropped = audit_dropped(channel).load(Ordering::Relaxed);
    AuditQueueSnapshot {
        len: q.len(),
        capacity: AUDIT_QUEUE_CAPACITY,
        dropped_on_overflow: dropped,
        overflowed: dropped > 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 全局计数器在 lib 测试里是按进程共享的:凡断言"差值"的用例都拿这把锁,
    /// 否则并行跑的其他用例会插进增量(§0.3 的"没判不许冒充判过"在测试里同样成立)。
    fn test_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        LOCK.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn delta(before: EgressSnapshot, after: EgressSnapshot, bucket: EgressBucket) -> u64 {
        let pick = |s: EgressSnapshot| match bucket {
            EgressBucket::Allow => s.allow,
            EgressBucket::DenyEnforced => s.deny_enforced,
            EgressBucket::DenyAdvisory => s.deny_advisory,
            EgressBucket::Unjudged => s.unjudged,
        };
        pick(after).saturating_sub(pick(before))
    }

    #[test]
    fn record_allow_increments_bucket_and_total() {
        let _g = test_lock();
        let before = snapshot();
        record(EgressBucket::Allow);
        let after = snapshot();
        assert_eq!(delta(before, after, EgressBucket::Allow), 1);
        assert_eq!(after.total - before.total, 1);
    }

    #[test]
    fn record_keeps_deny_enforced_and_advisory_in_separate_buckets() {
        let _g = test_lock();
        let before = snapshot();
        record(EgressBucket::DenyEnforced);
        record(EgressBucket::DenyAdvisory);
        let after = snapshot();
        assert_eq!(delta(before, after, EgressBucket::DenyEnforced), 1);
        assert_eq!(delta(before, after, EgressBucket::DenyAdvisory), 1);
    }

    #[test]
    fn record_unjudged_is_its_own_bucket() {
        let _g = test_lock();
        let before = snapshot();
        record(EgressBucket::Unjudged);
        let after = snapshot();
        assert_eq!(delta(before, after, EgressBucket::Unjudged), 1);
        assert_eq!(delta(before, after, EgressBucket::Allow), 0);
    }

    #[test]
    fn live_counters_always_satisfy_identity() {
        let _g = test_lock();
        for bucket in [
            EgressBucket::Allow,
            EgressBucket::DenyEnforced,
            EgressBucket::DenyAdvisory,
            EgressBucket::Unjudged,
        ] {
            record(bucket);
        }
        let snap = snapshot();
        assert_eq!(
            classify_consistency(&snap),
            Consistency::Consistent,
            "{}",
            render_line(&snap)
        );
    }

    #[test]
    fn empty_is_not_reported_as_zero_interceptions() {
        let snap = EgressSnapshot {
            allow: 0,
            deny_enforced: 0,
            deny_advisory: 0,
            unjudged: 0,
            total: 0,
        };
        assert_eq!(classify_consistency(&snap), Consistency::Empty);
        assert!(render_line(&snap).contains("state=empty"));
    }

    #[test]
    fn exact_identity_is_consistent() {
        let snap = EgressSnapshot {
            allow: 3,
            deny_enforced: 2,
            deny_advisory: 1,
            unjudged: 0,
            total: 6,
        };
        assert_eq!(classify_consistency(&snap), Consistency::Consistent);
    }

    #[test]
    fn missing_record_is_drifted_not_consistent() {
        let snap = EgressSnapshot {
            allow: 3,
            deny_enforced: 2,
            deny_advisory: 1,
            unjudged: 0,
            total: 5,
        };
        assert_eq!(classify_consistency(&snap), Consistency::Drifted);
        assert!(render_line(&snap).contains("state=drifted"));
    }

    #[test]
    fn overflow_marker_is_unjudged() {
        let snap = EgressSnapshot {
            allow: OVERFLOW_MARK,
            deny_enforced: 0,
            deny_advisory: 0,
            unjudged: 0,
            total: 1,
        };
        assert_eq!(classify_consistency(&snap), Consistency::Unjudged);
    }

    #[test]
    fn bucket_sum_does_not_wrap_on_huge_values() {
        let snap = EgressSnapshot {
            allow: u64::MAX - 1,
            deny_enforced: u64::MAX - 1,
            deny_advisory: 0,
            unjudged: 0,
            total: 0,
        };
        assert!(snap.bucket_sum() > u128::from(u64::MAX));
    }

    #[test]
    fn concurrent_records_preserve_identity() {
        let _g = test_lock();
        let before = snapshot();
        let workers: u64 = 8;
        let per_worker: u64 = 500;
        std::thread::scope(|s| {
            for _ in 0..workers {
                s.spawn(|| {
                    for _ in 0..per_worker {
                        record(EgressBucket::Allow);
                        record(EgressBucket::DenyAdvisory);
                    }
                });
            }
        });
        let after = snapshot();
        let expected = workers * per_worker;
        assert_eq!(after.total - before.total, expected * 2);
        assert_eq!(delta(before, after, EgressBucket::Allow), expected);
        assert_eq!(delta(before, after, EgressBucket::DenyAdvisory), expected);
        assert_eq!(
            classify_consistency(&snapshot()),
            Consistency::Consistent,
            "并发后恒等式被破坏 ⇒ 记账有先读后写形态"
        );
    }

    #[test]
    fn render_line_never_contains_host_name() {
        let snap = EgressSnapshot {
            allow: 1,
            deny_enforced: 0,
            deny_advisory: 0,
            unjudged: 0,
            total: 1,
        };
        let line = render_line(&snap);
        assert!(line.starts_with("[sandbox-egress] state=consistent"));
        assert!(!line.contains("://"), "桶读数里不该有目标主机名: {line}");
    }

    #[test]
    fn audit_drain_takes_events_and_clears_queue() {
        let _g = test_lock();
        record_audit(AuditChannel::Process, "spawn cmd.exe".into());
        record_audit(AuditChannel::Process, "write tmp".into());
        let first = drain_audit(AuditChannel::Process);
        assert_eq!(first.len(), 2);
        assert!(
            drain_audit(AuditChannel::Process).is_empty(),
            "重复 drain 不重复给"
        );
    }

    #[test]
    fn audit_channels_are_independent() {
        let _g = test_lock();
        record_audit(AuditChannel::Process, "p".into());
        record_audit(AuditChannel::Network, "n".into());
        let p = drain_audit(AuditChannel::Process);
        let n = drain_audit(AuditChannel::Network);
        assert_eq!(p.len(), 1);
        assert_eq!(n.len(), 1);
        assert_eq!(p[0].channel, AuditChannel::Process);
        assert_eq!(n[0].channel, AuditChannel::Network);
    }

    #[test]
    fn audit_overflow_marks_dropped_and_bounds_len() {
        let _g = test_lock();
        for i in 0..(AUDIT_QUEUE_CAPACITY + 10) {
            record_audit(AuditChannel::Network, format!("ev-{i}"));
        }
        let snap = audit_snapshot(AuditChannel::Network);
        assert_eq!(snap.len, AUDIT_QUEUE_CAPACITY);
        assert!(snap.overflowed);
        assert_eq!(snap.dropped_on_overflow, 10);
        let drained = drain_audit(AuditChannel::Network);
        assert_eq!(drained.len(), AUDIT_QUEUE_CAPACITY);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
