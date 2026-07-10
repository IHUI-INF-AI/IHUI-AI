<template>
  <div class="visit-container">
    <!-- 日期范围筛选 -->
    <div class="head">
      <span class="filter-label">日期范围：</span>
      <div class="flex items-center gap-2">
        <Input
          type="date"
          size="small"
          v-model="dateRange[0]"
          placeholder="开始日期"
          @change="onDateChange"
        />
        <span class="text-muted-foreground">至</span>
        <Input
          type="date"
          size="small"
          v-model="dateRange[1]"
          placeholder="结束日期"
          @change="onDateChange"
        />
      </div>
      <Button variant="default" size="sm" @click="refreshAll">查询</Button>
      <Button variant="outline" size="sm" @click="setRecentDays(7)">近7天</Button>
      <Button variant="outline" size="sm" @click="setRecentDays(30)">近30天</Button>
    </div>

    <!-- 统计概览 -->
    <div class="stat-box">
      <div class="stat-card stat-pv">
        <div class="stat-icon"><View class="h-5 w-5" /></div>
        <div class="stat-info">
          <div class="stat-title">总浏览量 PV</div>
          <div class="stat-value">{{ statistics.pv || 0 }}</div>
        </div>
      </div>
      <div class="stat-card stat-uv">
        <div class="stat-icon"><User class="h-5 w-5" /></div>
        <div class="stat-info">
          <div class="stat-title">总访客数 UV</div>
          <div class="stat-value">{{ statistics.uv || 0 }}</div>
        </div>
      </div>
      <div class="stat-card stat-vv">
        <div class="stat-icon"><DataLine class="h-5 w-5" /></div>
        <div class="stat-info">
          <div class="stat-title">总访问次数 VV</div>
          <div class="stat-value">{{ statistics.vv || 0 }}</div>
        </div>
      </div>
      <div class="stat-card stat-ip">
        <div class="stat-icon"><LocationInformation class="h-5 w-5" /></div>
        <div class="stat-info">
          <div class="stat-title">IP 数</div>
          <div class="stat-value">{{ statistics.ipNum || statistics.ip || 0 }}</div>
        </div>
      </div>
    </div>

    <!-- 趋势图表 -->
    <div class="chart-row">
      <div class="chart-card">
        <div class="chart-header">浏览量趋势 (PV)</div>
        <div class="chart-canvas" ref="pvChartRef"></div>
      </div>
      <div class="chart-card">
        <div class="chart-header">访客数趋势 (UV)</div>
        <div class="chart-canvas" ref="uvChartRef"></div>
      </div>
    </div>

    <!-- 明细列表 -->
    <div class="list-section">
      <div class="list-header">
        <span>访问明细</span>
        <Input
          v-model="listParam.keyword"
          clearable
          size="small"
          placeholder="输入IP/路径搜索"
          class="list-search"
          @keyup.enter="searchList"
        />
        <Button variant="default" size="sm" @click="searchList"><Search />搜索</Button>
      </div>
      <div v-if="listLoading" class="loading-div">加载中...</div>
      <Table class="text-sm" style="width: 100%">
        <TableHeader>
          <TableRow>
            <TableHead class="w-[70px]">ID</TableHead>
            <TableHead class="w-[140px]">IP地址</TableHead>
            <TableHead class="w-[120px]">所在城市</TableHead>
            <TableHead class="min-w-[220px]">访问路径</TableHead>
            <TableHead class="min-w-[160px]">来源</TableHead>
            <TableHead class="min-w-[200px]">浏览器UA</TableHead>
            <TableHead class="w-[120px]">访问日期</TableHead>
            <TableHead class="w-[160px]">访问时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in list" :key="row.id ?? index">
            <TableCell>{{ row.id }}</TableCell>
            <TableCell>{{ row.ip }}</TableCell>
            <TableCell>{{ row.ipCityName || row.city || '-' }}</TableCell>
            <TableCell>{{ row.url }}</TableCell>
            <TableCell>{{ row.referer || '-' }}</TableCell>
            <TableCell>{{ row.userAgent || '-' }}</TableCell>
            <TableCell>{{ row.visitDate }}</TableCell>
            <TableCell>{{ row.createTime }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="listParam.size" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import Page from '@/components/Page/index.vue'
import { indexApi } from '@/api/edu/admin-api'
import { Search, View, User, DataLine, LocationInformation } from '@/lib/lucide-fallback'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'

const { getStatistics, getVisitList, getDayPvList, getDayUvList } = indexApi

// 日期工具：返回 N 天前的日期字符串 YYYY-MM-DD
const getDaysAgo = (day: number) => {
  const d = new Date()
  d.setTime(d.getTime() - day * 24 * 60 * 60 * 1000)
  const month = d.getMonth() + 1 < 10 ? '0' + (d.getMonth() + 1) : d.getMonth() + 1
  const date = d.getDate() < 10 ? '0' + d.getDate() : d.getDate()
  return d.getFullYear() + '-' + month + '-' + date
}

// 日期范围
const dateRange = ref<[string, string]>([getDaysAgo(7), getDaysAgo(0)])

const onDateChange = () => {
  refreshAll()
}
const setRecentDays = (days: number) => {
  dateRange.value = [getDaysAgo(days), getDaysAgo(0)]
  refreshAll()
}

// 统计概览
const statistics = ref<any>({})
const loadStatistics = () => {
  const params: any = {
    startDate: dateRange.value[0],
    endDate: dateRange.value[1]
  }
  getStatistics(
    params,
    (res: any) => {
      if (res) statistics.value = res
    },
    true
  )
}

// 明细列表
const list = ref<any[]>([])
const total = ref(0)
const listLoading = ref(true)
const listParam = ref({
  keyword: '',
  size: 20,
  current: 1,
  startDate: dateRange.value[0],
  endDate: dateRange.value[1]
})

const loadList = () => {
  listLoading.value = true
  listParam.value.startDate = dateRange.value[0]
  listParam.value.endDate = dateRange.value[1]
  getVisitList(
    listParam.value,
    (res: any) => {
      listLoading.value = false
      if (!res) return
      list.value = res.list || []
      total.value = res.total || 0
    },
    true
  )
}

const currentChange = (currentPage: number) => {
  listParam.value.current = currentPage
  loadList()
}
const sizeChange = (size: number) => {
  listParam.value.size = size
  loadList()
}
const searchList = () => {
  listParam.value.current = 1
  loadList()
}

// 图表
const pvChartRef = ref<HTMLElement | null>(null)
const uvChartRef = ref<HTMLElement | null>(null)
let pvChart: any = null
let uvChart: any = null

const renderPvChart = (xAxisData: string[], seriesData: number[]) => {
  if (!pvChartRef.value) return
  if (pvChart) {
    pvChart.dispose()
  }
  pvChart = echarts.init(pvChartRef.value)
  pvChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' },
    grid: { top: '12%', right: '5%', bottom: '18%', left: '8%' },
    series: [
      {
        name: '浏览量',
        data: seriesData,
        type: 'bar',
        barWidth: '40%',
        itemStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#7D83FF' }, { offset: 1, color: '#3D43C6' }] },
          borderRadius: [6, 6, 0, 0]
        }
      },
      {
        name: '趋势',
        data: seriesData,
        type: 'line',
        smooth: true,
        lineStyle: { color: '#FF6B81', width: 2 },
        itemStyle: { color: '#FF6B81' }
      }
    ]
  })
}

