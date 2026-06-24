<script setup lang="ts">
/**
 * 能力项组件
 * @description 可复用的 AI 能力卡片组件，用于展示模型、智能体、MCP 工具等
 */
import { computed, ref } from 'vue'
import { Cpu } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { CapabilityItemData } from './types'

const props = withDefaults(
  defineProps<{
    /** 能力数据 */
    data: CapabilityItemData
    /** 是否选中 */
    selected?: boolean
    /** 是否显示 API 访问按钮 */
    showApiAccess?: boolean
    /** 变体类型 */
    variant?: 'default' | 'compact' | 'featured'
  }>(),
  {
    selected: false,
    showApiAccess: false,
    variant: 'default',
  }
)

const emit = defineEmits<{
  (e: 'click', data: CapabilityItemData): void
  (e: 'apiAccess', data: CapabilityItemData): void
}>()

const { t } = useI18n()

/** 组件样式类 */
const itemClasses = computed(() => [
  'capability-item',
  `capability-item--${props.variant}`,
  {
    'capability-item--selected': props.selected,
  },
])

/** 处理点击 */
const handleClick = () => {
  emit('click', props.data)
}

/** 处理 API 访问点击 */
const handleApiAccess = (e: Event) => {
  e.stopPropagation()
  emit('apiAccess', props.data)
}

/** 图标加载失败时隐藏 img，避免裂图 */
const iconError = ref(false)
const onIconError = () => {
  iconError.value = true
}

/** 解析后端图标 URL：相对路径转为绝对 URL，便于图片加载 */
const resolvedIconUrl = computed(() => {
  const u = props.data?.iconUrl
  if (!u || typeof u !== 'string' || !u.trim()) return ''
  const raw = u.trim()
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  if (raw.startsWith('//')) return (typeof window !== 'undefined' ? window.location.protocol : 'https:') + raw
  if (raw.startsWith('/')) return (typeof window !== 'undefined' ? window.location.origin : '') + raw
  // 无前导斜杠的相对路径（如 upload/xxx）补上 origin
  return (typeof window !== 'undefined' ? window.location.origin : '') + '/' + raw
})
</script>

<template>
  <div :class="itemClasses" @click="handleClick">
    <!-- 选中指示器 -->
    <div v-if="selected" class="capability-item__indicator" />

    <!-- 主要内容 -->
    <div class="capability-item__content">
      <!-- 头部：名称和操作 -->
      <div class="capability-item__header">
        <div class="capability-item__name-wrapper">
          <!-- 图标：优先后端 URL，否则前端组件，最后默认 Cpu -->
          <div class="capability-item__icon">
            <img
              v-if="resolvedIconUrl && !iconError"
              :src="resolvedIconUrl"
              :alt="data.name"
              class="capability-item__icon-img"
              @error="onIconError"
            />
            <component v-else-if="data.icon" :is="data.icon" class="capability-item__icon-svg" />
            <Cpu v-else class="capability-item__icon-svg" />
          </div>
          <!-- 名称 -->
          <span class="capability-item__name">{{ data.name }}</span>
        </div>

        <!-- 操作区 -->
        <div class="capability-item__actions">
          <!-- API 接入：纯文案按钮，无任何图标，彻底替换原链式图标 -->
          <button
            v-if="showApiAccess"
            type="button"
            class="capability-item__api-btn"
            :title="t('floatingChat.apiAccess')"
            aria-label="API 接入"
            @click="handleApiAccess"
          >
            <span class="capability-item__api-btn-text">{{ t('floatingChat.apiAccess') }}</span>
          </button>

          <!-- 选中标签 -->
          <span v-if="selected" class="capability-item__tag capability-item__tag--selected">
            {{ t('common.selected') }}
          </span>
        </div>
      </div>

      <!-- 描述 -->
      <p v-if="data.description" class="capability-item__desc">
        {{ data.description }}
      </p>

      <!-- 标签组 -->
      <div v-if="data.tags?.length" class="capability-item__tags">
        <span v-for="tag in data.tags" :key="tag" class="capability-item__tag">
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.capability-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: hsl(var(--background));
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  &:hover {
    background: hsl(var(--muted) / 0.5);
    border-color: hsl(var(--border));
    transform: translateY(-1px);
    box-shadow: var(--global-box-shadow);
  }

  &--selected {
    background: hsl(var(--primary) / 0.06);
    border-color: hsl(var(--primary) / 0.4);

    &:hover {
      background: hsl(var(--primary) / 0.08);
      border-color: hsl(var(--primary) / 0.5);
    }
  }

  &--compact {
    padding: 10px 12px;

    .capability-item__name {
      font-size: 13px;
    }

    .capability-item__desc {
      font-size: 11px;
    }
  }

  &--featured {
    padding: 18px 20px;
    background: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
    border-width: 1.5px;

    .capability-item__name {
      font-size: 15px;
      font-weight: 600;
    }
  }

  // 选中指示器
  &__indicator {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60%;
    max-height: 32px;
    background: hsl(var(--primary));
    border-radius: var(--global-border-radius);
  }

  // 内容区
  &__content {
    flex: 1;
    min-width: 0;
  }

  // 头部
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  // 名称包装器
  &__name-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  // 图标
  &__icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: hsl(var(--primary) / 0.1);
    border-radius: var(--global-border-radius);
    color: hsl(var(--primary));
    overflow: hidden;
  }

  &__icon-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__icon-svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: inherit;
  }

  // 名称
  &__name {
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--foreground));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  // 操作区
  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  // API 接入：纯文案按钮（已替换原链式图标）
  &__api-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    padding: 0 10px;
    border: var(--unified-border);
    background: transparent;
    border-radius: var(--global-border-radius);
    color: hsl(var(--muted-foreground));
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition:
      background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
      color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: hsl(var(--muted) / 0.5);
      color: hsl(var(--foreground));
      border-color: hsl(var(--border));
      transform: translateY(-0.5px);
    }

    &:active {
      transform: translateY(0);
    }

    &:focus-visible {
      outline: 2px solid hsl(var(--primary) / 0.2);
      outline-offset: 1px;
    }
  }

  &__api-btn-text {
    white-space: nowrap;
  }

  // 标签
  &__tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: var(--global-border-radius);
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    letter-spacing: 0.01em;

    &--selected {
      background: hsl(var(--primary) / 0.15);
      color: hsl(var(--primary));
    }
  }

  // 描述
  &__desc {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: hsl(var(--muted-foreground));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // 标签组
  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }
}
</style>
