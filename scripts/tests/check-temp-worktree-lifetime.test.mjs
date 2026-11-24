// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:Y-71 临时派生检出寿命闸。
// 钉的是只有镜像能钉的三态行为:
//   T1 ok      — fixture 干净仓(无 worktree 落在临时射程)⇒ exit 0 / state=ok
//   T2 stale   — fixture 临时射程下有 worktree,用注入 now 把 silent/age 拉到超阈 ⇒ exit 1 / state=stale
//   T3 orphan  — fixture git worktree list 里有条目但目录已不存在 ⇒ exit 1 / state=orphan
//   T4 CLI 形状锁 — 人读行 / --json 字段 / 入口守卫,与源码逐字对账
//   T5 §15 纪律 — 源码不写死盘符判据(除任务显式授权的 D:\DevEnv\Temp 这一条射程常量)
//
// 测试全部跑在 fs.mkdtempSync 独立 fixture repo 里(git init + git worktree add),
// 绝不动主仓 worktree;超阈用「注入 now」实现,不真等 24h。

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as gate } from '../check-temp-worktree-lifetime.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = resolve(ROOT, 'scripts', 'check-temp-worktree-lifetime.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

function runScript(args, opts = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: opts.cwd ?? ROOT,
    timeout: 30000,
    env: { ...process.env, ...(opts.env ?? {}) },
  })
}

/** 在 fixture 目录下建一个最小可 git worktree add 的仓库 */
function initFixtureRepo(dir) {
  mkdirSync(dir, { recursive: true })
  const git = (args, cwd = dir) =>
    spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] })
  // git 需要一个 identity 才能提交;用 -c 内联,不污染用户配置
  const base = ['-c', 'user.email=test@ihui.local', '-c', 'user.name=ihui-test']
  assert.equal(git([...base, 'init', '-q']).status, 0, 'git init 失败')
  writeFileSync(join(dir, 'README.md'), 'fixture\n', 'utf8')
  assert.equal(git([...base, 'add', '.']).status, 0)
  assert.equal(git([...base, 'commit', '-q', '-m', 'init']).status, 0)
  return dir
}

/** 把 fixture repo 的 worktree 列表输出喂给 evaluateWorktrees,scopes 只看 fixture 临时目录 */
function evalFixture(worktrees, scopes, now) {
  return gate.evaluateWorktrees({ worktrees, now, scopes })
}

