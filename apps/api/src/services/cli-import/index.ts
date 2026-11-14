// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cli-import 统一入口
 *
 * 提供:
 *   - parseBySource(source, input):选择对应 parser,返回 ImportPreview
 *   - parseByFile(filePath, opts):CLI/Desktop 端按文件路径自动识别 source 并解析
 *   - listParsers():返回 source -> parser 描述(供 UI 列出支持的来源)
 *
 * 生成 previewId 后立即写入 Redis 缓存(10min TTL)。
 * 后续 commit 时用 previewId 取回原始 preview。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CliConfigSource, ImportPreview } from '@ihui/types'

import { generatePreviewId } from './mapper.js'
import { savePreview } from './redis-cache.js'
import { parseCcSwitchJson } from './parsers/cc-switch-json.js'
import { parseCcSwitchSqlite } from './parsers/cc-switch-sqlite.js'
import { parseClaudeCli } from './parsers/claude-cli.js'
import { parseCodexCli } from './parsers/codex-cli.js'
import { parseCodexPlus } from './parsers/codex-plus.js'
import { parseGeminiCli } from './parsers/gemini-cli.js'
import { parseHermes } from './parsers/hermes.js'
import { parseAider } from './parsers/aider.js'
import { parseCline } from './parsers/cline.js'
import { parseCursor } from './parsers/cursor.js'
import { parseEnvFile } from './parsers/env-file.js'
import { parseWindsurf } from './parsers/windsurf.js'
import {
  parseQoder,
  parseQoderWork,
  parseCodexDesktop,
  parseClaudeCodeDesktop,
  parseGithubCopilot,
  parseAmazonQ,
  parseContinue,
  parseTabnine,
  parseCody,
  parseZed,
  parseAntigravity,
} from './parsers/ide-generic.js'
import type { ParserFn, ParserInput, ParserResult } from './parsers/types.js'

interface ParserEntry {
  source: CliConfigSource
  fn: ParserFn
  /** 输入形态:binary / text */
  inputKind: 'binary' | 'text'
  /**
   * 该 parser 接受的扩展名。上传白名单与解析器选择都读这一份(SDB-42),
   * 文本类省略即 TEXT_CONFIG_EXTS,二进制 parser 必须显式声明。
   */
  extensions?: readonly string[]
  /** 二进制输入要求的文件头;声明后 parseBySource 会校验,挡掉改名上传的任意二进制。 */
  magic?: Buffer
  /** 文件名特征(用于 parseByFile 自动识别) */
  filePatterns: RegExp[]
  description: string
}

/** 文本类配置的扩展名;上传白名单与文本 parser 共用,避免两处各写一份判断。 */
const TEXT_CONFIG_EXTS = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf'] as const

/** SQLite 文件头魔数(含结尾 NUL),cc-switch 官方 .db 的容器标识。 */
const SQLITE_MAGIC = Buffer.from('SQLite format 3\u0000', 'binary')

