/**
 * 回归测试:BUG-R17-DB-FAILOVER
 *
 * bugId: BUG-R17-DB-FAILOVER
 * 轮次: 17
 * 场景: 模拟主库连接超时,验证切换到从库
 *       旧架构来源: server/tests/test_bug_fixes_round17.py
 *
 * 验证点:
 *  - primary.ping() 超时,触发 failoverToReplica
 *  - failover 后查询路由到 replica
 *  - failover 后只读模式(write 抛错误)
 *  - primary 恢复后,切回 primary(读+写正常)
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/db-failover.test.ts
 */
import { describe, it, expect, vi } from 'vitest'

/** 模拟数据库接口 */
interface MockDb {
  name: string
  isHealthy: boolean
  isReadOnly: boolean
  ping(): Promise<boolean>
  query(sql: string): Promise<{ rows: unknown[]; from: string }>
  write(sql: string): Promise<{ affected: number; from: string }>
}

/** 创建 mock 数据库 */
function createMockDb(
  name: string,
  opts: { healthy?: boolean; readOnly?: boolean } = {},
): MockDb & {
  setHealthy(v: boolean): void
  setReadOnly(v: boolean): void
} {
  const state = {
    isHealthy: opts.healthy ?? true,
    isReadOnly: opts.readOnly ?? false,
  }
  return {
    name,
    isHealthy: state.isHealthy,
    isReadOnly: state.isReadOnly,
    async ping() {
      return state.isHealthy
    },
    async query(_sql: string) {
      if (!state.isHealthy) throw new Error(`${name} unreachable`)
      return { rows: [{ data: 'sample' }], from: name }
    },
    async write(_sql: string) {
      if (!state.isHealthy) throw new Error(`${name} unreachable`)
      if (state.isReadOnly) throw new Error(`${name} is read-only`)
      return { affected: 1, from: name }
    },
    setHealthy(v: boolean) {
      state.isHealthy = v
      this.isHealthy = v
    },
    setReadOnly(v: boolean) {
      state.isReadOnly = v
      this.isReadOnly = v
    },
  }
}

/** 主库 ping 超时阈值(ms) */
const PING_TIMEOUT_MS = 50

/**
 * 数据库故障切换管理器
 * - 默认使用 primary
 * - primary 不可用时 failover 到 replica(只读)
 * - primary 恢复后可切回
 */
class DbFailover {
  private primary: MockDb
  private replica: MockDb
  private current: MockDb
  private failoverMode = false

  constructor(primary: MockDb, replica: MockDb) {
    this.primary = primary
    this.replica = replica
    this.current = primary
  }

  /** 获取当前数据库 */
  getDb(): MockDb {
    return this.current
  }

  /** 当前是否处于 failover 模式 */
  isFailover(): boolean {
    return this.failoverMode
  }

  /** 探测 primary,失败则切换到 replica */
  async failover(): Promise<void> {
    let primaryOk = false
    try {
      primaryOk = await Promise.race([
        this.primary.ping(),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), PING_TIMEOUT_MS)),
      ])
    } catch {
      primaryOk = false
    }
    if (!primaryOk) {
      this.current = this.replica
      this.failoverMode = true
    }
  }

  /** 切回 primary(primary 恢复后调用) */
  async recover(): Promise<void> {
    const ok = await this.primary.ping()
    if (ok) {
      this.current = this.primary
      this.failoverMode = false
    }
  }

  /** 在当前库执行查询(读) */
  async query(sql: string) {
    return this.current.query(sql)
  }

  /** 在当前库执行写入 */
  async write(sql: string) {
    if (this.failoverMode) {
      throw new Error('Cannot write in failover (read-only) mode')
    }
    return this.current.write(sql)
  }
}

describe('BUG-R17-DB-FAILOVER:数据库故障切换', () => {
  it('创建 mock primary + replica,默认使用 primary', async () => {
    const primary = createMockDb('primary')
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    expect(fm.getDb().name).toBe('primary')
    expect(fm.isFailover()).toBe(false)
    const result = await fm.query('SELECT 1')
    expect(result.from).toBe('primary')
  })

  it('primary.ping() 超时 → 触发 failover 切换到 replica', async () => {
    const primary = createMockDb('primary')
    // 让 primary ping 永远不返回(模拟超时)
    primary.ping = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>(() => {
          /* never resolves */
        }),
    )
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    await fm.failover()
    expect(fm.isFailover()).toBe(true)
    expect(fm.getDb().name).toBe('replica')
  })

  it('primary 返回 false(不健康) → 触发 failover', async () => {
    const primary = createMockDb('primary', { healthy: false })
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    await fm.failover()
    expect(fm.isFailover()).toBe(true)
    expect(fm.getDb().name).toBe('replica')
  })

  it('failover 后查询路由到 replica', async () => {
    const primary = createMockDb('primary', { healthy: false })
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    await fm.failover()
    const result = await fm.query('SELECT * FROM users')
    expect(result.from).toBe('replica')
  })

  it('failover 后只读模式 → write 抛错误', async () => {
    const primary = createMockDb('primary', { healthy: false })
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    await fm.failover()
    await expect(fm.write('UPDATE users SET x=1')).rejects.toThrow(/read-only/)
  })

  it('primary 恢复后,切回 primary(读+写正常)', async () => {
    const primary = createMockDb('primary', { healthy: false })
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    // 初始 failover 到 replica
    await fm.failover()
    expect(fm.isFailover()).toBe(true)
    // primary 恢复
    primary.setHealthy(true)
    await fm.recover()
    expect(fm.isFailover()).toBe(false)
    expect(fm.getDb().name).toBe('primary')
    // 读+写都正常
    const r = await fm.query('SELECT 1')
    expect(r.from).toBe('primary')
    const w = await fm.write('UPDATE x SET y=1')
    expect(w.from).toBe('primary')
  })

  it('recover 时 primary 仍不可用 → 不切换', async () => {
    const primary = createMockDb('primary', { healthy: false })
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    await fm.failover()
    // primary 仍未恢复
    await fm.recover()
    expect(fm.isFailover()).toBe(true)
    expect(fm.getDb().name).toBe('replica')
  })

  it('primary 正常时 failover 不切换', async () => {
    const primary = createMockDb('primary', { healthy: true })
    const replica = createMockDb('replica', { readOnly: true })
    const fm = new DbFailover(primary, replica)
    await fm.failover()
    expect(fm.isFailover()).toBe(false)
    expect(fm.getDb().name).toBe('primary')
  })
})
