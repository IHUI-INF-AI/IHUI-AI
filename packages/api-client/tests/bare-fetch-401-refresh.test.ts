// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 绕过 fetchApi 的裸 fetch 腿 —— 401 续期与"恰好一次重放"(2026-10-26 立)。
 *
 * 病灶:access JWT 只有 15 分钟。fetchApi 有 401 拦截器,但包里还有一批**自己调 fetch**
 * 的腿(ai-service 上行回传、放行规则、报告导出、上传、SSE 启动、STT、agent 流式执行),
 * 它们 access 一过期就永久失败,用户表现为"审批点了没反应 / 导出失败 / 上传失败"。
 *
 * 本文件把 `fetchWithAuthRefresh()` 这一处共用出口的契约逐腿钉死:
 *  1. 401 ⇒ 续期一次 + 带**新** token 重放**恰好一次**;
 *  2. 续期返回 null ⇒ 原样失败,且**只请求一次**(不空转重放);
 *  3. 重放后仍 401 ⇒ 就地收口,**绝不第二次重放、绝不第二次续期**;
 *  4. 非 401(5xx/403)⇒ 不续期、不重放,失败语义与改动前逐字同一形态;
 *  5. 无 token ⇒ **不塞空 `Bearer `**(第一条请求根本不带 Authorization),
 *     cookie 兜底路径不被破坏;
 *  6. body 不可重放(ReadableStream)⇒ 不续期不重放 —— 宁可少做,不做"重放发了空 body"的假成功;
 *  7. multipart(FormData)重放时 body **仍是同一份条目记录**,不是空 body。
 *
 * 判据不住测试里(§22c):本文件只装配场景与断言,续期/重放/headers 装配全走生产代码。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetRefreshStateForTest,
  fetchWithAuthRefresh,
  listMyGoals,
  postFormResponse,
  postSessionGoal,
  postToolApprovalResponse,
  postToolResult,
  postTerminalInput,
  setBaseUrl,
  setTokenProvider,
} from '../src/client.js'
import { listApprovalGrants, revokeApprovalGrant } from '../src/endpoints/chat.js'
import { exportCareerReport } from '../src/endpoints/ai.js'
import { exportMyReport } from '../src/endpoints/edu.js'
import { getUploadFormInfo, uploadFileMultipart } from '../src/endpoints/files.js'
import { streamCrewRun } from '../src/endpoints/crew.js'
import {
  VoiceSttHttpError,
  voiceSttFromBlob,
  voiceSttFromReactNative,
} from '../src/endpoints/voice-stt.js'
import { executeAgentRuntimeStream, executeAgentStream } from '../src/endpoints/agent-runtime.js'
import type { ApiResult } from '@ihui/types'

const OLD = 'old-access'
const NEW = 'new-access'
/** voice-stt 的调用方自备 token(钉住"显式凭据优先,不被 provider 顶掉") */
const CALLER = 'caller-access'

// ==================== 假 fetch:记录每一次请求的 headers / body ====================

interface RecordedCall {
  url: string
  init: RequestInit
}

let calls: RecordedCall[] = []
let refreshCount = 0
const originalFetch = globalThis.fetch

function installProvider(token: string | null, refresh: () => Promise<string | null>): void {
  refreshCount = 0
  setTokenProvider({
    getToken: () => token,
    refreshAccessToken: async () => {
      refreshCount++
      return refresh()
    },
  })
}

function stubFetch(respond: (call: number) => Response): void {
  calls = []
  globalThis.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return respond(calls.length)
  }) as unknown as typeof fetch
}

function headersOf(index: number): Record<string, string> {
  const raw = calls[index]?.init.headers
  if (!raw) return {}
  if (Array.isArray(raw)) return Object.fromEntries(raw)
  return raw as Record<string, string>
}

/** 第 index 次请求实发的 Authorization(没带 ⇒ undefined,不是空串) */
function authOf(index: number): string | undefined {
  const headers = headersOf(index)
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization')
  return key ? headers[key] : undefined
}