const PARSERS: ParserEntry[] = [
  {
    source: 'cc-switch',
    fn: parseCcSwitchSqlite,
    inputKind: 'binary',
    extensions: ['.db'],
    magic: SQLITE_MAGIC,
    filePatterns: [/cc-switch\.db$/i, /\.db$/i],
    description: 'cc-switch SQLite 数据库',
  },
  {
    source: 'cc-switch',
    fn: parseCcSwitchJson,
    inputKind: 'text',
    extensions: ['.json'],
    filePatterns: [/cc-switch.*\.json$/i, /^config\.json$/i],
    description: 'cc-switch 旧版 config.json',
  },
  {
    source: 'codex++',
    fn: parseCodexPlus,
    inputKind: 'text',
    // SDB-15:只认 codex++ 自己的目录。匹配表按顺序取第一个命中,一旦放宽成任意
    // `settings.json`,就会抢在 claude-cli / cursor / gemini 之前把这些专用配置解析成 0 条。
    filePatterns: [/codex-session-delete[/\\]settings\.json$/i],
    description: 'codex++ BackendSettings',
  },
  {
    source: 'claude-cli',
    fn: parseClaudeCli,
    inputKind: 'text',
    filePatterns: [/\.claude[/\\]settings\.json$/i, /claude.*settings\.json$/i],
    description: 'Claude Code CLI settings.json',
  },
  {
    source: 'codex-cli',
    fn: parseCodexCli,
    inputKind: 'text',
    filePatterns: [/\.codex[/\\]config\.toml$/i, /config\.toml$/i],
    description: 'Codex CLI config.toml',
  },
  {
    source: 'gemini-cli',
    fn: parseGeminiCli,
    inputKind: 'text',
    filePatterns: [/\.gemini[/\\]\.env$/i, /\.gemini[/\\]settings\.json$/i, /^\.env$/i],
    description: 'Gemini CLI .env / settings.json',
  },
  {
    source: 'hermes',
    fn: parseHermes,
    inputKind: 'text',
    filePatterns: [/hermes[/\\]config\.yaml$/i, /hermes.*\.ya?ml$/i, /config\.ya?ml$/i],
    description: 'Hermes config.yaml',
  },
  {
    source: 'env-file',
    fn: parseEnvFile,
    inputKind: 'text',
    filePatterns: [/^\.env$/i, /\.env$/i, /\.env\./i],
    description: '.env 通用环境变量配置',
  },
  {
    source: 'cursor',
    fn: parseCursor,
    inputKind: 'text',
    filePatterns: [/cursor.*settings\.json$/i, /cursor.*models\.json$/i],
    description: 'Cursor IDE AI 配置',
  },
  {
    source: 'windsurf',
    fn: parseWindsurf,
    inputKind: 'text',
    filePatterns: [/windsurf.*settings\.json$/i, /codeium.*settings\.json$/i],
    description: 'Windsurf (Codeium) AI 配置',
  },
  {
    source: 'cline',
    fn: parseCline,
    inputKind: 'text',
    filePatterns: [/cline.*settings\.json$/i, /cline.*\.json$/i],
    description: 'Cline VSCode 扩展配置',
  },
  {
    source: 'aider',
    fn: parseAider,
    inputKind: 'text',
    filePatterns: [/aider.*\.ya?ml$/i, /\.aider\.conf\.ya?ml$/i],
    description: 'Aider AI 配置 YAML',
  },
  {
    source: 'qoder',
    fn: parseQoder,
    inputKind: 'text',
    filePatterns: [/qoder.*settings\.json$/i, /qoder.*\.json$/i],
    description: 'Qoder AI 配置',
  },
  {
    source: 'qoder-work',
    fn: parseQoderWork,
    inputKind: 'text',
    filePatterns: [/qoder-work.*settings\.json$/i, /qoder.work.*\.json$/i],
    description: 'Qoder Work AI 配置',
  },
  {
    source: 'codex-desktop',
    fn: parseCodexDesktop,
    inputKind: 'text',
    filePatterns: [/codex.*desktop.*\.json$/i, /codex.*config.*\.json$/i],
    description: 'Codex Desktop 配置',
  },
  {
    source: 'claude-code-desktop',
    fn: parseClaudeCodeDesktop,
    inputKind: 'text',
    filePatterns: [/claude.*desktop.*\.json$/i, /claude.*config.*\.json$/i],
    description: 'Claude Code Desktop 配置',
  },
  {
    source: 'github-copilot',
    fn: parseGithubCopilot,
    inputKind: 'text',
    filePatterns: [/copilot.*settings\.json$/i, /github.*copilot.*\.json$/i],
    description: 'GitHub Copilot 配置',
  },
  {
    source: 'amazon-q',
    fn: parseAmazonQ,
    inputKind: 'text',
    filePatterns: [/amazon.*q.*\.json$/i, /aws.*q.*\.json$/i],
    description: 'Amazon Q Developer 配置',
  },
  {
    source: 'continue',
    fn: parseContinue,
    inputKind: 'text',
    filePatterns: [/continue.*config.*\.json$/i, /\.continue.*\.json$/i],
    description: 'Continue.dev 配置',
  },
  {
    source: 'tabnine',
    fn: parseTabnine,
    inputKind: 'text',
    filePatterns: [/tabnine.*settings\.json$/i, /tabnine.*\.json$/i],
    description: 'Tabnine 配置',
  },
  {
    source: 'cody',
    fn: parseCody,
    inputKind: 'text',
    filePatterns: [/cody.*settings\.json$/i, /sourcegraph.*\.json$/i],
    description: 'Sourcegraph Cody 配置',
  },
  {
    source: 'zed',
    fn: parseZed,
    inputKind: 'text',
    filePatterns: [/zed.*settings\.json$/i, /zed.*\.json$/i],
    description: 'Zed 编辑器 AI 配置',
  },
  {
    source: 'antigravity',
    fn: parseAntigravity,
    inputKind: 'text',
    filePatterns: [
      /antigravity.*settings\.json$/i,
      /antigravity.*\.json$/i,
      /antigravity.*config.*\.json$/i,
    ],
    description: 'Google Antigravity (Gemini) 配置',
  },
]

