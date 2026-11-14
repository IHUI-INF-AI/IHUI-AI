// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-mirror-surface-parity.mjs`(跨包镜像结构字段对账,守门 320)。
 *
 * 判据(什么算"镜像漂移"、字段表怎么抽、枚举怎么比)一律由门体导出的函数裁定
 * (§22c 红线 + 守门 191:测试不得复制判据)。本文件不重述正则、不重列镜像清单,
 * 只调用 `gate.extractFields / gate.compareFields / gate.extractEnumValues / gate.compareEnums`。
 *
 * 〔立此锁的因由〕api-client 是零运行时依赖包,把共享层若干结构复制成镜像,注释里声明
 * 「规则漂移由两侧测试拦下」。2026-11-13 实测证伪:两侧各自的测试都只测自己的形状,
 * **没有一条比较两侧** —— `SendAdmissionReceipt.ahead` 因此在镜像里漏了字段而无人发现,
 * 下游 queued 回执永远读不到排队位次。本测试钉住"对账这件事真的在跑",而不是只看门禁 RC。
 *
 * 用例清单:
 *  T1 真仓装车:inspect() 必须 ok(结构 + 枚举两侧全绿),且对账对象非空(零对象 = 空转)。
 *  T2 核心反演:把真仓镜像里的 ahead 行删掉,判据必须咬住并点名(复现事故原形)。
 *  T3 反向:可选性漂移必须咬住(? → 必填)。
 *  T4 反向:镜像自造字段必须咬住。
 *  T5 枚举:缺一个处置档必须咬住。
 *  T6 未判定:文件读不到时不得记绿。
 *  T7 解析:注释里的伪字段不得被算进字段表。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as gate } from '../check-mirror-surface-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

const ADMISSION_PAIR = gate.MIRROR_PAIRS.find((p) => p.id === 'SendAdmissionReceipt')
assert.ok(ADMISSION_PAIR, 'MIRROR_PAIRS 里必须有 SendAdmissionReceipt —— 锚点漂了先怀疑尺子')

const SHARED_SRC = readFileSync(join(REPO, ADMISSION_PAIR.shared.file), 'utf8')
const MIRROR_SRC = readFileSync(join(REPO, ADMISSION_PAIR.mirror.file), 'utf8')

test('T1 真仓装车:对账全绿,且对账对象非空(零对象 = 空转)', () => {
  const r = gate.inspect(REPO)
  assert.deepEqual(r.errors, [], `真仓镜像漂移:${r.errors.join(' | ')}`)
  assert.deepEqual(r.undetermined, [], `取材失败:${r.undetermined.join(' | ')}`)
  assert.equal(r.ok, true)
  assert.ok(gate.MIRROR_PAIRS.length > 0, '结构对账对象为空 ⇒ 门禁空转')
  assert.ok(gate.MIRROR_ENUM_PAIRS.length > 0, '枚举对账对象为空 ⇒ 门禁空转')
})

test('T2 核心反演:删掉真仓镜像里的 ahead 行 ⇒ 判据必须咬住并点名(事故原形)', () => {
  const sharedFields = gate.extractFields(SHARED_SRC, ADMISSION_PAIR.shared.type)
  const mirrorFields = gate.extractFields(MIRROR_SRC, ADMISSION_PAIR.mirror.type)
  assert.ok(sharedFields, '共享层字段表取不到 —— 判不了就别装作判过')
  assert.ok(mirrorFields)

  // 模拟"镜像里 ahead 那一行不存在"——正是 2026-11-13 之前的真实现场
  const withoutAhead = mirrorFields.filter((f) => f.name !== 'ahead')
  const errs = gate.compareFields(sharedFields, withoutAhead, 'SendAdmissionReceipt')
  assert.ok(errs.length > 0, '删掉 ahead 后判据仍绿 ⇒ 尺子没牙')
  assert.ok(
    errs.some((e) => e.includes('ahead') && e.includes('缺字段')),
    `未点名 ahead:${errs.join(' | ')}`,
  )
})

test('T3 反向:可选性漂移(ahead? → ahead 必填)必须咬住', () => {
  const sharedFields = gate.extractFields(SHARED_SRC, ADMISSION_PAIR.shared.type)
  const mirrorFields = gate.extractFields(MIRROR_SRC, ADMISSION_PAIR.mirror.type)
  const drifted = mirrorFields.map((f) => (f.name === 'ahead' ? { ...f, optional: false } : f))
  const errs = gate.compareFields(sharedFields, drifted, 'X')
  assert.ok(errs.some((e) => e.includes('可选性漂移')), `可选性漂移未被咬住:${errs.join(' | ')}`)
})

test('T4 反向:镜像自造字段必须咬住(下游会读到一个不存在的约定)', () => {
  const sharedFields = gate.extractFields(SHARED_SRC, ADMISSION_PAIR.shared.type)
  const mirrorFields = gate.extractFields(MIRROR_SRC, ADMISSION_PAIR.mirror.type)
  const withInvented = [...mirrorFields, { name: 'notInShared', optional: true }]
  const errs = gate.compareFields(sharedFields, withInvented, 'X')
  assert.ok(errs.some((e) => e.includes('多字段') && e.includes('notInShared')), errs.join(' | '))
})

test('T5 枚举:缺一个处置档必须咬住', () => {
  const pair = gate.MIRROR_ENUM_PAIRS.find((p) => p.id === 'ADMISSION_DISPOSITIONS')
  assert.ok(pair, '枚举对账对象缺失')
  const sharedVals = gate.extractEnumValues(
    readFileSync(join(REPO, pair.shared.file), 'utf8'),
    pair.shared.name,
  )
  assert.ok(sharedVals, '共享层枚举取不到')
  const shortened = sharedVals.slice(0, -1)
  const errs = gate.compareEnums(sharedVals, shortened, 'ADMISSION_DISPOSITIONS')
  assert.ok(errs.some((e) => e.includes('缺取值')), errs.join(' | '))
})

test('T6 未判定:文件读不到 ⇒ 不得记绿(不许把"没跑成"当"没漂移")', () => {
  const r = gate.inspect(join(REPO, 'no-such-root'))
  assert.equal(r.ok, false)
  assert.ok(r.undetermined.length > 0)
})

test('T7 解析:注释里的伪字段不得被算进字段表(验收不是子串搜索)', () => {
  const src = `
export interface Demo {
  /** readonly ghost?: number */
  readonly real: string
}
`
  const fields = gate.extractFields(src, 'Demo')
  assert.deepEqual(
    fields?.map((f) => f.name),
    ['real'],
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
