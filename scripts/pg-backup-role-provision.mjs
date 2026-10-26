#!/usr/bin/env node
/* eslint-disable no-console -- 本工具是超管窗口里的 CLI 建制器:结论必须落在终端上,与 pg-restore-drill.mjs 同形 */
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PG 备份只读角色「幂等建制」—— beifen(G-70 备份链重建 · 角色面,仓内可做的那一半)
 *
 * 立因(2026-10-27 现读,不是假想):
 *   仓里唯一的角色建制载体是 `deploy/win/ihui-pg-backup-role.sql`,它**自带一句**
 *   「一次性建制,故不用 DO/EXECUTE 包一层幂等」,正文就是裸 `CREATE ROLE beifen;`。
 *   后果有三型,都只能靠人肉推理绕开:
 *     ① 跑第二遍必然 `ERROR: role "beifen" already exists` —— 而 psql 默认 ON_ERROR_STOP=off,
 *        后半段 GRANT/ALTER 照样执行,于是"跑过了"与"跑到一半"在终端上是同一屏字;
 *     ② 角色已在但属性漂了(例如哪天被手工改成 NOINHERIT / NOBYPASSRLS / 连接数无上限),
 *        那份 SQL 无法收敛 —— 它只会再撞一次 already exists;
 *     ③ 想回答"这一步到底做没做"必须先手写一条 SELECT,没人写就没有答案。
 *   换机后(PG 18.6 新实例无 beifen)这三型同时变成"每次都要重新推理一遍"。
 *
 * 本文件补的就是「先 SELECT 存在性 → 只补差值」这一格,权限集**不自立门户**:
 *   canonical 仍是 `deploy/win/ihui-pg-backup-role.sql`(LOGIN / NOSUPERUSER / NOCREATEDB /
 *   NOCREATEROLE / NOREPLICATION / INHERIT / BYPASSRLS / CONNECTION LIMIT 2 /
 *   member of pg_read_all_data),本文件的 ROLE_SPEC 与它逐项对齐,镜像测试按 SQL 原文反查,
 *   任一侧漂开即红(§0.6 单一真相源)。
 *
 * 硬边界(形状锁见镜像测试):
 *   · 默认 **dry-run**;`--apply` 才写,一次 psql 调用=一个隐式事务,要么全落要么全不落;
 *   · 只读探测 + 幂等建角色/补授权;**任何 DROP / DELETE / TRUNCATE / REVOKE 都不生成**
 *     (生成即自毁 exit 2,不是"靠人审"而是判据先拦);
 *   · 口令**绝不覆盖**已存在角色的:默认不动,`--set-password` 才 ALTER;
 *   · 口令只从既有两个出口取(`env IHUI_DB_BACKUP_*` / §5d 权威目录 db-backup/ihui-backup.txt),
 *     实现直接 import `pg-restore-drill.mjs` 的 `resolveCredential`(与 pg-restore-app-reads
 *     同一份,不抄第二份);输出恒只报 `len=` 与来源,永不打印口令;
 *   · 本工具**不建凭据、不写凭据文件**:口令缺 ⇒ exit 2 显式「未判定 · 归机主供值」。
 *
 * 用法(超管会话窗口内):
 *   # ① 连接:二选一(口令走 env,不进 argv —— argv 会进进程列表与 shell 历史)
 *   $env:IHUI_PG_SUPERUSER_URL = 'postgresql://postgres@localhost:8810/ihui_dev'
 *   # 或 libpq 四件套:PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE
 *   node scripts/pg-backup-role-provision.mjs --dry-run     # 默认档,只读探测 + 打印计划
 *   node scripts/pg-backup-role-provision.mjs --apply       # 落差值并回读自证
 *
 * 退出码(AGENTS §0.3 三档):0 = 已收敛/计划已出;1 = 落库失败或落库后回读仍不收敛;
 *   2 = 未判定(无超管连接信息 / 口令取不到 / psql 不在位 / 开关非法 / 判据自毁)。
 */
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { locatePsqlClient, pgBinDir, psqlLocateMissText } from './lib/psql-client-locate.mjs'
import { keyFile } from './lib/key-dir.mjs'
// 口令取值链唯一一份实现(env IHUI_DB_BACKUP_* → §5d 权威目录口令文件),
// 与 pg-restore-app-reads.mjs 同一条 import 纪律:自己再写一份必然漂(§5d/§0.6)。
import { resolveCredential } from './pg-restore-drill.mjs'

