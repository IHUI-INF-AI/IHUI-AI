// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 违禁桶兜底清扫器镜像(§22c:import 生产判据 __test__,零复制)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_PATH = resolve(HERE, '..', 'strip-banned-buckets.mjs')
const SRC = readFileSync(SRC_PATH, 'utf8')
const { __test__ } = await import(import.meta.resolve('../strip-banned-buckets.mjs'))

test('M1 判据单源:findBannedRows 走 plan-task-index 的 parseTaskRows+dispositionOfV2(零复制)', async () => {
  const idx = await import(import.meta.resolve('../lib/plan-task-index.mjs'))
  // 注入生产判据后构造面判定正确
  __test__.judgesRef.parseTaskRows = idx.parseTaskRows
  __test__.judgesRef.dispositionOfV2 = idx.dispositionOfV2
  const face = '# 计划\n- [ ] **G-900 等条件**:等环境。\n- [ ] **G-901 真活**:能做。\n'
  const r = __test__.findBannedRows(face, null)
  assert.equal(r.undetermined, false)
  assert.equal(r.rows.length, 1)
  assert.match(r.rows[0].raw, /G-900/)
})

test('M2 射程:已勾行不进名单(结清注记合法),禁令只禁未勾挂账', () => {
  const face =
    '# 计划\n- [x] ✅(2026-10-25) **G-902 已结清**(等条件词属结清注记)。\n- [ ] **G-901 待拍板**:需用户拍板。\n'
  const r = __test__.findBannedRows(face, null)
  assert.equal(r.rows.length, 1)
  assert.doesNotMatch(r.rows[0].raw, /^-\s\[x\]/)
})

test('M3 未判定不冒绿:判据未装载/空文本 ⇒ undetermined(§0.3)', () => {
  const saved = { ...__test__.judgesRef }
  __test__.judgesRef.parseTaskRows = undefined
  const r1 = __test__.findBannedRows('# 计划\n- [ ] x\n', null)
  assert.equal(r1.undetermined, true)
  __test__.judgesRef.parseTaskRows = saved.parseTaskRows
  const r2 = __test__.findBannedRows('', null)
  assert.equal(r2.undetermined, true)
})

test('M4 留痕形状:seat/kind 常量与 scrub 消费端对齐(f12-purge 族)', () => {
  assert.equal(__test__.SEAT, 'f12-banned-bucket-sweep')
  assert.equal(__test__.PLAN_REL, 'PROJECT_PLAN.md')
  assert.match(__test__.DROP_REL, /plan-row-drop\.jsonl$/)
  // scrub-declared-removals 的 f12-purge 射程认 kind=f12-purge(或 seat=f12-purge-20261025);
  // 本器留痕 kind 固定 f12-purge ⇒ 被兜底消费。摘 seat 不得另造第四种 kind。
  const scrub = readFileSync(resolve(HERE, '..', 'scrub-declared-removals.mjs'), 'utf8')
  assert.match(scrub, /f12-purge/)
})

test('M5 形状锁:落地必须先于留痕(sweep 源码里 appendFileSync 在 land 之后)', () => {
  const landAt = SRC.indexOf('landViaObjectSpace(kept.join')
  const appendAt = SRC.indexOf('appendFileSync(dropAbs')
  assert.ok(landAt > 0 && appendAt > landAt, '留痕必须排在落地之后(§1:先写后落=把面上还在说成已删)')
  // 被拒分支不得写留痕
  const refused = SRC.slice(SRC.indexOf("if (!land.ok)"), SRC.indexOf("const dropAbs"))
  assert.doesNotMatch(refused, /appendFileSync/, '落地被拒分支零留痕')
})

test('M6 落地通道:必须走 object-space-land(不手写第六份内置 CAS 装置)', () => {
  assert.match(SRC, /object-space-land\.mjs/)
  // 剥注释再查代码面(R5 同一条纪律:注释里的提法不构成实现)
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /commit-tree/, '本器不得自带 commit-tree 装置(AGENTS 记过 6 份漂移)')
})

test('M7 isDirectRun 双形态(§22d)与结论行三态', () => {
  assert.match(SRC, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  for (const st of ['state=clean', 'state=stripped', 'state=undetermined']) {
    assert.ok(SRC.includes(st), `三态结论行缺 ${st}`)
  }
})

// 接线锁(2026-10-27 立):本器的派发层被一笔 `chore: 收尾提交本地未提交改动` 收编提交整层删掉
// (821ce8e621,函数体+调用点+导出三处同灭),而 AGENTS §1 与 README 通篇仍声称"guardian 巡检轮
// sweepBannedBuckets 每 5 分钟派发"⇒ 违禁桶行没人摘、HEAD 面 F12 挂红挡死 git-sync-converge 推送,
// 零一道门喊过。判据必须自己发现"没装车"(§0.9),所以这一锁只查生产端源码,剥掉注释后再查一遍。
test('M8 接线锁:guardian 派发层三处齐备(函数体/调用点/导出),注释不得顶实现', () => {
  const guardianPath = resolve(HERE, '..', 'git-guardian.mjs')
  const guardian = readFileSync(guardianPath, 'utf8')
  const code = guardian.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.match(code, /export function sweepBannedBuckets\(/, '派发函数体不得缺席')
  assert.match(code, /if \(!CHECK_ONLY\) sweepBannedBuckets\(\)/, '巡检轮调用点不得缺席')
  assert.match(code, /^\s*sweepBannedBuckets,$/m, '__test__ 导出条目不得缺席(镜像测试与外部问责靠它反查)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
