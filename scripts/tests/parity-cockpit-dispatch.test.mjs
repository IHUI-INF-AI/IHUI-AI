// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端驾驶舱派发腿(`sweepParityCockpit`)的镜像测试。
 *
 * 立因:`scripts/parity-auto.mjs` 头注自述是「web→RN→小程序全自动管线的唯一入口」,而全仓对它
 * **零调用点**(`git log -S"parity-auto"` 只命中造它自己那一枚提交)。当天就出过一次事故:有人
 * 据它 fast 档的「阶段 11 全绿」宣布三端已对齐并收口,而同一时刻漂移哨兵报 regressed rc=1。
 * 判据齐全却无人调度 + 部分覆盖与全量同形 = 失效形态是安静(§0.9「造好没装车」= 没有)。
 *
 * 钉死八件事:
 *   T1 全绿 ⇒ 只写一行读数,零寄信;
 *   T2 有阶段红 ⇒ 不寄信(汇总面不重复到人),但日志点名是哪几道;
 *   T3 有阶段未判定 ⇒ 本轮不得记绿(§0.3),仍不寄信;
 *   T4 结论取不到 ⇒ 走「在册腿」的未判定台账(不在册会被当场 mailed:false 吞掉 = 瞎了无人喊);
 *   T5 节流窗口内 ⇒ 不派生第二次;
 *   T6 装车锁:挂点在 !CHECK_ONLY 分支 + 函数在 __test__ 出口 + 节流可由 env 覆盖;
 *   T7 只读契约:派发 argv 里一个 --apply* 都不许出现(守护自动写盘是另一量级的事);
 *   T8 覆盖不全必须出声(否则「部分覆盖的绿」从派发面再犯一次同样的事故)。
 *
 * 夹具契约(§22c):阶段总数按 `STAGES.length` 现读、跳过的档按 `selectStages` 自己算,
 * 不在测试里手抄数字或复刻判据。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { noteCrossEndUndetermined, sweepParityCockpit } from '../git-guardian.mjs'
import { STAGES, selectStages } from '../parity-auto.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const fixture = () => {
  const dir = mkScratch('parity-cockpit-')
  return { tickFile: join(dir, 'tick.json') }
}

/**
 * 驾驶舱机读档的构造器(形状取自 parity-auto 自己的 STAGES/selectStages,不手抄条数)。
 * 刻意**不带**顶层 state —— 生产机读档就只有 at/writeTier/coverage/counts/results,
 * 夹具多给一个 state 键,派发到台账里那格状态就永远测不到(2026-10-29 实测抄出过恒 null)。
 */
const verdict = (over = {}) => {
  const fast = selectStagesSafe({ fast: true, stage: 'all' })
  const ran = over.ran ?? STAGES.length
  const skipped = over.skipped ?? []
  return {
    at: '2026-10-29T00:00:00.000Z',
    writeTier: { apply: false, decl: false, gen: false },
    coverage: {
      ran,
      total: STAGES.length,
      partial: skipped.length > 0,
      skipped,
      _fastPool: fast.stages.length,
    },
    counts: over.counts ?? { ok: STAGES.length },
    results: over.results ?? STAGES.map((s) => ({ id: s.id, group: s.group, status: 'ok' })),
  }
}

function selectStagesSafe(opts) {
  assert.equal(
    typeof selectStages,
    'function',
    'parity-auto 必须导出 selectStages(§22c:夹具不复制判据)',
  )
  return selectStages(opts)
}

const calls = []
function runnerWith(json, box = { ok: true, status: 0 }) {
  return () => {
    calls.push(1)
    return {
      ok: box.ok,
      status: box.status,
      out: typeof json === 'string' ? json : JSON.stringify(json),
      err: box.err ?? '',
    }
  }
}

function resetCalls() {
  calls.length = 0
}

test('T1 全量档全绿 ⇒ 一行读数,零寄信', () => {
  resetCalls()
  const logs = []
  const mails = []
  const r = sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fixture().tickFile,
    logger: (m) => logs.push(String(m)),
    notify: (t, d) => mails.push({ t, d }),
    runner: runnerWith(verdict()),
  })
  assert.equal(r.state, 'ok')
  assert.equal(mails.length, 0, '全绿不该寄任何信')
  assert.match(logs.join('\n'), /阶段全绿/)
  assert.equal(calls.length, 1)
})

