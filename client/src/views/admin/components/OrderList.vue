﻿<template>
  <AdminListPage
    :title="t('adminComponents.order.title')"
    :description="t('adminComponents.order.desc')"
    :columns="columns"
    :data="orders"
    :total="total"
    :loading="loading"
    :show-selection="true"
    :show-index="true"
    @search="handleSearch"
    @refresh="fetchOrders"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
    @selection-change="handleSelectionChange"
  >
    <template #col-status="{ row }">
      <el-tag :type="getStatusType(row.status)">
        {{ getStatusText(row.status) }}
      </el-tag>
    </template>

    <template #col-amount="{ row }">
      <span class="amount">¥{{ row.amount.toFixed(2) }}</span>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="viewOrder(row)">
        {{ t('adminComponents.order.detail') }}
      </el-button>
      <el-button
        v-if="row.status === 'pending'"
        type="success"
        link
        size="small"
        @click="completeOrder(row)"
      >
        {{ t('adminComponents.order.complete') }}
      </el-button>
      <el-button
        v-if="row.status === 'pending'"
        type="danger"
        link
        size="small"
        @click="cancelOrder(row)"
      >
        {{ t('adminComponents.order.cancel') }}
      </el-button>
    </template>
  </AdminListPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import {
  getAdminOrders,
  completeAdminOrder,
  cancelAdminOrder,
  type AdminOrder,
} from '@/api/admin-orders'

const { t } = useI18n()

const columns = computed<TableColumn[]>(() => [
  { prop: 'orderNo', label: t('adminComponents.order.colOrderNo'), width: 180 },
  { prop: 'userName', label: t('adminComponents.order.colUser'), width: 120 },
  { prop: 'productName', label: t('adminComponents.order.colProduct'), minWidth: 150 },
  { prop: 'amount', label: t('adminComponents.order.colAmount'), width: 100, slot: true },
  { prop: 'status', label: t('adminComponents.product.filterStatus'), width: 100, slot: true },
  { prop: 'paymentMethod', label: t('adminComponents.order.colPaymentMethod'), width: 100 },
  { prop: 'createdAt', label: t('adminComponents.order.colCreatedAt'), width: 180, type: 'date' },
])

const orders = ref<AdminOrder[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

const statusMap = computed<Record<string, { text: string; type: string }>>(() => ({
  pending: { text: t('adminComponents.order.statusPending'), type: 'warning' },
  paid: { text: t('adminComponents.order.statusPaid'), type: 'success' },
  completed: { text: t('adminComponents.order.statusCompleted'), type: 'success' },
  cancelled: { text: t('adminComponents.order.statusCancelled'), type: 'info' },
  refunded: { text: t('adminComponents.order.statusRefunded'), type: 'danger' },
}))

const getStatusType = (status: string): string => statusMap.value[status]?.type || 'info'
const getStatusText = (status: string): string => statusMap.value[status]?.text || status

const fetchOrders = async () => {
  loading.value = true
  try {
    const res = await getAdminOrders({
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    if (res.success && res.data) {
      orders.value = res.data.list ?? []
      total.value = res.data.total ?? 0
    } else {
      orders.value = []
      total.value = 0
      if (res.code !== 200) ElMessage.warning(res.message || '加载失败')
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = (_keyword: string) => {
  fetchOrders()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchOrders()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  fetchOrders()
}

const handleSelectionChange = (_rows: unknown[]) => {
  // 选择变更
}

const viewOrder = (order: AdminOrder) => {
  ElMessage.info(`订单详情：${order.orderNo}（可跳转详情页或弹窗）`)
}

const completeOrder = async (order: AdminOrder) => {
  const res = await completeAdminOrder(order.id)
  if (res.success) {
    ElMessage.success(t('adminOrderList.completed'))
    fetchOrders()
  } else {
    ElMessage.error(res.message || '操作失败')
  }
}

const cancelOrder = async (order: AdminOrder) => {
  const res = await cancelAdminOrder(order.id)
  if (res.success) {
    ElMessage.success(t('adminOrderList.cancelled'))
    fetchOrders()
  } else {
    ElMessage.error(res.message || '操作失败')
  }
}

onMounted(() => {
  fetchOrders()
})
</script>

<style scoped>
.amount {
  font-weight: 600;
  color: var(--el-color-danger);
}
</style>