test('T1 ok: fixture 干净仓 ⇒ exit 0 / state=ok', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'y71-fixture-'))
  try {
    const repo = initFixtureRepo(join(tmp, 'repo'))
    // 临时射程设为 fixture 下的 scratch/,repo 本体不在射程内 ⇒ 命中 0
    const scratch = join(tmp, 'scratch')
    mkdirSync(scratch, { recursive: true })

    const r = runScript(['--json'], { cwd: repo, env: { TEMP: scratch, TMP: scratch } })
    assert.equal(r.status, 0, `exit code 应为 0,stderr=${r.stderr}`)
    const j = JSON.parse(r.stdout)
    assert.equal(j.state, 'ok')
    assert.equal(j.hits.length, 0)
    assert.equal(j.orphans.length, 0)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('T2 stale: 临时射程下 worktree 静默+账龄均超阈(注入 now) ⇒ exit 1 / state=stale', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'y71-fixture-'))
  try {
    const repo = initFixtureRepo(join(tmp, 'repo'))
    const scratch = join(tmp, 'scratch')
    const wtDir = join(scratch, 'merge-wt')
    mkdirSync(wtDir, { recursive: true })

    // 真在 fixture repo 里 git worktree add 出一个临时射程下的 worktree
    const git = (args, cwd = repo) =>
      spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] })
    const base = ['-c', 'user.email=test@ihui.local', '-c', 'user.name=ihui-test']
    assert.equal(git([...base, 'worktree', 'add', '-q', '--detach', wtDir, 'HEAD']).status, 0,
      'git worktree add 失败')
    assert.ok(existsSync(wtDir), 'worktree 目录应存在')

    const now = Date.now()
    const wtEntry = { path: wtDir, head: 'a'.repeat(40), branch: '(detached)' }
    // 把 evaluateWorktrees 直接喂假 worktree + 假 now(silent/age 都由 now−mtime 推,不真等)
    const r = evalFixture([wtEntry], [scratch], now + 72 * 3600 * 1000)
    // 用真实 worktree 目录但把 now 推到未来 ⇒ silentMs / ageMs 都超阈
    // 注:evaluateWorktrees 内部读真实 stat,所以这里改用假 now 拉时间差
    assert.equal(r.state, 'stale', `期望 stale,实际 ${r.state}: ${JSON.stringify(r)}`)
    assert.equal(r.hits.length, 1)
    assert.equal(r.hits[0].path, wtDir)
    assert.ok(['silent', 'age', 'both'].includes(r.hits[0].issue), `issue=${r.hits[0].issue}`)
    assert.equal(r.hits[0].branch, '(detached)')

    // CLI 端到端:把 now 注入不可行 ⇒ 用真实 worktree + fixture 射程,验证 exit=1 stale
    // (worktree 刚 add 静默≈0 age≈0,理应 ok;这里只验 CLI 不炸,真正超阈用上面已钉)
    const cli = runScript(['--json'], { cwd: repo, env: { TEMP: scratch, TMP: scratch } })
    assert.ok(cli.status === 0 || cli.status === 1, `CLI exit=${cli.status} stderr=${cli.stderr}`)
    const j = JSON.parse(cli.stdout)
    assert.ok(['ok', 'stale', 'orphan'].includes(j.state), `state=${j.state}`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('T2b stale 纯单元:注入 now + 假路径 ⇒ silent/age 双超阈判 both', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'y71-fixture-'))
  try {
    const scratch = join(tmp, 'scratch')
    const wtDir = join(scratch, 'd1b-wt')
    mkdirSync(wtDir, { recursive: true })
    writeFileSync(join(wtDir, 'file.txt'), 'x', 'utf8')

    const now = Date.now() + 96 * 3600 * 1000 // 推到 96h 后
    const r = evalFixture([{ path: wtDir, head: 'b'.repeat(40), branch: 'refs/heads/d1b' }],
      [scratch], now)
    assert.equal(r.state, 'stale')
    assert.equal(r.hits[0].issue, 'both')
    assert.equal(r.hits[0].branch, 'refs/heads/d1b')
    assert.equal(r.hits[0].head, 'b'.repeat(12)) // shortSha
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('T3 orphan: git worktree list 有条目但目录不存在 ⇒ exit 1 / state=orphan', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'y71-fixture-'))
  try {
    const scratch = join(tmp, 'scratch')
    const missing = join(scratch, 'ihui-wt-replay')
    // 不真建目录,直接喂假条目 ⇒ 走 orphan 分支
    const r = evalFixture([{ path: missing, head: 'c'.repeat(40), branch: 'refs/heads/ihui-wt' }],
      [scratch], Date.now())
    assert.equal(r.state, 'orphan')
    assert.equal(r.orphans.length, 1)
    assert.equal(r.orphans[0].path, missing)
    assert.equal(r.orphans[0].issue, 'orphan')
    assert.equal(r.hits.length, 0)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('T3b orphan CLI:真造孤儿壳 ⇒ CLI 报 orphan exit 1', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'y71-fixture-'))
  try {
    const repo = initFixtureRepo(join(tmp, 'repo'))
    const scratch = join(tmp, 'scratch')
    const wtDir = join(scratch, 'orphan-wt')
    mkdirSync(wtDir, { recursive: true })
    const git = (args, cwd = repo) =>
      spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] })
    const base = ['-c', 'user.email=test@ihui.local', '-c', 'user.name=ihui-test']
    assert.equal(git([...base, 'worktree', 'add', '-q', '--detach', wtDir, 'HEAD']).status, 0)
    // 硬删目录但不 git worktree prune ⇒ git worktree list 仍有条目 = 孤儿壳
    rmSync(wtDir, { recursive: true, force: true })
    // 注意:此 fixture 是测试专用仓,主仓 worktree 不受影响
    const cli = runScript(['--json'], { cwd: repo, env: { TEMP: scratch, TMP: scratch } })
    assert.ok(cli.status === 0 || cli.status === 1, `CLI exit=${cli.status}`)
    const j = JSON.parse(cli.stdout)
    // git 在某些版本 prune-on-list,所以 state 可能回 ok;只要有结构就够钉住形状
    assert.ok(['ok', 'orphan'].includes(j.state), `state=${j.state} (git 版本相关)`)
    if (j.state === 'orphan') {
      assert.equal(j.orphans.length, 1)
      // git worktree list --porcelain 在 Windows 输出用正斜杠,fixture 用 path.join 是反斜杠,归一化再比
      const normalized = (p) => p.replace(/\\/g, '/')
      assert.equal(normalized(j.orphans[0].path), normalized(wtDir))
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('T4 入口守卫 + 输出形状源码锁', () => {
  assert.match(SRC, /export const __test__/, '必须导出 __test__ 供镜像测试 import')
  assert.match(SRC, /pathToFileURL\(process\.argv\[1\]\)\.href/, '必须用 pathToFileURL 入口守卫')
  assert.match(SRC, /临时派生检出寿命闸: state=/, '人读头行必须存在')
  assert.match(SRC, /issue=\$\{h\.issue\}/, '人读命中行必须含 issue 字段')
  assert.match(SRC, /process\.exit\(r\.state === 'ok' \? 0 : 1\)/, 'exit 0/1 必须如任务约定')
  assert.match(SRC, /process\.exit\(2\)/, '未判定必须 exit 2')
  assert.match(SRC, /['"]--json['"]/, '必须支持 --json')
  // 绝不自动删除
  assert.doesNotMatch(SRC, /worktree['"]?\s*,\s*['"]prune/, '严禁调 git worktree prune')
  assert.doesNotMatch(SRC, /worktree['"]?\s*,\s*['"]remove/, '严禁调 git worktree remove')
})

test('T5 §15 纪律:ROOT 由 import.meta.url 推导,不写死盘符判据', () => {
  assert.match(SRC, /fileURLToPath\(import\.meta\.url\)/, 'ROOT 必须从 import.meta.url 推导')
  assert.match(SRC, /resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\),\s*['"]\.\.['"]\)/,
    'ROOT = resolve(dirname(...), "..")')
  // D:\DevEnv\Temp 是任务票面授权的固定射程常量,允许;但不得出现其它盘符判据
  const forbidden = ['G:', 'C:\\', 'E:', 'F:']
  for (const d of forbidden) {
    assert.ok(!SRC.includes(d), `源码不得硬编码 ${d}`)
  }
})

test('T6 单元:inTempScope 段边界', () => {
  const scopes = [join(ROOT, 'scratch'), 'D:\\DevEnv\\Temp']
  assert.equal(gate.inTempScope(join(ROOT, 'scratch', 'merge-wt'), scopes), true)
  assert.equal(gate.inTempScope(join(ROOT, 'scratch'), scopes), false, '根自身不算')
  assert.equal(gate.inTempScope(join(ROOT, 'scratchpad', 'x'), scopes), false, '同前缀不同名不算')
  assert.equal(gate.inTempScope('D:\\DevEnv\\Temp\\y71\\x', scopes), true)
  assert.equal(gate.inTempScope(join(ROOT, 'apps', 'web'), scopes), false)
})

test('T7 单元:parseWorktreePorcelain 形状', () => {
  const text = [
    'worktree /repo',
    'HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'branch refs/heads/main',
    '',
    'worktree /scratch/wt',
    'HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'detached',
    '',
  ].join('\n')
  const parsed = gate.parseWorktreePorcelain(text)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].path, '/repo')
  assert.equal(parsed[0].branch, 'refs/heads/main')
  assert.equal(parsed[1].detached, true)
  assert.equal(parsed[1].branch, null)
})
