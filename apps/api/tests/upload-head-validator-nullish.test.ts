// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内容类型闸的"全函数"回归锁(2026-11-01)。
 *
 * 缺陷形状:`extractExt()` 的签名写的是 `string`,但调用方交进来的是**会话行的
 * `fileName`**(`uploadSessions.fileName` 可为 null;测试夹具则根本不带这个键)。
 * Node 的 `path.extname(undefined)` 抛 `ERR_INVALID_ARG_TYPE` —— 而这一 throw 落在
 * `chunked-upload.ts` 合并段的 `catch` 里被折成 500,于是:
 *   ① 本该 fail-closed 的 CWE-434 内容闸变成了崩溃(500 而不是 415);
 *   ② 崩溃那一支不删 `finalPath`(它就在 `uploads/public/<uuid>` 下)⇒ 被拒产物长期留盘。
 * 判"没有扩展名"是业务结论,不该是崩溃。
 */
import { describe, it, expect } from 'vitest'
import { extractExt, validateUploadHead } from '../src/utils/file-type-validator.js'

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 9])

describe('extractExt / validateUploadHead 对 nullish 文件名必须是全函数', () => {
  it('extractExt:undefined / null / 空串 ⇒ 空串(不是 throw)', () => {
    expect(extractExt(undefined)).toBe('')
    expect(extractExt(null)).toBe('')
    expect(extractExt('')).toBe('')
  })

  it('extractExt:正向对照 —— 正常名字照旧取到小写无点扩展名', () => {
    expect(extractExt('a.PNG')).toBe('png')
    expect(extractExt('notes.tar.gz')).toBe('gz')
  })

  it('validateUploadHead:fileName 为 undefined ⇒ 拒绝并点名原因,不抛', () => {
    let verdict
    expect(() => {
      verdict = validateUploadHead(PNG_HEAD, undefined, '')
    }).not.toThrow()
    expect(verdict?.ok).toBe(false)
    expect(verdict && !verdict.ok ? verdict.reason : '').toContain('扩展名')
  })

  it('validateUploadHead:null fileName 同样走业务拒绝通道(与空串同形)', () => {
    const verdict = validateUploadHead(PNG_HEAD, null, '')
    expect(verdict.ok).toBe(false)
  })

  it('接线锁:调用侧不得再把未清洗的会话 fileName 直喂给别的 throw 型判据', async () => {
    const src = await import('node:fs/promises').then((m) =>
      m.readFile(new URL('../src/routes/chunked-upload.ts', import.meta.url), 'utf8'),
    )
    // 合并段的兜底 catch 必须先删产物再折 500(否则"崩溃 = 留一份公网可寻址的孤儿文件")
    expect(src).toMatch(/if \(existsSync\(finalPath\)\) unlinkSync\(finalPath\)/)
    // 415 文案里的文件名必须已被 nullish 兜住
    expect(src).toMatch(/session\.fileName \?\? '\(会话未提供文件名\)'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
