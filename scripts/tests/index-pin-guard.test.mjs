#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/index-pin-guard.js` 镜像测试(2026-11-04 立)。钉五件事:
 *  ① 工位级:私有索引钉 A 版、工作树是 B 版 ⇒ 模拟 lint-staged 的 `git add` 把 B 回灌进
 *    索引后,定版保护把索引复原成 A,且**工作树一个字节不动**;
 *  ② 无改动 ⇒ 零写入(`restored` 为空);
 *  ③ 复原只按"开工前已有的条目"逐条修复,钩子后来**新加**的条目不被顺手删掉;
 *  ④ 反向:索引读不到 ⇒ `ok:false`(调用方必须 fail-closed,不许当成功);
 *  ⑤ 真跑复现(现场问题 4):临时仓里私有索引钉 A、工作树 B,跑一次带 lint-staged 的钩子 ——
 *    对照组(不装保护)落 B'(回灌生效),实验组(装保护)落 A(定版守住)。
 *
 * 夹具一律走 `mkScratch()`(AGENTS §15b/§15c),不落工作树、不落 C 盘。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import pinGuard from '../lib/index-pin-guard.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LS_BIN = join(REPO, 'node_modules', 'lint-staged', 'bin', 'lint-staged.js')
const PIN_MODULE = join(REPO, 'scripts', 'lib', 'index-pin-guard.js')
const HOOK = join(REPO, 'scripts', 'lib', 'pre-commit-hook.js')
const A = 'src/a.txt'
const B_TEXT = 'B-new\n'
const B_FORMATTED = 'B-new\n/* formatted */\n'

const cleanEnv = (extra = {}) => {
  const env = { ...process.env }
  delete env.GIT_INDEX_FILE
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  return { ...env, ...extra }
}

/** ENOBUFS 会被 Node 杀掉子进程,Windows 下索引句柄可能短暂未释放 ⇒ 清理带重试。 */
function cleanup(dir) {
  let last
  for (let i = 0; i < 6; i++) {
    try {
      rmScratch(dir)
      return
    } catch (e) {
      last = e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300)
    }
  }
  throw last
}

function git(dir, args, env = {}, allowFail = false) {
  const r = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: cleanEnv(env),
  })
  if (!allowFail && r.status !== 0)
    throw new Error(`git ${args.join(' ')} 失败:${r.stderr || r.stdout}`)
  return r
}

/** HEAD 含 B 版的 a.txt;私有索引 = HEAD 的索引但把 a.txt 用 --cacheinfo 钉成 A 版(旧)。 */
function makeRepo(prefix) {
  const dir = mkScratch(prefix)
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'pin-test@example.invalid'])
  git(dir, ['config', 'user.name', 'pin-test'])
  git(dir, ['config', 'core.hooksPath', '.git/hooks'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, A), 'A-old\n')
  git(dir, ['add', '--', A])
  git(dir, ['commit', '-m', 'base-A', '--no-verify'])
  writeFileSync(join(dir, A), B_TEXT)
  git(dir, ['add', '--', A])
  git(dir, ['commit', '-m', 'head-B', '--no-verify'])
  // 私有索引:先与 HEAD 一致(即 B),再把 a.txt 钉回 A 版。
  const pinIndex = join(dir, '.git', 'pin.idx')
  copyFileSync(join(dir, '.git', 'index'), pinIndex)
  const blobA = git(dir, ['rev-parse', 'HEAD~1:' + A]).stdout.trim()
  git(dir, ['update-index', '--add', '--cacheinfo', `100644,${blobA},${A}`], {
    GIT_INDEX_FILE: pinIndex,
  })
  return { dir, pinIndex, blobA }
}

const blobInIndex = (dir, pinIndex, p) =>
  git(dir, ['rev-parse', ':' + p], { GIT_INDEX_FILE: pinIndex }).stdout.trim()

test('① 私有索引钉 A、工作树 B:git add 回灌后按快照复原成 A,工作树不动', () => {
  const { dir, pinIndex, blobA } = makeRepo('pin-unit-')
  const env = cleanEnv({ GIT_INDEX_FILE: pinIndex })
  try {
    const snap = pinGuard.capturePinnedIndex({ gitCwd: dir, env })
    const before = blobInIndex(dir, pinIndex, A)
    assert.equal(before, blobA, '开工前索引里应当是钉过的 A 版')

    // 模拟 lint-staged「Staging changes from tasks」:工作树 B → B',再 git add 写回索引。
    writeFileSync(join(dir, A), B_FORMATTED)
    git(dir, ['add', '--', A], { GIT_INDEX_FILE: pinIndex })
    assert.notEqual(blobInIndex(dir, pinIndex, A), blobA, 'git add 确实把定版回灌成了工作树版本')

    const r = pinGuard.restorePinnedIndex({ gitCwd: dir, env, snapshot: snap })
    assert.equal(r.ok, true, `复原应成功:${r.detail}`)
    assert.deepEqual(r.restored, [A])
    assert.equal(blobInIndex(dir, pinIndex, A), blobA, '索引必须恢复为定版的 A 版')
    assert.equal(readFileSync(join(dir, A), 'utf8'), B_FORMATTED, '工作树一个字节都不许动')
  } finally {
    cleanup(dir)
  }
})

