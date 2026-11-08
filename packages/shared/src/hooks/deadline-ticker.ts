// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import * as React from 'react'

/**
 * 截止戳同步器:interval 只负责「触发重渲染」,剩余时间一律由调用方从截止戳派生。
 *
 * 为什么独立成 hook(2026-11-08):
 * - `useCountdown` 与 `useRegisterForm` 的验证码倒计时都要「后台节流后按墙钟对表」;
 *   两处各写一遍 setInterval + visibilitychange 就是把同一份对表规则复制两份;
 * - 这里只做调度,不做算术 —— 算术留在各 hook 的纯转移函数里,便于夹具直接验。
 *
 * 跨端:RN / 小程序 / Node 下没有 window/document,降级为纯 interval;
 * Taro H5 / 浏览器有 document 时,`visibilitychange`(仅 visible)与 `focus` 立即对表。
 *
 * `onSync` 走 ref:调用方常传内联函数,直接放进 deps 会让 effect 每次渲染重启,
 * 后台节流的正确性就没了(与 apps/web 轮询 hook 同一类教训)。
 */
export function useDeadlineTicker(deadlineMs: number | null, onSync: () => void): void {
  const syncRef = React.useRef(onSync)
  syncRef.current = onSync

  React.useEffect(() => {
    if (deadlineMs === null) return

    const sync = () => syncRef.current()
    // 立刻对一次表:挂载/恢复截止戳的那一帧不该等满 1s
    sync()

    const timer = setInterval(sync, 1000)
    const doc = typeof document !== 'undefined' ? document : null
    const win = typeof window !== 'undefined' ? window : null

    const onVisibility = () => {
      if (!doc || doc.visibilityState === 'visible') sync()
    }
    doc?.addEventListener('visibilitychange', onVisibility)
    win?.addEventListener('focus', sync)

    return () => {
      clearInterval(timer)
      doc?.removeEventListener('visibilitychange', onVisibility)
      win?.removeEventListener('focus', sync)
    }
  }, [deadlineMs])
}
