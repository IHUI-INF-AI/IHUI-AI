// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「完成即删」兜底清扫器 H4 档(摘除前先问守门 71 同一把尺子)的镜像测试(2026-10-20 立)。
// §22c:判据一律 import `../strip-stale-closed-rows.mjs` 的 `__test__` 出口与守门 71 的既有出口,
// 本文件不重写任何"什么算同一件事/什么算勾销"的判定;夹具一律落 mkScratch(§15b/§15c,仓内禁 git init)。
// 立因是现读的缺陷:清扫器按门 229 摘掉一条已勾行后,门 71 的 --heal 层会把同一条票按**未勾形态**
// 还原(G-815944:未勾数 252→253)⇒ 清扫白做一轮、台账每 30 分钟可能再抖一次。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { __test__ as S } from '../strip-stale-closed-rows.mjs'
import { staleClosedVerdict } from '../check-plan-closed-stock.mjs'
import { closedRegistrationOf } from '../check-plan-line-loss.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const P_OPEN_A = '- [ ] G-7001 探针甲:这条登记行用来验证清扫器与守门七十一问的是同一把尺子'
const P_OPEN_B = '- [ ] G-7002 探针乙:这一行始终未勾,用来让保护集在夹具面上不为空以便判定'
const P_OPEN_C = '- [ ] G-7003 探针丙:第三枚提交只改这一行,好让翻勾那枚不是 HEAD 自身'
const CLOSED_A_PAIRED = '- [x] ✅(2026-10-20/甲) G-7001 探针甲:这条登记行用来验证清扫器与守门七十一问的是同一把尺子'
const CLOSED_A_DRIFT = '- [x] ✅(2026-10-20/甲) G-7001 探针甲【翻勾时正文被改写过】于是历史里的开放形态没了凭据'

function g(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** 造一枚只动 PROJECT_PLAN.md 的演练仓(落仓库树外,§15c);commit2 翻勾、commit3 只改别的行。 */
function fixtureRepo(closedA) {
  const dir = mkScratch('strip-closed-mirror-')
  g(dir, ['init', '-q', '-b', 'main'])
  g(dir, ['config', 'user.email', 'mirror@example.invalid'])
  g(dir, ['config', 'user.name', 'mirror'])
  const plan = (rows) => ['# 计划', ...rows, ''].join('\n')
  const write = (rows) => {
    writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), plan(rows), 'utf8')
    g(dir, ['add', 'PROJECT_PLAN.md'])
    g(dir, ['commit', '-q', '-m', 'mirror fixture'])
  }
  write([P_OPEN_A, P_OPEN_B])
  write([closedA, P_OPEN_B])
  write([closedA, P_OPEN_B, P_OPEN_C])
  return dir
}

/** 门 229 的滞留集(与清扫器主流程同一判据)—— 夹具必须先真是"跨枚滞留",否则测的不是这一档。 */
function staleRowsOf(dir) {
  const head = g(dir, ['show', 'HEAD:PROJECT_PLAN.md'])
  const parent = g(dir, ['show', 'HEAD^:PROJECT_PLAN.md'])
  const v = staleClosedVerdict(head, parent)
  assert.equal(v.undetermined, false, '夹具面必须解析得动')
  return { head, v, stale: v.stale }
}

