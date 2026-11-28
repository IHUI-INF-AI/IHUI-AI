// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力清单(Capability Manifest)—— 声明式扩展契约的单一真相源。
 *
 * 立因(2026-11-26 四程序对标):同类产品的扩展面已经不再是"一个 main 入口 + 自己写逻辑",
 * 而是把**权限、贡献点、启用条件、原生组件**全部写成一份可校验清单:
 * 宿主只认清单里的声明,清单外的能力一律拒绝加载。
 * 本仓扩展/插件面此前只有散落在各端的约定,没有"先校验形状再加载"的唯一入口,
 * 结果同一份配置在桌面端能起、在 API 端起不来,只能靠运行期试错发现。
 *
 * 三条纪律:
 *   1. **fail-closed**:形状不合法 ⇒ 整份拒绝,不"降级加载一半";
 *   2. **权限最小集**:每个权限串必须是 `域.动作` 形态,未知权限默认拒绝;
 *   3. **启用条件可判定**:`evaluateEnablement` 只做纯计算,未知表达式一律 false(不猜)。
 *
 * 本模块零依赖、零 IO,只做形状与条件判定;真正加载/执行仍在调用方。
 */

/**
 * 权限串:小写域 + 小写动作,点分,至少两段。
 * 动作段允许**首字母之后**出现大写(Qoder 0.5.14 的 33 条原始声明名就是驼峰形态:
 * `chat.createSession` / `files.readSessionResource`)。域段与每段首字母仍必须小写 ——
 * `Chat.SEND` 这种整段大写依旧拒,不把"大小写都能过"当成宽容。
 */
export const CAPABILITY_PERMISSION_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][A-Za-z0-9-]*)+$/

/** 清单 id:点分或连字符分段的稳定标识(例:`ihui.canvas`) */
export const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/

/** 版本号:必须三段数字,可带预发布/构建后缀 */
export const CAPABILITY_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

/** 视图落点:只有这五种,新增落点必须先改本表 */
export const CAPABILITY_VIEW_LOCATIONS = [
  'workbench',
  'settings',
  'file.preview',
  'session.resource',
  'chat.mentionPreview',
] as const

export type CapabilityViewLocation = (typeof CAPABILITY_VIEW_LOCATIONS)[number]

/** 启用条件表达式(全部可静态判定,不含函数/正则等不可序列化形态) */
export type EnablementExpression =
  | { type: 'configuration'; key: string; equals?: unknown }
  | { type: 'operatingSystem'; versions: Readonly<Record<string, string>> }
  | { type: 'allOf'; expressions: readonly EnablementExpression[] }
  | { type: 'anyOf'; expressions: readonly EnablementExpression[] }
  | { type: 'not'; expression: EnablementExpression }

/** 判定启用条件所需的环境(由宿主在加载前注入,不从进程全局偷读) */
export interface EnablementEnvironment {
  configuration: Readonly<Record<string, unknown>>
  os: 'win32' | 'darwin' | 'linux'
  /** 仅 `operatingSystem` 带版本范围时需要,形如 `10.0.22631` */
  osVersion?: string
}

export interface CapabilityView {
  id: string
  title?: string
  location: CapabilityViewLocation
  entry: string
}

export interface CapabilityFilePreviewer {
  id: string
  viewId: string
  filenameSuffixes: readonly string[]
  priority?: number
  refreshPolicy?: 'live' | 'onOpen'
}

export interface CapabilityMentionProvider {
  id: string
  title?: string
  previewViewId?: string
}

export interface CapabilitySidebarItem {
  id: string
  viewId: string
}

export interface CapabilitySessionResource {
  id: string
  previewViewId?: string
}

export interface CapabilityContributions {
  views: readonly CapabilityView[]
  filePreviewers: readonly CapabilityFilePreviewer[]
  chatMentionProviders: readonly CapabilityMentionProvider[]
  sidebarNavItems: readonly CapabilitySidebarItem[]
  sessionResources: readonly CapabilitySessionResource[]
}

