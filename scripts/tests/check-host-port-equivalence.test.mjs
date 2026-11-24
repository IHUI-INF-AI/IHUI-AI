#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端口等价表门禁判据：
 * - 真实表完整 ⇒ 绿；
 * - 删一条（丢掉必覆盖端口）⇒ 红；
 * - 实现文件不存在 ⇒ 红；
 * - CLI 缺项 ⇒ exit 1。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  DEFAULT_TABLE,
  REPO,
  validateHostPortEquivalence,
} from '../check-host-port-equivalence.mjs'

function tempTable(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-host-port-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return join(dir, 'host-port-equivalence.json')
}

test('真实等价表完整 ⇒ 绿，且覆盖 onNavigate/onToast/onAudio', () => {
  const result = validateHostPortEquivalence()
  assert.equal(result.ok, true)
  assert.ok(result.entries >= 5)
  assert.deepEqual(result.portKeys, ['onAudio', 'onNavigate', 'onToast'])
  assert.deepEqual(result.issues, [])
})

test('删掉 onToast 条目 ⇒ 红（missing-port-coverage）', (t) => {
  const table = JSON.parse(readFileSync(DEFAULT_TABLE, 'utf8'))
  table.ports = table.ports.filter((entry) => entry.port !== 'onToast')
  const file = tempTable(t)
  writeFileSync(file, JSON.stringify(table, null, 2), 'utf8')

  const result = validateHostPortEquivalence({ tablePath: file, root: REPO })
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((item) => item.code === 'missing-port-coverage'))
})

test('实现文件不存在 ⇒ 红（missing-impl）', (t) => {
  const table = JSON.parse(readFileSync(DEFAULT_TABLE, 'utf8'))
  table.ports[0].miniappImpl = 'apps/miniapp-taro/src/host/__not_exists__.tsx'
  const file = tempTable(t)
  writeFileSync(file, JSON.stringify(table, null, 2), 'utf8')

  const result = validateHostPortEquivalence({ tablePath: file, root: REPO })
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((item) => item.code === 'missing-impl'))
})

test('CLI 缺项 ⇒ exit 1，--json 输出可机读', (t) => {
  const table = JSON.parse(readFileSync(DEFAULT_TABLE, 'utf8'))
  table.ports = table.ports.filter((entry) => entry.port !== 'onAudio')
  const file = tempTable(t)
  writeFileSync(file, JSON.stringify(table, null, 2), 'utf8')

  const script = join(REPO, 'scripts', 'check-host-port-equivalence.mjs')
  const run = spawnSync(process.execPath, [script, '--json', '--table', file], {
    cwd: REPO,
    encoding: 'utf8',
  })

  assert.equal(run.status, 1)
  const parsed = JSON.parse(run.stdout)
  assert.equal(parsed.ok, false)
  assert.ok(parsed.issues.some((item) => item.code === 'missing-port-coverage'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
