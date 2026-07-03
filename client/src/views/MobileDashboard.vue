<template>
  <div class="mobile-dashboard">
    <!-- 头部 -->
    <div class="dash-header">
      <h1 class="dash-title">{{ t('mobileDashboard.businessDashboard') }}</h1>
      <span class="dash-time">{{ lastUpdate }}</span>
    </div>

    <!-- 头条指标 (6 卡) -->
    <div class="headline-grid">
      <div
        v-for="(item, idx) in headline"
        :key="idx"
        class="headline-card"
      >
        <span class="headline-label">{{ item.label }}</span>
        <span class="headline-value">{{ formatValue(item.value, item.unit) }}</span>
        <span :class="['headline-delta', item.delta >= 0 ? 'up' : 'down']">
          {{ item.delta >= 0 ? '↑' : '↓' }} {{ Math.abs(item.delta * 100).toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- 7 日趋势 -->
    <div class="trend-card" v-if="trend.length">
      <div class="trend-header">
        <span class="trend-title">{{ t('mobileDashboard.orderTrend') }}</span>
      </div>
      <svg viewBox="0 0 320 100" preserveAspectRatio="none" class="trend-svg">
        <defs>
          <linearGradient id="mobileTrendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="trendStrokeColor" stop-opacity="0.15" />
            <stop offset="100%" :stop-color="trendStrokeColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="trendPath" fill="url(#mobileTrendGrad)" />
        <path :d="trendLine" fill="none" :stroke="trendStrokeColor" stroke-width="2" />
      </svg>
      <div class="trend-labels">
        <span v-for="p in trend" :key="p.date" class="trend-label">
          {{ p.date.slice(5) }}
        </span>
      </div>
    </div>

    <!-- 业务预测 -->
    <div class="forecast-card">
      <div class="forecast-header">
        <span class="forecast-title">{{ t('mobileDashboard.forecast') }}</span>
        <select v-model="forecastMetric" class="forecast-select" @change="loadForecast">
          <option value="orders">{{ t('mobileDashboard.orders') }}</option>
          <option value="gmv_cents">GMV</option>
          <option value="dau">DAU</option>
          <option value="recharge_cents">{{ t('mobileDashboard.recharge') }}</option>
          <option value="agent_invocations">{{ t('mobileDashboard.agent') }}</option>
        </select>
      </div>
      <div v-if="forecast.predictions?.length" class="forecast-list">
        <div
          v-for="p in forecast.predictions"
          :key="p.date"
          class="forecast-row"
        >
          <span class="forecast-date">{{ p.date.slice(5) }}</span>
          <div class="forecast-bar-wrap">
            <div
              class="forecast-bar"
              :style="{ width: barWidth(p.value) + '%' }"
            ></div>
          </div>
          <span class="forecast-value">{{ formatValue(p.value, metricUnit) }}</span>
        </div>
      </div>
      <div v-if="forecast.model" class="forecast-meta">
        R²: {{ forecast.model.r2 }} · {{ t('mobileDashboard.slope') }}: {{ forecast.model.slope }} · {{ t('mobileDashboard.method') }}: {{ forecast.method }}
      </div>
    </div>

    <!-- 订阅入口 -->
    <div class="sub-card" @click="showSub = true">
      <span class="sub-icon">✉</span>
      <div class="sub-info">
        <span class="sub-title">{{ t('mobileDashboard.subscribeDaily') }}</span>
        <span class="sub-desc">{{ t('mobileDashboard.subscribeDesc') }}</span>
      </div>
      <span class="sub-arrow">→</span>
    </div>

    <!-- 订阅弹窗 -->
    <el-dialog v-model="showSub" :title="t('mobileDashboard.subscribeReport')" width="480px">
      <div class="sub-form">
        <div class="form-row">
          <span class="form-label">{{ t('mobileDashboard.email') }}</span>
          <input
            v-model="subEmail"
            type="email"
            class="form-input"
            placeholder="your@example.com"
          />
        </div>
        <div class="form-row">
          <span class="form-label">{{ t('mobileDashboard.frequency') }}</span>
          <select v-model="subFreq" class="form-input">
            <option value="daily">{{ t('mobileDashboard.daily') }}</option>
            <option value="weekly">{{ t('mobileDashboard.weekly') }}</option>
            <option value="monthly">{{ t('mobileDashboard.monthly') }}</option>
          </select>
        </div>
        <div class="form-row">
          <span class="form-label">{{ t('mobileDashboard.modules') }}</span>
          <div class="form-checks">
            <label v-for="s in sectionList" :key="s" class="form-check">
              <input
                type="checkbox"
                :checked="subSections.includes(s)"
                @change="toggleSection(s)"
              />
              <span>{{ s }}</span>
            </label>
          </div>
        </div>
        <div v-if="subs.length" class="sub-list">
          <span class="sub-list-title">{{ t('mobileDashboard.subscribed') }} ({{ subs.length }})</span>
          <div
            v-for="s in subs"
            :key="s.id"
            class="sub-item"
          >
            <span>{{ s.email }} · {{ freqLabel(s.frequency) }}</span>
            <button class="sub-remove" aria-label="取消订阅" @click="unsubscribe(s.id)">×</button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showSub = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="subscribe">{{ t('mobileDashboard.subscribe') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useToast } from '@/composables/useToast'
import http from '@/utils/request'

interface Headline {
  label: string
  value: number
  unit: string
  delta: number
}

interface TrendPoint {
  date: string
  value: number
}

interface ForecastPoint {
  date: string
  value: number
  lower: number
  upper: number
}

const toast = useToast()
const lastUpdate = ref('--')
const headline = ref<Headline[]>([])
const trend = ref<TrendPoint[]>([])
const forecastMetric = ref('orders')
const forecast = ref<{ predictions?: ForecastPoint[] }>({ predictions: [] })
const showSub = ref(false)
const subEmail = ref('')
const subFreq = ref('daily')
const subSections = ref(['orders', 'users', 'wallet', 'agents', 'alerts'])
const subs = ref<unknown[]>([])

const sectionList = ['orders', 'users', 'wallet', 'agents', 'alerts']

const metricUnit = computed(() => {
  return {
    orders: '单',
    gmv_cents: '元',
    dau: '人',
    recharge_cents: '元',
    agent_invocations: '次',
  }[forecastMetric.value] || ''
})

const trendPath = computed(() => buildPath(trend.value, true))
const trendLine = computed(() => buildPath(trend.value, false))
const trendStrokeColor = computed(() => getComputedStyle(document.documentElement).getPropertyValue('--el-text-color-primary').trim() || '#000')

function buildPath(points: TrendPoint[], fill: boolean): string {
  if (!points.length) return ''
  const max = Math.max(...points.map((p) => p.value), 1)
  const min = Math.min(...points.map((p) => p.value), 0)
  const range = max - min || 1
  const w = 320
  const h = 100
  const step = w / Math.max(1, points.length - 1)
  let d = ''
  points.forEach((p, i) => {
    const x = i * step
    const y = h - ((p.value - min) / range) * h
    d += (i === 0 ? 'M' : 'L') + x + ',' + y
  })
  if (fill) d += ' L' + w + ',' + h + ' L0,' + h + ' Z'
  return d
}

function formatValue(value: number, unit: string): string {
  if (unit === '元' || unit === '次') {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) + ' ' + unit
  }
  return value.toLocaleString('zh-CN') + ' ' + unit
}

function freqLabel(f: string): string {
  return { daily: '每日', weekly: '每周', monthly: '每月' }[f] || f
}

function toggleSection(s: string) {
  const idx = subSections.value.indexOf(s)
  if (idx >= 0) subSections.value.splice(idx, 1)
  else subSections.value.push(s)
}

function barWidth(value: number): number {
  if (!forecast.value.predictions?.length) return 0
  const max = Math.max(...forecast.value.predictions.map((p: ForecastPoint) => p.upper))
  return Math.min(100, (value / max) * 100)
}

async function loadMobile() {
  try {
    const res = await http.get('/api/v1/dashboard/mobile') as {
      code?: number
      data?: { headline?: Headline[]; trend?: { orders_7d?: TrendPoint[] }; ts?: string }
    }
    if (res?.code === 0) {
      headline.value = res.data?.headline || []
      trend.value = res.data?.trend?.orders_7d || []
      lastUpdate.value = (res.data?.ts || '').slice(11, 16) || '--'
    }
  } catch (_e) {
    toast.error(t('mobileDashboard.loadFailed'))
  }
}

async function loadForecast() {
  try {
    const res = await http.get('/api/v1/dashboard/forecast', {
      params: { metric: forecastMetric.value, horizon_days: 7 },
    }) as { code?: number; data?: { predictions?: ForecastPoint[] } }
    if (res?.code === 0) {
      forecast.value = res.data as { predictions?: ForecastPoint[] }
    }
  } catch (_e) {
    toast.error(t('mobileDashboard.forecastLoadFailed'))
  }
}

async function loadSubs() {
  try {
    const res = await http.get('/api/v1/dashboard/subscriptions') as { code?: number; data?: unknown[] }
    if (res?.code === 0) subs.value = (res.data as unknown[]) || []
  } catch (_e) {
    // 静默
  }
}

async function subscribe() {
  if (!subEmail.value || !subEmail.value.includes('@')) {
    toast.error(t('mobileDashboard.invalidEmail'))
    return
  }
  try {
    const res = await http.post('/api/v1/dashboard/subscriptions', {
      email: subEmail.value,
      frequency: subFreq.value,
      sections: subSections.value,
    }) as { code?: number }
    if (res?.code === 0) {
      toast.success(t('mobileDashboard.subscribeSuccess'))
      subEmail.value = ''
      showSub.value = false
      loadSubs()
    } else {
      toast.error(t('mobileDashboard.subscribeFailed'))
    }
  } catch (_e) {
    toast.error(t('mobileDashboard.subscribeFailed'))
  }
}

async function unsubscribe(id: string) {
  try {
    const res = await http.delete(`/api/v1/dashboard/subscriptions/${id}`) as { code?: number }
    if (res?.code === 0) {
      toast.success(t('mobileDashboard.unsubscribed'))
      loadSubs()
    }
  } catch (_e) {
    toast.error(t('mobileDashboard.unsubscribeFailed'))
  }
}

onMounted(() => {
  loadMobile()
  loadForecast()
  loadSubs()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables' as v;

$text-sec: var(--el-text-color-secondary);
$text-main: var(--el-text-color-primary);
$brand-primary: v.$primary-color;

.mobile-dashboard {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dash-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px;

  .dash-title {
    font-size: 20px;
    font-weight: 800;
    margin: 0;
    color: $text-main;
  }

  .dash-time {
    font-size: 11px;
    color: $text-sec;
  }
}

.headline-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.headline-card {
  padding: 14px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  gap: 4px;

  .headline-label {
    font-size: 11px;
    color: $text-sec;
  }

  .headline-value {
    font-size: 20px;
    font-weight: 800;
    color: $text-main;
    font-variant-numeric: tabular-nums;
  }

  .headline-delta {
    font-size: 11px;
    font-weight: 700;

    &.up { color: var(--el-color-success); }
    &.down { color: var(--el-color-danger); }
  }
}

.trend-card,
.forecast-card,
.sub-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 14px;
}

.trend-header,
.forecast-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.trend-title,
.forecast-title {
  font-size: 13px;
  font-weight: 800;
  color: $text-main;
}

.forecast-select {
  height: 26px;
  padding: 0 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  background: var(--el-bg-color);
}

.trend-svg {
  width: 100%;
  height: 100px;
}

.trend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 10px;
  color: $text-sec;
}

.forecast-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.forecast-row {
  display: grid;
  grid-template-columns: 50px 1fr 80px;
  align-items: center;
  gap: 8px;

  .forecast-date {
    font-size: 12px;
    color: $text-sec;
  }

  .forecast-bar-wrap {
    height: 8px;
    background: var(--el-border-color-lighter);
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }

  .forecast-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--el-text-color-primary), var(--el-text-color-regular));
    border-radius: var(--global-border-radius);
    transition: width 0.3s;
  }

  .forecast-value {
    font-size: 12px;
    font-weight: 700;
    color: $text-main;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}

.forecast-meta {
  font-size: 10px;
  color: $text-sec;
  margin-top: 8px;
  text-align: center;
}

.sub-card {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--color-black-2);
  }
}

