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
 *  ① 预期 vs 实存(逐日**逐库**):窗口天数**读自真正在跑的那份备份脚本**(先 `deploy/prod-bundle/pg-backup.ps1`,
 *    取不到再退到入库源 `deploy/win/ihui-pg-backup.ps1`),读不到才用 `--days`/兜底 7 并在输出里写明出处;
 *    窗口外某日没有文件 = 保留策略生效,刻意**不报**成故障(那是假警报,假警报的代价是这把尺子没人再看)。
 *  ② 逐文件完整性三态:`complete` / `truncated` / `undetermined` —— 三态绝不并桶,
 *    读不到的文件永不算通过(`classifyDump` 直接复用 pg-restore-drill 那份实现,不另写一遍)。
 *    同时记录 size / mtime / magic 前缀 / TOC 条数 / TABLE DATA 条数 / 源库版本。
 *  ③ "不是缺失"的异常:0 字节、相对邻日中位数骤缩(<50%)、同一天后一份比前一份小(>10%,
 *    失败的截断轮典型形态)、当日没在计划时刻落盘却在数小时后才落(调度器在重试/延迟)。
 *  ④ 单一诚实总结论:`ok` / `degraded` / `broken` / `undetermined` + 原因清单。
 *  ⑤ 审计面自身的诚实性(2026-09-28 补):库清单解析不出来 ⇒ `BACKUP_LIST_UNDETERMINED`(undetermined),
 *     且**审计面直接为空**(不留默认库)。这一类优先于"缺席"结论 —— 一把只审了半个面的尺子给出 MISSING/ok 都没有意义。
 *
 * 覆盖边界(如实登记,不得读成"备份链已被证明可用"):
 *  - 本工具只做**文件层** TOC 完整性;不证明每个压缩数据块可解压(那要 `pg-restore-drill --offline-verify`),
 *    更不证明服务端能接受还原(约束/扩展/权限)。
 *  - 云同步那一腿:能查到的是**本地同步目录**里有没有当日文件;百度网盘是否真上传,
 *    在本机结构上无从验证 ⇒ 一律报 `未判定:原因`,绝不冒充覆盖。
 *  - **审计的库清单读自被审 runner 本身**(`$backupDatabases = @(...)`,2026-09-28 起含 keycloak),
 *    不在本工具里写死库名。三条口径:
 *      ① 那一行解析不到 / 项里既不是引号字面量也不是 `$dbName` / `$dbName` 的兜底行不在同一份文件里
 *        ⇒ 结论 **`未判定:备份清单无从解析`**,并且**一个库都不审** —— 本工具不保留任何硬编码默认库,
 *        因为"退回单个库"正是收窄审计面这一型事故的载体(它曾让 keycloak 从所有序列里消失);
 *        此时逐日表只记 `UNAUDITED`(不判缺席也不判齐),目录里长得像备份档的文件逐条**报名**进观察项。
 *      ② 命名族按**每个库**识别:`<库名>_<日期>_<时刻>.dump` = 每晚链(dash 族 `<库名>-<日期>-<时刻>.dump`
 *        与 `.sql.gz` 另归旁生产者/旧形态)。目录里名字不在清单内、却长得像备份档(`*.dump` / `*.sql.gz`)的文件
 *        ⇒ 逐条**报名**进观察项(不判红:新加一个库却没改 runner 属另一种事故,得由人定性)。
 *      ③ **统计一律按库分开算** —— 0.2 MB 的 keycloak 档与 104 MB 的 ihui_dev 档混进同一条序列,
 *        "骤缩 <邻日中位数 50%"每天都必红,那把尺子当场作废。缺席判定、同日多份、邻日骤缩、
 *        TABLE DATA 骤降、源库版本漂移、云腿逐日在位,六项全部逐库。
 *  - **新库不得造出追溯性假红**:每个库的起判日 = 该库在审计目录里**实存的第一份档**所在日
 *    (早于窗口首日则夹到窗口首日),不是脚本里手工维护的 "since" 日期。起判日之前的窗口日子记
 *    `PRE_START`(点名"这一天不判缺席是因为那时还没开始备",不是静默跳过),报告必须把起判日写出来。
 *    反向:声明在清单里、目录却一份都没有的库 ⇒ 起判日 = 窗口首日,缺席照常 MISSING(broken)——
 *    "runner 说它在备,目录里没有" 恰是本工具该喊的那一句。
 *  - 日期超前(文件名日期晚于窗口末日)的库 ⇒ 本窗口不判它缺席,只列观察,由人看是不是时钟/文件名出了问题。
 *  - 命名族语义(逐库套用,不再是写死的 `ihui` 前缀):dash 族 `<库名>-…dump` 出自另一生产者
 *    scripts/backup-pg-local.ps1,某日该库只有旁族文件 ⇒ `FOREIGN_ONLY`(degraded,不是 MISSING ——
 *    数据在,只是不来自每晚那条链);`.sql.gz` 不属 dump 三态射程 ⇒ 单列 `excluded` 并说明为什么不判
 *    (拿 PGDMP 去判它必然假红)。FOREIGN 的归属是**它自己那个库**,不得拿去替别的库作证。
 *
 * 模式与退出码:
 *  默认 = 人读报告;`--json` = 单个可 parse 对象;`--strict` = 任何 degraded/broken/undetermined 都 exit 1
 *  (给轮排用)。退出码:0=ok(默认档下 degraded 也为 0,因为报告里已点名它);1=findings;
 *  2=无法判定(备份目录不可读 / 缺 pg_restore / 开关错)。**`--strict` 下 undetermined 归 1**,
 *  但输出行会写明原判读是 undetermined —— 二者处置动作不同,不得在结论里混成一个词。
 *  `--self-test` **不在本进程内跑判据**(取证在镜像测试里,那里才有注入的假 pg_restore 与临时目录);
 *  它只打印那条真跑得通的命令并 exit 0 —— 这一枚 0 **不等于"已验证"**,别把它当合格证。
 *
 * 与提交链的关系:**本工具没有接进任何钩子、CI、计划任务,也不是守门**。
 * 它是手动 / 轮排用的只读审计器(`stagedTriggers` 一类概念对它不适用)。名字刻意不以
 * `check-`/`scan-`/`guard-` 开头,以免被"守门接线对账"的候选集扫进去却无人调度。
 *
 * 硬约束:全程零写盘、零删除;派生一律绝对路径 + `windowsHide` + `timeout`(§5b/§26);
 * 不用 process.cwd() 定根;盘符不硬编码 —— 外置根一律走 §15b 唯一出口
 * `scripts/seal-c-root-stray.mjs` 的 `devEnvRoot()`(`IHUI_DEVENV_ROOT` 是它的换机逃生舱)。
 * `IHUI_BACKUP_PG_DIR` / `IHUI_PG_BIN_DIR` 两条覆盖名与 pg-restore-drill 保持同一对;
 * 该文件的私有 devEnvRoot 已由 `9716902474` 收口到同一个出口,所以本文件也不再自己数层
 * 推盘根(旧注释称"那文件是私有的、本票禁止修改,故此处只做同式推导" —— 那句话已随之一并作废,
 * 留着它会教下一个人照旧写法再抄一份)。本工具压根不需要任何口令(`pg_restore -l` 不连库),
 * 故不复制凭据逻辑。
 */
import { existsSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { classifyDump, DUMP_NAME_RE, todayYmd } from './pg-restore-drill.mjs'
// 外置根的唯一出口(§15b)—— 与 pg-restore-drill / sync-prometheus-live-config 同源。
import { devEnvRoot } from './seal-c-root-stray.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 这里**没有**任何"默认库名"。审计面只来自 `parseBackupDatabases`(读被执行的那份 runner),
 * 解析不出就是一个库都不审 ⇒ 未判定。留一个兜底库名 = 留一条静默缩面的路,
 * 而"清单里有 keycloak、账面却只看 ihui_dev"正是本工具的立项事故(G-297)。
 */

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** 库里带下划线时,dash 族/旧族把它写成 `ihui-dev`,所以这两个族按 `[-_]` 逐位放宽(仍是同一份实现产出的模式) */
const altRe = (db) => escapeRe(db).replace(/_/g, '[-_]')

/** 每晚链的命名:<库名>_<YYYYMMDD>_<HHMMSS>.dump —— 对 drill 的 DUMP_NAME_RE 所用的那个库逐字复现(成对锁在镜像测试里) */
export function dumpNameReFor(db) {
  return new RegExp(`^${escapeRe(db)}_(\\d{8})_(\\d{6})\\.dump$`)
}
/** 旁生产者(scripts/backup-pg-local.ps1)的命名:<库名>-<YYYYMMDD>-<HHMMSS>.dump */
export function dashDumpReFor(db) {
  return new RegExp(`^${altRe(db)}-(\\d{8})-(\\d{6})\\.dump$`)
}
/** 旧形态:<库名><-_><YYYYMMDD><-_><HHMMSS>.sql.gz */
export function sqlGzReFor(db) {
  return new RegExp(`^${altRe(db)}[-_](\\d{8})[-_](\\d{6})\\.sql\\.gz$`)
}

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

/** 清单入参归一:去空去重;**空 ⇒ 空**(没有任何默认库,不拿单个库冒充整个审计面) */
function normalizeDatabases(databases) {
  const list = Array.isArray(databases) ? databases.map((d) => String(d).trim()).filter(Boolean) : []
  return [...new Set(list)]
}

/**
 * 文件名 → {family,ymd,hms,db};family ∈ dump|dump-foreign|sqlgz|unrelated。
 * `databases` 决定"哪些库算被审面";空/未传 ⇒ 一个库都不认(全部 unrelated),
 * 由调用方把疑似备份档报名,而不是猜一个默认库。
 * db 字段是逐库统计的锚:旁族文件归它自己那个库,绝不替别的库作证。
 */
export function classifyFileName(name, databases) {
  const dbs = normalizeDatabases(databases)
  for (const db of dbs) {
    const m = dumpNameReFor(db).exec(name)
    if (m) return { family: 'dump', ymd: m[1], hms: m[2], db }
  }
  for (const db of dbs) {
    const m = dashDumpReFor(db).exec(name)
    if (m) return { family: 'dump-foreign', ymd: m[1], hms: m[2], db }
  }
  for (const db of dbs) {
    const m = sqlGzReFor(db).exec(name)
    if (m) return { family: 'sqlgz', ymd: m[1], hms: m[2], db }
  }
  return { family: 'unrelated', ymd: null, hms: null, db: null }
}

/** 这个名字长得像备份档(两种扩展名之一)却不属任何被审库 —— 要报名,不能静默丢 */
export function looksLikeBackupArtifact(name) {
  return /\.(dump|sql\.gz)$/i.test(String(name || ''))
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

/** "HHMMSS" → 当日分钟数(含秒的小数,边界判据才不被截断吞掉);读不出 → NaN,由调用方落"判不出"档 */
export function minuteOfDay(hms) {
  const s = String(hms ?? '')
  if (!/^\d{6}$/.test(s)) return NaN
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4)) + Number(s.slice(4, 6)) / 60
}

/** 分钟数 → HH:MM。**向下取整**:02:59:59 必须印成 02:59 —— 四舍五入会把它印成 03:00,
 *  而"比计划时刻早数秒"正是这一维要报名的东西,把它抹掉等于注记自己把自己藏起来。 */
