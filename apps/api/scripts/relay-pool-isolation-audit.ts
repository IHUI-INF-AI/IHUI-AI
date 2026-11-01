// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池隔离性体检尺(2026-11-01 立;判机器状态 ⇒ 刻意不进提交链,§12e)。
 *
 * 立因:上一轮给机主本机 Trae 号做「永久保活档」时,交付面如实登记了三处「号与号之间会互相牵连」
 * 的维,但当时只有一句口头结论 —— 没有任何器物在周期量它,于是"是否正在变糟"只能靠人想起来再查。
 * 本尺把那三处变成机读结论 + 一份可点名的明细:
 *   D1 设备身份簇   —— 同一枚 deviceId 被 ≥2 个 uid 共用(上游一眼就能跨号关联;实测 trae 2 行、qoder 4 行)
 *   D2 共用 rt      —— 同一枚 refreshToken 密文出现在多行(一处刷新就把另一处的票顶废;实测 0 组)
 *   D3 同 uid 跨池双行 —— 同一账号同时住运营池与某人私有池(历史上回灌不带归属闸时会串票)
 *   D4 rt 终点证据   —— 有 rt 密文却读不到自然终点(死线判据对此瞎;永久保活号瞎了就是 breach)
 *   D5 出口亲和     —— 代理池有位数但行上无绑定/无亲和(多号共用出口 IP)
 *   D6 死副本       —— 已判死 + 票过期 + 无再凭证能力的行(账面噪声,派单/统计会把它当活号)
 *
 * 三态纪律(§0.3):任何一维取不到输入 ⇒ 该维 unjudged,不记绿也不冒红;
 * 全池读到 0 行 ⇒ 整体 unjudged(枚举到 0 判死,不用 0 冒充「没有」)。
 * 判据零复算(§0.6):D1 直接 import 导入侧那把 `computeDeviceCollisions`,本文件不重写分组规则。
 *
 * 日常入口 = `node scripts/check-pool-isolation.mjs`(薄壳跑 tsx 与连库面);
 * 派发 = `scripts/git-guardian.mjs` 的 `sweepPoolIsolation()`(周期量,倒退才到人的邮箱)。
 */
import { pathToFileURL } from 'node:url'

const { sql } = await import('drizzle-orm')
const { aiRelayAccountPool } = await import('@ihui/database')
const { dbRead } = await import('../src/db/index.js')
const poolService = await import('../src/services/relay-account-pool-service.js')

/** 单源判据:设备碰撞的分组规则只许有一份(导入侧那把),这里直接用,不抄第二份 */
const computeDeviceCollisions = (
  poolService as unknown as {
    __test__: {
      computeDeviceCollisions: (
        rows: ReadonlyArray<{ deviceId?: string | null; uid: string }>,
      ) => Array<{ deviceId: string; uids: string[] }>
    }
  }
).__test__.computeDeviceCollisions

export type DimKey = 'deviceCluster' | 'sharedRefreshToken' | 'sameUidMultiRow' | 'rtBlindSpot' | 'egressAffinity' | 'deadCopy'
export type DimState = 'ok' | 'breach' | 'unjudged' | 'info'

export interface Dim {
  key: DimKey
  state: DimState
  count: number
  /** 逐条点名(不含任何凭据原文:只有 uid 前缀 / deviceId 前缀 / 时刻) */
  detail: string[]
  /** 红了能做什么(§5e-1:不可整改的判据不许挂到人通道) */
  fix: string
}

const HEAD = (v: unknown, n = 10): string => String(v ?? '(空)').slice(0, n)

