// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * check-web-rn-parity.mjs — web↔RN 功能 / 样式 对账门(只读报告器,自动持续)
 *
 * 背景:跨端对齐链 web → RN → 小程序(AGENTS §9)。RN↔小程序 已有门 128(组件配对)/237(页面覆盖)
 * + 共享 feature 层(packages/app/src/features),且已注册进 guardian-runner.mjs 每轮自动跑;
 * 而 web→RN 这一上游格原只在 scripts/ 里手动跑(check-web-rn-screen-parity / probe-web-rn-gap),
 * **从未注册进 guardian** ⇒ web 新增路由 / 功能,RN 缺承载时无人自动拦。本门把它变成每轮自动跑的
 * 持续守门,使「RN 自动同步 web 的样式与功能、不得有差」可机检、不回潮。
 *
 * 复用(§0.6 单一真相源,本文件零复算):
 *   · 功能维:check-web-rn-screen-parity.__test__ 的 evaluateMap / evaluateNav / collectWebRoutes /
 *     collectRnScreens / loadMap —— 路由级覆盖(aligned / excluded / gap / unmapped / portal)
 *     + 入口级可达性。任何路由分档规则变了,对账尺与本门同一把尺子,不会两把尺子漂出幽灵缺口。
 *   · 样式维:check-cross-end-tokens.mjs(子进程)的 RN↔tokens.css 颜色令牌对账。web 与小程序同吃
 *     tokens.css,故该门即 web↔RN 颜色同步的真相源;本门只调它、读它的结论,不重写判据。
 *
 * 判据边界:本门是「差距报告器」,不落地任何代码、不冒充已对齐。存量缺口(unmapped / gap)归台账
 * scripts/data/web-rn-screen-map.jsonl(aligned/excluded/gap/unmapped/portal + 段级豁免),
 * 本门只报数。web 令牌消费面广度是信息量(间接反映 web 是否"吃够令牌"),不计入拦截面。
 *
 * 定级:只读报告器,exit 0(正常报告);取不到被审面 ⇒ exit 2「未判定」(绝不把"没读到"写成"已对齐")。
 * 不进 blocking:存量缺口与本次提交无关,挂 blocking = §12e 恒红门,唯一结局是逼人 --no-verify。
 *
 * 用法:
 *   node scripts/check-web-rn-parity.mjs                 # 人类可读报告
 *   node scripts/check-web-rn-parity.mjs --json          # 机器可读
 *   node scripts/check-web-rn-parity.mjs --quiet         # 仅异常
 *   node scripts/check-web-rn-parity.mjs --staged        # 索引面(默认 HEAD blob)
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as parity } from './check-web-rn-screen-parity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const quietMode = argv.includes('--quiet')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'

// 应急逃生口(与门 128/237 同形):守门 108 管豁免到期,此处只提供跳过开关,不掩真红
if (process.env.HUSKY_SKIP_WEB_RN_PARITY) {
  console.log('⏭️  skipped: HUSKY_SKIP_WEB_RN_PARITY set')
  process.exit(0)
}

const log = (...a) => {
  if (!jsonMode && !quietMode) console.log(...a)
}
const err = (...a) => console.error(...a)

/* ---------- 功能维:复用 check-web-rn-screen-parity 的同一把尺子 ---------- */
function functionalParity() {
  const webRoutes = parity.collectWebRoutes(FACE)
  const rnScreens = parity.collectRnScreens(FACE)
  if (webRoutes.length === 0 || rnScreens.length === 0) {
    return {
      undetermined: true,
      why: `取不到被审面(web 路由 ${webRoutes.length} / RN 屏 ${rnScreens.length})`,
    }
  }
  const map = parity.loadMap()
  const ev = parity.evaluateMap(webRoutes, map, rnScreens, FACE)
  // 入口级可达性:不同谱系的 check-web-rn-screen-parity 导出的 __test__ 成员不同(旧版有
  // evaluateNav/collectNavEntries,新版已移除)。有则用同一把尺子;无则如实标「跳过」,绝不冒充通过。
  const navEval =
    typeof parity.evaluateNav === 'function' && typeof parity.collectNavEntries === 'function'
      ? parity.evaluateNav(
          parity.collectNavEntries(FACE),
          ev,
          webRoutes.map((r) => r.route),
        )
      : {
          undetermined: true,
          why: '当前 check-web-rn-screen-parity 未导出 evaluateNav/collectNavEntries ⇒ 入口级对账跳过(不冒充通过)',
        }
  return {
    undetermined: false,
    face: FACE,
    webRoutes: webRoutes.length,
    rnScreens: rnScreens.length,
    aligned: ev.aligned.length,
    excluded: ev.excluded.length,
    judgedGap: ev.judgedGap.length,
    unmapped: ev.unmapped.length,
    portal: (ev.portalRows?.length ?? 0) + (ev.portalUnverified?.length ?? 0),
    // 上游新版 evaluateMap 已把 portal 并入 excluded、不再暴露 portalRows ⇒ 未暴露时不冒充「0 条」
    portalKnown: Array.isArray(ev.portalRows) || Array.isArray(ev.portalUnverified),
    rot: ev.rot.length,
    contradicted: ev.contradicted?.length ?? 0,
    nav: navEval,
    rotRows: ev.rot,
    gapRows: ev.judgedGap.map((r) => ({ web: r.web, note: r.note || '' })),
    unmappedBySegment: [...new Set(ev.unmapped.map((r) => r.route.split('/')[0] ?? '(root)'))],
  }
}

