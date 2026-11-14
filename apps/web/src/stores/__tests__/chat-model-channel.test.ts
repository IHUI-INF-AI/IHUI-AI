// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型通道标记(2026-11-12 立)。
 *
 * 判据面只钉三件事:
 * ① 默认 = platform —— 存量调用点不传第二参时必须零行为变化;
 * ② 显式传 'pool' 才切号池通道,切回平台模型时复位;
 * ③ 通道进持久化白名单(刷新后仍知道上次选的是号池模型)。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat'

describe('chat store 模型通道 currentModelChannel', () => {
  beforeEach(() => {
    useChatStore.setState({ currentModel: 'auto', currentModelChannel: 'platform' })
  })

  it('默认通道 = platform(号池能力不改变存量默认路径)', () => {
    expect(useChatStore.getState().currentModelChannel).toBe('platform')
  })

  it('setModel 不传第二参 ⇒ 回落 platform(存量调用点行为不变)', () => {
    useChatStore.getState().setModel('gpt-4o')
    expect(useChatStore.getState().currentModel).toBe('gpt-4o')
    expect(useChatStore.getState().currentModelChannel).toBe('platform')
  })

  it('setModel 传 pool ⇒ 模型与通道一起切到号池', () => {
    useChatStore.getState().setModel('doubao/doubao-seed', 'pool')
    expect(useChatStore.getState().currentModel).toBe('doubao/doubao-seed')
    expect(useChatStore.getState().currentModelChannel).toBe('pool')
  })

  it('从号池切回平台模型 ⇒ 通道复位 platform(不残留 pool)', () => {
    useChatStore.getState().setModel('x/y', 'pool')
    useChatStore.getState().setModel('gpt-4o')
    expect(useChatStore.getState().currentModelChannel).toBe('platform')
  })

  it('通道进持久化白名单(刷新后仍知道上次选的是号池模型)', async () => {
    const mod = await import('../chat')
    const storeApi = mod.useChatStore as unknown as {
      persist?: { getOptions?: () => { partialize?: (s: unknown) => Record<string, unknown> } }
    }
    const partialize = storeApi.persist?.getOptions?.()?.partialize
    if (!partialize) throw new Error('chat store 持久化必须存在 partialize')
    useChatStore.getState().setModel('x/y', 'pool')
    const persisted = partialize(useChatStore.getState())
    expect(persisted.currentModelChannel).toBe('pool')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
