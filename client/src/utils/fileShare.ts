import { ref, computed } from 'vue'

interface ShareLink {
  id: string
  fileId: string
  fileName: string
  url: string
  createdAt: number
  expiresAt: number | null
  password: string | null
  maxDownloads: number | null
  currentDownloads: number
}

const API_BASE = '/api/upload'

class FileShareService {
  private shares = ref<ShareLink[]>([])

  async createShare(fileId: string, options: {
    password?: string
    maxDownloads?: number
    expiresIn?: number
  } = {}): Promise<ShareLink> {
    const response = await fetch(`${API_BASE}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        password: options.password,
        maxDownloads: options.maxDownloads,
        expiresIn: options.expiresIn
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create share')
    }

    const data = await response.json()
    const share: ShareLink = {
      id: data.shareId,
      fileId,
      fileName: '',
      url: data.shareUrl,
      createdAt: Date.now(),
      expiresAt: options.expiresIn ? Date.now() + options.expiresIn * 3600000 : null,
      password: options.password || null,
      maxDownloads: options.maxDownloads || null,
      currentDownloads: 0
    }

    this.shares.value.push(share)
    return share
  }

  async getShare(shareId: string): Promise<ShareLink | null> {
    const response = await fetch(`${API_BASE}/share/${shareId}`)
    if (!response.ok) return null
    
    const data = await response.json()
    return {
      id: shareId,
      fileId: '',
      fileName: data.fileName,
      url: `${API_BASE}/share/${shareId}/download`,
      createdAt: Date.now(),
      expiresAt: null,
      password: null,
      maxDownloads: null,
      currentDownloads: 0
    }
  }

  async downloadShare(shareId: string, password?: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/share/${shareId}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: password ? `password=${encodeURIComponent(password)}` : ''
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Download failed')
    }

    return response.blob()
  }

  async deleteShare(shareId: string): Promise<void> {
    await fetch(`${API_BASE}/share/${shareId}`, { method: 'DELETE' })
    this.shares.value = this.shares.value.filter(s => s.id !== shareId)
  }

  async listShares(userId?: string): Promise<ShareLink[]> {
    const url = userId ? `${API_BASE}/shares?userId=${userId}` : `${API_BASE}/shares`
    const response = await fetch(url)
    
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    type ApiShare = { id: string; fileId: string; fileName: string; createdAt: string; expiresAt?: string; maxDownloads?: number; downloads?: number }
    this.shares.value = data.shares.map((s: ApiShare) => ({
      id: s.id,
      fileId: s.fileId,
      fileName: s.fileName,
      url: `${API_BASE}/share/${s.id}/download`,
      createdAt: new Date(s.createdAt).getTime(),
      expiresAt: s.expiresAt ? new Date(s.expiresAt).getTime() : null,
      password: null,
      maxDownloads: s.maxDownloads,
      currentDownloads: s.downloads || 0,
    }))
    
    return this.shares.value
  }

  getShareUrl(shareId: string): string {
    return `${window.location.origin}${API_BASE}/share/${shareId}/download`
  }

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    }
  }

  get sharesList() {
    return computed(() => this.shares.value)
  }
}

export const useFileShare = () => {
  const service = new FileShareService()
  return {
    createShare: service.createShare.bind(service),
    getShare: service.getShare.bind(service),
    downloadShare: service.downloadShare.bind(service),
    deleteShare: service.deleteShare.bind(service),
    listShares: service.listShares.bind(service),
    getShareUrl: service.getShareUrl.bind(service),
    copyToClipboard: service.copyToClipboard.bind(service),
    sharesList: service.sharesList
  }
}
