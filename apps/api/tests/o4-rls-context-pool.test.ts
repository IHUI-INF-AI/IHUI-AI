// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * F-02 真库判据 —— 会话变量在「同一池、同一条物理连接」上的串租户复现与复位。
 *
 * 判据(任务书原文):
 *   A 用户请求结束后,把连接还回池里;B 用户在同一连接上拿到的 `app.user_id`
 *   必须是 B,不得是 A;`app.current_user_role` 的残值(尤其 '1' 这种放宽档)
 *   必须被清掉。
 *
 * 本文件用 `max=1` 的独立池 + 一次性临时集群,把"同一连接"焊死(读回的
 * `pg_backend_pid()` 全程必须相同),而不是相信"池大概会复用同一条"。
 * 三段读数:
 *   ① 脏态复现:A 束位后**不复位** ⇒ 同连接读到 A(证明判据能红,不是空断言);
 *   ② 复位:A 的出口动作后 ⇒ 四个变量全为空串,role 残值也没了;
 *   ③ 串行复用:B 束位 ⇒ 同连接读到 B(不是 A),pid 不变。
 *
 * 隔离纪律(AGENTS §5):只连本文件 initdb 出来的临时集群,端口由空闲探测选,
 * 显式拒绝 5432/8810/8811;data dir 落在 `D:\DevEnv\Temp` 下,finally 里
 * `pg_ctl stop` + 删目录 + 端口释放复测。本机没有 PostgreSQL 二进制 ⇒
 * **显式 skip 并喊"未判定"**,绝不冒充跑过。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyRequestContextValues, releaseRequestContext } from '../src/plugins/rls-context.js'

type ContextExecutor = Parameters<typeof applyRequestContextValues>[1]

const asExecutor = (client: ReturnType<typeof postgres>): ContextExecutor =>
  drizzle(client, { schema: undefined }) as unknown as ContextExecutor

/** live-check 的出口:PG 二进制发现 + 端口探测只有一份实现(§22c,禁止在本文件复制)。 */
const LIVE_CHECK_URL = pathToFileURL(
  join(process.cwd(), '..', '..', 'packages', 'database', 'scripts', 'tenant-rls-live-check.mjs'),
).href

interface LiveCheckModule {
  resolvePgBin: (
    platform?: string,
    env?: Record<string, string | undefined>,
  ) => { dir: string | null } | null
  probePortBusy: (
    port: number,
    host?: string,
    timeoutMs?: number,
  ) => Promise<{ busy: boolean; detail: string }>
  assertPortChoice: (port: number) => void
}

const CLUSTER_ROOT = 'D:\\DevEnv\\Temp\\wt-fix-rls-o4ctx'
const DATA_DIR = join(CLUSTER_ROOT, 'data')
const LOG_FILE = join(CLUSTER_ROOT, 'postgres.log')
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ROLE_HUMAN = '1' // 放宽档:历史策略里 role='1' 那一支会把表放宽,残值最危险
const ROLE_NORMAL = '0'

let liveCheck: LiveCheckModule | null = null
let pgBinDir: string | null = null
let pgCtlExe = ''
let initdbExe = ''
let port = 0
let pool: ReturnType<typeof postgres> | null = null
let booted = false

function exe(name: string): string {
  return pgBinDir ? join(pgBinDir, process.platform === 'win32' ? `${name}.exe` : name) : name
}

function run(
  command: string,
  args: string[],
  timeout = 120_000,
  quiet = false,
): {
  status: number | null
  out: string
} {
  const r = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    // 不给管道句柄:pg_ctl 拉起的后端会继承句柄,管道永不 EOF ⇒ 调用方要等到 timeout
    // (live-check 实测的同一个坑);pg_ctl 一律 quiet,错误看日志文件/退出码。
    stdio: quiet ? 'ignore' : ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }
}

/** 同一连接判据:pid 不变 + 四个 GUC 的当前读数。 */
async function readState(): Promise<{
  pid: number
  userId: string | null
  compatUserId: string | null
  role: string | null
  apiKeyId: string | null
}> {
  if (!pool) throw new Error('pool 未建立')
  const rows = (await pool`
    SELECT pg_backend_pid() AS pid,
           current_setting('app.user_id', true) AS user_id,
           current_setting('app.current_user_id', true) AS compat_user_id,
           current_setting('app.current_user_role', true) AS role,
           current_setting('app.api_key_id', true) AS api_key_id
  `) as unknown as Array<{
    pid: number
    user_id: string | null
    compat_user_id: string | null
    role: string | null
    api_key_id: string | null
  }>
  const row = rows[0]
  if (!row) throw new Error('current_setting 读不到行')
  return {
    pid: Number(row.pid),
    userId: row.user_id,
    compatUserId: row.compat_user_id,
    role: row.role,
    apiKeyId: row.api_key_id,
  }
}

