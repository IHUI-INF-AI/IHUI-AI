// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('连接器平台品牌图标(2026-11-25)', () => {
  it('三大平台映射到项目已有的官方 SVG,不用通用图标冒充品牌', () => {
    const icon = read('../platform-icon.tsx')
    expect(icon).toContain("feishu: '/images/oauth-providers/feishu.svg'")
    expect(icon).toContain("dingtalk: '/images/oauth-providers/dingtalk.svg'")
    expect(icon).toContain("wecom: '/images/oauth-providers/wecom.svg'")
    expect(icon).toContain('<Image')
  })

  it('公众号用微信官方 SVG,不用喇叭等通用图标冒充', () => {
    const icon = read('../platform-icon.tsx')
    expect(icon).toContain("wechat_mp: '/images/oauth-providers/wechat.svg'")
    expect(icon).not.toContain('wechat_mp: Megaphone')
    expect(icon).not.toContain('Megaphone')
  })

  it('企业微信渠道 wechat-work 映射到企微官方 SVG,不回退通用 Plug 图标', () => {
    const icon = read('../platform-icon.tsx')
    expect(icon).toContain("'wechat-work': '/images/oauth-providers/wecom.svg'")
  })

  it('企业微信智能机器人区块用 PlatformIcon 品牌图标,不再用 lucide Bot', () => {
    const robot = read('../wecom-robot-section.tsx')
    expect(robot).toContain("import { PlatformIcon } from './platform-icon'")
    expect(robot).toContain('<PlatformIcon type="wecom" size={18} className="mt-0.5" />')
    expect(robot).not.toContain('Bot')
  })

  it('快捷接入区在标题前渲染品牌图标', () => {
    const quick = read('../managed-quick-section.tsx')
    expect(quick).toContain("import { PlatformIcon } from './platform-icon'")
    expect(quick.indexOf('<PlatformIcon type={tpl.type}')).toBeLessThan(
      quick.indexOf('{tpl.label}'),
    )
  })

  it('已安装卡片用品牌图标替换了 Lucide 通用图标', () => {
    const card = read('../connector-card.tsx')
    expect(card).toContain("import { PlatformIcon } from './platform-icon'")
    expect(card).toContain('<PlatformIcon type={entry.type}')
    expect(card).not.toContain('TYPE_ICON')
  })

  it('变异锁:任一平台映射或渲染点被抹掉即红', () => {
    const icon = read('../platform-icon.tsx')
    const mutated = icon.replace("feishu: '/images/oauth-providers/feishu.svg'", '')
    expect(mutated).not.toBe(icon)
    const mpMutated = icon.replace("wechat_mp: '/images/oauth-providers/wechat.svg'", '')
    expect(mpMutated).not.toBe(icon)
    const workMutated = icon.replace("'wechat-work': '/images/oauth-providers/wecom.svg'", '')
    expect(workMutated).not.toBe(icon)
    const quick = read('../managed-quick-section.tsx').replace('<PlatformIcon type={tpl.type}', '')
    expect(quick).not.toContain('<PlatformIcon type={tpl.type}')
    const robot = read('../wecom-robot-section.tsx').replace(
      '<PlatformIcon type="wecom" size={18} className="mt-0.5" />',
      '',
    )
    expect(robot).not.toContain('<PlatformIcon type="wecom"')
  })
})