/* ---------- 样式维:调 check-cross-end-tokens(子进程,零复算其判据) ---------- */
function styleParity() {
  try {
    const out = execFileSync('node', ['scripts/check-cross-end-tokens.mjs', '--quiet'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    })
    // --quiet 仅在有色值不一致时打印;走到这说明 exit 0 ⇒ 三端颜色令牌同步且通过
    return {
      ok: true,
      detail: out.trim() || 'RN↔tokens.css 三端颜色令牌对账通过(exit 0)',
      mismatches: 0,
    }
  } catch (e) {
    const code = typeof e.status === 'number' ? e.status : 1
    const stderr = (e.stderr || '').toString().trim()
    const stdout = (e.stdout || '').toString().trim()
    return {
      ok: false,
      exitCode: code,
      detail: stdout || stderr || `check-cross-end-tokens 退出码 ${code}`,
      mismatches: (stdout.match(/❌|不一致|mismatch/i) || []).length,
    }
  }
}

/* web 令牌消费面广度(信息量,不计入拦截面):各端 import @ihui/design-tokens 的文件数 */
function tokenBreadth() {
  const dirs = ['apps/web/src', 'packages/app/src', 'apps/mobile-rn/src', 'apps/miniapp-taro/src']
  const out = {}
  for (const dir of dirs) {
    try {
      const r = execFileSync(
        'git',
        ['-C', ROOT, 'grep', '-l', '@ihui/design-tokens', 'HEAD', '--', `${dir}`],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 },
      )
      out[dir] = r.split('\n').filter(Boolean).length
    } catch {
      out[dir] = 0
    }
  }
  return out
}

/* ---------- 主流程 ---------- */
function run() {
  const fn = functionalParity()
  if (fn.undetermined) {
    err(`❌ 未判定:${fn.why} —— 不记绿也不冒红`)
    process.exit(2)
  }
  const st = styleParity()
  const breadth = tokenBreadth()

  const json = { functional: fn, style: st, tokenBreadth: breadth }
  if (jsonMode) {
    console.log(JSON.stringify(json, null, 1))
    process.exit(0)
  }

  log('')
  log('🌐 web ↔ RN 跨端对账(只读报告器,自动持续)')
  log('────────────────────────────────────────')
  log(`判定面        : ${fn.face}`)
  log(`web 路由      : ${fn.webRoutes}    RN 屏: ${fn.rnScreens}`)
  log('')
  log('【功能维 · 路由级覆盖】')
  log(`  ✅ aligned   : ${fn.aligned}  (web 路由在 RN 端有承载体)`)
  log(`  🟡 excluded  : ${fn.excluded}  (登记豁免:管理后台/营销页等 App 不承载)`)
  if (fn.portalKnown) log(`  🟡 portal    : ${fn.portal}  (RN 用 WebView 承载)`)
  else log('  🟡 portal    : n/a(上游 evaluateMap 已并入 excluded,不再单列)')
  log(`  🔴 gap       : ${fn.judgedGap}  (判过确缺:RN 该内容域零承载)`)
  log(`  🔴 unmapped  : ${fn.unmapped}  (web 有、台账零判定的漂移缺口 —— 自动门要拦的就是它)`)
  if (fn.nav && !fn.nav.undetermined) {
    log(
      `  🧭 入口级缺口: ${fn.nav.counts?.gap ?? 0} 条 / 入口未登记: ${fn.nav.counts?.unrecorded ?? 0} 条`,
    )
  }
  if (fn.rot.length) {
    log(`  ⚠️  登记腐烂  : ${fn.rot.length} 条(指向不存在的屏 / web 键不在路由集 / 豁免缺理由)`)
    for (const r of fn.rot.slice(0, 8)) log(`       · L${r.line}: ${r.why}`)
  }
  if (fn.gapRows.length) {
    log('  🔴 判过缺口清单(逐项待补 RN 承载):')
    for (const r of fn.gapRows.slice(0, 20)) log(`       · ${r.web} — ${r.note.slice(0, 60)}`)
  }
  if (fn.unmapped > 0) {
    log('  🔴 unmapped 首段分布:')
    for (const seg of fn.unmappedBySegment.slice(0, 10)) log(`       · ${seg}`)
  }
  log('')
  log('【样式维 · 颜色令牌】')
  if (st.ok) {
    log(`  ✅ ${st.detail}`)
  } else {
    log(`  🔴 web↔RN 颜色令牌不一致(退出码 ${st.exitCode},${st.mismatches} 处):`)
    log(`       ${st.detail.slice(0, 200)}`)
  }
  log('')
  log('【样式维 · 令牌消费广度(信息量)】')
  log(
    `  web ${breadth['apps/web/src']} · 共享层 ${breadth['packages/app/src']} · RN ${breadth['apps/mobile-rn/src']} · 小程序 ${breadth['apps/miniapp-taro/src']} 文件`,
  )
  log('  (web 消费面明显偏窄 ⇒ 其样式更易脱离令牌源漂移;优先把 web 组件迁到消费 design-tokens)')
  log('')
  log('────────────────────────────────────────')

  // 只读报告器:无论存量缺口多少都 exit 0;只有"取不到面"才 exit 2(已在上面拦截)
  process.exit(0)
}

run()