test('② 无改动 ⇒ 零写入(restored 为空)', () => {
  const { dir, pinIndex } = makeRepo('pin-noop-')
  const env = cleanEnv({ GIT_INDEX_FILE: pinIndex })
  try {
    const snap = pinGuard.capturePinnedIndex({ gitCwd: dir, env })
    const r = pinGuard.restorePinnedIndex({ gitCwd: dir, env, snapshot: snap })
    assert.equal(r.ok, true)
    assert.deepEqual(r.restored, [])
    assert.deepEqual(r.changed, [])
    assert.deepEqual(r.missing, [])
  } finally {
    cleanup(dir)
  }
})

test('③ 复原只修开工前条目:钩子后来新加的条目不被顺手删掉', () => {
  const { dir, pinIndex, blobA } = makeRepo('pin-extra-')
  const env = cleanEnv({ GIT_INDEX_FILE: pinIndex })
  try {
    const snap = pinGuard.capturePinnedIndex({ gitCwd: dir, env })
    writeFileSync(join(dir, 'derived.txt'), 'generated\n')
    git(dir, ['add', '--', 'derived.txt'], { GIT_INDEX_FILE: pinIndex })
    writeFileSync(join(dir, A), B_FORMATTED)
    git(dir, ['add', '--', A], { GIT_INDEX_FILE: pinIndex })

    const r = pinGuard.restorePinnedIndex({ gitCwd: dir, env, snapshot: snap })
    assert.equal(r.ok, true, r.detail)
    assert.equal(blobInIndex(dir, pinIndex, A), blobA)
    assert.match(
      git(dir, ['ls-files', '-s', '--', 'derived.txt'], { GIT_INDEX_FILE: pinIndex }).stdout,
      /derived\.txt/,
      '派生新增条目必须原样保留(保护不是"清空索引")',
    )
  } finally {
    cleanup(dir)
  }
})

test('④ 反向:索引读不到 ⇒ ok:false(调用方必须 fail-closed)', () => {
  const { dir, pinIndex } = makeRepo('pin-break-')
  const env = cleanEnv({ GIT_INDEX_FILE: pinIndex })
  try {
    const snap = pinGuard.capturePinnedIndex({ gitCwd: dir, env })
    const r = pinGuard.restorePinnedIndex({
      gitCwd: join(dir, 'no-such-dir'),
      env,
      snapshot: snap,
    })
    assert.equal(r.ok, false)
    assert.match(r.detail, /读不到索引/)
  } finally {
    cleanup(dir)
  }
})

const PIN_HELPER = `#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('node:fs')
const G = require(process.env.IHUI_TEST_PIN_MODULE)
const file = process.env.IHUI_TEST_PIN_FILE
const mode = process.argv[2]
if (mode === 'capture') {
  const snap = G.capturePinnedIndex({ gitCwd: process.cwd(), env: process.env })
  writeFileSync(file, JSON.stringify([...snap.entries.values()]))
} else {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const snap = { entries: new Map(raw.map((e) => [e.path, e])) }
  const r = G.restorePinnedIndex({ gitCwd: process.cwd(), env: process.env, snapshot: snap })
  if (!r.ok) {
    console.error(r.detail)
    process.exit(1)
  }
  console.log('RESTORED=' + r.restored.join(','))
}
`

const FMT_SCRIPT = `const fs = require('node:fs')
for (const f of process.argv.slice(2)) fs.writeFileSync(f, fs.readFileSync(f, 'utf8') + '/* formatted */\\n')
`

/** 带 lint-staged 的钩子;IHUI_TEST_PIN_GUARD=1 时装上"开工前快照 → lint-staged → 复原"两针。 */
const HOOK_SCRIPT = `#!/bin/sh
if [ "$IHUI_TEST_PIN_GUARD" = "1" ]; then
  node "$IHUI_TEST_PIN" capture || exit 1
fi
node "$IHUI_TEST_LINT" --config lint-staged.config.mjs --no-stash --no-hide-partially-staged --max-arg-length 4096 || exit 1
if [ "$IHUI_TEST_PIN_GUARD" = "1" ]; then
  node "$IHUI_TEST_PIN" restore || exit 1
fi
`

function runCommit(dir, pinIndex, guard) {
  const pinFile = join(dir, 'pin-snapshot.json')
  return spawnSync(
    'git',
    ['commit', '-m', guard ? 'pin-guarded' : 'pin-control'],
    {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: cleanEnv({
        GIT_INDEX_FILE: pinIndex,
        IHUI_TEST_PIN_GUARD: guard ? '1' : '0',
        IHUI_TEST_PIN: join(dir, 'pin-helper.cjs'),
        IHUI_TEST_PIN_FILE: pinFile,
        IHUI_TEST_PIN_MODULE: PIN_MODULE,
        IHUI_TEST_LINT: LS_BIN,
      }),
    },
  )
}

