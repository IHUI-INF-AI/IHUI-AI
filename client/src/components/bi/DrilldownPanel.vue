<template>
  <div
    class="drilldown-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="drilldown-title"
    @click.self="$emit('close')"
  >
    <div class="drilldown-panel glass" role="document">
      <header class="drilldown-head">
        <div>
          <h2 id="drilldown-title" class="drilldown-title">
            {{ data.metric_label }} · {{ data.dimension }}={{ data.value }} {{ t('biDrilldown.detail') }}
          </h2>
          <p class="drilldown-sub">{{ t('biDrilldown.recent') }} {{ data.days }} {{ t('biDrilldown.days') }} · {{ t('biDrilldown.total') }} {{ formatNumber(data.total) }} {{ data.unit }}</p>
        </div>
        <button
          type="button"
          class="drilldown-close"
          aria-label="关闭下钻面板"
          @click="$emit('close')"
        >×</button>
      </header>

      <!-- 主体 series 趋势 -->
      <section class="drilldown-section" aria-labelledby="drilldown-series-title">
        <h3 id="drilldown-series-title" class="drilldown-section-title">{{ t('biDrilldown.dailyDetail') }}</h3>
        <ul class="drilldown-series" role="list">
          <li
            v-for="(p, i) in data.series"
            :key="i"
            class="drilldown-bar"
            role="listitem"
            :aria-label="`${p.date} ${formatNumber(p.value)} ${data.unit}`"
          >
            <span class="drilldown-bar-date">{{ p.date.slice(5) }}</span>
            <div class="drilldown-bar-track">
              <div
                class="drilldown-bar-fill"
                :style="{ width: barWidth(p.value) + '%' }"
              />
            </div>
            <span class="drilldown-bar-value">{{ formatNumber(p.value) }}</span>
          </li>
        </ul>
      </section>

      <!-- 子维度 Top -->
      <section class="drilldown-section" aria-labelledby="drilldown-subdim-title">
        <h3 id="drilldown-subdim-title" class="drilldown-section-title">{{ t('biDrilldown.subDimensionTop') }}</h3>
        <div
          v-for="sd in data.sub_dimensions"
          :key="sd.name"
          class="drilldown-subdim"
          role="region"
          :aria-label="sd.label"
        >
          <h4 class="drilldown-subdim-name">{{ sd.label }}</h4>
          <ol class="drilldown-top">
            <li
              v-for="(item, j) in sd.top"
              :key="j"
              class="drilldown-top-item"
            >
              <span class="drilldown-top-rank" aria-hidden="true">{{ Number(j) + 1 }}</span>
              <span class="drilldown-top-name">{{ item.name }}</span>
              <span class="drilldown-top-value">{{ formatNumber(item.value) }} {{ data.unit }}</span>
            </li>
          </ol>
        </div>
      </section>

      <footer class="drilldown-foot">
        <span class="drilldown-meta" aria-label="生成时间">
          {{ data.generated_at }}
        </span>
        <button
          type="button"
          class="drilldown-btn"
          aria-label="关闭下钻面板"
          @click="$emit('close')"
        >{{ t('common.close') }}</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BiDrilldownResult } from '@/composables/useBi'

const { t } = useI18n()

const props = defineProps<{
  data: BiDrilldownResult
}>()

defineEmits<{
  (e: 'close'): void
}>()

const maxValue = computed(() => {
  const list = props.data.series.map((s: { name: string; value: number }) => s.value)
  return list.length ? Math.max(...list) : 1
})

const barWidth = (v: number) => {
  if (maxValue.value <= 0) return 0
  return Math.min(100, Math.max(2, (v / maxValue.value) * 100))
}

const formatNumber = (v: number) => {
  if (typeof v !== 'number') return v
  if (Math.abs(v) >= 10000) return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
</script>

<style scoped lang="scss">
@layer components {
  .drilldown-overlay {
    position: fixed;
    inset: 0;
    background: var(--el-overlay-color);
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 3vw, 32px);
  }

  .drilldown-panel {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: var(--global-box-shadow);
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .drilldown-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 24px 12px;
    border-bottom: var(--unified-border-bottom);
  }

  .drilldown-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    color: var(--el-text-color-primary);
  }

  .drilldown-sub {
    font-size: 13px;
    color: var(--el-text-color-regular);
    margin: 4px 0 0;
    opacity: 0.75;
  }

  .drilldown-close {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    color: var(--el-text-color-primary);
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
    flex-shrink: 0;
  }

  .drilldown-close:hover {
    border-color: var(--border-unified-color-hover);
  }

  .drilldown-section {
    padding: 16px 24px;
    border-bottom: var(--unified-border-bottom);
  }

  .drilldown-section:last-of-type {
    border-bottom: 0;
  }

  .drilldown-section-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--el-text-color-regular);
  }

  .drilldown-series {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
  }

  .drilldown-bar {
    display: grid;
    grid-template-columns: 56px 1fr 72px;
    align-items: center;
    gap: 8px;
  }

  .drilldown-bar-date {
    font-size: 12px;
    color: var(--el-text-color-regular);
    font-variant-numeric: tabular-nums;
  }

  .drilldown-bar-track {
    height: 8px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }

  .drilldown-bar-fill {
    height: 100%;
    background: var(--el-text-color-primary);
    border-radius: var(--global-border-radius);
  }

  .drilldown-bar-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }

  .drilldown-subdim {
    margin-top: 12px;
  }

  .drilldown-subdim:first-of-type {
    margin-top: 0;
  }

  .drilldown-subdim-name {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 6px;
    color: var(--el-text-color-primary);
  }

  .drilldown-top {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .drilldown-top-item {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--global-border-radius);
    font-size: 13px;
  }

  .drilldown-top-item:hover {
    background: var(--el-fill-color-lighter);
  }

  .drilldown-top-rank {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 11px;
    color: var(--el-text-color-regular);
    font-weight: 600;
  }

  .drilldown-top-name {
    color: var(--el-text-color-primary);
  }

  .drilldown-top-value {
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
    font-weight: 500;
  }

  .drilldown-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-top: var(--unified-border);
    background: var(--el-fill-color-lighter);
    gap: 12px;
  }

  .drilldown-meta {
    font-size: 12px;
    color: var(--el-text-color-regular);
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }

  .drilldown-btn {
    height: 32px;
    padding: 0 14px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }

  .drilldown-btn:hover {
    border-color: var(--border-unified-color-hover);
  }
}
</style>
