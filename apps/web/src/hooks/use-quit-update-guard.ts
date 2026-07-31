'use client'

import * as React from 'react'
import {
  isTauri,
  quitAndUpdateIfNeeded,
  quitApp,
  type QuitUpdateStatus,
  type UpdateProgress,
} from '@/lib/tauri-bridge'

/** 退出更新守卫状态。 */
export interface QuitUpdateGuardState {
  /** 是否正在显示退出更新流程。 */
  visible: boolean
  /** 当前状态:checking(检查中)/ downloading(下载中)/ restarting(重启中)/ quitting(退出中)。 */
  status: QuitUpdateStatus | null
  /** 下载进度(0-1)。 */
  progress: number
  /** 已下载字节数。 */
  downloaded: number
  /** 总字节数。 */
  total: number
}

const INITIAL_STATE: QuitUpdateGuardState = {
  visible: false,
  status: null,
  progress: 0,
  downloaded: 0,
  total: 0,
}

/**
 * useQuitUpdateGuard — 退出时自动更新守卫(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 监听 desktop-quit-request 事件(来源:托盘菜单"退出" / Ctrl+Q),
 * 拦截退出流程,自动检查并安装更新:
 * - 有更新 → 下载 + 安装 + 重启(拉起新版本)
 * - 无更新 → 正常退出
 * - 用户可点击"跳过"跳过更新直接退出
 *
 * 浏览器端 isTauri()=false,此 hook 不执行任何副作用。
 */
export function useQuitUpdateGuard() {
  const [state, setState] = React.useState<QuitUpdateGuardState>(INITIAL_STATE)
  const skippedRef = React.useRef(false)

  React.useEffect(() => {
    if (!isTauri()) return

    const handleQuitRequest = () => {
      if (state.visible) return // 防止重复触发
      skippedRef.current = false
      setState({ ...INITIAL_STATE, visible: true, status: 'checking' })

      void quitAndUpdateIfNeeded(
        (p: UpdateProgress) => {
          if (skippedRef.current) return
          setState((prev) => ({
            ...prev,
            status: 'downloading',
            progress: p.total > 0 ? p.downloaded / p.total : 0,
            downloaded: p.downloaded,
            total: p.total,
          }))
        },
        (status: QuitUpdateStatus) => {
          if (skippedRef.current) return
          setState((prev) => ({ ...prev, status }))
        },
      )
    }

    window.addEventListener('desktop-quit-request', handleQuitRequest)
    return () => window.removeEventListener('desktop-quit-request', handleQuitRequest)
  }, [state.visible])

  /** 跳过更新,直接退出。 */
  const skip = React.useCallback(() => {
    skippedRef.current = true
    setState((prev) => ({ ...prev, status: 'quitting' }))
    void quitApp()
  }, [])

  return { ...state, skip }
}
