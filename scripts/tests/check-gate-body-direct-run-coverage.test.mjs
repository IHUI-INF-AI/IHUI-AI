// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { __test__ } from '../check-gate-body-direct-run-coverage.mjs'

const { runAudit } = __test__
const LEDGER = 'scripts/data/gate-body-direct-run-allowlist.json'
const SURFACE = "import { selectFace } from './lib/face-reader.mjs'\n"

function git(dir, args) {
  execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
}

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), text, 'utf8')
}

function putCovered(dir, script, body = "console.log('ok')\n") {
  write(dir, `scripts/${script}`, `${SURFACE}${body}`)
}

function putPlain(dir, script, body = "console.log('ok')\n") {
  write(dir, `scripts/${script}`, body)
}

function registry(dir, scripts) {
  write(
    dir,
    'scripts/guardian-runner.mjs',
    `export const checks = [\n${scripts.map((s, i) => `  { id: '${i + 1}', label: 'g', script: '${s}' },`).join('\n')}\n]\n`,
  )
}

function ledger(dir, entries) {
  write(dir, LEDGER, `${JSON.stringify({ entries }, null, 2)}\n`)
}

function row(path, extra = {}) {
  return {
    path,
    kind: 'direct-run-uncovered',
    why: '存量直跑面未接判面层,迁移票已开',
    reviewBy: '2027-06-30',
    ...extra,
  }
}

function makeRepo(scripts) {
  const dir = mkdtempSync(join(tmpdir(), 'gate312-'))
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 't@example.com'])
  git(dir, ['config', 'user.name', 'fixture'])
  write(dir, 'scripts/lib/face-reader.mjs', 'export function selectFace() { return { face: "head" } }\n')
  for (const s of scripts) putPlain(dir, s)
  return dir
}

function commitAll(dir) {
  git(dir, ['add', '.'])
  git(dir, ['commit', '-qm', 'fixture'])
}

function audit(dir, baseline) {
  return runAudit({ root: dir, face: 'head', baseline })
}

function withRepo(scripts, fn) {
  const dir = makeRepo(scripts)
  try {
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('T1 新增注册门未接判面层且不在台账 ⇒ exit 1,点名该门', () =>
  withRepo([], (dir) => {
    putPlain(dir, 'check-new-gate.mjs', "import { readFileSync } from 'node:fs'\n")
    registry(dir, ['check-new-gate.mjs'])
    ledger(dir, [])
    commitAll(dir)
    const r = audit(dir, [])
    assert.equal(r.code, 1, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /R1/)
    assert.match(r.lines.join('\n'), /scripts\/check-new-gate\.mjs/)
  }))

test('T2 台账内的存量门 ⇒ exit 0,并如实报存量债', () =>
  withRepo(['check-legacy-gate.mjs'], (dir) => {
    registry(dir, ['check-legacy-gate.mjs'])
    ledger(dir, [row('scripts/check-legacy-gate.mjs')])
    commitAll(dir)
    const r = audit(dir, ['scripts/check-legacy-gate.mjs'])
    assert.equal(r.code, 0, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /存量债 1/)
  }))

test('T3 清单腐烂:已接判面层却还挂账 ⇒ exit 1(删条目=已迁移证据)', () =>
  withRepo(['check-migrated-gate.mjs'], (dir) => {
    putCovered(dir, 'check-migrated-gate.mjs')
    registry(dir, ['check-migrated-gate.mjs'])
    ledger(dir, [row('scripts/check-migrated-gate.mjs')])
    commitAll(dir)
    const r = audit(dir, ['scripts/check-migrated-gate.mjs'])
    assert.equal(r.code, 1, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /R3/)
  }))

test('T4 台账只许缩短:条目越出硬基线 ⇒ exit 1,不许新增抵账', () =>
  withRepo(['check-legacy-gate.mjs'], (dir) => {
    registry(dir, ['check-legacy-gate.mjs'])
    ledger(dir, [row('scripts/check-legacy-gate.mjs'), row('scripts/check-off-baseline.mjs')])
    commitAll(dir)
    const r = audit(dir, ['scripts/check-legacy-gate.mjs'])
    assert.equal(r.code, 1, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /R2/)
    assert.match(r.lines.join('\n'), /scripts\/check-off-baseline\.mjs/)
  }))

test('T5 reviewBy 到期 ⇒ exit 1(存量债不许续命不动)', () =>
  withRepo(['check-legacy-gate.mjs'], (dir) => {
    registry(dir, ['check-legacy-gate.mjs'])
    ledger(dir, [row('scripts/check-legacy-gate.mjs', { reviewBy: '2020-01-01' })])
    commitAll(dir)
    const r = audit(dir, ['scripts/check-legacy-gate.mjs'])
    assert.equal(r.code, 1, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /R4/)
  }))

test('T6 registry 在被判面读不到 ⇒ exit 2(未判定),不数违规', () =>
  withRepo([], (dir) => {
    ledger(dir, [])
    commitAll(dir)
    const r = audit(dir, [])
    assert.equal(r.code, 2, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /未判定/)
    assert.doesNotMatch(r.lines.join('\n'), /R1/)
  }))

test('T7 台账形状非法 ⇒ exit 2(未判定),不做默认放行', () =>
  withRepo(['check-legacy-gate.mjs'], (dir) => {
    registry(dir, ['check-legacy-gate.mjs'])
    write(dir, LEDGER, `${JSON.stringify({ entries: [{ path: 1 }] }, null, 2)}\n`)
    commitAll(dir)
    const r = audit(dir, ['scripts/check-legacy-gate.mjs'])
    assert.equal(r.code, 2, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /未判定/)
  }))

test('T8 registry 枚举到 0 道门 ⇒ exit 2(形状变了,不许当作全绿)', () =>
  withRepo([], (dir) => {
    registry(dir, [])
    ledger(dir, [])
    commitAll(dir)
    const r = audit(dir, [])
    assert.equal(r.code, 2, r.lines.join('\n'))
    assert.match(r.lines.join('\n'), /未判定/)
  }))
