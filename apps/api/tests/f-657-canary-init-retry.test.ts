// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-657 回归锁(2026-11-13)。
 *
 * 病灶:canary-service 的 `initPromise` 惰性赋值后永不清理,首次建表 DDL 因 DB 抖动失败后,
 * 模块内缓存的 promise 恒 rejected,直到进程重启;金丝雀阶段读写与自动回滚审计全部以旧错误失败。
 *
 * 本文件锁:
 *   ① 首次建表失败后不缓存 rejected promise,下一次调用重新尝试建表(不是恒等旧错误);
 *   ② 第二次调用重新走建表并成功完成业务写入;
 *   ③ 并发等待同一个 rejected promise 的调用者都收到原始错误(不吞错),之后的新调用仍能重试成功。
 *
 * 只 mock db / logger,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CanaryConfig } from '../src/services/canary-service.js'

const { dbExecute, loggerError } = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: (...args: unknown[]) => dbExecute(...args) },
  dbRead: { execute: (...args: unknown[]) => dbExecute(...args) },
  dbClient: {},
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

type Service = {
  createCanary: (name: string) => Promise<CanaryConfig>
  promoteCanary: (name: string) => Promise<CanaryConfig>
}

const ROW = {
  id: 'cfg-1',
  name: 'checkout',
  currentStage: 'canary_1pct',
  targetStage: 'full',
  failureThreshold: 5,
  cooldownMinutes: 30,
  startedAt: new Date('2026-11-13T00:00:00Z'),
  lastPromotedAt: null,
  failureCount: 0,
  isActive: true,
}

describe('F-657 canary-service 建表失败后可自愈重试', () => {
  let canary: Service

  beforeEach(async () => {
    vi.resetModules()
    dbExecute.mockReset()
    loggerError.mockReset()
    dbExecute.mockResolvedValue([])
    canary = await import('../src/services/canary-service.js')
  })

  it('① 首次建表失败后不缓存 rejected promise,下一次调用重新尝试建表', async () => {
    dbExecute.mockRejectedValueOnce(new Error('DDL connection reset'))

    await expect(canary.promoteCanary('checkout')).rejects.toThrow('DDL connection reset')
    expect(dbExecute).toHaveBeenCalledTimes(1)

    // 第二次调用:若 rejected promise 仍被缓存,这里会继续抛 'DDL connection reset';
    // 实际应重新执行两次建表 DDL,再读出空配置行 → 'not found'。
    await expect(canary.promoteCanary('checkout')).rejects.toThrow('not found')
    expect(dbExecute).toHaveBeenCalledTimes(4)
  })

  it('② 第二次调用重新尝试建表并成功完成创建', async () => {
    dbExecute
      .mockRejectedValueOnce(new Error('DDL timeout'))
      .mockResolvedValueOnce([]) // CREATE TABLE canary_configs
      .mockResolvedValueOnce([]) // CREATE TABLE canary_audit_logs
      .mockResolvedValueOnce([ROW]) // INSERT ... RETURNING
      .mockResolvedValue([]) // INSERT audit log

    await expect(canary.createCanary('checkout')).rejects.toThrow('DDL timeout')

    const created = await canary.createCanary('checkout')
    expect(created.id).toBe('cfg-1')
    expect(dbExecute).toHaveBeenCalledTimes(5)
    expect(loggerError).toHaveBeenCalledTimes(1)
  })

  it('③ 并发失败不误缓存:等待者都收到原始错误,后续新调用仍能重试成功', async () => {
    dbExecute.mockRejectedValueOnce(new Error('DDL too many connections'))

    const [first, second] = await Promise.allSettled([
      canary.createCanary('checkout'),
      canary.createCanary('checkout'),
    ])
    expect(first.status).toBe('rejected')
    expect(second.status).toBe('rejected')
    if (first.status === 'rejected') expect(first.reason.message).toBe('DDL too many connections')
    if (second.status === 'rejected') expect(second.reason.message).toBe('DDL too many connections')
    // 并发调用共用同一次建表尝试,而不是各自打库
    expect(dbExecute).toHaveBeenCalledTimes(1)

    // 后续新调用必须重新建表并成功,而不是继续吃掉旧的 rejected promise
    dbExecute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ROW])
      .mockResolvedValue([])

    await expect(canary.createCanary('checkout')).resolves.toMatchObject({ id: 'cfg-1' })
  })
})