/** canonical 权限集 —— 与 deploy/win/ihui-pg-backup-role.sql 逐项对齐(镜像测试反查原文)。 */
export const ROLE_SPEC = Object.freeze({
  name: 'beifen',
  login: true,
  superuser: false,
  createdb: false,
  createrole: false,
  replication: false,
  bypassrls: true,
  inherit: true,
  connlimit: 2,
  readAllDataRole: 'pg_read_all_data',
  credentialSub: 'db-backup',
  credentialName: 'ihui-backup.txt',
})

/** 属性档 → (expect 值 → 语句片段)。negative 与 positive 两侧都在,漂哪边都能拉回。 */
const ATTR_DIAL = Object.freeze([
  ['superuser', 'SUPERUSER', 'NOSUPERUSER'],
  ['login', 'LOGIN', 'NOLOGIN'],
  ['createdb', 'CREATEDB', 'NOCREATEDB'],
  ['createrole', 'CREATEROLE', 'NOCREATEROLE'],
  ['replication', 'REPLICATION', 'NOREPLICATION'],
  ['bypassrls', 'BYPASSRLS', 'NOBYPASSRLS'],
  ['inherit', 'INHERIT', 'NOINHERIT'],
])

/**
 * 自毁判据:凡生成出这一类语句,立即拒绝(exit 2),不给"人审"留余地。
 * 只判**动词**,不判注释/文案 —— 生成的 SQL 里本来就没有注释。
 */
export const FORBIDDEN_SQL =
  /\b(DROP|DELETE|TRUNCATE|REVOKE|ALTER\s+SYSTEM|REASSIGN|pg_terminate_backend)\b/i

export function assertSafeSql(sql) {
  const m = FORBIDDEN_SQL.exec(sql)
  if (m) throw new Error(`判据自毁:生成语句含禁止动词 "${m[1]}" —— ${sql}`)
  return sql
}

/** 标识符:只放行裸标识符,其余按 SQL 规则加双引号(角色名/库名来自 CLI,不能拼裸串)。 */
export function quoteIdent(name) {
  const s = String(name ?? '')
  if (/^[A-Za-z_][A-Za-z0-9_$]*$/.test(s)) return s
  return `"${s.replace(/"/g, '""')}"`
}

/** 字符串字面量(口令可能带单引号,必须成对转义)。 */
export function quoteLiteral(v) {
  return `'${String(v).replace(/'/g, "''")}'`
}

/** 展示面:口令一律打码,别让 dry-run 把口令写进终端/日志。 */
export function redactSql(sql) {
  return String(sql).replace(/PASSWORD\s+'(?:[^']|'')*'/gi, "PASSWORD '***'")
}

/**
 * 角色行(psql `-t -A -F '|'` 的一行输出)⇒ 结构化;空输出 = 角色不存在。
 * 列序与 ROLE_ROW_SQL 严格一致(改一处两处都得改,镜像测试按顺序断言)。
 */
export const ROLE_ROW_SQL = (role) =>
  `SELECT rolsuper, rolcanlogin, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit, rolconnlimit ` +
  `FROM pg_roles WHERE rolname = ${quoteLiteral(role)}`

export function parseRoleRow(stdout) {
  const line = String(stdout ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0]
  if (!line) return null
  const c = line.split('|')
  if (c.length !== 8) throw new Error(`角色行形状不符(期望 8 列): ${line}`)
  const bool = (v) => v === 't' || v === 'true'
  return {
    superuser: bool(c[0]),
    login: bool(c[1]),
    createdb: bool(c[2]),
    createrole: bool(c[3]),
    replication: bool(c[4]),
    bypassrls: bool(c[5]),
    inherit: bool(c[6]),
    connlimit: Number(c[7]),
  }
}