/** Agent 侧插件声明:本地路径或远端服务名,二选一 */
export interface AgentPluginContribution {
  type: 'local' | 'remote'
  path?: string
  service?: string
  enablement?: EnablementExpression
}

/** 原生组件声明:只声明身份与生命周期,不声明加载方式 */
export interface NativeModuleContribution {
  id: string
  resourceId?: string
  lifecycle?: 'plugin' | 'app'
  enablement?: EnablementExpression
}

export interface CapabilityManifest {
  schemaVersion: number
  id: string
  name: string
  version: string
  main: string
  activationEvents: readonly string[]
  permissions: readonly string[]
  contributes: CapabilityContributions
  agentPlugins: readonly AgentPluginContribution[]
  nativeModules: readonly NativeModuleContribution[]
}

export type ManifestIssueCode =
  | 'missing'
  | 'type'
  | 'pattern'
  | 'duplicate'
  | 'unknown-permission'
  | 'unknown-field'
  | 'unknown-location'
  | 'dangling-reference'
  | 'unknown-enablement'

export interface ManifestIssue {
  /** JSON 路径式定位(例:`contributes.views[0].location`) */
  path: string
  code: ManifestIssueCode
  message: string
}

export interface ManifestParseOptions {
  /** 已注册权限全集;给出时,清单里的每个权限都必须命中(未命中即 unknown-permission) */
  knownPermissions?: readonly string[]
  /** 没有 `knownPermissions` 时,是否允许清单自带未知权限;缺省 false(先拒后放) */
  allowUnknownPermissions?: boolean
}

export type CapabilityManifestParseResult =
  | { ok: true; manifest: CapabilityManifest }
  | { ok: false; issues: readonly ManifestIssue[] }

const CONTRIBUTION_KEYS = new Set([
  'views',
  'filePreviewers',
  'chatMentionProviders',
  'sidebarNavItems',
  'sessionResources',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: ManifestIssue[],
  pattern?: RegExp,
): string | undefined {
  const value = source[key]
  if (value === undefined) {
    issues.push({ path: `${path}.${key}`, code: 'missing', message: '必填字段缺失' })
    return undefined
  }
  if (typeof value !== 'string' || value === '') {
    issues.push({ path: `${path}.${key}`, code: 'type', message: '必须是非空字符串' })
    return undefined
  }
  if (pattern !== undefined && !pattern.test(value)) {
    issues.push({ path: `${path}.${key}`, code: 'pattern', message: `不符合约定格式: ${value}` })
    return undefined
  }
  return value
}

function readStringArray(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: ManifestIssue[],
): string[] {
  const value = source[key]
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    issues.push({ path: `${path}.${key}`, code: 'type', message: '必须是字符串数组' })
    return []
  }
  const output: string[] = []
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    if (typeof item !== 'string' || item === '') {
      issues.push({ path: `${path}.${key}[${index}]`, code: 'type', message: '必须是非空字符串' })
      continue
    }
    output.push(item)
  }
  return output
}

