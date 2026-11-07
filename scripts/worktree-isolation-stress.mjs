#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree-isolation-stress.mjs —— 「共享工作树 vs worktree 隔离」同夹具并发压测。
 *
 * 治的是本仓 2026-11-04 一晚四次实测事故的共同根因:多会话共用**同一工作树 + 同一索引 +
 * 同一 `.git/COMMIT_EDITMSG`**。本脚本在同一台机器上跑两组对照,每组 2 个会话 × 20 轮
 * 「改文件 → 暂存 → 提交 → 回主线」,逐笔核验:
 *   ① `git diff-tree --name-only` 是否只含本席声明路径(挟带);
 *   ② 提交 subject 与写入消息是否逐字相同(串号);
 *   ③ 每次提交的 rc / 失败分型,以及 fail-closed 阻塞窗口(钩子接线进了树、执行体没进)。
 *
 * ## 两组对照(各用**同一生成器**产出的独立夹具,避免第一组污染第二组)
 *
 * - `shared`:两个会话都在夹具主树里。同一 index、同一 `.git/COMMIT_EDITMSG`。会话 A 复刻
 *   事故做法——先 `git add -- hooks/pre-commit`(钩子接线),执行体 `hooks/check-half-feature.mjs`
 *   稍后才写;两个会话写同一个 COMMIT_EDITMSG 后 `git commit -F`。这是**对照组**,不是本单
 *   推荐用法;只在一次性夹具里复刻事故,不碰真实仓。
 * - `isolated`:两棵 `git worktree`,每席一棵;提交走 `scripts/isolated-git.mjs`(私有索引、
 *   显式路径);提交后用 `landWorktree()` 主线侧 `git merge --ff-only` 回主线;主线已前进则
 *   先在该树普通 merge 主线再 ff。**无 cherry-pick、无 CAS、无 rebase**。
 *
 * ## 夹具几何(两组逐字相同)
 *
 * - `feature/fix.js`(会话 A 所有);`i18n/input.js`(会话 B 所有);
 * - `hooks/pre-commit`(接线)+ `hooks/check-half-feature.mjs`(执行体,缺失即 fail-closed);
 * - `core.hooksPath=hooks`(相对路径,实测在 linked worktree 里解析到**该树自己的** hooks/;
 *   主树没有 hooks/ 时钩子不跑)——这是隔离组"钩子物理不可见"的关键前提。
 *
 * 用法:
 *   node scripts/worktree-isolation-stress.mjs [--rounds 20] [--json]
 *
 * 退出码: 0 = 隔离组全部断言通过;1 = 隔离组有断言失败;2 = 夹具/派生失败(未判定)。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitBinary } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { landWorktree, newWorktree, dropWorktree } from './worktree-isolate.mjs'

export const ROUNDS_DEFAULT = 20
export const SESSIONS = ['A', 'B']
export const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 会话自己的路径集合。A 第 1 轮额外带钩子接线 + 执行体(其余轮只改 fix.js)。 */
export function ownPaths(sid, round) {
  if (sid === 'B') return ['i18n/input.js']
  return round === 1
    ? ['feature/fix.js', 'hooks/pre-commit', 'hooks/check-half-feature.mjs']
    : ['feature/fix.js']
}

const HOOK_SH = '#!/bin/sh\nnode "$(git rev-parse --show-toplevel)/hooks/check-half-feature.mjs"\n'
const HOOK_BODY = `// 夹具执行体:真实仓里这里是"命中 i18n 输入就强制重生成离线包"那条腿。
// 本夹具只验证**执行体在不在**:接线在而执行体缺失 ⇒ shell 里 node 找不到文件 ⇒ 提交被挡住。
process.exit(0)
`

