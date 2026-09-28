#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对外暴露清单对账(2026-09-28 立,机主拍板"按能力目录逐项放开"的常驻尺子)
 *
 * 它只问一个问题:**"nginx 里真的开了的路径" 与 "能力目录里申报对外的能力" 是不是同一批?**
 * 两侧任一处漂移都不产生编译期/运行期症状 —— 少一条是"第三方连不通而账面全绿"(本票
 * 立项的直接起因:`host:'ai-service'` 的能力在公网一处都不通),多一条是"没人申报却从
 * 公网可达"的敞口,而对账脚本对它隐形。所以两侧都必须**现读**并逐条点名。
 *
 * 输入五份(清单与内容同面同轮,全部经 scripts/lib/face-reader.mjs 取被审面):
 *   (A)  资格面 packages/types/generated/capabilities.json
 *        —— 目录的契约产物。它与源头 packages/types/src/capability-catalog.ts 的一致性
 *        由守门 `check-capability-catalog.mjs` 判,**本脚本不重复实现那份对账**
 *        (两处实现同一件事必漂移,是本仓记过最多次的失效型)。
 *   (C1) 站点壳 deploy/nginx/conf.d/public-ai-service.conf(zone / 上游 / 默认拒绝)
 *   (C2) 站点片段 deploy/nginx/conf.d/public-ai-service.locations.fragment(白名单本体)
 *   (C3) docker 壳 deploy/docker/nginx.web.conf(同批改动,zone 带 `docker_` 前缀)
 *   (B)  既有第三份清单 apps/web/src/config/ai-service-edge.ts —— **只报数,不判红**(X6)
 *
 * 六条判据:
 *   X1 申报 ↔ 闸门 两侧各自闭合:每条 `@public-exposure` 注解必须配对一个精确 location;
 *      反向亦然(有闸门无申报 = 未申报敞口,比"少一条"更贵)。
 *   X2 两份 nginx 配置同批:按 **(capability, method, upstream)** 相等。刻意不按公网 path 比
 *      —— 站点壳挂在 `/api/mcp`,docker 壳挂在 `/ai-service/api/mcp`,那是两份不同拓扑
 *      (docker 的 8801 上 `/api/mcp` 属于 apps/api 的 MCP 项目 CRUD,见
 *       packages/api-client/src/endpoints/misc.ts:130/141);zone 名的 `docker_` 前缀差同理
 *       **不是**不一致,那是 AGENTS §5 要求的那处差异(同 http 上下文重名 zone ⇒ nginx 启动失败)。
 *   X3 资格:申报的 scope 必须在目录里存在、`host==='ai-service'`、`thirdPartyEligible===true`、
 *      `dataClass!=='platform'`,且 upstream 逐字出现在该条 `routes` 里。
 *   X4 鉴权通道:每个开放 location 必须剥掉 `X-IHUI-Principal`(apps/api 在内网签发的主体头,
 *      公网携带即冒名)与 `X-Api-Key`(ai-service 见机器 key 一律 401,剥掉只为让"为什么被拒"
 *      只有一种答案)。身份本身只来自凭据:唯一出口
 *      app/services/capability_gate.py::resolve_principal_from_headers,不读任何自报字段。
 *   X5 形态:开放项只许 `location = /path`。禁止 `~` / `~*` / `^~` / 裸前缀 —— AGENTS §5 点名的
 *      失效型:兜底正则连静态子路由一起放行,实测曾让依赖 `request.userId` 的 handler 对游客
 *      回 **500**(fail-open 崩在鉴权层后面)。
 *   X6 (B) 那份 Next.js 边缘表与 nginx 面的差 —— **只报名报数**。判红就是让一份别人在写的
 *      清单替每次提交挡路(§12e 同型),而这一格需要的是"有人看见",不是"有人被打断"。
 *
 * 三态与退出码(绝不把"没判"写成"判过了"):
 *   0 一致(含"开放集为空 = 6 条全只内网"这一合法档,会如实说明)
 *   1 不一致(X1–X5 逐条点名)
 *   2 未判定(任一必需输入在被审面取不到 / 目录解析失败 / 枚举到 0 条 ai-service 条目 ⇒ 尺子失效)
 *
 * 定级:**warn / 纯手动档,刻意不接提交链**。① 它判的是"两份部署配置 + 一份契约产物"的跨面
 * 一致性,一次只改其中一份的提交结构上满足不了它 ⇒ 挂 blocking 就是每台每次被逼 `--no-verify`,
 * 一次绕过等于该提交上全部守门作废;② 现读到的 (B) 与本票判断存在一处真实分歧
 * (connectors:read),它还没人拍板,不该由脚本替谁定案。问责入口就是下面这行命令。
 *
 * 用法:
 *   node scripts/check-public-exposure-list.mjs                # 全量,判 HEAD 面
 *   node scripts/check-public-exposure-list.mjs --staged       # 判索引面
 *   node scripts/check-public-exposure-list.mjs --worktree     # 判磁盘(落地当轮 / 人工排查)
 *   node scripts/check-public-exposure-list.mjs --json         # 机器可读结论
 *   node scripts/check-public-exposure-list.mjs --self-test    # 构造面正反成对(临时独立仓,零副作用)
 *   --root <dir>  显式仓库根(**仅** --worktree 档有效;换根却按 HEAD/索引读 = 双根分裂,直接拒跑)
 * 退出码:0 一致 / 1 不一致 / 2 未判定或脚本自身异常
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 被审的五份输入。路径本身就是判据的一部分 —— 文件搬家而这里不改,等于那一格退化成"取不到"。 */
export const INPUTS = {
  catalog: 'packages/types/generated/capabilities.json',
  siteShell: 'deploy/nginx/conf.d/public-ai-service.conf',
  siteFragment: 'deploy/nginx/conf.d/public-ai-service.locations.fragment',
  docker: 'deploy/docker/nginx.web.conf',
  edgeTable: 'apps/web/src/config/ai-service-edge.ts',
}
/** (B) 只报数,所以缺它不折进"未判定"(会在结论里明写那一格未判定)。 */
export const OPTIONAL_INPUTS = ['edgeTable']