export function parseCapabilityManifest(
  raw: unknown,
  options: ManifestParseOptions = {},
): CapabilityManifestParseResult {
  const issues: ManifestIssue[] = []
  if (!isRecord(raw)) {
    return { ok: false, issues: [{ path: '$', code: 'type', message: '清单必须是对象' }] }
  }
  const allowedTop = new Set([
    'schemaVersion',
    'id',
    'name',
    'version',
    'main',
    'activationEvents',
    'permissions',
    'contributes',
    'agentPlugins',
    'nativeModules',
  ])
  for (const key of Object.keys(raw)) {
    if (!allowedTop.has(key)) {
      issues.push({ path: `$.${key}`, code: 'unknown-field', message: '未登记的顶层字段' })
    }
  }

  const id = readString(raw, 'id', '$', issues, CAPABILITY_ID_PATTERN)
  const name = readString(raw, 'name', '$', issues)
  const version = readString(raw, 'version', '$', issues, CAPABILITY_VERSION_PATTERN)
  const main = readString(raw, 'main', '$', issues)

  let schemaVersion = 1
  if (raw.schemaVersion !== undefined) {
    if (typeof raw.schemaVersion !== 'number' || !Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) {
      issues.push({ path: '$.schemaVersion', code: 'type', message: '必须是正整数' })
    } else {
      schemaVersion = raw.schemaVersion
    }
  }

  const permissions = readStringArray(raw, 'permissions', '$', issues)
  const seenPermissions = new Set<string>()
  for (let index = 0; index < permissions.length; index += 1) {
    const permission = permissions[index]
    if (permission === undefined) continue
    if (!CAPABILITY_PERMISSION_PATTERN.test(permission)) {
      issues.push({
        path: `$.permissions[${index}]`,
        code: 'pattern',
        message: `权限必须是 域.动作 形态: ${permission}`,
      })
      continue
    }
    if (seenPermissions.has(permission)) {
      issues.push({ path: `$.permissions[${index}]`, code: 'duplicate', message: `重复权限: ${permission}` })
      continue
    }
    seenPermissions.add(permission)
    if (options.knownPermissions !== undefined && !options.knownPermissions.includes(permission)) {
      issues.push({
        path: `$.permissions[${index}]`,
        code: 'unknown-permission',
        message: `宿主未注册该权限: ${permission}`,
      })
    } else if (options.knownPermissions === undefined && options.allowUnknownPermissions !== true) {
      issues.push({
        path: `$.permissions[${index}]`,
        code: 'unknown-permission',
        message: `未提供权限全集时默认拒收: ${permission}`,
      })
    }
  }

  const contributes = parseContributions(raw.contributes, issues)
  const agentPlugins = parseAgentPlugins(raw.agentPlugins, issues)
  const nativeModules = parseNativeModules(raw.nativeModules, issues)

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    manifest: {
      schemaVersion,
      id: id ?? '',
      name: name ?? '',
      version: version ?? '',
      main: main ?? '',
      activationEvents: readStringArray(raw, 'activationEvents', '$', issues),
      permissions,
      contributes,
      agentPlugins,
      nativeModules,
    },
  }
}

