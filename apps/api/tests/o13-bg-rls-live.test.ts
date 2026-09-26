// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13 第三格前置 —— **真库**判据:`background-context` 的旁路 GUC 在
 * 「非超级用户 ∧ NOBYPASSRLS ∧ 表属主 ∧ FORCE」的生产复刻形态下,
 *  ① 无上下文基线读 0 行(fail-closed ⇒ 环境真的复刻住了第三格形态);
 *  ② 作用域内全量可见(withBypassRls 的 OR 分支经**我们的出口代码**生效);
 *  ③ 作用域结束后**同一池、同一条物理连接**(max=1)再读回到 0 行,
 *     `current_setting('app.bypass_rls', true)` 回到 NULL —— 即"结束必须复位"
 *     不是靠某个我们并不存在的 release 钩子,而是事务边界(SET LOCAL)的结构保证。
 * 没有 ②/③,第三格的 `ALTER ROLE ihui NOBYPASSRLS` 就建立在"我相信它会复位"上。
 * ④ 请求上下文(runWithRequestScope)里调 runner 必须被守卫拒发,且拒发不留半开事务。
 *
 * 判据表选 `user_memories`(2 行,纯归属谓词):`notes` 刻意带"公开笔记无主体可读"
 * 分支(迁移头注 + live-check 的 S5/S6),它**不是**"无上下文 0 行"的合格探针 ——
 * 第一轮就栽在这里(基线读到 1 = 那条公开行,而不是 FORCE 失效)。
 *
 * 隔离纪律(AGENTS §5 测试隔离铁律;机制照抄 packages/database/scripts/tenant-rls-live-check.mjs):
 *  - 集群生命周期**整体复用**该脚本(`--keep` 模式),判据只有一份实现(§22c);
 *    它自己把 8810/8811/5432 判死,psql 连接只经它的 psqlArgs 出口。
 *  - data dir 落在其允许的两个落点之一:`.ihui-agent/tmp/o13-bg/**`(本票指定目录);
 *  - 收尾在本用例的 finally:`pg_ctl stop` + 删目录 + TCP 复测端口释放,实测行必须打印;
 *  - retries 必须为 0:失败重试会在**旧集群未停**时重跑(EPERM + 双集群),
 *    第一轮日志里 [3/4][4/4] 那两条 EPERM 就是重试踩出来的,不是判据本身的错;
 *  - 本机没有 PostgreSQL 二进制 ⇒ 本文件**显式 skip 并喊"未判定"**,绝不冒充跑过。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import type { Database } from '@ihui/database'
import type { FastifyRequest } from 'fastify'
import { createOpsBypassRunner } from '../src/db/background-context.js'
import { runWithRequestScope } from '../src/plugins/principal.js'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, '..', '..', '..')
const LIVE_CHECK_PATH = join(
  REPO_ROOT,
  'packages',
  'database',
  'scripts',
  'tenant-rls-live-check.mjs',
)
/** 本票专属集群根(任务书指定落点);data dir 是其一级子目录,落点在 live-check 的白名单内。 */
const CLUSTER_ROOT = join(REPO_ROOT, '.ihui-agent', 'tmp', 'o13-bg', 'cluster')
const DATA_DIR = join(CLUSTER_ROOT, 'data')
/** RLS 批 1 迁移的 journal idx(2026-09-27 现读 `_journal.json`;重放到这里 = 8 表 ENABLE+FORCE 成对就位)。 */
const RLS_TARGET_IDX = 293
/** 判据表与夹具行数(与 tenant-rls-live-fixture 的 seed 一致;下方 SQL 用同名**字面量**,改表必须两处同改)。 */
const PROBE_TABLE = 'user_memories'
const PROBE_SEED_ROWS = 2

/** live-check 的出口(判据只有一份实现,禁止在本文件复制 resolvePgBin/probe 逻辑)。 */
interface LiveCheckModule {
  resolvePgBin: (platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv) => { dir: string; version: string | null } | null
  probePortBusy: (port: number, host?: string, timeoutMs?: number) => Promise<{ busy: boolean; detail: string }>
}

interface LiveCheckReport {
  meta: { port: number | null; dataDir: string | null; roles: Record<string, string> }
  replay: { targetIdx: number; applied: number; total: number; failureCount: number } | null
  seed: { ok: boolean; fact: string | null; error: string | null } | null
  summary: { pass: number; fail: number; p0: number; skip: number; info: number }
  environment: Record<string, unknown>
}

function exeName(exe: string): string {
  return process.platform === 'win32' ? `${exe}.exe` : exe
}

function runPgCtl(pgBinDir: string, args: string[], timeoutMs: number): string {
  const r = spawnSync(join(pgBinDir, exeName('pg_ctl')), args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
  })
  const first = (s: unknown): string => String(s ?? '').split(/\r?\n/)[0] ?? ''
  return `${r.status} ${first(r.stdout) || first(r.stderr) || first(r.error?.message)}`.trim()
}

