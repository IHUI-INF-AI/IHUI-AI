#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// AI 面板挂载防回潮守门(2026-09-30 立;同日架构反转随 496d7b2c31 修订)。
// 依据(2026-09-30 修订):AISidePanel 已回归静态 import(用户强制「面板 0ms 在场」,
// 推翻 09-12 的 dynamic ssr:false —— 那会让首帧永远无面板)。守门相应反转:
// 静态 import 必须在、dynamic 引入必须无;AiPanelPlaceholder(Suspense fallback)的
// 几何/aria-token 断言保留;R2 继续禁止 ai-side-panel 内部静态导入重模块(面板本体例外),
// brand-icon 仅放行 import type；inferVendor 只能来自 vendor-infer。
// 规则:R1 = 静态 import 在场 ∧ 无 dynamic(ai-side-panel) ∧ 占位几何/aria token 完整
//       (fallback 复用组件本体时由组件保证;内联形态则两处几何逐 token 比对);
//      R2 = ai-side-panel 内重模块禁静态导入。
// 用法:node scripts/check-ai-panel-mount-guards.mjs             # 全量扫描(默认 HEAD blob)
//      node scripts/check-ai-panel-mount-guards.mjs --staged    # 仅审目标文件的 git 索引 blob
//      node scripts/check-ai-panel-mount-guards.mjs --worktree  # 审工作树(人工排查)
//      node scripts/check-ai-panel-mount-guards.mjs --root <dir> | --root=<dir>
//                                                               # 显式注入根目录
//      node scripts/check-ai-panel-mount-guards.mjs --self-test # 临时夹具 + --root 正反成对自检
// 退出码:0 通过 / 1 发现违规 / 2 无法判定或脚本自身异常。
// 紧急跳过:HUSKY_SKIP_AI_PANEL_MOUNT_GUARDS=1 git commit ...

import {
  existsSync,
  mkdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { COLORS, createLogger } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import {
  FACE_LABEL,
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..')
const SELF = path.join(SCRIPT_DIR, 'check-ai-panel-mount-guards.mjs')
const SKIP_ENV_NAME = 'HUSKY_SKIP_AI_PANEL_MOUNT_GUARDS'
const GLOBAL_SHELL = 'apps/web/src/components/layout/GlobalShell.tsx'
const AI_SIDE_PANEL = 'apps/web/src/components/ai/ai-side-panel.tsx'
const TARGET_FILES = [GLOBAL_SHELL, AI_SIDE_PANEL]

const REQUIRED_PLACEHOLDER_CLASSES = [
  'hidden',
  'min-[768px]:block',
  'shrink-0',
  'mr-1.5',
  'py-2',
  'h-full',
  'relative',
]

const HEAVY_MODULES = [
  '@/components/ai/brand-icon',
  '@/components/ai/agent-task-progress-pane',
  '@/components/ai/environment-info-popover',
  '@/components/ai/ai-side-panel-tools',
  '@/components/ai/ai-terminal-dock',
  '@/components/workspace/workspace-permission-dialog',
  '@/components/chat/question-dialog',
  '@/components/chat/compaction-status-bar',
]
const HEAVY_MODULE_SET = new Set(HEAVY_MODULES)
const BRAND_ICON_MODULE = '@/components/ai/brand-icon'
const VENDOR_INFER_MODULE = '@/components/ai/vendor-infer'

const log = createLogger()
const paint = (color, text) => `${color}${text}${COLORS.reset}`
const lineOf = (source, index) => source.slice(0, Math.max(0, index)).split('\n').length
const normalizeRel = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '')

function isTargetPath(rel) {
  const normalized = normalizeRel(rel)
  if (normalized.split('/').some((part) => isExcludedDirName(part))) return false
  return TARGET_FILES.includes(normalized)
}

function parseArgs(argv) {
  let root = SCRIPT_REPO_ROOT
  let explicitRoot = false
  let staged = false
  let worktree = false
  let selfTest = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--staged') staged = true
    else if (arg === '--worktree') worktree = true
    else if (arg === '--self-test') selfTest = true
    else if (arg === '--root') {
      const value = argv[++i]
      if (!value || value.startsWith('--')) return { error: '--root 缺少目录参数' }
      root = path.resolve(value)
      explicitRoot = true
    } else if (arg.startsWith('--root=')) {
      const value = arg.slice('--root='.length)
      if (!value.trim()) return { error: '--root= 缺少目录值' }
      root = path.resolve(value)
      explicitRoot = true
    } else return { error: `未知参数:${arg}` }
  }

  if (selfTest && (staged || worktree || explicitRoot)) {
    return { error: '--self-test 必须单独使用(夹具根由自检内部经 --root 注入)' }
  }
  const selected = selectFace({ staged, worktree, def: 'head' })
  if (selected.error) return { error: selected.error }
  return { root, face: selected.face, selfTest }
}

