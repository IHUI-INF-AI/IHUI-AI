// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815967 的 React 侧胶水:把"挂载 + 作业身份"双条件装进同一个守卫。
//
// 判据本身不住这里 —— 身份比较与判活铰链只有一份实现(`utils/job-scope.ts`),本文件只做两件事:
//  ① 把挂载位作为 `isAlive` 探针注入(它是**第二个**条件;单独用它就是半个守卫 ——
//     组件还挂着而作业早已换人,那一刻 mounted 为真而身份为旧);
//  ② 卸载时作废当前作业,让之后到达的迟到回调统一判 `stale` 并记账。
//
// 为什么不直接扩 `use-mounted.ts`:那个 hook 回答的是 SSR/CSR 水合时机(hydration mismatch),
// 与"这段异步回调属于哪一次作业"是两回事,合并会把两个语义都糊掉。

import * as React from 'react'

import {
  createJobScope,
  summarizeDroppedCallbacks,
  type DroppedCallback,
  type JobIdentity,
  type JobScope,
  type JobScopeVerdict,
  type JobToken,
} from '../utils/job-scope'

export interface UseJobScopeReturn {
  /** 发起一次新作业并拿凭证;它会立刻作废上一张凭证(换作业 = 旧回调迟到即拒) */
  readonly begin: (jobId?: JobIdentity) => JobToken
  /**
   * 复核凭证:未挂载 或 身份不符 ⇒ false 并记账。
   * 迟到的回调体只在返回 true 时才允许写 state / 推给父组件。
   */
  readonly isCurrent: (token: JobToken) => boolean
  /** 三态复核(需要区分"确证换人"与"没带凭证"时用这一条) */
  readonly verdict: (token: JobToken) => JobScopeVerdict
  /** 显式作废(用户点"停止"、切换表单、离开页面),之后所有凭证判 stale */
  readonly invalidate: (reason?: string) => void
  /** 当前在等的作业;从未 begin ⇒ null(与"已作废"分两型,见 job-scope 注释) */
  readonly current: () => JobToken | null
  /** 被拒的迟到回调(可数、可点名;禁止用它做"静默跳过"的替代) */
  readonly dropped: () => readonly DroppedCallback[]
  /** 被拒清单的人读摘要,无拒绝时 null —— 调用方可直接打进日志,不许拼进 UI 文案 */
  readonly droppedSummary: () => string | null
}

/**
 * `useJobScope()` — 异步回调的"我等的还是不是原来那个作业"守卫。
 *
 * 用法:
 * ```ts
 * const job = useJobScope()
 * const token = job.begin(`batch:${fileCount}`)
 * const res = await upload(files)
 * if (!job.isCurrent(token)) return          // 迟到回调:不落新作业状态
 * setItems([...itemsRef.current, ...res])    // 合并基准取"当前",不取发起时的闭包
 * ```
 */
export function useJobScope(): UseJobScopeReturn {
  // 挂载位必须先于 scope 建好 —— `isAlive` 探针读的是这个 ref,不是快照。
  const mountedRef = React.useRef(true)
  const scopeRef = React.useRef<JobScope | null>(null)
  if (scopeRef.current === null) {
    scopeRef.current = createJobScope({ isAlive: () => mountedRef.current, deadReason: 'unmounted' })
  }
  const scope = scopeRef.current

  React.useEffect(() => {
    // StrictMode 双挂载:cleanup 跑完还会再进一次 effect,所以这里必须把位翻回 true,
    // 否则第二次挂载起所有回调都被判 stale —— 那是"永不落态"的恒哑实现。
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      scope.invalidate('unmount')
    }
  }, [scope])

  return React.useMemo<UseJobScopeReturn>(
    () => ({
      begin: (jobId?: JobIdentity) => scope.begin(jobId),
      verdict: (token: JobToken) => scope.verdict(token),
      isCurrent: (token: JobToken) => scope.isCurrent(token),
      invalidate: (reason?: string) => scope.invalidate(reason),
      current: () => scope.current(),
      dropped: () => scope.dropped(),
      droppedSummary: () => summarizeDroppedCallbacks(scope.dropped()),
    }),
    [scope],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
