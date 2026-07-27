/**
 * sync-design-tokens.mjs — 从 packages/design-tokens/src/styles/tokens.css 自动同步 token 到 miniapp-taro。
 *
 * 根因:Taro 4 + Tailwind v3 不兼容 v4 的 @theme 语法,无法直接 @import tokens.css。
 * 本脚本从 tokens.css 的 @theme 块和 .dark 块提取 CSS 变量,
 * 生成 miniapp-taro app.css 中的 :root 和 .dark 块,实现"一处修改,全端生效"。
 *
 * 用法:
 *   node scripts/sync-design-tokens.mjs          # 同步并写回 app.css
 *   node scripts/sync-design-tokens.mjs --check   # 仅校验,不写回(用于 CI/pre-commit)
 *   node scripts/sync-design-tokens.mjs --help    # 帮助
 *
 * 退出码:
 *   0 — 同步成功 / 校验通过
 *   1 — 校验失败(token 漂移) / 文件读写错误
 *
 * 集成位置:pre-commit hook(guardian-runner 第 31 项,2026-07-27 立)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const TOKENS_SOURCE = resolve(ROOT, '../../packages/design-tokens/src/styles/tokens.css')
const APP_CSS_TARGET = resolve(ROOT, 'src/app.css')

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const isHelp = args.includes('--help')

if (isHelp) {
  console.log(`sync-design-tokens.mjs — 同步 design-tokens 到 miniapp-taro app.css

用法:
  node scripts/sync-design-tokens.mjs          同步并写回 app.css
  node scripts/sync-design-tokens.mjs --check   仅校验,不写回
  node scripts/sync-design-tokens.mjs --help    帮助

源: ${TOKENS_SOURCE.replace(ROOT, '.')}
目标: ${APP_CSS_TARGET.replace(ROOT, '.')}
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
 * 把变量声明数组格式化为 CSS 块(带 2 空格缩进)。
 */
function formatBlock(lines, indent = '  ') {
  return lines.map((l) => `${indent}${l}`).join('\n')
}

/**
 * 提取需要同步的语义色变量(只同步 miniapp-taro 需要的,过滤掉 web 独有的)。
 * miniapp-taro 不需要:--font-sans-*, --animate-*, --breakpoint-*, --text-vcenter-offset,
 * --color-sidebar-*, --color-shell-panel, --color-brand-*, --color-vip-*, --color-rank-*,
 * --color-white-*, --color-black-*, --z-*, --global-box-shadow, --shadow-premium-*,
 * --radius-*(保留 --radius)
 */
function filterTokens(lines, isDark = false) {
  const skipPrefixes = [
    '--font-',
    '--animate-',
    '--breakpoint-',
    '--text-vcenter-offset',
    '--color-sidebar',
    '--color-shell-panel',
    '--color-brand-',
    '--color-vip-',
    '--color-rank-',
    '--color-white-',
    '--color-black-',
    '--z-',
    '--global-box-shadow',
    '--shadow-premium',
  ]
  return lines.filter((l) => {
    const name = l.split(':')[0].trim()
    // --radius 保留,--radius-* 跳过(miniapp-taro 自己定义)
    if (name === '--radius') return true
    if (name.startsWith('--radius-')) return false
    return !skipPrefixes.some((p) => name.startsWith(p))
  })
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

  const tokensContent = readFileSync(TOKENS_SOURCE, 'utf8')
  const appCssContent = readFileSync(APP_CSS_TARGET, 'utf8')

  const themeLines = filterTokens(extractThemeBlock(tokensContent), false)
  const darkLines = filterTokens(extractDarkBlock(tokensContent), true)

  if (themeLines.length === 0) {
    console.error('[sync-design-tokens] 未从 @theme 块提取到任何变量,请检查 tokens.css 格式')
    process.exit(1)
  }
  if (darkLines.length === 0) {
    console.error('[sync-design-tokens] 未从 .dark 块提取到任何变量,请检查 tokens.css 格式')
    process.exit(1)
  }

  // 生成新的 :root 和 .dark 块
  // 注意:miniapp-taro 额外保留 --radius-sm/md/lg/xl/2xl(在 tailwind.config 中引用)
  const newRootBlock = `:root {
  /* ===== 语义色(自动同步自 tokens.css @theme 块,勿手动编辑)===== */
${formatBlock(themeLines, '  ')}
  /* ===== 圆角 token(miniapp-taro 扩展,tailwind.config 引用)===== */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
}`

  const newDarkBlock = `.dark {
${formatBlock(darkLines, '  ')}
}`

  // 替换 app.css 中的 :root { ... } 和 .dark { ... } 块
  // 用更精确的正则匹配 :root 块(从 :root { 到匹配的 })
  const rootRegex = /:root\s*\{[^{}]*\}/
  const darkRegex = /\.dark\s*\{[^{}]*\}/

  let newAppCss = appCssContent
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

  if (isCheck) {
    // 校验模式:对比内容是否一致
    if (newAppCss === appCssContent) {
      console.log('[sync-design-tokens] ✅ app.css 与 tokens.css 同步,无漂移')
      process.exit(0)
    } else {
      console.error('[sync-design-tokens] ❌ app.css 与 tokens.css 不同步,请运行: node scripts/sync-design-tokens.mjs')
      process.exit(1)
    }
  }

  // 写回模式
  writeFileSync(APP_CSS_TARGET, newAppCss, 'utf8')
  const themeCount = themeLines.length
  const darkCount = darkLines.length
  console.log(`[sync-design-tokens] ✅ 已同步 ${themeCount} 个 :root 变量 + ${darkCount} 个 .dark 变量到 app.css`)
}

main()
