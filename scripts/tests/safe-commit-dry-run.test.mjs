// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/safe-commit.mjs --dry-run` 的**零写副作用**镜像测试(2026-11-04 立)。
 *
 * 事故(票面):某会话执行 `safe-commit.mjs --dry-run`,Step 1 的 `git reset HEAD` **真的执行了**,
 * 清空共享暂存区,抹掉其他会话 4 项「暂存删除」的意图(`.ihui-agent/tmp/dead-refs/safe-dry.log`)。
 * 改前的 dry-run 判据只落在 Step 4 之前一行 —— 它前面的锁 / reset / add / README 回写全都真跑了。
 *
 * 本文件钉死三件事:
 *   ① **零写**:dry-run 前后 `git status --short` 逐字节一致、`.git/index` 字节哈希一致,
 *      且他人的暂存删除仍是 `D `(没被 reset 摘掉);不产生锁文件 / 台账。
 *   ② **计划会被拒 ⇒ exit 1 且零写**:声明一个工作树与 HEAD 无差的文件,真实运行会在 Step 3b
 *      判"未暂存",dry-run 必须给出同一结论(1),而不是 exit 0。
 *   ③ **计划可行 ⇒ exit 0**:声明一个真实改动的文件,dry-run 输出"将执行的命令 + 影响路径清单"。
 *
 * 全程只在 `mkScratch` 的临时 git 仓里跑,**不动真仓、不动共享索引、不 push、不跑非 dry-run**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')

