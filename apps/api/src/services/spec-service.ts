/**
 * Spec 服务(2026-07-22 新增,对标 Trae IDE Spec 模式)。
 *
 * 跨服务调用 ai-service 的 spec 端点,封装 HTTP 请求 + 超时控制 + 错误兜底。
 * - generate:     POST /api/spec/generate   → 从代码 AST 生成 spec 文档
 * - templates:    GET  /api/spec/templates  → 预置模板列表
 * - history:      GET  /api/spec/history    → 指定 scope 的历史版本列表(本地 FS)
 * - load:         GET  /api/spec/load       → 加载已持久化的 spec(本地 FS)
 * - diff:         POST /api/spec/diff       → 新 spec 与上次持久化版本对比(本地 FS + TS unified diff)
 * - variables:    GET  /api/spec/variables  → 可用模板变量列表 + 当前值(本地 FS)
 *
 * 调用链路: web SpecPanel → apps/api /spec/* → 本服务 → ai-service /api/spec/*
 * 持久化路径: <workspacePath>/.trae-cn/specs/<scopeHash>.md + history/<timestamp>-<scopeHash>.md
 */

import type { FastifyRequest } from 'fastify'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve, basename, relative, isAbsolute } from 'node:path'
import type {
  SpecGenerateInput,
  SpecGenerateOutput,
  SpecScope,
  SpecTemplate,
} from '@ihui/types'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { logger } from '../utils/logger.js'

/** ai-service spec 端点路径(已含 /api 前缀,由 ai-service main.py include_router 注册) */
const SPEC_GENERATE_PATH = '/api/spec/generate'
const SPEC_TEMPLATES_PATH = '/api/spec/templates'

/** spec 生成超时(30s,生成耗时较长) */
const SPEC_TIMEOUT_MS = 30_000

/** ai-service 统一响应格式 */
interface AiServiceResponse<T> {
  code: number
  message: string
  data: T | null
}

// ---------------------------------------------------------------------------
// 新增端点类型(2026-07-22 深化:持久化 + diff + 模板变量)
// ---------------------------------------------------------------------------

/** 历史版本条目 */
export interface SpecHistoryEntry {
  /** 时间戳(YYYYMMDD-HHMMSS) */
  timestamp: string
  /** 相对工作区的文件路径 */
  filePath: string
  /** 内容摘要(首个标题行) */
  summary: string
}

/** GET /spec/history 响应 data 字段 */
export interface SpecHistoryResult {
  history: SpecHistoryEntry[]
}

/** GET /spec/load 响应 data 字段 */
export interface SpecLoadResult {
  spec: string
  filePath: string
}

/** POST /spec/diff 响应 data 字段 */
export interface SpecDiffResult {
  oldSpec: string
  newSpec: string
  /** unified diff 格式文本 */
  diff: string
  addedLines: number
  removedLines: number
  changedFiles: string[]
}

/** GET /spec/variables 响应 data 字段 */
export interface SpecVariablesResult {
  variables: {
    author: string
    date: string
    version: string
    project: string
  }
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 根据 scope 计算稳定哈希(MD5 前 12 位,与 spec_generator.py _compute_scope_hash 对齐)。
 * 用于定位 .trae-cn/specs/<hash>.md 持久化文件。
 *
 * 对齐要点:
 * - sort_keys:键名字典序(path 在 type 前)
 * - compact 分隔符:无空格(separators=(",", ":"))
 * - undefined → null:Python model_dump 始终含 path 键(None),JS undefined 需转 null
 */
function computeScopeHash(scope: SpecScope): string {
  const scopeObj = { type: scope.type, path: scope.path ?? null }
  const scopeStr = JSON.stringify(scopeObj, Object.keys(scopeObj).sort())
  return createHash('md5').update(scopeStr, 'utf8').digest('hex').slice(0, 12)
}

/**
 * 提取 spec 内容摘要(首个非 frontmatter / 非引用标题行,截断 80 字符)。
 * 与 spec_generator.py _summarize_spec 逻辑对齐。
 */
function summarizeSpec(content: string): string {
  for (const line of content.split('\n')) {
    const stripped = line.trim()
    if (!stripped) continue
    if (stripped === '---') continue
    if (stripped.startsWith('>')) continue
    if (stripped.startsWith('#')) return stripped.slice(0, 80)
    return stripped.slice(0, 80)
  }
  return ''
}

/**
 * 计算两个文本的 unified diff(LCS 算法,输出标准 unified diff 格式)。
 * 与 Python difflib.unified_diff 输出格式兼容。
 * 大输入降级:乘积 > 4M 时直接全量增删,避免 OOM。
 */
function computeUnifiedDiff(oldText: string, newText: string): {
  diff: string
  addedLines: number
  removedLines: number
} {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const m = oldLines.length
  const n = newLines.length

  // 大输入降级
  if (m * n > 4_000_000) {
    const lines: string[] = ['--- old-spec.md', '+++ new-spec.md']
    for (const l of oldLines) lines.push('-' + l)
    for (const l of newLines) lines.push('+' + l)
    return { diff: lines.join('\n'), addedLines: n, removedLines: m }
  }

  // LCS 动态规划表
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }

