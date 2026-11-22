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
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { __test__ as S } from '../strip-stale-closed-rows.mjs'
import { staleClosedVerdict } from '../check-plan-closed-stock.mjs'
import { closedRegistrationOf } from '../check-plan-line-loss.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const P_OPEN_A = '- [ ] G-7001 探针甲:这条登记行用来验证清扫器与守门七十一问的是同一把尺子'
const P_OPEN_B = '- [ ] G-7002 探针乙:这一行始终未勾,用来让保护集在夹具面上不为空以便判定'
const P_OPEN_C = '- [ ] G-7003 探针丙:第三枚提交只改这一行,好让翻勾那枚不是 HEAD 自身'
const CLOSED_A_PAIRED =
  '- [x] ✅(2026-10-20/甲) G-7001 探针甲:这条登记行用来验证清扫器与守门七十一问的是同一把尺子'
const CLOSED_A_DRIFT =
  '- [x] ✅(2026-10-20/甲) G-7001 探针甲【翻勾时正文被改写过】于是历史里的开放形态没了凭据'

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
    assert.equal(
      hollow.ok && hollow.strippable.length,
      1,
      '尺子恒空 ⇒ 全判可摘(所以尺子必须真接上)',
    )
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
    writeFileSync(
      path.join(dir, 'PROJECT_PLAN.md'),
      ['# 计划', CLOSED_A_PAIRED, ''].join('\n'),
      'utf8',
    )
    g(dir, ['add', 'PROJECT_PLAN.md'])
    g(dir, ['commit', '-q', '-m', '配平翻勾'])
    const ruler = S.buildLineLossRuler({ root: dir, archived: () => null })
    assert.equal(
      ruler.ok,
      false,
      `保护集应为 0 而尺子必须拒绝,实得:ok=${ruler.ok} seen=${ruler.seen?.size}`,
    )
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
  const names = clause[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const n of ['historyMarkers', 'missingFrom', 'closedRegistrationOf', 'lastHistoryWindow'])
    assert.ok(names.includes(n), `import 里必须含门 71 出口 ${n},实得:${names.join('/')}`)
  for (const stolen of ['countsPerCommit', 'unexplained', 'flips +=', 'retired.add'])
    assert.ok(!src.includes(stolen), `出现 "${stolen}" = 在本器里抄了第二份历史状态机`)
  // 出口确实还在门 71 上(被抽走 ⇒ 上面那条 import 当场炸,而这条先点名是哪一格)
  const g71 = await import('../check-plan-line-loss.mjs')
  for (const n of [
    'historyMarkers',
    'missingFrom',
    'closedRegistrationOf',
    'lastHistoryWindow',
    'historyDepth',
  ])
    assert.equal(
      typeof g71[n],
      'function',
      `守门 71 缺少可复用出口 ${n} ⇒ 本档停手并上报,不得私抄判据`,
    )
})

test('M7 归因不全 ⇒ 整批不落(解释不了的红必须多要一次定向说明,§0.10)', () => {
  const head = ['# 计划', P_OPEN_B, CLOSED_A_PAIRED].join('\n')
  const part = S.partitionStaleByProtection(head, [{ line: 3, raw: CLOSED_A_PAIRED }], (text) =>
    text === head ? [] : [{ marker: 'G-7999 没人摘过的编号', id: 'G-7999' }],
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
    assert.ok(
      S.emitResult(st, { stale: 0, held: 0, stripped: 0 }).startsWith(`SWEEP-RESULT state=${st} `),
    )
})

test('M10 形状锁:主流程必须在任何落地动作之前先问尺子(顺序即纪律)', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../strip-stale-closed-rows.mjs', import.meta.url), 'utf8')
  const main = src.slice(src.indexOf('function main()'))
  const asked = main.indexOf('buildLineLossRuler()')
  const landed = main.indexOf(
    "spawnSync(process.execPath, [path.join(ROOT, 'scripts/object-space-land.mjs')]",
  )
  assert.ok(asked >= 0, '主流程必须真的调用尺子(只在纯函数里备着 = 没接线)')
  assert.ok(landed >= 0, '落地通道仍必须是 object-space-land(不得自己写工作树)')
  assert.ok(asked < landed, `问尺子(${asked})必须排在落地(${landed})之前`)
  assert.ok(
    main.indexOf('process.exit(2)') < main.indexOf('buildLineLossRuler()') + 900,
    '尺子不可用那一档必须就近落 exit 2,不得跑到后面',
  )
  // 每一档出口都带机读结论行:clean/stripped/all-held/refused/undetermined/preflight
  for (const st of ['clean', 'stripped', 'all-held', 'refused', 'undetermined', 'preflight'])
    assert.ok(
      main.includes(`emitResult('${st}'`),
      `主流程缺 state=${st} 的结论行 ⇒ 守护日志会读成未判定`,
    )
})

