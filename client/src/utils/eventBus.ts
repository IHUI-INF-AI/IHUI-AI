/**
 * 事件总线工具
 * 提供发布订阅模式的事件管理功能
 */

import { logger } from './logger'

type EventHandler<T = unknown> = (payload: T) => void

export interface EventBus {
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void
  once<T = unknown>(event: string, handler: EventHandler<T>): void
  off<T = unknown>(event: string, handler: EventHandler<T>): void
  emit<T = unknown>(event: string, payload?: T): void
  clear(event?: string): void
}

class EventBusImpl implements EventBus {
  private events: Map<string, Set<EventHandler>> = new Map()

  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }

    this.events.get(event)!.add(handler as EventHandler)

    return () => this.off(event, handler)
  }

  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = (payload: T) => {
      this.off(event, wrappedHandler)
      handler(payload)
    }

    this.on(event, wrappedHandler)
  }

  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.events.get(event)
    if (handlers) {
      handlers.delete(handler as EventHandler)
      if (handlers.size === 0) {
        this.events.delete(event)
      }
    }
  }

  emit<T = unknown>(event: string, payload?: T): void {
    const handlers = this.events.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload)
        } catch (error) {
          logger.error(`Error in event handler for "${event}":`, error as Error)
        }
      })
    }
  }

  clear(event?: string): void {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
  }
}

export function createEventBus(): EventBus {
  return new EventBusImpl()
}

export const globalEventBus = createEventBus()

export function useEventBus(bus: EventBus = globalEventBus) {
  const subscriptions: Array<() => void> = []

  const on = <T = unknown>(event: string, handler: EventHandler<T>) => {
    const unsubscribe = bus.on(event, handler)
    subscriptions.push(unsubscribe)
    return unsubscribe
  }

  const once = <T = unknown>(event: string, handler: EventHandler<T>) => {
    bus.once(event, handler)
  }

  const off = <T = unknown>(event: string, handler: EventHandler<T>) => {
    bus.off(event, handler)
  }

  const emit = <T = unknown>(event: string, payload?: T) => {
    bus.emit(event, payload)
  }

  const cleanup = () => {
    subscriptions.forEach(unsubscribe => unsubscribe())
    subscriptions.length = 0
  }

  return {
    on,
    once,
    off,
    emit,
    cleanup,
  }
}

export type TypedEventMap = Record<string, unknown>

export interface TypedEventBus<T extends TypedEventMap> {
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void
  once<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void
  off<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void
  emit<K extends keyof T>(event: K, payload: T[K]): void
  clear(event?: keyof T): void
}

export function createTypedEventBus<T extends TypedEventMap>(): TypedEventBus<T> {
  const bus = createEventBus()

  return {
    on: (event, handler) => bus.on(event as string, handler as EventHandler),
    once: (event, handler) => bus.once(event as string, handler as EventHandler),
    off: (event, handler) => bus.off(event as string, handler as EventHandler),
    emit: (event, payload) => bus.emit(event as string, payload),
    clear: event => bus.clear(event as string | undefined),
  }
}

export default {
  createEventBus,
  globalEventBus,
  useEventBus,
  createTypedEventBus,
}
