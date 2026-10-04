// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * study_plans.lesson_id 加列票(G-978070/978073 后续)—— 钉三件事:
 *
 *   ① **新列真的存在**,且类型/可空性对(lesson_id uuid REFERENCES lessons(id))。
 *   ② **FK 动作是 SET NULL,不是 CASCADE** —— 课程下架不该连带删掉用户的计划。
 *      这条判据同时钉住 SQL 迁移与 drizzle schema 两侧,任一侧改成 cascade 即翻红。
 *   ③ **登记 title 的来源已切换** —— 原本这里钉的是"title 与 courseName 仍同源",
 *      因为 lessonSignUps 当时**没有**任何指向 study_plans 的列,/api/study/plans
 *      的 title 只能取 lessons.title。该列已由后续票
 *      (20261004150000_lesson_sign_ups_study_plan_id)补上,路由改 leftJoin 取计划名,
 *      所以本块已**翻转**为"title 取计划名、courseName 取课程名,两者不同源"。
 *      完整判据(含 leftJoin 非 innerJoin)在 lesson-sign-ups-study-plan-id.test.ts。
 *
 * 判据取自**真实 drizzle schema 对象的内省**(getTableConfig),不是文本 grep ——
 * 文本 grep 会被注释/字符串骗过,而"FK 动作是 set null 还是 cascade"恰恰是
 * 必须从**运行时的列定义**里读出来的。
 *
 * 迁移 SQL 那一侧(IF NOT EXISTS 幂等 / ON DELETE SET NULL)用**读文件 + 断言字面量**:
 * 真仓迁移不会被本测试执行(那要连库,违反测试隔离铁律 AGENTS §5),而"幂等"与
 * "FK 动作"都是 SQL 文本的确定属性,读文件是这一维唯一不失明的取证通道。
 *
 * 测试隔离:全程不连 PostgreSQL —— db 层整体桩掉,且本文件根本不发起任何查询。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Fastify from 'fastify'

const { mockAuthenticate, dbQueue, eqCalls } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
  eqCalls: [] as { left: unknown; right: unknown }[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 算子桩:不执行 SQL,但把"过滤了哪一列 / 跟谁比"如实录下来。
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left: unknown, right: unknown) => {
    eqCalls.push({ left, right })
    return { op: 'eq', left, right }
  }),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  asc: vi.fn((col: unknown) => ({ op: 'asc', col })),
  sql: Object.assign(
    vi.fn((strs: TemplateStringsArray, ...vals: unknown[]) => ({
      op: 'sql',
      text: String(strs),
      vals,
    })),
    { raw: (c: unknown) => c },
  ),
  count: vi.fn(() => ({ op: 'count' })),
  sum: vi.fn(() => ({ op: 'sum' })),
}))

// @ihui/database **部分**桩:other 路由 barrel 会牵进大量无关表(它们 import 期就读列),
// 整表桩掉会炸在 promotion-queries 之类的地方 ⇒ 只把本票要断言的三张表换成
// 可辨识的字符串列名,其余原样放行。
vi.mock('@ihui/database', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    lessonSignUps: {
      id: 'lesson_sign_ups.id',
      userId: 'lesson_sign_ups.userId',
      lessonId: 'lesson_sign_ups.lessonId',
      // 2026-10-04 后续票(lesson_sign_ups.study_plan_id)加的列:本票的桩原先没有它,
      // 路由改 leftJoin 后会读到 undefined ⇒ 补上,保持桩与真实 schema 同形。
      studyPlanId: 'lesson_sign_ups.studyPlanId',
      progress: 'lesson_sign_ups.progress',
      status: 'lesson_sign_ups.status',
      createdAt: 'lesson_sign_ups.createdAt',
    },
    lessons: {
      id: 'lessons.id',
      title: 'lessons.title',
      lessonCount: 'lessons.lessonCount',
    },
    studyPlans: {
      id: 'study_plans.id',
      userId: 'study_plans.userId',
      title: 'study_plans.title',
      target: 'study_plans.target',
      lessonId: 'study_plans.lessonId',
      createdAt: 'study_plans.createdAt',
      updatedAt: 'study_plans.updatedAt',
    },
  }
})

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'innerJoin',
      'leftJoin',
      'select',
      'groupBy',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    insert: vi.fn(factory),
    update: vi.fn(factory),
    delete: vi.fn(factory),
    transaction: vi.fn(),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

// `getTableConfig` 只在 'drizzle-orm/pg-core' 上可达(它 re-export ./utils.js);
// 'drizzle-orm/pg-core/utils' 经 exports 映射落到 utils/index.js,那里只有 array 工具。
import { getTableConfig } from 'drizzle-orm/pg-core'
import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'

