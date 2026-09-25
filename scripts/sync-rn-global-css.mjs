// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-rn-global-css.mjs — 把 packages/design-tokens/src/styles/tokens.css 的设计真值**原位写回**
 * apps/mobile-rn/global.css 的 `:root` / `.dark` 块。
 *
 * 为什么必须存在(不是可有可无的便利脚本):NativeWind 4.x 只吃 Tailwind v3 语法,无法直接
 * `@import tokens.css`,所以 mobile-rn 必须持有一份 CSS 变量副本。副本漂移 = 视觉 bug。
 *
 * 2026-09-25 的两处实测结论决定了本文件的写法:
 * 1. **取值口径必须与守门 `check-rn-global-css-sync.mjs` 一致**,故两边共用
 *    `scripts/lib/design-token-blocks.mjs`。本脚本旧版用 `/@theme\s*\{([\s\S]*?)\}/` 只取**首个**
 *    非贪婪块,漏掉 tokens.css 第 326/341/407… 行的后续 `:root` 块 —— 里面正是
 *    `--color-*-rgb` 三元组(alpha 通道,守门 93 R6 要求每档必备)。实测:把它接上提交链跑一次,
 *    这 3 行被"同步"删除。
 * 2. **不得整块替换**。`.dark` 块里有 13 个 `--rn-*` 端内自有档(其注释写明"用 --rn-* 前缀避免被
 *    只校验 --color-* 的那道门拦"),整块替换一次就把它们连同 6 段解释性注释一起抹掉。
 *    这就是"RN 侧自动同步长期只拦红、不回写"的真实原因 —— 不是漏接,是旧写法接上必炸。
 *    现改为**原位写回**:同名行换值、源里新增档补到块尾、其余一个字符不动。
 *
 * 用法:
 *   node scripts/sync-rn-global-css.mjs            原位写回 global.css(幂等)
 *   node scripts/sync-rn-global-css.mjs --check    只校验不写盘(漂移则 exit 1)
 *   node scripts/sync-rn-global-css.mjs --quiet    抑制常规输出
 *   node scripts/sync-rn-global-css.mjs --self-test 判据自检(不碰真仓文件)
 *   node scripts/sync-rn-global-css.mjs --help     帮助
 *
 * 退出码:0 = 成功/一致;1 = 漂移或读写失败;2 = 无法判定(取不到源、脚本自身异常)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectVars, maskComments } from './lib/design-token-blocks.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const TOKENS_SOURCE_REL = 'packages/design-tokens/src/styles/tokens.css'
export const GLOBAL_CSS_REL = 'apps/mobile-rn/global.css'
const TOKENS_SOURCE = resolve(ROOT, TOKENS_SOURCE_REL)
const GLOBAL_CSS_TARGET = resolve(ROOT, GLOBAL_CSS_REL)

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const isHelp = args.includes('--help')
const isQuiet = args.includes('--quiet')
const isSelfTest = args.includes('--self-test')

if (isHelp) {
  console.info(
    `sync-rn-global-css.mjs — tokens.css → mobile-rn/global.css 原位写回

  node scripts/sync-rn-global-css.mjs            写回(幂等)
  node scripts/sync-rn-global-css.mjs --check    只校验
  node scripts/sync-rn-global-css.mjs --self-test 判据自检
源: ${TOKENS_SOURCE_REL}
目标: ${GLOBAL_CSS_REL}`
  )
  process.exit(0)
}

/**
 * mobile-rn(NativeWind v3)只需要同步语义色,以下各档**故意不搬**:
 * - 非颜色变量(--font-* / --animate-* / --breakpoint-* / --radius-* / --z-* / --text-vcenter-offset …)
 * - `--color-sidebar` `--color-shell-panel`(web 侧边栏独有,RN 无侧边栏)
 * - `--color-brand-*`(品牌色阶,RN 侧走 rnTokens.brand 而非 CSS 变量)
 * - `--color-vip-*` `--color-rank-*` `--color-white-*` `--color-black-*`(RN 未使用的色板)
 */
export const RN_SKIP_PREFIXES = [
  '--color-sidebar',
  '--color-shell-panel',
  '--color-brand-',
  '--color-vip-',
  '--color-rank-',
  '--color-white-',
  '--color-black-',
]

export function isManagedForRn(name) {
  return name.startsWith('--color-') && !RN_SKIP_PREFIXES.some((p) => name.startsWith(p))
}

