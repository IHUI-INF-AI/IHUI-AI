/**
 * 前端新闻存储服务
 * 使用IndexedDB存储新闻数据，完全前端实现
 */

import { logger } from '@/utils/logger'

export interface StoredNewsItem {
  id: string
  title: string
  summary?: string
  content?: string
  cover_image?: string
  publish_time: string
  source: string
  source_url: string
  author?: string
  category?: string
  language?: string
  created_at: number
  updated_at: number
}

const DB_NAME = 'ai-news-db'
const DB_VERSION = 1
const STORE_NAME = 'news'

let db: IDBDatabase | null = null

/**
 * 初始化数据库
 */
export async function initDatabase(): Promise<IDBDatabase> {
  if (db) {
    return db
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('无法打开数据库'))
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // 创建对象存储
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
        })

        // 创建索引
        objectStore.createIndex('publish_time', 'publish_time', { unique: false })
        objectStore.createIndex('source', 'source', { unique: false })
        objectStore.createIndex('category', 'category', { unique: false })
        objectStore.createIndex('created_at', 'created_at', { unique: false })
      }
    }
  })
}

/**
 * 批量保存新闻到数据库（优化版本）
 */
export async function saveNews(newsItems: Omit<StoredNewsItem, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
  if (newsItems.length === 0) {
    return 0
  }

  const database = await initDatabase()
  const BATCH_SIZE = 50
  const batches = []
  
  for (let i = 0; i < newsItems.length; i += BATCH_SIZE) {
    batches.push(newsItems.slice(i, i + BATCH_SIZE))
  }

  let totalSavedCount = 0

  for (const batch of batches) {
    const savedCount = await saveNewsBatch(database, batch)
    totalSavedCount += savedCount
  }

  return totalSavedCount
}

/**
 * 保存一批新闻到数据库
 */
async function saveNewsBatch(
  database: IDBDatabase,
  newsItems: Omit<StoredNewsItem, 'id' | 'created_at' | 'updated_at'>[]
): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    let savedCount = 0
    let updatedCount = 0
    let completedOperations = 0
    const totalOperations = newsItems.length
    
    // 立即设置事务事件处理器
    transaction.oncomplete = () => {
      logger.info(`[Storage] Batch save completed: ${savedCount} new news items, ${updatedCount} updated`)
      resolve(savedCount)
    }
    
    transaction.onerror = () => {
      logger.error('[Storage] Batch save transaction failed:', transaction.error)
      resolve(savedCount) // 返回已保存的数量
    }
    
    const itemIds = newsItems.map(item => generateNewsId(item.title, item.source_url))
    
    store.getAll(itemIds).onsuccess = (event) => {
      try {
        const existingItems = (event.target as IDBRequest).result as StoredNewsItem[]
        const existingMap = new Map(existingItems.map(item => [item.id, item]))
        
        for (const item of newsItems) {
          const id = generateNewsId(item.title, item.source_url)
          const existing = existingMap.get(id)
          
          if (!existing) {
            // 新新闻，使用 put 而不是 add，避免重复键错误
            const newsItem: StoredNewsItem = {
              ...item,
              id,
              created_at: Date.now(),
              updated_at: Date.now(),
            }
            
            const request = store.put(newsItem)
            request.onsuccess = () => {
              savedCount++
              completedOperations++
              if (completedOperations === totalOperations) {
                // 所有操作完成，事务会自动提交
              }
            }
            request.onerror = () => {
              logger.warn(`[Storage] Failed to save news: ${item.title}`, request.error)
              completedOperations++
              if (completedOperations === totalOperations) {
                // 所有操作完成
              }
            }
          } else {
            // 检查是否需要更新
            if (existing.title !== item.title || existing.summary !== item.summary || existing.content !== item.content) {
              const updatedItem: StoredNewsItem = {
                ...existing,
                ...item,
                id,
                updated_at: Date.now(),
              }
              
              const request = store.put(updatedItem)
              request.onsuccess = () => {
                updatedCount++
                completedOperations++
                if (completedOperations === totalOperations) {
                  // 所有操作完成
                }
              }
              request.onerror = () => {
                logger.warn(`[Storage] Failed to update news: ${item.title}`, request.error)
                completedOperations++
                if (completedOperations === totalOperations) {
                  // 所有操作完成
                }
              }
            } else {
              // 不需要更新，直接计数
              completedOperations++
              if (completedOperations === totalOperations) {
                // 所有操作完成
              }
            }
          }
        }
      } catch (error) {
        logger.error('[Storage] Batch operation failed:', error)
        resolve(0)
      }
    }
    
    store.getAll(itemIds).onerror = (event) => {
      logger.error('[Storage] Batch query failed:', (event.target as IDBRequest).error)
      reject(new Error('Batch query failed'))
    }
  })
}

