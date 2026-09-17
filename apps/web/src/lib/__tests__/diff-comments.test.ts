// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  DIFF_REVIEW_BLOCK_MAX,
  DIFF_REVIEW_TAG,
  DIFF_COMMENT_LINE_TEXT_MAX,
  appendDiffComments,
  formatDiffCommentsForLLM,
} from '../diff-comments'
import type { DiffComment } from '@/stores/chat'

function makeComment(over: Partial<DiffComment> = {}): DiffComment {
  return {
    id: `dc-${Math.random().toString(36).slice(2, 8)}`,
    filePath: 'src/foo.ts',
    comment: '这里有问题',
    createdAt: Date.now(),
    ...over,
  }
}

/**
 * P3 #30 diff 评审意见注入格式化测试(2026-09-16 立)
 *
 * 覆盖:空输入零副作用 / XML 块包裹 / 文件分组 / 行号升序 /
 * 文件级与行级共存顺序 / 行文本折叠与截断 / 总长截断 / appendDiffComments 拼接语义。
 */
describe('formatDiffCommentsForLLM', () => {
  it('空数组返回空串(调用方据此跳过注入,零副作用)', () => {
    expect(formatDiffCommentsForLLM([])).toBe('')
  })

  it('全部为空白评论时返回空串(不产生空块)', () => {
    expect(formatDiffCommentsForLLM([makeComment({ comment: '   ' })])).toBe('')
  })

  it('单条行级评论:块内包含文件路径 + 行号 + 原行内容 + 意见正文', () => {
    const out = formatDiffCommentsForLLM([
      makeComment({
        filePath: 'src/a.ts',
        line: 12,
        lineText: 'const x = 1',
        comment: '应该用 let',
      }),
    ])
    expect(out.startsWith(`<${DIFF_REVIEW_TAG}>`)).toBe(true)
    expect(out.endsWith(`</${DIFF_REVIEW_TAG}>`)).toBe(true)
    expect(out).toContain('### src/a.ts')
    expect(out).toContain('第 12 行')
    expect(out).toContain('const x = 1')
    expect(out).toContain('应该用 let')
  })

  it('文件级评论(无行号)标记为「整个文件」', () => {
    const out = formatDiffCommentsForLLM([makeComment({ comment: '整体缺少错误处理' })])
    expect(out).toContain('(整个文件)整体缺少错误处理')
    expect(out).not.toContain('第 ')
  })

  it('按文件分组:同一文件的多条意见聚在一处,不同文件各自成节', () => {
    const out = formatDiffCommentsForLLM([
      makeComment({ filePath: 'src/a.ts', line: 5, comment: 'A5' }),
      makeComment({ filePath: 'src/b.ts', line: 1, comment: 'B1' }),
      makeComment({ filePath: 'src/a.ts', line: 9, comment: 'A9' }),
    ])
    expect(out).toContain('### src/a.ts')
    expect(out).toContain('### src/b.ts')
    // a.ts 只有一节(分组聚合)
    expect(out.split('### src/a.ts')).toHaveLength(2)
    // 同文件内行号升序
    expect(out.indexOf('A5')).toBeLessThan(out.indexOf('A9'))
  })

  it('文件级意见排在行级之前(整体性意见优先被理解)', () => {
    const out = formatDiffCommentsForLLM([
      makeComment({ filePath: 'src/a.ts', line: 3, comment: '行级意见' }),
      makeComment({ filePath: 'src/a.ts', comment: '文件级意见' }),
    ])
    expect(out.indexOf('文件级意见')).toBeLessThan(out.indexOf('行级意见'))
  })

  it('行文本折叠空白并截断(多行缩进代码不占位过多)', () => {
    const longText = 'a'.repeat(DIFF_COMMENT_LINE_TEXT_MAX + 100)
    const out = formatDiffCommentsForLLM([
      makeComment({ line: 1, lineText: `  const  x\n   =  1  `, comment: 'c1' }),
      makeComment({ line: 2, lineText: longText, comment: 'c2' }),
    ])
    // 内部连续空白折叠为单空格
    expect(out).toContain('`const x = 1`')
    // 超长行文本被截断(不出现完整的长串)
    expect(out).not.toContain(longText)
    expect(out).toContain('a'.repeat(DIFF_COMMENT_LINE_TEXT_MAX))
  })

  it('总长超限时截断并标注', () => {
    const many: DiffComment[] = []
    for (let i = 0; i < 200; i++) {
      many.push(makeComment({ filePath: `src/f${i}.ts`, line: i + 1, comment: 'x'.repeat(100) }))
    }
    const out = formatDiffCommentsForLLM(many)
    expect(out).toContain('... (评审意见过长已截断)')
    expect(out.length).toBeLessThanOrEqual(DIFF_REVIEW_BLOCK_MAX + 40)
  })

  it('意见正文首尾空白被去除', () => {
    const out = formatDiffCommentsForLLM([makeComment({ comment: '  多余空白  ' })])
    expect(out).toContain('(整个文件)多余空白')
  })
})

describe('appendDiffComments', () => {
  it('无评论时原样返回用户文本(零改动路径)', () => {
    expect(appendDiffComments('帮我改一下', [])).toBe('帮我改一下')
  })

  it('有评论时追加块并以空行分隔', () => {
    const out = appendDiffComments('帮我改一下', [makeComment({ comment: '用 const' })])
    expect(out.startsWith('帮我改一下\n\n')).toBe(true)
    expect(out).toContain(`<${DIFF_REVIEW_TAG}>`)
    expect(out).toContain('用 const')
  })

  it('追加块不影响原文本内容(用户正文完整保留)', () => {
    const text = '第一行\n第二行'
    const out = appendDiffComments(text, [makeComment({ comment: 'c' })])
    expect(out.startsWith(text)).toBe(true)
  })
})
