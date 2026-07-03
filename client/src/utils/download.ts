/**
 * 文件下载工具函数
 * 提供文件下载、Blob处理等功能
 */

import { logger } from './logger'

export interface DownloadProgress {
  loaded: number
  total: number
  percentage: number
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  downloadUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export function downloadUrl(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function downloadText(text: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([text], { type: mimeType })
  downloadBlob(blob, filename)
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  downloadText(json, filename, 'application/json')
}

export function downloadCsv(data: Record<string, unknown>[], filename: string): void {
  if (!data || data.length === 0) {
    downloadText('', filename, 'text/csv')
    return
  }

  const headers = Object.keys(data[0])
  const csvRows = [headers.join(',')]

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    csvRows.push(values.join(','))
  }

  const csv = csvRows.join('\n')
  downloadText(csv, filename, 'text/csv')
}

export async function downloadFile(
  url: string,
  filename: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<boolean> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      loaded += value.length

      if (onProgress && total > 0) {
        onProgress({
          loaded,
          total,
          percentage: Math.round((loaded / total) * 100),
        })
      }
    }

    const blob = new Blob(chunks as BlobPart[])
    downloadBlob(blob, filename)

    return true
  } catch (error) {
    logger.error('Download failed:', error as Error)
    return false
  }
}

export function downloadExcel(blob: Blob, filename: string): void {
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function downloadPdf(blob: Blob, filename: string): void {
  downloadBlob(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

export function downloadImage(blob: Blob, filename: string): void {
  const extension = blob.type.split('/')[1] || 'png'
  downloadBlob(blob, filename.endsWith(`.${extension}`) ? filename : `${filename}.${extension}`)
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const bstr = atob(arr[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)

  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }

  return new Blob([u8arr], { type: mime })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

export function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsText(blob)
  })
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsArrayBuffer(blob)
  })
}

export function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/')
    return parts[parts.length - 1] || 'download'
  } catch {
    return 'download'
  }
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

export function getMimeType(filename: string): string {
  const extension = getFileExtension(filename)
  const mimeTypes: Record<string, string> = {
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    zip: 'application/zip',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
  }

  return mimeTypes[extension] || 'application/octet-stream'
}

export function useDownload() {
  return {
    downloadBlob,
    downloadUrl,
    downloadText,
    downloadJson,
    downloadCsv,
    downloadFile,
    downloadExcel,
    downloadPdf,
    downloadImage,
    dataUrlToBlob,
    blobToDataUrl,
    blobToText,
    blobToArrayBuffer,
    getFilenameFromUrl,
    getFileExtension,
    getMimeType,
  }
}

export default {
  downloadBlob,
  downloadUrl,
  downloadText,
  downloadJson,
  downloadCsv,
  downloadFile,
  downloadExcel,
  downloadPdf,
  downloadImage,
  dataUrlToBlob,
  blobToDataUrl,
  blobToText,
  blobToArrayBuffer,
  getFilenameFromUrl,
  getFileExtension,
  getMimeType,
}
