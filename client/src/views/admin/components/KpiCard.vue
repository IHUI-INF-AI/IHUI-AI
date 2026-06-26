<!--
  KPI 指标卡(子组件)
  在 admin/index.vue 中使用,展示数字 + 趋势 + 图标。
-->
<template>
  <article class="kpi-card" :class="`tone-${tone}`">
    <div class="kpi-icon">
      <el-icon aria-hidden="true">
        <component :is="icon" />
      </el-icon>
    </div>
    <div class="kpi-body">
      <div class="kpi-label">{{ label }}</div>
      <div class="kpi-value-row">
        <span class="kpi-value">{{ value }}</span>
        <span v-if="unit" class="kpi-unit">{{ unit }}</span>
      </div>
      <div class="kpi-trend" :class="trend > 0 ? 'up' : 'down'">
        <el-icon class="kpi-trend-icon" aria-hidden="true">
          <component :is="trend > 0 ? TrendUp : TrendDown" />
        </el-icon>
        <span>{{ Math.abs(trend) }}%</span>
        <span class="kpi-trend-period">{{ t('adminKpiCard.vsYesterday') }}</span>
      </div>
      <div v-if="description" class="kpi-desc">{{ description }}</div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { TrendCharts, Warning } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

interface Props {
  label: string
  value: string | number
  unit?: string
  trend: number
  icon: unknown
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  description?: string
}

withDefaults(defineProps<Props>(), {
  unit: '',
  tone: 'primary',
  description: '',
})

// 固定变量,避免模板内联
const { t } = useI18n()

const TrendUp = TrendCharts
const TrendDown = Warning
</script>

<style scoped lang="scss">
.kpi-card {
  display: flex;
  gap: 14px;
  padding: 20px 22px;
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}

.kpi-card:hover {
  
  border-color: var(--el-border-color);
}

.kpi-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--global-border-radius);
  background-color: color-mix(in srgb, currentcolor 12%, transparent);
  font-size: 24px;
  flex-shrink: 0;
}

.kpi-card.tone-primary { color: var(--el-color-primary); }
.kpi-card.tone-success { color: var(--el-color-success); }
.kpi-card.tone-warning { color: var(--el-color-warning); }
.kpi-card.tone-danger { color: var(--el-color-danger); }
.kpi-card.tone-info { color: var(--el-color-primary); }

.kpi-body {
  flex: 1;
  min-width: 0;
}

.kpi-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  font-weight: 500;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 4px 0 6px;
}

.kpi-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.2;
  letter-spacing: 0.3px;
  font-variant-numeric: tabular-nums;
}

.kpi-unit {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.kpi-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 500;
  color: currentcolor;
  opacity: 0.9;
}

.kpi-trend.up { color: var(--el-color-success); }
.kpi-trend.down { color: var(--el-color-danger); }

.kpi-trend-icon {
  font-size: 12px;
}

.kpi-trend-period {
  color: var(--el-text-color-secondary);
  font-weight: 400;
  margin-left: 2px;
}

.kpi-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}
</style>
