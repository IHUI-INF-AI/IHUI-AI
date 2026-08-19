#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 容器圆角守门 — 防止新增 rounded-full / rounded-pill / 9999px / 50% 用于容器。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"(强制):任何承载内容或交互的容器
 * (卡片 / 面板 / 按钮 / 输入框 / 弹窗 / 标签条 / 侧栏项 / 操作行 / 列表项 /
 *  气泡 / 工具栏 / 浮层 / 徽章容器 等)一律不得使用纯圆 / 胶囊圆角。
 *  只允许规范圆角档位:rounded-sm(2px)/ rounded(4px)/ rounded-md(6px)/
 *  rounded-lg(8px)/ rounded-xl(12px)/ rounded-2xl(16px)。
 *
 * 唯一豁免(仅限非容器装饰元素,不承载主要内容/交互):
 *   1. <img> 标签上的 rounded-full(头像图片本身)
 *   2. SwitchPrimitives.Thumb 或 data-[state=checked]:translate-x 上下文(Switch 拇指)
 *   3. 极小尺寸纯装饰状态点(w-2 h-2 / h-1.5 w-1.5 等,<= 8px 装饰)
 *   4. 未读红点底(bg-red-500 + min-w-[16px] h-4 上下文)
 *   5. 进度环 / LoadingSpinner 的 border + animate-spin(纯装饰动画)
 *
 * 用法:
 *   node scripts/check-rounded-full.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-rounded-full.mjs             (全量扫描报告, exit 0)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

// EXCLUDE_DIRS:基于共享 EXCLUDE_DIRS,追加脚本特有(.trae-cn / tests / __tests__ / e2e)
const EXCLUDE_DIRS = withExcludes(['.trae-cn', 'tests', '__tests__', 'e2e'])

const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']

/** 违规模式 */
const VIOLATION_PATTERNS = [
  { re: /rounded-full\b/, label: 'rounded-full' },
  { re: /rounded-pill\b/, label: 'rounded-pill' },
  { re: /border-radius\s*:\s*9999px/i, label: 'border-radius:9999px' },
  { re: /border-radius\s*:\s*50%/i, label: 'border-radius:50%' },
]

/**
 * 豁免判定 — 返回 true 表示该行可豁免(不算违规)。
 * 严格按 AGENTS.md 第 4 节"唯一豁免"清单 + Radix UI primitives 通用圆形控件特征。
 *
 * @param {string} line - 当前行内容
 * @param {string} [file] - 当前文件路径(用于上下文豁免)
 * @param {string[]} [allLines] - 文件全部行(用于前向注释豁免)
 * @param {number} [idx] - 当前行在 allLines 中的索引
 */
