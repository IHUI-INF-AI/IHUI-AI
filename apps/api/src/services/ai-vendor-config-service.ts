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
export const FALLBACK_VENDORS: Record<string, FallbackVendorConfig> = {
  dashscope: {
    vendorCode: 'dashscope',
    vendorName: 'Dashscope(阿里通义)',
    baseUrl: 'https://dashscope.aliyuncs.com',
    authType: 'bearer',
    keyEnvName: 'DASHSCOPE_API_KEY',
    isEnabled: true,
    priority: 1,
  },
  doubao: {
    vendorCode: 'doubao',
    vendorName: 'Doubao(豆包/字节)',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    authType: 'bearer',
    keyEnvName: 'DOUBAO_API_KEY',
    isEnabled: true,
    priority: 2,
  },
  gemini: {
    vendorCode: 'gemini',
    vendorName: 'Gemini(Google)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'bearer',
    keyEnvName: 'GEMINI_API_KEY',
    isEnabled: true,
    priority: 3,
  },
  suno: {
    vendorCode: 'suno',
    vendorName: 'Suno(音乐生成)',
    baseUrl: 'https://api.suno.ai',
    authType: 'bearer',
    keyEnvName: 'SUNO_API_KEY',
    isEnabled: true,
    priority: 4,
  },
  sora2: {
    vendorCode: 'sora2',
    vendorName: 'Sora2(OpenAI 视频)',
    baseUrl: 'https://api.openai.com',
    authType: 'bearer',
    keyEnvName: 'SORA2_API_KEY',
    isEnabled: true,
    priority: 5,
  },
  coze: {
    vendorCode: 'coze',
    vendorName: 'Coze(扣子)',
    baseUrl: 'https://api.coze.cn',
    authType: 'bearer',
    keyEnvName: 'COZE_API_KEY',
    isEnabled: true,
    priority: 6,
  },
  bailian: {
    vendorCode: 'bailian',
    vendorName: 'Bailian(百炼/阿里云)',
    baseUrl: 'https://dashscope.aliyuncs.com',
    authType: 'bearer',
    keyEnvName: 'BAILIAN_API_KEY',
    isEnabled: true,
    priority: 7,
  },
  jimeng4: {
    vendorCode: 'jimeng4',
    vendorName: 'JiMeng4(即梦/字节AI绘画)',
    baseUrl: 'https://visual.volcengineapi.com',
    authType: 'volcengine_v4',
    keyEnvName: 'JIMENG4_API_KEY',
    secretKeyEnvName: 'JIMENG4_SECRET_KEY',
    isEnabled: true,
    priority: 8,
  },
  n8n: {
    vendorCode: 'n8n',
    vendorName: 'N8N(工作流平台)',
    baseUrl: '',
    authType: 'bearer',
    keyEnvName: 'N8N_API_KEY',
    isEnabled: true,
    priority: 9,
  },
  tencent: {
    vendorCode: 'tencent',
    vendorName: 'Tencent(腾讯混元/ARC)',
    baseUrl: 'https://ai3d.tencentcloudapi.com',
    authType: 'tencent_tc3',
    keyEnvName: 'TENCENT_SECRET_ID',
    secretKeyEnvName: 'TENCENT_SECRET_KEY',
    isEnabled: true,
    priority: 10,
  },
  volcengine: {
    vendorCode: 'volcengine',
    vendorName: 'Volcengine(火山引擎/字节豆包企业版)',
    baseUrl: 'https://visual.volcengineapi.com',
    authType: 'volcengine_v4',
    keyEnvName: 'VOLCENGINE_API_KEY',
    secretKeyEnvName: 'VOLCENGINE_SECRET_KEY',
    isEnabled: true,
    priority: 11,
  },
}

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