function parseContributions(raw: unknown, issues: ManifestIssue[]): CapabilityContributions {
  const empty: CapabilityContributions = {
    views: [],
    filePreviewers: [],
    chatMentionProviders: [],
    sidebarNavItems: [],
    sessionResources: [],
  }
  if (raw === undefined) return empty
  if (!isRecord(raw)) {
    issues.push({ path: '$.contributes', code: 'type', message: '必须是对象' })
    return empty
  }
  for (const key of Object.keys(raw)) {
    if (!CONTRIBUTION_KEYS.has(key)) {
      issues.push({ path: `$.contributes.${key}`, code: 'unknown-field', message: '未登记的贡献点' })
    }
  }

  const views: CapabilityView[] = []
  const viewIds = new Set<string>()
  const rawViews = raw.views
  if (rawViews !== undefined) {
    if (!Array.isArray(rawViews)) {
      issues.push({ path: '$.contributes.views', code: 'type', message: '必须是数组' })
    } else {
      for (let index = 0; index < rawViews.length; index += 1) {
        const path = `$.contributes.views[${index}]`
        const entry = rawViews[index]
        if (!isRecord(entry)) {
          issues.push({ path, code: 'type', message: '视图必须是对象' })
          continue
        }
        const viewId = readString(entry, 'id', path, issues)
        const viewEntry = readString(entry, 'entry', path, issues)
        const location = entry.location
        if (typeof location !== 'string' || !CAPABILITY_VIEW_LOCATIONS.includes(location as CapabilityViewLocation)) {
          issues.push({
            path: `${path}.location`,
            code: 'unknown-location',
            message: `未登记的视图落点: ${String(location)}`,
          })
          continue
        }
        if (viewId !== undefined) {
          if (viewIds.has(viewId)) {
            issues.push({ path: `${path}.id`, code: 'duplicate', message: `重复视图 id: ${viewId}` })
            continue
          }
          viewIds.add(viewId)
        }
        if (viewId !== undefined && viewEntry !== undefined) {
          views.push({
            id: viewId,
            location: location as CapabilityViewLocation,
            entry: viewEntry,
            ...(typeof entry.title === 'string' ? { title: entry.title } : {}),
          })
        }
      }
    }
  }

  const filePreviewers: CapabilityFilePreviewer[] = []
  const rawPreviewers = raw.filePreviewers
  if (rawPreviewers !== undefined) {
    if (!Array.isArray(rawPreviewers)) {
      issues.push({ path: '$.contributes.filePreviewers', code: 'type', message: '必须是数组' })
    } else {
      for (let index = 0; index < rawPreviewers.length; index += 1) {
        const path = `$.contributes.filePreviewers[${index}]`
        const entry = rawPreviewers[index]
        if (!isRecord(entry)) {
          issues.push({ path, code: 'type', message: '预览器必须是对象' })
          continue
        }
        const previewerId = readString(entry, 'id', path, issues)
        const viewId = readString(entry, 'viewId', path, issues)
        if (viewId !== undefined && !viewIds.has(viewId)) {
          issues.push({
            path: `${path}.viewId`,
            code: 'dangling-reference',
            message: `引用了未声明的视图: ${viewId}`,
          })
        }
        const suffixes = readStringArray(entry, 'filenameSuffixes', path, issues)
        for (let suffixIndex = 0; suffixIndex < suffixes.length; suffixIndex += 1) {
          const suffix = suffixes[suffixIndex]
          if (suffix !== undefined && !suffix.startsWith('.')) {
            issues.push({
              path: `${path}.filenameSuffixes[${suffixIndex}]`,
              code: 'pattern',
              message: `后缀必须以 . 开头: ${suffix}`,
            })
          }
        }
        const refreshPolicy = entry.refreshPolicy
        if (refreshPolicy !== undefined && refreshPolicy !== 'live' && refreshPolicy !== 'onOpen') {
          issues.push({
            path: `${path}.refreshPolicy`,
            code: 'pattern',
            message: `只允许 live / onOpen,收到 ${String(refreshPolicy)}`,
          })
        }
        if (previewerId !== undefined && viewId !== undefined) {
          filePreviewers.push({
            id: previewerId,
            viewId,
            filenameSuffixes: suffixes,
            ...(typeof entry.priority === 'number' ? { priority: entry.priority } : {}),
            ...(refreshPolicy === 'live' || refreshPolicy === 'onOpen' ? { refreshPolicy } : {}),
          })
        }
      }
    }
  }

  return {
    views,
    filePreviewers,
    chatMentionProviders: parseMentionProviders(raw.chatMentionProviders, '$.contributes.chatMentionProviders', issues),
    sidebarNavItems: parseSidebarItems(raw.sidebarNavItems, '$.contributes.sidebarNavItems', issues),
    sessionResources: parseSessionResources(raw.sessionResources, '$.contributes.sessionResources', issues),
  }
}

function forEachContributionEntry(
  raw: unknown,
  path: string,
  issues: ManifestIssue[],
  visit: (entry: Record<string, unknown>, entryPath: string, entryId: string) => void,
): void {
  if (raw === undefined) return
  if (!Array.isArray(raw)) {
    issues.push({ path, code: 'type', message: '必须是数组' })
    return
  }
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index]
    const entryPath = `${path}[${index}]`
    if (!isRecord(entry)) {
      issues.push({ path: entryPath, code: 'type', message: '必须是对象' })
      continue
    }
    const entryId = readString(entry, 'id', entryPath, issues)
    if (entryId === undefined) continue
    visit(entry, entryPath, entryId)
  }
}

