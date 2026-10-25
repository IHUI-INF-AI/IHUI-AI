#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:evolution-retro.mjs(O65 第 3 期「进化回流」失败票归因沉淀器)。
 *
 * 判据全部 import 生产实现(§22c:本文件不复制判据常量)。钉六环:
 *  ① 桶键身份稳定 —— 维度集合序无关、reason 自由文本漂移不合新桶(§5e-1);
 *  ② 成功出口(`pass`)不进归因;
 *  ③ 24h 窗裁剪与达阈判据(≥2 才派);
 *  ④ 同桶 24h 内已派 ⇒ 去重;窗外旧派单不拦;
 *  ⑤ 摘要 ≤8 行、机器行单行可 grep 可解析;
 *  ⑥ 台账只追加、坏行不作废整本;CLI 真跑:达阈落盘、dry-run 不落盘、缺台账 exit 2。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  FAILURE_ACTIONS,
  MAX_SUMMARY_LINES,
  appendRetro,
  bucketKeyOf,
  formatDispatchLine,
  formatSummary,
  planDispatch,
  readRetroLedger,
  scanWindow,
} from '../evolution-retro.mjs'

const SCRIPT = fileURLToPath(new URL('../evolution-retro.mjs', import.meta.url))
const NOW = Date.parse('2026-10-25T12:00:00.000Z')
const at = (hours) => new Date(NOW - hours * 3600_000).toISOString()
const row = (extra = {}) => ({
  v: 1,
  ts: at(1),
  action: 'rollback',
  failDims: ['web', 'llm'],
  reason: '健康门禁未过',
  sha: 'aaaaaaa',
  ...extra,
})

test('桶键:维度顺序无关、reason 漂移不合新桶、非失败出口无桶', () => {
  assert.equal(bucketKeyOf(row({ failDims: ['web', 'llm'], reason: 'x' })), bucketKeyOf(row({ failDims: ['llm', 'web'], reason: 'y' })))
  assert.match(bucketKeyOf(row()), /^rollback\|llm\+web$/)
  assert.equal(bucketKeyOf({ action: 'pass', failDims: ['web'] }), '')
  assert.equal(bucketKeyOf({ action: 'auto-heal' }), '')
  for (const a of FAILURE_ACTIONS) assert.notEqual(bucketKeyOf({ action: a, failDims: [] }), '')
})

test('scanWindow:窗外剔除、窗内聚合并按次数降序', () => {
  const buckets = scanWindow([row({ ts: at(1) }), row({ ts: at(2) }), row({ ts: at(30) })], { now: NOW, windowHours: 24 })
  assert.equal(buckets.length, 1)
  assert.equal(buckets[0].count, 2)
  assert.equal(buckets[0].dims.join('+'), 'llm+web')

  const two = scanWindow(
    [row({ ts: at(1) }), row({ ts: at(2) }), row({ action: 'build-fail', failDims: [], ts: at(5) })],
    { now: NOW, windowHours: 24 },
  )
  assert.equal(two[0].key, 'rollback|llm+web')
  assert.equal(two[1].key, 'build-fail|')
})

test('planDispatch:阈下不派、达阈派、同桶已派去重、窗外旧派单不拦', () => {
  const one = scanWindow([row()], { now: NOW, windowHours: 24 })
  assert.equal(planDispatch(one, [], { now: NOW }).dispatched.length, 0)

  const buckets = scanWindow([row({ ts: at(1) }), row({ ts: at(2) })], { now: NOW, windowHours: 24 })
  const key = buckets[0].key
  assert.equal(planDispatch(buckets, [], { now: NOW }).dispatched.length, 1)

  const dup = planDispatch(buckets, [{ action: 'dispatched', bucket: key, ts: at(3) }], { now: NOW })
  assert.equal(dup.dispatched.length, 0)
  assert.equal(dup.skipped.length, 1)

  const stale = planDispatch(buckets, [{ action: 'dispatched', bucket: key, ts: at(30) }], { now: NOW })
  assert.equal(stale.dispatched.length, 1)
})

test('摘要 ≤8 行且机器行单行可 grep 可解析', () => {
  const buckets = scanWindow([row({ ts: at(1) }), row({ ts: at(2) })], { now: NOW, windowHours: 24 })
  const plan = planDispatch(buckets, [], { now: NOW })
  const text = formatSummary(plan.dispatched, plan.skipped)
  assert.ok(text.split('\n').length <= MAX_SUMMARY_LINES, `行数 ${text.split('\n').length}`)

  const line = formatDispatchLine(plan.dispatched[0])
  assert.ok(line.startsWith('EVOLUTION-RETRO '))
  assert.ok(!line.includes('\n'))
  const obj = JSON.parse(line.slice('EVOLUTION-RETRO '.length))
  assert.equal(obj.kind, 'dispatch')
  assert.equal(obj.bucket, plan.dispatched[0].bucket)
  assert.equal(obj.count, 2)
})

test('台账:只追加、坏行不作废整本、24h 去重可读', () => {
  const dir = mkdtempSync(join(tmpdir(), 'evo-retro-'))
  try {
    const ledger = join(dir, 'state', 'evolution-retro.jsonl')
    const item = {
      bucket: 'rollback|web',
      count: 2,
      windowHours: 24,
      lastTs: at(1),
      shas: ['aaaaaaa'],
      sampleReason: 'x',
    }
    appendRetro(ledger, item)
    appendRetro(ledger, { ...item, bucket: 'rollback|llm' })
    writeFileSync(ledger, `${readFileSync(ledger, 'utf8')}{半截坏行\n`, 'utf8')
    writeFileSync(ledger, `${readFileSync(ledger, 'utf8')}${'not json'}\n`, 'utf8')
    const rows = readRetroLedger((p) => readFileSync(p, 'utf8'), ledger)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].action, 'dispatched')
    assert.equal(rows[0].bucket, 'rollback|web')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI 真跑:达阈落盘 / dry-run 不落盘 / 缺台账 exit 2 / 非整数参数 exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'evo-cli-'))
  try {
    const decisions = join(dir, 'decisions.jsonl')
    const ledger = join(dir, 'retro.jsonl')
    const recent = (h) => new Date(Date.now() - h * 3600_000).toISOString()
    const cliRows = [row({ ts: recent(1) }), row({ ts: recent(2) })]
    writeFileSync(decisions, `${cliRows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8')

    const ok = spawnSync(process.execPath, [SCRIPT, '--decisions', decisions, '--ledger', ledger], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr)
    assert.ok(ok.stdout.includes('EVOLUTION-RETRO '))
    assert.ok(existsSync(ledger))

    const again = spawnSync(process.execPath, [SCRIPT, '--decisions', decisions, '--ledger', ledger], { encoding: 'utf8' })
    assert.equal(again.status, 0, again.stderr)
    assert.ok(again.stdout.includes('跳过派单'))

    const dry = join(dir, 'dry.jsonl')
    const dr = spawnSync(process.execPath, [SCRIPT, '--decisions', decisions, '--ledger', dry, '--dry-run'], { encoding: 'utf8' })
    assert.equal(dr.status, 0, dr.stderr)
    assert.ok(!existsSync(dry), 'dry-run 不得写台账')

    const missing = spawnSync(process.execPath, [SCRIPT, '--decisions', join(dir, 'nope.jsonl'), '--ledger', ledger], { encoding: 'utf8' })
    assert.equal(missing.status, 2, missing.stdout)

    const badArg = spawnSync(process.execPath, [SCRIPT, '--decisions', decisions, '--ledger', ledger, '--min-count', 'x'], { encoding: 'utf8' })
    assert.equal(badArg.status, 2, badArg.stdout)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
