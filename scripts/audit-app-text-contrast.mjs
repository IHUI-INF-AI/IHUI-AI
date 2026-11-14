#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// ============================================================
// packages/app(RN 共享屏)文字/图标 token 对比度审计(**常设只读尺子,未接提交链**)
// ============================================================
//
// 立因(现读,不是假想):2026-11-14 视觉治理批次里,"把 tertiary 全量换 secondary"
// 只换了 `color: tk.text.tertiary`(style 属性形态),漏了非 style 形态:
//   · 图标 prop        `<Search color={tk.text.tertiary} />`
//   · 输入占位符        `placeholderTextColor={tk.text.tertiary}`
//   · 未选中态          `inactiveColor={tk.text.tertiary}`
//   · 字型工厂参数      `textStyles.label(tk.text.tertiary)`
//   · 函数返回值        `return tk.text.tertiary`
//   · 骨架屏 tint      `tintColor={tk.text.tertiary}`
// 于是"残留 0"的计数自证成立,实际仍有 440 处 tertiary 图标压在浅底上(2.12–2.31)。
// 本尺子钉的是**消费面的每一处 token 取值**,不分它写在 style 还是 prop 里。
//
// ── 判据(唯一)。设计原则:只判"不需要知道上下文就能断定错"的那一类。 ──
//
// 前几版尝试"猜每一处配什么底"全部失败,产生大量假红(白字配黑 CTA 算成 1.09、
// `return tk.warning.amberLight` 返回一个浅底算成 1.02)。假红比漏检更贵 ——
// 它会逼人开始跳门(AGENTS.md §0.2)。所以这里改成**承载面穷举法**:
//
//   对每一处前景 token 取值,量它在该端**全部中性承载面**上的对比度
//   (浅:surface.bg / surface.card / surface.muted;深:同三档):
//     · 只要在**任意一个**承载面上达标 ⇒ 它"有可用位置",不判红(可能只是配错,交人工);
//     · 在**全部**承载面上都不达标 ⇒ 无争议的缺陷,判红 —— 因为无论它压在哪,
//       都不可能读清。这一条不需要知道它实际压在哪,因此零假红。
//
//   门槛:文字 4.5(WCAG AA)、图标/图形 3.0(WCAG 1.4.11 非文本对比)。
//
//   分工:
//     ① failures(确定缺陷,可机器修):全承载面皆不达标。
//     ② narrow(可用位置很窄,需人工确认):至少一面达标,但另有一面不达标。
//        —— 只报告不判红;它是"这处换过底就会坏"的预警,不是当下的错误。
//   底色族(surface.* / *light* / border.* / overlay.*)不当前景判。
//   反白族(ON-* / brand.ctaForeground / text.inverse …)本就是配特定底用的,单列待确认。
//
// 三态(§0.3):0 通过 / 1 有确定缺陷 / 2 未判定。取不到被审面、token 表解不出、
// **扫到 0 处 token 取值**(消费面消失 ⇒ 尺子成摆设)一律 exit 2,不记绿也不冒红。
//
// 用法:
//   node scripts/audit-app-text-contrast.mjs [--json out.json] [--verbose]
//   node scripts/audit-app-text-contrast.mjs --self-test
//
// 注意:本脚本**只读**,不改任何文件,也不在提交链上(接线须满足守门 89 R4)。

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SCAN_DIR = 'packages/app/src'
const TOKENS_SRC = 'packages/design-tokens/src/rn-tokens.ts'

const AA_TEXT = 4.5
const AA_GRAPHIC = 3.0

/** 该端全部中性承载面(这四处是所有页面/卡片/输入井的底)。 */
const SURFACES = ['surface.bg', 'surface.card', 'surface.muted']

