import { onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '@/utils/logger'

/**
 * 页面性能监测
 * 开发模式自动输出，生产模式通过 URL 加 ?perf=1 临时查看
 * @param pageName 页面名称，用于日志标识
 */
export function usePagePerf(pageName: string): void {
  const cleanup = useCleanup()
  let fpsRafId: number | null = null
  let fpsDiv: HTMLDivElement | null = null
  let fpsCanvas: HTMLCanvasElement | null = null
  let fpsCtx: CanvasRenderingContext2D | null = null

  onMounted(() => {
    const enablePerf = import.meta.env.DEV ||
      (typeof URLSearchParams !== 'undefined' && new URLSearchParams(window.location.search).has('perf'))
    if (!enablePerf || typeof performance === 'undefined') return

    // 加载性能日志
    const logPerf = () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (!nav) return
      logger.debug(`[${pageName} 性能监测]`, {
        '首屏渲染(DOMContentLoaded)': `${Math.round(nav.domContentLoadedEventEnd - nav.startTime)}ms`,
        '页面完全加载(load)': `${Math.round(nav.loadEventEnd - nav.startTime)}ms`,
        '首字节时间(TTFB)': `${Math.round(nav.responseStart - nav.startTime)}ms`,
        'DOM 解析': `${Math.round(nav.domInteractive - nav.startTime)}ms`,
      })
    }
    if (document.readyState === 'complete') {
      logPerf()
    } else {
      window.addEventListener('load', logPerf, { once: true })
    }

    // FPS 实时监测浮窗：左边数字 + 右边历史曲线
    fpsDiv = document.createElement('div')
    fpsDiv.style.cssText = 'position:fixed;top:8px;right:8px;z-index:var(--z-max);padding:4px 8px;border-radius:4px;font-size:12px;font-family:monospace;pointer-events:none;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.9);'

    const label = document.createElement('span')
    label.textContent = 'FPS: --'
    fpsDiv.appendChild(label)

    // 历史曲线 canvas：宽 80 高 24，显示最近 10 秒帧率
    fpsCanvas = document.createElement('canvas')
    fpsCanvas.width = 80
    fpsCanvas.height = 24
    fpsCanvas.style.cssText = 'display:block;'
    fpsDiv.appendChild(fpsCanvas)
    fpsCtx = fpsCanvas.getContext('2d')

    document.body.appendChild(fpsDiv)

    // 历史帧率数据：最多 10 个点（每秒一个）
    const history: number[] = []
    let peak = 0
    let min = Infinity
    let sum = 0
    let count = 0

    let frames = 0
    let lastTime = performance.now()
    const measureFps = () => {
      frames++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime))
        label.textContent = `FPS: ${fps}`
        // 帧率低时变红提醒
        const bg = fps < 30 ? '#ffebee' : fps < 50 ? '#fff9c4' : '#c8e6c9'
        const color = fps < 30 ? '#c62828' : fps < 50 ? '#f57f17' : '#2e7d32'
        fpsDiv!.style.background = bg
        label.style.color = color

        // 记录历史并绘制曲线
        history.push(fps)
        if (history.length > 10) history.shift()
        drawHistory(history, color)

        // 更新峰值/最低/平均值，并在 title 上显示（鼠标悬停可看）
        if (fps > peak) peak = fps
        if (fps < min) min = fps
        sum += fps
        count++
        const avg = Math.round(sum / count)
        fpsDiv!.title = `当前: ${fps} | 平均: ${avg} | 峰值: ${peak} | 最低: ${min}`

        frames = 0
        lastTime = now
      }
      fpsRafId = requestAnimationFrame(measureFps)
    }

    // 绘制帧率历史曲线
    const drawHistory = (data: number[], color: string) => {
      if (!fpsCtx || !fpsCanvas) return
      const w = fpsCanvas.width
      const h = fpsCanvas.height
      fpsCtx.clearRect(0, 0, w, h)
      if (data.length < 2) return
      // 帧率范围 0-120 映射到画布高度
      fpsCtx.strokeStyle = color
      fpsCtx.lineWidth = 1.5
      fpsCtx.beginPath()
      data.forEach((v, i) => {
        const x = (i / (10 - 1)) * w
        const y = h - (Math.min(v, 120) / 120) * h
        if (i === 0) fpsCtx!.moveTo(x, y)
        else fpsCtx!.lineTo(x, y)
      })
      fpsCtx.stroke()
    }

    fpsRafId = requestAnimationFrame(measureFps)
  })

  cleanup.add(() => {
    if (fpsRafId !== null) {
      cancelAnimationFrame(fpsRafId)
      fpsRafId = null
    }
    if (fpsDiv && fpsDiv.parentNode) {
      fpsDiv.parentNode.removeChild(fpsDiv)
      fpsDiv = null
    }
    fpsCanvas = null
    fpsCtx = null
  })
}
