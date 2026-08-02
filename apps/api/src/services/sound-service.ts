/**
 * 音效服务。
 *
 * 管理音效资源库：分类、搜索、播放 URL 生成、使用统计。
 * 旧架构为前端服务，新架构迁移为服务端管理 + 前端播放。
 *
 * 能力：
 * - 音效库 CRUD（内存 + 元数据，实际文件由 storage-service 管理）
 * - 按分类/标签/情绪检索
 * - 播放 URL 签名（HMAC-SHA256 防盗链，可选 TTL）
 * - 使用统计：播放次数、最近播放
 *
 * 设计：纯内存存储，重启后丢失元数据。如需持久化可由调用方
 * 通过 exportLibrary/importLibrary 序列化到 DB 或文件。
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from 'node:process'
import { generateCompactId } from '../utils/crypto-random.js'

export type SoundCategory =
  | 'ui' // 界面音效（点击/悬停/成功/错误）
  | 'notification' // 通知音效
  | 'game' // 游戏音效
  | 'ambient' // 环境音
  | 'voice' // 语音
  | 'music' // 背景音乐
  | 'sfx' // 特效音

export type SoundMood = 'neutral' | 'positive' | 'negative' | 'exciting' | 'calm' | 'tense'

export interface SoundAsset {
  id: string
  name: string
  category: SoundCategory
  mood: SoundMood
  url: string
  durationMs: number
  format: 'mp3' | 'wav' | 'ogg' | 'm4a'
  fileSizeBytes: number
  tags: string[]
  playCount: number
  lastPlayedAt: Date | null
  createdAt: Date
}

export interface SoundSearchQuery {
  keyword?: string
  category?: SoundCategory
  mood?: SoundMood
  tags?: string[]
  maxDurationMs?: number
}

const library = new Map<string, SoundAsset>()
const MAX_RESULTS = 100

/** 生成简单 ID。 */
// 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成音效 ID
// 风险:可预测音效 ID → 攻击者枚举其他用户上传的私有音效 → 越权访问
function genId(): string {
  return generateCompactId('snd')
}

/** 危险键:可能通过 [[Set]] 触发原型链污染(Object.prototype.__proto__ setter / constructor 重写) */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * 过滤 patch 中的原型链污染键(2026-08-02 安全修复:防 __proto__/constructor/prototype 注入)。
 *
 * 不用 `{ ...patch }` + `delete`:spread 在 patch 含 `__proto__` 作为 own property 时
 * 会触发 Object.prototype.__proto__ setter,污染中间对象 [[Prototype]];
 * 改用 Object.keys 显式白名单复制,只写非危险键,中间对象 [[Prototype]] 始终是 Object.prototype。
 */
function sanitizePatch<T extends Record<string, unknown>>(patch: T): T {
  const cleaned: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    if (DANGEROUS_KEYS.has(key)) continue
    cleaned[key] = patch[key]
  }
  return cleaned as T
}

/** 添加音效到库。 */
export function addSound(
  input: Omit<SoundAsset, 'id' | 'playCount' | 'lastPlayedAt' | 'createdAt'>,
): SoundAsset {
  const asset: SoundAsset = {
    ...input,
    id: genId(),
    playCount: 0,
    lastPlayedAt: null,
    createdAt: new Date(),
  }
  library.set(asset.id, asset)
  return asset
}

/** 获取音效详情。 */
export function getSound(id: string): SoundAsset | undefined {
  return library.get(id)
}

/** 更新音效元数据。 */
export function updateSound(
  id: string,
  updates: Partial<Pick<SoundAsset, 'name' | 'category' | 'mood' | 'tags' | 'url'>>,
): boolean {
  const asset = library.get(id)
  if (!asset) return false
  const safeUpdates = sanitizePatch(updates as Record<string, unknown>)
  Object.assign(asset, safeUpdates)
  return true
}

/** 删除音效。 */
export function removeSound(id: string): boolean {
  return library.delete(id)
}

/** 搜索音效。 */
export function searchSounds(query: SoundSearchQuery): SoundAsset[] {
  let results = Array.from(library.values())

  if (query.category) results = results.filter((s) => s.category === query.category)
  if (query.mood) results = results.filter((s) => s.mood === query.mood)
  if (query.maxDurationMs) results = results.filter((s) => s.durationMs <= query.maxDurationMs!)
  if (query.tags && query.tags.length > 0) {
    results = results.filter((s) => query.tags!.some((t) => s.tags.includes(t)))
  }
  if (query.keyword) {
    const kw = query.keyword.toLowerCase()
    results = results.filter(
      (s) => s.name.toLowerCase().includes(kw) || s.tags.some((t) => t.toLowerCase().includes(kw)),
    )
  }

  return results.slice(0, MAX_RESULTS)
}

