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
// 取材面纪律(§0.4):默认 HEAD blob;--staged 判索引;--worktree 仅人工逃生舱;两面旗同给 exit 2。
// 枚举/读面复用 check-cross-end-screen-coverage 的 faceList/faceRead/collectShared/collectRn(§0.6 单一真相源,
// 本文件零复算)。RN 功能面 = 共享屏(packages/app/src/features/**/*Screen.tsx,真相源)+ RN 端内屏
// (apps/mobile-rn/src/screens/*.tsx);95.7% 端内屏委托共享层,故两端去重按「屏名」。
//
// 定级:只读报告器,exit 0(取不到面 ⇒ exit 2「未判定」)。差距归零是 goal 的事,不是本尺的事;
// 挂提交链 = 恒红门(§12e),与 check-temp-landing / check-dispatch-premise 同列只读尺子。
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
const log = (...a) => { if (!jsonMode) console.log(...a) }

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
  return { set: new Set(rows.map((r) => r.route)), rows, unreadable: false }
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
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.hit.length - a.hit.length || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** 读登记表(jsonl,逐行 JSON;与被审面同面同轮取(门 118 取材面纪律);取不到 ⇒ null = 未判定,不用空表冒充) */
function loadMap(face = FACE) {
  const text = cov.faceRead(face, MAP_PATH)
  try {
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
    return rows
  } catch {
    return []
  }
}

/** 登记表 × web 路由集 → 四桶(aligned/excluded/gap/unmapped)+ 段级豁免命中 + 登记腐烂清单(纯函数)。
 * 抽出来(2026-10-26)是为了让下游探针 `probe-web-rn-gap.mjs` 复用同一把尺子:「未映射集」的
 * 定义全仓只能有一处(§0.6 单一真相源)。下游若各自按「web 路由 − 已登记」复算,段级豁免
 * 与「逐条优先于段级」这两条规则一改,就会出现「对账尺报 229、探针报 231」的两把尺子,
 * 而那 2 条差额是没有任何一档认领的幽灵缺口。
 */
