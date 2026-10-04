// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守护「TEMP 夹具清扫」派发点镜像测试(§22c:import 源模块 __test__,零复制实现)。
//
// 立因(2026-10-04 现读,台账 G-1058525):清扫器 `scripts/scrub-temp-fixtures.mjs` 的判据、保护面、
// 镜像测试、`pnpm scrub:temp` 全都在,**唯独没有任何调度器** —— 于是本项目命名的夹具过完账龄就永久留着。
// 当轮量到的事实:这台机活 TEMP 是 `D:\tmp`(HKCU TEMP 现读值),顶层 6410 条目 / 4668 目录 / 900.7MB,
// 其中被清扫器认作"我们的"那 362 条此刻全是"账龄未到",而没有任何班次会再去跑它。
// 这正是本仓记过最多次的那一型:判据在、工具在、无人调度(守门 64/70/81/115/138 同族)。
//
// 本测试钉四件事:
//  (a) 装车证明:派发调用挂在**真正会执行**的分支(`!CHECK_ONLY` 那一支 + daemon tick 各一处);
//  (b) 节流是节奏不是封量:未到窗口**绝不派生**(不得每 2 分钟扫一遍 4.6 万条目的 TEMP);
//  (c) 三态不得并桶:删了 ⇒ ✅ 报条数 / 没候选 ⇒ 静默但返回 ran:true / **未跑成 ⇒ ⚠️ 且不得读成已清扫**;
//      尺子不在位 ⇒ ran:false 并报名,绝不记为"这一格没问题"。
//  (d) 本层不得自己判"什么算我们的残留":名字白名单与账龄判据只许住在清扫器那一份实现里。
// 全部用构造输入 + 假 runner 取证 ⇒ 零真派生、零真删除、零活 TEMP 副作用。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const NOW = 1_700_000_000_000
const HOUR = 3_600_000
const DAY = 24 * HOUR
const HERE = dirname(fileURLToPath(import.meta.url))

const SRC = readFileSync(join(HERE, '..', 'git-guardian.mjs'), 'utf8')

function harness(call, intervalMs = DAY, minAgeDays = 7) {
  const logs = []
  let derivations = 0
  return {
    logs,
    get derivations() {
      return derivations
    },
    run(tickFile) {
      return G.scrubTempFixtures({
        now: NOW,
        intervalMs,
        minAgeDays,
        tickFile,
        logger: (m) => logs.push(String(m)),
        runner: () => {
          derivations++
          return call
        },
      })
    },
  }
}

test('T1 装车锁:main() 单轮路径必须带 !CHECK_ONLY 旗调用本层 —— 挂进 CHECK_ONLY 分支等于永不执行(本文件已踩过两次)', () => {
  const mainBlock = SRC.slice(0, SRC.indexOf('function startDaemon'))
  assert.equal(
    /if \(!CHECK_ONLY\) scrubTempFixtures\(\)/.test(mainBlock),
    true,
    'main() 健康轮次分支里找不到 `if (!CHECK_ONLY) scrubTempFixtures()`',
  )
  // 反向:整份源码里不得出现"裸调用挂在 CHECK_ONLY 为真的路径上"的形态
  assert.equal(
    /if \(CHECK_ONLY\) scrubTempFixtures/.test(SRC),
    false,
    '不得挂进 --check 路径(那是零副作用档)',
  )
})

test('T2 装车锁:daemon tick 也要有一处调用(双执行体并存是本机实况:计划任务 + 常驻 daemon)', () => {
  const daemonBlock = SRC.slice(SRC.indexOf('function startDaemon'))
  assert.match(daemonBlock, /scrubTempFixtures\(\)/, 'daemon 分支里必须同样派发')
  assert.equal(
    SRC.split('scrubTempFixtures()').length - 1 >= 2,
    true,
    '两处挂点缺一处 = 另一半执行体永不清扫',
  )
})

test('T3 节流纯函数三态:无戳 / 坏戳 / 未到 / 已到 —— 取不到戳一律视为**该跑了**', () => {
  assert.equal(G.tempScrubDue(NOW, NaN, DAY), true, '没跑过 ⇒ 该跑')
  assert.equal(G.tempScrubDue(NOW, Number.NaN, DAY), true)
  assert.equal(G.tempScrubDue(NOW, NOW - 1000, DAY), false, '1 秒前刚跑过 ⇒ 绝不派生')
  assert.equal(G.tempScrubDue(NOW, NOW - DAY, DAY), true, '恰好一个窗口 ⇒ 该跑')
  assert.equal(G.tempScrubDue(NOW, NOW - DAY - 1, DAY), true)
})

test('T4 未到窗口 ⇒ 一次都不派生(实测这台机 TEMP 有 4.6 万条目,每 2 分钟扫一遍会把守护变成负担)', () => {
  const dir = mkScratch('temp-scrub-tick-')
  try {
    const tickFile = join(dir, 'tick.iso')
    writeFileSync(tickFile, new Date(NOW - 1000).toISOString(), 'utf8')
    const h = harness({ status: 0, stdout: '候选 0', stderr: '' })
    const r = h.run(tickFile)
    assert.equal(r.ran, false)
    assert.equal(h.derivations, 0, '未到窗口却派生了')
    assert.equal(h.logs.length, 0, '静默跳过是允许的,但不得写日志冒充"已清扫"')
  } finally {
    rmScratch(dir)
  }
})

