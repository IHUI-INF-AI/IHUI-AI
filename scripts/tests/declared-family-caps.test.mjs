// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 摘除台账「复合主键/指纹」维的镜像测试(G-34/G-43, 2026-10-25 立)。
 *
 * 锁的是 `declaredDropCaps` 逐字维管不到的那一格:对侧把"本侧已按台账正当摘除"的行**改写过一笔**
 * (追加注记/剥装饰/让号),新字符串不在台账逐字集里 ⇒ 按整行 union 结构上认不出 ⇒ 100% 带回
 * (活体证据:`eb35b31d15` 删 24 行 f11 存量后,`531adf7e1b` 起每一轮都被带回)。
 * 正解 = 补回前按复合主键/题面指纹再问一次清偿台账(AGENTS §1 通道③点名的"归并侧那半格")。
 *
 * 判据一律 import 自生产脚本的 `__test__`(§22c),本文件不重写任何判定;台账输入一律走
 * `scrub-declared-removals` 的 `declaredRows(root, files)` 既有出口,夹具不落真实台账、
 * 临时根用 `mkScratch`(§15b/§15c,禁止在仓库树内造夹具)。
 * 四条成对:① 正控(有声明⇒不回补) ② 负控(无声明⇒照旧补回,不误伤)
 * ③ 台账坏/缺⇒未判定且不回补 ④ 对侧改写过而族相同⇒按主键/指纹命中,不被整行差异绕过。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as U } from '../union-converge.mjs'
import { declaredRows, titleFpOf } from '../scrub-declared-removals.mjs'
import { extractTaskFingerprint } from '../check-plan-task-duplicates.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const UNION_SRC = readFileSync(fileURLToPath(new URL('../union-converge.mjs', import.meta.url)), 'utf8')

const KEEP = '- [ ] G-7700 丙任务照常在册(家族夹具)'

