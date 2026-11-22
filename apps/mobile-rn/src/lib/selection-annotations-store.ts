// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RN 端会话批注存储(对齐 web `apps/web/src/stores/d180-selection-annotations.ts`)。
// 模块级轻量 store,用 React 内置 useSyncExternalStore 订阅,不引入额外状态库
// (RN 端未采用 zustand,状态靠 props 回调提升;本 store 仅承载「消息级批注」这种
// 跨消息共享且需活过导航/杀进程重开的轻量数据)。
//
// 与 web 的三处刻意对齐(2026-10-19 逐条对账):
// ① **归属键是复合键** `${conversationId}::${messageId}`,不是裸 messageId —— 归属进数据结构
//    才是"批注活过重进会话"的机制;裸键在切换对话后会把上一段对话的批注挂到同 id 消息上。
// ② **落盘**:web 走 zustand persist → localStorage,RN 走本仓既有
//    `stores/storage-adapter.ts` 的 AsyncStorage transport(不另造第二套存储机制);
//    键名与 web 的 `ihui-d180-selection-annotations` 同名,两端台账可对账。
// ③ **语义**:web 的批注是纯展示簿,全仓无消费方把它拼进下一轮 prompt
//    (真正入上下文的是并行的 D22 引用芯片与 D184 附件),故本端同样只做展示,不假装能"带批注追问"。
//
// **输入粒度是平台差异,不是缺陷**:web 靠 DOM 选区采到"选中子串",RN 0.86 的 `<Text>`
// 只有 `selectable`/`selectionColor`、没有 `onSelectionChange`,Android 的 `selectable`
// 也只落到 `view.setTextIsSelectable` 而无 JS 回调 ⇒ 本端锚定**整条消息原文**。
// 改成只读 TextInput 采选区在 Android 侧会把 `editable={false}` 变成 disabled
// (`ReactTextInputManager.kt` 里 `setEditable → view.isEnabled`),且会打断正文里
// ActionAnchorChip/图片/代码分段与长按菜单的手势 —— 取舍与依据见 PROJECT_PLAN 对齐登记。

import { useSyncExternalStore } from 'react'

import { createAsyncStorageTransport } from '../stores/storage-adapter'

/** 落盘键(与 web localStorage 键同名,便于两端对账) */
const STORAGE_KEY = 'ihui-d180-selection-annotations'

/** 单条消息批注 */
export interface SelectionAnnotation {
  /** 稳定 id(本端生成) */
  id: string
  /** 被批注的原文(web 为 DOM 选区文本;RN 适配为整条消息文本,见文件头取舍说明) */
  text: string
  /** 用户评论(空串表示「未添加评论」,与 web 同形) */
  comment: string
  /** 创建时间戳(ms),仅用于将来排序/调试,不参与渲染判据 */
  createdAt: number
}

/** 批注归属复合键(渲染层与写入层共用一份实现,不各自拼字符串) */
export function selectionAnnotationKey(conversationId: string | null, messageId: string): string {
  return `${conversationId ?? ''}::${messageId}`
}

/** 稳定空引用:未命中时返回它,避免每次渲染新数组造成重渲染风暴(与 web 同因) */
const EMPTY: readonly SelectionAnnotation[] = []

type Listener = () => void

let current: Record<string, SelectionAnnotation[]> = {}
const listeners = new Set<Listener>()

function emit(): void {
  listeners.forEach((l) => l())
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Record<string, SelectionAnnotation[]> {
  return current
}

const transport = createAsyncStorageTransport()

/** PersistTransport 的写入可能是同步 void(测试替身),也可能是 Promise */
function isPromiseLike(value: unknown): value is Promise<unknown> {
  return typeof (value as { catch?: unknown } | null)?.catch === 'function'
}

function mutate(
  updater: (prev: Record<string, SelectionAnnotation[]>) => Record<string, SelectionAnnotation[]>,
): void {
  current = updater(current)
  emit()
  // 落盘失败(配额/原生模块缺席)不得打断交互:批注仍在内存里,只是活不过本次会话。
  // PersistTransport 的 setItem 声明允许返回 void(同步实现),故按 thenable 兜一层。
  try {
    const written = transport.setItem(STORAGE_KEY, JSON.stringify(current))
    if (isPromiseLike(written)) void written.catch(() => undefined)
  } catch {
    // 同步抛错(存储不可用)同样只记在内存态,不影响本轮交互
  }
}

/** 冷启动回填:取不到就保持空态,绝不把解析失败折成"没有批注"以外的行为 */
export async function rehydrateSelectionAnnotations(): Promise<void> {
  try {
    const raw = await transport.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined || raw === '') return
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return
    current = parsed as Record<string, SelectionAnnotation[]>
    emit()
  } catch {
    // 解析失败/存储不可用:保持空态(不 emit,不改现状)
  }
}

/** 新增一条批注(text 为原文,comment 可后补;空文本丢弃,与 web 同形) */
export function addAnnotation(
  conversationId: string | null,
  messageId: string,
  text: string,
): void {
  const trimmed = text.trim()
  if (trimmed === '') return
  const key = selectionAnnotationKey(conversationId, messageId)
  const id = `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  mutate((prev) => ({
    ...prev,
    [key]: [...(prev[key] ?? []), { id, text: trimmed, comment: '', createdAt: Date.now() }],
  }))
}

/** 为某条批注补/改评论 */
export function setComment(
  conversationId: string | null,
  messageId: string,
  id: string,
  comment: string,
): void {
  const key = selectionAnnotationKey(conversationId, messageId)
  mutate((prev) => ({
    ...prev,
    [key]: (prev[key] ?? []).map((a) => (a.id === id ? { ...a, comment } : a)),
  }))
}

/** 移除单条批注(清空即撤键,不留空数组) */
export function removeAnnotation(
  conversationId: string | null,
  messageId: string,
  id: string,
): void {
  const key = selectionAnnotationKey(conversationId, messageId)
  mutate((prev) => {
    const rest = (prev[key] ?? []).filter((a) => a.id !== id)
    if (rest.length === prev[key]?.length) return prev
    const next = { ...prev }
    if (rest.length === 0) delete next[key]
    else next[key] = rest
    return next
  })
}

/** 移除某消息的全部批注 */
export function removeAllAnnotations(conversationId: string | null, messageId: string): void {
  const key = selectionAnnotationKey(conversationId, messageId)
  mutate((prev) => {
    if (prev[key] === undefined) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })
}

/** 订阅单条消息的批注列表(无批注返回稳定空引用) */
export function useSelectionAnnotations(
  conversationId: string | null,
  messageId: string,
): readonly SelectionAnnotation[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return all[selectionAnnotationKey(conversationId, messageId)] ?? EMPTY
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
