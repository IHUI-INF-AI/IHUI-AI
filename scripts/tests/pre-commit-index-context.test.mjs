#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/index-context.js` 镜像测试(2026-11-04 立)。钉四件事:
 *  ① 改前基线:上游 lint-staged 17.3.0 在 GIT_INDEX_FILE=*.lock 时,会把**整份索引**
 *     写到 `.git/index.lock`(gitWorkflow.js:403-421 的「再写默认索引」分支);
 *     父 git 收尾后它落成共享索引 ⇒ 本次路径在共享索引上多出暂存副本。
 *  ② 改后:index-context 把父 git 的临时 `.lock` 复制成 `*.idx`(上游那条分支结构上不可达),
 *     lint-staged 全程不碰 `index.lock`,共享索引字节/条目逐条不变,退出时副本回写 `.lock`。
 *  ③ fail-closed:调用方声明了私有索引而指针缺失/被改 ⇒ 报「索引上下文丢失」。
 *  ④ 预载校验:lint-staged 的 node 子进程拿不到同一份私有索引 ⇒ exit 1(绝不落回共享索引)。
 *
 * 夹具一律走 `mkScratch()`(AGENTS §15b/§15c),不落工作树、不落 C 盘。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import indexContextModule from '../lib/index-context.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LS_BIN = join(REPO, 'node_modules', 'lint-staged', 'bin', 'lint-staged.js')
const PRELOAD = join(REPO, 'scripts', 'lib', 'index-context-preload.js')
const PATHS = Array.from({ length: 8 }, (_, i) => `f${i}.txt`)

const cleanEnv = (extra = {}) => {
  const env = { ...process.env }
  delete env.GIT_INDEX_FILE
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.NODE_OPTIONS
  return { ...env, ...extra }
}

function git(dir, args, env = {}, allowFail = false) {
  const r = spawnSync('git', args, {
    cwd: dir,
    env: cleanEnv(env),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (!allowFail && r.status !== 0)
    throw new Error(`git ${args.join(' ')} 失败:${r.stderr || r.stdout}`)
  return r
}

const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

/** 8 个路径、共享索引 = v1、工作树 = v1(全部 M),再复制出一份 `.lock` 私有索引。 */
function fixture(prefix) {
  const dir = mkScratch(prefix)
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'ix-test@example.invalid'])
  git(dir, ['config', 'user.name', 'ix-test'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  for (let i = 0; i < 8; i += 1) writeFileSync(join(dir, `f${i}.txt`), `v0-${i}\n`)
  git(dir, ['add', '--', '.'])
  git(dir, ['commit', '-m', 'init', '--no-verify'])
  for (let i = 0; i < 8; i += 1) writeFileSync(join(dir, `f${i}.txt`), `v1-${i}\n`)
  git(dir, ['add', '--', '.'])
  mkdirSync(join(dir, '.git', 'priv'), { recursive: true })
  const priv = join(dir, '.git', 'priv', 'next-index-1234.lock')
  copyFileSync(join(dir, '.git', 'index'), priv)
  writeFileSync(
    join(dir, 'task.mjs'),
    "import { writeFileSync } from 'node:fs'\nfor (const p of process.argv.slice(2)) writeFileSync(p, 'task-output\\n')\n",
  )
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      { name: 'ix-fixture', private: true, 'lint-staged': { '*.txt': 'node task.mjs' } },
      null,
      2,
    ),
  )
  return { dir, priv }
}

