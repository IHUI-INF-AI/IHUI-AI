// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-94: git-push-converge 的 lease 必须带上一次确认过的远端 sha,
 * 对象缺失时的 fetch 必须写回 refs/remotes/<remote>/<branch>,不能只写 FETCH_HEAD。
 *
 * 夹具远端一律叫 leasebare,且 URL 必须落在 scratch 里。
 * 故意不用 origin:脚本在「本地领先」分支会把 origin 交给 git-push-guard,
 * 那条腿按脚本自身位置找真仓。本文件禁止 import 被测脚本(顶层会按默认档碰 origin)。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { maskComments } from '../lib/code-mask.mjs'
import { gitCandidateOrder } from '../lib/gitdir.mjs'
import { mkScratch, rmScratch, SCRATCH_DIR_NAME } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const TOOL = join(REPO, 'scripts', 'git-push-converge.mjs')
const REMOTE = 'leasebare'
const BRANCH = 'main'
const TRACKING = `refs/remotes/${REMOTE}/${BRANCH}`
const REFSPEC = `+refs/heads/${BRANCH}:${TRACKING}`
const LEAKED = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
]

function findRealGit() {
  const env = { ...process.env }
  delete env.GIT_BIN
  delete env.IHUI_PORTABLE_GIT
  for (const candidate of gitCandidateOrder(env)) {
    try {
      const version = execFileSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 15_000,
      })
      if (String(version).includes('git version')) return candidate
    } catch {
      /* 下一候选 */
    }
  }
  return null
}

const REAL_GIT = findRealGit()

function baseEnv(extra = {}) {
  const env = { ...process.env, ...extra }
  for (const key of LEAKED) delete env[key]
  return env
}

function git(cwd, args) {
  assert.ok(REAL_GIT, '找不到会打印 git version 的真 git')
  return execFileSync(REAL_GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60_000,
    env: baseEnv(),
  }).trim()
}

function hasObject(cwd, sha) {
  const result = spawnSync(REAL_GIT, ['-c', 'safe.directory=*', 'cat-file', '-e', sha], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 30_000,
    env: baseEnv(),
  })
  return result.status === 0
}

const INTERCEPTOR_LINES = [
  "'use strict'",
  "const { spawnSync } = require('node:child_process')",
  "const { appendFileSync, existsSync, writeFileSync } = require('node:fs')",
  "const { basename, join } = require('node:path')",
  'const raw = process.argv.slice(1)',
  "const cmd = basename(raw[0] || '')",
  'const gitArgv = [cmd].concat(raw.slice(1))',
  "const passthrough = new Set(['rev-parse', 'ls-remote', 'cat-file', 'fetch', 'merge-base', 'push'])",
  'if (passthrough.has(cmd)) {',
  '  const real = process.env.IHUI_REAL_GIT',
  '  const log = process.env.IHUI_GIT_SHIM_LOG',
  '  if (!real) {',
  "    process.stderr.write('shim: IHUI_REAL_GIT missing\\n')",
  '    process.exit(1)',
  '  }',
  "  if (log) appendFileSync(log, JSON.stringify(gitArgv) + '\\n', 'utf8')",
  "  const run = spawnSync(real, gitArgv, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })",
  "  if (cmd === 'ls-remote' && process.env.IHUI_LEASE_ADVANCE === '1' && run.status === 0) {",
  '    const repo = process.env.IHUI_LEASE_ADVANCE_CWD',
  '    const marker = process.env.IHUI_LEASE_ADVANCE_MARKER',
  '    if (repo && marker && !existsSync(marker)) {',
  "      writeFileSync(marker, '1', 'utf8')",
  "      appendFileSync(join(repo, 'advanced.txt'), 'advanced\\n', 'utf8')",
  '      const gitIn = (args) =>',
  '        spawnSync(real, ["-c", "safe.directory=*", "-C", repo].concat(args), {',
  "          windowsHide: true,",
  "          stdio: ['ignore', 'pipe', 'pipe'],",
  '        })',
  "      const added = gitIn(['add', 'advanced.txt'])",
  "      const committed = gitIn(['commit', '-qm', 'advanced-by-other'])",
  "      const pushed = gitIn(['push', 'origin', 'HEAD:refs/heads/main'])",
  '      if (log) {',
  "        const err = String(committed.stderr || '') + String(pushed.stderr || '')",
  '        appendFileSync(',
  '          log,',
  '          JSON.stringify({',
  '            advance: true,',
  '            add: added.status,',
  '            commit: committed.status,',
  '            push: pushed.status,',
  '            err: err.slice(0, 500),',
  "          }) + '\\n',",
  "          'utf8',",
  '        )',
  '      }',
  '    }',
  '  }',
  '  if (run.stdout && run.stdout.length) process.stdout.write(run.stdout)',
  '  if (run.stderr && run.stderr.length) process.stderr.write(run.stderr)',
  '  process.exit(typeof run.status === "number" ? run.status : 1)',
  '}',
  '',
]

