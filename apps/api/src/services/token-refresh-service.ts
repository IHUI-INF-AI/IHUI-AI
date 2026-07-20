/**
 * 第三方平台 Token 刷新服务(2026-07-20 P0 补齐)
 *
 * 背景：D 盘 coze_zhs_py / ZHS 集成有 3 个 Token 刷新任务(Python APScheduler):
 *   - WorkWechatTokenService  企业微信 access_token(7200s 过期)
 *   - WechatTokenService      微信公众号 access_token(7200s 过期)
 *   - DingTalkTokenService    钉钉 access_token(7200s 过期)
 *
 * G 盘缺失这 3 个服务,企业微信/微信公众号/钉钉集成在 Token 过期后(约 2 小时)全面失效。
 * 本文件提供 3 个 service 函数,无配置时静默 no-op(便于本地开发),
 * scheduler-worker.ts 调用此 3 个函数。
 *
 * 凭据来源：
 * - 优先从 integration_configs 表读取(运行时配置,管理员可调整)
 * - 回退到环境变量(WORKWECHAT_CORPID/... WECHAT_APPID/... DINGTALK_APPKEY/...)
 */
import { db } from '../db/index.js'
import { integrationConfigs } from '@ihui/database'
import { and, eq } from 'drizzle-orm'
import { config } from '../config/index.js'

interface TokenCache {
  accessToken: string
  expiresAt: number // ms epoch
}

const tokenCache: Record<string, TokenCache | null> = {
  workwechat: null,
  wechat: null,
  dingtalk: null,
}

const REFRESH_LEEWAY_MS = 5 * 60 * 1000 // 提前 5 分钟刷新

// =============================================================================
// 配置读取
// =============================================================================

interface WorkWechatConfig {
  corpId: string
  corpSecret: string
}
interface WechatConfig {
  appId: string
  appSecret: string
}
interface DingTalkConfig {
  appKey: string
  appSecret: string
}

/**
 * 从 integration_configs 表读取 provider 配置(JSON 格式的 credentials)
 * 未配置/出错时返回 null,service 端优雅 no-op
 */
async function readIntegrationCredentials<T>(provider: string): Promise<T | null> {
  try {
    const rows = await db
      .select()
      .from(integrationConfigs)
      .where(and(eq(integrationConfigs.provider, provider), eq(integrationConfigs.isEnabled, true)))
      .limit(1)
    if (!rows[0]?.credentials) return null
    return rows[0].credentials as T
  } catch {
    return null
  }
}

async function loadWorkWechatConfig(): Promise<WorkWechatConfig | null> {
  const envCorpId = (config as unknown as Record<string, string>).WORKWECHAT_CORPID ?? ''
  const envCorpSecret = (config as unknown as Record<string, string>).WORKWECHAT_CORPSECRET ?? ''
  if (envCorpId && envCorpSecret) {
    return { corpId: envCorpId, corpSecret: envCorpSecret }
  }
  return readIntegrationCredentials<WorkWechatConfig>('workwechat')
}

async function loadWechatConfig(): Promise<WechatConfig | null> {
  const envAppId = (config as unknown as Record<string, string>).WECHAT_APPID ?? ''
  const envAppSecret = (config as unknown as Record<string, string>).WECHAT_APPSECRET ?? ''
  if (envAppId && envAppSecret) {
    return { appId: envAppId, appSecret: envAppSecret }
  }
  return readIntegrationCredentials<WechatConfig>('wechat')
}

async function loadDingTalkConfig(): Promise<DingTalkConfig | null> {
  const envAppKey = (config as unknown as Record<string, string>).DINGTALK_APPKEY ?? ''
  const envAppSecret = (config as unknown as Record<string, string>).DINGTALK_APPSECRET ?? ''
  if (envAppKey && envAppSecret) {
    return { appKey: envAppKey, appSecret: envAppSecret }
  }
  return readIntegrationCredentials<DingTalkConfig>('dingtalk')
}

// =============================================================================
// 3 个 Token 刷新入口(供 scheduler-worker.ts 调用)
// =============================================================================

export interface RefreshResult {
  provider: string
  refreshed: boolean
  expiresAt: number | null
  reason?: string
}

/**
 * 刷新企业微信 access_token(7200s 过期,每 100 分钟跑一次足够)
 */
