// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `agent-worktree.mjs` 回收政策镜像测试(2026-11-04 s9 票:命名闸摘除后的成对夹具)。
 *
 * 判据单源(§22c/§0.6):全部断言 import 源脚本的 `__test__`,本文件零复制判据。
 * 钉三组事:
 *  ① 正向:批准落点内、干净、已并入、超龄 ⇒ 收——任意分支名(含非 `wt/*`)与"已证并入的
 *     detached"两类都进射程(旧命名闸让回收腿结构性空转,这一条就是"修成能收到")。
 *  ② 反向成对:脏 / 未并入 / locked / 仓外落点 / 空闲不足 / 活动量不到 —— 每条都先过
 *     "其余全绿可收"的正向对照,再只翻那一闸断 skip;摘掉源脚本里任一闸,对应断言必翻红。
 *  ③ 不扩的两条:仓外落点(C:/D:/E: 之类)结构上不进射程;`--reap` 执行段形状锁 ——
 *     绝不出现自动删分支的派生(分支归 `git branch -d` 与 §12h 裁决)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as aw } from '../agent-worktree.mjs'

const DAY = 86_400_000
const NOW = 1 + 30 * DAY
const ROOTS = { worktreesRoot: '/repo/.worktrees' }
const base = {
  path: '/repo/.worktrees/wt-a',
  branch: 'wt/a',
  merged: true,
  lastActivityMs: 1,
  now: NOW,
  ...ROOTS,
}

test('P1 正向:非 wt/* 分支名不再被拦(命名闸已摘,空转腿修成能收到)', () => {
  for (const branch of ['feature/updater-1104', 'fix/e2e-red-1103', 'main-like/name', 'zh-分支']) {
    const v = aw.evaluateReapCandidate({ ...base, branch })
    assert.equal(v.action, 'remove', `分支 ${branch} 应进射程:${v.reason}`)
    assert.match(v.reason, /只删检出/, '有分支类必须写明回收不动分支')
    assert.match(v.reason, new RegExp(branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'reason 点名保留的分支')
  }
})

test('P2 正向:detached 且 HEAD 已证并入 ⇒ 收(理由一句话:无现场归属+并入即前提)', () => {
  const v = aw.evaluateReapCandidate({ ...base, branch: '', detached: true })
  assert.equal(v.action, 'remove', v.reason)
  assert.match(v.reason, /detached 无现场归属且 HEAD 已证并入 main/)
})

test('P3 反向:detached 未证并入 ⇒ 保留(并入是 detached 删除的存在前提)', () => {
  assert.equal(aw.evaluateReapCandidate({ ...base, branch: '', detached: true }).action, 'remove')
  const v = aw.evaluateReapCandidate({ ...base, branch: '', detached: true, merged: false })
  assert.equal(v.action, 'skip', '摘掉 merged 闸本条必翻红')
  assert.match(v.reason, /detached.*未证并入/)
})

test('P4 反向成对:后四闸+落点闸+活动量一条不弱化(每条先有正向对照再翻单闸)', () => {
  assert.equal(aw.evaluateReapCandidate(base).action, 'remove', '正向对照:全闸绿必须可收')
  const cases = [
    [{ dirty: true }, /未提交\/未跟踪|保留现场/, 'dirty 闸'],
    [{ merged: false }, /未并入 main/, 'merged 闸'],
    [{ locked: true }, /被 lock/, 'locked 闸'],
    [{ path: 'C:/elsewhere/wt-a' }, /不在批准落点.*仓外落点不扩/, '落点闸(仓外不扩)'],
    [{ path: 'D:/IHUI-worktrees/x' }, /不在批准落点/, '落点闸(D 盘不扩)'],
    [{ path: 'E:/IHUI-worktrees/x' }, /不在批准落点/, '落点闸(E 盘不扩)'],
    [{ minIdleDays: 31 }, `最近活动 .* < 阈值 31 天`, '空闲闸(--older-than 保留)'],
    [{ lastActivityMs: 0 }, /量不到最后活动时间/, '活动量不到 ⇒ 保守保留'],
    [{ branch: '' }, /形态判不出/, '无分支且非 detached ⇒ 判不出形态,保守保留'],
  ]
  for (const [over, re, gate] of cases) {
    const v = aw.evaluateReapCandidate({ ...base, ...over })
    assert.equal(v.action, 'skip', `${gate}:摘掉该闸本断言必翻红`)
    assert.match(v.reason, re instanceof RegExp ? re : new RegExp(re), `${gate} 的 reason 必须点名该闸`)
  }
})

test('P5 不扩二:--reap 执行段形状锁——自动回收绝不派生删分支', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-worktree.mjs'),
    'utf8',
  )
  const from = src.indexOf("if (has('--reap'))")
  const to = src.indexOf("if (has('--create'))")
  assert.ok(from > 0 && to > from, '切不到 --reap 段(锚点漂了 ⇒ 本条恒真,§22c 形态锁)')
  const body = src.slice(from, to)
  assert.equal(body.includes(`'branch', '-d'`), false, '--reap 段出现自动删分支 = 扩了"分支归 branch -d"这条不扩')
  assert.equal(body.includes('--tag-lost'), false, '自动回收段不得自带保活旁路(独有提交入口归 --remove 显式路径)')
  assert.match(body, /无回收候选/, '结论行必须保持 parseReapReport 可解析的既有契约')
  assert.match(body, /回收 \$\{removed\} 个/, '成功结论行前缀契约(调度器按它读数)')
  assert.match(body, /locked=.*dirty=.*merged=.*idle=/, 'dry-run 必须逐条打印四闸读数(空转修没修好要靠它核)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
