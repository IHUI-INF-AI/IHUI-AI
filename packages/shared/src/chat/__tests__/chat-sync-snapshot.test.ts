// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快照传输面(路径 + 失败分型)的验收面。
 *
 * 四端共用同一份路径与同一套分型;这里只验"拼得对不对、错得对不对",不验网络。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  CHAT_SYNC_SNAPSHOT_ROUTE,
  chatSyncSnapshotPath,
  createChatSyncSnapshotFetcher,
} from '../chat-sync-snapshot'

describe('chatSyncSnapshotPath', () => {
  it('契约 §7.3 的端点路径,id 一律 encode', () => {
    expect(CHAT_SYNC_SNAPSHOT_ROUTE).toBe('/chat/conversations')
    expect(chatSyncSnapshotPath('c-1', 'm-1')).toBe(
      '/chat/conversations/c-1/messages/m-1/sync-snapshot',
    )
    expect(chatSyncSnapshotPath('a/b', 'x y')).toBe(
      '/chat/conversations/a%2Fb/messages/x%20y/sync-snapshot',
    )
  })
})

describe('createChatSyncSnapshotFetcher', () => {
  it('success ⇒ 原样交回 data', async () => {
    const data = { conversationId: 'c-1', messageId: 'm-1', rev: 2, role: 'assistant', content: 'x' }
    const request = vi.fn().mockResolvedValue({ success: true, data })
    const fetchSnapshot = createChatSyncSnapshotFetcher(request)

    await expect(fetchSnapshot('c-1', 'm-1')).resolves.toBe(data)
    expect(request).toHaveBeenCalledWith('/chat/conversations/c-1/messages/m-1/sync-snapshot')
  })

  it('404/409 ⇒ 抛出的 Error 带 status(内核据此摘坐标)', async () => {
    const request = vi.fn().mockResolvedValue({ success: false, status: 404, error: 'not found' })
    const fetchSnapshot = createChatSyncSnapshotFetcher(request)

    await expect(fetchSnapshot('c-1', 'm-1')).rejects.toMatchObject({ status: 404 })
  })

  it('失败但无 status ⇒ 不带 status(内核按瞬时重试,不定罪为死消息)', async () => {
    const request = vi.fn().mockResolvedValue({ success: false, error: '网络异常' })
    const fetchSnapshot = createChatSyncSnapshotFetcher(request)

    await expect(fetchSnapshot('c-1', 'm-1')).rejects.toSatisfy(
      (err: unknown) => err instanceof Error && !('status' in err),
    )
  })

  it('request 自身抛错 ⇒ 原样上抛(网络层归内核按瞬时处理)', async () => {
    const boom = new Error('socket hang up')
    const request = vi.fn().mockRejectedValue(boom)
    const fetchSnapshot = createChatSyncSnapshotFetcher(request)

    await expect(fetchSnapshot('c-1', 'm-1')).rejects.toBe(boom)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
