// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * api-route-uniqueness.mjs —— Fastify **路由唯一性**判据(纯函数,零 IO;门 269 的判据层)
 *
 * ## 立因(2026-10-30 事故原话,不是假想)
 * 同一 `(method, path)` 被注册两次时,Fastify **不在编译期而是在装配期**抛
 * `Method 'GET' already declared`。于是它在提交链上完全隐身:单元测试各装各的插件、
 * 门 8 只判「前端调用有没有后端在册」,两型都看不见「两处注册抢同一个路径」。
 * 实发:`/api/coupons/available` 被 06:43 的领券中心(枚 `36f6c451f8`)与 15:26 的支付链
 * (枚 `4c51d614ee`)各注册一次,IHUI-API-BLUE 19:08/19:53 两轮各等满 120s 未就绪,
 * 18:16 之后 API 再没上新代码(修复枚 `399dc2969c` 把支付页迁到 `/pay/coupons/available`)。
 *
 * ## 判据(唯一维度:`method + 对外真实路径`)
 * 取材**不另造第二份挂载图**:直接吃 `route-registration-extract.mjs` 的
 * `extractApiRegistrations()` 产出(那是守门 8 的唯一后端注册面,§0.6)。本层只做三件事:
 *   ① **站点归一**:同一声明被挂载图重复展开(菱形 / 近似挂载)只算一个站点 ——
 *      站点身份 = `file + line + method + path`,不是「展开了几次」;
 *   ② **可判定性分档**:把「前缀其实是猜的」那几类剔出判红面并**逐档报数**,不静默丢
 *      (判不来不等于没问题,§0.3);
 *   ③ **重复归并 + 差值棘轮**:同一 `(method, path)` 上有 ≥2 个不同站点 ⇒ 重复;
 *      与基线面比,只拦「本次新增」。
 *
 * ## 为什么必须先剔除三类站点(不剔就是恒红门,§12e)
 * HEAD 面 2026-10-31 现读:5,159 条条目里有 **3 个假阳性键 / 8 个行位**,
 * 全由取材侧的两处已知盲区造成(数字现读,脚本 `--json` 可复算):
 *   · `alias-routes.ts` 三处内联块(`/login-logs` `/tasks/logs` `/posts`)**形参同名 `s`**,
 *     而 `analyzeTsFile` 的 `aliases` 表键是 `外层函数\0形参名` ⇒ 三块塌成一条,
 *     于是 `GET /list` ×3 与 `DELETE /clean` ×2 全落到 `/posts` 上(5 个行位)。
 *     本层不另算前缀(那要重写挂载图),而是把这些块**整块判为不可判定**
 *     —— `detectInlineAliasCollisions()` 只回答「这块的形参是否被兄弟块抢过」,
 *     不产出任何路径;
 *   · `via === 'fallback'` 的条目前缀是「本文件自身声明的前缀」,**不是**真实挂载前缀
 *     (`agent-runs.ts` / `command-acks.ts` / `gen-table.ts` 三处 `POST /`);
 *   · `via === 'dynamic-prefix'` 的子树前缀静态解不出(HEAD 现读 0 条,口径先立着)。
 * 拿未剔除的产出直接判红 ⇒ 存量 3 红灯,唯一结局是人人 `--no-verify`(§0.2/§12e)。
 *
 * ## 差值棘轮(锚点 = 基线面自身的重复数,不是 0)
 * `ratchetDuplicates(base, current)` 按 `method path` 计站点数:本次 > 基线 ⇒ 回归。
 * 存量非 0 时只拦新增;存量归零后本门即等价于绝对零容忍(无需改判据)。
 * 基线取哪一面由 CLI 定(§0.4:`--staged` 判索引 blob、基线 HEAD;全量判 HEAD blob、基线 HEAD^)。
 *
 * ## 已知边界(如实列出,不得假装覆盖)
 *   · **同一插件在同一前缀被注册两次**(`register(x,{prefix:'/a'})` 写两遍):挂载图按
 *     `文件\0符号\0前缀` 去重走一次 ⇒ 结构上看不见。它与「同一路径写两遍」不同类
 *     (`find-route-conflicts.mjs` 也按同一口径有意放过),本门不冒充能判。
 *   · **尾斜杠**:路径已被取材侧 `cleanPath` 归一(`/a/` → `/a`)⇒ 若有人刻意同时注册
 *     `/a` 与 `/a/`,本门会并成一键。宁可多报一次交人工,也不在判据里再发明一套归一。
 *   · **参数名不同**(`/x/:id` 与 `/x/:uuid`):find-my-way 的冲突语义依赖版本,本门
 *     **不判红**,只作 `paramAdvisories` 旁路报数(退出码不受影响)。
 *   · **FastAPI 面不进来**:`apps/ai-service` 重复注册是「后者覆盖前者」而非抛错,
 *     不属于本票范围(`stagedTriggers: apps/api/`),本层按 `.py` 过滤并报数。
 *
 * ## 面与三态
 * 取材在 CLI(`face-reader` 的 `gitRaw`/`catBatch`/`selectFace`);本层**不读盘、不碰 git**。
 * 退出码语义见 `decideExitCode`:0 判过(可能带存量)/ 1 判出新增重复 / 2 未判定。
 */
