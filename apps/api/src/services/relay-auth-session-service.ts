// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池自助授权会话 —— **IO 层**（db + 上游 + 唯一入池通道）。
 *
 * 2026-11-17 立。判据全在 `relay-auth-session.ts`（纯函数），本文件只负责：
 * 读写会话行、打上游、把票交给 `importAccounts()` 入池、把结果如实落档。
 *
 * 能力对标：qoder2api 系开源网关（shuishuipingan/qoder2api-hub / Zhengyuuuui/qoder2api /
 * caigee-cmd/cli2api 等）的「+ 添加账号 (OAuth)」设备授权免客户端入池那一格。本仓此前
 * 只有「本机客户端提取」(`relay-account-pool.mjs --from <provider>`) 与「JSON / tokens 导入」
 * 两条腿，二者都要求先有一台装好并登录过官方客户端的机器 —— 服务器与 Web 控制台无法自助拿票。
 *
 * 五个超越轴（逐条都有代码位置，不是措辞）：
 *   ① provider × 授权形态 = 数据（`relay-auth-capabilities.ts`），新接一家不改代码；
 *      对照程序的入口是硬编码在 UI 后面的单边实现。
 *   ② 未实证 ⇒ 当场 409 并给可执行出路，**不建 pending 会话**：不会让人扫一枚永远
 *      等不到回调的码（AGENTS §0.3 在授权面的落地）。
 *   ③ 退避闸门：未到 `nextPollAt` 一次上游都不发；slow_down 按 RFC 8628 §3.5 间隔 +5s。
 *      对照程序普遍裸轮询 —— 这在风控面上是最容易自伤的一格，本仓把它做成结构性的。
 *   ④ 会话即审计，且会话行不落第二份凭证：票只进号池（`importAccounts` 唯一通道，AGENTS §0.6），
 *      本表只留 sha256 短指纹与号池行指针；表在库里 ⇒ 蓝绿切流 / 重启不丢会话
 *      （对照程序用进程内 Map，切流即静默丢失）。
 *   ⑤ 终局即销毁 bearer 把手（撤销 / 过期 / access_denied 都清空密文），
 *      且把手明文自带 v0/v1 形态标签，票与 device_code 不可能互相冒充。
 *
 * 三条口径纪律：
 *   - 「上游已发票」≠「已入池」：换票成功而入池失败 ⇒ 停在 `authorized` 并点名原因；
 *   - 解不开密文 / 读不出响应 ⇒ 显式未判定（credential_gone / upstream_malformed /
 *     upstream_unreachable），不记绿也不冒成别的红；
 *   - 返回值 / 日志 / failureMessage 恒不含 device_code、access_token、PAT 明文。
 */
import { and, asc, eq, gt, isNull, lt, lte, or } from 'drizzle-orm'
import {
  aiRelayAccountPool,
  aiRelayAuthSession,
  type AiRelayAuthSession,
  type AuthSessionKind,
  type AuthSessionStatus,
} from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { decryptField, encryptField } from '../utils/crypto.js'
import { logger } from '../utils/logger.js'
import {
  importAccounts,
  type ImportAccountInput,
  type ImportBatchResult,
} from './relay-account-pool-service.js'
import {
  authCapabilityFor,
  effectiveCapabilities,
  type AuthCapability,
} from './relay-auth-capabilities.js'
import type { RelayProviderCode } from './relay-account-format.js'
import {
  DEFAULT_SESSION_TTL_MS,
  DEVICE_GRANT_TYPE,
  MIN_POLL_INTERVAL_S,
  UPSTREAM_TIMEOUT_MS,
  buildQrPayload,
  clampInterval,
  credentialFingerprint,
  encodeHandle,
  isTerminalStatus,
  mapPatToImport,
  mapTokenPairToImport,
  mapperIsWired,
  judgeTokenResponse,
  parseHandle,
  type PollOutcome,
} from './relay-auth-session.js'

// =============================================================================
// 对外形状
// =============================================================================

