// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Stub for @ihui/types - vitest mock
// Real package has "main": "./src/index.ts" with `typeof` type syntax that esbuild can't parse.
//
// 但 @ihui/api-client 的 src 里有 **按值**(非 type-only)导入,本替身若只留类型桩就会在
// 调用点炸成 "xxx is not a function"(D147:transport.ts:19 取 withTraceparentHeader /
// readTraceIdFromResponse;client.ts:34 取 GOAL_WIRE_STATUSES)。
// 处置与本仓既有口径一致(vitest.config.ts 对 '@ihui/api-client' 替身的"不删、只转发",
// 以及 '@ihui/types/permission-mode' 直指真源码):**转传真源,不抄第二份实现** ——
// 抄一份就等于给"两处算同一件事必漂移"那一型开门。下面两条是纯转发,桩里自己写的那些
// 名字仍按原样保留(消费面对它们有桩语义依赖)。
export * from '../../../../packages/types/src/traceparent.js'
export * from '../../../../packages/types/src/agent-runtime.js'
// G-815963(2026-10-01):enum-coerce(coerceKnownOr/narrowKnown)同上转传真源。共享
// PaymentScreen 的 resolvePaymentOrderStatus **按值**取 coerceKnownOr,本替身漏转发 ⇒
// payment.test.tsx 9 条用例在 renderItem 内炸 "coerceKnownOr is not a function",
// 订单列表永远渲染不出来(错误/空态用例却绿,极具迷惑性)。同条纪律:不抄第二份实现。
export * from '../../../../packages/types/src/enum-coerce.js'
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
export function createDeviceFingerprintCollector(impl: {
  collect: () => DeviceFingerprintInput | Promise<DeviceFingerprintInput>
}): DeviceFingerprintCollector {
  // 真身会把采集到的输入原样回显在 `source` 上;替身此前把它写死成 `{}`,于是"采集器到底喂了
  // 几个字段"这件事在端内测试面上**不可见** —— 而那正是 v1 退化指纹(只喂 platform)能在
  // RN 端长期存活的形态。这里只回显输入、不模拟摘要(fingerprint 仍是固定值),
  // 所以任何依赖 'mock-fp' 字面量的既有用例逐字不受影响。
  const collect = async (): Promise<DeviceFingerprintInput> => await impl.collect()
  return {
    async get() {
      return { fingerprint: 'mock-fp', source: await collect(), collectedAt: Date.now() }
    },
    async refresh() {
      return { fingerprint: 'mock-fp', source: await collect(), collectedAt: Date.now() }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
