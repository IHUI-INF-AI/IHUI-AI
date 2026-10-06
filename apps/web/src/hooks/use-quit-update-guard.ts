// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  isTauri,
  quitApp,
  quitAndUpdateIfNeeded,
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

export interface QuitUpdateGuard extends QuitUpdateGuardState {
  /**
   * 主动取消在飞的更新链(L5765 UI 侧取消入口;浏览器端为 no-op)。
   * 语义对齐桥面:取消 = 「调用方不再等这个结论」,在飞的 downloadAndInstall
   * 立刻以 `update_download_cancelled` 交出终态,退出链随后走"正常退出"兜底;
   * 不谎称能中断字节流。
   */
  cancel: () => void
}

const INITIAL_STATE: QuitUpdateGuardState = {
  visible: false,
  status: null,
  progress: 0,
  downloaded: 0,
  total: 0,
}

/**
 * useQuitUpdateGuard — 退出时强制自动更新守卫(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 监听 desktop-quit-request 事件(来源:托盘菜单"退出" / Ctrl+Q),
 * 拦截退出流程,强制检查并安装更新(不可跳过):
 * - 有更新 → 下载 + 安装 + 重启(拉起新版本)
 * - 无更新 → 正常退出
 *
 * 浏览器端 isTauri()=false,此 hook 不执行任何副作用。
 */
export function useQuitUpdateGuard(): QuitUpdateGuard {
  const [state, setState] = React.useState<QuitUpdateGuardState>(INITIAL_STATE)
  // 用 ref 而非 `state.visible` 做重入判据:闭包读到的是 effect 建立那一刻的快照,
  // 而 effect 又依赖 [state.visible] —— 两者互相绕的结果是"链一断,再点退出被静默
  // 吞掉",用户只剩一个无按钮、无超时的全屏 alertdialog。ref 让 handler 与渲染解耦。
  const inFlightRef = React.useRef(false)
  // L5765 UI 侧取消入口:每条更新链一个 controller,第二次退出请求 / cancel() 时中止。
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    if (!isTauri()) return

    const abortToIdle = () => {
      inFlightRef.current = false
      abortRef.current = null
      setState({ ...INITIAL_STATE })
    }

    const handleQuitRequest = () => {
      if (inFlightRef.current) {
        // 第二次及以后:用户已明确表达"现在就要退出"。先中止在飞的更新链 ——
        // 桥按 update_download_cancelled 交出终态(退出链 catch 后自行走"正常退出"),
        // 再请 Rust 侧 quit_app(它自带到点强杀的兜底)。没有这一步,JS 链会一直挂到
        // 退出链 90s 预算才收口。
        abortRef.current?.abort()
        void quitApp().catch(abortToIdle)
        return
      }
      inFlightRef.current = true
      const controller = new AbortController()
      abortRef.current = controller
      setState({ ...INITIAL_STATE, visible: true, status: 'checking' })

      void quitAndUpdateIfNeeded(
        (p: UpdateProgress) => {
          setState((prev) => ({
            ...prev,
            status: 'downloading',
            progress: p.total > 0 ? p.downloaded / p.total : 0,
            downloaded: p.downloaded,
            total: p.total,
          }))
        },
        (status: QuitUpdateStatus) => {
          setState((prev) => ({ ...prev, status }))
        },
        controller.signal,
      ).catch((e: unknown) => {
        // quitAndUpdateIfNeeded 内部已 catch 过一次并再调 quitApp;走到这里说明
        // 连那次 invoke 也失败了(Rust 侧没接住)。遮罩必须收起,否则界面没有任何出口。
        console.warn('[quit-guard] quit chain failed, restoring UI:', e)
        abortToIdle()
      })
    }

    window.addEventListener('desktop-quit-request', handleQuitRequest)
    return () => window.removeEventListener('desktop-quit-request', handleQuitRequest)
  }, [])

  return {
    ...state,
    cancel: React.useCallback(() => {
      abortRef.current?.abort()
    }, []),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