/** 反白族:本义是压在某品牌/状态底上的字或图,单列待确认,不参与承载面穷举。 */
const INVERSE_FG = new Set([
  'brand.ctaForeground', 'brand.foreground', 'surface.onBrand', 'text.inverse',
  'selection.foreground', 'brandAccent.foreground',
  'error.onBg', 'error.text', 'success.onGreen', 'success.deepText',
  'warning.onAmber', 'warning.amberText', 'danger.deepText',
])

/** 底色族:它是"底"不是"字",即使写在 return / 变量里也不当前景判。 */
export function isBackgroundFamily(field) {
  if (/^surface\.|^border\.|^overlay\.|^glass\./.test(field)) return true
  if (/(?:^|\.)(?:bg|card|muted|chrome|inputBg)$/.test(field)) return true
  const leaf = field.split('.').pop() || ''
  if (/lightest$|lighter$|light$|Light$/.test(leaf)) return true
  return false
}

export function isInverseFamily(field) {
  return INVERSE_FG.has(field)
}

// ───────────────────────── 纯判据(可被镜像测试 import,§22c)─────────────────────────

/** 把 CSS/TS 颜色字面量解成 [r,g,b,a];解不出返回 null(调用方按"未判定"处理)。 */
export function toRgba(v) {
  const s = String(v || '').trim()
  const hex6 = s.match(/^#([0-9a-f]{6})$/i)
  if (hex6) {
    const h = hex6[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
  }
  const hex3 = s.match(/^#([0-9a-f]{3})$/i)
  if (hex3) {
    const h = hex3[1]
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1]
  }
  const rgba = s.match(/^rgba?\(([^)]+)\)$/i)
  if (rgba) {
    const p = rgba[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    if (p.length >= 3 && p.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [p[0], p[1], p[2], p.length >= 4 && Number.isFinite(p[3]) ? p[3] : 1]
    }
  }
  return null
}

function relLum(c) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

/** WCAG 相对亮度比;任一解不出 ⇒ null(不得当成 0,也不得当成通过)。 */
export function contrast(fg, bg) {
  if (!fg || !bg) return null
  const a = fg[3] === undefined ? 1 : fg[3]
  const base = a >= 1 ? fg : [0, 1, 2].map((i) => Math.round(a * fg[i] + (1 - a) * bg[i]))
  const L1 = relLum(base)
  const L2 = relLum(bg)
  return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2)
}

/**
 * 从 rn-tokens.ts 源码里抽出 `rnLightTokens` / `rnDarkTokens` 两个对象字面量的扁平色表。
 * 必须锚定 `export const <名字>` —— 文件前面还有 `interface RnThemeTokens` 的同名
 * 字段声明,裸 indexOf 会先命中类型声明,把形状当值解析(实测踩过:解出空表)。
 */
export function parseRnTokenTables(ts) {
  const grab = (marker) => {
    const decl = new RegExp(`export\\s+const\\s+${marker}\\b[^=]*=`)
    const dm = decl.exec(ts)
    if (!dm) return null
    const braceStart = ts.indexOf('{', dm.index + dm[0].length - 1)
    if (braceStart < 0) return null
    let depth = 0
    let end = -1
    for (let i = braceStart; i < ts.length; i += 1) {
      if (ts[i] === '{') depth += 1
      else if (ts[i] === '}') {
        depth -= 1
        if (depth === 0) { end = i; break }
      }
    }
    if (end < 0) return null
    return ts.slice(braceStart, end + 1)
  }

  const flat = (block) => {
    const out = {}
    const parseObject = (src, pos, prefix) => {
      let i = pos + 1
      while (i < src.length) {
        while (i < src.length) {
          if (/\s/.test(src[i])) { i += 1; continue }
          if (src[i] === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue }
          if (src[i] === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 2; continue }
          break
        }
        if (i >= src.length) break
        if (src[i] === '}') { i += 1; break }
        if (src[i] === ',') { i += 1; continue }
        let key = null
        const q = src[i]
        if (q === '"' || q === "'") {
          const close = src.indexOf(q, i + 1)
          if (close < 0) break
          key = src.slice(i + 1, close)
          i = close + 1
        } else {
          const k = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))
          if (!k) { i += 1; continue }
          key = k[0]
          i += k[0].length
        }
        while (i < src.length && /\s/.test(src[i])) i += 1
        if (src[i] !== ':') continue
        i += 1
        while (i < src.length && /\s/.test(src[i])) i += 1
        const full = prefix ? `${prefix}.${key}` : key
        if (src[i] === '{') {
          i = parseObject(src, i, full).pos
        } else if (src[i] === '"' || src[i] === "'") {
          const close = src.indexOf(src[i], i + 1)
          if (close < 0) break
          const val = src.slice(i + 1, close)
          if (toRgba(val)) out[full] = val
          i = close + 1
        } else {
          let d = 0
          while (i < src.length) {
            if (src[i] === '{') d += 1
            else if (src[i] === '}') { if (d === 0) break; d -= 1 }
            else if (src[i] === ',' && d === 0) break
            i += 1
          }
        }
      }
      return { pos: i }
    }
    parseObject(block, 0, '')
    return out
  }

  const lightBlock = grab('rnLightTokens')
  const darkBlock = grab('rnDarkTokens')
  if (!lightBlock || !darkBlock) return null
  return { light: flat(lightBlock), dark: flat(darkBlock) }
}

