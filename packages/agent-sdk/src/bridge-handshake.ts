// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * L07 桥版本握手(2026-11-26)。
 *
 * 第二层坑:web/RN/小程序 bundle 各自写死它要调的原生方法名,而桌面 native 侧
 * 的方法表随版本增减。某端升级、另一端没跟上时,症状不是报错而是**首屏某个入口
 * 点了没反应**——bundle 调了一个 native 已经没有的方法,没有任何人拦。对标豆包
 * 2 个 audio API 在 848 项注册表里不存在即是实例。
 *
 * 本模块把"握手"变成可测的纯逻辑:
 *  - `createBridgeHello`:native 侧把 version + 方法表封成带稳定摘要的 HELLO;
 *  - `negotiateBridge`:bundle 声明自己要调的方法,和 native HELLO 比对,
 *    缺方法 ⇒ 按入口映射禁用对应入口并给出 UI 明示文案;
 *  - `createFailClosedGate`:首屏握手未完成时,所有桥入口默认禁用。
 *
 * 摘要用 FNV-1a 32,只做"漂移检测",**不是安全签名**(对端可控,不用于鉴权)。
 * 真正的通道 ACL 归 L12 通道域隔离,本模块不重复。
 *
 * 边界(诚实):本模块只做协议与判定;native 侧真实交换 HELLO 的 Rust 代码、
 * 首屏 UI 消费 gate 的 React 代码属宿主接线,本票不假装已接。
 */

export const BRIDGE_PROTOCOL_VERSION = '1'
export const BRIDGE_METHOD_PATTERN = /^[a-z][a-z0-9]*(?:[/.][a-z0-9]+)*$/

export interface NativeBridgeManifest {
  /** native 侧方法表版本;非空,建议 semver。 */
  readonly version: string
  /** native 暴露的方法名全集。 */
  readonly methods: readonly string[]
}

export interface BridgeHello extends NativeBridgeManifest {
  /** 方法表稳定摘要,用于快速漂移检测。 */
  readonly methodDigest: string
  /** 握手协议版本,跨端必须相等。 */
  readonly protocol: string
}

export type BridgeHandshakeErrorCode =
  | 'invalid-manifest'
  | 'protocol-mismatch'
  | 'version-mismatch'
  | 'digest-mismatch'
  | 'missing-methods'

export class BridgeHandshakeError extends Error {
  readonly code: BridgeHandshakeErrorCode
  constructor(code: BridgeHandshakeErrorCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'BridgeHandshakeError'
    this.code = code
  }
}

/** 稳定摘要:排序去重后逐字符 FNV-1a 32,跨 web/RN/miniapp 结果一致。 */
export function computeMethodDigest(methods: readonly string[]): string {
  const normalized = [...new Set(methods)].sort().join('\n')
  let hash = 0x811c9dc5 >>> 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** native 侧封包。非法 manifest fail-closed,不产出可用于握手的 HELLO。 */
export function createBridgeHello(manifest: NativeBridgeManifest): BridgeHello {
  if (!manifest || typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new BridgeHandshakeError('invalid-manifest', 'version 缺失或为空')
  }
  if (!Array.isArray(manifest.methods) || manifest.methods.length === 0) {
    throw new BridgeHandshakeError('invalid-manifest', 'methods 必须是非空数组')
  }
  for (const name of manifest.methods) {
    if (typeof name !== 'string' || !BRIDGE_METHOD_PATTERN.test(name)) {
      throw new BridgeHandshakeError('invalid-manifest', `非法方法名: ${JSON.stringify(name)}`)
    }
  }
  return Object.freeze({
    version: manifest.version.trim(),
    methods: [...manifest.methods],
    methodDigest: computeMethodDigest(manifest.methods),
    protocol: BRIDGE_PROTOCOL_VERSION,
  })
}

/** UI 入口 → 它依赖的桥方法。缺任一方法该入口即禁用。 */
export interface BridgeEntrypointSpec {
  readonly id: string
  readonly requiredMethods: readonly string[]
}

export interface BridgeNegotiationResult {
  readonly compatible: boolean
  readonly code: BridgeHandshakeErrorCode | 'ok'
  /** bundle 要调但 native 没有的方法。 */
  readonly missingMethods: readonly string[]
  /** 因缺方法被禁用的入口 id。 */
  readonly disabledEntrypoints: readonly string[]
  /** 给 UI 明示的文案;兼容时为 null。 */
  readonly notice: string | null
}

/**
 * bundle 侧握手。guestMethods 是该端 bundle 实际要调的方法名。
 * 不传 guestDigest —— 让摘要始终由方法表现算,避免两边摘要算法分叉后仍判 ok。
 */
export function negotiateBridge(
  hostHello: BridgeHello,
  guestMethods: readonly string[],
  entrypoints: readonly BridgeEntrypointSpec[],
): BridgeNegotiationResult {
  if (hostHello.protocol !== BRIDGE_PROTOCOL_VERSION) {
    return {
      compatible: false,
      code: 'protocol-mismatch',
      missingMethods: [],
      disabledEntrypoints: entrypoints.map((e) => e.id),
      notice: `桥协议版本不匹配(期望 ${BRIDGE_PROTOCOL_VERSION},收到 ${hostHello.protocol})`,
    }
  }
  if (computeMethodDigest(hostHello.methods) !== hostHello.methodDigest) {
    return {
      compatible: false,
      code: 'digest-mismatch',
      missingMethods: [],
      disabledEntrypoints: entrypoints.map((e) => e.id),
      notice: '桥方法表摘要与声明不符,已禁用全部桥入口',
    }
  }
  const available = new Set(hostHello.methods)
  const missing = [...new Set(guestMethods.filter((m) => !available.has(m)))].sort()
  if (missing.length > 0) {
    const missingSet = new Set(missing)
    const disabled = entrypoints
      .filter((e) => e.requiredMethods.some((m) => missingSet.has(m)))
      .map((e) => e.id)
    return {
      compatible: false,
      code: 'missing-methods',
      missingMethods: missing,
      disabledEntrypoints: disabled,
      notice: `当前客户端与桌面端版本不匹配,已禁用入口: ${disabled.join('、') || '(无映射入口)'}`,
    }
  }
  if (hostHello.version.trim() === '') {
    return {
      compatible: false,
      code: 'version-mismatch',
      missingMethods: [],
      disabledEntrypoints: entrypoints.map((e) => e.id),
      notice: '桥版本缺失,已禁用全部桥入口',
    }
  }
  return {
    compatible: true,
    code: 'ok',
    missingMethods: [],
    disabledEntrypoints: [],
    notice: null,
  }
}

/** 首屏握手未完成时的 fail-closed 门:所有入口禁用,UI 明示原因。 */
export function createFailClosedGate(
  entrypoints: readonly BridgeEntrypointSpec[],
  reason = '桥握手未完成',
): BridgeNegotiationResult {
  return {
    compatible: false,
    code: 'version-mismatch',
    missingMethods: [],
    disabledEntrypoints: entrypoints.map((e) => e.id),
    notice: `${reason},桥入口暂不可用`,
  }
}

/** 静态校验:bundle 源码文本里对桥方法的调用名,是否都在允许表里。 */
export function scanBridgeCalls(
  source: string,
  callPattern: RegExp,
  allowedMethods: readonly string[],
): readonly string[] {
  const allowed = new Set(allowedMethods)
  const found = new Set<string>()
  for (const match of source.matchAll(callPattern)) {
    const name = match[1]
    if (name && BRIDGE_METHOD_PATTERN.test(name) && !allowed.has(name)) found.add(name)
  }
  return [...found].sort()
}
