// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面地域分流的判据测试(纯函数档 + 两条形状锁)。
 *
 * 成对给夹具是刻意的:每一档"选国内腿"的条件都必须同时给出"摘掉该条件即退回 GitHub"的反例,
 * 否则这条判据可以被人整颗关掉而测试全绿(本仓最高频失效型)。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assetNameFromHref,
  isSafeAssetName,
  originAllowed,
  pageBaseOrigin,
  pickDesktopLeg,
  RELEASE_TARGET_ALLOWED_ORIGINS,
} from '@/lib/desktop-download-leg'

const ORIGIN =
  'https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe'
const CN =
  'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe'

describe('pickDesktopLeg:只有"CN ∧ 字节等值 ∧ 国内腿在位"三条同时成立才走 Gitee', () => {
  it('CN + same ⇒ 国内腿', () => {
    const r = pickDesktopLeg({ countryCode: 'CN', parity: 'same', originUrl: ORIGIN, cnUrl: CN })
    expect(r?.leg).toBe('cn')
    expect(r?.url).toBe(CN)
  })
  it('反向①:parity=different ⇒ 退回 GitHub(0.1.75 那型冒名旧包)', () => {
    expect(
      pickDesktopLeg({ countryCode: 'CN', parity: 'different', originUrl: ORIGIN, cnUrl: CN })?.leg,
    ).toBe('origin')
  })
  it('反向②:parity=undetermined ⇒ 退回 GitHub(量不到不猜快腿)', () => {
    expect(
      pickDesktopLeg({ countryCode: 'CN', parity: 'undetermined', originUrl: ORIGIN, cnUrl: CN })
        ?.leg,
    ).toBe('origin')
  })
  it('反向③:parity=null(压根没做对账)⇒ 退回 GitHub', () => {
    expect(
      pickDesktopLeg({ countryCode: 'CN', parity: null, originUrl: ORIGIN, cnUrl: CN })?.leg,
    ).toBe('origin')
  })
  it('反向④:摘掉国内腿 ⇒ 只能走权威腿', () => {
    expect(
      pickDesktopLeg({ countryCode: 'CN', parity: 'same', originUrl: ORIGIN, cnUrl: null })?.leg,
    ).toBe('origin')
  })
  it.each(['US', 'JP', 'DE', 'HK', 'MO', 'TW'])(
    '%s ⇒ 权威腿(地域不是"我猜它在国内"的理由)',
    (cc) => {
      expect(
        pickDesktopLeg({ countryCode: cc, parity: 'same', originUrl: ORIGIN, cnUrl: CN })?.leg,
      ).toBe('origin')
    },
  )
  it('无地域信号 ⇒ 保持现状走国内腿(入口换三层时,"没信号"读成"海外"= 静默把全国访客推去 GitHub)', () => {
    for (const cc of [null, undefined, '', '  ']) {
      const r = pickDesktopLeg({ countryCode: cc, parity: 'same', originUrl: ORIGIN, cnUrl: CN })
      expect(r?.leg).toBe('cn')
      expect(r?.reason).toContain('保持现状')
    }
  })
  it('反向:无信号但字节不等/没对账 ⇒ 仍退回 GitHub(没信号不等于免检)', () => {
    for (const p of ['different', 'undetermined', null] as const) {
      expect(
        pickDesktopLeg({ countryCode: '', parity: p, originUrl: ORIGIN, cnUrl: CN })?.leg,
      ).toBe('origin')
    }
  })
  it('小写国家码要归一(CF 给的就是大写,但请求方可给小写)', () => {
    expect(
      pickDesktopLeg({ countryCode: 'cn', parity: 'same', originUrl: ORIGIN, cnUrl: CN })?.leg,
    ).toBe('cn')
  })
  it('权威腿取不到 ⇒ 如实降级到国内腿,而不是 404', () => {
    const r = pickDesktopLeg({ countryCode: 'US', parity: 'same', originUrl: null, cnUrl: CN })
    expect(r?.leg).toBe('cn')
    expect(r?.reason).toContain('取不到')
  })
  it('两条腿都没有 ⇒ null(调用方 404/回落页面)', () => {
    expect(
      pickDesktopLeg({ countryCode: 'CN', parity: 'same', originUrl: '', cnUrl: undefined }),
    ).toBeNull()
  })
  it('不在白名单 origin 的"腿"一律不算在位(白名单是唯一放行通道)', () => {
    const evil = 'https://attacker.example/x.exe'
    // 两条腿都不在清单内 ⇒ null:宁可不跳(调用方回落下载页),也不把访客送给陌生域
    expect(
      pickDesktopLeg({ countryCode: 'CN', parity: 'same', originUrl: evil, cnUrl: evil }),
    ).toBeNull()
    // 只有一条在清单内 ⇒ 只能选那条
    expect(
      pickDesktopLeg({ countryCode: 'CN', parity: 'same', originUrl: evil, cnUrl: CN })?.url,
    ).toBe(CN)
  })
})

