// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INSTALL_COPY_QUOTA, evaluateArchiveQuota } from '../src/plugins/archive-quota.js'
import { SkillPackageError } from '../src/skills/packaging/errors.js'
import { readTar, writeTar, type TarEntry } from '../src/skills/packaging/tar.js'

/**
 * goal-b49 S1 席未竟 3 的闭环:技能包归档的**配额腿**。
 *
 * 立的因:`readTar` 此前对来路不明的 ustar 照单全收(既不看条目数也不看展开字节),
 * 一条条目数被放大的包能在解析面造成内存事故。本档不新造尺 —— 判据一律走
 * `plugins/archive-quota.ts` 那一份(§0.6),所以这里第 5 例把"报出来的读数逐字等于
 * 那把尺的输出"钉成装车证明,第 6 例把"tar.ts 体内不许出现第二处比较式"钉成形状锁。
 */

function pack(entries: number, bytes: number): Buffer {
  const list: TarEntry[] = Array.from({ length: entries }, (_, index) => ({
    path: `skills/pack-${index}.md`,
    content: Buffer.from('x'.repeat(bytes), 'utf8'),
  }))
  return writeTar(list)
}

function quotaError(run: () => unknown): SkillPackageError {
  try {
    run()
  } catch (err) {
    expect(err).toBeInstanceOf(SkillPackageError)
    return err as SkillPackageError
  }
  throw new Error('期望被配额拦下,实际没抛')
}

describe('readTar 的配额腿(唯一判据 = archive-quota)', () => {
  it('① 双上限未触 ⇒ 正常解析,条目逐条在场', () => {
    const result = readTar(pack(3, 20), { maxEntries: 10, maxExpandedBytes: 1_000_000 })
    expect(result.entries.size).toBe(3)
    expect(result.duplicates).toEqual([])
  })

  it('② 条目数超限 ⇒ 物化前中止,读数两侧同时在场(可整改性)', () => {
    const error = quotaError(() => readTar(pack(3, 20), { maxEntries: 2, maxExpandedBytes: 1_000_000 }))
    expect(error.code).toBe('SKILL_PKG_ARCHIVE_QUOTA_EXCEEDED')
    expect(error.message).toContain('条目 3 / 上限 2')
    expect(error.detail.reasons).toEqual(['条目超限:实测 3 / 上限 2'])
  })

  it('③ 展开字节超限 ⇒ 中止并点名是"字节"这一维', () => {
    const error = quotaError(() => readTar(pack(1, 100), { maxEntries: 100, maxExpandedBytes: 40 }))
    expect(error.detail.verdict).toBe('exceeded')
    expect(error.detail.reasons).toEqual(['展开字节超限:实测 100 / 上限 40'])
    expect(error.message).toContain('超限(bytes)')
    expect(error.message).toContain('100 / 上限 40')
  })

  it('④ 上限形态坏 ⇒ unjudged **不算放行**(§0.3 不拿"判不出"冒充"没超限")', () => {
    const error = quotaError(() =>
      readTar(pack(1, 10), { maxEntries: Number.NaN, maxExpandedBytes: 1_000_000 }),
    )
    expect(error.detail.verdict).toBe('unjudged')
    expect(error.message).toContain('未判定')
    expect(String(error.detail.reasons)).toContain('上限形态非法')
  })

  it('⑤ 装车证明:拦下时报出的读数逐字等于那把尺的 report(零复算)', () => {
    const limits = { maxEntries: 2, maxExpandedBytes: 1_000_000 }
    const error = quotaError(() => readTar(pack(3, 20), limits))
    expect(error.detail.report).toBe(
      evaluateArchiveQuota({ entries: 3, expandedBytes: 60 }, limits).report,
    )
  })

  it('⑥ 形状锁:默认档取 INSTALL_COPY_QUOTA,tar 体内不出现第二处配额比较式', () => {
    const source = readFileSync(new URL('../src/skills/packaging/tar.ts', import.meta.url), 'utf8')
    expect(source).toContain('limits: ArchiveQuotaLimits = INSTALL_COPY_QUOTA')
    expect(source).not.toMatch(/limits\.(maxEntries|maxExpandedBytes)\s*[<>]=?/)
    expect(source).not.toMatch(/observed\w*\s*[<>]=?\s*limit/)
    expect(INSTALL_COPY_QUOTA.maxEntries).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
