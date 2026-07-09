<template>
  <div class="usage-statistics">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 200px" />
      </template>
      <template #default>
        <!-- 使用概览 -->
        <Card class="overview-card transition-shadow hover:shadow-md">
          <CardHeader>
            <div class="card-header">
              <span>{{ t('statistics.usage.overview') }}</span>
            </div>
          </CardHeader>
          <CardContent>
          <div class="flex flex-wrap gap-5">
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.chatSessions') }}</div>
                <div class="stat-value">
                  {{ data?.chat?.totalSessions || 0 }}
                </div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.messageCount') }}</div>
                <div class="stat-value">
                  {{ data?.chat?.totalMessages || 0 }}
                </div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.tokenUsage') }}</div>
                <div class="stat-value">
                  {{ formatNumber(data?.chat?.totalTokens || 0) }}
                </div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.usage.uploadedFiles') }}</div>
                <div class="stat-value">{{ data?.files?.totalFiles || 0 }}</div>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        <!-- 使用趋势图 -->
        <Card class="chart-card transition-shadow hover:shadow-md" v-if="data?.trends && data.trends.length > 0">
          <CardHeader>
            <div class="card-header">
              <span>{{ t('statistics.usage.trends') }}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div ref="chartRef" style="height: 300px"></div>
          </CardContent>
        </Card>
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
// 按需加载echarts，减少初始包体积
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

// 注册所需组件
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
])

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
let chartInstance: echarts.ECharts | null = null

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

const renderChart = () => {
  if (!chartRef.value || !data.value?.trends || data.value.trends.length === 0) {
    return
  }

  if (!chartInstance) {
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
        color: hsl(var(--muted-foreground));
        margin-bottom: 10px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: hsl(var(--foreground));
      }
    }
  }

  .chart-card {
    margin-top: 20px;
  }
}
</style>
