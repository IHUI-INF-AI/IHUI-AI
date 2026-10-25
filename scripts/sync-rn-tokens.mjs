#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-rn-tokens.mjs — 把 packages/design-tokens/src/styles/tokens.css 的设计真值**原位写回**
 * packages/design-tokens/src/rn-tokens.ts 的三张 RN 表(rnTokens / rnLightTokens / rnDarkTokens)。
 *
 * 为什么必须存在(不是便利脚本):
 * rn-tokens.ts 是一份手抄 HEX 表,唯一权威源是 tokens.css(`@theme` + 全部 `:root` = 亮档,全部 `.dark` = 暗档)。
 * 两端各存一份 = 第二真相:web 改了色而 RN 没改,守门 `check-cross-end-tokens.mjs` 只会**判红**,红完仍要人
 * 手工把新值再抄一遍 —— 抄漏哪一档由下一个视觉 bug 决定。本脚本把"能由源推出的那一面"变成派生态:
 * 改 tokens.css 一处,跑一次 RN 侧自动跟上。
 * 与 `sync-rn-global-css.mjs` 同族互补:那道同步 RN 端的 CSS 变量副本(global.css),本道同步 RN 端的 JS 令牌表,
 * 两者读同一份源、共用同一个取值实现。
 *
 * 三条写法都由既有教训决定:
 * 1. **取值只能经 `scripts/lib/design-token-blocks.mjs`**(它是 tokens.css 取块/取值的唯一实现)。旧写法只取
 *    首个 `@theme` 块、漏掉后续 `:root`,接上提交链跑一次就把 `--color-*-rgb` 三元组"同步"删掉了。
 * 2. **可派生面不另立第二张表**,直接取守门的声明(所以门扩面,派生面自动跟着扩):
 *      候选源变量 = MAPPINGS 里已声明的配对(带 basis,优先)∪ R4 的同名推导
 *      (`<ns>.<key>` → `--color-<kebab(ns)>-<kebab(key)>`,`DEFAULT` 折叠成父名);
 *    推不到同名变量 ⇒ 不派生(门的口径就是不猜语义);源与副本不等值且该档登记在 BASE_CONFLICTS ⇒ 不派生
 *    (人已裁定"两侧语义不同",派生器不得把它抹平);未登记的不等值 ⇒ **按源写回**(源是唯一真相,这正是本脚本
 *    存在的理由);两侧都命中但给出的值互不相同 ⇒ 拒绝(不择一);源值归一后 RN 解析不了 ⇒ 拒绝。
 *    为什么不逐档写 `// src: --color-x` 行尾标记:那是一份必然腐烂的手工清单(守门 91 的组件清单同型)——
 *    可派生面每次运行都由源重算,逐档出处走 `--list` 台账打印;表头只留一个 `rn-tokens:managed` 块标记,
 *    它只声明"这张表在派生面里",不列举档位。
 * 3. **等值即保留原字节**(与 global.css 那条同一幂等口径):`#FFFFFF` 与源里的 `#ffffff`、shadcn 的
 *    `hsl(142 71% 45%)` 与 `#22c55e`(单通道差 1 = 同色两种编码)都不算漂移,判据与门共用 `colorsAgree`,
 *    所以不会出现"每次同步都改一遍写法"的空转 diff。
 *
 * 用法:
 *   node scripts/sync-rn-tokens.mjs             原位写回(幂等;实际有改动才落盘并补水印)
 *   node scripts/sync-rn-tokens.mjs --check     只读:有待写回项 / 待补标记 / 拒绝项 ⇒ exit 1
 *   node scripts/sync-rn-tokens.mjs --list      只读:打印派生台账(可派生档 + 不可派生档 + 原因);拒绝项 ⇒ exit 1
 *   node scripts/sync-rn-tokens.mjs --check --staged
 *              提交链档:判**索引 blob**(§0.4 同面同轮,绝不回落工作树),零写盘;落后 ⇒ exit 1
 *              —— 不这么做的话,门判的是"盘上此刻是什么",而提交交的是索引那份,两边可以任意分叉
 *   node scripts/sync-rn-tokens.mjs --self-test 判据自检(全部内存夹具,不碰真仓文件)
 *
 * 退出码:0 = 一致或写回成功;1 = 存在待写回漂移 / 标记缺失 / 拒绝项;2 = 无法判定
 *         (源或目标取不到、门的声明形状不符、表定位失败、本脚本与门看到的叶子集不一致)。
 *
 * 已知边界(如实登记):扫描器认「一行一个字符串字面量」的令牌表形态;跨行字符串字面量会被我判成非叶子,
 * 而门判成叶子 —— 这一型不由我静默吞掉,`assertSameLeafSets` 直接判"无法判定"(自检 H4 钉死)。
 *
 * 本脚本当前未接入提交链(改 `.husky/*`、`guardian-runner.mjs`、`scripts/lib/pre-commit-hook.js` 不属本票范围);
 * `--check` 就是人工 / CI 的只读入口。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectVars } from './lib/design-token-blocks.mjs'
import { catBatch } from './lib/face-reader.mjs'
import { __test__ as crossEnd } from './check-cross-end-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const TOKENS_SOURCE_REL = 'packages/design-tokens/src/styles/tokens.css'
export const RN_TOKENS_REL = 'packages/design-tokens/src/rn-tokens.ts'

/** 三张表各属哪个主题档案 —— 与门 R4 的 `constName === 'rnDarkTokens' ? 'dark' : 'light'` 同形。 */
export const TABLE_MODE = {
  rnTokens: 'light',
  rnLightTokens: 'light',
  rnDarkTokens: 'dark',
}

/** 受管块标记(每张表体第一段内容)。它不是清单,只声明"这张表在派生面里"。 */
export const MANAGED_MARKER = 'rn-tokens:managed'
export const MARKER_COMMENT = `/* ${MANAGED_MARKER} —— 本表凡能由 tokens.css 推出的档,值由 scripts/sync-rn-tokens.mjs 原位写回(勿手改这些值);推不到的档属 RN 专属或源里无同名变量,仍是手抄 */`

/** 与门 checkBasePalette 同形的「只判颜色」过滤:数字 / 布尔 / 说明性字符串不进派生面。 */
export const COLOR_LITERAL_RE = /^\s*(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i

class UndeterminedError extends Error {}

// ───────────────────────────────────────────────────────────────── 源侧 ─────────────────────────────────────────────────────────────────

function varsToTable(map) {
  const out = {}
  for (const [name, d] of map) out[name] = d.value
  return out
}

/**
 * tokens.css → `{light, dark}`。
 * dark = 亮档 ∪ `.dark`,未覆盖的档按 CSS cascade 回退亮值 —— 门的口径。
 * (`--color-cta` 2026-09-26 起已在 .dark 显式覆盖,不再依赖回退;机制本身保留。)
 */
export function readTokenTables(tokensCss) {
  const light = varsToTable(collectVars(tokensCss, ['@theme', ':root']))
  return { light, dark: { ...light, ...varsToTable(collectVars(tokensCss, ['.dark'])) } }
}

// ───────────────────────────────────────────────────────────── 目标侧扫描 ─────────────────────────────────────────────────────────────

/**
 * 等长遮罩:块注释、行注释、字符串字面量内部一律换成空格(换行与引号本体保留,长度不变)。
 *
 * 为什么必须等长:原位写回要按**原文件下标**切区间,删注释会让下标错位。
 * 为什么必须遮罩:本文件注释里真写着 `foreground: '#FFFFFF' …说明`(rn-tokens.ts 的 dark 表文档块),
 * 字符串里也可能有花括号 —— 不遮就是把注释当数据(本仓为这一类翻车不止一次)。
 * 与 `design-token-blocks.maskComments` 的差别:面是 TS 不是 CSS,故还要处理 `//` 行注释与字符串内部;
 * 相同点是"等长 + 保换行"。
 */
export function maskTs(text) {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    const nx = text[i + 1]
    if (c === '/' && nx === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      for (let k = i; k < stop; k++) out += text[k] === '\n' ? '\n' : ' '
      i = stop
      continue
    }
    if (c === '/' && nx === '/') {
      let k = i
      while (k < n && text[k] !== '\n') {
        out += ' '
        k++
      }
      i = k
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      out += c
      let k = i + 1
      while (k < n) {
        if (text[k] === '\\') {
          out += k + 1 < n && text[k + 1] === '\n' ? '\n' : ' '
          out += ' '
          k += 2
          continue
        }
        if (text[k] === c) {
          out += c
          k++
          break
        }
        out += text[k] === '\n' ? '\n' : ' '
        k++
      }
      i = k
      continue
    }
    out += c
    i++
  }
  return out
}

