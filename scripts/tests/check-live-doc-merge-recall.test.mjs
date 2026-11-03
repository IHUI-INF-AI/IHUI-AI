// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「普通 git merge 把已结清登记行按旧形态带回」探测器的镜像测试(2026-10-28 立)。
// §22c:判据一律 import `../check-live-doc-merge-recall.mjs` 的 `__test__`,本文件不重写
// "什么算带回"的任何一条规则;演算基准(liveDocExpectedCounts)也要求从被审源里看见 import,
// 否则就是抄了第二份期望重数公式。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as S } from '../check-live-doc-merge-recall.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(path.join(HERE, '..', 'check-live-doc-merge-recall.mjs'), 'utf8')
const ROW = '- [ ] G-1 新增'

test('R1 正例:对侧相对基底新增、份数吻合 ⇒ 不报(探测器不是"见未勾行就红")', () => {
  const r = S.recalledRowsOf({
    oursText: '',
    theirsText: ROW,
    baseText: '',
    headText: ROW,
    nowText: ROW,
  })
  assert.equal(r.ok, true)
  assert.equal(r.rows.length, 0)
})

test('R2 反证:结果面份数超出期望 ⇒ 判出,且点名期望/实际份数', () => {
  const r = S.recalledRowsOf({
    oursText: '',
    theirsText: ROW,
    baseText: '',
    headText: `${ROW}\n${ROW}`,
    nowText: `${ROW}\n${ROW}`,
  })
  assert.equal(r.ok, true)
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].expected, 1)
  assert.equal(r.rows[0].inHead, 2)
})

test('R3 反证:本侧本来就有那一行(长期未勾票) ⇒ 不报 —— 它不是"被带回"', () => {
  const r = S.recalledRowsOf({
    oursText: ROW,
    theirsText: ROW,
    baseText: '',
    headText: `${ROW}\n${ROW}`,
    nowText: `${ROW}\n${ROW}`,
  })
  assert.equal(r.ok, true)
  assert.equal(r.rows.length, 0)
})

test('R4 反证:历史事故已修(当前 HEAD 面已无该行) ⇒ 不报历史,只报活问题', () => {
  const r = S.recalledRowsOf({
    oursText: '',
    theirsText: ROW,
    baseText: '',
    headText: `${ROW}\n${ROW}`,
    nowText: '',
  })
  assert.equal(r.ok, true)
  assert.equal(r.rows.length, 0)
})

test('R5 单源锁:期望重数只许 import union-converge 的那一份,本器不得自写公式', () => {
  assert.match(
    SRC,
    /import\s*\{\s*liveDocExpectedCounts\s*\}\s*from\s*'\.\/union-converge\.mjs'/,
    '必须 import union-converge 的 liveDocExpectedCounts(§0.6 单一真相源)',
  )
  // 反证方向:本器正文里不得出现第二份"本侧 + max(0, 对侧 - max(基底, 本侧))"式的自算
  const body = SRC.slice(SRC.indexOf('export function recalledRowsOf'))
  assert.ok(!/Math\.max\(0,\s*n\s*-/.test(body), '出现期望重数的自算 = 抄了第二份公式(必然漂移)')
})

test('R6 形态锁:探测器不进提交链(判历史合并事实 ⇒ §12e),且退出码三档齐备', () => {
  assert.ok(!/guardian-runner\.mjs/.test(SRC), '本器不得把自己登记进守门注册表')
  assert.ok(/return 2/.test(SRC), '取不到面必须有 exit 2 未判定档')
  assert.ok(/return hits\.length > 0 \? 1 : 0/.test(SRC), '判出嫌疑必须有自己的退出码档')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
