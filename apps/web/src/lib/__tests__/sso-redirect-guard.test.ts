// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sso-redirect-guard 测试(2026-09-22 立)。
 *
 * 这个模块守的是"点了按钮没反应"的真实故障:守卫把受保护目标 307 打回 /sso/login 后,
 * 两个按钮(授权并跳转 / 关闭)的落点都变成"回到本页",用户感知为按钮失灵。
 *
 * 判定逻辑必须确定性、可证伪,故这里把四件事钉死:
 *  1. 同源相对路径的识别边界(跨源、协议相对、自定义协议深链都不该被当成受保护目标);
 *  2. 探测只认 opaqueredirect,**任何异常都不得判成"被拦"**(误拦会破坏正常跳转);
 *  3. 只有"被拦"才触发续期,且续期后再复测一次;
 *  4. 续期失败不向上抛(是否放行由复测决定,不由异常决定)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const refreshMock = vi.hoisted(() => vi.fn<() => Promise<string | null>>())

vi.mock('@ihui/api-client', () => ({ refreshAccessTokenOnce: refreshMock }))

import {
  isSameOriginRelative,
  isSafeNavigationTarget,
  resolveSafeRedirectTarget,
  isBlockedByAuthGuard,
  syncAuthCookie,
  ensureSsoRedirectAllowed,
} from '../sso-redirect-guard'

/** 构造探测响应:本模块只消费 type 字段 */
function probeResponse(type: ResponseType): Response {
  return { type, status: type === 'opaqueredirect' ? 0 : 200 } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  refreshMock.mockReset()
  refreshMock.mockResolvedValue('fresh-token')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isSameOriginRelative', () => {
  it('相对路径视为受守卫约束', () => {
    expect(isSameOriginRelative('/edu/edu-management/study-plan')).toBe(true)
    expect(isSameOriginRelative('/')).toBe(true)
  })

  it('协议相对 //host 不算同源相对', () => {
    expect(isSameOriginRelative('//evil.example.com/x')).toBe(false)
  })

  /**
   * 票 A3/G-413 补的第二类绕过(正反成对)。判据不是"看着危险",而是浏览器真的会走出去:
   * WHATWG 在 special scheme 的 "special authority ignore slashes" 状态里把 `\` 与 `/` 等值处理,
   * 下面这几条 node 实测(与浏览器同一套解析器)全部落到 evil.example.com:
   *   new URL('/\\evil.example.com/x', 'https://aizhs.top')  → https://evil.example.com/x
   *   new URL('/\\/\\evil.example.com', 'https://aizhs.top')  → https://evil.example.com/
   *   new URL('///evil.example.com', 'https://aizhs.top')     → https://evil.example.com/
   * 旧判据只挡 `//`,于是这三条都被当成"站内相对路径"放行。
   */
  it('反斜杠形态 /\\evil.com 不算同源相对(浏览器按 //evil.com 解析)', () => {
    expect(isSameOriginRelative('/\\evil.example.com/x')).toBe(false)
    expect(isSameOriginRelative('/\\/\\evil.example.com')).toBe(false)
    expect(isSameOriginRelative('///evil.example.com')).toBe(false)
  })

  it('路径中段含反斜杠仍是站内路径(不得为消红把整族判死)', () => {
    // 第二个字符是普通字符 ⇒ 落点仍在本源(实测 new URL('/a\\/b','https://aizhs.top') = …/a/b)
    expect(isSameOriginRelative('/a\\/b')).toBe(true)
    expect(isSameOriginRelative('/edu/edu-management/study-plan')).toBe(true)
    expect(isSameOriginRelative('/')).toBe(true)
  })

  it('绝对 URL 与自定义协议深链不算同源相对', () => {
    expect(isSameOriginRelative('https://sub.example.com/cb')).toBe(false)
    expect(isSameOriginRelative('ihui://sso')).toBe(false)
  })
})

