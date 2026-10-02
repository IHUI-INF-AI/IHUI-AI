// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Stub for @ihui/shared - vitest mock
// Handles all @ihui/shared/* subpath imports via dynamic fallback re-exports.
// Each known path has its own implementation; unknown paths fall through to passthrough.

// ─── Core exports ─────────────────────────────────────────────────────────────

import type React from 'react'
import { useState, useCallback } from 'react'

export function formatRelativeTime(_date: string | Date): string {
  return 'just now'
}

// ─── @ihui/shared/constants 的名字:只许转发,不得自述 ──────────────────────────
// 票 G-815404① / 与 G-364(auth)、api-client 两格同族。本替身此前把真实常量表的两个成员
// **刻意清空**(`FALLBACK_MODELS = []`、`SSO_CLIENT_IDS = {}`),另外四个手抄了字面量。
// 后果是"测替身"伪装成"测实现":`src/screens/ChatScreen.tsx:489` 读 `FALLBACK_MODELS[0]!.id`、
// `src/lib/config.ts:47` 读 `SSO_CLIENT_IDS.MOBILE_RN`,在 vitest 下前者是 undefined、后者恒是
// undefined,凡是走这条路又没有自带 `vi.mock` 的用例,断言的是虚构空表而不是真实降级模型。
// 出路只有转发(同 `ihui-shared-auth.ts` / `ihui-api-client.ts` 的处置):**禁止**为了走通
// barrel 把真实常量再抄一份进替身 —— 那只是把"第二份真相"从空表换成抄来的表,一样会漂。
// 逐个模块指名转发而不用 `export * from '.../constants'`:barrel 还带出 THEME_STORAGE_KEY 等
// 本端未从 '@ihui/shared' 根入口取的名字,通配转发会让替身凭空长出一批导出面。
export { FALLBACK_MODELS } from '../../../../packages/shared/src/constants/fallback-models'
export { SSO_CLIENT_IDS } from '../../../../packages/shared/src/constants/sso-client-ids'
export {
  LOCALE_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from '../../../../packages/shared/src/constants/storage-keys'
export { DEFAULT_AVATAR_URL } from '../../../../packages/shared/src/constants/external-urls'

export type ChatMessage = Record<string, unknown>

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
// 这些名字已在文件头按模块逐个转发(见「只许转发,不得自述」段),此处不再重复声明。

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
