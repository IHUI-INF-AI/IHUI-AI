// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 归属型记录的作用域来源锁定 —— 令牌主体由承载层入参,客户端自报不构成身份。
 *
 * 判据出处 = AGENTS.md §5「认证不等于授权(强制)」:归属型记录的入口,令牌主体必须由
 * 承载层显式入参传入,不得丢弃、不得从被操作记录反推、不得信客户端自报。
 *
 * 为什么用源码结构断言(而非运行时注入):这四条端点的过滤源是"谓词取自哪里"这一形状,
 * 运行时用例只能看到"结果为空/401",结构上把 `request.userId` 换成 `request.query.userId`
 * 同样能通过运行时用例 —— 那正是本锁要拦的形态。同款范式见 tests/idor-order-owner-and-amount-cap.test.ts。
 * 运行时面(路由在册 + 鉴权闸先回 401)由 tests/g962-b7-backend-shape.test.ts 与
 * tests/g962-b8-mobile-routes.test.ts 覆盖,两文件与本文互为补充,不重复判同一件事。
 *
 * 每条断言都配反向对照(把片段里的令牌主体换成客户端自报形态,断言必红),
 * 证明"摘掉即翻红"而不是恒绿。
 */
import { describe, it, expect } from 'vitest'
import orderSrc from '../src/routes/order.ts?raw'
import messageSrc from '../src/routes/message.ts?raw'
import vipSrc from '../src/routes/vip.ts?raw'
import indexSrc from '../src/routes/index.ts?raw'

/**
 * 按锚点切片。锚点取不到 ⇒ 抛错(用例红),不回落空串:
 * 空串会让 `not.toMatch(...)` 一律通过,变成"判不到却记绿"(§0.3)。
 */
function sliceBetween(src: string, start: string, end: string): string {
  const i = src.indexOf(start)
  if (i < 0) throw new Error(`锚点缺失(源码被改写?):${start}`)
  const j = src.indexOf(end, i + start.length)
  if (j < 0) throw new Error(`结束锚点缺失(源码被改写?):${end}`)
  return src.slice(i, j)
}

/** 订单两条端点共用的判据:过滤源必须是令牌主体,且不读客户端自报。 */
function assertTokenPrincipalScope(seg: string): void {
  expect(seg).toContain('eq(ordersTable.userId, request.userId!)')
  expect(seg).not.toMatch(/request\.(query|body)/)
}

describe('订单日志/跟踪:过滤源 = 令牌主体', () => {
  const segments: Array<[string, string]> = [
    ['/order-log', sliceBetween(orderSrc, "'/order-log'", "'/order-track'")],
    ['/order-track', sliceBetween(orderSrc, "'/order-track'", "'/orders/:orderNo'")],
  ]

  it.each(segments)('%s 用 request.userId 过滤且不读 query/body', (_path, seg) => {
    assertTokenPrincipalScope(seg)
  })

  it.each(segments)('%s 反向对照:换成自报 query 必红', (_path, seg) => {
    expect(() =>
      assertTokenPrincipalScope(seg.replace('request.userId!', 'request.query.userId')),
    ).toThrow()
  })
})

describe('私信分组:过滤源 = 令牌主体', () => {
  const seg = sliceBetween(messageSrc, "'/message/group'", 'export const adminMessageRoutes')

  function assertMessageScope(body: string): void {
    expect(body).toContain('const userId = request.userId!')
    expect(body).toContain('WHERE sender_id = ${userId} OR receiver_id = ${userId}')
    expect(body).not.toMatch(/request\.(query|body)/)
  }

  it('分组键取 request.userId,两侧 SQL 谓词都用它', () => {
    assertMessageScope(seg)
  })

  it('反向对照:换成自报 query 必红', () => {
    expect(() =>
      assertMessageScope(
        seg.replace(
          'const userId = request.userId!',
          'const userId = String(request.query.userId)',
        ),
      ),
    ).toThrow()
  })
})

describe('VIP 权益对比:公开只读、不触身份', () => {
  const seg = sliceBetween(vipSrc, "'/vip-compare'", '// 我的 VIP')

  function assertPublicReadOnly(body: string): void {
    expect(body).not.toMatch(/request\.userId|authenticate\(|requireAdmin/)
    expect(body).toContain('listVipLevels(true)')
    for (const key of ['feature:', 'basic:', 'premium:', 'enterprise:']) {
      expect(body).toContain(key)
    }
  }

  it('不鉴权、不读 request.userId,输出限四列(无用户维度字段)', () => {
    assertPublicReadOnly(seg)
  })

  it('反向对照:掺入身份读取必红', () => {
    expect(() => assertPublicReadOnly(`${seg}\nconst uid = request.userId`)).toThrow()
  })
})

describe('三条路由挂在 /api 前缀(在册而非死代码)', () => {
  it('order / message / vip 三处注册与前缀逐字存在', () => {
    expect(indexSrc).toContain("server.register(orderRoutes, { prefix: '/api' })")
    expect(indexSrc).toContain("server.register(messageRoutes, { prefix: '/api' })")
    expect(indexSrc).toContain("server.register(vipRoutes, { prefix: '/api' })")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
