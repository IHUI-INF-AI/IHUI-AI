#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 派生器:必须打印逐对结论与差集 */
/**
 * gen-ui-mirror.mjs —— 「RN 壳 → 小程序壳」的 spec 绑定块派生器(2026-10-28 立)。
 *
 * 为什么要有它(现读):`packages/shared/src/ui/*-spec.ts` 是取值单源,但**档 → 类**的映射表仍是
 * 两端各抄一份。`check-ui-spec-mirror.mjs` 只判「这个常量名有没有出现在壳里」——它判不了
 * 「同一个 12px 档,RN 映射成 p-3、小程序映射成 p-4」这种**取值漂移**(Card 同屏错位就是这么来的:
 * 两端都在源码里写了 CARD_PADDING_PX,但一端落在块上、一端压在根上,名字接上了、值没接上)。
 *
 * 本器补的正是那一格:两端几何映射表(形如 `const X_CLASS: Record<number, string> = { 12: 'p-3' }`)
 * **必须逐字相等**,且只允许由 RN 壳单方持有后派生到小程序壳。理由:
 *   · 两端都写 Tailwind 风格类,同一档位在 nativewind 与 weapp-tailwindcss 下是同一个类名字面量;
 *   · 类名字面量必须留在壳文件里(spec 不在扫描面内),所以不能把映射搬进 spec,
 *     只能「RN 壳定一次,小程序壳镜像同一份」——这正是「一模一样」契约可机械复核的那一半。
 *
 * 判什么(纯文本,零 AST 依赖,零判据复算):
 *   · 绑定块 = 该 spec 的 import 语句 + 所有**直接引用 spec 导出名**的顶层 `const` 声明;
 *   · 与 RN 壳逐条比对:声明名集合、每条声明的归一化正文(去行尾空白);
 *   · 小程序壳缺哪条 / 哪条不同 ⇒ 红灯并逐条点名。
 *
 * `--apply` 只做两件事:把 RN 的 spec import 原样落到小程序壳、把不一致的映射声明原样覆盖/补齐
 * (缺的插在最后一条 import 之后)。**不生成结构**:组件结构属平台承载(规则6),仍由端内手写,
 * 本器绝不改写 JSX 体。
 *
 * 取材面:本器是写盘器物,**恒读工作树**;入库面判定归 check-ui-spec-mirror.mjs(它默认 HEAD blob)。
 *
 * 退出码(§0.3):0 = 全部一致(或不在射程);1 = 有漂移;2 = 未判定(取不到 spec / 两端壳缺一)。
 *
 * Usage:
 *   node scripts/gen-ui-mirror.mjs                 # 只读对账(全部配对)
 *   node scripts/gen-ui-mirror.mjs --only=switch   # 只判一对
 *   node scripts/gen-ui-mirror.mjs --apply         # 落盘(幂等)
 *   node scripts/gen-ui-mirror.mjs --self-test     # 纯内存夹具自检
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  parseWaivers,
  todayIso,
  waiverVerdict,
  WAIVER_LEDGER_REL,
} from './lib/ui-mirror-waivers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RN_DIR = 'packages/ui-native/src'
const MP_DIR = 'apps/miniapp-taro/src/components'
const SPEC_DIR = 'packages/shared/src/ui'

/** 豁免台账:本器恒读工作树(与它判的两端壳同面),判序 import lib 单源,不写第二份。 */
function loadWaivers() {
  const abs = join(ROOT, WAIVER_LEDGER_REL)
  if (!existsSync(abs)) return { ok: true, waivers: [], absent: true }
  return parseWaivers(readFileSync(abs, 'utf8'))
}

/** kebab → Pascal(小程序壳命名口径,与 check-ui-spec-mirror.pascalOf 同形)。 */
export function pascalOf(kebab) {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

/** 归一化:统一换行、逐行去行尾空白、整体去首尾空白。比较只认这个面。 */
export function norm(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim()
}

/** 源码里所有顶层 import 语句(含多行形态),返回 {text,start,end,source}。 */
export function importsOf(src) {
  const out = []
  const re = /^import\b[\s\S]*?from\s+'([^']+)'\s*;?\s*$/gm
  let m
  while ((m = re.exec(src)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length, source: m[1] })
  }
  return out
}

