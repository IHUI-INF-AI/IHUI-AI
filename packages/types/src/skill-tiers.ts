// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能按模型能力分档(声明式) —— 模型能力画像 + 技能档位声明 + 运行期选档。
 *
 * 为什么选 `tiers`(full/reduced)而不是 `minCapabilities`:
 * 1) reduced 档可以**显式列出降级后失去的功能**(`disabledFeatures`),调用方能把
 *    「用了降级档」如实告知模型/用户;`minCapabilities` 只有一条门槛,降级后失去了
 *    什么只能靠猜 —— 与本仓「不许静默失败」的口径冲突。
 * 2) 两档各有独立 `requires`,同一技能可以「full 要视觉 + 32k 上下文,reduced 只要 16k
 *    上下文」,而不是把 full 的硬门槛当成 reduced 的门槛。
 * 3) `hard` 是**绝对下限**(与档位无关):未满足时直接拒绝并给出原因,不允许降到任何档。
 *
 * 选档是纯函数,结果自带 `tier` 与 `reason`,调用方(技能执行入口 / 目录查询)只需上报,
 * 不得自行吞掉拒绝原因。
 */

/**
 * 模型**能力**档(注意与 model-catalog.ts 的 `ModelTier` 代次档 latest/standard/legacy 不同,
 * 故意换名避免两套语义共用同一标识)。
 */
export const MODEL_CAPABILITY_TIERS = ['basic', 'standard', 'advanced'] as const
export type ModelCapabilityTier = (typeof MODEL_CAPABILITY_TIERS)[number]

/**
 * 模型能力画像。来源可配置(CLI 侧由内置表 + 环境变量覆盖,见 apps/cli/src/skills/model-capabilities.ts),
 * 本模块只定义形状与判定,不绑定具体厂商。
 */
export interface ModelCapabilityProfile {
  modelId: string
  /** 上下文窗口(token 数) */
  contextWindow: number
  toolCalling: boolean
  vision: boolean
  structuredOutput: boolean
  /** 可并行的最大工具/子任务数 */
  maxParallel: number
}

/**
 * 能力要求。布尔项只在显式写 `true` 时构成要求;
 * `min*` 项按数值下限判定。
 */
export interface ModelCapabilityRequirement {
  toolCalling?: boolean
  vision?: boolean
  structuredOutput?: boolean
  minContextWindow?: number
  minMaxParallel?: number
  /** 最低模型档(由 {@link modelTierOf} 从画像推导,不单独配置) */
  minModelTier?: ModelCapabilityTier
}

/** 单个档位的声明。 */
export interface SkillTierSpec {
  requires?: ModelCapabilityRequirement
  /** 该档位下被禁用/降级的功能名(用于如实告知,不得静默) */
  disabledFeatures?: string[]
}

/** 技能在 frontmatter/契约里声明的分档能力。 */
export interface SkillCapabilityTiers {
  /** 绝对下限:未满足直接拒绝,不降档 */
  hard?: ModelCapabilityRequirement
  full: SkillTierSpec
  reduced?: SkillTierSpec
}

/** 选档成功读数 —— `tier` 与 `reason` 必须原样上报(可观测性要求)。 */
export interface SkillTierSelection {
  ok: true
  skillName: string
  modelId: string
  tier: 'full' | 'reduced'
  reason: string
  /** full 档未满足的能力项(降级时非空) */
  missingForFull: string[]
  /** 该档位被禁用的功能 */
  degradedFeatures: string[]
}

/** 选档拒绝读数 —— 带稳定 code 与逐项缺失原因,禁止静默失败。 */
export interface SkillTierRejection {
  ok: false
  skillName: string
  modelId: string
  code: 'skill_capability_rejected' | 'skill_tier_unsatisfied'
  reason: string
  missing: string[]
}

export type SkillTierResult = SkillTierSelection | SkillTierRejection

/**
 * 从画像推导模型档。判据只有这一处,调用方不得各自再算:
 * - advanced:toolCalling + vision + structuredOutput,且上下文 ≥ 128k;
 * - standard:toolCalling,且上下文 ≥ 32k;
 * - basic:其余。
 */
export function modelTierOf(profile: ModelCapabilityProfile): ModelCapabilityTier {
  if (
    profile.toolCalling &&
    profile.vision &&
    profile.structuredOutput &&
    profile.contextWindow >= 128_000
  ) {
    return 'advanced'
  }
  if (profile.toolCalling && profile.contextWindow >= 32_000) return 'standard'
  return 'basic'
}

const TIER_ORDER: Record<ModelCapabilityTier, number> = { basic: 0, standard: 1, advanced: 2 }

