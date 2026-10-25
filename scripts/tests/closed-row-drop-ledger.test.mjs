// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「完成即删」回潮防线的接线锁(2026-10-23 立)。
 *
 * 锁的是两件此前**造了一半**的东西,实测缺它们就必然"摘一次、回一次、存量永远归不了零":
 *   ① `strip-stale-closed-rows` 摘完必须往摘除台账留痕(此前摘完一行不留 ⇒ 回潮防线全瞎);
 *   ② `union-converge` 的活文档行 union 必须认这本台账(此前只认"对侧相对基底新增" ⇒ 原样补回)。
 * 任一处被别席的合并删掉 ⇒ 这里当场红,不许靠口头说"我记得装了"。
 *
 * 判据一律 import 自生产脚本的 `__test__`(§22c),本文件不重写任何判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as sweeper } from '../strip-stale-closed-rows.mjs'
import { __test__ as U } from '../union-converge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const SWEEPER_SRC = readFileSync(here('../strip-stale-closed-rows.mjs'), 'utf8')
const UNION_SRC = readFileSync(here('../union-converge.mjs'), 'utf8')

const ROW_A = '- [x] ✅(2026-10-23) G-1 甲任务已结清(留痕夹具)'
const ROW_B = '- [x] ✅(2026-10-23) G-2 乙任务已结清(留痕夹具)'
const OPEN_ROW = '- [ ] G-3 丙任务还没做(留痕夹具)'

test('①留痕:摘除行逐字进台账,且带 kind/commit 可被下游按集合语义消费', () => {
  const dir = mkScratch('drop-ledger-')
  try {
    const r = sweeper.appendDropLedger([ROW_A, ROW_B], { commit: 'a'.repeat(40), baseline: 'b'.repeat(40) }, dir)
    assert.equal(r.ok, true, `留痕必须写得进去:${r.why ?? ''}`)
    assert.equal(r.written, 2)
    const abs = path.join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl')
    assert.ok(existsSync(abs), `台账必须落在 ${abs}`)
    const lines = readFileSync(abs, 'utf8').split('\n').filter((l) => l.trim() !== '')
    assert.equal(lines.length, 2)
    const objs = lines.map((l) => JSON.parse(l))
    for (const o of objs) {
      assert.equal(o.kind, 'stale-closed-sweep')
      assert.equal(o.file, 'PROJECT_PLAN.md')
      assert.equal(o.commit, 'a'.repeat(40))
    }
    assert.deepEqual(
      objs.map((o) => o.rowBefore).sort(),
      [ROW_A, ROW_B].sort(),
      'rowBefore 必须逐字——下游靠逐字比对认行,差一个字符这条防线就瞎',
    )
  } finally {
    rmScratch(dir)
  }
})

