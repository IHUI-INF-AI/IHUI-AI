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
import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, resolve, basename, relative, isAbsolute, dirname } from 'node:path'
import type { SpecGenerateOutput } from '@ihui/types'
import type { SpecGenerateInput, SpecScope, SpecTemplate } from '@ihui/shared'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { logger } from '../utils/logger.js'

/** ai-service spec 端点路径(已含 /api 前缀,由 ai-service main.py include_router 注册) */
const SPEC_GENERATE_PATH = '/api/spec/generate'
const SPEC_TEMPLATES_PATH = '/api/spec/templates'

/**
 * 本地预置模板(与 ai-service app/routers/spec.py _BUILTIN_TEMPLATES 保持一致)。
 * ai-service 不可用时降级返回,确保 Web 端 /spec 页面永远有模板列表。
 */
const BUILTIN_TEMPLATES: SpecTemplate[] = [
  {
    id: 'full',
    name: '完整规格',
    description: '概述 + 模块结构 + API 契约 + 数据模型 + 依赖关系(默认)',
    sections: ['概述', '模块结构', 'API 契约', '数据模型', '依赖关系'],
  },
  {
    id: 'api-only',
    name: 'API 契约',
    description: '仅提取 API endpoint,生成接口文档',
    sections: ['概述', 'API 契约'],
  },
  {
    id: 'schema-only',
    name: '数据模型',
    description: '仅提取数据库表 / schema,生成数据字典',
    sections: ['概述', '数据模型'],
  },
  {
    id: 'module-overview',
    name: '模块概览',
    description: '仅模块结构与符号清单,快速了解代码组织',
    sections: ['概述', '模块结构'],
  },
]

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
// 2026-07-22 深化新增端点类型(Spec 驱动代码生成 / Watch / 评审 / 拆分 / 增强)
// ---------------------------------------------------------------------------

/** POST /spec/apply 响应 data 字段 */
export interface SpecApplyResult {
  patch: string
  affectedFiles: string[]
  summary: string
  /** LLM 不可用时含 error 字段 */
  error?: string
}

/** POST /spec/apply/preview 响应 data 字段 */
export interface SpecApplyPreviewResult {
  files: Array<{
    path: string
    originalLines: number
    patchedLines: number
    status: 'modified' | 'unchanged'
  }>
}

/** POST /spec/apply/confirm 响应 data 字段 */
export interface SpecApplyConfirmResult {
  applied: string[]
  failed: Array<{ path: string; error: string }>
  backupDir: string
}

/** POST /spec/watch/start 响应 data 字段 */
export interface SpecWatchStartResult {
  watchId: string
  status: string
  watchPath: string
  webhookUrl: string | null
  /** watchdog 未安装时含 error 字段 */
  error?: string
}

/** POST /spec/watch/stop 响应 data 字段 */
export interface SpecWatchStopResult {
  watchId: string
  status: string
}

/** GET /spec/watch/status 响应 data 字段 */
export interface SpecWatchStatusResult {
  watchers: Array<{
    watchId: string
    scope: { type: string; path?: string } | null
    workspacePath: string
    webhookUrl: string | null
    startedAt: string
    watchPath: string
  }>
}

/** POST /spec/review/* 响应 data 字段 */
export interface SpecReviewResult {
  spec: string
  filePath: string
  status: string
  /** 错误时含 error 字段 */
  error?: string
  currentStatus?: string
}

/** GET /spec/pending-reviews 响应 data 字段 */
export interface SpecPendingReviewsResult {
  specs: Array<{
    specId: string
    scope: string
    summary: string
    filePath: string
    reviewer: string
    submittedAt: string
  }>
}

/** POST /spec/split-tasks 响应 data 字段 */
export interface SpecSplitTasksResult {
  tasks: Array<{
    title: string
    description: string
    priority: string
    estimated_complexity: string
  }>
  /** 降级模式时为 true */
  fallback?: boolean
  error?: string
}

/** POST /spec/enhance 响应 data 字段 */
export interface SpecEnhanceResult {
  spec: string
  enhancement: string
  filePath: string
  /** LLM 不可用时含 error 字段 */
  error?: string
  message?: string
}

// ---------------------------------------------------------------------------
// 2026-08-06 实装:全流程 / 回滚 / 影响分析 / 分支 / 智能生成(本地 FS,不依赖 ai-service)
// ---------------------------------------------------------------------------

/** 流水线阶段名(与前端 spec-panel.tsx stageLabel 对齐) */
export type SpecPipelineStageName = 'apply_spec' | 'apply_patch' | 'typecheck' | 'test' | 'commit'

/** 流水线阶段状态 */
export type SpecPipelineStageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

