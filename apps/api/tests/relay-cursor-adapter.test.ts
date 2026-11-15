// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Cursor 适配器 + 导入形状单测(2026-11-14 立)。
 *
 * 覆盖点:
 * - protobuf 编解码往返、Connect 帧半包/粘包/end-stream;
 * - checksum 固定向量(6 字节大端分钟 + t=165 混淆 + machineId);
 * - AgentRunRequest:文本落 prepend_user_messages、user_message.text 留空、模型名落 requested_model;
 * - 服务端帧:text_delta → 文本事件、turn_ended → finish;exec 请求必须回包;
 * - 导入形状:token/accessToken 两态可导,uid 取 JWT sub,统一名优先 email;
 * - 能力位:quotaSupported=true、refreshTokenSupported=false、适配器注册到位;
 * - 额度:usagePercent → ratio、401 → authFailed、缺字段 → 未判定。
 *
 * 全部离线:fetch 打桩,不发真实网络请求;token 只用占位 JWT。
 */
import { describe, it, expect } from 'vitest'
import {
  buildAgentRunRequest,
  buildCursorChecksum,
  cursorAdapter,
  decodeFields,
  encodeConnectFrame,
  encodeVarint,
  ConnectFrameParser,
  firstField,
  handleServerMessage,
  pbInt,
  pbMessage,
  pbString,
  type CursorRunEvent,
} from '../src/services/upstream-adapters/cursor-adapter.js'
import { registerAllRelayAdapters } from '../src/services/upstream-adapters/index.js'
import {
  getRelayAdapter,
  isRefreshableProviderCode,
} from '../src/services/relay-upstream-adapters.js'
import {
  isRelayProviderCode,
  recognizeImportShape,
  resolveRelayAccountName,
  type RelayProviderCode,
} from '../src/services/relay-account-format.js'
import { resolveImportAccountUid } from '../src/services/relay-account-pool-service.js'
import type {
  AdapterAccountContext,
  NormalizedChatRequest,
} from '../src/services/relay-upstream-adapters.js'
import type { ImportAccountInput } from '../src/services/relay-account-pool-service.js'

function b64url(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url')
}

function fakeJwt(claims: Record<string, unknown>): string {
  return `${b64url({ alg: 'none' })}.${b64url(claims)}.sig`
}

function ctxWith(
  machineId: string | null,
  token = fakeJwt({ sub: 'user_1' }),
): AdapterAccountContext {
  return {
    row: { machineId } as never,
    credentials: { token, refreshToken: null, cookies: [], secrets: {} },
  }
}

function chatReq(overrides: Partial<NormalizedChatRequest> = {}): NormalizedChatRequest {
  return {
    model: 'cursor/grok-4.7',
    messages: [
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'Reply with exactly: pong' },
    ],
    stream: true,
    ...overrides,
  }
}

describe('protobuf / Connect 帧', () => {
  it('varint 与字段编解码往返', () => {
    const payload = Buffer.concat([
      pbInt(10, 1),
      pbString(22, 'cursor-agent'),
      pbMessage(9, pbString(1, 'grok-4.7')),
    ])
    const fields = decodeFields(payload)
    expect(fields.map((f) => f.no)).toEqual([10, 22, 9])
    expect(fields[0]?.value).toBe(1)
    expect((fields[1]?.value as Buffer).toString('utf8')).toBe('cursor-agent')
    const model = decodeFields(fields[2]?.value as Buffer)
    expect((firstField(model, 1)?.value as Buffer).toString('utf8')).toBe('grok-4.7')
    expect(encodeVarint(300)).toEqual(Buffer.from([0xac, 0x02]))
  })

  it('帧解析器处理半包与粘包,并保留 end-stream 标志', () => {
    const a = encodeConnectFrame(Buffer.from('aaa'))
    const b = encodeConnectFrame(Buffer.from('bbb'))
    const parser = new ConnectFrameParser()
    const first = parser.push(a.subarray(0, 3))
    expect(first).toHaveLength(0)
    expect(parser.pending()).toBe(3)
    const second = parser.push(Buffer.concat([a.subarray(3), b]))
    expect(second.map((f) => f.payload.toString('utf8'))).toEqual(['aaa', 'bbb'])
    expect(second.every((f) => f.flags === 0)).toBe(true)

    const endFrame = Buffer.concat([Buffer.from([2]), Buffer.alloc(4), Buffer.from('{}')])
    endFrame.writeUInt32BE(2, 1)
    const parsed = new ConnectFrameParser().push(endFrame)
    expect(parsed[0]?.flags & 2).toBe(2)
    expect(parsed[0]?.payload.toString('utf8')).toBe('{}')
  })
})

