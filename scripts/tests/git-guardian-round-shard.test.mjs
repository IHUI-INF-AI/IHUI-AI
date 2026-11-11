// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * RP-75 ①② 的行为锁 + 结构锁(2026-11-11 立,票 RP-75)。
 *
 * 钉两件事:
 *   ① 自愈完成后必须**重取 status()** 再判巡检门 —— 旧形态用自愈前快照判
 *      `coreOk && before.refsOk`,refs 面不健康的轮次整段巡检被跳过(近三轮日志
 *      实证只写「自愈成功」+「自陈述版本」两行,4 枚 *-dispatch-last.json 恒缺);
 *   ② 单轮分片 + 断点续跑 —— 游标带 segmentsDone,段界预算到即让出余轮,
 *      下一轮跳过已完成段续跑;单片预算 ≤120s(env 只可下调,不可上调)。
 *
 * 结构断言全部带变异自证(§0.9:只断"字符串在不在"而不验"删掉它会红"的锁 = 没有锁)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  ROUND_SHARD_BUDGET_MS,
  ROUND_SEGMENT_ORDER,
  planRoundResume,
  shardBudgetExceeded,
} from '../git-guardian.mjs'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const GUARDIAN = REPO + 'scripts/git-guardian.mjs'
const src = readFileSync(GUARDIAN, 'utf8')

// —— ① 自愈后重取 status() 再判门 ——

/** 判据:main() 里 `remediate(before)` 之后、巡检门之前,必须出现 `roundView = status()` 重取。 */
function assertRefetchAfterHeal(source) {
  const healIdx = source.indexOf('remediate(before)')
  const refetchIdx = source.indexOf('roundView = status()')
  const gateIdx = source.indexOf('if (coreOk && roundView.refsOk)')
  assert.ok(healIdx >= 0, 'main() 找不到 remediate(before) ⇒ 自愈挂点被挪走,本锁失效')
  assert.ok(refetchIdx > healIdx, '自愈后必须重取 status()(RP-75 ① 单点改动)')
  assert.ok(gateIdx > refetchIdx, '巡检门必须按自愈后快照(roundView)判,不得按自愈前快照判')
  assert.equal(
    source.includes('if (coreOk && before.refsOk)'),
    false,
    '旧形态「按自愈前快照判巡检门」必须消失,否则整段巡检仍会被跳过',
  )
}

test('RP-75① · 自愈后重取 status() 再判巡检门(顺序锁)', () => {
  assertRefetchAfterHeal(src)
})

test('RP-75① · 变异自证:抹掉重取/换回旧门 ⇒ 上面的锁逐项转红', () => {
  const cases = [
    ['抹掉自愈后重取', src.replace('roundView = status()', '/* removed */')],
    ['门换回自愈前快照', src.replace('if (coreOk && roundView.refsOk)', 'if (coreOk && before.refsOk)')],
  ]
  for (const [label, mutated] of cases) {
    assert.notEqual(mutated, src, `${label}:变异没生效 ⇒ 本自证是摆设`)
    let red = false
    try { assertRefetchAfterHeal(mutated) } catch { red = true }
    assert.equal(red, true, `${label} 后顺序锁必须红`)
  }
})

// —— ② 单片预算与断点续跑判定(纯函数行为) ——

test('RP-75② · 单片预算默认 120s,票面纪律 ≤120s', () => {
  assert.equal(ROUND_SHARD_BUDGET_MS, 120_000)
  assert.ok(ROUND_SHARD_BUDGET_MS <= 120_000, '单片预算不得超过 120s(票面纪律)')
})

test('RP-75② · 预算 env 只可下调不可上调(子进程实测两档)', () => {
  const probe = (env) => {
    const out = execFileSync(
      process.execPath,
      ['-e', `import(${JSON.stringify('file:///' + GUARDIAN.replace(/\\/g, '/'))}).then((m) => console.log(m.ROUND_SHARD_BUDGET_MS))`],
      { encoding: 'utf8', timeout: 120_000, env: { ...process.env, IHUI_GUARDIAN_SHARD_BUDGET_MS: env } },
    )
    return Number(String(out).trim())
  }
  assert.equal(probe('300000'), 120_000, 'env 上调必须被钳回 120s')
  assert.equal(probe('30000'), 30_000, 'env 下调必须生效')
})

test('RP-75② · 预算判定:到点即真,未到即假', () => {
  const start = Date.parse('2026-11-11T00:00:00Z')
  assert.equal(shardBudgetExceeded(start + 119_999, start), false)
  assert.equal(shardBudgetExceeded(start + 120_000, start), true, '预算边界取「≥」:跨过即让出')
  assert.equal(shardBudgetExceeded(start + 60_000, start, 60_000), true)
})

