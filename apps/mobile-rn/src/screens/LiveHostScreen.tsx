import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getResources, type Resource } from '@ihui/api-client'
import {
  LiveHostScreen as SharedLiveHostScreen,
  type LiveHostProduct,
  type LiveHostStatus,
  type LiveHostStreamData,
} from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatDuration, formatFileSize } from '@ihui/shared/utils'
import { useI18n } from '../i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface StreamData {
  id: string
  streamKey: string
  title: string
  pushUrl: string | null
  recvBytes: number | null
  sendBytes: number | null
}

function mapResource(r: Resource): LiveHostProduct | null {
  if (!r.title) return null
  const price = typeof r.price === 'number' ? r.price : Number(r.price) || 0
  return { id: r.id, name: r.title, price }
}

function mapStream(s: StreamData): LiveHostStreamData {
  return {
    id: s.id,
    streamKey: s.streamKey,
    title: s.title,
    pushUrl: s.pushUrl,
    recvBytes: s.recvBytes,
    sendBytes: s.sendBytes,
  }
}

export function LiveHostScreen() {
  const navigation = useNavigation<Nav>()
  const { t } = useI18n()
  const [streamTitle, setStreamTitle] = useState('')
  const [status, setStatus] = useState<LiveHostStatus>('idle')
  const [stream, setStream] = useState<StreamData | null>(null)
  const [duration, setDuration] = useState(0)
  const [viewers, setViewers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<LiveHostProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')

  useEffect(() => {
    if (status !== 'active') return
    const t = setInterval(() => {
      setDuration((d) => d + 1)
      setViewers((v) => v + Math.floor(Math.random() * 5))
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  useEffect(() => {
    let cancelled = false
    setProductsLoading(true)
    setProductsError('')
    getResources({ page: 1, pageSize: 20 })
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          const mapped = res.data.list
            .map(mapResource)
            .filter((p): p is LiveHostProduct => p !== null)
          setProducts(mapped)
        } else {
          setProductsError(res.error || t('liveHost.productLoadFailed'))
        }
      })
      .catch((e) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : t('liveHost.productLoadFailed')
        setProductsError(msg)
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const callApi = useCallback(
    async (path: string, method: string, body?: unknown) => {
      const res = await fetchApi(path, { method, body: body ? JSON.stringify(body) : undefined })
      if (!res.success) throw new Error(res.error || t('common.failed'))
      return res.data
    },
    [t],
  )

  const startLive = async () => {
    const title = streamTitle.trim()
    if (!title) return Alert.alert(t('common.hint'), t('liveHost.error.titleRequired'))
    setLoading(true)
    setError('')
    try {
      const data = (await callApi('/api/srs/streams', 'POST', { title })) as StreamData
      setStream(data)
      setStatus('active')
      setDuration(0)
      setViewers(Math.floor(Math.random() * 20) + 5)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('liveHost.error.startFailed')
      setError(msg)
      Alert.alert(t('common.error'), msg)
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
      Alert.alert(
        t('liveHost.ended.title'),
        t('liveHost.ended.message', { duration: formatDuration(duration) }),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('liveHost.error.endFailed')
      setError(msg)
      Alert.alert(t('common.error'), msg)
    } finally {
      setLoading(false)
    }
  }

  const copyText = (text: string, label: string) =>
    Alert.alert(label, text, [{ text: t('common.close') }])

  const sharedStream = useMemo(() => (stream ? mapStream(stream) : null), [stream])
  const durationText = useMemo(() => formatDuration(duration), [duration])
  const recvBytesText = useMemo(
    () => formatFileSize(stream?.recvBytes ?? 0),
    [stream?.recvBytes],
  )
  const sendBytesText = useMemo(
    () => formatFileSize(stream?.sendBytes ?? 0),
    [stream?.sendBytes],
  )

  return (
    <SharedLiveHostScreen
      t={t}
      status={status}
      streamTitle={streamTitle}
      onStreamTitleChange={setStreamTitle}
      stream={sharedStream}
      duration={duration}
      viewers={viewers}
      durationText={durationText}
      recvBytesText={recvBytesText}
      sendBytesText={sendBytesText}
      loading={loading}
      error={error}
      products={products}
      productsLoading={productsLoading}
      productsError={productsError}
      onStartLive={startLive}
      onEndLive={endLive}
      onAddProduct={() => Alert.alert(t('common.hint'), t('liveHost.productAdd.message'))}
      onCopyText={copyText}
      onBack={() => navigation.goBack()}
    />
  )
}
