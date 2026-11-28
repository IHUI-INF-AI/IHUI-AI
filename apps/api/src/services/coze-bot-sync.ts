// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * Coze BotInfo 拉取、全量落库与覆盖率统计。
 *
 * 端点优先级：
 *  1. `GET /v1/bots/:bot_id?is_published=true` —— 完整配置（推荐，官方 getMetadata 权限）
 *  2. 若未发布且允许草稿：`GET /v1/bots/:bot_id?is_published=false`
 *  3. 兼容旧端点：`GET /v1/bot/get_online_info?bot_id=...`（只返回在线子集，标记 partial）
 *
 * 没拿到 token 时不伪造数据：抛 `COZE_TOKEN_MISSING`，由路由返回 503；
 * 批量同步入口在发请求前先检查凭据，避免把 116 条全部写成 error。
 */

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import {
  agents,
  cozeBotSnapshots,
  cozeVariables,
  type Agent,
  type CozeVariable,
} from '@ihui/database'
import type { CozeBotConfig } from '@ihui/types'
import { db, dbRead } from '../db/index.js'
import { mapCozeBotConfig, toCozePublicCapabilities, type CozeConfigSource } from '../lib/coze-bot-config.js'
import { getCozeAccessToken, loadCozeOAuthConfig } from './coze-auth-utils.js'
import { COZE_DISABLED_MESSAGE, COZE_INTEGRATION_ENABLED } from '../lib/coze-integration.js'

const DEFAULT_COZE_BASE_URL = 'https://api.coze.cn'
const FETCH_TIMEOUT_MS = 20000
const MAX_SYNC_BATCH = 100
const DEFAULT_SYNC_BATCH = 25

export type CozeSyncErrorCode =
  | 'COZE_TOKEN_MISSING'
  | 'COZE_BOT_ID_MISSING'
  | 'COZE_AGENT_NOT_FOUND'
  | 'COZE_BOT_NOT_FOUND'
  | 'COZE_HTTP_ERROR'
  | 'COZE_API_ERROR'
  | 'COZE_TIMEOUT'
  | 'COZE_RESPONSE_INVALID'
  | 'COZE_DISABLED'

export class CozeSyncError extends Error {
  code: CozeSyncErrorCode
  cozeCode: number | null
  statusCode: number
  detail: string

  constructor(
    code: CozeSyncErrorCode,
    message: string,
    opts: { cozeCode?: number | null; statusCode?: number; detail?: string } = {},
  ) {
    super(message)
    this.name = 'CozeSyncError'
    this.code = code
    this.cozeCode = opts.cozeCode ?? null
    this.statusCode = opts.statusCode ?? 500
    this.detail = opts.detail ?? ''
  }
}

export interface CozeCredentialStatus {
  configured: boolean
  mode: 'pat' | 'oauth' | 'none'
  envName: string | null
  baseUrl: string
}

function resolveCozeBaseUrl(): string {
  return (process.env.COZE_API_BASE_URL || process.env.COZE_API_BASE || DEFAULT_COZE_BASE_URL).replace(
    /\/$/,
    '',
  )
}

export function getCozeCredentialStatus(): CozeCredentialStatus {
  if (!COZE_INTEGRATION_ENABLED) {
    return { configured: false, mode: 'none', envName: null, baseUrl: resolveCozeBaseUrl() }
  }
  if (loadCozeOAuthConfig()) {
    return {
      configured: true,
      mode: 'oauth',
      envName: 'COZE_OAUTH_JWT',
      baseUrl: resolveCozeBaseUrl(),
    }
  }
  const candidates = ['COZE_API_KEY', 'COZE_API_TOKEN', 'COZE_PAT_TOKEN'] as const
  for (const name of candidates) {
    if (process.env[name]?.trim()) {
      return {
        configured: true,
        mode: 'pat',
        envName: name,
        baseUrl: resolveCozeBaseUrl(),
      }
    }
  }
  return {
    configured: false,
    mode: 'none',
    envName: null,
    baseUrl: resolveCozeBaseUrl(),
  }
}

