/**
 * Token Manager — 统一管理 access token / refresh token 自动续期。
 *
 * 解决问题:后端 access token 默认 15min 过期,CLI 之前每次过期都要用户手动重登录,
 * 体验极差。本模块封装"检测过期 → 用 refresh token 调 /api/auth/refresh → 持久化新 token"流程。
 *
 * 使用方式:
 *   import { ensureFreshAccessToken } from './token-manager.js';
 *   const token = await ensureFreshAccessToken(apiUrl);
 *   if (!token) { /* 无 token 或 refresh 失败,让用户重新 ihui login *\/ }
 *
 * 设计:
 *   - 检测 access token 是否过期:JWT payload 解析 exp 字段,提前 30s 视为过期(避免请求中途过期)
 *   - refresh 失败时返回原 token,让上游 API 返回 401,由调用方提示用户重新登录
 *   - 并发去重:多个命令同时调用 ensureFreshAccessToken 时,只触发一次 refresh
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSettingsPath, loadSettings, type Settings } from './settings.js';

interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/** 解析 JWT payload(不验证签名,仅用于读取 exp)。失败返回 null。 */
function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Node.js 不支持 atob,用 Buffer.from base64 解码
    // JWT base64url 需补齐 padding
    let b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as JwtPayload;
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** 提前 30s 视为过期(避免请求中途过期)。 */
const EXPIRY_LEAD_TIME_SECONDS = 30;

/** 检测 access token 是否即将过期(或已过期)。无 token / 解析失败均视为需要 refresh。 */
export function isAccessTokenExpired(token: string | undefined): boolean {
  if (!token) return true;
  const exp = decodeJwtExp(token);
  if (exp === null) return true; // 解析失败保守视为过期,让 API 报 401
  const now = Math.floor(Date.now() / 1000);
  return now + EXPIRY_LEAD_TIME_SECONDS >= exp;
}

/** 持久化新 token 对到 settings.json(保留其他字段)。 */
function persistTokens(accessToken: string, refreshToken: string): void {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let existing: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as Settings;
      if (parsed && typeof parsed === 'object') existing = parsed;
    } catch {
      // 损坏文件,从头建
    }
  }
  existing.apiKey = accessToken;
  existing.refreshToken = refreshToken;
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
}

/** 调用 /api/auth/refresh 换新 token。失败返回 null。 */
async function refreshTokens(
  apiUrl: string,
  refreshToken: string,
): Promise<RefreshResponse | null> {
  const url = `${apiUrl.replace(/\/+$/, '')}/api/auth/refresh`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    const parsed = JSON.parse(text) as { code?: number; data?: RefreshResponse };
    if (parsed.code !== 0 || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 并发去重:正在进行的 refresh Promise(多个命令同时调用时复用)。 */
let inflightRefresh: Promise<string | null> | null = null;

/**
 * 确保 access token 有效:未过期直接返回;过期则用 refresh token 自动续期。
 *
 * 返回值:
 *   - string:有效的 access token,可直接用于 Authorization: Bearer <token>
 *   - null:无 token / refresh 失败,调用方应提示用户 `ihui login`
 *
 * 并发安全:多个命令同时调用时,只触发一次 refresh,共享同一 Promise。
 */
export async function ensureFreshAccessToken(apiUrl: string): Promise<string | null> {
  const settings = loadSettings();
  const accessToken = settings.apiKey;

  // 1. access token 未过期,直接返回
  if (accessToken && !isAccessTokenExpired(accessToken)) {
    return accessToken;
  }

  // 2. access token 过期,需要 refresh
  const refreshToken = settings.refreshToken;
  if (!refreshToken) {
    // 无 refresh token,无法续期
    return accessToken ?? null;
  }

  // 3. 并发去重:复用正在进行的 refresh
  if (inflightRefresh) {
    return inflightRefresh;
  }

  // 4. 发起 refresh
  inflightRefresh = (async () => {
    try {
      const result = await refreshTokens(apiUrl, refreshToken);
      if (!result) {
        // refresh 失败,返回原 access token(让 API 报 401,调用方提示重登录)
        return accessToken ?? null;
      }
      // 持久化新 token 对
      persistTokens(result.accessToken, result.refreshToken);
      return result.accessToken;
    } finally {
      // 清理 inflight 标记,下次调用可重新触发
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

/**
 * 同步获取 access token(不触发 refresh)。
 * 用于不需要自动续期的场景(如显示当前 token 状态)。
 */
export function getAccessTokenSync(): string | undefined {
  return loadSettings().apiKey;
}

/** 同步获取 refresh token。 */
export function getRefreshTokenSync(): string | undefined {
  return loadSettings().refreshToken;
}
