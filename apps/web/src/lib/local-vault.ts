// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端本地数据保险库 —— D48 本地会话数据主权与加密(G-56)
 *
 * 平台特有:依赖 Tauri plugin-store(window.__TAURI_INTERNALS__)+ 浏览器 WebCrypto,
 * 不适合放共享层(§3)。
 *
 * ## 为什么是 web 层加密而不是 Rust 侧 stronghold(2026-09-24 定档)
 * 明文落在 **WebView 的 localStorage**(会话正文)与 **plugin-store 文本文件**(refresh token),
 * 两者都由 web 层写出。Rust 侧加密存储动不了 localStorage,只能多存一把密钥 ——
 * 那正是本模块用「已有的 tauri-plugin-store 通道」就能拿到的东西。
 * 故:零新增 cargo crate、零新增 npm 依赖、零改动 Rust 侧。
 *
 * ## 三道硬约束
 * 1. **不承认落盘就不加密**:`bootstrapMaster` 生成密钥后必须**回读比对一致**才返回;
 *    通道读失败(error ≠ 键不存在)时**绝不生成/覆盖**密钥 —— 那会把上一次会话写出的
 *    密文永久孤儿化。宁可这一轮写明文(等价改造前行为),也不制造解不开的密文。
 * 2. **降级不崩**:全部出口返回 null / 空态,不抛错(§首页渲染路径不得被打断)。
 * 3. **密钥不入仓、不入日志、不入报告**(§5d):本模块任何函数都不打印密钥材料,
 *    对外只暴露 `kid`(SHA-256(主密钥) 前 8 字节,公开指纹,不是密钥)。
 *
 * ## 信封格式(单一事实源,chat 正文与 refresh token 共用)
 * `{"ihuiVaultV1":{"alg":"A256GCM","kid":"<16hex>","iv":"<b64url>","ct":"<b64url>"}}`
 * 判据刻意做成**结构级**而非"存在即算":对象有且仅有 `ihuiVaultV1` 一个键,
 * 其值有且仅有 alg/kid/iv/ct 四个字符串字段。这使得"是否被包裹了一层"可判定,
 * 从而支撑调用方的**幂等迁移**(恰一份、非双重包裹)。
 */

/** 保险库文件(app_data_dir 下,与 auth.json / window-state.json 同级,Windows 下按用户 ACL 隔离) */
export const VAULT_STORE_FILE = 'ihui-vault.json'
const MASTER_KEY_FIELD = 'master_key'
const MASTER_KEY_BYTES = 32
const IV_BYTES = 12
const KID_BYTES = 8
const ENVELOPE_FIELD = 'ihuiVaultV1'
const ENVELOPE_FIELDS = ['alg', 'kid', 'iv', 'ct'] as const
/** Object.keys().sort() 的比对基准 —— 必须是排好序的同一份名单 */
const ENVELOPE_FIELDS_SORTED: readonly string[] = [...ENVELOPE_FIELDS].sort()
const ALG = 'A256GCM' as const

/** 派生域:两处密文各用一把互不通用的子密钥(HKDF info 隔离) */
export type VaultDomain = 'chat-persist' | 'refresh-token'

const DOMAIN_INFO: Record<VaultDomain, string> = {
  'chat-persist': 'ihui/desktop/vault/chat-persist/v1',
  'refresh-token': 'ihui/desktop/vault/refresh-token/v1',
}

/** Tauri v2 运行时探测(原 desktop-token-vault 的定义,移到这里做单一事实源) */
export function isDesktopEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ==================== 条目通道(可注入,生产为 Tauri store) ====================

/** 读结果三态:必须区分「通道不可用」与「通道可用且该键不存在」——见文件头约束 1 */
export type VaultEntryRead = { status: 'ok'; value: string | null } | { status: 'error' }

export interface VaultEntryChannel {
  read(fileName: string, key: string): Promise<VaultEntryRead>
  write(fileName: string, key: string, value: string | null): Promise<boolean>
}

interface TauriStoreFile {
  get: <T>(k: string) => Promise<T | undefined>
  set: (k: string, v: unknown) => Promise<void>
  delete: (k: string) => Promise<boolean>
  save: () => Promise<void>
}

/** 懒加载 plugin-store(动态 import,避免浏览器 bundle 引入 Tauri 依赖) */
async function openTauriStore(fileName: string): Promise<TauriStoreFile | null> {
  if (!isDesktopEnv()) return null
  try {
    const { load } = await import('@tauri-apps/plugin-store')
    // autoSave:false —— 显式 save(),避免并发写时中间态落盘
    return await load(fileName, { autoSave: false })
  } catch {
    return null
  }
}

const tauriStoreChannel: VaultEntryChannel = {
  async read(fileName, key) {
    const store = await openTauriStore(fileName)
    if (!store) return { status: 'error' }
    try {
      const value = await store.get<string>(key)
      if (typeof value === 'string' && value.length > 0) return { status: 'ok', value }
      return { status: 'ok', value: null }
    } catch {
      return { status: 'error' }
    }
  },
  async write(fileName, key, value) {
    const store = await openTauriStore(fileName)
    if (!store) return false
    try {
      if (value === null) {
        await store.delete(key)
      } else {
        await store.set(key, value)
      }
      await store.save()
      return true
    } catch {
      return false
    }
  },
}

