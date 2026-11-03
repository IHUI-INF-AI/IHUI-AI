// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 老门(常驻共享密钥)使用留痕的回归锁(2026-11-01)。
 *
 * 为什么需要这格:`INTERNAL_SERVICE_AUTH_MODE` 的 `dual` 档放行的是"持一把不轮换的全局密钥
 * 即可自报 x-user-id"—— 那把钥匙等于任意用户身份。该关,但**没有证据不能关**:本仓刚在
 * auth-default-deny 上实测过一次"加固把第一方回环调用整片 401"。所以先把"还有谁在用"
 * 变成读得到的数,关闭动作才有依据。
 *
 * 断言口径刻意用**增量**而不是绝对值:计数器是模块级状态,用例之间会互相看见。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  // §5 测试隔离铁律:任何用例都不得触真库/真 Redis
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'unit-test-only-internal-ticket-secret-0123456789abcdef'
})

const TEST_AI_CALLBACK_SECRET = 'internal-secret-value-for-legacy-door-tests-0123456789'
const SUBJECT = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/index.js', () => {
  const chain = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => mockSelect() }) }) }),
  }
  const stub = {
    ...chain,
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
  }
  return { db: stub, dbRead: stub, dbWriter: stub, dbClient: { end: vi.fn() } }
})

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: { ...base, AI_CALLBACK_SECRET: TEST_AI_CALLBACK_SECRET },
  }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const { checkInternalServiceToken, internalAuthLegacyDoorUses } =
  await import('../src/plugins/internal-service-token')
const { logger } = await import('../src/utils/logger.js')

function legacyWarnEvents(): string[] {
  return vi
    .mocked(logger.warn)
    .mock.calls.map((c) => String((c[1] as { event?: string } | undefined)?.event ?? ''))
}

async function probeWith(
  headers: Record<string, string>,
  mode: string,
  urlPath = '/probe',
): Promise<number> {
  process.env.INTERNAL_SERVICE_AUTH_MODE = mode
  const app: FastifyInstance = Fastify({ logger: false })
  let statusCode = 0
  app.get(urlPath, async (request, reply) => {
    const ok = await checkInternalServiceToken(request, reply)
    if (!ok) {
      statusCode = reply.statusCode
      return reply
    }
    statusCode = 200
    return reply.send({ ok: true })
  })
  await app.ready()
  try {
    const res = await app.inject({ method: 'GET', url: urlPath, headers })
    expect(res.statusCode).toBe(statusCode)
  } finally {
    await app.close()
  }
  return statusCode
}

beforeEach(() => {
  vi.mocked(logger.warn).mockClear()
  // 库里存在且活跃的主体(注入归属要过"存在 + 活跃"这一道)
  mockSelect.mockResolvedValue([{ id: SUBJECT, status: 1, roleId: 0 }])
})

afterEach(() => {
  delete process.env.INTERNAL_SERVICE_AUTH_MODE
})

describe('老门使用留痕', () => {
  it('老门认证成功 ⇒ 计数 +1 且点名是哪个端点在用它', async () => {
    const before = internalAuthLegacyDoorUses()
    const code = await probeWith(
      { 'x-internal-service-token': TEST_AI_CALLBACK_SECRET, 'x-user-id': SUBJECT },
      'dual',
      '/probe-legacy',
    )
    expect(code).toBe(200)
    expect(internalAuthLegacyDoorUses() - before).toBe(1)
    const events = legacyWarnEvents()
    expect(events).toContain('internal_auth_legacy_door_used')
    const call = vi
      .mocked(logger.warn)
      .mock.calls.find(
        (c) => (c[1] as { event?: string })?.event === 'internal_auth_legacy_door_used',
      )
    const meta = call?.[1] as { endpoint?: string }
    expect(meta.endpoint).toBe('GET /probe-legacy')
    // 出路必须写在日志里,否则收信人只知道"有人在用",不知道该做什么(§5e-1)
    expect(String(call?.[0])).toContain('INTERNAL_SERVICE_AUTH_MODE=ticket')
  })

  it('票认证成功 ⇒ 老门计数**不增**(不留假归因)', async () => {
    const { mintInternalServiceTicket, INTERNAL_TICKET_HEADER } =
      await import('../src/plugins/internal-service-ticket')
    const ticket = await mintInternalServiceTicket({ userId: SUBJECT, scope: 'memory' })
    expect(typeof ticket).toBe('string')
    const before = internalAuthLegacyDoorUses()
    const code = await probeWith({ [INTERNAL_TICKET_HEADER]: ticket }, 'dual', '/probe-ticket')
    // 即便票判不过(测试桩里没有真 redis),也不该被算成"用了老门"
    expect([200, 401]).toContain(code)
    expect(internalAuthLegacyDoorUses()).toBe(before)
    expect(legacyWarnEvents()).not.toContain('internal_auth_legacy_door_used')
  })

  it('同一端点短时间内重复使用 ⇒ 计数累加但只记一条(防刷爆日志盘)', async () => {
    const before = internalAuthLegacyDoorUses()
    await probeWith(
      { 'x-internal-service-token': TEST_AI_CALLBACK_SECRET, 'x-user-id': SUBJECT },
      'dual',
      '/probe-throttle',
    )
    await probeWith(
      { 'x-internal-service-token': TEST_AI_CALLBACK_SECRET, 'x-user-id': SUBJECT },
      'dual',
      '/probe-throttle',
    )
    expect(internalAuthLegacyDoorUses() - before).toBe(2)
    const n = legacyWarnEvents().filter((e) => e === 'internal_auth_legacy_door_used').length
    expect(n).toBe(1)
  })

  it('反向自证:ticket 档下只带老头被拒,且**不**计入使用量(关了就不该再喊)', async () => {
    const before = internalAuthLegacyDoorUses()
    const code = await probeWith(
      { 'x-internal-service-token': TEST_AI_CALLBACK_SECRET, 'x-user-id': SUBJECT },
      'ticket',
      '/probe-ticket-only',
    )
    expect(code).toBe(401)
    expect(internalAuthLegacyDoorUses()).toBe(before)
    expect(legacyWarnEvents()).not.toContain('internal_auth_legacy_door_used')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
