// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 O82 续四(2026-09-28):turn_ordinal 并发双插 —— **先量,再按结果走**。
 *
 * 背景:同会话并发插入时"SELECT max(turn_ordinal) 再 +1"的写法可能让两条消息读到
 * 同一个 max ⇒ 序号"尽力而为"(撞号)。票面明令:收紧前必须先量真实发生率,
 * 不得凭想象加锁。本文件就是那把"尺":
 *
 *  ① 基线测量(旧形态复现):逐字复刻收紧前 routes/message.ts /messages/send 的两条
 *     语句(无事务、无锁的 SELECT max → INSERT,序号仍走唯一出口 turnOrdinalForRole),
 *     同会话并发双插 60 轮,统计撞号率。判据:**必须 > 0** —— 若量出 0,说明本实验
 *     没有复现出竞态,收紧的立论依据就得重查,而不是"竞态不存在"。
 *  ② 生产路径回归(chat-queries.createMessage 事务内双插):钉住"两条并发插入
 *     ordinal 必不同且连续({1,2})"。
 *  ③ 生产路由回归(POST /messages/send 真路由 inject 双插):同 ②。
 *
 * 真库测量结果(2026-09-28 首跑,PostgreSQL 18.6 @127.0.0.1:5432,临时库
 * ihui_turnord_test_20260928,每形态 60 轮 × 2 并发):
 *   旧形态撞号率 = 100.0%(60/60);createMessage(收紧前) = 100.0%(60/60);
 *   /messages/send(收紧前) = 100.0%(60/60)。
 *   收紧后(会话行 FOR UPDATE)②③ 复跑均为 0 撞号且 {1,2} 连续。
 *
 * 隔离纪律(AGENTS §5;机制照抄 apps/api/tests/o13-bg-rls-live.test.ts):
 *  - 一律不碰开发库 `ihui` 的数据面:只从 apps/api/.env 读它的**连接凭据**推导
 *    host/role,连的是维护库 `postgres` 并 CREATE DATABASE 当日演练库
 *    `ihui_turnord_test_<YYYYMMDD>`,收尾 DROP;起跑前也先 DROP(崩溃残留自愈)。
 *  - 演练库只建测量所需的最小表集(users 桩 + chat_conversations + chat_messages,
 *    列名/类型/默认值逐列对齐 packages/database/src/schema/chat.ts;RLS 不在竞态
 *    变量之列,故不复刻,已在注释声明)。
 *  - skip 口径照抄 o13:环境探针放在 describe 之前,探不到可连的 PG 服务端口 ⇒
 *    整个文件显式 skip 并喊"未判定",绝不冒充跑过。探针复用
 *    packages/database/scripts/tenant-rls-live-check.mjs 的 probePortBusy 唯一实现。
 *  - 生产出口(db / chat-queries / routes/message)在 process.env.DATABASE_URL 指向
 *    演练库**之后**才动态 import(config/db 池在导入期建,先 import 会绑错库)。
 *  - 路由鉴权 mock 走 tests/helpers/mock-auth.ts 的既有出口(mockCheckAuth),
 *    与 study-routes.real.test.ts 同机制;数据层不 mock,SQL 全真。
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { config as dotenvConfig } from 'dotenv'
import { eq, getTableColumns, sql, type Column, type Table } from 'drizzle-orm'
import { chatConversations, chatMessages, type Database } from '@ihui/database'
import postgres from 'postgres'
import Fastify, { type FastifyInstance } from 'fastify'
import { mockAuthenticate, mockCheckAuth, setMockUser } from './helpers/mock-auth.js'
import { turnOrdinalForRole } from '../src/services/turn-ordinal.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const API_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(API_ROOT, '..', '..')
const LIVE_CHECK_PATH = join(
  REPO_ROOT,
  'packages',
  'database',
  'scripts',
  'tenant-rls-live-check.mjs',
)

/** live-check 的端口探针(判据只有一份实现,禁止在本文件另写 socket 探测)。 */
interface LiveCheckModule {
  probePortBusy: (
    port: number,
    host?: string,
    timeoutMs?: number,
  ) => Promise<{ busy: boolean; detail: string }>
}