test('D1 面漂移判据三态:两面同 ⇒ ok;不同 ⇒ 判出漂移;任一取不到 ⇒ undetermined(不读成"没漂移")', () => {
  assert.deepEqual(S.faceDriftVerdict('# 计划\n- [ ] G-1 甲\n', '# 计划\n- [ ] G-1 甲\n'), {
    ok: true,
  })
  const drift = S.faceDriftVerdict('# 计划\n- [ ] G-1 甲\n', '# 计划\n- [x] G-1 甲\n')
  assert.equal(drift.ok, false)
  assert.equal(drift.undetermined, undefined, '取得到而不同 = 判出漂移,不是未判定')
  for (const [a, b] of [
    [null, 'x'],
    ['x', null],
    [undefined, undefined],
  ])
    assert.equal(S.faceDriftVerdict(a, b).undetermined, true, '任一取不到一律未判定')
})

test('D3 形状锁(2026-10-28 提速):预探默认关闭、IHUI_LAND_PROBE=1 才开,postProbe 与它同开关', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../strip-stale-closed-rows.mjs', import.meta.url), 'utf8')
  const main = src.slice(src.indexOf('function main()'))
  const gate = main.indexOf("process.env.IHUI_LAND_PROBE !== '1'")
  const run = main.indexOf('preProbe = rerunAffectedGates(')
  assert.ok(gate >= 0, '预探必须先判 IHUI_LAND_PROBE 开关(默认关)')
  assert.ok(run > gate, `开关(${gate})必须排在真跑预探(${run})之前`)
  assert.ok(main.includes("process.env.IHUI_LAND_PROBE === '1'"), 'postProbe 必须与预探同一开关')
  assert.ok(
    !/if \(advanced && rerunAffectedGates\) \{/.test(main),
    'postProbe 不得绕过开关:预探默认关时它没有比较对象,再跑一批纯属空转',
  )
})

test('D2 形状锁(2026-10-28 枚 1d73ea96161a):面漂移守卫必须排在 object-space-land 之前,底稿按 sha 固定读', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../strip-stale-closed-rows.mjs', import.meta.url), 'utf8')
  const main = src.slice(src.indexOf('function main()'))
  const guard = main.indexOf('faceDriftVerdict(headText')
  const landed = main.indexOf(
    "spawnSync(process.execPath, [path.join(ROOT, 'scripts/object-space-land.mjs')]",
  )
  assert.ok(guard >= 0, '主流程必须真的调用面漂移守卫(只在纯函数里备着 = 没接线)')
  assert.ok(landed >= 0 && guard < landed, `守卫(${guard})必须排在落地(${landed})之前`)
  assert.ok(
    /const headShaAtRead = shaOf\('HEAD'\)/.test(main),
    '底稿必须按 sha 固定读,不得按符号 HEAD 连读两面',
  )
  assert.ok(
    main.includes('blobOf(`${headShaAtRead}:${FILE}`)'),
    '底稿面必须由读时的 sha 取,不得再问一次符号 HEAD',
  )
})

test('M9 身份出口同形:被跳过的已勾行,门 71 自己认得它的 marker/id(否则归因臂是空的)', () => {
  for (const row of [CLOSED_A_PAIRED, CLOSED_A_DRIFT]) {
    const reg = closedRegistrationOf(row)
    assert.ok(
      reg && reg.marker && reg.id === 'G-7001',
      `closedRegistrationOf 必须给出身份,实得:${JSON.stringify(reg)}`,
    )
  }
  assert.equal(closedRegistrationOf(P_OPEN_A), null, '未勾行不属于"已勾形态"这一档')
})

