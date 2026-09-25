// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守护「收敛器收尾对齐停摆 → 喊人」镜像测试(§22c:import 源模块 __test__,零复制实现)。
//
// 立因(票 O74):收敛器 alignWorktreeAfterHeadMove 长期失败(锁一直被占)过去只记日志。
// 现由收敛器写 .workbuddy/converge-align-state.json,守护每轮读它并按阈值
// 经 notifyGuardRed('converge-align-stall', …) 走 §5e 唯一邮件通道。本测试钉:
//   (a) 阳性对照:连续 3 次 + 最后失败 12 分钟前 ⇒ 该喊;
//   (b) 反向对照:2 次不喊 / 3 次但 1 分钟前不喊 / 成功归零不喊 / 状态缺失不喊;
//   (c) 坏 JSON ⇒ 不喊且不崩(判据失效不得表现为事故,也不得表现为红);
//   (d) 阈值 env 可覆盖(IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS);
//   (e) 装车证明:tick 真正会执行的分支上调了 checkConvergeAlignStall,派发名逐字为
//       'converge-align-stall'(挂错分支 = 永不执行,本仓记过两次)。
// 全部用**构造输入**取证,假 notify 注入 ⇒ 零网络、零真邮件、零生产端口。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const NOW = 1_700_000_000_000
const MIN = 60_000

/** 只测判据本体:显式喂默认阈值,不吃进程 env(环境是别人的) */
const DFLT = { cfg: { minFails: 3, minAgeMs: 10 * MIN } }

function stallState(fails, ageMs, extra = {}) {
  return {
    consecutiveFailures: fails,
    lastFailAt: NOW - ageMs,
    lastOkAt: null,
    lastNote: 'rc=1 fatal: Unable to create index.lock: File exists',
    ...extra,
  }
}

test('(a)阳性对照:连续 3 次 + 12 分钟前 ⇒ 判该喊人', () => {
  const d = G.shouldAlertAlignStall(stallState(3, 12 * MIN), NOW, DFLT.cfg)
  assert.equal(d.alert, true)
  assert.equal(d.fails, 3)
  assert.ok(d.ageMs >= 10 * MIN)
})

test('(b)反向对照:2 次 / 3 次但 1 分钟前 / 成功归零 / 状态缺失 ⇒ 都不喊', () => {
  assert.equal(G.shouldAlertAlignStall(stallState(2, 60 * MIN), NOW, DFLT.cfg).alert, false)
  assert.equal(G.shouldAlertAlignStall(stallState(3, 1 * MIN), NOW, DFLT.cfg).alert, false)
  assert.equal(
    G.shouldAlertAlignStall(
      { consecutiveFailures: 0, lastFailAt: NOW - 60 * MIN, lastOkAt: NOW },
      NOW,
      DFLT.cfg,
    ).alert,
    false,
  )
  assert.equal(G.shouldAlertAlignStall(null, NOW, DFLT.cfg).alert, false, '状态文件不存在绝不喊人')
  assert.equal(G.shouldAlertAlignStall({ lastNote: '没有计数' }, NOW, DFLT.cfg).alert, false)
  assert.equal(
    G.shouldAlertAlignStall(stallState(9, 99 * MIN), NOW, { minFails: 10, minAgeMs: 10 * MIN })
      .alert,
    false,
  )
})

test('(b2)lastFailAt 不可用 ⇒ 无法判定,不喊', () => {
  assert.equal(
    G.shouldAlertAlignStall({ consecutiveFailures: 5, lastFailAt: '昨天' }, NOW, DFLT.cfg).alert,
    false,
  )
})

test('(d)env 覆盖阈值:IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS', () => {
  const before = {
    f: process.env.IHUI_ALIGN_STALL_FAILS,
    a: process.env.IHUI_ALIGN_STALL_AGE_MS,
  }
  try {
    process.env.IHUI_ALIGN_STALL_FAILS = '2'
    process.env.IHUI_ALIGN_STALL_AGE_MS = String(2 * MIN)
    assert.equal(G.shouldAlertAlignStall(stallState(2, 3 * MIN), NOW, {}).alert, true)
    process.env.IHUI_ALIGN_STALL_FAILS = 'not-a-number' // 坏 env ⇒ 回默认 3
    assert.equal(G.shouldAlertAlignStall(stallState(2, 3 * MIN), NOW, {}).alert, false)
    const t = G.alignStallThresholds({})
    assert.equal(t.minFails, 3)
    assert.equal(t.minAgeMs, 2 * MIN, '数值 env 仍生效')
  } finally {
    if (before.f === undefined) delete process.env.IHUI_ALIGN_STALL_FAILS
    else process.env.IHUI_ALIGN_STALL_FAILS = before.f
    if (before.a === undefined) delete process.env.IHUI_ALIGN_STALL_AGE_MS
    else process.env.IHUI_ALIGN_STALL_AGE_MS = before.a
  }
})

