<template>
  <AdminListPage
    :title="t('adminComponents.withdrawal.title')"
    :description="t('adminComponents.withdrawal.desc')"
    :columns="columns"
    :data="withdrawals"
    :total="total"
    :loading="loading"
    :show-selection="true"
    @search="handleSearch"
    @refresh="fetchWithdrawals"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item :label="t('adminCommon.label.status')">
        <el-select v-model="filterStatus" :placeholder="t('adminCommon.placeholder.allStatus')" clearable @change="fetchWithdrawals">
          <el-option :label="t('adminCommon.label.pending')" value="pending" />
          <el-option :label="t('adminCommon.label.approved')" value="approved" />
          <el-option :label="t('adminCommon.label.rejected')" value="rejected" />
          <el-option :label="t('adminCommon.label.completed')" value="completed" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-amount="{ row }">
      <span class="amount">¥{{ row.amount.toFixed(2) }}</span>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="getStatusStyle(row.status)">
        {{ getStatusText(row.status) }}
      </el-tag>
    </template>

    <template #actions="{ row }">
      <template v-if="row.status === 'pending'">
        <el-button type="success" link size="small" @click="approveWithdrawal(row)">
          {{ t('adminCommon.label.approve') }}
        </el-button>
        <el-button type="danger" link size="small" @click="rejectWithdrawal(row)">
          {{ t('adminCommon.label.reject') }}
        </el-button>
      </template>
      <el-button v-if="row.status === 'approved'" type="primary" link size="small" @click="completeWithdrawal(row)">
        {{ t('adminCommon.label.pay') }}
      </el-button>
      <el-button type="primary" link size="small" @click="viewDetail(row)">
        {{ t('adminCommon.label.detail') }}
      </el-button>
    </template>
  </AdminListPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'

interface Withdrawal {
  id: string
  userId: string
  userName: string
  amount: number
  bankName: string
  bankAccount: string
  status: string
  appliedAt: string
}

const { t } = useI18n()

const columns: TableColumn[] = [
  { prop: 'userName', label: '用户', width: 120 },
  { prop: 'amount', label: '金额', width: 100, slot: true },
  { prop: 'bankName', label: '银行', width: 120 },
  { prop: 'bankAccount', label: '账号', width: 180 },
  { prop: 'status', label: '状态', width: 100, slot: true },
  { prop: 'appliedAt', label: '申请时间', width: 180, type: 'date' },
]

const withdrawals = ref<Withdrawal[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')

const statusMap: Record<string, { text: string; style: string }> = {
  pending: { text: t('adminCommon.label.pending'), style: 'warning' },
  approved: { text: t('adminCommon.label.approved'), style: 'success' },
  rejected: { text: t('adminCommon.label.rejected'), style: 'danger' },
  completed: { text: t('adminCommon.label.completed'), style: 'info' },
}

const getStatusText = (status: string): string => statusMap[status]?.text || status
const getStatusStyle = (status: string): string => statusMap[status]?.style || 'info'

const fetchWithdrawals = async () => {
  loading.value = true
  try {
    withdrawals.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = (_keyword: string) => { fetchWithdrawals() }
const handlePageChange = (page: number) => { currentPage.value = page; fetchWithdrawals() }
const handleSizeChange = (size: number) => { pageSize.value = size; fetchWithdrawals() }
const approveWithdrawal = (_w: Withdrawal) => { /* 通过提现 */ }
const rejectWithdrawal = (_w: Withdrawal) => { /* 拒绝提现 */ }
const completeWithdrawal = (_w: Withdrawal) => { /* 完成打款 */ }
const viewDetail = (_w: Withdrawal) => { /* 查看详情 */ }

onMounted(() => fetchWithdrawals())
</script>

<style scoped>
.amount { font-weight: 600; color: var(--el-color-danger); }
</style>