/** ai-service 侧上游标识:两种壳写法不同,列在一处,免得判据有第二份。 */
const AI_SERVICE_UPSTREAM_RE =
  /proxy_pass\s+http:\/\/(?:ihui_ai_service_public|ai-service)(?![\w.-])/
/** 开放面必须剥掉的身份头(理由见文件头 X4)。 */
export const REQUIRED_STRIPPED_HEADERS = ['X-IHUI-Principal', 'X-Api-Key']
const ANNOTATION_LINE_RE = /#\s*@public-exposure:\s*open\b([^\n]*)/
const ANNOTATION_FIELD_RE = /(\w+)=(\S+)/g
/** 合法字段值:scope 带 `:`、path 带 `/`、方法全大写 —— 一律不含 `<` / `>` / 空格。 */
const ANNOTATION_VALUE_RE = /^[\w:./-]+$/
const ANNOTATION_FIELDS = ['capability', 'method', 'path', 'upstream']

// ==================== 配置解析(结构面与原文面行号对齐) ====================

/**
 * 剥注释与**字符串内容**,保留行结构(行数不变 ⇒ 与原文逐行可对齐)。
 * 不剥字符串会把 `return 429 '{...}'` 里的花括号数错;不剥注释则"注释里写着 location"
 * 就能骗过判据(§22c「判据失效的表现永远是安静」同型)。
 */
export function toStructuralLines(text) {
  const lines = []
  let cur = ''
  let state = 'code' // code | sq | dq | comment
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(cur)
      cur = ''
      if (state === 'comment') state = 'code'
      // 引号态跨行:nginx 的字符串不跨行,遇到换行一律归零(真跨行是配置写坏了,由括号数暴露)
      else if (state === 'sq' || state === 'dq') state = 'code'
      continue
    }
    if (state === 'comment') continue
    if (state === 'sq') {
      if (ch === "'") state = 'code'
      continue
    }
    if (state === 'dq') {
      if (ch === '"') state = 'code'
      continue
    }
    if (ch === '#') {
      state = 'comment'
      continue
    }
    if (ch === "'") {
      state = 'sq'
      cur += "''"
      continue
    }
    if (ch === '"') {
      state = 'dq'
      cur += '""'
      continue
    }
    cur += ch
  }
  lines.push(cur)
  return lines
}

/**
 * 行级扫描出每个 `location` 块(结构面判括号,原文面取注释)。
 * @returns {Array<{args:string,startLine:number,bodyStruct:string,bodyRaw:string}>}
 */
