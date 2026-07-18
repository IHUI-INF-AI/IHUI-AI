/**
 * Coze OAuth App 类。
 * 迁移自 v1.0.2-sealed: server/app/utils/coze_oauth_apps.py
 *
 * 定义 4 种 OAuth App 类, 每个封装对应的 OAuth 流程:
 * - DeviceOAuthApp: 设备码授权 (device flow)
 * - WebOAuthApp: Web 授权码流程 (authorization_code)
 * - PKCEOAuthApp: PKCE 扩展授权码流程
 * - JWTOAuthApp: JWT 授权 (服务端直接签发, 最常用)
 */

import { env } from 'node:process'
import { createHash, randomBytes } from 'node:crypto'
import { getCozeAccessToken, getPrivateKey } from './coze-auth-utils.js'

const DEFAULT_TTL = 86399
const DEFAULT_COZE_API_BASE = 'https://api.coze.cn'

/** OAuth 令牌结果 */
export interface OAuthTokenResult {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

interface TokenApiResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

function toResult(data: TokenApiResponse): OAuthTokenResult {
  return {
    access_token: data.access_token ?? '',
    token_type: data.token_type ?? 'Bearer',
    expires_in: data.expires_in ?? DEFAULT_TTL,
    refresh_token: data.refresh_token,
    scope: data.scope,
  }
}

function resolveBaseUrl(baseUrl?: string | null): string {
  return (baseUrl ?? env.COZE_API_BASE ?? DEFAULT_COZE_API_BASE).replace(/\/$/, '')
}

// ============================================================================
// DeviceOAuthApp - 设备码授权
// ============================================================================

export class DeviceOAuthApp {
  clientId: string
  baseUrl: string

  constructor(opts: { clientId?: string | null; baseUrl?: string | null } = {}) {
    this.clientId = opts.clientId ?? env.COZE_OAUTH_APP_ID ?? ''
    this.baseUrl = resolveBaseUrl(opts.baseUrl)
  }

