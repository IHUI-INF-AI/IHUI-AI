// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/feedback-loop-status.mjs(§22c:判据只 import 源脚本,不复制实现)。
// 这只器算错的表现是一张"看起来闭环"的表,故优先钉五件事:全链路串通、断点显式未判定、
// 坏行不连坐、--json 形状与末行机器行、summary 配平(N = closed + open + undetermined)。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { identityOf } from '../lib/incident-cluster.mjs'

const SRC = fileURLToPath(new URL('../feedback-loop-status.mjs', import.meta.url))
const ROOT = resolve(dirname(SRC), '..')
const SRC_TEXT = readFileSync(SRC, 'utf8')
const mod = await import(pathToFileURL(SRC).href)
const { buildStatus, renderHuman, formatSummaryLine, readJsonl, SOURCE_FILES } = mod
const { __test__ } = mod
assert.ok(__test__ && typeof __test__.buildStatus === 'function')

const BOXES = []
function makeBox() {
  const dir = mkScratch('feedback-loop-test-')
  BOXES.push(dir)
  return dir
}
function writeLines(path, rows) {
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
}
after(() => {
  for (const dir of BOXES) {
    try {
      rmScratch(dir)
    } catch {
      /* 夹具清理失败不影响判据 */
    }
  }
})

const NOW = new Date('2026-10-26T12:00:00.000Z')
const SHA = 'a'.repeat(40)
const at = (h) => `2026-10-26T${String(h).padStart(2, '0')}:00:00.000Z`
const signal = (identity) => ({ at: at(1), source: 'api_logs', kind: 'http_error', route: '/api/x', message: 'boom', identity })
const feedback = (identity, ticket, key) => ({ at: at(2), identity, ticket, ticketKey: key })
const dispatch = (key, line, h) => ({ ts: at(h), mode: 'dispatch', action: 'session-ok', ticketKey: key, ticketLine: line })
const GIT = { ok: true, why: '', commits: [{ sha: SHA, at: at(3), subject: 'fix: G-9001 修复接口错误' }] }

function happyBox() {
  const box = makeBox()
  writeLines(join(box, SOURCE_FILES.signals), [signal('sig-1'), signal('sig-2')])
  writeLines(join(box, SOURCE_FILES.feedback), [
    feedback('sig-1', '- [ ] 修复 G-9001 接口错误', 'k1'),
    feedback('sig-2', '- [ ] 未带票键的登记'),
  ])
  writeLines(join(box, SOURCE_FILES.dispatch), [dispatch('k1', '- [ ] 修复 G-9001 接口错误', 3)])
  writeLines(join(box, SOURCE_FILES.decisions), [
    { v: 1, ts: at(4), action: 'canary-pass', sha: SHA, gateVerdict: 'pass', reason: '观察窗通过' },
  ])
  return box
}

test('① 全链路 happy path:四本台账串起 ⇒ verified', () => {
  const r = buildStatus({ stateDir: happyBox(), now: NOW, commits: 5, git: GIT })
  const one = r.incidents.find((i) => i.identity === 'sig-1')
  assert.ok(one, '未生成 sig-1 事故')
  assert.equal(one.status, 'verified', one.why)
  for (const stage of ['perceived', 'ticketed', 'dispatched', 'fixed', 'deployed', 'verified']) {
    assert.equal(one.stages[stage], 'yes', `阶段 ${stage} 应为 yes`)
  }
  assert.equal(one.stages.rolled_back, 'no')
  assert.equal(one.evidence.fixSha, SHA)
  assert.equal(one.evidence.deployAction, 'canary-pass')
  assert.equal(r.summary.closed, 1)
})

