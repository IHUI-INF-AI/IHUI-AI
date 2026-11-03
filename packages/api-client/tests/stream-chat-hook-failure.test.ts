// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-87 补链(2026-10-29):hook 执行失败帧的**端到端链路**测试。
 *
 * 这条链此前整段缺失(判定层 2026-09-24 交付后零数据源):
 *   ai-service 广播 → SSE `hook-failed` 帧 → api-client 解析 → onHookFailure 回调
 *   → store 落 `meta.hookFailures` → 渲染层 `hookFailureRecordsFromMeta` 读出。
 *
 * 同一进程跑完整条链(不 mock 中间层),断言:
 *   ① 合法帧逐字段到达回调(含三个可选证据字段);
 *   ② 三个可选字段**缺席时整键不出现**(不是 null、不是 0);
 *   ③ 畸形帧被丢弃而不是猜档位(state 表外 / 缺 hookName / 缺 hookEvent);
 *   ④ 本帧**绝不**落入正文 onDelta,也**不**混进 onError;
 *   ⑤ 未注册回调时不解析、不炸流。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl } from '../src/client.js'
import type { HookFailureEvent } from '../src/client.js'

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
 * done 帧**必须带 usage 对象**。
 *
 * 两处实测坑(第一版都踩了,表现为 5000ms 超时):
 *   ① `routeLineByType` 的 `json.usage ⇒ 'usage'` 判据会先截走 done 帧 —— 不带 usage 时
 *      它落到 fallback 链,而 done 的处理在 runner 侧另有判据;
 *   ② 没有 done 帧的流会被判成"异常结束"并自动重连,而 mock 的 Response body 已被消费,
 *      第二个 Response 永远不产出字节 ⇒ 用例挂到超时。
 * 既有同类测试(stream-chat-finish-reason / stream-chat-usage)的 done 帧也都带 usage。
 */
const DONE_FRAME =
  'data: {"type":"done","model":"test-model","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}'

/** "六字段全齐"的失败帧(script 非零退出那一档)。 */
const FULL_FRAME =
  'data: {"type":"hook-failed","id":"hk-1::2026-10-29T10:00:00Z::tool.after","hookId":"hk-1",' +
  '"state":"failed","hookName":"lint 检查","hookEvent":"tool.after",' +
  '"durationMs":1234,"failedAt":"2026-10-29T10:00:00Z",' +
  '"error":"script 退出码 2: 有 3 处 lint 错误",' +
  '"actionType":"script","command":"npm run lint","stderr":"3 problems",' +
  '"exitCode":2,"messageId":"m-1"}'

/** 超时那一档:**没有** exitCode / stderr(被杀进程无退出码)。 */
const TIMEOUT_FRAME =
  'data: {"type":"hook-failed","id":"hk-2::2026-10-29T11:00:00Z::tool.before","hookId":"hk-2",' +
  '"state":"timedOut","hookName":"长任务","hookEvent":"tool.before",' +
  '"durationMs":10000,"failedAt":"2026-10-29T11:00:00Z",' +
  '"error":"script 超时(10s)","actionType":"script","command":"sleep 60"}'

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('streamChat hook-failed 帧(G-87)', () => {
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

  it('六字段全齐的帧 ⇒ 回调逐字段原样收到', async () => {
    fetchMock.mockResolvedValue(sseResponse([FULL_FRAME, '', DONE_FRAME, '', 'data: [DONE]', '']))
    const onHookFailure = vi.fn()
    await streamChat({ ...baseOpts, onHookFailure })

    expect(onHookFailure).toHaveBeenCalledTimes(1)
    expect(onHookFailure.mock.calls[0][0] as HookFailureEvent).toMatchObject({
      hookId: 'hk-1',
      hookName: 'lint 检查',
      hookEvent: 'tool.after',
      state: 'failed',
      durationMs: 1234,
      failedAt: '2026-10-29T10:00:00Z',
      command: 'npm run lint',
      stderr: '3 problems',
      exitCode: 2,
      actionType: 'script',
      messageId: 'm-1',
    })
  })

  it('超时帧 ⇒ 三个可选证据字段**整键缺席**(不是 null、不是 0)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([TIMEOUT_FRAME, '', DONE_FRAME, '', 'data: [DONE]', '']),
    )
    const onHookFailure = vi.fn()
    await streamChat({ ...baseOpts, onHookFailure })

    const evt = onHookFailure.mock.calls[0][0] as HookFailureEvent
    expect(evt.state).toBe('timedOut')
    // 关键:这三格"没有"与"是 0 / 空串"必须可分 —— 用 in 判键是否存在
    expect('exitCode' in evt).toBe(false)
    expect('stderr' in evt).toBe(false)
    // command 在配置里,与执行成败无关,仍能取到
    expect(evt.command).toBe('sleep 60')
  })

  it('exitCode:0 是"确实以 0 退出"的肯定结论,不得被折成缺席', async () => {
    const zeroFrame =
      'data: {"type":"hook-failed","state":"failed","hookName":"h","hookEvent":"tool.before",' +
      '"durationMs":1,"failedAt":"2026-10-29T12:00:00Z","exitCode":0}'
    fetchMock.mockResolvedValue(sseResponse([zeroFrame, '', DONE_FRAME, '', 'data: [DONE]', '']))
    const onHookFailure = vi.fn()
    await streamChat({ ...baseOpts, onHookFailure })
    const evt = onHookFailure.mock.calls[0][0] as HookFailureEvent
    expect('exitCode' in evt).toBe(true)
    expect(evt.exitCode).toBe(0)
  })

  it('畸形帧一律丢:state 表外 / 缺 hookName / 缺 hookEvent / 非 JSON', async () => {
    const badFrames = [
      'data: {"type":"hook-failed","state":"exploded","hookName":"h","hookEvent":"e","durationMs":1,"failedAt":"t"}',
      'data: {"type":"hook-failed","state":"failed","hookEvent":"e","durationMs":1,"failedAt":"t"}',
      'data: {"type":"hook-failed","state":"failed","hookName":"h","durationMs":1,"failedAt":"t"}',
      'data: not-json-at-all',
    ]
    fetchMock.mockResolvedValue(sseResponse([...badFrames, '', DONE_FRAME, '', 'data: [DONE]', '']))
    const onHookFailure = vi.fn()
    await streamChat({ ...baseOpts, onHookFailure })
    expect(onHookFailure).not.toHaveBeenCalled()
  })

  it('本帧绝不落入正文 onDelta,也不混进 onError', async () => {
    fetchMock.mockResolvedValue(sseResponse([FULL_FRAME, '', DONE_FRAME, '', 'data: [DONE]', '']))
    const onDelta = vi.fn()
    const onError = vi.fn()
    const onHookFailure = vi.fn()
    await streamChat({ ...baseOpts, onDelta, onError, onHookFailure })

    expect(onHookFailure).toHaveBeenCalledTimes(1)
    expect(onDelta).not.toHaveBeenCalled()
    // 本票的核心分工:hook 失败 ≠ 回答失败
    expect(onError).not.toHaveBeenCalled()
  })

  it('未注册 onHookFailure ⇒ 不解析(与其余 per-field 同口径),且不炸流', async () => {
    fetchMock.mockResolvedValue(sseResponse([FULL_FRAME, '', DONE_FRAME, '', 'data: [DONE]', '']))
    const onDone = vi.fn()
    await expect(streamChat({ ...baseOpts, onDone })).resolves.toBeUndefined()
    expect(onDone).toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
