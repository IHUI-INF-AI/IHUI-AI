// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 声明式扩展 manifest —— schema + 逐字段校验(纯函数,无副作用)。
 *
 * 设计目标与边界:
 * 1) **声明式、禁止任意代码执行**:manifest 只描述「声明了什么」,不携带入口脚本/
 *    可执行字段。出现 `exec`/`script`/`command`/`shell` 等可执行键一律拒绝
 *    (深度扫描,任何层级都算),错误码稳定为 `executable_field_forbidden`。
 * 2) **逐字段报错**:校验结果返回 `{path, code, message}` 列表(path 形如
 *    `permissions[1]` / `contributes.tools[0].capability`),而不是一句 invalid。
 * 3) 校验器**不注册**:注册与回收由 capability-catalog 的既有注册表完成
 *    (单一注册表,不在本模块另造第二套)。
 *
 * 权限必须在**已登记枚举**内:调用方注入 `isRegisteredScope`(生产实现 = capability-catalog
 * 的 INDEX),本模块同时要求它在 `API_KEY_PERMISSIONS` 枚举里 —— 两个判据缺一不可,
 * 防止把「枚举里有、目录没登记」的 scope 放进扩展。
 */
import { API_KEY_PERMISSIONS, type ApiKeyPermission } from './api-key.js'
import { MODEL_CAPABILITY_TIERS, type ModelCapabilityTier } from './skill-tiers.js'

/** 已知激活事件枚举。新增事件必须同时改这里与消费方,不得在 manifest 里自造。 */
export const EXTENSION_ACTIVATION_EVENTS = [
  'onStartup',
  'onCommand',
  'onToolCall',
  'onSkillInvoke',
  'onViewMount',
  'onSchedule',
] as const
export type ExtensionActivationEvent = (typeof EXTENSION_ACTIVATION_EVENTS)[number]

/** 允许的贡献类型(只声明,不执行)。 */
export const EXTENSION_CONTRIBUTION_KINDS = ['tools', 'commands', 'views'] as const
export type ExtensionContributionKind = (typeof EXTENSION_CONTRIBUTION_KINDS)[number]

/**
 * manifest 中任何层级出现这些键都直接拒绝。
 * 注意:`contributes.commands` 是复数键(声明式命令清单),不在拒绝集里;
 * 单数 `command` 才是可执行字段。
 */
export const FORBIDDEN_EXECUTABLE_FIELDS = [
  'exec',
  'script',
  'command',
  'shell',
  'bin',
  'main',
  'run',
  'eval',
  'spawn',
  'require',
  'import',
  'entrypoint',
] as const

/** 扩展 id 规则:反向域名式小写点分标识(至少两段),如 `com.example.todo-panel`。 */
export const EXTENSION_ID_RE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/
/** 贡献名规则:字母开头,允许字母数字与 `._:-`。 */
export const EXTENSION_CONTRIBUTION_NAME_RE = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/
/** 语义化版本(允许预发布后缀)。 */
export const EXTENSION_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

export interface ExtensionContribution {
  /** 工具/命令/视图名 */
  name: string
  /** 该贡献由哪个能力(scope)提供,必须在 entryCapabilities 内 */
  capability: string
}

export interface ExtensionContributions {
  tools?: ExtensionContribution[]
  commands?: ExtensionContribution[]
  views?: ExtensionContribution[]
}

export interface ExtensionModelTiers {
  min?: ModelCapabilityTier
  preferred?: ModelCapabilityTier
}

/** 通过校验后的规范化 manifest(注册表存储的形状)。 */
export interface ExtensionManifest {
  id: string
  name: string
  version: string
  entryCapabilities: string[]
  activationEvents: ExtensionActivationEvent[]
  permissions: ApiKeyPermission[]
  contributes: ExtensionContributions
  modelTiers?: ExtensionModelTiers
}

/** 逐字段错误项。`path` 是 JSON 路径,便于调用方精确定位。 */
export interface ExtensionManifestIssue {
  path: string
  code:
    | 'invalid_type'
    | 'unknown_field'
    | 'executable_field_forbidden'
    | 'missing_field'
    | 'invalid_id'
    | 'invalid_version'
    | 'permission_not_registered'
    | 'permission_duplicate'
    | 'entry_capability_not_declared'
    | 'activation_event_unknown'
    | 'activation_event_duplicate'
    | 'contribution_name_invalid'
    | 'contribution_duplicate'
    | 'model_tier_invalid'
    | 'model_tier_order'
  message: string
}

