// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * errorHandler 那枚独立 pino 的脱敏闸(2026-11-01 安全强化)。
 *
 * 这型缺陷的成因同样是"闸装错了层",但比上一枚更隐蔽:
 * `utils/logger.ts` 已经把自由文本打码接在**唯一落盘口**,而 `server.ts` 里的
 * `pino(loggerConfig)` 是**第二个落盘口** —— errorHandler 在 server 创建前就要用日志,
 * 拿不到 `server.log`,于是自己造了一枚。它不经 log-sanitizer 的 Proxy,也不经
 * utils/logger 的包装,所以那两处 `logger.error/warn` 里的凭据一直原样落盘。
 *
 * 两条闸分工不同,所以每条都要有牙口:
 * - `redactErrorForLog`:管 message/stack 里**内嵌**的凭据串(字段名匹配够不着);
 * - `LOG_REDACT_PATHS`:管**结构化字段**(如 `{ err: { api_key } }`),内容打码够不着。
 * 任何一条缺反向牙口,"闸其实没装在这条链上"都会静默变成假绿。
 */
import { Writable } from 'node:stream'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import {
  LOG_REDACT_CENSOR,
  LOG_REDACT_PATHS,
  redactCredentialText,
  redactErrorForLog,
} from '../src/utils/redact-credential-text.js'

const TOKEN_URL = 'https://upstream.example.com/v1/chat?token=eyJhbGciOiJIUzI1.abcdef.REALsig'
const OPENAI_KEY = 'sk-proj-AbCdEf1234567890abcdef'

/** 捕获 pino 落盘文本(不经真实 stdout)。 */
function captureLogger(opts: Record<string, unknown> = {}): {
  read: () => string
  logger: ReturnType<typeof pino>
} {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk))
      cb()
    },
  })
  const logger = pino(opts, stream)
  return { read: () => chunks.join(''), logger }
}

/** 与 server.ts 的 loggerConfig 用**同一份**清单构造(不复制判据)。 */
function captureRedactingLogger() {
  return captureLogger({
    redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
  })
}

describe('redactErrorForLog:message/stack 里内嵌的凭据不落盘', () => {
  it('message 里的 token 查询串被打码', () => {
    const err = new Error(`fetch failed: ${TOKEN_URL}`)
    const shadow = redactErrorForLog(err)
    expect(shadow.message).not.toContain('eyJhbGciOiJIUzI1')
    expect(shadow.message).toContain('***REDACTED***')
  })

  it('stack 同样过闸(首行复述 message,不打码等于白做)', () => {
    const err = new Error(`upstream 502 from ${TOKEN_URL}`)
    err.stack = `Error: upstream 502 from ${TOKEN_URL}\n    at handler (/app/x.ts:1:1)`
    const shadow = redactErrorForLog(err)
    expect(shadow.stack).not.toContain('eyJhbGciOiJIUzI1')
    expect(shadow.stack).toContain('at handler')
  })

  it('原型不动:pino 的 err.type 仍是原始类型名(告警规则不被打乱)', () => {
    class AppError extends Error {}
    const shadow = redactErrorForLog(new AppError('boom'))
    expect(shadow.constructor.name).toBe('AppError')
    expect(shadow).toBeInstanceOf(AppError)
  })

  it('自有可枚举属性原样带出(诊断字段不丢)', () => {
    const err = Object.assign(new Error('boom'), { statusCode: 502, code: 'UPSTREAM' })
    const shadow = redactErrorForLog(err)
    expect((shadow as unknown as { statusCode: number }).statusCode).toBe(502)
    expect((shadow as unknown as { code: string }).code).toBe('UPSTREAM')
  })

  it('原 error 不被改写:4xx 分支还要用它生成对外文案', () => {
    const err = new Error(`bad input ${TOKEN_URL}`)
    const before = err.message
    redactErrorForLog(err)
    expect(err.message).toBe(before)
    expect(err.message).toContain('eyJhbGciOiJIUzI1')
  })

  it('无凭据的行逐字节不变(闸不得改写出错信息本身)', () => {
    const err = new Error('user 42 not found')
    expect(redactErrorForLog(err).message).toBe('user 42 not found')
  })
})

describe('LOG_REDACT_PATHS:结构化字段按字段名打码', () => {
  it('{ err: { api_key } } 被打码', () => {
    const { read, logger } = captureRedactingLogger()
    logger.error({ err: { api_key: OPENAI_KEY } }, 'upstream failed')
    expect(read()).not.toContain(OPENAI_KEY)
    expect(read()).toContain(LOG_REDACT_CENSOR)
  })

  it('请求头那一层被打码(authorization / cookie)', () => {
    const { read, logger } = captureRedactingLogger()
    logger.info(
      {
        req: { headers: { authorization: `Bearer ${OPENAI_KEY}`, cookie: 'sid=SECRETSID' } },
      },
      'incoming',
    )
    expect(read()).not.toContain(OPENAI_KEY)
    expect(read()).not.toContain('SECRETSID')
  })

  it('两层嵌套的上游 SDK 错误体被打码', () => {
    const { read, logger } = captureRedactingLogger()
    logger.error({ err: { config: { headers: { authorization: `Bearer ${OPENAI_KEY}` } } } }, 'x')
    expect(read()).not.toContain(OPENAI_KEY)
  })

  it('反向牙口:不带 redact 的 pino,同一串必须**真的**带明文', () => {
    const { read, logger } = captureLogger()
    logger.error({ err: { api_key: OPENAI_KEY } }, 'upstream failed')
    expect(read()).toContain(OPENAI_KEY)
  })
})

describe('接线:server.ts 的两处日志都必须过闸', () => {
  const serverSrc = readFileSync(
    fileURLToPath(new URL('../src/server.ts', import.meta.url)),
    'utf8',
  )

  it('loggerConfig 用共享清单,而不是自己写一份 paths', () => {
    expect(serverSrc).toContain('paths: [...LOG_REDACT_PATHS]')
    expect(serverSrc).toContain('censor: LOG_REDACT_CENSOR')
  })

  it('5xx 分支传的是影子而不是原 error', () => {
    expect(serverSrc).toContain("logger.error({ err: errorForLog(error) }, 'Unhandled error')")
    expect(serverSrc).not.toContain("logger.error({ err: error }, 'Unhandled error')")
  })

  it('4xx 分支的 message 过 redactCredentialText', () => {
    expect(serverSrc).toContain(
      "logger.warn({ err: redactCredentialText(error.message ?? ''), statusCode }, 'Request error')",
    )
  })

  it('出口本身对三类形态都有效(不靠调用方兜圈)', () => {
    expect(redactCredentialText(TOKEN_URL)).not.toContain('eyJhbGciOiJIUzI1')
    expect(redactCredentialText(`key=${OPENAI_KEY}`)).not.toContain(OPENAI_KEY)
  })
})
