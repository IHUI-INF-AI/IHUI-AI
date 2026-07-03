<template>
  <div class="bi-dashboard" role="main" aria-labelledby="bi-dashboard-title">
    <!-- 顶部：标题 + 摘要 -->
    <header class="bi-header glass scroll-reveal" data-animation="fadeInUp">
      <div class="bi-header-text">
        <h1 id="bi-dashboard-title" class="bi-title">{{ t('biDashboard.title') }}</h1>
        <p class="bi-subtitle">{{ t('biDashboard.subtitle') }}</p>
      </div>
      <div
        v-if="anomalyMeta"
        class="bi-summary"
        role="status"
        aria-live="polite"
      >
        <span class="bi-summary-num">{{ anomalyMeta.count }}</span>
        <span class="bi-summary-label">{{ t('biDashboard.anomalyLabel', { days: anomalyMeta.days }) }}</span>
      </div>
    </header>

    <!-- 配置区：指标 + 维度 + 范围 -->
    <section
      class="bi-config glass scroll-reveal"
      data-animation="fadeInUp"
      aria-labelledby="bi-config-title"
    >
      <h2 id="bi-config-title" class="bi-section-title">{{ t('biDashboard.configTitle') }}</h2>
      <div class="bi-config-grid">
        <div class="bi-field">
          <label for="bi-metric" class="bi-label">{{ t('biDashboard.metric') }}</label>
          <select
            id="bi-metric"
            v-model="form.metric"
            class="bi-select"
            :aria-label="t('biDashboard.selectMetric')"
            @change="onConfigChange"
          >
            <option v-for="m in metrics" :key="m.name" :value="m.name">
              {{ m.label }} ({{ m.unit }})
            </option>
          </select>
        </div>

        <fieldset class="bi-field bi-fieldset">
          <legend class="bi-label">{{ t('biDashboard.dimensions') }}</legend>
          <div
            class="bi-checks"
            role="group"
            :aria-label="t('biDashboard.dimensionSelect')"
          >
            <label
              v-for="d in dimensions"
              :key="d.name"
              :class="['bi-check', { active: form.dimensions.includes(d.name) }]"
            >
              <input
                v-model="form.dimensions"
                type="checkbox"
                :value="d.name"
                class="bi-check-input sr-only"
                @change="onConfigChange"
              />
              <span aria-hidden="true">{{ d.label }}</span>
            </label>
          </div>
        </fieldset>

        <div class="bi-field">
          <label for="bi-days" class="bi-label">{{ t('biDashboard.timeRange') }}</label>
          <select
            id="bi-days"
            v-model.number="form.days"
            class="bi-select"
            :aria-label="t('biDashboard.timeRange')"
            @change="onConfigChange"
          >
            <option :value="7">{{ t('biDashboard.lastDays', { n: 7 }) }}</option>
            <option :value="14">{{ t('biDashboard.lastDays', { n: 14 }) }}</option>
            <option :value="30">{{ t('biDashboard.lastDays', { n: 30 }) }}</option>
            <option :value="60">{{ t('biDashboard.lastDays', { n: 60 }) }}</option>
            <option :value="90">{{ t('biDashboard.lastDays', { n: 90 }) }}</option>
          </select>
        </div>

        <div class="bi-field">
          <label for="bi-limit" class="bi-label">Top N</label>
          <select
            id="bi-limit"
            v-model.number="form.limit"
            class="bi-select"
            :aria-label="t('biDashboard.rowLimit')"
            @change="onConfigChange"
          >
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>

        <div class="bi-field bi-actions" role="group" :aria-label="t('biDashboard.execute')">
          <button
            type="button"
            class="bi-btn primary ripple-btn"
            :disabled="loading"
            :aria-disabled="loading"
            :aria-label="t('biDashboard.runReport')"
            @click="onRunReport"
          >
            <span class="btn-text">{{ loading ? t('biDashboard.executing') : t('biDashboard.runReport') }}</span>
            <span class="btn-glow" aria-hidden="true"></span>
          </button>
          <button
            type="button"
            class="bi-btn secondary ripple-btn"
            :aria-label="t('biDashboard.detectAnomaly')"
            @click="onRunAnomalies"
          >
            <span class="btn-text">{{ t('biDashboard.detectAnomaly') }}</span>
            <span class="btn-glow" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </section>

    <!-- 双栏：报表 + 异常归因 -->
    <div class="bi-columns">
      <!-- 左侧：报表结果 -->
      <section
        class="bi-report glass scroll-reveal"
        data-animation="fadeInUp"
        aria-labelledby="bi-report-title"
        :aria-busy="loading"
      >
        <header class="bi-panel-head">
          <h2 id="bi-report-title" class="bi-section-title">{{ t('biDashboard.reportResult') }}</h2>
          <span
            v-if="lastReport"
            class="bi-panel-meta"
            aria-live="polite"
          >{{ t('biDashboard.reportMeta', { total: lastReport.total, unit: lastReport.unit }) }}</span>
        </header>

        <div v-if="error" class="bi-state error" role="alert">
          <span aria-hidden="true">⚠</span> {{ error }}
        </div>
        <div v-else-if="!lastReport" class="bi-state" role="status">
          {{ t('biDashboard.selectPrompt') }}
        </div>
        <div v-else-if="lastReport.rows.length === 0" class="bi-state" role="status">
          {{ t('biDashboard.noData') }}
        </div>
        <div v-else class="bi-table-wrap">
          <table
            class="bi-table"
            role="table"
            :aria-label="t('biDashboard.reportData')"
          >
            <thead>
              <tr>
                <th
                  v-for="col in lastReport.columns"
                  :key="col"
                  scope="col"
                  :aria-sort="sortKey === col ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'"
                >
                  <button
                    type="button"
                    class="bi-th-btn"
                    :aria-label="t('biDashboard.sortBy', { col: colLabel(col) })"
                    @click="onSort(col)"
                  >
                    {{ colLabel(col) }}
                    <span v-if="sortKey === col" aria-hidden="true">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in lastReport.rows"
                :key="idx"
                :class="['bi-tr', { drillable: rowHasDimension(row) }]"
                :tabindex="rowHasDimension(row) ? 0 : -1"
                :role="rowHasDimension(row) ? 'button' : undefined"
                :aria-label="rowHasDimension(row) ? t('biDashboard.drilldown', { value: row[firstDimensionName(row)] }) : undefined"
                @click="onRowClick(row)"
                @keydown.enter.prevent="onRowClick(row)"
                @keydown.space.prevent="onRowClick(row)"
              >
                <td v-for="col in lastReport.columns" :key="col">
                  <template v-if="col === 'value'">
                    <span class="bi-value">{{ formatValue(row.value) }}</span>
                  </template>
                  <template v-else>
                    <span class="bi-cell">{{ row[col] }}</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 右侧：异常归因 -->
      <section
        class="bi-anomalies glass scroll-reveal"
        data-animation="fadeInUp"
        aria-labelledby="bi-anomalies-title"
      >
        <header class="bi-panel-head">
          <h2 id="bi-anomalies-title" class="bi-section-title">{{ t('biDashboard.anomalyAttribution') }}</h2>
          <span v-if="anomalyMeta" class="bi-panel-meta" aria-live="polite">
            Z > {{ anomalyMeta.z_threshold }}
          </span>
        </header>
        <div v-if="anomalies.length === 0" class="bi-state" role="status">
          {{ lastAnomalyCheck ? t('biDashboard.noAnomaly') : t('biDashboard.clickToDetect') }}
        </div>
        <ul v-else class="bi-anomaly-list" role="list">
          <li
            v-for="(a, i) in anomalies"
            :key="i"
            :class="['bi-anomaly-item', `sev-${a.severity}`]"
            role="article"
            :aria-label="t('biDashboard.anomalyAria', { date: a.date, direction: a.direction === 'up' ? t('biDashboard.up') : t('biDashboard.down'), severity: a.severity === 'critical' ? t('biDashboard.critical') : t('biDashboard.warning') })"
          >
            <div class="bi-anomaly-head">
              <span class="bi-anomaly-date">{{ a.date }}</span>
              <span :class="['bi-anomaly-badge', a.direction]" aria-hidden="true">
                {{ a.direction === 'up' ? '↑' : '↓' }} {{ formatValue(a.value) }}
              </span>
              <span :class="['bi-anomaly-sev', a.severity]" aria-hidden="true">
                {{ a.severity === 'critical' ? t('biDashboard.critical') : t('biDashboard.warning') }}
              </span>
            </div>
            <div class="bi-anomaly-body">
              <p class="bi-anomaly-line">
                <span class="bi-anomaly-label">{{ t('biDashboard.expected') }}</span>
                <span class="bi-anomaly-val">{{ formatValue(a.expected) }}</span>
                <span class="bi-anomaly-label">{{ t('biDashboard.zScore') }}</span>
                <span class="bi-anomaly-val">{{ a.z_score.toFixed(2) }}</span>
              </p>
              <p v-if="a.attribution.length" class="bi-anomaly-attr">
                <span class="bi-anomaly-label">{{ t('biDashboard.attribution') }}</span>
                <span
                  v-for="(attr, j) in a.attribution"
                  :key="j"
                  class="bi-anomaly-chip"
                >
                  {{ attr.label }} · {{ attr.top_value }} ({{ t('biDashboard.contribution') }} {{ formatValue(attr.contribution) }})
                </span>
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- 下钻面板 -->
    <DrilldownPanel
      v-if="lastDrilldown"
      :data="lastDrilldown"
      @close="lastDrilldown = null"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBi, type BiReportRequest, type BiReportRow } from '@/composables/useBi'
