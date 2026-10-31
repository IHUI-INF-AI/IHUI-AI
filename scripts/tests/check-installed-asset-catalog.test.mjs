// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/tests/check-installed-asset-catalog.test.mjs
 *
 * 判据源唯一 = ../check-installed-asset-catalog.mjs 的 __test__(§22c:测试 import 生产判据,
 * 禁止在这里复制阈值/比对实现)。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { Buffer } from 'node:buffer'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ } from '../check-installed-asset-catalog.mjs'

const { sha256Hex, parseLsTree, parseCatFileBatch, parseCatalog, judge, computeWorktreeCatalog } =
  __test__

const LIMITS = { maxEntries: 100, maxExpandedBytes: 1024 }

function actual(files) {
  return {
    entries: Object.entries(files)
      .map(([path, body]) => {
        const buf = Buffer.from(body)
        return { path, sha256: sha256Hex(buf), bytes: buf.length }
      })
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  }
}

test('R0 清单与实读逐文件一致 ⇒ ok', () => {
  const a = actual({ 'archify/SKILL.md': 'hello', 'rea-surpass/SKILL.md': 'world' })
  const r = judge({ entries: a.entries }, a, LIMITS)
  assert.equal(r.verdict, 'ok')
  assert.deepEqual(r.counts, {
    catalog: 2,
    actual: 2,
    missing: 0,
    unlisted: 0,
    mismatch: 0,
    overLimit: 0,
    totalBytes: 10,
  })
})

test('R1 清单有、实读无 ⇒ missing', () => {
  const a = actual({ 'archify/SKILL.md': 'hello' })
  const r = judge(
    { entries: [...a.entries, { path: 'gone/x.md', sha256: '0'.repeat(64), bytes: 1 }] },
    a,
    LIMITS,
  )
  assert.equal(r.verdict, 'drift')
  assert.deepEqual(r.missing, ['gone/x.md'])
})

test('R2 实读有、清单无 ⇒ unlisted', () => {
  const a = actual({ 'archify/SKILL.md': 'hello', 'archify/evil.sh': 'rm -rf /' })
  const r = judge({ entries: [a.entries[0]] }, a, LIMITS)
  assert.equal(r.verdict, 'drift')
  assert.deepEqual(r.unlisted, ['archify/evil.sh'])
})

test('R3 摘要或字节不等 ⇒ mismatch', () => {
  const a = actual({ 'archify/SKILL.md': 'changed' })
  const r = judge(
    { entries: [{ path: 'archify/SKILL.md', sha256: sha256Hex(Buffer.from('orig')), bytes: 4 }] },
    a,
    LIMITS,
  )
  assert.equal(r.verdict, 'drift')
  assert.equal(r.mismatch.length, 1)
  assert.equal(r.mismatch[0].path, 'archify/SKILL.md')
})

test('R4 条目数超限 ⇒ overLimit', () => {
  const files = {}
  for (let i = 0; i < 5; i += 1) files[`a/${i}.txt`] = 'x'
  const a = actual(files)
  const r = judge({ entries: a.entries }, a, { maxEntries: 4, maxExpandedBytes: 1e9 })
  assert.equal(r.verdict, 'drift')
  assert.match(r.overLimit[0], /maxEntries/)
})

test('R4 总字节超限 ⇒ overLimit', () => {
  const a = actual({ 'a/big.txt': 'x'.repeat(128) })
  const r = judge({ entries: a.entries }, a, { maxEntries: 100, maxExpandedBytes: 64 })
  assert.equal(r.verdict, 'drift')
  assert.match(r.overLimit[0], /maxExpandedBytes/)
})

test('空对空不误判(空集不记红也不冒充绿)', () => {
  const r = judge({ entries: [] }, actual({}), LIMITS)
  assert.equal(r.verdict, 'ok')
  assert.equal(r.counts.actual, 0)
})

test('清单结构坏 ⇒ parseCatalog 抛错(调用方落未判定)', () => {
  assert.throws(() => parseCatalog('{not json'), /不是合法 JSON/)
  assert.throws(() => parseCatalog('{}'), /缺 entries/)
  assert.throws(() => parseCatalog(JSON.stringify({ root: '.ihui/other', entries: [] })), /不一致/)
  assert.throws(
    () => parseCatalog(JSON.stringify({ root: '.ihui/skills', entries: [{ path: 1 }] })),
    /结构坏/,
  )
})

test('parseLsTree 解析 -z 形态(含空格路径)', () => {
  const text = '100644 blob aaaa 12\t.ihui/skills/a b/SKILL.md\0'
  const rows = parseLsTree(Buffer.from(text, 'utf8'))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].path, '.ihui/skills/a b/SKILL.md')
  assert.equal(rows[0].oid, 'aaaa')
  assert.equal(rows[0].bytes, 12)
})

test('parseCatFileBatch 解析二进制安全分段', () => {
  const body = Buffer.from([0x00, 0x0a, 0xff])
  const head = Buffer.from(`bbbb blob ${body.length}\n`, 'utf8')
  const buf = Buffer.concat([head, body, Buffer.from('\n')])
  const map = parseCatFileBatch(buf)
  assert.deepEqual([...map.keys()], ['bbbb'])
  assert.deepEqual([...map.get('bbbb')], [0x00, 0x0a, 0xff])
})

test('worktree 档只认 git 可见面:.gitignore 掉的渲染示例不算 unlisted', () => {
  const dir = mkScratch('asset-catalog-')
  try {
    mkdirSync(join(dir, '.ihui', 'skills', 'archify'), { recursive: true })
    writeFileSync(join(dir, '.ihui', 'skills', 'archify', 'SKILL.md'), 'a')
    writeFileSync(join(dir, '.ihui', 'skills', 'archify', 'rendered.html'), 'x')
    writeFileSync(join(dir, '.gitignore'), '*.html\n')
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] })
    const catalog = computeWorktreeCatalog({ repoRoot: dir })
    assert.deepEqual(
      catalog.entries.map((e) => e.path),
      ['.ihui/skills/archify/SKILL.md'],
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
