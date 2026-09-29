// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Markdown 文件链接解析安全链(2026-09-30 立,吸收批次 74 票 G-977966)。
 *
 * 机制吸收自上游 markdown 文件链接解析链与路径工具(上游
 * packages/ui/src/lib/markdownFileLink.ts:15-316、path.ts:5-92),实现为本仓自写
 * 纯函数库:不依赖上游模块,不携带上游协议字段与产品概念。
 *
 * 机制要点(每级 guard 有判据):
 * - 行列号后缀三格式:`路径:行:列` / `路径:行` / `路径#L5(-L10)?`(范围尾部可留),
 *   先剥外围成对引号、再归一反斜杠;
 * - percent-escape 只在路径归一化阶段解码一次:入口提前 decode 会把 `%2520`
 *   变成 `%20`、再被归一化解码成空格,破坏文件名中的字面 escape;
 * - `../` 词法归一拒绝 workspace 逃逸:嵌套回退(`./a/../../x`)在拼接后才逃逸,
 *   只查前导 `../` 不够,须在拼接前做跨平台词法归一、根目录下溢直接拒绝;
 * - `/C:/...` 是 Windows markdown harden 管线内部格式:仅当 workspace 为 Windows
 *   (盘符或反斜杠 UNC)时剥前导斜杠,Unix workspace 一律拒绝;
 * - Unix 系统根目录 allowlist(/Users /etc 等):系统绝对路径绝不能当 markdown 根
 *   相对路径误拼进 workspace;workspace 为 Windows 时这类路径本机不可达,直接拒绝;
 * - file:// URL 解析:Windows 盘符形态去前导斜杠、非 localhost hostname → UNC;
 * - 远程 workspace 的 `/workspace`、`/repo` 类非系统根:链接已在其内则不重复拼接,
 *   其余前导 `/` 按 markdown 根相对处理(harden 会把 `./x` 规范成 `/x`);
 * - `~` 家目录解析:homePath 由调用方注入(渲染层不自行读取本机 Home),
 *   `~user/...` 命名家目录无法安全归属,直接拒绝;
 * - path 工具组:decodeURI 只还原路径文本保留 %2F 分隔符转义;toFileUrl 补转义
 *   # 与 ?(encodeURI 不转义,文件名含 # 会被 URL 解析截断 pathname);
 *   isAbsoluteFilePath 含 UNC;getPathLeaf/getContainingDirectoryPath 盘符根特殊
 *   处理;joinFilePath 按基准路径推断分隔符。
 */

// ---------------------------------------------------------------------------
// path 工具组
// ---------------------------------------------------------------------------

const WINDOWS_DRIVE_PATH_RE = /^[a-zA-Z]:[\\/]/
const UNC_PATH_RE = /^\\\\/
const URI_ESCAPE_RE = /%[0-9A-Fa-f]{2}/

/** 取路径末段(叶子名);反斜杠/正斜杠通吃,全分隔符路径回退原串。 */
export function getPathLeaf(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const segments = normalizedPath.split('/').filter(Boolean)
  return segments.at(-1) ?? path
}

/** 取父目录;盘符根(C:\)是"父目录"而不是叶子,需按盘符根特殊处理返回 `C:\`。 */
export function getContainingDirectoryPath(path: string): string | null {
  const trimmedPath = path.trim().replace(/[\\/]+$/, '')
  if (!trimmedPath) return null

  const lastSeparatorIndex = Math.max(trimmedPath.lastIndexOf('/'), trimmedPath.lastIndexOf('\\'))
  if (lastSeparatorIndex < 0) return null
  // 前导分隔符:父目录就是根分隔符本身(/a → /)。
  if (lastSeparatorIndex === 0) return trimmedPath.charAt(0)

  const parentPath = trimmedPath.slice(0, lastSeparatorIndex)
  // 盘符根特殊处理:C:\f.md 的父目录是 `C:\`(带分隔符),不是 `C:` 也不是 `C:` 下的空。
  if (/^[A-Za-z]:$/.test(parentPath)) {
    return `${parentPath}${trimmedPath.charAt(lastSeparatorIndex)}`
  }
  return parentPath
}

/** 绝对路径判定:Unix 根、Windows 盘符、UNC(`\\srv\share`)都算。 */
export function isAbsoluteFilePath(path: string): boolean {
  return path.startsWith('/') || WINDOWS_DRIVE_PATH_RE.test(path) || UNC_PATH_RE.test(path)
}

