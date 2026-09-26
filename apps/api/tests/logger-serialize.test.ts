// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * api 结构化日志 error 序列化接入的回归(2026-09-26 立)。
 *
 * 判的是:meta 里非保留键的 Error 值在交给 pino(这里用捕获替身)之前,已经过
 * 唯一出口 serializeError 转成闭集结构 —— message 可见,而挂在 Error 上的未知
 * 字段(请求体/凭据一类)不进日志。既有脱敏链(response-sanitizer)只在**响应**面,
 * 日志面此前无人看守,这正是本接入补的那一维。
 */
import { describe, expect, it } from 'vitest'
import {
  logger,
  serializeErrorFields,
  setFastify,
  type FastifyLogInstance,
} from '../src/utils/logger.js'

interface Captured {
  level: string
  meta: unknown
  msg: string
}

function capturingSink(): { sink: Captured[]; instance: FastifyLogInstance } {
  const sink: Captured[] = []
  const at = (level: string) => (meta: object, msg: string): void => {
    sink.push({ level, meta, msg })
  }
  const instance: FastifyLogInstance = {
    log: { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') },
  }
  return { sink, instance }
}

describe('serializeErrorFields', () => {
  it('error 键的 Error 值经出口后 message 可见,未知字段不带出', () => {
    const err = new Error('db connection lost') as Error & { dsn?: string }
    err.dsn = 'postgres://user:SECRET@host/db'
    const out = serializeErrorFields({ error: err, code: 42 })
    const record = out as { error: { message?: string; name?: string }; code: number }
    expect(record.error.message).toBe('db connection lost')
    expect(record.error.name).toBe('Error')
    expect(record.code).toBe(42)
    expect(JSON.stringify(out)).not.toContain('SECRET')
  })

  it('err 保留键不动(pino 自带标准序列化,覆盖反而改变既有消费方看到的形状)', () => {
    const meta = { err: new Error('keep') }
    expect(serializeErrorFields(meta)).toBe(meta)
  })

  it('无 Error 值时原样返回同一引用(零行为变化)', () => {
    const meta = { a: 1, b: 'two' }
    expect(serializeErrorFields(meta)).toBe(meta)
  })

  it('meta 本体是 Error 时收进 error 键', () => {
    const out = serializeErrorFields(new Error('bare throw')) as {
      error: { message?: string }
    }
    expect(out.error.message).toBe('bare throw')
  })

  it('undefined 原样透传', () => {
    expect(serializeErrorFields(undefined)).toBeUndefined()
  })
})

describe('logger → pino 落笔前的序列化(经 setFastify 捕获面)', () => {
  it('logger.error 的 meta.error 到达 pino 时 message 已可见', () => {
    const { sink, instance } = capturingSink()
    setFastify(instance)
    logger.error('request failed', { error: new Error('upstream 502') })
    expect(sink).toHaveLength(1)
    const meta = sink[0]?.meta as { error?: { message?: string; name?: string } }
    expect(meta.error?.message).toBe('upstream 502')
    expect(meta.error?.name).toBe('Error')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
