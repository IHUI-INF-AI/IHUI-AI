// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `@ihui/types` error 序列化唯一出口的单测。
 *
 * 守的四件事:
 * 1. message 经 JSON 往返仍可见(本出口存在的全部理由:JSON.stringify(Error) === "{}");
 * 2. 闭集 —— 挂在 Error 上的未知字段(可能装请求体/凭据)一律不带出;
 * 3. 循环 cause 不炸栈,且在截断处显式 truncated,而不是静默丢;
 * 4. 非 Error 输入与坏 getter 都不抛(出口常站在崩溃恢复路径上)。
 */
import { describe, expect, it } from 'vitest'
import {
  serializeError,
  ERROR_SERIALIZE_MAX_DEPTH,
  type SerializedError,
} from '../src/error-serialize'

type Causable = Error & { cause?: unknown }

/** 造 depth 层的 cause 链:外层 cause 内层,共 depth 个 Error 节点(depth >= 1)。 */
function buildChain(depth: number): Error {
  let inner: Error | undefined
  for (let i = depth - 1; i >= 0; i--) {
    const next = new Error(`msg-${String(i)}`)
    next.name = `Err${String(i)}`
    if (inner) (next as Causable).cause = inner
    inner = next
  }
  if (!inner) throw new Error('buildChain requires depth >= 1')
  return inner
}

describe('serializeError 闭集形状', () => {
  it('Error 经我方出口后 message 在 JSON 里可见(摘掉出口则退化为 "{}")', () => {
    const err = new Error('boom')
    const wire = JSON.stringify(serializeError(err))
    expect(wire).toContain('boom')
    expect(wire).toContain('"name":"Error"')
    expect(wire).toContain('"stack"')
  })

  it('挂在 Error 上的未知字段一律不带出(闭集,不为凭据开车道)', () => {
    const err = new Error('safe message') as Error & { apiKey?: string; requestBody?: string }
    err.apiKey = 'SECRET-DO-NOT-LEAK'
    err.requestBody = '{"password":"hunter2"}'
    const wire = JSON.stringify(serializeError(err))
    expect(wire).toContain('safe message')
    expect(wire).not.toContain('SECRET-DO-NOT-LEAK')
    expect(wire).not.toContain('hunter2')
    // 顶层键逐字只有白名单内出现过的几个
    expect(Object.keys(serializeError(err)).sort()).toEqual(['message', 'name', 'stack'].sort())
  })

  it('自定义 name 保留(Error 子类型不被压平为 "Error")', () => {
    const err = new Error('x')
    err.name = 'ValidationError'
    expect(serializeError(err).name).toBe('ValidationError')
  })
})

describe('serializeError 非 Error 输入', () => {
  it('字符串输入 ⇒ { name: NonThrownError, message: 原文 }', () => {
    expect(serializeError('oops')).toEqual({ name: 'NonThrownError', message: 'oops' })
  })

  it('undefined / null / 对象都落 String 形态,不抛', () => {
    expect(serializeError(undefined).message).toBe('undefined')
    expect(serializeError(null).message).toBe('null')
    expect(serializeError({ a: 1 }).message).toBe('[object Object]')
  })

  it('toString 抛错的恶意对象也不抛(恢复路径上二次抛 = 事故×2)', () => {
    const evil = {
      toString(): string {
        throw new Error('nope')
      },
    }
    expect(() => serializeError(evil)).not.toThrow()
    expect(serializeError(evil).name).toBe('NonThrownError')
  })
})

describe('serializeError cause 链', () => {
  it('非 Error 的 cause 也序列化(不静默丢),名字同样落 NonThrownError', () => {
    const err = new Error('outer') as Causable
    err.cause = 42
    const out = serializeError(err)
    expect(out.cause?.name).toBe('NonThrownError')
    expect(out.cause?.message).toBe('42')
  })

  it('循环 cause(a→b→a)不炸栈,且截断处显式 truncated', () => {
    const a = new Error('a') as Causable
    const b = new Error('b') as Causable
    a.cause = b
    b.cause = a
    let out: SerializedError | undefined
    expect(() => {
      out = serializeError(a)
    }).not.toThrow()
    expect(out?.message).toBe('a')
    expect(out?.cause?.message).toBe('b')
    // b 的 cause 指回 a:不是链到此为止,而是被循环检测截断 —— 必须留标注
    expect(out?.cause?.truncated).toBe(true)
    expect(out?.cause?.cause).toBeUndefined()
  })

  it('深度在封顶处截断并标注 truncated(而不是静默丢)', () => {
    const deep = buildChain(ERROR_SERIALIZE_MAX_DEPTH + 3)
    const out = serializeError(deep)
    // 展开的节点数恰等于封顶
    let count = 0
    let node: SerializedError | undefined = out
    while (node) {
      count += 1
      node = node.cause
    }
    expect(count).toBe(ERROR_SERIALIZE_MAX_DEPTH)
    // 最深层节点带 truncated 且没有 cause(截断是显式声明,不是消失)
    let tail: SerializedError = out
    while (tail.cause) tail = tail.cause
    expect(tail.truncated).toBe(true)
    expect(tail.cause).toBeUndefined()
  })

  it('链短于封顶时无 truncated(标注只留给真被截断的链)', () => {
    const out = serializeError(buildChain(2))
    expect(out.cause?.truncated).toBeUndefined()
    expect(out.truncated).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
