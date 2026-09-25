// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队知识引擎面的"注册即装车"证明(2026-09-26 立,仿 team-memory-routes-registered.test.ts)。
 *
 * 为什么要这么一条看起来"很土"的判据:`apps/api/src/routes/knowledge-team.ts`、其服务层、
 * `packages/api-client/src/endpoints/team-knowledge.ts`、`apps/web/app/(main)/team-knowledge/page.tsx`
 * 四件全在库,唯独 `registerRoutes` 里少一行注册 ⇒ 生产 404,而
 * ① `apps/api/tests/knowledge-team.test.ts` 自己 `app.register(knowledgeTeamRoutes)` 挂载 ⇒ 恒绿;
 * ② 守门 8(check-api-routes)的调用方面只扫 `apps/*` 字面量,经 api-client 的调用整类不受它对账 ⇒ 也恒绿;
 * ③ typecheck / lint / 单测全都不会红。这是本仓最高频的"造好没装车"形态。
 *
 * 判据刻意做成**路径合成比对**而不是"文件里出现过某串":客户端每个 fetchApi 路径都必须等于
 * 「注册 prefix」+「路由文件内的路径字面量」,且**双向**——路由注册了 12 条而客户端一条都没调,
 * 同样是没装车。漂移(prefix 改了 / 路由改名 / 客户端手写错段)当场红。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_ROOT = resolve(HERE, '..')

const indexSrc = readFileSync(join(API_ROOT, 'src/routes/index.ts'), 'utf8')
const routeSrc = readFileSync(join(API_ROOT, 'src/routes/knowledge-team.ts'), 'utf8')
const clientSrc = readFileSync(
  resolve(API_ROOT, '../../packages/api-client/src/endpoints/team-knowledge.ts'),
  'utf8',
)

const PLUGIN_NAME = 'knowledgeTeamRoutes'
const ROUTE_FILE = 'knowledge-team.js'
const FACE_SEGMENT = 'knowledge-team'

/** 从 registerRoutes 里取出该路由的注册 prefix(结构位:server.register(<plugin>, { prefix })) */
function registeredPrefix(pluginName: string): string | null {
  const re = new RegExp(
    `server\\.register\\(\\s*${pluginName}\\s*,\\s*\\{\\s*prefix:\\s*['"\`]([^'"\`]+)['"\`]`,
    'u',
  )
  return re.exec(indexSrc)?.[1] ?? null
}

/** 折掉查询串、模板插值段与命名参数段:`/spaces/${id}/members?x` 与 `/spaces/:spaceId/members` 同形为 `/spaces/:x/members` */
function foldPath(p: string): string {
  return p
    .split('?')[0]
    .replace(/\$\{[^}]*\}/gu, ':x')
    .replace(/:[A-Za-z_]\w*/gu, ':x')
}

/** 路由文件内的全部路径字面量(与 prefix 合成后归一参数段) */
function composedRoutePaths(prefix: string): Set<string> {
  const inner = [...routeSrc.matchAll(/app\.(get|post|put|delete)\(\s*['"]([^'"]*)['"]/gu)].map(
    (m) => m[2],
  )
  return new Set(inner.map((p) => foldPath(`${prefix}${p}`)))
}

/** api-client 指向本面的全部 fetchApi 字面量路径(归一后) */
function clientFacePaths(): Set<string> {
  return new Set(
    [...clientSrc.matchAll(/[`'"](\/api\/[^`'"\n]*)[`'"]/gu)]
      .map((m) => foldPath(m[1]))
      .filter((p) => p.includes(FACE_SEGMENT)),
  )
}

describe('D29 团队知识引擎路由注册面', () => {
  it('routes/index.ts 必须 import 且注册 knowledgeTeamRoutes', () => {
    expect(
      new RegExp(`import\\s*\\{\\s*${PLUGIN_NAME}\\s*\\}\\s*from\\s*'\\./${ROUTE_FILE}'`, 'u').test(
        indexSrc,
      ),
    ).toBe(true)
    expect(registeredPrefix(PLUGIN_NAME)).toBeTruthy()
  })

  it('注册 prefix 必须逐字等于 /api/knowledge-team(漂移即红)', () => {
    expect(registeredPrefix(PLUGIN_NAME)).toBe('/api/knowledge-team')
  })

  it('客户端每条路径必须等于「注册 prefix + 路由内路径字面量」的合成结果(单向:客户端不得凭空造路)', () => {
    const prefix = registeredPrefix(PLUGIN_NAME)
    expect(prefix).toBeTruthy()
    const composed = composedRoutePaths(prefix as string)
    const clientPaths = clientFacePaths()
    expect(
      clientPaths.size,
      'api-client 里一条本面路径都没解析到 ⇒ 判据失效,不是通过',
    ).toBeGreaterThan(0)
    for (const p of clientPaths) {
      expect(composed.has(p), `客户端路径 ${p} 不等于任何「prefix+路由字面量」合成结果`).toBe(true)
    }
  })

  it('路由注册的每条合成路径必须至少被客户端一条调用覆盖(反向:12 条路由不得成为无人调用的死面)', () => {
    const prefix = registeredPrefix(PLUGIN_NAME) as string
    const composed = composedRoutePaths(prefix)
    // :spaceId / :itemId 折成 :x 后与客户端同形,可逐条比对
    const clientPaths = clientFacePaths()
    expect(composed.size).toBe(8) // /spaces、/spaces/:x、/spaces/:x/{members,items,revisions}、/items/:x、/items/:x/{status,revisions}
    for (const p of composed) {
      expect(clientPaths.has(p), `路由合成路径 ${p} 在 api-client 无任何调用方`).toBe(true)
    }
  })

  it('路由文件内的路径字面量数量必须是 12(显式列举面,零公开兜底正则)', () => {
    const inner = [...routeSrc.matchAll(/app\.(get|post|put|delete)\(\s*['"]([^'"]*)['"]/gu)]
    expect(inner.length).toBe(12)
    // 不得出现正则型路径(Fastify 语法 /:param* 等)——本面按 §5 要求全部显式
    for (const m of inner) {
      expect(m[2]).not.toMatch(/[%(*+?{|]/u)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
