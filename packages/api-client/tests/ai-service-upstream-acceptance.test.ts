// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 三条"直连 ai-service 的上行应答通道"的**接受性**契约(2026-09-28 立,同一条病一次修全)。
 *
 * 病灶:`tool-result` / `approval-response` / `form-response` 三个端点对
 * "会话不存在或已过期""条目不存在""待决项不存在"回的都是 **HTTP 200 + `{ok:false,error:…}`**
 * (`apps/ai-service/app/routers/llm.py` 里三个 handler 的头两个 return,以及 `_form_settle_rejected`)。
 * 而 `packages/api-client/src/client.ts` 的三条腿原先只看 `resp.ok` ⇒ 一律读成"已送达":
 *   · 工具结果没送到 ⇒ 后端工具协程等满 `_DELEGATE_TIMEOUT`(60s)才按失败收尾;
 *   · 审批决策没送到 ⇒ 用户点了「允许」,协程等满 `_APPROVAL_TIMEOUT`(120s)按未批准收尾,横幅已收;
 *   · 表单应答没送到 ⇒ 表单卡停在"已批准"的假象上(V3 #63 端点自己的注释就写着"失败必抛")。
 * 三处后果同形,所以判据也只允许一份实现 —— 本文件既有行为契约,也有"第二份实现不得回来"的形状锁。
 *
 * 另判一条**同族的另一半**:delegate 回调是在 `streamChat` 的解析循环里被 await 的,
 * 那一层原有 `catch {}` 会把 `postToolResult` 的抛出**整个咽掉**(2026-08-06 那句
 * "抛错让调用方重试"从来没有出口,调用方拿不到任何信号)。现在:
 *   · 未被识别成 tool-delegate 的行 ⇒ 仍静默(原语义,不产新噪音);
 *   · 回调已起跑后再抛 ⇒ 必须 `console.error` 出可定位的一行(不中断读流)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  postFormResponse,
  postToolApprovalResponse,
  postToolResult,
  setBaseUrl,
  setStreamBaseUrl,
  streamChat,
} from '../src/client.js'

const CLIENT_SRC = fileURLToPath(new URL('../src/client.ts', import.meta.url))

type FetchCall = { url: string; init: RequestInit }

let responses: Array<{ status: number; body: string }> = []
let calls: FetchCall[] = []

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init: unknown) => {
      calls.push({ url: String(url), init: init as RequestInit })
      const next = responses.shift() ?? { status: 200, body: '{"ok":true}' }
      return {
        ok: next.status >= 200 && next.status < 300,
        status: next.status,
        text: async () => next.body,
        json: async () => JSON.parse(next.body) as unknown,
      }
    }),
  )
}

