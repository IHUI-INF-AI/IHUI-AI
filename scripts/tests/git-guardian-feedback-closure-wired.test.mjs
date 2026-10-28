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

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GUARDIAN_SRC = path.join(ROOT, 'scripts', 'git-guardian.mjs')
const FN = 'auditFeedbackLoopClosure'

/**
 * 取 startDaemon 里 `const tick = () => {` 之后的正文(判不出 ⇒ 空串,由断言判红)。
 *
 * 边界怎么定:配平花括号会被模板字符串/注释里的 `{` 带偏,所以这里按**缩进**收口 ——
 * tick 体整体有缩进,遇到列 0 的非空行即视为 startDaemon 结束。失效方向是"提前收口
 * ⇒ 判不出 ⇒ 判红",绝不会把 main() 一次性路径里的调用读成 tick 接线。
 */
function tickBodyOf(src) {
  const i = src.indexOf('function startDaemon')
  if (i < 0) return ''
  const j = src.indexOf('const tick = () => {', i)
  if (j < 0) return ''
  const lines = src.slice(j).split(/\r?\n/)
  const out = []
  for (let k = 1; k < lines.length; k++) {
    const l = lines[k]
    if (l.trim() !== '' && !/^\s/.test(l)) break
    out.push(l)
  }
  return out.join('\n')
}

/** 只看非注释行:注释里出现调用名不算接线。 */
function hasLiveCall(body, name) {
  return String(body)
    .split(/\r?\n/)
    .some((raw) => {
      const t = raw.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false
      return t.includes(`${name}(`)
    })
}

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
