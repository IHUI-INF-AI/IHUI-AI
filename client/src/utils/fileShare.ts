export interface ShareOptions {
  expiresIn?: number
  password?: string
}

export interface ShareResult {
  id: string
  [key: string]: unknown
}

export function useFileShare(): {
  createShare: (fileId: string, options?: ShareOptions) => Promise<ShareResult>
  getShareUrl: (shareId: string) => string
} {
  const createShare = async (_fileId: string, _options?: ShareOptions): Promise<ShareResult> => {
    return { id: '' }
  }

  const getShareUrl = (shareId: string): string => {
    return `/api/share/${shareId}`
  }

  return { createShare, getShareUrl }
}
