// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O4b 接线层证明 —— 「闸门已经站在真实生产路径上」。
 *
 * 与已入库的两份前置证明刻意不重叠:
 *  - `o4-data-scope-gate.test.ts` 证判据/拦截层本身(机制);
 *  - `o4-isolation-proof.test.ts` 证"闸门是真的"(归属边界 / 人路径零回归 / 开销恒定);
 *  - **本文件证第三件事**:生产路由与 service 的取数出口确实换成了受控出口,
 *    以及这些出口上**真实业务语句**的两态结论(缺归属 → 403,补归属 → 放行),
 *    外加"哪些路径刻意不接、为什么不接"的可执行说明。
 *
 * 两块:
 *  A 源码不变量(读文件文本,不 import 路由模块 —— 避免把整棵路由图拉进测试进程):
 *   A1 受控出口在路由/service 层的**真实调用点 ≥ 5**(判据排除注释与 import 行);
 *   A2 每条被点名的语句都带 owner 谓词(不允许"接了出口但仍只按 id 过滤");
 *   A3 未接线的文件保持原样(不出现半途接线)。
 *  B 行为证明(真表 + createScopedDb + 录制型假客户端,零真实连接):
 *   B1 `models:write` / `webhooks:manage` 的"只按 id 过滤"语句 → 403 DATA_SCOPE_DENIED
 *      (reason=OWNER_FILTER_REQUIRED),且**一条 SQL 都没下发**;
 *   B2 补 owner 谓词后 → 放行,且下发的 SQL 里确实带 `"user_id"` 与主体参数;
 *   B3 `messages` 的 owner 列映射(receiver_id)是**承重**的:不登记即 403,登记后放行;
 *   B4 人 JWT 主体在**同一条无归属语句**上完全不受影响(零回归的判别面);
 *   B5 未接线决策的证据:compute 触达业务表 = DATA_ACCESS_DENIED;
 *      无 owner 列的表(codebase_chunks / webhook_delivery_logs)在 scoped 模式下必拒。
 *
 * 全 mock:不 import `src/db/index.js`(它会在测试进程里拉起连接池与定时器),
 * 不连生产 PostgreSQL / Redis。
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, eq, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import type postgres from 'postgres'
import {
  codebaseChunks,
  messages,
  tools,
  webhookDeliveryLogs,
  webhookSubscriptions,
  zhsAiUserModelChatConfig,
} from '@ihui/database'
import { getCapability, type ApiKeyPermission } from '@ihui/types'
import { runWithPrincipal, type Principal } from '../src/plugins/principal.js'
import {
  configureDataScopeGuard,
  createScopedDb,
  DATA_SCOPE_ERROR_CODES,
  DataScopeViolationError,
  resetSuperuserCache,
  type DataScopeErrorCode,
} from '../src/utils/scoped-guard.js'

const API_SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url))

// ----------------------------------------------------------------------------
// 夹具(与 o4-isolation-proof 同范式:录制型假客户端,永不联网)
// ----------------------------------------------------------------------------
const USER_ID = '11111111-2222-3333-4444-555555555555'
const OTHER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const CONFIG_ID = 'cccccccc-1111-2222-3333-444444444444'
const SUB_ID = 'dddddddd-1111-2222-3333-444444444444'
const REPO_ID = 'repo-hash-abc'

interface RecordedQuery {
  sql: string
  params: unknown[]
}

function makeFakeClient(): { client: postgres.Sql; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = []
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(sqlText: string, params: unknown[] = []): Promise<unknown[]> & {
      values: () => Promise<unknown[]>
    } {
      queries.push({ sql: sqlText, params })
      const rows: unknown[] = []
      const promise = Promise.resolve(rows) as Promise<unknown[]> & {
        values: () => Promise<unknown[]>
      }
      promise.values = (): Promise<unknown[]> => Promise.resolve(rows)
      return promise
    },
    begin: async (fn: (inner: unknown) => Promise<unknown>): Promise<unknown> => fn(client),
    end: async (): Promise<void> => {},
  }
  return { client: client as unknown as postgres.Sql, queries }
}

