// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import {
  splitPatchLines,
  quotePatchPath,
  formatHunkRange,
  buildFilePatch,
  buildUnifiedPatch,
  buildGitApplyCommand,
  extractPatchFromCommand,
} from '../../ai/diff-hunk-controls'

/**
 * D98⑤(G-135):git apply 迁移命令构建器。
 *
 * 结构断言在此;真正的"本地可执行"由本文件末尾的 fixture 落盘 +
 * `git apply --check` bash 验证完成(见交付报告 Git 同步证据外)。
 */

function writeFixture(name: string, patch: string): string {
  const dir = path.resolve(process.cwd(), '../../test-results/d98')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name)
  fs.writeFileSync(file, patch)
  return file
}

describe('D98 patch primitives', () => {
  it('splitPatchLines:末尾换行不产幽灵空行,\\r 归一', () => {
    expect(splitPatchLines('')).toEqual([])
    expect(splitPatchLines('a\n')).toEqual(['a'])
    expect(splitPatchLines('a\nb')).toEqual(['a', 'b'])
    expect(splitPatchLines('a\r\nb\rc')).toEqual(['a', 'b', 'c'])
  })

  it('quotePatchPath:含空格加引号,普通路径原样', () => {
    expect(quotePatchPath('src/a.ts')).toBe('src/a.ts')
    expect(quotePatchPath('my dir/a.ts')).toBe('"my dir/a.ts"')
  })

  it('formatHunkRange:单行省略 ,1', () => {
    expect(formatHunkRange(3, 1)).toBe('3')
    expect(formatHunkRange(0, 0)).toBe('0,0')
    expect(formatHunkRange(1, 4)).toBe('1,4')
  })
})

describe('D98 buildFilePatch', () => {
  it('内容相等返回 null(调用方禁用导出,不复制空 patch)', () => {
    expect(buildFilePatch({ filename: 'a.ts', oldContent: 'x\n', newContent: 'x\n' })).toBeNull()
  })

  it('修改文件:标准头 + hunk 区间 + 增删行', () => {
    const p = buildFilePatch({
      filename: 'src/a.ts',
      oldContent: 'line1\nline2\nline3\n',
      newContent: 'line1\nLINE2\nline3\n',
    })
    expect(p).not.toBeNull()
    const s = p as string
    expect(s).toContain('diff --git a/src/a.ts b/src/a.ts')
    expect(s).toContain('--- a/src/a.ts')
    expect(s).toContain('+++ b/src/a.ts')
    expect(s).toMatch(/^@@ -\d+(,\d+)? \+\d+(,\d+)? @@/m)
    expect(s).toContain('-line2')
    expect(s).toContain('+LINE2')
    expect(s).toContain(' line1')
    writeFixture('modify.patch', s)
  })

  it('新文件走 /dev/null + new file mode', () => {
    const p = buildFilePatch({ filename: 'src/new.ts', oldContent: '', newContent: 'a\nb\n' })
    const s = p as string
    expect(s).toContain('new file mode 100644')
    expect(s).toContain('--- /dev/null')
    expect(s).toContain('+++ b/src/new.ts')
    expect(s).toContain('+a')
    const delLines = s.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'))
    expect(delLines).toEqual([])
    writeFixture('new-file.patch', s)
  })

  it('删除文件走 /dev/null + deleted file mode', () => {
    const p = buildFilePatch({ filename: 'src/old.ts', oldContent: 'a\nb\n', newContent: '' })
    const s = p as string
    expect(s).toContain('deleted file mode 100644')
    expect(s).toContain('--- a/src/old.ts')
    expect(s).toContain('+++ /dev/null')
    expect(s).toContain('-a')
    writeFixture('delete-file.patch', s)
  })

  it('含空格文件名加引号', () => {
    const p = buildFilePatch({ filename: 'my dir/a.ts', oldContent: 'x\n', newContent: 'y\n' })
    expect(p as string).toContain('--- "a/my dir/a.ts"')
    writeFixture('space-name.patch', p as string)
  })

  it('缺行尾换行追加 No-newline 标记', () => {
    const p = buildFilePatch({ filename: 'a.ts', oldContent: 'x\n', newContent: 'x' })
    expect(p as string).toContain('\\ No newline at end of file')
    writeFixture('noeol.patch', p as string)
  })

  it('多处变更拆多 hunk(上下文隔离)', () => {
    const oldL = Array.from({ length: 30 }, (_, i) => `l${i}`).join('\n') + '\n'
    const newL = oldL.replace('l2\n', 'L2\n').replace('l25\n', 'L25\n')
    const p = buildFilePatch({ filename: 'big.ts', oldContent: oldL, newContent: newL })
    const hunks = (p as string).split('\n').filter((l) => l.startsWith('@@'))
    expect(hunks.length).toBe(2)
  })
})

describe('D98 command', () => {
  it('buildUnifiedPatch 跳过无改动文件;全无改动返回空串', () => {
    expect(buildUnifiedPatch([{ filename: 'a', oldContent: 'x', newContent: 'x' }])).toBe('')
    const p = buildUnifiedPatch([
      { filename: 'a.ts', oldContent: 'x\n', newContent: 'y\n' },
      { filename: 'same.ts', oldContent: 'z\n', newContent: 'z\n' },
    ])
    expect(p).toContain('a.ts')
    expect(p).not.toContain('same.ts')
    writeFixture('multi.patch', p)
  })

  it('命令含 check + apply 双阶段,回取 patch 逐字节一致', () => {
    const patch = buildUnifiedPatch([{ filename: 'a.ts', oldContent: 'x\n', newContent: 'y\n' }])
    const cmd = buildGitApplyCommand(patch)
    expect(cmd).toContain('git apply --check')
    expect(cmd).toContain('git apply <<')
    expect(extractPatchFromCommand(cmd)).toBe(patch.endsWith('\n') ? patch : `${patch}\n`)
  })

  it('patch 内含分隔符时自动换分隔符(仍可回取)', () => {
    const patch = 'line\nIHUI_DIFF_PATCH\n'
    const cmd = buildGitApplyCommand(patch)
    expect(cmd).not.toContain("<<'IHUI_DIFF_PATCH'")
    expect(extractPatchFromCommand(cmd)).toBe(patch)
  })
})