function ensureDirectory(root) {
  try {
    if (statSync(root).isDirectory()) return
  } catch {
    // 统一落到下方无法判定。
  }
  throw new Undetermined(`扫描根不存在或不是目录:${root}`)
}

function stagedTargets(root) {
  const listed = gitRaw(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    root,
    { timeout: 30_000 },
  )
  return [...new Set(listed.split(/\r?\n/).map(normalizeRel).filter(isTargetPath))]
}

function readTargets(root, face) {
  ensureDirectory(root)
  if (face !== 'worktree') assertRepoRoot(root, 'AI 面板挂载守门')
  const candidates = face === 'staged' ? stagedTargets(root) : [...TARGET_FILES]
  if (candidates.length === 0) {
    throw new Undetermined(
      `${FACE_LABEL[face] ?? face} 的候选目标文件为 0；没有实际读取输入,不得记为通过`,
    )
  }

  const texts = new Map()
  if (face === 'worktree') {
    for (const rel of candidates) texts.set(rel, readWorktreeFile(root, rel))
  } else {
    const specs = candidates.map((rel) => `${face === 'head' ? 'HEAD' : ''}:${rel}`)
    const blobs = catBatch(root, specs)
    candidates.forEach((rel, index) => texts.set(rel, blobs.get(specs[index])))
  }

  for (const rel of candidates) {
    if (texts.get(rel) === null || texts.get(rel) === undefined) {
      throw new Undetermined(`${FACE_LABEL[face] ?? face} 取不到目标文件 ${rel}`)
    }
  }
  return { candidates, texts }
}

/** 遮掉注释但保留字符串与位置,避免注释里的 import / JSX 被当成代码。 */
function maskComments(source) {
  const out = source.split('')
  let state = 'code'
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    const next = source[i + 1]
    if (state === 'code') {
      if (c === '/' && next === '/') {
        out[i] = out[i + 1] = ' '
        i++
        state = 'line'
      } else if (c === '/' && next === '*') {
        out[i] = out[i + 1] = ' '
        i++
        state = 'block'
      } else if (c === "'") state = 'single'
      else if (c === '"') state = 'double'
      else if (c === '`') state = 'template'
      continue
    }
    if (state === 'line') {
      if (c === '\n') state = 'code'
      else out[i] = ' '
      continue
    }
    if (state === 'block') {
      if (c === '*' && next === '/') {
        out[i] = out[i + 1] = ' '
        i++
        state = 'code'
      } else if (c !== '\n') out[i] = ' '
      continue
    }
    if (c === '\\') {
      i++
      continue
    }
    const closer = state === 'single' ? "'" : state === 'double' ? '"' : '`'
    if (c === closer) state = 'code'
  }
  return out.join('')
}

function findOpeningElement(masked, from, before = masked.length) {
  const re = /<([a-z][A-Za-z0-9_.-]*)\b/g
  re.lastIndex = Math.max(0, from)
  const match = re.exec(masked)
  if (!match || match.index >= before) return null
  return { tagName: match[1], index: match.index }
}

function extractOpeningTag(source, start, tagName) {
  let quote = null
  let braces = 0
  for (let i = start + tagName.length + 1; i < source.length; i++) {
    const c = source[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if (c === '{') braces++
    else if (c === '}') braces--
    else if (c === '>' && braces === 0) return source.slice(start, i + 1)
  }
  return null
}

function classTokensOf(tag) {
  const match = /\bclassName\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|\{\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|`([\s\S]*?)`)\s*\})/.exec(
    tag,
  )
  const value = match && match.slice(1).find((part) => part !== undefined)
  return value ? value.split(/\s+/).filter(Boolean) : []
}

