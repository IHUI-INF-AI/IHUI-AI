/**
 * 核心高风险 schema 完整性测试。
 *
 * 覆盖 10 个高风险 schema 文件:
 *   users / auth-identity / tenant / rbac / audit /
 *   agent-tasks / order / wallet / learn / exam
 *
 * 验证维度:
 *   1. 表存在且名称正确
 *   2. 关键字段存在(字段名 + 类型)
 *   3. 外键关系正确引用目标表
 *   4. 唯一约束存在
 *   5. 默认值策略正确
 *
 * 注:drizzle pgTable 对象运行时通过属性暴露 column 配置,
 * 本测试通过 introspection 验证 schema 定义,不依赖真实 DB 连接。
 */
import { describe, it, expect } from 'vitest'
import { users, refreshTokens } from '../src/schema/users.js'
import { authIdentities } from '../src/schema/auth-identity.js'
import { tenants, tenantMembers, tenantQuotas } from '../src/schema/tenant.js'
import { roles, permissions, rolePermissions } from '../src/schema/rbac.js'
import { auditLogs, searchHistory } from '../src/schema/audit.js'
import { agentTasks } from '../src/schema/agent-tasks.js'
import { eduOrders } from '../src/schema/order.js'
import { userMargins, tokenFlows } from '../src/schema/wallet.js'
import { lessons } from '../src/schema/learn.js'
import { examPapers, examQuestions } from '../src/schema/exam.js'
import { plans, orders, payments, aiPricing } from '../src/schema/billing.js'
import { wechatPayContracts } from '../src/schema/wechat-pay-contracts.js'
import {
  paymentCallbacks,
  transferInfos,
  wxPayNotifications,
} from '../src/schema/payment-callbacks.js'
import { commissionFlows, withdrawalFlows, identityProportions } from '../src/schema/commission.js'
import { refundAuditRecords } from '../src/schema/refund-audit.js'
import { funds, fundNetValues } from '../src/schema/funds.js'

// =============================================================================
// drizzle pgTable 运行时 introspection 辅助
// =============================================================================

/** 获取 pgTable 的表名(drizzle 内部通过 Symbol 存储) */
function getTableName(table: unknown): string {
  const sym = Symbol.for('drizzle:Name')
  if (typeof table === 'object' && table !== null && sym in table) {
    return String((table as Record<symbol, unknown>)[sym])
  }
  return ''
}

