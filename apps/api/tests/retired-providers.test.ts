// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 退役 provider 守卫 + 默认对话模型解析的单测(2026-10-26 立)。
 *
 * 立票理由:stepfun(阶跃星辰)订阅失效后被机主永久除名,但 apps/api 侧曾有 4 处把默认模型
 * 写死成 `process.env.LITELLM_MODEL || '<stepfun 档>'`。生产 .env 实测没有 LITELLM_MODEL
 * ⇒ 那 4 处真的会落到已 400 的 provider。
 *
 * 本测保证:
 * 1. 退役前缀表里确实有 stepfun,且 `isRetiredModel` 认得出大小写变体;
 * 2. 解析器在「显式传退役档 / env 被改回退役档」两种情形下都**不返回**退役档;
 * 3. 解析器在正常情形下确实按「显式 → env → 兜底链」取档(不是恒定返回兜底链首档)。
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  RETIRED_PROVIDER_PREFIXES,
  LAST_RESORT_MODEL_CHAIN,
  isRetiredModel,
  resolveDefaultChatModel,
} from '../src/utils/retired-providers.js'

const ORIGINAL_LITELLM_MODEL = process.env.LITELLM_MODEL

afterEach(() => {
  if (ORIGINAL_LITELLM_MODEL === undefined) delete process.env.LITELLM_MODEL
  else process.env.LITELLM_MODEL = ORIGINAL_LITELLM_MODEL
})

describe('退役前缀表', () => {
  it('stepfun 在退役表里(与 Python 侧 RETIRED_MODEL_PREFIXES 同源)', () => {
    expect(RETIRED_PROVIDER_PREFIXES).toContain('stepfun/')
  })

  it('兜底链自身不得含任何退役档(否则守卫形同虚设)', () => {
    expect(LAST_RESORT_MODEL_CHAIN.length).toBeGreaterThan(0)
    for (const model of LAST_RESORT_MODEL_CHAIN) {
      expect(isRetiredModel(model)).toBe(false)
    }
  })
})

describe('isRetiredModel', () => {
  it('命中退役前缀(含大小写变体与前后空白)', () => {
    expect(isRetiredModel('stepfun/step-3.7-flash')).toBe(true)
    expect(isRetiredModel('STEPFUN/Step-3.7-Flash')).toBe(true)
    expect(isRetiredModel('  stepfun/step-3.5-flash  ')).toBe(true)
  })

  it('空值/未定义/非退役档 ⇒ false', () => {
    expect(isRetiredModel('')).toBe(false)
    expect(isRetiredModel(undefined)).toBe(false)
    expect(isRetiredModel(null)).toBe(false)
    expect(isRetiredModel('agnes/agnes-2.5-flash')).toBe(false)
    expect(isRetiredModel('pollinations/openai-fast')).toBe(false)
    expect(isRetiredModel('gpt-4o')).toBe(false)
  })
})

describe('resolveDefaultChatModel', () => {
  it('显式传入的非退役档优先(不被 env 覆盖)', () => {
    process.env.LITELLM_MODEL = 'agnes/agnes-2.0-flash'
    expect(resolveDefaultChatModel('pollinations/openai-fast')).toBe('pollinations/openai-fast')
  })

  it('显式传入空值 ⇒ 走 env', () => {
    process.env.LITELLM_MODEL = 'agnes/agnes-2.0-flash'
    expect(resolveDefaultChatModel()).toBe('agnes/agnes-2.0-flash')
    expect(resolveDefaultChatModel('   ')).toBe('agnes/agnes-2.0-flash')
  })

  it('env 未设置 ⇒ 落末位兜底链首档', () => {
    delete process.env.LITELLM_MODEL
    expect(resolveDefaultChatModel()).toBe(LAST_RESORT_MODEL_CHAIN[0])
  })

  it('env 被改回退役档 ⇒ 不得解析出退役档(顺延到下一档)', () => {
    process.env.LITELLM_MODEL = 'stepfun/step-3.7-flash'
    const got = resolveDefaultChatModel()
    expect(isRetiredModel(got)).toBe(false)
    expect(got).toBe(LAST_RESORT_MODEL_CHAIN[0])
  })

  it('显式传入退役档 ⇒ 同样顺延,绝不返回退役档', () => {
    process.env.LITELLM_MODEL = 'agnes/agnes-2.0-flash'
    const got = resolveDefaultChatModel('stepfun/step-3.7-flash')
    expect(isRetiredModel(got)).toBe(false)
    expect(got).toBe('agnes/agnes-2.0-flash')
  })

  it('任何组合下返回值都不是退役档', () => {
    for (const envValue of ['', 'stepfun/step-3.7-flash', 'agnes/agnes-2.5-flash']) {
      if (envValue) process.env.LITELLM_MODEL = envValue
      else delete process.env.LITELLM_MODEL
      for (const explicit of [
        undefined,
        '',
        'stepfun/step-3.5-flash',
        'pollinations/openai-fast',
      ]) {
        const got = resolveDefaultChatModel(explicit)
        expect(got).toBeTruthy()
        expect(isRetiredModel(got)).toBe(false)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
