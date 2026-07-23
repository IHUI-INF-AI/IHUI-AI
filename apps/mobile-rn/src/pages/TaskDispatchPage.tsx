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
  TaskDispatch,
  TaskDispatchRequest,
  TaskDispatchResponse,
  TaskResult,
  TaskStatus,
  TaskWsMessage,
} from '@ihui/shared'
import { useAuth } from '../context/AuthContext'
import { getToken } from '../lib/token'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDispatch'>

const DEVICES = [
  { key: 'desktop', label: '桌面端' },
  { key: 'web', label: '网页端' },
  { key: 'cloud', label: '云端' },
] as const

const STATUS_META: Record<TaskStatus, { label: string; badge: string }> = {
  pending: { label: '待执行', badge: 'bg-gray-100 text-gray-600' },
  running: { label: '执行中', badge: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已完成', badge: 'bg-green-100 text-green-700' },
  failed: { label: '失败', badge: 'bg-red-100 text-red-700' },
  cancelled: { label: '已取消', badge: 'bg-gray-100 text-gray-600' },
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

function deviceLabel(key: string): string {
  return DEVICES.find((d) => d.key === key)?.label || key
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
  const [command, setCommand] = useState('')
  const [toDevice, setToDevice] = useState<string>('desktop')
  const [tasks, setTasks] = useState<TaskDispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const loadTasks = useCallback(async () => {
    setError('')
    const data = await apiData<TaskDispatch[] | { list: TaskDispatch[] }>('/api/tasks')
    if (!data) {
      setError('加载任务失败')
      return
    }
    const list = Array.isArray(data) ? data : data.list ?? []
    setTasks(list)
  }, [])

  useEffect(() => {
    loadTasks().finally(() => setLoading(false))
  }, [loadTasks])

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
        prev.map((t) => {
          if (t.id !== msg.taskId) return t
          const p = msg.payload as Partial<TaskResult> & Partial<TaskDispatch>
          const status: TaskStatus = (p.status as TaskStatus) || t.status
          const hasResult =
            p.output !== undefined || p.error !== undefined || p.finishedAt !== undefined
          const result: TaskResult | undefined = hasResult
            ? {
                taskId: t.id,
                status,
                output: p.output,
                error: p.error,
                finishedAt: p.finishedAt || new Date().toISOString(),
              }
            : t.result
          return { ...t, status, result }
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
    await loadTasks()
    setRefreshing(false)
  }, [loadTasks])

  const onSend = useCallback(async () => {
    const cmd = command.trim()
    if (!cmd || sending) return
    setSending(true)
    setError('')
    const body: TaskDispatchRequest = { toDevice, command: cmd }
    const data = await apiData<TaskDispatchResponse>('/api/tasks/dispatch', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setSending(false)
    if (!data?.task) {
      setError('下发失败')
      return
    }
    setTasks((prev) => [data.task, ...prev])
    setCommand('')
  }, [command, toDevice, sending])

  const canSend = !sending && command.trim().length > 0

  return (
    <View className="flex-1 bg-gray-50">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="bg-white px-4 py-3">
          <Text className="mb-2 text-base font-semibold text-gray-900">任务下发</Text>
          <TextInput
            value={command}
            onChangeText={setCommand}
            placeholder="输入任务指令,例如:运行单元测试"
            placeholderTextColor="#9ca3af"
            multiline
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {DEVICES.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setToDevice(d.key)}
                className={`rounded-md px-3 py-1.5 ${toDevice === d.key ? 'bg-gray-900' : 'bg-gray-100'}`}
              >
                <Text className={`text-xs ${toDevice === d.key ? 'text-white' : 'text-gray-600'}`}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              className={`ml-auto rounded-md px-4 py-1.5 ${canSend ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <Text className="text-xs font-semibold text-white">{sending ? '发送中' : '发送任务'}</Text>
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
                <Text className="text-sm text-gray-400">已下发的任务会显示在这里</Text>
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
                      <Text className="text-xs">{meta.label}</Text>
                    </View>
                  </View>
                  <View className="mt-2 flex-row items-center gap-3">
                    <Text className="text-xs text-gray-500">{`目标: ${deviceLabel(item.toDevice)}`}</Text>
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