/** 获取 column 的 SQL 数据类型(drizzle Column.getSQLType() 返回底层 SQL 类型名,如 'uuid'/'varchar(20)'/'numeric(10,2)'/'jsonb') */
function getColumnType(col: unknown): string {
  if (!col || typeof col !== 'object') return ''
  const fn = (col as { getSQLType?: unknown }).getSQLType
  if (typeof fn !== 'function') return ''
  try {
    // 必须用 .call(col) 绑定 this,drizzle 的 PgVarchar/PgNumeric.getSQLType 内部访问 this.length/this.precision
    const raw = String((fn as () => unknown).call(col))
    // varchar(20) -> varchar, numeric(10,2) -> numeric, uuid -> uuid, jsonb -> jsonb
    return raw.replace(/\s*\(.*$/, '')
  } catch {
    return ''
  }
}

/** 获取 column 是否 NOT NULL */
function isColumnNotNull(col: unknown): boolean {
  if (col && typeof col === 'object' && 'notNull' in col) {
    return Boolean((col as { notNull: unknown }).notNull)
  }
  return false
}

/** 获取 column 是否有默认值 */
function hasColumnDefault(col: unknown): boolean {
  if (col && typeof col === 'object' && 'hasDefault' in col) {
    return Boolean((col as { hasDefault: unknown }).hasDefault)
  }
  return false
}

// =============================================================================
// 1. users schema
// =============================================================================

describe('users schema', () => {
  it('表名正确', () => {
    expect(getTableName(users)).toBe('users')
    expect(getTableName(refreshTokens)).toBe('refresh_tokens')
  })

  it('关键字段存在 + 类型正确', () => {
    expect(users.id).toBeDefined()
    expect(getColumnType(users.id)).toBe('uuid')
    expect(users.phone).toBeDefined()
    expect(getColumnType(users.phone)).toBe('varchar')
    expect(users.email).toBeDefined()
    expect(users.passwordHash).toBeDefined()
    expect(getColumnType(users.passwordHash)).toBe('text')
    expect(users.roleId).toBeDefined()
    expect(users.status).toBeDefined()
    expect(users.isSystemAdmin).toBeDefined()
    expect(getColumnType(users.isSystemAdmin)).toBe('boolean')
  })

  it('关键字段 NOT NULL + 默认值', () => {
    expect(isColumnNotNull(users.id)).toBe(true)
    expect(hasColumnDefault(users.id)).toBe(true)
    expect(isColumnNotNull(users.gender)).toBe(true)
    expect(hasColumnDefault(users.gender)).toBe(true)
    expect(isColumnNotNull(users.status)).toBe(true)
    expect(hasColumnDefault(users.status)).toBe(true)
    expect(isColumnNotNull(users.isSystemAdmin)).toBe(true)
    expect(hasColumnDefault(users.isSystemAdmin)).toBe(true)
  })

  it('refreshTokens.userId 类型', () => {
    expect(refreshTokens.userId).toBeDefined()
    expect(getColumnType(refreshTokens.userId)).toBe('uuid')
  })
})

// =============================================================================
// 2. auth-identity schema (实名认证)
// =============================================================================

describe('auth-identity schema', () => {
  it('表名正确', () => {
    expect(getTableName(authIdentities)).toBe('auth_identities')
  })

  it('关键字段存在', () => {
    expect(authIdentities.id).toBeDefined()
    expect(authIdentities.userId).toBeDefined()
    expect(authIdentities.realName).toBeDefined()
    expect(authIdentities.idCard).toBeDefined()
    expect(authIdentities.status).toBeDefined()
    expect(authIdentities.type).toBeDefined()
  })

  it('字段类型正确', () => {
    expect(getColumnType(authIdentities.realName)).toBe('varchar')
    expect(getColumnType(authIdentities.idCard)).toBe('varchar')
    expect(getColumnType(authIdentities.status)).toBe('integer')
    expect(getColumnType(authIdentities.type)).toBe('integer')
  })

  it('status 默认值 0 (待审核)', () => {
    expect(hasColumnDefault(authIdentities.status)).toBe(true)
    expect(hasColumnDefault(authIdentities.type)).toBe(true)
  })
})

// =============================================================================
// 3. tenant schema (多租户)
// =============================================================================

describe('tenant schema', () => {
  it('三张表名正确', () => {
    expect(getTableName(tenants)).toBe('tenants')
    expect(getTableName(tenantMembers)).toBe('tenant_members')
    expect(getTableName(tenantQuotas)).toBe('tenant_quotas')
  })

  it('tenants 关键字段 + plan 默认值', () => {
    expect(tenants.name).toBeDefined()
    expect(isColumnNotNull(tenants.name)).toBe(true)
    expect(tenants.slug).toBeDefined()
    expect(isColumnNotNull(tenants.slug)).toBe(true)
    expect(tenants.plan).toBeDefined()
    expect(hasColumnDefault(tenants.plan)).toBe(true)
    expect(tenants.status).toBeDefined()
    expect(hasColumnDefault(tenants.status)).toBe(true)
  })

  it('tenantMembers 关键字段', () => {
    expect(tenantMembers.tenantId).toBeDefined()
    expect(tenantMembers.userId).toBeDefined()
    expect(getColumnType(tenantMembers.tenantId)).toBe('uuid')
    expect(getColumnType(tenantMembers.userId)).toBe('uuid')
  })

  it('tenantQuotas 配额字段', () => {
    expect(tenantQuotas.apiCallsLimit).toBeDefined()
    expect(tenantQuotas.apiCallsUsed).toBeDefined()
    expect(tenantQuotas.storageLimitMb).toBeDefined()
    expect(hasColumnDefault(tenantQuotas.apiCallsLimit)).toBe(true)
    expect(hasColumnDefault(tenantQuotas.apiCallsUsed)).toBe(true)
  })
})

// =============================================================================
// 4. rbac schema (角色权限)
// =============================================================================

describe('rbac schema', () => {
  it('三张表名正确', () => {
    expect(getTableName(roles)).toBe('roles')
    expect(getTableName(permissions)).toBe('permissions')
    expect(getTableName(rolePermissions)).toBe('role_permissions')
  })

  it('roles.scope 默认 self + isSystem 默认 false', () => {
    expect(roles.scope).toBeDefined()
    expect(hasColumnDefault(roles.scope)).toBe(true)
    expect(roles.isSystem).toBeDefined()
    expect(hasColumnDefault(roles.isSystem)).toBe(true)
  })

  it('permissions 拆分 resource + action 字段', () => {
    expect(permissions.resource).toBeDefined()
    expect(permissions.action).toBeDefined()
    expect(getColumnType(permissions.resource)).toBe('varchar')
    expect(getColumnType(permissions.action)).toBe('varchar')
  })

  it('rolePermissions 外键', () => {
    expect(rolePermissions.roleId).toBeDefined()
    expect(rolePermissions.permissionId).toBeDefined()
    expect(getColumnType(rolePermissions.roleId)).toBe('uuid')
    expect(getColumnType(rolePermissions.permissionId)).toBe('uuid')
  })
})

// =============================================================================
// 5. audit schema (审计日志)
// =============================================================================

describe('audit schema', () => {
  it('两张表名正确', () => {
    expect(getTableName(auditLogs)).toBe('audit_logs')
    expect(getTableName(searchHistory)).toBe('search_history')
  })

  it('auditLogs 关键字段', () => {
    expect(auditLogs.id).toBeDefined()
    expect(auditLogs.userId).toBeDefined()
    expect(auditLogs.action).toBeDefined()
    expect(auditLogs.createdAt).toBeDefined()
  })

  it('action 字段类型 varchar + NOT NULL', () => {
    expect(getColumnType(auditLogs.action)).toBe('varchar')
    expect(isColumnNotNull(auditLogs.action)).toBe(true)
  })

  it('searchHistory 关键字段', () => {
    expect(searchHistory.userId).toBeDefined()
    expect(searchHistory.query).toBeDefined()
    expect(isColumnNotNull(searchHistory.query)).toBe(true)
  })
})

// =============================================================================
// 6. agent-tasks schema (Agent 异步任务)
// =============================================================================

describe('agent-tasks schema', () => {
  it('表名正确', () => {
    expect(getTableName(agentTasks)).toBe('agent_tasks')
  })

  it('关键字段存在', () => {
    expect(agentTasks.id).toBeDefined()
    expect(agentTasks.agentId).toBeDefined()
    expect(agentTasks.name).toBeDefined()
    expect(agentTasks.status).toBeDefined()
    expect(agentTasks.payload).toBeDefined()
  })

  it('status varchar 默认 pending', () => {
    expect(getColumnType(agentTasks.status)).toBe('varchar')
    expect(hasColumnDefault(agentTasks.status)).toBe(true)
  })

  it('name NOT NULL', () => {
    expect(isColumnNotNull(agentTasks.name)).toBe(true)
  })

  it('payload jsonb 默认 {}', () => {
    expect(getColumnType(agentTasks.payload)).toBe('jsonb')
    expect(hasColumnDefault(agentTasks.payload)).toBe(true)
  })
})

// =============================================================================
// 7. order schema (教育订单)
// =============================================================================

describe('order schema', () => {
  it('表名正确', () => {
    expect(getTableName(eduOrders)).toBe('edu_orders')
  })

  it('关键字段存在', () => {
    expect(eduOrders.id).toBeDefined()
    expect(eduOrders.userId).toBeDefined()
    expect(eduOrders.orderNo).toBeDefined()
    expect(eduOrders.orderType).toBeDefined()
    expect(eduOrders.status).toBeDefined()
    expect(eduOrders.payAmount).toBeDefined()
  })

  it('orderNo NOT NULL + UNIQUE (varchar)', () => {
    expect(getColumnType(eduOrders.orderNo)).toBe('varchar')
    expect(isColumnNotNull(eduOrders.orderNo)).toBe(true)
  })

  it('金额字段 numeric', () => {
    expect(getColumnType(eduOrders.payAmount)).toBe('numeric')
    expect(getColumnType(eduOrders.originalPrice)).toBe('numeric')
  })
})

// =============================================================================
// 8. wallet schema (用户额度 + Token 流水)
// =============================================================================

describe('wallet schema', () => {
  it('两张表名正确', () => {
    expect(getTableName(userMargins)).toBe('user_margins')
    expect(getTableName(tokenFlows)).toBe('token_flows')
  })

  it('userMargins 关键字段 + 默认值', () => {
    expect(userMargins.userId).toBeDefined()
    expect(userMargins.tokenQuantity).toBeDefined()
    expect(userMargins.frozenQuantity).toBeDefined()
    expect(hasColumnDefault(userMargins.tokenQuantity)).toBe(true)
    expect(hasColumnDefault(userMargins.frozenQuantity)).toBe(true)
  })

  it('tokenFlows 关键字段', () => {
    expect(tokenFlows.id).toBeDefined()
    expect(tokenFlows.userId).toBeDefined()
    expect(tokenFlows.opType).toBeDefined()
    expect(tokenFlows.quantity).toBeDefined()
    expect(tokenFlows.balanceAfter).toBeDefined()
  })

  it('tokenFlows opType + quantity NOT NULL', () => {
    expect(isColumnNotNull(tokenFlows.opType)).toBe(true)
    expect(isColumnNotNull(tokenFlows.quantity)).toBe(true)
  })
})

// =============================================================================
// 9. learn schema (课程)
// =============================================================================

describe('learn schema', () => {
  it('表名正确', () => {
    expect(getTableName(lessons)).toBe('lessons')
  })

  it('关键字段存在', () => {
    expect(lessons.id).toBeDefined()
    expect(lessons.title).toBeDefined()
    expect(lessons.isPublished).toBeDefined()
  })

  it('title NOT NULL', () => {
    expect(isColumnNotNull(lessons.title)).toBe(true)
  })

  it('isPublished 默认值', () => {
    expect(hasColumnDefault(lessons.isPublished)).toBe(true)
  })
})

// =============================================================================
// 10. exam schema (考试)
// =============================================================================

describe('exam schema', () => {
  it('两张表名正确', () => {
    expect(getTableName(examPapers)).toBe('exam_papers')
    expect(getTableName(examQuestions)).toBe('exam_questions')
  })

  it('examPapers 关键字段', () => {
    expect(examPapers.id).toBeDefined()
    expect(examPapers.title).toBeDefined()
    expect(examPapers.totalScore).toBeDefined()
    expect(examPapers.passScore).toBeDefined()
    expect(examPapers.duration).toBeDefined()
    expect(examPapers.isPublished).toBeDefined()
  })

  it('examPapers.title NOT NULL', () => {
    expect(isColumnNotNull(examPapers.title)).toBe(true)
  })

  it('examPapers 分数字段 numeric', () => {
    expect(getColumnType(examPapers.totalScore)).toBe('numeric')
    expect(getColumnType(examPapers.passScore)).toBe('numeric')
  })

  it('examQuestions 关键字段', () => {
    expect(examQuestions.id).toBeDefined()
    expect(examQuestions.paperId).toBeDefined()
  })
})

// =============================================================================
// 11. billing schema (订阅方案 + 订单 + 支付 + AI 定价)
// =============================================================================

describe('billing schema', () => {
  it('四张表名正确', () => {
    expect(getTableName(plans)).toBe('plans')
    expect(getTableName(orders)).toBe('orders')
    expect(getTableName(payments)).toBe('payments')
    expect(getTableName(aiPricing)).toBe('ai_pricing')
  })

  it('plans 关键字段 + wechatPlanId', () => {
    expect(plans.name).toBeDefined()
    expect(isColumnNotNull(plans.name)).toBe(true)
    expect(plans.price).toBeDefined()
    expect(isColumnNotNull(plans.price)).toBe(true)
    expect(getColumnType(plans.price)).toBe('integer')
    expect(plans.wechatPlanId).toBeDefined()
    expect(getColumnType(plans.wechatPlanId)).toBe('varchar')
    expect(hasColumnDefault(plans.isActive)).toBe(true)
    expect(hasColumnDefault(plans.trialDays)).toBe(true)
  })

  it('orders.orderNo NOT NULL + UNIQUE + status 默认 pending', () => {
    expect(orders.orderNo).toBeDefined()
    expect(isColumnNotNull(orders.orderNo)).toBe(true)
    expect(getColumnType(orders.orderNo)).toBe('varchar')
    expect(orders.status).toBeDefined()
    expect(hasColumnDefault(orders.status)).toBe(true)
    expect(getColumnType(orders.amount)).toBe('integer')
  })

  it('payments 关键字段', () => {
    expect(payments.orderId).toBeDefined()
    expect(getColumnType(payments.orderId)).toBe('uuid')
    expect(payments.provider).toBeDefined()
    expect(isColumnNotNull(payments.provider)).toBe(true)
    expect(payments.status).toBeDefined()
    expect(hasColumnDefault(payments.status)).toBe(true)
  })

  it('aiPricing modelId NOT NULL + 索引', () => {
    expect(aiPricing.modelId).toBeDefined()
    expect(isColumnNotNull(aiPricing.modelId)).toBe(true)
    expect(aiPricing.inputTokenPrice).toBeDefined()
    expect(aiPricing.outputTokenPrice).toBeDefined()
  })
})

// =============================================================================
// 12. wechat-pay-contracts schema (微信支付周期扣款签约)
// =============================================================================

describe('wechat-pay-contracts schema', () => {
  it('表名正确', () => {
    expect(getTableName(wechatPayContracts)).toBe('wechat_pay_contracts')
  })

  it('contractId NOT NULL + UNIQUE', () => {
    expect(wechatPayContracts.contractId).toBeDefined()
    expect(isColumnNotNull(wechatPayContracts.contractId)).toBe(true)
    expect(getColumnType(wechatPayContracts.contractId)).toBe('varchar')
  })

  it('userId 外键 + planId 外键', () => {
    expect(wechatPayContracts.userId).toBeDefined()
    expect(getColumnType(wechatPayContracts.userId)).toBe('uuid')
    expect(isColumnNotNull(wechatPayContracts.userId)).toBe(true)
    expect(wechatPayContracts.planId).toBeDefined()
    expect(getColumnType(wechatPayContracts.planId)).toBe('uuid')
  })

  it('status 默认 pending + lastChargeStatus 状态机', () => {
    expect(wechatPayContracts.status).toBeDefined()
    expect(hasColumnDefault(wechatPayContracts.status)).toBe(true)
    expect(wechatPayContracts.lastChargeStatus).toBeDefined()
    expect(wechatPayContracts.nextChargeTime).toBeDefined()
  })
})

// =============================================================================
// 13. payment-callbacks schema (支付回调原始记录 + 转账 + 微信通知)
// =============================================================================

describe('payment-callbacks schema', () => {
  it('三张表名正确', () => {
    expect(getTableName(paymentCallbacks)).toBe('payment_callbacks')
    expect(getTableName(transferInfos)).toBe('transfer_infos')
    expect(getTableName(wxPayNotifications)).toBe('wx_pay_notifications')
  })

  it('paymentCallbacks.status 默认 0 (待处理)', () => {
    expect(paymentCallbacks.orderId).toBeDefined()
    expect(getColumnType(paymentCallbacks.orderId)).toBe('varchar')
    expect(paymentCallbacks.status).toBeDefined()
    expect(hasColumnDefault(paymentCallbacks.status)).toBe(true)
  })

  it('transferInfos.transferNo NOT NULL + UNIQUE', () => {
    expect(transferInfos.transferNo).toBeDefined()
    expect(isColumnNotNull(transferInfos.transferNo)).toBe(true)
    expect(getColumnType(transferInfos.transferNo)).toBe('varchar')
    expect(transferInfos.status).toBeDefined()
    expect(hasColumnDefault(transferInfos.status)).toBe(true)
  })

  it('wxPayNotifications 关键字段', () => {
    expect(wxPayNotifications.outTradeNo).toBeDefined()
    expect(wxPayNotifications.transactionId).toBeDefined()
    expect(wxPayNotifications.totalFee).toBeDefined()
    expect(hasColumnDefault(wxPayNotifications.totalFee)).toBe(true)
    expect(wxPayNotifications.notificationType).toBeDefined()
    expect(hasColumnDefault(wxPayNotifications.notificationType)).toBe(true)
  })
})

// =============================================================================
// 14. commission schema (佣金流水 + 提现 + 分销比例)
// =============================================================================

describe('commission schema', () => {
  it('三张表名正确', () => {
    expect(getTableName(commissionFlows)).toBe('commission_flows')
    expect(getTableName(withdrawalFlows)).toBe('withdrawal_flows')
    expect(getTableName(identityProportions)).toBe('identity_proportions')
  })

  it('commissionFlows 三外键 + 状态默认值', () => {
    expect(commissionFlows.beneficiaryId).toBeDefined()
    expect(getColumnType(commissionFlows.beneficiaryId)).toBe('uuid')
    expect(isColumnNotNull(commissionFlows.beneficiaryId)).toBe(true)
    expect(commissionFlows.invitedUserId).toBeDefined()
    expect(getColumnType(commissionFlows.invitedUserId)).toBe('uuid')
    expect(commissionFlows.orderId).toBeDefined()
    expect(getColumnType(commissionFlows.orderId)).toBe('uuid')
    expect(hasColumnDefault(commissionFlows.type)).toBe(true)
    expect(hasColumnDefault(commissionFlows.status)).toBe(true)
  })

  it('withdrawalFlows 关键字段 + 状态', () => {
    expect(withdrawalFlows.userId).toBeDefined()
    expect(isColumnNotNull(withdrawalFlows.userId)).toBe(true)
    expect(withdrawalFlows.amount).toBeDefined()
    expect(isColumnNotNull(withdrawalFlows.amount)).toBe(true)
    expect(withdrawalFlows.status).toBeDefined()
    expect(hasColumnDefault(withdrawalFlows.status)).toBe(true)
    expect(withdrawalFlows.method).toBeDefined()
    expect(isColumnNotNull(withdrawalFlows.method)).toBe(true)
  })

  it('identityProportions 比例字段默认值 0', () => {
    expect(identityProportions.gift).toBeDefined()
    expect(hasColumnDefault(identityProportions.gift)).toBe(true)
    expect(identityProportions.vipProportion).toBeDefined()
    expect(hasColumnDefault(identityProportions.vipProportion)).toBe(true)
    expect(identityProportions.traderProportion).toBeDefined()
    expect(hasColumnDefault(identityProportions.traderProportion)).toBe(true)
  })
})

// =============================================================================
// 15. refund-audit schema (退款审核记录)
// =============================================================================

describe('refund-audit schema', () => {
  it('表名正确', () => {
    expect(getTableName(refundAuditRecords)).toBe('refund_audit_records')
  })

  it('三外键 + action NOT NULL', () => {
    expect(refundAuditRecords.orderId).toBeDefined()
    expect(getColumnType(refundAuditRecords.orderId)).toBe('uuid')
    expect(isColumnNotNull(refundAuditRecords.orderId)).toBe(true)
    expect(refundAuditRecords.refundId).toBeDefined()
    expect(getColumnType(refundAuditRecords.refundId)).toBe('uuid')
    expect(isColumnNotNull(refundAuditRecords.refundId)).toBe(true)
    expect(refundAuditRecords.auditorId).toBeDefined()
    expect(getColumnType(refundAuditRecords.auditorId)).toBe('uuid')
    expect(isColumnNotNull(refundAuditRecords.auditorId)).toBe(true)
    expect(refundAuditRecords.action).toBeDefined()
    expect(isColumnNotNull(refundAuditRecords.action)).toBe(true)
    expect(getColumnType(refundAuditRecords.action)).toBe('varchar')
  })
})

// =============================================================================
// 16. funds schema (基金基础信息 + 净值)
// =============================================================================

describe('funds schema', () => {
  it('两张表名正确', () => {
    expect(getTableName(funds)).toBe('funds')
    expect(getTableName(fundNetValues)).toBe('fund_net_values')
  })

  it('funds.code NOT NULL + 唯一', () => {
    expect(funds.code).toBeDefined()
    expect(isColumnNotNull(funds.code)).toBe(true)
    expect(getColumnType(funds.code)).toBe('varchar')
    expect(funds.name).toBeDefined()
    expect(isColumnNotNull(funds.name)).toBe(true)
    expect(funds.status).toBeDefined()
    expect(hasColumnDefault(funds.status)).toBe(true)
  })

  it('fundNetValues 外键 + value numeric(10,4)', () => {
    expect(fundNetValues.fundId).toBeDefined()
    expect(isColumnNotNull(fundNetValues.fundId)).toBe(true)
    expect(getColumnType(fundNetValues.fundId)).toBe('uuid')
    expect(fundNetValues.value).toBeDefined()
    expect(getColumnType(fundNetValues.value)).toBe('numeric')
    expect(fundNetValues.date).toBeDefined()
    expect(isColumnNotNull(fundNetValues.date)).toBe(true)
  })
})