export type ExtensionManifestValidation =
  { ok: true; manifest: ExtensionManifest } | { ok: false; errors: ExtensionManifestIssue[] }

/** 校验上下文:权限是否已在 capability-catalog 注册(生产实现 = catalog INDEX)。 */
export interface ExtensionManifestValidationContext {
  isRegisteredScope(scope: string): boolean
}

const TOP_LEVEL_KEYS = new Set([
  'id',
  'name',
  'version',
  'entryCapabilities',
  'activationEvents',
  'permissions',
  'contributes',
  'modelTiers',
])
const CONTRIBUTION_KEYS = new Set<string>(EXTENSION_CONTRIBUTION_KINDS)
const CONTRIBUTION_ITEM_KEYS = new Set(['name', 'capability'])
const MODEL_TIER_KEYS = new Set(['min', 'preferred'])
const FORBIDDEN_SET = new Set<string>(FORBIDDEN_EXECUTABLE_FIELDS)
const ACTIVATION_EVENT_SET = new Set<string>(EXTENSION_ACTIVATION_EVENTS)
const MODEL_TIER_SET = new Set<string>(MODEL_CAPABILITY_TIERS)
const PERMISSION_SET = new Set<string>(API_KEY_PERMISSIONS)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function issue(
  path: string,
  code: ExtensionManifestIssue['code'],
  message: string,
): ExtensionManifestIssue {
  return { path, code, message }
}

/**
 * 深度扫描可执行键。返回每个命中位置的 path。
 * 只认**键名**(值是什么都不影响:出现即拒),因为"可执行语义"来自键本身。
 */
export function findExecutableFields(value: unknown, path = '$'): ExtensionManifestIssue[] {
  const found: ExtensionManifestIssue[] = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findExecutableFields(item, `${path}[${index}]`))
    })
    return found
  }
  if (!isRecord(value)) return found
  for (const [key, child] of Object.entries(value)) {
    const childPath = path === '$' ? key : `${path}.${key}`
    if (FORBIDDEN_SET.has(key)) {
      found.push(
        issue(
          childPath,
          'executable_field_forbidden',
          `字段 "${childPath}" 是可执行字段(禁止项:${FORBIDDEN_EXECUTABLE_FIELDS.join('/')}),manifest 只允许声明式配置`,
        ),
      )
      continue
    }
    found.push(...findExecutableFields(child, childPath))
  }
  return found
}

function readString(
  raw: Record<string, unknown>,
  key: string,
  errors: ExtensionManifestIssue[],
): string | undefined {
  const value = raw[key]
  if (value === undefined) {
    errors.push(issue(key, 'missing_field', `缺少必填字段 "${key}"`))
    return undefined
  }
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(issue(key, 'invalid_type', `字段 "${key}" 必须是非空字符串`))
    return undefined
  }
  return value.trim()
}

function readStringArray(
  raw: Record<string, unknown>,
  key: string,
  errors: ExtensionManifestIssue[],
): string[] | undefined {
  const value = raw[key]
  if (value === undefined) {
    errors.push(issue(key, 'missing_field', `缺少必填字段 "${key}"`))
    return undefined
  }
  if (!Array.isArray(value)) {
    errors.push(issue(key, 'invalid_type', `字段 "${key}" 必须是字符串数组`))
    return undefined
  }
  const result: string[] = []
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(
        issue(`${key}[${index}]`, 'invalid_type', `字段 "${key}[${index}]" 必须是非空字符串`),
      )
      return
    }
    result.push(item.trim())
  })
  return result
}

/** 对数组做重复检查,错误点名重复值。 */
function checkDuplicates(
  values: readonly string[],
  key: string,
  errors: ExtensionManifestIssue[],
  code: 'permission_duplicate' | 'activation_event_duplicate' | 'contribution_duplicate',
): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (seen.has(value)) {
      errors.push(issue(`${key}[${index}]`, code, `字段 "${key}[${index}]" 重复声明了 "${value}"`))
    }
    seen.add(value)
  })
}