export async function refreshWorkWechatToken(): Promise<RefreshResult> {
  // 缓存未过期,跳过
  const cache = tokenCache.workwechat
  if (cache && cache.expiresAt - REFRESH_LEEWAY_MS > Date.now()) {
    return { provider: 'workwechat', refreshed: false, expiresAt: cache.expiresAt }
  }
  const cfg = await loadWorkWechatConfig()
  if (!cfg) {
    return { provider: 'workwechat', refreshed: false, expiresAt: null, reason: 'no_config' }
  }
  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(cfg.corpId)}&corpsecret=${encodeURIComponent(cfg.corpSecret)}`
    const resp = await fetch(url, { method: 'GET' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = (await resp.json()) as {
      access_token?: string
      expires_in?: number
      errcode?: number
      errmsg?: string
    }
    if (data.errcode && data.errcode !== 0) {
      throw new Error(`errcode=${data.errcode} errmsg=${data.errmsg}`)
    }
    if (!data.access_token) throw new Error('missing access_token')
    const expiresIn = (data.expires_in ?? 7200) * 1000
    tokenCache.workwechat = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn,
    }
    return {
      provider: 'workwechat',
      refreshed: true,
      expiresAt: tokenCache.workwechat!.expiresAt,
    }
  } catch (e) {
    return {
      provider: 'workwechat',
      refreshed: false,
      expiresAt: null,
      reason: `fetch_failed: ${(e as Error).message}`,
    }
  }
}

/**
 * 刷新微信公众号 access_token(7200s 过期)
 */
export async function refreshWechatToken(): Promise<RefreshResult> {
  const cache = tokenCache.wechat
  if (cache && cache.expiresAt - REFRESH_LEEWAY_MS > Date.now()) {
    return { provider: 'wechat', refreshed: false, expiresAt: cache.expiresAt }
  }
  const cfg = await loadWechatConfig()
  if (!cfg) {
    return { provider: 'wechat', refreshed: false, expiresAt: null, reason: 'no_config' }
  }
  try {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(cfg.appId)}&secret=${encodeURIComponent(cfg.appSecret)}`
    const resp = await fetch(url, { method: 'GET' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = (await resp.json()) as {
      access_token?: string
      expires_in?: number
      errcode?: number
      errmsg?: string
    }
    if (data.errcode && data.errcode !== 0) {
      throw new Error(`errcode=${data.errcode} errmsg=${data.errmsg}`)
    }
    if (!data.access_token) throw new Error('missing access_token')
    const expiresIn = (data.expires_in ?? 7200) * 1000
    tokenCache.wechat = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn,
    }
    return { provider: 'wechat', refreshed: true, expiresAt: tokenCache.wechat!.expiresAt }
  } catch (e) {
    return {
      provider: 'wechat',
      refreshed: false,
      expiresAt: null,
      reason: `fetch_failed: ${(e as Error).message}`,
    }
  }
}

/**
 * 刷新钉钉 access_token(7200s 过期)
 */
export async function refreshDingTalkToken(): Promise<RefreshResult> {
  const cache = tokenCache.dingtalk
  if (cache && cache.expiresAt - REFRESH_LEEWAY_MS > Date.now()) {
    return { provider: 'dingtalk', refreshed: false, expiresAt: cache.expiresAt }
  }
  const cfg = await loadDingTalkConfig()
  if (!cfg) {
    return { provider: 'dingtalk', refreshed: false, expiresAt: null, reason: 'no_config' }
  }
  try {
    const url = 'https://oapi.dingtalk.com/gettoken'
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        appkey: cfg.appKey,
        appsecret: cfg.appSecret,
      }).toString(),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = (await resp.json()) as {
      access_token?: string
      expires_in?: number
      errcode?: number
      errmsg?: string
    }
    if (data.errcode && data.errcode !== 0) {
      throw new Error(`errcode=${data.errcode} errmsg=${data.errmsg}`)
    }
    if (!data.access_token) throw new Error('missing access_token')
    const expiresIn = (data.expires_in ?? 7200) * 1000
    tokenCache.dingtalk = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn,
    }
    return { provider: 'dingtalk', refreshed: true, expiresAt: tokenCache.dingtalk!.expiresAt }
  } catch (e) {
    return {
      provider: 'dingtalk',
      refreshed: false,
      expiresAt: null,
      reason: `fetch_failed: ${(e as Error).message}`,
    }
  }
}

/** 暴露给业务层获取当前缓存的 token(只读) */
export function getCachedAccessToken(
  provider: 'workwechat' | 'wechat' | 'dingtalk',
): string | null {
  const cache = tokenCache[provider]
  if (!cache) return null
  if (cache.expiresAt - REFRESH_LEEWAY_MS <= Date.now()) return null
  return cache.accessToken
}
