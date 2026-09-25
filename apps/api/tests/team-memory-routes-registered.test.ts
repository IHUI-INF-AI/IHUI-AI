// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队记忆面的"注册即装车"证明(2026-09-25 立)。
 *
 * 为什么要这么一条看起来"很土"的判据:`apps/api/src/routes/team-memory.ts`、其服务层、
 * `packages/api-client/src/endpoints/team-memory.ts`、`apps/web/app/(main)/team-memory/page.tsx`
 * 四件全在库,唯独 `registerRoutes` 里少一行注册 ⇒ 生产 404,而
 * ① `routes/__tests__/team-memory.test.ts` 自己 `app.register(teamMemoryRoutes)` 挂载 ⇒ 恒绿;
 * ② 守门 8(check-api-routes)的调用方面只扫 `apps/*` 字面量,经 api-client 的调用整类不受它对账 ⇒ 也恒绿;
 * ③ typecheck / lint / 单测全都不会红。这是本仓最高频的"造好没装车"形态的第三实例。
 *
 * 判据刻意做成**路径合成比对**而不是"文件里出现过某串":客户端每个 fetchApi 路径都必须等于
 * 「注册 prefix」+「路由文件内的路径字面量」,漂移(prefix 改了 / 路由改名)当场红。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_ROOT = resolve(HERE, '..')

const indexSrc = readFileSync(join(API_ROOT, 'src/routes/index.ts'), 'utf8')
const routeSrc = readFileSync(join(API_ROOT, 'src/routes/team-memory.ts'), 'utf8')
const clientSrc = readFileSync(
  resolve(API_ROOT, '../../packages/api-client/src/endpoints/team-memory.ts'),
  'utf8',
)

/** 从 registerRoutes 里取出该路由的注册 prefix(结构位:server.register(<plugin>, { prefix })) */
function registeredPrefix(pluginName: string): string | null {
  const re = new RegExp(
    `server\\.register\\(\\s*${pluginName}\\s*,\\s*\\{\\s*prefix:\\s*['"\`]([^'"\`]+)['"\`]`,
    'u',
  )
  return re.exec(indexSrc)?.[1] ?? null
}

describe('D29 团队记忆路由注册面', () => {
  it('routes/index.ts 必须 import 且注册 teamMemoryRoutes', () => {
    expect(indexSrc).toMatch(/import\s*\{\s*teamMemoryRoutes\s*\}\s*from\s*'\.\/team-memory\.js'/u)
    expect(registeredPrefix('teamMemoryRoutes')).toBeTruthy()
  })

  it('注册 prefix 必须逐字等于 api-client 调用的路径基座(漂移即红)', () => {
    const prefix = registeredPrefix('teamMemoryRoutes')
    expect(prefix).toBe('/api/team-memory')
    // 客户端所有指向本面的字面量路径都必须落在这个 prefix 之下(插值段折成 :x 再比)
    const clientPaths = [...clientSrc.matchAll(/[`'"](\/api\/[^`'"\n]*)[`'"]/gu)]
      .map((m) => m[1].replace(/\$\{[^}]*\}/gu, ':x'))
      .filter((p) => p.includes('team-memory'))
    expect(clientPaths.length).toBeGreaterThan(0)
    for (const p of clientPaths) {
      expect(p.startsWith(prefix as string), `客户端路径 ${p} 不在注册 prefix ${prefix} 下`).toBe(
        true,
      )
    }
  })

  it('路由文件内的路径字面量与 prefix 合成后,必须覆盖客户端用到的两种形态', () => {
    const prefix = registeredPrefix('teamMemoryRoutes') as string
    const inner = [...routeSrc.matchAll(/app\.(get|post|put|delete)\(\s*['"]([^'"]*)['"]/gu)].map(
      (m) => m[2],
    )
    const composed = new Set(inner.map((p) => `${prefix}${p === '/' ? '' : p}`))
    // 集合根与按 id 操作两种都必须能命中(前者不带斜杠、后者带 :id 参数段)
    expect(composed.has(prefix), `合成集合缺根路径:${[...composed].join(', ')}`).toBe(true)
    expect(
      [...composed].some((p) => /:\w+/.test(p)),
      `合成集合里没有参数段路径:${[...composed].join(', ')}`,
    ).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
