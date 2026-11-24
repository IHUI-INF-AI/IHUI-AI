// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能按模型能力分档:full / reduced / 拒绝 三态 × 能力缺失组合。
 * 反向例①钉死 toolCalling=false 时依赖工具的技能**必须拒绝并给出原因原文**。
 */
import { describe, expect, it } from 'vitest'
import {
  MODEL_CAPABILITY_TIERS,
  modelTierOf,
  selectSkillTier,
  unmetCapabilities,
  type ModelCapabilityProfile,
  type SkillCapabilityTiers,
} from '../src/skill-tiers.js'

const strong: ModelCapabilityProfile = {
  modelId: 'gpt-4o',
  contextWindow: 128_000,
  toolCalling: true,
  vision: true,
  structuredOutput: true,
  maxParallel: 8,
}

const small: ModelCapabilityProfile = {
  modelId: 'qwen3-coder',
  contextWindow: 32_000,
  toolCalling: true,
  vision: false,
  structuredOutput: false,
  maxParallel: 2,
}

const tiers: SkillCapabilityTiers = {
  hard: { toolCalling: true },
  full: {
    requires: { toolCalling: true, vision: true, structuredOutput: true, minContextWindow: 64_000 },
  },
  reduced: {
    requires: { toolCalling: true, minContextWindow: 16_000 },
    disabledFeatures: ['vision-caption', 'structured-plan'],
  },
}

describe('model tier derivation', () => {
  it('advanced / standard / basic 三档判据唯一', () => {
    expect(modelTierOf(strong)).toBe('advanced')
    expect(modelTierOf(small)).toBe('standard')
    expect(modelTierOf({ ...small, toolCalling: false, contextWindow: 8_000 })).toBe('basic')
  })

  it('MODEL_CAPABILITY_TIERS 顺序由低到高(档位比较依赖该顺序)', () => {
    expect(MODEL_CAPABILITY_TIERS).toEqual(['basic', 'standard', 'advanced'])
  })
})

describe('selectSkillTier — three states', () => {
  it('能力足够 → full,返回 {tier, reason}', () => {
    const result = selectSkillTier('doc-vision', tiers, strong)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tier).toBe('full')
    expect(result.reason).toContain('gpt-4o')
    expect(result.skillName).toBe('doc-vision')
    expect(result.modelId).toBe('gpt-4o')
    expect(result.degradedFeatures).toEqual([])
  })

  it('上下文不足 → reduced(降级不报错),带上 full 缺失项与禁用功能', () => {
    const result = selectSkillTier('doc-vision', tiers, small)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tier).toBe('reduced')
    expect(result.missingForFull.join('|')).toContain('contextWindow')
    expect(result.missingForFull.join('|')).toContain('vision')
    expect(result.degradedFeatures).toEqual(['vision-caption', 'structured-plan'])
    expect(result.reason).toContain('已降级到 reduced 档')
  })

  it('仅视觉缺失(非硬性)→ reduced,明确列出 vision', () => {
    const noVision: ModelCapabilityProfile = { ...strong, vision: false, contextWindow: 64_000 }
    const result = selectSkillTier('doc-vision', tiers, noVision)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tier).toBe('reduced')
    expect(result.missingForFull.join('|')).toContain('vision')
  })

  it('仅并行度不足 → reduced(若 full 声明了 minMaxParallel)', () => {
    const parallelTiers: SkillCapabilityTiers = {
      full: { requires: { minMaxParallel: 4 } },
      reduced: { requires: { minMaxParallel: 1 }, disabledFeatures: ['batch-tools'] },
    }
    const result = selectSkillTier('parallel-skill', parallelTiers, small)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tier).toBe('reduced')
    expect(result.missingForFull.join('|')).toContain('maxParallel')
    expect(result.degradedFeatures).toEqual(['batch-tools'])
  })

  it('仅 structuredOutput 缺失 → reduced', () => {
    const soTiers: SkillCapabilityTiers = {
      full: { requires: { structuredOutput: true } },
      reduced: { requires: {}, disabledFeatures: ['json-plan'] },
    }
    const result = selectSkillTier('planner', soTiers, small)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tier).toBe('reduced')
    expect(result.missingForFull.join('|')).toContain('structuredOutput')
  })

  it('硬性 toolCalling=false → 拒绝(反向例①),原因原文点名能力与模型', () => {
    const noTool: ModelCapabilityProfile = { ...small, toolCalling: false }
    const result = selectSkillTier('doc-vision', tiers, noTool)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('skill_capability_rejected')
    expect(result.reason).toContain('toolCalling')
    expect(result.reason).toContain('qwen3-coder')
    expect(result.reason).toContain('硬性能力要求未满足')
    expect(result.missing.join('|')).toContain('toolCalling')
  })

  it('full 不满足且未声明 reduced → 拒绝(不静默降级)', () => {
    const noReduced: SkillCapabilityTiers = {
      full: { requires: { vision: true, minContextWindow: 64_000 } },
    }
    const result = selectSkillTier('vision-only', noReduced, small)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('skill_tier_unsatisfied')
    expect(result.reason).toContain('未声明 reduced 档')
  })

  it('full 与 reduced 都不满足 → 拒绝,原因同时列两档缺失项', () => {
    const strictReduced: SkillCapabilityTiers = {
      full: { requires: { minContextWindow: 64_000 } },
      reduced: { requires: { minContextWindow: 32_000, minMaxParallel: 4 } },
    }
    const tiny: ModelCapabilityProfile = { ...small, contextWindow: 8_000, maxParallel: 1 }
    const result = selectSkillTier('strict-skill', strictReduced, tiny)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('skill_tier_unsatisfied')
    expect(result.reason).toContain('full 档')
    expect(result.reason).toContain('reduced 档')
  })

  it('minModelTier 要求参与选档(advanced 要求 → 拒绝 standard 模型)', () => {
    const advancedOnly: SkillCapabilityTiers = {
      full: { requires: { minModelTier: 'advanced' } },
    }
    const result = selectSkillTier('advanced-only', advancedOnly, small)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.missing.join('|')).toContain('modelTier')
  })

  it('无任何要求 → 直接 full(空要求不构成门槛)', () => {
    const result = selectSkillTier('plain', { full: {} }, small)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tier).toBe('full')
  })

  it('unmetCapabilities 携带要求值与模型实测值(可复核)', () => {
    const missing = unmetCapabilities({ minContextWindow: 64_000, minMaxParallel: 4 }, small)
    expect(missing.join('|')).toContain('要求 ≥ 64000,模型 32000')
    expect(missing.join('|')).toContain('要求 ≥ 4,模型 2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
