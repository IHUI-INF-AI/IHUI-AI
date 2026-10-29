// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * token 估算工具测试(2026-10-26 立,补"零测试对应共享层工具"第一批)
 *
 * 取证对象:packages/shared/src/utils/token-estimate.ts。
 * 契约锚点(模块头注):英文 ~4 字符/token、中文 ~1.5 字符/token、
 * 每条消息 +4 role 开销 —— 期望值全部按该契约独立算出的字面量,
 * 不在测试里重抄 match/除法公式当判据(§22c)。
 * 注:packages/context-compaction 的同名 estimateTokens 是另一实现
 * (BPE 投影档),不覆盖本模块。
 */
import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
} from '../../src/utils/token-estimate'

describe('estimateTokens', () => {
  it('空串与假值 → 0(进度环零位不得出现 1)', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(undefined as unknown as string)).toBe(0)
  })

  it('纯英文:11 字符按 ~4 字符/token 向上取整 → 3', () => {
    expect(estimateTokens('hello world')).toBe(3)
  })

  it('纯中文:4 字按 ~1.5 字/token 向上取整 → 3(明显高于 4/4=1,方向钉死)', () => {
    expect(estimateTokens('中文测试')).toBe(3)
  })

  it('中英混排分别计权:2 汉字 + 3 字母 → ceil(2/1.5 + 3/4) = 3', () => {
    expect(estimateTokens('中文abc')).toBe(3)
  })

  it('单字符下限:1 个字母 → 1(不足 4 也至少 1,不得向下取整成 0)', () => {
    expect(estimateTokens('a')).toBe(1)
  })

  it(
    '已知盲区留档:日文假名不在 CJK 区间 [\u4e00-\u9fff],按"其他"1/4 计 —— ' +
      '4 个假名估成 1 而汉字估成 3,同长度权重差 3 倍(未收格,不修实现只钉现状)',
    () => {
      expect(estimateTokens('ああああ')).toBe(1) // 假名走 other/4
      expect(estimateTokens('中中中中')).toBe(3) // 汉字走 cjk/1.5
    },
  )

  it('已知档留档:代理对 emoji 按 UTF-16 单元计长(2 个 emoji = 4 单元 → 1)', () => {
    expect(estimateTokens('😀😀')).toBe(1)
  })

  it('纯函数:多次调用同值,且不改写入参(字符串本身不可变,主要防未来加缓存引入状态)', () => {
    const s = 'immutable input text'
    expect(estimateTokens(s)).toBe(estimateTokens(s))
    expect(s).toBe('immutable input text')
  })
})

describe('estimateMessageTokens', () => {
  it('恒定 +4 role 开销:空内容消息也得 4(不是 0)', () => {
    expect(estimateMessageTokens({ content: '' })).toBe(4)
  })

  it('内容开销 + 固定开销相加:hello world(3) + 4 = 7', () => {
    expect(estimateMessageTokens({ content: 'hello world' })).toBe(7)
  })

  it('content 为 null/undefined 时兜底空内容 → 恰为 4,不抛错', () => {
    expect(estimateMessageTokens({ content: undefined as unknown as string })).toBe(4)
    expect(estimateMessageTokens({} as unknown as { content: string })).toBe(4)
  })
})

describe('estimateConversationTokens', () => {
  it('空列表 → 0(不是 4)', () => {
    expect(estimateConversationTokens([])).toBe(0)
  })

  it('逐条求和含各自 +4:两条消息 = (3+4)+(4) = 11', () => {
    expect(estimateConversationTokens([{ content: 'hello world' }, { content: '' }])).toBe(11)
  })

  it('单调性:追加任何消息总量不减(进度条不得倒退)', () => {
    const base = [{ content: 'a' }, { content: 'b' }]
    const withMore = [...base, { content: 'c' }]
    expect(estimateConversationTokens(withMore)).toBeGreaterThan(estimateConversationTokens(base))
  })

  it('无副作用:调用后数组与元素原样(不得 sort/splice/改写 content)', () => {
    const msgs = [{ content: 'hello world' }, { content: '中文测试' }]
    const snapshot = JSON.stringify(msgs)
    estimateConversationTokens(msgs)
    expect(JSON.stringify(msgs)).toBe(snapshot)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
