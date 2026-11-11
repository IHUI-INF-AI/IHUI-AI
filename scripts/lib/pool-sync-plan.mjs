// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *
 * 元数据优先从 `__sync` 命名空间取(导出器把 uid/owner/updatedAt/enabled 放这里,
 * 避免污染平台原生载荷);旧简化形状没有 __sync 时回退到顶层字段,向后兼容。
 */
export function normalizeSyncAccount(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const sync = src.__sync && typeof src.__sync === 'object' ? src.__sync : {}
  const ownerRaw = sync.ownerUserId !== undefined ? sync.ownerUserId : src.ownerUserId
  const owner = typeof ownerRaw === 'string' && ownerRaw.trim() ? ownerRaw.trim() : null
  const enabledRaw = sync.enabled !== undefined ? sync.enabled : src.enabled
  // 幂等:传进来的可能已经是本函数的产物(plan → groupForImport 链路),此时载荷在 .payload 里
  const payload =
    src.__normalized === true && src.payload && typeof src.payload === 'object' ? src.payload : src
  return {
    __normalized: true,
    ownerUserId: owner,
    providerCode: String(sync.providerCode ?? src.providerCode ?? '').trim(),
    uid: String(sync.uid ?? src.uid ?? '').trim(),
    name: src.name == null ? '' : String(src.name),
    enabled: enabledRaw !== false,
    tokenExpiresAt: typeof src.tokenExpiresAt === 'string' ? src.tokenExpiresAt : '',
    updatedAt: String(sync.updatedAt ?? src.updatedAt ?? ''),
    /** 原始载荷(含平台原生字段),指纹与落库都以它为准。 */
    payload,
  }
}

/** 稳定序列化:键排序,保证同一份内容在任何键序下得到同一哈希。 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

/**
 * 剥掉"展示类 / 易变"字段:这些键不参与指纹。
 *
 * 立因(2026-11-11 实测教训):第一版用整载荷哈希,结果两端 name 不同(name 是展示名,
 * 导入器有"只接受权威名"的保护,不会无条件覆盖)⇒ 每轮都判定"内容不同"→ 无限乒乓。
 * 同步只该传播**凭证与业务状态**,展示名各自保留更合适。
 */
function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      // 展示名(导入器有"只接受权威名"保护,不会无条件覆盖,纳入必然乒乓)
      // + 同步元数据(时间/归属/平台已在键里,纳入会让每轮都判"不同")
      if (/^(name|displayName|nickname|label|remark|note|updatedAt|ownerUserId|providerCode|__sync)$/i.test(k)) continue
      out[k] = stripVolatile(v)
    }
    return out
  }
  return value
}

/**
 * 凭证指纹 =
 *   ① 有 `__sync.core`(2026-11-11 起的导出)⇒ 业务核心四元组哈希:
 *      token / refreshToken / tokenExpiresAt / enabled;
 *   ② 没有 core(旧简化形状)⇒ 整载荷稳定哈希(剥掉展示名与同步元数据)兜底。
 *
 * 为什么不用整载荷哈希:平台原生载荷含 sourcePath / region / rawCredentials 这类
 * **本机环境字段**,两端天然不同 ⇒ 会把"其实一致"判成冲突(2026-11-11 实测一致数归零,
 * 每轮全量互推)。号池的实质是"凭证能不能用",四元组就是它的最小充分表示。
 *
 * 已知取舍:secrets 里非凭证类的附属材料(设备密钥、会话模板)变更不参与指纹,
 * 因此不会被自动同步;需要时人工重导覆盖(见 docs/engineering/account-pool-cross-env-sync.md)。
 */
export function credentialFingerprint(account) {
  const raw =
    account && typeof account === 'object' && account.payload ? account.payload : account
  const src = raw && typeof raw === 'object' ? raw : {}
  const meta = src.__sync && typeof src.__sync === 'object' ? src.__sync : {}
  const enabledBit = (meta.enabled !== undefined ? meta.enabled : src.enabled) !== false ? 1 : 0
  const core = meta.core && typeof meta.core === 'object' ? meta.core : null
  if (core) {
    return createHash('sha256')
      .update(
        stableStringify([
          String(core.token ?? ''),
          String(core.refreshToken ?? ''),
          String(core.tokenExpiresAt ?? ''),
          enabledBit,
        ]),
      )
      .digest('hex')
      .slice(0, 16)
  }
  const { __sync: _ignored, ...rest } = src
  void _ignored
  return createHash('sha256')
    .update(`${stableStringify(stripVolatile(rest))}|enabled:${enabledBit}`)
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
    const raw = item && typeof item === 'object' && item.account ? item.account : item
    const a = normalizeSyncAccount(raw)
    const bucketKey = `${a.ownerUserId ?? OPS_OWNER}|${a.providerCode}`
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { ownerUserId: a.ownerUserId, providerCode: a.providerCode, accounts: [] })
    }
    // 落库载荷必须是**平台原生载荷**(normalize 把它保在 payload 里),不能是归一化后的
    // 元数据对象 —— 否则导入器会看到 {uid,name,payload:{accessToken}} 而报"缺少 accessToken"
    // (2026-11-11 实测:minimax/doubao/codearts/zcode/loomy 八条因此全被拒收)。
    const src = a.payload && typeof a.payload === 'object' ? a.payload : raw
    const {
      __sync: _dropSync,
      __normalized: _dropMarker,
      updatedAt: _dropUpdatedAt,
      ownerUserId: _dropOwner,
      providerCode: _dropProvider,
      ...native
    } = src && typeof src === 'object' ? src : {}
    void _dropSync
    void _dropMarker
    void _dropUpdatedAt
    void _dropOwner
    void _dropProvider
    buckets.get(bucketKey).accounts.push(native)
  }
  return [...buckets.values()]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