/** 依据调用形态判定门槛:文字 4.5 / 图形 3.0。 */
export function thresholdFor(kind) {
  return kind === 'graphic' ? AA_GRAPHIC : AA_TEXT
}

/**
 * 在一行里定位 token 取值并归类形态。
 * 返回 [{ field, kind, offset }] —— kind: 'text' | 'graphic'
 */
export function extractTokenUses(line) {
  const out = []
  const re = /\b([A-Za-z_$][\w$]*)\.((?:[a-zA-Z][\w$]*)(?:\.[a-zA-Z][\w$]*)*)/g
  let m
  while ((m = re.exec(line))) {
    const prefix = m[1]
    const path = m[2]
    if (!/^(tk|tokens|baseTokens|rnTokens|rnDarkTokens|rnLightTokens|theme|colors)$/.test(prefix)) continue
    if (!/^(text|surface|brand|brandAccent|success|danger|warning|error|border|vip|glass|selection|modelType|agentName|gray)\./.test(path)) continue

    // 只看"这个 token 的键"本身:回溯到最近的 `键:` / `键=`,中间不许跨越逗号/分号
    // (否则会把同一行前一个键的形态套到当前取值上 —— 实测踩过)。
    const before = line.slice(Math.max(0, m.index - 80), m.index)
    const seg = before.slice(Math.max(before.lastIndexOf(','), before.lastIndexOf(';')) + 1)
    const keyCtx = /([A-Za-z_$][\w$]*)\s*[:=]\s*\{?\s*(?:\([^)]*\)\s*=>\s*)?$/.exec(seg)
    const keyName = keyCtx ? keyCtx[1] : null

    // 底色位:显式底色键、`xxxBg` / `xxxBackground` 变量名 —— 它在做"底",不当前景判
    const varName = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^;]*$/.exec(seg)
    const targetIsBg = !!varName && /(?:Bg|Background)$/.test(varName[1])
    const keyIsBg = !!keyName && (/^(bg|fill|shadowColor|border|borderColor|backgroundColor|bgColor)$/.test(keyName)
      || /(?:Bg|Background)$/.test(keyName))
    if (targetIsBg || keyIsBg) {
      out.push({ field: path, kind: 'bg', offset: m.index })
      continue
    }

    let kind = 'graphic'
    if (keyName === 'placeholderTextColor' || keyName === 'inactiveColor' || keyName === 'activeColor') kind = 'text'
    else if (keyName === 'color') kind = /color\s*=?\s*\{\s*$/.test(seg) ? 'graphic' : 'text'
    else if (keyName && /^(tintColor|iconColor|thumbColor|trackColor|inactiveTintColor)$/.test(keyName)) kind = 'graphic'
    else if (keyName && /^(text|label|title|subtitle|placeholder|message|hint)\w*$/i.test(keyName)) kind = 'text'
    out.push({ field: path, kind, offset: m.index })
  }
  return out
}

