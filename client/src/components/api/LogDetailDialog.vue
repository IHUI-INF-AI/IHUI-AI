<template>
  <el-dialog
    v-model="visible"
    :title="t('apiService.logs.detail')"
    width="900px"
    :close-on-click-modal="false"
  >
    <template v-if="log">
      <el-tabs v-model="activeTab">
        <!-- 基本信息 -->
        <el-tab-pane :label="t('apiService.logs.basicInfo')" name="basic">
          <el-descriptions :column="2" border>
            <el-descriptions-item :label="t('apiService.logs.time')">
              {{ formatDateTime(log.requestTime) }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.status')">
              <el-tag :type="getStatusType(log.status)" size="small">
                {{ t(`apiService.logStatus.${log.status}`) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.model')">
              {{ log.modelName }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.endpoint')">
              {{ log.endpoint }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.method')">
              {{ log.method }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.protocol')">
              {{ log.protocol }}
            </el-descriptions-item>
            <el-descriptions-item v-if="log.appName" :label="t('apiService.logs.app')">
              {{ log.appName }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.latency')">
              {{ log.latency }}ms
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.tokens')">
              {{ formatNumber(log.totalTokens) }} ({{ t('apiService.logs.input') }}: {{ formatNumber(log.inputTokens) }}, {{ t('apiService.logs.output') }}: {{ formatNumber(log.outputTokens) }})
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.cost')">
              ¥{{ log.cost.toFixed(4) }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('apiService.logs.ip')">
              {{ log.ipAddress }}
            </el-descriptions-item>
            <el-descriptions-item v-if="log.userAgent" :label="t('apiService.logs.userAgent')">
              {{ log.userAgent }}
            </el-descriptions-item>
            <el-descriptions-item v-if="log.statusCode" :label="t('apiService.logs.statusCode')">
              {{ log.statusCode }}
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="log.errorMessage" class="error-section">
            <el-alert type="error" :closable="false" show-icon>
              <template #title>
                <strong>{{ t('apiService.logs.errorMessage') }}</strong>
              </template>
              <div>{{ log.errorMessage }}</div>
            </el-alert>
          </div>
        </el-tab-pane>

        <!-- 请求信息 -->
        <el-tab-pane :label="t('apiService.logs.request')" name="request">
          <div class="section-header">
            <h4>{{ t('apiService.logs.requestHeaders') }}</h4>
          </div>
          <el-table
            v-if="log.requestHeaders"
            :data="headersToArray(log.requestHeaders)"
            border
            size="small"
            max-height="200"
          >
            <el-table-column prop="key" :label="t('apiService.logs.headerKey')" width="200" />
            <el-table-column prop="value" :label="t('apiService.logs.headerValue')" show-overflow-tooltip />
          </el-table>
          <el-empty v-else :description="t('apiService.logs.noHeaders')" :image-size="60" />

          <div class="section-header">
            <h4>{{ t('apiService.logs.requestBody') }}</h4>
            <el-button
              link
              type="primary"
              size="small"
              :icon="CopyDocument"
              @click="handleCopyRequest"
            >
              {{ t('common.copy') }}
            </el-button>
          </div>
          <div class="code-block">
            <pre v-if="log.requestBody"><code>{{ formatJson(log.requestBody) }}</code></pre>
            <el-empty v-else :description="t('apiService.logs.noBody')" :image-size="60" />
          </div>
        </el-tab-pane>

        <!-- 响应信息 -->
        <el-tab-pane :label="t('apiService.logs.response')" name="response">
          <div class="section-header">
            <h4>{{ t('apiService.logs.responseHeaders') }}</h4>
          </div>
          <el-table
            v-if="log.responseHeaders"
            :data="headersToArray(log.responseHeaders)"
            border
            size="small"
            max-height="200"
          >
            <el-table-column prop="key" :label="t('apiService.logs.headerKey')" width="200" />
            <el-table-column prop="value" :label="t('apiService.logs.headerValue')" show-overflow-tooltip />
          </el-table>
          <el-empty v-else :description="t('apiService.logs.noHeaders')" :image-size="60" />

          <div class="section-header">
            <h4>{{ t('apiService.logs.responseBody') }}</h4>
            <el-button
              link
              type="primary"
              size="small"
              :icon="CopyDocument"
              @click="handleCopyResponse"
            >
              {{ t('common.copy') }}
            </el-button>
          </div>
          <div class="code-block">
            <pre v-if="log.responseBody"><code>{{ formatJson(log.responseBody) }}</code></pre>
            <el-empty v-else :description="t('apiService.logs.noBody')" :image-size="60" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import type { ApiCallLog } from '@/types/api-service'
import { formatDateTime, formatNumber } from '@/utils/format'

defineOptions({
  name: 'LogDetailDialog',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Props {
  modelValue: boolean
  log: ApiCallLog | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const activeTab = ref('basic')

const getStatusType = (status: string) => {
  const statusMap: Record<string, 'success' | 'warning' | 'danger'> = {
    success: 'success',
    error: 'danger',
    timeout: 'warning',
    rate_limited: 'warning',
  }
  return statusMap[status] || 'info'
}

const headersToArray = (headers: Record<string, string>) => {
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

const formatJson = (data: string | Record<string, unknown>) => {
  if (typeof data === 'string') {
    try {
      return JSON.stringify(JSON.parse(data), null, 2)
    } catch {
      return data
    }
  }
  return JSON.stringify(data, null, 2)
}

const handleCopyRequest = async () => {
  if (!props.log?.requestBody) return
  const text = typeof props.log.requestBody === 'string'
    ? props.log.requestBody
    : JSON.stringify(props.log.requestBody, null, 2)
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('common.copySuccess'))
  } catch {
    ElMessage.error(t('common.copyFailed'))
  }
}

const handleCopyResponse = async () => {
  if (!props.log?.responseBody) return
  const text = typeof props.log.responseBody === 'string'
    ? props.log.responseBody
    : JSON.stringify(props.log.responseBody, null, 2)
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('common.copySuccess'))
  } catch {
    ElMessage.error(t('common.copyFailed'))
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    activeTab.value = 'basic'
  }
})
</script>

<style scoped lang="scss">
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0 12px;

  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.error-section {
  margin-top: 20px;
}

.code-block {
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  padding: 16px;
  max-height: 500px;
  overflow: auto;

  pre {
    margin: 0;
    font-family: var(--font-family-mono);
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
    white-space: pre-wrap;
    word-break: break-all;

    code {
      font-family: inherit;
    }
  }
}
</style>
