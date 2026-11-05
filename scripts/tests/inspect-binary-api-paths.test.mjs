// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 二进制取证取词器的机器锁(2026-11-05 立)。
 *
 * 纯函数,离线可跑。钉住的三件事:
 *   ① 取词只认服务端路径形态,不把 `obj.get("key")` 这类噪音捞进来;
 *   ② 零命中必须连着**扫描面**一起出 —— 「没找到」不等于「不存在」(§0.3);
 *   ③ 空输入 ⇒ 空集,不抛、不编造。
 *
 * 为什么需要它:文档 WORKBUDDY_TASKS §11 的取证结论全靠这件器物复跑,
 * 器物本身进仓(§0.8 文档不得写跑不通的出路),所以它的判据也得有影子。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { countNeedles, extractPathStrings, parseArgs } from '../inspect-binary-api-paths.mjs'

test('① 只捞服务端路径形态,噪音不进集', () => {
  const sample =
    'pad/activity/growth/tasks/accept_pad /v2/billing/meter/daily-checkin obj.get("key") 乱码中文'
  const got = [...extractPathStrings(sample).keys()]
  assert.ok(got.includes('/activity/growth/tasks/accept_pad'), JSON.stringify(got))
  assert.ok(got.includes('/v2/billing/meter/daily-checkin'), JSON.stringify(got))
  assert.equal(
    got.some((s) => s.includes('key')),
    false,
  )
})

test('① 同一条路径重复出现 ⇒ 计数累加而不是塞多条', () => {
  const m = extractPathStrings('a/activity/growth/tasks/accept b/activity/growth/tasks/accept c')
  assert.equal(m.size, 1)
  assert.equal(m.get('/activity/growth/tasks/accept'), 2)
})

test('① 过短的串不当路径(避免把 /a/b 这类碎片当证据)', () => {
  assert.equal(extractPathStrings('/a/b').size, 0)
})

test('② 命中数逐个数,零命中仍回报该键并带扫描面', () => {
  const r = countNeedles('aaaba', ['a', 'b', 'zz'])
  const byName = Object.fromEntries(r.rows.map((x) => [x.needle, x.count]))
  assert.deepEqual(byName, { a: 4, b: 1, zz: 0 })
  // 扫描面必须一起出:否则"0 命中"会被读成"不存在"
  assert.match(r.face, /字节/)
  assert.equal(r.rows.length, 3)
})

test('② needle 清单里的空串跳过,不构造空匹配', () => {
  const r = countNeedles('abc', ['', undefined, null, 'b'])
  assert.deepEqual(
    r.rows.map((x) => x.needle),
    ['b'],
  )
})

test('③ 空原文 ⇒ 路径族空集 + needle 仍报 0(不抛不编造)', () => {
  assert.equal(extractPathStrings('').size, 0)
  assert.equal(extractPathStrings(undefined).size, 0)
  const r = countNeedles('', ['x'])
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].count, 0)
})

test('③ 空 needle 清单 ⇒ 零行,但扫描面照报', () => {
  const r = countNeedles('anything', [])
  assert.deepEqual(r.rows, [])
  assert.match(r.face, /字节/)
})

test('④ 命令行:两种 --needle 给法、--json、--min 下限保护', () => {
  assert.deepEqual(parseArgs(['x.bin', '--needle', 'a', '--needle', 'b']).needles, ['a', 'b'])
  assert.deepEqual(parseArgs(['x.bin', '--needle=a,b']).needles, ['a', 'b'])
  // 逗号合并的一串也算一次给全
  assert.deepEqual(parseArgs(['x.bin', '--needle', 'a,b,c']).needles, ['a', 'b', 'c'])
  assert.equal(parseArgs(['x.bin', '--json']).json, true)
  assert.deepEqual(parseArgs(['x.bin']).files, ['x.bin'])
  assert.equal(parseArgs(['x.bin', '--min', '0']).min, 6)
  assert.equal(parseArgs(['x.bin', '--min', 'abc']).min, 6)
  assert.equal(parseArgs(['--self-test']).selfTest, true)
  // --needle 是最后一个旗标且没跟值 ⇒ 不构造空 needle
  assert.deepEqual(parseArgs(['x.bin', '--needle']).needles, [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
