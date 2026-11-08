// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'

/**
 * 以「截止时间戳」为准的倒计时(秒)。
 *
 * 2026-11-08 W-01/W-02 修复:此前用 `setLeftSec((s) => s - 1)` 按 tick 次数自减,
 * 后台标签页被浏览器节流/挂起时 tick 不触发,倒计时与自动交卷被无限顺延。
 * 这里剩余时间始终由 `deadline - Date.now()` 派生,interval 只负责触发重渲染;
 * 标签页重新可见 / 窗口重新获得焦点时立即对表,保证真实流逝时间不被抹掉。
 *
 * @param deadlineMs 截止时间戳(毫秒);null 表示不启用计时(如未开始答题)
 */
export function useDeadlineCountdown(deadlineMs: number | null): number {
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0)

  const leftSec =
    deadlineMs === null ? 0 : Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))

  React.useEffect(() => {
    if (deadlineMs === null) return
    const tm = setInterval(() => forceTick(), 1000)
    const resync = () => forceTick()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') resync()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', resync)
    return () => {
      clearInterval(tm)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', resync)
    }
  }, [deadlineMs])

  return leftSec
}
