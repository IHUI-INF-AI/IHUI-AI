// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提问草稿的共享存储段(2026-11-07)。
 *
 * 立因:`pages/ask/create` 的草稿读写一直写在端内(`Taro.getStorageSync` / `setStorageSync` /
 * `removeStorageSync`),RN 侧没有草稿能力。本段把"挂载恢复 + 防抖自动保存 + 提交后清除"
 * 收到 packages/app,存储一律走注入的 `AsyncKvPort`:
 *   - 小程序: `Taro.*StorageSync` 的异步包装(apps/miniapp-taro/src/host/ask-create-ports.ts)
 *   - RN: `@react-native-async-storage/async-storage`(apps/mobile-rn/src/screens/AskCreateScreen.tsx)
 *
 * 之所以另立 `AsyncKvPort` 而不复用同步 `KvPort`:RN AsyncStorage 只有异步 API,
 * 同步端口在 RN 侧只能造假实现 —— 那是把"端口"演成装饰,不是真消费。
 */

import { useEffect, useRef } from 'react'
import { assertRequiredPort, isPortErrorState } from '../../host/ports'
import type { AsyncKvPort, OnToast } from '../../host/ports'

/** 与改动前端内常量同值,保证老草稿仍能被读回。 */
export const ASK_DRAFT_KEY = 'ask_create_draft'

/** 恢复判定:标题或内容任一非空才算"有草稿"(与端内旧判据逐字一致)。 */
export function normalizeAskDraft(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const title = typeof value.title === 'string' ? value.title : ''
  const content = typeof value.content === 'string' ? value.content : ''
  if (!title && !content) return null
  return value
}

/** 读取草稿。端口缺失时 dev 抛 `[host-port] missing draft`;产物态按"无草稿"处理。 */
export async function readAskDraft<T extends object>(
  draft: AsyncKvPort | null | undefined,
): Promise<Partial<T> | null> {
  const port = assertRequiredPort('draft', draft)
  if (isPortErrorState(port)) return null
  let raw: unknown = null
  try {
    raw = await port.get<unknown>(ASK_DRAFT_KEY)
  } catch {
    return null
  }
  return normalizeAskDraft(raw) as Partial<T> | null
}

/** 写入草稿(`set` 内部序列化,失败不抛)。 */
export async function writeAskDraft<T extends object>(
  draft: AsyncKvPort | null | undefined,
  values: T,
): Promise<void> {
  const port = assertRequiredPort('draft', draft)
  if (isPortErrorState(port)) return
  try {
    await port.set(ASK_DRAFT_KEY, values)
  } catch {
    // 与旧实现一致:存储失败不影响编辑
  }
}

/** 清除草稿(提交成功后调用)。 */
export async function clearAskDraft(draft: AsyncKvPort | null | undefined): Promise<void> {
  const port = assertRequiredPort('draft', draft)
  if (isPortErrorState(port)) return
  try {
    await port.remove(ASK_DRAFT_KEY)
  } catch {
    // ignore
  }
}

export interface UseAskDraftOptions<T extends object> {
  draft: AsyncKvPort
  onRestore: (values: Partial<T>) => void
  /** 恢复提示文案由宿主给出;留空则不提示(RN 侧无既有草稿文案). */
  restoredMessage?: string
  onToast?: OnToast
  debounceMs?: number
}

export interface UseAskDraftResult<T extends object> {
  save: (values: T) => void
  clear: () => Promise<void>
}

/**
 * 草稿共享钩子:挂载恢复一次,`save` 防抖落盘,`clear` 取消待写并删除。
 * 防抖 800ms 与端内旧实现同值,不借机改交互。
 */
export function useAskDraft<T extends object>({
  draft,
  onRestore,
  restoredMessage,
  onToast,
  debounceMs = 800,
}: UseAskDraftOptions<T>): UseAskDraftResult<T> {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoreRef = useRef(onRestore)
  const toastRef = useRef(onToast)
  restoreRef.current = onRestore
  toastRef.current = onToast

  useEffect(() => {
    let alive = true
    void readAskDraft<T>(draft).then((saved) => {
      if (!alive || !saved) return
      restoreRef.current(saved)
      if (restoredMessage) toastRef.current?.(restoredMessage, { kind: 'info' })
    })
    return () => {
      alive = false
    }
    // 只在挂载时恢复一次;后续编辑不应反复把旧草稿盖回来
  }, [])

  const save = (values: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void writeAskDraft(draft, values)
    }, debounceMs)
  }

  const clear = async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    await clearAskDraft(draft)
  }

  return { save, clear }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
