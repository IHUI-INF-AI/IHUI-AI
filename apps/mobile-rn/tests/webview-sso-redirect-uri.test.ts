// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 真机实测立因(2026-10-13,Redmi flame / Android 16 / 已登录态):
// App 内点开「AI 对话 / 工具」,WebView 里 web 端仍弹 AlertDialog「登录 / 登录您的账号以继续」
// —— App→Web 会话打通是断的。根因不在 WebView 侧:`POST /api/auth/sso/code` 对**绝对 URL**
// 走 env 白名单 `SSO_ALLOWED_ORIGINS`,生产未配 ⇒ 400 ⇒ 两端既有降级分支直开原 URL ⇒
// WebView 内拿不到 httpOnly 的 auth_token cookie ⇒ 整条链路**静默失效**(页面照常显示,只是未登录)。
//
// 静默是这里最危险的一点:没有任何报错、没有任何红,只有"用户进了 WebView 还要再登录一次"。
// 所以锁必须钉在**传给 generateSsoCode 的那个实参形态**上,而不是钉"有没有调 generateSsoCode"
// —— 后者今天也成立(调用一直在),锁了等于没锁。
//
// 三条判据各挡一种失效:
//  ① 同域绝对 URL 必须被压成站内相对路径(挡"改回传绝对 URL"这一种回潮);
//  ② 跨域 / 外站 URL 必须原样返回(挡"顺手把外站也压成路径"—— mobile-auth 的外站回跳是设计意图);
//  ③ 两个调用点都必须走归一化出口(挡"新增第三个 WebView 入口时忘了带")。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { toSsoRedirectUri } from '../src/lib/webview-portal-config'

const ROOT = resolve(__dirname, '..')

describe('toSsoRedirectUri —— SSO redirectUri 合规形态(真机实测立因)', () => {
  it('① 同域绝对 URL 压成站内相对路径(绝对 URL 会撞 SSO_ALLOWED_ORIGINS 白名单 → 400)', () => {
    expect(toSsoRedirectUri('https://aizhs.top/chat')).toBe('/chat')
    expect(toSsoRedirectUri('https://aizhs.top/')).toBe('/')
    expect(toSsoRedirectUri('https://aizhs.top/sso/mobile-auth?a=1')).toBe(
      '/sso/mobile-auth?a=1',
    )
  })

  it('② 外站 / 非 http(s) 原样返回(外站回跳是 mobile-auth 的设计意图,不得压成路径)', () => {
    expect(toSsoRedirectUri('https://example.com/chat')).toBe('https://example.com/chat')
    expect(toSsoRedirectUri('http://192.168.1.7:8801/chat')).toBe('http://192.168.1.7:8801/chat')
  })

  it('②b 已是相对路径 / 无法解析的裸串:原样交给服务端判,不在端内猜', () => {
    expect(toSsoRedirectUri('/chat')).toBe('/chat')
    expect(toSsoRedirectUri('not a url')).toBe('not a url')
  })

  it('③ 两个 WebView 入口都走归一化出口,不得有第二份拼法', () => {
    const webview = readFileSync(resolve(ROOT, 'src/screens/WebViewScreen.tsx'), 'utf8')
    const chat = readFileSync(resolve(ROOT, 'src/screens/ChatToolsScreen.tsx'), 'utf8')

    // WebViewScreen:通用承载页,url 由调用方给 ⇒ 必须套 toSsoRedirectUri(url)
    expect(webview).toContain('toSsoRedirectUri(url)')
    // 反向锁:不得再出现把裸 url 直接喂给 generateSsoCode 的写法
    expect(webview).not.toMatch(/generateSsoCode\(\s*'mobile-rn'\s*,\s*url\s*\)/)

    // ChatToolsScreen:目标是本站固定的 /chat ⇒ 直接传相对路径常量即可
    expect(chat).toMatch(/generateSsoCode\(\s*'mobile-rn'\s*,\s*CHAT_PATH\s*\)/)
    expect(chat).not.toMatch(/generateSsoCode\(\s*'mobile-rn'\s*,\s*`\$\{WEB_BASE_URL\}/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
