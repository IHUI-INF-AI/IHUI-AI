// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * - listener 错误必须 swallow(不能影响 DB 查询本身),但**必须 console.warn 喊出来** ——
 *   静默吞掉等于让订阅方整条失效而账面一切正常(§5e「失败必须响」)。
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
    let index = 0
    for (const listener of this.listeners) {
      try {
        listener(enriched)
      } catch (err) {
        // 仍然 swallow —— 监听器抛错不得打断 DB 查询本身;但**必须响**:
        // 静默吞掉后,订阅方(pino sink / 慢查询告警 / 统计)整条失效而账面一切正常,
        // 与本仓 §5e「失败必须响」和守门 70/76/81 记过的「判据失效的表现永远是安静」同一条禁令。
        console.warn(
          `[sql-event-bus] 监听器 #${index} 抛错,本次事件未送达该订阅方 durationMs=${
            event.durationMs ?? 'n/a'
          } query=${event.query.slice(0, 120)}: ${(err as Error)?.message ?? err}`,
        )
      }
      index += 1
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
