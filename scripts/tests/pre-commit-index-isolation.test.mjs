// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pre-commit-index-isolation.test.mjs — `git commit --only` 必须走 git 交给钩子的临时索引(2026-11-03 立)
 *
 * 被守的缺陷(实证,不是推演):
 *   `.husky/pre-commit` 与 `scripts/lib/pre-commit-hook.js` 过去**无条件**清 GIT_INDEX_FILE。
 *   而 `git commit --only -- <路径>` 期间,git 用 GIT_INDEX_FILE 指向
 *   `<gitdir>/next-index-<pid>.lock`(只含本次路径的临时索引),同时父 git 持着
 *   `.git/index.lock`。清掉指针 ⇒ lint-staged 落到**共享真实索引**上 ⇒ 它的 `git add` /
 *   `git restore --worktree` 撞 index.lock ⇒ exit 128,并发会话互相堵死。
 *
 * 四条回归(全部用**真 git + 真 lint-staged + 真实 hook 片段**,不 mock 任何 git 命令):
 *   ① 真实索引压着 B.txt 的 staged 改动时,`git commit --only -- A.txt` 仍成功;
 *   ② 提交后 B.txt 的 staged 内容逐字节未变(比对 `git rev-parse :B.txt` 的 blob sha);
 *   ③ lint-staged 只对 A.txt 跑了任务(任务侧逐次记录 argv,出现 B/C 即失败);
 *   ④ MM 文件 C.txt(staged+unstaged)在提交 A 后,索引 blob 与工作树内容两侧都逐字节未变。
 * 另加:
 *   ⑤ 反向对照:同一夹具换成旧钩子(无条件 unset GIT_INDEX_FILE)⇒ 必撞 index.lock 且提交失败
 *      —— 证明本测试对缺陷**敏感**(改前会红,改后才是绿)。
 *
 * 关于"真实 hook":231 道守门链依赖真仓布局,临时仓结构上跑不起。本夹具因此只组装修正
 * 所在的两段真身,逐字取自生产文件、不复制判据:
 *   · `.husky/pre-commit` 的去污前导段(注释 + GIT_INDEX_FILE 条件 + unset GIT_DIR 行,逐字切出);
 *   · `scripts/lib/hook-git-env.js` 的 sanitizeGitEnv 与 `pre-commit-hook.js` 的 LINT_STAGED_CMD
 *     (前者 require 真身,后者从源码解析,命令串不必在测试里再写一份);
 * 生态位与真实 hook 相同:真 git 触发、真环境变量、真 lint-staged、真任务子进程。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const requireCjs = createRequire(import.meta.url)

const HOOK_SHELL = join(REPO_ROOT, '.husky', 'pre-commit')
const HOOK_JS = join(REPO_ROOT, 'scripts', 'lib', 'pre-commit-hook.js')
const SANITIZER = join(REPO_ROOT, 'scripts', 'lib', 'hook-git-env.js')
const LINT_STAGED_BIN = join(REPO_ROOT, 'node_modules', 'lint-staged', 'bin', 'lint-staged.js')

const SANITIZER_MODULE = requireCjs(SANITIZER)

/**
 * 从生产 hook 逐字切出「GIT_* 去污前导段」:从注释起到 `unset GIT_DIR ...` 行为止。
 * 判据不复制 —— 读的是真文件,runtime 执行的是同一串字节。
 */
function realGitEnvPrologue() {
  const lines = readFileSync(HOOK_SHELL, 'utf8').split(/\r?\n/)
  const end = lines.findIndex((line) => line.trimStart().startsWith('unset GIT_DIR'))
  assert.ok(end > 1, `.husky/pre-commit 里找不到 unset GIT_DIR 行(现读 ${lines.length} 行)`)
  // 去掉原文件的 shebang:夹具 hook 自己带 shebang。
  return lines.slice(1, end + 1).join('\n')
}

/** 从生产 hook 源码解析真实 lint-staged 调用参数(不在测试里复写命令串)。 */
function realLintStagedFlags() {
  const source = readFileSync(HOOK_JS, 'utf8')
  const matched = source.match(/const LINT_STAGED_FLAGS\s*=\s*\[([\s\S]*?)\]/)
  assert.ok(matched, 'pre-commit-hook.js 里找不到 LINT_STAGED_FLAGS')
  const flags = [...matched[1].matchAll(/'([^']*)'/g)].map((m) => m[1])
  assert.ok(flags.length > 0, 'LINT_STAGED_FLAGS 解析为空')
  return flags
}

