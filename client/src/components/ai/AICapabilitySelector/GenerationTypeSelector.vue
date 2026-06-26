<script setup lang="ts">
/**
 * 生成类型选择器组件
 * @description AI 内容生成类型选择器，支持自动识别、图像、视频、3D、语音等
 */
import { computed } from 'vue'
import { markIcon } from '@/utils/markRaw'
import { useI18n } from 'vue-i18n'
import {
  Sparkles,
  Image,
  Video,
  Box,
  Eye,
  Mic,
  Music,
} from 'lucide-vue-next'
import type { GenerationType, ImageProvider, VideoProvider } from './types'

const props = withDefaults(
  defineProps<{
    /** 当前生成类型 */
    generationType: GenerationType
    /** 当前图像服务商 */
    imageProvider?: ImageProvider
    /** 当前视频服务商 */
    videoProvider?: VideoProvider
    /** 是否显示服务商选择 */
    showProvider?: boolean
  }>(),
  {
    imageProvider: 'qwen',
    videoProvider: 'qwen',
    showProvider: true,
  }
)

const emit = defineEmits<{
  (e: 'update:generationType', type: GenerationType): void
  (e: 'update:imageProvider', provider: ImageProvider): void
  (e: 'update:videoProvider', provider: VideoProvider): void
}>()

const { t } = useI18n()

/** 生成类型配置 */
const generationTypes = computed(() => [
  {
    key: 'auto' as const,
    label: t('floatingChat.generationTypeAuto'),
    icon: markIcon(Sparkles),
    description: t('floatingChat.generationTypeAutoDesc'),
  },
  {
    key: 'image' as const,
    label: t('floatingChat.generationTypeImage'),
    icon: markIcon(Image),
    description: t('floatingChat.generationTypeImageDesc'),
  },
  {
    key: 'video' as const,
    label: t('floatingChat.generationTypeVideo'),
    icon: markIcon(Video),
    description: t('floatingChat.generationTypeVideoDesc'),
  },
  {
    key: '3d' as const,
    label: t('floatingChat.generationType3D'),
    icon: markIcon(Box),
    description: t('floatingChat.generationType3DDesc'),
  },
  {
    key: 'vision' as const,
    label: t('floatingChat.generationTypeVision'),
    icon: markIcon(Eye),
    description: t('floatingChat.generationTypeVisionDesc'),
  },
  {
    key: 'audio' as const,
    label: t('floatingChat.generationTypeAudio'),
    icon: markIcon(Mic),
    description: t('floatingChat.generationTypeAudioDesc'),
  },
  {
    key: 'music' as const,
    label: t('floatingChat.generationTypeMusic'),
    icon: markIcon(Music),
    description: t('floatingChat.generationTypeMusicDesc'),
  },
])

/** 图像服务商配置 */
const imageProviders = [
  { key: 'qwen' as const, label: '通义万相' },
  { key: 'doubao' as const, label: '豆包' },
  { key: 'jimeng' as const, label: '即梦' },
]

/** 视频服务商配置 */
const videoProviders = [
  { key: 'qwen' as const, label: '通义万相' },
  { key: 'kling' as const, label: '可灵AI' },
  { key: 'one-click' as const, label: '一键视频' },
]

/** 选择生成类型 */
const selectType = (type: GenerationType) => {
  emit('update:generationType', type)
}

/** 选择图像服务商 */
const selectImageProvider = (provider: ImageProvider) => {
  emit('update:imageProvider', provider)
}

/** 选择视频服务商 */
const selectVideoProvider = (provider: VideoProvider) => {
  emit('update:videoProvider', provider)
}

/** 获取当前类型描述 */
const currentDescription = computed(() => {
  return generationTypes.value.find(t => t.key === props.generationType)?.description || ''
})

/** 当前选中的图标 */
const currentIcon = computed(() => {
  return generationTypes.value.find(t => t.key === props.generationType)?.icon || Sparkles
})
</script>

