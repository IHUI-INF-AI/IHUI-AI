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
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_READ_REPLICA_URL: '',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
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

  it('默认执行 11 个厂商插入', async () => {
    await initVendorConfigs(log)
    expect(mockInsert).toHaveBeenCalledTimes(11)
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ total: 11 }),
      expect.any(String),
    )
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
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ inserted: 11, skipped: 0 }),
      expect.any(String),
    )
  })

  it('returning 空数组时计入 skipped', async () => {
    mockReturning.mockResolvedValue([])
    await initVendorConfigs(log)
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ inserted: 0, skipped: 11 }),
      expect.any(String),
    )
  })

  it('插入异常时降级为 warn 而不 throw', async () => {
    mockReturning.mockRejectedValue(new Error('relation does not exist'))
    // 不应 throw
    await expect(initVendorConfigs(log)).resolves.not.toThrow()
    // 11 个厂商都失败
    expect(log.warn).toHaveBeenCalledTimes(11)
  })
})
