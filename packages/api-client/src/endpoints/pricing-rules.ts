// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/**
 * G4 组合定价规则端点封装(2026-10-30 立,对应 api 侧 /api/pricing-rules 与
 * /api/admin/pricing-rules CRUD,命名/返回形态对齐 devices.ts 风格)。
 *
 * 后端契约(apps/api/src/routes/pricing-rules.ts):
 * - GET /api/pricing-rules:需登录,返回当前生效规则(附错峰窗口人话说明 timeOfDayDescriptions);
 * - GET /api/admin/pricing-rules:管理员,全量列表(含停用);
 * - POST /api/admin/pricing-rules:管理员,新建(version=1),rule_key 重复 409;
 * - PUT /api/admin/pricing-rules/:id:管理员,局部更新,version 自动 +1,不存在 404;
 * - DELETE /api/admin/pricing-rules/:id:管理员,软下线(enabled=false, version+1)。
 */

// =============================================================================
// Types(与 apps/api drizzle camelCase 行形状对齐)
// =============================================================================

/** 计费模式(对齐 ai_pricing.billing_mode 四档) */
export type PricingRuleMode = 'token' | 'per_call' | 'per_image' | 'per_video'

/** 错峰窗口配置:系数 + 可选 IANA 时区(缺省 Asia/Shanghai) */
export interface TimeOfDayWindowSpec {
  factor: number
  tz?: string
}

/** pricing_rules 行(服务端 drizzle camelCase) */
export interface PricingRuleRow {
  id: string
  ruleKey: string
  displayName: string
  currency: string
  mode: PricingRuleMode
  /** 基础单价(分,6 位小数;单位语义随 mode) */
  basePrice: number
  /** 档位系数表,如 { member: 1, vip: 0.8, svip: 0.6 };未知档位按 1.0 */
  tierMultipliers: Record<string, number>
  /** 错峰时段表,键为 "HH:mm-HH:mm";null = 不启用错峰 */
  timeOfDayFactor: Record<string, TimeOfDayWindowSpec> | null
  enabled: boolean
  version: number
  effectiveFrom: string
  effectiveTo: string | null
  createdAt?: string
  updatedAt?: string
}

/** 用户面视图:附错峰窗口人话说明,不含审计列 */
export interface PricingRuleUserView extends Omit<PricingRuleRow, 'enabled' | 'createdAt' | 'updatedAt'> {
  timeOfDayDescriptions: string[]
}

/** 新建规则入参(对齐服务端 createRuleSchema) */
export interface CreatePricingRuleInput {
  ruleKey: string
  displayName: string
  currency?: string
  mode: PricingRuleMode
  basePrice: number
  tierMultipliers?: Record<string, number>
  timeOfDayFactor?: Record<string, TimeOfDayWindowSpec> | null
  enabled?: boolean
  effectiveFrom?: string
  effectiveTo?: string | null
}

/** 更新规则入参(局部更新;ruleKey 不可改,改键请新建 + 下线旧规则) */
export type UpdatePricingRuleInput = Partial<CreatePricingRuleInput>

// =============================================================================
// 用户面
// =============================================================================

/** 当前生效的定价规则列表(价格公示页数据源;需登录) */
export async function listPricingRules(): Promise<ApiResult<PricingRuleUserView[]>> {
  return fetchApi<PricingRuleUserView[]>('/api/pricing-rules', { method: 'GET' })
}

// =============================================================================
// 管理面(管理员 JWT)
// =============================================================================

/** 全量定价规则列表(含停用,管理页数据源) */
export async function adminListPricingRules(): Promise<ApiResult<PricingRuleRow[]>> {
  return fetchApi<PricingRuleRow[]>('/api/admin/pricing-rules', { method: 'GET' })
}

/** 新建定价规则(version 从 1 起;rule_key 重复 409) */
export async function adminCreatePricingRule(
  payload: CreatePricingRuleInput,
): Promise<ApiResult<PricingRuleRow>> {
  return fetchApi<PricingRuleRow>('/api/admin/pricing-rules', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 更新定价规则(局部更新,服务端 version 自动 +1;不存在 404) */
export async function adminUpdatePricingRule(
  id: string,
  payload: UpdatePricingRuleInput,
): Promise<ApiResult<PricingRuleRow>> {
  return fetchApi<PricingRuleRow>(
    `/api/admin/pricing-rules/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
}

/** 下线定价规则(软下线,结算历史 ruleId 仍可回查) */
export async function adminDeletePricingRule(
  id: string,
): Promise<ApiResult<{ id: string; disabled: boolean; version: number }>> {
  return fetchApi<{ id: string; disabled: boolean; version: number }>(
    `/api/admin/pricing-rules/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
