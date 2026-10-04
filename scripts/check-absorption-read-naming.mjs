#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815988 —— 吸收台账的 `read` 计数必须**逐切片具名化**。
 *
 * 我们在修什么:台账里 `read` 长期是**自报数**。上游对照(`packages/ui/src/lib/
 * chatErrorAttributionEvidence.ts` 那类"allowlist 覆盖不全就静默退化")同一条型:
 * "读过多少"里若有一部分拿不出文件清单,那一部分就**不可问责**,而账面读起来像全都能问责。
 *
 * **分工(唯一实现,这条是本文件的命门)**:
 *  "具名条目是否真兑现"(路径在不在被审面、行数对不对、同路径是否双计)与
 *  "声明为全量具名的切片,`read` 必须等于清单去重长度" —— **两把判据都住在
 *  `scripts/zcode-absorption-matrix.mjs`(M12 / M13),本器一道都不重写**。
 *  本器只做两件 matrix 没有做的事:
 *    AN1 把两个数**按切片**摊开(可问责 / 仅计数)并逐条点名差额 —— matrix 只给全表头条;
 *    AN2 核算票面点名的六个区是否"名数 ≥ read 的一半" —— 这是 G-815988 的验收口径。
 *  因此本器对 matrix 的调用是**取材**,不是复制判据:`--json` 的 `rows[].verifiedRead`
 *  与 `errors[]` 就是它给的结论,原样透传计入本器退出码。
 *
 * **为什么默认不判红(与票面同一条理由)**:全表 read 远大于具名数,当场 blocking 就是一台
 *  与任何提交无关的恒红门(AGENTS §12e),唯一结局是逼人 `--no-verify` 连带废掉全部守门。
 *  正解是逐切片回填,每补一块差额自然缩小 —— 所以未达标只**报名**,问责走 `--strict`。
 *
 * **为什么本器也不接提交链**:它要读 `.ihui-agent/tmp/zcode-study/zcode` 那个 gitignore 的
 *  本机只读克隆(经 matrix 之口)。在非部署机上"克隆不存在"就是恒红门 —— 与 matrix 本身
 *  刻意不接提交链是同一条取向。紧急跳过无需:它不在钩子链上。
 *
 * 三态绝不并桶:达标 / 未达标(仅计数) / **未判定**(matrix 问不到克隆、rows 取不到、
 *  全量具名声明存在而 M13 那把尺子不在位)。"未判定"永远点名原因,**绝不记为通过**。
 *
 * 用法:
 *   node scripts/check-absorption-read-naming.mjs            # 只读报告,零写盘
 *   node scripts/check-absorption-read-naming.mjs --strict    # 问责档:未达标 exit 1 / 未判定 exit 2
 *   node scripts/check-absorption-read-naming.mjs --json
 *   node scripts/check-absorption-read-naming.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 取材走统一层(守门 118 的口径):内容只由 `readWorktreeFile` 取,`execFileSync` 只做派生。
