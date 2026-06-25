<template>
  <div class="security-charts">
    <div class="charts-header">
      <h3 class="charts-title">{{ t('settings.securityCharts.title') }}</h3>
      <div class="charts-period">
        <el-radio-group v-model="period" size="small" @change="handlePeriodChange">
          <el-radio-button value="7">{{ t('settings.securityCharts.days7') }}</el-radio-button>
          <el-radio-button value="30">{{ t('settings.securityCharts.days30') }}</el-radio-button>
          <el-radio-button value="90">{{ t('settings.securityCharts.days90') }}</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <h4>{{ t('settings.securityCharts.loginTrend') }}</h4>
        <div class="chart-container">
          <div class="line-chart">
            <div class="chart-y-axis">
              <span v-for="i in 5" :key="i">{{ (5 - i) * Math.ceil(maxLoginCount / 4) }}</span>
            </div>
            <div class="chart-area">
              <div class="chart-grid">
                <div v-for="i in 5" :key="i" class="grid-line"></div>
              </div>
              <svg class="chart-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  :points="loginLinePoints"
                  fill="none"
                  stroke="var(--el-color-primary)"
                  stroke-width="2"
                />
                <polygon
                  :points="loginAreaPoints"
                  fill="url(#gradient)"
                  opacity="0.3"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="var(--el-color-primary)" />
                    <stop offset="100%" stop-color="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div class="chart-x-axis">
            <span v-for="(label, lblIdx) in xLabels" :key="`lbl-${lblIdx}-${label}`">{{ label }}</span>
          </div>
        </div>
        <div class="chart-legend">
          <span class="legend-item">
            <span class="legend-dot success"></span>
            {{ t('settings.securityCharts.successful') }}: {{ successCount }}
          </span>
          <span class="legend-item">
            <span class="legend-dot danger"></span>
            {{ t('settings.securityCharts.failed') }}: {{ failedCount }}
          </span>
        </div>
      </div>

      <div class="chart-card">
        <h4>{{ t('settings.securityCharts.eventDistribution') }}</h4>
        <div class="pie-chart">
          <svg viewBox="0 0 100 100">
            <circle
              v-for="(segment, segIdx) in pieSegments"
              :key="`seg-${segIdx}-${segment.color}`"
              cx="50"
              cy="50"
              r="40"
              fill="none"
              :stroke="segment.color"
              stroke-width="20"
              :stroke-dasharray="segment.dashArray"
              :stroke-dashoffset="segment.offset"
              class="pie-segment"
            />
          </svg>
          <div class="pie-center">
            <span class="pie-total">{{ totalEvents }}</span>
            <span class="pie-label">{{ t('settings.securityCharts.totalEvents') }}</span>
          </div>
        </div>
        <div class="pie-legend">
          <div v-for="item in pieData" :key="`pie-${item.label}`" class="legend-row">
            <span class="legend-color" :style="{ backgroundColor: item.color }"></span>
            <span class="legend-text">{{ item.label }}</span>
            <span class="legend-value">{{ item.value }}</span>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <h4>{{ t('settings.securityCharts.deviceUsage') }}</h4>
        <div class="bar-chart">
          <div
            v-for="bar in deviceBars"
            :key="`bar-${bar.label}`"
            class="bar-item"
          >
            <div class="bar-label">{{ bar.label }}</div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: bar.percent + '%', backgroundColor: bar.color }"
              ></div>
            </div>
            <div class="bar-value">{{ bar.value }}</div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <h4>{{ t('settings.securityCharts.riskTimeline') }}</h4>
        <div class="timeline-chart">
          <div
            v-for="event in riskEvents"
            :key="`event-${event.timestamp}-${event.title}`"
            class="timeline-item"
            :class="event.level"
          >
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <span class="timeline-title">{{ event.title }}</span>
              <span class="timeline-time">{{ formatTime(event.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { SecurityLogService } from '@/utils/securityLogService'
import { MultiDeviceService } from '@/utils/multiDeviceService'
import { formatTime as _formatTime } from '@/utils/format'

const { t } = useI18n()

const period = ref('30')

interface DailyData {
  date: string
  success: number
  failed: number
}

const dailyData = ref<DailyData[]>([])
const maxLoginCount = ref(10)

const successCount = computed(() => {
  return dailyData.value.reduce((sum, d) => sum + d.success, 0)
})

const failedCount = computed(() => {
  return dailyData.value.reduce((sum, d) => sum + d.failed, 0)
})

const xLabels = computed(() => {
  const count = dailyData.value.length
  const step = Math.ceil(count / 7)
  return dailyData.value
    .filter((_, i) => i % step === 0 || i === count - 1)
    .map(d => d.date.slice(5))
})

const loginLinePoints = computed(() => {
  if (dailyData.value.length === 0) return '0,100'
  const points = dailyData.value.map((d, i) => {
    const x = (i / (dailyData.value.length - 1)) * 100
    const y = 100 - (d.success / maxLoginCount.value) * 100
    return `${x},${Math.max(0, Math.min(100, y))}`
  })
  return points.join(' ')
})

const loginAreaPoints = computed(() => {
  if (dailyData.value.length === 0) return '0,100 0,100'
  const linePoints = loginLinePoints.value
  return `0,100 ${linePoints} 100,100`
})

const pieData = computed(() => {
  const logs = SecurityLogService.getLogs()
  const counts: Record<string, number> = {}

  logs.forEach(log => {
    counts[log.type] = (counts[log.type] || 0) + 1
  })

  const colors: Record<string, string> = {
    login: 'var(--el-color-success)',
    logout: 'var(--el-color-info)',
    password_change: 'var(--el-color-warning)',
    device_remove: 'var(--el-color-primary)',
    suspicious_login: 'var(--el-color-danger)',
  }

  const labels: Record<string, string> = {
    login: t('settings.securityCharts.typeLogin'),
    logout: t('settings.securityCharts.typeLogout'),
    password_change: t('settings.securityCharts.typePassword'),
    device_remove: t('settings.securityCharts.typeDevice'),
    suspicious_login: t('settings.securityCharts.typeSuspicious'),
  }

  return Object.entries(counts)
    .map(([type, value]) => ({
      type,
      label: labels[type] || type,
      value,
      color: colors[type] || 'var(--el-color-primary-light-3)',
    }))
    .sort((a, b) => b.value - a.value)
})

const totalEvents = computed(() => {
  return pieData.value.reduce((sum, d) => sum + d.value, 0)
})

const pieSegments = computed(() => {
  if (totalEvents.value === 0) return []

  const circumference = 2 * Math.PI * 40
  let offset = 25

  return pieData.value.map(item => {
    const percent = item.value / totalEvents.value
    const dashArray = `${percent * circumference} ${circumference}`
    const segment = {
      color: item.color,
      dashArray,
      offset: -offset * circumference / 100,
    }
    offset += percent * 100
    return segment
  })
})

const deviceBars = computed(() => {
  const devices = MultiDeviceService.getLoginDevices()
  const total = devices.length || 1

  const colors = [
    'var(--el-color-primary)',
    'var(--el-color-success)',
    'var(--el-color-warning)',
    'var(--el-color-info)',
    'var(--el-color-danger)',
  ]

  return devices.slice(0, 5).map((device, index) => ({
    label: device.deviceName.slice(0, 15) + (device.deviceName.length > 15 ? '...' : ''),
    value: 1,
    percent: (1 / total) * 100,
    color: colors[index % colors.length],
  }))
})

const riskEvents = computed(() => {
  const logs = SecurityLogService.getLogs()
    .filter(l => l.type === 'suspicious_login' || !l.success)
    .slice(0, 5)

  return logs.map(log => ({
    title: log.type === 'suspicious_login'
      ? t('settings.securityCharts.suspiciousLogin')
      : t('settings.securityCharts.failedLogin'),
    timestamp: log.timestamp,
    level: log.type === 'suspicious_login' ? 'danger' : 'warning',
  }))
})

const formatTime = (timestamp: number) => _formatTime(timestamp, 'YYYY-MM-DD')

const handlePeriodChange = () => {
  loadData()
}

const loadData = () => {
  const days = parseInt(period.value)
  const logs = SecurityLogService.getLogs()
  const now = Date.now()
  const startTime = now - days * 24 * 60 * 60 * 1000

  const data: DailyData[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0]
    data.push({
      date: dateStr,
      success: 0,
      failed: 0,
    })
  }

  logs.forEach(log => {
    if (log.timestamp >= startTime) {
      const dateStr = new Date(log.timestamp).toISOString().split('T')[0]
      const dayData = data.find(d => d.date === dateStr)
      if (dayData) {
        if (log.success) {
          dayData.success++
        } else {
          dayData.failed++
        }
      }
    }
  })

  dailyData.value = data
  maxLoginCount.value = Math.max(10, ...data.map(d => d.success + d.failed))
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.security-charts {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.charts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .charts-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--el-text-color-primary);
  }
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 16px;
    color: var(--el-text-color-primary);
  }
}

