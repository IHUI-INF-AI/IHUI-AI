// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-673 权限预览 —— 把工具入参抽成 {command, filePaths, scope, fileChanges} 的纯函数出口。
 *
 * 存在的理由(票面原话「`file_path` 漏了预览就只剩标题」):审批弹窗此前直接
 * `JSON.stringify(input)`,既没有键别名(同一件事在不同工具里叫 `path` / `file_path` /
 * `filePath`,漏一族就整族隐身),也没有显示预算(超长列表把弹窗撑爆),更没有"双承载层"
 * 的概念(web 卡片把参数放在 `input`,ACP 卡片放在 `rawInput` —— 只认一个键,另一个承载层
 * 上的同一次调用会被判成"无内容")。
 *
 * 三条不可漂的写法:
 * 1. **键名按归一后的精确别名表匹配,绝不按子串** —— 归一 = 小写 + 去掉非字母数字,
 *    于是 `file_path`/`filePath`/`File Path` 同视,而 `hashtags` 不会命中 `has`、
 *    `pathExists` 不会命中 `path`(同词不同义的误命中比漏一族更难查)。
 * 2. **input / rawInput 两承载层同判** —— 同一份参数,无论从哪一层进来,预览结论必须逐字
 *    等值(这是票面验收的核心,由 tests/permission-preview-g673.test.ts 钉死)。
 * 3. **显示条数有预算** —— 超出预算的条目不进返回值,但数量落在 hidden*Count 上,
 *    渲染层可以说"还有 N 条",不得静默截断成"看起来就这么些"。
 *
 * 本模块是纯函数:不读环境、不取时间、不依赖任何端,三端(web / RN / 小程序)共用同一份判据,
 * 端内只许渲染、不许复制判据(AGENTS §3 共享层优先)。
 */

/** 承载层键名:参数对象挂在外层载荷的这两个键之下(优先级 input → rawInput)。 */
export const PERMISSION_PREVIEW_CARRIER_KEYS = ['input', 'rawInput'] as const

/**
 * 键别名集合(全部按 normalizePermissionPreviewKey 的归一形态书写,自检用例逐条核对)。
 * 刻意收窄:只收"填错/漏了会直接影响用户放行判断"的高频写法,不做模糊扩展。
 */
export const PERMISSION_PREVIEW_KEY_ALIASES = {
  /** 执行类命令 */
  command: ['command', 'cmd'] as const,
  /** 文件路径(含单数/复数与 snake/camel 两书写法) */
  filePaths: ['path', 'paths', 'filepath', 'filepaths', 'filename', 'filenames', 'file', 'files'] as const,
  /** 作用范围(权限域 / 工作目录) */
  scope: ['scope', 'permissionscope', 'accessscope', 'workingdirectory', 'cwd'] as const,
  /** 批量变更数组(元素自身再按下列键分类;`files` 收对象数组形态的批量写文件) */
  changeEntries: ['changes', 'edits', 'diffs', 'filechanges', 'files'] as const,
  /** 变更前内容 ⇒ 与 newContent 组合判 modify/delete */
  oldContent: ['oldstring', 'oldtext', 'before', 'original'] as const,
  /** 变更后内容 ⇒ 单独出现判 create */
  newContent: ['newstring', 'newtext', 'after', 'content', 'text', 'modified'] as const,
} as const

/** 新建文件布尔旗标(写类工具常用 is_new_file / new_file 声明"这是创建")。 */
const NEW_FILE_FLAG_ALIASES = ['isnewfile', 'newfile', 'create'] as const

/** 默认显示预算:每个列表(文件 / 变更)最多渲染的条数。 */
export const PERMISSION_PREVIEW_DEFAULT_MAX_ITEMS = 8

/** 默认命令字符预算:超长命令截断显示并如实标 commandTruncated。 */
export const PERMISSION_PREVIEW_DEFAULT_MAX_COMMAND_CHARS = 4000

/** 文件变更类别:创建 / 修改 / 删除 / 判不出(unknown 不是"没有变更",是"证据不足")。 */
export type PermissionFileChangeKind = 'create' | 'modify' | 'delete' | 'unknown'

/** 一条文件级变更(路径可能取不到,此时 path 为 null,但类别仍按内容键给出)。 */
export interface PermissionFileChange {
  path: string | null
  kind: PermissionFileChangeKind
}

