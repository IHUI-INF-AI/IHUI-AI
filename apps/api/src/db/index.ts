// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
// O13(2026-09-21):受控出口可以有**自己的一条连接**了 —— schema 与 Database 类型
// 继续复用 @ihui/database,不在这里另起一套。
import {
  createReadWriteDb,
  schema,
  wrapClientWithLogger,
  type Database,
  type SqlLoggerFn,
} from '@ihui/database'
import type { FastifyInstance } from 'fastify'
import { config } from '../config/index.js'
import { sqlEventBus } from './sql-event-bus.js'
// O4 数据作用域闸:受控出口 dbScoped()/dbReadScoped() + 只读超级用户探针
import {
  configureDataScopeGuard,
  createScopedDb,
  createSuperuserProbe,
} from '../utils/scoped-guard.js'
// P1 修复:集成 pool-leak-detector,跟踪 postgres.js 连接池中 active/idle 连接,
// 让 db-keepalive.ts 的 scanLeaks 能检测到长时间未归还的连接泄漏。
// 此前 pool-leak-detector.ts 完整实现但从未被任何模块调用 checkout/trackConnection,
// 导致泄漏扫描器无数据可扫。这里通过周期性采样 pool 内部状态,把 active 连接注册为
// "已借出",idle 连接标记为 "已归还",从而让泄漏检测真正生效。
import {
  poolLeakDetector,
  trackConnection,
  untrackConnection,
} from '../utils/pool-leak-detector.js'

// 使用读写分离工厂创建主库(写)与读副本(读)
// 无 DATABASE_READ_REPLICA_URL 时,dbReader 自动回退到主库
// logger 回调把每次 SQL 查询事件发布到 sqlEventBus,
// slow-sql-killer 与 n1-detector 订阅消费(自动注入 ALS 中的 requestId)
// O13 补齐①(2026-09-21):这个回调提取为共享 sqlLogger —— 主池与受控出口独立池
// (DATABASE_APP_URL)走**同一条**观测口径,事件形状不变,不发明新事件名。
const sqlLogger: SqlLoggerFn = (event) => {
  sqlEventBus.emit({
    query: event.query,
    params: event.params,
    durationMs: event.durationMs,
    timestamp: event.timestamp,
  })
}

const { dbWriter, writerClient, getReader, reportReplicaHealth, replicaClients } =
  createReadWriteDb({
    url: config.DATABASE_URL,
    readReplicaUrl: config.DATABASE_READ_REPLICA_URL,
    logger: sqlLogger,
  })

// 主库(写) — insert/update/delete 必须使用此客户端
export const db: Database = dbWriter
// P1-3 修复(2026-08-06):dbRead 原为固定绑第一个副本(dbReader),副本故障不自动回退。
// 改为动态代理 —— 每次属性访问都从 getReader() 取当前优先级最高且健康的副本,
// 全部不健康时 getReader() 自动回退主库,实现读路径故障转移。
// 健康状态由下方探测循环通过 reportReplicaHealth 驱动。
export const dbRead: Database = new Proxy(dbWriter, {
  get(target, prop, receiver) {
    const reader = getReader()
    if (reader === target) return Reflect.get(target, prop, receiver)
    const value = Reflect.get(reader, prop)
    return typeof value === 'function' ? value.bind(reader) : value
  },
})
// 原始 postgres.js 客户端，用于连接池指标采样
export const dbClient = writerClient

