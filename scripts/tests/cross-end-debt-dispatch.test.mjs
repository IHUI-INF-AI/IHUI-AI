// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端样式欠债台账调度器(`auditCrossEndDebtLedger`)的镜像测试(§22c)。
 *
 * 立因:只读尺 `scripts/cross-end-ui-parity-debt.mjs` 判据齐全(两条轴 + 在册快照对比),
 * 而全仓**零调度点** = §0.9「造好没装车 = 没有」。失效形态是安静:不是报错,是根本不跑。
 *
 * 测试钉死九件事(机主派单清单 ①–⑤ 全在内):
 *   T1  rc=0 ⇒ 一行现读读数,不喊人;T1b 尺子自述 schema=2(压根没第二条轴)⇒ 判"仅轴一",不读成瞎;
 *   T2  rc=1 ⇒ 逐族点名写日志,**默认不发到人**(§5e-1 取舍);T2b 显式开档才到人且身份稳定;
 *   T3  rc=2 ⇒ 落未判定起点件、点名哪一轴没输入,不记绿也不喊人;
 *   T4  尺子不在位 ⇒ 跳过,且节流戳一个字节都不写(不记为已探测);
 *   T5  未到节流窗口 ⇒ 零派生;
 *   T6  节流戳在派生**之前**已落盘(配额先写后跑);
 *   T7  末行不是 JSON / rc=1 却点不出名 / rc 不在 {0,1,2} / 自称有轴二却缺段 ⇒ 一律未判定,不记绿;
 *   T8  键集对账锁:调度器消费的每个键 + schema 门槛,尺子本体必须仍在产出(改名当场红);
 *   T9  装车锁:两处挂点 + export + `__test__` 台账 + env 可覆盖 + 新腿确在 CROSS_END_LEGS。
 *
 * 夹具契约(§22c:**测试里不复制判据**):
 *   rc 一律由尺子自己的 `checkVerdict()` 现造,族涨清单由 `diffAgainst()` + `buildRows()` 现算,
 *   读数由 `rowsOf()` 求和 —— 本文件不出现任何手算的欠债数,也不手写退出码。
 *   起点件与节流戳一律落 `mkScratch()`(不得碰真 `.ihui-agent/state`)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { auditCrossEndDebtLedger, noteCrossEndUndetermined } from '../git-guardian.mjs'
import { __test__ as P } from '../cross-end-ui-parity-debt.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const RULER = resolve(import.meta.dirname, '..', 'cross-end-ui-parity-debt.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')
const RSRC = readFileSync(RULER, 'utf8')

// 落地顺序闸(机主必读):本文件的退出码/涨跌清单**只在尺子自己的 checkVerdict() 现造**(§22c
// 禁止在测试里复算判据)。接线现读:HEAD 面那把尺的 `__test__` 还没有 `checkVerdict`(它是别席
// schema 3 那版才加的出口)⇒ 本票必须排在尺子那枚提交**之后**落地(或同枚带上)。
// 失败方向 = 本文件在夹具构造处当场红并点名原因,不是静默绿。
assert.equal(
  typeof P.checkVerdict,
  'function',
  'cross-end-ui-parity-debt.mjs 未导出 checkVerdict ⇒ 夹具无法现造退出码;先落尺子那枚提交,再落本票(不在测试里手抄 0/1/2)',
)

const fixture = () => {
  const dir = mkScratch('cross-end-debt-')
  return { tickFile: join(dir, 'tick.json'), undetFile: join(dir, 'undet.json') }
}

/** 门 128 --json 输出的最小夹具:一族配对,debt 由 diffCount 决定(判据在尺子那边)。 */
const gateJson = (debt) => ({
  pairCount: 19,
  findings: [
    {
      name: 'Widget',
      diffCount: debt,
      radiusCount: 0,
      elementRadiusCount: 0,
      lang: { miniapp: 'className', rn: 'className' },
    },
  ],
})
const BASELINE = {
  recordedAt: '2026-10-22T22:24:12.203Z',
  families: [{ name: 'Widget', debt: 1 }],
}
const rowsOf = (debt) => P.buildRows(gateJson(debt), {}, '2026-01-01')
const diffOf = (debt) => P.diffAgainst(rowsOf(debt), BASELINE)
const totalOf = (debt) => rowsOf(debt).reduce((s, r) => s + r.debt, 0)

