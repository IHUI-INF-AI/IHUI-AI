<template>
  <div class="api-platform-debug-page" v-loading="loading">
    <h2 class="page-title">{{ t('apiMgmt.debug.title', 'API 调试器 (接入 ApiMethodSearch + RequestBuilder + ResponseViewer)') }}</h2>
    <p class="page-subtitle">{{ t('apiMgmt.debug.subtitle', '搜索 API 方法、构造请求、查看响应。Swagger 风格的 API 调试控制台') }}</p>

    <el-tabs v-model="activeTab" class="debug-tabs">
      <el-tab-pane :label="t('apiMgmt.debug.tab.search', '方法搜索')" name="search">
        <ApiMethodSearch />
      </el-tab-pane>
      <el-tab-pane :label="t('apiMgmt.debug.tab.builder', '请求构建')" name="builder">
        <RequestBuilder
          v-if="activeTab === 'builder'"
          :method="defaultMethod"
          :endpoint="defaultEndpoint"
        />
      </el-tab-pane>
      <el-tab-pane :label="t('apiMgmt.debug.tab.response', '响应查看')" name="response">
        <ResponseViewer
          v-if="activeTab === 'response'"
          :response="demoResponse"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ApiMethodSearch from '@/components/api/ApiMethodSearch.vue'
import RequestBuilder from '@/components/api/RequestBuilder.vue'
import ResponseViewer from '@/components/api/ResponseViewer.vue'

defineOptions({ name: 'AdminApiDebug' })

const { t } = useI18n()
const activeTab = ref('search')
const loading = ref(false)

const defaultMethod = ref('POST')
const defaultEndpoint = ref('/v1/chat/completions')

const demoResponse = {
  status: 200,
  statusText: 'OK',
  data: {
    id: 'chatcmpl-demo',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello! This is a demo response from the API debug viewer.' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
  },
  headers: { 'content-type': 'application/json' },
}

onMounted(() => {
  loading.value = false
})
</script>

<style scoped lang="scss">
.api-platform-debug-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}

.debug-tabs {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 16px;
}
</style>