// 环境探针放在 describe 之前:没有 PG 二进制 ⇒ 整个文件 skip,并把"未判定"喊出来。
const liveCheck: LiveCheckModule = await (
  import(/* @vite-ignore */ pathToFileURL(LIVE_CHECK_PATH).href) as Promise<LiveCheckModule>
)
const pgBin = liveCheck.resolvePgBin()
const suite = pgBin ? describe : describe.skip
if (!pgBin) {
  console.warn(
    '[o13-bg-rls-live] 未判定:本机找不到 PostgreSQL 二进制(IHUI_RLS_LIVE_PG_BIN 与 C:\\Program Files\\PostgreSQL 都没探到)。' +
      '真库复位判据**没有跑**,不得把本文件的 skip 读成"第三格前置已验证"。',
  )
}

suite('o13 真库:旁路 GUC 生效与复位(临时集群,复刻 NOBYPASSRLS 属主形态)', () => {
  it(
    'live-check(--keep)重放到 idx=293 后:①基线 0 行;②runner 内全量可见;③结束后同池 0 行且 current_setting=NULL;④请求上下文拒发;finally 收尾实测',
    { timeout: 1_700_000, retry: 0 },
    async () => {
      if (!pgBin) throw new Error('探针漂移:suite 在非 skip 分支下 pgBin 不应为 null')
      const binDir = pgBin.dir
      const notes: string[] = []
      let port = 0
      let client: ReturnType<typeof postgres> | null = null
      try {
        // 上一轮若有活集群占着目录:先 stop 再删(Windows 句柄延迟的正当出路);删不干净就拒绝起跑
        if (existsSync(DATA_DIR)) {
          notes.push(`预清理 pg_ctl stop ⇒ ${runPgCtl(binDir, ['-D', DATA_DIR, '-m', 'fast', 'stop'], 90_000)}`)
        }
        rmSync(CLUSTER_ROOT, { recursive: true, force: true, maxRetries: 15, retryDelay: 800 })
        expect(existsSync(CLUSTER_ROOT), '陈旧集群目录删不掉,拒绝在脏环境上跑判据').toBe(false)

        const boot = spawnSync(
          process.execPath,
          [LIVE_CHECK_PATH, '--keep', '--json', '--target-idx', String(RLS_TARGET_IDX), '--data-dir', DATA_DIR],
          { encoding: 'utf8', windowsHide: true, timeout: 1_500_000, maxBuffer: 64 * 1024 * 1024 },
        )
        expect(boot.error ?? null, `live-check 派生失败:${boot.error?.message ?? ''}`).toBeNull()
        let report: LiveCheckReport | null = null
        try {
          const text = String(boot.stdout || '')
          report = JSON.parse(text.slice(text.indexOf('{'))) as LiveCheckReport
        } catch {
          throw new Error(`live-check --json 输出不可解析(rc=${boot.status}),stderr 首行:${String(boot.stderr).split(/\r?\n/)[0] ?? ''}`)
        }
        const rep = report
        expect(rep, 'live-check 没给出报告').not.toBeNull()
        if (!rep) throw new Error('unreachable:rep 判空已在上一行')
        expect(rep.replay?.failureCount ?? -1, `迁移重放有失败:${JSON.stringify(rep.replay)}`).toBe(0)
        expect(rep.seed?.ok, `夹具播种失败:${rep.seed?.error ?? ''}`).toBe(true)
        // 复刻形态的自证:owner 角色必须实测为 非超级用户 ∧ 无 BYPASSRLS(不是"应该是")
        expect(rep.meta.roles.ihui_rls_owner ?? '', 'owner 角色属性回读缺 rolbypassrls=false').toContain('rolbypassrls=false')
        expect(rep.meta.roles.ihui_rls_owner ?? '', 'owner 角色属性回读缺 rolsuper=false').toContain('rolsuper=false')
        expect(typeof rep.meta.port).toBe('number')
        port = rep.meta.port as number
        expect(port).toBeGreaterThan(1024)
        expect([8810, 8811, 5432], '绝不允许连生产/既有实例端口').not.toContain(port)

        client = postgres(`postgres://ihui_rls_owner@127.0.0.1:${port}/ihui_rls_live`, {
          max: 1, // 同池必同连接 ⇒ "作用域后同池读不到 GUC"才是对**那条连接**的判据
          prepare: false,
          connect_timeout: 10,
        })
        const pool = client
        // drizzle 出口只喂给 runner(它要 Database 的 transaction 形态);裸读一律走 pool
        const dbLike = drizzle(pool, { schema: undefined }) as unknown as Database
        const runner = createOpsBypassRunner(dbLike)

        const readProbe = async (): Promise<{ visible: number; bypass: string | null }> => {
          // 表名走 SQL 字面量(表名不是值,参数化不了);与 PROBE_TABLE 的一致性由下面那行 expect 锁
          const rows = (await pool`SELECT (SELECT count(*)::int FROM public.user_memories) AS visible, current_setting('app.bypass_rls', true) AS bypass`) as unknown as Array<{ visible: number; bypass: string | null }>
          return { visible: Number(rows[0]?.visible ?? -1), bypass: (rows[0]?.bypass ?? null) as string | null }
        }
        expect(PROBE_TABLE, 'SQL 字面量与本常量必须同表').toBe('user_memories')

        // ① 基线(fail-closed 阳性对照):属主 + FORCE + 无 GUC ⇒ 纯归属表全不可见
        const baseline = await readProbe()
        expect(baseline.visible, '基线:无 GUC 竟看得见行 ⇒ 集群形态没复刻住(NO FORCE?)').toBe(0)
        expect(baseline.bypass).toBeNull()

        // ② 作用域内:运维通道放行全量可见(与 live-check 的 P 判据同源,但这次经**我们的出口代码**)
        const inside = await runner('background', async (tx) => {
          const rows = (await tx.execute(
            sql`SELECT count(*)::int AS c, current_setting('app.bypass_rls', true) AS g FROM public.user_memories`,
          )) as unknown as Array<{ c: number; g: string | null }>
          return { c: Number(rows[0]?.c ?? -1), g: (rows[0]?.g ?? null) as string | null }
        })
        expect(inside.c, 'runner 作用域内没读到全量行 ⇒ 旁路 OR 分支没生效').toBe(PROBE_SEED_ROWS)
        expect(inside.g).toBe('true')

        // ③ 复位判据(结构性做不到就该在这里红):同一池、同一条连接,作用域外回到 0 行。
        //    GUC 读数的实测形态(第三轮才量清):自定义占位 GUC **从未设过**时
        //    `current_setting(name, true)` 返回 NULL;被 SET LOCAL 过一次后,事务结束返回
        //    **空串**(占位定义留在会话里,值回落到占位默认)。判据按"不再是 'true'"取,
        //    两种"未生效"形态都算复位;行集 2→0 才是行为侧的硬证据。
        const after = await readProbe()
        expect(after.visible, '作用域结束后 GUC 串到了下一次使用 —— 复位不成立,第三格必须换方案').toBe(0)
        expect(after.bypass === null || after.bypass === '', `复位后 bypass GUC 应消失(NULL 或 ''),实测=${JSON.stringify(after.bypass)}`).toBe(true)

        // ④ 守卫在真链路上同样拒发:请求上下文内不得拿到旁路(失败方向=少放行)
        await runWithRequestScope({ url: '/api/whatever' } as unknown as FastifyRequest, async () => {
          await expect(runner('background', async () => 'x')).rejects.toThrow(/拒绝发放 RLS 旁路/)
        })
        // 拒发之后连接仍健康且无残留 GUC(守卫没有半开事务)
        const afterGuard = await readProbe()
        expect(afterGuard.visible).toBe(0)
        expect(afterGuard.bypass === null || afterGuard.bypass === '').toBe(true)
      } finally {
        if (client) await client.end({ timeout: 5 })
        if (port > 0 && existsSync(DATA_DIR)) {
          notes.push(`pg_ctl stop ⇒ ${runPgCtl(binDir, ['-D', DATA_DIR, '-m', 'fast', 'stop'], 90_000)}`)
          if (existsSync(DATA_DIR)) {
            notes.push(`回退 -m immediate ⇒ ${runPgCtl(binDir, ['-D', DATA_DIR, '-m', 'immediate', 'stop'], 90_000)}`)
          }
        }
        if (existsSync(CLUSTER_ROOT)) {
          try {
            rmSync(CLUSTER_ROOT, { recursive: true, force: true, maxRetries: 15, retryDelay: 800 })
            notes.push(`删除 ${CLUSTER_ROOT} ⇒ existsSync=${existsSync(CLUSTER_ROOT)}`)
          } catch (error) {
            notes.push(`删除 ${CLUSTER_ROOT} ⇒ 抛错:${String((error as Error)?.message ?? error).slice(0, 160)}`)
          }
        }
        if (port > 0) {
          const busy = await liveCheck.probePortBusy(port, '127.0.0.1', 800)
          notes.push(`端口 ${port} 收尾实测 ⇒ ${busy.busy ? `仍在监听(${busy.detail})= 没收干净` : `已释放(${busy.detail})`}`)
        }
        for (const line of notes) console.info(`[o13-bg-rls-live] 收尾: ${line}`)
        // 集群起过 ⇒ "端口已释放 + 目录已删净"两行实测必须在案;没收干净就是红灯,不留静默
        if (port > 0) {
          expect(notes.some((l) => l.includes('已释放')), '端口收尾未释放(见上面实测行)').toBe(true)
          expect(notes.some((l) => l.includes('existsSync=false')), '临时目录未删净(见上面实测行)').toBe(true)
        }
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
