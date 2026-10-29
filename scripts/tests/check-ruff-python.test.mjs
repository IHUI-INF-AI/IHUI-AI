// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 判据从**源模块**取(§22d 的 isDirectRun 保证 import 不触发 CLI 副作用),不在测试里再抄一份。
import { __test__ as ruffTest } from '../check-ruff-python.mjs'

const {
  ROOT,
  AI_REL,
  PYPROJECT_REL,
  parseRuffPin,
  ruffSpecFor,
  isRuffMaterializable,
  pickRuffPaths,
  faceSpecPrefix,
  resolveFace,
  classifyRuffOutcome,
  exitCodeFor,
  undeterminedReason,
  faceLabelOf,
  planStaged,
  stagedPythonChanges,
  resolveUvx,
  isEgressFailure,
  runRuff,
  probeUvx,
  judgeFace,
} = ruffTest

// ─── 夹具版本源与工具可用性(现读,不写死版本号) ───
const REPO_PIN = parseRuffPin(readFileSync(join(ROOT, PYPROJECT_REL), 'utf8'))
const UVX = probeUvx(resolveUvx())
const NO_PIN = REPO_PIN.ok ? false : `真仓 pyproject.toml 解析不到 ruff pin(${REPO_PIN.reason})`
const NO_UVX = UVX.ok ? false : `uvx 不在本机 PATH(${UVX.detail})`
const NO_REAL = NO_PIN || NO_UVX

const GIT_ID = [
  '-c',
  'user.email=ruff-gate@test.local',
  '-c',
  'user.name=ruff-gate',
  '-c',
  'commit.gpgsign=false',
]

function gitRun(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    // §12g:派生 git 必须显式接管 stdio
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  })
}

