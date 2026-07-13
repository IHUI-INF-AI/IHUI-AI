import { describe, it, expect, vi } from 'vitest'
import { TenantAuditor } from '../src/utils/tenant-audit.js'

describe('TenantAuditor check — skipTables', () => {
  it('系统表 (admin_user) 跳过审计', () => {
    const a = new TenantAuditor()
    expect(a.check('SELECT * FROM admin_user')).toBeNull()
  })
})

describe('TenantAuditor check — 未注册表', () => {
  it('不在 tenantTables 也不在 skipTables 的表跳过', () => {
    const a = new TenantAuditor()
    expect(a.check('SELECT * FROM some_unregistered_table')).toBeNull()
  })
})

describe('TenantAuditor check — SELECT 缺 tenant_id', () => {
  it('业务表 select 无 tenant_id → 违规', () => {
    const a = new TenantAuditor()
    const v = a.check('SELECT * FROM orders WHERE status = 1', [], null, 'u1')
    expect(v).not.toBeNull()
    expect(v?.table).toBe('orders')
    expect(v?.kind).toBe('missing_tenant_filter')
    expect(v?.userUuid).toBe('u1')
  })

  it('select 含 tenant_id → 通过', () => {
    const a = new TenantAuditor()
    expect(a.check('SELECT * FROM orders WHERE tenant_id = 1', [], 1, 'u1')).toBeNull()
  })

  it('select 参数首位是数字 → 启发式通过', () => {
    const a = new TenantAuditor()
    expect(a.check('SELECT * FROM orders WHERE id = $1', [42], 1, 'u1')).toBeNull()
  })

  it('select 参数首位是过大数字(>100000)→ 启发式不通过', () => {
    const a = new TenantAuditor()
    const v = a.check('SELECT * FROM orders WHERE id = $1', [999999])
    expect(v).not.toBeNull()
  })
})

describe('TenantAuditor check — UPDATE/DELETE', () => {
  it('update 缺 tenant_id → 违规', () => {
    const a = new TenantAuditor()
    const v = a.check('UPDATE orders SET status = 0 WHERE id = 1', [], 1, 'u1')
    expect(v).not.toBeNull()
    expect(v?.kind).toBe('missing_tenant_filter')
  })

  it('delete 缺 tenant_id → 违规', () => {
    const a = new TenantAuditor()
    expect(a.check('DELETE FROM orders WHERE id = 1', [], 1, 'u1')).not.toBeNull()
  })
})

describe('TenantAuditor check — INSERT', () => {
  it('insert 无 tenant_id → 违规 (insert_no_tenant)', () => {
    const a = new TenantAuditor()
    const v = a.check("INSERT INTO orders (name, amount) VALUES ('x', 1)", [], 1, 'u1')
    expect(v).not.toBeNull()
    expect(v?.kind).toBe('insert_no_tenant')
  })

  it('insert 含 tenant_id → 通过', () => {
    const a = new TenantAuditor()
    expect(a.check("INSERT INTO orders (name, tenant_id) VALUES ('x', 1)", [], 1, 'u1')).toBeNull()
  })
})

describe('TenantAuditor check — 非 DML 跳过', () => {
  it('CREATE TABLE 不计为 DML 违规', () => {
    const a = new TenantAuditor()
    expect(a.check('CREATE TABLE foo (id int)')).toBeNull()
  })
})

describe('TenantAuditor 配置', () => {
  it('addTenantTable 移动表到审计集合', () => {
    const a = new TenantAuditor()
    a.addTenantTable('custom_table')
    const v = a.check('SELECT * FROM custom_table', [], 1, 'u1')
    expect(v).not.toBeNull()
  })

  it('whitelistTable 移动表到跳过集合', () => {
    const a = new TenantAuditor()
    a.whitelistTable('orders')
    expect(a.check('SELECT * FROM orders', [], 1, 'u1')).toBeNull()
  })

  it('setAlertThreshold 边界裁剪到 [0,1]', () => {
    const a = new TenantAuditor()
    a.setAlertThreshold(2)
    expect(a.stats().alertThreshold).toBe(1)
    a.setAlertThreshold(-0.5)
    expect(a.stats().alertThreshold).toBe(0)
  })
})

describe('TenantAuditor stats/recentViolations/reset', () => {
  it('stats 准确计数 byTable/byTableViolations', () => {
    const a = new TenantAuditor()
    a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1')
    a.check('SELECT * FROM orders WHERE id = 2', [], 1, 'u1')
    a.check('SELECT * FROM users WHERE id = 1', [], 1, 'u1')
    const s = a.stats()
    expect(s.auditedQueries).toBe(3)
    expect(s.violations).toBe(3)
    expect(s.byTable.orders).toBe(2)
    expect(s.byTableViolations.orders).toBe(2)
  })

  it('violationRate 保留 4 位小数', () => {
    const a = new TenantAuditor()
    a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1')
    a.check('SELECT * FROM orders WHERE tenant_id = 1', [], 1, 'u1')
    a.check('SELECT * FROM orders WHERE tenant_id = 1', [], 1, 'u1')
    const s = a.stats()
    // 1 violation / 3 audited ≈ 0.3333
    expect(s.violationRate).toBeCloseTo(0.3333, 3)
  })

  it('recentViolations 限制返回数量', () => {
    const a = new TenantAuditor()
    for (let i = 0; i < 5; i++) a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1')
    expect(a.recentViolations(3)).toHaveLength(3)
    expect(a.recentViolations()).toHaveLength(5)
  })

  it('reset 清空所有计数与违规', () => {
    const a = new TenantAuditor()
    a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1')
    a.reset()
    const s = a.stats()
    expect(s.totalQueries).toBe(0)
    expect(s.violations).toBe(0)
  })
})

describe('TenantAuditor 告警回调', () => {
  it('违规率超阈值且达最小审计量时触发 alertFn', () => {
    const a = new TenantAuditor()
    a.setAlertThreshold(0.5)
    const fn = vi.fn()
    a.setAlertFn(fn)
    // 默认 minAuditsForAlert=50, 50 次审计
    for (let i = 0; i < 50; i++) {
      a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1')
    }
    expect(fn).toHaveBeenCalled()
    expect(fn.mock.calls[0][0]).toBe('tenant_audit_violation:orders')
  })

  it('未达 minAuditsForAlert 时不告警', () => {
    const a = new TenantAuditor()
    a.setAlertThreshold(0.01)
    const fn = vi.fn()
    a.setAlertFn(fn)
    a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1') // 1/1=100% 但未达 50
    expect(fn).not.toHaveBeenCalled()
  })

  it('resetAlert 允许重新告警', () => {
    const a = new TenantAuditor()
    a.setAlertThreshold(0.5)
    const fn = vi.fn()
    a.setAlertFn(fn)
    for (let i = 0; i < 50; i++) {
      a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1')
    }
    const callsAfterFirst = fn.mock.calls.length
    a.resetAlert('orders')
    // 再次违规不再触发 (已记入 alertedTables 后 reset 清掉)
    for (let i = 0; i < 50; i++) {
      a.check('SELECT * FROM orders WHERE id = 1', [], 1, 'u1')
    }
    expect(fn.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })
})

describe('TenantAuditor 大小写与表名变体', () => {
  it('表名大小写不敏感', () => {
    const a = new TenantAuditor()
    expect(a.check('SELECT * FROM ORDERS WHERE id = 1', [], 1, 'u1')).not.toBeNull()
  })
})
