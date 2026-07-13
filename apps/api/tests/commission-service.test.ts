import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
  },
}))

import {
  calcReturnToken,
  calcReturnVip,
  calcReturnTrader,
} from '../src/services/commission-service.js'
import type { IdentityProportion } from '@ihui/database'

const baseProp: IdentityProportion = {
  id: 'mock-id',
  beginTime: null,
  endTime: null,
  status: 1,
  gift: 0,
  tokenProportion: 10,
  vipGift: 0,
  routineProportion: 5,
  vipProportion: 15,
  traderProportion: 8,
  traderGift: 0,
  traderRoutineProportion: 12,
  traderVipProportion: 20,
  traderTraderProportion: 25,
  grandVipProportion: 3,
  grandRoutineProportion: 2,
  grandTraderProportion: 4,
}

describe('commission-service — 佣金计算纯函数', () => {
  describe('calcReturnToken', () => {
    it('普通用户父级返佣 = tokenQuantity × tokenProportion / 100', () => {
      expect(calcReturnToken(100, baseProp)).toBe(10)
    })

    it('tokenProportion 为 0 返回 0', () => {
      expect(calcReturnToken(100, { ...baseProp, tokenProportion: 0 })).toBe(0)
    })

    it('tokenQuantity 为 0 返回 0', () => {
      expect(calcReturnToken(0, baseProp)).toBe(0)
    })

    it('向下取整', () => {
      expect(calcReturnToken(99, { ...baseProp, tokenProportion: 7 })).toBe(6)
    })

    it('tokenProportion null 视为 0', () => {
      expect(
        calcReturnToken(100, { ...baseProp, tokenProportion: null as unknown as number }),
      ).toBe(0)
    })
  })

  describe('calcReturnVip — 会员订单(type=1)', () => {
    it('VIP 父级按 vipProportion', () => {
      expect(calcReturnVip(1000, 1, '', false, baseProp)).toBe(150)
    })

    it('操盘手父级按 traderVipProportion', () => {
      expect(calcReturnVip(1000, 1, '', true, baseProp)).toBe(200)
    })
  })

  describe('calcReturnVip — token/活动订单(type=2/3)', () => {
    it('VIP 父级 token 订单按 routineProportion', () => {
      expect(calcReturnVip(1000, 2, '', false, baseProp)).toBe(50)
    })

    it('操盘手父级 token 订单按 traderRoutineProportion', () => {
      expect(calcReturnVip(1000, 2, '', true, baseProp)).toBe(120)
    })

    it('VIP 父级活动订单按 routineProportion', () => {
      expect(calcReturnVip(1000, 3, '', false, baseProp)).toBe(50)
    })
  })

  describe('calcReturnVip — 身份订单(type=4)', () => {
    it('VIP 产品 + VIP 父级按 vipProportion', () => {
      expect(calcReturnVip(1000, 4, 'VIP', false, baseProp)).toBe(150)
    })

    it('VIP 产品 + 操盘手父级按 traderVipProportion', () => {
      expect(calcReturnVip(1000, 4, 'VIP', true, baseProp)).toBe(200)
    })

    it('OPERATE 产品 + VIP 父级按 traderProportion', () => {
      expect(calcReturnVip(1000, 4, 'OPERATE', false, baseProp)).toBe(80)
    })

    it('TRADER 产品 + 操盘手父级按 traderTraderProportion', () => {
      expect(calcReturnVip(1000, 4, 'TRADER', true, baseProp)).toBe(250)
    })

    it('未知 productId 返回 0', () => {
      expect(calcReturnVip(1000, 4, 'UNKNOWN', false, baseProp)).toBe(0)
    })
  })

  describe('calcReturnVip — 边界', () => {
    it('未知 orderType 返回 0', () => {
      expect(calcReturnVip(1000, 99, '', false, baseProp)).toBe(0)
    })

    it('amount 为 0 返回 0', () => {
      expect(calcReturnVip(0, 1, '', false, baseProp)).toBe(0)
    })

    it('向下取整', () => {
      expect(calcReturnVip(999, 1, '', false, { ...baseProp, vipProportion: 15 })).toBe(149)
    })

    it('比例 null 视为 0', () => {
      expect(
        calcReturnVip(1000, 1, '', false, {
          ...baseProp,
          vipProportion: null as unknown as number,
        }),
      ).toBe(0)
    })
  })

  describe('calcReturnTrader — 祖父级返佣', () => {
    it('会员订单按 grandVipProportion', () => {
      expect(calcReturnTrader(1000, 1, '', baseProp)).toBe(30)
    })

    it('token 订单按 grandRoutineProportion', () => {
      expect(calcReturnTrader(1000, 2, '', baseProp)).toBe(20)
    })

    it('活动订单按 grandRoutineProportion', () => {
      expect(calcReturnTrader(1000, 3, '', baseProp)).toBe(20)
    })

    it('VIP 身份订单按 grandVipProportion', () => {
      expect(calcReturnTrader(1000, 4, 'VIP', baseProp)).toBe(30)
    })

    it('OPERATE 身份订单按 grandTraderProportion', () => {
      expect(calcReturnTrader(1000, 4, 'OPERATE', baseProp)).toBe(40)
    })

    it('未知 productId 返回 0', () => {
      expect(calcReturnTrader(1000, 4, 'UNKNOWN', baseProp)).toBe(0)
    })

    it('未知 orderType 返回 0', () => {
      expect(calcReturnTrader(1000, 99, '', baseProp)).toBe(0)
    })

    it('向下取整', () => {
      expect(calcReturnTrader(999, 1, '', baseProp)).toBe(29)
    })
  })
})
