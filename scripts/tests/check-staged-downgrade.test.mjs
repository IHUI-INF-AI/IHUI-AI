// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-staged-downgrade.mjs × gen-ui-mirror 的镜像测试(2026-11-03 立,§22c)。
 *
 * 钉什么(6 条判据 + 4 条写手闸,判据一律 import 生产出口,本文件零复制第二支判定):
 *  · T1 远祖先旧 blob 进索引 ⇒ 红并点名;
 *  · T2 父版本(HEAD 更新档)回写 ⇒ 红(30c 只看 merge-base 之前,这一格是它漏掉的);
 *  · T3 提交正文 `intentional-revert: <依据>` ⇒ 放行 + 留痕;
 *  · T4 全新内容 ⇒ 不判;T5 无暂存 ⇒ 不判;T6 空口声明(依据过短)⇒ 仍红;
 *  · T7/T8 写手闸 `downgradeGuardOf`:派生结果等于祖先旧档 ⇒ 拒写;新内容 ⇒ 放行;
 *  · T9/T10 写手闸 HEAD 三态:取不到 ⇒ 未判定拒写;确实缺席 ⇒ 放行(新增文件)。
 *
 * 夹具纪律(§15b):一律 mkScratch 独立仓,不落仓库树;真实 ROOT 在本文件内**只读零写**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-staged-downgrade.mjs'
import { downgradeGuardOf } from '../gen-ui-mirror.mjs'

const REL = 'f.ts'

function makeRepo(seed = 'v1\n') {
  const dir = mkScratch('staged-downgrade-')
  const g = (args) => String(gitRaw(args, dir)).trim()
  g(['init', '-q'])
  g(['config', 'user.email', 'test@local'])
  g(['config', 'user.name', 'test'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, REL), seed, 'utf8')
  g(['add', REL])
  g(['commit', '-q', '-m', 'v1'])
  return { dir, g }
}

function stage(dir, g, text) {
  writeFileSync(join(dir, REL), text, 'utf8')
  g(['add', REL])
}

function commitAs(dir, g, text, msg) {
  stage(dir, g, text)
  g(['commit', '-q', '-m', msg])
}

test('T1 远祖先旧 blob 暂存 ⇒ 判红并点名路径', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    commitAs(dir, g, 'v3\n', 'v3')
    stage(dir, g, 'v1\n')
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'fail')
    assert.equal(r.stale.length, 1)
    assert.equal(r.stale[0].path, REL)
    assert.match(r.stale[0].ancestor, /^[0-9a-f]{40}$/)
  } finally {
    rmScratch(dir)
  }
})

test('T2 父版本(HEAD 已有更新档)回写 ⇒ 判红', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'v1\n')
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'fail')
    assert.equal(r.stale.length, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T3 合法回滚声明 ⇒ 放行并留痕', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'v1\n')
    const r = gate.judge({
      root: dir,
      message: 'fix: 回滚 token 化\n\nintentional-revert: 撤销小程序 token 化,RN 侧尚未迁移\n',
    })
    assert.equal(r.state, 'waived')
    assert.match(r.rationale, /RN 侧尚未迁移/)
    const led = gate.appendRevertLedger(dir, r)
    assert.equal(led.ok, true)
    const ledger = join(dir, '.ihui-agent/state/intentional-revert.jsonl')
    assert.equal(existsSync(ledger), true)
    const row = JSON.parse(readFileSync(ledger, 'utf8').trim().split('\n').at(-1))
    assert.equal(row.gate, '292')
    assert.equal(row.path, REL)
    assert.equal(row.rationale, '撤销小程序 token 化,RN 侧尚未迁移')
  } finally {
    rmScratch(dir)
  }
})

test('T4 全新内容(不等于任何祖先 blob)⇒ 不判', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'gamma-brand-new\n')
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'pass')
    assert.equal(r.judged, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T5 无暂存 ⇒ 不判(judged=0)', () => {
  const { dir } = makeRepo()
  try {
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'pass')
    assert.equal(r.judged, 0)
    assert.equal(r.stale.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T6 空口声明(依据 <8 字符)⇒ 仍判红', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'v1\n')
    const r = gate.judge({ root: dir, message: 'chore\n\nintentional-revert: 回滚\n' })
    assert.equal(r.state, 'fail')
  } finally {
    rmScratch(dir)
  }
})

test('T7 写手闸:派生结果逐字等于祖先旧档 ⇒ 拒写', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    const headText = String(gitRaw(['show', `HEAD:${REL}`], dir))
    const oldText = String(gitRaw(['show', `HEAD^:${REL}`], dir))
    const guardOld = downgradeGuardOf(REL, oldText, dir)
    assert.equal(guardOld.allow, false)
    assert.match(guardOld.match.commit, /^[0-9a-f]{40}$/)
    const guardHead = downgradeGuardOf(REL, headText, dir)
    assert.equal(guardHead.allow, true)
  } finally {
    rmScratch(dir)
  }
})

test('T8 写手闸:新内容不等于祖先 ⇒ 放行', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    const guard = downgradeGuardOf(REL, 'brand-new-mirror\n', dir)
    assert.equal(guard.allow, true)
  } finally {
    rmScratch(dir)
  }
})

test('T9 写手闸:HEAD 取不到(空仓)⇒ 未判定且拒写,不折成"新增文件"', () => {
  const dir = mkScratch('staged-downgrade-')
  try {
    String(gitRaw(['init', '-q'], dir))
    const guard = downgradeGuardOf(REL, 'brand-new-mirror\n', dir)
    // §0.3:取不到 ≠ 路径缺席;失效方向必须是"不写并报未判定",不是静默放行。
    assert.equal(guard.allow, false)
    assert.equal(guard.undetermined, true)
  } finally {
    rmScratch(dir)
  }
})

test('T10 写手闸:HEAD 可解析但路径确实不在 ⇒ 放行(新增文件)', () => {
  const { dir } = makeRepo()
  try {
    const guard = downgradeGuardOf('new-shell.ts', 'brand-new-mirror\n', dir)
    assert.equal(guard.allow, true)
    assert.match(guard.why, /新增文件/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
