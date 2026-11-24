// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本地服务发现的**认领件判据**(纯函数,零 `node:` 导入 —— shared 包非 Node 宿主纯度门)。
 *
 * 立因(goal-b49 Q1 取证,证据 `docs/benchmark-evidence/.../Q1-qoder-cn-main-bundle.md` #6/#12):
 * 对侧用"带心跳的认领件目录"做多实例服务发现 —— 扫 `clients/*.json`,读 `{id,port,pid,timestamp}`,
 * 30s 判陈旧、未来时刻容差 5s、`kill(pid,0)` 判活(EPERM 视为活)、非法记录即删。
 * 本仓此前只有固定端口的 HTTP/WS 服务,**没有任何"我是谁、我在哪个口"的具名认领件**。
 *
 * 超越轴(逐条有用例钉,不是口号):
 *  1. 三态而非两态 —— 字段缺失/非有限数一律 `unjudged` 并点名,**不折成"陈旧"**(§0.3:
 *     "没判"写成"判过"是本仓最高频失效型;把量不到当过期会静默驱逐活实例)。
 *  2. 代次交叉核验 —— 对方只看 pid 与时刻,任何人都能伪造一条 client 记录把扩展指向自己的口;
 *     本层要求"记录里的 generation 必须与实际应答端的 generation 一致",不一致即拒并给原因。
 *  3. 零静默丢弃 —— 每条被拒的记录都必须带 reason 逐条点名,而不是悄悄少几条。
 */

/** 一份认领件的最小契约。`timestamp` = 最后一次心跳(毫秒纪元),不是创建时刻。 */
export interface ServiceClaim {
  readonly id: string
  readonly port: number
  readonly pid: number
  readonly timestamp: number
  /** 本次进程实例的代次标识:与真实监听端自述的代次必须一致才算活 */
  readonly generation?: string
  readonly productVersion?: string
}

export type ClaimFreshness = 'fresh' | 'stale' | 'unjudged'
export type ClaimVerdict = 'usable' | 'rejected' | 'unusable-unjudged'

export interface ClaimCheckOptions {
  /** 心跳超过该时长判陈旧(与对侧同档,默认 30s) */
  readonly staleAfterMs?: number
  /** 允许的时刻超前量(时钟抖动;默认 5s) */
  readonly futureToleranceMs?: number
  /** 判活注入:EPERM 应视为"存活但无权"(对侧同一语义),ESRCH 才是已消亡 */
  readonly isPidAlive?: (pid: number) => boolean
  /** 实际监听端自述(用于代次交叉核验);返回 null = 探不到 */
  readonly probeEndpoint?: (port: number) => { generation?: string } | null
  readonly now?: number
}

const DEFAULT_STALE_AFTER_MS = 30_000
const DEFAULT_FUTURE_TOLERANCE_MS = 5_000

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 文件名判据:只认 `<id>.json` 且 id 限定安全字符集,别人的落物一律不碰。 */
export function isClaimFileName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.json$/.test(name)
}

export function claimIdFromFileName(name: string): string | null {
  return isClaimFileName(name) ? name.slice(0, -'.json'.length) : null
}

/**
 * 外部 JSON → ServiceClaim。任何一步不成立都返回 null 并给原因:
 * **不猜默认值**(缺 pid 不当 0、缺时刻不当"现在"),猜出来的记录会被当活实例用。
 */
export function parseServiceClaim(
  raw: unknown,
  fileNameId?: string,
): { claim: ServiceClaim } | { error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: '顶层不是对象' }
  }
  const rec = raw as Record<string, unknown>
  const id = typeof rec.id === 'string' && rec.id.length > 0 ? rec.id : fileNameId
  if (typeof id !== 'string' || id.length === 0) return { error: '缺 id 且文件名也没给' }
  if (!isFiniteNumber(rec.port)) return { error: `port 不是有限数字:${String(rec.port)}` }
  if (rec.port < 0 || rec.port > 65_535) return { error: `port 越界:${rec.port}` }
  if (!isFiniteNumber(rec.pid)) return { error: `pid 不是有限数字:${String(rec.pid)}` }
  if (!isFiniteNumber(rec.timestamp))
    return { error: `timestamp 不是有限数字:${String(rec.timestamp)}` }
  const claim: ServiceClaim = {
    id,
    port: rec.port,
    pid: rec.pid,
    timestamp: rec.timestamp,
    ...(typeof rec.generation === 'string' ? { generation: rec.generation } : {}),
    ...(typeof rec.productVersion === 'string' ? { productVersion: rec.productVersion } : {}),
  }
  return { claim }
}

