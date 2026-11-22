// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 13 批(2026-10-31,R4 评估轮)修复钉住。
 *
 * 覆盖:
 * - M-1 nginx 边缘封禁:/api/internal/ 与 /ai-service/internal/ 在 nginx.web.conf
 *   有 `location … { return 403; }`(nginx 前缀匹配最长优先,自动压过宽面前缀)。
 *   本机无 nginx 可执行文件 ⇒ 判据为配置文本结构(与 o5-nginx-edge-ratelimit 同形态),
 *   不依赖真 nginx 运行。
 * - M-2 /socket.io/ 剥 X-IHUI-Principal / X-Api-Key;/ai-service/ 前缀补剥 X-Api-Key
 *   (与精确项同档);⑥ 护栏复验:WS location 的 Upgrade/Connection/长超时不被本批改动掉。
 * - SSE 错误帧脱敏:coze 流式代理在 fetch 失败时回固定文案,不把错误原文
 *   (ECONNREFUSED + 内网 IP)写给客户端。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// nginx 配置形态判据
// ---------------------------------------------------------------------------

const NGINX_CONF = resolve(__dirname, '../../../deploy/docker/nginx.web.conf')

/** 提取 `header` 之后第一个配平的 `{ … }` 块文本。 */
function blockOf(src: string, header: string): string {
  const i = src.indexOf(header)
  if (i === -1) return ''
  const open = src.indexOf('{', i)
  if (open === -1) return ''
  let depth = 1
  let j = open + 1
  while (depth > 0 && j < src.length) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') depth--
    j++
  }
  return src.slice(open, j)
}

describe('nginx 边缘封禁与身份头剥离(第 13 批 M-1/M-2)', () => {
  const src = readFileSync(NGINX_CONF, 'utf-8')

  it('/api/internal/ 在边缘直接 403', () => {
    const block = blockOf(src, 'location /api/internal/')
    expect(block).not.toBe('')
    expect(block).toContain('return 403;')
  })

  it('/ai-service/internal/ 在边缘直接 403', () => {
    const block = blockOf(src, 'location /ai-service/internal/')
    expect(block).not.toBe('')
    expect(block).toContain('return 403;')
  })

  it('/socket.io/ location 剥 X-IHUI-Principal 与 X-Api-Key', () => {
    const block = blockOf(src, 'location /socket.io/')
    expect(block).toContain('proxy_set_header X-IHUI-Principal "";')
    expect(block).toContain('proxy_set_header X-Api-Key "";')
  })

  it('⑥ 护栏复验:WS location 的 Upgrade/Connection 与长超时仍在', () => {
    const block = blockOf(src, 'location /socket.io/')
    expect(block).toContain('proxy_set_header Upgrade $http_upgrade;')
    expect(block).toContain('proxy_set_header Connection "upgrade";')
    expect(block).toContain('proxy_http_version 1.1;')
  })

  it('/ai-service/ 前缀 location 补剥 X-Api-Key(与精确项同档)', () => {
    const block = blockOf(src, 'location /ai-service/ {')
    expect(block).toContain('proxy_set_header X-IHUI-Principal "";')
    expect(block).toContain('proxy_set_header X-Api-Key "";')
  })
})

// ---------------------------------------------------------------------------
// coze SSE 错误帧脱敏
// ---------------------------------------------------------------------------

vi.hoisted(() => {
  process.env.COZE_API_KEY ??= 'test-coze-key'
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async () => true),
}))

vi.mock('../src/config/body-limits.js', () => ({
  FILE_UPLOAD_BODY_LIMIT: 10 * 1024 * 1024,
}))

describe('coze SSE 错误帧固定文案(第 13 批)', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    const { cozeRoutes } = await import('../src/routes/coze.js')
    await app.register(cozeRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('非流式代理(cozeProxy):fetch 异常时 502 固定文案,不含内网地址', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED 10.42.0.9:9000')
      }),
    )
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/audio/chat-audio',
        payload: { bot_id: 'b1', user_id: 'u1', audio_data: 'aGVsbG8=' },
      })
      expect(res.statusCode).toBe(502)
      expect(res.body).toContain('Coze 调用失败,请稍后重试')
      expect(res.body).not.toContain('ECONNREFUSED')
      expect(res.body).not.toContain('10.42.0.9')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('流式代理(streamCozeSse):fetch 异常时 SSE 错误帧固定文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED 10.42.0.9:9000')
      }),
    )
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/chat-audio/one-to-one',
        payload: { bot_id: 'b1', user_id: 'u1', audio_data: 'aGVsbG8=' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('流式生成失败,请稍后重试')
      expect(res.body).not.toContain('ECONNREFUSED')
      expect(res.body).not.toContain('10.42.0.9')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
