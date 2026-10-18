// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-790 真库对账探针客户端(L10191 --db 环境档的取材层)。
 *
 * 为什么住在 lib 而不在门体:check-redundant-discriminator-predicate.mjs 被 T7 形状锁
 * 钉死"门体不得出现 spawnSync / child_process / 读磁盘形态"——那把锁管的是**被审内容
 * 的取材面**(枚举与正文必须走 face-reader 层);真库探针是另一件事(只读 SELECT/EXPLAIN),
 * 落在本层,门体只 import 纯判据(spec 表 + 分类函数),spawn 细节不出门体。
 *
 * 纪律:
 *  - 只许本机回环的 dev/test 库:host 不在 loopback 白名单 ⇒ 拒绝;8810 是生产 SSH 隧道口
 *    (scripts/db/db_sync.py 的 prod_dsn),显式点名拒绝——取证一律不得连生产库(AGENTS §5)。
 *  - 只发 SELECT / EXPLAIN,不发任何写语句;每条查询带 statement_timeout。
 *  - 探针四态与门体同形:pass / hit / undetermined,绝不并桶。
 */
import { spawnSync } from 'node:child_process'
import { locatePsqlClient, psqlLocateMissText } from './psql-client-locate.mjs'

const PSQL_TIMEOUT = 20_000

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
/** 生产隧道口:db_sync.prod_dsn 的 tunnelPort,误连即取证违规。 */
export const FORBIDDEN_PROD_PORT = '8810'

/**
 * DSN 守卫(纯函数):非回环 / 非postgres协议 / 8810 ⇒ 拒绝,理由逐条说清。
 * 返回 { ok:true, dsn } 或 { ok:false, why }。
 */
export function guardDbDsn(raw) {
  const dsn = String(raw || '').trim()
  const m = /^postgres(?:ql)?:\/\/([^/@:]+)(?::([^@/]*))?@([^/:?]+)(?::(\d+))?\/([^\s?]+)/.exec(dsn)
  if (!m) return { ok: false, why: 'DSN 不是 postgres://user:pass@host:port/db 形态,不猜' }
  const [, , , host, port] = m
  if (!LOOPBACK_HOSTS.has(host.toLowerCase())) {
    return { ok: false, why: `host=${host} 不在本机回环白名单(localhost/127.0.0.1/::1)——取证不得连生产库` }
  }
  if (port === FORBIDDEN_PROD_PORT) {
    return { ok: false, why: `端口 ${FORBIDDEN_PROD_PORT} 是生产 SSH 隧道口(db_sync.prod_dsn),--db 档拒绝连接` }
  }
  return { ok: true, dsn }
}

/**
 * 探针规格(G-790 README A/E 段的列收口对账;改清单先改 README,不得在这里长出第二份真相):
 *  - column:真库必须有这一列 —— 静态面的 pass/equality 判定全部押在它身上;
 *  - shape:收口后的读面谓词形状,EXPLAIN 验证判别列进了 SQL 谓词(而非拉全量内存判)。
 */
export const DB_PROBES = [
  {
    id: 'A7',
    table: 'llm_call_logs',
    column: 'refunded',
    wantType: 'boolean',
    shape: "SELECT 1 FROM llm_call_logs WHERE call_type IN ('image','video') AND status = 'success' AND refunded = false",
    why: '退款资格判别列(README A7/E):资格谓词走列,写侧 markTaskRefunded 同批盖列',
  },
  {
    id: 'A5',
    table: 'audit_logs_chain',
    column: 'raw_retained',
    wantType: 'boolean',
    shape: "SELECT 1 FROM audit_logs_chain WHERE raw_retained = false",
    why: '原文留存判别列(README A5/E):擦除器选行走列,默认 true 与旧谓词缺键即仍在同形',
  },
  {
    id: 'A1',
    table: 'llm_call_logs',
    column: 'api_key_id',
    wantType: null,
    shape: "SELECT 1 FROM llm_call_logs WHERE api_key_id IS NOT NULL AND metadata->>'byokMode' = 'true'",
    why: 'A1/A2 读面收窄用的既有独立列(真收口 byok_mode 列待迁移,README E 段)',
  },
]

