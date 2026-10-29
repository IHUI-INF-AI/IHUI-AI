// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `deploy-feedback.mjs` 的镜像测试(§22c:判据 import 源脚本 `__test__`,本文件零复制判据)。
 *
 * 钉住七环:
 *  ① 契约声明 source=deploy_outcome / v1 未声明 ⇒ 未判定;
 *  ② dry-run 不 spawn、只记台账 dry-run,登记行含 action+route 且 ≤400;
 *  ③ --apply 只调一次 live-doc-edit,LIVE_DOC/LIVE_BLOCK_FILE/LIVE_MSG 与令牌族逐个验;
 *  ④ 同身份 24h 去重(新鲜拦 / 过期放);
 *  ⑤ 每轮 --max-per-run 配额上限;
 *  ⑥ 输入缺失 / 契约坏 ⇒ exit 2;登记行短 sha 被清洗;--status 只读不写盘;
 *  ⑦ 取号族现读可行、绝不使用满员的 G 族;
 *  ⑨ 门槛只问契约(dispatch.minCountBySource.deploy_outcome 现读,缺门槛即未判定)。
 *
 * 全程只用 scripts/lib/scratch-dir.mjs 的夹具,并注入假 spawn:
 * 绝不碰真实 `.ihui-agent/state/deploy-feedback-ledger.jsonl`,也不真跑 live-doc-edit。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as df } from '../deploy-feedback.mjs'

const SCRATCH = mkScratch('deploy-feedback-test-')
after(() => {
  try {
    rmScratch(SCRATCH)
  } catch {
    /* 清理失败不改写用例结论 */
  }
})

const NOW = new Date('2026-10-26T12:00:00Z')
const at = (minAgo) => new Date(NOW.getTime() - minAgo * 60_000).toISOString()
const PLAN_TEXT = ['- [ ] O88 假登记行', '- [ ] D16 另一族'].join('\n')

/** 契约 v2 的内联夹具(不读真实契约:真实契约由另一席升级,本测试只钉消费口径)。 */
const V2 = {
  version: 2,
  reviewBy: '2027-01-31',
  required: ['at', 'source', 'kind', 'severity', 'message'],
  fields: {
    source: { enum: ['api_logs', 'grafana_alert', 'user_feedback', 'deploy_outcome'] },
    kind: { enum: ['http_error', 'runtime_error', 'alert_firing', 'user_report', 'perf_degradation', 'deploy_failure'] },
    severity: { enum: ['debug', 'info', 'warn', 'error', 'critical'] },
    message: { maxLength: 2000 },
    traceId: { maxLength: 128 },
    route: { maxLength: 300 },
  },
  // 门槛随契约现读(2026-10-29):消费方不再自持「单次=1」,夹具必须与真契约同形声明门槛。
  dispatch: { minSeverity: 'warn', minCount: 3, minCountBySource: { deploy_outcome: 1 } },
  owners: { api_logs: '后端', grafana_alert: '运维', user_feedback: '产品', deploy_outcome: '运维值班' },
}
const V1 = {
  ...V2,
  version: 1,
  fields: { ...V2.fields, source: { enum: ['api_logs', 'grafana_alert', 'user_feedback'] } },
  owners: { api_logs: '后端', grafana_alert: '运维', user_feedback: '产品' },
}

const signal = (over = {}) => ({
  at: at(60),
  source: 'deploy_outcome',
  kind: 'deploy_failure',
  severity: 'error',
  message: 'deploy failed code=DEPLOY_FAIL',
  route: 'post /api/deploy/release',
  action: 'deploy',
  dims: { env: 'prod', service: 'api' },
  ...over,
})

function signalFile(name, rows) {
  const path = join(SCRATCH, name)
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  return path
}

function quietRound(over = {}) {
  const logs = []
  const warns = []
  const res = df.runRound({
    now: NOW,
    contract: V2,
    planContent: PLAN_TEXT,
    log: (m) => logs.push(String(m)),
    warn: (m) => warns.push(String(m)),
    // 夹具密闭(2026-10-28 补环同批):默认假面读回恒空 ⇒ apply 用例绝不触真 `git show`。
    // 要断言"ticketLine 带回"的用例在 over 里显式覆盖(见 ⑬/⑭)。
    readPlanHead: () => '',
    ...over,
  })
  return { res, logs, warns }
}

test('① 契约口径:v2 声明 deploy_outcome 可消费;v1 未声明 ⇒ 未判定', () => {
  assert.equal(df.contractSupportsDeployOutcome(V2), true)
  assert.equal(df.contractSupportsDeployOutcome(V1), false)
  assert.throws(() => df.ensureDeployContract(V1), df.DeployFeedbackShapeError)
  const { res, warns } = quietRound({ contract: V1, inputPath: join(SCRATCH, 'anything.jsonl') })
  assert.equal(res.code, 2)
  assert.equal(res.status, 'undetermined')
  assert.ok(warns.some((w) => w.includes('未判定')), warns.join('\n'))
})

