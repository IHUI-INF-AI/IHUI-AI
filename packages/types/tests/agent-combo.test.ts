// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 参数组合校验器(2026-11-13 立)
 *
 * 判据:契约层只拒绝"结构上不可能是合法组合"的输入;范围错误必须报错而不是夹断,
 * 因为夹断会让用户在保存后看到一个自己没设过的值(静默篡改比失败更糟)。
 */

import { describe, expect, it } from 'vitest'
import {
  AGENT_COMBO_LIMITS,
  parseAgentComboRecord,
  validateAgentCombo,
} from '../src/agent-combo.js'

const base = {
  id: 'combo-abc',
  name: '  严谨开发  ',
  params: {
    temperature: 0.2,
    topP: 0.9,
    topK: 40,
    maxTokens: 8000,
    systemPrompt: '你是严谨的工程师',
  },
}

describe('validateAgentCombo', () => {
  it('合法组合通过并 trim 名称', () => {
    const result = validateAgentCombo(base)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('严谨开发')
      expect(result.value.params.temperature).toBe(0.2)
    }
  })

  it('未知参数键被拒绝', () => {
    const result = validateAgentCombo({ ...base, params: { ...base.params, model: 'x' } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.path === 'params.model')).toBe(true)
  })

  it('越界数值报错而不夹断', () => {
    for (const params of [{ temperature: 3 }, { topP: 1.5 }, { maxTokens: 0 }, { topK: 12.5 }]) {
      const result = validateAgentCombo({ ...base, params })
      expect(result.ok).toBe(false)
    }
  })

  it('id 必须与路由一致', () => {
    const result = validateAgentCombo(base, { expectedId: 'other-id' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.path === 'id')).toBe(true)
  })

  it('名称超长 / 提示词超长被拒绝', () => {
    expect(validateAgentCombo({ ...base, name: 'x'.repeat(61) }).ok).toBe(false)
    expect(
      validateAgentCombo({
        ...base,
        params: { systemPrompt: 'x'.repeat(AGENT_COMBO_LIMITS.maxPromptChars + 1) },
      }).ok,
    ).toBe(false)
  })

  it('空 params 在契约层合法(套用时不改任何项)', () => {
    expect(validateAgentCombo({ id: 'combo-empty', name: '空', params: {} }).ok).toBe(true)
  })

  it('纯空白提示词被丢弃而不是存空串', () => {
    const result = validateAgentCombo({ ...base, params: { systemPrompt: '   ' } })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.params.systemPrompt).toBeUndefined()
  })
})

describe('parseAgentComboRecord', () => {
  it('解析落库 JSON 字符串', () => {
    const record = parseAgentComboRecord(
      JSON.stringify({
        ...base,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-02T00:00:00.000Z',
      }),
    )
    expect(record?.name).toBe('严谨开发')
    expect(record?.createdAt).toBe('2026-11-01T00:00:00.000Z')
  })

  it('坏 JSON / 非法结构返回 null,不抛错', () => {
    expect(parseAgentComboRecord('{not json')).toBeNull()
    expect(parseAgentComboRecord({ id: 'bad', name: '', params: {} })).toBeNull()
    expect(parseAgentComboRecord(null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