.sub-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
  background: #1a1a1a;
  color: #fff; // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
  /* stylelint-enable color-no-hex */

  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;

  html.dark & {
    /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
    background: #fff;
    color: #1a1a1a;
    /* stylelint-enable color-no-hex */

  }
}

.sub-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .sub-title {
    font-size: 14px;
    font-weight: 700;
    color: $text-main;
  }

  .sub-desc {
    font-size: 11px;
    color: $text-sec;
  }
}

.sub-arrow {
  font-size: 18px;
  color: $text-sec;
}

.sub-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .form-label {
    font-size: 12px;
    color: $text-sec;
    font-weight: 600;
  }

  .form-input {
    height: 32px;
    padding: 0 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 13px;
    background: var(--el-bg-color);
    outline: none;

    &:focus {
      border-color: var(--border-unified-color-hover);
    }
  }

  .form-checks {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .form-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: $text-main;
  }
}

.sub-list {
  border-top: var(--unified-border);
  padding-top: 12px;

  .sub-list-title {
    font-size: 12px;
    color: $text-sec;
    font-weight: 600;
    margin-bottom: 8px;
  }
}

.sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--color-black-3);
  border-radius: var(--global-border-radius);
  margin-bottom: 4px;
  font-size: 12px;
}

.sub-remove {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: $text-sec;
  cursor: pointer;

  &:hover {
    background: var(--el-color-danger);
    color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
  }
}
</style>