test('② 断点 undetermined:缺 dispatch 键 / 缺 deploy 台账都要点名', () => {
  const r = buildStatus({ stateDir: happyBox(), now: NOW, commits: 5, git: GIT })
  const noKey = r.incidents.find((i) => i.identity === 'sig-2')
  assert.equal(noKey.status, 'undetermined')
  assert.equal(noKey.stages.dispatched, 'undetermined')
  assert.match(noKey.why, /断在 dispatched/)

  const box = makeBox()
  writeLines(join(box, SOURCE_FILES.signals), [signal('sig-3')])
  writeLines(join(box, SOURCE_FILES.feedback), [feedback('sig-3', '- [ ] 修复 G-9003', 'k3')])
  writeLines(join(box, SOURCE_FILES.dispatch), [dispatch('k3', '- [ ] 修复 G-9003', 3)])
  const missingDeploy = buildStatus({ stateDir: box, now: NOW })
  assert.equal(missingDeploy.incidents[0].status, 'undetermined')
  assert.equal(missingDeploy.incidents[0].stages.deployed, 'undetermined')
  assert.match(missingDeploy.incidents[0].why, /断在 deployed/)
})

test('③ 坏行逐条点名且不连坐其它行', () => {
  const box = makeBox()
  writeFileSync(
    join(box, SOURCE_FILES.signals),
    `${JSON.stringify(signal('sig-4'))}\n{坏行 not json\n${JSON.stringify(signal('sig-5'))}\n`,
    'utf8',
  )
  writeLines(join(box, SOURCE_FILES.feedback), [feedback('sig-4', '- [ ] 修复 G-9004', 'k4')])
  writeLines(join(box, SOURCE_FILES.dispatch), [dispatch('k4', '- [ ] 修复 G-9004', 3)])
  writeLines(join(box, SOURCE_FILES.decisions), [])
  const r = buildStatus({ stateDir: box, now: NOW })
  assert.equal(r.badLines.length, 1)
  assert.deepEqual({ source: r.badLines[0].source, line: r.badLines[0].line }, { source: 'signals', line: 2 })
  assert.ok(r.badLines[0].why)
  assert.equal(r.incidents.length, 2, '好行不得被坏行吞掉')
  assert.equal(r.sources.find((s) => s.id === 'signals').state, 'partial')
})

