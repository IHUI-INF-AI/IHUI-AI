// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, eq, and, desc, getTableColumns } from 'drizzle-orm'
import { examPapers, examWrongQuestion, examSignups, userFavorites } from '@ihui/database'
import { error } from '../utils/response.js'

/**
 * 历史项目缺失端点补齐 — 考试模块(D1/D2/D16)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D1: 考试报名 sign-up CRUD(5端点 /exam/signups*)
 * - D2: 考试收藏/推荐/热门(3端点 /exam/recommend|hot|favorites)
 * - D16: 错题删除(/exam/wrong-questions/:id)
 */
export const legacyExamRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const idParam = z.object({ id: z.string() })
  // 注:此处曾有一把 `userIdQuery = z.object({ userId: z.string() })`,唯一用处是给
  // `GET /exam/favorites` 收**自报**的 userId 当归属凭据(第五条同型敞口,2026-09-25 收口)。
  // 现在该面与下面 `requireSelfScope` 同形 —— 归属只从 JWT 取,故删掉这把 schema,
  // 不留"第二个归属入口"的标识符(名字还在、没人用它当凭据,正是本仓记过的腐烂形态)。

  // ========== D1: 考试报名 sign-up CRUD (5端点) ==========
  //
  // 归属判据(2026-09-25 收口四条与 exam.ts 同型的敞口)。本域与 exam.ts 的
  // `/exam/composition/signup*` **不是一张表、不是一套 ID 空间,结论不得互相照抄**:
  //   本面走 `exam_signups`(packages/database/src/schema/exam-extended.ts:69-85),
  //   其 `user_id` 是 `uuid('user_id').notNull()` —— 与 `request.userId`(users.id = uuid)
  //   **同一个 ID 空间**,所以"这条报名是不是你的"在服务端**可证**;
  //   而 exam.ts 那一域走 `exam_sign_up.member_id`(integer、无外键的旧 Java 遗留空间),
  //   uuid → integer 的映射不存在(exam.ts:1209-1225 的实测结论),那一边才只能 fail-close
  //   到管理员档。**这里按 uuid 归属放行,不照抄 fail-close。**
  type SignupScope = { ok: true; userId: string } | { ok: false; code: number; message: string }

  /**
   * 本域唯一的授权出口:**调用方不得通过任何参数决定"读/写谁的数据"** —— 身份只从 JWT 取
   * (`request.userId`,authenticate 已保证非空,取不到即 401 走不到这里)。
   * 显式传了别人的 userId ⇒ 403,而不是静默改写成自己的:后者会让调用方以为拿到的是
   * 那个人的数据(同一类"静默"缺陷本仓记过多次)。
   * 三条不可动摇的口径:
   *  ① 判定只依赖请求形状,**不发任何查询** ⇒ 403 不携带"那个人/那条报名是否存在"的信息;
   *     且它排在 zod 参数校验**之前**(AGENTS §5 顺序铁律:鉴权 → 授权 → 校参数 → 动作);
   *  ② 返回的 userId 会被各 handler 作为 where 的**首个**条件钉死 ⇒ where 结构上不可能
   *     退化成无约束全表(修复前 `GET /exam/signups` 不带参数时正是 `sql`TRUE`` ⇒ 整表可读);
   *  ③ 先授权、再判存在 ⇒ "记录不存在"与"记录存在但不属于你"返回**同一形态**(见详情路由)。
   * 为什么这里**不开**管理员档(exam.ts 那 7 处有):本面实测零调用方(全仓 grep
   * `/api/legacy/exam` 只命中本文件的定义处与生成的 openapi.json;小程序 `api/index.ts`
   * 的 `/exam/signups*` 经 api-client 归一化后落在 `/api/exam/signups*`,即 exam.ts 的
   * admin 面),在此新增"管理员可无归属读整表"属**新增无界导出能力**(AGENTS §24),
   * 且 exam.ts:1258-1266 已给出同一条理由:管理员凭据被盗即等价整表导出。
   */
  function requireSelfScope(
    request: FastifyRequest,
    selfReportedUserId: string | undefined,
  ): SignupScope {
    const callerId = request.userId!
    if (selfReportedUserId !== undefined && selfReportedUserId !== callerId) {
      return { ok: false, code: 403, message: '无权访问他人数据:归属只能由登录身份决定' }
    }
    return { ok: true, userId: callerId }
  }

  /**
   * 从**未经校验**的 query 里取 `userId`,唯一目的是让上面的授权判定排在参数校验之前。
   * 取到的值是否合法(uuid 形态等)仍由 handler 里的 zod 负责 —— 这里只回答"调用方想指向谁"。
   */
  function rawQueryUserId(query: unknown): string | undefined {
    const v = (query as { userId?: unknown } | undefined)?.userId
    return typeof v === 'string' ? v : undefined
  }

  // 报名列表
  fastify.get('/exam/signups', { preHandler: authenticate }, async (request, reply) => {
    // 顺序铁律(AGENTS §5):鉴权(preHandler)→ 授权 → 校参数 → 动作。
    // 授权读的是**未校验**的原始 query(只为拿到"调用方想指向谁"),它不查库、也不判断
    // 参数是否合法 ⇒ 未授权者连 400 都拿不到,响应码里不含任何存在性信息。
    const scope = requireSelfScope(request, rawQueryUserId(request.query))
    if (!scope.ok) return reply.status(scope.code).send(error(scope.code, scope.message))
    const { examId, page, pageSize } = z
      .object({
        // paper_id / user_id 都是 uuid 列:原样把任意字符串交给 drizzle 会落到 PG 的
        // `invalid input syntax for type uuid` ⇒ 500(把参数错误伪装成服务故障)。
        examId: z.uuid().optional(),
        userId: z.uuid().optional(),
        // P1 修复(2026-08-06): 分页 pageSize 补上限
        page: z.coerce.number().int().min(1).optional().default(1),
        pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
      })
      .parse(request.query)
    // conditions[0] 恒为 user_id 约束 ⇒ 不存在"不传参数即翻全表"这条兜底
    const conditions = [
      eq(examSignups.userId, scope.userId),
      ...(examId ? [eq(examSignups.paperId, examId)] : []),
    ]
    const where = and(...conditions)
    const list = await db
      .select()
      .from(examSignups)
      .where(where)
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return { list, total: list.length, page: Number(page), pageSize: Number(pageSize) }
  })

  // 创建报名
  fastify.post('/exam/signups', { preHandler: authenticate }, async (request, reply) => {
    // 修复前 `userId` 是**请求体必填字段**且从不与 request.userId 比对 ⇒ 任何登录用户都能
    // 把报名写到他人名下(自报字段当归属凭据 = 可伪造/污染他人数据,与 exam.ts:1388 同型)。
    // 现在该字段从 schema 里删掉:zod 默认丢弃未知键 ⇒ 老客户端继续传自己的 userId 不报错,
    // 只是不再被相信;写库的 user_id 恒为 JWT 身份。不给管理员开"代他人报名":
    // 那是新能力,本面零调用方,且报名语义是"我报名"。
    const body = z.object({ examId: z.uuid() }).parse(request.body)
    const [created] = await db
      .insert(examSignups)
      .values({
        paperId: body.examId,
        userId: request.userId!,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建报名失败'))
    return reply.code(201).send(created)
  })

  // 报名详情
  fastify.get('/exam/signups/:id', { preHandler: authenticate }, async (request, reply) => {
    // 修复前仅 authenticate、按主键直查 ⇒ 任意登录用户可用 id 枚举他人报名详情。
    // 本路由**没有任何**可指定归属的参数,故归属恒等于 JWT 身份;收口形态 = 主键 + 归属
    // **AND** 收紧(不是择一),于是"不存在"与"不是你的"落在同一次查询的同一个空结果上
    // ⇒ 两条话术天然同形(先授权、再判存在),该路由不再是一台存在性预言机。
    const { id } = idParam.parse(request.params)
    const result = await db
      .select()
      .from(examSignups)
      .where(and(eq(examSignups.id, id), eq(examSignups.userId, request.userId!)))
      .limit(1)
    if (!result[0]) return reply.status(404).send(error(404, '报名记录不存在'))
    return result[0]
  })

  // 取消报名
  fastify.delete('/exam/signups/:id', { preHandler: authenticate }, async (request, reply) => {
    // 该路由**本来就是**主键 + 归属 AND 收紧的正确形态(本域其余四条照它同形,不另立判据)
    const { id } = idParam.parse(request.params)
    const [deleted] = await db
      .delete(examSignups)
      .where(and(eq(examSignups.id, id), eq(examSignups.userId, request.userId!)))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '报名记录不存在'))
    return { deleted: true }
  })

  // 检查是否已报名
  fastify.get('/exam/signups/check', { preHandler: authenticate }, async (request, reply) => {
    // 修复前 `userId` 是**必填查询参数**且从不与 request.userId 比对 ⇒ 这条路由是一台
    // 存在性预言机:任何人可用 (他人 uuid × 试卷 uuid) 的笛卡尔积枚举"谁报了哪场"。
    // 现在 `userId` 只作**一致性校验**(传了就必须是自己,判定不发查询),归属恒由 JWT 决定;
    // 其余形态一律与"我自己没报名"同形({ signed:false, signup:null })⇒ 对第三方零信息量。
    const scope = requireSelfScope(request, rawQueryUserId(request.query))
    if (!scope.ok) return reply.status(scope.code).send(error(scope.code, scope.message))
    const { examId } = z
      .object({ examId: z.uuid(), userId: z.uuid().optional() })
      .parse(request.query)
    const result = await db
      .select()
      .from(examSignups)
      .where(and(eq(examSignups.paperId, examId), eq(examSignups.userId, scope.userId)))
      .limit(1)
    return { signed: !!result[0], signup: result[0] || null }
  })

  // ========== D2: 考试收藏/推荐/热门 (3端点) ==========
  fastify.get('/exam/recommend', async () => {
    const list = await db
      .select()
      .from(examPapers)
      .where(eq(examPapers.status, 1))
      .orderBy(desc(examPapers.createdAt))
      .limit(10)
    return { list }
  })

  fastify.get('/exam/hot', async () => {
    const list = await db
      .select()
      .from(examPapers)
      .where(eq(examPapers.status, 1))
      .orderBy(desc(examPapers.createdAt))
      .limit(10)
    return { list }
  })

  // 收藏列表
  fastify.get('/exam/favorites', { preHandler: authenticate }, async (request, reply) => {
    // 修复前:`userId` 由查询参数**自报**并被拼进原生 SQL 的 `WHERE f.user_id = ${userId}`。
    // 值经 drizzle 参数绑定 ⇒ 不构成注入,但**任意登录用户可读到他人收藏清单**成立,
    // 与本文件上方刚收口的四条同因(第五条同型敞口)。收口形态照同一条判据,不另立第二套:
    //   ① 身份只从 JWT 取(`request.userId`),自报他人 userId ⇒ 403(不是静默改写);
    //   ② 授权判定排在**任何查库与参数校验之前**,不发查询 ⇒ 403 不携带存在性信息;
    //   ③ `user_favorites.user_id` 是 `uuid` 且外键指向 `users.id`
    //      (packages/database/src/schema/social.ts:38-41)⇒ 与 `request.userId` 同一
    //      ID 空间,归属在服务端**可证**,故按 uuid 放行,不照 exam.ts 那 7 处 fail-close
    //      到管理员档(本面同样零调用方,新增"管理员无界读收藏"属新能力,不开)。
    // 兼容性:老客户端继续传自己的 userId 照常可用 —— 该字段只作**一致性校验**
    // (传了就必须是自己,形状仍由 zod 兜),其值不再被当作归属来源;不传也照常可用。
    const scope = requireSelfScope(request, rawQueryUserId(request.query))
    if (!scope.ok) return reply.status(scope.code).send(error(scope.code, scope.message))
    z.object({ userId: z.uuid().optional() }).parse(request.query)
    // 原生 SQL 已改回 Drizzle 表达式 ⇒ 归属值的 `${}` 拼装面归零(唯一来源是 JWT 身份)。
    // 保留的唯一 sql 片段是 `::text`:`user_favorites.resource_id` 是 varchar(128) 而
    // `exam_papers.id` 是 uuid,PG 没有 `varchar = uuid` 运算符(直接 eq 会 42883),
    // 与修复前那段 SQL 的同形写法一致,**不承载任何请求可控的值**。
    // 副作用如实登记:返回字段由裸 SQL 的 snake_case 变为查询构建器的 camelCase,
    // 与本文件其余四个列表路由同形,也与唯一(未接通)消费方 miniapp 的 `Exam` 接口
    // (apps/miniapp-taro/src/api/index.ts:835-849 声明的是 paperType/totalScore/createdAt)
    // 一致 —— 修复前的裸 SQL 反倒是这一个面上的例外。
    const rows = await db
      .select(getTableColumns(examPapers))
      .from(userFavorites)
      .innerJoin(examPapers, eq(userFavorites.resourceId, sql`${examPapers.id}::text`))
      .where(and(eq(userFavorites.userId, scope.userId), eq(userFavorites.resourceType, 'exam')))
    return { list: rows }
  })

  // ========== D16: 错题删除 ==========
  fastify.delete(
    '/exam/wrong-questions/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = idParam.parse(request.params)
      const [deleted] = await db
        .delete(examWrongQuestion)
        .where(and(eq(examWrongQuestion.id, id), eq(examWrongQuestion.userId, request.userId!)))
        .returning()
      if (!deleted) return reply.status(404).send(error(404, '错题记录不存在'))
      return { deleted: true }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
