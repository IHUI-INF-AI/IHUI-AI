// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 两侧路由集对账:ai-service publish 域路由 ↔ api 代理路由(2026-09-27 立)
//
// 起因:apps/api/src/routes/publish-routes.ts 曾长期缺 4 条到 ai-service 的代理
//   (GET /publish/monitor/overview、POST /publish/monitor/verify、
//    POST /publish/monitor/refresh-metrics、POST /publish/scan-login/import-cookies),
//   导致 Web 端打开监测页 / 导入 cookie 必 404,而 typecheck/lint/单测全都不会红
//   —— 代理缺口只有"两侧集合对账"这一种量法能看见。本测试把该对账装进提交链。
//
// 取材口径(两侧刻意不同面,理由如下):
//  - ai-service 两个 Python router:按 **git HEAD 面** 读(`git show HEAD:<path>`)。
//    共享工作树常年滞后 HEAD(AGENTS §5b/§12d),按磁盘读会把别人半编辑态的
//    新端点当成"需求"制造假红;HEAD 面是已入库的稳定需求集。
//  - api 侧 publish-routes.ts:按 **工作树** 读。本测试要能在"补代理的那枚提交
//    落地之前"通过(新代理只存在于工作树,HEAD 面永远看不到本次修复);
//    判红时点名缺失路径,由跑测试的人把工作树对齐即可。
//  - 只判单方向:「ai-service 有、api 侧无代理」⊆ 空。反向(api 多代理到
//    ai-service 不存在的端点,如 /groups/* 一族)不属本测试射程,另计一票。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** api 侧代理源文件(工作树面) */
const API_ROUTES_REL = 'apps/api/src/routes/publish-routes.ts'

/** ai-service 侧 router 文件(HEAD 面)。前缀由文件内 APIRouter(prefix=...) 现读,不写死。 */
const PY_ROUTER_RELS = [
  'apps/ai-service/app/routers/publish.py',
  'apps/ai-service/app/routers/scan_login.py',
] as const

/** ai-service 挂在 /api 前缀下(api 代理拼的是 ${AI_SERVICE_URL}/api/publish…) */
const AI_SERVICE_MOUNT = '/api'
/** publishRoutes 以 { prefix: '/api' } 挂载(apps/api/src/routes/index.ts) */
const API_MOUNT = '/api'

// =============================================================================
// 解析出的显式豁免清单
// =============================================================================
// 判本测试"不是恒真"的另一半证据是同文件里的两条下限断言(见下方"空扫判死")+
// 交付报告中的变异对照。清单初始为空:本次实测 ai-service publish 域的全部路由
// 都是 Web 前端要用的,没有"确实不该代理"的端点。
// 将来若确有需要登记的豁免,必须逐条带 method/path/reason,且受三条结构防线约束
// (缺任何一条即红,防止清单静默腐烂):
//   E1 reason 为空或过短(<20 字符)⇒ 红 —— 豁免必须写清"为什么前端用不到";
//   E2 该 (method,path) 已出现在 api 侧代理集合 ⇒ 红 —— 代理补上了就要删行,
//      否则下一次该路由真被删代理时,残留豁免会替它放行;
//   E3 该 (method,path) 在 ai-service 路由清单里找不到 ⇒ 红 —— 豁免指向不存在的
//      端点同样是腐烂清单。
// ⇒ "把不该跳过的跳掉"至少会被 E2/E3 与评审(必须附 reason 全文)各拦一道;
//   纯机器判据无法证明"这条端点该不该代理",这一格如实交给人,不伪装成已判定。
interface ProxyExemption {
  method: string
  /** 归一后的完整路径,参数段以 * 表示,如 /api/publish/accounts/* */
  path: string
  reason: string
}
const PROXY_EXEMPTIONS: readonly ProxyExemption[] = []

// =============================================================================
// 纯函数:解析与归一(导出给断言直接调用,变异都发生在这些函数的输入面上)
// =============================================================================

interface RouteKey {
  method: string
  path: string
}

const routeKey = (r: RouteKey): string => `${r.method} ${r.path}`

/** 参数段归一:FastAPI `{user_id}` 与 Fastify `:userId` 同视;名字不参与匹配。 */
function normalizeRoutePath(raw: string): string {
  const noQuery = raw.split('?')[0] ?? ''
  return noQuery
    .replace(/\/+$/, '')
    .split('/')
    .map((seg) => (/^\{.+\}$/.test(seg) || /^:.+$/.test(seg) ? '*' : seg))
    .join('/')
}