export function hhmm(min) {
  if (!Number.isFinite(min)) return '??:??'
  const m = ((Math.floor(min) % 1440) + 1440) % 1440
  const p = (x) => String(x).padStart(2, '0')
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`
}

/**
 * 落盘时刻是否在计划窗口内(注意:同日多轮时,只要**任一份**落在窗口内就算在点 —— 实测 09-25 有 8 份、最早 02:21,若只看最早那份会误判成"没在点")
 *
 * **量纲必须是分钟,不能是小时。** 文件名里的时间戳是 pg_dump 的**起始**时刻,而调度器睡到的目标是整分
 * (03:00:00);唤醒 + 取时间戳有 ±数秒抖动,按小时截断会把"比标称分钟早 1 秒"那一轮推进上一格(02),
 * 于是同一批 03:00±3s 的产出里,只有恰好跨了分钟界的那一天被判成窗口外。2026-10-11 实测:`025959`
 * 那一份 mtime `03:00:22`、流水打了 `备份完成 03:00:22` 且已排 `下次备份 2026-10-12 03:00:00` ——
 * 它就是计划那一轮,却被旧判据报成 OFF_WINDOW_LAND。**间歇性假阳与恒绿同罪**:它把正常轮说成故障,
 * 代价是让人学会忽略这一维(§5e-1「训练收信人忽略这封信」同一条禁令)。
 *
 * 窗口按计划时刻**两侧各放 `scheduleGraceHours` 小时**,与报告行"03:00 ±2h"的措辞同形 ——
 * 旧实现 `lo = schedHour` 只给迟到一侧宽限,即**措辞承诺 ± 而代码只给单边**,是本门对自己文案的盲视。
 * 早于整个窗口(00:45 那一类)仍判 `off-window`:这一档的牙齿没有被削弱,由成对用例与变异自证钉住。
 */
export function judgeLanding(files, schedHour, t = THRESHOLDS) {
  const dumps = (files || []).filter((f) => f.family === 'dump')
  if (dumps.length === 0) return { state: 'none', hours: [], minutes: [], window: null }
  const minutes = dumps.map((f) => minuteOfDay(f.hms))
  const known = minutes.filter((n) => Number.isFinite(n))
  // 时间戳一律读不出 ⇒ 落 off-window(与旧实现同结论),不得因为"没量到"就发合格证
  if (known.length === 0) return { state: 'off-window', hours: [], minutes: [], window: null }
  const planned = schedHour * 60
  const lo = planned - t.scheduleGraceHours * 60
  const hi = planned + t.scheduleGraceHours * 60
  const hours = known.map((m) => Math.floor(m / 60))
  const early = known.filter((m) => m < planned)
  if (known.some((m) => m >= lo && m <= hi)) return { state: 'on-schedule', hours, minutes: known, window: [lo, hi], early }
  if (known.every((m) => m > hi)) return { state: 'late', hours, minutes: known, window: [lo, hi], earliest: Math.min(...known) }
  return { state: 'off-window', hours, minutes: known, window: [lo, hi], latest: Math.max(...known) }
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

/**
 * 逐日状态rollup:优先级 MISSING > TRUNCATED > UNDETERMINED > FOREIGN_ONLY > ok
 * `db` 只用于给 finding 打归属标签并在文案里点名(多库汇总时"哪一库坏了"必须看得见);
 * 判据本身不因库而变 —— 传不传 db,同一组文件的结论逐字相同(由镜像测试钉住)。
 */
export function judgeDay({ ymd, files, window, todayStr, nowHour, schedHour, integrityOnly = false, db = null }) {
  const who = db ? `${db} ` : ''
  const dumps = (files || []).filter((f) => f.family === 'dump')
  const foreign = (files || []).filter((f) => f.family === 'dump-foreign')
  const kind = absenceKind(ymd, window, todayStr, schedHour === undefined ? 99 : nowHour, schedHour ?? 3)
  if (dumps.length === 0) {
    if (kind === 'OUT_OF_RETENTION') return { ymd, status: 'OUT_OF_RETENTION', findings: [], notes: [], kind }
    if (foreign.length > 0) return { ymd, status: 'FOREIGN_ONLY', findings: [{ code: 'FOREIGN_ONLY', severity: 'degraded', db, text: `${who}${ymd} 只有旁族 dump(${foreign.map((f) => f.name).join(', ')},生产者不同),每晚链本日无产出` }], notes: [], kind }
    if (kind === 'PENDING_TODAY') return { ymd, status: 'PENDING_TODAY', findings: [], notes: ['今日计划时刻+宽限未到,尚无文件属正常'], kind }
    return { ymd, status: 'MISSING', findings: [{ code: 'MISSING', severity: 'broken', db, text: `${who}${ymd} 保留窗口内无任何 dump` }], notes: [], kind }
  }
  const counts = { complete: 0, truncated: 0, undetermined: 0 }
  for (const f of dumps) counts[f.verdict] = (counts[f.verdict] || 0) + 1
  const findings = integrityOnly ? [] : judgeIntraDay(dumps).map((x) => ({ ...x, db }))
  const notes = []
  if (dumps.length > 1) notes.push(`本日 ${dumps.length} 份(同日多轮 = 调度器被重启或在重试;本身不算故障,但值得一查)`)
  if (counts.truncated > 0 && counts.complete > 0)
    findings.push({ code: 'TRUNCATED_WITH_GOOD', severity: 'degraded', db, text: `${who}${ymd} 有 ${counts.truncated} 份截断/损坏、${counts.complete} 份完整 —— 当日仍可恢复,但失败轮就在这一天` })
  else if (counts.truncated > 0)
    findings.push({ code: 'TRUNCATED_ONLY', severity: 'broken', db, text: `${who}${ymd} 无一份完整:${counts.truncated} 份判为截断/损坏` })
  else if (counts.undetermined > 0)
    findings.push({ code: 'UNDETERMINED_ONLY', severity: 'undetermined', db, text: `${who}${ymd} 无一份判为完整,余下 ${counts.undetermined} 份判不出(读不到/缺 pg_restore/派生失败)` })
  let status = 'ok'
  if (counts.truncated > 0) status = counts.complete > 0 ? 'ok-with-truncated' : 'TRUNCATED'
  else if (counts.undetermined > 0 && counts.complete === 0) status = 'UNDETERMINED'
  const sched = schedHour ?? 3
  const land = judgeLanding(dumps, sched)
  const winText = land.window ? `${hhmm(land.window[0])}–${hhmm(land.window[1])}` : '窗口算不出'
  if (land.state === 'late')
    findings.push({ code: 'LATE_LAND', severity: 'degraded', db, text: `${who}${ymd} 没在计划 ${String(sched).padStart(2, '0')}:00±${THRESHOLDS.scheduleGraceHours}h(即 ${winText})落盘,最早落在 ${hhmm(land.earliest)} —— 调度器延迟或在重试` })
  else if (land.state === 'off-window')
    findings.push({ code: 'OFF_WINDOW_LAND', severity: 'degraded', db, text: `${who}${ymd} 落盘时刻 ${(land.minutes || []).map(hhmm).join('/') || '(时间戳读不出)'} 全在计划窗口 ${winText} 外(常见于服务启动即备份那一轮,或调度时刻被改动)` })
  else if (land.state === 'on-schedule' && (land.early || []).length > 0)
    // 在点但落在计划时刻**之前** —— 不算故障,但也不能悄悄过去(它正是"调度器提前数秒唤醒"的指纹)
    notes.push(`本日 ${land.early.map(hhmm).join('/')} 落在计划时刻之前,仍在 ±${THRESHOLDS.scheduleGraceHours}h 宽限内 ⇒ 算在点(常见于调度器提前数秒唤醒、文件名取的是 dump 起始时刻)`)
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

/**
 * 备份清单读自被审 runner 本身:`$backupDatabases = @($dbName, 'keycloak') | Select-Object -Unique`。
 * 刻意**不读 `.env`** —— `$dbName` 的字面值按同一份文件里的 `if (-not $dbName) { $dbName = "ihui_dev" }`
 * 兜底行推导,取不到就判"未判定",绝不静默按 ihui_dev 收面(收窄审计面正是本工具要防的那一型)。
 * 返回三态:parsed=true / parsed=false + reason(绝不返回"半个清单"冒充完整)。
 */
export function parseBackupDatabases(text) {
  const src = String(text || '')
  const line = /\$backupDatabases\s*=\s*@\(([^)]*)\)/i.exec(src)
  if (!line) return { parsed: false, databases: null, reason: '这份 runner 里找不到 $backupDatabases = @(...) 行' }
  const tokens = line[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (tokens.length === 0) return { parsed: false, databases: null, reason: '$backupDatabases 声明为空数组 ⇒ 没有可审的库(不当"全都齐了"来判)' }
  const out = []
  let primaryLiteral = null
  for (const tok of tokens) {
    const quoted = /^['"]([^'"]*)['"]$/.exec(tok)
    if (quoted) {
      if (quoted[1].trim()) out.push(quoted[1].trim())
      continue
    }
    if (/^\$dbName$/i.test(tok)) {
      const fb = /if\s*\(\s*-not\s+\$dbName\s*\)\s*\{\s*\$dbName\s*=\s*["']([^"']+)["']\s*\}/i.exec(src)
      if (!fb)
        return {
          parsed: false,
          databases: null,
          reason: '$backupDatabases 引用了 $dbName,而同一份文件里没有 if (-not $dbName) { $dbName = "…" } 兜底行 ⇒ 主库字面值无从解析',
        }
      primaryLiteral = fb[1].trim()
      out.push(primaryLiteral)
      continue
    }
    return { parsed: false, databases: null, reason: `清单里有一项既不是引号字面量也不是 $dbName:${tok} —— 不猜库名` }
  }
  const dbs = [...new Set(out)]
  if (!dbs.length) return { parsed: false, databases: null, reason: '清单解析出来是空(全是空字面量)' }
  return { parsed: true, databases: dbs, primaryLiteral, declared: tokens.length }
}

/**
 * 每个库的起判日 —— 派生自目录实存,不是脚本里手工维护的 "since"。
 * mode:NO_FILE(一份都没有 ⇒ 整窗照判,缺席即 MISSING)/ CLAMPED_TO_WINDOW /
 * DERIVED(新库只在它开始产出档之后的日子里被问责)/ AFTER_WINDOW(文件名日期超前 ⇒ 本窗不判缺席)。
 */
export function deriveStartYmd(seenDays, window) {
  const w = [...(window || [])].filter((d) => /^\d{8}$/.test(String(d))).sort()
  if (w.length === 0) return { startYmd: null, startIdx: 0, mode: 'NO_WINDOW', reason: '窗口为空' }
  const first = w[0]
  const days = [...new Set((seenDays || []).filter((d) => /^\d{8}$/.test(String(d))))].sort()
  if (days.length === 0)
    return { startYmd: first, startIdx: 0, mode: 'NO_FILE', reason: `审计目录里没有这个库的任何档 ⇒ 自窗口首日 ${first} 起判,缺席即 MISSING(runner 说它在备而目录里没有,正该喊)` }
  const earliest = days[0]
  if (earliest <= first)
    return { startYmd: first, startIdx: 0, mode: 'CLAMPED_TO_WINDOW', reason: `该库最早一档 ${earliest} 不晚于窗口首日 ${first} ⇒ 整个窗口都该有` }
  const idx = w.indexOf(earliest)
  if (idx < 0)
    return { startYmd: earliest, startIdx: -1, mode: 'AFTER_WINDOW', reason: `该库最早一档 ${earliest} 晚于窗口末日 ${w[w.length - 1]}(文件名日期超前)⇒ 本窗口不判它的缺席,只列观察` }
  return { startYmd: earliest, startIdx: idx, mode: 'DERIVED', reason: `该库在目录里的第一份档是 ${earliest}(派生自实存文件,不是手写起始日)⇒ 更早的日子不追溯判缺席` }
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

// DevEnv 根走 §15b 唯一出口(见文件头注);本模块不再自己推导盘根。
function pgBinDir() {
  return process.env.IHUI_PG_BIN_DIR || join(devEnvRoot(), 'runtimes', 'pgsql', 'bin')
}
function backupPgDir() {
  return process.env.IHUI_BACKUP_PG_DIR || join(devEnvRoot(), 'backups', 'pg')
}

export const EXEC_CANDIDATES = ['deploy/prod-bundle/pg-backup.ps1', 'deploy/win/ihui-pg-backup.ps1']
const SCHED_CANDIDATES = ['deploy/prod-bundle/pg-backup-scheduler.ps1', 'deploy/win/ihui-pg-backup-scheduler.ps1']

/** 先读"服务实际执行的那份",再退入库源;两处都没有才算读不到(§5e:按实际执行体取径) */
function readConfigFrom(first, second, pick) {
  for (const rel of [first, second]) {
    if (!rel) continue
    try {
      const text = readFileSync(isAbsolute(rel) ? rel : join(repoRoot, rel), 'utf8')
      const v = pick(text)
      if (v !== null && v !== undefined) return { value: v, source: rel }
    } catch {
      /* 换机 / 非部署机:prod-bundle 整目录被 gitignore,不存在是常态 */
    }
  }
  return { value: null, source: null }
}

/**
 * 审计库清单的解析入口。deps.databases 是**测试通道**(镜像测试要能造"清单里有第二个库"和
 * "清单解析不出"两种现场,又不必为此改动真仓 runner);生产调用不传,语义不变。
 * 传入数组 ⇒ 视为已解析清单;传入 {parsed:false,reason} ⇒ 模拟一份读不出清单的 runner。
 */
export function resolveDatabases(deps, execCands) {
  if (deps.databases !== undefined) {
    if (Array.isArray(deps.databases)) {
      const injected = normalizeDatabases(deps.databases)
      if (injected.length === 0)
        return { parsed: false, databases: null, reason: '调用方注入了一份空清单 ⇒ 没有任何库可审(空清单不等于"全都齐了")', source: '(调用方注入)' }
      return { parsed: true, databases: injected, source: '(调用方注入)', primaryLiteral: null }
    }
    const o = deps.databases || {}
    return { parsed: false, databases: null, reason: o.reason || '调用方注入了一份解析不出的清单', source: '(调用方注入)' }
  }
  const r = readConfigFrom(execCands[0], execCands[1], parseBackupDatabases)
  if (!r.value)
    return { parsed: false, databases: null, reason: '两份备份脚本都读不到 ⇒ 无从解析 $backupDatabases', source: null }
  const v = r.value
  if (!v.parsed) return { parsed: false, databases: null, reason: v.reason, source: r.source }
  const via = v.primaryLiteral ? `(其中 $dbName → 同文件兜底行的 "${v.primaryLiteral}")` : ''
  return { parsed: true, databases: v.databases, source: `${r.source}:$backupDatabases${via}`, primaryLiteral: v.primaryLiteral }
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

/**
 * 目录清单 → {items,unknownArtifacts};单项 stat 失败不整批丢,只把该记成读不到。
 * unknownArtifacts = 长得像备份档但名字不属于任何被审库的文件 —— 报名不静默丢,
 * 也不判红(那属"清单与产出不同步"另一型,得由人定性)。
 */
function listDir(dir, databases) {
  let names = []
  try {
    names = readdirSync(dir)
  } catch (e) {
    return { error: `备份目录不可读: ${dir} (${e.message})`, items: [], unknownArtifacts: [] }
  }
  const items = []
  const unknownArtifacts = []
  for (const name of names) {
    const cls = classifyFileName(name, databases)
    if (cls.family === 'unrelated') {
      if (looksLikeBackupArtifact(name)) unknownArtifacts.push(name)
      continue
    }
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
      db: cls.db,
      ymd: cls.ymd,
      hms: cls.hms,
      stamp: cls.ymd && cls.hms ? cls.ymd + cls.hms : '',
      size: st && st.isFile() ? st.size : undefined,
      mtimeMs: st ? st.mtimeMs : undefined,
      statError: st ? null : 'stat 失败(文件被占用或已消失)',
    })
  }
  return { items, unknownArtifacts }
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
  const base = { name: item.name, family: item.family, db: item.db ?? null, ymd: item.ymd, hms: item.hms, stamp: item.stamp, size: item.size, mtimeISO: item.mtimeMs ? new Date(item.mtimeMs).toISOString() : null }
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

/**
 * 云同步那一腿:只看本地同步目录里当日有没有文件;远端上传与否一律未判定。
 * 逐库比 —— 拿 ihui_dev 在云盘的那一份去替 keycloak 作证,等于给没同步的库发合格证。
 */
function auditCloud(cloudDir, window, databases, byDay) {
  const note = '未判定:百度网盘是否真的收到这些文件,在本机结构上无从验证(同步目录里有文件 ≠ 已上传成功)'
  const dbs = normalizeDatabases(databases)
  if (!cloudDir) return { dir: null, state: 'undetermined', perDay: [], note: '未判定:备份脚本里读不到 $cloudDir(可能该腿已移除)' }
  if (dbs.length === 0)
    return { dir: cloudDir, state: 'undetermined', perDay: [], note: '未判定:审计面为空(库清单解析不出)⇒ 云腿没有任何可比的库,不拿目录里有文件冒充"每库都同步了"' }
  let names = []
  try {
    names = readdirSync(cloudDir)
  } catch (e) {
    return { dir: cloudDir, state: 'undetermined', perDay: [], note: `未判定:本地同步目录不可读(${cloudDir}: ${e.message})——非部署机/网盘未挂载是常态,不等于云备份坏了` }
  }
  const cloudYmd = new Map() // db → Set(ymd)
  for (const db of dbs) cloudYmd.set(db, new Set())
  for (const n of names) {
    const cls = classifyFileName(n, dbs)
    if (cls.ymd && cloudYmd.has(cls.db)) cloudYmd.get(cls.db).add(cls.ymd)
  }
  const perDay = window.map((ymd) => {
    const byDatabase = dbs.map((db) => {
      const local = (byDay.get(ymd) || []).filter((f) => f.db === db)
      return {
        db,
        localHas: local.some((f) => f.family === 'dump'),
        present: cloudYmd.get(db).has(ymd),
      }
    })
    return { ymd, present: byDatabase.some((b) => b.present), byDatabase }
  })
  return { dir: cloudDir, state: 'scanned', totalFiles: names.length, perDay, note }
}

// ────────────────────────────── 组装 ──────────────────────────────

/** 逐日状态rollup:优先级 MISSING > TRUNCATED > UNDETERMINED > FOREIGN_ONLY > ok-with-truncated > PENDING_TODAY > OUT_OF_RETENTION > ok > PRE_START */
export const STATUS_RANK = Object.freeze({
  MISSING: 0,
  TRUNCATED: 1,
  UNDETERMINED: 2,
  FOREIGN_ONLY: 3,
  'ok-with-truncated': 4,
  PENDING_TODAY: 5,
  OUT_OF_RETENTION: 6,
  ok: 7,
  PRE_START: 8,
  UNAUDITED: 2, // 与 UNDETERMINED 同档:没看着 ≠ 坏了,但绝不是"齐了"
})

/** 一天里两个库各有各的状态时,取最严重的那个(不得让"另一库 MISSING"被先遍历到的 ok 盖掉) */
export function worstStatus(statuses) {
  const list = (statuses || []).filter(Boolean)
  if (list.length === 0) return 'ok'
  return list.reduce((worst, s) => ((STATUS_RANK[s] ?? 99) < (STATUS_RANK[worst] ?? 99) ? s : worst), list[0])
}

function buildReport(opts) {
  const { cli, deps } = opts
  const dir = deps.backupDir || backupPgDir()
  const bins = deps.bins || {}
  const pgRestore = bins.pgRestore || join(pgBinDir(), 'pg_restore.exe')
  const binExists = deps.binExists ?? existsSync(pgRestore)
  const now = deps.now ? new Date(deps.now) : new Date()
  const today = deps.ymd || todayYmd(now)
  const nowHour = now.getHours()

  // deps.execCandidates / deps.schedCandidates 同样是测试通道:清单判据要能在"一份写死的 fixture runner"上被证明,
  // 而不去改生产脚本。生产调用不传 ⇒ 仍按"服务实际执行的那份优先"两处取径。
  const execCands = deps.execCandidates || EXEC_CANDIDATES
  const schedCands = deps.schedCandidates || SCHED_CANDIDATES
  const ret = readConfigFrom(execCands[0], execCands[1], parseRetention)
  const sched = readConfigFrom(schedCands[0], schedCands[1], parseScheduleHour)
  const cloud = readConfigFrom(execCands[0], execCands[1], parseCloudDir)
  const dbCfg = resolveDatabases(deps, execCands)
  const days = cli.days || ret.value || THRESHOLDS.defaultDays
  const daysSource = cli.days ? '--days 参数(覆盖脚本值)' : ret.source ? `${ret.source}:$retentionDays` : `兜底 ${THRESHOLDS.defaultDays}(两份备份脚本都读不到 $retentionDays)`
  // deps.* 覆盖点是**测试通道**:镜像测试要能造出确定性的窗口/时刻/云目录,
  // 又不必为此去读真机的网盘目录(那会让测试结果随机器状态漂)。生产调用不传,语义不变。
  const schedHour = deps.scheduleHour ?? sched.value ?? 3
  const schedSource = deps.scheduleHour !== undefined ? `${deps.scheduleHour}(调用方注入)` : sched.value !== null ? `${sched.source}:-Hour ${sched.value}` : `兜底 03:00(调度脚本读不到 -Hour;窗口判定按默认值,已在原因里注明)`
  const cloudDir = deps.cloudDir !== undefined ? deps.cloudDir : cloud.value

  /** 清单解析不出来 ⇒ 审计面为空。刻意**不**退回任何单个库:那正是 G-297 立项的那一型(账面只看一台,别的库缺多少天都是满分) */
  const databases = dbCfg.parsed ? dbCfg.databases : []
  const noFace = databases.length === 0
  const databasesNote = noFace
    ? `未判定:备份清单无从解析(${dbCfg.reason || '清单为空'}${dbCfg.source ? ';出处试读 ' + dbCfg.source : ''})—— 本工具不保留默认库,故本轮一个库都不审;任何"齐了"或"缺了"都无从谈起,目录里看到的疑似备份档只在观察项里报名`
    : ''

  const listing = listDir(dir, databases)
  const meta = {
    backupDir: dir,
    days,
    daysSource,
    databases,
    databasesAudited: databases.length,
    databasesSource: dbCfg.source || '(读不到任何一份 runner)',
    databasesParsed: dbCfg.parsed,
    databasesNote,
    scheduleHour: schedHour,
    scheduleSource: schedSource,
    pgRestore,
    binExists,
    today,
    generatedAt: now.toISOString(),
    cloudDirSource: deps.cloudDir !== undefined ? '(注入)' : cloud.source,
  }
  if (listing.error)
    return { ...meta, fatal: { code: 'NO_DIR', text: listing.error }, verdict: 'undetermined', reasons: ['NO_DIR'], files: [], byDatabase: [], dayRows: [], outOfWindowDays: [], cloud: null, exitCode: cli.strict ? 1 : 2 }
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
        // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
        const r = spawnSync(argv[0], argv.slice(1), { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: deps.tocTimeoutMs ?? 60_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
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

  /** 审计面自身的诚实性:清单解析不出(或空)⇒ undetermined,优先于任何"缺席/齐备"结论 */
  const faceFindings = []
  if (noFace) faceFindings.push({ code: 'BACKUP_LIST_UNDETERMINED', severity: 'undetermined', text: databasesNote })

  // ── 逐库:缺席判定、同日多份、邻日骤缩、TABLE DATA、源库版本全部按库各算一份 ──
  const perDb = databases.map((db) => {
    const seen = [...new Set(files.filter((f) => f.db === db && f.ymd).map((f) => f.ymd))].sort()
    const st = deriveStartYmd(seen, window)
    const ofDb = (ymd) => (byDay.get(ymd) || []).filter((f) => f.db === db)
    const rows = scope.map((ymd) => {
      const i = window.indexOf(ymd)
      if (i >= 0 && (st.startIdx < 0 || i < st.startIdx))
        return { ymd, db, status: 'PRE_START', findings: [], notes: [`早于该库起判日 ${st.startYmd || '—'}(模式 ${st.mode})⇒ 本日不判缺席,也不据此说它齐了`], kind: 'PRE_START' }
      // judgeDay 的返回体不带 db(它对 db 只做标注),行级归属在这里补上 —— 汇总要能看出是哪一库坏的
      return { ...judgeDay({ ymd, files: ofDb(ymd), window, todayStr: today, nowHour, schedHour, db }), db }
    })
    const winRows = rows.filter((r) => window.includes(r.ymd))
    const outRows = rows.filter((r) => !window.includes(r.ymd))
    const auditedDays = st.startIdx < 0 ? [] : window.slice(st.startIdx)
    const series = auditedDays.map((ymd) => {
      const p = pickPrimary(ofDb(ymd))
      return p ? { ymd, db, size: p.size, tableDataCount: p.toc?.tableDataCount ?? null, dbVersion: p.toc?.dbVersion ?? null, name: p.name } : { ymd, db, size: null }
    })
    const findings = []
    series.forEach((s, i) => {
      const j = judgeShrink(series, i)
      if (j.state === 'shrink')
        findings.push({ code: 'SIZE_SHRINK', severity: 'degraded', day: s.ymd, db, text: `${db} ${s.ymd} 代表文件 ${s.name} 仅 ${s.size} B,为同库邻日中位数 ${Math.round(j.median)} B 的 ${(j.ratio * 100).toFixed(1)}% —— 骤缩` })
      s.shrink = j
    })
    for (const t of judgeTableDrift(series)) findings.push({ ...t, db, text: `${db} ${t.text}` })
    for (const f of files.filter((x) => x.db === db && x.family === 'dump' && x.size === 0)) findings.push({ code: 'ZERO_BYTE', severity: 'broken', day: f.ymd, db, text: `${f.name} 为 0 字节` })
    const obs = []
    const vd = judgeVersionDrift(series)
    if (vd.drift) obs.push(`${db} 源库版本在本窗口内不唯一:${vd.distinct.join(' / ')};以最近一日(${vd.reference})为参照,来自别的版本档的日子:${vd.odd.join(', ')} —— 升级/降级会在 TOC 里留下这个指纹,是信号不是故障`)
    const und = series.filter((s) => s.shrink?.state === 'undetermined')
    if (und.length)
      obs.push(`${db} 骤缩规则在 ${und.length} 个日子判不出:${und.map((s) => `${s.ymd}(${s.shrink.reason || '原因未记'})`).join(', ')} —— 已按"未判定"处理,不算通过(按库分开算正是为了让这个数有意义)`)
    // 表数量不到 = 表数漂移这一判据当日不适用。它既不是"没少表"也不是"通过",必须点名(否则"安静"就是这一格的失败形态)。
    const noTable = series.filter((s) => typeof s.tableDataCount !== 'number')
    if (noTable.length)
      obs.push(`${db} TABLE DATA 条数在 ${noTable.length} 个日子量不到:${noTable.map((s) => `${s.ymd}(${s.name ? 'TOC 未判' : '当日无代表档'})`).join(', ')} —— 该库表数漂移判据这些日子未判定,不算通过`)
    if (st.mode === 'AFTER_WINDOW') obs.push(`${db} ${st.reason}`)
    return { db, startYmd: st.startYmd, startMode: st.mode, startReason: st.reason, auditedDays, dayRows: winRows, outOfWindowDays: outRows, series, findings, observations: obs }
  })

  // ── 逐日 rollup:一天多库,取最严重 ──
  const rowOf = (db, ymd) => perDb.find((d) => d.db === db)?.dayRows.find((r) => r.ymd === ymd) || perDb.find((d) => d.db === db)?.outOfWindowDays.find((r) => r.ymd === ymd)
  const rollup = (ymd) => {
    const rows = perDb.map((d) => rowOf(d.db, ymd)).filter(Boolean)
    if (rows.length === 0)
      // 审计面为空(清单解析不出)⇒ 这一天既不是"齐"也不是"缺",是**没看**。不得用 worstStatus([])='ok' 冒充结论。
      return { ymd, status: 'UNAUDITED', findings: [], notes: [noFace ? '审计面未判定 ⇒ 本日不作任何结论(不是"齐了")' : '本日无任何被审库的行(内部一致性异常,请报本工具持有人)'], perDatabase: [] }
    return {
      ymd,
      status: worstStatus(rows.map((r) => r.status)),
      findings: rows.flatMap((r) => r.findings || []),
      notes: rows.flatMap((r) => (r.notes || []).map((n) => `[${r.db}] ${n}`)),
      perDatabase: rows.map((r) => ({ db: r.db, status: r.status })),
    }
  }
  const dayRows = window.map(rollup)
  const outOfWindowDays = [...new Set(perDb.flatMap((d) => d.outOfWindowDays.map((r) => r.ymd)))].sort().map(rollup)

  const extra = [...faceFindings, ...perDb.flatMap((d) => d.findings)]

  const cloudRes = auditCloud(cloudDir, window, databases, byDay)
  const cloudFindings = []
  if (cloudRes.state === 'scanned') {
    for (const p of cloudRes.perDay) {
      for (const b of p.byDatabase) {
        if (!b.localHas || b.present) continue
        const r = rowOf(b.db, p.ymd)
        if (r && r.status === 'PRE_START') continue // 该库那天还没开始备,谈不上"云侧缺一份"
        cloudFindings.push({ code: 'CLOUD_COPY_ABSENT', severity: 'degraded', day: p.ymd, db: b.db, text: `${b.db} ${p.ymd} 本地有 dump 而同库在云同步目录里没有(该腿当日没跑成或被清过);远端是否收到另计未判定` })
      }
    }
  } else {
    cloudFindings.push({ code: 'CLOUD_UNDETERMINED', severity: 'undetermined', text: cloudRes.note })
  }

  const vdays = [...perDb.flatMap((d) => d.dayRows), ...outOfWindowDays.map((d) => ({ ...d, findings: [] }))]
  const dec = decideVerdict(vdays, [...extra, ...cloudFindings])
  const observations = perDb.flatMap((d) => d.observations)
  const excluded = files.filter((f) => f.verdict === 'excluded')
  if (excluded.length) observations.push(`${excluded.length} 份 .sql.gz 旧形态未参与三态判定:${excluded.map((f) => f.name).join(', ')}`)
  if (listing.unknownArtifacts.length)
    observations.push(
      `${noFace ? `审计面未判定 ⇒ 目录里 ${listing.unknownArtifacts.length} 个长得像备份档的文件全部未参与判定` : `名字不在被审清单(${databases.join(' / ')})里、却长得像备份档的 ${listing.unknownArtifacts.length} 个文件未参与任何判定`}:${listing.unknownArtifacts.join(', ')} —— 新增了库要先改进 runner 的 $backupDatabases,别让这一格悄悄隐身`,
    )
  if (outOfWindowDays.length) observations.push(`窗口之外还在目录里的日子:${outOfWindowDays.map((d) => d.ymd).join(', ')}(保留策略之外,只列出)`)

  return {
    ...meta,
    window,
    verdict: dec.verdict,
    reasons: dec.reasons,
    findings: dec.findings.map((f) => ({ ...f })),
    observations,
    cloud: cloudRes,
    dayRows,
    outOfWindowDays,
    byDatabase: perDb,
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
  L.push(`   审计的库(读自被审 runner,非本工具写死): ${(r.databases || []).length ? r.databases.join(' / ') : '一个都没有 —— 本工具不留默认库,见下'} —— 出处 ${r.databasesSource}`)
  if (r.databasesParsed === false && r.databasesNote) L.push(`   ❌ ${r.databasesNote}`)
  L.push(`   计划时刻: ${String(r.scheduleHour).padStart(2, '0')}:00 ±${THRESHOLDS.scheduleGraceHours}h,出处 ${r.scheduleSource}`)
  L.push(`   pg_restore: ${r.pgRestore} ${r.binExists ? '在位' : '❌ 不在位'}`)
  if (r.binariesMissingNote) L.push(`   ⚠ ${r.binariesMissingNote}`)
  L.push('')
  const icon = { ok: '✅', 'ok-with-truncated': '⚠', TRUNCATED: '❌', MISSING: '❌', UNDETERMINED: '⚠', FOREIGN_ONLY: '⚠', PENDING_TODAY: '·', OUT_OF_RETENTION: '·', PRE_START: '·', UNAUDITED: '⚠' }
  L.push('① 逐日(窗口内,按库分列;统计一律不跨库混算)')
  if (!r.byDatabase.length)
    L.push(`  (无库可审 ⇒ 逐日不产出"齐/缺"结论;窗口 ${r.window[0]}…${r.window.at(-1)} 每天记 UNAUDITED,那是"没看"不是"没事")`)
  for (const d of r.byDatabase) {
    L.push(`  ▸ 库 ${d.db} —— 起判日 ${d.startYmd || '(窗口内无一天起判)'}:${d.startReason}`)
    for (const row of d.dayRows) {
      const p = pickPrimary(r.files.filter((f) => f.ymd === row.ymd && f.db === d.db))
      const tail = p ? ` 代表 ${p.name} ${(p.size / 1048576).toFixed(1)}MB TOC=${p.toc?.tocEntries ?? '—'} TABLEDATA=${p.toc?.tableDataCount ?? '—'} 源库=${p.toc?.dbVersion ?? '—'} 完整性=${p.verdict} 骤缩判=${d.series.find((s) => s.ymd === row.ymd)?.shrink?.state ?? '—'}` : ''
      L.push(`    ${icon[row.status] || '?'} ${row.ymd}  ${row.status.padEnd(18)}${tail}`)
      for (const f of r.files.filter((x) => x.ymd === row.ymd && x.db === d.db && x.family === 'dump' && x.verdict !== 'complete'))
        L.push(`        · ${f.name} ${f.verdict} size=${f.size ?? '—'}B magic=${JSON.stringify(f.magicPrefix || '—')} —— ${(f.reasons || []).join('; ')}`)
      for (const n of row.notes || []) L.push(`        注: ${n}`)
    }
  }
  const mixed = r.dayRows.filter((d) => new Set((d.perDatabase || []).map((x) => x.status)).size > 1)
  if (mixed.length)
    L.push(`  注: ${mixed.length} 天各库状态不一致(逐日汇总只取最严重的那个):${mixed.map((d) => `${d.ymd}[${d.perDatabase.map((x) => `${x.db}=${x.status}`).join(' ')}]`).join(', ')}`)
  L.push('')
  L.push('② 发现(findings)')
  if (r.findings.length === 0) L.push('  (无)')
  for (const f of r.findings) L.push(`  [${f.severity}] ${f.code}${f.day ? ` @${f.day}` : ''}: ${f.text}`)
  L.push('')
  L.push('③ 云同步腿(异地容灾,逐库)')
  if (r.cloud) {
    L.push(`  本地同步目录: ${r.cloud.dir || '(未配置)'} —— 目录内 ${r.cloud.totalFiles ?? 0} 个文件`)
    if (r.cloud.state === 'scanned')
      for (const d of r.byDatabase)
        L.push(`  ${d.db} 逐日在位: ${r.cloud.perDay.map((p) => `${p.ymd.slice(4)}:${p.byDatabase.find((b) => b.db === d.db)?.present ? '有' : '无'}`).join('  ')}`)
    L.push(`  ${r.cloud.note}`)
  }
  L.push('')
  L.push('④ 观察项(不是判定,但别让它悄悄过去)')
  if (r.observations.length === 0) L.push('  (无)')
  for (const o of r.observations) L.push(`  · ${o}`)
  L.push('')
  L.push(`▶ 结论: ${r.verdict}${r.reasons.length ? ` —— ${r.reasons.join(', ')}` : ''} (退出码 ${r.exitCode})`)
  L.push('   覆盖边界: 只判文件层 TOC 完整性;不证明数据块可解压(→ pg-restore-drill --offline-verify)、')
  L.push('   不证明服务端接受还原、不证明网盘真上传成功;审计面(审哪些库)读自被审 runner 的 $backupDatabases,')
  L.push('   解析不出即"未判定" —— 本工具不会自行缩面,也不会用某个库的齐备替另一个库作证。')
  return L.join('\n')
}

function main(argv = [], deps = {}) {
  const cli = parseCliArgs(argv)
  if (cli.error) return { code: 2, out: { error: cli.error }, json: false }
  if (cli.help) return { code: 0, out: { help: '用法: node scripts/pg-backup-cadence-audit.mjs [--days N] [--json] [--strict]' }, json: false }
  // --self-test 在本工具里**不实跑**:取证活在镜像测试(它才有人注入的假 pg_restore 与临时目录),
  // 自己派生测试进程只会造出一条"跑了但什么都没验"的假出路。这里给出的必须是能真跑通的那一条命令。
  if (cli.selfTest)
    return { code: 0, out: { help: '本工具的取证在镜像测试,不在本进程内自跑:\n  node --test scripts/tests/pg-backup-cadence-audit.test.mjs\n(该测试须连跑两次结果一致;本开关不跑任何判据,因此它的 0 不构成"已验证"。)' }, json: false }
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
  minuteOfDay,
  hhmm,
  judgeDay,
  judgeVersionDrift,
  judgeTableDrift,
  decideVerdict,
  exitCodeFor,
  parseRetention,
  parseScheduleHour,
  parseCloudDir,
  parseBackupDatabases,
  deriveStartYmd,
  worstStatus,
  STATUS_RANK,
  dumpNameReFor,
  dashDumpReFor,
  sqlGzReFor,
  looksLikeBackupArtifact,
  magicPrefixOf,
  parseTocMeta,
  parseCliArgs,
  THRESHOLDS,
  DUMP_NAME_RE,
  normalizeDatabases,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