/** 退出码由尺子自己的 checkVerdict() 现造,本文件不写死 0/1/2。 */
const rcOf = (opts) => P.checkVerdict(opts).code
const rcFlat = (debt) =>
  rcOf({
    miniappUp: diffOf(debt).up,
    webRnState: 'judged',
    webRnUp: [],
    webRnLedger: 'present',
  })

/**
 * `--json` 档载荷:只填调度器**实际消费**的那几个键(其余一律不给 ⇒ 少给一个键时必须落未判定,
 * 而不是被 `?? 0` 圆成"持平")。键的存在性由 T8 对账尺子本体钉住。
 * `schema: 3` = 尺子自述"两条轴都在册"(现读工作树那版);T1b 给一份 schema 2 的载荷,
 * 代表 HEAD 面那把尺(只有轴一)——调度器必须把它读成"仅轴一",而不是"这一格瞎了"。
 */
const payloadOf = (debt, over = {}) => ({
  schema: 3,
  pairCount: gateJson(debt).pairCount,
  total: totalOf(debt),
  openTotal: totalOf(debt),
  waivedTotal: 0,
  families: rowsOf(debt),
  againstBaseline: diffOf(debt),
  againstBaselineWebRn: { up: [], down: [], same: [], baseline: BASELINE.recordedAt },
  webRnState: 'judged',
  webRnWhy: null,
  webRn: { total: 0 },
  ...over,
})

/** HEAD 面那把尺的载荷形态:schema 2,压根没有第二条轴(键集按 `git show HEAD` 的产出列)。 */
const payloadSchema2Of = (debt) => ({
  schema: 2,
  pairCount: gateJson(debt).pairCount,
  total: totalOf(debt),
  openTotal: totalOf(debt),
  waivedTotal: 0,
  families: rowsOf(debt),
  againstBaseline: diffOf(debt),
})

/** 尺子的 stdout 形态:结论 JSON 之前可能先打一行业务提示(门 rc 的口径说明),解析必须扛得住。 */
const runnerOf = (payload, status) => () => ({
  status,
  stdout: `  ⓘ 门 rc=1 = 它量到了分叉,不是"跑不动"\n${JSON.stringify(payload, null, 2)}\n`,
  stderr: '',
})

