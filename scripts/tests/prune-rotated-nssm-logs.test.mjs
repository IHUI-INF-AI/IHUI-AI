// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maskComments } from '../lib/code-mask.mjs'
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

// M7 —— 2026-09-27 实测的整族失明:nssm 在 stdout/stderr 合写一份文件时,轮转名里**没有流段**
// (`svc-api-nssm-20260913T180028.620.log`)。旧判据只认带 `-err-`/`-out-` 的那一种,于是真仓
// 164 份 / 1,004MB 不进射程,而工具照样打印"可回收候选 20 份 / 0.1 MB" 并 exit 0。
// 这条测试的用处不是"多覆盖一种形态",而是**让"少算"变成可判红的东西**。
test('M7 无流段的轮转形态必须在射程内,且其活文件同样永不进候选', () => {
  const rotNo = (svc, ts) => `svc-${svc}-nssm-${ts}.log`
  const many = []
  for (let i = 1; i <= 5; i++) many.push(mk(rotNo('api', `202609${String(i).padStart(2, '0')}T010000.620`)))
  const r = planPrune(many, { keep: 2, nowMs: NOW })
  assert.equal(r.groups, 1, '合写型要成一组')
  assert.equal(r.kept.length, 2, 'keep=2 时合写型也要按同一政策留 2 份')
  assert.equal(r.candidate.length, 3, '旧判据在这一族上整族失明(命中 0 份)')

  const live = 'svc-api-nssm.log' // 没有时间戳 = 正在写的那一份
  const r2 = planPrune([mk(live), mk(rotNo('api', '20260901T010000.620'))], { keep: 0, nowMs: NOW })
  assert.ok(!r2.candidate.some((c) => c.name === live), '放宽形态不得把无流段的活文件一起放进来')
  assert.equal(r2.notRotatedCount, 1)
})

test('M8 合写组不得顶掉同服务 err/out 组的保留名额(分组键的两个维度都要成立)', () => {
  const rotNo = (svc, ts) => `svc-${svc}-nssm-${ts}.log`
  const input = []
  for (let i = 1; i <= 6; i++) input.push(mk(rotNo('api', `202609${String(i).padStart(2, '0')}T010000.620`)))
  input.push(mk(rot('api', 'err', '20260901T010000')))
  const r = planPrune(input, { keep: 1, nowMs: NOW })
  assert.equal(r.groups, 2, 'api|log 与 api|err 必须是两组')
  assert.ok(r.kept.some((k) => k.name.includes('-err-')), '唯一的 err 份不得被合写型挤出保留集')
})

// ─────────── 落点反向锁(§15b):logs 根只许有一个出口,本模块不得再自己截盘符 ───────────
// 与 `sync-prometheus-live-config.test.mjs` T11 同一条锁;旧写法是
// `resolve(HERE,'..').slice(0,1).toUpperCase()` + `join(`${D}:\`, 'DevEnv', 'logs')` ——
// 用 slice(0,1) 从路径字符串上"猜"盘根,仓一旦被检出到 `<盘>/<子层>/<仓名>` 就直接错位。
// 判据对象是真实源文件的形态(§22c),遮噪只遮注释、保留字符串(被禁的那一型活在字符串里)。
test('M9 落点反向锁:不得再自取盘符,必须真的 import 共用出口 devEnvRoot()', () => {
  const code = maskComments(SRC)
  assert.doesNotMatch(code, /slice\(\s*0\s*,\s*1\s*\)/, '自取盘符首字符那一份实现不得回来(否则同一件事又有两个答案)')
  assert.doesNotMatch(code, /['"]\\{0,2}DevEnv['"]/, "DevEnv 字面量档位不得回来 —— 它住在 §15b 共用出口里")
  assert.doesNotMatch(code, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/, '不得再靠"往上数两级"推盘根(工作树落在夹具里时落点会跟着夹具走)')
  assert.doesNotMatch(code, /function\s+devEnvRoot\s*\(/, '本模块不得再声明私有 devEnvRoot —— 落点只许有一个出口')
  assert.match(
    code,
    /import\s*\{[^}]*\bdevEnvRoot\b[^}]*\}\s*from\s*'\.\/seal-c-root-stray\.mjs'/,
    '必须真的 import 共用出口(§22c 装车证明:函数在而没人调 = 提交链上一路绿灯)',
  )
  // 射程仍必须是 logs 目录本身(换出口不得顺手把删除面挪到别处)
  assert.match(code, /join\(\s*devEnvRoot\(\)\s*,\s*['"]logs['"]\s*\)/, 'LOGS_DIR 必须是 <外置根>/logs')
})

// M10 —— 2026-10-02 实测的"死旗标":main 里写的是
// `planPrune(entries, { keep: a.keep })`,allowMass 被正确解析(L130)却**从未传进去**,
// 于是 `--apply --allow-mass` 仍被大批量阀门拒绝;而 --self-test 里直接调
// `planPrune(many, { …, allowMass: true })`(M4)照绿 —— 「自检证明函数会给答案,
// 不证明有人问它」(守门 150 票㉛ 同型)。形状锁直接钉 main 的调用点,防它再漂回去。
test('M10 装车锁:CLI 解析出的 allowMass 必须真被喂进 planPrune', () => {
  const code = maskComments(SRC)
  assert.match(
    code,
    /planPrune\(\s*entries\s*,\s*\{[^}]*\ballowMass\s*:/,
    'main 的 planPrune 调用必须传 allowMass —— 否则 --allow-mass 是死旗标,--apply 永远被阀门拒',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
