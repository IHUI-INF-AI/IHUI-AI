// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「壳声明件自刷腿」的回归(§22c:判据 import 源器物,零复制)。
 *
 * 立因(2026-10-26 现读):造页闭环自动落了 3 枚承载页之后,门 251 C9 当场判红 ——
 * `apps/miniapp-taro/types/rn-shells.generated.d.ts` 与面上 16 条说明符不同步。
 * 被拦的是**下一位提交者**,而他的整改动作只有"重跑生成器",那正是器物能自己做的(§5e-1)。
 *
 * 钉四件事:
 *   T1 clean(派生结果与 HEAD 逐字节相同)⇒ 零写,不得把本轮报成"写了东西"(调度器读 clean = 零写零推);
 *   T2 landed ⇒ blobs 计数 +1 且 state=landed(确实写了东西时不能报 clean);
 *   T3 pending(有差异但没落地)⇒ 只点名、不改 state(下轮再试,不冒充成功);
 *   T4 未判定三档(派生抛错 / 派生器自述未判定 / HEAD 面取不到)一律落 undetermined,
 *      且**只在原本 clean 时**把整轮降级 —— 页面已 landed 的批次不因派生腿取不到结论而改判。
 */
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as lander } from '../land-cross-end-shell-pages.mjs'
import { __test__ as shellTypes } from '../gen-rn-shell-types.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('T1 clean:派生件与 HEAD 逐字节相同 ⇒ 零写,state 不变', () => {
  const r = lander.foldShellTypesResult({ state: 'clean', blobs: 0, planned: 0 }, { state: 'clean' })
  assert.equal(r.state, 'clean')
  assert.equal(r.blobs, 0, 'clean 不得凭空加 blob 数')
  assert.equal(r.types, 'clean')
})

test('T2 landed:确实写了东西 ⇒ blobs+1 且不得报 clean', () => {
  const r = lander.foldShellTypesResult({ state: 'clean', blobs: 1 }, { state: 'landed' })
  assert.equal(r.state, 'landed')
  assert.equal(r.blobs, 2)
})

test('T3 pending:有差异没落地 ⇒ 只点名,不冒充成功也不改 state', () => {
  const r = lander.foldShellTypesResult(
    { state: 'clean', blobs: 0 },
    { state: 'pending', why: 'CAS 撞了' },
  )
  assert.equal(r.state, 'clean')
  assert.match(r.note ?? '', /壳声明件/)
})

test('T4 未判定:派生抛错 / 自述未判定 / HEAD 取不到 ⇒ undetermined(clean 才降级)', () => {
  const boom = lander.syncShellTypes({
    collect: () => {
      throw new Error('读面失败')
    },
  })
  assert.equal(boom.state, 'undetermined')
  assert.match(boom.why, /声明件派生失败/)

  const undet = lander.syncShellTypes({
    collect: () => ({ next: 'x', modules: [], undetermined: ['某页认不出壳'] }),
    headOf: () => 'whatever',
  })
  assert.equal(undet.state, 'undetermined')

  const noHead = lander.syncShellTypes({
    collect: () => ({ next: 'x', modules: [], undetermined: [] }),
    headOf: () => {
      throw new Error('HEAD 读不到')
    },
  })
  assert.equal(noHead.state, 'undetermined')

  const degraded = lander.foldShellTypesResult({ state: 'clean', blobs: 0 }, noHead)
  assert.equal(degraded.state, 'undetermined', '本来 clean 的轮次取不到结论不得记绿')
  const kept = lander.foldShellTypesResult({ state: 'landed', blobs: 2 }, noHead)
  assert.equal(kept.state, 'landed', '页面已落地的批次不因派生腿未判定而改判')
})

test('T5 幂等:applyBlock 往返一次后再算应判 clean(派生器与折叠口径同源)', () => {
  const plan = { next: 'export interface X { a: 1 }', modules: ['@rn-shells/X'], undetermined: [] }
  const seeded = shellTypes.applyBlock('', plan.next)
  const again = shellTypes.applyBlock(seeded, plan.next)
  assert.equal(again, seeded, 'applyBlock 必须幂等,否则每轮都判"有差异"→ 无限落地')
  const r = lander.syncShellTypes({
    collect: () => plan,
    headOf: () => seeded,
  })
  assert.equal(r.state, 'clean', `HEAD 面已是派生结果 ⇒ clean(实得 ${r.state}:${r.why ?? ''};root=${ROOT})`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
