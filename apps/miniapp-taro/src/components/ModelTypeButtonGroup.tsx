import { View, ScrollView } from '@tarojs/components'
import ModelTypeButton, { type ModelType } from './ModelTypeButton'

export interface ModelTypeConfig {
  type: ModelType
  label: string
  icon: string
}

export const MODEL_TYPES: ModelTypeConfig[] = [
  { type: 'skills', label: '技能', icon: '/assets/tabbar/ai.png' },
  { type: 'talk', label: '文本', icon: '/assets/tabbar/ai.png' },
  { type: 'image', label: '图像', icon: '/assets/tabbar/ai.png' },
  { type: 'video', label: '视频', icon: '/assets/tabbar/ai.png' },
  { type: 'audio', label: '声音', icon: '/assets/tabbar/ai.png' },
  { type: 'videoa', label: '数字人', icon: '/assets/tabbar/ai.png' },
  { type: 'other', label: '全能', icon: '/assets/tabbar/ai.png' },
  { type: 'sck', label: '素材', icon: '/assets/tabbar/ai.png' },
]

export interface ModelTypeButtonGroupProps {
  activeType?: ModelType | ''
  onSelect?: (type: ModelType) => void
  types?: ModelTypeConfig[]
}

export default function ModelTypeButtonGroup({
  activeType = '',
  onSelect,
  types = MODEL_TYPES,
}: ModelTypeButtonGroupProps) {
  return (
    <ScrollView scrollX className="w-full whitespace-nowrap" enhanced showScrollbar={false}>
      <View className="inline-flex flex-row items-center px-3 py-2">
        {types.map((cfg) => (
          <ModelTypeButton
            key={cfg.type}
            type={cfg.type}
            label={cfg.label}
            icon={cfg.icon}
            active={activeType === cfg.type}
            onClick={onSelect}
          />
        ))}
      </View>
    </ScrollView>
  )
}
