// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-alpha-usage.mjs — 扫描 Tailwind **v3** 三个消费端的真实 `/alpha` 类名用量,自动产出
 * `packages/design-tokens/src/tailwind-alpha-plugin.js` 的 `ALPHA_USAGE` 登记表并**原位写回**。
 *
 * 【为什么要把这张表改成生成的(2026-09-25 立)】
 * `ALPHA_USAGE` 原本是人工维护的用量登记表,而它的大小**等于**小程序主包样式表的增量(主包 2MB 硬预算),
 * 只能登记真实写过的形态。人工维护当天就咬了两口,方向相反:
 *  1. **登记了没人用**:`bg-muted/40` 被登记过,而那 2 处"用量"全在注释文本里(当时的统计没剥注释)
 *     ⇒ 往主包塞了一条永远不会产出的死规则,且 `git status` / typecheck / 其余守门全都不知道。
 *  2. **写了没登记**:新加 `bg-info/10` 仍然**静默不产出 CSS** —— 页面样式没生效且零报错。
 * 第 1 类靠"只登记扫到的"从定义上消失;第 2 类靠"下次生成必然覆盖"消失。
 *
 * 【判据的核心:先剥注释再统计】注释里的类名**不是用量**。本脚本不自己实现剥注释,而是复用守门
 * `scripts/check-cross-end-tokens.mjs` 的 **R6** 那一套(`maskComments` / `extractAlphaUsages` /
 * `collectAlphaCorpus` / `parseLiteralObject` / `flattenColorTiers`)—— 同一判据两处不同形正是本仓
 * 反复记录的成因(见 `scripts/lib/design-token-blocks.mjs` 头注),所以生成器与对账门**必须共用一份实现**。
 *
 * 【与 R6 的关系(生成器不取代它,而是改变它的结论)】
 *  - R6 的"未登记即红"在表自动生成后**不该再红**:表就是从同一份用量导出的,二者结构上不可能不一致。
 *    它因此降级为"生成器没跑 / 跑前被手改"的兜底哨兵 —— 仍然有价值,但红点含义变了。
 *  - R6 的"登了却没人用 = 腐烂"这一族**结构性消失**:生成器不会写出源码里没有的形态。
 *    例外只有 `alpha-plugin-exempt:` 行内豁免(作者显式声明不必登记),它既不进表也不判红,两侧同形。
 *  - R6 还判第三件事,本脚本**不代它判**:`tokens.css` 里每档必须有 `<key>-rgb` 通道三元组。
 *    生成新档名后仍需跑一次 `node scripts/check-cross-end-tokens.mjs` 确认通道在位。
 *
 * 【取材口径 = 与 R6 同一套,不得按磁盘扫】
 * 默认 **HEAD blob**(`--face staged` 走 R6 的 索引⊕HEAD 覆盖)。共享工作区常年被并行会话的半编辑态
 * 污染,按磁盘扫会把别人的中间状态烘进提交产物。写回目标文件另有第二道闸:目标的工作区副本必须与
 * 所判面逐字节相同,否则**拒绝写盘**(见 `assertTargetInSync`)—— 原位写回只替换表体,前提是该文件
 * 没有别的未被提交的改动,否则写回等价于把别人的行按旧基线带进提交。
 *
 * 用法:
 *   node scripts/sync-alpha-usage.mjs                扫描 → 原位写回(幂等,第二次零改动)
 *   node scripts/sync-alpha-usage.mjs --check        只校验不写盘(表与用量不一致则 exit 1)
 *   node scripts/sync-alpha-usage.mjs --face staged  按 R6 的 staged 口径(索引 blob)扫描
 *   node scripts/sync-alpha-usage.mjs --self-test    判据自检(纯内存夹具,不碰真仓文件)
 *   node scripts/sync-alpha-usage.mjs --help         帮助
 *
 * 退出码:0 = 一致/写回成功;1 = 表与用量漂移(--check)或写盘失败;2 = 无法判定
 *         (取不到输入、锚点歧义、目标文件与判定面不一致、新表在真插件里产不出)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { __test__ as GATE } from './check-cross-end-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 写回目标(与 R6 的 `ALPHA_PLUGIN_REL` 同一个文件,同一份路径常量) */