describe('文件名与落点的输入面', () => {
  it.each([
    'AI_0.1.77_x64-setup.exe',
    'AI_0.1.77_universal.dmg',
    'AI_0.1.77_amd64.AppImage',
    'ihui ai-1.0.0.x64.crx',
  ])('合法资产名通过:%s', (n) => {
    expect(isSafeAssetName(n)).toBe(true)
  })
  it.each([
    '',
    '../etc/passwd',
    'a/b.exe',
    'a\\b.exe',
    'https://attacker.example/x',
    '-lead-dash.exe',
    'javascript:alert(1)',
    'x'.repeat(200),
  ])('非法输入被拒:%s', (n) => {
    expect(isSafeAssetName(n)).toBe(false)
  })
  it('gitee 直链的 encodeURIComponent 形态要能反解回文件名', () => {
    expect(
      assetNameFromHref(
        'https://gitee.com/o/r/releases/download/desktop-v0.1.77/AI_0.1.77_x64-setup.exe',
      ),
    ).toBe('AI_0.1.77_x64-setup.exe')
    expect(assetNameFromHref('https://gitee.com/o/r/releases/download/t/ihui%20ai.crx')).toBe(
      'ihui ai.crx',
    )
  })
  it('originAllowed 只认清单内 origin,前缀伪装与非法协议都不放过', () => {
    expect(originAllowed(CN)).toBe(true)
    expect(originAllowed(ORIGIN)).toBe(true)
    expect(originAllowed('https://gitee.com.evil.example/x')).toBe(false)
    expect(originAllowed('https://attacker.example/x.exe')).toBe(false)
    expect(originAllowed('javascript:alert(1)')).toBe(false)
  })
})

describe('形状锁:落点清单必须是字面量,调用点必须交出它', () => {
  it('白名单是字符串字面量数组(门 278 的"字面量对象"同纪律:拼变量就等于把判据交出去)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/desktop-download-leg.ts'), 'utf8')
    const block = src.slice(
      src.indexOf('export const RELEASE_TARGET_ALLOWED_ORIGINS'),
      src.indexOf('export const RELEASE_TARGET_ALLOWED_ORIGINS') + 420,
    )
    expect(block).toMatch(/=\s*\[\s*\n?\s*'https:\/\//)
    expect(block).not.toMatch(/\$\{|process\.env|\.map\(/)
    expect(RELEASE_TARGET_ALLOWED_ORIGINS.length).toBeGreaterThanOrEqual(3)
  })
  it('route 调用点必须显式交 allowedOrigins 并带 no-store(否则地域决策会被缓存污染)', () => {
    const src = readFileSync(join(process.cwd(), 'app/dl/desktop/route.ts'), 'utf8')
    expect(src).toMatch(
      /isSafeNavigationTarget\([\s\S]{0,120}allowedOrigins:\s*\[\.\.\.RELEASE_TARGET_ALLOWED_ORIGINS\]/,
    )
    expect(src.match(/private, no-store/g)?.length).toBeGreaterThanOrEqual(2)
    // 反向:回跳目标不得来自请求参数
    expect(src).not.toMatch(/redirect\(\s*new URL\(\s*(url\.searchParams|[a-z]+\.(file|url))/)
  })
})

describe('兜底跳转的 origin 解析(pageBaseOrigin,2026-11-04 实测缺陷回归)', () => {
  const MAIN = 'https://aizhs.top'
  const call = (over: Partial<Parameters<typeof pageBaseOrigin>[0]>) =>
    pageBaseOrigin({ requestOrigin: 'http://localhost:8852', mainDomainOrigin: MAIN, ...over })

  it('公网经蓝绿/路由:转发头是主域 ⇒ 用主域,不再吐内网 origin(线上实测曾返回 https://localhost:8852)', () => {
    expect(call({ forwardedHost: 'www.aizhs.top', forwardedProto: 'https' })).toBe(
      'https://www.aizhs.top',
    )
    expect(call({ forwardedHost: 'aizhs.top', forwardedProto: 'https, https' })).toBe(
      'https://aizhs.top',
    )
  })

  it('伪造 Host 不得被跟走:转发头不是主域 ⇒ 回落配置化主域 origin', () => {
    expect(call({ forwardedHost: 'evil.example.com' })).toBe(MAIN)
    expect(call({ forwardedHost: 'localhost', forwardedProto: 'https' })).toBe(MAIN)
    expect(call({ forwardedHost: 'for=1.2.3.4;host=www.aizhs.top' })).toBe(MAIN)
  })

  it('带端口的转发主机一律不采信(端口是内网口的可能)', () => {
    expect(call({ forwardedHost: 'www.aizhs.top:8852' })).toBe(MAIN)
  })

  it('真·本机直连(无转发头)时保留请求自己的 origin,本地开发不跳公网', () => {
    expect(call({ requestOrigin: 'http://localhost:3000', forwardedHost: null })).toBe(
      'http://localhost:3000',
    )
    expect(call({ requestOrigin: 'http://127.0.0.1:8852', forwardedHost: undefined })).toBe(
      'http://127.0.0.1:8852',
    )
  })

  it('主域直连(无转发头)也保留自己的 origin;解析不了的 origin 回落主域', () => {
    expect(call({ requestOrigin: 'https://www.aizhs.top', forwardedHost: null })).toBe(
      'https://www.aizhs.top',
    )
    expect(call({ requestOrigin: 'not-a-url', forwardedHost: null })).toBe(MAIN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
