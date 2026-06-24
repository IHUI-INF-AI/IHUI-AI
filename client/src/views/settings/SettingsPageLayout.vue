<template>
  <div class="settings-layout">
    <header class="settings-layout__header">
      <div class="settings-layout__inner settings-layout__header-inner">
        <el-button link class="settings-layout__back" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          <span class="settings-layout__back-text">返回</span>
        </el-button>
        <h1 class="settings-layout__title">{{ title }}</h1>
      </div>
    </header>
    <main class="settings-layout__main">
      <div class="settings-layout__inner">
        <slot></slot>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@/lib/lucide-fallback'

const props = defineProps<{
  title?: string
}>()

const router = useRouter()

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

onMounted(() => {
  if (props.title) {
    document.title = `${props.title} - 智汇AI`
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

.settings-layout {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
}

.settings-layout__inner {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 16px;
  box-sizing: border-box;

  @include bp.min-width('tablet') {
    padding: 0 24px;
  }
}

.settings-layout__header {
  background-color: var(--el-bg-color);
  border-bottom: var(--unified-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.settings-layout__header-inner {
  display: flex;
  align-items: center;
  height: 56px;
  gap: 12px;

  @include bp.min-width('tablet') {
    height: 64px;
  }
}

.settings-layout__back {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;

  &:hover {
    color: var(--el-text-color-primary);
  }
}

.settings-layout__back-text {
  margin-left: 4px;
}

.settings-layout__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @include bp.min-width('tablet') {
    font-size: 18px;
  }
}

.settings-layout__main {
  padding: 16px 0 32px;

  @include bp.min-width('tablet') {
    padding: 24px 0 48px;
  }
}
</style>