export const PLUGIN_REL = GATE.ALPHA_PLUGIN_REL
/** 锚点与 R6 逐字同形 —— 两处算"表在哪里"必须是同一个表达式 */
export const USAGE_ANCHOR = /^export const ALPHA_USAGE\s*=\s*\{/m

const argv = process.argv.slice(2)
const isCheck = argv.includes('--check')
const isHelp = argv.includes('--help')
const isQuiet = argv.includes('--quiet')
const isSelfTest = argv.includes('--self-test')
const isForce = argv.includes('--force')
const faceArg = (() => {
  const i = argv.indexOf('--face')
  return i >= 0 ? argv[i + 1] : 'head'
})()

const UndeterminedError = GATE.UndeterminedError

if (isHelp) {
  console.info(
    `sync-alpha-usage.mjs — v3 三端 /alpha 用量 → tailwind-alpha-plugin.js 的 ALPHA_USAGE(原位写回)

  node scripts/sync-alpha-usage.mjs                写回(幂等)
  node scripts/sync-alpha-usage.mjs --check         只校验(漂移 exit 1)
  node scripts/sync-alpha-usage.mjs --face staged   按 R6 的索引面扫描
  node scripts/sync-alpha-usage.mjs --self-test     判据自检

扫描面: ${GATE.ALPHA_V3_SCAN_FACES.join(' + ')}
目标:   ${PLUGIN_REL}
判据复用: scripts/check-cross-end-tokens.mjs 的 R6(剥注释 → 抽形态 → 对账,同一份实现)`
  )
  process.exit(0)
}

/** `--worktree` 刻意不提供:R6 没有工作树面,在这里加一条就是"同一判据两处不同形"。 */
export function resolveFace(face) {
  if (face === 'worktree')
    throw new UndeterminedError(
      '不支持 --face worktree:共享工作区常年含并行会话的半编辑态,按磁盘扫会把中间状态烘进提交产物;R6 也没有这个面,不提供第二套取材口径'
    )
  if (face !== 'head' && face !== 'staged')
    throw new UndeterminedError(`未知 --face ${JSON.stringify(face)}(只支持 head / staged)`)
  return face
}

/**
 * 在**原文**里定位 `ALPHA_USAGE` 的对象体,返回 `{ bodyStart, bodyEnd }`(不含首尾花括号)。
 *
 * 为什么不能只按 masked 文本定位:masked 与原文逐字符等长,所以索引可以直接用于切原文 —— 但锚点必须
 * 在**两个面各命中恰好一次且同位**。只查 masked 会漏掉这一型:注释里也写了一遍
 * `export const ALPHA_USAGE = {`(文档说明很容易这么写),于是原文有 2 处 ⇒ 写回会切到注释那一处,
 * 把散文当代码改写。只查原文则会漏"唯一锚点其实在注释里"。两条都查。
 */
export function locateObjectBody(src, anchorRe = USAGE_ANCHOR) {
  const flags = anchorRe.flags.includes('g') ? anchorRe.flags : `${anchorRe.flags}g`
  const re = new RegExp(anchorRe.source, flags)
  const rawHits = [...src.matchAll(re)].map((m) => m.index)
  const maskedHits = [...GATE.maskComments(src, false).matchAll(re)].map((m) => m.index)
  if (rawHits.length !== 1 || maskedHits.length !== 1)
    throw new UndeterminedError(
      `锚点 ${anchorRe} 在原文命中 ${rawHits.length} 处、剥注释后 ${maskedHits.length} 处(两侧都须恰好 1)⇒ 登记表形态已超出判据,不猜切点`
    )
  if (rawHits[0] !== maskedHits[0])
    throw new UndeterminedError('锚点在剥注释前后的位置不一致 ⇒ 存在一处被注释遮住的同形文本,拒绝写回')
  const i = rawHits[0]
  let depth = 0
  let p = src.indexOf('{', i)
  const bodyStart = p + 1
  for (; p < src.length; p++) {
    if (src[p] === '{') depth++
    else if (src[p] === '}') {
      depth--
      if (depth === 0) return { bodyStart, bodyEnd: p, anchorEnd: src.indexOf('{', i) + 1 }
    }
  }
  throw new UndeterminedError('登记表花括号不配平')
}

/** 类名形态 → 结构化三元组(`bg-primary-foreground/[0.12]` → kind/tier/mod)。 */
export function splitFormKey(key) {
  const dash = key.indexOf('-')
  const slash = key.lastIndexOf('/')
  if (dash < 0 || slash < 0) throw new UndeterminedError(`形态键 ${JSON.stringify(key)} 无法拆分(须 kind-tier/mod)`)
  return { kind: key.slice(0, dash), tier: key.slice(dash + 1, slash), mod: key.slice(slash + 1) }
}

/**
 * 扫一份份源码,收集**该登记**的形态。
 * 三道过滤的顺序与 `checkAlphaUsage` 逐字一致(非 preset 档 → 豁免 → 前缀不支持),否则两侧结论会分叉。
 * 三类被排除的形态一律**计数输出**,绝不静默丢弃。
 */
export function harvestForms(files, { tiers, supportedKinds }) {
  const forms = new Map() // key -> { count, kind, tier, mod, where: [] }
  const nonPreset = new Map()
  const unsupported = new Map()
  const exempted = new Map()
  const undetermined = []
  const bump = (bucket, t, rel) => {
    const key = `${t.kind}-${t.tier}/${t.mod}`
    const cur = bucket.get(key) || { count: 0, kind: t.kind, tier: t.tier, mod: t.mod, where: [] }
    cur.count++
    if (cur.where.length < 3) cur.where.push(`${rel}:${t.line + 1}`)
    bucket.set(key, cur)
  }
  for (const { rel, src } of files) {
    // 与 R6 的 `runR6.scanOne` 同一判据(`/\.(css|scss)$/`):CSS 侧 extractAlphaUsages 要先还原
    // 选择器里的反斜杠转义。改这一行必须同步改那边,否则两侧对"什么是 CSS 文件"会分叉。
    const isCss = /\.(css|scss)$/.test(rel)
    const { tokens, undetermined: un } = GATE.extractAlphaUsages(GATE.maskComments(src, isCss), {
      tiers,
      isCss,
      original: src,
    })
    for (const u of un) undetermined.push({ rel, line: u.line + 1, text: u.text })
    for (const t of tokens) {
      if (!t.onPresetTier) {
        bump(nonPreset, t, rel)
        continue
      } // 默认色板(white/black/gray-*)v3 自己能算通道,不属本插件职责
      if (t.exempt) {
        bump(exempted, t, rel)
        continue
      } // 作者显式声明不必登记 ⇒ 登记它就是死规则
      if (!supportedKinds.includes(t.kind)) {
        bump(unsupported, t, rel)
        continue
      } // 前缀不在能力表内 ⇒ 得先扩能力,不得静默登记一个产不出东西的行
      bump(forms, t, rel)
    }
  }
  // undetermined 是**正则命中数**:R6 的两条动态模式可以重叠命中同一行(实测 `bg-primary/${a}` 被
  // 两条都抓到),所以另给一个按 `文件:行` 去重的行数。两个数都如实报,不挑一个好看的:
  // 行数回答"有几处要人看",命中数与守门 R6 打印的那个数字同口径,不一致会让人以为门和脚本对不上。
  const undeterminedLines = new Set(undetermined.map((u) => `${u.rel}:${u.line}`)).size
  return { forms, nonPreset, unsupported, exempted, undetermined, undeterminedLines }
}

/** 数值档与任意值档**分开排序、永不归并**(`['5','10','[0.12]']`,不是 `['0.05','0.1','0.12']`)。 */
export function sortMods(mods) {
  const numeric = mods.filter((m) => !/^\[/.test(m))
  const arbitrary = mods.filter((m) => /^\[/.test(m))
  const val = (m) => Number(/^\[(.*)\]$/.test(m) ? m.slice(1, -1) : m)
  const cmp = (a, b) => val(a) - val(b) || String(a).localeCompare(String(b))
  return [...[...numeric].sort(cmp), ...[...arbitrary].sort(cmp)]
}

/**
 * 形态集 → 登记表。档位与前缀的**顺序沿用现表**(仍存在的档保持原行序),新档按字母序追加 ——
 * 目的不是好看:表体字节不变 ⇒ 写回是零改动 ⇒ 并行会话不会因整块重排而产生无意义冲突。
 */
export function buildUsageTable(forms, prior = {}) {
  const byTier = new Map()
  for (const f of forms.values()) {
    if (!byTier.has(f.tier)) byTier.set(f.tier, new Map())
    const kinds = byTier.get(f.tier)
    if (!kinds.has(f.kind)) kinds.set(f.kind, new Set())
    kinds.get(f.kind).add(f.mod)
  }
  const priorTiers = Object.keys(prior)
  const tierOrder = [
    ...priorTiers.filter((t) => byTier.has(t)),
    ...[...byTier.keys()]
      .filter((t) => !priorTiers.includes(t))
      .sort(),
  ]
  const out = {}
  for (const tier of tierOrder) {
    const kinds = byTier.get(tier)
    const priorKinds = Object.keys(prior[tier] || {})
    const kindOrder = [
      ...priorKinds.filter((k) => kinds.has(k)),
      ...[...kinds.keys()]
        .filter((k) => !priorKinds.includes(k))
        .sort(),
    ]
    out[tier] = {}
    for (const kind of kindOrder) out[tier][kind] = sortMods([...kinds.get(kind)])
  }
  return out
}

const IDENT = /^[A-Za-z_$][\w$]*$/
const q = (s) => (IDENT.test(s) ? s : `'${s}'`)
const qv = (s) => (/[\\']/.test(s) ? JSON.stringify(s) : `'${s}'`)

/** 渲染表体(含首尾换行,与现文件排版逐字同形:一档一行、尾逗号、两空格缩进)。 */
export function renderUsageBody(usage) {
  const tiers = Object.keys(usage)
  if (tiers.length === 0) return '\n'
  const lines = tiers.map((tier) => {
    const inner = Object.keys(usage[tier])
      .map((kind) => `${q(kind)}: [${usage[tier][kind].map(qv).join(', ')}]`)
      .join(', ')
    return `  ${q(tier)}: { ${inner} },`
  })
  return `\n${lines.join('\n')}\n`
}

/** 原位替换表体:锚点前的注释、其后的函数与其他导出**一个字节都不动**。 */
export function spliceUsageBody(src, usage) {
  const { bodyStart, bodyEnd } = locateObjectBody(src)
  return src.slice(0, bodyStart) + renderUsageBody(usage) + src.slice(bodyEnd)
}

/**
 * 现表 vs 新表的逐项差异(供报告,不改语义)。返回 `{ added, removed, changedTiers }`。
 * added = 新写过的形态(过去"静默不产出"的那一类);removed = 已无人写的形态(原表里的死规则)。
 */
export function diffTables(prior, next) {
  const flat = (t) => {
    const s = new Set()
    for (const [tier, byKind] of Object.entries(t || {}))
      for (const [kind, mods] of Object.entries(byKind || {}))
        for (const mod of mods || []) s.add(`${kind}-${tier}/${mod}`)
    return s
  }
  const a = flat(prior)
  const b = flat(next)
  const removed = [...a].filter((k) => !b.has(k)).sort()
  const added = [...b].filter((k) => !a.has(k)).sort()
  const keys = (t) => Object.keys(t || {})
  const changedTiers = [...new Set([...keys(prior), ...keys(next)])].filter(
    (tier) => JSON.stringify(prior?.[tier] ?? null) !== JSON.stringify(next?.[tier] ?? null)
  )
  return { added, removed, changedTiers }
}

/**
 * 写回前置闸:目标文件**表体之外**的字节必须与所判面逐字节相同。
 *
 * 这道闸防的是"把别人未提交的/滞后的行烘进提交"(§12 记过多次:共享工作区的活文件常年落后 HEAD,
 * 一次不带 pathspec 的提交就按旧基线整批写回)。但**不能拿整文件比** —— 表正是本脚本要改的东西,
 * 整文件比会在第一次成功写回后立刻自我封锁(工作区里是新表、判定面里是旧表 ⇒ 永远不等),
 * 工具就再也无法幂等重跑,而幂等重跑正是这张表唯一的信任来源。
 * 所以比的是"挖掉表体之后的其余部分":表外的任何未提交改动照样拒绝,表本身的差异照常放行。
 */
export function assertTargetInSync({ worktreeText, faceText, rel, force }) {
  const outside = (text) => {
    const { bodyStart, bodyEnd } = locateObjectBody(text)
    return text.slice(0, bodyStart) + text.slice(bodyEnd)
  }
  if (worktreeText === faceText) return { ok: true }
  if (outside(worktreeText) === outside(faceText))
    return { ok: true, tableOnlyDiff: true }
  if (force)
    return {
      ok: true,
      warned: `${rel} 在表体之外与判定面还有差异,已按 --force 写回(风险:一次不带 pathspec 的提交会把别人的行按旧基线写回)`,
    }
  return {
    ok: false,
    reason: `${rel} 在 ALPHA_USAGE 表体之外还有未提交改动(工作区副本 ≠ 判定面)⇒ 无法判定,拒绝写回;先收敛再跑(确需写:--force)`,
  }
}

/**
 * 用**真插件**自检新表:每一档都要能解析、每个形态都要真产出选择器。
 * 产不出就等于把"静默不产出"写进了提交 —— 这一步失败必须不落盘。
 */
export function verifyTable({ usage, colors, plugin }) {
  const built = plugin.buildAlphaUtilities(usage, colors)
  const missing = []
  for (const [tier, byKind] of Object.entries(usage))
    for (const [kind, mods] of Object.entries(byKind))
      for (const mod of mods)
        if (!Object.prototype.hasOwnProperty.call(built.utilities, plugin.escapeSelectorClass(`${kind}-${tier}/${mod}`)))
          missing.push(`${kind}-${tier}/${mod}`)
  return {
    produced: Object.keys(built.utilities).length,
    unresolvable: built.unresolvable,
    unknownKinds: built.unknownKinds,
    missing,
    ok: built.unresolvable.length === 0 && built.unknownKinds.length === 0 && missing.length === 0,
  }
}

/** 一行清单:形态 → 计数,供报告排序输出。 */
function listForms(map) {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([key, v]) => `${key} ${v.count}`)
}

async function run() {
  if (!existsSync(resolve(ROOT, PLUGIN_REL))) {
    console.error(`[sync-alpha-usage] 目标文件不存在: ${PLUGIN_REL}`)
    process.exit(1)
  }
  const face = resolveFace(faceArg)
  const plugin = await GATE.loadAlphaPlugin(ROOT)
  const reg = GATE.readAlphaRegistry(face)
  const pluginWorktree = readFileSync(resolve(ROOT, PLUGIN_REL), 'utf8')

  const sync = assertTargetInSync({
    worktreeText: pluginWorktree,
    faceText: reg.faces.pluginTxt,
    rel: PLUGIN_REL,
    force: isForce,
  })
  if (!sync.ok) {
    console.error(`[sync-alpha-usage] ❌ ${sync.reason}`)
    process.exit(2)
  }
  if (sync.warned && !isQuiet) console.warn(`[sync-alpha-usage] ⚠️ ${sync.warned}`)

  const corpus = GATE.collectAlphaCorpus({ face, faces: GATE.ALPHA_V3_SCAN_FACES })
  const files = corpus.map((c) => ({ rel: c.rel, src: c.eff }))
  const tiers = GATE.flattenColorTiers(reg.colors)
  const supportedKinds = Object.keys(plugin.ALPHA_UTILITY_KINDS)
  const h = harvestForms(files, { tiers, supportedKinds })
  const next = buildUsageTable(h.forms, reg.usage)
  const d = diffTables(reg.usage, next)
  const rendered = spliceUsageBody(pluginWorktree, next)
  const v = verifyTable({ usage: next, colors: reg.colors, plugin })

  if (!v.ok) {
    console.error(
      `[sync-alpha-usage] ❌ 新表在真插件里产不出(unresolvable ${v.unresolvable.length} / unknownKinds ${v.unknownKinds.length} / 未产出 ${v.missing.length})⇒ 不落盘:${JSON.stringify({ unresolvable: v.unresolvable, unknownKinds: v.unknownKinds, missing: v.missing.slice(0, 10) })}`
    )
    process.exit(2)
  }

  if (!isQuiet) {
    const hits = (m) => [...m.values()].reduce((s, x) => s + x.count, 0)
    console.info(`[sync-alpha-usage] 扫描面 ${GATE.ALPHA_V3_SCAN_FACES.join(' + ')}(${face} blob,${files.length} 文件)`)
    console.info(
      `  剥注释后命中 ${hits(h.forms) + hits(h.nonPreset) + hits(h.exempted) + hits(h.unsupported)} 处类名 ⇒ 该登记 ${h.forms.size} 形态(${hits(h.forms)} 处)· 默认色板 ${h.nonPreset.size} 形态(${hits(h.nonPreset)} 处,v3 原生支持不属本插件)· 已豁免 ${h.exempted.size} 形态(${hits(h.exempted)} 处)· 前缀不在能力表 ${h.unsupported.size} 形态(${hits(h.unsupported)} 处)· 动态拼接判不出 ${h.undeterminedLines} 行(R6 同口径命中 ${h.undetermined.length})`
    )
    console.info(`  形态: ${listForms(h.forms).join(' · ') || '(无)'}`)
    if (h.unsupported.size)
      console.info(
        `  前缀不在 ALPHA_UTILITY_KINDS(得先在能力表扩一档,否则登记了也产不出,故本脚本不写): ${listForms(h.unsupported).join(' · ')}`
      )
    if (h.exempted.size) console.info(`  已按 alpha-plugin-exempt 豁免(不登记): ${listForms(h.exempted).join(' · ')}`)
    if (h.undetermined.length) {
      console.info(`  动态拼接判不出(不计入用量、也不要求登记,如实报数):`)
      for (const u of h.undetermined.slice(0, 20)) console.info(`    ${u.rel}:${u.line}  ${u.text}`)
      if (h.undetermined.length > 20) console.info(`    …另 ${h.undetermined.length - 20} 条命中`)
    }
    const whereOf = (key) => (h.forms.get(key)?.where || []).join('/')
    console.info(
      `  对账:新增 ${d.added.length ? d.added.map((k) => `${k}←${whereOf(k)}`).join(' ,') : '0 项'} · 删除 ${d.removed.length ? d.removed.join(',') : '0 项'} · 变动档 ${d.changedTiers.length}`
    )
    console.info(
      `  产出校验:${v.produced} 条选择器,unresolvable ${v.unresolvable.length} / unknownKinds ${v.unknownKinds.length} / 应产出而未产出 ${v.missing.length} ⇒ 与真插件 buildAlphaUtilities 一致`
    )
    console.info(
      `  与守门 R6 的关系:表由本脚本从同一份用量导出 ⇒ R6 的"未登记即红"不该再触发,降级为"没跑生成器 / 跑前手改表"的兜底哨兵;R6 的"登了却没人用 = 腐烂"这一族结构性消失(生成器写不出源码里没有的形态,唯一出口是 alpha-plugin-exempt 行内豁免,两侧同形)。R6 另外判的 tokens.css 通道三元组(--color-X-rgb)不由本脚本代判,新增档后仍需跑一次 check-cross-end-tokens。`
    )
  }

  if (rendered === pluginWorktree) {
    if (!isQuiet) console.info(`[sync-alpha-usage] ✅ ALPHA_USAGE 已与用量一致(${h.forms.size} 形态),零改动(幂等)`)
    process.exit(0)
  }
  if (isCheck) {
    console.error(
      `[sync-alpha-usage] ❌ 登记表与实际用量漂移(新增 ${d.added.length} / 删除 ${d.removed.length})⇒ 请跑: node scripts/sync-alpha-usage.mjs`
    )
    process.exit(1)
  }
  writeFileSync(resolve(ROOT, PLUGIN_REL), rendered, 'utf8')
  console.info(
    `[sync-alpha-usage] ✅ 已原位写回 ${PLUGIN_REL}(${h.forms.size} 形态;新增 ${d.added.length} / 删除 ${d.removed.length})`
  )
}

// §22d 双形态入口:被镜像测试 import 时只拿导出符号,绝不执行 CLI(更绝不写盘)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

export const __test__ = {
  PLUGIN_REL,
  USAGE_ANCHOR,
  resolveFace,
  locateObjectBody,
  splitFormKey,
  harvestForms,
  sortMods,
  buildUsageTable,
  renderUsageBody,
  spliceUsageBody,
  diffTables,
  assertTargetInSync,
  verifyTable,
}

if (isDirectRun) {
  if (isSelfTest) selfTest()
  else
    run().catch((e) => {
      // 无论"无法判定"还是脚本自身异常,退出码一律 2:不冒判据红,更绝不记绿(同守门 94/101/103)。
      // 区别只在诊断面 —— "无法判定"是预期结论,一句话足够;其他异常必须带栈落地。
      const undetermined = e instanceof UndeterminedError
      console.error(
        `[sync-alpha-usage] ${undetermined ? '无法判定' : '执行失败'}: ${e?.message ?? e}${undetermined ? '' : `\n${e?.stack ?? ''}`}`
      )
      process.exit(2)
    })
}

/**
 * 判据自检:全部内存夹具,不碰真仓文件、不写盘。
 * 每条**成对** —— 只证"扫得到"不证"不把注释当用量"的判据等于没有(注释假用量正是本票立项的那一口咬痕)。
 */
function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)

  const tiers = new Set(['primary', 'muted', 'info', 'primary-foreground'])
  const kinds = ['bg', 'text', 'border']
  const run = (files) => {
    const h = harvestForms(files, { tiers, supportedKinds: kinds })
    return { keys: [...h.forms.keys()].sort(), h, table: buildUsageTable(h.forms, {}) }
  }

  // ── 核心判据:注释里的类名不是用量 ──
  const cmtSrc = [
    '// web 基准:bg-muted/40 与 bg-info/10 都是对照说明,不是用量',
    '/* 块注释里也举例子 bg-primary/50 */',
    'export const A = () => <View className="bg-primary/10" />',
  ].join('\n')
  const cmt = run([{ rel: 'a.tsx', src: cmtSrc }])
  ok('A1 注释里的类名不得登记(阳性对照:本票立项的那一口)', cmt.keys.join() === 'bg-primary/10', cmt.keys.join())
  ok('A2 真代码里的用量必须登记(对照:判据不是无条件丢弃)', cmt.h.forms.get('bg-primary/10')?.count === 1)
  // A1 的反向对照:**不**剥注释会多登记哪几条。缺了这条,A1 只证明"结果恰好是对的",
  // 不证明差别来自剥注释这一步 —— 把 maskComments 摘掉也不变的自检等于没有。
  const noMask = new Set(
    GATE.extractAlphaUsages(cmtSrc, { tiers, isCss: false, original: cmtSrc })
      .tokens.filter((t) => t.onPresetTier)
      .map((t) => `${t.kind}-${t.tier}/${t.mod}`)
  )
  ok(
    'A1b 不剥注释就把散文当用量(反向对照:bg-muted/40 只能来自注释)',
    noMask.has('bg-muted/40') && !cmt.keys.includes('bg-muted/40') && noMask.size > cmt.keys.length,
    `不剥 ${noMask.size} 形态(${[...noMask].sort().join(',')})vs 剥了 ${cmt.keys.length} 形态`
  )

  // ── 动态拼接:既不误当用量,也不静默漏成"该登记" ──
  const dyn = run([
    {
      rel: 'b.tsx',
      src: [
        'export const B = () => <View className={`bg-${x}/10`} />',
        'export const C = () => <View className={`bg-primary/${a}`} />',
      ].join('\n'),
    },
  ])
  ok('A3 动态拼接不得被当成用量', dyn.keys.length === 0, JSON.stringify(dyn.keys))
  ok(
    'A4 动态拼接必须进 undetermined(不得静默):按行去重 = 2 处,与 R6 同口径的命中数 = 3(`bg-primary/${a}` 被两条动态模式重叠命中)',
    dyn.h.undeterminedLines === 2 && dyn.h.undetermined.length === 3,
    `lines=${dyn.h.undeterminedLines} hits=${dyn.h.undetermined.length}`
  )

  // ── 排除面一律计数,不静默 ──
  const ex = run([
    {
      rel: 'd.tsx',
      src: [
        'export const D = () => <View className="bg-white/50" />', // 默认色板,不属本插件
        'export const E = () => <View className="ring-primary/10" />', // 前缀不在能力表
        'export const F = () => <View className="bg-info/10" /> /* alpha-plugin-exempt: 端内自绘,不走插件 */',
      ].join('\n'),
    },
  ])
  ok('A5 默认色板不登记且如实计数', ex.keys.length === 0 && ex.h.nonPreset.get('bg-white/50')?.count === 1)
  ok('A6 前缀不在能力表的不登记(登记了也产不出)且点名', ex.h.unsupported.get('ring-primary/10')?.count === 1)
  ok('A7 行内豁免不登记且计数', ex.h.exempted.get('bg-info/10')?.count === 1)

  // ── 任意值与命名数值分族登记,永不归并 ──
  const fam = run([
    { rel: 'e.tsx', src: 'x("bg-muted/[0.12]") y("bg-muted/10") z("bg-muted/5") w("bg-muted/[0.3]")' },
  ])
  ok(
    'A8 任意值形态与数值形态分别登记、不归并成一族',
    JSON.stringify(fam.table.muted.bg) === '["5","10","[0.12]","[0.3]"]',
    JSON.stringify(fam.table.muted?.bg)
  )

  // ── 写回:原位替换,周边一字节不动 ──
  const host = [
    '// 头部说明(不得被改写)',
    'export const ALPHA_UTILITY_KINDS = {',
    '  bg: (decl) => ({ background-color: decl }),',
    '}',
    '',
    'export const ALPHA_USAGE = {',
    "  primary: { bg: ['10'] },",
    '}',
    '',
    '/** 取用方(不得被改写) */',
    'export function alphaTiers(usage = ALPHA_USAGE) {',
    '  return Object.keys(usage)',
    '}',
    ''
  ].join('\n')
  const t2 = buildUsageTable(
    harvestForms(
      [{ rel: 'f.tsx', src: 'x("bg-primary/10") y("border-primary/20") z("text-primary-foreground/90")' }],
      { tiers, supportedKinds: kinds }
    ).forms,
    GATE.parseLiteralObject(GATE.extractObjectBody(host, USAGE_ANCHOR))
  )
  const written = spliceUsageBody(host, t2)
  ok('B1 表体被更新为新用量', written.includes("  primary: { bg: ['10'], border: ['20'] },") && written.includes("  'primary-foreground': { text: ['90'] },"))
  ok('B2 表外的字节逐字不动(能力表 / 函数体 / 头尾注释)', written.startsWith('// 头部说明(不得被改写)') && written.includes('export function alphaTiers') && written.includes('background-color'))
  ok('B3 现表顺序沿用、新档追加(写回不是整块重排)', written.indexOf('  primary:') < written.indexOf("  'primary-foreground':"))
  ok('B4 幂等:第二次必须零改动', spliceUsageBody(written, buildUsageTable(harvestForms([{ rel: 'f.tsx', src: 'x("bg-primary/10") y("border-primary/20") z("text-primary-foreground/90")' }], { tiers, supportedKinds: kinds }).forms, GATE.parseLiteralObject(GATE.extractObjectBody(written, USAGE_ANCHOR)))) === written)
  const round = GATE.parseLiteralObject(GATE.extractObjectBody(written, USAGE_ANCHOR))
  ok('B5 渲染结果必须能被 R6 的解析器读回同一张表(写与读同形)', JSON.stringify(round) === JSON.stringify(t2))
  // 镜像测试 `check-cross-end-tokens.test.mjs` 用**非贪婪** `/export const ALPHA_USAGE = \{[\s\S]*?\n\}/`
  // 替换真文件做夹具。表体里一旦出现顶格的 `}`(每档一行时嵌套闭合容易顶格),那条正则会在第一个
  // 嵌套闭合处截断 ⇒ 夹具拿到半张表,而真仓判据照旧绿 —— 它测自己的表,不测产物的排版。
  // 所以这里直接用**那条正则本身**把它抓到的内容解析回来,证明"抓到的就是整张表"。
  const mirrorHit = /export const ALPHA_USAGE = \{[\s\S]*?\n\}/.exec(written)
  ok(
    'B6 镜像测试的非贪婪夹具正则必须整张表捕住(解析回来必须等于新表)',
    !!mirrorHit &&
      JSON.stringify(GATE.parseLiteralObject(GATE.extractObjectBody(mirrorHit[0], USAGE_ANCHOR))) ===
        JSON.stringify(t2)
  )
  ok(
    'B6b 表体内不得有顶格闭合花括号(一档一行、嵌套闭合必须带缩进)',
    renderUsageBody(t2)
      .split('\n')
      .every((l) => !l.startsWith('}'))
  )

  // ── 锚点歧义必须大声失败 ──
  let threwTwice = false
  try {
    locateObjectBody(`${host}\nexport const ALPHA_USAGE = { primary: {} }\n`)
  } catch (e) {
    threwTwice = e instanceof UndeterminedError
  }
  ok('B7 锚点命中两处必须抛"无法判定"(不得猜切点)', threwTwice)
  let threwCommentOnly = false
  try {
    locateObjectBody('// 只是文档里写的 export const ALPHA_USAGE = { 例子\nexport const X = 1\n')
  } catch (e) {
    threwCommentOnly = e instanceof UndeterminedError
  }
  ok('B8 唯一锚点其实在注释里必须抛(注释里的锚点不是代码)', threwCommentOnly)

  // ── 取材口径 ──
  let refused = false
  try {
    resolveFace('worktree')
  } catch (e) {
    refused = e instanceof UndeterminedError
  }
  ok('C1 --face worktree 必须拒(不提供 R6 之外的第二套取材口径)', refused)
  ok('C2 --face staged 与 head 都接受', resolveFace('staged') === 'staged' && resolveFace('head') === 'head')

  const sameHost = 'export const ALPHA_USAGE = {\n  primary: { bg: ["10"] },\n}\nexport const K = 1\n'
  const tableOnly = 'export const ALPHA_USAGE = {\n  primary: { bg: ["20", "30"] },\n}\nexport const K = 1\n'
  const outsideTouched = 'export const ALPHA_USAGE = {\n  primary: { bg: ["10"] },\n}\nexport const K = 2\n'
  ok('C3 逐字节相同直接放行', assertTargetInSync({ worktreeText: sameHost, faceText: sameHost, rel: 'x', force: false }).ok)
  ok(
    'C4 只有表体不同必须放行(否则第一次成功写回就自我封锁,幂等重跑不可能)',
    assertTargetInSync({ worktreeText: tableOnly, faceText: sameHost, rel: 'x', force: false }).ok &&
      assertTargetInSync({ worktreeText: tableOnly, faceText: sameHost, rel: 'x', force: false }).tableOnlyDiff === true
  )
  ok(
    'C5 表体之外有未提交改动必须拒绝写回(防把别人的行按旧基线烘进提交)',
    !assertTargetInSync({ worktreeText: outsideTouched, faceText: sameHost, rel: 'x', force: false }).ok &&
      /无法判定/.test(assertTargetInSync({ worktreeText: outsideTouched, faceText: sameHost, rel: 'x', force: false }).reason)
  )
  ok(
    'C6 --force 只把拒绝降级为警告,不改写判据',
    assertTargetInSync({ worktreeText: outsideTouched, faceText: sameHost, rel: 'x', force: true }).ok === true &&
      !!assertTargetInSync({ worktreeText: outsideTouched, faceText: sameHost, rel: 'x', force: true }).warned
  )

  // ── 真插件自检:产不出的表必须拦在落盘前 ──
  const fakePlugin = {
    ALPHA_UTILITY_KINDS: { bg: (d) => ({ 'background-color': d }) },
    buildAlphaUtilities: (usage, colors) => {
      const utilities = {}
      const unresolvable = []
      for (const tier of Object.keys(usage)) {
        if (!(tier in colors)) {
          unresolvable.push(tier)
          continue
        }
        for (const mod of usage[tier].bg || []) utilities[`bg-${tier}\\/${mod}`] = { 'background-color': 'x' }
      }
      return { utilities, unresolvable, unknownKinds: [] }
    },
    escapeSelectorClass: (c) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\' + ch),
  }
  ok(
    'D1 档在 preset 取不出变量时必须判失败(不得静默少产出)',
    !verifyTable({ usage: { ghost: { bg: ['10'] } }, colors: { primary: 'var(--color-primary)' }, plugin: fakePlugin }).ok
  )
  ok(
    'D2 正常表必须自检通过',
    verifyTable({ usage: { primary: { bg: ['10'] } }, colors: { primary: 'var(--color-primary)' }, plugin: fakePlugin }).ok
  )

  for (const r of results) console.info(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  if (failed) console.error(`self-test 失败 ${failed} 条`)
  else console.info(`✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}
// (水印行由 scripts/watermark.mjs inject 追加)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
