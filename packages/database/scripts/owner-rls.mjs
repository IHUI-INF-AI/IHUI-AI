#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 运维脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * O13 受控出口的应用角色 / owner RLS 策略 —— 巡检、激活、回滚。
 *
 * 与迁移的分工(不要混):
 *  - `packages/database/drizzle/20260921160000_scoped_app_role_owner_rls.sql`
 *    是**唯一**建角色 / GRANT / CREATE POLICY 的地方(部署时自动跑,幂等)。
 *  - 本脚本**不建策略**,只做三件迁移做不了的事:
 *      status   读 catalog 报现状(角色属性 / 策略齐不齐 / RLS 开没开 / 角色是不是表 owner)
 *      enable   跑完前置断言后 `ENABLE ROW LEVEL SECURITY`(默认 dry-run,`--apply` 才写)
 *      disable  回滚:先 `DISABLE ROW LEVEL SECURITY`,再 `DROP POLICY`(= 迁移策略部分的逆操作)
 *
 * 为什么 enable 要"断言 + --apply"两段式:策略写了不等于策略生效。超级用户连接下
 * RLS 一律不生效,`FORCE` 又会把表属主一起套进去 —— 这两种情况都"看起来开了",
 * 实际要么全放行、要么把运维自己锁死。所以开之前先把这几件事**查清楚**,开完再拿
 * 一条真实的负向断言(陌生主体 → 必须 0 行)证明策略不是恒真;断言不过当场自动 DISABLE 回退。
 *
 * 用法:
 *   node packages/database/scripts/owner-rls.mjs                       # = status
 *   node packages/database/scripts/owner-rls.mjs status
 *   node packages/database/scripts/owner-rls.mjs enable [--apply]
 *   node packages/database/scripts/owner-rls.mjs disable [--apply]
 *
 * DSN:管理连接(要能 ALTER TABLE ⇒ 表属主/超级用户)取 $DATABASE_URL,
 *     否则读 apps/api/.env 的 DATABASE_URL;
 *     应用连接(被验证的那条)取 $DATABASE_APP_URL,否则读 apps/api/.env。
 *     缺应用连接时 enable **拒绝开启** —— 那时没有任何一条真实查询经过非超级用户连接,
 *     "开了 RLS"只会是个没法证明的宣称。
 * 全程只读:status 不写;enable/disable 不加 --apply 不写;负向断言在事务里跑完必 ROLLBACK。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import postgres from 'postgres'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PKG_DIR, '..', '..')

/** 与迁移 specs 一一对应。漂移由 tests/app-role-privileges.test.ts 机械挡住(§22c 思路)。 */
export const APP_ROLE = 'ihui_app'
export const MIGRATION_TAG = '20260921160000_scoped_app_role_owner_rls'

/**
 * 开放面 dbScoped()/dbReadScoped() 实际触达的表 —— 归属谓词与迁移里那份**必须逐字一致**。
 * 只列有真实归属列的表;无 owner 列的全站共享表(content_generation_templates / zhs_faq)
 * 与尚未接到受控出口的 compute 白名单表,为什么不在这里,见迁移头注释。
 * @type {ReadonlyArray<{ table: string, privs: readonly string[], ownerPredicate: string }>}
 */
export const OWNER_TABLES = Object.freeze([
  {
    table: 'content_generation_tasks',
    privs: Object.freeze(['select', 'insert']),
    ownerPredicate: `user_id::text = current_setting('app.user_id', true)`,
  },
  {
    table: 'webhook_subscriptions',
    privs: Object.freeze(['select', 'insert', 'update', 'delete']),
    ownerPredicate: `user_id::text = current_setting('app.user_id', true)`,
  },
  {
    table: 'zhs_ai_user_model_chat_config',
    privs: Object.freeze(['select', 'insert', 'update', 'delete']),
    ownerPredicate: `user_id::text = current_setting('app.user_id', true)`,
  },
  {
    // 站内信没有 user_id 列:归属由会话双方表达 —— 任一方向是自己即可见
    table: 'messages',
    privs: Object.freeze(['select']),
    ownerPredicate: `sender_id::text = current_setting('app.user_id', true) OR receiver_id::text = current_setting('app.user_id', true)`,
  },
])

/** 策略命名与迁移保持一致:<表>_owner_<dml>。 */
export function policyNameOf(table, kind) {
  return `${table}_owner_${kind}`
}

/** 生成的 SQL 一律先打印再执行;每条自带 IF EXISTS,重复执行等价(幂等)。 */
export function enableSqlOf(table) {
  return `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`
}
export function disableSqlOf(table) {
  return `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`
}
export function dropPolicySqlOf(table, kind) {
  return `DROP POLICY IF EXISTS "${policyNameOf(table, kind)}" ON "${table}"`
}
export function dropPoliciesOf(table, privs) {
  return privs.map((kind) => dropPolicySqlOf(table, kind))
}

