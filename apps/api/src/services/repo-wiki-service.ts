// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Repo Wiki 生成服务 (2026-09-07 新增,Repo Wiki MVP)
 *
 * 输入前端收集的工作区文件清单({path, content}[])→ 输出"仓库总览 + 模块文档"并落库。
 *
 * 流程:
 * 1. 预算控制(budgetRepoFiles 纯函数):
 *    - 按路径首段分组出顶层模块,每模块挑内容最长的 ≤8 个文件
 *    - 单文件截断 8KB,全请求总量截断 ~120KB(超出预算的模块整体跳过)
 * 2. LLM 调用 1+1 次(经 ai-service /api/llm/complete,非流式):
 *    - overview:架构综述/技术栈/目录结构解读/模块关系
 *    - 每个重点模块(≤6 个,按采样体积降序)一篇 module 文档:职责/关键文件解读/对外接口/风险点
 *    - overview 失败直接 throw(route 层转 502);逐模块失败不阻断,记 warn 跳过
 * 3. 全部落 repo_wiki_docs 表,返回 {docs, skippedModules}。
 */

import { db } from '../db/index.js'
import { repoWikiDocs } from '@ihui/database'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { logger } from './clawdbot/logger.js'

// =============================================================================
// 常量
// =============================================================================

/** 单文件内容截断上限(8KB) */
const MAX_FILE_CHARS = 8 * 1024
/** 单模块最多采样文件数 */
const MAX_FILES_PER_MODULE = 8
/** 全请求总字符预算(~120KB) */
const MAX_TOTAL_CHARS = 120 * 1024
/** 最多生成模块文档数 */
const MAX_MODULE_DOCS = 6
/** LLM 调用超时(120s) */
const LLM_TIMEOUT_MS = 120_000
/** 默认模型(可用 env AI_REPO_WIKI_MODEL 覆盖) */
const DEFAULT_MODEL = process.env.AI_REPO_WIKI_MODEL || 'gpt-4o-mini'
/** 目录树最多行数(防超大仓库撑爆 prompt) */
const MAX_TREE_LINES = 500

// =============================================================================
// 类型
// =============================================================================

/** 前端收集的工作区文件 */
export interface RepoWikiFile {
  path: string
  content: string
}

/** 按顶层模块分组后的文件集合 */
export interface RepoWikiModule {
  /** 模块名(路径首段;根目录文件归入 '(root)') */
  name: string
  files: RepoWikiFile[]
  /** 本模块全部采样内容的字符总量(用于排序与预算) */
  totalChars: number
}

/** 预算分组结果(纯函数输出,不涉及 IO) */
export interface RepoWikiBudgetResult {
  /** 预算内的模块(按采样体积降序) */
  modules: RepoWikiModule[]
  /** 超出总预算被整体跳过的模块名 */
  skippedModules: string[]
  /** 预算内文件总数 */
  fileCount: number
}

/**
 * 模块依赖边(P1-8 2026-09-13 立)。
 * from/to 均为顶层模块名(规则同 budgetRepoFiles:路径首段;无 '/' → '(root)'),
 * count 为该依赖在源码中被引用的次数。
 */
export interface RepoWikiModuleEdge {
  from: string
  to: string
  count: number
}

export interface GenerateRepoWikiInput {
  /** 所属用户(NULL = 全局 wiki) */
  userId: string | null
  repoName: string
  model?: string
  files: RepoWikiFile[]
}

export interface RepoWikiDocRef {
  id: string
  kind: 'overview' | 'module'
  title: string
  modulePath: string | null
}

export interface GenerateRepoWikiResult {
  docs: RepoWikiDocRef[]
  skippedModules: string[]
  /** P1-8(2026-09-13 立):确定性静态解析出的模块依赖边(纯新增字段,非 LLM 推断) */
  edges: RepoWikiModuleEdge[]
}

/** LLM 调用函数签名(可注入 mock) */
export type WikiLlmCaller = (
  systemPrompt: string,
  userContent: string,
) => Promise<{ content: string; model: string | null }>