let shimState = null

function installShim() {
  assert.ok(REAL_GIT, '找不到真 git,不能把 node 自己当成远端')
  const root = mkScratch('dbg94-shim-')
  const exe = join(root, process.platform === 'win32' ? 'git-shim.exe' : 'git-shim')
  const source = join(root, 'git-shim.cjs')
  writeFileSync(source, INTERCEPTOR_LINES.join('\n'), 'utf8')
  try {
    linkSync(process.execPath, exe)
  } catch {
    copyFileSync(process.execPath, exe)
  }
  const nodeOptions = `--require ${source.replaceAll('\\', '/')}`
  const probe = spawnSync(exe, ['rev-parse', '--is-bare-repository'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 30_000,
    env: baseEnv({
      GIT_BIN: exe,
      IHUI_REAL_GIT: REAL_GIT,
      NODE_OPTIONS: nodeOptions,
      NODE_NO_WARNINGS: '1',
    }),
  })
  const probeText = `${probe.stdout || ''}\n${probe.stderr || ''}`
  assert.doesNotMatch(probeText, /Cannot find module/, `git 垫片没接上真 git:\n${probeText}`)
  assert.match(probeText, /not a git repository|false/i, `垫片没有把 rev-parse 交给真 git:\n${probeText}`)
  return { root, exe, nodeOptions }
}

test.before(() => {
  if (!REAL_GIT) return
  shimState = installShim()
})

test.after(() => {
  if (shimState) rmScratch(shimState.root)
})

function readLog(logPath) {
  if (!existsSync(logPath)) return { argvs: [], notes: [] }
  const argvs = []
  const notes = []
  for (const line of readFileSync(logPath, 'utf8').split(/\n/)) {
    if (!line.trim()) continue
    const value = JSON.parse(line)
    if (Array.isArray(value)) argvs.push(value)
    else notes.push(value)
  }
  return { argvs, notes }
}

function assertLocalBare(local) {
  assert.ok(String(local).includes(SCRATCH_DIR_NAME), `root 不在 scratch:${local}`)
  const url = git(local, ['remote', 'get-url', REMOTE])
  assert.ok(url.includes(SCRATCH_DIR_NAME), `远端不是 scratch 裸仓:${url}`)
  assert.doesNotMatch(url, /github\.com|aizhs\.top|gitee\.com|gitcode\.com/i, url)
}

function runTool(fix, extraArgs, extraEnv = {}) {
  assert.ok(shimState, '垫片没装上')
  assertLocalBare(fix.local)
  const log = join(fix.root, 'shim.log')
  const result = spawnSync(
    process.execPath,
    [
      TOOL,
      `--root=${fix.local}`,
      `--remotes=${REMOTE}`,
      `--branch=${BRANCH}`,
      '--timeout=60000',
      ...extraArgs,
    ],
    {
      cwd: fix.local,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 120_000,
      env: baseEnv({
        GIT_BIN: shimState.exe,
        IHUI_REAL_GIT: REAL_GIT,
        IHUI_GIT_SHIM_LOG: log,
        NODE_OPTIONS: shimState.nodeOptions,
        NODE_NO_WARNINGS: '1',
        HUSKY: '0',
        ...extraEnv,
      }),
    },
  )
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    out: `${result.stdout || ''}${result.stderr || ''}`,
    log,
  }
}

