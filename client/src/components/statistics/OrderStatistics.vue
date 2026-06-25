<template>
  <div class="order-statistics">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 200px" />
      </template>
      <template #default>
        <!-- 订单概览 -->
        <el-card shadow="hover" class="overview-card">
          <template #header>
            <div class="card-header">
              <span>{{ t('statistics.orders.overview') }}</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.totalOrders') }}</div>
                <div class="stat-value">
                  {{ data?.summary?.totalOrders || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.totalAmount') }}</div>
                <div class="stat-value">¥{{ (data?.summary?.totalAmount || 0) / 100 }}</div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.paidOrders') }}</div>
                <div class="stat-value">
                  {{ data?.summary?.paidOrders || 0 }}
                </div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.orders.completedOrders') }}</div>
                <div class="stat-value">
                  {{ data?.summary?.completedOrders || 0 }}
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <!-- 订单趋势图 -->
        <el-card shadow="hover" class="chart-card" v-if="data?.trends && data.trends.length > 0">
          <template #header>
            <div class="card-header">
              <span>{{ t('statistics.orders.trends') }}</span>
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
import { getOrderStatistics, type OrderStatistics } from '@/api/statistics'
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
}>()

const darkModeStore = useDarkModeStore()
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const { getChartColors, getBaseChartOption, getXAxisConfig, getYAxisConfig } = useChartConfig()
const data = ref<OrderStatistics | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: ECharts | null = null

const loadData = async () => {
  const res = await executeApi(() => getOrderStatistics({ type: props.timeRange }))
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

  .chart-card {
    margin-top: 20px;
  }
}
</style>
