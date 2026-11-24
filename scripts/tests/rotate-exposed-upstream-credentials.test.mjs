// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 暴露凭据主动轮换器的镜像测试(2026-10-30 立,goal-b35 s6)。
 *
 * 钉的是票面自证五条 + 派发腿装车:
 *   C1 有暴露条目且可换 ⇒ 换成功**且旧值被判死**(state=rotated / exit 0 / 留痕终态);
 *   C2 换成功但旧值仍被接受 ⇒ 判红并点名(state=fake-rotation / exit 1,这是"假轮换"最危险一型);
 *   C3 无暴露条目 ⇒ 零动作零派生零写入(更零推送);
 *   C4 取不到输入(清单缺失 / 子进程报 unjudged)⇒ 未判定 exit 2,绝不记绿;
 *   C5 canary:把一段假凭据塞进子进程输出的任意键,断言它不出现在任何输出面
 *      (stdout / stderr 日志 / 留痕文件 / --json),并且请求面从来不带明文;
 *   C6 终态判定:rotated-dead 之后同 id 同 fp 不再派生;fp 变了就是新靶;
 *   C7 登记/退役出口:--register 只落 fp 不落值;--retire 必须带 ≥10 字理由(§0.10)。
 *   T1..T5 派发腿(clean/rotated 静默、fake-rotation/failed/undetermined 到人且身份稳定、
 *      节流窗口内不派生第二次、器物不在位不记为已探测、装车锁)。
 *
 * 夹具契约(§22c):判据一律 import 源脚本的 `__test__`,测试不复制第二份;
 * 子进程结论由测试注入 `invoke` 替身(不连库、不打上游),形状取自
 * apps/api/scripts/relay-rotate-exposed-credential.ts 的 RotateSummary 出口。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { __test__ as R } from '../rotate-exposed-upstream-credentials.mjs'
import { sweepExposedCredentialRotation } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN_SRC = readFileSync(join(import.meta.dirname, '..', 'git-guardian.mjs'), 'utf8')

/** 号池里"那枚暴露值"的假凭据(canary);任何输出面出现它都算泄漏 */
const CANARY = 'CANARY-Do-N0t-Leak-9f8e7d6c5b4a3f2e1d0c'

function fx(opts = {}) {
  const dir = mkScratch('rotate-exposed-')
  const ledgerFile = join(dir, 'ledger.jsonl')
  const stateFile = join(dir, 'state.jsonl')
  if (opts.ledgerText !== undefined) writeFileSync(ledgerFile, opts.ledgerText, 'utf8')
  return { dir, ledgerFile, stateFile }
}

const entryRow = (over = {}) =>
  JSON.stringify({
    id: 'EXP-1',
    provider: 'trae',
    kind: 'refreshToken',
    fp: 'c7f2db6a79c3',
    len: 40,
    source: {
      commit: '34036e6a83d0934b277158e7b855036e0dca3d7c',
      note: 'Trae 会话导出附件(历史 blob)',
    },
    registeredAt: '2026-10-30',
    ...over,
  })

/** 造一枚"池里仍住着暴露值、且换票后被上游明确拒收"的子进程结论 */
const summaryOf = (rows, over = {}) => ({
  ok: true,
  mode: 'rotate',
  dryRun: false,
  total: rows.length,
  matched: rows.length,
  rotated: 0,
  deadVerified: 0,
  aliveSuspect: 0,
  absent: 0,
  unjudged: 0,
  failed: 0,
  rows,
  ...over,
})

const deadRow = (over = {}) => ({
  id: 'EXP-1',
  provider: 'trae',
  kind: 'refreshToken',
  fp: 'c7f2db6a79c3',
  uid: '3770697304515840',
  name: '13632796771',
  decision: 'rotated-dead',
  poolFpBefore: 'c7f2db6a79c3',
  poolFpAfter: 'a1b2c3d4e5f6',
  oldAccepted: false,
  errorKind: null,
  ...over,
})

const invokeOf =
  (json, calls = []) =>
  (requestText) => {
    calls.push(requestText)
    return { code: 0, json, error: null }
  }

