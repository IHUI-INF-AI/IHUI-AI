#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-shell-form.mjs — 小程序「薄壳 vs 复制」实现形态门
 * GATE_ID: 299
 *
 * 为什么要有这道门:现有四把覆盖尺(check-cross-end-screen-coverage / gen-miniapp-mirror /
 * auto-register-cross-end / report-rn-miniapp-gaps)只数「声明/标记」,不判「实现形态」。
 * 结果是页面可以合法地写着「镜像 packages/app/.../XScreen.tsx」却整页自己复制一遍渲染 —
 * 声明为真、对齐为假。本门判的是**页面到底 import 了壳,还是自己又写了一份**。
 *
 * 判据(机械可判,分类器唯一实现在 scripts/lib/miniapp-shell-form.mjs):
 *   S1 棘轮:当前面上「已在映射里被声明为镜像/委托、却没有 import 委托入口」的页面,
 *      若不在 scripts/data/miniapp-shell-copy-ledger.jsonl 存量台账里 ⇒ 红(新增复制页)。
 *   S2 存量只报数:「可从台账摘除」只在当前判定确实成立时出现(现读薄壳 + 业务 JSX ≤2 +
 *      零重复 UI 段 + 无单端消费 prop + 有入口证据);复制页/重复段/单端 prop/超阈值/不在射程/
 *      当前面无对应页一律降级为只报差量或“不得摘除”。判据见 retirementShortfall,只许更严。
 *   委托入口 = `@rn-shells/*` | `@ihui/rn-app/features/*` | `@ihui/rn-app` barrel 同名屏。
 *   映射声明 = 登记表 cross-end-screen-registry.json ∪ 页面四形镜像声明(与既有一致)。
 *
 * 屏级契约(2026-11-07 补齐;与形态结论解耦,任何页面都必须跑满):
 *   C1 单端 prop : 共享屏在 A 端被传了 prop、B 端未传同名 prop(入口契约不对等);
 *   C2 死契约    : 共享屏 props 类型声明了该 prop,但两端都没传、屏内正文也没消费;
 *   C3 影子契约  : 声明与消费语义不一致(声明 boolean 却传函数、声明 string 却传对象),
 *                  或消费端传了契约里不存在的 prop;
 *   C4 未解析    : 静态不可判(屏/RN 正文读不到、props 类型解不开、属性展开、页面未渲染共享屏)。
 *   回归制:存量四档全部登记在 scripts/data/miniapp-shell-contract-baseline.json(只许新增条目),
 *   仅对新增命中做红;去掉基线条目 = advisory(C5),不红。新增未解析同样红 —— 盲区不许换绿。
 *   关键修复:此前分类器在「业务 JSX>2 / 未接入口」处提前 return,复制页的契约面从未被核对;
 *   现在契约取证先于形态结论执行,提前 return 只决定 impl,不再跳过错判面。
 *
 * 取材面:默认 HEAD(与门 237 同口径);`--staged` 索引;`--worktree` 人工逃生舱。
 * 台账与契约基线永远读工作树(它们是判据输入,不是被判对象;CI 干净检出上与 HEAD 等价)。
 *
 * Usage:
 *   node scripts/check-miniapp-shell-form.mjs                        # 判定 + 报数
 *   node scripts/check-miniapp-shell-form.mjs --json                 # 机器可读
 *   node scripts/check-miniapp-shell-form.mjs --explain              # 逐页取证(复制页/未判定/契约四档)
 *   node scripts/check-miniapp-shell-form.mjs --self-test            # 正反例自测
 *   node scripts/check-miniapp-shell-form.mjs --emit-baseline        # 生成存量台账(jsonl)
 *   node scripts/check-miniapp-shell-form.mjs --emit-contract-baseline # 合并新增屏级契约基线条目(只追加)
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined } from './lib/face-reader.mjs'
import { readFaceOne, resolveFace } from './lib/gate-face.mjs'
import {
  classifyMiniappPages,
  classifyPage,
  evaluateRatchet,
  hasShellImport,
  equivalentEntry,
  ledgerKey,
  loadLedgerRows,
  loadRegistry,
  retirementShortfall,
  contractItemsOf,
  evaluateContractRatchet,
  mergeContractBaseline,
  validateContractBaseline,
  analyzeScreenContract,
  CONTRACT_BASELINE,
  LEDGER,
} from './lib/miniapp-shell-form.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(HERE, '..')
const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const selfTest = argv.includes('--self-test')
const explainMode = argv.includes('--explain')
const emitBaseline = argv.includes('--emit-baseline')
const emitContractBaseline = argv.includes('--emit-contract-baseline')