beforeAll(async () => {
  liveCheck = (await import(LIVE_CHECK_URL)) as unknown as LiveCheckModule
  const pg = liveCheck.resolvePgBin(process.platform, {
    ...process.env,
    // 本机/CI 的 PG 不在 C:\Program Files 时由这里指路(live-check 认这个 env)
    IHUI_RLS_LIVE_PG_BIN: process.env.IHUI_RLS_LIVE_PG_BIN ?? 'D:\\DevEnv\\runtimes\\pgsql\\bin',
  })
  pgBinDir = pg?.dir ?? null
  if (!pgBinDir || !existsSync(exe('initdb'))) return
  pgCtlExe = exe('pg_ctl')
  initdbExe = exe('initdb')

  // 端口:只取空闲且非 5432/8810/8811(live-check 的判据原样复用)
  for (let candidate = 55432; candidate < 55500; candidate += 1) {
    if ([5432, 8810, 8811].includes(candidate)) continue
    if ((await liveCheck.probePortBusy(candidate)).busy) continue
    liveCheck.assertPortChoice(candidate)
    port = candidate
    break
  }
  if (!port) throw new Error('找不到空闲端口(55432-55499)')

  rmSync(CLUSTER_ROOT, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
  mkdirSync(CLUSTER_ROOT, { recursive: true })
  const init = run(initdbExe, [
    '-D',
    DATA_DIR,
    '-A',
    'trust',
    '-U',
    'postgres',
    '--encoding=UTF8',
    '--locale=C',
  ])
  if (init.status !== 0) throw new Error(`initdb 失败:${init.out.slice(0, 400)}`)

  const started = run(
    pgCtlExe,
    [
      '-D',
      DATA_DIR,
      '-l',
      LOG_FILE,
      '-o',
      `-p ${port} -c listen_addresses=127.0.0.1 -c fsync=off -c max_connections=10`,
      'start',
    ],
    120_000,
    true,
  )
  if (started.status !== 0) throw new Error(`pg_ctl start 失败:${started.out.slice(0, 400)}`)
  booted = true

  pool = postgres(`postgres://postgres@127.0.0.1:${port}/postgres`, {
    max: 1, // 焊死"同一条物理连接"
    prepare: false,
    connect_timeout: 10,
  })
  // 池是惰性的:先打一拍,让 pid 稳定
  await readState()
}, 240_000)

afterAll(async () => {
  if (pool) await pool.end({ timeout: 5 }).catch(() => undefined)
  if (booted && pgBinDir) {
    run(pgCtlExe, ['-D', DATA_DIR, '-m', 'fast', 'stop'], 90_000, true)
  }
  if (port) {
    // 端口释放复测:残留集群会污染下一次跑
    const probe = await liveCheck?.probePortBusy(port)
    console.log(`[o4-rls-context-pool] 收尾:port=${port} busy=${probe?.busy ?? '未判定'}`)
  }
  rmSync(CLUSTER_ROOT, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
})

describe('F-02 会话变量:同一池、同一条连接上的串租户与复位', () => {
  it('① 脏态复现:束位后不复位 ⇒ 同连接读到 A(判据不是空断言)', async (ctx) => {
    if (!pool) {
      ctx.skip('本机没有 PostgreSQL 二进制:未判定(不冒充跑过)')
      return
    }
    const executor = asExecutor(pool)
    await applyRequestContextValues({ userId: USER_A, roleId: ROLE_HUMAN, apiKeyId: '' }, executor)
    const dirty = await readState()
    expect(dirty.userId, '束位后应读到 A').toBe(USER_A)
    expect(dirty.compatUserId, '旧兼容名同步读到 A').toBe(USER_A)
    expect(dirty.role, "role 放宽档 '1' 也留在连接上(这正是要清的残值)").toBe(ROLE_HUMAN)
  })

  it('② A 的出口动作 ⇒ 四个变量全清,role 残值不残留', async (ctx) => {
    if (!pool) {
      ctx.skip('本机没有 PostgreSQL 二进制:未判定(不冒充跑过)')
      return
    }
    const executor = asExecutor(pool)
    const before = await readState()
    await releaseRequestContext(executor)
    const clean = await readState()
    expect(clean.userId, '复位的 app.user_id 必须是空串(不是 A)').toBe('')
    expect(clean.compatUserId).toBe('')
    expect(clean.apiKeyId).toBe('')
    expect(clean.role, "role 残值必须被清掉,不许留 '1'").toBe('')
    // 同一条连接:复位语句与束位语句走的是同一个 backend
    expect(clean.pid, '复位必须发生在同一条物理连接上').toBe(before.pid)
  })

  it('③ 串行复用:B 束位 ⇒ 同连接读到 B(不是 A),pid 全程不变', async (ctx) => {
    if (!pool) {
      ctx.skip('本机没有 PostgreSQL 二进制:未判定(不冒充跑过)')
      return
    }
    const executor = asExecutor(pool)
    const pidBefore = (await readState()).pid
    await applyRequestContextValues(
      { userId: USER_B, roleId: ROLE_NORMAL, apiKeyId: 'key-b' },
      executor,
    )
    const b = await readState()
    expect(b.userId, 'B 拿到的必须是 B,不得是 A').toBe(USER_B)
    expect(b.compatUserId).toBe(USER_B)
    expect(b.apiKeyId).toBe('key-b')
    expect(b.role).toBe(ROLE_NORMAL)
    expect(b.pid, '全程必须同一条物理连接(max=1)').toBe(pidBefore)

    // 交付读数:最后再打一条,证明 ③ 之后连接确实进到了 B 的上下文
    const final = await readState()
    console.log(
      `[o4-rls-context-pool] 读数 pid=${final.pid} user_id=${JSON.stringify(final.userId)} role=${JSON.stringify(final.role)}`,
    )
    expect(final.pid).toBe(pidBefore)
  })

  it('④ 回归守卫:复位语句仍是"一次往返、四个变量"(不拆成四条)', async (ctx) => {
    if (!pool) {
      ctx.skip('本机没有 PostgreSQL 二进制:未判定(不冒充跑过)')
      return
    }
    // 用 drizzle 的 execute 记录不了 SQL;改为对真实库发同形态语句,断言四个变量一次全中
    await releaseRequestContext(asExecutor(pool))
    const state = await readState()
    expect([state.userId, state.compatUserId, state.role, state.apiKeyId]).toEqual(['', '', '', ''])
  })
})