export function parseLocations(text) {
  const struct = toStructuralLines(text)
  const raw = text.split(/\r?\n/)
  const blocks = []
  /** @type {Array<{args:string,baseDepth:number,bodyStruct:string[],bodyRaw:string[]}>} */
  const stack = []
  let depth = 0
  for (let i = 0; i < struct.length; i++) {
    const line = struct[i] ?? ''
    const lineRaw = raw[i] ?? ''
    const header = /^(\s*)location\s+([^\{;]+?)\s*\{\s*$/.exec(line)
    if (stack.length > 0) {
      const top = stack[stack.length - 1]
      top?.bodyStruct.push(line)
      top?.bodyRaw.push(lineRaw)
    }
    if (header)
      stack.push({ args: (header[2] ?? '').trim(), baseDepth: depth, bodyStruct: [], bodyRaw: [] })
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
    while (stack.length > 0 && depth <= (stack[stack.length - 1]?.baseDepth ?? 0)) {
      const done = stack.pop()
      if (!done) break
      blocks.push({
        args: done.args,
        startLine: i + 1,
        bodyStruct: done.bodyStruct.join('\n'),
        bodyRaw: done.bodyRaw.join('\n'),
      })
    }
  }
  return blocks
}

/** 从一段文本里取申报;四键齐备且取值是**真值**才算一条申报。 */
export function parseAnnotations(text) {
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const m = ANNOTATION_LINE_RE.exec(line)
    if (!m) continue
    const fields = {}
    for (const kv of (m[1] ?? '').matchAll(ANNOTATION_FIELD_RE)) {
      if (kv[1] && kv[2]) fields[kv[1]] = kv[2]
    }
    // 必须校验成"真值":配置头注里逐字写着 `capability=<目录 scope>` 这类**格式示例**,
    // 不校验就会把文档读成申报,报出一条谁也修不了的红(本脚本 --self-test S8 钉住)。
    if (ANNOTATION_FIELDS.every((f) => ANNOTATION_VALUE_RE.test(fields[f] ?? ''))) out.push(fields)
  }
  return out
}

const pubPathOf = (args) => args.replace(/^=\s*/, '').replace(/\s+/g, '')
const isExact = (args) => /^=\s+\S+$/.test(args)
export const openKeyOf = (a) => `${a.capability}|${a.method}|${a.upstream}`

/**
 * 一侧(一份/一组合配置文本)的现读事实。
 *
 * 只走一遍 location:每个"代理到 ai-service"的块按 (是否精确 × 是否申报) 四格归位 ——
 * 精确+申报 = 开放项;精确+无申报 = 未申报敞口(判红);非精确+申报 = 兜底正则型(判红);
 * 非精确+无申报 = **既有宽面**(只报名,判红就成了一台替别人背债的恒红门)。
 */
export function sideReport(label, text) {
  const declared = []
  /** @type {string[]} 精确匹配的开放 location 的公网 path(申报要能在里面找到配对) */
  const exactGated = []
  /** @type {string[]} */
  const undeclaredGates = []
  /** @type {string[]} */
  const nonExactAnnotated = []
  /** @type {string[]} */
  const broadSurfaces = []
  /** @type {string[]} */
  const headerGaps = []
  for (const b of parseLocations(text)) {
    if (!AI_SERVICE_UPSTREAM_RE.test(b.bodyStruct)) continue
    const exact = isExact(b.args)
    const path = pubPathOf(b.args)
    const annos = parseAnnotations(b.bodyRaw)
    if (exact) exactGated.push(path)
    if (annos.length === 0) {
      if (exact)
        undeclaredGates.push(
          `${label}: location ${path} 代理到 ai-service 却无 @public-exposure 申报(未申报敞口)`,
        )
      else broadSurfaces.push(`${label}: ${b.args || '(空前缀)'} 整片代理到 ai-service 而无人申报`)
      // 非精确块没有"该剥哪些头"的判据可言:它本就不该作为对外面存在,已归进上面的报名。
      if (!exact) continue
    } else {
      for (const a of annos) declared.push({ ...a, side: label })
      if (!exact) {
        nonExactAnnotated.push(`${label}: 注解落在非精确 location ${b.args} 上(兜底正则型)`)
        continue
      }
    }
    for (const h of REQUIRED_STRIPPED_HEADERS) {
      const re = new RegExp(`proxy_set_header\\s+${h}\\s+""`)
      if (!re.test(b.bodyStruct))
        headerGaps.push(`${label}: ${path} 未剥 ${h}(公网携带即等于冒名 / 凭据语义分叉)`)
    }
  }
  return { declared, exactGated, undeclaredGates, nonExactAnnotated, broadSurfaces, headerGaps }
}

// ==================== 资格面与 (B) 边表面 ====================

/** @param {string} jsonText */
export function readCatalog(jsonText) {
  const parsed = JSON.parse(jsonText)
  const caps = Array.isArray(parsed?.capabilities) ? parsed.capabilities : []
  const aiService = caps
    .filter((x) => typeof x?.scope === 'string' && x.host === 'ai-service')
    .map((x) => ({
      scope: String(x.scope),
      dataClass: String(x.dataClass ?? ''),
      thirdPartyEligible: x.thirdPartyEligible === true,
      routes: Array.isArray(x.routes) ? x.routes.map(String) : [],
    }))
  return { aiService, total: caps.length }
}

/** (B) Next.js 边缘表(派生态,只读来报数)。 */
export function readEdgeTable(tsText) {
  const routes = [
    ...tsText.matchAll(/scope:\s*'([^']+)',\s*method:\s*'([^']+)',\s*upstreamPath:\s*'([^']+)'/g),
  ].map((m) => ({ scope: m[1] ?? '', method: m[2] ?? '', upstreamPath: m[3] ?? '' }))
  const blocked = [...tsText.matchAll(/AI_SERVICE_EDGE_BLOCKED_PATHS[^\[]*\[([^\]]*)\]/g)].flatMap(
    (m) => (m[1] ?? '').match(/'[^']+'/g) ?? [],
  )
  return { routes, blocked: blocked.map((s) => s.replace(/'/g, '')) }
}

// ==================== 结论(三态不并桶) ====================

/**
 * 纯函数结论 —— 自检与生产判定共用**这一份**实现(不留第二套判序,否则测试证明的是
 * 另一台尺子)。
 * @param {{catalog:string|null,siteShell:string|null,siteFragment:string|null,docker:string|null,edgeTable:string|null}} inputs
 */
export function decide(inputs) {
  const undetermined = []
  const missing = Object.keys(INPUTS)
    .filter((k) => inputs[k] === null || inputs[k] === undefined)
    .map((k) => INPUTS[k])
  const optionalMissing = missing.filter((p) => OPTIONAL_INPUTS.some((k) => INPUTS[k] === p))
  if (optionalMissing.length > 0)
    undetermined.push(`${optionalMissing.join(', ')} 在被审面取不到 ⇒ X6 只报"未判定",不影响 X1–X5`)
  const required = missing.filter((p) => !OPTIONAL_INPUTS.some((k) => INPUTS[k] === p))
  if (required.length > 0)
    return {
      state: 'undetermined',
      reason: `必需输入在被审面取不到:${required.join(', ')}`,
      undetermined,
      violations: [],
      notices: [],
      opened: [],
      catalogAiService: [],
    }

  /** @type {{aiService:Array<{scope:string,dataClass:string,thirdPartyEligible:boolean,routes:string[]}>,total:number}} */
  let cat
  try {
    cat = readCatalog(inputs.catalog)
  } catch (e) {
    return {
      state: 'undetermined',
      reason: `能力目录解析失败:${String((e && e.message) || e).slice(0, 140)}`,
      undetermined,
      violations: [],
      notices: [],
      opened: [],
      catalogAiService: [],
    }
  }
  if (cat.aiService.length === 0)
    return {
      state: 'undetermined',
      reason: `目录里枚举到 0 条 host:'ai-service' 条目(总 ${cat.total} 条)⇒ 尺子失效,不记通过`,
      undetermined,
      violations: [],
      notices: [],
      opened: [],
      catalogAiService: [],
    }

  const site = sideReport('site', `${inputs.siteShell}\n${inputs.siteFragment}`)
  const docker = sideReport('docker', inputs.docker)
  const violations = []
  const notices = []

  // ── X1 申报 ↔ 闸门 两侧各自闭合 ──────────────────────────────────────
  for (const [label, s] of [
    ['站点(site shell + fragment)', site],
    ['docker', docker],
  ]) {
    const gated = new Set(s.exactGated)
    for (const d of s.declared)
      if (!gated.has(d.path))
        violations.push(
          `X1 ${label}: 申报了 ${openKeyOf(d)} 却没有配对的精确 location(第三方仍然连不通)`,
        )
    for (const m of s.undeclaredGates) violations.push(`X1 ${m}`)
  }
  // ── X2 两份 nginx 配置同批(按 capability+method+upstream)──────────────
  const siteKeys = site.declared.map(openKeyOf).sort()
  const dockerKeys = docker.declared.map(openKeyOf).sort()
  for (const k of siteKeys)
    if (!dockerKeys.includes(k)) violations.push(`X2 docker 侧缺同批改动:${k}`)
  for (const k of dockerKeys) if (!siteKeys.includes(k)) violations.push(`X2 站点侧缺同批改动:${k}`)
  // zone 名必须"只差前缀",不得差在别处
  const zoneNames = (t) => [...t.matchAll(/zone=(\w+):/g)].map((m) => m[1] ?? '')
  const siteZones = zoneNames(`${inputs.siteShell}\n${inputs.siteFragment}`)
  const dockerZones = zoneNames(inputs.docker)
  if (siteZones.some((z) => z.startsWith('docker_')))
    violations.push(
      'X2 站点侧出现 docker_ 前缀 zone(两份配置可能同处一个 http 上下文 ⇒ duplicate zone 启动失败)',
    )
  if (!dockerZones.some((z) => z.startsWith('docker_aisvc')))
    violations.push(
      'X2 docker 侧没有 docker_aisvc* zone ⇒ 对外面与站内自有 ai-service 流量共用额度',
    )
  const overlap = siteZones.filter((z) => dockerZones.includes(z))
  if (overlap.length > 0) violations.push(`X2 两侧 zone 重名:${overlap.join(', ')}`)
  // ── X3 资格 ───────────────────────────────────────────────────────────
  const byScope = new Map(cat.aiService.map((x) => [x.scope, x]))
  for (const d of [...site.declared, ...docker.declared]) {
    const entry = byScope.get(d.capability)
    const where = `${openKeyOf(d)} @${d.side}`
    if (!entry) {
      violations.push(
        `X3 ${where}: 目录里没有 host:'ai-service' 的这一条 ⇒ 开了一个未申报对外的能力`,
      )
      continue
    }
    if (!entry.thirdPartyEligible)
      violations.push(`X3 ${where}: 目录写着 thirdPartyEligible=false ⇒ 该 scope 不得从公网可达`)
    if (entry.dataClass === 'platform')
      violations.push(`X3 ${where}: dataClass=platform(平台运营面,机器凭据一律 403)⇒ 不得对外`)
    if (!entry.routes.some((r) => `${r.split(' ')[0] ?? ''} ${d.upstream}` === r))
      violations.push(
        `X3 ${where}: upstream ${d.upstream} 不在该条 routes 里(现读:${entry.routes.join(' | ')})`,
      )
  }
  // ── X4 鉴权通道剥离 / X5 形态 ──────────────────────────────────────────
  for (const m of [...site.headerGaps, ...docker.headerGaps]) violations.push(`X4 ${m}`)
  for (const m of [...site.nonExactAnnotated, ...docker.nonExactAnnotated])
    violations.push(`X5 ${m}`)
  for (const m of [...site.broadSurfaces, ...docker.broadSurfaces])
    notices.push(
      `X5 ${m} ⇒ 超出白名单的**既有宽面**,收窄属该 location 持有人的决策(§7 删除安全),本脚本只报名不判红`,
    )
  // ── X6 (B) 边缘表:只报数 ──────────────────────────────────────────────
  if (
    inputs.edgeTable !== null &&
    inputs.edgeTable !== undefined &&
    inputs.edgeTable.trim() === ''
  ) {
    // 文件在而内容为空 ⇒ 解析不出任何条目。这一格必须喊"未判定",不得因为
    // "没读到差异"而静默算通过(本仓最高频失效型是"把没判写成判过了")。
    undetermined.push('(B) 边缘表内容为空 ⇒ X6 未判定(空文件不等于零差异)')
  } else if (inputs.edgeTable) {
    try {
      const edge = readEdgeTable(inputs.edgeTable)
      const nginxAll = new Set([...siteKeys, ...dockerKeys])
      for (const r of edge.routes) {
        const k = `${r.scope}|${r.method}|${r.upstreamPath}`
        if (!nginxAll.has(k)) notices.push(`X6 只在 (B) Next 边缘表里、nginx 面未放开:${k}`)
      }
      for (const k of siteKeys)
        if (!edge.routes.some((r) => `${r.scope}|${r.method}|${r.upstreamPath}` === k))
          notices.push(`X6 只在 nginx 面放开、(B) 未登记:${k}`)
      for (const p of edge.blocked) notices.push(`X6 (B) 明写"整条不放"的路径:${p}`)
    } catch (e) {
      undetermined.push(
        `(B) 边缘表解析失败:${String((e && e.message) || e).slice(0, 100)} ⇒ X6 未判定`,
      )
    }
  }

  const opened = [...new Set([...siteKeys, ...dockerKeys])].sort()
  return {
    state: violations.length === 0 ? 'consistent' : 'inconsistent',
    reason:
      violations.length === 0 && opened.length === 0
        ? `两侧开放集为空 ⇒ 当前 ${cat.aiService.length} 条 ai-service 能力全部只内网(合法档,不是故障)`
        : '',
    undetermined,
    violations,
    notices,
    opened,
    catalogAiService: cat.aiService.map((x) => x.scope),
  }
}

export function exitCodeFor(conclusion) {
  if (conclusion.state === 'undetermined') return 2
  return conclusion.state === 'inconsistent' ? 1 : 0
}

// ==================== 取材(清单与内容同面同轮) ====================

/** @returns {{[k:string]:string|null}} 取不到一律 null,由 decide() 折进"未判定"。 */
export function gather(root, face) {
  if (face === 'worktree') {
    const out = {}
    // readWorktreeFile:文件不存在 → null(折进"未判定");读失败(编码/权限)**原样抛** ——
    // 一个编码错误不得伪装成"该文件不存在"的业务结论(层的注释明文,这里不套 try 正是为此)。
    for (const [k, rel] of Object.entries(INPUTS)) out[k] = readWorktreeFile(root, rel)
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const revs = Object.values(INPUTS).map((p) => `${prefix}${p}`)
  const map = catBatch(root, revs)
  const out = {}
  for (const [k, rel] of Object.entries(INPUTS)) out[k] = map.get(`${prefix}${rel}`) ?? null
  return out
}

function parseRoot(argv) {
  const i = argv.indexOf('--root')
  if (i >= 0 && argv[i + 1]) return resolve(argv[i + 1])
  const inline = argv.find((a) => a.startsWith('--root='))
  return inline ? resolve(inline.slice('--root='.length)) : null
}

export function main(argv = []) {
  const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.startsWith('--root')))
  if (flags.has('--self-test')) return selfTest()
  const rootFlag = parseRoot(argv)
  const picked = selectFace({ staged: flags.has('--staged'), worktree: flags.has('--worktree') })
  if (picked.error) {
    console.error(`❌ 取材面无法确定:${picked.error}`)
    return 2
  }
  const face = picked.face
  if (rootFlag && face !== 'worktree') {
    console.error('❌ --root 只在 --worktree 档有效(换根却仍按 HEAD/索引读 = 双根分裂),拒跑')
    return 2
  }
  const root = rootFlag ?? DEFAULT_ROOT
  /** @type {{catalog:string|null,siteShell:string|null,siteFragment:string|null,docker:string|null,edgeTable:string|null}} */
  let inputs
  try {
    inputs = /** @type {*} */ (gather(root, face))
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : String((e && e.message) || e)
    console.error(`❌ 未判定:被审面无法取材 —— ${msg}`)
    return 2
  }
  const conclusion = decide(inputs)
  const code = exitCodeFor(conclusion)
  const label = face === 'staged' ? '索引' : face === 'worktree' ? '工作树' : 'HEAD'
  if (flags.has('--json')) {
    console.log(JSON.stringify({ face: label, root, exitCode: code, ...conclusion }, null, 2))
    return code
  }
  console.log(`对外暴露清单对账(取材面:${label})`)
  console.log(
    `  目录 host:'ai-service' 条目:${conclusion.catalogAiService.length}${conclusion.catalogAiService.length ? `(${conclusion.catalogAiService.join(', ')})` : ''}`,
  )
  console.log(
    `  nginx 面已放开:${conclusion.opened.length ? conclusion.opened.join(' , ') : '(空 = 全部只内网)'}`,
  )
  for (const v of conclusion.violations) console.log(`  ❌ ${v}`)
  for (const n of conclusion.notices) console.log(`  ℹ️  ${n}`)
  for (const u of conclusion.undetermined) console.log(`  ⚠️  未判定:${u}`)
  console.log(
    `  结论:${conclusion.state}${conclusion.reason ? ` —— ${conclusion.reason}` : ''} | 违规 ${conclusion.violations.length} | 报数 ${conclusion.notices.length} | 未判定 ${conclusion.undetermined.length}`,
  )
  console.log(`RC=${code}(0 一致 / 1 不一致 / 2 未判定;本脚本不接提交链,RC 只给人看)`)
  return code
}

// ==================== 构造面自检(正反成对) ====================

export const FIXTURE_CATALOG = JSON.stringify({
  capabilities: [
    {
      scope: 'mcp:connect',
      host: 'ai-service',
      dataClass: 'compute',
      thirdPartyEligible: true,
      routes: ['POST /api/mcp', 'GET /api/mcp/export/sse'],
    },
    {
      scope: 'connectors:write',
      host: 'ai-service',
      dataClass: 'scoped-write',
      thirdPartyEligible: false,
      routes: ['POST /api/mcp/external/servers'],
    },
    {
      scope: 'user:read',
      dataClass: 'scoped-read',
      thirdPartyEligible: true,
      routes: ['GET /v1/me'],
    },
  ],
})

/** 站点侧:壳 + 片段合成一份 fixture 文本(siteShell 带全部,siteFragment 留空)。 */
export const FIXTURE_SITE_SHELL = `
limit_req_zone $binary_remote_addr zone=aisvc_open_zone:10m rate=10r/s;
map $http_authorization $aisvc_anon_key {
    ""      $binary_remote_addr;
    default "";
}
limit_req_zone $aisvc_anon_key zone=aisvc_anon_zone:10m rate=2r/s;
upstream ihui_ai_service_public { server 127.0.0.1:8803; }
server {
    listen 8443 ssl http2;
    location / { return 404 '{"code":404}'; }
    error_page 429 = @aisvc_rate_limited;
    location @aisvc_rate_limited { return 429 '{"code":429}'; }
    location = /api/mcp {
        # @public-exposure: open capability=mcp:connect method=POST path=/api/mcp upstream=/api/mcp
        limit_req zone=aisvc_open_zone burst=30 nodelay;
        limit_req zone=aisvc_anon_zone burst=5 nodelay;
        proxy_set_header X-IHUI-Principal "";
        proxy_set_header X-Api-Key "";
        proxy_pass http://ihui_ai_service_public;
    }
}
`

export const FIXTURE_DOCKER = `
limit_req_zone $binary_remote_addr zone=docker_aisvc_open_zone:10m rate=10r/s;
server {
   location = /ai-service/api/mcp {
       # @public-exposure: open capability=mcp:connect method=POST path=/ai-service/api/mcp upstream=/api/mcp
       limit_req zone=docker_aisvc_open_zone burst=30 nodelay;
       proxy_set_header X-IHUI-Principal "";
       proxy_set_header X-Api-Key "";
       proxy_pass http://ai-service:8803/api/mcp;
   }
   location /ai-service/ { proxy_pass http://ai-service:8803/; }
}
`

export const FIXTURE_EDGE = `export const AI_SERVICE_EDGE_ROUTES = [
  { scope: 'mcp:connect', method: 'POST', upstreamPath: '/api/mcp', rationale: 'x' },
  { scope: 'connectors:read', method: 'GET', upstreamPath: '/api/connectors', rationale: 'y' },
]
export const AI_SERVICE_EDGE_BLOCKED_PATHS = ['/api/mcp/external/servers']
`

export function withFixture(over = {}) {
  return {
    catalog: FIXTURE_CATALOG,
    siteShell: FIXTURE_SITE_SHELL,
    siteFragment: '',
    docker: FIXTURE_DOCKER,
    edgeTable: FIXTURE_EDGE,
    ...over,
  }
}

function selfTest() {
  /**
   * 把 fixture 落进一个**临时独立 git 仓**并按 HEAD 面判 —— 证明的是"判据在被审面上给答案",
   * 而不是"函数会接参数"(守门 13c / 84 那一型:只手工喂档表的自检证明不了有人问它)。
   */
  let dir = null
  try {
    dir = mkScratch('exposure-')
    gitRaw(['init', '-q'], dir)
    gitRaw(['config', 'user.email', 'gate@fixture.local'], dir)
    gitRaw(['config', 'user.name', 'gate-fixture'], dir)
  } catch (e) {
    console.log(
      `❌ 临时 git 仓不可用,无法跑端到端自检 → ${String((e && e.message) || e).slice(0, 160)}`,
    )
    return 1
  }
  const run = (inputs) => {
    try {
      for (const [k, rel] of Object.entries(INPUTS)) {
        const abs = join(dir, rel)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, inputs[k] ?? '', 'utf8')
      }
      gitRaw(['add', '-A'], dir)
      gitRaw(['commit', '-q', '-m', 'fixture'], dir)
      return decide(gather(dir, 'head'))
    } catch (e) {
      return {
        state: 'error',
        violations: [String((e && e.message) || e)],
        notices: [],
        opened: [],
        undetermined: [],
      }
    }
  }
  const results = []
  const t = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail })

  const ok = run(withFixture())
  t(
    'S1 两侧同批 + 有资格 + 剥头 ⇒ consistent(RC 0)',
    ok.state === 'consistent' && exitCodeFor(ok) === 0,
    JSON.stringify(ok.violations),
  )
  t(
    'S1b 开放集恰好一条(按 capability+method+upstream)',
    ok.opened.length === 1 && ok.opened[0] === 'mcp:connect|POST|/api/mcp',
    JSON.stringify(ok.opened),
  )
  t(
    'S1c (B) 差异只报数,不改退出码',
    ok.notices.length > 0 && ok.violations.length === 0,
    JSON.stringify(ok.notices),
  )

  // S2a:申报的 path 与所在 location 的实际 path 不配对(注解在、闸门不在它说的那个位置)
  const s2a = run(
    withFixture({
      siteShell: FIXTURE_SITE_SHELL.replace(
        'path=/api/mcp upstream=/api/mcp',
        'path=/api/mcp-typo upstream=/api/mcp',
      ),
    }),
  )
  t(
    'S2a 申报 path 与闸门不配对 ⇒ X1 判红',
    s2a.violations.some((v) => v.includes('X1') && v.includes('没有配对的')),
    JSON.stringify(s2a.violations),
  )
  // S2b:整条站点 location 被摘掉 ⇒ 两侧不再同批(X2 判红)。
  //      (这条曾经是 S2,被当成 X1 的用例写 —— 实际 X1 的"申报在、闸门没了"要求申报
  //       落在一个不代理 ai-service 的块里,那种写法不真实;真实形态就是两侧各说各话。)
  const s2b = run(
    withFixture({
      siteShell: FIXTURE_SITE_SHELL.replace(/\n\s*location = \/api\/mcp \{[\s\S]*?\n    \}/, ''),
    }),
  )
  t(
    'S2b 站点整条被摘 ⇒ X2 判红(两侧不同批)',
    s2b.violations.some((v) => v.includes('X2 站点侧缺同批改动')),
    JSON.stringify(s2b.violations),
  )

  const s3 = run(
    withFixture({
      siteShell: FIXTURE_SITE_SHELL.replace(/# @public-exposure:[^\n]*\n/, ''),
      docker: FIXTURE_DOCKER.replace(/# @public-exposure:[^\n]*\n/, ''),
    }),
  )
  t(
    'S3 闸门在、申报被摘 ⇒ 判红(未申报敞口)',
    s3.violations.filter((v) => v.includes('无 @public-exposure')).length === 2,
    JSON.stringify(s3.violations),
  )

  const badCap = (line) => line.replace('capability=mcp:connect', 'capability=connectors:write')
  const s4 = run(
    withFixture({ siteShell: badCap(FIXTURE_SITE_SHELL), docker: badCap(FIXTURE_DOCKER) }),
  )
  t(
    'S4 放开 thirdPartyEligible=false 的 scope ⇒ 判红',
    s4.violations.some((v) => v.includes('thirdPartyEligible=false')),
    JSON.stringify(s4.violations),
  )

  const s5 = run(
    withFixture({
      siteShell: FIXTURE_SITE_SHELL.replace(/proxy_set_header X-IHUI-Principal "";\n/, ''),
    }),
  )
  t(
    'S5 未剥 X-IHUI-Principal ⇒ 判红',
    s5.violations.some((v) => v.includes('X-IHUI-Principal') && v.includes('site')),
    JSON.stringify(s5.violations),
  )

  const s6 = run(
    withFixture({
      docker: FIXTURE_DOCKER.replace(
        'location = /ai-service/api/mcp {',
        'location ~ ^/ai-service/api/mcp {',
      ),
    }),
  )
  t(
    'S6 注解落在正则 location 上 ⇒ 判红(兜底正则型)',
    s6.violations.some((v) => v.includes('X5') && v.includes('docker')),
    JSON.stringify(s6.violations),
  )

  const s7 = run(
    withFixture({ docker: FIXTURE_DOCKER.replace(/\n   location \/ai-service\/ \{[^\n]*\}/, '') }),
  )
  t(
    'S7 去掉既有宽面 ⇒ 仍 consistent 且不再报名它',
    s7.state === 'consistent' && !s7.notices.some((n) => n.includes('整片代理')),
    JSON.stringify(s7.notices),
  )

  const s8 = parseAnnotations(
    '#   # @public-exposure: open capability=<目录 scope> method=<HTTP 方法> path=<路径> upstream=<ai-service 侧路径>',
  )
  t('S8 文档里的格式示例行 ⇒ 0 条申报(不得把散文读成敞口)', s8.length === 0, JSON.stringify(s8))

  const s9 = run(
    withFixture({
      docker: FIXTURE_DOCKER.replace('zone=docker_aisvc_open_zone:', 'zone=aisvc_open_zone:'),
    }),
  )
  t(
    'S9 两侧 zone 重名 ⇒ 判红(同 http 上下文 duplicate zone 会启动失败)',
    s9.violations.some((v) => v.includes('重名')),
    JSON.stringify(s9.violations),
  )

  const s10 = run(withFixture({ catalog: JSON.stringify({ capabilities: [{ scope: 'x' }] }) }))
  t(
    'S10 目录枚举到 0 条 ai-service ⇒ 未判定(RC 2)而非通过',
    s10.state === 'undetermined' && exitCodeFor(s10) === 2,
    s10.reason,
  )

  const s11 = run(withFixture({ edgeTable: null }))
  t(
    'S11 (B) 缺失 ⇒ X6 未判定但 X1–X5 照判',
    s11.undetermined.length > 0 && s11.state === 'consistent',
    JSON.stringify(s11.undetermined),
  )

  const emptyDir = mkScratch('exposure-empty-')
  try {
    gitRaw(['init', '-q'], emptyDir)
    gitRaw(['config', 'user.email', 'g@f'], emptyDir)
    gitRaw(['config', 'user.name', 'g'], emptyDir)
    writeFileSync(join(emptyDir, 'README.md'), 'x', 'utf8')
    gitRaw(['add', '-A'], emptyDir)
    gitRaw(['commit', '-q', '-m', 'only readme'], emptyDir)
    const miss = decide(gather(emptyDir, 'head'))
    t(
      'S12 面上没有这些文件 ⇒ 未判定(绝不记绿也绝不记红)',
      miss.state === 'undetermined' && exitCodeFor(miss) === 2,
      miss.reason,
    )
  } catch (e) {
    t('S12 面上没有这些文件', false, String((e && e.message) || e).slice(0, 160))
  } finally {
    rmScratch(emptyDir)
  }

  const openSetEmpty = run(
    withFixture({
      siteShell: FIXTURE_SITE_SHELL.replace(
        /\n\s*location = \/api\/mcp \{[\s\S]*?\n    \}/,
        '',
      ).replace(/# @public-exposure[^\n]*\n/g, ''),
      docker: FIXTURE_DOCKER.replace(/location = \/ai-service\/api\/mcp \{[\s\S]*?\n   \}/, ''),
    }),
  )
  t(
    'S13 两侧开放集为空 ⇒ consistent 且明写"全部只内网"',
    openSetEmpty.state === 'consistent' &&
      openSetEmpty.opened.length === 0 &&
      openSetEmpty.reason.includes('只内网'),
    JSON.stringify(openSetEmpty),
  )

  let failed = 0
  for (const r of results) {
    if (!r.pass) failed += 1
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ` → ${r.detail}`}`)
  }
  rmScratch(dir)
  console.log(`--self-test:${results.length - failed}/${results.length} 条断言通过`)
  return failed === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${String((e && e.stack) || e)}`)
    process.exit(2)
  }
}

export const __test__ = {
  INPUTS,
  OPTIONAL_INPUTS,
  REQUIRED_STRIPPED_HEADERS,
  toStructuralLines,
  parseLocations,
  parseAnnotations,
  sideReport,
  readCatalog,
  readEdgeTable,
  openKeyOf,
  decide,
  exitCodeFor,
  gather,
  withFixture,
  analyze: decide,
  FIXTURE_CATALOG,
  FIXTURE_SITE_SHELL,
  FIXTURE_DOCKER,
  FIXTURE_EDGE,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
