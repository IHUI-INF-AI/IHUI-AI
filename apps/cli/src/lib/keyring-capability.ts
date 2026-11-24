// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨平台系统密钥环能力探测(2026-11-24)。
 *
 * 背景:本机四款竞品把凭据下沉到原生件 —— Qoder keytar(Windows Credential Manager)、
 * ZCode @napi-rs/keyring、Codex/Credential Manager。IHUI 现有的
 * (Windows DPAPI + AES-GCM 信封)与
 * 已可用,本模块**不替换、不重写**它们,只补一层统一的能力探测与默认拒绝语义:
 *  - 探测结果封闭四态,unknown 一律 ,绝不默认 ;
 *  - 探测失败只返回状态与原因,**不返回/不落任何明文**;
 *  - 平台与后端一一对应,未知平台不猜。
 *
 * 这是纯函数 + 可注入环境:用例可直接驱动三个平台与故障分支,不需要真机。
 */
import type { MainCredentialStoreFailure } from './main-credential-store'

export type KeyringBackend =
  | 'windows-credential-manager'
  | 'macos-keychain'
  | 'linux-secret-service'

export type KeyringAvailability = 'available' | 'unavailable' | 'unjudged'

export interface KeyringCapability {
  availability: KeyringAvailability
  backend: KeyringBackend | null
  /** 诊断原因(不含任何用户数据或明文) */
  reason: string
  /** 探测来源:'platform' | 'env-pin' | 'injected' */
  source: string
}

/** 平台 → 原生后端,一一对应;未登记平台返回 null(不猜)。 */
const BACKEND_BY_PLATFORM: Readonly<Record<string, KeyringBackend>> = {
  win32: 'windows-credential-manager',
  darwin: 'macos-keychain',
  linux: 'linux-secret-service',
}

/**
 * 探测系统密钥环能力。默认 fail-closed:
 *  - envPin 只认已知后端名,未知钉选值 → unavailable(不把拼写错误读成可用);
 *  - 未登记平台 → unavailable/unknown-platform;
 *  - probe 注入失败或未返回可用 → unavailable,reason 由调用方点名。
 *
 * @param platform 进程平台(process.platform,测试可注入)
 * @param probe 可选后端探针:返回可用与否 + 原因。不注入 ⇒ 视为未判定。
 * @param envPin 可选钉选(测试/诊断),只接受已知后端名。
 */
export function detectKeyringCapability(
  platform: string,
  probe?: (backend: KeyringBackend) => { usable: boolean; reason: string },
  envPin?: string | null,
): KeyringCapability {
  if (envPin !== undefined && envPin !== null && envPin !== '') {
    const pinned = Object.values(BACKEND_BY_PLATFORM).find((b) => b === envPin)
    if (!pinned) {
      return {
        availability: 'unavailable',
        backend: null,
        reason: `unknown-backend-pin:${envPin}`,
        source: 'env-pin',
      }
    }
    return finishProbe(pinned, probe, 'env-pin')
  }
  const backend = BACKEND_BY_PLATFORM[platform]
  if (!backend) {
    return {
      availability: 'unavailable',
      backend: null,
      reason: `unknown-platform:${platform}`,
      source: 'platform',
    }
  }
  return finishProbe(backend, probe, 'platform')
}

function finishProbe(
  backend: KeyringBackend,
  probe: ((b: KeyringBackend) => { usable: boolean; reason: string }) | undefined,
  source: string,
): KeyringCapability {
  if (!probe) {
    return { availability: 'unjudged', backend, reason: 'probe-not-run', source }
  }
  let result: { usable: boolean; reason: string }
  try {
    result = probe(backend)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { availability: 'unavailable', backend, reason: `probe-threw:${detail}`, source }
  }
  if (!result.usable) {
    return {
      availability: 'unavailable',
      backend,
      reason: result.reason || 'probe-unusable',
      source,
    }
  }
  return { availability: 'available', backend, reason: result.reason || 'probe-ok', source }
}

/**
 * 能力不可用时构造统一的失败台账项(与 main-credential-store 的 failure 同形),
 * 供上层 fail-closed:探测不到就不再尝试落盘,更不回落明文。
 */
export function keyringUnavailableFailure(cap: KeyringCapability): MainCredentialStoreFailure {
  return {
    code: 'keyring-unavailable',
    detail: `系统密钥环不可用(${cap.backend ?? 'none'}:${cap.reason})。`,
    remediation: '确认当前平台的系统密钥环服务已启用;IHUI 不会把凭据写成明文作为降级。',
  }
}

/**
 * 把现有 Windows DPAPI 探针桥到统一能力面(2026-11-24)。
 *
 * 只读包装,不替换 credential-vault.ts / main-credential-store.ts 的任何现有行为:
 * 上层诊断可拿到封闭四态与 reason,而原 backend 选择逻辑照旧。
 * probe 由调用方注入(真机传 probeDpapiSync),避免本模块依赖 crypto/注册表实现。
 */
export interface DpapiProbeLike {
  ok: boolean
  detail: string
  engine?: string
}

export function capabilityFromDpapiProbe(
  platform: string,
  probe: () => DpapiProbeLike,
): KeyringCapability {
  return detectKeyringCapability(platform, () => {
    const out = probe()
    return {
      usable: out.ok,
      reason: out.ok ? out.detail || 'dpapi-roundtrip-ok' : out.detail || 'dpapi-probe-failed',
    }
  })
}
