// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tenantPlatformApps } from '@ihui/database'
import { config } from '../config/index.js'
import { decryptCredential, encryptCredential } from '../utils/crypto.js'

export const TENANT_PLATFORM_IDS = ['feishu', 'dingtalk', 'wecom', 'wechat', 'wechat_mp'] as const
export type TenantPlatformId = (typeof TENANT_PLATFORM_IDS)[number]

export interface PlatformCredentials {
  appId: string
  appSecret: string
  /** 平台附加字段；不含密钥 */
  extra: Record<string, string>
  source: 'tenant' | 'platform_env'
}

export interface TenantPlatformAppStatus {
  platform: TenantPlatformId
  configured: boolean
  enabled: boolean
  appId: string
  appSecretMasked: string
  extra: Record<string, string>
  source: 'tenant' | 'platform_env' | 'none'
}

export class TenantPlatformAppError extends Error {
  constructor(
    public readonly code:
      | 'PLATFORM_INVALID'
      | 'CREDENTIALS_MISSING'
      | 'CREDENTIALS_DISABLED'
      | 'CREDENTIALS_CORRUPTED'
      | 'SECRET_REQUIRED'
      | 'ENV_SCOPE_FORBIDDEN',
    message: string,
  ) {
    super(message)
    this.name = 'TenantPlatformAppError'
  }
}

export function isTenantPlatformId(value: string): value is TenantPlatformId {
  return (TENANT_PLATFORM_IDS as readonly string[]).includes(value)
}

/**
 * 现有单企业部署的环境凭据映射（唯一出口）。
 *
 * 这套键就是项目里已经配好的那套飞书/钉钉/企微/微信自建应用；
 * 多企业 SaaS 下它只允许归属 `PLATFORM_DEFAULT_TENANT_ID` 或没有租户上下文的单租户请求。
 */
export function envPlatformCredentials(platform: TenantPlatformId): {
  appId: string
  appSecret: string
  extra: Record<string, string>
} {
  const env = process.env
  switch (platform) {
    case 'feishu':
      return {
        appId: (env.FEISHU_APP_ID ?? '').trim(),
        appSecret: (env.FEISHU_APP_SECRET ?? '').trim(),
        extra: pickNonEmpty({
          redirect_uri: env.FEISHU_REDIRECT_URI,
          scope: env.FEISHU_SCOPE,
        }),
      }
    case 'dingtalk':
      return {
        appId: (env.DINGTALK_APP_KEY ?? env.DINGTALK_APPKEY ?? '').trim(),
        appSecret: (env.DINGTALK_APP_SECRET ?? env.DINGTALK_APPSECRET ?? '').trim(),
        extra: pickNonEmpty({ redirect_uri: env.DINGTALK_REDIRECT_URI }),
      }
    case 'wecom':
      return {
        appId: (env.WECOM_CORP_ID ?? '').trim(),
        appSecret: (env.WECOM_SECRET ?? '').trim(),
        extra: pickNonEmpty({
          agent_id: env.WECOM_AGENT_ID,
          redirect_uri: env.WECOM_REDIRECT_URI,
        }),
      }
    case 'wechat':
      return {
        appId: (env.WECHAT_APP_ID ?? '').trim(),
        appSecret: (env.WECHAT_APP_SECRET ?? '').trim(),
        extra: pickNonEmpty({ redirect_uri: env.WECHAT_REDIRECT_URI }),
      }
    case 'wechat_mp':
      return {
        appId: (env.WECHAT_MP_APP_ID ?? env.WECHAT_MP_APPID ?? '').trim(),
        appSecret: (env.WECHAT_MP_APP_SECRET ?? env.WECHAT_MP_APPSECRET ?? '').trim(),
        extra: pickNonEmpty({ redirect_uri: env.WECHAT_MP_REDIRECT_URI }),
      }
  }
}

function pickNonEmpty(input: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    const trimmed = (value ?? '').trim()
    if (trimmed) out[key] = trimmed
  }
  return out
}

export function hasEnvPlatformCredentials(platform: TenantPlatformId): boolean {
  const creds = envPlatformCredentials(platform)
  return Boolean(creds.appId && creds.appSecret)
}

/** 环境凭据可回退的租户：没有租户上下文、显式单租户模式、或显式指定为默认租户。 */
export function canUsePlatformEnv(tenantId: string | null | undefined): boolean {
  if (!tenantId) return true
  // 单租户部署显式关掉严格模式(TENANT_STRICT_MODE=false)时,环境凭据就是该部署的唯一凭据。
  const strictMode = (process.env.TENANT_STRICT_MODE ?? '').trim().toLowerCase()
  if (strictMode === 'false') return true
  return canImportPlatformEnv(tenantId)
}

