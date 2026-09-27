#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PostgreSQL 备份**节律与完整性**只读审计器(2026-09-27 立项)。
 *
 * 它回答的是此前无人回答的那一句:保留窗口内**每一天**的那份 dump 到底完不完整 ——
 * 而不是"今天这份完不完整"(那一票已由 scripts/pg-restore-drill.mjs 证明过)。
 * 立论依据:custom 格式把 TOC 与结束标记放在**文件尾部**,所以一次中途死掉的 pg_dump
 * 会留下一份"大小看着合理、ls 看不出问题"的文件 —— 只有 `pg_restore -l` 解析失败才看得见它。
 *
 * 四类判据(互不折叠):
 *  ① 预期 vs 实存(逐日):窗口天数**读自真正在跑的那份备份脚本**(先 `deploy/prod-bundle/pg-backup.ps1`,
 *    取不到再退到入库源 `deploy/win/ihui-pg-backup.ps1`),读不到才用 `--days`/兜底 7 并在输出里写明出处;
 *    窗口外某日没有文件 = 保留策略生效,刻意**不报**成故障(那是假警报,假警报的代价是这把尺子没人再看)。
 *  ② 逐文件完整性三态:`complete` / `truncated` / `undetermined` —— 三态绝不并桶,
 *    读不到的文件永不算通过(`classifyDump` 直接复用 pg-restore-drill 那份实现,不另写一遍)。
 *    同时记录 size / mtime / magic 前缀 / TOC 条数 / TABLE DATA 条数 / 源库版本。
 *  ③ "不是缺失"的异常:0 字节、相对邻日中位数骤缩(<50%)、同一天后一份比前一份小(>10%,
 *    失败的截断轮典型形态)、当日没在计划时刻落盘却在数小时后才落(调度器在重试/延迟)。
 *  ④ 单一诚实总结论:`ok` / `degraded` / `broken` / `undetermined` + 原因清单。
 *
 * 覆盖边界(如实登记,不得读成"备份链已被证明可用"):
 *  - 本工具只做**文件层** TOC 完整性;不证明每个压缩数据块可解压(那要 `pg-restore-drill --offline-verify`),
 *    更不证明服务端能接受还原(约束/扩展/权限)。
 *  - 云同步那一腿:能查到的是**本地同步目录**里有没有当日文件;百度网盘是否真上传,
 *    在本机结构上无从验证 ⇒ 一律报 `未判定:原因`,绝不冒充覆盖。
 *  - 命名族:目录里确有 `ihui_dev_YYYYMMDD_HHMMSS.dump`(每晚链)与 `ihui-dev-YYYYMMDD-HHMMSS.dump`
 *    (另一生产者 scripts/backup-pg-local.ps1)两族,外加旧的 `.sql.gz`。后两族**照实列出**:
 *    某日只有旁族文件 ⇒ `FOREIGN_ONLY`(degraded,不是 MISSING —— 数据在,只是不来自每晚那条链);
 *    `.sql.gz` 不属 dump 三态射程 ⇒ 单列 `excluded` 并说明为什么不判(拿 PGDMP 去判它必然假红)。
 *
 * 模式与退出码:
 *  默认 = 人读报告;`--json` = 单个可 parse 对象;`--strict` = 任何 degraded/broken/undetermined 都 exit 1
 *  (给轮排用)。退出码:0=ok(默认档下 degraded 也为 0,因为报告里已点名它);1=findings;
 *  2=无法判定(备份目录不可读 / 缺 pg_restore / 开关错)。**`--strict` 下 undetermined 归 1**,
 *  但输出行会写明原判读是 undetermined —— 二者处置动作不同,不得在结论里混成一个词。
 *
 * 与提交链的关系:**本工具没有接进任何钩子、CI、计划任务,也不是守门**。
 * 它是手动 / 轮排用的只读审计器(`stagedTriggers` 一类概念对它不适用)。名字刻意不以
 * `check-`/`scan-`/`guard-` 开头,以免被"守门接线对账"的候选集扫进去却无人调度。
 *
 * 硬约束:全程零写盘、零删除;派生一律绝对路径 + `windowsHide` + `timeout`(§5b/§26);
 * 不用 process.cwd() 定根;盘符不硬编码(`IHUI_BACKUP_PG_DIR` / `IHUI_PG_BIN_DIR` 覆盖名与
 * pg-restore-drill 保持同一对,那文件的 devEnvRoot()/pgBinDir() 是**私有**且本票禁止修改它,
 * 故此处只做同式推导,不复制凭据逻辑 —— 本工具压根不需要任何口令(`pg_restore -l` 不连库)。
 */
import { existsSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { classifyDump, DUMP_NAME_RE, todayYmd } from './pg-restore-drill.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const DASH_DUMP_RE = /^ihui-dev-(\d{8})-(\d{6})\.dump$/
const SQLGZ_RE = /^ihui[_-]dev[-_](\d{8})[-_](\d{6})\.sql\.gz$/

/** 阈值(写在这里而不是散在判据里,便于"为什么是这个数"被追问) */
export const THRESHOLDS = Object.freeze({
  shrinkRatio: 0.5, // 邻日中位数的一半以下 ⇒ 骤缩
  shrinkMinNeighbours: 2,
  shrinkRadius: 3,
  intraDayShrinkRatio: 0.9, // 同日后面那份 < 前面的 90% ⇒ 疑似截断轮
  tableDataDropRatio: 0.9,
  scheduleGraceHours: 2,
  defaultDays: 7,
})

// ────────────────────────────── 纯函数层(镜像测试打这里) ──────────────────────────────

/** 文件名 → {family,ymd,hms};family ∈ dump|dump-foreign|sqlgz|unrelated */
export function classifyFileName(name) {
  let m = DUMP_NAME_RE.exec(name)
  if (m) return { family: 'dump', ymd: m[1], hms: m[2] }
  m = DASH_DUMP_RE.exec(name)
  if (m) return { family: 'dump-foreign', ymd: m[1], hms: m[2] }
  m = SQLGZ_RE.exec(name)
  if (m) return { family: 'sqlgz', ymd: m[1], hms: m[2] }
  return { family: 'unrelated', ymd: null, hms: null }
}

/** YYYYMMDD ± n 天(UTC 算数,避开夏令时/时区漂移) */
export function shiftYmd(ymd, n) {
  if (!/^\d{8}$/.test(String(ymd))) throw new Error(`日期须为 8 位数字,实得 ${JSON.stringify(ymd)}`)
  const y = +ymd.slice(0, 4), mo = +ymd.slice(4, 6) - 1, d = +ymd.slice(6, 8)
  const t = new Date(Date.UTC(y, mo, d))
  t.setUTCDate(t.getUTCDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}`
}

/** 预期窗口:含今天,往前 days 天(升序) */
export function enumerateWindow(todayStr, days) {
  const n = Math.max(1, Number(days) || THRESHOLDS.defaultDays)
  return Array.from({ length: n }, (_, i) => shiftYmd(todayStr, -(n - 1 - i)))
}

/**
 * 缺席定性 —— 三态里最容易被做错的一格:窗口外没有文件是**保留策略在起作用**,
 * 报成故障就是假警报。今天且还没到过点 + 宽限,也不算缺失,算"未到期"。
 */
export function absenceKind(ymd, window, todayStr, nowHour, schedHour, grace = THRESHOLDS.scheduleGraceHours) {
  if (!window.includes(ymd)) return 'OUT_OF_RETENTION'
  if (ymd === todayStr && nowHour < schedHour + grace) return 'PENDING_TODAY'
  return 'MISSING'
}

/** 该日代表文件:最新的 complete;没有 complete 就退回时间最晚的那一份(它的三态仍要报) */
export function pickPrimary(files) {
  const inFamily = (files || []).filter((f) => f.family === 'dump')
  if (inFamily.length === 0) return null
  const byStamp = [...inFamily].sort((a, b) => (a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : 0))
  const complete = byStamp.filter((f) => f.verdict === 'complete')
  return (complete.length ? complete : byStamp).at(-1)
}

export function medianOf(nums) {
  const v = (nums || []).filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = v.length >> 1
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/**
 * 邻日中位数骤缩。series = 按日升序的 [{size}]。邻域取半径内、排除自身。
 * 邻数不足 ⇒ 'undetermined'(不冒红也不记绿);拿不到数字同理。
 */
export function judgeShrink(series, idx, t = THRESHOLDS) {
  const self = series[idx]
  if (!self || typeof self.size !== 'number') return { state: 'undetermined', reason: '代表文件量不到大小' }
  const nb = []
  for (let i = Math.max(0, idx - t.shrinkRadius); i < Math.min(series.length, idx + 1 + t.shrinkRadius); i++) {
    if (i === idx) continue
    const s = series[i]?.size
    if (typeof s === 'number' && s > 0) nb.push(s)
  }
  if (nb.length < t.shrinkMinNeighbours)
    return { state: 'undetermined', reason: `邻日样本仅 ${nb.length} 个(<${t.shrinkMinNeighbours}),骤缩规则本日不适用` }
  const med = medianOf(nb)
  if (!med) return { state: 'undetermined', reason: '邻日中位数为 0,无从比较' }
  const ratio = self.size / med
  return { state: ratio < t.shrinkRatio ? 'shrink' : 'ok', ratio, median: med, neighbours: nb.length }
}

/** 同日多份:后一份明显比前一份小 ⇒ 疑似失败轮截断(单调增长是常态,故只在"变小"时喊) */
export function judgeIntraDay(files, t = THRESHOLDS) {
  const dumps = (files || []).filter((f) => f.family === 'dump' && typeof f.size === 'number').sort((a, b) => (a.stamp < b.stamp ? -1 : 1))
  const out = []
  for (let i = 1; i < dumps.length; i++) {
    const prev = dumps[i - 1], cur = dumps[i]
    if (prev.size > 0 && cur.size < prev.size * t.intraDayShrinkRatio)
      out.push({ code: 'INTRA_DAY_SHRINK', severity: 'degraded', text: `${cur.name} (${cur.size} B) 比同日更早的 ${prev.name} (${prev.size} B) 小 ${(100 - (cur.size / prev.size) * 100).toFixed(1)}% —— 失败的截断轮形态`, at: cur.name })
  }
  return out
}

/** 落盘时刻是否在计划窗口内(注意:同日多轮时,只要**任一份**落在窗口内就算在点 —— 实测 09-25 有 8 份、最早 02:21,若只看最早那份会误判成"没在点") */
export function judgeLanding(files, schedHour, t = THRESHOLDS) {
  const dumps = (files || []).filter((f) => f.family === 'dump')
  if (dumps.length === 0) return { state: 'none' }
  const hours = dumps.map((f) => Number(f.hms.slice(0, 2)))
  const lo = schedHour, hi = schedHour + t.scheduleGraceHours
  if (hours.some((h) => h >= lo && h <= hi)) return { state: 'on-schedule', hours }
  if (hours.every((h) => h > hi)) return { state: 'late', hours }
  return { state: 'off-window', hours }
}

/**
 * 源库版本漂移:同一窗口内出现 >1 个版本 ⇒ 观察项(升降级本身不是故障,但必须看得见)。
 * 参照档取**最近一日**的版本,不取"出现次数最多的版本" —— 窗口中段做过一次升级时,
 * 新旧档常常各占一半,众数在平票时全凭排序稳定性决定,报告会在两台服务器版本里随机挑一个当"多数"。
 * 要还原的目标是当下这台库,所以"与最近一日不同"才是有意义的措辞。
 */
export function judgeVersionDrift(series) {
  const seen = (series || []).filter((s) => s && s.dbVersion)
  const distinct = [...new Set(seen.map((s) => s.dbVersion))]
  if (distinct.length < 2) return { distinct, drift: false, reference: distinct[0] || null, odd: [] }
  const reference = seen.at(-1).dbVersion
  const odd = seen.filter((s) => s.dbVersion !== reference).map((s) => `${s.ymd}=${s.dbVersion}`)
  return { distinct, drift: odd.length > 0, reference, odd }
}

/** TABLE DATA 条数骤降(相对邻日中位数)——表没少才是"数据在长"的正常形态 */
export function judgeTableDrift(series, t = THRESHOLDS) {
  const out = []
  series.forEach((s, i) => {
    if (typeof s.tableDataCount !== 'number') return
    const nb = []
    for (let j = Math.max(0, i - t.shrinkRadius); j < Math.min(series.length, i + 1 + t.shrinkRadius); j++) {
      if (j === i) continue
      const v = series[j]?.tableDataCount
      if (typeof v === 'number' && v > 0) nb.push(v)
    }
    const med = medianOf(nb)
    if (nb.length >= t.shrinkMinNeighbours && med && s.tableDataCount < med * t.tableDataDropRatio)
      out.push({ code: 'TABLE_DATA_DROP', severity: 'degraded', text: `${s.ymd} TABLE DATA ${s.tableDataCount} 条,邻日中位数 ${med} —— 少表通常意味着 dump 范围或库结构变了`, day: s.ymd })
  })
  return out
}

/** 逐日状态rollup:优先级 MISSING > TRUNCATED > UNDETERMINED > FOREIGN_ONLY > ok */
export function judgeDay({ ymd, files, window, todayStr, nowHour, schedHour, integrityOnly = false }) {
  const dumps = (files || []).filter((f) => f.family === 'dump')
  const foreign = (files || []).filter((f) => f.family === 'dump-foreign')
  const kind = absenceKind(ymd, window, todayStr, schedHour === undefined ? 99 : nowHour, schedHour ?? 3)
  if (dumps.length === 0) {
    if (kind === 'OUT_OF_RETENTION') return { ymd, status: 'OUT_OF_RETENTION', findings: [], notes: [], kind }
    if (foreign.length > 0) return { ymd, status: 'FOREIGN_ONLY', findings: [{ code: 'FOREIGN_ONLY', severity: 'degraded', text: `${ymd} 只有旁族 dump(${foreign.map((f) => f.name).join(', ')},生产者不同),每晚链本日无产出` }], notes: [], kind }
    if (kind === 'PENDING_TODAY') return { ymd, status: 'PENDING_TODAY', findings: [], notes: ['今日计划时刻+宽限未到,尚无文件属正常'], kind }
    return { ymd, status: 'MISSING', findings: [{ code: 'MISSING', severity: 'broken', text: `${ymd} 保留窗口内无任何 dump` }], notes: [], kind }
  }
  const counts = { complete: 0, truncated: 0, undetermined: 0 }
  for (const f of dumps) counts[f.verdict] = (counts[f.verdict] || 0) + 1
  const findings = integrityOnly ? [] : judgeIntraDay(dumps)
  const notes = []
  if (dumps.length > 1) notes.push(`本日 ${dumps.length} 份(同日多轮 = 调度器被重启或在重试;本身不算故障,但值得一查)`)
  if (counts.truncated > 0 && counts.complete > 0)
    findings.push({ code: 'TRUNCATED_WITH_GOOD', severity: 'degraded', text: `${ymd} 有 ${counts.truncated} 份截断/损坏、${counts.complete} 份完整 —— 当日仍可恢复,但失败轮就在这一天` })
  else if (counts.truncated > 0)
    findings.push({ code: 'TRUNCATED_ONLY', severity: 'broken', text: `${ymd} 无一份完整:${counts.truncated} 份判为截断/损坏` })
  else if (counts.undetermined > 0)
    findings.push({ code: 'UNDETERMINED_ONLY', severity: 'undetermined', text: `${ymd} 无一份判为完整,余下 ${counts.undetermined} 份判不出(读不到/缺 pg_restore/派生失败)` })
  let status = 'ok'
  if (counts.truncated > 0) status = counts.complete > 0 ? 'ok-with-truncated' : 'TRUNCATED'
  else if (counts.undetermined > 0 && counts.complete === 0) status = 'UNDETERMINED'
  const land = judgeLanding(dumps, schedHour ?? 3)
  if (land.state === 'late') findings.push({ code: 'LATE_LAND', severity: 'degraded', text: `${ymd} 没在计划 ${String(schedHour).padStart(2, '0')}:00±${THRESHOLDS.scheduleGraceHours}h 落盘,最早落在 ${land.hours.slice().sort((a, b) => a - b)[0]}:xx —— 调度器延迟或在重试` })
  else if (land.state === 'off-window') findings.push({ code: 'OFF_WINDOW_LAND', severity: 'degraded', text: `${ymd} 落盘时刻 ${land.hours.join('/')} 全在计划窗口外(常见于服务启动即备份那一轮)` })
  return { ymd, status, findings, notes, counts, kind, landing: land, foreign: foreign.length }
}

/** 总结论:undetermined 优先于 broken —— 判不出比"判出问题"更该先被处理,因为它否证的是这把尺子本身 */
export function decideVerdict(days, extraFindings = []) {
  const all = []
  for (const d of days) all.push(...(d.findings || []))
  all.push(...extraFindings)
  const has = (sev) => all.some((f) => f.severity === sev)
  const codes = (sev) => all.filter((f) => f.severity === sev).map((f) => f.code)
  if (has('undetermined')) return { verdict: 'undetermined', reasons: [...new Set(codes('undetermined'))], findings: all }
  if (has('broken')) return { verdict: 'broken', reasons: [...new Set([...codes('broken'), ...codes('degraded')])], findings: all }
  if (has('degraded')) return { verdict: 'degraded', reasons: [...new Set(codes('degraded'))], findings: all }
  return { verdict: 'ok', reasons: [], findings: [] }
}

export function exitCodeFor(verdict, strict) {
  if (verdict === 'ok') return 0
  if (verdict === 'broken') return 1
  if (verdict === 'degraded') return strict ? 1 : 0
  return strict ? 1 : 2 // undetermined
}

/** 备份脚本里的保留天数($retentionDays = N)与计划时刻(-Hour N) */
export function parseRetention(text) {
  const m = /\$retentionDays\s*=\s*(\d+)/.exec(String(text || ''))
  return m ? Number(m[1]) : null
}
export function parseScheduleHour(text) {
  const m = /-Hour\s+(\d+)\b/.exec(String(text || ''))
  return m ? Number(m[1]) : null
}
export function parseCloudDir(text) {
  const m = /\$cloudDir\s*=\s*["']([^"']+)["']/.exec(String(text || ''))
  return m ? m[1].trim() : null
}

/** 5 字节 magic **前缀**(不是布尔)——报告要把实际字节给人看,与 pg-restore-drill 私有的 readMagic(返回 bool)不是同一计算 */
export function magicPrefixOf(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 5 ? buf.toString('latin1', 0, 5) : null
}

export function parseCliArgs(argv) {
  const flags = new Set(['--json', '--strict', '--self-test', '--help'])
  const seen = (argv || []).filter((a) => String(a).startsWith('-'))
  for (const f of seen) {
    if (flags.has(f)) continue
    if (f === '--days' || f.startsWith('--days=')) continue
    return { error: `未知开关:${f}(仅 ${[...flags].join(' / ')} / --days N;--dir 请改用环境变量 IHUI_BACKUP_PG_DIR)` }
  }
  let days = null
  const di = (argv || []).findIndex((a) => a === '--days')
  if (di >= 0) {
    const v = argv[di + 1]
    if (v === undefined || !/^\d+$/.test(String(v))) return { error: `--days 需要一个正整数,实得 ${JSON.stringify(v)}` }
    days = Number(v)
  }
  const eq = (argv || []).find((a) => a.startsWith('--days='))
  if (eq) {
    const v = eq.slice('--days='.length)
    if (!/^\d+$/.test(v)) return { error: `--days 需要一个正整数,实得 ${JSON.stringify(v)}` }
    days = Number(v)
  }
  const positional = (argv || []).filter((a) => !String(a).startsWith('-') && !/^\d+$/.test(String(a)))
  if (positional.length) return { error: `不接受位置参数(实得 ${positional.join(' ')})` }
  return { json: seen.includes('--json'), strict: seen.includes('--strict'), selfTest: seen.includes('--self-test'), help: seen.includes('--help'), days }
}

// ────────────────────────────── IO 层 ──────────────────────────────

function devEnvRoot() {
  return join(resolve(repoRoot, '..', '..'), 'DevEnv')
}
function pgBinDir() {
  return process.env.IHUI_PG_BIN_DIR || join(devEnvRoot(), 'runtimes', 'pgsql', 'bin')
}
function backupPgDir() {
  return process.env.IHUI_BACKUP_PG_DIR || join(devEnvRoot(), 'backups', 'pg')
}

const EXEC_CANDIDATES = ['deploy/prod-bundle/pg-backup.ps1', 'deploy/win/ihui-pg-backup.ps1']
const SCHED_CANDIDATES = ['deploy/prod-bundle/pg-backup-scheduler.ps1', 'deploy/win/ihui-pg-backup-scheduler.ps1']

/** 先读"服务实际执行的那份",再退入库源;两处都没有才算读不到(§5e:按实际执行体取径) */
function readConfigFrom(first, second, pick) {
  for (const rel of [first, second]) {
    try {
      const text = readFileSync(join(repoRoot, rel), 'utf8')
      const v = pick(text)
      if (v !== null && v !== undefined) return { value: v, source: rel }
    } catch {
      /* 换机 / 非部署机:prod-bundle 整目录被 gitignore,不存在是常态 */
    }
  }
  return { value: null, source: null }
}

function readMagic(path, n = 5) {
  try {
    const fd = openSync(path, 'r')
    try {
      const buf = Buffer.alloc(n)
      const got = readSync(fd, buf, 0, n, 0)
      return got >= n ? buf : null
    } finally {
      closeSync(fd)
    }
  } catch {
    return null
  }
}

/** 目录清单 → [{name,size,mtimeMs}];单项 stat 失败不整批丢,只把该记成读不到 */
function listDir(dir) {
  let names = []
  try {
    names = readdirSync(dir)
  } catch (e) {
    return { error: `备份目录不可读: ${dir} (${e.message})`, items: [] }
  }
  const items = []
  for (const name of names) {
    const cls = classifyFileName(name)
    if (cls.family === 'unrelated') continue
    const p = join(dir, name)
    let st = null
    try {
      st = statSync(p)
    } catch {
      /* fallthrough */
    }
    items.push({
      name,
      path: p,
      family: cls.family,
      ymd: cls.ymd,
      hms: cls.hms,
      stamp: cls.ymd && cls.hms ? cls.ymd + cls.hms : '',
      size: st && st.isFile() ? st.size : undefined,
      mtimeMs: st ? st.mtimeMs : undefined,
      statError: st ? null : 'stat 失败(文件被占用或已消失)',
    })
  }
  return { items }
}

/** TOC 解析:除条数外还量 源库版本 / 归档时刻 —— 跨日对比的信号来源(与 pg-restore-drill 私有的同名逻辑不同,那一份不返回版本) */
function parseTocMeta(stdout) {
  const head = (re) => (re.exec(stdout) || [])[1]
  let tableDataCount = 0
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const m = /^(\d+); (\d+) (\d+) TABLE DATA (\S+) (\S+) /.exec(line)
    if (m && m[4] !== '-') tableDataCount++
  }
  const tocEntries = Number(head(/;\s*TOC Entries:\s*(\d+)/) ?? NaN)
  return {
    tocEntries: Number.isFinite(tocEntries) ? tocEntries : null,
    dbVersion: head(/;\s*Dumped from database version:\s*([\d.]+)/) || null,
    archiveCreatedAt: head(/;\s*Archive created at\s+(.+?)\s*$/m) || null,
    tableDataCount,
  }
}

/** 逐文件完整性三态:classifyDump 复用 pg-restore-drill,不重写 */
function auditFile(item, ctx) {
  const base = { name: item.name, family: item.family, ymd: item.ymd, hms: item.hms, stamp: item.stamp, size: item.size, mtimeISO: item.mtimeMs ? new Date(item.mtimeMs).toISOString() : null }
  if (item.family === 'sqlgz') {
    return { ...base, verdict: 'excluded', reasons: ['旧 .sql.gz 形态,非本链 pg_dump -Fc 产物;拿 PGDMP/-l 判它必然假红 ⇒ 完整性未判,单列不参与三态'] }
  }
  if (item.statError || typeof item.size !== 'number') {
    return { ...base, verdict: 'undetermined', reasons: [item.statError || '量不到大小'] }
  }
  const buf = readMagic(item.path)
  const magic = magicPrefixOf(buf)
  const magicOk = magic === 'PGDMP'
  let toc = null
  let tocMeta = null
  if (!ctx.binExists) {
    return { ...base, magicPrefix: magic, verdict: 'undetermined', reasons: [`pg_restore 不在位(${ctx.pgRestore}),TOC 未判 ⇒ 该文件不算通过`] }
  }
  try {
    const r = ctx.run([ctx.pgRestore, '-l', item.path])
    toc = { rc: r.rc }
    if (r.rc === 0) {
      tocMeta = parseTocMeta(r.stdout)
      toc.tocEntries = tocMeta.tocEntries
      toc.tableDataCount = tocMeta.tableDataCount
    }
  } catch (e) {
    return { ...base, magicPrefix: magic, verdict: 'undetermined', reasons: [`pg_restore -l 派生失败: ${e.message}`] }
  }
  const c = classifyDump({ exists: true, size: item.size, magicOk, toc })
  return { ...base, magicPrefix: magic, verdict: c.verdict, reasons: c.reasons, toc: tocMeta, tocRc: toc.rc, tocStderr: toc.rc === 0 ? null : undefined }
}

/** 云同步那一腿:只看本地同步目录里当日有没有文件;远端上传与否一律未判定 */
function auditCloud(cloudDir, window) {
  const note = '未判定:百度网盘是否真的收到这些文件,在本机结构上无从验证(同步目录里有文件 ≠ 已上传成功)'
  if (!cloudDir) return { dir: null, state: 'undetermined', perDay: [], note: '未判定:备份脚本里读不到 $cloudDir(可能该腿已移除)' }
  let names = []
  try {
    names = readdirSync(cloudDir)
  } catch (e) {
    return { dir: cloudDir, state: 'undetermined', perDay: [], note: `未判定:本地同步目录不可读(${cloudDir}: ${e.message})——非部署机/网盘未挂载是常态,不等于云备份坏了` }
  }
  const ymds = new Set(names.map((n) => classifyFileName(n).ymd).filter(Boolean))
  const perDay = window.map((ymd) => ({ ymd, present: ymds.has(ymd) }))
  return { dir: cloudDir, state: 'scanned', totalFiles: names.length, perDay, note }
}

// ────────────────────────────── 组装 ──────────────────────────────

function buildReport(opts) {
  const { cli, deps } = opts
  const dir = deps.backupDir || backupPgDir()
  const bins = deps.bins || {}
  const pgRestore = bins.pgRestore || join(pgBinDir(), 'pg_restore.exe')
  const binExists = deps.binExists ?? existsSync(pgRestore)
  const now = deps.now ? new Date(deps.now) : new Date()
  const today = deps.ymd || todayYmd(now)
  const nowHour = now.getHours()

  const ret = readConfigFrom(EXEC_CANDIDATES[0], EXEC_CANDIDATES[1], parseRetention)
  const sched = readConfigFrom(SCHED_CANDIDATES[0], SCHED_CANDIDATES[1], parseScheduleHour)
  const cloud = readConfigFrom(EXEC_CANDIDATES[0], EXEC_CANDIDATES[1], parseCloudDir)
  const days = cli.days || ret.value || THRESHOLDS.defaultDays
  const daysSource = cli.days ? '--days 参数(覆盖脚本值)' : ret.source ? `${ret.source}:$retentionDays` : `兜底 ${THRESHOLDS.defaultDays}(两份备份脚本都读不到 $retentionDays)`
  // deps.* 覆盖点是**测试通道**:镜像测试要能造出确定性的窗口/时刻/云目录,
  // 又不必为此去读真机的网盘目录(那会让测试结果随机器状态漂)。生产调用不传,语义不变。
  const schedHour = deps.scheduleHour ?? sched.value ?? 3
  const schedSource = deps.scheduleHour !== undefined ? `${deps.scheduleHour}(调用方注入)` : sched.value !== null ? `${sched.source}:-Hour ${sched.value}` : `兜底 03:00(调度脚本读不到 -Hour;窗口判定按默认值,已在原因里注明)`
  const cloudDir = deps.cloudDir !== undefined ? deps.cloudDir : cloud.value

  const listing = listDir(dir)
  const meta = { backupDir: dir, days, daysSource, scheduleHour: schedHour, scheduleSource: schedSource, pgRestore, binExists, today, generatedAt: now.toISOString(), cloudDirSource: deps.cloudDir !== undefined ? '(注入)' : cloud.source }
  if (listing.error)
    return { ...meta, fatal: { code: 'NO_DIR', text: listing.error }, verdict: 'undetermined', reasons: ['NO_DIR'], files: [], days_: [], cloud: null, exitCode: cli.strict ? 1 : 2 }
  if (!binExists) {
    // 没有尺子 ⇒ 全部未判定,不得把"没判"写成"通过"
    meta.binariesMissingNote = `无法判定:找不到 pg_restore(${pgRestore});可用 IHUI_PG_BIN_DIR 覆盖。本轮所有 .dump 的 TOC 均未判。`
  }

  const ctx = {
    binExists,
    pgRestore,
    run:
      deps.run ||
      ((argv) => {
        const r = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: deps.tocTimeoutMs ?? 60_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
        if (r.error) throw r.error
        return { rc: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
      }),
  }
  const files = listing.items.map((it) => auditFile(it, ctx))

  const byDay = new Map()
  for (const f of files) {
    if (!f.ymd) continue
    if (!byDay.has(f.ymd)) byDay.set(f.ymd, [])
    byDay.get(f.ymd).push(f)
  }
  const window = enumerateWindow(today, days)
  const scope = [...new Set([...window, ...[...byDay.keys()].filter((y) => !window.includes(y))])].sort()
  const dayRows = scope.map((ymd) => judgeDay({ ymd, files: byDay.get(ymd) || [], window, todayStr: today, nowHour, schedHour }))
  const inWindow = dayRows.filter((d) => window.includes(d.ymd))
  const outRows = dayRows.filter((d) => !window.includes(d.ymd))

  const series = inWindow
    .map((d) => {
      const p = pickPrimary(byDay.get(d.ymd) || [])
      return p ? { ymd: d.ymd, size: p.size, tableDataCount: p.toc?.tableDataCount ?? null, dbVersion: p.toc?.dbVersion ?? null, name: p.name } : { ymd: d.ymd, size: null }
    })

  const extra = []
  series.forEach((s, i) => {
    const j = judgeShrink(series, i)
    if (j.state === 'shrink') extra.push({ code: 'SIZE_SHRINK', severity: 'degraded', day: s.ymd, text: `${s.ymd} 代表文件 ${s.name} 仅 ${s.size} B,为邻日中位数 ${Math.round(j.median)} B 的 ${(j.ratio * 100).toFixed(1)}% —— 骤缩` })
    s.shrink = j
  })
  extra.push(...judgeTableDrift(series))
  const zeroByte = files.filter((f) => f.family === 'dump' && f.size === 0)
  for (const f of zeroByte) extra.push({ code: 'ZERO_BYTE', severity: 'broken', day: f.ymd, text: `${f.name} 为 0 字节` })

  const cloudRes = auditCloud(cloudDir, window)
  const cloudFindings = []
  if (cloudRes.state === 'scanned') {
    for (const p of cloudRes.perDay) {
      const localHas = (byDay.get(p.ymd) || []).some((f) => f.family === 'dump')
      if (localHas && !p.present) cloudFindings.push({ code: 'CLOUD_COPY_ABSENT', severity: 'degraded', day: p.ymd, text: `${p.ymd} 本地有 dump 而云同步目录里没有(该腿当日没跑成或被清过);远端是否收到另计未判定` })
    }
  } else {
    cloudFindings.push({ code: 'CLOUD_UNDETERMINED', severity: 'undetermined', text: cloudRes.note })
  }

  const vdays = [...inWindow, ...outRows.map((d) => ({ ...d, findings: [] }))]
  const dec = decideVerdict(vdays, [...extra, ...cloudFindings])
  const observations = []
  const vd = judgeVersionDrift(series)
  if (vd.drift) observations.push(`源库版本在本窗口内不唯一:${vd.distinct.join(' / ')};以最近一日(${vd.reference})为参照,来自别的版本档的日子:${vd.odd.join(', ')} —— 升级/降级会在 TOC 里留下这个指纹,是信号不是故障`)
  if (series.some((s) => s.shrink?.state === 'undetermined'))
    observations.push(`骤缩规则在 ${series.filter((s) => s.shrink?.state === 'undetermined').length} 个日子判不出(邻日样本不足)——已按"未判定"处理,不算通过`)
  const excluded = files.filter((f) => f.verdict === 'excluded')
  if (excluded.length) observations.push(`${excluded.length} 份 .sql.gz 旧形态未参与三态判定:${excluded.map((f) => f.name).join(', ')}`)
  if (outRows.length) observations.push(`窗口之外还在目录里的日子:${outRows.map((d) => d.ymd).join(', ')}(保留策略之外,只列出)`)

  return {
    ...meta,
    window,
    verdict: dec.verdict,
    reasons: dec.reasons,
    findings: dec.findings.map((f) => ({ ...f })),
    observations,
    cloud: cloudRes,
    dayRows: inWindow,
    outOfWindowDays: outRows,
    series,
    files,
    exitCode: exitCodeFor(dec.verdict, cli.strict),
  }
}

export function renderHuman(r) {
  const L = []
  if (r.fatal) {
    L.push(`── pg-backup-cadence-audit ──`)
    L.push(`❌ 无法判定:${r.fatal.text}`)
    L.push(`▶ 结论: ${r.verdict}(退出码 ${r.exitCode})`)
    return L.join('\n')
  }
  L.push(`── pg-backup-cadence-audit ── 生成于 ${r.generatedAt}`)
  L.push(`   备份目录: ${r.backupDir}`)
  L.push(`   窗口: 最近 ${r.days} 天(${r.window[0]} … ${r.window.at(-1)}),天数出处 ${r.daysSource}`)
  L.push(`   计划时刻: ${String(r.scheduleHour).padStart(2, '0')}:00 ±${THRESHOLDS.scheduleGraceHours}h,出处 ${r.scheduleSource}`)
  L.push(`   pg_restore: ${r.pgRestore} ${r.binExists ? '在位' : '❌ 不在位'}`)
  if (r.binariesMissingNote) L.push(`   ⚠ ${r.binariesMissingNote}`)
  L.push('')
  const icon = { ok: '✅', 'ok-with-truncated': '⚠', TRUNCATED: '❌', MISSING: '❌', UNDETERMINED: '⚠', FOREIGN_ONLY: '⚠', PENDING_TODAY: '·', OUT_OF_RETENTION: '·' }
  L.push('① 逐日(窗口内)')
  for (const d of r.dayRows) {
    const p = pickPrimary(r.files.filter((f) => f.ymd === d.ymd))
    const tail = p ? ` 代表 ${p.name} ${(p.size / 1048576).toFixed(1)}MB TOC=${p.toc?.tocEntries ?? '—'} TABLEDATA=${p.toc?.tableDataCount ?? '—'} 源库=${p.toc?.dbVersion ?? '—'} 完整性=${p.verdict} 骤缩判=${p ? (r.series.find((s) => s.ymd === d.ymd)?.shrink?.state ?? '—') : '—'}` : ''
    L.push(`  ${icon[d.status] || '?'} ${d.ymd}  ${d.status.padEnd(18)}${tail}`)
    for (const f of r.files.filter((x) => x.ymd === d.ymd && x.family === 'dump' && x.verdict !== 'complete'))
      L.push(`      · ${f.name} ${f.verdict} size=${f.size ?? '—'}B magic=${JSON.stringify(f.magicPrefix ?? null)} —— ${(f.reasons || []).join('; ')}`)
    for (const n of d.notes || []) L.push(`      注: ${n}`)
  }
  L.push('')
  L.push('② 发现(findings)')
  if (r.findings.length === 0) L.push('  (无)')
  for (const f of r.findings) L.push(`  [${f.severity}] ${f.code}${f.day ? ` @${f.day}` : ''}: ${f.text}`)
  L.push('')
  L.push('③ 云同步腿(异地容灾)')
  if (r.cloud) {
    L.push(`  本地同步目录: ${r.cloud.dir || '(未配置)'} —— 目录内 ${r.cloud.totalFiles ?? 0} 个文件`)
    if (r.cloud.state === 'scanned') L.push(`  逐日在位: ${r.cloud.perDay.map((p) => `${p.ymd.slice(4)}:${p.present ? '有' : '无'}`).join('  ')}`)
    L.push(`  ${r.cloud.note}`)
  }
  L.push('')
  L.push('④ 观察项(不是判定,但别让它悄悄过去)')
  if (r.observations.length === 0) L.push('  (无)')
  for (const o of r.observations) L.push(`  · ${o}`)
  L.push('')
  L.push(`▶ 结论: ${r.verdict}${r.reasons.length ? ` —— ${r.reasons.join(', ')}` : ''} (退出码 ${r.exitCode})`)
  L.push('   覆盖边界: 只判文件层 TOC 完整性;不证明数据块可解压(→ pg-restore-drill --offline-verify)、')
  L.push('   不证明服务端接受还原、不证明网盘真上传成功。')
  return L.join('\n')
}

function main(argv = [], deps = {}) {
  const cli = parseCliArgs(argv)
  if (cli.error) return { code: 2, out: { error: cli.error }, json: false }
  if (cli.help) return { code: 0, out: { help: '用法: node scripts/pg-backup-cadence-audit.mjs [--days N] [--json] [--strict]' }, json: false }
  const out = buildReport({ cli, deps })
  // json 标志必须随返回值一起出去 —— 早先它留在 cli 里,打印点读不到,于是 --json 形同没实现
  return { code: out.exitCode ?? 2, out, json: !!cli.json }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    const r = main(process.argv.slice(2))
    if (r.out && r.out.error) {
      console.error(`❌ ${r.out.error}`)
      console.error('用法: node scripts/pg-backup-cadence-audit.mjs [--days N] [--json] [--strict]')
    } else if (r.out && r.out.help) console.info(r.out.help)
    else console.info(r.json ? JSON.stringify(r.out) : renderHuman(r.out))
    process.exit(r.code)
  } catch (e) {
    console.error(`❌ 脚本自身异常: ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  main,
  buildReport,
  renderHuman,
  classifyFileName,
  classifyDump,
  enumerateWindow,
  shiftYmd,
  absenceKind,
  pickPrimary,
  medianOf,
  judgeShrink,
  judgeIntraDay,
  judgeLanding,
  judgeDay,
  judgeVersionDrift,
  judgeTableDrift,
  decideVerdict,
  exitCodeFor,
  parseRetention,
  parseScheduleHour,
  parseCloudDir,
  magicPrefixOf,
  parseTocMeta,
  parseCliArgs,
  THRESHOLDS,
  DUMP_NAME_RE,
  DASH_DUMP_RE,
  SQLGZ_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
