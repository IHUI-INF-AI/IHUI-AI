// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 边缘层同步的**纯判据**(零 IO、零网络),执行层在 scripts/security/sync-edge-blocklist.mjs。
//
// 语义取舍(写在代码里,避免以后被人"顺手"改成全量推):
//   边缘 drop 之后,这个 IP 连告知页都看不到,也就不会再产生新的证据编号。
//   所以只推「已经取过证」的条目 —— bannedAt 至少早于 now 一个最小年龄(默认 10 分钟,
//   正好一个 autoban tick):首犯仍由源站拦下、返回告知页、编号入链;惯犯才在边缘丢掉。
//   改成全量推 = 把还没进过链的新 IP 直接丢在边缘,那次攻击将没有任何编号。
//
// 为什么一条规则塞多个 IP:EO 套餐对**规则条数**有上限(实测 41 条规则报
// LimitExceeded.Security),而 MatchContent 官方支持多值(英文逗号分隔)。
// 把 N 个 IP 合进一条规则,条数从 N 降到 ceil(N/perRule),额度立刻够用;
// 代价是没法按 IP 精确摘单条 —— 但本同步器每轮全量重建,本来就不需要摘单条。

export const EDGE_RULE_PREFIX = 'ihui-edge-ban-'
export const EDGE_DEFAULT_MIN_AGE_MS = 10 * 60 * 1000
export const EDGE_DEFAULT_PER_RULE = 20

export const SYNC_STATE = {
  OK: 'ok',
  DRIFT: 'drift',
  NOOP: 'noop',
  UNDETERMINED: 'undetermined',
}

/** 规则名只用 [0-9a-zA-Z-]:EdgeOne 的 RuleName 会回显在控制台,含点号易被误读。 */
export function edgeRuleNameFor(ip) {
  return EDGE_RULE_PREFIX + String(ip ?? '').trim().replace(/[^0-9a-zA-Z]/g, '-')
}

/** 本同步器拥有的规则(凭 RuleName 前缀认领,不按 IP —— 别人手工建的规则一条都不许动)。 */
export function isOurRule(rule) {
  return String(rule?.RuleName ?? '').startsWith(EDGE_RULE_PREFIX)
}

/**
 * 从 blocklist entries 挑出该推到边缘的 IP。
 * 五道门逐一落 count,便于运维看清"为什么只推了 N 条"。
 */
export function selectEdgeTargets(entries, {
  now = Date.now(),
  minAgeMs = EDGE_DEFAULT_MIN_AGE_MS,
  allowlist = [],
  infra = new Set(),
} = {}) {
  const allow = new Set((allowlist ?? []).map((x) => String(x).trim()))
  const guard = infra instanceof Set ? infra : new Set(infra ?? [])
  const skipped = { allowlisted: 0, infra: 0, noExpiry: 0, expired: 0, tooFresh: 0, tooFreshIps: [] }
  const out = []
  for (const [key, e] of Object.entries(entries ?? {})) {
    if (!e || typeof e !== 'object') continue
    const ip = String(e.ip ?? key).trim()
    if (!ip) continue
    if (allow.has(ip)) {
      skipped.allowlisted += 1
      continue
    }
    if (guard.has(ip)) {
      skipped.infra += 1
      continue
    }
    const expires = e.expiresAt ? Date.parse(e.expiresAt) : Number.NaN
    if (!Number.isFinite(expires)) {
      skipped.noExpiry += 1
      continue
    }
    if (expires <= now) {
      skipped.expired += 1
      continue
    }
    const bannedAt = e.bannedAt ? Date.parse(e.bannedAt) : Number.NaN
    if (Number.isFinite(bannedAt) && now - bannedAt < minAgeMs) {
      skipped.tooFresh += 1
      // 冷却期只是"还不到推边缘的时候",它已经被防火墙封住 —— 对账要据此区分
      // "边缘还差一个" 与 "本机漏封一个",所以必须把 IP 名字一起带出来,不能只报个数。
      skipped.tooFreshIps.push(ip)
      continue
    }
    out.push({ ip, expiresAt: new Date(expires).toISOString(), ruleName: edgeRuleNameFor(ip) })
  }
  out.sort((a, b) => a.ip.localeCompare(b.ip))
  return { targets: out, skipped }
}

