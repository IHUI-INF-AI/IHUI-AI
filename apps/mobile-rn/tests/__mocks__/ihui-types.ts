// Stub for @ihui/types - vitest mock
// Real package has "main": "./src/index.ts" with `typeof` type syntax that esbuild can't parse.
export const API_KEY_PERMISSIONS = {} as const
export const PILLARS = [] as const
export const PILLAR_EVENT_TYPES = [] as const
export type ApiKeyPermission = string
export type Pillar = string
export type PillarEventType = string

// ─── Device fingerprint ───────────────────────────────────────────────────────
export interface DeviceFingerprintInput {
  userAgent?: string
  screen?: { width: number; height: number; colorDepth: number }
  timezone?: string
  language?: string
  platform?: string
  canvas?: string
  webgl?: string
  hardwareConcurrency?: number
  deviceMemory?: number
}
export interface DeviceFingerprintResult {
  fingerprint: string
  source: DeviceFingerprintInput
  collectedAt: number
}
export interface DeviceFingerprintCollector {
  get: () => Promise<DeviceFingerprintResult>
  refresh: () => Promise<DeviceFingerprintResult>
}
export function createDeviceFingerprintCollector(_impl: {
  collect: () => DeviceFingerprintInput | Promise<DeviceFingerprintInput>
}): DeviceFingerprintCollector {
  return {
    async get() {
      return { fingerprint: 'mock-fp', source: {}, collectedAt: Date.now() }
    },
    async refresh() {
      return { fingerprint: 'mock-fp', source: {}, collectedAt: Date.now() }
    },
  }
}
export const nullDeviceFingerprintCollector: DeviceFingerprintCollector = {
  async get() {
    return { fingerprint: '', source: {}, collectedAt: 0 }
  },
  async refresh() {
    return { fingerprint: '', source: {}, collectedAt: 0 }
  },
}
