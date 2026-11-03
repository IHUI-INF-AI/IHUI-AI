// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console */
/**
 * tests/sync-miniapp-message-keys.test.mjs —— 词包搬运器镜像测试(§22c:判据 import 源脚本 __test__)
 * 覆盖:计划来源零复算 / 只补空不覆盖 / 基准侧全查无不冒绿 / 最小插入可回读 / 结论行形状锁(派发体靠它)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as X } from '../sync-miniapp-message-keys.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'sync-miniapp-message-keys.mjs')

let n = 0
const ok = (name, fn) => {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

const packs = {
  'mobile-rn/zh-CN': { career: { exportingReport: '导出中...', onlyRn: 'RN 独有' } },
  'shared/zh-CN': { career: { exportingReport: '不该被取到' }, feedback: { submit: '提交' } },
  'web/zh-CN': {},
  'miniapp-taro/zh-CN': { career: { existing: '已有' }, feedback: {} },
}
const read = (pack, lang) => packs[`${pack}/${lang}`] ?? null

ok('needsFromFidelity:只从 packAbsent 取命名空间并按真形状(sharedKeys 是计数,不是键数组)', () => {
  const rows = [
    { packAbsent: ['career'], sharedKeys: 3, missing: ['career.exportingReport'] },
    { packAbsent: [], sharedKeys: 15 },
    { packAbsent: ['career', 'ghost'], sharedKeys: 1 },
  ]
  assert.deepEqual(X.needsFromFidelity({ rows }), ['career', 'ghost'])
  assert.deepEqual(X.needsFromFidelity({}), [])
  assert.deepEqual(X.needsFromFidelity(null), [])
})

ok('planMoves:整块搬基准侧命名空间,RN 包先命中,五语言同批(少一语 = 搬出半套词包)', () => {
  const rnOf = (lang) => ({ career: { exportingReport: `导出中-${lang}`, exportEmptyHint: '空提示' } })
  const { moves, unresolvable } = X.planMoves(['career'], (p, l) =>
    p === 'mobile-rn' ? rnOf(l) : read(p, l),
  )
  assert.equal(unresolvable.length, 0)
  assert.equal(moves.length, 10) // 2 键 × 5 语言
  const zh = moves.find((m) => m.key === 'exportingReport' && m.lang === 'zh-CN')
  assert.equal(zh.value, '导出中-zh-CN') // RN 包先命中,不落到 shared 的另一句
  assert.equal(zh.from, 'mobile-rn')
})

ok('planMoves:基准侧只有 shared 有该块 ⇒ 落到第二档(优先序真生效,不是只认 RN)', () => {
  const { moves } = X.planMoves(['feedback'], (p, l) => (p === 'mobile-rn' ? {} : read(p, l)))
  const zh = moves.filter((m) => m.lang === 'zh-CN')
  assert.deepEqual(zh.map((m) => `${m.key}=${m.value}@${m.from}`).sort(), ['submit=提交@shared'])
})

ok('只补空:本端包已有该键 ⇒ 一条也不搬(零覆盖反向对照)', () => {
  const { moves } = X.planMoves(['career'], (p, l) =>
    p === 'mobile-rn' ? { career: { existing: '基准侧的另一句' } } : read(p, l),
  )
  assert.equal(moves.filter((m) => m.lang === 'zh-CN').length, 0)
})

ok('基准侧全查无 ⇒ unresolvable 逐枚点名,绝不代拟(未判定不冒绿)', () => {
  const empty = () => ({})
  const { moves, unresolvable } = X.planMoves(['ghost'], empty)
  assert.equal(moves.length, 0)
  assert.equal(unresolvable.length, 5) // 五语言各点名一次,不静默合并
  assert.ok(unresolvable.includes('ghost@ja'))
})

const sample = `{
  "career": {
    "existing": "已有"
  },
  "feedback": {
  }
}
`

ok('insertIntoJson:已存在命名空间 ⇒ 在其块内追加;新命名空间 ⇒ 根末追加;回读逐字节等值', () => {
  const step1 = X.insertIntoJson(sample, 'career', [['exportingReport', '导出中...']])
  assert.ok(step1)
  const parsed1 = JSON.parse(step1)
  assert.equal(parsed1.career.exportingReport, '导出中...')
  assert.equal(parsed1.career.existing, '已有') // 原有键一字不动

  const step2 = X.insertIntoJson(step1, 'brand', [
    ['title', '智汇 "AI" — 让学习更高效'],
  ])
  const parsed2 = JSON.parse(step2)
  assert.equal(parsed2.brand.title, '智汇 "AI" — 让学习更高效')

  const step3 = X.insertIntoJson(sample, 'feedback', [['submit', '提交']])
  assert.equal(JSON.parse(step3).feedback.submit, '提交')
  assert.ok(step3.includes('\n    "submit"'), '空块内插入须带缩进')
})

ok('insertIntoJson:整块缺失 ⇒ 发嵌套对象(顶层命名空间必须真存在,否则尺子照旧命中)', () => {
  const noCareer = `{
  "feedback": {
    "submit": "提交"
  }
}
`
  const step = X.insertIntoJson(sample, 'career', [['exportingReport', '导出中...']])
  const fresh = X.insertIntoJson(noCareer, 'career', [
    ['exportingReport', '导出中...'],
    ['exportEmptyHint', '生成报告后可导出'],
  ])
  assert.ok(fresh)
  const p = JSON.parse(fresh)
  assert.equal(p.career.exportingReport, '导出中...')
  assert.equal(p.career.exportEmptyHint, '生成报告后可导出')
  assert.equal(p.exportingReport, undefined, '不得把键平铺到根层')
  assert.ok(fresh.includes('\n  "career": {\n'), '闭括号缩进须保住(最小 diff)')
  // 幂等第二遍:同一命名空间已存在 ⇒ 走块内追加分支,不产生第二个 career
  const again = X.insertIntoJson(fresh, 'career', [['doneTitle', '提交成功']])
  assert.equal((again.match(/"career":/g) || []).length, 1)
  assert.equal(JSON.parse(again).career.doneTitle, '提交成功')
  assert.equal(JSON.parse(step).career.existing, '已有')
})

ok('insertIntoJson:定位不到闭合括号 ⇒ 返回 null(调用方放弃该文件,不整篇重排)', () => {
  assert.equal(X.insertIntoJson('{ "a": 1', 'b', [['k', 'v']]), null)
  assert.equal(X.insertIntoJson('{"career": { "x": 1', 'career', [['k', 'v']]), null)
})

ok('形状锁:结论行三枚令牌必须齐备(守护派发体按 landing=/held=/ledger= 解析)', () => {
  const src = readFileSync(SRC, 'utf8')
  const lines = src.split('\n').filter((l) => l.includes('结论 landing='))
  assert.ok(lines.length >= 1)
  for (const tok of ['held=', 'ledger=', 'leg='])
    assert.ok(lines.some((l) => l.includes(tok)), `结论行缺 ${tok}`)
})

ok('形状锁:五语言与三档基准侧次序钉死(少一语 = 搬出半套词包)', () => {
  assert.deepEqual([...X.LANGS], ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'])
  assert.deepEqual([...X.BASELINE_PACKS], ['mobile-rn', 'shared', 'web'])
  assert.equal(X.TARGET_PACK, 'miniapp-taro')
  assert.ok(resolve(SRC).endsWith('sync-miniapp-message-keys.mjs'))
})

ok('键级射程:显式 --key 只搬点名的那一枚,块内其余键一个不碰', () => {
  const rn = () => ({ modelEdit: { readOnlyHint: '该字段暂不支持修改', headerTitle: '块内别的键' } })
  const mini = () => ({ modelEdit: { headerTitle: '本端已有' } })
  const { moves, unresolvable } = X.planMoves([{ ns: 'modelEdit', keys: ['readOnlyHint'] }], (p) =>
    p === 'mobile-rn' ? rn() : p === 'miniapp-taro' ? mini() : {},
  )
  assert.equal(unresolvable.length, 0)
  assert.equal(moves.length, 5) // 五语言各一枚
  assert.ok(moves.every((m) => m.key === 'readOnlyHint'), '不得顺带把整块搬进来')
})

ok('键级射程:点名的键两端都查无 ⇒ 逐语点名,不静默数成 0 枚当搬过(§0.3)', () => {
  const { moves, unresolvable } = X.planMoves([{ ns: 'modelEdit', keys: ['ghostKey'] }], (p) =>
    p === 'mobile-rn' ? { modelEdit: { other: 'x' } } : { modelEdit: {} },
  )
  assert.equal(moves.length, 0)
  assert.equal(unresolvable.length, 5)
  assert.ok(unresolvable.includes('modelEdit.ghostKey@ko'))
})

ok('parseKeyArgs:形状不对当场拒绝(ns.key 恰一个点),不静默忽略', () => {
  assert.deepEqual(X.parseKeyArgs(['--key', 'modelEdit.readOnlyHint']).items, [
    { ns: 'modelEdit', keys: ['readOnlyHint'] },
  ])
  assert.deepEqual(X.parseKeyArgs(['--key', 'a.b', '--key', 'a.c']).items, [
    { ns: 'a', keys: ['b', 'c'] },
  ])
  const bad = X.parseKeyArgs(['--key', 'nodot', '--key', 'trail.', '--key'])
  assert.deepEqual(bad.items, [])
  assert.deepEqual(bad.bad, ['nodot', 'trail.', 'undefined'])
})

ok('插入点只认顶层命名空间:同名嵌套块(devEnter.modelEdit)不得被写进去(2026-11-03 实测踩到)', () => {
  const nested = `{
  "devEnter": {
    "modelEdit": {
      "departmentLabel": "部门"
    }
  },
  "modelEdit": {
    "headerTitle": "模型编辑"
  }
}
`
  const out = X.insertIntoJson(nested, 'modelEdit', [['readOnlyHint', '该字段暂不支持修改']])
  assert.ok(out)
  const p = JSON.parse(out)
  assert.equal(p.modelEdit.readOnlyHint, '该字段暂不支持修改')
  assert.equal(p.devEnter.modelEdit.readOnlyHint, undefined, '嵌套同名块被写 = 值进了别人的命名空间')
  assert.equal(p.devEnter.modelEdit.departmentLabel, '部门')
  assert.equal(p.modelEdit.headerTitle, '模型编辑')
})

console.log(`\n✅ sync-miniapp-message-keys 镜像测试 ${n} 例通过`)
export const runSelfTest = () => 0
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
