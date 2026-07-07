<template>
  <div class="api-call-logs-page" v-loading="loading">
    <h2 class="page-title">{{ t('apiService.logs.title', 'API 调用日志') }}</h2>
    <p class="page-subtitle">{{ t('apiService.logs.subtitle', '查看 API 调用记录与详情') }}</p>

    <div v-if="error" class="error-banner">
      <el-alert :title="error" type="error" :closable="false" show-icon />
    </div>

    <el-table
      v-else
      :data="logs"
      border
      stripe
      class="logs-table"
      @row-click="openLog"
    >
      <el-table-column :label="t('apiService.logs.time')" width="180">
        <template #default="{ row }">{{ formatDateTime(row.requestTime) }}</template>
      </el-table-column>
      <el-table-column prop="modelName" :label="t('apiService.logs.model')" min-width="140" />
      <el-table-column prop="endpoint" :label="t('apiService.logs.endpoint')" min-width="200" show-overflow-tooltip />
      <el-table-column prop="method" :label="t('apiService.logs.method')" width="90" />
      <el-table-column :label="t('apiService.logs.status')" width="110">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ t(`apiService.logStatus.${row.status}`) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('apiService.logs.latency')" width="110">
        <template #default="{ row }">{{ row.latency }}ms</template>
      </el-table-column>
      <el-table-column :label="t('apiService.logs.tokens')" width="120">
        <template #default="{ row }">{{ formatNumber(row.totalTokens) }}</template>
      </el-table-column>
      <el-table-column :label="t('common.action', '操作')" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="openLog(row)">
            {{ t('common.view') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="logs.length === 0 && !loading && !error" class="empty-state">
      <NativeEmpty :description="t('apiService.logs.empty', '暂无调用日志')" />
    </div>

    <LogDetailDialog
      :model-value="dialogVisible"
      :log="selectedLog"
      @update:model-value="dialogVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getApiCallLogs } from '@/api/api-service'
import type { ApiCallLog } from '@/types/api-service'
import { formatDateTime, formatNumber } from '@/utils/format'
import LogDetailDialog from '@/components/api/LogDetailDialog.vue'

defineOptions({ name: 'AdminApiLogs' })

const { t } = useI18n()

const logs = ref<ApiCallLog[]>([])
const loading = ref(false)
const error = ref('')
const dialogVisible = ref(false)
const selectedLog = ref<ApiCallLog | null>(null)

const loadLogs = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getApiCallLogs({ page: 1, pageSize: 20 })
    if (res.success && res.data) {
      logs.value = res.data.list || []
    } else {
      error.value = res.message || t('apiService.logs.loadFailed', '加载日志失败')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

const getStatusType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    success: 'success',
    error: 'danger',
    timeout: 'warning',
    rate_limited: 'warning',
  }
  return map[status] || 'info'
}

const openLog = (row: ApiCallLog) => {
  selectedLog.value = row
  dialogVisible.value = true
}

onMounted(loadLogs)
</script>

<style scoped lang="scss">
.api-call-logs-page {
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

.logs-table {
  cursor: pointer;
}

.error-banner {
  margin-bottom: 16px;
}

.empty-state {
  padding: 60px 0;
}
</style>
