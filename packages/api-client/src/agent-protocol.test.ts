// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L14 api-client 侧验收:业务请求必须携带 ACP 方法身份,且常量来自同一份表。
 * 三端(web/RN/小程序)都经 `@ihui/api-client` 调这些端点,测试钉住传输层。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', () => ({
  fetchApi: vi.fn(),
  fetchText: vi.fn(),
  fetchRaw: vi.fn(),
  fetchWithAuthRefresh: vi.fn(),
  aiServiceBaseUrl: 'http://ai-service.test',
}))

import { fetchApi } from './client.js'
import {
  ACP_METHODS,
  AGENT_PROTOCOL_METHOD_HEADER,
  AGENT_SDK_ERROR_CODES,
} from './agent-protocol.js'
import { createConversation, sendMessage } from './endpoints/chat.js'

const mockedFetchApi = vi.mocked(fetchApi)

beforeEach(() => {
  mockedFetchApi.mockReset()
  mockedFetchApi.mockResolvedValue({ success: true, data: {} })
})

describe('L14 api-client 协议头', () => {
  it('协议常量是单源真值', () => {
    expect(ACP_METHODS.sessionNew).toBe('session/new')
    expect(ACP_METHODS.sessionPrompt).toBe('session/prompt')
    expect(AGENT_SDK_ERROR_CODES).toEqual(['PROTOCOL', 'RPC', 'SPAWN', 'AGENT_EXIT', 'ABORTED'])
  })

  it('createConversation 携带 session/new', async () => {
    await createConversation({ title: 't' })
    const options = mockedFetchApi.mock.calls[0]?.[1]
    expect(options?.headers).toMatchObject({
      [AGENT_PROTOCOL_METHOD_HEADER]: ACP_METHODS.sessionNew,
    })
  })

  it('sendMessage 携带 session/prompt', async () => {
    await sendMessage('conv-1', 'hello')
    const options = mockedFetchApi.mock.calls[0]?.[1]
    expect(options?.headers).toMatchObject({
      [AGENT_PROTOCOL_METHOD_HEADER]: ACP_METHODS.sessionPrompt,
    })
  })
})
