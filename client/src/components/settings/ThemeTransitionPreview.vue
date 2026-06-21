<template>
  <div class="theme-transition-preview">
    <div class="preview-header">
      <span class="preview-title">{{ t('themeTransition.previewTitle') }}</span>
      <el-select v-model="selectedPresetId" size="small" @change="handlePresetChange">
        <el-option
          v-for="preset in presets"
          :key="preset.id"
          :label="locale === 'zh-CN' ? preset.name : preset.nameEn"
          :value="preset.id"
        />
      </el-select>
    </div>

    <div class="preview-container" ref="previewContainer">
      <div class="preview-demo" :class="demoTheme">
        <div class="demo-header"></div>
        <div class="demo-content">
          <div class="demo-sidebar"></div>
          <div class="demo-main">
            <div class="demo-card"></div>
            <div class="demo-card"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="preview-controls">
      <el-button type="primary" size="small" @click="playDemo" :disabled="isPlaying">
        {{ isPlaying ? t('themeTransition.playing') : t('themeTransition.playDemo') }}
      </el-button>
    </div>

    <div class="transition-config">
      <div class="config-row">
        <span class="config-label">{{ t('themeTransition.type') }}</span>
        <el-select v-model="config.type" size="small" @change="updateConfig">
          <el-option :label="t('themeTransition.types.fade')" value="fade" />
          <el-option :label="t('themeTransition.types.slide')" value="slide" />
          <el-option :label="t('themeTransition.types.zoom')" value="zoom" />
          <el-option :label="t('themeTransition.types.flip')" value="flip" />
          <el-option :label="t('themeTransition.types.ripple')" value="ripple" />
          <el-option :label="t('themeTransition.types.none')" value="none" />
        </el-select>
      </div>

      <div class="config-row" v-if="config.type === 'slide'">
        <span class="config-label">{{ t('themeTransition.direction') }}</span>
        <el-select v-model="config.direction" size="small" @change="updateConfig">
          <el-option :label="t('themeTransition.directions.left')" value="left" />
          <el-option :label="t('themeTransition.directions.right')" value="right" />
          <el-option :label="t('themeTransition.directions.up')" value="up" />
          <el-option :label="t('themeTransition.directions.down')" value="down" />
        </el-select>
      </div>

      <div class="config-row">
        <span class="config-label">{{ t('themeTransition.speed') }}</span>
        <el-select v-model="config.speed" size="small" @change="updateConfig">
          <el-option :label="t('themeTransition.speeds.slow')" value="slow" />
          <el-option :label="t('themeTransition.speeds.normal')" value="normal" />
          <el-option :label="t('themeTransition.speeds.fast')" value="fast" />
          <el-option :label="t('themeTransition.speeds.instant')" value="instant" />
        </el-select>
      </div>

      <div class="config-row">
        <span class="config-label">{{ t('themeTransition.easing') }}</span>
        <el-select v-model="config.easing" size="small" @change="updateConfig">
          <el-option label="smooth" value="smooth" />
          <el-option label="ease" value="ease" />
          <el-option label="easeIn" value="easeIn" />
          <el-option label="easeOut" value="easeOut" />
          <el-option label="bounce" value="bounce" />
          <el-option label="linear" value="linear" />
        </el-select>
      </div>

      <div class="config-row">
        <span class="config-label">{{ t('themeTransition.enableOverlay') }}</span>
        <el-switch v-model="config.enableOverlay" @change="updateConfig" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  themeTransitionManager,
  type ThemeTransitionConfig,
  type ThemeTransitionPreset
} from '@/utils/themeTransition'

const { t, locale } = useI18n()

const presets = ref<ThemeTransitionPreset[]>([])
const selectedPresetId = ref<string>('')
const isPlaying = ref(false)
const demoTheme = ref<'light' | 'dark'>('light')
const previewContainer = ref<HTMLElement | null>(null)

const config = reactive<ThemeTransitionConfig>({
  type: 'fade',
  direction: 'center',
  speed: 'normal',
  duration: 300,
  easing: 'smooth',
  enableOverlay: false
})

onMounted(() => {
  presets.value = themeTransitionManager.getPresets()
  const currentConfig = themeTransitionManager.getConfig()
  Object.assign(config, currentConfig)
})

function handlePresetChange(presetId: string): void {
  themeTransitionManager.setPreset(presetId)
  const newConfig = themeTransitionManager.getConfig()
  Object.assign(config, newConfig)
}

function updateConfig(): void {
  themeTransitionManager.setConfig(config)
}

