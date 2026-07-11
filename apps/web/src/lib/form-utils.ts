/**
 * 表单工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 3 个文件：
 * - formValidation / requestSignature / requestCache
 *
 * 新架构基于纯 TypeScript + Web API，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* 表单校验（formValidation）                                          */
/* ------------------------------------------------------------------ */

export type ValidationRule =
  | { type: 'required'; message?: string }
  | { type: 'min'; value: number; message?: string }
  | { type: 'max'; value: number; message?: string }
  | { type: 'minLength'; value: number; message?: string }
  | { type: 'maxLength'; value: number; message?: string }
  | { type: 'pattern'; value: RegExp; message?: string }
  | { type: 'email'; message?: string }
  | { type: 'phone'; message?: string }
  | { type: 'url'; message?: string }
  | { type: 'number'; message?: string }
  | { type: 'integer'; message?: string }
  | { type: 'custom'; validator: (value: unknown) => boolean; message?: string }

export interface FieldSchema {
  rules: ValidationRule[]
}

export type FormSchema<T extends Record<string, unknown>> = {
  [K in keyof T]?: FieldSchema
}

export interface ValidationResult {
  ok: boolean
  errors: Partial<Record<string, string>>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^1[3-9]\d{9}$/
const URL_RE = /^https?:\/\/[^\s]+$/

export function validateField(value: unknown, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return rule.message ?? '此字段为必填项'
        }
        break
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return rule.message ?? `不能小于 ${rule.value}`
        }
        break
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return rule.message ?? `不能大于 ${rule.value}`
        }
        break
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message ?? `长度不能少于 ${rule.value} 个字符`
        }
        break
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message ?? `长度不能超过 ${rule.value} 个字符`
        }
        break
      case 'pattern':
        if (typeof value === 'string' && !rule.value.test(value)) {
          return rule.message ?? '格式不正确'
        }
        break
      case 'email':
        if (typeof value === 'string' && value && !EMAIL_RE.test(value)) {
          return rule.message ?? '邮箱格式不正确'
        }
        break
      case 'phone':
        if (typeof value === 'string' && value && !PHONE_RE.test(value)) {
          return rule.message ?? '手机号格式不正确'
        }
        break
      case 'url':
        if (typeof value === 'string' && value && !URL_RE.test(value)) {
          return rule.message ?? 'URL 格式不正确'
        }
        break
      case 'number':
        if (value !== '' && value !== null && value !== undefined && typeof value !== 'number') {
          return rule.message ?? '必须是数字'
        }
        break
      case 'integer':
        if (typeof value === 'number' && !Number.isInteger(value)) {
          return rule.message ?? '必须是整数'
        }
        break
      case 'custom':
        if (!rule.validator(value)) {
          return rule.message ?? '校验未通过'
        }
        break
    }
  }
  return null
}

export function validateForm<T extends Record<string, unknown>>(
  values: T,
  schema: FormSchema<T>,
): ValidationResult {
  const errors: Partial<Record<string, string>> = {}
  for (const key in schema) {
    const fieldSchema = schema[key]
    if (!fieldSchema) continue
    const err = validateField(values[key], fieldSchema.rules)
    if (err) errors[key] = err
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

/* ------------------------------------------------------------------ */
/* 请求签名（requestSignature）                                        */
/* ------------------------------------------------------------------ */

/** 生成 HMAC-SHA256 签名（基于 Web Crypto API） */
export async function signRequest(
  payload: Record<string, unknown>,
  secret: string,
  timestamp: number = Date.now(),
): Promise<{ signature: string; timestamp: number; nonce: string }> {
  const nonce = generateNonce()
  const canonical = buildCanonicalString(payload, timestamp, nonce)
  const key = await importCryptoKey(secret)
  const data = new TextEncoder().encode(canonical)
  const sig = await crypto.subtle.sign('HMAC', key, data)
  return {
    signature: bufferToHex(sig),
    timestamp,
    nonce,
  }
}

export async function verifyRequestSignature(
  payload: Record<string, unknown>,
  secret: string,
  signature: string,
  timestamp: number,
  nonce: string,
): Promise<boolean> {
  const expected = await signRequest(payload, secret, timestamp)
  // 校验 nonce 一致
  if (expected.nonce !== nonce) return false
  return timingSafeEqual(expected.signature, signature)
}

function buildCanonicalString(
  payload: Record<string, unknown>,
  timestamp: number,
  nonce: string,
): string {
  const keys = Object.keys(payload).sort()
  const parts = keys.map((k) => `${k}=${stringify(payload[k])}`)
  return `${timestamp}.${nonce}.${parts.join('&')}`
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function generateNonce(length = 16): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function importCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret)
  return crypto.subtle.importKey('raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/* ------------------------------------------------------------------ */
/* 请求缓存（requestCache）                                            */
/* ------------------------------------------------------------------ */

export interface CacheEntry<T = unknown> {
  key: string
  value: T
  expiresAt: number
  createdAt: number
  hitCount: number
}

const cacheStore = new Map<string, CacheEntry>()

const MAX_CACHE_SIZE = 100

export function setCache<T>(key: string, value: T, ttlMs: number): CacheEntry<T> {
  if (cacheStore.size >= MAX_CACHE_SIZE) {
    const firstKey = cacheStore.keys().next().value
    if (firstKey) cacheStore.delete(firstKey)
  }
  const entry: CacheEntry<T> = {
    key,
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
    hitCount: 0,
  }
  cacheStore.set(key, entry as CacheEntry)
  return entry
}

export function getCache<T>(key: string): T | undefined {
  const entry = cacheStore.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key)
    return undefined
  }
  entry.hitCount += 1
  return entry.value as T
}

export function hasCache(key: string): boolean {
  return getCache(key) !== undefined
}

export function deleteCache(key: string): boolean {
  return cacheStore.delete(key)
}

export function clearCache(): void {
  cacheStore.clear()
}

export function getCacheStats(): {
  size: number
  keys: string[]
  totalHits: number
} {
  let totalHits = 0
  for (const e of cacheStore.values()) totalHits += e.hitCount
  return {
    size: cacheStore.size,
    keys: Array.from(cacheStore.keys()),
    totalHits,
  }
}

/** 带缓存的 fetch 封装 */
export async function cachedFetch<T>(
  key: string,
  url: string,
  options?: RequestInit & { ttlMs?: number },
): Promise<ApiResult<T>> {
  const ttl = options?.ttlMs ?? 60_000
  const cached = getCache<T>(key)
  if (cached !== undefined) {
    return { success: true, data: cached }
  }
  const r = await fetchApi<T>(url, options)
  if (r.success) setCache(key, r.data, ttl)
  return r
}

/** SWR 风格：先返回缓存，后台刷新 */
export async function swrFetch<T>(
  key: string,
  url: string,
  options?: RequestInit & { ttlMs?: number; onRefresh?: (data: T) => void },
): Promise<ApiResult<T>> {
  const ttl = options?.ttlMs ?? 60_000
  const cached = getCache<T>(key)
  // 后台刷新
  void fetchApi<T>(url, options).then((r) => {
    if (r.success) {
      setCache(key, r.data, ttl)
      options?.onRefresh?.(r.data)
    }
  })
  if (cached !== undefined) {
    return { success: true, data: cached }
  }
  // 无缓存则等待后台请求
  const r = await fetchApi<T>(url, options)
  if (r.success) setCache(key, r.data, ttl)
  return r
}

/** 生成缓存键（基于 URL + body） */
export function buildCacheKey(url: string, body?: BodyInit | null): string {
  if (!body) return url
  if (typeof body === 'string') return `${url}:${body}`
  return url
}
