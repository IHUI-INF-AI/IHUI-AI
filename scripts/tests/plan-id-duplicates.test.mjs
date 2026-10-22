// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/lib/plan-id-duplicates.mjs 的判据(票 G-927,2026-10-21)。
// 一律 import 源脚本本体(§22c),测试里不复制第二份"什么算登记行/什么算同号多行"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { judgeRowIdDuplicates } from '../lib/plan-id-duplicates.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * 1024 * 1024,
  })
}

test('T1 正向(该拦):同一编号被两条登记行声明 ⇒ rowDups 计入', () => {
  const text = ['- [ ] O7 甲这件事', '', '- [ ] O7 乙又登了一遍'].join('\n')
  const r = judgeRowIdDuplicates({ ledgerText: text })
  assert.equal(r.ok, true)
  assert.deepEqual(r.rowDups, [['O7', 2]])
  assert.equal(r.rowDecls, 2)
})

test('T2 反证(不该拦):逐字重复的小节标题不参与判红', () => {
  // 这一型就是 HEAD 面上那 7 组(历史叙述区的块级重复)—— 旧口径把 --check 恒钉成 exit 1
  const text = ['## O1 同一句标题写了两遍', '', '## O1 同一句标题写了两遍', '', '- [ ] O88 真活一条'].join(
    '\n',
  )
  const r = judgeRowIdDuplicates({ ledgerText: text })
  assert.equal(r.ok, true)
  assert.deepEqual(r.rowDups, [])
  assert.equal(r.rowDecls, 1)
})

test('T3 未判定:输入取不到时 ok=false 且给原因,绝不冒充"无重号"', () => {
  for (const bad of ['', '   \n  ', undefined, null, 42]) {
    const r = judgeRowIdDuplicates({ ledgerText: bad })
    assert.equal(r.ok, false, `输入 ${JSON.stringify(bad)} 必须判未判定`)
    assert.ok(String(r.reason ?? '').length > 0, '未判定必须给原因')
    assert.deepEqual(r.rowDups, [])
  }
})

test('T4 族隔离:family=O 时别族同号多行不记进 O 族', () => {
  const text = ['- [ ] G-1 甲', '- [ ] G-1 乙', '- [x] ✅(2026-10-21) O9 丙'].join('\n')
  const r = judgeRowIdDuplicates({ ledgerText: text, family: 'O' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.rowDups, [])
  assert.equal(r.rowDecls, 1)
})

test('T5 同号多行不论勾选态:一条未勾 + 一条已勾同样算重号(§1 只留一行当前状态)', () => {
  const text = ['- [ ] O9 待办', '- [x] ✅(2026-10-21) O9 已完成'].join('\n')
  const r = judgeRowIdDuplicates({ ledgerText: text })
  assert.deepEqual(r.rowDups, [['O9', 2]])
})

test('T6 真仓面自证(取材非空):HEAD 台账的 O 族登记行判得出声明数且零同号多行', () => {
  const text = git(['show', 'HEAD:PROJECT_PLAN.md'])
  const r = judgeRowIdDuplicates({ ledgerText: text })
  assert.equal(r.ok, true)
  assert.ok(r.rowDecls > 0, '取材为 0 条 ⇒ 本例只是空转,必须喊出来(§0.3 枚举到 0 判死)')
  assert.deepEqual(r.rowDups, [], `现读不该有登记行重号,实得 ${JSON.stringify(r.rowDups)}`)
})

test('T7 G-955:括注内被引号不算声明(一行指针不得顶死取号口),真声明同号仍判红', () => {
  // 逐字取自 HEAD 面的病形:`（待派/QODER-O81）` 是跨命名空间的指针(M24 头注原话"别的族的号"),
  // 本行没有自己的 O 族声明;旧判红维吃 keyOfRow 的占用维回退读数,把它与真 O81 并成"同号多行"。
  const text = [
    '- [ ]O81 跨端 UI 单一源:小程序端与 App(RN)端逐档同值 —— 真声明。',
    '- [ ] （待派/QODER-O81） **顺带登记一条归属纪律**:那枚造成 500 的在飞引用属他人持有面 —— 指针不是声明。',
  ].join('\n')
  const r = judgeRowIdDuplicates({ ledgerText: text })
  assert.equal(r.ok, true)
  assert.deepEqual(r.rowDups, [], `括注内被引号不得参与判红,实得 ${JSON.stringify(r.rowDups)}`)
  assert.equal(r.rowDecls, 1, `声明位计数只应认真声明,实得 ${r.rowDecls}`)
  // 反向的牙(不得把病洗成绿):两条真声明同号必须仍然红 —— 收窄只挡"号在未被吃掉的行首括注里"这一档。
  const both = ['- [ ]O81 甲这件事', '- [ ] O81 乙又登了一遍'].join('\n')
  assert.deepEqual(judgeRowIdDuplicates({ ledgerText: both }).rowDups, [['O81', 2]])
  // 括注后有锚定编号的 M24 形态一字不受影响(括注被 bodyOfRow 吃掉,声明位就是括注后那个号)。
  const anchored = [
    '- [ ]O81 持有行',
    '- [ ]（待派/QODER-O81）O81 **带真声明的装饰行** —— 题面。',
  ].join('\n')
  assert.deepEqual(judgeRowIdDuplicates({ ledgerText: anchored }).rowDups, [['O81', 2]])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
