// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Token 管理服务（签发/验证/刷新/黑名单）。
 * 基于 @ihui/auth（jose JWT 签发验证）+ TokenBlacklist（Redis 黑名单）+ refresh_tokens 表。
 *
 * 职责:
 * - issueTokenPair: 登录/注册后签发 access + refresh token 对
 * - verifyAccessToken: 验证 access token 并检查黑名单
 * - revokeToken / revokeUserTokens: 主动吊销（登出/踢下线）
 *
 * 2026-10-26 收口:原第二套 refresh token 轮转实现 `refreshAccessToken`
 * (旧单档重用检测:revokedAt 非空一律吊销整族)已删除 —— 全仓零调用方,
 * 且与 routes/auth.ts 的 /refresh、routes/auth-extended.ts 的 rotateRefreshTokenFlow
 * 构成三套并存口径;轮转+重放裁决的唯一出口是 services/refresh-replay-policy.ts
 * 的 assessRefreshReplay(AGENTS §0.6 单一真相源,不得在此复活第二份)。
 *
 * 2026-07-22 鲁棒性加固(历史留痕):
 * - ACCESS_TTL_MS 从 7d 改为 15min(对齐 @ihui/auth 的 ACCESS_TOKEN_TTL_SECONDS)
 * - REFRESH_TTL_MS 从 30d 改为读取 @ihui/auth 的 REFRESH_TOKEN_TTL_SECONDS(默认仍 30d)
 */

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  createFamilyId,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  type JWTPayload,
  type TokenBlacklist,
} from '@ihui/auth'
import { type TokenPair } from '@ihui/types'
import { saveRefreshToken } from '../db/queries.js'

/** access token TTL(毫秒),从 @ihui/auth 同步,默认 15min。 */
const ACCESS_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000
/** refresh token TTL(毫秒),从 @ihui/auth 同步,默认 30d。 */
const REFRESH_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * 1000

/** api 端 token-service 始终签发完整 token 对(三字段必填),用 Required 收窄共享 TokenPair */
type RequiredTokenPair = Required<TokenPair>

/**
 * 签发 token 对：access + refresh。
 * 同时将 refresh token 持久化到 DB（refresh_tokens 表）并跟踪到黑名单集合（便于踢下线）。
 *
 * @param blacklist 可选，传入后跟踪 token 以支持 revokeUserTokens
 */
export async function issueTokenPair(
  payload: JWTPayload,
  blacklist?: TokenBlacklist,
): Promise<RequiredTokenPair> {
  const accessToken = await signAccessToken(payload)
  const refreshToken = await signRefreshToken(payload)

  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await saveRefreshToken(refreshToken, payload.userId, payload.familyId, refreshExpiresAt)

  if (blacklist) {
    await blacklist.trackUserToken(payload.userId, refreshToken, refreshExpiresAt)
  }

  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) }
}

/**
 * 验证 access token：先验签，再查黑名单。
 * 黑名单未传入时跳过黑名单检查（fail-open，由调用方保证已鉴权）。
 * 黑名单传入时默认 fail-open(Redis 故障放行,因为 access token TTL 已 15min,风险可控)。
 */
export async function verifyToken(token: string, blacklist?: TokenBlacklist): Promise<JWTPayload> {
  const payload = await verifyAccessToken(token)
  if (blacklist && (await blacklist.has(token))) {
    throw new Error('Token 已被吊销')
  }
  return payload
}

/**
 * 吊销单个 access token（登出）。
 * 将 token 加入黑名单，TTL 取其剩余有效期。
 */
export async function revokeToken(
  token: string,
  expiresAt: Date,
  blacklist: TokenBlacklist,
): Promise<void> {
  await blacklist.add(token, expiresAt)
}

/**
 * 吊销某用户的所有 token（踢下线）。
 * 需配合 TokenBlacklist.trackUserToken 使用。
 */
export async function revokeUserTokens(userId: string, blacklist: TokenBlacklist): Promise<void> {
  await blacklist.revokeUserTokens(userId)
}

/** 检查 token 是否在黑名单中。 */
export async function isTokenRevoked(token: string, blacklist: TokenBlacklist): Promise<boolean> {
  return blacklist.has(token)
}

/** 生成新的 familyId（用于登录/注册时的 token family）。 */
export function generateFamilyId(): string {
  return createFamilyId()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
