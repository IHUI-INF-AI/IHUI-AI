<template>
  <div class="my-points">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.point.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.point.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadAll">
          {{ t('edu.profile.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ② 顶部 4 个统计卡 -->
    <section class="stat-row">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <span class="stat-label">{{ t('edu.point.balance') }}</span>
          <span class="stat-value primary">{{ account?.balance ?? 0 }}</span>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <span class="stat-label">{{ t('edu.point.frozen') }}</span>
          <span class="stat-value warning">{{ account?.frozen ?? 0 }}</span>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <span class="stat-label">{{ t('edu.point.totalEarned') }}</span>
          <span class="stat-value success">{{ account?.total_earned ?? 0 }}</span>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <span class="stat-label">{{ t('edu.point.totalSpent') }}</span>
          <span class="stat-value info">{{ account?.total_spent ?? 0 }}</span>
        </div>
      </el-card>
    </section>

    <!-- ③ 积分明细 -->
    <section class="records-section">
      <div class="section-header">
        <h2 class="section-title">{{ t('edu.point.records') }}</h2>
        <el-radio-group v-model="filterType" @change="handleFilterChange">
          <el-radio-button value="">{{ t('edu.live.filterAll') }}</el-radio-button>
          <el-radio-button value="earn">{{ t('edu.point.earn') }}</el-radio-button>
          <el-radio-button value="spend">{{ t('edu.point.spend') }}</el-radio-button>
        </el-radio-group>
      </div>

      <el-table
        v-loading="loading"
        :data="records"
        class="records-table"
        stripe
      >
        <el-table-column :label="t('edu.point.recordTime')" prop="created_at" min-width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column :label="t('edu.point.changeType')" prop="change_type" min-width="100">
          <template #default="{ row }">
            <el-tag :type="row.change_type === 'earn' ? 'success' : 'warning'" effect="light" size="small">
              {{ row.change_type === 'earn' ? t('edu.point.earn') : t('edu.point.spend') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.point.amount')" prop="amount" min-width="100" align="right">
          <template #default="{ row }">
            <span :class="['amount-cell', row.change_type === 'earn' ? 'amount-earn' : 'amount-spend']">
              {{ row.change_type === 'earn' ? '+' : '-' }}{{ row.amount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.point.source')" prop="source" min-width="140" show-overflow-tooltip />
        <el-table-column :label="t('edu.point.remark')" prop="remark" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>

        <template #empty>
          <el-empty :description="t('edu.point.noRecords')" />
        </template>
      </el-table>

      <!-- ④ 分页 -->
      <div v-if="total > 0" class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadRecords"
          @size-change="handleSizeChange"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Refresh } from '@element-plus/icons-vue'
import { pointApi } from '@/api/edu'
import type { EduPointAccount } from '@/api/edu'

const { t } = useI18n()

const loading = ref(false)
const error = ref(false)
const account = ref<EduPointAccount | null>(null)
const records = ref<Array<Record<string, unknown>>>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const filterType = ref<string>('')

async function loadAccount() {
  try {
    const res = await pointApi.myAccount()
    account.value = res.data?.data ?? null
  } catch (e) {
    // 账户加载失败不阻断明细展示
  }
}

async function loadRecords() {
  loading.value = true
  error.value = false
  try {
    const res = await pointApi.myRecords({
      page: page.value,
      size: size.value,
      change_type: filterType.value || undefined,
    })
    const data = res.data?.data
    if (data) {
      records.value = data.items as Array<Record<string, unknown>>
      total.value = data.total
    } else {
      records.value = []
      total.value = 0
    }
  } catch (e) {
    error.value = true
    records.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  await Promise.all([loadAccount(), loadRecords()])
}

function handleFilterChange() {
  page.value = 1
  loadRecords()
}

function handleSizeChange() {
  page.value = 1
  loadRecords()
}

function formatTime(value: unknown): string {
  if (!value) return '-'
  const s = String(value)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.my-points {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  border-radius: 8px;
  transition: border-color 0.2s ease;

  :deep(.el-card__body) {
    padding: 20px;
  }
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.stat-value.primary { color: var(--el-color-primary); }
.stat-value.warning { color: var(--el-color-warning); }
.stat-value.success { color: var(--el-color-success); }
.stat-value.info { color: var(--el-text-color-regular); }

.records-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.records-table {
  width: 100%;
}

.amount-cell {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.amount-earn {
  color: var(--el-color-success);
}

.amount-spend {
  color: var(--el-color-warning);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}

/* 禁止蓝光边框 */
:deep(.el-radio-button__inner) {
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  box-shadow: none !important;
}

:deep(.el-radio-button__original-radio:focus-visible + .el-radio-button__inner) {
  box-shadow: none !important;
}

:deep(.el-button:focus-visible) {
  outline: none;
  box-shadow: none;
}

@media (max-width: 640px) {
  .stat-row {
    grid-template-columns: 1fr 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