const fake = makeFakeClient()
const rawDb = drizzle(fake.client, {
  schema: {
    messages,
    tools,
    codebaseChunks,
    webhookSubscriptions,
    webhookDeliveryLogs,
    zhsAiUserModelChatConfig,
  },
})
/** 与 src/db/index.ts 的 `dbScoped` 同一个包装函数 —— 证的是真出口,不是复刻品。 */
const scoped = createScopedDb(rawDb)

function machine(scope: ApiKeyPermission): Principal {
  const capability = getCapability(scope)
  return {
    kind: 'apiKey',
    subjectId: USER_ID,
    roleId: 0,
    apiKeyId: 'key-wiring-1',
    scopes: [],
    ...(capability ? { capability } : {}),
  }
}

function human(): Principal {
  return { kind: 'jwt', subjectId: USER_ID, roleId: 3, scopes: [] }
}

/**
 * 在主体上下文内执行并捕获结论。
 * 必须整体待在 runWithPrincipal 内 await —— drizzle 构造器是惰性 thenable,
 * 闸门在被 await 的那一刻才跑,出上下文即静默失效(见 o4-isolation-proof 同段注释)。
 */
async function attempt(
  principal: Principal,
  fn: () => Promise<unknown> | unknown,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  return runWithPrincipal(principal, async (): Promise<{ ok: true } | { ok: false; error: unknown }> => {
    try {
      await fn()
      return { ok: true }
    } catch (error) {
      return { ok: false, error }
    }
  })
}

function expectDenied(
  result: { ok: true } | { ok: false; error: unknown },
  errorCode: DataScopeErrorCode,
  statusCode: number,
  reason?: string,
): void {
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error(`预期被拒却放行(${errorCode})`)
  const error = result.error
  expect(error).toBeInstanceOf(DataScopeViolationError)
  const err = error as DataScopeViolationError
  expect(err.errorCode).toBe(errorCode)
  expect(err.statusCode).toBe(statusCode)
  if (reason) expect(err.reason).toBe(reason)
}

// ----------------------------------------------------------------------------
// A 组:源码不变量
// ----------------------------------------------------------------------------
interface SourceFile {
  path: string
  /** 去掉块注释与行注释后的正文(注释里出现 dbScoped 不算调用点)。 */
  code: string
  raw: string
}

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