// 为什么这一器取**工作树面**而不是 HEAD:它的分档读数是**问 matrix 要的**,而 matrix 读的是磁盘那份
// 台账(它没有面旗)。本器若把自己的两份直读改成 HEAD,就成"rows 来自磁盘 + 清单形态来自 HEAD"
// 的混面取材 —— 那正是守门 118 / 101 / 83 记过的"自洽却错位的尺子"。所以整器恒一面,并把面印在结论行。
import { readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER_REL = 'config/zcode-absorption.json'
const MATRIX_REL = 'scripts/zcode-absorption-matrix.mjs'

/**
 * 票面点名的六个区(G-815988 立项现读 read=88/94/31/29/23/16 —— 那是**立项读数**,
 * 现值一律跑本器取末行,不得照那段数字派单)。写死这六个路径是有意的:它们是这张票
 * 的验收射程;少一个就说明台账收窄成了空集或路径搬了家,那属 AN4 的"尺子失效"。
 */
const SIX_REGIONS = [
  'packages/desktop/src',
  'packages/shared/src',
  'apps/zcode-cli/packages/bootstrap',
  'apps/zcode-cli/packages/contracts',
  'apps/zcode-cli/packages/tui',
  '.agents',
]

/** matrix 的透传红:凡这两族前缀的错误都属"具名清单兑现性/自洽性",一律算本器的红。 */
const DELEGATED_RED_PREFIXES = ['M12 ', 'M13 ']

/**
 * 纯判据:输入全部由调用方喂进来(matrix 的 rows + errors、台账的清单形态、克隆在位性),
 * 因此 `--self-test` 能用构造面证明它"有牙",而不必依赖那台 gitignore 克隆此刻在不在。
 * 本函数**不派生 git、不读盘** —— 读盘只发生在取材层,判据与取材分离。
 */
export function evaluate({ rows, matrixErrors, stringFormSlices, m13Present, sixRegions }) {
  const list = Array.isArray(rows) ? rows : []
  const errs = Array.isArray(matrixErrors) ? matrixErrors : []
  const six = Array.isArray(sixRegions) ? sixRegions : []

  const perSlice = list.map((r) => {
    const read = Number(r?.read ?? 0)
    const named = Number(r?.verifiedRead ?? 0)
    const countOnly = Math.max(0, read - named)
    return { path: String(r?.path ?? ''), read, named, countOnly }
  })

  const accountable = perSlice.reduce((a, x) => a + x.named, 0)
  const countOnlyTotal = perSlice.reduce((a, x) => a + x.countOnly, 0)
  const readTotal = perSlice.reduce((a, x) => a + x.read, 0)

  // AN1 逐切片点名差额(只点真正有差额的那些,并按差额降序 —— 派单要先看最大的那块)
  const withGap = perSlice.filter((x) => x.countOnly > 0).sort((a, b) => b.countOnly - a.countOnly)

  // AN2 六区达标核算。取整方向:ceil(read/2) —— "一半"不含小数,免得 61 的半被 floor 成 30 而放水。
  const sixRows = new Map(perSlice.map((x) => [x.path, x]))
  const regions = []
  const missingRegions = []
  for (const p of six) {
    const row = sixRows.get(p)
    if (!row) {
      missingRegions.push(p)
      continue
    }
    const need = Math.ceil(row.read / 2)
    regions.push({ path: p, read: row.read, named: row.named, need, met: row.named >= need })
  }
  const unmet = regions.filter((r) => !r.met)

  // 透传 matrix 的判定(本器不重算)
  const delegatedRed = errs.filter((e) => DELEGATED_RED_PREFIXES.some((p) => String(e).startsWith(p)))

  const violations = []
  const undetermined = []

  // AN4 判死:清单被过滤成空 ⇒ 这是尺子失效,不是"没有违规"
  if (list.length === 0) {
    violations.push('AN4 rows 为空 —— 台账/被审面收窄成空集,分档读数无从算起(判死,不记通过)')
  }
  if (six.length === 0) {
    violations.push('AN4 六区射程为空 —— 验收口径本身丢了,不得默认通过')
  }
  for (const p of missingRegions) {
    violations.push(`AN4 票面点名的区不在台账 rows 里:${p}(射程收窄 ⇒ 红,不静默跳过)`)
  }
  for (const e of delegatedRed) {
    violations.push(`透传 matrix 的红(具名清单不兑现/不自洽):${e}`)
  }

  // AN3 全量具名声明的等值维:判据在 matrix 的 M13,本器只问它在不在位
  if (stringFormSlices > 0 && !m13Present) {
    undetermined.push(
      `AN3 有 ${stringFormSlices} 片声明"读集已逐名登记"(readFiles 全字符串),但 matrix 面上未见 M13 判据 ⇒ 等值这一维**未判定**(不冒红也不记绿)`,
    )
  }

  return {
    perSlice,
    totals: { readTotal, accountable, countOnlyTotal, slices: perSlice.length },
    withGap,
    regions,
    unmet,
    missingRegions,
    delegatedRed,
    stringFormSlices,
    m13Present,
    violations,
    undetermined,
  }
}

/** 取材层:跑 matrix 拿结论(判据不在这里),并读台账只为了算"清单形态计数"。 */
function gather() {
  let matrixOut = null
  let matrixErr = null
  try {
    // 派生控制台程序必须 windowsHide(守门 52)+ 必须带 timeout(守门 80 那一型:无界挂起)。
    matrixOut = execFileSync(process.execPath, [join(ROOT, MATRIX_REL), '--json'], {
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 128 * 1024 * 1024,
      windowsHide: true,
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
  } catch (e) {
    matrixErr = e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400)
  }

  let ledger = null
  let ledgerErr = null
  // 不套"吞掉一切"的 try:readWorktreeFile 对真实读错误抛 Undetermined(编码/权限),
  // 那必须被读成**未判定并点名**,而不是被 catch 成"文件不存在"这种业务结论(守门 97 那一课)。
  let ledgerText
  try {
    ledgerText = readWorktreeFile(ROOT, LEDGER_REL)
  } catch (e) {
    ledgerErr = `工作树面取不到 ${LEDGER_REL}:${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`
  }
  if (ledgerErr === null && ledgerText === null) ledgerErr = `${LEDGER_REL} 在工作树面不存在(或为二进制)`
  if (ledgerErr === null) {
    try {
      ledger = JSON.parse(ledgerText)
    } catch (e) {
      ledgerErr = `台账 JSON 解析失败:${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`
    }
  }

  // 只数形态,不判等值(等值是 M13 的事)
  let stringFormSlices = 0
  if (ledger && Array.isArray(ledger.slices)) {
    for (const s of ledger.slices) {
      const rf = s?.readFiles
      if (Array.isArray(rf) && rf.length > 0 && rf.every((i) => typeof i === 'string')) {
        stringFormSlices += 1
      }
    }
  }

  let m13Present = false
  let m13Face = '未取到'
  let matrixSrc = null
  let matrixSrcErr = false
  try {
    matrixSrc = readWorktreeFile(ROOT, MATRIX_REL)
  } catch (e) {
    matrixSrcErr = true
    m13Face = `取不到(${e instanceof Error ? e.message.slice(0, 120) : '未知错误'})`
  }
  if (!matrixSrcErr) {
    if (matrixSrc === null) {
      m13Face = '工作树面不存在'
    } else {
      m13Present = /\bM13\b/.test(matrixSrc)
      m13Face = m13Present ? '工作树在位' : '工作树无'
    }
  }

  let rows = []
  let errors = []
  let matrixUndetermined = null
  if (matrixErr !== null) {
    matrixUndetermined = `matrix 派生失败:${matrixErr}`
  } else {
    try {
      const parsed = JSON.parse(String(matrixOut))
      rows = Array.isArray(parsed.rows) ? parsed.rows : []
      errors = Array.isArray(parsed.errors) ? parsed.errors : []
      if (parsed.undetermined === true) {
        matrixUndetermined = 'matrix 自报未判定(上游克隆不在位 / 被审面问不到)⇒ 本器的分档读数没有取材面'
      }
      if (rows.length === 0 && matrixUndetermined === null) {
        matrixUndetermined = 'matrix 给出 0 个切片行 —— 空扫不得读成通过'
      }
    } catch {
      matrixUndetermined = 'matrix 的 --json 输出解析不到 rows —— 结论无效,不按 0 计'
    }
  }

  return {
    rows,
    errors,
    stringFormSlices,
    m13Present,
    m13Face,
    matrixUndetermined,
    ledgerErr,
    slicesInLedger: Array.isArray(ledger?.slices) ? ledger.slices.length : 0,
  }
}

function printReport(r, g) {
  console.log('吸收台账 read 具名化对账(G-815988;分档判据取材自 zcode-absorption-matrix,本器不重写 M12/M13)')
  console.log('取材面:工作树(与 matrix 同面 —— matrix 无面旗、恒读磁盘,混面即"自洽却错位的尺子",守门 118/101 那一型)')
  console.log(`台账切片 ${g.slicesInLedger} 条 / matrix 给出 rows ${r.totals.slices} 条 / 声明全量具名(readFiles 全字符串)的切片 ${r.stringFormSlices} 条`)
  console.log(`M13 字样在位性:${g.m13Face}(源码**粗筛**,只答"那段判据写没写",不证它真在跑 —— 等值判定由 matrix 出,不由本器出)`)
  if (g.ledgerErr !== null) console.log(`⚠️ 未判定:台账取不到 —— ${g.ledgerErr}`)
  if (g.matrixUndetermined !== null) console.log(`⚠️ 未判定:${g.matrixUndetermined}`)
  for (const u of r.undetermined) console.log(`⚠️ 未判定:${u}`)

  console.log('')
  console.log(`两档读数(全表):具名可复核 ${r.totals.accountable} / 仅计数(不可复核的自报数)${r.totals.countOnlyTotal} / 合计 read ${r.totals.readTotal}`)
  console.log('')
  console.log('票面六区达标(判据:名数 ≥ ceil(read/2);未达标默认只报名,--strict 才判红):')
  for (const x of r.regions) {
    console.log(
      `  ${x.met ? '✅' : '⛔'} ${x.path}  read=${x.read} 具名=${x.named} 需≥${x.need} 差额=${Math.max(0, x.read - x.named)}`,
    )
  }
  for (const p of r.missingRegions) console.log(`  ⛔ ${p} —— 不在台账 rows(AN4)`)
  console.log('')
  console.log(`差额最大的切片(前 10,共 ${r.withGap.length} 片有差额)—— "仅计数"这一档就是从这里逐片清偿的:`)
  for (const x of r.withGap.slice(0, 10)) {
    console.log(`  ${String(x.countOnly).padStart(5)} 份仅计数 / read ${x.read}  ${x.path}`)
  }
  if (r.violations.length > 0) {
    console.log('')
    for (const v of r.violations) console.log(`❌ ${v}`)
  }
  console.log('')
  console.log(`末行:具名可复核=${r.totals.accountable} 仅计数=${r.totals.countOnlyTotal} 六区达标=${r.regions.filter((x) => x.met).length}/${r.regions.length}${r.missingRegions.length > 0 ? `+射程缺失${r.missingRegions.length}` : ''}`)
  console.log('(本器不在提交链:它判的是本机台账与本机克隆的读数,与本次提交内容无关 —— 恒红只会逼人跳门)')
  return 0
}

/**
 * 自检:构造面,不碰真仓也不碰克隆。三条必须都有牙:
 *  ① 少登记一个切片 ⇒ 六区达标翻红(票面明令的对照);
 *  ② 射程被收窄成空 ⇒ 判死红,不得读成"没有违规";
 *  ③ matrix 的红必须被透传成自己的红,而全量具名声明遇上 M13 不在位 ⇒ 未判定而非通过。
 */
function selfTest() {
  const cases = []
  // cond 一律**当场求值**再记账。写成 `!!cond` / `cond === true` 而往里传箭头函数,
  // 断言就从写下起永不求值(前者恒真、后者恒假),账面却照样打点 —— AGENTS §守门速查
  // "自检 harness 的 cond 必须是已求值的布尔"那一型,本仓踩过两次,这里第三次都不许犯。
  const t = (name, cond) => {
    let v = false
    let label = name
    try {
      v = (typeof cond === 'function' ? cond() : cond) === true
    } catch (e) {
      v = false
      label = `${name}(求值抛错:${e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120)})`
    }
    cases.push([label, v])
  }
  const six = ['a', 'b']

  const baseRows = [
    { path: 'a', read: 10, verifiedRead: 6 },
    { path: 'b', read: 9, verifiedRead: 9 },
  ]
  const ok = evaluate({ rows: baseRows, matrixErrors: [], stringFormSlices: 0, m13Present: true, sixRegions: six })
  t('AN1 两档分家且不并桶(可复核 15 / 仅计数 4 / read 19)', () => {
    return ok.totals.accountable === 15 && ok.totals.countOnlyTotal === 4 && ok.totals.readTotal === 19
  })
  // 未达标必须是"名数 < ceil(read/2)"这一档,拿 baseRows(a 名 6 ≥ 需 5)当反例会把**达标**的区
  // 说成未达标 —— 判据的边界得由构造面自己给出,不是由注释声明。
  const below = evaluate({
    rows: [{ path: 'a', read: 10, verifiedRead: 4 }, { path: 'b', read: 9, verifiedRead: 9 }],
    matrixErrors: [],
    stringFormSlices: 0,
    m13Present: true,
    sixRegions: six,
  })
  t('AN2 未达标区被逐条点名(需 ≥ ceil(10/2)=5,名 4 ⇒ 红并点名)', () => {
    return below.unmet.length === 1 && below.unmet[0].path === 'a' && below.regions[0].need === 5
  })
  t('AN2 名数恰等于 need 时不得判红(边界不误伤)', () => {
    const edge = evaluate({
      rows: [{ path: 'a', read: 10, verifiedRead: 5 }, { path: 'b', read: 9, verifiedRead: 9 }],
      matrixErrors: [],
      stringFormSlices: 0,
      m13Present: true,
      sixRegions: six,
    })
    return edge.unmet.length === 0 && edge.regions[0].need === 5
  })
  t('AN2 全达标时 violations 为空(不误红)', () => ok.violations.length === 0)

  // ① 少登记一个切片:a 的可复核从 6 掉到 4(需 ≥5)⇒ 必须翻红
  const dropped = evaluate({
    rows: [{ path: 'a', read: 10, verifiedRead: 4 }, { path: 'b', read: 9, verifiedRead: 9 }],
    matrixErrors: [],
    stringFormSlices: 0,
    m13Present: true,
    sixRegions: six,
  })
  t('牙齿① 少登记一片 ⇒ 该区由达标翻为未达标且差额被点名', () => {
    return ok.unmet.length === 0 && dropped.unmet.length === 1 && dropped.unmet[0].named === 4 && dropped.withGap[0].countOnly === 6
  })

  // ② 射程/清单被过滤成空 ⇒ 判死,绝不"通过"
  const empty = evaluate({ rows: [], matrixErrors: [], stringFormSlices: 0, m13Present: true, sixRegions: six })
  t('牙齿② rows 为空 ⇒ 判死红(空扫不是通过)', () => empty.violations.some((v) => v.startsWith('AN4')))
  const emptySix = evaluate({ rows: baseRows, matrixErrors: [], stringFormSlices: 0, m13Present: true, sixRegions: [] })
  t('牙齿②b 六区射程为空 ⇒ 同样判死', () => emptySix.violations.some((v) => v.startsWith('AN4')))
  const gone = evaluate({
    rows: [{ path: 'a', read: 10, verifiedRead: 10 }],
    matrixErrors: [],
    stringFormSlices: 0,
    m13Present: true,
    sixRegions: six,
  })
  t('牙齿②c 点名的区不在面上 ⇒ 红且点名,不静默跳过', () =>
    gone.missingRegions.length === 1 && gone.missingRegions[0] === 'b' && gone.violations.some((v) => v.includes('b')),
  )

  // ③ 透传与未判定
  const passed = evaluate({
    rows: baseRows,
    matrixErrors: ['M13 切片 a 的 read=10 ≠ readFiles 去重后的 9 个(具名清单是唯一计数来源,数字必须由清单算出)'],
    stringFormSlices: 1,
    m13Present: true,
    sixRegions: six,
  })
  t('牙齿③ matrix 的 M13 红被原样透传进本器红(本器不重算)', () =>
    passed.delegatedRed.length === 1 && passed.violations.some((v) => v.startsWith('透传')),
  )
  const blind = evaluate({
    rows: baseRows,
    matrixErrors: [],
    stringFormSlices: 2,
    m13Present: false,
    sixRegions: six,
  })
  t('牙齿④ 有全量具名声明而等值尺子不在位 ⇒ 落未判定(不冒红也不记绿)', () =>
    blind.undetermined.length === 1 && blind.violations.length === 0 && blind.undetermined[0].startsWith('AN3'),
  )
  const noBlind = evaluate({ rows: baseRows, matrixErrors: [], stringFormSlices: 0, m13Present: false, sixRegions: six })
  t('牙齿④b 没有全量具名声明时不虚构未判定(向后兼容)', () => noBlind.undetermined.length === 0)
  t('AN1 差额降序(最大的那块排最前,便于派单)', () => {
    const e = evaluate({
      rows: [
        { path: 'a', read: 10, verifiedRead: 9 },
        { path: 'b', read: 40, verifiedRead: 1 },
      ],
      matrixErrors: [],
      stringFormSlices: 0,
      m13Present: true,
      sixRegions: [],
    })
    return e.withGap[0].path === 'b'
  })

  let fail = 0
  for (const [name, cond] of cases) {
    if (!cond) fail += 1
    console.log(`${cond ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检 ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const strict = argv.includes('--strict')
  const asJson = argv.includes('--json')

  const g = gather()
  const r = evaluate({
    rows: g.rows,
    matrixErrors: g.errors,
    stringFormSlices: g.stringFormSlices,
    m13Present: g.m13Present,
    sixRegions: SIX_REGIONS,
  })
  // 取材失败的两种形态必须**先于**判据出码:matrix 问不到克隆 / 台账取不到 ⇒ 本器没有分档读数可报。
  // 此时 AN4 的"rows 为空即判死"会被顺带触发,但那不是清单腐烂而是取材面问不到 —— 两者不得混为
  // 一谈(把"没跑到"报成"跑到且违规",与把"没判"报成"判过了"是同一条禁令的两面)。
  const gatherFailed = g.matrixUndetermined !== null || g.ledgerErr !== null
  const onlyUndetermined = gatherFailed && r.violations.every((v) => v.startsWith('AN4'))

  if (asJson) {
    console.log(JSON.stringify({ ...r, gather: { matrixUndetermined: g.matrixUndetermined, ledgerErr: g.ledgerErr, slicesInLedger: g.slicesInLedger, m13Face: g.m13Face, face: 'worktree' } }, null, 2))
  } else {
    printReport(r, g)
  }

  if (onlyUndetermined) return strict ? 2 : 0
  if (r.violations.length > 0) return 1
  if (strict && (r.undetermined.length > 0 || g.matrixUndetermined !== null || g.ledgerErr !== null)) return 2
  if (strict && r.unmet.length > 0) return 1
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`)
    process.exitCode = 2
  }
}

export const __test__ = { evaluate, SIX_REGIONS }

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