  async getDeviceCode(workspaceId?: string | null): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/api/permission/oauth2/device/code`
    const payload: Record<string, string> = { client_id: this.clientId }
    if (workspaceId) payload.workspace_id = workspaceId
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!r.ok) throw new Error(`Device code HTTP ${r.status}`)
    return (await r.json()) as Record<string, unknown>
  }

  async getAccessToken(deviceCode: string): Promise<OAuthTokenResult> {
    const url = `${this.baseUrl}/api/permission/oauth2/device/token`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        device_code: deviceCode,
        grant_type: 'device_code',
      }),
    })
    if (!r.ok) throw new Error(`Device token HTTP ${r.status}`)
    return toResult((await r.json()) as TokenApiResponse)
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
    const url = `${this.baseUrl}/api/permission/oauth2/refresh_token`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!r.ok) throw new Error(`Device refresh HTTP ${r.status}`)
    return toResult((await r.json()) as TokenApiResponse)
  }
}

// ============================================================================
// WebOAuthApp - Web 授权码流程
// ============================================================================

export class WebOAuthApp {
  clientId: string
  clientSecret: string
  baseUrl: string

  constructor(opts: {
    clientId?: string | null
    clientSecret?: string | null
    baseUrl?: string | null
  } = {}) {
    this.clientId = opts.clientId ?? env.COZE_OAUTH_APP_ID ?? ''
    this.clientSecret = opts.clientSecret ?? ''
    this.baseUrl = resolveBaseUrl(opts.baseUrl)
  }

  getOAuthUrl(redirectUri: string, state: string, scope?: string | null): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    })
    if (scope) params.append('scope', scope)
    return `${this.baseUrl}/api/permission/oauth2/authorize?${params.toString()}`
  }

  async getAccessToken(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const url = `${this.baseUrl}/api/permission/oauth2/token`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!r.ok) throw new Error(`Web token HTTP ${r.status}`)
    return toResult((await r.json()) as TokenApiResponse)
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
    const url = `${this.baseUrl}/api/permission/oauth2/refresh_token`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!r.ok) throw new Error(`Web refresh HTTP ${r.status}`)
    return toResult((await r.json()) as TokenApiResponse)
  }
}

// ============================================================================
// PKCEOAuthApp - PKCE 扩展授权码流程
// ============================================================================

export class PKCEOAuthApp {
  clientId: string
  baseUrl: string

  constructor(opts: { clientId?: string | null; baseUrl?: string | null } = {}) {
    this.clientId = opts.clientId ?? env.COZE_OAUTH_APP_ID ?? ''
    this.baseUrl = resolveBaseUrl(opts.baseUrl)
  }

  static generateCodeVerifier(): string {
    return randomBytes(64).toString('base64url').slice(0, 128)
  }

  static generateCodeChallenge(codeVerifier: string, method: string = 'S256'): string {
    if (method.toUpperCase() === 'S256') {
      const digest = createHash('sha256').update(codeVerifier, 'utf-8').digest()
      return digest.toString('base64url').replace(/=/g, '')
    }
    return codeVerifier
  }

  getOAuthUrl(opts: {
    redirectUri: string
    codeVerifier: string
    codeChallengeMethod?: string
    state?: string | null
    scope?: string | null
  }): string {
    const method = opts.codeChallengeMethod ?? 'S256'
    const codeChallenge = PKCEOAuthApp.generateCodeChallenge(opts.codeVerifier, method)
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: opts.redirectUri,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: method,
    })
    if (opts.state) params.append('state', opts.state)
    if (opts.scope) params.append('scope', opts.scope)
    return `${this.baseUrl}/api/permission/oauth2/authorize?${params.toString()}`
  }

  async getAccessToken(opts: {
    redirectUri: string
    code: string
    codeVerifier: string
  }): Promise<OAuthTokenResult> {
    const url = `${this.baseUrl}/api/permission/oauth2/token`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        code: opts.code,
        redirect_uri: opts.redirectUri,
        code_verifier: opts.codeVerifier,
        grant_type: 'authorization_code',
      }),
    })
    if (!r.ok) throw new Error(`PKCE token HTTP ${r.status}`)
    return toResult((await r.json()) as TokenApiResponse)
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
    const url = `${this.baseUrl}/api/permission/oauth2/refresh_token`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!r.ok) throw new Error(`PKCE refresh HTTP ${r.status}`)
    return toResult((await r.json()) as TokenApiResponse)
  }
}

// ============================================================================
// JWTOAuthApp - JWT 授权 (服务端直接签发, 最常用)
// ============================================================================

export class JWTOAuthApp {
  clientId: string
  publicKeyId: string
  baseUrl: string
  private _privateKey: string | null

  constructor(opts: {
    clientId?: string | null
    privateKey?: string | null
    publicKeyId?: string | null
    baseUrl?: string | null
  } = {}) {
    this.clientId = opts.clientId ?? env.COZE_OAUTH_APP_ID ?? ''
    this.publicKeyId = opts.publicKeyId ?? env.COZE_PUBLIC_KEY_ID ?? ''
    this.baseUrl = resolveBaseUrl(opts.baseUrl)
    this._privateKey = opts.privateKey ?? null
  }

  private resolvePrivateKey(): string | null {
    return this._privateKey ?? getPrivateKey()
  }

  async getAccessToken(opts: {
    userUuid?: string | null
    scope?: string | null
    ttl?: number | null
    forceRefresh?: boolean
  } = {}): Promise<OAuthTokenResult> {
    const privateKey = this.resolvePrivateKey()
    if (!privateKey) throw new Error('Coze 私钥未配置, 无法获取 access_token')
    const accessToken = await getCozeAccessToken({
      userUuid: opts.userUuid ?? null,
      privateKey,
      forceRefresh: opts.forceRefresh ?? false,
    })
    if (!accessToken) throw new Error('获取 Coze access_token 失败')
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: opts.ttl ?? DEFAULT_TTL,
    }
  }

  async refreshAccessToken(_refreshToken: string): Promise<OAuthTokenResult> {
    // JWT 流程无 refresh_token, 直接重新签发
    return await this.getAccessToken({ forceRefresh: true })
  }
}

export { DEFAULT_TTL }
