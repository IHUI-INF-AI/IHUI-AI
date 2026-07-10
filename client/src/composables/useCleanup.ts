import { onUnmounted } from 'vue'

export function useCleanup() {
  const cleanups: Array<() => void> = []

  const add = (fn: () => void) => {
    cleanups.push(fn)
  }

  const addTimer = (fn: () => void, delay?: number) => {
    const timer = setTimeout(fn, delay)
    cleanups.push(() => clearTimeout(timer))
    return timer
  }

  const addEventListener = (target: EventTarget, event: string, listener: EventListener) => {
    target.addEventListener(event, listener)
    cleanups.push(() => target.removeEventListener(event, listener))
  }

  const cleanup = () => {
    cleanups.forEach(fn => {
      try { fn() } catch { /* ignore */ }
    })
    cleanups.length = 0
  }

  onUnmounted(cleanup)

  return { add, addTimer, addEventListener, cleanup }
}
