import { ref, computed, type Ref, type ComputedRef, onUnmounted } from 'vue'

export type ColorFormat = 'hex' | 'rgb' | 'hsl'

export interface ColorValue {
  hex: Ref<string>
  rgb: ComputedRef<{ r: number; g: number; b: number }>
  hsl: ComputedRef<{ h: number; s: number; l: number }>
}

export function useColor(initialColor: string): ColorValue & {
  setHex: (hex: string) => void
  setRgb: (r: number, g: number, b: number) => void
  setHsl: (h: number, s: number, l: number) => void
} {
  const hex = ref(initialColor)

  const rgb = computed(() => hexToRgb(hex.value))

  const hsl = computed(() => rgbToHsl(rgb.value.r, rgb.value.g, rgb.value.b))

  const setHex = (newHex: string) => {
    hex.value = newHex
  }

  const setRgb = (r: number, g: number, b: number) => {
    hex.value = rgbToHex(r, g, b)
  }

  const setHsl = (h: number, s: number, l: number) => {
    const rgbValue = hslToRgb(h, s, l)
    hex.value = rgbToHex(rgbValue.r, rgbValue.g, rgbValue.b)
  }

  return { hex, rgb, hsl, setHex, setRgb, setHsl }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  l /= 100

  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

export function useNow(options: { interval?: number } = {}): Ref<Date> {
  const { interval = 1000 } = options
  const now = ref(new Date())

  let timer: ReturnType<typeof setInterval> | null = null

  const start = () => {
    if (timer === null) {
      timer = setInterval(() => {
        now.value = new Date()
      }, interval)
    }
  }

  const _stop = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  start()

  // 组件卸载时自动清理定时器，避免内存泄漏
  onUnmounted(_stop)

  return now
}

export function useDateFormat(date: Ref<Date | string | number>, format: string = 'YYYY-MM-DD HH:mm:ss'): ComputedRef<string> {
  return computed(() => {
    const d = new Date(date.value)

    const pad = (n: number) => n.toString().padStart(2, '0')

    const tokens: Record<string, () => string> = {
      YYYY: () => d.getFullYear().toString(),
      YY: () => d.getFullYear().toString().slice(-2),
      MM: () => pad(d.getMonth() + 1),
      M: () => (d.getMonth() + 1).toString(),
      DD: () => pad(d.getDate()),
      D: () => d.getDate().toString(),
      HH: () => pad(d.getHours()),
      H: () => d.getHours().toString(),
      mm: () => pad(d.getMinutes()),
      m: () => d.getMinutes().toString(),
      ss: () => pad(d.getSeconds()),
      s: () => d.getSeconds().toString(),
    }

    let result = format
    Object.entries(tokens).forEach(([token, fn]) => {
      result = result.replace(new RegExp(token, 'g'), fn())
    })

    return result
  })
}

export function useTimeAgo(date: Ref<Date | string | number>): ComputedRef<string> {
  return computed(() => {
    const now = new Date()
    const past = new Date(date.value)
    const diffMs = now.getTime() - past.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    const diffWeek = Math.floor(diffDay / 7)
    const diffMonth = Math.floor(diffDay / 30)
    const diffYear = Math.floor(diffDay / 365)

    if (diffSec < 60) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    if (diffHour < 24) return `${diffHour}小时前`
    if (diffDay < 7) return `${diffDay}天前`
    if (diffWeek < 4) return `${diffWeek}周前`
    if (diffMonth < 12) return `${diffMonth}个月前`
    return `${diffYear}年前`
  })
}

export function useInterval(interval: number, options: { immediate?: boolean; callback?: () => void } = {}): {
  counter: Ref<number>
  reset: () => void
  pause: () => void
  resume: () => void
} {
  const { immediate = true, callback } = options

  const counter = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  let isActive = false

  const start = () => {
    if (!isActive) {
      isActive = true
      timer = setInterval(() => {
        counter.value++
        callback?.()
      }, interval)
    }
  }

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
      isActive = false
    }
  }

  const reset = () => {
    counter.value = 0
  }

  const pause = stop
  const resume = start

  if (immediate) {
    start()
  }

  // 组件卸载时自动清理定时器，避免内存泄漏
  onUnmounted(stop)

  return { counter, reset, pause, resume }
}
