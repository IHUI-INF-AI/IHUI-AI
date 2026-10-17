// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { dataPayloadOfLine } from '../utils/sse-parse'
import type { FormRequestFieldPayload, FormRequestFramePayload } from '../sse/contract'

/**
 * `form_request` 帧的行级认领解析(D77 小程序传输腿)。
 *
 * 为什么要单有一处:`@ihui/api-client` 的解析腿把这段判据写在 `streamSSE` 的闭包
 * (`client.ts` 的 `tryParseFormRequest`)里,小程序走的是 `onRawLine` 旁路,拿不到那个闭包
 * —— 同族先例是 `apps/miniapp-taro/src/lib/tool-approval-frame.ts` 的 `parseToolApprovalLine`。
 *
 * 判据**逐字段照抄** api-client 那一版,不做任何"顺手收紧/放宽":
 * - `requestId`、`kind` 必须是非空 string,否则整帧丢弃;
 * - `fields` 必须是非空数组,逐项只收 `key` 非空 string 的项(未知 `kind`/`type` 不在这里判,
 *   留给渲染层按判定层 `BUSINESS_FORM_KINDS` / `BUSINESS_FORM_FIELDS` 处理 —— 值规则只有一份);
 * - 单项 `type` 缺省 `'text'`、`required` 只在 `=== true` 时为真(不给"缺字段=必填"这种猜测);
 * - 过滤后 `fields` 变空 ⇒ 整帧丢弃(等于给端上一张填不了的表单);
 * - `actions` 必须**同时**含 `approve` 与 `reject`(只给批准的帧等于替用户做完决定);
 * - `sessionId` / `messageId` 只在其为非空 string 时带上,缺省**不写空串**(端内不得把
 *   "不知道是哪条流"伪装成知道)。
 *
 * 返回类型刻意不含 `type` 字段:那是解析层的判别依据,递给消费方的对象里没有它
 * (口径同 `sse/contract.ts` 对 `FormRequestFramePayload` 的登记注)。
 */

/** 帧名(SSE data 里的 type 值);与 `sse/contract.ts` 的 `SSE_EVENTS.FORM_REQUEST` 同字。 */
export const FORM_REQUEST_FRAME_TYPE = 'form_request'

/**
 * 廉价预筛:整行原文不含该标记就绝不 JSON.parse。
 * 正文 delta 是热路径,逐帧 parse 会让每一行多付一次解析;真正的判据在 parse 之后。
 * 它是 `json.type === FORM_REQUEST_FRAME_TYPE` 的**超集**(判别值在线上必然以带引号形态出现),
 * 所以只会少 parse,不会漏帧。
 */
export function maybeFormRequestLine(line: string): boolean {
  return typeof line === 'string' && line.includes(`"${FORM_REQUEST_FRAME_TYPE}"`)
}

/** 一行 SSE 文本 → 业务表单请求载荷;不是这一族帧、或判据不满足 ⇒ `null`(丢弃,不猜)。 */
export function parseFormRequestLine(line: string): FormRequestFramePayload | null {
  const data = dataPayloadOfLine(line)
  if (!data || data === '[DONE]' || !maybeFormRequestLine(data)) return null

  let json: Record<string, unknown>
  try {
    json = JSON.parse(data) as Record<string, unknown>
  } catch {
    return null
  }
  if (json?.type !== FORM_REQUEST_FRAME_TYPE) return null

  const requestId = json.requestId
  const kind = json.kind
  if (typeof requestId !== 'string' || requestId === '') return null
  if (typeof kind !== 'string' || kind === '') return null

  const rawFields = json.fields
  if (!Array.isArray(rawFields) || rawFields.length === 0) return null

  const fields: FormRequestFieldPayload[] = []
  for (const raw of rawFields) {
    if (typeof raw !== 'object' || raw === null) continue
    const f = raw as Record<string, unknown>
    if (typeof f.key !== 'string' || f.key === '') continue
    fields.push({
      key: f.key,
      type: typeof f.type === 'string' ? f.type : 'text',
      required: f.required === true,
      ...(typeof f.placeholderKey === 'string' ? { placeholderKey: f.placeholderKey } : {}),
    })
  }
  if (fields.length === 0) return null

  const actions = Array.isArray(json.actions)
    ? json.actions.filter((a): a is string => typeof a === 'string')
    : []
  if (!actions.includes('approve') || !actions.includes('reject')) return null

  return {
    requestId,
    kind,
    fields,
    actions,
    ...(typeof json.sessionId === 'string' ? { sessionId: json.sessionId } : {}),
    ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