/** 一条规则承载一个 IP(对照形态,单测与按 IP 摘单条时用)。 */
export function buildRules(targets) {
  return (targets ?? []).map((t) => ({
    Action: 'drop',
    MatchFrom: 'ip',
    Operator: 'match',
    MatchContent: String(t.ip),
    RuleName: t.ruleName ?? edgeRuleNameFor(t.ip),
    Status: 'on',
  }))
}

/**
 * 一条规则承载 perRule 个 IP(生产用)。IP 已排序,所以分批结果是确定的,
 * 同样的名单每轮生成同样的规则名,不会因为顺序抖动而每轮全量改写。
 */
export function buildBatchedRules(targets, perRule = EDGE_DEFAULT_PER_RULE) {
  const size = Math.max(1, Math.floor(Number(perRule) || 1))
  const ips = (targets ?? []).map((t) => String(t.ip ?? t).trim()).filter(Boolean).sort()
  const rules = []
  for (let i = 0; i < ips.length; i += size) {
    const chunk = ips.slice(i, i + size)
    rules.push({
      Action: 'drop',
      MatchFrom: 'ip',
      Operator: 'match',
      MatchContent: chunk.join(','),
      RuleName: `${EDGE_RULE_PREFIX}b${rules.length + 1}`,
      Status: 'on',
    })
  }
  return rules
}

/** 从一条规则的 MatchContent 取出它承载的 IP 集合(官方支持英文逗号分隔多值)。 */
export function ipsOfRule(rule) {
  return String(rule?.MatchContent ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * 合并:他人的规则原样保留在前,我们的规则重建在后。
 * 顺序固定,这样 diff 与留痕可复现。
 */
export function mergeRules(existing, desired) {
  const all = existing ?? []
  const foreign = all.filter((r) => !isOurRule(r))
  const oursOld = all.filter((r) => isOurRule(r))
  return { rules: [...foreign, ...(desired ?? [])], foreign, oursOld }
}

/**
 * 差集:按**展开后的 IP 集合**比,不按规则条数比 ——
 * 分批大小一变(比如把 perRule 从 20 调到 25),规则条数会变但 IP 没变,
 * 那不该被判成"改了 41 个 IP"。
 */
export function diffRules(existing, next) {
  const flatten = (rules) => {
    const out = new Set()
    for (const r of rules ?? []) for (const ip of ipsOfRule(r)) out.add(ip)
    return out
  }
  const oldSet = flatten(existing)
  const newSet = flatten(next)
  const added = [...newSet].filter((x) => !oldSet.has(x)).sort()
  const removed = [...oldSet].filter((x) => !newSet.has(x)).sort()
  return { added, removed, unchanged: [...newSet].filter((x) => oldSet.has(x)).length }
}

/**
 * 写后复核的三条硬判据。
 * 没判的维度单独点出来(modeUnjudged),不与"判过且通过"混为一谈。
 */
export function judgeSync({
  targets = [],
  existingForeign = [],
  actualRules = [],
  wafModeBefore,
  wafModeAfter,
} = {}) {
  const wantIps = new Set((targets ?? []).map((t) => String(t.ip ?? t).trim()).filter(Boolean))
  const actual = actualRules ?? []
  const actualIps = new Set()
  for (const r of actual) for (const ip of ipsOfRule(r)) actualIps.add(ip)
  const missing = [...wantIps].filter((ip) => !actualIps.has(ip)).sort()
  const foreignLost = (existingForeign ?? []).filter((r) => {
    const name = String(r.RuleName ?? '')
    return !actual.some((a) => String(a.RuleName ?? '') === name)
  })
  const modeComparable = typeof wafModeBefore === 'string' && typeof wafModeAfter === 'string'
  const modeChanged = modeComparable && wafModeBefore !== wafModeAfter
  const state = missing.length || foreignLost.length || modeChanged ? SYNC_STATE.DRIFT : SYNC_STATE.OK
  return {
    state,
    missing,
    foreignLost,
    modeChanged,
    modeUnjudged: !modeComparable,
    wantCount: wantIps.size,
    actualCount: actualIps.size,
  }
}

export const __test__ = {
  edgeRuleNameFor,
  isOurRule,
  selectEdgeTargets,
  buildRules,
  buildBatchedRules,
  ipsOfRule,
  mergeRules,
  diffRules,
  judgeSync,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
