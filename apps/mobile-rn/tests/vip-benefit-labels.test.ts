// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toVipBenefitItems } from '../src/utils/vip-benefits'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const KEYS = ['unlimitedChat', 'exclusiveModel', 'prioritySupport', 'referral'] as const

const readPack = (end: string, loc: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', end, `${loc}.json`), 'utf8')) as {
    vip?: { benefitList?: Record<string, string> }
  }

describe('VIP 权益键族 —— mobile-rn 会员权益屏的译名与投影', () => {
  it('五语言齐备,且逐字等于 web 那一份权威表(不是另译一遍)', () => {
    for (const loc of LOCALES) {
      const web = readPack('web', loc).vip?.benefitList
      const rn = readPack('mobile-rn', loc).vip?.benefitList
      expect(web, `web/${loc} 的权威表缺席 ⇒ 本用例的"搬运"前提不成立`).toBeTruthy()
      expect(rn, `mobile-rn/${loc} 缺 vip.benefitList`).toBeTruthy()
      for (const k of KEYS) {
        expect(typeof rn?.[k]).toBe('string')
        expect(rn?.[k]?.length, `${loc}.${k} 空串`).toBeGreaterThan(0)
        expect(rn?.[k]).toBe(web?.[k])
      }
    }
  })

  it('按档位摊平成四键行:键走译名、未登记的键原样、非数组 benefits 不炸', () => {
    const t = (key: string) => `‹${key}›`
    const rows = [
      { id: 'L1', levelName: '月度会员', benefits: ['unlimitedChat', 'exclusiveModel'] },
      { id: 'L2', levelName: '年度会员', benefits: ['referral', 7, null, 'brandNewKey'] },
      { id: 'L3', levelName: '测试档', benefits: '不是数组' },
      { id: 'L4', levelName: '缺列档' },
    ]
    const out = toVipBenefitItems(rows, t)
    expect(out).toEqual([
      {
        id: 'L1:unlimitedChat',
        name: '‹vip.benefitList.unlimitedChat›',
        desc: '',
        level: '月度会员',
      },
      {
        id: 'L1:exclusiveModel',
        name: '‹vip.benefitList.exclusiveModel›',
        desc: '',
        level: '月度会员',
      },
      { id: 'L2:referral', name: '‹vip.benefitList.referral›', desc: '', level: '年度会员' },
      // 库里没登记译名的键不许在端内拼中文:原样透出,与 web 权益页同口径
      { id: 'L2:brandNewKey', name: 'brandNewKey', desc: '', level: '年度会员' },
    ])
    // 阳性对照:非数组 / 缺列两支确实被摊平成 0 行,而不是抛错或被当成一条
    expect(out.map((o) => o.id)).not.toContain('L3:undefined')
  })

  it('生产真实形态回归:四键全登记的那行必须四条都走译名', () => {
    const t = (key: string) =>
      readPack('mobile-rn', 'zh-CN').vip?.benefitList?.[key.split('.').pop() as string] ?? key
    const out = toVipBenefitItems(
      [
        {
          id: 'real',
          levelName: '月度会员',
          benefits: ['unlimitedChat', 'exclusiveModel', 'prioritySupport', 'referral'],
        },
      ],
      t,
    )
    expect(out.map((o) => o.name)).toEqual(['无限对话', '专属模型', '优先支持', '推荐奖励'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