const log = (...a) => {
  if (!jsonMode) console.log(...a)
}

function validateLedger(ledger) {
  const bad = []
  for (const r of ledger) {
    const missing = ['route', 'file', 'loc', 'mapStatus', 'reasonClass'].filter((k) => r?.[k] === undefined)
    if (missing.length) bad.push({ row: r, why: `台账行缺字段 ${missing.join(',')}` })
    if (!['copy', 'undetermined', 'not-applicable'].includes(r?.impl) && r?.impl !== undefined)
      bad.push({ row: r, why: `台账行 impl 非法: ${r?.impl}` })
    if (r?.mapStatus === 'not-applicable') {
      if (r.impl !== 'not-applicable') bad.push({ row: r, why: 'mapStatus=not-applicable 必须 impl=not-applicable' })
      if (!Array.isArray(r.declaredSpecs) || r.declaredSpecs.length === 0)
        bad.push({ row: r, why: 'mapStatus=not-applicable 必须声明被否定的 declaredSpecs(不许只填值)' })
      if (typeof r.note !== 'string' || r.note.replace(/\s+/g, '').length < 16 || !/[:：]/.test(r.note))
        bad.push({ row: r, why: 'mapStatus=not-applicable 的 note 必须含 file:line 级证据(≥16 字且带冒号)' })
    }
  }
  return bad
}

