<template>
  <div class="order-statistics">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 200px" />
      </template>
      <template #default>
        <!-- 订单概览 -->
        <Card class="overview-card transition-shadow hover:shadow-md">
          <CardHeader>
            <div class="card-header">
              <span>{{ t('statistics.orders.overview') }}</span>
            </div>
          </CardHeader>
          <CardContent>
          <div class="flex flex-wrap gap-5">
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.totalOrders') }}</div>
                <div class="stat-value">
                  {{ data?.summary?.totalOrders || 0 }}
                </div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.totalAmount') }}</div>
                <div class="stat-value">¥{{ (data?.summary?.totalAmount || 0) / 100 }}</div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.paidOrders') }}</div>
                <div class="stat-value">
                  {{ data?.summary?.paidOrders || 0 }}
                </div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.completedOrders') }}</div>
                <div class="stat-value">
                  {{ data?.summary?.completedOrders || 0 }}
                </div>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        <!-- 订单趋势图 -->
        <Card class="chart-card transition-shadow hover:shadow-md" v-if="data?.trends && data.trends.length > 0">
          <CardHeader>
            <div class="card-header">
              <span>{{ t('statistics.orders.trends') }}</span>
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
import { getOrderStatistics, type OrderStatistics } from '@/api/statistics'
import { useDarkModeStore } from '@/stores/darkMode'
import { useApiError } from '@/composables/useApiError'
import { useChartConfig } from '@/composables/useChartConfig'
// 按需加载echarts，减少初始包体积
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
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
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
])

const { t } = useI18n()

const props = defineProps<{
  timeRange: 'today' | 'week' | 'month' | 'all'
}>()

const darkModeStore = useDarkModeStore()
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const { getChartColors, getBaseChartOption, getXAxisConfig, getYAxisConfig } = useChartConfig()
const data = ref<OrderStatistics | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const loadData = async () => {
  const res = await executeApi(() => getOrderStatistics({ type: props.timeRange }))
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
      data: [t('statistics.orders.orderCount'), t('statistics.orders.orderAmount')],
      textStyle: {
        color: colors.textColor,
      },
    },
    xAxis: getXAxisConfig(colors, data.value.trends.map(t => t.date)),
    yAxis: [
      getYAxisConfig(colors, t('statistics.orders.orderCount')),
      getYAxisConfig(colors, t('statistics.orders.amountInYuan')),
    ],
    series: [
      {
        name: t('statistics.orders.orderCount'),
        type: 'bar',
        data: data.value.trends.map(t => t.count),
        itemStyle: {
          color: colors.barColor,
        },
      },
      {
        name: t('statistics.orders.orderAmount'),
        type: 'line',
        yAxisIndex: 1,
        data: data.value.trends.map(t => t.amount / 100),
        itemStyle: {
          color: colors.lineColor,
        },
        lineStyle: {
          color: colors.lineColor,
        },
      },
    ],
  }

  chartInstance.setOption(option)
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
.order-statistics {
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
        font-size: 24px;
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