.chart-container {
  height: 150px;
}

.line-chart {
  display: flex;
  height: 120px;

  .chart-y-axis {
    width: 30px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    text-align: right;
    padding-right: 8px;
  }

  .chart-area {
    flex: 1;
    position: relative;

    .chart-grid {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .grid-line {
        height: 1px;
        background: var(--el-border-color-lighter);
      }
    }

    .chart-line {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
  }
}

.chart-x-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 12px;

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.success { background: var(--el-color-success); }
      &.danger { background: var(--el-color-danger); }
    }
  }
}

.pie-chart {
  position: relative;
  width: 150px;
  height: 150px;
  margin: 0 auto 16px;

  svg {
    transform: rotate(-90deg);
  }

  .pie-segment {
    transition: stroke-dasharray 0.3s;
  }

  .pie-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;

    .pie-total {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: var(--el-text-color-primary);
    }

    .pie-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: var(--global-border-radius);
    }

    .legend-text {
      flex: 1;
      font-size: 13px;
      color: var(--el-text-color-primary);
    }

    .legend-value {
      font-size: 13px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }
  }
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 12px;

  .bar-label {
    width: 100px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    flex: 1;
    height: 8px;
    background: var(--el-fill-color);
    border-radius: var(--global-border-radius);
    overflow: hidden;

    .bar-fill {
      height: 100%;
      border-radius: var(--global-border-radius);
      transition: width 0.3s;
    }
  }

  .bar-value {
    width: 30px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    text-align: right;
  }
}

.timeline-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border-left: 3px solid var(--el-color-warning);

  &.danger {
    border-left-color: var(--el-color-danger);
  }

  .timeline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--el-color-warning);
  }

  &.danger .timeline-dot {
    background: var(--el-color-danger);
  }

  .timeline-content {
    flex: 1;

    .timeline-title {
      display: block;
      font-size: 13px;
      color: var(--el-text-color-primary);
    }

    .timeline-time {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }
}
</style>
