// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { t } from '@/i18n'
import { View, Text } from '@tarojs/components'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  inline?: boolean
}

export default function LoadingSpinner({
  size = 'md',
  text = t('earnings.loading'),
  inline = false,
}: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <View className={`flex items-center justify-center ${inline ? 'inline-flex' : 'py-8'}`}>
      <View
        className={`${sizeClass} mr-2 rounded-full border-2 border-border border-t-brand-accent-deep animate-spin`}
      />
      <Text className={`${textClass} text-muted-foreground`}>{text}</Text>
    </View>
  )
}
