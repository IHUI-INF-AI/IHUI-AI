// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  allHunkIds,
  buildRevisionDiff,
  exportRevision,
  inlineDiffSegments,
  mergeRevision,
  revisionFileName,
  revisionStats,
} from '../document-revision'
import { makeDocx } from './fixtures/make-docx'

/**
 * 文档修订导出单测(2026-11-28 立)。
 *
 * 锁四类不变量:
 *  1. 逐 hunk 接受/驳回的合并语义(全驳回 === 原文);
 *  2. 导出扩展名不被原扩展名污染(`报告.docx` 不能变成 `报告.docx-修订稿.md`);
 *  3. docx 能写回时给 .docx,结构对不上时降级 Markdown 并带原因;
 *  4. 文本格式保持原扩展名。
 */
describe('inlineDiffSegments', () => {
  it('只切出改动的那一截,前后缀逐字保留', () => {
    const seg = inlineDiffSegments(
      '第一条 甲方应在三日内付款。',
      '第一条 甲方应在五个工作日内付款。',
    )
    expect(seg.prefix).toBe('第一条 甲方应在')
    expect(seg.oldChanged).toBe('三')
    expect(seg.newChanged).toBe('五个工作')
    expect(seg.suffix).toBe('日内付款。')
  })

  it('纯尾部插入/删除时一侧改动为空', () => {
    const ins = inlineDiffSegments('第一条 甲方应付款。', '第一条 甲方应付款。补充：逾期按日计息。')
    expect(ins.prefix).toBe('第一条 甲方应付款。')
    expect(ins.oldChanged).toBe('')
    expect(ins.newChanged).toBe('补充：逾期按日计息。')

    const del = inlineDiffSegments('第一条 甲方应付款。补充：逾期按日计息。', '第一条 甲方应付款。')
    expect(del.oldChanged).toBe('补充：逾期按日计息。')
    expect(del.newChanged).toBe('')
  })

  it('整行替换时前缀后缀只保留公共头尾,不误标', () => {
    const seg = inlineDiffSegments('第一条 甲方应在三日内付款。', '第二条 乙方应在七日内交付。')
    expect(seg.prefix).toBe('第')
    expect(seg.suffix).toBe('。')
    expect(seg.oldChanged).toBe('一条 甲方应在三日内付款')
    expect(seg.newChanged).toBe('二条 乙方应在七日内交付')
  })
})

describe('buildRevisionDiff / mergeRevision', () => {
  const original = '第一条 甲方应在三日内付款。\n第二条 乙方应交付。\n第三条 保密义务持续三年。'
  const revised =
    '第一条 甲方应在五个工作日内付款。\n第二条 乙方应交付。\n第三条 保密义务持续五年。'

  it('全接受得到修订稿,全驳回逐字节回到原文', () => {
    const diff = buildRevisionDiff(original, revised)
    expect(diff.hunks.length).toBe(2)
    expect(mergeRevision(original, diff, allHunkIds(diff))).toBe(revised)
    expect(mergeRevision(original, diff, new Set())).toBe(original)
    expect(revisionStats(diff)).toMatchObject({ added: 2, removed: 2, hunks: 2 })
  })

  it('只接受第一处时,第二处保留原文', () => {
    const diff = buildRevisionDiff(original, revised)
    const first = diff.hunks[0]!
    const merged = mergeRevision(original, diff, new Set([first.id]))
    expect(merged).toContain('五个工作日内付款')
    expect(merged).toContain('保密义务持续三年')
    expect(merged).not.toContain('五年')
  })
})

describe('revisionFileName / exportRevision', () => {
  it('文件名去掉原扩展名后加后缀,不会出现双扩展名', () => {
    expect(revisionFileName('合规报告.docx', 'docx')).toBe('合规报告-修订稿.docx')
    expect(revisionFileName('说明.md', 'md')).toBe('说明-修订稿.md')
    expect(revisionFileName('readme', 'md')).toBe('readme-修订稿.md')
  })

  it('Markdown 原格式导出,保持 .md 与 MIME', async () => {
    const result = await exportRevision({
      name: '说明.md',
      originalText: '# 标题\n正文',
      mergedText: '# 标题\n正文（修订）',
    })
    expect(result.mode).toBe('text')
    expect(result.filename).toBe('说明-修订稿.md')
    expect(result.blob.type).toContain('text/markdown')
  })

  it('docx 可写回时导出 .docx,而不是 .md', async () => {
    const originalText = '第一段\n第二段'
    const bytes = await makeDocx(originalText.split('\n'))
    const result = await exportRevision({
      name: '合同.docx',
      originalText,
      mergedText: '第一段（改）\n第二段',
      originalBytes: bytes,
    })
    expect(result.mode).toBe('docx')
    expect(result.filename).toBe('合同-修订稿.docx')
    expect(result.blob.type).toContain('wordprocessingml.document')
  })

  it('docx 结构对不上时降级 Markdown,并显式带原因', async () => {
    const bytes = await makeDocx(['第一段', '第二段', '第三段'])
    const result = await exportRevision({
      name: '合同.docx',
      originalText: '第一段\n第二段',
      mergedText: '第一段（改）\n第二段',
      originalBytes: bytes,
    })
    expect(result.mode).toBe('markdown')
    expect(result.filename).toBe('合同-修订稿.md')
    expect(result.fallbackReason).toBe('layout-mismatch')
  })

  it('PDF 等无写回面的格式导出 Markdown 修订稿', async () => {
    const result = await exportRevision({
      name: '扫描件.pdf',
      originalText: '原文',
      mergedText: '修订',
    })
    expect(result.mode).toBe('markdown')
    expect(result.filename).toBe('扫描件-修订稿.md')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
