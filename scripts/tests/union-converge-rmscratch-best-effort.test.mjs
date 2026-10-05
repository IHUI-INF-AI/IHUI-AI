// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 形状锁:`scripts/union-converge.mjs` 的每一处 `rmScratch` 必须带 `{ bestEffort: true }`。
 *
 * ── 立因(2026-10-05 实测,不是推演) ──────────────────────────────────────────
 * `git-sync-converge.mjs` 的第 1 轮在有分叉时会派生 `union-converge.mjs` 子进程。那一轮报了:
 *   ❌ 未判定:子进程没有产出可用输出(exit=2)⇒ 一处内容都没判 ⇒ union-converge 这个进程**崩了**
 *   [子进程 stderr] ❌ [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
 *                  {"count":220,"threshold":50,...,"targets":["...\\union-idxUo9rSx"]}
 * **判据结论被"临时目录删不掉"改写了**:宿主 shim 的批量删除闸按**本轮累计删除数**计(阈值 50),
 * 一次 converge 的临时目录有 220 个文件 ⇒ `rmSync` 在 `finally` 里抛错 ⇒ 把 try 块里的整段报告
 * 与 `process.exit()` 全吞掉。`scripts/lib/scratch-dir.mjs` 的 `bestEffort` 出口就是为这一族写的
 * (其文件头注释逐字点名了 `union-converge.mjs` 的 `selfTest()` 这个形状),但**8 处调用点一个都没用**。
 *
 * ── 为什么必须是形状锁而不是"跑一次自检" ────────────────────────────────────
 * 实测:改完之后 `--self-test` 105 例全绿;**把 L2705 退回成 `rmScratch(dir)` 再跑,仍然 105 例全绿**
 * —— 因为本轮那 105 项只删了不到 50 个文件,压根碰不到阈值。也就是说**"自检绿"证明不了这条修复**,
 * 阈值是环境量、随夹具规模漂移。要钉住它,只能钉**条件本身**(调用点是否声明了那个出口),
 * 变异敏感点与阈值无关。
 *
 * 变异取证:去掉任一处的 `bestEffort` ⇒ 本锁当场翻红;逐字节还原后复跑全绿。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TARGET = resolve(HERE, '../../scripts/union-converge.mjs')

const src = readFileSync(TARGET, 'utf8')

/** 逐条取出所有 `rmScratch(...)` 调用(跨行闭合,免得参数里带换行时截断) */
function rmScratchCalls(text) {
  const out = []
  const re = /rmScratch\(/g
  let m
  while ((m = re.exec(text)) !== null) {
    let i = m.index + m[0].length
    let depth = 1
    let arg = ''
    while (i < text.length && depth > 0) {
      const c = text[i]
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) break
      }
      arg += c
      i++
    }
    out.push({ index: m.index, arg: arg.trim(), end: i })
  }
  return out
}

// T1:零遗漏 —— 文件里必须至少有一处 rmScratch(防"改名后锁空转"变成永远绿)
test('T1 该文件确有 rmScratch 调用(锁不是空转)', () => {
  assert.ok(rmScratchCalls(src).length >= 8, `只找到 ${rmScratchCalls(src).length} 处,预期 >= 8`)
})

// T2:每一处都必须带 bestEffort 出口 —— 本锁的真正判据
test('T2 每一处 rmScratch 都声明 { bestEffort: true }', () => {
  const bad = rmScratchCalls(src).filter((c) => !/bestEffort\s*:\s*true/.test(c.arg))
  assert.deepEqual(
    bad.map((c) => c.arg),
    [],
    `这些调用点没走 bestEffort 出口 ⇒ 宿主批量删除闸一命中,finally 抛错会吞掉整段报告与 exit()`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
