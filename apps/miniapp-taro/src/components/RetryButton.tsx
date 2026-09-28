// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { t } from '@/i18n'
import { View, Text } from '@tarojs/components'

export interface RetryButtonProps {
  text?: string
  onClick?: () => void
}

export default function RetryButton({ text = t('tail.7'), onClick }: RetryButtonProps) {
  return (
    <View
      className="inline-flex items-center px-4 py-2 rounded-md bg-primary/10"
      onClick={onClick}
      hoverClass="opacity-60"
    >
      <Text className="text-sm text-primary">↻ {text}</Text>
    </View>
  )
}
