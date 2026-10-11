// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1102637：`POST /api/agents/create` 的 body 校验走 `.parse()`（抛 ZodError，由全局兜底转响应），
 * 而该支路今天**没有**"字段类型不符"这一型用例 —— 本票补一枚有牙的。
 *
 * 为什么单独成文件，而不是往 `apps/api/test/agents.test.ts` 的 create 块里加一行：
 * 那一份夹具**不装 error handler**（它只 `Fastify({ logger: false })` 就 register 路由），
 * 而 create 支路的 body 校验是 `z.object({...}).parse(request.body)` —— 它抛的 `ZodError`
 * **只能由 `src/server.ts` 的全局 `errorHandler` 接住**才落成 400；在那份无 handler 的夹具里
 * 它会冒成 500，"断言 400"根本写不下去。PUT 支路（`.safeParse` + 路由内显式
 * `reply.status(400).send(error(400, '参数错误'))`）不走这条兜底，所以 G-739 线那枚有牙用例能在
 * 原地成立。本支路必须自带一份与生产同形的 handler —— 见下方「镜像的前提」。
 *
 * 病灶的型（G-739 已收口的口径，本票补的是同族里没人补的那一条支路）：
 * 进 SQL 之前有一道 uuid 形状闸（`src/utils/uuid.ts` 的 `isUuidString`），它落的 400 与 body 校验落的
 * 400 **在响应上同形**（都是 `{ code, message }`）。所以"只断 statusCode"的用例会被闸门的 400 蒙混 ——
 * 账面绿而 body 校验压根没被执行。⇒ 判据必须同时钉四条：① statusCode ② `body.code` ③ `message`
 * 精确等值**且互斥于闸那句** ④ 服务层零调用。只钉①②的那一枚是假绿；只钉③而不钉④的那一枚会放过
 * "先创建了再抛 400"那一型。
 *
 * 现读的响应形状（以本文件跑出的真实输出为准，取证件 e2 里逐字抄回）：
 *   { "code": 400, "message": "参数错误", "errorCode": "VALIDATION_FAILED" }
 * —— **只有这三键，没有结构化 issue、没有字段路径**：`src/server.ts` 的 `errorHandler` 取的是
 * `issues[0]?.message`，再被 `isMostlyEnglish` 兜成通用中文。zod 4.4.3 对该型给的原文实测是
 * `"Invalid input: expected number, received string"`、`issue.path` 是 `['price']`，而这一维
 * **到不了客户端**。所以本用例只能按 `code + 精确 message + errorCode` 断，不能按字段路径断 ——
 * 这是**登记局限**，不是迁就实现：要改成能断字段路径，前置是给 handler 补结构化 issue，那属产品 /
 * 对外契约决策，不在本票范围（本票禁止改路由）。
 *
 * 三条不变量：
 *  ① 合法 `name` + `price` 传字符串 ⇒ 400，且这一发的**身份**必须是 body 校验：`message` 恰为
 *     '参数错误'、`errorCode` 恰为 'VALIDATION_FAILED'，并与形状闸那句 'agentId 格式不正确'、
 *     与路由内必填分支那句 'name 为必填项' **逐字互斥**；服务层与 db 零调用。
 *  ② 反向对照：全合规 body 必须**真的走到** `createAgent`（否则①的 400 完全可能来自"整条路由
 *     都进不去"——鉴权夹具写歪、前缀注册错、路径打错都会产出一台恒 400 的尺子，而它什么也没看）。
 *  ③ 'name 为必填项' 那条 400 与①那条 400 分家（前者由路由内 `if (!body?.name)` 产出，
 *     经 `error()` 出口 ⇒ **不带** `errorCode`；后者经全局 handler ⇒ 必带）。两型混成一条 =
 *     "400 有两种成因却在响应上无从分辨"，正是 G-739 记过的那一型。
 *
 * 镜像的前提（为什么 handler 是本文件重写的一份、以及它漂了谁会喊）：
 * `errorHandler` 住在 `src/server.ts` 且**未 export**（实测该文件顶层 `^export` 只有 `buildServer`），
 * 而 `buildServer()` 会 `registerPlugins` 全量插件（jwt / rate-limit / 网络分段 / 缺省路由），与本票
 * "只审一支路由的 body 校验身份"无关，且与 AGENTS §5 测试隔离铁律撞（会牵进 Redis / DB 连接面）。
 * 所以这里**逐字抄** `server.ts` 的 `errorHandler` 判定分支（含 `isMostlyEnglish` 那一档），
 * `isAppError` 直接 import 真模块（不复制实现）。镜像与生产漂开了怎样：由下方第一枚「前提锁」兜 ——
 * 它按**去掉空白后的源码**核生产 handler 里那四条承重字面量仍在位并被装上。生产改了映射，
 * 前提锁先红；而不是本用例对着一个已经不存在的行为安静地绿着（"判据失效的表现永远是安静"）。
 *
 * 变异自证（这张票的验收口径，不是可选动作）：把 create 支路的 schema 工厂换成"什么都不校验"的
 * 恒等工厂（`z` ⇒ `{ object: () => ({ parse: (v) => v }) }`，`.parse(request.body)` 逐字保留）
 * = 该支路的 body 校验整段不执行 ⇒ 不变量① 那枚用例必须翻红，且**只有它红**（②③ 与两枚前提锁
 * 不受影响仍绿）。摘掉校验后请求一路走到 `createAgent`，而夹具里的 `name` 是合法的 —— 所以任何
 * "只断 statusCode===400"的写法在这种实现上会绿，那正是本票要消灭的形态。
 *
 * 测试隔离铁律（AGENTS §5）：不连生产 PostgreSQL / Redis —— 鉴权层、服务层、db 层整体桩掉。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// 真模块直接 import，不在测试里复制第二份判定（isAppError 是生产 handler 的判据之一）