async function resolveCozeToken(): Promise<string> {
  // OAuth JWT 优先：一次配置长期自动换 token，PAT 只作为兜底。
  if (loadCozeOAuthConfig()) {
    const oauthToken = await getCozeAccessToken()
    if (oauthToken) return oauthToken
    console.error('[coze-bot-sync] OAuth JWT 未取到 token，回退 PAT')
  }
  const token =
    process.env.COZE_API_KEY?.trim() ||
    process.env.COZE_API_TOKEN?.trim() ||
    process.env.COZE_PAT_TOKEN?.trim() ||
    ''
  if (!token) {
    throw new CozeSyncError(
      'COZE_TOKEN_MISSING',
      'COZE_OAUTH_APP_ID/COZE_PUBLIC_KEY_ID/COZE_PRIVATE_KEY(_PATH) 与 PAT 均未配置',
      { statusCode: 503 },
    )
  }
  return token
}

interface CozeApiEnvelope<T> {
  code: number
  msg?: string
  data?: T
  detail?: { logid?: string }
}

interface CozeFetchResult {
  data: CozeBotConfig
  source: Exclude<CozeConfigSource, 'legacy_cache'>
  isPublished: boolean
  cozeCode: number
  logid?: string
}

async function cozeGet<T>(
  token: string,
  baseUrl: string,
  path: string,
  params?: Record<string, string>,
): Promise<CozeApiEnvelope<T>> {
  const url = new URL(`${baseUrl}${path}`)
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
    const text = await res.text().catch(() => '')
    let body: CozeApiEnvelope<T>
    try {
      body = JSON.parse(text) as CozeApiEnvelope<T>
    } catch {
      throw new CozeSyncError('COZE_RESPONSE_INVALID', `Coze 返回非 JSON（HTTP ${res.status}）`, {
        statusCode: 502,
        detail: text.slice(0, 500),
      })
    }
    if (!res.ok && body.code === undefined) {
      throw new CozeSyncError('COZE_HTTP_ERROR', `Coze HTTP ${res.status}`, {
        statusCode: 502,
        detail: text.slice(0, 500),
      })
    }
    return body
  } catch (err) {
    if (err instanceof CozeSyncError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new CozeSyncError('COZE_TIMEOUT', `Coze 请求超时（>${FETCH_TIMEOUT_MS}ms）`, {
        statusCode: 504,
      })
    }
    throw new CozeSyncError('COZE_HTTP_ERROR', err instanceof Error ? err.message : String(err), {
      statusCode: 502,
    })
  } finally {
    clearTimeout(timer)
  }
}

function unwrapBotConfig(data: unknown): CozeBotConfig {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const record = data as Record<string, unknown>
    const nested = record.bot_info
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as CozeBotConfig
    }
    return record as CozeBotConfig
  }
  return {}
}

async function fetchBotConfig(
  token: string,
  baseUrl: string,
  botId: string,
  isPublished: boolean,
): Promise<CozeFetchResult> {
  const body = await cozeGet<CozeBotConfig>(token, baseUrl, `/v1/bots/${encodeURIComponent(botId)}`, {
    is_published: String(isPublished),
  })
  if (body.code === 0) {
    const data = unwrapBotConfig(body.data)
    if (!data.bot_id && !data.name) {
      throw new CozeSyncError('COZE_RESPONSE_INVALID', 'Coze 返回空 BotInfo', {
        statusCode: 502,
        detail: JSON.stringify(body).slice(0, 500),
      })
    }
    return { data, source: 'get_bot_config', isPublished, cozeCode: body.code, logid: body.detail?.logid }
  }
  // Coze 对不存在/已删除 Bot 可能返回两种业务码：
  //  - 4000 + "The parameter BotId is invalid"
  //  - 4200 + "Requested resource bot does not exist ..."（HTTP 404）
  if (
    (body.code === 4000 || body.code === 4200) &&
    /bot|resource identifier|resource does not exist/i.test(body.msg ?? '')
  ) {
    throw new CozeSyncError('COZE_BOT_NOT_FOUND', 'Coze 上游不存在该 Bot（可能已删除或未发布）', {
      cozeCode: body.code,
      statusCode: 404,
      detail: body.msg ?? '',
    })
  }
  throw new CozeSyncError('COZE_API_ERROR', body.msg || `Coze 业务错误 code=${body.code}`, {
    cozeCode: body.code,
    statusCode: 502,
    detail: JSON.stringify(body.detail ?? {}),
  })
}

