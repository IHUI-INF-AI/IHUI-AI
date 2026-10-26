// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { isVisitPathReportable, normalizeVisitPath } from '../visit-url.js'

/**
 * 页面路径归一唯一判据(2026-10-26 立)。
 *
 * 样本全部取自**生产库现读**(`visit_logs.url` 的真实脏值),不是编的:
 * 见 `apps/api/scripts/normalize-visit-paths.mts` 的取证口径。
 */
describe('normalizeVisitPath(页面路径唯一归一判据)', () => {
  it('同一页面的不同 query 归到同一路径(页面维度口径)', () => {
    // 生产实值:会话级 URL 曾与页面 URL 各占一行,把「页面数」撑到 235(真实 ~30)。
    expect(normalizeVisitPath('/chat?conversationId=40c9df01-5fd3-4cb0-8b51-d1a98fe213a6')).toBe(
      '/chat',
    )
    expect(normalizeVisitPath('/chat')).toBe('/chat')
    expect(normalizeVisitPath('/models?provider=google')).toBe('/models')
    expect(normalizeVisitPath('/support?source=enterprise&type=refund')).toBe('/support')
  })

  it('授权凭据段随 query 一并去掉(历史行里它曾直接上屏)', () => {
    // 生产实值:SSO 授权码与微信 OAuth 的 code+state 都曾落库并显示在「页面访问排行」。
    expect(normalizeVisitPath('/?sso_code=B-ZKi3yQwCUOS1LCKFw6XWvez-5Sx1JfJzRY5J-gkGE')).toBe('/')
    expect(
      normalizeVisitPath(
        '/callback?platform=wechat&code=001uTNFa1pE9oM0u48Ia1hz1ok2uTNFe&state=024bed8f6e192559f6582f308beea729',
      ),
    ).toBe('/callback')
    expect(normalizeVisitPath('/sso/login?redirect=%2Fadmin%2Fusers')).toBe('/sso/login')
  })

  it('尾部脏分隔符与尾斜杠归一(生产实值 `/agents,`)', () => {
    expect(normalizeVisitPath('/agents,')).toBe('/agents')
    expect(normalizeVisitPath('/agents/')).toBe('/agents')
    expect(normalizeVisitPath('/agents;')).toBe('/agents')
    expect(normalizeVisitPath('/agents/')).toBe('/agents')
  })

  it('fragment 与空白不参与页面身份', () => {
    expect(normalizeVisitPath('/chat#anchor')).toBe('/chat')
    expect(normalizeVisitPath('  /chat  ')).toBe('/chat')
  })

  it('路由组形态不是页面(生产实值 `/(marketing)`)', () => {
    expect(normalizeVisitPath('/(marketing)')).toBeNull()
    expect(normalizeVisitPath('/(main)/settings')).toBeNull()
  })

  it('静态资源后缀不是页面(生产实值 `/claude.md`)', () => {
    expect(normalizeVisitPath('/claude.md')).toBeNull()
    expect(normalizeVisitPath('/robots.txt')).toBeNull()
    expect(normalizeVisitPath('/sitemap.xml')).toBeNull()
    expect(normalizeVisitPath('/logo.png')).toBeNull()
  })

  it('根路径与普通路径原样保留', () => {
    expect(normalizeVisitPath('/')).toBe('/')
    expect(normalizeVisitPath('/')).toBe('/')
    expect(normalizeVisitPath('/sso/login')).toBe('/sso/login')
    expect(normalizeVisitPath('/admin/monitor/panels')).toBe('/admin/monitor/panels')
  })

  it('端前缀保留:端身份是分桶的一部分,不能剥', () => {
    expect(normalizeVisitPath('/rn/Home')).toBe('/rn/Home')
    expect(normalizeVisitPath('/mp/pages/ask/index')).toBe('/mp/pages/ask/index')
    expect(normalizeVisitPath('/ex/sidepanel/agents')).toBe('/ex/sidepanel/agents')
  })

  it('绝对 URL 只取 path(否则访问面分桶会被 `https://host/admin/x` 带偏)', () => {
    expect(normalizeVisitPath('https://aizhs.top/admin/users?x=1')).toBe('/admin/users')
    expect(normalizeVisitPath('https://aizhs.top')).toBe('/')
  })

  it('动态段归一:资源 id 不是页面身份(页面模板口径)', () => {
    // 生产实值:每个 workspace / agent 各占一行 ⇒ 页面数随资源数一路虚涨
    expect(normalizeVisitPath('/workspace/8cc904a4-01b1-4613-96c7-0df824b338d2')).toBe(
      '/workspace/:id',
    )
    expect(normalizeVisitPath('/agents/a54b86a8-294c-4e12-9768-91324cba7c3b')).toBe('/agents/:id')
    expect(normalizeVisitPath('/ai-world/items/ab5a0687-b0e9-47a0-bfd8-1fc17cab6897')).toBe(
      '/ai-world/items/:id',
    )
    expect(normalizeVisitPath('/courses/12345')).toBe('/courses/:id')
    // slug 是页面身份的一部分 ⇒ 不归一
    expect(normalizeVisitPath('/articles/my-slug')).toBe('/articles/my-slug')
    // 单数字段不归一(可能是版本号之类)
    expect(normalizeVisitPath('/v1')).toBe('/v1')
  })

  it('空与非串归一为 null(不是一次页面访问)', () => {
    expect(normalizeVisitPath(null)).toBeNull()
    expect(normalizeVisitPath(undefined)).toBeNull()
    expect(normalizeVisitPath('')).toBeNull()
    expect(normalizeVisitPath('   ')).toBeNull()
  })

  it('布尔壳与 null 判据同源', () => {
    expect(isVisitPathReportable('/chat?x=1')).toBe(true)
    expect(isVisitPathReportable('/claude.md')).toBe(false)
    expect(isVisitPathReportable(null)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
