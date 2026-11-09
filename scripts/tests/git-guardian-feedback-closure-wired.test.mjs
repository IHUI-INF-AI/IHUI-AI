// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 结构锁:反馈闭环巡检必须挂在守护 tick 上,而不只是 main() 一次性路径。
//
// 为什么要有这道锁(2026-10-28 实测踩坑):`startDaemon()` 是内存常驻的 setTimeout 链,
// **不重读本文件**。巡检只挂在 `if (!CHECK_ONLY)` 的 main() 单轮路径时,常驻守护永远跑不到
// 那一格 —— 状态件 feedback-loop-closure-last.json 却有内容(来自手工验证那一次),
// 于是"器件在、台账在、没人看",闭环退化成假绿。这类失效永远是安静的,只能靠结构锁拦。
//
// 本文件只锁"调用出现在 tick 体内"这一件事,不复制任何判据(判据在 git-guardian.mjs)。
// 注释行不算接线 —— 抄一句注释就自称已接线的写法必须被判红。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as P } from '../check-sweeper-liveness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GUARDIAN_SRC = path.join(ROOT, 'scripts', 'git-guardian.mjs')
const FN = 'auditFeedbackLoopClosure'

/**
 * 切片与"非注释实调用"判据**只此一份**(§0.6/§22c):import 门体 `__test__`,本文件零副本。
 * 2026-11-07 收口:本文件原先自带一份 `tickBodyOf`/`hasLiveCall` 副本,而被锁面同日改变形态
 * (四条长腿改 spawn + await ⇒ `const tick = async () => {`)—— 副本只认死字面量 ⇒ 整段切不出
 * ⇒ T1 从"锁住"退化成"判不出"。两处同时改同一判据正是"第二把尺子必然漂移"的实证:
 * 与其把字面量再放宽一遍,不如让它认同一把尺。
 */
const { tickBodyOf, hasLiveCall } = P

test('T0 判据单源:切片/非注释判据 import 门体 __test__,本文件零副本(§0.6/§22c)', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.equal(typeof tickBodyOf, 'function')
  assert.equal(typeof hasLiveCall, 'function')
  assert.deepEqual([tickBodyOf, hasLiveCall], [P.tickBodyOf, P.hasLiveCall], '必须用门体同一把尺')
  assert.ok(
    !/function\s+(tickBodyOf|hasLiveCall)\s*\(/.test(self),
    '不得自带切片/判据副本 ⇒ 被锁面形态一变,副本与门体就各判一套',
  )
})

test('T1 正证:守护 tick 体内存在非注释的巡检调用', () => {
  const src = readFileSync(GUARDIAN_SRC, 'utf8')
  const body = tickBodyOf(src)
  assert.notEqual(body, '', '判不出 tick 体(startDaemon/const tick 形态变了)⇒ 不得默认已接线')
  assert.ok(
    hasLiveCall(body, FN),
    `守护 tick 内未找到非注释的 ${FN}() 调用 —— 常驻守护不重读脚本,只挂 main() 等于永远不跑`,
  )
})

test('T2 反证:仅出现在注释里不算接线', () => {
  const commented = `function startDaemon() {\n  const tick = () => {\n    // ${FN}()\n    // 与 main() 单轮路径同一挂点语义\n  }\n}\n`
  assert.equal(
    hasLiveCall(tickBodyOf(commented), FN),
    false,
    '注释行出现调用名被当成已接线 ⇒ 这道锁就没用了',
  )
})

test('T3 反证:tick 里没有、只有 main() 里有 ⇒ 判未接线(本次踩坑的原始形态)', () => {
  const onlyMain = `function startDaemon() {\n  const tick = () => {\n    auditOpsPatrol()\n  }\n}\nif (!CHECK_ONLY) ${FN}()\n`
  assert.equal(
    hasLiveCall(tickBodyOf(onlyMain), FN),
    false,
    '只挂 main() 一次性路径被判成已接线 ⇒ 常驻守护依旧跑不到',
  )
})

test('T4 反证:找不到 startDaemon / tick 形态 ⇒ 判不出,不得默认已接线', () => {
  assert.equal(tickBodyOf('export function auditX() {}\n'), '')
  assert.equal(tickBodyOf('function startDaemon() { setTimeout(tick, 10) }\n'), '')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