// 路由整模块 mock 鉴权出口(照抄 study-routes.real.test.ts 的机制,数据层不 mock)。
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
  hasHumanJwtCredential: vi.fn(() => false),
  requireApiKeyOrJwt: vi.fn(),
  checkAuthOrInternalService: vi.fn(),
}))

// ── 环境探针(放在 suite 判定之前;o13 同位同形)──
/** 开发库连接串只用于推导 host/role/口令;数据面一律不碰(见头注隔离纪律)。 */
function devDbUrl(): string | null {
  const parsed = dotenvConfig({ path: join(API_ROOT, '.env') }).parsed
  // dotenv 会把 .env 的键补进 process.env —— DATABASE_APP_URL(受控出口)若被带入,
  // db/index.js 会在导入期对**开发库**建池并打启动探针;本票连只读探针都不许碰开发库,
  // 受控出口与 turn_ordinal 路径无关,直接摘掉,让 db/index 走"未配置"告警分支。
  delete process.env.DATABASE_APP_URL
  return parsed?.DATABASE_URL ?? process.env.DATABASE_URL ?? null
}

const liveCheck: LiveCheckModule = await (import(
  /* @vite-ignore */ pathToFileURL(LIVE_CHECK_PATH).href
) as Promise<LiveCheckModule>)

const rawUrl = devDbUrl()
let gateHost = '127.0.0.1'
let gatePort = 5432
let base: URL | null = null
try {
  base = rawUrl ? new URL(rawUrl) : null
  if (base) {
    gateHost = base.hostname || '127.0.0.1'
    gatePort = Number(base.port) || 5432
  }
} catch {
  base = null
}
const probe = base
  ? await liveCheck.probePortBusy(gatePort, gateHost)
  : { busy: false, detail: 'DATABASE_URL 不可解析' }
const suite = probe.busy ? describe : describe.skip
if (!probe.busy) {
  console.warn(
    `[turn-ordinal-concurrency] 未判定:本机探不到可连的 PostgreSQL(${gateHost}:${gatePort} —— ${probe.detail})。` +
      '并发双插撞号率**没有跑**,不得把本文件的 skip 读成"O82 续四已验证"。',
  )
}

