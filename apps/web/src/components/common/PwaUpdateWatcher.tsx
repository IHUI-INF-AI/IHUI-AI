// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { PWA_UPDATE_AVAILABLE_EVENT } from './PWAUpdatePrompt'

/** 主动探更新的间隔:SW 自己不会周期性检查,长开页面必须自己问。 */
const POLL_INTERVAL_MS = 30 * 60 * 1000

/**
 * Service Worker 更新侦测(2026-10-27 立):PWAUpdatePrompt 的**派发端**。
 *
 * 为什么必须有这一层:此前全仓只有 `window.addEventListener('pwa-update-available')`
 * 的消费端,没有任何生产者 ⇒ 卡片挂载着但永远不出现,"有新版本可用"这条链路实际是断的。
 *
 * 侦测口径(浏览器标准三件套,缺一不可):
 *   1. `registration.updatefound` —— 浏览器发现新 sw.js,newWorker 进入 installed;
 *   2. `newWorker.state === 'installed'` 且 `navigator.serviceWorker.controller` 非空 ——
 *      即"页面仍由旧 SW 控制"才提示;首次安装(无 controller)不该弹"有新版本";
 *   3. `registration.update()` 主动探 —— 否则长开页面要等浏览器自己的更新周期(可能数天),
 *      这里 30 分钟一次 + 页面重新可见时补一次(手机切回前台是高频场景)。
 *
 * 判定失败一律静默 fail-open:拿不到 registration / 环境不支持 SW ⇒ 什么都不做,
 * 与 app-version-gate 的降级哲学一致(不因为更新提示坏了而影响使用)。
 */
export function PwaUpdateWatcher(): null {
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let disposed = false
    let registration: ServiceWorkerRegistration | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const notify = () => {
      if (disposed) return
      window.dispatchEvent(new Event(PWA_UPDATE_AVAILABLE_EVENT))
    }

    /** 给一个 registration 挂 updatefound 侦测(重复挂载用 WeakSet 去重由浏览器事件模型保证)。 */
    const watch = (reg: ServiceWorkerRegistration) => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          // 只在"新 SW 已就绪且页面仍被旧 SW 控制"时提示;首次安装没有 controller。
          if (installing.state === 'installed' && navigator.serviceWorker.controller) notify()
        })
      })
    }

    const bootstrap = async () => {
      try {
        // getRegistration 优先,拿不到才退回 ready —— 但 ready 是**永不 reject** 的 promise,
        // SW 从未注册时它会永久 pending(实测):不给超时,这里就静默挂死,
        // 后面的 watch/update 一次都不跑,表现成"更新提示永远不出现且没有任何报错"。
        const reg =
          (await navigator.serviceWorker.getRegistration()) ??
          (await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]))
        if (disposed || !reg) return
        registration = reg
        watch(reg)
        // 页面加载时补一次主动探:SW 已注册但用户可能长时间没刷新
        await reg.update().catch(() => {})
      } catch {
        // fail-open:取不到 registration(未注册/被策略禁用)就不提示
      }
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !registration) return
      void registration.update().catch(() => {})
    }

    void bootstrap()
    pollTimer = setInterval(() => {
      void registration?.update().catch(() => {})
    }, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      if (pollTimer) clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
