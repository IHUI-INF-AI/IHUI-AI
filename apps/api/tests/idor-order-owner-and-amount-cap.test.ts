// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 资金链 IDOR 与"金额客户端自定"两项缺口的回归钉。
 *
 * 实测根因(审计取证 2026-09-23):`createPayment` / `applyRefund` 的事务内订单查询
 * 只有 `where(eq(eduOrders.id, data.orderId))` —— **没有属主谓词**,而两处 `payAmount` /
 * `refundAmount` 直接取客户端携带值(`priceSchema` 只验格式 `/^\d+(\.\d{1,2})?$/`,不验上限)。
 * 后果:任意登录用户可对**他人已支付订单**挂一条 pending 退款申请(管理员在
 * `routes/order.ts` 审批后即成资金流出),并可对他人 pending 订单写 `eduPayments`,
 * 且金额由攻击者指定。性质与历史 ws-chat/ws-tasks P0 同级。
 *
 * 修法是把属主条件下推进同一条 WHERE(零额外往返,跨属主统一落 `order_not_found`→404,
 * 不留"存在但不可访问"的枚举 oracle),金额以订单为上限(允许下调=部分支付/部分退款照旧)。
 *
 * 为什么用源码结构断言:service 依赖 `db.transaction` 链式 mock 成本高且脆弱,
 * 而这两条不变量本质是"谓词必须存在于该查询里",结构断言足以钉住且不受实现细节漂移影响。
 */
import { describe, it, expect } from 'vitest'
import { capToOrderAmount } from '../src/db/order-queries.js'
import orderQueriesSrc from '../src/db/order-queries.ts?raw'

const OWNER_PREDICATE = 'and(eq(eduOrders.id, data.orderId), eq(eduOrders.userId, data.userId))'

describe('资金链属主谓词(结构层)', () => {
  it('createPayment 与 applyRefund 两处订单查询都带属主条件', () => {
    const hits = orderQueriesSrc.split(OWNER_PREDICATE).length - 1
    expect(hits).toBe(2)
  })

  it('旧的单谓词形态(仅按 id 锁订单)不得在这两个 service 里复现', () => {
    expect(orderQueriesSrc).not.toMatch(
      /\.from\(eduOrders\)\s*\.where\(eq\(eduOrders\.id, data\.orderId\)\)/,
    )
  })

  it('客户端金额不得原样入库(必须过 capToOrderAmount)', () => {
    expect(orderQueriesSrc).not.toMatch(/payAmount: data\.payAmount \?\?/)
    expect(orderQueriesSrc).not.toMatch(/refundAmount: data\.refundAmount \?\?/)
    expect(orderQueriesSrc).toMatch(
      /payAmount: capToOrderAmount\(data\.payAmount, order\.payAmount\)/,
    )
    expect(orderQueriesSrc).toMatch(
      /refundAmount: capToOrderAmount\(data\.refundAmount, order\.payAmount\)/,
    )
  })
})

describe('capToOrderAmount 金额上限', () => {
  it('越界回落到订单金额(不许上调)', () => {
    expect(capToOrderAmount('999.00', '120.50')).toBe('120.50')
    expect(capToOrderAmount('120.51', '120.50')).toBe('120.50')
  })

  it('等值与下调保留客户端值(部分支付/部分退款可用)', () => {
    expect(capToOrderAmount('120.50', '120.50')).toBe('120.50')
    expect(capToOrderAmount('10.00', '120.50')).toBe('10.00')
  })

  it('缺省 / 非正数 / 不可解析一律回落到订单金额(不写 0、不写负数)', () => {
    expect(capToOrderAmount(undefined, '88.00')).toBe('88.00')
    expect(capToOrderAmount(null, '88.00')).toBe('88.00')
    expect(capToOrderAmount('0', '88.00')).toBe('88.00')
    expect(capToOrderAmount('-5.00', '88.00')).toBe('88.00')
    expect(capToOrderAmount('abc', '88.00')).toBe('88.00')
  })

  it('订单金额本身不可解析时保留客户端值交由列约束兜底(不静默变 null)', () => {
    expect(capToOrderAmount('5.00', 'nonsense')).toBe('5.00')
    expect(capToOrderAmount(undefined, undefined)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