function evaluateMap(webRoutes, map, rnScreens, face, portal = collectPortalRoutes(face)) {
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
        const symbol = String(row.rn).split('/').pop().replace(/\.tsx$/, '')
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
      if (!row.note) rot.push({ line: row.line, why: 'gap 缺 note(判过必有证据,否则与未判定不可区分)' })
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
    const prefix = p.web.slice(0, -2) // 'admin/**' → 'admin/'
    const segRoot = prefix.slice(0, -1) // 'admin'(段首页本身也归该段)
    for (const r of webRoutes) {
      if (mappedRoutes.has(r.route)) continue // 逐条登记优先(更具体的判定赢)
      if (r.route === segRoot || r.route.startsWith(prefix)) {
        prefixExcludedRoutes.add(r.route)
        prefixHits.set(p.web, (prefixHits.get(p.web) ?? 0) + 1)
      }
    }
    if (!prefixHits.has(p.web)) rot.push({ line: p.line, why: `段级豁免命中 0 条路由:${p.web}` })
  }
  const unmapped = webRoutes.filter(
    (r) =>
      !mappedRoutes.has(r.route) && !prefixExcludedRoutes.has(r.route) && !portalCarried?.has(r.route),
  )
  return {
    aligned,
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

/** 纯函数:入口集 × evaluateMap 的分档结果 → 六桶 + 两张点名清单。 */
function evaluateNav(nav, ev) {
  if (!nav) return { undetermined: true, why: `${NAV_REL} 取不到 ⇒ 入口维未判定` }
  if (ev.portalCarried === null)
    return { undetermined: true, why: `门户表取不到 ⇒ 入口维未判定(不得把门户入口算成 unrecorded)` }
  const aligned = new Set(ev.aligned.map((r) => r.web))
  const excluded = new Set(ev.excluded.map((r) => r.web))
  const gap = new Set(ev.judgedGap.map((r) => r.web))
  const prefixes = ev.prefixRows.map((r) => r.web.slice(0, -3))
  const counts = { aligned: 0, portal: 0, excluded: 0, prefixExcluded: 0, gap: 0, unrecorded: 0 }
  const gapItems = []
  const unrecordedItems = []
  for (const e of nav.entries) {
    const tag = `${e.route}${e.admin ? '[admin]' : ''}${e.advanced ? '[advanced]' : ''}`
    if (aligned.has(e.route)) counts.aligned++
    else if (gap.has(e.route)) {
      counts.gap++
      gapItems.push(tag)
    } else if (excluded.has(e.route)) counts.excluded++
    else if (ev.portalCarried.has(e.route)) counts.portal++
    else if (prefixes.some((pre) => e.route === pre.replace(/\/$/, '') || e.route.startsWith(pre)))
      counts.prefixExcluded++
    else {
      counts.unrecorded++
      unrecordedItems.push(tag)
    }
  }
  return { undetermined: false, counts, gapItems, unrecordedItems, total: nav.entries.length, parsed: nav.parsed }
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
  const map = loadMap()
  // 未映射集的判据只有一处(§0.6):抽出来的 evaluateMap 同时供本尺与探针 probe-web-rn-gap 使用,
  // 保证「对账尺报多少条,探针就分诊多少条」永远相等。
  const ev = evaluateMap(webRoutes, map, rnScreens, FACE)
  const {
    aligned,
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
  } = ev
  const prefixExcluded = prefixHits.size
  const usedRn = new Set(aligned.map((r) => r.rn))
  const rnOnly = rnScreens.filter((s) => !usedRn.has(s.rel))

  const navEval = evaluateNav(collectNavEntries(FACE), ev)
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
  if (jsonMode) {
    console.log(JSON.stringify(json, null, 2))
    return
  }

  log(`判定面            : ${FACE === 'head' ? 'HEAD blob' : FACE === 'staged' ? '索引 blob' : '工作树(人工逃生舱)'}`)
  log(`web 路由(剥语言镜像): ${webRoutes.length}`)
  log(`RN 屏              : ${rnScreens.length}(共享屏真相源 ${json.shared} + 端内独有 ${json.rnAppOnly})`)
  log(`已对齐(aligned)   : ${json.aligned}`)
  log(`已豁免(excluded)  : ${json.excluded}(逐条) + ${json.prefixExcluded}(段级 ${prefixRows.length} 个前缀)`)
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
  log(`未映射 web 路由    : ${json.unmapped}  ← 功能缺口候选(**无人判过**;逐屏登记后收敛)`)
  log(`RN 独有屏         : ${json.rnOnly}`)
  // 入口级可达性:分母是"用户在 web 侧栏真能点开的项",不是"路由文件存在"。
  log('')
  if (navEval.undetermined) {
    log(`入口可达性(web 侧栏) : 未判定 —— ${navEval.why}(不把没读到算成零缺口,也不把门户入口算成缺口)`)
  } else {
    const c = navEval.counts
    log(
      `入口可达性(web 侧栏) : ${navEval.total} 条去重入口(解析 ${navEval.parsed})` +
        ` ⇒ 已承载 ${c.aligned} / 门户 ${c.portal} / 豁免 ${c.excluded} / 段级豁免 ${c.prefixExcluded}` +
        ` / **入口级缺口 ${c.gap}** / **台账无记录 ${c.unrecorded}**`,
    )
    if (c.gap > 0) {
      log(`  ⚠ 入口级缺口:这些项 web 侧栏一点就开,而台账判过「RN 零承载」——用户视角的"RN 功能差在这里"`)
      for (const g of navEval.gapItems.slice(0, fullMode ? navEval.gapItems.length : 20)) log(`     · ${g}`)
    }
    if (c.unrecorded > 0) {
      log(`  ⚠ 台账无记录:既不在承载/门户/豁免任一档,也没进未映射(路由文件可能就不是 page.tsx 形态)`)
      for (const u of navEval.unrecordedItems.slice(0, fullMode ? navEval.unrecordedItems.length : 20))
        log(`     · ${u}`)
    }
  }
  log('')
  log('未映射按首段分组(前 25):')
  for (const [seg, n] of segRows.slice(0, 25)) log(`  ${String(n).padStart(4)}  ${seg}`)
  log('')
  log(`启发式候选建议(前 ${json.suggestions.length} 条,仅建议不判定):`)
  for (const s of json.suggestions) {
    const c = s.candidates.map((x) => `${x.exact ? '[同名] ' : ''}${x.name}(${x.hit.join('+')})`).join(' | ') || '—'
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
        .map((x) => `${x.workShape === 'host-only' ? '[宿主] ' : x.workShape === 'covered' ? '[已渲染] ' : ''}${x.exact ? '[同名] ' : ''}${x.name}(${x.rel})`)
        .join(' | ')
      log(`  ${g.web}  →  ${c}`)
    }
  }
  if (rot.length > 0) {
    log('')
    log('⚠ 登记腐烂(逐条点名):')
    for (const r of rot) log(`  L${r.line} ${r.why}`)
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
  collectNavEntries,
  evaluateNav,
  screenTokens,
  routeTokens,
  suggestCandidates,
  loadMap,
  evaluateMap,
  LANG_SEGS,
  WEB_PORTAL_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
