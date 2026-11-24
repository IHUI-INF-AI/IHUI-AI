// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 系统密钥环能力探测:三平台映射 + fail-closed 反向用例。
 * 源文件 apps/cli/src/lib/keyring-capability.ts(纯函数,不碰现有 vault)。
 */
import { describe, expect, it } from 'vitest'
import {
  capabilityFromDpapiProbe,
  detectKeyringCapability,
  keyringUnavailableFailure,
  type KeyringBackend,
} from '../src/lib/keyring-capability'

const ALL_BACKENDS: KeyringBackend[] = [
  'windows-credential-manager',
  'macos-keychain',
  'linux-secret-service',
]

const okProbe = () => ({ usable: true, reason: 'probe-ok' })
const badProbe = (reason = 'service-down') => () => ({ usable: false, reason })

describe('detectKeyringCapability - 平台映射一一对应', () => {
  it('win32/darwin/linux 各映射到唯一后端,不串台', () => {
    expect(detectKeyringCapability('win32', okProbe)).toMatchObject({
      availability: 'available',
      backend: 'windows-credential-manager',
      source: 'platform',
    })
    expect(detectKeyringCapability('darwin', okProbe)).toMatchObject({
      availability: 'available',
      backend: 'macos-keychain',
    })
    expect(detectKeyringCapability('linux', okProbe)).toMatchObject({
      availability: 'available',
      backend: 'linux-secret-service',
    })
  })

  it('未知平台 ⇒ unavailable/unknown-platform,backend=null(不猜)', () => {
    for (const p of ['freebsd', 'aix', '', 'WIN32']) {
      const cap = detectKeyringCapability(p, okProbe)
      expect(cap.availability).toBe('unavailable')
      expect(cap.backend).toBeNull()
      expect(cap.reason).toBe('unknown-platform:' + p)
    }
  })
})

describe('detectKeyringCapability - 默认拒绝不冒充', () => {
  it('探针不可用 ⇒ unavailable 且点名原因,不落明文', () => {
    for (const p of ['win32', 'darwin', 'linux']) {
      const cap = detectKeyringCapability(p, badProbe('no-service'))
      expect(cap.availability).toBe('unavailable')
      expect(cap.reason).toBe('no-service')
      expect(JSON.stringify(cap)).not.toMatch(/apiKey|refreshToken|password|credentialValue/i)
    }
  })

  it('无探针 ⇒ unjudged/probe-not-run,绝不当 available', () => {
    const cap = detectKeyringCapability('win32')
    expect(cap.availability).toBe('unjudged')
    expect(cap.reason).toBe('probe-not-run')
  })

  it('探针抛错 ⇒ unavailable 且点名错误,不把异常当可用', () => {
    const cap = detectKeyringCapability('linux', () => {
      throw new Error('spawn-EACCES')
    })
    expect(cap.availability).toBe('unavailable')
    expect(cap.reason).toContain('probe-threw')
    expect(cap.reason).toContain('spawn-EACCES')
  })

  it('envPin 未知值 ⇒ unavailable(拼写错误不判可用)', () => {
    const cap = detectKeyringCapability('win32', okProbe, 'credential-manger')
    expect(cap.availability).toBe('unavailable')
    expect(cap.backend).toBeNull()
    expect(cap.reason).toContain('unknown-backend-pin')
    expect(cap.source).toBe('env-pin')
  })

  it('envPin 合法值 ⇒ 固定后端,不受宿主平台影响(诊断用)', () => {
    const cap = detectKeyringCapability('linux', okProbe, 'macos-keychain')
    expect(cap.availability).toBe('available')
    expect(cap.backend).toBe('macos-keychain')
    expect(cap.source).toBe('env-pin')
  })

  it('探针只收到已登记后端之一,不会收到任意注入值', () => {
    const seen: KeyringBackend[] = []
    for (const p of ['win32', 'darwin', 'linux']) {
      detectKeyringCapability(p, (backend) => {
        seen.push(backend)
        return okProbe()
      })
    }
    expect(seen).toEqual(ALL_BACKENDS)
  })
})

describe('capabilityFromDpapiProbe - 桥接现有探针不改行为', () => {
  it('win32 + ok ⇒ available,reason 透传探针 detail', () => {
    const cap = capabilityFromDpapiProbe('win32', () => ({
      ok: true,
      detail: 'dpapi-roundtrip',
      engine: 'crypt32',
    }))
    expect(cap).toMatchObject({
      availability: 'available',
      backend: 'windows-credential-manager',
      reason: 'dpapi-roundtrip',
    })
  })

  it('非 win32 ⇒ 后端映射按平台走,不冒充 Windows(DPAPI 探针结果不用于其它平台)', () => {
    const cap = capabilityFromDpapiProbe('freebsd', () => ({ ok: true, detail: 'should-not-run' }))
    expect(cap.availability).toBe('unavailable')
    expect(cap.backend).toBeNull()
    expect(cap.reason).toContain('unknown-platform')
  })

  it('探针失败 ⇒ unavailable 且带原因,不冒充可用', () => {
    const cap = capabilityFromDpapiProbe('win32', () => ({
      ok: false,
      detail: 'os-tier-failure',
    }))
    expect(cap.availability).toBe('unavailable')
    expect(cap.reason).toBe('os-tier-failure')
  })
})

describe('keyringUnavailableFailure - 与现有 failure 同形', () => {
  it('输出 code/detail/remediation,明确不回落明文', () => {
    const cap = detectKeyringCapability('freebsd', okProbe)
    const failure = keyringUnavailableFailure(cap)
    expect(failure.code).toBe('keyring-unavailable')
    expect(failure.detail).toContain('unknown-platform')
    expect(failure.remediation).toContain('不会把凭据写成明文')
  })

  it('只含诊断信息,不含任何凭据值', () => {
    const cap = detectKeyringCapability('win32', badProbe('dpapi-denied'))
    const failure = keyringUnavailableFailure(cap)
    expect(JSON.stringify(failure)).not.toMatch(/apiKey|refreshToken|password|token:/i)
  })
})