/** 生产路径的两个条目读写器(desktop-token-vault 也走这里,不再各自实现一遍) */
export function readVaultEntry(
  fileName: string,
  key: string,
  channel: VaultEntryChannel = tauriStoreChannel,
): Promise<VaultEntryRead> {
  return channel.read(fileName, key)
}

export function writeVaultEntry(
  fileName: string,
  key: string,
  value: string | null,
  channel: VaultEntryChannel = tauriStoreChannel,
): Promise<boolean> {
  return channel.write(fileName, key, value)
}

// ==================== base64url ====================

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(text: string): Uint8Array | null {
  try {
    const padded =
      text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
    const binary = atob(padded)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function hasWebCrypto(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.importKey === 'function'
  )
}

// ==================== 主密钥引导 + 按域派生 ====================

interface MasterKeyRecord {
  /** 公开指纹:SHA-256(主密钥) 前 8 字节。用于判断"密钥文件是否被换过",不是密钥 */
  kid: string
  cryptoKey: CryptoKey
}

interface VaultKeyCache {
  master: Promise<MasterKeyRecord | null> | null
  derived: Map<string, Promise<CryptoKey | null>>
}

/** 按通道对象缓存,测试各传各的通道 ⇒ 天然互不串味,无需手动 reset */
const caches = new WeakMap<VaultEntryChannel, VaultKeyCache>()

function cacheFor(channel: VaultEntryChannel): VaultKeyCache {
  let hit = caches.get(channel)
  if (!hit) {
    hit = { master: null, derived: new Map() }
    caches.set(channel, hit)
  }
  return hit
}

async function buildMaster(raw: Uint8Array): Promise<MasterKeyRecord | null> {
  try {
    const kid = toHex(
      new Uint8Array(await crypto.subtle.digest('SHA-256', raw as BufferSource)).slice(
        0,
        KID_BYTES,
      ),
    )
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      raw as BufferSource,
      { name: 'HKDF' },
      false,
      ['deriveKey'],
    )
    return { kid, cryptoKey }
  } catch {
    return null
  }
}

async function bootstrapMaster(channel: VaultEntryChannel): Promise<MasterKeyRecord | null> {
  if (!hasWebCrypto()) return null

  const existing = await channel.read(VAULT_STORE_FILE, MASTER_KEY_FIELD)
  if (existing.status === 'error') return null // 通道不可用:不生成、不覆盖(见文件头约束 1)
  if (existing.value !== null) {
    const raw = decodeBase64Url(existing.value)
    if (!raw || raw.length !== MASTER_KEY_BYTES) return null // 字段损坏:同样不覆盖,交调用方降级
    return buildMaster(raw)
  }

  const fresh = new Uint8Array(MASTER_KEY_BYTES)
  crypto.getRandomValues(fresh)
  const encoded = encodeBase64Url(fresh)
  if (!(await channel.write(VAULT_STORE_FILE, MASTER_KEY_FIELD, encoded))) return null

  // 回读校验:确认这一把**确实落盘**了才承认密钥可用
  const verify = await channel.read(VAULT_STORE_FILE, MASTER_KEY_FIELD)
  if (verify.status !== 'ok' || verify.value !== encoded) return null
  return buildMaster(fresh)
}

function resolveMaster(
  channel: VaultEntryChannel,
  forceRefresh: boolean,
): Promise<MasterKeyRecord | null> {
  const cache = cacheFor(channel)
  if (forceRefresh) cache.master = null
  if (!cache.master) {
    cache.master = bootstrapMaster(channel).then((record) => {
      if (!record) cache.master = null // 失败不缓存:下一次仍会重试(但不会覆盖已落盘的密钥)
      return record
    })
  }
  return cache.master
}

async function deriveDomainKey(
  master: MasterKeyRecord,
  domain: VaultDomain,
): Promise<CryptoKey | null> {
  const info = new TextEncoder().encode(DOMAIN_INFO[domain])
  try {
    return await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: info as BufferSource, info: info as BufferSource },
      master.cryptoKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  } catch {
    return null
  }
}

export interface SealedVaultKey {
  key: CryptoKey
  kid: string
}

async function getVaultKey(
  domain: VaultDomain,
  channel: VaultEntryChannel,
  forceRefresh: boolean,
): Promise<SealedVaultKey | null> {
  const master = await resolveMaster(channel, forceRefresh)
  if (!master) return null
  const cache = cacheFor(channel)
  const cacheKey = `${master.kid}|${domain}`
  let derived = cache.derived.get(cacheKey)
  if (!derived) {
    derived = deriveDomainKey(master, domain)
    cache.derived.set(cacheKey, derived)
  }
  const key = await derived
  return key ? { key, kid: master.kid } : null
}

// ==================== 信封 ====================

