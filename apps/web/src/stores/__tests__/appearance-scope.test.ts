// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 单条消息外观作用域 store 的判据测试(2026-11-15 立,随 `stores/appearance-scope.ts` 入库)。
//
// 最要紧的一条:**变量名与消费端逐字一致**。这套东西的失效方式极其安静 ——
// 名字写错一个字符,样式不生效、也不报错,只有肉眼能看出来。所以这里把
// `components/ai/markdown-stream.tsx` 里 `var(--message-…)` 的名字抄成断言,
// 改任何一边都会红。
import { beforeEach, describe, expect, it } from 'vitest'

import {
  MESSAGE_OVERRIDE_LIMIT,
  messageStyleVars,
  sanitizeMessageStyleOverride,
  useAppearanceScopeStore,
} from '../appearance-scope'

describe('messageStyleVars(单条消息变量契约)', () => {
  it('无覆盖产出空对象:style={} 在任何调用点都是合法入参', () => {
    expect(messageStyleVars(undefined)).toEqual({})
    expect(messageStyleVars({})).toEqual({})
  })

  it('变量名与 markdown-stream 的 var(--message-…) 逐字一致', () => {
    const vars = messageStyleVars({
      fontSize: 18,
      fontFamily: 'serif',
      lineHeight: 'relaxed',
      letterSpacing: 'wide',
      codeFontSize: 17,
      align: 'justify',
    }) as unknown as Record<string, string | undefined>
    expect(Object.keys(vars).sort()).toEqual(
      [
        '--message-code-font-size',
        '--message-font-family',
        '--message-font-multiplier',
        '--message-letter-spacing',
        '--message-line-height',
        'textAlign',
      ].sort(),
    )
  })

  it('字号换算成倍率:基准 15px,18px ⇒ 1.2', () => {
    const vars = messageStyleVars({ fontSize: 18 }) as unknown as Record<string, string>
    expect(vars['--message-font-multiplier']).toBe('1.2')
  })

  it('字号等于基准时倍率恒为 1(不产出 1.0000001 这种浮点噪声)', () => {
    const vars = messageStyleVars({ fontSize: 15 }) as unknown as Record<string, string>
    expect(vars['--message-font-multiplier']).toBe('1')
  })

  it('只设一个字段就只产出一个变量:其余走 var(--chat-*, …) 回落到全局', () => {
    const vars = messageStyleVars({ lineHeight: 'compact' }) as unknown as Record<string, string>
    expect(Object.keys(vars)).toEqual(['--message-line-height'])
    expect(vars['--message-line-height']).toBe('1.45')
  })

  it("fontFamily='system' 档不产出变量(= 继承宿主)", () => {
    const vars = messageStyleVars({ fontFamily: 'system' }) as unknown as Record<string, string>
    expect(vars['--message-font-family']).toBeUndefined()
  })

  it('对齐走普通内联样式而非自定义属性(text-align 可继承,能透传给 markdown 段落)', () => {
    const vars = messageStyleVars({ align: 'justify' }) as unknown as Record<string, string>
    expect(vars.textAlign).toBe('justify')
    expect(Object.keys(vars)).toEqual(['textAlign'])
  })
})

describe('sanitizeMessageStyleOverride(净化)', () => {
  it('越界数字夹紧到合法区间', () => {
    expect(sanitizeMessageStyleOverride({ fontSize: 200 })).toEqual({ fontSize: 22 })
    expect(sanitizeMessageStyleOverride({ fontSize: -5 })).toEqual({ fontSize: 12 })
    expect(sanitizeMessageStyleOverride({ codeFontSize: 99 })).toEqual({ codeFontSize: 18 })
  })

  it('非数字 / 非有限数一律丢弃', () => {
    expect(sanitizeMessageStyleOverride({ fontSize: '18' })).toEqual({})
    expect(sanitizeMessageStyleOverride({ fontSize: Number.NaN })).toEqual({})
    expect(sanitizeMessageStyleOverride({ fontSize: Number.POSITIVE_INFINITY })).toEqual({})
  })

  it('非法枚举与原型链上的键都丢弃(不被 toString 之类的名字骗过)', () => {
    expect(sanitizeMessageStyleOverride({ lineHeight: 'huge' })).toEqual({})
    expect(sanitizeMessageStyleOverride({ fontFamily: 'toString' })).toEqual({})
    expect(sanitizeMessageStyleOverride({ align: 'center' })).toEqual({})
  })

  it('非对象入参返回空对象(盘上旧数据/导入文件不可信)', () => {
    expect(sanitizeMessageStyleOverride(null)).toEqual({})
    expect(sanitizeMessageStyleOverride('x')).toEqual({})
    expect(sanitizeMessageStyleOverride(undefined)).toEqual({})
  })

  it('幂等:再净化一次结果逐字相同', () => {
    const once = sanitizeMessageStyleOverride({ fontSize: 17, lineHeight: 'relaxed' })
    expect(sanitizeMessageStyleOverride(once)).toEqual(once)
  })
})