/**
 * 取**真表对象**(内省用)。必须走 importActual:本文件把 '@ihui/database' 桩成了
 * 字符串列名(为了让路由层的"过滤了哪一列"可逐字断言),那份桩不是 pgTable,
 * 交给 getTableConfig 会炸。而 schema 内省要的恰恰是**未经桩化的真实列定义**
 * ——"FK 动作是 set null 还是 cascade"只能从运行时列定义里读出来。
 *
 * 类型面走**具名** type 导入:`typeof import('@ihui/database')` 这种内联 import() 类型标注
 * 被本仓 eslint 的 consistent-type-imports 判 forbidden(packages/eslint-config/index.js:44),
 * 而 lint 是 CI 那扇唯一 required 门里的一步 ⇒ 本文件此前整枚红。键集 = 本文件真的内省到的
 * 三张表;`vi.mock` 只换运行期导出,不影响类型面。
 */
import type {
  lessonSignUps as lessonSignUpsTable,
  lessons as lessonsTable,
  studyPlans as studyPlansTable,
} from '@ihui/database'

type RealSchema = {
  lessonSignUps: typeof lessonSignUpsTable
  lessons: typeof lessonsTable
  studyPlans: typeof studyPlansTable
}

async function realSchema(): Promise<RealSchema> {
  return (await vi.importActual('@ihui/database')) as RealSchema
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')
const MIG_REL = 'packages/database/drizzle/20261004103000_study_plans_lesson_id.sql'

const PREFIX = '/api'
const USER_ID = '00000000-0000-4000-8000-000000000001'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

describe('study_plans.lesson_id 加列票', () => {
  // ===================================================================
  // ① 迁移 SQL 侧:加列 + 索引 + 幂等 + FK 动作
  // ===================================================================

  describe('① 迁移 SQL(读文件取证,全程不执行)', () => {
    let sql = ''

    beforeAll(() => {
      sql = readFileSync(resolve(REPO_ROOT, MIG_REL), 'utf8')
    })

    it('迁移文件存在且已登记进 journal(idx 309,when 严格递增)', () => {
      expect(sql.length).toBeGreaterThan(0)
      const journal = JSON.parse(
        readFileSync(resolve(REPO_ROOT, 'packages/database/drizzle/meta/_journal.json'), 'utf8'),
      )
      const entries = journal.entries as { idx: number; when: number; tag: string }[]
      const mine = entries.filter((e) => e.tag === '20261004103000_study_plans_lesson_id')
      expect(mine).toHaveLength(1)
      expect(mine[0].idx).toBe(309)
      // when 必须严格大于**它自己之前**那些条目的最大值(B3)。
      // 注意不能拿"除自己以外全部"的最大值来比:journal 是单调追加的,后续票还会
      // 继续加 idx(例如 20261004150000 的 study_plan_id),那种比法会让本用例在
      // 别人正常追加迁移时误报红。判据的正确形式是"排在它后面的条目都更大"。
      const whens = entries.map((e) => e.when)
      const pos = entries.findIndex((e) => e.tag === '20261004103000_study_plans_lesson_id')
      const before = whens.slice(0, pos)
      const after = whens.slice(pos + 1)
      expect(before.length).toBeGreaterThan(0)
      expect(mine[0].when).toBeGreaterThan(Math.max(...before))
      // 后续追加的条目必须更大(B3 的另一半:整表严格递增)
      expect(Math.min(...after)).toBeGreaterThan(mine[0].when)
      // journal tag ↔ .sql basename 必须双向一一对应(B1)
      const tags = new Set(entries.map((e) => e.tag))
      expect(tags.has('20261004103000_study_plans_lesson_id')).toBe(true)
    })

    it('加列语句指向 lessons(id),且列名是 lesson_id', () => {
      expect(sql).toMatch(
        /ALTER TABLE\s+"?study_plans"?\s+ADD COLUMN IF NOT EXISTS\s+"?lesson_id"?\s+uuid/,
      )
      expect(sql).toMatch(/REFERENCES\s+"?lessons"?\s*\(\s*"?id"?\s*\)/)
    })

    it('FK 动作是 ON DELETE SET NULL —— 绝不是 CASCADE', () => {
      const fkLine = sql
        .split('\n')
        .find((l) => /ALTER TABLE\s+"?study_plans"?\s+ADD COLUMN/i.test(l))
      expect(fkLine).toBeDefined()
      expect(fkLine).toMatch(/ON DELETE SET NULL/i)
      // 显式反证:CASCADE 出现在这一行即判红(课程下架不该连带删计划)
      expect(fkLine).not.toMatch(/ON DELETE CASCADE/i)
    })

    it('列可空、无默认值(历史行无从回填 ⇒ 保持 NULL)', () => {
      const fkLine = sql
        .split('\n')
        .find((l) => /ALTER TABLE\s+"?study_plans"?\s+ADD COLUMN/i.test(l))!
      expect(fkLine).not.toMatch(/\bNOT NULL\b/i)
      expect(fkLine).not.toMatch(/\bDEFAULT\b/i)
    })

    it('索引 study_plans_lesson_idx 建在 lesson_id 上', () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS\s+"?study_plans_lesson_idx"?\s+ON\s+"?study_plans"?.*\(\s*"?lesson_id"?\s*\)/i,
      )
    })

    it('幂等:两条 DDL 都带 IF NOT EXISTS(重复跑不改变结果)', () => {
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/i)
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/i)
    })

    it('只加载体,不改任何既有行内容(无 UPDATE / DELETE FROM / DROP)', () => {
      // 先剥掉注释行:否则 "ON DELETE SET NULL" 里的 DELETE 会被误判成数据删除语句。
      const code = sql
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n')
      // 判据按**语句形状**写死:UPDATE <表> SET / DELETE FROM <表> / DROP ...
      expect(code).not.toMatch(/\bUPDATE\s+"?\w+"?\s+SET\b/i)
      expect(code).not.toMatch(/\bDELETE\s+FROM\b/i)
      expect(code).not.toMatch(/\bDROP\b/i)
      // 本票只加列与索引:可执行 DDL 仅这两条
      const ddl = code
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('-->'))
      expect(ddl).toHaveLength(2)
      expect(ddl[0]).toMatch(/^ALTER TABLE/i)
      expect(ddl[1]).toMatch(/^CREATE INDEX/i)
    })
  })

  // ===================================================================
  // ② drizzle schema 侧:真实列定义内省(不是文本 grep)
  // ===================================================================

  describe('② drizzle schema 内省(真实列定义)', () => {
    it('studyPlans 真的有 lessonId 列', async () => {
      const { studyPlans } = await realSchema()
      expect(Object.keys(studyPlans)).toContain('lessonId')
    })

    it('lessonId 的 db 列名是 lesson_id、类型 uuid、可空', async () => {
      const { studyPlans } = await realSchema()
      const cfg = getTableConfig(studyPlans)
      const col = cfg.columns.find((c) => c.name === 'lesson_id')
      expect(col, 'study_plans 上找不到 lesson_id 列').toBeDefined()
      expect(col!.getSQLType()).toBe('uuid')
      expect(col!.notNull).toBe(false)
      expect(col!.hasDefault).toBe(false)
      expect(col!.primary).toBe(false)
    })

    it('lessonId 的外键指向 lessons.id,动作是 set null(不是 cascade)', async () => {
      const { studyPlans, lessons } = await realSchema()
      const cfg = getTableConfig(studyPlans)
      // FK 挂在**表**级(cfg.foreignKeys),不在列上 —— 列对象只有 name/sqlType/notNull。
      const fk = cfg.foreignKeys.find((f) => f.reference().columns[0].name === 'lesson_id')
      expect(fk, 'lesson_id 上没有外键').toBeDefined()
      const ref = fk!.reference()
      expect(ref.foreignColumns[0]).toBe(lessons.id)
      expect(ref.foreignColumns[0].name).toBe('id')
      expect(fk!.onDelete).toBe('set null')
      expect(fk!.onUpdate).toBe('no action')
      // 反证:改成 cascade 即翻红
      expect(fk!.onDelete).not.toBe('cascade')
    })

    it('索引 study_plans_lesson_idx 建在 lessonId 上', async () => {
      const { studyPlans } = await realSchema()
      const cfg = getTableConfig(studyPlans)
      const idx = cfg.indexes.find((i) => i.config.name === 'study_plans_lesson_idx')
      expect(idx, 'schema 里没有 study_plans_lesson_idx').toBeDefined()
      expect(idx!.config.columns).toHaveLength(1)
      expect(idx!.config.columns[0].name).toBe('lesson_id')
    })

    it('既有 study_plans_user_idx 与 title/target 列一个都没动', async () => {
      const { studyPlans } = await realSchema()
      const cfg = getTableConfig(studyPlans)
      const names = cfg.columns.map((c) => c.name)
      // 加列是"只增不改":既有列集合与顺序不许变
      expect(names).toEqual([
        'id',
        'user_id',
        'title',
        'target',
        'lesson_id',
        'created_at',
        'updated_at',
      ])
      const userIdx = cfg.indexes.find((i) => i.config.name === 'study_plans_user_idx')
      expect(userIdx).toBeDefined()
      expect(userIdx!.config.columns[0].name).toBe('user_id')
      const title = cfg.columns.find((c) => c.name === 'title')!
      expect(title.notNull).toBe(true)
      expect(title.getSQLType()).toBe('varchar(100)')
    })
  })

  // ===================================================================
  // ③ 前置已补齐:lesson_sign_ups.study_plan_id 已加(2026-10-04 后续票),
  //    /api/study/plans 已改 leftJoin 取计划名 ⇒ title 与 courseName 不再同源。
  //
  //    本块原文是"登记 title 与 courseName 仍同源",并明写:
  //      「一旦有人给 lesson_sign_ups 补上 study_plan_id 并改路由取计划名,
  //        这条断言会翻红 —— 那正是本票留下的『该改路由了』的信号。」
  //    那个人已经来了(迁移 20261004150000_lesson_sign_ups_study_plan_id)。
  //    下面把该信号**翻转**成新现状的登记:同一条 tripwire 改钉"已补齐"。
  //    该列与 leftJoin 的完整判据在 lesson-sign-ups-study-plan-id.test.ts。
  // ===================================================================

  describe('③ 前置已补齐:title 取计划名、courseName 取课程名(两者不再同源)', () => {
    it('lessonSignUps 已有指向 study_plans 的列 study_plan_id', async () => {
      const { lessonSignUps } = await realSchema()
      const cfg = getTableConfig(lessonSignUps)
      const names = cfg.columns.map((c) => c.name)
      // 原来这里是 not.toContain('study_plan_id')(登记"前置缺失"),
      // 现在前置已补 ⇒ 翻转为 toContain。少一列即翻红。
      expect(names).toContain('study_plan_id')
      expect(names).toEqual([
        'id',
        'lesson_id',
        'user_id',
        'study_plan_id',
        'status',
        'progress',
        'created_at',
      ])
    })

    it('有计划时 title 取计划名、courseName 取课程名 —— 两者不同源', async () => {
      const server = Fastify({ logger: false })
      await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
      await server.ready()
      try {
        dbQueue.items.length = 0
        eqCalls.length = 0
        mockAuthenticate.mockReset()
        mockAuthed()
        dbQueue.items.push([
          {
            id: '33333333-3333-4333-8333-333333333333',
            progress: 50,
            createdAt: new Date('2026-03-01T00:00:00Z'),
            lessonTitle: '函数式编程入门',
            lessonCount: 10,
            planTitle: '考研数学冲刺计划',
          },
        ])
        const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        expect(res.statusCode).toBe(200)
        const plan = res.json().data[0]
        // 翻转后的登记:两个字段**不再**同源。
        expect(plan.title).toBe('考研数学冲刺计划')
        expect(plan.courseName).toBe('函数式编程入门')
        expect(plan.title).not.toBe(plan.courseName)
      } finally {
        await server.close()
      }
    })

    it('无计划(planTitle 为 NULL)时回落课程名,且该行不丢', async () => {
      const server = Fastify({ logger: false })
      await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
      await server.ready()
      try {
        dbQueue.items.length = 0
        eqCalls.length = 0
        mockAuthenticate.mockReset()
        mockAuthed()
        dbQueue.items.push([
          {
            id: '33333333-3333-4333-8333-333333333333',
            progress: 0,
            createdAt: new Date('2026-03-01T00:00:00Z'),
            lessonTitle: '课程',
            lessonCount: 1,
            planTitle: null,
          },
        ])
        const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        const data = res.json().data
        // leftJoin 的意义:没有计划的报名**仍在**列表里(不是被 innerJoin 滤掉)
        expect(data).toHaveLength(1)
        expect(data[0].title).toBe('课程')
      } finally {
        await server.close()
      }
    })

    it('归属过滤仍只落在 lesson_sign_ups.userId 上(不拿 study_plans 的归属列过滤)', async () => {
      const server = Fastify({ logger: false })
      await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
      await server.ready()
      try {
        dbQueue.items.length = 0
        eqCalls.length = 0
        mockAuthenticate.mockReset()
        mockAuthed()
        dbQueue.items.push([
          {
            id: '33333333-3333-4333-8333-333333333333',
            progress: 0,
            createdAt: new Date('2026-03-01T00:00:00Z'),
            lessonTitle: '课程',
            lessonCount: 1,
            planTitle: null,
          },
        ])
        await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        const onUserId = eqCalls.filter((c) => c.left === 'lesson_sign_ups.userId')
        expect(onUserId.length).toBeGreaterThan(0)
        expect(onUserId.every((c) => c.right === USER_ID)).toBe(true)
        // study_plans.id 允许出现在 join 条件里,但**归属列**不许参与过滤
        expect(eqCalls.filter((c) => c.left === 'study_plans.userId')).toHaveLength(0)
      } finally {
        await server.close()
      }
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