/**
 * 写路径专用：只有被显式指定为默认租户的那一个租户可以把环境凭据“拷进自己家”。
 * 不复用 `canUsePlatformEnv` 的严格模式旁路 —— 读可以按单租户降级，写不能。
 */
export function canImportPlatformEnv(tenantId: string): boolean {
  const defaultTenantId = config.PLATFORM_DEFAULT_TENANT_ID.trim()
  return Boolean(defaultTenantId) && tenantId === defaultTenantId
}

/**
 * 解析某个租户在某个平台上应使用的应用凭据。
 *
 * 顺序：租户自己的启用行 → 默认租户/无租户上下文回退环境凭据 → 拒绝。
 * 绝不把 A 租户的行借给 B 租户；找不到就是找不到，不静默复用别的企业应用。
 */
export async function resolveTenantPlatformCredentials(
  tenantId: string | null | undefined,
  platform: TenantPlatformId,
): Promise<PlatformCredentials> {
  const row = await findTenantPlatformApp(tenantId, platform)
  if (row) {
    if (!row.enabled) {
      throw new TenantPlatformAppError(
        'CREDENTIALS_DISABLED',
        `租户已停用 ${platform} 平台应用凭据`,
      )
    }
    if (!row.appId || !row.appSecret) {
      throw new TenantPlatformAppError(
        'CREDENTIALS_MISSING',
        `租户尚未完整配置 ${platform} 平台应用凭据`,
      )
    }
    let appSecret: string
    try {
      appSecret = decryptCredential(row.appSecret)
    } catch {
      throw new TenantPlatformAppError(
        'CREDENTIALS_CORRUPTED',
        `租户 ${platform} 平台应用密钥无法解密，请管理员重新保存`,
      )
    }
    return {
      appId: row.appId,
      appSecret,
      extra: normalizeExtra(row.extra),
      source: 'tenant',
    }
  }

  if (canUsePlatformEnv(tenantId)) {
    const env = envPlatformCredentials(platform)
    if (env.appId && env.appSecret) {
      return { ...env, source: 'platform_env' }
    }
  }

  throw new TenantPlatformAppError(
    'CREDENTIALS_MISSING',
    tenantId
      ? `当前租户尚未配置 ${platform} 平台应用凭据，请租户管理员在「企业应用凭据」中填写本企业应用`
      : `平台尚未配置 ${platform} 应用凭据`,
  )
}

/** 只读状态：给管理端/登录页用，永不返回 secret。 */
export async function listTenantPlatformApps(
  tenantId: string | null | undefined,
): Promise<TenantPlatformAppStatus[]> {
  const rows = tenantId ? await listRows(tenantId) : []
  return buildTenantPlatformStatuses(rows, canUsePlatformEnv(tenantId))
}

/** 纯函数：把 DB 行 + 是否允许环境回退，折成不含 secret 的状态表。 */
export function buildTenantPlatformStatuses(
  rows: Array<{
    platform: string
    enabled: boolean
    appId: string
    appSecret: string
    extra: unknown
  }>,
  fallbackAllowed: boolean,
): TenantPlatformAppStatus[] {
  const byPlatform = new Map(rows.map((row) => [row.platform, row]))
  return TENANT_PLATFORM_IDS.map((platform) => {
    const row = byPlatform.get(platform)
    if (row) {
      return {
        platform,
        configured: Boolean(row.appId && row.appSecret),
        enabled: row.enabled,
        appId: row.appId,
        appSecretMasked: row.appSecret ? '••••••' : '',
        extra: normalizeExtra(row.extra),
        source: 'tenant' as const,
      }
    }
    const env = fallbackAllowed ? envPlatformCredentials(platform) : null
    const envConfigured = Boolean(env?.appId && env?.appSecret)
    return {
      platform,
      configured: envConfigured,
      enabled: envConfigured,
      appId: env?.appId ?? '',
      appSecretMasked: envConfigured ? '••••••' : '',
      extra: env?.extra ?? {},
      source: envConfigured ? ('platform_env' as const) : ('none' as const),
    }
  })
}

/**
 * 登录页运行时需要的公开配置：appId / redirectUri / agentId / scope。
 * appSecret 永不出现在本响应里。
 */
export async function publicTenantProviderConfig(
  tenantId: string | null | undefined,
): Promise<
  Record<string, { enabled: boolean; appId: string; extra: Record<string, string>; source: string }>
> {
  const statuses = await listTenantPlatformApps(tenantId)
  return Object.fromEntries(
    statuses.map((status) => [
      status.platform,
      {
        enabled: status.enabled && status.configured,
        appId: status.appId,
        extra: status.extra,
        source: status.source,
      },
    ]),
  )
}

