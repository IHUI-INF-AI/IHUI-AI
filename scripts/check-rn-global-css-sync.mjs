// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-rn-global-css-sync.mjs — 守门:`apps/mobile-rn/global.css` 的 --color-* 必须与
 * `packages/design-tokens/src/styles/tokens.css` 逐位同值且**不得缺档**。
 *
 * 2026-09-25 的两处收紧(都由实测逼出,不是顺手加严):
 * 1. **取值改与生成器共用一份实现**(`scripts/lib/design-token-blocks.mjs`)。旧版本门剥不出注释,
 *    而小程序那道 `check-miniapp-tokens-sync.mjs:55-57` 剥了 —— 同一判据两处不同形;且旧版只看
 *    副本里**已有**的键(subset),所以 `global.css` 只有 32 个 :root 档而源头有 103 个,门一路报绿。
 *    这正是"副本比源头少一整批档"能长期存活的机制。
 * 2. **判缺档(missing)**:源头受管档在副本里不存在即红。生成器已能自动补入,所以这条不会恒红;
 *    它拦的是"没人跑生成器"与"有人手删了受管行"这两种形态。
 *
 * 与生成器的分工:本门只判、只报差异;`node scripts/sync-rn-global-css.mjs` 才是写回的一侧。
 * 提交链里两者是同一枚提交的两步 —— `scripts/lib/pre-commit-hook.js` 的 `TOKEN_SYNC_TARGETS`
 * 会先跑生成器再让本门复核,所以按规矩改源头不会被本门拦。
 *
 * 用法:
 *   node scripts/check-rn-global-css-sync.mjs            全量(磁盘)
 *   node scripts/check-rn-global-css-sync.mjs --staged   索引面(这次提交会带走的那一份)
 *   node scripts/check-rn-global-css-sync.mjs --quiet    只出错才说话
 * 退出码:0 = 一致;1 = 漂移/缺档;2 = 无法判定(取不到某个面,绝不冒绿也绝不冒红)
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { collectVars } from './lib/design-token-blocks.mjs'
import { deriveRnDecls, TOKENS_SOURCE_REL, GLOBAL_CSS_REL } from './sync-rn-global-css.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const staged = args.includes('--staged')

function gitShow(spec) {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', 'show', spec], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      cwd: root,
      windowsHide: true,
    })
  } catch {
    return null
  }
}

/** 判哪个面就按哪个面取**两份**,源与副本混面会在并发会话的瞬间产出假红/假绿。 */
function readFace(rel) {
  if (!staged) {
    try {
      return readFileSync(join(root, rel), 'utf8')
    } catch {
      return null
    }
  }
  const idx = gitShow(`:${rel}`)
  return idx === null ? gitShow(`HEAD:${rel}`) : idx
}

export function compare({ tokensCss, globalCss }) {
  const mismatches = []
  const missing = []
  for (const kind of ['light', 'dark']) {
    const block = kind === 'dark' ? '.dark' : ':root'
    const have = collectVars(globalCss, [block])
    for (const d of deriveRnDecls(tokensCss, kind)) {
      const got = have.get(d.name)
      if (got === undefined) missing.push({ block, name: d.name, want: d.value })
      else if (got.value !== d.value)
        mismatches.push({ block, name: d.name, rn: got.value, tok: d.value })
    }
  }
  // 副本里有、源头没有的 --color-* 档:属端内自立档,生成器无权删,本门只报数不判红
  const extras = [
    ...collectVars(globalCss, [':root']).keys(),
    ...collectVars(globalCss, ['.dark']).keys(),
  ].filter((n) => !deriveRnDecls(tokensCss, 'light').some((d) => d.name === n))
    .filter((n) => !deriveRnDecls(tokensCss, 'dark').some((d) => d.name === n)).length
  return { mismatches, missing, extras }
}

function main() {
  if (!quiet)
    console.log(
      `[check-rn-global-css-sync] Checking mobile-rn/global.css vs design-tokens/tokens.css(取材面:${
        staged ? '索引' : '磁盘'
      })...`
    )
  const tokensCss = readFace(TOKENS_SOURCE_REL)
  const globalCss = readFace(GLOBAL_CSS_REL)
  if (tokensCss === null || globalCss === null) {
    console.error(
      `[check-rn-global-css-sync] 取不到 ${
        tokensCss === null ? TOKENS_SOURCE_REL : GLOBAL_CSS_REL
      } ⇒ 无法判定(不记为通过)`
    )
    process.exit(2)
  }

  const { mismatches, missing, extras } = compare({ tokensCss, globalCss })
  if (mismatches.length === 0 && missing.length === 0) {
    if (!quiet)
      console.log(
        `[check-rn-global-css-sync] All ${
          deriveRnDecls(tokensCss, 'light').length + deriveRnDecls(tokensCss, 'dark').length
        } 个受管档逐位同值且无缺档(另有 ${extras} 个端内自立 --color-* 档,只报数不判红)`
      )
    process.exit(0)
  }
  for (const m of mismatches)
    console.error(
      `  ${m.block} ${m.name}: mobile-rn='${m.rn}' vs tokens='${m.tok}' —— 值漂移`
    )
  for (const m of missing)
    console.error(`  ${m.block} ${m.name}: 副本里没有(源头值 '${m.want}')—— 缺档`)
  console.error(
    `[check-rn-global-css-sync] Found ${mismatches.length} 处值漂移 / ${missing.length} 处缺档`
  )
  console.error('  修复:node scripts/sync-rn-global-css.mjs(原位写回,幂等,不动 --rn-* 端内档)')
  process.exit(1)
}

// §22d
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { compare }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
