// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  isTauri,
  updateV2Check,
  updateV2Ready,
  updateV2Restart,
  updateV2Rollback,
  updateV2Stage,
  updateV2TakeRollbackNotice,
  type UpdateV2Event,
  type UpdateV2RollbackNotice,
  type UpdateV2Status,
} from '@/lib/tauri-bridge'
import { ihuiIpc } from '@/lib/tauri-ipc'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

const EMPTY: UpdateV2Status = {
  supported: false,
  current: '',
  kind: 'none',
  available: null,
  ready: false,
  mandatory: false,
  requiresBootstrap: false,
  notes: null,
  reason: 'not-tauri',
}

/**
 * 常驻更新胶囊的唯一状态源。
 *
 * 关键取舍：
 * - 检查/暂存都在后台，界面**没有下载进度**；只有 ready 才出胶囊。
 * - 每次挂载先读本地 ready（WebView 重载不丢），再联网校准。
 * - 可用更新自动 stage（用户不用点“下载”），stage 成功后仍只等用户点重启。
 * - 点击重启先广播 desktop-before-close 给工作区保存草稿，再交棒给 Launcher。
 */
export function useUpdateReady() {
  const [status, setStatus] = React.useState<UpdateV2Status>(EMPTY)
  const [restarting, setRestarting] = React.useState(false)
  const [rollbackNotice, setRollbackNotice] = React.useState<UpdateV2RollbackNotice | null>(null)
  const mounted = React.useRef(true)
  const lastReadyProbe = React.useRef(0)

  const refreshLocal = React.useCallback(async () => {
    try {
      const local = await updateV2Ready()
      if (mounted.current) setStatus(local)
      return local
    } catch (err) {
      console.warn('[update-v2] ready probe failed:', err)
      return null
    }
  }, [])

  const checkAndStage = React.useCallback(async () => {
    const local = await refreshLocal()
    if (local?.ready) {
      // 本地 ready 也要低频联网复核：服务端可能已撤版/给出更强回退目标。
      // 30 分钟内只读本地，避免每次窗口聚焦都打 feed。
      const now = Date.now()
      if (now - lastReadyProbe.current < 30 * 60 * 1000) return
      lastReadyProbe.current = now
    } else {
      lastReadyProbe.current = 0
    }
    try {
      const checked = await updateV2Check()
      if (!mounted.current) return
      setStatus(checked)
      if (!checked.supported || checked.ready || !checked.available) return
      if (checked.requiresBootstrap) return
      // 新版本或服务端建议回退：后台暂存，不弹任何进度。
      if (checked.kind === 'update' || checked.kind === 'rollback') {
        await updateV2Stage()
      }
    } catch (err) {
      console.warn('[update-v2] check failed:', err)
    }
  }, [refreshLocal])

  React.useEffect(() => {
    if (!isTauri()) return
    mounted.current = true
    let disposed = false
    let unlisten: (() => void) | undefined

    const boot = async () => {
      try {
        const notice = await updateV2TakeRollbackNotice()
        if (notice && !disposed) setRollbackNotice(notice)
      } catch (err) {
        console.warn('[update-v2] rollback notice failed:', err)
      }
      await checkAndStage()
      if (disposed) return
      unlisten = await ihuiIpc.listen<UpdateV2Event>('update-v2', (event) => {
        const payload = event.payload
        if (payload.phase === 'ready') {
          void refreshLocal()
          return
        }
        if (payload.phase === 'error') {
          // 这里只留诊断日志：失败不打扰用户，也不在界面上制造“更新失败”红条。
          const noisy = payload.code === 'rollout' || payload.code === 'up-to-date'
          if (!noisy) {
            console.warn(`[update-v2] ${payload.code ?? 'error'}: ${payload.message ?? ''}`)
          }
        }
      })
    }
    void boot()

    const timer = window.setInterval(() => void checkAndStage(), CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkAndStage()
    }
    const onManualCheck = () => void checkAndStage()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('desktop-check-update', onManualCheck)

    return () => {
      disposed = true
      mounted.current = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('desktop-check-update', onManualCheck)
      unlisten?.()
    }
  }, [checkAndStage, refreshLocal])

  const restart = React.useCallback(async () => {
    if (restarting) return
    setRestarting(true)
    try {
      // 让工作区/编辑器先把草稿落盘；没有监听者的页面也会在 250ms 后继续。
      window.dispatchEvent(new CustomEvent('desktop-before-close'))
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      await updateV2Restart()
    } catch (err) {
      console.warn('[update-v2] restart failed:', err)
      if (mounted.current) setRestarting(false)
    }
  }, [restarting])

  const prepareRollback = React.useCallback(async () => {
    try {
      const next = await updateV2Rollback()
      if (mounted.current) setStatus(next)
      return next
    } catch (err) {
      console.warn('[update-v2] rollback failed:', err)
      return null
    }
  }, [])

  const dismissRollbackNotice = React.useCallback(() => {
    setRollbackNotice(null)
  }, [])

  return { status, restarting, restart, prepareRollback, rollbackNotice, dismissRollbackNotice }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
