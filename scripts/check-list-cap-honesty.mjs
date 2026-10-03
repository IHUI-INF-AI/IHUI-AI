// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:b76-13 票3「消费者绝不施加界 —— 有界表归生产者,且淘汰必须说出来 + 继续可数」。
//
// 在修什么
//   消费侧静默截断:对**集合**的 `slice(-N)` 把"少列了多少"吞掉,数字偏小且自洽
//   (列表渲染成功、无异常、i18n 齐、typecheck 绿 —— 现有守门全在这一维外)。
//   判据口径(照上游,落我方词汇):
//     (a) 渲染裁尾必须**同时**产出被裁掉的条数(omittedCount)并渲染成「N more」;
//     (b) 界常量唯一出口 packages/api-client/src/client.ts 的 SSE_LIST_DISPLAY_BUDGET,
//         注释区分展示预算 vs 生产契约;
//     (c) 生产端截尾必须带 truncated 位;消费端不得自行加界。
//
// 四态(逐处判):
//   hit          集合 slice(-N) 且同函数体窗口内无 omitted 计数 ⇒ 必须改走
//                tailWithOmittedCount 唯一出口;
//   cleared      slice(-N) 与 omitted 计数同现(或已改走唯一出口)⇒ 放过;
//   undetermined slice(-动态表达式) ⇒ 静态判不了,逐条报名;
//   不判         对**字符串/路径**的 slice(-N)(路径尾段、文本尾截)—— 票面明示不判。
//
// 跑法:`node scripts/check-list-cap-honesty.mjs`(缺省档真仓扫描;有 hit ⇒ exit 1)
//       `node scripts/check-list-cap-honesty.mjs --self-test`(内置成对用例,不依赖真仓)
// 本门由主会话决定是否挂提交链;缺省档现读**工作树**面。

import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SCAN_DIR = 'apps/web/src/components/ai/progress-sections'

const SLICE_RE = /\b([A-Za-z_$][\w$]*)\.slice\(-(\d+|[A-Za-z_$][\w$]*)\)/g
const OMITTED_RE = /omittedCount|omitted|N more|moreCount|tailWithOmittedCount/
// 字符串/路径语义词:接收者名或周边 1 行带这些词 ⇒ 不判(票面明示)
const STRINGISH_RE = /^(\.\.\.|parts|path|text|str|trimmed|line|name|id|output|content|url|prefix|suffix|tail|dir)/i
const DYNAMIC_SLICE_RE = /\b[A-Za-z_$][\w$]*\.slice\(-[A-Za-z_$][\w$]*\)/

