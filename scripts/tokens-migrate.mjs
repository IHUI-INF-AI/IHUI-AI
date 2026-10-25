// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 转写器为 CLI 工具,需 console 输出诊断信息 */
// RN 屏 StyleSheet 裸数字 → token 档批量转写器(goal「样式全面对齐」的自动化器物)
//
// 用法:
//   node scripts/tokens-migrate.mjs <file.tsx|dir> [...]              # dry-run:报告可对档的命中数(不写盘)
//   node scripts/tokens-migrate.mjs <file.tsx|dir> [...] --apply      # 写盘(字节级替换,不动其它内容)
//   默认跳过工作树里被其他会话改过的已入库文件(--include-dirty 才处理);未跟踪文件一律不碰。
//
// 映射纪律(goal 轮 11 定档):数字恰在档才换,不在档(10/13/18 等杂值)保留原样不硬凑;
// fontSize 只换数值保留行结构(fontSize: 14 → fontSize: rnType.body.size);
// 权重/行高不并 spread(不改变行结构,水印文件字节级安全);
// 已含 rnSpacing/rnType 的行跳过。转写后必须跑 typecheck/eslint/watermark verify。
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SPACING_MAP = { 4: 'rnSpacing.xs', 8: 'rnSpacing.sm', 12: 'rnSpacing.md', 16: 'rnSpacing.lg', 20: 'rnSpacing.xl', 24: "rnSpacing['2xl']", 32: "rnSpacing['3xl']", 40: "rnSpacing['4xl']", 48: "rnSpacing['5xl']", 64: "rnSpacing['6xl']" }
const TYPE_MAP = { 11: 'rnType.caption.size', 12: 'rnType.label.size', 14: 'rnType.body.size', 15: 'rnType.strong.size', 16: 'rnType.title.size', 18: 'rnType.subtitle.size', 20: 'rnType.heading.size', 24: 'rnType.display.size', 30: 'rnType.displayLg.size' }

/** 对单行做一次转写;返回 { line, hits } */
export function migrateLine(line) {
  let hits = 0
  let out = line
  if (/\brnSpacing|\brnType/.test(line)) return { line, hits }
  // fontSize: 14 / fontSize:14
  out = out.replace(/(fontSize:\s*)(\d+)\b/g, (m, p, n) => {
    const t = TYPE_MAP[Number(n)]
    if (!t) return m
    hits++
    return p + t
  })
  // 间距键(padding/margin/gap 族):数字恰在档才换
  out = out.replace(
    /((?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical)?|gap|rowGap|columnGap)(:\s*)(-?\d+)\b/g,
    (m, key, colon, n) => {
      const num = Number(n)
      if (num < 0) return m
      const t = SPACING_MAP[num]
      if (!t) return m
      hits++
      return key + colon + t
    },
  )
  return { line: out, hits }
}

/** 确保 @ihui/design-tokens import 含指定名字(单行/多行块/无 import 三形态都安全;LoginScreen 事故的根治) */
export function ensureImport(text, names) {
  // 检测只在 design-tokens 的 import 语句内做:正文里的 rnSpacing 是转写器刚写进去的,不算已导入
  const dtImport = text.match(/import \{[\s\S]*?\} from '@ihui\/design-tokens'/)?.[0] ?? ''
  // 只导真正被用到的名字:转写器只产出 `rnSpacing.xxx` / `rnSpacing['2xl']` / `rnType.xxx`,
  // 无条件导两个名字会造出 eslint no-unused-vars(实测 ProfileScreen)
  const missing = names.filter((x) => new RegExp(String.raw`\b${x}[.[]`).test(text) && !dtImport.includes(x))
  if (missing.length === 0) return text
  const single = /import \{([^}]*)\} from '@ihui\/design-tokens'/
  if (single.test(text)) {
    return text.replace(single, (_m, g) => `import {${g.replace(/\s*,\s*$/, '')}, ${missing.join(', ')} } from '@ihui/design-tokens'`)
  }
  const multi = /import \{([\s\S]*?)\n\} from '@ihui\/design-tokens'/
  if (multi.test(text)) {
    return text.replace(multi, (_m, g) => `import {${g.replace(/\s*,\s*$/, '')},\n  ${missing.join(',\n  ')},\n} from '@ihui/design-tokens'`)
  }
  const firstImport = text.search(/^import /m)
  const line = `import { ${missing.join(', ')} } from '@ihui/design-tokens'\n`
  if (firstImport < 0) return line + text
  return text.slice(0, firstImport) + line + text.slice(firstImport)
}

