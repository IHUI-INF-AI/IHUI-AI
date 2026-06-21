/**
 * 事件发射器基类
 * 提供类型安全的事件订阅和发布功能
 */

import { logger } from './logger'

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>

export class EventEmitter {
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private onceHandlers: Map<string, Set<EventHandler>> = new Map()

  /**
   * 订阅事件
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler as EventHandler)

    // 返回取消订阅函数
    return () => this.off(event, handler)
  }

  /**
   * 一次性订阅事件
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set())
    }
    this.onceHandlers.get(event)!.add(handler as EventHandler)

    return () => {
      this.onceHandlers.get(event)?.delete(handler as EventHandler)
    }
  }

  /**
   * 取消订阅事件
   */
  off<T = unknown>(event: string, handler?: EventHandler<T>): void {
    if (handler) {
      this.handlers.get(event)?.delete(handler as EventHandler)
      this.onceHandlers.get(event)?.delete(handler as EventHandler)
    } else {
      this.handlers.delete(event)
      this.onceHandlers.delete(event)
    }
  }

  /**
   * 发布事件
   */
  emit<T = unknown>(event: string, data?: T): void {
    // 触发普通处理器
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          void handler(data)
        } catch (error) {
          logger.error(`[EventEmitter] Error in handler for "${event}":`, error)
        }
      })
    }

    const onceHandlers = this.onceHandlers.get(event)
    if (onceHandlers) {
      onceHandlers.forEach(handler => {
        try {
          void handler(data)
        } catch (error) {
          logger.error(`[EventEmitter] Error in once handler for "${event}":`, error)
        }
      })
      this.onceHandlers.delete(event)
    }
  }

  /**
   * 异步发布事件（等待所有处理器完成）
   */
  async emitAsync<T = unknown>(event: string, data: T): Promise<void> {
    const handlers = this.handlers.get(event)
    const onceHandlers = this.onceHandlers.get(event)

    const allHandlers: EventHandler[] = []
    
    if (handlers) {
      allHandlers.push(...handlers)
    }
    
    if (onceHandlers) {
      allHandlers.push(...onceHandlers)
      this.onceHandlers.delete(event)
    }

    await Promise.all(
      allHandlers.map(async handler => {
        try {
          await handler(data)
        } catch (error) {
          logger.error(`[EventEmitter] Error in async handler for "${event}":`, error)
        }
      })
    )
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event: string): number {
    const handlers = this.handlers.get(event)?.size || 0
    const onceHandlers = this.onceHandlers.get(event)?.size || 0
    return handlers + onceHandlers
  }

  /**
   * 获取所有事件名
   */
  eventNames(): string[] {
    const names = new Set([
      ...this.handlers.keys(),
      ...this.onceHandlers.keys(),
    ])
    return Array.from(names)
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event)
      this.onceHandlers.delete(event)
    } else {
      this.handlers.clear()
      this.onceHandlers.clear()
    }
  }
}

/**
 * 全局事件总线实例
 */
export const EventBus = new EventEmitter()
