import Taro from '@tarojs/taro'
import { getExt } from '@ihui/shared/utils/file-helpers'
import { buildFileName, joinUrl, toBase64DataUrl } from '@ihui/shared/utils/image-helpers'
import { BASE_URL } from './api-config'
import { getToken } from './auth'
import { readFileToBase64 } from './file-utils'

export interface UploadedPicture {
  base64: string
  fileName: string
}

export interface UploadResult {
  url: string
  fileName: string
}

export function chooseImages(maxCount = 9): Promise<string[]> {
  return new Promise((resolve, reject) => {
    Taro.chooseImage({
      count: maxCount,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
        resolve(paths)
      },
      fail: (err) => {
        const msg = String(err?.errMsg || '').toLowerCase()
        if (msg.includes('cancel')) {
          resolve([])
          return
        }
        reject(err)
      },
    })
  })
}

export async function imagesToBase64(filePaths: string[]): Promise<UploadedPicture[]> {
  const pictures: UploadedPicture[] = []
  for (const filePath of filePaths) {
    const fileName = buildFileName('img', filePath, pictures.length)
    const base64Str = await readFileToBase64(filePath)
    const base64Data = toBase64DataUrl(base64Str, getExt(filePath))
    pictures.push({ base64: base64Data, fileName })
  }
  return pictures
}

export function uploadImage(filePath: string, url = '/files/upload'): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const ext = getExt(filePath)
    const fileName = `img_${Date.now()}.${ext}`
    const fullUrl = joinUrl(BASE_URL, url)

    Taro.uploadFile({
      url: fullUrl,
      filePath,
      name: 'file',
      fileName,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`上传失败(${res.statusCode})`))
          return
        }
        try {
          const body = JSON.parse(res.data) as {
            code?: number
            data?: { url?: string }
            msg?: string
          }
          if (body.code === 0 || body.code === 200) {
            const fileUrl = body.data?.url || ''
            resolve({ url: fileUrl, fileName })
          } else {
            reject(new Error(body.msg || '上传失败'))
          }
        } catch {
          reject(new Error('响应解析失败'))
        }
      },
      fail: (err) => reject(err),
    })
  })
}

export async function uploadPictures(maxCount = 9, url = '/files/upload'): Promise<UploadResult[]> {
  const paths = await chooseImages(maxCount)
  const results: UploadResult[] = []
  for (const p of paths) {
    results.push(await uploadImage(p, url))
  }
  return results
}
