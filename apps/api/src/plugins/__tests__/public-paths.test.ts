// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开面单一真相源的回归锁(BUG-4, 2026-11-06 立)。
 *
 * 缺陷形状:兜底鉴权闸 / 租户隔离绕过 / 网络分段三处各写一份"公开面"清单,
 * 且两种匹配语义并存 —— 两处用裸 `startsWith`(无段边界),一处用 `matchesPrefix`。
 * 后果:漏登记一处整链 401,多登记则相邻未注册路径被预留免鉴权。
 *
 * 本文件钉四件事:
 *   S1 三个维度的清单**同住一模块、共用一把尺**(单一真相源,不再三文件各漂各的);
 *   S2 段边界安全:`/api/agents` 绝不顺带放过 `/api/agentsXYZ`;
 *   S3 精确集合与前缀集合不混:`/` 只属精确集合,不得退化成"匹配一切";
 *   S4 三份清单语义**故意不合并**:`/api/settings` 可免租户但仍需登录。
 */
import { describe, it, expect } from 'vitest'
import {
  AUTH_PUBLIC_EXACT_PATHS,
  AUTH_PUBLIC_PREFIX_PATHS,
  TENANT_BYPASS_PREFIX_PATHS,
  NETWORK_PUBLIC_PREFIX_PATHS,
  isAuthPublicPath,
  isTenantBypassPath,
  isNetworkPublicPath,
  matchesPrefix,
} from '../public-paths.js'

describe('BUG-4 公开面单一真相源', () => {
  describe('S1 三份清单同源共存、共用同一匹配原语', () => {
    it('三份清单都从本模块导出,且无一份为空(取不到清单即判绿是 BUG-20 的形状)', () => {
      expect(AUTH_PUBLIC_EXACT_PATHS.size).toBeGreaterThan(0)
      expect(AUTH_PUBLIC_PREFIX_PATHS.length).toBeGreaterThan(0)
      expect(TENANT_BYPASS_PREFIX_PATHS.length).toBeGreaterThan(0)
      expect(NETWORK_PUBLIC_PREFIX_PATHS.length).toBeGreaterThan(0)
    })

    it('再导出的 matchesPrefix 与消费方使用的语义一致(不存在第二把尺)', () => {
      expect(matchesPrefix('/api/agents', '/api/agents')).toBe(true)
      expect(matchesPrefix('/api/agents/abc', '/api/agents')).toBe(true)
      expect(matchesPrefix('/api/agentsXYZ', '/api/agents')).toBe(false)
      expect(matchesPrefix('/api/auth/login', '/api/auth/')).toBe(true)
    })

    it('三处判定函数都走段边界匹配,长度不同的兄弟路径不被误放行', () => {
      for (const fn of [isAuthPublicPath, isTenantBypassPath, isNetworkPublicPath]) {
        expect(fn('/api/authXYZ/login')).toBe(false)
        expect(fn('/api/healthXYZ')).toBe(false)
      }
    })
  })

  describe('S2 段边界安全(根除裸 startsWith)', () => {
    it('/api/agents 命中,但 /api/agentsXYZ 不命中', () => {
      expect(isAuthPublicPath('/api/agents')).toBe(true)
      expect(isAuthPublicPath('/api/agents/abc-123')).toBe(true)
      expect(isAuthPublicPath('/api/agentsXYZ')).toBe(false)
    })

    it('/api/docs 与 /api/docs/:slug 命中,但 /api/docsXYZ 与 /api/admin/docs 不命中', () => {
      expect(isAuthPublicPath('/api/docs')).toBe(true)
      expect(isAuthPublicPath('/api/docs/getting-started')).toBe(true)
      expect(isAuthPublicPath('/api/docsXYZ')).toBe(false)
      expect(isAuthPublicPath('/api/admin/docs')).toBe(false)
    })

    it('带尾斜杠的前缀只覆盖其子段,不覆盖同前缀兄弟', () => {
      expect(isAuthPublicPath('/api/news/top')).toBe(true)
      expect(isAuthPublicPath('/api/newsXYZ/top')).toBe(false)
    })
  })

  describe('S3 精确集合不退化成 catch-all', () => {
    it('"/" 只在精确集合中,任意业务路径都不会因此被判公开', () => {
      expect(AUTH_PUBLIC_EXACT_PATHS.has('/')).toBe(true)
      expect(AUTH_PUBLIC_PREFIX_PATHS).not.toContain('/')
      expect(isAuthPublicPath('/')).toBe(true)
      // 这两条是重构过程中真实踩过的坑:`/` 误入前缀集合 ⇒ 全部路径被判公开
      expect(isAuthPublicPath('/api/chat/conversations')).toBe(false)
      expect(isAuthPublicPath('/api/knowledge/docs')).toBe(false)
      expect(isAuthPublicPath('/api/admin/users')).toBe(false)
    })

    it('querystring 由消费方剥离后仍正确判定', () => {
      const path = '/api/health?probe=1'.split('?')[0] ?? ''
      expect(isAuthPublicPath(path)).toBe(true)
      const denied = '/api/admin/users?page=1'.split('?')[0] ?? ''
      expect(isAuthPublicPath(denied)).toBe(false)
    })
  })

  describe('S4 三个维度的公开性刻意分列,不盲目合并', () => {
    it('/api/settings 免租户但需登录(合并清单会打穿鉴权)', () => {
      expect(isTenantBypassPath('/api/settings')).toBe(true)
      expect(isAuthPublicPath('/api/settings')).toBe(false)
      expect(isAuthPublicPath('/api/settings/contact')).toBe(false)
    })

    it('/api/health 在三个维度都公开', () => {
      expect(isAuthPublicPath('/api/health')).toBe(true)
      expect(isTenantBypassPath('/api/health')).toBe(true)
      expect(isNetworkPublicPath('/api/health')).toBe(true)
    })

    it('/api/public/xxx 属鉴权与网络公开面,但不自动获得免租户待遇', () => {
      expect(isAuthPublicPath('/api/public/banner')).toBe(true)
      expect(isNetworkPublicPath('/api/public/banner')).toBe(true)
      expect(isTenantBypassPath('/api/public/banner')).toBe(false)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