import {
  DEFAULT_ENTRY_TS,
  enclosingFn,
  extractApiRegistrations,
  findMatchingBracket,
  findTopLevelFunctions,
  lineOfIdx,
  maskRegexLiterals,
  readParenArgs,
  splitTopLevelArgs,
} from './route-registration-extract.mjs'
import { maskComments } from './outbound-route-facts.mjs'

/** 不可判定档位。逐档都有名字,报数用;新增一档必须同时改 `EXCLUDE_LABEL`。 */
export const EXCLUDE_REASON = Object.freeze({
  FALLBACK_PREFIX: 'fallback-prefix',
  DYNAMIC_PREFIX: 'dynamic-prefix',
  INLINE_ALIAS_COLLISION: 'inline-alias-collision',
  NON_TS: 'non-ts',
  MALFORMED: 'malformed',
})

export const EXCLUDE_LABEL = Object.freeze({
  [EXCLUDE_REASON.FALLBACK_PREFIX]: '兜底前缀(图走不到该函数,前缀是按本文件自身声明猜的)',
  [EXCLUDE_REASON.DYNAMIC_PREFIX]: '前缀是表达式,静态解不出(整棵子树前缀未知)',
  [EXCLUDE_REASON.INLINE_ALIAS_COLLISION]: '内联子插件形参被兄弟块抢占(前缀会塌成同一档)',
  [EXCLUDE_REASON.NON_TS]: '非 Fastify 面(.py 走 FastAPI,重复注册不抛错,不在本门射程)',
  [EXCLUDE_REASON.MALFORMED]: '条目形状坏(缺 method/path)',
})

/** 通配方法:`.route({ url })` 未声明 method 时取它,与任何具体方法都算命中同一键。 */
export const ANY_METHOD = 'ANY'

/** 站点身份:`同一声明被展开两次`不得算两处注册。 */
export function siteKey(entry) {
  return `${entry.file}\u0000${entry.line}\u0000${entry.method}\u0000${entry.path}`
}

/** 重复键:`method + 对外真实路径`(对外真实路径已由取材侧归一)。 */
export function routeKey(method, path) {
  return `${String(method || '').toUpperCase()} ${path}`
}

/** 两个方法是否命中同一键(通配方法覆盖一切具体方法)。 */
export function methodsOverlap(a, b) {
  const x = String(a || '').toUpperCase()
  const y = String(b || '').toUpperCase()
  return x === y || x === ANY_METHOD || y === ANY_METHOD
}