/**
 * 承载面穷举:返回 { allFail, someFail, values } —— values 是各承载面上的比值。
 * 只有"全部承载面都不达标"才 allFail(零假红)。
 */
export function judge(field, kind, light, dark, surfaces = SURFACES) {
  const th = thresholdFor(kind)
  const fgL = light[field]
  const fgD = dark[field]
  if (!fgL || !fgD) return { allFail: false, someFail: false, undetermined: true, values: {} }
  const values = {}
  let pass = 0
  let fail = 0
  let unknown = 0
  for (const s of surfaces) {
    const bgL = light[s]
    const bgD = dark[s]
    if (!bgL || !bgD) { unknown += 1; continue }
    const cL = contrast(fgL, bgL)
    const cD = contrast(fgD, bgD)
    if (cL === null || cD === null) { unknown += 1; continue }
    values[s] = { light: cL, dark: cD }
    // 该承载面分浅/深两档:两档都达标才算这个承载面通过
    if (cL >= th && cD >= th) pass += 1
    else fail += 1
  }
  if (!pass && !fail) return { allFail: false, someFail: false, undetermined: true, values, threshold: th }
  return {
    allFail: fail > 0 && pass === 0 && unknown === 0,
    someFail: fail > 0 && pass > 0,
    undetermined: false,
    values,
    threshold: th,
  }
}

// ───────────────────────── 采集 ─────────────────────────

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name === '__snapshots__') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(full)
  }
  return out
}

