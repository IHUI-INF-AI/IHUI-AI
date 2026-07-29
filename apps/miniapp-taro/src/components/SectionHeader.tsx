import { View, Text } from '@tarojs/components'
import type { ReactNode } from 'react'
import { useI18n } from '@/i18n'

/**
 * 通用"标题 + 查看更多"区块头部组件。
 * 对齐原项目 components/MoreTitles/index.vue:左侧标题(可选副标题)+ 右侧"查看更多 >"。
 */
export interface SectionHeaderProps {
  title: string
  subtitle?: string
  moreText?: string
  showMore?: boolean
  onMore?: () => void
  extra?: ReactNode
  className?: string
}

export default function SectionHeader({
  title,
  subtitle,
  moreText,
  showMore = true,
  onMore,
  extra,
  className = '',
}: SectionHeaderProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const moreLabel = moreText ?? tt('common.viewMore', '查看更多')

  return (
    <View className={`flex items-center justify-between ${className}`}>
      <View className="flex items-center min-w-0 flex-1">
        <Text className="text-[28rpx] font-bold text-foreground truncate">{title}</Text>
        {subtitle && (
          <Text className="ml-2 text-[24rpx] text-muted-foreground truncate">{subtitle}</Text>
        )}
      </View>
      <View className="flex items-center flex-shrink-0">
        {extra}
        {showMore && (
          <View className="flex items-center ml-2" onClick={onMore}>
            <Text className="text-[24rpx] text-primary">{moreLabel}</Text>
            <Text className="ml-1 text-[24rpx] text-primary">{'>'}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
