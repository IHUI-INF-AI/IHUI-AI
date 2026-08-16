'use client'

/**
 * Playground 主客户端组件:组合消息编辑器 + 参数面板 + 响应展示。
 * 用当前用户 API Key 走 /v1/chat/completions 调用,stream 模式 SSE 实时渲染。
 */

import * as React from 'react'
import { Send, Loader2, Eraser } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { callPlayground } from '@/lib/playground-api'
import { usePlaygroundHistory } from '@/hooks/use-playground-history'
import { MessageEditor } from './MessageEditor'
import { ParameterPanel } from './ParameterPanel'
import { ResponseViewer } from './ResponseViewer'
import {
  DEFAULT_PLAYGROUND_PARAMS,
  type PlaygroundHistoryItem,
  type PlaygroundMessage,
  type PlaygroundParams,
  type PlaygroundResponse,
} from './PlaygroundTypes'

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createInitialMessages(): PlaygroundMessage[] {
  return [{ id: genId(), role: 'system', content: 'You are a helpful assistant.' }]
}

export function PlaygroundClient() {
  const [messages, setMessages] = React.useState<PlaygroundMessage[]>(createInitialMessages)
  const [params, setParams] = React.useState<PlaygroundParams>(DEFAULT_PLAYGROUND_PARAMS)
  const [apiKey, setApiKey] = React.useState('')
  const [response, setResponse] = React.useState<PlaygroundResponse | null>(null)
  const [streamingContent, setStreamingContent] = React.useState('')
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const { history, addHistory, clearHistory, removeHistory } = usePlaygroundHistory()

  const updateParams = React.useCallback((patch: Partial<PlaygroundParams>) => {
    setParams((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleSend = React.useCallback(async () => {
    setError(null)

    if (!apiKey.trim()) {
      setError('请先填写 API Key')
      return
    }
    if (!params.model.trim()) {
      setError('请选择或输入模型')
      return
    }
    const validMessages = messages.filter((m) => m.content.trim())
    if (validMessages.length === 0) {
      setError('请至少输入一条有效消息')
      return
    }

    setResponse(null)
    setStreamingContent('')
    setIsStreaming(true)

    try {
      const result = await callPlayground(
        validMessages,
        params,
        apiKey.trim(),
        params.stream ? (delta) => setStreamingContent((prev) => prev + delta) : undefined,
      )
      setResponse(result)
      addHistory({
        id: genId(),
        timestamp: Date.now(),
        messages: validMessages,
        params: { ...params },
        response: result,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '调用失败')
    } finally {
      setIsStreaming(false)
    }
  }, [apiKey, params, messages, addHistory])

  const handleClear = React.useCallback(() => {
    setMessages(createInitialMessages())
    setResponse(null)
    setStreamingContent('')
    setError(null)
  }, [])

  const handleRestoreHistory = React.useCallback((item: PlaygroundHistoryItem) => {
    setMessages(item.messages.map((m) => ({ ...m, id: genId() })))
    setParams({ ...item.params })
    setResponse(item.response)
    setStreamingContent('')
    setError(null)
  }, [])

  return (
    <div className="mx-auto w-full space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-2">
        <Button onClick={handleSend} disabled={isStreaming} className="h-9">
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          发送
        </Button>
        <Button variant="outline" onClick={handleClear} disabled={isStreaming} className="h-9">
          <Eraser className="h-4 w-4" />
          清空
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          POST /v1/chat/completions {params.stream ? '· SSE' : '· 非流式'}
        </span>
      </div>

      {/* 主体:左右分栏,移动端堆叠 */}
      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <div className="space-y-4">
          <MessageEditor messages={messages} onChange={setMessages} disabled={isStreaming} />
          <ParameterPanel
            params={params}
            onParamsChange={updateParams}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            disabled={isStreaming}
          />
        </div>
        <div className="min-h-[400px] min-[768px]:min-h-[500px] min-[1024px]:min-h-[600px]">
          <ResponseViewer
            response={response}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            error={error}
            messages={messages.filter((m) => m.content.trim())}
            params={params}
            apiKey={apiKey}
            history={history}
            onRestoreHistory={handleRestoreHistory}
            onRemoveHistory={removeHistory}
            onClearHistory={clearHistory}
          />
        </div>
      </div>
    </div>
  )
}
