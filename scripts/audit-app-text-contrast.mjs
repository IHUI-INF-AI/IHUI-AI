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
// 判据(唯一)。先把每个 token 取值分成三类,再分类判定 —— 这是本尺子最重要的一条:
//   · **前景族**(BACKGROUND_FAMILY 之外、明确当字/图用的档):参与对比度判定。
//   · **底色族**(surface.* / *light* / *.bg / *.card / *.muted / border.*):它是"底",
//     即使写在 `return` / 变量里也不当前景判 —— 否则会把 `return tk.warning.amberLight`
//     (返回一个浅琥珀**底**)算成 1.02 假红(实测踩过)。
//   · **反白族**(ON-* 语义):本义是压在某个品牌/状态底上的字,脱离配对谈对比度无意义;
//     无配对时只记 unpaired-inverse(待人工确认配底),**不判红** —— 否则"白字压黑 CTA
//     = 21:1"会被算成 1.09(实测踩过)。
//
// 判定分两级,对应两种处置动作:
//   ① **failures(确定,可自动改)**:前景族 token 无配对,压默认承载面 surface.bg 不达标。
//      这是上一轮那 440 处 tertiary 的同型判法,可由机器直接换档。
//   ② **suspected(需人工定档)**:前景与底色在**紧凑块**内配对后不达标 —— 例如
//      `badgeOn: { color: success.DEFAULT, backgroundColor: success.light }` = 2.16。
//      这类不能机械换色:要么改底,要么改字,要么补 on-color 语义 token(架构决策)。
//
// 门槛:文字 4.5(WCAG AA)、图标/图形 3.0(WCAG 1.4.11 非文本对比)。
//
// 三态(§0.3):0 通过 / 1 有确定失败 / 2 未判定。取不到被审面、token 表解不出、
// **扫到 0 处 token 取值**(消费面消失 ⇒ 尺子成摆设)一律 exit 2,不记绿也不冒红。
//
// 用法:
//   node scripts/audit-app-text-contrast.mjs [--json out.json]
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

/** 反白族(ON-* 语义):本义是压在某底上的字/图,无配对时只报待确认。 */
const INVERSE_FG = new Set([
  'brand.ctaForeground', 'brand.foreground', 'surface.onBrand', 'text.inverse',
  'selection.foreground', 'brandAccent.foreground',
  'error.onBg', 'error.text', 'success.onGreen', 'success.deepText',
  'warning.onAmber', 'warning.amberText', 'danger.deepText',
])

/** 底色族:即使出现在前景位(return / 变量)也按"底"处理,不当前景判。 */
export function isBackgroundFamily(field) {
  if (/^surface\./.test(field)) return true
  if (/^border\./.test(field)) return true
  if (/(?:^|\.)(?:bg|card|muted|chrome|inputBg)$/.test(field)) return true
  if (/lightest?$|lighter$|Light$/.test(field.split('.').pop() || '')) return true
  if (/^overlay\.|^glass\./.test(field)) return true
  return false
}

/** 反白族:无配对时只记待确认。 */
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
 * 偏移 -> 所属最内层 `{` 块 id。不能按行首采样:单行对象字面量
 * `badgeOn: { color: X, backgroundColor: Y }` 会整行落在最外层块里(实测踩过)。
 */
export function makeBlockResolver(src) {
  const spans = []
  const stack = []
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === '{') {
      stack.push(i)
    } else if (src[i] === '}') {
      const s = stack.pop()
      if (s !== undefined) spans.push([s, i])
    }
  }
  return function blockAt(offset) {
    let best = -1
    for (const [s, e] of spans) {
      if (s < offset && offset < e && s > best) best = s
    }
    return best
  }
}

