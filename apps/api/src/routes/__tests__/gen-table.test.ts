/**
 * 代码生成器路由测试。
 *
 * db 以链式 thenable builder mock:
 *   - db.select() 按调用顺序消费 selectQueue
 *   - db.insert().returning() 消费 insertQueue,insertCalls 记录 values
 *   - db.execute() 消费 executeQueue(模拟 information_schema 查询结果)
 *   - db.delete().where() 记录 deleteCalls
 * requireAdmin 直接放行。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
  requireAuth: vi.fn(async () => {}),
  requirePermission: vi.fn(() => vi.fn(async () => {})),
  requireAnyPermission: vi.fn(() => vi.fn(async () => {})),
}))

const {
  selectQueue,
  insertQueue,
  executeQueue,
  pushSelect,
  pushInsertReturning,
  pushExecute,
  resetQueues,
  insertCalls,
  deleteCalls,
} = vi.hoisted(() => {
  const selectQueue: Array<unknown[] | Error> = []
  const insertQueue: Array<unknown[]> = []
  const executeQueue: Array<unknown[] | Error> = []
  const insertCalls: Array<{ values: unknown }> = []
  const deleteCalls: Array<unknown> = []
  return {
    selectQueue,
    insertQueue,
    executeQueue,
    insertCalls,
    deleteCalls,
    pushSelect: (r: unknown[] | Error) => selectQueue.push(r),
    pushInsertReturning: (r: unknown[]) => insertQueue.push(r),
    pushExecute: (r: unknown[] | Error) => executeQueue.push(r),
    resetQueues: () => {
      selectQueue.length = 0
      insertQueue.length = 0
      executeQueue.length = 0
      insertCalls.length = 0
      deleteCalls.length = 0
    },
  }
})

vi.mock('../../db/index.js', () => {
  const makeSelectBuilder = (): Record<string, unknown> => {
    const builder: Record<string, unknown> = {
      from: () => builder,
      innerJoin: () => builder,
      leftJoin: () => builder,
      where: () => builder,
      groupBy: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      offset: () => builder,
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const queued = selectQueue.shift() ?? []
        const p = queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
        return p.then(onFulfilled, onRejected)
      },
    }
    return builder
  }

  const makeInsertChain = () => {
    const chain: Record<string, unknown> = {
      values: (values: unknown) => {
        insertCalls.push({ values })
        return chain
      },
      returning: () => Promise.resolve(insertQueue.shift() ?? []),
      then(onFulfilled?: (v: unknown) => unknown) {
        return Promise.resolve([]).then(onFulfilled)
      },
    }
    return chain
  }

  const dbMock = {
    select: () => makeSelectBuilder(),
    insert: () => makeInsertChain(),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
    delete: (target: unknown) => ({
      where: () => {
        deleteCalls.push(target)
        return Promise.resolve([])
      },
    }),
    execute: () => {
      const queued = executeQueue.shift() ?? []
      const p = queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
      return p
    },
    transaction: (cb: (tx: unknown) => Promise<unknown>) => Promise.resolve(cb(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { genTableRoutes } from '../gen-table.js'

// ─────────────────────────────────────────────────────────────
// 测试数据
// ─────────────────────────────────────────────────────────────

function makeGenTableRow(overrides: Record<string, unknown> = {}) {
  return {
    tableId: 1,
    tableName: 'sys_user',
    tableComment: '系统用户',
    subTableName: null,
    subTableFkName: null,
    className: 'SysUser',
    tplCategory: 'crud',
    tplWebType: 'tailwind',
    packageName: 'com.ihui.sys',
    moduleName: 'sys',
    businessName: 'user',
    functionName: '系统用户',
    functionAuthor: 'ihui',
    genType: '0',
    genPath: null,
    options: null,
    createBy: 'system',
    createTime: new Date(),
    updateBy: 'system',
    updateTime: new Date(),
    remark: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeColumnRow(overrides: Record<string, unknown> = {}) {
  return {
    columnId: 1,
    tableId: 1,
    columnName: 'id',
    columnComment: '主键',
    columnType: 'int8',
    javaType: 'Long',
    javaField: 'id',
    isPk: '1',
    isIncrement: '1',
    isRequired: '1',
    isInsert: '1',
    isEdit: '1',
    isList: '1',
    isQuery: '0',
    queryType: 'EQ',
    htmlType: 'number',
    dictType: '',
    sort: 1,
    createBy: 'system',
    createTime: new Date(),
    updateBy: 'system',
    updateTime: new Date(),
    remark: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// information_schema.columns 模拟(system_user 表)
const SYS_USER_COLUMNS = [
  {
    column_name: 'id',
    data_type: 'bigint',
    is_nullable: 'NO',
    column_default: null,
    column_comment: '主键',
  },
  {
    column_name: 'username',
    data_type: 'character varying',
    is_nullable: 'NO',
    column_default: null,
    column_comment: '用户名',
  },
  {
    column_name: 'nickname',
    data_type: 'character varying',
    is_nullable: 'YES',
    column_default: null,
    column_comment: '昵称',
  },
  {
    column_name: 'created_at',
    data_type: 'timestamp with time zone',
    is_nullable: 'NO',
    column_default: 'now()',
    column_comment: '创建时间',
  },
]

describe('代码生成器路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((error, _request, reply) => {
      const err = error as Error & { statusCode?: number }
      const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message || '服务器错误' })
    })
    await app.register(genTableRoutes, { prefix: '/gen-table' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    resetQueues()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /gen-table/import', () => {
    it('从 mock 的 information_schema 建表 + 列', async () => {
      pushSelect([]) // 无已导入记录
      pushExecute(SYS_USER_COLUMNS)
      pushInsertReturning([makeGenTableRow()]) // gen_table 插入返回
      pushInsertReturning([]) // gen_table_column 插入返回

      const res = await app.inject({
        method: 'POST',
        url: '/gen-table/import',
        payload: { tableName: 'sys_user', tableComment: '系统用户' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toMatchObject({ tableId: 1, tableName: 'sys_user', columnCount: 4 })

      // gen_table 插入:命名转换正确
      const tableInsert = insertCalls[0]?.values as Record<string, unknown>
      expect(tableInsert).toMatchObject({
        tableName: 'sys_user',
        tableComment: '系统用户',
        className: 'SysUser',
        moduleName: 'sys',
        businessName: 'user',
        functionName: '系统用户',
        packageName: 'com.ihui.sys',
        tplCategory: 'crud',
      })

      // gen_table_column 批量插入:4 列
      const columnInsert = insertCalls[1]?.values as Array<Record<string, unknown>>
      expect(columnInsert).toHaveLength(4)
      const idCol = columnInsert.find((c) => c.columnName === 'id')
      expect(idCol).toMatchObject({
        isPk: '1',
        isIncrement: '1',
        isRequired: '1',
        htmlType: 'number',
        javaType: 'Long',
        sort: 1,
      })
      const usernameCol = columnInsert.find((c) => c.columnName === 'username')
      expect(usernameCol).toMatchObject({
        isPk: '0',
        isRequired: '1',
        columnType: 'varchar',
        htmlType: 'input',
        javaField: 'username',
        sort: 2,
      })
      const createdAtCol = columnInsert.find((c) => c.columnName === 'created_at')
      expect(createdAtCol).toMatchObject({
        htmlType: 'datetime',
        javaField: 'createdAt',
        javaType: 'Date',
        sort: 4,
      })
    })

    it('已导入的表重复导入返回 409', async () => {
      pushSelect([makeGenTableRow()])
      const res = await app.inject({
        method: 'POST',
        url: '/gen-table/import',
        payload: { tableName: 'sys_user' },
      })
      expect(res.statusCode).toBe(409)
      expect(insertCalls).toHaveLength(0)
    })

    it('information_schema 无该表返回 404', async () => {
      pushSelect([])
      pushExecute([])
      const res = await app.inject({
        method: 'POST',
        url: '/gen-table/import',
        payload: { tableName: 'not_exist_table' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('缺少 tableName 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/gen-table/import',
        payload: { tableComment: 'x' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /gen-table/tables', () => {
    it('分页返回已导入表列表', async () => {
      pushSelect([{ count: 1 }])
      pushSelect([makeGenTableRow()])

      const res = await app.inject({ method: 'GET', url: '/gen-table/tables?page=1&pageSize=10' })

      expect(res.statusCode).toBe(200)
      const { data } = res.json()
      expect(data.total).toBe(1)
      expect(data.items).toHaveLength(1)
      expect(data.items[0].tableName).toBe('sys_user')
    })
  })

  describe('GET /gen-table/tables/:id 详情', () => {
    it('返回表信息与列列表', async () => {
      pushSelect([makeGenTableRow()])
      pushSelect([makeColumnRow(), makeColumnRow({ columnId: 2, columnName: 'username' })])

      const res = await app.inject({ method: 'GET', url: '/gen-table/tables/1' })

      expect(res.statusCode).toBe(200)
      const { data } = res.json()
      expect(data.table.tableName).toBe('sys_user')
      expect(data.columns).toHaveLength(2)
      expect(data.columns[0].isPk).toBe('1')
    })

    it('不存在的记录返回 404', async () => {
      pushSelect([])
      const res = await app.inject({ method: 'GET', url: '/gen-table/tables/999' })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /gen-table/tables/:id/generate', () => {
    it('生成代码包含 imports 与 GET/POST/PATCH/DELETE 与 zod 占位', async () => {
      pushSelect([makeGenTableRow()])
      pushSelect([
        makeColumnRow(),
        makeColumnRow({
          columnId: 2,
          columnName: 'username',
          columnComment: '用户名',
          javaField: 'username',
        }),
        makeColumnRow({
          columnId: 3,
          columnName: 'nickname',
          columnComment: '昵称',
          javaField: 'nickname',
        }),
      ])

      const res = await app.inject({ method: 'POST', url: '/gen-table/tables/1/generate' })

      expect(res.statusCode).toBe(200)
      const { data } = res.json()
      expect(data.language).toBe('typescript')
      expect(data.filename).toBe('sys/user.routes.ts')
      expect(data.code).toContain('import')
      expect(data.code).toContain('zod')
      expect(data.code).toContain('server.get')
      expect(data.code).toContain('server.post')
      expect(data.code).toContain('server.patch')
      expect(data.code).toContain('server.delete')
      expect(data.code).toContain('username: z.string().optional()')
      expect(data.code).toContain('系统用户')
    })

    it('不存在的记录返回 404', async () => {
      pushSelect([])
      const res = await app.inject({ method: 'POST', url: '/gen-table/tables/999/generate' })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /gen-table/tables/:id', () => {
    it('删除 gen_table 与 gen_table_column 记录', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/gen-table/tables/1' })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ deleted: true })
      expect(deleteCalls).toHaveLength(2)
    })

    it('非法 id 返回 400', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/gen-table/tables/abc' })
      expect(res.statusCode).toBe(400)
    })
  })
})
