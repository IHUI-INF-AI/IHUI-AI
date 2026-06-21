import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { ThemeMode } from '@/stores/darkMode'

const mockStore: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => { mockStore[key] = value },
  removeItem: (key: string) => { delete mockStore[key] },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]) }
})

vi.stubGlobal('navigator', {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

vi.stubGlobal('window', {
  location: { origin: 'https://test.com' },
  innerWidth: 1200,
  innerHeight: 800,
  open: vi.fn()
})

vi.stubGlobal('document', {
  createElement: vi.fn().mockReturnValue({
    value: '',
    style: {},
    select: vi.fn()
  }),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  execCommand: vi.fn().mockReturnValue(true)
})

describe('themeShare', () => {
  beforeEach(async () => {
    Object.keys(mockStore).forEach(k => delete mockStore[k])
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createShareUrl', () => {
    it('should create share URL with theme mode', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('dark' as ThemeMode)
      expect(result.success).toBe(true)
      expect(result.shareUrl).toContain('theme=dark')
      expect(result.shortCode).toBeDefined()
    })

    it('should create share URL with preset ID', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('light' as ThemeMode, 'preset-123')
      expect(result.success).toBe(true)
      expect(result.shareUrl).toContain('theme=light')
    })

    it('should create share URL for auto mode', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('auto' as ThemeMode)
      expect(result.success).toBe(true)
      expect(result.shareUrl).toContain('theme=auto')
    })

    it('should create share URL for high-contrast-light mode', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('high-contrast-light' as ThemeMode)
      expect(result.success).toBe(true)
      expect(result.shareUrl).toContain('theme=high-contrast-light')
    })

    it('should create share URL for high-contrast-dark mode', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('high-contrast-dark' as ThemeMode)
      expect(result.success).toBe(true)
      expect(result.shareUrl).toContain('theme=high-contrast-dark')
    })
  })

  describe('generateQRCodeUrl', () => {
    it('should generate QR code URL', async () => {
      const { themeShare } = await import('../themeShare')
      const shareUrl = 'https://example.com?theme=dark&share=ABC123'
      const qrUrl = themeShare.generateQRCodeUrl(shareUrl)
      expect(qrUrl).toContain('qrserver.com')
      expect(qrUrl).toContain(encodeURIComponent(shareUrl))
    })

    it('should use custom size', async () => {
      const { themeShare } = await import('../themeShare')
      const shareUrl = 'https://example.com'
      const qrUrl = themeShare.generateQRCodeUrl(shareUrl, 300)
      expect(qrUrl).toContain('300x300')
    })

    it('should use default size 200', async () => {
      const { themeShare } = await import('../themeShare')
      const shareUrl = 'https://example.com'
      const qrUrl = themeShare.generateQRCodeUrl(shareUrl)
      expect(qrUrl).toContain('200x200')
    })
  })

  describe('getShare', () => {
    it('should return share by ID', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('dark' as ThemeMode)
      const share = themeShare.getShare(result.shortCode!)
      expect(share).toBeDefined()
      expect(share?.themeMode).toBe('dark')
    })

    it('should return undefined for non-existent share', async () => {
      const { themeShare } = await import('../themeShare')
      const share = themeShare.getShare('NONEXISTENT')
      expect(share).toBeUndefined()
    })
  })

  describe('incrementShareCount', () => {
    it('should increment share count', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('light' as ThemeMode)
      themeShare.incrementShareCount(result.shortCode!)
      const share = themeShare.getShare(result.shortCode!)
      expect(share?.shareCount).toBe(1)
    })

    it('should increment multiple times', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.incrementShareCount(result.shortCode!)
      themeShare.incrementShareCount(result.shortCode!)
      themeShare.incrementShareCount(result.shortCode!)
      const share = themeShare.getShare(result.shortCode!)
      expect(share?.shareCount).toBe(3)
    })

    it('should do nothing for non-existent share', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.incrementShareCount('NONEXISTENT')
      expect(true).toBe(true)
    })
  })

  describe('getRecentShares', () => {
    it('should return recent shares', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.createShareUrl('light' as ThemeMode)
      const recent = themeShare.getRecentShares(5)
      expect(recent.length).toBeLessThanOrEqual(5)
    })

    it('should respect limit parameter', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.createShareUrl('light' as ThemeMode)
      themeShare.createShareUrl('auto' as ThemeMode)
      const recent = themeShare.getRecentShares(2)
      expect(recent.length).toBeLessThanOrEqual(2)
    })

    it('should return empty array when no shares', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.clearAllShares()
      const recent = themeShare.getRecentShares()
      expect(recent.length).toBe(0)
    })
  })

  describe('deleteShare', () => {
    it('should delete share', async () => {
      const { themeShare } = await import('../themeShare')
      const result = themeShare.createShareUrl('auto' as ThemeMode)
      const deleted = themeShare.deleteShare(result.shortCode!)
      expect(deleted).toBe(true)
      expect(themeShare.getShare(result.shortCode!)).toBeUndefined()
    })

    it('should return false for non-existent share', async () => {
      const { themeShare } = await import('../themeShare')
      const deleted = themeShare.deleteShare('NONEXISTENT')
      expect(deleted).toBe(false)
    })
  })

  describe('parseShareUrl', () => {
    it('should parse valid share URL', async () => {
      const { themeShare } = await import('../themeShare')
      const url = 'https://example.com?theme=dark&share=ABC123'
      const parsed = themeShare.parseShareUrl(url)
      expect(parsed.themeMode).toBe('dark')
      expect(parsed.shareId).toBe('ABC123')
    })

    it('should return null for invalid theme mode', async () => {
      const { themeShare } = await import('../themeShare')
      const url = 'https://example.com?theme=invalid&share=ABC123'
      const parsed = themeShare.parseShareUrl(url)
      expect(parsed.themeMode).toBeNull()
    })

    it('should return null for invalid URL', async () => {
      const { themeShare } = await import('../themeShare')
      const parsed = themeShare.parseShareUrl('not-a-url')
      expect(parsed.themeMode).toBeNull()
      expect(parsed.shareId).toBeNull()
    })

    it('should parse light theme', async () => {
      const { themeShare } = await import('../themeShare')
      const url = 'https://example.com?theme=light&share=XYZ'
      const parsed = themeShare.parseShareUrl(url)
      expect(parsed.themeMode).toBe('light')
    })

    it('should parse auto theme', async () => {
      const { themeShare } = await import('../themeShare')
      const url = 'https://example.com?theme=auto&share=XYZ'
      const parsed = themeShare.parseShareUrl(url)
      expect(parsed.themeMode).toBe('auto')
    })

    it('should parse high-contrast-light theme', async () => {
      const { themeShare } = await import('../themeShare')
      const url = 'https://example.com?theme=high-contrast-light&share=XYZ'
      const parsed = themeShare.parseShareUrl(url)
      expect(parsed.themeMode).toBe('high-contrast-light')
    })

    it('should parse high-contrast-dark theme', async () => {
      const { themeShare } = await import('../themeShare')
      const url = 'https://example.com?theme=high-contrast-dark&share=XYZ'
      const parsed = themeShare.parseShareUrl(url)
      expect(parsed.themeMode).toBe('high-contrast-dark')
    })

    it('should handle URL without share param', async () => {
      const { themeShare } = await import('../themeShare')
      const url = 'https://example.com?theme=dark'
      const parsed = themeShare.parseShareUrl(url)
      expect(parsed.themeMode).toBe('dark')
      expect(parsed.shareId).toBeNull()
    })
  })

  describe('getShareStats', () => {
    it('should return share statistics', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.createShareUrl('light' as ThemeMode)
      const stats = themeShare.getShareStats()
      expect(stats.totalShares).toBeGreaterThanOrEqual(2)
      expect(stats.totalClicks).toBeGreaterThanOrEqual(0)
    })

    it('should calculate most shared mode', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.createShareUrl('light' as ThemeMode)
      const stats = themeShare.getShareStats()
      expect(stats.mostSharedMode).toBe('dark')
    })

    it('should return null for mostSharedMode when no shares', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.clearAllShares()
      const stats = themeShare.getShareStats()
      expect(stats.mostSharedMode).toBeFalsy()
    })

    it('should count total clicks', async () => {
      const { themeShare } = await import('../themeShare')
      const result1 = themeShare.createShareUrl('dark' as ThemeMode)
      const result2 = themeShare.createShareUrl('light' as ThemeMode)
      themeShare.incrementShareCount(result1.shortCode!)
      themeShare.incrementShareCount(result1.shortCode!)
      themeShare.incrementShareCount(result2.shortCode!)
      const stats = themeShare.getShareStats()
      expect(stats.totalClicks).toBe(3)
    })
  })

  describe('shareToSocial', () => {
    it('should handle copy platform', async () => {
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'copy',
        themeMode: 'dark' as ThemeMode
      })
      expect(result).toBeDefined()
    })

    it('should handle wechat platform', async () => {
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'wechat',
        themeMode: 'light' as ThemeMode
      })
      expect(result.success).toBe(true)
      expect(result.qrCodeUrl).toBeDefined()
    })

    it('should handle weibo platform', async () => {
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'weibo',
        themeMode: 'dark' as ThemeMode
      })
      expect(result.success).toBe(true)
    })

    it('should handle twitter platform', async () => {
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'twitter',
        themeMode: 'light' as ThemeMode
      })
      expect(result.success).toBe(true)
    })

    it('should handle facebook platform', async () => {
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'facebook',
        themeMode: 'dark' as ThemeMode
      })
      expect(result.success).toBe(true)
    })

    it('should handle custom message', async () => {
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'wechat',
        themeMode: 'dark' as ThemeMode,
        customMessage: 'Check out this theme!'
      })
      expect(result.success).toBe(true)
    })

    it('should handle preset', async () => {
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'wechat',
        themeMode: 'dark' as ThemeMode,
        preset: { id: 'preset-1', name: 'Custom' } as any
      })
      expect(result.success).toBe(true)
    })

    it('should handle clipboard fallback', async () => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard error'))
        }
      })
      vi.resetModules()
      const { themeShare } = await import('../themeShare')
      const result = await themeShare.shareToSocial({
        platform: 'copy',
        themeMode: 'dark' as ThemeMode
      })
      expect(result.success).toBe(true)
    })
  })

  describe('clearAllShares', () => {
    it('should clear all shares', async () => {
      const { themeShare } = await import('../themeShare')
      themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.clearAllShares()
      const recent = themeShare.getRecentShares()
      expect(recent.length).toBe(0)
    })
  })

  describe('subscribe', () => {
    it('should subscribe to share events', async () => {
      const { themeShare } = await import('../themeShare')
      const listener = vi.fn()
      const unsubscribe = themeShare.subscribe(listener)
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('should notify listeners on incrementShareCount', async () => {
      const { themeShare } = await import('../themeShare')
      const listener = vi.fn()
      themeShare.subscribe(listener)
      const result = themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.incrementShareCount(result.shortCode!)
      expect(listener).toHaveBeenCalled()
    })

    it('should unsubscribe correctly', async () => {
      const { themeShare } = await import('../themeShare')
      const listener = vi.fn()
      const unsubscribe = themeShare.subscribe(listener)
      unsubscribe()
      const result = themeShare.createShareUrl('dark' as ThemeMode)
      themeShare.incrementShareCount(result.shortCode!)
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('loadShares with stored data', () => {
    it('should load shares from localStorage', async () => {
      const storedShares = [{
        id: 'STORED1',
        themeMode: 'dark',
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        shareCount: 5
      }]
      mockStore['theme-shares'] = JSON.stringify(storedShares)
      vi.resetModules()
      const { themeShare } = await import('../themeShare')
      const share = themeShare.getShare('STORED1')
      expect(share).toBeDefined()
      expect(share?.shareCount).toBe(5)
    })

    it('should clean expired shares on load', async () => {
      const expiredShares = [{
        id: 'EXPIRED',
        themeMode: 'dark',
        createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        shareCount: 0
      }]
      mockStore['theme-shares'] = JSON.stringify(expiredShares)
      vi.resetModules()
      const { themeShare } = await import('../themeShare')
      const share = themeShare.getShare('EXPIRED')
      expect(share).toBeUndefined()
    })

    it('should handle invalid stored data', async () => {
      mockStore['theme-shares'] = 'invalid-json'
      vi.resetModules()
      const { themeShare } = await import('../themeShare')
      const recent = themeShare.getRecentShares()
      expect(Array.isArray(recent)).toBe(true)
    })
  })
})