export interface CreateSessionInput {
  providerCode: string
  /** 缺省 = 该 provider 已实证的第一档 */
  kind?: AuthSessionKind
  /** `kind:'pat'` 必填；device_flow 忽略 */
  secret?: string
  /** 号池归属：缺省 / NULL = 运营池（与号池 owner_user_id 同语义） */
  ownerUserId?: string | null
  requestedBy?: string | null
  scene?: string | null
}

export type SessionCommand<T> =
  { ok: true; data: T } | { ok: false; status: number; code: string; message: string }

/** 前端 / 日志唯一可见的会话形状（把手永不出现在这里，只以 handleRetained 说「库里还留着」） */
export interface AuthSessionView {
  id: string
  providerCode: string
  kind: AuthSessionKind
  status: AuthSessionStatus
  userCode: string | null
  verificationUri: string | null
  verificationUriComplete: string | null
  qrPayload: string | null
  intervalSeconds: number
  pollAttempts: number
  /** 下一次允许轮询的最早时刻：前端据此决定「检查一次」会不会真的打上游 */
  nextPollAt: string | null
  expiresAt: string
  failureCode: string | null
  failureMessage: string | null
  accountId: string | null
  credFingerprint: string | null
  handleRetained: boolean
  createdAt: string
  finishedAt: string | null
  /** 该 provider × 形态的声明说明（未实证时这里就是出路） */
  capabilityNote: string | null
}

const fail = (status: number, code: string, message: string): SessionCommand<never> => ({
  ok: false,
  status,
  code,
  message,
})

function toView(row: AiRelayAuthSession, note: string | null): AuthSessionView {
  return {
    id: row.id,
    providerCode: row.providerCode,
    kind: row.kind,
    status: row.status,
    userCode: row.userCode,
    verificationUri: row.verificationUri,
    verificationUriComplete: row.verificationUriComplete,
    qrPayload: buildQrPayload(row.verificationUri, row.verificationUriComplete, row.userCode),
    intervalSeconds: row.intervalSeconds,
    pollAttempts: row.pollAttempts,
    expiresAt: row.expiresAt.toISOString(),
    nextPollAt: row.nextPollAt ? row.nextPollAt.toISOString() : null,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    accountId: row.accountId,
    credFingerprint: row.credFingerprint,
    handleRetained: row.bearerSecretEnc !== null && !row.credentialScrubbed,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    capabilityNote: note,
  }
}

// =============================================================================
// 上游通信（RFC 8628 §3.2 / §3.4 规定两次 POST 都是 x-www-form-urlencoded）
// =============================================================================

export interface UpstreamResponse {
  status: number
  body: unknown
  /** JSON 是否解析成功；false ⇒ 上层判 malformed，绝不当成「还在等」 */
  jsonParsed: boolean
}

/** 可注入的上游出口（测试用它替换 fetch；生产缺省走 undici/全局 fetch） */
export type UpstreamPoster = (
  url: string,
  form: Record<string, string>,
) => Promise<UpstreamResponse>

async function defaultPoster(url: string, form: Record<string, string>): Promise<UpstreamResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
      signal: controller.signal,
      cache: 'no-store',
    })
    const text = await res.text()
    let body: unknown = null
    let jsonParsed = false
    if (text) {
      try {
        body = JSON.parse(text)
        jsonParsed = true
      } catch {
        body = null
      }
    }
    return { status: res.status, body, jsonParsed }
  } finally {
    clearTimeout(timer)
  }
}

let poster: UpstreamPoster = defaultPoster
/** 仅测试通道：替换上游出口（真 fetch 在 CI 里没有可连的上游，而判据必须被钉住） */
export function setUpstreamPosterForTests(fn: UpstreamPoster | null): void {
  poster = fn ?? defaultPoster
}

/** 仅测试通道：替换入池通道（真 importAccounts 要连库，判据链在单测里必须可隔离） */
type ImportFn = (
  providerCode: RelayProviderCode,
  accounts: ImportAccountInput[],
  ownerUserId: string | null,
) => Promise<ImportBatchResult>
let importImpl: ImportFn = importAccounts
export function setImportAccountsForTests(fn: ImportFn | null): void {
  importImpl = fn ?? importAccounts
}