/** 在临时根造一份 JSONL 台账并走生产出口解析;条目给字符串 = 原样写入(造坏行用)。 */
function ledgerFixture(name, entries) {
  const dir = mkScratch('famcap-')
  try {
    mkdirSync(path.join(dir, 'lg'), { recursive: true })
    const rel = `lg/${name}.jsonl`
    writeFileSync(
      path.join(dir, rel),
      entries.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join('\n') + '\n',
      'utf8',
    )
    return declaredRows(dir, [rel])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

/** 空临时根(测"台账两份文件都不在位"那一档),读完即回收。 */
function missingLedger() {
  const dir = mkScratch('famcap-empty-')
  try {
    return declaredRows(dir, ['lg/nothing.jsonl'])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

test('① 正控:台账有同族声明而字符串不同 ⇒ 不回补,逐条计数点名(旧逐字维结构上抓不住这一型)', () => {
  const DECLARED = '- [ ] G-7701 **甲族题面逐字守恒** —— 旧的尾巴叙述'
  const REWRITTEN = '- [ ] G-7701 **甲族题面逐字守恒** —— 对侧追加了一笔注记'
  const ours = `# 台账\n${KEEP}\n`
  const theirs = `# 台账\n${KEEP}\n${REWRITTEN}\n`
  const d = ledgerFixture('a', [{ kind: 'manual-test', rowBefore: DECLARED }])
  // 前提自证:整行逐字维**抓不住**这一行(否则测不出新维的价值)
  assert.equal(
    U.declaredDropCaps(ours, new Set([DECLARED])).has(REWRITTEN),
    false,
    '夹具必须保证逐字维不命中',
  )
  const report = []
  const want = U.liveDocExpectedCounts(ours, theirs, null, null, report, d)
  assert.equal(want.get(REWRITTEN), undefined, '同族已声明摘除 ⇒ 改写形态不得被补回')
  assert.equal(report.length, 1, '拦下的每一行必须计数点名进 report')
  assert.ok(['fingerprint', 'key'].includes(report[0].via), `认账通道必须是主键/指纹,实际:${report[0].via}`)
  assert.equal(want.get(KEEP), 1, '在册的别人一行都不能少带')
})

test('② 负控:台账可读而该族无声明 ⇒ 照旧补回(新维不是黑名单);本侧同题在册 ⇒ 一律不扣', () => {
  const FRESH = '- [ ] G-7703 全新的对侧任务(家族夹具)'
  const DECLARED = '- [ ] G-7702 **乙族题面** —— 结清前的原文'
  const OURS_FORM = '- [ ] G-7702 **乙族题面** —— 本侧自己改写过的在册形态'
  const THEIRS_FORM = '- [ ] G-7702 **乙族题面** —— 对侧改写的另一形态'
  const ours = `# 台账\n${KEEP}\n${OURS_FORM}\n`
  const theirs = `# 台账\n${KEEP}\n${FRESH}\n${THEIRS_FORM}\n`
  const d = ledgerFixture('b', [{ kind: 'manual-test', rowBefore: DECLARED }])
  const report = []
  const want = U.liveDocExpectedCounts(ours, theirs, null, null, report, d)
  assert.ok(want.has(FRESH), '无声明的登记行必须照旧补回(负控:证明未误伤)')
  assert.ok(
    want.has(THEIRS_FORM),
    'A 档在册让路:同族主键在本面还有活行 ⇒ 处置权未行使,一条不扣(绝不少带别人的行)',
  )
  assert.equal(report.length, 0, '两条都不该被扣,一条也不该混进点名')
})

test('③ 台账缺/坏 ⇒ 如实"未判定"且不回补(不得静默当"没删过"),坏行按编号逐条归因', () => {
  const CAND = '- [ ] G-7704 丙族候选(编号恰好出现在坏行原文里)'
  const OTHER = '- [ ] G-7799 丁族候选(坏行不含它)'
  const ours = `# 台账\n${KEEP}\n`
  const theirs = `# 台账\n${KEEP}\n${CAND}\n${OTHER}\n`
  // ③a 台账两份文件都不在位 ⇒ 整维未判定:登记行候选一律不回补并点名原因
  const miss = missingLedger()
  assert.equal(miss.filesSeen, 0, '夹具前提:生产出口必须把"不在位"如实报成 0(不得用空集冒充"没声明过")')
  const repA = []
  const wantA = U.liveDocExpectedCounts(ours, theirs, null, null, repA, miss)
  assert.ok(!wantA.has(CAND) && !wantA.has(OTHER), '台账缺失 ⇒ 登记行候选一律不回补(未判定不回补)')
  const undA = repA.filter((r) => r.via === 'undetermined')
  assert.equal(undA.length, 2, '未判定必须逐条点名')
  assert.ok(/不在位/.test(undA[0].why), `原因必须打印在点名里,实际:${undA[0].why}`)
  // ③b 台账在位但含不可解行:仅"原文独立含该候选编号"的那族不回补,其余照常补回
  const d = ledgerFixture('c', [
    'this line is not json at all G-7704 broken',
    { kind: 'manual-test', rowBefore: '- [ ] G-7790 与本轮无关的在册声明' },
  ])
  const repB = []
  const wantB = U.liveDocExpectedCounts(ours, theirs, null, null, repB, d)
  assert.ok(!wantB.has(CAND), '坏行含其编号 ⇒ 无法排除该族的摘除声明 ⇒ 未判定不回补')
  assert.ok(wantB.has(OTHER), '不含编号的候选照旧补回(未判定档必须逐条归因,不得整批连坐)')
  const undB = repB.filter((r) => r.via === 'undetermined')
  assert.equal(undB.length, 1)
  assert.ok(/不可解/.test(undB[0].why))
  // ③c 前缀碰撞不得吃未判定:坏行只含 G-77 时,G-7704 不算命中(边界是字符类,不是裸子串)
  const d2 = ledgerFixture('d', ['corrupt mentioning G-77 only'])
  const repC = []
  const wantC = U.liveDocExpectedCounts(ours, theirs, null, null, repC, d2)
  assert.ok(wantC.has(CAND), 'G-77 对 G-7704 不构成独立出现 ⇒ 未判定归因不成立,照旧补回')
})

test('④ 对侧改写过而族相同 ⇒ 指纹维命中(让号后的新号形态不被整行差异与换号绕过)', () => {
  const DECLARED = '- [ ] G-7705 戊族同题让号正控夹具甲 —— 结清前的原文叙述'
  const RENUMBERED = '- [ ] G-7706 戊族同题让号正控夹具甲 —— 对侧让号后改写的另一段'
  // 前提自证:整行不同、主键不同(两把逐字/主键尺都追不上),题面指纹相同 —— "分族键指纹优先"的那格
  assert.notEqual(DECLARED, RENUMBERED)
  assert.notEqual(compositeKeyOf(DECLARED), compositeKeyOf(RENUMBERED))
  assert.equal(extractTaskFingerprint(DECLARED), extractTaskFingerprint(RENUMBERED))
  const ours = `# 台账\n${KEEP}\n`
  const theirs = `# 台账\n${KEEP}\n${RENUMBERED}\n`
  const d = ledgerFixture('e', [{ kind: 'f11-purge', rowBefore: DECLARED }])
  const report = []
  const want = U.liveDocExpectedCounts(ours, theirs, null, null, report, d)
  assert.equal(want.get(RENUMBERED), undefined, '同指纹族已声明清掉 ⇒ 换号+改写的形态也不回补')
  assert.equal(report[0].via, 'fingerprint', `必须由指纹维命中(优先于主键),实际:${report[0].via}`)
  // ④b 指纹算不出(题面过短)而 f11 族题面前 32 字相同 ⇒ 走 `titleFpOf` 维(与 scrub 维三同一把尺)
  const SHORT_DECLARED = '- [ ] G-7708 短题面'
  const SHORT_REWRITTEN = '- [ ] G-7709 短题面（对侧多加了一笔注记）'
  assert.equal(extractTaskFingerprint(SHORT_DECLARED), null, '夹具前提:这一对指纹维结构上抓不住')
  assert.notEqual(compositeKeyOf(SHORT_DECLARED), compositeKeyOf(SHORT_REWRITTEN))
  assert.equal(titleFpOf(SHORT_DECLARED), titleFpOf(SHORT_REWRITTEN), '夹具前提:题面 32 字维必须相同')
  const d2 = ledgerFixture('f', [{ kind: 'f11-purge', rowBefore: SHORT_DECLARED }])
  const report2 = []
  const want2 = U.liveDocExpectedCounts(`# 台账\n${KEEP}\n`, `# 台账\n${KEEP}\n${SHORT_REWRITTEN}\n`, null, null, report2, d2)
  assert.equal(want2.get(SHORT_REWRITTEN), undefined, 'f11 族题面指纹命中 ⇒ 也不回补')
  assert.equal(report2[0].via, 'title', `实际通道:${report2[0].via}`)
})

test('⑤ 端到端产物面:被拦的改写形态真的不在 union 产出里;生产面(真实台账)照常补回', () => {
  const DECLARED = '- [ ] G-7707 **戊族题面同形守恒** —— 尾巴'
  const REWRITTEN = '- [ ] G-7707 **戊族题面同形守恒** 追加 —— 尾巴'
  assert.equal(extractTaskFingerprint(DECLARED), extractTaskFingerprint(REWRITTEN), '夹具前提:同族')
  const ours = `# 台账\n${KEEP}\n`
  const theirs = `# 台账\n${KEEP}\n${REWRITTEN}\n`
  const d = ledgerFixture('g', [{ kind: 'manual-test', rowBefore: DECLARED }])
  const merged = U.unionLines(ours, theirs, null, null, { declared: d })
  assert.ok(!merged.includes('戊族题面同形守恒'), '产物面必须真的没带回那一行(不只是期望表短了)')
  // 同一夹具行不注入 ⇒ 走真实台账;夹具键不在真实台账里,必须照旧在场(阳性对照)
  const mergedProd = U.unionLines(ours, theirs, null, null, {})
  assert.ok(mergedProd.includes('戊族题面同形守恒'), '无声明时照旧补回(生产面读真实台账)')
})

test('⑥ 接线锁:期望表必须调用 declaredFamilyCaps,且台账输入全部取自既有单源', () => {
  assert.equal(typeof U.declaredFamilyCaps, 'function', '__test__ 必须导出 declaredFamilyCaps')
  const fnAt = UNION_SRC.indexOf('export function liveDocExpectedCounts')
  assert.ok(fnAt > 0)
  const body = UNION_SRC.slice(fnAt, fnAt + 9000)
  assert.ok(/declaredFamilyCaps\(/.test(body), '期望表必须扣同族命中(被删 ⇒ 回潮通道重新打开)')
  assert.ok(/ledgerWithheld/.test(UNION_SRC), '产出循环必须把拦下的行随报告面交回(不得只在内存里少带)')
  assert.ok(
    /import \{[^}]*\bdeclaredRows\b[^}]*\btitleFpOf\b[^}]*\} from '\.\/scrub-declared-removals\.mjs'/.test(UNION_SRC),
    '台账解析与题面指纹必须从复洁器 import —— 两处各写一份必漂移(§22c)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