// ============================================================================
// O4 数据作用域闸(2026-09-25 立)—— 受控客户端出口
//
// 判定层不变:每条经 dbScoped()/dbReadScoped() 发出的语句先过 utils/scoped-guard.ts
// 的判据 —— 机器凭据 + 已登记能力(capability)时,compute 只能碰自有运行记录白名单表,
// scoped-* 必须带 owner 谓词,否则:
//   403 DATA_ACCESS_DENIED(模式不允许触达该表)/ 403 DATA_SCOPE_DENIED(越过归属边界)/
//   503 DATA_ISOLATION_UNAVAILABLE(隔离前提不成立,见 assertNonSuperuserForScopedMode)。
// 未挂 capability 的调用链(存量 /api/* 全部路由)行为逐字节不变。
//
// ----------------------------------------------------------------------------
// O13(2026-09-21)补的是**连接层**,不是再多加一层判据:
// 上面那个 503 一直打在生产,原因很朴素 —— 受控出口和 db 同池,而那条池子是超级用户,
// 超级用户绕过一切 RLS,"声明了行级隔离却给不出隔离"于是被 fail-closed 断言挡死。
// 现在配了 DATABASE_APP_URL 就让**受控出口单独挂到应用角色池**(角色 + 逐表 GRANT
// 见 packages/database/drizzle/20260921160000_scoped_app_role_owner_rls.sql):
//  · 探针跟着换目标 —— 探针必须测**真正服务 scoped 查询的那条连接**,测主池等于
//    测了一条不相干的超级用户连接,结论再准也与被保护的语句无关;
//  · db / dbRead **一律不动**(仍主池 + 读副本故障转移),所以第一方链路零回归;
//  · 代价说清楚:dbReadScoped 走应用池即**不再走读副本**(应用角色只连主库),
//    这条面只有 4 张表,换"归属边界落在同一个角色上"是值得的;真要横向扩,
//    给应用角色单独配副本连接串(尚未提供,别拿 DATABASE_READ_REPLICA_URL 凑 ——
//    那条串的角色若与主库不同,scoped 读会在 DB 层 permission denied)。
// 未配置该 env 时**维持原状**并显式告警:此时 scoped-* 在生产仍然恒 503,
// 这是有意的 fail-closed,不是回退到"假装隔离"。
//
// 探针必须走原始 postgres 客户端(而非任何 drizzle 出口),否则会与被包装的
// prepareQuery 互相递归;探测结果进程内缓存 10 分钟,不给请求增加往返。
// ============================================================================

/** 受控出口专用池上限:开放面只有 4 张表的读写,不该跟主池(40)抢连接。 */
const SCOPED_POOL_MAX = 8

/** 配了 DATABASE_APP_URL 才建独立池;两条都 null = 受控出口继续与 db 同池。 */
// O13 补齐①(2026-09-21):scoped 池此前直接拿裸 postgres() 建,绕过了仓库既有的
// wrapClientWithLogger —— 经 dbScoped()/dbReadScoped() 发出的 SQL 不进 sqlEventBus,
// slow-sql / n+1 检测对开放面完全失明。现在与主池同口径包装(同一 sqlLogger)。
const scopedClient: typeof writerClient | null = config.DATABASE_APP_URL
  ? wrapClientWithLogger(
      postgres(config.DATABASE_APP_URL, {
        max: SCOPED_POOL_MAX,
        idle_timeout: 30_000,
        prepare: false,
      }),
      sqlLogger,
    )
  : null
const scopedDrizzle: Database | null = scopedClient ? drizzle(scopedClient, { schema }) : null

if (scopedDrizzle) {
  console.info(
    '[db] 受控出口(dbScoped/dbReadScoped)已切到 DATABASE_APP_URL 的应用角色连接;' +
      '超级用户探针同样改测这条连接;db/dbRead 仍走主池,第一方链路不受影响',
  )
} else {
  console.warn(
    '[db] 未配置 DATABASE_APP_URL:受控出口仍与 db 同池。若这条连接是超级用户,' +
      'scoped-* 能力会在生产恒 503 DATA_ISOLATION_UNAVAILABLE(这是 fail-closed 的正确行为)。' +
      '要放行:跑迁移建 ihui_app(非超级用户)并配 DATABASE_APP_URL,详见 ' +
      'docs/developer/data-classes.md §3.1',
  )
}

configureDataScopeGuard({
  // 常量只读 SELECT(无参数、无写、无 SET);形态异常抛错 → 归类为"探测不可用"而非"非超级用户"
  probeSuperuser: createSuperuserProbe((probeSql) =>
    (scopedClient ?? writerClient).unsafe(probeSql),
  ),
})