/** 仅测试通道：替换字段加解密（真 crypto 依赖运行密钥环境，判据测试不需要它） */
let encodeImpl: (plain: string) => string = encryptField
let decodeImpl: (stored: string) => string = decryptField
export function setCipherForTests(
  fns: { encrypt?: (p: string) => string; decrypt?: (s: string) => string } | null,
): void {
  encodeImpl = fns?.encrypt ?? encryptField
  decodeImpl = fns?.decrypt ?? decryptField
  if (!fns) {
    encodeImpl = encryptField
    decodeImpl = decryptField
  }
}

// =============================================================================
// 会话读写
// =============================================================================

async function loadSession(id: string): Promise<AiRelayAuthSession | null> {
  const [row] = await dbRead
    .select()
    .from(aiRelayAuthSession)
    .where(eq(aiRelayAuthSession.id, id))
    .limit(1)
  return row ?? null
}

/**
 * 发起一次授权会话。
 * - `pat` + secret ⇒ 同步进唯一入池通道（没有「等待」态；对照程序要人先起客户端再复制票）
 * - `device_flow` ⇒ 向上游取 device_code，建 `pending` 会话
 * - capability 未实证 ⇒ 409 + 出路，**一行会话都不建**
 */
export async function createAuthSession(
  input: CreateSessionInput,
): Promise<SessionCommand<AuthSessionView>> {
  const cap = authCapabilityFor(input.providerCode, input.kind)
  if (!cap) {
    return fail(
      400,
      'capability_unknown',
      `平台 ${input.providerCode} 未登记自助授权面。现有可用入池通道：本机提取 node scripts/relay-account-pool.mjs --from ${input.providerCode}，或 JSON / tokens 导入`,
    )
  }
  if (!cap.verified) return fail(409, 'capability_unverified', cap.note)
  if (cap.kind === 'pat') return importByPat(cap, input)
  if (cap.kind === 'device_flow') return startDeviceFlow(cap, input)
  return fail(
    501,
    'kind_not_wired',
    `授权形态 ${cap.kind} 已登记但本层未接线（AGENTS §0.3：未接线不许冒绿）；按 §0.12 取证后补映射器`,
  )
}

async function importByPat(
  cap: AuthCapability,
  input: CreateSessionInput,
): Promise<SessionCommand<AuthSessionView>> {
  const secret = typeof input.secret === 'string' ? input.secret.trim() : ''
  if (!secret) return fail(400, 'secret_required', 'PAT 形态必须给 secret（上游个人访问令牌本体）')
  const [row] = await db
    .insert(aiRelayAuthSession)
    .values({
      providerCode: cap.providerCode,
      kind: 'pat',
      status: 'pending',
      bearerSecretEnc: encodeImpl(encodeHandle({ accessToken: secret, refreshToken: null })),
      credFingerprint: credentialFingerprint(secret),
      ownerUserId: input.ownerUserId ?? null,
      requestedBy: input.requestedBy ?? null,
      scene: input.scene ?? null,
      intervalSeconds: MIN_POLL_INTERVAL_S,
      expiresAt: new Date(Date.now() + DEFAULT_SESSION_TTL_MS),
      upstreamMetadata: { issuanceUrl: cap.issuanceUrl ?? null, mapper: cap.mapper },
    })
    .returning()
  // 写不回就如实报错：绝不拿一个不存在的会话行去"收尾"（§0.3 取不到输入 ≠ 判过）
  if (!row) return fail(500, 'session_row_unreadable', 'PAT 会话行写入后读不回，未做任何入池动作')
  return finalizeImport(row, secret, null, cap)
}