function git(args, root, extra = {}) {
  const r = spawnSync(gitBinary(), args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: extra.timeout ?? 120000,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    ok: r.status === 0,
    status: typeof r.status === 'number' ? r.status : 2,
    out: String(r.stdout || '').trim(),
    err: String(r.stderr || '').trim(),
    error: r.error || null,
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** 一次性夹具:两组各建一份,几何逐字相同,互不污染。 */
export function makeFixture(root) {
  const repo = join(root, 'repo')
  mkdirSync(join(repo, 'feature'), { recursive: true })
  mkdirSync(join(repo, 'i18n'), { recursive: true })
  const init = git(['init', '-q', '-b', 'main'], repo)
  if (!init.ok) throw new Error(`夹具 git init 失败:${init.err}`)
  for (const [k, v] of [
    ['user.email', 'stress@ihui.invalid'],
    ['user.name', 'ihui worktree stress'],
    ['commit.gpgsign', 'false'],
    ['tag.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
    ['core.hooksPath', 'hooks'],
  ]) {
    git(['config', k, v], repo)
  }
  writeFileSync(join(repo, 'feature', 'fix.js'), '// v1\n', 'utf8')
  writeFileSync(join(repo, 'i18n', 'input.js'), '// v1\n', 'utf8')
  git(['add', '--', 'feature/fix.js', 'i18n/input.js'], repo)
  const c = git(['commit', '-q', '-m', 'fixture: init'], repo)
  if (!c.ok) throw new Error(`夹具初始提交失败:${c.err}`)
  return repo
}

function writeOwn(tree, sid, round) {
  if (sid === 'B') {
    writeFileSync(join(tree, 'i18n', 'input.js'), `// input v${round} ${Date.now()}\n`, 'utf8')
    return
  }
  writeFileSync(join(tree, 'feature', 'fix.js'), `// fix v${round} ${Date.now()}\n`, 'utf8')
  if (round === 1) {
    mkdirSync(join(tree, 'hooks'), { recursive: true })
    writeFileSync(join(tree, 'hooks', 'pre-commit'), HOOK_SH, 'utf8')
  }
}

function writeHookBody(tree) {
  writeFileSync(join(tree, 'hooks', 'check-half-feature.mjs'), HOOK_BODY, 'utf8')
}

/** 由 `git commit` 的 stdout 取本次新建提交的短 SHA(shared 模式 HEAD 会被别席推进,不能 rev-parse HEAD)。 */
function shaFromCommitOutput(out) {
  const re = /\[[^\]]*?\s([0-9a-f]{7,40})\]/g
  let m = null
  let last = null
  while ((m = re.exec(String(out || ''))) !== null) last = m
  return last ? last[1] : null
}

function commitRecord(tree, sha, extra) {
  if (!sha) return { ...extra, sha: null, subject: '', changedPaths: [] }
  const full = git(['rev-parse', sha], tree)
  const subject = git(['log', '-1', '--format=%s', sha], tree)
  const changed = git(
    ['-c', 'core.quotepath=false', 'diff-tree', '--no-commit-id', '--name-only', '-r', sha],
    tree,
  )
  return {
    ...extra,
    sha: full.ok ? full.out : sha,
    subject: subject.out,
    changedPaths: changed.out ? changed.out.split(/\r?\n/).filter(Boolean) : [],
  }
}

/**
 * worktree 内的提交:先 `git add -- 声明集`,再 `git commit -m <标题> -- 声明集`。
 *
 * - worktree 的 index 在 `<repo>/.git/worktrees/<名>/index`,**这棵树独占**;别席的 `git add`
 *   物理上写不到这里 ⇒ 不存在"别席把本席路径扫进提交"的入口。
 * - `COMMIT_EDITMSG` 同样落在 `<repo>/.git/worktrees/<名>/COMMIT_EDITMSG`(实测),不是主树
 *   那个单文件 ⇒ subject 不可能被并发覆盖。
 * - `git commit -- <pathspec>` 只交声明路径(非裸提交),且会把 index 推进到新 HEAD;
 *   实测提交后 `status --porcelain` 为空,不留 §2.4 那种反向暂存。
 *
 * 为什么不用 `scripts/isolated-git.mjs`:实测(2026-11-04)它在 linked worktree 里建私有 GIT_DIR
 * 叠层时把 `commondir` 指到该树 admin gitdir(`<repo>/.git/worktrees/<名>`),git 不再跟随
 * 第二层 commondir ⇒ `fatal: not a git repository: …<idx>.gitdir`;仅补 `GIT_COMMON_DIR` 时能
 * 建出提交对象,但**分支 ref 不前进**(commit 悬空、索引留 `A`)。本单不改 isolated-git 本体,
 * 在 worktree 里直接用它自己那份 index(已经是私有索引)。
 */
function commitInWorktree(tree, message, paths) {
  const add = git(['add', '--', ...paths], tree)
  if (!add.ok) return { rc: add.status, out: '', err: `add: ${add.err}` }
  const c = git(['commit', '-m', message, '--', ...paths], tree)
  return { rc: c.status, out: c.out, err: c.err }
}

function classify(stderr) {
  const s = String(stderr || '')
  if (/check-half-feature\.mjs|Cannot find module|MODULE_NOT_FOUND/i.test(s)) return 'fail-closed'
  if (/IHUI-STRESS-FAIL-CLOSED/.test(s)) return 'fail-closed'
  if (/index\.lock|cannot lock ref|Another git process|Unable to create/i.test(s)) return 'lock'
  if (/nothing to commit|no changes added|nothing added to commit/i.test(s)) return 'empty'
  return 'other'
}

/** 文件栅栏:两个 worker 进程用它对齐"同时写 COMMIT_EDITMSG / 同一时刻提交"。 */
function signalFlag(dir, name) {
  writeFileSync(join(dir, `${name}.flag`), String(Date.now()), 'utf8')
}
function waitFlag(dir, name, timeoutMs = 8000) {
  const p = join(dir, `${name}.flag`)
  const deadline = Date.now() + timeoutMs
  while (!existsSync(p)) {
    if (Date.now() > deadline) return false
    sleepSync(10)
  }
  return true
}

/** shared 组:复刻事故做法。同树、同 index、同 COMMIT_EDITMSG。 */
function runSharedWorker(cfg) {
  const { sid, tree, repo, rounds, barrier } = cfg
  const other = sid === 'A' ? 'B' : 'A'
  const rows = []
  let hookWiredAt = 0
  let checkerWrittenAt = 0
  for (let i = 1; i <= rounds; i++) {
    const t0 = Date.now()
    const message = `stress shared ${sid} r${String(i).padStart(2, '0')} ${cfg.run}`
    const expected = ownPaths(sid, i)
    writeOwn(tree, sid, i)
    let err = ''
    let out = ''
    let rc = null

    if (i === 1 && sid === 'A') {
      git(['add', '--', 'hooks/pre-commit', 'feature/fix.js'], tree)
      hookWiredAt = Date.now()
      signalFlag(barrier, `shared-wired-${cfg.run}`)
      waitFlag(barrier, `shared-b-attempted-${cfg.run}`)
      writeHookBody(tree)
      git(['add', '--', 'hooks/check-half-feature.mjs'], tree)
      checkerWrittenAt = Date.now()
      writeFileSync(join(repo, '.git', 'COMMIT_EDITMSG'), `${message}\n`, 'utf8')
      sleepSync(6)
      const c = git(['commit', '-F', join(repo, '.git', 'COMMIT_EDITMSG')], tree)
      rc = c.status
      out = c.out
      err = c.err
    } else if (i === 1 && sid === 'B') {
      waitFlag(barrier, `shared-wired-${cfg.run}`)
      git(['add', '--', 'i18n/input.js'], tree)
      writeFileSync(join(repo, '.git', 'COMMIT_EDITMSG'), `${message}\n`, 'utf8')
      sleepSync(6)
      const c = git(['commit', '-F', join(repo, '.git', 'COMMIT_EDITMSG')], tree)
      rc = c.status
      out = c.out
      err = c.err
      signalFlag(barrier, `shared-b-attempted-${cfg.run}`)
    } else {
      if (sid === 'A') git(['add', '--', 'feature/fix.js'], tree)
      else git(['add', '--', 'i18n/input.js'], tree)
      // 两席都暂存完成后再同时写消息并提交 —— 事故当时就是两个会话同时开编辑器。
      signalFlag(barrier, `shared-stage-${cfg.run}-${i}-${sid}`)
      waitFlag(barrier, `shared-stage-${cfg.run}-${i}-${other}`)
      writeFileSync(join(repo, '.git', 'COMMIT_EDITMSG'), `${message}\n`, 'utf8')
      sleepSync(8)
      const c = git(['commit', '-F', join(repo, '.git', 'COMMIT_EDITMSG')], tree)
      rc = c.status
      out = c.out
      err = c.err
    }

    const sha = rc === 0 ? shaFromCommitOutput(out) : null
    const rec = commitRecord(tree, sha, {
      mode: 'shared',
      sid,
      round: i,
      message,
      expectedPaths: expected,
      rc,
      kind: rc === 0 ? 'ok' : classify(err),
      stderr: err.slice(0, 300),
      elapsedMs: Date.now() - t0,
      landRc: 0,
      landMode: 'shared-main',
      hookWiredAt,
      checkerWrittenAt,
    })
    rows.push(rec)
    sleepSync(15)
  }
  return rows
}

/** isolated 组:每席一棵 worktree;isolated-git 私有索引提交;land 走主线 ff-only。 */
function runIsolatedWorker(cfg) {
  const { sid, tree, repo, rounds } = cfg
  const rows = []
  for (let i = 1; i <= rounds; i++) {
    const t0 = Date.now()
    const message = `stress isolated ${sid} r${String(i).padStart(2, '0')} ${cfg.run}`
    const expected = ownPaths(sid, i)
    writeOwn(tree, sid, i)
    if (i === 1 && sid === 'A') {
      // 钩子接线与执行体在同一私有索引里原子提交 —— 这是隔离组不产生阻塞窗口的关键。
      writeHookBody(tree)
      // 别席未提交探针:物理上不该出现在 B 树,也不该进主线。
      writeFileSync(join(tree, 'feature', 'wip-only.js'), '// uncommitted probe\n', 'utf8')
    }
    const c = commitInWorktree(tree, message, expected)
    const rc = c.rc
    const stdout = c.out
    const stderr = c.err
    const sha = rc === 0 ? shaFromCommitOutput(stdout) : null
    const rec = commitRecord(tree, sha, {
      mode: 'isolated',
      sid,
      round: i,
      message,
      expectedPaths: expected,
      rc,
      kind: rc === 0 ? 'ok' : classify(stderr),
      stderr: stderr.slice(0, 300),
    })
    // 只有提交成功才回主线;land 的失败也计入本轮 rc 之外的独立字段。
    if (rec.sha) {
      const land = landWorktree({ repoRoot: repo, target: tree, maxAttempts: 8 })
      rec.landRc = land.exit
      rec.landMode = land.mode || 'refused'
      rec.landOut = land.out.join(' / ').slice(0, 400)
    } else {
      rec.landRc = null
      rec.landMode = 'skipped'
    }
    rec.elapsedMs = Date.now() - t0
    rows.push(rec)
    sleepSync(10)
  }
  return rows
}

function spawnWorker(cfg, scratch) {
  return new Promise((done) => {
    const outPath = join(scratch, `result-${cfg.mode}-${cfg.sid}.json`)
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker'], {
      cwd: cfg.tree,
      env: {
        ...process.env,
        IHUI_STRESS_WORKER: '1',
        IHUI_STRESS_MODE: cfg.mode,
        IHUI_STRESS_SESSION: cfg.sid,
        IHUI_STRESS_REPO: cfg.repo,
        IHUI_STRESS_TREE: cfg.tree,
        IHUI_STRESS_ROUNDS: String(cfg.rounds),
        IHUI_STRESS_RUN: cfg.run,
        IHUI_STRESS_OUT: outPath,
        IHUI_STRESS_BARRIER: cfg.barrier,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('close', (code) =>
      done({ mode: cfg.mode, sid: cfg.sid, code, outPath, stdout: out, stderr: err }),
    )
  })
}

function workerMain() {
  const mode = process.env.IHUI_STRESS_MODE
  const sid = process.env.IHUI_STRESS_SESSION
  const cfg = {
    mode,
    sid,
    repo: process.env.IHUI_STRESS_REPO,
    tree: process.env.IHUI_STRESS_TREE,
    rounds: Number(process.env.IHUI_STRESS_ROUNDS || ROUNDS_DEFAULT),
    run: process.env.IHUI_STRESS_RUN,
    barrier: process.env.IHUI_STRESS_BARRIER,
  }
  let rows = []
  let fatal = null
  try {
    rows = mode === 'shared' ? runSharedWorker(cfg) : runIsolatedWorker(cfg)
  } catch (e) {
    fatal = String(e?.stack ?? e)
  }
  writeFileSync(
    process.env.IHUI_STRESS_OUT,
    JSON.stringify({ mode, sid, rows, fatal }, null, 2),
    'utf8',
  )
  return fatal ? 1 : 0
}

function loadRows(result) {
  if (!existsSync(result.outPath))
    return { rows: [], fatal: `worker 未写结果文件(code=${result.code}) ${result.stderr}` }
  const j = JSON.parse(readFileSync(result.outPath, 'utf8'))
  return { rows: j.rows || [], fatal: j.fatal || null }
}

export function summarize(rows, repo) {
  const committed = rows.filter((r) => r.rc === 0 && r.sha)
  const carries = committed.filter((r) => r.changedPaths.some((p) => !r.expectedPaths.includes(p)))
  const crosstalk = committed.filter((r) => r.subject !== r.message)
  const failClosed = rows.filter((r) => r.kind === 'fail-closed')
  const kinds = {}
  for (const r of rows) if (r.kind !== 'ok') kinds[r.kind] = (kinds[r.kind] || 0) + 1
  const notLanded = committed.filter(
    (r) => !git(['merge-base', '--is-ancestor', r.sha, 'HEAD'], repo).ok,
  )
  const bySession = SESSIONS.map((sid) => {
    const s = rows.filter((r) => r.sid === sid)
    const sc = s.filter((r) => r.rc === 0 && r.sha)
    return {
      sid,
      rounds: s.length,
      committed: sc.length,
      failed: s.length - sc.length,
      carry: sc.filter((r) => r.changedPaths.some((p) => !r.expectedPaths.includes(p))).length,
      crosstalk: sc.filter((r) => r.subject !== r.message).length,
      failClosed: s.filter((r) => r.kind === 'fail-closed').length,
      landed: sc.filter((r) => git(['merge-base', '--is-ancestor', r.sha, 'HEAD'], repo).ok).length,
    }
  })
  return {
    rounds: rows.length,
    committed: committed.length,
    failed: rows.length - committed.length,
    kinds,
    carries: carries.map((r) => ({
      sid: r.sid,
      round: r.round,
      expected: r.expectedPaths,
      changed: r.changedPaths,
      extra: r.changedPaths.filter((p) => !r.expectedPaths.includes(p)),
    })),
    crosstalk: crosstalk.map((r) => ({
      sid: r.sid,
      round: r.round,
      intended: r.message,
      actual: r.subject,
    })),
    failClosed: failClosed.map((r) => ({ sid: r.sid, round: r.round, stderr: r.stderr })),
    failures: rows
      .filter((r) => r.kind !== 'ok')
      .map((r) => ({ sid: r.sid, round: r.round, rc: r.rc, kind: r.kind, stderr: r.stderr })),
    landFailures: rows
      .filter((r) => r.sha && r.landRc !== 0)
      .map((r) => ({ sid: r.sid, round: r.round, landRc: r.landRc, landOut: r.landOut })),
    /** 会话 A 树里从未 add/commit 的探针,是否进了主线(physically invisible 的直接证据)。 */
    probeInMain: git(['cat-file', '-e', 'HEAD:feature/wip-only.js'], repo).ok,
    notLanded,
    bySession,
    windowMs: (() => {
      const a = rows.find((r) => r.sid === 'A' && r.round === 1 && r.hookWiredAt)
      if (!a) return null
      const b = rows.find((r) => r.sid === 'B' && r.kind === 'fail-closed')
      return {
        hookWiredAt: a.hookWiredAt,
        checkerWrittenAt: a.checkerWrittenAt,
        spanMs: a.checkerWrittenAt ? a.checkerWrittenAt - a.hookWiredAt : null,
        blockedAttempts: failClosed.length,
        blockedAt: b ? b.round : null,
      }
    })(),
  }
}

function printMode(mode, s) {
  console.log(
    `=== 模式 ${mode} ${mode === 'shared' ? '(共用工作树:同一 index + 同一 COMMIT_EDITMSG)' : '(两棵 worktree + 私有索引 + 主线 ff-only)'} ===`,
  )
  for (const x of s.bySession) {
    console.log(
      `  会话 ${x.sid}: ${x.rounds} 轮 | 提交成功 ${x.committed} | 失败 ${x.failed} | 挟带 ${x.carry} 笔 | ` +
        `串号 ${x.crosstalk}/${x.committed} | fail-closed ${x.failClosed} | 已落主线 ${x.landed}/${x.committed}`,
    )
  }
  console.log(
    `  合计: ${s.committed}/${s.rounds} 笔提交 | 挟带 ${s.carries.length} 笔 | 串号 ${s.crosstalk.length}/${s.committed} | ` +
      `fail-closed ${s.failClosed.length} 笔 | 未落主线 ${s.notLanded.length}`,
  )
  console.log(`  失败分型: ${Object.keys(s.kinds).length ? JSON.stringify(s.kinds) : '无'}`)
  if (s.carries.length) {
    const sample = s.carries
      .slice(0, 6)
      .map((c) => `${c.sid}r${c.round} 多带 [${c.extra.join(',')}]`)
    console.log(
      `  挟带样本: ${sample.join(' | ')}${s.carries.length > 6 ? ` … 共 ${s.carries.length}` : ''}`,
    )
  }
  if (s.crosstalk.length) {
    const sample = s.crosstalk
      .slice(0, 4)
      .map((c) => `${c.sid}r${c.round} 想写「${c.intended}」实得「${c.actual}」`)
    console.log(`  串号样本: ${sample.join(' | ')}`)
  }
  if (s.landFailures && s.landFailures.length) {
    const sample = s.landFailures
      .slice(0, 3)
      .map((x) => `${x.sid}r${x.round} rc=${x.landRc} ${x.landOut}`)
    console.log(`  land 失败: ${s.landFailures.length} 笔 | ${sample.join(' | ')}`)
  }
  if (s.windowMs && (s.windowMs.spanMs !== null || s.windowMs.blockedAttempts)) {
    console.log(
      `  阻塞窗口: 接口 ${s.windowMs.hookWiredAt} → 执行体 ${s.windowMs.checkerWrittenAt} | ` +
        `span=${s.windowMs.spanMs}ms | 被挡 ${s.windowMs.blockedAttempts} 笔(首笔 ${s.windowMs.blockedAt ? `B r${s.windowMs.blockedAt}` : '无'})`,
    )
  }
}

export async function runStress({ rounds = ROUNDS_DEFAULT, json = false } = {}) {
  const run = Math.random().toString(16).slice(2, 8)
  const scratchRoot = mkScratch(`worktree-isolation-stress-${run}-`)
  const results = {}
  const cleanup = []
  try {
    for (const mode of ['shared', 'isolated']) {
      const dir = join(scratchRoot, mode)
      mkdirSync(dir, { recursive: true })
      const repo = makeFixture(dir)
      const barrier = join(dir, 'barrier')
      mkdirSync(barrier, { recursive: true })
      const trees = { A: repo, B: repo }
      if (mode === 'isolated') {
        for (const sid of SESSIONS) {
          const dest = join(dir, `wt-${sid}`)
          const w = newWorktree({ repoRoot: repo, slug: `stress-${sid}`, dest, base: 'HEAD' })
          if (w.exit !== 0) throw new Error(`建隔离树失败(${sid}):${w.out.join(' / ')}`)
          trees[sid] = w.path
          cleanup.push({ repoRoot: repo, target: w.path })
        }
      }
      const spawned = await Promise.all(
        SESSIONS.map((sid) =>
          spawnWorker({ mode, sid, repo, tree: trees[sid], rounds, run, barrier }, dir),
        ),
      )
      const fatal = []
      const rows = []
      for (const sp of spawned) {
        const got = loadRows(sp)
        if (got.fatal) fatal.push(`${mode}/${sp.sid}: ${got.fatal}`)
        rows.push(...got.rows)
      }
      if (fatal.length) throw new Error(`worker 失败:${fatal.join(' | ')}`)
      results[mode] = summarize(rows, repo)
    }
  } finally {
    // 隔离树先按工具自己的安全回收路径删(不 force);脏/未跟踪会拒删,绝不强删。
    // 实验探针是本单自己写的未跟踪文件,回收前由本单自己删掉(不留残余、也不让 drop 白拒)。
    for (const c of cleanup) {
      const probe = join(c.target, 'feature', 'wip-only.js')
      if (existsSync(probe)) {
        try {
          unlinkSync(probe)
        } catch {
          /* 删不掉就交给 drop 的拒删闸,绝不 force */
        }
      }
    }
    for (const c of cleanup.reverse()) {
      const d = dropWorktree({ repoRoot: c.repoRoot, target: c.target })
      if (d.exit !== 0) console.log(`⚠ 压测夹具回收被拒(保留现场):${d.out.join(' / ')}`)
    }
    rmScratch(scratchRoot, { bestEffort: true })
  }

  const iso = results.isolated
  const shared = results.shared
  const isoAssertions = {
    allCommitted: iso.committed === iso.rounds,
    zeroCarry: iso.carries.length === 0,
    zeroCrosstalk: iso.crosstalk.length === 0,
    zeroFailClosed: iso.failClosed.length === 0,
    allLanded: iso.notLanded.length === 0,
    probeAbsent: iso.probeInMain === false,
  }
  const ok = Object.values(isoAssertions).every(Boolean)

  if (json) {
    console.log(JSON.stringify({ rounds, run, shared, isolated: iso, isoAssertions, ok }, null, 2))
  } else {
    printMode('shared', shared)
    printMode('isolated', iso)
    console.log('=== 隔离组断言(验收硬条件)===')
    console.log(
      `  逐笔只含本席路径(0 挟带): ${isoAssertions.zeroCarry ? 'PASS' : 'FAIL'} (${iso.carries.length} 笔违约)`,
    )
    console.log(
      `  subject 逐字相同(0 串号): ${isoAssertions.zeroCrosstalk ? 'PASS' : 'FAIL'} (${iso.crosstalk.length} 笔违约)`,
    )
    console.log(
      `  无 fail-closed 阻塞: ${isoAssertions.zeroFailClosed ? 'PASS' : 'FAIL'} (${iso.failClosed.length} 笔被挡)`,
    )
    console.log(
      `  全部提交已落主线: ${isoAssertions.allLanded ? 'PASS' : 'FAIL'} (${iso.notLanded.length} 笔未落)`,
    )
    console.log(
      `  全部轮次提交成功: ${isoAssertions.allCommitted ? 'PASS' : 'FAIL'} (${iso.committed}/${iso.rounds})`,
    )
    console.log(`  别席未提交探针未进主线: ${isoAssertions.probeAbsent ? 'PASS' : 'FAIL'}`)
    console.log(
      `  shared 对照失败率: ${((shared.failed / shared.rounds) * 100).toFixed(1)}% (${shared.failed}/${shared.rounds})`,
    )
  }
  return ok ? 0 : 1
}

function parseRound(argv) {
  const i = argv.indexOf('--rounds')
  if (i < 0) return ROUNDS_DEFAULT
  const n = Number(argv[i + 1])
  if (!Number.isInteger(n) || n < 1 || n > 200) throw new Error('--rounds 需要 1..200 的整数')
  return n
}

async function main(argv) {
  if (process.env.IHUI_STRESS_WORKER === '1') {
    process.exitCode = workerMain()
    return
  }
  try {
    const rounds = parseRound(argv)
    process.exitCode = await runStress({ rounds, json: argv.includes('--json') })
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exitCode = 2
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main(process.argv.slice(2))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
