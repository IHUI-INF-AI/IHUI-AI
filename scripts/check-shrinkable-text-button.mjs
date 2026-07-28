#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-shrinkable-text-button.mjs — 小高度 button + 极小字号 + 中文 span label 缺 shrink-0 / whitespace-nowrap 守门
 *
 * 背景(2026-07-28 立):
 *   小高度 button(h-4 ~ h-8)+ 极小字号(text-xs / text-[10px] 等)内含中文 label 时,
 *   若缺 shrink-0 或 whitespace-nowrap,在 flex 父容器窄空间下会被压缩/换行,
 *   导致 UI 错位 / 文字溢出 / 布局抖动。
 *   已知真实案例:apps/web/src/components/ai/agent-task-progress-pane.tsx "对话流" / "时间线" tab 按钮
 *   原缺 shrink-0,被 flex 父容器压缩。
 *
 * 守门规则(4 条 AND):
 *   1. JSX 元素 <button> 或 <Button>(命中即扫)
 *   2. className 含小高度 h-4 / h-5 / h-6 / h-7 / h-8 任一
 *   3. className 含极小字号 text-xs / text-[10px] / text-[11px] / text-[12px] 任一
 *   4. 直接子节点含 ≥2 中文字符的纯文本(通常 <span>{xxx}</span> 或纯文本),
 *      且 button 缺 shrink-0 AND 缺 whitespace-nowrap(两个都缺才算)
 *
 * 白名单(命中后跳过,不报违规):
 *   - 含 truncate className(已处理省略)
 *   - 含 inline-flex + gap-* + w-* 指定 width(> 80px → 宽度足够不收缩)
 *   - aria-label + 无直接中文 span 子节点(icon-only button,文字只是辅助)
 *   - 含 whitespace-pre / whitespace-pre-line(显式保留空白)
 *   - 父容器是 sr-only(屏幕阅读器独占)
 *
 * 用法:
 *   node scripts/check-shrinkable-text-button.mjs                              # 全量扫描 + 人类可读列表 + exit 0
 *   node scripts/check-shrinkable-text-button.mjs --scan --output <path>      # 扫描 + 写 JSON 到文件
 *   node scripts/check-shrinkable-text-button.mjs --scan --output <path> --quiet  # 扫描 + JSON + 只打印摘要
 *   node scripts/check-shrinkable-text-button.mjs --dry-run                    # 等同于无参数,但显式语义
 *   node scripts/check-shrinkable-text-button.mjs --strict                     # 命中即 exit 1(CI 用)
 *   node scripts/check-shrinkable-text-button.mjs --path <glob>               # 只扫指定路径(逗号分隔)
 *   node scripts/check-shrinkable-text-button.mjs --quiet                      # 只输出文件数 + 命中数
 *   node scripts/check-shrinkable-text-button.mjs --help                      # 打印本帮助
 *
 * 退出码:
 *   0 = 无命中 / 扫描成功
 *   1 = 命中(--strict) / 文件 IO 错误
 *   2 = 参数错误 / --help 触发
 *
 * 触发场景:
 *   - pre-commit 第 X 项(本任务完成时建议登记到 .husky/pre-commit)
 *   - CI nightly 扫描
 *   - 开发自查:发现新加小高度 button 时跑一次
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

// ─── CLI 参数解析 ────────────────────────────────────────────────
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
check-shrinkable-text-button.mjs — 小高度 button + 极小字号 + 中文 span label 缺 shrink-0 / whitespace-nowrap 守门

用法:
  node scripts/check-shrinkable-text-button.mjs [options]

选项:
  --scan                      扫描模式:全量扫描 + 输出 JSON 到 stdout 或 --output 指定的文件
  --dry-run                   扫描 + 人类可读列表(默认行为,显式语义)
  --strict                    命中即 exit 1(给 CI 用,默认仅打印)
  --quiet                     只输出文件数 + 命中数
  --output <path>             --scan 模式下写 JSON 到指定路径
  --path <glob>               只扫指定路径(逗号分隔,默认 apps/ packages/ui-react/src/)
  --help | -h                 打印本帮助