describe('isBlockedByAuthGuard - 探测口径', () => {
  it('opaqueredirect 判为被拦', async () => {
    fetchMock.mockResolvedValue(probeResponse('opaqueredirect'))
    await expect(isBlockedByAuthGuard('/admin')).resolves.toBe(true)
  })

  it('正常响应判为放行', async () => {
    fetchMock.mockResolvedValue(probeResponse('basic'))
    await expect(isBlockedByAuthGuard('/admin')).resolves.toBe(false)
  })

  it('探测自身抛错时判为放行(绝不误拦)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(isBlockedByAuthGuard('/admin')).resolves.toBe(false)
  })

  it('用 HEAD + redirect:manual 探测(零跟随、无副作用)', async () => {
    fetchMock.mockResolvedValue(probeResponse('basic'))
    await isBlockedByAuthGuard('/admin')
    expect(fetchMock).toHaveBeenCalledWith('/admin', {
      method: 'HEAD',
      redirect: 'manual',
      credentials: 'include',
    })
  })
})

describe('syncAuthCookie', () => {
  it('续期失败不向上抛', async () => {
    refreshMock.mockRejectedValue(new Error('refresh token revoked'))
    await expect(syncAuthCookie()).resolves.toBeUndefined()
  })

  it('续期被调用一次', async () => {
    await syncAuthCookie()
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})

describe('ensureSsoRedirectAllowed - 决策链', () => {
  it('非同源相对目标直接放行,不探测不续期', async () => {
    await expect(ensureSsoRedirectAllowed('https://sub.example.com/cb')).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('首次探测即放行时不做多余续期', async () => {
    fetchMock.mockResolvedValue(probeResponse('basic'))
    await expect(ensureSsoRedirectAllowed('/edu/a')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('被拦 → 续期 → 复测放行(本次故障的修复路径)', async () => {
    fetchMock
      .mockResolvedValueOnce(probeResponse('opaqueredirect'))
      .mockResolvedValueOnce(probeResponse('basic'))
    await expect(ensureSsoRedirectAllowed('/edu/edu-management/study-plan')).resolves.toBe(true)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('被拦 → 续期 → 仍被拦,返回 false(由调用方明示,不再静默循环)', async () => {
    fetchMock.mockResolvedValue(probeResponse('opaqueredirect'))
    await expect(ensureSsoRedirectAllowed('/edu/edu-management/study-plan')).resolves.toBe(false)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('续期抛错时按同一路径复测,不因异常短路', async () => {
    refreshMock.mockRejectedValue(new Error('401'))
    fetchMock.mockResolvedValue(probeResponse('opaqueredirect'))
    await expect(ensureSsoRedirectAllowed('/admin')).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('isSafeNavigationTarget - 协议判定(与归属判定不同义)', () => {
  // 阳性对照:这些伪 URL 都能被 new URL() 解析成功,但经 location.replace 会在**本站源**里
  // 执行代码或取回本地字节 —— 而 /sso/mobile-auth 刚 Set-Cookie 了 auth_token。
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>1</script>',
    'blob:https://a/1',
    'vbscript:msgbox(1)',
  ])('能在本站源里执行的伪协议必须拒:%s', (target) => {
    expect(isSafeNavigationTarget(target)).toBe(false)
  })

  it('站内相对路径放行', () => {
    expect(isSafeNavigationTarget('/chat')).toBe(true)
  })

  // 控制组(这条最容易被"顺手加严"破坏):mobile-auth 的 redirect 语义是
  // "WebView 接下来要打开的那个页面",外部 http(s) 页是设计意图 ⇒ 绝不能按 origin 白名单拒,
  // 否则 App→Web 会话打通链路当场断(WebViewScreen 传的就是任意 http(s) 目标)。
  it('外部 http(s) 绝对地址放行(它是 WebView 的目标,不是回站内的跳转)', () => {
    expect(isSafeNavigationTarget('https://aizhs.top/pricing')).toBe(true)
    expect(isSafeNavigationTarget('http://192.168.1.7:8801/sso/redirect')).toBe(true)
  })

  it('空串与裸串拒(交调用方回落,不猜"应该没问题")', () => {
    expect(isSafeNavigationTarget('')).toBe(false)
    expect(isSafeNavigationTarget('chat')).toBe(false)
    expect(isSafeNavigationTarget('//evil.example.com/x')).toBe(false) // 协议相对:new URL 无 base 解析不出
  })

  // 自定义协议深链按本协议判拒。深链回 App 走的是 scheme 回调(ihui://),不经本页;
  // 若将来要让本页支持深链,必须**显式扩协议**并在此写明理由,不得默默放行未知协议。
  it('自定义协议深链判拒(需要时必须显式扩协议)', () => {
    expect(isSafeNavigationTarget('ihui://sso/callback')).toBe(false)
  })

  it('与归属判定的边界互不代替:同源相对在两处都算站内', () => {
    for (const t of ['/admin', '/chat']) {
      expect(isSameOriginRelative(t)).toBe(true)
      expect(isSafeNavigationTarget(t)).toBe(true)
    }
  })

  // ── 票 A3/G-413:三类绕过成对钉死(合法同源放行 / 三种绕过全部拒绝) ──────────────
  it('三类绕过全部拒:协议相对、反斜杠、自执行协议', () => {
    expect(isSafeNavigationTarget('//evil.example.com/x')).toBe(false) // ①协议相对
    expect(isSafeNavigationTarget('/\\evil.example.com/x')).toBe(false) // ②反斜杠
    expect(isSafeNavigationTarget('/\\/\\evil.example.com')).toBe(false)
    expect(isSafeNavigationTarget('javascript:alert(1)')).toBe(false) // ③自执行协议
    expect(isSafeNavigationTarget('data:text/html,<script>1</script>')).toBe(false)
    expect(isSafeNavigationTarget('file:///etc/passwd')).toBe(false)
    expect(isSafeNavigationTarget('about:blank')).toBe(false)
  })

  it('合法站内路径与外站 http(s) 放行(判据没被顺手改严)', () => {
    expect(isSafeNavigationTarget('/edu/edu-management/study-plan')).toBe(true)
    expect(isSafeNavigationTarget('https://aizhs.top/pricing')).toBe(true)
  })

  // 正向对照(AGENTS §9 的 SSO 契约):默认档对深链的判据**逐字未变** ——
  // 打开 allowDeepLink 才放行,且它绝不成为自执行协议的放行通道。
  it('深链只在显式声明的调用点放行,默认判据一字未动', () => {
    for (const scheme of ['ihui://sso/callback', 'ihui-miniapp://sso/callback']) {
      expect(isSafeNavigationTarget(scheme)).toBe(false) // 默认档:mobile-auth 的既有断言不被推翻
      expect(isSafeNavigationTarget(scheme, { allowDeepLink: true })).toBe(true)
    }
    expect(isSafeNavigationTarget('ihui://', { allowDeepLink: true })).toBe(false) // 裸 scheme 无 host
    expect(isSafeNavigationTarget('javascript:alert(1)', { allowDeepLink: true })).toBe(false)
  })
})

// ── G-387,2026-10-07(承 G-413 同型残余③):allowDeepLink 与 env SSO_ALLOWED_DEEP_LINK_SCHEMES 对账 ──
describe('isSafeNavigationTarget - 深链 scheme 与 env SSO_ALLOWED_DEEP_LINK_SCHEMES 对账', () => {
  const ENV_KEY = 'SSO_ALLOWED_DEEP_LINK_SCHEMES'
  let saved: string | undefined

  beforeEach(() => {
    saved = process.env[ENV_KEY]
  })

  afterEach(() => {
    if (saved === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = saved
  })

  it('env 缺席 ⇒ 默认档判据逐字不变(只判协议族 + host,未知 scheme 也放)', () => {
    delete process.env[ENV_KEY]
    expect(isSafeNavigationTarget('ihui://sso/callback', { allowDeepLink: true })).toBe(true)
    expect(isSafeNavigationTarget('ihui-miniapp://sso/callback', { allowDeepLink: true })).toBe(true)
    expect(isSafeNavigationTarget('unknown-app://x/y', { allowDeepLink: true })).toBe(true)
    expect(isSafeNavigationTarget('ihui://', { allowDeepLink: true })).toBe(false) // 裸 scheme 无 host,既有判据不动
  })

  it('env 为空串 / 纯逗号 ⇒ 与缺席同档(默认档)', () => {
    process.env[ENV_KEY] = ''
    expect(isSafeNavigationTarget('ihui://sso/callback', { allowDeepLink: true })).toBe(true)
    process.env[ENV_KEY] = ' , , '
    expect(isSafeNavigationTarget('ihui://sso/callback', { allowDeepLink: true })).toBe(true)
  })

  it('env 在且含该 scheme ⇒ 过(条目空格与大小写归一)', () => {
    process.env[ENV_KEY] = ' ihui, ihui-miniapp '
    expect(isSafeNavigationTarget('ihui://sso/callback', { allowDeepLink: true })).toBe(true)
    expect(isSafeNavigationTarget('Ihui-MiniApp://sso', { allowDeepLink: true })).toBe(true)
  })

  it('env 在但不含该 scheme ⇒ 拒(哪怕 host 形状完好)', () => {
    process.env[ENV_KEY] = 'other-app'
    expect(isSafeNavigationTarget('ihui://sso/callback', { allowDeepLink: true })).toBe(false)
    expect(isSafeNavigationTarget('other-app://sso/callback', { allowDeepLink: true })).toBe(true)
  })

  it('env 对账不成为自执行协议的放行通道,也不影响默认档(不带 allowDeepLink 的调用点)', () => {
    process.env[ENV_KEY] = 'javascript'
    expect(isSafeNavigationTarget('javascript:alert(1)', { allowDeepLink: true })).toBe(false)
    expect(isSafeNavigationTarget('ihui://sso/callback')).toBe(false)
  })
})

describe('resolveSafeRedirectTarget - 回跳落点的唯一决策出口', () => {
  // 三条"落点被改写"的路径分开判,因为两档策略本来就不同义:
  //  - 自执行协议 / 协议相对 / 反斜杠:任何调用点都必须改写(它们要么在本站执行代码,要么伪装站内)
  //  - 外部 origin:只有**声明了白名单**的调用点(带 sso_code 落地的那一页)才改写;
  //    mobile-auth 与 login/register 的 WebView 回跳按设计允许外站(见上面那条控制组),
  //    把"改写外部 origin"写成普适断言 = 给一扇会砍断 App→Web 链路的门发合格证。
  it('三类绕过一律被改写为站内默认(不会产出对外跳转)', () => {
    for (const evil of [
      '//evil.example.com/cb',
      '/\\evil.example.com/cb',
      '/\\/\\evil.example.com',
      'javascript:alert(1)',
      'data:text/html,<script>1</script>',
      'totally-not-a-url',
      '',
    ]) {
      expect(resolveSafeRedirectTarget(evil, { allowDeepLink: true })).toBe('/')
      expect(resolveSafeRedirectTarget(evil, { allowedOrigins: ['https://aizhs.top'] })).toBe('/')
    }
  })

  it('带外部 origin 的 redirect:声明白名单后不会产出对外跳转', () => {
    // /sso/redirect 这一页正是这一档策略(它带着刚落库的 sso_code 落地)
    const opts = { allowedOrigins: ['https://aizhs.top'] }
    expect(resolveSafeRedirectTarget('https://evil.example.com/cb', opts)).toBe('/')
    expect(resolveSafeRedirectTarget('https://aizhs.top/pricing', opts)).toBe(
      'https://aizhs.top/pricing',
    )
    // 白名单为空数组 ⇒ 所有绝对地址都不放行(env 未配置时的既有行为)
    expect(resolveSafeRedirectTarget('https://aizhs.top/pricing', { allowedOrigins: [] })).toBe('/')
  })

  it('同源相对 / 外站 http(s) / 深链原样返回(正向对照)', () => {
    expect(resolveSafeRedirectTarget('/edu/a')).toBe('/edu/a')
    expect(resolveSafeRedirectTarget('https://aizhs.top/pricing')).toBe('https://aizhs.top/pricing')
    expect(resolveSafeRedirectTarget('ihui://sso/callback', { allowDeepLink: true })).toBe(
      'ihui://sso/callback',
    )
  })

  it('拒绝时点名原值(不静默把用户送回首页)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveSafeRedirectTarget('javascript:alert(1)')).toBe('/')
    expect(warn).toHaveBeenCalledWith(expect.any(String), 'javascript:alert(1)')
    warn.mockRestore()
  })

  it('fallback 可指定,默认站内首页', () => {
    expect(resolveSafeRedirectTarget('javascript:alert(1)', { fallback: '/login' })).toBe('/login')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
