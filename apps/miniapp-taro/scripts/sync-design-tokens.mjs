// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-design-tokens.mjs — 从 packages/design-tokens/src/styles/tokens.css 自动同步 token 到 miniapp-taro。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const TOKENS_SOURCE = resolve(ROOT, '../../packages/design-tokens/src/styles/tokens.css')
const BASE_CSS_SOURCE = resolve(ROOT, '../../packages/design-tokens/src/styles/base.css')
const APP_CSS_TARGET = resolve(ROOT, 'src/app.css')
const STYLE_TS_TARGET = resolve(ROOT, 'src/constants/style.ts')
// COLORS 字段 → tokens.css 变量名映射表
// style.ts 的 COLORS 常量从 tokens.css 自动生成,消除手动复制漂移
const COLORS_MAPPING = {
  primary: '--color-primary',
  primaryForeground: '--color-primary-foreground',
  secondary: '--color-secondary',
  secondaryForeground: '--color-secondary-foreground',
  accent: '--color-accent',
  accentForeground: '--color-accent-foreground',
  success: '--color-success',
  successForeground: '--color-success-foreground',
  warning: '--color-warning',
  warningForeground: '--color-warning-foreground',
  // 2026-09-06:danger 从 destructive 改指新语义 token --color-danger(收敛小程序端红色家族)
  danger: '--color-danger',
  dangerForeground: '--color-danger-foreground',
  info: '--color-info',
  infoForeground: '--color-info-foreground',
  textPrimary: '--color-foreground',
  textSecondary: '--color-muted-foreground',
  textTertiary: '--color-muted-foreground',
  bgPrimary: '--color-background',
  bgSecondary: '--color-card',
  bgTertiary: '--color-muted',
  border: '--color-border',
  divider: '--color-border',
}

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const isHelp = args.includes('--help')

if (isHelp) {
  console.info(`sync-design-tokens.mjs — 同步 design-tokens 到 miniapp-taro app.css + style.ts

用法:
  node scripts/sync-design-tokens.mjs          同步并写回 app.css + style.ts
  node scripts/sync-design-tokens.mjs --check   仅校验,不写回
  node scripts/sync-design-tokens.mjs --help    帮助

源: ${TOKENS_SOURCE.replace(ROOT, '.')}
目标:
  - ${APP_CSS_TARGET.replace(ROOT, '.')}
  - ${STYLE_TS_TARGET.replace(ROOT, '.')}
`)
  process.exit(0)
}
/**
 * 从 tokens.css 提取 @theme 块内的变量声明。
 * @theme 块格式:@theme { ... --color-xxx: hsl(...); ... }
 * 返回:["--color-xxx: hsl(...);", ...]
 */
function extractThemeBlock(content) {
  const themeMatch = content.match(/@theme\s*\{([\s\S]*?)\}/)
  if (!themeMatch) return []
  return themeMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('--') && l.includes(':'))
}

/**
 * 从 tokens.css 提取 .dark 块内的变量声明。
 * 返回:["--color-xxx: hsl(...);", ...]
 */
function extractDarkBlock(content) {
  const darkMatch = content.match(/\.dark\s*\{([\s\S]*?)\}/)
  if (!darkMatch) return []
  return darkMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('--') && l.includes(':'))
}

/**
 * 从 tokens.css 提取透明度色板(--color-black-* / --color-white-*)。
 * 这两组定义在 tokens.css 独立的非 @theme :root 块(非 .dark、非 @theme),extractThemeBlock
 * 不会提取到它们,导致 miniapp-taro 端 var(--color-black-*) / var(--color-white-*) 运行时未定义
 * → 遮罩/阴影透明。2026-09-06 立:改为显式收集,同步进 app.css。
 * 返回:["--color-white-2: rgba(...);", "--color-black-6: rgba(...);", ...](按出现顺序)
 */