/** 已存在角色相对 ROLE_SPEC 的差值(顺序固定,便于比对与测试)。 */
export function roleAttributeDiffs(role) {
  if (!role) return []
  const diffs = []
  for (const [key, positive, negative] of ATTR_DIAL) {
    const want = ROLE_SPEC[key]
    if (Boolean(role[key]) !== want) diffs.push({ key, sql: want ? positive : negative })
  }
  if (Number(role.connlimit) !== ROLE_SPEC.connlimit) {
    diffs.push({ key: 'connlimit', sql: `CONNECTION LIMIT ${ROLE_SPEC.connlimit}` })
  }
  return diffs
}

/**
 * 计划器(纯函数,零 IO):给定探测到的现状,产出「要改哪几条」。
 * 现状已收敛 ⇒ statements 为空 —— 这就是幂等第二跑零写入的判据。
 *
 * @param {{db:string, role:object|null, memberOfReadAllData:boolean, canConnect:boolean}} state
 * @param {{role?:string, password?:string|null, setPassword?:boolean}} opts
 * @returns {{statements:Array<{sql:string, why:string}>, notes:string[], blocked:string|null}}
 */
export function planProvisioning(state, opts = {}) {
  const role = opts.role || ROLE_SPEC.name
  const password = opts.password ?? null
  const setPassword = Boolean(opts.setPassword)
  const statements = []
  const notes = []
  const ident = quoteIdent(role)

  if (!state.role) {
    // 建角色必须有口令;取不到 ⇒ 明确「未判定」而不是产一份跑不动的计划。
    if (!password) {
      return {
        statements,
        notes,
        blocked:
          `口令缺:建角色必须给出 PASSWORD —— 来源只有两个:env IHUI_DB_BACKUP_PASSWORD,或 §5d 权威目录 ` +
          `db-backup/ihui-backup.txt(本工具不创建凭据,这一格归机主供值)`,
      }
    }
    statements.push({
      sql:
        `CREATE ROLE ${ident} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION ` +
        `INHERIT BYPASSRLS CONNECTION LIMIT ${ROLE_SPEC.connlimit} PASSWORD ${quoteLiteral(password)}`,
      why: '建只读备份角色(canonical 权限集 = deploy/win/ihui-pg-backup-role.sql)',
    })
  } else {
    const diffs = roleAttributeDiffs(state.role)
    if (diffs.length) {
      statements.push({
        sql: `ALTER ROLE ${ident} WITH ${diffs.map((d) => d.sql).join(' ')}`,
        why: `属性差值: ${diffs.map((d) => d.key).join('/')}`,
      })
    }
    if (setPassword) {
      if (!password) {
        return {
          statements,
          notes,
          blocked:
            '--set-password 需要口令,但两个既有出口都取不到(env IHUI_DB_BACKUP_PASSWORD / db-backup/ihui-backup.txt)',
        }
      }
      statements.push({
        sql: `ALTER ROLE ${ident} WITH PASSWORD ${quoteLiteral(password)}`,
        why: '显式 --set-password(默认**绝不**覆盖已存在角色的口令)',
      })
    } else if (!diffs.length) {
      notes.push('属性面已收敛;口令不动(默认绝不覆盖,要轮换加 --set-password)')
    } else {
      notes.push('口令不动(默认绝不覆盖,要轮换加 --set-password)')
    }
  }

  if (!state.role || !state.memberOfReadAllData) {
    statements.push({
      sql: `GRANT ${ROLE_SPEC.readAllDataRole} TO ${ident}`,
      why: '动态只读授权:自动覆盖日后迁移新增的表(优于 GRANT ON ALL TABLES)',
    })
  }
  if (!state.canConnect) {
    // 建角色的前提面量不到 CONNECT(has_database_privilege 对不存在的角色会报错),按 canonical 一并给;
    // 已有角色则按实测差值补 —— 已由 PUBLIC 默认满足的不重复给(deploy/win/ihui-pg-backup.ps1
    // 2026-09-28 实测注记:库级 CREATE 隐含 CONNECT,反复补 GRANT 是多余动作)。
    statements.push({
      sql: `GRANT CONNECT ON DATABASE ${quoteIdent(state.db)} TO ${ident}`,
      why: '前瞻性加固:日后收紧 datacl 时本角色不受影响',
    })
  }

  for (const s of statements) assertSafeSql(s.sql)
  return { statements, notes, blocked: null }
}

// ────────────────────────────── IO 层(默认实现;main 使用) ──────────────────────────────

