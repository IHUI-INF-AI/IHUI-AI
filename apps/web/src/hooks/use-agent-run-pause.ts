// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #65 前端腿 —— agent 运行的「暂停 / 继续」控制器。
//
// **状态纪律(票面硬性要求)**:`isPaused` 只有一个写入来源 —— 后端 `POST
// /agents/{sid}/pause` 与 `POST /agents/{sid}/resume` 的结论格(`outcome` + `changed`)。
// 端内**不得**用"我点了暂停按钮"来推断它已经停了:一次暂停会落 eager + 轮次边界两个
// 检查点,循环是在**下一个边界**才停的,按钮按下到真停之间有一段"看着停了其实还在跑"
// 的窗口 —— 那段窗口里把界面写成"已暂停"就是在骗用户。
//
// 同理,失败格一律按后端给的身份呈现(HTTP 状态 + `errorCode`),不在这里重新造一套
// "大概是没在跑吧"的分类。两态必须可分辨:running 与 paused 各自有文字与图标,不只靠颜色。

'use client'

import * as React from 'react'
import { pauseAgentSession, resumeAgentSession } from '@ihui/api-client'
import type { AgentResumeResult } from '@ihui/api-client'

/** 上一次操作的失败格(逐字来自后端,界面据此说清是哪一型) */
export interface AgentRunPauseFailure {
  action: 'pause' | 'resume'
  /** 403 不属于你 / 404 无会话或无暂停点 / 409 状态不对格 / 503 判不了或存储不可用 */
  status?: number
  errorCode?: string
  message: string
}

export interface AgentRunPauseOptions {
  /** 本轮运行的会话标识;为空 ⇒ 暂停/继续都不可用(新对话还没拿到 session) */
  sessionId: string | null
  /** 续跑成功后把服务端回传的终态交还给调用方(续跑不在原 SSE 流上,结果只在这条响应里) */
  onResumed?: (result: AgentResumeResult) => void
}

export interface AgentRunPauseController {
  /** 后端确认的暂停态 */
  isPaused: boolean
  /** 请求在途(只用于禁用按钮,不参与任何状态结论) */
  pending: 'pause' | 'resume' | null
  failure: AgentRunPauseFailure | null
  /** 没有 session 就无从寻址 —— 界面据此把按钮置灰而不是发了才报错 */
  available: boolean
  pause: () => Promise<void>
  resume: () => Promise<void>
  /** 开新一轮 / 换会话时清空上一轮的暂停态与失败格 */
  reset: () => void
}

function failureFrom(
  action: 'pause' | 'resume',
  res: { success: false; error: string; status?: number; errorCode?: string },
): AgentRunPauseFailure {
  return { action, status: res.status, errorCode: res.errorCode, message: res.error }
}

export function useAgentRunPause({
  sessionId,
  onResumed,
}: AgentRunPauseOptions): AgentRunPauseController {
  const [isPaused, setIsPaused] = React.useState(false)
  const [pending, setPending] = React.useState<'pause' | 'resume' | null>(null)
  const [failure, setFailure] = React.useState<AgentRunPauseFailure | null>(null)
  // onResumed 每次渲染都是新引用,放进依赖会让 pause/resume 失去稳定引用;用 ref 隔开的
  // 同时保证调用到的一定是最新那一份(闭包捕获旧 setter 是 React 事件陷阱的同型)。
  const onResumedRef = React.useRef(onResumed)
  onResumedRef.current = onResumed

  const reset = React.useCallback(() => {
    setIsPaused(false)
    setPending(null)
    setFailure(null)
  }, [])

  const pause = React.useCallback(async () => {
    if (!sessionId || pending) return
    setPending('pause')
    setFailure(null)
    try {
      const res = await pauseAgentSession(sessionId)
      if (res.success) {
        // `paused`(本次真的置位)与 `already_paused`(幂等重复调用)是**同一结论的
        // 两种来路**:都算"已暂停"。`changed` 只说明这一格是不是本次改的,不参与判态。
        if (res.data.outcome === 'paused' || res.data.outcome === 'already_paused') {
          setIsPaused(true)
        }
      } else {
        setFailure(failureFrom('pause', res))
      }
    } finally {
      setPending(null)
    }
  }, [sessionId, pending])

  const resume = React.useCallback(async () => {
    if (!sessionId || pending) return
    setPending('resume')
    setFailure(null)
    try {
      const res = await resumeAgentSession(sessionId)
      if (res.success) {
        setIsPaused(false)
        onResumedRef.current?.(res.data)
      } else {
        // 409 AGENT_RESUME_NOT_PAUSED = 它其实正在跑 —— 这一格是**关于运行态的证据**,
        // 顺势把暂停位清掉(而不是只弹一句错),否则界面会长期挂着一个假"已暂停"。
        if (res.status === 409) setIsPaused(false)
        setFailure(failureFrom('resume', res))
      }
    } finally {
      setPending(null)
    }
  }, [sessionId, pending])

  return {
    isPaused,
    pending,
    failure,
    available: Boolean(sessionId),
    pause,
    resume,
    reset,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
