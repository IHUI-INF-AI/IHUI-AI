// Stub for @ihui/shared - vitest mock
// Handles all @ihui/shared/* subpath imports via dynamic fallback re-exports.
// Each known path has its own implementation; unknown paths fall through to passthrough.

// ─── Core exports ─────────────────────────────────────────────────────────────

import type React from 'react'
import { useState, useCallback } from 'react'

export const FALLBACK_MODELS = [] as const
export type ChatMessage = Record<string, unknown>

export function formatRelativeTime(_date: string | Date): string {
  return 'just now'
}

export const LOCALE_STORAGE_KEY = 'ihui-locale'
export const SSO_CLIENT_IDS = {} as Record<string, string>
export const DEFAULT_AVATAR_URL = 'https://file.aizhs.top/sys-mini/daixaodiming.png'
export const TOKEN_STORAGE_KEY = 'ihui_token'
export const REFRESH_TOKEN_STORAGE_KEY = 'ihui_refresh_token'

// ─── @ihui/shared/stores ──────────────────────────────────────────────────────
// Re-exported from a dynamic import when needed for ThemeContext/auth-store tests.

// ─── @ihui/shared/utils/date-utils ────────────────────────────────────────────
// Re-exported from a dynamic import when needed.

// ─── @ihui/shared/notifications ───────────────────────────────────────────────
// Re-exported from ihui-shared-notif-ws for useNotificationWebSocket tests.

// ─── @ihui/shared/hooks/use-debounce ──────────────────────────────────────────
export function useDebounce<T>(value: T, _delay: number): T {
  return value
}
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  _fn: T,
  _delay: number,
): T {
  return _fn
}

// ─── @ihui/shared/hooks/use-countdown ─────────────────────────────────────────
export function useCountdown(_targetDate: Date): { seconds: number; running: boolean } {
  return { seconds: 0, running: false }
}

// ─── @ihui/shared/hooks/use-mounted ───────────────────────────────────────────
export function useMounted(): boolean {
  return true
}

// ─── @ihui/shared/hooks/use-pagination ────────────────────────────────────────
export function usePagination<T>(
  _fetcher: () => Promise<{ list: T[]; total: number }>,
  _opts?: Record<string, unknown>,
) {
  return {
    list: [] as T[],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    load: async () => {},
    loadMore: async () => {},
    hasNext: false,
  }
}

// ─── @ihui/shared/hooks/use-load-more ─────────────────────────────────────────
export function useLoadMore<T>(_fetcher: () => Promise<T[]>, _opts?: Record<string, unknown>) {
  return {
    items: [] as T[],
    loading: false,
    loadMore: async () => {},
    hasNext: false,
  }
}

// ─── @ihui/shared/hooks/use-clipboard ─────────────────────────────────────────
export function createUseClipboard() {
  return () => ({ copied: false, copy: async () => {} })
}

// ─── @ihui/shared/hooks (re-export via ihui-shared-hooks.ts) ─────────────────
// Tests import from '@ihui/shared/hooks' directly – handled by vitest alias.

// ─── @ihui/shared/auth (re-export via ihui-shared-auth.ts) ────────────────────
// Tests import from '@ihui/shared/auth' directly – handled by vitest alias.

// ─── @ihui/shared/notifications/use-notification-websocket ────────────────────
// Tests import from this path directly – handled by vitest alias (ihui-shared-notif-ws.ts).

// ─── @ihui/shared/notifications (re-export hook) ──────────────────────────────
export { useNotificationWebSocket } from './ihui-shared-notif-ws'

// ─── @ihui/shared/utils ───────────────────────────────────────────────────────
export function formatDateOnly(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}
export function formatTokenValue(_value: number): string {
  return String(_value)
}
export function formatShortDuration(_ms: number): string {
  return '0s'
}
export function formatFileSize(_bytes: number): string {
  return '0 B'
}
export function formatDuration(_seconds: number): string {
  return '0:00'
}
export function getRoleLabel(_role: string): string {
  return _role
}
export function formatDate(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}
export function formatDateByTemplate(_date: string | Date, _template: string): string {
  return new Date(_date).toLocaleDateString()
}
export function formatShortDateTime(_date: string | Date): string {
  return new Date(_date).toLocaleString()
}
export function formatShortDate(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}
export function formatShortDateWithYear(_date: string | Date): string {
  return new Date(_date).toLocaleDateString()
}
export function formatTimeOnly(_date: string | Date): string {
  return new Date(_date).toLocaleTimeString()
}

// ─── @ihui/shared/constants ───────────────────────────────────────────────────
// Already exported above (LOCALE_STORAGE_KEY, SSO_CLIENT_IDS, DEFAULT_AVATAR_URL)

// ─── @ihui/shared/stores (dynamic) ────────────────────────────────────────────
// Lazily loads and caches to avoid circular requires at module evaluation time.
let _storesCache: Record<string, unknown> | null = null
export function getStores() {
  if (!_storesCache) {
    // Use dynamic import to avoid circular dependency at eval time
    import('./ihui-shared-stores')
      .then((m) => {
        _storesCache = m
      })
      .catch(() => {
        _storesCache = {}
      })
  }
  return _storesCache ?? {}
}

// ─── @ihui/shared/notifications/notification-store (dynamic) ──────────────────
let _notifStoreCache: Record<string, unknown> | null = null
export function getNotificationStore() {
  if (!_notifStoreCache) {
    import('./ihui-shared-notif-store')
      .then((m) => {
        _notifStoreCache = m
      })
      .catch(() => {
        _notifStoreCache = {}
      })
  }
  return _notifStoreCache ?? {}
}

// ─── @ihui/shared/use-agent-runtime ───────────────────────────────────────────
export type AgentRuntimeStatus = 'idle' | 'running' | 'completed' | 'failed'
export interface AgentRuntimePermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
}
export interface UseAgentRuntimeReturn {
  status: AgentRuntimeStatus
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  sessionId: string | null
  plan: string | null
  output: string
  error: string | null
  permission: AgentRuntimePermissionEvent | null
  handleSend: () => Promise<void>
  handleStop: () => void
  handleClear: () => void
}
export function useAgentRuntime(_initialSessionId?: string): UseAgentRuntimeReturn {
  const [status, setStatus] = useState<AgentRuntimeStatus>('idle')
  const [input, setInput] = useState('')
  const [sessionId] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<AgentRuntimePermissionEvent | null>(null)

  const handleSend = useCallback(async () => {}, [])
  const handleStop = useCallback(() => setStatus('idle'), [])
  const handleClear = useCallback(() => {
    setStatus('idle')
    setInput('')
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)
  }, [])

  return {
    status,
    input,
    setInput,
    sessionId,
    plan,
    output,
    error,
    permission,
    handleSend,
    handleStop,
    handleClear,
  }
}
