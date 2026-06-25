<template>
  <div class="agent-statistics">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 200px" />
      </template>
      <template #default>
        <el-card shadow="hover" class="overview-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('statisticsComponents.reviewStats') }}</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.totalReviews') }}</div>
                <div class="stat-value">
                  {{ data?.examine?.totalExamines || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.passed') }}</div>
                <div class="stat-value">{{ data?.examine?.approved || 0 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.pending') }}</div>
                <div class="stat-value">{{ data?.examine?.pending || 0 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.rejected') }}</div>
                <div class="stat-value">{{ data?.examine?.rejected || 0 }}</div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="hover" class="overview-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('statisticsComponents.purchaseStats') }}</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.totalPurchases') }}</div>
                <div class="stat-value">{{ data?.buy?.totalBuys || 0 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.totalRevenue') }}</div>
                <div class="stat-value">¥{{ (data?.buy?.totalRevenue || 0) / 100 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.uniqueBuyers') }}</div>
                <div class="stat-value">{{ data?.buy?.uniqueBuyers || 0 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.uniqueAgents') }}</div>
                <div class="stat-value">{{ data?.buy?.uniqueAgents || 0 }}</div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="hover" class="overview-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('statisticsComponents.settlementStats') }}</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.totalSettlements') }}</div>
                <div class="stat-value">
                  {{ data?.settlement?.totalSettlements || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.totalWithdrawn') }}</div>
                <div class="stat-value">¥{{ (data?.settlement?.totalWithdrawal || 0) / 100 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.settled') }}</div>
                <div class="stat-value">
                  {{ data?.settlement?.settledCount || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statisticsComponents.unsettled') }}</div>
                <div class="stat-value">
                  {{ data?.settlement?.unsettledCount || 0 }}
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getAgentStatistics, type AgentStatistics } from '@/api/statistics/statistics'
import { useApiError } from '@/composables/useApiError'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  timeRange: 'today' | 'week' | 'month' | 'all'
}>()

const { loading, execute: executeApi } = useApiError({ showMessage: false })
const data = ref<AgentStatistics | null>(null)

const loadData = async () => {
  const res = await executeApi(() => getAgentStatistics({ type: props.timeRange }))
  if (res) {
    data.value = res
  }
}

watch(
  () => props.timeRange,
  () => {
    loadData()
  }
)

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.agent-statistics {
  .overview-card {
    margin-bottom: 20px;

    .card-header {
      font-weight: 600;
      font-size: 16px;
    }

    .stat-item {
      text-align: center;
      padding: 20px;

      .stat-label {
        font-size: 14px;
        color: var(--el-text-color-placeholder);
        margin-bottom: 10px;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }
  }
}
</style>
