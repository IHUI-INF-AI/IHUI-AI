<template>
  <div class="learning-heatmap">
    <div class="heatmap-title">{{ t('edu.profile.learningHeatmap') }}</div>
    <div v-if="hasData" class="heatmap-scroll">
      <div class="heatmap-grid">
        <!-- 月份标签 -->
        <div
          v-for="(m, i) in monthLabels"
          :key="'m' + i"
          class="month-label"
          :style="{ gridColumn: m.col, gridRow: 1 }"
        >
          {{ m.label }}
        </div>
        <!-- 星期标签 -->
        <div
          v-for="w in weekdayLabels"
          :key="'w' + w.row"
          class="weekday-label"
          :style="{ gridColumn: 1, gridRow: w.row }"
        >
          {{ w.label }}
        </div>
        <!-- 日期格子 -->
        <div
          v-for="(cell, i) in cells"
          :key="'c' + i"
          class="cell"
          :class="'level-' + cell.level"
          :style="{ gridColumn: cell.col, gridRow: cell.row }"
          :title="cell.title"
        ></div>
      </div>
    </div>
    <el-empty v-else :description="t('edu.profile.noLearningData')" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDarkModeStore } from '@/stores/darkMode'

interface HeatPoint {
  date: string
  minutes: number
}

const props = defineProps<{
  data: HeatPoint[]
}>()

const { t } = useI18n()
const darkModeStore = useDarkModeStore()
// isDark 保留以备未来暗色差异化（当前仅靠 CSS 变量切换）
const isDark = computed(
  () => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark'
)
void isDark

const hasData = computed(() => Array.isArray(props.data) && props.data.length > 0)

const minuteMap = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  if (!hasData.value) return m
  for (const p of props.data) m.set(p.date, p.minutes)
  return m
})

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const weekdayLabels = [
  { row: 3, label: 'Mon' },
  { row: 5, label: 'Wed' },
  { row: 7, label: 'Fri' },
]

function levelOf(minutes: number): number {
  if (minutes <= 0) return 0
  if (minutes <= 30) return 1
  if (minutes <= 60) return 2
  if (minutes <= 120) return 3
  return 4
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getRangeEdges(): { today: Date; start: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  start.setDate(start.getDate() - start.getDay()) // 回退到周日
  return { today, start }
}

interface Cell {
  col: number
  row: number
  level: number
  title: string
  date: string
  minutes: number
}

const cells = computed<Cell[]>(() => {
  if (!hasData.value) return []
  const { today, start } = getRangeEdges()
  const out: Cell[] = []
  const cursor = new Date(start)
  let weekIndex = 0

  while (weekIndex <= 60) {
    if (cursor > today) break
    for (let d = 0; d < 7; d++) {
      const dateStr = formatDate(cursor)
      const inFuture = cursor > today
      const minutes = inFuture ? 0 : (minuteMap.value.get(dateStr) ?? 0)
      out.push({
        col: weekIndex + 2,
        row: d + 2,
        level: inFuture ? 0 : levelOf(minutes),
        title: inFuture ? '' : `${dateStr} · ${minutes} min`,
        date: dateStr,
        minutes,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weekIndex++
  }
  return out
})

const monthLabels = computed<{ col: number; label: string }[]>(() => {
  if (!hasData.value) return []
  const { today, start } = getRangeEdges()
  const labels: { col: number; label: string }[] = []
  let lastMonth = -1
  const cursor = new Date(start)
  let weekIndex = 0

  while (weekIndex <= 60) {
    if (cursor > today) break
    const m = cursor.getMonth()
    if (m !== lastMonth) {
      labels.push({ col: weekIndex + 2, label: MONTH_NAMES[m] })
      lastMonth = m
    }
    cursor.setDate(cursor.getDate() + 7)
    weekIndex++
  }
  return labels
})
</script>

<style scoped lang="scss">
:where(.learning-heatmap) {
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  padding: 16px;

  .heatmap-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 12px;
  }

  .heatmap-scroll {
    overflow-x: auto;
    overflow-y: hidden;
  }

  .heatmap-grid {
    display: grid;
    grid-template-columns: 28px repeat(53, 11px);
    grid-template-rows: 16px repeat(7, 11px);
    gap: 3px;
    width: max-content;
  }

  .month-label {
    font-size: 10px;
    color: var(--el-text-color-secondary);
    line-height: 16px;
    white-space: nowrap;
  }

  .weekday-label {
    font-size: 10px;
    color: var(--el-text-color-secondary);
    line-height: 11px;
    text-align: right;
    padding-right: 4px;
  }

  .cell {
    width: 11px;
    height: 11px;
    border-radius: 2px;

    &.level-0 {
      background: #ebedf0;
    }
    &.level-1 {
      background: #9be9a8;
    }
    &.level-2 {
      background: #40c463;
    }
    &.level-3 {
      background: #30a14e;
    }
    &.level-4 {
      background: #216e39;
    }
  }
}

// 暗色模式 5 级颜色
:where(html.dark) .learning-heatmap {
  .cell.level-0 {
    background: var(--color-white-10);
  }
  .cell.level-1 {
    background: #0e4429;
  }
  .cell.level-2 {
    background: #006d32;
  }
  .cell.level-3 {
    background: #26a641;
  }
  .cell.level-4 {
    background: #39d353;
  }
}
</style>
