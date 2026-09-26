// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, Video } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { vpStageHeightRpx } from '@ihui/shared/ui/video-player-spec'
import { rpx } from '@/utils/rpx'

/**
 * 舞台高度单一源是 `video-player-spec` 的 16:9 比例(与 RN `aspectRatio` 同源同值);
 * 原先写死 `210px` 是"375 参考宽上的投影",换算成 rpx 后随屏宽缩放,行为也与 RN 对齐。
 * 控制条是微信原生 chrome(平台机制,登记 waiver),故本端只吃舞台尺寸这一档。
 */
const STAGE_STYLE: CSSProperties = { height: rpx(vpStageHeightRpx()) }

export interface VideoPlayerProps {
  src?: string
  poster?: string
  autoplay?: boolean
  controls?: boolean
  loading?: boolean
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
  onError?: (msg: string) => void
}

export default function VideoPlayer({
  src,
  poster,
  autoplay = false,
  controls = true,
  loading = false,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onError,
}: VideoPlayerProps) {
  const tt = useTt()
  if (loading) {
    return (
      <View
        className="flex items-center justify-center w-full bg-[var(--color-black)]"
        style={STAGE_STYLE}
      >
        <Text className="text-sm text-muted-foreground">
          {tt('common.loadingShort', '加载中...')}
        </Text>
      </View>
    )
  }

  if (!src) {
    return (
      <View
        className="flex items-center justify-center w-full bg-[var(--color-black)]"
        style={STAGE_STYLE}
      >
        <Text className="text-sm text-muted-foreground">{tt('video.noVideo', '暂无视频')}</Text>
      </View>
    )
  }

  return (
    <View className="w-full bg-[var(--color-black)]" style={STAGE_STYLE}>
      <Video
        className="w-full"
        style={STAGE_STYLE}
        src={src}
        poster={poster}
        controls={controls}
        autoplay={autoplay}
        objectFit="contain"
        onPlay={() => onPlay?.()}
        onPause={() => onPause?.()}
        onTimeUpdate={(e) => onTimeUpdate?.(e.detail.currentTime, e.detail.duration)}
        onEnded={() => onEnded?.()}
        onError={(e) => onError?.(e.detail.errMsg || tt('VideoPlayer.p1', '播放错误'))}
      />
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