function runLintStaged(dir, env) {
  return spawnSync(process.execPath, [LS_BIN, '--no-stash', '--no-hide-partially-staged'], {
    cwd: dir,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

test('① 改前基线:*.lock 私有索引 ⇒ lint-staged 把整份索引写进 .git/index.lock(共享索引残留的直接来源)', () => {
  const { dir, priv } = fixture('ix-before-')
  try {
    const sharedBefore = digest(join(dir, '.git', 'index'))
    const r = runLintStaged(dir, cleanEnv({ GIT_INDEX_FILE: priv }))
    assert.equal(r.status, 0, `lint-staged 应成功:${r.stderr}`)
    const lock = join(dir, '.git', 'index.lock')
    assert.ok(existsSync(lock), '改前应当出现 .git/index.lock(上游默认索引写入)')
    const stagedInLock = git(
      dir,
      ['-c', 'core.quotepath=false', 'diff', '--cached', '--name-only'],
      {
        GIT_INDEX_FILE: lock,
      },
    ).stdout.trim()
    assert.deepEqual(stagedInLock.split(/\r?\n/).filter(Boolean).sort(), [...PATHS].sort())
    // 字节层面共享 index 还没变(上游写的是 lock);父 git 收尾把 lock 落成 index 后才可见。
    assert.equal(digest(join(dir, '.git', 'index')), sharedBefore)
    copyFileSync(lock, join(dir, '.git', 'index'))
    const status = git(dir, ['status', '--short']).stdout
    for (const p of PATHS) assert.match(status, new RegExp(`^M\\s+${p.replace('.', '\\.')}$`, 'm'))
  } finally {
    rmScratch(dir)
  }
})

test('② 改后:*.lock → *.idx 副本,lint-staged 不写 index.lock,共享索引逐条不变,退出回写 .lock', () => {
  const { dir, priv } = fixture('ix-after-')
  const saved = process.env.GIT_INDEX_FILE
  const savedOptions = process.env.NODE_OPTIONS
  try {
    const sharedBefore = digest(join(dir, '.git', 'index'))
    const entriesBefore = git(dir, ['ls-files', '-s', '--', ...PATHS]).stdout
    process.env.GIT_INDEX_FILE = priv
    indexContextModule.resetIndexContextForTest()
    const ctx = indexContextModule.prepareIndexContext(process.env, { cwd: dir })
    assert.equal(ctx.mode, 'private')
    assert.ok(ctx.created, '*.lock 必须被复制成 *.idx(否则上游默认索引分支可达)')
    assert.match(ctx.active.replace(/\\/g, '/'), /ihui-isolated-index\/[0-9a-f-]+\.idx$/)

    const viewBefore = indexContextModule.captureSharedView(ctx, PATHS)
    process.env.GIT_INDEX_FILE = ctx.active
    indexContextModule.assertIndexContext(ctx)
    const r = runLintStaged(dir, indexContextModule.lintStagedEnv(ctx))
    assert.equal(r.status, 0, `lint-staged 应成功:${r.stderr}`)
    indexContextModule.assertIndexContext(ctx)
    assert.deepEqual(indexContextModule.assertSharedViewUnchanged(ctx, PATHS, viewBefore), {
      ok: true,
    })
    assert.ok(!existsSync(join(dir, '.git', 'index.lock')), '改后不得写共享 index.lock')

    indexContextModule.finalizeIndexContext(ctx, 0)
    delete process.env.GIT_INDEX_FILE
    // 回写:父 git 读到的仍是它自己那份 .lock,且带着 lint-staged 的产(此处为 task-output)。
    const inLock = git(dir, ['ls-files', '-s', '--', ...PATHS], {
      GIT_INDEX_FILE: priv,
    }).stdout.trim()
    assert.equal(inLock.split(/\r?\n/).filter(Boolean).length, PATHS.length)
    const worktreeBlob = git(dir, ['hash-object', '--', 'f0.txt']).stdout.trim()
    assert.match(inLock, new RegExp(`100644 ${worktreeBlob} 0\\tf0\\.txt`))
    assert.equal(digest(join(dir, '.git', 'index')), sharedBefore)
    assert.equal(git(dir, ['ls-files', '-s', '--', ...PATHS]).stdout, entriesBefore)
  } finally {
    if (saved === undefined) delete process.env.GIT_INDEX_FILE
    else process.env.GIT_INDEX_FILE = saved
    if (savedOptions === undefined) delete process.env.NODE_OPTIONS
    else process.env.NODE_OPTIONS = savedOptions
    indexContextModule.resetIndexContextForTest()
    rmScratch(dir)
  }
})

test('③ fail-closed:声明了私有索引但指针不一致/缺失 ⇒ 索引上下文丢失(拒绝提交)', () => {
  const { dir, priv } = fixture('ix-lost-')
  indexContextModule.resetIndexContextForTest()
  try {
    assert.throws(
      () =>
        indexContextModule.prepareIndexContext(
          cleanEnv({ GIT_INDEX_FILE: priv, IHUI_EXPECTED_PRIVATE_INDEX: join(dir, 'other.idx') }),
          { cwd: dir },
        ),
      /索引上下文丢失/,
    )
    indexContextModule.resetIndexContextForTest()
    assert.throws(
      () =>
        indexContextModule.prepareIndexContext(cleanEnv({ IHUI_EXPECTED_PRIVATE_INDEX: priv }), {
          cwd: dir,
        }),
      /索引上下文丢失/,
    )
    indexContextModule.resetIndexContextForTest()
    const missing = join(dir, '.git', 'priv', 'missing.idx')
    assert.throws(
      () =>
        indexContextModule.prepareIndexContext(cleanEnv({ GIT_INDEX_FILE: missing }), { cwd: dir }),
      /索引上下文丢失/,
    )
  } finally {
    indexContextModule.resetIndexContextForTest()
    indexContextModule.resetIndexContextForTest()
    rmScratch(dir)
  }
})

test('④ 预载校验:lint-staged 子进程拿到别的索引/丢了期望值 ⇒ exit 1,报索引上下文丢失', () => {
  const dir = mkScratch('ix-preload-')
  try {
    const good = join(dir, 'good.idx')
    writeFileSync(good, 'dummy-index-bytes')
    const wrong = join(dir, 'wrong.idx')
    writeFileSync(wrong, 'dummy-index-bytes')
    const options = `--require=${PRELOAD.replace(/\\/g, '/')}`
    const ok = spawnSync(process.execPath, ['-e', '0'], {
      cwd: dir,
      env: cleanEnv({
        GIT_INDEX_FILE: good,
        IHUI_REQUIRE_PRIVATE_INDEX: '1',
        IHUI_EXPECTED_GIT_INDEX_FILE: good,
        NODE_OPTIONS: options,
      }),
      encoding: 'utf8',
    })
    assert.equal(ok.status, 0, `正常形态不应被拦:${ok.stderr}`)

    const bad = spawnSync(process.execPath, ['-e', '0'], {
      cwd: dir,
      env: cleanEnv({
        GIT_INDEX_FILE: wrong,
        IHUI_REQUIRE_PRIVATE_INDEX: '1',
        IHUI_EXPECTED_GIT_INDEX_FILE: good,
        NODE_OPTIONS: options,
      }),
      encoding: 'utf8',
    })
    assert.equal(bad.status, 1)
    assert.match(bad.stderr, /索引上下文丢失/)

    const dropped = spawnSync(process.execPath, ['-e', '0'], {
      cwd: dir,
      env: cleanEnv({
        GIT_INDEX_FILE: good,
        IHUI_REQUIRE_PRIVATE_INDEX: '1',
        NODE_OPTIONS: options,
      }),
      encoding: 'utf8',
    })
    assert.equal(dropped.status, 1)
    assert.match(dropped.stderr, /索引上下文丢失/)
  } finally {
    rmScratch(dir)
  }
})

test('⑤ 接线锁:pre-commit-hook 与 .husky/pre-commit 必须走同一份实现', () => {
  const hook = readFileSync(join(REPO, 'scripts', 'lib', 'pre-commit-hook.js'), 'utf8')
  assert.match(hook, /require\('\.\/index-context\.js'\)/)
  assert.match(hook, /prepareIndexContext\(process\.env\)/)
  assert.match(hook, /indexContext\.lintStagedEnv\(INDEX_CTX\)/)
  assert.match(hook, /assertSharedViewUnchanged\(/)
  assert.match(hook, /finalizeIndexContext\(INDEX_CTX/)
  assert.match(hook, /declareDerivedArtifact\(/)
  const shell = readFileSync(join(REPO, '.husky', 'pre-commit'), 'utf8')
  assert.match(shell, /IHUI_EXPECTED_PRIVATE_INDEX/)
  assert.match(shell, /索引上下文丢失/)
})

test('⑥ 取证面:开工期 guard 失败可区分,且并发私有索引不被"索引上下文"拒', async () => {
  // (a) 开工期(索引上下文/定版基线)失败发生在 writeRoundRecord 注册之前 ⇒ 必须自己落一格
  //     `earlyExit`,否则与 pre-gate 的 lint-staged 红同形(实测 2026-11-04 21:19:12 被误归因)。
  const hook = readFileSync(join(REPO, 'scripts', 'lib', 'pre-commit-hook.js'), 'utf8')
  assert.match(hook, /writeEarlyMarker\('index-context', 1\)/)
  assert.match(hook, /writeEarlyMarker\('pin-undetermined', 2\)/)
  assert.match(hook, /writeEarlyMarker\('pin-baseline', 1\)/)
  assert.match(hook, /earlyExit: reason/)

  // (b) ROUND.headBefore/stagedFiles 必须在任何会失败的腿之前填(否则记录退化成空集)。
  const early = hook.indexOf('ROUND.headBefore = ROUND.headBefore ||')
  assert.ok(early > 0, '必须新增开工期填充')
  assert.ok(early < hook.indexOf('function runLintStaged()'), '填充必须在 lint-staged 之前')
  assert.ok(early < hook.lastIndexOf('if (!runLintStaged())'), '填充必须在 lint-staged 失败出口之前')

  // (c) 并发夹具:两份私有索引、两个进程同时 prepareIndexContext ⇒ 双方都不被"索引上下文"拒,
  //     且共享索引字节不变(证明并发下不是"抢面")。
  const dir = mkScratch('ix-conc-')
  try {
    git(dir, ['init', '-b', 'main'])
    git(dir, ['config', 'user.email', 'ix-test@example.invalid'])
    git(dir, ['config', 'user.name', 'ix-test'])
    git(dir, ['config', 'core.autocrlf', 'false'])
    git(dir, ['config', 'commit.gpgsign', 'false'])
    writeFileSync(join(dir, 'a.txt'), 'v0\n')
    writeFileSync(join(dir, 'b.txt'), 'v0\n')
    git(dir, ['add', '--', '.'])
    git(dir, ['commit', '-m', 'init', '--no-verify'])

    const sharedIndex = join(dir, '.git', 'index')
    const sharedDigest = digest(sharedIndex)
    const priv1 = join(dir, '.git', 'p1.idx')
    const priv2 = join(dir, '.git', 'p2.idx')
    copyFileSync(sharedIndex, priv1)
    copyFileSync(sharedIndex, priv2)

    const stage = `const m = require(process.env.IX_MODULE)
const ctx = m.prepareIndexContext(process.env, { cwd: process.env.IX_CWD })
process.stdout.write(JSON.stringify({ mode: ctx.mode, entry: ctx.entry }))
`
    writeFileSync(join(dir, 'stage.cjs'), stage)

    const run = (priv) =>
      new Promise((res) => {
        const child = spawn(process.execPath, [join(dir, 'stage.cjs')], {
          cwd: dir,
          windowsHide: true,
          env: cleanEnv({
            GIT_INDEX_FILE: priv,
            IHUI_EXPECTED_PRIVATE_INDEX: priv,
            IX_MODULE: join(REPO, 'scripts', 'lib', 'index-context.js'),
            IX_CWD: dir,
          }),
        })
        let out = ''
        let err = ''
        child.stdout.on('data', (d) => (out += d))
        child.stderr.on('data', (d) => (err += d))
        child.on('close', (code) => res({ code, out, err }))
      })

    const [r1, r2] = await Promise.all([run(priv1), run(priv2)])
    assert.equal(r1.code, 0, `并发私有索引 A 被拒:${r1.err}`)
    assert.equal(r2.code, 0, `并发私有索引 B 被拒:${r2.err}`)
    const j1 = JSON.parse(r1.out)
    const j2 = JSON.parse(r2.out)
    assert.equal(j1.mode, 'private')
    assert.equal(j2.mode, 'private')
    assert.notEqual(j1.entry, j2.entry, '两份上下文必须各指各的索引')
    assert.equal(digest(sharedIndex), sharedDigest, '并发期间共享索引字节不许变')
  } finally {
    rmScratch(dir)
  }
})
