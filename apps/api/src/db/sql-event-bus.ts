import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * SQL 查询事件,由 drizzle/postgres-js 查询钩子发布,
 * slow-sql-killer 与 n1-detector 订阅消费。
 */
export interface SqlEvent {
  query: string
  params?: unknown[]
  durationMs?: number
  timestamp?: number
  /** 关联的请求 ID(由 ALS 上下文自动注入,api-logger-extended onRequest 进入) */
  requestId?: string
}

/**
 * SQL 事件总线。
 *
 * 设计要点:
 * - 用 AsyncLocalStorage 让 requestId 跨异步链传播,logger 回调无需手动传 requestId。
 * - listener 错误必须 swallow,不能影响 DB 查询本身。
 * - emit 自动注入 ALS 中的 requestId。
 */
class SqlEventBus {
  private listeners = new Set<(e: SqlEvent) => void>()
  private als = new AsyncLocalStorage<{ requestId: string }>()

  /** 订阅 SQL 事件,返回取消订阅函数。 */
  on(listener: (e: SqlEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 发布 SQL 事件(自动注入 ALS 中的 requestId)。 */
  emit(event: SqlEvent): void {
    const store = this.als.getStore()
    const enriched: SqlEvent = store ? { ...event, requestId: store.requestId } : event
    for (const listener of this.listeners) {
      try {
        listener(enriched)
      } catch {
        // swallow listener errors,不能影响 DB 查询本身
      }
    }
  }

  /** 在 requestId 上下文中运行(Fastify onRequest 钩子可用 enterContext 替代)。 */
  run<T>(requestId: string, fn: () => Promise<T> | T): Promise<T> | T {
    return this.als.run({ requestId }, fn)
  }

  /**
   * 进入 requestId 上下文(用 enterWith,持续到当前 async 链结束)。
   * 用于 Fastify onRequest 钩子:进入后,本请求后续所有 DB 查询都能关联到 requestId。
   */
  enterContext(requestId: string): void {
    this.als.enterWith({ requestId })
  }
}

export const sqlEventBus = new SqlEventBus()
