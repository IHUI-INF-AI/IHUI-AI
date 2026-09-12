// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { MutableRefObject } from 'react'
import { parseStreamLine } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useModeStore } from '@/stores/mode'
import { getSamplingParams } from '@/stores/sampling-params'
import { toast } from '@/components/common'
import { fetchApi, getToken, getStreamBaseUrl, isAbortError } from '@/lib/api'
import { getModelContextCapacity } from '@/lib/model-context-capacity'
import { logger } from '@/lib/logger'
import { createDeltaBatcher } from './stream-handlers'

/**
 * P1-6 断点续传(2026-09-13 立,PROJECT_PLAN.md 2549 行)
 *
 * 场景:SSE 流被中断(刷新页面 / 网络抖动 / 关标签页)时,最后一条助手消息只存在于
 * 前端(后端由 ai-callback worker 在推理完成后才落库),旧链路只能整条"重新生成"。
 *
 * 本模块提供的"尽力续接":
 *   1. findPendingResume() —— 扫描 store,定位 streamCompleted === false 的末条助手消息
 *   2. resumePendingMessage() ——
 *      a. GET /api/chat/resume/status 查该消息是否已落库
 *         已落库(completed)→ 直接回填后端权威内容,不重复调 LLM
 *      b. 未落库 → POST /api/chat/resume,把"已生成前缀"作为末条 assistant 放进上下文,
 *         后端透传 ai-service /api/llm/complete/stream,模型自然续写;
 *         SSE 事件格式与主链路 /ai/chat/stream 一致,这里复用 parseStreamLine 提取 delta,
 *         再用 createDeltaBatcher 做 rAF 合批写入(与主链路同款节流,避免高频 setState)。
 *      c. 失败 → toast 提示 + 「重新生成」按钮(复用既有 ihui:regenerate-message 闭环),
 *         绝不静默丢弃。
 */

/** 续接时回灌给模型的上下文条数(末条 assistant 前缀另算) */
const RESUME_HISTORY_LIMIT = 30
/** 单次续接最长等待(与后端 5min 兜底对齐再留余量) */
const RESUME_TIMEOUT_MS = 5 * 60_000

export interface PendingResume {
  conversationId: string
  messageId: string
  content: string
}

/** 续接失败降级文案(由面板按当前语言传入,避免 hook 依赖 next-intl) */
export interface ResumeLabels {
  title: string
  action: string
  noProgress: string
}

interface ResumeStatus {
  exists: boolean
  completed: boolean
  content: string
  updatedAt: number | null
}

/**
 * 找出"流被中断、可续接"的助手消息。
 * 判定依据:末条助手消息 streamCompleted === false 且已有非空内容
 * (send-message 流开始时置 false,正常/异常收尾在 finally 置 true —— 只有中途页面销毁才残留 false)。
 */
export function findPendingResume(conversationId: string | null): PendingResume | null {
  if (!conversationId) return null
  const s = useChatStore.getState()
  if (s.conversationId !== conversationId) return null
  for (let i = s.messages.length - 1; i >= 0; i--) {
    const m = s.messages[i]
    if (!m || m.role !== 'assistant') continue
    // 只看最后一条助手消息:更早的助手消息必然已收尾
    if (m.streamCompleted === false && (m.content ?? '').trim().length > 0) {
      return { conversationId, messageId: m.id, content: m.content ?? '' }
    }
    return null
  }
  return null
}

/**
 * 确保续接目标消息仍存在于 store。
 * 原因:loadHistory 会用服务端快照整体覆盖 messages,而未落库的本地助手消息不在快照里,
 * 覆盖后消息消失 —— 这里按原 id 补回,保证 appendToMessage 能命中。
 */
function ensureMessagePresent(p: PendingResume): void {
  const s = useChatStore.getState()
  if (s.messages.some((m) => m.id === p.messageId)) return
  useChatStore.setState((prev) => ({
    messages: prev.messages.concat({
      id: p.messageId,
      role: 'assistant' as const,
      content: p.content,
      createdAt: Date.now(),
      model: prev.currentModel,
      streamCompleted: false,
    }),
  }))
}

/** 组装续接上下文:最近 N 条历史(排除待续接消息本身)+ 末条 assistant 前缀 */
function buildResumeMessages(
  p: PendingResume,
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const s = useChatStore.getState()
  const history = s.messages
    .filter(
      (m) =>
        m.id !== p.messageId &&
        (m.role === 'user' || m.role === 'assistant' || m.role === 'system'),
    )
    .slice(-RESUME_HISTORY_LIMIT)
    .map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content ?? '' }))
  return [...history, { role: 'assistant' as const, content: p.content }]
}

/** 降级:提示用户并给出「重新生成」入口(复用 MessageList 既有 CustomEvent 闭环) */
function notifyResumeFailed(p: PendingResume, reason: string, labels: ResumeLabels): void {
  useChatStore.getState().setMessageStreamCompleted(p.messageId, true)
  toast.error(labels.title, {
    description: reason,
    duration: 8000,
    action: {
      label: labels.action,
      onClick: () => {
        window.dispatchEvent(
          new CustomEvent('ihui:regenerate-message', { detail: { messageId: p.messageId } }),
        )
      },
    },
  })
}

/**
 * 执行续接。调用方负责在「历史加载完成后」调用,并传入 AbortSignal(切换会话/卸载时中止)。
 */
