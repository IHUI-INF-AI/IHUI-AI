<template>
  <div class="perf-chart">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="chart-canvas"
    ></canvas>
    <div v-if="showLegend" class="chart-legend">
      <span
        v-for="(s, idx) in series"
        :key="idx"
        class="legend-item"
      >
        <span class="legend-dot" :style="{ background: s.color || colors[idx] }"></span>
        <span class="legend-label">{{ s.label }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

const cleanup = useCleanup()

interface Series {
  label: string
  data: Array<{ date: string; value: number }>
  color?: string
}

interface Props {
  series: Series[]
  height?: number
  showLegend?: boolean
  showGrid?: boolean
  showAxis?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 200,
  showLegend: true,
  showGrid: true,
  showAxis: true,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = ref(640)
const canvasHeight = computed(() => props.height)

const colors = ['var(--el-text-color-primary)', 'var(--color-blue-1890ff)', 'var(--el-color-success)', 'var(--el-color-warning)', 'var(--color-purple-722ed1)']

function drawChart() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const cssW = c.clientWidth
  const cssH = c.clientHeight
  c.width = cssW * dpr
  c.height = cssH * dpr
  ctx.scale(dpr, dpr)

  // 读取主题色（Canvas 无法直接使用 CSS 变量，需运行时解析）
  const probe = document.createElement('div')
  document.body.appendChild(probe)
  probe.style.color = 'var(--el-border-color-lighter)'
  const gridColor = getComputedStyle(probe).color
  probe.style.color = 'var(--el-text-color-placeholder)'
  const axisColor = getComputedStyle(probe).color
  document.body.removeChild(probe)

  ctx.clearRect(0, 0, cssW, cssH)
  if (props.series.length === 0) return

  // 计算全局 max/min
  const allValues = props.series.flatMap((s: Series) => s.data.map((p: { date: string; value: number }) => p.value))
  const max = Math.max(...allValues, 1)
  const min = Math.min(...allValues, 0)
  const range = max - min || 1

  // padding
  const padL = props.showAxis ? 36 : 8
  const padR = 12
  const padT = 8
  const padB = props.showAxis ? 22 : 6
  const plotW = cssW - padL - padR
  const plotH = cssH - padT - padB

  // 网格
  if (props.showGrid) {
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(padL + plotW, y)
      ctx.stroke()
    }
  }

  // Y 轴标签
  if (props.showAxis) {
    ctx.fillStyle = axisColor
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4
      const val = max - (range * i) / 4
      ctx.fillText(formatY(val), padL - 4, y)
    }
  }

  // 画每条 series
  const longest = Math.max(...props.series.map((s: Series) => s.data.length), 1)
  props.series.forEach((s: Series, sIdx: number) => {
    const color = s.color || colors[sIdx % colors.length]
    const data = s.data
    if (data.length === 0) return
    const stepX = plotW / Math.max(1, longest - 1)

    // 区域填充
    ctx.beginPath()
    data.forEach((p: { date: string; value: number }, i: number) => {
      const x = padL + (i * stepX * (longest - 1)) / Math.max(1, data.length - 1)
      const y = padT + plotH - ((p.value - min) / range) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    if (data.length > 1) {
      const lastX = padL + plotW
      const firstX = padL
      ctx.lineTo(lastX, padT + plotH)
      ctx.lineTo(firstX, padT + plotH)
    }
    ctx.closePath()
    ctx.fillStyle = hexToRgba(color, 0.1)
    ctx.fill()

    // 折线
    ctx.beginPath()
    data.forEach((p: { date: string; value: number }, i: number) => {
      const x = padL + (i * stepX * (longest - 1)) / Math.max(1, data.length - 1)
      const y = padT + plotH - ((p.value - min) / range) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()

    // 数据点
    ctx.fillStyle = color
    data.forEach((p: { date: string; value: number }, i: number) => {
      const x = padL + (i * stepX * (longest - 1)) / Math.max(1, data.length - 1)
      const y = padT + plotH - ((p.value - min) / range) * plotH
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    })
  })

  // X 轴标签 (只显示前/中/末)
  if (props.showAxis && props.series[0]?.data.length) {
    ctx.fillStyle = axisColor
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const data = props.series[0].data
    const positions = [0, Math.floor(data.length / 2), data.length - 1]
    positions.forEach((i) => {
      const x = padL + (i * plotW) / Math.max(1, data.length - 1)
      ctx.fillText(data[i].date.slice(5), x, padT + plotH + 4)
    })
  }
}

function formatY(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + 'w'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
  return v.toFixed(0)
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex
  if (hex.startsWith('#')) {
    const c = hex.replace('#', '')
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return `rgba(0,0,0,${alpha})`
}

let resizeRafId: number | null = null
function handleResize() {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    if (canvasRef.value) {
      canvasWidth.value = canvasRef.value.parentElement?.clientWidth || 640
    }
    nextTick(drawChart)
  })
}

cleanup.add(() => { if (resizeRafId !== null) cancelAnimationFrame(resizeRafId) })

onMounted(() => {
  handleResize()
  cleanup.addEventListener(window, 'resize', handleResize as EventListener)
})

watch(() => props.series, drawChart, { deep: true })
</script>

<style scoped lang="scss">
@use '@/styles/variables' as v;

$text-sec: var(--el-text-color-secondary);

.perf-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-canvas {
  width: 100%;
  display: block;
}

.chart-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: $text-sec;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