/** 剥注释:先块注释,再逐行 `//` 注释(字符串字面量里不含 // 形态的 URL,故安全)。 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

/** 调用点 = 出现 dbScoped / dbReadScoped 的实际语句行(排除 import 行与注释行)。 */
function callSitesOf(code: string): string[] {
  return code
    .split('\n')
    .filter((line) => !/^\s*import\b/.test(line) && !/\bfrom\s+'/.test(line))
    .filter((line) => /\bdbScoped\b|\bdbReadScoped\b/.test(line))
}

const SCOPED_EXPORT_RE = /\bdbScoped\b|\bdbReadScoped\b/

/** 受控出口的 import 行(证明用的是 db 出口本身,不是就地自造对象)。 */
function scopedImportLine(code: string): string | undefined {
  return code.split('\n').find((line) => /^import \{[^}]*(dbScoped|dbReadScoped)/.test(line))
}

let sources: SourceFile[] = []
/** 受控出口的实现文件(不计入"调用点")。 */
const GATE_IMPLEMENTATION_FILES = new Set(['db/index.ts', 'utils/scoped-guard.ts'])

beforeAll(() => {
  sources = listTsFiles(API_SRC_ROOT)
    .filter((full) => !GATE_IMPLEMENTATION_FILES.has(relative(API_SRC_ROOT, full).replace(/\\/g, '/')))
    .map((full) => {
      const raw = readFileSync(full, 'utf8')
      return { path: relative(API_SRC_ROOT, full).replace(/\\/g, '/'), code: stripComments(raw), raw }
    })
})

/** 取某文件正文里指定函数的函数体(从函数声明起,到文件尾;够覆盖其内所有语句)。 */
function bodyOf(source: SourceFile, declaration: string): string {
  const start = source.code.indexOf(declaration)
  if (start === -1) throw new Error(`${source.path} 里找不到 ${declaration}`)
  return source.code.slice(start)
}

function sourceOf(path: string): SourceFile {
  const found = sources.find((s) => s.path === path)
  if (!found) throw new Error(`源文件未纳入扫描:${path}`)
  return found
}

describe('O4b-A 接线不变量(源码层)', () => {
  it('A1 路由/service 层受控出口真实调用点 ≥ 5(不是注释、不是 import)', () => {
    const sites = sources.flatMap((s) => callSitesOf(s.code).map((line) => `${s.path}: ${line.trim()}`))
    expect(sites.length).toBeGreaterThanOrEqual(5)
    // 且这些调用点确实落在"生产可达"的目录里,而不是又堆回闸门外
    const layers = new Set(sites.map((site) => site.split('/')[0] ?? ''))
    for (const layer of layers) {
      expect(['routes', 'services', 'db', 'jobs', 'workers', 'websocket']).toContain(layer)
    }
  })

  it('A2 每个被接线的文件都真的 import 了受控出口', () => {
    for (const path of [
      'routes/v1-ai-core.ts',
      'routes/other/v1-customer-service-routes.ts',
      'routes/developer/webhooks.ts',
      'db/content-generation-queries.ts',
    ]) {
      const source = sourceOf(path)
      const importLine = scopedImportLine(source.code)
      expect(importLine, `${path} 未 import 受控出口`).toBeDefined()
      expect(importLine ?? '', path).toMatch(/from '[^']*index\.js'$/)
      expect(callSitesOf(source.code).length, `${path} 只有 import 没有调用点`).toBeGreaterThan(0)
    }
  })

  it('A3 v1-ai-core:用户模型配置的写语句必须带 owner 谓词(不允许只按 id 过滤)', () => {
    const code = sourceOf('routes/v1-ai-core.ts').code
    // 表名 + 归属列同时出现在同一条 where 里
    const ownedPredicates =
      code.match(
        /and\(\s*eq\(zhsAiUserModelChatConfig\.id[\s\S]{0,160}?eq\(zhsAiUserModelChatConfig\.userId/g,
      ) ?? []
    // update / delete 两处写 + 两处前置读(PUT 与 DELETE handler 各一条)
    expect(ownedPredicates.length).toBeGreaterThanOrEqual(3)
    // 原始出口上不留"只按 id 过滤"的写语句
    expect(code).not.toMatch(
      /\bdb\.(update|delete)\(zhsAiUserModelChatConfig\)[\s\S]{0,120}?\.where\(eq\(zhsAiUserModelChatConfig\.id/,
    )
  })

  it('A4 developer/webhooks:订阅表的写语句必须带 owner 谓词', () => {
    const code = sourceOf('routes/developer/webhooks.ts').code
    const ownedPredicates =
      code.match(
        /and\(\s*eq\(webhookSubscriptions\.id[\s\S]{0,120}?eq\(webhookSubscriptions\.userId/g,
      ) ?? []
    // getOwnedSubscription 的读 + update + delete
    expect(ownedPredicates.length).toBeGreaterThanOrEqual(3)
    expect(code).not.toMatch(
      /\bdb\.(update|delete)\(webhookSubscriptions\)[\s\S]{0,120}?\.where\(eq\(webhookSubscriptions\.id/,
    )
  })

  it('A5 站内信读路径走受控读出口,且同文件登记了 messages 的 owner 列映射', () => {
    const source = sourceOf('routes/other/v1-customer-service-routes.ts')
    const messagesReads = callSitesOf(source.code).filter((line) => /dbReadScoped/.test(line))
    expect(messagesReads.length).toBeGreaterThanOrEqual(3)
    // owner 列映射必须与读端点同文件落定(否则 receiver_id 过滤在闸门口径下不成立)
    expect(source.code).toMatch(
      /configureDataScopeGuard\(\{\s*ownerColumnByTable:\s*\{\s*messages:\s*'receiver_id'\s*\}\s*\}\)/,
    )
  })

  it('A6 内容生成历史(user:read = scoped-read)在 service 层受控,模板目录保持原始出口', () => {
    const source = sourceOf('db/content-generation-queries.ts')
    const history = bodyOf(source, 'export async function findGenerationHistory')
    expect(callSitesOf(history).length).toBeGreaterThanOrEqual(2)
    expect(history).toMatch(/where\(eq\(contentGenerationTasks\.userId/)
    const templates = bodyOf(source, 'export async function findGenerationTemplates')
    expect(SCOPED_EXPORT_RE.test(templates)).toBe(false)
  })

  it('A7 未接线文件保持"半途不接"的空白(不出现受控出口,也不被静默改成别的出口)', () => {
    const untouched = sourceOf('routes/other/v1-tools-routes.ts')
    expect(callSitesOf(untouched.code)).toEqual([])
    expect(untouched.code).toMatch(/import \{ dbRead \} from '\.\.\/\.\.\/db\/index\.js'/)
    // 代码库检索族与技能面同样未接(理由见 B5/B6 与交付说明):不得出现"接了一半"的出口
    expect(callSitesOf(sourceOf('services/codebase-index-service.ts').code)).toEqual([])
    expect(SCOPED_EXPORT_RE.test(sourceOf('routes/skills.ts').code)).toBe(false)
    expect(SCOPED_EXPORT_RE.test(sourceOf('routes/v1-codebase-search.ts').code)).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// B 组:行为证明(真表 + 受控出口)
// ----------------------------------------------------------------------------
beforeEach(() => {
  fake.queries.length = 0
  configureDataScopeGuard({
    probeSuperuser: async (): Promise<boolean> => false,
    isProduction: () => false,
    warn: (): void => {},
  })
  resetSuperuserCache()
})

describe('O4b-B1/B2 接线语句的两态结论(models:write = scoped-write)', () => {
  const writeOwned = 'models:write'

  it('DELETE 只按 id 过滤 → 403 DATA_SCOPE_DENIED(OWNER_FILTER_REQUIRED),SQL 一条没下发', async () => {
    const result = await attempt(machine(writeOwned), () =>
      scoped.delete(zhsAiUserModelChatConfig).where(eq(zhsAiUserModelChatConfig.id, CONFIG_ID)),
    )
    expectDenied(result, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403, 'OWNER_FILTER_REQUIRED')
    expect(fake.queries).toHaveLength(0)
  })

  it('接线后的 DELETE(id + user_id)→ 放行,且下发的 SQL 真带归属谓词', async () => {
    const result = await attempt(machine(writeOwned), () =>
      scoped
        .delete(zhsAiUserModelChatConfig)
        .where(
          and(
            eq(zhsAiUserModelChatConfig.id, CONFIG_ID),
            eq(zhsAiUserModelChatConfig.userId, USER_ID),
          ),
        ),
    )
    expect(result.ok).toBe(true)
    expect(fake.queries).toHaveLength(1)
    const statement = fake.queries[0]
    if (!statement) throw new Error('未捕获到 DELETE 语句')
    expect(statement.sql).toContain('"zhs_ai_user_model_chat_config"."user_id"')
    expect(statement.params).toEqual([CONFIG_ID, USER_ID])
  })

  it('UPDATE 同形:缺归属 → 403,补归属 → 放行', async () => {
    const bare = await attempt(machine(writeOwned), () =>
      scoped
        .update(zhsAiUserModelChatConfig)
        .set({ name: 'x' })
        .where(eq(zhsAiUserModelChatConfig.id, CONFIG_ID)),
    )
    expectDenied(bare, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
    expect(fake.queries).toHaveLength(0)

    const owned = await attempt(machine(writeOwned), () =>
      scoped
        .update(zhsAiUserModelChatConfig)
        .set({ name: 'x' })
        .where(
          and(
            eq(zhsAiUserModelChatConfig.id, CONFIG_ID),
            eq(zhsAiUserModelChatConfig.userId, USER_ID),
          ),
        ),
    )
    expect(owned.ok).toBe(true)
    expect(fake.queries).toHaveLength(1)
  })

  it('他人一行:补了归属谓词也取不到(SQL 层就为空),而不是读出来再比 userId', async () => {
    const result = await attempt(machine(writeOwned), () =>
      scoped
        .select({ id: zhsAiUserModelChatConfig.id })
        .from(zhsAiUserModelChatConfig)
        .where(
          and(
            eq(zhsAiUserModelChatConfig.id, CONFIG_ID),
            eq(zhsAiUserModelChatConfig.userId, OTHER_ID),
          ),
        ),
    )
    // 闸门要求"绑定的主体 = 自己",绑他人 ID 即越过归属边界
    expectDenied(result, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
    expect(fake.queries).toHaveLength(0)
  })

  it('POST(INSERT 自带 user_id)→ 放行:机器凭据可以种自己的数据', async () => {
    const result = await attempt(machine(writeOwned), () =>
      scoped.insert(zhsAiUserModelChatConfig).values({
        userId: USER_ID,
        name: 'n',
        vendor: 'openai',
        modelId: 'gpt-4o',
        apiKey: 'sk-x',
      }),
    )
    expect(result.ok).toBe(true)
    expect(fake.queries[0]?.sql).toContain('"user_id"')
    expect(fake.queries[0]?.params).toContain(USER_ID)
  })
})

describe('O4b-B1/B2 接线语句的两态结论(webhooks:manage = scoped-write)', () => {
  const manage = 'webhooks:manage'

  it('按 id 删/改订阅 → 缺归属即 403', async () => {
    const del = await attempt(machine(manage), () =>
      scoped.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, SUB_ID)),
    )
    expectDenied(del, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)

    const patch = await attempt(machine(manage), () =>
      scoped
        .update(webhookSubscriptions)
        .set({ enabled: false })
        .where(eq(webhookSubscriptions.id, SUB_ID)),
    )
    expectDenied(patch, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
    expect(fake.queries).toHaveLength(0)
  })

  it('接线形态(读/改/删订阅均带 user_id)→ 全部放行', async () => {
    const read = await attempt(machine(manage), () =>
      scoped
        .select({ id: webhookSubscriptions.id, secret: webhookSubscriptions.secret })
        .from(webhookSubscriptions)
        .where(
          and(eq(webhookSubscriptions.id, SUB_ID), eq(webhookSubscriptions.userId, USER_ID)),
        )
        .limit(1),
    )
    expect(read.ok).toBe(true)

    const patch = await attempt(machine(manage), () =>
      scoped
        .update(webhookSubscriptions)
        .set({ enabled: false })
        .where(
          and(eq(webhookSubscriptions.id, SUB_ID), eq(webhookSubscriptions.userId, USER_ID)),
        ),
    )
    expect(patch.ok).toBe(true)

    const create = await attempt(machine(manage), () =>
      scoped.insert(webhookSubscriptions).values({
        userId: USER_ID,
        url: 'https://example.invalid/hook',
        events: ['relay.call.completed'],
        secret: 'whsec_x',
        enabled: true,
      }),
    )
    expect(create.ok).toBe(true)
    expect(fake.queries).toHaveLength(3)
  })

  it('投递日志(无 owner 列)在受控出口上必拒 —— 故该表刻意保持原始出口', async () => {
    const result = await attempt(machine(manage), () =>
      scoped.insert(webhookDeliveryLogs).values({
        subscriptionId: SUB_ID,
        event: 'relay.call.completed',
        payload: { hello: 'world' },
        status: 'pending',
      }),
    )
    expectDenied(result, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
    expect(fake.queries).toHaveLength(0)
  })
})

describe('O4b-B3 messages 的 owner 列映射是承重的(不是装饰)', () => {
  // 先证"不登记"这一态:本用例文件里 configureDataScopeGuard 的登记动作发生在
  // 下一个 describe,故此处 messages 仍走默认 owner 列 user_id(该表并无此列)。
  it('未登记映射时:收件人=本人 的读语句在闸门口径下不成立 → 403', async () => {
    const result = await attempt(machine('messages:read'), () =>
      scoped
        .select({ id: messages.id })
        .from(messages)
        .where(or(eq(messages.senderId, USER_ID), eq(messages.receiverId, USER_ID))),
    )
    expectDenied(result, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
    expect(fake.queries).toHaveLength(0)
  })

  it('登记 receiver_id 为 owner 列后:接线形态(收件人=本人)放行,绑他人即拒', async () => {
    // 与 routes/other/v1-customer-service-routes.ts 顶部同一份登记
    configureDataScopeGuard({ ownerColumnByTable: { messages: 'receiver_id' } })

    const mine = await attempt(machine('messages:read'), () =>
      scoped
        .select({ id: messages.id })
        .from(messages)
        .where(or(eq(messages.senderId, USER_ID), eq(messages.receiverId, USER_ID))),
    )
    expect(mine.ok).toBe(true)
    const unread = await attempt(machine('messages:read'), () =>
      scoped
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.receiverId, USER_ID)),
    )
    expect(unread.ok).toBe(true)

    fake.queries.length = 0
    const foreign = await attempt(machine('messages:read'), () =>
      scoped.select({ id: messages.id }).from(messages).where(eq(messages.receiverId, OTHER_ID)),
    )
    expectDenied(foreign, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
    expect(fake.queries).toHaveLength(0)
  })
})

describe('O4b-B4 人 JWT 路径零回归(同一批语句的判别面)', () => {
  it('无归属谓词的 id-only 写语句:人主体照发、闸不参与', async () => {
    const result = await attempt(human(), () =>
      scoped.delete(zhsAiUserModelChatConfig).where(eq(zhsAiUserModelChatConfig.id, CONFIG_ID)),
    )
    expect(result.ok).toBe(true)
    expect(fake.queries).toHaveLength(1)
  })

  it('messages:未登记映射前的原语义也成立 —— 人发他人收件人的查询不被闸拦', async () => {
    const result = await attempt(human(), () =>
      scoped.select({ id: messages.id }).from(messages).where(eq(messages.receiverId, OTHER_ID)),
    )
    expect(result.ok).toBe(true)
    expect(fake.queries).toHaveLength(1)
  })
})

describe('O4b-B5/B6 未接线决策的可执行证据', () => {
  it('compute 能力触达业务表 = DATA_ACCESS_DENIED(故 GET /v1/user/models 仍走原始出口)', async () => {
    const result = await attempt(machine('models:read'), () =>
      scoped
        .select({ id: zhsAiUserModelChatConfig.id })
        .from(zhsAiUserModelChatConfig)
        .where(eq(zhsAiUserModelChatConfig.userId, USER_ID)),
    )
    expectDenied(result, DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED, 403)
  })

  it('tools:read = compute → 接线会把"全站已发布工具目录"打死成恒定 403,故 v1-tools-routes 不接', async () => {
    const result = await attempt(machine('tools:read'), () =>
      scoped.select({ id: tools.id }).from(tools).where(eq(tools.status, 'published')),
    )
    expectDenied(result, DATA_SCOPE_ERROR_CODES.DATA_ACCESS_DENIED, 403)
  })

  it('codebase_chunks 无 user_id(repo 维度归属)→ scoped 模式下必拒,故检索族不接', async () => {
    const read = await attempt(machine('codebase:read'), () =>
      scoped.select({ id: codebaseChunks.id }).from(codebaseChunks).where(eq(codebaseChunks.repoId, REPO_ID)),
    )
    expectDenied(read, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
    const write = await attempt(machine('codebase:write'), () =>
      scoped.insert(codebaseChunks).values({
        repoId: REPO_ID,
        filePath: 'apps/api/src/server.ts',
        lineStart: 1,
        lineEnd: 10,
        content: 'export {}',
      }),
    )
    expectDenied(write, DATA_SCOPE_ERROR_CODES.DATA_SCOPE_DENIED, 403)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
