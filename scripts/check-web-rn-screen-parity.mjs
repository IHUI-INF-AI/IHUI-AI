// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// web↔RN 功能覆盖对账尺(只读,不进提交链)—— 回答一个问题:"web 端的这条路由,RN 端有对应屏吗?"
//
// 背景(goal 2026-10-24):跨端对齐链为 web → RN → 小程序。RN↔小程序已有门 128(组件配对)与
// check-cross-end-screen-coverage(shared/rn/miniapp 三元组标记链),而 web→RN 这一上游格此前零判据:
// web 889 页 vs RN 254 屏的差距只能靠人工比对。本尺把「RN 功能不差 web」变成可机检的差距账本。
//
// 判定权在登记表(scripts/data/web-rn-screen-map.jsonl,逐行):
//   {"web":"settings/llm","rn":"packages/app/src/features/.../XScreen.tsx","status":"aligned","note":"...","at":"2026-10-24"}
//   {"web":"admin/users","status":"excluded","reason":"管理端,App 不承载","at":"2026-10-24"}
//   {"web":"admin/**","status":"excluded","reason":"管理后台整段,App 不承载","at":"2026-10-24"}   ← 段级豁免(最大化减少登记量)
//   {"web":"agent-plan","status":"gap","note":"<判过:RN 该内容域零承载,含证据文件:行>","at":"2026-10-26"}
// 未登记的 web 路由 = unmapped(功能缺口**候选** = 没人判过),报告按首段分组计数并附启发式 RN 候选(仅建议,不判定)。
// 四桶分档(2026-10-26 补 gap 档):aligned / excluded / gap(判过确缺) / unmapped(未判定)。
// 第五维「门户承载」(2026-10-27 立,不是第五桶而是**推导维**):packages/shared/src/constants/web-portal.ts
// 是移动端 WebView 门户的唯一源(RN 与小程序都从它派生),在册路由即由 RN 承载。本尺此前不读它 ⇒
// 门户路由被逐条判成「RN 零承载」的既成缺口(现读 64 条 gap 里 14 条、excluded 里 14 条如此)。
// 推导而非登记:表每长一条,承载面自动跟一条,不需要人再判一次(机主"最大化减少开发"的直接落点)。
// 与之互斥的在册行单列 contradicted 点名(台账说不承载、表说承载 ⇒ 两句不能同时成立,裁决权归人);
// 表里指向不存在路由的 path 单列 portalUnmatched 点名(那是门户腿自己腐烂:RN 会开出一个 404)。
// 为什么必须有 gap 档:落地器此前 `if (verdict==='gap') continue` ⇒ 判过的缺口一行不留,
// 下轮重扫又变回 unmapped —— "判过"与"没人判"结构上分不开(§0.3 的对称另一半:判过不能丢成没判)。
// 登记腐烂(aligned 指向不存在的文件 / web 键不在路由集 / excluded 缺 reason / 段级豁免命中 0 条路由)
// 逐条点名 —— 豁免必须"验过才免";前缀豁免与逐条登记重叠时逐条优先(更具体的判定赢)。
//
// ── 段级豁免三维(2026-10-30 立,治本尺的**第二个**结构性盲区;只点名不改判,裁决权归人) ──
// 立因(2026-10-30 现读 HEAD 面,非推断):登记表 464 行里 10 枚是段级豁免前缀(`admin/**` 一类),
// 按「逐条优先让位」口径实际豁免 450 条路由(不扣让位时射程全集 454 条);而上一格的 contradicted
// **只比逐条在册行** ⇒ 互斥陈述写在段级面上就读不出来,三条实测证据:
//   · 盲绿:`packages/shared/src/constants/web-portal.ts` 的 domain:'admin' 段现读 18 条 /admin*
//     路由由 WebView 门户承载(admin、admin/agents、admin/orders、admin/ticket…),同时 `admin/**`
//     的 reason 写「App/小程序不承载」——两句互斥,而本尺当时输出 `contradicted=0`。
//   · 计数腐烂:reason 自述的数与该行现读命中数不符 —— `admin/**` 写「(332 页)」现读命中 335,
//     `docs/**` 写「六段」现读 10 段(agent/api/manual/mcp/models/quickstart/rag/self-host/team/workflow)。
//   · 豁免不会到期:10 枚段级豁免**全部**只有 at、没有 expires/reviewBy ⇒ §0.7「豁免必须会到期」
//     在段级面零判据(本轮只判这 10 枚段级行;90 枚逐条 excluded 的缺期只报数,判它 = 恒红门 §12e)。
// 判据纪律:门户腿复用 evaluateMap 已算好的**同一枚** portalCarried(与 contradicted 同一条尺,§0.6
// 零复算),逐条腿复用同一批 aligned/portalRows ⇒ 段级与逐条两档不可能一段绿一段红。
// 契约:既有 --json 键名与类型一个不动(驾驶舱在解析它),新增 prefixContradicted /
// prefixContradictedUndetermined / prefixCarriedRowsOverlap / staleCountAssertions /
// missingExpiry / missingExpiryUndetermined / missingExpiryPerRowStock / alignedUnique。
// 两个"重复"口径**不是一回事**,下游别混用(2026-10-30 补):
//   · `alignedUnique` = **aligned 档**按 web 键去重后的枚数(承载面:一组路由);
//   · `duplicateWebKeys` / `duplicateWebKeyItems` = **全表**重复键尺(同一 web 键在台账里落多于一行,
//     **不分 status**:aligned/portal 副本、aligned×portal 互斥、excluded 副本一律算),它量的是"台账
//     有几处一键多行",不是 aligned 档的折算系数 —— 拿它去折算 aligned 会把 portal/excluded 的重复也算进去。
//     折算 aligned 请读 `alignedUnique`(去重只此一份,§0.6)。
// 维一口径(2026-10-30 当天收窄一次):只判"门户承载 ∧ 台账对该条没有任何逐条认领 ∧ 被段级豁免写成不承载";
// 台账已逐条认领的走"更具体的判定赢"(与本文件 prefixHits 射程同一口径),只报 overlaps。
// 收窄前那版把逐条认领也算互斥 ⇒ 补了 portal 行仍被点名 ⇒ 本维没有任何合法修复出口。
// 「逐条认领」= 台账对这一条**有逐条登记**(aligned/portal/excluded/gap 任何一档都算,含被
// rot / contradicted 摘走的那几枚),不是"只算逐条承认承载的那两档":口径原话是"没有任何逐条认领",
// 收窄只收 aligned+portal 时,一枚逐条 excluded 行恰落在段级射程内又恰被门户承载,会被段级维
// 再点一次名(逐条维 contradicted 已经点过 ⇒ 同一冲突双报),且给出的出路"补 status:portal 行"
// 会造出本尺自己的维四(同一 web 键两行)红点。逐条认领 ⇒ 一律只以 overlaps 报数。
//
// 取材面纪律(§0.4):默认 HEAD blob;--staged 判索引;--worktree 仅人工逃生舱;两面旗同给 exit 2。
// 枚举/读面复用 check-cross-end-screen-coverage 的 faceList/faceRead/collectShared/collectRn(§0.6 单一真相源,
// 本文件零复算)。RN 功能面 = 共享屏(packages/app/src/features/**/*Screen.tsx,真相源)+ RN 端内屏
// (apps/mobile-rn/src/screens/*.tsx);95.7% 端内屏委托共享层,故两端去重按「屏名」。
//
// 定级:只读报告器,exit 0(取不到面 ⇒ exit 2「未判定」)。差距归零是 goal 的事,不是本尺的事;
// 挂提交链 = 恒红门(§12e),与 check-temp-landing / check-dispatch-premise 同列只读尺子。
// 「取不到面 ⇒ exit 2」自 2026-10-30 起把段级三维的输入也算进来:登记表面取不到 或 门户表面取不到
// ⇒ 报告照常产出(JSON 仍解析得到,供 check-cross-end-parity-drift 的 status 档读),但进程按未判定
// 退 2 并点名是哪一维缺哪一枚输入 —— 此前这两枚输入取不到时只打一行「未判定」就退 0,
// 于是"整尺瞎了"在编排器账面上与"跑完且无冲突"同形(§0.3 判据失效的表现永远是安静)。
import { pathToFileURL } from 'node:url'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
// 承载体判据单源:与造页器同一条(§0.6)。aligned 指向共享屏时,必须真有 RN 屏渲染它 ——
// 2026-10-27 实测 3 条在册行(web following / user/follow / edu/dashboard)指向的共享屏
// 在 RN 端**零渲染方**,却在账本里记"已对齐":那不是对齐,是登记表替代码背书。
import { rendersSharedIn } from './gen-miniapp-mirror.mjs'

