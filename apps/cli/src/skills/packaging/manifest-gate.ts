// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * manifest 校验门的**对接层** —— 不定义第二套扩展 manifest schema。
 *
 * 与并行会话(`fix/capability-tiers-1104` 的 `packages/types/src/capability-extensions.ts`,
 * 声明式扩展 manifest + 技能按模型能力分档)的耦合方式:
 *   - 本文件只定义 **gate 契约** `ManifestGate` 与一个**安装期最小结构门**
 *     (`structural-fallback`),后者只问"包身份是否可用、有没有明显可执行键",
 *     不复制扩展 manifest 的字段/权限/激活事件枚举;
 *   - `createExtensionManifestGate(validateExtensionManifest)` 是正式对接点:
 *     对方进 main 后,把它的校验器传进来即可接管语义判定(本文件不 import 该模块,
 *     避免在对方未落地时制造第二份定义)。专家包专属字段(kind/skills/promptTemplate/rules)
 *     在委托前剥离,扩展 manifest 部分原样交给对方校验。
 *   - 无论哪个门,失败都落同一个稳定错误码 SKILL_PKG_MANIFEST_INVALID,
 *     逐条 issue 带 JSON path,调用方可精确点名。
 */

import { SkillPackageError } from './errors.js'

export interface ManifestGateIssue {
  /** JSON 路径(如 `permissions[1]` / `scripts`) */
  path: string
  code: string
  message: string
}

export interface ManifestIdentity {
  id: string
  name: string
  version: string
  /** 'skill' | 'expert-pack';缺省按 skill 处理 */
  kind: 'skill' | 'expert-pack'
}

export type ManifestGateResult =
  | { ok: true; identity: ManifestIdentity; raw: Record<string, unknown>; gate: string }
  | { ok: false; issues: ManifestGateIssue[]; gate: string }

export interface ManifestGate {
  /** 门名,进报告(`structural-fallback` / `extension-manifest`) */
  readonly name: string
  validate(manifest: unknown): ManifestGateResult
}

/** 任何层级出现这些键都拒:它们把"声明"变成"可执行意图"。 */
const FORBIDDEN_EXECUTABLE_KEYS: ReadonlySet<string> = new Set([
  'exec',
  'script',
  'scripts',
  'postinstall',
  'preinstall',
  'prepare',
  'command',
  'shell',
  'bin',
  'main',
  'run',
  'eval',
  'spawn',
  'require',
  'entrypoint',
])

/** 包身份规则(安装目录名来源);扩展 manifest 的 id 语义由对接的校验器负责。 */
const PACKAGE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/
const PACKAGE_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function issue(path: string, code: string, message: string): ManifestGateIssue {
  return { path, code, message }
}

/** 深度扫描可执行键;返回每处命中的 JSON path(键名本身即语义,不看值)。 */
export function findExecutableKeys(value: unknown, path = '$'): ManifestGateIssue[] {
  const found: ManifestGateIssue[] = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...findExecutableKeys(item, `${path}[${index}]`)))
    return found
  }
  if (!isRecord(value)) return found
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EXECUTABLE_KEYS.has(key)) {
      found.push(issue(path === '$' ? key : `${path}.${key}`, 'executable_key_forbidden', `manifest 不得声明可执行键:${key}`))
      continue
    }
    found.push(...findExecutableKeys(child, path === '$' ? key : `${path}.${key}`))
  }
  return found
}

function stringArrayIssue(raw: Record<string, unknown>, key: string): ManifestGateIssue | null {
  if (!(key in raw)) return null
  const value = raw[key]
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return issue(key, 'invalid_type', `${key} 必须是字符串数组`)
  }
  return null
}

/**
 * 安装期最小结构门(并行 manifest 校验器未落地时的默认门)。
 *
 * 它**不**校验权限/激活事件的枚举成员资格 —— 那份枚举的唯一来源是并行会话的
 * capability-extensions;此处只保证"字段形状可用 + 没有任何可执行键"。
 */
