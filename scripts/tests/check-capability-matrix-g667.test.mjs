// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-capability-matrix-g667.test.mjs
/**
 * G-667 镜像测试:check-capability-matrix 的 J3 —— 被剪掉的矩阵格子必须带不变式。
 * 票面验收 = "剪一格不写理由即红":
 *   pruned 条目缺 invariant 且缺 guard → 红、点名 key;
 *   带非空 invariant → 绿;带非空 guard → 绿;invariant 为空串 → 红(空串不算数)。
 * 另钉 J3 免检的边界:pruned 墓碑 env 免 J1 幽灵检(env 不在代码里正是「已剪除」的本义),
 * 但同一 env 仍被活条目登记时不免检(墓碑不得拿来洗白活条目的幽灵红)。
 *
 * 纪律(§22c/§22d):直接 import 源脚本 export 的 collectMatrixEntries / runCheck,
 * 不复制实现;CLI 入口受 isDirectRun 守护,import 零副作用;夹具一律落 mkScratch
 * 临时目录,runCheck 显式传 root,绝不读真仓。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { collectMatrixEntries, runCheck } from '../check-capability-matrix.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'check-capability-matrix.mjs')

const liveEntry = (env) =>
  `    {"key": "${env.toLowerCase()}", "env": "${env}", "default": "false", "category": "开关类", "owner_module": "m", "doc_ref": "d", "reason_if_off": "默认关"},\n`
/** 墓碑条目:pruned 带(或补上)invariant/guard;over 为空 = 剪一格不写理由。 */
const tombstone = (over = '') =>
  `    {"key": "fixture_pruned", "env": "FIXTURE_PRUNED_ENABLED", "default": "false", "category": "开关类", "owner_module": "m", "doc_ref": "d", "reason_if_off": "已剪除", "pruned": "2026-09-30"${over}},\n`
const matrixSrc = (entries) => `CAPABILITY_MATRIX = [\n${entries.join('')}\n]\n`
/** 被扫代码:真读一个默认关 env(活条目的 J1/J2 都要有据)。 */
const FIXTURE_CODE = `import os\nA = os.environ.get("FIXTURE_REAL_ENABLED", "false")\n`

/** 夹具仓:写矩阵与被扫代码,跑 worktree 面 runCheck(与源脚本 selfTestRun 同形)。 */
function runScenario(entries, { fixtureCode = FIXTURE_CODE } = {}) {
  const dir = mkScratch('cap-matrix-g667-')
  try {
    const coreDir = join(dir, 'apps', 'ai-service', 'app', 'core')
    mkdirSync(coreDir, { recursive: true })
    writeFileSync(join(coreDir, 'capability_matrix.py'), matrixSrc(entries))
    writeFileSync(join(coreDir, 'fixture.py'), fixtureCode)
    return runCheck(dir)
  } finally {
    rmScratch(dir)
  }
}

test('M1 collectMatrixEntries 解析器:逐条目字段、pruned 三形态、注释里的条目不吸、注解声明同吃', () => {
  const src = matrixSrc([
    liveEntry('FIXTURE_REAL_ENABLED'),
    tombstone(`, "invariant": "读取点已随能力一并删除", "guard": "test_x 钉回归"`),
    '    # {"key": "ghost_in_comment", "env": "FIXTURE_COMMENT_ENABLED", "pruned": "2020-01-01"},\n',
    `    {"key": "bare_true", "env": "FIXTURE_BARE_ENABLED", "pruned": True, "invariant": "i"},\n`,
    `    {"key": "still_alive", "env": "FIXTURE_ALIVE_ENABLED", "pruned": ""},\n`,
  ])
  const entries = collectMatrixEntries(src)
  assert.equal(entries.length, 4, `注释里的条目不得被吸:${JSON.stringify(entries)}`)
  const prunedEntry = entries.find((e) => e.key === 'fixture_pruned')
  assert.ok(prunedEntry, '墓碑条目必须被逐条解析出来')
  assert.equal(prunedEntry.env, 'FIXTURE_PRUNED_ENABLED')
  assert.equal(prunedEntry.pruned, true)
  assert.equal(prunedEntry.invariant, '读取点已随能力一并删除')
  assert.equal(prunedEntry.guard, 'test_x 钉回归')
  assert.equal(
    entries.find((e) => e.key === 'bare_true').pruned,
    true,
    '裸 True 也是墓碑(J1 免检语义相同)',
  )
  assert.equal(
    entries.find((e) => e.key === 'still_alive').pruned,
    false,
    'pruned 空串 = 未剪除(格子还活着),不得吃到免检',
  )
  // 真文件的声明形态带类型注解,同样要能被切开
  const annotated =
    'CAPABILITY_MATRIX: list[dict] = [\n    {"key": "k", "env": "E", "pruned": "2026-09-30", "invariant": "i"},\n]\n'
  assert.equal(collectMatrixEntries(annotated).length, 1)
})

