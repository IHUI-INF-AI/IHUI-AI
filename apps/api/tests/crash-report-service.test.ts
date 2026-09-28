// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * crash-report-service 测试(2026-08-06 新增功能)。
 *
 * 覆盖:
 *  - recordCrash 成功:insert → values → returning,返回 { id }
 *  - 静默失败:db 抛错不 rethrow,返回 { id: '' } 且记 warn 日志
 *  - 字段截断:errorMessage ≤ 4000 / stack ≤ 20000 / route ≤ 512
 *    (夹具用非十六进制填充字符:纯 [0-9a-f] 长串会被 D94 脱敏规则整段盖掉,截断判据就量不到原长了)
 *  - 落库前**先脱敏再截断**(ea8ccb36a 立的权威防线):凭据在内嵌长文本中也被盖
 *  - 缺省字段 → null / 'unknown'
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockLoggerWarn, mockInsert } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: mockInsert },
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题)
vi.mock('@ihui/database', () => ({
  crashReports: { id: 'crash_reports_id' },
}))

import { recordCrash } from '../src/services/crash-report-service'

describe('recordCrash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功写入返回落库 id', async () => {
    mockInsert.mockReturnValue({
      values: vi
        .fn()
        .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'crash-1' }]) }),
    })
    const result = await recordCrash({
      platform: 'ios',
      errorMessage: 'boom',
    })
    expect(result).toEqual({ id: 'crash-1' })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('db 抛错时静默失败:返回 { id: "" } 不 rethrow,记 warn 日志', async () => {
    mockInsert.mockImplementation(() => {
      throw new Error('db connection lost')
    })
    const result = await recordCrash({
      platform: 'web',
      errorMessage: 'will-fail',
    })
    expect(result).toEqual({ id: '' })
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
  })

  it('returning 无行时返回 { id: "" }', async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    })
    const result = await recordCrash({ platform: 'android', errorMessage: 'no-row' })
    expect(result).toEqual({ id: '' })
  })

  it('缺省字段落为 null,errorMessage 缺失时兜底 unknown', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-2' }]) }
      }),
    })
    await recordCrash({ platform: 'cli' } as unknown as Parameters<typeof recordCrash>[0])
    expect(captured).toMatchObject({
      version: null,
      userId: null,
      stack: null,
      route: null,
      errorMessage: 'unknown',
    })
  })

  it('字段截断:errorMessage>4000 截断、stack>20000 截断、route>512 截断', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-3' }]) }
      }),
    })
    // 填充字符必须避开 [0-9a-fA-F]:否则整串先被 D94 十六进制脱敏规则盖成
    // [REDACTED_SECRET](17 字符),本用例就测不到截断而是测到脱敏了。
    await recordCrash({
      platform: 'ios',
      errorMessage: 'x'.repeat(5000),
      stack: 's'.repeat(30000),
      route: 'r'.repeat(1000),
    })
    expect((captured.errorMessage as string).length).toBe(4000)
    expect((captured.stack as string).length).toBe(20000)
    expect((captured.route as string).length).toBe(512)
  })

  it('先脱敏再截断:超长文本内嵌的凭据被盖,截断不把凭据切成半截漏盖', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-5' }]) }
      }),
    })
    const fakeKey = `sk-${'A'.repeat(30)}`
    await recordCrash({
      platform: 'web',
      errorMessage: `${fakeKey} ${'x'.repeat(5000)}`,
    })
    const msg = captured.errorMessage as string
    expect(msg).toContain('[REDACTED_SECRET]')
    expect(msg).not.toContain(fakeKey)
    expect(msg.length).toBe(4000)
  })

  it('userId 与 version 显式传值时原样落库', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-4' }]) }
      }),
    })
    await recordCrash({ userId: 'u-1', platform: 'desktop', version: '9.9.9', errorMessage: 'x' })
    expect(captured).toMatchObject({ userId: 'u-1', version: '9.9.9' })
  })
})
