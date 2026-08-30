/**
 * 代码生成器路由。
 *
 * 表结构:
 *   gen_table(table_id, table_name, table_comment, class_name, module_name, business_name, ...)
 *   gen_table_column(column_id, table_id, column_name, column_comment, column_type, is_pk, ...)
 *
 * 能力:
 *   POST /gen-table/import      从 information_schema 读取表列结构,写入 gen_table + gen_table_column
 *   GET  /gen-table/tables      已导入表列表(分页)
 *   GET  /gen-table/tables/:id  详情(含列)
 *   POST /gen-table/tables/:id/generate  生成 TypeScript CRUD 路由模板
 *   DELETE /gen-table/tables/:id 删除导入记录(含列)
 *
 * 注意:本路由未注册到 routes/index.ts(由需求指定),测试与后续接入由调用方自行注册。
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { genTable, genTableColumn } from '@ihui/database'
import { success, paginatedSuccess, error, parseOrThrow } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'

const importSchema = z.object({
  tableName: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  tableComment: z.string().max(500).optional(),
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** information_schema.columns 行结构 */
interface InformationSchemaColumn {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
  column_comment: string | null
}

// ─────────────────────────────────────────────────────────────
// 命名转换
// ─────────────────────────────────────────────────────────────

function snakeToPascal(input: string): string {
  return input
    .split('_')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

function snakeToCamel(input: string): string {
  const pascal = snakeToPascal(input)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function resolveNames(tableName: string): {
  className: string
  moduleName: string
  businessName: string
} {
  const segments = tableName.split('_').filter(Boolean)
  const className = snakeToPascal(tableName)
  const moduleName = segments.length > 1 ? (segments[0] ?? 'system') : 'system'
  const businessRaw = segments.length > 1 ? segments.slice(1).join('_') : tableName
  return { className, moduleName, businessName: snakeToCamel(businessRaw) }
}

// ─────────────────────────────────────────────────────────────
// 类型映射
// ─────────────────────────────────────────────────────────────

const SHORT_TYPE: Record<string, string> = {
  'character varying': 'varchar',
  character: 'char',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  integer: 'int4',
  bigint: 'int8',
  smallint: 'int2',
  numeric: 'numeric',
  'double precision': 'float8',
  real: 'float4',
  boolean: 'bool',
  jsonb: 'jsonb',
  json: 'json',
  uuid: 'uuid',
  text: 'text',
  date: 'date',
  'time without time zone': 'time',
}

function shortType(dataType: string): string {
  return SHORT_TYPE[dataType] ?? dataType
}

function javaType(dataType: string): string {
  const t = dataType.toLowerCase()
  if (t.includes('varchar') || t.includes('char') || t.includes('text') || t === 'uuid')
    return 'String'
  if (t.includes('int8') || t.includes('bigint')) return 'Long'
  if (t.includes('int') || t.includes('smallint')) return 'Integer'
  if (t.includes('numeric') || t.includes('decimal')) return 'BigDecimal'
  if (t.includes('double') || t.includes('real') || t.includes('float')) return 'Double'
  if (t.includes('bool')) return 'Boolean'
  if (t.includes('timestamp') || t.includes('date') || t.includes('time')) return 'Date'
  if (t.includes('json')) return 'Object'
  return 'String'
}

function htmlType(dataType: string): string {
  const t = dataType.toLowerCase()
  if (t.includes('timestamp') || t.includes('date') || t.includes('time')) return 'datetime'
  if (t.includes('text') || t.includes('json')) return 'textarea'
  if (
    t.includes('int') ||
    t.includes('numeric') ||
    t.includes('decimal') ||
    t.includes('real') ||
    t.includes('double') ||
    t.includes('float')
  )
    return 'number'
  if (t.includes('bool')) return 'checkbox'
  return 'input'
}

// ─────────────────────────────────────────────────────────────
// 生成代码模板({{TOKEN}} 占位,避免与模板字面量插值冲突)
// ─────────────────────────────────────────────────────────────

const CRUD_TEMPLATE = `// 由代码生成器生成 — {{functionName}} CRUD 路由模板
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error, paginatedSuccess, parseOrThrow } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'

// TODO: 引入实际表对应的 drizzle schema
// 例如: import { {{businessName}}Table } from '@ihui/database'

// {{functionName}} 创建/更新 zod schema(占位,按需调整字段类型与必填)
const createSchema = z.object({
{{columnZodLines}}
})
const updateSchema = createSchema.partial()

const {{businessName}}Routes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 列表(分页)
  server.get('/', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { page = 1, pageSize = 20 } = (req.query ?? {}) as { page?: number; pageSize?: number }
    const offset = (page - 1) * pageSize
    // TODO: 将 {{businessName}}Table 替换为实际表
    const [countRows, list] = await Promise.all([
      db.select({ count: sql<number>\`count(*)::int\` }).from({{businessName}}Table),
      db.select().from({{businessName}}Table).orderBy(desc({{businessName}}Table.createdAt)).limit(pageSize).offset(offset),
    ])
    return reply.send(paginatedSuccess(list, countRows[0]?.count ?? 0, { page, pageSize }))
  })

  // 详情
  server.get('/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    const [row] = await db.select().from({{businessName}}Table).where(eq({{businessName}}Table.id, id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  // 新增
  server.post('/', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const body = parseOrThrow(createSchema, req.body)
    const [row] = await db.insert({{businessName}}Table).values(body).returning()
    return reply.status(201).send(success(row))
  })

  // 更新
  server.patch('/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    const body = parseOrThrow(updateSchema, req.body)
    const [row] = await db
      .update({{businessName}}Table)
      .set({ ...body, updatedAt: new Date() })
      .where(eq({{businessName}}Table.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  // 删除
  server.delete('/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return
    const { id } = req.params as { id: string }
    await db.delete({{businessName}}Table).where(eq({{businessName}}Table.id, id))
    return reply.send(success({ deleted: true }))
  })
}

export default {{businessName}}Routes
`

function buildCode(
  input: {
    tableName: string
    tableComment: string
    className: string
    moduleName: string
    businessName: string
    functionName: string
  },
  columns: Array<{ javaField: string; columnComment: string }>,
): string {
  const columnZodLines = columns
    .map((c) => `  ${c.javaField}: z.string().optional(), // ${c.columnComment || c.javaField}`)
    .join('\n')
  return CRUD_TEMPLATE.replaceAll('{{tableName}}', input.tableName)
    .replaceAll('{{functionName}}', input.functionName)
    .replaceAll('{{businessName}}', input.businessName)
    .replaceAll('{{moduleName}}', input.moduleName)
    .replace('{{columnZodLines}}', columnZodLines)
}

const genTableRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 导入表结构:从 information_schema 读取列,写入 gen_table + gen_table_column
  server.post('/import', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const body = parseOrThrow(importSchema, req.body)
    const tableName = body.tableName.toLowerCase()

    const existing = await db
      .select()
      .from(genTable)
      .where(eq(genTable.tableName, tableName))
      .limit(1)
    if (existing[0]) return reply.status(409).send(error(409, `表 ${tableName} 已导入`))

    const rows = (await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default, column_comment
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `)) as unknown as InformationSchemaColumn[]
    if (rows.length === 0)
      return reply.status(404).send(error(404, `表 ${tableName} 不存在或没有列`))

    const names = resolveNames(tableName)
    const functionName = body.tableComment?.trim() || names.className
    const [genTableRow] = await db
      .insert(genTable)
      .values({
        tableName,
        tableComment: body.tableComment?.trim() || tableName,
        className: names.className,
        tplCategory: 'crud',
        tplWebType: 'tailwind',
        packageName: `com.ihui.${names.moduleName}`,
        moduleName: names.moduleName,
        businessName: names.businessName,
        functionName,
        functionAuthor: 'ihui',
        genType: '0',
        createBy: 'system',
        updateBy: 'system',
      })
      .returning()
    if (!genTableRow) return reply.status(500).send(error(500, '导入记录创建失败'))

    const columnValues = rows.map((r, index) => ({
      tableId: genTableRow.tableId,
      columnName: r.column_name,
      columnComment: r.column_comment || r.column_name,
      columnType: shortType(r.data_type),
      javaType: javaType(r.data_type),
      javaField: snakeToCamel(r.column_name),
      isPk: r.column_name === 'id' ? '1' : '0',
      isIncrement: r.column_name === 'id' ? '1' : '0',
      isRequired: r.is_nullable === 'NO' ? '1' : '0',
      isInsert: '1',
      isEdit: '1',
      isList: '1',
      isQuery: '0',
      queryType: 'EQ',
      htmlType: htmlType(r.data_type),
      dictType: '',
      sort: index + 1,
      createBy: 'system',
      updateBy: 'system',
    }))
    await db.insert(genTableColumn).values(columnValues)

    return reply.send(
      success({ tableId: genTableRow.tableId, tableName, columnCount: columnValues.length }),
    )
  })

  // 已导入表列表(分页)
  server.get('/tables', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const { page, pageSize } = parseOrThrow(pageSchema, req.query)
    const offset = (page - 1) * pageSize
    const [countRows, list] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(genTable),
      db.select().from(genTable).orderBy(desc(genTable.createTime)).limit(pageSize).offset(offset),
    ])
    const total = countRows[0]?.count ?? 0
    return reply.send(paginatedSuccess(list, total, { page, pageSize }))
  })

  // 详情(含列)
  server.get('/tables/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const { id } = parseOrThrow(idParamSchema, req.params)
    const [tableRow] = await db.select().from(genTable).where(eq(genTable.tableId, id)).limit(1)
    if (!tableRow) return reply.status(404).send(error(404, '导入记录不存在'))

    const columns = await db
      .select()
      .from(genTableColumn)
      .where(eq(genTableColumn.tableId, id))
      .orderBy(genTableColumn.sort)
    return reply.send(success({ table: tableRow, columns }))
  })

  // 生成代码
  server.post('/tables/:id/generate', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const { id } = parseOrThrow(idParamSchema, req.params)
    const [tableRow] = await db.select().from(genTable).where(eq(genTable.tableId, id)).limit(1)
    if (!tableRow) return reply.status(404).send(error(404, '导入记录不存在'))

    const columns = await db
      .select()
      .from(genTableColumn)
      .where(eq(genTableColumn.tableId, id))
      .orderBy(genTableColumn.sort)
    const code = buildCode(
      {
        tableName: tableRow.tableName,
        tableComment: tableRow.tableComment,
        className: tableRow.className,
        moduleName: tableRow.moduleName,
        businessName: tableRow.businessName,
        functionName: tableRow.functionName,
      },
      columns,
    )
    return reply.send(
      success({
        code,
        language: 'typescript',
        filename: `${tableRow.moduleName}/${tableRow.businessName}.routes.ts`,
      }),
    )
  })

  // 删除导入记录(含列)
  server.delete('/tables/:id', async (req, reply) => {
    await requireAdmin(req, reply)
    if (reply.sent) return

    const { id } = parseOrThrow(idParamSchema, req.params)
    await db.delete(genTableColumn).where(eq(genTableColumn.tableId, id))
    await db.delete(genTable).where(eq(genTable.tableId, id))
    return reply.send(success({ deleted: true }))
  })
}

export { genTableRoutes }