/** 任何一次请求都不许出现空 Bearer(红线 5:无 token 时宁可不带,也不塞 `Bearer `) */
function anyEmptyBearer(): boolean {
  return calls.some((_call, index) => authOf(index)?.trim() === 'Bearer')
}

// ==================== 假 Response ====================

function fakeResponse(opts: { status: number; body?: string; stream?: string }): Response {
  const status = opts.status
  const body = opts.body ?? ''
  const stream = opts.stream
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => JSON.parse(body) as unknown,
    text: async () => body,
    blob: async () => new Blob([body]),
    body: stream
      ? new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(stream))
            controller.close()
          },
        })
      : null,
  } as unknown as Response
}

// 正文刻意把状态码写进去:有些腿的失败面是"服务端正文"(agent 流式),
// 只断言文案不含数字的那一型判不出状态码漂移。
const expired = (): Response => fakeResponse({ status: 401, body: '{"detail":"HTTP 401 expired"}' })
const unavailable = (): Response =>
  fakeResponse({ status: 503, body: '{"detail":"HTTP 503 down"}' })

// ==================== 结果收敛(抛错型腿 / 返回型腿共用) ====================

type Settled = { kind: 'resolved'; value: unknown } | { kind: 'rejected'; reason: unknown }

async function settle(p: Promise<unknown>): Promise<Settled> {
  try {
    return { kind: 'resolved', value: await p }
  } catch (reason) {
    return { kind: 'rejected', reason }
  }
}

function rejectedMessage(outcome: Settled): string {
  if (outcome.kind !== 'rejected') {
    return `!!期望抛出,实际 resolved(${typeof outcome.value})`
  }
  return outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
}

function resolvedValue(outcome: Settled): unknown {
  if (outcome.kind !== 'resolved') return `!!期望返回,实际抛出(${rejectedMessage(outcome)})`
  return outcome.value
}

function asResult(outcome: Settled): ApiResult<unknown> {
  return resolvedValue(outcome) as ApiResult<unknown>
}

// ==================== 每条腿的规格 ====================

type Scenario = 'replay-ok' | 'refresh-null' | 'replay-still-401' | 'no-token-replay' | 'non-401'

interface LegRuntime {
  invoke: () => Promise<unknown>
  /** 2xx 到手时该腿应判成什么 */
  expectOk: (outcome: Settled) => void
  /** 终态失败(最后一个 HTTP 状态码)时该腿应判成什么 —— 与改动前逐字同一形态 */
  expectFail: (outcome: Settled, status: number) => void
}

interface LegSpec {
  name: string
  /** 该腿拿到 2xx 时服务端应回的东西 */
  ok: () => Response
  /** 该腿第一条请求应带的 Authorization(缺省 = provider 的旧 token) */
  firstAuth?: string
  make: (scenario: Scenario) => LegRuntime
}

/** 抛 `xxx failed: HTTP <status>` 那一族(client.ts 上行腿 + chat.ts + crew.ts) */
function throwingLeg(prefix: string): Omit<LegRuntime, 'invoke'> {
  return {
    expectOk: (outcome) => expect(outcome.kind).toBe('resolved'),
    expectFail: (outcome, status) =>
      expect(rejectedMessage(outcome)).toContain(`${prefix} failed: HTTP ${status}`),
  }
}

/** 返回 ApiResult 那一族(files.ts:401 从来就是 success:false,不是抛错) */
function resultLeg(): Omit<LegRuntime, 'invoke'> {
  return {
    expectOk: (outcome) => expect(asResult(outcome).success).toBe(true),
    expectFail: (outcome, status) => {
      const res = asResult(outcome)
      expect(res.success).toBe(false)
      expect(res.status).toBe(status)
    },
  }
}

