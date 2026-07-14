/**
 * WebSocket 鉴权辅助(共享给所有 ws 插件)。
 *
 * 设计目标:
 *  - 统一 close code:4001=缺 token, 4003=token 无效, 4004=账号已注销(R76 软删除扩展)
 *  - 注入式 status 查询(默认 getUserStatus,允许测试覆盖)
 *  - 单一改动点,新增 ws 插件无需重复写鉴权样板
 *
 * 用法:
 *   const userId = await wsAuth(socket, query.token)
 *   if (!userId) return  // 连接已 close
 */
import type { WebSocket } from '@fastify/websocket'
import { verifyAccessToken } from '@ihui/auth'
import { getUserStatus } from '../db/usercenter-queries.js'

/** 注入式状态查询,默认从 usercenter 表读取(便于测试覆盖) */
export type UserStatusFetcher = (userId: string) => Promise<number | undefined>

/** close code 约定 */
export const WS_CLOSE = {
  MISSING_TOKEN: 4001,
  INVALID_TOKEN: 4003,
  /** 账号已注销(软删除 status=3),与 R76 requireActiveUser 一致 */
  ACCOUNT_CANCELLED: 4004,
} as const

/**
 * WebSocket 鉴权:校验 JWT + 用户 status(非注销态)。
 *
 * 失败时直接 `socket.close(code, reason)`,返回 null;
 * 成功返回 userId,业务层可直接使用。
 */
export async function wsAuth(
  socket: WebSocket,
  token: string | undefined,
  fetchStatus: UserStatusFetcher = getUserStatus,
): Promise<string | null> {
  if (!token) {
    socket.close(WS_CLOSE.MISSING_TOKEN, '缺少 token')
    return null
  }
  let userId: string
  try {
    const payload = await verifyAccessToken(token)
    userId = payload.userId
  } catch {
    socket.close(WS_CLOSE.INVALID_TOKEN, 'token 无效')
    return null
  }
  const status = await fetchStatus(userId)
  if (status === undefined) {
    socket.close(WS_CLOSE.INVALID_TOKEN, '用户不存在')
    return null
  }
  if (status === 3) {
    socket.close(WS_CLOSE.ACCOUNT_CANCELLED, '账号已注销')
    return null
  }
  return userId
}