/**
 * 在一行里定位 token 取值并归类角色。
 * 返回 [{ field, role, kind, offset }] —— role: 'fg' | 'bg'; kind: 'text' | 'graphic'
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

    // 只看"这个 token 的键"本身:回溯到最近的 `键:` / `键=`,允许中间夹 `{` 与箭头参数。
    // 不许跨越逗号/分号 —— 否则会把同一行前一个键的形态套到当前取值上(实测踩过)。
    const before = line.slice(Math.max(0, m.index - 80), m.index)
    const seg = before.slice(Math.max(before.lastIndexOf(','), before.lastIndexOf(';')) + 1)
    const keyCtx = /([A-Za-z_$][\w$]*)\s*[:=]\s*\{?\s*(?:\([^)]*\)\s*=>\s*)?$/.exec(seg)
    const keyName = keyCtx ? keyCtx[1] : null
    // 变量名 / 赋值目标含 Bg 或 Background ⇒ 它在做"底"
    const varName = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^;]*$/.exec(seg)
    const targetIsBg = !!varName && /(?:Bg|Background)$/.test(varName[1])

    if (targetIsBg || (keyName && (/^(bg|fill|shadowColor|border|borderColor|backgroundColor|bgColor)$/.test(keyName) || /(?:Bg|Background)$/.test(keyName)))) {
      out.push({ field: path, role: 'bg', kind: 'bg', offset: m.index })
      continue
    }

    let kind = 'graphic'
    if (keyName === 'placeholderTextColor' || keyName === 'inactiveColor' || keyName === 'activeColor') kind = 'text'
    else if (keyName === 'color') kind = /color\s*=?\s*\{\s*$/.test(seg) ? 'graphic' : 'text'
    else if (keyName && /^(tintColor|iconColor|thumbColor|trackColor|inactiveTintColor)$/.test(keyName)) kind = 'graphic'
    else if (keyName && /^(text|label|title|subtitle|placeholder|message|hint)\w*$/i.test(keyName)) kind = 'text'
    out.push({ field: path, role: 'fg', kind, offset: m.index })
  }
  return out
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

  const DEFAULT_BG = {
    light: light['surface.bg'] || light['surface.card'],
    dark: dark['surface.card'] || dark['surface.bg'],
  }
  if (!DEFAULT_BG.light || !DEFAULT_BG.dark) {
    console.error('未判定: token 表里取不到默认承载面 surface.bg / surface.card')
    process.exit(2)
  }

  let scanned = 0
  let pairedCount = 0
  const failures = []
  const suspected = []
  const unpairedInverse = []
  const undetermined = []

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      undetermined.push({ file: rel, reason: 'read-failed' })
      continue
    }
    const lines = src.split(/\r?\n/)
    const blockAt = makeBlockResolver(src)
    const lineStart = []
    {
      let acc = 0
      for (const l of lines) { lineStart.push(acc); acc += l.length + 1 }
    }

    // 按"紧凑块"归集:块内行跨度 ≤ 8 行才允许配对 —— 大块 StyleSheet 里所有
    // bg 与所有 fg 互配会产生错配假红(实测: vip.gold 配 vip.gold = 1.00)。
    const blockRows = new Map()
    const bgByBlock = new Map()
    const fgByBlock = new Map()
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      const uses = extractTokenUses(line)
      if (!uses.length) return
      for (const u of uses) {
        const bid = blockAt(lineStart[i] + (u.offset || 0))
        const rec = { file: rel, line: i + 1, field: u.field, kind: u.kind, snippet: line.trim().slice(0, 150) }
        const bucket = u.role === 'bg' ? bgByBlock : fgByBlock
        if (!bucket.has(bid)) bucket.set(bid, [])
        bucket.get(bid).push(rec)
        if (!blockRows.has(bid)) blockRows.set(bid, new Set())
        blockRows.get(bid).add(i)
      }
    })

    for (const [bid, fgs] of fgByBlock) {
      const rows = blockRows.get(bid) || new Set()
      const compact = rows.size <= 8
      const bgs = compact
        ? (bgByBlock.get(bid) || []).filter((b) => light[b.field] && dark[b.field])
        : []

      for (const fg of fgs) {
        scanned += 1
        const fgL = light[fg.field]
        const fgD = dark[fg.field]
        if (!fgL || !fgD) {
          undetermined.push({ file: fg.file, line: fg.line, field: fg.field, reason: 'token-not-found' })
          continue
        }
        const th = thresholdFor(fg.kind)

        if (bgs.length && !isBackgroundFamily(fg.field)) {
          // ② 同紧凑块配对:只报"需人工定档",不自动改
          pairedCount += 1
          let worst = null
          for (const bg of bgs) {
            const cL = contrast(fgL, light[bg.field])
            const cD = contrast(fgD, dark[bg.field])
            if (cL === null || cD === null) continue
            if (cL < th || cD < th) {
              if (!worst || Math.min(cL, cD) < Math.min(worst.light, worst.dark)) {
                worst = { bgField: bg.field, light: cL, dark: cD }
              }
            }
          }
          if (worst) {
            suspected.push({ ...fg, bgField: worst.bgField, light: worst.light, dark: worst.dark, threshold: th })
          }
          continue
        }

        // 底色族当前景:不判(它是"底",不是字);反白族无配对:只待确认
        if (isBackgroundFamily(fg.field)) continue
        if (isInverseFamily(fg.field)) {
          unpairedInverse.push({ file: fg.file, line: fg.line, field: fg.field })
          continue
        }

        // ① 无配对,压默认承载面
        const cL = contrast(fgL, DEFAULT_BG.light)
        const cD = contrast(fgD, DEFAULT_BG.dark)
        if (cL === null || cD === null) {
          undetermined.push({ file: fg.file, line: fg.line, field: fg.field, reason: 'contrast-undetermined' })
          continue
        }
        if (cL < th || cD < th) {
          failures.push({ ...fg, bgField: 'surface.bg', light: cL, dark: cD, threshold: th })
        }
      }
    }
  }

  if (scanned === 0) {
    console.error(`未判定: ${SCAN_DIR} 下枚举到 0 处 token 取值(尺子成摆设)`)
    process.exit(2)
  }

  const tally = (arr) => {
    const byField = {}
    const byKind = {}
    for (const f of arr) {
      byField[f.field] = (byField[f.field] || 0) + 1
      byKind[f.kind] = (byKind[f.kind] || 0) + 1
    }
    return { byField, byKind }
  }
  const f1 = tally(failures)
  const f2 = tally(suspected)

  const report = {
    scannedFiles: files.length,
    scannedUses: scanned,
    pairedUses: pairedCount,
    failures: failures.length,
    failuresByField: f1.byField,
    failuresByKind: f1.byKind,
    suspected: suspected.length,
    suspectedByField: f2.byField,
    unpairedInverse: unpairedInverse.length,
    undetermined: undetermined.length,
  }

  console.log('=== packages/app 文字/图标 token 对比度审计 ===')
  console.log(`源码文件: ${report.scannedFiles}    token 取值: ${scanned}    同块配对: ${pairedCount}`)
  console.log(`① 确定失败(无配对压默认承载面): ${failures.length}`)
  console.log(`② 待人工定档(同块配对不达标): ${suspected.length}`)
  console.log(`   反白族待确认配底(不判红): ${unpairedInverse.length}    未判定: ${undetermined.length}`)

  const dump = (title, arr) => {
    if (!arr.length) return
    console.log(`\n--- ${title} ---`)
    ;[...arr].sort((a, b) => Math.min(a.light, a.dark) - Math.min(b.light, b.dark)).slice(0, 30).forEach((f) => {
      console.log(`  [${Math.min(f.light, f.dark).toFixed(2)}] ${f.file}:${f.line}  ${f.field} vs ${f.bgField}  L=${f.light} D=${f.dark} 阈值${f.threshold} ${f.kind}`)
      console.log(`        ${f.snippet}`)
    })
    if (arr.length > 30) console.log(`  ... 其余 ${arr.length - 30} 条见 --json`)
  }
  dump('① 确定失败 按 token', failures)
  if (failures.length) console.log('\n  分档: ' + Object.entries(f1.byField).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '))
  dump('② 待人工定档', suspected)
  if (suspected.length) console.log('\n  分档: ' + Object.entries(f2.byField).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '))

  if (!failures.length && !suspected.length) console.log('\n全部通过。')

  if (jsonOut) {
    writeFileSync(resolve(ROOT, jsonOut), JSON.stringify({ report, failures, suspected, unpairedInverse, undetermined }, null, 2), 'utf8')
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
  const u1 = extractTokenUses('  <Search color={tk.text.tertiary} />')
  t('icon prop color={} -> fg/graphic', u1.some((u) => u.field === 'text.tertiary' && u.role === 'fg' && u.kind === 'graphic'))
  const u2 = extractTokenUses('  placeholderTextColor={tk.text.tertiary}')
  t('placeholderTextColor -> fg/text', u2.some((u) => u.field === 'text.tertiary' && u.role === 'fg' && u.kind === 'text'))
  const u3 = extractTokenUses('  color: tk.text.tertiary,')
  t('style color: -> fg/text', u3.some((u) => u.field === 'text.tertiary' && u.role === 'fg' && u.kind === 'text'))
  const u4 = extractTokenUses('  backgroundColor: tk.surface.muted,')
  t('backgroundColor -> bg role', u4.some((u) => u.field === 'surface.muted' && u.role === 'bg'))
  const u5 = extractTokenUses('    bg: (tk) => tk.warning.light,')
  t('bg: arrow -> bg role', u5.some((u) => u.field === 'warning.light' && u.role === 'bg'))
  const u6 = extractTokenUses('    const cardBg = tk.surface.muted')
  t('const xxxBg -> bg role', u6.some((u) => u.field === 'surface.muted' && u.role === 'bg'))

  // 语义分族:底色族不得当前景判(防止 return 一个浅底算成 1.02 假红)
  t('warning.amberLight is background family', isBackgroundFamily('warning.amberLight'))
  t('success.lightest is background family', isBackgroundFamily('success.lightest'))
  t('surface.light is background family', isBackgroundFamily('surface.light'))
  t('text.secondary is NOT background family', !isBackgroundFamily('text.secondary'))
  t('brand.ctaForeground is inverse family', isInverseFamily('brand.ctaForeground'))

  const realTs = readFileSync(resolve(ROOT, TOKENS_SRC), 'utf8')
  const real = parseRnTokenTables(realTs)
  t('parses real rn-tokens.ts (light non-empty)', !!real && Object.keys(real.light).length > 40)
  t('parses surface.bg + text.tertiary from real table',
    !!real && !!real.light['surface.bg'] && !!real.light['text.tertiary'] && !!real.dark['text.tertiary'])
  t('does not mistake type declaration for value', !!real && real.light['surface.bg'] === '#F5F5F5')

  const src = 'const s = {\n  badgeOn: { color: a, backgroundColor: b },\n  other: {}\n}\n'
  const blockAtOf = makeBlockResolver(src)
  const i1 = src.indexOf('color: a') + 'color: '.length
  const i2 = src.indexOf('backgroundColor: b') + 'backgroundColor: '.length
  t('same object literal shares block id', blockAtOf(i1) === blockAtOf(i2) && blockAtOf(i1) !== -1)
  t('nested block differs from outer block', blockAtOf(i1) > src.indexOf('const s'))

  if (!process.exitCode) console.log('\n全部自检通过。')
  process.exit(process.exitCode || 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()
