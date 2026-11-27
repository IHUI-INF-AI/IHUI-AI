// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 注册表失效广播（R2 / P2-03 / P2-04）。
 *
 * 写成功后发 `ihui:agent-registry:v1:changed`，ai-service 订阅后按
 * `{version, ids, action}` 判断是否重拉快照。version 用**快照口径**
 * （定义 updatedAt 的毫秒），不是定义自身的 version 计数；两者混用会让
 * `AgentRegistryClient` 的“低版本忽略”把真实更新丢掉。
 *
 * Redis 不可用只记 warning，不让业务写失败：缓存会按 TTL 自然收敛。
 */

import type { FastifyInstance } from 'fastify'

export const AGENT_REGISTRY_CHANNEL = 'ihui:agent-registry:v1:changed'

export interface AgentRegistryChangedPayload {
  /** 快照版本：定义为 updatedAt 的毫秒；拿不到就退化为 Date.now() */
  version: number
  ids: string[]
  action: string
}

export function snapshotVersionFromUpdatedAt(updatedAt: unknown): number {
  if (typeof updatedAt === 'string' || updatedAt instanceof Date) {
    const parsed = updatedAt instanceof Date ? updatedAt.getTime() : Date.parse(updatedAt)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return Date.now()
}

export async function publishAgentRegistryChanged(
  server: FastifyInstance,
  payload: AgentRegistryChangedPayload,
): Promise<boolean> {
  try {
    const delivered = await server.redis.publish(
      AGENT_REGISTRY_CHANNEL,
      JSON.stringify(payload),
    )
    return delivered > 0
  } catch (error) {
    server.log.warn(
      { err: error, action: payload.action, version: payload.version },
      'agent-registry 失效广播失败，缓存将按 TTL 收敛',
    )
    return false
  }
}
