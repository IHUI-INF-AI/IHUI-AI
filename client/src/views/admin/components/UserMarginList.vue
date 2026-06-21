<template>
  <AdminListPage
    :title="t('adminComponents.userMargin.title')"
    :description="t('adminComponents.userMargin.desc')"
    :columns="columns"
    :data="margins"
    :total="total"
    :loading="loading"
    :show-search="true"
    @search="handleSearch"
    @refresh="fetchMargins"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #col-balance="{ row }">
      <span class="balance">¥{{ row.balance.toFixed(2) }}</span>
    </template>

    <template #col-frozenBalance="{ row }">
      <span :class="{ 'frozen': row.frozenBalance > 0 }">
        ¥{{ row.frozenBalance.toFixed(2) }}
      </span>
    </template>

    <template #col-totalEarnings="{ row }">
      <span class="earnings">¥{{ row.totalEarnings.toFixed(2) }}</span>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
        {{ row.status === 'active' ? t('adminCommon.label.normal') : t('adminCommon.label.frozenStatus') }}
      </el-tag>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="viewDetail(row)">
        {{ t('adminCommon.label.detail') }}
      </el-button>
      <el-button type="primary" link size="small" @click="viewTransactions(row)">
        {{ t('adminCommon.label.transactions') }}
      </el-button>
      <el-button
        :type="row.status === 'active' ? 'danger' : 'success'"
        link
        size="small"
        @click="toggleFreeze(row)"
      >
        {{ row.status === 'active' ? t('adminCommon.label.freeze') : t('adminCommon.label.unfreeze') }}
      </el-button>
    </template>
  </AdminListPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'

interface UserMargin {
  id: string
  userId: string
  userName: string
  balance: number
  frozenBalance: number
  totalEarnings: number
  status: string
  updatedAt: string
}

const { t } = useI18n()

const columns: TableColumn[] = [
  { prop: 'userName', label: t('adminCommon.label.user'), width: 120 },
  { prop: 'balance', label: t('adminCommon.label.balance'), width: 120, slot: true },
  { prop: 'frozenBalance', label: t('adminCommon.label.frozen'), width: 120, slot: true },
  { prop: 'totalEarnings', label: t('adminCommon.label.totalEarnings'), width: 120, slot: true },
  { prop: 'status', label: t('adminCommon.label.status'), width: 80, slot: true },
  { prop: 'updatedAt', label: t('adminCommon.label.updatedAt'), width: 180, type: 'date' },
]

const margins = ref<UserMargin[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

const fetchMargins = async () => {
  loading.value = true
  try {
    margins.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = (_keyword: string) => { fetchMargins() }
const handlePageChange = (page: number) => { currentPage.value = page; fetchMargins() }
const handleSizeChange = (size: number) => { pageSize.value = size; fetchMargins() }
const viewDetail = (_m: UserMargin) => { /* 查看详情 */ }
const viewTransactions = (_m: UserMargin) => { /* 查看流水 */ }
const toggleFreeze = (_m: UserMargin) => { /* 冻结/解冻 */ }

onMounted(() => fetchMargins())
</script>

<style scoped>
.balance { font-weight: 600; color: var(--el-color-primary); }
.earnings { font-weight: 600; color: var(--el-color-success); }
.frozen { color: var(--el-color-danger); }
</style>
