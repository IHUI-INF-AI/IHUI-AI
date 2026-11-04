// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型能力画像来源(可配置)—— 内置默认表 + `IHUI_MODEL_CAPABILITY_PROFILES` 环境变量覆盖。
 *
 * 为什么把"来源"与"判定"拆开:判定(选档)是纯函数放在 @ihui/types,来源随部署环境变化,
 * 不能把厂商模型名/上下文档写死在契约包里。环境变量是 JSON 数组,按 `modelId` 覆盖内置项;
 * 非法条目**逐条记录错误**而不是静默丢弃(否则会表现为"模型画像莫名不存在").
 */
import type { ModelCapabilityProfile } from '@ihui/types'

/** 覆盖入口:JSON 数组,元素形状与 ModelCapabilityProfile 一致。 */
export const MODEL_PROFILES_ENV = 'IHUI_MODEL_CAPABILITY_PROFILES'

/**
 * 内置画像(仅覆盖本仓已知模型;未知模型必须由调用方显式提供画像,
 * 不做"猜一个默认能力"的兜底 —— 猜错会静默降级/误放行)。
 */
export const BUILTIN_MODEL_PROFILES: readonly ModelCapabilityProfile[] = [
  {
    modelId: 'deepseek-v4.1-flash',
    contextWindow: 128_000,
    toolCalling: true,
    vision: false,
    structuredOutput: true,
    maxParallel: 8,
  },
  {
    modelId: 'deepseek-chat',
    contextWindow: 64_000,
    toolCalling: true,
    vision: false,
    structuredOutput: false,
    maxParallel: 4,
  },
  {
    modelId: 'gpt-4o',
    contextWindow: 128_000,
    toolCalling: true,
    vision: true,
    structuredOutput: true,
    maxParallel: 8,
  },
  {
    modelId: 'qwen3-coder',
    contextWindow: 32_000,
    toolCalling: true,
    vision: false,
    structuredOutput: false,
    maxParallel: 2,
  },
]

export interface ModelProfileLoadResult {
  profiles: Map<string, ModelCapabilityProfile>
  /** 配置侧错误(逐条点名,不吞掉) */
  errors: string[]
}

function parseProfile(modelId: string, raw: unknown): ModelCapabilityProfile | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return `模型 "${modelId}" 的画像必须是对象`
  }
  const value = raw as Record<string, unknown>
  if (typeof value.contextWindow !== 'number' || !Number.isFinite(value.contextWindow) || value.contextWindow <= 0) {
    return `模型 "${modelId}" 的 contextWindow 必须是正数`
  }
  if (typeof value.maxParallel !== 'number' || !Number.isInteger(value.maxParallel) || value.maxParallel <= 0) {
    return `模型 "${modelId}" 的 maxParallel 必须是正整数`
  }
  for (const key of ['toolCalling', 'vision', 'structuredOutput'] as const) {
    if (typeof value[key] !== 'boolean') {
      return `模型 "${modelId}" 的 ${key} 必须是布尔值`
    }
  }
  return {
    modelId,
    contextWindow: value.contextWindow,
    toolCalling: value.toolCalling as boolean,
    vision: value.vision as boolean,
    structuredOutput: value.structuredOutput as boolean,
    maxParallel: value.maxParallel,
  }
}

/**
 * 加载画像表:内置表打底,环境变量按 modelId 覆盖。
 * 环境变量非法(不是 JSON / 不是数组 / 条目字段错) → 记入 errors,其余项照常生效。
 */
export function loadModelProfiles(env: NodeJS.ProcessEnv = process.env): ModelProfileLoadResult {
  const profiles = new Map<string, ModelCapabilityProfile>()
  for (const profile of BUILTIN_MODEL_PROFILES) profiles.set(profile.modelId, profile)

  const raw = env[MODEL_PROFILES_ENV]
  if (!raw || raw.trim() === '') return { profiles, errors: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { profiles, errors: [`${MODEL_PROFILES_ENV} 不是合法 JSON`] }
  }
  if (!Array.isArray(parsed)) {
    return { profiles, errors: [`${MODEL_PROFILES_ENV} 必须是数组`] }
  }

  const errors: string[] = []
  parsed.forEach((item, index) => {
    const modelId =
      typeof item === 'object' && item !== null && !Array.isArray(item)
        ? (item as Record<string, unknown>).modelId
        : undefined
    if (typeof modelId !== 'string' || modelId.trim() === '') {
      errors.push(`${MODEL_PROFILES_ENV}[${index}] 缺少字符串 modelId`)
      return
    }
    const result = parseProfile(modelId.trim(), item)
    if (typeof result === 'string') {
      errors.push(result)
      return
    }
    profiles.set(result.modelId, result)
  })
  return { profiles, errors }
}

/** 按 modelId 解析画像;未配置时返回 undefined + 已配置侧错误(由调用方决定如何上报)。 */
export function resolveModelProfile(
  modelId: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { profile?: ModelCapabilityProfile; errors: string[] } {
  const { profiles, errors } = loadModelProfiles(env)
  if (!modelId || modelId.trim() === '') return { errors }
  const profile = profiles.get(modelId.trim())
  return profile ? { profile, errors } : { errors }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
