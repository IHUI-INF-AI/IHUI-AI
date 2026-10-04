// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * lesson_sign_ups.study_plan_id 加列票 —— 钉四件事:
 *
 *   ① **新列真的存在**,类型 uuid / 可空 / 无默认值,且 FK 动作是 SET NULL 不是 CASCADE。
 *      计划被删不该连带删掉用户的报名。
 *   ② **读侧是 leftJoin 不是 innerJoin** —— 这是本票最容易被"顺手写对"的一处。
 *      现状语义是"每个报名都有一行";study_plan_id 可空(历史行一律 NULL)⇒
 *      innerJoin 会把"只有报名、没有计划"的用户整行过滤掉,那是列表凭空少项的行为回归。
 *      判据取 **join 的构造实参**(桩录下被 join 的表),不是文本 grep。
 *   ③ **title 的回落分支**:planTitle 有值取计划名,无值(NULL)回落课程名。
 *   ④ **写入侧每一处都落 studyPlanId**,取值 = 该用户最近更新的 study_plans
 *      (ORDER BY updated_at DESC LIMIT 1);一个计划都没有 ⇒ 落 NULL 而不是报错。
 *
 * 桩法沿用 study-plans-lesson-id.test.ts:vi.hoisted + 桩 drizzle-orm 算子录实参 +
 * **部分**桩 @ihui/database(只换成可辨识字符串列名)+ 桩掉 ../src/db/index.js。
 * **全程不连 PostgreSQL**。
 *
 * ⚠️ 本文件**直接 import 路由模块**而不是 ../src/routes/other/index.js 那道 barrel:
 * barrel 会牵进 26 个无关路由,其中一个在 import 期拉起 @ihui/shared,而当前工作区
 * 别人在飞的 sse/contract.ts 改动使那条链在 import 期就抛错(与本票无关的既有阻塞)。
 * 本票只断言 studyPlanRoutes 自己的行为,直接 import 判据更窄也更稳。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import Fastify from 'fastify'

