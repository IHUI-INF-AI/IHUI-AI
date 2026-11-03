// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { usePaneChatStore } from '@/stores/chat-pane-context'
import type { ChatMessage, ChatState } from '@/stores/chat'
import {
  applyUsageTruth,
  deriveStreamTelemetry,
  pushRateSample,
  reduceStreamClock,
  type StreamClock,
  type StreamTelemetrySnapshot,
} from '@/lib/stream-telemetry'

/** 遥测节拍:500ms。只驱动读数,不参与消息渲染(消息渲染另有 16ms 节流)。 */
const TELEMETRY_TICK_MS = 500

export interface StreamTelemetryView extends StreamTelemetrySnapshot {
  /** 本轮是否真的跑过(从未跑过时不渲染遥测条) */
  hasRun: boolean
  tokens: number | null
  toolCount: number
  failedTools: number
  /** 速率趋势采样(最近 24 拍,含 0 停顿样本;火花线数据源) */
  rateSamples: number[]
}

/**
 * 取"最后一条助手消息"作为计数源:流式期间它就是正在生长的消息,结束后仍是同一条
 * ⇒ 收尾瞬间读数不会归零。不按 streamingAssistantId 取 —— 该键在流结束的同一事务里
 * 被清空(RUN_SCOPED_RESET),按它取会把完成态读数一起清掉。
 */
function lastAssistantMessage(state: ChatState): ChatMessage | null {
  const { messages } = state
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role === 'assistant') return message
  }
  return null
}

function countTools(message: ChatMessage | null, status: string): number {
  if (!message?.toolCalls) return 0
  let count = 0
  for (const tool of message.toolCalls) {
    if (tool.status === status) count += 1
  }
  return count
}

/**
 * 大屏指挥台的流式遥测数据源。
 *
 * 纯度边界:时间与状态采集在本 hook(React 生命周期),推导在 `lib/stream-telemetry`
 * 纯函数里(可测);本 hook 只负责"什么时候开始算、什么时候用后端权威值覆盖"。
 */
export function useStreamTelemetry(): StreamTelemetryView {
  // 窗格寻址出口:无 Provider 时是根单例,Provider 内是该窗格的独立 store。
  // 该 hook 本身不带 selector —— store 取出来之后由各订阅点自己选。
  const chatStore = usePaneChatStore()
  const isStreaming = chatStore((s) => s.isStreaming)
  const conversationId = chatStore((s) => s.conversationId)
  const chars = chatStore((s) => {
    const message = lastAssistantMessage(s)
    if (!message) return 0
    return message.content.length + (message.reasoning?.length ?? 0)
  })
  const hasContent = chatStore((s) => (lastAssistantMessage(s)?.content.length ?? 0) > 0)
  const hasReasoning = chatStore((s) => (lastAssistantMessage(s)?.reasoning?.length ?? 0) > 0)
  const toolCount = chatStore((s) => lastAssistantMessage(s)?.toolCalls?.length ?? 0)
  const runningTools = chatStore((s) => countTools(lastAssistantMessage(s), 'running'))
  const failedTools = chatStore((s) => countTools(lastAssistantMessage(s), 'error'))
  const tokens = chatStore((s) => {
    const message = lastAssistantMessage(s)
    if (!message) return null
    const usage = s.usageByMessageId[message.id]
    return usage ? usage.totalTokens : null
  })
  const usageTtftMs = chatStore((s) => {
    const message = lastAssistantMessage(s)
    return message ? (s.usageByMessageId[message.id]?.firstTokenMs ?? 0) : 0
  })
  const usageDurationMs = chatStore((s) => {
    const message = lastAssistantMessage(s)
    return message ? (s.usageByMessageId[message.id]?.durationMs ?? 0) : 0
  })

  const rateSamplesRef = React.useRef<number[]>([])
  const lastSampleTickRef = React.useRef(0)
  const [samplesVersion, setSamplesVersion] = React.useState(0)
  const [now, setNow] = React.useState(() => Date.now())
  // 初始 isStreaming 固定 false:挂载时若已在流,同一次渲染就记成开流沿,不靠 effect 补记。
  const [clock, setClock] = React.useState<StreamClock>(() => ({
    conversationId,
    isStreaming: false,
    startedAt: null,
    firstTokenAt: null,
    endedAt: null,
    epoch: 0,
  }))

  const eventNow = Date.now()
  const reduced = reduceStreamClock(clock, {
    conversationId,
    isStreaming,
    chars,
    now: eventNow,
  })
  if (reduced !== clock) {
    setClock(reduced)
  }
  // 开流/收流把节拍对齐到写进状态机的那一毫秒,耗时不再停在上一个 500ms tick。
  if (reduced.startedAt !== clock.startedAt || reduced.endedAt !== clock.endedAt) {
    setNow(reduced.endedAt ?? reduced.startedAt ?? eventNow)
  }

  const samplesEpochRef = React.useRef(reduced.epoch)
  if (samplesEpochRef.current !== reduced.epoch) {
    samplesEpochRef.current = reduced.epoch
    rateSamplesRef.current = []
    lastSampleTickRef.current = 0
  }

  React.useEffect(() => {
    if (!isStreaming) return
    const timer = window.setInterval(() => setNow(Date.now()), TELEMETRY_TICK_MS)
    return () => window.clearInterval(timer)
  }, [isStreaming])

  const snapshot = React.useMemo(() => {
    const live = deriveStreamTelemetry({
      isStreaming,
      startedAt: reduced.startedAt,
      firstTokenAt: reduced.firstTokenAt,
      endedAt: reduced.endedAt,
      now,
      chars,
      tokens,
      runningTools,
      hasReasoning,
      hasContent,
    })
    if (isStreaming) return live
    return applyUsageTruth(
      live,
      usageTtftMs > 0 || usageDurationMs > 0
        ? {
            firstTokenMs: usageTtftMs,
            durationMs: usageDurationMs,
            totalTokens: tokens ?? 0,
          }
        : null,
    )
  }, [
    isStreaming,
    now,
    chars,
    tokens,
    runningTools,
    hasReasoning,
    hasContent,
    usageTtftMs,
    usageDurationMs,
    reduced.startedAt,
    reduced.firstTokenAt,
    reduced.endedAt,
  ])

  // 速率趋势按**节拍**采样(now 只在 500ms interval 变化),不随每个 delta 入样 ——
  // 否则火花线会变成"每来一个字一个点",既失真又白渲染。
  React.useEffect(() => {
    if (!isStreaming) return
    if (lastSampleTickRef.current === now) return
    lastSampleTickRef.current = now
    rateSamplesRef.current = pushRateSample(rateSamplesRef.current, snapshot.charsPerSec, 24)
    setSamplesVersion((v) => v + 1)
  }, [isStreaming, now, snapshot.charsPerSec])

  const rateSamples = React.useMemo(
    () => rateSamplesRef.current.slice(),
    // samplesVersion 是本次采样的版本闸;epoch 变了表示已在本次渲染清空采样环
    [samplesVersion, reduced.epoch],
  )

  return {
    ...snapshot,
    hasRun: reduced.startedAt !== null,
    tokens,
    toolCount,
    failedTools,
    rateSamples,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