/** 从 import 语句里取被导入的标识符名(去掉 `type ` 前缀;含别名时取本地名)。 */
export function importedNamesOf(importText) {
  const brace = /\{([\s\S]*?)\}/.exec(importText)
  if (!brace) return []
  return brace[1]
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/, ''))
    .filter(Boolean)
    .map((part) => {
      const alias = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(part)
      return alias ? alias[1] : part
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
}

/**
 * 顶层 `const` 声明(含多行对象/多行串联),返回 {name,text,start,end}。
 * 结束判定 = 括号深度归零后的行,且该行以 `}` / `;` / `'` / `"` / `)` 结尾(单行声明立即结束)。
 */
export function topLevelConstsOf(src) {
  const lines = src.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    if (!/^const\s+[A-Za-z_$][\w$]*/.test(lines[i])) {
      i += 1
      continue
    }
    const name = /^const\s+([A-Za-z_$][\w$]*)/.exec(lines[i])[1]
    const startLine = i
    let depth = 0
    let quote = null
    let done = false
    while (i < lines.length) {
      const line = lines[i]
      for (let k = 0; k < line.length; k += 1) {
        const ch = line[k]
        if (quote) {
          if (ch === '\\') k += 1
          else if (ch === quote) quote = null
          continue
        }
        if (ch === "'" || ch === '"' || ch === '`') quote = ch
        else if (ch === '{' || ch === '(' || ch === '[') depth += 1
        else if (ch === '}' || ch === ')' || ch === ']') depth -= 1
      }
      i += 1
      if (depth === 0) {
        // 括号已归零:下一非空行若以成员访问/运算符/逗号起头,说明语句仍在续写。
        // 注释行不算续写(一条 `/** … */` 文档块紧跟声明,不能被吸进声明里)。
        let next = ''
        for (let n = i; n < lines.length; n += 1) {
          const candidate = lines[n].trim()
          if (!candidate || /^(\/\/|\/\*|\*)/.test(candidate)) continue
          next = candidate
          break
        }
        if (!/^[.?:+\-*/&|,]/.test(next)) {
          done = true
          break
        }
      }
      if (depth < 0) {
        done = true
        break
      }
    }
    if (!done) throw new Error(`顶层 const 声明不闭合: ${name}`)
    out.push({ name, text: lines.slice(startLine, i).join('\n'), start: startLine, end: i })
  }
  return out
}

/** 该壳的 spec import(第一个 `@ihui/shared/ui/<slug>-spec`),无则 null。 */
export function specImportOf(src) {
  return (
    importsOf(src).find((stmt) => /^@ihui\/shared\/ui\/[a-z0-9-]+-spec$/.test(stmt.source)) || null
  )
}

/**
 * 把一条映射声明里的**扁平对象字面量**压成可跨端比较的签名:键集合 + 每个键的类名字面量。
 * 只认 `{ 12: 'p-3', md: 'rounded-md' }` 形态;嵌套对象 / 数组 join / 表达式 ⇒ 返回 null,
 * 调用方退回「同名声明逐字比较」(那种形态无法脱离表达式求值,不硬判)。
 */
export function mapSignatureOf(declText) {
  const eq = declText.indexOf('=')
  if (eq < 0) return null
  const open = declText.indexOf('{', eq)
  if (open < 0) return null
  const close = declText.lastIndexOf('}')
  if (close <= open) return null
  const body = declText.slice(open + 1, close)
  const parts = []
  let cur = ''
  let depth = 0
  let quote = null
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (quote) {
      cur += ch
      if (ch === '\\') {
        cur += body[i + 1] || ''
        i += 1
      } else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      cur += ch
    } else if (ch === '{' || ch === '(' || ch === '[') {
      depth += 1
      cur += ch
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth -= 1
      cur += ch
    } else if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  const pairs = []
  for (const part of parts) {
    const m =
      /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(?:'([^']*)'|"([^"]*)")\s*$/.exec(part)
    if (!m) return null
    pairs.push(`${m[1] ?? m[2] ?? m[3]}=${m[4] ?? m[5]}`)
  }
  return pairs.length ? pairs.sort().join('|') : null
}