describe('checksum 与请求构造', () => {
  it('固定向量:1_700_000_000_000ms + machineId=abc123', () => {
    expect(buildCursorChecksum('abc123', 1_700_000_000_000)).toBe('Vfb45Bi9abc123')
    // 同一时间桶内输出稳定(桶宽 = 1e6 ms,上游按桶校验)
    expect(buildCursorChecksum('m', 1_700_000_000_000)).toBe(
      buildCursorChecksum('m', 1_700_000_999_999),
    )
    expect(buildCursorChecksum('m', 1_700_000_000_000)).not.toBe(
      buildCursorChecksum('m', 1_700_001_000_000),
    )
  })

  it('AgentRunRequest:文本进 prepend_user_messages,user_message.text 留空', () => {
    const run = decodeFields(buildAgentRunRequest(chatReq()))
    const state = decodeFields(firstField(run, 1)?.value as Buffer)
    expect(firstField(state, 10)?.value).toBe(1)
    expect((firstField(state, 22)?.value as Buffer).toString('utf8')).toBe('cursor-agent')

    const action = decodeFields(firstField(run, 2)?.value as Buffer)
    const userAction = decodeFields(firstField(action, 1)?.value as Buffer)
    // field 1 = 空 UserMessage;真正文本全在 field 4 prepend_user_messages
    expect((firstField(userAction, 1)?.value as Buffer).length).toBe(0)
    const prepend = userAction.filter((f) => f.no === 4).map((f) => f.value as Buffer)
    const texts = prepend.map((p) =>
      (firstField(decodeFields(p), 1)?.value as Buffer).toString('utf8'),
    )
    expect(texts.some((t) => t.includes('be terse'))).toBe(true)
    expect(texts.some((t) => t.includes('Reply with exactly: pong'))).toBe(true)
    // 每条 prepend 都带 message_id(field 2)与 mode=1(field 4)
    for (const p of prepend) {
      const inner = decodeFields(p)
      expect((firstField(inner, 2)?.value as Buffer).length).toBeGreaterThan(0)
      expect(firstField(inner, 4)?.value).toBe(1)
    }

    const model = decodeFields(firstField(run, 9)?.value as Buffer)
    expect((firstField(model, 1)?.value as Buffer).toString('utf8')).toBe('grok-4.7')
  })
})

describe('服务端帧处理', () => {
  it('text_delta 产出文本,turn_ended 结束', () => {
    const events: CursorRunEvent[] = []
    let finished = false
    const textDelta = pbMessage(1, pbString(1, 'pong'))
    const turnEnded = pbMessage(14, Buffer.alloc(0))
    handleServerMessage(pbMessage(1, textDelta), {
      write: () => {},
      push: (ev) => events.push(ev),
      finish: () => {
        finished = true
      },
    })
    handleServerMessage(pbMessage(1, turnEnded), {
      write: () => {},
      push: (ev) => events.push(ev),
      finish: () => {
        finished = true
      },
    })
    expect(events[0]?.text).toBe('pong')
    expect(finished).toBe(true)
  })

  it('exec_server_message(request_context_args)必须回包', () => {
    const written: Buffer[] = []
    const execArgs = pbMessage(10, pbMessage(1, Buffer.alloc(0)))
    const serverMsg = pbMessage(2, Buffer.concat([pbInt(1, 7), pbString(15, 'exec-1'), execArgs]))
    handleServerMessage(serverMsg, {
      write: (buf) => written.push(buf),
      push: () => {},
      finish: () => {},
    })
    expect(written).toHaveLength(1)
    const reply = decodeFields(written[0] as Buffer)
    const execClient = decodeFields(firstField(reply, 2)?.value as Buffer)
    expect(firstField(execClient, 1)?.value).toBe(7)
    expect((firstField(execClient, 15)?.value as Buffer).toString('utf8')).toBe('exec-1')
    // 层级: result(10) → success(1) → request_context(1) → env(4)
    const result = decodeFields(firstField(execClient, 10)?.value as Buffer)
    const success = decodeFields(firstField(result, 1)?.value as Buffer)
    const requestContext = decodeFields(firstField(success, 1)?.value as Buffer)
    expect(firstField(requestContext, 4)).toBeTruthy()
  })
})

