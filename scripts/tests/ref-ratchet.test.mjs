#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * main 引用棘轮的断言集（node:test）。
 *
 * 覆盖批复里的 10 条既有断言 + 2 条新增：
 *  - 递归闸门 / 新红阻断 / 存量红不拦 / 非变更面红不拦 / 非 main 与删除放行 / 坏 OID 放行
 *  - 台账 verify 抓手改·重复键·断链 / 47p 新红阻断 / 一次事务多行只判 main
 *  - liveness：伪造钩子崩溃、伪造心跳过期、台账缺失但有 seed 锚点 ⇒ 全部报红
 * 另加 undetermined-retry（超时一次不成永久豁免）与 E2E：真实 `git update-ref` 在**分支引用**上
 * 被钩子拦下再放行（绝不触碰 refs/heads/main）。
 *
 * 纪律：所有派生显式 `stdio: ['ignore','pipe','pipe']`（门 193 的判据盯的就是这个）；
 * 每个用例自带临时仓，互不影响；真实工作区的 main 一个字节都不碰。
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { classifyFindings, putLedger, readLedger, stateDir, verifyLedger, writeAnchor, writeHeartbeat, writeHookError, heartbeatPath } from '../lib/ref-ratchet-state.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const MAIN = join(REPO_ROOT, 'scripts', 'ref-ratchet-main.mjs')
const LEDGER_CLI = join(REPO_ROOT, 'scripts', 'ref-ratchet-ledger.mjs')
const LIVENESS = join(REPO_ROOT, 'scripts', 'check-ref-ratchet-liveness.mjs')
const HOOKS_DIR = join(REPO_ROOT, '.husky')
const ZERO = '0'.repeat(40)
const EVIL_SCRIPT = `import { execSync } from 'node:child_process'\n\nexport const run = () => execSync('git status')\n`

function git(repo, ...args) {
  const r = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${String(r.stderr ?? '').trim()}`)
  return String(r.stdout ?? '').trim()
}

function nodeRun(script, args, { cwd, env = {} } = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 600_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
}

function makeRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'ihui-ratchet-test-'))
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.email', 'ratchet@test.local')
  git(repo, 'config', 'user.name', 'ratchet-test')
  git(repo, 'config', 'commit.gpgsign', 'false')
  // 本机把 core.hooksPath 配在全局（真实仓的 .husky）。夹具必须**先**把本地钩子面置空，
  // 否则每次夹具 commit 都会真跑棘轮，测试彼此污染。需要钩子的用例最后再显式指回 .husky。
  const emptyHooks = join(repo, '.no-hooks')
  mkdirSync(emptyHooks, { recursive: true })
  git(repo, 'config', 'core.hooksPath', emptyHooks)
  write(repo, 'notes.txt', 'neutral\n')
  return { repo, base: commit(repo, 'base') }
}

function write(repo, rel, text) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true })
  writeFileSync(join(repo, rel), text)
}

function commit(repo, msg) {
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', msg)
  return git(repo, 'rev-parse', 'HEAD')
}

/** 跑编排器；默认对 main 引用。 */
function ratchet(repo, oldOid, newOid, { ref = 'refs/heads/main', env = {}, extra = [] } = {}) {
  return nodeRun(MAIN, ['--root', repo, '--old', oldOid, '--new', newOid, '--ref', ref, ...extra], { cwd: repo, env })
}

function ledgerOf(repo) {
  return readLedger(stateDir(repo))
}

// 负载机器上测试套件会互相争 CPU，"门跑完了但慢"会被 8s 预算折成 undetermined ⇒ fail-open，
// 于是测到的是预算而不是判据。测试显式放大预算（编排器支持同名 env，生产默认口径不变）。
const BIG_BUDGET = {
  IHUI_REF_RATCHET_GATE_BUDGET_MS: '600000',
  IHUI_REF_RATCHET_TOTAL_BUDGET_MS: '900000',
}

function cleanup(repo) {
  rmSync(repo, { recursive: true, force: true })
}

/**
 * watermark.mjs 把 ROOT 写死在自己的位置上，且拒绝跨仓 —— 47p 需要被判仓里有一份 scripts。
 * 测试用 junction 指向本工作区的 scripts（只读使用）；务必在夹具 commit 之后链接，避免 `add -A` 吞掉真树。
 */
function linkScripts(repo) {
  const target = join(repo, 'scripts')
  if (existsSync(target)) throw new Error('linkScripts 必须在夹具 commit 之后调用（scripts 不能已存在）')
  symlinkSync(join(REPO_ROOT, 'scripts'), target, 'junction')
}

test('递归闸门：IHUI_REF_TXN_MAIN_RATCHET=1 直接放行且不建台账', () => {
  const { repo } = makeRepo()
  try {
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const next = commit(repo, 'bad')
    const r = ratchet(repo, git(repo, 'rev-parse', 'HEAD~1'), next, { env: { IHUI_REF_TXN_MAIN_RATCHET: '1' } })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(existsSync(join(repo, '.git', 'ihui-ref-ratchet', 'ledger.jsonl')), false)
  } finally {
    cleanup(repo)
  }
})

test('新红阻断：新增 scripts 违规（193）拒绝 ref 更新，并记入台账', () => {
  const { repo, base } = makeRepo()
  try {
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const next = commit(repo, 'bad')
    const r = ratchet(repo, base, next)
    assert.equal(r.status, 1, `应阻断，实际 rc=${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /拒绝 ref 更新/)
    const led = ledgerOf(repo)
    assert.equal(led.errors.length, 0)
    assert.equal(led.entries.get('193\u0000scripts/bad.mjs')?.status, 'red')
  } finally {
    cleanup(repo)
  }
})

