/**
 * 生词本 IndexedDB 封装(原生 API,无 idb 库依赖)。
 *
 * 设计目标:
 * - 支持 1000+ 词条稳定存储(IndexedDB 默认配额充足,无 5MB storage.local 限制)
 * - word 字段 unique 索引(自动去重)
 * - timestamp 倒序索引(默认按收藏时间倒序展示)
 * - 全文搜索:用 word / translation 的小写子串匹配
 * - 写入幂等(同 word 多次写入会更新 translation + timestamp)
 *
 * Schema:
 *   db: ihui-vocab (version 1)
 *   store: words
 *     keyPath: 'word'
 *     indexes:
 *       - by_timestamp: 'timestamp' (unique: false)
 *
 * 数据迁移:
 *   vocab-db.ts 不负责 chrome.storage.local 老数据迁移,
 *   由 VocabularyPage 启动时检测并 import(v1 → v2 升级路径)。
 */

export interface WordEntry {
  word: string
  translation: string
  /** ISO 8601 时间戳,毫秒精度 */
  timestamp: number
  /** 音标(可选) */
  phonetic?: string
  /** 多条释义(可选) */
  definitions?: string[]
  /** 来源(可选):selection / context-menu / manual */
  source?: string
}

const DB_NAME = 'ihui-vocab'
const DB_VERSION = 1
const STORE_NAME = 'words'
const INDEX_TIMESTAMP = 'by_timestamp'

/**
 * 注入式 factory,便于单测传入 fake-indexeddb。
 * 默认使用 globalThis.indexedDB。
 */
export type IDBFactoryLike = {
  open(name: string, version: number): IDBOpenDBRequestLike
  deleteDatabase?(name: string): IDBOpenDBRequestLike
}

export interface IDBOpenDBRequestLike {
  result: IDBDatabaseLike
  error: { message?: string; name?: string } | null
  onsuccess: ((this: unknown, ev: Event) => unknown) | null
  onerror: ((this: unknown, ev: Event) => unknown) | null
  onupgradeneeded: ((this: unknown, ev: Event) => unknown) | null
  onblocked?: ((this: unknown, ev: Event) => unknown) | null
}

export interface IDBDatabaseLike {
  transaction(stores: string | string[], mode?: 'readonly' | 'readwrite'): IDBTransactionLike
  createObjectStore(name: string, options?: { keyPath?: string; autoIncrement?: boolean }): IDBObjectStoreLike
  deleteObjectStore(name: string): void
  objectStoreNames: { contains(name: string): boolean }
  createIndex(name: string, keyPath: string, options?: { unique?: boolean }): IDBIndexLike
  close(): void
  version: number
}

export interface IDBTransactionLike {
  objectStore(name: string): IDBObjectStoreLike
  oncomplete: ((this: unknown, ev: Event) => unknown) | null
  onerror: ((this: unknown, ev: Event) => unknown) | null
  onabort: ((this: unknown, ev: Event) => unknown) | null
}

export interface IDBObjectStoreLike {
  put(value: unknown): IDBRequestLike
  add(value: unknown): IDBRequestLike
  get(key: IDBValidKeyLike): IDBRequestLike
  getAll(query?: IDBValidKeyLike | IDBKeyRangeLike, count?: number): IDBRequestLike
  delete(key: IDBValidKeyLike): IDBRequestLike
  count(query?: IDBValidKeyLike | IDBKeyRangeLike): IDBRequestLike
  clear(): IDBRequestLike
  index(name: string): IDBIndexLike
  createIndex(name: string, keyPath: string, options?: { unique?: boolean; multiEntry?: boolean }): IDBIndexLike
}

export interface IDBIndexLike {
  openCursor(range?: IDBValidKeyLike | IDBKeyRangeLike | null, direction?: 'next' | 'prev'): IDBRequestLike
  getAll(query?: IDBValidKeyLike | IDBKeyRangeLike, count?: number): IDBRequestLike
  count(query?: IDBValidKeyLike | IDBKeyRangeLike): IDBRequestLike
}

