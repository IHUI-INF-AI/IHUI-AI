// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 变更请求台账数据面(F-Forge,2026-11-13 立)
 *
 * 对标 DSH Forge 的「shared status polling」:
 *  - 同一工作区只保留一份快照(多个挂载点共享,不各自打网络);
 *  - 轮询计时器按工作区唯一,页面隐藏时跳过本轮(不浪费配额、不在后台空转);
 *  - in-flight 去重:面板挂载 + 手动刷新同时触发只发一次请求。
 *
 * 纪律:store 只管取数与缓存,不做任何"平台支持/凭据是否就绪"的判断 ——
 * 那些判据来自服务端快照与 `@ihui/types` 的纯函数。
 */

import { create } from 'zustand'
import type { ChangeRequestSnapshot } from '@ihui/types'
import { getChangeRequests } from '@ihui/api-client'

export interface ChangeRequestEntry {
  snapshot: ChangeRequestSnapshot | null
  loading: boolean
  error: string | null
  lastFetchedAt: number | null
}

interface ChangeRequestState {
  byWorkspace: Record<string, ChangeRequestEntry>
  fetch: (workspacePath: string, options?: { force?: boolean }) => Promise<void>
}

const EMPTY: ChangeRequestEntry = {
  snapshot: null,
  loading: false,
  error: null,
  lastFetchedAt: null,
}

/** 同一工作区的并发请求去重(store 外,避免触发额外渲染) */
const inFlight = new Set<string>()
/** 每个工作区唯一的轮询计时器 */
const timers = new Map<string, ReturnType<typeof setInterval>>()

export const useChangeRequestsStore = create<ChangeRequestState>((set, get) => ({
  byWorkspace: {},

  fetch: async (workspacePath, options) => {
    if (!workspacePath) return
    const entry = get().byWorkspace[workspacePath] ?? EMPTY
    if (inFlight.has(workspacePath)) return
    // 已有一份 5s 内的快照且非强制刷新 → 直接复用(轮询/切 Tab 不重复打)
    if (!options?.force && entry.lastFetchedAt && Date.now() - entry.lastFetchedAt < 5_000) return
    inFlight.add(workspacePath)
    set((s) => ({
      byWorkspace: {
        ...s.byWorkspace,
        [workspacePath]: { ...(s.byWorkspace[workspacePath] ?? EMPTY), loading: true, error: null },
      },
    }))
    try {
      const res = await getChangeRequests({ workspacePath })
      if (res.success && res.data) {
        set((s) => ({
          byWorkspace: {
            ...s.byWorkspace,
            [workspacePath]: {
              snapshot: res.data,
              loading: false,
              error: null,
              lastFetchedAt: Date.now(),
            },
          },
        }))
      } else {
        set((s) => ({
          byWorkspace: {
            ...s.byWorkspace,
            [workspacePath]: {
              ...(s.byWorkspace[workspacePath] ?? EMPTY),
              loading: false,
              error: res.error ?? 'change-requests-failed',
              lastFetchedAt: Date.now(),
            },
          },
        }))
      }
    } catch (e) {
      set((s) => ({
        byWorkspace: {
          ...s.byWorkspace,
          [workspacePath]: {
            ...(s.byWorkspace[workspacePath] ?? EMPTY),
            loading: false,
            error: e instanceof Error ? e.message : 'change-requests-failed',
            lastFetchedAt: Date.now(),
          },
        },
      }))
    } finally {
      inFlight.delete(workspacePath)
    }
  },
}))

/**
 * 启动某工作区的共享轮询,返回停止函数。
 * 同一工作区重复调用只保留一个计时器;`document.hidden` 时跳过本轮。
 */
export function startChangeRequestPolling(workspacePath: string, intervalMs = 30_000): () => void {
  if (!workspacePath) return () => {}
  const existing = timers.get(workspacePath)
  if (existing) clearInterval(existing)
  const timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return
    void useChangeRequestsStore.getState().fetch(workspacePath, { force: true })
  }, intervalMs)
  timers.set(workspacePath, timer)
  return () => {
    const current = timers.get(workspacePath)
    if (current === timer) {
      clearInterval(timer)
      timers.delete(workspacePath)
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
