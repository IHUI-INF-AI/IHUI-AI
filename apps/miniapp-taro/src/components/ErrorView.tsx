// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { useTt, t } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'

export interface ErrorViewProps {
  title?: string
  desc?: string
  onRetry?: () => void
}

export default function ErrorView({
  title = t('common.failed'),
  desc = t('ErrorView.p1'),
  onRetry,
}: ErrorViewProps) {
  const tt = useTt()
  return (
    <View className="flex flex-col items-center justify-center py-12 px-4">
      <LineIcon
        name="triangle-alert"
        size={72}
        color="var(--color-muted-foreground)"
        className="mb-3"
      />
      <Text className="text-sm font-medium text-foreground mb-1">{title}</Text>
      <Text className="text-xs text-muted-foreground mb-4 text-center">{desc}</Text>
      {onRetry && (
        <View
          className="px-4 py-2 rounded-md bg-primary/10"
          onClick={onRetry}
          hoverClass="opacity-60"
        >
          <Text className="text-sm text-primary">{tt('common.retry', '重试')}</Text>
        </View>
      )}
    </View>
  )
}
