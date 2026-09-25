// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:safe-commit 跳门兜底路径对**删除型提交**的取材语义。
// 成因(2026-09-25 三连撞):兜底重暂存用的是 `git add -A -- <path>`,它匹配的是索引+磁盘;
// 当文件已被 git rm 从盘上删掉、又被并发会话的 `git reset` 从索引里抹掉时,add 直接
// `pathspec did not match any files` —— 而那正是删除最需要被暂存的时刻,于是删除类收口
// 永远走不到跳门兜底。出口是 `git rm --cached --ignore-unmatch`(只按 HEAD/索引说话)。
// 本文件不启动 safe-commit,而是在临时仓里把**这条机制差**两侧都证明一遍:
// 错的写法必失败、对的写法必暂存出删除。判据不可构造 = 判据未被验证。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'commit.gpgSign=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/**
 * 造出**实测到的那一态**:文件在 HEAD 里、索引里没有、盘上也没有。
 * 2026-09-25 临时仓三态实测(不是推测):
 *   A 索引有 + 盘上无 ⇒ `git add -A` 成功
 *   B 索引无 + HEAD 有 + 盘上无 ⇒ `git add -A` 报 pathspec did not match,
 *     **而 `git diff --cached` 已经把它报成 D** ⇒ 安全提交的兜底在这态 exit 1 是纯误伤
 *   C 索引无 + HEAD 无 ⇒ 同样报错,且 diff 为空 ⇒ 这一态才真的该中止
 * lint-staged 在提交失败时回滚索引,留下的恰是 B。
 */
function scratchRepo() {
  const dir = mkScratch('safe-commit-del')
  writeFileSync(join(dir, 'a.txt'), 'hello\n')
  writeFileSync(join(dir, 'dead.png'), 'binary-ish\n')
  git(dir, 'init', '-q', '.')
  git(dir, 'config', 'user.email', 'gates@ihui.test')
  git(dir, 'config', 'user.name', 'gates-ith')
  git(dir, 'add', '--', 'a.txt', 'dead.png')
  git(dir, 'commit', '-q', '-m', 'base')
  rmSync(join(dir, 'dead.png'))
  git(dir, 'rm', '--cached', '-q', '--', 'dead.png') // → B 态
  return dir
}

test('机制差(B 态):add 报 pathspec 不匹配,而删除其实已在索引里', () => {
  const dir = scratchRepo()
  try {
    let addErr = ''
    let addOk = true
    try {
      git(dir, 'add', '-A', '--', 'dead.png')
    } catch (e) {
      addOk = false
      addErr = String(e?.stderr || e?.message || '')
    }
    assert.equal(addOk, false, 'B 态下 add 竟然成功 ⇒ 本文件的实测前提变了,判据失效,须重跑三态实验')
    assert.match(addErr, /did not match any files/, `失败签名变了:${addErr}`)
    // 关键:报错 ≠ 无事可做。这一态索引已经表达删除,直接提交即可。
    assert.match(
      git(dir, 'diff', '--cached', '--name-status').trim(),
      /^D\s+dead\.png$/m,
      'B 态必须已经能看到删除 —— 兜底因此不该 exit 1,而是继续走精确性校验',
    )
    git(dir, 'rm', '--cached', '--ignore-unmatch', '-q', '--', 'dead.png') // 幂等出口
    git(dir, 'commit', '-q', '-m', 'delete dead.png', '--', 'dead.png')
    assert.equal(git(dir, 'ls-files', '--', 'dead.png').trim(), '', '提交后索引里不得再有该路径')
    assert.equal(existsSync(join(dir, 'dead.png')), false)
  } finally {
    rmScratch(dir)
  }
})

test('反向对照(C 态):索引与 HEAD 都没有时,兜底必须判"没东西可交"而中止', () => {
  const dir = scratchRepo()
  try {
    git(dir, 'commit', '-q', '-m', 'first delete', '--', 'dead.png') // → C 态(已提交过删除)
    let threw = false
    try {
      git(dir, 'add', '-A', '--', 'dead.png')
    } catch {
      threw = true
    }
    assert.ok(threw, 'C 态 add 应报 pathspec 不匹配')
    const staged = git(dir, 'diff', '--cached', '--name-only').split('\n').filter(Boolean)
    assert.equal(
      staged.includes('dead.png'),
      false,
      'C 态索引里没有任何待提交变化 —— 安全提交的 reMissing 校验据此拒绝继续,这是唯一该中止的一态',
    )
  } finally {
    rmScratch(dir)
  }
})

test('兜底分支真的存在且带方向:retry 失败时走 rm --cached,而不是继续 exit 1', () => {
  const src = readFileSync(join(REPO, 'scripts', 'safe-commit.mjs'), 'utf8')
  const at = src.indexOf("git add (retry)")
  assert.ok(at > 0, '找不到兜底重暂存的调用点 —— 该路径被改名或删除,本测试即失效')
  const block = src.slice(at, at + 2200)
  assert.match(block, /rm', '--cached', '--ignore-unmatch/, '兜底必须带 rm --cached 出口(删除型提交唯一可用的暂存原语)')
  assert.match(block, /existsSync\(join\(repoRoot, normalize\(f\)\)\)/, '在场/删除的分流必须按磁盘实际状态判')
  // 反向:不得再是"add 一失败就 exit 1"的旧形状
  assert.equal(
    /git add \(retry\)[\s\S]{0,220}?if \(reAdd\.status !== 0\) \{\s*log\('err'[\s\S]{0,80}?process\.exit\(1\)\s*\}/.test(
      src.slice(at - 5, at + 400),
    ),
    false,
    '旧的"add 失败即中止"形状又回来了 ⇒ 删除型提交再次无法跳门兜底',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
