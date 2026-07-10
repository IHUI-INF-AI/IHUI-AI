'use client'

import * as React from 'react'

export interface UseDownloadReturn {
  isDownloading: boolean
  download: (url: string, filename?: string) => Promise<void>
  downloadBlob: (blob: Blob, filename: string) => void
}

/** 文件下载 Hook */
export function useDownload(): UseDownloadReturn {
  const [isDownloading, setDownloading] = React.useState(false)

  const download = React.useCallback(async (url: string, filename?: string) => {
    if (typeof window === 'undefined') return
    setDownloading(true)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const name = filename ?? url.split('/').pop() ?? 'download'
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } finally {
      setDownloading(false)
    }
  }, [])

  const downloadBlob = React.useCallback((blob: Blob, filename: string) => {
    if (typeof window === 'undefined') return
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  }, [])

  return { isDownloading, download, downloadBlob }
}
