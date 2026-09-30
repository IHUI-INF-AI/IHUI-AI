// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D180(2026-09-30 立,对标竞品 chatSession.selectionAnnotations.*):会话划词批注状态层。
// - 对象=「选中文字段」(区别于 ai.pane.annotation.* 的回复级整条批注,键组不混用);
// - 归属键 = conversationId + messageId 复合键(ownership 进数据结构 ⇒ 刷新后按会话/消息重放,
//   这正是"批注活过刷新"的全部机制:persist 工厂写 localStorage,store 重建时同步 rehydrate);
// - 持久化走既有 persist 工厂 createPersistConfig(localStorage,SSR 侧自动降级 noop),
//   与 code-block-prefs / conversation-org 等同层惯例,不造第二套存储机制。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/** 单条划词批注:选段原文 + 可选评论;序号由清单位置决定,不入数据。 */
export interface SelectionAnnotation {
  id: string
  /** 选段原文(展示于「{index}. 选中文字」之下) */
  text: string
  /** 可选评论;空串表示「未添加评论」 */
  comment: string
  /** 创建时间戳(ms),仅用于将来排序/调试,不参与渲染判据 */
  createdAt: number
}

interface SelectionAnnotationsState {
  /**
   * ownership:`${conversationId}::${messageId}` → 该消息上的批注清单(有序)。
   * 键里带会话与消息两级,刷新/重进会话后仍能按消息重放;无归属的裸数组做不到这一点。
   */
  annotationsByMessage: Record<string, SelectionAnnotation[]>
  addAnnotation: (conversationId: string, messageId: string, text: string) => void
  setComment: (
    conversationId: string,
    messageId: string,
    annotationId: string,
    comment: string,
  ) => void
  removeAnnotation: (conversationId: string, messageId: string, annotationId: string) => void
  removeAllAnnotations: (conversationId: string, messageId: string) => void
}

/** 批注归属复合键(渲染层/测试层共用,不各自拼字符串)。 */
export function selectionAnnotationKey(conversationId: string, messageId: string): string {
  return `${conversationId}::${messageId}`
}

/** 稳定空引用:选择器未命中时返回它,避免每次渲染新数组造成重渲染风暴。 */
export const EMPTY_SELECTION_ANNOTATIONS: SelectionAnnotation[] = []

let annotationIdSeq = 0
function nextAnnotationId(): string {
  annotationIdSeq += 1
  return `sa-${Date.now().toString(36)}-${annotationIdSeq.toString(36)}`
}

export const useSelectionAnnotationsStore = create<SelectionAnnotationsState>()(
  persist(
    (set) => ({
      annotationsByMessage: {},
      addAnnotation: (conversationId, messageId, text) =>
        set((s) => {
          const trimmed = text.trim()
          if (!trimmed) return s
          const key = selectionAnnotationKey(conversationId, messageId)
          const list = s.annotationsByMessage[key] ?? EMPTY_SELECTION_ANNOTATIONS
          return {
            annotationsByMessage: {
              ...s.annotationsByMessage,
              [key]: [
                ...list,
                { id: nextAnnotationId(), text: trimmed, comment: '', createdAt: Date.now() },
              ],
            },
          }
        }),
      setComment: (conversationId, messageId, annotationId, comment) =>
        set((s) => {
          const key = selectionAnnotationKey(conversationId, messageId)
          const list = s.annotationsByMessage[key]
          if (!list) return s
          return {
            annotationsByMessage: {
              ...s.annotationsByMessage,
              [key]: list.map((a) => (a.id === annotationId ? { ...a, comment } : a)),
            },
          }
        }),
      removeAnnotation: (conversationId, messageId, annotationId) =>
        set((s) => {
          const key = selectionAnnotationKey(conversationId, messageId)
          const list = s.annotationsByMessage[key]
          if (!list) return s
          const next = list.filter((a) => a.id !== annotationId)
          const map = { ...s.annotationsByMessage }
          if (next.length === 0) delete map[key]
          else map[key] = next
          return { annotationsByMessage: map }
        }),
      removeAllAnnotations: (conversationId, messageId) =>
        set((s) => {
          const key = selectionAnnotationKey(conversationId, messageId)
          if (!(key in s.annotationsByMessage)) return s
          const map = { ...s.annotationsByMessage }
          delete map[key]
          return { annotationsByMessage: map }
        }),
    }),
    createPersistConfig<SelectionAnnotationsState>('ihui-d180-selection-annotations', (s) => ({
      annotationsByMessage: s.annotationsByMessage,
    })),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
