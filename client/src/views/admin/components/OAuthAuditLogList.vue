<template>
  <AdminListPage
    title="OAuth 审计日志"
    description="审计追溯所有 OAuth 敏感操作 (Round 27-C 新增, Round 29-C 增加 CSV 导出)"
    :columns="columns"
    :data="logs"
    :total="total"
    :loading="loading"
    :show-add="false"
    :show-selection="false"
    @refresh="fetchLogs"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #header-actions>
      <el-button
        type="success"
        :loading="exporting"
        :disabled="exporting"
        @click="handleExport"
      >
        <el-icon><Download /></el-icon>
        导出 CSV
      </el-button>
    </template>
    <template #filters>
      <el-form-item label="事件">
        <el-select
          v-model="filterEvent"
          placeholder="全部事件"
          clearable
          style="width: 180px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="ev in OAUTH_AUDIT_EVENTS"
            :key="ev.value"
            :label="ev.label"
            :value="ev.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="filterStatus"
          placeholder="全部状态"
          clearable
          style="width: 120px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="st in OAUTH_AUDIT_STATUSES"
            :key="st.value"
            :label="st.label"
            :value="st.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Client ID">
        <el-input
          v-model="filterClientId"
          placeholder="按 client_id 筛选"
          clearable
          style="width: 220px"
          @keyup.enter="handleFilterChange"
          @clear="handleFilterChange"
        />
      </el-form-item>
      <el-form-item label="User UUID">
        <el-input
          v-model="filterUserUuid"
          placeholder="按 user_uuid 筛选"
          clearable
          style="width: 220px"
          @keyup.enter="handleFilterChange"
          @clear="handleFilterChange"
        />
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="filterTimeRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 360px"
          @change="handleFilterChange"
        />
      </el-form-item>
    </template>

    <template #col-event="{ row }">
      <el-tag :type="eventTagType(row.event)" size="small">
        {{ eventLabel(row.event) }}
      </el-tag>
    </template>

    <template #col-client_id="{ row }">
      <span v-if="row.client_id" class="mono-text">{{ row.client_id }}</span>
      <span v-else class="empty">-</span>
    </template>

    <template #col-user_uuid="{ row }">
      <span v-if="row.user_uuid" class="mono-text">{{ row.user_uuid }}</span>
      <span v-else class="empty">-</span>
    </template>

    <template #col-ip="{ row }">
      <span v-if="row.ip" class="mono-text">{{ row.ip }}</span>
      <span v-else class="empty">-</span>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
        {{ row.status === 'success' ? '成功' : '失败' }}
      </el-tag>
    </template>

    <template #col-detail="{ row }">
      <span v-if="row.detail" class="detail-text" :title="row.detail">
        {{ row.detail }}
      </span>
      <span v-else class="empty">-</span>
    </template>

    <template #col-created_at="{ row }">
      <span class="mono-text">{{ formatTime(row.created_at) }}</span>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="viewDetail(row)">
        详情
      </el-button>
    </template>
  </AdminListPage>

  <!-- 详情对话框 -->
  <el-dialog v-model="detailDialogVisible" title="审计日志详情" width="680px">
    <el-descriptions :column="1" border v-if="detailData">
      <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
      <el-descriptions-item label="事件">
        <el-tag :type="eventTagType(detailData.event)" size="small">
          {{ eventLabel(detailData.event) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="Client ID">
        {{ detailData.client_id || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="User UUID">
        {{ detailData.user_uuid || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="来源 IP">
        {{ detailData.ip || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag
          :type="detailData.status === 'success' ? 'success' : 'danger'"
          size="small"
        >
          {{ detailData.status === 'success' ? '成功' : '失败' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="详细说明">
        {{ detailData.detail || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="创建时间">
        {{ formatTime(detailData.created_at) }}
      </el-descriptions-item>
      <el-descriptions-item label="请求参数摘要">
        <pre class="json-preview">{{ formatJson(detailData.request_summary) }}</pre>
      </el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button @click="detailDialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import {
  getAdminOAuthAuditLogs,
  exportAdminOAuthAuditLogs,
  OAUTH_AUDIT_EVENTS,
  OAUTH_AUDIT_STATUSES,
  type AdminOAuthAuditLog,
  type AdminOAuthAuditLogQueryParams,
} from '@/api/admin-oauth-audit-logs'

const logs = ref<AdminOAuthAuditLog[]>([])
const total = ref(0)
const loading = ref(false)
const exporting = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

// 筛选条件
const filterEvent = ref<string>('')
const filterStatus = ref<string>('')
const filterClientId = ref<string>('')
const filterUserUuid = ref<string>('')
const filterTimeRange = ref<[string, string] | null>(null)

// 详情对话框
const detailDialogVisible = ref(false)
const detailData = ref<AdminOAuthAuditLog | null>(null)

const columns = computed<TableColumn[]>(() => [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'event', label: '事件', width: 140, slot: true },
  { prop: 'status', label: '状态', width: 90, slot: true },
  { prop: 'client_id', label: 'Client ID', width: 200, slot: true },
  { prop: 'user_uuid', label: 'User UUID', width: 200, slot: true },
  { prop: 'ip', label: '来源 IP', width: 140, slot: true },
  { prop: 'detail', label: '详细说明', minWidth: 240, slot: true },
  { prop: 'created_at', label: '创建时间', width: 180, slot: true },
])

// 事件 label 映射
const eventLabelMap = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  OAUTH_AUDIT_EVENTS.forEach((e) => (m[e.value] = e.label))
  return m
})

function eventLabel(event: string): string {
  return eventLabelMap.value[event] || event
}

// 事件 tag 类型 (按严重程度着色)
function eventTagType(event: string): 'info' | 'warning' | 'danger' | 'success' {
  if (event === 'app_delete' || event === 'app_reset_secret') return 'warning'
  if (event === 'authorize_deny') return 'info'
  if (event === 'app_create' || event === 'authorize_grant') return 'success'
  return 'info'
}

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function formatJson(obj: Record<string, unknown> | null): string {
  if (!obj) return '-'
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

async function fetchLogs() {
  loading.value = true
  try {
    const params: AdminOAuthAuditLogQueryParams = {
      page: currentPage.value,
      page_size: pageSize.value,
    }
    if (filterEvent.value) params.event = filterEvent.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterClientId.value.trim()) params.client_id = filterClientId.value.trim()
    if (filterUserUuid.value.trim()) params.user_uuid = filterUserUuid.value.trim()
    if (filterTimeRange.value && filterTimeRange.value.length === 2) {
      params.start_time = filterTimeRange.value[0]
      params.end_time = filterTimeRange.value[1]
    }
    const res = await getAdminOAuthAuditLogs(params)
    if (res.success && res.data) {
      logs.value = res.data
      // 后端在 meta 中返回 total / page / page_size (normalizeApiResponse 提取)
      total.value = (res as { total?: number }).total || res.data.length
    } else {
      ElMessage.error(res.message || '获取审计日志失败')
      logs.value = []
      total.value = 0
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '获取审计日志失败')
    logs.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  currentPage.value = 1
  fetchLogs()
}

function handlePageChange(page: number) {
  currentPage.value = page
  fetchLogs()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  fetchLogs()
}

// Round 29-C: CSV 导出 (按当前筛选条件导出全量, 后端忽略 page/page_size)
async function handleExport() {
  exporting.value = true
  try {
    const params: AdminOAuthAuditLogQueryParams = {}
    if (filterEvent.value) params.event = filterEvent.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterClientId.value.trim()) params.client_id = filterClientId.value.trim()
    if (filterUserUuid.value.trim()) params.user_uuid = filterUserUuid.value.trim()
    if (filterTimeRange.value && filterTimeRange.value.length === 2) {
      params.start_time = filterTimeRange.value[0]
      params.end_time = filterTimeRange.value[1]
    }
    const ok = await exportAdminOAuthAuditLogs(params)
    if (ok) {
      ElMessage.success('CSV 已开始下载, 请检查浏览器下载列表')
    } else {
      ElMessage.error('导出失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

function viewDetail(row: AdminOAuthAuditLog) {
  detailData.value = row
  detailDialogVisible.value = true
}

onMounted(() => {
  fetchLogs()
})
</script>

<style scoped>
.mono-text {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.empty {
  color: var(--el-text-color-placeholder);
}

.detail-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.json-preview {
  margin: 0;
  padding: 8px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow-y: auto;
}
</style>