/** D1 设备身份簇:≥2 个 uid 共用一枚 deviceId ⇒ breach */
export function deviceClusterDim(
  collisions: Array<{ deviceId: string; uids: string[] }>,
  scanned: number | null,
): Dim {
  if (scanned === null) {
    return {
      key: 'deviceCluster',
      state: 'unjudged',
      count: 0,
      detail: ['池面读不到 ⇒ 不判'],
      fix: '先看连库面(db 未就绪 / 迁移未跑)',
    }
  }
  // 设备身份在本机是「整机一份」(storage.json 只有 1 枚 icube-dc 键),不是采集缺陷也不是
  // 本仓能伪造的维 —— 同簇号要错峰使用/避免并发续票,且一键切号已上设备档槽位覆盖(见 fix)。
  // 它是「要一直知道、但本仓改不了」的维,故记为 info(点名 + 提醒)而非 breach(会逼出假红告警);
  // 真 breach 留给 D2 共用 rt / D4 rt 终点证据这类本仓能整改、且确实意味着串票事故的维。
  return {
    key: 'deviceCluster',
    state: collisions.length > 0 ? 'info' : 'ok',
    count: collisions.length,
    detail: collisions.map((c) => `deviceId=${HEAD(c.deviceId, 8)} 共用 uid=[${c.uids.map((u) => HEAD(u, 12)).join(',')}]`),
    fix: '设备身份在本机是「整机一份」(实测 storage.json 只有 1 枚 icube-dc 键),不是采集缺陷也不是本仓能伪造的维 —— 同簇号要错峰使用/避免并发续票,并在一键切号时留意设备档槽位覆盖(已上防护)',
  }
}

/** D2 共用 rt:同一枚密文出现在多行 ⇒ breach(谁刷谁顶废另一处) */
export function sharedRtDim(
  groups: Array<{ providerCode: string; uids: string[] }> | null,
): Dim {
  if (groups === null) {
    return { key: 'sharedRefreshToken', state: 'unjudged', count: 0, detail: [], fix: '先看连库面' }
  }
  return {
    key: 'sharedRefreshToken',
    state: groups.length > 0 ? 'breach' : 'ok',
    count: groups.length,
    detail: groups.map((g) => `${g.providerCode}/[${g.uids.map((u) => HEAD(u, 12)).join(',')}] 共用同一枚 rt`),
    fix: '同一枚上游会话被两处持有 ⇒ 任一处刷新就顶废另一处。保留一行、另一行改走独立登录,或摘除多余行',
  }
}

/** D3 同 uid 跨池双行:各存各票时只是账面形态,但归属闸一旦漂移就是串票事故 */
export function sameUidDim(groups: Array<{ providerCode: string; uid: string; owners: string[] }> | null): Dim {
  if (groups === null) {
    return { key: 'sameUidMultiRow', state: 'unjudged', count: 0, detail: [], fix: '先看连库面' }
  }
  return {
    key: 'sameUidMultiRow',
    state: groups.length > 0 ? 'info' : 'ok',
    count: groups.length,
    detail: groups.map((g) => `${g.providerCode}/${HEAD(g.uid, 12)} 行数=${g.owners.length} 归属=[${g.owners.map((o) => (o === 'OPS' ? 'OPS' : HEAD(o, 8))).join(',')}]`),
    fix: '两条 partial unique 允许同 uid 两行(运营池 + 私有各一)。回灌/切号/同步三条腿已带 owner_user_id IS NULL 归属闸并有自平衡锁;此维只做点名,提醒"别把两个持有者当成一枚号"',
  }
}

/** 已知「客户端不暴露 rt 自然终点」的 provider(2026-11-01 实测 Trae:本机 storage.json 里
 * refreshExpiredAt 恒为空,上游不给出 rt 过期时刻)。这类 provider 的 rt 本来就没有终点,
 * 保活改靠访问令牌过期窗口(token_expires_at)续期,其永久号 rt 盲点记为 info(固有)而非 breach。 */
const RT_EXPIRY_NOT_EXPOSED = new Set(['trae'])

/** D4 rt 终点证据:永久保活号瞎 ⇒ 默认 breach;但「客户端根本不暴露 rt 终点」的 provider
 * (RT_EXPIRY_NOT_EXPOSED)属固有盲区,记 info(点名+接受),否则每轮刷一封无意义告警。
 * 其余 provider(qoder/minimax 真会暴露终点)的永久号瞎了仍是 breach(真会丢号)。 */