test('④ --json 结构 + 末行机器行', () => {
  const box = happyBox()
  const run = spawnSync(process.execPath, [SRC, '--state-dir', box, '--json'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
  const lines = run.stdout.trim().split(/\r?\n/)
  const last = lines[lines.length - 1]
  assert.match(last, /^LOOP-STATUS incidents=\d+ closed=\d+ open=\d+ undetermined=\d+$/)
  const report = JSON.parse(lines[0])
  assert.ok(Array.isArray(report.incidents) && report.incidents.length === 2)
  const one = report.incidents.find((i) => i.identity === 'sig-1')
  for (const key of ['identity', 'stages', 'status', 'why']) assert.ok(key in one, `缺 ${key}`)
  for (const stage of ['perceived', 'ticketed', 'dispatched', 'fixed', 'deployed', 'verified', 'rolled_back']) {
    assert.ok(stage in one.stages, `stages 缺 ${stage}`)
  }
  assert.equal(one.status, 'verified')
  assert.deepEqual(Object.keys(report.summary).filter((k) => ['incidents', 'closed', 'open', 'undetermined'].includes(k)).sort(), ['closed', 'incidents', 'open', 'undetermined'])
  assert.equal(last, formatSummaryLine(report.summary))
})

test('⑤ --self-test 全过且不写真实状态目录', () => {
  const run = spawnSync(process.execPath, [SRC, '--self-test'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  // 计数不钉死:自检例数会随判据补强增长,钉死数字会让「加一条用例」变成恒红(与「全过」是两件事)。
  assert.match(run.stdout, /# self-test (\d+)\/\1/)
  assert.ok(!run.stdout.includes('FAIL'))
})

test('⑥ summary 配平:N = closed + open + undetermined,undetermined 计入 N', () => {
  const r = buildStatus({ stateDir: happyBox(), now: NOW, commits: 5, git: GIT })
  const s = r.summary
  assert.equal(s.incidents, 2)
  assert.equal(s.closed, 1)
  assert.equal(s.undetermined, 1)
  assert.equal(s.incidents, s.closed + s.open + s.undetermined)
  assert.equal(s.balanced, true)
})

test('⑦ 空账本 ⇒ 0 条 exit 0;四源全缺 ⇒ exit 2', () => {
  const empty = makeBox()
  for (const f of Object.values(SOURCE_FILES)) writeFileSync(join(empty, f), '', 'utf8')
  const emptyRun = spawnSync(process.execPath, [SRC, '--state-dir', empty, '--json'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(emptyRun.status, 0, emptyRun.stderr)
  assert.match(emptyRun.stdout, /LOOP-STATUS incidents=0 closed=0 open=0 undetermined=0/)

  const missing = makeBox()
  const missingRun = spawnSync(process.execPath, [SRC, '--state-dir', missing], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(missingRun.status, 2, missingRun.stdout + missingRun.stderr)
  assert.match(missingRun.stdout.trim().split(/\r?\n/).pop(), /^LOOP-STATUS incidents=0 closed=0 open=0 undetermined=0$/)
})

test('⑧ 只读与形态锁:双形态入口、无写盘调用、元数据字段', () => {
  assert.match(SRC_TEXT, /^const isDirectRun =/m)
  assert.ok(SRC_TEXT.includes('pathToFileURL(resolve(process.argv[1]))'))
  for (const bad of ["writeFileSync(join(ROOT", "appendFileSync(", 'mkdirSync(']) {
    assert.ok(!SRC_TEXT.includes(bad), `只读脚本不得出现 ${bad}`)
  }
  assert.match(readFileSync(SRC, 'utf8').split(/\r?\n/)[0], /IHUI AI/)
  const parsed = readJsonl(join(makeBox(), 'nope.jsonl'))
  assert.equal(parsed.state, 'missing')
  assert.ok(parsed.why.includes('文件不存在'))
  assert.ok(renderHuman(buildStatus({ stateDir: happyBox(), now: NOW })).includes('阶段表'))
})

test('⑨ 派生身份以 incident-cluster.identityOf 为唯一尺子', () => {
  const row = {
    at: at(1),
    source: 'deploy_outcome',
    kind: 'alert_firing',
    severity: 'error',
    message: 'deploy_outcome action=rollback reason="健康门禁未过"',
    route: 'deploy/rollback',
  }
  const expected = identityOf(row)
  assert.ok(expected, 'identityOf 不得返回空身份')
  assert.equal(__test__.signalIdentityOf(row).identity, expected)
  assert.equal(__test__.normalizeSignal(row).identity, expected)

  const box = makeBox()
  writeLines(join(box, SOURCE_FILES.signals), [row])
  for (const f of [SOURCE_FILES.feedback, SOURCE_FILES.dispatch, SOURCE_FILES.decisions]) {
    writeFileSync(join(box, f), '', 'utf8')
  }
  const r = buildStatus({ stateDir: box, now: NOW })
  assert.deepEqual(r.incidents.map((i) => i.identity), [expected])
  assert.equal(r.incidents[0].stages.perceived, 'yes')
})

// ⑩⑪ 钉住「旁路」这条判据:真实工作流存在「跳过派单、人工直接修复并提交」的路径,
// 若只认派单台账,这类事故会被永久误报成「尚未派单」。但旁路必须有凭证 ——
// 无票号提交 / 部署不含修复 / 建单写盘失败,三种情况都不得被说成闭环。
const FIX_SHA = 'a'.repeat(40)
const DEPLOY_SHA = 'b'.repeat(40)

function bypassBox({ ticket = '- [ ] O67 [deploy-feedback] build-fail /deploy/build-fail', result = 'registered', decisions = null } = {}) {
  const box = makeBox()
  writeLines(join(box, SOURCE_FILES.signals), [signal('bypass-1')])
  writeLines(join(box, SOURCE_FILES.feedback), [{ at: at(2), identity: 'bypass-1', ticket, result }])
  writeLines(join(box, SOURCE_FILES.dispatch), [])
  writeLines(
    join(box, SOURCE_FILES.decisions),
    decisions ?? [{ ts: at(4), action: 'canary-pass', sha: DEPLOY_SHA, reason: '观察窗通过' }],
  )
  return box
}

const BYPASS_GIT = { ok: true, why: '', commits: [{ sha: FIX_SHA, at: at(3), subject: 'fix(deploy): 结清 O67 build-fail(已上线)' }] }
const NO_HIT_GIT = { ok: true, why: '', commits: [{ sha: FIX_SHA, at: at(3), subject: 'fix(deploy): 与票号无关的提交' }] }
const PATTERNS = ['\\b(O\\d{1,4})\\b']

test('⑩ 旁路:派单台账无同票行,但有含票号提交 + 部署包含该提交 ⇒ bypassed 且 verified', () => {
  const r = buildStatus({
    stateDir: bypassBox(),
    now: NOW,
    commits: 5,
    git: BYPASS_GIT,
    isAncestor: () => true,
    ticketNoPatterns: PATTERNS,
  })
  const one = r.incidents.find((i) => i.identity === 'bypass-1')
  assert.ok(one, '未生成 bypass-1 事故')
  assert.equal(one.stages.dispatched, 'bypassed')
  assert.equal(one.stages.fixed, 'yes')
  assert.equal(one.stages.deployed, 'yes')
  assert.equal(one.status, 'verified')
  assert.equal(one.evidence.deployBasis, 'contains-fix')
  assert.ok(one.why.includes('未走派单环'), `why 未点明旁路:${one.why}`)
  assert.ok(renderHuman(r).includes('b=旁路'), '人读图表例未标注旁路符号')
})

test('⑪ 旁路不可伪造:无票号命中仍判未派单;部署不含修复判未判定;建单写盘失败不算已建单', () => {
  // a) 票号有,但没有任何含票号的提交 ⇒ 不许认旁路
  const a = buildStatus({ stateDir: bypassBox(), now: NOW, commits: 5, git: NO_HIT_GIT, isAncestor: () => true, ticketNoPatterns: PATTERNS })
  const ai = a.incidents.find((i) => i.identity === 'bypass-1')
  assert.equal(ai.stages.dispatched, 'no')
  assert.ok(ai.why.includes('尚未派单'), ai.why)

  // b) 未请求 git(--commits 未给)⇒ 无凭证,同样不许认旁路
  const b = buildStatus({ stateDir: bypassBox(), now: NOW, ticketNoPatterns: PATTERNS })
  assert.equal(b.incidents.find((i) => i.identity === 'bypass-1').stages.dispatched, 'no')

  // c) 有修复提交,但部署的 sha 既不同源也不包含修复 ⇒ 不许说已上线
  const c = buildStatus({ stateDir: bypassBox(), now: NOW, commits: 5, git: BYPASS_GIT, isAncestor: () => false, ticketNoPatterns: PATTERNS })
  const ci = c.incidents.find((i) => i.identity === 'bypass-1')
  assert.equal(ci.stages.deployed, 'undetermined')
  assert.ok(ci.why.includes('均不含修复提交'), ci.why)

  // d) 登记行 result=undetermined(写盘被打断)⇒ 建单未落地,不得算 ticketed=yes
  const d = buildStatus({ stateDir: bypassBox({ result: 'undetermined' }), now: NOW, commits: 5, git: BYPASS_GIT, isAncestor: () => true, ticketNoPatterns: PATTERNS })
  const di = d.incidents.find((i) => i.identity === 'bypass-1')
  assert.equal(di.stages.ticketed, 'undetermined')
  assert.ok(di.why.includes('建单未落地'), di.why)
})

// ⑫ 钉住「部署决策面」:部署环跑生产 checkout、决策落那一侧,status 若钉死主仓就会永远看不见
// 真部署(2026-10-28 实测:主仓 3 行 vs 生产 88 行,导致已上线的两枚事故被判「尚未部署」)。
test('⑫ 部署决策台账随线上 oracle 面解析,不钉死主仓;--state-dir 仍平铺隔离', () => {
  const root = makeBox()
  const faceFile = join(root, 'prod-face.jsonl')
  writeFileSync(faceFile, '', 'utf8')
  const prev = process.env.IHUI_DEPLOY_DECISIONS_FACE
  process.env.IHUI_DEPLOY_DECISIONS_FACE = faceFile
  try {
    const p = mod.resolvePaths({ root })
    assert.equal(p.decisions, faceFile, '部署决策路径未随面覆盖 —— 又钉死主仓了')
    assert.ok(p.signals.startsWith(join(root, '.ihui-agent', 'state')), '其余三本不应受面影响')
  } finally {
    if (prev === undefined) delete process.env.IHUI_DEPLOY_DECISIONS_FACE
    else process.env.IHUI_DEPLOY_DECISIONS_FACE = prev
  }
  // 显式 --state-dir ⇒ 四本平铺,不受面影响(测试与夹具隔离的既定契约)
  const flat = mod.resolvePaths({ root, stateDir: root })
  assert.equal(flat.decisions, join(root, SOURCE_FILES.decisions))
})

// ⑬ 观察维不得压死主裁决:canary-unproven 的语义是「金丝雀这维没拿到证据」(判据原文:不判过也不判坏),
// 它一旦把同轮的 pass 覆盖掉,LLM 探针长期拿不到答案时已确认的切流会被永久判成未判定。
test('⑬ 观察维(canary-unproven)不压死同 sha 主裁决;没有主裁决时仍判未判定', () => {
  const withPrimary = bypassBox({
    decisions: [
      { ts: at(4), action: 'pass', sha: DEPLOY_SHA, reason: '健康门禁三项全绿后切流' },
      { ts: at(5), action: 'canary-unproven', sha: DEPLOY_SHA, reason: 'llm-origin:未知占比 100%' },
    ],
  })
  const r = buildStatus({ stateDir: withPrimary, now: NOW, commits: 5, git: BYPASS_GIT, isAncestor: () => true, ticketNoPatterns: PATTERNS })
  const one = r.incidents.find((i) => i.identity === 'bypass-1')
  assert.equal(one.stages.verified, 'yes', '同 sha 有 pass 时不得被观察维压成未判定')
  assert.equal(one.status, 'verified')
  assert.ok(one.why.includes('属观察维'), `why 未点明观察维:${one.why}`)

  // 反证:只有观察维、没有任何主裁决 ⇒ 不许判过
  const onlyObservation = bypassBox({
    decisions: [{ ts: at(4), action: 'canary-unproven', sha: DEPLOY_SHA, reason: '未知占比超阈' }],
  })
  const r2 = buildStatus({ stateDir: onlyObservation, now: NOW, commits: 5, git: BYPASS_GIT, isAncestor: () => true, ticketNoPatterns: PATTERNS })
  const two = r2.incidents.find((i) => i.identity === 'bypass-1')
  assert.equal(two.stages.verified, 'undetermined')
  assert.equal(two.status, 'undetermined')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ⑭ 票号必须按边界匹配(2026-10-29 补):原判据 `subject.includes(no)` 会把 'O680' 认成 'O68' 的修复,
// 把别人的提交记成本事故已修 —— 假阳比漏判更坏(它让闭环表看起来全绿)。这里只收紧,不放宽任何阶段。
test('⑭ 票号边界:O68 不得认成 O680 的修复;D16 不得命中 D160', () => {
  const box = bypassBox({ ticket: '- [ ] O68 [deploy-feedback] build-fail /deploy/build-fail' })
  const wrong = buildStatus({
    stateDir: box,
    now: NOW,
    commits: 5,
    git: { ok: true, why: '', commits: [{ sha: FIX_SHA, at: at(3), subject: 'fix: O680 别人的票' }] },
    isAncestor: () => true,
    ticketNoPatterns: PATTERNS,
  })
  const one = wrong.incidents.find((i) => i.identity === 'bypass-1')
  assert.equal(one.stages.fixed, 'undetermined', 'O680 不得当作 O68 的修复')
  assert.equal(one.stages.dispatched, 'no', 'O680 不得当作 O68 的派单凭证')

  const right = buildStatus({
    stateDir: box,
    now: NOW,
    commits: 5,
    git: { ok: true, why: '', commits: [{ sha: FIX_SHA, at: at(3), subject: 'fix(deploy): 结清 O68 build-fail' }] },
    isAncestor: () => true,
    ticketNoPatterns: PATTERNS,
  })
  assert.equal(right.incidents.find((i) => i.identity === 'bypass-1').stages.fixed, 'yes', '同票号必须仍能命中')

  assert.equal(mod.mentionsTicketNo('- [ ] D160 别的行', 'D16'), false)
  assert.equal(mod.mentionsTicketNo('- [ ] D16 本行', 'D16'), true)
  assert.equal(mod.mentionsTicketNo('fix(G-9001): x', 'G-9001'), true)
})
