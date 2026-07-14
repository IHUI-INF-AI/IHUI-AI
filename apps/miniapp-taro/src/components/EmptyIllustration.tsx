import { View, Text } from '@tarojs/components'

export interface EmptyIllustrationProps {
  type?: 'empty' | 'search' | 'network' | 'permission'
  text?: string
  desc?: string
  actionText?: string
  onAction?: () => void
}

const ICONS: Record<string, string> = {
  empty: '📭',
  search: '🔍',
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
  return (
    <View className="flex flex-col items-center justify-center py-12 px-4">
      <Text className="text-5xl mb-3 text-gray-200">{ICONS[type]}</Text>
      <Text className="text-sm text-gray-500 mb-1">{text || DEFAULT_TEXTS[type]}</Text>
      {desc && <Text className="text-xs text-gray-400 text-center mb-3">{desc}</Text>}
      {actionText && onAction && (
        <View className="px-4 py-2 rounded-full bg-indigo-50" onClick={onAction}>
          <Text className="text-sm text-indigo-600">{actionText}</Text>
        </View>
      )}
    </View>
  )
}
