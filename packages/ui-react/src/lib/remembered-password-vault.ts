// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器端「记住密码」加密保险箱(2026-11-26)
 *
 * 目标:保留用户显式勾选后的免重填体验,但不再把口令明文写进 localStorage。
 *
 * 设计:
 * - AES-GCM 256 加密口令;IV 每次随机;账号作为 additionalData,防止把 A 账号的密文
 *   挪到 B 账号记录下复用。
 * - 密钥由 WebCrypto 生成,`extractable=false`,保存在 IndexedDB。页面脚本可以用它
 *   encrypt/decrypt,但拿不到原始 key bytes;只拷走 localStorage 的密文无法解密。
 * - 密文记录仍在 localStorage(`ihui-remember-password-v2`),便于同步判断"该账号
 *   是否有记住口令";真正的口令只能经上面的非导出密钥解出。
 * - IndexedDB / WebCrypto 不可用时**不落盘**:宁可不记住,也不退回明文。
 * - 历史明文 key(`ihui-remember-password`)在首次读取时就地迁移/删除;迁移失败也
 *   先删除明文,只在本次调用返回一次口令,避免旧明文长期留在磁盘。
 *
 * 说明:这不是服务端密钥托管,也不是 OS 凭据库。它挡的是"只拿到 localStorage /
 * 备份文件"的离线读取;同源 XSS 仍可在页面内调用解密。生产环境还应配合 CSP、
 * HttpOnly refresh token 与最小权限,不能把本地保险箱当成账号安全的唯一防线。
 */

const DB_NAME = 'ihui-credential-vault'
const DB_VERSION = 1
const KEY_STORE = 'keys'
const KEY_ID = 'remember-password-aes-gcm'
const CIPHER_STORAGE_KEY = 'ihui-remember-password-v2'
const LEGACY_PLAINTEXT_KEY = 'ihui-remember-password'

interface CipherRecord {
  v: 2
  account: string
  iv: string
  data: string
}

interface LegacyRecord {
  account?: unknown
  password?: unknown
}

function canUseVault(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof indexedDB !== 'undefined' &&
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined'
  )
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
  })
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly')
    const req = tx.objectStore(KEY_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error ?? new Error('indexedDB get failed'))
  })
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB put failed'))
  })
}

/** 取得(或首次生成)非导出 AES-GCM 密钥。并发标签页同时生成时以先落库者为准。 */
async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await openDb()
  try {
    const existing = await idbGet<CryptoKey>(db, KEY_ID)
    if (existing) return existing
    const candidate = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
    try {
      await idbPut(db, KEY_ID, candidate)
      return candidate
    } catch {
      // 另一个标签页可能已经写入;回读一次,仍没有才抛错。
      const raced = await idbGet<CryptoKey>(db, KEY_ID)
      if (raced) return raced
      throw new Error('credential vault key unavailable')
    }
  } finally {
    db.close()
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 复制到独立 ArrayBuffer,满足 WebCrypto BufferSource 对 ArrayBuffer(非 Shared)的约束。 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function readCipherRecord(): CipherRecord | null {
  try {
    const raw = localStorage.getItem(CIPHER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CipherRecord>
    if (
      parsed &&
      parsed.v === 2 &&
      typeof parsed.account === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.data === 'string'
    ) {
      return parsed as CipherRecord
    }
    return null
  } catch {
    return null
  }
}

function removeCipherRecord(): void {
  try {
    localStorage.removeItem(CIPHER_STORAGE_KEY)
  } catch {
    /* localStorage 不可用时静默失败 */
  }
}

/** 同步判断某账号是否有加密记录(含历史明文记录,挂载后会迁移;不解密)。 */
export function hasRememberedPasswordForAccount(account: string): boolean {
  const normalized = account.trim()
  if (!normalized) return false
  const record = readCipherRecord()
  if (record?.account === normalized && canUseVault()) return true
  // 旧版明文记录:让勾选框先保持勾选,挂载 effect 读取时迁移并删除明文。
  try {
    const legacyRaw = localStorage.getItem(LEGACY_PLAINTEXT_KEY)
    if (!legacyRaw) return false
    const legacy = JSON.parse(legacyRaw) as LegacyRecord
    return (
      typeof legacy.account === 'string' &&
      legacy.account === normalized &&
      typeof legacy.password === 'string' &&
      legacy.password.length > 0
    )
  } catch {
    return false
  }
}

/**
 * 读取并迁移历史明文记录。
 * 无论迁移是否成功,旧明文 key 都会在返回前删除;迁移成功时还会写一条加密记录。
 */
async function consumeLegacyRecord(account: string): Promise<string> {
  let legacy: LegacyRecord | null = null
  try {
    const raw = localStorage.getItem(LEGACY_PLAINTEXT_KEY)
    if (raw) legacy = JSON.parse(raw) as LegacyRecord
  } catch {
    legacy = null
  }
  try {
    localStorage.removeItem(LEGACY_PLAINTEXT_KEY)
  } catch {
    /* ignore */
  }
  if (
    !legacy ||
    typeof legacy.account !== 'string' ||
    typeof legacy.password !== 'string' ||
    legacy.account !== account ||
    !legacy.password
  ) {
    return ''
  }
  // 迁移失败也不回退明文持久化;本次返回口令保证用户当前仍能自动回填。
  await saveRememberedPasswordForAccount(account, legacy.password)
  return legacy.password
}

/** 写入加密口令;失败返回 false(不会退回明文)。 */
export async function saveRememberedPasswordForAccount(
  account: string,
  password: string,
): Promise<boolean> {
  const normalized = account.trim()
  if (!normalized || !password || !canUseVault()) return false
  try {
    const key = await getOrCreateKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(normalized) },
      key,
      new TextEncoder().encode(password),
    )
    const record: CipherRecord = {
      v: 2,
      account: normalized,
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(cipher)),
    }
    localStorage.setItem(CIPHER_STORAGE_KEY, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

/** 读回某账号的加密口令;账号不匹配 / 无记录 / 解密失败一律返回 ''。 */
export async function getRememberedPasswordForAccount(
  account: string,
): Promise<string> {
  const normalized = account.trim()
  if (!normalized) return ''
  const legacy = await consumeLegacyRecord(normalized)
  if (legacy) return legacy

  const record = readCipherRecord()
  if (!record) {
    // 记录存在但解析失败 ⇒ 清掉坏记录,避免每次挂载重复失败。
    removeCipherRecord()
    return ''
  }
  if (record.account !== normalized || !canUseVault()) return ''
  try {
    const key = await getOrCreateKey()
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(base64ToBytes(record.iv)),
        additionalData: toArrayBuffer(new TextEncoder().encode(normalized)),
      },
      key,
      toArrayBuffer(base64ToBytes(record.data)),
    )
    return new TextDecoder().decode(plain)
  } catch {
    // 密钥丢失/密文损坏:清掉坏记录,避免每次挂载都重复失败。
    removeCipherRecord()
    return ''
  }
}

/** 删除加密口令记录;不删除账号历史。 */
export function clearRememberedPassword(): void {
  removeCipherRecord()
  try {
    localStorage.removeItem(LEGACY_PLAINTEXT_KEY)
  } catch {
    /* ignore */
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