test('①b 留痕:空集不落盘、也绝不写空条目(台账里不许出现没有 rowBefore 的行)', () => {
  const dir = mkScratch('drop-ledger-empty-')
  try {
    const r = sweeper.appendDropLedger([], {}, dir)
    assert.equal(r.ok, true)
    assert.equal(r.written, 0)
    assert.equal(
      existsSync(path.join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl')),
      false,
      '零摘除不许凭空造台账文件',
    )
  } finally {
    rmScratch(dir)
  }
})

test('①c 留痕必须在落地成功之后——先写台账后落地会把"面上还在"说成"已删"(方向反了)', () => {
  const rejectedAt = SWEEPER_SRC.indexOf("why: 'landing-rejected-'")
  const ledgerAt = SWEEPER_SRC.indexOf('appendDropLedger(part.strippable')
  assert.ok(rejectedAt > 0, '源码里必须还有落地被拒那一支(找不到说明契约被改,本锁要跟着改)')
  assert.ok(ledgerAt > 0, '源码里必须有留痕调用(被别席删了 ⇒ 这里红)')
  assert.ok(
    ledgerAt > rejectedAt,
    `留痕(${ledgerAt})必须排在落地被拒分支(${rejectedAt})之后:落地失败而先写台账 = 教复洁器去剔别人的行`,
  )
  assert.ok(
    /复洁器误剔/.test(SWEEPER_SRC) && /丢别人的行/.test(SWEEPER_SRC),
    '留痕"为什么必须排在落地之后"的理由必须写在代码里,不得靠读者自己悟',
  )
  assert.ok(
    /HEAD 有没有被推进/.test(SWEEPER_SRC),
    '留痕凭据必须是"面上真的摘了"(HEAD 推进),不能只看落地器退出码 —— 退出码 2 是回读未判定而 CAS 可能已成功',
  )
})

test('②union 认台账:本侧已删 ∧ 台账里有 ⇒ 不得从对侧补回(回潮通道本体)', () => {
  const ours = `# 台账\n${OPEN_ROW}\n`
  const theirs = `# 台账\n${OPEN_ROW}\n${ROW_A}\n`
  const base = `# 台账\n${OPEN_ROW}\n${ROW_A}\n`
  const want = U.liveDocExpectedCounts(ours, theirs, base, null)
  assert.equal(
    want.get(ROW_A),
    undefined,
    '本侧按台账摘掉的行,对侧旧基线里那份不得被当成"对侧新增"补回',
  )
  assert.equal(want.get(OPEN_ROW), 1, '别人的未勾行一份都不能少带(失效方向必须是多留,不是少带)')
})

test('②b union 认台账:本侧还留着同一行 ⇒ 绝不扣(扣了就是丢本侧自己的行)', () => {
  const ours = `# 台账\n${ROW_A}\n`
  const theirs = `# 台账\n${ROW_A}\n${ROW_A}\n`
  const caps = U.declaredDropCaps(ours, new Set([ROW_A]))
  assert.equal(caps.has(ROW_A), false, '本侧还有 0 份以上 ⇒ 处置权未行使,一律不扣')
  const want = U.liveDocExpectedCounts(ours, theirs, ours, null)
  assert.ok((want.get(ROW_A) ?? 0) >= 1, '本侧自己那份必须还在期望表里')
})

test('②c declaredDropCaps 只认登记行,台账外的正文一行都不扣', () => {
  const prose = '这是一句普通正文,不是登记行'
  const ours = `# 台账\n${prose}\n`
  const caps = U.declaredDropCaps(ours, new Set([prose, OPEN_ROW]))
  assert.equal(caps.has(prose), false, '非登记行不参与(只认 - [ ] / - [x])')
  assert.equal(caps.has(OPEN_ROW), true, '台账里、本侧没有的未勾登记行也要扣——它同样是被正当摘除的')
})

test('②d 台账取不到 ⇒ 一条不扣(失效方向是多留一份,绝不少带别人的行)', () => {
  const ours = `# 台账\n${OPEN_ROW}\n`
  // 传一个非 Set 且让 declaredRows 读不到(临时根)⇒ 必须返回空集而不是抛错
  const caps = U.declaredDropCaps(ours, null)
  assert.ok(caps instanceof Set)
  // 生产面会去读真实台账;这里只保证函数不抛、且未勾行不会被无端扣掉
  assert.equal(caps.has(OPEN_ROW), false, '本侧还留着的行,任何情况下都不得被扣')
})

test('③接线锁:union 的期望表必须调用 declaredDropCaps(被删 ⇒ 回潮通道重新打开)', () => {
  const fnAt = UNION_SRC.indexOf('export function liveDocExpectedCounts')
  assert.ok(fnAt > 0)
  const body = UNION_SRC.slice(fnAt, fnAt + 6000)
  assert.ok(
    /declaredDropCaps\(/.test(body),
    'liveDocExpectedCounts 必须扣掉摘除台账命中的行(产出面与自证面共用这张表,故只在这处接)',
  )
  assert.ok(
    typeof U.declaredDropCaps === 'function',
    '__test__ 必须导出 declaredDropCaps,否则镜像测试只能去抄第二份判据',
  )
})

test('③b 接线锁:union 必须 import 摘除台账(§0.6 单一真相源,不许在本器复算)', () => {
  assert.ok(
    /import \{ declaredRows \} from '\.\/scrub-declared-removals\.mjs'/.test(UNION_SRC),
    'declaredRows 必须从复洁器 import —— 两处各写一份必漂移',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
