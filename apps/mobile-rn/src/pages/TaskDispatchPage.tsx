import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type {
  TaskDevice,
  TaskDeviceListResponse,
  TaskDispatch,
  TaskDispatchRequest,
  TaskDispatchResponse,
  TaskFilePayload,
  TaskResult,
  TaskStatus,
  TaskWsMessage,
} from '@ihui/shared'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { getToken } from '../lib/token'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDispatch'>

/** AsyncStorage 持久化键:最近一次见到任务的 updatedAt 时间戳(ms),用于 WS 重连后增量补拉 */
const LAST_SEEN_TS_KEY = 'task-last-seen-ts'

/** 附件 base64 解码后最大字节数(1MB,与服务端一致) */
const FILE_MAX_BYTES = 1_048_576

const STATUS_META: Record<TaskStatus, { badge: string }> = {
  pending: { badge: 'bg-gray-100 text-gray-600' },
  running: { badge: 'bg-indigo-100 text-indigo-700' },
  completed: { badge: 'bg-green-100 text-green-700' },
  failed: { badge: 'bg-red-100 text-red-700' },
  cancelled: { badge: 'bg-gray-100 text-gray-600' },
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** 统一走 { code, message, data } 格式,返回 data 字段 */
async function apiData<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = getToken()
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.data ?? json) as T
  } catch {
    return null
  }
}

/** 读取持久化的 lastSeenTs,失败返回 0 */
async function loadLastSeenTs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_TS_KEY)
    const n = raw ? Number.parseInt(raw, 10) : NaN
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** 持久化 lastSeenTs,失败静默 */
async function saveLastSeenTs(ts: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SEEN_TS_KEY, String(ts))
  } catch {
    /* ignore */
  }
}

/** 把增量补拉的任务 upsert 进本地数组(按 updatedAt 较新者覆盖,新任务前置) */
function upsertIncremental(prev: TaskDispatch[], incoming: TaskDispatch[]): TaskDispatch[] {
  const byId = new Map<string, TaskDispatch>()
  for (const t of prev) byId.set(t.id, t)
  let changed = false
  for (const task of incoming) {
    const existing = byId.get(task.id)
    if (!existing) {
      byId.set(task.id, task)
      changed = true
    } else if (Date.parse(task.updatedAt) > Date.parse(existing.updatedAt)) {
      byId.set(task.id, task)
      changed = true
    }
  }
  if (!changed) return prev
  const prevIds = new Set(prev.map((t) => t.id))
  const fresh = [...byId.values()].filter((t) => !prevIds.has(t.id))
  const updatedPrev = prev.map((t) => byId.get(t.id) ?? t)
  return [...fresh, ...updatedPrev]
}