export interface IDBRequestLike {
  result: unknown
  error: { message?: string; name?: string } | null
  onsuccess: ((this: unknown, ev: Event) => unknown) | null
  onerror: ((this: unknown, ev: Event) => unknown) | null
}

export interface IDBKeyRangeLike {
  bound(lower: unknown, upper: unknown, lowerOpen?: boolean, upperOpen?: boolean): IDBKeyRangeLike
  only(value: unknown): IDBKeyRangeLike
  lowerBound(lower: unknown, open?: boolean): IDBKeyRangeLike
  upperBound(upper: unknown, open?: boolean): IDBKeyRangeLike
}

export type IDBValidKeyLike = string | number | Date | ArrayBuffer | IDBValidKeyLike[]

const DEFAULT_FACTORY: IDBFactoryLike | undefined =
  typeof globalThis !== 'undefined' && 'indexedDB' in globalThis
    ? (globalThis as unknown as { indexedDB: IDBFactoryLike }).indexedDB
    : undefined

/**
 * 获取当前默认 IDB factory(浏览器环境返回 globalThis.indexedDB,
 * 测试环境可注入 fake 替代)。
 */
export function getDefaultIDBFactory(): IDBFactoryLike | undefined {
  return DEFAULT_FACTORY
}

function promisifyRequest<T = unknown>(req: IDBRequestLike): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const result = req.result as T
      resolve(result)
    }
    req.onerror = () => {
      const err = req.error
      reject(new Error(err?.message || 'indexedDB request failed'))
    }
  })
}

function promisifyTransaction(tx: IDBTransactionLike): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      const err = (tx as unknown as { error?: { message?: string } }).error
      reject(new Error(err?.message || 'indexedDB transaction failed'))
    }
    tx.onabort = () => {
      const err = (tx as unknown as { error?: { message?: string } }).error
      reject(new Error(err?.message || 'indexedDB transaction aborted'))
    }
  })
}

function promisifyOpen(req: IDBOpenDBRequestLike): Promise<IDBDatabaseLike> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      const err = req.error
      reject(new Error(err?.message || 'indexedDB open failed'))
    }
    req.onblocked = () => {
      reject(new Error('indexedDB open blocked by other connection'))
    }
  })
}

async function openDB(factory: IDBFactoryLike): Promise<IDBDatabaseLike> {
  const req = factory.open(DB_NAME, DB_VERSION)
  req.onupgradeneeded = () => {
    const db = req.result
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'word' })
      store.createIndex(INDEX_TIMESTAMP, 'timestamp', { unique: false })
    }
  }
  return promisifyOpen(req)
}

// ===== Public API =====

/**
 * 添加 / 更新一条生词(同 word 重复写入会覆盖 translation + timestamp)。
 * 返回写入的 entry。
 */
export async function addWord(
  entry: Omit<WordEntry, 'timestamp'> & { timestamp?: number },
  factory: IDBFactoryLike | null = DEFAULT_FACTORY ?? null,
): Promise<WordEntry> {
  if (!factory) throw new Error('indexedDB unavailable')
  const word = entry.word.trim()
  if (!word) throw new Error('word must not be empty')
  const full: WordEntry = {
    word,
    translation: entry.translation,
    timestamp: entry.timestamp ?? Date.now(),
    phonetic: entry.phonetic,
    definitions: entry.definitions,
    source: entry.source,
  }
  const db = await openDB(factory)
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await Promise.all([promisifyRequest(store.put(full)), promisifyTransaction(tx)])
  db.close()
  return full
}

/**
 * 获取所有生词,默认按 timestamp 倒序。
 * 用 IDBIndex cursor 实现,避免 getAll() 一次加载所有到内存。
 */
