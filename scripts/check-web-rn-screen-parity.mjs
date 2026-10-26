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

const MAP_PATH = 'scripts/data/web-rn-screen-map.jsonl'
const WEB_APP_DIR = 'apps/web/app'

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
function evaluateMap(webRoutes, map, rnScreens, face) {
  const webByRoute = new Map(webRoutes.map((r) => [r.route, r]))
  // 登记表可以指向共享屏(真相源)或端内薄壳任一层:屏名去重只服务「候选建议」,
  // 不能让同名的端内屏在归属面被判"不存在"(2026-10-25 实测 UserPublic/LlmSettings/EduShop 三屏误报 ——
  // 共享层有同名屏时 byName 记的是共享层 rel,而登记表写的是端内路径)。
  const rnByRel = new Map()
  for (const s of cov.collectShared(face)) rnByRel.set(s.rel, s)
  for (const r of cov.collectRn(face)) rnByRel.set(r.file, { rel: r.file, name: r.name })

  const rot = []
  const aligned = []
  const excluded = []
  const judgedGap = []
  const prefixRows = []
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
      else excluded.push(row)
      continue
    }
    if (row.status === 'aligned') {
      if (!row.rn || !rnByRel.has(row.rn)) {
        rot.push({ line: row.line, why: `aligned 指向的 RN 屏不存在:${String(row.rn)}` })
        continue
      }
      aligned.push(row)
      continue
    }
    // gap = 判过「RN 该内容域零承载」。证据必填:没有证据的 gap 与"没人判"不可区分。
    // 这一档只减少 unmapped(未判定面),不进 aligned —— 缺口存量仍单独报数,不冒充已对齐。
    if (row.status === 'gap') {
      if (!row.note) rot.push({ line: row.line, why: 'gap 缺 note(判过必有证据,否则与未判定不可区分)' })
      else judgedGap.push(row)
      continue
    }
    rot.push({ line: row.line, why: `未知 status:${String(row.status)}` })
  }

  const mappedRoutes = new Set([...aligned, ...excluded, ...judgedGap].map((r) => r.web))
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
  const unmapped = webRoutes.filter((r) => !mappedRoutes.has(r.route) && !prefixExcludedRoutes.has(r.route))
  return { aligned, excluded, judgedGap, rot, prefixHits, prefixRows, prefixExcludedRoutes, unmapped, rnScreens }
}

function run() {
  const webRoutes = collectWebRoutes(FACE)
  const rnScreens = collectRnScreens(FACE)
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
  const { aligned, excluded, judgedGap, rot, prefixHits, prefixRows, unmapped } = ev
  const prefixExcluded = prefixHits.size
  const usedRn = new Set(aligned.map((r) => r.rn))
  const rnOnly = rnScreens.filter((s) => !usedRn.has(s.rel))

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
  log(`未映射 web 路由    : ${json.unmapped}  ← 功能缺口候选(**无人判过**;逐屏登记后收敛)`)
  log(`RN 独有屏         : ${json.rnOnly}`)
  log('')
  log('未映射按首段分组(前 25):')
  for (const [seg, n] of segRows.slice(0, 25)) log(`  ${String(n).padStart(4)}  ${seg}`)
  log('')
  log(`启发式候选建议(前 ${json.suggestions.length} 条,仅建议不判定):`)
  for (const s of json.suggestions) {
    const c = s.candidates.map((x) => `${x.exact ? '[同名] ' : ''}${x.name}(${x.hit.join('+')})`).join(' | ') || '—'
    log(`  ${s.web}  →  ${c}`)
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

export const __test__ = { collectWebRoutes, collectRnScreens, screenTokens, routeTokens, suggestCandidates, loadMap, evaluateMap, LANG_SEGS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