export function rtBlindDim(
  input: {
    foreverBlind: Array<{ provider: string; uid: string }>
    otherBlind: Array<{ provider: string; uid: string }>
    scanned: boolean
  },
): Dim {
  if (!input.scanned) {
    return { key: 'rtBlindSpot', state: 'unjudged', count: 0, detail: [], fix: '先看连库面' }
  }
  const foreverActionable = input.foreverBlind.filter((r) => !RT_EXPIRY_NOT_EXPOSED.has(r.provider))
  const detail = [
    ...input.foreverBlind.map((r) =>
      RT_EXPIRY_NOT_EXPOSED.has(r.provider)
        ? `永久保活号 ${HEAD(r.uid, 12)} (${r.provider}) 有 rt 但客户端不暴露终点 ⇒ info(固有)`
        : `永久保活号 ${HEAD(r.uid, 12)} (${r.provider}) 有 rt 却读不到自然终点`,
    ),
    ...input.otherBlind.map((r) => `${HEAD(r.uid, 12)} (${r.provider}) 有 rt 却读不到自然终点(普通号)`),
  ]
  const breach = foreverActionable.length > 0
  const any = input.foreverBlind.length + input.otherBlind.length > 0
  return {
    key: 'rtBlindSpot',
    state: breach ? 'breach' : any ? 'info' : 'ok',
    count: input.foreverBlind.length + input.otherBlind.length,
    detail,
    fix: '同票轮次已由回灌腿补写(2026-11-01);仍为空说明该腿没跑到或客户端根本没给这一维(Trae 客户端实测不暴露 rt 终点,属固有,记 info)。见 --explain 与 sync 腿 --dry-run',
  }
}

/** D5 出口亲和:代理池有位数却没绑定 ⇒ breach;池为空 ⇒ info(无位数可绑,不是漏配) */
export function egressDim(input: {
  proxyTotal: number | null
  proxyActive: number | null
  proxyBound: number | null
  accountsWithProxy: number | null
}): Dim {
  const { proxyTotal, proxyActive, proxyBound, accountsWithProxy } = input
  if ([proxyTotal, proxyActive, proxyBound, accountsWithProxy].some((v) => v === null)) {
    return { key: 'egressAffinity', state: 'unjudged', count: 0, detail: [], fix: '先看连库面' }
  }
  if (proxyTotal === 0) {
    return {
      key: 'egressAffinity',
      state: 'info',
      count: 0,
      detail: ['代理池为空 ⇒ 全池走同一出口 IP(本机/本机机房)'],
      fix: '要拆簇就配代理并按号绑定;不配就接受同出口这一维(它与设备簇一起构成上游风控的同源性)',
    }
  }
  const unbound = (proxyActive ?? 0) - (proxyBound ?? 0)
  return {
    key: 'egressAffinity',
    state: unbound > 0 ? 'breach' : 'ok',
    count: unbound,
    detail: [`active 代理 ${proxyActive} 枚,其中 ${unbound} 枚未绑定账号 ⇒ pickProxyForAccount 每次调用轮换,多号可共用一位`],
    fix: '给需要长期在线的号(尤其永久保活号)绑 bound_account_id,换票与转发才不会漂到别人身上',
  }
}

/** D6 死副本:判死 + 票过期 + 无再凭证能力 */
export function deadCopyDim(rows: Array<{ providerCode: string; uid: string }> | null): Dim {
  if (rows === null) {
    return { key: 'deadCopy', state: 'unjudged', count: 0, detail: [], fix: '先看连库面' }
  }
  return {
    key: 'deadCopy',
    state: rows.length > 0 ? 'info' : 'ok',
    count: rows.length,
    detail: rows.map((r) => `${r.providerCode}/${HEAD(r.uid, 12)} 判死且票过期、无再凭证能力`),
    fix: '这类行不会自己活过来,也不该出现在派单/统计里;确认无用就摘除(§7 三问后再动)',
  }
}

/** 汇总裁决:breach 优先;无 breach 但有 unjudged ⇒ undetermined;否则 ok */
export function overallState(dims: Dim[]): 'ok' | 'breach' | 'undetermined' {
  if (dims.some((d) => d.state === 'breach')) return 'breach'
  if (dims.some((d) => d.state === 'unjudged')) return 'undetermined'
  return 'ok'
}

