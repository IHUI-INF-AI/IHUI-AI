#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端转壳「解锁经济账」只读尺 —— 见文件末尾头注(立因/三态/接线口径)
/* eslint-disable no-console -- 只读报告工具,产出就是给人看的 stdout */
/**
 * report-cross-end-unlock-economy.mjs — 把「补一个 adapter 能救几页」从口算变成机器判据。
 *
 * 立因(2026-11-05 机主派单):本仓要把小程序端内手写页转成承载 RN 壳的薄壳页。既有两件器物
 * `plan-hand-mirror-conversion.mjs`(规划器,判每页被哪些能力阻塞)与
 * `upgrade-miniapp-shell-pages.mjs`(逐页转壳)之间缺一把经济账尺,于是三个坑天天踩:
 *   坑① 频次 ≠ 解锁数。规划器的 blockers 表按页聚合频次,读的人自然估成「补 X 能救 N 页」;
 *        正解是「一页解锁 ⟺ 该页 extras 全集 ⊆ 补齐集」。现读(43 页档):补 `@/api`(30 页命中)
 *        真解锁 **0 页** —— 本尺把这条反直觉事实单独打印,并同时打「按频次估会得几页」作对照。
 *   坑② 文案缺口分两型、差一个量级。规划器决策数走 `cjkNotRenderedOnScreen`(作用域 = 共享屏
 *        ⊕ 承载壳消费的键在词包里的值,刻意收紧);整包口径走 `hardcodedCjkNotInMessages`。
 *        两者之差 = 文案早已在词包里、只是该屏不消费那个键 ⇒ **零新词条可解,属键接线问题**;
 *        整包那个数才是真需要补五语言词条的量。本尺逐页给 scoped/pack/差 三列并分桶合计。
 *   坑③ 壳名必须用规划器选定那枚(`pickCarrierShell`:同名优先、异名兜底)。按 spec 文件名直推壳名
 *        会失真。本尺对异名承载壳同时给「正确壳口径」与「spec 名直推口径」两读并把失真量化。
 *
 * 三态(§0.3,取不到不猜、不记绿也不冒红):
 *   exit 0 = 出结论;exit 1 = 实质判红(两把口径对同一页的阈值判定自相矛盾,逐页点名);
 *   exit 2 = 未判定(规划器输出非法 JSON / rows 为空 / hand=0 / rows 被 slice(0,400) 截断 /
 *            词包取不到或解析不了)。未判定时 stdout **不出现**结论行键名。
 *
 * 接线口径:**刻意不进提交链、不进 CI、不注册进 guardian-runner**(§12e:判内容状态的只读尺
 * 挂成提交门即恒红门)。本文头注不自称「已接线」—— 门 89 R1 抓的正是「头注声称已接而权威
 * 注册点零命中」,本尺就是「零命中」那一型,所以照实写「未接线」。
 *
 * 判据一律 import(§0.6 单一真相源 / §22c 复制判据必然漂移):本文件零自写中文取数正则、
 * 零自写键集/词包逻辑;`--self-test` 与镜像测试只用夹具喂同一批 import 进来的生产判据。
 * 用法:node scripts/report-cross-end-unlock-economy.mjs [--json|--self-test]
 *       [--face head|staged|worktree] [--plan-json <path|->] [--max-k <n>]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskComments } from './lib/code-mask.mjs'
import {
  screenConsumedKeys,
  messagesValuesByKeys,
  messagesDocs,
  hardcodedCjkNotInMessages,
  cjkNotRenderedOnScreen,
  MESSAGES_REL,
  SHARED_MESSAGES_REL,
  HARDCODED_TEXT_LIMIT,
  HARDCODED_TEXT_TOKEN,
} from './plan-hand-mirror-conversion.mjs'
import { shellTargetRel, RN_SCREENS_DIR } from './lib/rn-shell-refs.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { batchReadTexts } from './check-miniapp-mirror-fidelity.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN_SCRIPT = 'scripts/plan-hand-mirror-conversion.mjs'
const CONCLUSION_KEY = 'UNLOCK-ECONOMY'
const MAX_K_DEFAULT = 12

/** 未判定:一律走这一个出口,stdout 恒不含结论行键名(§0.3)。 */
class Undetermined extends Error {}

