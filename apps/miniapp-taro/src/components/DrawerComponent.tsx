import { View } from '@tarojs/components'

export interface DrawerComponentProps {
  visible: boolean
  onClose?: () => void
  height?: string
  maskClosable?: boolean
  children?: React.ReactNode
}

export default function DrawerComponent({
  visible,
  onClose,
  height = 'auto',
  maskClosable = true,
  children,
}: DrawerComponentProps) {
  if (!visible) return null

  const handleMaskClick = () => {
    if (maskClosable) onClose?.()
  }

  const handleStop = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }

  return (
    <View className="fixed inset-0 z-[90] flex flex-col justify-end">
      <View className="absolute inset-0 bg-black/40 transition-opacity" onClick={handleMaskClick} />
      <View
        className="relative bg-white rounded-t-xl overflow-hidden transition-transform"
        style={{ maxHeight: '80vh', height }}
        onClick={handleStop}
      >
        <View className="flex justify-center pt-2 pb-1">
          <View className="w-9 h-1 rounded-lg bg-gray-200" />
        </View>
        {children}
      </View>
    </View>
  )
}