async function fetchOnlineInfo(
  token: string,
  baseUrl: string,
  botId: string,
): Promise<CozeFetchResult> {
  const body = await cozeGet<CozeBotConfig>(token, baseUrl, '/v1/bot/get_online_info', {
    bot_id: botId,
  })
  if (body.code === 0) {
    const data = unwrapBotConfig(body.data)
    return { data, source: 'get_online_info', isPublished: true, cozeCode: body.code, logid: body.detail?.logid }
  }
  throw new CozeSyncError('COZE_API_ERROR', body.msg || `Coze 业务错误 code=${body.code}`, {
    cozeCode: body.code,
    statusCode: 502,
    detail: JSON.stringify(body.detail ?? {}),
  })
}

/**
 * 优先完整配置；未发布时按 allowDraft 取草稿；完整端点不可用时回退在线版。
 * 鉴权错误（4101/401）不降级，避免把权限问题误报为“bot 不存在”。
 */
async function fetchCozeBot(
  botId: string,
  opts: { isPublished: boolean; allowDraft: boolean },
): Promise<CozeFetchResult> {
  const token = await resolveCozeToken()
  const baseUrl = getCozeCredentialStatus().baseUrl
  let firstError: CozeSyncError | null = null
  try {
    return await fetchBotConfig(token, baseUrl, botId, opts.isPublished)
  } catch (err) {
    firstError = err instanceof CozeSyncError ? err : new CozeSyncError('COZE_API_ERROR', String(err))
    if (firstError.cozeCode === 4101 || firstError.statusCode === 401) throw firstError
  }

  if (opts.allowDraft && opts.isPublished) {
    try {
      return await fetchBotConfig(token, baseUrl, botId, false)
    } catch (err) {
      const draftError = err instanceof CozeSyncError ? err : new CozeSyncError('COZE_API_ERROR', String(err))
      if (draftError.cozeCode === 4101 || draftError.statusCode === 401) throw draftError
    }
  }

  try {
    return await fetchOnlineInfo(token, baseUrl, botId)
  } catch (err) {
    const onlineError = err instanceof CozeSyncError ? err : new CozeSyncError('COZE_API_ERROR', String(err))
    if (onlineError.cozeCode === 4101 || onlineError.statusCode === 401) throw onlineError
    if (firstError) {
      throw new CozeSyncError(firstError.code, firstError.message, {
        cozeCode: firstError.cozeCode,
        statusCode: firstError.statusCode,
        detail: `get_bot_config: ${firstError.detail}; get_online_info: ${onlineError.detail}`,
      })
    }
    throw onlineError
  }
}

export interface SyncAgentResult {
  agentId: string
  botId: string | null
  status: 'synced' | 'partial' | 'error' | 'not_found' | 'skipped_no_token'
  source: CozeConfigSource | null
  isPublished: boolean | null
  updatedFields: string[]
  variables: number
  snapshotCreated: boolean
  message: string
}

export interface SyncAgentOptions {
  isPublished?: boolean
  allowDraft?: boolean
}