function extractOpacityPalette(content) {
  const rootRe = /:root\s*\{([^{}]*)\}/g
  const lines = []
  let m
  while ((m = rootRe.exec(content)) !== null) {
    for (const raw of m[1].split('\n')) {
      const l = raw.trim()
      if ((l.startsWith('--color-white-') || l.startsWith('--color-black-')) && l.includes(':')) {
        lines.push(l)
      }
    }
  }
  return lines.filter((l, i) => lines.indexOf(l) === i)
}

/**
 * 从 tokens.css 提取「独立 :root 块」中的业务品牌变量(--color-miniapp-green* 等。
 * 这些变量定义在非 @theme、非 .dark 的 :root 块,extractThemeBlock / extractDarkBlock
 * 不会提取到,导致小程序端 var(--color-miniapp-green) 运行时未定义 → 微信按钮底色丢失。
 * 过滤:剔除已在 @theme/.dark 中的变量与透明度色板(--color-white / --color-black 系列),
 * 并用 filterTokens 剔除 web 独有变量。返回:["--color-x: val;", ...](按出现顺序)。
 */
function extractStandaloneRootBlock(content, themeMap, darkMap) {
  const rootRe = /:root\s*\{([^{}]*)\}/g
  const lines = []
  let m
  while ((m = rootRe.exec(content)) !== null) {
    for (const raw of m[1].split('\n')) {
      const l = raw.trim()
      const name = l.split(':')[0].trim()
      // 仅收集「单行完整声明的 --color-* 业务品牌色」:
      //  - 以 --color- 开头(web 独有 --global- / --ease- / --sidebar- / --el- 等不收集)
      //  - 行尾以 ; 结束(剔除以 linear-gradient( 开头的多行渐变,避免截断产生非法 CSS)
      //  - 跳过透明度色板与已存在于 @theme/.dark 语义色块的变量,避免重复
      if (!name.startsWith('--color-')) continue
      if (name.startsWith('--color-gradient-')) continue
      if (!l.endsWith(';')) continue
      if (name.startsWith('--color-white-') || name.startsWith('--color-black-')) continue
      if (themeMap.has(name) || darkMap.has(name)) continue
      lines.push(l)
    }
  }
  return filterTokens(lines.filter((l, i) => lines.indexOf(l) === i))
}

/**
 * 生成业务品牌色 CSS 块(:root 包裹,挂到透明度色板之后)。无匹配时返回空串。
 */
function buildBusinessBrandBlock(lines) {
  if (lines.length === 0) return ''
  const inner = formatBlock(lines, '  ')
  return (
    '/* ===== 业务品牌色(自动同步自 tokens.css 独立 :root 块,勿手动编辑)===== */\n' +
    ':root {\n' +
    inner +
    '\n}\n'
  )
}

/**
 * 移除 app.css 中已存在的业务品牌色块(防止重复插入)。
 */
function stripExistingBusinessBrandBlock(css) {
  const re = /\/\* ===== 业务品牌色[^\n]*\*\/\s*\n:root \{\n[\s\S]*?\n\}\n+/g
  return css.replace(re, '\n')
}

/**
 * 生成透明度色板 CSS 块(:root 包裹,挂到 app.css 语义色 :root 后)。无匹配时返回空串。
 */
function buildOpacityBlock(lines) {
  if (lines.length === 0) return ''
  const inner = formatBlock(lines, '  ')
  return (
    '/* ===== 透明度色板(自动同步自 tokens.css 独立 :root 块,勿手动编辑)===== */\n' +
    ':root {\n' +
    inner +
    '\n}\n'
  )
}

/**
 * 移除 app.css 中已存在的透明度色板块(防止重复插入),并把语义 :root 到 .dark 之间的
 * 换行归一为「\n\n .dark」。返回:移除旧色板并保留一个换行的内容。
 * 形态:透明度色板注释 + 紧随的 :root 装饰块 + 其后若干换行。
 */
function stripExistingOpacityBlock(css) {
  const re = /\/\* ===== 透明度色板[^\n]*\*\/\s*\n:root \{\n[\s\S]*?\n\}\n+/g
  return css.replace(re, '\n')
}