/**
 * 从 tokens.css 取 mobile-rn 该同步的声明。
 * @param {'light'|'dark'} kind  light = `@theme` + **全部** `:root` 块合并;dark = **全部** `.dark` 块
 */
export function deriveRnDecls(tokensCss, kind) {
  const selectors = kind === 'dark' ? ['.dark'] : ['@theme', ':root']
  return [...collectVars(tokensCss, selectors).values()].filter((d) => isManagedForRn(d.name))
}

/**
 * 原位写回:同名 `--color-*` 行就地换值;源里存在而本块缺的档追加到块尾;
 * 注释、空行、非受管声明(如 `--rn-*`)一律留在原位。
 *
 * 注释状态机是必需的:块注释里会出现 `--color-x: 说明` 这种散文行(本仓 2026-09-25 已因
 * "把注释当数据"翻车两次 —— R6 的 bg-muted/40 假用量、以及本条),不剥就会当成声明去替换。
 */
export function mergeBlockBody(blockBody, decls) {
  const byName = new Map(decls.map((d) => [d.name, d.value]))
  const seen = new Set()
  const masked = maskComments(blockBody)
  const re = /--color-[\w-]+\s*:\s*[^;]+;/g
  let out = ''
  let last = 0
  for (const m of masked.matchAll(re)) {
    const nm = m[0].match(/(--color-[\w-]+)\s*:\s*([\s\S]*);$/)
    const name = nm[1]
    const value = nm[2].replace(/\s+/g, ' ').trim()
    out += blockBody.slice(last, m.index)
    const want = byName.get(name)
    if (want === undefined) {
      // 本脚本无权处置的档(端内自立的 --color-* 档):原样留下,不删也不判红
      out += blockBody.slice(m.index, m.index + m[0].length)
    } else {
      seen.add(name)
      out +=
        value === want
          ? blockBody.slice(m.index, m.index + m[0].length) // 已等价 ⇒ 保留原字节(含跨行排版)
          : `${name}: ${want};` // 缩进由前面 slice 原样带过,这里不得再补
    }
    last = m.index + m[0].length
  }
  out += blockBody.slice(last)

  const added = decls.filter((d) => !seen.has(d.name))
  if (added.length) {
    const trimmed = out.replace(/\s+$/, '')
    out = `${trimmed}\n\n  /* 以下 ${added.length} 档为 tokens.css 中存在而本文件尚缺,由 sync-rn-global-css.mjs 自动补入(勿手改) */\n${added
      .map((d) => `  ${d.name}: ${d.value};`)
      .join('\n')}\n`
  }
  return out
}

