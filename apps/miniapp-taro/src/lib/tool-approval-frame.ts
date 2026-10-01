// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-normalized. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * D136(2026-10-01 立):主对话流 `tool-approval` 帧的**端内认领层**。
 *
 * 为什么这一层住在端内(§3 共享层优先的例外声明,三条现读事实):
 *  ① `@ihui/shared/utils/sse-parse` 没有认领该帧 —— 现读
 *     `grep -c "tool-approval" packages/shared/src/utils/sse-parse.ts` = 0,
 *     帧的载荷既不带 content 也不带 delta/text 而带 approval_id,不认领就一路走到
 *     解析函数末尾 `return null` ⇒ **帧能到设备却被静默丢掉**(D113 tool-delta 同型);
 *     该文件在共享包内,本票只交小程序那一半,不得替跨端裁决改共享解析面。
 *  ② 共享的那份审批解析器 `@ihui/shared/sse/agent-events#parseToolApprovalEvent` 要的是
 *     **agent 任务流信封**(`{type, payload:{approval_id…}}`),而 chat-stream 帧是**平铺**
 *     snake_case JSON(见 api-client `client.ts` 的 tryParseToolApproval:直接读
 *     `json.approval_id`)⇒ 用它解析本帧必得 null。
 *  ③ api-client 的同一条解析腿住在 `streamChat` 闭包里,**不导出**(该包在本票只读),
 *     而本端传输层是自己的 `src/lib/sse.ts`,不走 `streamChat`。
 * ⇒ 所以字段映射在本端落一份,但**只落"读哪些线字段"这一层**,D159 的环境/网络事实投影
 *     仍走 `@ihui/api-client` 导出的那一份 `projectToolApprovalEnvFacts`(不抄第二份)。
 *     映射口径由常驻测试 `tests/tool-approval-frame-claim.test.ts` 对着 api-client 源码钉住
 *     (键清单漂开即红),不是"写了就算"。
 */
import { projectToolApprovalEnvFacts } from '@ihui/api-client'
import type { ToolApprovalEvent } from '@ihui/api-client'

/** 帧名(SSE data 里的 type 值);与 @ihui/shared/sse/contract.ts 的 SSE_EVENTS.TOOL_APPROVAL 同字。 */
export const TOOL_APPROVAL_FRAME_TYPE = 'tool-approval'

/**
 * 廉价预筛:整行原文不含该标记就绝不 JSON.parse。
 * 逐帧 parse 会让每个 chunk 的**每一行**多跑一次解析(正文 delta 是热路径),
 * 而这一族帧的判定只需要"像不像审批帧";真正的判据在 parse 之后。
 */
export function maybeToolApprovalLine(line: string): boolean {
  return typeof line === 'string' && line.includes(`"${TOOL_APPROVAL_FRAME_TYPE}"`)
}

/** 去掉 SSE `data:` 前缀(与 @ihui/shared 的 dataPayloadOfLine 同规矩);非 data 行返回 null。 */
export function dataPayloadOfLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) return null
  if (line.startsWith('data:')) return line.slice(5).replace(/^\s/, '')
  return line
}

/**
 * 一行 SSE 文本 → 审批请求视图;不是这一族帧(或 approval_id 缺失/空)⇒ null(丢弃,不猜)。
 *
 * 与 api-client 的解析腿逐字段同口径:
 * - `approval_id` 必须是非空 string,否则整帧不要(没有 id 就回传不了决策,留着只会挡路);
 * - `danger_level` 只认 high/medium/low,**缺省 high**(保守展示,后端仅在收录工具上发帧);
 * - `session_id` 空串视为缺席(回传端点寻址用,写空串会把"不知道是哪条流"伪装成知道);
 * - D159 的执行环境/网络目标事实经 `projectToolApprovalEnvFacts` 投影,端内不再判一遍。
 */
export function parseToolApprovalLine(line: string): ToolApprovalEvent | null {
  const payload = dataPayloadOfLine(line)
  if (!payload || !maybeToolApprovalLine(payload)) return null
  let json: Record<string, unknown>
  try {
    json = JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
  if (json?.type !== TOOL_APPROVAL_FRAME_TYPE) return null
  const approvalId = json.approval_id
  if (typeof approvalId !== 'string' || approvalId === '') return null
  const sessionId = json.session_id
  return {
    type: TOOL_APPROVAL_FRAME_TYPE,
    approvalId,
    toolName: typeof json.tool_name === 'string' ? json.tool_name : '',
    toolCallId: typeof json.tool_call_id === 'string' ? json.tool_call_id : '',
    argsPreview: typeof json.args_preview === 'string' ? json.args_preview : '',
    dangerLevel:
      json.danger_level === 'medium' ? 'medium' : json.danger_level === 'low' ? 'low' : 'high',
    ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
    ...projectToolApprovalEnvFacts(json),
  }
}
