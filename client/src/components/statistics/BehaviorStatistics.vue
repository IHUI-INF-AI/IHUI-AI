<template>
  <div class="behavior-statistics">
    <el-skeleton :loading="loading" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 200px" />
      </template>
      <template #default>
        <!-- 行为概览 -->
        <Card class="overview-card transition-shadow hover:shadow-md">
          <CardHeader>
            <div class="card-header">
              <span>{{ t('statistics.behavior.overview') }}</span>
            </div>
          </CardHeader>
          <CardContent>
          <div class="flex flex-wrap gap-5">
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.behavior.loginDays') }}</div>
                <div class="stat-value">{{ data?.login?.loginDays || 0 }}</div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.behavior.totalLoginCount') }}</div>
                <div class="stat-value">
                  {{ data?.login?.totalLoginCount || 0 }}
                </div>
              </div>
            </div>
            <div class="w-full sm:w-1/2 md:w-1/4">
              <div class="stat-item">
                <div class="stat-label">{{ t('statistics.behavior.lastLoginTime') }}</div>
                <div class="stat-value">
                  {{ formatDate(data?.login?.lastLoginTime) }}
                </div>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        <!-- 活跃时段 -->
        <Card
          class="chart-card transition-shadow hover:shadow-md"
          v-if="data?.activeHours && data.activeHours.length > 0"
        >
          <CardHeader>
            <div class="card-header">
              <span>{{ t('statistics.behavior.activeHours') }}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div ref="hourChartRef" style="height: 300px"></div>
          </CardContent>
        </Card>

        <!-- 最常用智能体 -->
        <Card
          class="agents-card transition-shadow hover:shadow-md"
          v-if="data?.favoriteAgents && data.favoriteAgents.length > 0"
        >
          <CardHeader>
            <div class="card-header">
              <span>{{ t('statistics.behavior.favoriteAgents') }}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('statistics.behavior.botId') }}</TableHead>
                  <TableHead>{{ t('statistics.behavior.usageCount') }}</TableHead>
                  <TableHead>{{ t('statistics.behavior.totalTokens') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, index) in data.favoriteAgents" :key="row.botId ?? index">
                  <TableCell>{{ row.botId }}</TableCell>
                  <TableCell>{{ row.usageCount }}</TableCell>
                  <TableCell>{{ formatNumber(row.totalTokens) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBehaviorStatistics, type BehaviorStatistics } from '@/api/statistics'
import { useDarkModeStore } from '@/stores/darkMode'
import { useApiError } from '@/composables/useApiError'
import { useChartConfig } from '@/composables/useChartConfig'
// 按需加载echarts，减少初始包体积
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

// 注册所需组件
echarts.use([BarChart, TitleComponent, TooltipComponent, GridComponent, CanvasRenderer])

const { t } = useI18n()

const props = defineProps<{
  timeRange: 'today' | 'week' | 'month' | 'all'
}>()

const darkModeStore = useDarkModeStore()
const { loading, execute: executeApi } = useApiError({ showMessage: false })
const { getChartColors, getBaseChartOption, getXAxisConfig, getYAxisConfig } = useChartConfig()
const data = ref<BehaviorStatistics | null>(null)
const hourChartRef = ref<HTMLDivElement | null>(null)
let hourChartInstance: echarts.ECharts | null = null

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

const renderHourChart = () => {
  if (!hourChartRef.value || !data.value?.activeHours || data.value.activeHours.length === 0) {
    return
  }

  if (!hourChartInstance) {
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
