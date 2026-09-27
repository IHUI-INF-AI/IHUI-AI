// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { appVersions } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

// `cli` 档于 2026-09-27 补入(G-243):该端在此之前没有 CLI 档 ⇒ 服务端下发的最低版本
// 对 CLI 结构上不可达（枚举就是可达面）。列名是 varchar(16),无需迁移即可写入。
const platformSchema = z.enum(['ios', 'android', 'web', 'harmony', 'cli'])

const listQuerySchema = z.object({
  platform: z.string().optional().transform(emptyToUndefined).pipe(platformSchema.optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const latestQuerySchema = z.object({
  platform: z.string().optional().transform(emptyToUndefined).pipe(platformSchema.optional()),
})

const checkUpdateSchema = z.object({
  platform: platformSchema,
  version: z.string().min(1).max(32),
})

const createVersionSchema = z.object({
  version: z.string().min(1).max(32),
  platform: platformSchema,
  buildNumber: z.number().int().min(0),
  downloadUrl: z.string().max(512).optional(),
  forceUpdate: z.boolean().optional(),
  releaseNotes: z.string().max(5000).optional(),
  status: z.enum(['latest', 'history', 'disabled']).optional(),
})

const updateVersionSchema = z.object({
  version: z.string().min(1).max(32).optional(),
  buildNumber: z.number().int().min(0).optional(),
  downloadUrl: z.string().max(512).optional(),
  forceUpdate: z.boolean().optional(),
  releaseNotes: z.string().max(5000).optional(),
  status: z.enum(['latest', 'history', 'disabled']).optional(),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

// =============================================================================
// CLI 最低版本闸门（服务端下发，2026-09-27 G-243）
// =============================================================================
//
// 为什么在路由文件里而不是抽一个 service：这一档的真值来源只有「env / 配置文件 / 无」三态，
// 判据是一个不碰文件系统的纯函数（decideCliMinimumVersion），抽 service 只是把一次读取搬两个文件。
//
// 取值优先级（显式且可测）：**环境变量 > 配置文件 > 无配置（= 不拦）**。
// 三条设计约束（用户 2026-09-27 拍板「默认可远程改」时带来的判据，不是偏好）：
//   1. 配错一律降级成「不拦」并写明原因 —— 挡住全部用户比旧 CLI 跑新契约更坏；
//   2. 未配置与配错都返回同一个形状（minimumVersion:null ⇔ source:'none'），消费方不得按形状分支；
//   3. 结论为什么是这样必须随响应回来 —— 「放行」也要留痕，静默变短等于伪造完整性。
//
// 配置文件档的覆盖面如实登记：`deploy/docker/Dockerfile.api` 的最终镜像只 COPY
// `apps/api/dist` + `package.json` + `packages` + `node_modules`，**不含仓库根 `config/`**，
// 所以容器内该档恒不可达（⇒ 降级成「不拦」，不炸）。nssm/裸进程那台机器跑的是完整 checkout，
// 该档可达。要改这个边界请先动 Dockerfile 的 COPY 清单，不要在这里改用绝对路径。

/** 只接受 X.Y.Z 三段数字 —— 与 CLI 侧 `updater.ts#compareVersions` 的解析口径同形。 */
const MIN_VERSION_RE = /^\d+\.\d+\.\d+$/

/** 环境变量名与配置文件默认候选路径（IHUI_CLI_MIN_VERSION_FILE 可覆盖，见 candidateConfigPaths）。 */
export const CLI_MIN_VERSION_ENV = 'IHUI_CLI_MIN_VERSION'
export const CLI_MIN_VERSION_FILE_ENV = 'IHUI_CLI_MIN_VERSION_FILE'
export const CLI_MIN_VERSION_RELATIVE_PATH = join('config', 'cli-min-version.json')

export type CliMinVersionSource = 'env' | 'file' | 'none'

export interface CliMinVersionDecision {
  /** null = 服务端没有要求 ⇒ CLI 一律放行。 */
  minimumVersion: string | null
  source: CliMinVersionSource
  /** 真值出处 + 为什么是这个结论（人在终端能直接读）。 */
  reason: string
}

export interface CliMinVersionInputs {
  envValue: string | undefined
  /** 配置文件正文；null = 文件不存在（不是错误）。 */
  fileText: string | null
  /** 读文件本身失败（权限/IO）的说明；成功或不存在时为 null。 */
  fileError: string | null
  /** 仅用于把默认路径写进 reason，便于人核对。 */
  configPath: string
}

const JSON_PARSE_FAILED = Symbol('json-parse-failed')

function safeParseJson(text: string): unknown | typeof JSON_PARSE_FAILED {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return JSON_PARSE_FAILED
  }
}

/**
 * 纯判据：三态决策。不碰文件系统，所以优先级与降级路径都能被单测逐条钉住。
 */
export function decideCliMinVersion(input: CliMinVersionInputs): CliMinVersionDecision {
  const envRaw = typeof input.envValue === 'string' ? input.envValue.trim() : ''
  if (envRaw !== '') {
    if (MIN_VERSION_RE.test(envRaw)) {
      return {
        minimumVersion: envRaw,
        source: 'env',
        reason: `环境变量 ${CLI_MIN_VERSION_ENV}=${envRaw}（优先级高于配置文件 ${input.configPath}）`,
      }
    }
    return {
      minimumVersion: null,
      source: 'none',
      reason:
        `环境变量 ${CLI_MIN_VERSION_ENV}="${envRaw}" 不是 X.Y.Z 形态 ⇒ 按未配置处理（不拦）。` +
        `配错挡住全部用户比旧 CLI 跑新契约更坏，故此处降级而不报错`,
    }
  }

  if (input.fileError !== null) {
    return {
      minimumVersion: null,
      source: 'none',
      reason: `配置文件 ${input.configPath} 读取失败（${input.fileError}）⇒ 不拦`,
    }
  }

  if (input.fileText !== null) {
    const parsed: unknown = safeParseJson(input.fileText)
    if (parsed === JSON_PARSE_FAILED) {
      return {
        minimumVersion: null,
        source: 'none',
        reason: `配置文件 ${input.configPath} 不是合法 JSON ⇒ 不拦`,
      }
    }
    const field =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>).minimumVersion
        : undefined
    if (typeof field !== 'string' || field.trim() === '') {
      return {
        minimumVersion: null,
        source: 'none',
        reason: `配置文件 ${input.configPath} 缺少字符串字段 minimumVersion ⇒ 不拦`,
      }
    }
    const value = field.trim()
    if (!MIN_VERSION_RE.test(value)) {
      return {
        minimumVersion: null,
        source: 'none',
        reason: `配置文件 ${input.configPath} 的 minimumVersion="${value}" 不是 X.Y.Z 形态 ⇒ 不拦`,
      }
    }
    return {
      minimumVersion: value,
      source: 'file',
      reason: `配置文件 ${input.configPath}（未设 ${CLI_MIN_VERSION_ENV}，故按第二优先级取文件）`,
    }
  }

  return {
    minimumVersion: null,
    source: 'none',
    reason: `未配置：环境变量 ${CLI_MIN_VERSION_ENV} 未设且 ${input.configPath} 不存在 ⇒ 不拦（默认档）`,
  }
}

/**
 * 配置文件候选路径：显式 env 覆盖 > cwd 相对 > cwd 上两级相对（仓库根）。
 * 两候选的写法照抄 `feature-center.ts` 的 DOCS_DIR（同一 cwd 假设在 dev/nssm/容器下不同）。
 */
export function candidateConfigPaths(cwd: string = process.cwd()): string[] {
  const override = process.env[CLI_MIN_VERSION_FILE_ENV]?.trim()
  if (override) return [override]
  return [
    join(cwd, CLI_MIN_VERSION_RELATIVE_PATH),
    join(cwd, '..', '..', CLI_MIN_VERSION_RELATIVE_PATH),
  ]
}

/**
 * 带 IO 的取真值：读文件（不存在不算错）后交给纯判据。
 * 任何异常都被折进 reason，绝不抛出 —— 抛出会让这个公开接口 500，
 * 而 CLI 侧对 500 的行为是「放行」，等于把配置事故伪装成「服务端没要求」。
 */
export function resolveCliMinVersion(cwd?: string): CliMinVersionDecision {
  const paths = candidateConfigPaths(cwd)
  const configPath = paths[0] ?? ''
  let fileText: string | null = null
  let fileError: string | null = null
  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      fileText = readFileSync(p, 'utf-8')
    } catch (e) {
      fileError = e instanceof Error ? e.message : String(e)
    }
    break
  }
  return decideCliMinVersion({
    envValue: process.env[CLI_MIN_VERSION_ENV],
    fileText,
    fileError,
    configPath,
  })
}

// =============================================================================
// 路由
// =============================================================================

const appVersionRoutes: FastifyPluginAsync = async (server) => {
  // GET /latest — 获取最新版本（公开，按 platform 筛选）
  server.get('/latest', async (request, reply) => {
    const parsed = latestQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conditions = [eq(appVersions.status, 'latest')]
    if (parsed.data.platform) {
      conditions.push(eq(appVersions.platform, parsed.data.platform))
    }
    const [latest] = await db
      .select()
      .from(appVersions)
      .where(and(...conditions))
      .orderBy(desc(appVersions.buildNumber))
      .limit(1)
    return reply.send(success({ latest }))
  })

  // GET /min-cli-version — CLI 最低版本闸门（公开，无鉴权、无 DB）
  // 未配置时 minimumVersion=null ⇒ 消费方（CLI）一律放行；结论出处随 reason 回传。
  server.get('/min-cli-version', async (_request, reply) => {
    return reply.send(success({ platform: 'cli', ...resolveCliMinVersion() }))
  })

  // GET / — 版本列表（admin，分页 + platform 筛选）
  server.get('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { platform, page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize
    const conditions = platform ? [eq(appVersions.platform, platform)] : []

    const list = await db
      .select()
      .from(appVersions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(appVersions.createdAt))
      .limit(pageSize)
      .offset(offset)

    return reply.send(success({ list, page, pageSize }))
  })

  // POST / — 发布新版本（admin）
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createVersionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 若新版本标记为 latest，则将同平台旧 latest 降级为 history
    if (parsed.data.status === 'latest' || !parsed.data.status) {
      await db
        .update(appVersions)
        .set({ status: 'history' })
        .where(
          and(eq(appVersions.platform, parsed.data.platform), eq(appVersions.status, 'latest')),
        )
    }
    const [version] = await db
      .insert(appVersions)
      .values({
        ...parsed.data,
        status: parsed.data.status ?? 'latest',
      })
      .returning()
    return reply.status(201).send(success({ version }))
  })

  // PUT /:id — 修改版本（admin）
  server.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsedP = idParamSchema.safeParse(request.params)
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
    }
    const parsedB = updateVersionSchema.safeParse(request.body)
    if (!parsedB.success) {
      return reply.status(400).send(error(400, parsedB.error.issues[0]?.message ?? '参数错误'))
    }
    const updates = parsedB.data
    if (Object.keys(updates).length === 0) {
      return reply.status(400).send(error(400, '无更新字段'))
    }
    // 若更新为 latest，则将同平台旧 latest 降级为 history
    if (updates.status === 'latest') {
      const [existing] = await db
        .select()
        .from(appVersions)
        .where(eq(appVersions.id, parsedP.data.id))
        .limit(1)
      if (existing) {
        await db
          .update(appVersions)
          .set({ status: 'history' })
          .where(and(eq(appVersions.platform, existing.platform), eq(appVersions.status, 'latest')))
      }
    }
    const [version] = await db
      .update(appVersions)
      .set(updates)
      .where(eq(appVersions.id, parsedP.data.id))
      .returning()
    if (!version) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    return reply.send(success({ version }))
  })

  // DELETE /:id — 删除版本（admin）
  server.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsedP = idParamSchema.safeParse(request.params)
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
    }
    const removed = await db
      .delete(appVersions)
      .where(eq(appVersions.id, parsedP.data.id))
      .returning({ id: appVersions.id })
    if (removed.length === 0) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // GET /check-update — 检查更新（公开，对比当前版本与最新版本）
  server.get('/check-update', async (request, reply) => {
    const parsed = checkUpdateSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { platform, version } = parsed.data
    // 查找当前版本记录以获取 buildNumber
    const [current] = await db
      .select()
      .from(appVersions)
      .where(and(eq(appVersions.platform, platform), eq(appVersions.version, version)))
      .limit(1)
    // 查找该平台最新版本（status=latest）
    const [latest] = await db
      .select()
      .from(appVersions)
      .where(and(eq(appVersions.platform, platform), eq(appVersions.status, 'latest')))
      .orderBy(desc(appVersions.buildNumber))
      .limit(1)

    if (!latest) {
      return reply.send(
        success({
          hasUpdate: false,
          latestVersion: version,
          forceUpdate: false,
          downloadUrl: null,
        }),
      )
    }

    const currentBuild = current?.buildNumber ?? 0
    const hasUpdate = latest.buildNumber > currentBuild
    return reply.send(
      success({
        hasUpdate,
        latestVersion: latest.version,
        forceUpdate: hasUpdate ? latest.forceUpdate : false,
        downloadUrl: latest.downloadUrl ?? null,
        releaseNotes: latest.releaseNotes ?? null,
      }),
    )
  })

  // POST /:id/disable — 禁用版本（admin，将 status 设为 disabled）
  server.post('/:id/disable', { preHandler: requireAdmin }, async (request, reply) => {
    const parsedP = idParamSchema.safeParse(request.params)
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
    }
    const [version] = await db
      .update(appVersions)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(appVersions.id, parsedP.data.id))
      .returning()
    if (!version) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    return reply.send(success({ version }))
  })
}

export default appVersionRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
