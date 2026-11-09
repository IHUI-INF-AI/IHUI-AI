// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * XUI-069:设备列表/分销订单列表并发请求,后到的旧响应覆盖新状态。
 * XUI-070:订阅下单/选图上传同 tick 连点会重复提交;卸载后仍 setState。
 * 本夹具用源码接线锁钉住每条链路都有「序号/ref 锁 + mounted 守卫」。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCREENS = join(__dirname, '..')
const read = (name: string) => readFileSync(join(SCREENS, name), 'utf8')

const DEVICES = read('DevicesScreen.tsx')
const DIST = read('DistributionOrderListScreen.tsx')
const PURCHASE = read('PurchaseScreen.tsx')
const AIWORLD = read('AiWorldScreen.tsx')
const AIGC = read('AigcPublishScreen.tsx')

const count = (src: string, re: RegExp) => (src.match(re) ?? []).length

describe('XUI-069 请求竞态:过期响应必须丢弃', () => {
  it('DevicesScreen 三条异步链路(列表/委派会话/设备任务)都带序号守卫', () => {
    expect(count(DEVICES, /const seq = \(reqSeqRef\.current \+= 1\)/g)).toBe(3)
    expect(count(DEVICES, /if \(seq !== reqSeqRef\.current\) return/g)).toBe(6)
    expect(count(DEVICES, /if \(seq === reqSeqRef\.current\) set/g)).toBe(3)
  })

  it('DistributionOrderListScreen 翻页响应带序号守卫', () => {
    expect(DIST).toContain('const reqSeqRef = useRef(0)')
    expect(DIST).toContain('const seq = (reqSeqRef.current += 1)')
    expect(DIST).toContain('if (seq !== reqSeqRef.current) return')
    expect(DIST.indexOf('if (seq !== reqSeqRef.current) return')).toBeLessThan(
      DIST.indexOf('setOrders('),
    )
  })
})

describe('XUI-070 重复提交与卸载后回调', () => {
  it('PurchaseScreen 订阅下单用 ref 入口锁,finally 复位', () => {
    expect(PURCHASE).toContain('const subscribingRef = useRef(false)')
    expect(PURCHASE).toContain('if (subscribingRef.current) return')
    expect(PURCHASE).toContain('subscribingRef.current = true')
    expect(PURCHASE).toContain('subscribingRef.current = false')
  })

  it('AiWorldScreen 搜索结果按序号判新旧', () => {
    expect(AIWORLD).toContain('const filterSeqRef = useRef(0)')
    expect(AIWORLD).toContain('const seq = (filterSeqRef.current += 1)')
    expect(AIWORLD).toContain('if (seq !== filterSeqRef.current) return')
  })

  it('AigcPublishScreen 选图用 ref 上锁,进度与收尾受 mountedRef 保护', () => {
    expect(AIGC).toContain('const uploadingRef = useRef(false)')
    expect(AIGC).toContain('const mountedRef = useRef(true)')
    expect(AIGC).toContain('if (uploadingRef.current) return')
    expect(AIGC).toContain('if (mountedRef.current) setUploadProgress(percent)')
    expect(AIGC).toContain('if (mountedRef.current) {')
    expect(count(AIGC, /uploadingRef\.current = false/g)).toBe(5)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
