// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/live-host/LiveHostScreen.tsx
import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createSrsStream, updateSrsStream, type SrsStream } from '@ihui/api-client'
import { unwrapApi } from '@/utils/api-bridge'
import { formatDuration } from '@ihui/shared/utils'
import ThemeRoot from '@/components/ThemeRoot'

type StreamStatus = 'idle' | 'active' | 'inactive'

interface Product {
  id: string
  name: string
  price: number
}

/** 直播间商品列表:后端暂无商品绑定端点 ⇒ 恒空态(与素材库 audio"无后端类型不回填假数据"
 *  同纪律,原 3 条演示商品已去);补端点后在此接真源(接口在 aigc/商城域另行登记)。 */
const HOST_PRODUCTS: Product[] = []

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function LiveHost() {
  const tt = useTt()
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
      Taro.showToast({ title: tt('liveHost.titleRequired', '请输入直播标题'), icon: 'none' })
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
      Taro.showToast({ title: msg, icon: 'none' })
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
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [status, loading, stream, duration, tt])

  const copyText = useCallback(
    (text: string) => {
      if (!text) return
      Taro.setClipboardData({ data: text })
      Taro.showToast({ title: tt('liveHost.copySuccess', '已复制到剪贴板'), icon: 'success' })
    },
    [tt],
  )

  // 对齐 RN shared LiveHostScreen statusBadgeColor:active=success / inactive=gray.400 / idle=border.medium
  const badgeCls =
    status === 'active'
      ? 'bg-[var(--color-success)]'
      : status === 'inactive'
        ? 'bg-[var(--color-text-tertiary)]'
        : 'bg-[var(--color-border-medium)]'
  const badgeText =
    status === 'active'
      ? tt('liveHost.statusActive', '直播中')
      : status === 'inactive'
        ? tt('liveHost.statusInactive', '已结束')
        : tt('liveHost.statusIdle', '未开始')

  const stats: { label: string; value: string }[] = [
    { label: tt('liveHost.duration', '直播时长'), value: formatDuration(duration) },
    { label: tt('liveHost.viewers', '观众数'), value: String(viewers) },
    { label: tt('liveHost.recvBytes', '收到字节'), value: formatBytes(stream?.recvBytes ?? null) },
    { label: tt('liveHost.sendBytes', '发送字节'), value: formatBytes(stream?.sendBytes ?? null) },
  ]

  return (
    <ThemeRoot>
      {/* 对齐 RN shared LiveHostScreen container(tk.surface.bg → var(--color-background))
          注:RN header paddingTop 48 为补偿 RN 自带 NavBar,小程序原生导航栏已占位;标题由原生导航栏承载 */}
      <View className="min-h-screen bg-[var(--color-background)]">
        {/* header:状态徽章(11dp → 22rpx,radius 12 → 24rpx) */}
        <View className="flex items-center px-[20rpx] pt-[16rpx] pb-[16rpx]">
          <View className={`px-[16rpx] py-[4rpx] rounded-xl ${badgeCls}`}>
            <Text className="text-[length:22rpx] text-[var(--color-primary-foreground)]">
              {badgeText}
            </Text>
          </View>
        </View>

        {error ? (
          <View className="px-[20rpx] py-[8rpx]">
            <Text className="text-[length:28rpx] text-[var(--color-danger)]">{error}</Text>
          </View>
        ) : null}

        {/* previewArea:height 176 → 352rpx,marginHorizontal 10 → 20rpx,radius 12 → 24rpx,bg gray.900 */}
        <View className="mx-[20rpx] mt-[16rpx] h-[352rpx] rounded-xl bg-[var(--color-screen-canvas)] flex items-center justify-center">
          <Text className="text-[length:28rpx] text-[var(--color-text-tertiary)]">
            {status === 'active'
              ? tt('liveHost.cameraPreviewActive', '直播推流中')
              : tt('liveHost.cameraPreview', '摄像头预览')}
          </Text>
        </View>

        {/* sectionBox:marginHorizontal 10 → 20rpx,marginTop 12 → 24rpx,padding 12 → 24rpx,radius 24rpx */}
        <View className="mx-[20rpx] mt-[24rpx] p-[24rpx] rounded-xl border-[length:2rpx] border-[var(--color-border)]">
          <Text className="block text-[length:28rpx] text-[var(--color-text-tertiary)] mb-[16rpx]">
            {tt('liveHost.streamTitle', '直播标题')}
          </Text>
          <FocusInput
            className="rounded-sm border-[length:2rpx] border-[var(--color-border)] px-[24rpx] py-[28rpx] text-[length:32rpx] text-foreground bg-[var(--color-muted)]"
            value={streamTitle}
            onInput={(e) => setStreamTitle(e.detail.value)}
            placeholder={tt('liveHost.streamTitlePlaceholder', '请输入直播标题')}
            disabled={status !== 'idle'}
          />
          {stream ? (
            <View className="mt-[16rpx]">
              <View
                onClick={() => stream.pushUrl && copyText(stream.pushUrl)}
                hoverClass="opacity-60"
              >
                <Text className="block mt-[16rpx] text-[length:28rpx] text-[var(--color-text-tertiary)]">
                  {tt('liveHost.pushUrl', '推流地址')}:{stream.pushUrl || '—'}
                </Text>
              </View>
              <View
                className="mt-[16rpx]"
                onClick={() => copyText(stream.streamKey)}
                hoverClass="opacity-60"
              >
                <Text className="block mt-[16rpx] text-[length:28rpx] text-[var(--color-text-tertiary)]">
                  {tt('liveHost.streamKey', '流密钥')}:{stream.streamKey}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* actionRow:gap 12 → 24rpx;btnSuccess 用 brand(纯黑/纯白)、btnDanger 用 danger;禁用 opacity 0.5 */}
        <View className="flex gap-[24rpx] mx-[20rpx] mt-[24rpx]">
          <View
            className={`flex-1 py-[30rpx] rounded-xl items-center justify-center bg-primary ${
              loading || status !== 'idle' ? 'opacity-50' : ''
            }`}
            onClick={startLive}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:32rpx] font-semibold text-[var(--color-primary-foreground)]">
              {loading && status === 'idle'
                ? tt('liveHost.starting', '开启中...')
                : tt('liveHost.startLive', '开始直播')}
            </Text>
          </View>
          <View
            className={`flex-1 py-[30rpx] rounded-xl items-center justify-center bg-[var(--color-danger)] ${
              loading || status !== 'active' ? 'opacity-50' : ''
            }`}
            onClick={endLive}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:32rpx] font-semibold text-[var(--color-primary-foreground)]">
              {loading && status === 'active'
                ? tt('liveHost.ending', '结束中...')
                : tt('liveHost.endLive', '结束直播')}
            </Text>
          </View>
        </View>

        {/* 直播数据:sectionTitle 18dp → 36rpx semibold;statLabel 14 → 28rpx;statValue 16 → 32rpx */}
        <View className="mx-[20rpx] mt-[24rpx] p-[24rpx] rounded-xl border-[length:2rpx] border-[var(--color-border)]">
          <Text className="block text-[length:36rpx] font-semibold text-foreground mb-[16rpx]">
            {tt('liveHost.liveData', '直播数据')}
          </Text>
          <View className="flex flex-wrap">
            {stats.map((s) => (
              <View key={s.label} className="w-1/2 mb-[16rpx]">
                <Text className="text-[length:28rpx] text-[var(--color-text-tertiary)]">
                  {s.label}
                </Text>
                <Text className="text-[length:32rpx] font-semibold text-foreground">{s.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 商品管理:lastSection marginBottom 32 → 64rpx;添加按钮 bg card + success 文字 */}
        <View className="mx-[20rpx] mt-[24rpx] p-[24rpx] rounded-xl border-[length:2rpx] border-[var(--color-border)] mb-[64rpx]">
          <View className="flex items-center justify-between mb-[16rpx]">
            <Text className="text-[length:36rpx] font-semibold text-foreground">
              {tt('liveHost.productManagement', '商品管理')}
            </Text>
            <View
              className="ui-control rounded-sm bg-[var(--color-card)] px-[16rpx] py-[8rpx]"
              onClick={() =>
                Taro.showToast({
                  title: tt('liveHost.addProductToast', '商品添加功能待接入'),
                  icon: 'none',
                })
              }
              hoverClass="opacity-60"
            >
              <Text className="text-[length:28rpx] text-[var(--color-success)]">
                {tt('liveHost.addProduct', '+ 添加商品')}
              </Text>
            </View>
          </View>
          {HOST_PRODUCTS.length === 0 ? (
            <Text className="block text-[length:28rpx] text-[var(--color-text-tertiary)] py-[16rpx] text-center">
              {tt('pointsMall.empty', '暂无商品')}
            </Text>
          ) : (
            HOST_PRODUCTS.map((item) => (
              <View key={item.id} className="flex items-center justify-between py-[16rpx]">
                <Text className="flex-1 mr-[16rpx] text-[length:32rpx] text-foreground">
                  {item.name}
                </Text>
                <Text className="text-[length:32rpx] font-semibold text-[var(--color-danger)]">
                  ¥{item.price}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
