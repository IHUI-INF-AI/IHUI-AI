// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  buildTruncationMarkerLine,
  countPatchFileDiffs,
  decidePatchDiffRender,
  parseTruncationMarkerOmittedCount,
} from './patch-diff-guard'

const SINGLE_FILE_PATCH = [
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,3 +1,4 @@',
  ' const a = 1',
  '-const b = 2',
  '+const b = 20',
  '+const c = 3',
  ' export { a, b }',
].join('\n')

describe('countPatchFileDiffs 自有计数器', () => {
  it('有 diff --git 头时按头数', () => {
    const patch = [
      'diff --git a/x.ts b/x.ts',
      '--- a/x.ts',
      '+++ b/x.ts',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
      'diff --git a/y.ts b/y.ts',
      '--- a/y.ts',
      '+++ b/y.ts',
      '@@ -1,1 +1,1 @@',
      '-c',
      '+d',
    ].join('\n')
    expect(countPatchFileDiffs(patch)).toBe(2)
  })

  it('无 git 头的多文件 patch 按文件头对计数', () => {
    const patch = [
      '--- a/one.ts',
      '+++ b/one.ts',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
      '--- a/two.ts',
      '+++ b/two.ts',
      '@@ -1,1 +1,1 @@',
      '-c',
      '+d',
    ].join('\n')
    expect(countPatchFileDiffs(patch)).toBe(2)
  })

  it('hunk 行数写多(off-by-one)时文件头对提前收束,多文件不误计成单文件', () => {
    // 第一个 hunk 声明 5+5 行但正文只有 3 行,多出的配额恰好"够到"下一个文件头:
    // 无防线时 `--- a/two`/`+++ b/two` 会被当成删除/新增行吃掉,计数错误地收敛为 1。
    const patch = [
      '--- a/one.ts',
      '+++ b/one.ts',
      '@@ -1,5 +1,5 @@',
      '-old1',
      '+new1',
      ' context1',
      '--- a/two.ts',
      '+++ b/two.ts',
      '@@ -1,1 +1,1 @@',
      '-x',
      '+y',
    ].join('\n')
    expect(countPatchFileDiffs(patch)).toBe(2)
  })

  it('裸 hunk / 纯文本计 0', () => {
    expect(countPatchFileDiffs(['@@ -1,1 +1,1 @@', '-a', '+b'].join('\n'))).toBe(0)
    expect(countPatchFileDiffs('hello world')).toBe(0)
    expect(countPatchFileDiffs('')).toBe(0)
  })
})

