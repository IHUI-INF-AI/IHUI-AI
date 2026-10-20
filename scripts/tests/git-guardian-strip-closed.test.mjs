// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「完成即删」兜底清扫轮(2026-10-20 立,机主令"要彻底根治 固定完成立即删掉记录")的派发点镜像测试。
// 判据一律 import 自 `../git-guardian.mjs` 的 `__test__` 出口(§22c),本文件不重写任何判定。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN_SRC = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
const SWEEPER_SRC = readFileSync(
  fileURLToPath(new URL('../strip-stale-closed-rows.mjs', import.meta.url)),
  'utf8',
)

function harness(extra = {}) {
  const dir = mkScratch('gg-strip-closed-')
  const logs = []
  const calls = []
  const opts = {
    now: 1_700_000_000_000,
    intervalMs: 30 * 60 * 1000,
    tickFile: path.join(dir, 'tick.json'),
    logger: (l) => logs.push(String(l)),
    runner: () => {
      calls.push(1)
      return { ok: true, out: '✅ 无跨枚滞留的已完成登记行' }
    },
    ...extra,
  }
  return { dir, logs, calls, opts }
}

test('装车成套:清扫轮既在巡检轮里被派发,又挂在 __test__ 出口上(缺一条即"造好没装车")', () => {
  assert.equal(typeof G.sweepStaleClosedRows, 'function', '__test__ 必须导出本层')
  const dispatch = GUARDIAN_SRC.split('\n').filter((l) => l.trim() === 'if (!CHECK_ONLY) sweepStaleClosedRows()')
  assert.equal(dispatch.length, 1, `巡检轮派发点必须恰有一处实调用,实得 ${dispatch.length}(注释里的示例形态不算出路 §0.8)`)
  assert.ok(
    !/^\s*\/\*|^\s*\/\/\s*if/.test(GUARDIAN_SRC.split('\n').find((l) => l.trim() === 'if (!CHECK_ONLY) sweepStaleClosedRows()')),
    '派发点不得写在注释里',
  )
})

test('节流有牙:同一窗口内第二次派发必须零调用(每 2 分钟一轮会把共享仓刷爆)', () => {
  const h = harness()
  try {
    const first = G.sweepStaleClosedRows(h.opts)
    assert.equal(first.ran, true, '首轮应当派发')
    assert.equal(h.calls.length, 1)
    assert.ok(existsSync(h.opts.tickFile), '先落"已尝试"台账,再派发')
    const second = G.sweepStaleClosedRows({ ...h.opts, now: h.opts.now + 60_000 })
    assert.equal(second.ran, false, '未到窗口不得派发')
    assert.equal(second.why, '未到节流窗口')
    assert.equal(h.calls.length, 1, `节流失效 = 每轮一次对象空间落地(实调 ${h.calls.length})`)
  } finally {
    rmScratch(h.dir)
  }
})

test('到窗再派发:跨过节流后同一台账必须再次调用清扫器', () => {
  const h = harness()
  try {
    G.sweepStaleClosedRows(h.opts)
    const later = G.sweepStaleClosedRows({ ...h.opts, now: h.opts.now + 31 * 60 * 1000 })
    assert.equal(later.ran, true)
    assert.equal(h.calls.length, 2)
  } finally {
    rmScratch(h.dir)
  }
})

test('落地被拒不得抛、不得静默:返回 ok:false 并打一行 ⚠️ 读数', () => {
  const h = harness({
    runner: () => ({ ok: false, out: '❌ 守恒不过,整批不落:H1 未勾登记行没做到逐字节同序不变', err: 'exit 1' }),
  })
  try {
    const r = G.sweepStaleClosedRows(h.opts)
    assert.equal(r.ran, true)
    assert.equal(r.ok, false, '清扫失败必须如实返回,不得记成功')
    assert.ok(h.logs.some((l) => l.startsWith('⚠️') && /守恒不过/.test(l)), `日志必须带出清扫器的点名行,实得:${h.logs.join(' | ')}`)
  } finally {
    rmScratch(h.dir)
  }
})

test('台账写不下去时宁可多跑一轮也不裸奔:节流写入失败照旧派发', () => {
  const dir = mkScratch('gg-strip-closed-')
  try {
    // 把 tickFile 的父路径占成普通文件 ⇒ mkdirSync 必失败
    const blocker = path.join(dir, 'blocker')
    writeFileSync(blocker, 'x', 'utf8')
    const logs = []
    let calls = 0
    const r = G.sweepStaleClosedRows({
      now: 1_700_000_000_000,
      intervalMs: 30 * 60 * 1000,
      tickFile: path.join(blocker, 'nested', 'tick.json'),
      logger: (l) => logs.push(String(l)),
      runner: () => {
        calls++
        return { ok: true, out: '' }
      },
    })
    assert.equal(r.ran, true, '节流台账坏了 ⇒ 本轮照派(否则节流与熔断双双失效)')
    assert.equal(calls, 1)
    assert.ok(logs.some((l) => /节流台账写入失败/.test(l)), '写失败必须点名,不得静默')
  } finally {
    rmScratch(dir)
  }
})

test('单一实现:清扫器 import 守门判据,派发层不抄第二份"什么算滞留"', () => {
  assert.match(
    SWEEPER_SRC,
    /import\s*\{\s*staleClosedVerdict\s*\}\s*from\s*'\.\/check-plan-closed-stock\.mjs'/,
    '清扫器必须 import 守门的 staleClosedVerdict(§0.6/§22c)',
  )
  const body = GUARDIAN_SRC.slice(
    GUARDIAN_SRC.indexOf('export function sweepStaleClosedRows'),
    GUARDIAN_SRC.indexOf('export function sweepStaleClosedRows') + 3200,
  )
  assert.ok(!/staleClosedVerdict/.test(body), '派发层不该自己算判据(它只负责节流与派发)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
