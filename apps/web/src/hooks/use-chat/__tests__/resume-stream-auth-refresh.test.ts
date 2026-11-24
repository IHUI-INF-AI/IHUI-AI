// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 断点续接(POST /api/chat/resume)的"access 过期"分档装车证明。
 *
 * 旧链路是**单次尝试**:401 直接 notifyResumeFailed ⇒ 刷新页面后必踩(access 15 分钟)。
 * 三条臂:
 *  ① 401 ⇒ 续期一次,并用新凭据重放一次,续接内容照常写回,不报失败;
 *  ② 续期失败 ⇒ 只发一次请求、给出可见失败(toast + 「重新生成」),不无限重放;
 *  ③ 对照臂:200 ⇒ 一个多余续期请求都不发。
 *
 * 摘掉新判据即翻红:删掉 resume-stream.ts 里 `if (resp.status === 401)` 那一块 ⇒ ① 红
 * (只剩一次请求、内容没续上),② 的 toast 文案仍会出但臂 ① 已断。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatStore } from '@/stores/chat'
import { resumePendingMessage } from '../resume-stream'
import { toast } from '@/components/common'

const refreshMock = vi.hoisted(() => vi.fn<() => Promise<string | null>>())
/** 可变的"当前凭据":续期成功即改写,重放那一跳才会带上新值(与真实 store 同形) */
const cred = vi.hoisted(() => ({ token: 'expired-token' }))

vi.mock('@ihui/api-client', () => ({
  getModelContextCapacity: () => 128_000,
  refreshAccessTokenOnce: refreshMock,
  parseStreamLine: (line: string): string | null => {
    if (!line.startsWith('data:')) return null
    try {
      const json = JSON.parse(line.slice(5).trim()) as { content?: unknown }
      return typeof json.content === 'string' ? json.content : null
    } catch {
      return null
    }
  },
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({
    success: true,
    data: { exists: false, completed: false, content: '', updatedAt: null },
  })),
  getToken: vi.fn(() => cred.token),
  getStreamBaseUrl: vi.fn(() => ''),
  isAbortError: (e: unknown) => e instanceof Error && e.name === 'AbortError',
}))

vi.mock('@/components/common', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

const LABELS = { title: '续接失败', action: '重新生成', noProgress: '无新内容' }

const enc = new TextEncoder()

function sseResponse(lines: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const l of lines) controller.enqueue(enc.encode(l + '\n'))
        controller.close()
      },
    }),
    { status: 200 },
  )
}

function seedStore(): void {
  useChatStore.setState({
    conversationId: 'conv-1',
    messages: [
      { id: 'u1', role: 'user', content: '问题', createdAt: 1 },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '已生成的前半段',
        createdAt: 2,
        streamCompleted: false,
      },
    ],
    isStreaming: false,
  })
}

const PENDING = { conversationId: 'conv-1', messageId: 'assistant-1', content: '已生成的前半段' }

/** 记每次请求的 Authorization 头(顺序即发起顺序)。 */
function stubFetch(...statuses: Array<() => Response>) {
  const auths: Array<string | undefined> = []
  let i = 0
  global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    auths.push(headers['Authorization'])
    const make = statuses[Math.min(i, statuses.length - 1)]!
    i += 1
    return make()
  }) as never
  return auths
}

beforeEach(() => {
  vi.clearAllMocks()
  refreshMock.mockReset()
  cred.token = 'expired-token'
  seedStore()
})

describe('断点续接:401 续期一次并重放一次', () => {
  it('401 ⇒ 续期一次、重放带新凭据、内容照常续上且不报失败', async () => {
    refreshMock.mockImplementation(async () => {
      cred.token = 'fresh-token'
      return 'fresh-token'
    })
    const auths = stubFetch(
      () => new Response('', { status: 401 }),
      () => sseResponse(['data: {"content":"后半段"}']),
    )

    await resumePendingMessage(PENDING, { signal: new AbortController().signal, labels: LABELS })

    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(auths).toEqual(['Bearer expired-token', 'Bearer fresh-token'])
    const target = useChatStore.getState().messages.find((m) => m.id === 'assistant-1')
    expect(target?.content).toBe('已生成的前半段后半段')
    expect(target?.streamCompleted).toBe(true)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('续期失败 ⇒ 只发一次请求,并给出可见失败(不静默、不无限重放)', async () => {
    refreshMock.mockResolvedValue(null)
    const auths = stubFetch(() => new Response('', { status: 401 }))

    await resumePendingMessage(PENDING, { signal: new AbortController().signal, labels: LABELS })

    expect(auths).toHaveLength(1)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls[0])).toContain('401')
    // 一个字节都没续上 ⇒ 正文必须还是原样(不得把失败伪装成"续到了一半")
    expect(useChatStore.getState().messages.find((m) => m.id === 'assistant-1')?.content).toBe(
      '已生成的前半段',
    )
  })

  it('重放后仍 401 ⇒ 也只重放一次,然后报可见失败', async () => {
    refreshMock.mockResolvedValue('fresh-token')
    const auths = stubFetch(() => new Response('', { status: 401 }))

    await resumePendingMessage(PENDING, { signal: new AbortController().signal, labels: LABELS })

    expect(auths).toHaveLength(2)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('对照臂:未过期(200)⇒ 一个续期请求都不发', async () => {
    const auths = stubFetch(() => sseResponse(['data: {"content":"后半段"}']))

    await resumePendingMessage(PENDING, { signal: new AbortController().signal, labels: LABELS })

    expect(refreshMock).not.toHaveBeenCalled()
    expect(auths).toHaveLength(1)
    expect(toast.error).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
