#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gitdir 自指损坏态回归锁(镜像测试,§22c)
 *
 * 立因(2026-10-16 事故,必钉):`scripts/lib/gitdir.mjs` 的 `resolveGitdir()` 最终回退曾
 * **无条件**返回 `<worktree>/.git`。一旦 `.git` 是指针文件(separate-git-dir 形态)且
 * `git rev-parse --git-dir` 问不出东西(指针被写坏、git 短暂不可用、并发锁窗口),GITDIR
 * 就被解析成**指针文件自身** ⇒ `git-guardian` 的 `healFromBackup()` 执行
 * `cpSync(BACKUP, GITDIR)`,把 25MB 备份内容灌进 `.git` 文件 ⇒ 整仓
 * `fatal: too large to be a .git file` 不可用,且守护每 10 秒再灌一轮(自我放大)。
 *
 * 本文件只钉三条不变量,放宽其中任何一条都必须当场红:
 *   T1 `.git` 是垃圾文件 ⇒ 回退到 separate-git-dir 约定落点,**绝不**回退到指针自身;
 *   T2 `.git` 是目录(常规仓库)⇒ 它本身就是 gitdir(不得因修 T1 把常规仓改坏);
 *   T3 真工作树现读:gitdir 解析与**当次实测的 `.git` 节点形态**自洽(形态是机器事实,
 *      按 AGENTS.md 前言须现读——本机 2026-10-16 实测 = 工作区内 `.git` 实体目录;
 *      另一形态 separate-git-dir 指针上同样有断言,两臂各有牙,公共不变量两形态都判);
 *   T4 接线:`healFromBackup` / `healFromRemote` 两处破坏性写入前都必须过准入闸。
 *
 * 零副作用:夹具落 `mkScratch`(§26 唯一临时物落点),跑完 `rmScratch`。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitdir, resolveWorktree, siblingGitdir } from '../lib/gitdir.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const GUARDIAN = normalize(join(here, '..', 'git-guardian.mjs'))
const LIB = normalize(join(here, '..', 'lib', 'gitdir.mjs'))

/** 盘符/分隔符/大小写三处归一化后的同形判定(与 git-guardian 内 `samePath` 同口径) */
const same = (a, b) =>
  String(a).replace(/\\/g, '/').toLowerCase() === String(b).replace(/\\/g, '/').toLowerCase()

test('T1 `.git` 是垃圾文件 ⇒ 回退到约定落点,绝不回退到指针自身(2026-10-16 事故)', () => {
  const dir = mkScratch('gitdir-self-ref-')
  try {
    // 造损坏现场:`.git` 存在但不是可解析的指针,也不是目录
    writeFileSync(join(dir, '.git'), 'x'.repeat(4096))
    const got = resolveGitdir(dir)
    assert.ok(got, '必须给出一个 gitdir,不能返回空')
    assert.equal(
      same(got, join(dir, '.git')),
      false,
      `GITDIR 不得解析成指针文件自身(实得 ${got})—— 那就是本次事故的删库路径`,
    )
    assert.equal(
      same(got, siblingGitdir(dir)),
      true,
      `应回退到 separate-git-dir 约定落点 ${siblingGitdir(dir)},实得 ${got}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T2 `.git` 是目录(常规仓库)⇒ 它本身就是 gitdir', () => {
  const dir = mkScratch('gitdir-normal-')
  try {
    mkdirSync(join(dir, '.git'))
    const got = resolveGitdir(dir)
    assert.equal(same(got, join(dir, '.git')), true, `常规仓 GITDIR 应等于 <wt>/.git,实得 ${got}`)
  } finally {
    rmScratch(dir)
  }
})

test('T3 真工作树现读:gitdir 解析与当次实测的 `.git` 节点形态自洽', () => {
  const wt = resolveWorktree()
  const gd = resolveGitdir(wt)
  assert.ok(gd, 'resolveGitdir 必须给出一个 gitdir')
  assert.ok(existsSync(gd), `解析出的 gitdir 必须真实存在:${gd}`)
  assert.ok(existsSync(join(gd, 'HEAD')), `gitdir 必须承载 HEAD(解析落点错了这里就没有 HEAD):${gd}`)
  const pointer = join(wt, '.git')
  // 形态本身是机器事实(AGENTS.md 前言七类之一),当次实测分叉;两臂都有硬断言,判据不恒真。
  // statSync 在 `.git` 不存在时直接抛 ⇒ 测试环境本身坏掉也会红,不会静默放过。
  if (statSync(pointer).isDirectory()) {
    // 形态 A(常规仓库,本机 2026-10-16 实测):`.git` 目录本身就是 gitdir,
    // 解析绝不得跑去同级 sibling——那会把真工作树的 gitdir 指向不存在的目录。
    assert.equal(same(gd, pointer), true, `常规形态下 GITDIR 应等于 <wt>/.git,实得 ${gd}`)
    assert.ok(statSync(gd).isDirectory(), '形态 A:gitdir 必须是目录')
  } else {
    // 形态 B(separate-git-dir 指针):gitdir 必须是库外实体,与指针自身同形即 2026-10-16 事故自指态。
    assert.equal(same(gd, pointer), false, 'separate-git-dir 形态下 gitdir 不得落在工作树内')
    const raw = readFileSync(pointer, 'utf8').trim()
    assert.match(raw, /^gitdir:\s*\S+/i, `.git 必须是指针文件,实得 ${raw.slice(0, 40)}`)
    assert.equal(
      same(raw.match(/^gitdir:\s*(.+)$/i)[1].trim().replace(/\\/g, '/'), gd),
      true,
      '指针指向的路径必须与解析出的 gitdir 同形',
    )
  }
})

test('T4 接线:两处破坏性恢复前都必须过 gitdirTargetSafe 准入闸', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(GUARDIAN, 'utf8')
  for (const fn of ['healFromBackup', 'healFromRemote']) {
    const at = src.indexOf(`function ${fn}(`)
    assert.ok(at > 0, `git-guardian.mjs 里找不到 ${fn}`)
    const body = src.slice(at, at + 1200)
    assert.match(
      body,
      /gitdirTargetSafe\(\)/,
      `${fn} 必须在破坏性写入 GITDIR 之前调用 gitdirTargetSafe()`,
    )
  }
  const lib = readFileSync(LIB, 'utf8')
  assert.match(lib, /statSync\(pointer\)\.isDirectory\(\)/, 'gitdir.mjs 最终回退必须先判 `.git` 是目录')
  assert.match(lib, /const \{ dir, name \} = parse\(wt\)/, 'gitdir.mjs 必须让 `parse` 真正被使用(否则删它即撞门 84 R1r 复活判据)')
  assert.match(lib, /siblingGitdir\(wt\)/, 'gitdir.mjs 最终回退必须落到 siblingGitdir')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
