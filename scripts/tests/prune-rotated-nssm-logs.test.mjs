// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { planPrune } from '../prune-rotated-nssm-logs.mjs'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'prune-rotated-nssm-logs.mjs'), 'utf8')
const DAY = 86400000
const NOW = 1_800_000_000_000
const mk = (name, size = 10, ageMs = 5 * DAY) => ({ name, size, mtimeMs: NOW - ageMs, path: `D:\\DevEnv\\logs\\${name}` })
const rot = (svc, stream, ts) => `svc-${svc}-nssm-${stream}-${ts}.log`

// §22c:测试不得再抄一份判据(镜像常量漂移会让门"持续假绿"),所以这里只 import 源函数。
// ⚠ 判据的"有没有被重写"要用**正则字面量出现的位置与次数**量,不能在断言里把那个模式串
//   原样写出来再测试试自己 —— 第一版就是这么写的:断言字符串本身让测试源命中,
//   于是"测试重写了判据"这条永远为真、永远红(自指的假阳)。
test('M1 判据只住在源文件里(轮转名正则全仓恰好一处)', () => {
  assert.equal(typeof planPrune, 'function')
  const selfSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'prune-rotated-nssm-logs.test.mjs'), 'utf8')
  const occurrencesIn = (t) => (t.match(/\/\^svc-/g) || []).length
  assert.equal(occurrencesIn(SRC), 1, '源文件里那份轮转名正则必须恰有一处')
  assert.equal(occurrencesIn(selfSrc), 0, '测试面不得出现第二份该判据的字面量')
})

test('M2 正在写的那份(名字里没时间戳)永不进候选', () => {
  const live = 'svc-loki-nssm-err.log'
  const r = planPrune([mk(live), mk(rot('loki', 'err', '20260901T010000.328'))], { keep: 0, nowMs: NOW })
  assert.ok(!r.candidate.some((c) => c.name === live), '活文件被列进删除候选 = 下一次 apply 直接砍掉正在写的日志')
  assert.equal(r.notRotatedCount, 1)
})

test('M3 err 与 out 是两个独立额度,出故障时要查的那份不能被另一条流顶掉', () => {
  const inMany = []
  for (let i = 1; i <= 6; i++) inMany.push(mk(rot('api', 'out', `202609${String(i).padStart(2, '0')}T010000`)))
  inMany.push(mk(rot('api', 'err', '20260901T010000')))
  const r = planPrune(inMany, { keep: 2, nowMs: NOW })
  assert.ok(r.kept.some((k) => k.name.includes('-err-')), 'err 那份必须保留')
  assert.equal(r.groups, 2, '分组键必须含流类型(err/out 各一组)')
})

test('M4 年龄这一格与大批量阀门都必须是"少删"方向', () => {
  const fresh = mk(rot('a', 'err', '20260927T010000'), 10, 60000) // 刚轮转 1 分钟
  const old = mk(rot('a', 'err', '20260920T010000'), 10, 3 * DAY)
  const r = planPrune([fresh, old], { keep: 0, nowMs: NOW })
  assert.deepEqual(r.skipped.map((s) => s.name), [fresh.name], '刚轮转的必须落 skipped 而不是 candidate')
  assert.deepEqual(r.candidate.map((s) => s.name), [old.name])
  const many = []
  for (let i = 1; i <= 45; i++) many.push(mk(rot('bulk', 'err', `202601${String(i).padStart(2, '0')}T010000`)))
  assert.equal(planPrune(many, { keep: 1, nowMs: NOW }).massBlocked, true, '超阈值必须默认拦')
  assert.equal(planPrune(many, { keep: 1, nowMs: NOW, allowMass: true }).massBlocked, false)
})

test('M5 反向形状锁:默认档绝不派生删除动作,rmSync 只能在 --apply 分支里出现一次', () => {
  const uses = SRC.match(/rmSync\(/g) || []
  assert.equal(uses.length, 1, 'rmSync 出现次数不得多于 1(多处删除必然漂移)')
  const applyIdx = SRC.indexOf('if (!a.apply)')
  const rmIdx = SRC.indexOf('rmSync(')
  assert.ok(applyIdx > 0 && rmIdx > applyIdx, '删除动作必须排在 apply 判定之后')
  assert.ok(/--apply/.test(SRC) && /--keep/.test(SRC), 'CLI 契约里必须显式有 --apply 与 --keep')
})

test('M6 keep 非正整数在命令行被拒,在纯函数里可表达(边界校验只留一处)', () => {
  assert.equal(planPrune([mk(rot('a', 'err', '20260901T010000'))], { keep: 0, nowMs: NOW }).candidate.length, 1, 'keep=0 必须可表达,否则年龄分支无从证明')
  assert.equal(planPrune([mk(rot('a', 'err', '20260901T010000'))], { keep: -3, nowMs: NOW }).kept.length, 1, '非法值退回默认 10 而不是"留 0 份"')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
