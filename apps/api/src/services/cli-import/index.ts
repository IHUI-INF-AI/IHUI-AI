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
import type { ParserFn, ParserInput, ParserResult } from './parsers/types.js'

interface ParserEntry {
  source: CliConfigSource
  fn: ParserFn
  /** 输入形态:binary / text */
  inputKind: 'binary' | 'text'
  /** 文件名特征(用于 parseByFile 自动识别) */
  filePatterns: RegExp[]
  description: string
}

const PARSERS: ParserEntry[] = [
  {
    source: 'cc-switch',
    fn: parseCcSwitchSqlite,
    inputKind: 'binary',
    filePatterns: [/cc-switch\.db$/i, /\.db$/i],
    description: 'cc-switch SQLite 数据库',
  },
  {
    source: 'cc-switch',
    fn: parseCcSwitchJson,
    inputKind: 'text',
    filePatterns: [/cc-switch.*\.json$/i, /^config\.json$/i],
    description: 'cc-switch 旧版 config.json',
  },
  {
    source: 'codex++',
    fn: parseCodexPlus,
    inputKind: 'text',
    filePatterns: [/codex-session-delete[/\\]settings\.json$/i, /settings\.json$/i],
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
]

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
 * 根据 source 选择第一个匹配的 parser(同 source 多 parser 时取第一个)。
 */
function pickParserBySource(source: CliConfigSource): ParserEntry {
  const entry = PARSERS.find((p) => p.source === source)
  if (!entry) {
    throw new Error(`不支持的导入来源: ${source}`)
  }
  return entry
}

/**
 * 按显式 source 解析。
 *
 * input.text 或 input.buffer 必须二选一。
 * 返回 ImportPreview 并已写入 Redis 缓存。
 */
export async function parseBySource(
  source: CliConfigSource,
  input: Omit<ParserInput, 'sourcePath'> & { sourcePath: string },
): Promise<ImportPreview> {
  const entry = pickParserBySource(source)
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
  await savePreview(preview)
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