function leaseExpect(pushArgv) {
  return pushArgv.find((arg) => arg.startsWith('--force-with-lease=')) || ''
}

function divergedFixture(t) {
  const root = mkScratch('dbg94-lease-')
  t.after(() => rmScratch(root))
  const bare = join(root, 'bare.git')
  const local = join(root, 'local')
  const other = join(root, 'other')
  const hooks = join(root, 'no-hooks')
  mkdirSync(hooks, { recursive: true })
  git(root, ['init', '-q', '--bare', '-b', 'main', 'bare.git'])
  mkdirSync(local, { recursive: true })
  git(local, ['init', '-q', '-b', 'main'])
  git(local, ['config', 'user.email', 'probe@example.invalid'])
  git(local, ['config', 'user.name', 'probe'])
  git(local, ['config', 'core.hooksPath', hooks])
  writeFileSync(join(local, 'a.txt'), 'base\n', 'utf8')
  git(local, ['add', 'a.txt'])
  git(local, ['commit', '-qm', 'base'])
  const base = git(local, ['rev-parse', 'HEAD'])
  git(local, ['remote', 'add', REMOTE, bare])
  git(local, ['push', '-q', REMOTE, `HEAD:refs/heads/${BRANCH}`])
  git(root, ['clone', '-q', bare, 'other'])
  git(other, ['config', 'user.email', 'probe@example.invalid'])
  git(other, ['config', 'user.name', 'probe'])
  git(other, ['config', 'core.hooksPath', hooks])
  writeFileSync(join(other, 'theirs.txt'), 'theirs\n', 'utf8')
  git(other, ['add', 'theirs.txt'])
  git(other, ['commit', '-qm', 'theirs'])
  git(other, ['push', '-q', 'origin', `HEAD:refs/heads/${BRANCH}`])
  const theirs = git(other, ['rev-parse', 'HEAD'])
  writeFileSync(join(local, 'ours.txt'), 'ours\n', 'utf8')
  git(local, ['add', 'ours.txt'])
  git(local, ['commit', '-qm', 'ours'])
  const ours = git(local, ['rev-parse', 'HEAD'])
  assert.equal(git(local, ['rev-parse', 'HEAD^']), base)
  assert.equal(git(other, ['rev-parse', 'HEAD^']), base)
  assert.equal(git(local, ['rev-parse', TRACKING]), base, '推完 base 后跟踪 ref 不应已被 theirs 覆盖')
  assert.equal(hasObject(local, theirs), false, '夹具必须让远端 tip 的对象先不在本地,才会走进 fetch')
  assert.equal(git(bare, ['rev-parse', 'HEAD']), theirs)
  return { root, bare, local, other, base, theirs, ours }
}

test('无 lease 旗:卸掉配置的 fetch refspec 后,非快进也能把跟踪 ref 刷到远端 tip,且不推送', (t) => {
  const fix = divergedFixture(t)
  git(fix.local, ['update-ref', TRACKING, fix.ours])
  git(fix.local, ['config', '--unset', `remote.${REMOTE}.fetch`])
  const ran = runTool(fix, [])
  assert.equal(ran.status, 1, ran.out)
  assert.match(ran.out, /DIVERGED/)
  assert.doesNotMatch(ran.out, /FORCE_PUSHED|经 guard/)
  assert.equal(git(fix.local, ['rev-parse', TRACKING]), fix.theirs, '跟踪 ref 仍停在旧值,说明 fetch 只写了 FETCH_HEAD')
  assert.equal(git(fix.bare, ['rev-parse', 'HEAD']), fix.theirs, '没带 lease 旗不得推动裸仓')
  const { argvs } = readLog(ran.log)
  assert.equal(
    argvs.some((argv) => argv[0] === 'push'),
    false,
    `默认档出现了 push:${JSON.stringify(argvs)}`,
  )
  assert.ok(
    argvs.some((argv) => argv[0] === 'fetch' && argv.includes(REFSPEC)),
    `fetch 没有带目标 refspec ${REFSPEC}:\n${JSON.stringify(argvs)}`,
  )
  assert.equal(
    argvs.some((argv) => argv[0] === 'fetch' && argv.includes(BRANCH) && !argv.includes(REFSPEC)),
    false,
    '仍在用无目标 refspec 的 fetch',
  )
})