function parseMentionProviders(raw: unknown, path: string, issues: ManifestIssue[]): CapabilityMentionProvider[] {
  const output: CapabilityMentionProvider[] = []
  forEachContributionEntry(raw, path, issues, (entry, _entryPath, entryId) => {
    output.push({
      id: entryId,
      ...(typeof entry.title === 'string' ? { title: entry.title } : {}),
      ...(typeof entry.previewViewId === 'string' ? { previewViewId: entry.previewViewId } : {}),
    })
  })
  return output
}

function parseSidebarItems(raw: unknown, path: string, issues: ManifestIssue[]): CapabilitySidebarItem[] {
  const output: CapabilitySidebarItem[] = []
  forEachContributionEntry(raw, path, issues, (entry, entryPath, entryId) => {
    const viewId = readString(entry, 'viewId', entryPath, issues)
    if (viewId === undefined) return
    output.push({ id: entryId, viewId })
  })
  return output
}

function parseSessionResources(raw: unknown, path: string, issues: ManifestIssue[]): CapabilitySessionResource[] {
  const output: CapabilitySessionResource[] = []
  forEachContributionEntry(raw, path, issues, (entry, _entryPath, entryId) => {
    output.push({
      id: entryId,
      ...(typeof entry.previewViewId === 'string' ? { previewViewId: entry.previewViewId } : {}),
    })
  })
  return output
}

function parseAgentPlugins(raw: unknown, issues: ManifestIssue[]): AgentPluginContribution[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    issues.push({ path: '$.agentPlugins', code: 'type', message: '必须是数组' })
    return []
  }
  const output: AgentPluginContribution[] = []
  for (let index = 0; index < raw.length; index += 1) {
    const path = `$.agentPlugins[${index}]`
    const entry = raw[index]
    if (!isRecord(entry)) {
      issues.push({ path, code: 'type', message: '必须是对象' })
      continue
    }
    const type = entry.type
    if (type !== 'local' && type !== 'remote') {
      issues.push({ path: `${path}.type`, code: 'pattern', message: '只允许 local / remote' })
      continue
    }
    const enablement = entry.enablement
    if (enablement !== undefined && !isValidEnablement(enablement, `${path}.enablement`, issues)) continue
    if (type === 'local') {
      const pluginPath = readString(entry, 'path', path, issues)
      if (pluginPath === undefined) continue
      output.push({
        type,
        path: pluginPath,
        ...(enablement === undefined ? {} : { enablement: enablement as EnablementExpression }),
      })
    } else {
      const service = readString(entry, 'service', path, issues)
      if (service === undefined) continue
      output.push({
        type,
        service,
        ...(enablement === undefined ? {} : { enablement: enablement as EnablementExpression }),
      })
    }
  }
  return output
}

function parseNativeModules(raw: unknown, issues: ManifestIssue[]): NativeModuleContribution[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    issues.push({ path: '$.nativeModules', code: 'type', message: '必须是数组' })
    return []
  }
  const output: NativeModuleContribution[] = []
  for (let index = 0; index < raw.length; index += 1) {
    const path = `$.nativeModules[${index}]`
    const entry = raw[index]
    if (!isRecord(entry)) {
      issues.push({ path, code: 'type', message: '必须是对象' })
      continue
    }
    const moduleId = readString(entry, 'id', path, issues, CAPABILITY_ID_PATTERN)
    if (moduleId === undefined) continue
    const lifecycle = entry.lifecycle
    if (lifecycle !== undefined && lifecycle !== 'plugin' && lifecycle !== 'app') {
      issues.push({ path: `${path}.lifecycle`, code: 'pattern', message: '只允许 plugin / app' })
      continue
    }
    const enablement = entry.enablement
    if (enablement !== undefined && !isValidEnablement(enablement, `${path}.enablement`, issues)) continue
    output.push({
      id: moduleId,
      ...(typeof entry.resourceId === 'string' ? { resourceId: entry.resourceId } : {}),
      ...(lifecycle === 'plugin' || lifecycle === 'app' ? { lifecycle } : {}),
      ...(enablement === undefined ? {} : { enablement: enablement as EnablementExpression }),
    })
  }
  return output
}

