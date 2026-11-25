// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../../../..')
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('微信自动化入口卡片(微信智联 wechat-hub)', () => {
  it('复用真实 api-client 的微信智联端点,不是假状态卡片', () => {
    const src = read('../wechat-hub-section.tsx')
    expect(src).toContain("from '@ihui/api-client'")
    expect(src).toContain('fetchWechatAccounts')
    expect(src).toContain('fetchWechatCapabilities')
    expect(src).toContain('type { WechatAccountView, WechatBackendCapability }')
  })

  it('跳转到完整微信智联管理台(不重复造功能)', () => {
    const src = read('../wechat-hub-section.tsx')
    expect(src).toContain('href="/admin/wechat-hub"')
  })

  it('账号状态映射覆盖全部 6 个真实枚举值', () => {
    const src = read('../wechat-hub-section.tsx')
    for (const s of ['online', 'connecting', 'awaiting_scan', 'expired', 'error', 'disconnected']) {
      expect(src).toContain(`${s}:`)
    }
  })

  it('用微信官方图标,不用通用图标冒充', () => {
    const src = read('../wechat-hub-section.tsx')
    expect(src).toContain('<PlatformIcon type="wechat"')
  })

  it('连接器页已挂载微信智联入口区块', () => {
    const page = readFileSync(
      resolve(root, 'apps/web/app/(main)/connectors/PageClient.tsx'),
      'utf8',
    )
    expect(page).toContain(
      "import { WechatHubSection } from '@/components/connectors/wechat-hub-section'",
    )
    expect(page).toContain('<WechatHubSection />')
  })

  it('五语 i18n 齐全(变异锁:缺任一语种即红)', () => {
    const langs = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
    for (const lang of langs) {
      const json = JSON.parse(
        readFileSync(resolve(root, `packages/i18n/messages/web/${lang}.json`), 'utf8'),
      )
      expect(json.connectors).toHaveProperty('wechatHubTitle')
      expect(json.connectors).toHaveProperty('wechatHubConfigure')
    }
  })
})
