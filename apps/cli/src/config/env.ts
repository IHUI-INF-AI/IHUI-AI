/**
 * 环境变量层解析 — IHUI_ 前缀,大小写不敏感,_ 分隔嵌套。
 *
 * 映射规则:
 *   - IHUI_API_URL → apiUrl
 *   - IHUI_API_KEY → apiKey
 *   - IHUI_DEFAULT_MODEL → defaultModel
 *   - IHUI_MAX_ITERATIONS → maxIterations(数字)
 *   - IHUI_AUDIT_ENABLED → auditEnabled(布尔)
 *   - IHUI_LOCALE → locale
 *   - IHUI_PERMISSION_MODE → permissionMode
 *   - IHUI_ALLOW_DANGEROUS → allowDangerous(布尔)
 *   - IHUI_PLAN_FIRST → planFirst(布尔)
 *   - IHUI_ENABLE_MCP → enableMcp(布尔)
 *   - IHUI_SAMPLER_TEMPERATURE → sampler.temperature(数字)
 *   - IHUI_SAMPLER_MAX_TOKENS → sampler.maxTokens(数字)
 *   - IHUI_SANDBOX_PROFILE → sandbox.profile
 *   - IHUI_COMPACTION_V2_ENABLED → compactionV2.enabled(布尔)
 *   - 未知 IHUI_ 前缀变量:忽略,不报错
 */

import type { Settings } from '../commands/settings.js'
import { setNestedPath } from './cli.js'

/** 环境变量名 → { 配置路径, 值类型 } */
const ENV_MAPPING: Record<string, { path: string; type: 'string' | 'number' | 'boolean' }> = {
  IHUI_API_URL: { path: 'apiUrl', type: 'string' },
  IHUI_API_KEY: { path: 'apiKey', type: 'string' },
  IHUI_DEFAULT_MODEL: { path: 'defaultModel', type: 'string' },
  IHUI_MAX_ITERATIONS: { path: 'maxIterations', type: 'number' },
  IHUI_AUDIT_ENABLED: { path: 'auditEnabled', type: 'boolean' },
  IHUI_LOCALE: { path: 'locale', type: 'string' },
  IHUI_PERMISSION_MODE: { path: 'permissionMode', type: 'string' },
  IHUI_ALLOW_DANGEROUS: { path: 'allowDangerous', type: 'boolean' },
  IHUI_PLAN_FIRST: { path: 'planFirst', type: 'boolean' },
  IHUI_ENABLE_MCP: { path: 'enableMcp', type: 'boolean' },
  IHUI_SAMPLER_TEMPERATURE: { path: 'sampler.temperature', type: 'number' },
  IHUI_SAMPLER_MAX_TOKENS: { path: 'sampler.maxTokens', type: 'number' },
  IHUI_SANDBOX_PROFILE: { path: 'sandbox.profile', type: 'string' },
  IHUI_COMPACTION_V2_ENABLED: { path: 'compactionV2.enabled', type: 'boolean' },
}

/** 布尔真值集合(小写) */
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled'])
/** 布尔假值集合(小写) */
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled'])

/**
 * 大小写不敏感地读取环境变量。
 * 优先精确匹配,其次遍历 key 做小写比对。
 */
function getEnvCI(env: NodeJS.ProcessEnv, name: string): string | undefined {
  // 精确匹配优先
  const direct = env[name]
  if (direct !== undefined) return direct
  // 大小写不敏感扫描
  const lower = name.toLowerCase()
  for (const k of Object.keys(env)) {
    if (k.toLowerCase() === lower) return env[k]
  }
  return undefined
}

/**
 * 读取布尔型环境变量。
 * - 1/true/yes/on/enabled → true(值大小写不敏感)
 * - 0/false/no/off/disabled → false
 * - 未定义或其他值 → undefined
 */
export function envBool(name: string, env: NodeJS.ProcessEnv = process.env): boolean | undefined {
  const raw = getEnvCI(env, name)
  if (raw === undefined) return undefined
  const v = raw.toLowerCase().trim()
  if (TRUE_VALUES.has(v)) return true
  if (FALSE_VALUES.has(v)) return false
  return undefined
}

/**
 * 解析所有 IHUI_ 前缀环境变量为 Partial<Settings>。
 * - 大小写不敏感匹配变量名
 * - 空字符串视为未设置
 * - 数字/布尔转换失败时跳过该键
 * - 未知 IHUI_ 前缀变量忽略,不报错
 */
export function parseEnvOverrides(env: NodeJS.ProcessEnv = process.env): Partial<Settings> {
  const result: Record<string, unknown> = {}
  for (const [envKey, spec] of Object.entries(ENV_MAPPING)) {
    const raw = getEnvCI(env, envKey)
    if (raw === undefined || raw === '') continue
    let value: unknown
    if (spec.type === 'string') {
      value = raw
    } else if (spec.type === 'number') {
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      value = n
    } else {
      // boolean
      const v = raw.toLowerCase().trim()
      if (TRUE_VALUES.has(v)) {
        value = true
      } else if (FALSE_VALUES.has(v)) {
        value = false
      } else {
        continue
      }
    }
    setNestedPath(result, spec.path, value)
  }
  return result as unknown as Partial<Settings>
}