const GEOMETRY_GROUPS = [
  ['position', /^(?:relative|absolute|fixed|sticky|inset(?:-[xytrbl])?-.+|top-.+|right-.+|bottom-.+|left-.+)$/],
  ['display', /^(?:(?:min|max)-\[[^\]]+\]:)?(?:hidden|block|inline-block|flex|grid)$/],
  ['size', /^(?:h|w|min-h|max-h|min-w|max-w)-.+$/],
  ['flex', /^(?:shrink|grow)(?:-.+)?$/],
  ['spacing', /^(?:m|p)(?:[trblxy])?-.+$/],
]

function geometrySignature(classes) {
  const tokens = []
  for (const token of classes) {
    const group = GEOMETRY_GROUPS.find(([, re]) => re.test(token))
    if (group) tokens.push(`${group[0]}:${token}`)
  }
  return tokens.sort()
}

function hasAriaHidden(tag) {
  return /\baria-hidden\b(?!\s*=)/.test(tag) ||
    /\baria-hidden\s*=\s*(?:\{\s*true\s*\}|["']true["'])/.test(tag)
}

function analyzePlaceholder(source, found, label) {
  if (!found) {
    return {
      label,
      line: 1,
      classes: [],
      geometry: [],
      violations: [`找不到 ${label} 的占位 DOM`],
    }
  }
  const tag = extractOpeningTag(source, found.index, found.tagName)
  if (!tag) {
    return {
      label,
      line: lineOf(source, found.index),
      classes: [],
      geometry: [],
      violations: [`${label} 的占位 DOM 开标签无法配平`],
    }
  }
  const classes = classTokensOf(tag)
  const violations = []
  if (!hasAriaHidden(tag)) violations.push('缺 aria-hidden')
  if (!/\bwidth\s*:/.test(tag) || !/--ai-panel-width\b/.test(tag)) {
    violations.push("缺 width: 'var(--ai-panel-width, 380px)' 或等价 --ai-panel-width 引用")
  }
  for (const token of REQUIRED_PLACEHOLDER_CLASSES) {
    if (!classes.includes(token)) violations.push(`缺几何 class token: ${token}`)
  }
  return {
    label,
    line: lineOf(source, found.index),
    classes,
    geometry: geometrySignature(classes),
    violations,
  }
}

function collectPlaceholderViolations(source, rel = GLOBAL_SHELL) {
  const masked = maskComments(source)
  const componentAt = masked.indexOf('const AiPanelPlaceholder')
  const component = componentAt >= 0 ? findOpeningElement(masked, componentAt) : null

  // fallback 两种形态(都合规):
  // - 旧:fallback={<div ...几何 token... />} 内联占位,fallback 与组件本体几何必须逐 token 一致
  // - 新(2026-09-30):fallback={<AiPanelPlaceholder />} 复用组件本体,几何由组件保证,
  //   只断言确实引用了组件(避免两份几何各自漂移)。GlobalShell 现采用此形态。
  // 定位包裹 <AISidePanel 的那处 React.Suspense(2026-09-30 修正):GlobalShell 里有**两处**
  // Suspense —— 第一处是 Sidebar 的(--sidebar-width / aside 占位,与 AI 面板无关),
  // 早期版本 indexOf 取第一处曾对 Sidebar 占位误报 7 条 R1。此处从 <AISidePanel 向前找
  // 最近的 <React.Suspense;找不到 AISidePanel 时(异常/夹具)回落首处,保持旧语义。
  const suspenseAt0 = masked.indexOf('<React.Suspense')
  const panelAt = masked.indexOf('<AISidePanel')
  const suspenseAt = panelAt >= 0 ? Math.max(masked.slice(0, panelAt).lastIndexOf('<React.Suspense'), 0) || suspenseAt0 : suspenseAt0
  let fallbackReuseComponent = false
  let fallback = null
  if (suspenseAt >= 0) {
    const afterSuspense = masked.slice(suspenseAt)
    const fb = /fallback=\{\s*</.exec(afterSuspense)
    if (fb) {
      const tagMatch = /<([A-Za-z][A-Za-z0-9_.]*)/.exec(afterSuspense.slice(fb.index))
      if (tagMatch && tagMatch[1] === 'AiPanelPlaceholder') {
        fallbackReuseComponent = true
      } else if (tagMatch) {
        const from = suspenseAt + fb.index + 'fallback={'.length
        fallback = findOpeningElement(masked, from, from + 400)
      }
    }
  }

  const violations = []
  const slot0 = analyzePlaceholder(source, component, 'AiPanelPlaceholder(Suspense fallback)')
  for (const message of slot0.violations) {
    violations.push({ rule: 'R1', file: rel, line: slot0.line, message: `${slot0.label}: ${message}` })
  }

  // 2026-09-30 架构修订(用户强制「面板 0ms 在场」):AISidePanel 回归静态 import,
  // dynamic({ssr:false}) 让首帧永远无面板,已被推翻。守门相应反转:
  // ① 静态 import 必须在(0ms 不变量);② dynamic 引入必须无(防回潮)。
  if (
    !/\bimport\s*\{[^}]*\bAISidePanel\s+as\s+AISidePanelImpl\b[^}]*\}\s*from\s*['"]@\/components\/ai\/ai-side-panel['"]/.test(masked)
  ) {
    violations.push({
      rule: 'R1',
      file: rel,
      line: panelAt >= 0 ? lineOf(source, panelAt) : 1,
      message:
        "AISidePanel 必须静态 import(0ms 在场不变量):import { AISidePanel as AISidePanelImpl } from '@/components/ai/ai-side-panel'",
    })
  }
  if (/dynamic\s*\(\s*\(\s*\)\s*=>\s*import\(\s*['"]@\/components\/ai\/ai-side-panel['"]/.test(masked)) {
    violations.push({
      rule: 'R1',
      file: rel,
      line: panelAt >= 0 ? lineOf(source, panelAt) : 1,
      message:
        'AISidePanel 禁止 next/dynamic 懒加载(dynamic ssr:false 让首帧无面板,2026-09-30 用户强制 0ms 在场,见 496d7b2c31)',
    })
  }

  if (fallbackReuseComponent) {
    if (!/\bfallback=\{\s*<AiPanelPlaceholder\b/.test(masked)) {
      violations.push({
        rule: 'R1',
        file: rel,
        line: lineOf(source, suspenseAt),
        message: 'React.Suspense fallback 应复用 AiPanelPlaceholder 组件(避免两份几何各自漂移)',
      })
    }
  } else {
    const slotFb = analyzePlaceholder(source, fallback, 'React.Suspense fallback')
    for (const message of slotFb.violations) {
      violations.push({ rule: 'R1', file: rel, line: slotFb.line, message: `${slotFb.label}: ${message}` })
    }
    if (component && fallback && slot0.geometry.join('\u0000') !== slotFb.geometry.join('\u0000')) {
      violations.push({
        rule: 'R1',
        file: rel,
        line: slotFb.line,
        message:
          '两处占位几何 class token 不一致(已按 position/display/size/flex/spacing 分组抽取并排序)' +
          `；dynamic=[${slot0.geometry.join(', ')}] fallback=[${slotFb.geometry.join(', ')}]`,
      })
    }
  }
  return violations
}

function normalizeModuleSpecifier(specifier) {
  const clean = specifier.replaceAll('\\', '/').replace(/[?#].*$/, '').replace(/\.[cm]?[jt]sx?$/, '')
  if (clean.startsWith('@/')) return clean.replace(/\/index$/, '')
  if (!clean.startsWith('.')) return clean
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(AI_SIDE_PANEL), clean))
  const srcPrefix = 'apps/web/src/'
  return resolved.startsWith(srcPrefix)
    ? `@/${resolved.slice(srcPrefix.length)}`.replace(/\/index$/, '')
    : resolved.replace(/\/index$/, '')
}

function staticImportsOf(source) {
  const masked = maskComments(source)
  const imports = []
  const re = /^\s*import\s+(?!\s*\()([\s\S]*?)\s+from\s*(["'])([^"'\r\n]+)\2\s*;?/gm
  for (const match of masked.matchAll(re)) {
    imports.push({
      clause: match[1].trim(),
      source: match[3],
      normalizedSource: normalizeModuleSpecifier(match[3]),
      typeOnly: /^type\b/.test(match[1].trim()),
      line: lineOf(masked, match.index),
    })
  }
  return { masked, imports }
}

function collectLazyBoundaryViolations(source, rel = AI_SIDE_PANEL) {
  const { masked, imports } = staticImportsOf(source)
  const violations = []
  for (const item of imports) {
    if (!HEAVY_MODULE_SET.has(item.normalizedSource)) continue
    if (item.normalizedSource === BRAND_ICON_MODULE && item.typeOnly) continue
    violations.push({
      rule: 'R2',
      file: rel,
      line: item.line,
      message:
        `禁止静态导入重模块 ${item.source}` +
        (item.normalizedSource === BRAND_ICON_MODULE ? '(仅 import type 可豁免)' : '') +
        '；改用 dynamic(() => import(...)) 或 React.lazy(() => import(...))',
    })
  }

  if (/\binferVendor\b/.test(masked)) {
    const owners = imports.filter((item) => /\binferVendor\b/.test(item.clause))
    const correct = owners.filter(
      (item) => item.normalizedSource === VENDOR_INFER_MODULE && !item.typeOnly,
    )
    const wrong = owners.filter(
      (item) => item.normalizedSource !== VENDOR_INFER_MODULE || item.typeOnly,
    )
    for (const item of wrong) {
      violations.push({
        rule: 'R2',
        file: rel,
        line: item.line,
        message: `inferVendor 导入来源必须是 ${VENDOR_INFER_MODULE},当前为 ${item.source}`,
      })
    }
    if (correct.length === 0 && wrong.length === 0) {
      const at = masked.search(/\binferVendor\b/)
      violations.push({
        rule: 'R2',
        file: rel,
        line: lineOf(masked, at),
        message: `出现 inferVendor 标识符,但未从 ${VENDOR_INFER_MODULE} 做运行时导入`,
      })
    }
  }
  return violations
}

function inspectTargets(candidates, texts) {
  const violations = []
  for (const rel of candidates) {
    const source = texts.get(rel)
    if (rel === GLOBAL_SHELL) violations.push(...collectPlaceholderViolations(source, rel))
    if (rel === AI_SIDE_PANEL) violations.push(...collectLazyBoundaryViolations(source, rel))
  }
  return violations
}

function report(violations, candidates, face) {
  const faceLabel = FACE_LABEL[face] ?? face
  if (violations.length === 0) {
    log.info(
      paint(
        COLORS.green,
        `[PASS] AI 面板装载守门通过(面=${faceLabel},目标文件=${candidates.length},违规=0)`,
      ),
    )
    return 0
  }

  log.error(
    paint(
      COLORS.red,
      `[FAIL] AI 面板装载守门发现 ${violations.length} 处违规(面=${faceLabel},目标文件=${candidates.length})`,
    ),
  )
  for (const item of violations) {
    log.error(`  ${item.rule} ${item.file}:${item.line}  ${item.message}`)
  }
  log.error('\n修复方法:')
  log.error('  1. AISidePanel 必须静态 import(0ms 在场不变量,2026-09-30 立):')
  log.error("     import { AISidePanel as AISidePanelImpl } from '@/components/ai/ai-side-panel'")
  log.error('     禁止 next/dynamic 懒加载 —— ssr:false 会让首帧永远无面板。')
  log.error('  2. AiPanelPlaceholder 保持 aria-hidden、--ai-panel-width 与完整几何 class token。')
  log.error('  3. ai-side-panel.tsx 内部的重模块仍须 dynamic/React.lazy 懒加载(仅面板本体例外)。')
  log.error(`  4. inferVendor 只从 ${VENDOR_INFER_MODULE} 导入；brand-icon 仅允许 import type。`)
  log.error(`  5. 仅紧急情况可设 ${SKIP_ENV_NAME}=1，并在提交说明中记录原因。`)
  return 1
}

function runCheck({ root, face }) {
  const { candidates, texts } = readTargets(root, face)
  return { candidates, violations: inspectTargets(candidates, texts) }
}

const PLACEHOLDER_CLASSES =
  'relative hidden h-full shrink-0 mr-1.5 py-2 min-[768px]:block'
// 2026-09-30 架构修订:GOOD 夹具镜像真实 GlobalShell —— AISidePanel 静态 import
// (0ms 在场不变量)+ Suspense fallback 复用 AiPanelPlaceholder 组件本体。
const GOOD_GLOBAL_SHELL = `
const AiPanelPlaceholder = () => (
  <div
    aria-hidden
    className="${PLACEHOLDER_CLASSES}"
    style={{ width: 'var(--ai-panel-width, 480px)' }}
  />
)
import { AISidePanel as AISidePanelImpl } from '@/components/ai/ai-side-panel'
const AISidePanel = React.memo(AISidePanelImpl)
export function GlobalShell() {
  return (
    <React.Suspense fallback={<AiPanelPlaceholder />}>
      <AISidePanel />
    </React.Suspense>
  )
}
`
const GOOD_AI_SIDE_PANEL = `
import * as React from 'react'
import dynamic from 'next/dynamic'
import type { BrandIconProps } from '@/components/ai/brand-icon'
import { inferVendor } from '@/components/ai/vendor-infer'
${HEAVY_MODULES.map(
  (moduleName, index) =>
    index === HEAVY_MODULES.length - 1
      ? `const Lazy${index} = React.lazy(() => import('${moduleName}'))`
      : `const Lazy${index} = dynamic(() => import('${moduleName}'))`,
).join('\n')}
export const probe: BrandIconProps | null = null
export const vendor = inferVendor('model')
`

function replaceOnce(source, before, after) {
  if (!source.includes(before)) throw new Error(`self-test 变异锚点不存在:${before}`)
  return source.replace(before, after)
}

function mutateFirstClassToken(source, token) {
  const next = PLACEHOLDER_CLASSES.split(' ').filter((part) => part !== token).join(' ')
  return replaceOnce(source, `className="${PLACEHOLDER_CLASSES}"`, `className="${next}"`)
}

function writeFixture(root, globalSource, aiSource) {
  for (const [rel, source] of [
    [GLOBAL_SHELL, globalSource],
    [AI_SIDE_PANEL, aiSource],
  ]) {
    const file = path.join(root, rel)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, source, 'utf8')
  }
}

/**
 * WorkBuddy 的删除保护按递归目录展开量计数；已知夹具树虽仅两文件,深目录会触及批量阈值。
 * 逐个删除本测试自己创建的已知文件/空目录,再交 rmScratch 注销登记,不扩大删除面。
 */
function removeKnownFixture(root) {
  for (const rel of [GLOBAL_SHELL, AI_SIDE_PANEL]) {
    const file = path.join(root, 'fixture', rel)
    if (existsSync(file)) unlinkSync(file)
  }
  const dirs = [
    'fixture/apps/web/src/components/layout',
    'fixture/apps/web/src/components/ai',
    'fixture/apps/web/src/components',
    'fixture/apps/web/src',
    'fixture/apps/web',
    'fixture/apps',
    'fixture',
    'empty',
  ]
  for (const rel of dirs) {
    const dir = path.join(root, rel)
    if (existsSync(dir)) rmdirSync(dir)
  }
  if (existsSync(root)) rmdirSync(root)
  rmScratch(root, { skipNestedScan: true })
}

function runSelfTest() {
  const root = mkScratch('ai-panel-mount-guards-')
  const results = []
  const check = (name, condition, detail = '') =>
    results.push({ name, ok: Boolean(condition), detail })
  const evaluateArgs = (args) => {
    const parsed = parseArgs(args)
    if (parsed.error) return { status: 2, stdout: '', stderr: parsed.error }
    try {
      const result = runCheck(parsed)
      return result.violations.length === 0
        ? { status: 0, stdout: '守门通过', stderr: '' }
        : { status: 1, stdout: '', stderr: `[FAIL] ${result.violations.map((v) => v.message).join('\n')}` }
    } catch (error) {
      return {
        status: 2,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      }
    }
  }
  const runCli = (fixtureRoot, extra = []) =>
    evaluateArgs(['--worktree', '--root', fixtureRoot, ...extra])

  const r1Cases = [
    [
      // 0ms 不变量①:把 memo 换回 dynamic 懒加载 ⇒ 必红(dynamic 检测命中)
      '回归 dynamic 懒加载(0ms 反保证)',
      (src) =>
        replaceOnce(
          src,
          'const AISidePanel = React.memo(AISidePanelImpl)',
          "const AISidePanel = dynamic(() => import('@/components/ai/ai-side-panel'), {\n  ssr: false,\n})",
        ),
    ],
    [
      // 0ms 不变量②:静态 import 整体丢失 ⇒ 必红
      '静态 import 被移除',
      (src) =>
        replaceOnce(
          src,
          "import { AISidePanel as AISidePanelImpl } from '@/components/ai/ai-side-panel'",
          '',
        ),
    ],
    [
      // fallback 拆成内联占位且几何漂移(多 token)⇒ 内联路径几何比对必红
      'fallback 内联化且几何漂移',
      (src) =>
        replaceOnce(
          src,
          'fallback={<AiPanelPlaceholder />}',
          `fallback={<div aria-hidden className="${PLACEHOLDER_CLASSES} left-0" style={{ width: 'var(--ai-panel-width, 480px)' }} />}`,
        ),
    ],
    ['aria-hidden', (src) => replaceOnce(src, '    aria-hidden\n', '    data-placeholder\n')],
    ['--ai-panel-width', (src) => replaceOnce(src, '--ai-panel-width', '--wrong-panel-width')],
    ...REQUIRED_PLACEHOLDER_CLASSES.map((token) => [token, (src) => mutateFirstClassToken(src, token)]),
  ]
  const relativeSources = [
    './brand-icon',
    './agent-task-progress-pane',
    './environment-info-popover',
    './ai-side-panel-tools',
    './ai-terminal-dock',
    '../workspace/workspace-permission-dialog',
    '../chat/question-dialog',
    '../chat/compaction-status-bar',
  ]
  const r2Cases = HEAVY_MODULES.map((moduleName, index) => [
    `静态导入 ${moduleName}`,
    (src) => `import { Heavy${index} } from '${relativeSources[index]}'\n${src}`,
  ])
  r2Cases.push([
    'inferVendor 从 brand-icon 导入',
    (src) =>
      replaceOnce(
        src,
        `import { inferVendor } from '${VENDOR_INFER_MODULE}'`,
        `import { inferVendor } from '${BRAND_ICON_MODULE}'`,
      ),
  ])
  const cases = [...r1Cases, ...r2Cases]
  const fixtureRoot = path.join(root, 'fixture')

  try {
    writeFixture(fixtureRoot, GOOD_GLOBAL_SHELL, GOOD_AI_SIDE_PANEL)
    const fixtureGreen = runCli(fixtureRoot)
    check(
      'CLI --root --worktree 合规夹具必须绿(证明未扫描真仓)',
      fixtureGreen.status === 0 && fixtureGreen.stdout.includes('守门通过'),
      fixtureGreen.stdout + fixtureGreen.stderr,
    )
    writeFixture(
      fixtureRoot,
      replaceOnce(GOOD_GLOBAL_SHELL, '    aria-hidden\n', '    data-placeholder\n'),
      GOOD_AI_SIDE_PANEL,
    )
    const fixtureRed = runCli(fixtureRoot)
    check(
      'CLI --root --worktree 违规夹具必须红(证明真实读取夹具内容)',
      fixtureRed.status === 1 && fixtureRed.stderr.includes('[FAIL]'),
      fixtureRed.stdout + fixtureRed.stderr,
    )

    cases.forEach(([name, mutate], index) => {
      const goodTexts = new Map([
        [GLOBAL_SHELL, GOOD_GLOBAL_SHELL],
        [AI_SIDE_PANEL, GOOD_AI_SIDE_PANEL],
      ])
      const good = inspectTargets(TARGET_FILES, goodTexts)
      check(
        `${name}:同源合规输入必须绿(含 brand-icon import type 与 dynamic/lazy 正例)`,
        good.length === 0,
        good.map((v) => v.message).join('\n'),
      )

      const badTexts = new Map([
        [GLOBAL_SHELL, index < r1Cases.length ? mutate(GOOD_GLOBAL_SHELL) : GOOD_GLOBAL_SHELL],
        [AI_SIDE_PANEL, index < r1Cases.length ? GOOD_AI_SIDE_PANEL : mutate(GOOD_AI_SIDE_PANEL)],
      ])
      const bad = inspectTargets(TARGET_FILES, badTexts)
      check(
        `${name}:单点变异必须红`,
        bad.length > 0,
        bad.map((v) => v.message).join('\n'),
      )
    })

    const conflict = evaluateArgs(['--staged', '--worktree'])
    check('--staged 与 --worktree 同给必须 exit 2', conflict.status === 2, conflict.stdout + conflict.stderr)

    const empty = path.join(root, 'empty')
    mkdirSync(empty, { recursive: true })
    const noTargets = runCli(empty)
    check('目标文件全缺失必须 exit 2,不得把 0 候选记绿', noTargets.status === 2, noTargets.stdout + noTargets.stderr)
  } finally {
    try {
      removeKnownFixture(root)
    } catch (error) {
      log.warn(
        paint(
          COLORS.yellow,
          `[WARN] self-test 临时夹具清理被宿主保护拦截:${error instanceof Error ? error.message : String(error)}`,
        ),
      )
    }
  }

  const failed = results.filter((item) => !item.ok)
  for (const item of failed) {
    log.error(paint(COLORS.red, `[FAIL] ${item.name}`))
    if (item.detail) log.error(item.detail.trim())
  }
  const paired = cases.length
  const summary = failed.length
    ? `[FAIL] check-ai-panel-mount-guards self-test 失败 ${failed.length}/${results.length}`
    : `[PASS] check-ai-panel-mount-guards self-test 全部通过(${results.length} 例；${paired} 组正反成对；临时夹具经 --root --worktree 注入,未扫描真仓)`
  ;(failed.length ? log.error : log.info)(
    paint(failed.length ? COLORS.red : COLORS.green, summary),
  )
  return failed.length ? 1 : 0
}

function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    log.error(paint(COLORS.red, `[UNDETERMINED] ${parsed.error}`))
    return 2
  }
  if (parsed.selfTest) return runSelfTest()
  if (process.env[SKIP_ENV_NAME] === '1') {
    log.warn(paint(COLORS.yellow, `[SKIP] ${SKIP_ENV_NAME}=1，已跳过 AI 面板装载守门`))
    return 0
  }
  try {
    const result = runCheck(parsed)
    return report(result.violations, result.candidates, parsed.face)
  } catch (error) {
    if (error instanceof Undetermined) {
      log.error(paint(COLORS.red, `[UNDETERMINED] ${error.message}`))
      return 2
    }
    log.error(
      paint(
        COLORS.red,
        `[UNDETERMINED] 脚本自身异常:${error instanceof Error ? error.stack : String(error)}`,
      ),
    )
    return 2
  }
}

const directPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
const modulePath = path.resolve(fileURLToPath(import.meta.url))
const isDirectRun =
  directPath !== '' &&
  (process.platform === 'win32'
    ? directPath.toLowerCase() === modulePath.toLowerCase()
    : directPath === modulePath)
if (isDirectRun) {
  const code = main()
  if (code !== 0) process.exit(code)
}

export const __test__ = {
  AI_SIDE_PANEL,
  GLOBAL_SHELL,
  HEAVY_MODULES,
  REQUIRED_PLACEHOLDER_CLASSES,
  SELF,
  SCRIPT_REPO_ROOT,
  SKIP_ENV_NAME,
  collectLazyBoundaryViolations,
  collectPlaceholderViolations,
  geometrySignature,
  maskComments,
  main,
  normalizeModuleSpecifier,
  parseArgs,
  runCheck,
  runSelfTest,
  staticImportsOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