function git(dir, args) {
  const result = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} 失败(${result.status}):${result.stderr || result.stdout}`,
    )
  }
  return result.stdout.trimEnd()
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 32)
}

function dropRepo(dir) {
  try {
    rmScratch(dir, { bestEffort: true })
  } catch {
    /* 句柄未散:交给 scratch 退出清扫兜底,测试结论不由删除决定 */
  }
}

const RECORDER_SOURCE = `import { appendFileSync } from 'node:fs'
appendFileSync(process.env.REGRESSION_LOG, JSON.stringify(process.argv.slice(2)) + '\\n')
`

/**
 * 造临时仓(仓根 = <scratch>/repo,仪器文件放 <scratch> 下,不污染仓库状态)。
 * @param {import('node:test').TestContext} t
 * @param {string} label
 */
function makeFixture(t, label) {
  if (!existsSync(LINT_STAGED_BIN)) {
    throw new Error(`缺 lint-staged 安装副本:${LINT_STAGED_BIN}(先装依赖再跑本测试)`)
  }
  const root = mkScratch(`precommit-idx-${label}-`)
  t.after(() => dropRepo(root))
  const dir = join(root, 'repo')
  mkdirSync(dir, { recursive: true })
  const witnessPath = join(root, 'witness.json')
  const shellWitnessPath = join(root, 'shell-raw-index.txt')
  const logPath = join(root, 'task-args.log')
  for (const p of [witnessPath, shellWitnessPath, logPath]) {
    writeFileSync(p, '')
  }

  git(dir, ['init', '-q', '.'])
  git(dir, ['config', 'user.name', 'fixture'])
  git(dir, ['config', 'user.email', 'fixture@example.invalid'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  // 夹具自己声明 hooksPath:全局/继承值会把钩子指到别处,这次"钩子到底跑没跑"就没正证。
  git(dir, ['config', 'core.hooksPath', join(dir, '.git', 'hooks')])

  writeFileSync(join(dir, 'A.txt'), 'base A\n')
  writeFileSync(join(dir, 'B.txt'), 'base B\n')
  writeFileSync(join(dir, 'C.txt'), 'base C\n')
  writeFileSync(join(dir, 'recorder.mjs'), RECORDER_SOURCE)
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'precommit-index-fixture',
        private: true,
        'lint-staged': { '*.txt': [`node "${join(dir, 'recorder.mjs').replace(/\\/g, '/')}"`] },
      },
      null,
      2,
    ),
  )
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'base'])

  return { root, dir, witnessPath, shellWitnessPath, logPath }
}

/** 安装 hook:一段测试仪表(只记录 git 交给钩子的原始指针,不改变行为)+ 被测 hook 正文。 */
function installHook(fixture, hookBody) {
  const hookPath = join(fixture.dir, '.git', 'hooks', 'pre-commit')
  writeFileSync(
    hookPath,
    [
      '#!/bin/sh',
      '# [夹具仪表] 记录 git 交给钩子的原始 GIT_INDEX_FILE(仅记录,不改行为)',
      `printf 'raw-index=%s\\n' "\${GIT_INDEX_FILE:-}" >> "${fixture.shellWitnessPath.replace(/\\/g, '/')}"`,
      hookBody,
      '',
    ].join('\n'),
  )
  chmodSync(hookPath, 0o755)
}

/** 生成 runner:真 sanitizeGitEnv → 记录正证 → 真 lint-staged(参数取自生产源码)。 */
function writeRunner(fixture, flags) {
  const runnerPath = join(fixture.root, 'runner.cjs')
  const source = `const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { sanitizeGitEnv } = require(${JSON.stringify(SANITIZER)})
