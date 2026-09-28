// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ci-failure-triage.sh 的镜像测试(node --test)。
// 设计红线(§22c"测试只复读实现就是复读机"):全部用例走**真 bash 真跑**或**真文件源码锁**,
// 不 import、不复读任何判据;变异组(d)证明断言有牙 —— 把脚本判据改坏一份副本,对应断言必须翻红。
// 临时件落点:.ihui-agent/tmp/ci-triage-shared/(任务授权落点,gitignored,收尾自删)。

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'ci-failure-triage.sh')
const CI_YML = join(ROOT, '.github', 'workflows', 'ci.yml')
const TARGET_WORKFLOWS = [
  '.github/workflows/ci.yml',
  '.github/workflows/ci-monorepo.yml',
  '.github/workflows/knip.yml',
  '.github/workflows/openapi-check.yml',
  '.github/workflows/i18n-dead-key-audit.yml',
]
const TMP = join(ROOT, '.ihui-agent', 'tmp', 'ci-triage-shared')

function runTriage(env, cwd) {
  return spawnSync('bash', [SCRIPT], {
    env: { ...process.env, ...env },
    cwd,
    encoding: 'utf8',
  })
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

// 三步夹具工作流:alpha(单行 run)/ beta(单行 run)/ gamma(多行块标量)。
const FIXTURE_WF = [
  'name: triage-fixture',
  'jobs:',
  '  fixture-job:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: First step',
  '        id: alpha',
  '        run: echo MARKER-alpha > MARKER-alpha.txt',
  '      - name: Second step',
  '        id: beta',
  '        run: echo MARKER-beta > MARKER-beta.txt',
  '      - name: Gamma block step',
  '        id: gamma',
  '        run: |',
  '          echo "block line 1"',
  '          echo "block line 2"',
  '',
].join('\n')

function setupCase(name, wfText) {
  const dir = join(TMP, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const wfPath = join(dir, 'fixture.yml')
  writeFileSync(wfPath, wfText, 'utf8')
  return { dir, wfPath }
}

const IDS_ENV = {
  TRIAGE_WORKFLOW_FILE: '', // per-case
  TRIAGE_IDS: 'alpha beta gamma',
}

test.before(() => {
  assert.equal(existsSync(SCRIPT), true, 'shared script must exist next to the tests')
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
})

test.after(() => {
  rmSync(TMP, { recursive: true, force: true })
})

// ── (a) 真 bash 真跑:第一个 failure 被点名,重跑命令被真的执行过 ──────────────────────
test('a: first failing step is named and its single-line run is actually re-executed', () => {
  const { dir, wfPath } = setupCase('a-rerun', FIXTURE_WF)
  const r = runTriage(
    {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPath,
      O_ALPHA: 'failure',
      O_BETA: 'success',
      O_GAMMA: 'success',
    },
    dir,
  )
  assert.equal(r.status, 0, `triage must exit 0; stderr=${r.stderr}`)
  assert.match(r.stdout, /first failing step is \[alpha\]/)
  assert.match(r.stdout, /First step/, 'display name must come from the workflow file itself')
  assert.match(r.stdout, /re-running ONLY this command: echo MARKER-alpha > MARKER-alpha\.txt/)
  // 重跑被真的执行过:夹具命令写的标记文件必须在,且只有失败那条被重跑。
  assert.equal(existsSync(join(dir, 'MARKER-alpha.txt')), true, 'MARKER-alpha must exist (command really ran)')
  assert.equal(existsSync(join(dir, 'MARKER-beta.txt')), false, 'succeeding step must NOT be re-run')
  assert.doesNotMatch(r.stdout, /rerun mapping missing/)
})

// ── (b) 无任何已知 id 报 failure ⇒ dump 分支,不得静默 exit 0 无输出 ──────────────────
test('b: no known id reports failure => dump-all-outcomes branch, never silent', () => {
  const { wfPath } = setupCase('b-dump', FIXTURE_WF)
  const r = runTriage(
    {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPath,
      O_ALPHA: 'success',
      O_BETA: 'success',
      O_GAMMA: 'skipped',
    },
    TMP,
  )
  assert.equal(r.status, 0)
  assert.notEqual(r.stdout.trim(), '', 'dump branch must print, not be silent')
  assert.match(r.stdout, /no known step reported outcome=failure/)
  assert.match(r.stdout, /all outcomes: ?alpha=success beta=success gamma=skipped/)
})

// ── (c) run: 是多行块标量 ⇒ 重跑映射缺失分支,点名步骤名,不猜 ────────────────────────
test('c: multi-line run block => mapping-missing branch naming the step, never guessing', () => {
  const { dir, wfPath } = setupCase('c-block', FIXTURE_WF)
  const r = runTriage(
    {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPath,
      O_ALPHA: 'success',
      O_BETA: 'success',
      O_GAMMA: 'failure',
    },
    dir,
  )
  assert.equal(r.status, 0)
  assert.match(r.stdout, /first failing step is \[gamma\]/)
  assert.match(r.stdout, /Gamma block step/, 'degraded branch must still name the failing step')
  assert.match(r.stdout, /rerun mapping missing \(rerun mapping missing\)|重跑映射缺失/)
  assert.match(r.stdout, /no single-line run: found after id: gamma/)
  assert.doesNotMatch(r.stdout, /re-running ONLY this command/, 'block scalar must NOT be guessed and re-run')
  assert.equal(existsSync(join(dir, 'MARKER-alpha.txt')), false)
})

// ── (a2) action 步骤(uses:)无可重跑命令 ⇒ 只点名,不冒充重跑 ─────────────────────────
// 两种书写形态都必须认:uses 在 id 之前(ci.yml 的 `- uses:` + `id:` 真实形态)与之后。
test('a2: action step (uses:) => honest "no run command to re-execute" branch', () => {
  const shapes = {
    'uses-after-id': [
      '      - name: The action',
      '        id: alpha',
      '        uses: actions/checkout@v4',
      '',
    ],
    'uses-before-id': [
      '      - uses: actions/checkout@v4',
      '        id: alpha',
      '',
    ],
  }
  for (const [shape, stepLines] of Object.entries(shapes)) {
    const wf = [
      'name: triage-fixture',
      'jobs:',
      '  fixture-job:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      ...stepLines,
    ].join('\n')
    const { wfPath } = setupCase(`a2-${shape}`, wf)
    const r = runTriage(
      { ...IDS_ENV, TRIAGE_WORKFLOW_FILE: wfPath, O_ALPHA: 'failure', O_BETA: '', O_GAMMA: '' },
      TMP,
    )
    assert.equal(r.status, 0, `shape=${shape}`)
    assert.match(r.stdout, /first failing step is \[alpha\]/, `shape=${shape}`)
    assert.match(r.stdout, /is an action step - there is no run command to re-execute/, `shape=${shape}`)
  }
})

// ── (d) 变异自证:把脚本判据改坏一份副本,对应断言必须翻红;原件逐字未动 ─────────────────
test('d: mutations prove the assertions have teeth; original untouched', () => {
  const original = readFileSync(SCRIPT, 'utf8')
  const originalSha = sha256(original)
  const multiRun = [
    'name: triage-fixture',
    'jobs:',
    '  fixture-job:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Noisy failing step',
    '        id: alpha',
    '        run: for i in 1 2 3 4 5; do echo line-$i; done',
    '',
  ].join('\n')

  // d1) 60 行截断被改坏(tail -n 60 → tail -n 2):5 行输出只印 2 行 ⇒ 断言翻红。
  {
    const { wfPath } = setupCase('d1-orig', multiRun)
    const { wfPath: wfPathM } = setupCase('d1-mutant', multiRun)
    const env = { ...IDS_ENV, TRIAGE_WORKFLOW_FILE: wfPath, O_ALPHA: 'failure', O_BETA: '', O_GAMMA: '' }
    const envM = { ...IDS_ENV, TRIAGE_WORKFLOW_FILE: wfPathM, O_ALPHA: 'failure', O_BETA: '', O_GAMMA: '' }
    const good = runTriage(env, TMP)
    assert.equal(good.status, 0)
    const countAnnotated = (out) => (out.match(/\[alpha\] line-\d/g) || []).length
    assert.equal(countAnnotated(good.stdout), 5, 'original tail -n 60 must print all 5 lines')

    const mutantPath = join(TMP, 'mutant-tail.sh')
    const mutant = original.replace(/tail -n 60/, 'tail -n 2')
    assert.notEqual(mutant, original, 'mutation must actually apply')
    writeFileSync(mutantPath, mutant, 'utf8')
    const bad = spawnSync('bash', [mutantPath], { env: { ...process.env, ...envM }, cwd: TMP, encoding: 'utf8' })
    assert.equal(bad.status, 0)
    assert.equal(countAnnotated(bad.stdout), 2, 'mutant must lose lines => the 5-line assertion flips red against it')
  }

  // d2) "第一个 failure"判序被改坏(去掉 -z 守卫 ⇒ 最后一个 failure 胜出):点名从 alpha 漂成 beta。
  {
    const { wfPath } = setupCase('d2-orig', FIXTURE_WF)
    const { wfPath: wfPathM } = setupCase('d2-mutant', FIXTURE_WF)
    const env = { ...IDS_ENV, TRIAGE_WORKFLOW_FILE: wfPath, O_ALPHA: 'failure', O_BETA: 'failure', O_GAMMA: 'success' }
    const envM = { ...IDS_ENV, TRIAGE_WORKFLOW_FILE: wfPathM, O_ALPHA: 'failure', O_BETA: 'failure', O_GAMMA: 'success' }
    const good = runTriage(env, TMP)
    assert.match(good.stdout, /first failing step is \[alpha\]/, 'first failure must win in job order')

    const mutantPath = join(TMP, 'mutant-order.sh')
    const mutant = original.replace(
      /if \[ -z "\$FAILED_ID" \] && \[ "\$OUTCOME" = "failure" \]; then/,
      'if [ "$OUTCOME" = "failure" ]; then',
    )
    assert.notEqual(mutant, original, 'mutation must actually apply')
    writeFileSync(mutantPath, mutant, 'utf8')
    const bad = spawnSync('bash', [mutantPath], { env: { ...process.env, ...envM }, cwd: TMP, encoding: 'utf8' })
    assert.doesNotMatch(bad.stdout, /first failing step is \[alpha\]/)
    assert.match(bad.stdout, /first failing step is \[beta\]/, 'broken ordering must flip the alpha assertion red')
  }

  // 还原证明:原件从未被写,哈希逐字不变(变异只发生在 TMP 里的副本)。
  assert.equal(sha256(readFileSync(SCRIPT, 'utf8')), originalSha, 'original script must stay byte-identical')
})

// ── 源码锁:ci.yml 里不得再存在内联 triage 实现体(防两份实现并存)──────────────────────
test('source lock: ci.yml must call the shared script, never inline a second implementation', () => {
  const ci = readFileSync(CI_YML, 'utf8')
  // 两个特征串都只存在于旧内联实现体(2026-09-28 抽取前的版本),任何一份重现即锁翻红。
  assert.equal(ci.includes('probe checkout "$O_CHECKOUT"'), false, 'inline probe() table must not come back')
  assert.equal(ci.includes('DUMP="$DUMP $1=$2"'), false, 'inline probe accumulator must not come back')
  // 正向锁:调用点必须真在(防"抽走了却没人调")。
  assert.match(ci, /run: bash scripts\/ci-failure-triage\.sh/)
  assert.match(ci, /唯一实现:scripts\/ci-failure-triage\.sh/)
})

// ── 装车锁:四个工作流都真调用了共享脚本(调用点在,不是只写了脚本)────────────────────
test('wiring lock: every target workflow invokes the shared script under if: failure()', () => {
  for (const rel of TARGET_WORKFLOWS) {
    const text = readFileSync(join(ROOT, rel), 'utf8')
    assert.match(text, /run: bash scripts\/ci-failure-triage\.sh/, `${rel} must call the shared script`)
    assert.match(text, /if: failure\(\)/, `${rel} triage step must be failure()-gated`)
    assert.match(text, /TRIAGE_WORKFLOW_FILE: /, `${rel} must pass its own file`)
    assert.match(text, /TRIAGE_IDS: /, `${rel} must pass the step-id list`)
    // 每个工作流恰一次调用(防一个作业里写两份分诊)。
    const calls = (text.match(/bash scripts\/ci-failure-triage\.sh/g) || []).length
    assert.equal(calls, 1, `${rel} must call the shared script exactly once`)
    // 接 triage 不得顺手加 continue-on-error(判 triage 步骤块自身 —— ci.yml 在
    // python-ai-service 作业里本就有一处历史 continue-on-error: true,不属本次接线)。
    const start = text.indexOf('name: Failure triage (public annotations)')
    assert.notEqual(start, -1, `${rel} must contain the triage step`)
    const end = text.indexOf('bash scripts/ci-failure-triage.sh', start)
    const triageBlock = text.slice(start, end)
    assert.equal(/continue-on-error/.test(triageBlock), false, `${rel} triage step must not gain continue-on-error`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
