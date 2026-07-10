#!/usr/bin/env node
/**
 * 守门脚本：检测 :where() 包装 + @layer components 内的非零 padding 规则
 *
 * 历史问题 (2026-07-05):
 *  - Tailwind v4 preflight 的 `*, ::after, ::before, ::backdrop,
 *    ::file-selector-button { padding: 0 }` 在 @layer 之外 (unlayered),
 *    优先级最高, 压制所有 :where() 包装的 padding 规则 (特异性 = 0).
 *  - 用户报告 "首页"/"立即注册" 等文字贴左边, 无呼吸感.
 *  - 根因: .workspace-header / .ws-page-title / .skip-link / .network-offline-banner
 *    在 @layer components 内用 :where(...) { padding: ... }, 实测 padding=0.
 *  - 修复: 把 padding 提取到 unlayered 区块, 用直接类选择器 (特异性 0,1,0).
 *
 * 本脚本扫描 src/styles/ 下的 SCSS 文件, 检测任何
 *   :where(...) { ... padding: <非零值> ... }
 *   写在 @layer components 内的写法, 命中即失败, 阻断 CI/pre-commit.
 *
 * 例外:
 *  - padding: 0 (含 shorthand `padding: 0 ...` 中 0 部分) 视为故意重置, 跳过
 *  - :where() 嵌套 3 层以上且外层有 class selector (特异性 ≥ 0,1,0) 跳过
 *  - 注释行 (// 或 /* *​/) 内的 :where() 写法 跳过
 *  - .vue <style scoped> 块内 (scoped style 自带属性选择器提升特异性) 跳过
 *
 * 模式:
 *  - 默认: 扫描所有 src/styles/ 下 SCSS 文件 (audit)
 *  - --staged: 仅扫描 git staged 变更的 SCSS 文件 (用于 pre-commit)
 *  - 默认对所有文件用宽松模式 (不退出 1, 仅警告), 防止历史违规阻断
 *  - --staged 且有违规: 严格模式 (退出 1, 阻断 commit)
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const STYLES_DIR = resolve(ROOT, 'src/styles')

const STAGED = process.argv.includes('--staged')

let failed = 0
const violations = []

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) {
      out.push(...walk(full))
    } else if (full.endsWith('.scss') || full.endsWith('.css')) {
      out.push(full)
    }
  }
  return out
}

function getStagedScssFiles() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out
      .split('\n')
      .filter((line) => line.trim() && (line.endsWith('.scss') || line.endsWith('.css')))
      .map((rel) => resolve(ROOT, rel.replace(/\//g, '\\')))
      .filter((p) => existsSync(p))
  } catch {
    return []
  }
}

function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
}

function stripLineComments(src) {
  // SCSS 行注释 (//), 不在字符串内
  return src
    .split('\n')
    .map((line) => {
      // 简单策略: 找到不在引号内的 //, 之后全部替换为空格
      const idx = findUnquotedDoubleSlash(line)
      return idx >= 0 ? line.slice(0, idx) + ' '.repeat(line.length - idx) : line
    })
    .join('\n')
}

function findUnquotedDoubleSlash(line) {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i]
    if (c === "'" && !inDouble) inSingle = !inSingle
    else if (c === '"' && !inSingle) inDouble = !inDouble
    else if (!inSingle && !inDouble && c === '/' && line[i + 1] === '/') return i
  }
  return -1
}

function findLayerComponentsBlocks(src) {
  const blocks = []
  const re = /@layer\s+components\s*\{/g
  let m
  while ((m = re.exec(src)) !== null) {
    const open = m.index + m[0].length - 1
    let depth = 1
    let i = open + 1
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
      i++
    }
    blocks.push({ start: m.index, end: i })
  }
  return blocks
}

function findRulesInBlock(src, blockStart, blockEnd) {
  const rules = []
  let i = blockStart
  while (i < blockEnd) {
    while (i < blockEnd && /\s/.test(src[i])) i++
    if (i >= blockEnd) break
    if (src[i] === '@') {
      const atEnd = src.indexOf('{', i)
      if (atEnd === -1 || atEnd > blockEnd) break
      i = atEnd + 1
      continue
    }
    const braceIdx = src.indexOf('{', i)
    if (braceIdx === -1 || braceIdx > blockEnd) break
    const selector = src.slice(i, braceIdx).trim()
    let depth = 1
    let j = braceIdx + 1
    while (j < blockEnd && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      j++
    }
    const body = src.slice(braceIdx + 1, j - 1)
    if (selector && body) {
      rules.push({ selector, body, start: i })
    }
    i = j
  }
  return rules
}

function isWhereSelectorLowSpecificity(selector) {
  if (!/:where\s*\(/.test(selector)) return false
  const parts = selector.split(',').map((s) => s.trim())
  for (const part of parts) {
    const stripped = part.replace(/:where\s*\([^)]*\)/g, '')
    if (/\.\w|#\w/.test(stripped)) return false
  }
  return true
}

/**
 * 检查 padding 值是否非零.
 *   padding: 0 → 故意重置, 跳过
 *   padding: 0 24px → 含 0, 整段跳过 (4 个值任一为 0 即视为部分重置, 整段 padding 易被 preflight `*` 覆盖)
 *   padding: 4px 8px → 4 个值都非零, 违规
 *
 * 实现: 提取 padding 声明的值字符串, 拆分为 1-4 个 token, 任一 token 为 0 视为 0 值.
 */
