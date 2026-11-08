// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 结账页档位解析夹具（2026-11-08）。
 *
 * 钉死的不变量：
 *  - `payment/page.tsx` 的 plan id 是 'free' | 'pro' | 'enterprise'，不是 `vip_levels.id`（uuid）；
 *    下单必须传服务端返回的真实 `id`，否则 `POST /vip/order` 按 uuid 查库必 404。
 *  - 档位按 `levelValue` 显式映射（free→0 / pro→2 / enterprise→3，价格与 DB 种子 0/9900/49900 对齐）；
 *    未知 plan 或缺失档位返回 null，由调用方拦住下单，不得回退成字符串 id。
 */
import { describe, it, expect } from 'vitest'
import {
  CHECKOUT_PLAN_LEVEL_VALUE,
  resolveCheckoutLevel,
  type CheckoutLevel,
} from '../checkout-plan-levels'

const LEVELS: CheckoutLevel[] = [
  { id: 'uuid-free', levelValue: 0, price: 0, status: 1 },
  { id: 'uuid-personal', levelValue: 1, price: 2900, status: 1 },
  { id: 'uuid-team', levelValue: 2, price: 9900, status: 1 },
  { id: 'uuid-enterprise', levelValue: 3, price: 49900, status: 1 },
]

describe('resolveCheckoutLevel', () => {
  it('pro 解析为 levelValue=2 的服务端 id（不能把 "pro" 当 vipLevelId）', () => {
    const level = resolveCheckoutLevel(LEVELS, 'pro')
    expect(level?.id).toBe('uuid-team')
    expect(level?.price).toBe(9900)
  })

  it('enterprise 解析为 levelValue=3，free 解析为 levelValue=0', () => {
    expect(resolveCheckoutLevel(LEVELS, 'enterprise')?.id).toBe('uuid-enterprise')
    expect(resolveCheckoutLevel(LEVELS, 'free')?.id).toBe('uuid-free')
  })

  it('未知 plan 返回 null', () => {
    expect(resolveCheckoutLevel(LEVELS, 'unknown')).toBeNull()
  })

  it('下架档位（status!=1）不参与解析', () => {
    const offline = LEVELS.map((l) => (l.levelValue === 2 ? { ...l, status: 0 } : l))
    expect(resolveCheckoutLevel(offline, 'pro')).toBeNull()
  })

  it('映射表与 DB 种子对齐：free=0 / pro=2 / enterprise=3', () => {
    expect(CHECKOUT_PLAN_LEVEL_VALUE).toEqual({ free: 0, pro: 2, enterprise: 3 })
  })
})