function run() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) return selfTest()
  const verbose = args.includes('--verbose')
  const jsonIdx = args.indexOf('--json')
  const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null

  const scanRoot = resolve(ROOT, SCAN_DIR)
  let files
  try {
    files = walk(scanRoot)
  } catch (e) {
    console.error(`未判定: 取不到被审面 ${SCAN_DIR} —— ${e.message}`)
    process.exit(2)
  }
  if (!files.length) {
    console.error(`未判定: ${SCAN_DIR} 下枚举到 0 个源码文件(消费面消失 ⇒ 尺子成摆设)`)
    process.exit(2)
  }

  let ts
  try {
    ts = readFileSync(resolve(ROOT, TOKENS_SRC), 'utf8')
  } catch (e) {
    console.error(`未判定: 取不到 token 源 ${TOKENS_SRC} —— ${e.message}`)
    process.exit(2)
  }
  const tables = parseRnTokenTables(ts)
  if (!tables) {
    console.error(`未判定: ${TOKENS_SRC} 里解不出 rnLightTokens / rnDarkTokens`)
    process.exit(2)
  }
  const light = Object.fromEntries(Object.entries(tables.light).map(([k, v]) => [k, toRgba(v)]))
  const dark = Object.fromEntries(Object.entries(tables.dark).map(([k, v]) => [k, toRgba(v)]))
  for (const s of SURFACES) {
    if (!light[s] || !dark[s]) {
      console.error(`未判定: token 表里取不到承载面 ${s}`)
      process.exit(2)
    }
  }

  let scanned = 0
  const failures = []
  const narrow = []
  const inverse = []
  const undetermined = []
  const seen = new Set()

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      undetermined.push({ file: rel, reason: 'read-failed' })
      continue
    }
    src.split(/\r?\n/).forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      for (const u of extractTokenUses(line)) {
        scanned += 1
        // 明暗三元分支(如 `dark ? tk.x : tk.y`)无法静态归一 ⇒ 如实标出交人工复核,
        // 不硬套一档(硬套会放假红,比漏检更贵,AGENTS.md §0.2)
        const themeBranchy = /(?:dark|isDark)\s*\?|colorScheme\s*===\s*'dark'/.test(line)
        const rec = { file: rel, line: i + 1, field: u.field, kind: u.kind, themeBranch: themeBranchy, snippet: line.trim().slice(0, 150) }
        if (u.kind === 'bg' || isBackgroundFamily(u.field)) continue
        if (isInverseFamily(u.field)) { inverse.push(rec); continue }
        const j = judge(u.field, u.kind, light, dark)
        if (j.undetermined) { undetermined.push({ ...rec, reason: 'token-or-surface-unparseable' }); continue }
        if (j.allFail) {
          const key = `${rel}:${i + 1}:${u.field}`
          if (seen.has(key)) continue
          seen.add(key)
          failures.push({ ...rec, threshold: j.threshold, surfaces: j.values })
        } else if (j.someFail) {
          narrow.push({ ...rec, threshold: j.threshold, surfaces: j.values })
        }
      }
    })
  }

  if (scanned === 0) {
    console.error(`未判定: ${SCAN_DIR} 下枚举到 0 处 token 取值(尺子成摆设)`)
    process.exit(2)
  }

  const tally = (arr) => arr.reduce((acc, f) => { acc[f.field] = (acc[f.field] || 0) + 1; return acc }, {})
  const byField = tally(failures)
  const report = {
    scannedFiles: files.length,
    scannedUses: scanned,
    failures: failures.length,
    failuresByField: byField,
    narrowWarnings: narrow.length,
    inverseUnpaired: inverse.length,
    undetermined: undetermined.length,
    surfaces: SURFACES,
    thresholds: { text: AA_TEXT, graphic: AA_GRAPHIC },
  }

  console.log('=== packages/app 文字/图标 token 对比度审计(承载面穷举法) ===')
  console.log(`源码文件: ${report.scannedFiles}    token 取值: ${report.scannedUses}`)
  console.log(`承载面: ${SURFACES.join(' / ')} 门槛: 文字 ${AA_TEXT} / 图形 ${AA_GRAPHIC}`)
  console.log('')
  console.log(`① 确定缺陷(全部承载面皆不达标): ${failures.length}`)
  console.log(`② 窄位预警(部分承载面不达标,需人工确认): ${narrow.length}`)
  console.log(`   反白族待确认配底(不判红): ${inverse.length}    未判定: ${undetermined.length}`)

  if (failures.length) {
    console.log('\n--- ① 确定缺陷 按 token ---')
    Object.entries(byField).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`))
    console.log('\n--- ① 明细 ---')
    const sorted = [...failures].sort((a, b) => {
      const wa = Math.min(...Object.values(a.surfaces).map((s) => Math.min(s.light, s.dark)))
      const wb = Math.min(...Object.values(b.surfaces).map((s) => Math.min(s.light, s.dark)))
      return wa - wb
    })
    sorted.slice(0, verbose ? sorted.length : 40).forEach((f) => {
      const vals = Object.entries(f.surfaces).map(([s, v]) => `${s.split('.')[1]}:L${v.light}/D${v.dark}`).join(' ')
      console.log(`  ${f.file}:${f.line}  ${f.field} (${f.kind}, 阈值 ${f.threshold})`)
      console.log(`      ${vals}`)
      console.log(`      ${f.snippet}`)
    })
    if (!verbose && failures.length > 40) console.log(`  ... 其余 ${failures.length - 40} 条加 --verbose 或看 --json`)
  } else {
    console.log('\n① 无确定缺陷。')
  }

  if (narrow.length) {
    console.log('\n--- ② 窄位预警 按 token(前 20) ---')
    Object.entries(tally(narrow)).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`))
  }

  if (jsonOut) {
    writeFileSync(resolve(ROOT, jsonOut), JSON.stringify({ report, failures, narrow, inverse, undetermined }, null, 2), 'utf8')
    console.log(`\nJSON: ${jsonOut}`)
  }

  process.exit(failures.length ? 1 : 0)
}

