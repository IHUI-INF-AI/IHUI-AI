import { View, Text } from '@tarojs/components'

export interface ConfirmDialogProps {
  visible?: boolean
  title?: string
  content?: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export default function ConfirmDialog({
  visible = false,
  title = '提示',
  content = '',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <View className="absolute inset-0 bg-black/40" />
      <View
        className="relative bg-card rounded-xl mx-8 px-6 py-5 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Text className="block text-base font-medium text-foreground mb-2 text-center">{title}</Text>
        {content && (
          <Text className="block text-sm text-muted-foreground mb-4 text-center leading-relaxed">
            {content}
          </Text>
        )}
        <View className="flex space-x-3">
          <View className="flex-1 py-2.5 rounded-md bg-muted text-center" onClick={onCancel}>
            <Text className="text-sm text-foreground">{cancelText}</Text>
          </View>
          <View className="flex-1 py-2.5 rounded-md bg-primary text-center" onClick={onConfirm}>
            <Text className="text-sm text-white">{confirmText}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