async function markSyncFailure(agent: Agent, err: CozeSyncError): Promise<void> {
  await db
    .update(agents)
    .set({
      cozeConfigStatus:
        err.code === 'COZE_TOKEN_MISSING'
          ? 'skipped_no_token'
          : err.code === 'COZE_BOT_NOT_FOUND'
            ? 'not_found'
            : 'error',
      cozeConfigError: `${err.code}: ${err.message}`.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(agents.agentId, agent.agentId))
}

export async function syncAgentCozeConfig(
  agent: Agent,
  opts: SyncAgentOptions = {},
): Promise<SyncAgentResult> {
  if (!COZE_INTEGRATION_ENABLED) {
    throw new CozeSyncError('COZE_DISABLED', COZE_DISABLED_MESSAGE, { statusCode: 410 })
  }
  if (!agent.botId) {
    const err = new CozeSyncError('COZE_BOT_ID_MISSING', 'agent.botId 为空，无法定位 Coze 智能体', {
      statusCode: 400,
    })
    await markSyncFailure(agent, err)
    throw err
  }

  const fetched = await fetchCozeBot(agent.botId, {
    isPublished: opts.isPublished ?? true,
    allowDraft: opts.allowDraft ?? true,
  })
  const mapped = mapCozeBotConfig(fetched.data, fetched.source)
  if (fetched.source === 'get_bot_config' && fetched.data.bot_id && fetched.data.bot_id !== agent.botId) {
    mapped.patch.botId = fetched.data.bot_id
  }

  let snapshotCreated = false
  await db.transaction(async (tx) => {
    await tx
      .update(agents)
      .set({ ...mapped.patch, updatedAt: new Date() })
      .where(eq(agents.agentId, agent.agentId))

    const inserted = await tx
      .insert(cozeBotSnapshots)
      .values({
        agentId: agent.agentId,
        botId: agent.botId!,
        source: fetched.source,
        isPublished: fetched.isPublished,
        version: mapped.version,
        payload: mapped.payload,
        payloadHash: mapped.hash,
        fetchedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: cozeBotSnapshots.id })
    snapshotCreated = inserted.length > 0

    const rows = mapped.variables
      .filter((v) => typeof v.keyword === 'string' && v.keyword.trim() !== '')
      .map((v) => ({
        botId: agent.botId!,
        variableName: v.keyword!.slice(0, 100),
        variableValue: v.default_value ?? null,
        description: v.description ?? null,
        dataType: 'string',
        enabled: v.enable ?? true,
        promptEnable: v.prompt_enable ?? true,
        channel: (v.channel ?? 'custom').slice(0, 20),
        raw: v as Record<string, unknown>,
        syncedAt: new Date(),
      }))
    for (const row of rows) {
      await tx
        .insert(cozeVariables)
        .values(row)
        .onConflictDoUpdate({
          target: [cozeVariables.botId, cozeVariables.variableName],
          set: {
            variableValue: row.variableValue,
            description: row.description,
            dataType: row.dataType,
            enabled: row.enabled,
            promptEnable: row.promptEnable,
            channel: row.channel,
            raw: row.raw,
            syncedAt: row.syncedAt,
            updatedAt: new Date(),
          },
        })
    }
  })

  return {
    agentId: agent.agentId,
    botId: agent.botId,
    status: fetched.source === 'get_bot_config' ? 'synced' : 'partial',
    source: fetched.source,
    isPublished: fetched.isPublished,
    updatedFields: mapped.updatedFields,
    variables: mapped.variables.length,
    snapshotCreated,
    message:
      fetched.source === 'get_bot_config'
        ? `已同步完整 BotInfo${fetched.isPublished ? '' : '（草稿版）'}`
        : '完整配置端点不可用，已回退在线版并标记 partial',
  }
}

export interface SyncManyOptions extends SyncAgentOptions {
  agentIds?: string[]
  limit?: number
  concurrency?: number
}

export interface SyncManyResult {
  requested: number
  synced: number
  partial: number
  errors: number
  notFound: number
  remaining: number
  results: SyncAgentResult[]
}

export async function syncManyCozeAgents(opts: SyncManyOptions = {}): Promise<SyncManyResult> {
  if (!COZE_INTEGRATION_ENABLED) {
    throw new CozeSyncError('COZE_DISABLED', COZE_DISABLED_MESSAGE, { statusCode: 410 })
  }
  // 凭据缺失直接 503，不逐条写库；否则 116 条都会被标成 skipped_no_token。
  await resolveCozeToken()
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_SYNC_BATCH, 1), MAX_SYNC_BATCH)
  const concurrency = Math.min(Math.max(opts.concurrency ?? 4, 1), 8)
  const conditions = [isNotNull(agents.botId)]
  if (opts.agentIds?.length) conditions.push(inArray(agents.agentId, opts.agentIds))
  const candidates = await dbRead
    .select()
    .from(agents)
    .where(and(...conditions))
    .orderBy(sql`${agents.cozeConfigSyncedAt} asc nulls first`, asc(agents.createdAt))
    .limit(limit)

  const results: SyncAgentResult[] = []
  let remaining = 0
  if (!opts.agentIds?.length) {
    const countRows = await dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .where(and(...conditions))
    remaining = Math.max((countRows[0]?.count ?? 0) - candidates.length, 0)
  }

  let cursor = 0
  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= candidates.length) return
      const agent = candidates[index]!
      try {
        results.push(await syncAgentCozeConfig(agent, opts))
      } catch (err) {
        const e =
          err instanceof CozeSyncError ? err : new CozeSyncError('COZE_API_ERROR', String(err))
        await markSyncFailure(agent, e)
        results.push({
          agentId: agent.agentId,
          botId: agent.botId,
          status:
            e.code === 'COZE_TOKEN_MISSING'
              ? 'skipped_no_token'
              : e.code === 'COZE_BOT_NOT_FOUND'
                ? 'not_found'
                : 'error',
          source: null,
          isPublished: null,
          updatedFields: [],
          variables: 0,
          snapshotCreated: false,
          message: `${e.code}: ${e.message}`,
        })
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return {
    requested: candidates.length,
    synced: results.filter((r) => r.status === 'synced').length,
    partial: results.filter((r) => r.status === 'partial').length,
    errors: results.filter((r) => r.status === 'error').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    remaining,
    results,
  }
}