/**
 * 获取新闻列表
 */
export async function getNewsList(params: {
  category?: string
  source?: string
  limit?: number
  offset?: number
  orderBy?: 'publish_time' | 'created_at'
  order?: 'asc' | 'desc'
}): Promise<{ total: number; list: StoredNewsItem[] }> {
  const database = await initDatabase()
  const transaction = database.transaction([STORE_NAME], 'readonly')
  const store = transaction.objectStore(STORE_NAME)

  let index: IDBIndex
  if (params.orderBy === 'created_at') {
    index = store.index('created_at')
  } else {
    index = store.index('publish_time')
  }

  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, params.order === 'desc' ? 'prev' : 'next')
    const results: StoredNewsItem[] = []
    let offset = params.offset || 0
    let count = 0

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result

      if (cursor) {
        const item = cursor.value as StoredNewsItem

        // 过滤条件
        if (params.category && item.category !== params.category) {
          cursor.continue()
          return
        }
        if (params.source && item.source !== params.source) {
          cursor.continue()
          return
        }

        // 跳过offset
        if (offset > 0) {
          offset--
          cursor.continue()
          return
        }

        // 添加到结果
        results.push(item)
        count++

        // 检查limit
        if (params.limit && count >= params.limit) {
          // 需要获取总数
          getAllCount(store, params).then((total) => {
            resolve({ total, list: results })
          }).catch((err) => { reject(err) })
          return
        }

        cursor.continue()
      } else {
        // 获取总数
        getAllCount(store, params).then((total) => {
          resolve({ total, list: results })
        }).catch((err) => { reject(err) })
      }
    }

    request.onerror = () => {
      reject(new Error('查询失败'))
    }
  })
}

/**
 * 获取总数
 */
async function getAllCount(
  store: IDBObjectStore,
  params: { category?: string; source?: string }
): Promise<number> {
  return new Promise((resolve) => {
    const request = store.openCursor()
    let count = 0

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result

      if (cursor) {
        const item = cursor.value as StoredNewsItem

        // 应用相同的过滤条件
        if (params.category && item.category !== params.category) {
          cursor.continue()
          return
        }
        if (params.source && item.source !== params.source) {
          cursor.continue()
          return
        }

        count++
        cursor.continue()
      } else {
        resolve(count)
      }
    }

    request.onerror = () => {
      resolve(0)
    }
  })
}

/**
 * 删除旧新闻（保留最近N天的）
 */
export async function cleanOldNews(daysToKeep: number = 30): Promise<number> {
  const database = await initDatabase()
  const transaction = database.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index('created_at')

  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
  let deletedCount = 0

  return new Promise((resolve, reject) => {
    const request = index.openCursor()

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result

      if (cursor) {
        const item = cursor.value as StoredNewsItem

        if (item.created_at < cutoffTime) {
          cursor.delete()
          deletedCount++
        }

        cursor.continue()
      } else {
        resolve(deletedCount)
      }
    }

    request.onerror = () => {
      reject(new Error('清理失败'))
    }
  })
}

/**
 * 生成新闻ID
 */
function generateNewsId(title: string, sourceUrl: string): string {
  const str = `${title}-${sourceUrl}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `news_${Math.abs(hash).toString(36)}`
}

/**
 * 获取存储统计信息
 */
export async function getStorageStats(): Promise<{
  total: number
  byCategory: Record<string, number>
  bySource: Record<string, number>
}> {
  const database = await initDatabase()
  const transaction = database.transaction([STORE_NAME], 'readonly')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve) => {
    const request = store.openCursor()
    const stats = {
      total: 0,
      byCategory: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    }

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result

      if (cursor) {
        const item = cursor.value as StoredNewsItem
        stats.total++

        const category = item.category || 'unknown'
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1

        const source = item.source || 'unknown'
        stats.bySource[source] = (stats.bySource[source] || 0) + 1

        cursor.continue()
      } else {
        resolve(stats)
      }
    }

    request.onerror = () => {
      resolve(stats)
    }
  })
}