/** 全文转写;返回 { text, hits, byKind } */
export function migrateText(text) {
  const lines = text.split('\n')
  let total = 0
  const out = lines.map((l) => {
    const r = migrateLine(l)
    total += r.hits
    return r.line
  })
  return { text: out.join('\n'), hits: total }
}

/** 展开目标(文件/目录)为已入库的 .tsx 清单:未跟踪文件不碰,避免把他人草稿卷进本批 */
function collectTargets(targets) {
  const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))
  const set = new Set()
  const walk = (p) => {
    const st = statSync(p)
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) walk(join(p, name))
    } else if (p.endsWith('.tsx')) {
      const rel = p.replace(/\\/g, '/')
      if (tracked.has(rel)) set.add(rel)
    }
  }
  for (const t of targets) walk(t)
  return [...set].sort()
}

/** 工作树已被其他会话改过的已入库路径(含暂存):默认跳过,避免把别人的未提交工作卷进本批 */
function dirtyPaths() {
  const raw = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' })
  const out = new Set()
  for (const line of raw.split('\n')) {
    if (!line) continue
    let p = line.slice(3).trim()
    if (p.includes(' -> ')) p = p.split(' -> ').pop()
    out.add(p.replace(/^"|"$/g, ''))
  }
  return out
}

function run() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const includeDirty = args.includes('--include-dirty')
  const json = args.includes('--json')
  const targets = args.filter((a) => !a.startsWith('--'))
  if (targets.length === 0) {
    console.error('用法: node scripts/tokens-migrate.mjs <file.tsx|dir> [...] [--apply] [--include-dirty] [--json]')
    process.exit(2)
  }
  const files = collectTargets(targets)
  const dirty = includeDirty ? new Set() : dirtyPaths()
  const rows = []
  let skippedDirty = 0
  for (const f of files) {
    if (dirty.has(f)) {
      skippedDirty++
      continue
    }
    const text = readFileSync(f, 'utf8')
    const { text: next, hits } = migrateText(text)
    if (hits === 0) continue
    if (apply) writeFileSync(f, ensureImport(next, ['rnSpacing', 'rnType']))
    rows.push({ file: f, hits })
  }
  const total = rows.reduce((s, r) => s + r.hits, 0)
  if (json) {
    console.log(JSON.stringify({ apply, scanned: files.length, skippedDirty, files: rows.length, hits: total, rows }, null, 1))
    return
  }
  if (files.length === 1) {
    const r = rows[0]
    console.log(`${files[0]}: ${r ? r.hits : 0} 处可对档${apply ? ' → 已写盘' : '(dry-run,加 --apply 写盘)'}`)
    if (skippedDirty) console.log('该文件当前被其他会话改动,已跳过(确需处理加 --include-dirty)')
    return
  }
  console.log(`扫描 ${files.length} 个已入库 .tsx;跳过他人改动 ${skippedDirty};可对档 ${rows.length} 文件 / ${total} 处${apply ? ' → 已写盘' : '(dry-run)'}`)
  for (const r of rows.sort((a, b) => b.hits - a.hits).slice(0, 30)) console.log(String(r.hits).padStart(5), r.file)
  if (rows.length > 30) console.log(`… 其余 ${rows.length - 30} 个文件见 --json`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) run()

export const __test__ = { migrateLine, migrateText, ensureImport }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