/** 替换 css 里某个顶层块(块内不得再嵌套大括号);找不到即抛,绝不静默跳过。 */
export function replaceBlock(css, selector, decls) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${esc}\\s*\\{)([^{}]*)(\\})`)
  const m = re.exec(css)
  if (!m) throw new Error(`目标 CSS 中未找到 ${selector} 块`)
  return (
    css.slice(0, m.index) +
    m[1] +
    mergeBlockBody(m[2], decls) +
    m[3] +
    css.slice(m.index + m[0].length)
  )
}

/**
 * 判据自检:全部用内存夹具,不碰真仓文件。
 * 每条都是**成对**的 —— 只证"会改"不证"不乱改"的判据等于没有(漏剥注释、抹掉端内档这两条
 * 阳性对照正是本票修掉的两个缺陷)。
 */
function selfTest() {
  const results = []
  const ok = (name, cond, extra = '') =>
    results.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` → ${extra}` : ''}`)
  const tokens = `@theme {
  /* 说明里也写着 --color-fake: 这是散文不是声明; */
  --color-bg: white;
  --color-primary-rgb: 0, 0, 0;
  --color-brand-accent: #4A7A96;
}
:root {
  --color-late-rgb: 1, 2, 3;
}
.dark {
  --color-bg: black;
}`
  const light = deriveRnDecls(tokens, 'light')
  ok('D1 后续 :root 块必须被并进来(旧版漏 → 实测删掉 alpha 三元组)', light.some((d) => d.name === '--color-late-rgb'))
  ok('D2 同族 alpha 三元组必须在(守门 93 R6 要求每档必备)', light.some((d) => d.name === '--color-primary-rgb'))
  ok('D3 brand 档按端内策略不搬', !light.some((d) => d.name.startsWith('--color-brand-')))
  const css = `:root {
  /* 语义色(手抄说明) */
  --color-bg: WRONG;
  /* RN 扩展语义色
   * 值源自 rnTokens。用 --rn-* 前缀避免被只校验 --color-* 的那道门拦。 */
  --rn-accent: #123456;
  --color-comment-bait: untouched;
}`
  const merged = replaceBlock(css, ':root', light)
  ok('P1 同名行就地换值', /--color-bg: white;/.test(merged) && !/--color-bg: WRONG/.test(merged))
  ok('P2 端内 --rn-* 档逐字保留(整块替换的必炸点)', merged.includes('--rn-accent: #123456;'))
  ok('P3 解释性注释留在原位', merged.includes('用 --rn-* 前缀避免被只校验'))
  ok('P4 注释里的 --color-x: 散文不得当声明改写(阳性对照)', merged.includes('--color-comment-bait: untouched;'))
  ok('P5 源里缺的档补到块尾且点名来源', /自动补入/.test(merged) && /--color-late-rgb: 1, 2, 3;/.test(merged))
  const again = replaceBlock(merged, ':root', light)
  ok('P6 幂等:第二次必须与第一次逐字节相同', again === merged)
  const multi = `:root {
  --color-bg: white;
  --color-gradient-purple-yellow: linear-gradient(
    112deg,
    rgba(205, 208, 255, 0.7) 0%
  );
}`
  const multiTokens = `@theme { --color-bg: white; }
:root { --color-gradient-purple-yellow: linear-gradient(112deg, rgba(205, 208, 255, 0.7) 0%); }`
  const multiDecls = deriveRnDecls(multiTokens, 'light')
  const multiMerged = replaceBlock(multi, ':root', multiDecls)
  ok(
    'P8 跨行声明不得被判成"本文件尚缺"再补一遍(实测:6 个渐变档导致幂等破功、块越写越长)',
    !/自动补入/.test(multiMerged) && replaceBlock(multiMerged, ':root', multiDecls) === multiMerged
  )
  let threw = false
  try {
    replaceBlock('.nada { --x: 1; }', ':root', light)
  } catch {
    threw = true
  }
  ok('P7 目标块不存在必须抛(不得静默当成无需同步)', threw)
  for (const r of results) console.log(r)
  const failed = results.filter((r) => r.startsWith('❌')).length
  console.log(failed ? `self-test 失败 ${failed} 条` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
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

  const lightDecls = deriveRnDecls(tokensContent, 'light')
  const darkDecls = deriveRnDecls(tokensContent, 'dark')
  if (lightDecls.length === 0 || darkDecls.length === 0) {
    console.error(
      `[sync-rn-global-css] 从 tokens.css 取到 :root ${lightDecls.length} 档 / .dark ${darkDecls.length} 档 ⇒ 无法判定`
    )
    process.exit(2)
  }

  let next = globalCssContent
  try {
    next = replaceBlock(replaceBlock(globalCssContent, ':root', lightDecls), '.dark', darkDecls)
  } catch (e) {
    console.error(`[sync-rn-global-css] ${e.message}`)
    process.exit(1)
  }

  if (next === globalCssContent) {
    if (!isQuiet)
      console.info(
        `[sync-rn-global-css] ✅ global.css 与 tokens.css 一致(${lightDecls.length} 个 :root 档 + ${darkDecls.length} 个 .dark 档)`
      )
    process.exit(0)
  }

  if (isCheck) {
    console.error(
      '[sync-rn-global-css] ❌ global.css 与 tokens.css 不同步,请运行: node scripts/sync-rn-global-css.mjs'
    )
    process.exit(1)
  }

  writeFileSync(GLOBAL_CSS_TARGET, next, 'utf8')
  console.info(
    `[sync-rn-global-css] ✅ 已原位写回 global.css(${lightDecls.length} 个 :root 档 + ${darkDecls.length} 个 .dark 档)`
  )
}

// §22d:CLI 直接执行才跑主流程;被测试 import 时不得有写盘副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    if (isSelfTest) selfTest()
    else main()
  } catch (error) {
    console.error('[sync-rn-global-css] 执行失败:', error?.message ?? error)
    process.exit(2)
  }
}

export const __test__ = {
  deriveRnDecls,
  isManagedForRn,
  mergeBlockBody,
  replaceBlock,
  RN_SKIP_PREFIXES,
  TOKENS_SOURCE_REL,
  GLOBAL_CSS_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