/** 权限预览结果:四维内容 + 预算截断计数 + 一个"到底有没有东西"的硬信号。 */
export interface ToolPermissionPreview {
  command: string | null
  /** 命令是否因字符预算被截断(截断后的前缀仍在 command 里)。 */
  commandTruncated: boolean
  /** 已按预算截断的文件路径列表(完整数量 = filePaths.length + hiddenFileCount)。 */
  filePaths: string[]
  scope: string | null
  /** 已按预算截断的变更列表(完整数量 = fileChanges.length + hiddenChangeCount)。 */
  fileChanges: PermissionFileChange[]
  hiddenFileCount: number
  hiddenChangeCount: number
  /** 四维全空 ⇒ false。渲染层必须据此显示"无可预览内容",不得渲染空白标题。 */
  hasContent: boolean
}

/** 预算覆盖项(渲染侧可按屏幅调小 maxItems;非法值一律回落默认)。 */
export interface ToolPermissionPreviewOptions {
  maxItems?: number
  maxCommandChars?: number
}

/**
 * 键名归一:小写 + 去掉一切非字母数字。`file_path`、`filePath`、`File-Path` 收敛到同一串。
 * 别名表成员必须已经是本函数的不动点(自检逐条核对),所以匹配判据就是**精确相等**。
 */
export function normalizePermissionPreviewKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** 载荷值 → 参数对象:对象直通;JSON 字符串解析后是对象才收;其余为 null。 */
function coerceArgsRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text.startsWith('{')) return null
    try {
      const parsed: unknown = JSON.parse(text)
      return coerceArgsRecord(parsed)
    } catch {
      return null
    }
  }
  return null
}

/**
 * 双承载层取参:先按 input、再按 rawInput 找参数对象;两个承载层都解不出对象时,
 * 把载荷本身当参数(直接喂裸 args 的调用方也走同一条判据 ⇒ 三形态结论同形)。
 */
export function resolvePermissionPreviewArgs(payload: unknown): Record<string, unknown> | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  for (const carrier of PERMISSION_PREVIEW_CARRIER_KEYS) {
    if (!(carrier in record)) continue
    const args = coerceArgsRecord(record[carrier])
    if (args) return args
  }
  return record
}

/** 收集 record 中键名命中别名组的值(保持声明顺序;归一后精确相等)。 */
function pickByAliases(record: Record<string, unknown>, aliases: readonly string[]): unknown[] {
  const hits: unknown[] = []
  for (const [key, value] of Object.entries(record)) {
    if (aliases.includes(normalizePermissionPreviewKey(key))) hits.push(value)
  }
  return hits
}

/** 值 → 非空字符串数组:字符串收成一项;字符串数组逐项收;其余(数字/对象)不猜、不收。 */
function coerceStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? [] : [text]
  }
  if (Array.isArray(value)) {
    const out: string[] = []
    for (const item of value) {
      if (typeof item === 'string' && item.trim() !== '') out.push(item.trim())
    }
    return out
  }
  return []
}

/** 首个非空字符串(command / scope 这类单值维取用)。 */
function firstString(values: unknown[]): string | null {
  for (const value of values) {
    const list = coerceStringList(value)
    if (list.length > 0) return list[0] ?? null
  }
  return null
}

/** 保序去重(文件路径可能同时来自 path 与 files 两键)。 */
function dedupeKeepOrder(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item)
      out.push(item)
    }
  }
  return out
}

/** 内容维命中:别名组里存在任一非空字符串取值(空串不算"有内容")。 */
function hasNonEmptyContent(record: Record<string, unknown>, aliases: readonly string[]): boolean {
  return pickByAliases(record, aliases).some((v) => coerceStringList(v).length > 0)
}

/** 类别推导只留这一份实现:旧+新⇒修改;仅新(或新建旗标)⇒创建;仅旧⇒删除;证据不足⇒unknown。 */
function kindFromFlags(hasOld: boolean, hasNew: boolean, isNewFile: boolean): PermissionFileChangeKind {
  if (hasOld && hasNew) return 'modify'
  if (!hasOld && (hasNew || isNewFile)) return 'create'
  if (hasOld && !hasNew) return 'delete'
  return isNewFile ? 'create' : 'unknown'
}

/** 变更类别(单条变更对象视角)。 */
function classifyChangeKind(record: Record<string, unknown>): PermissionFileChangeKind {
  return kindFromFlags(
    hasNonEmptyContent(record, PERMISSION_PREVIEW_KEY_ALIASES.oldContent),
    hasNonEmptyContent(record, PERMISSION_PREVIEW_KEY_ALIASES.newContent),
    pickByAliases(record, NEW_FILE_FLAG_ALIASES).some((v) => v === true),
  )
}