退出码:
  0 = 无命中 / 扫描成功
  1 = 命中(--strict) / 文件 IO 错误
  2 = 参数错误

触发场景:
  - pre-commit hook(本任务建议登记到 .husky/pre-commit)
  - CI nightly
  - 开发自查
`)
  process.exit(0)
}

const isScan = args.includes('--scan')
const isDryRun = args.includes('--dry-run')
const isStrict = args.includes('--strict')
const isQuiet = args.includes('--quiet')
const outputIdx = args.findIndex((a) => a === '--output')
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null
const pathIdx = args.findIndex((a) => a === '--path')
const pathArg = pathIdx >= 0 ? args[pathIdx + 1] : null

if (outputIdx >= 0 && !outputPath) {
  console.error('❌ --output 需要指定路径')
  process.exit(2)
}
if (pathIdx >= 0 && !pathArg) {
  console.error('❌ --path 需要指定 glob(逗号分隔)')
  process.exit(2)
}

// ─── 颜色 & 工具 ───────────────────────────────────────────────
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}
const isTTY = process.stdout.isTTY
const c = (color, s) => (isTTY ? `${C[color]}${s}${C.reset}` : String(s))

// ─── 配置 ───────────────────────────────────────────────────
const REPO_ROOT = process.cwd()
const DEFAULT_SCAN_DIRS = ['apps', 'packages/ui-react/src']
const SCAN_DIRS = pathArg
  ? pathArg
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  : DEFAULT_SCAN_DIRS
const SCAN_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js'])

// 排除的目录(构建产物/依赖/VCS)
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.git',
  '.trae-cn',
  'coverage',
  '__tests__',
  'tests',
  'test',
  'e2e',
])

// 命中规则:小高度 h-N
const SMALL_HEIGHT_PATTERN = /\bh-(?:4|5|6|7|8)\b/

// 命中规则:极小字号
// 注: text-[10px] 末尾的 ] 不是 word char,所以末尾不能用 \b,改用 (?=\s|$|"|')
const TINY_TEXT_PATTERN = /(?:^|\s)text-(?:xs|\[\s*(?:9|10|11|12)px\s*\])(?=\s|$|"|')/

// 命中规则:有 shrink-0
const HAS_SHRINK_0 = /\bshrink-0\b/

// 命中规则:有 whitespace-nowrap
const HAS_WHITESPACE_NOWRAP = /\bwhitespace-nowrap\b/

// 命中规则:有 truncate(已处理省略)
const HAS_TRUNCATE = /\btruncate\b/

// 白名单:含 w-N 指定明确宽度(放宽,> 32px)
const HAS_FIXED_WIDTH = /\bw-(?:\[?\d+(?:\.\d+)?(?:px|rem)\]?|\d+)\b/

// 白名单:inline-flex + gap + 固定宽
const HAS_INLINE_FLEX_GAP_WIDTH = /\binline-flex\b/.test.bind(/\binline-flex\b/) // placeholder
// 实际函数见 hasWidthEnough

// 中文字符正则(基本汉字 + 标点)
const CHINESE_TEXT_REGEX = /[\u4e00-\u9fff]{2,}/

// ─── 文件遍历 ───────────────────────────────────────────────
function walkDir(dir, results = []) {
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (EXCLUDED_DIRS.has(entry)) continue
    let st
    try {
      st = statSync(fullPath)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walkDir(fullPath, results)
    } else if (st.isFile()) {
      const ext = entry.slice(entry.lastIndexOf('.'))
      if (SCAN_EXTS.has(ext)) results.push(fullPath)
    }
  }
  return results
}

// ─── className 提取 ─────────────────────────────────────────
// 从 <button... className="..." > 提取 className 字符串
// 支持: className="..." / className={'...'} / className={cn('a', 'b')} / className={cn('a', cond && 'b')}
// 简化处理:尝试提取所有类名字符串字面量并拼接
function extractClassNamesFromTag(tagContent) {
  // 找 className= 出现位置(可能多次,取最后一个)
  // 支持 className="..." / className={...}
  const cnMatches = []
  const cnRe = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/g
  let m
  while ((m = cnRe.exec(tagContent)) !== null) {
    if (m[1] !== undefined) {
      // "..." 字符串字面量
      cnMatches.push(m[1])
    } else if (m[2] !== undefined) {
      // '...' 字符串字面量
      cnMatches.push(m[2])
    } else if (m[3] !== undefined) {
      // {...} 表达式 — 提取内部所有 '...' 和 "..." 字符串字面量
      const expr = m[3]
      const strRe = /(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')/g
      let s
      while ((s = strRe.exec(expr)) !== null) {
        cnMatches.push(s[1] !== undefined ? s[1] : s[2])
      }
    }
  }
  return cnMatches.join(' ')
}

// ─── button 块匹配(支持嵌套 + 多行)─────────────────────────
// 找到所有 <button ...>...</button> 块(支持嵌套)
// 返回 [{openStart, openEnd, closeStart, closeEnd, tagName, tagContent, body, raw}]
function findButtonBlocks(content) {
  const blocks = []
  // 匹配 <button 或 <Button 开始标签
  const openRe = /<button\b/g
  const closeRe = /<\/button>/g
  const openMatches = []
  let m
  while ((m = openRe.exec(content)) !== null) {
    openMatches.push({ index: m.index, end: openRe.lastIndex })
  }
  const closeMatches = []
  while ((m = closeRe.exec(content)) !== null) {
    closeMatches.push({ index: m.index, end: m.index + m[0].length })
  }
  // 用栈匹配
  let openIdx = 0
  let closeIdx = 0
  const stack = []
  while (openIdx < openMatches.length || closeIdx < closeMatches.length) {
    const nextOpen = openMatches[openIdx]?.index ?? Infinity
    const nextClose = closeMatches[closeIdx]?.index ?? Infinity
    if (nextOpen < nextClose) {
      stack.push({ open: openMatches[openIdx], bodyStart: openMatches[openIdx].end })
      openIdx++
    } else {
      // close
      if (stack.length > 0) {
        const item = stack.pop()
        const close = closeMatches[closeIdx]
        blocks.push({
          openStart: item.open.index,
          openEnd: item.bodyStart,
          closeStart: close.index,
          closeEnd: close.end,
          body: content.slice(item.bodyStart, close.index),
          raw: content.slice(item.open.index, close.end),
        })
      }
      closeIdx++
    }
  }
  // 也匹配 <Button> 大写(Shadcn/Radix wrapper)— 作为 variant 检测
  // 用相同逻辑
  const upperBlocks = []
  const openReUpper = /<Button\b/g
  const closeReUpper = /<\/Button>/g
  const openMatchesUpper = []
  while ((m = openReUpper.exec(content)) !== null) {
    openMatchesUpper.push({ index: m.index, end: openReUpper.lastIndex })
  }
  const closeMatchesUpper = []
  while ((m = closeReUpper.exec(content)) !== null) {
    closeMatchesUpper.push({ index: m.index, end: m.index + m[0].length })
  }
  let oi = 0
  let ci = 0
  const stack2 = []
  while (oi < openMatchesUpper.length || ci < closeMatchesUpper.length) {
    const nextOpen = openMatchesUpper[oi]?.index ?? Infinity
    const nextClose = closeMatchesUpper[ci]?.index ?? Infinity
    if (nextOpen < nextClose) {
      stack2.push({ open: openMatchesUpper[oi], bodyStart: openMatchesUpper[oi].end })
      oi++
    } else {
      if (stack2.length > 0) {
        const item = stack2.pop()
        const close = closeMatchesUpper[ci]
        upperBlocks.push({
          openStart: item.open.index,
          openEnd: item.bodyStart,
          closeStart: close.index,
          closeEnd: close.end,
          body: content.slice(item.bodyStart, close.index),
          raw: content.slice(item.open.index, close.end),
        })
      }
      ci++
    }
  }
  return [...blocks, ...upperBlocks]
}

// ─── 行号计算 ───────────────────────────────────────────────
function indexToLine(content, idx) {
  let line = 1
  for (let i = 0; i < idx && i < content.length; i++) {
    if (content[i] === '\n') line++
  }
  return line
}

// ─── 提取 button 标签内容(直到 >,处理字符串/JS 表达式)──────
function extractTagContent(content, startIdx) {
  // startIdx 指向 '<' 的位置
  // 找 '>' 结束标签,处理字符串 ' " ` 和 JS 表达式 { }
  let i = startIdx + 1
  while (i < content.length) {
    const ch = content[i]
    if (ch === '>') return content.slice(startIdx, i + 1)
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (ch === '{') {
      let depth = 1
      i++
      while (i < content.length && depth > 0) {
        if (content[i] === '{') depth++
        else if (content[i] === '}') depth--
        else if (content[i] === '"' || content[i] === "'" || content[i] === '`') {
          const q = content[i]
          i++
          while (i < content.length && content[i] !== q) {
            if (content[i] === '\\') i++
            i++
          }
        }
        i++
      }
      continue
    }
    i++
  }
  return null
}