test('M2 剪一格不写理由即红(票面验收):J3 点名 key,且墓碑 env 不得被 J1 幽灵陪绑', () => {
  const { errors } = runScenario([liveEntry('FIXTURE_REAL_ENABLED'), tombstone()])
  const j3 = errors.find((e) => e.includes('J3') && e.includes('fixture_pruned'))
  assert.ok(j3, `剪除无据的墓碑必须红并点名 key:${JSON.stringify(errors)}`)
  assert.match(j3, /invariant/, '报错必须说清缺口是不变式/护栏,不是泛泛的漂移')
  assert.equal(
    errors.length,
    1,
    `墓碑 env 不在代码里不得按 J1 幽灵陪绑(免检的代价由 J3 收):${JSON.stringify(errors)}`,
  )
})

test('M2b 出口是真的:同一格写非空 invariant 或只写 guard ⇒ 绿', () => {
  for (const [over, label] of [
    [`, "invariant": "env 读取点已随能力一并删除,全仓无残留分支"`, 'invariant'],
    [`, "guard": "test_capabilities_no_orphan_env 钉住不缺角回归"`, 'guard'],
  ]) {
    const { errors } = runScenario([liveEntry('FIXTURE_REAL_ENABLED'), tombstone(over)])
    assert.deepEqual(errors, [], `带理由的墓碑必须绿(${label}):${JSON.stringify(errors)}`)
  }
})

test('M2c invariant 为空串不算数 → 红(空串与缺字段同罪,不得用占位串过关)', () => {
  const { errors } = runScenario([liveEntry('FIXTURE_REAL_ENABLED'), tombstone(', "invariant": ""')])
  assert.ok(
    errors.some((e) => e.includes('J3') && e.includes('fixture_pruned')),
    `空串 invariant 必须照红:${JSON.stringify(errors)}`,
  )
})

test('M3 pruned 墓碑 env 免 J1:矩阵只剩墓碑、代码里无任何 env ⇒ 整门绿', () => {
  const { errors, stats } = runScenario([tombstone(`, "invariant": "读取点已删除"`)], {
    fixtureCode: 'A = 1\n',
  })
  assert.deepEqual(
    errors,
    [],
    `env 不在代码里正是「已剪除」的本义,不得按幽灵判红:${JSON.stringify(errors)}`,
  )
  assert.equal(stats.prunedEntries, 1, '墓碑计数必须如实报出')
})

test('M3b 同一 env 仍被活条目登记时不免检(墓碑不得洗白活条目的幽灵红)', () => {
  const env = 'FIXTURE_LAUNDERED_ENABLED'
  const { errors } = runScenario(
    [liveEntry(env), tombstone(`, "invariant": "读取点已删除"`).replace('FIXTURE_PRUNED_ENABLED', env)],
    { fixtureCode: 'A = 1\n' },
  )
  assert.ok(
    errors.some((e) => e.includes('J1') && e.includes(env)),
    `活条目的 env 必须照常按幽灵判红:${JSON.stringify(errors)}`,
  )
  assert.equal(
    errors.length,
    1,
    `J3 不得陪绑(墓碑本身带了 invariant):${JSON.stringify(errors)}`,
  )
})

test('M4 源脚本 --self-test 仍全绿(J1/J2/J3 红+绿咬合,主体没被镜像侧破坏)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 64 << 20,
  })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