/** 原样交回 Response 那一族(edu/ai 报告导出:失败判读权在调用方) */
function responseLeg(): Omit<LegRuntime, 'invoke'> {
  return {
    expectOk: (outcome) => expect((resolvedValue(outcome) as Response).ok).toBe(true),
    expectFail: (outcome, status) =>
      expect((resolvedValue(outcome) as Response).status).toBe(status),
  }
}

/** 抛 VoiceSttHttpError 那一族(STT:携带 status 的错误对象) */
function sttLeg(): Omit<LegRuntime, 'invoke'> {
  return {
    expectOk: (outcome) => expect(resolvedValue(outcome)).toBe('你好'),
    expectFail: (outcome, status) => {
      expect(rejectedMessage(outcome)).toContain(`STT 请求失败 HTTP ${status}`)
      const reason = outcome.kind === 'rejected' ? outcome.reason : null
      expect(reason).toBeInstanceOf(VoiceSttHttpError)
      expect((reason as VoiceSttHttpError).status).toBe(status)
    },
  }
}

/** 失败走 onError(不抛)的那两族(agent 流式执行) */
function streamCallbackLeg(state: {
  deltas: string[]
  errors: string[]
}): Omit<LegRuntime, 'invoke'> {
  return {
    expectOk: (outcome) => {
      expect(outcome.kind).toBe('resolved')
      expect(state.deltas).toEqual(['hi'])
      expect(state.errors).toEqual([])
    },
    expectFail: (outcome, status) => {
      expect(outcome.kind).toBe('resolved')
      expect(state.errors).toHaveLength(1)
      expect(state.errors[0]).toContain(String(status))
      expect(state.deltas).toEqual([])
    },
  }
}

const RN_FILE = { uri: 'file:///tmp/a.png', type: 'image/png', name: 'a.png' }
const GOAL_ROW = {
  threadId: 't1',
  sessionId: 's1',
  title: 'T',
  workspaceId: 'w1',
  createdAt: 1,
  updatedAt: 2,
  goal: { status: 'active', objective: 'o' },
}

