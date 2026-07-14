import { View, Image, Text } from '@tarojs/components'

export type ModelType = 'skills' | 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other' | 'sck'

export interface ModelTypeButtonProps {
  type: ModelType
  label: string
  icon: string
  active?: boolean
  onClick?: (type: ModelType) => void
}

export default function ModelTypeButton({
  type,
  label,
  icon,
  active = false,
  onClick,
}: ModelTypeButtonProps) {
  return (
    <View
      className={`flex flex-col items-center justify-center mr-3 px-3 py-2 rounded-lg transition-colors ${
        active ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-transparent'
      }`}
      onClick={() => onClick?.(type)}
    >
      <Image className="w-5 h-5 mb-1" src={icon} mode="aspectFit" />
      <Text className={`text-[11px] ${active ? 'text-indigo-600' : 'text-gray-600'}`}>{label}</Text>
    </View>
  )
}