  // 回溯构建 diff
  const ops: Array<{ prefix: string; line: string }> = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ prefix: ' ', line: oldLines[i - 1]! })
      i--
      j--
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      ops.unshift({ prefix: '-', line: oldLines[i - 1]! })
      i--
    } else {
      ops.unshift({ prefix: '+', line: newLines[j - 1]! })
      j--
    }
  }
  while (i > 0) {
    ops.unshift({ prefix: '-', line: oldLines[i - 1]! })
    i--
  }
  while (j > 0) {
    ops.unshift({ prefix: '+', line: newLines[j - 1]! })
    j--
  }

  const diffLines: string[] = ['--- old-spec.md', '+++ new-spec.md']
  let added = 0
  let removed = 0
  for (const op of ops) {
    diffLines.push(op.prefix + op.line)
    if (op.prefix === '+') added++
    else if (op.prefix === '-') removed++
  }
  return { diff: diffLines.join('\n'), addedLines: added, removedLines: removed }
}

class SpecService {
  /**
   * 生成 spec 文档。
   *
   * @param request 当前 Fastify request(用于透传 traceparent + Authorization)
   * @param input   生成参数(scope + workspacePath + 可选 includeDependencies / languages)
   * @returns SpecGenerateOutput(spec markdown + sections + stats + durationMs),失败抛 Error
   */
  async generate(
    request: FastifyRequest,
    input: SpecGenerateInput,
  ): Promise<SpecGenerateOutput> {
    try {
      const resp = await aiServiceFetch(request, SPEC_GENERATE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: input.scope,
          workspacePath: input.workspacePath,
          includeDependencies: input.includeDependencies ?? true,
          languages: input.languages,
        }),
        signal: AbortSignal.timeout(SPEC_TIMEOUT_MS),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        throw new Error(
          `ai-service spec/generate HTTP ${resp.status}: ${errText.slice(0, 200)}`,
        )
      }

