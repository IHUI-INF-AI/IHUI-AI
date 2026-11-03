// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `.husky/commit-msg` 的 GIT_INDEX_FILE 判据镜像测试(2026-11-03 新建)。
 *
 * 守的是哪一型:`.husky/commit-msg:3` 原先与 `.husky/pre-commit` 同款,把 GIT_INDEX_FILE
 * 无条件 unset。`git commit --only -- <路径>` 期间父 git 持 `.git/index.lock`,同时把
 * 「只含本次路径的临时索引」经 GIT_INDEX_FILE 交给钩子;unset 掉之后 commit-msg 的
 * staged 面检查(`git diff --cached`)落到**共享真实索引**,把并发会话暂存的文件读成本次提交。
 * 既有铁证:2026-11-03 的那笔 4 文件提交,commit-msg 的 scope 检查实测打印「7 文件」
 * (= 我们 4 + 别人 3),正是本型。
 *
 * 判据纪律(§22c):不在测试里重写"怎样算可用指针" —— 条件块从 `.husky/commit-msg` 与
 * `.husky/pre-commit` 各读真身,并要求**两份逐字同形**(漂移由本测试钉住);行为面用 `sh`
 * 真跑条件块,消费面用**真** scope 脚本 + 真 git 临时索引证明"临时索引在位时只读临时索引"。
 *
 * 夹具走 `scripts/lib/scratch-dir.mjs`,不动真仓、不动共享索引。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const HOOK_MSG = join(REPO, '.husky', 'commit-msg')
const HOOK_PRE = join(REPO, '.husky', 'pre-commit')
const SCOPE = join(REPO, 'scripts', 'check-commit-scope-consistency.mjs')

/** 两枚钩子共用的条件块(真身逐字,不在测试里另写判据)。 */
const BLOCK =
  'if [ -z "$GIT_INDEX_FILE" ] || [ ! -f "$GIT_INDEX_FILE" ]; then\n  unset GIT_INDEX_FILE\nfi'

const plain = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')

function git(dir, args, env = {}) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:\n${r.stdout}\n${r.stderr}`)
  return (r.stdout || '').trim()
}

function sh(script, env) {
  const r = spawnSync('sh', ['-c', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })
  assert.equal(r.status, 0, `sh 失败:\n${r.stderr}`)
  return (r.stdout || '').trim()
}

test('① 两枚钩子的条件块逐字同形,且 commit-msg 不得回到无条件 unset', () => {
  const msg = readFileSync(HOOK_MSG, 'utf8')
  const pre = readFileSync(HOOK_PRE, 'utf8')
  assert.ok(msg.includes(BLOCK), 'commit-msg 必须含与 pre-commit 同形的条件块')
  assert.ok(pre.includes(BLOCK), 'pre-commit 必须含条件块')
  assert.doesNotMatch(
    msg,
    /unset\s+GIT_DIR\s+GIT_WORK_TREE\s+GIT_INDEX_FILE/,
    'commit-msg 不得存在无条件 unset GIT_INDEX_FILE 的旧写法',
  )
})

test('② 判据行为:现存指针保留原值,空/陈旧指针清掉', () => {
  const dir = mkScratch('commit-msg-idx-')
  try {
    const live = join(dir, 'live-index')
    writeFileSync(live, 'x', 'utf8')
    const probe = `${BLOCK}\nprintf '%s' "\${GIT_INDEX_FILE:-}"`
    const env = (v) => ({ ...process.env, GIT_INDEX_FILE: v })
    assert.equal(sh(probe, env(live)), live, '现存指针必须原样保留')
    assert.equal(sh(probe, env(join(dir, 'missing-index'))), '', '陈旧指针必须清掉')
    assert.equal(sh(probe, env('')), '', '空指针必须清掉')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('③ 真 scope 脚本:临时索引在位时只读临时索引,不读真实索引', () => {
  const dir = mkScratch('commit-msg-scope-')
  try {
    const repo = join(dir, 'repo')
    mkdirSync(repo, { recursive: true })
    git(repo, ['init', '-q'])
    git(repo, ['config', 'user.name', 'fixture'])
    git(repo, ['config', 'user.email', 'fixture@example.invalid'])
    for (const [name, text] of [
      ['A.txt', 'a\n'],
      ['B.txt', 'b\n'],
      ['C.txt', 'c\n'],
      ['D.txt', 'd\n'],
    ]) {
      writeFileSync(join(repo, name), text, 'utf8')
    }
    git(repo, ['add', '-A'])
    git(repo, ['commit', '-qm', 'base'])

    // 真实索引:B + D 两枚已暂存(模拟并发会话压在共享索引上的改动)
    writeFileSync(join(repo, 'B.txt'), 'b2\n', 'utf8')
    writeFileSync(join(repo, 'D.txt'), 'd2\n', 'utf8')
    git(repo, ['add', '--', 'B.txt', 'D.txt'])

    // 临时索引:从真实索引拷一份,再 reset 回 HEAD、只 add C ⇒ 仅 1 枚
    const tempIndex = join(dir, 'tmp-index')
    copyFileSync(join(repo, '.git', 'index'), tempIndex)
    git(repo, ['reset', '-q'], { GIT_INDEX_FILE: tempIndex })
    writeFileSync(join(repo, 'C.txt'), 'c2\n', 'utf8')
    git(repo, ['add', '--', 'C.txt'], { GIT_INDEX_FILE: tempIndex })

    const msgFile = join(dir, 'msg.txt')
    writeFileSync(msgFile, 'fix(hooks): fixture\n', 'utf8')

    const run = (withPointer) => {
      const env = { ...process.env }
      delete env.GIT_INDEX_FILE
      if (withPointer) env.GIT_INDEX_FILE = tempIndex
      const r = spawnSync(process.execPath, [SCOPE, msgFile], {
        cwd: repo,
        env,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { status: r.status, out: plain(`${r.stdout || ''}${r.stderr || ''}`) }
    }

    const withTemp = run(true)
    assert.equal(withTemp.status, 0, withTemp.out)
    assert.match(withTemp.out, /\(1 文件,/, `临时索引在位 ⇒ 必须只读 C:\n${withTemp.out}`)

    const realOnly = run(false)
    assert.equal(realOnly.status, 0, realOnly.out)
    assert.match(realOnly.out, /\(2 文件,/, `对照组必须读到真实索引的 B+D:\n${realOnly.out}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
