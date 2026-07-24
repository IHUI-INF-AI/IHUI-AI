import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type StreamStatus = 'idle' | 'active' | 'inactive'

interface StreamData {
  id: string
  streamKey: string
  title: string
  pushUrl: string | null
  recvBytes: number | null
  sendBytes: number | null
}

interface Product {
  id: string
  name: string
  price: number
}

const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'AI 课程包', price: 199 },
  { id: '2', name: '会员年卡', price: 365 },
  { id: '3', name: '实体周边', price: 89 },
]

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

const BADGE_STYLE: Record<StreamStatus, { cls: string; text: string }> = {
  idle: { cls: 'bg-neutral-300', text: '未开始' },
  active: { cls: 'bg-emerald-500', text: '直播中' },
  inactive: { cls: 'bg-neutral-400', text: '已结束' },
}

export function LiveHostScreen() {
  const navigation = useNavigation<Nav>()
  const { token } = useAuth()
  const [streamTitle, setStreamTitle] = useState('')
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [stream, setStream] = useState<StreamData | null>(null)
  const [duration, setDuration] = useState(0)
  const [viewers, setViewers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status !== 'active') return
    const t = setInterval(() => {
      setDuration((d) => d + 1)
      setViewers((v) => v + Math.floor(Math.random() * 5))
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  const callApi = useCallback(
    async (path: string, method: string, body?: unknown) => {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = (await res.json()) as { data?: unknown; message?: string }
      if (!res.ok) throw new Error(json.message || `请求失败(${res.status})`)
      return json.data
    },
    [token],
  )

  const startLive = async () => {
    const title = streamTitle.trim()
    if (!title) return Alert.alert('提示', '请输入直播标题')
    setLoading(true)
    setError('')
    try {
      const data = (await callApi('/api/srs/streams', 'POST', { title })) as StreamData
      setStream(data)
      setStatus('active')
      setDuration(0)
      setViewers(Math.floor(Math.random() * 20) + 5)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '开启直播失败'
      setError(msg)
      Alert.alert('错误', msg)
    } finally {
      setLoading(false)
    }
  }

  const endLive = async () => {
    if (!stream) return
    setLoading(true)
    setError('')
    try {
      await callApi(`/api/srs/streams/${stream.id}`, 'PUT', { status: 'inactive' })
      setStatus('inactive')
      Alert.alert('直播已结束', `本次直播时长:${formatDuration(duration)}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '结束直播失败'
      setError(msg)
      Alert.alert('错误', msg)
    } finally {
      setLoading(false)
    }
  }

  const copyText = (text: string, label: string) => Alert.alert(label, text, [{ text: '关闭' }])
  const badge = BADGE_STYLE[status]

  const stats: { label: string; value: string; cls?: string }[] = [
    { label: '直播时长', value: formatDuration(duration) },
    { label: '观众数', value: String(viewers), cls: 'text-emerald-600' },
    { label: '收到字节', value: formatBytes(stream?.recvBytes ?? null) },
    { label: '发送字节', value: formatBytes(stream?.sendBytes ?? null) },
  ]

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="flex-row items-center px-4 pt-12 pb-2 gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-sm text-neutral-500">返回</Text>
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">主播端</Text>
        <View className={`rounded-md px-2 py-0.5 ${badge.cls}`}>
          <Text className="text-xs text-white">{badge.text}</Text>
        </View>
      </View>

      {error ? (
        <View className="px-4 py-1">
          <Text className="text-xs text-red-600">{error}</Text>
        </View>
      ) : null}

      <View className="mx-4 mt-2 h-44 rounded-xl bg-neutral-900 items-center justify-center">
        <Text className="text-sm text-neutral-400">
          {status === 'active' ? '直播推流中(摄像头预览占位)' : '摄像头预览(占位)'}
        </Text>
      </View>

      <View className="mx-4 mt-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <Text className="text-xs text-neutral-500 mb-1">直播标题</Text>
        <TextInput
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-50"
          value={streamTitle}
          onChangeText={setStreamTitle}
          placeholder="请输入直播标题"
          placeholderTextColor="#9ca3af"
          editable={status === 'idle'}
        />
        {stream ? (
          <View className="mt-2">
            <TouchableOpacity onPress={() => stream.pushUrl && copyText(stream.pushUrl, '推流地址')}>
              <Text className="text-xs text-neutral-500" numberOfLines={1}>
                推流地址:{stream.pushUrl || '—'}(点击查看)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => copyText(stream.streamKey, '流密钥')}>
              <Text className="text-xs text-neutral-500 mt-1" numberOfLines={1}>
                流密钥:{stream.streamKey}(点击查看)
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View className="mx-4 mt-3 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 rounded-lg bg-emerald-500 py-3 items-center"
          onPress={startLive}
          disabled={loading || status !== 'idle'}
        >
          <Text className="text-sm font-semibold text-white">
            {loading && status === 'idle' ? '开启中...' : '开始直播'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 rounded-lg bg-red-500 py-3 items-center"
          onPress={endLive}
          disabled={loading || status !== 'active'}
        >
          <Text className="text-sm font-semibold text-white">
            {loading && status === 'active' ? '结束中...' : '结束直播'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mx-4 mt-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
          直播数据
        </Text>
        <View className="flex-row flex-wrap">
          {stats.map((s) => (
            <View key={s.label} className="w-1/2 mb-2">
              <Text className="text-xs text-neutral-500">{s.label}</Text>
              <Text className={`text-sm font-semibold text-neutral-900 dark:text-neutral-50 ${s.cls || ''}`}>{s.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mx-4 mt-3 mb-8 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">商品管理</Text>
          <TouchableOpacity
            onPress={() => Alert.alert('提示', '商品添加功能待接入')}
            className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2 py-1"
          >
            <Text className="text-xs text-emerald-600">+ 添加商品</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={MOCK_PRODUCTS}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text className="text-xs text-neutral-500 py-2 text-center">暂无商品</Text>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between py-2">
              <Text className="flex-1 text-sm text-neutral-900 dark:text-neutral-50" numberOfLines={1}>{item.name}</Text>
              <Text className="text-sm font-semibold text-red-500">¥{item.price}</Text>
            </View>
          )}
        />
      </View>
    </ScrollView>
  )
}
