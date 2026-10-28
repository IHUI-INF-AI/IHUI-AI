// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 传输层兜底加固的回归锁(2026-10-28 立)。
 *
 * 守两件事,都是"旧行为看着无害、实际会静默出错"的类型:
 *   1) 未注册 Content-Type 带非空 body ⇒ 必须 415,不能静默吞成空 Buffer
 *      (旧实现吞掉后 handler 按空处理仍回 200 ⇒ webhook 数据丢失且无日志);
 *   2) /uploads 静态文件必须带沙箱 CSP + nosniff(PDF 可直接在浏览器打开)。
 *
 * 同时钉住"空 body 仍放行"这条不能动 —— RN App 的无 body 写操作依赖它。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  UPLOADS_CSP,
  applyUploadsStaticHardening,
  isUploadsStaticPath,
  wildcardContentTypeParser,
} from '../src/utils/static-hardening.js'

function runParser(body: Buffer) {
  return new Promise<{ err: Error | null; result?: unknown }>((resolve) => {
    wildcardContentTypeParser({} as never, body, (err, result) => resolve({ err, result }))
  })
}

describe('未注册 Content-Type:空 body 放行,非空 body 415', () => {
  it('空 Buffer ⇒ 放行(无 body 的 POST 不能被打死)', async () => {
    const { err, result } = await runParser(Buffer.alloc(0))
    expect(err).toBeNull()
    expect(Buffer.isBuffer(result)).toBe(true)
    expect((result as Buffer).length).toBe(0)
  })

  it('非空 body ⇒ 415,而不是静默吞成空', async () => {
    const { err } = await runParser(Buffer.from('<xml><out_bill_no>x</out_bill_no></xml>'))
    expect(err).toBeInstanceOf(Error)
    expect((err as Error & { statusCode?: number }).statusCode).toBe(415)
    expect(err?.message).toContain('Unsupported Media Type')
  })

  it('单字节也算非空(边界不放过)', async () => {
    const { err } = await runParser(Buffer.from('x'))
    expect((err as (Error & { statusCode?: number }) | null)?.statusCode).toBe(415)
  })

  it('非 Buffer 输入按空处理(防御上游类型漂移)', async () => {
    const { err } = await runParser(undefined as unknown as Buffer)
    expect(err).toBeNull()
  })
})

describe('/uploads 静态目录 CSP', () => {
  it('路径判定:带不带查询串都认,前缀不同不认', () => {
    expect(isUploadsStaticPath('/uploads/public/a.png')).toBe(true)
    expect(isUploadsStaticPath('/uploads/public/a.png?v=2')).toBe(true)
    expect(isUploadsStaticPath('/api/uploads/x')).toBe(false)
    expect(isUploadsStaticPath('/uploadsx/a.png')).toBe(false)
    expect(isUploadsStaticPath(undefined)).toBe(false)
  })

  it('命中时补 CSP 与 nosniff', () => {
    const header = vi.fn()
    const changed = applyUploadsStaticHardening({ url: '/uploads/public/a.pdf' }, {
      header,
    } as never)
    expect(changed).toBe(true)
    expect(header).toHaveBeenCalledWith('Content-Security-Policy', UPLOADS_CSP)
    expect(header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
  })

  it('非 /uploads 请求一个头都不加(不能污染 JSON 响应)', () => {
    const header = vi.fn()
    const changed = applyUploadsStaticHardening({ url: '/api/health' }, { header } as never)
    expect(changed).toBe(false)
    expect(header).not.toHaveBeenCalled()
  })

  it('CSP 必须带 sandbox 且禁脚本(这是防 PDF 内嵌脚本的唯一一道)', () => {
    expect(UPLOADS_CSP).toContain('sandbox')
    expect(UPLOADS_CSP).toContain("script-src 'none'")
    expect(UPLOADS_CSP).toContain("default-src 'none'")
  })
})

describe('接线锁:server.ts 必须用这两个单源出口', () => {
  it('不得再内联通配解析器逻辑,也不得退回无条件吞 body', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8')
    expect(src).toContain('wildcardContentTypeParser')
    expect(src).toContain('applyUploadsStaticHardening')
    // 旧写法:通配解析器里无条件 Buffer.alloc(0)
    expect(src).not.toMatch(
      /\*\s*',\s*\{[^}]*parseAs:\s*'buffer'[^}]*\},[\s\S]{0,120}Buffer\.alloc\(0\)/,
    )
  })
})