/** 结论行(ASCII 单行,供守护判读;三态绝不并桶) */
export function conclusionLine(dims: Dim[], total: number | null): string {
  const kv = dims
    .map((d) => `${d.key}=${d.count}${d.state === 'unjudged' ? '?' : ''}`)
    .join(' ')
  return `POOL-ISOLATION state=${overallState(dims)} total=${total ?? '?'} ${kv}`
}

export interface AuditResult {
  ok: boolean
  state: 'ok' | 'breach' | 'undetermined'
  poolRows: number | null
  dims: Dim[]
  /** 取数失败逐条点名(不遮蔽主结论) */
  readErrors: string[]
}

async function safe<T>(label: string, fn: () => Promise<T>, errors: string[]): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    errors.push(`${label}:${String(e instanceof Error ? e.message : e).slice(0, 160)}`)
    return null
  }
}

/** 全量现读 + 逐维裁决(零凭据:只取前缀/时刻/计数,密文列只在 SQL 里做分组键,不出网不出进程) */
export async function auditPoolIsolation(): Promise<AuditResult> {
  const readErrors: string[] = []
  const rows = await safe(
    'pool',
    async () =>
      dbRead
        .select({
          providerCode: aiRelayAccountPool.providerCode,
          uid: aiRelayAccountPool.uid,
          deviceId: aiRelayAccountPool.deviceId,
          ownerUserId: aiRelayAccountPool.ownerUserId,
          refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
          tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
          healthStatus: aiRelayAccountPool.healthStatus,
          extraMetadata: aiRelayAccountPool.extraMetadata,
        })
        .from(aiRelayAccountPool),
    readErrors,
  )

  const sharedRt = await safe(
    'sharedRt',
    async () =>
      dbRead.execute(sql`
        select provider_code, array_agg(distinct uid) as uids
        from ai_relay_account_pool
        where refresh_token_enc is not null
        group by provider_code, refresh_token_enc
        having count(*) > 1`),
    readErrors,
  )
  const sameUid = await safe(
    'sameUid',
    async () =>
      dbRead.execute(sql`
        select provider_code, uid, array_agg(distinct coalesce(owner_user_id::text, 'OPS')) as owners
        from ai_relay_account_pool
        group by provider_code, uid
        having count(*) > 1`),
    readErrors,
  )
  const rtBlind = await safe(
    'rtBlind',
    async () =>
      dbRead.execute(sql`
        select provider_code, uid,
               (coalesce(extra_metadata,'{}'::jsonb) ->> 'keepAliveForever') = 'true' as forever
        from ai_relay_account_pool
        where refresh_token_enc is not null and refresh_expires_at is null`),
    readErrors,
  )
  const proxy = await safe(
    'proxy',
    async () =>
      dbRead.execute(sql`
        select count(*)::int as total,
               count(*) filter (where status='active')::int as active,
               count(*) filter (where bound_account_id is not null)::int as bound
        from ai_relay_proxy_pool`),
    readErrors,
  )
  const accountsWithProxy = await safe(
    'accountsWithProxy',
    async () =>
      dbRead.execute(
        sql`select count(*)::int as n from ai_relay_account_pool where proxy_url is not null`,
      ),
    readErrors,
  )
  const dead = await safe(
    'dead',
    async () =>
      dbRead.execute(sql`
        select provider_code, uid from ai_relay_account_pool
        where health_status = 'down'
          and (token_expires_at is null or token_expires_at < now())
          and refresh_token_enc is null and cookies_enc is null`),
    readErrors,
  )

  const poolRows = rows ? rows.length : null
  const dims: Dim[] = [
    deviceClusterDim(rows ? computeDeviceCollisions(rows) : [], rows ? poolRows : null),
    sharedRtDim(
      sharedRt
        ? (sharedRt as unknown as Array<{ provider_code: string; uids: string[] }>).map((r) => ({
            providerCode: r.provider_code,
            uids: (r.uids ?? []).map(String),
          }))
        : null,
    ),
    sameUidDim(
      sameUid
        ? (sameUid as unknown as Array<{ provider_code: string; uid: string; owners: string[] }>).map((r) => ({
            providerCode: r.provider_code,
            uid: String(r.uid),
            owners: (r.owners ?? []).map(String),
          }))
        : null,
    ),
    rtBlindDim(
      rtBlind
        ? {
            scanned: true,
            foreverBlind: (
              rtBlind as unknown as Array<{ provider_code: string; forever: boolean; uid: string }>
            )
              .filter((r) => r.forever === true)
              .map((r) => ({ provider: r.provider_code, uid: String(r.uid) })),
            otherBlind: (
              rtBlind as unknown as Array<{ provider_code: string; forever: boolean; uid: string }>
            )
              .filter((r) => r.forever !== true)
              .map((r) => ({ provider: r.provider_code, uid: String(r.uid) })),
          }
        : { scanned: false, foreverBlind: [], otherBlind: [] },
    ),
    egressDim({
      proxyTotal: proxy ? (proxy as unknown as Array<{ total: number }>)[0]?.total ?? null : null,
      proxyActive: proxy ? (proxy as unknown as Array<{ active: number }>)[0]?.active ?? null : null,
      proxyBound: proxy ? (proxy as unknown as Array<{ bound: number }>)[0]?.bound ?? null : null,
      accountsWithProxy: accountsWithProxy
        ? (accountsWithProxy as unknown as Array<{ n: number }>)[0]?.n ?? null
        : null,
    }),
    deadCopyDim(
      dead
        ? (dead as unknown as Array<{ provider_code: string; uid: string }>).map((r) => ({
            providerCode: r.provider_code,
            uid: String(r.uid),
          }))
        : null,
    ),
  ]

  // 全池 0 行 ⇒ 枚举到 0 判死(§0.3):不用 0 冒充「池很干净」
  if (poolRows === 0) {
    return {
      ok: false,
      state: 'undetermined',
      poolRows: 0,
      dims: dims.map((d) => ({
        ...d,
        state: 'unjudged' as DimState,
        detail: [...d.detail, '号池读到 0 行 ⇒ 本尺射程为空,不记绿'],
      })),
      readErrors,
    }
  }
  return { ok: overallState(dims) !== 'undetermined', state: overallState(dims), poolRows, dims, readErrors }
}

