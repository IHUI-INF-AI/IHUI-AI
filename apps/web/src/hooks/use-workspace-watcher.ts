// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区文件变更订阅(2026-11-23 立,对齐 WorkBuddy `/api/v1/fs/watcher/*` 的客户端面)。
 *
 * 为什么不做全局常驻:监听器是服务端有界资源(每用户 10 个、30 分钟回收),
 * 只有调用方显式 enabled(如源码管理面板可见)时才创建,卸载即 remove。
 * `.git/` 与依赖目录的事件被过滤 —— git 自身操作会写 `.git`,不过滤会在
 * "刷新 → 事件 → 再刷新"之间形成自激循环。
 */

import * as React from 'react'
import {
  createWorkspaceWatcher,
  getWorkspaceWatcherEvents,
  removeWorkspaceWatcher,
} from '@ihui/api-client'

export interface WorkspaceWatchEventLike {
  seq: number
  type: 'change' | 'rename' | 'error'
  path: string
  at: number
}

export interface UseWorkspaceWatcherOptions {
  workspacePath?: string
  enabled?: boolean
  /** 去抖后的回调;只给"有真实变更"的批次,空批次不调 */
  onChange: (events: WorkspaceWatchEventLike[]) => void
  /** 变更去抖窗口,默认 300ms */
  debounceMs?: number
}

const IGNORED_PREFIXES = ['.git/', 'node_modules/', '.next/', 'dist/', 'build/']

/** 过滤 git/依赖目录与空路径事件,避免自激与噪声。 */
export function isRelevantWorkspaceEvent(event: WorkspaceWatchEventLike): boolean {
  if (!event.path) return false
  const path = event.path.replace(/\\/g, '/').replace(/^\.\//, '')
  return !IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix) || path.includes(`/${prefix}`))
}

export function useWorkspaceWatcher(options: UseWorkspaceWatcherOptions): {
  active: boolean
  error: string | null
} {
  const { workspacePath, enabled = true, debounceMs = 300 } = options
  const onChangeRef = React.useRef(options.onChange)
  onChangeRef.current = options.onChange
  const [active, setActive] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!workspacePath || !enabled) {
      setActive(false)
      return
    }
    let cancelled = false
    let watcherId: string | null = null
    let cursor = 0
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let pending: WorkspaceWatchEventLike[] = []

    const flush = () => {
      debounceTimer = null
      if (pending.length === 0) return
      const batch = pending
      pending = []
      onChangeRef.current(batch)
    }

    const poll = async () => {
      while (!cancelled && watcherId) {
        const result = await getWorkspaceWatcherEvents({
          watcherId,
          cursor,
          waitMs: 1_000,
          limit: 100,
        })
        if (cancelled) return
        if (!result.success) {
          setError(result.error)
          return
        }
        cursor = result.data.nextCursor
        const relevant = result.data.events.filter(isRelevantWorkspaceEvent)
        if (relevant.length > 0) {
          pending.push(...relevant)
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(flush, debounceMs)
        }
      }
    }

    const start = async () => {
      const result = await createWorkspaceWatcher({
        workspacePath,
        path: '.',
        recursive: true,
        debounceMs: 100,
      })
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        return
      }
      watcherId = result.data.watcherId
      setActive(true)
      setError(null)
      void poll()
    }
    void start()

    return () => {
      cancelled = true
      setActive(false)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (watcherId) void removeWorkspaceWatcher({ watcherId })
    }
  }, [workspacePath, enabled, debounceMs])

  return { active, error }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
