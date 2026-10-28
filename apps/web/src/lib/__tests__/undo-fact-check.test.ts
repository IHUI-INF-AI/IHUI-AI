// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  buildUndoSnapshot,
  classifyUndoWorkspace,
  fingerprintContent,
  isUndoPartial,
  resolveUndoFailureKey,
  undoVerdictForScope,
} from '../undo-fact-check'

const here = dirname(fileURLToPath(import.meta.url))
/** D163 铁律钉在两层:事实层(verdict 决定键)+ 文案层(键值措辞),两层都要过。 */
const zhCN = JSON.parse(
  readFileSync(
    join(here, '../../../../../packages/i18n/messages/web/zh-CN.json'),
    'utf8',
  ),
) as { aiChat: { checkpoint: Record<string, string> } }
const checkpointCopy = zhCN.aiChat.checkpoint

function snapshotOf(entries: Record<string, string>) {
  return buildUndoSnapshot(Object.entries(entries).map(([path, content]) => ({ path, content })))
}

describe('fingerprintContent', () => {
  it('内容不变指纹不变,内容变了指纹变', () => {
    expect(fingerprintContent('const a = 1\n')).toBe(fingerprintContent('const a = 1\n'))
    expect(fingerprintContent('const a = 1\n')).not.toBe(fingerprintContent('const a = 2\n'))
  })
})

describe('classifyUndoWorkspace', () => {
  const before = snapshotOf({ 'a.ts': 'one', 'b.ts': 'two' })

  it('任一侧没有快照 ⇒ unknown(没有事实不许Claim)', () => {
    expect(classifyUndoWorkspace(null, before)).toBe('unknown')
    expect(classifyUndoWorkspace(before, null)).toBe('unknown')
    expect(classifyUndoWorkspace(null, null)).toBe('unknown')
  })

  it('文件集与逐文件指纹一致 ⇒ unchanged', () => {
    expect(classifyUndoWorkspace(before, snapshotOf({ 'a.ts': 'one', 'b.ts': 'two' }))).toBe(
      'unchanged',
    )
  })

  it('文件内容变了 ⇒ changed', () => {
    expect(classifyUndoWorkspace(before, snapshotOf({ 'a.ts': 'one!', 'b.ts': 'two' }))).toBe(
      'changed',
    )
  })

  it('文件集增删 ⇒ changed', () => {
    expect(classifyUndoWorkspace(before, snapshotOf({ 'a.ts': 'one' }))).toBe('changed')
    expect(
      classifyUndoWorkspace(before, snapshotOf({ 'a.ts': 'one', 'b.ts': 'two', 'c.ts': 'three' })),
    ).toBe('changed')
  })
})

describe('undoVerdictForScope', () => {
  it('conversation 范围不碰文件:"未发生变化"是事实而非比对结论', () => {
    expect(undoVerdictForScope('conversation', null, null)).toBe('unchanged')
  })

  it('code 范围必须靠快照比对,没快照只能 unknown', () => {
    expect(undoVerdictForScope('code', null, null)).toBe('unknown')
    const s = snapshotOf({ 'a.ts': 'x' })
    expect(undoVerdictForScope('code', s, snapshotOf({ 'a.ts': 'x' }))).toBe('unchanged')
    expect(undoVerdictForScope('code', s, snapshotOf({ 'a.ts': 'y' }))).toBe('changed')
  })
})

describe('resolveUndoFailureKey — 文案由事实驱动', () => {
  it('mock 撤销失败且文件集未变 ⇒ 键为 undoFailed,文案含"未发生变化"', () => {
    const before = snapshotOf({ 'a.ts': 'one', 'b.ts': 'two' })
    const after = snapshotOf({ 'a.ts': 'one', 'b.ts': 'two' })
    const verdict = classifyUndoWorkspace(before, after)
    expect(verdict).toBe('unchanged')
    const key = resolveUndoFailureKey('restore-failed', verdict)
    expect(key).toBe('undoFailed')
    expect(checkpointCopy[key]).toContain('未发生变化')
  })

  it('mock 撤销失败且文件集变了 ⇒ 文案不得出现"未发生变化",须明说"已发生变化"', () => {
    const before = snapshotOf({ 'a.ts': 'one', 'b.ts': 'two' })
    const after = snapshotOf({ 'a.ts': 'one', 'b.ts': 'two-changed' })
    const verdict = classifyUndoWorkspace(before, after)
    expect(verdict).toBe('changed')
    const key = resolveUndoFailureKey('restore-failed', verdict)
    expect(key).toBe('undoFailedChanged')
    expect(checkpointCopy[key]).not.toContain('未发生变化')
    expect(checkpointCopy[key]).toContain('已发生变化')
  })

  it('没有快照可比对 ⇒ 文案是"无法确认",不许说"未发生变化"', () => {
    const key = resolveUndoFailureKey('restore-failed', classifyUndoWorkspace(null, null))
    expect(key).toBe('undoFailedUnverifiable')
    expect(checkpointCopy[key]).not.toContain('未发生变化')
    expect(checkpointCopy[key]).toContain('无法确认')
  })

  it('检查点不可用且有比对结论 unchanged ⇒ 基准键 undoUnavailable', () => {
    const verdict = classifyUndoWorkspace(snapshotOf({ 'a.ts': 'x' }), snapshotOf({ 'a.ts': 'x' }))
    expect(resolveUndoFailureKey('checkpoint-unavailable', verdict)).toBe('undoUnavailable')
  })
})

describe('isUndoPartial', () => {
  it('存在受影响文件但任一文件没拿到恢复版本 ⇒ 部分', () => {
    expect(isUndoPartial([{ version_id: 'v1' }, { version_id: undefined }])).toBe(true)
    expect(isUndoPartial([{ version_id: 'v1' }])).toBe(false)
    expect(isUndoPartial([])).toBe(false)
  })
})
