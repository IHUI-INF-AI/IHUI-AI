// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebView 应用层信任白名单的回归锁（2026-10-31 R12）。
 *
 * 白名单本身是 R11 的收紧（防深链把 WebView 引到任意页），但收紧过窄会误伤真实入口：
 * 备案查询（beian.miit.gov.cn）与 VIP 自动续费签约页（微信支付 redirect_url）都是
 * 合法第三方域。本文件同时钉"该放行的放行"与"该拒的拒"，防止下次再收窄时静默回归。
 */
import { describe, expect, it } from 'vitest'
import { isTrustedWebviewUrl } from '../src/utils/webview-trust'

describe('isTrustedWebviewUrl', () => {
  it('本站与子域放行', () => {
    expect(isTrustedWebviewUrl('https://aizhs.top/')).toBe(true)
    expect(isTrustedWebviewUrl('https://sub.aizhs.top/path')).toBe(true)
    // 尾点是合法 FQDN 形态，归一化后仍应放行
    expect(isTrustedWebviewUrl('https://aizhs.top./')).toBe(true)
  })

  it('备案查询入口放行（R12 回归修复）', () => {
    expect(isTrustedWebviewUrl('https://beian.miit.gov.cn/')).toBe(true)
  })

  it('微信支付签约页三个官方域放行（R12 回归修复）', () => {
    expect(isTrustedWebviewUrl('https://payapp.weixin.qq.com/x')).toBe(true)
    expect(isTrustedWebviewUrl('https://pay.weixin.qq.com/x')).toBe(true)
    expect(isTrustedWebviewUrl('https://wxpay.wxutil.com/x')).toBe(true)
  })

  it('登录相关官方域放行', () => {
    expect(isTrustedWebviewUrl('https://open.weixin.qq.com/connect/qrconnect')).toBe(true)
    expect(isTrustedWebviewUrl('https://open.work.weixin.qq.com/wwopen/sso/qrConnect')).toBe(true)
    expect(isTrustedWebviewUrl('https://login.dingtalk.com/oauth2/auth')).toBe(true)
    expect(isTrustedWebviewUrl('https://passport.feishu.cn/suite/passport/oauth/authorize')).toBe(true)
    expect(isTrustedWebviewUrl('https://challenges.cloudflare.com/turnstile')).toBe(true)
  })

  it('开发回环只允许 http，外域 http 一律拒', () => {
    expect(isTrustedWebviewUrl('http://localhost:8801/')).toBe(true)
    expect(isTrustedWebviewUrl('http://127.0.0.1:8801/')).toBe(true)
    expect(isTrustedWebviewUrl('http://evil.com/')).toBe(false)
    expect(isTrustedWebviewUrl('http://aizhs.top/')).toBe(false)
  })

  it('白名单外域 / 危险协议 / userinfo 混淆一律拒', () => {
    expect(isTrustedWebviewUrl('https://evil.com/')).toBe(false)
    expect(isTrustedWebviewUrl('https://aizhs.top.evil.com/')).toBe(false)
    expect(isTrustedWebviewUrl('https://aizhs.top@evil.com/')).toBe(false)
    expect(isTrustedWebviewUrl('javascript:alert(1)')).toBe(false)
    expect(isTrustedWebviewUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isTrustedWebviewUrl('')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
