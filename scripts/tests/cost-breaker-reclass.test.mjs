// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `cost-breaker.mjs --reclassify-blocked` 的**写盘分支**镜像测试(2026-11-05 立)。
 * 立因:同一枚改判据的纯函数锁(`planBlockedReclass`)17 例全绿,而真跑 `--apply` 第一次就崩
 * 在两处自伤(`writeFileSync` 未 import、`Date.now()` 当字符串用)—— 单测绿而真跑崩,就是因为
 * **写盘这条腿没有夹具**。本文件把四态钉住:可证则改桶并备份留痕、幂等二次运行零改、
 * 零可证则一个字都不写、缺 `session-blocked` 桶则未判定拒写(不静默新建)。
 * 判据本体一律从生产面 import(§22c),夹具落 `scratch-dir`(§15b:不落 TEMP、不落仓库树内)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'cost-breaker.mjs')
const LAUNCH_WHY = "exit=1 stderr='node' ڲⲿ⣬Ҳǿеĳ ļ"

const CAPS = JSON.stringify({
  kinds: {
    session: { perHour: 3, perDay: 24, minutesPerDay: 720 },
    'session-blocked': { perHour: 6, perDay: 12, minutesPerDay: 90 },
  },
})

/** 造一份夹具:两行可证腿断 + 一行真跑过的失败 + 一行成功班次。 */
function fixture(dir) {
  const ts = (n) => new Date(Date.parse('2026-11-05T02:00:00.000Z') + n * 1000).toISOString()
  const cost = [
    { ts: ts(0), kind: 'session', minutes: 0.01, note: 'auto-evolve session-failed' },
    { ts: ts(60), kind: 'session', minutes: 0.01, note: 'auto-evolve session-failed' },
    { ts: ts(120), kind: 'session', minutes: 41.2, note: 'auto-evolve session-failed' },
    { ts: ts(180), kind: 'session', minutes: 0.02, note: 'auto-evolve session-ok' },
  ]
  const disp = [
    { ts: ts(0), mode: 'dispatch', action: 'session-failed', why: LAUNCH_WHY },
    { ts: ts(60), mode: 'dispatch', action: 'session-failed', why: LAUNCH_WHY },
    { ts: ts(120), mode: 'dispatch', action: 'session-failed', why: 'typecheck failed in 3 files' },
    { ts: ts(180), mode: 'dispatch', action: 'session-ok', why: '' },
  ]
  const p = {
    caps: join(dir, 'caps.json'),
    ledger: join(dir, 'cost-ledger.jsonl'),
    disp: join(dir, 'disp.jsonl'),
    reclass: join(dir, 'reclass.jsonl'),
  }
  writeFileSync(p.caps, CAPS, 'utf8')
  writeFileSync(p.ledger, cost.map((r) => JSON.stringify(r) + '\n').join(''), 'utf8')
  writeFileSync(p.disp, disp.map((r) => JSON.stringify(r) + '\n').join(''), 'utf8')
  return { p, cost }
}

const run = (p, extra = []) =>
  spawnSync(
    process.execPath,
    [
      SCRIPT,
      '--reclassify-blocked',
      '--caps',
      p.caps,
      '--ledger',
      p.ledger,
      '--dispatch-ledger',
      p.disp,
      '--reclass-ledger',
      p.reclass,
      ...extra,
    ],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
const readCost = (p) =>
  readFileSync(p.ledger, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l))

test('W1 写盘分支:可证的 2 行改桶、真跑过的与成功的不动,且写盘前自动备份原账本', () => {
  const dir = mkScratch('cbr-w1-')
  try {
    const { p } = fixture(dir)
    const r = run(p, ['--apply'])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /已改桶 2 行/)
    const rows = readCost(p)
    assert.equal(rows.filter((x) => x.kind === 'session-blocked').length, 2)
    assert.equal(
      rows.filter((x) => x.kind === 'session-blocked' && x.reclassifiedAt).length,
      2,
      '改桶必须带时刻与规则',
    )
    assert.equal(rows[2].kind, 'session', '真跑过 41.2 分钟的失败必须留在生产桶(改桶不是免单)')
    assert.equal(rows[3].kind, 'session', '成功班次不许被顺手改桶')
    const baks = readdirSync(dir).filter((f) => f.includes('.pre-reclass-'))
    assert.equal(baks.length, 1, `备份应恰好一份,现读 ${baks.length} 份`)
    const bakText = readFileSync(join(dir, baks[0]), 'utf8')
    assert.equal(bakText.split(/\r?\n/).filter(Boolean).length, 4, '备份必须是改桶前的原样 4 行')
    assert.ok(
      bakText.includes('"kind":"session"') && !bakText.includes('session-blocked'),
      '备份里不许已有改桶痕迹',
    )
    assert.equal(existsSync(p.reclass), true, '逐行留痕必须落盘(否则改判无法追责)')
    assert.equal(readFileSync(p.reclass, 'utf8').trim().split(/\r?\n/).length, 2)
  } finally {
    rmScratch(dir)
  }
})

test('W2 幂等:同一夹具二次 --apply 必须零改、且不再产生第二份备份/留痕', () => {
  const dir = mkScratch('cbr-w2-')
  try {
    const { p } = fixture(dir)
    assert.equal(run(p, ['--apply']).status, 0)
    const before = readFileSync(p.ledger, 'utf8')
    const marksBefore = readFileSync(p.reclass, 'utf8').trim().split(/\r?\n/).length
    const r2 = run(p, ['--apply'])
    assert.equal(r2.status, 0, r2.stderr)
    assert.match(r2.stdout, /零行可证|拟改桶=0/)
    assert.equal(readFileSync(p.ledger, 'utf8'), before, '二次运行不许重写字节')
    assert.equal(
      readFileSync(p.reclass, 'utf8').trim().split(/\r?\n/).length,
      marksBefore,
      '留痕不许翻倍',
    )
  } finally {
    rmScratch(dir)
  }
})

test('W3 反向锁:预演档(不带 --apply)一个字都不许写', () => {
  const dir = mkScratch('cbr-w3-')
  try {
    const { p } = fixture(dir)
    const before = readFileSync(p.ledger, 'utf8')
    const r = run(p)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /拟改桶=2/)
    assert.match(r.stdout, /预演档:未写盘/)
    assert.equal(readFileSync(p.ledger, 'utf8'), before)
    assert.equal(existsSync(p.reclass), false, '预演不许落留痕')
  } finally {
    rmScratch(dir)
  }
})

test('W4 fail-closed:上限表里没有 session-blocked 这一桶 ⇒ 未判定拒写,不静默新建', () => {
  const dir = mkScratch('cbr-w4-')
  try {
    const { p } = fixture(dir)
    writeFileSync(p.caps, JSON.stringify({ kinds: { session: { perDay: 24 } } }), 'utf8')
    const before = readFileSync(p.ledger, 'utf8')
    const r = run(p, ['--apply'])
    assert.equal(r.status, 2, `应落未判定档,实读 status=${r.status} / ${r.stdout}`)
    assert.match(r.stderr + r.stdout, /未判定/)
    assert.equal(readFileSync(p.ledger, 'utf8'), before)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
