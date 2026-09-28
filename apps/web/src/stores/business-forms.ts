// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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

/** 一条待应答/已应答的表单请求(message 级) */
export interface BusinessFormEntry {
  /** 应答锚点,原样回给 form_response */
  requestId: string
  /** 上行回传通道;缺省即无通道(不发 form_response,只留痕) */
  sessionId?: string
  kind: BusinessFormKind
  /** 挂载到哪条 assistant 消息 */
  messageId: string
  /** 成对动作(协议保证恒为 approve + reject) */
  actions: readonly string[]
  /** 端内状态:pending=等用户填,failed=上行应答发不出去(可重试),sent=已回传 */
  status: 'pending' | 'sent' | 'failed'
  /** 失败原因(界面不直出后端文本,仅留痕供诊断) */
  error?: string
}

interface BusinessFormState {
  /** key = messageId;同一消息可有零到多条表单请求(按到达顺序) */
  byMessage: Record<string, BusinessFormEntry[]>
  appendFormRequest: (entry: BusinessFormEntry) => void
  markFormResponse: (requestId: string, status: 'sent' | 'failed', error?: string) => void
  /** 切换会话/清空对话时回收,避免旧请求卡在新流里 */
  clearForms: () => void
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

  clearForms: () => set({ byMessage: {} }),
}))

/** 取某条消息上的表单请求(渲染宿主按消息 id 拉取) */
export function selectFormsForMessage(
  messageId: string,
  byMessage: Record<string, BusinessFormEntry[]>,
): BusinessFormEntry[] {
  return byMessage[messageId] ?? []
}