/** 定位 `export const <name> … = {` 的表体区间(不含外层花括号);花括号不配对即判"无法判定"。 */
export function locateTable(masked, name) {
  const re = new RegExp(`export const ${name}[^=]*=\\s*\\{`)
  const m = re.exec(masked)
  if (!m) return null
  const bodyStart = m.index + m[0].length
  let i = bodyStart
  let depth = 1
  while (i < masked.length && depth > 0) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}') depth--
    i++
  }
  if (depth !== 0) throw new UndeterminedError(`${name}: 表体花括号不配对,取不到可写回的区间`)
  return { declStart: m.index, bodyStart, bodyEnd: i - 1 }
}

/**
 * 递归收集表体内的字符串叶子,**带原文件绝对下标**(门只给值,写回要下标)。
 * 键识别正则与门 `objectLeaves` 逐字同形,并由 `assertSameLeafSets` 断言两侧看到的叶子集相同。
 */
export function collectLeafSpans(masked, raw, from, to, prefix = '', out = []) {
  const slice = masked.slice(from, to)
  const re = /(?:^|[,{\n])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*|\d+))\s*:\s*/g
  let m
  while ((m = re.exec(slice)) !== null) {
    const key = m[1] ?? m[2] ?? m[3]
    let i = m.index + m[0].length
    while (i < slice.length && /\s/.test(slice[i])) i++
    if (slice[i] === '{') {
      let depth = 1
      let j = i + 1
      while (j < slice.length && depth > 0) {
        if (slice[j] === '{') depth++
        else if (slice[j] === '}') depth--
        j++
      }
      const inner = prefix ? `${prefix}.${key}` : key
      collectLeafSpans(masked, raw, from + i + 1, from + j - 1, inner, out)
      re.lastIndex = j
      continue
    }
    // 值跨度:到深度 0 的 ',' 或行尾为止(括号内的逗号不算 —— rgba(0,0,0,0.4) 靠这一条)
    let j = i
    let depth = 0
    while (j < slice.length) {
      const c = slice[j]
      if (c === '(' || c === '[' || c === '{') depth++
      else if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) break
        depth--
      } else if (depth === 0 && (c === ',' || c === '\n')) break
      j++
    }
    let end = j
    while (end > i && /\s/.test(slice[end - 1])) end--
    const valueRaw = raw.slice(from + i, from + end)
    const sm = /^'([^']*)'$|^"([^"]*)"$/.exec(valueRaw)
    if (sm)
      out.push({
        path: prefix ? `${prefix}.${key}` : key,
        value: sm[1] ?? sm[2],
        valueStart: from + i,
        valueEnd: from + end,
        quote: valueRaw[0],
      })
    re.lastIndex = Math.max(j, i + 1)
  }
  return out
}

/** 受管块标记必须落在表体第一段内容里;被摘掉就重新补上(装好被摘线要能被发现 —— 守门 97 的 S1 口径)。 */
export function hasManagedMarker(raw, bodyStart) {
  const m = /^\s*\/\*([\s\S]*?)\*\//.exec(raw.slice(bodyStart, bodyStart + 4000))
  return !!(m && m[1].includes(MANAGED_MARKER))
}

// ───────────────────────────────────────────────────────── 门的声明 → 候选源 ─────────────────────────────────────────────────────────

/**
 * 守门的 MAPPINGS 折成 `{light: Map<path, cssVar[]>, dark: …}`(表名剥掉:path 才是档位身份)。
 * `rnTokens` 基表按门 R5 的要求本就与 light 表同值,所以继承同一份可派生面,不另推一套。
 * 形状不符一律"无法判定":门正被并行会话改,结构动了却让我按旧形状猜,产出的是假派生。
 */
export function indexMappings(mappings) {
  if (!Array.isArray(mappings))
    throw new UndeterminedError('守门的 MAPPINGS 不是数组(门的声明形状变了),不按猜的形状派生')
  const idx = {
    light: new Map(),
    dark: new Map(),
  }
  for (const mp of mappings) {
    if (!mp || typeof mp !== 'object' || !mp.rn || !mp.css)
      throw new UndeterminedError(
        `守门 MAPPINGS 有条目缺 rn/css 字段:${JSON.stringify(mp)?.slice(0, 80)}`,
      )
    for (const mode of ['light', 'dark']) {
      const p = mp.rn[mode]
      const v = mp.css[mode]
      if (!p || !v) continue
      if (!Array.isArray(p) || p.length < 2 || typeof v !== 'string')
        throw new UndeterminedError(
          `守门 MAPPINGS 的 rn/css 字段形状不符(label=${String(mp.label)})`,
        )
      const path = p.slice(1).join('.')
      if (!idx[mode].has(path)) idx[mode].set(path, [])
      idx[mode].get(path).push(v)
    }
  }
  return idx
}

/**
 * 源值 → 可写进 RN 的字面量。归一规则与门共用一份实现(`normalizeColor`):
 * `hsl(h s% l%)` / `hsl(h,s%,l%)` 折成 `#rrggbb`,`#rgb` 展成 `#rrggbb`,其余只做小写 + 去空白。
 * 归一后既不是 hex6 也不是 rgb[a]/hsl[a](渐变、var() 引用、关键字色名…)⇒ ok:false ——
 * 宁可不派生,也不产出"Metro 打包成功但运行时是 undefined 颜色"那种两端都不红的形态。
 */
