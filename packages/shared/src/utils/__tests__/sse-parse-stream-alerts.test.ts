// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D155 告警三帧在共享解析面的认领锁(2026-11-13 立)。
 *
 * 为什么这一条必须单独钉:这三帧的失效是**安静的** —— 不认领就一路走到函数末尾
 * `return null`,后端明明发了帧,端上什么也没有,日志里也没有异常。本仓已因同一
 * 失效型吃过三次(D113 tool-delta / D151 terminal_interaction / D152 goal_updated)。
 *
 * 两条断言缺一不可:
 *   ① 「认领」——帧进来要能变成 `type: 'deprecation-notice'` 的事件;
 *   ② 「不滑兜底」——帧名认出来但载荷坏(message 空)时,必须 null,
 *      **不能**被下面 `typeof json.content === 'string'` 那条泛化兜底喷成正文增量。
 *      这一条是真出过事故的形状:上游多塞一个 content 字段,整条告警就变成
 *      聊天正文里一段没人看得懂的文本。
 */

import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../sse-parse'

const parse = (payload: unknown) => {
  const { events } = parseSSEChunk(`data: ${JSON.stringify(payload)}\n`)
  return events[0] ?? null
}

describe('三档告警帧被共享解析面认领', () => {
  it('deprecation-notice 变成告警事件', () => {
    const evt = parse({
      type: 'deprecation-notice',
      severity: 'warning',
      message: '当前模型 a/b 将于 7 天后停止服务',
      capability: 'a/b',
      sunsetAt: '2026-11-20',
    })
    expect(evt?.type).toBe('deprecation-notice')
    expect(evt?.streamAlert).toEqual({
      type: 'deprecation-notice',
      severity: 'warning',
      message: '当前模型 a/b 将于 7 天后停止服务',
      detail: { capability: 'a/b', sunsetAt: '2026-11-20' },
    })
  })

  it('config-warning 变成告警事件', () => {
    const evt = parse({ type: 'config-warning', message: '配置被覆盖', field: 'baseUrl' })
    expect(evt?.type).toBe('config-warning')
    expect(evt?.streamAlert?.detail).toEqual({ field: 'baseUrl' })
  })

  it('guardian-warning 变成告警事件', () => {
    const evt = parse({ type: 'guardian-warning', message: '未复核', category: 'x' })
    expect(evt?.type).toBe('guardian-warning')
  })

  it('severity 表外回退 warning(不丢帧)', () => {
    const evt = parse({ type: 'config-warning', message: 'x', severity: 'weird' })
    expect(evt?.streamAlert?.severity).toBe('warning')
  })
})

describe('坏告警帧不得滑到泛化兜底', () => {
  it('message 为空且带 content ⇒ 不变成正文增量', () => {
    // 这是最危险的一格:若没在兜底前拦下,用户会在聊天正文里看到
    // {"type":"service-warning"...} 里的 content 文本,而真正的告警消失了。
    const evt = parse({ type: 'deprecation-notice', message: '', content: 'leaked text' })
    expect(evt).toBeNull()
  })

  it('无 message 且带 delta ⇒ 不变成正文增量', () => {
    const evt = parse({ type: 'config-warning', delta: 'leaked' })
    expect(evt).toBeNull()
  })

  it('无 message 且带 text ⇒ 不变成正文增量', () => {
    const evt = parse({ type: 'guardian-warning', text: 'leaked' })
    expect(evt).toBeNull()
  })
})

describe('不影响相邻帧的既有行为', () => {
  it('budget 帧照旧', () => {
    const evt = parse({ type: 'budget', level: 'warning', percent: 80 })
    expect(evt?.type).toBe('budget')
  })

  it('普通 chunk 照旧', () => {
    const evt = parse({ content: 'hello' })
    expect(evt?.type).toBe('chunk')
    expect(evt?.content).toBe('hello')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
