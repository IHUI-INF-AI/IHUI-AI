<template>
  <div class="stat-card">
    <div class="card-body">
      <div v-if="iconComp" class="icon-wrap" :style="iconStyle">
        <el-icon :size="20">
          <component :is="iconComp" />
        </el-icon>
      </div>
      <div class="text-wrap">
        <div class="title">{{ title }}</div>
        <div class="value">{{ value }}</div>
        <div
          v-if="typeof trend === 'number'"
          class="trend"
          :class="trendClass"
          :aria-label="trendAriaLabel"
          role="status"
        >
          <el-icon :size="14">
            <component :is="trendIcon" />
          </el-icon>
          <span>{{ Math.abs(trend) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import * as ElIcons from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    title: string
    value: string | number
    icon?: string
    trend?: number
    color?: string
  }>(),
  {
    icon: '',
    color: '',
  }
)

const { t } = useI18n()

const iconComp = computed<Component | null>(() => {
  if (!props.icon) return null
  return (ElIcons as Record<string, Component>)[props.icon] ?? null
})

const iconStyle = computed<Record<string, string>>(() => {
  const c = props.color || getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim() || '#409eff'
  return {
    color: c,
    backgroundColor: hexToRgba(c, 0.12),
  }
})

const trendIcon = computed(() => ((props.trend ?? 0) >= 0 ? ElIcons.ArrowUp : ElIcons.ArrowDown))
const trendClass = computed(() => ((props.trend ?? 0) >= 0 ? 'is-up' : 'is-down'))
const trendAriaLabel = computed(() =>
  (props.trend ?? 0) >= 0
    ? t('edu.profile.statTrendUp')
    : t('edu.profile.statTrendDown')
)

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return `rgba(37, 99, 235, ${alpha})`
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
</script>

<style scoped lang="scss">
:where(.stat-card) {
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  padding: 16px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: var(--color-white-50);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.06);
  }

  .card-body {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon-wrap {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text-wrap {
    flex: 1 1 auto;
    min-width: 0;
  }

  .title {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value {
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    line-height: 1.2;
  }

  .trend {
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: 500;

    &.is-up {
      color: var(--color-green-16a34a);
    }

    &.is-down {
      color: var(--color-red-ef4444);
    }
  }
}
</style>