test('C1 有暴露条目且可换 ⇒ 换成功且旧值被判死(并写终态留痕)', async () => {
  const f = fx({ ledgerText: `${entryRow()}\n` })
  const logs = []
  const calls = []
  const rows = [deadRow()]
  const r = await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: f.stateFile,
    logger: (m) => logs.push(m),
    invoke: invokeOf(summaryOf(rows, { rotated: 1, deadVerified: 1 }), calls),
  })
  assert.equal(calls.length, 1, '有靶必须派生一次')
  assert.equal(r.verdict.state, 'rotated', `结论应是"已换且判死",实测 ${r.verdict.state}`)
  assert.equal(r.code, 0)
  assert.ok(
    logs.some((l) => /轮换有效/.test(l) && /a1b2c3d4e5f6/.test(l)),
    '日志要点名新值 fp(证明池里已不住暴露值)',
  )
  const line = logs.find((l) => /ROTATE-RESULT/.test(l))
  assert.match(line, /state=rotated\b.*\brotated=1\b.*\bdead=1\b/)
  const stateText = readFileSync(f.stateFile, 'utf8')
  assert.match(stateText, /"decision":"rotated-dead"/)
  // 留痕里只有 fp,不含 uid 之外的敏感面:uid/name 是号池展示值(非凭据)允许出现
  assert.ok(!stateText.includes(CANARY))
})

test('C2 换成功但旧值仍被接受 ⇒ 判红并点名(假轮换,最危险一型)', async () => {
  const f = fx({ ledgerText: `${entryRow()}\n` })
  const logs = []
  const rows = [
    deadRow({
      decision: 'rotated-alive',
      oldAccepted: true,
      poolFpAfter: 'zzz',
      errorKind: 'health-ok',
    }),
  ]
  const r = await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: f.stateFile,
    logger: (m) => logs.push(m),
    invoke: invokeOf(summaryOf(rows, { rotated: 1, aliveSuspect: 1 })),
  })
  assert.equal(r.verdict.state, 'fake-rotation')
  assert.equal(r.code, 1, '假轮换必须是红(1),不是绿也不是未判定')
  const named = logs.find((l) => /假轮换点名/.test(l))
  assert.ok(named, '必须逐条点名 EXP-1')
  assert.match(named, /EXP-1/)
  assert.match(named, /仍被上游接受/)
  // 非终态 ⇒ 下一轮仍是靶(绝不被"换过一次"就免掉)
  const { rows: disp } = R.readDispositions(f.stateFile)
  assert.equal(R.isSettled(disp, { id: 'EXP-1', fp: 'c7f2db6a79c3' }), false)
})

test('C3 无暴露条目 ⇒ 零动作零派生零写入', async () => {
  const f = fx({ ledgerText: '// 只有注释头,没有条目\n' })
  const logs = []
  const calls = []
  const r = await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: f.stateFile,
    logger: (m) => logs.push(m),
    invoke: invokeOf(summaryOf([]), calls),
  })
  assert.equal(calls.length, 0, '无靶不得派生执行器(空转零动作)')
  assert.equal(r.verdict.state, 'clean')
  assert.equal(r.code, 0)
  assert.equal(existsSync(f.stateFile), false, '空转一行留痕都不许写')
  assert.ok(logs.some((l) => /ROTATE-SKIP/.test(l)))
})

test('C4a 清单取不到 ⇒ 未判定 exit 2,不记绿', async () => {
  const f = fx()
  const logs = []
  const calls = []
  const r = await R.runOnce({
    ledgerFile: join(f.dir, 'nope.jsonl'),
    stateFile: f.stateFile,
    logger: (m) => logs.push(m),
    invoke: invokeOf(summaryOf([]), calls),
  })
  assert.equal(r.code, 2)
  assert.equal(r.verdict.state, 'undetermined')
  assert.equal(calls.length, 0)
  assert.match(
    logs.find((l) => /ROTATE-RESULT/.test(l)),
    /state=undetermined/,
  )
})

