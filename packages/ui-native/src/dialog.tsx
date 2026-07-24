import type { ComponentProps, ReactNode } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { cn } from '@ihui/design-tokens'

export interface DialogProps {
  visible: boolean
  onClose?: () => void
  children?: ReactNode
  className?: string
}

export function Dialog({ visible, onClose, children, className }: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50" onPress={onClose}>
        <View
          onStartShouldSetResponder={() => true}
          className={cn(
            'm-4 w-full max-w-lg rounded-lg border border-border bg-background p-6',
            className,
          )}
        >
          {children}
        </View>
      </Pressable>
    </Modal>
  )
}

export type DialogHeaderProps = ComponentProps<typeof View>
export type DialogTitleProps = ComponentProps<typeof Text>

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <View className={cn('mb-4', className)} {...props} />
}

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <Text className={cn('text-lg font-semibold text-foreground', className)} {...props} />
}

export function DialogDescription({ className, ...props }: DialogTitleProps) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function DialogFooter({ className, ...props }: DialogHeaderProps) {
  return <View className={cn('mt-4 flex-row justify-end gap-2', className)} {...props} />
}
