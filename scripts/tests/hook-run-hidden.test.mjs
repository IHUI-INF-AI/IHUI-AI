#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const WRAPPER = join(REPO, 'scripts/hook-run-hidden.mjs')
const LOG_ROOT = join(REPO, '.ihui-agent/state/hook-logs')

function invoke(logName, script, ...args) {
  return spawnSync(process.execPath, [WRAPPER, logName, script, ...args], {
    cwd: REPO,
    encoding: 'utf8',
  })
}

function fixture(body) {
  const dir = mkdtempSync(join(tmpdir(), 'hook-hidden-test-'))
  const path = join(dir, 'body.mjs')
  writeFileSync(path, `${body}\n`)
  return { dir, path }
}

function cleanup(logName, dirs = []) {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  rmSync(join(LOG_ROOT, logName), { recursive: true, force: true })
  rmSync(join(LOG_ROOT, `${logName}.log`), { force: true })
}

test('退出码原样传播：0 / 1 / 2 / 75 都不被包装吃掉', () => {
  const { dir, path } = fixture('const n = Number(process.argv[2]); process.exit(n)')
  const logName = `rc-${randomUUID()}`
  try {
    for (const want of [0, 1, 2, 75]) {
      const got = invoke(logName, path, String(want))
      assert.equal(got.status, want, `exit ${want} was rewritten to ${got.status}`)
    }
  } finally {
    cleanup(logName, [dir])
  }
})

test('日志双落：per-run 原件保留 + canonical 汇总含 rc trailer', () => {
  const { dir, path } = fixture("console.log('gate output'); process.exit(1)")
  const logName = `log-${randomUUID()}`
  try {
    const got = invoke(logName, path)
    assert.equal(got.status, 1)
    const canonical = join(LOG_ROOT, `${logName}.log`)
    assert.ok(existsSync(canonical), 'canonical log missing')
    const text = readFileSync(canonical, 'utf8')
    assert.match(text, /gate output/, 'child stdout lost')
    assert.match(text, /rc=1/, 'exit-code trailer lost')
    const runDir = join(LOG_ROOT, logName)
    assert.ok(existsSync(runDir), 'per-run directory missing')
    assert.ok(readdirSync(runDir).some((f) => f.startsWith('wsh-')), 'per-run primary lost')
  } finally {
    cleanup(logName, [dir])
  }
})

test('参数透传：带空格与中文的参数原样到达 gate', () => {
  const { dir, path } = fixture(
    "const [a, b] = process.argv.slice(2); console.log(JSON.stringify([a, b])); process.exit(0)",
  )
  const logName = `args-${randomUUID()}`
  try {
    const got = invoke(logName, path, '含 空格', '中文参数')
    assert.equal(got.status, 0)
    const text = readFileSync(join(LOG_ROOT, `${logName}.log`), 'utf8')
    assert.match(text, /"中文参数"/)
  } finally {
    cleanup(logName, [dir])
  }
})

test('非法 logname 被拒且不落盘（路径穿越防护）', () => {
  const { dir, path } = fixture('process.exit(0)')
  const logName = 'escape-probe'
  try {
    const got = invoke('../outside', path)
    assert.equal(got.status, 2)
    assert.match(got.stderr, /illegal logname/)
    assert.ok(!existsSync(join(LOG_ROOT, `${logName}.log`)), 'unexpected log landed')
  } finally {
    cleanup(logName, [dir])
  }
})

test('日志层不可用仍跑 gate 并保留 rc（不等于吞红）', () => {
  const { dir, path } = fixture('process.exit(75)')
  const logName = `layer-${randomUUID()}`
  try {
    mkdirSync(LOG_ROOT, { recursive: true })
    // A regular file at the run-directory path makes mkdir/open fail on purpose.
    writeFileSync(join(LOG_ROOT, logName), 'blocked')
    const got = invoke(logName, path)
    assert.equal(got.status, 75, 'log-layer failure swallowed the gate verdict')
  } finally {
    cleanup(logName, [dir])
  }
})

test('并发两路同 logname：两份结论都进 canonical（原子合并）', () => {
  const { dir, path } = fixture('const n = process.argv[2]; console.log(`run-${n}`); process.exit(0)')
  const logName = `parallel-${randomUUID()}`
  try {
    const a = spawnSync(process.execPath, [WRAPPER, logName, path, 'a'], { cwd: REPO })
    const b = spawnSync(process.execPath, [WRAPPER, logName, path, 'b'], { cwd: REPO })
    assert.equal(a.status, 0)
    assert.equal(b.status, 0)
    const text = readFileSync(join(LOG_ROOT, `${logName}.log`), 'utf8')
    assert.match(text, /run-a/)
    assert.match(text, /run-b/)
    assert.equal((text.match(/rc=0/g) ?? []).length, 2)
  } finally {
    cleanup(logName, [dir])
  }
})

test('自证无脚本宿主依赖：派生走 process.execPath 且带 windowsHide', () => {
  const src = readFileSync(WRAPPER, 'utf8')
  assert.match(src, /spawnSync\(process\.execPath/, 'dispatch is not via current node binary')
  assert.match(src, /windowsHide: true/, 'missing windowsHide — would reintroduce console popups')
})
