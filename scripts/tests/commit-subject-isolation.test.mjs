// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提交标题串号(COMMIT_EDITMSG 并发覆盖)夹具。
 *
 * 机制(2026-11-04 实测):git 在 pre-commit 之后把消息写进 `$GIT_DIR/COMMIT_EDITMSG`,
 * 在 commit-msg 钩子之后**再读回**。`-m` / `-F <本席文件>` 都挡不住 —— 消息源只是入参,
 * 最终落进提交对象的是 git 从共享文件读回的那一份。两个会话的 commit-msg 窗口一重叠,
 * 先落地的那枚就可能拿到后写的那枚的标题(实测 26bc403762 / 67ed343d2c)。
 *
 * 本夹具两组:
 *  A. 修复前基线:直接 `git commit -m`,共享 COMMIT_EDITMSG ⇒ 期望稳定复现串号;
 *  B. 修复后:`isolated-git.mjs` 私有 GIT_DIR 叠层 + 私有消息文件 ⇒ 20/20 各自正确,
 *     且两枚提交的树各自只含自己的文件。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  extractCommitMessage,
  preparePrivateCommitContext,
  subjectFromMessage,
} from '../isolated-git.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'isolated-git.mjs')
const ROUNDS = 20
/** 修复前基线:commit-msg 窗口要足够宽,才让 A 在读回前撞上 B 写共享消息文件。 */
const LEGACY_HOOK_SLEEP = 1.0
const LEGACY_STAGGER_MS = 300
/** 修复后:private GIT_DIR 让窗口宽度无关,只需保证两席确实并发。
 *  起跑错峰加抖动,避免两席每 2s 的 CAS 重试永远同相位(livelock,把 20 轮拖成 4 分钟)。 */
