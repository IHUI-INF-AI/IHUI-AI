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
  mergePlatformRows,
  foldHourlyRows,
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

describe('mergePlatformRows(端接入史合并)', () => {
  it('90 日无量的端也要留在表上,并把 lastSeenAt 带过来', () => {
    const rows = mergePlatformRows(
      [{ platform: 'web', pv: '4000', uv: '280' }],
      [
        { platform: 'web', pv90d: '9200', lastSeenAt: '2026-10-26T00:00:00Z' },
        { platform: 'ex', pv90d: '5', lastSeenAt: '2026-10-20T00:00:00Z' },
      ],
    )
    const web = rows.find((r) => r.platform === 'web')
    const ex = rows.find((r) => r.platform === 'ex')
    const mp = rows.find((r) => r.platform === 'mp')
    expect(web).toMatchObject({ pv: 4000, uv: 280, pv90d: 9200 })
    // 24h 零量但 90 日有量:这正是"今日静默"那一格
    expect(ex).toMatchObject({ pv: 0, uv: 0, pv90d: 5 })
    // 两向都零:是"从未上报",不能与上一条混成同一个读数
    expect(mp).toMatchObject({ pv: 0, pv90d: 0, lastSeenAt: null })
    expect(rows[0]?.platform).toBe('web')
  })

  it('两腿都空时仍返回四端零行(表不会整块消失)', () => {
    const rows = mergePlatformRows([], [])
    expect(rows.map((r) => r.platform).sort()).toEqual(['ex', 'mp', 'rn', 'web'])
    expect(rows.every((r) => r.pv === 0 && r.pv90d === 0 && r.lastSeenAt === null)).toBe(true)
  })
})

describe('foldHourlyRows(2026-10-27 分时访问:小时桶归一)', () => {
  it('E1 字符串数字也认(PG int4 经某些驱动回传字符串时不得读成 0)', () => {
    const rows = foldHourlyRows([
      { hour: '08', pv: '12', uv: '3' },
      { hour: '09', pv: 5, uv: 2 },
    ])
    expect(rows).toEqual([
      { hour: '08', pv: 12, uv: 3 },
      { hour: '09', pv: 5, uv: 2 },
    ])
  })

  it('E2 非法数字落 0(「取不到」与「取到 0」在这一格同值,不冒充负数/NaN)', () => {
    const rows = foldHourlyRows([{ hour: '10', pv: 'NaN', uv: -3 }, { hour: '11' }])
    expect(rows).toEqual([
      { hour: '10', pv: 0, uv: 0 },
      { hour: '11', pv: 0, uv: 0 },
    ])
  })

  it('E3 小时桶钳成两位(个位小时不得画错横轴位置)', () => {
    const rows = foldHourlyRows([{ hour: '7', pv: 1, uv: 1 }])
    expect(rows[0]?.hour).toBe('07')
  })

  it('E4 只做归一不做排序/补桶(顺序是 SQL ORDER BY 的承诺,空桶是真 0 不是缺行)', () => {
    const rows = foldHourlyRows([
      { hour: '23', pv: 1, uv: 1 },
      { hour: '00', pv: 2, uv: 2 },
    ])
    // 输入顺序原样返回 —— 前端按桶键取值,不在两处各排一次
    expect(rows.map((r) => r.hour)).toEqual(['23', '00'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
