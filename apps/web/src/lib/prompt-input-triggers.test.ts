// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  extractActivePromptInputTrigger,
  filterPromptInputSuggestions,
  getActivePromptInputTokenTailLength,
  getBestPromptInputSuggestionIndex,
  type PromptInputSuggestionItem,
} from './prompt-input-triggers'

function item(partial: Partial<PromptInputSuggestionItem>): PromptInputSuggestionItem {
  return {
    id: partial.id ?? 'item',
    trigger: partial.trigger ?? '/',
    value: partial.value ?? '',
    label: partial.label ?? '',
    description: partial.description ?? '',
    keywords: partial.keywords,
  }
}

describe('extractActivePromptInputTrigger', () => {
  it('基本触发符提取(含行首与空格后)', () => {
    expect(extractActivePromptInputTrigger('/deploy')).toEqual({ trigger: '/', query: 'deploy' })
    expect(extractActivePromptInputTrigger('run /deploy')).toEqual({ trigger: '/', query: 'deploy' })
    expect(extractActivePromptInputTrigger('hello @world')).toEqual({ trigger: '@', query: 'world' })
    expect(extractActivePromptInputTrigger(' $prod')).toEqual({ trigger: '$', query: 'prod' })
    expect(extractActivePromptInputTrigger('#topic')).toEqual({ trigger: '#', query: 'topic' })
  })

  it('¥/￥ 触发语义归一为 $(不改写输入字符)', () => {
    expect(extractActivePromptInputTrigger('¥skill')).toEqual({ trigger: '$', query: 'skill' })
    expect(extractActivePromptInputTrigger('￥skill')).toEqual({ trigger: '$', query: 'skill' })
  })

  it('域名形态拒绝:汉字紧邻 @ 的邮箱形态不触发', () => {
    expect(extractActivePromptInputTrigger('联系邮箱@example.com')).toBeNull()
    expect(extractActivePromptInputTrigger('用户@例子.公司')).toBeNull()
  })

  it('中文标点后与空格后的 @ 不受域名拒绝影响', () => {
    expect(extractActivePromptInputTrigger('看看，@foo.bar')).toEqual({ trigger: '@', query: 'foo.bar' })
    expect(extractActivePromptInputTrigger('看看 @foo.bar')).toEqual({ trigger: '@', query: 'foo.bar' })
  })

  it('非 @ 触发符没有中文紧邻放宽(句中不触发)', () => {
    expect(extractActivePromptInputTrigger('abc/def')).toBeNull()
    expect(extractActivePromptInputTrigger('联系/deploy')).toBeNull()
    // query 中途出现触发符/空白截断
    expect(extractActivePromptInputTrigger('/de ploy')).toBeNull()
  })
})

describe('getActivePromptInputTokenTailLength', () => {
  it('/go|al 补全 goal 只删未输入后缀 al', () => {
    const active = { trigger: '/' as const, query: 'go' }
    expect(getActivePromptInputTokenTailLength(active, 'al', ['goal'])).toBe(2)
    // 候选带触发符前缀也能对上
    expect(getActivePromptInputTokenTailLength(active, 'al', ['/goal'])).toBe(2)
  })

  it('候选后紧贴的正文不会被整段当作 tail', () => {
    const active = { trigger: '/' as const, query: 'go' }
    // 候选 goal 已输完,后面还有别的文字:预期后缀 "al" 与 " question" 前缀对不上,不删
    expect(getActivePromptInputTokenTailLength(active, 'al question', ['goal'])).toBe(2)
  })

  it('裸触发符后光标处正文不是 tail(query 为空返回 0)', () => {
    const active = { trigger: '@' as const, query: '' }
    expect(getActivePromptInputTokenTailLength(active, 'hello', ['goal'])).toBe(0)
  })

  it('候选不匹配或光标后无 tail 时返回 0', () => {
    const active = { trigger: '/' as const, query: 'go' }
    expect(getActivePromptInputTokenTailLength(active, 'al', ['deploy'])).toBe(0)
    expect(getActivePromptInputTokenTailLength(active, '', ['goal'])).toBe(0)
    expect(getActivePromptInputTokenTailLength(active, ' rest', ['goal'])).toBe(0)
  })
})

describe('filterPromptInputSuggestions', () => {
  it('query 为 null 返回空数组;空 query 返回原序', () => {
    const list = [item({ value: 'a' })]
    expect(filterPromptInputSuggestions(list, null)).toEqual([])
    expect(filterPromptInputSuggestions(list, '')).toBe(list)
  })

  it('keyword 命中权重(+450)低于 description 命中(+250),后者排前', () => {
    const viaDescription = item({ value: 'deploy', description: 'production deploy' })
    const viaKeyword = item({ value: 'deploy', description: 'deploy to server', keywords: ['prod'] })
    const ranked = filterPromptInputSuggestions([viaKeyword, viaDescription], 'prod')
    expect(ranked[0]).toBe(viaDescription)
    expect(ranked[1]).toBe(viaKeyword)
  })

  it('前缀命中高于子串命中', () => {
    const prefix = item({ value: 'goal', label: 'goal' })
    const substring = item({ value: 'wagon', label: 'wagon' })
    const ranked = filterPromptInputSuggestions([substring, prefix], 'go')
    expect(ranked[0]).toBe(prefix)
    expect(ranked[1]).toBe(substring)
  })

  it('同分保原序(稳定排序)', () => {
    const first = item({ value: 'abc', label: 'one' })
    const second = item({ value: 'abc', label: 'two' })
    const ranked = filterPromptInputSuggestions([second, first], 'ab')
    expect(ranked[0]).toBe(second)
    expect(ranked[1]).toBe(first)
  })

  it('全部未命中的候选被过滤掉', () => {
    const ranked = filterPromptInputSuggestions([item({ value: 'xyz' })], 'go')
    expect(ranked).toEqual([])
  })
})

describe('getBestPromptInputSuggestionIndex', () => {
  it('返回最高分命中的原下标;无 query 落首位', () => {
    const prefix = item({ value: 'goal', label: 'goal' })
    const substring = item({ value: 'toggle', label: 'toggle' })
    expect(getBestPromptInputSuggestionIndex([substring, prefix], 'go')).toBe(1)
    expect(getBestPromptInputSuggestionIndex([substring, prefix], null)).toBe(0)
    expect(getBestPromptInputSuggestionIndex([substring, prefix], '')).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
