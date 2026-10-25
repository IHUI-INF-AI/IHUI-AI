#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-registry-sync-health.mjs — 资源目录同步"静默停更"哨兵(2026-10-25 立)
 *
 * 立因(当天现读):04:00Z cron 一轮 `synced=0 failed=760` —— 上游分页重叠触发
 * PG 21000 整批回滚(修复见 33cf83062e1 批内去重)。而这次事故的全部可见面只有
 * 一行 WARN + sync_log 里一条 status='fail':**没有告警、没有指标、没有巡检格** ——
 * 若去重修复没被今天翻日志撞到,目录会一直空转到有人打开目录页才发现。
 * 本尺子把"最近一次全量同步成功是什么时候"变成可判、可到人的一格(§5e 只到人邮件链路
 * 由 git-guardian 的 audit 挂点负责;尺子本身只出结论,零副作用、不改退出码语义)。
 *
 * 判据(纯函数,镜像测试直接调):
 *   只看 cron 全量轮(source_name='all' 且状态已定:success|fail|skipped);
 *   ① 最近 K 轮里存在 success ⇒ ok(报最后成功时刻 + 自那以后连续 fail/skipped 数);
 *   ② 有轮次记录却从无 success ⇒ finding(never-success,带首轮证据);
 *   ③ 最后 success 距今 > staleHours(默认 36h = 每日 cron + 余量)⇒ finding(stale);
 *   ④ 一行都取不到(表空/查询失败/DSN 缺)⇒ **未判定 exit 2**,不拿 0 冒充"没同步过也健康",
 *      也不冒充"健康"(§0.3)。
 * skipped(上游整轮空手)不算成功证据 —— 目录停更时它看起来和成功一样"安静"。
 *
 * 密码纪律同 migration-gaps:DSN 只经 PGPASSWORD 进子进程,任何输出不回显 DSN/凭据。
 *
 * 用法:
 *   node scripts/check-registry-sync-health.mjs [--json] [--stale-hours 36] [--limit 30]
 * 退出码:0=ok / 1=finding / 2=未判定。
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { psqlArgsFromDsn, readDsn } from './check-db-migration-gaps.mjs'
import { locatePsqlClient } from './lib/psql-client-locate.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_LIMIT = 30
const DEFAULT_STALE_HOURS = 36
/** 已定局状态;'running' 进行中不算证据(它既不是成功也不是失败)。 */
const SETTLED = new Set(['success', 'fail', 'skipped'])

/**
 * 纯判据。rows 按 started_at 倒序(最新在前)。nowMs 由调用方注入(可测)。
 * 判据两档(宁严勿宽,§5e-1 可整改性——每轮 cron 失败当轮就该喊,不该等它烂成"停更"):
 *   ① **第一条已定局轮**(success|fail|skipped;running 跳过)不是 success ⇒ finding
 *      (reason 点名最新轮状态 + 距上一轮成功的间隔;never-success 单列);
 *   ② 最新一轮 success,但再往前无 success 可追溯时 ① 已覆盖,无需陈旧档;
 *      保留 stale 档兜"表里全是 success 但时间戳坏/轮次缺"的形态:最新 success 距今
 *      > staleHours(默认 36h = 每日 cron + 余量)⇒ finding。
 *   ③ 一行都取不到(表空/查询失败/DSN 缺)⇒ **未判定 exit 2**,不拿 0 冒充"没同步过也健康",
 *      也不冒充"健康"(§0.3)。
 * skipped(上游整轮空手)不是成功证据 —— 目录停更时它看起来和成功一样"安静"。
 */