      const json = (await resp.json()) as AiServiceResponse<SpecGenerateOutput>
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || 'ai-service spec 生成失败')
      }
      return json.data
    } catch (e) {
      logger.warn(`[spec-service.generate] 调用 ai-service 失败: ${(e as Error).message}`)
      throw e
    }
  }

  /**
   * 获取预置 spec 模板列表。
   *
   * @param request 当前 Fastify request(用于透传 traceparent + Authorization)
   * @returns SpecTemplate[],失败抛 Error
   */
  async getTemplates(request: FastifyRequest): Promise<SpecTemplate[]> {
    try {
      const resp = await aiServiceFetch(request, SPEC_TEMPLATES_PATH, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        throw new Error(
          `ai-service spec/templates HTTP ${resp.status}: ${errText.slice(0, 200)}`,
        )
      }

      const json = (await resp.json()) as AiServiceResponse<{
        templates: SpecTemplate[]
      }>
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || 'ai-service 模板获取失败')
      }
      return json.data.templates
    } catch (e) {
      logger.warn(`[spec-service.getTemplates] 调用 ai-service 失败: ${(e as Error).message}`)
      throw e
    }
  }

  /**
   * 获取指定 scope 的历史版本列表(本地 FS 读取)。
   *
   * 文件命名:<timestamp>-<scopeHash>.md,按时间倒序返回。
   */
  async getHistory(workspacePath: string, scope: SpecScope): Promise<SpecHistoryResult> {
    const root = resolve(workspacePath)
    const scopeHash = computeScopeHash(scope)
    const historyDir = join(root, '.trae-cn', 'specs', 'history')

    try {
      const entries = await readdir(historyDir).catch(() => [] as string[])
      const matching = entries.filter((name) => name.endsWith(`-${scopeHash}.md`))

      const history: SpecHistoryEntry[] = []
      for (const name of matching.sort().reverse()) {
        const fullPath = join(historyDir, name)
        const timestamp = name.slice(0, -(scopeHash.length + 4)) // 去掉 -<hash>.md
        try {
          const content = await readFile(fullPath, 'utf-8')
          history.push({
            timestamp,
            filePath: relative(root, fullPath).replace(/\\/g, '/'),
            summary: summarizeSpec(content),
          })
        } catch {
          // 单文件读取失败跳过,不阻塞整体
        }
      }
      return { history }
    } catch (e) {
      logger.warn(`[spec-service.getHistory] 读取历史失败: ${(e as Error).message}`)
      return { history: [] }
    }
  }

  /**
   * 加载已持久化的 spec(本地 FS 读取)。
   *
   * @param version "latest" 取最新版本,否则按时间戳匹配历史文件
   */
  async loadSpec(
    workspacePath: string,
    scope: SpecScope,
    version: string = 'latest',
  ): Promise<SpecLoadResult> {
    const root = resolve(workspacePath)
    const scopeHash = computeScopeHash(scope)

    let target: string
    if (version === 'latest') {
      target = join(root, '.trae-cn', 'specs', `${scopeHash}.md`)
    } else {
      target = join(root, '.trae-cn', 'specs', 'history', `${version}-${scopeHash}.md`)
    }

    try {
      const spec = await readFile(target, 'utf-8')
      return { spec, filePath: relative(root, target).replace(/\\/g, '/') }
    } catch (e) {
      logger.warn(`[spec-service.loadSpec] 加载失败 (${version}): ${(e as Error).message}`)
      return { spec: '', filePath: '' }
    }
  }

  /**
   * 生成新 spec 与上次持久化版本的 unified diff。
   *
   * 流程:
   * 1. 读取旧 spec(在 generate 覆盖之前)
   * 2. 调 generate 生成新 spec(ai-service 持久化覆盖旧文件)
   * 3. LCS unified diff(与 Python difflib.unified_diff 格式兼容)
   *
   * @param request Fastify request(透传到 ai-service /api/spec/generate)
   */
  async generateDiff(
    request: FastifyRequest,
    workspacePath: string,
    scope: SpecScope,
  ): Promise<SpecDiffResult> {
    // 1. 读取旧 spec(在 generate 覆盖之前)
    const oldData = await this.loadSpec(workspacePath, scope, 'latest')
    const oldSpec = oldData.spec

    // 2. 生成新 spec(generate 内部 ai-service 会持久化,覆盖旧文件)
    const newResult = await this.generate(request, {
      scope,
      workspacePath,
      includeDependencies: true,
    })
    const newSpec = newResult.spec

    // 3. 计算 unified diff
    const { diff, addedLines, removedLines } = computeUnifiedDiff(oldSpec, newSpec)
    const scopeHash = computeScopeHash(scope)
    const changedFiles = oldSpec !== newSpec ? [`${scopeHash}.md`] : []

    return {
      oldSpec,
      newSpec,
      diff,
      addedLines,
      removedLines,
      changedFiles,
    }
  }

  /**
   * 获取当前可用的模板变量列表 + 值(本地 FS + git config)。
   *
   * - author:git config user.name,降级 "Unknown"
   * - date:当前日期 YYYY-MM-DD
   * - version / project:从 package.json 读取,降级 "1.0.0" / 目录名
   */
  async getVariables(workspacePath: string): Promise<SpecVariablesResult> {
    const root = resolve(workspacePath)

    // author
    let author = 'Unknown'
    try {
      const out = execSync('git config user.name', {
        cwd: isAbsolute(root) && root ? root : undefined,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore'],
      })
      author = out.trim() || 'Unknown'
    } catch {
      // 降级
    }

    // date
    const date = new Date().toISOString().slice(0, 10)

    // version + project
    let version = '1.0.0'
    let project = basename(root) || 'project'
    try {
      const pkgRaw = await readFile(join(root, 'package.json'), 'utf-8')
      const pkg = JSON.parse(pkgRaw) as { version?: string; name?: string }
      if (typeof pkg.version === 'string') version = pkg.version
      if (typeof pkg.name === 'string') project = pkg.name
    } catch {
      // 降级
    }

    return { variables: { author, date, version, project } }
  }
}

export const specService = new SpecService()
