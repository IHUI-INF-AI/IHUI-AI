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
  assert.match(run.stdout, /# self-test 8\/8/)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
