// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 流式失败标记的跨端纯函数回归(G-152 余项):
// 判据要点是"失败轮必须与真回答可区分,且不销毁已产出的部分内容"。
import { describe, it, expect } from 'vitest'
import {
  markStreamError,
  applyStreamError,
  isErrorTurn,
  resendTargetText,
  type ErrorAwareMessage,
} from '../../src/chat/stream-error'

const asst = (content: string, extra: Record<string, unknown> = {}) =>
  ({ id: 'm1', role: 'assistant', content, ...extra }) as ErrorAwareMessage & {
    id: string
    aiCards?: string[]
  }

describe('markStreamError', () => {
  it('空正文写入错误文案并标 error', () => {
    const out = markStreamError(asst(''), '网络异常,请稍后重试')
    expect(out.error).toBe(true)
    expect(out.content).toBe('网络异常,请稍后重试')
  })

  it('已有部分内容不覆盖(断流时已看到的文字不得被销毁)', () => {
    const out = markStreamError(asst('已经生成的半段回答'), '网络异常')
    expect(out.error).toBe(true)
    expect(out.content).toBe('已经生成的半段回答')
  })

  it('保留消息上的其他字段(泛型不回退成最小结构)', () => {
    const out = markStreamError(asst('', { id: 'keep', aiCards: ['plan'] }), 'boom')
    expect(out.id).toBe('keep')
    expect(out.aiCards).toEqual(['plan'])
  })

  it('不改动入参对象', () => {
    const src = asst('')
    markStreamError(src, 'boom')
    expect(src.error).toBeUndefined()
    expect(src.content).toBe('')
  })
})

describe('applyStreamError', () => {
  it('只标最后一条 assistant,其他消息原样', () => {
    const msgs = [asst('a1'), { id: 'u1', role: 'user', content: '问题' }, asst('a2')]
    const out = applyStreamError(msgs, 'boom')
    expect(out.map((m) => isErrorTurn(m))).toEqual([false, false, true])
    expect(out[0]?.content).toBe('a1')
    expect(out[2]?.content).toBe('a2')
  })

  it('末条是 user 时不改任何东西(不得把错误标到用户消息上)', () => {
    const msgs = [asst(''), { id: 'u1', role: 'user', content: '问题' }]
    const out = applyStreamError(msgs, 'boom')
    expect(out.every((m) => !isErrorTurn(m))).toBe(true)
    expect(out[0]?.content).toBe('')
  })

  it('空数组返回空数组', () => {
    expect(applyStreamError([], 'boom')).toEqual([])
  })

  it('返回新数组,不改动入参', () => {
    const msgs = [asst('x')]
    const out = applyStreamError(msgs, 'boom')
    expect(out).not.toBe(msgs)
    expect(msgs[0]?.error).toBeUndefined()
  })
})

describe('isErrorTurn', () => {
  it('只有 error === true 算失败轮', () => {
    expect(isErrorTurn({ role: 'assistant', content: '', error: true })).toBe(true)
    expect(isErrorTurn({ role: 'assistant', content: '' })).toBe(false)
    expect(isErrorTurn({ role: 'assistant', content: '', error: false })).toBe(false)
    expect(isErrorTurn(undefined)).toBe(false)
    expect(isErrorTurn(null)).toBe(false)
  })
})

describe('resendTargetText', () => {
  it('取最后一条 user 文本(多条时不取第一条)', () => {
    const msgs = [
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '答一' },
      { role: 'user', content: '第二问' },
      { role: 'assistant', content: '', error: true },
    ]
    expect(resendTargetText(msgs)).toBe('第二问')
  })

  it('没有 user 消息返回 null(据此隐藏重发,而不是发空消息)', () => {
    expect(resendTargetText([{ role: 'assistant', content: 'hi' }])).toBeNull()
    expect(resendTargetText([])).toBeNull()
  })

  it('纯空白提问返回 null', () => {
    expect(resendTargetText([{ role: 'user', content: '   \n' }])).toBeNull()
  })
})

// D92(2026-09-24)接线:errorCode 必须能随失败轮落到消息上,且**不传即不写该字段**
// —— 各端(miniapp / mobile-rn)一律两参调用,新增第三参不得改变它们的行为。
describe('markStreamError 的 errorCode 透传(D92/D71②)', () => {
  it('传 errorCode → 落到消息上,供渲染侧查统一分类表', () => {
    const marked = markStreamError(asst(''), '后端超时', 'backend_timeout')
    expect(marked.error).toBe(true)
    expect(marked.errorCode).toBe('backend_timeout')
  })

  it('不传第三参 → 完全不写 errorCode 键(向后兼容,不得留 undefined 占位)', () => {
    const marked = markStreamError(asst(''), 'boom')
    expect(Object.prototype.hasOwnProperty.call(marked, 'errorCode')).toBe(false)
  })

  it('传空串 → 同样不写(空码进分类表只会污染回落判断)', () => {
    const marked = markStreamError(asst(''), 'boom', '')
    expect(Object.prototype.hasOwnProperty.call(marked, 'errorCode')).toBe(false)
  })

  it('已有内容不被错误文案销毁(原契约不得因新参数回归)', () => {
    const marked = markStreamError(asst('已产出一半'), 'x', 'RESOURCE_NOT_FOUND')
    expect(marked.content).toBe('已产出一半')
    expect(marked.errorCode).toBe('RESOURCE_NOT_FOUND')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
