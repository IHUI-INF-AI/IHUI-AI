// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/lib/typecheck-timing.mjs
//
// 读数是「超时现场唯一能回答谁卡住」的证据面,排序/在飞/容错口径必须被直接审。
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  formatDuration,
  formatSummaryLine,
  readTimings,
  summarizeTimings,
} from '../lib/typecheck-timing.mjs'

test('空记录:不得伪装成「0 个包通过」', () => {
  const s = summarizeTimings([], 1000)
  assert.equal(s.packages.length, 0)
  assert.equal(s.slowest, null)
  assert.equal(s.totalMs, 0)
  assert.match(formatSummaryLine(s), /尚无已完成包读数/)
})

test('已完成包按耗时降序,第一条即最慢包,串行相加不混入 phase', () => {
  const records = [
    { event: 'run-start', runId: 'r1', at: 1000 },
    { event: 'start', package: 'packages/database', at: 1000 },
    { event: 'finish', package: 'packages/database', elapsedMs: 120000, status: 0, done: true, at: 121000 },
    { event: 'start', package: 'apps/web', at: 121000 },
    { event: 'finish', package: 'apps/web', elapsedMs: 120230, status: 0, done: true, at: 241230 },
    { event: 'phase', phase: 'e2e', elapsedMs: 999999, status: 0, done: true, at: 241240 },
  ]
  const s = summarizeTimings(records, 241240)
  assert.deepEqual(
    s.packages.map((p) => p.name),
    ['apps/web', 'packages/database'],
    '必须按耗时降序',
  )
  assert.equal(s.slowest.name, 'apps/web')
  assert.equal(s.totalMs, 240230)
  assert.deepEqual(
    s.phases.map((p) => p.phase),
    ['e2e'],
    'phase 单独列出',
  )
  assert.equal(s.phases[0].elapsedMs, 999999)
})

test('超时被杀:在飞包必须给出「已运行多久 + 未完成」,而不是当作通过', () => {
  const records = [
    { event: 'run-start', runId: 'r2', at: 1000 },
    { event: 'start', package: '@ihui/api', at: 1000 },
    { event: 'finish', package: '@ihui/api', elapsedMs: 60000, status: 0, done: true, at: 61000 },
    { event: 'start', package: '@ihui/web', at: 61000 },
  ]
  const s = summarizeTimings(records, 300000)
  assert.deepEqual(s.packages.map((p) => [p.name, p.done]), [['@ihui/api', true]])
  assert.equal(s.inFlight.length, 1)
  assert.equal(s.inFlight[0].name, '@ihui/web')
  assert.equal(s.inFlight[0].elapsedMs, 239000, '在飞时长 = 现在 - 该包 start')
  assert.equal(s.inFlight[0].done, false)
  assert.equal(s.slowest.name, '@ihui/api', '未完成的包不得进入「最慢已完成」排名')
  assert.equal(s.wallMs, 299000)
})

test('失败包保留失败标记,不得被当成 Done', () => {
  const records = [
    { event: 'start', package: 'apps/cli', at: 1000 },
    { event: 'finish', package: 'apps/cli', elapsedMs: 1000, status: 2, done: false, at: 2000 },
  ]
  const s = summarizeTimings(records, 2000)
  assert.equal(s.packages[0].done, false)
  assert.equal(s.packages[0].status, 2)
})

test('JSONL 半行/坏行只丢那一条,文件缺失返回空数组', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-timing-'))
  try {
    const file = join(dir, 'timings.jsonl')
    writeFileSync(
      file,
      `${JSON.stringify({ event: 'start', package: 'a', at: 1 })}\n{"event":"finish",`,
    )
    const records = readTimings(file)
    assert.equal(records.length, 1)
    assert.equal(records[0].package, 'a')
    assert.deepEqual(readTimings(join(dir, 'missing.jsonl')), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('formatDuration 稳定输出一位小数,非法值不产生 NaN(日志可读性)', () => {
  assert.equal(formatDuration(120230), '120.2s')
  assert.equal(formatDuration(0), '0.0s')
  assert.equal(formatDuration(Number.NaN), '0.0s')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