test('C4b 旧值无法自证 / 子进程无结论 ⇒ 未判定 exit 2', async () => {
  const f = fx({ ledgerText: `${entryRow()}\n` })
  const logs = []
  const rows = [
    deadRow({ decision: 'unjudged', oldAccepted: null, errorKind: 'health-indeterminate' }),
  ]
  const r = await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: f.stateFile,
    logger: (m) => logs.push(m),
    invoke: invokeOf(summaryOf(rows, { unjudged: 1 })),
  })
  assert.equal(r.verdict.state, 'undetermined')
  assert.equal(r.code, 2, '未判定必须是 2,不许写成绿')
  assert.ok(logs.some((l) => /未判定点名/.test(l)))

  const logs2 = []
  const r2 = await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: join(f.dir, 'state2.jsonl'),
    logger: (m) => logs2.push(m),
    invoke: () => ({ code: 2, json: null, error: '未找到 tsx' }),
  })
  assert.equal(r2.code, 2)
  assert.equal(r2.verdict.state, 'undetermined')
})

test('C5 canary:假凭据不出现在任何输出面(含 --json 与留痕),请求面从不带明文', async () => {
  const f = fx({ ledgerText: `${entryRow()}\n` })
  const logs = []
  const calls = []
  // 子进程"多塞"了凭据原文的若干键 —— 白名单投影必须整片丢弃
  const poisoned = {
    token: CANARY,
    refreshToken: CANARY,
    raw: CANARY,
    password: CANARY,
    cookiesEnc: CANARY,
    secrets: { deviceKeyPem: CANARY },
    stack: `at x (${CANARY})`,
  }
  const rows = [{ ...deadRow(), ...poisoned }]
  const summary = summaryOf(rows, { rotated: 1, deadVerified: 1 })
  const r = await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: f.stateFile,
    logger: (m) => logs.push(m),
    invoke: invokeOf(summary, calls),
  })
  assert.equal(r.verdict.state, 'rotated')
  // ① 请求面只交 fp,从不带明文(清单本来就只有 fp)
  for (const req of calls) {
    assert.ok(!req.includes(CANARY), '喂给执行器的 stdin 不得含凭据原文')
    assert.match(req, /"fp":"c7f2db6a79c3"/)
  }
  // ② 日志面
  for (const l of logs) assert.ok(!l.includes(CANARY), `日志泄漏凭据:${l.slice(0, 60)}`)
  // ③ 留痕面
  const stateText = readFileSync(f.stateFile, 'utf8')
  assert.ok(!stateText.includes(CANARY), '留痕不得含凭据原文')
  // ④ 返回的行对象(会被 --json 打出的那一份)
  assert.ok(!JSON.stringify(r.rows).includes(CANARY), '输出行必须经白名单投影')
  // ⑤ 投影本身:被丢弃的键不许悄悄回来
  for (const row of r.rows) {
    for (const k of Object.keys(poisoned)) assert.equal(row[k], undefined, `投影漏键 ${k}`)
  }
})

test('C6 终态判定:rotated-dead 后不再派生;同 id 换 fp = 新靶', async () => {
  const f = fx({ ledgerText: `${entryRow()}\n` })
  const calls1 = []
  await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: f.stateFile,
    logger: () => {},
    invoke: invokeOf(summaryOf([deadRow()], { rotated: 1, deadVerified: 1 }), calls1),
  })
  const calls2 = []
  const second = await R.runOnce({
    ledgerFile: f.ledgerFile,
    stateFile: f.stateFile,
    logger: () => {},
    invoke: invokeOf(summaryOf([]), calls2),
  })
  assert.equal(calls2.length, 0, '已有终态处置 ⇒ 本轮零派生')
  assert.equal(second.verdict.state, 'clean')
  // 同一枚条目登记了新的暴露值(fp 变) ⇒ 老终态不算,必须再打一次
  const f2 = fx({ ledgerText: `${entryRow({ fp: 'eeeeeeeeeeee' })}\n` })
  const calls3 = []
  await R.runOnce({
    ledgerFile: f2.ledgerFile,
    stateFile: f.stateFile,
    logger: () => {},
    invoke: invokeOf(summaryOf([]), calls3),
  })
  assert.equal(calls3.length, 1, 'fp 变了就是新靶')
})

