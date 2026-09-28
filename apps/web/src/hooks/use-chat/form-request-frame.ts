// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// V3 #63(2026-09-27 立)—— `form_request` 线帧 → web 端渲染态的**唯一投影**。
//
// 为什么单独一个模块而不写在 send-message.ts 体内:
//   ① send-message.ts 是 1,400 行的流式主体,它的单测要拖起整条 api-client/store 图;
//      投影是**纯函数**,单独放才有端到端的判据用例(见
//      `apps/web/src/components/chat/__tests__/form-request-frame.test.ts`)。
//   ② 判据("什么样的帧才配渲染成一张表单")必须只有一处。写在回调里就会出现
//      "解析层一套、渲染层另一套"的第二份判定 —— 本仓最高频的失效型。
//
// 与契约的关系:入参类型即 `@ihui/shared` 登记的 `FormRequestFramePayload`
// (V3 #63 正式登记段)。该类型与 `@ihui/api-client` 的 `FormRequestEvent` 逐字段
// 同形,两侧任一改形状都会让
// `apps/web/src/components/chat/__tests__/form-request-contract.test.ts` 的
// 双向可赋值断言变红 —— 那是"登记了但没人对齐"的唯一自动化看护。
//
// 生产侧现状(如实登记,不得读成"已上线"):后端两侧对 `form_request` **零生产点**,
// 因此这条通道今天不会命中;解阻前置三条写在 contract.ts 的 `FORM_FRAME_EVENTS`
// 注释③。本模块的存在不是"造一条永远不响的通道"的一半 —— 它把已存在的解析通道
// (api-client `onFormRequest`)接到已存在的宿主(BusinessFormSection),
// 让"补上生产点"成为唯一缺的那一块,并且给了它一个可注入、可测的落点。

import { isBusinessFormKind } from '@ihui/shared'

import type { FormRequestFramePayload } from '@ihui/shared'

import type { BusinessFormEntry } from '@/stores/business-forms'

/** 协议要求的成对动作:缺任何一条就是一张"只能批准"或"只能拒绝"的表单 ⇒ 不渲染。 */
const REQUIRED_ACTIONS: readonly ['approve', 'reject'] = ['approve', 'reject']

function hasPairedActions(actions: readonly string[] | undefined): boolean {
  if (!Array.isArray(actions)) return false
  return REQUIRED_ACTIONS.every((need) => actions.includes(need))
}

/**
 * 把一条 `form_request` 帧投影成消息流里的一个待应答表单项。
 *
 * @param frame       线帧(api-client 解析层已保证结构合法,这里只查**语义**合法)
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
): BusinessFormEntry | null {
  if (!frame || typeof frame.requestId !== 'string' || frame.requestId.length === 0) return null
  if (!isBusinessFormKind(frame.kind)) return null
  if (!hasPairedActions(frame.actions)) return null

  const messageId = frame.messageId && frame.messageId.length > 0 ? frame.messageId : fallbackMessageId
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