function isExempt(line, file, allLines, idx) {
  const trimmed = line.trim()

  // 豁免 0: 纯注释行(// 或 /* 或 * 开头,提到 rounded-full 只是在说明规则)
  // 同步支持 JSX 块注释 {/* ... */}
  if (/^\s*(\/\/|\/\*|\*|\{)/.test(trimmed)) return true

  // 豁免 0b: 前 N 行有"豁免说明"注释(开发者显式说明这行 rounded-full 是合规的)
  // 模式: 注释行包含 "豁免 N" 或 "exempt" 或 "decorative" + 具体豁免理由关键词
  // 上限 5 行前向检查(避免误判远处的注释与本行无关)
  // 同步支持 JSX 块注释 {/* ... */}
  if (file && allLines) {
    for (let back = 1; back <= 5 && idx - back >= 0; back++) {
      const prev = (allLines[idx - back] || '').trim()
      // 仅看单行注释(//, /*, *, 或 JSX 块注释开头 {)
      if (!/^\s*(\/\/|\/\*|\*|\{)/.test(prev)) continue
      // 必须同时有"豁免说明标记" + "理由关键词"
      const hasExemptMarker = /豁免\s*\d+[a-z]?\s*[:：]/.test(prev) || /\bexempt\b/i.test(prev) || /@allow-rounded-full/.test(prev)
      const hasReasonKw = /装饰|头像|指示器|胶囊|红点|徽章|avatar|decorator|indicator/i.test(prev)
      if (hasExemptMarker && hasReasonKw) return true
      // 显式标记
      if (/@allow-rounded-full/.test(prev)) return true
    }
  }

  // 豁免 1: <img> / AvatarImage / next/image 上的 rounded-full(头像图片本身)
  if (/<img\b[^>]*\brounded-full\b/.test(trimmed)) return true
  if (/<Image\b[^>]*\brounded-full\b/.test(trimmed)) return true
  if (/AvatarImage\b[^>]*\brounded-full\b/.test(trimmed)) return true

  // 豁免 1b: mobile-rn / Taro <Image>/<View> 头像容器(width/height 设定的容器型头像)
// 例: <Image source={...} className="rounded-full" style={{ width: 60, height: 60 }} />
// 关键: 标签可能跨多行(Image 在 line N, className 在 line N+1, style 在 line N+2)
// 检测窗口: 当前行 + 上下 5 行
if (allLines) {
  const window = allLines.slice(Math.max(0, idx - 5), Math.min(allLines.length, idx + 5)).join('\n')
  // 检测 <Image> 或 <View> 标签 + rounded-full + 后续 width/height
  if (/<(?:Image|View)\b[^>]*\brounded-full\b/.test(window) && /\b(?:width|height)\s*:\s*\d{2,3}/.test(window)) return true
  // Taro rpx: w-[140rpx] h-[140rpx]
  if (/<(?:Image|View)\b[^>]*\brounded-full\b/.test(window) && /\b(?:w|h)-\[(\d{2,3})rpx\]/.test(window)) return true
  // Taro className 含 w-[140rpx] h-[140rpx]
  if (/\b(?:w|h)-\[\d{2,3}rpx\]/.test(window) && /\bh-\[\d{2,3}rpx\]/.test(window)) return true
}

  // 豁免 2: Switch(Radix Switch Root/Thumb 特征)
  // Thumb 特征: block rounded-full bg-background shadow-lg ring-0 transition-transform
  if (/block\s+rounded-full\s+bg-background\s+shadow-lg/.test(trimmed)) return true
  if (/data-\[state=checked\]:translate-x/.test(trimmed)) return true
  if (/data-\[state=unchecked\]:translate-x/.test(trimmed)) return true
  if (/SwitchPrimitives\.Thumb/.test(trimmed)) return true
  if (/SwitchThumb\b/.test(trimmed)) return true
  // Root track 特征: inline-flex shrink-0 items-center rounded-full border-2 border-transparent
  if (/inline-flex\s+shrink-0\s+items-center\s+rounded-full\s+border-2\s+border-transparent/.test(trimmed)) return true

  // 豁免 3: Radio 圆形单选按钮(Radix RadioGroup Indicator 特征)
  // 模式: flex h-4 w-4 items-center justify-center rounded-full border border-input
  if (/flex\s+h-4\s+w-4\s+items-center\s+justify-center\s+rounded-full\s+border\s+border-input/.test(trimmed)) return true
  if (/RadioPrimitive/.test(trimmed)) return true
  if (/RadioGroupPrimitive/.test(trimmed)) return true
  if (/<input[^>]*type="radio"[^>]*\brounded-full\b/.test(trimmed)) return true

  // 豁免 4: Avatar 组件内部 shape=circle 的 conditional
  if (/===\s*['"]circle['"]\s*\?[^)]*rounded-full/.test(trimmed)) return true
  if (/shape\s*===\s*['"]circle['"]/.test(trimmed) && /rounded-full/.test(trimmed)) return true

  // 豁免 5: 极小尺寸纯装饰状态点(<= 14px,w-1/h-1/w-1.5/h-1.5/w-2/h-2/w-2.5/h-2.5/w-3/h-3/w-3.5/h-3.5)
  // 仅当:rounded-full + 小尺寸 + 不含大容器特征(flex-1, px-3+, py-3+, p-[3-9], p-\d{2}, text-base+)
  if (/\brounded-full\b/.test(trimmed)) {
    const smallSize = /\b(?:w|h)-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(trimmed)
    const bothDims =
      /\bw-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(trimmed) &&
      /\bh-(?:1(?:\.5)?|2(?:\.5)?|3(?:\.5)?)\b/.test(trimmed)
    const noLargeContainer = !/\b(?:flex-1|px-[3-9]|px-\d{2}|py-[3-9]|py-\d{2}|p-[3-9]|p-\d{2}|text-base|text-lg|text-xl)\b/.test(trimmed)
    if (smallSize && bothDims && noLargeContainer) return true
    // w-0.5 / h-0.5 极窄装饰条(2px,语音波形等)
    if (/\b(?:w|h)-0\.5\b/.test(trimmed)) return true
    // 竖向装饰指示器(分页指示器 active 胶囊):width <= 8px 且 height >= 12px
    // 例: PageIndicator active 态 h-4 w-1.5 (16x6)、h-5 w-2 (20x8)、h-6 w-2 (24x8,2026-08-13 v10)
    // 规则来源:用户 2026-07-20 v5 明确要求"竖向胶囊",不视作违规
    if (
      /\bw-(?:0\.5|1|1\.5|2)\b/.test(trimmed) &&
      /\bh-(?:3|3\.5|4|4\.5|5|6|7|8)\b/.test(trimmed) &&
      noLargeContainer
    ) {
      return true
    }
  }

  // 豁免 6: 未读红点底(bg-red-500/bg-destructive + 小尺寸 + px-1 或绝对定位 -top/-right)
  // 同步支持 Taro rpx 单位(w-[28rpx], w-[32rpx] 等 <= 64 rpx 装饰点)
  if (/\bbg-(?:red-500|destructive)\b/.test(trimmed) && /\brounded-full\b/.test(trimmed)) {
    if (/\b(?:min-w-\[?\d+r?px?\]?|h-\[?\d+r?px?\]?|w-\[?\d+r?px?\]?|h-4|w-4|h-5|min-w-5|min-h-5)\b/.test(trimmed)) return true
    if (/\bpx-1\b/.test(trimmed) && /\b(?:absolute|top|right|left|bottom)/.test(trimmed)) return true
    // Taro: -top-1 / -top-[8rpx] + w-[28rpx] 装饰红点
    if (/(?:min-w-\[\d+rpx\]|w-\[\d+rpx\]|h-\[\d+rpx\])/.test(trimmed) && /absolute/.test(trimmed)) return true
  }

  // 豁免 6b: 通用小尺寸绝对定位装饰点(<= 64px 或 <= 64rpx,任意背景色)
  // 装饰点典型: 绝对定位 top-right + 圆形背景 + 尺寸小(通知红点/状态徽章)
  if (
    /\brounded-full\b/.test(trimmed) &&
    /\babsolute\b/.test(trimmed) &&
    (/\b(?:min-w-\[?\d+r?px?\]?|w-\[?\d+r?px?\]?|h-\[?\d+r?px?\]?|h-4|w-4|h-5|min-w-5|min-h-5)\b/.test(trimmed))
  ) {
    // 尺寸 <= 64 rpx 或 <= 64 px
    const sizeMatch = trimmed.match(/(?:min-w-|w-|h-|min-h-)(\[\d+rpx\]|\[?\d+px?\]?|4|5|6|7|8|9|10|12|14|16|20|24|28|32|40|48|56|64)/)
    if (sizeMatch) {
      const raw = sizeMatch[1]
      const numMatch = raw.match(/\d+/)
      if (numMatch && parseInt(numMatch[0]) <= 64) return true
    }
  }

  // 豁免 7: 纯装饰动画(border + animate-spin / animate-bounce / animate-ping / animate-pulse + rounded-full)
  if (/\banimate-(?:spin|bounce|ping|pulse)\b/.test(trimmed) && /\brounded-full\b/.test(trimmed)) return true

  // 豁免 8: 进度环 / LoadingSpinner 的 border + animate-spin(纯装饰动画)
  if (/\banimate-spin\b/.test(trimmed) && /\bborder\b/.test(trimmed)) return true

  return false
}

/**
 * CSS/SCSS 上下文感知豁免 — 返回 true 表示该 50% 行可豁免。
 * 仅对 .css/.scss 文件生效,基于选择器名 + 块内属性判断。
 * 覆盖:小装饰点(≤14px/rpx)、装饰动画(pulse/spin/ping/bounce)、
 *       ::before/::after 伪元素(≤20 或有动画)、头像图片选择器。
 */
function isCssExempt(lines, idx, file) {
  if (!file.endsWith('.css') && !file.endsWith('.scss')) return false
  const cur = lines[idx].trim()
  if (!/border-radius\s*:\s*50%/i.test(cur)) return false

  // 定位当前块边界:向上找最近的 {,向下找匹配的 }
  let blockStart = -1
  let depth = 0
  for (let i = idx; i >= 0; i--) {
    const t = lines[i]
    if (t.includes('}')) depth++
    if (t.includes('{')) {
      depth--
      if (depth <= 0) { blockStart = i; break }
    }
  }
  if (blockStart === -1) return false
  let blockEnd = lines.length - 1
  depth = 1
  for (let i = blockStart + 1; i < lines.length; i++) {
    if (lines[i].includes('{')) depth++
    if (lines[i].includes('}')) {
      depth--
      if (depth === 0) { blockEnd = i; break }
    }
  }
  const selectorLine = (lines[blockStart] || '').trim()
  const blockText = lines.slice(blockStart, blockEnd + 1).join('\n')

  const wMatch = blockText.match(/width\s*:\s*(\d+(?:\.\d+)?)\s*(px|rpx)?/i)
  const hMatch = blockText.match(/height\s*:\s*(\d+(?:\.\d+)?)\s*(px|rpx)?/i)
  const w = wMatch ? parseFloat(wMatch[1]) : Infinity
  const h = hMatch ? parseFloat(hMatch[1]) : Infinity

  // 规则 1: 纯装饰小点(width AND height <= 14 px/rpx)
  if (w <= 14 && h <= 14) return true

  // 规则 2: 装饰动画(animate pulse/spin/ping/bounce)
  if (/animation\s*:[^;]*(?:pulse|spin|ping|bounce)/i.test(blockText)) return true

  // 规则 3: ::before / ::after 伪元素(小尺寸 <=20 或有装饰动画)
  if (/::(?:before|after)/.test(selectorLine)) {
    if (w <= 20 && h <= 20) return true
    if (/animation\s*:[^;]*(?:pulse|spin|ping|bounce)/i.test(blockText)) return true
  }

  // 规则 4: 头像图片选择器(.avatar / .card-avatar / .agent-avatar / .user-avatar / .profile-img / .photo)
  // 同步支持 Taro/小程序的 .cp-member-avatar, .member-avatar, .user-avatar 等驼峰类名
  if (/(?:\.avatar|language-\.avatar|[\w-]*avatar|profile-img|profile-photo|profile-image)\b/i.test(selectorLine)) return true

  // 规则 5: 装饰点/红点底选择器(.dot / .badge / .unread / .notice / .indicator / .marker)
  // 红点底典型: 8-32 px/rpx,绝对定位,圆形
  if (/(?:\.dot|\.badge|\.unread|\.notice|\.indicator|\.marker|\.bubble)\b/.test(selectorLine)) {
    if (/\bposition\s*:\s*absolute\b/i.test(blockText)) return true
  }

  // 规则 6: rpx 物理小尺寸(<= 64 rpx 装饰点,约 21 物理像素,iPhone 1.5px 比例适配)
  // 排除容器型选择器(无具体尺寸 = 容器/卡片,不豁免)
  if (w <= 64 && h <= 64 && w !== Infinity && h !== Infinity) return true

  return false
}

function collectFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, result)
    } else if (SCAN_EXTS.some((e) => entry.endsWith(e))) {
      result.push(full)
    }
  }
  return result
}

/**
 * 从 git diff --cached -U0 输出中提取每个文件的新增行(+ 开头)及其行号。
 * 返回 Map<absPath, Set<lineNumber>>
 */
function getStagedAddedLines() {
  const result = new Map()
  let output
  try {
    output = execSync('git diff --cached -U0 --diff-filter=ACM --no-color', {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    return result
  }
  if (!output) return result

  let curFile = null
  let curLine = 0
  for (const raw of output.split('\n')) {
    // 修复:`+++ b/path` 是 diff 输出中的独立行(紧跟 `diff --git` 后),
    // 必须单独判断;原来错误地放在 `diff --git` 块内匹配导致 curFile 始终为 null。
    if (raw.startsWith('+++ b/')) {
      const m = raw.match(/^\+\+\+\s+b\/(.+)$/)
      curFile = m ? join(ROOT, m[1]) : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
      // `diff --git a/x b/x` 行仅作分隔符,文件路径在下一行 `+++ b/` 上
      curFile = null
      curLine = 0
      continue
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/)
      curLine = m ? parseInt(m[1], 10) : 0
      continue
    }
    if (curFile && curLine > 0) {
      if (raw.startsWith('+') && !raw.startsWith('+++')) {
        if (!result.has(curFile)) result.set(curFile, new Set())
        result.get(curFile).add(curLine)
        curLine++
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        // 删除行,不推进 curLine
      } else {
        curLine++
      }
    }
  }
  return result
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .filter((f) => SCAN_EXTS.some((e) => f.endsWith(e)))
      .filter((f) => !EXCLUDE_DIRS.has(f.split('/')[0]))
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
  } catch {
    return []
  }
}

console.log(
  `${C.cyan}${C.bold}[容器圆角守门] 扫描 rounded-full / rounded-pill / 9999px / 50% 违规...${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — 容器禁用纯圆/胶囊, 豁免 img/Switch/Radio/Avatar shape/<=14px 装饰点/红点底/animate-spin${C.reset}`,
)
console.log(
  `${C.dim}模式: ${isStaged ? 'staged (新增违规阻塞 commit)' : '全量 (warn-only, exit 0)'}${C.reset}`,
)
console.log('')

let files = []
let addedLinesMap = new Map()

if (isStaged) {
  addedLinesMap = getStagedAddedLines()
  files = getStagedFiles().filter((f) => addedLinesMap.has(f))
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无 .ts/.tsx/.js/.jsx/.css/.scss 变更,跳过${C.reset}`)
    process.exit(0)
  }
} else {
  // 全量:扫 apps/ + packages/
  for (const sub of ['apps', 'packages']) {
    files = files.concat(collectFiles(join(ROOT, sub)))
  }
}

let totalViolations = 0
const fileReports = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const findings = []

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    // staged 模式只检查新增行
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      if (!allowed || !allowed.has(lineNumber)) return
    }
    if (isExempt(line, file, lines, idx)) return
    if (isCssExempt(lines, idx, file)) return
    for (const { re, label } of VIOLATION_PATTERNS) {
      const m = re.exec(line)
      if (m) {
        findings.push({
          line: lineNumber,
          col: m.index + 1,
          label,
          snippet: line.trim().slice(0, 140),
        })
      }
    }
  })

  if (findings.length > 0) {
    totalViolations += findings.length
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${totalViolations} 处`)
console.log('')

if (totalViolations === 0) {
  console.log(
    `${C.green}${C.bold}✅ 容器圆角守门通过${C.reset}`,
  )
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}[${f.label}]${C.reset} ${f.snippet}`,
    )
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(
  `  1. 容器改用规范圆角: rounded-sm(2px) / rounded(4px) / rounded-md(6px) / rounded-lg(8px) / rounded-xl(12px) / rounded-2xl(16px)`,
)
console.log(
  `  2. 确认是否属于豁免(img/Switch Thumb/<=8px 装饰点/红点底/animate-spin),若是请保留 rounded-full`,
)
console.log(
  `  3. 详细规则见 AGENTS.md 第 4 节"前端 UI 约束"`,
)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ 容器圆角守门失败 — 提交已阻止${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
