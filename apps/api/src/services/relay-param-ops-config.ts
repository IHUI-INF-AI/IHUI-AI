/**
 * 参数覆盖系统配置存储层(2026-08-01 立,P0-20b)。
 *
 * 职责:
 * 1. CRUD 规则(存 system_configs 表,category='relay_param_ops',key=规则 id)
 * 2. getMatchingParamOps: 转发层查询匹配规则(按 priority 降序,global < model < channelId)
 * 3. applyParamOpsToBody: 一键集成入口(查询规则 + 收集 ops + 应用 applyParamOps)
 *
 * 复用:
 * - relay-param-ops.ts 的 ParamOp / OpContext / applyParamOps 纯函数
 * - system_configs 表(参考 topup-discount-service.ts 模式)
 *
 * 调用方:
 * - admin/relay-param-ops.ts 路由(CRUD + dry-run)
 * - v1-public.ts / v1-messages.ts / v1-responses.ts 转发点(applyParamOpsToBody)
 */
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db, dbRead } from '../db/index.js'
import { systemConfigs } from '@ihui/database'
import { logger } from '../utils/logger.js'
import {
  applyParamOps,
  validateParamOps,
  type ParamOp,
  type OpContext,
  type ApplyResult,
} from './relay-param-ops.js'

// =============================================================================
// 类型定义
// =============================================================================

/** 规则匹配条件。 */
export interface ParamOpMatchConditions {
  /** 精确匹配 model id(留空表示不限定)。 */
  model?: string
  /** 精确匹配渠道 id(留空表示不限定)。 */
  channelId?: string
  /** 全局规则(匹配所有请求)。global=true 时忽略 model/channelId。 */
  global?: boolean
}

/** 单条参数覆盖规则。 */
export interface ParamOpRule {
  /** 规则 id(randomUUID,作为 system_configs.key)。 */
  id: string
  /** 规则名称(人类可读)。 */
  name: string
  /** 是否启用(禁用的规则不参与匹配)。 */
  enabled: boolean
  /** 优先级(数字越大优先级越高,同优先级按 createdAt 升序)。 */
  priority: number
  /** 匹配条件。 */
  matchConditions: ParamOpMatchConditions
  /** 参数操作列表(复用 relay-param-ops.ts 的 ParamOp)。 */
  ops: ParamOp[]
  /** 创建时间(ISO 字符串)。 */
  createdAt?: string
  /** 更新时间(ISO 字符串)。 */
  updatedAt?: string
}

/** dry-run 预览结果。 */
export interface DryRunResult {
  originalBody: Record<string, unknown>
  modifiedBody: Record<string, unknown>
  appliedRules: Array<{ id: string; name: string; priority: number }>
  modified: boolean
}

// =============================================================================
// 常量
// =============================================================================

/** system_configs 表中参数覆盖规则的 category。 */
const PARAM_OPS_CATEGORY = 'relay_param_ops'

/** 规则 key 前缀(避免与其他 category 的 key 冲突)。 */
const PARAM_OPS_KEY_PREFIX = 'relay_param_ops:'

// =============================================================================
// 类型守卫与解析
// =============================================================================

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v !== ''
}

/** 把 systemConfigs 行的 value(JSON 字符串)解析为 ParamOpRule,失败返回 null。 */
function parseRule(raw: string, id: string, createdAt?: Date, updatedAt?: Date): ParamOpRule | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(parsed)) return null

  const { name, enabled, priority, matchConditions, ops } = parsed
  if (!isNonEmptyString(name)) return null
  if (typeof enabled !== 'boolean') return null
  if (!isFiniteNumber(priority)) return null

  const mc = isObject(matchConditions) ? matchConditions : {}
  const conditions: ParamOpMatchConditions = {}
  if (typeof mc.global === 'boolean') conditions.global = mc.global
  if (isNonEmptyString(mc.model)) conditions.model = mc.model
  if (isNonEmptyString(mc.channelId)) conditions.channelId = mc.channelId

  const opsList = Array.isArray(ops) ? (ops as ParamOp[]) : []

  return {
    id,
    name,
    enabled,
    priority,
    matchConditions: conditions,
    ops: opsList,
    createdAt: createdAt?.toISOString(),
    updatedAt: updatedAt?.toISOString(),
  }
}

// =============================================================================
// CRUD
// =============================================================================

/**
 * 列出所有参数覆盖规则(按 priority 降序 + createdAt 升序)。
 * 同时返回 enabled / disabled 规则(admin UI 需要展示全部)。
 */
export async function listParamOpRules(): Promise<ParamOpRule[]> {
  const rows = await dbRead
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.category, PARAM_OPS_CATEGORY))
    .orderBy(systemConfigs.createdAt)

  const rules: ParamOpRule[] = []
  for (const row of rows) {
    const rule = parseRule(row.value, row.key, row.createdAt ?? undefined, row.updatedAt ?? undefined)
    if (rule) rules.push(rule)
  }
  // priority 降序(高优先级在前),同优先级按 createdAt 升序(早创建在前)
  rules.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
  return rules
}

/** 查询单条规则,不存在返回 null。 */
export async function getParamOpRule(id: string): Promise<ParamOpRule | null> {
  if (!isNonEmptyString(id)) return null
  const [row] = await dbRead
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.key, id))
    .limit(1)
  if (!row) return null
  return parseRule(row.value, row.key, row.createdAt ?? undefined, row.updatedAt ?? undefined)
}

/**
 * 创建规则。
 * @returns 创建后的规则(含生成的 id + 时间戳)
 */