test('存量红不拦：同一批红再次落定时放行，并刷新 lastSeen', () => {
  const { repo, base } = makeRepo()
  try {
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const next = commit(repo, 'bad')
    assert.equal(ratchet(repo, base, next).status, 1)
    const before = ledgerOf(repo).entries.get('193\u0000scripts/bad.mjs')
    const r = ratchet(repo, base, next)
    assert.equal(r.status, 0, r.stdout)
    const after = ledgerOf(repo).entries.get('193\u0000scripts/bad.mjs')
    assert.equal(after.firstSeen, before.firstSeen, 'firstSeen 必须保持首次登记')
    assert.ok(after.lastSeen >= before.lastSeen)
  } finally {
    cleanup(repo)
  }
})

test('非变更面红不拦：只改无关文件时，别人的存量红只记账', () => {
  const { repo, base } = makeRepo()
  try {
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const bad = commit(repo, 'bad')
    assert.equal(ratchet(repo, base, bad).status, 1)
    write(repo, 'notes.txt', 'only notes\n')
    const neutral = commit(repo, 'notes only')
    const r = ratchet(repo, bad, neutral)
    assert.equal(r.status, 0, r.stdout)
  } finally {
    cleanup(repo)
  }
})

test('非 main 引用与删除引用放行（不得建立台账副作用）', () => {
  const { repo, base } = makeRepo()
  try {
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const next = commit(repo, 'bad')
    const other = ratchet(repo, base, next, { ref: 'refs/heads/other' })
    assert.equal(other.status, 0, other.stderr)
    assert.equal(existsSync(join(repo, '.git', 'ihui-ref-ratchet', 'ledger.jsonl')), false)

    const del = ratchet(repo, next, ZERO)
    assert.equal(del.status, 0, del.stderr)
  } finally {
    cleanup(repo)
  }
})

test('坏 OID 放行：非 40 位或 new=0 一律不判', () => {
  const { repo } = makeRepo()
  try {
    assert.equal(ratchet(repo, 'not-a-sha', 'also-not', {}).status, 0)
    assert.equal(ratchet(repo, git(repo, 'rev-parse', 'HEAD'), ZERO).status, 0)
  } finally {
    cleanup(repo)
  }
})

