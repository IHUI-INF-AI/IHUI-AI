// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77 对话流业务表单(2026-09-25 立,G-106)—— web 端表单请求的渲染态。
//
// 为什么单独一个 store 而不塞进 `stores/chat.ts` 的 ChatMessage:
//   消息级"业务动作待应答"是一个**独立生命周期**(请求 → 填写 → 上行应答 → 终态),
//   而 ChatMessage 的形状权威在 `@ihui/types`(本票不得改),挂上去等于在端内私加字段。
//   这里只承载渲染态,数据面仍在 ai-service(另票)。
//
// 形状权威:wire 上的 form_request / form_response 定义在
// `packages/shared/src/sse/contract.ts`(解析通道在 `@ihui/api-client` 的 onFormRequest)。
// 本文件只在其之上加"端内可见的状态位"(status / 应答留痕),不重定义字段表。

import { create } from 'zustand'

import { BUSINESS_FORM_KINDS, type BusinessFormKind } from '@ihui/shared/chat/business-forms'

/**
 * D77 收口格(2026-10-23):表单应答的**持久裁决态**,来自 ai-service 读口
 * `GET /llm/complete/stream/{session_id}/form-response?request_id=…` 的回显。
 * 与 `status`(本地回传通道成败)是两个正交事实:status 说"应答发出去了没有",
 * responseState 说"库里到底存了哪一条裁决"。undefined = 还没查到/查询失败
 * (fail-soft 下卡片保持可填,绝不假造终态)。
 */
export type FormResponseStatus = 'pending' | 'approved' | 'rejected'

/** 一条待应答/已应答的表单请求(message 级) */
export interface BusinessFormEntry {
  /** 应答锚点,原样回给 form_response */
  requestId: string
  /** 上行回传通道;缺省即无通道(不发 form_response,只留痕) */
  sessionId?: string
  kind: BusinessFormKind
  /** 表单形态(create/update/save),原样取自线帧 mode 槽;缺省由卡片按 create 档处理 */
  mode?: string
  /** 挂载到哪条 assistant 消息 */
  messageId: string
  /** 成对动作(协议保证恒为 approve + reject) */
  actions: readonly string[]
  /** 端内状态:pending=等用户填,failed=上行应答发不出去(可重试),sent=已回传 */
  status: 'pending' | 'sent' | 'failed'
  /** 失败原因(界面不直出后端文本,仅留痕供诊断) */
  error?: string
  /** 读口回显的持久裁决态(见 FormResponseStatus);undefined=未查到/查询失败 */
  responseState?: FormResponseStatus
}

interface BusinessFormState {
  /** key = messageId;同一消息可有零到多条表单请求(按到达顺序) */
  byMessage: Record<string, BusinessFormEntry[]>
  appendFormRequest: (entry: BusinessFormEntry) => void
  markFormResponse: (requestId: string, status: 'sent' | 'failed', error?: string) => void
  /** 写读口回显的持久裁决态(D77 收口格:刷新/重进会话后卡片据此显终态) */
  setFormResponseState: (requestId: string, state: FormResponseStatus) => void
  /**
   * 回收"本窗格本会话刚离开的那批消息"上的表单。
   *
   * 为什么按消息集清、而不是整表清(票60 普查@2026-10-21):`byMessage` 是全局面板,
   * 而多窗格并存时每个窗格各自在切会话 —— 整表 `clearForms()` 等于**任一窗格一切换就
   * 把别的窗格填到一半的表单一起抹掉**(用户可见的数据丢失)。键本来就是 messageId,
   * 所以清理动作按调用方自己见过的消息集收窄即可,不需要第二份"按窗格分表"的结构。
   */
  clearFormsForMessages: (messageIds: readonly string[]) => void
}

function isKnownKind(value: string): value is BusinessFormKind {
  return (BUSINESS_FORM_KINDS as readonly string[]).includes(value)
}

/** 判定字符串是否为契约已知表单种类(未知 kind 不渲染 —— 不给一张填不了的表单) */
export const isBusinessFormKindValue = isKnownKind

export const useBusinessFormStore = create<BusinessFormState>((set) => ({
  byMessage: {},

  appendFormRequest: (entry) =>
    set((state) => {
      const existing = state.byMessage[entry.messageId] ?? []
      // 同 requestId 重复下发(断线重连回放)按幂等覆盖,不重复渲染两张卡
      const next = existing.some((e) => e.requestId === entry.requestId)
        ? existing.map((e) => (e.requestId === entry.requestId ? entry : e))
        : [...existing, entry]
      return { byMessage: { ...state.byMessage, [entry.messageId]: next } }
    }),

  markFormResponse: (requestId, status, error) =>
    set((state) => {
      const byMessage: Record<string, BusinessFormEntry[]> = {}
      for (const [messageId, list] of Object.entries(state.byMessage)) {
        byMessage[messageId] = list.map((e) =>
          e.requestId === requestId ? { ...e, status, ...(error ? { error } : {}) } : e,
        )
      }
      return { byMessage }
    }),

  setFormResponseState: (requestId, responseState) =>
    set((state) => {
      const byMessage: Record<string, BusinessFormEntry[]> = {}
      for (const [messageId, list] of Object.entries(state.byMessage)) {
        byMessage[messageId] = list.map((e) =>
          e.requestId === requestId ? { ...e, responseState } : e,
        )
      }
      return { byMessage }
    }),

  clearFormsForMessages: (messageIds) =>
    set((state) => {
      const hit = messageIds.filter((id) => id in state.byMessage)
      if (hit.length === 0) return state
      const byMessage = { ...state.byMessage }
      for (const id of hit) delete byMessage[id]
      return { byMessage }
    }),
}))

/** 取某条消息上的表单请求(渲染宿主按消息 id 拉取) */
export function selectFormsForMessage(
  messageId: string,
  byMessage: Record<string, BusinessFormEntry[]>,
): BusinessFormEntry[] {
  return byMessage[messageId] ?? []
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