const { dbQueue, eqCalls, descCalls, joinCalls, insertValues } = vi.hoisted(() => ({
  dbQueue: { items: [] as unknown[][] },
  eqCalls: [] as { left: unknown; right: unknown }[],
  // ↓ descCalls 录排序:判"取最近更新的计划"必须看到 orderBy study_plans.updatedAt DESC,
  //   只断言"查了 study_plans"钉不住"取的是最近那条"。
  descCalls: [] as unknown[],
  // ↓ joinCalls 录 join 的**方法名与被 join 的表对象**:leftJoin/innerJoin 必须可区分,
  //   只录"发生过 join"根本钉不住本票最关键的那条判据。
  joinCalls: [] as { method: string; table: unknown }[],
  insertValues: [] as unknown[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left: unknown, right: unknown) => {
    eqCalls.push({ left, right })
    return { op: 'eq', left, right }
  }),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  desc: vi.fn((col: unknown) => {
    descCalls.push(col)
    return { op: 'desc', col }
  }),
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

// @ihui/database **部分**桩:只把本票要断言的表换成可辨识字符串列名,其余原样放行。
vi.mock('@ihui/database', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    lessonSignUps: {
      id: 'lesson_sign_ups.id',
      userId: 'lesson_sign_ups.userId',
      lessonId: 'lesson_sign_ups.lessonId',
      // ↓ 本票新增列的桩(写入侧断言靠它认出 values 里落了值)
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
  function createChain(table?: unknown) {
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
      'set',
      'returning',
      'select',
      'groupBy',
      'onConflictDoNothing',
    ]) {
      chain[m] = () => chain
    }
    // insert/join 单独录实参
    chain.values = (v: unknown) => {
      insertValues.push(v)
      return chain
    }
    chain.insert = () => chain
    for (const m of ['innerJoin', 'leftJoin', 'rightJoin', 'fullJoin']) {
      chain[m] = (t: unknown) => {
        joinCalls.push({ method: m, table: t })
        return chain
      }
    }
    void table
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

// `getTableConfig` 只在 'drizzle-orm/pg-core' 上可达。
import { getTableConfig } from 'drizzle-orm/pg-core'
import { studyPlanRoutes } from '../src/routes/other/study-plan-routes.js'
// ↓ 取**被桩过的**表对象:join 录下来的就是这个对象本身,断言必须按引用比,
//   拿字符串列名去比表对象会永远落空(第一版就是这么错的)。
import { lessons as lessonsTable, studyPlans as studyPlansTable } from '@ihui/database'
// 类型面走**具名** type 导入:`typeof import('@ihui/database')` 这种内联 import() 类型标注被
// 本仓 eslint 的 consistent-type-imports 判 forbidden(packages/eslint-config/index.js:44),
// 而 lint 是 CI 那扇唯一 required 门里的一步 ⇒ 本文件此前整枚红。
import type { lessonSignUps as lessonSignUpsTable } from '@ihui/database'

/**
 * 取**真表对象**(内省用)。必须走 importActual:本文件把 '@ihui/database' 桩成了
 * 字符串列名,那份桩不是 pgTable,交给 getTableConfig 会炸。
 * 键集 = 本文件真的内省到的那两张表;`vi.mock` 只换运行期导出,不影响类型面。
 */
type RealSchema = {
  lessonSignUps: typeof lessonSignUpsTable
  studyPlans: typeof studyPlansTable
}

async function realSchema(): Promise<RealSchema> {
  return (await vi.importActual('@ihui/database')) as RealSchema
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')
const MIG_REL = 'packages/database/drizzle/20261004150000_lesson_sign_ups_study_plan_id.sql'
const MIG_TAG = '20261004150000_lesson_sign_ups_study_plan_id'

const PREFIX = '/api'
const USER_ID = '00000000-0000-4000-8000-000000000001'
const PLAN_ID = '99999999-9999-4999-8999-999999999999'
const LESSON_ID = '88888888-8888-4888-8888-888888888888'

async function bootServer() {
  const server = Fastify({ logger: false })
  // 直接注册路由时不会经过父 barrel 的 authenticate preHandler ⇒ userId 不会被填。
  // 这里显式注入一个固定 userId,归属过滤类断言才有确定的比较对象。
  server.addHook('onRequest', async (request) => {
    request.userId = USER_ID
  })
  await server.register(studyPlanRoutes, { prefix: PREFIX })
  await server.ready()
  return server
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    progress: 50,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    lessonTitle: '函数式编程入门',
    lessonCount: 10,
    planTitle: null as string | null,
    ...over,
  }
}

describe('lesson_sign_ups.study_plan_id 加列票', () => {
  beforeEach(() => {
    dbQueue.items.length = 0
    eqCalls.length = 0
    descCalls.length = 0
    joinCalls.length = 0
    insertValues.length = 0
  })

  // ===================================================================
  // ① 迁移 SQL 侧
  // ===================================================================

  describe('① 迁移 SQL(读文件取证,全程不执行)', () => {
    let sql = ''

    beforeAll(() => {
      sql = readFileSync(resolve(REPO_ROOT, MIG_REL), 'utf8')
    })

    it('迁移文件存在且已登记进 journal(idx 311,when 严格大于既有最大值)', () => {
      expect(sql.length).toBeGreaterThan(0)
      const journal = JSON.parse(
        readFileSync(resolve(REPO_ROOT, 'packages/database/drizzle/meta/_journal.json'), 'utf8'),
      )
      const entries = journal.entries as { idx: number; when: number; tag: string }[]
      const mine = entries.filter((e) => e.tag === MIG_TAG)
      expect(mine).toHaveLength(1)
      expect(mine[0].idx).toBe(311)
      // when 严格大于**它自己之前**那些条目的最大值(B3)。
      // 不能拿"除自己以外全部"的最大值来比 —— journal 是单调追加的,后续票还会继续
      // 加 idx,那种比法会在别人正常追加迁移时误报红(上一轮 study_plans 那条就踩过)。
      const whens = entries.map((e) => e.when)
      const pos = entries.findIndex((e) => e.tag === MIG_TAG)
      const before = whens.slice(0, pos)
      expect(before.length).toBeGreaterThan(0)
      expect(mine[0].when).toBeGreaterThan(Math.max(...before))
      // 本条是当前最后一条 ⇒ 后面没有别的条目
      expect(pos).toBe(entries.length - 1)
    })

    it('加列语句指向 study_plans(id),列名是 study_plan_id', () => {
      expect(sql).toMatch(
        /ALTER TABLE\s+"?lesson_sign_ups"?\s+ADD COLUMN IF NOT EXISTS\s+"?study_plan_id"?\s+uuid/,
      )
      expect(sql).toMatch(/REFERENCES\s+"?study_plans"?\s*\(\s*"?id"?\s*\)/)
    })

    it('FK 动作是 ON DELETE SET NULL —— 绝不是 CASCADE', () => {
      const fkLine = sql
        .split('\n')
        .find((l) => /ALTER TABLE\s+"?lesson_sign_ups"?\s+ADD COLUMN/i.test(l))
      expect(fkLine).toBeDefined()
      expect(fkLine).toMatch(/ON DELETE SET NULL/i)
      expect(fkLine).not.toMatch(/ON DELETE CASCADE/i)
    })

    it('列可空、无默认值(历史行无从回填 ⇒ 保持 NULL)', () => {
      const fkLine = sql
        .split('\n')
        .find((l) => /ALTER TABLE\s+"?lesson_sign_ups"?\s+ADD COLUMN/i.test(l))!
      expect(fkLine).not.toMatch(/\bNOT NULL\b/i)
      expect(fkLine).not.toMatch(/\bDEFAULT\b/i)
    })

    it('索引 lesson_sign_ups_study_plan_idx 建在 study_plan_id 上', () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS\s+"?lesson_sign_ups_study_plan_idx"?\s+ON\s+"?lesson_sign_ups"?.*\(\s*"?study_plan_id"?\s*\)/i,
      )
    })

    it('幂等:两条 DDL 都带 IF NOT EXISTS', () => {
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/i)
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/i)
    })

    it('只加载体,不改任何既有行内容(无 UPDATE / DELETE FROM / DROP)', () => {
      const code = sql
        .split('\n')
        .filter((l) => !l.trimStart().startsWith('--'))
        .join('\n')
      expect(code).not.toMatch(/\bUPDATE\s+"?\w+"?\s+SET\b/i)
      expect(code).not.toMatch(/\bDELETE\s+FROM\b/i)
      expect(code).not.toMatch(/\bDROP\b/i)
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
  // ② drizzle schema 内省
  // ===================================================================

  describe('② drizzle schema 内省(真实列定义)', () => {
    it('lessonSignUps 真的有 studyPlanId 列', async () => {
      const { lessonSignUps } = await realSchema()
      expect(Object.keys(lessonSignUps)).toContain('studyPlanId')
    })

    it('studyPlanId 的 db 列名是 study_plan_id、类型 uuid、可空', async () => {
      const { lessonSignUps } = await realSchema()
      const cfg = getTableConfig(lessonSignUps)
      const col = cfg.columns.find((c) => c.name === 'study_plan_id')
      expect(col, 'lesson_sign_ups 上找不到 study_plan_id 列').toBeDefined()
      expect(col!.getSQLType()).toBe('uuid')
      expect(col!.notNull).toBe(false)
      expect(col!.hasDefault).toBe(false)
    })

    it('外键指向 study_plans.id,动作是 set null(不是 cascade)', async () => {
      const { lessonSignUps, studyPlans } = await realSchema()
      const cfg = getTableConfig(lessonSignUps)
      const fk = cfg.foreignKeys.find((f) => f.reference().columns[0].name === 'study_plan_id')
      expect(fk, 'study_plan_id 上没有外键').toBeDefined()
      const ref = fk!.reference()
      expect(ref.foreignColumns[0]).toBe(studyPlans.id)
      expect(fk!.onDelete).toBe('set null')
      expect(fk!.onDelete).not.toBe('cascade')
    })

    it('索引 lesson_sign_ups_study_plan_idx 建在 studyPlanId 上', async () => {
      const { lessonSignUps } = await realSchema()
      const cfg = getTableConfig(lessonSignUps)
      const idx = cfg.indexes.find((i) => i.config.name === 'lesson_sign_ups_study_plan_idx')
      expect(idx, 'schema 里没有 lesson_sign_ups_study_plan_idx').toBeDefined()
      expect(idx!.config.columns).toHaveLength(1)
      expect(idx!.config.columns[0].name).toBe('study_plan_id')
    })

    it('既有列与两个既有索引一个都没动(只增不改)', async () => {
      const { lessonSignUps } = await realSchema()
      const cfg = getTableConfig(lessonSignUps)
      expect(cfg.columns.map((c) => c.name)).toEqual([
        'id',
        'lesson_id',
        'user_id',
        'study_plan_id',
        'status',
        'progress',
        'created_at',
      ])
      // UNIQUE(lesson_id,user_id) 决定一对一候选 ⇒ 不该被顺手加新约束
      const uniq = cfg.foreignKeys.filter((f) => f.reference().columns[0].name === 'study_plan_id')
      expect(uniq).toHaveLength(1)
      const userIdx = cfg.indexes.find((i) => i.config.name === 'lesson_sign_ups_user_idx')
      expect(userIdx).toBeDefined()
      expect(userIdx!.config.columns[0].name).toBe('user_id')
    })

    it('双向 import 不成环:learn.ts 与 study.ts 互相引用但两方向都能解析 FK', async () => {
      // 走 importActual 拿真表(本文件把 @ihui/database 桩成了字符串列名,不是 pgTable)。
      // 这里同时钉住两个方向:learn→study 的 study_plan_id 与 study→learn 的 lesson_id。
      const { lessonSignUps, studyPlans, studyPlans: sp2 } = await realSchema()
      void sp2
      const cfg = getTableConfig(lessonSignUps)
      const fk = cfg.foreignKeys.find((f) => f.reference().columns[0].name === 'study_plan_id')
      expect(fk).toBeDefined()
      expect(fk!.reference().foreignColumns[0]).toBe(studyPlans.id)
      // 反向:study_plans.lesson_id 的 FK 也不能因为这次改动而失效
      const scfg = getTableConfig(studyPlans)
      const sfk = scfg.foreignKeys.find((f) => f.reference().columns[0].name === 'lesson_id')
      expect(sfk).toBeDefined()
      expect(sfk!.onDelete).toBe('set null')
    })
  })

  // ===================================================================
  // ③ 读侧:leftJoin(不是 innerJoin)+ title 回落
  // ===================================================================

  describe('③ 读侧 join 方式与 title 回落', () => {
    it('study_plans 是 **leftJoin**,绝不是 innerJoin', async () => {
      const server = await bootServer()
      try {
        dbQueue.items.push([row()])
        await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        const onPlans = joinCalls.filter((c) => c.table === studyPlansTable)
        expect(onPlans, '没有 join study_plans').toHaveLength(1)
        expect(onPlans[0].method).toBe('leftJoin')
        // 显式反证:改成 innerJoin 即翻红("只有报名、没有计划"的用户会被过滤掉)
        expect(onPlans[0].method).not.toBe('innerJoin')
      } finally {
        await server.close()
      }
    })

    it('lessons 仍是 innerJoin(课程是必须有的一侧,不该被改掉)', async () => {
      const server = await bootServer()
      try {
        dbQueue.items.push([row()])
        await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        const onLessons = joinCalls.filter((c) => c.table === lessonsTable)
        expect(onLessons).toHaveLength(1)
        expect(onLessons[0].method).toBe('innerJoin')
      } finally {
        await server.close()
      }
    })

    it('join 条件是 study_plans.id = lesson_sign_ups.studyPlanId(不是别的列)', async () => {
      const server = await bootServer()
      try {
        dbQueue.items.push([row()])
        await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        const cond = eqCalls.find(
          (c) => c.left === 'study_plans.id' || c.right === 'study_plans.id',
        )
        expect(cond, 'join 条件没有用到 study_plans.id').toBeDefined()
        const other = cond!.left === 'study_plans.id' ? cond!.right : cond!.left
        expect(other).toBe('lesson_sign_ups.studyPlanId')
      } finally {
        await server.close()
      }
    })

    it('归属过滤仍只落在 lesson_sign_ups.userId 上', async () => {
      const server = await bootServer()
      try {
        dbQueue.items.push([row()])
        await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        const onUserId = eqCalls.filter((c) => c.left === 'lesson_sign_ups.userId')
        expect(onUserId.length).toBeGreaterThan(0)
        expect(onUserId.every((c) => c.right === USER_ID)).toBe(true)
        // 不得拿 study_plans 的**归属列**做过滤(否则会串到别人的计划)。
        // 注意只排 user_id:study_plans.id 出现在 join 条件里是本票的预期。
        expect(eqCalls.filter((c) => c.left === 'study_plans.userId')).toHaveLength(0)
      } finally {
        await server.close()
      }
    })

    it('title 取计划名(planTitle 有值时),courseName 仍是课程名 —— 两者不再同源', async () => {
      const server = await bootServer()
      try {
        dbQueue.items.push([row({ planTitle: '考研数学冲刺计划' })])
        const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        expect(res.statusCode).toBe(200)
        const plan = res.json().data[0]
        expect(plan.title).toBe('考研数学冲刺计划')
        expect(plan.courseName).toBe('函数式编程入门')
        // 本票的核心效果:两个语义不同的字段不再同源
        expect(plan.title).not.toBe(plan.courseName)
      } finally {
        await server.close()
      }
    })

    it('回落分支:planTitle 为 NULL(没有计划)时 title 回落课程名,且行不丢', async () => {
      const server = await bootServer()
      try {
        dbQueue.items.push([row({ planTitle: null })])
        const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        expect(res.statusCode).toBe(200)
        const data = res.json().data
        // leftJoin 的意义:这一行**仍在**结果里(不是被 innerJoin 过滤掉)
        expect(data).toHaveLength(1)
        expect(data[0].title).toBe('函数式编程入门')
        expect(data[0].courseName).toBe('函数式编程入门')
      } finally {
        await server.close()
      }
    })

    it('createdAt 用的是报名自己的时间(lessonSignUps 与 studyPlans 都有 created_at)', async () => {
      const server = await bootServer()
      try {
        const created = new Date('2026-03-01T00:00:00Z')
        dbQueue.items.push([row({ createdAt: created, planTitle: '计划' })])
        const res = await server.inject({ method: 'GET', url: `${PREFIX}/study/plans` })
        const plan = res.json().data[0]
        // dueDate = createdAt + 30d;锚点错列(拿到 study_plans.created_at)就会偏
        expect(plan.dueDate).toBe('2026-03-31')
        expect(plan.deadline).toBe('2026-03-31')
      } finally {
        await server.close()
      }
    })
  })

  // ===================================================================
  // ④ 写入侧:每一处都落 studyPlanId
  // ===================================================================

  describe('④ 写入侧落值', () => {
    it('signUpLesson 把该用户最近更新的计划落进 studyPlanId', async () => {
      const { signUpLesson } = await import('../src/db/learn-queries.js')
      // 第一次查 = 取最近计划;第二次 = insert 的 thenable
      dbQueue.items.push([{ id: PLAN_ID }], [])
      await signUpLesson(LESSON_ID, USER_ID)
      // 取计划那一步:过滤该用户 + 按 updatedAt 倒序 + 只取 1 条
      const onUser = eqCalls.find((c) => c.left === 'study_plans.userId')
      expect(onUser, '没有按 study_plans.userId 过滤').toBeDefined()
      expect(onUser!.right).toBe(USER_ID)
      // "最近更新的那个"必须真的按 updated_at DESC 排(否则多个计划时取值无依据)
      expect(descCalls, '取计划时没有按 updatedAt 倒序').toContain('study_plans.updatedAt')
      // insert 落值
      const v = insertValues.at(-1) as Record<string, unknown>
      expect(v).toMatchObject({ lessonId: LESSON_ID, userId: USER_ID, studyPlanId: PLAN_ID })
    })

    it('该用户一个计划都没有 ⇒ 落 null(不是报错、不是造默认计划)', async () => {
      const { signUpLesson } = await import('../src/db/learn-queries.js')
      dbQueue.items.push([], [])
      await signUpLesson(LESSON_ID, USER_ID)
      const v = insertValues.at(-1) as Record<string, unknown>
      expect(v.studyPlanId).toBeNull()
    })

    it('batchSignUp 逐用户各落自己的计划(不共用一个 id)', async () => {
      const { batchSignUp } = await import('../src/db/learn-queries.js')
      const A = '00000000-0000-4000-8000-00000000000a'
      const B = '00000000-0000-4000-8000-00000000000b'
      const PLAN_B = '77777777-7777-4777-8777-777777777777'
      dbQueue.items.push([{ id: PLAN_ID }], [{ id: PLAN_B }], [])
      await batchSignUp(LESSON_ID, [A, B])
      const vals = insertValues.at(-1) as Record<string, unknown>[]
      expect(vals).toHaveLength(2)
      expect(vals[0]).toMatchObject({ userId: A, studyPlanId: PLAN_ID })
      expect(vals[1]).toMatchObject({ userId: B, studyPlanId: PLAN_B })
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