function validateContributions(
  raw: unknown,
  entryCapabilities: readonly string[],
  errors: ExtensionManifestIssue[],
): ExtensionContributions | undefined {
  if (raw === undefined) return {}
  if (!isRecord(raw)) {
    errors.push(issue('contributes', 'invalid_type', '字段 "contributes" 必须是对象'))
    return undefined
  }
  const contributes: ExtensionContributions = {}
  const seenNames = new Set<string>()
  for (const [kind, value] of Object.entries(raw)) {
    if (!CONTRIBUTION_KEYS.has(kind)) {
      errors.push(
        issue(
          `contributes.${kind}`,
          'unknown_field',
          `字段 "contributes.${kind}" 不是已知贡献类型(${EXTENSION_CONTRIBUTION_KINDS.join('/')})`,
        ),
      )
      continue
    }
    if (!Array.isArray(value)) {
      errors.push(
        issue(`contributes.${kind}`, 'invalid_type', `字段 "contributes.${kind}" 必须是数组`),
      )
      continue
    }
    const items: ExtensionContribution[] = []
    value.forEach((item, index) => {
      const itemPath = `contributes.${kind}[${index}]`
      if (!isRecord(item)) {
        errors.push(issue(itemPath, 'invalid_type', `"${itemPath}" 必须是对象`))
        return
      }
      for (const key of Object.keys(item)) {
        if (!CONTRIBUTION_ITEM_KEYS.has(key)) {
          errors.push(
            issue(
              `${itemPath}.${key}`,
              'unknown_field',
              `字段 "${itemPath}.${key}" 不在允许键(name/capability)内`,
            ),
          )
        }
      }
      const name = item.name
      if (typeof name !== 'string' || !EXTENSION_CONTRIBUTION_NAME_RE.test(name)) {
        errors.push(
          issue(
            `${itemPath}.name`,
            'contribution_name_invalid',
            `字段 "${itemPath}.name" 必须匹配 ${EXTENSION_CONTRIBUTION_NAME_RE.source}`,
          ),
        )
        return
      }
      const capability = item.capability
      if (typeof capability !== 'string' || capability.trim() === '') {
        errors.push(
          issue(
            `${itemPath}.capability`,
            'invalid_type',
            `字段 "${itemPath}.capability" 必须是非空字符串`,
          ),
        )
        return
      }
      if (!entryCapabilities.includes(capability)) {
        errors.push(
          issue(
            `${itemPath}.capability`,
            'entry_capability_not_declared',
            `字段 "${itemPath}.capability" 的值 "${capability}" 未在 entryCapabilities 内声明`,
          ),
        )
        return
      }
      if (seenNames.has(name)) {
        errors.push(
          issue(
            `${itemPath}.name`,
            'contribution_duplicate',
            `字段 "${itemPath}.name" 的贡献名 "${name}" 在 manifest 内重复出现(工具/命令/视图共用同一名字空间)`,
          ),
        )
        return
      }
      seenNames.add(name)
      items.push({ name, capability })
    })
    if (items.length > 0) contributes[kind as ExtensionContributionKind] = items
  }
  return contributes
}

function validateModelTiers(
  raw: unknown,
  errors: ExtensionManifestIssue[],
): ExtensionModelTiers | undefined {
  if (raw === undefined) return undefined
  if (!isRecord(raw)) {
    errors.push(issue('modelTiers', 'invalid_type', '字段 "modelTiers" 必须是对象'))
    return undefined
  }
  for (const key of Object.keys(raw)) {
    if (!MODEL_TIER_KEYS.has(key)) {
      errors.push(
        issue(
          `modelTiers.${key}`,
          'unknown_field',
          `字段 "modelTiers.${key}" 不在允许键(min/preferred)内`,
        ),
      )
    }
  }
  const tiers: ExtensionModelTiers = {}
  for (const key of ['min', 'preferred'] as const) {
    const value = raw[key]
    if (value === undefined) continue
    if (typeof value !== 'string' || !MODEL_TIER_SET.has(value)) {
      errors.push(
        issue(
          `modelTiers.${key}`,
          'model_tier_invalid',
          `字段 "modelTiers.${key}" 的值 "${String(value)}" 不在已知档位枚举(${MODEL_CAPABILITY_TIERS.join('/')})内`,
        ),
      )
      continue
    }
    tiers[key] = value as ModelCapabilityTier
  }
  if (
    tiers.min !== undefined &&
    tiers.preferred !== undefined &&
    MODEL_CAPABILITY_TIERS.indexOf(tiers.min) > MODEL_CAPABILITY_TIERS.indexOf(tiers.preferred)
  ) {
    errors.push(
      issue(
        'modelTiers',
        'model_tier_order',
        `"modelTiers.min"(${tiers.min})不得高于 "modelTiers.preferred"(${tiers.preferred})`,
      ),
    )
  }
  return tiers
}