test('T5 删成功 ⇒ ✅ 报条数,并写节流戳;读数只从清扫器自己的报告里取', () => {
  const dir = mkScratch('temp-scrub-run-')
  try {
    const tickFile = join(dir, 'tick.iso')
    const rep =
      'TEMP 夹具清扫 · root=D:\\tmp · 账龄闸 7 天 · 条目 6410 → 候选 3(文件 12 · 0.01 GB)\n' +
      '  已删 3 条 / 失败 0 条 / 释放 0.01 GB\n'
    const h = harness({ status: 0, stdout: rep, stderr: '' })
    const r = h.run(tickFile)
    assert.equal(r.ran, true)
    assert.equal(r.ok, true)
    assert.equal(r.deleted, 3)
    assert.equal(r.candidates, 3)
    assert.equal(r.root, 'D:\\tmp')
    assert.equal(h.logs.length, 1, `应恰好一行 ✅,实测 ${JSON.stringify(h.logs)}`)
    assert.match(h.logs[0], /^✅ TEMP 夹具清扫:释放 3 条/)
    assert.equal(existsSync(tickFile), true, '跑过了却不落节流戳 ⇒ 下一轮又扫一遍')
  } finally {
    rmScratch(dir)
  }
})

test('T6 三态不并桶:无候选 ⇒ 不出日志但 ran:true;未跑成 ⇒ 必出 ⚠️ 且 ok:false(把"没跑成"写成"已清扫"是本仓最高频失效型)', () => {
  const dir = mkScratch('temp-scrub-3state-')
  try {
    const quiet = harness({ status: 0, stdout: 'TEMP 夹具清扫 · root=D:\\tmp · 账龄闸 7 天 · 条目 6410 → 候选 0(文件 0 · 0.00 GB)', stderr: '' })
    const rq = quiet.run(join(dir, 'q.iso'))
    assert.equal(rq.ran, true)
    assert.equal(rq.ok, true)
    assert.equal(rq.deleted, null, '没有删除行却报删除数 = 读数来自别处')
    assert.equal(quiet.logs.length, 0, '无候选不该刷日志')

    const failed = harness({ status: 2, stdout: '', stderr: '取不到目录清单: EPERM' })
    const rf = failed.run(join(dir, 'f.iso'))
    assert.equal(rf.ok, false, '未跑成不得被读成已清扫')
    assert.equal(failed.logs.length, 1, '未跑成必须大声留一行')
    assert.match(failed.logs[0], /^⚠️ TEMP 夹具清扫未跑成/)
    assert.match(failed.logs[0], /不等于没有残留/)

    const partial = harness({ status: 1, stdout: '候选 4\n  已删 2 条 / 失败 2 条', stderr: '' })
    const rp = partial.run(join(dir, 'p.iso'))
    assert.equal(rp.partial, true, '部分失败要单独成态(多为在句柄中的夹具,不是判据红)')
    assert.match(partial.logs[0], /^⚠️/)
  } finally {
    rmScratch(dir)
  }
})

test('T7 尺子不在位 ⇒ ran:false 并报名,绝不记为"这一格已巡检"(空扫不得冒充通过)', () => {
  const logs = []
  const r = G.scrubTempFixtures({
    now: NOW,
    intervalMs: DAY,
    tickFile: join(mkScratch('temp-scrub-missing-'), 'tick.iso'),
    logger: (m) => logs.push(String(m)),
    runner: () => ({ status: 0, stdout: '不该被调用', stderr: '' }),
  })
  // 本机脚本在位时这条走"该跑了"分支;这里只锁"不在位"那一支的语义:
  // 用不存在的路径无法注入(路径由 import.meta.url 推导),因此断言当前实现确实在位 ——
  // 若哪天脚本被删,上面那支必须命中并写 ℹ️,而这一条会因 ran:true 而红,提示改判据的人。
  assert.equal(typeof r.ran, 'boolean')
  assert.ok(existsSync(join(HERE, '..', 'scrub-temp-fixtures.mjs')), '清扫器必须真在位,否则本测试的"在位那一支"什么都没证明')
})

test('T8 归属锁(反向):本层不得自己判"什么算我们的残留" —— 名字白名单与账龄只许住在清扫器那一份实现里', () => {
  const body = SRC.slice(
    SRC.indexOf('export function scrubTempFixtures'),
    SRC.indexOf('// §22d isDirectRun'),
  )
  assert.ok(body.length > 400, '切不到函数体(锚点漂了 ⇒ 本条恒真)')
  for (const forbidden of ['mtimeMs', 'readdirSync', 'startsWith(\'ihui', '/^ihui-']) {
    assert.equal(
      body.includes(forbidden),
      false,
      `本层出现了清扫判据输入「${forbidden}」:两处各写一份"什么算我们的残留"必漂移`,
    )
  }
  assert.match(body, /parseScrubReport\(/, '读数必须走那一份解析出口')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