const renderUvChart = (xAxisData: string[], seriesData: number[]) => {
  if (!uvChartRef.value) return
  if (uvChart) {
    uvChart.dispose()
  }
  uvChart = echarts.init(uvChartRef.value)
  uvChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' },
    grid: { top: '12%', right: '5%', bottom: '18%', left: '8%' },
    series: [
      {
        name: '访客数',
        data: seriesData,
        type: 'bar',
        barWidth: '40%',
        itemStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#FF8A9B' }, { offset: 1, color: '#FF6B81' }] },
          borderRadius: [6, 6, 0, 0]
        }
      },
      {
        name: '趋势',
        data: seriesData,
        type: 'line',
        smooth: true,
        lineStyle: { color: '#5B8FF9', width: 2 },
        itemStyle: { color: '#5B8FF9' }
      }
    ]
  })
}

const loadTrend = () => {
  const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] }
  const pvXAxis: string[] = []
  const pvSeries: number[] = []
  getDayPvList(
    params,
    (res: any) => {
      if (res && res.length) {
        for (const item of res) {
          pvXAxis.push(item.visitDate)
          pvSeries.push(item.pv || 0)
        }
      }
      renderPvChart(pvXAxis, pvSeries)
    },
    true
  )
  const uvXAxis: string[] = []
  const uvSeries: number[] = []
  getDayUvList(
    params,
    (res: any) => {
      if (res && res.length) {
        for (const item of res) {
          uvXAxis.push(item.visitDate)
          uvSeries.push(item.uv || 0)
        }
      }
      renderUvChart(uvXAxis, uvSeries)
    },
    true
  )
}

// 刷新全部
const refreshAll = () => {
  loadStatistics()
  loadTrend()
  listParam.value.current = 1
  loadList()
}

// resize 处理
const handleResize = () => {
  pvChart && pvChart.resize()
  uvChart && uvChart.resize()
}

onMounted(async () => {
  await nextTick()
  refreshAll()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (pvChart && !pvChart.isDisposed()) pvChart.dispose()
  pvChart = null
  if (uvChart && !uvChart.isDisposed()) uvChart.dispose()
  uvChart = null
})
</script>

<style scoped lang="scss">
.visit-container {
  margin: 20px;
  .head {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    .filter-label {
      font-size: 14px;
      color: #606266;
      white-space: nowrap;
    }
  }
}

.stat-box {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  .stat-card {
    flex: 1;
    min-width: 220px;
    background: #fff;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    border: 1px solid #f0f0f0;
    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }
    .stat-info {
      flex: 1;
      .stat-title {
        font-size: 13px;
        color: #909399;
        margin-bottom: 6px;
      }
      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #303133;
      }
    }
  }
  .stat-pv .stat-icon {
    background: linear-gradient(135deg, #7f69ff 0%, #b8a9ff 100%);
  }
  .stat-uv .stat-icon {
    background: linear-gradient(135deg, #ff6b81 0%, #ffb3bd 100%);
  }
  .stat-vv .stat-icon {
    background: linear-gradient(135deg, #36d1dc 0%, #5bdeea 100%);
  }
  .stat-ip .stat-icon {
    background: linear-gradient(135deg, #f6a609 0%, #ffd66e 100%);
  }
}

.chart-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  .chart-card {
    flex: 1;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    .chart-header {
      padding: 14px 18px;
      font-size: 15px;
      font-weight: 500;
      color: #303133;
    }
    .chart-canvas {
      width: 100%;
      height: 300px;
    }
  }
}

.list-section {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  .list-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 500;
    color: #303133;
    .list-search {
      width: 260px;
      margin-left: auto;
    }
  }
}
</style>
