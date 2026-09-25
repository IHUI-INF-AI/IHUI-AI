#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-web-tokens-import.mjs - Guard: verify apps/web/app/globals.css
 * @imports design-tokens from packages/design-tokens/src/styles/tokens.css
 * and base.css.
 *
 * apps/web uses Tailwind v4 + CSS-based config and @import tokens.css /
 * base.css directly (no manual :root/.dark hand-copy like miniapp-taro).
 * The 50+ CSS variables flow through one @import line - any accidental
 * removal causes silent visual drift (light/dark mode breakage).
 *
 * This script enforces the @import is present in globals.css and points
 * to the canonical design-tokens package.
 *
 * ⚠️ 处置结论(2026-09-25 审计):**判为冗余 —— 未接线,本文件当前无任何调度器执行,勿再接线。**
 *   1. 第 1 条断言(tokens.css @import)是 runner 第 37 项 `check-web-tokens-sync.mjs` 的**严格子集**:
 *      后者 :135 用正则 `/@import\s+['"][^'"]*design-tokens\/src\/styles\/tokens\.css['"]/` 判同一件事,
 *      且更稳(不锚定相对路径字面量),缺失即 exit 1(:136-138)。两条同体判据各挂一处 = 两个漂移源(§3)。
 *   2. 第 2 条断言(base.css @import)是**本文件唯一独有判据**。全仓 `scripts/**` 里提到 `styles/base.css`
 *      的只有本文件(实测 grep 唯一命中),而 `apps/web/app/globals.css:21` 确实在 @import 它
 *      ⇒ **这条判据目前无人执行**,是本次审计唯一没被"冗余"吃掉的残余。正解不是再挂一道门(台账
 *      `scripts/gate-wiring-allowlist.json` 本文件那条 reason 早已判"应并入前者,不另挂一道"),
 *      而是把这**一行**并入第 37 项那个单点 —— `check-web-tokens-sync.mjs` 不在本次允许改动清单内,
 *      故已作为待办上报主控会话登记,不在本文件里自行扩面。
 *   3. 顺手记下本门"脆弱"其实不成立:needle 是精确相对串,而 globals.css:7-8 已写明 Tailwind v4 的
 *      CSS @import 解析器不跟随 pnpm 软链(因此 KaTeX 那条裸包名 import 已被弃用)⇒ 相对路径形态是被
 *      工具链强制的,不会因"改成裸包名"这类正当重构而误红。
 *   4. 现状读数:两个源文件与两条 @import 均在位,全量 exit 0(不是恒红门,只是没人跑的门)。
 *
 * Usage:
 *   node scripts/check-web-tokens-import.mjs           # exit 0 on OK, 1 on drift
 *   node scripts/check-web-tokens-import.mjs --quiet   # errors only
 *   node scripts/check-web-tokens-import.mjs --staged  # accepted (full scan)
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS = join(root, 'apps/web/app/globals.css')
const TOKENS_CSS = join(root, 'packages/design-tokens/src/styles/tokens.css')
const BASE_CSS = join(root, 'packages/design-tokens/src/styles/base.css')
const quiet = process.argv.includes('--quiet')

const REQUIRED_IMPORTS = [
  { needle: "@import '../../../packages/design-tokens/src/styles/tokens.css'", file: GLOBALS_CSS, source: TOKENS_CSS, label: 'tokens.css' },
  { needle: "@import '../../../packages/design-tokens/src/styles/base.css'", file: GLOBALS_CSS, source: BASE_CSS, label: 'base.css' },
]

function check() {
  const failures = []
  for (const { needle, file, source, label } of REQUIRED_IMPORTS) {
    if (!existsSync(file)) {
      failures.push(`MISSING file: ${file}`)
      continue
    }
    if (!existsSync(source)) {
      failures.push(`MISSING source: ${source} (referenced by ${label} @import)`)
      continue
    }
    const content = readFileSync(file, 'utf8')
    if (!content.includes(needle)) {
      failures.push(`MISSING @import in ${file}: ${needle}`)
    }
  }
  return failures
}

function main() {
  const failures = check()
  if (failures.length === 0) {
    if (!quiet) console.log('[OK] apps/web/app/globals.css @imports design-tokens correctly (tokens.css + base.css)')
    process.exit(0)
  }
  console.error('[FAIL] apps/web tokens @import drift detected:')
  for (const f of failures) console.error(`  - ${f}`)
  console.error('Fix: restore @import in apps/web/app/globals.css to single-source the design tokens.')
  process.exit(1)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