const MAP_PATH = 'scripts/data/web-rn-screen-map.jsonl'
const WEB_APP_DIR = 'apps/web/app'
// WebView 门户登记表:移动端按设计用 WebView 承载的 web 路由,唯一源在共享常量里(RN 侧
// apps/mobile-rn/src/lib/webview-portal-config.ts 与小程序侧都从它派生,不是端内自造清单)。
const WEB_PORTAL_REL = 'packages/shared/src/constants/web-portal.ts'
// web 侧栏导航项的唯一源(入口级可达性的分母)
const NAV_REL = 'apps/web/src/components/sidebar/nav-data.ts'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')
const topArg = argv.find((a) => a.startsWith('--top='))
const topN = topArg ? Number.parseInt(topArg.split('=')[1], 10) : 3
// 全量清单档:默认只给前 40 条候选建议(报告可读),--full 给全部未映射(分诊/批量登记用)
const fullMode = argv.includes('--full')

if (stagedMode && worktreeMode) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4 不允许回落另一个面)')
  process.exit(2)
}
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'
const log = (...a) => {
  if (!jsonMode) console.log(...a)
}

/** web 语言镜像段:同一路由的五语复制品,不是独立功能页,逐条排除 */
const LANG_SEGS = new Set(['en', 'zh-TW', 'ko', 'ja', 'zh-CN'])
/** token 化时剔除的结构虚词(对齐两端命名差异,不参与交集) */
const STOP_TOKENS = new Set(['app', 'index', 'page', 'screen', 'main', 'web'])

/** apps/web/app 下所有 page.tsx → 路由(剥 route group,剥语言镜像,剥动态段占位) */
function collectWebRoutes(face) {
  const out = []
  for (const rel of cov.faceList(face, WEB_APP_DIR)) {
    if (!rel.endsWith('/page.tsx') && rel !== `${WEB_APP_DIR}/page.tsx`) continue
    const segs = rel
      .slice(WEB_APP_DIR.length + 1, -'/page.tsx'.length)
      .split('/')
      .filter((s) => !/^\([a-z-]+\)$/.test(s))
    if (segs.some((s) => LANG_SEGS.has(s))) continue
    out.push({ route: segs.join('/') || '(root)', rel })
  }
  return out.sort((a, b) => a.route.localeCompare(b.route))
}

/** WebView 门户承载集(2026-10-27 立,治本尺的结构性盲区)。
 * 立因:本尺此前只看「web 路由集 × RN 屏集」,从不读这张门户表 ⇒ 移动端**按设计**用 WebView
 * 承载的 91 条路由里,18 条被逐条判成「RN 零承载」的既成缺口(现读证据:登记表 gap 行的 note
 * 与门户表 path 指向同一路由)。假缺口的代价不是数字难看,而是它必须靠人逐条翻代码才能推翻 ——
 * 正是机主要消灭的那类重复开发。接进唯一判据源后,门户表每长一条,承载面自动跟着长。
 * 形态:去 query/hash、去首尾斜杠,与 collectWebRoutes 的 route 同形(无首斜杠、kebab 段)。
 * 取不到面 ⇒ set 为 null(调用侧一律按「门户维未判定」走,绝不把没读到当成空集,§0.3)。
 */
function collectPortalRoutes(face) {
  const text = cov.faceRead(face, WEB_PORTAL_REL)
  if (typeof text !== 'string') return { set: null, rows: [], unreadable: true }
  const rows = []
  for (const m of text.matchAll(/path:\s*'([^']+)'/g)) {
    const route = m[1].split('?')[0].split('#')[0].replace(/^\/+/, '').replace(/\/+$/, '')
    if (route) rows.push({ raw: m[1], route })
  }
  /**
   * 参数路由的门户承载此前量不到(2026-10-27 立):表里除了静态 `path: '...'`,还住着**详情 URL
   * 组装出口**(`buildWebMemoryDetailUrl` 一类,`${webBase}/memory/${encodeURIComponent(id)}`),
   * 那正是 web `/memory/[id]` 的承载体——台账却仍把它读成"RN 零承载"的 gap,尺子也跟着漏判。
   * 这里按**模板形状**把它折成路由形态 `memory/[id]`,与静态条目同集合参与判定。
   */
  rows.push(...portalRouteShapesFrom(text))
  return { set: new Set(rows.map((r) => r.route)), rows, unreadable: false }
}