export function rnLiteralFromSource(srcValue) {
  const norm = crossEnd.normalizeColor(srcValue)
  if (/^#[0-9a-f]{6}$/.test(norm)) return { ok: true, literal: norm }
  if (/^rgba?\([^()]*\)$/.test(norm) || /^hsla?\([^()]*\)$/.test(norm))
    return { ok: true, literal: norm }
  return { ok: false, reason: `源值归一后 RN 不可解析:${norm.slice(0, 60)}` }
}

// ───────────────────────────────────────────────────────────────── 计划 ─────────────────────────────────────────────────────────────────

/**
 * @param {{rnText:string, light:Record<string,string>, dark:Record<string,string>,
 *   mappings?:unknown[], registeredConflicts?:Record<string,string>, rnOnlyBrandKeys?:Record<string,string>}} o
 * @returns {{entries:Array, tables:Array, changes:Array, refusals:Array, unmanaged:Array,
 *   markerInserts:Array, managedCount:number, spansByTable:Object}}
 */
export function planDerivation(o) {
  const mappings = o.mappings === undefined ? crossEnd.MAPPINGS : o.mappings
  const registered =
    o.registeredConflicts === undefined ? crossEnd.BASE_CONFLICTS : o.registeredConflicts
  const rnOnly = o.rnOnlyBrandKeys === undefined ? crossEnd.RN_ONLY_BRAND_KEYS : o.rnOnlyBrandKeys
  const declared = indexMappings(mappings)
  const masked = maskTs(o.rnText)
  const plan = {
    entries: [],
    tables: [],
    changes: [],
    refusals: [],
    unmanaged: [],
    markerInserts: [],
    managedCount: 0,
  }
  const spansByTable = {}

  for (const [name, mode] of Object.entries(TABLE_MODE)) {
    const loc = locateTable(masked, name)
    if (!loc) throw new UndeterminedError(`rn-tokens.ts 里定位不到 export const ${name}`)
    const spans = collectLeafSpans(masked, o.rnText, loc.bodyStart, loc.bodyEnd)
    spansByTable[name] = spans
    const table = mode === 'dark' ? o.dark : o.light
    let managed = 0
    let refused = 0

    for (const leaf of spans) {
      const rec = { table: name, path: leaf.path, value: leaf.value }
      if (!COLOR_LITERAL_RE.test(leaf.value)) {
        rec.status = 'not-a-color'
        plan.entries.push(rec)
        continue
      }
      const cands = [
        ...(declared[mode].get(leaf.path) || []),
        ...crossEnd.deriveCssVarNames(leaf.path),
      ]
      const present = [...new Set(cands)].filter((v) => v in table)
      if (present.length === 0) {
        const tail = leaf.path.split('.').pop()
        rec.status = 'unmanaged'
        rec.reason =
          leaf.path.startsWith('brand.') && rnOnly[tail]
            ? `RN 专属档(门豁免清单理由:${rnOnly[tail]})`
            : 'tokens.css 无同名 --color-* 档,守门 MAPPINGS 也未声明配对 ⇒ 按门口径不猜语义'
        plan.unmanaged.push(rec)
        plan.entries.push(rec)
        continue
      }
      const distinct = [...new Set(present.map((v) => crossEnd.normalizeColor(table[v])))]
      if (distinct.length > 1) {
        rec.status = 'refused'
        rec.kind = 'dual-source'
        rec.detail = `已声明映射与同名推导给出两个不同值:${present.map((v) => `${v}=${table[v]}`).join(' | ')}`
        plan.refusals.push(rec)
        plan.entries.push(rec)
        refused++
        continue
      }
      const srcVar = present[0]
      const srcVal = table[srcVar]
      rec.srcVar = srcVar
      rec.srcVal = srcVal
      if (crossEnd.colorsAgree(leaf.value, srcVal)) {
        rec.status = 'derived-in-sync'
        managed++
        plan.entries.push(rec)
        continue
      }
      const key = `${name}|${leaf.path}`
      if (key in registered) {
        rec.status = 'unmanaged'
        rec.reason = `BASE_CONFLICTS 已登记语义分歧(须人裁,派生器不得抹平):${registered[key]}`
        plan.unmanaged.push(rec)
        plan.entries.push(rec)
        continue
      }
      const lit = rnLiteralFromSource(srcVal)
      if (!lit.ok) {
        rec.status = 'refused'
        rec.kind = 'unsafe-form'
        rec.detail = `${srcVar} = ${String(srcVal).slice(0, 60)} —— ${lit.reason}`
        plan.refusals.push(rec)
        plan.entries.push(rec)
        refused++
        continue
      }
      rec.status = 'derived-needs-write'
      rec.to = lit.literal
      managed++
      plan.changes.push({
        table: name,
        path: leaf.path,
        srcVar,
        srcVal,
        from: leaf.value,
        to: lit.literal,
        valueStart: leaf.valueStart,
        valueEnd: leaf.valueEnd,
        quote: leaf.quote,
      })
      plan.entries.push(rec)
    }
    plan.managedCount += managed
    if (managed > 0 && !hasManagedMarker(o.rnText, loc.bodyStart))
      plan.markerInserts.push({ table: name, at: loc.bodyStart, text: `\n  ${MARKER_COMMENT}` })
    plan.tables.push({
      table: name,
      mode,
      leaves: spans.length,
      managed,
      unmanaged: plan.unmanaged.filter((u) => u.table === name).length,
      refused,
      changes: plan.changes.filter((c) => c.table === name).length,
    })
  }
  plan.spansByTable = spansByTable
  return plan
}

/**
 * 与门逐表对账"看到的叶子集"(路径 + 值)。两侧必须看同一份面,否则"派生按我的解析、判红按门的解析"
 * 就是两台各说各话的尺子。取不到任一侧 = 无法判定,绝不各算各的然后报绿。
 */
export function assertSameLeafSets(rnText, spansByTable) {
  const stripped = crossEnd.stripTsComments(rnText)
  const bad = []
  const sig = (arr) =>
    [...arr]
      .map((l) => `${l.path}=${l.value}`)
      .sort()
      .join('|')
  for (const name of Object.keys(TABLE_MODE)) {
    const body = crossEnd.extractTsObjectBody(stripped, name)
    if (body === null) {
      bad.push(`${name}(门取不到表体)`)
      continue
    }
    const gate = sig(crossEnd.objectLeaves(body, []))
    const mine = sig(spansByTable[name] || [])
    if (gate !== mine) bad.push(name)
  }
  if (bad.length)
    throw new UndeterminedError(
      `本脚本与守门 check-cross-end-tokens 看到的叶子集不一致(${bad.join(', ')})` +
        ' —— 两台尺子各读一份面,派生结果不可信;请对齐解析器,不要各修各的',
    )
}

/** 按绝对下标原位改写(倒序 splice ⇒ 靠前下标不受靠后改动影响)。 */
export function applyPlan(rnText, plan) {
  const edits = []
  for (const c of plan.changes)
    edits.push({ start: c.valueStart, end: c.valueEnd, text: `${c.quote}${c.to}${c.quote}` })
  for (const m of plan.markerInserts) edits.push({ start: m.at, end: m.at, text: m.text })
  let out = rnText
  for (const e of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out
}

/** 派生台账:逐表统计 + 待写回 / 拒绝 / 不可派生(含原因)三段清单。 */
export function renderLedger(plan) {
  const lines = []
  for (const t of plan.tables)
    lines.push(
      `  ${t.table} (mode=${t.mode}): 叶子 ${t.leaves} = 可派生 ${t.managed} + 不可派生 ${t.unmanaged} + 拒绝 ${t.refused}(其余为非颜色档)`,
    )
  lines.push(
    `合计:可派生 ${plan.managedCount} 档(其中待写回 ${plan.changes.length})/ 不可派生 ${plan.unmanaged.length} 档 / 拒绝 ${plan.refusals.length} 档 / 待补标记 ${plan.markerInserts.length} 处`,
  )
  if (plan.changes.length) {
    lines.push('── 待写回(源 ≠ 副本)──')
    for (const c of plan.changes)
      lines.push(`  ${c.table} ${c.path}: '${c.from}' → '${c.to}'  ← ${c.srcVar} = ${c.srcVal}`)
  }
  if (plan.refusals.length) {
    lines.push('── 拒绝派生(须人裁)──')
    for (const r of plan.refusals) lines.push(`  ${r.table} ${r.path} [${r.kind}] ${r.detail}`)
  }
  if (plan.unmanaged.length) {
    lines.push('── 不可派生清单(逐档原因)──')
    for (const u of plan.unmanaged)
      lines.push(
        `  ${u.table} ${u.path} = '${u.value}' —— ${u.reason}${u.srcVar ? `(源:${u.srcVar} = ${u.srcVal})` : ''}`,
      )
  }
  return lines.join('\n')
}

// ───────────────────────────────────────────────────────────────── 自检 ─────────────────────────────────────────────────────────────────

const FIXTURE_CSS = `@theme {
  /* 说明里写着 --color-fake: 这是散文不是声明 */
  --color-primary: hsl(0 0% 0%);
  --color-primary-foreground: hsl(0 0% 100%);
  --color-surface-light: #ffffff;
  --color-text-tertiary: #a3a3a3;
  --color-success: hsl(142 71% 45%);
  --color-cta: #4a7a96;
  --color-vip-gold-start: #ffd700;
  --color-danger-bright: #f87171;
  --color-late-only: #123456;
  --color-banner: linear-gradient(112deg, rgba(205, 208, 255, 0.7) 0%);
}
:root {
  --color-brand: #000000;
}
.dark {
  --color-primary: hsl(0 0% 100%);
  --color-brand: #ffffff;
  --color-text-tertiary: #737373;
  --color-danger-bright: #ef4444;
  --color-late-only: #654321;
}`

const FIXTURE_RN = `// 行注释里也写着 export const rnTokens = { —— 不得被当成定义
/**
 * 文档块里写 foreground: '#0F0F0F' 是说明,不是声明。
 */
export const rnTokens = {
  brand: {
    DEFAULT: '#000000',
    foreground: '#FFFFFF',
    dark: '#34D399',
    cta: '#4A7A96',
  },
  surface: { light: '#FFFFFF' },
  text: { primary: '#0A0A0A', tertiary: '#A3A3A3' },
  success: { DEFAULT: '#22c55e' },
  banner: { DEFAULT: '#22c55e' },
  vip: { gold: '#FFD700' },
  gray: { 50: '#fafafa', black: '#000' },
} as const

export type RnThemeTokens = {
  surface: { light: string }
}

export const rnLightTokens: RnThemeTokens = {
  brand: { DEFAULT: '#000000', dark: '#34D399' },
  late: { only: '#123456' },
}

export const rnDarkTokens = {
  brand: { DEFAULT: '#FFFFFF', cta: '#4A7A96' },
  danger: { bright: '#f87171' },
  late: { only: '#654321' },
  text: { tertiary: '#737373' },
}
`

/** 夹具自带一份最小声明面(门的表在并行会话里会变 ⇒ 自检必须可复现,不跟着仓库瞬时状态漂)。 */
const FIXTURE_MAPPINGS = [
  {
    label: 'brand.DEFAULT (light) ↔ --color-primary',
    rn: { light: ['rnLightTokens', 'brand', 'DEFAULT'] },
    css: { light: '--color-primary' },
  },
  {
    label: 'brand.DEFAULT (dark) ↔ --color-primary',
    rn: { dark: ['rnDarkTokens', 'brand', 'DEFAULT'] },
    css: { dark: '--color-primary' },
  },
  {
    label: 'brand.cta (light) ↔ --color-cta',
    rn: { light: ['rnTokens', 'brand', 'cta'] },
    css: { light: '--color-cta' },
  },
  {
    label: 'brand.cta (dark) ↔ --color-cta(cascade)',
    rn: { dark: ['rnDarkTokens', 'brand', 'cta'] },
    css: { dark: '--color-cta' },
  },
  {
    label: 'vip.gold ↔ --color-vip-gold-start',
    rn: { light: ['rnTokens', 'vip', 'gold'], dark: ['rnDarkTokens', 'vip', 'gold'] },
    css: { light: '--color-vip-gold-start', dark: '--color-vip-gold-start' },
  },
]

function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)
  const throws = (name, re, fn) => {
    try {
      fn()
      results.push(`❌ ${name} → 期望抛错却没有`)
    } catch (e) {
      const msg = String((e && e.message) || e)
      results.push(
        `${re.test(msg) ? '✅' : '❌'} ${name}${re.test(msg) ? '' : ` → 抛的是:${msg.slice(0, 90)}`}`,
      )
    }
  }
  const T = readTokenTables(FIXTURE_CSS)
  const mk = (over = {}, text = FIXTURE_RN) => {
    const p = planDerivation({
      rnText: text,
      light: T.light,
      dark: T.dark,
      mappings: FIXTURE_MAPPINGS,
      registeredConflicts: {},
      rnOnlyBrandKeys: {},
      ...over,
    })
    assertSameLeafSets(text, p.spansByTable)
    return p
  }
  const has = (arr, t, path) => arr.some((x) => x.table === t && x.path === path)

  // ── A. 可派生面来自门的声明,不是第二张清单 ──
  const p0 = mk()
  ok(
    'A1 同名推导命中:text.tertiary ← --color-text-tertiary 记为已同步',
    has(p0.entries, 'rnTokens', 'text.tertiary') &&
      p0.entries.find((e) => e.table === 'rnTokens' && e.path === 'text.tertiary').status ===
        'derived-in-sync',
  )
  ok(
    'A2 MAPPINGS 声明命中(同名推不到的 vip.gold / brand.cta)也算可派生',
    !has(p0.unmanaged, 'rnTokens', 'vip.gold') && !has(p0.unmanaged, 'rnTokens', 'brand.cta'),
  )
  ok(
    'A3 源里已存在的值与副本等价 ⇒ 零写回(幂等的前提)',
    p0.changes.filter((c) => c.table === 'rnTokens').length === 0,
    `changes=${p0.changes.map((c) => `${c.table}.${c.path}`).join(',')}`,
  )
  ok(
    'A4 DEFAULT 折叠推导(success.DEFAULT ← --color-success,HSL 同色)已同步',
    p0.entries.find((e) => e.table === 'rnTokens' && e.path === 'success.DEFAULT').status ===
      'derived-in-sync',
  )
  ok(
    'A5 推不到同名变量 ⇒ 进不可派生清单并写明原因',
    p0.unmanaged.some(
      (u) => u.table === 'rnTokens' && u.path === 'gray.50' && /不猜语义/.test(u.reason),
    ),
  )
  ok(
    'A6 端内自造档 text.primary 不得被顺手并进 --color-foreground(不臆造映射)',
    has(p0.unmanaged, 'rnTokens', 'text.primary'),
  )
  ok(
    'A7 可派生集合精确(rnTokens 12 叶子里正好这 6 档):少一档 = 面被静默削窄,多一档 = 臆造了映射',
    (() => {
      const set = p0.entries
        .filter((e) => /^derived-/.test(e.status))
        .filter((e) => e.table === 'rnTokens')
        .map((e) => e.path)
        .sort()
        .join(',')
      return (
        set === 'brand.DEFAULT,brand.cta,success.DEFAULT,surface.light,text.tertiary,vip.gold' &&
        p0.tables.find((t) => t.table === 'rnTokens').managed === 6
      )
    })(),
    p0.entries
      .filter((e) => e.table === 'rnTokens' && /^derived-/.test(e.status))
      .map((e) => e.path)
      .join(','),
  )

  // ── B. 注释与遮罩:不得把散文当数据 ──
  ok(
    'B1 注释里的赋值(行注释伪定义 / 文档块 foreground)不得成为声明或叶子',
    !p0.entries.some((e) => e.path === 'foreground' || /'#0F0F0F'/.test(e.value || '')) &&
      p0.tables.every((t) => t.table !== 'rnTokens' || t.leaves === 12),
  )
  ok(
    'B2 阳性对照:不遮罩时注释里的伪定义会被当成表头(误锚更早的花括号)',
    (() => {
      const fake = '// 注释 export const rnTokens = { 假\nexport const rnTokens = { a: 1 } }\n'
      const mis = locateTable(fake, 'rnTokens')
      const right = locateTable(maskTs(fake), 'rnTokens')
      return !!mis && !!right && mis.bodyStart < right.bodyStart
    })(),
  )
  ok(
    'B3 CSS 注释里的 --color-fake 不得被当成源变量',
    !('---color-fake' in T.light) && !('--color-fake' in T.light),
  )

  // ── C. 源变了 ⇒ 副本跟着变(写回形态与幂等) ──
  const drifted = FIXTURE_RN.replace(
    "success: { DEFAULT: '#22c55e' }",
    "success: { DEFAULT: '#111111' }",
  )
  const pd = mk({}, drifted)
  const sw = pd.changes.find((c) => c.table === 'rnTokens' && c.path === 'success.DEFAULT')
  ok(
    'C1 未登记分歧 ⇒ 按源写回(源是唯一真相),形态取 RN 可解析的 hex6',
    !!sw && sw.from === '#111111' && /^#[0-9a-f]{6}$/.test(sw.to),
    sw ? `${sw.from} → ${sw.to} ← ${sw.srcVar}` : '没有产生写回',
  )
  const after = applyPlan(drifted, pd)
  const pa = mk({}, after)
  ok(
    'C2 写回后第二次计划零写回且整文件逐字节不变(幂等)',
    pa.changes.length === 0 && pa.markerInserts.length === 0 && applyPlan(after, pa) === after,
  )
  ok(
    'C3 写回只动那一个字面量:其余行逐字不变',
    (() => {
      const one = applyPlan(drifted, {
        changes: pd.changes.filter((c) => c.table === 'rnTokens'),
        markerInserts: [],
      })
      const a = drifted.split('\n')
      const b = one.split('\n')
      return (
        a.length === b.length &&
        b.filter((l, i) => l !== a[i]).length ===
          pd.changes.filter((c) => c.table === 'rnTokens').length
      )
    })(),
  )
  const rounding = FIXTURE_RN.replace(
    "success: { DEFAULT: '#22c55e' }",
    "success: { DEFAULT: '#21c45d' }",
  )
  ok(
    'C4 shadcn HSL 整数舍入(单通道差 1)= 同色两种编码 ⇒ 不写回(与门同一容差)',
    !has(mk({}, rounding).changes, 'rnTokens', 'success.DEFAULT'),
    JSON.stringify(mk({}, rounding).changes.map((c) => c.path)),
  )

  // ── D. 暗档与 cascade ──
  ok(
    'D1 暗表取 .dark 覆盖值:rnDarkTokens.danger.bright 由 #f87171 改写为 #ef4444',
    (() => {
      const c = p0.changes.find((x) => x.table === 'rnDarkTokens' && x.path === 'danger.bright')
      return !!c && c.to === '#ef4444'
    })(),
    JSON.stringify(
      p0.changes.filter((c) => c.table === 'rnDarkTokens').map((c) => `${c.path}→${c.to}`),
    ),
  )
  ok(
    'D2 .dark 有覆盖时暗表已同步(late.only)⇒ 零写回',
    p0.entries.find((e) => e.table === 'rnDarkTokens' && e.path === 'late.only').status ===
      'derived-in-sync',
  )
  ok(
    'D5 逐表可派生数精确(rnDarkTokens = 5,含 1 处待写回)',
    p0.tables.find((t) => t.table === 'rnDarkTokens').managed === 5 &&
      p0.tables.find((t) => t.table === 'rnDarkTokens').changes === 1,
  )
  ok(
    'D3 阳性对照:删掉 .dark 里那行后,同一副本立刻判成待写回(cascade 回退真的在参与比对)',
    (() => {
      const t2 = readTokenTables(FIXTURE_CSS.replace('  --color-late-only: #654321;\n', ''))
      const q = planDerivation({
        rnText: FIXTURE_RN,
        light: t2.light,
        dark: t2.dark,
        mappings: FIXTURE_MAPPINGS,
        registeredConflicts: {},
        rnOnlyBrandKeys: {},
      })
      return q.changes.some(
        (c) => c.table === 'rnDarkTokens' && c.path === 'late.only' && c.to === '#123456',
      )
    })(),
  )
  ok(
    'D4 明暗同值档(brand.cta 只在 .dark 靠 cascade 回退)在暗表也记为已同步',
    p0.entries.find((e) => e.table === 'rnDarkTokens' && e.path === 'brand.cta').status ===
      'derived-in-sync',
  )

  // ── E. 分歧与拒绝:不得静默择一 ──
  ok(
    'E1 BASE_CONFLICTS 已登记分歧 ⇒ 不写回,归不可派生并带登记理由',
    (() => {
      const r = mk({ registeredConflicts: { 'rnDarkTokens|danger.bright': '暗档层级差须人裁' } })
      return (
        !has(r.changes, 'rnDarkTokens', 'danger.bright') &&
        r.unmanaged.some(
          (u) =>
            u.table === 'rnDarkTokens' &&
            u.path === 'danger.bright' &&
            /BASE_CONFLICTS/.test(u.reason),
        )
      )
    })(),
  )
  ok(
    'E2 双源歧义(声明映射与同名推导给出不同值)⇒ 拒绝,不择一',
    (() => {
      const r = mk({
        mappings: [
          ...FIXTURE_MAPPINGS,
          {
            label: '故意冲突',
            rn: { light: ['rnTokens', 'success', 'DEFAULT'] },
            css: { light: '--color-danger-bright' },
          },
        ],
      })
      return r.refusals.some((x) => x.path === 'success.DEFAULT' && x.kind === 'dual-source')
    })(),
  )
  ok(
    'E3 源值形态 RN 不可解析(渐变)⇒ 拒绝写回而不是把 gradient 抄进令牌表',
    p0.refusals.some(
      (r) => r.table === 'rnTokens' && r.path === 'banner.DEFAULT' && r.kind === 'unsafe-form',
    ),
  )
  ok(
    'E4 拒绝项不得被计成"已同步"(假绿钉死)',
    p0.entries.find((e) => e.table === 'rnTokens' && e.path === 'banner.DEFAULT').status ===
      'refused',
  )

  // ── F. 受管块标记 ──
  ok(
    'F1 三张表都有可派生档 ⇒ 计划里带 3 处补标记',
    p0.markerInserts.length === 3,
    `inserts=${p0.markerInserts.length}`,
  )
  const marked = applyPlan(FIXTURE_RN, p0)
  const pm = mk({}, marked)
  ok(
    'F2 写入标记后再跑不重复插(幂等)且每表标记恰好一份',
    pm.markerInserts.length === 0 &&
      applyPlan(marked, pm) === marked &&
      (marked.match(new RegExp(MANAGED_MARKER, 'g')) || []).length === 3,
  )
  ok(
    'F3 标记落进表体第一段内容(被摘线时 hasManagedMarker 必判 false)',
    (() => {
      const loc = locateTable(maskTs(marked), 'rnTokens')
      return hasManagedMarker(marked, loc.bodyStart) && !hasManagedMarker(FIXTURE_RN, loc.bodyStart)
    })(),
  )

  // ── G. 不误伤:端内档 / 类型面 / 结构 ──
  ok(
    'G1 端内自造档(gray / text.primary / brand.dark)与单行多键写法逐字节留在原位',
    marked.includes("gray: { 50: '#fafafa', black: '#000' }") &&
      marked.includes("text: { primary: '#0A0A0A', tertiary: '#A3A3A3' }") &&
      marked.includes("dark: '#34D399'"),
  )
  ok(
    'G2 类型声明里的 `light: string` 不被当叶子(定位只认 export const)',
    marked.includes('export type RnThemeTokens = {\n  surface: { light: string }\n}'),
  )
  ok(
    'G3 单行多键里的可派生那一份能被精确改写(text 行只有 tertiary 动)',
    (() => {
      const d = FIXTURE_RN.replace("tertiary: '#A3A3A3'", "tertiary: '#AAAAAA'")
      const r = mk({}, d)
      const c = r.changes.find((x) => x.table === 'rnTokens' && x.path === 'text.tertiary')
      const w = applyPlan(d, { changes: [c], markerInserts: [] })
      return (
        !!c &&
        w.includes("text: { primary: '#0A0A0A', tertiary: '#a3a3a3' }") &&
        !w.includes('#AAAAAA') &&
        d.split('\n').length === w.split('\n').length
      )
    })(),
  )

  // ── H. 取不到输入必须大声(不冒绿) ──
  throws('H1 表名不存在 ⇒ 无法判定,不静默当"无需同步"', /定位不到/, () =>
    planDerivation({
      rnText: 'export const other = { a: "#000000" }',
      light: T.light,
      dark: T.dark,
      mappings: FIXTURE_MAPPINGS,
      registeredConflicts: {},
      rnOnlyBrandKeys: {},
    }),
  )
  throws('H2 MAPPINGS 形状不符 ⇒ 无法判定', /MAPPINGS/, () =>
    mk({ mappings: [{ label: '坏条目' }] }),
  )
  throws('H3 MAPPINGS 不是数组 ⇒ 无法判定(不按猜的形状派生)', /不是数组/, () =>
    mk({ mappings: {} }),
  )
  throws('H4 与门叶子集不一致 ⇒ 无法判定(跨行字符串字面量是我的解析盲区)', /叶子集不一致/, () => {
    const twoLine = FIXTURE_RN.replace("black: '#000'", "black: '#000\n000'")
    const p = planDerivation({
      rnText: twoLine,
      light: T.light,
      dark: T.dark,
      mappings: FIXTURE_MAPPINGS,
      registeredConflicts: {},
      rnOnlyBrandKeys: {},
    })
    assertSameLeafSets(twoLine, p.spansByTable)
  })

  // ── J. 覆盖面派生(源档 → RN 可达档) ──
  const J_RN = `export type RnThemeMode = 'light' | 'dark'
export const rnTokens = {
  brand: { DEFAULT: '#000000' },
}
export type RnTokens = typeof rnTokens
export type RnThemeTokens = { brand: { DEFAULT: string } }
export const rnLightTokens: RnThemeTokens = {
  brand: { DEFAULT: '#000000' },
}
export const rnDarkTokens: RnThemeTokens = {
  brand: { DEFAULT: '#FFFFFF' },
}
`
  const J_LIGHT = {
    '--color-brand': '#000000',
    '--color-black-50': 'rgba(0,0,0,0.5)',
    '--color-white-15': 'rgba(255,255,255,0.15)',
    '--color-not-a-color': '15 100% 50%',
  }
  const J_DARK = { '--color-black-50': 'rgba(0,0,0,0.7)' }
  const jPal = () => planPalette({ rnText: J_RN, light: J_LIGHT, dark: J_DARK })

  ok(
    'J1 档名推导确定性:`--color-black-50`→black50,`--color-primary`→primary,非色档形态→null',
    camelFromVar('--color-black-50') === 'black50' &&
      camelFromVar('--color-primary') === 'primary' &&
      camelFromVar('--spacing-4') === null &&
      camelFromVar('rgb(0,0,0)') === null,
  )
  ok(
    'J2 覆盖面:源里有而 RN 无同名档的进块 / 顶层已有档名不得被遮蔽 / 非色值形态不进 / 暗档缺项按 cascade 落回亮值',
    (() => {
      const p = jPal()
      const keys = p.entries.map((e) => e.key)
      const black = p.entries.find((e) => e.key === 'black50')
      const white = p.entries.find((e) => e.key === 'white15')
      return (
        JSON.stringify(keys) === '["black50","white15"]' &&
        black.dark === 'rgba(0,0,0,0.7)' &&
        white.dark === 'rgba(255,255,255,0.15)' &&
        p.skips.some((s) => s.name === '--color-brand' && /遮蔽/.test(s.why))
      )
    })(),
  )
  ok(
    'J3 写回幂等:应用一次后 stale=false,且块不进任何表体(表叶子集不受影响)',
    (() => {
      const p = jPal()
      const after = applyPalette(J_RN, p.block)
      const again = planPalette({ rnText: after, light: J_LIGHT, dark: J_DARK })
      return (
        p.stale &&
        !again.stale &&
        after.includes('export const rnCssLight: Record<string, string> = {') &&
        after.includes("black50: 'rgba(0,0,0,0.5)',") &&
        again.entries.length === p.entries.length
      )
    })(),
  )
  ok(
    'J4 源改一处 ⇒ 块当场落后(这才是"web 改值 RN 自动跟上"的可判形态)',
    (() => {
      const after = applyPalette(J_RN, jPal().block)
      const moved = planPalette({
        rnText: after,
        light: { ...J_LIGHT, '--color-black-50': 'rgba(0,0,0,0.42)' },
        dark: J_DARK,
      })
      return moved.stale && moved.block.includes('rgba(0,0,0,0.42)')
    })(),
  )
  throws('J5 标记不齐 ⇒ 无法判定,拒绝盲写(不静默追加第二块)', /标记不齐|收尾在开头之前/, () =>
    extractPaletteBlock(`${J_RN}${PALETTE_BEGIN} */\nx\n`),
  )
  ok(
    'J6 有水印行时块落在水印之前(§5c 载荷必须留在文件末)',
    (() => {
      const wm = `${J_RN}\u200b\u200c hidden-payload\n`
      const next = applyPalette(wm, jPal().block)
      const lines = next.split('\n').filter(Boolean)
      return /[\u200b-\u200f]/.test(lines[lines.length - 1]) && next.lastIndexOf('derived-palette:end') < next.lastIndexOf('\u200b')
    })(),
  )

  // ── K. 桶口对账(生成的表必须真的能被消费方取到) ──
  const K_BARREL_OK = `export {
  rnTokens,
  rnLightTokens,
  rnDarkTokens,
  getRnTokens,
  rnCssLight,
  rnCssDark,
  rnCssColor,
  type RnTokens,
} from './rn-tokens.js'
export const other = 1
`
  const K_BARREL_MISS = K_BARREL_OK.replace('  rnCssLight,\n  rnCssDark,\n  rnCssColor,\n', '')
  ok(
    'K1 桶口缺三个出口 ⇒ stale=true,补齐后三个名字都落进出囗块',
    (() => {
      const b = planBarrel({ indexText: K_BARREL_MISS, palettePresent: true })
      const blk = /export \{[\s\S]*?\} from '\.\/rn-tokens\.js'/.exec(b.next)?.[0] ?? ''
      return (
        b.stale &&
        b.missing.join(',') === 'rnCssLight,rnCssDark,rnCssColor' &&
        ['rnCssLight', 'rnCssDark', 'rnCssColor'].every((n) => blk.includes(`${n},`)) &&
        b.next.split("from './rn-tokens.js'").length - 1 === 1
      )
    })(),
  )
  ok(
    'K2 幂等:补齐之后再判 ⇒ stale=false(不会每轮都改一遍桶口)',
    planBarrel({ indexText: planBarrel({ indexText: K_BARREL_MISS, palettePresent: true }).next, palettePresent: true })
      .stale === false,
  )
  ok(
    'K3 块尚未生成 ⇒ 桶口不预先出口不存在的名字(否则 build 期悬空出口)',
    planBarrel({ indexText: K_BARREL_MISS, palettePresent: false }).stale === false,
  )
  throws('K4 块没有而桶口已出口 ⇒ 无法判定(悬空出口不静默放过)', /悬空出口/, () =>
    planBarrel({ indexText: K_BARREL_OK, palettePresent: false }),
  )
  throws('K5 桶口的 rn-tokens 出口块命中数不是 1 ⇒ 无法判定(不猜哪一块是桶口)', /无法定位桶口/, () =>
    planBarrel({ indexText: "export { a } from './x.js'\n", palettePresent: true }),
  )

  // ── I. 台账 ──
  const ledger = renderLedger(p0)
  ok(
    'I1 台账含逐表统计、合计行与逐档不可派生原因',
    /可派生 \d+ 档/.test(ledger) && /不可派生清单/.test(ledger) && /不猜语义/.test(ledger),
  )
  ok('I2 台账把拒绝项单列(不混进"已同步"数字)', /拒绝派生\(须人裁\)/.test(ledger))

  for (const r of results) console.info(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.info(
    failed
      ? `self-test 失败 ${failed} 条 / ${results.length} 条`
      : `✅ self-test 全通过(${results.length} 条)`,
  )
  process.exit(failed ? 1 : 0)
}

// ───────────────────────────────────────────────────────────────── CLI ─────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────
// 覆盖面派生(coverage):把 tokens.css 里**RN 尚无同名档**的色档整张搬进来。
//
// 为什么不能只做"值同步":rn-tokens.ts 的表是手挑的 194 叶(实测现读:可派生 117 / 不可派生 77),
// 而源侧有 309 变量 / 150 个可归一色档。端上要用的档不在表里 ⇒ 唯一出路就是写字面量 ——
// 量到的现场是 apps/mobile-rn + packages/app 里 87 枚色值字面量,其中 59 枚等于源里某档,
// 但只有 6 枚能走 RN 现有档。这就是"web 改一处 RN 不跟着动"的真成因:不是有人不肯用 token,
// 而是**想跟随源也无路可走**。补档必须自动化,否则每补一档都要人跑一次派生器再抄一次。
//
// 三条口径与值同步同源(§0.6):取块用 collectVars、色值可判性用 COLOR_LITERAL_RE、
// 明暗回退用与门 93 一致的 cascade 规则(.dark 没覆盖的档落回亮值)。
// ──────────────────────────────────────────────

export const PALETTE_BEGIN = '/* rn-tokens:derived-palette:begin —— 由 scripts/sync-rn-tokens.mjs 从 tokens.css 全量派生(勿手改;源改一处这里自动跟上)'
export const PALETTE_END = 'rn-tokens:derived-palette:end */'

/** `--color-black-50` → `black50`;推不出形态的一律返回 null(不猜)。 */
export function camelFromVar(name) {
  const m = /^--color-([a-z0-9-]+)$/.exec(String(name).trim())
  if (!m) return null
  const parts = m[1].split('-').filter(Boolean)
  if (parts.length === 0) return null
  const [first, ...rest] = parts
  return first + rest.map((p) => p[0].toUpperCase() + p.slice(1)).join('')
}

/**
 * @param {{rnText:string, light:Record<string,string>, dark:Record<string,string>}} o
 * @returns {{entries:Array<{key:string,name:string,light:string,dark:string}>,skips:Array<{name:string,why:string}>,block:string,stale:boolean,existing:boolean}}
 */
export function planPalette(o) {
  const taken = new Set()
  for (const l of scanLeaves(o.rnText)) taken.add(l.path.split('.')[0])
  const entries = []
  const skips = []
  const seenKey = new Map()
  for (const [name, lightVal] of Object.entries(o.light)) {
    if (!COLOR_LITERAL_RE.test(String(lightVal))) continue
    const key = camelFromVar(name)
    if (!key) {
      skips.push({ name, why: '变量名推不出档名(不猜语义)' })
      continue
    }
    if (taken.has(key)) {
      skips.push({ name, why: `RN 表里已有顶层档 ${key},派生块不得遮蔽它` })
      continue
    }
    if (seenKey.has(key)) {
      const prev = seenKey.get(key)
      const darkVal = o.dark[name] ?? lightVal
      if (prev.light === lightVal && prev.dark === darkVal) continue
      skips.push({ name, why: `档名 ${key} 已被 ${prev.name} 占用且值不同 ⇒ 两条都不搬,交人工命名` })
      continue
    }
    const darkVal = o.dark[name] ?? lightVal
    const rec = { key, name, light: String(lightVal).trim(), dark: String(darkVal).trim() }
    seenKey.set(key, rec)
    entries.push(rec)
  }
  const block = renderPaletteBlock(entries)
  const cur = extractPaletteBlock(o.rnText)
  return {
    entries,
    skips,
    block,
    existing: cur !== null,
    stale: cur === null || cur !== block,
  }
}

function q(v) {
  // 派生块落在 .ts 里,而 .ts 在格式门的射程内(FORMAT_EXTENSIONS 含 ts)⇒ 写法必须与 prettier
  // 的 singleQuote 同形,否则每次同步都给下一枚提交造一条新格式违规(§12e 那种"门拦自己产出"的坑)。
  const s = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return `'${s}'`
}

export function renderPaletteBlock(entries) {
  if (entries.length === 0) return ''
  const rows = (field) => entries.map((e) => `  ${e.key}: ${q(e[field])},`).join('\n')
  return [
    `${PALETTE_BEGIN} */`,
    '',
    '/** 源侧全量色档·亮档(RN 表里没有同名档的那些;键 = `--color-x-y` 去前缀后 camel 化) */',
    'export const rnCssLight: Record<string, string> = {',
    rows('light'),
    '}',
    '',
    '/** 源侧全量色档·暗档(.dark 未覆盖的档按 cascade 落回亮值,与守门 93 同一口径) */',
    'export const rnCssDark: Record<string, string> = {',
    rows('dark'),
    '}',
    '',
    '/**',
    ' * 按主题取源档。屏内取色的正确写法是 `rnCssColor(themeMode, \'black50\')`,不是 `\'rgba(0,0,0,0.5)\'` ——',
    ' * 后者在 tokens.css 改值后**不会**跟着变,而前者会(且明暗自动翻面)。',
    ' */',
    'export function rnCssColor(theme: RnThemeMode, key: string): string {',
    '  const table = theme === \'dark\' ? rnCssDark : rnCssLight',
    '  const value = table[key]',
    '  if (value === undefined)',
    "    throw new Error(`rnCssColor:源里没有 ${key} 档(派生块落后?跑 sync-rn-tokens)`)",
    '  return value',
    '}',
    '',
    `/* ${PALETTE_END}`,
  ].join('\n')
}

/** 取现有派生块全文(含首尾标记行);没有则 null。两个标记必须各命中一次,否则判"无法判定"。 */
export function extractPaletteBlock(rnText) {
  const beginCount = rnText.split('/* rn-tokens:derived-palette:begin').length - 1
  const endCount = rnText.split(`/* ${PALETTE_END}`).length - 1
  if (beginCount === 0 && endCount === 0) return null
  if (beginCount !== 1 || endCount !== 1)
    throw new UndeterminedError(`派生块标记不齐(begin ${beginCount} / end ${endCount})⇒ 无法定位,拒绝盲写`)
  const a = rnText.indexOf('/* rn-tokens:derived-palette:begin')
  const b = rnText.indexOf(`/* ${PALETTE_END}`)
  if (b < a) throw new UndeterminedError('派生块收尾在开头之前 ⇒ 标记错位')
  const tail = rnText.slice(b)
  const eol = tail.indexOf('\n')
  return rnText.slice(a, b + (eol < 0 ? tail.length : eol)).replace(/\s+$/, '')
}

/** 把派生块原位替换或追加到文件末(水印不可见行之前;§5c 的水印注入仍由写回口负责)。 */
export function applyPalette(rnText, block) {
  if (!block) return rnText
  const existing = extractPaletteBlock(rnText)
  if (existing !== null) return rnText.replace(existing, block)
  const lines = rnText.split('\n')
  const wmIdx = lines.length - 2
  const hasWatermark = wmIdx >= 0 && /[\u200b-\u200f\u2060]/.test(lines[wmIdx])
  const head = hasWatermark ? lines.slice(0, wmIdx).join('\n').replace(/\s+$/, '') : rnText.replace(/\s+$/, '')
  return `${head}\n\n${block}\n${hasWatermark ? `\n${lines.slice(wmIdx).join('\n')}` : ''}`
}

/** 扫 rn-tokens.ts 的顶层档名(用于"不得遮蔽已有手抄档"这条闸)。 */
function scanLeaves(rnText) {
  const out = []
  for (const name of Object.keys(TABLE_MODE)) {
    const loc = locateTable(maskTs(rnText), name)
    if (!loc) continue
    for (const l of collectLeafSpans(maskTs(rnText), rnText, loc.bodyStart, loc.bodyEnd)) out.push(l)
  }
  return out
}

/**
 * 桶口对账:派生器把表写进 rn-tokens.ts 之后,消费方走的是包入口 `@ihui/design-tokens` ——
 * 桶口是**显式具名出口**(不是 export *),所以新表若不加进 index.ts,取回来就是 undefined:
 * "生成好了但接不上"这一型 2026-10-26 实测过(rnCssLight 174 档进表且 tsc/build 全绿,
 * 而 `import { rnCssColor } from '@ihui/design-tokens'` 是 undefined)。不靠人记得改 index.ts。
 */
export const BARREL_REL = 'packages/design-tokens/src/index.ts'
export const PALETTE_EXPORT_NAMES = ['rnCssLight', 'rnCssDark', 'rnCssColor']

const barrelBlock = (text) => {
  const re = /export \{[^}]*\} from '\.\/rn-tokens\.js'/g
  const hits = text.match(re) ?? []
  if (hits.length !== 1)
    throw new UndeterminedError(`index.ts 里指向 ./rn-tokens.js 的具名出口块命中 ${hits.length} 处 ⇒ 无法定位桶口`)
  return hits[0]
}

