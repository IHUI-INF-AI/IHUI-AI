// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距①(2026-10-30 立):发送准入回执帧(admission)的 api-client 分派测试。
 *
 * 链路:POST body 带 inputId 上行 → 服务端 SSE `admission` 帧 →
 *   routeLineByType('admission') → tryParseSendAdmission → onSendAdmissionReceipt 回调。
 *
 * 判据与 @ihui/shared chat/send-admission.ts 的 readSendAdmissionReceipt 同规则
 * (本包零运行时依赖做镜像,两侧喂同一批形状):
 *   ① 合法帧逐字段到达回调(inputId 逐字回显 + 可选字段按档位带上);
 *   ② 缺 inputId / 空串 inputId / 表外 disposition ⇒ 整帧丢弃(不猜档、不回调);
 *   ③ 可选字段类型错 ⇒ 整键缺席(不折成空串/0);
 *   ④ 本帧绝不落入正文 onDelta,也不混进 onError;非 JSON 行忽略不炸流;
 *   ⑤ 未注册回调 ⇒ 不解析、不炸流;
 *   ⑥ inputId 随 POST body 上行;未传时 body 不得出现 inputId 键。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl } from '../src/client.js'
import type { SendAdmissionReceipt } from '../src/client.js'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(`${chunk}\n`))
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

/**
 * done 帧**必须带 usage 对象**(同 stream-chat-hook-failure.test.ts 的实测坑:
 * 没有 done 帧的流会被判成"异常结束"并自动重连,mock body 已消费 ⇒ 用例挂超时)。
 */
const DONE_FRAME =
  'data: {"type":"done","model":"test-model","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}'

const ACCEPTED_FRAME =
  'data: {"type":"admission","inputId":"in-1","disposition":"accepted","messageId":"m-1"}'

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('streamChat admission 帧(差距①)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepted 帧 ⇒ 回调收到 inputId 逐字回显 + messageId', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([ACCEPTED_FRAME, '', DONE_FRAME, '', 'data: [DONE]', '']),
    )
    const onSendAdmissionReceipt = vi.fn()
    await streamChat({ ...baseOpts, inputId: 'in-1', onSendAdmissionReceipt })

    expect(onSendAdmissionReceipt).toHaveBeenCalledTimes(1)
    const receipt = onSendAdmissionReceipt.mock.calls[0][0] as SendAdmissionReceipt
    expect(receipt).toMatchObject({ inputId: 'in-1', disposition: 'accepted', messageId: 'm-1' })
    expect('queuedTurnId' in receipt).toBe(false)
    expect('reason' in receipt).toBe(false)
  })

  it('queued 帧带 queuedTurnId、rejected 帧带 reason ⇒ 档位专属字段各归各位', async () => {
    const queuedFrame =
      'data: {"type":"admission","inputId":"in-2","disposition":"queued","queuedTurnId":"q-9"}'
    const rejectedFrame =
      'data: {"type":"admission","inputId":"in-3","disposition":"rejected","reason":"rate-limited"}'
    fetchMock.mockResolvedValue(
      sseResponse([queuedFrame, '', rejectedFrame, '', DONE_FRAME, '', 'data: [DONE]', '']),
    )
    const onSendAdmissionReceipt = vi.fn()
    await streamChat({ ...baseOpts, onSendAdmissionReceipt })

    expect(onSendAdmissionReceipt).toHaveBeenCalledTimes(2)
    const [q, r] = onSendAdmissionReceipt.mock.calls.map((c) => c[0] as SendAdmissionReceipt)
    expect(q).toMatchObject({ inputId: 'in-2', disposition: 'queued', queuedTurnId: 'q-9' })
    expect('messageId' in q).toBe(false)
    expect(r).toMatchObject({ inputId: 'in-3', disposition: 'rejected', reason: 'rate-limited' })
  })

  it('畸形帧一律丢不猜档:缺 inputId / 空串 inputId / 表外 disposition / 缺 disposition', async () => {
    const badFrames = [
      'data: {"type":"admission","disposition":"accepted"}',
      'data: {"type":"admission","inputId":"","disposition":"accepted"}',
      'data: {"type":"admission","inputId":"in-1","disposition":"exploded"}',
      'data: {"type":"admission","inputId":"in-1"}',
    ]
    fetchMock.mockResolvedValue(sseResponse([...badFrames, '', DONE_FRAME, '', 'data: [DONE]', '']))
    const onSendAdmissionReceipt = vi.fn()
    await streamChat({ ...baseOpts, onSendAdmissionReceipt })
    expect(onSendAdmissionReceipt).not.toHaveBeenCalled()
  })

  it('可选字段类型错 ⇒ 整键缺席(messageId:123 不折成字符串)', async () => {
    const frame =
      'data: {"type":"admission","inputId":"in-1","disposition":"accepted","messageId":123}'
    fetchMock.mockResolvedValue(sseResponse([frame, '', DONE_FRAME, '', 'data: [DONE]', '']))
    const onSendAdmissionReceipt = vi.fn()
    await streamChat({ ...baseOpts, onSendAdmissionReceipt })

    expect(onSendAdmissionReceipt).toHaveBeenCalledTimes(1)
    const receipt = onSendAdmissionReceipt.mock.calls[0][0] as SendAdmissionReceipt
    expect(receipt.inputId).toBe('in-1')
    expect('messageId' in receipt).toBe(false)
  })

  it('本帧绝不落入正文 onDelta,也不混进 onError', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([ACCEPTED_FRAME, '', DONE_FRAME, '', 'data: [DONE]', '']),
    )
    const onDelta = vi.fn()
    const onError = vi.fn()
    const onSendAdmissionReceipt = vi.fn()
    await streamChat({ ...baseOpts, onDelta, onError, onSendAdmissionReceipt })

    expect(onSendAdmissionReceipt).toHaveBeenCalledTimes(1)
    expect(onDelta).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('非 JSON 行不触发回执、不炸流(纯文本 delta 兼容是既有行为,本票不改变)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        ACCEPTED_FRAME,
        '',
        'data: not-json-at-all',
        '',
        DONE_FRAME,
        '',
        'data: [DONE]',
        '',
      ]),
    )
    const onSendAdmissionReceipt = vi.fn()
    const onDone = vi.fn()
    await streamChat({ ...baseOpts, onSendAdmissionReceipt, onDone })

    // 非 JSON 行不产生第二张回执,流也正常收尾
    expect(onSendAdmissionReceipt).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalled()
  })

  it('未注册 onSendAdmissionReceipt ⇒ 不解析(与其余 per-field 同口径),且不炸流', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([ACCEPTED_FRAME, '', DONE_FRAME, '', 'data: [DONE]', '']),
    )
    const onDone = vi.fn()
    await expect(streamChat({ ...baseOpts, onDone })).resolves.toBeUndefined()
    expect(onDone).toHaveBeenCalled()
  })

  it('inputId 随 POST body 上行;未传时 body 不得出现 inputId 键', async () => {
    fetchMock.mockResolvedValue(sseResponse([DONE_FRAME, '', 'data: [DONE]', '']))
    await streamChat({ ...baseOpts, inputId: 'in-42' })
    const withId = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>
    expect(withId.inputId).toBe('in-42')

    fetchMock.mockResolvedValue(sseResponse([DONE_FRAME, '', 'data: [DONE]', '']))
    await streamChat({ ...baseOpts })
    const withoutId = JSON.parse(String(fetchMock.mock.calls[1][1].body)) as Record<string, unknown>
    expect('inputId' in withoutId).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
