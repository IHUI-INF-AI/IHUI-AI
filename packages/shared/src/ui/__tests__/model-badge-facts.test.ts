// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * model-badge-facts 行为对子 —— 判序的两条(价格优先 → id 回落)各自正反例。
 *
 * 为什么这些断言值得写死:判据此前在 RN 里是**两套互不相等**的实现(AgentScreen 读价格、
 * AiAssistantN8nScreen 读 id 前缀),小程序侧则没有判据(恒真"免费")。收口成一份之后,
 * 真正会出错的是"判序被换"和"null 被当成 0"这两型 —— 它们都不会让 typecheck 红
 * (`number | null | undefined` 三种输入在编译期同形),只会在端上把收费模型标成免费
 * 或把 4 个自由网关 provider 全标成收费。所以每条都要有正反两读。
 */
import { describe, it, expect } from 'vitest'
import { modelIsFree, FREE_GATEWAY_ID_RE } from '../model-badge-facts'

describe('① 价格字段在场 ⇒ 以价格为准(不走 id 回落)', () => {
  it('input_price / inputPrice 为 0 且另一档缺失或 0 ⇒ 免费', () => {
    expect(modelIsFree({ id: 'deepseek-v3', inputPrice: 0 })).toBe(true)
    expect(modelIsFree({ id: 'deepseek-v3', inputPrice: 0, outputPrice: 0 })).toBe(true)
  })

  it('任一价格字段非 0 ⇒ 付费(另一档缺失不影响结论)', () => {
    expect(modelIsFree({ id: 'deepseek-v3', inputPrice: 0.001 })).toBe(false)
    expect(modelIsFree({ id: 'deepseek-v3', inputPrice: 0, outputPrice: 2 })).toBe(false)
  })

  it('判序不可交换:价格在场且非 0 时,即便 id 命中自由网关前缀也判付费', () => {
    // 阳性对照 —— 若把判序换成"先看 id",这一条必红(那正是把收费模型说成免费的那一型)
    expect(FREE_GATEWAY_ID_RE.test('@cf/deepseek-paid')).toBe(true)
    expect(modelIsFree({ id: '@cf/deepseek-paid', inputPrice: 5 })).toBe(false)
  })
})

describe('② 两个价格字段都缺失 ⇒ 回落 FREE_GATEWAY_ID_RE', () => {
  it('id 命中自由网关前缀 ⇒ 免费(n8n 目录无价格字段,靠这一档)', () => {
    for (const id of [
      '@cf/meta-llama-3',
      'pollinations/flux',
      'llm7/gpt',
      'aihorde/stable-diffusion',
    ]) {
      expect(modelIsFree({ id })).toBe(true)
    }
  })

  it('id 不命中 ⇒ 付费', () => {
    expect(modelIsFree({ id: 'claude-opus-4' })).toBe(false)
    expect(modelIsFree({ id: 'deepseek-v3' })).toBe(false)
  })

  it('null 与 undefined 同视(都是"没有价格事实"),不算 0', () => {
    // 阳性对照 —— 若把 null 当成 0(=(null ?? 0) === 0 走价格档),下面这条会变绿成"免费",
    // 而它真正表达的是"这份数据没告诉我价格",处置动作与"价格确实是 0"不同
    expect(modelIsFree({ id: 'claude-opus-4', inputPrice: null, outputPrice: null })).toBe(false)
    expect(modelIsFree({ id: '@cf/x', inputPrice: null })).toBe(true)
  })

  it('只有一档在场也算"价格事实",不因另一档缺失而回落 id', () => {
    expect(modelIsFree({ id: '@cf/x', outputPrice: 3 })).toBe(false)
    expect(modelIsFree({ id: 'claude-opus-4', inputPrice: 0 })).toBe(true)
  })
})

describe('③ FREE_GATEWAY_ID_RE 本身是封闭清单(扩 provider 要显式改这一处)', () => {
  it('四个在册前缀命中,形近前缀不命中', () => {
    expect(FREE_GATEWAY_ID_RE.source).toBe(/^@cf\/|^pollinations\/|^llm7\/|^aihorde\//.source)
    expect(FREE_GATEWAY_ID_RE.test('sub.@cf/x')).toBe(false) // 必须锚在起始
    expect(FREE_GATEWAY_ID_RE.test('@cfx')).toBe(false) // 前缀含斜杠
    expect(FREE_GATEWAY_ID_RE.test('@cf/x')).toBe(true)
  })
})
