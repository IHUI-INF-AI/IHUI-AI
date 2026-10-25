// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「已结清（翻勾）的台账行被并集收敛从滞后副本回捞成原形态」的镜像测试（2026-10-26 立）。
 *
 * 现场（本会话实测，不是推断）：B03 权限双轴、G-593、G-115、G-272 四枚各被回捞一次以上；
 * 落库的三副本折叠也被回捞恢复。链路：
 *   ① 结清 = `- [ ]` → `- [x] ✅(日期)` **并在行尾追加注记**（`—— 二次结清…`）；
 *   ② 台账里记的是**翻勾前的 open 形态**或**翻勾后的 x 形态**；
 *   ③ 合并那一刻对侧（滞后工作树副本）带回来的是 open 原形态 ⇒
 *      逐字维 `declaredDropCaps` 拿台账里任一形态都匹配不上；
 *   ④ 复合主键维 `declaredFamilyCaps` 原本还有一道"本面同主键在册 ⇒ 一条不扣"的让路 ——
 *      而"本侧刚翻勾、清扫器还没摘"的窗口里本面**正好还有那枚 x 形态** ⇒ 让路 ⇒ 补回；
 *      等清扫器把 x 形态摘掉，面上只剩回捞回来的 open 旧形态 = 净效果"结清行被还原"。
 *
 * 收窄后的判序：同主键在本面**全是已勾**不算"处置权未行使"（那是已结清的证据，不是活票）；
 * 只要还有一枚未勾才让路。每一处扣减都必须出示台账凭据（哪条记录、哪个主键/指纹），
 * 拿不出 ⇒ **整批不扣**（落 held 桶照旧补回并点名，绝不清空交差）。
 *
 * 判据一律 import 生产脚本的 `__test__`（§22c），夹具台账走 `declaredRows(tmp, files)` 既有出口、
 * 临时根走 `mkScratch`（§15b/§15c）。四条成对：① 正控（两种"已摘除"形态都不回补）
 * ② 负控（台账没记录 ⇒ 照旧补回）③ 本侧仍逐字持有 ⇒ 不扣 ④ 摘掉主键维 ⇒ 夹具①翻红（变异自证）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as U } from '../union-converge.mjs'
import { declaredRows } from '../scrub-declared-removals.mjs'
import { extractTaskFingerprint } from '../check-plan-task-duplicates.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const UNION_SRC = readFileSync(fileURLToPath(new URL('../union-converge.mjs', import.meta.url)), 'utf8')
const SCRUB_SRC = readFileSync(fileURLToPath(new URL('../scrub-declared-removals.mjs', import.meta.url)), 'utf8')

const HDR = '# 台账\n'
const KEEP = '- [ ] G-7730 丙任务照常在册(回捞夹具)'

/** 结清前(open)与结清后(x + 行尾注记)两种形态：整行不同、复合主键相同。 */
const OPEN = '- [ ] G-7721 **结清行回捞夹具甲**:首次翻勾前的原形态 —— 旧尾巴'
const DONE = '- [x] ✅(2026-10-25) G-7721 **结清行回捞夹具甲**:首次翻勾前的原形态 —— 旧尾巴 —— 二次结清(判据与凭据见结清提交)'

