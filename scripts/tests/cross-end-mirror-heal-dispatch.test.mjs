// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端镜像声明链自愈调度器(`healCrossEndMirror`)的镜像测试。
 *
 * 立因:`scripts/repair-cross-end-mirror.mjs` 治的是「登记表说已镜像、代码侧标记/路由被合并削掉」
 * (2026-10-25 实测:一笔并发提交顺手带走 5 处标记行 + 1 条 app.config 路由),而它**没有任何
 * 调度器** —— 与漂移尺同一型「造好没装车」,失效形态是安静:门 128 R1 红了没人接回去。
 *
 * 测试钉死六件事:
 *   T1 一致 ⇒ 绿行且报登记条目数(不写"无需处理"这种无据结论);
 *   T2 补回 N 条 ⇒ 绿行点名条数;
 *   T3 有拒落 ⇒ ⚠️ 点名(他席在飞属常态,**不到人**);
 *   T4 结论不可用 ⇒ 未判定,不记绿;
 *   T5 节流窗口内不派生第二次;
 *   T6 装车锁:挂在 !CHECK_ONLY 分支、在 __test__ 出口里、节流可由 env 覆盖。
 *   C1 契约锁:消费方读的 summary 键,必须真存在于生产方 --json 现读出口(不手抄形状)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { healCrossEndMirror } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const REPAIR = resolve(import.meta.dirname, '..', 'repair-cross-end-mirror.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const fixture = () => {
  const dir = mkScratch('cross-end-mirror-')
  return { tickFile: join(dir, 'tick.json') }
}

const runnerOf = (obj, status = 0) => () => ({ status, stdout: JSON.stringify(obj), stderr: '' })
const verdict = (summary) => ({ summary, findings: [], applied: [], refused: [] })

test('T1 一致 ⇒ 绿行并报登记条目数', () => {
  const logs = []
  const r = healCrossEndMirror({
    ...fixture(),
    logger: (m) => logs.push(m),
    runner: runnerOf(verdict({ face: 'head', registryEntries: 112, findings: 0, applied: 0, refused: 0 })),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'clean')
  const line = logs.find((l) => /跨端镜像自愈/.test(l))
  assert.ok(line, '一致档也要留一行读数(否则"没跑"和"跑了且一致"长得一样)')
  assert.match(line, /112/, '要点名登记条目现读')
})

test('T2 补回 N 条 ⇒ 绿行点名条数', () => {
  const logs = []
  const r = healCrossEndMirror({
    ...fixture(),
    logger: (m) => logs.push(m),
    runner: runnerOf(verdict({ findings: 2, applied: 2, refused: 0, registryEntries: 112 })),
  })
  assert.equal(r.ok, true)
  assert.equal(r.applied, 2)
  assert.ok(logs.some((l) => /补回 2 条/.test(l)))
})

test('T3 有拒落 ⇒ ⚠️ 点名,但不到人(拒落属常态)', () => {
  const logs = []
  const mails = []
  const r = healCrossEndMirror({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(
      {
        summary: { findings: 1, applied: 0, refused: 1 },
        findings: [],
        applied: [],
        refused: [{ kind: 'marker', shared: 'packages/app/src/features/x/XScreen.tsx', why: '工作树副本有行不在 HEAD(他席在飞),不替人提交' }],
      },
      1,
    ),
  })
  assert.equal(r.ok, false)
  assert.equal(r.state, 'partial')
  assert.equal(r.refused, 1)
  assert.equal(mails.length, 0, '拒落不得到人:收信人无事可做')
  const line = logs.find((l) => /拒落 1 条/.test(l))
  assert.ok(line, '拒落必须留可诊断行')
  assert.match(line, /他席在飞/, '要点名拒落原因')
})

test('T4 结论不可用 ⇒ 未判定,不记绿', () => {
  const logs = []
  const r = healCrossEndMirror({
    ...fixture(),
    logger: (m) => logs.push(m),
    runner: () => ({ status: 0, stdout: 'garbage', stderr: '' }),
  })
  assert.equal(r.state, 'unparsed')
  assert.equal(r.ok, false)
  assert.ok(logs.some((l) => /未判定/.test(l)))
  assert.ok(!logs.some((l) => /✅/.test(l)))
})

test('T5 节流窗口内不派生第二次', () => {
  let calls = 0
  const opts = { ...fixture(), logger: () => {} }
  const first = healCrossEndMirror({
    ...opts,
    runner: () => (calls++, runnerOf(verdict({ findings: 0, applied: 0, refused: 0 }))()),
  })
  assert.equal(first.ran, true)
  const second = healCrossEndMirror({
    ...opts,
    runner: () => (calls++, runnerOf(verdict({ findings: 0, applied: 0, refused: 0 }))()),
  })
  assert.equal(second.ran, false)
  assert.equal(calls, 1)
})

test('C1 契约锁:消费方读的 summary 键必须真存在于生产方 --json 出口', () => {
  const out = execFileSync(process.execPath, [REPAIR, '--json'], {
    cwd: resolve(import.meta.dirname, '..', '..'),
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1))
  assert.ok(j.summary && typeof j.summary === 'object', '生产方必须给 summary')
  for (const k of ['findings', 'applied', 'refused', 'registryEntries']) {
    assert.ok(k in j.summary, `消费方读 summary.${k},生产方出口没有这个键(实测:${Object.keys(j.summary).join(',')})`)
  }
})

test('T6 装车锁:挂点在 !CHECK_ONLY 分支、函数在 __test__ 出口、节流可 env 覆盖', () => {
  assert.match(SRC, /if \(!CHECK_ONLY\) healCrossEndMirror\(\)/, '必须挂在健康轮次的 !CHECK_ONLY 分支')
  assert.match(SRC, /export function healCrossEndMirror\(/, '函数必须存在')
  const t = SRC.slice(SRC.indexOf('export const __test__ = {'))
  assert.match(t, /\bhealCrossEndMirror,/, '镜像测试要能 import 到(§22c)')
  assert.match(
    SRC,
    /CROSS_END_MIRROR_INTERVAL_MS[\s\S]{0,80}IHUI_CROSS_END_MIRROR_INTERVAL_MS/,
    '默认节流必须可由 env 覆盖(自测/演练用)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