const ISOLATED_HOOK_SLEEP = 0.35
function isolatedStaggerMs() {
  return 80 + Math.floor(Math.random() * 350)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function git(cwd, args, env = {}) {
  const e = { ...process.env, ...env }
  delete e.GIT_DIR
  delete e.GIT_WORK_TREE
  delete e.GIT_INDEX_FILE
  const r = spawnSync('git', args, {
    cwd,
    env: { ...e, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  if (r.error) throw r.error
  return r
}

function makeRepo(prefix) {
  const dir = mkScratch(prefix)
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'iso-test@example.invalid'])
  git(dir, ['config', 'user.name', 'iso-test'])
  git(dir, ['config', 'core.hooksPath', '.git/hooks'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, 'seed.txt'), 'seed\n')
  git(dir, ['add', '--', 'seed.txt'])
  const base = git(dir, ['commit', '-m', 'base'])
  if (base.status !== 0) throw new Error(`基线提交失败: ${base.stderr || base.stdout}`)
  return dir
}

/** commit-msg 只睡,不改消息 —— 复现"消息窗口被另一席覆盖",不引入其它变量。 */
function writeSlowCommitMsgHook(dir, seconds) {
  mkdirSync(join(dir, '.git', 'hooks'), { recursive: true })
  writeFileSync(
    join(dir, '.git', 'hooks', 'commit-msg'),
    `#!/bin/sh\nsleep ${seconds}\nexit 0\n`,
    'utf8',
  )
}

function buildPrivateIndex(dir, indexFile, file, content) {
  writeFileSync(join(dir, file), content)
  git(dir, ['read-tree', 'HEAD'], { GIT_INDEX_FILE: indexFile })
  const r = git(dir, ['add', '--', file], { GIT_INDEX_FILE: indexFile })
  if (r.status !== 0) throw new Error(`git add 失败: ${r.stderr || r.stdout}`)
}

function runGitCommit(dir, args, env) {
  const base = { ...process.env }
  delete base.GIT_DIR
  delete base.GIT_WORK_TREE
  delete base.GIT_INDEX_FILE
  return new Promise((resolveP) => {
    const p = spawn('git', args, {
      cwd: dir,
      env: { ...base, ...env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolveP({ code, out, err }))
    p.on('error', (e) => resolveP({ code: -1, out, err: String(e) }))
  })
}

const LOCK_BUSY_RE = /cannot lock ref|Unable to create|index\.lock|Another git process/i
/** native commit 打印 `[main abc1234]`,isolated-git 打印 `✅ 已提交 abc1234`。 */
const SHA_RE = /(?:已提交\s+|\[[^\]]*\s)([0-9a-f]{7,40})/

/** 修复前基线:原生 `git commit -m`,只隔离索引(不改消息面)。CAS 输家按同型重试。 */
async function legacyCommit(dir, { indexFile, file, content, msg }) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    buildPrivateIndex(dir, indexFile, file, content)
    const r = await runGitCommit(dir, ['commit', '-m', msg], { GIT_INDEX_FILE: indexFile })
    if (r.code === 0) return r
    if (!LOCK_BUSY_RE.test(r.err) || attempt === 5) return r
    await sleep(200)
  }
  return { code: -1, out: '', err: 'retry exhausted' }
}

/** 修复后:isolated-git 自己建私有 GIT_DIR + 私有消息文件,并回读 %s 自证。 */
async function isolatedCommit(dir, { file, content, msg }) {
  writeFileSync(join(dir, file), content)
  const env = { ...process.env }
  delete env.GIT_INDEX_FILE
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.IHUI_EXPECTED_PRIVATE_INDEX
  return new Promise((resolveP) => {
    const p = spawn(process.execPath, [SCRIPT, '-C', dir, 'commit', '-m', msg, '--', file], {
      cwd: dir,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolveP({ code, out, err }))
    p.on('error', (e) => resolveP({ code: -1, out, err: String(e) }))
  })
}

function subjectOf(dir, sha) {
  return git(dir, ['log', '-1', '--format=%s', sha]).stdout.trim()
}

function filesOf(dir, sha) {
  return git(dir, ['show', '--name-only', '--format=', sha])
    .stdout.split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 一轮:两席并发提交不同文件/不同消息,返回双方落地的 sha 与 subject。 */
async function oneRound(dir, i, commitFn, staggerMs) {
  const msgA = `MSG-A-${i}`
  const msgB = `MSG-B-${i}`
  const fileA = `fileA-${i}.txt`
  const fileB = `fileB-${i}.txt`
  const pA = commitFn(dir, {
    indexFile: join(dir, '.git', `idx-A-${i}`),
    file: fileA,
    content: `A ${i}\n`,
    msg: msgA,
  })
  await sleep(staggerMs)
  const pB = commitFn(dir, {
    indexFile: join(dir, '.git', `idx-B-${i}`),
    file: fileB,
    content: `B ${i}\n`,
    msg: msgB,
  })
  const [rA, rB] = await Promise.all([pA, pB])
  // 用各进程自报的落地 sha 定位提交(stdout 是提交方自己回读的那一枚,
  // 比事后 `git log -- <file>` 更不容易被后续提交的路径差异带偏)。
  const shaA = SHA_RE.exec(rA.out)?.[1] || null
  const shaB = SHA_RE.exec(rB.out)?.[1] || null
  return {
    i,
    msgA,
    msgB,
    fileA,
    fileB,
    codeA: rA.code,
    codeB: rB.code,
    errA: rA.err,
    errB: rB.err,
    shaA,
    shaB,
    subjectA: shaA ? subjectOf(dir, shaA) : null,
    subjectB: shaB ? subjectOf(dir, shaB) : null,
  }
}

test('A. 单元:消息源只认本席入参,共享 COMMIT_EDITMSG 一律拒绝', () => {
  assert.deepEqual(extractCommitMessage(['-m', 'feat: x', '--author', 'a <a@b>']), {
    rest: ['--author', 'a <a@b>'],
    text: 'feat: x',
    sourceFile: null,
  })
  assert.equal(extractCommitMessage(['-m', 'feat: a', '-m', 'body']).text, 'feat: a\n\nbody')
  assert.equal(subjectFromMessage('feat: x\nwrapped\n\nbody'), 'feat: x wrapped')
  assert.equal(subjectFromMessage('# 注释\nfeat: x'), 'feat: x')
})

test('B. 修复前基线:原生 git commit -m 并发,期望稳定复现串号', async () => {
  const dir = makeRepo('subject-legacy-')
  try {
    writeSlowCommitMsgHook(dir, LEGACY_HOOK_SLEEP)
    const rows = []
    for (let i = 0; i < ROUNDS; i += 1) {
      rows.push(await oneRound(dir, i, legacyCommit, LEGACY_STAGGER_MS))
    }
    const crossed = rows.filter(
      (r) =>
        r.codeA === 0 &&
        r.codeB === 0 &&
        (r.subjectA !== r.msgA || r.subjectB !== r.msgB),
    )
    const concrete = crossed.length
      ? `首例:第 ${crossed[0].i} 轮 A 落地=${JSON.stringify(crossed[0].subjectA)} 期望=${JSON.stringify(crossed[0].msgA)}`
      : '(本轮未复现)'
    console.info(
      `[legacy] ${ROUNDS} 轮:两席均落地 ${rows.filter((r) => r.codeA === 0 && r.codeB === 0).length}/${ROUNDS},` +
        `串号 ${crossed.length}/${ROUNDS} 轮。${concrete}`,
    )
    // 机制是确定性的:慢 commit-msg + 错峰写共享文件 ⇒ 至少复现一次。复现不出说明环境不同,必须暴露。
    assert.ok(
      crossed.length > 0,
      `修复前基线未复现串号(可能环境调度不同):${JSON.stringify(rows.slice(0, 3))}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('C. 修复后:isolated-git 私有 GIT_DIR + 私有消息文件,20/20 各自正确', async () => {
  const dir = makeRepo('subject-isolated-')
  try {
    writeSlowCommitMsgHook(dir, ISOLATED_HOOK_SLEEP)
    const rows = []
    for (let i = 0; i < ROUNDS; i += 1) {
      rows.push(await oneRound(dir, i, isolatedCommit, isolatedStaggerMs()))
    }
    const failures = rows.filter(
      (r) =>
        r.codeA !== 0 ||
        r.codeB !== 0 ||
        !r.shaA ||
        !r.shaB ||
        r.subjectA !== r.msgA ||
        r.subjectB !== r.msgB ||
        JSON.stringify(filesOf(dir, r.shaA)) !== JSON.stringify([r.fileA]) ||
        JSON.stringify(filesOf(dir, r.shaB)) !== JSON.stringify([r.fileB]),
    )
    console.info(
      `[isolated] ${ROUNDS} 轮:通过 ${ROUNDS - failures.length}/${ROUNDS}` +
        (failures.length
          ? `;首例失败:${JSON.stringify(
              {
                round: failures[0].i,
                codeA: failures[0].codeA,
                codeB: failures[0].codeB,
                subjectA: failures[0].subjectA,
                subjectB: failures[0].subjectB,
                filesA: failures[0].shaA ? filesOf(dir, failures[0].shaA) : null,
                filesB: failures[0].shaB ? filesOf(dir, failures[0].shaB) : null,
                errA: failures[0].errA.slice(-300),
                errB: failures[0].errB.slice(-300),
              },
              null,
              2,
            )}`
          : ''),
    )
    assert.equal(failures.length, 0, `修复后仍有 ${failures.length}/${ROUNDS} 轮失败`)
  } finally {
    rmScratch(dir)
  }
})

test('D. 私有提交上下文确实把 COMMIT_EDITMSG 挪进本席目录,共享文件不参与', () => {
  const dir = makeRepo('subject-context-')
  try {
    const gitDir = git(dir, ['rev-parse', '--absolute-git-dir']).stdout.trim()
    const indexFile = join(gitDir, 'ihui-isolated-index', 'self-test.idx')
    // 硬线:显式把共享 COMMIT_EDITMSG 当消息源必须被拒。
    writeFileSync(join(gitDir, 'COMMIT_EDITMSG'), 'FOREIGN\n')
    assert.throws(
      () =>
        preparePrivateCommitContext({
          gitCwd: dir,
          gitDir,
          indexFile,
          commitOpts: ['-F', '.git/COMMIT_EDITMSG'],
        }),
      /禁止复用共享/,
    )
    const ctx = preparePrivateCommitContext({
      gitCwd: dir,
      gitDir,
      indexFile,
      commitOpts: ['-m', 'MSG-X'],
    })
    try {
      assert.ok(
        resolve(ctx.env.GIT_DIR).startsWith(resolve(gitDir)),
        '私有 GIT_DIR 必须落在同一 gitdir 内',
      )
      assert.ok(ctx.env.GIT_DIR.includes('ihui-isolated-index'))
      assert.ok(ctx.env.GIT_DIR.endsWith('.gitdir'))
      assert.equal(ctx.expectedSubject, 'MSG-X')
      assert.ok(ctx.commitOpts.includes('-F'))
      assert.ok(
        !ctx.commitOpts.some((a) => String(a).includes('COMMIT_EDITMSG')),
        '私有 -F 绝不能指向共享 COMMIT_EDITMSG',
      )
    } finally {
      ctx.dispose()
    }
  } finally {
    rmScratch(dir)
  }
})