test('T2 有阶段红 ⇒ 汇总面不重复寄信,但日志点名是哪几道', () => {
  resetCalls()
  const logs = []
  const mails = []
  const results = STAGES.map((s, i) => ({
    id: s.id,
    group: s.group,
    status: i === 0 ? 'red' : 'ok',
  }))
  const r = sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fixture().tickFile,
    logger: (m) => logs.push(String(m)),
    notify: (t, d) => mails.push({ t, d }),
    runner: runnerWith(
      verdict({
        counts: { ok: STAGES.length - 1, red: 1 },
        results,
        state: 'regressed',
      }),
    ),
  })
  assert.equal(r.state, 'regressed')
  assert.equal(r.reds, 1)
  assert.equal(
    mails.length,
    0,
    '每一维的红在各自巡检腿里已按稳定身份到人,汇总面再寄=同因双份(§5e-1)',
  )
  assert.match(logs.join('\n'), new RegExp(`红 1 道.*${STAGES[0].id}`))
})

test('T3 有阶段未判定 ⇒ 本轮不得记绿(§0.3)', () => {
  resetCalls()
  const logs = []
  const mails = []
  const results = STAGES.map((s, i) => ({
    id: s.id,
    group: s.group,
    status: i === 0 ? 'undetermined' : 'ok',
  }))
  const r = sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fixture().tickFile,
    logger: (m) => logs.push(String(m)),
    notify: (t, d) => mails.push({ t, d }),
    runner: runnerWith(
      verdict({
        counts: { ok: STAGES.length - 1, undetermined: 1 },
        results,
        state: 'undetermined',
      }),
    ),
  })
  assert.equal(r.state, 'undetermined')
  assert.equal(r.ok, false, '有阶段没判 ⇒ 不得记绿')
  assert.match(logs.join('\n'), /不得记绿/)
  assert.equal(mails.length, 0, '单个阶段未判定多半是并发争用,不到存续门槛不喊人')
})

test('T4 结论取不到 ⇒ 写进「在册腿」的未判定起点台账(未知腿分支当场吞掉,连起点都不写)', () => {
  resetCalls()
  const logs = []
  const mails = []
  const fx = fixture()
  const undetFile = join(fx.tickFile, '..', 'undet.json')
  const r = sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fx.tickFile,
    undetFile,
    logger: (m) => logs.push(String(m)),
    notify: (t, d) => mails.push({ t, d }),
    runner: () => {
      calls.push(1)
      return { ok: false, status: null, out: '', err: 'orchestrator blew up' }
    },
  })
  assert.equal(r.state, 'unparsed')
  assert.match(logs.join('\n'), /本轮没判/)
  assert.equal(mails.length, 0, '单轮取不到多半是并发争用,连满存续门槛才到人(§5e-1 去重节奏)')
  // 这条才是本票要的凭据:腿名不在 CROSS_END_LEGS 里时,noteCrossEndUndetermined 走「未知腿」
  // 分支**连起点件都不写** ⇒ 这条腿瞎了永远没人知道。起点件存在 = 它走在册分支。
  assert.ok(existsSync(undetFile), '未判定起点件必须落下(不在册的腿不会写这里)')
  // 反向对照:同一个 helper,未登记的腿名走「未知腿」分支 ⇒ 连起点件都不写。
  // 两臂同批跑,才能证明上面那条断言量的是"在册"这件事,而不是随便什么写盘。
  const shadow = join(fx.tickFile, '..', 'undet-shadow.json')
  const g = noteCrossEndUndetermined('parity-cockpit-not-a-leg', 'shadow probe', {
    logger: () => {},
    notify: () => {},
    file: shadow,
  })
  assert.equal(g.mailed, false, '未知腿必须当场返回 mailed:false')
  assert.ok(!existsSync(shadow), '未知腿那一臂不该写起点件(否则"在册"这条断言没有阳性对照)')
})

test('T5 节流窗口内 ⇒ 不派生第二次', () => {
  resetCalls()
  const tickFile = fixture().tickFile
  const base = {
    tickFile,
    logger: () => {},
    notify: () => {},
    runner: runnerWith(verdict()),
    intervalMs: 60 * 60 * 1000,
  }
  const first = sweepParityCockpit({ ...base, now: Date.parse('2026-10-29T00:00:00Z') })
  const second = sweepParityCockpit({ ...base, now: Date.parse('2026-10-29T00:30:00Z') })
  assert.equal(first.ran, true)
  assert.equal(second.ran, false)
  assert.equal(second.why, '未到节流窗口')
  assert.equal(calls.length, 1, '窗口内不许再起子进程')
})