import { useA11y } from '@/composables/useA11y'
import DrilldownPanel from '@/components/bi/DrilldownPanel.vue'

const { t } = useI18n()

const {
  metrics,
  dimensions,
  lastReport,
  lastDrilldown,
  anomalies,
  anomalyMeta,
  loading,
  error,
  fetchMetrics,
  fetchDimensions,
  runReport,
  drilldown,
  fetchAnomalies,
} = useBi()

const { announce } = useA11y()

const form = ref<BiReportRequest>({
  metric: 'orders',
  dimensions: ['channel'],
  filters: [],
  days: 7,
  limit: 50,
  order_by: 'value',
  order_dir: 'desc',
})

const sortKey = ref<string>('value')
const sortDir = ref<'asc' | 'desc'>('desc')
const lastAnomalyCheck = ref(false)

const dimLabelMap = computed(() => {
  const m: Record<string, string> = { date: t('biDashboard.dimDate'), value: t('biDashboard.dimValue') }
  for (const d of dimensions.value) m[d.name] = d.label
  return m
})

const colLabel = (col: string) => dimLabelMap.value[col] || col

const onConfigChange = () => {
  // 维度变化时自动重置排序
  sortKey.value = 'value'
  sortDir.value = 'desc'
}

const formatValue = (v: number) => {
  if (typeof v !== 'number') return v
  if (Math.abs(v) >= 10000) return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

const onRunReport = async () => {
  const result = await runReport({ ...form.value, order_by: sortKey.value as 'value' | 'date', order_dir: sortDir.value })
  if (result) {
    announce(t('biDashboard.reportSuccess', { total: result.total }), { politeness: 'polite' })
  } else {
    announce(t('biDashboard.reportFail'), { politeness: 'assertive' })
  }
}

const onRunAnomalies = async () => {
  lastAnomalyCheck.value = true
  const result = await fetchAnomalies(form.value.metric, form.value.days, 2.0)
  if (result) {
    announce(t('biDashboard.detectSuccess', { count: result.count }), { politeness: 'polite' })
  } else {
    announce(t('biDashboard.detectFail'), { politeness: 'assertive' })
  }
}

const onSort = (col: string) => {
  if (sortKey.value === col) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = col
    sortDir.value = 'desc'
  }
  form.value.order_by = sortKey.value as 'value' | 'date'
  form.value.order_dir = sortDir.value
  onRunReport()
}

