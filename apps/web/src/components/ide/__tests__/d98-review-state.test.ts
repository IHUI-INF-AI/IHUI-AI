// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import {
  REVIEWED_LS_PREFIX,
  getReviewedStorageKey,
  loadReviewedIds,
  persistReviewedIds,
  countReviewed,
  isGeneratedFile,
  filterReviewFiles,
} from '../diff-file-list'
import type { DiffFile } from '@ihui/types'

/**
 * D98①②:审阅态持久化 + 生成文件判定 + 列表筛选(纯函数层)。
 *
 * 真链路断言"刷新后仍存"在组件层(d98-diff-viewer-pane.test.tsx)做
 * unmount/remount;此处钉死存储键格式与损坏输入永不抛错。
 */
function makeFile(id: string, filename: string, status: DiffFile['status'] = 'modified'): DiffFile {
  return {
    id,
    filename,
    status,
    oldContent: '',
    newContent: '',
    additions: 1,
    deletions: 0,
  }
}

describe('D98 reviewed storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('存储键含 scope 前缀(多工作区不串态)', () => {
    expect(getReviewedStorageKey('/ws/a')).toBe(`${REVIEWED_LS_PREFIX}:/ws/a`)
    expect(getReviewedStorageKey('')).toBe(REVIEWED_LS_PREFIX)
  })

  it('写入后读回一致(刷新后仍存的底层语义)', () => {
    persistReviewedIds('/ws', new Set(['diff-a', 'diff-b']))
    expect(loadReviewedIds('/ws')).toEqual(new Set(['diff-a', 'diff-b']))
    // scope 隔离
    expect(loadReviewedIds('/other')).toEqual(new Set())
  })

  it('损坏输入永不抛错(缺失/非 JSON/非数组/混入非字符串)', () => {
    expect(loadReviewedIds('/ws')).toEqual(new Set())
    localStorage.setItem(getReviewedStorageKey('/ws'), 'not-json{')
    expect(loadReviewedIds('/ws')).toEqual(new Set())
    localStorage.setItem(getReviewedStorageKey('/ws'), JSON.stringify({ a: 1 }))
    expect(loadReviewedIds('/ws')).toEqual(new Set())
    localStorage.setItem(getReviewedStorageKey('/ws'), JSON.stringify(['ok', 42, null]))
    expect(loadReviewedIds('/ws')).toEqual(new Set(['ok']))
  })

  it('计数只计仍在变更集中的 id(文件已不在 diff 里不虚高)', () => {
    const ids = new Set(['a', 'b', 'gone'])
    expect(countReviewed(ids, [{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toBe(2)
  })
})

describe('D98 generated files', () => {
  it('命中:产物目录/压缩产物/sourcemap/锁文件/声明文件', () => {
    for (const f of [
      'dist/bundle.js',
      'build/out.css',
      '.next/static/chunk.js',
      'node_modules/x/index.js',
      'src/app.min.js',
      'src/app.min.css',
      'a.bundle.js',
      'a.chunk.js',
      'src/index.js.map',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'types/index.d.ts',
    ]) {
      expect(isGeneratedFile(f)).toBe(true)
    }
  })

  it('不命中:正常源码(含 min 目录名但非压缩产物)', () => {
    for (const f of ['src/a.ts', 'src/min/index.ts', 'admin.ts', 'dist.ts', 'package.json']) {
      expect(isGeneratedFile(f)).toBe(false)
    }
  })
})

describe('D98 filterReviewFiles', () => {
  const files = [
    makeFile('1', 'src/a.ts', 'modified'),
    makeFile('2', 'src/b.ts', 'added'),
    makeFile('3', 'dist/bundle.js', 'modified'),
  ]

  it('状态筛选(沿既有 filter 语义)', () => {
    expect(
      filterReviewFiles(files, { status: 'added', searchQuery: '', hideGenerated: false }),
    ).toMatchObject([{ id: '2' }])
  })

  it('文件名子串筛选(jumpToFile 同源)', () => {
    const out = filterReviewFiles(files, {
      status: 'all',
      searchQuery: 'B.TS',
      hideGenerated: false,
    })
    expect(out.map((f) => f.id)).toEqual(['2'])
  })

  it('隐藏生成文件', () => {
    const out = filterReviewFiles(files, { status: 'all', searchQuery: '', hideGenerated: true })
    expect(out.map((f) => f.id)).toEqual(['1', '2'])
  })

  it('三条件叠加', () => {
    const out = filterReviewFiles(files, {
      status: 'modified',
      searchQuery: 'src',
      hideGenerated: true,
    })
    expect(out.map((f) => f.id)).toEqual(['1'])
  })
})
