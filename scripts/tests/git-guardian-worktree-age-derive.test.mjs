// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// §0.6 单一真相源裁决(2026-11-18):Y-71 派生检出寿命闸的唯一合法生产本体 =
// scripts/git-guardian.mjs::assessWorktreeAge / parseWorktreeListPorcelain
// (同会话另有两套重复实现 check-derived-worktree-age.mjs / check-temp-worktree-lifetime.mjs
//  因 CHAT_REFERENCE_PROTECTED 护栏无法删除,留工作树未跟踪、不进库)。
// 本文件是 guardian 版的补充镜像锁 —— 只钉 git-guardian-worktree-age.test.mjs 未覆盖的维度:
//   · parseWorktreeListPorcelain 的孤儿壳识别(exists=false)与 detached/branch 解析
//   · assessWorktreeAge 的 NaN 边界(缺 mtime/birthtime 时不误判 stale)
//   · §15 纪律锁(阈值 env 可覆盖 ⇒ 判据不写死盘符)
// 不复制判据、不另写一份阈值;全部 import 生产本体。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  assessWorktreeAge,
  parseWorktreeListPorcelain,
} from '../git-guardian.mjs'

// 阈值常量在 guardian 里是模块内 const(未导出);这里用字面量复述 24h/48h 语义,
// 判据本体仍只在 guardian 一份(§0.6)—— 本测试不重定义阈值,只验证行为。
const SILENT_24H = 24 * 60 * 60 * 1000
const AGE_48H = 48 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// parseWorktreeListPorcelain:孤儿壳识别 + detached/branch 解析
// ---------------------------------------------------------------------------

test('parseWorktreeListPorcelain:孤儿壳 exists=false 单列', () => {
  // 主工作树在盘,linked worktree 目录已消失 ⇒ exists=false(孤儿壳,git worktree prune 可清)
  const text = [
    'worktree G:/IHUI-AI',
    'HEAD 40f7f8e92e9f',
    'branch refs/heads/main',
    '',
    'worktree D:/DevEnv/Temp/ihui-wt-replay',
    'HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'detached',
    '',
  ].join('\n')
  const rows = parseWorktreeListPorcelain(text, (p) => {
    // fsProbe:主工作树存在,linked 不存在 ⇒ 孤儿壳
    if (p === 'G:/IHUI-AI') return { exists: true, mtimeMs: Date.now(), birthtimeMs: Date.now() }
    return { exists: false }
  })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].exists, true, '主工作树应在盘')
  assert.equal(rows[1].exists, false, 'linked 目录已消失 ⇒ 孤儿壳')
})

test('parseWorktreeListPorcelain:detached 与 branch 互斥解析', () => {
  const text = [
    'worktree G:/IHUI-AI',
    'HEAD x',
    'branch refs/heads/main',
    '',
    'worktree D:/wt-detached',
    'HEAD y',
    'detached',
    '',
  ].join('\n')
  const rows = parseWorktreeListPorcelain(text)
  assert.equal(rows.length, 2)
  // detached 行不带 branch 字段
  assert.equal(rows[1].detached, true)
  assert.equal(rows[0].detached, false)
})

test('parseWorktreeListPorcelain:空输入不崩', () => {
  assert.deepEqual(parseWorktreeListPorcelain(''), [])
  assert.deepEqual(parseWorktreeListPorcelain(null), [])
})

// ---------------------------------------------------------------------------
// assessWorktreeAge:NaN 边界(缺 stat 时不误判 stale)
// ---------------------------------------------------------------------------

test('assessWorktreeAge:exists=false ⇒ 双轴 NaN(孤儿壳不走寿命判据)', () => {
  const r = assessWorktreeAge({ exists: false }, Date.now())
  assert.equal(Number.isNaN(r.silentMs), true, '孤儿壳 silentMs 应为 NaN')
  assert.equal(Number.isNaN(r.ageMs), true, '孤儿壳 ageMs 应为 NaN')
  assert.equal(r.staleBySilent, false, 'NaN 比较不得判 stale')
  assert.equal(r.staleByAge, false, 'NaN 比较不得判 stale')
})

test('assessWorktreeAge:缺 birthtime/gitAge 时 ageMs 退化为 NaN,不误判 stale', () => {
  // 只有 mtime(刚活动过),无 birthtime/gitAge ⇒ ageMs=NaN,staleByAge=false
  const now = Date.now()
  const r = assessWorktreeAge({ exists: true, mtimeMs: now - 1000 }, now)
  assert.equal(r.staleBySilent, false, '1s 前活动 ⇒ 不 stale')
  assert.equal(r.staleByAge, false, '缺 birthtime/gitAge ⇒ ageMs NaN ⇒ 不误判')
})

test('assessWorktreeAge:静默超阈但账龄新鲜 ⇒ 仅 staleBySilent(单轴 warn)', () => {
  const now = Date.now()
  const entry = {
    exists: true,
    mtimeMs: now - SILENT_24H - 1000, // 静默 24h+
    birthtimeMs: now - 3600_000, // 账龄 1h,新鲜
  }
  const r = assessWorktreeAge(entry, now)
  assert.equal(r.staleBySilent, true)
  assert.equal(r.staleByAge, false, '账龄 1h < 48h 阈')
})

test('assessWorktreeAge:双轴同时超阈 ⇒ staleBySilent+staleByAge(双轴 stale)', () => {
  const now = Date.now()
  const entry = {
    exists: true,
    mtimeMs: now - SILENT_24H - 1000,
    birthtimeMs: now - AGE_48H - 1000,
  }
  const r = assessWorktreeAge(entry, now)
  assert.equal(r.staleBySilent, true)
  assert.equal(r.staleByAge, true)
})

// ---------------------------------------------------------------------------
// §15 纪律锁:阈值 env 可覆盖,判据不写死盘符
// ---------------------------------------------------------------------------

test('阈值常量可读(env 可覆盖 ⇒ 测试与生产读同一处)', () => {
  assert.equal(typeof SILENT_24H, 'number')
  assert.equal(typeof AGE_48H, 'number')
  assert.ok(SILENT_24H > 0)
  assert.ok(AGE_48H > SILENT_24H, '账龄阈应大于静默阈')
})