async function startDeviceFlow(
  cap: AuthCapability,
  input: CreateSessionInput,
): Promise<SessionCommand<AuthSessionView>> {
  if (!cap.authorizationEndpoint || !cap.tokenEndpoint || !cap.clientId) {
    return fail(
      409,
      'capability_incomplete',
      `${cap.providerCode} 的 device_flow 声明缺 authorizationEndpoint / tokenEndpoint / clientId，无法发起`,
    )
  }
  let r: UpstreamResponse
  try {
    r = await poster(
      cap.authorizationEndpoint,
      cap.scope ? { client_id: cap.clientId, scope: cap.scope } : { client_id: cap.clientId },
    )
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return fail(
      502,
      'upstream_unreachable',
      aborted ? '上游设备授权端点超时，可稍后重试' : '上游设备授权端点不可达，可稍后重试',
    )
  }
  if (r.status !== 200 || !r.jsonParsed || !r.body || typeof r.body !== 'object') {
    return fail(
      502,
      'upstream_malformed',
      `上游设备授权响应不可判定（HTTP ${r.status}${r.jsonParsed ? '' : '，非 JSON'}）`,
    )
  }
  const b = r.body as Record<string, unknown>
  const deviceCode = typeof b.device_code === 'string' ? b.device_code.trim() : ''
  const userCode = typeof b.user_code === 'string' ? b.user_code.trim() : ''
  const verificationUri = typeof b.verification_uri === 'string' ? b.verification_uri.trim() : ''
  if (!deviceCode || !userCode || !verificationUri) {
    return fail(
      502,
      'upstream_malformed',
      '上游设备授权响应缺 device_code / user_code / verification_uri',
    )
  }
  const interval = clampInterval(typeof b.interval === 'number' ? b.interval : MIN_POLL_INTERVAL_S)
  const ttlMs =
    typeof b.expires_in === 'number' && Number.isFinite(b.expires_in) && b.expires_in > 0
      ? b.expires_in * 1000
      : DEFAULT_SESSION_TTL_MS
  const [row] = await db
    .insert(aiRelayAuthSession)
    .values({
      providerCode: cap.providerCode,
      kind: 'device_flow',
      status: 'pending',
      bearerSecretEnc: encodeImpl(encodeHandle({ deviceCode })),
      userCode,
      verificationUri,
      verificationUriComplete:
        typeof b.verification_uri_complete === 'string' && b.verification_uri_complete.trim()
          ? b.verification_uri_complete.trim()
          : null,
      intervalSeconds: interval,
      nextPollAt: new Date(Date.now() + interval * 1000),
      expiresAt: new Date(Date.now() + ttlMs),
      ownerUserId: input.ownerUserId ?? null,
      requestedBy: input.requestedBy ?? null,
      scene: input.scene ?? null,
      upstreamMetadata: { clientId: cap.clientId, scope: cap.scope ?? null, mapper: cap.mapper },
    })
    .returning()
  if (!row) return fail(500, 'session_row_unreadable', '设备授权会话行写入后读不回，未回显任何码')
  logger.info('relay auth session started', {
    sessionId: row.id,
    providerCode: cap.providerCode,
    kind: 'device_flow',
  })
  return { ok: true, data: toView(row, cap.note) }
}

/**
 * 轮询一次（人点「我已完成授权」或调度节拍调用）。
 *
 * 四道闸按序生效，任一命中都**不发上游请求**：
 *   终局幂等 → 本地寿命 → 把手形态 → nextPollAt 退避。
 * 把手已是票（v1）的会话只重试收尾，绝不重打 token 端点 —— 重复消费一次性票是本仓号池
 * 记过的同族事故（轮换式 refreshToken 被两行互相吃掉那一型）。
 */