export function parseArgs(argv: string[]): { json: boolean; help: boolean; error: null | string } {
  const out = { json: false, help: false, error: null as null | string }
  for (const a of argv) {
    if (a === '--json') out.json = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--') continue
    else out.error = `未知参数: ${a}`
  }
  return out
}

async function main(argv: string[]): Promise<number> {
  const a = parseArgs(argv)
  if (a.error) {
    process.stderr.write(`❌ ${a.error}(未判定)\n`)
    return 2
  }
  if (a.help) {
    process.stdout.write(
      '用法: node scripts/check-pool-isolation.mjs [--json]\n' +
        '号池隔离性体检尺:D1 设备簇 / D2 共用 rt / D3 同 uid 双行 / D4 rt 终点证据 / D5 出口亲和 / D6 死副本。\n' +
        '只读,不写库不打上游,不回显任何凭据。判机器状态 ⇒ 刻意不进提交链。\n',
    )
    return 0
  }
  const r = await auditPoolIsolation()
  if (a.json) process.stdout.write(`${JSON.stringify(r)}\n`)
  else {
    process.stderr.write(`号池行数 = ${r.poolRows ?? '(未判定)'} 总裁决 = ${r.state}\n`)
    for (const d of r.dims) {
      process.stderr.write(`  ${d.key} = ${d.state} (${d.count})\n`)
      for (const line of d.detail) process.stderr.write(`      ${line}\n`)
      if (d.state !== 'ok') process.stderr.write(`      出路:${d.fix}\n`)
    }
    if (r.readErrors.length > 0) {
      process.stderr.write(`  取数失败(逐条,不遮蔽主结论):${r.readErrors.join(' | ')}\n`)
    }
  }
  process.stdout.write(`${conclusionLine(r.dims, r.poolRows)}\n`)
  return r.state === 'breach' ? 1 : r.state === 'undetermined' ? 2 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n${e?.stack ?? ''}\n`)
      process.exit(2)
    })
}

export const __test__ = {
  parseArgs,
  overallState,
  conclusionLine,
  deviceClusterDim,
  sharedRtDim,
  sameUidDim,
  rtBlindDim,
  egressDim,
  deadCopyDim,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