export interface VaultEnvelopeBody {
  alg: typeof ALG
  kid: string
  iv: string
  ct: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * 结构级判据:对象**有且仅有** ihuiVaultV1 一个键,其值**有且仅有** alg/kid/iv/ct 四个非空字符串。
 * 只有"存在密文字段"是不够的 —— 迁移幂等性要求能判定"恰一份",否则会把已加密的 blob 再包一层
 * (本仓有幂等守卫只判存在导致冗余冻结的前例)。
 */
export function parseVaultEnvelope(stored: string): VaultEnvelopeBody | null {
  const outer = asRecord(safeJsonParse(stored))
  if (!outer) return null
  const ownKeys = Object.keys(outer)
  if (ownKeys.length !== 1 || ownKeys[0] !== ENVELOPE_FIELD) return null
  const inner = asRecord(outer[ENVELOPE_FIELD])
  if (!inner) return null
  const innerKeys = Object.keys(inner).sort()
  if (innerKeys.length !== ENVELOPE_FIELDS_SORTED.length) return null
  for (let i = 0; i < ENVELOPE_FIELDS_SORTED.length; i++) {
    if (innerKeys[i] !== ENVELOPE_FIELDS_SORTED[i]) return null
  }
  if (inner.alg !== ALG) return null
  if (typeof inner.kid !== 'string' || inner.kid.length === 0) return null
  if (typeof inner.iv !== 'string' || typeof inner.ct !== 'string') return null
  if (!decodeBase64Url(inner.iv) || !decodeBase64Url(inner.ct)) return null
  return { alg: ALG, kid: inner.kid, iv: inner.iv, ct: inner.ct }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** 加密并封成信封文本;返回 null = 密钥不可用(调用方必须退回明文,不得丢数据) */
export async function sealVaultText(
  domain: VaultDomain,
  plaintext: string,
  channel?: VaultEntryChannel,
): Promise<string | null> {
  const sealed = await getVaultKey(domain, channel ?? tauriStoreChannel, false)
  if (!sealed || !hasWebCrypto()) return null
  try {
    const iv = new Uint8Array(IV_BYTES)
    crypto.getRandomValues(iv)
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      sealed.key,
      new TextEncoder().encode(plaintext) as BufferSource,
    )
    return JSON.stringify({
      [ENVELOPE_FIELD]: {
        alg: ALG,
        kid: sealed.kid,
        iv: encodeBase64Url(iv),
        ct: encodeBase64Url(new Uint8Array(ct)),
      },
    })
  } catch {
    return null
  }
}

async function tryDecrypt(key: CryptoKey, body: VaultEnvelopeBody): Promise<string | null> {
  const iv = decodeBase64Url(body.iv)
  const ct = decodeBase64Url(body.ct)
  if (!iv || !ct) return null
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource,
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

/**
 * 解一层。两类失败分得很清:
 * - kid 与当前密钥**相同**却解不开 ⇒ 密文本身损坏/被篡改,换密钥也没用,不再重读盘;
 * - kid **不符** ⇒ 密钥文件被另一窗口刷新过(桌面端 main + admin 双窗口会争这一把),
 *   强制重读一次再试,避免把对方刚写的数据判成垃圾。
 */
async function decryptEnvelopeBody(
  domain: VaultDomain,
  body: VaultEnvelopeBody,
  channel: VaultEntryChannel,
): Promise<string | null> {
  const current = await getVaultKey(domain, channel, false)
  if (current && current.kid === body.kid) return tryDecrypt(current.key, body)
  const reloaded = await getVaultKey(domain, channel, true)
  if (!reloaded || reloaded.kid !== body.kid) return null
  return tryDecrypt(reloaded.key, body)
}

/**
 * 一次解密的最多层数。合法数据只有 0 层(明文存量)或 1 层;
 * 上限只是防御"历史/并发产物被无限套娃"时把这里变成死循环,不是设计意图。
 */
const MAX_UNWRAP_LAYERS = 4

export type VaultOpenResult =
  /** 读到的就是明文(改造前的存量)⇒ 调用方需要一次性迁移 */
  | { kind: 'plain'; text: string }
  /** 读到密文并解出明文;layers = 实际层数,1 = 正常,>1 = 双重包裹需归正 */
  | { kind: 'sealed'; text: string; layers: number }
  /** 密文在,但解不开 ⇒ 调用方降级为可读空态,不得抛错 */
  | { kind: 'unreadable'; kid: string | null }

export async function openVaultText(
  domain: VaultDomain,
  stored: string,
  channel?: VaultEntryChannel,
): Promise<VaultOpenResult> {
  const activeChannel = channel ?? tauriStoreChannel
  let current = stored
  let layers = 0
  for (let guard = 0; guard < MAX_UNWRAP_LAYERS; guard++) {
    const body = parseVaultEnvelope(current)
    if (!body) break
    const text = await decryptEnvelopeBody(domain, body, activeChannel)
    if (text === null) return { kind: 'unreadable', kid: body.kid }
    current = text
    layers += 1
  }
  if (layers === 0) return { kind: 'plain', text: current }
  return { kind: 'sealed', text: current, layers }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