// O13 补齐②(2026-09-21):postgres() 是惰性连接 —— DATABASE_APP_URL 把角色/库/密码
// 写错时启动零信号,要等第一个 scoped 请求才暴露成 503。启动期做一次**有界超时**的
// SELECT 1 探测把信号前移;失败/超时只 warn,**不 crash 进程** —— 开放面配置错
// 不许把第一方链路(db/dbRead,主池)一起拖起不来。
if (scopedClient) {
  const SCOPED_BOOT_PROBE_TIMEOUT_MS = 2_000
  void (async (): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        // 与下方 replica 探测循环同款口径:tagged template 直连,不经任何 drizzle 出口
        scopedClient`SELECT 1`,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`连接探测超时(>${SCOPED_BOOT_PROBE_TIMEOUT_MS}ms)`)),
            SCOPED_BOOT_PROBE_TIMEOUT_MS,
          )
          timer.unref()
        }),
      ])
      console.info('[db] DATABASE_APP_URL 启动探测成功(SELECT 1),scoped-* 受控出口连接可用')
    } catch (e) {
      console.warn(
        '[db] DATABASE_APP_URL 启动探测失败:' +
          ((e as Error)?.message ?? e) +
          ' —— scoped-* 能力将恒 503 DATA_ISOLATION_UNAVAILABLE(有意的 fail-closed);' +
          'db/dbRead 第一方链路不受影响。请核对该 DSN 的角色/库/密码与网络连通性',
      )
    } finally {
      if (timer) clearTimeout(timer)
    }
  })()
}

/** 受控写出口:机器凭据可达的写路径必须用它(而非 db)。 */
export const dbScoped: Database = createScopedDb<Database>(() => scopedDrizzle ?? db)
/**
 * 受控读出口:配了应用连接串就是应用角色池(归属边界与写路径同一个角色);
 * 否则维持"每次解析跟随当前健康读副本"的旧语义(与 dbRead 同一故障转移)。
 */
export const dbReadScoped: Database = createScopedDb<Database>(() => scopedDrizzle ?? dbRead)

// P1 修复:导出 poolLeakDetector 单例,供 admin 路由 / db-keepalive 等模块统一访问
export { poolLeakDetector }

// P1 修复:周期性采样 postgres.js 连接池状态,把 active 连接注册到 leak detector。
// Drizzle ORM 内部自动管理连接(不暴露 acquire/release 钩子),无法在查询前后手动
// trackConnection;改为周期性读取 postgres.js 内部 pool 状态,active 连接 → track,
// idle 连接 → untrack。这样若某连接长期停留在 active 状态(疑似泄漏),scanLeaks
// 会在超时阈值(默认 5 分钟)后告警。
const POOL_TRACK_INTERVAL_MS = 30_000
const trackedConns = new WeakSet<object>()
// O13 补齐①(2026-09-21):受控出口应用角色池一并采样(pool 标签 'app-scoped')。
// 此前只采 writerClient,scoped 池的连接泄漏永远进不了 scanLeaks 视野。
const poolClientsToSample: ReadonlyArray<readonly [typeof writerClient, string]> = scopedClient
  ? [
      [writerClient, 'writer'],
      [scopedClient, 'app-scoped'],
    ]
  : [[writerClient, 'writer']]
