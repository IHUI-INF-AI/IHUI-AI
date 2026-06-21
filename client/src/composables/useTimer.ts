import { onUnmounted, ref } from 'vue'

export interface TimerOptions {
  immediate?: boolean
  autostart?: boolean
}

export function useTimeoutFn(
  callback: () => void,
  delay: number,
  options: TimerOptions = {}
) {
  const { immediate = false, autostart = true } = options
  const isActive = ref(false)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const start = () => {
    if (isActive.value) return
    isActive.value = true
    timeoutId = setTimeout(() => {
      callback()
      stop()
    }, delay)
  }

  const stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    isActive.value = false
  }

  const restart = () => {
    stop()
    start()
  }

  if (autostart) {
    if (immediate) {
      callback()
    }
    start()
  }

  onUnmounted(() => {
    stop()
  })

  return {
    isActive: isActive,
    start,
    stop,
    restart,
  }
}

export function useIntervalFn(
  callback: () => void,
  interval: number,
  options: TimerOptions = {}
) {
  const { immediate = false, autostart = true } = options
  const isActive = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  const start = () => {
    if (isActive.value) return
    isActive.value = true
    intervalId = setInterval(callback, interval)
  }

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    isActive.value = false
  }

  const restart = () => {
    stop()
    start()
  }

  if (autostart) {
    if (immediate) {
      callback()
    }
    start()
  }

  onUnmounted(() => {
    stop()
  })

  return {
    isActive: isActive,
    start,
    stop,
    restart,
  }
}

export function useTimer() {
  const timers = new Set<ReturnType<typeof globalThis.setTimeout>>()
  const intervals = new Set<ReturnType<typeof globalThis.setInterval>>()
  const rafs = new Set<number>()

  const setTimer = (callback: () => void, delay: number): ReturnType<typeof globalThis.setTimeout> => {
    const id = globalThis.setTimeout(() => {
      timers.delete(id)
      callback()
    }, delay)
    timers.add(id)
    return id
  }

  const clearTimer = (id: ReturnType<typeof globalThis.setTimeout>) => {
    globalThis.clearTimeout(id)
    timers.delete(id)
  }

  const setTimerInterval = (callback: () => void, delay: number): ReturnType<typeof globalThis.setInterval> => {
    const id = globalThis.setInterval(callback, delay)
    intervals.add(id)
    return id
  }

  const clearTimerInterval = (id: ReturnType<typeof globalThis.setInterval>) => {
    globalThis.clearInterval(id)
    intervals.delete(id)
  }

  const requestAnimationFrame = (callback: (time: number) => void): number => {
    const id = globalThis.requestAnimationFrame((time) => {
      rafs.delete(id)
      callback(time)
    })
    rafs.add(id)
    return id
  }

  const cancelAnimationFrame = (id: number) => {
    globalThis.cancelAnimationFrame(id)
    rafs.delete(id)
  }

  const clearAll = () => {
    timers.forEach((id) => globalThis.clearTimeout(id))
    intervals.forEach((id) => globalThis.clearInterval(id))
    rafs.forEach((id) => globalThis.cancelAnimationFrame(id))
    timers.clear()
    intervals.clear()
    rafs.clear()
  }

  onUnmounted(() => {
    clearAll()
  })

  return {
    setTimeout: setTimer,
    clearTimeout: clearTimer,
    setInterval: setTimerInterval,
    clearInterval: clearTimerInterval,
    requestAnimationFrame,
    cancelAnimationFrame,
    clearAll,
  }
}
