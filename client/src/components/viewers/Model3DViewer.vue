<template>
  <div class="model-viewer-3d">
    <div class="viewer-toolbar">
      <div class="toolbar-left">
        <span class="file-icon">🎮</span>
        <span class="file-name">{{ title || t('model3DViewer.model3d') }}</span>
        <span class="file-type">{{ modelType }}</span>
      </div>
      <div class="toolbar-right">
        <a :href="src" download class="tool-btn" :title="t('viewerImageViewer.download')">{{ t('model3DViewer.download') }}</a>
      </div>
    </div>
    
    <div class="viewer-main">
      <div class="model-placeholder">
        <div class="placeholder-content">
          <div class="model-icon">🎮</div>
          <div class="model-title">{{ title }}</div>
          <div class="model-message">{{ t('viewerModel3DViewer.model3dFile') }}</div>
          <div class="model-info">
            <div class="info-item">
              <span class="info-label">{{ t('viewerModel3DViewer.format') }}</span>
              <span class="info-value">{{ modelType }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('viewerModel3DViewer.supportedFormat') }}</span>
              <span class="info-value">GLTF, GLB, OBJ, STL, FBX</span>
            </div>
          </div>
          <a :href="src" download class="download-btn">{{ t('model3DViewer.downloadView') }}</a>
          <div class="model-hint">{{ t('viewerModel3DViewer.useBlenderHint') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  src: string
  title?: string
}>()

const _emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error', error: Error): void
}>()

const modelType = computed(() => {
  const ext = props.src.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    gltf: 'GLTF',
    glb: 'GLB',
    obj: 'OBJ',
    stl: 'STL',
    fbx: 'FBX'
  }
  return types[ext || ''] || '3D模型'
})
</script>

<style scoped>
.model-viewer-3d {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-dark-1a1a2e);
}

.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 20px;
}

.file-name {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
}

.file-type {
  padding: 2px 8px;
  background: var(--el-border-color);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  color: var(--el-color-primary-light-3);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: none;
  background: transparent;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  transition: background-color 0.2s;
  text-decoration: none;
}

.tool-btn:hover {
  background: var(--el-border-color);
}

.viewer-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-placeholder {
  text-align: center;
  padding: 40px;
}

.placeholder-content {
  max-width: 400px;
}

.model-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.model-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--el-text-color-placeholder);
  margin-bottom: 8px;
}

.model-message {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 24px;
}

.model-info {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
}

.download-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: var(--color-brand-blue-2);
  color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  text-decoration: none;
  font-size: 16px;
  transition: background 0.2s;
}

.download-btn:hover {
  background: var(--el-color-primary);
}

.model-hint {
  margin-top: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
