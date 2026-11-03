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

// bash 解析:Windows 本机 PATH 常不含 bash(Git 装机自带但不入 PATH),裸 'bash' 会让全部
// 真跑用例环境性红(CI windows-latest 上 bash 在 PATH ⇒ 本地红/CI 绿两处形态不一致,2026-10-16
// 全量套件实证)。与 gitdir.mjs resolveGitBin 同族:显式候选在前,PATH 兜底。
const BASH =
  ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files (x86)/Git/bin/bash.exe'].find((p) =>
    existsSync(p),
  ) ?? 'bash'

function runTriage(env, cwd) {
  return spawnSync(BASH, [SCRIPT], {
    env: { ...process.env, ...env },
    cwd,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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
  mkdirSync(join(dir, 'sub'), { recursive: true })
  const wfPath = join(dir, 'fixture.yml')
  writeFileSync(wfPath, wfText, 'utf8')
  return { dir, wfPath }
}

// 带 working-directory 的夹具:命令只在 sub/ 下落标记,退回仓库根就会写错位置。
const WORKDIR_WF = [
  'name: triage-workdir-fixture',
  'jobs:',
  '  fixture-job:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: Scoped step',
  '        id: alpha',
  '        working-directory: sub',
  '        run: echo MARKER-wd > MARKER-wd.txt',
  '',
].join('\n')

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
  assert.equal(
    existsSync(join(dir, 'MARKER-alpha.txt')),
    true,
    'MARKER-alpha must exist (command really ran)',
  )
  assert.equal(
    existsSync(join(dir, 'MARKER-beta.txt')),
    false,
    'succeeding step must NOT be re-run',
  )
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
  assert.doesNotMatch(
    r.stdout,
    /re-running ONLY this command/,
    'block scalar must NOT be guessed and re-run',
  )
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
    'uses-before-id': ['      - uses: actions/checkout@v4', '        id: alpha', ''],
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
    assert.match(
      r.stdout,
      /is an action step - there is no run command to re-execute/,
      `shape=${shape}`,
    )
  }
})