const LEGS: LegSpec[] = [
  // ---------- A. client.ts:ai-service 上行回传六条(此前完全不带 Authorization) ----------
  {
    name: 'client.ts / postToolResult',
    ok: () => fakeResponse({ status: 200, body: '{"ok":true}' }),
    make: () => ({
      invoke: () => postToolResult('s1', 'tc1', 'ok', null),
      ...throwingLeg('postToolResult'),
    }),
  },
  {
    name: 'client.ts / postToolApprovalResponse',
    ok: () => fakeResponse({ status: 200, body: '{"ok":true}' }),
    make: () => ({
      invoke: () =>
        postToolApprovalResponse({ sessionId: 's1', approvalId: 'a1', decision: 'approve' }),
      ...throwingLeg('postToolApprovalResponse'),
    }),
  },
  {
    name: 'client.ts / postFormResponse',
    ok: () => fakeResponse({ status: 200, body: '{"ok":true}' }),
    make: () => ({
      invoke: () =>
        postFormResponse('s1', {
          requestId: 'r1',
          kind: 'schedule',
          action: 'approve',
          values: { t: 'x' },
        }),
      ...throwingLeg('postFormResponse'),
    }),
  },
  {
    name: 'client.ts / postTerminalInput',
    ok: () => fakeResponse({ status: 200, body: '{"ok":true,"accepted":true}' }),
    make: () => ({
      invoke: () => postTerminalInput('s1', { terminalId: 't1', text: 'y' }),
      ...throwingLeg('postTerminalInput'),
    }),
  },
  {
    name: 'client.ts / postSessionGoal',
    ok: () => fakeResponse({ status: 200, body: '{"ok":true,"accepted":true}' }),
    make: () => ({
      invoke: () => postSessionGoal('s1', { action: 'set', objective: 'o' }),
      ...throwingLeg('postSessionGoal'),
    }),
  },
  {
    name: 'client.ts / listMyGoals',
    ok: () => fakeResponse({ status: 200, body: JSON.stringify({ data: { goals: [GOAL_ROW] } }) }),
    make: () => ({
      invoke: () => listMyGoals(10),
      ...throwingLeg('listMyGoals'),
      expectOk: (outcome) => expect(resolvedValue(outcome)).toEqual([GOAL_ROW]),
    }),
  },

  // ---------- B. chat.ts:放行规则 GET / DELETE ----------
  {
    name: 'chat.ts / listApprovalGrants',
    ok: () =>
      fakeResponse({
        status: 200,
        body: '{"ok":true,"grants":[{"cacheKey":"k1","prefix":"git push"}]}',
      }),
    make: () => ({
      invoke: () => listApprovalGrants(),
      ...throwingLeg('listApprovalGrants'),
    }),
  },
  {
    name: 'chat.ts / revokeApprovalGrant',
    ok: () => fakeResponse({ status: 200, body: '{"ok":true}' }),
    make: () => ({
      invoke: () => revokeApprovalGrant('k1'),
      ...throwingLeg('revokeApprovalGrant'),
    }),
  },

  // ---------- C. edu.ts / ai.ts:报告导出(pdf/xlsx 二进制) ----------
  {
    name: 'edu.ts / exportMyReport',
    ok: () => fakeResponse({ status: 200, body: '%PDF-1.4' }),
    make: () => ({ invoke: () => exportMyReport({ format: 'pdf' }), ...responseLeg() }),
  },
  {
    name: 'ai.ts / exportCareerReport',
    ok: () => fakeResponse({ status: 200, body: 'PK' }),
    make: () => ({
      invoke: () =>
        exportCareerReport({
          school: 'S',
          classLevel: 'C',
          scoreRange: '1',
          languageDifficulty: '2',
          scienceCharacteristics: '3',
          learningObstacle: '4',
          hobbies: '5',
          target: '6',
          format: 'word',
          content: 'x',
        }),
      ...responseLeg(),
    }),
  },

  // ---------- D. files.ts:上传表单信息 + multipart 上传 ----------
  {
    name: 'files.ts / getUploadFormInfo',
    ok: () =>
      fakeResponse({
        status: 200,
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            uploadUrl: '/api/files/upload/form',
            method: 'POST',
            encoding: 'multipart',
            field: 'file',
            maxSize: 1024,
          },
        }),
      }),
    make: () => ({ invoke: () => getUploadFormInfo(), ...resultLeg() }),
  },
  {
    name: 'files.ts / uploadFileMultipart',
    ok: () =>
      fakeResponse({
        status: 200,
        body: JSON.stringify({ code: 0, data: { file: { id: 'f1', url: '/uploads/f1.png' } } }),
      }),
    make: () => ({ invoke: () => uploadFileMultipart(RN_FILE), ...resultLeg() }),
  },

  // ---------- E. crew.ts:SSE 启动(返回 ReadableStream 给调用方自己解析) ----------
  {
    name: 'crew.ts / streamCrewRun',
    ok: () => fakeResponse({ status: 200, stream: 'data: {"type":"start"}\n\n' }),
    make: () => ({
      invoke: () => streamCrewRun('run1'),
      expectOk: (outcome) => expect(resolvedValue(outcome)).toBeInstanceOf(ReadableStream),
      expectFail: (outcome, status) =>
        expect(rejectedMessage(outcome)).toContain(`SSE 启动失败: ${status}`),
    }),
  },

  // ---------- F. voice-stt.ts:两条上传腿(调用方 token 优先,缺省才回落 provider) ----------
  {
    name: 'voice-stt.ts / voiceSttFromBlob',
    ok: () => fakeResponse({ status: 200, body: '{"text":"你好","stub":false,"model":"m"}' }),
    firstAuth: `Bearer ${CALLER}`,
    make: (scenario) => ({
      invoke: () =>
        voiceSttFromBlob({
          blob: new Blob(['audio-bytes'], { type: 'audio/webm' }),
          aiServiceUrl: 'http://ai.test',
          token: scenario === 'no-token-replay' ? undefined : CALLER,
        }),
      ...sttLeg(),
    }),
  },
  {
    name: 'voice-stt.ts / voiceSttFromReactNative',
    ok: () => fakeResponse({ status: 200, body: '{"text":"你好","stub":false,"model":"m"}' }),
    firstAuth: `Bearer ${CALLER}`,
    make: (scenario) => ({
      invoke: () =>
        voiceSttFromReactNative('file:///tmp/voice.m4a', {
          aiServiceUrl: 'http://ai.test',
          token: scenario === 'no-token-replay' ? undefined : CALLER,
        }),
      ...sttLeg(),
    }),
  },

  // ---------- G. agent-runtime.ts:两条流式执行入口 ----------
  {
    name: 'agent-runtime.ts / executeAgentStream',
    ok: () =>
      fakeResponse({
        status: 200,
        stream: 'data: {"type":"message","role":"assistant","content":"hi"}\n\n',
      }),
    make: () => {
      const state = { deltas: [] as string[], errors: [] as string[] }
      return {
        invoke: () =>
          executeAgentStream(
            { goal: 'g', hard_criteria: [] },
            {
              onDelta: (delta) => state.deltas.push(delta),
              onError: (message) => state.errors.push(message),
            },
          ),
        ...streamCallbackLeg(state),
      }
    },
  },
  {
    name: 'agent-runtime.ts / executeAgentRuntimeStream',
    ok: () => fakeResponse({ status: 200, stream: 'event: delta\ndata: {"content":"hi"}\n\n' }),
    make: () => {
      const state = { deltas: [] as string[], errors: [] as string[] }
      return {
        invoke: () =>
          executeAgentRuntimeStream(
            { message: 'hi' },
            {
              onDelta: (data) => state.deltas.push(data.content),
              onError: (data) => state.errors.push(data.message),
            },
          ),
        ...streamCallbackLeg(state),
      }
    },
  },
]