// =============================================================================
// 预算分组(纯函数)
// =============================================================================

/**
 * 文件预算分组:
 * 1. 单文件截断 8KB → 2. 按路径首段分组 → 3. 每模块取内容最长的 ≤8 个文件
 * → 4. 模块按采样体积降序,贪心装入 120KB 总预算,装不下的模块整体跳过。
 */
export function budgetRepoFiles(files: RepoWikiFile[]): RepoWikiBudgetResult {
  // 1. 单文件截断 + 2. 分组(路径首段;无 '/' 的根目录文件归入 '(root)')
  const byModule = new Map<string, RepoWikiFile[]>()
  for (const f of files) {
    const content =
      f.content.length > MAX_FILE_CHARS ? f.content.slice(0, MAX_FILE_CHARS) : f.content
    const name = f.path.includes('/') ? f.path.slice(0, f.path.indexOf('/')) : '(root)'
    const bucket = byModule.get(name)
    if (bucket) bucket.push({ path: f.path, content })
    else byModule.set(name, [{ path: f.path, content }])
  }

  // 3. 每模块挑内容最长的 ≤8 个文件
  const modules: RepoWikiModule[] = []
  for (const [name, allFiles] of byModule) {
    const picked = [...allFiles]
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, MAX_FILES_PER_MODULE)
    modules.push({
      name,
      files: picked,
      totalChars: picked.reduce((sum, f) => sum + f.content.length, 0),
    })
  }

  // 4. 模块按采样体积降序,贪心装入总预算
  modules.sort((a, b) => b.totalChars - a.totalChars)
  const kept: RepoWikiModule[] = []
  const skippedModules: string[] = []
  let used = 0
  for (const m of modules) {
    if (used + m.totalChars <= MAX_TOTAL_CHARS) {
      kept.push(m)
      used += m.totalChars
    } else {
      skippedModules.push(m.name)
    }
  }

  return {
    modules: kept,
    skippedModules,
    fileCount: kept.reduce((sum, m) => sum + m.files.length, 0),
  }
}

// =============================================================================
// 模块依赖图(纯函数,确定性静态解析;非 LLM 推断)
// =============================================================================

/** 模块归属规则(与 budgetRepoFiles 完全一致):路径首段;无 '/' → '(root)' */
function moduleOfPath(path: string): string {
  return path.includes('/') ? path.slice(0, path.indexOf('/')) : '(root)'
}

/** 相对导入去/补扩展名时尝试的扩展名(按此顺序匹配,取首个命中) */
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'] as const