test('T6 装车锁:挂点在 !CHECK_ONLY 分支、函数在 __test__ 出口、节流可由 env 覆盖', () => {
  assert.match(
    SRC,
    /if \(!CHECK_ONLY\) sweepParityCockpit\(\)/,
    '必须挂在健康轮次的 !CHECK_ONLY 分支',
  )
  assert.match(SRC, /export function sweepParityCockpit\(/, '函数必须存在')
  const t = SRC.slice(SRC.indexOf('export const __test__ = {'))
  assert.match(t, /\bsweepParityCockpit,/, '镜像测试要能 import 到(§22c)')
  assert.match(SRC, /IHUI_PARITY_COCKPIT_INTERVAL_MS/, '节流须留运维旋钮(不让人改代码调窗口)')
  assert.match(SRC, /'parity-cockpit',\n\]\]|'parity-cockpit',/, '腿名必须登记进 CROSS_END_LEGS')
})

test('T7 只读契约:派发 argv 里一个 --apply* 都不许出现', () => {
  resetCalls()
  const seen = []
  sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fixture().tickFile,
    logger: () => {},
    notify: () => {},
    runner: runnerWith(verdict()),
  })
  const site = SRC.slice(
    SRC.indexOf('export function sweepParityCockpit'),
    SRC.indexOf('const CROSS_END_WEB_RN_INTERVAL_MS'),
  )
  const argv = site.match(/execFileSync\(process\.execPath,\s*\[script,([^\]]*)\]/)
  assert.ok(argv, '派生 argv 必须能定位到(形制变了要同步本锁)')
  seen.push(argv[1])
  assert.doesNotMatch(seen.join(''), /--apply/, '守护侧自动写盘是另一量级的事,本腿只跑只读档')
  assert.match(seen.join(''), /--json/, '派发面必须拿机读档,不靠人读表')
})

test('T9 台账里的 state 是三态定档的结果,不是抄机读档里不存在的键(恒 null 假字段实测发生过)', () => {
  resetCalls()
  const fx = fixture()
  const results = STAGES.map((s, i) => ({
    id: s.id,
    group: s.group,
    status: i === 0 ? 'red' : 'ok',
  }))
  sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fx.tickFile,
    logger: () => {},
    notify: () => {},
    runner: runnerWith(
      verdict({ counts: { ok: STAGES.length - 1, red: 1 }, results }),
    ),
  })
  const j = JSON.parse(readFileSync(fx.tickFile, 'utf8'))
  assert.equal(j.state, 'regressed', '红 1 道 ⇒ 台账 state 必须是 regressed,不许是 null')
  assert.deepEqual(j.red, [STAGES[0].id])
  assert.deepEqual(j.undetermined, [])
  assert.equal(j.coverage.partial, false)
  // 反向对照:同一格在"有阶段未判定"时应定档 undetermined(优先级也钉住,别让红盖掉未判定)
  const fx2 = fixture()
  sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fx2.tickFile,
    logger: () => {},
    notify: () => {},
    runner: runnerWith(
      verdict({
        counts: { ok: STAGES.length - 2, red: 1, undetermined: 1 },
        results: STAGES.map((s, i) => ({
          id: s.id,
          group: s.group,
          status: i === 0 ? 'red' : i === 1 ? 'undetermined' : 'ok',
        })),
      }),
    ),
  })
  const k = JSON.parse(readFileSync(fx2.tickFile, 'utf8'))
  assert.equal(k.state, 'undetermined', '§0.3:有阶段没判 ⇒ 不得让"有红"把它读成已判定')
})

test('T8 覆盖不全必须从派发面点名(防「部分覆盖的绿」再被读成合格证)', () => {
  resetCalls()
  const logs = []
  const skipped = selectStagesSafe({ fast: true, stage: 'all' }).skipped.map((s) => ({
    id: s.stage.id,
    why: s.why,
  }))
  assert.ok(skipped.length > 0, '前提:fast 档确实会跳阶段(否则本条测不到东西)')
  sweepParityCockpit({
    now: Date.parse('2026-10-29T00:00:00Z'),
    tickFile: fixture().tickFile,
    logger: (m) => logs.push(String(m)),
    notify: () => {},
    runner: runnerWith(
      verdict({
        ran: STAGES.length - skipped.length,
        skipped,
        counts: { ok: STAGES.length - skipped.length },
        results: STAGES.filter((s) => !s.slow).map((s) => ({
          id: s.id,
          group: s.group,
          status: 'ok',
        })),
      }),
    ),
  })
  const j = logs.join('\n')
  assert.match(j, /只覆盖/, 'partial 必须点名')
  assert.match(j, /不构成三端对齐合格证/)
  assert.ok(
    skipped.every((s) => j.includes(s.id)),
    '跳过的每一道都要被点名,不能只报个数',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
