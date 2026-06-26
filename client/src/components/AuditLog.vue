<template>
  <div class="audit-log">
    <div class="audit-header">
      <h2>{{ $t('audit.title') }}</h2>
      <div class="header-actions">
        <el-button @click="refreshLogs">
          <el-icon><Refresh /></el-icon>
          {{ $t('common.refresh') }}
        </el-button>
      </div>
    </div>

    <div class="audit-stats">
      <el-card class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">{{ $t('audit.totalLogs') }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value success">{{ stats.by_status?.success || 0 }}</div>
        <div class="stat-label">{{ $t('audit.success') }}</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value error">{{ stats.by_status?.failed || 0 }}</div>
        <div class="stat-label">{{ $t('audit.failed') }}</div>
      </el-card>
    </div>

    <div class="audit-toolbar">
      <el-input
        v-model="filters.user_id"
        :placeholder="$t('audit.userId')"
        clearable
        class="filter-input"
      />
      <el-select v-model="filters.action" :placeholder="$t('audit.actionType')" clearable>
        <el-option :label="$t('audit.actionTypeOption.fileUpload')" value="file_upload" />
        <el-option :label="$t('audit.actionTypeOption.fileDownload')" value="file_download" />
        <el-option :label="$t('audit.actionTypeOption.fileDelete')" value="file_delete" />
        <el-option :label="$t('audit.actionTypeOption.fileShare')" value="file_share" />
        <el-option :label="$t('audit.actionTypeOption.versionCreate')" value="version_create" />
        <el-option :label="$t('audit.actionTypeOption.versionRollback')" value="version_rollback" />
        <el-option :label="$t('audit.actionTypeOption.permissionAssign')" value="permission_assign" />
        <el-option :label="$t('audit.actionTypeOption.userLogin')" value="user_login" />
      </el-select>
      <el-select v-model="filters.status" :placeholder="$t('audit.status')" clearable>
        <el-option :label="$t('audit.success')" value="success" />
        <el-option :label="$t('audit.failed')" value="failed" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        :range-separator="$t('common.to')"
        :start-placeholder="$t('audit.startDate')"
        :end-placeholder="$t('audit.endDate')"
        value-format="YYYY-MM-DD"
      />
      <el-button type="primary" @click="searchLogs">
        {{ $t('common.search') }}
      </el-button>
    </div>

    <el-table :data="logs" style="width: 100%" v-loading="loading">
      <el-table-column prop="created_at" :label="$t('audit.time')" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column prop="user_id" :label="$t('audit.userId')" width="120" />
      <el-table-column prop="action" :label="$t('audit.action')" width="120">
        <template #default="{ row }">
          <el-tag :type="getActionType(row.action)">{{ getActionLabel(row.action) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="resource_type" :label="$t('audit.resourceType')" width="100" />
      <el-table-column prop="resource_id" :label="$t('audit.resourceId')" width="150">
        <template #default="{ row }">
          <span class="resource-id">{{ row.resource_id || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="details" :label="$t('audit.details')">
        <template #default="{ row }">
          <el-tooltip v-if="row.details" :content="row.details" placement="top">
            <span class="details-text">{{ row.details }}</span>
          </el-tooltip>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="ip_address" :label="$t('audit.ip')" width="130" />
      <el-table-column prop="status" :label="$t('audit.status')" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
            {{ row.status === 'success' ? $t('audit.success') : $t('audit.failed') }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="stats.total || 0"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { request } from '@/utils/request'
import { logger } from '@/utils/logger'

const { t } = useI18n()

interface AuditLog {
  id: number
  user_id: string
  action: string
  resource_type: string
  resource_id: string
  details: string
  ip_address: string
  status: string
  created_at: string
}

interface AuditStats {
  total: number
  by_action: Record<string, number>
  by_status: Record<string, number>
}

const loading = ref(false)
const logs = ref<AuditLog[]>([])
const stats = ref<AuditStats>({ total: 0, by_action: {}, by_status: {} })
const page = ref(1)
const pageSize = ref(20)

const filters = ref({
  user_id: '',
  action: '',
  status: ''
})
const dateRange = ref<string[]>([])

function formatDateTime(date: string): string {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

function getActionType(action: string): string {
  const typeMap: Record<string, string> = {
    'file_upload': 'success',
    'file_download': 'primary',
    'file_delete': 'danger',
    'file_share': 'warning',
    'version_create': 'success',
    'version_rollback': 'warning',
    'permission_assign': 'info',
    'user_login': ''
  }
  return typeMap[action] || ''
}

function getActionLabel(action: string): string {
  const labelMap: Record<string, string> = {
    'file_upload': t('audit.actionLabel.fileUpload'),
    'file_download': t('audit.actionLabel.fileDownload'),
    'file_delete': t('audit.actionLabel.fileDelete'),
    'file_share': t('audit.actionLabel.fileShare'),
    'version_create': t('audit.actionLabel.versionCreate'),
    'version_rollback': t('audit.actionLabel.versionRollback'),
    'permission_assign': t('audit.actionLabel.permissionAssign'),
    'user_login': t('audit.actionLabel.userLogin')
  }
  return labelMap[action] || action
}

async function loadLogs() {
  loading.value = true
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      page_size: pageSize.value
    }
    
    if (filters.value.user_id) params.user_id = filters.value.user_id
    if (filters.value.action) params.action = filters.value.action
    if (filters.value.status) params.status = filters.value.status
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    
    const response = await request.get('/api/audit/logs', { params })
    logs.value = response.data.logs || []
  } catch {
    ElMessage.error(t('cmpAuditLog.loadLogFailed'))
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const params: Record<string, string> = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    
    const response = await request.get('/api/audit/stats', { params })
    stats.value = response.data
  } catch {
    logger.error('Failed to load statistics')
  }
}

async function refreshLogs() {
  await Promise.all([loadLogs(), loadStats()])
}

function searchLogs() {
  page.value = 1
  refreshLogs()
}

function handlePageChange(newPage: number) {
  page.value = newPage
  loadLogs()
}

onMounted(() => {
  refreshLogs()
})
</script>

<style scoped>
.audit-log {
  padding: 20px;
}

.audit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.audit-header h2 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.audit-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
}

.stat-value.success {
  color: var(--el-color-success);
}

.stat-value.error {
  color: var(--el-color-danger);
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-top: 4px;
}

.audit-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-input {
  width: 150px;
}

.resource-id {
  font-family: var(--font-family-mono);
  font-size: 12px;
}

.details-text {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