describe('useAppearanceScopeStore(写入语义)', () => {
  beforeEach(() => {
    useAppearanceScopeStore.setState({ messages: {}, order: [] })
  })

  it('合并式写入:后一次 patch 不丢前一次的字段', () => {
    const { setMessageStyle } = useAppearanceScopeStore.getState()
    setMessageStyle('m1', { fontSize: 18 })
    setMessageStyle('m1', { lineHeight: 'relaxed' })
    expect(useAppearanceScopeStore.getState().messages['m1']).toEqual({
      fontSize: 18,
      lineHeight: 'relaxed',
    })
  })

  it('把唯一字段调回 undefined 等价于没有覆盖:不留空对象占位', () => {
    const { setMessageStyle } = useAppearanceScopeStore.getState()
    setMessageStyle('m1', { fontSize: 18 })
    setMessageStyle('m1', { fontSize: undefined })
    expect(useAppearanceScopeStore.getState().messages['m1']).toBeUndefined()
    expect(useAppearanceScopeStore.getState().order).toEqual([])
  })

  it('按消息 id 隔离:改这条不动那条', () => {
    const { setMessageStyle } = useAppearanceScopeStore.getState()
    setMessageStyle('m1', { fontSize: 18 })
    setMessageStyle('m2', { fontSize: 13 })
    const { messages } = useAppearanceScopeStore.getState()
    expect(messages['m1']).toEqual({ fontSize: 18 })
    expect(messages['m2']).toEqual({ fontSize: 13 })
  })

  it('空 messageId 不写(防脏键)', () => {
    const { setMessageStyle } = useAppearanceScopeStore.getState()
    setMessageStyle('', { fontSize: 18 })
    expect(useAppearanceScopeStore.getState().messages).toEqual({})
  })

  it('clearMessageStyle 只清指定消息', () => {
    const { setMessageStyle, clearMessageStyle } = useAppearanceScopeStore.getState()
    setMessageStyle('m1', { fontSize: 18 })
    setMessageStyle('m2', { fontSize: 13 })
    clearMessageStyle('m1')
    expect(useAppearanceScopeStore.getState().messages['m1']).toBeUndefined()
    expect(useAppearanceScopeStore.getState().messages['m2']).toEqual({ fontSize: 13 })
  })

  it('clearAllMessageStyles 清空全部', () => {
    const { setMessageStyle, clearAllMessageStyles } = useAppearanceScopeStore.getState()
    setMessageStyle('m1', { fontSize: 18 })
    setMessageStyle('m2', { fontSize: 13 })
    clearAllMessageStyles()
    expect(useAppearanceScopeStore.getState().messages).toEqual({})
    expect(useAppearanceScopeStore.getState().order).toEqual([])
  })

  it('超过上限按写入顺序淘汰最旧的:localStorage 不会被无界撑大', () => {
    const { setMessageStyle } = useAppearanceScopeStore.getState()
    for (let i = 0; i < MESSAGE_OVERRIDE_LIMIT + 3; i += 1) {
      setMessageStyle(`m${i}`, { fontSize: 18 })
    }
    const { messages, order } = useAppearanceScopeStore.getState()
    expect(order.length).toBe(MESSAGE_OVERRIDE_LIMIT)
    expect(Object.keys(messages).length).toBe(MESSAGE_OVERRIDE_LIMIT)
    // 最早的三条被淘汰,最新的那条还在
    expect(messages['m0']).toBeUndefined()
    expect(messages[`m${MESSAGE_OVERRIDE_LIMIT + 2}`]).toEqual({ fontSize: 18 })
  })

  it('重写同一条消息不会重复占位(顺序表去重)', () => {
    const { setMessageStyle } = useAppearanceScopeStore.getState()
    setMessageStyle('m1', { fontSize: 18 })
    setMessageStyle('m1', { fontSize: 17 })
    expect(useAppearanceScopeStore.getState().order).toEqual(['m1'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