/** 单个流水线阶段 */
export interface SpecPipelineStage {
  name: SpecPipelineStageName
  status: SpecPipelineStageStatus
  log: string
  startedAt?: string
  finishedAt?: string
}

/** POST /spec/full-pipeline 响应 data 字段 */
export interface SpecFullPipelineResult {
  pipelineId: string
  stages: SpecPipelineStage[]
  overallStatus: 'running' | 'success' | 'failed' | 'partial'
  backupDir: string
  commitSha: string
  error?: string
}

/** POST /spec/pipeline-rollback 响应 data 字段 */
export interface SpecPipelineRollbackResult {
  rolled: number
  errors: string[]
  backupDir: string
  error?: string
}

/** POST /spec/impact-analysis 响应 data 字段 */
export interface SpecImpactAnalysisResult {
  affectedFiles: string[]
  affectedTests: string[]
  downstreamSpecs: string[]
  riskLevel: 'low' | 'medium' | 'high'
  llmAnalysis: {
    summary?: string
    riskReason?: string
    recommendations?: string[]
    error?: string
    message?: string
  }
  recommendations: string[]
}

/** Spec 分支 */
export interface SpecBranch {
  specId: string
  name: string
  baseVersion: string
  currentVersion: string
  createdAt: string
  status: 'active' | 'merged' | 'abandoned'
  filePath?: string
}

/** GET /spec/branches 响应 data 字段 */
export interface SpecBranchesResult {
  branches: SpecBranch[]
}

/** POST /spec/branch/merge 响应 data 字段 */
export interface SpecBranchMergeResult {
  merged: boolean
  conflicts: string[]
  mergedContent: string
  branchName: string
  error?: string
}

/** POST /spec/branch/abandon 响应 data 字段 */
export interface SpecBranchAbandonResult {
  abandoned: boolean
  branchName: string
}

/** POST /spec/generate-from-requirement 响应 data 字段 */
export interface SpecGenerateFromRequirementResult {
  spec: string
  sections: Array<{ title: string; level: number }>
  format: string
  error?: string
  message?: string
}

/** GET /spec/branch/diff 响应 data 字段(与前端 spec-panel.tsx SpecBranchDiffResult 对齐) */
export interface SpecBranchDiffResult {
  diff: string
  addedLines: number
  removedLines: number
  branchName: string
  specId: string
  error?: string
}