/** 按分类列出音效。 */
export function listByCategory(category: SoundCategory): SoundAsset[] {
  return Array.from(library.values()).filter((s) => s.category === category)
}

/** 记录一次播放（更新统计）。 */
export function recordPlay(id: string): boolean {
  const asset = library.get(id)
  if (!asset) return false
  asset.playCount++
  asset.lastPlayedAt = new Date()
  return true
}

/** 获取热门音效（按播放次数排序）。 */
export function getPopularSounds(limit = 20): SoundAsset[] {
  return Array.from(library.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit)
}

/** 读取签名密钥。配置 SOUND_SIGN_SECRET 时返回该值；未配置时返回 null。 */
function getSignSecret(): string | null {
  const secret = env.SOUND_SIGN_SECRET
  return secret && secret.length > 0 ? secret : null
}

/**
 * 生成 HMAC-SHA256 签名。
 * 2026-08-02 P0 安全修复:fail-closed,未配置 secret 时抛错,而非降级到明文拼接。
 */
function signPayload(soundId: string, expiresAt: number): string {
  const secret = getSignSecret()
  if (!secret) {
    // fail-closed:未配置 secret 时拒绝签发,防止明文降级被伪造
    throw new Error('SOUND_SIGN_SECRET not configured')
  }
  return createHmac('sha256', secret).update(`${soundId}.${expiresAt}`).digest('hex')
}

/**
 * 生成带 TTL 签名的播放 URL（防盗链）。
 * 2026-08-02 P0 安全修复:signPayload fail-closed 后,url 在 secret 未配置时返回 null。
 * 调用方需检查 url 是否为 null,并返回 503 或明确错误。
 */
export function signPlayUrl(
  sound: SoundAsset,
  ttlSec = 3600,
): {
  url: string | null
  expiresAt: number
  error?: string
} {
  const expiresAt = Date.now() + ttlSec * 1000
  try {
    const signature = signPayload(sound.id, expiresAt)
    const separator = sound.url.includes('?') ? '&' : '?'
    return {
      url: `${sound.url}${separator}sig=${signature}&expires=${expiresAt}`,
      expiresAt,
    }
  } catch {
    return {
      url: null,
      expiresAt,
      error: 'SOUND_SIGN_SECRET not configured',
    }
  }
}

/** 校验播放 URL 签名。返回 true 表示签名有效且未过期。 */
export function verifyPlayUrl(soundId: string, expiresAt: number, signature: string): boolean {
  if (Date.now() > expiresAt) return false
  // fail-closed:secret 未配置时 signPayload 抛错 → 拒绝所有请求
  let expected: string
  try {
    expected = signPayload(soundId, expiresAt)
  } catch {
    return false
  }
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

/** 导出音效库（用于持久化）。 */
export function exportLibrary(): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), sounds: Array.from(library.values()) },
    null,
    2,
  )
}

/** 导入音效库（合并模式）。 */
export function importLibrary(
  json: string,
  overwrite = false,
): { imported: number; skipped: number } {
  const parsed = JSON.parse(json) as { sounds: SoundAsset[] }
  let imported = 0
  let skipped = 0
  for (const sound of parsed.sounds) {
    if (library.has(sound.id) && !overwrite) {
      skipped++
      continue
    }
    library.set(sound.id, sound)
    imported++
  }
  return { imported, skipped }
}

/** 获取库统计。 */
export function getLibraryStats(): {
  total: number
  byCategory: Record<string, number>
  totalDurationMs: number
  totalSizeBytes: number
  totalPlays: number
} {
  const sounds = Array.from(library.values())
  const byCategory: Record<string, number> = {}
  let totalDurationMs = 0
  let totalSizeBytes = 0
  let totalPlays = 0

  for (const s of sounds) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + 1
    totalDurationMs += s.durationMs
    totalSizeBytes += s.fileSizeBytes
    totalPlays += s.playCount
  }

  return { total: sounds.length, byCategory, totalDurationMs, totalSizeBytes, totalPlays }
}