function emit(root, face) {
  const ledger = loadLedgerRows(root)
  const { rows } = classifyMiniappPages(root, face, ledger)
  const keep = rows
    .filter((r) => r.impl === 'copy' || r.impl === 'undetermined' || r.impl === 'not-applicable')
    .sort((a, b) => a.route.localeCompare(b.route))
    .map((r) => ({
      route: r.route,
      file: r.file,
      loc: r.loc,
      mapStatus: r.mapStatus,
      impl: r.impl,
      reasonClass: r.reasonClass,
      declaredSpecs: r.declaredSpecs,
      note: r.note,
      at: '2026-11-05',
    }))
  writeFileSync(join(root, LEDGER), keep.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  log(`✅ 已写存量台账 ${LEDGER}:${keep.length} 行(copy ${keep.filter((r) => r.impl === 'copy').length} / undetermined ${keep.filter((r) => r.impl === 'undetermined').length} / not-applicable ${keep.filter((r) => r.impl === 'not-applicable').length},面=${face})`)
  return 0
}

function isContractHit(c) {
  if (!c?.buckets) return false
  return c.state !== 'ok' || Object.values(c.buckets).some((arr) => arr.length > 0)
}

/** 屏级契约基线读工作树(判据输入);读不到 ⇒ 未判定(不能用“无基线”换绿)。 */
function loadContractBaseline(root) {
  const txt = readFaceOne(root, 'worktree', CONTRACT_BASELINE)
  if (txt === null) throw new Undetermined(`屏级契约基线 ${CONTRACT_BASELINE} 在 worktree 面读不到 ⇒ 回归判定无基准`)
  let j
  try {
    j = JSON.parse(txt)
  } catch (e) {
    throw new Undetermined(`屏级契约基线不是合法 JSON: ${e?.message ?? e}`)
  }
  if (!Array.isArray(j?.entries)) throw new Undetermined(`屏级契约基线缺 entries 数组`)
  const bad = validateContractBaseline(j.entries)
  if (bad.length) throw new Undetermined(`屏级契约基线形状非法: ${bad[0].why}`)
  return j.entries
}

/** 基线只许新增:已有条目原样保留,只追加当前面新命中。 */
function emitContractBaselineFile(root, face) {
  const txt = readFaceOne(root, 'worktree', CONTRACT_BASELINE)
  let existing = []
  if (txt !== null) {
    let j
    try {
      j = JSON.parse(txt)
    } catch (e) {
      throw new Undetermined(`屏级契约基线不是合法 JSON,拒绝合并: ${e?.message ?? e}`)
    }
    existing = j?.entries ?? []
    const bad = validateContractBaseline(existing)
    if (bad.length) throw new Undetermined(`现有屏级契约基线形状非法,拒绝合并: ${bad[0].why}`)
  }
  const { rows } = classifyMiniappPages(root, face, loadLedgerRows(root))
  const items = contractItemsOf(rows)
  const merged = mergeContractBaseline(existing, items, { at: '2026-11-07', face })
  const doc = {
    $comment:
      '屏级契约定向回归基线(门 299 C1-C4)。只许新增条目:存量问题在此登记后不红,新增命中才红;删条目=放宽判据。',
    at: '2026-11-07',
    face,
    entries: merged.entries,
  }
  writeFileSync(join(root, CONTRACT_BASELINE), JSON.stringify(doc, null, 2) + '\n', 'utf8')
  log(
    `✅ 已写屏级契约基线 ${CONTRACT_BASELINE}:保留 ${merged.kept} 条 + 新增 ${merged.added} 条 = ${merged.entries.length} 条(面=${face})`,
  )
  return 0
}

function run(root, face) {
  const ledger = loadLedgerRows(root)
  const { rows, shared, pageCount, registryCount } = classifyMiniappPages(root, face, ledger)
  const badLedger = validateLedger(ledger)
  const { reds, advisories, stats } = evaluateRatchet(rows, ledger)
  const contractEval = evaluateContractRatchet(contractItemsOf(rows), loadContractBaseline(root))
  reds.push(...contractEval.reds)
  advisories.push(...contractEval.advisories)
  stats.contract = contractEval.stats
  for (const b of badLedger) reds.push({ rule: 'S0', why: b.why, row: b.row })
  const undeterminedRows = rows.filter((r) => r.impl === 'undetermined')
  stats.face = face
  stats.shared = shared.length
  stats.registryEntries = registryCount
  stats.inScopePages = pageCount

  if (explainMode) {
    console.log(
      JSON.stringify(
        {
          face,
          copy: rows
            .filter((r) => r.impl === 'copy')
            .map((r) => ({
              route: r.route,
              file: r.file,
              loc: r.loc,
              mapStatus: r.mapStatus,
              reasonClass: r.reasonClass,
              declaredSpecs: r.declaredSpecs,
              businessJsx: r.businessJsx,
              duplicateUi: r.duplicateUi,
              injectedProps: r.injectedProps,
              note: r.note,
            })),
          notApplicable: rows
            .filter((r) => r.impl === 'not-applicable')
            .map((r) => ({ route: r.route, note: r.note })),
          rejectedNotApplicable: rows
            .filter((r) => r.notApplicableRejected)
            .map((r) => ({ route: r.route, note: r.note })),
          undetermined: undeterminedRows.map((r) => ({ route: r.route, file: r.file, note: r.note })),
          contract: rows
            .filter((r) => r.contract?.inScope && isContractHit(r.contract))
            .map((r) => ({
              route: r.route,
              file: r.file,
              state: r.contract.state,
              reason: r.contract.reason,
              declared: r.contract.declared,
              buckets: r.contract.buckets,
            })),
        },
        null,
        2,
      ),
    )
    return reds.length ? 1 : 0
  }

  if (jsonMode) {
    console.log(JSON.stringify({ stats, reds, advisories, undetermined: undeterminedRows.map((r) => ({ route: r.route, note: r.note })) }, null, 2))
  } else {
    log(`判定面                  : ${face}`)
    log(`共享屏(真相源)          : ${stats.shared}`)
    log(`小程序在册页            : ${stats.pages}(映射登记 ${stats.registryEntries} 条)`)
    log(`判为薄壳(结构+入口双证) : ${stats.shell}`)
    log(
      `判为复制页              : ${stats.copy}(纯复制 ${stats.pureCopy} / 有本地改动 ${stats.localDelta};LOC ${stats.copyLoc}/${stats.totalLoc} = ${(stats.copyRatio * 100).toFixed(1)}%)`,
    )
    log(`判为 not-applicable     : ${stats.notApplicable}`)
    log(`无法判定                : ${stats.undetermined}${undeterminedRows.length ? ' —— ' + undeterminedRows.map((r) => r.route).slice(0, 6).join(', ') : ''}`)
    log(
      `屏级契约(四档)         : 单端 ${stats.contract.byBucket['single-end']} / 死契约 ${stats.contract.byBucket.dead} / 影子 ${stats.contract.byBucket.shadow} / 未解析 ${stats.contract.byBucket.unresolved}(基线 ${stats.contract.baseline} 条,新增 ${stats.contract.newItems},可收紧 ${stats.contract.stale})`,
    )
    log(`存量台账                : ${stats.ledgerRows} 行`)
    if (advisories.length) {
      log('')
      for (const a of advisories.slice(0, 20)) log(`ℹ️ [${a.rule}] ${a.why}`)
      if (advisories.length > 20) log(`ℹ️ 另有 ${advisories.length - 20} 条存量提示(全量见 --json)`)
    }
    if (reds.length) {
      log('')
      for (const r of reds) log(`❌ [${r.rule}] ${r.why}`)
      log(`\n❌ 结论:实现形态判红 ${reds.length} 处`)
    } else {
      log('\n✅ 结论:无新增复制页;存量复制页逐条在册')
    }
  }
  return reds.length === 0 ? 0 : 1
}

function selfTestFn(root) {
  const cases = []
  const add = (name, pass, got) => cases.push({ name, pass, got })

  // 正反例:入口识别(只认 import,不认注释/字符串)
  add('A1 正面:from 子句 import @rn-shells 识别为薄壳', hasShellImport("import { XScreen as X } from '@rn-shells/XScreen'"), true)
  add('A2 反面:仅注释提到 @rn-shells 不算导入', hasShellImport('// 见 @rn-shells/XScreen 生成说明') === false, false)
  add('A3 正面:@ihui/rn-app/features 等价入口可识别', equivalentEntry("import { S as X } from '@ihui/rn-app/features/demo/DemoScreen'", ['packages/app/src/features/demo/DemoScreen.tsx']) !== null, true)
  add('A4 反面:指向未声明屏的等价入口不认', equivalentEntry("import { S as X } from '@ihui/rn-app/features/other/OtherScreen'", ['packages/app/src/features/demo/DemoScreen.tsx']) === null, false)

  // 分类器正反例
  const copy = classifyPage({
    route: 'demo/copy',
    file: 'demo/copy.tsx',
    text: "// 镜像 packages/app/src/features/demo/DemoScreen.tsx\nimport Taro from '@tarojs/taro'\nexport default function P(){ fetch('/api/x').then(()=>{}) }",
    declaredSpecs: ['packages/app/src/features/demo/DemoScreen.tsx'],
    registry: { miniapp: 'demo/copy' },
  })
  add('B1 声明的复制页 ⇒ impl=copy/local-delta', copy.impl === 'copy' && copy.reasonClass === 'local-delta', `${copy.impl}/${copy.reasonClass}`)
  const pure = classifyPage({
    route: 'demo/pure',
    file: 'demo/pure.tsx',
    text: "// 对齐 RN DemoScreen\nimport { View } from '@tarojs/components'\nexport default function P(){ return null }",
    declaredSpecs: ['packages/app/src/features/demo/DemoScreen.tsx'],
    registry: null,
  })
  add('B2 纯布局复制 ⇒ impl=copy/pure-copy', pure.impl === 'copy' && pure.reasonClass === 'pure-copy', `${pure.impl}/${pure.reasonClass}`)
  const shell = classifyPage({
    route: 'demo/shell',
    file: 'demo/shell.tsx',
    text: "// 镜像 packages/app/src/features/demo/DemoScreen.tsx\nimport { DemoScreen as S } from '@rn-shells/DemoScreen'\nexport default S",
    declaredSpecs: ['packages/app/src/features/demo/DemoScreen.tsx'],
    registry: { miniapp: 'demo/shell' },
  })
  add('B3 已 import 壳 ⇒ impl=shell', shell.impl === 'shell', shell.impl)
  add('B4 未声明页不在射程 ⇒ impl=plain', classifyPage({ route: 'demo/plain', file: 'demo/plain.tsx', text: 'export default 1' }).impl === 'plain', true)
  add('B5 正文读不到 ⇒ undetermined(不折绿)', classifyPage({ route: 'demo/x', file: 'demo/x.tsx', text: null }).impl === 'undetermined', true)
  add('B6 页面文件缺失 ⇒ undetermined', classifyPage({ route: 'demo/y', file: null, text: null }).impl === 'undetermined', true)

  // 棘轮正反例
  const ledgerEmpty = []
  const r1 = evaluateRatchet([copy], ledgerEmpty)
  add('C1 阳性对照:复制页不在台账 ⇒ 必红', r1.reds.length === 1, r1.reds.length)
  const r2 = evaluateRatchet([shell], ledgerEmpty)
  add('C2 阴性对照:薄壳页不在台账也不红', r2.reds.length === 0, r2.reds.length)
  const ledgerRow = { route: copy.route, file: copy.file, loc: copy.loc, mapStatus: copy.mapStatus, reasonClass: copy.reasonClass, impl: 'copy' }
  const r3 = evaluateRatchet([copy], [ledgerRow])
  add('C3 存量在册 ⇒ 不红', r3.reds.length === 0, r3.reds.length)
  const r4 = evaluateRatchet([], [ledgerRow])
  add('C4 存量已收敛 ⇒ advisory(S2)', r4.advisories.some((a) => a.rule === 'S2'), r4.advisories.length)

  // S2 真值锁:只有当前判定确实成立才给「可从台账摘除」。下面每条都是“若判据被放宽就必红”。
  const canRetireText = (ev) => ev.advisories.some((a) => /可从台账摘除/.test(a.why))
  const shellRow = { route: shell.route, file: shell.file, loc: shell.loc, mapStatus: shell.mapStatus, reasonClass: null, impl: 'copy' }
  add('C5 正例:薄壳页 + 台账 ⇒ 可摘(业务 JSX≤2/零重复/无单端)', canRetireText(evaluateRatchet([shell], [shellRow])), retirementShortfall(shell))
  add('C6 反例:复制页 + 台账 ⇒ 绝不出现“可摘”(含行数相等时)', !canRetireText(evaluateRatchet([copy], [ledgerRow])), copy.impl)
  add('C7 反例:当前面无对应页 ⇒ 只报无法核对,不给“可摘”', (() => { const ev = evaluateRatchet([], [ledgerRow]); return ev.advisories.some((a) => /无法核对/.test(a.why)) && !canRetireText(ev) })(), 'missing')
  add('C8 反例:薄壳但有重复 UI 段 ⇒ 不给“可摘”', !canRetireText(evaluateRatchet([{ ...shell, duplicateUi: true }], [shellRow])), retirementShortfall({ ...shell, duplicateUi: true }))
  add('C9 反例:薄壳但有单端消费 prop ⇒ 不给“可摘”', !canRetireText(evaluateRatchet([{ ...shell, singleEndProps: ['renderTabBody'] }], [shellRow])), retirementShortfall({ ...shell, singleEndProps: ['renderTabBody'] }))
  add('C10 反例:业务 JSX 超阈值 ⇒ 不给“可摘”', !canRetireText(evaluateRatchet([{ ...shell, businessJsx: 3 }], [shellRow])), retirementShortfall({ ...shell, businessJsx: 3 }))
  add('C11 反例:不在映射射程 ⇒ 不给“可摘”', !canRetireText(evaluateRatchet([{ ...shell, mapStatus: 'none' }], [shellRow])), retirementShortfall({ ...shell, mapStatus: 'none' }))
  add('C12 反例:无入口证据 ⇒ 不给“可摘”', !canRetireText(evaluateRatchet([{ ...shell, shellEntry: null }], [shellRow])), retirementShortfall({ ...shell, shellEntry: null }))

  // 真实仓正反例(证明射程真覆盖,不是只跑合成夹具)
  let real = null
  try {
    real = classifyMiniappPages(root, 'worktree')
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    add('D0 真实仓取材失败 ⇒ 未判定(而不是绿)', true, e.message.slice(0, 60))
  }
  if (real) {
    const realCopy = real.rows.find((r) => r.impl === 'copy')
    const realShell = real.rows.find((r) => r.impl === 'shell' && r.mapStatus !== 'none')
    add('D1 真实仓存在复制页(阳性对照材质)', Boolean(realCopy), realCopy ? `${realCopy.route} ${realCopy.loc}行` : null)
    add('D2 真实复制页不登记 ⇒ evaluateRatchet 必红', Boolean(realCopy) && evaluateRatchet([realCopy], []).reds.length === 1, Boolean(realCopy))
    add('D3 真实仓存在薄壳页(阴性对照材质)', Boolean(realShell), realShell ? realShell.route : null)
    add('D4 真实薄壳页 ⇒ evaluateRatchet 不红', Boolean(realShell) && evaluateRatchet([realShell], []).reds.length === 0, Boolean(realShell))
    if (realShell) {
      // 变异对照:把真实薄壳页的入口 import 与声明屏渲染一并摘掉,分类必须翻成 copy
      // (证明判定的是实现而非路径名)。只摘 import 不算退出入口 —— 新判据的入口双证里
      // 「实际渲染声明屏」仍成立,单摘 import 会停留在 shell,那是对照失效而不是口径回退。
      const text = realShell.file ? loadText(root, realShell.file) : null
      add('D5a 真实薄壳页正文可读', Boolean(text), text ? `${text.length}B` : `${realShell.file} @ ${root}`)
      const baseName = String((realShell.declaredSpecs ?? [])[0] ?? '')
        .split('/')
        .pop()
        .replace(/\.(tsx|ts|jsx|js)$/, '')
      const tagRe = baseName
        ? new RegExp(`<${baseName}\\b[\\s\\S]*?(?:/>|</${baseName}>)`)
        : null
      const mutated = text
        ? text
            .split('\n')
            .filter((l) => !/from\s*['"]@rn-shells/.test(l) && !/@ihui\/rn-app\/features/.test(l))
            .join('\n')
            .replace(tagRe ?? /$^/, '')
        : null
      const m = mutated === null ? null : classifyPage({ route: realShell.route, file: realShell.file, text: mutated, declaredSpecs: realShell.declaredSpecs, registry: { miniapp: realShell.route } })
      add('D5 变异对照:摘掉真实薄壳页的 import 与声明屏渲染 ⇒ 翻红为 copy', Boolean(m) && m.impl === 'copy', m ? `${m.impl}/${m.reasonClass}` : null)
      const putBack = mutated === null ? null : classifyPage({ route: realShell.route, file: realShell.file, text, declaredSpecs: realShell.declaredSpecs, registry: { miniapp: realShell.route } })
      add('D6 还原对照:原正文 ⇒ 仍为 shell', Boolean(putBack) && putBack.impl === 'shell', putBack ? putBack.impl : null)
    }
    const und = real.rows.filter((r) => r.impl === 'undetermined')
    add('D7 未判定桶单列且不折绿(只报数)', true, und.length)
    // 真值锁:真实仓每一条「可从台账摘除」都必须逐条满足 strict 证据;若有人把复制页
    // 或证据不全的页放进可摘名单,这条必须红(阴性对照 = 真实复制页 + 其台账行)。
    const realLedger = loadLedgerRows(root)
    const realEv = evaluateRatchet(real.rows, realLedger)
    const retireLines = realEv.advisories.filter((a) => /可从台账摘除/.test(a.why))
    const retireOk = retireLines.every((a) => {
      const route = a.why.slice(a.why.lastIndexOf(': ') + 2)
      return retirementShortfall(real.rows.find((r) => r.route === route)) === null
    })
    add('D8 真实仓「可摘」逐条有据(≤2/零重复/无单端)', retireOk, `${retireLines.length} 条`)
    const realCopyRow = real.rows.find((r) => r.impl === 'copy')
    const realLedgerRow = realLedger.find((l) => l.route === realCopyRow?.route)
    add(
      'D9 阴性对照:真实复制页即使有台账也不得出现“可摘”',
      Boolean(realCopyRow) && !canRetireText(evaluateRatchet([realCopyRow], [realLedgerRow ?? {}])),
      realCopyRow ? `${realCopyRow.route}/${realCopyRow.businessJsx}` : null,
    )
  }

  // 取不到映射表/读不到文件 ⇒ exit 2 路径(不记绿)
  let threw = false
  try {
    loadRegistry(root, 'worktree', 'scripts/data/__definitely_not_a_registry__.json')
  } catch (e) {
    threw = e instanceof Undetermined
  }
  // F 组:屏级契约四档 + 提前 return 拆除的覆盖差异(2026-11-07)。
  const contractSpec = 'packages/app/src/features/demo/DemoScreen.tsx'
  const sharedContract = `interface DemoScreenProps { title: string; flag: boolean; deadOne?: string; deadButUsed?: string }
export default function DemoScreen({ title, flag, deadButUsed }: DemoScreenProps) {
  return <View><Text>{title}</Text><Text>{deadButUsed}</Text></View>
}`
  const pageContract = `import { DemoScreen } from '@rn-shells/DemoScreen'\nexport default () => <DemoScreen title={title} />`
  const rnContract = `import { DemoScreen } from '@ihui/rn-app'\nexport const R = () => <DemoScreen title={'x'} flag={true} extraProp={'z'} />`
  const contract = analyzeScreenContract({ pageText: pageContract, sharedText: sharedContract, rnText: rnContract, specs: [contractSpec] })
  const bucketNames = (b) => (contract.buckets[b] ?? []).map((x) => x.prop).sort()
  add('F1 四档:仅一端传 ⇒ single-end', JSON.stringify(bucketNames('single-end')) === JSON.stringify(['flag']), bucketNames('single-end'))
  add('F2 四档:声明两端都没传且屏内未消费 ⇒ dead', JSON.stringify(bucketNames('dead')) === JSON.stringify(['deadOne']), bucketNames('dead'))
  add('F3 四档:消费端传契约里不存在的 prop ⇒ shadow', JSON.stringify(bucketNames('shadow')) === JSON.stringify(['extraProp']), bucketNames('shadow'))
  add('F4 阴性对照:屏内已消费的声明不得误报 dead', !bucketNames('dead').includes('deadButUsed'), bucketNames('dead'))
  const shadowType = analyzeScreenContract({
    pageText: pageContract,
    sharedText: 'export default function DemoScreen({ flag }: { flag: boolean }) { return <View>{flag ? 1 : 2}</View> }',
    rnText: "import { DemoScreen } from '@ihui/rn-app'\nexport const R = () => <DemoScreen flag={() => 1} />",
    specs: [contractSpec],
  })
  add('F5 四档:声明 boolean 却传函数 ⇒ shadow', shadowType.buckets.shadow.some((x) => x.prop === 'flag' && /声明为 boolean/.test(x.why)), shadowType.buckets.shadow)
  const unknownKind = analyzeScreenContract({
    pageText: "import { DemoScreen } from '@rn-shells/DemoScreen'\nexport default () => <DemoScreen onPress={() => {}} />",
    sharedText: 'export default function DemoScreen({ onPress }: { onPress: OnPress }) { return <View>{onPress ? 1 : 2}</View> }',
    rnText: "import { DemoScreen } from '@ihui/rn-app'\nexport const R = () => <DemoScreen onPress={'oops'} />",
    specs: [contractSpec],
  })
  add('F6 阴性对照:声明语义不可静态归类(unknown)不得武断报 shadow', unknownKind.buckets.shadow.length === 0, unknownKind.buckets.shadow)
  const unresolvedContract = analyzeScreenContract({
    pageText: pageContract,
    sharedText: null,
    rnText: rnContract,
    specs: [contractSpec],
  })
  add('F7 四档:共享屏读不到 ⇒ unresolved(不折绿)', unresolvedContract.state === 'unresolved' && unresolvedContract.buckets.unresolved[0]?.prop === 'shared-unreadable', unresolvedContract.reason)
  const noElement = analyzeScreenContract({ pageText: 'export default () => null', sharedText: sharedContract, rnText: rnContract, specs: [contractSpec] })
  add('F8 四档:页面未渲染共享屏 ⇒ unresolved(page-no-element)', noElement.buckets.unresolved[0]?.prop === 'page-no-element', noElement.reason)

  // 拆提前 return 覆盖差异:businessJsx>2 的复制页现在也必须带 dup/单端/契约证据(旧实现此处为 null)。
  const cutShared = `export default function DemoScreen({ renderX }: { renderX: () => void }) {
  return <View className="hero"><Text>Hi</Text></View>
}`
  const cutPage = `import { DemoScreen } from '@rn-shells/DemoScreen'\nexport default function P() {
  return <View><View className="hero"><Text>Hi</Text></View><Text>a</Text><Text>b</Text><DemoScreen renderX={<View />} renderY={<Text />} /></View>
}`
  const cutRn = `import { DemoScreen } from '@ihui/rn-app'\nexport const R = () => <DemoScreen renderX={() => null} />`
  const cutRow = classifyPage({
    route: 'demo/cut',
    file: 'demo/cut.tsx',
    text: cutPage,
    declaredSpecs: [contractSpec],
    analysisSpecs: [contractSpec],
    sharedText: cutShared,
    rnText: cutRn,
  })
  add(
    'F9 拆 return:业务 JSX>2 的复制页仍带 duplicateUi 证据(旧实现为 null)',
    cutRow.impl === 'copy' && cutRow.duplicateUi === true,
    `${cutRow.impl}/${String(cutRow.duplicateUi)}`,
  )
  add(
    'F10 拆 return:同一复制页仍带 singleEndProps 证据(旧实现为 null)',
    Array.isArray(cutRow.singleEndProps) && cutRow.singleEndProps.includes('renderY'),
    cutRow.singleEndProps,
  )
  add('F11 拆 return:同一复制页仍带四档契约证据', cutRow.contract?.inScope === true && cutRow.contract.state === 'ok', cutRow.contract?.state)
  const noEntryPage = `// 镜像 ${contractSpec}\nexport default function P() { return <View><Text>x</Text></View> }`
  const noEntryRow = classifyPage({
    route: 'demo/no-entry',
    file: 'demo/no-entry.tsx',
    text: noEntryPage,
    declaredSpecs: [contractSpec],
    sharedText: cutShared,
    rnText: cutRn,
  })
  add('F12 拆 return:未接入口的复制页也跑契约核对(不早退)', noEntryRow.contract?.inScope === true, noEntryRow.contract?.state)

  // 回归基线:存量入册不红、新增红、去掉基线条目只给可收紧、非法基线红。
  const baseItems = [
    { route: 'demo/cut', bucket: 'single-end', prop: 'renderX', why: '仅小程序页传,RN 未传' },
    { route: 'demo/cut', bucket: 'shadow', prop: 'extraProp', why: '消费端传了契约里不存在的 prop' },
  ]
  const g1 = evaluateContractRatchet(baseItems, baseItems)
  add('G1 基线逐条在册 ⇒ 零新增红', g1.reds.length === 0, g1.reds.length)
  const g2 = evaluateContractRatchet([...baseItems, { route: 'demo/new', bucket: 'dead', prop: 'x', why: '声明未消费' }], baseItems)
  add('G2 新增命中 ⇒ 必红(C2)', g2.reds.some((r) => r.rule === 'C2'), g2.reds.map((r) => r.rule))
  const g3 = evaluateContractRatchet([], baseItems)
  add('G3 基线条目当前面无命中 ⇒ 只给可收紧(C5),不红', g3.reds.length === 0 && g3.advisories.some((a) => a.rule === 'C5'), `${g3.reds.length}/${g3.advisories.length}`)
  const g4 = evaluateContractRatchet(baseItems, [{ route: 'x', bucket: 'bogus', prop: 'p', why: 'w' }])
  add('G4 基线 bucket 非法 ⇒ 红(C0)', g4.reds.some((r) => r.rule === 'C0'), g4.reds.map((r) => r.rule))
  const merged = mergeContractBaseline(
    [{ route: 'demo/cut', bucket: 'dead', prop: 'old', why: '历史原文' }],
    [{ route: 'demo/cut', bucket: 'dead', prop: 'old', why: '想改写成新理由' }, { route: 'demo/cut', bucket: 'dead', prop: 'new', why: '新增' }],
  )
  add(
    'G5 基线只许新增:已有条目 why 原样保留,新条目追加',
    merged.kept === 1 && merged.added === 1 && merged.entries[0].why === '历史原文',
    `${merged.kept}/${merged.added}/${merged.entries[0]?.why}`,
  )

  add('E1 映射表读不到 ⇒ Undetermined(exit 2 语义)', threw, threw)
  let faceThrew = false
  try {
    resolveFace(['--staged', '--worktree'])
  } catch (e) {
    faceThrew = e instanceof Undetermined
  }
  add('E2 取材面不明 ⇒ Undetermined', faceThrew, faceThrew)
  add('E3 台账行键稳定(同 route+file ⇒ 同 key)', ledgerKey({ route: 'a', file: 'b' }) === ledgerKey({ route: 'a', file: 'b' }), true)

  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.got !== undefined ? ` — ${JSON.stringify(c.got)}` : ''}`)
  }
  console.log(`\n自检 ${cases.length} 例,失败 ${bad}`)
  return bad === 0 ? 0 : 1
}

function loadText(root, rel) {
  return readFaceOne(root, 'worktree', rel)
}

/** §22d:直执行才跑主流程;被测试 import 时只导出。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

export const __test__ = { validateLedger, emit, run, selfTestFn, loadContractBaseline, emitContractBaselineFile }

if (isDirectRun) {
  try {
    const face = resolveFace(argv)
    if (selfTest) process.exit(selfTestFn(ROOT))
    if (emitBaseline) process.exit(emit(ROOT, face))
    if (emitContractBaseline) process.exit(emitContractBaselineFile(ROOT, face))
    process.exit(run(ROOT, face))
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 未判定: ${e.message}(取不到输入不记绿也不冒红,§0.3)`)
      process.exit(2)
    }
    throw e
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
