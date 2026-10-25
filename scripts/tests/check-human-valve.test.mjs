// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-human-valve 镜像测试(§22c):判据只从生产脚本 import,这里不抄任何一份匹配规则或桶名。
 *
 * 覆盖:票面四类停机 + 本仓实测四类停机 + 三类自决 + 未知停机 + 停机优先 + 到期降级 +
 *       反向牙(数据新增一类而 lib 未认出来 ⇒ 必须停)+ 坏数据 ⇒ 未判定(exit 2)+ CLI 三档 RC。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as LIB } from '../lib/human-valve.mjs'
import { __test__ as CLI } from '../check-human-valve.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLI_PATH = resolve(HERE, '..', 'check-human-valve.mjs')
const TMP_DIR = resolve(HERE, '..', '..', '.ihui-agent', 'tmp', 'human-valve')
const TMP_BAD = join(TMP_DIR, 'bad-valve.json')
const {
  BUCKETS,
  UNKNOWN_RULE_ID,
  classifyAction,
  parseValveList,
  auditValveList,
  hasMatcher,
  isRealIsoDate,
} = LIB

const rawText = readFileSync(CLI.DATA_PATH, 'utf8')
const valveList = parseValveList(rawText)
const rules = valveList.rules
const rulesById = new Map(rules.map((rule) => [rule.id, rule]))

test('清单形状:六字段齐备、reviewBy 有效且未过期、id 唯一', () => {
  assert.ok(rules.length >= 8, `清单至少 8 类,实际 ${rules.length}`)
  const ids = rules.map((rule) => rule.id)
  assert.equal(new Set(ids).size, ids.length)
  const today = LIB.todayIso()
  for (const rule of rules) {
    assert.deepEqual(
      Object.keys(rule).sort(),
      ['bucket', 'examples', 'id', 'reviewBy', 'title', 'why'],
      `规则 ${rule.id} 字段集必须恰为票面六项`,
    )
    assert.ok(rule.examples.length > 0)
    assert.ok(isRealIsoDate(rule.reviewBy), `规则 ${rule.id} reviewBy=${rule.reviewBy} 非法`)
    assert.ok(rule.reviewBy >= today, `规则 ${rule.id} reviewBy=${rule.reviewBy} 已过期`)
  }
})

test('票面四类 + 本仓四类必须都在停机桶', () => {
  const requiredStop = [
    'api-key-change',
    'console-operation',
    'device-scan',
    'public-release-wording',
    'production-deploy',
    'credential-rotation',
    'destructive-git-or-data',
    'external-system-write',
  ]
  for (const id of requiredStop) {
    const rule = rulesById.get(id)
    assert.ok(rule, `清单缺停机类 ${id}`)
    assert.equal(rule.bucket, BUCKETS.STOP_FOR_HUMAN, `${id} 必须是 stop-for-human`)
    assert.ok(hasMatcher(id), `${id} 缺匹配器 ⇒ 该类永远判不到`)
  }
})

test('自决类必须有匹配器,且判据库没有孤儿匹配器(数据↔lib 双向对账)', () => {
  const audit = auditValveList(rules)
  assert.deepEqual(audit.problems, [], `清单对账问题:${audit.problems.join(' / ')}`)
  const selfServe = rules.filter((rule) => rule.bucket === BUCKETS.SELF_SERVE)
  assert.ok(selfServe.length >= 2, `自决类至少 2 类,实际 ${selfServe.length}`)
  for (const rule of selfServe) assert.ok(hasMatcher(rule.id))
})

test('票面四类停机逐条判停(例子文本取自清单,判据来自 lib)', () => {
  for (const id of [
    'api-key-change',
    'console-operation',
    'device-scan',
    'public-release-wording',
  ]) {
    const rule = rulesById.get(id)
    for (const example of rule.examples) {
      const verdict = classifyAction(example, { rules })
      assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN, `${id} 例子「${example}」未停机`)
      assert.equal(verdict.ruleId, id, `${id} 例子「${example}」命中了 ${verdict.ruleId}`)
    }
  }
})

test('至少两类自决', () => {
  const verdict = classifyAction('给脚本补一个纯函数并补单元测试', { rules })
  assert.equal(verdict.bucket, BUCKETS.SELF_SERVE)
  assert.equal(verdict.ruleId, 'code-and-docs')
  const probe = classifyAction('只读查询 git log 与守护日志', { rules })
  assert.equal(probe.bucket, BUCKETS.SELF_SERVE)
  assert.equal(probe.ruleId, 'read-only-probe')
  const gated = classifyAction('跑一遍守门看末行读数', { rules })
  assert.equal(gated.bucket, BUCKETS.SELF_SERVE)
  assert.equal(gated.ruleId, 'local-verification')
})