/**
 * @param {{indexText:string, palettePresent:boolean}} o
 * @returns {{missing:string[], next:string, stale:boolean}}
 */
export function planBarrel({ indexText, palettePresent }) {
  const block = barrelBlock(indexText)
  if (!palettePresent) {
    // 覆盖面块还没生成 ⇒ 桶口不该先出口不存在的名字(那会造出 build 期的悬空出口)
    const leaking = PALETTE_EXPORT_NAMES.filter((n) => block.includes(`${n},`) || block.includes(`${n}\n`))
    if (leaking.length > 0)
      throw new UndeterminedError(`表里没有覆盖面块,桶口却出口了 ${leaking.join(',')} ⇒ 悬空出口,拒绝判定`)
    return { missing: [], next: indexText, stale: false }
  }
  const missing = PALETTE_EXPORT_NAMES.filter((n) => !new RegExp(`(^|[\\s,{])${n}[\\s,}]`, 'm').test(block))
  if (missing.length === 0) return { missing: [], next: indexText, stale: false }
  const next = indexText.replace(block, block.replace(/(getRnTokens,)/, `$1\n${missing.map((n) => `  ${n},`).join('\n')}`))
  if (next === indexText)
    throw new UndeterminedError('桶口里找不到 getRnTokens 锚点 ⇒ 拒绝盲插,交人工加出口')
  return { missing, next, stale: true }
}

