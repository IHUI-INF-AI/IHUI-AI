// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/rp71-ledger-heal-verdict.test.mjs
// RP-71 测试面:台账自愈「回插 0 条 / 跑而未成」不得被当静默成功。
// 三席并行:本文件只按固定契约 A/B 断言生产纯函数;符号未落盘时**明确 fail**并写明「等并行席落盘」,
// 绝不写成 t.skip / 恒真的假绿。T7 静态锁与 T8 变异自证不依赖生产符号,可独立跑。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = (rel) => readFileSync(join(HERE, '..', rel), 'utf8')

// 动态 import:另两席可能还没落盘,顶层静态 import 会把整份测试拖成加载失败/假跳过。
// 这里把「模块加载失败」与「符号未导出」都收进用例内的明确 fail。
let gateMod = null
let bypassMod = null
let importError = null
try {
  gateMod = await import(pathToFileURL(join(HERE, '..', 'check-plan-line-loss.mjs')).href)
  bypassMod = await import(pathToFileURL(join(HERE, '..', 'lib', 'bypass-git.mjs')).href)
} catch (e) {
  importError = e
}

function contractFn(name, mod, label) {
  assert.equal(
    importError,
    null,
    `RP-71 契约 ${label} 的生产模块尚未落盘/加载失败 ⇒ 等并行席落盘(不得把这份测试写成永远跳过的假绿):${importError?.message ?? ''}`,
  )
  const fn = mod?.[name] ?? mod?.__test__?.[name]
  assert.equal(
    typeof fn,
    'function',
    `RP-71 契约 ${label}:${name} 尚未导出 ⇒ 等并行席落盘(不得把这份测试写成永远跳过的假绿)`,
  )
  return fn
}
const contractA = () => contractFn('healOutcomeExit', gateMod, 'A/check-plan-line-loss.mjs')
const contractB = () => contractFn('landingExitWithHeal', bypassMod, 'B/lib/bypass-git.mjs')

// ── 契约 A:healOutcomeExit({ expected, inserted, appended, refusedRows, accounted, indexUndetermined }) ──
// 判据优先级:① refusedRows>0 ⇒ 1;② indexUndetermined && expected>0 ⇒ 2;
// ③ expected>0 && inserted+appended===0 && accounted<expected ⇒ 2;④ 其余 ⇒ 0。

test('T1 契约A 主反向臂:回插 0 条且无交代 ⇒ exit 2 且 undetermined', () => {
  const healOutcomeExit = contractA()
  const v = healOutcomeExit({ expected: 4, inserted: 0, appended: 0, accounted: 0, refusedRows: 0 })
  assert.equal(v.exitCode, 2, 'RP-71:expected 4 / 零写回 / 零交代 ⇒ 2 未判定,不得报绿')
  assert.equal(v.undetermined, true, '主反向臂必须同时标 undetermined:true')
})

test('T2 契约A 反恒红对照:accounted>=expected(全部有正当不回插交代)必须仍为 0', () => {
  const healOutcomeExit = contractA()
  const v = healOutcomeExit({ expected: 4, inserted: 0, appended: 0, accounted: 4 })
  assert.equal(v.exitCode, 0, 'RP-71 反恒红要点:交代齐了就不是"跑而未成",不得一律钉成 2')
})

test('T3 契约A 正向臂:inserted+appended 凑齐 expected ⇒ 0', () => {
  const healOutcomeExit = contractA()
  const v = healOutcomeExit({ expected: 4, inserted: 3, appended: 1 })
  assert.equal(v.exitCode, 0, '真的回插到位 ⇒ 0')
})

test('T4 契约A 拒绝行优先级:refusedRows=2 + 零写回 ⇒ 1(不得折成 2)', () => {
  const healOutcomeExit = contractA()
  const v = healOutcomeExit({ expected: 4, inserted: 0, appended: 0, accounted: 0, refusedRows: 2 })
  assert.equal(v.exitCode, 1, '① 拒绝同号多候选优先于零写回未判定,不得折成 2')
})

test('T5 契约A 索引未判定:expected>0 一律 2(有交代也不例外);expected=0 仍 0', () => {
  const healOutcomeExit = contractA()
  const a = healOutcomeExit({
    expected: 2,
    inserted: 0,
    appended: 0,
    accounted: 2,
    refusedRows: 0,
    indexUndetermined: true,
  })
  assert.equal(a.exitCode, 2, '② indexUndetermined && expected>0 ⇒ 2,accounted 齐了也压不住')
  const b = healOutcomeExit({
    expected: 0,
    inserted: 0,
    appended: 0,
    accounted: 0,
    refusedRows: 0,
    indexUndetermined: true,
  })
  assert.equal(b.exitCode, 0, 'expected=0 ⇒ 本轮没候选,索引未判定也仍为 0')
})

