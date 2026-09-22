// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 启动钩子 initVendorConfigs 单元测试（R4 重构产物）。
 *
 * 验证：
 * - 数据库插入成功时记录 inserted 计数
 * - onConflictDoNothing 命中时记录 skipped
 * - 异常时降级为 warn 而非 throw（不阻塞服务启动）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockOnConflict = vi.fn()
const mockReturning = vi.fn()

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_READ_REPLICA_URL: '',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: mockInsert,
  },
}))

type MockLogger = {
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}
const log: MockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const { initVendorConfigs } = await import('../src/lifecycle/init-vendor-configs.js')

describe('initVendorConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ENABLE_VENDOR_INIT
    mockReturning.mockResolvedValue([{ vendorCode: 'dashscope' }])
    mockOnConflict.mockReturnValue({ returning: mockReturning })
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflict })
    mockInsert.mockReturnValue({ values: mockValues })
  })

  // 厂商数随 FALLBACK_VENDORS 增长(写死 11 曾在扩厂商后长期红)。改为断言不变量:
  // 每个 fallback 厂商恰好被尝试插入一次,且日志 total 与实际插入次数自洽。
  it('按 FALLBACK_VENDORS 全量各插入一次(不写死厂商数)', async () => {
    await initVendorConfigs(log)
    const n = mockInsert.mock.calls.length
    expect(n).toBeGreaterThan(0)
    const codes = new Set(
      mockValues.mock.calls.map((c) => (c[0] as { vendorCode?: string })?.vendorCode),
    )
    expect(codes.size).toBe(n)
    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ total: n }), expect.any(String))
  })

  it('ENABLE_VENDOR_INIT=false 时跳过', async () => {
    process.env.ENABLE_VENDOR_INIT = 'false'
    await initVendorConfigs(log)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('禁用'))
  })

  it('returning 命中时计入 inserted', async () => {
    mockReturning.mockResolvedValue([{ vendorCode: 'dashscope' }])
    await initVendorConfigs(log)
    const n = mockInsert.mock.calls.length
    expect(n).toBeGreaterThan(0)
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ inserted: n, skipped: 0 }),
      expect.any(String),
    )
  })

  it('returning 空数组时计入 skipped', async () => {
    mockReturning.mockResolvedValue([])
    await initVendorConfigs(log)
    const n = mockInsert.mock.calls.length
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ inserted: 0, skipped: n }),
      expect.any(String),
    )
  })

  it('插入异常时降级为 warn 而不 throw', async () => {
    mockReturning.mockRejectedValue(new Error('relation does not exist'))
    // 不应 throw
    await expect(initVendorConfigs(log)).resolves.not.toThrow()
    // 全部厂商各自失败一次(不写死厂商数):warn 次数与实际插入尝试次数一致
    expect(log.warn).toHaveBeenCalledTimes(mockInsert.mock.calls.length)
    expect(mockInsert.mock.calls.length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