test('台账 verify：手改一行 / 重复键 / 有锚点无台账 全部判红', () => {
  const { repo, base } = makeRepo()
  try {
    const dir = stateDir(repo)
    writeAnchor(dir, { seedAt: new Date().toISOString(), seedSha: base })
    let r = nodeRun(LEDGER_CLI, ['--verify', '--root', repo], { cwd: repo })
    assert.equal(r.status, 1, '有锚点无台账必须非零')
    assert.match(r.stderr, /台账缺失/)

    putLedger(dir, [{ gate: '193', path: 'scripts/x.mjs', status: 'red', lastSeen: new Date().toISOString() }])
    r = nodeRun(LEDGER_CLI, ['--verify', '--root', repo], { cwd: repo })
    assert.equal(r.status, 0, r.stderr)

    const file = join(dir, 'ledger.jsonl')
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean)
    writeFileSync(file, `${lines[0].replace('"status":"red"', '"status":"undetermined"')}\n`)
    r = nodeRun(LEDGER_CLI, ['--verify', '--root', repo], { cwd: repo })
    assert.equal(r.status, 1, '手改一行必须断链')

    // 手改后账已断链，写入必须被拒（这正是"手改不许静默通过"的另一半）；
    // 恢复现场再验重复键：删掉重写一份合法账，然后手工追加一行重复。
    assert.throws(
      () => putLedger(dir, [{ gate: '193', path: 'scripts/zz.mjs', status: 'red' }]),
      /台账已损坏/,
    )
    rmSync(file, { force: true })
    putLedger(dir, [{ gate: '193', path: 'scripts/y.mjs', status: 'red', lastSeen: new Date().toISOString() }])
    const good = readFileSync(file, 'utf8').split('\n').filter(Boolean)
    writeFileSync(file, `${good.join('\n')}\n${good[0]}\n`)
    r = nodeRun(LEDGER_CLI, ['--verify', '--root', repo], { cwd: repo })
    assert.equal(r.status, 1, '重复键必须判红')
    assert.match(r.stderr, /重复键/)
  } finally {
    cleanup(repo)
  }
})

test('47p 新红阻断：新增未带溯源水印的可注入文件', () => {
  const { repo, base } = makeRepo()
  try {
    write(repo, 'evil.md', '# 无水印\n')
    const next = commit(repo, 'evil md')
    linkScripts(repo)
    const r = ratchet(repo, base, next, { env: BIG_BUDGET })
    assert.equal(
      r.status,
      1,
      `应阻断，实际 rc=${r.status}\n${r.stdout}\n${r.stderr}\nledger=${JSON.stringify([...ledgerOf(repo).entries.values()])}`,
    )
    assert.match(r.stdout, /\[47p\] evil\.md/)
  } finally {
    cleanup(repo)
  }
})

test('undetermined 不豁免：超时/未判定记录后，同一路径再次判红仍然阻断', () => {
  const { repo, base } = makeRepo()
  try {
    const dir = stateDir(repo)
    writeAnchor(dir, { seedAt: new Date().toISOString(), seedSha: base })
    putLedger(dir, [
      { gate: '193', path: 'scripts/bad.mjs', status: 'undetermined', missing: '超出单门预算', lastSeen: new Date().toISOString() },
    ])
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const next = commit(repo, 'bad')
    const r = ratchet(repo, base, next)
    assert.equal(r.status, 1, r.stdout)
    assert.match(r.stdout, /undetermined-retry/)
  } finally {
    cleanup(repo)
  }
})

test('classifyFindings 单元：四类归因各自成立', () => {
  const ledger = new Map([
    ['47p\u0000a.md', { gate: '47p', path: 'a.md', status: 'red' }],
    ['47p\u0000u.md', { gate: '47p', path: 'u.md', status: 'undetermined' }],
  ])
  const got = classifyFindings({
    ledger,
    gate: '47p',
    findings: [{ path: 'a.md' }, { path: 'u.md' }, { path: 'n.md' }, { path: 'out.md' }],
    changedPaths: ['a.md', 'u.md', 'n.md'],
  })
  assert.deepEqual(
    got.blocked.map((b) => `${b.path}:${b.cause}`),
    ['u.md:undetermined-retry', 'n.md:new-red'],
  )
  assert.deepEqual(
    got.recorded.sort((x, y) => x.path.localeCompare(y.path)).map((b) => `${b.path}:${b.cause}`),
    ['a.md:existing-red', 'out.md:out-of-scope'],
  )
})