// ── 契约 B:landingExitWithHeal(baseCode, heal) ──
// !heal || !heal.triggered ⇒ baseCode;baseCode!==0 ⇒ baseCode;否则 heal.ran && heal.ok ? 0 : 2。

test('T6 契约B 六臂:base 保留 / 未触发保留 / 跑而未成 2 / 成功 0 / null 保留', () => {
  const landingExitWithHeal = contractB()
  assert.equal(
    landingExitWithHeal(1, { triggered: true, ran: true, ok: true }),
    1,
    'base=1 原样保留(落地本身已失败,自愈不得洗白)',
  )
  assert.equal(
    landingExitWithHeal(0, { triggered: false, ran: false, ok: false }),
    0,
    'triggered:false 原样返回 base,不得折成 2',
  )
  assert.equal(
    landingExitWithHeal(0, { triggered: true, ran: false, ok: true }),
    2,
    'ran:false(根本没派生成功)⇒ 2 未判定',
  )
  assert.equal(
    landingExitWithHeal(0, { triggered: true, ran: true, ok: false }),
    2,
    'ok:false(跑而未成)⇒ 2 未判定,不得报绿',
  )
  assert.equal(landingExitWithHeal(0, { triggered: true, ran: true, ok: true }), 0, 'ran && ok ⇒ 0')
  assert.equal(landingExitWithHeal(0, null), 0, 'heal=null ⇒ 原样返回 base')
})

// ── T7 静态装车锁:readFileSync + assert.match,不跑真仓、不跑落地器 ──

test('T7 静态装车锁:两台落地器真消费 rerunLedgerHeal 返回值并走 landingExitWithHeal;heal() 函数体真调 healOutcomeExit', () => {
  for (const rel of ['live-doc-edit.mjs', 'object-space-land.mjs']) {
    const code = SRC(rel)
    assert.match(
      code,
      /const\s+ledgerHeal\s*=\s*rerunLedgerHeal\(/,
      `${rel} 必须接收 rerunLedgerHeal(...) 的返回值;不接收 ⇒ 自愈成败永远喂不进退出码`,
    )
    assert.match(
      code,
      /landingExitWithHeal\(/,
      `${rel} 必须出现 landingExitWithHeal( 的调用(只在 import 行挂个名字 = 接线退化,防的就是这一型)`,
    )
  }
  // 防接线退化:纯函数定义了却没在 heal() 里被调用 = 纸面判据。
  // 从真正的顶层 `function heal(` 切到下一个顶层 export,避开 __test__ 清单里的同名标识符(不带括号)。
  const loss = SRC('check-plan-line-loss.mjs')
  const healAt = loss.search(/\nfunction heal\(/)
  assert.ok(healAt > 0, 'check-plan-line-loss.mjs 必须能定位到顶层 function heal(')
  const afterHeal = loss.slice(healAt + 1)
  const nextExport = afterHeal.search(/\nexport\s/)
  const healBody = nextExport > 0 ? loss.slice(healAt, healAt + 1 + nextExport) : loss.slice(healAt)
  assert.match(
    healBody,
    /healOutcomeExit\(/,
    'heal() 函数体必须真调用 healOutcomeExit( —— 定义了纯函数却不接线 = 纸面判据',
  )
})

// ── T8 变异自证:证明 T6 的失败臂判据不是恒真 ──

test('T8 变异自证:等价实现把契约B 失败臂改成恒返回 0 时,T6 的判据会翻红', () => {
  // 真变异以 H3/L3 端到端用例为准;这里只在测试内写一份契约 B 的等价实现,
  // 把 `heal.ran && heal.ok ? 0 : 2` 的失败臂 2 改成恒 0(等于把 RP-71 的 bug 钉回绿),
  // 用它证明 T6 里 `assert.equal(..., 2)` 那条判据确实有牙、不是恒真。
  const mutated = (baseCode, heal) => {
    if (!heal || !heal.triggered) return baseCode
    if (baseCode !== 0) return baseCode
    return 0 // ← 变异点:失败臂恒 0
  }
  const failedArm = { triggered: true, ran: true, ok: false }
  assert.notEqual(mutated(0, failedArm), 2, '变异实现在失败臂上必须不等于 2 ⇒ T6 判据会翻红')
  assert.throws(
    () => assert.equal(mutated(0, failedArm), 2),
    '拿变异实现重跑 T6 的失败臂断言必须抛(⇒ T6 不是恒真)',
  )
  assert.equal(
    mutated(0, { triggered: true, ran: true, ok: true }),
    0,
    '变异只钉失败臂,成功臂仍与契约一致(变异是精确的)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
