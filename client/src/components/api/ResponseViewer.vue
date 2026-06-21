<template>
  <div class="response-viewer">
    <div class="response-header">
      <div class="response-status">
        <el-tag :type="statusType" size="large">
          {{ response.status || '-' }}
        </el-tag>
        <span v-if="response.time" class="response-time">
          {{ t('apiService.debug.responseTime') }}: {{ response.time }}ms
        </span>
      </div>
      <div class="response-actions">
        <el-button link size="small" @click="copyResponse">
          {{ t('common.copy') }}
        </el-button>
        <el-button link size="small" @click="formatResponse">
          {{ t('apiService.debug.format') }}
        </el-button>
      </div>
    </div>

    <div class="response-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="t('apiService.debug.responseBody')" name="body">
          <div class="code-viewer">
            <pre><code>{{ formattedResponse }}</code></pre>
          </div>
        </el-tab-pane>
        <el-tab-pane :label="t('apiService.debug.responseHeaders')" name="headers">
          <el-descriptions :column="1" border>
            <el-descriptions-item
              v-for="(value, key) in response.headers"
              :key="key"
              :label="key"
            >
              {{ value }}
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

defineOptions({
  name: 'ResponseViewer',
  inheritAttrs: false,
})

const { t } = useI18n()

interface ResponseData {
  status?: number
  headers?: Record<string, string>
  body?: string
  time?: number
}

const props = defineProps<{
  response: ResponseData
}>()

const activeTab = ref('body')

const statusType = computed(() => {
  if (!props.response.status) return 'info'
  if (props.response.status >= 200 && props.response.status < 300) return 'success'
  if (props.response.status >= 400 && props.response.status < 500) return 'warning'
  if (props.response.status >= 500) return 'danger'
  return 'info'
})

const formattedResponse = computed(() => {
  if (!props.response.body) return ''
  try {
    const parsed = JSON.parse(props.response.body)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return props.response.body
  }
})

const copyResponse = async () => {
  try {
    await navigator.clipboard.writeText(props.response.body || '')
    ElMessage.success(t('common.copySuccess'))
  } catch {
    ElMessage.error(t('common.copyFailed'))
  }
}

const formatResponse = () => {
  // 格式化已在computed中处理
}
</script>

<style scoped lang="scss">
.response-viewer {
  .response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: var(--unified-border-bottom);

    .response-status {
      display: flex;
      align-items: center;
      gap: 12px;

      .response-time {
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
    }

    .response-actions {
      display: flex;
      gap: 8px;
    }
  }

  .response-content {
    .code-viewer {
      background: var(--color-gray-1e1e1e);
      border-radius: var(--global-border-radius);
      padding: 16px;
      overflow: auto;
      max-height: 500px;

      pre {
        margin: 0;

        code {
          font-family: var(--font-family-mono);
          font-size: 13px;
          line-height: 1.6;
          color: var(--color-neutral-300);
        }
      }
    }
  }
}
</style>