async function playDemo(): Promise<void> {
  if (isPlaying.value) return

  isPlaying.value = true

  const container = previewContainer.value
  if (!container) {
    isPlaying.value = false
    return
  }

  const duration = themeTransitionManager.getDuration()
  const easing = themeTransitionManager.getEasing()

  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: calc(var(--z-base) + 9);
    pointer-events: none;
    opacity: 0;
    border-radius: inherit;
    overflow: hidden;
  `
  container.appendChild(overlay)

  await new Promise(resolve => setTimeout(resolve, 50))

  switch (config.type) {
    case 'fade':
      await playFadeDemo(overlay, duration, easing)
      break
    case 'slide':
      await playSlideDemo(overlay, duration, easing)
      break
    case 'zoom':
      await playZoomDemo(overlay, duration, easing)
      break
    case 'flip':
      await playFlipDemo(overlay, duration, easing)
      break
    case 'ripple':
      await playRippleDemo(overlay, duration, easing)
      break
    case 'none':
      break
  }

  demoTheme.value = demoTheme.value === 'light' ? 'dark' : 'light'

  container.removeChild(overlay)
  isPlaying.value = false
}

async function playFadeDemo(overlay: HTMLDivElement, duration: number, easing: string): Promise<void> {
  overlay.style.background = 'var(--color-black-30)'
  overlay.style.transition = `opacity ${duration}ms ${easing}`

  await new Promise(resolve => requestAnimationFrame(resolve))
  overlay.style.opacity = '1'

  await new Promise(resolve => setTimeout(resolve, duration))
  overlay.style.opacity = '0'

  await new Promise(resolve => setTimeout(resolve, duration))
}

async function playSlideDemo(overlay: HTMLDivElement, duration: number, easing: string): Promise<void> {
  const transforms: Record<string, string> = {
    left: 'translateX(-100%)',
    right: 'translateX(100%)',
    up: 'translateY(-100%)',
    down: 'translateY(100%)',
    center: 'scale(0.95)'
  }

  overlay.style.background = 'var(--color-black-50)'
  overlay.style.transform = transforms[config.direction]
  overlay.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`

  await new Promise(resolve => requestAnimationFrame(resolve))
  overlay.style.opacity = '1'
  overlay.style.transform = 'translateX(0) translateY(0) scale(1)'

  await new Promise(resolve => setTimeout(resolve, duration))
  overlay.style.opacity = '0'
  overlay.style.transform = transforms[config.direction]

  await new Promise(resolve => setTimeout(resolve, duration))
}

async function playZoomDemo(overlay: HTMLDivElement, duration: number, easing: string): Promise<void> {
  overlay.style.background = 'var(--color-black-50)'
  overlay.style.transform = 'scale(0)'
  overlay.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`

  await new Promise(resolve => requestAnimationFrame(resolve))
  overlay.style.opacity = '1'
  overlay.style.transform = 'scale(1)'

  await new Promise(resolve => setTimeout(resolve, duration))
  overlay.style.opacity = '0'
  overlay.style.transform = 'scale(1.5)'

  await new Promise(resolve => setTimeout(resolve, duration))
}

async function playFlipDemo(overlay: HTMLDivElement, duration: number, easing: string): Promise<void> {
  overlay.style.background = 'var(--color-black-30)'
  overlay.style.transform = 'perspective(500px) rotateY(90deg)'
  overlay.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`

  await new Promise(resolve => requestAnimationFrame(resolve))
  overlay.style.opacity = '1'
  overlay.style.transform = 'perspective(500px) rotateY(0deg)'

  await new Promise(resolve => setTimeout(resolve, duration))
  overlay.style.opacity = '0'
  overlay.style.transform = 'perspective(500px) rotateY(-90deg)'

  await new Promise(resolve => setTimeout(resolve, duration))
}

async function playRippleDemo(overlay: HTMLDivElement, duration: number, easing: string): Promise<void> {
  overlay.style.background = 'radial-gradient(circle at center, color-mix(in srgb, var(--el-color-primary) 30%, transparent) 0%, transparent 70%)'
  overlay.style.transform = 'scale(0)'
  overlay.style.opacity = '1'
  overlay.style.transition = `transform ${duration}ms ${easing}`

  await new Promise(resolve => requestAnimationFrame(resolve))
  overlay.style.transform = 'scale(3)'

  await new Promise(resolve => setTimeout(resolve, duration * 0.7))
  overlay.style.opacity = '0'

  await new Promise(resolve => setTimeout(resolve, duration / 2))
}
</script>

<style lang="scss" scoped>
.theme-transition-preview {
  padding: var(--spacing-md);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.preview-title {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.preview-container {
  position: relative;
  width: 100%;
  height: 200px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  margin-bottom: var(--spacing-md);
  border: var(--unified-border);
}

.preview-demo {
  width: 100%;
  height: 100%;
  transition: background-color 0.3s ease;

  &.light {
    background-color: var(--color-neutral-100);

    .demo-header {
      background-color: var(--el-bg-color);
      border-bottom: var(--unified-border-bottom);
    }

    .demo-sidebar {
      background-color: var(--el-bg-color);
      border-right: var(--unified-border);
    }

    .demo-card {
      background-color: var(--el-bg-color);
      border: var(--unified-border);
    }
  }

  &.dark {
    background-color: var(--color-dark-bg-3);

    .demo-header {
      background-color: var(--color-dark-bg-5);
      border-bottom: var(--unified-border-bottom);
    }

    .demo-sidebar {
      background-color: var(--color-dark-bg-5);
      border-right: var(--unified-border);
    }

    .demo-card {
      background-color: var(--color-dark-bg-5);
      border: var(--unified-border);
    }
  }
}

.demo-header {
  height: 40px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.demo-content {
  display: flex;
  height: calc(100% - 40px);
}

.demo-sidebar {
  width: 60px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.demo-main {
  flex: 1;
  padding: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-sm);
}

.demo-card {
  flex: 1;
  border-radius: var(--global-border-radius-sm);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.preview-controls {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-md);
}

.transition-config {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-label {
  font-size: var(--font-size-sm);
  color: var(--el-text-color-regular);
}
</style>
