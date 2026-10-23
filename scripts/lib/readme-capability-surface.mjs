// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * readme-capability-surface.mjs — 守门 22 `check-readme-sync.mjs` 的**纯判据层**(2026-10-23 立)。
 *
 * 为什么单独成文件:①判据(能力身份怎么取、README 里的"提到"怎么算、窗口起点怎么定)全部不碰
 * git、不碰磁盘,能用构造输入证明;②取材与判红留在门侧(`face-reader` 同面同轮,门 118 专判半接线);
 * ③镜像测试与门体打的是**同一份**实现(§22c 消"两份真相")。
 *
 * 路径口径的出处(§0.6 单一真相源,本层刻意不另立一套):
 *  - 后端能力源面 = `BACKEND_SOURCE_DIRS`,逐字取自 `outbound-route-facts.mjs` 的 `SCAN_DIRS`
 *    (那里登记的是"仓内两个服务端的源码目录";本层取的是同一组目录,不复制字面量)。
 *  - 后端端点提取式 = 守门 8 的唯一实现 `route-registration-extract.mjs::extractApiRegistrations`
 *    (门侧调用它,本层只负责把 entries 折成"能力身份",绝不重写第二份 Fastify/FastAPI 提取式)。
 *  - web 页面路由身份 = `apps/web/scripts/generate-ui-routes.mjs` 的 `toRoute` 同形口径
 *    (只认 `page.tsx`、剥 `(group)` 段)。该文件不 export 判据,而本门不许改别人的文件,
 *    所以这里按**同形规则**实现,并且只把它当"子串匹配的身份"用 —— 与该口径的失配只会让
 *    匹配变严(判出更多待人工裁决的条目),不会让 README 里真写了的路由被读成没写。
 *
 * 三态纪律(§0.3):本层只产结论桶,不把"没判"折成"判过"。
 *  - `covered`  = 面上找得到该能力的路径身份 —— 三种写法都算提到:完整身份、去尾部动态段的
 *                **资源族前缀**、动态段写成 `{userId}`/`[id]` 而注册面是 `:id` 的**同格混写**
 *                (见 `dynamicVariantRe`:动态段折成"一段非斜杠通配"再问一次面);
 *  - `alias`    = 以上都找不到、只找得到它的**多段尾巴**(去 `/api` 前缀 / 换挂载点那一族写法)
 *                ⇒ "可能是改名/别称"这一型**不判红,逐条点名报数**,判红权交人;
 *  - `missing`  = 身份与前缀与通配与尾巴四种形态都不在面上 ⇒ 计入违规。
 *  刻意**不**把"单段词出现在散文里"当凭据:`select`/`settings`/`archive` 这类词在 README 英文正文与
 *  代码块里必然命中,拿它当"提到"就是把判据改回恒绿(实测:早期用单段词做别称,148 项新增里 62 项
 *  被读成"也许提到过",而 `GET /api/goods/select` 这类真缺口正好落进那一格)。
 */

import { SCAN_DIRS } from './outbound-route-facts.mjs'

/** 被审文档(根 README 是唯一对外能力说明书;其余语言的 README 由 i18n 流程同步,不归本门) */
export const DOC_FILE = 'README.md'

/** 后端能力源面目录:与 outbound-route-facts 的 SCAN_DIRS 同一份字面量(§0.6) */
export const BACKEND_SOURCE_DIRS = SCAN_DIRS

/** web 页面源面(Next.js App Router) */
export const WEB_APP_DIR = 'apps/web/app'
export const WEB_PAGE_FILE = 'page.tsx'

/**
 * 滚动回看天数(定档出处 2026-10-23 实测):本仓 README 被自动收编席高频提交,
 * 单靠"文档最后一次被提交"当窗口起点会只剩 14 枚提交的缝(≈几分钟),
 * 历史欠账照样看不见 —— 实测 7 天窗口 = 3,907 枚提交 / 148 项新增能力,
 * 而判据耗时与窗口宽度无关(恒为两次面级抽取),所以宽度只由"多久必须见一次账"定。
 */
export const DEFAULT_HORIZON_DAYS = 7

/** 别名尾巴最少段数:单段词("select"/"settings")在全英文散文里必然命中,不构成别称凭据 */
export const MIN_ALIAS_SEGMENTS = 2

