// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebView 落点信任判定(跨端唯一实现)的用例。
 *
 * 覆盖三件事:① 判定矩阵(含两类经典白名单绕过:后缀伪装与"域名尾巴"拼接);
 * ② 端侧策略注入(小程序的第三方域清单照常生效,不因机制上收而变窄);
 * ③ 接线锁 —— RN `WebViewScreen` 必须在签 sso_code **之前**问这道闸,
 *    而小程序端不得再留第二份判定实现(§0.6)。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FIRST_PARTY_WEBVIEW_HOSTS,
  isTrustedWebviewUrl,
} from '../webview-trust'

describe('isTrustedWebviewUrl 判定矩阵', () => {
  it('第一方 https 落点信任', () => {
    for (const url of [
      'https://aizhs.top/pricing',
      'https://www.aizhs.top/',
      'https://api.aizhs.top/api/v1/x',
      'https://mcp.aizhs.top/sse',
      'https://any-sub.aizhs.top/deep/path?q=1',
    ]) {
      expect(isTrustedWebviewUrl(url), url).toBe(true)
    }
  })

  it('尾点与大小写归一(合法 FQDN 形态不该被误拒)', () => {
    expect(isTrustedWebviewUrl('https://AIZHS.TOP./x')).toBe(true)
    expect(isTrustedWebviewUrl('https://Api.AIZHS.top/x')).toBe(true)
  })

  it('开发态只放回环 http,非回环 http 一律不信任', () => {
    expect(isTrustedWebviewUrl('http://localhost:3000/x')).toBe(true)
    expect(isTrustedWebviewUrl('http://127.0.0.1:8801/')).toBe(true)
    expect(isTrustedWebviewUrl('http://aizhs.top/x')).toBe(false)
    expect(isTrustedWebviewUrl('http://attacker.example/x')).toBe(false)
  })

  it('两类经典白名单绕过都拒(后缀伪装 + 域名尾巴拼接)', () => {
    expect(isTrustedWebviewUrl('https://aizhs.top.evil.example/x')).toBe(false)
    expect(isTrustedWebviewUrl('https://evil.aizhs.top.attacker.tld/x')).toBe(false)
    expect(isTrustedWebviewUrl('https://aizhs.top@evil.example/')).toBe(false)
    expect(isTrustedWebviewUrl('https://xevil.aizhs.top.evil.example/')).toBe(false)
  })

  it('自执行/本地协议一律不信任(它们既不该带会话也不该被当站内落点)', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'intent://scan/#Intent;scheme=zxing;end',
      'blob:https://aizhs.top/uuid',
      'about:blank',
      'not-a-url',
      '',
    ]) {
      expect(isTrustedWebviewUrl(url), url).toBe(false)
    }
  })

  it('端侧策略:extraHosts 精确生效,不扩成子域通配', () => {
    const policy = { extraHosts: ['open.weixin.qq.com', 'beian.miit.gov.cn'] }
    expect(isTrustedWebviewUrl('https://open.weixin.qq.com/connect/qrconnect', policy)).toBe(true)
    expect(isTrustedWebviewUrl('https://beian.miit.gov.cn/', policy)).toBe(true)
    expect(isTrustedWebviewUrl('https://evil-open.weixin.qq.com/', policy)).toBe(false)
    expect(isTrustedWebviewUrl('https://sub.beian.miit.gov.cn/', policy)).toBe(false)
  })

  it('空主机/畸形 URL 不冒信任(取不到输入 ⇒ 不信任)', () => {
    expect(isTrustedWebviewUrl('https:///x')).toBe(false)
    expect(isTrustedWebviewUrl('//aizhs.top/x')).toBe(false)
  })
})

describe('跨端接线(判据只许一份,缺闸的一侧必须被这条抓住)', () => {
  const rnScreen = readFileSync(
    new URL('../../../../../apps/mobile-rn/src/screens/WebViewScreen.tsx', import.meta.url),
    'utf-8',
  )
  const miniappUtil = readFileSync(
    new URL('../../../../../apps/miniapp-taro/src/utils/webview-trust.ts', import.meta.url),
    'utf-8',
  )

  it('RN WebViewScreen:签 sso_code 之前先过信任闸', () => {
    expect(rnScreen).toContain('isTrustedWebviewUrl')
    expect(rnScreen).toContain("import { isTrustedWebviewUrl } from '@ihui/shared'")
    const gate = rnScreen.indexOf('isTrustedWebviewUrl(url)')
    const mint = rnScreen.indexOf('generateSsoCode(')
    expect(gate, 'RN 侧的信任闸被摘掉了 ⇒ 会话码会签给任意 origin').toBeGreaterThan(0)
    expect(gate, '闸必须排在签发之前').toBeLessThan(mint)
  })

  it('小程序端只注入策略,不再留第二份判定实现', () => {
    expect(miniappUtil).toContain('isSharedTrustedWebviewUrl')
    // 机制(解析 + 协议 + 后缀判定)不得在端内重写:出现 `new URL(` 即第二份实现
    expect(miniappUtil).not.toContain('new URL(')
  })

  it('第一方清单非空且含门户主域(表被清空即全线拒)', () => {
    expect(FIRST_PARTY_WEBVIEW_HOSTS.length).toBeGreaterThan(2)
    expect(FIRST_PARTY_WEBVIEW_HOSTS).toContain('aizhs.top')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
