/**
 * sync-rn-global-css.mjs — 从 packages/design-tokens/src/styles/tokens.css 自动同步 token 到 mobile-rn/global.css。
 *
 * 根因:NativeWind 4.x 仅支持 Tailwind v3,不兼容 v4 的 @theme 语法,无法直接 @import tokens.css。
 * 本脚本从 tokens.css 的 @theme 块和 .dark 块提取 --color-* 语义色变量,
 * 生成 mobile-rn/global.css 中的 :root 和 .dark 块,实现"一处修改,全端生效"。
 *
 * 与 scripts/check-rn-global-css-sync.mjs 的关系:
 * - check 脚本只检测漂移(不修复),本脚本既能检测(--check)又能修复(默认写回)。
 * - 两者独立运行:check 输出详细差异(调试友好),sync 输出简洁提示(CI 友好)。职责分离,不互相委托。
 *
 * 用法:
 *   node scripts/sync-rn-global-css.mjs          # 同步并写回 global.css
 *   node scripts/sync-rn-global-css.mjs --check   # 仅校验,不写回(用于 CI/pre-commit)
 *   node scripts/sync-rn-global-css.mjs --help    # 帮助
 *
 * 退出码:
 *   0 — 同步成功 / 校验通过
 *   1 — 校验失败(token 漂移) / 文件读写错误
 *
 * 参考模板:apps/miniapp-taro/scripts/sync-design-tokens.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..') // scripts/ -> 仓库根目录

const TOKENS_SOURCE = resolve(ROOT, 'packages/design-tokens/src/styles/tokens.css')
const GLOBAL_CSS_TARGET = resolve(ROOT, 'apps/mobile-rn/global.css')

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const isHelp = args.includes('--help')

if (isHelp) {
  console.info(`sync-rn-global-css.mjs — 同步 design-tokens 到 mobile-rn/global.css

用法:
  node scripts/sync-rn-global-css.mjs          同步并写回 global.css
  node scripts/sync-rn-global-css.mjs --check   仅校验,不写回
  node scripts/sync-rn-global-css.mjs --help    帮助

源: ${TOKENS_SOURCE.replace(ROOT, '.')}
目标: ${GLOBAL_CSS_TARGET.replace(ROOT, '.')}
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
 * 提取 mobile-rn 需要的 --color-* 语义色变量。
 *
 * mobile-rn NativeWind v3 只需要语义色(--color-),不同步:
 * - 非颜色变量(--font, --animate, --breakpoint, --text-vcenter-offset, --z, --global-box-shadow, --shadow-premium, --radius 等)
 * - --color-sidebar, --color-shell-panel(web 侧边栏独有,RN 无侧边栏)
 * - --color-brand(品牌色阶,RN 用 rnTokens.brand 而非 CSS 变量)
 * - --color-vip, --color-rank(业务色阶,RN 未使用)
 * - --color-white, --color-black(透明度色板,RN 未使用)
 */
function filterTokens(lines) {
  const skipPrefixes = [
    '--color-sidebar',
    '--color-shell-panel',
    '--color-brand-',
    '--color-vip-',
    '--color-rank-',
    '--color-white-',
    '--color-black-',
  ]
  return lines.filter((l) => {
    const name = l.split(':')[0].trim()
    // 只同步 --color-* 语义色(自动排除 --font-*/--radius/--animate-*/--breakpoint-*/--z-*/--text-vcenter-offset 等非颜色变量)
    if (!name.startsWith('--color-')) return false
    return !skipPrefixes.some((p) => name.startsWith(p))
  })
}

function main() {
  if (!existsSync(TOKENS_SOURCE)) {
    console.error(`[sync-rn-global-css] 源文件不存在: ${TOKENS_SOURCE}`)
    process.exit(1)
  }
  if (!existsSync(GLOBAL_CSS_TARGET)) {
    console.error(`[sync-rn-global-css] 目标文件不存在: ${GLOBAL_CSS_TARGET}`)
    process.exit(1)
  }

  const tokensContent = readFileSync(TOKENS_SOURCE, 'utf8')
  const globalCssContent = readFileSync(GLOBAL_CSS_TARGET, 'utf8')

  const themeLines = filterTokens(extractThemeBlock(tokensContent))
  const darkLines = filterTokens(extractDarkBlock(tokensContent))

  if (themeLines.length === 0) {
    console.error('[sync-rn-global-css] 未从 @theme 块提取到任何 --color-* 变量,请检查 tokens.css 格式')
    process.exit(1)
  }
  if (darkLines.length === 0) {
    console.error('[sync-rn-global-css] 未从 .dark 块提取到任何 --color-* 变量,请检查 tokens.css 格式')
    process.exit(1)
  }

  // 生成新的 :root 和 .dark 块(保留 NativeWind 特有的 @tailwind 指令和头部注释,只替换 :root/.dark 块)
  const newRootBlock = `:root {
  /* 语义色(自动同步自 tokens.css @theme 块,勿手动编辑) */
${formatBlock(themeLines, '  ')}
}`

  const newDarkBlock = `.dark {
  /* 暗色模式(自动同步自 tokens.css .dark 块,勿手动编辑) */
${formatBlock(darkLines, '  ')}
}`

  // 替换 global.css 中的 :root { ... } 和 .dark { ... } 块
  // :root/.dark 块内只有 CSS 变量声明(无嵌套大括号),用 [^{}]* 匹配块内内容
  const rootRegex = /:root\s*\{[^{}]*\}/
  const darkRegex = /\.dark\s*\{[^{}]*\}/

  let newGlobalCss = globalCssContent
  if (!rootRegex.test(newGlobalCss)) {
    console.error('[sync-rn-global-css] global.css 中未找到 :root 块')
    process.exit(1)
  }
  if (!darkRegex.test(newGlobalCss)) {
    console.error('[sync-rn-global-css] global.css 中未找到 .dark 块')
    process.exit(1)
  }

  // 注意:test 会更新 lastIndex,用新字符串替换需重新匹配
  newGlobalCss = newGlobalCss.replace(rootRegex, newRootBlock)
  newGlobalCss = newGlobalCss.replace(darkRegex, newDarkBlock)

  if (isCheck) {
    // 校验模式:对比内容是否一致
    if (newGlobalCss === globalCssContent) {
      console.info(`[sync-rn-global-css] ✅ global.css 与 tokens.css 同步,无漂移(${themeLines.length} 个 :root 变量 + ${darkLines.length} 个 .dark 变量)`)
      process.exit(0)
    } else {
      console.error('[sync-rn-global-css] ❌ global.css 与 tokens.css 不同步,请运行: node scripts/sync-rn-global-css.mjs')
      process.exit(1)
    }
  }

  // 写回模式
  writeFileSync(GLOBAL_CSS_TARGET, newGlobalCss, 'utf8')
  console.info(`[sync-rn-global-css] ✅ 已同步 ${themeLines.length} 个 :root 变量 + ${darkLines.length} 个 .dark 变量到 global.css`)
}

main()
