// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchApi } from '@/lib/api'
import {
  MCP_APP_PROTOCOL_VERSION,
  isAppRpcRequest,
  isMcpAppMethod,
  rpcError,
  rpcResult,
} from '@/lib/mcp-app-bridge'

export interface McpAppFrameProps {
  /** 资源所属的外部 MCP Server;缺省 ⇒ 只能渲染本地传入的 html,不能代理调用。 */
  server?: string
  uri: string
  /** 调用方已拿到的 HTML 正文;缺省时组件自己去 `resources/read` 取。 */
  html?: string
  title?: string
  height?: number
}

interface ResourceReadResult {
  uri?: string
  contents?: Array<{ text?: string; mimeType?: string }>
}

interface ToolCallResult {
  content?: Array<{ type?: string; text?: string }>
  isError?: boolean
}

/**
 * MCP Apps 宿主 iframe(2026-11-23 立)。
 *
 * 三层边界,缺一不可:
 *  1. **执行隔离**:`sandbox="allow-scripts"` 且**不给** `allow-same-origin` —— app 拿到
 *     的是不透明源,读不到本仓 cookie/localStorage,也不能拿宿主身份发请求;
 *  2. **来源校验**:只处理 `event.source === frame.contentWindow` 的帧,别的窗口
 *     (含同页其它 iframe)发来的同形 JSON-RPC 一律丢;
 *  3. **能力最小**:只代理 `tools/call` / `resources/read`,且 server 归属由**宿主**
 *     决定(iframe 不能自报 server 换一台调);未知方法回 -32601。
 *
 * 不承诺"app 能直接 fetch 本仓 API":不透明源下那属于跨源,这条路被刻意堵死,
 * 一切副作用必须经宿主桥。
 */
export function McpAppFrame({ server, uri, html, title, height = 420 }: McpAppFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [doc, setDoc] = useState<string | null>(html ?? null)
  const [error, setError] = useState<string | null>(null)

  // 没有现成 html 时按 uri 取一次正文;外部 server 的正文不由本层缓存。
  useEffect(() => {
    if (html) {
      setDoc(html)
      setError(null)
      return
    }
    if (!server) {
      setError('该资源没有 server 归属,无法读取正文')
      return
    }
    let cancelled = false
    setDoc(null)
    setError(null)
    void (async () => {
      const res = await fetchApi<ResourceReadResult>('/api/mcp/external/resources/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, uri }),
      })
      if (cancelled) return
      if (!res.success) {
        setError(res.error)
        return
      }
      const text = res.data?.contents?.find((item) => typeof item.text === 'string')?.text
      if (typeof text !== 'string' || text.length === 0) {
        setError('该资源没有可渲染的 HTML 正文')
        return
      }
      setDoc(text)
    })()
    return () => {
      cancelled = true
    }
  }, [html, server, uri])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current
      if (!frame || event.source !== frame.contentWindow) return
      if (!isAppRpcRequest(event.data)) return

      const { id, method } = event.data
      const params = (event.data.params ?? {}) as Record<string, unknown>
      const reply = (payload: unknown) => {
        frame.contentWindow?.postMessage(payload, '*')
      }

      if (!isMcpAppMethod(method)) {
        reply(rpcError(id, -32601, `未知方法: ${method}`))
        return
      }

      if (method === 'ping') {
        reply(rpcResult(id, {}))
        return
      }

      if (method === 'ui/initialize') {
        reply(
          rpcResult(id, {
            protocolVersion: MCP_APP_PROTOCOL_VERSION,
            hostInfo: { name: 'IHUI AI', version: '1' },
            hostCapabilities: {
              tools: { call: Boolean(server) },
              resources: { read: Boolean(server) },
            },
          }),
        )
        return
      }

      if (!server) {
        reply(rpcError(id, -32601, '该宿主没有 server 归属,不能代理出站'))
        return
      }

      void (async () => {
        if (method === 'tools/call') {
          const name = typeof params.name === 'string' ? params.name : ''
          if (!name) {
            reply(rpcError(id, -32602, 'tools/call 缺少 name'))
            return
          }
          const args =
            params.arguments && typeof params.arguments === 'object'
              ? (params.arguments as Record<string, unknown>)
              : {}
          const res = await fetchApi<ToolCallResult>('/api/mcp/external/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server, tool: name, arguments: args }),
          })
          reply(res.success ? rpcResult(id, res.data) : rpcError(id, -32000, res.error))
          return
        }

        // resources/read:默认读宿主这一条,也允许 app 在同一台 server 内读别的 uri。
        const targetUri = typeof params.uri === 'string' && params.uri ? params.uri : uri
        const res = await fetchApi<ResourceReadResult>('/api/mcp/external/resources/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ server, uri: targetUri }),
        })
        reply(res.success ? rpcResult(id, res.data) : rpcError(id, -32000, res.error))
      })()
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [server, uri])

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-body text-muted-foreground">
        {error}
      </div>
    )
  }

  if (!doc) {
    return (
      <div
        className="animate-pulse rounded-lg border bg-muted/30"
        style={{ height }}
        aria-label={title ?? uri}
      />
    )
  }

  return (
    <iframe
      ref={frameRef}
      title={title ?? uri}
      srcDoc={doc}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="w-full rounded-lg border bg-background"
      style={{ height }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