export function createStructuralManifestGate(): ManifestGate {
  return {
    name: 'structural-fallback',
    validate(manifest: unknown): ManifestGateResult {
      const issues: ManifestGateIssue[] = []
      if (!isRecord(manifest)) {
        return { ok: false, gate: 'structural-fallback', issues: [issue('$', 'invalid_type', 'manifest 必须是对象')] }
      }
      const id = manifest.id
      const name = manifest.name
      const version = manifest.version
      if (typeof id !== 'string' || !PACKAGE_ID_RE.test(id)) {
        issues.push(issue('id', 'invalid_id', 'id 必须匹配 [a-z0-9][a-z0-9._-]{0,63}'))
      }
      if (typeof name !== 'string' || name.length === 0) {
        issues.push(issue('name', 'missing_field', 'name 必须是非空字符串'))
      }
      if (typeof version !== 'string' || !PACKAGE_VERSION_RE.test(version)) {
        issues.push(issue('version', 'invalid_version', 'version 必须是 semver(允许预发布后缀)'))
      }
      if ('kind' in manifest && manifest.kind !== 'skill' && manifest.kind !== 'expert-pack') {
        issues.push(issue('kind', 'invalid_type', "kind 只能是 'skill' 或 'expert-pack'"))
      }
      issues.push(...findExecutableKeys(manifest))
      if ('activationEvents' in manifest) {
        const arrayIssue = stringArrayIssue(manifest, 'activationEvents')
        if (arrayIssue) issues.push(arrayIssue)
      }
      if ('permissions' in manifest) {
        const arrayIssue = stringArrayIssue(manifest, 'permissions')
        if (arrayIssue) issues.push(arrayIssue)
      }
      if ('entryCapabilities' in manifest) {
        const arrayIssue = stringArrayIssue(manifest, 'entryCapabilities')
        if (arrayIssue) issues.push(arrayIssue)
      }
      if ('skills' in manifest) {
        const arrayIssue = stringArrayIssue(manifest, 'skills')
        if (arrayIssue) issues.push(arrayIssue)
      }
      if ('rules' in manifest) {
        const arrayIssue = stringArrayIssue(manifest, 'rules')
        if (arrayIssue) issues.push(arrayIssue)
      }
      if ('promptTemplate' in manifest && typeof manifest.promptTemplate !== 'string') {
        issues.push(issue('promptTemplate', 'invalid_type', 'promptTemplate 必须是字符串'))
      }
      if ('modelTiers' in manifest) {
        const tiers = manifest.modelTiers
        if (!isRecord(tiers) || Object.values(tiers).some((value) => typeof value !== 'string')) {
          issues.push(issue('modelTiers', 'invalid_type', 'modelTiers 必须是字符串值对象'))
        }
      }
      if (issues.length > 0) return { ok: false, gate: 'structural-fallback', issues }
      const kind = manifest.kind === 'expert-pack' ? 'expert-pack' : 'skill'
      return {
        ok: true,
        gate: 'structural-fallback',
        raw: manifest,
        identity: { id: id as string, name: name as string, version: version as string, kind },
      }
    },
  }
}

/** 并行会话扩展 manifest 校验器的结构契约(只描述调用形状,不描述字段 schema)。 */
export interface ExtensionManifestValidatorLike {
  (
    raw: unknown,
    ctx: { isRegisteredScope(scope: string): boolean },
  ): { ok: true } | { ok: false; errors: ManifestGateIssue[] }
}

export interface ExtensionManifestGateOptions {
  /** 权限 scope 是否已在 capability-catalog 登记(生产实现注入,默认不额外拦截)。 */
  isRegisteredScope?: (scope: string) => boolean
}

/** 专家包专属字段:委托前剥离,不进扩展 manifest 校验面。 */
const EXPERT_PACK_ONLY_KEYS = ['kind', 'skills', 'promptTemplate', 'rules', 'description'] as const

/**
 * 正式对接门:委托并行会话的 `validateExtensionManifest`。
 *
 * 委托前先做包身份的最小结构检查(id/name/version 是安装目录与报告的必要字段),
 * 再把扩展 manifest 部分(去掉专家包专属字段)原样交给对方;错误逐条透传。
 */
export function createExtensionManifestGate(
  validateExtensionManifest: ExtensionManifestValidatorLike,
  options: ExtensionManifestGateOptions = {},
): ManifestGate {
  return {
    name: 'extension-manifest',
    validate(manifest: unknown): ManifestGateResult {
      if (!isRecord(manifest)) {
        return { ok: false, gate: 'extension-manifest', issues: [issue('$', 'invalid_type', 'manifest 必须是对象')] }
      }
      const issues: ManifestGateIssue[] = []
      const id = manifest.id
      const name = manifest.name
      const version = manifest.version
      if (typeof id !== 'string' || !PACKAGE_ID_RE.test(id)) {
        issues.push(issue('id', 'invalid_id', '包身份 id 不合法'))
      }
      if (typeof name !== 'string' || name.length === 0) {
        issues.push(issue('name', 'missing_field', '包身份 name 不能为空'))
      }
      if (typeof version !== 'string' || !PACKAGE_VERSION_RE.test(version)) {
        issues.push(issue('version', 'invalid_version', '包身份 version 不合法'))
      }
      if (issues.length > 0) return { ok: false, gate: 'extension-manifest', issues }

      const delegated: Record<string, unknown> = { ...manifest }
      for (const key of EXPERT_PACK_ONLY_KEYS) delete delegated[key]
      const verdict = validateExtensionManifest(delegated, {
        isRegisteredScope: options.isRegisteredScope ?? (() => true),
      })
      if (!verdict.ok) {
        return {
          ok: false,
          gate: 'extension-manifest',
          issues: verdict.errors.map((error) => ({
            path: error.path,
            code: error.code,
            message: error.message,
          })),
        }
      }
      const kind = manifest.kind === 'expert-pack' ? 'expert-pack' : 'skill'
      return {
        ok: true,
        gate: 'extension-manifest',
        raw: manifest,
        identity: { id: id as string, name: name as string, version: version as string, kind },
      }
    },
  }
}

/** 解析通过后的统一出口:失败即抛 SKILL_PKG_MANIFEST_INVALID(逐条 issue 进 detail)。 */
export function assertManifestGate(gate: ManifestGate, manifest: unknown): ManifestGateResult & { ok: true } {
  const verdict = gate.validate(manifest)
  if (!verdict.ok) {
    throw new SkillPackageError(
      'SKILL_PKG_MANIFEST_INVALID',
      `manifest 未通过校验(gate=${verdict.gate}):${verdict.issues.map((i) => `${i.path}:${i.code}`).join(', ')}`,
      { gate: verdict.gate, issues: verdict.issues },
    )
  }
  return verdict
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
