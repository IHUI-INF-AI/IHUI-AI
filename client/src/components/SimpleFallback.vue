<template>
  <div class="simple-fallback">
    <div class="fallback-content">
      <div class="error-icon">⚠️</div>
      <h2>{{ t('simpleFallback.loading') }}</h2>
      <p v-if="displayMessage">{{ displayMessage }}</p>
      <div class="actions">
        <button @click="handleReload" class="btn-primary">{{ t('simpleFallback.reload') }}</button>
        <button @click="handleGoHome" class="btn-secondary">
          {{ t('simpleFallback.goHome') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: undefined,
})

const displayMessage = computed(() => props.message || t('simpleFallback.defaultMessage'))

const handleReload = () => {
  window.location.reload()
}

const handleGoHome = () => {
  window.location.href = '/'
}
</script>

<style scoped>
/* 组件 CSS 变量定义 */
.simple-fallback {
  --sf-scrollbar-width: none;
  --sf-scrollbar-display: none;
  --sf-scrollbar-size: 0;
  
  width: 100%;
  max-width: 100%;
  min-width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  padding: 40px;
  margin: 0;
  box-sizing: border-box;
  position: relative;
  left: 0;
  right: 0;
  overflow: hidden;
  scrollbar-width: var(--sf-scrollbar-width);
  -ms-overflow-style: var(--sf-scrollbar-width);
}

/* 使用单类与变量，使用 CSS 变量与低特异性 */
.simple-fallback::-webkit-scrollbar {
  display: var(--sf-scrollbar-display);
  width: var(--sf-scrollbar-size);
  height: var(--sf-scrollbar-size);
}

.fallback-content {
  text-align: center;
  max-width: 500px;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

h2 {
  margin: 0 0 12px;
  font-size: 24px;
  color: var(--el-text-color-primary);
}

p {
  margin: 0 0 24px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;
}

button:hover {
  opacity: 0.8;
}

.btn-primary {
  background: var(--el-color-primary);
  color: var(--el-color-white);
}

.btn-secondary {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  border: none;
}
</style>