// ──────────────────────────────────────────────

/**
 * 取材面(§0.4 同面同轮):默认写档读工作树(它就是要改那份);`--staged` 档读**索引 blob**,
 * 且绝不写盘 —— 提交链判的必须是"这一枚提交到底带了什么",而不是"盘上此刻是什么"。
 * 门 118 的口径:判据取正文一律走 face-reader,不在本文件里另写一份 git 取法。
 */
function loadInputs(staged) {
  const srcPath = resolve(ROOT, TOKENS_SOURCE_REL)
  const dstPath = resolve(ROOT, RN_TOKENS_REL)
  const barrelPath = resolve(ROOT, BARREL_REL)
  if (!staged) {
    for (const p of [srcPath, dstPath, barrelPath])
      if (!existsSync(p)) throw new UndeterminedError(`文件不存在:${p}`)
    return {
      dstPath,
      barrelPath,
      tokensCss: readFileSync(srcPath, 'utf8'),
      rnText: readFileSync(dstPath, 'utf8'),
      indexText: readFileSync(barrelPath, 'utf8'),
    }
  }
  const rels = [TOKENS_SOURCE_REL, RN_TOKENS_REL, BARREL_REL]
  const got = catBatch(ROOT, rels.map((r) => `:${r}`))
  const missing = rels.filter((r) => got.get(`:${r}`) == null)
  if (missing.length > 0)
    throw new UndeterminedError(`索引面取不到正文:${missing.join(', ')} ⇒ 不回落工作树,不记绿`)
  return {
    dstPath: null,
    barrelPath: null,
    tokensCss: String(got.get(`:${TOKENS_SOURCE_REL}`)),
    rnText: String(got.get(`:${RN_TOKENS_REL}`)),
    indexText: String(got.get(`:${BARREL_REL}`)),
  }
}

