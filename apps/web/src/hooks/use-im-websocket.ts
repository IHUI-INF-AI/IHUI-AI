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

function buildImWsUrl(token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/messages?token=${encodeURIComponent(token)}`
}

const useImWS = createWebSocketHook<ImMessage>({
  urlBuilder: buildImWsUrl,
  messageGuard: isImMessage,
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
