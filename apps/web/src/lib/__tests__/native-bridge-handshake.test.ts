// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** L07 桥握手判定:摘要与 Rust `native_bridge.rs` 同构,坏清单必须整体禁用。 */

import { describe, expect, it } from 'vitest'
import { DESKTOP_COMMAND_VALUES } from '../desktop-commands'
import {
  bridgeMethodDigest,
  NATIVE_BRIDGE_PROTOCOL_VERSION,
  verifyNativeBridgeManifest,
  type NativeBridgeManifest,
} from '../native-bridge-handshake'

function manifest(overrides: Partial<NativeBridgeManifest> = {}): NativeBridgeManifest {
  const methods = [...DESKTOP_COMMAND_VALUES].sort()
  return {
    protocol_version: NATIVE_BRIDGE_PROTOCOL_VERSION,
    version: '0.1.94',
    methods,
    method_digest: bridgeMethodDigest(methods),
    ...overrides,
  }
}

describe('native bridge handshake', () => {
  it('摘要与 Rust 侧常量一致(7547ee14)', () => {
    expect(bridgeMethodDigest(DESKTOP_COMMAND_VALUES)).toBe('7547ee14')
  })

  it('协议/清单/摘要全一致才放行', () => {
    const result = verifyNativeBridgeManifest(manifest())
    expect(result.ok).toBe(true)
    expect(result.nativeVersion).toBe('0.1.94')
  })

  it('协议版本不一致:整体禁用并点名原因', () => {
    const result = verifyNativeBridgeManifest(manifest({ protocol_version: 2 }))
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('protocol-mismatch')
  })

  it('壳缺命令:列出 missing,禁用', () => {
    const methods = [...DESKTOP_COMMAND_VALUES].sort().filter((n) => n !== 'update_v2_restart')
    const result = verifyNativeBridgeManifest(
      manifest({ methods, method_digest: bridgeMethodDigest(methods) }),
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('command-mismatch')
    expect(result.missing).toEqual(['update_v2_restart'])
  })

  it('壳多出未登记命令:列出 extra,禁用', () => {
    const methods = [...DESKTOP_COMMAND_VALUES, 'rogue_command'].sort()
    const result = verifyNativeBridgeManifest(
      manifest({ methods, method_digest: bridgeMethodDigest(methods) }),
    )
    expect(result.ok).toBe(false)
    expect(result.extra).toEqual(['rogue_command'])
  })

  it('清单对但摘要坏:仍禁用(防止壳侧摘要算法漂移)', () => {
    const result = verifyNativeBridgeManifest(manifest({ method_digest: 'deadbeef' }))
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('digest-mismatch')
  })

  it('调用失败(旧壳没有该命令):转成 invoke-failed,不抛到首屏', async () => {
    const { runNativeBridgeHandshake } = await import('../native-bridge-handshake')
    const result = await runNativeBridgeHandshake(async () => {
      throw new Error('command not found')
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invoke-failed')
    expect(result.detail).toContain('command not found')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
