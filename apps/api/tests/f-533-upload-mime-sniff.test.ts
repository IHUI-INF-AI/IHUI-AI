// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-533 回归锁:客户端自报 MIME 不得单独决定解析器 / 入库类型。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-533):
 *   /api/knowledge/upload 把 multipart 的 data.mimetype 原样交给 parseDocument,
 *   parseDocument 又让「显式传入 MIME」优先于扩展名兜底,无任何扩展名/魔数校验 ⇒
 *     ① evil.exe + Content-Type: text/plain → 按 UTF-8 文本切片/embedding 入库;
 *     ② .txt 声明 application/pdf → 直接送进 unpdf/anydoc。
 *
 * 修复(本席允许清单内部分):parseDocument 在解析器分发前按真实字节校验 —— 复用
 *   file-type-validator.checkMagicNumber(魔数判据单一真相源),容器类声明要求对应文件头,
 *   纯文本类声明拒绝二进制载荷(NUL / 控制字符)。knowledge-rag.ts 路由与
 *   knowledge-rag-service.ts 的 sourceType 标注不在本席允许清单,另行请求扩权。
 *
 * 接线锁 + 真实行为锁(既有 document-parser / preview-envelope 用例须继续通过)。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const parserSrc = readFileSync(
  resolve(REPO_ROOT, 'apps/api/src/services/document-parser.ts'),
  'utf8',
)
const { parseDocument } = await import('../src/services/document-parser.js')

describe('F-533:客户端自报 MIME 不得单独决定解析器', () => {
  it('接线锁:parseDocument 在分发前按真实字节校验,魔数判据复用单一真相源', () => {
    expect(parserSrc).toMatch(
      /import \{ checkMagicNumber \} from '\.\.\/utils\/file-type-validator\.js'/,
    )
    expect(parserSrc).toMatch(/assertContentMatchesMime\(buffer, mime\)/)
    expect(parserSrc).toMatch(/const MAGIC_EXT_BY_MIME/)
  })

  it('行为锁:evil.exe 声明 text/plain → 二进制不得按 UTF-8 文本入库', async () => {
    const exe = Buffer.concat([
      Buffer.from('MZ'),
      Buffer.alloc(64, 0),
      Buffer.from('This program cannot be run in DOS mode'),
    ])
    await expect(
      parseDocument({ buffer: exe, mimeType: 'text/plain', filename: 'evil.exe' }),
    ).rejects.toThrow(/二进制载荷|不一致/)
  })

  it('行为锁:.txt 声明 application/pdf → 无 %PDF 头不得送进 unpdf/anydoc', async () => {
    await expect(
      parseDocument({
        buffer: Buffer.from('just plain text', 'utf8'),
        mimeType: 'application/pdf',
        filename: 'note.txt',
      }),
    ).rejects.toThrow(/magic number 校验失败/)
  })

  it('对照锁:合法纯文本仍按原文入库(不误伤正常链路)', async () => {
    const text = 'Hello RAG\n中文测试'
    await expect(
      parseDocument({
        buffer: Buffer.from(text, 'utf8'),
        mimeType: 'text/plain',
        filename: 'hello.txt',
      }),
    ).resolves.toBe(text)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