function lintStagedRepo(prefix) {
  const { dir, pinIndex, blobA } = makeRepo(prefix)
  writeFileSync(join(dir, 'fmt.cjs'), FMT_SCRIPT)
  writeFileSync(
    join(dir, 'lint-staged.config.mjs'),
    `export default { 'src/**/*.txt': 'node "${join(dir, 'fmt.cjs').replace(/\\/g, '/')}"' }\n`,
  )
  writeFileSync(join(dir, 'pin-helper.cjs'), PIN_HELPER)
  writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), HOOK_SCRIPT, 'utf8')
  return { dir, pinIndex, blobA }
}

test('⑤ 复现(问题 4):私有索引 A / 工作树 B,跑带 lint-staged 的钩子 —— 对照组落 B\',装保护落 A', () => {
  const control = lintStagedRepo('pin-ctl-')
  try {
    const r = runCommit(control.dir, control.pinIndex, false)
    assert.equal(r.status, 0, `对照组提交应成功(用来证明回灌真实发生):${r.stderr}`)
    assert.equal(
      git(control.dir, ['show', 'HEAD:' + A]).stdout,
      B_FORMATTED,
      '对照组:提交落的是工作树版本 B\'(定版被回灌,正是现场形态)',
    )
  } finally {
    rmScratch(control.dir)
  }

  const guarded = lintStagedRepo('pin-grd-')
  try {
    const r = runCommit(guarded.dir, guarded.pinIndex, true)
    assert.equal(r.status, 0, `装保护后提交应成功(不是拒提交):${r.stderr}`)
    assert.equal(
      git(guarded.dir, ['show', 'HEAD:' + A]).stdout,
      'A-old\n',
      '装保护:提交落的必须是定版的 A 版',
    )
    assert.equal(
      git(guarded.dir, ['rev-parse', 'HEAD:' + A]).stdout.trim(),
      guarded.blobA,
      '提交里的 blob 必须与 --cacheinfo 钉的 blob 逐字相等',
    )
  } finally {
    rmScratch(guarded.dir)
  }
})

test('⑦ 上界语义:索引输出超过上界 ⇒ 未判定(exit 2 语义),不崩溃、不静默放行', () => {
  const { dir, pinIndex } = makeRepo('pin-bound-')
  const env = cleanEnv({ GIT_INDEX_FILE: pinIndex })
  try {
    const snap = pinGuard.capturePinnedIndex({ gitCwd: dir, env })
    // 夹具:把上界压到 8 字节(远小于任意一条 ls-files 输出) ⇒ 必然超出上界。
    assert.throws(
      () => pinGuard.capturePinnedIndex({ gitCwd: dir, env, maxBytes: 8 }),
      (e) =>
        e.code === pinGuard.UNDETERMINED_CODE &&
        /未判定/.test(e.message) &&
        /上界/.test(e.message),
      '超界必须是可识别的"未判定",不是普通异常',
    )
    const r = pinGuard.restorePinnedIndex({ gitCwd: dir, env, snapshot: snap, maxBytes: 8 })
    assert.equal(r.ok, false, '未判定绝不能当成功(静默放行)')
    assert.equal(r.undetermined, true)
    assert.match(r.detail, /未判定/)
  } finally {
    cleanup(dir)
  }
})

test('⑥ 接线锁:pre-commit-hook 与 .husky/pre-commit 的 sh 层留痕/泄漏放行', () => {
  const hook = readFileSync(HOOK, 'utf8')
  assert.match(hook, /require\('\.\/index-pin-guard\.js'\)/)
  assert.match(hook, /capturePinnedIndex\(/)
  assert.match(hook, /restorePinnedIndex\(/)
  assert.match(hook, /isGitTempIndex\(INDEX_CTX\.entry\)/)
  const shell = readFileSync(join(REPO, '.husky', 'pre-commit'), 'utf8')
  assert.match(shell, /hook_marker\(\)/, 'sh 层拒绝必须先落机器可读记录')
  assert.match(shell, /hook-markers\.jsonl/)
  assert.match(shell, /next-index-\*\.lock/)
  assert.match(shell, /tr -cd/)
  // 上界语义:不许再写死固定 maxBuffer(64MB 只是把地板抬高,超过照样 ENOBUFS 且无语义);
  // 必须按索引实际大小推导,并在超界时走「未判定 ⇒ exit 2」,且 sh 层原样传播该退出码。
  assert.match(readFileSync(PIN_MODULE, 'utf8'), /BOUND_MULTIPLIER \* indexSize/)
  assert.doesNotMatch(readFileSync(PIN_MODULE, 'utf8'), /maxBuffer: 64 \* 1024 \* 1024/)
  assert.match(hook, /process\.exit\(2\)/)
  assert.match(hook, /UNDETERMINED_CODE/)
  assert.match(shell, /exit "\$_hook_rc"/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