test('(c)+派发实参:达阈值时 notify 恰一次,name/内容含 rc、真因、次数、状态文件路径', () => {
  const dir = mkScratch('gg-align-alert-')
  try {
    const p = join(dir, 'converge-align-state.json')
    writeFileSync(p, JSON.stringify(stallState(4, 30 * MIN)), 'utf8')
    const calls = []
    const r = G.checkConvergeAlignStall({
      now: NOW,
      statePath: p,
      cfg: DFLT.cfg,
      notify: (name, detail) => calls.push({ name, detail }),
    })
    assert.equal(r.alert, true)
    assert.equal(calls.length, 1, '绝不直发真邮件:出口只有注入的假 notify')
    assert.equal(calls[0].name, 'converge-align-stall')
    assert.match(calls[0].detail, /连续失败 4 次/)
    assert.match(calls[0].detail, /rc=1 fatal: Unable to create index\.lock/)
    assert.match(calls[0].detail, /converge-align-state\.json/)
  } finally {
    rmScratch(dir)
  }
})

test('(c)坏 JSON ⇒ 不喊、不派发、不抛(状态文件不得成为新故障源)', () => {
  const dir = mkScratch('gg-align-alert-')
  try {
    const p = join(dir, 'converge-align-state.json')
    writeFileSync(p, '{ broken', 'utf8')
    const calls = []
    let r
    assert.doesNotThrow(() => {
      r = G.checkConvergeAlignStall({
        now: NOW,
        statePath: p,
        cfg: DFLT.cfg,
        notify: () => calls.push(1),
      })
    })
    assert.equal(r.alert, false)
    assert.equal(calls.length, 0)
    // 文件不存在同理
    const r2 = G.checkConvergeAlignStall({
      now: NOW,
      statePath: join(dir, 'nope.json'),
      cfg: DFLT.cfg,
      notify: () => calls.push(1),
    })
    assert.equal(r2.alert, false)
    assert.equal(calls.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('(e)装车证明:tick 真执行分支调用 checkConvergeAlignStall,名与状态文件同源', () => {
  const rel = 'scripts/git-guardian.mjs'
  let head = ''
  try {
    head = execFileSync('git', ['show', `HEAD:${rel}`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 32 << 20,
    })
  } catch {
    /* 问不到走工作树 */
  }
  let src = head
  if (!src.includes('checkConvergeAlignStall')) {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    src = readFileSync(join(repoRoot, rel), 'utf8')
    assert.ok(src.includes('checkConvergeAlignStall'), '守护侧连函数都不在 ⇒ 根本没接')
    console.warn('⚠️ 装车证明暂以工作树取证(HEAD 尚未包含本票改动,提交后自动升为 HEAD 面)')
  }
  // 主 tick(main 健康分支)必须挂在 !CHECK_ONLY 上 —— CHECK_ONLY 早退分支当挂点等于永不执行
  assert.match(src, /if \(!CHECK_ONLY\) checkConvergeAlignStall\(\)/)
  // daemon tick 分支也要有(双执行体并存,见 §5b)
  const daemonSeg = src.slice(src.indexOf('function startDaemon'))
  assert.match(daemonSeg, /checkConvergeAlignStall\(\)/)
  // 派发名逐字固定;状态文件路径与收敛器写入侧同源(.workbuddy/converge-align-state.json)
  assert.match(src, /notify\('converge-align-stall', detail\)/)
  assert.match(src, /'.workbuddy', 'converge-align-state\.json'/)
  // __test__ 暴露判据(§22c)
  const blk = src.slice(src.indexOf('export const __test__'))
  for (const k of ['shouldAlertAlignStall', 'checkConvergeAlignStall', 'alignStallThresholds']) {
    assert.ok(blk.slice(0, 600).includes(`${k},`), `__test__ 缺导出 ${k}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
