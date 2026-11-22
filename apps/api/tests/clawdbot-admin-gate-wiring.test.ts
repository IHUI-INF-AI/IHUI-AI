// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * clawdbot 整面管理员闸的**存续锁**(2026-11-01 安全强化)。
 *
 * 为什么需要这一枚:本面 37 个端点全部靠 `clawdbotRoutes` 插件体内**一句**插件级
 * `server.addHook('preHandler', requireAdminRouteGuard)` 兜住。现读全仓:删掉这句,
 * 现存安全门**一枚都不会红** —— 唯一会变的读数来自编译面(`requireAdminRouteGuard` 的 import
 * 变孤儿 ⇒ `noUnusedLocals`/eslint 报),而那次提交里顺手删掉 import 就全绿。
 * 于是真实结局是:37 个端点退化成"任意登录用户可进",门链一声不响。
 * (同族差集很大:`addHook('preHandler', requireAdmin*)` 形态在 apps/api/src/routes 下
 * 命中 144 个文件,今天只有个位数文件带这种锁。本票钉住我点名的这一面,并把写法留成表驱动,
 * 后续同族按同一判据扩表即可,不另起第二份判据。)
 *
 * 定档依据(不是新发明,是把已有分界写死):
 *  · 渠道 `channels.ts` 注册表注释自陈"无对应 DB 表……不适用系统级配置";
 *  · 画布 `canvas.ts` 注释自陈"canvases 由内部代码程序化创建,非用户直接操作";
 *  · 集成 `integrations.ts` 注释自陈"不适用于系统级集成配置";
 *  · 而**确有**用户级那一半:memory 桶按 `userId` 走 `searchForUser/storeForUser`。
 * ⇒ 平台级资源 = 只允许管理员,归属语义由"闸在不在"承担,而不是给进程内 Map 造一张表。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ROOT 由本文件自身位置推导(共享工作树里 cwd 不可靠,守门 70)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FILE = 'apps/api/src/routes/clawdbot.ts'

function src(): string {
  return readFileSync(join(ROOT, FILE), 'utf8')
}

/**
 * 形态判据:插件级闸必须存在,且现状排在第一条路由之前。
 * 正向用例与变异反证**共用这一份**实现(§0.6)—— 反证若另写一份比较式,它证的就不是这条尺。
 *
 * 2026-11-01 实测更正:**"排在路由之后 ⇒ 不受保护"是错的**。真 Fastify 里同一插件体内
 * `addHook('preHandler', …)` 与注册顺序无关,晚加的 hook 照样罩得住先注册的路由;
 * 起作用的边界是**封装**(子 `register()` 里的 hook 不罩父作用域路由)—— 两者都由
 * `apps/api/tests/fastify-plugin-hook-scope.test.ts` 现场量出来钉住。
 * 所以本档裁的是"闸在不在 + 有没有被挪进别的封装层",不是"闸在第几行"。
 */
function hookPrecedesRoutes(text: string): boolean {
  const hook = text.indexOf("server.addHook('preHandler', requireAdminRouteGuard)")
  if (hook < 0) return false
  const firstRoute = text.search(/\bserver\.(get|post|put|delete|patch)\(/)
  return firstRoute > -1 && hook < firstRoute
}

describe('clawdbot 面的插件级管理员闸:存续、顺序、覆盖', () => {
  it('闸在位,且用的是带 requireActiveUser 的较强档位', () => {
    const s = src()
    expect(s).toContain("server.addHook('preHandler', requireAdminRouteGuard)")
    // 较弱的那一枚(缺 requireActiveUser)不得回流到本面的整插件闸
    expect(s).not.toContain("server.addHook('preHandler', requireAdmin)")
    expect(s).toContain("import { requireAdminRouteGuard } from '../plugins/require-permission.js'")
  })

  it('闸排在**第一条路由之前**(形态档:位置变更要在这里被看见;安全性质见 fastify-plugin-hook-scope)', () => {
    expect(hookPrecedesRoutes(src())).toBe(true)
  })

  it('闸在插件体内(不在 addHook 之后另开 register/binding 子作用域绕开它)', () => {
    const s = src()
    // 本文件内不得出现嵌套 register —— 那会让插件级 hook 的作用域不再是整面
    expect(s).not.toMatch(/\bserver\.register\(/)
    expect(s).not.toMatch(/binding\s*:/)
  })

  it('每条路由都另有 handler 级 checkAuth 第二保险(现读 37 = 37,增一条就得增一道)', () => {
    const s = src()
    const routes = (s.match(/^\s*server\.(get|post|put|delete|patch)\(/gm) || []).length
    const checks = (s.match(/await checkAuth\(/g) || []).length
    expect(routes, '路由条数读数异常').toBeGreaterThan(0)
    expect(checks, 'handler 级 checkAuth 与路由条数不等 ⇒ 有端点少了第二道保险').toBe(routes)
  })

  it('变异自证:摘掉闸、或把闸挪到最后一条路由之后,同一条判据必须判否(证明这把尺不是哑的)', () => {
    const s = src()
    expect(hookPrecedesRoutes(s)).toBe(true)

    const LINE = "  server.addHook('preHandler', requireAdminRouteGuard)\n"
    const stripped = s.replace(LINE, '')
    expect(stripped, '摘样本没摘到东西 ⇒ 这一格不成对照').not.toBe(s)
    expect(hookPrecedesRoutes(stripped)).toBe(false)

    // 同一句挪到最后一条路由**之后**(形似"整面有闸",实则在那之前注册的端点全漏)⇒ 必须判否
    const lastRoute = stripped.lastIndexOf('\n  server.post(')
    expect(lastRoute, '找不到可用作落点的最后一条路由').toBeGreaterThan(-1)
    const movedAfter =
      stripped.slice(0, lastRoute) + `\n${LINE.replace(/\n$/, '')}` + stripped.slice(lastRoute)
    expect(movedAfter).not.toBe(stripped)
    expect(hookPrecedesRoutes(movedAfter)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