const TMP_DB = `ihui_turnord_test_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
const ROUNDS = 60

/** 最小演练 schema:列名/类型/默认值逐列对齐 packages/database/src/schema/chat.ts。 */
const SCHEMA_DDL = `
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
CREATE TABLE chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL DEFAULT '新对话',
  model varchar(64) NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt text,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_message_at timestamp with time zone,
  last_read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  archived_at timestamp with time zone,
  compressed_at timestamp with time zone,
  compressed_context text,
  pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamp with time zone,
  group_id uuid, -- schema 里是 FK → chat_conversation_groups;演练库不建那张表,被测路由只做 SELECT ⇒ 补列不补约束
  share_token varchar(32) UNIQUE,
  history_projection_state jsonb
);
CREATE INDEX ix_chat_conversations_user_last_message ON chat_conversations (user_id, last_message_at);
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL DEFAULT 'user',
  content text NOT NULL,
  tokens integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reasoning text,
  turn_ordinal integer,
  parent_message_id uuid,
  sibling_index integer
);
CREATE INDEX ix_chat_messages_conversation ON chat_messages (conversation_id);
CREATE INDEX idx_chat_messages_by_turn ON chat_messages (conversation_id, turn_ordinal);
`

type SqlClient = ReturnType<typeof postgres>
let adminSql: SqlClient | null = null
let seedSql: SqlClient | null = null
// 动态导入的生产出口按结构类型持有(eslint 禁 `typeof import()` 注解)
let dbMod: { db: Database; dbClient: SqlClient } | null = null
let chatQ: {
  createMessage: (input: {
    conversationId: string
    role?: string
    content: string
  }) => Promise<unknown>
} | null = null
let server: FastifyInstance | null = null
let userId = ''

/**
 * 演练 schema 与生产 schema 的**列集对账**。这一组刻意不连库,所以它在 CI 上也跑。
 *
 * 立因(2026-10-07 实测):本文件下面那组真库演练在探不到 PostgreSQL 时整组 skip
 * (CI 就是这个形态),于是"演练用的最小 DDL 与 `packages/database` 的 schema 漂开"这件事
 * **只有装了 PG 的机器看得见**。2026-10-01 那次给 `chat_conversations` 加 `group_id`
 * (`46fc721037`)没带上这里,之后路由的 `db.select().from(chatConversations)` 在真库演练里
 * 直接 500 —— 而 CI 一路绿,红了 6 天没人看见。头注那句"逐列对齐"因此第一次有了机器判据。
 */
function ddlColumnsOf(tableSqlName: string): string[] {
  const marker = `CREATE TABLE ${tableSqlName} (`
  const from = SCHEMA_DDL.indexOf(marker)
  expect(from).toBeGreaterThanOrEqual(0)
  const to = SCHEMA_DDL.indexOf('\n);', from)
  expect(to).toBeGreaterThan(from)
  const body = SCHEMA_DDL.slice(from + marker.length, to)
  return [...body.matchAll(/^\s{2}([a-z_][a-z0-9_]*)\s+[a-z]/gm)].map((m) => m[1]).sort()
}

function schemaColumnsOf(table: Table): string[] {
  const cols = Object.values(getTableColumns(table) as Record<string, Column>).map((c) => c.name)
  // 取不到列集 = 判据失明,不得被读成"两边一致"
  expect(cols.length, `drizzle schema 在 ${table} 上读到 0 列`).toBeGreaterThan(0)
  return [...new Set(cols)].sort()
}

describe('演练 DDL ↔ 生产 schema 列集对账(零连接,CI 也跑)', () => {
  it('chat_conversations 的 DDL 列集等于 schema', () => {
    expect(ddlColumnsOf('chat_conversations')).toEqual(schemaColumnsOf(chatConversations))
  })

  it('chat_messages 的 DDL 列集等于 schema', () => {
    expect(ddlColumnsOf('chat_messages')).toEqual(schemaColumnsOf(chatMessages))
  })
})

suite('O82 续四:turn_ordinal 并发双插(真库演练)', () => {
  beforeAll(async () => {
    const maint = new URL(base!.toString())
    maint.pathname = '/postgres'
    const tmp = new URL(base!.toString())
    tmp.pathname = `/${TMP_DB}`

    adminSql = postgres(maint.toString(), { max: 1 })
    // 起跑前自愈残留(上一趟崩溃没走到收尾),再建当日演练库
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TMP_DB}" WITH (FORCE)`)
    await adminSql.unsafe(`CREATE DATABASE "${TMP_DB}"`)

    seedSql = postgres(tmp.toString(), { max: 3 })
    await seedSql.unsafe(SCHEMA_DDL)

    // 生产出口必须在 env 指向演练库之后才 import(db 池与 config 都在导入期求值)
    process.env.DATABASE_URL = tmp.toString()
    dbMod = await import('../src/db/index.js')
    chatQ = await import('../src/db/chat-queries.js')
    const msgMod = await import('../src/routes/message.js')

    server = Fastify({ logger: false })
    await server.register(msgMod.messageRoutes)
    await server.ready()

    const [u] = await seedSql`INSERT INTO users DEFAULT VALUES RETURNING id`
    userId = String(u!.id)
    setMockUser(userId)
  }, 120_000)

  afterAll(async () => {
    if (server) await server.close()
    if (dbMod) await dbMod.dbClient.end({ timeout: 5 })
    if (seedSql) await seedSql.end({ timeout: 5 })
    if (adminSql) {
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TMP_DB}" WITH (FORCE)`)
      await adminSql.end({ timeout: 5 })
    }
  }, 60_000)

  async function newConversation(): Promise<string> {
    const [row] =
      await seedSql!`INSERT INTO chat_conversations (user_id) VALUES (${userId}) RETURNING id`
    return String(row!.id)
  }

  /** 经生产出口读回该会话全部 turn_ordinal(升序)。 */
  async function ordinalsOf(conversationId: string): Promise<number[]> {
    const rows = await dbMod!.db
      .select({ o: chatMessages.turnOrdinal })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
    return rows.map((r) => Number(r.o)).sort((a, b) => a - b)
  }

  /**
   * 旧形态复现:与收紧前 routes/message.ts /messages/send 逐字同口径 ——
   * 无事务、无锁的 `select max(turn_ordinal)` → `insert`。序号仍走唯一出口。
   */
  async function legacySendInsert(conversationId: string, content: string): Promise<void> {
    const turnRows = await dbMod!.db
      .select({ maxTurn: sql<number | null>`max(${chatMessages.turnOrdinal})` })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
    await dbMod!.db.insert(chatMessages).values({
      conversationId,
      role: 'user',
      content,
      turnOrdinal: turnOrdinalForRole(Number(turnRows[0]?.maxTurn ?? 0), 'user'),
    })
  }

  function report(label: string, collisions: number, notConsecutive: number): string {
    return (
      `[turn-ord-measure] ${label}: ${ROUNDS} 对并发双插,` +
      `撞号=${collisions}(${((collisions / ROUNDS) * 100).toFixed(1)}%),` +
      `非连续(撞号即不连续)=${notConsecutive}`
    )
  }

  it('基线测量:旧形态(无事务无锁)并发双插撞号率必须 > 0(收紧的立论依据)', async () => {
    let collisions = 0
    for (let r = 0; r < ROUNDS; r++) {
      const conv = await newConversation()
      await Promise.all([
        legacySendInsert(conv, `base-${r}-a`),
        legacySendInsert(conv, `base-${r}-b`),
      ])
      const ords = await ordinalsOf(conv)
      expect(ords).toHaveLength(2)
      if (ords[0] === ords[1]) collisions += 1
    }
    // eslint-disable-next-line no-console -- 测量结果必须出声,这是本票的交付物
    console.log(report('旧形态 select-max→insert', collisions, collisions))
    // 判据是"量得出竞态":0 不代表安全,只代表本实验没复现出来 ⇒ 立论失效,必须喊出来
    expect(collisions, '旧形态并发双插未在真库复现出撞号:收紧依据需重查').toBeGreaterThan(0)
  }, 300_000)

  it('回归:chat-queries.createMessage 同会话并发双插 ordinal 必不同且连续', async () => {
    let collisions = 0
    let notConsecutive = 0
    for (let r = 0; r < ROUNDS; r++) {
      const conv = await newConversation()
      await Promise.all([
        chatQ!.createMessage({ conversationId: conv, role: 'user', content: `cm-${r}-a` }),
        chatQ!.createMessage({ conversationId: conv, role: 'user', content: `cm-${r}-b` }),
      ])
      const ords = await ordinalsOf(conv)
      expect(ords).toHaveLength(2)
      if (ords[0] === ords[1]) collisions += 1
      if (ords[0] !== 1 || ords[1] !== 2) notConsecutive += 1
    }
    // eslint-disable-next-line no-console -- 测量结果必须出声,这是本票的交付物
    console.log(report('createMessage(生产路径)', collisions, notConsecutive))
    expect(collisions, 'createMessage 并发双插撞号').toBe(0)
    expect(notConsecutive, 'createMessage 并发双插序号不连续').toBe(0)
  }, 300_000)

  it('回归:POST /messages/send 同会话并发双插 ordinal 必不同且连续', async () => {
    let collisions = 0
    let notConsecutive = 0
    for (let r = 0; r < ROUNDS; r++) {
      const conv = await newConversation()
      const [ra, rb] = await Promise.all([
        server!.inject({
          method: 'POST',
          url: '/messages/send',
          payload: { conversationId: conv, content: `send-${r}-a` },
        }),
        server!.inject({
          method: 'POST',
          url: '/messages/send',
          payload: { conversationId: conv, content: `send-${r}-b` },
        }),
      ])
      expect(ra.statusCode).toBe(201)
      expect(rb.statusCode).toBe(201)
      const ords = await ordinalsOf(conv)
      expect(ords).toHaveLength(2)
      if (ords[0] === ords[1]) collisions += 1
      if (ords[0] !== 1 || ords[1] !== 2) notConsecutive += 1
    }
    // eslint-disable-next-line no-console -- 测量结果必须出声,这是本票的交付物
    console.log(report('/messages/send(生产路由)', collisions, notConsecutive))
    expect(collisions, '/messages/send 并发双插撞号').toBe(0)
    expect(notConsecutive, '/messages/send 并发双插序号不连续').toBe(0)
  }, 300_000)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
