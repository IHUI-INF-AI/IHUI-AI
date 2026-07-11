/**
 * 设备工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 3 个设备相关文件：
 * - deviceService / deviceSyncManager / multiDeviceService
 *
 * 新架构基于纯 TypeScript + Web API，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* 设备信息（deviceService）                                           */
/* ------------------------------------------------------------------ */

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'tv' | 'unknown'
export type OS = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'harmonyos' | 'unknown'
export type Browser =
  'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'wechat' | 'qq' | 'unknown'

export interface DeviceInfo {
  id: string
  type: DeviceType
  os: OS
  osVersion: string
  browser: Browser
  browserVersion: string
  userAgent: string
  screenSize: { width: number; height: number }
  viewport: { width: number; height: number }
  pixelRatio: number
  language: string
  online: boolean
  cookieEnabled: boolean
  touchSupported: boolean
}

export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      id: 'ssr',
      type: 'unknown',
      os: 'unknown',
      osVersion: '',
      browser: 'unknown',
      browserVersion: '',
      userAgent: '',
      screenSize: { width: 0, height: 0 },
      viewport: { width: 0, height: 0 },
      pixelRatio: 1,
      language: 'zh-CN',
      online: true,
      cookieEnabled: false,
      touchSupported: false,
    }
  }
  const ua = navigator.userAgent
  return {
    id: generateDeviceId(),
    type: detectDeviceType(ua),
    os: detectOS(ua),
    osVersion: detectOSVersion(ua),
    browser: detectBrowser(ua),
    browserVersion: detectBrowserVersion(ua),
    userAgent: ua,
    screenSize: {
      width: window.screen.width,
      height: window.screen.height,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    pixelRatio: window.devicePixelRatio || 1,
    language: navigator.language,
    online: navigator.onLine,
    cookieEnabled: navigator.cookieEnabled,
    touchSupported: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  }
}

function detectDeviceType(ua: string): DeviceType {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile'
  if (/TV|SmartTV/i.test(ua)) return 'tv'
  return 'desktop'
}

function detectOS(ua: string): OS {
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/HarmonyOS/i.test(ua)) return 'harmonyos'
  if (/Linux/i.test(ua)) return 'linux'
  return 'unknown'
}

function detectOSVersion(ua: string): string {
  const match =
    ua.match(/Windows NT ([\d.]+)/) ??
    ua.match(/Mac OS X ([\d_]+)/) ??
    ua.match(/Android ([\d.]+)/) ??
    ua.match(/OS ([\d_]+)/)
  return match && match[1] ? match[1].replace(/_/g, '.') : ''
}

function detectBrowser(ua: string): Browser {
  if (/MicroMessenger/i.test(ua)) return 'wechat'
  if (/QQ\//i.test(ua)) return 'qq'
  if (/Edg\//i.test(ua)) return 'edge'
  if (/OPR\//i.test(ua)) return 'opera'
  if (/Chrome\//i.test(ua)) return 'chrome'
  if (/Firefox\//i.test(ua)) return 'firefox'
  if (/Safari\//i.test(ua)) return 'safari'
  return 'unknown'
}

function detectBrowserVersion(ua: string): string {
  const match =
    ua.match(/Chrome\/([\d.]+)/) ??
    ua.match(/Firefox\/([\d.]+)/) ??
    ua.match(/Safari\/([\d.]+)/) ??
    ua.match(/Edg\/([\d.]+)/)
  return match && match[1] ? match[1] : ''
}

const DEVICE_ID_KEY = 'ihui:device_id'
function generateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return `dev_${Date.now()}`
  }
}

/* ------------------------------------------------------------------ */
/* 设备同步管理（deviceSyncManager）                                   */
/* ------------------------------------------------------------------ */

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed'

export interface SyncState {
  status: SyncStatus
  lastSyncAt: number | null
  lastError: string | null
  pendingChanges: number
}

export interface SyncableData {
  key: string
  value: unknown
  updatedAt: number
  deviceId: string
}

const syncState: SyncState = {
  status: 'idle',
  lastSyncAt: null,
  lastError: null,
  pendingChanges: 0,
}

const pendingQueue: SyncableData[] = []
const listeners = new Set<(s: SyncState) => void>()

export function getSyncState(): SyncState {
  return { ...syncState }
}

export function subscribeSyncState(listener: (s: SyncState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifySyncState(): void {
  for (const l of listeners) l({ ...syncState })
}

export function enqueueChange(data: SyncableData): void {
  pendingQueue.push(data)
  syncState.pendingChanges = pendingQueue.length
  notifySyncState()
}

export async function flushChanges(endpoint: string): Promise<SyncState> {
  if (pendingQueue.length === 0) return getSyncState()
  syncState.status = 'syncing'
  notifySyncState()
  try {
    const r = await fetchApi<{ synced: number }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ changes: pendingQueue }),
    })
    if (!r.success) throw new Error(r.error)
    pendingQueue.length = 0
    syncState.pendingChanges = 0
    syncState.status = 'success'
    syncState.lastSyncAt = Date.now()
    syncState.lastError = null
  } catch (err) {
    syncState.status = 'failed'
    syncState.lastError = err instanceof Error ? err.message : String(err)
  }
  notifySyncState()
  return getSyncState()
}

/* ------------------------------------------------------------------ */
/* 多设备管理（multiDeviceService）                                    */
/* ------------------------------------------------------------------ */

export interface DeviceSession {
  id: string
  deviceId: string
  deviceName: string
  deviceType: DeviceType
  os: OS
  browser: Browser
  ip: string | null
  location: string | null
  lastActiveAt: string
  loginAt: string
  isCurrent: boolean
  trusted: boolean
}

export async function listDeviceSessions(): Promise<ApiResult<DeviceSession[]>> {
  return fetchApi<DeviceSession[]>('/auth/devices')
}

export async function revokeDeviceSession(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/auth/devices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function revokeAllOtherSessions(): Promise<ApiResult<{ revoked: number }>> {
  return fetchApi<{ revoked: number }>('/auth/devices/revoke-others', {
    method: 'POST',
  })
}

export async function trustDevice(id: string): Promise<ApiResult<{ trusted: boolean }>> {
  return fetchApi<{ trusted: boolean }>(`/auth/devices/${encodeURIComponent(id)}/trust`, {
    method: 'POST',
  })
}

export async function renameDevice(id: string, name: string): Promise<ApiResult<DeviceSession>> {
  return fetchApi<DeviceSession>(`/auth/devices/${encodeURIComponent(id)}/rename`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

/* ------------------------------------------------------------------ */
/* 实用辅助                                                            */
/* ------------------------------------------------------------------ */

export function isMobile(): boolean {
  return detectDevice().type === 'mobile'
}

export function isTablet(): boolean {
  return detectDevice().type === 'tablet'
}

export function isDesktop(): boolean {
  return detectDevice().type === 'desktop'
}

export function isWechatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /MicroMessenger/i.test(navigator.userAgent)
}

export function getDeviceFingerprint(): string {
  const info = detectDevice()
  return [
    info.os,
    info.osVersion,
    info.browser,
    info.browserVersion,
    info.screenSize.width,
    info.screenSize.height,
    info.pixelRatio,
    info.language,
  ].join('|')
}

/** 监听网络状态变化 */
export function onNetworkChange(handler: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const on = () => handler(true)
  const off = () => handler(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  return () => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  }
}

/** 监听视口变化 */
export function onViewportResize(handler: (width: number, height: number) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onResize = () => handler(window.innerWidth, window.innerHeight)
  window.addEventListener('resize', onResize)
  return () => window.removeEventListener('resize', onResize)
}