/**
 * 内联别名塌陷探测:**只回答「这块的形参名被同外层函数的兄弟块抢过」**,不产出路径。
 *
 * 判据与 `analyzeTsFile` 的 inline 分支逐条同形(首参以 `(async)?(` 开头、能抓到形参名、
 * 函数体 `{` 配平),分组键也照抄它的 `aliases` 键 `外层函数\0形参名` —— 本函数存在的唯一理由
 * 就是「那个键撞了 ⇒ 表里只剩最后一块」。**故意不做路径计算**:一旦在这里算前缀,
 * 就成了第二份挂载图(§0.6 两处实现必漂移)。
 *
 * @param {Map<string,string>} files rel → 源码
 * @returns {Map<string, Array<{key:string, fn:string, param:string,
 *   blocks:Array<{startLine:number,endLine:number,prefix:string}>}>>}
 *   只含**塌陷**的组;未塌陷的文件不出现在结果里。
 */
export function detectInlineAliasCollisions(files) {
  const out = new Map()
  for (const [rel, raw] of files) {
    if (typeof raw !== 'string') continue
    // 先按 `.register(` 粗筛:没有它的文件连遮罩都不用做(1,366 文件里绝大多数是无路由文件)。
    if (!raw.includes('.register')) continue
    const src = maskComments(maskRegexLiterals(raw))
    const fns = findTopLevelFunctions(src)
    const groups = new Map()
    const re = /([A-Za-z0-9_$]+)\s*\.\s*register\s*\(/g
    let m
    while ((m = re.exec(src)) !== null) {
      const openIdx = m.index + m[0].length - 1
      const argsText = readParenArgs(src, openIdx)
      const args = splitTopLevelArgs(argsText)
      const first = (args[0] || '').trim()
      // 与 analyzeTsFile 的 inline 分支门槛逐字同形:认不出就不收(宁漏不误报)。
      if (!/^(?:async\s*)?\(/.test(first)) continue
      const pm = /^\s*(?:async\s*)?\(\s*([A-Za-z_$][\w$]*)/.exec(first)
      if (!pm) continue
      const braceInArgs = argsText.indexOf('{')
      if (braceInArgs === -1) continue
      const bodyEnd = findMatchingBracket(argsText, braceInArgs, '{', '}')
      if (bodyEnd === -1) continue
      const owner = enclosingFn(fns, m.index)
      const fnName = owner ? owner.name : '(module)'
      const key = `${fnName}\u0000${pm[1]}`
      const prefixM = /prefix\s*:\s*['"`]([^'"`]*)['"`]/.exec(args[1] || '')
      if (!groups.has(key)) groups.set(key, { key, fn: fnName, param: pm[1], blocks: [] })
      groups.get(key).blocks.push({
        // argsText 首字符的绝对偏移 = openIdx + 1
        startLine: lineOfIdx(src, openIdx + 1 + braceInArgs),
        endLine: lineOfIdx(src, openIdx + 1 + bodyEnd),
        prefix: prefixM ? prefixM[1] : '',
      })
      re.lastIndex = openIdx
    }
    const collided = [...groups.values()].filter((g) => g.blocks.length > 1)
    if (collided.length > 0) out.set(rel, collided)
  }
  return out
}

/** 站点行是否落在某塌陷块体内(1 基行号,闭区间)。 */
function lineInBlocks(line, groups) {
  for (const g of groups)
    for (const b of g.blocks) if (line >= b.startLine && line <= b.endLine) return g
  return null
}

/**
 * 把挂载图产出分成「可判定」与「不可判定」两摞,并给不可判定逐条记因。
 *
 * @param {Array<object>} entries `extractApiRegistrations().entries`
 * @param {Map<string, Array>} collisions `detectInlineAliasCollisions()` 的产出
 */
export function classifyEntries(entries, collisions) {
  const determinable = []
  const excluded = []
  for (const e of entries) {
    const method = String(e.method || '').toUpperCase()
    const path = String(e.path ?? '')
    let reason = null
    if (!method || !path) reason = EXCLUDE_REASON.MALFORMED
    else if (e.file.endsWith('.py')) reason = EXCLUDE_REASON.NON_TS
    else if (e.via === 'fallback') reason = EXCLUDE_REASON.FALLBACK_PREFIX
    else if (e.via === 'dynamic-prefix') reason = EXCLUDE_REASON.DYNAMIC_PREFIX
    else if (collisions.has(e.file) && lineInBlocks(e.line, collisions.get(e.file)))
      reason = EXCLUDE_REASON.INLINE_ALIAS_COLLISION
    const site = { method, path, file: e.file, line: e.line, via: e.via ?? '' }
    if (reason) excluded.push({ ...site, reason })
    else determinable.push(site)
  }
  return { determinable, excluded }
}

/**
 * 重复归并与站点归一。
 *
 * 站点归一先做:`同 file+line+method+path` 只留一份 —— 菱形展开与「近似挂载」
 * (`symbol-approx`)会把**同一声明**展开多次,那是取材层的重入,不是两处注册。
 *
 * @returns {Array<{method:string, path:string, key:string, sites:Array}>}
 */
export function findDuplicateRoutes(entries) {
  const byPath = new Map()
  const seen = new Set()
  for (const e of entries) {
    const sk = siteKey(e)
    if (seen.has(sk)) continue
    seen.add(sk)
    if (!byPath.has(e.path)) byPath.set(e.path, [])
    byPath.get(e.path).push(e)
  }
  const out = []
  for (const [path, sites] of byPath) {
    const byMethod = new Map()
    for (const s of sites) {
      if (!byMethod.has(s.method)) byMethod.set(s.method, [])
      byMethod.get(s.method).push(s)
    }
    for (const [method, list] of byMethod)
      if (list.length > 1) out.push({ method, path, key: routeKey(method, path), sites: list })
    // 通配方法与任何具体方法在同一路径上必然相撞(否则上面那轮不会报)。
    const anyList = byMethod.get(ANY_METHOD) || []
    if (anyList.length > 0)
      for (const [method, list] of byMethod)
        if (
          method !== ANY_METHOD &&
          list.length > 0 &&
          !out.some((d) => d.method === method && d.path === path)
        )
          out.push({ method, path, key: routeKey(method, path), sites: [...anyList, ...list] })
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

/**
 * 参数名差异的**旁路**报数(不判红):`/x/:id` 与 `/x/:uuid` 在 find-my-way 里是否算冲突
 * 依赖版本,本门不替版本背书,只把候选点出来交人工。刻意与 `findDuplicateRoutes` 分开,
 * 免得有人把它接进入口码。
 */
export function findParamAdvisories(entries) {
  const byShape = new Map()
  for (const e of entries) {
    if (!e.path.includes(':')) continue
    const shape = e.path.replace(/:[^/]+/g, ':p')
    const key = routeKey(e.method, shape)
    if (!byShape.has(key)) byShape.set(key, new Map())
    const bucket = byShape.get(key)
    if (!bucket.has(e.path)) bucket.set(e.path, [])
    bucket.get(e.path).push(e)
  }
  const out = []
  for (const [key, variants] of byShape) {
    if (variants.size < 2) continue
    out.push({
      key,
      variants: [...variants].map(([path, sites]) => ({ path, sites })),
    })
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

/** 站点数按 key 归档(棘轮与报数共用一份)。 */
export function countByKey(duplicates) {
  const map = new Map()
  for (const d of duplicates) map.set(d.key, (map.get(d.key) || 0) + d.sites.length)
  return map
}

/**
 * 差值棘轮:本次站点数 > 基线站点数 ⇒ 回归。
 * @param {Array} base 基线面的重复(可为空)
 * @param {Array} current 本次面的重复
 * @returns {{regressed:Array, fixed:string[], baseCount:number, currentCount:number}}
 */
export function ratchetDuplicates(base, current) {
  const b = countByKey(base)
  const c = countByKey(current)
  const regressed = []
  for (const d of current) {
    const baseCount = b.get(d.key) || 0
    if (d.sites.length > baseCount) regressed.push({ ...d, baseCount })
  }
  const fixed = [...b.keys()].filter((k) => (c.get(k) || 0) < b.get(k))
  return {
    regressed: regressed.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0)),
    fixed: fixed.sort(),
    baseCount: [...b.values()].reduce((a, n) => a + n, 0),
    currentCount: [...c.values()].reduce((a, n) => a + n, 0),
  }
}

/**
 * 三态出口码。
 *  - **2 未判定**:可判定站点为 0(取材面空转)/ 基线不可得却**已有重复**
 *    (分不清新增还是存量,不猜 —— §0.3:取不到输入不记绿也不冒红);
 *  - **1**:有本次新增;
 *  - **0**:判过(存量多少都只是报数)。
 */
export function decideExitCode({
  determinableCount,
  duplicateCount = 0,
  regressedCount = 0,
  baselineKnown = true,
}) {
  if (!Number.isFinite(determinableCount) || determinableCount <= 0) return 2
  if (regressedCount > 0) return 1
  if (!baselineKnown && duplicateCount > 0) return 2
  return 0
}

/**
 * 一次算全(CLI 只负责取材与本层结果的排版)。
 * @param {Map<string,string>} files rel → 源码
 * @param {{entryTs?:string, baseFiles?:Map<string,string>|null, baselineKnown?:boolean}} opts
 */
export function analyzeRouteUniqueness(files, opts = {}) {
  const entryTs = opts.entryTs || DEFAULT_ENTRY_TS
  const graph = extractApiRegistrations(files, { entryTs })
  const collisions = detectInlineAliasCollisions(files)
  const { determinable, excluded } = classifyEntries(graph.entries, collisions)
  const duplicates = findDuplicateRoutes(determinable)

  const excludeByReason = {}
  for (const r of Object.values(EXCLUDE_REASON)) excludeByReason[r] = 0
  for (const e of excluded) excludeByReason[e.reason] = (excludeByReason[e.reason] || 0) + 1

  const baselineKnown = opts.baselineKnown !== false && opts.baseFiles instanceof Map
  const baseGraph = baselineKnown ? analyzeFace(opts.baseFiles, entryTs) : null
  // 基线不可得时**不**拿空集当基线(那等于偷换成绝对零容忍,§12f「不得改措辞绕尺」)。
  const ratchet = baseGraph ? ratchetDuplicates(baseGraph.duplicates, duplicates) : null

  return {
    entryTs,
    files: files.size,
    entries: graph.entries.length,
    determinable: determinable.length,
    excluded,
    excludeByReason,
    duplicates,
    paramAdvisories: findParamAdvisories(determinable),
    ratchet,
    baselineKnown,
    baseline: baseGraph
      ? {
          files: opts.baseFiles.size,
          entries: baseGraph.entries,
          determinable: baseGraph.determinable,
          duplicates: baseGraph.duplicates,
        }
      : null,
    collisions: [...collisions].map(([rel, groups]) => ({
      file: rel,
      groups: groups.map((g) => ({
        fn: g.fn,
        param: g.param,
        blocks: g.blocks.map((b) => ({
          startLine: b.startLine,
          endLine: b.endLine,
          prefix: b.prefix,
        })),
      })),
    })),
    graph: {
      undetermined: graph.undetermined.length,
      opaque: graph.opaque.length,
      unreached: graph.unreached.length,
    },
  }
}

/** 只算一面(基线面复用同一套判据 —— 基线若走另一套口径,棘轮就是在比两份东西)。 */
function analyzeFace(files, entryTs) {
  const graph = extractApiRegistrations(files, { entryTs })
  const collisions = detectInlineAliasCollisions(files)
  const { determinable } = classifyEntries(graph.entries, collisions)
  return {
    entries: graph.entries.length,
    determinable: determinable.length,
    duplicates: findDuplicateRoutes(determinable),
  }
}

export const __test__ = {
  ANY_METHOD,
  analyzeFace,
  classifyEntries,
  countByKey,
  decideExitCode,
  detectInlineAliasCollisions,
  findDuplicateRoutes,
  findParamAdvisories,
  lineInBlocks,
  methodsOverlap,
  ratchetDuplicates,
  routeKey,
  siteKey,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
