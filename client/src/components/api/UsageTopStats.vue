<template>
  <div class="usage-top-stats">
    <el-tabs v-model="activeTab" class="top-stats-tabs">
      <!-- TOP分组统计 -->
      <el-tab-pane :label="t('apiService.usage.topGroups')" name="groups">
        <el-card shadow="never">
          <el-table :data="topGroups" border v-loading="loading">
            <el-table-column type="index" label="#" width="60" />
            <el-table-column prop="groupName" :label="t('apiService.usage.groupName')" min-width="150" />
            <el-table-column prop="requests" :label="t('apiService.usage.requests')" width="120" align="right">
              <template #default="{ row }">
                {{ formatNumber(row.requests) }}
              </template>
            </el-table-column>
            <el-table-column prop="errorRate" :label="t('apiService.usage.errorRate')" width="120" align="right">
              <template #default="{ row }">
                {{ row.errorRate.toFixed(2) }}%
              </template>
            </el-table-column>
            <el-table-column prop="avgLatency" :label="t('apiService.usage.avgLatency')" width="120" align="right">
              <template #default="{ row }">
                {{ formatDuration(row.avgLatency) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- TOP API统计 -->
      <el-tab-pane :label="t('apiService.usage.topApis')" name="apis">
        <el-card shadow="never">
          <el-table :data="topApis" border v-loading="loading">
            <el-table-column type="index" label="#" width="60" />
            <el-table-column prop="apiPath" :label="t('apiService.usage.apiPath')" min-width="200">
              <template #default="{ row }">
                <el-tag :type="getMethodType(row.method)" size="small">{{ row.method }}</el-tag>
                <code class="api-path">{{ row.apiPath }}</code>
              </template>
            </el-table-column>
            <el-table-column prop="requests" :label="t('apiService.usage.requests')" width="120" align="right">
              <template #default="{ row }">
                {{ formatNumber(row.requests) }}
              </template>
            </el-table-column>
            <el-table-column prop="successRate" :label="t('apiService.usage.successRate')" width="120" align="right">
              <template #default="{ row }">
                {{ row.successRate.toFixed(1) }}%
              </template>
            </el-table-column>
            <el-table-column prop="avgLatency" :label="t('apiService.usage.avgLatency')" width="120" align="right">
              <template #default="{ row }">
                {{ formatDuration(row.avgLatency) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- TOP延迟统计 -->
      <el-tab-pane :label="t('apiService.usage.topLatency')" name="latency">
        <el-card shadow="never">
          <el-table :data="topLatency" border v-loading="loading">
            <el-table-column type="index" label="#" width="60" />
            <el-table-column prop="apiPath" :label="t('apiService.usage.apiPath')" min-width="200">
              <template #default="{ row }">
                <el-tag :type="getMethodType(row.method)" size="small">{{ row.method }}</el-tag>
                <code class="api-path">{{ row.apiPath }}</code>
              </template>
            </el-table-column>
            <el-table-column prop="avgLatency" :label="t('apiService.usage.avgLatency')" width="150" align="right">
              <template #default="{ row }">
                <span :class="{ 'high-latency': row.avgLatency > 1000 }">
                  {{ formatDuration(row.avgLatency) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="maxLatency" :label="t('apiService.usage.maxLatency')" width="150" align="right">
              <template #default="{ row }">
                {{ formatDuration(row.maxLatency) }}
              </template>
            </el-table-column>
            <el-table-column prop="requests" :label="t('apiService.usage.requests')" width="120" align="right">
              <template #default="{ row }">
                {{ formatNumber(row.requests) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 按应用统计 -->
      <el-tab-pane :label="t('apiService.usage.byApp')" name="byApp">
        <el-card shadow="never">
          <el-table :data="statsByApp" border v-loading="loading">
            <el-table-column type="index" label="#" width="60" />
            <el-table-column prop="appName" :label="t('apiService.usage.appName')" min-width="150" />
            <el-table-column prop="requests" :label="t('apiService.usage.requests')" width="120" align="right">
              <template #default="{ row }">
                {{ formatNumber(row.requests) }}
              </template>
            </el-table-column>
            <el-table-column prop="errorRate" :label="t('apiService.usage.errorRate')" width="120" align="right">
              <template #default="{ row }">
                {{ row.errorRate.toFixed(2) }}%
              </template>
            </el-table-column>
            <el-table-column prop="avgLatency" :label="t('apiService.usage.avgLatency')" width="120" align="right">
              <template #default="{ row }">
                {{ formatDuration(row.avgLatency) }}
              </template>
            </el-table-column>
            <el-table-column prop="totalCost" :label="t('apiService.usage.cost')" width="120" align="right">
              <template #default="{ row }">
                ¥{{ row.totalCost.toFixed(2) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatNumber, formatDuration } from '@/utils/format'
import { logger } from '@/utils/logger'
import { isMockEnabled } from '@/utils/envUtils'

defineOptions({
  name: 'UsageTopStats',
  inheritAttrs: false,
})

const { t } = useI18n()

interface TopGroup {
  groupName: string
  requests: number
  errorRate: number
  avgLatency: number
}

interface TopApi {
  method: string
  apiPath: string
  requests: number
  successRate: number
  avgLatency: number
}

interface TopLatency {
  method: string
  apiPath: string
  avgLatency: number
  maxLatency: number
  requests: number
}

interface StatsByApp {
  appName: string
  requests: number
  errorRate: number
  avgLatency: number
  totalCost: number
}

const activeTab = ref('groups')
const loading = ref(false)

const topGroups = ref<TopGroup[]>([])
const topApis = ref<TopApi[]>([])
const topLatency = ref<TopLatency[]>([])
const statsByApp = ref<StatsByApp[]>([])

const getMethodType = (method: string) => {
  const methodMap: Record<string, 'success' | 'primary' | 'warning' | 'danger'> = {
    GET: 'primary',
    POST: 'success',
    PUT: 'warning',
    DELETE: 'danger',
  }
  return methodMap[method] || 'info'
}

const loadTopStats = async () => {
  loading.value = true
  try {
    if (!isMockEnabled()) {
      logger.warn(t('apiService.usage.topStatsNotAvailable'))
      topGroups.value = []
      topApis.value = []
      topLatency.value = []
      statsByApp.value = []
      return
    }
    topGroups.value = [
      { groupName: '默认分组', requests: 12345, errorRate: 0.5, avgLatency: 120 },
      { groupName: '生产环境', requests: 9876, errorRate: 0.2, avgLatency: 95 },
      { groupName: '测试环境', requests: 5432, errorRate: 1.2, avgLatency: 150 },
    ]

    topApis.value = [
      { method: 'POST', apiPath: '/v1/chat/completions', requests: 5678, successRate: 99.5, avgLatency: 180 },
      { method: 'GET', apiPath: '/v1/models', requests: 4321, successRate: 100, avgLatency: 50 },
      { method: 'POST', apiPath: '/v1/images/generations', requests: 2345, successRate: 98.8, avgLatency: 2500 },
    ]

    topLatency.value = [
      { method: 'POST', apiPath: '/v1/images/generations', avgLatency: 2500, maxLatency: 5000, requests: 2345 },
      { method: 'POST', apiPath: '/v1/audio/transcriptions', avgLatency: 1200, maxLatency: 3000, requests: 1234 },
      { method: 'POST', apiPath: '/v1/chat/completions', avgLatency: 180, maxLatency: 500, requests: 5678 },
    ]

    statsByApp.value = [
      { appName: '我的应用1', requests: 5678, errorRate: 0.5, avgLatency: 120, totalCost: 123.45 },
      { appName: '我的应用2', requests: 4321, errorRate: 0.2, avgLatency: 95, totalCost: 98.76 },
      { appName: '我的应用3', requests: 2345, errorRate: 1.2, avgLatency: 150, totalCost: 54.32 },
    ]
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTopStats()
})
</script>

<style scoped lang="scss">
.usage-top-stats {
  .top-stats-tabs {
    :deep(.el-tabs__content) {
      padding: 0;
    }
  }

  .api-path {
    margin-left: 8px;
    font-family: var(--font-family-mono);
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  .high-latency {
    color: var(--el-color-danger);
    font-weight: 600;
  }
}
</style>
