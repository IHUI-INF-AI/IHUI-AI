import { onUnmounted } from 'vue'

/**
 * 统一清理 composable：把"保存引用 + onUnmounted 清理"收敛到一处
 * 避免每次手写清理逻辑导致遗漏
 *
 * 用法：
 * const cleanup = useCleanup()
 * const id = cleanup.addTimer(() => doSomething(), 1000)
 * cleanup.addEventListener(window, 'scroll', onScroll)
 * cleanup.add(() => observer.disconnect())
 * // 组件销毁时自动清理，无需手写 onUnmounted
 */
export interface UseCleanupReturn {
  /** 注册任意清理函数，返回传入的函数方便引用 */
  add: (fn: () => void) => () => void
  /** 注册 setTimeout，返回 timerId */
  addTimer: (fn: () => void, delay: number) => ReturnType<typeof setTimeout>
  /** 注册 setInterval，返回 intervalId */
  addInterval: (fn: () => void, delay: number) => ReturnType<typeof setInterval>
  /** 注册可单独取消的 setTimeout，返回控制对象（可主动 cancel） */
  addCancellableTimer: (fn: () => void, delay: number) => { cancel: () => void; id: ReturnType<typeof setTimeout> }
  /** 注册可单独取消的 setInterval，返回控制对象（可主动 cancel） */
  addCancellableInterval: (fn: () => void, delay: number) => { cancel: () => void; id: ReturnType<typeof setInterval> }
  /** 注册事件监听器，自动在清理时 removeEventListener */
  addEventListener: <E extends Event = Event>(target: EventTarget, event: string, handler: (event: E) => void, options?: boolean | AddEventListenerOptions) => void
  /** 注册 AbortController，清理时自动 abort */
  addAbortController: () => AbortController
  /** 手动触发所有清理（一般不用，onUnmounted 会自动调用） */
  run: () => void
  /** 当前已注册的清理任务数 */
  size: () => number
}

export function useCleanup(autoDispose = true): UseCleanupReturn {
  const cleanups: Array<() => void> = []
  // 防重复清理标志：run() 执行后置为 true，后续 add 系列方法会立即清理新资源
  let disposed = false
  // 开发环境调试日志：import.meta.env.DEV 为 true 时输出
  const DEV = import.meta.env.DEV
  const log = DEV ? (msg: string) => console.debug(`[useCleanup] ${msg}`) : () => {}

  const add = (fn: () => void) => {
    if (disposed) { try { fn() } catch (e) { console.error('[useCleanup] cleanup error:', e) } return fn }
    cleanups.push(fn)
    log(`add #${cleanups.length}`)
    return fn
  }

  const addTimer = (fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay)
    if (disposed) { clearTimeout(id); log('addTimer (disposed, cleared)') }
    else { cleanups.push(() => clearTimeout(id)); log(`addTimer #${cleanups.length} delay=${delay}`) }
    return id
  }

  const addInterval = (fn: () => void, delay: number) => {
    const id = setInterval(fn, delay)
    if (disposed) { clearInterval(id); log('addInterval (disposed, cleared)') }
    else { cleanups.push(() => clearInterval(id)); log(`addInterval #${cleanups.length} delay=${delay}`) }
    return id
  }

  const addCancellableTimer = (fn: () => void, delay: number) => {
    let cancelled = false
    const id = setTimeout(() => {
      if (cancelled) return
      fn()
    }, delay)
    const cancel = () => {
      if (cancelled) return
      cancelled = true
      clearTimeout(id)
      log('addCancellableTimer cancelled')
    }
    if (disposed) { cancel(); log('addCancellableTimer (disposed, cancelled)') }
    else { cleanups.push(cancel); log(`addCancellableTimer #${cleanups.length} delay=${delay}`) }
    return { cancel, id }
  }

  const addCancellableInterval = (fn: () => void, delay: number) => {
    const id = setInterval(fn, delay)
    let cancelled = false
    const cancel = () => {
      if (cancelled) return
      cancelled = true
      clearInterval(id)
      log('addCancellableInterval cancelled')
    }
    if (disposed) { cancel(); log('addCancellableInterval (disposed, cancelled)') }
    else { cleanups.push(cancel); log(`addCancellableInterval #${cleanups.length} delay=${delay}`) }
    return { cancel, id }
  }

  const addEventListener = <E extends Event = Event>(
    target: EventTarget,
    event: string,
    handler: (event: E) => void,
    options?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(event, handler as EventListener, options)
    if (disposed) { target.removeEventListener(event, handler as EventListener, options); log(`addEventListener '${event}' (disposed, removed)`) }
    else { cleanups.push(() => target.removeEventListener(event, handler as EventListener, options)); log(`addEventListener '${event}' #${cleanups.length}`) }
  }

  const addAbortController = () => {
    const controller = new AbortController()
    if (disposed) { controller.abort(); log('addAbortController (disposed, aborted)') }
    else { cleanups.push(() => controller.abort()); log(`addAbortController #${cleanups.length}`) }
    return controller
  }

  const run = () => {
    if (disposed) return
    disposed = true
    const total = cleanups.length
    log(`run start, ${total} cleanups`)
    while (cleanups.length) {
      const fn = cleanups.pop()
      try { fn?.() } catch (e) { console.error('[useCleanup] cleanup error:', e) }
    }
    log(`run done, ${total} cleanups executed`)
  }

  const size = () => cleanups.length

  if (autoDispose) {
    onUnmounted(run)
  }

  return { add, addTimer, addInterval, addCancellableTimer, addCancellableInterval, addEventListener, addAbortController, run, size }
}