test('夹具成立性:配平翻勾与漂开翻勾两型都确属门 229 的跨枚滞留集', () => {
  for (const closedA of [CLOSED_A_PAIRED, CLOSED_A_DRIFT]) {
    const dir = fixtureRepo(closedA)
    try {
      const { stale } = staleRowsOf(dir)
      assert.equal(stale.length, 1, `夹具应恰有 1 条滞留,实得 ${stale.length}`)
      assert.equal(stale[0].raw, closedA)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  }
})

test('M1 正例:翻勾与摘行配平(门 71 判「已勾销」)⇒ 滞留行照摘,未勾行逐字节不动', () => {
  const dir = fixtureRepo(CLOSED_A_PAIRED)
  try {
    const { head, stale } = staleRowsOf(dir)
    const ruler = S.buildLineLossRuler({ root: dir, archived: () => null })
    assert.equal(ruler.ok, true, `尺子必须可用,实得 why=${ruler.why}`)
    const part = S.partitionStaleByProtection(head, stale, ruler.lossesOf)
    assert.equal(part.ok, true, `应判可摘,实得 why=${part.why}`)
    assert.equal(part.undetermined, undefined)
    assert.equal(part.held.length, 0, `配平翻勾不该被扣住,实得 ${JSON.stringify(part.held)}`)
    assert.equal(part.strippable.length, 1)
    assert.equal(part.removed, 1)
    assert.equal(S.sweepOutcome(part, { apply: true }).state, 'stripped')
    assert.equal(S.sweepOutcome(part, { apply: true }).exit, 0)
    // H1 侧证:未勾的两行在摘后文本里逐字节仍在、顺序未变;H2:只少一行
    assert.ok(part.text.includes(P_OPEN_B) && part.text.includes(P_OPEN_C), '未勾行必须原样保留')
    assert.equal(part.text.split('\n').length, head.split('\n').length - 1, '行数必须精确少 1')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M2 正例(G-815944 型):门 71 判「仍保护」⇒ 同一条滞留行必须跳过并点名,不得显示成已清', () => {
  const dir = fixtureRepo(CLOSED_A_DRIFT)
  try {
    const { head, stale } = staleRowsOf(dir)
    const ruler = S.buildLineLossRuler({ root: dir, archived: () => null })
    assert.equal(ruler.ok, true, `尺子必须可用,实得 why=${ruler.why}`)
    const part = S.partitionStaleByProtection(head, stale, ruler.lossesOf)
    assert.equal(part.ok, true, `跳过而非整批不落,实得 why=${part.why}`)
    assert.equal(part.held.length, 1, `应扣住 1 条,实得 ${part.held.length}`)
    assert.equal(part.held[0].row.raw, CLOSED_A_DRIFT)
    assert.ok(part.held[0].reasons.length > 0, '必须给出"为什么没摘"的门 71 点名(marker)')
    assert.equal(part.strippable.length, 0, '唯一那条被扣住 ⇒ 本轮无可摘')
    assert.equal(part.removed, 0)
    const out = S.sweepOutcome(part, { apply: true })
    assert.equal(out.state, 'all-held', `第三态必须独立成档,实得 ${out.state}`)
    assert.equal(out.exit, 3, '一条未摘不得按"清扫完成(0)"退出,实得 exit ' + out.exit)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M3 反证:摘除动作本身不引点名时才会摘 —— 尺子换成恒空即全放行(证明分档真依赖门 71)', () => {
  const dir = fixtureRepo(CLOSED_A_DRIFT)
  try {
    const { head, stale } = staleRowsOf(dir)
    const hollow = S.partitionStaleByProtection(head, stale, () => [])
    assert.equal(hollow.ok && hollow.strippable.length, 1, '尺子恒空 ⇒ 全判可摘(所以尺子必须真接上)')
    const wired = S.partitionStaleByProtection(
      head,
      stale,
      S.buildLineLossRuler({ root: dir, archived: () => null }).lossesOf,
    )
    assert.equal(wired.held.length, 1, '接上门 71 真尺子 ⇒ 同一行被扣住(上面那句反证才有意义)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M4 未判定档:尺子取不到 ⇒ ok:false / undetermined,且整批不落并 exit 2(不得静默当成可删或不可删)', () => {
  const dir = mkScratch('strip-closed-nogit-')
  try {
    g(dir, ['init', '-q', '-b', 'main']) // 零提交:历史面根本取不到
    const ruler = S.buildLineLossRuler({ root: dir, archived: () => null })
    assert.equal(ruler.ok, false, '无历史面可取材 ⇒ 尺子必须拒绝')
    assert.ok(ruler.why, '必须点名原因,实得:' + JSON.stringify(ruler))
    const part = S.partitionStaleByProtection(
      ['# 计划', CLOSED_A_PAIRED].join('\n'),
      [{ line: 2, raw: CLOSED_A_PAIRED }],
      () => null,
    )
    assert.equal(part.undetermined, true)
    assert.equal(part.ok, false)
    assert.equal(part.strippable.length, 0, '未判定时不得摘任何一行')
    const out = S.sweepOutcome(part, { apply: true })
    assert.equal(out.exit, 2, `未判定必须落 exit 2,实得 ${out.exit}`)
    assert.equal(out.state, 'undetermined')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M5 保护集枚举为 0 ⇒ 判死不记绿(§0.3),不得据"空保护集"放行删除', () => {
  const dir = mkScratch('strip-closed-retired-')
  try {
    g(dir, ['init', '-q', '-b', 'main'])
    g(dir, ['config', 'user.email', 'mirror@example.invalid'])
    g(dir, ['config', 'user.name', 'mirror'])
    // 两枚提交:唯一那条登记行先开放、再被**配平翻勾** ⇒ 门 71 判它「已勾销」⇒ 保护集为空
    writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), ['# 计划', P_OPEN_A, ''].join('\n'), 'utf8')
    g(dir, ['add', 'PROJECT_PLAN.md'])
    g(dir, ['commit', '-q', '-m', '登记'])
    writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), ['# 计划', CLOSED_A_PAIRED, ''].join('\n'), 'utf8')
    g(dir, ['add', 'PROJECT_PLAN.md'])
    g(dir, ['commit', '-q', '-m', '配平翻勾'])
    const ruler = S.buildLineLossRuler({ root: dir, archived: () => null })
    assert.equal(ruler.ok, false, `保护集应为 0 而尺子必须拒绝,实得:ok=${ruler.ok} seen=${ruler.seen?.size}`)
    assert.match(ruler.why, /枚举为 0/, `原因必须点名是"空保护集"这一型,实得:${ruler.why}`)
    // 反证:尺子拒绝时,主流程拿不到 lossesOf ⇒ 摘除档结构上不可能"默默放行"
    assert.equal(typeof ruler.lossesOf, 'undefined', '尺子不可用就不该带出 lossesOf')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M6 单源纪律:清扫器 import 门 71 的出口,自己不复算配平状态机(§0.6/§22c)', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../strip-stale-closed-rows.mjs', import.meta.url), 'utf8')
  const clause = src.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/check-plan-line-loss\.mjs'/)
  assert.ok(clause, "必须存在从 './check-plan-line-loss.mjs' 的 import(尺子借门 71)")
  const names = clause[1].split(',').map((s) => s.trim()).filter(Boolean)
  for (const n of ['historyMarkers', 'missingFrom', 'closedRegistrationOf', 'lastHistoryWindow'])
    assert.ok(names.includes(n), `import 里必须含门 71 出口 ${n},实得:${names.join('/')}`)
  for (const stolen of ['countsPerCommit', 'unexplained', 'flips +=', 'retired.add'])
    assert.ok(!src.includes(stolen), `出现 "${stolen}" = 在本器里抄了第二份历史状态机`)
  // 出口确实还在门 71 上(被抽走 ⇒ 上面那条 import 当场炸,而这条先点名是哪一格)
  const g71 = await import('../check-plan-line-loss.mjs')
  for (const n of ['historyMarkers', 'missingFrom', 'closedRegistrationOf', 'lastHistoryWindow', 'historyDepth'])
    assert.equal(typeof g71[n], 'function', `守门 71 缺少可复用出口 ${n} ⇒ 本档停手并上报,不得私抄判据`)
})

test('M7 归因不全 ⇒ 整批不落(解释不了的红必须多要一次定向说明,§0.10)', () => {
  const head = ['# 计划', P_OPEN_B, CLOSED_A_PAIRED].join('\n')
  const part = S.partitionStaleByProtection(
    head,
    [{ line: 3, raw: CLOSED_A_PAIRED }],
    (text) => (text === head ? [] : [{ marker: 'G-7999 没人摘过的编号', id: 'G-7999' }]),
  )
  assert.equal(part.ok, false)
  assert.equal(part.unattributed.length, 1)
  assert.match(part.why, /归不到/)
  assert.equal(S.sweepOutcome(part, { apply: true }).exit, 1)
})

test('M8 机读结论行:state 与三个计数恒在场(守护日志按它分三态)', () => {
  const line = S.emitResult('stripped', { stale: 3, held: 1, stripped: 2 })
  assert.match(line, /^SWEEP-RESULT state=stripped stale=3 held=1 stripped=2$/)
  for (const st of ['clean', 'preflight', 'stripped', 'all-held', 'refused', 'undetermined'])
    assert.ok(S.emitResult(st, { stale: 0, held: 0, stripped: 0 }).startsWith(`SWEEP-RESULT state=${st} `))
})

test('M10 形状锁:主流程必须在任何落地动作之前先问尺子(顺序即纪律)', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../strip-stale-closed-rows.mjs', import.meta.url), 'utf8')
  const main = src.slice(src.indexOf('function main()'))
  const asked = main.indexOf('buildLineLossRuler()')
  const landed = main.indexOf("spawnSync(process.execPath, [path.join(ROOT, 'scripts/object-space-land.mjs')]")
  assert.ok(asked >= 0, '主流程必须真的调用尺子(只在纯函数里备着 = 没接线)')
  assert.ok(landed >= 0, '落地通道仍必须是 object-space-land(不得自己写工作树)')
  assert.ok(asked < landed, `问尺子(${asked})必须排在落地(${landed})之前`)
  assert.ok(main.indexOf('process.exit(2)') < main.indexOf('buildLineLossRuler()') + 900, '尺子不可用那一档必须就近落 exit 2,不得跑到后面')
  // 每一档出口都带机读结论行:clean/stripped/all-held/refused/undetermined/preflight
  for (const st of ['clean', 'stripped', 'all-held', 'refused', 'undetermined', 'preflight'])
    assert.ok(main.includes(`emitResult('${st}'`), `主流程缺 state=${st} 的结论行 ⇒ 守护日志会读成未判定`)
})

test('M9 身份出口同形:被跳过的已勾行,门 71 自己认得它的 marker/id(否则归因臂是空的)', () => {
  for (const row of [CLOSED_A_PAIRED, CLOSED_A_DRIFT]) {
    const reg = closedRegistrationOf(row)
    assert.ok(reg && reg.marker && reg.id === 'G-7001', `closedRegistrationOf 必须给出身份,实得:${JSON.stringify(reg)}`)
  }
  assert.equal(closedRegistrationOf(P_OPEN_A), null, '未勾行不属于"已勾形态"这一档')
})

test('M12 H3 复量自洽(G-928/G-960 型,2026-10-22 根治):同号未勾+同主键两枚滞留已勾拷贝 ⇒ 一次全检出、摘后复量==跳过集', () => {
  const DUP_OPEN = '- [ ] G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性'
  const DUP_R1 = '- [x] ✅(2026-10-20/甲) G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性'
  const DUP_R2 = '- [x] ✅(2026-10-20/乙) G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性〔第二枚拷贝〕'
  const face = [DUP_OPEN, DUP_R1, DUP_R2].join('\n')
  const v = staleClosedVerdict(face, face)
  assert.equal(v.stale.length, 2, `两枚滞留拷贝须一次全检出(判据只报首枚就会摘完冒出"新"滞留、H3 恒拒),实得 ${v.stale.length}`)
  const part = S.partitionStaleByProtection(face, v.stale, () => [])
  assert.equal(part.ok, true, `应判可摘,实得 why=${part.why}`)
  assert.equal(part.strippable.length, 2)
  assert.equal(part.held.length, 0)
  assert.equal(part.removed, 2)
  // main 里 H3 的同一算式:摘后复量滞留集必须**恰好等于**跳过集(逐字),不得多出没人负责的一条
  const after = staleClosedVerdict(part.text, face)
  assert.equal(after.undetermined, false)
  assert.equal(after.stale.length, part.held.length, `H3 复量:摘后滞留数(${after.stale.length})必须==跳过数(${part.held.length})`)
  assert.equal(
    after.stale.map((r) => r.raw).sort().join('\n'),
    [...part.held].map((h) => h.row.raw).sort().join('\n'),
    'H3 复量:摘后滞留集必须==跳过集(逐字)',
  )
  assert.equal(S.sweepOutcome(part, { apply: true }).state, 'stripped', '两枚全摘后应落 stripped 档而非 H3 拒')
  // H1 侧证:同号未勾行在摘后面上逐字节原样
  assert.ok(part.text.includes(DUP_OPEN), '未勾行必须原样保留(未勾副本不遮蔽已勾拷贝,也不被误摘)')
})

test('N1 判红证据抽取:取 ❌ 头行与逐条明细,剥 ANSI,不把进度行算进证据', () => {
  const out = [
    '\x1b[36m判定面:HEAD blob\x1b[0m',
    '  F1 同主键两态并存 : 0 组 / 涉及未勾选行 0',
    '\x1b[31m❌ 基线棘轮:F4 同一件事多条待办(副本行) 由基线 0 涨到 1\x1b[0m',
    '   F11 等人拍板未勾行 〔G-1#某题〕:- [ ] 某行',
    '     - **D100〔旧号〕 计费自助**:某条丢失行',
    '',
  ].join('\n')
  const ev = S.redEvidence(out)
  assert.deepEqual(ev, [
    '❌ 基线棘轮:F4 同一件事多条待办(副本行) 由基线 0 涨到 1',
    '   F11 等人拍板未勾行 〔G-1#某题〕:- [ ] 某行',
    '     - **D100〔旧号〕 计费自助**:某条丢失行',
  ])
  assert.equal(
    S.redEvidence('').length,
    0,
    '取不到输出 ⇒ 证据集必须为空(空集不得被读成"没有新证据")',
  )
})

test('N2 归因成立:落地前后同一臂判红且证据逐行未增 ⇒ 归为存量红(不豁免、不改判据)', () => {
  const line = '❌ 基线棘轮:F4 同一件事多条待办(副本行) 由基线 0 涨到 1'
  const arm = { kind: 'registry', id: '130', script: 'plan-tasks.mjs', mode: 'blocking', out: `报数行\n${line}\n` }
  const r = S.attributePreexistingRed({
    pre: { verdict: 1, failed: [arm], ran: [], undetermined: [] },
    post: { verdict: 1, failed: [{ ...arm, out: `另一个报数行\n${line}\n` }], ran: [], undetermined: [] },
  })
  assert.equal(r.ok, true, `应归为存量红,实得 why=${r.why}`)
  assert.equal(r.preexisting.length, 1)
  assert.equal(r.preexisting[0].id, '130')
  assert.equal(r.newArms.length, 0)
})

test('N3 归因失败:落地前该臂没判红 ⇒ 必是本枚带来的红(照旧 refused)', () => {
  const arm = { kind: 'registry', id: '130', script: 'plan-tasks.mjs', mode: 'blocking', out: '❌ 新红\n' }
  const r = S.attributePreexistingRed({
    pre: { verdict: 0, failed: [], ran: [], undetermined: [] },
    post: { verdict: 1, failed: [arm], ran: [], undetermined: [] },
  })
  assert.equal(r.ok, false)
  assert.equal(r.newArms.length, 0, '双侧 verdict 不是 1 ⇒ 直接归因失败(不逐臂再算)')
  assert.match(r.why, /未判定|不是双侧/)
  const r2 = S.attributePreexistingRed({
    pre: { verdict: 1, failed: [], ran: [], undetermined: [{ kind: 'registry', id: '71', rc: 2 }] },
    post: { verdict: 1, failed: [arm], ran: [], undetermined: [] },
  })
  assert.equal(r2.ok, false)
  assert.equal(r2.newArms.length, 1)
  assert.match(r2.newArms[0].why, /落地前这一臂没判红/)
})

test('N4 归因失败:同名臂出现落地前没有的证据行 ⇒ 不许按存量红放行', () => {
  const base = { kind: 'registry', id: '71', script: 'check-plan-line-loss.mjs', mode: 'blocking' }
  const r = S.attributePreexistingRed({
    pre: { verdict: 1, failed: [{ ...base, out: '❌ 71 条登记行不在\n     - 甲行\n' }], ran: [], undetermined: [] },
    post: {
      verdict: 1,
      failed: [{ ...base, out: '❌ 71 条登记行不在\n     - 甲行\n     - 新丢的乙行\n' }],
      ran: [],
      undetermined: [],
    },
  })
  assert.equal(r.ok, false)
  assert.equal(r.newArms.length, 1)
  assert.match(r.newArms[0].why, /没有的判红证据/)
  assert.deepEqual(r.newArms[0].sample, ['     - 新丢的乙行'])
})

test('N5 归因失败:任一面 verdict=2(无法判定)不按存量红放行 —— 未判定不等于通过(§0.3)', () => {
  const arm = { kind: 'registry', id: '130', script: 'plan-tasks.mjs', mode: 'blocking', out: '❌ 红\n' }
  const r = S.attributePreexistingRed({
    pre: { verdict: 1, failed: [arm], ran: [], undetermined: [] },
    post: { verdict: 2, failed: [arm], ran: [], undetermined: [{ kind: 'registry', id: '9', rc: 2 }] },
  })
  assert.equal(r.ok, false)
  assert.equal(r.preVerdict, 1)
  assert.equal(r.postVerdict, 2)
  assert.match(r.why, /未判定/)
  assert.equal(
    S.attributePreexistingRed({ pre: null, post: arm }).ok,
    false,
    '预探取不到 ⇒ 归因未判定',
  )
})

test('N6 顺序锁(2026-10-24 立):落地器 exit≠0 时,留痕与推送腿必须先跑,归因只在之后收口', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../strip-stale-closed-rows.mjs', import.meta.url), 'utf8')
  // 判据单源:预探与落地后复跑都 import lib 的同一个出口,不得在本器里另写一份选门/判红逻辑
  assert.match(
    src,
    /await\s+import\(\s*'\.\/lib\/land-gate-rerun\.mjs'\s*\)/,
    '必须以动态 import 取 lib/land-gate-rerun 的 rerunAffectedGates(§0.6:选门与复跑只许一份实现)',
  )
  assert.match(
    src,
    /catch\s*\{\s*\n\s*rerunAffectedGates = null/,
    '动态 import 必须带守卫:该 lib 尚未入库时清扫器不得整体崩掉(取不到 ⇒ 归因未判定)',
  )
  for (const stolen of ['stagedTriggers:', 'parseGateRegistry', 'triggersTouch'])
    assert.ok(!src.includes(stolen), `出现 "${stolen}" = 在本器里抄了第二份"哪些门受影响"的判据`)
  const main = src.slice(src.indexOf('function main()'))
  const landIdx = main.indexOf("'scripts/object-space-land.mjs'")
  const ledgerIdx = main.indexOf('appendDropLedger(')
  const pushIdx = main.indexOf("'scripts/git-push-guard.mjs'")
  const attrIdx = main.indexOf('attributePreexistingRed(')
  assert.ok(landIdx >= 0 && ledgerIdx > landIdx, '留痕段必须排在落地之后(凭据 = HEAD 推进,不是退出码)')
  assert.ok(pushIdx > ledgerIdx, '推送腿必须排在留痕之后(先有凭据再推)')
  assert.ok(attrIdx > pushIdx, '归因必须排在推送腿之后 ⇒ 任何一条退出路径都先跑过留痕/推送')
  const gap = main.slice(landIdx, ledgerIdx)
  assert.ok(
    !/process\.exit\s*\(/.test(gap),
    '落地调用与留痕之间不得出现 process.exit —— 那会让留痕/推送腿被整段跳过(2026-10-24 八轮无凭据摘除的成因)',
  )
  // 归因失败档必须仍落 refused + exit 1(不得把"归因不了"折成 done)
  const tail = main.slice(attrIdx)
  assert.ok(tail.includes("emitResult('refused'"), '归因失败必须照旧落 state=refused')
  assert.ok(
    tail.includes('stripped') && tail.includes('preexisting'),
    '归因成功档必须落 stripped 并点名存量红门号',
  )
})

test('M11 H3 基线口径:摘完后"刚翻勾的宽现行"不得被读成滞留(否则 H3 是假红,批次永远落不了)', () => {
  const dir = fixtureRepo(CLOSED_A_PAIRED)
  try {
    const head = g(dir, ['show', 'HEAD:PROJECT_PLAN.md'])
    const parent = g(dir, ['show', 'HEAD^:PROJECT_PLAN.md'])
    // 被审面上另有一条"本枚刚翻勾"的已勾行(HEAD^ 里它还是未勾)⇒ 属门 229 的宽限档,不是滞留
    const flippedC = P_OPEN_C.replace('- [ ] ', '- [x] ✅(2026-10-20/丙) ')
    const face = head.replace(P_OPEN_C, flippedC)
    const stripped = face.split('\n').filter((l) => l !== CLOSED_A_PAIRED).join('\n')
    const vsParent = staleClosedVerdict(stripped, parent)
    assert.equal(vsParent.stale.length, 0, `基线取 HEAD^ 时刚翻勾的宽现行不该被点名,实得 ${JSON.stringify(vsParent.stale)}`)
    // 反证:若把基线换成摘除前的那份(= 被审面自己),宽现行会被咬成滞留 ⇒ 正是这条口径要防的假红
    const vsSelf = staleClosedVerdict(stripped, face)
    assert.ok(vsSelf.stale.length > 0, '取错基线(拿被审面自己当基线)必然把每一行已勾都读成滞留')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
