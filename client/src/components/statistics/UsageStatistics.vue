<template>
  <div class="usage-statistics">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 200px" />
      </template>
      <template #default>
        <!-- 使用概览 -->
        <el-card shadow="hover" class="overview-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('statistics.usage.overview') }}</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.chatSessions') }}</div>
                <div class="stat-value">
                  {{ data?.chat?.totalSessions || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.messageCount') }}</div>
                <div class="stat-value">
                  {{ data?.chat?.totalMessages || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.tokenUsage') }}</div>
                <div class="stat-value">
                  {{ formatNumber(data?.chat?.totalTokens || 0) }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.uploadedFiles') }}</div>
                <div class="stat-value">{{ data?.files?.totalFiles || 0 }}</div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <!-- 使用趋势图 -->
        <el-card shadow="hover" class="chart-card" v-if="data?.trends && data.trends.length > 0">
          <template #header>
            <div class="card-header">
              <span>{{ t('statistics.usage.trends') }}</span>
            </div>
          </template>
          <div ref="chartRef" style="height: 300px"></div>
        </el-card>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { getUsageStatistics, type UsageStatistics } from '@/api/statistics'
import { useDarkModeStore } from '@/stores/darkMode'
import { useApiError } from '@/composables/useApiError'
import { useChartConfig } from '@/composables/useChartConfig'
import { useCleanup } from '@/composables/useCleanup'
// 2026-06-24 优化：echarts 改为按需动态加载，首屏不再打包 echarts 库
import { loadEcharts } from '@/utils/echarts-lazy'
import type { ECharts } from '@/utils/echarts'

const { t } = useI18n()

const props = defineProps<{
  timeRange: 'today' | 'week' | 'month' | 'all'
  customDateRange?: [string, string] | null
}>()

const darkModeStore = useDarkModeStore()
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const { getChartColors, getBaseChartOption, getXAxisConfig, getYAxisConfig } = useChartConfig()
const data = ref<UsageStatistics | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: ECharts | null = null

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  }
  return num.toString()
}

const loadData = async () => {
  const params: Record<string, unknown> = {
    type: props.timeRange,
  }

  if (props.customDateRange) {
    params.startDate = props.customDateRange[0]
    params.endDate = props.customDateRange[1]
  }

  const res = await executeApi(() => getUsageStatistics(params))
  if (res) {
    data.value = res
    await nextTick()
    renderChart()
  }
}

const renderChart = async () => {
  if (!chartRef.value || !data.value?.trends || data.value.trends.length === 0) {
    return
  }

  if (!chartInstance) {
    const echarts = await loadEcharts()
    chartInstance = echarts.init(chartRef.value)
  }

  const colors = getChartColors.value

  const option = {
    ...getBaseChartOption(colors),
    legend: {
      data: [
        t('statistics.usage.sessions'),
        t('statistics.usage.messages'),
        t('statistics.usage.tokens'),
      ],
      textStyle: {
        color: colors.textColor,
      },
    },
    xAxis: getXAxisConfig(colors, data.value.trends.map(t => t.date)),
    yAxis: getYAxisConfig(colors),
    series: [
      {
        name: t('statistics.usage.sessions'),
        type: 'line',
        data: data.value.trends.map(t => t.sessions),
        itemStyle: {
          color: colors.lineColors?.[0],
        },
        lineStyle: {
          color: colors.lineColors?.[0],
        },
      },
      {
        name: t('statistics.usage.messages'),
        type: 'line',
        data: data.value.trends.map(t => t.messages),
        itemStyle: {
          color: colors.lineColors?.[1],
        },
        lineStyle: {
          color: colors.lineColors?.[1],
        },
      },
      {
        name: t('statistics.usage.tokens'),
        type: 'line',
        data: data.value.trends.map(t => t.tokens),
        itemStyle: {
          color: colors.lineColors?.[2],
        },
        lineStyle: {
          color: colors.lineColors?.[2],
        },
      },
    ],
  }

  chartInstance.setOption(option)
}

watch(
  () => [props.timeRange, props.customDateRange],
  () => {
    loadData()
  }
)

// 监听暗色模式变化，重新渲染图表
watch(
  () => darkModeStore.isDarkMode,
  () => {
    if (chartInstance && data.value?.trends && data.value.trends.length > 0) {
      renderChart()
    }
  }
)

onMounted(() => {
  loadData()
})

// 窗口尺寸变化时自适应图表
const handleResize = () => {
  chartInstance?.resize()
}

// 2026-06-25 修复 ESLint ihui/no-manual-cleanup: 改用 useCleanup.addEventListener + add
// 统一管理清理逻辑, 避免 onBeforeUnmount 中手写 removeEventListener/dispose
const cleanup = useCleanup()
onMounted(() => {
  cleanup.addEventListener(window, 'resize', handleResize)
  cleanup.add(() => {
    chartInstance?.dispose()
    chartInstance = null
  })
})
</script>

<style scoped lang="scss">
.usage-statistics {
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
        font-size: 28px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }
  }

  .chart-card {
    margin-top: 20px;
  }
}
</style>
