/**
 * Spec 路由(2026-07-22 新增,对标 Trae IDE Spec 模式)。
 *
 * Fastify 转发层:JWT 鉴权 + Zod 校验 → 调 spec-service → ai-service /api/spec/*。
 *
 * 路径(在 server.ts 用 prefix:'/api' 注册):
 * - POST /spec/generate   → 生成 spec 文档(markdown)
 * - GET  /spec/templates  → 预置模板列表
 * - GET  /spec/history    → 指定 scope 的历史版本列表(2026-07-22 深化)
 * - GET  /spec/load       → 加载已持久化的 spec(2026-07-22 深化)
 * - POST /spec/diff       → 新 spec 与上次持久化版本对比(2026-07-22 深化)
 * - GET  /spec/variables  → 可用模板变量列表 + 当前值(2026-07-22 深化)
 *
 * 响应统一 { code: 0, message: 'success', data: ... } 格式。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { specService } from '../services/spec-service.js'

export const specRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权:复用 packages/auth 的 authenticate(同 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  const specScopeSchema = z.object({
    type: z.enum(['file', 'dir', 'workspace']).default('workspace'),
    path: z.string().optional(),
  })

  const specGenerateSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    includeDependencies: z.boolean().optional(),
    languages: z.array(z.string()).optional(),
  })

  // POST /spec/generate — 生成 spec 文档
  server.post('/spec/generate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specGenerateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.generate(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `spec 生成失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/templates — 预置模板列表
  server.get('/spec/templates', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    try {
      const templates = await specService.getTemplates(request)
      return reply.send(success({ templates }))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `模板获取失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 2026-07-22 深化:持久化 + diff + 模板变量
  // -------------------------------------------------------------------------

  const specQuerySchema = z.object({
    workspacePath: z.string().min(1),
    scopeType: z.enum(['file', 'dir', 'workspace']).default('workspace'),
    scopePath: z.string().optional(),
  })

  // GET /spec/history — 指定 scope 的历史版本列表
  server.get('/spec/history', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const { workspacePath, scopeType, scopePath } = parsed.data
      const data = await specService.getHistory(workspacePath, {
        type: scopeType,
        path: scopePath,
      })
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `历史版本获取失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/load — 加载已持久化的 spec
  server.get('/spec/load', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const loadSchema = specQuerySchema.extend({
      version: z.string().default('latest'),
    })
    const parsed = loadSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const { workspacePath, scopeType, scopePath, version } = parsed.data
      const data = await specService.loadSpec(
        workspacePath,
        { type: scopeType, path: scopePath },
        version,
      )
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `spec 加载失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/diff — 新 spec 与上次持久化版本对比
  const specDiffSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
  })

  server.post('/spec/diff', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specDiffSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.generateDiff(
        request,
        parsed.data.workspacePath,
        parsed.data.scope,
      )
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `spec diff 生成失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/variables — 可用模板变量列表 + 当前值
  server.get('/spec/variables', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = z
      .object({ workspacePath: z.string().min(1) })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.getVariables(parsed.data.workspacePath)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `模板变量获取失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 2026-07-22 深化:Spec 驱动代码生成 / Watch / 评审 / 拆分 / 增强
  // -------------------------------------------------------------------------

  // POST /spec/apply — 对比新旧 spec,调 LLM 生成代码 patch
  const specApplySchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    newSpec: z.string().min(1),
    oldSpec: z.string().optional(),
  })

  server.post('/spec/apply', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specApplySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.applySpec(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      const msg = (e as Error).message || ''
      if (msg.includes('llm_unavailable')) {
        return reply.status(503).send(error(503, 'llm_unavailable'))
      }
      return reply.status(502).send(error(502, `spec apply 失败: ${msg}`))
    }
  })

  // POST /spec/apply/preview — 预览 patch 应用效果
  const specPatchSchema = z.object({
    workspacePath: z.string().min(1),
    patch: z.string().min(1),
    affectedFiles: z.array(z.string()).default([]),
  })

  server.post('/spec/apply/preview', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.applySpecPreview(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `patch 预览失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/apply/confirm — 确认应用 patch(写入文件,备份原文件)
  server.post('/spec/apply/confirm', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.applySpecConfirm(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `patch 应用失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/watch/start — 启动文件监听(watchdog)
  const specWatchStartSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    webhookUrl: z.string().url().optional(),
  })

  server.post('/spec/watch/start', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specWatchStartSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.startWatch(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      const msg = (e as Error).message || ''
      if (msg.includes('watchdog_not_installed')) {
        return reply.status(501).send(error(501, 'watchdog_not_installed'))
      }
      return reply.status(502).send(error(502, `watch 启动失败: ${msg}`))
    }
  })

  // POST /spec/watch/stop — 停止文件监听
  const specWatchStopSchema = z.object({
    watchId: z.string().min(1),
  })

  server.post('/spec/watch/stop', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specWatchStopSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.stopWatch(request, parsed.data.watchId)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `watch 停止失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/watch/status — 返回当前活跃的 watcher 列表
  server.get('/spec/watch/status', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    try {
      const data = await specService.getWatchStatus(request)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `watch 状态获取失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/review/submit — 提交 spec 进入评审
  const specReviewSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    reviewer: z.string().optional(),
    comment: z.string().optional(),
  })

  server.post('/spec/review/submit', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specReviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.submitForReview(request, {
        scope: parsed.data.scope,
        workspacePath: parsed.data.workspacePath,
      })
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `提交评审失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/review/approve — 审批通过 spec
  server.post('/spec/review/approve', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specReviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const reviewer = parsed.data.reviewer || request.userId
      const data = await specService.approveSpec(request, {
        scope: parsed.data.scope,
        workspacePath: parsed.data.workspacePath,
        reviewer,
      })
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `审批失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/review/reject — 拒绝 spec
  server.post('/spec/review/reject', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specReviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const reviewer = parsed.data.reviewer || request.userId
      const data = await specService.rejectSpec(request, {
        scope: parsed.data.scope,
        workspacePath: parsed.data.workspacePath,
        reviewer,
        comment: parsed.data.comment,
      })
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `拒绝失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/pending-reviews — 返回所有 pending_review 状态的 spec 列表
  server.get('/spec/pending-reviews', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = z
      .object({ workspacePath: z.string().min(1) })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.getPendingReviews(
        request,
        parsed.data.workspacePath,
      )
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `获取待评审列表失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/split-tasks — 从 spec 章节自动拆分任务
  const specScopeOnlySchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
  })

  server.post('/spec/split-tasks', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specScopeOnlySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.splitTasks(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `任务拆分失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/enhance — 对已生成的 spec 添加 LLM 智能分析章节
  server.post('/spec/enhance', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specScopeOnlySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.enhanceSpec(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      const msg = (e as Error).message || ''
      if (msg.includes('llm_unavailable')) {
        return reply.status(503).send(error(503, 'llm_unavailable'))
      }
      return reply.status(502).send(error(502, `spec 增强失败: ${msg}`))
    }
  })

  // -------------------------------------------------------------------------
  // 2026-07-23 超越 Copilot Workspace:全流程流水线 / 影响分析 / 版本树 / 智能生成
  // -------------------------------------------------------------------------

  // POST /spec/full-pipeline — Spec 驱动开发全流程闭环
  const specFullPipelineSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    newSpec: z.string().min(1),
    autoCommit: z.boolean().optional(),
  })

  server.post('/spec/full-pipeline', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specFullPipelineSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.runFullPipeline(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `全流程执行失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/pipeline-status — 获取流水线执行状态
  server.get('/spec/pipeline-status', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const { workspacePath, scopeType, scopePath } = parsed.data
      const data = await specService.getPipelineStatus(request, workspacePath, {
        type: scopeType,
        path: scopePath,
      })
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `流水线状态获取失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/pipeline-rollback — 手动回滚到指定备份目录
  const specPipelineRollbackSchema = z.object({
    workspacePath: z.string().min(1),
    backupDir: z.string().min(1),
  })

  server.post('/spec/pipeline-rollback', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specPipelineRollbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.rollbackPipeline(
        request,
        parsed.data.workspacePath,
        parsed.data.backupDir,
      )
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `回滚失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/impact-analysis — Spec 影响分析
  const specImpactAnalysisSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    proposedChanges: z.string().min(1),
  })

  server.post('/spec/impact-analysis', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specImpactAnalysisSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.analyzeImpact(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `影响分析失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/branch — 创建 spec 分支
  const specBranchCreateSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    branchName: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9._/-]+$/, '分支名仅允许字母数字 . _ / -'),
    baseVersion: z.string().optional(),
  })

  server.post('/spec/branch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specBranchCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.createBranch(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `创建分支失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/branches — 列出所有分支
  server.get('/spec/branches', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const { workspacePath, scopeType, scopePath } = parsed.data
      const data = await specService.listBranches(request, workspacePath, {
        type: scopeType,
        path: scopePath,
      })
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `分支列表获取失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/branch/merge — 合并分支(3-way merge)
  const specBranchActionSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    branchName: z.string().min(1),
  })

  server.post('/spec/branch/merge', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specBranchActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.mergeBranch(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `合并分支失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/branch/abandon — 废弃分支
  server.post('/spec/branch/abandon', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specBranchActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.abandonBranch(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `废弃分支失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/branch/diff — 对比分支与主分支的差异
  const specBranchDiffQuerySchema = z.object({
    workspacePath: z.string().min(1),
    branchName: z.string().min(1),
    scopeType: z.enum(['file', 'dir', 'workspace']).default('workspace'),
    scopePath: z.string().optional(),
  })

  server.get('/spec/branch/diff', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specBranchDiffQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const { workspacePath, branchName, scopeType, scopePath } = parsed.data
      const data = await specService.diffBranch(
        request,
        workspacePath,
        { type: scopeType, path: scopePath },
        branchName,
      )
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `分支 diff 失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/generate-from-requirement — 从需求文档/截图描述自动生成 spec 草稿
  const specGenerateFromRequirementSchema = z.object({
    requirement: z.string().min(1),
    format: z.enum(['text', 'markdown', 'image_description']).default('text'),
  })

  server.post('/spec/generate-from-requirement', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specGenerateFromRequirementSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.generateFromRequirement(
        request,
        parsed.data.requirement,
        parsed.data.format,
      )
      return reply.send(success(data))
    } catch (e) {
      const msg = (e as Error).message || ''
      if (msg.includes('llm_unavailable')) {
        return reply.status(503).send(error(503, 'llm_unavailable'))
      }
      return reply.status(502).send(error(502, `智能生成失败: ${msg}`))
    }
  })
}

export default specRoutes
