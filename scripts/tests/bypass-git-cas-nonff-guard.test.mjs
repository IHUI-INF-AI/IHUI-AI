// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:casUpdateRef 的 G-939 丢失集守卫(§22c —— 直接 import 源模块,不复制实现)。
// 立因(台账 G-939,2026-10-21 现读复现):枚 12898ccd9b 被并发 relay 重落 —— main 从 72b3a20c50
// CAS 到一枚"父=更早基底"的同内容新提交。CAS 恰好命中(ref 确实还停在 old),但祖先性不成立,
// rev-list new..old 的丢失集整枚蒸发。门 100/168 是合并形态判据,对这种单亲非 FF 重写结构失明。
// 本镜像钉六件事:
//  1. 快进正常推进 ⇒ 零感知放行(仓内全部落地器都是"现读 HEAD 为父",这一臂必须恒绿);
//  2. relay 事故形态(链 base→A→B,C 父=A,对 B 做 CAS)⇒ 拒写 + 丢失集点名被吞枚 + ref 原样不动;
//  3. allowNonFastForward 具名理由 ⇒ 放行且 ⚠️ 留痕(回退自家刚落地那枚的合法通道);
//  4. 空白理由不构成放行(空串/纯空格 ⇒ 照拒);
//  5. new==old 与创建档(oldSha 空)⇒ 守卫跳过,不误伤 no-op 与首建;
//  6. 祖先关系问不到 ⇒ fail-closed 照抛,绝不折叠成"不是祖先"后放行。
// 另带两条源码形状锁:守卫必须排在 update-ref 派生之前;plan-tasks-merge 的每处回退调用必须带理由。
// 临时仓一律经 scripts/lib/scratch-dir.mjs(§26 唯一夹具落点),git 写操作只发生在临时仓内。

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import * as bg from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], { ...runOpts, stdio: ['ignore', 'pipe', 'pipe'] })

/** 构造 relay 事故现场:base(init)→A(feature)→B(relay-visible),HEAD=B。 */
function makeRelayScene(t) {
  const dir = mkScratch('cas-nonff-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  runGit(dir, ['-c', 'core.autocrlf=false', 'commit', '-q', '--allow-empty', '-m', 'base'])
  const base = runGit(dir, ['rev-parse', 'HEAD']).trim()
  writeFileSync(join(dir, 'a.txt'), 'A\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'A: 他人功能提交'])
  const A = runGit(dir, ['rev-parse', 'HEAD']).trim()
  runGit(dir, ['commit', '-q', '--allow-empty', '-m', 'B: relay 可见顶枚'])
  const B = runGit(dir, ['rev-parse', 'HEAD']).trim()
  return { dir, base, A, B }
}

test('N1 快进正常推进:守卫零感知(现读 HEAD 为父 ⇒ 丢失集恒空,这一臂必须恒绿)', (t) => {
  const { dir, B } = makeRelayScene(t)
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: B, message: 'obj: ff child', treePath: 'a.txt', text: 'C\n' })
  assert.equal(bg.casUpdateRef(C, B, { root: dir }), true)
  assert.equal(bg.git(['rev-parse', 'HEAD'], { root: dir }), C)
})

test('N2 relay 事故形态:父=更早基底的同内容重落 ⇒ 拒写 + 丢失集点名被吞枚 + ref 原样', (t) => {
  const { dir, A, B } = makeRelayScene(t)
  // C 的内容与 B 等价,但父是 A —— 这正是 588a6342d8 那一型:同内容重落到旧基底。
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: A, message: 'obj: relay re-land', treePath: 'a.txt', text: 'A\n' })
  assert.equal(bg.isAncestor(B, C, { root: dir }), false, '夹具前提:B 不得是 C 的祖先')
  let err = null
  try {
    bg.casUpdateRef(C, B, { root: dir })
  } catch (e) {
    err = e
  }
  assert.ok(err, '非快进重写必须被拦下,不得静默放行')
  assert.match(err.message, /非快进重写/, '拒绝消息必须点名非快进')
  assert.match(err.message, /丢失集/, '拒绝消息必须枚举丢失集')
  assert.match(err.message, /B: relay 可见顶枚/, '丢失集必须点名被吞的那枚(可达 old 不可达 new)')
  assert.match(err.message, /allowNonFastForward/, '拒绝消息必须给出合法出口的名字')
  assert.equal(bg.git(['rev-parse', 'HEAD'], { root: dir }), B, '拒写后 ref 必须原样不动')
})

