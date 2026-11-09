// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-284(P1,数据外泄域):`logger.error(msg, { err })` 绕过凭据打码。
 *
 * 根因:落盘口的自由文本脱敏只盖顶层 msg 与普通对象的字符串叶子;Error 实例被
 * 刻意跳过(避免把 pino 的标准错误序列化 walk 成 `{}`),于是 err.message / stack
 * 里的 `api_key=sk-...`、Bearer 原文原样落盘。
 *
 * 本文件钉住:
 *  ① 顶层保留键 `err` 的 message / stack 内嵌凭据被替换,且仍是 Error 实例;
 *  ② 嵌套(如 `{ context: { error } }`)同样递归到 Error;
 *  ③ 反向牙口:不含凭据的 message 逐字节不变、对象引用不变(不得误伤普通日志)。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { logger, setFastify, type FastifyLogInstance } from '../src/utils/logger.js'

const OPENAI_KEY = 'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
const BEARER_TOKEN = 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789'
const KEY_URL = `https://upstream.example.com/v1/chat?api_key=${OPENAI_KEY}`

interface Captured {
  meta: unknown
  msg: string
}

function capturingSink(): { sink: Captured[]; instance: FastifyLogInstance } {
  const sink: Captured[] = []
  const push = (meta: unknown, msg: string) => {
    sink.push({ meta, msg })
  }
  const instance = {
    log: {
      debug: (m: unknown, msg: string) => push(m, msg),
      info: (m: unknown, msg: string) => push(m, msg),
      warn: (m: unknown, msg: string) => push(m, msg),
      error: (m: unknown, msg: string) => push(m, msg),
    },
  } as unknown as FastifyLogInstance
  return { sink, instance }
}

afterEach(() => {
  // fastifyInstance 是模块级状态:不还原会把捕获器泄漏给后面的测试文件
  setFastify(null as unknown as FastifyLogInstance)
})

describe('F-284 err.message / stack 里的凭据不落盘', () => {
  it('logger.error({ err }) 的 message 与 stack 均过打码', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    const err = new Error(`fetch failed: ${KEY_URL}`)
    err.stack = `Error: fetch failed: ${KEY_URL}\n    at handler (/app/x.ts:1:1)`

    logger.error('upstream failed', { err })

    expect(sink).toHaveLength(1)
    const meta = sink[0]?.meta as { err?: Error }
    expect(meta.err).toBeInstanceOf(Error)
    expect(meta.err?.message).not.toContain(OPENAI_KEY)
    expect(meta.err?.message).toContain('REDACTED')
    expect(meta.err?.stack).not.toContain(OPENAI_KEY)
    // 诊断行本身不得被顺手抹掉
    expect(meta.err?.stack).toContain('at handler')
  })

  it('message 里的 Bearer 原文同样被替换', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    logger.error('auth failed', {
      err: new Error(`Authorization: Bearer ${BEARER_TOKEN} rejected`),
    })

    const meta = sink[0]?.meta as { err?: Error }
    expect(meta.err?.message).not.toContain(BEARER_TOKEN)
    expect(meta.err?.message).toContain('[REDACTED_SECRET]')
  })

  it('嵌套结构里的 Error 也递归打码(不是只看顶层 err)', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    logger.error('batch failed', {
      context: { error: new Error(`upstream 502 from ${KEY_URL}`) },
    })

    const meta = sink[0]?.meta as { context?: { error?: Error } }
    expect(meta.context?.error).toBeInstanceOf(Error)
    expect(meta.context?.error?.message).not.toContain(OPENAI_KEY)
    expect(meta.context?.error?.message).toContain('REDACTED')
  })

  it('反向牙口:普通 message 逐字节不变,且对象引用不被换掉', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    const err = new Error('user 42 not found')

    logger.error('lookup failed', { err })

    const meta = sink[0]?.meta as { err?: Error }
    expect(meta.err).toBe(err)
    expect(meta.err?.message).toBe('user 42 not found')
    expect(sink[0]?.msg).toBe('lookup failed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