export interface CozeAgentConfigView {
  agentId: string
  name: string
  botId: string | null
  botName: string | null
  status: string
  source: string | null
  error: string | null
  syncedAt: Date | null
  hash: string | null
  version: string | null
  prompt: {
    text: string | null
    mode: string | null
    prefixPrompt: Record<string, unknown> | null
  }
  model: {
    id: string | null
    name: string | null
    temperature: string | null
    topP: string | null
    topK: number | null
    maxTokens: number | null
    contextRound: number | null
    responseFormat: string | null
    presencePenalty: string | null
    frequencyPenalty: string | null
    parameters: Record<string, unknown> | null
  }
  onboarding: Record<string, unknown> | null
  prologue: string | null
  suggestedQuestions: unknown
  plugins: unknown[] | null
  workflows: unknown[] | null
  knowledge: unknown[] | null
  shortcutCommands: unknown[] | null
  voices: unknown[] | null
  mediaConfig: Record<string, unknown> | null
  backgroundImage: Record<string, unknown> | null
  suggestReply: Record<string, unknown> | null
  botMode: number | null
  defaultUserInputType: string | null
  folderId: string | null
  ownerUserId: string | null
  iconUrl: string | null
  description: string | null
  createTime: number | null
  updateTime: number | null
  variables: CozeVariable[]
  publicCapabilities: ReturnType<typeof toCozePublicCapabilities>
  raw: Record<string, unknown> | null
  snapshots: Array<{
    id: string
    source: string
    version: string | null
    payloadHash: string
    fetchedAt: Date
    isPublished: boolean | null
  }>
}

export async function getCozeAgentConfigView(
  agent: Agent,
): Promise<CozeAgentConfigView> {
  const variables = agent.botId
    ? await dbRead
        .select()
        .from(cozeVariables)
        .where(eq(cozeVariables.botId, agent.botId))
        .orderBy(asc(cozeVariables.variableName))
    : []
  const snapshots = await dbRead
    .select({
      id: cozeBotSnapshots.id,
      source: cozeBotSnapshots.source,
      version: cozeBotSnapshots.version,
      payloadHash: cozeBotSnapshots.payloadHash,
      fetchedAt: cozeBotSnapshots.fetchedAt,
      isPublished: cozeBotSnapshots.isPublished,
    })
    .from(cozeBotSnapshots)
    .where(eq(cozeBotSnapshots.agentId, agent.agentId))
    .orderBy(desc(cozeBotSnapshots.fetchedAt))
    .limit(10)

  return {
    agentId: agent.agentId,
    name: agent.name,
    botId: agent.botId ?? null,
    botName: agent.botName ?? null,
    status: agent.cozeConfigStatus,
    source: agent.cozeConfigSource ?? null,
    error: agent.cozeConfigError ?? null,
    syncedAt: agent.cozeConfigSyncedAt ?? null,
    hash: agent.cozeConfigHash ?? null,
    version: agent.cozeConfigVersion ?? null,
    prompt: {
      text: agent.agentPrompt ?? null,
      mode: agent.agentPromptMode ?? null,
      prefixPrompt: (agent.agentPrefixPrompt as Record<string, unknown> | null) ?? null,
    },
    model: {
      id: agent.cozeModelId ?? null,
      name: agent.cozeModelName ?? null,
      temperature: agent.agentTemperature ?? null,
      topP: agent.cozeTopP ?? null,
      topK: agent.cozeTopK ?? null,
      maxTokens: agent.agentMaxTokens ?? null,
      contextRound: agent.cozeContextRound ?? null,
      responseFormat: agent.cozeResponseFormat ?? null,
      presencePenalty: agent.cozePresencePenalty ?? null,
      frequencyPenalty: agent.cozeFrequencyPenalty ?? null,
      parameters: (agent.cozeModelParameters as Record<string, unknown> | null) ?? null,
    },
    onboarding: (agent.cozeOnboarding as Record<string, unknown> | null) ?? null,
    prologue: agent.cozePrologue ?? null,
    suggestedQuestions: (() => {
      if (!agent.suggestedQuestions) return null
      try {
        return JSON.parse(agent.suggestedQuestions)
      } catch {
        return null
      }
    })(),
    plugins: (agent.cozePlugins as unknown[] | null) ?? null,
    workflows: (agent.cozeWorkflows as unknown[] | null) ?? null,
    knowledge: (agent.cozeKnowledge as unknown[] | null) ?? null,
    shortcutCommands: (agent.cozeShortcutCommands as unknown[] | null) ?? null,
    voices: (agent.cozeVoices as unknown[] | null) ?? null,
    mediaConfig: (agent.cozeMediaConfig as Record<string, unknown> | null) ?? null,
    backgroundImage: (agent.cozeBackgroundImage as Record<string, unknown> | null) ?? null,
    suggestReply: (agent.cozeSuggestReply as Record<string, unknown> | null) ?? null,
    botMode: agent.cozeBotMode ?? null,
    defaultUserInputType: agent.cozeDefaultUserInputType ?? null,
    folderId: agent.cozeFolderId ?? null,
    ownerUserId: agent.cozeOwnerUserId ?? null,
    iconUrl: agent.cozeIconUrl ?? null,
    description: agent.cozeDescription ?? null,
    createTime: agent.cozeCreateTime ?? null,
    updateTime: agent.cozeUpdateTime ?? null,
    variables,
    publicCapabilities: toCozePublicCapabilities(agent),
    raw: (agent.cozeConfigRaw as Record<string, unknown> | null) ?? null,
    snapshots,
  }
}

