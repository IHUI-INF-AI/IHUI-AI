/**
 * CLI 配置导入路由
 *
 * 6 个端点:
 *   1. POST /cli-import/parse-file      multipart 上传文件,服务端解析
 *   2. POST /cli-import/parse-payload   CLI/Desktop 已解析后直接 POST ImportedProvider[]
 *   3. POST /cli-import/commit          用 previewId 取回 preview,落库
 *   4. GET  /cli-import/history         当前用户的导入历史
 *   5. GET  /cli-import/preview/:id     重新获取 preview(commit 前复核)
 *   6. GET  /cli-import/sources         列出支持的导入来源(供 UI 渲染卡片)
 *
 * 设计要点:
 * - 所有端点都要求登录(preHandler authenticate)
 * - apiKey 在响应前必须经 maskApiKey 脱敏
 * - commit 时按 conflictStrategy 处理重复:
 *   skip: 跳过已存在
 *   overwrite: 删除旧 + 插入新
 *   clone: 强制插入新(name 加 #2/#3 后缀)
 * - 落库前 apiKey 用 encryptJSON 加密
 * - commit 完成后写 cli_provider_imports 历史记录
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { aiModelConfig, cliProviderImports } from '@ihui/database'
import {
  type CliConfigSource,
  type ImportCommitResponse,
  type ImportHistoryItem,
  type ImportPreview,
  type ImportedProvider,
} from '@ihui/types'

import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { encryptJSON } from '../utils/crypto.js'
import {
  listSupportedSources,
  loadPreview,
  parseBySource,
  savePreview,
  deletePreview,
} from '../services/cli-import/index.js'

// =============================================================================
// Schemas
// =============================================================================

const sourceSchema = z.enum([
  'cc-switch',
  'codex++',
  'claude-cli',
  'codex-cli',
  'gemini-cli',
  'hermes',
])

const parsePayloadSchema = z.object({
  source: sourceSchema,
  sourcePath: z.string().min(1).max(500),
  sourceVersion: z.string().max(64).optional(),
  /** 已解析的 provider 列表(CLI/Desktop 端解析后直接上报) */
  providers: z.array(
    z.object({
      sourceId: z.string().min(1).max(128),
      sourceAppType: z.string().max(32).optional(),
      name: z.string().min(1).max(100),
      providerCode: z.string().min(1).max(64),
      baseUrl: z.string().max(500).default(''),
      apiKey: z.string().max(500).optional(),
      apiFormat: z.enum(['openai_chat', 'anthropic_messages', 'openai_responses', 'gemini_native']),
      modelIdForTest: z.string().max(128).optional(),
      extraConfig: z.record(z.unknown()).optional(),
      meta: z.record(z.unknown()).optional(),
      isCurrent: z.boolean().default(false),
      warnings: z.array(z.string()).default([]),
    }),
  ),
  mcpServers: z.array(z.any()).optional(),
  globalWarnings: z.array(z.string()).default([]),
})

const commitSchema = z.object({
  previewId: z.string().min(1).max(128),
  selectedProviderIds: z.array(z.string()).default([]),
  conflictStrategy: z.enum(['overwrite', 'skip', 'clone']),
})

const previewIdParamSchema = z.object({
  id: z.string().min(1).max(128),
})

// =============================================================================
// Helpers
// =============================================================================

/**
 * 给前端返回的 provider 脱敏(去除 apiKey,保留 warnings)。
 */
function maskProvider(p: ImportedProvider): ImportedProvider {
  return {
    ...p,
    apiKey: undefined,
    warnings: p.warnings.length > 0 ? p.warnings : [],
  }
}

function maskPreview(preview: ImportPreview): ImportPreview {
  return {
    ...preview,
    providers: preview.providers.map(maskProvider),
  }
}

/**
 * 写入 ai_model_config 表(单条 provider)。
 *
 * 冲突处理:
 * - skip: 查 (ownerUuid, importSource, importSourceId) 已存在 → 跳过返回 null
 * - overwrite: 删除已存在同 (ownerUuid, importSource, importSourceId) → 插入新
 * - clone: 强制插入,name 加 #N 后缀避免重名
 */
