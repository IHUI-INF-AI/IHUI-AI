// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../../../..')
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('微信 Clawbot 连接器(2026-11-25)', () => {
  it('组件复用真实用户态 OpenClaw channels API,不是假状态卡片', () => {
    const src = read('../wechat-clawbot-section.tsx')
    expect(src).toContain("from '@/lib/openclaw-api'")
    expect(src).toContain('listChannels')
    expect(src).toContain('listSupportedChannels')
    expect(src).toContain('connectChannel')
    expect(src).toContain('disconnectChannel')
  })

  it('筛选微信系渠道类型', () => {
    const src = read('../wechat-clawbot-section.tsx')
    expect(src).toContain("new Set(['wechat', 'wechat_mp', 'wechat-work'])")
  })

  it('用微信官方图标,不用通用图标冒充', () => {
    const src = read('../wechat-clawbot-section.tsx')
    const icon = read('../platform-icon.tsx')
    expect(src).toContain('<PlatformIcon type="wechat"')
    expect(icon).toContain("wechat: '/images/oauth-providers/wechat.svg'")
  })

  it('连接器页已挂载微信 Clawbot 区块', () => {
    const page = readFileSync(
      resolve(root, 'apps/web/app/(main)/connectors/PageClient.tsx'),
      'utf8',
    )
    expect(page).toContain(
      "import { WechatClawbotSection } from '@/components/connectors/wechat-clawbot-section'",
    )
    expect(page).toContain('<WechatClawbotSection />')
  })

  it('五语 i18n 齐全(变异锁:缺任一语种即红)', () => {
    const langs = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
    for (const lang of langs) {
      const json = JSON.parse(
        readFileSync(resolve(root, `packages/i18n/messages/web/${lang}.json`), 'utf8'),
      )
      expect(json.connectors).toHaveProperty('wechatClawbotTitle')
      expect(json.connectors).toHaveProperty('wechatClawbotConnect')
      expect(json.connectors).toHaveProperty('wechatClawbotConfigure')
    }
  })
})
