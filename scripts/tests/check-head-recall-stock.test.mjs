// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门「HEAD 面回捞件差值棘轮」镜像(§22c:import 生产判据 __test__,零复制)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE_PATH = resolve(HERE, '..', 'check-head-recall-stock.mjs')
const GATE = readFileSync(GATE_PATH, 'utf8')
const { __test__ } = await import(import.meta.resolve('../check-head-recall-stock.mjs'))
const lib = await import(import.meta.resolve('../lib/head-recall.mjs'))

const R1 = '- [ ] G-901 已被摘除的回捞件'
const R2 = '- [ ] G-902 真活'
const declared = {
  filesSeen: 2,
  dropTitleFps: new Set(),
  dropTitleRows: new Map([['__fp__', [R1]]]),
  set: new Set([R1]),
}

test('G1 判据单源:门体不得自带第二把尺,命中面全靠 lib/head-recall', () => {
  assert.match(GATE, /from '\.\/lib\/head-recall\.mjs'/)
  assert.match(GATE, /from '\.\/scrub-declared-removals\.mjs'/, '台账维必须取 declaredRows 单源')
  for (const banned of ['function recallRowsOf', 'function titleFpOf', 'function parseTaskRows'])
    assert.ok(!GATE.includes(banned), `门体里出现 ${banned} ⇒ 判据复制(§22c)`)
})

test('G2 取材层单源:三面纪律走 face-reader,不散写 cat-file(守门 118)', () => {
  assert.match(GATE, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(GATE, /selectFace\(/, '两面旗同给 ⇒ exit 2 的判据在层里,不在门里')
  assert.match(GATE, /catBatch\(/)
  assert.ok(!/execFileSync\(\s*'git/.test(GATE), '裸起 git(§12g 派生纪律)')
})

test('G3 定档方向锁:增长才红、摘除永不红、同文副本要点名', () => {
  const grew = __test__.diffStock({
    faceText: `# 计划\n${R1}\n${R2}\n`,
    baseText: `# 计划\n${R2}\n`,
    declared,
  })
  assert.equal(grew.grew, true, '被审面带回一枚 ⇒ 必须判增长')
  assert.equal(grew.added.length, 1)
  const shrunk = __test__.diffStock({
    faceText: `# 计划\n${R2}\n`,
    baseText: `# 计划\n${R1}\n${R2}\n`,
    declared,
  })
  assert.equal(shrunk.grew, false, '摘除若也判红,清扫器自己被自己挡死(§12e 恒红门)')
  const twin = __test__.diffStock({
    faceText: `# 计划\n${R1}\n${R1}\n`,
    baseText: `# 计划\n${R1}\n`,
    declared,
  })
  assert.equal(twin.grew, true)
  assert.equal(
    twin.added.length,
    1,
    '同文第二份按多重集算差 ⇒ 判红必须点得出名(集合差会报"新增 0 枚")',
  )
})

test('G4 未判定档齐备:面空 / 台账空都不许记绿(§0.3)', () => {
  for (const args of [
    { faceText: null, baseText: `# 计划\n${R2}\n`, declared },
    { faceText: `# 计划\n${R2}\n`, baseText: null, declared },
    { faceText: `# 计划\n${R2}\n`, baseText: `# 计划\n${R2}\n`, declared: { filesSeen: 0 } },
    { faceText: '', baseText: `# 计划\n${R2}\n`, declared },
  ]) {
    const v = __test__.diffStock(args)
    assert.equal(v.undetermined, true, `应落未判定:${JSON.stringify(Object.keys(args))}`)
    assert.equal(v.faceCount, undefined, '未判定不得顺手造一个 0 冒充"判过了"')
  }
})

test('G5 红语必须自带三条出路 + 一条应急(§0.8 文档不得写跑不通的出路)', () => {
  for (const needle of [
    'strip-head-recall-rows.mjs --apply',
    'union-converge.mjs',
    'HUSKY_SKIP_HEAD_RECALL_STOCK',
  ])
    assert.ok(GATE.includes(needle), `红语缺出路 ${needle}`)
  assert.ok(/exit\(1\)/.test(GATE) && /exit\(2\)/.test(GATE), '三档退出码必须都在')
})

test('G6 与真面对话:判得出的枚数与清扫器同源(lib 同一把尺)', () => {
  // 同一份文本喂门与喂 lib,结论必须逐枚相同 —— 防止两边各算各的
  const face = `# 计划\n${R1}\n${R2}\n${R1}\n`
  const a = __test__.diffStock({ faceText: face, baseText: `# 计划\n`, declared })
  const b = lib.__test__.recallRowsOf(face, declared)
  assert.equal(a.faceCount, b.rows.length, '门报的枚数必须等于判据算出的候选数')
  assert.equal(a.faceHeld, b.held.length)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