export async function pollAuthSession(id: string): Promise<SessionCommand<AuthSessionView>> {
  const row = await loadSession(id)
  if (!row) return fail(404, 'session_not_found', '授权会话不存在')
  const cap = authCapabilityFor(row.providerCode, row.kind)
  if (!cap) {
    return fail(
      409,
      'capability_unknown',
      `能力声明已不在表内（provider=${row.providerCode} kind=${row.kind}），请人工核对后重建会话`,
    )
  }
  if (isTerminalStatus(row.status)) return { ok: true, data: toView(row, cap.note) }
  if (row.expiresAt.getTime() <= Date.now()) {
    return markExpired(id, 'session_expired', '会话寿命已至（本地判定），请重新发起')
  }

  const handle = decodeHandle(row.bearerSecretEnc)
  if (handle.form === 'none') {
    return markFailed(id, 'credential_gone', '把手密文缺失或已被销毁，无法继续，请重新发起')
  }
  if (handle.form === 'invalid') {
    return markFailed(id, 'handle_invalid', `把手形态不可解析：${handle.reason}`)
  }
  if (handle.form === 'token') {
    const account =
      cap.mapper === 'oauth_token_pair' || cap.mapper === 'bearer_key'
        ? mapTokenPairToImport(cap, handle.accessToken, handle.refreshToken, {})
        : mapPatToImport(cap, handle.accessToken)
    return finalizeImport(row, handle.accessToken, handle.refreshToken, cap, account)
  }

  // device 形态 ⇒ 只可能走 device_flow 的 token 端点
  if (cap.kind !== 'device_flow' || !cap.tokenEndpoint || !cap.clientId) {
    return markFailed(
      id,
      'capability_incomplete',
      `会话持 device_code 形态，但 ${cap.providerCode} 的 token 端点 / clientId 声明不完整`,
    )
  }
  if (row.nextPollAt && row.nextPollAt.getTime() > Date.now()) {
    return { ok: true, data: toView(row, cap.note) }
  }

  let r: UpstreamResponse
  try {
    r = await poster(cap.tokenEndpoint, {
      client_id: cap.clientId,
      device_code: handle.deviceCode,
      grant_type: DEVICE_GRANT_TYPE,
    })
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    await scheduleNextPoll(id, row.intervalSeconds)
    return fail(
      502,
      'upstream_unreachable',
      aborted ? '上游 token 端点超时，可稍后重试' : '上游 token 端点不可达，可稍后重试',
    )
  }
  await bumpPollAttempt(id)
  const outcome = judgeTokenResponse(
    r.jsonParsed ? r.status : 502,
    r.jsonParsed ? r.body : null,
    row.intervalSeconds,
  )
  return applyPollOutcome(id, row, cap, outcome)
}

/** 把一次判定结果落到会话行（分档动作唯一出口，路由与调度器共用） */
async function applyPollOutcome(
  id: string,
  row: AiRelayAuthSession,
  cap: AuthCapability,
  outcome: PollOutcome,
): Promise<SessionCommand<AuthSessionView>> {
  switch (outcome.kind) {
    case 'waiting':
    case 'slow_down': {
      await scheduleNextPoll(id, outcome.intervalSeconds)
      const fresh = await loadSession(id)
      return {
        ok: true,
        data: toView(fresh ?? { ...row, intervalSeconds: outcome.intervalSeconds }, cap.note),
      }
    }
    case 'expired':
      return markExpired(id, 'expired_token', '上游判定该设备码已过期，请重新发起')
    case 'denied':
      // invalid_grant 的把手留着给人工核对；access_denied（人点了拒绝）当场销毁
      return markFailed(
        id,
        outcome.errorCode,
        outcome.description
          ? `上游拒绝授权：${outcome.description}`
          : '上游拒绝授权（用户未确认或已撤销）',
        outcome.errorCode === 'invalid_grant',
      )
    case 'malformed':
      await scheduleNextPoll(id, row.intervalSeconds)
      return fail(502, 'upstream_malformed', `上游 token 响应不可判定：${outcome.reason}`)
    case 'upstream_error':
      await scheduleNextPoll(id, row.intervalSeconds)
      return fail(502, 'upstream_error', outcome.reason)
    case 'authorized': {
      if (!mapperIsWired(cap.mapper)) {
        // 票到手但映射器未接线 ⇒ 停在 authorized 并点名：既不当成功，也绝不丢弃这张票
        await db
          .update(aiRelayAuthSession)
          .set({
            status: 'authorized',
            bearerSecretEnc: encodeImpl(
              encodeHandle({
                accessToken: outcome.accessToken,
                refreshToken: outcome.refreshToken,
              }),
            ),
            credFingerprint: credentialFingerprint(outcome.accessToken),
            failureCode: 'mapper_unwired',
            failureMessage: `映射器 ${cap.mapper} 未接线：票已换取但未入池，请勿重复授权`,
            updatedAt: new Date(),
          })
          .where(eq(aiRelayAuthSession.id, id))
        return fail(
          501,
          'mapper_unwired',
          `映射器 ${cap.mapper} 未接线：票已换取但未入池，会话停在 authorized 等接线`,
        )
      }
      const account = mapTokenPairToImport(
        cap,
        outcome.accessToken,
        outcome.refreshToken,
        outcome.raw,
      )
      const fresh = await loadSession(id)
      return finalizeImport(fresh ?? row, outcome.accessToken, outcome.refreshToken, cap, account)
    }
  }
}