/** JS/TS 导入候选:import ... from 'x' / import 'x' / require('x') */
const JS_IMPORT_PATTERNS = [
  /from\s*['"]([^'"]+)['"]/g,
  /import\s*['"]([^'"]+)['"]/g,
  /require\(\s*['"]([^'"]+)['"]/g,
] as const

/**
 * Python 导入候选:from x import y / import x。
 * 仅对 .py 文件应用——否则 TS 默认导入 `import foo from 'bar'` 会被 `import x` 规则
 * 误捕获为说明符 `foo`,引入不确定的假边。
 */
const PY_IMPORT_PATTERNS = [
  /^\s*from\s+([A-Za-z_][\w.]*)\s+import\b/gm,
  /^\s*import\s+([A-Za-z_][\w.]*)/gm,
] as const

/** 归一化仓库内相对路径:折叠空段与 '.',处理 '..' 回退 */
function normalizeRepoPath(path: string): string {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

/** 收集单个文件内容中的候选导入说明符(按扩展名选择语言对应的规则集) */
function collectImportSpecifiers(path: string, content: string): string[] {
  const patterns = path.toLowerCase().endsWith('.py') ? PY_IMPORT_PATTERNS : JS_IMPORT_PATTERNS
  const specifiers: string[] = []
  for (const re of patterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      const spec = m[1]
      if (spec) specifiers.push(spec)
      // 防零宽匹配导致死循环
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  return specifiers
}

/**
 * 解析相对导入:以导入文件所在目录拼接后归一化,再依次尝试
 * 「原样路径 / 补扩展名 / 补 /index.*」匹配已知文件路径集合。
 * 命中返回被导入文件路径,未命中返回 null。
 */
function resolveRelativeImport(
  fromPath: string,
  specifier: string,
  knownPaths: Set<string>,
): string | null {
  const dir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : ''
  const base = normalizeRepoPath(dir ? `${dir}/${specifier}` : specifier)
  if (!base) return null
  if (knownPaths.has(base)) return base
  for (const ext of RESOLVE_EXTENSIONS) {
    if (knownPaths.has(base + ext)) return base + ext
  }
  for (const ext of RESOLVE_EXTENSIONS) {
    const indexPath = `${base}/index${ext}`
    if (knownPaths.has(indexPath)) return indexPath
  }
  return null
}

/**
 * 从源码文件提取模块级依赖边(确定性静态解析,非 LLM 推断)。
 *
 * 规则:
 * - 模块归属与 budgetRepoFiles 一致:path 首段;无 '/' → '(root)'
 * - 相对导入(以 '.' 开头):按导入文件目录解析、归一化 '..'/'.',去扩展名后与
 *   已知文件路径匹配(补 .ts/.tsx/.js/.jsx/.mjs/.cjs/.py 及 /index.*),命中才计边
 * - 非相对导入:说明符首段(按 '/' 与 '.' 切分)命中仓库内已知顶层模块才计边,
 *   否则视为外部依赖跳过(如 react / @ihui/xxx)
 * - 丢弃自环(from === to);按 from+to 聚合 count;
 *   排序:count 降序 → from 升序 → to 升序
 * - 入参为空数组 → 返回 [],不抛异常
 */
export function extractImportEdges(files: RepoWikiFile[]): RepoWikiModuleEdge[] {
  if (files.length === 0) return []
  const knownPaths = new Set<string>(files.map((f) => f.path))
  const knownModules = new Set<string>(files.map((f) => moduleOfPath(f.path)))
  const counter = new Map<string, RepoWikiModuleEdge>()

  for (const f of files) {
    const from = moduleOfPath(f.path)
    for (const spec of collectImportSpecifiers(f.path, f.content)) {
      let to: string | null = null
      if (spec.startsWith('.')) {
        const resolved = resolveRelativeImport(f.path, spec, knownPaths)
        if (resolved) to = moduleOfPath(resolved)
      } else {
        // Python 点分模块(pkg.sub)与 JS 路径(apps/api)统一按首段归属顶层模块
        const firstSeg = spec.split(/[./]/)[0]
        if (firstSeg && knownModules.has(firstSeg)) to = firstSeg
      }
      if (!to || to === from) continue
      const key = `${from}\u0000${to}`
      const existing = counter.get(key)
      if (existing) existing.count++
      else counter.set(key, { from, to, count: 1 })
    }
  }

  return [...counter.values()].sort(
    (a, b) =>
      b.count - a.count ||
      (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) ||
      (a.to < b.to ? -1 : a.to > b.to ? 1 : 0),
  )
}

/** mermaid 节点:普通标识符直接用 id,含特殊字符(如 '(root)')时 id 也加引号;label 一律双引号包裹 */
function mermaidNode(name: string): string {
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const label = `"${escaped}"`
  const id = /^[A-Za-z0-9_]+$/.test(name) ? name : `"${escaped}"`
  return `${id}[${label}]`
}

/** 转义 Markdown 表格单元格(竖线与换行会破坏表格结构) */
function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

/** 依赖图最多展示的边数(超出仅保留 count 最高的 N 条并追加说明) */
const MAX_GRAPH_EDGES = 60

/**
 * 将模块依赖边渲染为 Markdown 章节(mermaid 图 + 表格)。
 * edges 为空 → 返回 ''(调用方据此决定不追加章节);纯函数,无副作用、无 I/O。
 */
export function renderDependencyGraph(edges: RepoWikiModuleEdge[]): string {
  if (edges.length === 0) return ''
  const shown = edges.slice(0, MAX_GRAPH_EDGES)
  const truncated = edges.length > MAX_GRAPH_EDGES
  const lines: string[] = []
  lines.push('## 模块依赖图')
  lines.push('')
  lines.push('由源码 import / require 静态解析得出（确定性生成，非 LLM 推断）。')
  lines.push('')
  lines.push('```mermaid')
  lines.push('graph LR')
  for (const e of shown) {
    lines.push(`  ${mermaidNode(e.from)} --> ${mermaidNode(e.to)}`)
  }
  lines.push('```')
  lines.push('')
  lines.push('| 模块 | 依赖 | 引用数 |')
  lines.push('| --- | --- | --- |')
  for (const e of shown) {
    lines.push(`| ${escapeTableCell(e.from)} | ${escapeTableCell(e.to)} | ${e.count} |`)
  }
  if (truncated) {
    lines.push('')
    lines.push(`（仅显示引用数最高的 ${MAX_GRAPH_EDGES} 条）`)
  }
  return lines.join('\n')
}

// =============================================================================
// Prompt 构造(纯函数)
// =============================================================================

function buildFileTree(files: RepoWikiFile[]): string {
  return files
    .map((f) => f.path)
    .slice(0, MAX_TREE_LINES)
    .join('\n')
}

function buildOverviewUserContent(
  repoName: string,
  files: RepoWikiFile[],
  budget: RepoWikiBudgetResult,
): string {
  const parts: string[] = []
  parts.push(`仓库名:${repoName}`)
  parts.push('')
  parts.push('## 文件清单(目录结构)')
  parts.push(buildFileTree(files))
  parts.push('')
  parts.push('## 各模块抽样文件内容')
  for (const m of budget.modules) {
    parts.push('')
    parts.push(`### 模块:${m.name}`)
    for (const f of m.files) {
      parts.push('')
      parts.push(`#### ${f.path}`)
      parts.push('```')
      parts.push(f.content)
      parts.push('```')
    }
  }
  return parts.join('\n')
}

function buildModuleUserContent(repoName: string, m: RepoWikiModule): string {
  const parts: string[] = []
  parts.push(`仓库名:${repoName}`)
  parts.push(`模块名:${m.name}`)
  parts.push('')
  parts.push('## 模块内抽样文件内容')
  for (const f of m.files) {
    parts.push('')
    parts.push(`### ${f.path}`)
    parts.push('```')
    parts.push(f.content)
    parts.push('```')
  }
  return parts.join('\n')
}

const OVERVIEW_SYSTEM_PROMPT = [
  '你是资深软件架构师,负责为代码仓库生成 Repo Wiki 总览文档。',
  '要求:',
  '- 只依据用户提供的文件清单与抽样内容分析,禁止编造不存在的文件、目录或依赖。',
  '- 输出简体中文,Markdown 格式。',
  '- 必须包含以下章节(用二级标题):架构综述、技术栈、目录结构解读、模块关系。',
  '- 信息不足时明确说明"依据现有文件无法判断",不要臆测。',
].join('\n')

const MODULE_SYSTEM_PROMPT = [
  '你是资深软件工程师,负责为代码仓库的单个模块生成 Wiki 文档。',
  '要求:',
  '- 只依据用户提供的抽样文件内容分析,禁止编造不存在的文件、函数或接口。',
  '- 输出简体中文,Markdown 格式。',
  '- 必须包含以下章节(用二级标题):模块职责、关键文件解读、对外接口、风险点。',
  '- 信息不足时明确说明"依据现有文件无法判断",不要臆测。',
].join('\n')

// =============================================================================
// LLM 调用
// =============================================================================

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/**
 * 默认 LLM 调用:经 ai-service /api/llm/complete(非流式)。
 * 响应契约:{content, model, usage, stub, error?, error_message?}。
 * HTTP/服务层失败直接 throw(调用方决定是否阻断)。
 */
const defaultWikiLlmCaller: WikiLlmCaller = async (systemPrompt, userContent) => {
  const model = process.env.AI_REPO_WIKI_MODEL || DEFAULT_MODEL
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const res = await aiServiceFetch(null, '/api/llm/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`ai-service /api/llm/complete HTTP ${res.status}: ${errText.slice(0, 200)}`)
    }
    const json = (await res.json()) as {
      content?: string
      model?: string
      error?: boolean
      error_message?: string
      stub?: boolean
    }
    if (json.error || json.stub) {
      throw new Error(json.error_message ?? `LLM 调用失败(model=${model})`)
    }
    const content = (json.content ?? '').trim()
    if (!content) throw new Error('LLM 返回内容为空')
    return { content, model: json.model ?? model }
  } catch (e) {
    if (isAbortError(e)) throw new Error('LLM 调用超时(120s)')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// =============================================================================
// 主流程
// =============================================================================

/**
 * 生成 Repo Wiki(仓库总览 + 模块文档)并落库。
 *
 * @param input 前端收集的文件清单
 * @param deps 可选依赖注入(callLlm 供测试 mock,不真网)
 */
export async function generateRepoWiki(
  input: GenerateRepoWikiInput,
  deps?: { callLlm?: WikiLlmCaller },
): Promise<GenerateRepoWikiResult> {
  const callLlm = deps?.callLlm ?? defaultWikiLlmCaller

  // 1. 预算分组
  const budget = budgetRepoFiles(input.files)
  if (budget.modules.length === 0) {
    throw new Error('没有可分析的文本文件(预算分组后为空)')
  }
  const skippedModules = [...budget.skippedModules]

  // 2. 生成 overview(失败直接 throw → route 层转 502)
  const overview = await callLlm(
    OVERVIEW_SYSTEM_PROMPT,
    buildOverviewUserContent(input.repoName, input.files, budget),
  )

  // P1-8(2026-09-13 立):模块依赖图——纯静态解析(不依赖 LLM),只追加到 overview 正文末尾。
  // 解析结果为空时不追加章节(renderDependencyGraph 返回 '')。
  const edges = extractImportEdges(input.files)
  const graphSection = renderDependencyGraph(edges)
  const overviewContent = graphSection ? `${overview.content}\n\n${graphSection}` : overview.content

  // 3. 逐模块生成文档(≤6 个,按采样体积降序;失败不阻断)
  const targetModules = budget.modules.slice(0, MAX_MODULE_DOCS)
  const moduleDocs: Array<{ module: RepoWikiModule; content: string; model: string | null }> = []
  for (const m of targetModules) {
    try {
      const result = await callLlm(MODULE_SYSTEM_PROMPT, buildModuleUserContent(input.repoName, m))
      moduleDocs.push({ module: m, content: result.content, model: result.model })
    } catch (e) {
      logger.warn(
        { repoName: input.repoName, module: m.name, err: (e as Error).message },
        '[RepoWiki] 模块文档生成失败,跳过',
      )
      skippedModules.push(m.name)
    }
  }

  // 4. 落库(overview + module docs)
  const inserted = await db
    .insert(repoWikiDocs)
    .values([
      {
        userId: input.userId,
        repoName: input.repoName,
        kind: 'overview',
        modulePath: null,
        title: `${input.repoName} 仓库总览`,
        content: overviewContent,
        model: overview.model,
        fileCount: budget.fileCount,
      },
      ...moduleDocs.map((d) => ({
        userId: input.userId,
        repoName: input.repoName,
        kind: 'module',
        modulePath: d.module.name,
        title: `${d.module.name} 模块文档`,
        content: d.content,
        model: d.model,
        fileCount: d.module.files.length,
      })),
    ])
    .returning({
      id: repoWikiDocs.id,
      kind: repoWikiDocs.kind,
      title: repoWikiDocs.title,
      modulePath: repoWikiDocs.modulePath,
    })

  logger.info(
    {
      repoName: input.repoName,
      overview: 1,
      modules: moduleDocs.length,
      skipped: skippedModules.length,
    },
    '[RepoWiki] 生成完成',
  )

  return {
    docs: inserted.map((row) => ({
      id: row.id,
      kind: row.kind === 'module' ? 'module' : 'overview',
      title: row.title,
      modulePath: row.modulePath,
    })),
    skippedModules,
    edges,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