/** 绑定声明 = 顶层 const 里的「档 → 类」映射与 spec 引用常量。两种命中任一即可:
 *  ① 名字以 CLASS / CLASSES 收尾(两端几何映射的命名口径);
 *  ② 正文真的引用了 spec 导出名(如 `ANIM_DURATION = SHEET_ANIM_DURATION_MS`、类型级键约束)。
 *  注释里提一嘴不算 —— 命中判定前先剥行首注释。 */
export function bindingDeclsOf(src, specNames) {
  return topLevelConstsOf(src).filter((decl) => {
    if (/(CLASS|CLASSES)$/.test(decl.name)) return true
    if (!specNames.length) return false
    const body = decl.text
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
    return specNames.some((name) => new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(body))
  })
}

/** 一对壳的比对:返回 {slug, rn, mp, issues[], missing[], drifted[], undetermined?}。 */
export function comparePair(rnSrc, mpSrc, opts = {}) {
  const waivedNames = opts.waivedNames || []
  const rnImport = specImportOf(rnSrc)
  if (!rnImport) return { undetermined: 'RN 壳没有 spec import' }
  const slug = /@ihui\/shared\/ui\/([a-z0-9-]+)-spec$/.exec(rnImport.source)[1]
  const mpImport = importsOf(mpSrc).find((stmt) => stmt.source === rnImport.source) || null
  const issues = []

  const rnNames = importedNamesOf(rnImport.text)
  const mpNames = mpImport ? importedNamesOf(mpImport.text) : []
  const missingAll = rnNames.filter((name) => !mpNames.includes(name))
  const missingImportNames = missingAll.filter((name) => !waivedNames.includes(name))
  if (!mpImport) issues.push('小程序壳没有该 spec 的 import 语句')
  else if (missingImportNames.length)
    issues.push(`小程序壳 import 缺名: ${missingImportNames.join(', ')}`)

  const rnDecls = bindingDeclsOf(rnSrc, rnNames)
  const mpDecls = bindingDeclsOf(mpSrc, rnNames)
  const mpByName = new Map(mpDecls.map((decl) => [decl.name, decl]))
  const missing = []
  const drifted = []
  const renamed = []
  for (const decl of rnDecls) {
    const rnSig = mapSignatureOf(decl.text)
    const peer = mpByName.get(decl.name)
    if (peer) {
      const mpSig = mapSignatureOf(peer.text)
      const same = rnSig && mpSig ? rnSig === mpSig : norm(peer.text) === norm(decl.text)
      if (!same) drifted.push(decl.name)
      continue
    }
    if (rnSig && mpDecls.some((item) => mapSignatureOf(item.text) === rnSig)) {
      renamed.push(decl.name)
      continue
    }
    missing.push(decl.name)
  }
  if (missing.length) issues.push(`小程序壳缺绑定声明: ${missing.join(', ')}`)
  if (drifted.length) issues.push(`小程序壳绑定声明与 RN 不一致: ${drifted.join(', ')}`)

  return {
    slug,
    rn: rnSrc,
    mp: mpSrc,
    rnImport,
    mpImport,
    rnDecls,
    issues,
    missing,
    drifted,
    renamed,
    missingImportNamesAll: missingAll,
  }
}

