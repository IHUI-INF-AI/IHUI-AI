// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as scrub } from '../scrub-doc-numbers.mjs'
import { findStaleClaims, CLAIMS } from '../check-doc-numbers.mjs'

/**
 * 清偿器镜像(§22c:判据零复算 —— 桶裁决与写回全部 import 源脚本的 `__test__`,
 * 违规点与措辞表 import 门 173 本门,本文件不写第二份"找数字"的正则)。
 *
 * 这台器物 2026-10 就已入库,但全仓零调用方、无镜像、未接派发 ⇒ 属 §0.9「造好没装车」。
 * 本镜像钉住它的牙口,并把"门 173 红了该怎么办"从口头传说变成可回读的形状锁(T5)。
 */

const ROOT = resolve(import.meta.dirname, '../..')

/** 夹具只给本文件用到的键(门对缺值的键直接跳过,不冒绿也不冒红) */
const numbers = {
  guardianGates: 110,
  dbTables: 617,
  apiRoutes: 4655,
  testFiles: 3766,
  ciWorkflows: 51,
  llmModels: 100,
  wsEndpoints: 25,
}

test('T1 端到端有牙:写回后门 173 的散文判据必须归零', () => {
  const stale = [
    '现在总共 109 道守门脚本在跑',
    '当年约 109 道守门对全队同时失效',
    '612 张表 · 4616 API 路由 · 3607 测试文件 · 50 CI workflows',
  ].join('\n')
  const plan = scrub.planDoc('README.md', `${stale}\n`, numbers)
  assert.ok(plan.buckets.replace.length > 0, '构造面未按派生声明重钉 ⇒ 器物没牙')
  assert.ok(plan.buckets.exempt.length > 0, '叙述行没落 exempt ⇒ 历史被当成当前总量声明')
  assert.deepEqual(plan.buckets.manual, [], '构造面不该有框图行落入人工')

  const after = scrub.applyPlan(`${stale}\n`, plan.edits)
  const remain = findStaleClaims(after, numbers)
  assert.deepEqual(
    remain.violations,
    [],
    `写回后门 173 仍点名 ${remain.violations.length} 处:${JSON.stringify(remain.violations)}`,
  )
})

test('T2 反向锁:exempt 归因于叙述判据,不是碰巧没命中', () => {
  const narrative = '当年约 109 道守门对全队同时失效\n'
  const plain = '现在总共 109 道守门脚本在跑\n'
  const feats = scrub.detectNarrative(narrative.replace(/\n$/, ''), narrative.split('\n'), 0)
  assert.ok(feats && feats.length > 0, `回顾词行没量到特征 ⇒ 判据失效:${JSON.stringify(feats)}`)
  const pPlain = scrub.planDoc('README.md', plain, numbers)
  assert.ok(
    pPlain.buckets.replace.length > 0 && pPlain.buckets.exempt.length === 0,
    '同形无回顾词的行必须落 replace(否则 exempt 桶在乱吃)',
  )
})

test('T3 行前像失配 ⇒ 抛错拒写(不覆盖别席改动)', () => {
  const base = '现在总共 109 道守门脚本在跑\n'
  const plan = scrub.planDoc('README.md', base, numbers)
  assert.ok(plan.edits.length > 0, '夹具没造出待改写行')
  const peerHeld = '现在总共 109 道守门脚本在跑 —— 别席已就地改写\n'
  assert.throws(
    () => scrub.applyPlan(peerHeld, plan.edits),
    /规划|底稿|不一致/,
    '行前像失配却写出了内容 ⇒ 守恒断言失守',
  )
})

test('T4 退出码三态不并桶:未判定 > 剩余 replace > 其余', () => {
  assert.equal(
    scrub.decideExitCode({ undetermined: true, applied: true, postApplyRemainingReplace: 0 }),
    2,
  )
  assert.equal(
    scrub.decideExitCode({ undetermined: false, applied: true, postApplyRemainingReplace: 3 }),
    1,
  )
  assert.equal(
    scrub.decideExitCode({ undetermined: false, applied: true, postApplyRemainingReplace: 0 }),
    0,
  )
  assert.equal(
    scrub.decideExitCode({ undetermined: false, applied: false, postApplyRemainingReplace: 9 }),
    0,
    'dry-run 不得替门代判红',
  )
})

test('T5 装车锁:门 173 的修复指引必须点名这台器物', () => {
  const ref = readFileSync(resolve(ROOT, 'docs/guardian-reference.md'), 'utf8')
  // 文件里 "| 173 |" 出现在两张表(门名点名索引 + 修复指引表),指引行的第 2 格以反引号起头。
  // 只挑指引行来判:拿索引表那行的读数当指引 = 一把会假过的尺。
  const rows = ref.split('\n').filter((l) => l.startsWith('| 173 |'))
  assert.ok(rows.length > 0, 'guardian-reference 里找不到任何 173 行')
  const guidance = rows.filter((l) => (l.split('|')[2] || '').trim().startsWith('`'))
  assert.ok(guidance.length >= 1, `修复指引表里没有 173 行(现读 ${rows.length} 行均非指引形态)`)
  for (const r of guidance) {
    assert.match(r, /scrub-doc-numbers/, `173 的修复指引没点名清偿器:${r.slice(0, 90)}`)
  }
  assert.ok(!rows.some((l) => l.includes('—（待补充）')), '173 的修复指引回潮成"待补充"')
  const gate = readFileSync(resolve(ROOT, 'scripts/check-doc-numbers.mjs'), 'utf8')
  assert.ok(CLAIMS.length > 0, 'CLAIMS 措辞表为空 ⇒ 门与器物同时失明')
  assert.match(gate, /export function findStaleClaims/, '器物依赖的门内出口被摘 ⇒ 本镜像应随之失效')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