function runPlannerJson() {
  // §12g:派生必须显式 stdio + windowsHide,否则本机稳定 EBUSY。规划器底部有 isDirectRun 守卫,
  // spawn 它不会误触发写盘;规划器自身只读(其 main 恒按 head 面派生,见本尺 faceNote),本尺零写盘。
  return execFileSync(process.execPath, [PLAN_SCRIPT, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

export function parsePlan(stdout) {
  let plan
  try {
    plan = JSON.parse(String(stdout))
  } catch (e) {
    throw new Undetermined(`规划器输出非合法 JSON(${e?.message ?? e})`)
  }
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.rows)) {
    throw new Undetermined('规划器输出缺 rows 数组,判不了')
  }
  if (plan.rows.length === 0) throw new Undetermined('规划器 rows 枚数为 0(枚举到 0 判死不记绿)')
  if (Number(plan.hand) === 0) throw new Undetermined('规划器 hand=0(没有手写页可判,不记绿)')
  // 规划器 --json 把 rows `.slice(0,400)` 且过滤掉 convertible ⇒ 必须自证枚举完整,被截断就是未判定
  const accounted = plan.rows.length + Number(plan.counts?.convertible ?? 0)
  if (accounted !== Number(plan.hand)) {
    throw new Undetermined(
      `枚举不完整:rows=${plan.rows.length} + convertible=${plan.counts?.convertible ?? 0} = ${accounted} ≠ hand=${plan.hand}(规划器 slice(0,400) 截断风险)`,
    )
  }
  if (!Array.isArray(plan.blockers)) {
    throw new Undetermined('规划器输出缺 blockers 频次表,B 段经济账没有输入')
  }
  return plan
}

/** 词包可用性:任一份解析不了 ⇒ 未判定(不回落"部分能用",那是拿坏输入冒绿)。 */
export function resolveMessages(messagesText) {
  const docs = messagesDocs(messagesText)
  if (docs.length === 0) {
    throw new Undetermined(`词包取不到(${MESSAGES_REL} ⊕ ${SHARED_MESSAGES_REL} 全空)`)
  }
  for (let i = 0; i < docs.length; i++) {
    try {
      const parsed = JSON.parse(docs[i])
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object')
    } catch (e) {
      throw new Undetermined(`词包第 ${i + 1} 份解析失败(${e?.message ?? e})`)
    }
  }
  return { docs, packText: docs.join('\n') }
}

/**
 * 单页两口径读数。装配照抄规划器口径(1021-1029 行):作用域键集 = 共享屏 ⊕ 承载壳;
 * 键集为空或词包取不到作用域值 ⇒ 退回整包口径作为该页决策数(不发明第三种口径)。
 */
export function readPageCopy({ pageText, sharedText, shellText, messagesText, packText }) {
  const page = maskComments(String(pageText ?? ''))
  const keys = new Set([
    ...screenConsumedKeys(maskComments(String(sharedText ?? ''))),
    ...screenConsumedKeys(maskComments(String(shellText ?? ''))),
  ])
  const hay = keys.size > 0 ? messagesValuesByKeys(messagesText, keys) : null
  const scoped =
    hay === null ? hardcodedCjkNotInMessages(page, packText) : cjkNotRenderedOnScreen(page, hay)
  const pack = hardcodedCjkNotInMessages(page, packText)
  return {
    keyCount: keys.size,
    scoped,
    pack,
    diff: scoped - pack,
    over: scoped > HARDCODED_TEXT_LIMIT,
    mode: hay === null ? 'pack-fallback' : 'scoped',
  }
}

/** 解锁判据:该页 extras 全集 ⊆ 补齐集,一个都不许多(这是坑①的唯一正解)。 */
export function unlockPagesBySet(rows, fillSet) {
  return rows
    .filter((r) => Array.isArray(r.extras) && r.extras.every((e) => fillSet.has(e)))
    .map((r) => r.route)
}

/** 经济账曲线:blockers 按频次降序取前 K,逐 K 算真解锁;同时留「按频次估」的对照。 */
export function economyCurve(rows, blockers, maxK) {
  if (!Array.isArray(blockers)) throw new Undetermined('规划器 blockers 不是数组,经济账判不了')
  for (const b of blockers) {
    if (!Array.isArray(b) || typeof b[0] !== 'string' || !Number.isFinite(Number(b[1]))) {
      throw new Undetermined(
        `规划器 blockers 形态不正(期望 [[符号名, 页次], …],实到 ${JSON.stringify(b)})`,
      )
    }
  }
  // 频次降序,**平票保持规划器原序**(V8 sort 稳定):排序口径的单源是规划器的 blockedFrequency,
  // 本尺不另立次级字典序 —— 实测二者会让 K=12 的补齐集换掉一枚符号,组合最优从 18 页变 20 页。
  const sorted = [...blockers].map(([t, n]) => [t, Number(n)]).sort((a, b) => b[1] - a[1])
  const curve = []
  for (let k = 1; k <= Math.min(maxK, sorted.length); k++) {
    const fill = sorted.slice(0, k).map(([t]) => t)
    const routes = unlockPagesBySet(rows, new Set(fill))
    curve.push({ k, fill, unlocked: routes.length, routes })
  }
  const best = curve.reduce((a, c) => (a === null || c.unlocked > a.unlocked ? c : a), null)
  const singles = sorted.slice(0, 3).map(([tok, freq]) => ({
    token: tok,
    freqEstimate: freq,
    realUnlock: unlockPagesBySet(rows, new Set([tok])).length,
  }))
  return { sorted, curve, best, singles }
}

/**
 * 异名承载壳的失真量化:同一页在「规划器选定壳」与「spec 文件名直推壳名」两口径下的读数差。
 * 直推口径下壳文件不存在时,规划器会整页判成 no-shell(连作用域都退化成只剩共享屏键)。
 */
export function aliasDistortion(row, correct, directRead, directShellExists) {
  const specBase = row.spec
    .split('/')
    .pop()
    .replace(/\.[jt]sx$/, '')
  return {
    route: row.route,
    spec: row.spec,
    specBase,
    carrierShell: row.shell,
    directShellRel: shellTargetRel(specBase),
    directShellExists,
    correctKeys: correct.keyCount,
    correctScoped: correct.scoped,
    correctPack: correct.pack,
    directKeys: directRead.keyCount,
    directScoped: directRead.scoped,
    directPack: directRead.pack,
    scopedDelta: directRead.scoped - correct.scoped,
    plannerKindIfDirect: directShellExists ? 'page-only-capability(照旧)' : 'no-shell',
  }
}

/** 主判据:规划器产出 + 三面正文 ⇒ 三段结论。纯内存、零写盘。 */
export function buildReport({ plan, face, ctx }) {
  const rows = plan.rows
  const pages = rows.map((r) => {
    const pageText = ctx.pageTextOf(r)
    const sharedText = ctx.sharedTextOf(r)
    const shellText = r.shell ? (ctx.shellTexts.get(shellTargetRel(r.shell)) ?? '') : ''
    const read = readPageCopy({
      pageText,
      sharedText,
      shellText,
      messagesText: ctx.messagesText,
      packText: ctx.packText,
    })
    // 坑③:异名承载壳(spec 文件名 ≠ 规划器选定壳名)另走"直推口径"复量一遍,把失真量出来
    const specBase = r.spec
      .split('/')
      .pop()
      .replace(/\.[jt]sx$/, '')
    const isAlias = Boolean(r.shell) && r.shell !== specBase
    let alias = null
    if (isAlias) {
      const directRel = shellTargetRel(specBase)
      const directText = ctx.shellTexts.get(directRel)
      alias = aliasDistortion(
        r,
        read,
        readPageCopy({
          pageText,
          sharedText,
          shellText: directText ?? '',
          messagesText: ctx.messagesText,
          packText: ctx.packText,
        }),
        directText !== null && directText !== undefined,
      )
    }
    return { row: r, read, isAlias, alias, tokenFromPlanner: hasToken(r) }
  })

  // 判红条件要具体:文案闸只在规划器**真跑到它**的那一型里生效(page-only-capability 才轮到能力枚举;
  // no-shell / shell-not-rendering / undetermined 三型在闸之前就 return 了)⇒ 只比 page-only-capability,
  // 否则会把"闸没跑"读成"闸判绿"。
  const crossChecked = pages.filter((x) => x.row.kind === 'page-only-capability')
  const contradictions = crossChecked
    .filter((x) => x.tokenFromPlanner !== x.read.over)
    .map((x) => ({
      route: x.row.route,
      plannerToken: x.tokenFromPlanner,
      myOver: x.read.over,
      scoped: x.read.scoped,
      limit: HARDCODED_TEXT_LIMIT,
    }))

  const copyPages = pages.filter((x) => x.tokenFromPlanner)
  const scopedSum = copyPages.reduce((s, x) => s + x.read.scoped, 0)
  const packSum = copyPages.reduce((s, x) => s + x.read.pack, 0)

  const { curve, best, singles, sorted } = economyCurve(rows, plan.blockers ?? [], ctx.maxK)

  const conclusion = {
    pages: Number(plan.hand),
    convertible: Number(plan.counts?.convertible ?? 0),
    copyBlocked: copyPages.length,
    copyKeyMisaligned: scopedSum - packSum,
    copyTrulyMissing: packSum,
    maxUnlockByAdapterCombo: best === null ? null : best.unlocked,
    maxUnlockK: best === null ? null : best.k,
    face,
    carrierAliasPages: pages.filter((x) => x.isAlias).length,
    directShellScopedOverstate: pages
      .filter((x) => x.alias)
      .reduce((s, x) => s + x.alias.scopedDelta, 0),
    copyShortCircuit: copyPages.filter((x) => x.row.extras.length === 1).length,
    crossCheckedPages: crossChecked.length,
  }

  return {
    status: contradictions.length > 0 ? 'red' : 'ok',
    face,
    summary: {
      pairs: plan.pairs,
      hosted: plan.hosted,
      hand: plan.hand,
      blockersTop: sorted.slice(0, 5),
    },
    pages,
    curve,
    singles,
    contradictions,
    conclusion,
  }
}

const hasToken = (r) => Array.isArray(r.extras) && r.extras.includes(HARDCODED_TEXT_TOKEN)

/** 只读取面输入;取不到一律抛 Undetermined(不在这里做兜底猜测)。 */
export function loadContext({ plan, face, maxK }) {
  let mp
  try {
    mp = cov.collectMiniapp(face)
  } catch (e) {
    throw new Undetermined(`小程序页面枚举取不到(${e?.message ?? e})`)
  }
  const byRoute = new Map(mp.map((p) => [p.route, p]))
  if (byRoute.size === 0) throw new Undetermined('小程序在册页枚举为 0,判不了')
  const specs = [...new Set(plan.rows.map((r) => r.spec))]
  const sharedTexts = batchReadTexts(face, specs)
  const shellNames = plan.rows.map((r) => r.shell).filter(Boolean)
  const aliasDirectRels = plan.rows
    .map((r) =>
      r.spec
        .split('/')
        .pop()
        .replace(/\.[jt]sx$/, ''),
    )
    .map((n) => shellTargetRel(n))
  const shellRels = [...new Set([...shellNames.map((n) => shellTargetRel(n)), ...aliasDirectRels])]
  const shellTexts = batchReadTexts(face, shellRels)
  // 真守卫(刻意不写成"shellRels 是否落在 RN_SCREENS_DIR 下"—— shellTargetRel 是本目录的唯一
  // 生产者,那条恒真,零信息量)。这里量的是**取数结果**:规划器给某页选定了一枚壳,而该壳在
  // 本面读不到 ⇒ 这一页的作用域键集装配不出来,拿空壳正文算出的 scoped 只会虚高(把"读不到"
  // 说成"该屏不消费")。取不到不猜(§0.3)⇒ 整轮未判定并逐条点名。
  const unreadableShells = plan.rows.filter(
    (r) => r.shell && shellTexts.get(shellTargetRel(r.shell)) === null,
  )
  if (unreadableShells.length > 0) {
    throw new Undetermined(
      `规划器选定壳在本面(${face})读不到 ${unreadableShells.length} 枚,作用域键集装配不出:${unreadableShells
        .map((r) => `${r.route}→${RN_SCREENS_DIR}/${r.shell}.tsx`)
        .join(', ')} ⇒ 不拿空壳正文算账`,
    )
  }
  const msgBatch = batchReadTexts(face, [MESSAGES_REL, SHARED_MESSAGES_REL])
  const messagesText = [msgBatch.get(MESSAGES_REL) ?? '', msgBatch.get(SHARED_MESSAGES_REL) ?? '']
  const { packText } = resolveMessages(messagesText)
  if (sharedTexts.size === 0) throw new Undetermined('共享屏正文一枚都没取到,判不了')
  return {
    pageTextOf: (r) => byRoute.get(r.route)?.text ?? null,
    sharedTextOf: (r) => sharedTexts.get(r.spec) ?? '',
    shellTexts,
    messagesText,
    packText,
    maxK,
  }
}

export function collectPlan({ planJson, face }) {
  if (planJson !== undefined && planJson !== null && planJson !== '') {
    const raw = planJson === '-' ? readStdin() : readFileSync(path.resolve(ROOT, planJson), 'utf8')
    const plan = parsePlan(raw)
    if (face !== 'head') {
      // 规划器只产 head 面 rows;喂外来 plan 时不假装我按别的面重算了 rows
      plan.__faceNote = `plan rows 由 --plan-json 注入(face 标签仍打 ${face},仅本尺三面读数按该面取)`
    }
    return plan
  }
  return parsePlan(runPlannerJson())
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch (e) {
    throw new Undetermined(`stdin 取不到规划器 JSON(${e?.message ?? e})`)
  }
}

/* ---------------------------------------------------------------- CLI 渲染 */

export function renderHuman(rep) {
  const L = []
  L.push(
    `[report-cross-end-unlock-economy] 面=${rep.face} 对=${rep.summary.pairs} 已承载=${rep.summary.hosted} 手写=${rep.summary.hand}`,
  )
  L.push('')
  L.push('=== A 段 逐页两口径差分(scoped = 该屏消费的键值里没有;pack = 整张词包也没有) ===')
  L.push(
    `  ${'route'.padEnd(34)} ${'shell'.padEnd(26)} 键   scoped  pack   差=键不对齐  超${HARDCODED_TEXT_LIMIT}`,
  )
  for (const p of rep.pages) {
    const r = p.row
    L.push(
      `  ${String(r.route).padEnd(34)} ${String(r.shell ?? '-').padEnd(26)} ${String(p.read.keyCount).padStart(3)}  ${String(
        p.read.scoped,
      ).padStart(
        5,
      )} ${String(p.read.pack).padStart(5)} ${String(p.read.diff).padStart(7)}  ${p.read.over ? 'YES' : '-'}${p.isAlias ? '  ⟵异名壳' : ''}${hasToken(r) ? '  ⟵文案阻塞' : ''}`,
    )
  }
  const alias = rep.pages.filter((p) => p.alias)
  if (alias.length === 0) {
    L.push('  异名承载壳:本面读 0 枚(规划器全按同名壳选中)')
  } else {
    L.push(
      `  —— 异名承载壳 ${alias.length} 枚(承载壳目录=${RN_SCREENS_DIR}),两口径读数对比(坑③量化):`,
    )
    for (const p of alias) {
      const a = p.alias
      L.push(
        `     ${a.route}:正确壳=${a.carrierShell}(键 ${a.correctKeys}/scoped ${a.correctScoped}) | spec 名直推=${a.specBase}→${a.directShellRel} ${a.directShellExists ? '存在' : '不存在'}(键 ${a.directKeys}/scoped ${a.directScoped}) ⇒ 失真 ${a.scopedDelta >= 0 ? '+' : ''}${a.scopedDelta} 字,直推口径规划器会判「${a.plannerKindIfDirect}」`,
      )
    }
  }
  L.push('')
  L.push(`=== B 段 解锁经济账(解锁 ⟺ 该页 extras 全集 ⊆ 补齐集) ===`)
  L.push('  反直觉事实(必须钉住):')
  for (const s of rep.singles) {
    L.push(`     单补 ${s.token}:按频次估会救 ${s.freqEstimate} 页 ⇒ 真解锁 ${s.realUnlock} 页`)
  }
  L.push('  K 曲线(blockers 按频次降序取前 K):')
  for (const c of rep.curve) {
    L.push(
      `     K=${String(c.k).padStart(2)} 补齐[${c.fill.join(', ')}] ⇒ 真解锁 ${c.unlocked} 页${c.unlocked ? ':' + c.routes.join(',') : ''}`,
    )
  }
  L.push(
    `  组合最优 = ${rep.conclusion.maxUnlockByAdapterCombo} 页 @K=${rep.conclusion.maxUnlockK}(共 ${rep.conclusion.pages} 页手写)`,
  )
  if (rep.conclusion.copyShortCircuit > 0) {
    L.push(
      `  ⚠️ 文案族 ${rep.conclusion.copyShortCircuit} 页在规划器里是**短路**出路(extras 只有文案一枚,能力项未再枚举)⇒ K≥文案项位次的解锁数是**上界**,不是实测。`,
    )
  }
  // 汇总面必须声明自己的盲区(本仓血训:曲线被当成实测值派过单)。本尺不验证"能不能填",
  // 只算"填了以后 extras 是否清空"——这两件事在 blocker 含导航/取数族时并不等价。
  L.push(
    '  ⚠️ 上界第二型:本尺假设每枚 blocker 都存在**合法可填通道**,它不复算 `coveredNavigation` 的逐目标反查、' +
      '也不复算 `apiEndpointsCovered` 的端点重合(那两把判据住规划器/门 237 内部,§0.6 禁止在此重抄)。' +
      '⇒ blocker 含 `Taro.*` 导航或 `@/api*` 取数族的页,数字仍是**上界**:实测反例 = `pkg-shop/vip/details`,' +
      '其唯一 blocker 是 `Taro.navigateTo`,但目标是小程序/H5 独占支付页(jsapi + my.getAuthCode),RN 侧无同物路由' +
      '⇒ 合法通道要么不存在、要么属台账登记面且事实不支持登记,该页"可解锁"为零。看到 K 曲线请连带这一条读。',
  )
  L.push('')
  L.push('=== C 段 结论 ===')
  if (rep.contradictions.length > 0) {
    L.push(`❌ 两把口径自相矛盾 ${rep.contradictions.length} 页(本尺决策数 vs 规划器 extras 记账):`)
    for (const c of rep.contradictions) {
      L.push(
        `   ${c.route}:规划器挂账=${c.plannerToken} 我复算超阈值=${c.myOver}(scoped=${c.scoped})`,
      )
    }
  }
  L.push(conclusionLine(rep.conclusion))
  return L.join('\n')
}

export function conclusionLine(c) {
  return (
    `${CONCLUSION_KEY} pages=${c.pages} convertible=${c.convertible} copyBlocked=${c.copyBlocked} ` +
    `copyKeyMisaligned=${c.copyKeyMisaligned} copyTrulyMissing=${c.copyTrulyMissing} ` +
    `maxUnlockByAdapterCombo=${c.maxUnlockByAdapterCombo}@K=${c.maxUnlockK} face=${c.face} ` +
    `carrierAliasPages=${c.carrierAliasPages} directShellScopedOverstate=${c.directShellScopedOverstate} ` +
    `copyShortCircuit=${c.copyShortCircuit}`
  )
}

/* ---------------------------------------------------------------- self-test */

function fixtureRows() {
  return [
    { route: 'a/one', spec: 'p/OneScreen.tsx', shell: 'OneScreen', extras: ['@/api'], why: '' },
    {
      route: 'a/two',
      spec: 'p/TwoScreen.tsx',
      shell: 'TwoScreen',
      extras: ['@/api', '@/host/on-toast'],
      why: '',
    },
  ]
}

/** 纯内存夹具自检:不落盘、不起子进程、不读面。成对给正反例。 */
export function selfTest() {
  const cases = []
  const P = (name, got, want) =>
    cases.push({ name, got, want, pass: JSON.stringify(got) === JSON.stringify(want) })
  const rows = fixtureRows()
  P(
    'T1 反频次锁:extras=[@/api] 与 [@/api,@/host/on-toast] 两页,只补 @/api ⇒ 解锁 1(按频次估会得 2)',
    unlockPagesBySet(rows, new Set(['@/api'])),
    ['a/one'],
  )
  P(
    'T2 全 combo 锁:补 {@/api,@/host/on-toast} ⇒ 解锁 2',
    unlockPagesBySet(rows, new Set(['@/api', '@/host/on-toast'])),
    ['a/one', 'a/two'],
  )
  P('T3 反例:补一个页上没挂的符号 ⇒ 解锁 0', unlockPagesBySet(rows, new Set(['@/utils/auth'])), [])
  const ec = economyCurve(
    rows,
    [
      ['@/api', 2],
      ['@/host/on-toast', 1],
    ],
    2,
  )
  P(
    'T4 曲线逐 K 解锁数',
    ec.curve.map((c) => c.unlocked),
    [1, 2],
  )
  P(
    'T5 频次估 vs 真解锁(单项;@/host/on-toast 频次 1 而单补它解锁 0 —— 夹具自带同一条反直觉)',
    ec.singles.map((s) => [s.freqEstimate, s.realUnlock]),
    [
      [2, 1],
      [1, 0],
    ],
  )
  P('T6 组合最优', [ec.best.unlocked, ec.best.k], [2, 2])

  // 两口径差分夹具:同一句中文,在词包里**有**、但不住在该屏消费的键下
  const pack = JSON.stringify({
    rendered: { ok: '已被该屏消费的文案' },
    orphan: { tip: '这句话整包里有但屏不消费' },
  })
  const screen = "const t = (k) => k; export const S = () => { t('rendered.ok'); return null }"
  const shell = "export const S2 = () => { t('rendered.ok'); return null }"
  const pageMisaligned = 'const tip = "这句话整包里有但屏不消费"\nexport const P = () => tip'
  const r1 = readPageCopy({
    pageText: pageMisaligned,
    sharedText: screen,
    shellText: shell,
    messagesText: [pack, ''],
    packText: pack,
  })
  P('T7 键不对齐型:scoped>0 且 pack=0(不许报成"需补词条")', [r1.scoped > 0, r1.pack], [true, 0])
  const pageTrulyMissing = 'const tip = "这句话整张词包也没有"\nexport const P = () => tip'
  const r2 = readPageCopy({
    pageText: pageTrulyMissing,
    sharedText: screen,
    shellText: shell,
    messagesText: [pack, ''],
    packText: pack,
  })
  P('T8 阳性对照:真缺词条 ⇒ pack>0', r2.pack > 0, true)
  P(
    'T9 作用域读法对"屏已消费的键"销账',
    readPageCopy({
      pageText: 'const x = "已被该屏消费的文案"\nexport const P = () => x',
      sharedText: screen,
      shellText: shell,
      messagesText: [pack, ''],
      packText: pack,
    }).scoped,
    0,
  )

  // 未判定臂(纯函数侧)
  const und = (fn) => {
    try {
      fn()
      return 'no-throw'
    } catch (e) {
      return e instanceof Undetermined ? 'undetermined' : 'other:' + e?.message
    }
  }
  P(
    'T10 rows 为空 ⇒ 未判定',
    und(() => parsePlan(JSON.stringify({ hand: 0, counts: { convertible: 0 }, rows: [] }))),
    'undetermined',
  )
  P(
    'T11 非法 JSON ⇒ 未判定',
    und(() => parsePlan('not json at all')),
    'undetermined',
  )
  P(
    'T12 rows 被截断(rows+convertible≠hand)⇒ 未判定',
    und(() =>
      parsePlan(
        JSON.stringify({
          hand: 43,
          counts: { convertible: 0 },
          rows: [{ route: 'x', extras: [] }],
        }),
      ),
    ),
    'undetermined',
  )
  P(
    'T13 词包取不到 ⇒ 未判定',
    und(() => resolveMessages(['', ''])),
    'undetermined',
  )
  P(
    'T14 词包解析失败 ⇒ 未判定',
    und(() => resolveMessages(['{坏 json', ''])),
    'undetermined',
  )
  // 未判定臂的出口形态:错误信息里绝不出现结论行键名(取不到输入时既不记绿也不冒红)
  P(
    'T15 未判定不写结论行键名(三臂逐条查)',
    [
      () => parsePlan(JSON.stringify({ hand: 3, counts: { convertible: 0 }, rows: [] })),
      () => parsePlan('nope'),
      () => resolveMessages(['', '']),
    ].map((f) => {
      try {
        f()
        return 'no-throw'
      } catch (e) {
        return String(e && e.message).includes(CONCLUSION_KEY) ? 'leak' : 'clean'
      }
    }),
    ['clean', 'clean', 'clean'],
  )

  // 异名壳失真量化
  const d = aliasDistortion(
    { route: 'a', spec: 'p/CourseTabScreen.tsx', shell: 'CourseScreen' },
    { keyCount: 40, scoped: 10, pack: 4 },
    { keyCount: 12, scoped: 90, pack: 4 },
    false,
  )
  P('T16 直推壳名口径把缺口虚高(失真为正)', d.scopedDelta > 0, true)
  P('T17 壳文件不存在 ⇒ 直推口径规划器判 no-shell', d.plannerKindIfDirect, 'no-shell')

  // buildReport 成对正反例:两把口径自相矛盾 ⇒ status=red;对得上 ⇒ status=ok
  const longCopy = '转壳后这段正文会丢'.repeat(20)
  const heavyPage = `const s = "${longCopy}"\nexport const P = () => s`
  const stubCtx = {
    pageTextOf: () => heavyPage,
    sharedTextOf: () => screen,
    shellTexts: new Map([[shellTargetRel('XScreen'), shell]]),
    messagesText: [pack, ''],
    packText: pack,
    maxK: 3,
  }
  const stubPlan = (extras) => ({
    hand: 1,
    pairs: 1,
    hosted: 0,
    counts: { convertible: 0 },
    blockers: extras.map((t) => [t, 1]),
    rows: [
      {
        route: 'a/heavy',
        spec: 'p/XScreen.tsx',
        shell: 'XScreen',
        kind: 'page-only-capability',
        extras,
      },
    ],
  })
  P(
    'T18 判红臂:超阈值而规划器未挂账 ⇒ status=red + 逐页点名',
    [
      buildReport({ plan: stubPlan([]), face: 'head', ctx: stubCtx }).status,
      buildReport({ plan: stubPlan([]), face: 'head', ctx: stubCtx }).contradictions.length,
    ],
    ['red', 1],
  )
  P(
    'T19 阳性对照:同一页挂了账 ⇒ status=ok',
    buildReport({ plan: stubPlan([HARDCODED_TEXT_TOKEN]), face: 'head', ctx: stubCtx }).status,
    'ok',
  )
  P(
    'T20 闸没跑的型不参与对账(no-shell 不判矛盾)',
    buildReport({
      plan: {
        ...stubPlan([]),
        rows: [{ route: 'a/heavy', spec: 'p/XScreen.tsx', shell: null, kind: 'no-shell' }],
      },
      face: 'head',
      ctx: stubCtx,
    }).contradictions.length,
    0,
  )
  P(
    'T21 C 段两型分账:copyKeyMisaligned 走作用域差、copyTrulyMissing 走整包',
    (() => {
      const rep = buildReport({
        plan: stubPlan([HARDCODED_TEXT_TOKEN]),
        face: 'head',
        ctx: stubCtx,
      })
      return [
        rep.conclusion.copyBlocked,
        rep.conclusion.copyKeyMisaligned,
        rep.conclusion.copyTrulyMissing,
        rep.conclusion.maxUnlockByAdapterCombo,
        rep.conclusion.maxUnlockK,
      ]
    })(),
    [1, 0, 180, 1, 1],
  )
  P(
    'T22 结论行键名顺序与字段齐备',
    conclusionLine(
      buildReport({ plan: stubPlan([HARDCODED_TEXT_TOKEN]), face: 'head', ctx: stubCtx })
        .conclusion,
    ).startsWith(
      `${CONCLUSION_KEY} pages=1 convertible=0 copyBlocked=1 copyKeyMisaligned=0 copyTrulyMissing=180 maxUnlockByAdapterCombo=1@K=1 face=head`,
    ),
    true,
  )
  P(
    'T23 blockers 形态不正(非 [名,次] 成对)⇒ 未判定',
    und(() => economyCurve(rows, ['@/api'], 2)),
    'undetermined',
  )

  console.log(
    cases
      .map(
        (c) =>
          `${c.pass ? '✔' : '✖'} ${c.name}${c.pass ? '' : ` —— 实测 ${JSON.stringify(c.got)} 期望 ${JSON.stringify(c.want)}`}`,
      )
      .join('\n'),
  )
  console.log(`SELF-TEST ${cases.filter((c) => c.pass).length}/${cases.length} 通过`)
  return cases.every((c) => c.pass) ? 0 : 1
}

/* ---------------------------------------------------------------- main */

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  const face = argv.includes('--face') ? argv[argv.indexOf('--face') + 1] : 'head'
  const maxK = argv.includes('--max-k') ? Number(argv[argv.indexOf('--max-k') + 1]) : MAX_K_DEFAULT
  const planJson = argv.includes('--plan-json') ? argv[argv.indexOf('--plan-json') + 1] : undefined
  const asJson = argv.includes('--json')
  const plan = collectPlan({ planJson, face })
  const ctx = loadContext({ plan, face, maxK })
  const rep = buildReport({ plan, face, ctx })
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          status: rep.status,
          face,
          conclusion: rep.conclusion,
          singles: rep.singles,
          curve: rep.curve,
          contradictions: rep.contradictions,
          pages: rep.pages.map((p) => ({
            route: p.row.route,
            shell: p.row.shell,
            spec: p.row.spec,
            extras: p.row.extras,
            read: p.read,
            alias: p.alias,
          })),
        },
        null,
        2,
      ),
    )
  } else {
    console.log(renderHuman(rep))
  }
  return rep.status === 'red' ? 1 : 0
}

/**
 * 未判定的对外形态:stdout **绝不出现**结论行键名(不记绿),机器档给 status=undetermined +
 * conclusion=null(不冒红也不冒绿)。reason 只带诊断文本,不带任何账面计数。
 */
export function undeterminedPayload(e) {
  return { status: 'undetermined', conclusion: null, reason: String(e?.message ?? e) }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const wantJson = process.argv.includes('--json')
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    const und = e instanceof Undetermined ? e : new Undetermined(`异常(${e?.message ?? e})`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    console.error(`UNDETERMINED 未判定(取不到输入不记绿也不冒红,§0.3):${und.message}`)
    if (wantJson) console.log(JSON.stringify(undeterminedPayload(und), null, 2))
    process.exit(2)
  }
}

export const __test__ = {
  Undetermined,
  parsePlan,
  resolveMessages,
  readPageCopy,
  unlockPagesBySet,
  economyCurve,
  aliasDistortion,
  buildReport,
  loadContext,
  collectPlan,
  conclusionLine,
  renderHuman,
  undeterminedPayload,
  selfTest,
  main,
  CONCLUSION_KEY,
  HARDCODED_TEXT_TOKEN,
  HARDCODED_TEXT_LIMIT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
