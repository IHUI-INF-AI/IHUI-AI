// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  findDispatchStampsInSource,
  judgeRegistryCoverage,
} from '../lib/autonomy-leg-liveness.mjs'
import { judgeLivenessFace } from '../check-autonomy-leg-health.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('findDispatchStampsInSource: 只认引号内的 -dispatch-last.json 字面量并去重', () => {
  const src = `
    const a = join(W, '.ihui-agent', 'state', 'alpha-dispatch-last.json')
    const b = "beta-dispatch-last.json"
    const c = \`gamma-dispatch-last.json\`
    const dup = 'alpha-dispatch-last.json'
    const notStamp = 'delta-last.json'
  `
  assert.deepEqual(findDispatchStampsInSource(src), [
    'alpha-dispatch-last.json',
    'beta-dispatch-last.json',
    'gamma-dispatch-last.json',
  ])
})

test('judgeRegistryCoverage: 源里有而表里没有 ⇒ drift 并逐枚点名', () => {
  const r = judgeRegistryCoverage({
    sourceStamps: ['a-dispatch-last.json', 'b-dispatch-last.json'],
    legs: [{ stamp: 'a-dispatch-last.json' }],
  })
  assert.equal(r.state, 'drift')
  assert.deepEqual(r.missing, ['b-dispatch-last.json'])
  assert.match(r.summary, /源里有而表里没有:b-dispatch-last\.json/)
})

test('judgeRegistryCoverage: 表里有而源面没有只点名不判红(可能由变量拼装)', () => {
  const r = judgeRegistryCoverage({
    sourceStamps: ['a-dispatch-last.json'],
    legs: [{ stamp: 'a-dispatch-last.json' }, { stamp: 'c-dispatch-last.json' }],
  })
  assert.equal(r.state, 'ok')
  assert.deepEqual(r.orphan, ['c-dispatch-last.json'])
  assert.match(r.summary, /只点名不判红/)
})

test('judgeRegistryCoverage: 输入取不到 ⇒ unjudged,绝不读成"覆盖面完好"', () => {
  assert.equal(judgeRegistryCoverage({ sourceStamps: null, legs: [] }).state, 'unjudged')
  assert.equal(judgeRegistryCoverage({}).state, 'unjudged')
})

test('接线锁: A8 的取料层必须真的读源面并跑覆盖面判据', () => {
  const gate = readFileSync(join(ROOT, 'scripts', 'check-autonomy-leg-health.mjs'), 'utf8')
  assert.match(gate, /findDispatchStampsInSource\(readFaceText\('scripts\/git-guardian\.mjs'/)
  assert.match(gate, /judgeRegistryCoverage\(\{/)
})

test('judgeLivenessFace: 新挂但一次没跑过的派发器也要被抓出来(盘上无戳时也判得出)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'legcov-'))
  try {
    mkdirSync(join(dir, 'scripts', 'data'), { recursive: true })
    mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
    writeFileSync(
      join(dir, 'scripts', 'git-guardian.mjs'),
      `export function sweepGhost(){ const tickFile = join(W,'.ihui-agent','state','ghost-dispatch-last.json') }\n`,
      'utf8',
    )
    writeFileSync(
      join(dir, 'scripts', 'data', 'autonomy-leg-liveness.json'),
      JSON.stringify({ legs: [{ stamp: 'known-dispatch-last.json', owner: 'x', nominalIntervalMs: 300000, verifiedAt: '2026-11-21' }] }),
      'utf8',
    )
    const dim = judgeLivenessFace({ face: 'worktree', root: dir, now: Date.now() })
    assert.equal(dim.state, 'drift')
    assert.match(dim.readout, /源里有而表里没有:ghost-dispatch-last\.json/)
    assert.match(dim.next, /补进 scripts\/data\/autonomy-leg-liveness\.json/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
