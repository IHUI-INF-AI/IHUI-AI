<template>
  <div class="distribution-team-detail-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><User /></el-icon>
        {{ t('distributionTeamDetail.title') }}
      </h1>
      <p class="page-subtitle">{{ t('distributionTeamDetail.subtitle') }}</p>
    </div>

    <GlobalLoading v-if="loading" />

    <!-- 成员信息卡片 -->
    <el-card v-if="!loading && memberInfo" class="member-info-card radius-auto" shadow="never">
      <div class="member-header">
        <el-avatar :src="memberInfo.avatar" :size="80">
          <el-icon><User /></el-icon>
        </el-avatar>
        <div class="member-info">
          <h3>{{ memberInfo.username || memberInfo.nickname }}</h3>
          <p>
            {{ t('distributionTeamDetail.registerTime') }}：{{ formatDate(memberInfo.created_at) }}
          </p>
        </div>
      </div>

      <div class="member-stats">
        <div class="stat-item">
          <div class="stat-label">{{ t('distributionTeamDetail.subCount') }}</div>
          <div class="stat-value">{{ memberInfo.sub_count || 0 }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ t('distributionTeamDetail.totalCommission') }}</div>
          <div class="stat-value">¥{{ (memberInfo.total_commission || 0).toFixed(2) }}</div>
        </div>
      </div>
    </el-card>

    <!-- 成员的下级列表 -->
    <el-card class="subordinates-card radius-auto" shadow="never">
      <template #header>
        <span>{{ t('distributionTeamDetail.subordinatesList') }}</span>
      </template>
      <el-table :data="subordinatesList" v-loading="loadingSubordinates" style="width: 100%">
        <el-table-column prop="username" :label="t('distributionTeamDetail.username')" width="150">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :src="row.avatar" :size="32">
                <el-icon><User /></el-icon>
              </el-avatar>
              <span>{{ row.username || row.nickname }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="nickname"
          :label="t('distributionTeamDetail.nickname')"
          width="150"
        />
        <el-table-column
          prop="created_at"
          :label="t('distributionTeamDetail.registerTime')"
          width="150"
        >
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="total_commission"
          :label="t('distributionTeamDetail.totalCommission')"
          width="120"
        >
          <template #default="{ row }">¥{{ (row.total_commission || 0).toFixed(2) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 成员订单列表 -->
    <el-card class="orders-card radius-auto" shadow="never">
      <template #header>
        <span>{{ t('distributionTeamDetail.ordersList') }}</span>
      </template>
      <el-table :data="ordersList" v-loading="loadingOrders" style="width: 100%">
        <el-table-column
          prop="order_no"
          :label="t('distributionTeamDetail.orderNo')"
          min-width="150"
        />
        <el-table-column prop="amount" :label="t('distributionTeamDetail.amount')" width="120">
          <template #default="{ row }">
            <span style="color: var(--el-color-primary); font-weight: bold">
              ¥{{ (row.amount / 100).toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="t('distributionTeamDetail.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="getOrderStatusType(row.status)">
              {{ getOrderStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="create_time"
          :label="t('distributionTeamDetail.createTime')"
          width="180"
        >
          <template #default="{ row }">
            {{ formatDate(row.create_time) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { User } from '@/lib/lucide-fallback'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getSubordinates, getUserAndChildrenOrders, type SubordinateUser } from '@/api/distribution'
import GlobalLoading from '@/components/common/GlobalLoading.vue'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import { formatTime } from '@/utils/format'

const route = useRoute()
const { showError } = useOperationFeedback()
const { t } = useI18n()

const memberId = computed(() => route.params.id as string)

const { loading, execute: _executeApi } = useApiError({ showMessage: true })
const memberInfo = ref<SubordinateUser | null>(null)
const subordinatesList = ref<SubordinateUser[]>([])
const { loading: loadingSubordinates, execute: executeSubordinatesApi } = useApiError({ showMessage: false })
const ordersList = ref<unknown[]>([])
const { loading: loadingOrders, execute: executeOrdersApi } = useApiError({ showMessage: false })

// 加载成员信息
const loadMemberInfo = async () => {
  try {
    loading.value = true
    // 从下级列表中查找该成员（移动端使用open_id, page, quantity参数，POST方法）
    const response = await getSubordinates({ open_id: memberId.value, page: 1, quantity: 100 })
    if (response.success && response.data) {
      const member = response.data.list.find(
        (item: SubordinateUser) => item.uuid === memberId.value
      )
      if (member) {
        memberInfo.value = member
      } else {
        showError(t('distributionTeamDetail.memberNotFound'))
      }
    }
  } catch (error) {
    logger.error('[DistributionTeamDetail] Failed to load member info:', error)
    showError(t('distributionTeamDetail.loadMemberInfoFailed'))
  } finally {
    loading.value = false
  }
}

// 加载成员的下级列表
const loadSubordinates = async () => {
  // 移动端使用open_id, page, quantity参数，POST方法
  const data = await executeSubordinatesApi(() => getSubordinates({ open_id: memberId.value, page: 1, quantity: 100 }))
  if (data !== null && typeof data === 'object' && 'list' in data) {
    subordinatesList.value = (data as { list?: SubordinateUser[] }).list || []
  }
}

// 加载成员订单列表
const loadOrders = async () => {
  const data = await executeOrdersApi(() => getUserAndChildrenOrders({
    id: memberId.value,
    page: 1,
    quantity: 20,
  }))
  if (data !== null && typeof data === 'object' && 'list' in data) {
    ordersList.value = (data as { list?: any[] }).list || []
  }
}

// 工具方法
const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '-'
  return formatTime(date, 'YYYY-MM-DD')
}

const getOrderStatusType = (status: number): 'success' | 'warning' | 'danger' | 'info' => {
  const types: Record<number, 'success' | 'warning' | 'danger' | 'info'> = {
    0: 'warning',
    1: 'success',
    2: 'danger',
  }
  return types[status] || 'info'
}

const getOrderStatusText = (status: number): string => {
  const texts: Record<number, string> = {
    0: t('distributionTeamDetail.statusPending'),
    1: t('distributionTeamDetail.statusPaid'),
    2: t('distributionTeamDetail.statusCancelled'),
  }
  return texts[status] || t('distributionTeamDetail.statusUnknown')
}

// 页面加载
onMounted(() => {
  loadMemberInfo()
  loadSubordinates()
  loadOrders()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.distribution-team-detail-page {
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (max-width: $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
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

  @media (max-width: $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (max-width: $desktop-breakpoint-xs) {
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

  @media (max-width: $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.member-info-card,
.subordinates-card,
.orders-card {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (max-width: $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.member-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.member-info {
  flex: 1;

  h3 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  p {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.member-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  padding-top: 20px;
  border-top: var(--unified-border);
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
