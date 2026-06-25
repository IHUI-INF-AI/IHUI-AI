<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="isActive && currentStepInfo" class="tour-overlay" @click="skip">
        <div
          class="tour-tooltip"
          :class="[`tour-placement-${currentStepInfo.placement || 'bottom'}`]"
          @click.stop
        >
          <div class="tour-header">
            <div class="tour-title">{{ currentStepInfo.title }}</div>
            <div class="tour-close" @click="skip" :aria-label="t('tour.close')">
              <el-icon><Close /></el-icon>
            </div>
          </div>
          <div class="tour-content">{{ currentStepInfo.content }}</div>
          <div class="tour-footer">
            <div class="tour-progress">{{ currentStep + 1 }} / {{ steps.length }}</div>
            <div class="tour-actions">
              <el-button v-if="!isFirstStep" @click="prev" size="small">
                {{ t('tour.prev') }}
              </el-button>
              <el-button v-if="currentStepInfo.showSkip !== false" @click="skip" size="small" link>
                {{ t('tour.skip') }}
              </el-button>
              <el-button type="primary" @click="next" size="small">
                {{ isLastStep ? t('tour.complete') : t('tour.next') }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Close } from '@element-plus/icons-vue'
import type { TourStep } from '@/composables/useTour'

const { t } = useI18n()

interface Props {
  isActive: boolean
  currentStep: number
  steps: TourStep[]
  currentStepInfo: TourStep | undefined
  isFirstStep: boolean
  isLastStep: boolean
}

const _props = defineProps<Props>()

const emit = defineEmits<{
  next: []
  prev: []
  skip: []
}>()

const next = () => {
  emit('next')
}

const prev = () => {
  emit('prev')
}

const skip = () => {
  emit('skip')
}
</script>

<style scoped lang="scss">
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-loading);
  background-color: var(--color-black-50);
  backdrop-filter: blur(2px);
}

.tour-tooltip {
  position: absolute;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  min-width: 300px;
  max-width: 400px;
  z-index: var(--z-max);
}

.tour-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: var(--unified-border-bottom);

  .tour-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .tour-close {
    cursor: pointer;
    color: var(--el-text-color-secondary);
    transition: color 0.2s;

    &:hover {
      color: var(--el-text-color-primary);
    }
  }
}

.tour-content {
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.tour-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: var(--unified-border);

  .tour-progress {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .tour-actions {
    display: flex;
    gap: 8px;
  }
}

// 高亮样式（全局）- 单类，禁止高特异性 
:global(body .tour-highlight),
:global(html body .tour-highlight) {
  --tour-highlight-z-index: var(--z-max);
  --tour-highlight-outline: 3px solid var(--el-color-primary);

  position: relative;
  z-index: var(--tour-highlight-z-index);
  outline: var(--tour-highlight-outline);
  outline-offset: 2px;
  border-radius: var(--global-border-radius);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 暗色模式支持
html.dark {
  .tour-overlay {
    background-color: var(--color-black-70);
  }

  .tour-tooltip {
    background-color: var(--el-bg-color);
    }
}
</style>
