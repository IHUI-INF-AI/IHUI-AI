// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型规格宣告 —— 纯判据测试(mock 零 IO;不连库、不出网)。
 *
 * 2026-11-17 立(对标 qoder2api-hub `/v1/models` 的「能力与规格宣告」)。
 * 钉住四条会静默误导客户端的判据:
 *   S1 有出处的数字才宣告:96K / 1M 两条;其余 context = null 且响应里整键省略。
 *   S2 能力 = 族级规则 ∪ 名称推导:未知模型不被诬告成「支持 tools」。
 *   S3 思考档位三态:支持(名称命中)/ 明确不支持(supported=false)/ 覆盖表指定。
 *   S4 env 覆盖表非法条目整条丢弃并点名;覆盖只改它声明的字段。
 */
import { describe, it, expect } from 'vitest'

import {
  deriveModelSpec,
  isThinkingModel,
  modelSpecToWire,
  parseModelSpecEnv,
  THINKING_LEVELS,
  MODEL_FAMILY_RULES,
  __test__ as S,
} from '../src/services/relay-model-spec.js'

// ── S1 有出处的数字 ─────────────────────────────────────────────────────────

describe('有出处的上下文数字', () => {
  it('DeepSeek-V4-Pro = 96K(qoder2api 公开页标注)', () => {
    const spec = deriveModelSpec('DeepSeek-V4-Pro')
    expect(spec.contextWindow).toBe(96 * 1024)
    expect(spec.declaredBy).toBe('rule')
  })

  it('GLM-5.3-Flash = 1M(同上)', () => {
    expect(deriveModelSpec('GLM-5.3-Flash').contextWindow).toBe(1024 * 1024)
  })

  it('其余族不编数字 ⇒ null', () => {
    for (const id of ['gpt-5.1', 'claude-sonnet-4.5', 'gemini-2.5-pro', 'qwen3-max']) {
      expect(deriveModelSpec(id).contextWindow).toBeNull()
    }
  })

  it('内置规则表里凡有数字的条目必须有基本量级(防 0/负数混入)', () => {
    for (const rule of MODEL_FAMILY_RULES) {
      if (rule.contextWindow !== undefined) expect(rule.contextWindow).toBeGreaterThan(4096)
      if (rule.maxOutputTokens !== undefined) expect(rule.maxOutputTokens).toBeGreaterThan(256)
    }
  })
})

// ── S2 能力 ────────────────────────────────────────────────────────────────

describe('能力推导', () => {
  it('族级规则:gpt / claude / gemini 带 vision', () => {
    expect(deriveModelSpec('gpt-5.1').capabilities).toContain('vision')
    expect(deriveModelSpec('claude-sonnet-4.5').capabilities).toContain('vision')
    expect(deriveModelSpec('gemini-2.5-pro').capabilities).toContain('audio')
  })

  it('名称推导:-vl / coder / thinking', () => {
    expect(deriveModelSpec('qwen2.5-vl').capabilities).toContain('vision')
    expect(deriveModelSpec('deepseek-coder').capabilities).toContain('code')
    expect(deriveModelSpec('kimi-k2-thinking').capabilities).toContain('reasoning')
  })

  it('未知模型 ⇒ 空能力 + declaredBy=none(不诬告支持 tools)', () => {
    const spec = deriveModelSpec('acme-unknown-model-9')
    expect(spec.capabilities).toEqual([])
    expect(spec.declaredBy).toBe('none')
    expect(spec.contextWindow).toBeNull()
  })

  it('能力去重(族级与名称推导取并集不重复)', () => {
    const spec = deriveModelSpec('gpt-5.1-vision')
    expect(spec.capabilities.filter((c) => c === 'vision')).toHaveLength(1)
  })
})

// ── S3 思考档位三态 ────────────────────────────────────────────────────────

