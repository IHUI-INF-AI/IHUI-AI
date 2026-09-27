// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 暂停 / 继续两个客户端出口的契约测试(V3 #65)。
 *
 * 钉住四件在端内看不见、只在响应面上才成立的事:
 * ① 路径寻址:`POST /agents/{session_id}/pause` 与 `/resume`(不是 `/agent-runtime/*`,
 *    也不是历史上那个 FastAPI 面上根本不存在、恒 404 的 `/agents/sessions/{sid}/resume`);
 * ② 剥壳结论落到调用方手上:`changed` / `checkpoint_stage` 两格不得在信封层被吞掉 ——
 *    前端的"运行中可暂停 / 已暂停可继续"两态**直接读 `changed`**,端内没有第二套状态机;
 * ③ 失败格可分辨:`/agents/{sid}/pause` 用 HTTP 状态码 + `detail` 字典带结论
 *    (403/404/409/503),`errorCode` 必须原样带回来,不得折成一句"失败了";
 * ④ **续跑只按会话**:调用方手里即使有 `checkpoint_id`,出口也只收 `sessionId`,
 *    且打到 `/agents/{sid}/resume` 而不是 `/agents/execute/resume` —— 实测一次暂停会落
 *    两个检查点(`eager` + 轮次边界那枚),拿 eager 那枚去 execute/resume 会
 *    **重跑一轮已经执行过的工具调用**。这一条由末例钉死。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pauseAgentSession,
  resumeAgentSession,
} from '../src/endpoints/agent-runtime.js'
import type {
  AgentSessionPauseResult,
  AgentResumeResult,
} from '../src/endpoints/agent-runtime.js'

/** ai-service 直返裸 JSON 时(fetchOnce 的 code===undefined 分支)整体就是 data。 */
function bareJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
    body: null,
  } as unknown as Response
}

/** `{code,message,data}` 信封(fetchOnce 会剥到 data;出口侧再兜一次,两处都得对)。 */
function envelopeResponse(data: unknown, status = 200): Response {
  return bareJsonResponse({ code: 0, message: 'ok', data }, status)
}

/** FastAPI 形态②:`{"detail":{"errorCode","message"}}` —— 多结论端点的标准写法。 */
function detailResponse(errorCode: string, message: string, status: number): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ detail: { errorCode, message } }),
    text: async () => JSON.stringify({ detail: { errorCode, message } }),
    body: null,
  } as unknown as Response
}

function firstCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; opts: RequestInit } {
  const call = fetchMock.mock.calls[0]!
  return { url: String(call[0]), opts: call[1] as RequestInit }
}