const ENABLEMENT_TYPES = new Set(['configuration', 'operatingSystem', 'allOf', 'anyOf', 'not'])

/** 递归校验启用条件;返回 false 时已把具体原因写进 issues */
export function isValidEnablement(
  raw: unknown,
  path = '$',
  issues: ManifestIssue[] = [],
  depth = 0,
): boolean {
  if (depth > 8) {
    issues.push({ path, code: 'unknown-enablement', message: '启用条件嵌套过深(疑似构造攻击)' })
    return false
  }
  if (!isRecord(raw)) {
    issues.push({ path, code: 'type', message: '启用条件必须是对象' })
    return false
  }
  const type = raw.type
  if (typeof type !== 'string' || !ENABLEMENT_TYPES.has(type)) {
    issues.push({ path: `${path}.type`, code: 'unknown-enablement', message: `未登记的启用条件: ${String(type)}` })
    return false
  }
  if (type === 'configuration') {
    if (typeof raw.key !== 'string' || raw.key === '') {
      issues.push({ path: `${path}.key`, code: 'type', message: 'key 必须是非空字符串' })
      return false
    }
    return true
  }
  if (type === 'operatingSystem') {
    if (!isRecord(raw.versions)) {
      issues.push({ path: `${path}.versions`, code: 'type', message: 'versions 必须是对象' })
      return false
    }
    for (const [os, range] of Object.entries(raw.versions)) {
      if (os !== 'win32' && os !== 'darwin' && os !== 'linux') {
        issues.push({ path: `${path}.versions`, code: 'pattern', message: `未登记的操作系统: ${os}` })
        return false
      }
      if (typeof range !== 'string' || range === '') {
        issues.push({ path: `${path}.versions.${os}`, code: 'type', message: '版本范围必须是非空字符串' })
        return false
      }
    }
    return true
  }
  if (type === 'not') {
    return isValidEnablement(raw.expression, `${path}.expression`, issues, depth + 1)
  }
  const expressions = raw.expressions
  if (!Array.isArray(expressions) || expressions.length === 0) {
    issues.push({ path: `${path}.expressions`, code: 'type', message: 'expressions 必须是非空数组' })
    return false
  }
  let ok = true
  for (let index = 0; index < expressions.length; index += 1) {
    if (!isValidEnablement(expressions[index], `${path}.expressions[${index}]`, issues, depth + 1)) ok = false
  }
  return ok
}

/**
 * 判定启用条件 —— 未知形状/缺环境一律 false(不猜、不放行)。
 *
 * 配置比较用 `Object.is`;数组/对象用稳定 JSON 比较(键序不影响结果)。
 */
export function evaluateEnablement(
  expression: unknown,
  environment: EnablementEnvironment,
): boolean {
  if (!isRecord(expression)) return false
  const type = expression.type
  if (type === 'configuration') {
    const key = expression.key
    if (typeof key !== 'string' || key === '') return false
    const actual = environment.configuration[key]
    if (!('equals' in expression)) return actual !== undefined
    return stableEqual(actual, expression.equals)
  }
  if (type === 'operatingSystem') {
    const versions = expression.versions
    if (!isRecord(versions)) return false
    const range = versions[environment.os]
    if (typeof range !== 'string') return false
    return satisfiesVersionRange(range, environment.osVersion)
  }
  if (type === 'not') {
    return !evaluateEnablement(expression.expression, environment)
  }
  if (type === 'allOf') {
    const expressions = expression.expressions
    if (!Array.isArray(expressions) || expressions.length === 0) return false
    return expressions.every((item) => evaluateEnablement(item, environment))
  }
  if (type === 'anyOf') {
    const expressions = expression.expressions
    if (!Array.isArray(expressions) || expressions.length === 0) return false
    return expressions.some((item) => evaluateEnablement(item, environment))
  }
  return false
}

function stableEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    return left.every((item, index) => stableEqual(item, right[index]))
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    if (leftKeys.length !== rightKeys.length) return false
    if (!leftKeys.every((key, index) => key === rightKeys[index])) return false
    return leftKeys.every((key) => stableEqual(left[key], right[key]))
  }
  return false
}