/** 解密 + 解析一次做完；任何读不出都回结构化形态，由调用方如实标注（§0.3） */
function decodeHandle(enc: string | null): ReturnType<typeof parseHandle> {
  if (!enc) return { form: 'none' }
  try {
    return parseHandle(decodeImpl(enc))
  } catch (e) {
    return {
      form: 'invalid',
      reason: `把手密文不可解：${e instanceof Error ? e.message.slice(0, 120) : '未知异常'}`,
    }
  }
}

/**
 * 唯一收尾出口：入池 → 认领号池行 → 写指纹 → 销毁会话把手。
 * 「没真正进去」的所有结局都不写 imported：入池异常 / 结果行是 failed / 读不出结果行
 * ⇒ `authorized` + failureCode 点名，票以 v1 把手继续加密留在本行，等判据修好后重试同一会话。
 */
async function finalizeImport(
  row: AiRelayAuthSession,
  accessToken: string,
  refreshToken: string | null,
  cap: AuthCapability,
  accountOverride?: ImportAccountInput,
): Promise<SessionCommand<AuthSessionView>> {
  const account = accountOverride ?? mapPatToImport(cap, accessToken)
  let batch: ImportBatchResult
  try {
    batch = await importImpl(
      cap.providerCode as RelayProviderCode,
      [account],
      row.ownerUserId ?? null,
    )
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200)
    await markAuthorizedRetry(
      row.id,
      accessToken,
      refreshToken,
      'import_exception',
      `入池通道异常：${msg}`,
    )
    return fail(502, 'import_exception', `入池通道异常：${msg}`)
  }
  const item = batch?.items?.[0]
  if (!item) {
    await markAuthorizedRetry(
      row.id,
      accessToken,
      refreshToken,
      'import_no_item',
      '入池通道未产出结果行（未判定，不当作成功）',
    )
    return fail(502, 'import_no_item', '入池通道未产出结果行，会话停在 authorized 等复核')
  }
  if (item.status === 'failed') {
    const msg = (item.reason ?? '入池被拒').slice(0, 200)
    await markAuthorizedRetry(row.id, accessToken, refreshToken, 'import_rejected', msg)
    return fail(422, 'import_rejected', `票已换取但入池被拒：${msg}`)
  }
  const accountId = item.uid ? await resolveImportedAccountId(cap.providerCode, item.uid) : null
  const finished = new Date()
  const [updated] = await db
    .update(aiRelayAuthSession)
    .set({
      status: 'imported',
      accountId,
      credFingerprint: credentialFingerprint(accessToken),
      bearerSecretEnc: null,
      credentialScrubbed: true,
      finishedAt: finished,
      updatedAt: finished,
      failureCode: null,
      failureMessage: null,
    })
    .where(eq(aiRelayAuthSession.id, row.id))
    .returning()
  logger.info('relay auth session imported into account pool', {
    sessionId: row.id,
    providerCode: cap.providerCode,
    itemStatus: item.status,
    accountId,
    uidFingerprint: item.uid ? credentialFingerprint(item.uid).slice(0, 8) : null,
  })
  // returning 读不到时回读一次；仍读不到 ⇒ 如实说明「票已入池但回显失败」，
  // 绝不拿 undefined 造一个看起来成功的会话视图（号池行才是权威，交人按 accountId 核对）
  const reflected = updated ?? (await loadSession(row.id))
  if (!reflected) {
    return fail(
      500,
      'session_row_unreadable_after_import',
      `票已入池（uid=${item.uid ?? '未知'}）但会话行读不回，请以号池为准核对，勿重复授权`,
    )
  }
  return { ok: true, data: toView(reflected, cap.note) }
}

/** (provider_code, uid) 全表唯一由迁移 20261114160000 保证 ⇒ 回读至多一行；读不到就如实回 null */
async function resolveImportedAccountId(providerCode: string, uid: string): Promise<string | null> {
  const [poolRow] = await dbRead
    .select({ id: aiRelayAccountPool.id })
    .from(aiRelayAccountPool)
    .where(and(eq(aiRelayAccountPool.providerCode, providerCode), eq(aiRelayAccountPool.uid, uid)))
    .limit(1)
  return poolRow?.id ?? null
}

