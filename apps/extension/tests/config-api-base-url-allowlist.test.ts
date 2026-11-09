// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { isAllowedApiBaseUrl } from '../lib/config'

/**
 * 2026-11-07 DBG-72 回归锁: ihui_api_base_url 读侧白名单。
 * 缺陷背景: 原实现读出后仅 trim+去尾斜杠即作 API 基址, 任何能写 storage.local 的上下文
 * 把该键改成 http://attacker 即等于把登录凭据(Authorization: Bearer)外送到第三方域。
 */
describe('isAllowedApiBaseUrl (DBG-72)', () => {
  it('允许 localhost / 127.0.0.1 / [::1] 的 http(s)(开发与自托管)', () => {
    expect(isAllowedApiBaseUrl('http://localhost:8802')).toBe(true)
    expect(isAllowedApiBaseUrl('http://127.0.0.1:8802')).toBe(true)
    expect(isAllowedApiBaseUrl('https://localhost')).toBe(true)
    expect(isAllowedApiBaseUrl('http://[::1]:8802')).toBe(true)
  })

  it('允许 https://*.aizhs.top(生产,与 host_permissions 同域)', () => {
    expect(isAllowedApiBaseUrl('https://api.aizhs.top')).toBe(true)
    expect(isAllowedApiBaseUrl('https://aizhs.top')).toBe(true)
  })

  it('拒绝第三方 http(s) 域 —— 凭据外送面', () => {
    expect(isAllowedApiBaseUrl('http://attacker.example')).toBe(false)
    expect(isAllowedApiBaseUrl('https://attacker.example')).toBe(false)
    expect(isAllowedApiBaseUrl('http://localhost.attacker.example')).toBe(false)
  })

  it('拒绝伪装 aizhs.top 的域名(后缀拼接攻击)', () => {
    expect(isAllowedApiBaseUrl('https://aizhs.top.attacker.example')).toBe(false)
    expect(isAllowedApiBaseUrl('https://fake-aizhs.top')).toBe(false)
    expect(isAllowedApiBaseUrl('https://aizhs.top.evil.io')).toBe(false)
  })

  it('拒绝 http://aizhs.top(生产域必须 https)与其他协议', () => {
    expect(isAllowedApiBaseUrl('http://aizhs.top')).toBe(false)
    expect(isAllowedApiBaseUrl('ftp://aizhs.top')).toBe(false)
    expect(isAllowedApiBaseUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedApiBaseUrl('javascript:alert(1)')).toBe(false)
  })

  it('拒绝垃圾输入不抛异常', () => {
    expect(isAllowedApiBaseUrl('')).toBe(false)
    expect(isAllowedApiBaseUrl('not a url')).toBe(false)
    expect(isAllowedApiBaseUrl('::::')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
