import { ref, onUnmounted, type Ref } from 'vue'

type EventHandler<T = unknown> = (data: T) => void

export interface EventBus<T extends Record<string, unknown>> {
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void
  off<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void
  emit<K extends keyof T>(event: K, data: T[K]): void
  once<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void
  clear(): void
  listenerCount<K extends keyof T>(event: K): number
}

export function useEventBus<T extends Record<string, unknown> = Record<string, unknown>>(): EventBus<T> {
  const handlers = new Map<keyof T, Set<EventHandler>>()

  const on = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): (() => void) => {
    if (!handlers.has(event)) {
      handlers.set(event, new Set())
    }
    handlers.get(event)!.add(handler as EventHandler)

    return () => off(event, handler)
  }

  const off = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): void => {
    const eventHandlers = handlers.get(event)
    if (eventHandlers) {
      eventHandlers.delete(handler as EventHandler)
      if (eventHandlers.size === 0) {
        handlers.delete(event)
      }
    }
  }

  const emit = <K extends keyof T>(event: K, data: T[K]): void => {
    const eventHandlers = handlers.get(event)
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(data))
    }
  }

  const once = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): (() => void) => {
    const wrappedHandler: EventHandler<T[K]> = (data) => {
      off(event, wrappedHandler)
      handler(data)
    }
    return on(event, wrappedHandler)
  }

  const clear = (): void => {
    handlers.clear()
  }

  const listenerCount = <K extends keyof T>(event: K): number => {
    return handlers.get(event)?.size || 0
  }

  onUnmounted(() => {
    clear()
  })

  return {
    on,
    off,
    emit,
    once,
    clear,
    listenerCount,
  }
}

export interface TypedEventBus<T extends Record<string, unknown>> extends EventBus<T> {
  useOn<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void
  useOnce<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void
}

export function createTypedEventBus<T extends Record<string, unknown>>(): TypedEventBus<T> {
  const bus = useEventBus<T>()
  const componentHandlers = new Map<keyof T, Set<EventHandler>>()

  const useOn = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): void => {
    bus.on(event, handler)
    if (!componentHandlers.has(event)) {
      componentHandlers.set(event, new Set())
    }
    componentHandlers.get(event)!.add(handler as EventHandler)
  }

  const useOnce = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): void => {
    bus.once(event, handler)
  }

  onUnmounted(() => {
    componentHandlers.forEach((handlers, event) => {
      handlers.forEach((handler) => bus.off(event, handler as EventHandler<T[keyof T]>))
    })
    componentHandlers.clear()
  })

  return {
    ...bus,
    useOn,
    useOnce,
  }
}

export function useEventBusState<T>(initialState: T): [Ref<T>, (value: T) => void] {
  const state = ref<T>(initialState) as Ref<T>
  const bus = useEventBus<{ update: T }>()

  bus.on('update', (value) => {
    state.value = value
  })

  const update = (value: T) => {
    state.value = value
    bus.emit('update', value)
  }

  return [state, update]
}
