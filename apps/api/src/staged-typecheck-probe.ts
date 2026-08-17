import type { FastifyInstance } from 'fastify'

/**
 * 临时探测文件(验证完成后删除):
 * 1. server.pushNotification 来自 ws-notifications.ts 的 declare module 'fastify'
 *    模块扩展 —— 旧版 partial-include 会漏加载 → TS2339 假阳性。
 * 2. 故意类型错误:验证过滤逻辑仍能捕获 staged 文件真实错误。
 */
export function probe(server: FastifyInstance): void {
  // 模块扩展必须被加载,否则这里报 TS2339
  server.pushNotification('user-1', { type: 'probe' })
}