// ───────────────────────── 自检 ─────────────────────────

function selfTest() {
  const t = (name, cond) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
    if (!cond) process.exitCode = 1
  }
  t('tertiary(#A3A3A3) on #F5F5F5 < 3.0', contrast(toRgba('#A3A3A3'), toRgba('#F5F5F5')) < 3)
  t('secondary(#666666) on #F5F5F5 >= 4.5', contrast(toRgba('#666666'), toRgba('#F5F5F5')) >= 4.5)
  t('unparseable color -> null contrast', contrast(toRgba('not-a-color'), toRgba('#fff')) === null)
  t('graphic 3.0 < text 4.5', thresholdFor('graphic') === 3 && thresholdFor('text') === 4.5)
  t('white on black CTA = 21:1 (not 1.09)', contrast(toRgba('#FFFFFF'), toRgba('#000000')) === 21)

  // 形态识别:非 style 形态必须被扫到
  t('icon prop color={} -> graphic',
    extractTokenUses('  <Search color={tk.text.tertiary} />').some((u) => u.field === 'text.tertiary' && u.kind === 'graphic'))
  t('placeholderTextColor -> text',
    extractTokenUses('  placeholderTextColor={tk.text.tertiary}').some((u) => u.field === 'text.tertiary' && u.kind === 'text'))
  t('style color: -> text',
    extractTokenUses('  color: tk.text.tertiary,').some((u) => u.field === 'text.tertiary' && u.kind === 'text'))
  t('bg: arrow still captured',
    extractTokenUses('    bg: (tk) => tk.warning.light,').some((u) => u.field === 'warning.light'))

  // 语义分族
  t('warning.amberLight is background family', isBackgroundFamily('warning.amberLight'))
  t('surface.light is background family', isBackgroundFamily('surface.light'))
  t('success.lightest is background family', isBackgroundFamily('success.lightest'))
  t('text.secondary is NOT background family', !isBackgroundFamily('text.secondary'))
  t('brand.ctaForeground is inverse family', isInverseFamily('brand.ctaForeground'))

  const realTs = readFileSync(resolve(ROOT, TOKENS_SRC), 'utf8')
  const real = parseRnTokenTables(realTs)
  const R = { light: Object.fromEntries(Object.entries(real.light).map(([k, v]) => [k, toRgba(v)])), dark: Object.fromEntries(Object.entries(real.dark).map(([k, v]) => [k, toRgba(v)])) }
  t('parses real rn-tokens.ts (light non-empty)', Object.keys(real.light).length > 40)
  t('does not mistake type declaration for value', real.light['surface.bg'] === '#F5F5F5')

  // 判据的关键反证(两条都得成立,否则就是假红/漏检)
  const jt = judge('text.tertiary', 'graphic', R.light, R.dark)
  t('tertiary fails on ALL surfaces (confirmed defect)', jt.allFail === true)
  const js = judge('text.secondary', 'text', R.light, R.dark)
  t('secondary passes on ALL surfaces (not a defect)', js.allFail === false && js.someFail === false)
  const jg = judge('vip.gold', 'graphic', R.light, R.dark)
  t('vip.gold fails all light surfaces (real 1.29 defect)', jg.allFail === true)

  if (!process.exitCode) console.log('\n全部自检通过。')
  process.exit(process.exitCode || 0)
}

/**
 * 供镜像测试 import 的判据出口(§22c:测试只准 import,不许复制任何色值/阈值/正则)。
 */
export const __test__ = {
  toRgba,
  contrast,
  parseRnTokenTables,
  thresholdFor,
  extractTokenUses,
  judge,
  isBackgroundFamily,
  isInverseFamily,
  SURFACES,
  AA_TEXT,
  AA_GRAPHIC,
  SCAN_DIR,
  TOKENS_SRC,
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()
