<template>
  <div class="withdraw-records-page page-container">
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Wallet /></el-icon>
        {{ t('withdrawRecords.title') }}
      </h1>
      <p class="page-subtitle">{{ t('withdrawRecords.subtitle') }}</p>
    </div>

    <div class="filter-section radius-auto">
      <el-form :inline="true" :model="filterForm">
        <el-form-item :label="t('withdrawRecords.filter.status')">
          <el-select
            v-model="filterForm.status"
            :placeholder="t('withdrawRecords.filter.all')"
            clearable
            class="filter-select"
          >
            <el-option :label="t('withdrawRecords.filter.all')" value="" />
            <el-option :label="t('withdrawRecords.filter.pending')" :value="0" />
            <el-option :label="t('withdrawRecords.filter.approved')" :value="1" />
            <el-option :label="t('withdrawRecords.filter.rejected')" :value="2" />
            <el-option :label="t('withdrawRecords.filter.completed')" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">{{
            t('withdrawRecords.filter.search')
          }}</el-button>
          <el-button @click="handleReset">{{ t('withdrawRecords.filter.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="records-section radius-auto">
      <el-table :data="paginatedRecords" v-loading="loading" class="full-width">
        <el-table-column
          prop="withdrawal_no"
          :label="t('withdrawRecords.table.withdrawalNo')"
          min-width="150"
        />
        <el-table-column prop="amount" :label="t('withdrawRecords.table.amount')" width="120">
          <template #default="{ row }">
            <span class="amount-text">¥{{ row.amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="method" :label="t('withdrawRecords.table.method')" width="100">
          <template #default="{ row }">
            {{ getMethodText(row.method) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="account"
          :label="t('withdrawRecords.table.account')"
          min-width="150"
        />
        <el-table-column :label="t('withdrawRecords.table.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="create_time"
          :label="t('withdrawRecords.table.createTime')"
          width="180"
        >
          <template #default="{ row }">
            {{ formatTime(row.create_time) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('withdrawRecords.table.actions')" width="120">
          <template #default="{ row }">
            <el-button link size="small" @click="viewDetail(row)">{{
              t('withdrawRecords.table.viewDetail')
            }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredRecords.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>

      <el-empty
        v-if="filteredRecords.length === 0 && !loading"
        :description="t('withdrawRecords.empty.noRecords')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Wallet } from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'
import { getWithdrawalRecords } from '@/api/payment/withdrawal'
import type { WithdrawalRecord } from '@/api/payment/withdrawal'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import type { ApiResponse } from '@/types'

const { t } = useI18n()

const { loading, execute: executeApi } = useApiError({ showMessage: true })
const recordsList = ref<WithdrawalRecord[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const filterForm = ref({
  status: '' as number | string,
})

const filteredRecords = computed(() => {
  let result = recordsList.value
  if (filterForm.value.status !== '') {
    result = result.filter(record => record.status === filterForm.value.status)
  }
  return result
})

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredRecords.value.slice(start, end)
})

const loadRecords = async () => {
  const response = await executeApi(() => getWithdrawalRecords({
    page: currentPage.value,
    pageSize: pageSize.value,
  }) as Promise<ApiResponse<unknown>>)
  if (response && typeof response === 'object') {
    const responseData = response as { list?: WithdrawalRecord[]; items?: WithdrawalRecord[] }
    recordsList.value = responseData.list || responseData.items || []
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadRecords()
}

const handleReset = () => {
  filterForm.value.status = ''
  currentPage.value = 1
  loadRecords()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  loadRecords()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadRecords()
}

const getMethodText = (method: string): string => {
  const methodMap: Record<string, string> = {
    wechat: t('withdrawRecords.methods.wechat'),
    alipay: t('withdrawRecords.methods.alipay'),
    bank: t('withdrawRecords.methods.bank'),
  }
  return methodMap[method] || method
}

const getStatusType = (status: number): 'success' | 'warning' | 'danger' | 'info' => {
  if (status === 3) return 'success'
  if (status === 1) return 'success'
  if (status === 0) return 'warning'
  if (status === 2) return 'danger'
  return 'info'
}

const getStatusText = (status: number): string => {
  const statusMap: Record<number, string> = {
    0: t('withdrawRecords.status.pending'),
    1: t('withdrawRecords.status.approved'),
    2: t('withdrawRecords.status.rejected'),
    3: t('withdrawRecords.status.completed'),
  }
  return statusMap[status] || t('withdrawRecords.status.unknown')
}

const formatTime = (time: string): string => {
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const viewDetail = (record: WithdrawalRecord) => {
  logger.debug('[WithdrawRecords] View details:', record)
}

onMounted(() => {
  loadRecords()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.withdraw-records-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (width <= $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.filter-section,
.records-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.amount-text {
  color: var(--el-color-primary);
  font-weight: 600;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.filter-select {
  width: 150px;
}

.full-width {
  width: 100%;
}
</style>