import { isAppError } from '../src/errors/AppError.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { svc, dbSpy } = vi.hoisted(() => ({
  svc: {
    getAgentDetail: vi.fn(),
    listAgents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    submitForReview: vi.fn(),
    publishAgent: vi.fn(),
    offlineAgent: vi.fn(),
    executeAgent: vi.fn(),
  },
  // db 层只作为"确实没往库里写"的隔离哨兵（口径见不变量①里的注释，别把它当成有牙的那一条）
  dbSpy: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}))

// 鉴权层整体桩掉：本票审的是 body 校验的身份，不审 RBAC。
// checkAuth 把令牌主体写进 request —— 与生产同位；属主只从承载层进（AGENTS §5「认证不等于授权」）。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => undefined),
  checkAuth: vi.fn(async (request: unknown) => {
    ;(request as { userId?: string }).userId = 'user-001'
    return true
  }),
  requireActiveUser: vi.fn(async () => true),
}))

// 服务层桩掉：该支路进 SQL 的唯一通道就是 createAgent。
vi.mock('../src/services/agent-service.js', () => svc)

vi.mock('../src/db/index.js', () => ({
  db: dbSpy,
  dbRead: { ...dbSpy },
}))

import { agentsRoutes } from '../src/routes/agents.js'

/**
 * 生产 `server.ts` 里 `errorHandler` 的判定分支（逐字抄，见文件头「镜像的前提」）。
 * `isMostlyEnglish` 在生产侧同样是模块私有，所以这一小段也一并镜像；承重字面量由「前提锁」核。
 */
function isMostlyEnglish(s: string | undefined): boolean {
  if (!s) return false
  // 含中文 → 视为已中文化
  if (/[一-龥]/.test(s)) return false
  // 含英文字母 → 视为英文
  return /[a-zA-Z]/.test(s)
}

