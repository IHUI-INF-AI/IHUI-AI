// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 源脚本 `__test__`,不复制判据。
// 本文件钉四件"只有源码级锁能防"的事:
//   ① 采集器 ↔ 读桶器必须用**同一种容器语义**(Map 迭代器)。实测踩过:bump 写成 `map[key]`
//      时数据挂在 Map 实例的属性上,bucketize 按迭代器遍历 ⇒ 文件数正常而所有桶恒 0,
//      整把尺子把"没读到"报成"两端已对齐"。当时源脚本 --self-test 也全绿,因为夹具绕开了 bump。
//   ② 三桶之和必须等于取值种数(静默丢桶 ⇒ 假绿)。
//   ③ 新腿必须真在驾驶舱登记表里(§0.9:造好没装车 = 没有)。
//   ④ 量纲:Tailwind 半档折 px 与任意值形态不得漏(漏了 web 读数系统性算小 ⇒ missingTier 冒充 fork)。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as src } from '../check-web-rn-style-tiers.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { bump, bucketize, mergeUniverse, tally, collectWeb, collectRn, rankRows, rowValues } = src

const RN_TEXT = `
  const s = StyleSheet.create({
    row: { gap: 10, padding: 12, marginTop: 8 },
    title: { fontSize: 13, lineHeight: 18, borderRadius: 6 },
    tight: { gap: 6, paddingHorizontal: 14 },
  })`
const WEB_TEXT = `
  export const Card = () => (
    <div className="gap-2.5 px-1.5 p-[10px] text-[13px] rounded-md">x</div>
  )`
const fakeRead = (map) => (p) => map[p] ?? null

test('① 采集器写入的值,读桶器必须枚举得到(钉 Map 属性 vs 迭代器那一型)', () => {
  const acc = new Map()
  bump(acc, 'gap', 10)
  bump(acc, 'gap', 10)
  bump(acc, 'padding', 12)
  assert.equal(acc.size, 2, 'bump 必须写进 Map 本体,不是实例属性')
  assert.equal(mergeUniverse({ spacing: acc, fontSize: new Map(), radius: new Map() }).spacing.size, 2)
  assert.equal([...acc.get('gap')][0][1], 2, '同值累加按处数计,不是覆盖')
})

test('② 生产采集器从两端真文本量出非零,且三桶守恒', () => {
  const rn = collectRn(['rn.tsx'], fakeRead({ 'rn.tsx': RN_TEXT }))
  const web = collectWeb(['web.tsx'], fakeRead({ 'web.tsx': WEB_TEXT }))
  const rnU = mergeUniverse(rn.acc)
  const webU = mergeUniverse(web.acc)
  assert.ok(rnU.spacing.has(10) && rnU.spacing.has(6) && rnU.spacing.has(14), 'RN 侧间距必须量出 10/6/14')
  assert.ok(rnU.fontSize.has(13), 'RN 侧 fontSize:13 必须量到')
  assert.ok(webU.spacing.has(10) && webU.spacing.has(6), 'web 半档 2.5→10 / 1.5→6 必须折成 px')
  assert.ok(webU.fontSize.has(13), 'web 任意值 text-[13px] 必须入账')

  const tier = { spacingSet: new Set([4, 8, 12]), typeSet: new Set([10, 11, 12, 14]), radiusSet: new Set([2, 4, 6, 8, 12, 16]) }
  const rows = bucketize(rn.acc, tier, webU, 'spacing')
  const t = tally(rows)
  assert.equal(t.inTier + t.missingTier + t.fork, rows.length, '三桶之和必须==取值种数')
  assert.ok(rows.length > 0, '真实文本枚举到 0 ⇒ 判死,不得记绿')
  // 12 在表内;10 两端都在用 ⇒ 档表缺位;14/6 web 侧这夹具没给 ⇒ 真分叉
  const by = Object.fromEntries(rows.map((r) => [`${r.prop}=${r.val}`, r.state]))
  assert.equal(by['padding=12'], 'inTier')
  assert.equal(by['gap=10'], 'missingTier')
  assert.equal(by['paddingHorizontal=14'], 'fork')
})

test('③ 新腿真在驾驶舱登记表里(未装车=没有)', () => {
  const reg = readFileSync(resolve(ROOT, 'scripts/parity-auto.mjs'), 'utf8')
  assert.equal(
    (reg.match(/script: 'check-web-rn-style-tiers\.mjs'/g) || []).length,
    1,
    '登记表里这条腿必须恰好出现一次',
  )
  assert.match(reg, /id: 'gate-style-tiers'/, '腿的 id 必须成对登记')
  // 刻意不标 slow:标了就被 `--fast` 跳过,等于把这一整格盲区留给下一轮
  const block = reg.slice(reg.indexOf("id: 'gate-style-tiers'"), reg.indexOf("id: 'gate-drift'"))
  assert.ok(!/slow:\s*true/.test(block), '本腿不得标 slow(否则 --fast 档重开盲区)')
})

test('④ 取材面纪律:面旗走统一层,且本门不得自派 git 取 blob 正文(守门 118 那一型)', () => {
  const body = readFileSync(resolve(ROOT, 'scripts/check-web-rn-style-tiers.mjs'), 'utf8')
  assert.match(body, /from '\.\/lib\/face-reader\.mjs'/, '必须经统一取材层')
  assert.match(body, /selectFace\(/, '面旗解析不得自己拼(两面旗互斥由 face-reader 判)')
  assert.match(body, /catBatch\(/, '正文必须批量取,清单与内容同面同轮')
  // 反向锁:本门脚本体里一旦出现 execFileSync('git', ['show' / 'cat-file' …,就是又长出第二份取材实现
  assert.ok(
    !/execFileSync\(\s*'git'/.test(body),
    '不得自己派生 git 取正文(§0.4 单一真相源;守门 118 会当场判红)',
  )
  assert.match(body, /取值集枚举到 0/, '空取值集必须落未判定,不记绿也不冒红')
})

// ⑤ 缺陷回归(2026-11-02 Phase 3):JSON 取值出口 `Number("10px")` ⇒ NaN ⇒ `[null]`。
//   取值必须从结构化字段 r.val 取,不得从 rankRows 的展示串反解。
test('⑤ JSON 取值出口是有限数字:不得从 `gap=10px×n` 展示串反解', () => {
  const rows = [
    { prop: 'gap', val: 10, n: 3, state: 'missingTier' },
    { prop: 'padding', val: 14, n: 1, state: 'missingTier' },
    { prop: 'gap', val: 10, n: 2, state: 'missingTier' },
    { prop: 'fontSize', val: 13, n: 5, state: 'inTier' },
    { prop: 'gap', val: 22, n: 4, state: 'fork' },
  ]
  assert.deepEqual(rowValues(rows, 'missingTier'), [10, 14], '去重 + 数字 + 升序')
  assert.deepEqual(rowValues(rows, 'fork'), [22])
  assert.ok(rowValues(rows, 'missingTier').every((v) => Number.isFinite(v)), '取值出口必须全是有限数字')

  // 缺陷形态自证:展示串带 `px`,任何走 Number(split) 的实现都必然 NaN
  const display = rankRows(rows, 'missingTier', 999)[0]
  assert.equal(Number(display.split('=')[1].split('×')[0]), NaN, '展示串反解必然 NaN —— 这就是旧缺陷')
  // JSON 落盘后不得出现 null(JSON.stringify(NaN) === 'null')
  assert.equal(JSON.stringify({ v: rowValues(rows, 'missingTier') }), '{"v":[10,14]}', '序列化后不得出现 null')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