const git = (dir, ...args) => {
  const r = spawnSync('git', ['--no-optional-locks', '-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 << 20,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:\n${r.stdout}\n${r.stderr}`)
  return (r.stdout || '').trim()
}
const plain = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')
const outputOf = (r) => plain(`${r.stdout || ''}${r.stderr || ''}`)
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

async function dropRepo(dir) {
  for (let i = 0; i < 10; i++) {
    try {
      rmScratch(dir)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  rmScratch(dir, { bestEffort: true })
}

/** 造一个临时仓,并把 safe-commit 连同相对 import 闭包拷进 `<仓>/scripts/`(它按自身位置推仓根)。 */
function makeRepo(t) {
  const dir = mkScratch('safe-dry-')
  t.after(() => dropRepo(dir))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  git(dir, 'init', '-q', '.')
  git(dir, 'config', 'user.name', 'fixture')
  git(dir, 'config', 'user.email', 'fixture@example.invalid')
  git(dir, 'config', 'commit.gpgsign', 'false')
  copyScriptWithClosure(SCRIPTS, 'safe-commit.mjs', join(dir, 'scripts'))
  // 非 dry-run 的路径会按路径 spawn 它(dry-run 刻意不加锁,但拷上不影响本节判据)。
  copyScriptWithClosure(SCRIPTS, 'git-lock.mjs', join(dir, 'scripts'))
  return dir
}

function runDry(dir, files, { message = 'chore: fixture' } = {}) {
  return spawnSync(
    process.execPath,
    [join(dir, 'scripts', 'safe-commit.mjs'), '--dry-run', '-m', message, '--', ...files],
    {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        IHUI_GIT_LOCK_UNIT: '',
        AGENT_SCOPE: '',
        AGENT_NAME: '',
        AGENT_SCOPE_OVERRIDE: '',
        LIVE_SHA_ALLOW: '',
        IHUI_SKIP_LIVE_DOC_CHECK: '',
        IHUI_SKIP_README_NUMBERS_SYNC: '',
      },
    },
  )
}

/** 现状快照:status 文本 + index 字节哈希(两者都对"有没有写"敏感)。 */
function snapshot(dir) {
  const status = git(dir, 'status', '--short')
  const indexPath = join(dir, '.git', 'index')
  const indexHash = existsSync(indexPath) ? sha256(readFileSync(indexPath)) : '(no index)'
  return { status, indexHash }
}

function stagedNameStatus(dir) {
  return git(dir, 'diff', '--cached', '--name-status', '--no-renames', '-z')
    .split('\0')
    .filter(Boolean)
}

/** 基线:base.txt 日后做"他人暂存删除",keep.txt 做"他人暂存修改",mine.txt 做本票改动。 */
function seed(dir) {
  writeFileSync(join(dir, 'base.txt'), 'base\n')
  writeFileSync(join(dir, 'keep.txt'), 'keep-v1\n')
  writeFileSync(join(dir, 'mine.txt'), 'mine-v1\n')
  git(dir, 'add', '-A', '--', 'base.txt', 'keep.txt', 'mine.txt')
  git(dir, 'commit', '-qm', 'seed')
}

test('DRY1 零写:他人暂存删除/修改不被 reset,status 与 index 逐字节不变', (t) => {
  const dir = makeRepo(t)
  seed(dir)
  writeFileSync(join(dir, 'mine.txt'), 'mine-v2\n') // 本票声明的改动(未暂存)
  writeFileSync(join(dir, 'keep.txt'), 'keep-v2\n')
  git(dir, 'add', '--', 'keep.txt') // 他人暂存修改(M )
  git(dir, 'rm', '-q', '--', 'base.txt') // 他人暂存删除(D )

  const before = snapshot(dir)
  const NS_BEFORE = ['D', 'base.txt', 'M', 'keep.txt']
  assert.deepEqual(stagedNameStatus(dir), NS_BEFORE)

  const r = runDry(dir, ['mine.txt'])
  const out = outputOf(r)
  assert.equal(r.status, 0, `dry-run 计划可行应 exit 0,实际 ${r.status}:\n${out}`)

  const after = snapshot(dir)
  assert.equal(after.indexHash, before.indexHash, 'dry-run 改写了 .git/index 字节')
  assert.equal(after.status, before.status, 'dry-run 改了 git status --short')
  // 决定性的一条:那枚暂存删除仍是 D(没被 reset 退化掉)。
  assert.deepEqual(stagedNameStatus(dir), NS_BEFORE, 'dry-run 抹掉了他人暂存删除/修改的标记')

  assert.ok(!existsSync(join(dir, '.git', 'ihui-git-write.lock')), 'dry-run 创建了 git 写锁')
  assert.ok(
    !existsSync(join(dir, '.ihui-agent', 'state', 'staged-delete-intent-ledger.jsonl')),
    'dry-run 写了删除意图台账',
  )

  // 输出必须点名"将执行"的命令与影响路径(不是沉默通过)。
  assert.match(out, /\[dry-run\] Step 0\/5 将执行: git-lock acquire/, '未打印加锁计划')
  assert.match(out, /\[dry-run\] Step 1\/5 将执行: git reset HEAD/, '未打印 reset 计划')
  assert.match(out, /\[dry-run\] Step 2\/5 将执行: git add -A/, '未打印 add 计划')
  assert.match(out, /真实运行会清空当前 2 项暂存/, '未列出 reset 影响的路径数')
  assert.match(out, /! \[D\] base\.txt/, '未点名会被丢失的暂存删除')
  assert.match(out, /\+ mine\.txt/, '未列出计划暂存的路径')
  assert.match(out, /已执行零条写命令/, '未声明零写')
})

test('DRY2 计划会被拒 ⇒ exit 1 且零写(工作树与 HEAD 无差的声明文件)', (t) => {
  const dir = makeRepo(t)
  seed(dir)
  // 造一个**已跟踪且工作树 == HEAD** 的文件:真实运行 reset 后 add 它不会产生任何暂存项,
  // Step 3b 必判"预期文件未暂存" ⇒ 计划不可行。
  writeFileSync(join(dir, 'same.txt'), 'same\n')
  git(dir, 'add', '--', 'same.txt')
  git(dir, 'commit', '-qm', 'add same')
  git(dir, 'rm', '-q', '--', 'base.txt') // 他人暂存删除,必须活到测试结束

  const before = snapshot(dir)
  const r = runDry(dir, ['same.txt'])

  const after = snapshot(dir)
  assert.equal(r.status, 1, `计划会被拒应 exit 1,实际 ${r.status}:\n${outputOf(r)}`)
  assert.match(outputOf(r), /个预期文件未暂存/)
  assert.equal(after.indexHash, before.indexHash, '被拒的 dry-run 改写了 .git/index')
  assert.equal(after.status, before.status, '被拒的 dry-run 改了 git status --short')
  assert.deepEqual(stagedNameStatus(dir), ['D', 'base.txt'], '被拒 dry-run 抹掉了他人的暂存删除')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
