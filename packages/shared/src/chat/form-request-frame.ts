// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77 对话流业务表单(2026-10-17 小程序腿落地)—— form_request 帧的**投影 + 线帧认领**
// 唯一实现(web / 小程序共用;判据单源,AGENTS §0.6)。
//
// 为什么从 apps/web 迁到这里:
//   投影判据("什么样的帧才配渲染成一张表单")原先只活在
//   apps/web/src/hooks/use-chat/form-request-frame.ts;小程序接线时若端内再抄一份,
//   就是本仓最高频的失效型 —— 同一判据两份必然漂移。迁移后 web 侧只剩 re-export,
//   判据行为一字不改(旧测试路径不动,全绿即证)。
//
// 认领层(parseFormRequestLine)为什么也在共享包、而不在端内:
//   ① @ihui/shared/utils/sse-parse 没有认领 form_request(现读 grep 0 命中)——带一个
//     字符串 sessionId,不认领就滑到 `⇒ {type:'meta', sessionId}` 的泛化兜底被折成一条
//     meta 帧,kind/fields/actions 全丢(与 D151 terminal_interaction 同型);该文件在
//     本票禁改面内,不替跨端裁决改共享解析面。
//   ② @ihui/api-client 的同一条解析腿(streamChat 闭包里的 tryParseFormRequest)
//     **不导出**,而小程序传输层是自己的 src/lib/sse.ts,不走 streamChat。
//   ⇒ 字段收窄口径在这里落一份,但只落"读哪些线字段"这一层,镜像锁由常驻测试对着
//   api-client 源码钉住(键清单漂移即红),不是"写了就算"。

import type { FormRequestFieldPayload, FormRequestFramePayload } from '../sse/contract'

import { isBusinessFormKind, type BusinessFormKind } from './business-forms'

// ---------------------------------------------------------------------------
// ① 线帧认领(SSE 整行 → 解析后事件;畸形帧一律 null,绝不半帧放行)
// ---------------------------------------------------------------------------

/** 帧名(SSE data 里的 type 值);与 @ihui/shared/sse/contract.ts 的 SSE_EVENTS.FORM_REQUEST 同字。 */
export const FORM_REQUEST_FRAME_TYPE = 'form_request'

/**
 * 廉价预筛:整行原文不含该标记就绝不 JSON.parse。
 * (与 miniapp 的 maybeToolApprovalLine 同纪律:正文 delta 是热路径,逐帧 parse 代价不白付。)
 */
export function maybeFormRequestLine(line: string): boolean {
  return typeof line === 'string' && line.includes(`"${FORM_REQUEST_FRAME_TYPE}"`)
}

/** 去掉 SSE `data:` 前缀(与 @ihui/shared 的 dataPayloadOfLine 同规矩);非 data 行返回 null。 */
function dataPayloadOfLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) return null
  if (line.startsWith('data:')) return line.slice(5).replace(/^\s/, '')
  return line
}

/**
 * 一行 SSE 文本 → form_request 解析后事件;不是这一族帧(或畸形)⇒ null(丢弃,不猜)。
 *
 * 字段收窄口径与 @ihui/api-client client.ts 的 tryParseFormRequest **逐字同**
 * (由 business-form-wiring 镜像锁钉住):
 *  · `requestId` / `kind` 必须是非空 string,否则整帧不要;
 *  · `fields` 必须是非空数组,逐项收窄(key 非空 string,type 缺省 'text',
 *    required 仅 true 才算,placeholderKey 可选);收窄后仍为空 ⇒ 整帧不要;
 *  · `actions` 必须同时含 'approve' 与 'reject'(只给一边 = 替用户做完决定);
 *  · `sessionId` / `messageId` 可选透传,缺席不带键(不写空串顶掉"未知"态)。
 *
 * 返回的对象**不含 `type` 键** —— 契约(FormRequestFramePayload)描述的是"到达端的
 * 东西",type 是解析层的判别依据,不是消费方的载荷(与 contract.ts 的登记口径一致)。
 */
export function parseFormRequestLine(line: string): FormRequestFramePayload | null {
  const payload = dataPayloadOfLine(line)
  if (!payload || payload === '[DONE]' || !maybeFormRequestLine(payload)) return null
  let json: Record<string, unknown>
  try {
    json = JSON.parse(payload) as Record<string, unknown>
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

// ---------------------------------------------------------------------------
// ② 投影(线帧 → 端内渲染态;从 apps/web/hooks/use-chat/form-request-frame.ts 迁入)
// ---------------------------------------------------------------------------

/**
 * 一条待应答/已应答的表单请求在消息流里的渲染态。
 *
 * 与 web 端 store 的 BusinessFormEntry 同形(status 联合含 'pending'),
 * 可直接赋值给那一侧的 appendFormRequest —— web re-export 后旧调用点零改动。
 */
export interface BusinessFormFrameEntry {
  /** 应答锚点,原样回给 form_response */
  requestId: string
  /** 上行回传通道;缺省即无通道(不发 form_response,只留痕,由宿主如实置 failed) */
  sessionId?: string
  kind: BusinessFormKind
  /** 挂载到哪条 assistant 消息(帧未带时由调用方给本轮流消息锚点) */
  messageId: string
  /** 成对动作(协议保证恒为 approve + reject) */
  actions: readonly string[]
  /** 端内初始态恒为 pending;sent/failed 由宿主在上行应答后改判 */
  status: 'pending'
}

/** 协议要求的成对动作:缺任何一条就是一张"只能批准"或"只能拒绝"的表单 ⇒ 不渲染。 */
const REQUIRED_ACTIONS: readonly ['approve', 'reject'] = ['approve', 'reject']

function hasPairedActions(actions: readonly string[] | undefined): boolean {
  if (!Array.isArray(actions)) return false
  return REQUIRED_ACTIONS.every((need) => actions.includes(need))
}

/**
 * 把一条 `form_request` 帧投影成消息流里的一个待应答表单项。
 *
 * @param frame       线帧(api-client / 本文件认领层已保证线格式合法,这里只查**语义**合法)
 * @param fallbackMessageId 帧未带 messageId 时挂到哪条 assistant 消息 = 本轮流消息 ID
 * @returns 端内渲染态;`null` = 该帧不该变成一张表单(未知 kind / 缺锚点 / 动作不成对)
 *
 * 三种 `null` 的理由各不相同,共同点是**不给用户一张填不了或交不出去的表单**:
 *  · 缺 `requestId` —— 应答没有锚点,用户填完也关联不回那次请求;
 *  · 未知 `kind`   —— 字段表在判定层(`BUSINESS_FORM_FIELDS`)按 kind 派发,
 *                     未知 kind 没有字段可渲染,弹一张空卡比不弹更坏;
 *  · 动作不成对    —— 只有 approve 就是"不许拒绝",违反本票硬约束(拒绝零副作用)。
 */
export function projectFormRequestFrame(
  frame: FormRequestFramePayload,
  fallbackMessageId: string,
): BusinessFormFrameEntry | null {
  if (!frame || typeof frame.requestId !== 'string' || frame.requestId.length === 0) return null
  if (!isBusinessFormKind(frame.kind)) return null
  if (!hasPairedActions(frame.actions)) return null

  const messageId =
    frame.messageId && frame.messageId.length > 0 ? frame.messageId : fallbackMessageId
  if (messageId.length === 0) return null

  return {
    requestId: frame.requestId,
    ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
    kind: frame.kind,
    messageId,
    actions: frame.actions,
    status: 'pending',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