const poolTracker = setInterval(() => {
  try {
    for (const [client, poolLabel] of poolClientsToSample) {
      // postgres.js 不公开 pool 内部状态,尝试读取内部属性(与 db-keepalive.ts 同模式)
      const internal = client as unknown as {
        state?: { idle?: object[]; active?: object[] }
      }
      if (!internal.state) continue
      const activeConns = internal.state.active ?? []
      const idleConns = internal.state.idle ?? []
      // 新增 active 连接 → track(记录借出 + 调用栈)
      for (const conn of activeConns) {
        if (!trackedConns.has(conn)) {
          trackedConns.add(conn)
          trackConnection(conn, poolLabel, 'postgres-pool-active')
        }
      }
      // 转为 idle 的连接 → untrack(记录归还)
      for (const conn of idleConns) {
        if (trackedConns.has(conn)) {
          trackedConns.delete(conn)
          untrackConnection(conn)
        }
      }
    }
  } catch (e) {
    // 2026-08-02 修复:不再静默吞错,记录 warn 日志(便于排查 pool 状态采样失败)
    console.warn('[pool-tracker] sampling failed:', e)
  }
}, POOL_TRACK_INTERVAL_MS)
// unref:不阻止进程退出,进程结束时 timer 自动清理
// P2 修复(2026-07-31):导出 stopPoolTracker 供 index.ts shutdown 显式清理
poolTracker.unref()

/** 显式停止 poolTracker,避免 vitest/HMR 场景下累积。 */
export function stopPoolTracker(): void {
  clearInterval(poolTracker)
}

// =============================================================================
// P1-3 修复(2026-08-06):读副本健康探测循环。
// 原 reportReplicaHealth/getReader 为死代码(从未被调用),dbRead 固定绑第一个副本,
// 副本宕机/延迟超阈值不自动回退主库 → 700+ 处 dbRead 读路径雪崩。
// 现在:每 15s 对每个副本执行 SELECT 1,成功 → reportReplicaHealth(id, true),
// 失败 → reportReplicaHealth(id, false);连续失败 ≥3 次(或延迟 >10s)标记不健康,
// getReader() 自动跳过并回退主库,故障恢复后探测成功自动恢复。
// =============================================================================
const REPLICA_PROBE_INTERVAL_MS = 15_000

const replicaProbeTimer = (() => {
  if (replicaClients.size === 0) return null
  const probe = async (): Promise<void> => {
    for (const [id, client] of replicaClients) {
      try {
        const start = Date.now()
        await client`SELECT 1`
        const lagSec = (Date.now() - start) / 1000
        reportReplicaHealth(id, true, lagSec)
      } catch (e) {
        // 连接失败 → 上报不健康(连续失败达阈值后 getReader 跳过该副本)
        console.warn(`[replica-probe] 副本 ${id} 探测失败:`, (e as Error).message)
        reportReplicaHealth(id, false)
      }
    }
  }
  void probe()
  const timer = setInterval(() => void probe(), REPLICA_PROBE_INTERVAL_MS)
  timer.unref()
  return timer
})()

/**
 * 2026-08-02 修复:注册 onClose 钩子清理 poolTracker,防进程不退出。
 * 在 Fastify 启动后调用:registerPoolTrackerCleanup(server)
 * P1-3:同时清理 replicaProbeTimer。
 * O13:另需关掉受控出口自己的应用角色池(有配 DATABASE_APP_URL 时才存在)。
 */
export function registerPoolTrackerCleanup(server: FastifyInstance): void {
  server.addHook('onClose', () => {
    clearInterval(poolTracker)
    if (replicaProbeTimer) clearInterval(replicaProbeTimer)
    if (scopedClient) void scopedClient.end()
  })
}

export type { Database }

/**
 * 安全获取 `.returning()` 的单条结果。
 * 若无结果抛出 Error(由调用方 catch 返回 500 + message,与现有 catch 模式一致)。
 * 用途:消除 `const [x] = ...returning(); if (!x) return reply.status(500).send(...)` 重复守卫。
 *
 * @example
 * // 替换前:
 * const [created] = await db.insert(t).values(v).returning()
 * if (!created) return reply.status(500).send(error(500, '创建失败'))
 * // 替换后:
 * const created = await returningOne(db.insert(t).values(v).returning(), '创建失败')
 */
export async function returningOne<T>(
  promise: Promise<T[]>,
  errorMessage = '数据库操作未返回记录',
): Promise<T> {
  const rows = await promise
  const row = rows[0]
  if (!row) throw new Error(errorMessage)
  return row
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