/** 纯函数(可被镜像直接喂缺陷面):把门户表里的 URL 组装模板折成路由形态;首段非字面量或 api/ 前缀不算页面承载 */
function portalRouteShapesFrom(text) {
  const out = []
  for (const m of String(text).matchAll(/`\$\{webBase\}([^`]*)`/g)) {
    const segs = m[1].split(/\$\{[^}]*\}/)
    if (!segs[0]) continue // 首段就是插值 ⇒ 拿不到路径形状,不猜
    const route = segs
      .map((s, i) => (i === 0 ? s : `[id]${s}`))
      .join('')
      .split('?')[0]
      .split('#')[0]
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
    if (!/\[id\]/.test(route) || route.startsWith('api/')) continue
    out.push({ raw: m[0], route, derived: true })
  }
  return out
}

/* ================= 段级豁免三维(2026-10-30 立;以下全是零 IO 纯函数,镜像测试直接喂构造面) ================= */

/** 段级行射程口径**单源**:'admin/**' → {prefix:'admin/', segRoot:'admin'}(段首页本身也在射程内)。
 * evaluateMap 的 prefixHits 与三维共用这一把 + routeInScope,不允许出现第二份匹配式(§0.6):
 * 一旦两处各写一遍 `startsWith(prefix)`,收窄射程时就会出现"逐条让位集与段级点名集不是一套路由"。 */
function prefixScopeOf(web) {
  const prefix = String(web).slice(0, -2)
  return { prefix, segRoot: prefix.slice(0, -1) }
}

/** 纯函数:路由是否落在该段射程内(段首页本身也算,与 evaluateMap 的既有口径逐字同形) */
function routeInScope(route, scope) {
  return route === scope.segRoot || route.startsWith(scope.prefix)
}

/** 纯函数:某段级行的**射程全集**(含已被逐条登记让位的那些)。
 * 为什么另开一把而不是直接用 prefixHits:prefixHits 量的是「段级豁免实际生效几条」(逐条优先让位),
 * 而本维问的是「这一段的 reason 说的到底是那一片路由」—— 段首页自己已逐条 aligned、
 * 或段里某页被逐条判过 gap,都不改变"该段覆盖它"这个事实。两把都用 routeInScope,故不会漂出幽灵差额。 */
function routesUnderPrefix(webRoutes, scope) {
  return webRoutes
    .map((r) => r.route)
    .filter((route) => routeInScope(route, scope))
    .sort()
}

/** 纯函数:段内「下一层目录」去重集 —— reason 自述「六段」量的就是这个,不是页数(docs/** 现读 10 段)。
 * 段首页自身(r === segRoot)不算一段。 */
function subSegmentsUnderPrefix(routes, scope) {
  const set = new Set()
  for (const route of routes) {
    if (!route.startsWith(scope.prefix)) continue
    const seg = route.slice(scope.prefix.length).split('/')[0]
    if (seg) set.add(seg)
  }
  return [...set].sort()
}

const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

/** 纯函数:数字串(ASCII 或中文数词,含 十/百 组合)转数值;解不出 ⇒ null(宁漏不误报,不猜数) */
function cnNumberToInt(run) {
  const s = String(run)
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10)
  if (!/^[零一二两三四五六七八九十百]+$/.test(s)) return null
  let total = 0
  let cur = 0
  let seen = false
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      cur = CN_DIGITS[ch]
    } else if (ch === '十') {
      total += (cur || 1) * 10
      cur = 0
    } else if (ch === '百') {
      total += (cur || 1) * 100
      cur = 0
    } else return null
    seen = true
  }
  return seen ? total + cur : null
}

/** 自述计数的单位白名单:**只有这两个单位**才当「该行命中数」的断言量。
 * 刻意不含 个/张/行/步/档/列/状态 —— reason 里的数字九成是代码行号与证据指针(:214、148 行、
 * 六张产品卡、五步 checklist、6 状态列),把它们当页数比对会造出一屏假阳(宁漏不误报)。 */
const COUNT_UNIT_RE = /^\s*(页面|页|段)/

/** 指示代词闸:「这一页」「该页」「本页」是指示不是计数,前一字符命中即整条跳过 */
const POINTING_BEFORE_RE = /[这该本那每单整同此某]/

/** 纯函数:从 reason 里取「数字 + 页/段」形态的自述计数 ⇒ [{raw, value, unit}]。
 * 解析不出 ⇒ [](不是违规,是"这条 reason 没做可核对的断言")。 */
function countAssertionsOf(reason) {
  if (typeof reason !== 'string') return []
  const out = []
  const RE = /(\d+|[零一二两三四五六七八九十百]+)/g
  let m
  while ((m = RE.exec(reason))) {
    const before = reason[m.index - 1] ?? ''
    if (POINTING_BEFORE_RE.test(before)) continue
    const value = cnNumberToInt(m[0])
    if (value === null) continue
    const rest = reason.slice(m.index + m[0].length)
    const um = COUNT_UNIT_RE.exec(rest)
    if (!um) continue
    out.push({ raw: `${m[0]}${um[0]}`, value, unit: um[1] })
  }
  return out
}

/** 维一:段级豁免 × 门户承载 ⇒ 逐条点名(纯函数)。
 * portalCarried 由调用侧传入 evaluateMap **已经算好的那一枚**(与 contradicted 同一条尺,§0.6):
 * 本函数绝不自己再读门户表 ⇒ 段级与逐条两档结构上不可能一段读成绿、另一档读成红。
 * portalCarried === null ⇒ 门户腿未判定:undetermined 必须点名,绝不让"items 空"被读成整维验过(§0.3)。
 *
 * 2026-10-30 收窄一次(本机主实测后自审):前一版把"前缀下另有逐条 aligned/portal 行"也当互斥点名,
 * 这与本文件既有的射程纪律打架 —— prefixHits 那一路(:603)明写「逐条登记优先(更具体的判定赢)」,
 * 而那一版判据在台账**已经逐条承认承载**的时候仍要求它别再落进前缀射程 ⇒ 这条维没有任何合法修复出口
 * (加逐条行 = 继续被点名)。一把没有出口的判据,结局就是被人当噪声忽略(§12e 同型)。
 * 现在只判真互斥:**门户表承载、而台账对这一条没有任何逐条认领、却被段级豁免写成"不承载"** ⇒ 红;
 * 台账已逐条认领过的那些只以 overlaps 报数(措辞冗余归人裁,不判红)。
 *
 * 「逐条认领」的射程 = 台账里该路由的**任何**逐条登记(aligned / portal / excluded / gap),
 * 不是只有"承认承载"的两档:一枚逐条 excluded 行同样是对这一条承载状态的判定(它说"不承载"),
 * 口径原话是"没有任何逐条认领" ⇒ 它在场时段级维不判互斥(逐条维 contradicted 已把那枚冲突点过名,
 * 段级维再点一次就是同一冲突双报,且段级维给的出路"补 status:portal 行"会造出维四的重复键)。 */
function evaluatePrefixContradictions({
  webRoutes,
  prefixRows,
  portalCarried,
  perRowRows,
  mapUnreadable = false,
}) {
  const items = []
  const overlaps = []
  const undetermined = []
  if (prefixRows.length === 0)
    undetermined.push(
      mapUnreadable
        ? '登记表取不到 ⇒ 段级互斥维零候选(未判定,不记绿)'
        : '登记表没有段级豁免行 ⇒ 本维零候选(不是"验过",是没东西可验)',
    )
  if (portalCarried === null)
    undetermined.push(`门户表取不到 ⇒ 本维一枚也判不出(未判定,不记绿,§0.3)`)
  for (const p of prefixRows) {
    const scope = prefixScopeOf(p.web)
    for (const route of routesUnderPrefix(webRoutes, scope)) {
      const row = perRowRows.get(route)
      if (row) {
        // 更具体的判定赢:台账对这一条已有逐条登记 ⇒ 段级只覆盖其余,不构成互斥
        if (portalCarried?.has(route))
          overlaps.push({ prefix: p.web, line: p.line, route, rowStatus: row.status, rowLine: row.line })
        continue
      }
      if (!portalCarried?.has(route)) continue
      items.push({
        prefix: p.web,
        line: p.line,
        route,
        rowStatus: null,
        reason: p.reason,
        sources: [`门户表承载(${WEB_PORTAL_REL})`],
      })
    }
  }
  return { items, overlaps, undetermined }
}

/** 维二:excluded 行(段级与逐条都算)reason 的自述计数 ↔ 该行现读命中数 ⇒ 不符即点名(纯函数)。
 * 现读口径:页/页面 ⇒ 该行射程的路由枚数(段级=射程全集,逐条=它自己那一枚);
 * 段 ⇒ 段内下一层目录去重枚数,逐条行没有"段"可量 ⇒ 跳过不猜。 */
function evaluateStaleCounts({ webRoutes, rows }) {
  const items = []
  const routes = webRoutes.map((r) => r.route)
  for (const row of rows) {
    const asserts = countAssertionsOf(row.reason)
    if (asserts.length === 0) continue
    const isPrefix = String(row.web).endsWith('/**')
    const scope = isPrefix ? prefixScopeOf(row.web) : null
    const hits = isPrefix
      ? routesUnderPrefix(webRoutes, scope)
      : routes.filter((r) => r === row.web)
    for (const a of asserts) {
      let present
      if (a.unit === '段') {
        if (!isPrefix) continue
        present = subSegmentsUnderPrefix(hits, scope).length
      } else {
        present = hits.length
      }
      if (a.value === present) continue
      items.push({
        web: row.web,
        line: row.line,
        kind: isPrefix ? 'prefix' : 'row',
        unit: a.unit,
        asserted: a.value,
        present,
        raw: a.raw,
        reason: row.reason,
      })
    }
  }
  return { items }
}

/** 存活期字段名**单源**(段级与逐条同一把,只是射程不同):有 expires 用 expires,否则退 reviewBy */
const EXPIRY_FIELDS = ['expires', 'reviewBy']
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 纯函数:一行登记的存活期 ⇒ {key, value} | null(null = 会过期的字段一个都没有) */
function expiryOf(row) {
  for (const key of EXPIRY_FIELDS) {
    const v = row[key]
    if (v !== undefined && v !== null && v !== '') return { key, value: String(v) }
  }
  return null
}

/** 维三:段级豁免必须有存活期(§0.7 豁免会到期)⇒ 缺 / 形态坏 / 已到期 逐条点名(纯函数)。
 * 射程刻意只给段级行:逐条 excluded 存量 90 枚一枚都没挂过期日,把逐条也判红 = 恒红门(§12e,
 * 唯一结局是逼人 --no-verify 连带废掉全部守门),故逐条那一档只在调用侧以 missingExpiryPerRowStock 报数。
 * 到期判定按 ISO 字符串比较(YYYY-MM-DD 字典序即时序);到期日**当天**仍算存活(与 until 语义一致)。 */
function evaluateMissingExpiry(prefixRows, today = new Date().toISOString().slice(0, 10)) {
  const items = []
  const undetermined = []
  if (!ISO_DATE_RE.test(String(today)))
    undetermined.push(`today 形态不是 YYYY-MM-DD(${String(today)}) ⇒ 到期维判不了,不记绿`)
  if (prefixRows.length === 0)
    undetermined.push('没有段级豁免行可扫 ⇒ 本维零候选(枚举到 0 不记绿,§0.3)')
  if (undetermined.length > 0) return { items, undetermined }
  for (const p of prefixRows) {
    const e = expiryOf(p)
    if (!e) {
      items.push({
        web: p.web,
        line: p.line,
        why: 'missing',
        fields: EXPIRY_FIELDS.slice(),
        detail: `段级豁免既无 ${EXPIRY_FIELDS[0]} 也无 ${EXPIRY_FIELDS[1]}(§0.7 豁免必须会到期)`,
      })
      continue
    }
    if (!ISO_DATE_RE.test(e.value)) {
      items.push({
        web: p.web,
        line: p.line,
        why: 'malformed',
        field: e.key,
        value: e.value,
        detail: `${e.key} 不是 YYYY-MM-DD 形态 ⇒ 机器判不了到期,等同没有(§0.7)`,
      })
      continue
    }
    if (e.value < today) {
      items.push({
        web: p.web,
        line: p.line,
        why: 'expired',
        field: e.key,
        value: e.value,
        today,
        detail: `${e.key}=${e.value} 早于 ${today} ⇒ 豁免已到期,应重判或续期`,
      })
    }
  }
  return { items, undetermined }
}

/** 屏名 token 化:PascalCase 拆词、小写、剔虚词;'index' 用父目录名补位 */
function screenTokens(name) {
  let base = name
  if (base === 'index') base = 'home'
  return base
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t && !STOP_TOKENS.has(t))
}

/** 路由 token 化:kebab/路径段拆词、小写、剔虚词、动态段 [id] 剔除 */
function routeTokens(route) {
  return route
    .split('/')
    .filter((s) => s && !/^\[.*\]$/.test(s))
    .flatMap((s) => s.split('-'))
    .map((t) => t.toLowerCase())
    .filter((t) => t && !STOP_TOKENS.has(t) && !LANG_SEGS.has(t))
}

/** RN 功能面:共享屏(真相源)+ 端内屏,按屏名去重 */
function collectRnScreens(face) {
  const byName = new Map()
  for (const s of cov.collectShared(face)) {
    byName.set(s.name, { name: s.name, rel: s.rel, layer: 'shared' })
  }
  for (const r of cov.collectRn(face)) {
    let name = r.name
    if (name === 'index') {
      const segs = r.file.split('/')
      name = segs[segs.length - 2] ?? 'index'
    }
    if (!byName.has(name)) byName.set(name, { name, rel: r.file, layer: 'rn-app' })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** 启发式候选(仅建议):web 路由 token 与各屏 token 的交集,交集大者优先;
 * 同名强信号(路由尾段 token 集 == 屏名 token 集)置顶并标 exact —— 轮 15 实测教训:
 * api-keys ↔ ApiKeysScreen 同名直配因交集分低被排序淹没,导致「RN 无此屏」误判。 */
function suggestCandidates(route, rnScreens, limit) {
  const rt = new Set(routeTokens(route))
  if (rt.size === 0) return []
  const tail = new Set(route.split('/').pop()?.split('-').filter(Boolean) ?? [])
  return rnScreens
    .map((s) => {
      const st = screenTokens(s.name)
      const hit = st.filter((t) => rt.has(t))
      const exact = st.length > 0 && st.length === tail.size && st.every((x) => tail.has(x))
      return { name: s.name, rel: s.rel, hit, exact }
    })
    .filter((c) => c.hit.length > 0 || c.exact)
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.hit.length - a.hit.length ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
}

/** 读登记表(jsonl,逐行 JSON;与被审面同面同轮取(门 118 取材面纪律);取不到 ⇒ null = 未判定,不用空表冒充) */
function loadMapDetailed(face = FACE) {
  let text
  try {
    text = cov.faceRead(face, MAP_PATH)
  } catch (e) {
    // 旧实现是 catch 全部折成 [](git 派生故障与"该面没有这份件"同形,盲绿的一路来源)。
    // 现在:派生故障点名给 why,由调用侧按未判定退 2(§0.3)。
    return { rows: [], unreadable: true, why: `${MAP_PATH} 取不到:${e?.message ?? e}` }
  }
  if (typeof text !== 'string')
    return { rows: [], unreadable: true, why: `${MAP_PATH} 在 ${face} 面取不到` }
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return { ...JSON.parse(l), line: i + 1 }
      } catch {
        return { bad: true, raw: l, line: i + 1 }
      }
    })
  // 表读到而**一行没有** 与 表根本没读到 是两件事,但对段级三维同判:都不许记绿(§0.3)。
  return { rows, unreadable: rows.length === 0, why: rows.length === 0 ? `${MAP_PATH} 是空表` : '' }
}

/** 兼容出口(签名与返回类型不变):下游 check-web-rn-parity / probe-web-rn-gap 拿的一直是数组 */
function loadMap(face = FACE) {
  return loadMapDetailed(face).rows
}

/** 登记表 × web 路由集 → 四桶(aligned/excluded/gap/unmapped)+ 段级豁免命中 + 登记腐烂清单(纯函数)。
 * 抽出来(2026-10-26)是为了让下游探针 `probe-web-rn-gap.mjs` 复用同一把尺子:「未映射集」的
 * 定义全仓只能有一处(§0.6 单一真相源)。下游若各自按「web 路由 − 已登记」复算,段级豁免
 * 与「逐条优先于段级」这两条规则一改,就会出现「对账尺报 229、探针报 231」的两把尺子,
 * 而那 2 条差额是没有任何一档认领的幽灵缺口。
 */
function evaluateMap(
  webRoutes,
  map,
  rnScreens,
  face,
  portal = collectPortalRoutes(face),
  mapUnreadable = false,
) {
  const webByRoute = new Map(webRoutes.map((r) => [r.route, r]))
  // 登记表可以指向共享屏(真相源)或端内薄壳任一层:屏名去重只服务「候选建议」,
  // 不能让同名的端内屏在归属面被判"不存在"(2026-10-25 实测 UserPublic/LlmSettings/EduShop 三屏误报 ——
  // 共享层有同名屏时 byName 记的是共享层 rel,而登记表写的是端内路径)。
  const rnByRel = new Map()
  for (const s of cov.collectShared(face)) rnByRel.set(s.rel, s)
  const rnList = cov.collectRn(face)
  for (const r of rnList) rnByRel.set(r.file, { rel: r.file, name: r.name })

  const rot = []
  const aligned = []
  const excluded = []
  const judgedGap = []
  const contradicted = []
  const portalRows = []
  const portalUnverified = []
  const prefixRows = []
  // 逐条认领行索引(维一口径的单源,§0.6):台账里该路由的**任何**逐条登记都在册,
  // 不是只有"承认承载"的 aligned/portal 两档 —— 口径原话是"台账对该路由没有任何逐条认领"。
  // 段级维据此只对"一条逐条行都没有"的路由判互斥;已逐条认领的只以 prefixCarriedRowsOverlap 报数。
  const perRowRows = new Map()
  // 维四:同一 web 键落多于一行(2026-10-30 实测 12 组,已折叠清偿;本尺此前不判这一型)。
  // 为什么要判:重复行同时灌进 aligned 与 portal 两个分母(账面 301 与 63 里各有 4 条是同一个键),
  // 而"这条 web 路由到底怎么承载"在台账里出现两种说法 —— 与 AGENTS「一个编号只能有一行当前状态」同型。
  // 修复出口 = 折叠成一行(裁决依据走端点逐字对照,不是"留最新那一行")。
  const linesByWeb = new Map()
  for (const row of map) {
    if (row.bad || !row.web) continue
    linesByWeb.set(row.web, [...(linesByWeb.get(row.web) ?? []), row])
  }
  const duplicateWebKeys = [...linesByWeb.entries()]
    .filter(([, rs]) => rs.length > 1)
    .map(([web, rs]) => ({
      web,
      lines: rs.map((r) => r.line),
      statuses: rs.map((r) => String(r.status)),
      carriers: rs.map((r) => r.rn ?? null),
      // 状态不一 ⇒ 台账对同一路由给了两种互斥答案(比单纯副本更严重)
      conflicting: new Set(rs.map((r) => String(r.status))).size > 1,
    }))
  // 门户承载维:与 web 路由集同面现算(不复制第二份清单,§0.6)。set 为 null = 这一维没读到 ⇒
  // 不改动任何判定,只把「门户维未判定」如实点名;此时既不把 gap 行洗成承载,也不把门户路由从 unmapped 里扣掉。
  const portalCarried = portal.set
    ? new Set(webRoutes.filter((r) => portal.set.has(r.route)).map((r) => r.route))
    : null
  const portalUnmatched = portal.set ? portal.rows.filter((r) => !webByRoute.has(r.route)) : []
  for (const row of map) {
    if (row.bad) {
      rot.push({ line: row.line, why: '非法 JSON 行' })
      continue
    }
    if (!row.web) {
      rot.push({ line: row.line, why: '缺 web 键' })
      continue
    }
    if (row.web.endsWith('/**')) {
      if (row.status !== 'excluded' || !row.reason) {
        rot.push({ line: row.line, why: '段级豁免必须 status=excluded 且带 reason(验过才免)' })
      } else {
        prefixRows.push(row)
      }
      continue
    }
    if (!webByRoute.has(row.web)) {
      rot.push({ line: row.line, why: `web 键不在路由集:${String(row.web)}` })
      continue
    }
    // 逐条登记(任何 status)都算"台账对这一条有逐条判定"(维一口径,§0.6 单一真相源):
    // 收进索引的时机是**键在路由集之后、status 分派之前** —— 这样连被判红摘走的
    // (excluded 缺 reason / aligned 指向不存在的屏 / portal 行门户表查无此 path)
    // 那些也留在索引里,段级维就不会把同一枚冲突再点一次名(逐条维已点过)。
    if (!perRowRows.has(row.web))
      perRowRows.set(row.web, { status: String(row.status ?? ''), line: row.line })
    if (row.status === 'excluded') {
      if (!row.reason) rot.push({ line: row.line, why: 'excluded 缺 reason(验过才免)' })
      else if (portalCarried?.has(row.web)) contradicted.push({ ...row, by: 'excluded' })
      else excluded.push(row)
      continue
    }
    if (row.status === 'aligned') {
      if (!row.rn || !rnByRel.has(row.rn)) {
        rot.push({ line: row.line, why: `aligned 指向的 RN 屏不存在:${String(row.rn)}` })
        continue
      }
      // 指向共享屏时:必须真有 RN 屏以 JSX 渲染它。只判"文件存在"会放过「共享屏在、无人渲染」这一型 ——
      // 本仓把它叫名义对齐:web 路由在 RN 端实际不可达,而账本记为 aligned(2026-10-27 实测 3 条)。
      if (String(row.rn).startsWith('packages/app/src/features/')) {
        const symbol = String(row.rn)
          .split('/')
          .pop()
          .replace(/\.tsx$/, '')
        const rendered = rnList.some((r) => r.file !== row.rn && rendersSharedIn(r.text, symbol))
        if (!rendered) {
          rot.push({
            line: row.line,
            why: `aligned 指向的共享屏没有任何 RN 屏以 JSX 渲染(名义对齐):${String(row.rn)}`,
          })
          continue
        }
      }
      aligned.push(row)
      continue
    }
    // portal = 门户承载行(2026-10-27 立,由 auto-register 的 --converge-portal 档自动改写而来)。
    // 「验过才免」:行在册而门户表里查无此 path ⇒ 台账在给一个不存在的承载背书 ⇒ 点名。
    // 表整个取不到 ⇒ 不冒红也不冒充验过:记未判定,行仍算已处置(不能因量具失效凭空造缺口,§0.3)。
    if (row.status === 'portal') {
      if (portalCarried === null) portalUnverified.push(row)
      else if (!portalCarried.has(row.web))
        rot.push({ line: row.line, why: `portal 行而门户表无此 path(验过才免):${row.web}` })
      else portalRows.push(row)
      continue
    }
    // gap = 判过「RN 该内容域零承载」。证据必填:没有证据的 gap 与"没人判"不可区分。
    // 这一档只减少 unmapped(未判定面),不进 aligned —— 缺口存量仍单独报数,不冒充已对齐。
    if (row.status === 'gap') {
      if (!row.note)
        rot.push({ line: row.line, why: 'gap 缺 note(判过必有证据,否则与未判定不可区分)' })
      // 「RN 零承载」这句判据被门户表推翻:同一路由在 web-portal.ts 里在册,移动端就是按设计用
      // WebView 打开它。这不是"另一种形态承载"的模糊提示,而是台账与仓内登记表互相打脸 ⇒ 单列点名。
      else if (portalCarried?.has(row.web)) contradicted.push({ ...row, by: 'gap' })
      else judgedGap.push(row)
      continue
    }
    rot.push({ line: row.line, why: `未知 status:${String(row.status)}` })
  }

  const mappedRoutes = new Set(
    [...aligned, ...excluded, ...judgedGap, ...portalRows, ...portalUnverified].map((r) => r.web),
  )
  const prefixHits = new Map()
  const prefixExcludedRoutes = new Set()
  for (const p of prefixRows) {
    const scope = prefixScopeOf(p.web) // 'admin/**' → {prefix:'admin/', segRoot:'admin'}
    for (const r of webRoutes) {
      if (mappedRoutes.has(r.route)) continue // 逐条登记优先(更具体的判定赢)
      if (routeInScope(r.route, scope)) {
        prefixExcludedRoutes.add(r.route)
        prefixHits.set(p.web, (prefixHits.get(p.web) ?? 0) + 1)
      }
    }
    if (!prefixHits.has(p.web)) rot.push({ line: p.line, why: `段级豁免命中 0 条路由:${p.web}` })
  }
  // ── 段级豁免三维(2026-10-30 立;判据全在上面这几枚局部变量上,零第二次读面、零复算) ──
  // 逐条认领行索引在上面的主循环里就地收(perRowRows):它是**台账内部**事实 ⇒ 门户表取不到时
  // 这一腿照样判得出;口径 = "台账对这一条有没有逐条登记",任何 status 都算(见 perRowRows 头注)。
  const prefixContradiction = evaluatePrefixContradictions({
    webRoutes,
    prefixRows,
    portalCarried,
    perRowRows,
    mapUnreadable,
  })
  const staleCount = evaluateStaleCounts({
    webRoutes,
    rows: [
      ...prefixRows.map((r) => ({ ...r, kind: 'prefix' })),
      ...excluded.map((r) => ({ ...r, kind: 'row' })),
    ],
  })
  // missingExpiry 的射程刻意只有段级行(现读 10 枚);逐条 excluded(现读 90 枚)一枚没挂过期日,
  // 判它 = 恒红门(§12e)⇒ 只以 missingExpiryPerRowStock 报数,不点名、不进任何判红面。
  const missingExpiry = evaluateMissingExpiry(prefixRows)
  const missingExpiryPerRowStock = excluded.filter((r) => expiryOf(r) === null).length
  const unmapped = webRoutes.filter(
    (r) =>
      !mappedRoutes.has(r.route) &&
      !prefixExcludedRoutes.has(r.route) &&
      !portalCarried?.has(r.route),
  )
  // aligned 档按 **web 键**去重后的枚数(2026-10-30 立;下游漂移哨兵比的是"承载面",不是"台账行数"):
  // 台账里同一 web 键可能落两行(维四),按行数比会把"折叠重复行"读成"RN 承载被拆" ⇒ 假告警
  // (现读 HEAD 面:aligned 行数 301 / 去重 293,差 8 枚全在 8 组同键重复 aligned 上)。
  // 去重只此一份(§0.6):哨兵只读本键,不许在那边再实现一遍去重(第二份必然漂移)。
  const alignedUnique = new Set(aligned.map((r) => r.web)).size
  return {
    aligned,
    alignedUnique,
    excluded,
    judgedGap,
    contradicted,
    portalCarried,
    portalUnmatched,
    portalRows,
    portalUnverified,
    portalUndetermined: portal.unreadable,
    rot,
    prefixHits,
    prefixRows,
    prefixExcludedRoutes,
    unmapped,
    rnScreens,
    // 段级豁免三维(2026-10-30 立,键为新增 ⇒ 下游按 undefined 兼容旧版)
    prefixContradiction,
    staleCount,
    missingExpiry,
    missingExpiryPerRowStock,
    duplicateWebKeys,
    mapUnreadable,
  }
}

/** web 侧栏入口(nav-data.ts 的 href)↔ 台账档位 → 入口级可达性(2026-10-27 立)。
 * 为什么要有这一维:本尺此前只按 **web 路由文件是否存在** 分档,而"功能不差"的用户口径是
 * **侧栏能不能点开**。现读:203 条去重入口里 13 条落在 gap 档(web 能点、台账判 RN 零承载)、
 * 6 条(messages/* 通知中心子页)台账根本没记录 —— 这 19 条此前既不进缺口、也不进未映射,
 * 叫任何人去补都补不到,因为它根本没被任何一档认领。
 * 解析口径:只认字面量 href(以 / 开头、不含 ${}/占位),档位标记(adminOnly/advancedOnly)取
 * **本行起 5 行窗口** —— 导航项是多行对象,只看本行会把 `href: '/x',\n adminOnly: true` 读成普通项。
 * 门户表取不到 ⇒ 整维未判定(§0.3):不能把"本该由门户承载的入口"凭空算成 unrecorded 缺口。
 */
function collectNavEntries(face) {
  const text = cov.faceRead(face, NAV_REL)
  if (typeof text !== 'string') return null
  const lines = text.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = /href:\s*'([^']+)'/.exec(lines[i])
    if (!m) continue
    const href = m[1]
    if (!href.startsWith('/') || href.includes('$') || href.includes('*')) continue
    const win = lines.slice(i, Math.min(lines.length, i + 5)).join('\n')
    out.push({
      route: href.replace(/^\/+/, '').replace(/\/+$/, '') || '(root)',
      href,
      admin: /adminOnly:\s*true|permission:\s*'[^']*admin/i.test(win),
      advanced: /advancedOnly:\s*true/.test(win),
    })
  }
  const byRoute = new Map()
  for (const e of out) byRoute.set(e.route, e)
  return { parsed: out.length, entries: [...byRoute.values()] }
}

/** 纯函数:入口集 × evaluateMap 的分档结果 → 六桶 + 两张点名清单。
 * routeKeys(枚举到的 web 路由)用于**动态段归并**:侧栏写的是 `/messages/notice` 这类具体值,
 * 而路由与台账记的是 `messages/[type]` 这一条(现读:该档在册 aligned → MessageCenterScreen.tsx)。
 * 不做这一步就会把"已承载的入口"报成"无人认领的缺口"—— 本维第一版就这么假阳了 6 条,
 * 所以这一段配了阳性对照(T14),而不是等下一个人再被骗一次。
 */
function evaluateNav(nav, ev, routeKeys = []) {
  if (!nav) return { undetermined: true, why: `${NAV_REL} 取不到 ⇒ 入口维未判定` }
  if (ev.portalCarried === null)
    return { undetermined: true, why: `门户表取不到 ⇒ 入口维未判定(不得把门户入口算成 unrecorded)` }
  const patterns = routeKeys
    .filter((r) => r.includes('['))
    .map((r) => ({ key: r, re: new RegExp('^' + r.replace(/\[([^\]]+)\]/g, '[^/]+') + '$') }))
  const resolve = (route) => {
    const hit = patterns.find((p) => p.re.test(route))
    return hit ? { key: hit.key, via: hit.key } : { key: route, via: null }
  }
  const aligned = new Set(ev.aligned.map((r) => r.web))
  const excluded = new Set(ev.excluded.map((r) => r.web))
  const gap = new Set(ev.judgedGap.map((r) => r.web))
  // 段级豁免的射程一律走 prefixScopeOf + routeInScope(§0.6 单源):此前这里是 `web.slice(0,-3)` 再
  // startsWith('developer'),而 prefixHits 走 startsWith('developer/') —— 两种写法在现读路由集上
  // 差一条 `developers`(它另有逐条 excluded 行 ⇒ 账面恰好看不出来)。射程只留一把,防止下次
  // 出现"入口级说被段级豁免、路由级说不在射程"的幽灵差额。
  const prefixes = ev.prefixRows.map((r) => prefixScopeOf(r.web))
  const counts = { aligned: 0, portal: 0, excluded: 0, prefixExcluded: 0, gap: 0, unrecorded: 0 }
  // byRoute:入口 → 桶名。下游(分诊探针)必须按这张表判"是不是侧栏入口",
  // 不得自己再判一次字面量归属 —— 那样就会出现"尺子说入口级缺口 11、探针说 13"的两把尺子,
  // 而差额(动态段归并的那两条)没有任何一档认领。
  const byRoute = new Map()
  const gapItems = []
  const unrecordedItems = []
  let viaPattern = 0
  for (const e of nav.entries) {
    const { key, via } = resolve(e.route)
    if (via) viaPattern++
    const tag = `${e.route}${e.admin ? '[admin]' : ''}${e.advanced ? '[advanced]' : ''}${via ? ` → ${via}` : ''}`
    let label
    if (aligned.has(key)) label = 'aligned'
    else if (gap.has(key)) label = 'gap'
    else if (excluded.has(key)) label = 'excluded'
    else if (ev.portalCarried.has(key) || ev.portalCarried.has(e.route)) label = 'portal'
    else if (prefixes.some((scope) => routeInScope(key, scope))) label = 'prefixExcluded'
    else label = 'unrecorded'
    counts[label]++
    byRoute.set(e.route, label)
    if (label === 'gap') gapItems.push(tag)
    else if (label === 'unrecorded') unrecordedItems.push(tag)
  }
  return {
    undetermined: false,
    counts,
    byRoute,
    gapItems,
    unrecordedItems,
    viaPattern,
    total: nav.entries.length,
    parsed: nav.parsed,
  }
}

function renderContradictedOf(gapCandidates) {
  // 三条同时成立才入队:同名(exact)∧ 已被某 RN 屏以 JSX 渲染(covered)∧ 承载体确在共享层。
  // 层位这一条收进判据而不是信调用方:workShape 是上游标的,判据若依赖它自觉,
  // 一张写错的表就能把端内屏说成"共享真相源已被渲染"。
  const SHARED = 'packages/app/src/features/'
  const hit = (c) => c.exact && c.workShape === 'covered' && String(c.rel).startsWith(SHARED)
  return gapCandidates
    .filter((g) => g.candidates.some(hit))
    .map((g) => ({
      web: g.web,
      renderers: g.candidates.filter(hit).map((c) => `${c.name}(${c.rel})`),
    }))
}

function run() {
  const webRoutes = collectWebRoutes(FACE)
  const rnScreens = collectRnScreens(FACE)
  // gap 候选的工作形态要问"有没有 RN 屏真的渲染它" ⇒ 取一次正文(同面,§0.4)
  const rnTexts = cov.collectRn(FACE)
  if (webRoutes.length === 0 || rnScreens.length === 0) {
    console.error(
      `❌ 未判定:取不到被审面(web 路由 ${webRoutes.length} / RN 屏 ${rnScreens.length}),不记绿也不冒红`,
    )
    process.exit(2)
  }
  const mapDetail = loadMapDetailed(FACE)
  const portal = collectPortalRoutes(FACE)
  // 未映射集的判据只有一处(§0.6):抽出来的 evaluateMap 同时供本尺与探针 probe-web-rn-gap 使用,
  // 保证「对账尺报多少条,探针就分诊多少条」永远相等。
  const ev = evaluateMap(webRoutes, mapDetail.rows, rnScreens, FACE, portal, mapDetail.unreadable)
  const {
    aligned,
    alignedUnique,
    excluded,
    judgedGap,
    contradicted,
    portalRows,
    portalUnverified,
    portalCarried,
    portalUnmatched,
    portalUndetermined,
    rot,
    prefixHits,
    prefixRows,
    unmapped,
    prefixContradiction,
    staleCount,
    missingExpiry,
    missingExpiryPerRowStock,
    duplicateWebKeys,
  } = ev
  const prefixExcluded = prefixHits.size
  const usedRn = new Set(aligned.map((r) => r.rn))
  const rnOnly = rnScreens.filter((s) => !usedRn.has(s.rel))

  const navEval = evaluateNav(
    collectNavEntries(FACE),
    ev,
    webRoutes.map((r) => r.route),
  )
  const byFirstSeg = new Map()
  for (const r of unmapped) {
    const k = r.route.split('/')[0] ?? '(root)'
    byFirstSeg.set(k, (byFirstSeg.get(k) ?? 0) + 1)
  }
  const segRows = [...byFirstSeg.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const json = {
    face: FACE,
    webRoutes: webRoutes.length,
    rnScreens: rnScreens.length,
    shared: rnScreens.filter((s) => s.layer === 'shared').length,
    rnAppOnly: rnScreens.filter((s) => s.layer === 'rn-app').length,
    aligned: aligned.length,
    // aligned 档按 web 键去重后的枚数(2026-10-30 立;键为新增 ⇒ 既有键名与类型一个未动):
    // `aligned` 是**台账行数**,`alignedUnique` 是**承载面(web 键组)枚数**。台账折叠同键重复行时
    // 行数会掉而承载面不变,按行数比会把"折叠重复行"读成"RN 承载被拆" ⇒ 假告警(现读 HEAD 面
    // 行数 301 / 去重 293,差 8 枚全在 8 组同键重复 aligned 上)。下游比承载面请读本键,
    // 不许在下游自己再实现一遍去重(§0.6 单一真相源:去重只此一份)。
    alignedUnique,
    excluded: excluded.length,
    judgedGap: judgedGap.length,
    contradicted: contradicted.length,
    portalRows: portalRows.length,
    portalUnverified: portalUnverified.length,
    nav: navEval,
    contradictedRows: contradicted.map((r) => ({ web: r.web, by: r.by })),
    portalCarried: portalCarried ? portalCarried.size : null,
    portalUndetermined,
    portalUnmatched: portalUnmatched.map((r) => r.raw),
    prefixExcluded,
    prefixHits: [...prefixHits.entries()],
    // ── 段级豁免三维(2026-10-30 立;下面五个键都是新增,既有键名与类型一个未动) ──
    // 数组 ⇒ 逐条点名;Undetermined 数组非空 = 这一维有腿没判到,不得读成"零冲突即已验过"。
    prefixContradicted: prefixContradiction.items,
    prefixContradictedUndetermined: prefixContradiction.undetermined,
    // 只报数:台账已逐条认领、又落在段级豁免射程内的重叠(更具体的判定赢 ⇒ 不判红,措辞归人裁)
    prefixCarriedRowsOverlap: prefixContradiction.overlaps,
    staleCountAssertions: staleCount.items,
    missingExpiry: missingExpiry.items,
    missingExpiryUndetermined: missingExpiry.undetermined,
    missingExpiryPerRowStock,
    duplicateWebKeys: duplicateWebKeys.length,
    duplicateWebKeyItems: duplicateWebKeys,
    mapUnreadable: mapDetail.unreadable,
    mapUnreadableWhy: mapDetail.why,
    unmapped: unmapped.length,
    rnOnly: rnOnly.length,
    rot,
    unmappedBySegment: segRows,
    suggestions: unmapped
      .slice(0, fullMode ? unmapped.length : Math.min(unmapped.length, 40))
      .map((r) => ({
        web: r.route,
        candidates: suggestCandidates(r.route, rnScreens, topN),
      })),
    // gap 行的同名候选(只提示,不改判定):72 条「RN 零承载」里混着一批"RN 以另一种形态内联承载"
    // (实测 news/category/[id] 的分类切换就在 NewsScreen 内联),逐条翻代码太贵 ⇒ 先把候选排成队列。
    // 每条候选再标工作形态(决定成本,也是"最大化减少开发"的判据):
    //   host-only  = 共享屏已在、没有任何 RN 屏渲染它 ⇒ 只补一个薄宿主(零 UI 开发)
    //   covered    = 共享屏已在且已有 RN 屏渲染它 ⇒ 疑似"已被承载",优先做语义核对(可能是记账错)
    //   other      = 不在共享层或形态不明
    gapCandidates: judgedGap
      .map((r) => ({
        web: r.web,
        candidates: suggestCandidates(r.web, rnScreens, topN).map((c) => {
          const isShared = String(c.rel).startsWith('packages/app/src/features/')
          const hasRenderer =
            isShared && rnTexts.some((t) => t.file !== c.rel && rendersSharedIn(t.text, c.name))
          const workShape = !isShared ? 'other' : hasRenderer ? 'covered' : 'host-only'
          return { ...c, workShape }
        }),
      }))
      .filter((x) => x.candidates.length > 0),
  }
  // 渲染推翻候选(2026-10-27 立,**只点名不改判**):gap 行的同名共享屏确有一枚 RN 屏以 JSX 渲染它。
  // 为什么只点名:同名 ≠ 同物 —— 现读 `edu/edu-management/study-plan` 是教职侧页面,而 RN 渲染的
  // StudyPlanScreen 走学生侧数据;自动翻案会把两条不同语义的东西并成一条,那比留着当缺口更坏。
  // 但"判过 RN 零承载"与"同名共享屏已被 RN 真渲染"是互斥的两句话,必须排成一条**可复核队列**
  // 交人裁,而不是让下一个人重新逐屏翻代码(判据只这一处 §0.6;翻案权归人,本尺不代裁)。
  json.renderContradicted = renderContradictedOf(json.gapCandidates)

  // 段级三维的输入有一枚取不到 ⇒ 整尺按「未判定」退 2:报告照常产出(--json 仍是完整可解析的 JSON,
  // check-cross-end-parity-drift 的 runRuler 走 status 档读它),但进程不把"瞎了"写成"跑完且无冲突"。
  // 枚举到 0 个候选不记绿:走 undetermined 键点名,不退 2(那是"没东西可验",不是"取不到量具")。
  const unjudged = []
  if (mapDetail.unreadable) unjudged.push(mapDetail.why || `${MAP_PATH} 取不到`)
  if (portal.unreadable) unjudged.push(`${WEB_PORTAL_REL} 取不到`)

  if (jsonMode) {
    console.log(JSON.stringify(json, null, 2))
    if (unjudged.length > 0) {
      console.error(
        `❌ 未判定:段级豁免三维的输入取不到 ⇒ ${unjudged.join(' + ')}(不记绿也不冒红,§0.3)`,
      )
      process.exit(2)
    }
    return
  }

  log(
    `判定面            : ${FACE === 'head' ? 'HEAD blob' : FACE === 'staged' ? '索引 blob' : '工作树(人工逃生舱)'}`,
  )
  log(`web 路由(剥语言镜像): ${webRoutes.length}`)
  log(
    `RN 屏              : ${rnScreens.length}(共享屏真相源 ${json.shared} + 端内独有 ${json.rnAppOnly})`,
  )
  log(
    `已对齐(aligned)   : ${json.aligned}(台账行数) / ${json.alignedUnique}(去重 web 键 = 承载面)` +
      `  ← 台账折叠同键重复行时行数会掉而承载面不变,比承载面请读去重数`,
  )
  log(
    `已豁免(excluded)  : ${json.excluded}(逐条) + ${json.prefixExcluded}(段级 ${prefixRows.length} 个前缀)`,
  )
  log(`已判缺口(gap)     : ${json.judgedGap}  ← 判过「RN 零承载」,不再重复判定`)
  log(
    `门户承载(web-portal): ${portalCarried === null ? '未判定(取不到 ' + WEB_PORTAL_REL + ')' : json.portalCarried}` +
      `  ← 移动端按设计用 WebView 打开的 web 路由,唯一源 ${WEB_PORTAL_REL}`,
  )
  log(
    `在册 portal 行      : ${json.portalRows}(门户表验过)+ ${json.portalUnverified}(表取不到⇒未判定,不冒充验过)`,
  )
  if (portalCarried !== null && contradicted.length > 0) {
    const nGap = contradicted.filter((r) => r.by === 'gap').length
    const nExc = contradicted.length - nGap
    log(
      `⚠ 被门户表推翻的在册判定: ${contradicted.length}(gap ${nGap} / excluded ${nExc})` +
        `  ← 台账说「RN 零承载/不承载」而门户表说承载,两句互斥;摘行或改判都由人裁,本尺不代裁`,
    )
    for (const r of contradicted.slice(0, fullMode ? contradicted.length : 12)) {
      log(`     · ${r.web}(在册 ${r.by})`)
    }
  }
  if (portalCarried !== null && portalUnmatched.length > 0) {
    log(
      `⚠ 门户表指向不在路由集的 path: ${portalUnmatched.length} 条` +
        `  ← RN 会打开一个 web 端没有的 URL,这类是"门户腿自己腐烂",不是覆盖缺口`,
    )
    for (const r of portalUnmatched.slice(0, fullMode ? portalUnmatched.length : 12)) {
      log(`     · ${r.raw} → ${r.route}`)
    }
  }
  // ── 段级豁免三维报告(2026-10-30 立) ──
  if (prefixContradiction.undetermined.length > 0) {
    for (const u of prefixContradiction.undetermined) log(`⚠ 段级互斥维未判定 —— ${u}(不记绿,§0.3)`)
  }
  if (prefixContradiction.items.length > 0) {
    const byPrefix = new Map()
    for (const it of prefixContradiction.items)
      byPrefix.set(it.prefix, (byPrefix.get(it.prefix) ?? 0) + 1)
    log(
      `⚠ 被推翻的段级豁免: ${prefixContradiction.items.length} 条路由落在 ${byPrefix.size} 枚段级豁免的射程内` +
        `，门户表说它们**确实由 WebView 承载**、而台账对这一条没有任何逐条认领 ——` +
        ` 上一格 contradicted=${contradicted.length} 只数逐条行,段级面此前是盲绿的那一格`,
    )
    for (const [p, n] of [...byPrefix.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    ))
      log(`     · ${p} ⇒ ${n} 条`)
    for (const it of prefixContradiction.items.slice(0, fullMode ? undefined : 20))
      log(`        - ${it.route}  ← ${it.sources.join(' + ')}`)
    if (!fullMode && prefixContradiction.items.length > 20)
      log(`        …其余 ${prefixContradiction.items.length - 20} 条见 --full / --json`)
    log(
      `        出路:给这些路由逐条补 status:"portal" 行(台账承认承载),段级豁免即只覆盖其余;` +
        `不补就别让段级 reason 写"不承载"`,
    )
  } else if (prefixContradiction.undetermined.length === 0) {
    log(
      `段级互斥          : 0 条(已把 ${prefixRows.length} 枚段级豁免的射程全集逐条问过门户表;` +
        `台账已逐条认领的 ${prefixContradiction.overlaps.length} 条按"更具体的判定赢"不计互斥,只以 ` +
        `prefixCarriedRowsOverlap 报数 ⇒ 这一格判过,不是没判)`,
    )
  }
  if (staleCount.items.length > 0) {
    log(
      `⚠ 豁免行 reason 自述计数 ≠ 现读: ${staleCount.items.length} 条` +
        `  ← 台账里的数字与它自己声称覆盖的那一片路由脱了节(只点名,改数还是改射程由人裁)`,
    )
    for (const it of staleCount.items)
      log(
        `     · ${it.web}(L${it.line},${it.kind})自述「${it.raw}」= ${it.asserted}` +
          ` · 现读命中 ${it.present}${it.unit === '段' ? ' 段' : ' 条路由'}`,
      )
  }
  if (missingExpiry.undetermined.length > 0) {
    for (const u of missingExpiry.undetermined) log(`⚠ 存活期维未判定 —— ${u}(不记绿,§0.3)`)
  } else {
    log(
      `段级豁免存活期     : ${prefixRows.length} 枚在册,缺/坏/已到期 ${missingExpiry.items.length} 枚` +
        `  ← §0.7 豁免必须会到期;逐条 excluded 的缺期存量 ${missingExpiryPerRowStock} 枚**只报数不判**(§12e 恒红门禁令)`,
    )
    for (const it of missingExpiry.items)
      log(`     · ${it.web}(L${it.line})${it.why}${it.field ? ` ${it.field}=${it.value}` : ''}`)
  }
  log(`重复 web 键        : ${duplicateWebKeys.length} 组` +
    `  ← 同一键多行 = aligned/portal 两个分母同时灌水,且"这条路由怎么承载"出现两种说法` +
    `(全表口径,**不分 status**;折算 aligned 请读上面的 alignedUnique,别拿这一把折算)` +
    `${duplicateWebKeys.length ? ';互斥(状态不一)的:' + duplicateWebKeys.filter((d) => d.conflicting).length + ' 组' : ''}`)
  for (const d of duplicateWebKeys)
    log(
      `     · ${d.web} ⇒ L${d.lines.join(',L')} 状态 ${d.statuses.join('/')} 载体 ${d.carriers.join('/')} ` +
        `${d.conflicting ? '【互斥,须按端点逐字对照裁一行】' : '【同状态副本,折叠成一行】'}`,
    )
  log(`未映射 web 路由    : ${json.unmapped}  ← 功能缺口候选(**无人判过**;逐屏登记后收敛)`)
  log(`RN 独有屏         : ${json.rnOnly}`)
  // 入口级可达性:分母是"用户在 web 侧栏真能点开的项",不是"路由文件存在"。
  log('')
  if (navEval.undetermined) {
    log(
      `入口可达性(web 侧栏) : 未判定 —— ${navEval.why}(不把没读到算成零缺口,也不把门户入口算成缺口)`,
    )
  } else {
    const c = navEval.counts
    log(
      `入口可达性(web 侧栏) : ${navEval.total} 条去重入口(解析 ${navEval.parsed})` +
        ` ⇒ 已承载 ${c.aligned} / 门户 ${c.portal} / 豁免 ${c.excluded} / 段级豁免 ${c.prefixExcluded}` +
        ` / **入口级缺口 ${c.gap}** / **台账无记录 ${c.unrecorded}**` +
        `  (其中 ${navEval.viaPattern} 条经动态段归并归类,如 messages/notice → messages/[type])`,
    )
    if (c.gap > 0) {
      log(
        `  ⚠ 入口级缺口:这些项 web 侧栏一点就开,而台账判过「RN 零承载」——用户视角的"RN 功能差在这里"`,
      )
      for (const g of navEval.gapItems.slice(0, fullMode ? navEval.gapItems.length : 20))
        log(`     · ${g}`)
    }
    if (c.unrecorded > 0) {
      log(
        `  ⚠ 台账无记录:既不在承载/门户/豁免任一档,也没进未映射(路由文件可能就不是 page.tsx 形态)`,
      )
      for (const u of navEval.unrecordedItems.slice(
        0,
        fullMode ? navEval.unrecordedItems.length : 20,
      ))
        log(`     · ${u}`)
    }
  }
  log('')
  log('未映射按首段分组(前 25):')
  for (const [seg, n] of segRows.slice(0, 25)) log(`  ${String(n).padStart(4)}  ${seg}`)
  log('')
  log(`启发式候选建议(前 ${json.suggestions.length} 条,仅建议不判定):`)
  for (const s of json.suggestions) {
    const c =
      s.candidates
        .map((x) => `${x.exact ? '[同名] ' : ''}${x.name}(${x.hit.join('+')})`)
        .join(' | ') || '—'
    log(`  ${s.web}  →  ${c}`)
  }
  if (json.gapCandidates.length > 0) {
    const shapes = json.gapCandidates.flatMap((g) => g.candidates.map((c) => c.workShape))
    const nHost = shapes.filter((s) => s === 'host-only').length
    const nCovered = shapes.filter((s) => s === 'covered').length
    log('')
    log(
      `gap 待复核(同名候选,只提示不改判定): ${json.gapCandidates.length}/${json.judgedGap} 条` +
        ` · 候选形态 host-only ${nHost} / covered ${nCovered}`,
    )
    for (const g of json.gapCandidates.slice(0, fullMode ? undefined : 20)) {
      const c = g.candidates
        .map(
          (x) =>
            `${x.workShape === 'host-only' ? '[宿主] ' : x.workShape === 'covered' ? '[已渲染] ' : ''}${x.exact ? '[同名] ' : ''}${x.name}(${x.rel})`,
        )
        .join(' | ')
      log(`  ${g.web}  →  ${c}`)
    }
  }
  if (json.renderContradicted.length > 0) {
    log('')
    log(
      `⚠ 渲染推翻候选(交人复核,本尺不翻案): ${json.renderContradicted.length} 条 gap 行` +
        ` 的同名共享屏确被某 RN 屏以 JSX 渲染 —— 同名不等于同物(侧别/数据源可能不同),` +
        `但"零承载"与"已渲染"两句互斥,必须逐条语义核对`,
    )
    for (const g of json.renderContradicted.slice(0, fullMode ? undefined : 20))
      log(`     · ${g.web}  →  ${g.renderers.join(', ')}`)
  }
  if (rot.length > 0) {
    log('')
    log('⚠ 登记腐烂(逐条点名):')
    for (const r of rot) log(`  L${r.line} ${r.why}`)
  }
  if (unjudged.length > 0) {
    console.error(
      `❌ 未判定:段级豁免三维的输入取不到 ⇒ ${unjudged.join(' + ')}(不记绿也不冒红,§0.3)`,
    )
    process.exit(2)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  run()
}

export const __test__ = {
  collectWebRoutes,
  collectRnScreens,
  collectPortalRoutes,
  portalRouteShapesFrom,
  collectNavEntries,
  evaluateNav,
  renderContradictedOf,
  screenTokens,
  routeTokens,
  suggestCandidates,
  loadMap,
  loadMapDetailed,
  evaluateMap,
  LANG_SEGS,
  WEB_PORTAL_REL,
  MAP_PATH,
  // 段级豁免三维(2026-10-30 立):纯判据一律 export,镜像直接 import 这一份,禁止在测试里复算(§22c)。
  prefixScopeOf,
  routeInScope,
  routesUnderPrefix,
  subSegmentsUnderPrefix,
  cnNumberToInt,
  countAssertionsOf,
  evaluatePrefixContradictions,
  evaluateStaleCounts,
  evaluateMissingExpiry,
  expiryOf,
  EXPIRY_FIELDS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