describe('decidePatchDiffRender 降级判据链', () => {
  it('正常单文件小 patch 判 render', () => {
    expect(decidePatchDiffRender(SINGLE_FILE_PATCH)).toEqual({
      mode: 'render',
      reason: null,
      fileCount: 1,
    })
  })

  it('多文件 patch 判 fallback(multiple-files)', () => {
    const patch = `${SINGLE_FILE_PATCH}\n--- b/src/other.ts\n+++ b/src/other.ts\n@@ -1,1 +1,1 @@\n-a\n+b`
    const decision = decidePatchDiffRender(patch)
    expect(decision.mode).toBe('fallback')
    expect(decision.reason).toBe('multiple-files')
    expect(decision.fileCount).toBe(2)
  })

  it('无 diff 头(裸 hunk)判 fallback(no-file-diff)', () => {
    const decision = decidePatchDiffRender('@@ -1,2 +1,2 @@\n-a\n+b\n c')
    expect(decision.mode).toBe('fallback')
    expect(decision.reason).toBe('no-file-diff')
    expect(decision.fileCount).toBe(0)
  })

  it('新建/删除文件(/dev/null)判 fallback(created-or-deleted)', () => {
    const created = decidePatchDiffRender(
      ['--- /dev/null', '+++ b/new.ts', '@@ -0,0 +1,2 @@', '+a', '+b'].join('\n'),
    )
    expect(created.reason).toBe('created-or-deleted')

    const deleted = decidePatchDiffRender(
      ['--- a/old.ts', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-a', '-b'].join('\n'),
    )
    expect(deleted.reason).toBe('created-or-deleted')
  })

  it('超过 1200 行判 fallback(oversized)且带截断省略行数', () => {
    const lines = ['--- a/big.txt', '+++ b/big.txt', '@@ -1,4 +1,4 @@', ' head', '-x', '+y', ' tail']
    const padding = Array.from({ length: 1300 }, (_, i) => ` pad-${i}`)
    const patch = [...lines, ...padding].join('\n')
    const decision = decidePatchDiffRender(patch)
    expect(decision.mode).toBe('fallback')
    expect(decision.reason).toBe('oversized')
    expect(decision.truncatedLineCount).toBe(patch.split('\n').length - 1200)
  })

  it('字符超限(行数少但单行超长)判 fallback(oversized)且无行数截断字段', () => {
    const hugeLine = 'x'.repeat(190_000)
    const patch = ['--- a/huge.txt', '+++ b/huge.txt', '@@ -1,1 +1,1 @@', `-${hugeLine}`, `+${hugeLine}!`].join('\n')
    const decision = decidePatchDiffRender(patch)
    expect(decision.mode).toBe('fallback')
    expect(decision.reason).toBe('oversized')
    expect(decision.truncatedLineCount).toBeUndefined()
  })

  it('深 hunk 行号(>1200)判 fallback(deep-hunk-line)', () => {
    const patch = ['--- a/deep.txt', '+++ b/deep.txt', '@@ -1500,2 +1500,2 @@', '-a', '+b'].join('\n')
    const decision = decidePatchDiffRender(patch)
    expect(decision.mode).toBe('fallback')
    expect(decision.reason).toBe('deep-hunk-line')
  })

  it('metadata-only(rename-only)判 fallback(metadata-only)', () => {
    const patch = [
      'diff --git a/old-name.ts b/new-name.ts',
      'similarity index 100%',
      'rename from old-name.ts',
      'rename to new-name.ts',
    ].join('\n')
    const decision = decidePatchDiffRender(patch)
    expect(decision.mode).toBe('fallback')
    expect(decision.reason).toBe('metadata-only')
    expect(decision.fileCount).toBe(1)
  })

  it('lockfile 判 fallback(lockfile),含子目录与大小写形态', () => {
    const lockfile = decidePatchDiffRender(
      ['--- a/pnpm-lock.yaml', '+++ b/pnpm-lock.yaml', '@@ -1,1 +1,1 @@', '-a', '+b'].join('\n'),
    )
    expect(lockfile.reason).toBe('lockfile')

    const nested = decidePatchDiffRender(
      ['--- a/packages/app/yarn.lock', '+++ b/packages/app/yarn.lock', '@@ -1,1 +1,1 @@', '-a', '+b'].join('\n'),
    )
    expect(nested.reason).toBe('lockfile')
  })

  it('.gradle/.gradle.kts 判 fallback(gradle-script),tab 时间戳后缀不绕过', () => {
    const gradle = decidePatchDiffRender(
      ['--- a/build.gradle\t2026-09-30 10:00:00.000000000 +0800', '+++ b/build.gradle', '@@ -1,1 +1,1 @@', '-a', '+b'].join('\n'),
    )
    expect(gradle.reason).toBe('gradle-script')

    const kts = decidePatchDiffRender(
      ['--- a/settings.gradle.kts', '+++ b/settings.gradle.kts', '@@ -1,1 +1,1 @@', '-a', '+b'].join('\n'),
    )
    expect(kts.reason).toBe('gradle-script')
  })
})

describe('截断 marker token', () => {
  it('build → parse 往返,且不夹带任何英文文案', () => {
    const marker = buildTruncationMarkerLine(300)
    expect(marker).toBe('\\ __IHUI_DIFF_TRUNCATED__:300')
    expect(marker.toLowerCase()).not.toContain('truncated lines')
    expect(parseTruncationMarkerOmittedCount(marker)).toBe(300)
  })

  it('非 marker 行与非法数值返回 null', () => {
    expect(parseTruncationMarkerOmittedCount('@@ -1,1 +1,1 @@')).toBeNull()
    expect(parseTruncationMarkerOmittedCount('\\ __IHUI_DIFF_TRUNCATED__:0')).toBeNull()
    expect(parseTruncationMarkerOmittedCount('\\ __IHUI_DIFF_TRUNCATED__:abc')).toBeNull()
    expect(parseTruncationMarkerOmittedCount('')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