export function judgeSyncHealth({ rows, nowMs, staleHours = DEFAULT_STALE_HOURS }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { state: 'undetermined', reason: '取不到任何"全量同步"已定局轮次(表空或查询失败)⇒ 未判定,不读成健康', consecutiveBad: 0 }
  }
  const staleMs = staleHours * 3600_000
  let consecutiveBad = 0
  let lastSuccess = null
  let firstSettled = null
  for (const r of rows) {
    if (!SETTLED.has(r.status)) continue
    if (!firstSettled) firstSettled = r
    if (r.status === 'success') {
      lastSuccess = r
      break
    }
    consecutiveBad += 1
  }
  if (!lastSuccess) {
    return {
      state: 'finding',
      reason: `最近 ${rows.filter((r) => SETTLED.has(r.status)).length} 轮已定局里**从未有过 success**(连续 fail/skipped=${consecutiveBad})`,
      consecutiveBad,
    }
  }
  const atMs = Date.parse(String(lastSuccess.startedAt ?? '').trim())
  if (!Number.isFinite(atMs)) {
    return {
      state: 'undetermined',
      reason: `最后 success 行的 started_at 不可解(${String(lastSuccess.startedAt ?? '(空)').slice(0, 40)})⇒ 未判定`,
      consecutiveBad,
    }
  }
  if (firstSettled && firstSettled.status !== 'success') {
    return {
      state: 'finding',
      reason: `最新一轮已定局为 ${firstSettled.status}(consecutiveBad=${consecutiveBad};上一轮 success 距今 ${((nowMs - atMs) / 3600_000).toFixed(1)}h)⇒ 当轮全军,立即判红`,
      lastSuccessAt: new Date(atMs).toISOString(),
      consecutiveBad,
    }
  }
  const ageMs = nowMs - atMs
  if (ageMs > staleMs) {
    return {
      state: 'finding',
      reason: `最近一次 success 距今 ${(ageMs / 3600_000).toFixed(1)}h > ${staleHours}h(cron 每日 12:00 一班 + 余量)⇒ 目录停更`,
      lastSuccessAt: new Date(atMs).toISOString(),
      consecutiveBad,
    }
  }
  return {
    state: 'ok',
    reason: `最新一轮 success,距今 ${(ageMs / 3600_000).toFixed(1)}h`,
    lastSuccessAt: new Date(atMs).toISOString(),
    consecutiveBad,
  }
}

export function runPsql(psql, dsn, extra, { timeout = 60_000 } = {}) {
  const p = psqlArgsFromDsn(dsn)
  if (!p.ok) return { ok: false, why: p.why }
  const r = spawnSync(psql, [...p.args, ...extra], {
    encoding: 'utf8',
    timeout,
    windowsHide: true, // §5f
    stdio: ['ignore', 'pipe', 'pipe'], // §12g
    env: p.env,
    maxBuffer: 1 << 22,
  })
  if (r.error) return { ok: false, why: String(r.error.code ?? r.error.message) }
  if (r.status !== 0) return { ok: false, why: `psql exit=${r.status}: ${String(r.stderr ?? '').trim().slice(0, 200)}` }
  return { ok: true, stdout: String(r.stdout ?? '') }
}

export function buildSql(limit = DEFAULT_LIMIT) {
  const n = Number.isFinite(limit) && limit > 0 && limit <= 200 ? Math.trunc(limit) : DEFAULT_LIMIT
  // 聚合后取"已定局的全量轮":每轮 cron 写一行(source_name='all');errorMessage 用 MAX 顺带捞最近一条,
  // 供到人正文指路。列宽按现读 schema(varchar status),值域在代码侧再过滤。
  return `select status, started_at::text, coalesce(error_message,'') as err from registry_sync_logs where source_name='all' order by started_at desc limit ${n};`
}

export function parseRows(stdout) {
  return String(stdout ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, startedAt, ...rest] = line.split('\t')
      return { status: (status ?? '').trim(), startedAt: (startedAt ?? '').trim(), err: rest.join('\t').trim() }
    })
    .filter((r) => r.status !== '')
}

function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const staleIdx = args.indexOf('--stale-hours')
  const staleHours = staleIdx >= 0 ? Number(args[staleIdx + 1]) : DEFAULT_STALE_HOURS
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : DEFAULT_LIMIT
  const emit = (obj, code) => {
    if (json) console.log(JSON.stringify(obj))
    else console.log(`${obj.state.toUpperCase()} registry-sync: ${obj.reason}${obj.lastSuccessAt ? ` | last_success=${obj.lastSuccessAt}` : ''}${obj.consecutiveBad ? ` | 连续fail/skipped=${obj.consecutiveBad}` : ''}`)
    process.exit(code)
  }
  const locate = locatePsqlClient()
  const psql = locate.psql
  if (!psql) return emit({ state: 'undetermined', reason: `psql 客户端取不到(${(locate.tried ?? []).length} 个候选皆不在位)⇒ 未判定` }, 2)
  const dsn = readDsn({ envFile: join(REPO, 'apps', 'api', '.env'), env: process.env })
  if (!dsn.ok) return emit({ state: 'undetermined', reason: `DSN 取不到(${dsn.why ?? dsn.from ?? 'env 与 .env 皆空'})⇒ 未判定` }, 2)
  const q = runPsql(psql, dsn.dsn, ['-At', '-F', '\t', '-c', buildSql(limit)])
  if (!q.ok) return emit({ state: 'undetermined', reason: `查询失败:${q.why}` }, 2)
  const rows = parseRows(q.stdout)
  const v = judgeSyncHealth({ rows, nowMs: Date.now(), staleHours })
  const code = v.state === 'ok' ? 0 : v.state === 'finding' ? 1 : 2
  emit({ ...v, checkedRows: rows.length }, code)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { judgeSyncHealth, buildSql, parseRows }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