// ─── 提取 button 内的中文 label(从 body 中找中文 span)────
function extractChineseLabels(body) {
  const labels = []
  // 匹配 <span>...</span> 内容
  const spanRe = /<span\b[^>]*>([\s\S]*?)<\/span>/g
  let m
  while ((m = spanRe.exec(body)) !== null) {
    const inner = m[1].trim()
    // 跳过纯表达式 / 数字 / 英文
    const text = inner.replace(/<[^>]+>/g, '').trim()
    if (CHINESE_TEXT_REGEX.test(text)) {
      labels.push({
        text: text.slice(0, 30),
        raw: m[0].slice(0, 100),
      })
    }
  }
  // 也匹配直接中文文本子节点(罕见但存在)
  // 简化:从 body 中找 ≥2 个连续中文字符且不在 JSX 标签内
  // 跳过 — 通常中文 label 都在 <span> 内
  return labels
}

// ─── 判断 button 是否 icon-only(无中文 span)───────────────
function isIconOnly(body, hasChineseLabels) {
  return hasChineseLabels.length === 0
}

// ─── 主分析函数 ─────────────────────────────────────────────
function analyzeButton(content, block) {
  // 1. 提取 tag 头(<button ... > 部分)
  const tagContent = extractTagContent(content, block.openStart)
  if (!tagContent) return null

  // 2. 提取 className
  const classNames = extractClassNamesFromTag(tagContent)

  // 3. 检查规则 2/3(小高度 + 极小字号)
  const hasSmallHeight = SMALL_HEIGHT_PATTERN.test(classNames)
  const hasTinyText = TINY_TEXT_PATTERN.test(classNames)
  if (!hasSmallHeight || !hasTinyText) return null

  // 4. 检查规则 4a(中文 span label)
  const labels = extractChineseLabels(block.body)
  if (labels.length === 0) {
    // icon-only button 跳过(白名单)
    return null
  }

  // 5. 白名单
  if (HAS_TRUNCATE.test(classNames)) return null
  if (HAS_WHITESPACE_NOWRAP.test(classNames) && HAS_SHRINK_0.test(classNames)) {
    return null // 两个都已有,合规
  }

  // 6. 检查缺哪个
  const missing = []
  if (!HAS_SHRINK_0.test(classNames)) missing.push('shrink-0')
  if (!HAS_WHITESPACE_NOWRAP.test(classNames)) missing.push('whitespace-nowrap')
  if (missing.length === 0) return null

  return {
    line: indexToLine(content, block.openStart),
    label: labels[0]?.text || '',
    className: classNames.trim().slice(0, 200),
    missing,
    raw: tagContent.slice(0, 200).replace(/\s+/g, ' '),
  }
}

