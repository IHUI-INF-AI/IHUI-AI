import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { exportToExcel, type ColumnDef } from '../services/excel-export-service.js'
import { generateReportPDF } from '../services/pdf-service.js'
import { db } from '../db/index.js'
import { visitLogs, users, orders, auditLogs } from '@ihui/database'
import { sql, and, gte, lte, desc } from 'drizzle-orm'

// =============================================================================
// Zod schemas
// =============================================================================

const reportGenerateBodySchema = z.object({
  type: z.enum(['visit-summary', 'order-summary', 'user-growth', 'audit-summary']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  format: z.enum(['excel', 'pdf', 'json']).optional().default('json'),
})

const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// =============================================================================
// 预定义报表：列定义 + 数据查询
// =============================================================================

const REPORT_DEFS: Record<
  string,
  {
    title: string
    subtitle: string
    columns: ColumnDef[]
    query: (startDate: string, endDate: string) => Promise<Array<Record<string, unknown>>>
    sections: (data: Array<Record<string, unknown>>) => Array<{ heading: string; content: string }>
  }
> = {
  'visit-summary': {
    title: '访问统计报表',
    subtitle: 'PV/UV/热门页面',
    columns: [
      { header: '日期', field: 'date', width: 14, type: 'str' },
      { header: 'PV', field: 'pv', width: 10, type: 'int' },
      { header: 'UV', field: 'uv', width: 10, type: 'int' },
      { header: '热门页面', field: 'topPage', width: 40, type: 'str' },
    ],
    query: async (startDate, endDate) => {
      const rows = await db
        .select({
          date: visitLogs.visitDate,
          pv: sql<number>`count(*)::int`,
          uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
        })
        .from(visitLogs)
        .where(
          and(
            gte(visitLogs.visitDate, startDate.slice(0, 10)),
            lte(visitLogs.visitDate, endDate.slice(0, 10)),
          ),
        )
        .groupBy(visitLogs.visitDate)
        .orderBy(visitLogs.visitDate)
      return rows.map((r) => ({ date: r.date ?? '', pv: r.pv, uv: r.uv, topPage: '' }))
    },
    sections: (data) => [
      {
        heading: '概览',
        content: `共 ${data.length} 天，总 PV ${data.reduce((s, r) => s + Number(r.pv ?? 0), 0)}，总 UV ${data.reduce((s, r) => s + Number(r.uv ?? 0), 0)}`,
      },
      {
        heading: '明细',
        content: data.map((r) => `${r.date}: PV=${r.pv}, UV=${r.uv}`).join('\n'),
      },
    ],
  },
  'order-summary': {
    title: '订单统计报表',
    subtitle: '订单数/金额',
    columns: [
      { header: '日期', field: 'date', width: 14, type: 'str' },
      { header: '订单数', field: 'count', width: 12, type: 'int' },
      { header: '总金额', field: 'totalAmount', width: 14, type: 'float' },
    ],
    query: async (startDate, endDate) => {
      const rows = await db
        .select({
          date: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
          totalAmount: sql<number>`coalesce(sum(${orders.amount}), 0)::float`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, new Date(startDate)),
            lte(orders.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
          ),
        )
        .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
      return rows.map((r) => ({ date: r.date, count: r.count, totalAmount: r.totalAmount }))
    },
    sections: (data) => [
      {
        heading: '概览',
        content: `共 ${data.length} 天，总订单 ${data.reduce((s, r) => s + Number(r.count ?? 0), 0)} 笔，总金额 ${data.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0)}`,
      },
    ],
  },
  'user-growth': {
    title: '用户增长报表',
    subtitle: '新增用户/累计用户',
    columns: [
      { header: '日期', field: 'date', width: 14, type: 'str' },
      { header: '新增用户', field: 'newUsers', width: 14, type: 'int' },
      { header: '累计用户', field: 'totalUsers', width: 14, type: 'int' },
    ],
    query: async (startDate, endDate) => {
      const rows = await db
        .select({
          date: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`,
          newUsers: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(
          and(
            gte(users.createdAt, new Date(startDate)),
            lte(users.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
          ),
        )
        .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`)
      let cumulative = 0
      // 累计用户：当前 DB 总用户数（简化处理，精确需子查询）
      const [totalRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(lte(users.createdAt, new Date(`${endDate}T23:59:59.999Z`)))
      cumulative = totalRow?.total ?? 0
      const startCumulative = cumulative - rows.reduce((s, r) => s + r.newUsers, 0)
      let running = startCumulative
      return rows.map((r) => {
        running += r.newUsers
        return { date: r.date, newUsers: r.newUsers, totalUsers: running }
      })
    },
    sections: (data) => [
      {
        heading: '概览',
        content: `共 ${data.length} 天，新增用户 ${data.reduce((s, r) => s + Number(r.newUsers ?? 0), 0)} 人`,
      },
    ],
  },
  'audit-summary': {
    title: '审计日志报表',
    subtitle: '操作类型/数量',
    columns: [
      { header: '操作类型', field: 'action', width: 20, type: 'str' },
      { header: '资源类型', field: 'resourceType', width: 20, type: 'str' },
      { header: '操作次数', field: 'count', width: 12, type: 'int' },
    ],
    query: async (startDate, endDate) => {
      const rows = await db
        .select({
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          count: sql<number>`count(*)::int`,
        })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.createdAt, new Date(startDate)),
            lte(auditLogs.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
          ),
        )
        .groupBy(auditLogs.action, auditLogs.resourceType)
        .orderBy(desc(sql`count(*)`))
      return rows.map((r) => ({
        action: r.action,
        resourceType: r.resourceType ?? '',
        count: r.count,
      }))
    },
    sections: (data) => [
      {
        heading: '概览',
        content: `共 ${data.length} 种操作组合，总操作 ${data.reduce((s, r) => s + Number(r.count ?? 0), 0)} 次`,
      },
    ],
  },
}

// =============================================================================
// 路由
// =============================================================================

export const adminReportRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /reports/types - 列出可用报表类型
  server.get('/reports/types', async (_request, reply) => {
    const types = Object.keys(REPORT_DEFS).map((key) => {
      const def = REPORT_DEFS[key]!
      return { type: key, title: def.title, subtitle: def.subtitle }
    })
    return reply.send(success({ types }))
  })

  // POST /reports/generate - 生成报表（支持 excel/pdf/json）
  server.post('/reports/generate', async (request, reply) => {
    const parsed = reportGenerateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { type, startDate, endDate, format } = parsed.data
    const def = REPORT_DEFS[type]
    if (!def) {
      return reply.status(400).send(error(400, `不支持的报表类型: ${type}`))
    }

    const data = await def.query(startDate, endDate)

    if (format === 'json') {
      return reply.send(
        success({
          type,
          title: def.title,
          subtitle: def.subtitle,
          range: { startDate, endDate },
          count: data.length,
          rows: data,
        }),
      )
    }

    if (format === 'excel') {
      const buffer = await exportToExcel(data, {
        sheetName: def.title,
        columns: def.columns,
        filename: `${type}-${startDate}-${endDate}.xlsx`,
      })
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header(
          'Content-Disposition',
          `attachment; filename="${type}-${startDate}-${endDate}.xlsx"`,
        )
        .send(buffer)
    }

    // PDF
    const pdfResult = await generateReportPDF({
      title: def.title,
      subtitle: `${def.subtitle} (${startDate} ~ ${endDate})`,
      sections: def.sections(data),
      generatedAt: new Date(),
    })
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${type}-${startDate}-${endDate}.pdf"`)
      .send(pdfResult.buffer)
  })

  // GET /reports/scheduled - 列出定时报表配置（桩，无 DB 表）
  server.get('/reports/scheduled', async (request, reply) => {
    const parsed = reportListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    return reply.send(
      success({
        list: [],
        total: 0,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        note: '定时报表配置表未建模，当前仅支持即时生成',
      }),
    )
  })
}