beforeEach(() => {
  __resetRefreshStateForTest()
  setBaseUrl('')
  installProvider(OLD, async () => NEW)
})

afterEach(() => {
  __resetRefreshStateForTest()
  setTokenProvider({ getToken: () => null })
  globalThis.fetch = originalFetch
  calls = []
})

describe.each(LEGS)('$name:裸 fetch 腿的 401 续期', (spec) => {
  it('401 ⇒ 续期一次并带新 token 重放恰好一次(成功)', async () => {
    installProvider(OLD, async () => NEW)
    stubFetch((call) => (call === 1 ? expired() : spec.ok()))
    const leg = spec.make('replay-ok')

    const outcome = await settle(leg.invoke())

    leg.expectOk(outcome)
    expect(calls).toHaveLength(2)
    expect(authOf(0)).toBe(spec.firstAuth ?? `Bearer ${OLD}`)
    expect(authOf(1)).toBe(`Bearer ${NEW}`)
    expect(refreshCount).toBe(1)
  })

  it('续期返回 null ⇒ 原样失败,且只请求一次', async () => {
    installProvider(OLD, async () => null)
    stubFetch(() => expired())
    const leg = spec.make('refresh-null')

    const outcome = await settle(leg.invoke())

    leg.expectFail(outcome, 401)
    expect(calls).toHaveLength(1)
    expect(refreshCount).toBe(1)
  })

  it('重放后仍 401 ⇒ 绝不第二次重放、绝不第二次续期', async () => {
    installProvider(OLD, async () => NEW)
    stubFetch(() => expired())
    const leg = spec.make('replay-still-401')

    const outcome = await settle(leg.invoke())

    leg.expectFail(outcome, 401)
    expect(calls).toHaveLength(2)
    expect(authOf(1)).toBe(`Bearer ${NEW}`)
    expect(refreshCount).toBe(1)
  })

  it('无 token ⇒ 第一条不带 Authorization(不塞空 Bearer),续期成功后重放仍生效', async () => {
    installProvider(null, async () => NEW)
    stubFetch((call) => (call === 1 ? expired() : spec.ok()))
    const leg = spec.make('no-token-replay')

    const outcome = await settle(leg.invoke())

    leg.expectOk(outcome)
    expect(calls).toHaveLength(2)
    expect(authOf(0)).toBeUndefined()
    expect(anyEmptyBearer()).toBe(false)
    expect(authOf(1)).toBe(`Bearer ${NEW}`)
  })

  it('非 401(503)⇒ 不续期、不重放,失败语义逐字不变', async () => {
    installProvider(OLD, async () => NEW)
    stubFetch(() => unavailable())
    const leg = spec.make('non-401')

    const outcome = await settle(leg.invoke())

    leg.expectFail(outcome, 503)
    expect(calls).toHaveLength(1)
    expect(refreshCount).toBe(0)
  })
})