/** 从单条变更对象里取路径(取第一个命中的 filePaths 别名值;取不到则 null,不猜)。 */
function pathOfChangeItem(record: Record<string, unknown>): string | null {
  return firstString(pickByAliases(record, PERMISSION_PREVIEW_KEY_ALIASES.filePaths))
}

/** 合法的非负整数预算才生效,其余(负数/小数/NaN)回落默认 —— 渲染层调错参数不得把预览清空。 */
function budgetNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

/**
 * 主出口:任意审批载荷(卡片对象 / 裸参数 / 承载层 JSON 串)→ 结构化预览。
 * 不抛异常、不读环境;拿不到的维度诚实为 null/空数组,由 hasContent 汇总。
 */
export function buildToolPermissionPreview(
  payload: unknown,
  options?: ToolPermissionPreviewOptions,
): ToolPermissionPreview {
  const maxItems = budgetNumber(options?.maxItems, PERMISSION_PREVIEW_DEFAULT_MAX_ITEMS)
  const maxCommandChars = budgetNumber(
    options?.maxCommandChars,
    PERMISSION_PREVIEW_DEFAULT_MAX_COMMAND_CHARS,
  )

  const args = resolvePermissionPreviewArgs(payload)
  if (!args) {
    return {
      command: null,
      commandTruncated: false,
      filePaths: [],
      scope: null,
      fileChanges: [],
      hiddenFileCount: 0,
      hiddenChangeCount: 0,
      hasContent: false,
    }
  }

  const rawCommand = firstString(pickByAliases(args, PERMISSION_PREVIEW_KEY_ALIASES.command))
  const command = rawCommand !== null && rawCommand.length > maxCommandChars
    ? rawCommand.slice(0, maxCommandChars)
    : rawCommand
  const commandTruncated = rawCommand !== null && rawCommand.length > maxCommandChars

  const scope = firstString(pickByAliases(args, PERMISSION_PREVIEW_KEY_ALIASES.scope))

  // 变更集合:优先批量数组(changes/edits/diffs);数组里的字符串元素并进文件路径而不是当变更。
  const fileChanges: PermissionFileChange[] = []
  const pathsFromChangeArrays: string[] = []
  for (const value of pickByAliases(args, PERMISSION_PREVIEW_KEY_ALIASES.changeEntries)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>
        fileChanges.push({ path: pathOfChangeItem(record), kind: classifyChangeKind(record) })
      } else if (typeof item === 'string' && item.trim() !== '') {
        pathsFromChangeArrays.push(item.trim())
      }
    }
  }

  // 没有批量数组、但顶层出现新/旧内容键 ⇒ 每个已知路径(或无路径时一条 null)记一次变更。
  if (fileChanges.length === 0) {
    const hasOld = hasNonEmptyContent(args, PERMISSION_PREVIEW_KEY_ALIASES.oldContent)
    const hasNew = hasNonEmptyContent(args, PERMISSION_PREVIEW_KEY_ALIASES.newContent)
    if (hasOld || hasNew) {
      const isNewFile = pickByAliases(args, NEW_FILE_FLAG_ALIASES).some((v) => v === true)
      const kind = kindFromFlags(hasOld, hasNew, isNewFile)
      const carrierPaths = dedupeKeepOrder([
        ...coerceStringListAll(args),
        ...pathsFromChangeArrays,
      ])
      const targets = carrierPaths.length > 0 ? carrierPaths : [null]
      for (const path of targets) fileChanges.push({ path, kind })
    }
  }

  const filePaths = dedupeKeepOrder([
    ...coerceStringListAll(args),
    ...pathsFromChangeArrays,
  ])

  return {
    command,
    commandTruncated,
    filePaths: filePaths.slice(0, maxItems),
    scope,
    fileChanges: fileChanges.slice(0, maxItems),
    hiddenFileCount: Math.max(0, filePaths.length - maxItems),
    hiddenChangeCount: Math.max(0, fileChanges.length - maxItems),
    hasContent: command !== null || filePaths.length > 0 || scope !== null || fileChanges.length > 0,
  }
}

/** 顶层 filePaths 别名值的完整字符串集合(内部复用:伪变更展开与最终列表都按它)。 */
function coerceStringListAll(args: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const value of pickByAliases(args, PERMISSION_PREVIEW_KEY_ALIASES.filePaths)) {
    out.push(...coerceStringList(value))
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