/**
 * 探针分类(纯函数):psql 取回的事实 → 终态。四格同形,绝不把"取不到"折成"没有"。
 *  arg: { tableExists:boolean, columnRow:{data_type}|null, planText:string|null, wantType:string|null, column:string }
 */
export function classifyDbProbe(arg) {
  const { tableExists, columnRow, planText, wantType, column } = arg
  if (!tableExists) return { state: 'undetermined', why: '表在连接的库里不存在 ⇒ 探针无从对账(可能是连错库)' }
  if (!columnRow) {
    return { state: 'hit', why: '判别列在真库缺失 ⇒ 静态面所有 pass/equality 判定失据(收口被回潮)' }
  }
  if (wantType && columnRow.data_type !== wantType) {
    return { state: 'hit', why: `列在但类型漂移:库 ${columnRow.data_type} / 收口要求 ${wantType} ⇒ 谓词形状存疑` }
  }
  if (planText === null || planText === undefined) {
    return { state: 'undetermined', why: 'EXPLAIN 取不到 ⇒ 谓词是否进 SQL 无法判定,不猜' }
  }
  if (column && !planText.includes(column)) {
    return { state: 'hit', why: `EXPLAIN 计划里没有判别列 ${column} ⇒ "判别进 WHERE 谓词"未在真库证实,不得记 pass` }
  }
  return { state: 'pass', why: `列在(${columnRow.data_type}),EXPLAIN 计划含判别列 ⇒ 谓词进了 SQL 而非内存判` }
}

/** 展示用脱敏:密码一律 ***,凭据不得进任何报告/stdout。 */
export function sanitizeDsn(raw) {
  return String(raw || '').replace(/(\/\/[^:/@]+:)[^@]*(@)/, '$1***$2')
}

function psqlQuery(psql, dsn, sql) {
  const r = spawnSync(psql, ['-At', '-q', '-X', '-v', 'ON_ERROR_STOP=1', '-d', dsn, '-c', `SET statement_timeout = '15s'; ${sql}`],
    { encoding: 'utf8', windowsHide: true, timeout: PSQL_TIMEOUT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PGCONNECT_TIMEOUT: '8' } })
  return { status: r.status, stdout: String(r.stdout || ''), stderr: String(r.stderr || ''), lost: r.error ? String(r.error.message || r.error) : '' }
}

/**
 * 真库探针执行(只读)。返回 { ok:true, results } 或 { ok:false, why }。
 * 连不上 / psql 取不到 ⇒ ok:false(门体把它读成"不可执行",rc 2,不记绿)。
 */
export function runDbProbes(dsn, env = process.env) {
  const located = locatePsqlClient(env)
  if (!located.psql) return { ok: false, why: psqlLocateMissText(located.tried) }
  const psql = located.psql
  const results = []
  for (const probe of DB_PROBES) {
    const col = psqlQuery(psql, dsn, `SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${probe.table}' AND column_name='${probe.column}'`)
    if (col.status !== 0) {
      return { ok: false, why: `探针查询失败(${probe.table}.${probe.column}):${(col.stderr || col.lost || 'exit ' + col.status).trim().slice(0, 200)}` }
    }
    const typeOut = col.stdout.trim()
    const tbl = psqlQuery(psql, dsn, `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${probe.table}'`)
    if (tbl.status !== 0) {
      return { ok: false, why: `表存在性查询失败(${probe.table}):${(tbl.stderr || tbl.lost || 'exit ' + tbl.status).trim().slice(0, 200)}` }
    }
    const tableExists = tbl.stdout.trim() === '1'
    let planText = null
    if (tableExists && typeOut) {
      const ex = psqlQuery(psql, dsn, `EXPLAIN ${probe.shape}`)
      if (ex.status === 0) planText = ex.stdout
    }
    const verdict = classifyDbProbe({ tableExists, columnRow: typeOut ? { data_type: typeOut } : null, planText, wantType: probe.wantType, column: probe.column })
    results.push({ id: probe.id, table: probe.table, column: probe.column, dbType: typeOut || null, state: verdict.state, why: verdict.why, note: probe.why })
  }
  return { ok: true, results }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
