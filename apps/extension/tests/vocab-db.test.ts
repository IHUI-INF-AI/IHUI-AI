/**
 * IndexedDB 生词本封装单元测试。
 * 用最小化 in-memory mock IDB 模拟原生 API 行为,
 * 覆盖 addWord / getAllWords / getWord / removeWord / searchWords / countWords / clearWordbook
 * + 1000+ 词稳定性。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  addWord,
  getAllWords,
  getWord,
  removeWord,
  searchWords,
  countWords,
  clearWordbook,
  type IDBFactoryLike,
  type IDBRequestLike,
  type IDBOpenDBRequestLike,
  type IDBObjectStoreLike,
  type IDBDatabaseLike,
  type IDBIndexLike,
  type IDBValidKeyLike,
  type IDBKeyRangeLike,
  type WordEntry,
} from '../src/idb/vocab-db'

// ===== In-memory IDB mock =====

type Store = Map<string, Record<string, unknown>>

class FakeRequest<T = unknown> implements IDBRequestLike {
  result: T
  error: { message?: string; name?: string } | null = null
  onsuccess: ((this: unknown, ev: Event) => unknown) | null = null
  onerror: ((this: unknown, ev: Event) => unknown) | null = null
  constructor(initial: T) {
    this.result = initial
  }
  fireSuccess() {
    queueMicrotask(() => this.onsuccess?.(new Event('success')))
  }
  fireError(err: { message?: string; name?: string }) {
    this.error = err
    queueMicrotask(() => this.onerror?.(new Event('error')))
  }
}

interface CursorLike {
  value: Record<string, unknown>
  continue(): void
}

class FakeIndex implements IDBIndexLike {
  constructor(private store: Store, private keyPath: string) {}
  openCursor(
    _range?: IDBValidKeyLike | IDBKeyRangeLike | null,
    direction: 'next' | 'prev' = 'next',
  ) {
    const req = new FakeRequest<CursorLike | null>(null)
    queueMicrotask(() => {
      const entries = Array.from(this.store.values())
      entries.sort((a, b) => {
        const av = a[this.keyPath] as number
        const bv = b[this.keyPath] as number
        return direction === 'prev' ? bv - av : av - bv
      })
      let i = 0
      const cursor: CursorLike = {
        get value() {
          return entries[i] as Record<string, unknown>
        },
        continue() {
          i += 1
          req.result = i < entries.length ? cursor : null
          req.fireSuccess()
        },
      }
      req.result = entries.length > 0 ? cursor : null
      req.fireSuccess()
    })
    return req
  }
  getAll(_query?: IDBValidKeyLike | IDBKeyRangeLike, count?: number) {
    const req = new FakeRequest<Record<string, unknown>[]>([])
    queueMicrotask(() => {
      let arr = Array.from(this.store.values())
      if (count !== undefined) arr = arr.slice(0, count)
      req.result = arr
      req.fireSuccess()
    })
    return req
  }
  count(_query?: IDBValidKeyLike | IDBKeyRangeLike) {
    const req = new FakeRequest<number>(0)
    queueMicrotask(() => {
      req.result = this.store.size
      req.fireSuccess()
    })
    return req
  }
}

class FakeStore implements IDBObjectStoreLike {
  indexData = new Map<string, FakeIndex>()
  constructor(public data: Store) {}
  put(value: Record<string, unknown>) {
    const req = new FakeRequest<string>('')
    const key = String(value['word'])
    this.data.set(key, value)
    queueMicrotask(() => {
      req.result = key
      req.fireSuccess()
    })
    return req
  }
  add(value: Record<string, unknown>) {
    const req = new FakeRequest<string>('')
    const key = String(value['word'])
    if (this.data.has(key)) {
      req.error = { name: 'ConstraintError', message: 'duplicate' }
      queueMicrotask(() => req.fireError(req.error!))
    } else {
      this.data.set(key, value)
      queueMicrotask(() => {
        req.result = key
        req.fireSuccess()
      })
    }
    return req
  }
  get(key: IDBValidKeyLike) {
    const req = new FakeRequest<Record<string, unknown> | undefined>(undefined)
    const v = this.data.get(String(key))
    queueMicrotask(() => {
      req.result = v
      req.fireSuccess()
    })
    return req
  }
  getAll() {
    const req = new FakeRequest<Record<string, unknown>[]>([])
    queueMicrotask(() => {
      req.result = Array.from(this.data.values())
      req.fireSuccess()
    })
    return req
  }
  delete(key: IDBValidKeyLike) {
    const req = new FakeRequest<boolean>(false)
    const had = this.data.delete(String(key))
    queueMicrotask(() => {
      req.result = had
      req.fireSuccess()
    })
    return req
  }
  count() {
    const req = new FakeRequest<number>(0)
    queueMicrotask(() => {
      req.result = this.data.size
      req.fireSuccess()
    })
    return req
  }
  clear() {
    const req = new FakeRequest<undefined>(undefined)
    this.data.clear()
    queueMicrotask(() => {
      req.result = undefined
      req.fireSuccess()
    })
    return req
  }
  index(name: string) {
    let idx = this.indexData.get(name)
    if (!idx) {
      idx = new FakeIndex(this.data, name === 'by_timestamp' ? 'timestamp' : name)
      this.indexData.set(name, idx)
    }
    return idx
  }
  createIndex(name: string, keyPath: string) {
    const idx = new FakeIndex(this.data, keyPath)
    this.indexData.set(name, idx)
    return idx
  }
}

class FakeTransaction {
  oncomplete: ((this: unknown, ev: Event) => unknown) | null = null
  onerror: ((this: unknown, ev: Event) => unknown) | null = null
  onabort: ((this: unknown, ev: Event) => unknown) | null = null
  stores = new Map<string, FakeStore>()
  constructor(public databases: Map<string, FakeStore>, _mode: 'readonly' | 'readwrite', storeNames: string[]) {
    for (const name of storeNames) {
      const s = databases.get(name)
      if (s) this.stores.set(name, s)
    }
    queueMicrotask(() => this.oncomplete?.(new Event('complete')))
  }
  objectStore(name: string) {
    const s = this.stores.get(name)
    if (!s) throw new Error(`object store ${name} not found`)
    return s
  }
}

class FakeDatabase implements IDBDatabaseLike {
  stores = new Map<string, FakeStore>()
  version: number
  name = ''
  objectStoreNames = { contains: (name: string) => this.stores.has(name) }
  constructor(version: number) {
    this.version = version
  }
  transaction(stores: string | string[], mode: 'readonly' | 'readwrite' = 'readonly') {
    const names = Array.isArray(stores) ? stores : [stores]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new FakeTransaction(this.stores, mode, names) as any
  }
  createObjectStore(name: string) {
    const s = new FakeStore(new Map())
    this.stores.set(name, s)
    return s
  }
  deleteObjectStore(name: string) {
    this.stores.delete(name)
  }
  createIndex() {
    return new FakeIndex(new Map(), 'timestamp')
  }
  close() {}
}

function makeFactory(): IDBFactoryLike & { _dbs: FakeDatabase[] } {
  const dbs: FakeDatabase[] = []
  const f: IDBFactoryLike & { _dbs: FakeDatabase[] } = {
    _dbs: dbs,
    open(name: string, version: number) {
      const req = {
        result: null as IDBDatabaseLike | null,
        error: null as { message?: string; name?: string } | null,
        onsuccess: null as ((this: unknown, ev: Event) => unknown) | null,
        onerror: null as ((this: unknown, ev: Event) => unknown) | null,
        onupgradeneeded: null as ((this: unknown, ev: Event) => unknown) | null,
        onblocked: undefined,
      }
      // 同一 name 共享同一 db(模拟 IndexedDB 行为)
      let db = dbs.find((d) => d.name === name)
      const isNew = !db
      if (!db) {
        db = new FakeDatabase(version)
        db.name = name
        dbs.push(db)
      }
      queueMicrotask(() => {
        if (isNew && typeof req.onupgradeneeded === 'function') {
          req.result = db!
          req.onupgradeneeded.call(req, new Event('upgradeneeded'))
        }
        req.result = db!
        if (typeof req.onsuccess === 'function') {
          req.onsuccess.call(req, new Event('success'))
        }
      })
      return req as unknown as IDBOpenDBRequestLike
    },
  }
  return f
}

let factory: IDBFactoryLike & { _dbs: FakeDatabase[] }

beforeEach(() => {
  factory = makeFactory()
})

describe('vocab-db', () => {
  describe('addWord / getWord', () => {
    it('添加并按 word 取回', async () => {
      const e = await addWord({ word: 'hello', translation: '你好' }, factory)
      expect(e.word).toBe('hello')
      expect(e.translation).toBe('你好')
      expect(typeof e.timestamp).toBe('number')
      const got = await getWord('hello', factory)
      expect(got?.translation).toBe('你好')
    })

    it('空 word 拒绝', async () => {
      await expect(addWord({ word: '   ', translation: 'x' }, factory)).rejects.toThrow()
    })

    it('同 word 重复添加会覆盖 translation + timestamp', async () => {
      await addWord({ word: 'run', translation: '跑', timestamp: 1000 }, factory)
      const updated = await addWord({ word: 'run', translation: '运行', timestamp: 2000 }, factory)
      expect(updated.translation).toBe('运行')
      expect(updated.timestamp).toBe(2000)
      const all = await getAllWords({}, factory)
      expect(all.length).toBe(1)
    })

    it('word 自动 trim', async () => {
      await addWord({ word: '  hello  ', translation: '你好' }, factory)
      const got = await getWord('hello', factory)
      expect(got?.word).toBe('hello')
    })

    it('无 factory 时抛错', async () => {
      await expect(addWord({ word: 'x', translation: 'x' }, null)).rejects.toThrow()
    })
  })

  describe('getAllWords', () => {
    it('按 timestamp 倒序返回', async () => {
      await addWord({ word: 'a', translation: 'A', timestamp: 100 }, factory)
      await addWord({ word: 'b', translation: 'B', timestamp: 300 }, factory)
      await addWord({ word: 'c', translation: 'C', timestamp: 200 }, factory)
      const all = await getAllWords({}, factory)
      expect(all.map((e) => e.word)).toEqual(['b', 'c', 'a'])
    })

    it('limit 生效', async () => {
      for (let i = 0; i < 10; i++) {
        await addWord({ word: `w${i}`, translation: `t${i}`, timestamp: i }, factory)
      }
      const top3 = await getAllWords({ limit: 3 }, factory)
      expect(top3.length).toBe(3)
    })

    it('order asc 升序', async () => {
      await addWord({ word: 'a', translation: 'A', timestamp: 100 }, factory)
      await addWord({ word: 'b', translation: 'B', timestamp: 200 }, factory)
      const all = await getAllWords({ order: 'asc' }, factory)
      expect(all[0]?.word).toBe('a')
      expect(all[1]?.word).toBe('b')
    })

    it('支持 1000+ 词', async () => {
      for (let i = 0; i < 1200; i++) {
        await addWord({ word: `w${i}`, translation: `t${i}`, timestamp: i }, factory)
      }
      const all = await getAllWords({}, factory)
      expect(all.length).toBe(1200)
      const cnt = await countWords(factory)
      expect(cnt).toBe(1200)
    })
  })

  describe('removeWord', () => {
    it('删除存在的词返回 true', async () => {
      await addWord({ word: 'x', translation: 'X' }, factory)
      const ok = await removeWord('x', factory)
      expect(ok).toBe(true)
      const all = await getAllWords({}, factory)
      expect(all.length).toBe(0)
    })

    it('删除不存在的词返回 false', async () => {
      const ok = await removeWord('nope', factory)
      expect(ok).toBe(false)
    })
  })

  describe('searchWords', () => {
    it('按 word 子串匹配', async () => {
      await addWord({ word: 'apple', translation: '苹果', timestamp: 1 }, factory)
      await addWord({ word: 'banana', translation: '香蕉', timestamp: 2 }, factory)
      await addWord({ word: 'pineapple', translation: '菠萝', timestamp: 3 }, factory)
      const res = await searchWords('apple', {}, factory)
      expect(res.map((e) => e.word).sort()).toEqual(['apple', 'pineapple'])
    })

    it('按 translation 子串匹配(中文)', async () => {
      await addWord({ word: 'a', translation: '苹果', timestamp: 1 }, factory)
      await addWord({ word: 'b', translation: '香蕉', timestamp: 2 }, factory)
      await addWord({ word: 'c', translation: '青苹果', timestamp: 3 }, factory)
      const res = await searchWords('苹果', {}, factory)
      expect(res.map((e) => e.word).sort()).toEqual(['a', 'c'])
    })

    it('大小写不敏感', async () => {
      await addWord({ word: 'Hello', translation: 'x', timestamp: 1 }, factory)
      const res = await searchWords('hello', {}, factory)
      expect(res.length).toBe(1)
    })

    it('空 query 返回空数组', async () => {
      await addWord({ word: 'x', translation: 'X' }, factory)
      const res = await searchWords('', {}, factory)
      expect(res).toEqual([])
    })

    it('limit 生效', async () => {
      for (let i = 0; i < 5; i++) {
        await addWord({ word: `match${i}`, translation: 't', timestamp: i }, factory)
      }
      const res = await searchWords('match', { limit: 2 }, factory)
      expect(res.length).toBe(2)
    })
  })

  describe('countWords / clearWordbook', () => {
    it('空 store 返回 0', async () => {
      expect(await countWords(factory)).toBe(0)
    })
    it('count 反映实际大小', async () => {
      await addWord({ word: 'a', translation: 'A' }, factory)
      await addWord({ word: 'b', translation: 'B' }, factory)
      expect(await countWords(factory)).toBe(2)
    })
    it('clear 清空', async () => {
      await addWord({ word: 'a', translation: 'A' }, factory)
      await clearWordbook(factory)
      expect(await countWords(factory)).toBe(0)
    })
  })

  describe('WordEntry 类型兼容性', () => {
    it('entry 包含必要字段', async () => {
      const e: WordEntry = await addWord(
        { word: 'test', translation: '测试', phonetic: 'tɛst', definitions: ['n. 测试'] },
        factory,
      )
      expect(e.phonetic).toBe('tɛst')
      expect(e.definitions).toEqual(['n. 测试'])
    })
  })
})
