// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L07 桥版本握手(web 侧判定核心),2026-11-26。
 *
 * 解决的问题:web bundle 与桌面壳分开发版,旧壳缺新命令时 Tauri 只会 reject 一个
 * 字符串,调用点 `catch(() => {})` 一吞就是「点了没反应」。启动时先交换
 * `protocol_version + methods + method_digest`,不一致就整体禁用桌面入口并在首屏明示。
 *
 * 摘要算法必须与 Rust 侧 `native_bridge.rs` 逐字节一致:
 * FNV-1a 32-bit,输入是**排序后**的方法名,名字之间用一个 `\n` 分隔。
 * 不引入 sha2/crypto 依赖,避免 web/Rust 两侧实现漂移。
 */

import { DESKTOP_COMMANDS, DESKTOP_COMMAND_VALUES, type DesktopCommand } from './desktop-commands'

/** 与 Rust `NATIVE_BRIDGE_PROTOCOL_VERSION` 必须相同;不同即视为旧壳,直接禁用。 */
export const NATIVE_BRIDGE_PROTOCOL_VERSION = 1

export interface NativeBridgeManifest {
  protocol_version: number
  version: string
  methods: string[]
  method_digest: string
}

export type BridgeHandshakeReason =
  'protocol-mismatch' | 'command-mismatch' | 'digest-mismatch' | 'invoke-failed'

export interface BridgeHandshakeResult {
  ok: boolean
  reason?: BridgeHandshakeReason
  nativeVersion?: string
  missing: string[]
  extra: string[]
  detail?: string
}

/** FNV-1a 32-bit;输出 8 位小写十六进制。 */
export function bridgeMethodDigest(methods: readonly string[]): string {
  const sorted = [...methods].sort()
  let hash = 0x811c9dc5
  let first = true
  for (const name of sorted) {
    if (!first) {
      hash ^= 0x0a
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    first = false
    for (let j = 0; j < name.length; j += 1) {
      hash ^= name.charCodeAt(j)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return hash.toString(16).padStart(8, '0')
}

/** 本地期望的清单摘要(注册表值排序后的 FNV)。 */
export const EXPECTED_BRIDGE_DIGEST = bridgeMethodDigest(DESKTOP_COMMAND_VALUES)

/**
 * 纯判定:输入 native 清单,返回是否可用及差异项。
 * 不做 IO,测试可直接构造各种坏清单。
 */
export function verifyNativeBridgeManifest(
  native: NativeBridgeManifest,
  expectedMethods: readonly string[] = DESKTOP_COMMAND_VALUES,
): BridgeHandshakeResult {
  if (native.protocol_version !== NATIVE_BRIDGE_PROTOCOL_VERSION) {
    return {
      ok: false,
      reason: 'protocol-mismatch',
      nativeVersion: native.version,
      missing: [],
      extra: [],
      detail: `native protocol ${native.protocol_version} != web ${NATIVE_BRIDGE_PROTOCOL_VERSION}`,
    }
  }
  const expected = new Set(expectedMethods)
  const actual = new Set(native.methods)
  const missing = [...expected].filter((name) => !actual.has(name)).sort()
  const extra = [...actual].filter((name) => !expected.has(name)).sort()
  if (missing.length > 0 || extra.length > 0) {
    return {
      ok: false,
      reason: 'command-mismatch',
      nativeVersion: native.version,
      missing,
      extra,
      detail: `missing=${missing.join(',') || '-'} extra=${extra.join(',') || '-'}`,
    }
  }
  const nativeDigest = bridgeMethodDigest(native.methods)
  if (
    native.method_digest !== nativeDigest ||
    nativeDigest !== bridgeMethodDigest(expectedMethods)
  ) {
    return {
      ok: false,
      reason: 'digest-mismatch',
      nativeVersion: native.version,
      missing: [],
      extra: [],
      detail: `native=${native.method_digest} computed=${nativeDigest}`,
    }
  }
  return { ok: true, nativeVersion: native.version, missing: [], extra: [] }
}

/** 注入式启动握手:调用方负责把 native 命令名接到 Tauri invoke(便于测试替身)。 */
export async function runNativeBridgeHandshake(
  invokeManifest: (command: DesktopCommand) => Promise<NativeBridgeManifest>,
): Promise<BridgeHandshakeResult> {
  try {
    const manifest = await invokeManifest(DESKTOP_COMMANDS.getNativeBridgeManifest)
    return verifyNativeBridgeManifest(manifest)
  } catch (error) {
    return {
      ok: false,
      reason: 'invoke-failed',
      missing: [],
      extra: [],
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