/**
 * 逐项比较要求与画像,返回**人可读**的缺失项。
 * 文本同时带要求值与模型值,拒绝原因可被直接复制进日志/响应,不用二次解释。
 */
export function unmetCapabilities(
  requirement: ModelCapabilityRequirement | undefined,
  profile: ModelCapabilityProfile,
): string[] {
  const missing: string[] = []
  if (!requirement) return missing
  if (requirement.toolCalling === true && !profile.toolCalling) {
    missing.push('toolCalling(模型不支持工具调用)')
  }
  if (requirement.vision === true && !profile.vision) {
    missing.push('vision(模型不支持视觉输入)')
  }
  if (requirement.structuredOutput === true && !profile.structuredOutput) {
    missing.push('structuredOutput(模型不支持结构化输出)')
  }
  if (
    requirement.minContextWindow !== undefined &&
    profile.contextWindow < requirement.minContextWindow
  ) {
    missing.push(
      `contextWindow(要求 ≥ ${requirement.minContextWindow},模型 ${profile.contextWindow})`,
    )
  }
  if (
    requirement.minMaxParallel !== undefined &&
    profile.maxParallel < requirement.minMaxParallel
  ) {
    missing.push(`maxParallel(要求 ≥ ${requirement.minMaxParallel},模型 ${profile.maxParallel})`)
  }
  if (requirement.minModelTier !== undefined) {
    const actual = modelTierOf(profile)
    if (TIER_ORDER[actual] < TIER_ORDER[requirement.minModelTier]) {
      missing.push(`modelTier(要求 ≥ ${requirement.minModelTier},模型 ${actual})`)
    }
  }
  return missing
}

/**
 * 运行期选档。
 *
 * 顺序(每一步都是显式的,不合并):
 * 1. `hard` 未满足 → 拒绝(code=skill_capability_rejected),原因列出缺失项;
 * 2. `full` 全部满足 → full;
 * 3. `reduced` 已声明且满足 → reduced(功能降级但不报错),reason 里带上 full 的缺失项;
 * 4. `reduced` 已声明但不满足 → 拒绝(code=skill_tier_unsatisfied),原因列出 reduced 缺失项;
 * 5. 未声明 reduced 且 full 不满足 → 拒绝(code=skill_tier_unsatisfied),原因列出 full 缺失项。
 */
export function selectSkillTier(
  skillName: string,
  tiers: SkillCapabilityTiers,
  profile: ModelCapabilityProfile,
): SkillTierResult {
  const base = { skillName, modelId: profile.modelId }
  const modelTier = modelTierOf(profile)

  const hardMissing = unmetCapabilities(tiers.hard, profile)
  if (hardMissing.length > 0) {
    return {
      ...base,
      ok: false,
      code: 'skill_capability_rejected',
      reason:
        `技能 "${skillName}" 的硬性能力要求未满足(模型 "${profile.modelId}",档 ${modelTier}):` +
        hardMissing.join('、'),
      missing: hardMissing,
    }
  }

  const fullMissing = unmetCapabilities(tiers.full.requires, profile)
  if (fullMissing.length === 0) {
    return {
      ...base,
      ok: true,
      tier: 'full',
      reason: `模型 "${profile.modelId}"(档 ${modelTier})满足 full 档全部能力要求`,
      missingForFull: [],
      degradedFeatures: [],
    }
  }

  if (tiers.reduced) {
    const reducedMissing = unmetCapabilities(tiers.reduced.requires, profile)
    if (reducedMissing.length === 0) {
      return {
        ...base,
        ok: true,
        tier: 'reduced',
        reason:
          `模型 "${profile.modelId}"(档 ${modelTier})不满足 full 档(${fullMissing.join('、')}),` +
          '已降级到 reduced 档',
        missingForFull: fullMissing,
        degradedFeatures: [...(tiers.reduced.disabledFeatures ?? [])],
      }
    }
    return {
      ...base,
      ok: false,
      code: 'skill_tier_unsatisfied',
      reason:
        `模型 "${profile.modelId}"(档 ${modelTier})既不满足 full 档(${fullMissing.join('、')}),` +
        `也不满足 reduced 档(${reducedMissing.join('、')})`,
      missing: [...fullMissing, ...reducedMissing],
    }
  }

  return {
    ...base,
    ok: false,
    code: 'skill_tier_unsatisfied',
    reason:
      `模型 "${profile.modelId}"(档 ${modelTier})不满足 full 档(${fullMissing.join('、')}),` +
      '且技能未声明 reduced 档',
    missing: fullMissing,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