/** 派生落盘:只换 spec import + 覆盖/补齐绑定声明,不碰 JSX 体。 */
export function applyPair(rnSrc, mpSrc, opts = {}) {
  const cmp = comparePair(rnSrc, mpSrc, opts)
  if (cmp.undetermined) return { text: mpSrc, changed: false, cmp }
  if (!cmp.issues.length) return { text: mpSrc, changed: false, cmp }

  let text = mpSrc
  const rnNames = importedNamesOf(cmp.rnImport.text)
  const waived = opts.waivedNames || []

  // 1) spec import:整条替换(名字顺序/换行随 RN,防止两端 import 面漂移)。
  //    本对有具名豁免时**不动 import** —— 照抄 RN 的导入会把免掉的名称写成端内未消费导入(lint 红)。
  if (!waived.length) {
    const mpImport = importsOf(text).find((stmt) => stmt.source === cmp.rnImport.source)
    if (mpImport)
      text = text.slice(0, mpImport.start) + cmp.rnImport.text + text.slice(mpImport.end)
    else {
      const imports = importsOf(text)
      const at = imports.length ? imports[imports.length - 1].end : 0
      text = text.slice(0, at) + '\n' + cmp.rnImport.text + text.slice(at)
    }
  }

  // 2) 绑定声明:同名覆盖,缺的插到 import 段之后;每次改动后重扫(行号会漂移)
  for (const decl of cmp.rnDecls) {
    const current = bindingDeclsOf(text, rnNames)
    const peer = current.find((item) => item.name === decl.name)
    const rnSig = mapSignatureOf(decl.text)
    if (peer) {
      const mpSig = mapSignatureOf(peer.text)
      const same = rnSig && mpSig ? rnSig === mpSig : norm(peer.text) === norm(decl.text)
      if (same) continue
      const lines = text.split('\n')
      text = [
        ...lines.slice(0, peer.start),
        ...decl.text.split('\n'),
        ...lines.slice(peer.end),
      ].join('\n')
      continue
    }
    if (rnSig && current.some((item) => mapSignatureOf(item.text) === rnSig)) continue
    const imports = importsOf(text)
    const at = imports.length ? imports[imports.length - 1].end : 0
    text = text.slice(0, at) + '\n\n' + decl.text + text.slice(at)
  }
  return { text, changed: norm(text) !== norm(mpSrc), cmp }
}

// ---------- 主流程 ----------

