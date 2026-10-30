// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat'

/**
 * 差距③(2026-10-30 立)store 层守门:SteerNotice queued/injected 两相 +
 * injected 回执就地提升(不重复追加)/ queued 幂等 / 撤回两动作(remove/mark)。
 */
describe('useChatStore — Steer 差距③(queued/injected 与撤回回执落地)', () => {
  beforeEach(() => {
    useChatStore.setState({ steerNoticesByMessageId: {}, streamingAssistantId: null })
  })

  it('同文本 injected 回执就地提升乐观 queued 条目(不重复追加,timestamp 落 queuedAt)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', {
      text: '换一个思路',
      phase: 'queued',
      queuedAt: '2026-10-30T10:00:00Z',
    })
    useChatStore.getState().appendSteerNotice('msg-1', {
      text: '换一个思路',
      timestamp: '2026-10-30T10:00:00Z',
    })
    const notices = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      text: '换一个思路',
      phase: 'injected',
      timestamp: '2026-10-30T10:00:00Z',
      queuedAt: '2026-10-30T10:00:00Z',
    })
  })

  it('queuedAt 匹配优先于文本(回显原文与本地 trim 差异不影响提升)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    useChatStore.getState().appendSteerNotice('msg-1', { text: 'A(服务端回显)', timestamp: 't1' })
    const notices = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    expect(notices).toHaveLength(1)
    expect(notices[0]!.phase).toBe('injected')
    expect(notices[0]!.text).toBe('A(服务端回显)')
  })

  it('无匹配 queued 时 injected 走既有 append 路径(存量 SSE/历史回放兼容)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A' })
    s.appendSteerNotice('msg-1', { text: 'B', timestamp: 't2' })
    const notices = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    expect(notices).toHaveLength(2)
    expect(notices[0]!.phase).toBeUndefined()
  })

  it('queued 入队幂等(同 queuedAt 重复写丢弃)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toHaveLength(1)
  })

  it('removeSteerNotice 只移除同 queuedAt 的 queued 条目(injected 不动)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: '排队项', phase: 'queued', queuedAt: 't1' })
    s.appendSteerNotice('msg-1', { text: '已注入项', timestamp: 't2' })
    useChatStore.getState().removeSteerNotice('msg-1', 't1')
    const notices = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    expect(notices).toHaveLength(1)
    expect(notices[0]!.text).toBe('已注入项')
  })

  it('markSteerInjected 把同 queuedAt 的 queued 条目提升为 injected(already_injected 回执)', () => {
    const s = useChatStore.getState()
    s.appendSteerNotice('msg-1', { text: 'A', phase: 'queued', queuedAt: 't1' })
    useChatStore.getState().markSteerInjected('msg-1', 't1')
    const notices = useChatStore.getState().steerNoticesByMessageId['msg-1']!
    expect(notices[0]!.phase).toBe('injected')
    expect(notices[0]!.timestamp).toBe('t1')
    // 幂等:再次 mark(条目已非 queued)无副作用
    useChatStore.getState().markSteerInjected('msg-1', 't1')
    expect(useChatStore.getState().steerNoticesByMessageId['msg-1']).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