/** parser 实际允许的扩展名:显式声明优先,文本类回落到 TEXT_CONFIG_EXTS。 */
function entryExtensions(entry: ParserEntry): readonly string[] {
  return entry.extensions ?? TEXT_CONFIG_EXTS
}

/**
 * 列出所有支持的来源(去重,用于 UI 展示)。
 */
export function listSupportedSources(): Array<{
  source: CliConfigSource
  description: string
}> {
  const seen = new Set<CliConfigSource>()
  const result: Array<{ source: CliConfigSource; description: string }> = []
  for (const p of PARSERS) {
    if (seen.has(p.source)) continue
    seen.add(p.source)
    result.push({ source: p.source, description: p.description })
  }
  return result
}

/**
 * 上传配置文件的扩展名白名单(路由侧复用,单一真相源)。
 *
 * 汇总 PARSERS 各自声明的 extensions,不在此另写清单:`.db` 是 cc-switch 官方
 * SQLite 库的扩展名(SDB-42),漏掉即等同于 cc-switch 导入下线;白名单与解析器
 * 选择同源后,新增来源时白名单自动跟上,不会再出现"能选 parser 却传不上来"。
 */
export const CONFIG_UPLOAD_ALLOWED_EXTS: readonly string[] = [
  ...new Set(PARSERS.flatMap((p) => entryExtensions(p))),
]

/** 取小写扩展名;无扩展名返回空串。 */
function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i >= 0 ? fileName.slice(i).toLowerCase() : ''
}

/** 按文件名判定是否允许上传;无扩展名一律拒(判不出解析器,也不该放行任意二进制)。 */
export function isAllowedConfigUpload(fileName: string): boolean {
  const ext = extOf(fileName)
  return ext !== '' && CONFIG_UPLOAD_ALLOWED_EXTS.includes(ext)
}

/**
 * 上传前置判定(路由唯一入口):按「来源 + 扩展名」确认这条上传能落到确定解析器。
 *
 * 返回 null 表示可继续解析,否则是可直接回给用户的中文原因。白名单与解析器选择
 * 同源于 PARSERS,路由不再自行按 source 猜二进制/文本。
 */
export function describeUploadRejection(source: CliConfigSource, fileName: string): string | null {
  if (!isAllowedConfigUpload(fileName)) {
    return `仅支持配置文件格式: ${CONFIG_UPLOAD_ALLOWED_EXTS.join(', ')}`
  }
  try {
    pickParserBySource(source, fileName)
    return null
  } catch (err) {
    return (err as Error).message
  }
}

/**
 * 根据 source 选择 parser:先按扩展名,再按文件名特征。
 *
 * SDB-42:同 source 多 parser 时只认扩展名/文件名,判不出就明确拒绝——
 * 旧实现"匹配不到回退第一条"会把 cc-switch 的 config.json 送进 SQLite 解析器。
 */
function pickParserBySource(source: CliConfigSource, sourcePath?: string): ParserEntry {
  const candidates = PARSERS.filter((p) => p.source === source)
  const single = candidates[0]
  if (candidates.length === 1 && single) return single
  if (candidates.length === 0) {
    throw new Error(`不支持的导入来源: ${source}`)
  }

  const ext = extOf(sourcePath ?? '')
  if (ext) {
    const byExt = candidates.find((p) => entryExtensions(p).includes(ext))
    if (byExt) return byExt
  }

  const base = path.basename(sourcePath ?? '').toLowerCase()
  const normalized = (sourcePath ?? '').replace(/\\/g, '/').toLowerCase()
  if (base) {
    const byPattern = candidates.find((p) =>
      p.filePatterns.some((re) => re.test(base) || re.test(normalized)),
    )
    if (byPattern) return byPattern
  }

  const supported = candidates
    .map((p) => `${entryExtensions(p).join('/')}(${p.description})`)
    .join(' 或 ')
  throw new Error(`${source} 无法从文件名判定输入形态,支持: ${supported}`)
}

/**
 * 按显式 source 解析。
 *
 * input.text 或 input.buffer 必须二选一。
 * 返回 ImportPreview 并已写入 Redis 缓存。
 *
 * ownerUuid 为缓存归属用户(F-74):preview 只能在同 owner 下被取回;
 * 缺省时不落缓存(parse-by-source 的纯解析调用与测试场景),避免产生无主条目。
 */