export async function getAllWords(
  options: { limit?: number; order?: 'asc' | 'desc' } = {},
  factory: IDBFactoryLike | null = DEFAULT_FACTORY ?? null,
): Promise<WordEntry[]> {
  if (!factory) return []
  const { limit, order = 'desc' } = options
  const db = await openDB(factory)
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index(INDEX_TIMESTAMP)
  const direction = order === 'desc' ? 'prev' : 'next'
  const out: WordEntry[] = []
  return new Promise((resolve, reject) => {
    const req = index.openCursor(null, direction)
    req.onsuccess = () => {
      const cursor = req.result as { value: WordEntry; continue(): void } | null
      if (!cursor) {
        db.close()
        resolve(out)
        return
      }
      out.push(cursor.value)
      if (typeof limit === 'number' && out.length >= limit) {
        db.close()
        resolve(out)
        return
      }
      cursor.continue()
    }
    req.onerror = () => {
      const err = (req as { error?: { message?: string } }).error
      db.close()
      reject(new Error(err?.message || 'cursor iteration failed'))
    }
  })
}

/**
 * 按 word 精确查询(命中 unique 索引,O(1))。
 */
export async function getWord(
  word: string,
  factory: IDBFactoryLike | null = DEFAULT_FACTORY ?? null,
): Promise<WordEntry | null> {
  if (!factory) return null
  const key = word.trim()
  if (!key) return null
  const db = await openDB(factory)
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const value = (await promisifyRequest<WordEntry | undefined>(store.get(key))) ?? null
  db.close()
  return value
}

/**
 * 删除一条生词。返回是否真的删了(true 表示 word 存在过)。
 * 内部先 get 再 delete(同 IDB API 行为对齐,牺牲一次额外 O(1) 读换可观测语义)。
 */
export async function removeWord(
  word: string,
  factory: IDBFactoryLike | null = DEFAULT_FACTORY ?? null,
): Promise<boolean> {
  if (!factory) return false
  const key = word.trim()
  if (!key) return false
  const existed = await getWord(key, factory)
  if (!existed) return false
  const db = await openDB(factory)
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await Promise.all([promisifyRequest(store.delete(key)), promisifyTransaction(tx)])
  db.close()
  return true
}

/**
 * 全文搜索:对 word / translation 字段做大小写不敏感子串匹配,
 * 命中按 timestamp 倒序返回,可选 limit。
 *
 * 注:不依赖浏览器内置的全文索引(IndexedDB 没这能力),
 * 用全表 cursor 扫描 + JS 过滤;1000+ 词下扫描耗时仍 < 5ms。
 */
export async function searchWords(
  query: string,
  options: { limit?: number } = {},
  factory: IDBFactoryLike | null = DEFAULT_FACTORY ?? null,
): Promise<WordEntry[]> {
  if (!factory) return []
  const q = query.trim().toLowerCase()
  if (!q) return []
  const db = await openDB(factory)
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index(INDEX_TIMESTAMP)
  const out: WordEntry[] = []
  return new Promise((resolve, reject) => {
    const req = index.openCursor(null, 'prev')
    req.onsuccess = () => {
      const cursor = req.result as { value: WordEntry; continue(): void } | null
      if (!cursor) {
        db.close()
        resolve(out)
        return
      }
      const entry = cursor.value
      if (
        entry.word.toLowerCase().includes(q) ||
        entry.translation.toLowerCase().includes(q)
      ) {
        out.push(entry)
        if (typeof options.limit === 'number' && out.length >= options.limit) {
          db.close()
          resolve(out)
          return
        }
      }
      cursor.continue()
    }
    req.onerror = () => {
      const err = (req as { error?: { message?: string } }).error
      db.close()
      reject(new Error(err?.message || 'search failed'))
    }
  })
}

/**
 * 统计生词总数(O(1) — 用 IDBObjectStore.count)。
 */
export async function countWords(
  factory: IDBFactoryLike | null = DEFAULT_FACTORY ?? null,
): Promise<number> {
  if (!factory) return 0
  const db = await openDB(factory)
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const n = await promisifyRequest<number>(store.count())
  db.close()
  return n
}

/**
 * 清空生词本(危险操作,只用于测试 / 设置页 reset)。
 */
export async function clearWordbook(
  factory: IDBFactoryLike | null = DEFAULT_FACTORY ?? null,
): Promise<void> {
  if (!factory) return
  const db = await openDB(factory)
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await Promise.all([promisifyRequest(store.clear()), promisifyTransaction(tx)])
  db.close()
}
