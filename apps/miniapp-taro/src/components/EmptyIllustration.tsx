import { View, Text, Image } from '@tarojs/components'
import { icon } from '@/constants/remote-icons'

export interface EmptyIllustrationProps {
  type?: 'empty' | 'search' | 'network' | 'permission'
  text?: string
  desc?: string
  actionText?: string
  onAction?: () => void
}

/** 有对应本地图标的类型(原项目 empty.png / search.svg) */
const ICON_IMAGES: Record<string, string> = {
  empty: icon('empty'),
  search: icon('search'),
}

/** 原项目无对应图标的类型,保留 emoji */
const ICON_EMOJIS: Record<string, string> = {
  network: '📡',
  permission: '🔒',
}

const DEFAULT_TEXTS: Record<string, string> = {
  empty: '暂无数据',
  search: '未找到相关内容',
  network: '网络异常',
  permission: '暂无权限',
}

export default function EmptyIllustration({
  type = 'empty',
  text,
  desc,
  actionText,
  onAction,
}: EmptyIllustrationProps) {
  const imgSrc = ICON_IMAGES[type]
  return (
    <View className="flex flex-col items-center justify-center py-12 px-4">
      {imgSrc ? (
        <Image className="w-12 h-12 mb-3" src={imgSrc} mode="aspectFit" />
      ) : (
        <Text className="text-5xl mb-3 text-muted-foreground">{ICON_EMOJIS[type] || '📭'}</Text>
      )}
      <Text className="text-sm text-muted-foreground mb-1">{text || DEFAULT_TEXTS[type]}</Text>
      {desc && <Text className="text-xs text-muted-foreground text-center mb-3">{desc}</Text>}
      {actionText && onAction && (
        <View className="px-4 py-2 rounded-md bg-primary/10" onClick={onAction}>
          <Text className="text-sm text-primary">{actionText}</Text>
        </View>
      )}
    </View>
  )
}
