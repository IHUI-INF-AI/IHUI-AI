// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/** 会话级采样参数 + 自定义 system prompt(P1-7,2026-09-13 立)
 *
 * 对标 CodeX / Qoder / Trae 的「高级参数」面板:
 * - temperature / top_p / top_k / max_tokens 四项采样参数
 * - 自定义 system prompt(注入到系统消息最顶部,与工作区记忆叠加)
 *
 * 全部字段可选:undefined = 使用模型默认值(不向上游注入该 key)。
 */
export interface SamplingParams {
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  systemPrompt?: string
}

/** 取值范围:与后端 zod(chatStreamSchema)/ Pydantic 校验保持一致,前端先拦一层 */
export const SAMPLING_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.1 },
  topP: { min: 0, max: 1, step: 0.05 },
  topK: { min: 1, max: 1000, step: 1 },
  maxTokens: { min: 1, max: 200000, step: 1 },
  /** 与后端 z.string().max(8000) 对齐 */
  systemPromptMax: 8000,
} as const

export type SamplingParamKey = keyof SamplingParams

interface SamplingParamsState {
  /** 全局默认参数(所有会话的初始值);「新会话」或未做会话级自定义时生效 */
  defaults: SamplingParams
  /** 会话级覆盖,键 = conversationId。仅保存用户显式改过的会话,
   *  取值为「key 存在即覆盖」语义 —— 清除某 key 时直接 delete,
   *  空对象则整条移除,从而自然回落到 defaults(不会出现 undefined 遮蔽)。 */
  byConversation: Record<string, SamplingParams>

  /** 写入参数:conversationId 为空(未建会话)时写 defaults,否则写会话覆盖 */
  setParam: (
    conversationId: string | null | undefined,
    key: SamplingParamKey,
    value: number | string | undefined,
  ) => void
  /** 把某个会话的当前参数提升为全局默认 */
  promoteToDefaults: (conversationId: string | null | undefined) => void
  /** 清空某个会话的全部覆盖(回落到全局默认) */
  clearConversation: (conversationId: string) => void
  /** 清空全局默认 */
  resetDefaults: () => void
}

/** 归一化:undefined / 空串 / NaN 视为「未设置」(delete 该 key) */
function normalizeValue(value: number | string | undefined): number | string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    const trimmed = value
    return trimmed.length === 0 ? undefined : trimmed
  }
  if (!Number.isFinite(value)) return undefined
  return value
}

/** 写入目标对象(不可变更新):value 归一化后为 undefined 则 delete,保证不会被 undefined 遮蔽 */
function applyParam(
  target: SamplingParams,
  key: SamplingParamKey,
  value: number | string | undefined,
): SamplingParams {
  const next: SamplingParams = { ...target }
  const normalized = normalizeValue(value)
  if (normalized === undefined) {
    delete next[key]
  } else {
    next[key] = normalized as never
  }
  return next
}

export const useSamplingParamsStore = create<SamplingParamsState>()(
  persist(
    (set) => ({
      defaults: {},
      byConversation: {},

      setParam: (conversationId, key, value) =>
        set((state) => {
          if (!conversationId) {
            return { defaults: applyParam(state.defaults, key, value) }
          }
          const current = state.byConversation[conversationId] ?? {}
          const nextParams = applyParam(current, key, value)
          const nextMap = { ...state.byConversation }
          // 空对象整条移除:避免 localStorage 里堆积空覆盖,也让回落逻辑保持单一来源
          if (Object.keys(nextParams).length === 0) {
            delete nextMap[conversationId]
          } else {
            nextMap[conversationId] = nextParams
          }
          return { byConversation: nextMap }
        }),

      promoteToDefaults: (conversationId) =>
        set((state) => {
          const scoped = conversationId ? state.byConversation[conversationId] : undefined
          const merged = { ...state.defaults, ...(scoped ?? {}) }
          const nextMap = { ...state.byConversation }
          if (conversationId) delete nextMap[conversationId]
          return { defaults: merged, byConversation: nextMap }
        }),

      clearConversation: (conversationId) =>
        set((state) => {
          if (!state.byConversation[conversationId]) return state
          const nextMap = { ...state.byConversation }
          delete nextMap[conversationId]
          return { byConversation: nextMap }
        }),

      resetDefaults: () => set({ defaults: {} }),
    }),
    // 只持久化数据字段,action 不落盘
    createPersistConfig<SamplingParamsState>('ihui-sampling-params', (state) => ({
      defaults: state.defaults,
      byConversation: state.byConversation,
    })),
  ),
)

/** 合并解析:全局默认 + 会话覆盖(会话覆盖优先) */
export function resolveSamplingParams(
  defaults: SamplingParams,
  byConversation: Record<string, SamplingParams>,
  conversationId?: string | null,
): SamplingParams {
  const scoped = conversationId ? byConversation[conversationId] : undefined
  return { ...defaults, ...(scoped ?? {}) }
}

/** 非 Hook 取数入口(供 send-message / send-answer 在事件回调里读取) */
export function getSamplingParams(conversationId?: string | null): SamplingParams {
  const { defaults, byConversation } = useSamplingParamsStore.getState()
  return resolveSamplingParams(defaults, byConversation, conversationId)
}

/** 是否已自定义任意参数(用于触发器高亮/角标) */
export function hasAnySamplingParam(params: SamplingParams): boolean {
  return Object.keys(params).length > 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
