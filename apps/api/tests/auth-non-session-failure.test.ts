// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 G-396 / G-765 / G-357「非会话 401 被当成会话死亡」的回归锁。
 *
 * 机主拍板 2026-10-07 的口径:上游/依赖故障与会话失效必须分离 —— "没验成 / 没查成"一律
 * 502 + 独立 errorCode,只有真的账号语义结论才占 401。
 *
 * 落点在**抛出侧**(plugins/auth.ts 的三处:verifyAccessToken、jose 解码后的状态查询、
 * requireActiveUser),不在那约百处 `(e).statusCode ?? 401` 的兜底 catch —— 异常一带上显式
 * 状态码,那些点就各自落到正确码,不必逐处打补丁(逐处改会把别人正在写的路由卷进来)。
 *
 * 五条成对判据(缺一条就可能出现"收紧把真会话失效也改掉"或"脱敏把日志也关掉"):
 *  ① verify 抛无名异常 ⇒ 502 + AUTH_BACKEND_UNAVAILABLE,原文只进日志;
 *  ② verify 抛 jose 的过期类 code ⇒ 仍 401(真会话失效不得被改掉);
 *  ③ verify 抛自带 401 的鉴权结论 ⇒ 状态码与文案逐字不变;
 *  ④ 验签通过后查状态失败 ⇒ 502 + ACCOUNT_STATE_CHECK_FAILED;
 *  ⑤ requireActiveUser 的正常/注销/查失败三态。
 *
 * 测试隔离铁律(AGENTS §5):不连生产 PostgreSQL / Redis —— getUserStatus、@ihui/auth、
 * jose 全部 vi.mock 桩掉。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserStatus, verifyAccessToken, decodeJwt } = vi.hoisted(() => ({
  getUserStatus: vi.fn(),
  verifyAccessToken: vi.fn(),
  decodeJwt: vi.fn(),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: (id: string) => getUserStatus(id),
}))
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ihui/auth')>()
  return { ...actual, verifyAccessToken: (t: string) => verifyAccessToken(t) }
})
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>()
  return { ...actual, decodeJwt: (t: string) => decodeJwt(t) }
})

const { requireActiveUser, authenticate } = await import('../src/plugins/auth.js')
const { AppError } = await import('../src/errors/AppError.js')

type Thrown = Error & { statusCode?: number; errorCode?: string }

function fakeRequest(userId?: string) {
  return {
    userId,
    method: 'GET',
    headers: { authorization: 'Bearer whatever' },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  } as never
}

function logged(req: unknown): Thrown extends never ? never : ReturnType<typeof vi.fn> {
  return (req as { log: { error: ReturnType<typeof vi.fn> } }).log.error
}

describe('鉴权面:"没验成 / 没查成"不得冒充会话死亡', () => {
  beforeEach(() => {
    getUserStatus.mockReset()
    verifyAccessToken.mockReset()
    decodeJwt.mockReset()
    decodeJwt.mockReturnValue({})
  })

  it('① verify 抛无名异常 ⇒ 502 + AUTH_BACKEND_UNAVAILABLE,且原文只进日志', async () => {
    verifyAccessToken.mockRejectedValue(new Error('driver exploded: connection refused to db:5432'))
    const req = fakeRequest()
    const err = (await authenticate(req).catch((e: unknown) => e)) as Thrown
    expect(err.statusCode).toBe(502)
    expect(err.errorCode).toBe('AUTH_BACKEND_UNAVAILABLE')
    expect(err).toBeInstanceOf(AppError)
    expect(err.message).not.toContain('driver exploded')
    expect(logged(req)).toHaveBeenCalled()
  })

  it('② verify 抛 jose 的过期类 code ⇒ 仍 401(收紧不得把真会话失效改掉)', async () => {
    verifyAccessToken.mockRejectedValue(
      Object.assign(new Error('JWS claims validation failed: exp'), { code: 'ERR_JWT_EXPIRED' }),
    )
    const req = fakeRequest()
    const err = (await authenticate(req).catch((e: unknown) => e)) as Thrown
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Invalid or expired token')
  })

  it('③ verify 抛自带 401 的鉴权结论 ⇒ 状态码与文案逐字不变', async () => {
    verifyAccessToken.mockRejectedValue(
      Object.assign(new Error('refresh token 不能用作 access token'), { statusCode: 401 }),
    )
    const req = fakeRequest()
    const err = (await authenticate(req).catch((e: unknown) => e)) as Thrown
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('refresh token 不能用作 access token')
  })

  it('④ 验签通过后查状态失败 ⇒ 502 + ACCOUNT_STATE_CHECK_FAILED,原文不进 message', async () => {
    verifyAccessToken.mockResolvedValue({ userId: 'u-1', phone: '', familyId: 'f', roleId: 0 })
    getUserStatus.mockRejectedValue(new Error('relation "users" does not exist'))
    const req = fakeRequest()
    const err = (await authenticate(req).catch((e: unknown) => e)) as Thrown
    expect(err.statusCode).toBe(502)
    expect(err.errorCode).toBe('ACCOUNT_STATE_CHECK_FAILED')
    expect(err.message).not.toContain('relation')
    expect(logged(req)).toHaveBeenCalled()
  })

  it('④b 同一条路径的正常成功仍返回 payload(收紧没有把成功路径改掉)', async () => {
    verifyAccessToken.mockResolvedValue({ userId: 'u-1', phone: '', familyId: 'f', roleId: 0 })
    getUserStatus.mockResolvedValue(1)
    await expect(authenticate(fakeRequest())).resolves.toMatchObject({ userId: 'u-1' })
  })

  it('⑤ requireActiveUser:注销仍 401 / 查失败 502 / 正常放行', async () => {
    getUserStatus.mockResolvedValue(3)
    const e1 = (await requireActiveUser(fakeRequest('u-1')).catch((e: unknown) => e)) as Thrown
    expect(e1.statusCode).toBe(401)
    expect(e1.message).toBe('账号已注销')

    getUserStatus.mockRejectedValue(new Error('too many connections'))
    const req = fakeRequest('u-1')
    const e2 = (await requireActiveUser(req).catch((e: unknown) => e)) as Thrown
    expect(e2.statusCode).toBe(502)
    expect(e2.errorCode).toBe('ACCOUNT_STATE_CHECK_FAILED')
    expect(e2.message).not.toContain('too many connections')
    expect(logged(req)).toHaveBeenCalled()

    getUserStatus.mockResolvedValue(1)
    await expect(requireActiveUser(fakeRequest('u-1'))).resolves.toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
