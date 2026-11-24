// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 阳性证明:web agreement 两页已退成共享屏壳;阴性对照:把共享屏入口换回 inline Card/SafeHtml
// 或删掉视图模型映射,下列断言立即转红。
//
// 说明:真实像素/截图基线无法在当前离线 node_modules 状态下起 Next 开发服务器(详见交付报告),
// 这里用源码接线断言 + 视图模型等价断言锁定「页面只做注入」这一结构事实。

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  AGREEMENT_TYPE_MAP,
  agreementFallbackTitle,
  normalizeAgreementType,
  toAgreementContentView,
} from '../../../../src/lib/rn-pilot/agreement-view-model'

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8')

const typePage = read('app/(main)/agreement/[type]/PageClient.tsx')
const tabbedPage = read('app/(main)/agreement/PageClient.tsx')

describe('web agreement 共享屏壳 · 结构接线', () => {
  it('两页都只经 @ihui/rn-app/pilot 消费共享 AgreementScreen', () => {
    for (const source of [typePage, tabbedPage]) {
      expect(source).toContain("from '@ihui/rn-app/pilot'")
      expect(source).toContain('AgreementScreen')
      // 只允许 pilot 入口,禁止绕到包根或子路径(会把 249 屏编译闭包拉进 web 路由)
      expect(
        source.match(/@ihui\/rn-app\/[a-zA-Z0-9-]+/g)?.every((m) => m === '@ihui/rn-app/pilot'),
      ).toBe(true)
    }
  })

  it('两页都不再持有页内协议渲染(Card/SafeHtml/prose/Loader2/元信息图标)', () => {
    for (const source of [typePage, tabbedPage]) {
      expect(source).not.toContain('SafeHtml')
      expect(source).not.toContain('prose prose-sm')
      expect(source).not.toContain('Loader2')
      expect(source).not.toContain('Calendar')
      expect(source).not.toContain('CardContent')
      expect(source).not.toContain('CardHeader')
      expect(source).not.toContain('CardTitle')
    }
    expect(typePage).not.toContain('FileText')
    // 切换页保留类型切换条(这是共享屏没有的页内导航,属于壳职责)
    expect(tabbedPage).toContain('TABS.map')
  })

  it('[type] 页保留取数与三条注入:视图模型 / loading / 回退标题', () => {
    expect(typePage).toContain('toAgreementContentView(data)')
    expect(typePage).toContain('loading={isLoading}')
    expect(typePage).toContain('fallbackTitle={agreementFallbackTitle(apiType, rawType)}')
    // 改造前该页返回是 <Link href="/">,onBack 目标必须保持 '/'
    expect(typePage).toContain("router.push('/')")
  })

  it('切换页返回走浏览器历史,且不与顶栏 BackButton 重复注册', () => {
    expect(tabbedPage).toContain('router.back()')
    expect(tabbedPage).not.toContain('BackButton')
  })
})

describe('web agreement 共享屏视图模型 · 字段等价', () => {
  it('路由 type 归一化与后端口径一致', () => {
    expect(normalizeAgreementType('user')).toBe('user-agreement')
    expect(normalizeAgreementType('privacy')).toBe('privacy-policy')
    expect(normalizeAgreementType('terms')).toBe('terms-of-service')
    expect(normalizeAgreementType('unknown-type')).toBe('unknown-type')
    expect(Object.keys(AGREEMENT_TYPE_MAP)).toHaveLength(8)
  })

  it('回退标题保持改造前 web 的 zh 文案与未知 type 透传', () => {
    expect(agreementFallbackTitle('privacy-policy', 'privacy')).toBe('隐私政策')
    expect(agreementFallbackTitle('user-agreement', 'user')).toBe('用户协议')
    expect(agreementFallbackTitle('unknown-type', 'unknown-type')).toBe('unknown-type')
  })

  it('请求体字段原样进入共享屏视图模型(不丢字段、不改值)', () => {
    expect(
      toAgreementContentView({
        id: 'a1',
        title: '隐私政策',
        content: '<p>正文</p>',
        version: 'v2.1',
        effectiveDate: '2026-07-19T00:00:00.000Z',
        type: 'privacy-policy',
      }),
    ).toEqual({
      title: '隐私政策',
      content: '<p>正文</p>',
      version: 'v2.1',
      effectiveDate: '2026-07-19T00:00:00.000Z',
    })
  })

  it('缺 version/effectiveDate 时保持 null,不伪造默认值', () => {
    expect(toAgreementContentView({ id: 'a2', title: '免责声明', content: '正文' })).toEqual({
      title: '免责声明',
      content: '正文',
      version: null,
      effectiveDate: null,
    })
  })

  it('无数据返回 null,由共享屏走 loading/静态兜底分支', () => {
    expect(toAgreementContentView(undefined)).toBeNull()
    expect(toAgreementContentView(null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