test('显式 lease:跟踪 ref 陈旧且对象已在本地时,按 ls-remote 的 sha 强推,不读跟踪 ref', (t) => {
  const fix = divergedFixture(t)
  git(fix.local, ['fetch', REMOTE])
  assert.equal(hasObject(fix.local, fix.theirs), true)
  git(fix.local, ['update-ref', TRACKING, fix.base])
  assert.equal(git(fix.local, ['rev-parse', TRACKING]), fix.base)
  const ran = runTool(fix, ['--force-with-lease'])
  assert.equal(ran.status, 0, ran.out)
  assert.match(ran.out, /FORCE_PUSHED/)
  assert.doesNotMatch(ran.out, /经 guard/)
  assert.equal(git(fix.bare, ['rev-parse', 'HEAD']), fix.ours)
  const { argvs } = readLog(ran.log)
  assert.equal(
    argvs.some((argv) => argv[0] === 'fetch'),
    false,
    '对象已在本地仍去 fetch,lease 期望就可能被刷成更新的 tip',
  )
  const pushes = argvs.filter((argv) => argv[0] === 'push')
  assert.equal(pushes.length, 1, JSON.stringify(argvs))
  const push = pushes[0]
  assert.equal(leaseExpect(push), `--force-with-lease=refs/heads/${BRANCH}:${fix.theirs}`)
  assert.equal(push.includes('--force-with-lease'), false, '裸 --force-with-lease 仍在 argv 里')
  assert.equal(push.includes('--force'), false, '退成了 --force')
  assert.ok(push.includes(REMOTE))
  assert.ok(push.includes(`HEAD:refs/heads/${BRANCH}`))
})

test('ls-remote 确认之后远端又被推进:期望仍是确认过的旧 sha,新 tip 不被覆盖', (t) => {
  const fix = divergedFixture(t)
  const marker = join(fix.root, 'advance.marker')
  const ran = runTool(fix, ['--force-with-lease'], {
    IHUI_LEASE_ADVANCE: '1',
    IHUI_LEASE_ADVANCE_CWD: fix.other,
    IHUI_LEASE_ADVANCE_MARKER: marker,
  })
  const { argvs, notes } = readLog(ran.log)
  const advance = notes.find((note) => note.advance)
  assert.ok(advance, `垫片没有在 ls-remote 之后推进远端:${JSON.stringify(notes)}`)
  assert.equal(advance.push, 0, `垫片推进失败:${advance.err}`)
  const tip = git(fix.bare, ['rev-parse', 'HEAD'])
  assert.notEqual(tip, fix.theirs)
  assert.notEqual(tip, fix.ours, 'lease 用跟踪 ref 上的新 tip 通过了,他人提交被覆盖')
  assert.equal(git(fix.bare, ['log', '-1', '--format=%s']), 'advanced-by-other')
  git(fix.bare, ['merge-base', '--is-ancestor', fix.theirs, 'HEAD'])
  assert.equal(ran.status, 1, ran.out)
  assert.doesNotMatch(ran.out, /FORCE_PUSHED/)
  assert.match(ran.out, /lease 强推未成功/)
  const pushes = argvs.filter((argv) => argv[0] === 'push')
  assert.equal(pushes.length, 1, JSON.stringify(argvs))
  assert.equal(leaseExpect(pushes[0]), `--force-with-lease=refs/heads/${BRANCH}:${fix.theirs}`)
  assert.equal(pushes[0].includes('--force'), false)
  assert.ok(
    argvs.some((argv) => argv[0] === 'fetch' && argv.includes(REFSPEC)),
    `竞态路径的 fetch 没有更新跟踪 ref:${JSON.stringify(argvs)}`,
  )
})

