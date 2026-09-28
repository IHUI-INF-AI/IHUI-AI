// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `postToolApprovalResponse` 的**接受性**契约(票㉑ 第四枚的延伸,2026-09-28)。
 *
 * 修的那一格:端点 `POST /llm/complete/stream/{sid}/approval-response` 对
 * "会话不存在/已过期" 与 "审批条目不存在" 回的都是 **HTTP 200 + `{ok:false,error:…}`**
 * (`apps/ai-service/app/routers/llm.py` 里那两个 `return {"ok": False, …}`)。
 * 旧实现只看 `resp.ok` ⇒ 这两种失败都被读成"已送达":调用方(扩展侧栏 `ChatPage.resolveApproval`、
 * web 的 ToolApprovalDialog)据此收起横幅,而后端要等满 `_APPROVAL_TIMEOUT` 才按"未批准"收尾 ——
 * 用户明明点了「允许」,AI 那一侧永远在等。与守门 134「改了 0 行也回成功」同一条病,
 * 只是这一型连计数都没有,只有一个布尔 `ok` 被丢掉。
 *
 * 四条各判一件事,缺一条就有对应的静默失败:
 *  A 200 + `{ok:true}` ⇒ resolve(**不许**因为"多了包体校验"而把成功路径改红);
 *  B 200 + `{ok:false,error}` ⇒ reject,且消息里带得上 error 与两个技术 id
 *    (横幅留着要能重试,报错要能定位是哪一轮 —— 不带 id 的报错等于让人猜);
 *  C 200 + 不可判定的包体(HTML / 截断) ⇒ **同样 reject**:读不出"被接受"就不是被接受,
 *    把"判不出"写成"成功了"是本仓最高频的失效型;
 *  D 非 2xx ⇒ reject 且带 HTTP 状态(旧行为逐字保留)。
 * 另有 E 形状锁:寻址必须走**路径里的 session id**、包体键名必须是 wire 的 snake_case
 * `approval_id` —— 端点两种键名都收(`approval_id` ∥ `approvalId`),所以"测试仍绿"证明不了
 * 形状没被换;而路径一旦丢了 session id,请求会打到不存在的端点上,HTTP 层反而更响。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { postToolApprovalResponse } from '../src/client.js'

type FetchCall = { url: string; init: RequestInit }

const responses: Array<{ status: number; body: string }> = []
const calls: FetchCall[] = []

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
  calls.length = 0
  responses.length = 0
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const input = {
  sessionId: 'sess-abc',
  approvalId: 'appr-xyz',
  decision: 'approve' as const,
  scope: 'session' as const,
}

describe('postToolApprovalResponse 的接受性', () => {
  it('A 200 + {ok:true} ⇒ 正常返回(成功路径不被新校验误伤)', async () => {
    responses.push({ status: 200, body: '{"ok":true,"accepted":true}' })
    await expect(postToolApprovalResponse(input)).resolves.toBeUndefined()
  })

  it('B 200 + {ok:false} ⇒ 必须 reject,并带上 error 与两个技术 id', async () => {
    responses.push({ status: 200, body: '{"ok":false,"error":"session not found or expired"}' })
    await expect(postToolApprovalResponse(input)).rejects.toThrow(
      /session not found or expired[\s\S]*sess-abc[\s\S]*appr-xyz/,
    )
  })

  it('C 200 而包体不可判定 ⇒ reject("读不出被接受"不等于"被接受")', async () => {
    responses.push({ status: 200, body: '<html>502 proxy</html>' })
    await expect(postToolApprovalResponse(input)).rejects.toThrow(/not accepted/)
  })

  it('D 非 2xx ⇒ reject 且保留 HTTP 状态(旧行为一字未动)', async () => {
    responses.push({ status: 404, body: 'no route' })
    await expect(postToolApprovalResponse(input)).rejects.toThrow(/HTTP 404/)
  })

  it('E 寻址走路径里的 session id,包体用 wire 的 snake_case 键', async () => {
    await postToolApprovalResponse(input)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toContain('/llm/complete/stream/sess-abc/approval-response')
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['approval_id', 'decision', 'scope'])
    expect(body.approval_id).toBe('appr-xyz')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
