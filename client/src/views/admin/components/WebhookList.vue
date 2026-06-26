<template>
  <AdminListPage
    :title="t('adminCommon.title.webhookManage')"
    :description="t('adminComponents.webhook.desc')"
    :columns="columns"
    :data="webhooks"
    :total="total"
    :loading="loading"
    :show-add="true"
    @add="handleAdd"
    @search="handleSearch"
    @refresh="fetchWebhooks"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item :label="t('adminCommon.label.eventType')">
        <el-select v-model="filterEvent" :placeholder="t('adminCommon.placeholder.allEvents')" clearable @change="fetchWebhooks">
          <el-option :label="t('adminCommon.label.orderCreated')" value="order.created" />
          <el-option :label="t('adminCommon.label.orderPaid')" value="order.paid" />
          <el-option :label="t('adminCommon.label.userRegistered')" value="user.registered" />
          <el-option :label="t('adminCommon.label.paymentCallback')" value="payment.callback" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('adminCommon.label.status')">
        <el-select v-model="filterStatus" :placeholder="t('adminCommon.placeholder.allStatus')" clearable @change="fetchWebhooks">
          <el-option :label="t('adminCommon.label.enabled')" value="active" />
          <el-option :label="t('adminCommon.label.disabled')" value="inactive" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-event="{ row }">
      <el-tag size="small">{{ getEventText(row.event) }}</el-tag>
    </template>

    <template #col-url="{ row }">
      <el-tooltip :content="row.url" placement="top">
        <span class="url-text">{{ row.url }}</span>
      </el-tooltip>
    </template>

    <template #col-status="{ row }">
      <el-switch :model-value="row.status === 'active'" @change="(val: boolean) => toggleStatus(row, val)" />
    </template>

    <template #col-lastTriggered="{ row }">
      <span v-if="row.lastTriggered">{{ row.lastTriggered }}</span>
      <span v-else class="text-muted">{{ t('adminCommon.label.neverTriggered') }}</span>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="testWebhook(row)">
        {{ t('adminCommon.label.test') }}
      </el-button>
      <el-button type="primary" link size="small" @click="editWebhook(row)">
        {{ t('adminCommon.label.edit') }}
      </el-button>
      <el-button type="primary" link size="small" @click="viewLogs(row)">
        {{ t('adminCommon.label.logs') }}
      </el-button>
      <el-popconfirm :title="t('adminCommon.title.confirmDelete')" @confirm="deleteWebhook(row)">
        <template #reference>
          <el-button type="danger" link size="small">{{ t('common.delete') }}</el-button>
        </template>
      </el-popconfirm>
    </template>
  </AdminListPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted } from 'vue'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'

interface Webhook {
  id: string
  name: string
  event: string
  url: string
  status: string
  successCount: number
  failCount: number
  lastTriggered: string | null
  createdAt: string
}

const columns: TableColumn[] = [
  { prop: 'name', label: t('adminCommon.label.name'), width: 150 },
  { prop: 'event', label: t('adminCommon.label.event'), width: 120, slot: true },
  { prop: 'url', label: 'URL', minWidth: 200, slot: true },
  { prop: 'status', label: t('adminCommon.label.status'), width: 80, slot: true },
  { prop: 'successCount', label: t('adminCommon.label.success'), width: 80 },
  { prop: 'failCount', label: t('adminCommon.label.failed'), width: 80 },
  { prop: 'lastTriggered', label: t('adminCommon.label.lastTriggered'), width: 150, slot: true },
  { prop: 'createdAt', label: t('adminCommon.label.createdAt'), width: 180, type: 'date' },
]

const webhooks = ref<Webhook[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterEvent = ref('')
const filterStatus = ref('')

const eventMap: Record<string, string> = {
  'order.created': t('adminCommon.label.orderCreated'),
  'order.paid': t('adminCommon.label.orderPaid'),
  'user.registered': t('adminCommon.label.userRegistered'),
  'payment.callback': t('adminCommon.label.paymentCallback'),
}

const getEventText = (event: string): string => eventMap[event] || event

const fetchWebhooks = async () => {
  loading.value = true
  try {
    webhooks.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleAdd = () => { /* 新增Webhook */ }
const handleSearch = (_keyword: string) => { fetchWebhooks() }
const handlePageChange = (page: number) => { currentPage.value = page; fetchWebhooks() }
const handleSizeChange = (size: number) => { pageSize.value = size; fetchWebhooks() }
const toggleStatus = (_webhook: Webhook, _val: boolean) => { /* 切换状态 */ }
const testWebhook = (_webhook: Webhook) => { /* 测试Webhook */ }
const editWebhook = (_webhook: Webhook) => { /* 编辑Webhook */ }
const viewLogs = (_webhook: Webhook) => { /* 查看日志 */ }
const deleteWebhook = (_webhook: Webhook) => { /* 删除Webhook */ }

onMounted(() => fetchWebhooks())
</script>

<style scoped>
.url-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  max-width: 250px;
  font-family: var(--font-family-mono);
  font-size: 12px;
}
.text-muted { color: var(--el-text-color-placeholder); }
</style>
