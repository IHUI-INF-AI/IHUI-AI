// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 批次 4(2026-11-06 立):变更集 / 投影四个读面的请求形状锁。
 *
 * 只钉 URL、method、参数与 body 形状(与 apps/api/src/routes/chat-changes.ts 逐字对齐):
 * 路径漂一寸,web/mobile/小程序三端会同时 404,而各端单测都会"照自己写的路径"假绿。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client.js', () => ({ fetchApi: vi.fn() }))

import { fetchApi } from '../client.js'
import {
  getChatProjection,
  getChatTurnChange,
  listChatTurnChanges,
  rewindChatTurnChange,
} from './chat-changes'

const mockedFetchApi = vi.mocked(fetchApi)
const CONV = '5f0c1a9e-3b2d-4c8e-9a1f-7d6e5c4b3a29'
const SET = '9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d'

beforeEach(() => {
  mockedFetchApi.mockReset()
  mockedFetchApi.mockResolvedValue({ success: true, data: {} as never, status: 200 })
})

describe('chat-changes 客户端', () => {
  it('listChatTurnChanges:GET /api/chat/changes,参数只带传了的键', async () => {
    await listChatTurnChanges({ conversationId: CONV, limit: 5 })
    expect(mockedFetchApi).toHaveBeenCalledWith('/api/chat/changes', {
      params: { conversationId: CONV, limit: 5 },
    })
  })

  it('listChatTurnChanges:turnId 存在时才上行', async () => {
    await listChatTurnChanges({ conversationId: CONV, turnId: 'msg-1' })
    expect(mockedFetchApi.mock.calls[0]![1]?.params).toEqual({
      conversationId: CONV,
      turnId: 'msg-1',
    })
  })

  it('getChatTurnChange:GET /api/chat/changes/:id', async () => {
    await getChatTurnChange(SET)
    expect(mockedFetchApi).toHaveBeenCalledWith(`/api/chat/changes/${SET}`)
  })

  it('rewindChatTurnChange:POST /rewind,body 为 JSON 字符串的 {dryRun}', async () => {
    await rewindChatTurnChange(SET, { dryRun: true })
    expect(mockedFetchApi).toHaveBeenCalledWith(`/api/chat/changes/${SET}/rewind`, {
      method: 'POST',
      body: JSON.stringify({ dryRun: true }),
    })
  })

  it('getChatProjection:GET /api/chat/changes/projections,messageId 走 query', async () => {
    await getChatProjection({ conversationId: CONV, messageId: 'client-msg-1' })
    expect(mockedFetchApi).toHaveBeenCalledWith('/api/chat/changes/projections', {
      params: { conversationId: CONV, messageId: 'client-msg-1' },
    })
  })
})