/**
 * 本门**判不到**的端页面源面(盲区必须显式登记,不得让绿被读成"全覆盖"):
 * 小程序页面身份住在 `src/app.config.ts` 的 pages/subPackages、RN 身份住在 navigation 注册表,
 * 各自唯一口径归 `check-miniapp-generated` 的 ui-routes 钉(门 105),本门不另立第二份提取式。
 * 这里只做"窗口内确实动了这些面"的**计数点名**,不判红。
 */
export const UNJUDGED_CLIENT_DIRS = [
  'apps/miniapp-taro/src',
  'apps/mobile-rn',
  'apps/desktop',
  'apps/extension',
  'apps/cli',
  'packages/app/src',
]

const BACKEND_FILE_RE = /\.(ts|py)$/

/** 该文件是否属于后端能力源面(端点提取的候选面;测试文件由提取式自己过滤,本层不重抄那份判据) */
export function isBackendSourceFile(rel) {
  const p = String(rel ?? '')
  return BACKEND_SOURCE_DIRS.some((d) => p.startsWith(`${d}/`)) && BACKEND_FILE_RE.test(p)
}

/** 该文件是否是 web 页面源(App Router 的 page.tsx) */
export function isWebPageFile(rel) {
  const p = String(rel ?? '')
  return p.startsWith(`${WEB_APP_DIR}/`) && p.endsWith(`/${WEB_PAGE_FILE}`)
}

/** 窗口内"没有任何能力源文件被改动"⇒ 后端面与基线同形,可以整条抽取腿都不跑 */
export function isCapabilitySourceFile(rel) {
  return isBackendSourceFile(rel) || isWebPageFile(rel)
}

/**
 * `apps/web/app/(main)/domains/ai/page.tsx` → `domains/ai`
 * 与 apps/web/scripts/generate-ui-routes.mjs 的 toRoute 同形(只认 page.tsx、剥 `(group)` 段);
 * 动态段 `[id]` 原样留着(身份里带它就要求 README 也带它,归不了别称就交人工判)。
 * 根页面(`app/page.tsx`)没有可匹配的路径身份 ⇒ 返回 null,不计为能力。
 */
export function pageToken(rel) {
  const p = String(rel ?? '')
  if (!isWebPageFile(p)) return null
  const segs = p
    .slice(WEB_APP_DIR.length + 1)
    .split('/')
    .slice(0, -1)
    .filter((s) => s !== '' && !/^\(.*\)$/.test(s))
  if (segs.length === 0) return null
  return segs.join('/')
}

