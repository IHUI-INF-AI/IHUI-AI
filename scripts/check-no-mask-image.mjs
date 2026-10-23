#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 渐变遮罩守门 — 禁止 mask-image / -webkit-mask-image 渐变遮罩。
 *
 * 依据 AGENTS.md 第 4 节"禁止渐变遮罩(强制)":
 *   任何容器禁止 mask-image / -webkit-mask-image / linear-gradient 用作边缘淡出遮罩。
 *   用显式 UI 元素("查看更多"按钮 / 计数徽章 / 分页)替代。
 *
 * 检测逻辑:
 *   - 在 .ts/.tsx/.js/.jsx/.css 中查找 mask-image 字面量(kebab、camel `maskImage:`、
 *     `-webkit-` 前缀三种形态)
 *   - **只判渐变遮罩**:命中行起 3 行内出现 `gradient(` 才算 —— `url(icons/x.svg)` 是图标着色
 *     (标准技法),§4 禁的是"linear-gradient 边缘淡出"
 *   - 排除注释行(// 单行、块注释、JSX {/* 块注释),避免说明性文字误报
 *
 * 用法:
 *   node scripts/check-no-mask-image.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-no-mask-image.mjs             (全量扫描报告,判 HEAD blob,exit 0)
 *   node scripts/check-no-mask-image.mjs --worktree  (人工逃生舱:量盘上进度,不作提交门禁)
 *   node scripts/check-no-mask-image.mjs --help
 *
 * 取材面纪律(§0.4 / G-880):全量档判 **HEAD blob**、`--staged` 判**索引 blob**。
 * 此前本门两档都 `readFileSync` 磁盘:盘上改好但没提交 ⇒ 门报绿而 CI 必红(悬留替红顶绿);
 * `--staged` 的清单还带 `existsSync` 过滤 ⇒ 盘上被删的暂存文件直接消失。
 *
 * 跳过方法(紧急):HUSKY_SKIP_MASK_IMAGE=1 git commit ...
 */
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { addedLineNumbers, readSources, sourceCandidates } from './lib/face-scan.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const isStaged = argv.includes('--staged')
const isWorktree = argv.includes('--worktree')
const isHelp = argv.includes('--help') || argv.includes('-h')

// 跳过方法(紧急):HUSKY_SKIP_MASK_IMAGE=1 git commit ...
if (process.env.HUSKY_SKIP_MASK_IMAGE === '1') {
  console.log('⏭  渐变遮罩守门(HUSKY_SKIP_MASK_IMAGE=1, 跳过)')
  process.exit(0)
}

if (isHelp) {
  console.log(`
check-no-mask-image.mjs — 渐变遮罩守门(mask-image)

用法:
  node scripts/check-no-mask-image.mjs --staged   pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-mask-image.mjs             全量扫描报告(exit 0)
  node scripts/check-no-mask-image.mjs --help      显示本帮助

判定:源码中出现 mask-image / -webkit-mask-image / mask-image:(注释行豁免)即违规。
`)
  process.exit(0)
}

const SCAN_GLOBS = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.css']

/** git grep 预筛:必须是判据的**超集**(大小写两态,camel 的 `maskImage:` 也在射程内) */
const PREFILTER_RE = '[Mm]ask-?[Ii]mage'

/** 违规模式:mask-image / -webkit-mask-image,以及 React 内联样式的 camel 形态 `maskImage:`
 *  (G-880 立因:只认 kebab 时,camel 写法整片在射程外) */
const VIOLATION_RE = /mask-?image/i

/** §4 禁的是**渐变**遮罩:`mask-image: url(icons/x.svg)` 是图标着色(标准技法),不是边缘淡出。
 *  判据 = 命中行起 3 行窗口里出现 `gradient(`(值常常折到下一行)。 */
const GRADIENT_RE = /gradient\(/i

function isGradientMask(lines, idx) {
  return GRADIENT_RE.test(lines.slice(idx, idx + 3).join(' '))
}

function isExempt(line) {
  const trimmed = line.trim()
  if (/^\s*(\/\/|\/\*|\*|\{)/.test(trimmed)) return true
  const m = line.match(VIOLATION_RE)
  if (m && line.slice(0, m.index).includes('//')) return true
  return false
}

/**
 * 候选清单与内容一律走共用取材层(§0.4 同面同轮):
 * 清单面 = `git grep`(HEAD / 索引 / 工作树三面),内容面 = 与清单同一面的 blob。
 * 旧实现是"清单取索引 / 内容读磁盘",两档都会把"盘上改好没提交"读成绿(G-880 立因)。
 */
function gather(top, face) {
  const listed = sourceCandidates(top, face, {
    prefilterRe: PREFILTER_RE,
    pathspecs: SCAN_GLOBS,
    skipSegmentTest: isExcludedDirName,
  })
  const addedLines = face === 'staged' ? addedLineNumbers(top) : null
  const candidates = addedLines ? listed.filter((rel) => addedLines.has(rel)) : listed
  const { texts, skippedMissing } = readSources(top, face, candidates)
  return { texts, addedLines, skippedMissing, candidates }
}

console.log(
  `${C.cyan}${C.bold}[渐变遮罩守门] 扫描 mask-image...${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — 禁止 mask-image 渐变遮罩,改用显式 UI 元素${C.reset}`,
)
const top = assertRepoRoot(ROOT, '渐变遮罩守门')
const picked = selectFace({ staged: isStaged, worktree: isWorktree, def: 'head' })
if (picked.error) {
  console.log(`${C.red}❌ ${picked.error}${C.reset}`)
  process.exit(2)
}
const face = picked.face
console.log(
  `${C.dim}模式: ${
    face === 'staged'
      ? 'staged 判索引 blob(新增违规阻塞 commit)'
      : face === 'worktree'
        ? 'worktree 判盘上(人工逃生舱,exit 0)'
        : '全量 判 HEAD blob(warn-only, exit 0)'
  }${C.reset}`,
)
console.log('')

let gathered
try {
  gathered = gather(top, face)
} catch (e) {
  if (e instanceof Undetermined) {
    console.log(`${C.red}❌ 未判定:${e.message}${C.reset}`)
    process.exit(2)
  }
  throw e
}
const { texts, addedLines: addedLinesMap, skippedMissing } = gathered
const files = [...texts.keys()]

if (files.length === 0) {
  console.log(`${C.green}✅ ${face === 'staged' ? '暂存区' : '被审面'}无含 mask-image 的源码变更,跳过${C.reset}`)
  process.exit(0)
}
if (skippedMissing.length > 0) {
  console.log(`${C.yellow}⚠️  盘上缺文件跳过 ${skippedMissing.length} 个(并发席正在删):${skippedMissing.slice(0, 5).join(', ')}${C.reset}`)
}

let totalViolations = 0
const fileReports = []

for (const rel of files) {
  const src = texts.get(rel)
  const lines = src.split('\n')
  const findings = []

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    if (face === 'staged') {
      const allowed = addedLinesMap.get(rel)
      if (!allowed || !allowed.has(lineNumber)) return
    }
    if (isExempt(line)) return
    const m = VIOLATION_RE.exec(line)
    if (m && isGradientMask(lines, idx)) {
      findings.push({
        line: lineNumber,
        col: m.index + 1,
        snippet: line.trim().slice(0, 140),
      })
    }
  })

  if (findings.length > 0) {
    totalViolations += findings.length
    fileReports.push({ file: rel.split('\\').join('/'), findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${totalViolations} 处`)
console.log('')

if (totalViolations === 0) {
  console.log(`${C.green}${C.bold}✅ 渐变遮罩守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}[mask-image]${C.reset} ${f.snippet}`,
    )
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(`  1. 移除 mask-image / -webkit-mask-image 渐变边缘淡出`)
console.log(`  2. 改用显式 UI 元素:"查看更多"按钮 / 计数徽章 / 分页`)
console.log(`  3. 详细规则见 AGENTS.md 第 4 节"禁止渐变遮罩(强制)"`)
console.log('')

if (face === 'staged') {
  console.log(`${C.red}${C.bold}❌ 渐变遮罩守门失败 — 提交已阻止${C.reset}`)
  console.log(`${C.dim}跳过方法:HUSKY_SKIP_MASK_IMAGE=1 git commit ...${C.reset}`)
  process.exit(1)
} else {
  console.log(
    `${C.yellow}${C.bold}⚠️  ${face === 'worktree' ? '工作树档只供人工量进度(exit 0,不作提交门禁)' : '全量模式仅警告(exit 0)'}${C.reset}`,
  )
  process.exit(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
