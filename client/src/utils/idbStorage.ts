const DB_NAME = 'theme-sync-db'
const DB_VERSION = 1
const HISTORY_STORE = 'sync-history'
const QUEUE_STORE = 'offline-queue'

export interface IDBStorage {
  isSupported: () => boolean
  init: () => Promise<void>
  addRecord: (storeName: string, record: any) => Promise<string>
  getRecords: (storeName: string, limit?: number) => Promise<unknown[]>
  getRecordById: (storeName: string, id: string) => Promise<unknown | undefined>
  deleteRecord: (storeName: string, id: string) => Promise<boolean>
  clearStore: (storeName: string) => Promise<void>
  getRecordCount: (storeName: string) => Promise<number>
  updateRecord: (storeName: string, id: string, data: any) => Promise<boolean>
}

class IndexedDBStorage implements IDBStorage {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  isSupported(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('IndexedDB is not supported'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' })
          historyStore.createIndex('timestamp', 'timestamp', { unique: false })
          historyStore.createIndex('status', 'status', { unique: false })
        }

        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
          queueStore.createIndex('userId', 'userId', { unique: false })
          queueStore.createIndex('status', 'status', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    return this.db!
  }

  async addRecord(storeName: string, record: any): Promise<string> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.add(record)

      request.onsuccess = () => {
        resolve((record as { id: string }).id)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async getRecords(storeName: string, limit?: number): Promise<unknown[]> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const index = store.index('timestamp')
      const request = index.openCursor(null, 'prev')
      
      const records: any[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        
        if (cursor && (!limit || records.length < limit)) {
          records.push(cursor.value)
          cursor.continue()
        } else {
          resolve(records)
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async getRecordById(storeName: string, id: string): Promise<unknown | undefined> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async deleteRecord(storeName: string, id: string): Promise<boolean> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve(true)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async getRecordCount(storeName: string): Promise<number> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.count()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async updateRecord(storeName: string, id: string, data: any): Promise<boolean> {
    const db = await this.getDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.put({ ...(data as object), id })

      request.onsuccess = () => {
        resolve(true)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }
}

export const idbStorage = new IndexedDBStorage()