/**
 * 把变量声明数组格式化为 CSS 块(带 2 空格缩进)。
 */
function formatBlock(lines, indent = '  ') {
  return lines.map((l) => `${indent}${l}`).join('\n')
}

/**
 * 提取需要同步的语义色变量(只同步 miniapp-taro 需要的,过滤掉 web 独有的)。
 *
 * 2026-08-06:移除 --color-brand-/--color-vip-/--color-rank- 三个前缀。
 * tokens.css @theme 块已定义业务品牌色(--color-vip-gold-start/end、--color-rank-gold/silver/bronze、
 * --color-brand-orange、--color-brand-50..900、--color-brand),此前被跳过导致小程序端无法 var() 引用,
 * 只能硬编码 hex。现全部同步到 app.css,页面可引用 var(--color-rank-*) / var(--color-vip-*) / var(--color-brand*)。
 *
 * --color-white-/--color-black- 前缀也一并移除:这两组透明度色板定义在 tokens.css 独立 :root 块(非 @theme),
 * extractThemeBlock 本就不会提取到它们,保留跳过项无实际作用,移除让脚本意图更清晰。
 *
 * 仍保留跳过的是 web 端独有或已在 app.css 另行管理的变量:
 *   --font-/--animate-/--breakpoint-       Tailwind v4 专用,小程序用 Tailwind v3 不识别
 *   --text-vcenter-offset                   web 端中文字体垂直对齐偏移,小程序不需要
 *   --color-sidebar 系列 / --color-shell-panel    web 侧边栏/面板布局色
 *   --z-                                    z-index 分层,小程序由 app.css 另行管理
 *   --global-box-shadow/--shadow-premium*   web 投影体系,小程序不用
 */
function filterTokens(lines) {
  const skipPrefixes = [
    '--font-',
    '--animate-',
    '--breakpoint-',
    '--text-vcenter-offset',
    '--color-sidebar',
    '--color-shell-panel',
    '--z-',
    '--global-box-shadow',
    '--shadow-premium',
  ]
  return lines.filter((l) => {
    const name = l.split(':')[0].trim()
    return !skipPrefixes.some((p) => name.startsWith(p))
  })
}
/**
 * 把变量声明数组解析为 Map<varName, value>。
 * 例:["--color-primary: hsl(0 0% 0%);"] → Map { "--color-primary" => "hsl(0 0% 0%)" }
 */
function buildVarMap(lines) {
  const map = new Map()
  for (const line of lines) {
    const m = line.match(/^(--[\w-]+):\s*(.+?);?$/)
    if (m) {
      map.set(m[1], m[2].trim())
    }
  }
  return map
}

/**
 * 生成 style.ts 中的 COLORS 常量块。
 * 从 themeMap 取 light 值,darkMap 取 dark 值,变量缺失时降级为 light 值。
 */
function generateColors(themeMap, darkMap) {
  const lines = []
  for (const [field, varName] of Object.entries(COLORS_MAPPING)) {
    const light = themeMap.get(varName)
    if (!light) {
      console.error(`[sync-design-tokens] COLORS_MAPPING 中 ${field} 引用的变量 ${varName} 在 @theme 块中未找到`)
      process.exit(1)
    }
    const dark = darkMap.get(varName) || light
    lines.push(`  ${field}: { light: '${light}', dark: '${dark}' },`)
  }
  return `export const COLORS = {\n${lines.join('\n')}\n} as const`
}
/**
 * 生成完整的 style.ts 文件内容。
 * - COLORS 从 tokens.css 自动生成
 * - 其他常量(SPACING/FONT_SIZES 等)为静态模板:tokens.css 无对应定义,保持原有数值
 */