/** 派生 psql:显式 stdio + windowsHide(§5b 派生进程纪律),`-w` 永不交互等口令(否则会挂死)。 */
export function defaultExec({ argv, timeoutMs = 30_000 }) {
  const env = { ...process.env, PGCONNECT_TIMEOUT: '5', PGCLIENTENCODING: 'UTF8' }
  const r = spawnSync(argv[0], argv.slice(1), {
    env,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    rc: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: (r.stderr ?? '') || (r.error ? String(r.error.message) : ''),
  }
}

/** 连接面:DSN 优先,其次 libpq 环境变量;两者皆无 ⇒ null(调用方据此落"未判定")。 */
export function resolveConnection(env = process.env) {
  const dsn = String(env.IHUI_PG_SUPERUSER_URL || '').trim()
  if (dsn) return { dsn, source: 'env IHUI_PG_SUPERUSER_URL' }
  const keys = ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGPASSWORD']
  const present = keys.filter((k) => String(env[k] || '').trim())
  if (present.length) return { dsn: '', source: `libpq env(${present.join('/')})` }
  return null
}

/** 探针:全部只读 SELECT。角色不存在时不再问成员/库权(那两条对不存在的角色会报错)。 */
export function probeState(run, { role = ROLE_SPEC.name, db = '' } = {}) {
  const dbRow = run('SELECT current_database()').stdout.trim()
  const targetDb = db || dbRow
  const row = run(ROLE_ROW_SQL(role)).stdout
  const roleRow = parseRoleRow(row)
  if (!roleRow) return { db: targetDb, role: null, memberOfReadAllData: false, canConnect: false }
  const member = run(
    `SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member ` +
      `JOIN pg_roles g ON g.oid = m.roleid WHERE r.rolname = ${quoteLiteral(role)} ` +
      `AND g.rolname = ${quoteLiteral(ROLE_SPEC.readAllDataRole)}`,
  ).stdout.trim()
  const canConnect =
    run(
      `SELECT has_database_privilege(${quoteLiteral(role)}, ${quoteLiteral(targetDb)}, 'CONNECT')`,
    ).stdout.trim() === 't'
  return { db: targetDb, role: roleRow, memberOfReadAllData: Number(member) > 0, canConnect }
}

/** 收敛判据(落库后回读用):三维全绿才算 converged,任一不成立逐条点名。 */
export function convergenceGaps(state, opts = {}) {
  const role = opts.role || ROLE_SPEC.name
  const gaps = []
  if (!state.role) gaps.push(`角色 ${role} 仍不存在`)
  else {
    for (const d of roleAttributeDiffs(state.role)) gaps.push(`属性 ${d.key} 未收敛`)
  }
  if (!state.memberOfReadAllData) gaps.push(`成员关系 ${ROLE_SPEC.readAllDataRole} 未成立`)
  if (!state.canConnect) gaps.push(`库 ${state.db} 的 CONNECT 未成立`)
  return gaps
}

export function parseArgs(argv = []) {
  const out = {
    apply: false,
    json: false,
    setPassword: false,
    role: ROLE_SPEC.name,
    db: '',
    help: false,
    selfTest: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.apply = false
    else if (a === '--apply') out.apply = true
    else if (a === '--json') out.json = true
    else if (a === '--set-password') out.setPassword = true
    else if (a === '--self-test') out.selfTest = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--role' || a === '--db') {
      const v = argv[++i]
      if (!v || v.startsWith('-')) throw new Error(`${a} 需要一个值`)
      if (a === '--role') out.role = v
      else out.db = v
    } else if (a.startsWith('-'))
      throw new Error(
        `未知开关: ${a}(支持 --dry-run / --apply / --json / --set-password / --role / --db / --self-test)`,
      )
    else throw new Error(`多余参数: ${a}(本工具不吃位置参数)`)
  }
  if (out.role !== ROLE_SPEC.name) {
    // 不是禁止换名,而是换名必须显式意识到 canonical 权限集是照 beifen 定的
    out.notes = [`注意:角色名被改成 ${out.role};canonical 权限集与凭据路径仍按 beifen 口径`]
  }
  return out
}

