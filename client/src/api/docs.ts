import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'
import { uploadFile as uploadFileToServer } from './files'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'

export interface DocUploadResponse {
  id: string
  title: string
  category: string
  path: string
  createdAt: string
  createdBy: string
  fileUrl?: string
  fileType?: string
}

export interface DocListItem {
  id: string
  title: string
  category: string
  path: string
  createdAt: string
  createdBy: string
  markdown?: string
  fileUrl?: string
  fileType?: string
}

export interface DocData {
  id: string
  title: string
  category: string
  markdown: string
  createdAt: string
  createdBy: string
  originalFileName?: string
  fileUrl?: string
  fileType?: string
}

const STORAGE_KEY = STORAGE_KEYS.UPLOADED_DOCS

function getStoredDocs(): DocData[] {
  try {
    const data = StorageManager.getItem<DocData[]>(STORAGE_KEY)
    return Array.isArray(data) ? data : []
  } catch (e) {
    logger.warn('[docs] Failed to read local document', e)
    return []
  }
}

function saveStoredDocs(docs: DocData[]): void {
  StorageManager.setItem(STORAGE_KEY, docs)
}

function generateDocId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 上传文档（转换为 Markdown）
 * 适用于纯文本文档
 */
export async function uploadDocument(
  file: File,
  category: string,
  markdown: string,
  createdBy: string
): Promise<ApiResponse<DocUploadResponse>> {
  const docId = generateDocId()
  const title = file.name.replace(/\.[^/.]+$/, '')

  const docData: DocData = {
    id: docId,
    title,
    category,
    markdown,
    createdAt: new Date().toISOString(),
    createdBy,
    originalFileName: file.name,
  }

  const docs = getStoredDocs()
  docs.push(docData)
  saveStoredDocs(docs)

  return normalizeApiResponse({
    data: {
      id: docId,
      title,
      category,
      path: docId,
      createdAt: docData.createdAt,
      createdBy,
    },
  })
}

export interface OriginalDocData extends DocData {
  fileType: string
  fileData?: string // base64 (仅本地存储时使用)
  fileUrl?: string // 服务器文件 URL
}

/**
 * 上传原始文档（保留原文件格式）
 * 适用于 PPT/Word/PDF 等需要保留格式的文档
 * 
 * 注意：当前实现先上传到服务器获取 URL，然后存储元数据
 * 生产环境应该使用数据库来存储文档元数据
 */
export async function uploadOriginalDocument(
  file: File,
  category: string,
  createdBy: string
): Promise<ApiResponse<DocUploadResponse>> {
  const docId = generateDocId()
  const title = file.name.replace(/\.[^/.]+$/, '')
  const fileType = file.name.split('.').pop()?.toLowerCase() || ''

  try {
    // 1. 上传文件到服务器
    const uploadResponse = await uploadFileToServer(file)

    if (!uploadResponse.success || !uploadResponse.data) {
      return normalizeApiResponse({
        data: null,
        message: uploadResponse.message || '文件上传失败',
      })
    }

    const fileUrl = uploadResponse.data.file_url || uploadResponse.data.url

    if (!fileUrl) {
      return normalizeApiResponse({
        data: null,
        message: '无法获取文件 URL',
      })
    }

    // 2. 保存文档元数据到 localStorage（生产环境应该使用数据库）
    const docData: OriginalDocData = {
      id: docId,
      title,
      category,
      markdown: '', // 原文件模式不需要 markdown
      createdAt: new Date().toISOString(),
      createdBy,
      originalFileName: file.name,
      fileType,
      fileUrl,
    }

    const docs = getStoredDocs()
    docs.push(docData)
    saveStoredDocs(docs)

    return normalizeApiResponse({
      data: {
        id: docId,
        title,
        category,
        path: docId,
        createdAt: docData.createdAt,
        createdBy,
        fileUrl,
        fileType,
      },
    })
  } catch (error) {
    return normalizeApiResponse({
      data: null,
      message: error instanceof Error ? error.message : '上传失败',
    })
  }
}

export async function getDocList(): Promise<ApiResponse<DocListItem[]>> {
  const docs = getStoredDocs()
  const list: DocListItem[] = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    path: doc.id,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    fileUrl: doc.fileUrl,
    fileType: doc.fileType,
  }))

  return normalizeApiResponse({ data: list })
}

export async function getDocContent(docId: string): Promise<ApiResponse<DocData | null>> {
  const docs = getStoredDocs()
  const doc = docs.find((d) => d.id === docId)

  return normalizeApiResponse({ data: doc || null })
}

export async function deleteDocument(docId: string): Promise<ApiResponse<null>> {
  const docs = getStoredDocs()
  const filteredDocs = docs.filter((d) => d.id !== docId)
  saveStoredDocs(filteredDocs)

  return normalizeApiResponse({ data: null })
}

export async function updateDocument(
  docId: string,
  updates: Partial<Pick<DocData, 'title' | 'category' | 'markdown'>>
): Promise<ApiResponse<DocData | null>> {
  const docs = getStoredDocs()
  const index = docs.findIndex((d) => d.id === docId)

  if (index === -1) {
    return normalizeApiResponse({ data: null })
  }

  docs[index] = {
    ...docs[index],
    ...updates,
  }
  saveStoredDocs(docs)

  return normalizeApiResponse({ data: docs[index] })
}

export async function getDocCategories(): Promise<ApiResponse<string[]>> {
  const docs = getStoredDocs()
  const categories = [...new Set(docs.map((d) => d.category))]

  return normalizeApiResponse({ data: categories })
}
