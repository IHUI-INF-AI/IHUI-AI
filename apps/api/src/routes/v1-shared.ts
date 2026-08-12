/**
 * v1 系列 OpenAI 兼容路由共享辅助函数(2026-08-12 抽取)。
 *
 * 背景:v1-ai-core / v1-knowledge-tools / v1-multimodal / ai-user-model-chat
 * 各自复制了 getUserId / jsonInit / maskKey / mintInternalJwt / asObj 五个函数
 * (实现完全一致,仅 jsonInit 的 method 联合类型有 'DELETE' 差异)。
 * 本模块收敛为单一来源,行为与旧实现完全等价。
 */
import type { FastifyRequest, FastifyReply } from 'fastify'

import { signAccessToken } from '@ihui/auth'
import { error } from '../utils/response.js'

/** 鉴权后注入 request 的 API Key 上下文(与各 v1 路由本地定义一致)。 */
export interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

/** 从 apiKey 上下文取 userId,失败 reply 401。 */
export function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
  if (!apiKey) {
    reply.status(401).send(error(401, 'API key authentication required'))
    return null
  }
  return apiKey.userId
}

/** 用 apiKey.userId 签发短期内部 JWT,模拟内部调用满足 /api/* 的 JWT 鉴权。 */
export function mintInternalJwt(userId: string): Promise<string> {
  return signAccessToken({ userId, phone: '', familyId: `apikey-${userId}`, roleId: 0 })
}

/** 构造 JSON 请求 init。 */
export function jsonInit(body: unknown, method: 'POST' | 'PUT' | 'DELETE' = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/** 屏蔽 API Key 中间部分,只保留首 4 + 末 4 字符。 */
export function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

/** 非空对象断言(undefined/null 归一为空对象)。 */
export function asObj(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>
}
