// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 薄壳:渲染交给共享屏 packages/app/src/features/live-host/LiveHostScreen.tsx
// 本页只保留 SRS 调用/计时/剪贴板/导航与文案兜底,无任何 UI 段。
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createSrsStream, updateSrsStream, type SrsStream } from '@ihui/api-client'
import { LiveHostScreen } from '@ihui/rn-app/features/live-host/LiveHostScreen'
import { formatDuration } from '@ihui/shared/utils'
import { useTt } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { unwrapApi } from '@/utils/api-bridge'
import { onToast } from '@/host/on-toast'

type StreamStatus = 'idle' | 'active' | 'inactive'

interface Product {
  id: string
  name: string
  price: number
}

/** 直播间商品列表:后端暂无商品绑定端点 ⇒ 恒空态(与素材库 audio"无后端类型不回填假数据"
 *  同纪律,原 3 条演示商品已去);补端点后在此接真源(接口在 aigc/商城域另行登记)。 */
const HOST_PRODUCTS: Product[] = []

const LIVE_HOST_TEXT: Record<string, string> = {
  'common.back': '返回',
  'liveHost.title': '主播中心',
  'liveHost.statusActive': '直播中',
  'liveHost.statusInactive': '已结束',
  'liveHost.statusIdle': '未开始',
  'liveHost.previewActive': '已开始预览',
  'liveHost.previewIdle': '未开始预览',
  'liveHost.streamTitle': '直播标题',
  'liveHost.streamTitlePlaceholder': '请输入直播标题',
  'liveHost.pushUrl': '推流地址',
  'liveHost.streamKey': '流密钥',
  'liveHost.copyHint': '已复制',
  'liveHost.copySuccess': '已复制到剪贴板',
  'liveHost.startLive': '开始直播',
  'liveHost.starting': '开启中...',
  'liveHost.endLive': '结束直播',
  'liveHost.ending': '结束中...',
  'liveHost.stats': '直播统计',
  'liveHost.statDuration': '直播时长',
  'liveHost.statViewers': '在线人数',
  'liveHost.statRecvBytes': '下行流量',
  'liveHost.statSendBytes': '上行流量',
  'liveHost.productManage': '商品管理',
  'liveHost.productAddBtn': '添加商品',
  'liveHost.productEmpty': '暂无商品',
  'liveHost.addProductToast': '商品添加功能待接入',
  'liveHost.titleRequired': '请输入直播标题',
  'liveHost.startFailed': '开启直播失败',
  'liveHost.endFailed': '结束直播失败',
  'liveHost.endLiveAlert': '直播已结束',
  'liveHost.endLiveDurationPrefix': '本次直播时长:',
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function LiveHost() {
  const tt = useTt()
  const t = useCallback((key: string) => tt(key, LIVE_HOST_TEXT[key] ?? key), [tt])
  const [streamTitle, setStreamTitle] = useState('')
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [stream, setStream] = useState<SrsStream | null>(null)
  const [duration, setDuration] = useState(0)
  // 观众数:保持真实 0,待后端观众上报端点接通再接真源(原随机假值已去,详见 startLive/计时器注释)
  const [viewers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status !== 'active') return
    const timer = setInterval(() => {
      setDuration((d) => d + 1)
      // 观众数不再随机涨假值:后端暂无观众上报源,保持真实 0(数据不撒谎原则)
    }, 1000)
    return () => clearInterval(timer)
  }, [status])

  const startLive = useCallback(async () => {
    if (status !== 'idle' || loading) return
    const title = streamTitle.trim()
    if (!title) {
      onToast(tt('liveHost.titleRequired', '请输入直播标题'), { kind: 'info' })
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await unwrapApi(createSrsStream({ title }))
      setStream(data)
      setStatus('active')
      setDuration(0)
      // 开播不再造"5~25 随机观众"假起点:真实计数待观众上报端点接通(见 HOST_PRODUCTS 同区在账)
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('liveHost.startFailed', '开启直播失败')
      setError(msg)
      onToast(msg, { kind: 'info' })
    } finally {
      setLoading(false)
    }
  }, [status, loading, streamTitle, tt])

  const endLive = useCallback(async () => {
    if (status !== 'active' || loading || !stream) return
    setLoading(true)
    setError('')
    try {
      await unwrapApi(updateSrsStream(stream.id, { status: 'inactive' }))
      setStatus('inactive')
      Taro.showModal({
        title: tt('liveHost.endLiveAlert', '直播已结束'),
        content: `${tt('liveHost.endLiveDurationPrefix', '本次直播时长:')}${formatDuration(duration)}`,
        showCancel: false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('liveHost.endFailed', '结束直播失败')
      setError(msg)
      onToast(msg, { kind: 'info' })
    } finally {
      setLoading(false)
    }
  }, [status, loading, stream, duration, tt])

  const copyText = useCallback(
    (text: string) => {
      if (!text) return
      Taro.setClipboardData({ data: text })
      onToast(tt('liveHost.copySuccess', '已复制到剪贴板'), { kind: 'success' })
    },
    [tt],
  )

  return (
    <ThemeRoot>
      <LiveHostScreen
        t={t}
        status={status}
        streamTitle={streamTitle}
        onStreamTitleChange={setStreamTitle}
        stream={stream}
        viewers={viewers}
        durationText={formatDuration(duration)}
        recvBytesText={formatBytes(stream?.recvBytes ?? null)}
        sendBytesText={formatBytes(stream?.sendBytes ?? null)}
        loading={loading}
        error={error}
        products={HOST_PRODUCTS}
        productsLoading={false}
        productsError=""
        onStartLive={startLive}
        onEndLive={endLive}
        onAddProduct={() =>
          onToast(tt('liveHost.addProductToast', '商品添加功能待接入'), { kind: 'info' })
        }
        onCopyText={copyText}
        onBack={() => void Taro.navigateBack()}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