describe('pauseAgentSession / resumeAgentSession — 按会话暂停与续跑', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('pause 打 POST /agents/{sid}/pause,无 reason 时发空对象(服务端模型无默认值)', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({
        session_id: 'sess_1',
        outcome: 'paused',
        changed: true,
        checkpoint_id: 'ckpt_eager_1',
        checkpoint_stage: 'eager',
      }),
    )

    const res = await pauseAgentSession('sess_1')
    expect(res.success).toBe(true)
    const { url, opts } = firstCall(fetchMock)
    expect(url).toContain('/api/agents/sess_1/pause')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(String(opts.body))).toEqual({})
  })

  it('pause 带 reason 时只多一个 reason 格,不改路径也不改身份来源', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({
        session_id: 'sess_2',
        outcome: 'paused',
        changed: true,
        checkpoint_id: null,
        checkpoint_stage: 'recorded',
      }),
    )

    await pauseAgentSession('sess_2', '用户点了暂停')
    const { url, opts } = firstCall(fetchMock)
    expect(url).toContain('/api/agents/sess_2/pause')
    expect(JSON.parse(String(opts.body))).toEqual({ reason: '用户点了暂停' })
  })

  it('session id 含保留字符时必须被编码,不得拼出另一条路由', async () => {
    fetchMock.mockResolvedValue(envelopeResponse({ session_id: 'a/b', outcome: 'paused' }))
    await pauseAgentSession('a/b')
    const { url } = firstCall(fetchMock)
    expect(url).toContain('/api/agents/a%2Fb/pause')
    expect(url).not.toContain('/api/agents/a/b/pause')
  })

  it('成功格必须落到 data 里:changed / checkpoint_stage 不得被信封层吞掉', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({
        session_id: 'sess_3',
        outcome: 'paused',
        changed: true,
        checkpoint_id: 'ckpt_7',
        checkpoint_stage: 'eager',
      }),
    )

    const res = await pauseAgentSession('sess_3')
    if (!res.success) throw new Error(`期望成功分支,实得: ${res.error}`)
    const data = res.data
    expect(data.session_id).toBe('sess_3')
    expect(data.outcome).toBe('paused')
    // 前端两态(可暂停 / 可继续)就读这一格,所以它必须是布尔而不是靠端内记住"我点过"
    expect(data.changed).toBe(true)
    // eager = 暂停点尚未定稿,界面要能如实说明;留字段不是为了把它传回去
    expect(data.checkpoint_stage).toBe('eager')
    // 信封本体不得留在结论上(否则调用方逐处剥壳 = 本仓记过最多次的漂移型)
    expect(data).not.toHaveProperty('code')
  })

  it('幂等重复暂停回 already_paused + changed:false,两态都由后端给出', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({
        session_id: 'sess_4',
        outcome: 'already_paused',
        changed: false,
        checkpoint_id: 'ckpt_old',
        checkpoint_stage: 'recorded',
      }),
    )

    const res = await pauseAgentSession('sess_4')
    if (!res.success) throw new Error(`期望成功分支,实得: ${res.error}`)
    const data: AgentSessionPauseResult = res.data
    expect(data.outcome).toBe('already_paused')
    expect(data.changed).toBe(false)
  })

  it('resume 打 POST /agents/{sid}/resume 并恒带空对象 body', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({
        session_id: 'sess_5',
        outcome: 'resumed',
        changed: true,
        checkpoint_id: 'ckpt_latest',
        result: { status: 'completed' },
      }),
    )

    const res = await resumeAgentSession('sess_5')
    if (!res.success) throw new Error(`期望成功分支,实得: ${res.error}`)
    const { url, opts } = firstCall(fetchMock)
    expect(url).toContain('/api/agents/sess_5/resume')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(String(opts.body))).toEqual({})
    const data: AgentResumeResult = res.data
    expect(data.outcome).toBe('resumed')
    expect(data.checkpoint_id).toBe('ckpt_latest')
    expect(data.result).toEqual({ status: 'completed' })
  })

  it('409 AGENT_PAUSE_NOT_RUNNING:状态码与 errorCode 原样带回,不折成一句"失败"', async () => {
    fetchMock.mockResolvedValue(
      detailResponse('AGENT_PAUSE_NOT_RUNNING', '该会话当前不在运行', 409),
    )

    const res = await pauseAgentSession('sess_6')
    expect(res.success).toBe(false)
    if (res.success) throw new Error('期望失败分支')
    expect(res.status).toBe(409)
    expect(res.errorCode).toBe('AGENT_PAUSE_NOT_RUNNING')
    expect(res.error).toBe('该会话当前不在运行')
  })

  it('409 AGENT_RESUME_NOT_PAUSED 与 404 AGENT_RESUME_NO_CHECKPOINT 各自可分辨', async () => {
    fetchMock.mockResolvedValue(
      detailResponse('AGENT_RESUME_NOT_PAUSED', '该会话没有处于暂停态', 409),
    )
    const running = await resumeAgentSession('sess_7')
    expect(running.success).toBe(false)
    if (!running.success) expect(running.errorCode).toBe('AGENT_RESUME_NOT_PAUSED')

    fetchMock.mockResolvedValue(
      detailResponse('AGENT_RESUME_NO_CHECKPOINT', '找不到可续跑的暂停点', 404),
    )
    const missing = await resumeAgentSession('sess_7')
    expect(missing.success).toBe(false)
    if (!missing.success) {
      expect(missing.status).toBe(404)
      expect(missing.errorCode).toBe('AGENT_RESUME_NO_CHECKPOINT')
    }
  })

  it('信封 code!==0 时按失败处理,不得把 data:null 当成空结论放行', async () => {
    fetchMock.mockResolvedValue(
      bareJsonResponse({ code: 503, message: '暂停点不可用', data: null }, 200),
    )
    const res = await pauseAgentSession('sess_8')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('暂停点不可用')
  })

  it('回归锁:续跑只按会话寻址,绝不打 /agents/execute/resume', async () => {
    fetchMock.mockResolvedValue(
      envelopeResponse({
        session_id: 'sess_9',
        outcome: 'resumed',
        changed: true,
        checkpoint_id: 'ckpt_eager_9',
      }),
    )
    await resumeAgentSession('sess_9')
    const { url, opts } = firstCall(fetchMock)
    // 一次暂停落两个检查点,拿 pause 回的那个 eager 去 execute/resume 会重跑一轮已执行的工具调用
    expect(url).not.toContain('execute/resume')
    expect(url).toMatch(/\/api\/agents\/sess_9\/resume$/)
    // 出口签名只收 sessionId:调用方手里即使有 checkpoint_id 也没有通道传给续跑请求
    expect(resumeAgentSession.length).toBe(1)
    expect(JSON.parse(String(opts.body))).not.toHaveProperty('checkpoint_id')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
