import { View, ScrollView } from '@tarojs/components'
import { useI18n } from '@/i18n'
import ModelTypeButton, { type ModelType } from './ModelTypeButton'
import skillsIcon from '../assets/images/add/skills.svg'
import talkIcon from '../assets/images/add/talk.svg'
import imageIcon from '../assets/images/add/image.svg'
import videoIcon from '../assets/images/add/video.svg'
import audioIcon from '../assets/images/add/audio.svg'
import videoaIcon from '../assets/images/add/videoa.svg'
import otherIcon from '../assets/images/add/other.svg'
import sckIcon from '../assets/images/add/sck.svg'

export interface ModelTypeConfig {
  type: ModelType
  label: string
  icon: string
}

export const MODEL_TYPES: ModelTypeConfig[] = [
  { type: 'skills', label: '技能', icon: skillsIcon },
  { type: 'talk', label: '文本', icon: talkIcon },
  { type: 'image', label: '图像', icon: imageIcon },
  { type: 'video', label: '视频', icon: videoIcon },
  { type: 'audio', label: '声音', icon: audioIcon },
  { type: 'videoa', label: '数字人', icon: videoaIcon },
  { type: 'other', label: '全能', icon: otherIcon },
  { type: 'sck', label: '素材', icon: sckIcon },
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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  return (
    <ScrollView scrollX className="w-full whitespace-nowrap" enhanced showScrollbar={false}>
      <View className="inline-flex flex-row items-center px-3 py-2">
        {types.map((cfg) => (
          <ModelTypeButton
            key={cfg.type}
            type={cfg.type}
            label={tt(`modelType.${cfg.type}`, cfg.label)}
            icon={cfg.icon}
            active={activeType === cfg.type}
            onClick={onSelect}
          />
        ))}
      </View>
    </ScrollView>
  )
}
