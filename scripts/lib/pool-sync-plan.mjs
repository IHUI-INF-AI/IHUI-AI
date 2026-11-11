/**
 * 号池跨环境同步的**决策核心**(2026-11-11 立,纯函数、零 IO、可单测)。
 *
 * 背景:号池有 18 条写入口(Web 加号 / 管理员导入 / Trae·Qoder·MiniMax 会话自动回灌 /
 * 签到侧凭证回写 / 巡检换票 / 个人池改名启停删除…),其中绝大多数只落**本进程连的那一个库**。
 * 逐个入口挂跨环境同步既漏又重 ⇒ 采用「两端快照 + 收敛式对账」:任何入口产生的净结果
 * 都会被下一轮同步收敛到两端,新增入口无需再改同步代码。
 *
 * 决策规则(全部可解释、无隐藏状态):
 *   1. 键 = `ownerUserId|providerCode|uid` —— 归属参与键,个人池与运营池同 uid 互不干扰;
 *   2. 仅一侧有 → 复制到另一侧(补缺,这是「我在任何一端加号,另一端自动有」的主路径);
 *   3. 两侧都有 + **凭证指纹相同** → 跳过(绝不空写:importAccounts 的覆盖分支会无条件
 *      bump credVersion,空写会污染签到侧 CAS 基准,见 relay-account-pool-service.ts);
 *   4. 两侧都有 + 指纹不同 → `updatedAt` 较新者胜;时间相等保留本地(方向优先级:
 *      本地是机主操作现场,平局时它的意图更可信);
 *   5. **删除不传播** —— 跨环境删号是破坏性动作,收益远小于误删风险;需要清理时走人工
 *      `--prune` 显式执行,本引擎永不自动删。
 *   6. **删除不复活** —— 「仅生产有、本地没有」有两种可能:另一端新加的号,或本端刚删掉的号。
 *      没有墓碑就无法区分 ⇒ 只把 `updatedAt` 落在拉回窗口(默认 7 天)内的行当"新增"拉回;
 *      更老的缺失一律记为 `staleMissingLocal` 只报告、不复活(否则删号永远删不掉)。
 *
 * 指纹只覆盖「会改变上游行为」的字段(token / refreshToken / enabled / tokenExpiresAt);
 * `name` 是展示名,两端可能各自更"好看"(手机号 vs uid),不纳入指纹以免每轮互相覆盖。
 */

import { createHash } from 'node:crypto'

/** 归属空值的稳定标记(不能直接用 '' 或 null 拼键,后者会与 'null' 字符串撞车)。 */
export const OPS_OWNER = 'ops'
/** 「仅对端有」的行默认只在 7 天内视为新增;更老的缺失当作本端已删除,不复活。 */
export const DEFAULT_PULL_WINDOW_DAYS = 7

/**
 * 归一化一条账号到同步比较用的最小充分形状。
 * 缺失/类型不符的字段一律降级为安全默认值,绝不 throw —— 同步器遇到脏行应继续处理其余行。
 */
export function normalizeSyncAccount(raw) {
  const ownerRaw = raw?.ownerUserId
  const owner =
    typeof ownerRaw === 'string' && ownerRaw.trim() ? ownerRaw.trim() : null
  return {
    ownerUserId: owner,
    providerCode: String(raw?.providerCode ?? '').trim(),
    uid: String(raw?.uid ?? '').trim(),
    name: raw?.name == null ? '' : String(raw.name),
    token: typeof raw?.token === 'string' ? raw.token : '',
    refreshToken:
      typeof raw?.refreshToken === 'string' && raw.refreshToken ? raw.refreshToken : '',
    enabled: raw?.enabled !== false,
    tokenExpiresAt: typeof raw?.tokenExpiresAt === 'string' ? raw.tokenExpiresAt : '',
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : '',
  }
}

/**
 * 凭证指纹:只覆盖"会导致上游行为变化"的字段。
 * 用 sha256 截 16 位即可 —— 这是去重判据,不是安全边界。
 */
export function credentialFingerprint(account) {
  const a = normalizeSyncAccount(account)
  return createHash('sha256')
    .update(JSON.stringify([a.token, a.refreshToken, a.enabled ? 1 : 0, a.tokenExpiresAt]))
    .digest('hex')
    .slice(0, 16)
}

/** 同步键:归属 + 平台 + uid 三元组。 */
export function accountSyncKey(account) {
  const a = normalizeSyncAccount(account)
  return `${a.ownerUserId ?? OPS_OWNER}|${a.providerCode}|${a.uid}`
}

