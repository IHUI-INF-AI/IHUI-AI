// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作簿面的"注册即装车"证明(2026-11-02 立,goal-b45 F 席)。
 *
 * 立门因由与本仓 D29 团队记忆面同型(`tests/team-memory-routes-registered.test.ts`):
 * 路由自身测试会自己 `app.register(...)`,于是**注册缺失时"测试全绿而生产 404"**。
 * ai-service 的 `workbook_agent` 是按 `/api/workbook/<command>` 逐字调过来的,
 * 少这一行注册 = 整条 agent 工作簿链在真机上不存在。
 *
 * 判据是**路径合成比对**:ai-service 客户端里每个命令路径必须逐字等于
 * 「routes/index.ts 注册 prefix」+「路由文件内的路径字面量」。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_ROOT = resolve(HERE, '..')

const indexSrc = readFileSync(join(API_ROOT, 'src/routes/index.ts'), 'utf8')
const routeSrc = readFileSync(join(API_ROOT, 'src/routes/workbook.ts'), 'utf8')
const clientSrc = readFileSync(
  resolve(API_ROOT, '../../apps/ai-service/app/services/workbook_agent.py'),
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

const COMMANDS = ['open', 'read', 'write', 'save', 'close'] as const

describe('工作簿面注册面(装车证明)', () => {
  it('routes/index.ts 必须 import 且注册 workbookRoutes(恰好一次)', () => {
    expect(indexSrc).toMatch(/import\s*\{\s*workbookRoutes\s*\}\s*from\s*'\.\/workbook\.js'/u)
    expect(registeredPrefix('workbookRoutes')).toBe('/api/workbook')
    const registers = indexSrc.match(/server\.register\(workbookRoutes/gu) ?? []
    expect(registers, '重复注册会让同一 prefix 挂两份插件').toHaveLength(1)
  })

  it('路由文件内声明的五条命令路径必须逐字在册(零参数路由)', () => {
    for (const cmd of COMMANDS) {
      expect(routeSrc, `路由缺 POST /${cmd}`).toContain(`app.post('/${cmd}'`)
    }
    // 命令面只走静态段:参数段会把鉴权与归属判据的射程留成空洞
    expect(routeSrc).not.toMatch(/app\.(get|post|put|patch|delete)\('\/:/u)
  })

  it('ai-service 客户端的每个命令路径 === 注册 prefix + 路由内路径(漂移即红)', () => {
    const prefix = registeredPrefix('workbookRoutes')
    expect(prefix).toBeTruthy()
    const clientPaths = [...clientSrc.matchAll(/["'](\/api\/workbook\/[a-z_]+)["']/gu)].map(
      (m) => m[1],
    )
    expect(clientPaths.length, '客户端一个命令路径都没抽到 ⇒ 判据空转').toBeGreaterThanOrEqual(
      COMMANDS.length,
    )
    const expected = new Set(COMMANDS.map((c) => `${prefix}/${c}`))
    for (const p of new Set(clientPaths)) {
      expect(expected.has(p), `客户端路径 ${p} 不在注册面上`).toBe(true)
    }
    for (const e of expected) {
      expect(clientPaths, `客户端没有走到 ${e}`).toContain(e)
    }
  })

  it('工作簿面零公开:路由文件内不得出现"跳过鉴权"的形态', () => {
    expect(routeSrc).toMatch(/checkAuthOrInternalService/u)
    expect(routeSrc).toMatch(/addHook\('preHandler'/u)
    expect(routeSrc).not.toMatch(/publicly|无需鉴权/u)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