/** 判单处 slice(-N):'hit' | 'cleared' | 'undetermined' | 'skip'(字符串/路径不判)。 */
function judgeSlice(lineText, contextWindow) {
  if (DYNAMIC_SLICE_RE.test(lineText)) return 'undetermined'
  SLICE_RE.lastIndex = 0
  const m = SLICE_RE.exec(lineText)
  if (!m) return 'skip'
  const receiver = m[1]
  if (STRINGISH_RE.test(receiver)) return 'skip'
  // 周边是「…」文本拼接 / join('/') 一族 ⇒ 文本尾截,不判
  if (/['"`]…|join\(['"`]\//.test(lineText)) return 'skip'
  return OMITTED_RE.test(contextWindow) ? 'cleared' : 'hit'
}

function scanFile(absPath, relPath) {
  if (!existsSync(absPath)) return []
  const lines = readFileSync(absPath, 'utf8').split('\n')
  const findings = []
  for (let i = 0; i < lines.length; i++) {
    if (!/\bslice\(-/.test(lines[i])) continue
    const window = lines.slice(Math.max(0, i - 20), i + 20).join('\n')
    const verdict = judgeSlice(lines[i], window)
    if (verdict === 'hit') findings.push({ file: relPath, line: i + 1, text: lines[i].trim() })
    else if (verdict === 'undetermined')
      findings.push({ file: relPath, line: i + 1, text: lines[i].trim(), undetermined: true })
  }
  return findings
}

function listScanFiles() {
  const abs = join(REPO_ROOT, SCAN_DIR)
  if (!existsSync(abs)) return []
  return readdirSync(abs)
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
    .map((f) => join(SCAN_DIR, f))
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1)
  }
  let hits = 0
  let undetermined = 0
  for (const rel of listScanFiles()) {
    for (const f of scanFile(join(REPO_ROOT, rel), rel)) {
      if (f.undetermined) {
        undetermined++
        console.warn(`[list-cap] undetermined: ${f.file}:${f.line} ${f.text}`)
      } else {
        hits++
        console.error(`[list-cap] hit: ${f.file}:${f.line} 集合裁尾未产 omitted 计数 ⇒ ${f.text}`)
      }
    }
  }
  if (hits > 0) {
    console.error(`[list-cap] ${hits} 处命中 / ${undetermined} 未判定(改走 tailWithOmittedCount 唯一出口)`)
    process.exit(1)
  }
  console.log(`[list-cap] 0 命中,${undetermined} 未判定`)
  process.exit(0)
}

/** 内置成对用例:红(集合裁尾无计数)/ 绿(有 omitted)/ 字符串豁免 / 动态未判定。 */
function selfTest() {
  const dir = mkScratch("list-cap-selftest-")
  try {
    const cases = [
      // 红:集合 slice(-10),函数体内无 omitted 计数
      ['red.tsx', 'export function render(changes: unknown[]) {\n  const recent = changes.slice(-10)\n  return recent\n}\n', 'hit'],
      // 绿:集合 slice(-10) 与 omitted 计数同函数体窗口内同现(渲染成「N more」)
      ['green.tsx', 'export function render(changes: unknown[]) {\n  const recent = changes.slice(-10)\n  const omittedCount = changes.length - recent.length\n  return recent.concat([`${omittedCount} more`])\n}\n', 'cleared'],
      // 豁免:字符串/路径尾截
      ['path.tsx', 'export function shorten(parts: string[]) {\n  return "…/" + parts.slice(-2).join("/")\n}\n', 'skip'],
      ['text.tsx', 'export function ellipsize(trimmed: string) {\n  return trimmed.length > 60 ? `…${trimmed.slice(-60)}` : trimmed\n}\n', 'skip'],
      // 未判定:动态表达式
      ['dyn.tsx', 'export function render(list: unknown[], cap: number) {\n  return list.slice(-cap)\n}\n', 'undetermined'],
    ]
    let ok = true
    for (const [name, content, expected] of cases) {
      const abs = join(dir, name)
      writeFileSync(abs, content)
      const lines = readFileSync(abs, 'utf8').split('\n')
      let got = 'skip'
      for (let i = 0; i < lines.length; i++) {
        if (!/\bslice\(-/.test(lines[i])) continue
        const window = lines.slice(Math.max(0, i - 20), i + 20).join('\n')
        const v = judgeSlice(lines[i], window)
        if (v !== 'skip') {
          got = v
          break
        }
      }
      if (got !== expected) {
        console.error(`[list-cap] self-test FAIL: ${name} 期望 ${expected} 实得 ${got}`)
        ok = false
      }
    }
    // 唯一出口必须真的存在(client.ts 产出的那份)
    const clientSrc = readFileSync(join(REPO_ROOT, 'packages/api-client/src/client.ts'), 'utf8')
    if (!clientSrc.includes('export function tailWithOmittedCount') ||
        !clientSrc.includes('export const SSE_LIST_DISPLAY_BUDGET')) {
      console.error('[list-cap] self-test FAIL: client.ts 唯一裁尾出口缺失')
      ok = false
    }
    if (ok) console.log('[list-cap] self-test PASS(红/绿/豁免/未判定 + 唯一出口在位)')
    return ok
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