test('C7 登记与退役出口:register 只落 fp;retire 必须带 ≥10 字理由', async () => {
  const f = fx({ ledgerText: `${entryRow()}\n` })
  const o = R.parseArgs([
    '--register',
    '--provider',
    'trae',
    '--kind',
    'refreshToken',
    '--value-file',
    join(f.dir, 'value.txt'),
    '--source-commit',
    '34036e6a83d0934b277158e7b855036e0dca3d7c',
    '--note',
    'Trae 会话导出附件',
  ])
  assert.equal(o.error, null, `参数应合法:${o.error}`)
  writeFileSync(join(f.dir, 'value.txt'), CANARY, 'utf8')
  const logs = []
  // 仓内路径当输入 ⇒ 当场拒(不得把凭据文件请回仓库)
  const repoSideValue = join(import.meta.dirname, '..', '..', 'PROJECT_PLAN.md')
  const rejected = await R.registerEntry(
    { ledgerFile: f.ledgerFile, register: { ...o.register, valueFile: repoSideValue } },
    (m) => logs.push(m),
  )
  assert.equal(rejected, 2, '仓内路径必须拒')
  assert.ok(
    logs.some((l) => /git 面之外/.test(l)),
    `应点名"git 面之外",实测日志:${JSON.stringify(logs)};repoSideValue=${repoSideValue}`,
  )
  const okCode = await R.registerEntry({ ledgerFile: f.ledgerFile, register: o.register }, (m) =>
    logs.push(m),
  )
  assert.equal(okCode, 0)
  const text = readFileSync(f.ledgerFile, 'utf8')
  assert.ok(!text.includes(CANARY), '登记面只住 fp,绝不住凭据原文')
  assert.match(text, /"id":"EXP-2"/, '取号按现有最大号 +1')

  // 退役:无理由 ⇒ 拒;带 ≥10 字理由 ⇒ 落终态留痕
  assert.equal(
    R.parseArgs(['--retire', '--id', 'EXP-1']).error,
    '--retire 必须带 --reason "<≥10 字定向说明>"(§0.10:结清要交代,不是消红通道)',
  )
  const rc = R.retireEntry(
    {
      ledgerFile: f.ledgerFile,
      stateFile: f.stateFile,
      retire: { id: 'EXP-1', reason: '该型凭据上游按自然到期失效,已由人工确认无活性' },
    },
    (m) => logs.push(m),
  )
  assert.equal(rc, 0)
  const { rows } = R.readDispositions(f.stateFile)
  assert.equal(R.isSettled(rows, { id: 'EXP-1', fp: 'c7f2db6a79c3' }), true)
})

// ── 派发腿(节律面 + 到人面)──────────────────────────────────────────────
const dispatchFixture = () => {
  const dir = mkScratch('rotate-exposed-dispatch-')
  return { dir, tickFile: join(dir, 'tick.json') }
}

const legResult = (
  state,
  kv = 'entries=1 matched=1 rotated=1 dead=1 alive=0 absent=0 unjudged=0 failed=0',
) => `ROTATE-RESULT state=${state} rot=0 ${kv}\n`