/**
 * percent-escape 解码(路径归一化阶段唯一一次解码):
 * 用 decodeURI 只还原路径文本(如 workspace 名里的空格 %20),
 * 保留 %2F 这类分隔符转义 —— 文件名内容不能被误拆成新的路径层级。
 */
export function decodeFilePathUriEscapes(path: string): string {
  if (!URI_ESCAPE_RE.test(path)) return path
  try {
    return decodeURI(path)
  } catch {
    // 畸形 escape 不抛:原样返回,解析链后续 guard 自行拒绝。
    return path
  }
}

/** 拼接路径;分隔符按基准路径推断(纯反斜杠 → `\`,否则 `/`);子路径为绝对路径时直接返回子路径。 */
export function joinFilePath(basePath: string, childPath: string): string {
  if (!childPath) return basePath
  if (isAbsoluteFilePath(childPath)) return childPath

  const separator = basePath.includes('\\') && !basePath.includes('/') ? '\\' : '/'
  const normalizedBasePath = basePath.replace(/[\\/]+$/, '')
  const normalizedChildPath = childPath.replace(/^[\\/]+/, '')
  return `${normalizedBasePath}${separator}${normalizedChildPath}`
}

/**
 * encodeURI 不转义 # 和 ?,但它们在 URL 里是 fragment/query 分隔符:
 * 文件名含 #(如 index#v2.html)时生成的 file URL 会被 URL 解析截断 pathname
 * (只剩 /E:/dir/index),shell 打开必然失败。这里在 encodeURI 之后补转义。
 */
function encodeUriPathForFileUrl(value: string): string {
  return encodeURI(value).replace(/#/g, '%23').replace(/\?/g, '%3F')
}

/** 本地路径 → file URL;盘符/UNC/根/相对四种形态分别处理。 */
export function toFileUrl(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/')

  if (WINDOWS_DRIVE_PATH_RE.test(path)) {
    return `file:///${encodeUriPathForFileUrl(normalizedPath)}`
  }
  // UNC 形态(反斜杠原串或归一后的 //server/...)必须先于"根 / 开头"分支:
  // 否则会落到 `file://` + `//server/...` 产生 file:////server 双前缀。
  if (UNC_PATH_RE.test(path) || normalizedPath.startsWith('//')) {
    return `file:${encodeUriPathForFileUrl(normalizedPath)}`
  }
  if (normalizedPath.startsWith('/')) {
    return `file://${encodeUriPathForFileUrl(normalizedPath)}`
  }
  return encodeUriPathForFileUrl(normalizedPath)
}

/**
 * 相对路径跨平台词法归一:`../` 根目录下溢返回 null(逃逸拒绝)。
 * 判据:嵌套回退在拼接后才逃逸出 workspace,只查前导 `../` 不够,
 * 必须在拼接前归一,发现下溢直接拒绝。
 */
export function normalizeWorkspaceRelativeFilePath(relativePath: string): string | null {
  const segments: string[] = []
  for (const segment of relativePath.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return null
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

// ---------------------------------------------------------------------------
// 引号剥离
// ---------------------------------------------------------------------------

const PATH_QUOTE_PAIRS: Readonly<Record<string, string>> = {
  '"': '"',
  "'": "'",
  '`': '`',
  '“': '”',
  '‘': '’',
}

const PATH_ENCODED_QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['%22', '%22'],
  ['%27', '%27'],
  ['%60', '%60'],
  ['%E2%80%98', '%E2%80%99'],
  ['%E2%80%9C', '%E2%80%9D'],
]

/**
 * 仅去掉路径外围成对引号(直引号/反引号/弯引号及其 percent 编码形态);
 * 不成对时保留原文,避免把异常输出或文件名中的引号静默改写成另一个路径。
 * 额外处理 harden 产物 `/“path”`:仅当剥引号后仍是相对路径时还原保护层。
 */
export function stripBalancedPathQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length < 2) return trimmed

  if (trimmed.startsWith('/')) {
    const protectedRelative = stripBalancedPathQuotes(trimmed.slice(1))
    if (protectedRelative !== trimmed.slice(1)) {
      return protectedRelative.startsWith('./') || protectedRelative.startsWith('/')
        ? protectedRelative
        : `/${protectedRelative}`
    }
  }

  const relativePrefix = trimmed.startsWith('./') ? './' : ''
  const candidate = relativePrefix ? trimmed.slice(2) : trimmed
  if (candidate.length < 2) return trimmed

  const expectedClosing = PATH_QUOTE_PAIRS[candidate.charAt(0)]
  if (expectedClosing !== undefined && expectedClosing === candidate.charAt(candidate.length - 1)) {
    return `${relativePrefix}${candidate.slice(1, -1).trim()}`
  }

  const upperCandidate = candidate.toUpperCase()
  for (const [encodedOpening, encodedClosing] of PATH_ENCODED_QUOTE_PAIRS) {
    if (
      upperCandidate.startsWith(encodedOpening) &&
      upperCandidate.endsWith(encodedClosing) &&
      candidate.length > encodedOpening.length + encodedClosing.length
    ) {
      return `${relativePrefix}${candidate
        .slice(encodedOpening.length, candidate.length - encodedClosing.length)
        .trim()}`
    }
  }
  return trimmed
}