/**
 * 极简版本范围:支持 `*`、`>=X.Y[.Z]`、`<=`、`>`、`<`、`=`、`^`、`~`,
 * 以及多个子句用 `,` 组合。
 *
 * 刻意不引入 semver 依赖:清单里的范围只用于"够不够新",不需要预发布排序规则;
 * 解析不出的一律 false,而不是当"满足"。
 *
 * `^` / `~` 的语义按插件清单最常见约定收口:
 * - `^1.2.3` ⇒ `>=1.2.3 <2.0.0`;`^0.2.3` ⇒ `>=0.2.3 <0.3.0`;
 *   `^0.0.3` ⇒ `>=0.0.3 <0.0.4`;
 * - `~1.2.3` / `~1.2` ⇒ `>=1.2.3 <1.3.0`;`~1` ⇒ `>=1.0.0 <2.0.0`。
 *
 * 这里只实现插件启用判断需要的保守上界,不做 npm 的全套 range 语法;
 * 遇到不认识的写法仍返回 false,并保留在清单诊断里。
 */
export function satisfiesVersionRange(range: string, version: string | undefined): boolean {
  if (range.trim() === '*') return true
  if (version === undefined || version === '') return false
  const current = parseVersion(version)
  if (current === undefined) return false
  const clauses = range.split(',').map((clause) => clause.trim()).filter((clause) => clause !== '')
  if (clauses.length === 0) return true
  for (const clause of clauses) {
    const predicates = parseVersionClause(clause)
    if (predicates === undefined) return false
    for (const predicate of predicates) {
      const compared = compareVersion(current, predicate.target)
      if (predicate.operator === '>=' && compared < 0) return false
      if (predicate.operator === '<=' && compared > 0) return false
      if (predicate.operator === '>' && compared <= 0) return false
      if (predicate.operator === '<' && compared >= 0) return false
      if (predicate.operator === '=' && compared !== 0) return false
    }
  }
  return true
}

type VersionOperator = '>=' | '<=' | '>' | '<' | '='

interface VersionPredicate {
  operator: VersionOperator
  target: readonly [number, number, number]
}

/** 把一个子句展开成若干比较谓词;不认识的写法返回 undefined(不是"满足")。 */
function parseVersionClause(clause: string): readonly VersionPredicate[] | undefined {
  const shorthand = /^(\^|~)\s*(\d+(?:\.\d+){0,2})$/.exec(clause)
  if (shorthand !== null) {
    const marker = shorthand[1]
    const targetText = shorthand[2]
    if (marker === undefined || targetText === undefined) return undefined
    const target = parseVersion(targetText)
    if (target === undefined) return undefined
    const parts = targetText.split('.').length
    const upper: readonly [number, number, number] =
      marker === '^'
        ? target[0] > 0
          ? [target[0] + 1, 0, 0]
          : target[1] > 0
            ? [0, target[1] + 1, 0]
            : [0, 0, target[2] + 1]
        : parts <= 1
          ? [target[0] + 1, 0, 0]
          : [target[0], target[1] + 1, 0]
    return [
      { operator: '>=', target },
      { operator: '<', target: upper },
    ]
  }

  const match = /^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})$/.exec(clause)
  if (match === null) return undefined
  const operator = (match[1] ?? '=') as VersionOperator
  const targetText = match[2]
  if (targetText === undefined) return undefined
  const target = parseVersion(targetText)
  if (target === undefined) return undefined
  return [{ operator, target }]
}

function parseVersion(text: string): readonly [number, number, number] | undefined {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim())
  if (match === null) return undefined
  const major = Number(match[1] ?? 0)
  const minor = Number(match[2] ?? 0)
  const patch = Number(match[3] ?? 0)
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return undefined
  return [major, minor, patch]
}

function compareVersion(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    if (a !== b) return a < b ? -1 : 1
  }
  return 0
}