/** 从 Python router 源码解析 @router.<verb>("<path>") + APIRouter(prefix=...)。 */
export function parsePythonRoutes(src: string, fileLabel: string): RouteKey[] {
  const prefixMatch = src.match(/APIRouter\((?:[^)]|\n)*?prefix\s*=\s*["']([^"']*)["']/)
  if (!prefixMatch) {
    // 前缀解析失败会让全部路径集体错位 ⇒ 判死而不是静默按空前缀继续
    throw new Error(`${fileLabel}: 解析不到 APIRouter(prefix=...) —— 拒绝以空前缀继续对账`)
  }
  const prefix = prefixMatch[1]
  const routes: RouteKey[] = []
  const re = /@router\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    routes.push({
      method: m[1].toUpperCase(),
      path: normalizeRoutePath(`${AI_SERVICE_MOUNT}${prefix}${m[2]}`),
    })
  }
  return routes
}

/** 从 api 侧 publish-routes.ts 解析 server.<verb>('<path>') 注册面(handler 路径)。 */
export function parseApiProxiedRoutes(src: string): RouteKey[] {
  const routes: RouteKey[] = []
  const re = /server\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    routes.push({
      method: m[1].toUpperCase(),
      path: normalizeRoutePath(`${API_MOUNT}${m[2]}`),
    })
  }
  return routes
}

// =============================================================================
// I/O:HEAD 面 git show(派生子进程一律 windowsHide,AGENTS §5b/§52 守门同口径)
// =============================================================================

function showHeadBlob(relPath: string): string {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', '-C', REPO_ROOT, 'show', `HEAD:${relPath}`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Error(
      `无法从 git HEAD 面读取 ${relPath}(HEAD 不存在该路径 / git 不可用 / 超时):${
        (e as Error).message
      } —— 判死,不回落到磁盘面`,
    )
  }
}

// =============================================================================
// 断言
// =============================================================================

describe('publish 域两侧路由集对账(ai-service router ↔ api 代理)', () => {
  const aiRoutes: RouteKey[] = PY_ROUTER_RELS.flatMap((rel) =>
    parsePythonRoutes(showHeadBlob(rel), rel),
  )
  const apiRoutes: RouteKey[] = parseApiProxiedRoutes(
    readFileSync(path.join(REPO_ROOT, API_ROUTES_REL), 'utf8'),
  )

  it('防"空扫=通过":两侧解析都必须量到合理条数(判据失明不是通过)', () => {
    // 现测:ai-service 37 条(publish.py 28 + scan_login.py 9),api 侧 55 个注册点。
    // 下限刻意远离现值:只用于识别"解析函数整体失效 ⇒ 空集合 ⇒ 差集恒空 ⇒ 假绿"。
    expect(aiRoutes.length).toBeGreaterThanOrEqual(20)
    expect(apiRoutes.length).toBeGreaterThanOrEqual(20)
  })

  it('ai-service 有、api 侧无代理 的差集必须为空(豁免清单逐条显式带理由)', () => {
    const apiSet = new Set(apiRoutes.map(routeKey))
    const missing = aiRoutes
      .map(routeKey)
      .filter((k) => !apiSet.has(k) && !PROXY_EXEMPTIONS.some((x) => routeKey(x) === k))
    // 失败时打印逐条缺口,指向修法 = 在 publish-routes.ts 补 server.<verb> 代理
    expect(missing).toEqual([])
  })

  it('豁免清单自洽:E1 每条必须带 ≥20 字符理由 / E2 不得豁免已代理的路由 / E3 不得豁免 ai-service 没有的路由', () => {
    const aiSet = new Set(aiRoutes.map(routeKey))
    const apiSet = new Set(apiRoutes.map(routeKey))
    for (const x of PROXY_EXEMPTIONS) {
      expect(x.reason.length, `豁免项 ${routeKey(x)} 缺理由`).toBeGreaterThanOrEqual(20)
      expect(apiSet.has(routeKey(x)), `豁免项 ${routeKey(x)} 已有代理,应删行`).toBe(false)
      expect(aiSet.has(routeKey(x)), `豁免项 ${routeKey(x)} 在 ai-service 清单中不存在`).toBe(true)
    }
  })

  it('本票补的 4 条代理必须在 api 面上点名存在(阳性对照:解析器认识新写法)', () => {
    const apiSet = new Set(apiRoutes.map(routeKey))
    for (const k of [
      'GET /api/publish/monitor/overview',
      'POST /api/publish/monitor/verify',
      'POST /api/publish/monitor/refresh-metrics',
      'POST /api/publish/scan-login/import-cookies',
    ]) {
      expect(apiSet.has(k), `api 侧缺代理:${k}`).toBe(true)
    }
    // 同时它们必须在 ai-service HEAD 面存在(否则本测试在对着空气放行)
    const aiSet = new Set(aiRoutes.map(routeKey))
    for (const k of [
      'GET /api/publish/monitor/overview',
      'POST /api/publish/monitor/verify',
      'POST /api/publish/monitor/refresh-metrics',
      'POST /api/publish/scan-login/import-cookies',
    ]) {
      expect(aiSet.has(k), `ai-service HEAD 面缺端点:${k}`).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
