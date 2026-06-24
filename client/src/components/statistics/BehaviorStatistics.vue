<template>
  <div class="behavior-statistics">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 200px" />
      </template>
      <template #default>
        <!-- 行为概览 -->
        <el-card shadow="hover" class="overview-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('statistics.behavior.overview') }}</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.behavior.loginDays') }}</div>
                <div class="stat-value">{{ data?.login?.loginDays || 0 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.behavior.totalLoginCount') }}</div>
                <div class="stat-value">
                  {{ data?.login?.totalLoginCount || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.behavior.lastLoginTime') }}</div>
                <div class="stat-value">
                  {{ formatDate(data?.login?.lastLoginTime) }}
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <!-- 活跃时段 -->
        <el-card
          shadow="hover"
          class="chart-card"
          v-if="data?.activeHours && data.activeHours.length > 0"
        >
          <template #header>
            <div class="card-header">
              <span>{{ t('statistics.behavior.activeHours') }}</span>
            </div>
          </template>
          <div ref="hourChartRef" style="height: 300px"></div>
        </el-card>

        <!-- 最常用智能体 -->
        <el-card
          shadow="hover"
          class="agents-card"
          v-if="data?.favoriteAgents && data.favoriteAgents.length > 0"
        >
          <template #header>
            <div class="card-header">
              <span>{{ t('statistics.behavior.favoriteAgents') }}</span>
            </div>
          </template>
          <el-table :data="data.favoriteAgents" stripe>
            <el-table-column prop="botId" :label="t('statistics.behavior.botId')" />
            <el-table-column prop="usageCount" :label="t('statistics.behavior.usageCount')" />
            <el-table-column prop="totalTokens" :label="t('statistics.behavior.totalTokens')">
              <template #default="{ row }">
                {{ formatNumber(row.totalTokens) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBehaviorStatistics, type BehaviorStatistics } from '@/api/statistics'
import { useDarkModeStore } from '@/stores/darkMode'
import { useApiError } from '@/composables/useApiError'
import { useChartConfig } from '@/composables/useChartConfig'
// 2026-06-24 优化：echarts 改为按需动态加载，首屏不再打包 echarts 库
import { loadEcharts } from '@/utils/echarts-lazy'
import type { ECharts } from '@/utils/echarts'

const { t } = useI18n()

const props = defineProps<{
  timeRange: 'today' | 'week' | 'month' | 'all'
}>()

const darkModeStore = useDarkModeStore()
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const { getChartColors, getBaseChartOption, getXAxisConfig, getYAxisConfig } = useChartConfig()
const data = ref<BehaviorStatistics | null>(null)
const hourChartRef = ref<HTMLDivElement | null>(null)
let hourChartInstance: ECharts | null = null

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  }
  return num.toString()
}

const formatDate = (date: string | null): string => {
  if (!date) return t('statistics.behavior.notLoggedIn')
  return new Date(date).toLocaleString('zh-CN')
}

const loadData = async () => {
  const res = await executeApi(() => getBehaviorStatistics({ type: props.timeRange }))
  if (res) {
    data.value = res
    await nextTick()
    renderHourChart()
  }
}

const renderHourChart = async () => {
  if (!hourChartRef.value || !data.value?.activeHours || data.value.activeHours.length === 0) {
    return
  }

  if (!hourChartInstance) {
    const echarts = await loadEcharts()
    hourChartInstance = echarts.init(hourChartRef.value)
  }

  const hours = Array.from({ length: 24 }, (_, i) => i.toString())
  const counts = Array.from({ length: 24 }, () => 0)

  data.value.activeHours.forEach(item => {
    counts[item.hour] = item.count
  })

  const colors = getChartColors.value

  const option = {
    ...getBaseChartOption(colors),
    xAxis: getXAxisConfig(colors, hours, t('statistics.behavior.hour')),
    yAxis: getYAxisConfig(colors, t('statistics.behavior.messageCount')),
    series: [
      {
        name: t('statistics.behavior.activity'),
        type: 'bar',
        data: counts,
        itemStyle: {
          color: colors.barColor,
        },
      },
    ],
  }

  hourChartInstance.setOption(option)
}

watch(
  () => props.timeRange,
  () => {
    loadData()
  }
)

// 监听暗色模式变化，重新渲染图表
watch(
  () => darkModeStore.isDarkMode,
  () => {
    if (hourChartInstance && data.value?.activeHours && data.value.activeHours.length > 0) {
      renderHourChart()
    }
  }
)

onMounted(() => {
  loadData()
})

// 窗口尺寸变化时自适应图表
const handleResize = () => {
  hourChartInstance?.resize()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  hourChartInstance?.dispose()
  hourChartInstance = null
})
</script>

<style scoped lang="scss">
.behavior-statistics {
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
        font-size: 20px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }
  }

  .chart-card,
  .agents-card {
    margin-top: 20px;
  }
}
</style>