async function insertProvider(
  userId: string,
  preview: ImportPreview,
  p: ImportedProvider,
  strategy: 'overwrite' | 'skip' | 'clone',
): Promise<{ id: number } | { skipped: true } | { failed: true; reason: string }> {
  try {
    // 查重(基于 partial unique index)
    const existing = await db
      .select({ id: aiModelConfig.id, name: aiModelConfig.name })
      .from(aiModelConfig)
      .where(
        and(
          eq(aiModelConfig.ownerUuid, userId),
          eq(aiModelConfig.importSource, preview.source),
          eq(aiModelConfig.importSourceId, p.sourceId),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      if (strategy === 'skip') {
        return { skipped: true }
      }
      if (strategy === 'overwrite') {
        await db.delete(aiModelConfig).where(eq(aiModelConfig.id, existing[0]!.id))
      }
      // clone: 不删,继续插入
    }

    let finalName = p.name
    if (strategy === 'clone' && existing.length > 0) {
      // 加序号后缀
      const baseName = p.name
      const sameNameCount = await db
        .select({ id: aiModelConfig.id })
        .from(aiModelConfig)
        .where(and(eq(aiModelConfig.ownerUuid, userId), eq(aiModelConfig.name, baseName)))
      finalName = `${baseName} #${sameNameCount.length + 1}`.slice(0, 100)
    }

    const apiKeyEnc = p.apiKey ? JSON.stringify(encryptJSON(p.apiKey)) : null
    const [row] = await db
      .insert(aiModelConfig)
      .values({
        name: finalName,
        providerCode: p.providerCode,
        isBuiltin: false,
        baseUrl: p.baseUrl || '',
        apiFormat: p.apiFormat,
        apiKeyEnc,
        modelIdForTest: p.modelIdForTest ?? null,
        enabled: true,
        description: p.meta?.notes ?? null,
        sortOrder: 0,
        ownerUuid: userId,
        extraConfig: p.extraConfig ? JSON.stringify(p.extraConfig) : null,
        iconSvg: p.meta?.icon ?? null,
        importSource: preview.source,
        importSourceId: p.sourceId,
        importSourceAppType: p.sourceAppType ?? null,
      })
      .returning({ id: aiModelConfig.id })
    if (!row) return { failed: true, reason: '数据库插入失败' }
    return { id: row.id }
  } catch (err) {
    return { failed: true, reason: (err as Error).message }
  }
}

// =============================================================================
// Route
// =============================================================================

export const cliImportRoutes: FastifyPluginAsync = async (server) => {
  // 所有路由要求登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // -------------------------------------------------------------------------
  // 1. GET /cli-import/sources — 列出支持的导入来源
  // -------------------------------------------------------------------------
  server.get('/cli-import/sources', async (_request, reply) => {
    const sources = listSupportedSources()
    return reply.send(success({ sources }))
  })

  // -------------------------------------------------------------------------
  // 2. POST /cli-import/parse-file — multipart 上传文件,服务端解析
  // -------------------------------------------------------------------------
  server.post('/cli-import/parse-file', async (request, reply) => {
    const userId = request.userId!
    const parts = request.parts()
    let source: CliConfigSource | undefined
    let fileBuffer: Buffer | undefined
    let fileName: string | undefined
    let authJsonText: string | undefined
    let settingsJsonText: string | undefined

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'source') {
          const val = (await part.value) as string
          const parsed = sourceSchema.safeParse(val)
          if (parsed.success) source = parsed.data
        } else if (part.fieldname === 'authJson') {
          authJsonText = (await part.value) as string
        } else if (part.fieldname === 'settingsJson') {
          settingsJsonText = (await part.value) as string
        }
      } else if (part.type === 'file') {
        // 第一个文件即配置文件
        if (!fileBuffer) {
          fileBuffer = await part.toBuffer()
          fileName = part.filename
        }
      }
    }

    if (!source) {
      return reply.status(400).send(error(400, '缺少 source 字段'))
    }
    if (!fileBuffer) {
      return reply.status(400).send(error(400, '缺少上传的配置文件'))
    }

    try {
      const isBinary = source === 'cc-switch'
      const preview = await parseBySource(source, {
        sourcePath: fileName ?? source,
        buffer: isBinary ? fileBuffer : undefined,
        text: isBinary ? undefined : fileBuffer.toString('utf8'),
        extra: {
          ...(authJsonText ? { authJsonText } : {}),
          ...(settingsJsonText ? { settingsJsonText } : {}),
        },
      })
      request.log.info(
        { userId, source, previewId: preview.previewId, count: preview.providers.length },
        '[cli-import] parse-file success',
      )
      return reply.send(success({ preview: maskPreview(preview) }))
    } catch (err) {
      request.log.error({ err, source, fileName }, '[cli-import] parse-file failed')
      return reply.status(400).send(error(400, `解析失败: ${(err as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 3. POST /cli-import/parse-payload — CLI/Desktop 已解析后直接 POST
  // -------------------------------------------------------------------------
  server.post('/cli-import/parse-payload', async (request, reply) => {
    const userId = request.userId!
    const parsed = parsePayloadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const data = parsed.data
    try {
      const preview: ImportPreview = {
        previewId: crypto.randomUUID(),
        source: data.source,
        sourcePath: data.sourcePath,
        sourceVersion: data.sourceVersion,
        detectedAt: new Date().toISOString(),
        providers: data.providers as ImportedProvider[],
        mcpServers: data.mcpServers as ImportPreview['mcpServers'],
        globalWarnings: data.globalWarnings,
      }
      await savePreview(preview)
      request.log.info(
        {
          userId,
          source: data.source,
          previewId: preview.previewId,
          count: preview.providers.length,
        },
        '[cli-import] parse-payload saved',
      )
      return reply.send(success({ preview: maskPreview(preview) }))
    } catch (err) {
      return reply.status(500).send(error(500, `保存 preview 失败: ${(err as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 4. POST /cli-import/commit — 用 previewId 落库
  // -------------------------------------------------------------------------
  server.post('/cli-import/commit', async (request, reply) => {
    const userId = request.userId!
    const parsed = commitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { previewId, selectedProviderIds, conflictStrategy } = parsed.data

    const preview = await loadPreview(previewId)
    if (!preview) {
      return reply.status(404).send(error(404, 'preview 已过期或不存在,请重新解析'))
    }

    // 用户身份校验:preview 仅缓存 10min,无 userId 标签;但 commit 必须由登录用户发起
    // 这里通过 authenticate 已保证 userId 存在

    const selected =
      selectedProviderIds.length === 0
        ? preview.providers
        : preview.providers.filter((p) => selectedProviderIds.includes(p.sourceId))

    const configIds: number[] = []
    const failedDetails: ImportCommitResponse['failedDetails'] = []
    let skipped = 0

    for (const p of selected) {
      const result = await insertProvider(userId, preview, p, conflictStrategy)
      if ('id' in result) {
        configIds.push(result.id)
      } else if ('skipped' in result) {
        skipped += 1
      } else {
        failedDetails.push({ sourceId: p.sourceId, reason: result.reason })
      }
    }

    const imported = configIds.length
    const failed = failedDetails.length
    const status: ImportHistoryItem['status'] =
      failed === 0 ? 'success' : imported === 0 ? 'failed' : 'partial'

    // 写入 cli_provider_imports 历史记录
    const importId = crypto.randomUUID()
    try {
      await db.insert(cliProviderImports).values({
        id: importId,
        ownerUuid: userId,
        source: preview.source,
        sourceAppType: null,
        sourcePath: preview.sourcePath,
        sourceVersion: preview.sourceVersion ?? null,
        importedCount: imported,
        skippedCount: skipped,
        failedCount: failed,
        importPreview: maskPreview(preview) as unknown as Record<string, unknown>,
        status,
        errorMessage: failed > 0 ? `${failed} 条失败` : null,
      })
    } catch (err) {
      request.log.error({ err, importId }, '[cli-import] failed to write history')
      // 历史记录写入失败不阻塞交付
    }

    // 删除 preview 缓存
    await deletePreview(previewId)

    const response: ImportCommitResponse = {
      importId,
      imported,
      skipped,
      failed,
      failedDetails,
      configIds,
    }
    request.log.info(
      { userId, importId, source: preview.source, imported, skipped, failed },
      '[cli-import] commit done',
    )
    return reply.send(success(response))
  })

  // -------------------------------------------------------------------------
  // 5. GET /cli-import/preview/:id — 复核 preview
  // -------------------------------------------------------------------------
  server.get('/cli-import/preview/:id', async (request, reply) => {
    const p = previewIdParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 previewId'))
    const preview = await loadPreview(p.data.id)
    if (!preview) {
      return reply.status(404).send(error(404, 'preview 已过期或不存在'))
    }
    return reply.send(success({ preview: maskPreview(preview) }))
  })

  // -------------------------------------------------------------------------
  // 6. GET /cli-import/history — 用户导入历史
  // -------------------------------------------------------------------------
  server.get('/cli-import/history', async (request, reply) => {
    const userId = request.userId!
    const limit = 50
    const rows = await db
      .select({
        id: cliProviderImports.id,
        source: cliProviderImports.source,
        sourcePath: cliProviderImports.sourcePath,
        sourceVersion: cliProviderImports.sourceVersion,
        importedCount: cliProviderImports.importedCount,
        skippedCount: cliProviderImports.skippedCount,
        failedCount: cliProviderImports.failedCount,
        status: cliProviderImports.status,
        errorMessage: cliProviderImports.errorMessage,
        importedAt: cliProviderImports.importedAt,
      })
      .from(cliProviderImports)
      .where(eq(cliProviderImports.ownerUuid, userId))
      .orderBy(desc(cliProviderImports.importedAt))
      .limit(limit)

    const list: ImportHistoryItem[] = rows.map((r) => ({
      id: r.id,
      source: r.source as CliConfigSource,
      sourcePath: r.sourcePath,
      sourceVersion: r.sourceVersion ?? undefined,
      importedCount: r.importedCount,
      skippedCount: r.skippedCount,
      failedCount: r.failedCount,
      status: r.status as ImportHistoryItem['status'],
      errorMessage: r.errorMessage ?? undefined,
      importedAt: r.importedAt.toISOString(),
    }))
    return reply.send(success({ list, total: list.length }))
  })
}
