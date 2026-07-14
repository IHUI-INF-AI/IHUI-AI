import { View, Text, Video } from '@tarojs/components'

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
  if (loading) {
    return (
      <View
        className="flex items-center justify-center w-full bg-black"
        style={{ height: '210px' }}
      >
        <Text className="text-sm text-gray-400">加载中...</Text>
      </View>
    )
  }

  if (!src) {
    return (
      <View
        className="flex items-center justify-center w-full bg-black"
        style={{ height: '210px' }}
      >
        <Text className="text-sm text-gray-400">暂无视频</Text>
      </View>
    )
  }

  return (
    <View className="w-full bg-black" style={{ height: '210px' }}>
      <Video
        className="w-full"
        style={{ height: '210px' }}
        src={src}
        poster={poster}
        controls={controls}
        autoplay={autoplay}
        objectFit="contain"
        onPlay={() => onPlay?.()}
        onPause={() => onPause?.()}
        onTimeUpdate={(e) => onTimeUpdate?.(e.detail.currentTime, e.detail.duration)}
        onEnded={() => onEnded?.()}
        onError={(e) => onError?.(e.detail.errMsg || '播放错误')}
      />
    </View>
  )
}