test('T1 rc=0 ⇒ 一行现读读数,不喊人', () => {
  const logs = []
  const mails = []
  const rc = rcFlat(1)
  assert.equal(rc, 0, `夹具应造出 rc=0(实测 ${rc};up=${JSON.stringify(diffOf(1).up)})`)
  const r = auditCrossEndDebtLedger({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(payloadOf(1), rc),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'ok')
  assert.equal(mails.length, 0, 'ok 档不许到人')
  const line = logs.find((l) => /跨端样式欠债台账/.test(l))
  assert.ok(line, 'ok 档也要留一行读数(否则"没跑"和"跑了且没事"长得一样)')
  assert.match(line, new RegExp(String(totalOf(1))), '读数必须现算,不许写死')
  assert.match(line, /19/, '同名配对数也要现读')
  assert.ok(!logs.some((l) => /❌|⚠️/.test(l)), 'ok 档不该出现红或警告')
})

test('T1b 尺子自述 schema=2(压根没第二条轴)⇒ 判"仅轴一",不得读成瞎', () => {
  const logs = []
  const mails = []
  const f = fixture()
  const rc = rcFlat(1)
  assert.equal(rc, 0)
  const r = auditCrossEndDebtLedger({
    ...f,
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(payloadSchema2Of(1), rc),
  })
  assert.equal(r.state, 'ok', '没造第二条轴 ≠ 这一格没判(把前者读成后者 = 恒响的未判定)')
  assert.equal(r.axis2InLedger, false)
  assert.equal(mails.length, 0)
  assert.ok(logs.some((l) => /仅轴一/.test(l)), '读数行必须自报这一轮只覆盖了哪几条轴')
  assert.ok(!logs.some((l) => /未判定/.test(l)))
  assert.equal(existsSync(f.undetFile), false, '确定结论不许留未判定起点件')
})

test('T2 rc=1(有族涨)⇒ 逐族点名写日志,默认**不发到人**', () => {
  const logs = []
  const mails = []
  const rc = rcFlat(3)
  assert.equal(rc, 1, `夹具应造出 rc=1(实测 ${rc})`)
  const r = auditCrossEndDebtLedger({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(payloadOf(3), rc),
  })
  assert.equal(r.state, 'debt-up')
  assert.equal(r.ok, false)
  assert.equal(r.up, diffOf(3).up.length, '条数必须是尺子算出来的那一条')
  assert.equal(mails.length, 0, '§5e-1:这把尺的 1 是长期存量态,默认不到人')
  const line = logs.find((l) => /❌ 跨端样式欠债台账/.test(l))
  assert.ok(line, '族涨必须点名')
  assert.match(line, /Widget/)
  assert.match(line, /1 → 3/, '必须带 from→to(现算,不是本文件写死的数)')
  assert.ok(logs.some((l) => /不到人/.test(l)), '取舍要写在日志里,否则读日志的人以为报警漏了')
})

test('T2b 显式 IHUI_CROSS_END_DEBT_MAIL=1 ⇒ 到人,身份稳定且带可执行下一步', () => {
  const mails = []
  process.env.IHUI_CROSS_END_DEBT_MAIL = '1'
  let r
  try {
    r = auditCrossEndDebtLedger({
      ...fixture(),
      logger: () => {},
      notify: (...a) => mails.push(a),
      runner: runnerOf(payloadOf(3), rcFlat(3)),
    })
  } finally {
    delete process.env.IHUI_CROSS_END_DEBT_MAIL
  }
  assert.equal(r.state, 'debt-up')
  assert.equal(mails.length, 1, '开了档就要真寄')
  assert.match(String(mails[0][2]?.dedupKey ?? ''), /^cross-end-debt;debt-up$/, '身份按稳定语义,不把族明细塞进去')
  assert.match(
    mails[0][1],
    /node scripts\/cross-end-ui-parity-debt\.mjs/,
    '§5e-1:到人正文必须自带可执行的下一步',
  )
})

test('T3 rc=2 ⇒ 落未判定起点件、点名哪一轴没输入,不记绿也不喊人', () => {
  const logs = []
  const mails = []
  const f = fixture()
  const why = '门没吐 webRn 段'
  const rc = rcOf({ miniappUp: [], webRnState: 'absent', webRnWhy: why })
  assert.equal(rc, 2, `夹具应造出 rc=2(实测 ${rc})`)
  const r = auditCrossEndDebtLedger({
    ...f,
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(payloadOf(1, { webRnState: 'absent', webRnWhy: why }), rc),
  })
  assert.equal(r.state, 'undetermined')
  assert.equal(r.ok, false, '未判定不许记绿')
  assert.equal(mails.length, 0, '单轮取不到输入 ⇒ 只报名不寄信')
  assert.ok(logs.some((l) => /未判定/.test(l)))
  assert.ok(!logs.some((l) => /✅/.test(l)), '未判定不许出现绿勾')
  assert.ok(logs.some((l) => l.includes('轴二 absent') && l.includes(why)), '未点名到轴的未判定等于没报')
  assert.ok(existsSync(f.undetFile), '未判定必须落起点件(否则"这一格瞎了"无人量得到)')
})

test('T4 尺子不在位 ⇒ 跳过,且节流戳一个字节都不写(不记为已探测)', () => {
  const f = fixture()
  const logs = []
  let calls = 0
  const r = auditCrossEndDebtLedger({
    ...f,
    script: join(mkScratch('no-ruler-'), 'cross-end-ui-parity-debt.mjs'),
    logger: (m) => logs.push(m),
    notify: () => {
      throw new Error('尺子不在位不许喊人')
    },
    runner: () => {
      calls++
      return { status: 0, stdout: '{}', stderr: '' }
    },
  })
  assert.equal(r.ran, false)
  assert.equal(r.why, '尺子不在位')
  assert.equal(calls, 0, '尺子不在位还派生 = 拿 ENOENT 当结论')
  assert.equal(existsSync(f.tickFile), false, '把"没跑"写成"跑过了"⇒ 下一轮永不派发(§0.3)')
  assert.ok(logs.some((l) => /不记为已探测/.test(l)))
})

test('T5 未到节流窗口 ⇒ 零派生', () => {
  const opts = { ...fixture(), logger: () => {}, notify: () => {} }
  let calls = 0
  const first = auditCrossEndDebtLedger({
    ...opts,
    runner: () => (calls++, runnerOf(payloadOf(1), 0)()),
  })
  assert.equal(first.ran, true)
  const second = auditCrossEndDebtLedger({
    ...opts,
    runner: () => (calls++, runnerOf(payloadOf(3), 1)()),
  })
  assert.equal(second.ran, false)
  assert.equal(second.why, '未到节流窗口')
  assert.equal(calls, 1, '窗口内不许再起子进程(内部要跑门 128 全量对账)')
})

test('T6 节流戳在派生**之前**已落盘(配额先写后跑)', () => {
  const f = fixture()
  const now = 1_700_000_000_000
  let seen = '未调用'
  const r = auditCrossEndDebtLedger({
    ...f,
    now,
    logger: () => {},
    notify: () => {},
    runner: () => {
      // 派生那一刻回读节流戳:状态写在阻塞调用**之后** ⇒ 这里必然是"未调用",
      // 于是"子进程被超时掐死"与"本轮判过"在盘面上是同一枚无声(2026-10-27 立的同一课)。
      try {
        seen = JSON.parse(readFileSync(f.tickFile, 'utf8'))
      } catch {
        seen = null
      }
      return runnerOf(payloadOf(1), 0)()
    },
  })
  assert.equal(r.ran, true)
  assert.ok(seen && seen !== '未调用', '派生时节流戳必须已经在盘上')
  assert.equal(seen.attemptAt, new Date(now).toISOString(), '裸 attemptAt 形态与 drift 腿逐字同型')
  assert.equal(seen.finishedAt, undefined, '先写的那一枚只有 attemptAt;finishedAt 由派发回写补上')
  const after = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.equal(after.rc, 0, '派生返回后必须把 rc 回写进同一枚戳 ⇒ 掐死与判过从此可分')
})

test('T7 结论不可用 / rc 越界 / rc=1 却点不出名 ⇒ 一律未判定,不记绿', () => {
  const cases = [
    {
      name: '末行不是 JSON',
      run: { status: null, stdout: 'Command failed … 不是 JSON', stderr: 'boom' },
      state: 'unparsed',
    },
    {
      name: 'rc 不在三态语义内',
      run: { status: 124, stdout: JSON.stringify(payloadOf(1)), stderr: 'timeout-ish' },
      state: 'undetermined',
    },
    {
      name: 'rc=1 但两轴 up 皆空(枚举到 0 不算判过)',
      run: {
        status: 1,
        stdout: JSON.stringify(
          payloadOf(1, {
            againstBaseline: { up: [], down: [], same: [], baseline: BASELINE.recordedAt },
            againstBaselineWebRn: { up: [], baseline: BASELINE.recordedAt },
          }),
        ),
        stderr: '',
      },
      state: 'unparsed',
    },
    {
      name: '尺子自述轴二在册(schema 3)却缺 againstBaselineWebRn 段(口径漂移)',
      run: (() => {
        const p = payloadOf(1)
        delete p.againstBaselineWebRn
        return { status: 0, stdout: JSON.stringify(p), stderr: '' }
      })(),
      state: 'unparsed',
    },
  ]
  for (const c of cases) {
    const logs = []
    const mails = []
    const f = fixture()
    const r = auditCrossEndDebtLedger({
      ...f,
      logger: (m) => logs.push(m),
      notify: (...a) => mails.push(a),
      runner: () => c.run,
    })
    assert.equal(r.state, c.state, `${c.name}:期望 ${c.state},实测 ${JSON.stringify(r)}`)
    assert.equal(r.ok, false, `${c.name}:未判定不许记绿`)
    assert.equal(mails.length, 0, `${c.name}:单轮未判定只报名不寄信`)
    assert.ok(logs.some((l) => /未判定/.test(l)), `${c.name}:「没判」必须点名`)
    assert.ok(existsSync(f.undetFile), `${c.name}:必须落未判定起点件`)
  }
})

test('T8 键集对账锁:调度器消费的每个键,尺子本体必须仍在产出', () => {
  const consumed = [
    'againstBaseline',
    'againstBaselineWebRn',
    'webRnState',
    'webRnWhy',
    'openTotal',
    'total',
    'pairCount',
    'families',
  ]
  for (const k of consumed) {
    assert.ok(
      new RegExp(`${k}\\s*[:,]`).test(RSRC),
      `cross-end-ui-parity-debt.mjs 不再产出 ${k} ⇒ 调度器会静默读成 undefined 并当"持平",必须同步改`,
    )
  }
  // "第二条轴在不在册"这个判断挂在尺子自述的 schema 上 ⇒ schema 变更必须让人看一眼门槛取值。
  assert.match(
    RSRC,
    /schema:\s*3/,
    '尺子的 schema 不再是 3 ⇒ 同步复核调度器里 axis2InLedger 的门槛取值,不许顺手改数字',
  )
})

test('T9 装车锁:两处挂点 + export + __test__ 台账 + env 覆盖 + 新腿在册', () => {
  assert.match(SRC, /if \(!CHECK_ONLY\) auditCrossEndDebtLedger\(\)/, 'main() 健康轮次挂点必须在')
  assert.match(
    SRC,
    /^[ \t]+auditCrossEndDebtLedger\(\)$/m,
    'daemon tick 挂点(裸调用,不带 !CHECK_ONLY 前缀)必须在 —— 只挂 main() = 装了没车跑的车站',
  )
  assert.match(SRC, /export function auditCrossEndDebtLedger\(/, '函数必须存在')
  const t = SRC.slice(SRC.indexOf('export const __test__ = {'))
  assert.match(t, /\bauditCrossEndDebtLedger,/, '镜像测试要能 import 到本体(§22c)')
  assert.match(
    SRC,
    /CROSS_END_DEBT_INTERVAL_MS[\s\S]{0,80}IHUI_CROSS_END_DEBT_INTERVAL_MS/,
    '默认节流必须可由 env 覆盖(自测/演练用)',
  )
  assert.match(
    SRC,
    /CROSS_END_DEBT_TIMEOUT_MS[\s\S]{0,120}IHUI_CROSS_END_DEBT_TIMEOUT_MS/,
    '派生超时上限必须可由 env 覆盖(守门 80 热路径纪律)',
  )
  // 新腿必须在 CROSS_END_LEGS 里 —— 用生产出口取证,不在测试里重抄那枚集合。
  const f = fixture()
  const res = noteCrossEndUndetermined('debt-ledger', '夹具:验证腿在册', {
    logger: () => {},
    notify: () => {},
    file: f.undetFile,
    horizonMs: 3 * 60 * 60 * 1000,
  })
  assert.ok(
    !String(res?.why ?? '').includes('未知腿'),
    `腿未登记进 CROSS_END_LEGS ⇒ note/settle 走「未知腿」分支当场 return,这一格瞎了也无人喊:${JSON.stringify(res)}`,
  )
  assert.ok(existsSync(f.undetFile), '在册 ⇒ 起点件真的被写')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
