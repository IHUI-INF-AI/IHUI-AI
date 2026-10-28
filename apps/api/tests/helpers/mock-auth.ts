// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

/**
 * 真实 DB 测试的鉴权 mock 辅助工具。
 *
 * 用法(在每个需鉴权的测试文件顶部):
 * ```ts
 * import { mockAuthenticate, setMockUser } from './helpers/mock-auth.js'
 *
 * vi.mock('../src/plugins/auth.js', () => ({
 *   authenticate: (...args: unknown[]) => mockAuthenticate(...args),
 *   requireActiveUser: vi.fn(), // 跳过 active user 检查
 * }))
 *
 * // beforeAll 中:
 * setMockUser(testUser.id)
 * ```
 *
 * mockAuthenticate 会在 authenticate 被调用时:
 * - 设置 request.userId = userId
 * - 设置 request.jwtPayload = { userId, roleId }
 * - 返回 payload
 *
 * 这样路由代码能正常读取 request.userId / request.jwtPayload,
 * 同时不 mock DB,保留真实 SQL 验证。
 */

export const mockAuthenticate = vi.fn()

/**
 * 与真实 checkAuth(apps/api/src/plugins/auth.ts)语义一致的 mock:
 * authenticate 成功 → true;抛错(如 setMockUnauthorized 的 401)→ 按错误码回复并返回 false。
 * 路由若从 auth 插件导入 checkAuth,vitest 整模块 mock 后它必须由工厂显式提供,
 * 否则路由拿到 undefined → 500(而非预期的 401)。(2026-09-10 real-db CI)
 */
export const mockCheckAuth = async (...args: unknown[]): Promise<boolean> => {
  try {
    await mockAuthenticate(...args)
    return true
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    const reply = args[1] as {
      status: (code: number) => { send: (body: unknown) => unknown }
    }
    const statusCode = err.statusCode ?? 401
    reply
      .status(statusCode)
      .send({ code: statusCode, message: err.message || 'Authentication required' })
    return false
  }
}

export interface MockJWTPayload {
  userId: string
  roleId: number
  type?: string
  iat?: number
  exp?: number
}

/**
 * 设置 mock 用户身份。authenticate 调用后 request.userId/jwtPayload 会被设置。
 * @param userId 测试用户 ID(需在 DB 中真实存在,以满足 FK 约束)
 * @param roleId 角色 ID(0=普通用户,1=管理员)
 */
export function setMockUser(userId: string, roleId: number = 0): void {
  const payload: MockJWTPayload = { userId, roleId, type: 'access' }
  mockAuthenticate.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    ;(request as FastifyRequest & { jwtPayload?: MockJWTPayload }).jwtPayload = payload
    return payload
  })
}

/**
 * 设置 mock 管理员身份(roleId >= 1 视为管理员)。
 */
export function setMockAdmin(userId: string): void {
  setMockUser(userId, 1)
}

/**
 * 设置 mock 未登录(authenticate 抛 401 错误)。
 */
export function setMockUnauthorized(): void {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

/**
 * 重置 mock 状态。
 */
export function resetMockAuth(): void {
  mockAuthenticate.mockReset()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
