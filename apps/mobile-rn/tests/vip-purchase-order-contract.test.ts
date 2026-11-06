// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VIP 购买下单口回归锁。
 *
 * 立因(真 bug,运行时必抛):2026-11 上游合并把旧调用 `createOrder({ type: 'vip', targetId })`
 * 带回了 RN 端,而本屏早已改成文件内私有的 `createVipOrder(targetId)` 直连 `POST /api/orders`
 * (旧签名既引用一个**文件内不存在**的函数,body 的 `{type}` 又与后端 `createOrderSchema`
 * 必填的 `orderType` 不符)。两条购买路径(等级卡片 onPurchase / BottomPopup 确认)都中招,
 * 点购买即抛 `createOrder is not defined`;整包 `tsc` 只在 pre-push 全量面才拦得住,
 * 单套件跑不出来 —— 这型"合并残留 + 静默"需要一把自己的锁。
 *
 * 判三件事(任一不成立即红):
 *  F1 注释剥掉后源码里**不得**再出现对 `createOrder(` 的调用(旧名本身就是合并残留的指纹;
 *     文档注释里那句历史说明不算代码,故先剥注释再判);
 *  F2 两条购买路径都必须经 `createVipOrder(...)` 且把 targetId 传进去
 *     (`createVipOrder` 全文件出现恰 3 次 = 1 处声明 + 2 处调用,多一处少一处都说明接线被改过);
 *  F3 下单函数体仍是后端契约:`/api/orders`、`method: 'POST'`、`orderType: '2'`、`targetId`。
 *
 * 反证(提交前实测,非口头):把两条调用改回 `createOrder({ type: 'vip', ... })` ⇒ F1/F2 当场红;
 * 改回 `createVipOrder` ⇒ 绿。故本锁不是恒真判据。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/screens/VipScreen.tsx'), 'utf8')
/** 剥块注释与行注释:历史说明里出现的旧调用形态会污染判据。 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('VipScreen 购买下单口', () => {
  it('F1 不再调用合并残留的 createOrder(未声明函数即运行时必抛)', () => {
    expect(
      code.match(/\bcreateOrder\s*\(/g) ?? [],
      `VipScreen.tsx 仍调用 createOrder(...) —— 本屏只有 createVipOrder(targetId),旧名是上游合并残留,购买路径点下去必抛`,
    ).toEqual([])
  })

  it('F2 两条购买路径(等级卡片 / BottomPopup 确认)都走 createVipOrder 且传 targetId', () => {
    // 1 处声明 + 2 处调用;少一处 = 接口漏接,多一处 = 出现第三条未审的下单口
    expect(
      code.match(/createVipOrder\s*\(/g) ?? [],
      'createVipOrder 的出现次数应为 3(1 声明 + 2 调用)',
    ).toHaveLength(3)
    expect(code, '等级卡片购买路径未传 level.id').toMatch(/await createVipOrder\(level\.id\)/)
    expect(code, 'BottomPopup 确认路径未传 levelId').toMatch(/await createVipOrder\(levelId\)/)
  })

  it('F3 下单函数体仍是后端契约(POST /api/orders + orderType 2)', () => {
    const body = code.match(/function createVipOrder\(targetId: string\)\s*\{([\s\S]*?)\n\}/)
    expect(body, 'createVipOrder(targetId: string) 声明缺失或形态被改').not.toBeNull()
    const fn = body?.[1] ?? ''
    expect(fn, '下单端点漂移').toMatch(/'\/api\/orders'/)
    expect(fn, '下单方法漂移').toMatch(/method:\s*'POST'/)
    expect(fn, '后端 createOrderSchema 必填 orderType,值须为 2(VIP)').toMatch(/orderType:\s*'2'/)
    expect(fn, '未把 targetId 带进 body').toMatch(/targetId/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
