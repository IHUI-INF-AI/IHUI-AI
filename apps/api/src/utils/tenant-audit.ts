/**
 * 租户审计: 多租户数据隔离审计.
 *
 * 风险: 业务代码忘记带 tenant_id 过滤条件, 导致跨租户数据泄露.
 * 方案: 检查 SQL 是否包含 tenant_id 过滤, 不包含则记录违规
 *      (按表名 + 调用栈聚合), 触发告警.
 *
 * 注意: 原始 Python 版通过 SQLAlchemy event 钩子自动拦截;
 *      本 TS 版提供 check() 方法供 Drizzle/手动调用点接入,
 *      以及 attachToQueryHook() 便于在 DB 层包装.
 *
 * 参考: git show 3ee96cf0:server/app/utils/tenant_audit.py
 */

/** 跨租户访问违规记录. */
export interface Violation {
  table: string
  sql: string
  timestamp: number
  stack: string
  tenantId: number | null
  userUuid: string
  /** 违规类型: missing_tenant_filter / insert_no_tenant */
  kind: string
}

/** 聚合统计. */
export interface AuditStats {
  totalQueries: number
  auditedQueries: number
  violations: number
  violationRate: number
  alertThreshold: number
  byTable: Record<string, number>
  byTableViolations: Record<string, number>
  trackedTenantTables: number
  skippedTables: number
}

/** 默认带 tenant_id 的表 (业务表). */
export const DEFAULT_TENANT_TABLES = new Set<string>([
  'orders',
  'zhs_order',
  'users',
  'user_info',
  'agents',
  'agent_buy',
  'vip_level',
  'user_vip',
  'course',
  'zhs_course',
  'course_pay',
  'zhs_course_pay',
  'oauth_users',
  'oauth_sessions',
  'agents_call_log',
  'zhs_user_agent_context',
  'zhs_user_model_chat',
  'video_generation_tasks',
])

/** 系统表 / 不需要 tenant_id 的表. */
export const DEFAULT_SKIP_TABLES = new Set<string>([
  'admin_user',
  'admin_role',
  'admin_menu',
  'admin_dept',
  'admin_post',
  'admin_user_role',
  'admin_role_menu',
  'admin_role_dept',
  'admin_user_post',
  'admin_config',
  'admin_dict_type',
  'admin_dict_data',
  'admin_oper_log',
  'admin_logininfor',
  'admin_notice',
  'admin_job',
  'admin_job_log',
  'sys_refund_log',
  'alembic_version',
  'migrations',
  'zhs_ai_model_info',
  'zhs_dictionary',
  'exchange_rate',
  'agent_configs',
  'agent_billings',
  'zhs_agent_category',
  'zhs_activity',
  'zhs_banner_carousel',
])

type AlertFn = (key: string, message: string) => void

/**
 * 多租户数据隔离审计器.
 *
 * 模式:
 *   - BLACKLIST: 命中带 tenant_id 的表, 但 SQL 中没有 tenant_id 条件 -> 违规
 *   - WHITELIST: 命中不需要 tenant_id 的表 -> 跳过
 */
export class TenantAuditor {
  private readonly tenantTables = new Set<string>(DEFAULT_TENANT_TABLES)
  private readonly skipTables = new Set<string>(DEFAULT_SKIP_TABLES)
  private readonly violations: Violation[] = []
  private totalQueries = 0
  private auditedQueries = 0
  private violationCount = 0
  private readonly byTable = new Map<string, number>()
  private readonly byTableViolations = new Map<string, number>()
  private readonly alertedTables = new Set<string>()
  private alertThreshold = 0.1
  private readonly minAuditsForAlert = 50
  private readonly maxViolations = 5000
  private readonly stackDepth = 8
  private alertFn?: AlertFn

  /** 配置: 添加业务表. */
  addTenantTable(table: string): void {
    const t = table.toLowerCase()
    this.tenantTables.add(t)
    this.skipTables.delete(t)
  }

  /** 配置: 加入白名单. */
  whitelistTable(table: string): void {
    const t = table.toLowerCase()
    this.skipTables.add(t)
    this.tenantTables.delete(t)
  }

  /** 配置: 设置告警阈值. */
  setAlertThreshold(rate: number): void {
    this.alertThreshold = Math.max(0, Math.min(1, rate))
  }

  /** 配置: 设置告警回调. */
  setAlertFn(fn: AlertFn): void {
    this.alertFn = fn
  }