test('N3 allowNonFastForward 具名理由:放行且 ⚠️ 留痕(回退自家落地那枚的合法通道)', (t) => {
  const { dir, A, B } = makeRelayScene(t)
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: A, message: 'obj: rollback-shaped', treePath: 'a.txt', text: 'A\n' })
  const orig = console.log
  let captured = ''
  console.log = (...a) => { captured += a.join(' ') + '\n' }
  let ok
  try {
    ok = bg.casUpdateRef(C, B, { root: dir, allowNonFastForward: 'rollback:回退本器刚落地且复验不过的那枚' })
  } finally {
    console.log = orig
  }
  assert.equal(ok, true, '带非空理由的有意回退必须放行')
  assert.equal(bg.git(['rev-parse', 'HEAD'], { root: dir }), C, '放行后 ref 必须前进')
  assert.match(captured, /⚠️/, '放行必须大声留痕,不得静默')
  assert.match(captured, /rollback:回退本器刚落地且复验不过的那枚/, '留痕必须带上具名理由原文')
  assert.match(captured, /B: relay 可见顶枚/, '留痕必须同时枚举被丢的现场')
})

test('N4 空白理由不构成放行:空串/纯空格/非字符串 ⇒ 照拒', (t) => {
  const { dir, A, B } = makeRelayScene(t)
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: A, message: 'obj: blank-reason', treePath: 'a.txt', text: 'A\n' })
  for (const bad of ['', '   ', '\t\n ', undefined, null]) {
    assert.throws(
      () => bg.casUpdateRef(C, B, { root: dir, allowNonFastForward: bad }),
      /非快进重写/,
      `理由 ${JSON.stringify(bad)} 不得构成放行`,
    )
  }
  assert.equal(bg.git(['rev-parse', 'HEAD'], { root: dir }), B, '全部拒写后 ref 仍原样')
})

test('N5 守卫跳过臂:new==old 的 no-op 与创建档(oldSha 空)⇒ 不误伤', (t) => {
  const { dir, B } = makeRelayScene(t)
  assert.equal(bg.casUpdateRef(B, B, { root: dir }), true, '同枚 CAS 是 no-op,不得触发祖先性判定')
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: B, message: 'obj: fresh ref', treePath: 'a.txt', text: 'C\n' })
  assert.equal(bg.casUpdateRef(C, '', { root: dir, ref: 'refs/heads/fresh-branch' }), true, '首建分支无 old ⇒ 守卫跳过')
  assert.equal(bg.git(['rev-parse', 'refs/heads/fresh-branch'], { root: dir }), C)
})

test('N6 祖先关系问不到 ⇒ fail-closed 照抛,绝不折叠成"不是祖先"后走放行/拒绝臂', (t) => {
  const { dir, B } = makeRelayScene(t)
  const { commit: C } = bg.commitTreeWithIndex({ root: dir, parent: B, message: 'obj: ok child', treePath: 'a.txt', text: 'C\n' })
  // old 指向不存在的对象:isAncestor 回 null(未判定)。即便 update-ref 本身也会因 old 不符而失败,
  // 守卫必须在派生之前抛"问不到",而不是把未判定折叠成非快进后走 allowNonFastForward 的放行臂。
  const ghost = 'f'.repeat(40)
  assert.throws(() => bg.casUpdateRef(C, ghost, { root: dir }), /祖先关系问不到.*fail-closed/)
  assert.throws(
    () => bg.casUpdateRef(C, ghost, { root: dir, allowNonFastForward: 'rollback:任何理由' }),
    /祖先关系问不到/,
    '带理由也救不了未判定 —— 理由只豁免"确认非快进",不豁免"判不出"',
  )
})

test('N7 源码形状锁:守卫必须排在 update-ref 派生之前(否则 CAS 先落盘,判据成事后报告)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(resolve(here, '../lib/bypass-git.mjs'), 'utf8')
  const fnStart = src.indexOf('export function casUpdateRef')
  assert.ok(fnStart !== -1, 'casUpdateRef 必须还在 bypass-git.mjs 里(唯一实现)')
  const fnBody = src.slice(fnStart, src.indexOf('\n}\n', fnStart) + 3)
  const guardAt = fnBody.indexOf('allowNonFastForward')
  const updateAt = fnBody.indexOf("'update-ref', target")
  assert.ok(guardAt !== -1 && updateAt !== -1, '守卫与派生都必须在位')
  assert.ok(guardAt < updateAt, '丢失集守卫必须先于 update-ref 派生 —— 拦在写之前,不是写在之后')
  assert.ok(fnBody.indexOf('isAncestor(oldSha, newSha') !== -1, '判据必须是祖先性三态,不是别的近似')
})

test('N8 调用点形状锁:plan-tasks-merge 的每处回退调用必须带具名理由(守卫上线后无理由=恒抛)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(resolve(here, '../plan-tasks-merge.mjs'), 'utf8')
  const callLines = src.split(/\r?\n/).filter((l) => /^\s*casUpdateRef\(parent,/.test(l))
  assert.ok(callLines.length >= 10, `回退调用点至少 10 处,实取 ${callLines.length}`)
  for (const l of callLines) {
    assert.match(l, /allowNonFastForward: 'rollback:/, `回退点缺具名理由:${l.trim()}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