describe('导入形状与统一名', () => {
  it('token / accessToken 两态可导,空值拒收', () => {
    expect(recognizeImportShape('cursor', { token: 'x' }).importable).toBe(true)
    expect(recognizeImportShape('cursor', { accessToken: 'x' }).importable).toBe(true)
    expect(recognizeImportShape('cursor', { access_token: 'x' }).importable).toBe(true)
    expect(recognizeImportShape('cursor', { token: '' }).importable).toBe(false)
  })

  it('uid 取 JWT sub;统一名优先 email', () => {
    const token = fakeJwt({ sub: 'google-oauth2|user_01ABC', email: 'a@b.c' })
    const uid = resolveImportAccountUid('cursor', { token } as unknown as ImportAccountInput)
    expect(uid).toBe('google-oauth2|user_01ABC')
    const decision = resolveRelayAccountName({
      providerCode: 'cursor' as RelayProviderCode,
      payload: { email: 'a@b.c' },
    })
    expect(decision.name).toBe('a@b.c')
    expect(decision.source).toBe('payload-name')
  })
})

describe('能力位与额度', () => {
  it('适配器注册到位 + 能力位如实', () => {
    registerAllRelayAdapters()
    expect(isRelayProviderCode('cursor')).toBe(true)
    expect(getRelayAdapter('cursor')).not.toBeNull()
    expect(cursorAdapter.providerCode).toBe('cursor')
    expect(cursorAdapter.quotaSupported).toBe(true)
    // 续期只有文档、未实测 ⇒ 不得进保活窗口
    expect(isRefreshableProviderCode('cursor')).toBe(false)
  })

  it('getQuota:usagePercent → ratio,套餐/重置时刻透传', async () => {
    const ctx = ctxWith('abc123')
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          usagePercent: 12.5,
          nextResetTimestampUtc: '2026-11-19T04:56:37.412Z',
          cursorPlanName: 'Premium',
        }),
        { status: 200 },
      )) as unknown as typeof fetch
    const r = await cursorAdapter.getQuota!(ctx, { fetchImpl: fakeFetch })
    expect(r.ok).toBe(true)
    expect(r.quota?.ratio).toBe(0.125)
    expect(r.quota?.subscriptionName).toBe('Premium')
    expect(r.quota?.resetsAt).toBe('2026-11-19T04:56:37.412Z')
  })

  it('getQuota:401 → authFailed;缺 usagePercent → 未判定', async () => {
    const ctx = ctxWith('abc123')
    const unauthorized = (async () =>
      new Response('{"error":"unauthenticated"}', { status: 401 })) as unknown as typeof fetch
    expect((await cursorAdapter.getQuota!(ctx, { fetchImpl: unauthorized })).authFailed).toBe(true)

    const shapeMismatch = (async () =>
      new Response(JSON.stringify({ foo: 1 }), { status: 200 })) as unknown as typeof fetch
    const r = await cursorAdapter.getQuota!(ctx, { fetchImpl: shapeMismatch })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('未判定')
  })

  it('checkHealth:200+usagePercent ⇒ ok;5xx ⇒ indeterminate', async () => {
    const ctx = ctxWith('abc123')
    const okFetch = (async () =>
      new Response(JSON.stringify({ usagePercent: 1 }), { status: 200 })) as unknown as typeof fetch
    expect((await cursorAdapter.checkHealth(ctx, { fetchImpl: okFetch })).ok).toBe(true)

    const downFetch = (async () => new Response('oops', { status: 503 })) as unknown as typeof fetch
    const down = await cursorAdapter.checkHealth(ctx, { fetchImpl: downFetch })
    expect(down.ok).toBe(false)
    expect(down.indeterminate).toBe(true)
  })

  it('缺 machineId 时发请求前就明确报错(不猜 checksum)', async () => {
    const r = await cursorAdapter.getQuota!(ctxWith(null), {
      fetchImpl: (async () => new Response('{}')) as unknown as typeof fetch,
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('machineId')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