  /** 提取 SQL 主表名. */
  private extractMainTable(sql: string): string {
    const s = sql.replace(/\s+/g, ' ').trim()
    let m = /from\s+[`"']?([a-zA-Z0-9_]+)/i.exec(s)
    if (m) return m[1] ?? ''
    m = /update\s+[`"']?([a-zA-Z0-9_]+)/i.exec(s)
    if (m) return m[1] ?? ''
    m = /delete\s+from\s+[`"']?([a-zA-Z0-9_]+)/i.exec(s)
    if (m) return m[1] ?? ''
    m = /insert\s+into\s+[`"']?([a-zA-Z0-9_]+)/i.exec(s)
    if (m) return m[1] ?? ''
    return ''
  }

  /** 检查 SQL 是否含 tenant_id 条件. */
  private hasTenantFilter(sql: string, params?: unknown[]): boolean {
    if (sql.toLowerCase().includes('tenant_id')) return true
    if (params && params.length > 0) {
      // 启发: 第一个参数是 tenant_id 的概率较高
      const p = params[0]
      if (typeof p === 'number' && p > 0 && p < 100000) return true
    }
    return false
  }

  /** 记录违规. */
  private recordViolation(
    table: string,
    sql: string,
    tenantId: number | null,
    userUuid: string,
    kind: string,
  ): Violation {
    const stack = new Error('stack').stack ?? ''
    const v: Violation = {
      table,
      sql,
      timestamp: Date.now() / 1000,
      stack: stack.split('\n').slice(0, this.stackDepth).join('\n'),
      tenantId,
      userUuid,
      kind,
    }
    this.violations.push(v)
    if (this.violations.length > this.maxViolations) {
      this.violations.splice(0, this.violations.length - this.maxViolations)
    }
    this.violationCount += 1
    this.byTableViolations.set(table, (this.byTableViolations.get(table) ?? 0) + 1)
    if (!this.alertedTables.has(table)) this.maybeAlert(table)
    return v
  }

  private maybeAlert(table: string): void {
    if (this.auditedQueries < this.minAuditsForAlert) return
    const rate = this.auditedQueries > 0 ? this.violationCount / this.auditedQueries : 0
    if (rate < this.alertThreshold) return
    this.alertedTables.add(table)
    const fn = this.alertFn
    if (fn) {
      try {
        fn(
          `tenant_audit_violation:${table}`,
          `Tenant isolation violation rate ${(rate * 100).toFixed(1)}% on ${table} ` +
            `(${this.violationCount}/${this.auditedQueries}). Check business code for missing tenant_id filter.`,
        )
      } catch {
        /* 告警失败忽略 */
      }
    }
  }

  /** 重置告警状态. */
  resetAlert(table?: string): void {
    if (table) this.alertedTables.delete(table)
    else this.alertedTables.clear()
  }

  /**
   * 检查单条 SQL 是否违反租户隔离.
   * @returns 违规记录; 若无违规则返回 null
   */
  check(
    sql: string,
    params?: unknown[],
    tenantId: number | null = null,
    userUuid = '',
  ): Violation | null {
    if (!sql) return null
    this.totalQueries += 1
    const table = this.extractMainTable(sql)
    if (!table) return null
    const tableLower = table.toLowerCase()
    if (this.skipTables.has(tableLower)) return null
    if (!this.tenantTables.has(tableLower)) return null
    this.auditedQueries += 1
    this.byTable.set(tableLower, (this.byTable.get(tableLower) ?? 0) + 1)
    const sLower = sql.toLowerCase().trimStart()
    if (
      !sLower.startsWith('select') &&
      !sLower.startsWith('update') &&
      !sLower.startsWith('delete') &&
      !sLower.startsWith('insert')
    ) {
      return null
    }
    if (sLower.startsWith('insert')) {
      if (!sLower.includes('tenant_id')) {
        return this.recordViolation(tableLower, sql, tenantId, userUuid, 'insert_no_tenant')
      }
      return null
    }
    if (!this.hasTenantFilter(sql, params)) {
      return this.recordViolation(tableLower, sql, tenantId, userUuid, 'missing_tenant_filter')
    }
    return null
  }

  /** 统计. */
  stats(): AuditStats {
    const byTable: Record<string, number> = {}
    for (const [k, v] of this.byTable) byTable[k] = v
    const byTableViolations: Record<string, number> = {}
    for (const [k, v] of this.byTableViolations) byTableViolations[k] = v
    return {
      totalQueries: this.totalQueries,
      auditedQueries: this.auditedQueries,
      violations: this.violationCount,
      violationRate:
        this.auditedQueries > 0
          ? Number((this.violationCount / this.auditedQueries).toFixed(4))
          : 0,
      alertThreshold: this.alertThreshold,
      byTable,
      byTableViolations,
      trackedTenantTables: this.tenantTables.size,
      skippedTables: this.skipTables.size,
    }
  }

  /** 最近违规. */
  recentViolations(limit = 50): Violation[] {
    return this.violations.slice(-limit)
  }

  /** 重置. */
  reset(): void {
    this.violations.length = 0
    this.totalQueries = 0
    this.auditedQueries = 0
    this.violationCount = 0
    this.byTable.clear()
    this.byTableViolations.clear()
    this.alertedTables.clear()
  }
}

/** 全局单例. */
export const tenantAuditor = new TenantAuditor()
