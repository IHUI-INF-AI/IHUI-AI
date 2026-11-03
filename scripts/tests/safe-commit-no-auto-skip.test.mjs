// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-03 机主明令:「不许 --no-verify」。本文件钉住 safe-commit 的**默认永不跳钩**。
 *
 * 旧行为(已废止):钩子判红 → 归因层判 not-ours / env-blocked / unattributed → 自跑
 * `guardian-runner --staged` → 仍红就 `git commit --no-verify` 落地。它把"钩子里的门"与
 * "自跑的门"混为一谈(lint-staged 与批外专项门根本不在自跑集合里),且正文里只剩 attestation,
 * 审计上分不清"真过钩"与"跳钩"。
 *
 * 四条用例对应用户要求:
 *   NS1 锁冲突耗尽 ⇒ exit≠0、不落地、不跳钩(旧形态很难覆盖:旧代码在锁分支已拒绝,但
 *       "钩子窗口里的锁污染被当成钩子判红"那条路径才是事故口 —— NS3 从归因侧钉住)。
 *   NS2 锁在重试窗口内释放 ⇒ 3 次指数退避内成功,提交正常落地。
 *   NS3 钩子判红且归因非 mine ⇒ 默认拒绝;显式 `--allow-skip-hooks=<原因>` 才跳,且正文有标记。
 *   NS4 正常过钩路径与 HEAD 版逐字对照(剥掉临时路径/unit/sha 后整段 stdout 等值)。
 *
 * 全程只在 mkScratch 的临时仓里跑,不动真仓、不动共享索引、不 push。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')
const REPO_ROOT = join(SCRIPTS, '..')

const plain = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')
const outputOf = (r) => plain(`${r.stdout || ''}${r.stderr || ''}`)

