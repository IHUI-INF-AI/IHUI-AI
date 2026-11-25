// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mergeWechatChannels } from '../wechat-clawbot-merge'

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
    const src = read('../wechat-clawbot-merge.ts')
    expect(src).toContain("new Set(['wechat', 'wechat_mp', 'wechat-work'])")
  })

  it('按 type 去重:已登记与候选同名渠道只显示一条,已登记真实状态优先', () => {
    const registered = [
      { id: 'ch-wechat', type: 'wechat', name: '微信公众号', connected: true },
    ] as Parameters<typeof mergeWechatChannels>[0]
    const supported = [
      { id: 'sup-wechat', type: 'wechat', name: '微信公众号', connected: false },
      { id: 'sup-wechat-mp', type: 'wechat_mp', name: '微信小程序', connected: false },
      { id: 'sup-dingtalk', type: 'dingtalk', name: '钉钉', connected: false },
    ] as Parameters<typeof mergeWechatChannels>[1]
    const merged = mergeWechatChannels(registered, supported)
    // 微信系只剩两条:wechat(已登记覆盖候选)、wechat_mp;钉钉被过滤
    expect(merged).toHaveLength(2)
    const wx = merged.find((c) => c.type === 'wechat')
    expect(wx).toMatchObject({ id: 'ch-wechat', name: '微信公众号', connected: true })
    expect(merged.filter((c) => c.name === '微信公众号')).toHaveLength(1)
    expect(merged.find((c) => c.type === 'wechat_mp')).toMatchObject({
      id: 'sup-wechat-mp',
      connected: false,
    })
  })

  it('变异锁:组件不得回退到按 id 合并(否则两个\"微信公众号\"重现)', () => {
    const src = read('../wechat-clawbot-section.tsx')
    expect(src).toContain('mergeWechatChannels(registered, supported)')
    expect(src).not.toContain('const byId = new Map')
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