<template>
  <div class="generation-selector">
    <!-- 类型选择网格 -->
    <div class="generation-selector__grid">
      <button
        v-for="type in generationTypes"
        :key="type.key"
        class="generation-selector__item"
        :class="{ 'generation-selector__item--active': generationType === type.key }"
        @click="selectType(type.key)"
      >
        <component :is="type.icon" class="generation-selector__icon" />
        <span class="generation-selector__label">{{ type.label }}</span>
      </button>
    </div>

    <!-- 服务商选择 -->
    <Transition name="slide-fade">
      <div
        v-if="showProvider && generationType === 'image'"
        class="generation-selector__provider"
      >
        <span class="generation-selector__provider-label">
          {{ t('floatingChat.imageProvider') || '图像服务商' }}
        </span>
        <div class="generation-selector__provider-options">
          <button
            v-for="provider in imageProviders"
            :key="provider.key"
            class="generation-selector__provider-btn"
            :class="{ 'generation-selector__provider-btn--active': imageProvider === provider.key }"
            @click="selectImageProvider(provider.key)"
          >
            {{ provider.label }}
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="slide-fade">
      <div
        v-if="showProvider && generationType === 'video'"
        class="generation-selector__provider"
      >
        <span class="generation-selector__provider-label">
          {{ t('floatingChat.videoProvider') || '视频服务商' }}
        </span>
        <div class="generation-selector__provider-options">
          <button
            v-for="provider in videoProviders"
            :key="provider.key"
            class="generation-selector__provider-btn"
            :class="{ 'generation-selector__provider-btn--active': videoProvider === provider.key }"
            @click="selectVideoProvider(provider.key)"
          >
            {{ provider.label }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- 描述信息 -->
    <div class="generation-selector__info">
      <div class="generation-selector__info-icon">
        <component
          :is="currentIcon"
          class="w-4 h-4"
        />
      </div>
      <p class="generation-selector__info-text">{{ currentDescription }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.generation-selector {
  display: flex;
  flex-direction: column;
  gap: 16px;

  // 类型选择网格
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 8px;
  }

  // 类型选项
  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    background: hsl(var(--muted) / 0.3);
    border: 1.5px solid transparent;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: hsl(var(--muted) / 0.5);
      border-color: hsl(var(--border) / 0.5);
      
    }

    &--active {
      background: hsl(var(--primary) / 0.08);
      border-color: hsl(var(--primary) / 0.5);

      .generation-selector__icon {
        color: hsl(var(--primary));
      }

      .generation-selector__label {
        color: hsl(var(--primary));
        font-weight: 500;
      }
    }
  }

  // 图标
  &__icon {
    width: 20px;
    height: 20px;
    color: hsl(var(--muted-foreground));
    transition: color 0.2s ease;
  }

  // 标签
  &__label {
    font-size: 12px;
    font-weight: 400;
    color: hsl(var(--foreground));
    text-align: center;
    line-height: 1.3;
    letter-spacing: 0.01em;
  }

  // 服务商选择区
  &__provider {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    background: hsl(var(--muted) / 0.3);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
  }

  &__provider-label {
    font-size: 12px;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    letter-spacing: 0.02em;
  }

  &__provider-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__provider-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 400;
    color: hsl(var(--foreground));
    background: hsl(var(--background));
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:hover {
      background: hsl(var(--muted) / 0.5);
      border-color: hsl(var(--border));
    }

    &--active {
      background: hsl(var(--primary));
      border-color: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
      font-weight: 500;

      &:hover {
        background: hsl(var(--primary) / 0.9);
      }
    }
  }

  // 信息提示
  &__info {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: hsl(var(--primary) / 0.04);
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
  }

  &__info-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: hsl(var(--primary) / 0.1);
    border-radius: var(--global-border-radius);
    color: hsl(var(--primary));
  }

  &__info-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: hsl(var(--muted-foreground));
    padding-top: 2px;
  }
}

// 过渡动画
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  
}
</style>
