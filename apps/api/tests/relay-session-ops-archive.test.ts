// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rotate 后 undo 号跨归档定位测试(2026-10-28 立)。
 * 缺陷原型:rotate 把老条目移出主日志 ⇒ 主日志行号前移,用户拿 rotate 前的旧号 `undo --op N`
 * 会撤到别的操作。修复 = undo/ops 号按「归档(日期升序)⊕ 当前」全序解释。
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  listOpsArchives,
  planUndo,
  readOps,
  readOpsAll,
  type MoveOp,
} from '../scripts/relay-session-move.js'

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

const mk = (name: string): string => {
  const root = mkdtempSync(join(tmpdir(), 'wb-ops-archive-'))
  cleanup.push(root)
  return join(root, name)
}

const line = (n: number, conv: string): string =>
  JSON.stringify({
    ts: `2026-10-${String(n).padStart(2, '0')}T00:00:00.000Z`,
    type: 'move',
    conversationId: conv,
    accountId: 'acct-1',
    entries: [{ from: `/src/${conv}.jsonl`, to: `/bucket/${conv}.jsonl`, bytes: 10, sha256: 'ab' }],
  })

function seed(): { opsFile: string; archiveFile: string } {
  const opsFile = mk('move_ops.jsonl')
  const dir = opsFile.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  // rotate 后的形态:最老的两条进了归档(按日期升序),主日志剩最新一条
  const archiveFile = join(dir, 'move_ops.archive-20261027.jsonl')
  writeFileSync(archiveFile, `${line(1, 'conv-1')}\n${line(2, 'conv-2')}\n`)
  writeFileSync(opsFile, `${line(3, 'conv-3')}\n`)
  return { opsFile, archiveFile }
}

describe('readOpsAll / planUndo 跨归档', () => {
  it('listOpsArchives 找得到归档件', () => {
    const { opsFile } = seed()
    const list = listOpsArchives(opsFile)
    expect(list.length).toBe(1)
    expect(list[0]).toMatch(/move_ops\.archive-\d{8}\.jsonl$/)
  })

  it('readOpsAll = 归档 ⊕ 当前,archivedCount 正确', () => {
    const { opsFile } = seed()
    const all = readOpsAll(opsFile)
    expect(all.ops.length).toBe(3)
    expect(all.archivedCount).toBe(2)
    expect(all.ops.map((o) => o.conversationId)).toEqual(['conv-1', 'conv-2', 'conv-3'])
    // 向后兼容:readOps 只看当前文件
    expect(readOps(opsFile).map((o) => o.conversationId)).toEqual(['conv-3'])
  })

  it('undo --op 1 定位到归档首条(conv-1),不是当前首条(conv-3)', () => {
    const { opsFile } = seed()
    const { op } = planUndo(opsFile, 1)
    expect(op.conversationId).toBe('conv-1')
  })

  it('undo --op 3 定位到当前条目(conv-3);越界点名含归档计数', () => {
    const { opsFile } = seed()
    expect(planUndo(opsFile, 3).op.conversationId).toBe('conv-3')
    expect(() => planUndo(opsFile, 4)).toThrow(/现存 3 条.*含归档 2 条/)
  })

  it('无归档时行为不变(回归护栏):当前文件即全序', () => {
    const opsFile = mk('move_ops.jsonl')
    writeFileSync(opsFile, `${line(5, 'conv-5')}\n${line(6, 'conv-6')}\n`)
    const all = readOpsAll(opsFile)
    expect(all.archiveFiles).toEqual([])
    expect(all.archivedCount).toBe(0)
    expect(all.ops.map((o) => (o as MoveOp).conversationId)).toEqual(['conv-5', 'conv-6'])
    expect(planUndo(opsFile, 1).op.conversationId).toBe('conv-5')
  })

  it('多份归档按日期升序拼接', () => {
    const opsFile = mk('move_ops.jsonl')
    const dir = opsFile.split(/[\\/]/).slice(0, -1).join('/')
    writeFileSync(join(dir, 'move_ops.archive-20261028.jsonl'), `${line(4, 'conv-4')}\n`)
    writeFileSync(join(dir, 'move_ops.archive-20261027.jsonl'), `${line(1, 'conv-1')}\n`)
    writeFileSync(opsFile, `${line(9, 'conv-9')}\n`)
    const all = readOpsAll(opsFile)
    expect(all.ops.map((o) => o.conversationId)).toEqual(['conv-1', 'conv-4', 'conv-9'])
    expect(readFileSync(all.archiveFiles[0]!, 'utf8')).toContain('conv-1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