/** 路径身份:去首部斜杠、统一小写、折掉重复斜杠(`//` → `/`) */
export function normalizeToken(path) {
  return String(path ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .toLowerCase()
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 动态段:Fastify/Spring 风格 `:id`、小程序/Nuxt 风格 `{id}`、Next.js 风格 `[id]` */
function isDynamicSeg(seg) {
  return /^[:{[]/.test(seg)
}

const VARIANT_RE_CACHE = new Map()
/**
 * 同一路径的"动态段怎么写"变体:README 常写 `/api/x/{userId}/y`,而注册面是 `/api/x/:id/y`。
 * 两种写法是同一个能力,所以把动态段折成"一段非斜杠通配"再问一次面。
 * 只有身份里真的有动态段才产正则(普通路径不走通配,免得把尺子放宽成"任意前缀都算提到")。
 */
export function dynamicVariantRe(tokenLower) {
  const key = String(tokenLower)
  if (VARIANT_RE_CACHE.has(key)) return VARIANT_RE_CACHE.get(key)
  const segs = key.split('/').filter(Boolean)
  const re = segs.some(isDynamicSeg)
    ? new RegExp(`(^|[^a-z0-9])${segs.map((s) => (isDynamicSeg(s) ? '[^/]{1,64}' : escapeRe(s))).join('/')}(?![a-z0-9])`)
    : null
  VARIANT_RE_CACHE.set(key, re)
  return re
}

/**
 * 静态前缀:剥掉**尾部**动态段(`/api/plaza/:id` → `api/plaza`)。
 * README 通常按"资源族"描述,不带参数名,所以前缀形态也算提到过。
 */
export function staticPrefix(token) {
  const segs = normalizeToken(token).split('/').filter(Boolean)
  while (segs.length > 0 && /^[:{[]/.test(segs[segs.length - 1])) segs.pop()
  return segs.join('/')
}

/**
 * 别称候选(交人工裁的那一格):路径去掉前 i 段后剩下的、**段数 ≥ MIN_ALIAS_SEGMENTS** 的尾巴,
 * 且首段不得是动态段(`:id/toggle` 这种尾巴在散文里必然命中,不构成别称凭据)。
 * 允许 `{param}` / `:param` 混写:比较时把两种形态折成同一档。
 */
export function aliasTails(token) {
  const segs = normalizeToken(token).split('/').filter(Boolean)
  const out = []
  for (let i = 1; i <= segs.length - MIN_ALIAS_SEGMENTS; i++) {
    const tail = segs.slice(i)
    if (tail.length < MIN_ALIAS_SEGMENTS) continue
    if (/^[:{[]/.test(tail[0])) continue
    out.push(tail.join('/'))
  }
  return out
}

/**
 * "README 面里到底有没有提到这个 token" —— 边界判定:
 * 左右邻字符不得是字母/数字(否则 `health` 会命中 `healthcare`、`select` 会命中 `selection`),
 * 而 `/ - _ . : { }` 这类路径/文案分隔符算合法邻字符。
 */
const TOKEN_RE_CACHE = new Map()
export function containsToken(haystackLower, tokenLower) {
  const key = String(tokenLower)
  let re = TOKEN_RE_CACHE.get(key)
  if (!re) {
    if (!key) return false
    re = new RegExp(`(^|[^a-z0-9])${escapeRe(key)}(?![a-z0-9])`)
    TOKEN_RE_CACHE.set(key, re)
  }
  return re.test(haystackLower)
}

/** 后端 entries(route-registration-extract 的产出)→ 能力身份描述符 */
export function descriptorsFromApiEntries(entries) {
  const out = []
  for (const e of entries ?? []) {
    const primary = normalizeToken(e?.path)
    if (!primary) continue
    out.push({
      kind: 'api',
      id: `${String(e.method ?? 'ANY').toUpperCase()} /${primary}`,
      primary,
      file: e.file ?? '',
      line: Number.isFinite(e.line) ? e.line : null,
    })
  }
  return out
}

/** web 页面路径清单 → 能力身份描述符 */
export function descriptorsFromPageRels(rels) {
  const out = []
  const seen = new Set()
  for (const rel of rels ?? []) {
    const token = pageToken(rel)
    if (!token) continue
    const id = `PAGE /${token}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ kind: 'page', id, primary: normalizeToken(token), file: rel, line: null })
  }
  return out
}

/** 身份去重(同一 primary 可能被两条腿产出;保留首见并记全部出处) */
export function dedupeDescriptors(list) {
  const map = new Map()
  for (const d of list ?? []) {
    const cur = map.get(d.id)
    if (!cur) map.set(d.id, { ...d, sources: [d.file] })
    else if (d.file && !cur.sources.includes(d.file)) cur.sources.push(d.file)
  }
  return map
}

/**
 * 窗口两端的能力集做差 ⇒ "这段时间新增的对外能力"。
 * 只算新增(删除/改名不进射程:README 里多出来的旧描述不是本门要管的事)。
 */
export function addedDescriptors(nowMap, baseMap) {
  const added = []
  for (const [id, desc] of nowMap) if (!baseMap.has(id)) added.push(desc)
  return added.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * 三态归类。返回 `{state, evidence}`:
 *  - covered:完整身份 / 静态前缀 / 动态段通配形态 在面上;
 *  - alias  :只有多段尾巴(或尾巴的动态段通配形态)在面上;
 *  - missing:都不在。
 */
export function classifyDescriptor(desc, haystackLower) {
  const primary = normalizeToken(desc?.primary)
  if (!primary) return { state: 'covered', evidence: '(无路径身份,不计为对外能力)' }
  if (containsToken(haystackLower, primary)) return { state: 'covered', evidence: primary }
  const prefix = staticPrefix(primary)
  if (prefix && prefix !== primary && containsToken(haystackLower, prefix))
    return { state: 'covered', evidence: prefix }
  const variant = dynamicVariantRe(primary)
  if (variant && variant.test(haystackLower)) return { state: 'covered', evidence: `${primary}(动态段通配)` }
  for (const tail of aliasTails(primary)) {
    if (containsToken(haystackLower, tail)) return { state: 'alias', evidence: tail }
    const tailVariant = dynamicVariantRe(tail)
    if (tailVariant && tailVariant.test(haystackLower))
      return { state: 'alias', evidence: `${tail}(动态段通配)` }
  }
  return { state: 'missing', evidence: primary }
}

/** 按三态把描述符分到三个桶(桶里逐条带 state/evidence,绝不静默吞) */
export function bucketDescriptors(list, haystackLower) {
  const buckets = { covered: [], alias: [], missing: [] }
  for (const d of list ?? []) {
    const r = classifyDescriptor(d, haystackLower)
    buckets[r.state].push({ ...d, evidence: r.evidence })
  }
  return buckets
}

/**
 * 窗口起点 = 「被审文档最后一次被提交」与「滚动回看点」里**更旧**的那一枚。
 * 只取文档锚点会失忆(本仓 README 一天被提交多次),只取回看点会丢掉"文档很久没动"的长账,
 * 所以取更旧者:文档久未更新 ⇒ 窗口自动变长;文档频繁更新 ⇒ 回看点兜住历史欠账。
 * 传入的 `isAncestor(a, b)` 必须是 git 面现读的结果;拿不到 ⇒ 返回 null,由门侧落未判定。
 */
export function pickWindowStart(docAnchor, horizonRev, isAncestor) {
  const a = String(docAnchor ?? '').trim()
  const h = String(horizonRev ?? '').trim()
  if (!a && !h) return null
  if (!a) return h
  if (!h) return a
  const horizonIsOlder = (() => {
    try {
      return isAncestor(h, a) === true
    } catch {
      return null
    }
  })()
  if (horizonIsOlder === null) return null
  return horizonIsOlder ? h : a
}

/**
 * 违规分桶:哪些是"文档锚点之后新增"(升档时可拦的那一截),哪些是锚点之前的存量。
 * `changedFilesSinceDoc` 是"自文档锚点以来被改动过的能力源文件清单"(面现读)。
 * 归因是**单向保守**的:文件自锚点后没动过 ⇒ 该能力在锚点面就已存在 ⇒ 铁存量;
 * 文件动过 ⇒ 可能新增也可能只是别的改动,记为 inDocWindow(宁可多要一次定向说明,§0.10)。
 */
export function splitByDocAnchor(added, changedFilesSinceDoc) {
  const changed = new Set(changedFilesSinceDoc ?? [])
  const inDocWindow = []
  const backlog = []
  for (const d of added) (changed.has(d.file) ? inDocWindow : backlog).push(d)
  return { inDocWindow, backlog }
}

/** 盲区点名:窗口内动了哪些"本门判不到的端页面源面"(报数不判红) */
export function blindSpotHits(changedFiles) {
  const hits = []
  for (const rel of changedFiles ?? []) {
    if (isCapabilitySourceFile(rel)) continue
    const dir = UNJUDGED_CLIENT_DIRS.find((d) => rel.startsWith(`${d}/`))
    if (dir) hits.push({ dir, file: rel })
  }
  return hits
}

export const __test__ = {
  DOC_FILE,
  BACKEND_SOURCE_DIRS,
  WEB_APP_DIR,
  WEB_PAGE_FILE,
  DEFAULT_HORIZON_DAYS,
  MIN_ALIAS_SEGMENTS,
  UNJUDGED_CLIENT_DIRS,
  isBackendSourceFile,
  isWebPageFile,
  isCapabilitySourceFile,
  pageToken,
  normalizeToken,
  staticPrefix,
  aliasTails,
  dynamicVariantRe,
  containsToken,
  descriptorsFromApiEntries,
  descriptorsFromPageRels,
  dedupeDescriptors,
  addedDescriptors,
  classifyDescriptor,
  bucketDescriptors,
  pickWindowStart,
  splitByDocAnchor,
  blindSpotHits,
}
