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
