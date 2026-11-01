// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 请求日志不得携带 query 里的凭据(2026-11-01 安全强化)。
 *
 * 病灶有两处,都在"日志落盘口之前":
 *  - nginx `log_format main "... \"$request\" ..."` —— `$request` 是
 *    `METHOD /path?query HTTP/1.1`,WS 票 / access token / api_key 全在 query 里;
 *  - Fastify 默认 `req` 序列化器(pino stdSerializers.req)原样输出 `req.url`。
 *    这条 "incoming request" 发生在 onRequest 钩子**之前**,log-sanitizer 的 Proxy
 *    够不着 ⇒ 只能改序列化器。
 *
 * 本文件守两条:
 *  1. 接线:server.ts 的 loggerConfig 必须用 requestLogSerializer,且不得裸传 req.url;
 *  2. 行为:用**同一份** serializer + 同一份 redact 清单造真 pino,喂
 *     `url: '/api/x?token=SECRET123'`,落盘文本里不得出现 SECRET123。
 *
 * 反向牙口:同一串不带 serializer 时必须**真的**出现 —— 否则"没有 SECRET123"
 * 可能只是输入写错了,测试会变成永远绿的摆设。
 */
import { Writable } from 'node:stream'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import { requestLogSerializer, requestUrlPath } from '../src/plugins/trace.js'
import {
  LOG_REDACT_CENSOR,
  LOG_REDACT_PATHS,
  redactCredentialText,
} from '../src/utils/redact-credential-text.js'

const SECRET = 'SECRET123'
const TOKEN_URL = `/api/x?token=${SECRET}`
const API_KEY_URL = `/v1/realtime?api_key=${SECRET}&model=gpt-4o`

const serverSrc = readFileSync(fileURLToPath(new URL('../src/server.ts', import.meta.url)), 'utf8')
const traceSrc = readFileSync(
  fileURLToPath(new URL('../src/plugins/trace.ts', import.meta.url)),
  'utf8',
)

/** 捕获 pino 落盘文本(不经真实 stdout)。 */
function captureLogger(opts: Record<string, unknown> = {}) {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk))
      cb()
    },
  })
  return { read: () => chunks.join(''), logger: pino(opts, stream) }
}

/** 与 server.ts 的 loggerConfig 同一份 serializer + 同一份 redact 清单。 */
function captureRequestLogger() {
  return captureLogger({
    serializers: { req: requestLogSerializer },
    redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
  })
}

describe('requestUrlPath:只留 path', () => {
  it('剥掉 query,保留 path 与末段', () => {
    expect(requestUrlPath(TOKEN_URL)).toBe('/api/x')
    expect(requestUrlPath(API_KEY_URL)).toBe('/v1/realtime')
    expect(requestUrlPath('/api/health')).toBe('/api/health')
    expect(requestUrlPath('')).toBe('')
    expect(requestUrlPath(undefined)).toBe('')
  })
})

describe('接线:server.ts 的 loggerConfig 收窄 req.url', () => {
  const loggerConfigBlock = serverSrc.slice(
    serverSrc.indexOf('const loggerConfig'),
    serverSrc.indexOf('// 独立 pino 实例'),
  )

  it('loggerConfig 挂了 req 序列化器(而不是让 Fastify 默认实现裸输出)', () => {
    expect(loggerConfigBlock).toContain('serializers:')
    expect(loggerConfigBlock).toContain('req: requestLogSerializer,')
  })

  it('loggerConfig 里没有未处理的 req.url', () => {
    // 序列化器本体在 plugins/trace.ts;配置块里出现 `url: req.url`/`url: request.url`
    // 就说明有人绕过收窄直接把原串塞进日志。
    expect(loggerConfigBlock).not.toMatch(/url:\s*(?:req|request)\.url\b/)
  })

  it('trace 插件的两处 url 都走 requestUrlPath', () => {
    expect(traceSrc).toContain('url: requestUrlPath(request.url)')
    expect(traceSrc).not.toMatch(/url:\s*request\.url\b/)
  })
})

describe('行为:真 pino + 同一份配置,query 凭据不落盘', () => {
  it('incoming request 里的 token 不出现在输出里,path/method 仍在', () => {
    const { read, logger } = captureRequestLogger()
    logger.info({ req: { method: 'GET', url: TOKEN_URL } }, 'incoming request')
    const out = read()
    expect(out).not.toContain(SECRET)
    expect(out).toContain('/api/x')
    expect(out).toContain('GET')
  })

  it('api_key 形态同样不出现在输出里', () => {
    const { read, logger } = captureRequestLogger()
    logger.info({ req: { method: 'GET', url: API_KEY_URL } }, 'incoming request')
    expect(read()).not.toContain(SECRET)
  })

  it('反向牙口:不带 serializer 的 pino,同一串必须真的出现', () => {
    const { read, logger } = captureLogger()
    logger.info({ req: { method: 'GET', url: TOKEN_URL } }, 'incoming request')
    expect(read()).toContain(SECRET)
  })

  it('Free-text 出口(shared redactUrl)也兜住相对 URL —— 其它插件的 url 日志不再裸奔', () => {
    expect(redactCredentialText(TOKEN_URL)).not.toContain(SECRET)
    expect(redactCredentialText(API_KEY_URL)).not.toContain(SECRET)
  })

  it('Fastify 的 "incoming request" 确实走这条序列化器(不是只测了 pino)', async () => {
    const chunks: string[] = []
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(String(chunk))
        cb()
      },
    })
    const app = Fastify({
      logger: { level: 'info', serializers: { req: requestLogSerializer }, stream },
    })
    app.get('/api/x', async () => ({ ok: true }))
    try {
      const res = await app.inject({ method: 'GET', url: TOKEN_URL })
      expect(res.statusCode).toBe(200)
    } finally {
      await app.close()
    }
    const out = chunks.join('')
    expect(out).toContain('incoming request')
    expect(out).not.toContain(SECRET)
    expect(out).toContain('/api/x')
  })
})
