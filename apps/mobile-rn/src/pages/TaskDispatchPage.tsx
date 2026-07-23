import { useCallback, useEffect, useState } from 'react'
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type {
  TaskDevice,
  TaskDeviceListResponse,
  TaskDispatch,
  TaskDispatchRequest,
  TaskDispatchResponse,
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

  const loadTasks = useCallback(async () => {
    setError('')
    const data = await apiData<TaskDispatch[] | { list: TaskDispatch[] }>('/api/tasks')
    if (!data) {
      setError(t('taskDispatch.loadTasksFailed'))
      return
    }
    const list = Array.isArray(data) ? data : data.list ?? []
    setTasks(list)
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
    Promise.all([loadTasks(), loadDevices()]).finally(() => setLoading(false))
  }, [loadTasks, loadDevices])

  // WebSocket 实时监听 task-result / task-progress 频道
  useEffect(() => {
    if (!token) return
    const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/tasks?token=${encodeURIComponent(token)}`
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
    } catch {
      return
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
          return { ...task, status, result }
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

  const onSend = useCallback(async () => {
    const cmd = command.trim()
    if (!cmd || sending) return
    if (!toDevice) {
      setError(t('taskDispatch.selectDeviceFirst'))
      return
    }
    setSending(true)
    setError('')
    const body: TaskDispatchRequest = { toDevice, command: cmd }
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
    setCommand('')
  }, [command, toDevice, sending, t])

  const canSend = !sending && command.trim().length > 0

  const deviceName = useCallback(
    (deviceId: string) => devices.find((d) => d.deviceId === deviceId)?.name || deviceId,
    [devices],
  )

  return (
    <View className="flex-1 bg-gray-50">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="bg-white px-4 py-3">
          <Text className="mb-2 text-base font-semibold text-gray-900">{t('taskDispatch.title')}</Text>
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
              onPress={onSend}
              disabled={!canSend}
              className={`ml-auto rounded-md px-4 py-1.5 ${canSend ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <Text className="text-xs font-semibold text-white">
                {sending ? t('taskDispatch.sending') : t('taskDispatch.send')}
              </Text>
            </Pressable>
          </View>
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
