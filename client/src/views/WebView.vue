<template>
  <div class="webview-page">
    <iframe
      v-if="url"
      :src="url"
      class="webview-iframe"
      frameborder="0"
      allowfullscreen
      @load="handleLoad"
    />
    <div v-else class="error-container">
      <el-empty :description="t('webView.noUrlProvided')" />
      <el-button type="primary" @click="goBack">{{ t('webView.back') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const url = ref('')

// 处理iframe加载
const handleLoad = () => {
  logger.debug('[WebView] iframe loaded')
}

// 返回
const goBack = () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    router.push('/')
  }
}

// 页面加载
onMounted(() => {
  // 从路由参数获取URL
  const urlParam = route.query.url as string
  if (urlParam) {
    try {
      // 解码URL
      url.value = decodeURIComponent(urlParam)
      logger.debug('[WebView] Loading URL:', url.value)
    } catch (error) {
      logger.error('[WebView] URL decode failed:', error)
    }
  } else {
    logger.warn('[WebView] URL parameter not provided')
  }
})
</script>

<style scoped lang="scss">
.webview-page {
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background-color: var(--el-bg-color);
}

.webview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 20px;
}
</style>