const prodMirrorErrorHandler = (
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void => {
  if (reply.sent) return

  const isZodErr =
    error.name === 'ZodError' && Array.isArray((error as { issues?: unknown[] }).issues)
  const statusCode = isZodErr
    ? 400
    : error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500

  const errorCode = isAppError(error) ? error.errorCode : isZodErr ? 'VALIDATION_FAILED' : undefined
  const zodMsg = (error as { issues?: Array<{ message?: string }> }).issues?.[0]?.message
  const rawAppMsg = isAppError(error) ? error.message : undefined
  const rawErrMsg = error.message
  const message = isZodErr
    ? isMostlyEnglish(zodMsg)
      ? '参数错误'
      : (zodMsg ?? '参数错误')
    : statusCode >= 500
      ? '服务器错误'
      : isAppError(error)
        ? isMostlyEnglish(rawAppMsg)
          ? '操作失败,请稍后重试'
          : (rawAppMsg ?? '操作失败,请稍后重试')
        : isMostlyEnglish(rawErrMsg)
          ? '操作失败,请稍后重试'
          : rawErrMsg || '操作失败,请稍后重试'

  reply.status(statusCode).send({
    code: statusCode,
    message,
    ...(errorCode ? { errorCode } : {}),
  })
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.setErrorHandler(prodMirrorErrorHandler)
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  vi.clearAllMocks()
})

/** 形状闸那句（写侧）与路由内必填分支那句 —— 用来**排除**成因，不是拿来当期望值的。 */
const GATE_MSG = 'agentId 格式不正确'
const REQUIRED_NAME_MSG = 'name 为必填项'

describe('POST /api/agents/create 的 body 校验身份（G-1102637）', () => {
  it('① price 传字符串 ⇒ 400 的身份是 body 校验，且服务层与 db 零调用', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/create',
      payload: { name: '测试智能体', price: 'not-a-number' },
      headers: { authorization: 'Bearer t' },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json() as { code?: number; message?: string; errorCode?: string }
    expect(body.code).toBe(400)
    // 生产 handler 对英文 issue 的中文兜底档（zod 原文 "Invalid input: expected number, received
    // string" 被 isMostlyEnglish 换掉）—— 精确等值，不是 toContain：'参数错误' 同时也是 PUT 支路
    // safeParse 分支的措辞，含糊断法会把"这一发到底走了哪条校验"读丢。
    expect(body.message).toBe('参数错误')
    expect(body.errorCode).toBe('VALIDATION_FAILED')

    // 两条同形 400 的互斥断言 —— 这就是"证明 400 来自 body 校验而不是闸门/必填分支"的全部含义。
    // create 支路根本没有路径参数，形状闸结构上产不出这一发；即便将来有人给它加了 :id，
    // 这两句也会先红，而不是让闸门的 400 冒充 body 校验的 400。
    expect(body.message).not.toBe(GATE_MSG)
    expect(body.message).not.toBe(REQUIRED_NAME_MSG)

    // 局限（见文件头）：响应体今天没有结构化 issue，所以字段路径（['price']）无法被断言。
    // 这一行同时是"局限登记"与"改进哨兵"：哪天 handler 开始回传 issue，键集合会漂，
    // 本用例红在这里，而不是让"能断字段路径"这句话悄悄变成空头承诺。
    expect(body).not.toHaveProperty('issues')

    // 关键不变量：body 校验必须在进服务层之前拦住。只断状态码会放过"先创建了再抛 400"那一型；
    // 而这一发在变异面（校验不执行）上恰好翻红 —— 因为夹具里的 name 是合法的，
    // 摘掉校验后请求一路走到 createAgent。⇒ 这句 not.toHaveBeenCalled 就是本用例的牙。
    expect(svc.createAgent).not.toHaveBeenCalled()
    // db 侧哨兵：该支路进 SQL 的唯一通道是已桩掉的服务层，所以这一组断言在当次变异下
    // 不会单独翻红（如实说明，别把它当成有牙的那一条），它守的是"没有任何真实库调用发生"。
    expect(dbSpy.insert).not.toHaveBeenCalled()
    expect(dbSpy.update).not.toHaveBeenCalled()
    expect(dbSpy.execute).not.toHaveBeenCalled()
  })

  it('② 反向对照：全合规 body 必须真的走到 createAgent（否则①的 400 可能是空转尺子）', async () => {
    svc.createAgent.mockResolvedValueOnce({ agentId: 'x', name: '测试智能体', price: 19.9 })
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/create',
      payload: { name: '测试智能体', price: 19.9, isFree: false },
      headers: { authorization: 'Bearer t' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { code?: number; message?: string }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    // 正向对照的另一半：属主由承载层注入，不得由请求体自报
    expect(svc.createAgent).toHaveBeenCalledTimes(1)
    expect(svc.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({ name: '测试智能体', price: 19.9, userId: 'user-001' }),
    )
  })

  it('③ name 缺失那条 400 与①那条 400 分家（必填分支经 error() 出口，不带 errorCode）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/create',
      payload: { price: 1 },
      headers: { authorization: 'Bearer t' },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json() as { code?: number; message?: string; errorCode?: string }
    expect(body.code).toBe(400)
    expect(body.message).toBe(REQUIRED_NAME_MSG)
    // 这一发走的是路由内分支（`reply.status(400).send(error(400, …))`），不经全局 handler ⇒ 无 errorCode
    expect(body.errorCode).toBeUndefined()
    expect(svc.createAgent).not.toHaveBeenCalled()
  })
})

