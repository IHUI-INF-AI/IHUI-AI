// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { sqlEventBus } from '../db/sql-event-bus.js'

const N1_QUERY_THRESHOLD = parseInt(process.env.N1_QUERY_THRESHOLD ?? '20', 10)
/** 兜底 TTL:超时未关闭的条目由写入时顺带清扫,避免长连接异常残留。 */
const REQUEST_ENTRY_TTL_MS =
  parseInt(process.env.N1_REQUEST_ENTRY_TTL_MS ?? '', 10) || 10 * 60 * 1000
/** 每 N 次写入执行一次全表清扫,避免每次 recordQuery 都有 O(n) 开销。 */
const SWEEP_EVERY_WRITES = 64

declare module 'fastify' {
  interface FastifyInstance {
    n1Detector: {
      /** 记录一次 SQL 查询（在 drizzle logger 中调用） */
      recordQuery(requestId: string): void
      /** 获取当前请求的查询计数 */
      getQueryCount(requestId: string): number
    }
  }
}

interface RequestQueryEntry {
  count: number
  startedAt: number
}

const requestQueryCounts = new Map<string, RequestQueryEntry>()
let writesSinceSweep = 0

function sweepExpiredEntries(now: number): void {
  for (const [key, entry] of requestQueryCounts) {
    if (now - entry.startedAt > REQUEST_ENTRY_TTL_MS) requestQueryCounts.delete(key)
  }
}

function bumpQueryCount(requestId: string): void {
  const entry = requestQueryCounts.get(requestId)
  if (entry) entry.count += 1
  else requestQueryCounts.set(requestId, { count: 1, startedAt: Date.now() })
  writesSinceSweep += 1
  if (writesSinceSweep >= SWEEP_EVERY_WRITES) {
    writesSinceSweep = 0
    sweepExpiredEntries(Date.now())
  }
}

/**
 * N+1 查询检测插件。
 *
 * 通过订阅 sqlEventBus 自动统计每个请求的 SQL 查询次数,
 * 无需在各业务代码手动调用 recordQuery()。
 * requestId 由 api-logger-extended onRequest 经 ALS(enterContext)注入,
 * 订阅回调自动获取,无需手动传参。
 */
const n1DetectorPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 订阅 SQL 事件,自动 recordQuery(requestId 由 ALS 注入)
  const unsubscribe = sqlEventBus.on((event) => {
    if (event.requestId) bumpQueryCount(event.requestId)
  })

  /** 摘除请求条目;hijack 的 SSE/WS 出口先于 onResponse,到 close 时才回收。 */
  const releaseRequest = (key: string, request: FastifyRequest): void => {
    const entry = requestQueryCounts.get(key)
    if (entry && entry.count > N1_QUERY_THRESHOLD) {
      server.log.warn(
        { requestId: key, method: request.method, url: request.url, queryCount: entry.count },
        'potential N+1 query detected',
      )
    }
    requestQueryCounts.delete(key)
  }

  server.addHook('onRequest', async (request: FastifyRequest) => {
    // api-logger-extended 先注册,onRequest 已设置 request.requestId
    // 用 requestId ?? request.id 兜底,确保 key 与订阅回调一致
    const key = request.requestId ?? request.id
    requestQueryCounts.set(key, { count: 0, startedAt: Date.now() })
    // 2026-11 F-45:reply.hijack() 后 onResponse 不执行,靠连接关闭回收该请求的计数
    request.raw?.once?.('close', () => requestQueryCounts.delete(key))
  })

  server.addHook('onResponse', async (request: FastifyRequest) => {
    releaseRequest(request.requestId ?? request.id, request)
  })

  server.decorate('n1Detector', {
    recordQuery(requestId: string) {
      bumpQueryCount(requestId)
    },
    getQueryCount(requestId: string) {
      return requestQueryCounts.get(requestId)?.count ?? 0
    },
  })

  server.addHook('onClose', async () => {
    requestQueryCounts.clear()
    writesSinceSweep = 0
    unsubscribe()
  })
}

/** 仅测试用:TTL 与条目数(纯内存,不依赖真实连接)。 */
export const __n1DetectorTest = {
  REQUEST_ENTRY_TTL_MS,
  SWEEP_EVERY_WRITES,
  size(): number {
    return requestQueryCounts.size
  },
  reset(): void {
    requestQueryCounts.clear()
    writesSinceSweep = 0
  },
}

export const n1Detector = fp(n1DetectorPlugin, {
  name: 'n1-detector',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
