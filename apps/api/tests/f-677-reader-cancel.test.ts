// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-677 回归锁(docs/tickets/2026-11/findings-api.md#F-677)。
 *
 * 病灶:账号池腿按行读上游 SSE 的生成器 finally 只 releaseLock();上游强制 SSE 时
 * translateStreamChunk 抛错走 fail('server')、或命中 [DONE] 提前 break,body 既未读完
 * 也未 cancel ⇒ undici / 独立代理连接要等对端自然结束才能归还,逐请求累积。
 *
 * 本文件锁两件事:
 *   ① 非正常结束(消费者抛错 / 提前 break)⇒ reader.cancel 恰好一次,releaseLock 仍执行;
 *   ② 正常读到流末尾 ⇒ 不 cancel(避免无谓取消),但锁仍然释放。
 *
 * 直接驱动生产生成器(relay-account-forwarder 的 readSseDataLines):不 mock fetch/DB,
 * 只观察底层 ReadableStream 的 cancel 与 reader.releaseLock 计数。
 */
import { describe, expect, it } from 'vitest'
import { __test__ as F } from '../src/services/relay-account-forwarder.js'

interface Counts {
  readerCancel: number
  sourceCancel: number
  releaseLock: number
}

/** 可计数的 body:统计 reader.cancel 调用、底层 source.cancel 是否被触发、releaseLock 次数 */
function trackedStream(
  chunks: string[],
  opts: { close?: boolean } = {},
): { body: ReadableStream<Uint8Array>; counts: Counts } {
  const encoder = new TextEncoder()
  const counts: Counts = { readerCancel: 0, sourceCancel: 0, releaseLock: 0 }
  const raw = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      if (opts.close !== false) controller.close()
    },
    cancel() {
      counts.sourceCancel += 1
    },
  })
  const original = raw.getReader.bind(raw) as () => ReadableStreamDefaultReader<Uint8Array>
  const body = raw as unknown as ReadableStream<Uint8Array> & {
    getReader: () => ReadableStreamDefaultReader<Uint8Array>
  }
  body.getReader = () => {
    const reader = original()
    const cancel = reader.cancel.bind(reader)
    reader.cancel = (reason?: unknown) => {
      counts.readerCancel += 1
      return cancel(reason)
    }
    const releaseLock = reader.releaseLock.bind(reader)
    reader.releaseLock = () => {
      counts.releaseLock += 1
      releaseLock()
    }
    return reader
  }
  return { body, counts }
}

describe('F-677 上游 SSE 读流非正常结束必须 cancel', () => {
  it('消费者中途抛错(translateStreamChunk 同形):cancel 恰好一次且 releaseLock 仍执行', async () => {
    // 上游流未关闭:模拟只到了半截,后续字节仍在路上
    const { body, counts } = trackedStream(['data: {"a":1}\n\n', 'data: {"b":2}\n\n'], {
      close: false,
    })
    const consume = async (): Promise<void> => {
      for await (const line of F.readSseDataLines(body)) {
        expect(line).toContain('data:')
        // 等价于 translateStreamChunk 抛错:for-await 会调生成器 return() 走 finally
        throw new Error('translateStreamChunk boom')
      }
    }
    await expect(consume()).rejects.toThrow('translateStreamChunk boom')
    expect(counts.readerCancel).toBe(1)
    expect(counts.sourceCancel).toBe(1)
    expect(counts.releaseLock).toBe(1)
  })

  it('命中 [DONE] 提前 break:残余字节所在 body 被 cancel 一次', async () => {
    const { body, counts } = trackedStream(
      ['data: {"a":1}\n\n', 'data: [DONE]\n\ndata: {"residual":true}\n\n'],
      { close: false },
    )
    for await (const line of F.readSseDataLines(body)) {
      if (line.includes('[DONE]')) break
    }
    expect(counts.readerCancel).toBe(1)
    expect(counts.sourceCancel).toBe(1)
    expect(counts.releaseLock).toBe(1)
  })

  it('正常读到流末尾:不调用 cancel,锁仍释放', async () => {
    const { body, counts } = trackedStream(['data: {"a":1}\n\ndata: {"b":2}\n\n'])
    const lines: string[] = []
    for await (const line of F.readSseDataLines(body)) lines.push(line)
    expect(lines).toEqual(['data: {"a":1}', 'data: {"b":2}'])
    expect(counts.readerCancel).toBe(0)
    expect(counts.sourceCancel).toBe(0)
    expect(counts.releaseLock).toBe(1)
  })

  it('上游流自身报错:仍尝试 cancel 一次,releaseLock 不抛锁冲突', async () => {
    const counts: Counts = { readerCancel: 0, sourceCancel: 0, releaseLock: 0 }
    const raw = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('upstream reset'))
      },
      cancel() {
        counts.sourceCancel += 1
      },
    })
    const original = raw.getReader.bind(raw) as () => ReadableStreamDefaultReader<Uint8Array>
    const body = raw as unknown as ReadableStream<Uint8Array> & {
      getReader: () => ReadableStreamDefaultReader<Uint8Array>
    }
    body.getReader = () => {
      const reader = original()
      const cancel = reader.cancel.bind(reader)
      reader.cancel = (reason?: unknown) => {
        counts.readerCancel += 1
        return cancel(reason)
      }
      const releaseLock = reader.releaseLock.bind(reader)
      reader.releaseLock = () => {
        counts.releaseLock += 1
        releaseLock()
      }
      return reader
    }
    const gen = F.readSseDataLines(body)
    await expect(gen.next()).rejects.toThrow('upstream reset')
    expect(counts.readerCancel).toBe(1)
    expect(counts.releaseLock).toBe(1)
  })
})
