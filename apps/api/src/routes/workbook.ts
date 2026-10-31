// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作簿 agent 命令面路由(2026-11-02 立,goal-b45 F 席)。
 *
 * 对标取证:`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md` §B
 * 对照件 `xlsx-sidecar.exe` 的 14 枚命令里,本仓这一格只取 **open / read_range / write_cells /
 * save / close** 五条最小集(不照抄 14 条凑数);`recalc_cells` 与 `convert_workbook` **未做**
 * —— 判据与三条红线(非破坏式保存 / 公式不回缓存值 / 不把公式换成静态值)全部住在
 * `services/workbook-service.ts`,本文件只做承载层:鉴权、入参形状、状态码映射,零业务判据(§0.6)。
 *
 * 挂载(由 routes/index.ts 注册):
 *   import { workbookRoutes } from './workbook.js'
 *   server.register(workbookRoutes, { prefix: '/api/workbook' })
 *
 * 身份(AGENTS §5「认证不等于授权」):
 * - 主体一律取承载层注入的 `request.userId`(人用 JWT;ai-service 经内部票 + X-User-Id,
 *   由 `checkAuthOrInternalService` 验票后注入)。**body 里没有任何身份字段**,
 *   模型/客户端自报的 userId 无处可写;也不从工作簿内容或文件元数据反推主体。
 * - 归属判据(谁能开这份档)在 `workbook-service.openWorkbook` 里现问元数据侧车并逐字比 subject,
 *   不符 ⇒ 与"文件不存在"同形回话(不给枚举留缝)。
 * - 会话句柄绑定主体:跨主体拿别人的句柄 ⇒ 403 + 零副作用。
 *
 * 三态诚实(§0.3):句柄取不到 ⇒ 410 `WORKBOOK_HANDLE_UNDETERMINED`(明写"无法判定",
 * 不拿旧状态冒充);原档字节读不到 ⇒ 503 `WORKBOOK_UNJUDGED`(不猜)。
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuthOrInternalService } from '../plugins/auth.js'
import { error, parseOrThrow, success } from '../utils/response.js'
import {
  WORKBOOK_PROTOCOL_VERSION,
  closeWorkbook,
  openWorkbook,
  readRange,
  saveWorkbook,
  writeCells,
  type WorkbookErrorCode,
  type WorkbookResult,
} from '../services/workbook-service.js'

/** 错误码 → HTTP 状态(映射表随命令面一起在册,端上只认 errorCode 不猜状态)。 */
const STATUS_BY_ERROR: Record<WorkbookErrorCode, number> = {
  WORKBOOK_INVALID_INPUT: 400,
  WORKBOOK_FILE_NOT_FOUND: 404,
  WORKBOOK_HANDLE_UNDETERMINED: 410,
  WORKBOOK_FORBIDDEN_OWNER: 403,
  WORKBOOK_FORMAT_UNSUPPORTED: 415,
  WORKBOOK_FORMULA_OVERWRITE: 409,
  WORKBOOK_RANGE_TOO_LARGE: 413,
  WORKBOOK_SOURCE_CHANGED: 409,
  WORKBOOK_UNJUDGED: 503,
}

const handleSchema = z.string().regex(/^[0-9a-f]{32}$/, '句柄形态非法')

const openSchema = z.object({
  fileId: z.string().regex(/^[0-9a-fA-F-]{16,64}$/, 'fileId 形态非法'),
})

const readSchema = z.object({
  handle: handleSchema,
  sheet: z.string().min(1).max(255),
  range: z.string().min(1).max(64),
})

const writeSchema = z.object({
  handle: handleSchema,
  sheet: z.string().min(1).max(255),
  cells: z
    .array(
      z.object({
        address: z.string().min(1).max(16),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      }),
    )
    .min(1)
    .max(500),
})

const saveSchema = z.object({
  handle: handleSchema,
  name: z.string().min(1).max(255).optional(),
})

const closeSchema = z.object({ handle: handleSchema })

export const workbookRoutes: FastifyPluginAsync = async (app) => {
  // 整棵子树都要身份:人用 JWT 或内部服务票(ai-service 经此通道时主体由验票侧注入)
  app.addHook('preHandler', async (request, reply) => {
    if (!(await checkAuthOrInternalService(request, reply))) return reply
  })

  /** 承载层取主体;拿不到就是拿不到 —— 不回落、不默认、不反推。 */
  const subjectOf = (request: { userId?: string }): string => String(request.userId ?? '')

  const send = <T>(reply: FastifyReply, result: WorkbookResult<T>) => {
    if (result.ok)
      return reply.send(success({ ...result.data, protocolVersion: WORKBOOK_PROTOCOL_VERSION }))
    const status = STATUS_BY_ERROR[result.errorCode] ?? 400
    return reply
      .status(status)
      .send({ ...error(status, result.message, result.errorCode), detail: result.detail ?? null })
  }

  // POST /open — 打开**已存在**的工作簿(按 storage 文件 id)
  app.post('/open', async (request, reply) => {
    const body = parseOrThrow(openSchema, request.body)
    return send(reply, await openWorkbook({ subjectId: subjectOf(request), fileId: body.fileId }))
  })

  // POST /read — 读区域(公式格只回公式原文 + formula-uncomputed,不回缓存值)
  app.post('/read', async (request, reply) => {
    const body = parseOrThrow(readSchema, request.body)
    return send(
      reply,
      readRange({
        subjectId: subjectOf(request),
        handle: body.handle,
        sheet: body.sheet,
        range: body.range,
      }),
    )
  })

  // POST /write — 写单元格(目标含公式 ⇒ 整批拒写;改动波及公式 ⇒ recalcUnsupported)
  app.post('/write', async (request, reply) => {
    const body = parseOrThrow(writeSchema, request.body)
    return send(
      reply,
      writeCells({
        subjectId: subjectOf(request),
        handle: body.handle,
        sheet: body.sheet,
        cells: body.cells,
      }),
    )
  })

  // POST /save — 非破坏式保存:**只落新文件**,原档一字节不动
  app.post('/save', async (request, reply) => {
    const body = parseOrThrow(saveSchema, request.body)
    return send(
      reply,
      await saveWorkbook({ subjectId: subjectOf(request), handle: body.handle, name: body.name }),
    )
  })

  // POST /close — 释放会话(之后再拿这个句柄 ⇒ 未判定)
  app.post('/close', async (request, reply) => {
    const body = parseOrThrow(closeSchema, request.body)
    return send(reply, closeWorkbook({ subjectId: subjectOf(request), handle: body.handle }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