function readDisk(rel) {
  const abs = join(ROOT, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

function pairsOf(only) {
  const specs = existsSync(join(ROOT, SPEC_DIR))
    ? readdirSync(join(ROOT, SPEC_DIR))
        .filter((file) => file.endsWith('-spec.ts'))
        .map((file) => file.replace(/-spec\.ts$/, ''))
    : []
  const rnFiles = existsSync(join(ROOT, RN_DIR)) ? readdirSync(join(ROOT, RN_DIR)) : []
  const mpFiles = existsSync(join(ROOT, MP_DIR)) ? readdirSync(join(ROOT, MP_DIR)) : []
  return specs
    .filter((slug) => !only.length || only.includes(slug))
    .map((slug) => {
      const rnRel = `${RN_DIR}/${slug}.tsx`
      const mpRel = `${MP_DIR}/${pascalOf(slug)}.tsx`
      return {
        slug,
        rnRel,
        mpRel,
        hasRn: rnFiles.includes(`${slug}.tsx`),
        hasMp: mpFiles.includes(`${pascalOf(slug)}.tsx`),
        hasSpec: true,
      }
    })
}

async function main(argv) {
  const args = new Set(argv)
  const only = (argv.find((a) => a.startsWith('--only=')) || '')
    .slice('--only='.length)
    .split(',')
    .filter(Boolean)
  if (args.has('--self-test')) return selfTest()
  const apply = args.has('--apply')
  const today = process.env.UI_MIRROR_TODAY || todayIso()
  const ledger = loadWaivers()
  if (!ledger.ok) {
    console.log(`? 豁免台账 ${WAIVER_LEDGER} 解析不了: ${ledger.error}(未判定,不记绿也不冒红)`)
    return 2
  }

  const rows = pairsOf(only)
  let red = 0
  let undetermined = 0
  let green = 0
  for (const row of rows) {
    if (!row.hasRn || !row.hasMp) {
      console.log(`· ${row.slug.padEnd(18)} 两端壳缺一(不在射程)`)
      continue
    }
    const rn = readDisk(row.rnRel)
    const mp = readDisk(row.mpRel)
    if (rn === null || mp === null) {
      undetermined += 1
      console.log(`? ${row.slug.padEnd(18)} 取不到壳源码(未判定)`)
      continue
    }
    const raw = comparePair(rn, mp)
    if (raw.undetermined) {
      undetermined += 1
      console.log(`? ${row.slug.padEnd(18)} ${raw.undetermined}(未判定)`)
      continue
    }
    const verdict = waiverVerdict(row.slug, raw.missingImportNamesAll, ledger.waivers, today)
    const cmp = comparePair(rn, mp, { waivedNames: verdict.used })
    if (verdict.expired.length) cmp.issues.push(`豁免已到期: ${verdict.expired.join(', ')}`)
    if (verdict.rot.length) cmp.issues.push(`豁免清单腐烂: ${verdict.rot.join(', ')}`)
    if (!cmp.issues.length) {
      green += 1
      const renamed = cmp.renamed.length ? `(命名不同但取值一致: ${cmp.renamed.join(', ')})` : ''
      const waivedNote = verdict.used.length ? `(已验豁免 ${verdict.used.length} 名)` : ''
      console.log(
        `✅ ${row.slug.padEnd(18)} 绑定块一致(${cmp.rnDecls.length} 条映射)${renamed}${waivedNote}`,
      )
      continue
    }
    red += 1
    console.log(`🔴 ${row.slug.padEnd(18)} ${cmp.issues.join(';')}`)
    if (apply) {
      const out = applyPair(rn, mp, { waivedNames: verdict.used })
      if (out.changed) {
        writeFileSync(join(ROOT, row.mpRel), out.text, 'utf8')
        console.log(`   ↳ 已写回 ${row.mpRel}(仅 import + 绑定声明)`)
      }
    }
  }
  console.log('─'.repeat(64))
  console.log(`配对 ${green + red} · ✅一致 ${green} · 🔴漂移 ${red} · ?未判定 ${undetermined}`)
  if (undetermined) return 2
  return red ? 1 : 0
}

// ---------- 自检(纯内存夹具,不碰真仓) ----------

function selfTest() {
  const rn = [
    "import { cn } from '@ihui/design-tokens'",
    'import {',
    '  SWITCH_THUMB_SIZE_PX,',
    '  SWITCH_TRACK_H_PX,',
    '  type SwitchSizeTier,',
    "} from '@ihui/shared/ui/switch-spec'",
    '',
    'const TRACK_H_CLASS: Record<number, string> = { 20: "h-5", 24: "h-6" }',
    'const SIZING: Record<SwitchSizeTier, string> = {',
    "  sm: 'p-1',",
    "  md: 'p-2',",
    '}',
    'const LOCAL_ONLY = 3',
    '',
  ].join('\n')
  const mpOk = [
    "import { cn } from '@ihui/design-tokens'",
    'import {',
    '  SWITCH_THUMB_SIZE_PX,',
    '  SWITCH_TRACK_H_PX,',
    '  type SwitchSizeTier,',
    "} from '@ihui/shared/ui/switch-spec'",
    '',
    'const TRACK_H_CLASS: Record<number, string> = { 20: "h-5", 24: "h-6" }',
    'const SIZING: Record<SwitchSizeTier, string> = {',
    "  sm: 'p-1',",
    "  md: 'p-2',",
    '}',
    '',
  ].join('\n')

  const checks = []
  const ok = (name, cond) => checks.push({ name, cond: Boolean(cond) })

  // T1 import 解析
  const imp = specImportOf(rn)
  ok('T1 spec import 定位', imp && imp.source.endsWith('/switch-spec'))
  ok('T1 import 名字面(含 type 前缀剥离)', importedNamesOf(imp.text).includes('SwitchSizeTier'))

  // T2 绑定声明只收真引用 spec 的顶层 const
  const names = importedNamesOf(imp.text)
  const decls = bindingDeclsOf(rn, names)
  ok('T2 绑定声明命中选择性', decls.map((d) => d.name).join(',') === 'TRACK_H_CLASS,SIZING')

  // T3 一致夹具判绿
  ok('T3 一致夹具无 issue', comparePair(rn, mpOk).issues.length === 0)

  // T4 变异:小程序把 24 档抄成 h-7 ⇒ 必须点名叫漂移
  const mutated = mpOk.replace('24: "h-6"', '24: "h-7"')
  const cmpMut = comparePair(rn, mutated)
  ok('T4 取值漂移被判红', cmpMut.drifted.includes('TRACK_H_CLASS'))

  // T5 缺声明被判红,且 --apply 可补齐
  const shrunk = mpOk.replace(/const SIZING[\s\S]*?\n}\n/, '')
  const cmpShrunk = comparePair(rn, shrunk)
  ok('T5 缺声明被判红', cmpShrunk.missing.includes('SIZING'))
  const applied = applyPair(rn, shrunk).text
  ok('T5 apply 后归绿', comparePair(rn, applied).issues.length === 0)

  // T6 apply 幂等
  const once = applyPair(rn, mutated).text
  const twice = applyPair(rn, once).text
  ok('T6 apply 幂等', norm(once) === norm(twice))

  // T7 只换绑定块,不动 JSX 体
  const withBody = mpOk + 'export function X() {\n  return null\n}\n'
  const appliedBody = applyPair(rn, withBody.replace('24: "h-6"', '24: "h-7"')).text
  ok('T7 JSX 体原样保留', appliedBody.includes('return null'))

  // T8 注释里提 spec 名不算绑定
  const commentOnly = '// CARD_PADDING_PX 说明\nconst PLAIN = 1\n'
  ok('T8 注释不算绑定', bindingDeclsOf(commentOnly, ['CARD_PADDING_PX']).length === 0)

  // T9 声明后紧跟文档块 ⇒ 注释不得被吸进声明(VipBadge SIZING_CLASS 实测型:
  //   吸进去后两端正文永不相等,派生器把自己造的差异判成漂移)
  const withTrailingDoc = [
    'const SIZING_CLASS: Record<string, string> = {',
    "  sm: 'p-1',",
    '}',
    '',
    '/** 下一段说明 */',
    'const NEXT_CLASS: Record<string, string> = { md: "p-2" }',
    '',
  ].join('\n')
  const scanned = topLevelConstsOf(withTrailingDoc)
  ok(
    'T9 声明吞并后续注释',
    scanned.length === 2 &&
      scanned[0].text === "const SIZING_CLASS: Record<string, string> = {\n  sm: 'p-1',\n}" &&
      scanned[1].name === 'NEXT_CLASS',
  )

  // T10–T13 豁免族:验过才免、会到期、不再命中即腐烂(§0.7)
  const rnBare =
    "import { A_X, B_Y, C_Z } from '@ihui/shared/ui/switch-spec'\nexport function S() {\n  return null\n}\n"
  const mpBare =
    "import { D_W } from '@ihui/shared/ui/switch-spec'\nexport function M() {\n  return null\n}\n"
  const missingAll = comparePair(rnBare, mpBare).missingImportNamesAll
  ok('T10 缺名先要能全量点名', missingAll.join(',') === 'A_X,B_Y,C_Z')
  const waiver = [
    {
      pair: 'switch',
      names: missingAll,
      reason: '本端承载不允许照抄这一消费形,理由写在台账里',
      reviewBy: '2099-01-01',
    },
  ]
  const usedVerdict = waiverVerdict('switch', missingAll, waiver, '2026-10-28')
  ok('T10 未过期豁免全命中', usedVerdict.used.length === 3 && !usedVerdict.rot.length)
  ok(
    'T10 豁免后判绿且 --apply 不动 import',
    comparePair(rnBare, mpBare, { waivedNames: usedVerdict.used }).issues.length === 0 &&
      applyPair(rnBare, mpBare, { waivedNames: usedVerdict.used }).changed === false,
  )
  const expiredVerdict = waiverVerdict('switch', missingAll, waiver, '2099-06-01')
  ok(
    'T11 到期豁免回队列(不免并点名)',
    !expiredVerdict.used.length && expiredVerdict.expired.length === 3,
  )
  const rotVerdict = waiverVerdict('switch', [], waiver, '2026-10-28')
  ok('T12 被审面不再命中 ⇒ 清单腐烂判红', !rotVerdict.used.length && rotVerdict.rot.length === 3)
  const badVerdict = waiverVerdict(
    'switch',
    missingAll,
    [{ pair: 'switch', names: missingAll, reason: '太短', reviewBy: '2099-1-1' }],
    '2026-10-28',
  )
  ok(
    'T13 坏行(日期形态/理由过短)免不了任何东西',
    !badVerdict.used.length && badVerdict.rot.length === 1,
  )

  for (const check of checks) console.log(`${check.cond ? '✅' : '🔴'} ${check.name}`)
  const failed = checks.filter((check) => !check.cond).length
  console.log(`自检 ${checks.length - failed}/${checks.length}`)
  return failed ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      console.error(`❌ 派生器自身异常(未判定): ${error?.message ?? error}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
