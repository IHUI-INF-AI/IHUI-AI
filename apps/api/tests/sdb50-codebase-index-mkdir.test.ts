// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-50:`CodebaseIndexer.index` 写索引前必须先建 `.ihui`。
 *
 * 改动前 `index()` 直接 `writeFileSync(join(workspacePath, '.ihui', ...))`,
 * 对尚无 `.ihui` 的工作区会在**整树遍历完之后**抛 ENOENT —— 遍历 IO 全白费,
 * `POST /workspace-ai/codebase/index` 返回 400,`/vector/index` 连带不可用。
 *
 * 三条各自钉一个面:
 *   ① 无 `.ihui` 的目录:索引仍能成功落盘(正是缺陷触发路径)。
 *   ② 落盘内容可 JSON.parse,且与 `index()` 返回值(既有形状)逐字段相同。
 *   ③ 已有 `.ihui`:行为不变(不报错、不重建目录、不擦掉同目录既有文件)。
 *
 * 隔离:临时目录建在 `os.tmpdir()` 下,不落仓库内,用完即删。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  codebaseIndexer,
  type CodebaseIndex,
} from '../src/services/workspace-ai-service.js'

let workspace: string

function indexPath(): string {
  return join(workspace, '.ihui', 'codebase-index.json')
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'ihui-sdb50-'))
  writeFileSync(join(workspace, 'demo.ts'), 'export function demoFn() {}\n', 'utf-8')
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('SDB-50 CodebaseIndexer.index 首次索引', () => {
  it('目录没有 .ihui 时也能写出索引(不再 ENOENT)', () => {
    expect(existsSync(join(workspace, '.ihui'))).toBe(false)

    const index = codebaseIndexer.index(workspace)

    expect(existsSync(join(workspace, '.ihui'))).toBe(true)
    expect(existsSync(indexPath())).toBe(true)
    expect(index.totalFiles).toBe(1)
  })

  it('落盘内容可 JSON.parse,形状与 index() 返回值一致', () => {
    const index = codebaseIndexer.index(workspace)
    const parsed = JSON.parse(readFileSync(indexPath(), 'utf-8')) as CodebaseIndex

    // 与既有实现同形:writeJson 的 2 空格缩进不改变语义,但字段一个不能少
    expect(parsed).toEqual(index)
    expect(Object.keys(parsed).sort()).toEqual(
      ['files', 'indexedAt', 'totalFiles', 'totalLines', 'workspace'].sort(),
    )
    expect(parsed.workspace).toBe(workspace)
    expect(parsed.files[0]?.path).toBe('demo.ts')
    expect(parsed.files[0]?.symbols).toContain('demoFn')
  })

  it('已有 .ihui 时行为不变:不报错、不重建目录、不擦掉既有文件', () => {
    const ihuiDir = join(workspace, '.ihui')
    const marker = join(ihuiDir, 'index-status.json')
    codebaseIndexer.index(workspace) // 第一次:建目录
    writeFileSync(marker, '{"lastIncrementalAt":1}', 'utf-8')

    const second = codebaseIndexer.index(workspace)

    expect(existsSync(marker)).toBe(true)
    expect(readFileSync(marker, 'utf-8')).toBe('{"lastIncrementalAt":1}')
    expect(existsSync(indexPath())).toBe(true)
    // 既有 `.ihui` 里的索引文件会被二次遍历收进来,故只钉测试夹具文件仍在
    expect(second.files.some((f) => f.path === 'demo.ts')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
