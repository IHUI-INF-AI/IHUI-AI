// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+the\s+(above|previous|prior)/i,
  /you\s+are\s+now\s+a/i,
  /system\s+prompt\s*:/i,
  /<\/system>/i,
  /reveal\s+your\s+(instructions?|prompts?|rules?)/i,
  /jailbreak/i,
  /forget\s+(everything|all|previous)/i,
  /act\s+as\s+(if\s+you\s+are|a\s+different)/i,
  /override\s+(your|the)\s+(instructions?|rules?|guidelines?)/i,
]

/** 返回命中的第一条注入规则文本(用于日志留痕);未命中返回 null */
export function matchPromptInjection(text: string): string | null {
  const hit = INJECTION_PATTERNS.find((pattern) => pattern.test(text))
  return hit ? String(hit) : null
}

export function detectPromptInjection(text: string): boolean {
  return matchPromptInjection(text) !== null
}

function scanValue(data: unknown): string[] {
  const found: string[] = []
  if (typeof data === 'string') {
    if (detectPromptInjection(data)) found.push(data.slice(0, 100))
  } else if (Array.isArray(data)) {
    for (const item of data) found.push(...scanValue(item))
  } else if (data && typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      found.push(...scanValue(v))
    }
  }
  return found
}

const AI_PATH_PREFIXES = [
  '/api/chat',
  '/api/ai/',
  '/api/admin/clawdbot',
  '/api/coze',
  '/api/workspace',
]

function isAiPath(url: string): boolean {
  const path = url.split('?')[0] ?? ''
  return AI_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p))
}

const promptInjectionGuardPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // preHandler: body 已解析（onRequest 阶段 body 尚未解析，钩子会完全失效）
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAiPath(request.url)) return
    const body = request.body
    if (body !== null && body !== undefined) {
      const hits = scanValue(body)
      if (hits.length > 0) {
        server.log.warn(
          { requestId: request.id, method: request.method, url: request.url, patterns: hits },
          'prompt injection attempt detected',
        )
        return reply.status(400).send({
          success: false,
          error: '检测到潜在的 Prompt 注入攻击',
        })
      }
    }
  })

  server.decorate('detectPromptInjection', detectPromptInjection)
}

export const promptInjectionGuard = fp(promptInjectionGuardPlugin, {
  name: 'prompt-injection-guard',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyInstance {
    detectPromptInjection: typeof detectPromptInjection
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