export async function resumePendingMessage(
  p: PendingResume,
  opts: { signal: AbortSignal; labels: ResumeLabels },
): Promise<void> {
  const store = useChatStore.getState()

  // ① 先问后端:该消息是否已经落库(落库 = 推理其实已完成,只是前端没收到尾事件)
  try {
    const statusRes = await fetchApi<ResumeStatus>(
      `/api/chat/resume/status?conversationId=${encodeURIComponent(p.conversationId)}&messageId=${encodeURIComponent(p.messageId)}`,
      { signal: opts.signal },
    )
    if (opts.signal.aborted) return
    if (statusRes.success && statusRes.data?.completed) {
      // 后端已有权威内容 → 直接补全,不重复消耗一次 LLM 调用
      ensureMessagePresent(p)
      if (statusRes.data.content) {
        useChatStore.getState().editMessageContent(p.messageId, statusRes.data.content)
      }
      useChatStore.getState().setMessageStreamCompleted(p.messageId, true)
      return
    }
  } catch (e) {
    if (isAbortError(e) || opts.signal.aborted) return
    logger.warn('[Resume] status 查询失败,退化为直接续生成:', e)
  }

  // ② 未落库 → 用已生成前缀作为上下文发起续生成
  ensureMessagePresent(p)
  useChatStore.getState().setStreaming(true)
  useChatStore.getState().setError(null)

  const batcher = createDeltaBatcher((delta) => {
    useChatStore.getState().appendToMessage(p.messageId, delta)
  })

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  opts.signal.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(), RESUME_TIMEOUT_MS)

  try {
    const base = getStreamBaseUrl()
    const token = getToken()
    // P1-7(2026-09-13 立):续接前快照会话级高级参数(全局默认 + 会话覆盖)
    const samplingParams = getSamplingParams(p.conversationId)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const resp = await fetch(`${base}/api/chat/resume`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        conversationId: p.conversationId,
        messageId: p.messageId,
        messages: buildResumeMessages(p),
        model: store.currentModel,
        mode: useModeStore.getState().currentMode,
        // P1-7(2026-09-13):续接保持会话级高级参数,与 send-message/send-answer 一致
        temperature: samplingParams.temperature,
        topP: samplingParams.topP,
        topK: samplingParams.topK,
        maxTokens: samplingParams.maxTokens,
        ...(samplingParams.systemPrompt ? { systemPrompt: samplingParams.systemPrompt } : {}),
        // P1-8 Repo Wiki(2026-09-13 立):仓库名透传后端,注入该仓库最新 overview 文档到
        // system prompt;无活跃工作区时为 undefined(JSON.stringify 自动省略该 key)。
        repoName: useAiPanelStore.getState().activeWorkspace?.name,
        contextLimit: getModelContextCapacity(store.currentModel),
        metadata: {
          conversationId: p.conversationId,
          userId: useAuthStore.getState().user?.id ?? '',
          messageId: p.messageId,
        },
      }),
    })

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '')
      notifyResumeFailed(p, text || `HTTP ${resp.status}`, opts.labels)
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let sawAnyDelta = false

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (!line.trim()) continue
        // 首事件 {"resume":{...}} 与 done/error 事件:parseStreamLine 对无文本字段的块返回 null
        try {
          const delta = parseStreamLine(line)
          if (delta) {
            sawAnyDelta = true
            batcher.batch(delta)
          }
        } catch (err) {
          // parseStreamLine 遇到 error 事件会抛错 —— 立即降级,不静默
          notifyResumeFailed(p, err instanceof Error ? err.message : String(err), opts.labels)
          return
        }
      }
    }
    if (buffer.trim()) {
      try {
        const delta = parseStreamLine(buffer)
        if (delta) {
          sawAnyDelta = true
          batcher.batch(delta)
        }
      } catch {
        /* 尾部残留的 error 事件已在主循环处理 */
      }
    }

    batcher.flush()
    useChatStore.getState().setMessageStreamCompleted(p.messageId, true)
    if (!sawAnyDelta) {
      // 连接正常结束但一个 token 都没续出来 —— 提示用户,避免"看起来好了其实没续上"
      notifyResumeFailed(p, opts.labels.noProgress, opts.labels)
    }
  } catch (e) {
    batcher.flush()
    if (isAbortError(e) || opts.signal.aborted) return
    notifyResumeFailed(p, e instanceof Error ? e.message : String(e), opts.labels)
  } finally {
    batcher.cancel()
    clearTimeout(timeout)
    opts.signal.removeEventListener('abort', onAbort)
    // 仅当仍在同一会话时收尾,避免污染用户已切换到的新会话
    if (useChatStore.getState().conversationId === p.conversationId) {
      useChatStore.getState().setStreaming(false)
    }
  }
}

/**
 * 页面挂载 / 会话切换后的自动续接触发器(刷新后 3 秒内)。
 *
 * 必须在「历史加载结算之后」调用:loadHistory 会用服务端快照整体覆盖 messages,
 * 而未被落库的本地助手消息不在快照里 —— 若在覆盖前就开始续接,写入的内容会被整条抹掉。
 *
 * @param pending findPendingResume() 捕获到的候选(本函数消费后置 null)
 * @param signal  切换会话 / 卸载时中止续接的控制器
 */
export async function autoResumeAfterHistory(
  pendingRef: MutableRefObject<PendingResume | null>,
  conversationId: string | null,
  signal: AbortSignal,
  labels: ResumeLabels,
): Promise<void> {
  const pending = pendingRef.current
  pendingRef.current = null
  if (!pending || !conversationId) return
  if (pending.conversationId !== conversationId) return
  if (signal.aborted) return
  // 用户已经切走 / 已经发了新消息(末条助手消息不再是待续接那条)→ 放弃续接
  const s = useChatStore.getState()
  if (s.conversationId !== conversationId) return
  const last = s.messages[s.messages.length - 1]
  if (last && last.id !== pending.messageId && last.role === 'assistant') {
    useChatStore.getState().setMessageStreamCompleted(pending.messageId, true)
    return
  }
  await resumePendingMessage(pending, { signal, labels })
}
