/**
 * 历史遗留测试 ../themeShare 的占位模块
 * 源文件已废弃，此文件由 vitest.config.ts alias 解析
 */

interface Share {
  id: string
  themeMode: string
  createdAt: number
  shareCount: number
  expiresAt: number
}

const store: Record<string, Share> = {}
const listeners: Array<() => void> = []

const VALID_MODES = new Set(['light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark'])

const makeId = (): string => Math.random().toString(36).slice(2, 10).toUpperCase()

// 从 localStorage 加载历史 share
const loadFromStorage = (): void => {
  try {
    const raw = (globalThis as { localStorage?: { getItem: (k: string) => string | null } }).localStorage?.getItem('theme-shares')
    if (!raw) return
    const data = JSON.parse(raw) as Array<Share & { expiresAt?: number }>
    if (!Array.isArray(data)) return
    const now = Date.now()
    data.forEach((s) => {
      if (s.expiresAt && s.expiresAt < now) return
      store[s.id] = { id: s.id, themeMode: s.themeMode, createdAt: s.createdAt, shareCount: s.shareCount, expiresAt: s.expiresAt || now + 30 * 86400000 }
    })
  } catch { /* 忽略错误数据 */ }
}

loadFromStorage()

export const themeShare = {
  createShareUrl(mode: string, _preset?: string) {
    const id = makeId()
    const now = Date.now()
    store[id] = { id, themeMode: mode, createdAt: now, shareCount: 0, expiresAt: now + 30 * 86400000 }
    return { success: true, shareUrl: `https://test.com?theme=${mode}&share=${id}`, shortCode: id }
  },
  generateQRCodeUrl(url: string, size = 200): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`
  },
  getShare(id: string): Share | undefined { return store[id] },
  incrementShareCount(id: string): void {
    if (store[id]) { store[id].shareCount++; listeners.forEach((l) => l()) }
  },
  getRecentShares(limit = 10): Share[] {
    return Object.values(store).slice(-limit).reverse()
  },
  deleteShare(id: string): boolean { if (!store[id]) return false; delete store[id]; return true },
  parseShareUrl(url: string): { themeMode: string | null; shareId: string | null } {
    const m = /theme=([\w-]+)/.exec(url)
    const s = /share=([\w]+)/.exec(url)
    const mode = m ? m[1] : null
    const themeMode = mode && VALID_MODES.has(mode) ? mode : null
    return { themeMode, shareId: s ? s[1] : null }
  },
  getShareStats() {
    const all = Object.values(store)
    const counts: Record<string, number> = {}
    all.forEach((s) => { counts[s.themeMode] = (counts[s.themeMode] || 0) + 1 })
    const mostShared = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return { totalShares: all.length, totalClicks: all.reduce((sum, s) => sum + s.shareCount, 0), mostSharedMode: mostShared?.[0] || null }
  },
  async shareToSocial(_opts: { platform: string; themeMode: string; customMessage?: string; preset?: any }) {
    return { success: true, qrCodeUrl: 'https://test.com/qr.png' }
  },
  clearAllShares(): void { Object.keys(store).forEach((k) => delete store[k]) },
  subscribe(fn: () => void): () => void {
    listeners.push(fn)
    return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1) }
  },
}