function parseTime(text) {
  if (!text) return 0
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * 计算两端差异,产出待推送/待拉回两份清单。
 *
 * @param {{local?: unknown[], prod?: unknown[], providers?: string[]|null,
 *          pullWindowDays?: number, nowMs?: number}} input
 *   local/prod = 已归一化或原始形状的账号数组(每项须自带 providerCode),
 *   providers = 限定只同步这些平台(null/空 = 全部),
 *   pullWindowDays = 「仅生产有」视为新增的时效窗口(缺省 7 天),
 *   nowMs = 当前时刻(测试注入,缺省 Date.now())。
 * @returns {{
 *   toPush: Array<{account: object, key: string, reason: string}>,
 *   toPull: Array<{account: object, key: string, reason: string}>,
 *   unchanged: Array<{key: string, providerCode: string, uid: string}>,
 *   conflicts: Array<{key: string, providerCode: string, uid: string, winner: 'local'|'prod', deltaMs: number}>,
 *   staleMissingLocal: Array<{key: string, providerCode: string, uid: string, updatedAt: string}>,
 *   stats: {localTotal: number, prodTotal: number, toPush: number, toPull: number,
 *           unchanged: number, conflicts: number, staleMissingLocal: number},
 * }}
 */
export function planPoolSync({
  local = [],
  prod = [],
  providers = null,
  pullWindowDays = DEFAULT_PULL_WINDOW_DAYS,
  nowMs = Date.now(),
} = {}) {
  const allow = Array.isArray(providers) && providers.length > 0 ? new Set(providers) : null
  const mapLocal = new Map()
  const mapProd = new Map()

  const index = (list, map) => {
    for (const raw of list) {
      const a = normalizeSyncAccount(raw)
      if (!a.uid || !a.providerCode) continue
      if (allow && !allow.has(a.providerCode)) continue
      map.set(accountSyncKey(a), a)
    }
  }
  index(local, mapLocal)
  index(prod, mapProd)

  const toPush = []
  const toPull = []
  const unchanged = []
  const conflicts = []
  const staleMissingLocal = []
  const windowMs = Math.max(0, Number(pullWindowDays) || 0) * 86_400_000
  const keys = new Set([...mapLocal.keys(), ...mapProd.keys()])

  for (const key of keys) {
    const l = mapLocal.get(key)
    const p = mapProd.get(key)
    const providerCode = (l ?? p).providerCode
    const uid = (l ?? p).uid

    if (l && !p) {
      toPush.push({ account: l, key, reason: 'missing-in-prod' })
      continue
    }
    if (!l && p) {
      // 没有墓碑就无法区分「生产新增」与「本地已删」:只把窗口内的当新增拉回,
      // 更老的缺失一律记 stale(报告可见、不复活),否则删号会被另一端永久拉回来。
      const tp = parseTime(p.updatedAt)
      const isFresh = tp === 0 || nowMs - tp <= windowMs
      if (isFresh) {
        toPull.push({ account: p, key, reason: 'missing-in-local' })
      } else {
        staleMissingLocal.push({ key, providerCode, uid, updatedAt: p.updatedAt })
      }
      continue
    }

    // 两侧都存在:先比凭证指纹,相同即跳过(这是防止同步风暴的关键)
    if (credentialFingerprint(l) === credentialFingerprint(p)) {
      unchanged.push({ key, providerCode, uid })
      continue
    }

    const tl = parseTime(l.updatedAt)
    const tp = parseTime(p.updatedAt)
    if (tl > tp) {
      toPush.push({ account: l, key, reason: 'newer-local' })
      conflicts.push({ key, providerCode, uid, winner: 'local', deltaMs: tl - tp })
    } else if (tp > tl) {
      toPull.push({ account: p, key, reason: 'newer-prod' })
      conflicts.push({ key, providerCode, uid, winner: 'prod', deltaMs: tp - tl })
    } else {
      // 时间相等(含两端都没有 updatedAt 的旧数据):保留本地,不来回翻烧饼
      toPush.push({ account: l, key, reason: 'tie-keep-local' })
      conflicts.push({ key, providerCode, uid, winner: 'local', deltaMs: 0 })
    }
  }

  return {
    toPush,
    toPull,
    unchanged,
    conflicts,
    staleMissingLocal,
    stats: {
      localTotal: mapLocal.size,
      prodTotal: mapProd.size,
      toPush: toPush.length,
      toPull: toPull.length,
      unchanged: unchanged.length,
      conflicts: conflicts.length,
      staleMissingLocal: staleMissingLocal.length,
    },
  }
}

/**
 * 把待落库清单按「归属 → 平台」两级分组,产出导入器能直接吃的批次。
 * 分组原因:导入器一次只接受一个 owner + 一个 providerCode,混批会把归属串台。
 *
 * @param {Array<{account: object}>} items
 * @returns {Array<{ownerUserId: string|null, providerCode: string, accounts: object[]}>}
 */
export function groupForImport(items) {
  const buckets = new Map()
  for (const item of items) {
    const a = normalizeSyncAccount(item.account ?? item)
    const bucketKey = `${a.ownerUserId ?? OPS_OWNER}|${a.providerCode}`
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { ownerUserId: a.ownerUserId, providerCode: a.providerCode, accounts: [] })
    }
    // 剥掉同步元字段:updatedAt 不是导入字段,留着会进 extraMetadata 污染行;
    // ownerUserId 由命令行显式传(否则归属判定会走另一条路径)。
    const { updatedAt: _dropUpdatedAt, ownerUserId: _dropOwner, ...rest } = a
    void _dropUpdatedAt
    void _dropOwner
    buckets.get(bucketKey).accounts.push(rest)
  }
  return [...buckets.values()]
}
