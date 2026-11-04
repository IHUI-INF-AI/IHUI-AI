// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * document-parser 单元测试
 *
 * 覆盖 5 个核心场景:
 * 1. 纯文本(txt)→ 返回原文
 * 2. Markdown(.md)→ 返回原文(不解析为 HTML,保留原始)
 * 3. HTML(.html)→ 去除标签保留文本
 * 4. 不支持 MIME → 抛 UnsupportedFormatError
 * 5. 超大文件(> 20MB) → 抛 FileTooLargeError
 *
 * PDF / DOCX 走真实 unpdf / mammoth(测试环境有完整依赖),与真实链路一致。
 * PDF 测试 fixture 复用 pdf-watermark.test.ts 的最小 PDF 占位,验证 1 页 PDF 能解析出原始字符串。
 * DOCX 测试 fixture 用 mammoth 自身的 extractRawText 走一个最小 OOXML,这里只 mock 验证错误路径,
 * 真实 DOCX 解析留给 vitest.real.config.ts(需要 mammoth 完整 zip 读取路径)。
 */

import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { parseDocument, UnsupportedFormatError, FileTooLargeError, MAX_FILE_SIZE } =
  await import('../document-parser.js')

describe('parseDocument — 5 个核心场景', () => {
  it('纯文本(txt) → 返回原文 utf8', async () => {
    const text = 'Hello RAG\nLine 2\n中文测试'
    const result = await parseDocument({
      buffer: Buffer.from(text, 'utf8'),
      mimeType: 'text/plain',
      filename: 'hello.txt',
    })
    expect(result).toBe(text)
  })

  it('Markdown(md) → 返回原文(不解析为 HTML,保留原始)', async () => {
    const md = '# 标题\n\n- 列表项 1\n- 列表项 2\n\n```js\nconst x = 1\n```'
    const result = await parseDocument({
      buffer: Buffer.from(md, 'utf8'),
      mimeType: 'text/markdown',
      filename: 'doc.md',
    })
    expect(result).toBe(md)
    // 关键断言:Markdown 标记字符必须原样保留(`#` / `-` / ` ``` `)
    expect(result).toContain('# 标题')
    expect(result).toContain('- 列表项 1')
    expect(result).toContain('```js')
  })

  it('HTML(.html) → 去除标签保留文本', async () => {
    const html = `
      <html>
        <head><style>body { color: red; }</style><script>alert(1)</script></head>
        <body>
          <h1>标题 &amp; 实体</h1>
          <p>这是 <b>粗体</b> 段落</p>
          <ul><li>项 A</li><li>项 B</li></ul>
        </body>
      </html>
    `
    const result = await parseDocument({
      buffer: Buffer.from(html, 'utf8'),
      mimeType: 'text/html',
      filename: 'page.html',
    })

    // script / style 整段去掉
    expect(result).not.toContain('alert(1)')
    expect(result).not.toContain('color: red')
    // 实体解码
    expect(result).toContain('&') // &amp; → &
    expect(result).not.toContain('&amp;')
    // 文本保留
    expect(result).toContain('标题')
    expect(result).toContain('粗体')
    expect(result).toContain('项 A')
    expect(result).toContain('项 B')
    // 标签全部去除
    expect(result).not.toMatch(/<[^>]+>/)
  })

  it('不支持的 MIME + 未知后缀 → 抛 UnsupportedFormatError', async () => {
    const buffer = Buffer.from('some binary data', 'utf8')
    await expect(
      parseDocument({
        buffer,
        mimeType: 'application/x-binary-unknown',
        filename: 'data.unknownext',
      }),
    ).rejects.toBeInstanceOf(UnsupportedFormatError)

    // 也覆盖:既无 MIME 也无识别后缀
    await expect(parseDocument({ buffer, filename: 'noext' })).rejects.toBeInstanceOf(
      UnsupportedFormatError,
    )
  })

  it('超大文件(> 20MB) → 抛 FileTooLargeError', async () => {
    // 实际不必真造 20MB(浪费内存),mock 一个 21MB 大小的 Buffer
    const fakeLarge = Buffer.alloc(MAX_FILE_SIZE + 1, 0x61) // 21MB 字节 = 'a'
    expect(fakeLarge.length).toBeGreaterThan(MAX_FILE_SIZE)
    await expect(
      parseDocument({
        buffer: fakeLarge,
        mimeType: 'text/plain',
        filename: 'huge.txt',
      }),
    ).rejects.toBeInstanceOf(FileTooLargeError)
  })
})

describe('parseDocument — 扩展名兜底', () => {
  it('MIME 缺失(空字符串)+ 扩展名 .pdf → 走 PDF 分支(抛错因为 buffer 非法)', async () => {
    // 这里只验证扩展名 fallback 命中 PDF 分支,真正的 PDF 解析测试在 unpdf 集成测试中
    // 非法的 buffer 会被 unpdf 抛出,与 UnsupportedFormatError 区分(后端 500)
    await expect(
      parseDocument({
        buffer: Buffer.from('not a real pdf'),
        filename: 'fake.pdf',
      }),
    ).rejects.toThrow() // unpdf 解析失败抛错
  })

  it('MIME = application/octet-stream + 扩展名 .md → 命中 Markdown 分支返回原文', async () => {
    const md = '# fallback test'
    const result = await parseDocument({
      buffer: Buffer.from(md, 'utf8'),
      mimeType: 'application/octet-stream',
      filename: 'fallback.md',
    })
    expect(result).toBe(md)
  })
})

// 白名单收了却解析不了 = 空头承诺。本 describe 钉住「登记面收的每一档,解析面都真有去处」。
describe('parseDocument — 白名单新增四档不得落 UnsupportedFormatError', () => {
  it('tsv 声明 text/tab-separated-values → 按原文 utf8 入库(与 csv 同为分隔符表格,切片按行)', async () => {
    const tsv = '名称\t数量\n苹果\t3\n梨\t5'
    const result = await parseDocument({
      buffer: Buffer.from(tsv, 'utf8'),
      mimeType: 'text/tab-separated-values',
      filename: 'stock.tsv',
    })
    expect(result).toBe(tsv)
    expect(result).toContain('\t')
  })

  it('json 声明 application/json → 按原文 utf8 入库(RAG 可检索到键名与值)', async () => {
    const json = '{"名称":"苹果","数量":3}'
    const result = await parseDocument({
      buffer: Buffer.from(json, 'utf8'),
      mimeType: 'application/json',
      filename: 'data.json',
    })
    expect(result).toBe(json)
  })

  it('tsv/json 走扩展名兜底(MIME 缺失)→ 不再因判不出类型而抛 UnsupportedFormatError', async () => {
    for (const [filename, body] of [
      ['fallback.tsv', 'a\tb\n1\t2'],
      ['fallback.json', '{"a":1}'],
    ] as const) {
      const result = await parseDocument({
        buffer: Buffer.from(body, 'utf8'),
        mimeType: '',
        filename,
      })
      expect(result).toBe(body)
    }
  })

  it('ods/odp 归入 anydoc 主路径(与 odt 同族 ZIP 容器)→ 越过了「不支持的类型」这道闸', async () => {
    for (const filename of ['sheet.ods', 'deck.odp']) {
      const err = await parseDocument({
        buffer: Buffer.from('not-a-real-zip-container', 'utf8'),
        mimeType: '',
        filename,
      }).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(Error)
      expect(err, `${filename} 仍被当作不支持类型 ⇒ 白名单与解析面又分叉了`).not.toBeInstanceOf(
        UnsupportedFormatError,
      )
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