test('M12 H3 复量自洽(G-928/G-960 型,2026-10-22 根治):同号未勾+同主键两枚滞留已勾拷贝 ⇒ 一次全检出、摘后复量==跳过集', () => {
  const DUP_OPEN = '- [ ] G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性'
  const DUP_R1 =
    '- [x] ✅(2026-10-20/甲) G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性'
  const DUP_R2 =
    '- [x] ✅(2026-10-20/乙) G-7004 待办夹具:这一组用来钉住同主键滞留拷贝必须逐枚全报的 H3 自洽性〔第二枚拷贝〕'
  const face = [DUP_OPEN, DUP_R1, DUP_R2].join('\n')
  const v = staleClosedVerdict(face, face)
  assert.equal(
    v.stale.length,
    2,
    `两枚滞留拷贝须一次全检出(判据只报首枚就会摘完冒出"新"滞留、H3 恒拒),实得 ${v.stale.length}`,
  )
  const part = S.partitionStaleByProtection(face, v.stale, () => [])
  assert.equal(part.ok, true, `应判可摘,实得 why=${part.why}`)
  assert.equal(part.strippable.length, 2)
  assert.equal(part.held.length, 0)
  assert.equal(part.removed, 2)
  // main 里 H3 的同一算式:摘后复量滞留集必须**恰好等于**跳过集(逐字),不得多出没人负责的一条
  const after = staleClosedVerdict(part.text, face)
  assert.equal(after.undetermined, false)
  assert.equal(
    after.stale.length,
    part.held.length,
    `H3 复量:摘后滞留数(${after.stale.length})必须==跳过数(${part.held.length})`,
  )
  assert.equal(
    after.stale
      .map((r) => r.raw)
      .sort()
      .join('\n'),
    [...part.held]
      .map((h) => h.row.raw)
      .sort()
      .join('\n'),
    'H3 复量:摘后滞留集必须==跳过集(逐字)',
  )
  assert.equal(
    S.sweepOutcome(part, { apply: true }).state,
    'stripped',
    '两枚全摘后应落 stripped 档而非 H3 拒',
  )
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
  const arm = {
    kind: 'registry',
    id: '130',
    script: 'plan-tasks.mjs',
    mode: 'blocking',
    out: `报数行\n${line}\n`,
  }
  const r = S.attributePreexistingRed({
    pre: { verdict: 1, failed: [arm], ran: [], undetermined: [] },
    post: {
      verdict: 1,
      failed: [{ ...arm, out: `另一个报数行\n${line}\n` }],
      ran: [],
      undetermined: [],
    },
  })
  assert.equal(r.ok, true, `应归为存量红,实得 why=${r.why}`)
  assert.equal(r.preexisting.length, 1)
  assert.equal(r.preexisting[0].id, '130')
  assert.equal(r.newArms.length, 0)
})

