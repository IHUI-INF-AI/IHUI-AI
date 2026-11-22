// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 厂商配置管理服务（R4 重构产物）。
 *
 * 背景：原 ai-vendors.ts 的 VENDORS 常量将厂商元数据（名称/baseUrl/凭据环境变量）硬编码在路由文件中。
 * 重构后，厂商元数据迁移到 ai_vendor_configs 表，本服务负责数据库读写 + 环境变量凭据解析。
 *
 * 风格约定：遵循 commission-service.ts 风格 — 直接 export async function，不使用 class 单例。
 *
 * 回退策略（用户确认）：当数据库不可用或厂商记录缺失时，
 * 调用方应回退到 FALLBACK_VENDORS 中的环境变量配置，保证现有接口在迁移期不中断。
 */
import { dbRead } from '../db/index.js'
import { aiVendorConfigs, type AiVendorConfig } from '@ihui/database'
import { eq, asc } from 'drizzle-orm'
// 单一事实源:厂商元数据的权威清单在 V1 路由注册表 VENDORS 里,
// 本文件的 FALLBACK_VENDORS 由它动态映射生成(新增厂商零维护)。
import { VENDORS } from '../routes/ai-vendors/_shared.js'
import type { VendorCredentials } from './vendor-auth-strategies.js'

/**
 * Fallback 厂商配置的最小字段集。
 * 字段命名与 AiVendorConfig 保持一致（除 id/createdAt/updatedAt 外）。
 * 当数据库不可用或查询失败时，caller service 读取此映射作为兜底。
 */
export interface FallbackVendorConfig {
  vendorCode: string
  vendorName: string
  baseUrl: string
  authType: string
  keyEnvName?: string
  secretKeyEnvName?: string
  isEnabled: boolean
  priority: number
}

/**
 * Fallback 厂商配置。
 * 字段命名与 AiVendorConfig 保持一致，但不含 id/createdAt/updatedAt。
 * 当数据库不可用或查询失败时，caller service 读取此映射作为兜底。
 */
// 2026-09-21 改为动态映射:此前这里手写 11 家,而 V1 注册表 VENDORS 已有 113 家,
// 后果是 init-vendor-configs 只种 11 家、admin 后台只列 11 家,其余 100+ 厂商
// 不可见/不可配 key/详情 404。现以 VENDORS 为单一事实源,新增厂商零维护。
const SPECIAL_AUTH_TYPES: Record<string, string> = {
  tencent: 'tencent_tc3',
  jimeng4: 'volcengine_v4',
  volcengine: 'volcengine_v4',
}

/** 按 authHeader 形态探测鉴权类型:签名类走专用值,标准 Bearer 走 bearer,其余 custom_headers */
function detectAuthType(vendorCode: string): string {
  const special = SPECIAL_AUTH_TYPES[vendorCode]
  if (special) return special
  const cfg = VENDORS[vendorCode]
  if (!cfg) return 'bearer'
  const probe = JSON.stringify(cfg.authHeader('__probe__'))
  return probe === JSON.stringify({ Authorization: 'Bearer __probe__' })
    ? 'bearer'
    : 'custom_headers'
}

/** 早期 11 家的 priority 是已生效的排序语义,必须原样保留;新厂商按 100+ 序号补 */
const LEGACY_PRIORITIES: Record<string, number> = {
  dashscope: 1,
  doubao: 2,
  gemini: 3,
  suno: 4,
  sora2: 5,
  coze: 6,
  bailian: 7,
  jimeng4: 8,
  n8n: 9,
  tencent: 10,
  volcengine: 11,
}

export const FALLBACK_VENDORS: Record<string, FallbackVendorConfig> = Object.fromEntries(
  Object.entries(VENDORS).map(([code, cfg], idx): [string, FallbackVendorConfig] => [
    code,
    {
      vendorCode: code,
      vendorName: cfg.name,
      baseUrl: cfg.baseUrl,
      authType: detectAuthType(code),
      keyEnvName: cfg.keyEnv,
      secretKeyEnvName: cfg.secretKeyEnv,
      isEnabled: true,
      priority: LEGACY_PRIORITIES[code] ?? 100 + idx,
    },
  ]),
)

/**
 * 获取所有启用的厂商配置（按 priority 升序）。
 * 使用 dbRead 读副本（与 chat/community 等模块保持一致）。
 * 出错时返回空数组，由 caller service 走 FALLBACK_VENDORS。
 */
export async function getEnabledVendors(): Promise<AiVendorConfig[]> {
  try {
    return await dbRead
      .select()
      .from(aiVendorConfigs)
      .where(eq(aiVendorConfigs.isEnabled, true))
      .orderBy(asc(aiVendorConfigs.priority))
  } catch (_err) {
    // 数据库不可用时返回空数组，调用方应回退到 FALLBACK_VENDORS
    return []
  }
}

/**
 * 根据厂商代码获取配置。
 * 出错时返回 null，调用方应回退到 FALLBACK_VENDORS[code]。
 */
export async function getVendorByCode(code: string): Promise<AiVendorConfig | null> {
  try {
    const [vendor] = await dbRead
      .select()
      .from(aiVendorConfigs)
      .where(eq(aiVendorConfigs.vendorCode, code))
      .limit(1)
    return vendor ?? null
  } catch (_err) {
    return null
  }
}

/**
 * 解析厂商凭据（从环境变量读取，永不入库）。
 * 与原 ai-vendors.ts 的 requireVendorKeys 行为保持一致。
 */
export function getVendorCredentials(
  vendor: Pick<AiVendorConfig, 'keyEnvName' | 'secretKeyEnvName'>,
): VendorCredentials {
  const result: VendorCredentials = {}
  if (vendor.keyEnvName) {
    const key = process.env[vendor.keyEnvName]
    if (key) result.key = key
  }
  if (vendor.secretKeyEnvName) {
    const secret = process.env[vendor.secretKeyEnvName]
    if (secret) result.secret = secret
  }
  return result
}

/**
 * 解析厂商配置：优先从数据库读取，失败时回退到 FALLBACK_VENDORS。
 * 这是 caller service 的标准入口。
 */
export async function resolveVendor(
  code: string,
): Promise<(AiVendorConfig & { _source: 'db' | 'fallback' }) | null> {
  const fromDb = await getVendorByCode(code)
  if (fromDb) return { ...fromDb, _source: 'db' }
  const fromFallback = FALLBACK_VENDORS[code]
  if (fromFallback) {
    return { ...fromFallback, _source: 'fallback' } as AiVendorConfig & { _source: 'fallback' }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
