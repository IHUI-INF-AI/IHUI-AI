// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Fastify 插件级 preHandler 的**作用域语义**实测档(2026-11-01)。
 *
 * 立因:我在两枚已入库提交里把"addHook 必须排在第一条路由之前"当成安全性质写过
 * (`admin-support-tickets-auth-gate.test.ts` 的接线锁,和随后 clawdbot 那一枚)。
 * 那是 folklore,不是测量。本文件用真 Fastify 把它量出来,让"这句到底成不成立"从此
 * 有一个跑在提交链后的档可查 —— 断言错的方向必须是"当场翻红",不是"下一个人继续信"。
 *
 * 三条各自独立:
 *  ① 同插件体内,hook 注册**晚于**路由 ⇒ 仍然罩得住 ⇒ 顺序不是安全性质;
 *  ② 封装边界才是:`register()` 子作用域里加的 hook **不会**罩父作用域的路由;
 *  ③ 反证档:如果①那句其实测不到差异(hook 根本没跑),本文件必须失败,不能静默绿。
 */
import { describe, it, expect } from 'vitest'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'

async function build(opts?: { nestedHook?: boolean }) {
  const app = Fastify()
  const ran: string[] = []
  const guard = async (req: FastifyRequest, reply: FastifyReply) => {
    ran.push(req.url)
    await reply.status(403).send({ blocked: true })
  }

  await app.register(
    async (scope) => {
      // ① 先注册路由,**后**加 hook(同一插件体内)
      scope.get('/early', async () => 'early-body')
      if (!opts?.nestedHook) scope.addHook('preHandler', guard)
      scope.get('/late', async () => 'late-body')
      if (opts?.nestedHook) {
        // ② 在子作用域里加 hook —— 它不该罩到上面这两条父作用域路由
        await scope.register(async (child) => {
          child.addHook('preHandler', guard)
          child.get('/child', async () => 'child-body')
        })
      }
    },
    { prefix: '/api' },
  )
  await app.ready()
  return { app, ran }
}

describe('Fastify 插件级 preHandler 的真实作用域', () => {
  it('① 同插件体内 hook 排在路由之后,仍罩得住先注册的路由(顺序不是安全性质)', async () => {
    const { app, ran } = await build()
    const early = await app.inject({ method: 'GET', url: '/api/early' })
    const late = await app.inject({ method: 'GET', url: '/api/late' })
    expect(early.statusCode, '插件级 hook 与注册顺序无关 ⇒ 早注册的路由也该被罩住').toBe(403)
    expect(late.statusCode).toBe(403)
    expect(ran).toEqual(['/api/early', '/api/late'])
  })

  it('② 真正的边界是封装:子 register() 里的 hook 不罩父作用域路由', async () => {
    const { app, ran } = await build({ nestedHook: true })
    const early = await app.inject({ method: 'GET', url: '/api/early' })
    const child = await app.inject({ method: 'GET', url: '/api/child' })
    expect(early.statusCode, '父作用域路由被子作用域 hook 罩住 ⇒ 与判据相反,得重看').toBe(200)
    expect(child.statusCode).toBe(403)
    expect(ran).toEqual(['/api/child'])
  })

  it('③ 反证:摘掉 addHook 那一行,路由必须一路通到 handler(证明①②测的是闸而不是装饰)', async () => {
    const app = Fastify()
    await app.register(
      async (scope) => {
        scope.get('/early', async () => 'early-body')
        // 故意不加 hook
        scope.get('/late', async () => 'late-body')
      },
      { prefix: '/api' },
    )
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/api/early' })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toBe('early-body')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
