// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat'

/**
 * 差距③ mutateQueue(2026-10-30 立)store 层守门:reorderSteerNotices ——
 * 只重排 queued 条目(injected/存量原位不动)、order 不精确覆盖 ⇒ 放弃(不猜)、
 * 以旧 order 回滚可复原(乐观更新失败路径的依赖面)。
 */
describe('useChatStore — Steer 差距③ mutateQueue(乐观重排与回滚)', () => {
  beforeEach(() => {
    useChatStore.setState({ steerNoticesByMessageId: {}, streamingAssistantId: null })
  })

  it('order 精确覆盖 queued 集合 ⇒ queued 条目按新序落位,injected 条目原位不动', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    s.appendSteerNotice('msg-1', { text: '已注入', timestamp: 't0' })
    s.appendSteerNotice('msg-1', { text: 'B', phase: 'queued', queuedAt: 't2' })
    s.appendSteerNotice('msg-1', { text: 'C', phase: 'queued', queuedAt: 't3' })

    useChatStore.getState().reorderSteerNotices('msg-1', ['t3', 't1', 't2'])
    const notices = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    // queued 槽位序列(第 0/2/3 位)按新序填充;injected(第 1 位)不动
    expect(notices.map((n) => n.text)).toEqual(['C', '已注入', 'A', 'B'])
    expect(notices.map((n) => n.queuedAt)).toEqual(['t3', undefined, 't1', 't2'])
  })

  it('order 少/多/未知/重复 ⇒ 放弃(不猜,state 引用不变)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    s.appendSteerNotice('msg-1', { text: 'B', phase: 'queued', queuedAt: 't2' })
    const before = useChatStore.getState().steerNoticesByMessageId['msg-1']!

    for (const bad of [['t1'], ['t1', 't2', 't9'], ['t1', 't1']]) {
      useChatStore.getState().reorderSteerNotices('msg-1', bad)
      expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toBe(before)
    }
  })

  it('回滚:以旧 order 再调一次即复原(乐观更新被服务端 422 拒后的路径)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    s.appendSteerNotice('msg-1', { text: 'B', phase: 'queued', queuedAt: 't2' })
    s.appendSteerNotice('msg-1', { text: 'C', phase: 'queued', queuedAt: 't3' })

    useChatStore.getState().reorderSteerNotices('msg-1', ['t3', 't2', 't1'])
    expect(
      useChatStore.getState().steerNoticesByMessageId['msg-1']!.map((n) => n.queuedAt),
    ).toEqual(['t3', 't2', 't1'])
    useChatStore.getState().reorderSteerNotices('msg-1', ['t1', 't2', 't3'])
    expect(
      useChatStore.getState().steerNoticesByMessageId['msg-1']!.map((n) => n.queuedAt),
    ).toEqual(['t1', 't2', 't3'])
  })

  it('orderApplied 竞态豁免(比本地排队集合少)⇒ 放弃,留给 SSE injected 回执提升', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    s.appendSteerNotice('msg-1', { text: 'B', phase: 'queued', queuedAt: 't2' })
    const before = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    // 服务端已 drain t1(本地尚未收到 injected 帧)⇒ orderApplied 只含 t2
    useChatStore.getState().reorderSteerNotices('msg-1', ['t2'])
    expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toBe(before)
  })

  it('无排队条目/未知 messageId ⇒ 无操作不抛错', () => {
    useChatStore.getState().reorderSteerNotices('msg-none', ['t1'])
    useChatStore.getState().appendSteerNotice('msg-1', { text: '已注入', timestamp: 't0' })
    const before = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    useChatStore.getState().reorderSteerNotices('msg-1', ['t1'])
    expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toBe(before)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