// ── (a3) working-directory 必须被尊重:重跑落在步骤自己的目录,绝不退回仓库根 ───────────
test('a3: working-directory is honored - rerun lands in the step scope, never repo root', () => {
  const { dir, wfPath } = setupCase('a3-workdir', WORKDIR_WF)
  const r = runTriage(
    { ...IDS_ENV, TRIAGE_WORKFLOW_FILE: wfPath, O_ALPHA: 'failure', O_BETA: '', O_GAMMA: '' },
    dir,
  )
  assert.equal(r.status, 0, `triage must exit 0; stderr=${r.stderr}`)
  assert.match(r.stdout, /honoring the step's working-directory: sub/)
  assert.equal(
    existsSync(join(dir, 'sub', 'MARKER-wd.txt')),
    true,
    'marker must land in sub/ (step scope)',
  )
  assert.equal(existsSync(join(dir, 'MARKER-wd.txt')), false, 'marker must NOT land at repo root')
})

// ── (a4) working-directory 缺失 ⇒ 拒绝重跑并点名,不得退回根目录制造第二份真相 ──────────
test('a4: missing working-directory => refuse to rerun, never fall back to repo root', () => {
  const wf = WORKDIR_WF.replace('working-directory: sub', 'working-directory: not-there')
  const { dir, wfPath } = setupCase('a4-missing-workdir', wf)
  const r = runTriage(
    { ...IDS_ENV, TRIAGE_WORKFLOW_FILE: wfPath, O_ALPHA: 'failure', O_BETA: '', O_GAMMA: '' },
    dir,
  )
  assert.equal(r.status, 0)
  assert.match(r.stdout, /working-directory 'not-there' does not exist/)
  assert.match(r.stdout, /refusing to rerun in the wrong scope/)
  assert.doesNotMatch(
    r.stdout,
    /re-running ONLY this command/,
    'must not rerun after scope resolution fails',
  )
  assert.equal(existsSync(join(dir, 'MARKER-wd.txt')), false)
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
    const env = {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPath,
      O_ALPHA: 'failure',
      O_BETA: '',
      O_GAMMA: '',
    }
    const envM = {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPathM,
      O_ALPHA: 'failure',
      O_BETA: '',
      O_GAMMA: '',
    }
    const good = runTriage(env, TMP)
    assert.equal(good.status, 0)
    const countAnnotated = (out) => (out.match(/\[alpha\] line-\d/g) || []).length
    assert.equal(countAnnotated(good.stdout), 5, 'original tail -n 60 must print all 5 lines')

    const mutantPath = join(TMP, 'mutant-tail.sh')
    const mutant = original.replace(/tail -n 60/, 'tail -n 2')
    assert.notEqual(mutant, original, 'mutation must actually apply')
    writeFileSync(mutantPath, mutant, 'utf8')
    const bad = spawnSync(BASH, [mutantPath], {
      env: { ...process.env, ...envM },
      cwd: TMP,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(bad.status, 0)
    assert.equal(
      countAnnotated(bad.stdout),
      2,
      'mutant must lose lines => the 5-line assertion flips red against it',
    )
  }

  // d2) "第一个 failure"判序被改坏(去掉 -z 守卫 ⇒ 最后一个 failure 胜出):点名从 alpha 漂成 beta。
  {
    const { wfPath } = setupCase('d2-orig', FIXTURE_WF)
    const { wfPath: wfPathM } = setupCase('d2-mutant', FIXTURE_WF)
    const env = {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPath,
      O_ALPHA: 'failure',
      O_BETA: 'failure',
      O_GAMMA: 'success',
    }
    const envM = {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPathM,
      O_ALPHA: 'failure',
      O_BETA: 'failure',
      O_GAMMA: 'success',
    }
    const good = runTriage(env, TMP)
    assert.match(
      good.stdout,
      /first failing step is \[alpha\]/,
      'first failure must win in job order',
    )

    const mutantPath = join(TMP, 'mutant-order.sh')
    const mutant = original.replace(
      /if \[ -z "\$FAILED_ID" \] && \[ "\$OUTCOME" = "failure" \]; then/,
      'if [ "$OUTCOME" = "failure" ]; then',
    )
    assert.notEqual(mutant, original, 'mutation must actually apply')
    writeFileSync(mutantPath, mutant, 'utf8')
    const bad = spawnSync(BASH, [mutantPath], {
      env: { ...process.env, ...envM },
      cwd: TMP,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.doesNotMatch(bad.stdout, /first failing step is \[alpha\]/)
    assert.match(
      bad.stdout,
      /first failing step is \[beta\]/,
      'broken ordering must flip the alpha assertion red',
    )
  }

  // d3) working-directory 作用域被改坏(去掉 cd 前缀 ⇒ 退回仓库根):a3 的"标记落 sub/"必须翻红。
  {
    const { dir, wfPath } = setupCase('d3-orig', WORKDIR_WF)
    const { dir: dirM, wfPath: wfPathM } = setupCase('d3-mutant', WORKDIR_WF)
    const env = {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPath,
      O_ALPHA: 'failure',
      O_BETA: '',
      O_GAMMA: '',
    }
    const envM = {
      ...IDS_ENV,
      TRIAGE_WORKFLOW_FILE: wfPathM,
      O_ALPHA: 'failure',
      O_BETA: '',
      O_GAMMA: '',
    }
    const good = runTriage(env, dir)
    assert.equal(good.status, 0, 'original script must exit 0')
    assert.equal(
      existsSync(join(dir, 'sub', 'MARKER-wd.txt')),
      true,
      'original must run inside sub/',
    )

    const mutantPath = join(TMP, 'mutant-workdir.sh')
    const mutant = original.replace(
      '( cd -- "$WORKDIR" && bash -c "$RUN_CMD" )',
      'bash -c "$RUN_CMD"',
    )
    assert.notEqual(mutant, original, 'mutation must actually apply')
    writeFileSync(mutantPath, mutant, 'utf8')
    const bad = spawnSync(BASH, [mutantPath], {
      env: { ...process.env, ...envM },
      cwd: dirM,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(bad.status, 0)
    assert.equal(
      existsSync(join(dirM, 'sub', 'MARKER-wd.txt')),
      false,
      'mutant must lose the step scope',
    )
    assert.equal(
      existsSync(join(dirM, 'MARKER-wd.txt')),
      true,
      'mutant must fall back to repo root => a3 flips red',
    )
  }

  // 还原证明:原件从未被写,哈希逐字不变(变异只发生在 TMP 里的副本)。
  assert.equal(
    sha256(readFileSync(SCRIPT, 'utf8')),
    originalSha,
    'original script must stay byte-identical',
  )
})

// ── 源码锁:ci.yml 里不得再存在内联 triage 实现体(防两份实现并存)──────────────────────
test('source lock: ci.yml must call the shared script, never inline a second implementation', () => {
  const ci = readFileSync(CI_YML, 'utf8')
  // 两个特征串都只存在于旧内联实现体(2026-09-28 抽取前的版本),任何一份重现即锁翻红。
  assert.equal(
    ci.includes('probe checkout "$O_CHECKOUT"'),
    false,
    'inline probe() table must not come back',
  )
  assert.equal(
    ci.includes('DUMP="$DUMP $1=$2"'),
    false,
    'inline probe accumulator must not come back',
  )
  // 正向锁:调用点必须真在(防"抽走了却没人调")。
  assert.match(ci, /run: bash scripts\/ci-failure-triage\.sh/)
  assert.match(ci, /唯一实现:scripts\/ci-failure-triage\.sh/)
})

// ── 装车锁:四个工作流都真调用了共享脚本(调用点在,不是只写了脚本)────────────────────
test('wiring lock: every target workflow invokes the shared script under if: failure()', () => {
  for (const rel of TARGET_WORKFLOWS) {
    const text = readFileSync(join(ROOT, rel), 'utf8')
    assert.match(
      text,
      /run: bash scripts\/ci-failure-triage\.sh/,
      `${rel} must call the shared script`,
    )
    assert.match(text, /if: failure\(\)/, `${rel} triage step must be failure()-gated`)
    assert.match(text, /TRIAGE_WORKFLOW_FILE: /, `${rel} must pass its own file`)
    assert.match(text, /TRIAGE_IDS: /, `${rel} must pass the step-id list`)
    // 调用数必须与 triage 步骤名/TRIAGE_IDS 数三量对齐(防悬空调用、防一个作业写两份分诊、
    // 防只添 env 没添步骤)。曾写死 calls===1 —— 当时各 workflow 单 job,ci-monorepo 长出
    // 多 job 后该锁恒红(2026-10-16 全量套件实证的预存漂移,此处保意图修形)。
    const calls = (text.match(/bash scripts\/ci-failure-triage\.sh/g) || []).length
    const steps = (text.match(/name: Failure triage \(public annotations\)/g) || []).length
    const ids = (text.match(/TRIAGE_IDS: /g) || []).length
    assert.ok(calls >= 1, `${rel} must invoke the shared script at least once`)
    assert.equal(
      calls,
      steps,
      `${rel} 每次调用必须配对一个 "Failure triage (public annotations)" 步骤`,
    )
    assert.equal(calls, ids, `${rel} 每次调用必须配对一份 TRIAGE_IDS`)
    // 接 triage 不得顺手加 continue-on-error(判 triage 步骤块自身 —— ci.yml 在
    // python-ai-service 作业里本就有一处历史 continue-on-error: true,不属本次接线)。
    const start = text.indexOf('name: Failure triage (public annotations)')
    assert.notEqual(start, -1, `${rel} must contain the triage step`)
    const end = text.indexOf('bash scripts/ci-failure-triage.sh', start)
    const triageBlock = text.slice(start, end)
    assert.equal(
      /continue-on-error/.test(triageBlock),
      false,
      `${rel} triage step must not gain continue-on-error`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
