import { create } from 'zustand'

import type {
  CreateHookInput,
  Hook,
  HookAction,
  HookTriggerEvent,
  TestHookResult,
} from '@ihui/types'

/**
 * Hook 管理本地状态(2026-07-22 立)。
 *
 * 设计:
 *  - 列表 + 日志由 react-query(useHooks)管理,本 store 只管"编辑器对话框"的本地状态
 *  - 编辑器对话框:打开/关闭 + 当前编辑的 Hook 草稿 + 测试结果展示
 *  - 草稿独立于服务端数据,保存时才提交;关闭对话框时丢弃草稿
 *
 * 与 useHooks 的协作:
 *  - useHooks 负责数据获取 + mutation
 *  - 本 store 负责对话框 UI 状态(哪些字段在编辑、测试结果展示等)
 */

/** 编辑器模式:创建新 Hook / 编辑已有 Hook / 关闭 */
export type HookEditorMode = 'closed' | 'create' | 'edit'

/** Hook 编辑器草稿(表单字段,允许部分缺失) */
export interface HookDraft {
  id?: string
  name: string
  description: string
  event: HookTriggerEvent
  condition: string
  actionType: HookAction['type']
  // webhook
  webhookUrl: string
  webhookMethod: 'GET' | 'POST' | 'PUT'
  webhookHeaders: string // JSON 文本
  webhookBody: string
  // script
  scriptCommand: string
  // notify
  notifyChannel: 'toast' | 'notification' | 'email'
  notifyMessage: string
  // log
  logMessage: string
  enabled: boolean
}

/** 空 Hook 草稿(创建模式默认值) */
export const EMPTY_HOOK_DRAFT: HookDraft = {
  name: '',
  description: '',
  event: 'tool.before',
  condition: '',
  actionType: 'log',
  webhookUrl: '',
  webhookMethod: 'POST',
  webhookHeaders: '{\n  "Content-Type": "application/json"\n}',
  webhookBody: '{\n  "event": "{{event}}",\n  "tool": "{{tool}}"\n}',
  scriptCommand: '',
  notifyChannel: 'toast',
  notifyMessage: '{{event}} 触发',
  logMessage: '{{event}} on {{tool}}',
  enabled: true,
}

/** 把 HookDraft 转成 CreateHookInput(提交时用) */
export function draftToCreateInput(draft: HookDraft): CreateHookInput {
  const action = buildActionFromDraft(draft)
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    event: draft.event,
    condition: draft.condition.trim() || null,
    action,
    enabled: draft.enabled,
  }
}

/** 把 HookDraft 转成 Patch(部分字段,编辑模式用) */
export function draftToUpdateInput(draft: HookDraft): Partial<CreateHookInput> {
  const action = buildActionFromDraft(draft)
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    event: draft.event,
    condition: draft.condition.trim() || null,
    action,
    enabled: draft.enabled,
  }
}

/** 从 Hook 实体构建草稿(编辑模式回填) */
export function hookToDraft(hook: Hook): HookDraft {
  const action = hook.action || ({ type: 'log', config: {} } as HookAction)
  const config = action.config || {}
  let webhookHeadersText = '{\n  "Content-Type": "application/json"\n}'
  if (config.headers) {
    try {
      webhookHeadersText = JSON.stringify(config.headers, null, 2)
    } catch {
      // 保持默认
    }
  }
  return {
    id: hook.id,
    name: hook.name,
    description: hook.description ?? '',
    event: hook.event,
    condition: hook.condition ?? '',
    actionType: action.type,
    webhookUrl: config.url ?? '',
    webhookMethod: config.method ?? 'POST',
    webhookHeaders: webhookHeadersText,
    webhookBody: config.body ?? '',
    scriptCommand: config.command ?? '',
    notifyChannel: config.channel ?? 'toast',
    notifyMessage: config.message ?? '',
    logMessage: config.message ?? '',
    enabled: hook.enabled,
  }
}

/** 从草稿构建 HookAction */
function buildActionFromDraft(draft: HookDraft): HookAction {
  const type = draft.actionType
  if (type === 'webhook') {
    let headers: Record<string, string> | undefined
    try {
      const parsed = JSON.parse(draft.webhookHeaders || '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        headers = parsed as Record<string, string>
      }
    } catch {
      // JSON 解析失败,忽略 headers
    }
    return {
      type: 'webhook',
      config: {
        url: draft.webhookUrl.trim() || undefined,
        method: draft.webhookMethod,
        headers,
        body: draft.webhookBody.trim() || undefined,
      },
    }
  }
  if (type === 'script') {
    return {
      type: 'script',
      config: {
        command: draft.scriptCommand.trim() || undefined,
      },
    }
  }
  if (type === 'notify') {
    return {
      type: 'notify',
      config: {
        channel: draft.notifyChannel,
        message: draft.notifyMessage.trim() || undefined,
      },
    }
  }
  // log
  return {
    type: 'log',
    config: {
      message: draft.logMessage.trim() || undefined,
    },
  }
}

interface HooksStoreState {
  /** 编辑器模式 */
  editorMode: HookEditorMode
  /** 当前草稿 */
  draft: HookDraft
  /** 测试结果(最近一次) */
  testResult: TestHookResult | null
  /** 测试中的 Hook id */
  testingHookId: string | null
  /** 日志查看中的 Hook id(null = 关闭日志面板) */
  viewingLogsHookId: string | null

  // Actions
  openCreate: () => void
  openEdit: (hook: Hook) => void
  closeEditor: () => void
  setDraft: (patch: Partial<HookDraft>) => void
  setTestResult: (result: TestHookResult | null) => void
  setTestingHookId: (id: string | null) => void
  openLogs: (hookId: string) => void
  closeLogs: () => void
}

export const useHooksStore = create<HooksStoreState>((set) => ({
  editorMode: 'closed',
  draft: EMPTY_HOOK_DRAFT,
  testResult: null,
  testingHookId: null,
  viewingLogsHookId: null,

  openCreate: () =>
    set({
      editorMode: 'create',
      draft: { ...EMPTY_HOOK_DRAFT },
      testResult: null,
    }),

  openEdit: (hook) =>
    set({
      editorMode: 'edit',
      draft: hookToDraft(hook),
      testResult: null,
    }),

  closeEditor: () =>
    set({
      editorMode: 'closed',
      draft: EMPTY_HOOK_DRAFT,
      testResult: null,
    }),

  setDraft: (patch) =>
    set((s) => ({ draft: { ...s.draft, ...patch } })),

  setTestResult: (result) => set({ testResult: result }),
  setTestingHookId: (id) => set({ testingHookId: id }),
  openLogs: (hookId) => set({ viewingLogsHookId: hookId }),
  closeLogs: () => set({ viewingLogsHookId: null }),
}))
