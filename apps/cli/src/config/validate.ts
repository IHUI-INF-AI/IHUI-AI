// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BUG-0042 — 用户全局层(`~/.ihui/settings.json`)的运行时类型校验。
 *
 * 此前 `loadSettingsFile` 只做 `isRecord` 断言就 `as Partial<Settings>`,
 * `maxIterations: "abc"` 会一路进主循环(0 次迭代、静默什么都不做),
 * `sampler.temperature: "high"` 会原样发给 provider —— 两者都没有告警可查。
 *
 * 口径:
 *  - **只校验、不改语义**:合法值原样通过;非法值**回落默认层**(而不是猜一个替代值);
 *  - 每个被丢弃的键都点名:`键 / 实际值 / 期望`,一条 warning,不静默;
 *  - 类型规则与项目层共用 `PROJECT_KEY_VALIDATORS` 那一份,不抄第二张表;
 *    只有"项目层禁写、全局层可写"的键(凭据/沙箱/批准面)才在本文件补规则;
 *  - 未知顶层键不在本票判据内(`Settings` 没有运行时键清单,全局层也无封闭白名单需求,
 *    用户扩展键必须能继续存在)—— 这条上限如实写在这里,不装作全覆盖。
 */

import type { Settings } from '../commands/settings.js'
import { PROJECT_KEY_VALIDATORS, type ProjectKeyValidator } from './layer-policy.js'

const isNonEmptyString: ProjectKeyValidator = (v) =>
  typeof v === 'string' && v.length > 0 ? null : '期望非空字符串'
const isBoolean: ProjectKeyValidator = (v) => (typeof v === 'boolean' ? null : '期望 boolean')
const isPlainObject: ProjectKeyValidator = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? null : '期望对象'
const isUrlLike: ProjectKeyValidator = (v) =>
  typeof v === 'string' && /^https?:\/\//.test(v) ? null : '期望 http(s):// 开头的 URL'
const enumOf =
  (list: readonly string[]): ProjectKeyValidator =>
  (v) =>
    typeof v === 'string' && list.includes(v) ? null : `期望 ${list.map((x) => `'${x}'`).join(' | ')}`

/**
 * 全局层可写、项目层禁写的键的规则(凭据域 / 沙箱 / 批准面 / MCP 装配面)。
 * 与 `PROJECT_KEY_VALIDATORS` 同签名,合并后才是全局层的完整类型面。
 */
const GLOBAL_ONLY_VALIDATORS: Readonly<Record<string, ProjectKeyValidator>> = {
  apiKey: isNonEmptyString,
  apiSecret: isNonEmptyString,
  refreshToken: isNonEmptyString,
  credentialKind: enumOf(['auto', 'api_key', 'jwt']),
  permissionMode: isNonEmptyString,
  yolo: isBoolean,
  autoApprovePlan: isBoolean,
  folderTrust: isPlainObject,
  sandbox: isPlainObject,
  sandboxMode: enumOf(['read-only', 'workspace-write', 'danger-full-access']),
  approvalPolicy: (v) =>
    typeof v === 'string' || (typeof v === 'object' && v !== null && !Array.isArray(v))
      ? null
      : "期望 'untrusted' | 'on-failure' | 'on-request' | 'never' | { granular: {…} }",
  profile: isNonEmptyString,
  profiles: isPlainObject,
  serve: isPlainObject,
  mcp: isPlainObject,
  toolHub: isPlainObject,
  providerBaseUrl: isUrlLike,
}

/** 顶层键的类型规则:项目层那份 + 仅全局层可写的补充。 */
const SETTINGS_VALUE_VALIDATORS: Readonly<Record<string, ProjectKeyValidator>> = {
  ...PROJECT_KEY_VALIDATORS,
  ...GLOBAL_ONLY_VALIDATORS,
}

/** 数字型嵌套字段(上/下界):bug 面点名 maxIterations / temperature,这里只收数值域。 */
const SETTINGS_NESTED_VALIDATORS: Readonly<
  Record<string, Readonly<Record<string, { check: ProjectKeyValidator; hint: string }>>>
> = {
  sampler: {
    temperature: {
      check: (v) =>
        typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 2 ? null : '期望 0–2 的数字',
      hint: '0–2',
    },
    maxTokens: {
      check: (v) =>
        typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 65536
          ? null
          : '期望 1–65536 的整数',
      hint: '1–65536',
    },
  },
  voice: {
    durationSec: {
      check: (v) =>
        typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 60
          ? null
          : '期望 1–60 的数字',
      hint: '1–60',
    },
  },
}

export interface SettingsValidation {
  value: Partial<Settings>
  /** 每条都是可行动的告警:键 / 实际值 / 期望 —— 调用方负责吼出来。 */
  warnings: string[]
}

const show = (v: unknown): string => {
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

/**
 * 纯函数:把一份从 settings.json 解析出的对象切成"合法值"与"告警"。
 * 非法键**不进入返回值**,于是 6 层合并时自然回落到更低层(defaults)。
 */
export function validateSettingsValues(parsed: Record<string, unknown>): SettingsValidation {
  const value: Record<string, unknown> = {}
  const warnings: string[] = []
  for (const [key, raw] of Object.entries(parsed)) {
    const check = SETTINGS_VALUE_VALIDATORS[key]
    if (!check) {
      // 未知键:不在本票判据内(见文件头"已知上限"),原样保留。
      value[key] = raw
      continue
    }
    const fail = check(raw)
    if (fail !== null) {
      warnings.push(`[config] 键 ${key}=${show(raw)} 非法:${fail};已回落默认值`)
      continue
    }
    const nested = SETTINGS_NESTED_VALIDATORS[key]
    if (nested && typeof raw === 'object' && raw !== null) {
      const kept: Record<string, unknown> = { ...(raw as Record<string, unknown>) }
      for (const [sub, rule] of Object.entries(nested)) {
        if (!(sub in kept)) continue
        const subFail = rule.check(kept[sub])
        if (subFail !== null) {
          delete kept[sub]
          warnings.push(
            `[config] 键 ${key}.${sub}=${show((raw as Record<string, unknown>)[sub])} 非法:${subFail}(有效域 ${rule.hint});已回落默认值`,
          )
        }
      }
      value[key] = kept
      continue
    }
    value[key] = raw
  }
  return { value: value as Partial<Settings>, warnings }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