// ---------------------------------------------------------------------------
// 行列号后缀解析 + 路径归一化
// ---------------------------------------------------------------------------

const LINE_AND_COLUMN_SUFFIX_RE = /^(?<path>.+):(?<line>\d+):(?<column>\d+)$/
const LINE_ONLY_SUFFIX_RE = /^(?<path>.+):(?<line>\d+)$/
const HASH_LINE_SUFFIX_RE = /^(?<path>.+)#L(?<line>\d+)(?:-L?\d+)?$/i
const FILE_URL_PROTOCOL_RE = /^file:\/\//i
const SLASHED_WINDOWS_DRIVE_RE = /^\/[a-zA-Z]:\//
const WEB_LIKE_SCHEME_RE = /^([a-zA-Z][a-zA-Z\d+.-]*):/

export interface ParsedMarkdownFileLinkTarget {
  path: string
  line: number | null
  column: number | null
}

/**
 * file:// URL → 本地路径:Windows 盘符形态去前导斜杠(/C:/x → C:/x);
 * 非 localhost hostname 是 UNC 形态(//server/share);畸形 URL 返回 null 交由拒绝。
 */
function parseFileUrlPath(rawPath: string): string | null {
  if (!FILE_URL_PROTOCOL_RE.test(rawPath)) return null
  try {
    const url = new URL(rawPath)
    if (url.protocol !== 'file:') return null

    const decodedPathname = decodeFilePathUriEscapes(url.pathname)
    if (SLASHED_WINDOWS_DRIVE_RE.test(decodedPathname)) {
      return decodedPathname.slice(1)
    }
    if (url.hostname && url.hostname !== 'localhost') {
      return `//${url.hostname}${decodedPathname}`
    }
    return decodedPathname
  } catch {
    return null
  }
}

/** 路径归一化:file:// 展开优先,否则做唯一一次 percent-escape 解码。 */
function normalizeMarkdownFilePath(path: string): string {
  return parseFileUrlPath(path) ?? decodeFilePathUriEscapes(path)
}

function toTarget(
  path: string,
  lineText: string | null,
  columnText: string | null,
): ParsedMarkdownFileLinkTarget {
  return {
    path: normalizeMarkdownFilePath(path),
    line: lineText === null ? null : Number.parseInt(lineText, 10),
    column: columnText === null ? null : Number.parseInt(columnText, 10),
  }
}

/**
 * 目标解析(纯语法层,无 workspace 语境):先剥引号、归一反斜杠,
 * 再依次尝试 `#L行(-行)?` / `:行:列` / `:行` 三种后缀;都不命中时整串即路径。
 * percent-escape 只在此处的归一化阶段解码一次。
 */
