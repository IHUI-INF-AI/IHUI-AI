// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { GUEST_TRANSPORTS, createGuestBridge } from '../src/guest-bridge'

function envelope(over: Record<string, unknown> = {}) {
  return {
    type: 'ihui.guest/invoke',
    requestId: 'r1',
    channel: 'conversations',
    context: { token: 'keep-me' },
    args: { q: 'a' },
    ...over,
  }
}

describe('guest invoke envelope', () => {
  it('四种传输用同一份准入，context 原样通过', () => {
    for (const transport of GUEST_TRANSPORTS) {
      const bridge = createGuestBridge('web')
      const plan = bridge.invoke(envelope(), { transport, seenSeq: 1 })
      expect(plan).toMatchObject({
        disposition: 'admit',
        transport,
        context: { token: 'keep-me' },
      })
    }
  })

  it('网页宿主叫 paths 被拒绝，结果里没有 context', () => {
    const plan = createGuestBridge('web').invoke(envelope({ channel: 'paths' }), {
      transport: 'window',
      seenSeq: 1,
    })
    expect(plan).toEqual({ disposition: 'refuse', reason: 'channel-denied', requestId: 'r1' })
  })

  it('桌面直连可以跳过节序，并且带上 paths', () => {
    const plan = createGuestBridge('desktop').invoke(envelope({ channel: 'paths' }), {
      transport: 'websocket',
      direct: true,
      seenSeq: 9,
    })
    expect(plan).toMatchObject({
      disposition: 'admit',
      channel: 'paths',
      context: { token: 'keep-me' },
    })
  })

  it('没量到宿主时不放行', () => {
    const plan = createGuestBridge(null).invoke(envelope(), { transport: 'window', seenSeq: 1 })
    expect(plan).toEqual({ disposition: 'unjudged', reason: 'host-unmeasured' })
  })

  it('销毁之后直连也不能再调用，节序不会被直连推进', () => {
    const bridge = createGuestBridge('web')
    bridge.dispose()
    const denied = bridge.invoke(envelope(), { transport: 'message-port', direct: true })
    expect(denied).toEqual({ disposition: 'refuse', reason: 'disposed', requestId: 'r1' })
  })

  it('节序不对不推进，下一拍仍接受原来的序号', () => {
    const bridge = createGuestBridge('web')
    const skipped = bridge.invoke(envelope(), { transport: 'service-worker', seenSeq: 2 })
    expect(skipped).toEqual({ disposition: 'refuse', reason: 'out-of-order', requestId: 'r1' })
    const next = bridge.invoke(envelope({ requestId: 'r2' }), {
      transport: 'service-worker',
      seenSeq: 1,
    })
    expect(next).toMatchObject({ disposition: 'admit', requestId: 'r2' })
  })

  it('信封没带 context 槽就拒绝，不补一个空对象', () => {
    const raw = envelope()
    delete (raw as { context?: unknown }).context
    const plan = createGuestBridge('web').invoke(raw, { transport: 'window', seenSeq: 1 })
    expect(plan).toEqual({ disposition: 'refuse', reason: 'context-absent', requestId: 'r1' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