/** GET /spec/pipeline-status 响应 data 字段(extends 全流程结果,含状态查询附加字段) */
export interface SpecPipelineStatusResult extends SpecFullPipelineResult {
  logs?: string[]
  ran?: boolean
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
function computeUnifiedDiff(
  oldText: string,
  newText: string,
): {
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
  async generate(request: FastifyRequest, input: SpecGenerateInput): Promise<SpecGenerateOutput> {
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
        throw new Error(`ai-service spec/generate HTTP ${resp.status}: ${errText.slice(0, 200)}`)
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
        throw new Error(`ai-service spec/templates HTTP ${resp.status}: ${errText.slice(0, 200)}`)
      }

      const json = (await resp.json()) as AiServiceResponse<{
        templates: SpecTemplate[]
      }>
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || 'ai-service 模板获取失败')
      }
      return json.data.templates
    } catch (e) {
      // 降级:ai-service 不可用时返回本地预置模板(与 ai-service spec.py _BUILTIN_TEMPLATES 保持一致)
      logger.warn(
        `[spec-service.getTemplates] ai-service 不可用,降级返回本地预置模板: ${(e as Error).message}`,
      )
      return BUILTIN_TEMPLATES
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

  // -------------------------------------------------------------------------
  // 2026-07-22 深化:Spec 驱动代码生成 / Watch / 评审 / 拆分 / 增强
  // -------------------------------------------------------------------------

  /** POST /spec/apply — 对比新旧 spec,调 LLM 生成代码 patch */
  async applySpec(
    request: FastifyRequest,
    input: {
      scope: SpecScope
      workspacePath: string
      newSpec: string
      oldSpec?: string
    },
  ): Promise<SpecApplyResult> {
    try {
      const resp = await aiServiceFetch(request, '/api/spec/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: input.scope,
          workspacePath: input.workspacePath,
          newSpec: input.newSpec,
          oldSpec: input.oldSpec,
        }),
        signal: AbortSignal.timeout(60_000),
      })
      const json = (await resp.json()) as AiServiceResponse<SpecApplyResult>
      if (json.code !== 0 || !json.data) {
        throw new Error(json.message || 'spec apply 失败')
      }
      return json.data
    } catch (e) {
      // 降级:ai-service 不可用时返回 llm_unavailable,让 API 端返回 503(与 ai-service 端契约一致)
      logger.warn(
        `[spec-service.applySpec] ai-service 不可用,降级返回 llm_unavailable: ${(e as Error).message}`,
      )
      const err = new Error('llm_unavailable') as Error & { code?: string }
      err.code = 'llm_unavailable'
      throw err
    }
  }

  /** POST /spec/apply/preview — 预览 patch 应用效果(不写文件) */
  async applySpecPreview(
    request: FastifyRequest,
    input: {
      workspacePath: string
      patch: string
      affectedFiles: string[]
    },
  ): Promise<SpecApplyPreviewResult> {
    const resp = await aiServiceFetch(request, '/api/spec/apply/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecApplyPreviewResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || 'patch 预览失败')
    }
    return json.data
  }

  /** POST /spec/apply/confirm — 确认应用 patch(写入文件,备份原文件) */
  async applySpecConfirm(
    request: FastifyRequest,
    input: {
      workspacePath: string
      patch: string
      affectedFiles: string[]
    },
  ): Promise<SpecApplyConfirmResult> {
    const resp = await aiServiceFetch(request, '/api/spec/apply/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecApplyConfirmResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || 'patch 应用失败')
    }
    return json.data
  }

  /** POST /spec/watch/start — 启动文件监听(watchdog) */
  async startWatch(
    request: FastifyRequest,
    input: {
      scope: SpecScope
      workspacePath: string
      webhookUrl?: string
    },
  ): Promise<SpecWatchStartResult> {
    const resp = await aiServiceFetch(request, '/api/spec/watch/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecWatchStartResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || 'watch 启动失败')
    }
    return json.data
  }

  /** POST /spec/watch/stop — 停止文件监听 */
  async stopWatch(request: FastifyRequest, watchId: string): Promise<SpecWatchStopResult> {
    const resp = await aiServiceFetch(request, '/api/spec/watch/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchId }),
      signal: AbortSignal.timeout(10_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecWatchStopResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || 'watch 停止失败')
    }
    return json.data
  }

  /** GET /spec/watch/status — 返回当前活跃的 watcher 列表 */
  async getWatchStatus(request: FastifyRequest): Promise<SpecWatchStatusResult> {
    const resp = await aiServiceFetch(request, '/api/spec/watch/status', {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecWatchStatusResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || 'watch 状态获取失败')
    }
    return json.data
  }

  /** POST /spec/review/submit — 提交 spec 进入评审 */
  async submitForReview(
    request: FastifyRequest,
    input: { scope: SpecScope; workspacePath: string },
  ): Promise<SpecReviewResult> {
    const resp = await aiServiceFetch(request, '/api/spec/review/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecReviewResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || '提交评审失败')
    }
    return json.data
  }

  /** POST /spec/review/approve — 审批通过 spec */
  async approveSpec(
    request: FastifyRequest,
    input: { scope: SpecScope; workspacePath: string; reviewer?: string },
  ): Promise<SpecReviewResult> {
    const resp = await aiServiceFetch(request, '/api/spec/review/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecReviewResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || '审批失败')
    }
    return json.data
  }

  /** POST /spec/review/reject — 拒绝 spec */
  async rejectSpec(
    request: FastifyRequest,
    input: {
      scope: SpecScope
      workspacePath: string
      reviewer?: string
      comment?: string
    },
  ): Promise<SpecReviewResult> {
    const resp = await aiServiceFetch(request, '/api/spec/review/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecReviewResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || '拒绝失败')
    }
    return json.data
  }

  /** GET /spec/pending-reviews — 返回所有 pending_review 状态的 spec 列表 */
  async getPendingReviews(
    request: FastifyRequest,
    workspacePath: string,
  ): Promise<SpecPendingReviewsResult> {
    const resp = await aiServiceFetch(
      request,
      `/api/spec/pending-reviews?workspacePath=${encodeURIComponent(workspacePath)}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      },
    )
    const json = (await resp.json()) as AiServiceResponse<SpecPendingReviewsResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || '获取待评审列表失败')
    }
    return json.data
  }

  /** POST /spec/split-tasks — 从 spec 章节自动拆分任务 */
  async splitTasks(
    request: FastifyRequest,
    input: { scope: SpecScope; workspacePath: string },
  ): Promise<SpecSplitTasksResult> {
    const resp = await aiServiceFetch(request, '/api/spec/split-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecSplitTasksResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || '任务拆分失败')
    }
    return json.data
  }

  /** POST /spec/enhance — 对已生成的 spec 添加 LLM 智能分析章节 */
  async enhanceSpec(
    request: FastifyRequest,
    input: { scope: SpecScope; workspacePath: string },
  ): Promise<SpecEnhanceResult> {
    const resp = await aiServiceFetch(request, '/api/spec/enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60_000),
    })
    const json = (await resp.json()) as AiServiceResponse<SpecEnhanceResult>
    if (json.code !== 0 || !json.data) {
      throw new Error(json.message || 'spec 增强失败')
    }
    return json.data
  }

  // -------------------------------------------------------------------------
  // 2026-08-06 实装:全流程 / 回滚 / 影响分析 / 分支 / 智能生成
  // (本地 FS 实装,ai-service 无对应端点;与 getHistory/loadSpec/getVariables 本地模式一致)
  // -------------------------------------------------------------------------

  /**
   * 读取分支索引(内部辅助)。
   * 路径:<workspacePath>/.trae-cn/specs/branches/index.json
   * 文件不存在时返回空数组(不抛错)。
   */
  private async readBranchIndex(root: string): Promise<SpecBranch[]> {
    const indexFile = join(root, '.trae-cn', 'specs', 'branches', 'index.json')
    try {
      const content = await readFile(indexFile, 'utf-8')
      return JSON.parse(content) as SpecBranch[]
    } catch {
      return []
    }
  }

  /**
   * 写入分支索引(内部辅助)。
   * 自动创建目录,JSON pretty-print(2 空格缩进)。
   */
  private async writeBranchIndex(root: string, branches: SpecBranch[]): Promise<void> {
    const indexFile = join(root, '.trae-cn', 'specs', 'branches', 'index.json')
    await mkdir(dirname(indexFile), { recursive: true })
    await writeFile(indexFile, JSON.stringify(branches, null, 2), 'utf-8')
  }

  /**
   * POST /spec/generate-from-requirement — 从需求描述智能生成 spec 草稿。
   *
   * 本地实装(不依赖 ai-service / LLM):基于需求文本生成结构化 5 章节 spec 模板。
   * 响应包含 spec markdown + sections 章节(与前端 SpecGenerateFromRequirementResult 对齐)。
   */
  async generateFromRequirement(input: {
    workspacePath: string
    requirement: string
    format: string
  }): Promise<SpecGenerateFromRequirementResult> {
    const { requirement, format } = input
    const timestamp = new Date().toISOString().slice(0, 10)
    const requirementPreview = requirement.length > 500 ? requirement.slice(0, 500) + '...' : requirement

    const sections: Array<{ title: string; level: number }> = [
      { title: '概述', level: 1 },
      { title: '模块结构', level: 1 },
      { title: 'API 契约', level: 1 },
      { title: '数据模型', level: 1 },
      { title: '测试用例', level: 1 },
    ]

    const spec = `# Spec 草稿(${timestamp})

> 由需求智能生成(本地模板,LLM 未参与)

## 概述

**需求描述:**

${requirementPreview}

**输入格式:** ${format}

**生成时间:** ${timestamp}

## 模块结构

- 建议模块划分(基于需求关键词推断,待 LLM 增强):
  - 核心模块:承载主业务逻辑
  - 辅助模块:工具函数 + 类型定义
  - 接入层:API 路由 + 请求校验

## API 契约

- 建议 endpoint(待 LLM 增强,基于需求推断):
  - \`GET /api/resource\` — 列表查询
  - \`POST /api/resource\` — 新建
  - \`GET /api/resource/:id\` — 详情
  - \`PUT /api/resource/:id\` — 更新
  - \`DELETE /api/resource/:id\` — 删除

## 数据模型

- 建议数据实体(待 LLM 增强):
  - \`id\` — 主键
  - \`createdAt\` — 创建时间
  - \`updatedAt\` — 更新时间
  - 业务字段:从需求推断

## 测试用例

- 建议测试覆盖(待 LLM 增强):
  - 正向流程:CRUD 基础场景
  - 异常处理:参数校验 + 权限 + 资源不存在
  - 边界条件:空值 + 最大长度 + 并发
`

    return {
      spec,
      sections,
      format,
      message: '本地模板生成(LLM 未参与),建议结合「智能分析」标签页深化',
    }
  }

  /**
   * POST /spec/branch — 从当前 spec 派生分支。
   *
   * 本地实装:
   * - 从 baseVersion(latest 或历史时间戳)读取 spec 内容
   * - 复制到 .trae-cn/specs/branches/<branchName>.md
   * - 在 branches/index.json 注册分支元数据(active 状态)
   */
  async createBranch(input: {
    scope: SpecScope
    workspacePath: string
    branchName: string
    baseVersion: string
  }): Promise<SpecBranch> {
    const root = resolve(input.workspacePath)
    const scopeHash = computeScopeHash(input.scope)
    const branchesDir = join(root, '.trae-cn', 'specs', 'branches')
    const branchFile = join(branchesDir, `${input.branchName}.md`)

    await mkdir(branchesDir, { recursive: true })

    // 读取 base spec 内容
    let baseSpec = ''
    if (input.baseVersion === 'latest') {
      baseSpec = await readFile(
        join(root, '.trae-cn', 'specs', `${scopeHash}.md`),
        'utf-8',
      ).catch(() => '')
    } else {
      baseSpec = await readFile(
        join(root, '.trae-cn', 'specs', 'history', `${input.baseVersion}-${scopeHash}.md`),
        'utf-8',
      ).catch(() => '')
    }

    // 写入分支文件(即使 baseSpec 为空也写入,前端可后续编辑)
    await writeFile(branchFile, baseSpec, 'utf-8')

    // 更新 index.json(覆盖同名旧分支)
    const branches = await this.readBranchIndex(root)
    const now = new Date().toISOString()
    const branch: SpecBranch = {
      specId: scopeHash,
      name: input.branchName,
      baseVersion: input.baseVersion,
      currentVersion: now,
      createdAt: now,
      status: 'active',
      filePath: relative(root, branchFile).replace(/\\/g, '/'),
    }
    const filtered = branches.filter(
      (b) => !(b.specId === scopeHash && b.name === input.branchName),
    )
    filtered.push(branch)
    await this.writeBranchIndex(root, filtered)

    return branch
  }

  /**
   * POST /spec/branch/merge — 3-way merge + LLM 冲突解决。
   *
   * 本地实装(简化):
   * - 读取分支内容 + main spec 内容
   * - 用 unified diff 检测修改点(连续 - + 行),标记为"冲突(LLM 已自动解决)"
   * - 合并策略:用分支内容覆盖 main spec(简化,无真正 3-way base 对比)
   * - 更新分支状态为 merged
   */
  async mergeBranch(input: {
    scope: SpecScope
    workspacePath: string
    branchName: string
  }): Promise<SpecBranchMergeResult> {
    const root = resolve(input.workspacePath)
    const scopeHash = computeScopeHash(input.scope)
    const branchFile = join(root, '.trae-cn', 'specs', 'branches', `${input.branchName}.md`)
    const mainFile = join(root, '.trae-cn', 'specs', `${scopeHash}.md`)

    // 读取分支内容
    const branchContent = await readFile(branchFile, 'utf-8').catch(() => '')
    if (!branchContent) {
      return {
        merged: false,
        conflicts: [],
        mergedContent: '',
        branchName: input.branchName,
        error: `分支文件不存在: ${input.branchName}`,
      }
    }

    // 读取 main spec(可能不存在,降级为空)
    const mainContent = await readFile(mainFile, 'utf-8').catch(() => '')

    // 检测冲突行(unified diff 中连续 - + 行视为修改点)
    const conflicts: string[] = []
    const { diff } = computeUnifiedDiff(mainContent, branchContent)
    const diffLines = diff.split('\n')
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i]!
      if (line.startsWith('-') && !line.startsWith('---')) {
        const next = diffLines[i + 1]
        if (next && next.startsWith('+') && !next.startsWith('+++')) {
          const oldSnippet = line.slice(1, 50).trim() || '(空行)'
          const newSnippet = next.slice(1, 50).trim() || '(空行)'
          conflicts.push(`行 ${i}: ${oldSnippet} → ${newSnippet}`)
        }
      }
    }

    // 合并:用分支内容覆盖 main spec
    await mkdir(dirname(mainFile), { recursive: true })
    await writeFile(mainFile, branchContent, 'utf-8')

    // 更新分支状态为 merged
    const branches = await this.readBranchIndex(root)
    const updated = branches.map((b) =>
      b.specId === scopeHash && b.name === input.branchName
        ? { ...b, status: 'merged' as const }
        : b,
    )
    await this.writeBranchIndex(root, updated)

    return {
      merged: true,
      conflicts,
      mergedContent: branchContent,
      branchName: input.branchName,
    }
  }

  /**
   * POST /spec/branch/abandon — 废弃分支。
   *
   * 本地实装:在 branches/index.json 标记分支 status='abandoned'。
   * 不删除分支文件(保留历史,可后续恢复)。
   */
  async abandonBranch(input: {
    scope: SpecScope
    workspacePath: string
    branchName: string
  }): Promise<SpecBranchAbandonResult> {
    const root = resolve(input.workspacePath)
    const scopeHash = computeScopeHash(input.scope)

    const branches = await this.readBranchIndex(root)
    const target = branches.find(
      (b) => b.specId === scopeHash && b.name === input.branchName,
    )
    if (!target) {
      return { abandoned: false, branchName: input.branchName }
    }

    const updated = branches.map((b) =>
      b.specId === scopeHash && b.name === input.branchName
        ? { ...b, status: 'abandoned' as const }
        : b,
    )
    await this.writeBranchIndex(root, updated)

    return { abandoned: true, branchName: input.branchName }
  }

  /**
   * POST /spec/impact-analysis — LLM 评估拟修改内容风险。
   *
   * 本地实装(静态分析,LLM 降级):
   * - 扫描工作区文件,基于关键词匹配找出可能受影响的文件
   * - 风险评分:高风险关键词(删除/迁移/重构)→ high;受影响文件 >5 → medium;否则 low
   * - llmAnalysis.error='llm_unavailable',前端显示"仅展示静态扫描结果"
   */
  async analyzeImpact(input: {
    scope: SpecScope
    workspacePath: string
    proposedChanges: string
  }): Promise<SpecImpactAnalysisResult> {
    const root = resolve(input.workspacePath)
    const changes = input.proposedChanges.toLowerCase()

    const HIGH_RISK_KEYWORDS = [
      'delete', 'remove', 'drop', 'migrate', 'refactor', 'breaking',
      '删除', '移除', '迁移', '重构', '破坏性',
    ]
    const TEST_KEYWORDS = ['test', 'spec', '__tests__', '测试', 'e2e']

    const isHighRisk = HIGH_RISK_KEYWORDS.some((kw) => changes.includes(kw))

    const affectedFiles: string[] = []
    const affectedTests: string[] = []
    const downstreamSpecs: string[] = []

    // 扫描工作区文件(限制深度 3,跳过 node_modules/dist/build/.git)
    const scanDir = async (dir: string, depth: number): Promise<void> => {
      if (depth > 3) return
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === 'target'
        ) {
          continue
        }
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await scanDir(fullPath, depth + 1)
        } else if (entry.isFile()) {
          const rel = relative(root, fullPath).replace(/\\/g, '/')
          const relLower = rel.toLowerCase()
          // 文件名或路径出现在拟修改内容中 → 标记受影响
          if (changes.includes(entry.name.toLowerCase()) || changes.includes(relLower)) {
            affectedFiles.push(rel)
          }
          if (TEST_KEYWORDS.some((kw) => relLower.includes(kw))) {
            affectedTests.push(rel)
          }
        }
      }
    }
    await scanDir(root, 0).catch(() => {
      // 扫描失败降级,返回空列表
    })

    // 扫描下游 specs(.trae-cn/specs/*.md,排除 history/branches/backups 子目录)
    const specsDir = join(root, '.trae-cn', 'specs')
    const specEntries = await readdir(specsDir, { withFileTypes: true }).catch(() => [])
    for (const entry of specEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        downstreamSpecs.push(relative(root, join(specsDir, entry.name)).replace(/\\/g, '/'))
      }
    }

    const riskLevel: 'low' | 'medium' | 'high' = isHighRisk
      ? 'high'
      : affectedFiles.length > 5
        ? 'medium'
        : 'low'

    const recommendations: string[] = []
    if (isHighRisk) {
      recommendations.push('检测到高风险关键词(删除/迁移/重构),建议先备份再操作')
    }
    if (affectedFiles.length > 0) {
      recommendations.push(`检查 ${affectedFiles.length} 个可能受影响的文件`)
    }
    if (affectedTests.length > 0) {
      recommendations.push(`运行 ${affectedTests.length} 个相关测试用例验证回归`)
    }
    if (recommendations.length === 0) {
      recommendations.push('未检测到明显风险,建议常规 code review')
    }

    return {
      affectedFiles,
      affectedTests,
      downstreamSpecs,
      riskLevel,
      llmAnalysis: {
        error: 'llm_unavailable',
        message: 'LLM 未参与,仅展示静态扫描结果',
      },
      recommendations,
    }
  }

  /**
   * POST /spec/full-pipeline — 全流程流水线。
   *
   * 本地实装(5 阶段编排):
   * - apply_spec:保存 spec 到 .trae-cn/specs/<hash>.md(成功)+ 备份原文件到 backups/<pipelineId>/
   * - apply_patch:skipped(需 LLM 生成 patch,本地无此能力)
   * - typecheck:skipped(无代码改动)
   * - test:skipped(无代码改动)
   * - commit:autoCommit=true 时 git add + commit spec 文件;否则 skipped
   *
   * 整体状态:apply_patch skipped → partial(spec 已保存但未生成代码)
   */
  async runFullPipeline(input: {
    scope: SpecScope
    workspacePath: string
    newSpec: string
    autoCommit: boolean
  }): Promise<SpecFullPipelineResult> {
    const root = resolve(input.workspacePath)
    const scopeHash = computeScopeHash(input.scope)
    const pipelineId = randomUUID().slice(0, 8)
    const backupDir = join(root, '.trae-cn', 'specs', 'backups', pipelineId)
    const stages: SpecPipelineStage[] = []
    const now = () => new Date().toISOString()

    // 阶段 1: apply_spec — 保存 spec 文件 + 备份原文件
    const stage1Start = now()
    try {
      const specsDir = join(root, '.trae-cn', 'specs')
      await mkdir(specsDir, { recursive: true })
      const specFile = join(specsDir, `${scopeHash}.md`)
      // 备份原文件(如果存在)
      await mkdir(backupDir, { recursive: true })
      const oldSpec = await readFile(specFile, 'utf-8').catch(() => '')
      if (oldSpec) {
        await writeFile(join(backupDir, `${scopeHash}.md.bak`), oldSpec, 'utf-8')
      }
      await writeFile(specFile, input.newSpec, 'utf-8')
      stages.push({
        name: 'apply_spec',
        status: 'success',
        log: `spec 已保存到 ${relative(root, specFile).replace(/\\/g, '/')}`,
        startedAt: stage1Start,
        finishedAt: now(),
      })
    } catch (e) {
      stages.push({
        name: 'apply_spec',
        status: 'failed',
        log: `保存失败: ${(e as Error).message}`,
        startedAt: stage1Start,
        finishedAt: now(),
      })
      return {
        pipelineId,
        stages,
        overallStatus: 'failed',
        backupDir: relative(root, backupDir).replace(/\\/g, '/'),
        commitSha: '',
        error: 'apply_spec 阶段失败',
      }
    }

    // 阶段 2: apply_patch — skipped(本地无 LLM patch 生成能力)
    stages.push({
      name: 'apply_patch',
      status: 'skipped',
      log: 'LLM 未参与,跳过 patch 生成(spec 已保存,可用「代码生成」标签页手动生成 patch)',
      startedAt: now(),
      finishedAt: now(),
    })

    // 阶段 3: typecheck — skipped(无代码改动)
    stages.push({
      name: 'typecheck',
      status: 'skipped',
      log: '无代码改动,跳过 typecheck',
      startedAt: now(),
      finishedAt: now(),
    })

    // 阶段 4: test — skipped(无代码改动)
    stages.push({
      name: 'test',
      status: 'skipped',
      log: '无代码改动,跳过 test',
      startedAt: now(),
      finishedAt: now(),
    })

    // 阶段 5: commit — autoCommit=true 时提交 spec 文件
    let commitSha = ''
    if (input.autoCommit) {
      const stage5Start = now()
      try {
        const specRelPath = relative(
          root,
          join(root, '.trae-cn', 'specs', `${scopeHash}.md`),
        ).replace(/\\/g, '/')
        execSync(
          `git add ${specRelPath} && git commit -m "chore(spec): pipeline ${pipelineId} 更新 spec"`,
          {
            cwd: root,
            encoding: 'utf-8',
            timeout: 15000,
            stdio: ['pipe', 'pipe', 'ignore'],
          },
        )
        commitSha = execSync('git rev-parse HEAD', {
          cwd: root,
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim()
        stages.push({
          name: 'commit',
          status: 'success',
          log: `commit: ${commitSha.slice(0, 8)}`,
          startedAt: stage5Start,
          finishedAt: now(),
        })
      } catch (e) {
        stages.push({
          name: 'commit',
          status: 'failed',
          log: `commit 失败: ${(e as Error).message}`,
          startedAt: stage5Start,
          finishedAt: now(),
        })
      }
    } else {
      stages.push({
        name: 'commit',
        status: 'skipped',
        log: 'autoCommit=false,跳过 commit',
        startedAt: now(),
        finishedAt: now(),
      })
    }

    // 整体状态:apply_patch skipped → partial(spec 已保存但未生成代码);有 failed 阶段也仍 partial(已部分完成)
    const hasFailed = stages.some((s) => s.status === 'failed')
    const overallStatus: SpecFullPipelineResult['overallStatus'] = 'partial'

    return {
      pipelineId,
      stages,
      overallStatus,
      backupDir: relative(root, backupDir).replace(/\\/g, '/'),
      commitSha,
      error: hasFailed ? '部分阶段失败,详情见 stages' : undefined,
    }
  }

  /**
   * GET /spec/branches — 返回指定 scope 的全部分支列表(含 merged/abandoned)。
   *
   * 本地实装:读取 .trae-cn/specs/branches/index.json。
   * scope 给定时按 specId 过滤,否则返回全部(不同 scope 的分支)。
   */
  async listBranches(
    workspacePath: string,
    scope?: SpecScope,
  ): Promise<SpecBranchesResult> {
    const root = resolve(workspacePath)
    const branches = await this.readBranchIndex(root)
    const filtered = scope
      ? branches.filter((b) => b.specId === computeScopeHash(scope))
      : branches
    return { branches: filtered }
  }

  /**
   * GET /spec/branch/diff — 对比分支内容与 main spec 的 unified diff。
   *
   * 本地实装:
   * - 读取 .trae-cn/specs/branches/<branchName>.md 与 .trae-cn/specs/<scopeHash>.md
   * - computeUnifiedDiff(main, branch) 输出标准 unified diff
   * - 分支文件不存在时返回 error 字段(不抛错,前端 toast 提示)
   */
  async diffBranch(input: {
    workspacePath: string
    scope: SpecScope
    branchName: string
  }): Promise<SpecBranchDiffResult> {
    const root = resolve(input.workspacePath)
    const scopeHash = computeScopeHash(input.scope)
    const branchFile = join(root, '.trae-cn', 'specs', 'branches', `${input.branchName}.md`)
    const mainFile = join(root, '.trae-cn', 'specs', `${scopeHash}.md`)

    const branchContent = await readFile(branchFile, 'utf-8').catch(() => '')
    if (!branchContent) {
      return {
        diff: '',
        addedLines: 0,
        removedLines: 0,
        branchName: input.branchName,
        specId: scopeHash,
        error: `分支文件不存在: ${input.branchName}`,
      }
    }
    const mainContent = await readFile(mainFile, 'utf-8').catch(() => '')

    const { diff, addedLines, removedLines } = computeUnifiedDiff(mainContent, branchContent)
    return {
      diff,
      addedLines,
      removedLines,
      branchName: input.branchName,
      specId: scopeHash,
    }
  }

  /**
   * GET /spec/pipeline-status — 查询流水线执行状态。
   *
   * 本地实装(同步流水线,无异步任务):
   * - 检查 .trae-cn/specs/backups/<pipelineId>/ 备份目录是否存在
   * - 存在且含 .bak 文件 → ran=true, overallStatus=success
   * - 存在但无 .bak → failed;不存在 → ran=false, error 说明
   * - 局限:本地流水线同步执行,状态查询仅反映"是否执行过",无逐阶段实时进度
   */
  async getPipelineStatus(input: {
    workspacePath: string
    scope: SpecScope
    pipelineId: string
  }): Promise<SpecPipelineStatusResult> {
    const root = resolve(input.workspacePath)
    const backupDir = join(root, '.trae-cn', 'specs', 'backups', input.pipelineId)
    const relBackup = relative(root, backupDir).replace(/\\/g, '/')

    const statResult = await stat(backupDir).catch(() => null)
    if (!statResult || !statResult.isDirectory()) {
      return {
        pipelineId: input.pipelineId,
        stages: [],
        overallStatus: 'failed',
        backupDir: relBackup,
        commitSha: '',
        ran: false,
        error: `未找到流水线记录: ${input.pipelineId}`,
      }
    }

    const entries = await readdir(backupDir).catch(() => [] as string[])
    const bakCount = entries.filter((f) => f.endsWith('.bak')).length
    return {
      pipelineId: input.pipelineId,
      stages: [],
      overallStatus: bakCount > 0 ? 'success' : 'failed',
      backupDir: relBackup,
      commitSha: '',
      ran: true,
      logs: [`备份目录存在,共 ${entries.length} 个文件(${bakCount} 个 spec 备份)`],
    }
  }

  /**
   * POST /spec/pipeline-rollback — 按 backupDir 回滚。
   *
   * 本地实装:
   * - 读取 backupDir 下的 *.bak 文件
   * - 恢复到 .trae-cn/specs/<原文件名>(去掉 .bak 后缀)
   * - 返回 rolled 文件数 + errors
   */
  async rollbackPipeline(input: {
    workspacePath: string
    backupDir: string
  }): Promise<SpecPipelineRollbackResult> {
    const root = resolve(input.workspacePath)
    const backupPath = isAbsolute(input.backupDir)
      ? input.backupDir
      : resolve(root, input.backupDir)

    const errors: string[] = []
    let rolled = 0

    const statResult = await stat(backupPath).catch(() => null)
    if (!statResult || !statResult.isDirectory()) {
      return {
        rolled: 0,
        errors: [`备份目录不存在: ${input.backupDir}`],
        backupDir: input.backupDir,
        error: '备份目录不存在',
      }
    }

    try {
      const entries = await readdir(backupPath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const match = entry.name.match(/^(.+)\.bak$/)
        if (!match) continue
        const originalName = match[1]!
        const backupFile = join(backupPath, entry.name)
        const targetFile = join(root, '.trae-cn', 'specs', originalName)
        try {
          const content = await readFile(backupFile, 'utf-8')
          await mkdir(dirname(targetFile), { recursive: true })
          await writeFile(targetFile, content, 'utf-8')
          rolled++
        } catch (e) {
          errors.push(`恢复 ${entry.name} 失败: ${(e as Error).message}`)
        }
      }
    } catch (e) {
      errors.push(`回滚失败: ${(e as Error).message}`)
    }

    return {
      rolled,
      errors,
      backupDir: input.backupDir,
    }
  }
}

export const specService = new SpecService()
