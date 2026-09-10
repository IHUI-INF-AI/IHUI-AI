// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Repo Wiki 路由 (2026-09-07 新增,Repo Wiki MVP)
 *
 * 挂载前缀(由主控统一注册,建议 /api/repo-wiki):
 * - POST /generate  生成 Repo Wiki(仓库总览 + 模块文档)
 * - GET  /          按仓库名列文档(本人 + 全局 wiki)
 * - GET  /:id       文档详情
 * - DELETE /:id     删除文档(仅本人)
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { repoWikiDocs } from '@ihui/database'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { parseOrThrow, success, error } from '../utils/response.js'
import { generateRepoWiki } from '../services/repo-wiki-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const generateSchema = z.object({
  repoName: z.string().min(1, '仓库名不能为空').max(200),
  model: z.string().min(1).max(128).optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1, '文件路径不能为空').max(500),
        content: z.string().min(1, '文件内容不能为空').max(200_000),
      }),
    )
    .min(1, '文件清单不能为空')
    .max(400, '文件数量超出上限(400)'),
})

const listQuerySchema = z.object({
  repoName: z.string().min(1, '仓库名不能为空').max(200),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的文档 ID' }) })

// =============================================================================
// 鉴权
// =============================================================================

/** 登录校验(authenticate 失败 → 401;成功后 request.userId 可用) */
async function requireLogin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    return reply.status(statusCode).send(error(statusCode, '请先登录'))
  }
}

// =============================================================================
// 路由
// =============================================================================

export const repoWikiRoutes: FastifyPluginAsync = async (app) => {
  // POST /generate — 生成 Repo Wiki
  app.post('/generate', { preHandler: requireLogin }, async (request, reply) => {
    const body = parseOrThrow(generateSchema, request.body)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    try {
      const result = await generateRepoWiki({
        userId,
        repoName: body.repoName,
        model: body.model,
        files: body.files,
      })
      return reply.send(success(result))
    } catch (e) {
      request.log.warn(
        { repoName: body.repoName, err: (e as Error).message },
        '[RepoWiki] 生成失败',
      )
      return reply.status(502).send(error(502, `Wiki 生成失败:${(e as Error).message}`))
    }
  })

  // GET / — 按仓库名列文档(本人 + 全局,按生成时间倒序)
  app.get('/', { preHandler: requireLogin }, async (request, reply) => {
    const query = parseOrThrow(listQuerySchema, request.query)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const rows = await db
      .select({
        id: repoWikiDocs.id,
        repoName: repoWikiDocs.repoName,
        kind: repoWikiDocs.kind,
        modulePath: repoWikiDocs.modulePath,
        title: repoWikiDocs.title,
        model: repoWikiDocs.model,
        fileCount: repoWikiDocs.fileCount,
        generatedAt: repoWikiDocs.generatedAt,
      })
      .from(repoWikiDocs)
      .where(
        and(
          eq(repoWikiDocs.repoName, query.repoName),
          or(eq(repoWikiDocs.userId, userId), isNull(repoWikiDocs.userId)),
        ),
      )
      .orderBy(desc(repoWikiDocs.generatedAt))
      .limit(100)
    return reply.send(success(rows))
  })

  // GET /:id — 文档详情(本人或全局可见)
  app.get('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const [row] = await db
      .select()
      .from(repoWikiDocs)
      .where(eq(repoWikiDocs.id, params.id))
      .limit(1)
    if (!row || (row.userId !== null && row.userId !== userId)) {
      return reply.status(404).send(error(404, '文档不存在'))
    }
    return reply.send(success(row))
  })

  // DELETE /:id — 删除文档(简化:仅本人可删)
  app.delete('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const [row] = await db
      .select({ id: repoWikiDocs.id, userId: repoWikiDocs.userId })
      .from(repoWikiDocs)
      .where(eq(repoWikiDocs.id, params.id))
      .limit(1)
    if (!row || row.userId !== userId) {
      return reply.status(404).send(error(404, '文档不存在或无权删除'))
    }
    await db.delete(repoWikiDocs).where(eq(repoWikiDocs.id, params.id))
    return reply.send(success({ deleted: true }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