test('liveness：伪造崩溃 / 心跳过期 / 无锚点，三种态各自成立', () => {
  const { repo, base } = makeRepo()
  try {
    const dir = stateDir(repo)
    const env = { IHUI_REF_RATCHET_STALE_MS: '60000' }

    let r = nodeRun(LIVENESS, ['--root', repo], { cwd: repo, env })
    assert.equal(r.status, 0, '无锚点不应判红')

    writeAnchor(dir, { seedAt: new Date().toISOString(), seedSha: base })
    r = nodeRun(LIVENESS, ['--root', repo], { cwd: repo, env })
    assert.equal(r.status, 1, '有锚点无心跳必须报红')

    // 心跳过期且 main 已推进（心跳记的是一个不同的 new）。
    // writeHeartbeat 总写当前时刻，这里刻意把 ts 改回 1 小时前，模拟"钩子停摆"。
    writeHeartbeat(dir, { old: base, new: base, ref: 'refs/heads/main', result: 'pass' })
    const hbFile = heartbeatPath(dir)
    writeFileSync(hbFile, JSON.stringify({ ...JSON.parse(readFileSync(hbFile, 'utf8')), ts: new Date(Date.now() - 3600_000).toISOString() }))
    write(repo, 'notes.txt', 'moved\n')
    commit(repo, 'advance main')
    r = nodeRun(LIVENESS, ['--root', repo], { cwd: repo, env })
    assert.equal(r.status, 1, '心跳过期 + 引用推进必须报红')
    assert.match(r.stderr, /装死/)

    // 伪造一次钩子崩溃
    writeHeartbeat(dir, { old: base, new: git(repo, 'rev-parse', 'HEAD'), result: 'pass' })
    writeHookError(dir, { kind: 'hook-exception', message: 'boom', stack: 'at x', input: { ref: 'refs/heads/main' } })
    r = nodeRun(LIVENESS, ['--root', repo], { cwd: repo, env })
    assert.equal(r.status, 1, '近期 hook-error 必须报红')
    assert.match(r.stderr, /hook-error/)
  } finally {
    cleanup(repo)
  }
})

test('E2E：真实 git update-ref 在分支引用上被拦下，修好后放行（不触碰 refs/heads/main）', () => {
  const { repo, base } = makeRepo()
  try {
    git(repo, 'branch', 'ratchet-demo', base)
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const bad = commit(repo, 'bad')
    // 钩子必须最后装：上面所有提交/分支创建都属于夹具准备，不该走棘轮
    git(repo, 'config', 'core.hooksPath', HOOKS_DIR)
    // 同 47p：放大预算，断言钩子判据本身，而不是把负载机器上的"门慢"读成放行。
    const env = { IHUI_REF_TXN_RATCHET_REF: 'refs/heads/ratchet-demo', ...BIG_BUDGET }

    // 刻意用**一参数** update-ref：生产通道就是 commit-tree + update-ref，且不显式给 old 时
    // git 2.56 在 prepared 钩子里报 old=0000（实测）。编排器靠 rev-parse 取事务前真实值，
    // 这条用例同时守住"别把已有 ref 的更新误判成新建引用而放行"。
    let r = spawnSync('git', ['update-ref', 'refs/heads/ratchet-demo', bad], {
      cwd: repo, encoding: 'utf8', windowsHide: true, timeout: 600_000,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env },
    })
    assert.notEqual(r.status, 0, `E2E 应拦下 update-ref\n${r.stdout}\n${r.stderr}`)
    assert.equal(git(repo, 'rev-parse', 'refs/heads/ratchet-demo'), base, '引用必须留在旧值')

    // 引用回退到 base（删除违规文件 = 不再引入新红）⇒ 放行
    r = spawnSync('git', ['update-ref', 'refs/heads/ratchet-demo', base], {
      cwd: repo, encoding: 'utf8', windowsHide: true, timeout: 600_000,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env },
    })
    assert.equal(r.status, 0, `E2E 修复后应放行\n${r.stdout}\n${r.stderr}`)
    assert.equal(git(repo, 'rev-parse', 'refs/heads/ratchet-demo'), base)
    assert.equal(git(repo, 'rev-parse', 'refs/heads/main'), bad, 'main 仍是夹具自己的 main，未被触碰')
  } finally {
    cleanup(repo)
  }
})

test('E2E 台账自证：verify 在事务后仍可通过', () => {
  const { repo, base } = makeRepo()
  try {
    write(repo, 'scripts/bad.mjs', EVIL_SCRIPT)
    const bad = commit(repo, 'bad')
    assert.equal(ratchet(repo, base, bad, { env: BIG_BUDGET }).status, 1)
    const dir = stateDir(repo)
    assert.equal(verifyLedger(dir).errors.length, 0)
  } finally {
    cleanup(repo)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
