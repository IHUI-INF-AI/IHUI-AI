// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * G-21③ 收口：API 日志中间件必须对「自由文本里的凭据」脱敏，而不只是按字段名打码。
 *
 * 判据（票面 ③「诊断量代替原文 / 接共享层唯一脱敏出口」在本端的落点）：
 *   - `plugins/log-sanitizer.ts` 的 Proxy 现只做 `sanitizeData`（按字段名命中 token/secret/apiKey ⇒ ***）；
 *     当凭据是**字符串正文的一部分**（错误消息、堆栈、`Authorization: Bearer …`、`sk-…`）时，
 *     字段名规则结构上看不到它 ⇒ 原文直出日志。
 *   - 修法只接 `@ihui/shared/utils/redact` 的规则（SECRET_RULES / redactUrl），**禁止端内自拼第二套正则**。
 *
 * 每条都带正向对照：普通文本与 LLM usage 计数字段不得被误伤。
 */
import { Writable } from 'node:stream'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { describe, expect, it } from 'vitest'

import logSanitizerPlugin from '../src/plugins/log-sanitizer.js'

const JWT = 'eyJzZW50aW5lbC1oZWFk.eyJzZW50aW5lbC1ib2R5.c2VudGluZWwtc2ln'
const API_KEY = `sk-${'SENTINELKEYMATERIAL0123456789'}`
const SENTINEL = 'sentinel-plaintext-credential'

interface Harness {
  app: FastifyInstance
  lines: string[]
}

async function buildHarness(log: (request: FastifyRequest) => void): Promise<Harness> {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk))
      cb()
    },
  })
  const app = Fastify({ logger: { level: 'info', stream } })
  await app.register(logSanitizerPlugin, {})
  app.get('/emit', async (request) => {
    log(request)
    return { ok: true }
  })
  await app.ready()
  return { app, lines }
}

describe('G-21③ 日志中间件：自由文本凭据不得以原文出日志', () => {
  it('字符串正文里的 Bearer JWT 与 sk- key 被共享层规则覆盖，普通文本不动', async () => {
    const { app, lines } = await buildHarness((request) => {
      request.log.error(`upstream failed: Authorization: Bearer ${JWT}`)
      request.log.warn(`vendor key rejected: ${API_KEY}`)
      request.log.info('request completed normally')
    })
    await app.inject({ method: 'GET', url: '/emit' })
    await app.close()

    const output = lines.join('\n')
    expect(output).not.toContain(JWT)
    expect(output).not.toContain(API_KEY)
    expect(output).toContain('[REDACTED_SECRET]')
    // 正向对照：正常文本逐字保留（脱敏不是"一律打码"）
    expect(output).toContain('request completed normally')
  })

  it('Error 的 message 与 stack 里的凭据同样被覆盖，字段名规则照旧生效', async () => {
    const { app, lines } = await buildHarness((request) => {
      const err = new Error(`refresh failed near ${JWT}`)
      err.stack = `Error: refresh failed near ${JWT}\n    at handler (/app/x.ts:1:1)`
      request.log.error(err)
      request.log.error({ token: SENTINEL, requestId: 'req-123' }, 'structured field')
    })
    await app.inject({ method: 'GET', url: '/emit' })
    await app.close()

    const output = lines.join('\n')
    expect(output).not.toContain(JWT)
    expect(output).not.toContain(SENTINEL)
    // 既有按字段名打码的语义不变（token ⇒ ***），且非敏感字段不被改动
    expect(output).toContain('"token":"***"')
    expect(output).toContain('req-123')
  })

  it('URL query 里的敏感参数被覆盖，路径与普通参数保留', async () => {
    const { app, lines } = await buildHarness((request) => {
      request.log.error(
        'callback failed: https://api.example.com/cb?access_token=abcd1234&state=ok',
      )
    })
    await app.inject({ method: 'GET', url: '/emit' })
    await app.close()

    const output = lines.join('\n')
    expect(output).not.toContain('access_token=abcd1234')
    expect(output).toContain('state=ok')
    expect(output).toContain('/cb')
  })
})
