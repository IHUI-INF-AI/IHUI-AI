// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// SDB-35 回归钉:低流量窗口 Prometheus 的 0/0 比率返回 "NaN",旧判据 NaN < 阈值 === false
// 把"未知"当"不健康",健康版本被自动回滚。三态:healthy / unhealthy / unknown。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rollbackCanary: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock('../src/services/canary-service.js', () => ({ rollbackCanary: mocks.rollbackCanary }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: mocks.info, warn: mocks.warn, error: mocks.error },
}))

// 阈值在模块加载期读取,必须先写 env 再动态 import;测试只发 mock fetch,不连真 Prometheus。
process.env.CANARY_ERROR_RATE_THRESHOLD = '0.05'
const { checkCanaryHealth } = await import('../src/services/auto-rollback.js')

type PromResult = Array<{ value: [number, string] }>

function stubPrometheus(result: PromResult): void {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: 'success', data: { result } }),
  }))
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
}

const UNKNOWN_LOG = '[auto-rollback] canary health unknown, skip rollback'

describe('SDB-35 金丝雀健康判定三态', () => {
  beforeEach(() => {
    mocks.rollbackCanary.mockClear()
    mocks.warn.mockClear()
    mocks.error.mockClear()
    delete process.env.CANARY_CONFIG_NAME
    delete process.env.CANARY_PERCENTAGE
    delete process.env.CANARY_ENABLED
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① NaN(0/0)⇒ 未知,不触发回滚,原因可观测', async () => {
    stubPrometheus([{ value: [1_700_000_000, 'NaN'] }])

    const status = await checkCanaryHealth()

    expect(status.state).toBe('unknown')
    expect(status.errorRate).toBeNull()
    expect(status.rolledBack).toBe(false)
    expect(status.reason).toContain('NaN')
    expect(mocks.rollbackCanary).not.toHaveBeenCalled()
    expect(process.env.CANARY_PERCENTAGE).toBeUndefined()
    const logged = mocks.warn.mock.calls.find(([msg]) => msg === UNKNOWN_LOG)
    expect(logged?.[1]).toMatchObject({ reason: expect.stringContaining('NaN') })
  })

  it('② 无样本/空结果 ⇒ 同为未知,不触发回滚', async () => {
    stubPrometheus([])

    const status = await checkCanaryHealth()

    expect(status.state).toBe('unknown')
    expect(status.errorRate).toBeNull()
    expect(status.rolledBack).toBe(false)
    expect(status.reason).toBe('prometheus returned no sample')
    expect(mocks.rollbackCanary).not.toHaveBeenCalled()
    expect(mocks.warn.mock.calls.some(([msg]) => msg === UNKNOWN_LOG)).toBe(true)
  })

  it('③ 有效越界值 ⇒ 照旧判不健康并回滚', async () => {
    process.env.CANARY_CONFIG_NAME = 'sdb35-canary'
    stubPrometheus([{ value: [1_700_000_000, '0.2'] }])

    const status = await checkCanaryHealth()

    expect(status.state).toBe('unhealthy')
    expect(status.healthy).toBe(false)
    expect(status.errorRate).toBeCloseTo(0.2)
    expect(status.rolledBack).toBe(true)
    expect(process.env.CANARY_PERCENTAGE).toBe('0')
    expect(mocks.rollbackCanary).toHaveBeenCalledWith(
      'sdb35-canary',
      expect.stringContaining('exceeded threshold'),
    )
  })

  it('④ 有效正常值 ⇒ 健康,不回滚', async () => {
    stubPrometheus([{ value: [1_700_000_000, '0.01'] }])

    const status = await checkCanaryHealth()

    expect(status.state).toBe('healthy')
    expect(status.healthy).toBe(true)
    expect(status.errorRate).toBeCloseTo(0.01)
    expect(status.rolledBack).toBe(false)
    expect(mocks.rollbackCanary).not.toHaveBeenCalled()
    expect(mocks.warn).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