test('未知动作 / 空描述 / 规则表缺失 一律 fail-closed', () => {
  for (const text of ['把服务器搬到火星', '', '   ', '对 qzx 执行 zzz']) {
    const verdict = classifyAction(text, { rules })
    assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN, `「${text}」必须停机`)
    assert.equal(verdict.ruleId, UNKNOWN_RULE_ID)
  }
  assert.deepEqual(Object.keys(classifyAction('把服务器搬到火星', { rules })).sort(), [
    'bucket',
    'reason',
    'ruleId',
  ])
  assert.throws(() => classifyAction('改文档', { rules: [] }), /需要非空规则表/)
  assert.throws(() => classifyAction('改文档', {}), /需要非空规则表/)
})

test('停机优先于自决:同一句话里既改代码又换 key ⇒ 停', () => {
  const verdict = classifyAction('改完代码顺手把 API key 换掉', { rules })
  assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.equal(verdict.ruleId, 'api-key-change')
})

test('自决类 reviewBy 到期 ⇒ 自动降为停机(§0.7)', () => {
  const expired = rules.map((rule) =>
    rule.bucket === BUCKETS.SELF_SERVE ? { ...rule, reviewBy: '2000-01-01' } : rule,
  )
  const verdict = classifyAction('给脚本补一个纯函数并补单元测试', { rules: expired })
  assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.match(verdict.reason, /过期/)
})

test('反向牙:数据新增一类而 lib 没认出来 ⇒ 必须落 stop,不能凭数据自称 self-serve 放行', () => {
  const augmented = [
    ...rules,
    {
      id: 'brand-new-class',
      title: '新自决类',
      bucket: BUCKETS.SELF_SERVE,
      examples: ['执行 qzx 专有动作'],
      why: '夹具',
      reviewBy: '2099-12-31',
    },
  ]
  const verdict = classifyAction('执行 qzx 专有动作', { rules: augmented })
  assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.equal(verdict.ruleId, UNKNOWN_RULE_ID)
  assert.equal(auditValveList(augmented).ok, false, '新增无匹配器的自决类必须被对账报出来')
})

test('坏数据四型 ⇒ parseValveList 抛(调用方落 exit 2),不得静默当成空规则', () => {
  const bad = [
    '{ not json',
    JSON.stringify({ rules: [] }),
    JSON.stringify({
      rules: [
        { id: 'x', title: 'x', bucket: 'run', examples: ['x'], why: 'x', reviewBy: '2027-01-01' },
      ],
    }),
    JSON.stringify({
      rules: [
        {
          id: 'x',
          title: 'x',
          bucket: 'self-serve',
          examples: ['x'],
          why: 'x',
          reviewBy: '2026-02-31',
        },
      ],
    }),
    JSON.stringify({
      rules: [{ id: 'x', title: 'x', bucket: 'self-serve', examples: ['x'], why: 'x' }],
    }),
  ]
  for (const text of bad) assert.throws(() => parseValveList(text), /./, text)
})

test('CLI 三档 RC:stop 判定仍是 0、用法错 1、数据坏 2(未判定)', () => {
  const stopRun = spawnSync(
    process.execPath,
    [CLI_PATH, '--action', '把生产机的 API key 换掉', '--json'],
    {
      encoding: 'utf8',
    },
  )
  assert.equal(stopRun.status, 0, stopRun.stderr)
  const payload = JSON.parse(stopRun.stdout)
  assert.equal(payload.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.equal(payload.ruleId, 'api-key-change')

  const usageRun = spawnSync(process.execPath, [CLI_PATH, '--bogus'], { encoding: 'utf8' })
  assert.equal(usageRun.status, 1)

  const helpRun = spawnSync(process.execPath, [CLI_PATH, '--help'], { encoding: 'utf8' })
  assert.equal(helpRun.status, 0)
  assert.match(helpRun.stdout, /安全停机/)

  const noArgRun = spawnSync(process.execPath, [CLI_PATH], { encoding: 'utf8' })
  assert.equal(noArgRun.status, 0)
  assert.match(noArgRun.stdout, /用法/)

  mkdirSync(TMP_DIR, { recursive: true })
  writeFileSync(TMP_BAD, '{ broken', 'utf8')
  try {
    const badRun = spawnSync(process.execPath, [CLI_PATH, '--action', '改文档'], {
      encoding: 'utf8',
      env: { ...process.env, IHUI_HUMAN_VALVE_DATA: TMP_BAD },
    })
    assert.equal(badRun.status, 2, badRun.stdout + badRun.stderr)
    assert.match(badRun.stderr, /未判定/)
  } finally {
    rmSync(TMP_BAD, { force: true })
  }
})

test('自检本身在本数据上全绿(CLI 与测试同一实现)', () => {
  const report = CLI.runSelfTest({ data: valveList })
  assert.deepEqual(report.failures, [])
  assert.ok(report.results.length >= 8)
  assert.ok(CLI.SELF_TEST_CASES.length >= 8)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
