// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-6010:设备指纹区分度结论必须到得了做决定的人 —— 判读层的成对用例。
//
// 反向锁的靶子不是"渲染好不好看",而是**两句系统没说过的话**:
// ① 把"没收到结论"(字段缺席)渲染成断言;② 把 `discriminating: true` 渲染成"共用一台设备"
//    (服务端注释原文就写着这不成立 —— 哈希全程由客户端自报,抄谁的都行)。
import { describe, expect, it } from 'vitest'

import { fingerprintVerdict } from '../src/lib/fingerprint-verdict'

const DEVICE = { type: 'device' } as const

describe('fingerprintVerdict:只在显式 false 上出徽章', () => {
  it('阳性对照:不具区分度 ⇒ 徽章点名命中数与未外发数,并带服务端成因原文', () => {
    const v = fingerprintVerdict({
      ...DEVICE,
      discriminating: false,
      matchedUserCount: 142,
      withheldUserCount: 134,
      nonDiscriminationNote: '该指纹关联的账号数已超过单台设备的合理上限',
    })
    expect(v.label).toBe('指纹不具区分度 · 命中 142 个账号 · 另 134 个未外发')
    expect(v.note).toContain('超过单台设备的合理上限')
    expect(v.countKnown).toBe(true)
  })

  it('反向对照:discriminating=true ⇒ 什么都不渲染(具区分度不等于同设备)', () => {
    const v = fingerprintVerdict({ ...DEVICE, discriminating: true, matchedUserCount: 2 })
    expect([v.label, v.note, v.countKnown]).toEqual([null, null, false])
  })

  it('反向对照:字段缺席(旧响应/别的列表)⇒ 不得被读成任何一种结论', () => {
    const v = fingerprintVerdict({ ...DEVICE })
    expect([v.label, v.note]).toEqual([null, null])
  })

  it('反向对照:非设备行(ip/user)即使带着 false 也不渲染设备闸结论', () => {
    const v = fingerprintVerdict({ type: 'ip', discriminating: false, matchedUserCount: 9 })
    expect(v.label).toBe(null)
  })

  it('withheldUserCount=0 ⇒ 不写"另 0 个未外发"(没有截断就别报截断)', () => {
    const v = fingerprintVerdict({
      ...DEVICE,
      discriminating: false,
      matchedUserCount: 3,
      withheldUserCount: 0,
    })
    expect(v.label).toBe('指纹不具区分度 · 命中 3 个账号')
  })

  it('命中数缺席 ⇒ 徽章仍要说"不具区分度",但绝不显示 0 冒充"命中 0 个"', () => {
    const v = fingerprintVerdict({ ...DEVICE, discriminating: false })
    expect(v.label).toBe('指纹不具区分度')
    expect(v.countKnown).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
