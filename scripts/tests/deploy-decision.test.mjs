// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `deploy-decision.mjs` 的镜像测试(§22c:判据 import 源脚本,本文件不复制判据)。
 *
 * 钉四环(O65 第 2 期「回滚决策机读口径」):
 *  ① 形状锁:action/verdict 闭集、非法输入必须 throw,不替调用方猜;
 *  ② 回滚三件套:prevSha / rollbackBuildId / failDims 必须落到记录里(dims 去重切分);
 *  ③ 未判定语义:读不到的 sha 标 undetermined(...),空 sha 保持空串 —— 两者不得混为一谈;
 *  ④ 台账落盘:只追加不改写、坏行不污染统计、机器行单行可 grep。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  DECISION_ACTIONS,
  DECISION_VERDICTS,
  DecisionShapeError,
  appendDecision,
  buildDecision,
  formatDecisionLine,
  readDecisions,
} from '../deploy-decision.mjs'

const AT = new Date('2026-10-25T12:00:00.000Z')
const OPT = { now: AT, host: 'test-host', pid: 4242 }
const SCRIPT = fileURLToPath(new URL('../deploy-decision.mjs', import.meta.url))

test('① 形状锁:闭集过、未知 action/verdict 拒', () => {
  for (const action of DECISION_ACTIONS) {
    assert.equal(buildDecision({ action }, OPT).action, action)
  }
  for (const gateVerdict of DECISION_VERDICTS) {
    assert.equal(buildDecision({ action: 'pass', gateVerdict }, OPT).gateVerdict, gateVerdict)
  }
  assert.throws(() => buildDecision({ action: 'auto-heal' }, OPT), DecisionShapeError)
  assert.throws(() => buildDecision({}, OPT), DecisionShapeError)
  assert.throws(() => buildDecision({ action: 'pass', gateVerdict: 'maybe' }, OPT), DecisionShapeError)
  assert.throws(() => buildDecision({ action: 'pass', shadowRc: 'ok' }, OPT), DecisionShapeError)
  assert.equal(buildDecision({ action: 'build-fail' }, OPT).gateVerdict, 'not-run')
})

test('② 回滚三件套与 dims 归一(去重/切分/上限)', () => {
  const d = buildDecision(
    {
      action: 'rollback',
      sha: 'c05ca0d5',
      prevSha: '8486d01d',
      rollbackBuildId: 'bld-20261025',
      gateVerdict: 'fail',
      failDims: ' web , api,web ,, ',
      shadowRc: '1',
    },
    OPT,
  )
  assert.equal(d.v, 1)
  assert.equal(d.ts, AT.toISOString())
  assert.equal(d.prevSha, '8486d01d')
  assert.equal(d.rollbackBuildId, 'bld-20261025')
  assert.deepEqual(d.failDims, ['web', 'api'])
  assert.equal(d.shadowRc, 1)
  assert.equal(d.host, 'test-host')
  assert.equal(d.pid, 4242)

  const many = buildDecision({ action: 'pass', failDims: Array.from({ length: 20 }, (_, i) => `d${i}`) }, OPT)
  assert.equal(many.failDims.length, 12)
})

test('③ 未判定语义:坏 sha 标 undetermined,未给 sha 保持空串;reason 折叠截断', () => {
  const bad = buildDecision({ action: 'build-fail', sha: 'not-a-sha' }, OPT)
  assert.equal(bad.sha, 'undetermined(not-a-sha)')
  assert.equal(buildDecision({ action: 'build-fail' }, OPT).sha, '')
  const noisy = buildDecision({ action: 'build-fail', reason: `err\nC:\\a\\b ${'x'.repeat(600)}` }, OPT)
  assert.ok(!noisy.reason.includes('\n'))
  assert.ok(noisy.reason.length <= 401)
})

test('④ 台账只追加:坏行不参与统计,机器行单行可解析', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-decision-'))
  try {
    const ledger = join(dir, 'nested', 'decisions.jsonl')
    const a = buildDecision({ action: 'pass', sha: 'c05ca0d5' }, OPT)
    appendDecision(ledger, a)
    appendDecision(ledger, buildDecision({ action: 'rollback', sha: 'c05ca0d5', prevSha: '8486d01d' }, OPT))
    const lines = readFileSync(ledger, 'utf8').trim().split(/\r?\n/)
    assert.equal(lines.length, 2)
    assert.equal(readDecisions(ledger).length, 2)

    // 半截行/坏行/旧版本行都不得让整本台账作废
    writeFileSync(ledger, `${readFileSync(ledger, 'utf8')}{"v":2,"action":"pass"}\nhalf-line\n`, 'utf8')
    assert.equal(readDecisions(ledger).length, 2)
    assert.deepEqual(readDecisions(join(dir, 'missing.jsonl')), [])

    const line = formatDecisionLine(a)
    assert.ok(line.startsWith('DEPLOY-DECISION '))
    assert.ok(!line.includes('\n'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('⑤ CLI:非法参数 rc=2、--dry-run 不落盘、正常 rc=0 且落盘', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-decision-cli-'))
  try {
    const ledger = join(dir, 'decisions.jsonl')
    const bad = spawnSync(process.execPath, [SCRIPT, '--action', 'auto-heal', '--ledger', ledger], { encoding: 'utf8' })
    assert.equal(bad.status, 2)
    assert.match(bad.stderr, /DEPLOY-DECISION-ERROR/)

    const dry = spawnSync(
      process.execPath,
      [SCRIPT, '--action', 'pass', '--sha', 'c05ca0d5', '--verdict', 'pass', '--ledger', ledger, '--dry-run'],
      { encoding: 'utf8' },
    )
    assert.equal(dry.status, 0)
    assert.match(dry.stdout, /^DEPLOY-DECISION \{/)
    assert.deepEqual(readDecisions(ledger), [])

    const ok = spawnSync(
      process.execPath,
      [SCRIPT, '--action', 'rollback', '--sha', 'c05ca0d5', '--prev-sha', '8486d01d', '--verdict', 'fail', '--dims', 'web,llm', '--shadow-rc', '0', '--ledger', ledger],
      { encoding: 'utf8' },
    )
    assert.equal(ok.status, 0)
    const rows = readDecisions(ledger)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].action, 'rollback')
    assert.deepEqual(rows[0].failDims, ['web', 'llm'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