export async function parseBySource(
  source: CliConfigSource,
  input: Omit<ParserInput, 'sourcePath'> & { sourcePath: string },
  ownerUuid?: string,
): Promise<ImportPreview> {
  const entry = pickParserBySource(source, input.sourcePath)
  const fullInput: ParserInput = {
    ...input,
    sourcePath: input.sourcePath,
  }
  // 兼容:inputKind=binary 但调用方只给 text 时,转 Buffer
  if (entry.inputKind === 'binary' && !fullInput.buffer && fullInput.text) {
    fullInput.buffer = Buffer.from(fullInput.text, 'base64')
    fullInput.text = undefined
  }
  if (entry.inputKind === 'text' && !fullInput.text && fullInput.buffer) {
    fullInput.text = fullInput.buffer.toString('utf8')
    fullInput.buffer = undefined
  }
  // `.db` 白名单一旦放开,任意二进制都能顶着这个扩展名进来;按 parser 声明的
  // 文件头先验一次容器,把"改名上传"挡在解析器之前(sql.js 内部报错文案不可读)。
  if (entry.magic && fullInput.buffer) {
    const head = fullInput.buffer.subarray(0, entry.magic.length)
    if (!head.equals(entry.magic)) {
      throw new Error(
        `文件内容不是有效的 SQLite 数据库(${entry.description}),请上传 cc-switch 的 .db 文件`,
      )
    }
  }
  const result: ParserResult = await entry.fn(fullInput)
  const previewId = generatePreviewId()
  const preview: ImportPreview = {
    previewId,
    source,
    sourcePath: input.sourcePath,
    sourceVersion: result.sourceVersion,
    detectedAt: new Date().toISOString(),
    providers: result.providers,
    mcpServers: result.mcpServers,
    globalWarnings: result.globalWarnings,
  }
  if (ownerUuid) {
    await savePreview(preview, ownerUuid)
  }
  return preview
}

/**
 * 按文件路径自动识别 source 并解析(CLI/Desktop 用)。
 *
 * - 根据 basename + parent dir 匹配 filePatterns
 * - 找不到匹配抛错
 * - 找到匹配读取文件并调用对应 parser
 * - 对 codex-cli,自动尝试读取同目录的 auth.json
 * - 对 gemini-cli,自动尝试读取同目录的 settings.json
 */
export async function parseByFile(filePath: string): Promise<ImportPreview> {
  const basename = path.basename(filePath)
  const normalized = filePath.replace(/\\/g, '/')
  const entry = PARSERS.find((p) =>
    p.filePatterns.some((re) => re.test(basename) || re.test(normalized)),
  )
  if (!entry) {
    throw new Error(`无法识别文件来源: ${filePath}(请用 parseBySource 显式指定 source)`)
  }
  const buffer = await readFile(filePath)
  const input: ParserInput = {
    sourcePath: filePath,
    buffer: entry.inputKind === 'binary' ? buffer : undefined,
    text: entry.inputKind === 'text' ? buffer.toString('utf8') : undefined,
  }

  // codex-cli 自动读取 auth.json
  if (entry.source === 'codex-cli') {
    const authJsonPath = path.join(path.dirname(filePath), 'auth.json')
    try {
      const authBuf = await readFile(authJsonPath)
      input.extra = { authJsonText: authBuf.toString('utf8') }
    } catch {
      /* auth.json 不存在,parser 内部标 warning */
    }
  }

  // gemini-cli 自动读取 settings.json
  if (entry.source === 'gemini-cli' && basename === '.env') {
    const settingsPath = path.join(path.dirname(filePath), 'settings.json')
    try {
      const sBuf = await readFile(settingsPath)
      input.extra = { settingsJsonText: sBuf.toString('utf8') }
    } catch {
      /* 可选 */
    }
  }

  return parseBySource(entry.source, input)
}

export type { ParserInput, ParserResult } from './parsers/types.js'
export { parseCcSwitchSqlite } from './parsers/cc-switch-sqlite.js'
export { parseCcSwitchJson } from './parsers/cc-switch-json.js'
export { parseCodexPlus } from './parsers/codex-plus.js'
export { parseClaudeCli } from './parsers/claude-cli.js'
export { parseCodexCli } from './parsers/codex-cli.js'
export { parseGeminiCli } from './parsers/gemini-cli.js'
export { parseHermes } from './parsers/hermes.js'
export { parseEnvFile } from './parsers/env-file.js'
export { parseCursor } from './parsers/cursor.js'
export { parseWindsurf } from './parsers/windsurf.js'
export { parseCline } from './parsers/cline.js'
export { parseAider } from './parsers/aider.js'
export {
  detectSources,
  getExpectedPaths,
  hasSourceInstalled,
  fileExists,
  checkFileMeta,
} from './detector.js'
export { savePreview, loadPreview, deletePreview } from './redis-cache.js'
export {
  inferProviderCode,
  deduplicateName,
  normalizeProvider,
  sanitizeProviderName,
  generatePreviewId,
  inferSourceVersion,
} from './mapper.js'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
