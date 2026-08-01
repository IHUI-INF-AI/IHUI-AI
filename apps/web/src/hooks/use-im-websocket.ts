'use client'

import * as React from 'react'

import { createWebSocketHook } from '@/hooks/create-websocket-hook'

export type ImMessageType = 'text' | 'image' | 'file' | 'system'

export interface ImMessage {
  id?: string
  type: ImMessageType
  conversationId: string
  senderId?: string
  content: string
  createdAt?: string
  isMine?: boolean
}

export interface UseImWebSocketReturn {
  lastMessage: ImMessage | null
  sendMessage: (msg: Omit<ImMessage, 'id' | 'createdAt' | 'isMine'>) => void
  isConnected: boolean
  error: string | null
}

function isImMessage(v: unknown): v is ImMessage {
  if (typeof v !== 'object' || v === null) return false
  const t = (v as { type?: unknown }).type
  return t === 'text' || t === 'image' || t === 'file' || t === 'system'
}

/** 消息守卫:符合 ImMessage 结构且非心跳响应(避免 pong 被当通知显示给用户) */
function imMessageGuard(v: unknown): v is ImMessage {
  if (!isImMessage(v)) return false
  // 2026-08-02 修复:过滤心跳响应 { type: 'system', content: 'pong' }
  // create-websocket-hook 只过滤字符串 'pong',JSON 格式的心跳响应会被误当 ImMessage
  if (v.type === 'system' && v.content === 'pong') return false
  if (v.type === 'system' && v.content === 'ping') return false
  return true
}

function buildImWsUrl(token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/messages?token=${encodeURIComponent(token)}`
}

const useImWS = createWebSocketHook<ImMessage>({
  urlBuilder: buildImWsUrl,
  messageGuard: imMessageGuard,
  heartbeatMessage: () => JSON.stringify({ type: 'system', content: 'ping' }),
})

export function useImWebSocket(): UseImWebSocketReturn {
  const ws = useImWS()
  const sendMessage = React.useCallback(
    (msg: Omit<ImMessage, 'id' | 'createdAt' | 'isMine'>) => {
      const payload: ImMessage = {
        ...msg,
        createdAt: new Date().toISOString(),
        isMine: true,
      }
      ws.send(JSON.stringify(payload))
    },
    [ws],
  )

  return {
    lastMessage: ws.lastMessage,
    sendMessage,
    isConnected: ws.isConnected,
    error: ws.error,
  }
}
