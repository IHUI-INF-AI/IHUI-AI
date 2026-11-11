/**
 * DBG-99:fsck 软调用不看退出码。崩溃或输出不可信时必须未判定退出,
 * 不得把空 stdout 印成 `to backup: 0` 再退出 0。
 *
 * 三格必须同时在(缺一格就能被一种坏实现骗过):
 *   A 命令失败 / 输出不可信(含非 0 且 stdout 空)⇒ exit 2,点名未判定,unreach 为 null
 *   B RC=0 且 stdout 空 ⇒ 真的零悬空,不得写成恒红
 *   C RC=2 且 stdout 有完整清单 ⇒ 当正常读数取用 hash(本仓 broken link 的真实形态)
 *
 * 夹具仓 CLI 只在 mkScratch 里跑 fsck / tag,cwd 断言为该夹具,不碰产品仓库。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as tool } from '../backup-unreachable-commits.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'backup-unreachable-commits.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')
const H1 = 'a'.repeat(40)
const H2 = 'b'.repeat(40)

function assertUndetermined(spawnResult, reasonNeedle) {
  const d = tool.decideFsck(spawnResult)
  assert.equal(d.exitCode, 2)
  assert.match(d.message, /未判定/)
  assert.equal(d.unreach, null)
  assert.equal(d.message.includes('to backup:'), false)
  if (reasonNeedle) assert.match(d.message, reasonNeedle)
  return d
}

function git(cwd, args) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} exit=${r.status}\n${r.stderr}`)
  return r
}

function initRepo(dir) {
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'test@test.com'])
  git(dir, ['config', 'user.name', 'test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.hooksPath', '.git/hooks'])
}

function assertScratchRepo(dir) {
  const top = git(dir, ['rev-parse', '--show-toplevel']).stdout.trim()
  assert.equal(realpathSync(top), realpathSync(dir))
}

function runScript(cwd) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60_000,
    env: { ...process.env, IHUI_UNREACHABLE_BACKUP_PREFIX: 'unreachable-commits-backup/' },
  })
}

test('A 崩溃且 stdout 为空 ⇒ 未判定,不得读成 to backup: 0', () => {
  assertUndetermined(
    {
      error: Object.assign(new Error('spawnSync git EBUSY'), { code: 'EBUSY' }),
      status: null,
      signal: null,
      stdout: '',
      stderr: '',
    },
    /EBUSY/,
  )
})

test('A Windows fastfail 退出码 + 空 stdout ⇒ 未判定', () => {
  assertUndetermined({ status: 3221225773, signal: null, stdout: '', stderr: '' }, /3221225773/)
})

test('A 非 0 且 stdout 为空或只有空白 ⇒ 未判定', () => {
  assertUndetermined({ status: 2, stdout: '', stderr: '' }, /退出码 2/)
  assertUndetermined({ status: 1, stdout: '\n\n', stderr: '' }, /退出码 1/)
})

test('A 无退出码 / stdout 不可读 / 没有派生结果 ⇒ 未判定', () => {
  assertUndetermined({ status: null, stdout: '', stderr: '' }, /未取得退出码/)
  assertUndetermined({ status: 0, stdout: null, stderr: '' }, /stdout 不可读/)
  assertUndetermined(null, /没有派生结果/)
})

test('A stderr 含 fatal ⇒ 未判定,即使 stdout 里夹了悬空行', () => {
  assertUndetermined(
    {
      status: 128,
      stdout: `unreachable commit ${H1}\n`,
      stderr: 'fatal: not a git repository\n',
    },
    /fatal/,
  )
})

test('A 被信号终止或 maxBuffer 截断 ⇒ 半截清单也不可信', () => {
  assertUndetermined(
    { status: null, signal: 'SIGTERM', stdout: `unreachable commit ${H1}\n`, stderr: '' },
    /SIGTERM/,
  )
  assertUndetermined(
    {
      error: Object.assign(new Error('spawnSync maxBuffer exceeded'), { code: 'ENOBUFS' }),
      status: null,
      stdout: `unreachable commit ${H1}\n`,
      stderr: '',
    },
    /maxBuffer/,
  )
})

test('B RC=0 且 stdout 空 ⇒ 真的零悬空', () => {
  const d = tool.decideFsck({ status: 0, stdout: '', stderr: '' })
  assert.equal(d.exitCode, 0)
  assert.equal(d.message, '')
  assert.deepEqual(d.unreach, [])
})

test('C RC=2 且 stdout 有完整清单 ⇒ 取用 hash,不因退出码丢弃', () => {
  const stdout = [
    `unreachable commit ${'a'.repeat(39)}`,
    `unreachable commit ${H1}`,
    `unreachable tree ${'c'.repeat(40)}`,
    `broken link from tree ${'d'.repeat(40)}`,
    `unreachable commit ${H2}`,
    '',
  ].join('\n')
  const d = tool.decideFsck({ status: 2, stdout, stderr: 'warning: something\n' })
  assert.equal(d.exitCode, 0)
  assert.deepEqual(d.unreach, [H1, H2])
})

test('C RC=2 但只有 broken link、没有悬空 commit ⇒ 可信的零', () => {
  const stdout = `broken link from tree ${'d'.repeat(40)}\n              to blob ${'e'.repeat(40)}\n`
  const d = tool.decideFsck({ status: 2, stdout, stderr: '' })
  assert.equal(d.exitCode, 0)
  assert.deepEqual(d.unreach, [])
})

test('形状锁:fsck 先裁决再打印 to backup,且不再走 runGitSoft', () => {
  assert.equal(SRC.includes('function runGitSoft'), false)
  assert.match(SRC, /const judged = judgeFsckSpawn\(spawnResult\)/)
  assert.match(SRC, /const decision = decideFsck\(fsckSpawn\)/)
  const callAt = SRC.lastIndexOf('decideFsck(')
  const exitAt = SRC.indexOf('process.exit(decision.exitCode)')
  const backupAt = SRC.indexOf("console.log('to backup:'")
  assert.ok(callAt !== -1 && exitAt !== -1 && backupAt !== -1)
  assert.ok(callAt < exitAt)
  assert.ok(exitAt < backupAt)
  assert.match(
    SRC,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
  )
  assert.match(SRC, /if \(isDirectRun\) \{/)
})

test('夹具仓:fsck 真跑完且零悬空 ⇒ 退出 0 且 to backup: 0,不打 tag', () => {
  const dir = mkScratch('ihui-unreach-zero-')
  try {
    initRepo(dir)
    writeFileSync(join(dir, 'README.md'), '# init\n')
    git(dir, ['add', 'README.md'])
    git(dir, ['commit', '-m', 'init'])
    assertScratchRepo(dir)
    const r = runScript(dir)
    assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`)
    assert.match(r.stdout, /to backup: 0/)
    assert.match(r.stdout, /tags created: 0/)
    assert.doesNotMatch(`${r.stdout}\n${r.stderr}`, /未判定/)
    const tags = git(dir, ['for-each-ref', 'refs/tags/unreachable-commits-backup', '--format=%(refname)'])
    assert.equal(tags.stdout.trim(), '')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('夹具仓:悬空 commit 仍打 tag,且 toplevel 不是产品仓库', () => {
  const dir = mkScratch('ihui-unreach-one-')
  try {
    initRepo(dir)
    writeFileSync(join(dir, 'README.md'), '# init\n')
    git(dir, ['add', 'README.md'])
    git(dir, ['commit', '-m', 'init'])
    writeFileSync(join(dir, 'README.md'), '# second\n')
    git(dir, ['add', 'README.md'])
    git(dir, ['commit', '-m', 'second'])
    const dangling = git(dir, ['rev-parse', 'HEAD']).stdout.trim()
    git(dir, ['reset', '--hard', 'HEAD~1'])
    assertScratchRepo(dir)
    const r = runScript(dir)
    assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`)
    assert.match(r.stdout, /to backup: [1-9]/)
    assert.doesNotMatch(`${r.stdout}\n${r.stderr}`, /未判定/)
    const tagged = git(dir, [
      'for-each-ref',
      'refs/tags/unreachable-commits-backup',
      '--format=%(objectname)',
    ])
    assert.match(tagged.stdout, new RegExp(dangling))
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