/** 心跳新鲜度三态。陈旧与"判不了"是两回事,分不开就会静默驱逐活实例。 */
export function classifyClaimFreshness(
  claim: ServiceClaim,
  opts: ClaimCheckOptions = {},
): { state: ClaimFreshness; reason?: string } {
  const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
  const futureToleranceMs = opts.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS
  const now = opts.now ?? Date.now()
  if (!isFiniteNumber(claim.timestamp)) return { state: 'unjudged', reason: 'timestamp 非有限数' }
  if (!isFiniteNumber(now)) return { state: 'unjudged', reason: '当前时刻取不到' }
  const age = now - claim.timestamp
  if (age < -futureToleranceMs) {
    return {
      state: 'unjudged',
      reason: `心跳时刻超前 ${Math.abs(age)}ms(超容差 ${futureToleranceMs}ms),不判新鲜也不判陈旧`,
    }
  }
  if (age > staleAfterMs) return { state: 'stale', reason: `心跳已 ${age}ms > ${staleAfterMs}ms` }
  return { state: 'fresh' }
}

/**
 * 单条认领件的完整裁决。
 * 注入件缺席(`isPidAlive`/`probeEndpoint` 未给)时**不当作通过**,而是 unjudged ——
 * 判据缺输入就是没判,少一道核验不能被读成"那道核验没问题"。
 */
export function evaluateServiceClaim(
  claim: ServiceClaim,
  opts: ClaimCheckOptions = {},
): { verdict: ClaimVerdict; reason: string; port: number; id: string } {
  const fresh = classifyClaimFreshness(claim, opts)
  if (fresh.state === 'unjudged') {
    return {
      verdict: 'unusable-unjudged',
      reason: `未判定:${fresh.reason ?? ''}`,
      port: claim.port,
      id: claim.id,
    }
  }
  if (fresh.state === 'stale') {
    return {
      verdict: 'rejected',
      reason: `心跳陈旧:${fresh.reason ?? ''}`,
      port: claim.port,
      id: claim.id,
    }
  }
  if (typeof opts.isPidAlive !== 'function') {
    return {
      verdict: 'unusable-unjudged',
      reason: '未判定:没给判活注入(isPidAlive)',
      port: claim.port,
      id: claim.id,
    }
  }
  if (!opts.isPidAlive(claim.pid)) {
    return {
      verdict: 'rejected',
      reason: `进程已消亡(pid=${claim.pid})`,
      port: claim.port,
      id: claim.id,
    }
  }
  if (typeof opts.probeEndpoint !== 'function') {
    return {
      verdict: 'unusable-unjudged',
      reason: '未判定:没给端点探测注入(probeEndpoint)',
      port: claim.port,
      id: claim.id,
    }
  }
  const probe = opts.probeEndpoint(claim.port)
  if (probe === null) {
    return {
      verdict: 'rejected',
      reason: `端口 ${claim.port} 无应答(记录自称活)`,
      port: claim.port,
      id: claim.id,
    }
  }
  if (claim.generation !== undefined && probe.generation !== claim.generation) {
    return {
      verdict: 'rejected',
      reason: `代次不符:记录 ${claim.generation} vs 实际 ${probe.generation ?? '(未自述)'} —— 拒绝,防伪造认领件`,
      port: claim.port,
      id: claim.id,
    }
  }
  return {
    verdict: 'usable',
    reason: 'fresh + 进程存活 + 代次相符',
    port: claim.port,
    id: claim.id,
  }
}

/**
 * 批量选取:可用集 + **逐条点名的被拒集**(零静默丢弃)。
 * 枚举到 0 条候选时返回 `unjudged`,不用空数组冒充"本机没有实例"。
 */
export function selectLiveEndpoints(
  claims: readonly (ServiceClaim | { error: string })[],
  opts: ClaimCheckOptions = {},
): {
  usable: ReadonlyArray<{ id: string; port: number; url: string }>
  rejected: ReadonlyArray<{ id: string | null; reason: string }>
  state: 'ok' | 'unjudged'
} {
  const usable: Array<{ id: string; port: number; url: string }> = []
  const rejected: Array<{ id: string | null; reason: string }> = []
  if (claims.length === 0) {
    return { usable: [], rejected: [], state: 'unjudged' }
  }
  for (const item of claims) {
    if ('error' in item) {
      rejected.push({ id: null, reason: `记录形状不合判据:${item.error}` })
      continue
    }
    const r = evaluateServiceClaim(item, opts)
    if (r.verdict === 'usable')
      usable.push({ id: r.id, port: r.port, url: `http://127.0.0.1:${r.port}` })
    else rejected.push({ id: r.id, reason: r.reason })
  }
  return { usable, rejected, state: 'ok' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
