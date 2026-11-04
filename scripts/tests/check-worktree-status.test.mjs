// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-worktree-status.mjs` 测试。钉:
 * ① 多工作树枚举(主树 + 附加树)与逐树计数;② 未暂存/未跟踪/冲突三种状态与 exit code;
 * ③ `--gate` 口径:主树脏阻断、仅附加树脏只告警;④ 全空 exit 0。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../check-worktree-status.mjs', import.meta.url))

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr || r.stdout}`)
  return r.stdout.trim()
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-wt-status-'))
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'ihui-test'])
  writeFileSync(join(dir, 'a.txt'), 'one\n')
  git(dir, ['add', 'a.txt'])
  git(dir, ['commit', '-m', 'init'])
  return dir
}

function run(dir, args = ['--json']) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', windowsHide: true })
  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    // 非 JSON 输出由调用方显式检查
  }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr }
}

test('① 主树+附加树全空:枚举 2 棵、计数全 0、exit 0', (t) => {
  const dir = makeRepo()
  const wtRoot = mkdtempSync(join(tmpdir(), 'ihui-wt-linked-'))
  t.after(() => {
    rmSync(wtRoot, { recursive: true, force: true })
    rmSync(dir, { recursive: true, force: true })
  })
  git(dir, ['worktree', 'add', join(wtRoot, 'wt'), '-b', 'wt-clean'])
  const r = run(dir)
  assert.equal(r.status, 0)
  assert.equal(r.json.trees.length, 2)
  assert.equal(r.json.trees[1].path.includes('wt'), true)
  assert.deepEqual(r.json.totals, { staged: 0, unstaged: 0, untracked: 0, conflicts: 0, stashes: 0 })
  assert.equal(r.json.clean, true)
})

test('② 附加树有未暂存+未跟踪:strict exit 1,--gate 只告警 exit 0', (t) => {
  const dir = makeRepo()
  const wtRoot = mkdtempSync(join(tmpdir(), 'ihui-wt-linked-'))
  t.after(() => {
    rmSync(wtRoot, { recursive: true, force: true })
    rmSync(dir, { recursive: true, force: true })
  })
  const wt = join(wtRoot, 'wt')
  git(dir, ['worktree', 'add', wt, '-b', 'wt-dirty'])
  writeFileSync(join(wt, 'a.txt'), 'one-changed\n')
  writeFileSync(join(wt, 'new.txt'), 'new\n')
  const strict = run(dir)
  assert.equal(strict.status, 1)
  assert.equal(strict.json.trees[1].unstaged, 1)
  assert.equal(strict.json.trees[1].untracked, 1)
  assert.equal(strict.json.mainDirty, false)
  assert.equal(strict.json.othersDirty, true)
  const gate = run(dir, ['--json', '--gate'])
  assert.equal(gate.status, 0)
  assert.equal(gate.json.ok, true)
})

test('③ 主树仅有暂存:strict exit 1;--gate 不阻断(暂存=本次提交)', (t) => {
  const dir = makeRepo()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, 'b.txt'), 'staged\n')
  git(dir, ['add', 'b.txt'])
  const strict = run(dir)
  assert.equal(strict.status, 1)
  assert.equal(strict.json.trees[0].staged, 1)
  const gate = run(dir, ['--json', '--gate'])
  assert.equal(gate.status, 0)
  assert.equal(gate.json.mainDirty, true)
  assert.equal(gate.json.mainResidualDirty, false)
  assert.equal(gate.json.ok, true)
})

test('③b 主树有未暂存:--gate 阻断 exit 1', (t) => {
  const dir = makeRepo()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, 'a.txt'), 'changed\n')
  const r = run(dir, ['--json', '--gate'])
  assert.equal(r.status, 1)
  assert.equal(r.json.trees[0].unstaged, 1)
  assert.equal(r.json.mainResidualDirty, true)
  assert.equal(r.json.ok, false)
})

test('④b 主树是分离 gitdir(指针式 .git):在附加树里调用不把调用树冒充主树', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'ihui-wt-sep-'))
  const gitDir = join(base, 'gitdir')
  const dir = join(base, 'main')
  mkdirSync(dir)
  const init = spawnSync('git', ['init', '-b', 'main', `--separate-git-dir=${gitDir}`, dir], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(init.status, 0, `git init --separate-git-dir 失败: ${init.stderr || init.stdout}`)
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'ihui-test'])
  writeFileSync(join(dir, 'a.txt'), 'one\n')
  git(dir, ['add', 'a.txt'])
  git(dir, ['commit', '-m', 'init'])
  const wtRoot = mkdtempSync(join(tmpdir(), 'ihui-wt-linked-'))
  const wt = join(wtRoot, 'wt')
  git(dir, ['worktree', 'add', wt, '-b', 'wt-clean'])
  t.after(() => {
    rmSync(wtRoot, { recursive: true, force: true })
    rmSync(base, { recursive: true, force: true })
  })
  // 从附加树里调用:主树行只印 gitdir,不可解析 ⇒ 必须标未判定,不能回落成这棵附加树。
  const r = run(wt, ['--json', '--gate'])
  assert.equal(r.status, 0)
  assert.equal(r.json.trees.length, 2)
  assert.equal(r.json.mainMeasured, false)
  assert.equal(r.json.mainDirty, null)
  assert.equal(r.json.unmeasured, 1)
  assert.equal(new Set(r.json.trees.map((x) => x.path)).size, 2, '工作树路径不得重复(同一棵树被列两次)')
  assert.equal(r.json.trees[0].unmeasured, true)
  assert.equal(r.json.trees[1].unmeasured, false)
  assert.equal(r.json.subjectPath, r.json.trees[1].path)
  assert.equal(r.json.subjectIsMain, false)
})

test('④ 主树合并冲突:conflict=1,strict exit 1', (t) => {
  const dir = makeRepo()
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  git(dir, ['checkout', '-b', 'side'])
  writeFileSync(join(dir, 'a.txt'), 'side\n')
  git(dir, ['commit', '-am', 'side'])
  git(dir, ['checkout', 'main'])
  writeFileSync(join(dir, 'a.txt'), 'main\n')
  git(dir, ['commit', '-am', 'main'])
  const merge = spawnSync('git', ['merge', 'side'], { cwd: dir, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.notEqual(merge.status, 0, '构造冲突的 merge 应失败')
  const r = run(dir)
  assert.equal(r.status, 1)
  assert.equal(r.json.trees[0].conflicts, 1)
  assert.equal(r.json.totals.conflicts, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