test('② dry-run:不 spawn、只记台账 dry-run,行含 action+route 且 ≤400', () => {
  const inputPath = signalFile('dry.jsonl', [signal()])
  const ledgerPath = join(SCRATCH, 'dry-ledger.jsonl')
  const tmpDir = join(SCRATCH, 'dry-tmp')
  let calls = 0
  const { res } = quietRound({
    inputPath,
    ledgerPath,
    tmpDir,
    spawn: () => {
      calls++
      return { status: 0, stdout: '', stderr: '' }
    },
  })
  assert.equal(res.code, 0)
  assert.equal(calls, 0, 'dry-run 不得 spawn live-doc-edit')
  assert.equal(res.results.length, 1)
  assert.equal(res.results[0].result, 'dry-run')
  const ledger = df.readLedger(ledgerPath)
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].result, 'dry-run')
  const line = res.candidates[0].line
  assert.match(line, /^- \[ \] \{\{NEXT_ID:O\}\} \[deploy-feedback\] /)
  assert.match(line, /deploy/)
  assert.match(line, /\/api\/deploy\/release/i)
  assert.ok(line.length <= df.LINE_MAX, `行宽 ${line.length}`)
})

test('③ --apply:只调一次 live-doc-edit,env 与令牌族逐项;块文件用完即删', () => {
  const inputPath = signalFile('apply.jsonl', [signal()])
  const ledgerPath = join(SCRATCH, 'apply-ledger.jsonl')
  const tmpDir = join(SCRATCH, 'apply-tmp')
  const calls = []
  let block = ''
  let blockPath = ''
  const fakeSpawn = (_cmd, argv, opts) => {
    calls.push({ argv, opts })
    blockPath = opts.env.LIVE_BLOCK_FILE
    block = readFileSync(blockPath, 'utf8')
    return { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
  }
  const { res } = quietRound({ inputPath, ledgerPath, tmpDir, apply: true, spawn: fakeSpawn })
  assert.equal(res.code, 0)
  assert.equal(calls.length, 1, '一条候选只调一次')
  assert.equal(res.results[0].result, 'registered')
  assert.ok(String(calls[0].argv[0]).endsWith('live-doc-edit.mjs'), '唯一登记入口')
  assert.equal(calls[0].opts.env.LIVE_DOC, 'PROJECT_PLAN.md')
  assert.ok(blockPath.startsWith(tmpDir), `临时块必须落注入的 tmpDir:${blockPath}`)
  assert.match(calls[0].opts.env.LIVE_MSG, /deploy-feedback/)
  assert.match(block, /\{\{NEXT_ID:O\}\}/, '编号必须走取号令牌')
  assert.ok(!/\{\{NEXT_ID:G\}\}/.test(block), 'G 族现读已满,不得使用')
  assert.ok(!/\{\{NEXT_ID:\d/.test(block), '令牌族只吃字母')
  assert.ok(block.trim().length <= df.LINE_MAX)
  assert.ok(!existsSync(blockPath), '临时块用完即删')
  assert.equal(df.readLedger(ledgerPath)[0].result, 'registered')
  assert.ok(!('ticketLine' in df.readLedger(ledgerPath)[0]), '回读面恒空(读不到)⇒ 条目退回无键形态,绝不伪造对齐键')
})

test('③b 回读到已落行 ⇒ registered 条目带 ticketLine(O6x 号可被 extractTicketNo 解析)', () => {
  const inputPath = signalFile('landed.jsonl', [signal()])
  const ledgerPath = join(SCRATCH, 'landed-ledger.jsonl')
  const tmpDir = join(SCRATCH, 'landed-tmp')
  const fakeSpawn = () => ({ status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' })
  // 假 HEAD 面:与真实枚 a9cb59ed41e 的落地行同形(行首 `- [ ] O<号> [deploy-feedback] `,行体带 route=)
  const landedLine = '- [ ] O69 [deploy-feedback] [deploy_outcome/alert_firing] rollback post /api/deploy/release 部署异常 ⇒ 排查链路并修复（登记@2026-10-28/deploy-feedback;来源:deploy_outcome;证据:route=post /api/deploy/release）'
  const { res } = quietRound({
    inputPath,
    ledgerPath,
    tmpDir,
    apply: true,
    spawn: fakeSpawn,
    readPlanHead: () => `# 前文无关\n${landedLine}\n- [ ] O02 别的票 route=/deploy/x\n`,
  })
  assert.equal(res.code, 0)
  const e = df.readLedger(ledgerPath).find((x) => x.result === 'registered')
  assert.equal(e?.ticketLine, landedLine, 'ticketLine 必须逐字等于读回的落地行')
})

test('③c findLandedRegistrationLine:route 带空格取全段;不同 route 不误配;无标记行不算', () => {
  const t = ['- [ ] O70 [deploy-feedback] X route=post /api/deploy/release tail', '- [x] 旧勾行不是目标', '- [ ] 行首无标记'].join('\n')
  assert.equal(df.findLandedRegistrationLine(t, 'deploy_outcome|alert_firing|route:post /api/deploy/release'), '- [ ] O70 [deploy-feedback] X route=post /api/deploy/release tail')
  assert.equal(df.findLandedRegistrationLine(t, 'deploy_outcome|alert_firing|route:/deploy/build-fail'), null, 'route 不同形 ⇒ 判未命中,不得拿别的票的号凑')
  assert.equal(df.findLandedRegistrationLine(t, ''), '- [ ] O70 [deploy-feedback] X route=post /api/deploy/release tail', 'identity 无 route 段 ⇒ 只按行头标记取首命中')
})

test('④ 同身份 24h 去重:新鲜 registered 拦截;25h 前放行', () => {
  const identity = df.identityOfSignal(signal(), V2)
  const inputPath = signalFile('dedup.jsonl', [signal()])

  const freshLedger = join(SCRATCH, 'dedup-fresh.jsonl')
  df.appendLedger({ ts: at(60), action: 'deploy', identity, result: 'registered' }, freshLedger)
  let freshCalls = 0
  const fresh = quietRound({
    inputPath,
    ledgerPath: freshLedger,
    tmpDir: join(SCRATCH, 'dedup-fresh-tmp'),
    apply: true,
    spawn: () => {
      freshCalls++
      return { status: 0, stdout: '✅ 回读', stderr: '' }
    },
  })
  assert.equal(fresh.res.code, 0)
  assert.equal(fresh.res.results[0].result, 'skip')
  assert.equal(freshCalls, 0)
  assert.equal(df.readLedger(freshLedger).at(-1).result, 'skip')

  const oldLedger = join(SCRATCH, 'dedup-old.jsonl')
  df.appendLedger({ ts: new Date(NOW.getTime() - 25 * 3600_000).toISOString(), action: 'deploy', identity, result: 'registered' }, oldLedger)
  let oldCalls = 0
  const old = quietRound({
    inputPath,
    ledgerPath: oldLedger,
    tmpDir: join(SCRATCH, 'dedup-old-tmp'),
    apply: true,
    spawn: () => {
      oldCalls++
      return { status: 0, stdout: '✅ 回读', stderr: '' }
    },
  })
  assert.equal(old.res.results[0].result, 'registered')
  assert.equal(oldCalls, 1)
})

test('⑤ 每轮配额:--max-per-run 2 时 4 条簇只登记 2 条', () => {
  const routes = ['post /api/deploy/a', 'post /api/deploy/b', 'post /api/deploy/c', 'post /api/deploy/d']
  const inputPath = signalFile('quota.jsonl', routes.map((route, i) => signal({ route, message: `deploy failed code=DEPLOY_FAIL_${i}` })))
  const ledgerPath = join(SCRATCH, 'quota-ledger.jsonl')
  let calls = 0
  const { res } = quietRound({
    inputPath,
    ledgerPath,
    tmpDir: join(SCRATCH, 'quota-tmp'),
    maxPerRun: 2,
    apply: true,
    spawn: () => {
      calls++
      return { status: 0, stdout: '✅ 回读', stderr: '' }
    },
  })
  assert.equal(res.code, 0)
  assert.equal(calls, 2, '配额上限必须拦在第 3 条之前')
  const counts = res.results.reduce((m, r) => ((m[r.result] = (m[r.result] ?? 0) + 1), m), {})
  assert.equal(counts.registered, 2)
  assert.equal(counts.skip, 2)
  assert.equal(df.readLedger(ledgerPath).filter((e) => e.result === 'registered').length, 2)
})

test('⑥a 输入缺失 ⇒ exit 2 且打印未判定', () => {
  const { res, warns } = quietRound({ inputPath: join(SCRATCH, 'missing.jsonl'), ledgerPath: join(SCRATCH, 'missing-ledger.jsonl') })
  assert.equal(res.code, 2)
  assert.equal(res.status, 'undetermined')
  assert.ok(warns.some((w) => w.startsWith('未判定:')), warns.join('\n'))
})

test('⑥b 登记行 ≤400 且 7~64 位短 sha 被清洗', () => {
  const line = df.buildRegistrationLine({
    token: '{{NEXT_ID:O}}',
    title: '部署 abc123def456 失败 ' + 'x'.repeat(600),
    evidence: 'id=deadbeefcafe ' + 'y'.repeat(600),
    date: '2026-10-26',
  })
  assert.ok(line.length <= df.LINE_MAX, `行宽 ${line.length}`)
  assert.match(line, /\[hex:12\]/)
  assert.ok(!/(^|[^0-9a-zA-Z_])[0-9a-fA-F]{7,64}(?=$|[^0-9a-zA-Z_])/.test(line), '短 sha 不得进台账行')
})

test('⑥c --status 只读:不创建台账、不 spawn、不改既有台账', () => {
  const inputPath = signalFile('status.jsonl', [signal()])
  const missingLedger = join(SCRATCH, 'status-missing-ledger.jsonl')
  const rep = df.statusReport({ contract: V2, inputPath, ledgerPath: missingLedger, planContent: PLAN_TEXT, now: NOW })
  assert.equal(rep.code, 0)
  assert.equal(existsSync(missingLedger), false, 'status 不得创建台账')
  assert.ok(rep.lines.some((l) => l.startsWith('取号族:')))
  assert.ok(rep.lines.some((l) => l.startsWith('台账:')))

  const existing = join(SCRATCH, 'status-existing-ledger.jsonl')
  df.appendLedger({ ts: at(60), action: 'deploy', identity: 'x', result: 'registered' }, existing)
  const before = readFileSync(existing, 'utf8')
  df.statusReport({ contract: V2, inputPath, ledgerPath: existing, planContent: PLAN_TEXT, now: NOW })
  assert.equal(readFileSync(existing, 'utf8'), before, 'status 不得改写既有台账')
})

test('⑧ intake 形态(无 action/dims 字段):从 route 与 message 回读 action/dims', () => {
  const intake = {
    at: at(60),
    source: 'deploy_outcome',
    kind: 'alert_firing',
    severity: 'error',
    message: 'deploy_outcome action=rollback dims=web+llm reason=canary failed',
    route: 'deploy/rollback',
  }
  const inputPath = signalFile('intake.jsonl', [intake])
  const { res } = quietRound({ inputPath, ledgerPath: join(SCRATCH, 'intake-ledger.jsonl'), tmpDir: join(SCRATCH, 'intake-tmp') })
  assert.equal(res.code, 0)
  const rec = res.candidates[0]
  assert.match(rec.title, /rollback/)
  assert.match(rec.title, /\/deploy\/rollback/)
  assert.match(rec.evidence, /dims=web\+llm/)
  assert.match(rec.evidence, /action=rollback/)
  assert.match(rec.evidence, /窗口=1440min/)
})

test('⑨ 门槛只问契约:minCountBySource.deploy_outcome 现读,契约收紧则跟着收紧,契约缺门槛判未判定', () => {
  const inputPath = signalFile('gate.jsonl', [signal()])
  const strict = structuredClone(V2)
  strict.dispatch.minCountBySource = { deploy_outcome: 2 }
  const tightened = quietRound({ inputPath, contract: strict, ledgerPath: join(SCRATCH, 'gate-ledger.jsonl'), tmpDir: join(SCRATCH, 'gate-tmp') })
  assert.equal(tightened.res.code, 0, tightened.res.why ?? '')
  assert.equal(tightened.res.candidates.length, 0, '契约抬到 2 ⇒ 单条信号不得派单(消费方不得自持旧字面量)')
  assert.ok(tightened.logs.some((l) => l.includes('dispatch.minCountBySource.deploy_outcome')), tightened.logs.join('\n'))

  const noGate = structuredClone(V2)
  delete noGate.dispatch.minCount
  delete noGate.dispatch.minCountBySource
  const undet = quietRound({ inputPath, contract: noGate, ledgerPath: join(SCRATCH, 'gate-none.jsonl') })
  assert.equal(undet.res.code, 2, '契约缺门槛必须判未判定,不得回落硬编码阈值')
  assert.match(undet.res.why ?? '', /门槛不可判定/)

  // 真实契约必须声明本源门槛:消费方已不再自持「单次=1」,契约缺这一格 ⇒ 生产会直接落未判定。
  const realContract = JSON.parse(readFileSync(new URL('../data/incident-signal-contract.json', import.meta.url), 'utf8'))
  const realGate = realContract?.dispatch?.minCountBySource?.deploy_outcome
  assert.ok(Number.isInteger(realGate) && realGate >= 1, `真契约缺 dispatch.minCountBySource.deploy_outcome(实得 ${JSON.stringify(realGate)})`)
})

test('⑦ 取号族现读:O65 落成字母族 O、下一号现读;绝不选 G', () => {
  const fam = df.chooseIdFamily(PLAN_TEXT)
  assert.equal(fam.ok, true)
  assert.equal(fam.token, '{{NEXT_ID:O}}')
  assert.equal(fam.nextLabel, 'O89')
  assert.notEqual(fam.family, 'G')
  assert.equal(df.chooseIdFamily('').ok, false, '读不到计划 ⇒ 取号不可行,不得给 1')
})