/** §5c:writeFileSync 产出 git 跟踪文件后紧随一次水印注入(载荷完好时是 skip-done,幂等)。 */
function writeAndWatermark(dstPath, next) {
  writeFileSync(dstPath, next, 'utf8')
  execFileSync(process.execPath, [resolve(ROOT, 'scripts/watermark.mjs'), 'inject', dstPath], {
    stdio: 'inherit',
    windowsHide: true,
    timeout: 60_000,
  })
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.info(
      `sync-rn-tokens.mjs — tokens.css → rn-tokens.ts 原位写回(派生态)\n` +
        `  (无参数)     写回(幂等)\n  --check      只校验(待写回 / 拒绝项 ⇒ exit 1)\n` +
        `  --list       打印派生台账(可派生 + 不可派生 + 原因)\n  --self-test  判据自检\n` +
        `源: ${TOKENS_SOURCE_REL}\n目标: ${RN_TOKENS_REL}`,
    )
    process.exit(0)
  }
  if (args.includes('--self-test')) return selfTest()

  const isCheck = args.includes('--check')
  const isList = args.includes('--list')
  const isStaged = args.includes('--staged')
  // 只读档:`--list` 是台账巡检工具,不是写回的前奏。第一版把它当"顺带打印",于是它照样落盘 ——
  // 文档写着"零副作用"而代码在写文件,这种分叉只能由代码侧收口(现在三个只读档都不写)。
  const readOnly = isCheck || isList || isStaged
  const { dstPath, barrelPath, tokensCss, rnText, indexText } = loadInputs(isStaged)
  const tables = readTokenTables(tokensCss)
  if (Object.keys(tables.light).length === 0)
    throw new UndeterminedError('tokens.css 取到 0 个变量 ⇒ 无法判定(不冒绿)')
  const plan = planDerivation({ rnText, light: tables.light, dark: tables.dark })
  assertSameLeafSets(rnText, plan.spansByTable)
  const pal = planPalette({ rnText, light: tables.light, dark: tables.dark })
  // 桶口判的是"那份块在不在源里":--staged 档以被审面(索引 blob)上是否已有块为准;
  // 写档则按"本轮写完就有"算,免得第一次运行桶口落后要跑两次才对账。
  const barrel = planBarrel({ indexText, palettePresent: isStaged ? pal.existing : pal.entries.length > 0 })

  console.info(
    `[sync-rn-tokens] 可派生 ${plan.managedCount} 档 / 不可派生 ${plan.unmanaged.length} 档 / ` +
      `拒绝 ${plan.refusals.length} 档 / 待写回 ${plan.changes.length} 档 / 待补标记 ${plan.markerInserts.length} 处`,
  )
  console.info(
    `[sync-rn-tokens] 覆盖面派生:源档 ${pal.entries.length} 枚进块 / 跳过 ${pal.skips.length} 枚 / ` +
      `${pal.stale ? (pal.existing ? '块内容落后于源' : '块尚未生成') : '块与源一致'}`,
  )
  console.info(
    `[sync-rn-tokens] 桶口对账:${barrel.stale ? `缺 ${barrel.missing.join(',')} 出口` : '覆盖面表的三个名字都在桶口'}`,
  )
  if (isList) console.info(renderLedger(plan))
  if (isList && pal.skips.length > 0)
    console.info(
      `跳过台账(前 20):\n${pal.skips.slice(0, 20).map((s) => `  ${s.name} —— ${s.why}`).join('\n')}`,
    )

  const needsWrite =
    plan.changes.length > 0 ||
    plan.markerInserts.length > 0 ||
    (pal.stale && pal.block !== '') ||
    barrel.stale
  if (needsWrite && !readOnly) {
    let next = plan.changes.length > 0 || plan.markerInserts.length > 0 ? applyPlan(rnText, plan) : rnText
    if (pal.stale && pal.block !== '') next = applyPalette(next, pal.block)
    if (next !== rnText) writeAndWatermark(dstPath, next)
    if (barrel.stale) writeAndWatermark(barrelPath, barrel.next)
    console.info(
      `[sync-rn-tokens] ✅ 已原位写回(值 ${plan.changes.length} 处 + 标记 ${plan.markerInserts.length} 处 + 覆盖面块 ${pal.entries.length} 档 + 桶口出口 ${barrel.missing.length} 个)`,
    )
    // 本脚本只改 src;RN 经包入口(main/exports)消费的是 dist,不重建则 Metro 永远吃旧值
    // (2026-10-20 实测:glass.bg 从 0.66 调到 0.3,设备上四轮毫无变化,dist 仍停在 0.66)。
    console.info(
      '[sync-rn-tokens] ⚠️ 仅写回 src;RN 端读的是 dist —— 请接着运行: pnpm --filter @ihui/design-tokens build',
    )
  } else if (!needsWrite && plan.refusals.length === 0) {
    console.info('[sync-rn-tokens] ✅ rn-tokens.ts 的派生面与 tokens.css 一致(端内档未受影响)')
    return
  }

  for (const r of plan.refusals)
    console.error(`[sync-rn-tokens] ❌ 拒绝派生 ${r.table} ${r.path} [${r.kind}] —— ${r.detail}`)
  if ((isCheck || isStaged) && needsWrite)
    console.error(
      `[sync-rn-tokens] ❌ ${isStaged ? '索引面' : '被检面'}落后于源:待写回 ${plan.changes.length} 档、待补标记 ${plan.markerInserts.length} 处、覆盖面块 ${pal.stale ? `落后 ${pal.entries.length} 档` : '与源一致'}、桶口缺 ${barrel.missing.length} 个出口 ⇒ 跑 node scripts/sync-rn-tokens.mjs 后把所改文件同批提交`,
    )
  // 拒绝项任何档位都要喊(--list 也不放过);纯漂移只在只读档计失败,那是判据而非台账的。
  if (isCheck || isStaged || plan.refusals.length > 0) process.exit(1)
}

// §22d:CLI 直接执行才跑主流程;被测试 import 时不得有读盘 / 写盘副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    if (e instanceof UndeterminedError) console.error(`[sync-rn-tokens] ❌ 无法判定:${e.message}`)
    else console.error(`[sync-rn-tokens] ❌ 脚本自身异常:\n${e?.stack ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  UndeterminedError,
  TABLE_MODE,
  MANAGED_MARKER,
  MARKER_COMMENT,
  COLOR_LITERAL_RE,
  TOKENS_SOURCE_REL,
  RN_TOKENS_REL,
  maskTs,
  locateTable,
  collectLeafSpans,
  hasManagedMarker,
  readTokenTables,
  indexMappings,
  rnLiteralFromSource,
  planDerivation,
  assertSameLeafSets,
  applyPlan,
  renderLedger,
  PALETTE_BEGIN,
  PALETTE_END,
  camelFromVar,
  planPalette,
  renderPaletteBlock,
  extractPaletteBlock,
  applyPalette,
  BARREL_REL,
  PALETTE_EXPORT_NAMES,
  planBarrel,
  FIXTURE_CSS,
  FIXTURE_RN,
  FIXTURE_MAPPINGS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