export function parseMarkdownFileLinkTarget(rawHref: string): ParsedMarkdownFileLinkTarget {
  const normalizedHref = stripBalancedPathQuotes(rawHref).replace(/\\/g, '/')

  const hashLineMatch = HASH_LINE_SUFFIX_RE.exec(normalizedHref)
  if (hashLineMatch?.groups?.path && hashLineMatch.groups.line) {
    return toTarget(hashLineMatch.groups.path, hashLineMatch.groups.line, null)
  }

  const lineColumnMatch = LINE_AND_COLUMN_SUFFIX_RE.exec(normalizedHref)
  if (lineColumnMatch?.groups?.path && lineColumnMatch.groups.line && lineColumnMatch.groups.column) {
    return toTarget(lineColumnMatch.groups.path, lineColumnMatch.groups.line, lineColumnMatch.groups.column)
  }

  const lineOnlyMatch = LINE_ONLY_SUFFIX_RE.exec(normalizedHref)
  if (lineOnlyMatch?.groups?.path && lineOnlyMatch.groups.line) {
    return toTarget(lineOnlyMatch.groups.path, lineOnlyMatch.groups.line, null)
  }

  return toTarget(normalizedHref, null, null)
}

// ---------------------------------------------------------------------------
// 安全解析链(workspace 语境)
// ---------------------------------------------------------------------------

/** Unix 系统常见根段 allowlist:命中者绝不能被误拼进 workspace。 */
const UNIX_SYSTEM_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
  'Applications',
  'Library',
  'System',
  'Users',
  'Volumes',
  'bin',
  'boot',
  'dev',
  'etc',
  'home',
  'lib',
  'lib64',
  'media',
  'mnt',
  'opt',
  'private',
  'proc',
  'root',
  'run',
  'sbin',
  'srv',
  'sys',
  'tmp',
  'usr',
  'var',
])

export interface MarkdownFileLinkContext {
  /** 当前 workspace 根路径;缺省时只做目标解析,相对路径按归一结果原样返回。 */
  workspacePath?: string
  /** 用户家目录,由调用方(Host)注入;渲染层不自行读取本机 Home。 */
  homePath?: string
}

export interface ParsedMarkdownFileLink {
  path: string
  line?: number
  column?: number
}

function isWindowsAbsolutePath(workspacePath: string): boolean {
  // Windows workspace 既可能是盘符也可能是反斜杠 UNC;`/` 开头是 Unix 系统根。
  return isAbsoluteFilePath(workspacePath) && !workspacePath.startsWith('/')
}

function pathSeparatorOf(basePath: string): string {
  return basePath.includes('\\') && !basePath.includes('/') ? '\\' : '/'
}

function isLikelyUnixSystemAbsolutePath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  const firstSegment = path.slice(1).split('/')[0] ?? ''
  return firstSegment !== '' && UNIX_SYSTEM_ROOT_SEGMENTS.has(firstSegment)
}

function isPathInsideWorkspaceRoot(path: string, workspacePath: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedWorkspacePath = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '')
  return (
    normalizedPath === normalizedWorkspacePath ||
    normalizedPath.startsWith(`${normalizedWorkspacePath}/`)
  )
}

/** `~user/...` 命名家目录:归属到哪个用户的 Home 无从判定,拒绝。 */
function isUnsupportedNamedHomePath(path: string): boolean {
  return /^~[^\\/]+[\\/]/.test(path)
}

/** 家目录链接形态:`~x` 或 `./~/x`(harden 产物)。 */
function isHomeRelativeFilePath(path: string): boolean {
  if (path.startsWith('./~/') || path.startsWith('./~\\')) return true
  return /^~[\\/]/.test(path)
}

/** 非 file:// 的协议链(http:/mailto: 等)不是本地文件链接;单字母"协议"是盘符,不算。 */
function isWebLikeSchemePath(path: string): boolean {
  const match = WEB_LIKE_SCHEME_RE.exec(path)
  if (!match?.[1]) return false
  return match[1].length > 1
}

function containsParentSegment(path: string): boolean {
  return path.replace(/\\/g, '/').split('/').some((segment) => segment === '..')
}

function withTargetPath(target: ParsedMarkdownFileLinkTarget, path: string): ParsedMarkdownFileLink {
  return {
    path,
    ...(target.line !== null ? { line: target.line } : {}),
    ...(target.column !== null ? { column: target.column } : {}),
  }
}

/** 相对路径 → workspace 内绝对路径;词法归一下溢(逃逸)或归一为空时拒绝。 */
function joinWorkspaceRelative(
  target: ParsedMarkdownFileLinkTarget,
  workspacePath: string,
  relativePath: string,
): ParsedMarkdownFileLink | null {
  const normalizedRelativePath = normalizeWorkspaceRelativeFilePath(relativePath)
  if (!normalizedRelativePath) return null
  const separator = pathSeparatorOf(workspacePath)
  return withTargetPath(
    target,
    joinFilePath(workspacePath, normalizedRelativePath.replaceAll('/', separator)),
  )
}