export interface CozeCoverage {
  credentials: CozeCredentialStatus
  totalBots: number
  status: {
    synced: number
    partial: number
    error: number
    not_found: number
    skipped_no_token: number
    never: number
  }
  fieldCoverage: Array<{ key: string; label: string; nonNull: number }>
  variables: { rows: number; bots: number }
  lastSyncedAt: Date | null
  batch: { size: number; max: number; concurrency: number }
}

export async function getCozeCoverage(): Promise<CozeCoverage> {
  const baseWhere = isNotNull(agents.botId)
  const [statusRows, fieldRows, variableRows] = await Promise.all([
    dbRead
      .select({
        total: sql<number>`count(*)::int`,
        synced: sql<number>`count(*) filter (where ${agents.cozeConfigStatus} = 'synced')::int`,
        partial: sql<number>`count(*) filter (where ${agents.cozeConfigStatus} = 'partial')::int`,
        error: sql<number>`count(*) filter (where ${agents.cozeConfigStatus} = 'error')::int`,
        notFound: sql<number>`count(*) filter (where ${agents.cozeConfigStatus} = 'not_found')::int`,
        skipped: sql<number>`count(*) filter (where ${agents.cozeConfigStatus} = 'skipped_no_token')::int`,
        never: sql<number>`count(*) filter (where ${agents.cozeConfigStatus} = 'never')::int`,
        lastSyncedAt: sql<Date | null>`max(${agents.cozeConfigSyncedAt})`,
      })
      .from(agents)
      .where(baseWhere),
    dbRead
      .select({
        prompt: sql<number>`count(*) filter (where ${agents.agentPrompt} is not null)::int`,
        promptMode: sql<number>`count(*) filter (where ${agents.agentPromptMode} is not null)::int`,
        modelId: sql<number>`count(*) filter (where ${agents.cozeModelId} is not null)::int`,
        modelName: sql<number>`count(*) filter (where ${agents.cozeModelName} is not null)::int`,
        temperature: sql<number>`count(*) filter (where ${agents.agentTemperature} is not null)::int`,
        topP: sql<number>`count(*) filter (where ${agents.cozeTopP} is not null)::int`,
        topK: sql<number>`count(*) filter (where ${agents.cozeTopK} is not null)::int`,
        maxTokens: sql<number>`count(*) filter (where ${agents.agentMaxTokens} is not null)::int`,
        contextRound: sql<number>`count(*) filter (where ${agents.cozeContextRound} is not null)::int`,
        responseFormat: sql<number>`count(*) filter (where ${agents.cozeResponseFormat} is not null)::int`,
        presence: sql<number>`count(*) filter (where ${agents.cozePresencePenalty} is not null)::int`,
        frequency: sql<number>`count(*) filter (where ${agents.cozeFrequencyPenalty} is not null)::int`,
        modelParameters: sql<number>`count(*) filter (where ${agents.cozeModelParameters} is not null)::int`,
        botMode: sql<number>`count(*) filter (where ${agents.cozeBotMode} is not null)::int`,
        inputType: sql<number>`count(*) filter (where ${agents.cozeDefaultUserInputType} is not null)::int`,
        onboarding: sql<number>`count(*) filter (where ${agents.cozeOnboarding} is not null)::int`,
        prologue: sql<number>`count(*) filter (where ${agents.cozePrologue} is not null)::int`,
        plugins: sql<number>`count(*) filter (where ${agents.cozePlugins} is not null)::int`,
        workflows: sql<number>`count(*) filter (where ${agents.cozeWorkflows} is not null)::int`,
        knowledge: sql<number>`count(*) filter (where ${agents.cozeKnowledge} is not null)::int`,
        shortcuts: sql<number>`count(*) filter (where ${agents.cozeShortcutCommands} is not null)::int`,
        voices: sql<number>`count(*) filter (where ${agents.cozeVoices} is not null)::int`,
        media: sql<number>`count(*) filter (where ${agents.cozeMediaConfig} is not null)::int`,
        background: sql<number>`count(*) filter (where ${agents.cozeBackgroundImage} is not null)::int`,
        suggestReply: sql<number>`count(*) filter (where ${agents.cozeSuggestReply} is not null)::int`,
        variables: sql<number>`count(*) filter (where ${agents.cozeVariablesRaw} is not null)::int`,
        raw: sql<number>`count(*) filter (where ${agents.cozeConfigRaw} is not null)::int`,
      })
      .from(agents)
      .where(baseWhere),
    dbRead
      .select({
        rows: sql<number>`count(*)::int`,
        bots: sql<number>`count(distinct ${cozeVariables.botId})::int`,
      })
      .from(cozeVariables),
  ])

  const s = statusRows[0]
  const f = fieldRows[0]
  const labels: Array<[keyof NonNullable<typeof f>, string]> = [
    ['prompt', '提示词 prompt'],
    ['promptMode', '提示词模式 prompt_mode'],
    ['modelId', '模型 ID model_id'],
    ['modelName', '模型名 model_name'],
    ['temperature', '温度 temperature'],
    ['topP', 'Top P'],
    ['topK', 'Top K'],
    ['maxTokens', '最大 token'],
    ['contextRound', '上下文轮数'],
    ['responseFormat', '输出格式'],
    ['presence', '重复主题惩罚'],
    ['frequency', '重复语句惩罚'],
    ['modelParameters', '模型扩展参数'],
    ['botMode', 'Bot 模式'],
    ['inputType', '默认输入方式'],
    ['onboarding', '开场白对象'],
    ['prologue', '开场白'],
    ['plugins', '插件'],
    ['workflows', '工作流'],
    ['knowledge', '知识库'],
    ['shortcuts', '快捷指令'],
    ['voices', '音色'],
    ['media', '语音通话配置'],
    ['background', '背景图配置'],
    ['suggestReply', '问题建议配置'],
    ['variables', '变量数组'],
    ['raw', '原始 payload'],
  ]

  return {
    credentials: getCozeCredentialStatus(),
    totalBots: s?.total ?? 0,
    status: {
      synced: s?.synced ?? 0,
      partial: s?.partial ?? 0,
      error: s?.error ?? 0,
      not_found: s?.notFound ?? 0,
      skipped_no_token: s?.skipped ?? 0,
      never: s?.never ?? 0,
    },
    fieldCoverage: labels.map(([key, label]) => ({
      key,
      label,
      nonNull: f?.[key] ?? 0,
    })),
    variables: { rows: variableRows[0]?.rows ?? 0, bots: variableRows[0]?.bots ?? 0 },
    lastSyncedAt: s?.lastSyncedAt ?? null,
    batch: { size: DEFAULT_SYNC_BATCH, max: MAX_SYNC_BATCH, concurrency: 4 },
  }
}
