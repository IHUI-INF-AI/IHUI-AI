/**
 * Token 管理服务（签发/验证/刷新/黑名单）。
 * 基于 @ihui/auth（jose JWT 签发验证）+ TokenBlacklist（Redis 黑名单）+ refresh_tokens 表。
 *
 * 职责：
 * - issueTokenPair: 登录/注册后签发 access + refresh token 对
 * - verifyAccessToken: 验证 access token 并检查黑名单
 * - refreshAccessToken: refresh token 轮转（旧 token 吊销 + 新 token 对）
 * - revokeToken / revokeUserTokens: 主动吊销（登出/踢下线）
 */

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  createFamilyId,
  type JWTPayload,
  type TokenBlacklist,
} from '@ihui/auth';
import {
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
} from '../db/queries.js';

/** access token 7d，refresh token 30d（与 @ihui/auth 保持一致）。 */
const ACCESS_TTL_MS = 7 * 86400_000;
const REFRESH_TTL_MS = 30 * 86400_000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token 有效期（秒）
}

/**
 * 签发 token 对：access + refresh。
 * 同时将 refresh token 持久化到 DB（refresh_tokens 表）并跟踪到黑名单集合（便于踢下线）。
 *
 * @param blacklist 可选，传入后跟踪 token 以支持 revokeUserTokens
 */
export async function issueTokenPair(
  payload: JWTPayload,
  blacklist?: TokenBlacklist,
): Promise<TokenPair> {
  const accessToken = await signAccessToken(payload);
  const refreshToken = await signRefreshToken(payload);

  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await saveRefreshToken(refreshToken, payload.userId, payload.familyId, refreshExpiresAt);

  if (blacklist) {
    await blacklist.trackUserToken(payload.userId, refreshToken, refreshExpiresAt);
  }

  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
}

/**
 * 验证 access token：先验签，再查黑名单。
 * 黑名单未传入时跳过黑名单检查（fail-open，由调用方保证已鉴权）。
 */
export async function verifyToken(
  token: string,
  blacklist?: TokenBlacklist,
): Promise<JWTPayload> {
  const payload = await verifyAccessToken(token);
  if (blacklist && (await blacklist.has(token))) {
    throw new Error('Token 已被吊销');
  }
  return payload;
}

/**
 * 刷新 access token：
 * 1. 验证 refresh token 合法性（type=refresh）
 * 2. 查 DB 确认未被吊销
 * 3. 吊销旧 refresh token（轮转）
 * 4. 签发新的 token 对
 *
 * @returns 新 token 对；失败抛出错误
 */
export async function refreshAccessToken(
  refreshTokenStr: string,
  blacklist?: TokenBlacklist,
): Promise<TokenPair> {
  const payload = await verifyRefreshToken(refreshTokenStr);

  const stored = await findRefreshToken(refreshTokenStr);
  if (!stored) throw new Error('Refresh token 不存在');
  if (stored.revokedAt) throw new Error('Refresh token 已被吊销');

  // 轮转：吊销旧 token
  await revokeRefreshToken(refreshTokenStr);
  if (blacklist) {
    const expiresAt = stored.expiresAt ?? new Date(Date.now() + REFRESH_TTL_MS);
    await blacklist.add(refreshTokenStr, expiresAt);
  }

  // 签发新 token 对（保持同一 familyId）
  return issueTokenPair(payload, blacklist);
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
  await blacklist.add(token, expiresAt);
}

/**
 * 吊销某用户的所有 token（踢下线）。
 * 需配合 TokenBlacklist.trackUserToken 使用。
 */
export async function revokeUserTokens(
  userId: string,
  blacklist: TokenBlacklist,
): Promise<void> {
  await blacklist.revokeUserTokens(userId);
}

/** 检查 token 是否在黑名单中。 */
export async function isTokenRevoked(
  token: string,
  blacklist: TokenBlacklist,
): Promise<boolean> {
  return blacklist.has(token);
}

/** 生成新的 familyId（用于登录/注册时的 token family）。 */
export function generateFamilyId(): string {
  return createFamilyId();
}