test('RP-75② · 断点判定:只有"另一轮停在段中间"才续跑,其余一律从零', () => {
  const CUR = 5_000_000
  assert.deepEqual(planRoundResume(null, CUR), [], '无游标 ⇒ 从零开')
  assert.deepEqual(planRoundResume({ stage: 'main:round-done', startedAtMs: 1, segmentsDone: ['main:post-heal'] }, CUR), [], '上一轮已跑完 ⇒ 从零开,绝不带着旧 segmentsDone 跳过本轮腿')
  assert.deepEqual(planRoundResume({ stage: 'main:post-sweeps', startedAtMs: CUR, segmentsDone: ['main:post-heal'] }, CUR), [], '同轮游标(自己写的)⇒ 不算断点')
  assert.deepEqual(
    planRoundResume({ stage: 'main:post-heals', startedAtMs: 1, segmentsDone: ['main:post-heal', 'main:post-sweeps', 'main:post-heals'] }, CUR),
    ['main:post-heal', 'main:post-sweeps', 'main:post-heals'],
    '另一轮停在段中间 ⇒ 其已完成段全部续用',
  )
  assert.deepEqual(
    planRoundResume({ stage: 'main:post-sweeps', startedAtMs: 1, segmentsDone: ['main:post-heal', 'bogus:stage'] }, CUR),
    ['main:post-heal'],
    '不在段序里的野值必须滤掉(游标是诊断件,坏形态失效方向=从零重跑)',
  )
  assert.deepEqual(planRoundResume({ stage: 'main:post-sweeps', startedAtMs: 1 }, CUR), [], 'segmentsDone 缺失/非数组 ⇒ 从零开')
})

// —— ② 分片接线的结构锁(带变异自证) ——

function assertShardWiring(source) {
  assert.ok(
    source.includes('segmentsDone: [...roundSegmentsDone]'),
    '游标必须同枚带 segmentsDone(每片落 cursor,不另造第二份诊断件)',
  )
  assert.ok(
    source.includes('if (ROUND_SEGMENT_ORDER.includes(stage)) roundSegmentsDone.add(stage)'),
    'markRoundStage 必须把段界记入已完成集(段界即分片完成标记)',
  )
  assert.ok(source.includes('if (!CHECK_ONLY) initRoundShardResume()'), '真实轮起点必须读游标定断点')
  for (const b of ROUND_SEGMENT_ORDER) {
    assert.ok(source.includes(`markRoundStage('${b}')`), `段界 ${b} 必须仍是 markRoundStage 落点`)
    if (b !== 'main:round-done') {
      assert.ok(source.includes(`roundShardYield('${b}')`), `段界 ${b} 之后必须有预算让出点`)
    }
  }
  assert.ok(source.includes("roundSegmentsDone.has('main:post-heal')"), '非节流腿段(post-heal)必须有段级跳过守卫')
  assert.ok(source.includes("roundSegmentsDone.has('main:post-heals')"), '非节流腿段(post-heals)必须有段级跳过守卫')
}

test('RP-75② · 分片接线齐全:游标带 segmentsDone、段界有让出点、非节流段有跳过守卫', () => {
  assertShardWiring(src)
})

test('RP-75② · 变异自证:抹掉游标字段/段界登记/让出点 ⇒ 接线锁转红', () => {
  const cases = [
    ['游标不再带 segmentsDone', src.replace('segmentsDone: [...roundSegmentsDone]', '/* removed */')],
    ['段界不再登记完成', src.replace('if (ROUND_SEGMENT_ORDER.includes(stage)) roundSegmentsDone.add(stage)', '/* removed */')],
    ['轮起点不再读断点', src.replace('if (!CHECK_ONLY) initRoundShardResume()', '/* removed */')],
    ['post-heal 让出点被抹', src.replace("roundShardYield('main:post-heal')", '/* removed */')],
    ['post-heal 跳过守卫被抹', src.replace("roundSegmentsDone.has('main:post-heal')", '/* removed */')],
  ]
  for (const [label, mutated] of cases) {
    assert.notEqual(mutated, src, `${label}:变异没生效 ⇒ 本自证是摆设`)
    let red = false
    try { assertShardWiring(mutated) } catch { red = true }
    assert.equal(red, true, `${label} 后接线锁必须红`)
  }
})

test('RP-75② · 段序与 A11 检查点同源:ORDER 里每一枚都是既有 markRoundStage 落点,不新增锚点', () => {
  // 判据单源纪律:分片只骑在既有段界上(A9 已判齐平,不另造覆盖清单)。
  for (const b of ROUND_SEGMENT_ORDER) {
    assert.match(b, /^main:/, `段界必须复用 main: 前缀的既有检查点: ${b}`)
  }
  assert.ok(!ROUND_SEGMENT_ORDER.includes('main:block-enter'), 'block-enter 是入块标记,不是完成段')
})