const gitR = (dir, ...args) =>
  spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const git = (dir, ...args) => {
  const r = gitR(dir, ...args)
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:\n${r.stdout}\n${r.stderr}`)
  return (r.stdout || '').trim()
}

const countCommits = (dir) => Number(git(dir, 'rev-list', '--count', 'HEAD'))

/** Windows 上 detached heartbeat 还握着临时仓句柄 ⇒ 首删常 EPERM,重试几轮即可。 */
async function dropRepo(dir) {
  for (let i = 0; i < 10; i++) {
    try {
      rmScratch(dir)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  rmScratch(dir, { bestEffort: true })
}

function makeRepo(t) {
  const dir = mkScratch('safe-commit-noskip-')
  t.after(() => dropRepo(dir))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  git(dir, 'init', '-q', '.')
  git(dir, 'config', 'user.name', 'fixture')
  git(dir, 'config', 'user.email', 'fixture@example.invalid')
  git(dir, 'config', 'commit.gpgsign', 'false')
  git(dir, 'config', 'core.hooksPath', join(dir, '.git', 'hooks'))
  // 被 import 的闭包由 copyScriptWithClosure 自动拷;被按路径 spawn 的必须点名补拷。
  copyScriptWithClosure(SCRIPTS, 'safe-commit.mjs', join(dir, 'scripts'), [
    'live-doc-edit.mjs',
    'lib/face-reader.mjs',
    'lib/stale-content-analysis.mjs',
    'lib/scratch-dir.mjs',
  ])
  copyScriptWithClosure(SCRIPTS, 'git-lock.mjs', join(dir, 'scripts'))
  copyScriptWithClosure(SCRIPTS, 'merge-live-doc.mjs', join(dir, 'scripts'))
  // 先落一枚基线提交:Step 1 的 `git reset HEAD` 需要 HEAD 存在。
  writeFileSync(join(dir, 'base.txt'), 'base\n')
  git(dir, 'add', '--', 'base.txt')
  git(dir, 'commit', '-q', '-m', 'chore: fixture base')
  return dir
}

function runSafe(dir, { files, extraArgs = [], message = 'docs: fixture', env = {} }) {
  return spawnSync(
    process.execPath,
    [join(dir, 'scripts', 'safe-commit.mjs'), ...extraArgs, '-m', message, '--', ...files],
    {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 与 safe-commit.test.mjs 同一份隔离清单:真仓会话里挂着的锁/范围变量不得漏进夹具。
      env: {
        ...process.env,
        IHUI_GIT_LOCK_UNIT: '',
        AGENT_SCOPE: '',
        AGENT_NAME: '',
        AGENT_SCOPE_OVERRIDE: '',
        LIVE_SHA_ALLOW: '',
        IHUI_SKIP_LIVE_DOC_CHECK: '',
        IHUI_SAFE_COMMIT_SHA_INTAKE_CAP: '',
        ...env,
      },
    },
  )
}

/** 正常路径对照时剥掉每枚仓必不相同的临时路径 / 锁 unit / 提交 sha。 */
const scrub = (text, dir) =>
  plain(text)
    .replaceAll(dir, '<REPO>')
    .replaceAll(dir.replaceAll('\\', '/'), '<REPO>')
    .replace(/safe-commit-\d+-\d+/g, 'unit=<UNIT>')
    .replace(/\b[0-9a-f]{7,40}\b/g, '<SHA>')

test('NS1 索引锁争用耗尽 ⇒ exit≠0、不落地、且绝不自动跳钩', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  const lock = join(dir, '.git', 'index.lock')
  writeFileSync(lock, 'fixture lock (not held)\n')
  const r = runSafe(dir, {
    files: ['a.txt'],
    message: 'docs: ns1',
    env: {
      IHUI_SAFE_COMMIT_LOCK_RETRIES: '1',
      IHUI_SAFE_COMMIT_LOCK_BACKOFF_MS: '80',
      IHUI_SAFE_COMMIT_LOCK_BUDGET_MS: '300',
    },
  })
  const out = outputOf(r)
  assert.notEqual(r.status, 0, out)
  assert.match(out, /请等待并发会话释放索引/)
  // 旧兜底的两条指纹都不许出现:自动跳钩的跑马灯、显式授权的正文说明。
  assert.doesNotMatch(out, /已按\*\*人工显式授权\*\*用 --no-verify 落地/)
  assert.doesNotMatch(out, /人工授权跳钩/)
  assert.equal(countCommits(dir), 1, '锁冲突时不得产生任何提交')
})

test('NS2 锁在重试窗口内释放 ⇒ 指数退避重试成功并正常提交', async (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'b.txt'), 'b\n')
  const lock = join(dir, '.git', 'index.lock')
  writeFileSync(lock, 'fixture lock (not held)\n')

  // 事件驱动而不是定时删锁:定时删锁会与 Step 0/1 的启动耗时赛跑(实测 350ms 那次
  // safe-commit 还没走到 Step 1,锁已经没了 ⇒ 变成"没重试过"的假绿)。
  // 这里等**重试告警真的打出来**再放锁 —— 那一刻"第一次尝试已确凿撞锁"是既成事实。
  const r = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(dir, 'scripts', 'safe-commit.mjs'), '-m', 'docs: ns2', '--', 'b.txt'],
      {
        cwd: dir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          IHUI_GIT_LOCK_UNIT: '',
          AGENT_SCOPE: '',
          AGENT_NAME: '',
          AGENT_SCOPE_OVERRIDE: '',
          IHUI_SAFE_COMMIT_LOCK_RETRIES: '3',
          IHUI_SAFE_COMMIT_LOCK_BACKOFF_MS: '400',
          IHUI_SAFE_COMMIT_LOCK_BUDGET_MS: '10000',
        },
      },
    )
    let out = ''
    let released = false
    const onChunk = (buf) => {
      out += String(buf)
      if (!released && out.includes('撞 git 索引锁')) {
        released = true
        try {
          unlinkSync(lock)
        } catch {}
      }
    }
    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)
    child.on('error', reject)
    child.on('close', (status) => resolve({ status, out }))
  })
  assert.equal(r.status, 0, plain(r.out))
  assert.match(plain(r.out), /次重试/, plain(r.out))
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'docs: ns2')
  assert.match(git(dir, 'show', '--name-only', '--format='), /b\.txt/)
})

test('NS3 钩子判红且归因非 mine ⇒ 默认拒绝;显式 --allow-skip-hooks 才跳且正文有标记', (t) => {
  const dir = makeRepo(t)
  const hook = join(dir, '.git', 'hooks', 'pre-commit')
  writeFileSync(hook, '#!/bin/sh\nexit 1\n')
  chmodSync(hook, 0o755)
  writeFileSync(join(dir, 'c.txt'), 'c\n')

  const refused = runSafe(dir, { files: ['c.txt'], message: 'docs: ns3' })
  const out1 = outputOf(refused)
  assert.notEqual(refused.status, 0, out1)
  assert.match(out1, /默认永不跳钩/)
  assert.match(out1, /请等待并发会话释放索引/)
  assert.equal(countCommits(dir), 1, '默认拒绝时不得落地')

  const allowed = runSafe(dir, {
    files: ['c.txt'],
    extraArgs: ['--allow-skip-hooks=fixture: 验证显式授权'],
    message: 'docs: ns3',
  })
  const out2 = outputOf(allowed)
  assert.equal(allowed.status, 0, out2)
  const body = git(dir, 'log', '-1', '--format=%B')
  assert.match(body, /人工授权跳钩/)
  assert.match(body, /验证显式授权/)
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'docs: ns3')
})

test('NS4 正常过钩路径与 HEAD 版逐字对照(整段 stdout 剥变量后等值)', (t) => {
  const head = gitR(REPO_ROOT, 'show', 'HEAD:scripts/safe-commit.mjs')
  assert.equal(head.status, 0, `取 HEAD 版 safe-commit 失败:\n${head.stderr}`)

  const newDir = makeRepo(t)
  const headDir = makeRepo(t)
  writeFileSync(join(headDir, 'scripts', 'safe-commit.mjs'), head.stdout)
  writeFileSync(join(newDir, 'd.txt'), 'd\n')
  writeFileSync(join(headDir, 'd.txt'), 'd\n')

  const fresh = runSafe(newDir, { files: ['d.txt'], message: 'docs: ns4' })
  const old = runSafe(headDir, { files: ['d.txt'], message: 'docs: ns4' })
  assert.equal(fresh.status, 0, outputOf(fresh))
  assert.equal(old.status, 0, outputOf(old))

  assert.equal(scrub(outputOf(fresh), newDir), scrub(outputOf(old), headDir), '正常路径不得有可观察差异')
  assert.equal(git(newDir, 'log', '-1', '--format=%B'), git(headDir, 'log', '-1', '--format=%B'))
  assert.equal(git(newDir, 'log', '-1', '--format=%s'), 'docs: ns4')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