describe('前提锁 —— 本文件镜像的是生产映射，不是自造判据', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const REPO = join(HERE, '..', '..', '..')
  /** 去掉所有空白后比较：prettier 重排 / 折行不该把源码锁变成假红（本仓吃过这个亏）。 */
  const norm = (s: string) => s.replace(/\s+/g, '')

  it('server.ts 的 errorHandler 仍把 ZodError 落成 400 + VALIDATION_FAILED + 英文兜底「参数错误」', () => {
    const src = readFileSync(join(REPO, 'apps/api/src/server.ts'), 'utf8')
    const flat = norm(src)
    const loadBearing: Array<{ label: string; frag: string }> = [
      { label: 'ZodError 判定', frag: `error.name === 'ZodError' && Array.isArray(` },
      { label: 'ZodError ⇒ 400', frag: `const statusCode = isZodErr ? 400 : error.statusCode` },
      { label: 'ZodError ⇒ VALIDATION_FAILED', frag: `: isZodErr ? 'VALIDATION_FAILED' : undefined` },
      {
        label: '英文 issue 兜底中文',
        frag: `isMostlyEnglish(zodMsg) ? '参数错误' : (zodMsg ?? '参数错误')`,
      },
      { label: 'handler 确被装上', frag: `server.setErrorHandler(errorHandler)` },
    ]
    for (const { label, frag } of loadBearing) {
      expect(flat, `生产 handler 漂了（${label}）—— 本文件的镜像需要连带复核`).toContain(norm(frag))
    }
  })

  it('create 支路确实仍靠全局兜底（它不是 safeParse 型，所以本文件不能沿用无 handler 夹具）', () => {
    const src = readFileSync(join(REPO, 'apps/api/src/routes/agents.ts'), 'utf8')
    const flat = norm(src)
    // 取 create 那一支的窗口：从 server.post('/agents/create' 到下一个 server.put 之前
    const start = flat.indexOf(`server.post('/agents/create'`)
    expect(start, 'create 支路改名或搬走了 —— 本票的靶子需要重新定位').toBeGreaterThan(-1)
    const end = flat.indexOf('server.put(', start)
    const window = end > start ? flat.slice(start, end) : flat.slice(start)
    expect(window, 'create 支路不再走 .parse(request.body) ⇒ 本文件的全局兜底前提失效').toContain(
      norm('.parse(request.body)'),
    )
    expect(
      window,
      'create 支路若改成 safeParse，应把本用例并入 test/agents.test.ts 的写法而非留两份',
    ).not.toContain(norm('.safeParse(request.body)'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