/**
 * 校验入口。纯函数:不注册、不改全局状态;注册由 capability-catalog 在本函数通过后执行。
 */
export function validateExtensionManifest(
  raw: unknown,
  ctx: ExtensionManifestValidationContext,
): ExtensionManifestValidation {
  if (!isRecord(raw)) {
    return {
      ok: false,
      errors: [issue('$', 'invalid_type', 'manifest 必须是 JSON 对象')],
    }
  }

  const errors: ExtensionManifestIssue[] = []

  // 1) 可执行键优先拦截:即使同时有未知字段,也先把"不允许携带代码"这件事点名。
  errors.push(...findExecutableFields(raw))

  // 2) 未知顶层字段
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.has(key) && !FORBIDDEN_SET.has(key)) {
      errors.push(
        issue(key, 'unknown_field', `未知字段 "${key}"(允许字段:${[...TOP_LEVEL_KEYS].join('/')})`),
      )
    }
  }

  // 3) 必填字段与逐字段校验
  const id = readString(raw, 'id', errors)
  if (id !== undefined && !EXTENSION_ID_RE.test(id)) {
    errors.push(
      issue(
        'id',
        'invalid_id',
        `字段 "id" 的值 "${id}" 不匹配 ${EXTENSION_ID_RE.source}(反向域名式小写点分标识)`,
      ),
    )
  }
  const name = readString(raw, 'name', errors)
  const version = readString(raw, 'version', errors)
  if (version !== undefined && !EXTENSION_VERSION_RE.test(version)) {
    errors.push(
      issue('version', 'invalid_version', `字段 "version" 的值 "${version}" 不是语义化版本(x.y.z)`),
    )
  }

  const permissions = readStringArray(raw, 'permissions', errors)
  const entryCapabilities = readStringArray(raw, 'entryCapabilities', errors)
  const activationEvents = readStringArray(raw, 'activationEvents', errors)

  if (permissions) {
    checkDuplicates(permissions, 'permissions', errors, 'permission_duplicate')
    permissions.forEach((scope, index) => {
      if (!PERMISSION_SET.has(scope) || !ctx.isRegisteredScope(scope)) {
        errors.push(
          issue(
            `permissions[${index}]`,
            'permission_not_registered',
            `字段 "permissions[${index}]" 的值 "${scope}" 未在已登记权限枚举内`,
          ),
        )
      }
    })
  }

  if (entryCapabilities) {
    checkDuplicates(entryCapabilities, 'entryCapabilities', errors, 'permission_duplicate')
    entryCapabilities.forEach((scope, index) => {
      if (permissions && !permissions.includes(scope)) {
        errors.push(
          issue(
            `entryCapabilities[${index}]`,
            'entry_capability_not_declared',
            `字段 "entryCapabilities[${index}]" 的值 "${scope}" 未在 permissions 内声明`,
          ),
        )
      }
    })
  }

  if (activationEvents) {
    checkDuplicates(activationEvents, 'activationEvents', errors, 'activation_event_duplicate')
    activationEvents.forEach((event, index) => {
      if (!ACTIVATION_EVENT_SET.has(event)) {
        errors.push(
          issue(
            `activationEvents[${index}]`,
            'activation_event_unknown',
            `字段 "activationEvents[${index}]" 的值 "${event}" 不在已知事件枚举(${EXTENSION_ACTIVATION_EVENTS.join('/')})内`,
          ),
        )
      }
    })
  }

  const contributes = validateContributions(raw.contributes, entryCapabilities ?? [], errors)
  const modelTiers = validateModelTiers(raw.modelTiers, errors)

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    manifest: {
      id: id!,
      name: name!,
      version: version!,
      entryCapabilities: entryCapabilities!,
      activationEvents: activationEvents as ExtensionActivationEvent[],
      permissions: permissions as ApiKeyPermission[],
      contributes: contributes ?? {},
      ...(modelTiers === undefined ? {} : { modelTiers }),
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