export function TaskDispatchPage(_: Props) {
  const { token } = useAuth()
  const { t } = useI18n()
  const [command, setCommand] = useState('')
  const [toDevice, setToDevice] = useState<string>('')
  const [devices, setDevices] = useState<TaskDevice[]>([])
  const [tasks, setTasks] = useState<TaskDispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string>('')
  const [reconnecting, setReconnecting] = useState(false)
  // 附件面板相关状态(2026-07-24 P2-c 跨端文件传输)
  const [attachOpen, setAttachOpen] = useState(false)
  const [fileFilename, setFileFilename] = useState('')
  const [fileMime, setFileMime] = useState('text/plain')
  const [fileContent, setFileContent] = useState('')
  const [fileError, setFileError] = useState('')
  const lastSeenTsRef = useRef<number>(0)

  const loadTasks = useCallback(async () => {
    setError('')
    const data = await apiData<TaskDispatch[] | { list: TaskDispatch[] }>('/api/tasks')
    if (!data) {
      setError(t('taskDispatch.loadTasksFailed'))
      return
    }
    const list = Array.isArray(data) ? data : data.list ?? []
    setTasks(list)
    // 初始化 lastSeenTs 为全量任务中的最大 updatedAt
    const maxTs = list.reduce((max, x) => Math.max(max, Date.parse(x.updatedAt) || 0), 0)
    if (maxTs > lastSeenTsRef.current) {
      lastSeenTsRef.current = maxTs
      void saveLastSeenTs(maxTs)
    }
  }, [t])

  const loadDevices = useCallback(async () => {
    const data = await apiData<TaskDeviceListResponse>('/api/tasks/devices')
    if (!data) {
      setError(t('taskDispatch.loadDevicesFailed'))
      return
    }
    const list = Array.isArray(data.devices) ? data.devices : []
    setDevices(list)
    // 若当前选中设备失效或未选,自动选中第一个 online 设备
    setToDevice((prev) => {
      const stillValid = !!prev && list.some((d) => d.deviceId === prev)
      if (stillValid) return prev
      const firstOnline = list.find((d) => d.online)
      return firstOnline?.deviceId || list[0]?.deviceId || ''
    })
  }, [t])

  useEffect(() => {
    // 先恢复 lastSeenTs,再加载任务
    void (async () => {
      lastSeenTsRef.current = await loadLastSeenTs()
      await Promise.all([loadTasks(), loadDevices()])
      setLoading(false)
    })()
  }, [loadTasks, loadDevices])

  // WebSocket 实时监听 task-result / task-progress / task-cancelled 频道 + 重连增量补拉
  useEffect(() => {
    if (!token) return
    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/tasks?token=${encodeURIComponent(token)}`
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
    } catch {
      return
    }

    // 重连后(onopen)增量补拉断线期间错过的任务
    ws.onopen = () => {
      const since = lastSeenTsRef.current
      if (since <= 0) return
      setReconnecting(true)
      void (async () => {
        const data = await apiData<{ tasks: TaskDispatch[] } | TaskDispatch[]>(
          `/api/tasks?since=${since}`,
        )
        setReconnecting(false)
        if (!data) return
        const list = Array.isArray(data) ? data : data.tasks ?? []
        if (list.length === 0) return
        setTasks((prev) => upsertIncremental(prev, list))
        const maxTs = list.reduce((max, x) => Math.max(max, Date.parse(x.updatedAt) || 0), since)
        if (maxTs > lastSeenTsRef.current) {
          lastSeenTsRef.current = maxTs
          void saveLastSeenTs(maxTs)
        }
      })()
    }

    ws.onmessage = (ev: { data: unknown }) => {
      const raw = typeof ev.data === 'string' ? ev.data : ''
      if (!raw) return
      let msg: TaskWsMessage
      try {
        msg = JSON.parse(raw) as TaskWsMessage
      } catch {
        return
      }
      if (!msg?.taskId) return

      // task-cancelled:更新本地任务状态为 cancelled
      if (msg.type === 'task-cancelled') {
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id !== msg.taskId) return task
            const p = msg.payload as Partial<TaskDispatch>
            const updatedAt = p.updatedAt || new Date().toISOString()
            const ts = Date.parse(updatedAt)
            if (Number.isFinite(ts) && ts > lastSeenTsRef.current) {
              lastSeenTsRef.current = ts
              void saveLastSeenTs(ts)
            }
            return { ...task, status: 'cancelled', updatedAt }
          }),
        )
        return
      }

      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== msg.taskId) return task
          const p = msg.payload as Partial<TaskResult> & Partial<TaskDispatch>
          const status: TaskStatus = (p.status as TaskStatus) || task.status
          const hasResult =
            p.output !== undefined || p.error !== undefined || p.finishedAt !== undefined
          const result: TaskResult | undefined = hasResult
            ? {
                taskId: task.id,
                status,
                output: p.output,
                error: p.error,
                finishedAt: p.finishedAt || new Date().toISOString(),
              }
            : task.result
          const updatedAt = p.updatedAt || task.updatedAt
          const ts = Date.parse(updatedAt)
          if (Number.isFinite(ts) && ts > lastSeenTsRef.current) {
            lastSeenTsRef.current = ts
            void saveLastSeenTs(ts)
          }
          return { ...task, status, result, updatedAt }
        }),
      )
    }
    return () => {
      try {
        ws?.close()
      } catch {
        // ignore
      }
    }
  }, [token])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadTasks(), loadDevices()])
    setRefreshing(false)
  }, [loadTasks, loadDevices])

  // 解码 base64 后字节数;非法 base64 返回 -1
  const b64DecodedBytes = useCallback((b64: string): number => {
    try {
      // RN 全局无 atob,但 WebSocket 等 API 提供兼容;尝试用 fetch+data URL 解码兜底
      // 这里用 RN 内置的 base64 兼容:简单 decode(仅 ASCII 范围)
      const cleaned = b64.replace(/\s/g, '')
      if (!/^[A-Za-z0-9+/=]*$/.test(cleaned)) return -1
      // 估算字节数:base64 每 4 字符 → 3 字节,需处理 padding
      const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0
      return Math.floor(cleaned.length * 0.75) - padding
    } catch {
      return -1
    }
  }, [])

  // 当前附件面板中已构造的 filePayload(null = 无附件或校验失败)
  const pendingFilePayload: TaskFilePayload | null = (() => {
    if (!fileFilename.trim() || !fileContent.trim()) return null
    const bytes = b64DecodedBytes(fileContent)
    if (bytes < 0) return null
    if (bytes > FILE_MAX_BYTES) return null
    return {
      filename: fileFilename.trim(),
      size: bytes,
      mimeType: fileMime.trim() || 'application/octet-stream',
      content: fileContent.trim(),
    }
  })()

  const onSend = useCallback(async () => {
    const cmd = command.trim()
    if (!cmd || sending) return
    if (!toDevice) {
      setError(t('taskDispatch.selectDeviceFirst'))
      return
    }
    // 附件校验:已填但非法时拒绝
    if (fileFilename.trim() || fileContent.trim()) {
      const bytes = b64DecodedBytes(fileContent)
      if (bytes < 0) {
        setFileError(t('taskDispatch.file.invalidBase64'))
        return
      }
      if (bytes > FILE_MAX_BYTES) {
        setFileError(t('taskDispatch.file.tooLarge'))
        return
      }
      if (!fileFilename.trim()) {
        setFileError(t('taskDispatch.file.missingFilename'))
        return
      }
    }

    setSending(true)
    setError('')
    setFileError('')
    const body: TaskDispatchRequest = { toDevice, command: cmd }
    if (pendingFilePayload) {
      body.filePayload = pendingFilePayload
    }
    const data = await apiData<TaskDispatchResponse>('/api/tasks/dispatch', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setSending(false)
    if (!data?.task) {
      setError(t('taskDispatch.dispatchFailed'))
      return
    }
    setTasks((prev) => [data.task, ...prev])
    const ts = Date.parse(data.task.updatedAt)
    if (Number.isFinite(ts) && ts > lastSeenTsRef.current) {
      lastSeenTsRef.current = ts
      void saveLastSeenTs(ts)
    }
    setCommand('')
    // 清空附件面板
    setAttachOpen(false)
    setFileFilename('')
    setFileContent('')
    setFileMime('text/plain')
  }, [command, toDevice, sending, t, fileFilename, fileContent, fileMime, pendingFilePayload, b64DecodedBytes])

  /** 格式化附件大小显示 */
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }, [])

  // 取消任务:POST /tasks/:id/cancel(仅 pending/running 可取消)
  const onCancel = useCallback(
    async (taskId: string) => {
      if (cancellingId) return
      setCancellingId(taskId)
      const data = await apiData<{ task: TaskDispatch }>(`/api/tasks/${taskId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setCancellingId('')
      if (!data?.task) {
        setError(t('taskDispatch.cancel.cancelFailed'))
        return
      }
      // 乐观更新由 WS task-cancelled 消息驱动,这里兜底立即更新本地状态
      setTasks((prev) =>
        prev.map((x) => (x.id === taskId ? { ...x, status: 'cancelled' as TaskStatus } : x)),
      )
    },
    [cancellingId, t],
  )

  const canSend = !sending && command.trim().length > 0

  const deviceName = useCallback(
    (deviceId: string) => devices.find((d) => d.deviceId === deviceId)?.name || deviceId,
    [devices],
  )

  return (
    <View className="flex-1 bg-gray-50">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="bg-white px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="mb-2 text-base font-semibold text-gray-900">{t('taskDispatch.title')}</Text>
            {reconnecting ? (
              <View className="mb-2 flex-row items-center gap-1.5">
                <ActivityIndicator size="small" />
                <Text className="text-xs text-gray-500">{t('taskDispatch.reconnect.reconnecting')}</Text>
              </View>
            ) : null}
          </View>
          <TextInput
            value={command}
            onChangeText={setCommand}
            placeholder={t('taskDispatch.inputPlaceholder')}
            placeholderTextColor="#9ca3af"
            multiline
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {devices.length === 0 ? (
              <Text className="text-xs text-gray-400">{t('taskDispatch.noDevices')}</Text>
            ) : (
              devices.map((d) => {
                const selected = toDevice === d.deviceId
                return (
                  <Pressable
                    key={d.deviceId}
                    onPress={() => setToDevice(d.deviceId)}
                    className={`flex-row items-center gap-1.5 rounded-md px-3 py-1.5 ${selected ? 'bg-gray-900' : 'bg-gray-100'}`}
                  >
                    <View
                      className={`h-2 w-2 rounded-full ${d.online ? 'bg-green-500' : 'bg-gray-300'}`}
                    />
                    <Text className={`text-xs ${selected ? 'text-white' : 'text-gray-600'}`}>
                      {d.name}
                    </Text>
                  </Pressable>
                )
              })
            )}
            <Pressable
              onPress={() => setAttachOpen((v) => !v)}
              className={`ml-auto flex-row items-center gap-1.5 rounded-md px-3 py-1.5 ${attachOpen || pendingFilePayload ? 'bg-indigo-600' : 'bg-gray-100'}`}
              accessibilityRole="button"
            >
              <Text className={`text-xs font-semibold ${attachOpen || pendingFilePayload ? 'text-white' : 'text-gray-600'}`}>
                {t('taskDispatch.file.attach')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              className={`rounded-md px-4 py-1.5 ${canSend ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <Text className="text-xs font-semibold text-white">
                {sending ? t('taskDispatch.sending') : t('taskDispatch.send')}
              </Text>
            </Pressable>
          </View>
          {attachOpen ? (
            <View className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <TextInput
                value={fileFilename}
                onChangeText={setFileFilename}
                placeholder={t('taskDispatch.file.filenamePlaceholder')}
                placeholderTextColor="#9ca3af"
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <View className="mt-2 flex-row gap-2">
                <TextInput
                  value={fileMime}
                  onChangeText={setFileMime}
                  placeholder={t('taskDispatch.file.mimePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900"
                />
                {pendingFilePayload ? (
                  <Text className="self-center text-xs text-gray-500">
                    {formatFileSize(pendingFilePayload.size)}
                  </Text>
                ) : null}
              </View>
              <TextInput
                value={fileContent}
                onChangeText={setFileContent}
                placeholder={t('taskDispatch.file.contentPlaceholder')}
                placeholderTextColor="#9ca3af"
                multiline
                className="mt-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900"
                style={{ minHeight: 60, textAlignVertical: 'top' }}
              />
              {pendingFilePayload ? (
                <Text className="mt-2 text-xs text-green-700">
                  {t('taskDispatch.file.attached', {
                    filename: pendingFilePayload.filename,
                    size: formatFileSize(pendingFilePayload.size),
                  })}
                </Text>
              ) : null}
              {fileError ? (
                <Text className="mt-1 text-xs text-red-600">{fileError}</Text>
              ) : null}
            </View>
          ) : null}
          {error ? <Text className="mt-2 text-xs text-red-600">{error}</Text> : null}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="text-sm text-gray-400">{t('taskDispatch.emptyTasks')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const meta = STATUS_META[item.status] || STATUS_META.pending
              const canCancel = item.status === 'pending' || item.status === 'running'
              const isCancelling = cancellingId === item.id
              return (
                <View className="rounded-lg border border-gray-100 bg-white p-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={2}>
                      {item.command}
                    </Text>
                    <View className={`rounded-md px-2 py-0.5 ${meta.badge}`}>
                      <Text className="text-xs">{t(`taskDispatch.status.${item.status}`)}</Text>
                    </View>
                  </View>
                  <View className="mt-2 flex-row items-center gap-3">
                    <Text className="text-xs text-gray-500">{`${t('taskDispatch.target')}: ${deviceName(item.toDevice)}`}</Text>
                    <Text className="text-xs text-gray-400">{formatTime(item.createdAt)}</Text>
                  </View>
                  {item.filePayload ? (
                    <View className="mt-2 flex-row items-center gap-2 rounded-md bg-indigo-50 px-2 py-1.5">
                      <View className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <Text className="text-xs text-indigo-700" numberOfLines={1}>
                        {t('taskDispatch.file.attached', {
                          filename: item.filePayload.filename,
                          size: formatFileSize(item.filePayload.size),
                        })}
                      </Text>
                    </View>
                  ) : null}
                  {item.result?.output ? (
                    <Text className="mt-2 text-xs text-gray-600" numberOfLines={3}>
                      {item.result.output}
                    </Text>
                  ) : null}
                  {item.result?.error ? (
                    <Text className="mt-1 text-xs text-red-600" numberOfLines={2}>
                      {item.result.error}
                    </Text>
                  ) : null}
                  {canCancel ? (
                    <View className="mt-2 flex-row justify-end">
                      <Pressable
                        onPress={() => onCancel(item.id)}
                        disabled={isCancelling}
                        className="flex-row items-center gap-1.5 rounded-md px-3 py-1.5"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isCancelling }}
                      >
                        {isCancelling ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : null}
                        <Text className="text-xs font-semibold text-red-600">
                          {isCancelling
                            ? t('taskDispatch.cancel.cancelling')
                            : t('taskDispatch.cancel.cancelButton')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )
            }}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  )
}

export default TaskDispatchPage
