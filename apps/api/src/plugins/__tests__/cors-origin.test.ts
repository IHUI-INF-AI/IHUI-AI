// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { evaluateOriginAllowance } from '../cors-origin.js'

const DESKTOP_ORIGINS = ['http://tauri.localhost', 'tauri://localhost']
const MOBILE_CAP_ORIGINS = ['https://localhost', 'capacitor://localhost']

describe('evaluateOriginAllowance — CORS/WS Origin 放行决策(fail-closed)', () => {
  describe('缺失 Origin(非浏览器 / curl / 服务端客户端)', () => {
    it('undefined → 放行,不标记 unconfiguredExtension', () => {
      const r = evaluateOriginAllowance({
        origin: undefined,
        allowedOrigins: ['https://aizhs.top'],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r).toEqual({ allow: true, unconfiguredExtension: false })
    })

    it('空字符串 → 视为缺失,放行', () => {
      const r = evaluateOriginAllowance({
        origin: '',
        allowedOrigins: ['https://aizhs.top'],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r.allow).toBe(true)
      expect(r.unconfiguredExtension).toBe(false)
    })
  })

  describe('显式白名单命中即放行', () => {
    it('config.CORS_ORIGIN 条目命中(忽略大小写)', () => {
      const r = evaluateOriginAllowance({
        origin: 'https://AIZHS.top',
        allowedOrigins: ['https://aizhs.top'],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r).toEqual({ allow: true, unconfiguredExtension: false })
    })

    it('桌面端固定 origin 命中', () => {
      const r = evaluateOriginAllowance({
        origin: 'tauri://localhost',
        allowedOrigins: [],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r.allow).toBe(true)
    })

    it('移动壳固定 origin 命中', () => {
      const r = evaluateOriginAllowance({
        origin: 'capacitor://localhost',
        allowedOrigins: [],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r.allow).toBe(true)
    })
  })

  describe('未知 Origin → 拒绝', () => {
    it('任意 http(s) 恶意站点 → 拒绝', () => {
      const r = evaluateOriginAllowance({
        origin: 'https://evil.example.com',
        allowedOrigins: ['https://aizhs.top'],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r).toEqual({ allow: false, unconfiguredExtension: false })
    })
  })

  describe('chrome-extension:// — fail-closed 核心契约', () => {
    it('【关键】未配置 IHUI_EXTENSION_IDS 时,任意 chrome-extension 一律拒绝并标记', () => {
      const r = evaluateOriginAllowance({
        origin: 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef',
        allowedOrigins: [],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r).toEqual({ allow: false, unconfiguredExtension: true })
    })

    it('已配置 IHUI_EXTENSION_IDS 且 ID 命中 → 放行', () => {
      // 注:原 server.ts 约定 IHUI_EXTENSION_IDS 存「完整 chrome-extension:// origin」,
      // 故此处 extensionIds 用完整 origin 字符串(与线上部署约定一致,refactor 不改变语义)。
      const ext = 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef'
      const r = evaluateOriginAllowance({
        origin: ext,
        allowedOrigins: [],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [ext],
      })
      expect(r).toEqual({ allow: true, unconfiguredExtension: false })
    })

    it('已配置 IHUI_EXTENSION_IDS 但 ID 不匹配 → 拒绝(且不标记 unconfigured)', () => {
      const allowExt = 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef'
      const r = evaluateOriginAllowance({
        origin: 'chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
        allowedOrigins: [],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [allowExt],
      })
      expect(r).toEqual({ allow: false, unconfiguredExtension: false })
    })

    it('chrome-extension 同时也在 CORS_ORIGIN 白名单 → 放行(白名单优先)', () => {
      const ext = 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef'
      const r = evaluateOriginAllowance({
        origin: ext,
        allowedOrigins: [ext],
        desktopOrigins: DESKTOP_ORIGINS,
        mobileCapOrigins: MOBILE_CAP_ORIGINS,
        extensionIds: [],
      })
      expect(r.allow).toBe(true)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
