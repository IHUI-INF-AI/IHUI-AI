// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { generateFollowUpSuggestions } from '@ihui/api-client'
import type { ChatMessage } from '@/stores/chat'

/**
 * D45 ambient suggestions 环境建议条(2026-09-24 立,G-54)。
 *
 * 2026-11-14 改造:建议不再由前端按 planSteps/toolCalls 拼固定标签
 * (「就上述内容继续追问」这类元描述——点一下只是把标签原文填进输入框),
 * 改为服务端模型读最近对话产出的 2-4 条**可直接一键发送的真实指令**。
 *
 * 形态约束不变:建议条置于消息列表尾部自有容器、常规文档流(非 absolute/fixed 悬浮),
 * 不遮挡、不渐变遮罩、不用原生 title(替代用 aria-label)。
 * 只保留两种交互:采纳(写入本窗格草稿并自动发送)/忽略单条;不做整体开关占位,
 * 有真实模型建议就上屏,没有就整条不渲染。
 */

/** 模块级缓存:同一轮(会话 + 末条助手消息 + 内容长度)只生成一次,窗格重挂载不重复计费 */
const CACHE_LIMIT = 40
const suggestionCache = new Map<string, string[]>()

function readCache(key: string): string[] | undefined {
  const hit = suggestionCache.get(key)
  if (hit) {
    // LRU:命中后挪到队尾
    suggestionCache.delete(key)
    suggestionCache.set(key, hit)
  }
  return hit
}

function writeCache(key: string, value: string[]): void {
  suggestionCache.set(key, value)
  while (suggestionCache.size > CACHE_LIMIT) {
    const oldest = suggestionCache.keys().next().value
    if (oldest === undefined) break
    suggestionCache.delete(oldest)
  }
}

/** 只把最近若干条有正文的 user/assistant 消息发给后端(后端另有裁剪与上限) */
function buildRequestMessages(
  messages: readonly ChatMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const content = m.content.trim()
    if (!content) continue
    out.push({ role: m.role, content: content.slice(0, 4_000) })
  }
  return out.slice(-8)
}

interface AmbientSuggestionsProps {
  messages: readonly ChatMessage[]
  /** 本窗格会话 id(仅用于缓存键;新会话可为 null) */
  conversationId: string | null
  /** 流式中不生成建议(只在回合结束后给下一步) */
  isStreaming: boolean
  /** 采纳 = 宿主把指令写入本窗格草稿并自动发送(一键发送) */
  onAdopt: (prompt: string) => void
}

export function AmbientSuggestions({
  messages,
  conversationId,
  isStreaming,
  onAdopt,
}: AmbientSuggestionsProps) {
  const t = useTranslations('ambientSuggestions')
  /** 已采纳的回合签名:采纳后整组立即收起,直到下一轮助手回复完成(签名变化)再生成 */
  const [hiddenSignature, setHiddenSignature] = React.useState<string | null>(null)
  /** 模型产出的真实指令(点一下即发送) */
  const [prompts, setPrompts] = React.useState<readonly string[]>([])

  const lastMessage = messages[messages.length - 1]
  const lastAssistant = React.useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  )
  // 只在一轮真正结束(最后一条是助手回复且有正文)时生成;流式中/等用户输入时不出建议
  const ready =
    !isStreaming &&
    lastMessage?.role === 'assistant' &&
    !!lastAssistant &&
    lastAssistant.content.trim().length > 0
  const signature =
    ready && lastAssistant
      ? `${conversationId ?? 'local'}:${lastAssistant.id}:${lastAssistant.content.length}`
      : ''
  const requestMessages = React.useMemo(() => buildRequestMessages(messages), [messages])
  /** 已发起生成的轮次签名:同一轮内 messages 引用抖动不得重复请求 */
  const activeSignatureRef = React.useRef('')

  React.useEffect(() => {
    if (!signature) {
      activeSignatureRef.current = ''
      setPrompts((prev) => (prev.length === 0 ? prev : []))
      return
    }
    if (activeSignatureRef.current === signature) return
    activeSignatureRef.current = signature

    const cached = readCache(signature)
    if (cached) {
      setPrompts(cached)
      return
    }

    let alive = true
    let settled = false
    const controller = new AbortController()
    setPrompts((prev) => (prev.length === 0 ? prev : []))
    void generateFollowUpSuggestions({
      messages: requestMessages,
      signal: controller.signal,
    })
      .then((res) => {
        settled = true
        if (!alive) return
        const list = res.success
          ? (res.data?.suggestions ?? []).filter(
              (s) => typeof s === 'string' && s.trim().length > 0,
            )
          : []
        writeCache(signature, list)
        setPrompts(list)
      })
      .catch(() => {
        settled = true
        // 生成失败:不渲染建议条(绝不拿固定标签冒充模型建议)
        if (alive) setPrompts([])
      })

    return () => {
      alive = false
      controller.abort()
      // 未落地的请求被中止(如 StrictMode 双挂载的首次 cleanup)⇒ 放开签名锁,
      // 否则第二次 setup 会因「签名已生成过」直接 return,建议条永远空白。
      if (!settled) activeSignatureRef.current = ''
    }
  }, [signature, requestMessages])

  const visible = hiddenSignature === signature ? [] : prompts
  if (visible.length === 0) return null

  const adopt = (prompt: string) => {
    // 采纳 = 直接发送这条完整指令;整组建议随即收起,下一轮结束后才会重新生成
    onAdopt(prompt)
    setHiddenSignature(signature)
  }

  return (
    <div
      data-testid="ambient-suggestions"
      role="group"
      aria-label={t('title')}
      className="mx-auto flex shrink-0 flex-wrap items-center justify-center gap-1.5 py-2"
    >
      {visible.map((prompt, index) => (
        <span
          key={prompt}
          data-testid={`ambient-suggestion-${index}`}
          className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-label"
        >
          <button
            type="button"
            data-testid={`ambient-suggestion-adopt-${index}`}
            aria-label={prompt}
            onClick={() => adopt(prompt)}
            className="max-w-64 truncate text-left text-foreground/80 transition-colors hover:text-foreground"
          >
            {prompt}
          </button>
        </span>
      ))}
    </div>
  )
}

export default AmbientSuggestions
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
