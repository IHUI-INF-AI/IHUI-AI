// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useEffect } from 'react'

import { listBrowserSessions } from '@ihui/api-client'

import { isTauri, openAiPipWindow } from '@/lib/tauri-bridge'
import { useAuthStore } from '@/stores/auth'

/** 自动监看开关:默认开;用户可在 AI 侧栏菜单里关掉。 */
export const AI_PIP_AUTO_KEY = 'ihui-ai-pip-auto'
const POLL_MS = 4000

/**
 * 桌面端 Browser Hub 新会话自动监看(2026-11-25 补,2026-11-26 多窗化)。
 *
 * TRAE 的画中画是 AI 一开浏览器就自动出现;此前 IHUI 只能等用户切到 CDP tab
 * 再点工具栏按钮。这里轮询 `GET /api/browser/sessions`:
 * - 首次拉到的是**基线**,不弹旧会话(避免每次启动桌面端都弹一个失效窗);
 * - 之后每个新 sessionId 各自开一窗(按会话 label 去重),不再“有一个窗就跳过”;
 * - 已有某会话的窗时不重复开,也不把别的会话窗顶掉;
 * - 最多 5 窗(与服务端单主体会话上限一致),超出留给用户手动选;
 * - 只在 Tauri 且已登录时工作,web 端不偷偷开系统窗口。
 */
export function useAutoAiPip(): void {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!isTauri() || !token) return
    let disposed = false
    let initialized = false
    let inFlight = false
    const seen = new Set<string>()

    const tick = async () => {
      if (disposed || inFlight) return
      inFlight = true
      try {
        const res = await listBrowserSessions()
        if (disposed || !res.success || !res.data) return
        const ids = res.data.session_ids ?? []
        const fresh = initialized ? ids.filter((id) => !seen.has(id)) : []
        ids.forEach((id) => seen.add(id))
        if (!initialized) {
          initialized = true
          return
        }
        if (fresh.length === 0) return
        if (window.localStorage.getItem(AI_PIP_AUTO_KEY) === '0') return

        const { getAllWindows } = await import('@tauri-apps/api/window')
        const windows = await getAllWindows()
        const openLabels = new Set(windows.map((win) => win.label))
        const openCount = [...openLabels].filter(
          (label) => label === 'ai-browser-pip' || label.startsWith('ai-browser-pip-'),
        ).length
        let slots = Math.max(0, 5 - openCount)

        const accessToken = useAuthStore.getState().token
        if (!accessToken) return
        for (const nextId of fresh) {
          if (slots <= 0) break
          const label = `ai-browser-pip-${nextId}`
          if (openLabels.has(label)) continue
          await openAiPipWindow(nextId, accessToken)
          openLabels.add(label)
          slots -= 1
        }
      } catch {
        // 轮询失败不改变任何状态,下一轮重试;不弹 toast 干扰用户。
      } finally {
        inFlight = false
      }
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, POLL_MS)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [token])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