describe('思考档位', () => {
  it('名称命中 ⇒ supported=true 且三档齐备', () => {
    const spec = deriveModelSpec('kimi-k2-thinking')
    expect(spec.thinking.supported).toBe(true)
    expect(spec.thinking.levels).toEqual([...THINKING_LEVELS])
  })

  it('非思考模型 ⇒ supported=false 且 levels 为空(明确不支持,不是未判定)', () => {
    const spec = deriveModelSpec('gpt-5.1')
    expect(spec.thinking.supported).toBe(false)
    expect(spec.thinking.levels).toEqual([])
  })

  it('isThinkingModel 覆盖 o1/o3/r1/reasoner', () => {
    expect(isThinkingModel('o3-mini')).toBe(true)
    expect(isThinkingModel('deepseek-r1')).toBe(true)
    expect(isThinkingModel('deepseek-reasoner')).toBe(true)
    expect(isThinkingModel('o1-preview')).toBe(true)
    expect(isThinkingModel('gpt-4o-mini')).toBe(false)
  })
})

// ── S4 env 覆盖表 ──────────────────────────────────────────────────────────

describe('env 覆盖表', () => {
  it('覆盖优先,且只改声明的字段(能力仍走规则)', () => {
    const overrides = parseModelSpecEnv(
      JSON.stringify([{ match: 'gpt-5.1', contextWindow: 400000, note: '运营登记' }]),
    ).overrides
    const spec = deriveModelSpec('gpt-5.1', overrides)
    expect(spec.contextWindow).toBe(400000)
    expect(spec.capabilities).toContain('tools')
    expect(spec.declaredBy).toBe('override')
  })

  it('prefix 模式命中整族', () => {
    const overrides = parseModelSpecEnv(
      JSON.stringify([{ match: 'qwen', mode: 'prefix', maxOutputTokens: 8192 }]),
    ).overrides
    expect(deriveModelSpec('qwen3-max', overrides).maxOutputTokens).toBe(8192)
  })

  it('thinkingLevels 覆盖 → supported=true 且用声明的档位', () => {
    const overrides = parseModelSpecEnv(
      JSON.stringify([{ match: 'custom-x', thinkingLevels: ['minimal', 'high'] }]),
    ).overrides
    const spec = deriveModelSpec('custom-x', overrides)
    expect(spec.thinking).toEqual({ supported: true, levels: ['minimal', 'high'] })
  })

  it('非法条目整条丢弃并点名', () => {
    const out = parseModelSpecEnv(
      JSON.stringify([
        { match: '', contextWindow: 100 },
        { match: 'a' },
        { match: 'b', contextWindow: -1 },
        'not-an-object',
        { match: 'ok', contextWindow: 65536 },
      ]),
    )
    expect(out.overrides).toHaveLength(1)
    expect(out.rejected).toHaveLength(4)
  })

  it('坏 JSON / 空 ⇒ 零覆盖且点名', () => {
    expect(parseModelSpecEnv('{bad').rejected[0]?.reason).toContain('JSON')
    expect(parseModelSpecEnv('{"x":1}').rejected).toHaveLength(1)
    expect(parseModelSpecEnv('').rejected).toHaveLength(0)
  })
})

// ── 对外形状 ───────────────────────────────────────────────────────────────

describe('modelSpecToWire', () => {
  it('null 上下文整键省略;thinking 恒在', () => {
    const wire = modelSpecToWire(deriveModelSpec('gpt-5.1'))
    expect(wire).not.toHaveProperty('context_window')
    expect(wire).not.toHaveProperty('max_output_tokens')
    expect(wire).toHaveProperty('thinking')
    expect(wire['capabilities']).toEqual(['tools', 'vision'])
  })

  it('有值才出场', () => {
    const wire = modelSpecToWire(deriveModelSpec('DeepSeek-V4-Pro'))
    expect(wire['context_window']).toBe(96 * 1024)
  })

  it('空能力数组不出场(不把自己的未判定冒充成不支持)', () => {
    const wire = modelSpecToWire(deriveModelSpec('acme-unknown'))
    expect(wire).not.toHaveProperty('capabilities')
  })
})

describe('__test__ 出口', () => {
  it('暴露判据且规则表非空', () => {
    expect(S.MODEL_FAMILY_RULES.length).toBeGreaterThan(10)
    expect(Object.keys(S)).toEqual(expect.arrayContaining(['hitByRule', 'hitOverride']))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
