// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  performAction: vi.fn(),
  importMessages: vi.fn(),
  assertAccountForUser: vi.fn(),
}))

vi.mock('../wechat-hub/manager.js', () => ({
  wechatHubManager: { performAction: mocks.performAction },
}))
vi.mock('../wechat-hub/import.js', () => ({
  importWechatMessages: mocks.importMessages,
}))
vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: mocks.assertAccountForUser,
}))

import { syncHistoryFromBridge } from '../wechat-hub/history-sync'

describe('syncHistoryFromBridge', () => {
  it('桥返回 accepted 时把 messages 交给导入服务，并带上 db/table', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: true,
      status: 'accepted',
      data: {
        messages: [{ platformChatId: 'wxid_a', content: 'hi' }],
        db: 'MSG0.db',
        table: 'MSG',
      },
      reason: null,
    })
    mocks.importMessages.mockResolvedValue({
      imported: 1,
      skipped: 0,
      conversations: 1,
      errors: [],
    })

    const result = await syncHistoryFromBridge('user-1', 'account-1')

    expect(mocks.performAction).toHaveBeenCalledWith('user-1', 'account-1', 'history.fetch', {
      limit: 500,
    })
    expect(mocks.importMessages).toHaveBeenCalledWith('user-1', 'account-1', {
      messages: [{ platformChatId: 'wxid_a', content: 'hi' }],
    })
    expect(result).toMatchObject({
      fetched: 1,
      imported: 1,
      skipped: 0,
      conversations: 1,
      status: 'accepted',
      source: { db: 'MSG0.db', table: 'MSG' },
    })
  })

  it('桥不支持时返回 unsupported + reason，且不调用导入', async () => {
    mocks.assertAccountForUser.mockResolvedValue(undefined)
    mocks.performAction.mockResolvedValue({
      ok: false,
      status: 'unsupported',
      data: {},
      reason: '当前后端不支持该动作',
    })
    mocks.importMessages.mockClear()

    const result = await syncHistoryFromBridge('user-1', 'account-1', { limit: 10 })

    expect(result).toMatchObject({
      fetched: 0,
      imported: 0,
      status: 'unsupported',
      reason: '当前后端不支持该动作',
    })
    expect(mocks.importMessages).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