const rowHasDimension = (row: BiReportRow) => {
  return form.value.dimensions.length > 0 && form.value.dimensions[0] in row
}

const firstDimensionName = (_row: BiReportRow): string => {
  return form.value.dimensions[0] || ''
}

const onRowClick = async (row: BiReportRow) => {
  const dim = form.value.dimensions[0]
  if (!dim) return
  const value = row[dim] as string
  if (!value) return
  const data = await drilldown(form.value.metric, dim, value, form.value.days)
  if (data) {
    announce(t('biDashboard.drilldownSuccess', { value, days: data.series.length }), { politeness: 'polite' })
  }
}

onMounted(async () => {
  try { await Promise.all([fetchMetrics(), fetchDimensions()]) } catch (e) { console.error(e) }
  // 自动运行一次默认报表
  onRunReport()
})
</script>

<style scoped lang="scss">
@layer components {
  // ---- 布局容器 ----
  .bi-dashboard {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: clamp(16px, 3vw, 32px);
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 2vw, 24px);
    color: var(--el-text-color-primary);
    background: transparent;
  }

  // ---- 玻璃态卡片（继承 .glass 全局） ----
  .bi-header,
  .bi-config,
  .bi-report,
  .bi-anomalies {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: clamp(16px, 2vw, 24px);
    box-shadow: var(--global-box-shadow);
  }

  // ---- 头部 ----
  .bi-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .bi-title {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 700;
    margin: 0;
    color: var(--el-text-color-primary);
  }

  .bi-subtitle {
    font-size: 14px;
    color: var(--el-text-color-regular);
    margin: 4px 0 0;
    opacity: 0.75;
  }

  .bi-summary {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
  }

  .bi-summary-num {
    font-size: 24px;
    font-weight: 700;
    color: var(--el-text-color-primary);
  }

  .bi-summary-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    opacity: 0.75;
  }

  // ---- 区块小标题 ----
  .bi-section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--el-text-color-primary);
  }

  .bi-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .bi-panel-meta {
    font-size: 12px;
    color: var(--el-text-color-regular);
    opacity: 0.75;
  }

  // ---- 配置区 ----
  .bi-config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }

  .bi-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .bi-fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }

  .bi-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .bi-select {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .bi-select:hover {
    border-color: var(--border-unified-color-hover);
  }

  .bi-checks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .bi-check {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }

  .bi-check:hover {
    border-color: var(--border-unified-color-hover);
  }

  .bi-check.active {
    /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
    background: #1a1a1a;
    color: #fff; // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
    /* stylelint-enable color-no-hex */

    border-color: transparent;

    html.dark & {
      /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
      background: #fff;
      color: #1a1a1a;
      /* stylelint-enable color-no-hex */

      border-color: transparent;
    }
  }

  .bi-actions {
    flex-flow: row wrap;
    align-items: flex-end;
    gap: 8px;
  }

  .bi-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    background: var(--el-bg-color);
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .bi-btn:hover:not(:disabled) {
    border-color: var(--border-unified-color-hover);
  }

  .bi-btn.primary {
    /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
    background: #1a1a1a;
    color: #fff; // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
    /* stylelint-enable color-no-hex */

    border-color: transparent;

    html.dark & {
      /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
      background: #fff;
      color: #1a1a1a;
      /* stylelint-enable color-no-hex */

      border-color: transparent;
    }
  }

  .bi-btn.secondary {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
  }

  .bi-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-text {
    position: relative;
    z-index: var(--z-base);
  }

  // ---- 双栏布局 ----
  .bi-columns {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: clamp(16px, 2vw, 24px);
  }

  // ---- 状态提示 ----
  .bi-state {
    padding: 24px;
    text-align: center;
    color: var(--el-text-color-primary);
    font-size: 14px;
    border: 1px dashed var(--border-unified-color);
    border-radius: var(--global-border-radius);
  }

  .bi-state.error {
    color: var(--el-text-color-primary);
    border: var(--unified-border);
    background: var(--el-fill-color-light);
    font-weight: 500;
  }

  .bi-state.error span[aria-hidden] {
    color: var(--el-color-danger);
    font-weight: 700;
  }

  // ---- 报表表格 ----
  .bi-table-wrap {
    overflow-x: auto;
  }

  .bi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .bi-table thead th {
    text-align: left;
    padding: 10px 12px;
    border-bottom: var(--unified-border-bottom);
    color: var(--el-text-color-regular);
    font-weight: 600;
    background: var(--el-bg-color);
  }

  .bi-th-btn {
    background: transparent;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .bi-table tbody td {
    padding: 10px 12px;
    border-bottom: var(--unified-border-bottom);
    color: var(--el-text-color-primary);
  }

  .bi-tr {
    transition: background-color 0.15s;
  }

  .bi-tr:hover {
    background: var(--el-fill-color-lighter);
  }

  .bi-tr.drillable {
    cursor: pointer;
  }

  .bi-tr:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
  }

  .bi-value {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .bi-cell {
    color: var(--el-text-color-primary);
  }

  // ---- 异常归因列表 ----
  .bi-anomaly-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 480px;
    overflow-y: auto;
  }

  .bi-anomaly-item {
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    padding: 12px 14px;
    background: var(--el-bg-color);
  }

  .bi-anomaly-item.sev-critical {
    border-color: var(--el-color-danger);
  }

  .bi-anomaly-item.sev-warning {
    border-color: var(--el-color-warning);
  }

  .bi-anomaly-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .bi-anomaly-date {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .bi-anomaly-badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: var(--global-border-radius);
    font-variant-numeric: tabular-nums;
  }

  .bi-anomaly-badge.up {
    background: var(--el-color-success);
    color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
  }

  .bi-anomaly-badge.down {
    background: var(--el-color-danger);
    color: var(--app-button-text-on-primary); // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色
  }

  .bi-anomaly-sev {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    color: var(--el-text-color-regular);
  }

  .bi-anomaly-sev.critical {
    border-color: var(--el-color-danger);
    color: var(--el-color-danger);
  }

  .bi-anomaly-sev.warning {
    border-color: var(--el-color-warning);
    color: var(--el-color-warning);
  }

  .bi-anomaly-line,
  .bi-anomaly-attr {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .bi-anomaly-label {
    color: var(--el-text-color-regular);
    opacity: 0.7;
  }

  .bi-anomaly-val {
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .bi-anomaly-chip {
    display: inline-block;
    padding: 2px 8px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-primary);
    font-size: 12px;
  }
}

// ---- 暗色模式适配 ----
:where(html.dark) :deep(.bi-table thead th) {
  background: var(--el-bg-color);
}

:where(html.dark) :deep(.bi-tr:hover) {
  background: var(--el-fill-color-light);
}

// ---- 响应式：窄屏折叠为单列 ----
@media (width <= 960px) {
  .bi-columns {
    grid-template-columns: 1fr;
  }
}
</style>