// ==================== 出口自身的四条附加红线 ====================

describe('fetchWithAuthRefresh 出口自身', () => {
  it('multipart(FormData)重放:第二条请求仍是同一份 body,不是空 body', async () => {
    installProvider(OLD, async () => NEW)
    const fd = new FormData()
    fd.append('file', RN_FILE as never)
    stubFetch((call) =>
      call === 1 ? expired() : fakeResponse({ status: 200, body: '{"ok":true}' }),
    )

    const resp = await fetchWithAuthRefresh('http://ai.test/upload', { method: 'POST', body: fd })

    expect(resp.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(calls[0]!.init.body).toBe(fd)
    expect(calls[1]!.init.body).toBe(fd)
    expect(calls[1]!.init.body).toBeInstanceOf(FormData)
  })

  it('body 是一次性流 ⇒ 不续期也不重放(绝不做"重发空 body"的假成功)', async () => {
    installProvider(OLD, async () => NEW)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk'))
        controller.close()
      },
    })
    stubFetch(() => expired())

    const resp = await fetchWithAuthRefresh('http://ai.test/stream', {
      method: 'POST',
      body: stream,
    })

    expect(resp.status).toBe(401)
    expect(calls).toHaveLength(1)
    expect(refreshCount).toBe(0)
  })

  it('调用方自己写了 Authorization ⇒ 不覆盖、不续期、不重放', async () => {
    installProvider(OLD, async () => NEW)
    stubFetch(() => expired())

    const resp = await fetchWithAuthRefresh('http://ai.test/x', {
      method: 'GET',
      headers: { Authorization: `Bearer ${CALLER}` },
    })

    expect(resp.status).toBe(401)
    expect(calls).toHaveLength(1)
    expect(authOf(0)).toBe(`Bearer ${CALLER}`)
    expect(refreshCount).toBe(0)
  })

  it('无 token 且续期也拿不到 ⇒ 一条 Authorization 都不加,其余请求形状逐字不变', async () => {
    installProvider(null, async () => null)
    stubFetch(() => expired())

    const resp = await fetchWithAuthRefresh('http://ai.test/x', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })

    expect(resp.status).toBe(401)
    expect(calls).toHaveLength(1)
    expect(authOf(0)).toBeUndefined()
    expect(anyEmptyBearer()).toBe(false)
    expect(calls[0]!.init.credentials).toBe('include')
    expect(headersOf(0)['Content-Type']).toBe('application/json')
  })

  it('二元组形态的 headers 也照常装配(不因形态而悄悄丢掉凭据)', async () => {
    installProvider(OLD, async () => NEW)
    stubFetch(() => fakeResponse({ status: 200, body: '{}' }))

    await fetchWithAuthRefresh('http://ai.test/x', { headers: [['Accept', 'application/json']] })

    expect(authOf(0)).toBe(`Bearer ${OLD}`)
    expect(headersOf(0)['Accept']).toBe('application/json')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