function isPaddingNonZero(body) {
  // 匹配 padding: (排除 padding-top/right/bottom/left, 避免误判)
  const re = /(?<![\w-])padding\s*:\s*([^;]+)/g
  let m
  while ((m = re.exec(body)) !== null) {
    const valueStr = m[1].trim()
    // 拆分值: 处理 var() 包裹的情况 (var(--x) 不能简单 split)
    // 简化: 找非 var() 内的数字
    const tokens = splitPaddingValues(valueStr)
    for (const t of tokens) {
      // 0 / 0px / 0% / 0rem 等都视为 0
      if (/^0(px|rem|em|%|vw|vh)?$/i.test(t.trim())) {
        return false // 含 0 值, 视为故意重置或部分重置, 跳过
      }
    }
    return true // 第一个 padding 声明都非零, 视为违规
  }
  return false
}

function splitPaddingValues(valueStr) {
  // 简化: 移除 var() 后 split 空格/逗号
  const noVar = valueStr.replace(/var\([^)]+\)/g, '0')
  // 按空白和逗号拆分
  return noVar.split(/[\s,]+/).filter((t) => t.trim())
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  // 先去块注释, 再去行注释
  const noBlock = stripBlockComments(content)
  const stripped = stripLineComments(noBlock)
  const layerBlocks = findLayerComponentsBlocks(stripped)
  if (layerBlocks.length === 0) return

  for (const block of layerBlocks) {
    const rules = findRulesInBlock(stripped, block.start, block.end)
    for (const rule of rules) {
      if (!isWhereSelectorLowSpecificity(rule.selector)) continue
      if (!isPaddingNonZero(rule.body)) continue
      const lineNo = stripped.slice(0, rule.start).split('\n').length
      const rel = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '')
      const paddingMatch = rule.body.match(/(?<![\w-])padding\s*:\s*([^;]+)/)
      violations.push({
        file: rel,
        line: lineNo,
        selector: rule.selector,
        padding: paddingMatch ? paddingMatch[1].trim() : '',
      })
    }
  }
}

if (!existsSync(STYLES_DIR)) {
  console.error(`[FAIL] ${STYLES_DIR} 不存在`)
  process.exit(1)
}

let files
if (STAGED) {
  files = getStagedScssFiles()
  if (files.length === 0) {
    console.log('✅ 无 staged SCSS 文件, 跳过检查')
    process.exit(0)
  }
  console.log(`[--staged] 检查 ${files.length} 个 git staged SCSS 文件\n`)
} else {
  files = walk(STYLES_DIR)
}

for (const f of files) checkFile(f)

if (violations.length > 0) {
  console.error(`\n⚠️  检测到 ${violations.length} 处 :where() 非零 padding 在 @layer components 内:\n`)
  for (const v of violations) {
    console.error(`  [WARN] ${v.file}:${v.line}`)
    console.error(`         selector: ${v.selector.slice(0, 100)}`)
    console.error(`         padding:  ${v.padding.slice(0, 80)}`)
    console.error('')
  }
  if (STAGED) {
    // staged 模式: 严格, 阻断 commit
    console.error(`❌ 失败 ${violations.length} 项 (staged 模式: 违规即阻断)`)
    console.error(`\n修复: 把 padding 提取到 unlayered 区块, 用直接类选择器`)
    console.error(`例: .workspace-header { padding: 0 24px } (特异性 0,1,0, 战胜 preflight \`*\`)`)
    process.exit(1)
  }
  // 非 staged 模式: 警告但不退出, 历史违规不影响
  console.error(`ℹ️  这是历史违规, audit 模式不阻断 (用 --staged 模式严格检查新代码)`)
  process.exit(0)
}

const mode = STAGED ? ' (--staged)' : ''
console.log(
  `✅ 全部通过${mode}: 未发现 :where() 非零 padding 在 @layer components 内的违规 (扫描 ${files.length} 个 SCSS 文件)`,
)
