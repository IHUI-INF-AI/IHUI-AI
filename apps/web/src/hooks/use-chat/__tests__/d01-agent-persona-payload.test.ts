// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D01(G-228)接线判据:选中专家必须真的进入请求体,而不只是界面记住一个 id。
// 两层各咬一处:
//  ① 宿主接线:send-message.ts 的 streamChat 调用点读 chat store 的 selectedAgentId
//     (静态读宿主源码,防"组件写了但发送链路没传"这一型);
//  ② 传输契约:streamChat 收到 personaId ⇒ body.agentId 承载它;已绑 agentId 时不被覆盖;
//     都没传 ⇒ body 不出现 agentId(旧行为逐字节不变)。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBaseUrl, setStreamBaseUrl, streamChat } from '@ihui/api-client'

import { useChatStore } from '@/stores/chat'

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

function hostCode(rel: string): string {
  const src = readFileSync(join(APP_ROOT, rel), 'utf8')
  // 去掉注释行再判,免得"注释里登记过"被读成已接线(本仓反复踩过这一型)
  return src
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
}

describe('D01 发送链路接线(宿主源码)', () => {
  it('首答 streamChat 调用点把 store.selectedAgentId 作为 personaId 传出', () => {
    const call = /personaId:\s*chatStore\.getState\(\)\.selectedAgentId/.test(
      hostCode('src/hooks/use-chat/send-message.ts'),
    )
    expect(call, 'send-message.ts 未把 selectedAgentId 传给 streamChat ⇒ 选了等于没选').toBe(true)
  })

  it('续答(chat/answer)同样带 personaId,不回落默认助手', () => {
    const call = /personaId:\s*chatStore\.getState\(\)\.selectedAgentId/.test(
      hostCode('src/hooks/use-chat/send-answer.ts'),
    )
    expect(call, 'send-answer.ts 未传 personaId ⇒ 用户回答 AI 提问后那一轮换回默认助手').toBe(true)
  })

  it('chat store 提供 selectedAgentId 状态与 setSelectedAgentId 动作', () => {
    expect(useChatStore.getState().selectedAgentId).toBeDefined
    expect(typeof useChatStore.getState().setSelectedAgentId).toBe('function')
  })
})

function sseResponse(): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: [DONE]\n'))
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: { get: () => null },
    text: async () => '',
  } as unknown as Response
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
}

type ChatOpts = Parameters<typeof streamChat>[0]

function baseOpts(overrides: Partial<ChatOpts> = {}): ChatOpts {
  return {
    model: 'test-model',
    messages: [{ role: 'user', content: 'hi' }],
    onDelta: () => {},
    ...overrides,
  }
}

describe('D01 streamChat 传输槽(personaId → body.agentId)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    fetchMock = vi.fn().mockResolvedValue(sseResponse())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('传 personaId ⇒ body.agentId 承载该 persona', async () => {
    await streamChat(baseOpts({ personaId: 'coder' }))
    expect(sentBody(fetchMock).agentId).toBe('coder')
  })

  it('同时传 agentId 与 personaId ⇒ 已绑 agent 优先', async () => {
    await streamChat(baseOpts({ agentId: 'subagent_1', personaId: 'coder' }))
    expect(sentBody(fetchMock).agentId).toBe('subagent_1')
  })

  it('都没传 ⇒ body 不出现 agentId(旧行为逐字节不变)', async () => {
    await streamChat(baseOpts())
    expect(Object.prototype.hasOwnProperty.call(sentBody(fetchMock), 'agentId')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