function writeFixture(dir, rel, text) {
  const abs = join(dir, ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function commitAll(dir, message) {
  gitRun(dir, [...GIT_ID, 'add', '-A', '--', '.'])
  gitRun(dir, [...GIT_ID, 'commit', '-q', '--no-verify', '-m', message])
}

function pyprojectWith(pin) {
  return [
    '[project]',
    'name = "ruff-gate-fixture"',
    'version = "0.0.0"',
    'requires-python = ">=3.12"',
    'dependencies = []',
    '',
    '[project.optional-dependencies]',
    'dev = [',
    `    "ruff==${pin}",`,
    ']',
    '',
    '[tool.ruff]',
    'line-length = 100',
    '',
  ].join('\n')
}

function makeRepo({ pin = REPO_PIN.version, python = true } = {}) {
  const dir = mkScratch('ruff-gate-test-')
  gitRun(dir, ['init', '-b', 'main'])
  writeFixture(dir, PYPROJECT_REL, pyprojectWith(pin))
  if (python) writeFixture(dir, `${AI_REL}/app/good.py`, 'VALUE = 1\n')
  commitAll(dir, 'fixture: init')
  return dir
}

function withRepo(opts, fn) {
  const dir = makeRepo(opts)
  try {
    return fn(dir)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

// ─── 1. 面选择(纯) ────────────────────────────────────
test('面选择:默认 HEAD,三档各归其面,两面旗同给 = 自相矛盾', () => {
  assert.equal(resolveFace([]).face, 'head')
  assert.equal(resolveFace(['--staged']).face, 'staged')
  assert.equal(resolveFace(['--worktree']).face, 'worktree')
  const both = resolveFace(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(both.error, /互斥/)
  assert.equal(faceSpecPrefix('staged'), ':')
  assert.equal(faceSpecPrefix('head'), 'HEAD:')
  assert.equal(faceSpecPrefix('worktree'), null)
  assert.notEqual(faceLabelOf('head'), faceLabelOf('worktree'))
})

// ─── 2. pin 解析(唯一源) ──────────────────────────────
test('pin 解析:唯一源是 pyproject 的 ruff==,注释与段名不算,多版本判未判定', () => {
  assert.equal(REPO_PIN.ok, true, REPO_PIN.reason)
  assert.match(REPO_PIN.version, /^\d+\.\d+\.\d+/)
  assert.equal(ruffSpecFor(REPO_PIN.version), `ruff==${REPO_PIN.version}`)
  assert.equal(ruffSpecFor(''), null)

  const onlyComments = parseRuffPin('# "ruff==9.9.9"\n[tool.ruff]\nline-length = 100\n')
  assert.equal(onlyComments.ok, false)
  assert.match(onlyComments.reason, /未找到/)

  const twoVersions = parseRuffPin('dev = [\n  "ruff==0.1.0",\n]\nci = [\n  "ruff==0.2.0",\n]\n')
  assert.equal(twoVersions.ok, false)
  assert.match(twoVersions.reason, /不同版本|不唯一/)

  assert.equal(parseRuffPin('').ok, false)
  assert.equal(parseRuffPin(null).ok, false)
})

// ─── 3. 退出码映射(未判定优先于红) ─────────────────────
test('退出码映射:0 无违规 / 1 有违规 / 2 其余,rc=1 无输出也落未判定', () => {
  const table = [
    [{ status: 0, stdout: 'All checks passed!' }, 'pass', 0],
    [{ status: 1, stdout: 'app/x.py:1:8: F401 unused' }, 'violations', 1],
    [{ status: 1, stdout: '' }, 'violations-silent', 2],
    [{ status: 2, stderr: 'config error' }, 'broken', 2],
    [{ status: null }, 'killed', 2],
    [{ status: null, signal: 'SIGTERM' }, 'killed', 2],
    [{ error: { code: 'ENOENT' } }, 'tool-missing', 2],
    [{ error: { code: 'EACCES' } }, 'tool-error', 2],
  ]
  for (const [input, kind, code] of table) {
    assert.equal(classifyRuffOutcome(input), kind, JSON.stringify(input))
    assert.equal(exitCodeFor(kind), code, kind)
  }
  assert.match(undeterminedReason('tool-missing', { exe: 'uvx' }), /uvx/)
  assert.match(undeterminedReason('violations-silent'), /无证据/)
})

// ─── 4. 物化面清单 ─────────────────────────────────────
test('物化面清单:Python 源 + ruff 配置源进面,别的端与文档不进', () => {
  assert.equal(isRuffMaterializable(PYPROJECT_REL), true)
  assert.equal(isRuffMaterializable(`${AI_REL}/app/x.py`), true)
  assert.equal(isRuffMaterializable(`${AI_REL}/app/x.pyi`), true)
  assert.equal(isRuffMaterializable(`${AI_REL}/notebooks/a.ipynb`), true)
  assert.equal(isRuffMaterializable(`${AI_REL}/ruff.toml`), true)
  assert.equal(isRuffMaterializable(`${AI_REL}/README.md`), false)
  assert.equal(isRuffMaterializable(`${AI_REL}/requirements.txt`), false)
  assert.equal(isRuffMaterializable('apps/api/src/x.py'), false)
  const picked = pickRuffPaths([
    PYPROJECT_REL,
    `${AI_REL}/app/x.py`,
    `${AI_REL}/README.md`,
    'apps/api/src/x.py',
  ])
  assert.deepEqual(picked, [PYPROJECT_REL, `${AI_REL}/app/x.py`])
  assert.deepEqual(pickRuffPaths(null), [])
})

// ─── 5. --staged 入场判定 ──────────────────────────────
test('planStaged:无 ai-service .py 改动 ⇒ 本档 skip 且 exit 0;非 .py 改动不算触发', () => {
  const empty = planStaged([])
  assert.equal(empty.skip, true)
  assert.equal(empty.code, 0)
  assert.match(empty.reason, /本档无相关暂存/)

  const docsOnly = planStaged([`${AI_REL}/pyproject.toml`, `${AI_REL}/README.md`])
  assert.equal(docsOnly.skip, true)

  const hit = planStaged([`${AI_REL}/app/x.py`, `${AI_REL}/README.md`])
  assert.equal(hit.skip, false)
  assert.equal(hit.code, null)
  assert.deepEqual(hit.changes, [`${AI_REL}/app/x.py`])

  assert.equal(planStaged(null).code, 2)
})

// ─── 6. 三面守恒(绿) ─────────────────────────────────
test('judgeFace 三面守恒(绿):同一内容三面结论一致且为 0', { skip: NO_REAL }, () => {
  withRepo({}, (dir) => {
    const codes = ['head', 'staged', 'worktree'].map((face) => judgeFace({ root: dir, face }).code)
    assert.deepEqual(codes, [0, 0, 0])
  })
})

// ─── 7. 面分治 + 红向 ─────────────────────────────────
test('judgeFace 面分治:在飞文件只进 worktree 面,入库后三面同红且含 F401', { skip: NO_REAL }, () => {
  withRepo({}, (dir) => {
    // 只写盘不 add:邻居在飞现场,索引面与 HEAD 面不得看见
    writeFixture(dir, `${AI_REL}/app/bad.py`, 'import os\n')
    assert.equal(judgeFace({ root: dir, face: 'worktree' }).code, 1)
    assert.equal(judgeFace({ root: dir, face: 'staged' }).code, 0)
    assert.equal(judgeFace({ root: dir, face: 'head' }).code, 0)

    // 入库后三面同红(红是真跑出来的,不是判据预设)
    commitAll(dir, 'fixture: violation')
    for (const face of ['head', 'staged', 'worktree']) {
      const v = judgeFace({ root: dir, face })
      assert.equal(v.code, 1, `${face} 应判红`)
      assert.equal(v.kind, 'violations')
      assert.match(v.output, /F401/)
    }
  })
})

// ─── 8. uvx 缺失 ⇒ 2(不回落 0/1) ─────────────────────
test('judgeFace uvx 缺失 ⇒ exit 2 且点名工具缺失', { skip: NO_PIN }, () => {
  withRepo({}, (dir) => {
    const v = judgeFace({ root: dir, face: 'head', uvx: 'ihui-no-such-uvx-xyz' })
    assert.equal(v.code, 2)
    assert.equal(v.kind, 'undetermined')
    assert.match(v.reason, /uvx/)
  })
})

// ─── 9. pin 解析失败 ⇒ 2 ──────────────────────────────
test('judgeFace pin 解析失败 ⇒ exit 2(不跑工具、不回落绿)', () => {
  withRepo({}, (dir) => {
    writeFixture(dir, PYPROJECT_REL, '[tool.ruff]\nline-length = 100\n')
    commitAll(dir, 'fixture: drop pin')
    const v = judgeFace({ root: dir, face: 'head', uvx: 'ihui-no-such-uvx-xyz' })
    assert.equal(v.code, 2)
    assert.equal(v.kind, 'undetermined')
    assert.match(v.reason, /pin/)
  })
})

// ─── 10. 面内 .py 枚举到 0 ⇒ 2 ────────────────────────
test('judgeFace 面内 .py 枚举到 0 ⇒ exit 2(§0.3,枚举到 0 判死)', { skip: NO_PIN }, () => {
  withRepo({ python: false }, (dir) => {
    const v = judgeFace({ root: dir, face: 'head', uvx: 'ihui-no-such-uvx-xyz' })
    assert.equal(v.code, 2)
    assert.match(v.reason, /0 个 \.py/)
  })
})

// ─── 11. 索引面改动清单 ───────────────────────────────
test('stagedPythonChanges:索引面 .py 改动可枚举,提交后为空', () => {
  withRepo({}, (dir) => {
    assert.deepEqual(stagedPythonChanges(dir), [])
    writeFixture(dir, `${AI_REL}/app/next.py`, 'VALUE = 2\n')
    gitRun(dir, [...GIT_ID, 'add', '--', `${AI_REL}/app/next.py`])
    assert.deepEqual(stagedPythonChanges(dir), [`${AI_REL}/app/next.py`])
    commitAll(dir, 'fixture: next')
    assert.deepEqual(stagedPythonChanges(dir), [])
  })
})

// ─── 12. 出网退路(2026-10-28 本机实测:uvx 走 Windows 系统代理,节点挂时对 pypi 报
// `tls handshake eof` rc=2,而 ruff==<pin> 已在 uv 本地缓存里 ⇒ "这条腿没通"不等于"判不了") ───
const NET_FAIL = {
  status: 2,
  stdout: '',
  stderr: 'error: Failed to fetch: `https://pypi.org/simple/ruff/`\n  Caused by: tls handshake eof',
  error: null,
  signal: null,
}
const ok = (status, text) => ({ status, stdout: text, stderr: '', error: null, signal: null })

/** 假 spawn:记下每条腿的实参,返回按"腿"预置的结果。真工具不出场,判据形状照样锁得住。 */
function fakeSpawn(table) {
  const calls = []
  const fn = (exe, args) => {
    const leg = args.includes('--offline') ? 'offline' : 'online'
    calls.push({ leg, args })
    return table[leg] ?? { ...NET_FAIL, stderr: 'fixture: 该腿未预置' }
  }
  fn.calls = calls
  return fn
}

test('isEgressFailure 只认传输层形状:rc0/rc1 都是结论、配置坏 rc2 不算网络、ENOENT 不算网络', () => {
  assert.equal(isEgressFailure(NET_FAIL), true)
  assert.equal(isEgressFailure(ok(0, 'All checks passed!')), false)
  assert.equal(isEgressFailure(ok(1, 'F401 [*] `os` imported but unused')), false)
  assert.equal(isEgressFailure({ ...NET_FAIL, stderr: "error: invalid rule name 'E999'" }), false)
  assert.equal(isEgressFailure({ status: null, error: { code: 'ENOENT' } }), false)
})

test('出网腿失败 ⇒ 同一 pin 补跑 --offline,缓存腿的结论就是判定(绿/红两向都照收)', () => {
  const green = fakeSpawn({ online: NET_FAIL, offline: ok(0, 'All checks passed!') })
  const r = runRuff({ dir: 'fixture', uvx: 'uvx', spec: 'ruff==9.9.9', spawn: green })
  assert.equal(r.status, 0)
  assert.equal(r.egress.used, true)
  assert.deepEqual(green.calls.map((c) => c.leg), ['online', 'offline'])
  assert.deepEqual(green.calls[1].args.slice(0, 2), ['--offline', 'ruff==9.9.9'])
  assert.equal(exitCodeFor(classifyRuffOutcome(r)), 0)

  const red = fakeSpawn({ online: NET_FAIL, offline: ok(1, 'F401 [*] `os` imported but unused') })
  const r2 = runRuff({ dir: 'fixture', uvx: 'uvx', spec: 'ruff==9.9.9', spawn: red })
  assert.equal(exitCodeFor(classifyRuffOutcome(r2)), 1)
  assert.equal(r2.egress.used, true)
})

test('反向锁:两腿都不通仍 exit 2;非网络形状的 rc=2 一律不补跑第二腿', () => {
  const both = fakeSpawn({
    online: NET_FAIL,
    offline: { ...NET_FAIL, stderr: 'error: `ruff==9.9.9` is not cached' },
  })
  const r = runRuff({ dir: 'fixture', uvx: 'uvx', spec: 'ruff==9.9.9', spawn: both })
  assert.equal(exitCodeFor(classifyRuffOutcome(r)), 2)
  assert.equal(r.egress.used, false)
  assert.equal(both.calls.length, 2)

  const cfg = fakeSpawn({ online: { ...ok(2, ''), stderr: "error: invalid rule name 'E999'" } })
  const r2 = runRuff({ dir: 'fixture', uvx: 'uvx', spec: 'ruff==9.9.9', spawn: cfg })
  assert.equal(cfg.calls.length, 1) // 摘掉形状判断(对任何 rc=2 都补跑)⇒ 本条必翻红
  assert.equal(r2.egress, undefined)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
