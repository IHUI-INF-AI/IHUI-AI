// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RN 屏 StyleSheet 裸数字 → token 档批量转写器(goal「样式全面对齐」的自动化器物)
//
// 用法:
//   node scripts/tokens-migrate.mjs <file.tsx>            # dry-run:报告可对档的命中数(不写盘)
//   node scripts/tokens-migrate.mjs <file.tsx> --apply    # 写盘(字节级替换,不动其它内容)
//
// 映射纪律(goal 轮 11 定档):数字恰在档才换,不在档(10/13/18 等杂值)保留原样不硬凑;
// fontSize 只换数值保留行结构(fontSize: 14 → fontSize: rnType.body.size);
// 权重/行高不并 spread(不改变行结构,水印文件字节级安全);
// 已含 rnSpacing/rnType 的行跳过。转写后必须跑 typecheck/eslint/watermark verify。
import { readFileSync, writeFileSync } from 'node:fs'
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

function run() {
  const [, , file, flag] = process.argv
  if (!file || !file.endsWith('.tsx')) {
    console.error('用法: node scripts/tokens-migrate.mjs <file.tsx> [--apply]')
    process.exit(2)
  }
  const apply = flag === '--apply'
  const text = readFileSync(file, 'utf8')
  const { text: next, hits } = migrateText(text)
  console.log(`${file}: ${hits} 处可对档${apply ? ' → 已写盘' : '(dry-run,加 --apply 写盘)'}`)
  if (hits > 0 && !apply) {
    const needsImport = !/\brnSpacing\b/.test(text)
    if (needsImport) console.log('提示:文件尚无 rnSpacing/rnType import,--apply 后需补 import(或本工具下次增强)')
  }
  if (apply && hits > 0) writeFileSync(file, next)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) run()

export const __test__ = { migrateLine, migrateText }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