const rawIndexFile = process.env.GIT_INDEX_FILE || null
sanitizeGitEnv(process.env)
const gitdir = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8', windowsHide: true }).stdout.trim()
fs.writeFileSync(${JSON.stringify(fixture.witnessPath)}, JSON.stringify({
  rawIndexFile,
  gitIndexFile: process.env.GIT_INDEX_FILE || null,
  indexFileExists: !!process.env.GIT_INDEX_FILE && fs.existsSync(process.env.GIT_INDEX_FILE),
  defaultIndexLockExists: fs.existsSync(path.join(gitdir, 'index.lock')),
}))
const result = spawnSync(process.execPath, [${JSON.stringify(LINT_STAGED_BIN)}, ...${JSON.stringify(flags)}], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: 'inherit',
})
process.exit(result.status === null ? 1 : result.status)
`
  writeFileSync(runnerPath, source)
  return runnerPath
}

/** B 的 staged 改动 + C 的 MM(staged+unstaged)+ A 的仅工作树改动。 */
function stageScenario(dir) {
  writeFileSync(join(dir, 'A.txt'), 'base A + worktree-only change\n')
  writeFileSync(join(dir, 'B.txt'), 'base B + STAGED B change\n')
  git(dir, ['add', '--', 'B.txt'])
  writeFileSync(join(dir, 'C.txt'), 'base C + STAGED part\n')
  git(dir, ['add', '--', 'C.txt'])
  writeFileSync(join(dir, 'C.txt'), 'base C + STAGED part + UNSTAGED extra\n')
}

function captureSnapshot(dir) {
  return {
    bIndex: git(dir, ['rev-parse', ':B.txt']),
    cIndex: git(dir, ['rev-parse', ':C.txt']),
    cWorktree: readFileSync(join(dir, 'C.txt'), 'utf8'),
    cUnstagedPatch: git(dir, ['diff', '--', 'C.txt']),
    head: git(dir, ['rev-parse', 'HEAD']),
    count: git(dir, ['rev-list', '--count', 'HEAD']),
  }
}

function commitOnlyA(dir, logPath) {
  const env = { ...process.env }
  // 会话里可能挂着 IDE 注入的 git 指针;夹具必须从"干净的父进程环境"出发,
  // 让 GIT_INDEX_FILE 只可能由 git 自己在 --only 提交时注入。
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key]
  env.REGRESSION_LOG = logPath
  return spawnSync(
    'git',
    ['-c', 'safe.directory=*', 'commit', '--only', '-m', 'only A', '--', 'A.txt'],
    {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    },
  )
}

function readTaskBases(logPath) {
  const raw = readFileSync(logPath, 'utf8').trim()
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .flat()
    .map((file) => basename(String(file).replace(/\\/g, '/')))
}

test('①②③④ 索引被占时 --only 提交成功:B 的暂存与 C 的未暂存逐字节未变,且只 lint A', (t) => {
  const fixture = makeFixture(t, 'ok')
  const flags = realLintStagedFlags()
  const runnerPath = writeRunner(fixture, flags)
  installHook(
    fixture,
    [realGitEnvPrologue(), `node "${runnerPath.replace(/\\/g, '/')}"`].join('\n'),
  )

  stageScenario(fixture.dir)
  const before = captureSnapshot(fixture.dir)
  const result = commitOnlyA(fixture.dir, fixture.logPath)
  const output = `${result.stdout || ''}${result.stderr || ''}`

  assert.equal(result.status, 0, `--only 提交应成功,实际 exit ${result.status}:\n${output}`)
  assert.match(readFileSync(fixture.shellWitnessPath, 'utf8'), /raw-index=.*next-index-\d+\.lock/)

  const witness = JSON.parse(readFileSync(fixture.witnessPath, 'utf8'))
  assert.ok(witness.rawIndexFile, '钩子没拿到 git 的临时索引指针')
  assert.match(witness.rawIndexFile.replace(/\\/g, '/'), /next-index-\d+\.lock$/)
  assert.equal(witness.indexFileExists, true, '临时索引文件不存在 ⇒ 保留的是陈旧指针')
  assert.equal(
    witness.gitIndexFile,
    witness.rawIndexFile,
    'sanitizeGitEnv 把 --only 的临时索引丢了',
  )
  assert.equal(
    witness.defaultIndexLockExists,
    true,
    '父 git 没持 .git/index.lock ⇒ 本用例没踩到"索引被占"前提',
  )

  // ② B 的 staged blob 逐字节未变(blob sha 是内容寻址,sha 相同 = 逐字节相同)
  assert.equal(
    git(fixture.dir, ['rev-parse', ':B.txt']),
    before.bIndex,
    'B.txt 的 staged 内容被改动了',
  )

  // ④ C 的索引侧与工作树侧都逐字节未变(未暂存部分绝不能被回滚)
  assert.equal(
    git(fixture.dir, ['rev-parse', ':C.txt']),
    before.cIndex,
    'C.txt 的 staged 内容被改动了',
  )
  assert.equal(
    readFileSync(join(fixture.dir, 'C.txt'), 'utf8'),
    before.cWorktree,
    'C.txt 的未暂存内容被丢弃了',
  )
  assert.equal(
    git(fixture.dir, ['diff', '--', 'C.txt']),
    before.cUnstagedPatch,
    'C.txt 的未暂存补丁被改动了',
  )

  // ③ lint-staged 的任务只收到 A.txt
  const linted = readTaskBases(fixture.logPath)
  assert.ok(linted.length > 0, 'lint-staged 任务一次都没跑')
  assert.deepEqual(
    [...new Set(linted)],
    ['A.txt'],
    `lint-staged 碰了别的文件:${JSON.stringify(linted)}`,
  )

  // 提交内容本身:只含 A(工作树内容),B/C 的暂存改动没被夹带
  const head = git(fixture.dir, ['rev-parse', 'HEAD'])
  assert.notEqual(head, before.head, 'HEAD 没前进 ⇒ 提交没落地')
  assert.equal(git(fixture.dir, ['rev-list', '--count', 'HEAD']), String(Number(before.count) + 1))
  assert.equal(git(fixture.dir, ['show', `${head}:A.txt`]), 'base A + worktree-only change')
  assert.equal(git(fixture.dir, ['show', `${head}:B.txt`]), 'base B')
  assert.equal(git(fixture.dir, ['show', `${head}:C.txt`]), 'base C')
  assert.deepEqual(
    git(fixture.dir, ['status', '--porcelain']).split(/\r?\n/).filter(Boolean).sort(),
    ['M  B.txt', 'MM C.txt'],
  )

  // 实测数据留档(事故复盘要的是"哪一份索引、哪个 sha、谁被 lint 到",不是一句绿)
  console.info(
    [
      `[evidence] GIT_INDEX_FILE=${witness.rawIndexFile}(存在=${witness.indexFileExists})`,
      `[evidence] 父 git 持有 .git/index.lock=${witness.defaultIndexLockExists}(本用例的前提)`,
      `[evidence] B staged blob ${before.bIndex} -> ${git(fixture.dir, ['rev-parse', ':B.txt'])}`,
      `[evidence] C staged blob ${before.cIndex} -> ${git(fixture.dir, ['rev-parse', ':C.txt'])}`,
      `[evidence] C 未暂存补丁 sha256=${sha256(before.cUnstagedPatch)} -> ${sha256(git(fixture.dir, ['diff', '--', 'C.txt']))}`,
      `[evidence] lint-staged 任务收到=${JSON.stringify(linted)}`,
      `[evidence] 提交 ${before.head} -> ${head}:A=worktree 内容,B/C 仍为基线`,
    ].join('\n'),
  )
})

test('⑤ 反向对照:旧钩子(无条件 unset GIT_INDEX_FILE)必撞 index.lock,提交被拦', (t) => {
  const fixture = makeFixture(t, 'broken')
  const flags = realLintStagedFlags()
  const runnerPath = writeRunner(fixture, flags)
  installHook(
    fixture,
    [
      'unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_QUARANTINE_PATH',
      `node "${runnerPath.replace(/\\/g, '/')}"`,
    ].join('\n'),
  )

  stageScenario(fixture.dir)
  const before = captureSnapshot(fixture.dir)
  const result = commitOnlyA(fixture.dir, fixture.logPath)
  const output = `${result.stdout || ''}${result.stderr || ''}`

  assert.match(readFileSync(fixture.shellWitnessPath, 'utf8'), /raw-index=.*next-index-\d+\.lock/)
  assert.equal(JSON.parse(readFileSync(fixture.witnessPath, 'utf8')).gitIndexFile, null)
  assert.notEqual(result.status, 0, `旧钩子竟然提交成功 ⇒ 本测试测不出缺陷:\n${output}`)
  assert.match(
    output,
    /Unable to create[^\n]*index\.lock/,
    `失败原因不是 index.lock 争用:\n${output}`,
  )
  // 提交必须没落地,且失败不改变 B/C
  assert.equal(git(fixture.dir, ['rev-parse', 'HEAD']), before.head)
  assert.equal(git(fixture.dir, ['rev-parse', ':B.txt']), before.bIndex)
  assert.equal(git(fixture.dir, ['rev-parse', ':C.txt']), before.cIndex)
  assert.equal(readFileSync(join(fixture.dir, 'C.txt'), 'utf8'), before.cWorktree)
  // 旧钩子把别人的 B/C 也送去 lint(这正是"不尊重临时索引"的可见后果)
  assert.deepEqual([...new Set(readTaskBases(fixture.logPath))].sort(), ['B.txt', 'C.txt'])
  const failLine = output.split(/\r?\n/).find((line) => /git-fail/.test(line)) || '(未命中)'
  const fatalLine =
    output.split(/\r?\n/).find((line) => /Unable to create/.test(line)) || '(未命中)'
  console.info(
    `[evidence-负控] exit=${result.status}\n  ${failLine.trim()}\n  ${fatalLine.trim()}\n  lint-staged 碰了=${JSON.stringify(readTaskBases(fixture.logPath))}`,
  )
})

test('源码锁定:钩子不再无条件清 GIT_INDEX_FILE;lint-staged 双开关已上,无回滚/备份通道', () => {
  const shell = readFileSync(HOOK_SHELL, 'utf8')
  assert.ok(
    !/unset\s+GIT_DIR\s+GIT_WORK_TREE\s+GIT_INDEX_FILE/.test(shell),
    '旧的无条件 unset GIT_INDEX_FILE 行又回来了',
  )
  assert.match(
    shell,
    /\[\s*!\s*-f\s+"\$GIT_INDEX_FILE"\s*\]/,
    'shell 侧缺少"指针文件不存在就清掉"的条件',
  )
  assert.match(shell, /unset GIT_INDEX_FILE/, 'shell 侧缺少陈旧指针清理')

  const hookJs = readFileSync(HOOK_JS, 'utf8')
  assert.match(hookJs, /require\('\.\/hook-git-env\.js'\)/)
  assert.match(hookJs, /sanitizeGitEnv\(process\.env\)/)
  assert.ok(
    !/for \(const k of \[[\s\S]{0,200}'GIT_INDEX_FILE'/.test(hookJs),
    'node 侧又把 GIT_INDEX_FILE 塞回无条件删除清单',
  )
  assert.deepEqual(
    [...SANITIZER_MODULE.ALWAYS_DROP_GIT_ENV_KEYS].filter((k) => k === 'GIT_INDEX_FILE'),
    [],
    'GIT_INDEX_FILE 不得进入无条件删除清单',
  )

  const flags = realLintStagedFlags()
  assert.ok(flags.includes('--no-stash'), '必须禁 stash 通道(--no-stash)')
  assert.ok(flags.includes('--no-hide-partially-staged'), '必须禁 restore --worktree 通道')
  for (const forbidden of [
    '--stash',
    '--hide-partially-staged',
    '--revert',
    '--hide-unstaged',
    '--hide-all',
  ]) {
    assert.ok(
      !flags.includes(forbidden),
      `lint-staged 参数里出现了会动真实工作树的开关:${forbidden}`,
    )
  }
})

test('sanitizeGitEnv 判据:现存指针保留,空/陈旧指针清掉,GIT_DIR 一律清', () => {
  const dir = mkScratch('precommit-idx-env-')
  const indexFile = join(dir, 'fake-next-index.lock')
  writeFileSync(indexFile, '')

  const keep = { GIT_DIR: 'D:/save-gitdir', GIT_WORK_TREE: 'D:/save-wt', GIT_INDEX_FILE: indexFile }
  SANITIZER_MODULE.sanitizeGitEnv(keep)
  assert.equal(keep.GIT_INDEX_FILE, indexFile)
  assert.ok(!('GIT_DIR' in keep))
  assert.ok(!('GIT_WORK_TREE' in keep))

  const stale = { GIT_INDEX_FILE: join(dir, 'gone.lock') }
  SANITIZER_MODULE.sanitizeGitEnv(stale)
  assert.ok(!('GIT_INDEX_FILE' in stale), '陈旧指针(文件不存在)必须清掉')

  const empty = { GIT_INDEX_FILE: '' }
  SANITIZER_MODULE.sanitizeGitEnv(empty)
  assert.ok(!('GIT_INDEX_FILE' in empty), '空指针必须清掉')

  const directory = { GIT_INDEX_FILE: dir }
  SANITIZER_MODULE.sanitizeGitEnv(directory)
  assert.ok(!('GIT_INDEX_FILE' in directory), '指向目录的指针必须清掉')

  rmScratch(dir, { bestEffort: true })
})
