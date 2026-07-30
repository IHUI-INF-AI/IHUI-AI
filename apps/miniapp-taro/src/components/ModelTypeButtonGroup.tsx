import { View, ScrollView } from '@tarojs/components'
import { useTt } from '@/i18n'
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

const MODEL_TYPE_KEY: Record<string, string> = {
  skills: 'modelType.skills',
  talk: 'modelType.talk',
  image: 'modelType.image',
  video: 'modelType.video',
  audio: 'modelType.audio',
  videoa: 'modelType.videoa',
  other: 'modelType.other',
  sck: 'modelType.sck',
}

export interface ModelTypeButtonGroupProps {
  activeType?: ModelType | ''
  onSelect?: (type: ModelType) => void
  types?: ModelTypeConfig[]
  /** 按钮组样式:'compact' 紧凑纵向(旧)/ 'wide' 宽按钮横向(首页专用,对齐原项目 8 个 model-type-btn)*/
  variant?: 'compact' | 'wide'
}

/**
 * ModelTypeButtonGroup 模型类型按钮组(8 个:skills/talk/image/video/audio/videoa/other/sck)
 *
 * - 'compact'(默认):横向 scroll-x,纵向小按钮(图标+文字)
 * - 'wide'(首页专用):横向 scroll-x,宽按钮 200rpx×60rpx(对齐原项目 .model-type-btn)
 *   外层 flex justify-center + padding 0 20rpx,scroll-view 内部 inline-flex 横向排列
 */
export default function ModelTypeButtonGroup({
  activeType = '',
  onSelect,
  types = MODEL_TYPES,
  variant = 'compact',
}: ModelTypeButtonGroupProps) {
  const tt = useTt()

  if (variant === 'wide') {
    // ===== wide 模式:对齐原项目 ai_index.vue 8 个 model-type-btn(scroll-x 横向滚动)=====
    return (
      <View
        className="flex flex-row justify-center"
        style={{ marginBottom: '10rpx' }}
      >
        <ScrollView scrollX className="w-full whitespace-nowrap" enhanced showScrollbar={false}>
          <View
            className="inline-flex flex-row items-center"
            style={{ padding: '0 20rpx' }}
          >
            {types.map((cfg) => (
              <ModelTypeButton
                key={cfg.type}
                type={cfg.type}
                label={tt(MODEL_TYPE_KEY[cfg.type] ?? 'modelType.other', cfg.label)}
                icon={cfg.icon}
                active={activeType === cfg.type}
                onClick={onSelect}
                variant="wide"
              />
            ))}
          </View>
        </ScrollView>
      </View>
    )
  }

  // ===== compact 模式:兼容旧调用 =====
  return (
    <ScrollView scrollX className="w-full whitespace-nowrap" enhanced showScrollbar={false}>
      <View className="inline-flex flex-row items-center px-3 py-2">
        {types.map((cfg) => (
          <ModelTypeButton
            key={cfg.type}
            type={cfg.type}
            label={tt(MODEL_TYPE_KEY[cfg.type] ?? 'modelType.other', cfg.label)}
            icon={cfg.icon}
            active={activeType === cfg.type}
            onClick={onSelect}
          />
        ))}
      </View>
    </ScrollView>
  )
}