/** 台账夹具：走生产出口 `declaredRows(root, files)`，不落真实台账（§15b）。 */
function ledgerFixture(name, entries) {
  const dir = mkScratch('closedrow-')
  try {
    mkdirSync(path.join(dir, 'lg'), { recursive: true })
    const rel = `lg/${name}.jsonl`
    writeFileSync(path.join(dir, rel), entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
    return declaredRows(dir, [rel])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

/** 空台账（两份文件都不在位）。 */
function missingLedger() {
  const dir = mkScratch('closedrow-empty-')
  try {
    return declaredRows(dir, ['lg/nothing.jsonl'])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
}

test('① 正控:本侧已翻勾(两种摘除进度)∧ 台账只有 x 形态 ⇒ 对侧 open 原形态不得补回,且逐条出示凭据', () => {
  // 前提自证：两种形态整行不同、复合主键相同 —— 这正是"逐字维结构上认不出"的那一格。
  assert.notEqual(OPEN, DONE)
  assert.equal(compositeKeyOf(OPEN), compositeKeyOf(DONE), '夹具前提：两种形态必须同复合主键')
  const d = ledgerFixture('a', [{ kind: 'stale-closed-sweep', rowBefore: DONE }])
  for (const [name, ours, base] of [
    ['①a 本侧已摘净(0 份)', `${HDR}${KEEP}\n`, `${HDR}${KEEP}\n`],
    ['①b 本侧仍留 x 形态(清扫器未跑)', `${HDR}${KEEP}\n${DONE}\n`, `${HDR}${KEEP}\n${DONE}\n`],
  ]) {
    // 前提自证：逐字维在两种形态上都命中不了（否则测不到主键维的价值）
    assert.equal(U.declaredDropCaps(ours, d.set).has(OPEN), false, `${name}:逐字维必须不命中`)
    const report = []
    const want = U.liveDocExpectedCounts(ours, `${ours}${OPEN}\n`, base, null, report, d)
    assert.equal(want.get(OPEN), undefined, `${name}:同主键已结清 ⇒ open 旧形态不得被补回`)
    assert.equal(want.get(KEEP), 1, `${name}:在册的别人一行都不能少带`)
    const hit = report.find((r) => r.line === OPEN)
    assert.ok(hit, `${name}:扣行必须计数点名进 report(不得静默少带)`)
    assert.ok(['key', 'fingerprint'].includes(hit.via), `${name}:认账通道必须是主键/指纹,实际:${hit.via}`)
    assert.ok(
      Array.isArray(hit.evidence?.ledgerRows) && hit.evidence.ledgerRows.includes(DONE),
      `${name}:扣减必须出示"哪条台账记录"——实际凭据:${JSON.stringify(hit.evidence)}`,
    )
    const evLine = U.formatLedgerEvidence(hit.evidence)
    assert.ok(/G-7721/.test(evLine) && /台账 1 条/.test(evLine), `${name}:凭据人读行必须点名主键与台账条数:${evLine}`)
    // 端到端：产物面真的没有那一行（不只是期望表短了）
    const merged = U.unionLines(ours, `${ours}${OPEN}\n`, base, null, { declared: d })
    assert.ok(!merged.includes('结清行回捞夹具甲 —— 旧尾巴') || merged.includes('✅(2026-10-25)'), `${name}:产物面不得留下 open 旧形态`)
    assert.ok(!merged.split('\n').includes(OPEN), `${name}:产物面必须逐字不含 open 原形态`)
  }
})

test('② 负控:台账里没有该主键的任何记录 ⇒ 对侧新增照旧补回(新判据不是黑名单)', () => {
  const FRESH = '- [ ] G-7722 对侧真新增的任务(台账无记录)'
  const ours = `${HDR}${KEEP}\n`
  const d = ledgerFixture('b', [{ kind: 'stale-closed-sweep', rowBefore: DONE }])
  const report = []
  const want = U.liveDocExpectedCounts(ours, `${ours}${FRESH}\n`, ours, null, report, d)
  assert.ok(want.has(FRESH), '台账未声明的登记行必须照旧补回(误删别人的新增 = 不可恢复)')
  assert.equal(report.length, 0, '不该有任何扣减点名')
  // 台账整体缺失那一档属于"未判定"而不是"没有声明过"：登记行候选不回补、逐条点名原因。
  const rep2 = []
  const want2 = U.liveDocExpectedCounts(ours, `${ours}${FRESH}\n`, ours, null, rep2, missingLedger())
  assert.equal(want2.get(FRESH), undefined, '台账缺位 ⇒ 未判定不回补(§0.3)')
  assert.equal(rep2[0]?.via, 'undetermined', '未判定必须逐条点名,不得静默')
})

test('③ 台账命中但本侧仍逐字持有那一行 ⇒ 不扣(只扣本侧已清掉的)', () => {
  const d = ledgerFixture('c', [{ kind: 'stale-closed-sweep', rowBefore: OPEN }])
  // 只测认账维本身：want 里这一行重数 2(本侧 1 + 对侧 1),本侧逐字持有 ⇒ 不得进入扣减集
  const fam = U.declaredFamilyCaps(`${HDR}${OPEN}\n`, new Map([[OPEN, 2]]), d)
  assert.equal(fam.withheld.size, 0, '本侧仍持有该行 ⇒ 处置权未行使,绝不可扣')
  assert.equal(fam.undetermined.size, 0)
  // 端到端：本侧仍有该行 ⇒ 结果里它照旧在(重数由 union 公式管,不由本判据删)
  const ours = `${HDR}${KEEP}\n${OPEN}\n`
  const want = U.liveDocExpectedCounts(ours, ours, HDR, null, [], d)
  assert.equal(want.get(OPEN), 1, '本侧 1 份、对侧相对基底未新增 ⇒ 结果仍是 1 份')
  // 同主键**活票**在册(未勾)⇒ 让路,对侧的另一种写法也不扣 —— 这一臂锁的是"让路"不许被收窄掉
  const OPEN_ALT = '- [ ] G-7721 **结清行回捞夹具甲**:对侧另一种在写形态'
  const famLive = U.declaredFamilyCaps(`${HDR}${KEEP}\n${OPEN}\n`, new Map([[OPEN_ALT, 1]]), d)
  assert.equal(famLive.withheld.size, 0, '本面同主键还有活票 ⇒ 必须让路(失效方向:多留一份)')
})

test('④ 变异自证:让路判据退回"同主键即让路"(旧口径)⇒ 夹具①翻红;并给出规则级对照臂', () => {
  // 规则级对照:同一份输入(本面只有 x 形态)在新口径下扣、在"同主键即让路"的旧口径下不扣。
  // 把 A 档改回 `oursKeys.has(ck)`(不看勾选态)⇒ 本用例第一断言立即翻红。
  const d = ledgerFixture('d', [{ kind: 'stale-closed-sweep', rowBefore: DONE }])
  const oursWithDone = `${HDR}${KEEP}\n${DONE}\n`
  const fam = U.declaredFamilyCaps(oursWithDone, new Map([[OPEN, 1]]), d)
  assert.ok(
    ['key', 'fingerprint'].includes(fam.withheld.get(OPEN)),
    `新口径:本面同主键全是已勾 ⇒ 不构成让路,按主键/指纹扣(实际:${fam.withheld.get(OPEN)})`,
  )
  // 对照臂(旧口径的等价物):把本面那枚 x 形态换成未勾形态 ⇒ 让路,两者必须给出相反结论
  const OPEN_SAME_KEY = '- [ ] G-7721 **结清行回捞夹具甲**:本面仍在写的同题活票'
  const famOld = U.declaredFamilyCaps(`${HDR}${KEEP}\n${OPEN_SAME_KEY}\n`, new Map([[OPEN, 1]]), d)
  assert.equal(famOld.withheld.size, 0, '活票在册 ⇒ 旧/新口径都让路(这一格不许被改宽)')
  // 端到端成对:同一夹具,新口径拦下、旧"同主键即让路"口径(用同主键活票模拟)放回
  assert.equal(U.liveDocExpectedCounts(oursWithDone, `${oursWithDone}${OPEN}\n`, oursWithDone, null, [], d).get(OPEN), undefined)
  assert.equal(
    U.liveDocExpectedCounts(`${HDR}${KEEP}\n${OPEN_SAME_KEY}\n`, `${HDR}${KEEP}\n${OPEN_SAME_KEY}\n${OPEN}\n`, HDR, null, [], d).get(OPEN),
    1,
    '变异自证失败:同主键活票在册时本应让路(照旧补回),否则说明"让路"这一档被误删',
  )
})

test('⑤ 凭据缺口 ⇒ 整批不扣(held 桶照旧补回并点名),绝不"清空当没事"', () => {
  // 短题面 ⇒ `extractTaskFingerprint` 为 null(夹具前提),逼判据走**主键**通道
  const OPEN2 = '- [ ] G-7723 甲乙丙丁'
  const DONE2 = '- [x] ✅(2026-10-25) G-7723 甲乙丙丁 —— 二次结清'
  assert.equal(extractTaskFingerprint(OPEN2), null, '夹具前提:指纹维结构上给不出答案')
  assert.equal(extractTaskFingerprint(DONE2), null, '夹具前提:指纹维结构上给不出答案')
  const ck = compositeKeyOf(OPEN2)
  assert.ok(ck, '夹具前提:主键维必须算得出')
  const broken = {
    set: new Set([DONE2]),
    closed: new Map(),
    // 坏注入形:主键命中但凭据原文缺失(模拟"账本族索引空")
    keyIndex: new Map([[ck, []]]),
    dropTitleFps: new Set(),
    dropTitleRows: new Map(),
    malformedLines: [],
    filesSeen: 2,
  }
  const ours = `${HDR}${KEEP}\n`
  const report = []
  const want = U.liveDocExpectedCounts(ours, `${ours}${OPEN2}\n`, ours, null, report, broken)
  assert.equal(want.get(OPEN2), 1, '拿不出台账原文 ⇒ 整批不扣,照旧补回')
  const held = report.find((r) => r.line === OPEN2)
  assert.equal(held?.via, 'held', `必须落 held 桶点名而不是静默:${JSON.stringify(report)}`)
  assert.ok(/凭据/.test(held.why), `让路原因必须说明是凭据缺口:${held.why}`)
  // 对照臂:同一夹具给足凭据 ⇒ 扣掉(证明 ⑤ 的红是"凭据缺口"而不是判据自己不工作)
  const ok = { ...broken, keyIndex: new Map([[ck, [DONE2]]]) }
  assert.equal(U.liveDocExpectedCounts(ours, `${ours}${OPEN2}\n`, ours, null, [], ok).get(OPEN2), undefined)
})

test('⑥ 接线锁:台账索引单源、凭据随报告面交回、held 桶不得与未判定桶合并', () => {
  assert.ok(/keyIndex/.test(SCRUB_SRC), '台账构造出口必须产出 keyIndex(主键 → 台账原文)')
  assert.ok(/dropTitleRows/.test(SCRUB_SRC), '题面指纹的证据面必须随 declaredRows 交回')
  const fnAt = UNION_SRC.indexOf('export function declaredFamilyCaps')
  assert.ok(fnAt > 0)
  const body = UNION_SRC.slice(fnAt, fnAt + 9000)
  assert.ok(/ledKeyIndex/.test(body), '扣减必须吃 keyIndex(单源构造出口)')
  assert.ok(/held\.set\(/.test(body), '证据缺口必须落 held(照旧补回),不得落 undetermined(那样会删行)')
  assert.ok(/evidence\.set\(l/.test(body), '每一处扣减都必须登记凭据')
  const wantAt = UNION_SRC.indexOf('const fam = declaredFamilyCaps')
  const wantBody = UNION_SRC.slice(wantAt, wantAt + 1200)
  assert.ok(/evidence: fam\.evidence/.test(wantBody), '凭据必须随 report 交回调用方')
  assert.ok(/fam\.held/.test(wantBody), 'held 桶必须从期望表出口透传(否则没人看得见让路)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