function generateStyleTs(themeMap, darkMap) {
  const colorsBlock = generateColors(themeMap, darkMap)
  return `// AUTO-GENERATED by scripts/sync-design-tokens.mjs — do not edit manually. Source: packages/design-tokens/src/styles/tokens.css
/**
 * 小程序样式统一常量(集中管理)
 * - light:对齐 packages/design-tokens/src/styles/tokens.css @theme 块(亮色 shadcn/ui 风)
 * - dark :对齐 tokens.css .dark 块(暗色 shadcn/ui 风)
 * - 圆角梯度严格遵守 AGENTS.md §4(禁止 rounded-full / 9999px / 50%)
 *
 * 注意:色值用 hsl() 格式,与 web 端 tokens.css 完全一致(2026-07-27 重构)。
 * COLORS 由 sync-design-tokens.mjs 自动生成;其他常量为静态值(tokens.css 无对应 token)。
 */

/** 语义色板(light/dark 双主题,自动同步自 tokens.css) */
${colorsBlock}

/** 间距(px) */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

/** 字号(px) */
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const
/** 字重 */
export const FONT_WEIGHTS = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

/** 圆角(px,AGENTS.md §4 守门:禁止 rounded-full) */
export const RADII = {
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  xxl: 12,
  xxxl: 16,
} as const

/** 阴影 */
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
} as const

/** 动画时长(ms) */
export const DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const

/** z-index 层级 */
export const Z_INDEX = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
  toast: 1070,
} as const
`
}
function main() {
  if (!existsSync(TOKENS_SOURCE)) {
    console.error(`[sync-design-tokens] 源文件不存在: ${TOKENS_SOURCE}`)
    process.exit(1)
  }
  if (!existsSync(APP_CSS_TARGET)) {
    console.error(`[sync-design-tokens] 目标文件不存在: ${APP_CSS_TARGET}`)
    process.exit(1)
  }
  if (!existsSync(STYLE_TS_TARGET)) {
    console.error(`[sync-design-tokens] 目标文件不存在: ${STYLE_TS_TARGET}`)
    process.exit(1)
  }

  const tokensContent = readFileSync(TOKENS_SOURCE, 'utf8')
  const appCssContent = readFileSync(APP_CSS_TARGET, 'utf8')
  const styleTsContent = readFileSync(STYLE_TS_TARGET, 'utf8')

  const themeLinesRaw = extractThemeBlock(tokensContent)
  const darkLinesRaw = extractDarkBlock(tokensContent)

  if (themeLinesRaw.length === 0) {
    console.error('[sync-design-tokens] 未从 @theme 块提取到任何变量,请检查 tokens.css 格式')
    process.exit(1)
  }
  if (darkLinesRaw.length === 0) {
    console.error('[sync-design-tokens] 未从 .dark 块提取到任何变量,请检查 tokens.css 格式')
    process.exit(1)
  }

  // 用于去重与 style.ts 生成(提前构建,供业务品牌色去重判断)
  const themeMap = buildVarMap(themeLinesRaw)
  const darkMap = buildVarMap(darkLinesRaw)

  // app.css 同步:用过滤后的变量(去掉 web 独有的字体/动画/断点等)
  const themeLines = filterTokens(themeLinesRaw)
  const darkLines = filterTokens(darkLinesRaw)
  const newRootBlock = `:root {
  /* ===== 语义色(自动同步自 tokens.css @theme 块,勿手动编辑)===== */
${formatBlock(themeLines, '  ')}
}`

  // 透明度色板(--color-black-* / --color-white-*):独立 :root 块,需单独收集并挂到语义 :root 后
  const opacityLines = extractOpacityPalette(tokensContent)
  const opacityBlock = buildOpacityBlock(opacityLines)

  // 业务品牌色(--color-miniapp-green* 等):独立 :root 块,单独收集并挂到透明度色板之后
  const businessLines = extractStandaloneRootBlock(tokensContent, themeMap, darkMap)
  const businessBlock = buildBusinessBrandBlock(businessLines)

  const newDarkBlock = `.dark {
${formatBlock(darkLines, '  ')}
}`

  const rootRegex = /:root\s*\{[^{}]*\}/
  const darkRegex = /\.dark\s*\{[^{}]*\}/

  // 先移除历史色板块,再替换语义 :root 与 .dark,最后在 .dark 前规范地插入色板块
  let newAppCss = stripExistingOpacityBlock(appCssContent)
  newAppCss = stripExistingBusinessBrandBlock(newAppCss)
  if (!rootRegex.test(newAppCss)) {
    console.error('[sync-design-tokens] app.css 中未找到 :root 块')
    process.exit(1)
  }
  if (!darkRegex.test(newAppCss)) {
    console.error('[sync-design-tokens] app.css 中未找到 .dark 块')
    process.exit(1)
  }

  newAppCss = newAppCss.replace(rootRegex, newRootBlock)
  newAppCss = newAppCss.replace(darkRegex, newDarkBlock)
  // 语义 :root 与 .dark 之间插入透明度色板 + 业务品牌色,空白归一为确定形态,保证幂等
  newAppCss = newAppCss.replace(/(\n+)(?=\.dark \{\n)/, '\n\n' + opacityBlock + businessBlock)

  // base.css 同步:把共享基础样式内联进 app.css(替换跨包 @import)。
  // 背景:app.css 首行 @import '../../../packages/design-tokens/src/styles/base.css' 在
  // Taro 编译时不被内联,产物 dist/app-origin.wxss 残留相对路径,微信 IDE 以 dist 为根
  // 解析失败 → [WXSS 文件编译错误] path ... not found from ./app-origin.wxss。
  const baseCssContent = readFileSync(BASE_CSS_SOURCE, 'utf8')
  const baseCssBlock = `/* ===== 共享基础样式(自动同步自 packages/design-tokens/src/styles/base.css,勿手动编辑;变更后运行 sync-design-tokens.mjs)===== */
${baseCssContent.trim()}
/* ===== 共享基础样式结束(自动生成,勿手动编辑)===== */
`
  const baseImportRegex = /@import\s+['"][^'"]*packages\/design-tokens\/src\/styles\/base\.css['"];\s*/
  const baseBlockRegex = /\/\* ===== 共享基础样式[\s\S]*?===== 共享基础样式结束\(自动生成,勿手动编辑\)===== \*\/\s*/
  if (baseImportRegex.test(newAppCss)) {
    newAppCss = newAppCss.replace(baseImportRegex, baseCssBlock)
  } else if (baseBlockRegex.test(newAppCss)) {
    newAppCss = newAppCss.replace(baseBlockRegex, baseCssBlock)
  } else {
    console.error('[sync-design-tokens] app.css 中未找到 base.css 的 @import 或同步块')
    process.exit(1)
  }

  // style.ts 同步:生成 COLORS 常量(themeMap/darkMap 已在上方构建)
  const newStyleTs = generateStyleTs(themeMap, darkMap)
  if (isCheck) {
    let drift = false
    if (newAppCss !== appCssContent) {
      console.error('[sync-design-tokens] ❌ app.css 与 tokens.css 不同步')
      drift = true
    }
    if (newStyleTs !== styleTsContent) {
      console.error('[sync-design-tokens] ❌ style.ts 与 tokens.css 不同步')
      drift = true
    }
    if (drift) {
      console.error('[sync-design-tokens] 请运行: node scripts/sync-design-tokens.mjs')
      process.exit(1)
    }
    console.info('[sync-design-tokens] ✅ app.css + style.ts 与 tokens.css 同步,无漂移')
    process.exit(0)
  }

  writeFileSync(APP_CSS_TARGET, newAppCss, 'utf8')
  writeFileSync(STYLE_TS_TARGET, newStyleTs, 'utf8')
  const themeCount = themeLines.length
  const darkCount = darkLines.length
  const colorCount = Object.keys(COLORS_MAPPING).length
  console.info(`[sync-design-tokens] ✅ 已同步 ${themeCount} 个 :root 变量 + ${darkCount} 个 .dark 变量到 app.css`)
  console.info(`[sync-design-tokens] ✅ 已同步 ${colorCount} 个 COLORS 字段(light/dark)到 style.ts`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