async function markAuthorizedRetry(
  id: string,
  accessToken: string,
  refreshToken: string | null,
  failureCode: string,
  failureMessage: string,
): Promise<void> {
  await db
    .update(aiRelayAuthSession)
    .set({
      status: 'authorized',
      bearerSecretEnc: encodeImpl(encodeHandle({ accessToken, refreshToken })),
      credFingerprint: credentialFingerprint(accessToken),
      failureCode,
      failureMessage: failureMessage.slice(0, 200),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAuthSession.id, id))
}

/** 过期终局：寿命到即销毁把手（要人重新发起，不存在「补救轮询」这一说） */
async function markExpired(
  id: string,
  code: string,
  message: string,
): Promise<SessionCommand<never>> {
  await db
    .update(aiRelayAuthSession)
    .set({
      status: 'expired',
      failureCode: code,
      failureMessage: message.slice(0, 200),
      bearerSecretEnc: null,
      credentialScrubbed: true,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAuthSession.id, id))
  return fail(410, code, message)
}

async function markFailed(
  id: string,
  code: string,
  message: string,
  preserveHandle = false,
): Promise<SessionCommand<never>> {
  await db
    .update(aiRelayAuthSession)
    .set({
      status: 'failed',
      failureCode: code,
      failureMessage: message.slice(0, 200),
      bearerSecretEnc: preserveHandle ? undefined : null,
      credentialScrubbed: preserveHandle ? false : true,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAuthSession.id, id))
  return fail(403, code, message)
}

async function scheduleNextPoll(id: string, intervalSeconds: number): Promise<void> {
  const interval = clampInterval(intervalSeconds)
  await db
    .update(aiRelayAuthSession)
    .set({
      intervalSeconds: interval,
      nextPollAt: new Date(Date.now() + interval * 1000),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAuthSession.id, id))
}

/**
 * 轮询计数 +1。
 *
 * 刻意用「读回原行再写数字」而不是 `sql\`col + 1\`` 片段：片段形态会把 drizzle 的 SQL 对象
 * 写进会话行，任何把这行直接序列化出去的路径（审计导出 / 看板快照）都会撞上循环引用 ——
 * 而轮询本身低频，多一次读换掉一整类脏形态是划算的（并发下的少量丢计数如实接受：
 * 它只用于观测上游耐心，不参与任何裁决）。
 */
async function bumpPollAttempt(id: string): Promise<void> {
  const row = await loadSession(id)
  if (!row) return
  await db
    .update(aiRelayAuthSession)
    .set({ pollAttempts: Number(row.pollAttempts || 0) + 1, updatedAt: new Date() })
    .where(eq(aiRelayAuthSession.id, id))
}

/** 撤销：未终局才可撤，撤销即销毁把手（人不玩了就不该在库里留一把活票） */
export async function cancelAuthSession(
  id: string,
  actor: string | null,
): Promise<SessionCommand<AuthSessionView>> {
  const row = await loadSession(id)
  if (!row) return fail(404, 'session_not_found', '授权会话不存在')
  if (isTerminalStatus(row.status)) {
    return fail(409, 'already_terminal', `会话已是终局 ${row.status}，无需撤销`)
  }
  const [updated] = await db
    .update(aiRelayAuthSession)
    .set({
      status: 'cancelled',
      credentialScrubbed: true,
      bearerSecretEnc: null,
      failureCode: 'cancelled',
      failureMessage: `由 ${actor ?? 'system'} 撤销，把手已销毁`,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAuthSession.id, id))
    .returning()
  logger.info('relay auth session cancelled', { sessionId: id, actor })
  const reflected = updated ?? (await loadSession(id))
  if (!reflected) {
    return fail(
      500,
      'session_row_unreadable_after_cancel',
      '撤销动作已提交但会话行读不回，请核对该会话状态',
    )
  }
  return {
    ok: true,
    data: toView(reflected, authCapabilityFor(row.providerCode, row.kind)?.note ?? null),
  }
}

