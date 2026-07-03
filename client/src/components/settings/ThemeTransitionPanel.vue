<template>
  <div class="theme-transition-panel">
    <div class="panel-header">
      <h3>{{ t('themeTransition.title') }}</h3>
      <el-button size="small" @click="previewTransition" :loading="isPreviewing">
        {{ t('themeTransition.preview') }}
      </el-button>
    </div>

    <div class="preset-section">
      <div class="section-label">{{ t('themeTransition.presets') }}</div>
      <div class="preset-grid">
        <div
          v-for="preset in presets"
          :key="preset.id"
          class="preset-item"
          :class="{ active: currentPresetId === preset.id }"
          @click="applyPreset(preset.id)"
        >
          <div class="preset-icon">
            <el-icon><component :is="getPresetIcon(preset.config.type)" /></el-icon>
          </div>
          <span class="preset-name">{{ locale === 'zh-CN' ? preset.name : preset.nameEn }}</span>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="section-label">{{ t('themeTransition.customConfig') }}</div>
      
      <div class="config-item">
        <span class="config-label">{{ t('themeTransition.type') }}</span>
        <el-select v-model="config.type" size="small" @change="onConfigChange">
          <el-option :label="t('themeTransition.types.fade')" value="fade" />
          <el-option :label="t('themeTransition.types.slide')" value="slide" />
          <el-option :label="t('themeTransition.types.zoom')" value="zoom" />
          <el-option :label="t('themeTransition.types.flip')" value="flip" />
          <el-option :label="t('themeTransition.types.ripple')" value="ripple" />
          <el-option :label="t('themeTransition.types.none')" value="none" />
        </el-select>
      </div>

      <div class="config-item" v-if="config.type === 'slide'">
        <span class="config-label">{{ t('themeTransition.direction') }}</span>
        <el-select v-model="config.direction" size="small" @change="onConfigChange">
          <el-option :label="t('themeTransition.directions.left')" value="left" />
          <el-option :label="t('themeTransition.directions.right')" value="right" />
          <el-option :label="t('themeTransition.directions.up')" value="up" />
          <el-option :label="t('themeTransition.directions.down')" value="down" />
        </el-select>
      </div>

      <div class="config-item" v-if="config.type !== 'none'">
        <span class="config-label">{{ t('themeTransition.speed') }}</span>
        <el-select v-model="config.speed" size="small" @change="onConfigChange">
          <el-option :label="t('themeTransition.speeds.slow')" value="slow" />
          <el-option :label="t('themeTransition.speeds.normal')" value="normal" />
          <el-option :label="t('themeTransition.speeds.fast')" value="fast" />
          <el-option :label="t('themeTransition.speeds.instant')" value="instant" />
        </el-select>
      </div>

      <div class="config-item" v-if="config.type !== 'none'">
        <span class="config-label">{{ t('themeTransition.easing') }}</span>
        <el-select v-model="config.easing" size="small" @change="onConfigChange">
          <el-option label="ease" value="ease" />
          <el-option label="ease-in" value="easeIn" />
          <el-option label="ease-out" value="easeOut" />
          <el-option label="ease-in-out" value="easeInOut" />
          <el-option label="linear" value="linear" />
          <el-option :label="t('themeTransition.easings.bounce')" value="bounce" />
          <el-option :label="t('themeTransition.easings.smooth')" value="smooth" />
          <el-option :label="t('themeTransition.easings.swift')" value="swift" />
        </el-select>
      </div>

      <div class="config-item" v-if="config.type !== 'none'">
        <span class="config-label">{{ t('themeTransition.enableOverlay') }}</span>
        <el-switch v-model="config.enableOverlay" @change="onConfigChange" />
      </div>

      <div class="config-item" v-if="config.enableOverlay && config.type !== 'none'">
        <span class="config-label">{{ t('themeTransition.overlayColor') }}</span>
        <el-color-picker v-model="config.overlayColor" size="small" @change="onConfigChange" />
      </div>
    </div>

    <div class="duration-info" v-if="config.type !== 'none'">
      <span>{{ t('themeTransition.duration') }}: {{ actualDuration }}ms</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { 
  themeTransitionManager, 
  type ThemeTransitionConfig, 
  type ThemeTransitionPreset,
  type ThemeTransitionType 
} from '@/utils/themeTransition'
import { 
  Sunny, 
  Promotion, 
  ZoomIn, 
  Refresh, 
  Coin, 
  Close 
} from '@element-plus/icons-vue'

const { t, locale } = useI18n()

const presets = ref<ThemeTransitionPreset[]>([])
const currentPresetId = ref<string>('')
const isPreviewing = ref(false)

const config = reactive<ThemeTransitionConfig>({
  type: 'fade',
  direction: 'center',
  speed: 'normal',
  duration: 300,
  easing: 'smooth',
  enableOverlay: false,
  overlayColor: 'var(--color-black-30)'
})

const actualDuration = computed(() => {
  return themeTransitionManager.getDuration()
})

onMounted(() => {
  loadPresets()
  loadConfig()
})

function loadPresets(): void {
  presets.value = themeTransitionManager.getPresets()
}

function loadConfig(): void {
  const savedConfig = themeTransitionManager.getConfig()
  Object.assign(config, savedConfig)
  
  const matchedPreset = presets.value.find(
    p => JSON.stringify(p.config) === JSON.stringify(savedConfig)
  )
  if (matchedPreset) {
    currentPresetId.value = matchedPreset.id
  }
}

function applyPreset(presetId: string): void {
  const success = themeTransitionManager.setPreset(presetId)
  if (success) {
    currentPresetId.value = presetId
    loadConfig()
    ElMessage.success(t('themeTransition.presetApplied'))
  }
}

function onConfigChange(): void {
  themeTransitionManager.setConfig({ ...config })
  currentPresetId.value = ''
}

async function previewTransition(): Promise<void> {
  isPreviewing.value = true
  try {
    await themeTransitionManager.executeTransition(() => {
      document.documentElement.classList.toggle('preview-transition')
    })
    ElMessage.success(t('themeTransition.previewComplete'))
  } finally {
    isPreviewing.value = false
  }
}

function getPresetIcon(type: ThemeTransitionType) {
  const icons: Record<ThemeTransitionType, typeof Sunny> = {
    fade: Sunny,
    slide: Promotion,
    zoom: ZoomIn,
    flip: Refresh,
    ripple: Coin,
    none: Close
  }
  return icons[type] || Sunny
}
</script>

<style lang="scss" scoped>
.theme-transition-panel {
  padding: var(--spacing-md);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);

  h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    color: var(--el-text-color-primary);
  }
}

.section-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--el-text-color-secondary);
  margin-bottom: var(--spacing-sm);
}

.preset-section {
  margin-bottom: var(--spacing-lg);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.preset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-unified-color-hover);
  }

  &.active {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.preset-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius-sm);
  margin-bottom: var(--spacing-xs);
  color: var(--el-text-color-regular);
}

.preset-name {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-regular);
}

.config-section {
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;

  &:not(:last-child) {
    border-bottom: var(--unified-border-bottom);
  }
}

.config-label {
  font-size: var(--font-size-sm);
  color: var(--el-text-color-regular);
}

.duration-info {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}
</style>