test('ls-remote 拿不到 sha 时,带了 lease 旗也不得推', (t) => {
  const root = mkScratch('dbg94-empty-')
  t.after(() => rmScratch(root))
  const local = join(root, 'local')
  const hooks = join(root, 'no-hooks')
  mkdirSync(hooks, { recursive: true })
  git(root, ['init', '-q', '--bare', '-b', 'main', 'bare.git'])
  mkdirSync(local, { recursive: true })
  git(local, ['init', '-q', '-b', 'main'])
  git(local, ['config', 'user.email', 'probe@example.invalid'])
  git(local, ['config', 'user.name', 'probe'])
  git(local, ['config', 'core.hooksPath', hooks])
  writeFileSync(join(local, 'a.txt'), 'only-local\n', 'utf8')
  git(local, ['add', 'a.txt'])
  git(local, ['commit', '-qm', 'only-local'])
  git(local, ['remote', 'add', REMOTE, join(root, 'bare.git')])
  const listed = spawnSync(REAL_GIT, ['-c', 'safe.directory=*', 'ls-remote', REMOTE, `refs/heads/${BRANCH}`], {
    cwd: local,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 30_000,
    env: baseEnv(),
  })
  assert.equal(listed.status, 0, listed.stderr)
  assert.equal(listed.stdout.trim(), '', '空裸仓不应已经有分支,否则这条不再是「拿不到 sha」')
  const ran = runTool({ root, local }, ['--force-with-lease'])
  assert.equal(ran.status, 1, ran.out)
  assert.match(ran.out, /未拿到已确认的远端 sha,不得 lease 强推/)
  assert.match(ran.out, /DIVERGED/)
  assert.doesNotMatch(ran.out, /FORCE_PUSHED|经 guard/)
  const { argvs } = readLog(ran.log)
  assert.equal(
    argvs.some((argv) => argv[0] === 'push'),
    false,
    `没确认到 sha 仍然推了:${JSON.stringify(argvs)}`,
  )
  const remoteTip = spawnSync(
    REAL_GIT,
    ['-c', 'safe.directory=*', 'rev-parse', `refs/heads/${BRANCH}`],
    {
      cwd: join(root, 'bare.git'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 30_000,
      env: baseEnv(),
    },
  )
  assert.notEqual(remoteTip.status, 0, '空分支被推出去了')
})

test('源码形状:显式期望、确认失败则不推、fetch 带目标 refspec、没有裸 force', () => {
  const code = maskComments(readFileSync(TOOL, 'utf8'))
  const leaseAt = code.indexOf('if (allowLease)')
  assert.ok(leaseAt > 0, '找不到 lease 分支')
  const lease = code.slice(leaseAt, leaseAt + 1200)
  assert.match(lease, /confirmedRemoteSha\(remoteSha\)/)
  assert.match(lease, /--force-with-lease=refs\/heads\/\$\{branch\}:\$\{expectSha\}/)
  assert.match(lease, /未拿到已确认的远端 sha,不得 lease 强推/)
  assert.doesNotMatch(lease, /'--force-with-lease',/)
  assert.doesNotMatch(code, /--force(?!-with-lease)/)
  assert.match(
    code,
    /\+refs\/heads\/\$\{branchName\}:refs\/remotes\/\$\{remoteName\}\/\$\{branchName\}/,
  )
  assert.doesNotMatch(code, /git\(\['fetch', remote, branch\]/)
  assert.match(code, /'--force-with-lease'/, '布尔旗本身还在;默认档不能改成强推')
  const flagAt = code.indexOf('KNOWN_BOOLEAN_FLAGS')
  assert.ok(flagAt > 0 && flagAt < leaseAt, 'lease 旗必须仍是显式打开的布尔旗,不能变成默认动作')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
