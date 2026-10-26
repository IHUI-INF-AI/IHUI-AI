// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访问面分桶取证(2026-10-25 立)。
 *
 * 立因:2026-10-25 起埋点覆盖全站(前台/后台/登录页),指标口径不能再靠"前端丢弃
 * admin 访问"来保证纯净 —— 分桶判据收进 `visit-tracking-queries` 一处,本用例钉住
 * 它的语义:前缀判定、四值枚举、'all' 不产生过滤条件。
 *
 * 零连接:不碰 PG/Redis(mock db 模块),只判纯函数与形状。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {} }))

import {
  classifyVisitScope,
  visitScopeFilter,
  visitPlatformFilter,
  classifyVisitPlatform,
  VISIT_PLATFORM_PATH_PREFIXES,
  VISIT_SCOPE_VALUES,
  VISIT_PLATFORM_VALUES,
} from '../src/db/visit-tracking-queries.js'

describe('classifyVisitScope', () => {
  it('后台页面 → admin', () => {
    expect(classifyVisitScope('/admin')).toBe('admin')
    expect(classifyVisitScope('/admin/visit-tracking')).toBe('admin')
    expect(classifyVisitScope('/admin/monitor/wallboard?full=1')).toBe('admin')
  })

  it('登录/注册/SSO → auth', () => {
    expect(classifyVisitScope('/login')).toBe('auth')
    expect(classifyVisitScope('/login?redirect=/admin')).toBe('auth')
    expect(classifyVisitScope('/register')).toBe('auth')
    expect(classifyVisitScope('/sso/callback')).toBe('auth')
  })

  it('其余页面与空值 → public', () => {
    expect(classifyVisitScope('/')).toBe('public')
    expect(classifyVisitScope('/ai-world')).toBe('public')
    expect(classifyVisitScope('/administrator-guide')).toBe('admin')
    expect(classifyVisitScope(null)).toBe('public')
    expect(classifyVisitScope(undefined)).toBe('public')
  })
})

describe('visitScopeFilter', () => {
  it("'all'/缺省不产生条件(明细取证面看全量)", () => {
    expect(visitScopeFilter('all')).toBeUndefined()
    expect(visitScopeFilter(undefined)).toBeUndefined()
  })

  it('三个具体面都产出 SQL 条件', () => {
    expect(visitScopeFilter('public')).toBeDefined()
    expect(visitScopeFilter('admin')).toBeDefined()
    expect(visitScopeFilter('auth')).toBeDefined()
  })

  it('枚举覆盖四档,新增一档必须同步判据', () => {
    expect([...VISIT_SCOPE_VALUES]).toEqual(['public', 'admin', 'auth', 'all'])
  })
})

describe('visitPlatformFilter', () => {
  it("'all'/缺省不产生条件", () => {
    expect(visitPlatformFilter('all')).toBeUndefined()
    expect(visitPlatformFilter(undefined)).toBeUndefined()
  })

  it('四端各自产出条件', () => {
    expect(visitPlatformFilter('web')).toBeDefined()
    expect(visitPlatformFilter('rn')).toBeDefined()
    expect(visitPlatformFilter('mp')).toBeDefined()
    expect(visitPlatformFilter('ex')).toBeDefined()
  })

  it('枚举覆盖五档,新增一端必须同步判据', () => {
    expect([...VISIT_PLATFORM_VALUES]).toEqual(['web', 'rn', 'mp', 'ex', 'all'])
  })

  it('前缀词表与枚举配对:除 web 外每端都有前缀,web 不登记(按"不落在任何前缀"归桶)', () => {
    expect(Object.keys(VISIT_PLATFORM_PATH_PREFIXES).sort()).toEqual(['ex', 'mp', 'rn'])
    for (const platform of VISIT_PLATFORM_VALUES) {
      if (platform === 'all') continue
      const hasPrefix = Object.prototype.hasOwnProperty.call(VISIT_PLATFORM_PATH_PREFIXES, platform)
      expect(hasPrefix, `${platform} 端的前缀登记`).toBe(platform !== 'web')
    }
  })
})

describe('classifyVisitPlatform', () => {
  it('按端前缀归桶', () => {
    expect(classifyVisitPlatform('/rn/Home')).toBe('rn')
    expect(classifyVisitPlatform('/mp/pages/index/index')).toBe('mp')
    expect(classifyVisitPlatform('/ex/sidepanel/chat')).toBe('ex')
    expect(classifyVisitPlatform('/agents')).toBe('web')
    expect(classifyVisitPlatform(null)).toBe('web')
    expect(classifyVisitPlatform('   ')).toBe('web')
  })

  it('插件路径不得被误算进后台或登录面(scope 仍 public)', () => {
    expect(classifyVisitScope('/ex/sidepanel/settings')).toBe('public')
    expect(classifyVisitScope('/ex/popup')).toBe('public')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