beforeEach(() => {
  calls = []
  responses = []
  setBaseUrl('http://localhost:8803')
  setStreamBaseUrl('http://localhost:8803')
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 三条腿逐条走同一组三种回包 —— 少一条腿,那一型就无人判。 */
const LEGS: Array<[string, () => Promise<void>]> = [
  ['postToolResult', () => postToolResult('sess-1', 'call-1', '内容', null)],
  [
    'postToolApprovalResponse',
    () =>
      postToolApprovalResponse({
        sessionId: 'sess-1',
        approvalId: 'appr-1',
        decision: 'approve',
        scope: 'session',
      }),
  ],
  [
    'postFormResponse',
    () =>
      postFormResponse('sess-1', {
        requestId: 'req-1',
        kind: 'event_schedule_draft',
        action: 'approve',
        values: { title: 'x' },
      }),
  ],
]

describe('三条上行通道的接受性(200 不等于被接受)', () => {
  for (const [name, call] of LEGS) {
    it(`${name}:200 + {ok:true} ⇒ 正常返回`, async () => {
      responses.push({ status: 200, body: '{"ok":true,"accepted":true}' })
      await expect(call()).resolves.toBeUndefined()
    })

    it(`${name}:200 + {ok:false} ⇒ 必抛,且带端点给的 error 文本`, async () => {
      responses.push({ status: 200, body: '{"ok":false,"error":"session not found or expired"}' })
      await expect(call()).rejects.toThrow(/not accepted[\s\S]*session not found or expired/)
    })

    it(`${name}:200 而包体不可判定 ⇒ 同样必抛("读不出被接受"不是"被接受")`, async () => {
      responses.push({ status: 200, body: '<html>gateway 502</html>' })
      await expect(call()).rejects.toThrow(/not accepted[\s\S]*响应体不是可判定的 JSON/)
    })

    it(`${name}:非 2xx ⇒ 保留 HTTP 状态那一支(旧行为一字未动)`, async () => {
      responses.push({ status: 404, body: 'no route' })
      await expect(call()).rejects.toThrow(/HTTP 404/)
    })
  }
})

/**
 * G-593 判定结论(2026-10-07 事实核查,拍板①"行为在 ⇒ 守卫锁现行形状,保留行为断言"):
 * 本文件 + 同族 tests/tool-approval-response-acceptance.test.ts 现跑 21/21 全绿。
 * 立案时的红因 = 2026-09-28 HEAD(7baa8ab0e7)上两枚提交(17a81f58e7/d4029af58d)把三条上行
 * 重写成不读包体 ok 的形状;现读工作树该形状已被"共用出口"实现取代并入库 —— client.ts 里
 * `not accepted:` 恰好 1 处(assertAiServiceAccepted),三条腿各自从该出口取值;
 * 行为断言"回传未送达喊一次"由 streamChat 解析层 delegate 回调 catch 里的
 * console.error('[streamChat] tool-delegate 回传未送达(后端将等到超时):', …) 满足
 * ⇒ **不是静默吞,真回归不存在,四条断言判据一字未改**。
 * 变异对照由断言自身承担:删出口(0 命中即红)/摘任一条腿(缺 assertAiServiceAccepted 即红)/
 * 删诊断(喊 0 次即红),守卫对下一轮重构不哑。
 */
describe('判据只允许有一份实现', () => {
  const src = readFileSync(CLIENT_SRC, 'utf8')

  it('接受性判据的抛出点在 client.ts 里恰好一次', () => {
    const hits = src.match(/not accepted:/g) ?? []
    // 0 命中不记绿:那说明判据被删了,而不是"没有第二份"
    expect(hits.length, `抛出点应恰好 1 处,实到 ${hits.length}`).toBe(1)
  })

  it('三条腿都真从该出口取值(摘掉任一条 = 那条腿静默回到"200 即成功")', () => {
    for (const name of ['postToolResult', 'postToolApprovalResponse', 'postFormResponse']) {
      const body = src.slice(src.indexOf(`export async function ${name}`))
      const upto = body.slice(0, body.indexOf('\n}\n') > 0 ? body.indexOf('\n}\n') : body.length)
      expect(upto, `${name} 必须经 assertAiServiceAccepted 判接受性`).toContain(
        'assertAiServiceAccepted(',
      )
    }
  })
})

describe('delegate 回传失败不得被解析层的空 catch 咽掉', () => {
  function sseResponse(chunks: string[]): Response {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c))
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

  const DELEGATE_LINE =
    'data: {"type":"tool-delegate","session_id":"s-x","tool_call_id":"tc-x","tool_name":"read_file","args":{},"iteration":1}\n\n'

  it('回传被拒(200 + {ok:false})⇒ 喊出一行可定位的诊断,且不中断读流', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        if (String(url).endsWith('/tool-result')) {
          return {
            ok: true,
            status: 200,
            text: async () => '{"ok":false,"error":"session not found or expired"}',
            json: async () => ({ ok: false, error: 'session not found or expired' }),
          } as unknown as Response
        }
        return sseResponse([DELEGATE_LINE, 'data: [DONE]\n\n'])
      }),
    )
    await streamChat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      onToolDelegate: async () => {
        await postToolResult('s-x', 'tc-x', null, 'boom')
      },
    } as never)
    const noisy = errSpy.mock.calls.filter((a) => String(a[0]).includes('tool-delegate 回传未送达'))
    expect(noisy.length, '回传未送达必须喊一次').toBe(1)
    expect(String(noisy[0]?.[1] ?? '')).toContain('session not found or expired')
    errSpy.mockRestore()
  })

  it('非 tool-delegate 的数据行仍静默(不产新噪音 —— 与上一条成对)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: not-json-at-all\n\n',
          'data: {"type":"chunk","content":"hi"}\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    )
    await streamChat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      onToolDelegate: async () => {},
    } as never)
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