export async function upsertTenantPlatformApp(input: {
  tenantId: string
  platform: TenantPlatformId
  appId: string
  appSecret?: string
  extra?: Record<string, unknown>
  enabled?: boolean
  userId?: string | null
}): Promise<TenantPlatformAppStatus> {
  const existing = await findTenantPlatformApp(input.tenantId, input.platform)
  const appId = input.appId.trim()
  const incomingSecret = (input.appSecret ?? '').trim()
  if (!appId) {
    throw new TenantPlatformAppError('CREDENTIALS_MISSING', '应用 ID 不能为空')
  }
  if (!incomingSecret && !existing?.appSecret) {
    throw new TenantPlatformAppError(
      'SECRET_REQUIRED',
      '首次配置必须填写应用密钥；后续修改可留空沿用原密钥',
    )
  }
  if (!incomingSecret && existing && existing.appId !== appId) {
    throw new TenantPlatformAppError(
      'SECRET_REQUIRED',
      '应用 ID 已变更，必须同时填写新应用密钥，不能沿用旧 ID 的密钥',
    )
  }
  const appSecret = incomingSecret ? encryptCredential(incomingSecret) : existing!.appSecret
  const extra = sanitizeExtra({
    ...normalizeExtra(existing?.extra),
    ...(input.extra ?? {}),
  })
  const enabled = input.enabled ?? existing?.enabled ?? true
  const now = new Date()

  await db
    .insert(tenantPlatformApps)
    .values({
      tenantId: input.tenantId,
      platform: input.platform,
      appId,
      appSecret,
      extra,
      enabled,
      createdBy: input.userId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [tenantPlatformApps.tenantId, tenantPlatformApps.platform],
      set: { appId, appSecret, extra, enabled, updatedAt: now },
    })

  return {
    platform: input.platform,
    configured: true,
    enabled,
    appId,
    appSecretMasked: '••••••',
    extra,
    source: 'tenant',
  }
}

export async function deleteTenantPlatformApp(
  tenantId: string,
  platform: TenantPlatformId,
): Promise<boolean> {
  const deleted = await db
    .delete(tenantPlatformApps)
    .where(
      and(eq(tenantPlatformApps.tenantId, tenantId), eq(tenantPlatformApps.platform, platform)),
    )
    .returning({ id: tenantPlatformApps.id })
  return deleted.length > 0
}

/** 显式把现有环境凭据导入指定租户；只补空行，不覆盖已有租户配置。 */
export async function importEnvPlatformCredentials(input: {
  tenantId: string
  userId?: string | null
  platforms?: TenantPlatformId[]
}): Promise<{ imported: TenantPlatformId[]; skipped: TenantPlatformId[] }> {
  // 环境凭据只属于显式指定的默认租户；放进来等于把平台方的企业应用借给别家。
  if (!canImportPlatformEnv(input.tenantId)) {
    throw new TenantPlatformAppError('ENV_SCOPE_FORBIDDEN', '环境凭据不属于当前租户，不能导入')
  }
  const imported: TenantPlatformId[] = []
  const skipped: TenantPlatformId[] = []
  const platforms = input.platforms ?? [...TENANT_PLATFORM_IDS]
  for (const platform of platforms) {
    const existing = await findTenantPlatformApp(input.tenantId, platform)
    if (existing) {
      skipped.push(platform)
      continue
    }
    const env = envPlatformCredentials(platform)
    if (!env.appId || !env.appSecret) {
      skipped.push(platform)
      continue
    }
    await upsertTenantPlatformApp({
      tenantId: input.tenantId,
      platform,
      appId: env.appId,
      appSecret: env.appSecret,
      extra: env.extra,
      userId: input.userId,
    })
    imported.push(platform)
  }
  return { imported, skipped }
}

async function findTenantPlatformApp(
  tenantId: string | null | undefined,
  platform: TenantPlatformId,
) {
  if (!tenantId) return undefined
  const [row] = await db
    .select()
    .from(tenantPlatformApps)
    .where(
      and(eq(tenantPlatformApps.tenantId, tenantId), eq(tenantPlatformApps.platform, platform)),
    )
    .limit(1)
  return row
}

async function listRows(tenantId: string) {
  return db.select().from(tenantPlatformApps).where(eq(tenantPlatformApps.tenantId, tenantId))
}

function normalizeExtra(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw.trim()) out[key] = raw.trim()
  }
  return out
}

const ALLOWED_EXTRA_KEYS = new Set([
  'agent_id',
  'redirect_uri',
  'scope',
  'login_region',
  'auth_url',
  'suite_id',
])

/** 只收白名单字段，避免把任意 JSON（尤其别处误传的 secret）写进公开配置。 */
function sanitizeExtra(value: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!ALLOWED_EXTRA_KEYS.has(key)) continue
    if (typeof raw === 'string' && raw.trim()) out[key] = raw.trim()
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
