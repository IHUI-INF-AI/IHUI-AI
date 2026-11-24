// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-126 回归:read_file 的「最近已读」缓存键必须带上 ctime。
 *
 * 病灶:tmp+rename 的原子替换可以保持 mtime 与 size 完全不变(把同长内容写进临时文件再 rename),
 * 旧的 mtime+size 判据会把"文件已被换掉"读成"没变",于是模型收到 Wasted call stub,
 * 看不到新内容。修法:缓存键增加 ctimeMs,可比时先比 ctime,其次才比 mtime+size。
 */
import type { Stats } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  createReadFileStateKey,
  isCachedReadFresh,
  statFingerprint,
  type ReadFileStateEntry,
} from '../src/tools/read-file-state.js'

function entry(over: Partial<ReadFileStateEntry> = {}): ReadFileStateEntry {
  return { path: '/w/a.ts', isPartialView: false, recordedAt: 0, ...over }
}

describe('F-126 isCachedReadFresh —— ctime 先于 mtime/size', () => {
  it('核心:同 mtime 同 size 但 ctime 不同 ⇒ false(tmp+rename 换掉了文件)', () => {
    const e = entry({ mtimeMs: 1_700_000_000_000, sizeBytes: 42, ctimeMs: 1_700_000_000_500, ino: 7 })
    const stat = { mtimeMs: 1_700_000_000_000, size: 42, ctimeMs: 1_700_000_009_999, ino: 7 }
    expect(isCachedReadFresh(e, stat)).toBe(false)
  })

  it('ctime / mtime / size 三者全同 ⇒ true', () => {
    const e = entry({ mtimeMs: 1_700_000_000_000, sizeBytes: 42, ctimeMs: 1_700_000_000_500, ino: 7 })
    const stat = { mtimeMs: 1_700_000_000_000, size: 42, ctimeMs: 1_700_000_000_500, ino: 7 }
    expect(isCachedReadFresh(e, stat)).toBe(true)
  })

  it('旧缓存条目没有 ctimeMs ⇒ 走旧口径(mtime+size 同即 true),向后兼容', () => {
    const e = entry({ mtimeMs: 1_700_000_000_000, sizeBytes: 42 })
    const stat = { mtimeMs: 1_700_000_000_000, size: 42, ctimeMs: 1_700_000_009_999 }
    expect(isCachedReadFresh(e, stat)).toBe(true)
  })

  it('mtime 不可比(任一侧 undefined)⇒ 退到 size 单判:同 size true / 异 size false', () => {
    expect(isCachedReadFresh(entry({ sizeBytes: 42 }), { size: 42 })).toBe(true)
    expect(isCachedReadFresh(entry({ sizeBytes: 42 }), { size: 43 })).toBe(false)
    expect(isCachedReadFresh(entry({ mtimeMs: 1, sizeBytes: 42 }), { size: 42 })).toBe(true)
  })

  it('mtime 为 0 按可比处理(0===0),随后仍照 size 判:同 size true / 异 size false', () => {
    expect(isCachedReadFresh(entry({ mtimeMs: 0, sizeBytes: 42 }), { mtimeMs: 0, size: 42 })).toBe(true)
    expect(isCachedReadFresh(entry({ mtimeMs: 0, sizeBytes: 42 }), { mtimeMs: 0, size: 43 })).toBe(false)
  })

  it('mtime 为 NaN ⇒ 不新鲜(false),不静默落回 size(NaN 必不相等,宁可重读)', () => {
    const e = entry({ mtimeMs: Number.NaN, sizeBytes: 42, ctimeMs: 1 })
    const stat = { mtimeMs: Number.NaN, size: 42, ctimeMs: 1 }
    expect(isCachedReadFresh(e, stat)).toBe(false)
  })
})

describe('F-126 statFingerprint / createReadFileStateKey', () => {
  it('statFingerprint 原样带出 mtimeMs / size / ctimeMs / ino 四字段', () => {
    const fp = statFingerprint({ mtimeMs: 11.9, size: 42, ctimeMs: 13.1, ino: 9001 } as unknown as Stats)
    expect(fp).toEqual({ mtimeMs: 11.9, size: 42, ctimeMs: 13.1, ino: 9001 })
    expect(Object.keys(fp).sort()).toEqual(['ctimeMs', 'ino', 'mtimeMs', 'size'])
  })

  it('cacheKey 三元组互不相等:(path) ≠ (path,0,10) ≠ (path,10,10)', () => {
    const keys = [
      createReadFileStateKey('/w/a.ts'),
      createReadFileStateKey('/w/a.ts', 0, 10),
      createReadFileStateKey('/w/a.ts', 10, 10),
    ]
    expect(new Set(keys).size).toBe(3)
  })
})