/** 只读列表（看板 / 审计面）。默认**不含终局**，要历史必须显式说 includeTerminal */
export async function listAuthSessions(opts: {
  providerCode?: string
  status?: AuthSessionStatus
  includeTerminal?: boolean
  limit?: number
}): Promise<AuthSessionView[]> {
  const conds = []
  if (opts.providerCode) conds.push(eq(aiRelayAuthSession.providerCode, opts.providerCode))
  if (opts.status) conds.push(eq(aiRelayAuthSession.status, opts.status))
  if (!opts.status && !opts.includeTerminal) {
    conds.push(
      or(eq(aiRelayAuthSession.status, 'pending'), eq(aiRelayAuthSession.status, 'authorized')),
    )
  }
  const rows = await dbRead
    .select()
    .from(aiRelayAuthSession)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(aiRelayAuthSession.createdAt))
    .limit(Math.max(1, Math.min(200, opts.limit ?? 50)))
  return rows.map((r) => toView(r, authCapabilityFor(r.providerCode, r.kind)?.note ?? null))
}

/** 能力声明回显（前端据此把未实证的档灰掉并把出路原样显示，不在 UI 里另写一套说法） */
export function listAuthCapabilities(providerCode?: string): AuthCapability[] {
  const all = effectiveCapabilities()
  return providerCode ? all.filter((c) => c.providerCode === providerCode) : all
}

/** 调度腿：到期清扫（只动非终局行，绝不改判已入池的会话） */
export async function sweepExpiredAuthSessions(
  now = new Date(),
): Promise<{ expired: number; candidates: number }> {
  const where = and(
    or(eq(aiRelayAuthSession.status, 'pending'), eq(aiRelayAuthSession.status, 'authorized')),
    lt(aiRelayAuthSession.expiresAt, now),
  )
  const res = await db
    .update(aiRelayAuthSession)
    .set({
      status: 'expired',
      credentialScrubbed: true,
      bearerSecretEnc: null,
      failureCode: 'expired_swept',
      failureMessage: '扫描腿判定会话超过寿命并已销毁把手',
      finishedAt: now,
      updatedAt: now,
    })
    .where(where)
    .returning({ id: aiRelayAuthSession.id })
  return { expired: res.length, candidates: res.length }
}

/** 调度腿：本轮该轮询的会话 id（pending ∧ 到点 ∧ 未过期；limit 夹在 200 防单轮打爆上游） */
export async function duePollableSessionIds(limit = 50, now = new Date()): Promise<string[]> {
  const rows = await dbRead
    .select({ id: aiRelayAuthSession.id })
    .from(aiRelayAuthSession)
    .where(
      and(
        eq(aiRelayAuthSession.status, 'pending'),
        or(isNull(aiRelayAuthSession.nextPollAt), lte(aiRelayAuthSession.nextPollAt, now)),
        gt(aiRelayAuthSession.expiresAt, now),
      ),
    )
    .orderBy(asc(aiRelayAuthSession.nextPollAt))
    .limit(Math.max(1, Math.min(200, limit)))
  return rows.map((r) => r.id)
}

/** 调度腿：把一批到期会话各轮询一次（单个失败绝不中断整批；逐条回显终局计数） */
export async function runAuthSessionPollSweep(
  limit = 20,
  now = new Date(),
): Promise<{ checked: number; imported: number; stillWaiting: number; terminal: number }> {
  const ids = await duePollableSessionIds(limit, now)
  let imported = 0
  let stillWaiting = 0
  let terminal = 0
  for (const id of ids) {
    const r = await pollAuthSession(id)
    if (r.ok && r.data.status === 'imported') imported += 1
    else if (r.ok && !isTerminalStatus(r.data.status)) stillWaiting += 1
    else terminal += 1
  }
  return { checked: ids.length, imported, stillWaiting, terminal }
}

export const __test__ = {
  toView,
  decodeHandle,
  applyPollOutcome,
  finalizeImport,
  resolveImportedAccountId,
  markAuthorizedRetry,
  markExpired,
  markFailed,
  scheduleNextPoll,
  bumpPollAttempt,
  listAuthCapabilities,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
