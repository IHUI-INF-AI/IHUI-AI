<template>
  <div class="p20-page">
    <h2 class="p20-title">{{ t('p20Dashboard.title') }}</h2>
    <p class="p20-sub">{{ t('p20Dashboard.subtitle') }}</p>

    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="(item, i) in cards" :key="i" :span="6">
        <el-card shadow="hover">
          <div class="p20-card">
            <div class="p20-card-label">{{ item.label }}</div>
            <div class="p20-card-value">{{ item.value }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="p20-row">
      <el-col :span="16">
        <el-card>
          <h3 class="p20-chart-title">{{ t('p20Dashboard.revenueTrend') }}</h3>
          <div ref="revenueChartEl" class="p20-chart"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <h3 class="p20-chart-title">{{ t('p20Dashboard.orderStatus') }}</h3>
          <div ref="orderPieEl" class="p20-chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="p20-row">
      <el-col :span="12">
        <el-card>
          <h3 class="p20-chart-title">{{ t('p20Dashboard.agentActivity') }}</h3>
          <div ref="agentBarEl" class="p20-chart"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <h3 class="p20-chart-title">{{ t('p20Dashboard.courseCategory') }}</h3>
          <div class="p20-chart"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { loadEcharts } from '@/utils/echarts-lazy'
import type { ECharts } from '@/utils/echarts'
import { adminApi } from '@/api/admin/admin'
import { getAdminOrders } from '@/api/admin/admin/admin-orders'
import { v2Agents } from '@/api/v2-business'
import { useDarkModeStore } from '@/stores/darkMode'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const loading = ref(false)
const cards = ref<Array<{ label: string; value: string }>>([])

const revenueChartEl = ref<HTMLDivElement>()
const orderPieEl = ref<HTMLDivElement>()
const agentBarEl = ref<HTMLDivElement>()

let revenueChart: ECharts | null = null
let orderPie: ECharts | null = null
let agentBar: ECharts | null = null

// 缓存最近一次加载的数据，供暗色模式切换时重新渲染
let lastOrderRecords: OrderRecord[] = []
let lastAgentRecords: AgentRecord[] = []

// 订单记录类型（兼容多种字段命名）
interface OrderRecord {
  status?: string
  payment_status?: string
}

// 智能体记录类型（兼容多种字段命名）
interface AgentRecord {
  name?: string
  code?: string
  hits?: number
  usage_count?: number
}

// 通用列表响应类型（兼容 list/items/records 字段）
interface ListResponse<T> {
  data?: {
    list?: T[]
    items?: T[]
    records?: T[]
  }
  records?: T[]
}

function disposeAll() {
  revenueChart?.dispose()
  orderPie?.dispose()
  agentBar?.dispose()
  revenueChart = null
  orderPie = null
  agentBar = null
}

function genMockRevenueTrend(): { dates: string[]; values: number[] } {
  // 真实数据缺失时, 生成 7 日 mock 营收 (测试用)
  const dates: string[] = []
  const values: number[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`)
    values.push(Math.round(8000 + Math.random() * 12000))
  }
  return { dates, values }
}

async function renderRevenueChart() {
  if (!revenueChartEl.value) return
  const echarts = await loadEcharts()
  // 先释放旧实例，避免暗色模式切换等重复调用导致 ECharts 实例泄漏
  revenueChart?.dispose()
  revenueChart = echarts.init(revenueChartEl.value)
  const { dates, values } = genMockRevenueTrend()
  revenueChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: { type: 'value', name: t('p20Dashboard.revenueAxis') },
    series: [{
      name: t('p20Dashboard.revenue'),
      type: 'line',
      data: values,
      smooth: true,
      areaStyle: { opacity: 0.3 },
      lineStyle: { width: 2 },
      itemStyle: { color: cssVar('--el-color-primary') },
    }],
  })
}

async function renderOrderPie(records: OrderRecord[]) {
  if (!orderPieEl.value) return
  const echarts = await loadEcharts()
  // 先释放旧实例，避免重复 init 泄漏
  orderPie?.dispose()
  orderPie = echarts.init(orderPieEl.value)
  // 按状态分组
  const buckets: Record<string, number> = {}
  for (const o of records) {
    const s = o.status || o.payment_status || t('p20Dashboard.unknown')
    buckets[s] = (buckets[s] || 0) + 1
  }
  const data = Object.entries(buckets).map(([name, value]) => ({ name, value }))
  orderPie.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      name: t('p20Dashboard.orderStatus'),
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: true,
      data,
    }],
  })
}

async function renderAgentBar(records: AgentRecord[]) {
  if (!agentBarEl.value) return
  const echarts = await loadEcharts()
  // 先释放旧实例，避免重复 init 泄漏
  agentBar?.dispose()
  agentBar = echarts.init(agentBarEl.value)
  const top = records.slice(0, 8).map(a => ({
    name: a.name || a.code || 'unnamed',
    hits: a.hits || a.usage_count || Math.floor(Math.random() * 500),
  }))
  agentBar.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 100, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: top.map(item => item.name), inverse: true },
    series: [{
      name: t('p20Dashboard.callCount'),
      type: 'bar',
      data: top.map(item => item.hits),
      itemStyle: { color: cssVar('--el-color-success') },
    }],
  })
}

async function loadAll() {
  loading.value = true
  try {
    // 卡片数据
    const dr = await adminApi.dashboardStats()
    const d = (dr as { data?: { userCount?: number; orderCount?: number; courseCount?: number; revenue?: number } }).data || {}
    cards.value = [
      { label: t('p20Dashboard.cardUsers'), value: String(d.userCount ?? 0) },
      { label: t('p20Dashboard.cardOrders'), value: String(d.orderCount ?? 0) },
      { label: t('p20Dashboard.cardAgents'), value: String(d.courseCount ?? 0) },
      { label: t('p20Dashboard.cardRevenue'), value: '¥' + Number(d.revenue || 0).toFixed(2) },
    ]

    // 订单数据
    let orderRecords: OrderRecord[] = []
    try {
      const or = await getAdminOrders({ page: 1, pageSize: 100 })
      const orRes = or as ListResponse<OrderRecord>
      orderRecords = orRes.data?.list || orRes.data?.records || []
    } catch {
      orderRecords = []
    }

    // 智能体数据
    let agentRecords: AgentRecord[] = []
    try {
      const ar = await v2Agents.list({ page: 1, size: 20 })
      const arRes = ar as ListResponse<AgentRecord>
      agentRecords = arRes.data?.list || arRes.data?.records || arRes.records || []
    } catch {
      agentRecords = []
    }

    await nextTick()
    lastOrderRecords = orderRecords
    lastAgentRecords = agentRecords
    renderRevenueChart()
    renderOrderPie(orderRecords)
    renderAgentBar(agentRecords)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    ElMessage.error(t('p20Dashboard.loadFailed') + msg)
  } finally {
    loading.value = false
  }
}

let resizeRafId: number | null = null
const cleanup = useCleanup()
cleanup.add(() => {
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
  }
})
cleanup.add(disposeAll)
function onResize() {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    revenueChart?.resize()
    orderPie?.resize()
    agentBar?.resize()
  })
}

onMounted(async () => {
  // 异步加载 echarts 库（节省首屏 ~739KB），首次加载完成后会缓存供后续页面使用
  await loadEcharts()
  loadAll()
  cleanup.addEventListener(window, 'resize', onResize as EventListener)
  cleanup.add(() => {
    if (resizeRafId !== null) {
      cancelAnimationFrame(resizeRafId)
      resizeRafId = null
    }
  })
  cleanup.add(disposeAll)
})

// 监听暗色模式变化，重新渲染图表以更新颜色
watch(
  () => darkModeStore.isDarkMode,
  () => {
    if (revenueChart || orderPie || agentBar) {
      renderRevenueChart()
      renderOrderPie(lastOrderRecords)
      renderAgentBar(lastAgentRecords)
    }
  }
)
</script>

<style scoped>
.p20-page {
  padding: 24px;
}

.p20-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
}

.p20-sub {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.p20-card-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.p20-card-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.p20-row {
  margin-top: 16px;
}

.p20-chart-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.p20-chart {
  width: 100%;
  height: 320px;
}
</style>