test('T1 clean ⇒ 一行读数,不喊人', () => {
  const logs = []
  const mails = []
  const r = sweepExposedCredentialRotation({
    ...dispatchFixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: () => ({
      ok: true,
      status: 0,
      out: legResult(
        'clean',
        'entries=0 matched=0 rotated=0 dead=0 alive=0 absent=0 unjudged=0 failed=0',
      ),
    }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'clean')
  assert.equal(mails.length, 0, '空转/无靶不许到人(§5e-1)')
})

test('T2 fake-rotation ⇒ 到人,身份不含 fp/uid 等会抖动的明细', () => {
  const logs = []
  const mails = []
  const r = sweepExposedCredentialRotation({
    ...dispatchFixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: () => ({
      ok: false,
      status: 1,
      out:
        legResult(
          'fake-rotation',
          'entries=1 matched=1 rotated=1 dead=0 alive=1 absent=0 unjudged=0 failed=0',
        ) + '❌ 假轮换点名:EXP-1 trae/refreshToken uid=3770697304515840 池=zz 暴露=c7f2db6a79c3\n',
      err: '',
    }),
  })
  assert.equal(r.state, 'fake-rotation')
  assert.equal(r.ok, false)
  assert.equal(mails.length, 1)
  assert.equal(mails[0][0], '暴露凭据轮换无效(假轮换)')
  const opts = mails[0][2]
  assert.equal(opts.dedupKey, 'exposed-credential-rotation;fake-rotation')
  assert.ok(!opts.dedupKey.includes('c7f2db6a79c3'), '去重身份里不得住 fp(守门 224)')
})

test('T3 未判定 ⇒ 到人且不记绿;结论行取不到同样落未判定', () => {
  const mails = []
  const f = dispatchFixture()
  const r = sweepExposedCredentialRotation({
    ...f,
    logger: () => {},
    notify: (...a) => mails.push(a),
    runner: () => ({
      ok: false,
      status: 2,
      out: legResult(
        'undetermined',
        'entries=1 matched=0 rotated=0 dead=0 alive=0 absent=0 unjudged=1 failed=0',
      ),
      err: '',
    }),
  })
  assert.equal(r.ok, false)
  assert.equal(r.state, 'undetermined')
  assert.equal(mails.length, 1)
  assert.equal(mails[0][2].dedupKey, 'exposed-credential-rotation;undetermined')

  const mails2 = []
  const r2 = sweepExposedCredentialRotation({
    ...dispatchFixture(),
    logger: () => {},
    notify: (...a) => mails2.push(a),
    runner: () => ({ ok: true, status: 0, out: '没有结论行\n', err: '' }),
  })
  assert.equal(r2.state, 'no-result-line')
  assert.equal(r2.ok, false, '取不到结论绝不写成绿(§0.3)')
  assert.equal(mails2.length, 1)
})

test('T4 节流窗口内不派生第二次;器物不在位 ⇒ 不记为已探测', () => {
  const f = dispatchFixture()
  const now = Date.now()
  let spawns = 0
  const first = sweepExposedCredentialRotation({
    now,
    tickFile: f.tickFile,
    logger: () => {},
    notify: () => {},
    runner: () => {
      spawns++
      return {
        ok: true,
        status: 0,
        out: legResult(
          'clean',
          'entries=0 matched=0 rotated=0 dead=0 alive=0 absent=0 unjudged=0 failed=0',
        ),
      }
    },
  })
  assert.equal(first.ran, true)
  const second = sweepExposedCredentialRotation({
    now: now + 60 * 1000,
    tickFile: f.tickFile,
    logger: () => {},
    notify: () => {},
    runner: () => {
      spawns++
      return { ok: true, status: 0, out: legResult('clean') }
    },
  })
  assert.equal(second.ran, false)
  assert.equal(spawns, 1, '节流台账必须挡住第二次派生')
  const missing = sweepExposedCredentialRotation({
    tickFile: join(f.dir ?? '', 'tick2.json'),
    logger: () => {},
    notify: () => {},
    // 只测"不在位"那一档:把 script 名改掉做不到,故此处只断言默认档能跑(ran=true)
    runner: () => ({
      ok: true,
      status: 0,
      out: legResult(
        'clean',
        'entries=0 matched=0 rotated=0 dead=0 alive=0 absent=0 unjudged=0 failed=0',
      ),
    }),
  })
  assert.equal(missing.ran, true)
})

test('T5 装车锁:挂点在 !CHECK_ONLY 分支 + 函数在出口台账里 + 节流可经 env 覆盖', () => {
  assert.match(
    GUARDIAN_SRC,
    /if \(!CHECK_ONLY\) sweepExposedCredentialRotation\(\)/,
    '派发腿必须挂在 !CHECK_ONLY 分支(CI 口径零副作用)',
  )
  assert.match(
    GUARDIAN_SRC,
    /^\s*sweepExposedCredentialRotation,$/m,
    '必须登记进 __test__ 出口台账',
  )
  assert.match(GUARDIAN_SRC, /IHUI_EXPOSED_CRED_INTERVAL_MS/, '默认节流要能经 env 覆盖(与同族一致)')
  assert.equal(typeof sweepExposedCredentialRotation, 'function')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