test('N3 归因失败:落地前该臂没判红 ⇒ 必是本枚带来的红(照旧 refused)', () => {
  const arm = {
    kind: 'registry',
    id: '130',
    script: 'plan-tasks.mjs',
    mode: 'blocking',
    out: '❌ 新红\n',
  }
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
    pre: {
      verdict: 1,
      failed: [{ ...base, out: '❌ 71 条登记行不在\n     - 甲行\n' }],
      ran: [],
      undetermined: [],
    },
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
  const arm = {
    kind: 'registry',
    id: '130',
    script: 'plan-tasks.mjs',
    mode: 'blocking',
    out: '❌ 红\n',
  }
  const r = S.attributePreexistingRed({
    pre: { verdict: 1, failed: [arm], ran: [], undetermined: [] },
    post: {
      verdict: 2,
      failed: [arm],
      ran: [],
      undetermined: [{ kind: 'registry', id: '9', rc: 2 }],
    },
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
  assert.ok(
    landIdx >= 0 && ledgerIdx > landIdx,
    '留痕段必须排在落地之后(凭据 = HEAD 推进,不是退出码)',
  )
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
    const stripped = face
      .split('\n')
      .filter((l) => l !== CLOSED_A_PAIRED)
      .join('\n')
    const vsParent = staleClosedVerdict(stripped, parent)
    assert.equal(
      vsParent.stale.length,
      0,
      `基线取 HEAD^ 时刚翻勾的宽现行不该被点名,实得 ${JSON.stringify(vsParent.stale)}`,
    )
    // 反证:若把基线换成摘除前的那份(= 被审面自己),宽现行会被咬成滞留 ⇒ 正是这条口径要防的假红
    const vsSelf = staleClosedVerdict(stripped, face)
    assert.ok(vsSelf.stale.length > 0, '取错基线(拿被审面自己当基线)必然把每一行已勾都读成滞留')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── 差集两档(2026-10-27 立,取证 .ihui-agent/tmp/g63-debt/evidence.md:16 枚 undetermined 全假阳性)
// 档① removedRowsBetween 行尾符/末空行归一;档② 未勾行差集先过两问(同题存续 / 台账-归档凭据)。
// 红线:真丢失(无留痕、无归档、同题形态不在面上)**照旧** undetermined —— 这两条是本族的形状锁。
const D_PARENT = 'f'.repeat(40)
const D_COMMIT = 'e'.repeat(40)
const D_R1 = '- [x] ✅(2026-10-26/甲) G-9101 两档镜像夹具:一枚滞留已勾行用来验证回捞腿补账'
const D_R2 = '- [x] ✅(2026-10-26/乙) G-9102 两档镜像夹具:二枚滞留已勾行用来验证回捞腿补账'
const D_OPEN = '- [ ] G-9103 两档镜像夹具:别人的活,内容零丢失时不得冒充前提破了'
const D_HEAD = [D_OPEN, D_R1, D_R2].join('\n') + '\n'

function debtGitFor(landedFace, subject = undefined) {
  return (args) => {
    if (args[0] === 'log')
      return `${D_COMMIT}\u001f${D_PARENT}\u001f${subject ?? S.sweepCommitSubject(2, 0)}\n`
    const spec = String(args[2] ?? '')
    if (spec === `${D_PARENT}:PROJECT_PLAN.md`) return D_HEAD
    if (spec === `${D_COMMIT}:PROJECT_PLAN.md`) return landedFace
    throw new Error(`夹具没有这一面:${spec}`) // HEAD 面 / ls-files 一律取不到 ⇒ 通道零认
  }
}

test('D1 档① 正向对照:仅行尾符/末空行差异 ⇒ 差集不再冒出「非已勾行」,回捞腿不再 undetermined', () => {
  const eolParent = [D_OPEN, D_R1 + '\r', D_R2].join('\n') + '\n\n'
  const eolLanded = [D_OPEN, D_R2].join('\n') + '\n'
  const diff = S.removedRowsBetween(eolParent, eolLanded)
  assert.deepEqual(diff.closed, [D_R1], '行尾归一后只剩真摘掉的已勾行')
  assert.equal(diff.unexpected.length, 0, '`\r` 尾与末空行不得留在「非已勾行」计数里')
  const dir = mkScratch('strip-closed-d1-')
  let rec = null
  try {
    rec = S.reconcileDropLedgerDebt({
      root: dir,
      gitRun: debtGitFor(eolLanded, S.sweepCommitSubject(1, 0)),
    })
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
  assert.equal(
    rec.state,
    'recovered',
    `行尾差异不得再拦补账,实得 state=${rec.state} why=${rec.why}`,
  )
  assert.equal(rec.written, 1)
  assert.equal(rec.undetermined.length, 0)
})

test('D2 档② 正向对照:未勾行换形存续(问a)/有台账或归档凭据(问b) ⇒ 记已付并点名哪一问接住', () => {
  const pool = S.buildSubjectPool([D_OPEN + '〔注记换了形态但题面未动〕'])
  const adj = S.adjudicateUnexpectedOpenRows([D_OPEN], {
    landedText: [D_OPEN + '〔注记换了形态但题面未动〕'].join('\n'),
    headText: null,
    ledgerPool: null,
    archivePool: null,
  })
  assert.equal(adj.lost.length, 0, '同题形态仍在被审面 ⇒ 不是真丢失')
  assert.match(adj.paid[0].via, /问a/, '必须点名是哪一问接住的')
  assert.ok(pool.fps.size >= 1, '池子必须真算出了指纹(不是逐字碰巧)')
})

test('D3 红线反证:已勾行被摘且未勾行**真被吞**(无留痕/无归档/同题不在面上)⇒ 照旧 undetermined 且零写入', () => {
  const landed = '# 台账\n- [ ] G-8888 无关题:与夹具票既不同题也不同号\n'
  const diff = S.removedRowsBetween(D_HEAD, landed)
  assert.deepEqual(diff.unexpected, [D_OPEN], '档②不吞判据输入:未勾行仍在差集里,只是要再过两问')
  const dir = mkScratch('strip-closed-d3-')
  let rec = null
  try {
    rec = S.reconcileDropLedgerDebt({ root: dir, gitRun: debtGitFor(landed) })
    assert.equal(rec.state, 'undetermined', `真丢失必须仍判得出来,实得 state=${rec.state}`)
    assert.equal(rec.written, 0, 'undetermined 档一条不写(§0.10:假凭据会教复洁器剔别人的行)')
    assert.equal(rec.undetermined.length, 1)
    assert.match(rec.undetermined[0].why, /前提破了/)
    assert.match(rec.undetermined[0].why, /真丢失候选 1/, '必须点名 lost 枚数,不得与"非登记行"混桶')
    assert.equal(
      existsSync(dir + '/.ihui-agent/state/plan-row-drop.jsonl'),
      false,
      '整枚不补 ⇒ 台账文件都不该被创建',
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('D4 单源锁:档②三面判据(指纹/主键/台账凭据)import 既有单源,本器不得抄第二份(§0.6/§22c)', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../strip-stale-closed-rows.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /import\s*\{\s*extractTaskFingerprint\s*,\s*bulletTitleKey\s*\}\s*from\s*'\.\/check-plan-task-duplicates\.mjs'/,
    '题面指纹与正文粗体题面必须 import 守门 203 的同源实现',
  )
  assert.match(
    src,
    /import\s*\{[^}]*\bkeyOfRow\b[^}]*\}\s*from\s*'\.\/lib\/plan-task-index\.mjs'/,
    '复合主键必须 import lib/plan-task-index 的 keyOfRow',
  )
  assert.match(
    src,
    /import\s*\{\s*declaredRows\s*\}\s*from\s*'\.\/scrub-declared-removals\.mjs'/,
    '台账凭据必须 import scrub-declared-removals 的 declaredRows',
  )
  // 反证方向:档②本体里不得再出现第二份"什么算同一件事"的手写归一(指纹的算法只许在单源里)
  const at = src.indexOf('export function adjudicateUnexpectedOpenRows')
  assert.ok(at >= 0, 'adjudicateUnexpectedOpenRows 必须存在且已导出进判据路径')
  let rest = src.slice(at)
  const nextDoc = rest.indexOf('\n/**\n', 10)
  if (nextDoc > 0) rest = rest.slice(0, nextDoc)
  assert.ok(!/toLowerCase\(\)/.test(rest), '档②里出现 toLowerCase = 抄了第二份指纹归一(必然漂移)')
  assert.ok(!/weight\s*[<>]/.test(rest), '档②里出现权重门槛 = 抄了第二份指纹可靠性判据')
})

// 「尾部未勾行必须存活」反向夹具(2026-10-28 立;票面事故:枚 c32fae1fb9 一次摘 4 行 =
// 两枚该摘的 [x] + 1 空行 + 1 枚别人刚经 live-doc-edit 追加到文件尾的 `- [ ]` 票)。
// 钉两件事:① 行号正确时,EOF 追加的未勾票必须逐字节存活且仍是最后一行;
// ② 行号集来自旧面而落地面已变(索引偏移)时整批不落 —— 不许"删了几行 == 集大小"自证(H0 的老洞)。
test('H1-EOF 尾部未勾票:正确行号下逐字节存活;行号偏移吃它 ⇒ 整批不落', () => {
  const stale = '- [x] ✅(2026-10-20/乙) G-7010 探针丁:翻勾后正文漂开,因而属门 229 的跨枚滞留'
  const eofOpen = '- [ ] G-7011 探针戊:别人刚经 live-doc-edit 追加在文件尾的未勾票'
  const base = [stale, '', eofOpen].join('\n')

  const good = S.buildStripPlan(base, [1])
  assert.equal(good.ok, true, `正确行号应成立,实得 why=${good.why}`)
  assert.equal(good.removed, 1)
  const outLines = good.text.split('\n')
  assert.equal(outLines[outLines.length - 1], eofOpen, 'EOF 未勾票必须逐字节存活且仍在末尾')
  assert.equal(outLines.filter((l) => /^- \[ \]/.test(l)).length, 1, '未勾行计数也不许变')

  for (const drop of [[2], [3], [1, 2]]) {
    const bad = S.buildStripPlan(base, drop)
    assert.equal(bad.ok, false, `偏移行号 ${JSON.stringify(drop)} 必须整批不落`)
    assert.equal(bad.text, undefined, '不落时不得产出结果文本(否则调用方可能照写)')
  }
})

// ── 档③ 正文粗体题面通道(2026-10-28 立;实测 319a35025fc7 卡死清扫器的真因)──────────
// 事故面:正文条目 `- **⑦会话搬家——定案:先取证,不施工(2026-10-27)**:…` 在同枚提交里被
// 同题 244 字版替换(粗体逐字相同),而 extractTaskFingerprint 只认 `- [ ]`/`- [x]` ⇒
// 非登记行算不出指纹 ⇒ 判成「真丢失」⇒ 回捞腿整轮 undetermined ⇒ 完成即删清扫停摆一整天。
const E_BULLET_OLD =
  '- **⑦会话搬家——定案:先取证,不施工(2026-10-27)**:侦察结论——本机登录态文件与仓内协议层/credits 取证均零会话端点证据,故本轮只登记不动手;取证面见 commit message。'
const E_BULLET_NEW =
  '- **⑦会话搬家——定案:先取证,不施工(2026-10-27)**:侦察结论同上(正文改短,题面未动)。'
const E_BULLET_OTHER = '- **⑧一键网页重登(2026-10-27 续)**:与⑦无关的另一件事。'

function debtGitForFaces(parentFace, landedFace) {
  return (args) => {
    if (args[0] === 'log') return `${D_COMMIT}\u001f${D_PARENT}\u001f${S.sweepCommitSubject(2, 0)}\n`
    const spec = String(args[2] ?? '')
    if (spec === `${D_PARENT}:PROJECT_PLAN.md`) return parentFace
    if (spec === `${D_COMMIT}:PROJECT_PLAN.md`) return landedFace
    throw new Error(`夹具没有这一面:${spec}`)
  }
}

test('E1 档③ 正向:正文条目同题改短(粗体逐字相同)⇒ 记已付,回捞腿 recovered 并补账', () => {
  const parentFace = [D_OPEN, E_BULLET_OLD, D_R1, D_R2].join('\n') + '\n'
  const landedFace = [D_OPEN, E_BULLET_NEW].join('\n') + '\n'
  const diff = S.removedRowsBetween(parentFace, landedFace)
  assert.deepEqual(diff.unexpected, [E_BULLET_OLD], '夹具成立性:该条目必须真落进「非已勾行」桶')
  const adj = S.adjudicateUnexpectedOpenRows([E_BULLET_OLD], {
    landedText: landedFace,
    headText: null,
    ledgerPool: null,
    archivePool: null,
  })
  assert.equal(adj.lost.length, 0, '同题粗体仍在落地面 ⇒ 是就地改写,不是丢失')
  assert.match(adj.paid[0].via, /正文粗体题面/, '必须点名由哪一条通道接住')

  const dir = mkScratch('strip-closed-e1-')
  let rec = null
  try {
    rec = S.reconcileDropLedgerDebt({ root: dir, gitRun: debtGitForFaces(parentFace, landedFace) })
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
  assert.equal(rec.state, 'recovered', `同题改短不得再拦补账,实得 state=${rec.state} why=${rec.why}`)
  assert.equal(rec.written, 2, '两枚已勾行的留痕必须补齐')
  assert.equal(rec.undetermined.length, 0)
})

test('E2 档③ 反证:正文条目真被吞(面上无同题粗体)⇒ 照旧 undetermined 且零写入', () => {
  const parentFace = [D_OPEN, E_BULLET_OLD, D_R1].join('\n') + '\n'
  const landedFace = [D_OPEN, E_BULLET_OTHER].join('\n') + '\n'
  const dir = mkScratch('strip-closed-e2-')
  let rec = null
  try {
    rec = S.reconcileDropLedgerDebt({ root: dir, gitRun: debtGitForFaces(parentFace, landedFace) })
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
  assert.equal(rec.state, 'undetermined', `真丢失必须仍判得出来,实得 state=${rec.state}`)
  assert.equal(rec.written, 0, '§0.10:前提破了就一条不写')
  assert.match(rec.undetermined[0].why, /非登记行 1/)
})

test('E3 档③ 门槛:粗体过短不参与匹配;登记行一律走指纹(不在本通道另立一套)', async () => {
  const { bulletTitleKey } = await import('../check-plan-task-duplicates.mjs')
  assert.equal(bulletTitleKey('- **补充**:过短的粗体不当题面'), null, '权重 < 16 必须返回 null')
  assert.equal(bulletTitleKey(D_OPEN), null, '登记行不归本通道')
  assert.equal(bulletTitleKey('- 无粗体的普通条目:也不归本通道'), null)
  assert.ok(bulletTitleKey(E_BULLET_OLD), '正常题面必须算得出键')
  assert.equal(
    bulletTitleKey(E_BULLET_OLD),
    bulletTitleKey(E_BULLET_NEW),
    '同题新旧两版必须算出同一个键(否则改了日期/标点就失效)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