const USAGE = `用法: node scripts/pg-backup-role-provision.mjs [--dry-run|--apply] [--json] [--set-password] [--role beifen] [--db <库名>] [--self-test]
  连接(二选一,口令不进 argv):env IHUI_PG_SUPERUSER_URL=<postgresql://…> 或 libpq 四件套 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
  默认 dry-run;--apply 才落库(一次 psql=一个隐式事务)。不含任何 DROP/DELETE/REVOKE。`

/** 自检:纯函数面可证的四条 + 两条形状锁,不连库。 */
export function selfTest() {
  const cases = []
  const push = (name, ok, detail = '') => cases.push({ name, ok, detail })

  const fresh = { db: 'ihui_dev', role: null, memberOfReadAllData: false, canConnect: false }
  const p1 = planProvisioning(fresh, { password: 'x'.repeat(8) })
  push(
    '建角色:三条语句且顺序 = CREATE/GRANT 读/GRANT 连接',
    p1.statements.length === 3 &&
      /^CREATE ROLE beifen/.test(p1.statements[0].sql) &&
      /^GRANT pg_read_all_data/.test(p1.statements[1].sql) &&
      /^GRANT CONNECT ON DATABASE ihui_dev/.test(p1.statements[2].sql),
    JSON.stringify(p1.statements.map((s) => s.sql)),
  )
  push('建角色:缺口令 ⇒ blocked(不产跑不动的计划)', planProvisioning(fresh, {}).blocked !== null)
  push(
    '展示面口令打码',
    !redactSql(p1.statements[0].sql).includes('xxxxxxxx') &&
      redactSql(p1.statements[0].sql).includes("PASSWORD '***'"),
  )

  const converged = {
    db: 'ihui_dev',
    role: {
      superuser: false,
      login: true,
      createdb: false,
      createrole: false,
      replication: false,
      bypassrls: true,
      inherit: true,
      connlimit: 2,
    },
    memberOfReadAllData: true,
    canConnect: true,
  }
  push('幂等第二跑零写入', planProvisioning(converged, { password: null }).statements.length === 0)
  push('收敛判据对已收敛态零缺口', convergenceGaps(converged).length === 0)

  const drifted = {
    ...converged,
    role: { ...converged.role, inherit: false, bypassrls: false, connlimit: -1 },
  }
  const p3 = planProvisioning(drifted, { password: null })
  push(
    '漂移只补差值(单条 ALTER,含 NOINHERIT→INHERIT/BYPASSRLS/连接数,且不碰口令)',
    p3.statements.length === 1 &&
      /^ALTER ROLE beifen WITH /.test(p3.statements[0].sql) &&
      /INHERIT/.test(p3.statements[0].sql) &&
      /BYPASSRLS/.test(p3.statements[0].sql) &&
      /CONNECTION LIMIT 2/.test(p3.statements[0].sql) &&
      !/PASSWORD/.test(p3.statements[0].sql),
    p3.statements[0]?.sql,
  )
  push(
    '已存在角色默认不动口令(--set-password 才 ALTER)',
    planProvisioning(converged, { password: 'p', setPassword: false }).statements.length === 0,
  )

  let threw = false
  try {
    assertSafeSql('REVOKE ALL ON DATABASE x FROM beifen')
  } catch {
    threw = true
  }
  push('自毁判据:REVOKE 被拦', threw)
  push(
    '角色行解析(8 列)',
    (() => {
      const r = parseRoleRow('f|t|f|f|f|t|t|2')
      return (
        r &&
        r.login === true &&
        r.bypassrls === true &&
        r.inherit === true &&
        r.connlimit === 2 &&
        r.superuser === false
      )
    })(),
  )
  push('连接面:两者皆无 ⇒ null', resolveConnection({}) === null)
  push(
    '连接面:libpq 单键即认',
    resolveConnection({ PGHOST: 'localhost' })?.source.includes('PGHOST'),
  )

  const bad = cases.filter((c) => !c.ok)
  for (const c of cases)
    console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.ok ? '' : ` —— ${c.detail}`}`)
  console.log(
    `SELF-TEST ${bad.length ? 'fail' : 'ok'} ${cases.length - bad.length}/${cases.length}`,
  )
  return bad.length ? 1 : 0
}

/**
 * 主流程(纯注入:连接/执行器/口令/psql 定位全部可替身,镜像测试据此不连库)。
 * @returns {number} exit code
 */
export function main(argv = [], env = process.env, deps = {}) {
  const say = deps.say || ((l) => console.log(l))
  const warn = deps.warn || ((l) => console.error(l))
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    warn(`❌ ${e.message}`)
    warn(USAGE)
    return 2
  }
  if (opts.help) {
    say(USAGE)
    return 0
  }
  if (opts.selfTest) return selfTest()

  // 未判定也必须留一行机器可读结论(§0.3:取不到输入 ⇒ 显式「未判定」,不记绿也不冒红)
  const undetermined = (reason) => {
    say(
      `PROVISION-RESULT state=undetermined reason=${reason} mode=${opts.apply ? 'apply' : 'dry-run'} role=${opts.role}`,
    )
    return 2
  }

  const conn = resolveConnection(env)
  if (!conn) {
    warn(
      '未判定:没有超管连接信息 —— 建角色需要一次超管会话(本机长期没有可达超管凭据,这一步归机主窗口)',
    )
    warn('  出路:env IHUI_PG_SUPERUSER_URL=<postgresql://postgres@localhost:8810/ihui_dev>')
    warn('     或 libpq 四件套:PGHOST / PGPORT / PGUSER=postgres / PGPASSWORD / PGDATABASE')
    return undetermined('no-superuser-connection')
  }

  const locate = deps.locate || (() => locatePsqlClient(env))
  const located = locate()
  const psql = located?.psql
  if (!psql) {
    warn(`未判定:${psqlLocateMissText(located?.tried || [])}`)
    warn(`  提示:IHUI_PG_BIN_DIR 默认指向 ${pgBinDir(env)};换机后请指真实 bin 目录`)
    return undetermined('psql-not-found')
  }

  const exec = deps.exec || defaultExec
  const baseArgs = ['-w', '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1']
  const targetArgs = conn.dsn ? ['-d', conn.dsn] : []
  const run = (sql) => {
    const r = exec({ argv: [psql, ...baseArgs, ...targetArgs, '-c', sql] })
    if (r.rc !== 0) {
      const errText = String(r.stderr || '').trim()
      const hint = /password authentication failed|no password supplied|fe_sendauth/i.test(errText)
        ? ' —— 超管会话没通过认证(argv 不带口令,请用 PGPASSWORD/DSN 提供)'
        : /permission denied|must be superuser|not authorized/i.test(errText)
          ? ' —— 当前连接角色不是超管:CREATE ROLE/GRANT 需要超管(或有 CREATEROLE+ADMIN 的组合)'
          : ''
      throw new Error(`psql 执行失败(rc=${r.rc})${hint}: ${errText.slice(0, 400)}`)
    }
    return r
  }

  let state
  try {
    state = probeState(run, { role: opts.role, db: opts.db })
  } catch (e) {
    warn(`❌ 探测失败:${e.message}`)
    return undetermined('probe-failed')
  }

  const cred = deps.resolveCredential ? deps.resolveCredential() : resolveCredential()
  const password = cred && !cred.null && cred.password ? cred.password : null
  const credPath = deps.credentialPath
    ? deps.credentialPath()
    : keyFile(ROLE_SPEC.credentialSub, ROLE_SPEC.credentialName)

  const plan = planProvisioning(state, { role: opts.role, password, setPassword: opts.setPassword })
  const notes = [...(opts.notes || []), ...plan.notes]

  const jsonBase = {
    mode: opts.apply ? 'apply' : 'dry-run',
    connection: conn.source,
    psql,
    db: state.db,
    role: opts.role,
    roleExists: Boolean(state.role),
    statements: plan.statements.map((s) => ({ ...s, sql: redactSql(s.sql) })),
    notes,
    blocked: plan.blocked,
    credential: {
      present: Boolean(password),
      source: password ? cred.source : null,
      len: password ? password.length : 0,
    },
  }
  // 机读档只吐一个 JSON 文档(append 一行 PROVISION-RESULT 会让 JSON.parse 直接炸);
  // 人读档的最后一行才是 PROVISION-RESULT —— 验证命令按它取值。
  const finish = (stateWord, n, code, extra = {}) => {
    if (opts.json) {
      say(
        JSON.stringify(
          { ...jsonBase, result: { state: stateWord, statements: n, ...extra } },
          null,
          2,
        ),
      )
    } else {
      say(
        `PROVISION-RESULT state=${stateWord} statements=${n} mode=${opts.apply ? 'apply' : 'dry-run'} db=${state.db} role=${opts.role}`,
      )
    }
    return code
  }

  if (!opts.json) {
    say(`[pg-backup-role] 目标 ${opts.role} @ ${state.db}(连接: ${conn.source};psql: ${psql})`)
    say(
      `[探针] 角色: ${state.role ? `已存在(属性 ${ATTR_DIAL.map(([k]) => (state.role[k] ? 't' : 'f')).join('')};连接上限 ${state.role.connlimit})` : '不存在'}`,
    )
    say(
      `[探针] ${ROLE_SPEC.readAllDataRole} 成员: ${state.memberOfReadAllData};库 CONNECT: ${state.canConnect}`,
    )
    say(
      `[口令] ${password ? `已取到(来源: ${cred.source};len=${password.length};内容不打印)` : `缺 —— 归机主供值(env IHUI_DB_BACKUP_PASSWORD 或 ${credPath || `<密钥根>/${ROLE_SPEC.credentialSub}/${ROLE_SPEC.credentialName}`})`}`,
    )
    for (const n of notes) say(`[注] ${n}`)
    if (plan.blocked) say(`[缺口] ${plan.blocked}`)
    if (plan.statements.length) {
      say(`[计划] ${plan.statements.length} 条语句(${opts.apply ? 'APPLY' : 'dry-run,未执行'}):`)
      plan.statements.forEach((s, i) => say(`  ${i + 1}) ${redactSql(s.sql)}    -- ${s.why}`))
    } else {
      say('[计划] 零语句:现状已与 canonical 权限集一致(幂等第二跑不写任何东西)')
    }
  }

  if (plan.blocked) {
    if (opts.json) finish('blocked', 0, 2, { reason: plan.blocked })
    else
      say(
        `PROVISION-RESULT state=blocked reason=missing-password mode=${opts.apply ? 'apply' : 'dry-run'} role=${opts.role}`,
      )
    return 2
  }
  if (!opts.apply) return finish('planned', plan.statements.length, 0)
  if (!plan.statements.length) return finish('converged', 0, 0)

  const sql = plan.statements.map((s) => s.sql).join(';\n') + ';'
  try {
    run(sql)
  } catch (e) {
    warn(`❌ 落库失败(整批未落,事务回滚):${e.message}`)
    return finish('failed', 0, 1, { error: String(e.message) })
  }

  // 落库必须回读自证 —— 退出码 0 不等于"已收敛"(§0.3:判据在真跑它的那一刻成立)。
  let after
  try {
    after = probeState(run, { role: opts.role, db: state.db })
  } catch (e) {
    warn(`断言失败后仍未能回读(落库已提交,需人工复核):${e.message}`)
    return finish('undetermined', plan.statements.length, 1, { error: String(e.message) })
  }
  const gaps = convergenceGaps(after, { role: opts.role })
  if (gaps.length) {
    warn(`❌ 落库后回读仍不收敛: ${gaps.join(';')}`)
    return finish('drifted', plan.statements.length, 1, { gaps })
  }
  if (!opts.json && password && cred && String(cred.source || '').startsWith('env')) {
    say(
      `[提示] 本批口令来自 env,凭据文件未被改写 —— 若要固化,请机主把同一口令写回 ${credPath || `<密钥根>/${ROLE_SPEC.credentialSub}/${ROLE_SPEC.credentialName}`}(本工具不写凭据)`,
    )
  }
  return finish('converged', plan.statements.length, 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = {
  main,
  selfTest,
  planProvisioning,
  probeState,
  convergenceGaps,
  roleAttributeDiffs,
  parseRoleRow,
  parseArgs,
  resolveConnection,
  quoteIdent,
  quoteLiteral,
  redactSql,
  assertSafeSql,
  defaultExec,
  ROLE_SPEC,
  ROLE_ROW_SQL,
  ATTR_DIAL,
  FORBIDDEN_SQL,
  USAGE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