/** catalog 侧断言用的常量 SQL(表名/角色名一律走参数,不拼进语句文本)。 */
export const CATALOG_SQL = Object.freeze({
  /** 角色属性:超级用户 / BYPASSRLS / 可登录 / 继承 —— 这四条决定 RLS 到底作不作数 */
  role: `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
           FROM pg_roles WHERE rolname = $1`,
  /** 已存在的 owner 策略名 */
  policies: `SELECT tablename, policyname FROM pg_policies
              WHERE schemaname = 'public' AND policyname = ANY($1)`,
  /** relrowsecurity / relforcerowsecurity 才是 RLS 开关的真实列名;owner 一并取回 */
  rls: `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
               pg_get_userbyid(c.relowner) AS owner
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = ANY($1)`,
  /** 角色实际拿到的表级权限(用来比对"清单里该有的"与"库里真有的") */
  grants: `SELECT table_name, privilege_type
             FROM information_schema.role_table_grants
            WHERE grantee = $1 AND table_schema = 'public' AND table_name = ANY($2)`,
})

const DML_PRIVILEGES = new Set(['select', 'insert', 'update', 'delete', 'references', 'trigger'])

/** 从 apps/api/.env 兜底读一个键(与 scripts/check-migration-bookkeeping.mjs 同一口径)。 */
function readEnvFileKey(key) {
  const envPath = join(REPO_ROOT, 'apps', 'api', '.env')
  if (!existsSync(envPath)) return ''
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => new RegExp(`^\\s*${key}\\s*=`).test(l))
  if (!line) return ''
  return line.replace(/^\s*[A-Z0-9_]+\s*=\s*/, '').trim().replace(/^["']|["']$/g, '')
}

function resolveDsn(key) {
  return process.env[key] || readEnvFileKey(key)
}

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m', reset: '\x1b[0m' }

/**
 * catalog 前置判据(status 展示 / enable 门槛共用同一份,两处不会各说各话)。
 * @param {import('postgres').Sql<false>} sql  管理连接(表属主或超级用户)
 * @param {string} appRole
 * @returns {Promise<{ problems: string[], notes: string[], rls: Map<string, Record<string, unknown>> }>}
 */
async function assess(sql, appRole) {
  const policyNames = OWNER_TABLES.flatMap((t) => t.privs.map((k) => policyNameOf(t.table, k)))
  const tableNames = OWNER_TABLES.map((t) => t.table)

  const roleRows = await sql.unsafe(CATALOG_SQL.role, [appRole])
  const policyRows = await sql.unsafe(CATALOG_SQL.policies, [policyNames])
  const rlsRows = await sql.unsafe(CATALOG_SQL.rls, [tableNames])
  const grantRows = await sql.unsafe(CATALOG_SQL.grants, [appRole, tableNames])

  const role = roleRows[0]
  /** @type {Map<string, Record<string, unknown>>} */
  const rls = new Map(rlsRows.map((r) => [String(r.relname), r]))
  const presentPolicies = new Set(policyRows.map((r) => String(r.policyname)))
  /** @type {Map<string, Set<string>>} */
  const granted = new Map(
    tableNames.map((t) => [
      t,
      new Set(
        grantRows
          .filter((g) => String(g.table_name) === t)
          .map((g) => String(g.privilege_type).toLowerCase()),
      ),
    ]),
  )

  /** @type {string[]} */
  const problems = []
  /** @type {string[]} */
  const notes = []

  if (!role) {
    problems.push(`角色 ${appRole} 不存在:先跑迁移 ${MIGRATION_TAG}`)
  } else {
    if (role.rolsuper) problems.push(`角色 ${appRole} 是超级用户 —— 超级用户绕过一切 RLS,开了等于没开`)
    if (role.rolbypassrls) problems.push(`角色 ${appRole} 有 BYPASSRLS —— 同上,必须是 NOBYPASSRLS`)
    if (!role.rolcanlogin) notes.push(`角色 ${appRole} 不可登录(NOLOGIN):DATABASE_APP_URL 连不上它,只能用成员角色/SET ROLE 过去`)
    if (role.rolinherit) notes.push(`角色 ${appRole} 带 INHERIT:迁移默认给的是 NOINHERIT,确认没人事后再 ALTER 过`)
  }

  for (const t of OWNER_TABLES) {
    const row = rls.get(t.table)
    if (!row) {
      problems.push(`表 ${t.table} 在 public 下不存在:schema 与清单已漂移,先对齐再谈激活`)
      continue
    }
    // 属主若是这个应用角色,ENABLE(不带 FORCE)会被它以属主身份静默绕过 = 假隔离
    if (role && String(row.owner) === appRole) {
      problems.push(`表 ${t.table} 的 owner 就是 ${appRole}:非 FORCE 的 ENABLE 对它不生效,必须换属主或显式 FORCE`)
    }
    const missing = t.privs.filter((k) => !presentPolicies.has(policyNameOf(t.table, k)))
    if (missing.length) {
      problems.push(`表 ${t.table} 缺策略:${missing.map((k) => policyNameOf(t.table, k)).join(', ')}(重跑迁移即可补,幂等)`)
    }
    const have = granted.get(t.table) ?? new Set()
    const nonDml = [...have].filter((p) => !DML_PRIVILEGES.has(p))
    if (nonDml.length) problems.push(`表 ${t.table} 授了非 DML 类权限(${nonDml.join(', ')}):应用角色不该拿结构变更类权限`)
    const missingPrivs = t.privs.filter((p) => !have.has(p))
    if (missingPrivs.length) problems.push(`表 ${t.table} 缺 GRANT:${missingPrivs.join(', ')}(没有 GRANT,策略连被求值的机会都没有,直接 permission denied)`)
    const surplus = [...have].filter((p) => !t.privs.includes(p))
    if (surplus.length) notes.push(`表 ${t.table} 多授了 ${surplus.join(', ')}:调用点没用到,按最小权限应收回`)
    if (row.relforcerowsecurity) notes.push(`表 ${t.table} 已 FORCE ROW LEVEL SECURITY:连表属主都会被策略挡住,确认这是有意的`)
  }

  return { problems, notes, rls }
}

function printAssessment({ problems, notes, rls }) {
  for (const p of problems) console.log(`  ${C.red}✗${C.reset} ${p}`)
  for (const t of OWNER_TABLES) {
    const on = Boolean(rls.get(t.table)?.relrowsecurity)
    const mark = on ? `${C.green}✓${C.reset}` : `${C.yellow}!${C.reset}`
    console.log(
      `  ${mark} ${t.table}:RLS ${on ? '已开启' : '未开启'} · 策略 ${t.privs.map((k) => policyNameOf(t.table, k)).join(' / ')}`,
    )
  }
  for (const n of notes) console.log(`  ${C.yellow}!${C.reset} ${n}`)
}

/** 抛这个哨兵让 begin() 回滚(postgres.js 没有 tx.rollback(),回调 reject 即 ROLLBACK)。 */
class RollbackSignal extends Error {}

/**
 * 负向断言:换一个"谁都不是"的主体 ID,经**应用连接**读每张表必须 0 行;
 * 同时用管理连接取一次真值总数,免得在空表上"空过"却报成通过。
 * 全程 SELECT + 事务必回滚,对任何库都不产生写入。
 * 它证明的是"策略不是恒真";证明不了的方向会说清楚,不替它吹。
 */
async function liveNegativeAssert(admin, app) {
  const nobody = randomUUID()
  /** @type {Array<{ table: string, visible: number, total: number, vacuous: boolean }>} */
  const results = []
  for (const t of OWNER_TABLES) {
    const totalRows = await admin.unsafe(`SELECT count(*)::int AS n FROM "${t.table}"`)
    const total = Number(totalRows[0]?.n ?? 0)
    // max:1 的池 + 事务级 set_config(..., true):上下文与语句钉在同一条物理连接上 ——
    // 这正是应用侧(池化 session 变量)还没做到的那件事,所以这里单独验一次策略本身。
    let visible = -1
    try {
      await app.begin(async (tx) => {
        await tx.unsafe(`SELECT set_config('app.user_id', $1, true)`, [nobody])
        const rows = await tx.unsafe(`SELECT count(*)::int AS n FROM "${t.table}"`)
        visible = Number(rows[0]?.n ?? -1)
        throw new RollbackSignal('rollback-after-assert')
      })
    } catch (error) {
      if (!(error instanceof RollbackSignal)) throw error
    }
    results.push({ table: t.table, visible, total, vacuous: total === 0 })
  }
  return { nobody, results }
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv.find((a) => !a.startsWith('--')) ?? 'status'
  const apply = argv.includes('--apply')
  if (!['status', 'enable', 'disable'].includes(cmd)) {
    console.error(`未知命令 ${cmd}(可用:status | enable | disable [--apply])`)
    process.exit(2)
  }

  const adminDsn = resolveDsn('DATABASE_URL')
  if (!adminDsn) {
    console.error('缺少管理连接:设 DATABASE_URL 或写进 apps/api/.env(需表属主权限才能 ALTER / DROP POLICY)')
    process.exit(1)
  }
  const appDsn = resolveDsn('DATABASE_APP_URL')
  const admin = postgres(adminDsn, { max: 1, prepare: false })

  try {
    const verdict = await assess(admin, APP_ROLE)
    console.log(
      `${C.bold}[owner-rls] ${cmd}${C.reset}  角色=${APP_ROLE}  管理连接=DATABASE_URL  应用连接=${appDsn ? 'DATABASE_APP_URL' : '未配置'}`,
    )
    printAssessment(verdict)

    if (cmd === 'status') {
      console.log(
        verdict.problems.length
          ? `${C.red}前置不满足${C.reset}:共 ${verdict.problems.length} 条。`
          : `${C.green}前置齐备${C.reset}(策略齐、角色干净;RLS 该不该开见 enable 的断言)。`,
      )
      process.exit(verdict.problems.length ? 1 : 0)
    }

    if (cmd === 'disable') {
      const statements = OWNER_TABLES.flatMap((t) => [disableSqlOf(t.table), ...dropPoliciesOf(t.table, t.privs)])
      console.log(`\n回滚 SQL(${statements.length} 条,幂等,可重复执行):`)
      for (const s of statements) console.log(`  ${s};`)
      if (!apply) {
        console.log(`\n${C.yellow}dry-run${C.reset} 未写库;加 --apply 才执行。`)
        return
      }
      for (const s of statements) await admin.unsafe(s)
      console.log(
        `${C.green}已回滚${C.reset}:策略已 DROP、RLS 已 DISABLE。角色与 GRANT 不在这里回收 —— ` +
          `那是迁移管的(要回收请显式 REVOKE + DROP ROLE,并先摘掉 DATABASE_APP_URL)。`,
      )
      return
    }

    // ---- enable ----
    if (verdict.problems.length) {
      console.log(
        `\n${C.red}拒绝开启${C.reset}:${verdict.problems.length} 条前置不满足。` +
          `先把迁移 ${MIGRATION_TAG} 跑到位,别绕过断言。`,
      )
      process.exit(1)
    }
    const alreadyOn = OWNER_TABLES.every((t) => Boolean(verdict.rls.get(t.table)?.relrowsecurity))
    const statements = OWNER_TABLES.map((t) => enableSqlOf(t.table))
    console.log(`\n开启 SQL(${statements.length} 条${alreadyOn ? ';现状已全部开启,重复执行等价' : ''}):`)
    for (const s of statements) console.log(`  ${s};`)

    if (!appDsn) {
      console.log(
        `\n${C.yellow}拒绝开启(未配置 DATABASE_APP_URL)${C.reset}:此刻没有任何一条真实查询会经过非超级用户连接,` +
          `开了 RLS 只是个无法证明的宣称。先配应用连接(见迁移头注释的部署要求)。`,
      )
      process.exit(1)
    }
    if (!apply) {
      console.log(`\n${C.yellow}dry-run${C.reset} 未写库;加 --apply 才会 ENABLE 并跑负向断言(断言不过当场回退)。`)
      return
    }

    for (const s of statements) await admin.unsafe(s)
    const app = postgres(appDsn, { max: 1, prepare: false })
    try {
      const { nobody, results } = await liveNegativeAssert(admin, app)
      let bad = 0
      for (const r of results) {
        const flag = r.vacuous ? `${C.yellow}(表本身空过:该断言未取到信号)${C.reset}` : ''
        const verdictText =
          r.visible === 0 ? `${C.green}0 行 ✓${C.reset}` : `${C.red}${r.visible} 行 ← 策略恒真!${C.reset}`
        if (r.visible !== 0) bad += 1
        console.log(`  负向断言 ${r.table}:陌生主体 ${nobody.slice(0, 8)}… → ${verdictText} ${flag}`)
      }
      if (bad > 0) {
        for (const t of OWNER_TABLES) await admin.unsafe(disableSqlOf(t.table))
        console.log(`${C.red}已自动回退 DISABLE${C.reset}:陌生主体读到了行,说明策略不成立,不能保持开启。`)
        process.exit(1)
      }
      console.log(
        `${C.green}已开启并通过负向断言${C.reset}。仍未被证明的方向:①"该看得见的人确实看得见"` +
          `(需要真实数据 + 真实归属主体,本脚本刻意不造数据);②应用侧把 app.user_id 钉在**服务该语句的**连接上` +
          `(池化 session 变量的固有限制,须事务级 SET LOCAL —— 见 apps/api/src/plugins/rls-context.ts)。`,
      )
    } finally {
      await app.end()
    }
  } finally {
    await admin.end()
  }
}

const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((error) => {
    console.error(`[owner-rls] 执行失败: ${error?.message ?? error}`)
    process.exit(2)
  })
}

/** §22c 双形态出口:测试直接 import 判据与生成的 SQL,不触发 main() 的连库副作用。 */
export const __test__ = {
  APP_ROLE,
  MIGRATION_TAG,
  OWNER_TABLES,
  policyNameOf,
  enableSqlOf,
  disableSqlOf,
  dropPolicySqlOf,
  dropPoliciesOf,
  CATALOG_SQL,
  isDirectRun,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