export async function createParamOpRule(
  input: Omit<ParamOpRule, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ParamOpRule> {
  const id = `${PARAM_OPS_KEY_PREFIX}${randomUUID()}`
  const now = new Date()
  const rule: ParamOpRule = {
    id,
    name: input.name,
    enabled: input.enabled,
    priority: input.priority,
    matchConditions: input.matchConditions,
    ops: input.ops,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  await db.insert(systemConfigs).values({
    key: id,
    value: JSON.stringify(rule),
    type: 'json',
    category: PARAM_OPS_CATEGORY,
    description: `参数覆盖规则:${rule.name}`,
    isPublic: false,
    updatedBy: null,
  })
  return rule
}

/**
 * 更新规则(upsert by key)。
 * @returns 更新后的规则,不存在时返回 null(由调用方决定 404)
 */
export async function updateParamOpRule(
  id: string,
  patch: Partial<Omit<ParamOpRule, 'id' | 'createdAt'>>,
): Promise<ParamOpRule | null> {
  const existing = await getParamOpRule(id)
  if (!existing) return null
  const now = new Date()
  const merged: ParamOpRule = {
    id: existing.id,
    name: patch.name ?? existing.name,
    enabled: patch.enabled ?? existing.enabled,
    priority: patch.priority ?? existing.priority,
    matchConditions: patch.matchConditions ?? existing.matchConditions,
    ops: patch.ops ?? existing.ops,
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  }
  await db
    .update(systemConfigs)
    .set({ value: JSON.stringify(merged), updatedAt: now })
    .where(eq(systemConfigs.key, id))
  return merged
}

/** 删除规则,不存在返回 false。 */
export async function deleteParamOpRule(id: string): Promise<boolean> {
  const existing = await getParamOpRule(id)
  if (!existing) return false
  await db.delete(systemConfigs).where(eq(systemConfigs.key, id))
  return true
}

// =============================================================================
// 转发层匹配 + 应用
// =============================================================================

/**
 * 查询匹配当前请求的规则(按 priority 降序)。
 *
 * 匹配逻辑(优先级:channelId > model > global):
 * 1. global=true 规则总是匹配
 * 2. model 精确匹配
 * 3. channelId 精确匹配
 * 4. disabled 规则不参与匹配
 *
 * @param model 当前请求 model id
 * @param channelId 当前请求渠道 id(可选)
 */
export async function getMatchingParamOps(
  model: string,
  channelId?: string,
): Promise<ParamOpRule[]> {
  const all = await listParamOpRules()
  return all.filter((rule) => {
    if (!rule.enabled) return false
    const mc = rule.matchConditions
    if (mc.global === true) return true
    if (mc.model && mc.model !== model) return false
    if (mc.channelId && (channelId === undefined || mc.channelId !== channelId)) return false
    // 至少匹配一个条件(model 或 channelId);两个都未配置视为不匹配(避免误伤)
    if (!mc.model && !mc.channelId) return false
    return true
  })
}

/**
 * 转发层一键集成入口:查询匹配规则 + 收集 ops + 应用 applyParamOps。
 *
 * 失败时回退到原 body(不阻塞主流程),warn 日志。
 *
 * @param body 原始请求体(不会被修改,applyParamOps 内部深拷贝)
 * @param context 内置变量上下文(至少传 model)
 * @param channelId 渠道 id(可选,参与匹配)
 * @returns 修改后的 body(若无规则匹配或失败,返回原 body 引用)
 */
export async function applyParamOpsToBody(
  body: Record<string, unknown>,
  context: OpContext,
  channelId?: string,
): Promise<{ body: Record<string, unknown>; appliedRules: ParamOpRule[]; modified: boolean }> {
  try {
    const rules = await getMatchingParamOps(context.model ?? '', channelId)
    if (rules.length === 0) {
      return { body, appliedRules: [], modified: false }
    }
    const ops: ParamOp[] = rules.flatMap((r) => r.ops)
    if (ops.length === 0) {
      return { body, appliedRules: rules, modified: false }
    }
    const result: ApplyResult = applyParamOps(body, ops, context)
    return {
      body: result.request,
      appliedRules: rules,
      modified: result.modified,
    }
  } catch (e) {
    logger.warn('relay-param-ops-config: applyParamOpsToBody failed, fallback to original body', {
      model: context.model,
      channelId,
      error: e instanceof Error ? e.message : String(e),
    })
    return { body, appliedRules: [], modified: false }
  }
}

// =============================================================================
// dry-run 预览
// =============================================================================

/**
 * 预览规则应用效果(不修改 DB,不影响真实请求)。
 *
 * @param ruleId 规则 id
 * @param sampleBody 样例请求体
 * @param context 内置变量上下文(默认用 sampleBody.model)
 */
export async function dryRunParamOpRule(
  ruleId: string,
  sampleBody: Record<string, unknown>,
  context?: OpContext,
): Promise<DryRunResult | null> {
  const rule = await getParamOpRule(ruleId)
  if (!rule) return null

  const ctx: OpContext = context ?? {
    model: typeof sampleBody.model === 'string' ? sampleBody.model : undefined,
  }
  const result = applyParamOps(sampleBody, rule.ops, ctx)
  return {
    originalBody: sampleBody,
    modifiedBody: result.request,
    appliedRules: [{ id: rule.id, name: rule.name, priority: rule.priority }],
    modified: result.modified,
  }
}

// =============================================================================
// 校验(暴露给路由层)
// =============================================================================

/** 透传 relay-param-ops.ts 的校验函数,避免路由层重复 import。 */
export function validateRuleOps(ops: unknown): { valid: boolean; errors: string[] } {
  return validateParamOps(ops)
}