function resolveHomeRelativeFilePath(
  target: ParsedMarkdownFileLinkTarget,
  homePath: string | undefined,
): ParsedMarkdownFileLink | null {
  if (!homePath || !isAbsoluteFilePath(homePath)) return null
  const separator = pathSeparatorOf(homePath)
  // 两级剥前缀:`./~/x` 先去 `./` 再去 `~/`;`~/x` 直接去 `~/`。
  // 单次 slice(2) 会把 `./~/x` 变成 `/~/x` 残留 `~` 段,拼出家目录下的 `~` 子目录。
  const homeChildPath = (target.path.startsWith('./') ? target.path.slice(2) : target.path)
    .slice(2)
    .replace(/[\\/]/g, separator)
  return withTargetPath(target, joinFilePath(homePath, homeChildPath))
}

/**
 * Markdown 文件链接安全解析主入口(raw → 本地可打开路径 | null)。
 * 逐级 guard 见文件头机制要点;任何一级判据不过即整链拒绝,绝不盲目拼接。
 */
export function parseMarkdownFileLink(
  raw: string,
  context: MarkdownFileLinkContext = {},
): ParsedMarkdownFileLink | null {
  const target = parseMarkdownFileLinkTarget(raw)
  const path = target.path
  const workspacePath = context.workspacePath?.trim() || undefined

  if (!path) return null

  // 1) 命名家目录(~user/...):无法安全归属,直接拒绝。
  if (isUnsupportedNamedHomePath(path)) return null

  // 2) 家目录链接(~/x、./~/x):homePath 由调用方注入才解析。
  if (isHomeRelativeFilePath(path)) {
    return resolveHomeRelativeFilePath(target, context.homePath?.trim() || undefined)
  }

  // 3) `/C:/...`:Windows markdown harden 管线内部格式,仅当 workspace 为
  //    Windows(盘符或反斜杠 UNC)时剥前导斜杠;Unix workspace / 无 workspace 拒绝。
  if (SLASHED_WINDOWS_DRIVE_RE.test(path)) {
    if (!workspacePath || !isWindowsAbsolutePath(workspacePath)) return null
    return withTargetPath(target, path.slice(1))
  }

  // 4) 非 file:// 协议链不是本地文件链接(file:// 已在归一化阶段展开)。
  if (isWebLikeSchemePath(path)) return null

  // 5) `//server/...` UNC:与 workspace 相对性无关,原样接受。
  if (path.startsWith('//')) return withTargetPath(target, path)

  // 6) 前导 `/` 的路径:先判 workspace 归属,绝不能盲目当绝对路径、也不能盲目拼 workspace。
  if (path.startsWith('/')) {
    if (!workspacePath) return withTargetPath(target, path)

    // 远程 workspace(/workspace、/repo 类非系统根):链接已在其内则不重复拼接。
    if (isPathInsideWorkspaceRoot(path, workspacePath)) return withTargetPath(target, path)

    // Unix 系统根 allowlist:系统绝对路径不能当 markdown 根相对路径误拼进
    // workspace;workspace 为 Windows 时该路径本机不可达,直接拒绝。
    if (isLikelyUnixSystemAbsolutePath(path)) {
      return isWindowsAbsolutePath(workspacePath) ? null : withTargetPath(target, path)
    }

    // streamdown/rehype-harden 会把 `./x` 规范成 `/x`:这里的前导 `/`
    // 是 markdown 根相对链接,不是系统根目录。
    return joinWorkspaceRelative(target, workspacePath, path.slice(1))
  }

  // 7) 盘符绝对路径(C:/ 或 C:\):与 workspace 无关,原样接受。
  if (isAbsoluteFilePath(path)) return withTargetPath(target, path)

  // 8) 相对路径(./x、x/y、裸文件名、../)。
  if (!workspacePath) {
    // 无 workspace 语境:含 `..` 段的相对路径没有可归属的根,拒绝。
    if (containsParentSegment(path)) return null
    return withTargetPath(target, normalizeWorkspaceRelativeFilePath(path) ?? path)
  }
  return joinWorkspaceRelative(target, workspacePath, path)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