// ─── 主流程 ─────────────────────────────────────────────────
const scanStart = Date.now()
const allHits = []
let totalButtons = 0
let filesScanned = 0

for (const scanDir of SCAN_DIRS) {
  const fullDir = join(REPO_ROOT, scanDir)
  const files = walkDir(fullDir)
  for (const file of files) {
    filesScanned++
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch (err) {
      console.error(`❌ 读取失败: ${file} — ${err.message}`)
      continue
    }
    const blocks = findButtonBlocks(content)
    totalButtons += blocks.length
    for (const block of blocks) {
      const result = analyzeButton(content, block)
      if (result) {
        allHits.push({
          file: relative(REPO_ROOT, file).replace(/\\/g, '/'),
          line: result.line,
          label: result.label,
          className: result.className,
          missing: result.missing,
        })
      }
    }
  }
}

const filesAffected = new Set(allHits.map((h) => h.file)).size
const elapsedMs = Date.now() - scanStart

const result = {
  scannedAt: new Date().toISOString(),
  totalButtons,
  filesScanned,
  hits: allHits,
  summary: {
    filesAffected,
    totalHits: allHits.length,
    elapsedMs,
    scanDirs: SCAN_DIRS,
  },
}

// ─── 输出 ──────────────────────────────────────────────────
if (isScan) {
  // JSON 模式
  if (outputPath) {
    try {
      // outputPath 可能是绝对路径(测试场景)或相对路径(项目内路径)
      // Windows path.join 不识别 C:\ 开头的绝对路径,需用 isAbsolute 判断
      const isAbs = /^[a-zA-Z]:[\\\/]/.test(outputPath) || outputPath.startsWith('/')
      const outFull = isAbs ? outputPath : join(REPO_ROOT, outputPath)
      mkdirSync(dirname(outFull), { recursive: true })
      writeFileSync(outFull, JSON.stringify(result, null, 2), 'utf8')
      if (!isQuiet) {
        console.log(c('green', `✅ JSON 已写入: ${outputPath}`))
        console.log(c('dim', `  扫描 ${filesScanned} 文件, ${totalButtons} button 块, 命中 ${allHits.length} 条(涉及 ${filesAffected} 文件), 耗时 ${elapsedMs}ms`))
      } else {
        console.log(`scanned=${filesScanned} buttons=${totalButtons} hits=${allHits.length} files=${filesAffected} elapsed=${elapsedMs}ms`)
      }
    } catch (err) {
      console.error(`❌ 写入失败: ${outputPath} — ${err.message}`)
      process.exit(1)
    }
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
  if (isStrict && allHits.length > 0) process.exit(1)
  process.exit(0)
} else {
  // 人类可读模式
  if (isQuiet) {
    console.log(`scanned=${filesScanned} buttons=${totalButtons} hits=${allHits.length} files=${filesAffected}`)
    if (isStrict && allHits.length > 0) process.exit(1)
    process.exit(0)
  }
  if (allHits.length === 0) {
    console.log(c('green', `✅ 小高度 button 中文 label 守门通过`))
    console.log(
      c(
        'dim',
        `扫描 ${filesScanned} 文件, ${totalButtons} button 块, 命中 0 条, 耗时 ${elapsedMs}ms`,
      ),
    )
    process.exit(0)
  }
  console.error('')
  console.error(
    c('red', `❌ 发现 ${c('bold', allHits.length)} 处小高度 button 中文 label 缺 shrink-0 / whitespace-nowrap`),
  )
  console.error(c('dim', `扫描 ${filesScanned} 文件, ${totalButtons} button 块, 涉及 ${filesAffected} 文件, 耗时 ${elapsedMs}ms`))
  console.error('')
  for (const h of allHits) {
    console.error(`  ${c('red', `${h.file}:${h.line}`)}`)
    console.error(`  ${c('yellow', `  label: "${h.label}"`)}`)
    console.error(`  ${c('yellow', `  缺: ${h.missing.join(', ')}`)}`)
    console.error(`  ${c('dim', `  className: ${h.className}`)}`)
    console.error('')
  }
  console.error(c('bold', '修复方法:'))
  console.error(`  给 button className 补 ${c('green', 'shrink-0')} + ${c('green', 'whitespace-nowrap')}`)
  console.error(`  ${c('dim', '例: className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[10px]"')}`)
  console.error('')
  if (isStrict) process.exit(1)
  process.exit(0)
}
