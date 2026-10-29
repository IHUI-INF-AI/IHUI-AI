// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * auto-triage — 感知层自动分诊器(auto-evolve 四期系列 O65 · 第 1 期,2026-10-25 立)。
 *
 * 职责:把巡检发现转成「可派单的真工作」,不把噪音写进台账。分诊三档:
 *   可派单 → 走 live-doc-edit(唯一登记入口)登记 PROJECT_PLAN EOF;
 *   观察类 → 只进本器台账 jsonl(交给既有到人/自愈链,不重复登记);
 *   超配额/去重 → 台账留痕,静默等待窗口。
 *
 * 判据纪律:
 *  - 来源白名单:只吃配置里点名的源,每源一台账/一判据,不搞万能解析(防噪音淹没,§1);
 *  - 「台账只记真工作」:可派单的判据 = 有人能动手做的(§1 登记门槛);
 *  - 登记行带新鲜日期交代(三选一),同源 24h 去重 + 每日登记配额;
 *  - 取不到来源数据 ⇒ 该源落「未判定」不记绿(§0.3),绝不把读不到当成"无发现"。
 *
 * 来源(第二期新增 3 个,均只吃机器可读面,不新开路由/不新开连接层):
 *  - mail-failure:apps/api/scripts/notify-deploy-failure.ts 的投递台账(§5e-3)24h 窗内
 *    disposition==='failed' 计数 ≥2 ⇒ 派「邮件通道故障排查」票(5e-2:agent 自己查端口/进程);
 *  - index-unmerged:scripts/check-index-unmerged-age.mjs --json 的机器读数 ⇒ 烂尾滞留是
 *    观察类(它已有到人链,分诊器只记账不重复登记);
 *  - api-logs:packages/database 的 api_logs 表,只读 SELECT 走现役 psql 定位器/DSN 解析/
 *    只读 SQL 断言(scripts/lib/psql-client-locate.mjs、scripts/check-learn-video-mount.mjs
 *    的 psqlSpawn、scripts/lib/db-probe-client.mjs 的回环/8810 守卫);测试面走 JSONL 夹具;
 *  - grafana-alerts:Grafana/Prometheus 告警栈的机器可读面 = Alertmanager
 *    GET /api/v2/alerts(与 apps/api/src/routes/admin-ops-wallboard.ts 同一来源);
 *    地址取 grafanaAlerts.url 或 ALERTMANAGER_URL,两者皆空 ⇒ 未判定(不把读不到当无发现);
 *  - user-feedback:feedbacks 表只有 API 路由(GET /feedbacks、GET /admin/feedbacks),
 *    scripts 层无既有消费面 ⇒ 只吃既有导出落盘的 JSONL(userFeedback.jsonl),不新开路由。
 *
 * 聚类:新增「错误签名归一」层(数字/UUID/URL 查询串/时间戳归零后再哈希),同桶 24h 窗
 * 计数达到 clustering.minOccurrences(默认 2)才够格派单;去重键仍复用 fingerprintOf。
 *
 * 用法:node scripts/auto-triage.mjs --once [--dry-run] | --status | --families | --self-test | --help
 *  dry-run 只打印将要登记/观察的行,不写 PROJECT_PLAN.md,也不写分诊台账。
 *  --families 只读:把每一枚在册字母族喂给**唯一分配判据**现跑一遍,报"哪一族真发得出号"。
 *  参数闸:未知旗标/位置参数/缺动作旗标 ⇒ 当场 exit 2 打用法(2026-10-28 立:`--help` 曾直接
 *  落真分诊轮并往观测账追写行 —— 歧义调用只许"多要一次定向说明",绝不"多跑一次真轮")。
 *
 * 取号族现读(2026-10-29 立,结清 L28694「写入台账」最后一格):
 *  病根不是号池的算术,而是**族字母被烘成常量** —— 登记行写死 `{{NEXT_ID:G}}`,而 G 族对本席
 *  现读恒回 `pool-exhausted:G / stage=scan-filter`(真成因 SCAN_FACE_FULL:占用面让得出窗、
 *  窗内候选却被台账⊕归档件的引用面全灭)。归因层 2026-10-28 已补齐(枚 a130903b43),缺的是**出路**:
 *  仓库既有裁量口径 = 换字母族或开新字母(削 G-14 引用面不是出路,散点归档实测 Δ=0)。
 *  ⇒ 本器不再自定族:每次登记前按现读挑一族**真发得出号**的字母族,挑族用的判据就是第一发号出口
 *  那一份(`live-doc-edit.resolveIdTokens`,纯函数、零写盘),本器一个取号判据都不复制(§0.6)。
 *  候选族的字母表同样不抄第二份 —— 由编号族表唯一真相源 `check-plan-line-loss.TASK_ID_PATTERN`
 *  现解析(族表认不出的字母对取号器与主键判据同时隐身,故族表永远是上游)。
 *  探针不含远端那一维 ⇒ 它只是排序器,不是担保:真落地仍由 live-doc-edit 每轮 CAS 现算;
 *  被拒且属 `pool-exhausted` ⇒ 按现读可发族的次名重试(≤3 次),其余失败原因不重试(重试也不会变)。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { psqlSpawn, resolveDsn } from './check-learn-video-mount.mjs'
import { locatePsqlClient, psqlLocateMissText } from './lib/psql-client-locate.mjs'
import { guardDbDsn } from './lib/db-probe-client.mjs'
// 登记行守卫(与 dep-advisory-radar 共用同一份):hex 串在台账行里会被守门 117 当短 sha 拒落。
import { sanitizeHexRuns } from './lib/triage-doc-line.mjs'
// 挑族用的判据 = 第一发号出口那一份(本器只调用、不复制;详见文件头"取号族现读"段)。
import { resolveIdTokens } from './live-doc-edit.mjs'
import { collectIdFace } from './lib/plan-id-face.mjs'
import { machineIdentity, describeExhaustion } from './lib/plan-id-lease.mjs'
import { TASK_ID_PATTERN } from './check-plan-line-loss.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_JSON = join(ROOT, 'scripts', 'data', 'auto-triage-config.json')
const TRIAGE_LEDGER = join(ROOT, '.ihui-agent', 'state', 'auto-triage-ledger.jsonl')
const MAIL_LEDGER = join(ROOT, '.ihui-agent', 'state', 'mail-send-ledger.jsonl')
const INDEX_AGE_SCRIPT = join(ROOT, 'scripts', 'check-index-unmerged-age.mjs')
const LIVE_DOC_EDIT = join(ROOT, 'scripts', 'live-doc-edit.mjs')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'auto-triage')
const APP_ENV = join(ROOT, 'apps', 'api', '.env')
const API_LOGS_DEFAULT_LIMIT = 500
/** user-feedback 只读查询默认行上限(与 api_logs 同档纪律:超夹回落默认)。 */
const FEEDBACKS_DEFAULT_LIMIT = 200
const CLUSTER_WINDOW_HOURS_DEFAULT = 24
const CLUSTER_MIN_OCCURRENCES_DEFAULT = 2
/** 登记目标文档(与 live-doc-edit 的缺省同一枚,不另开一条面)。 */
const PLAN_DOC = 'PROJECT_PLAN.md'
/**
 * 挑族探针的行标题。必须**永远不会**与真登记同题(resolveIdTokens 内含守门 194 同题查重,
 * 探针撞上既有行会被读成 duplicate-title ⇒ 把"这族其实能发"误报成"这族不行"),
 * 也必须不会被当成一条真登记抄进台账 ⇒ 带 PROBE 字样。探针零写盘,标题不进台账。
 */
const PROBE_TITLE = '[auto-triage 取号族探针·不落台账] 现读哪一族发得出号'
/** 一族被拒后最多再试几枚可发族(spawn 一次 live-doc-edit 就是几分钟级,不设无限重试)。 */
const FAMILY_FALLBACK_MAX_SPAWNS = 3

export class TriageShapeError extends Error {}

export function loadConfig(readFile = (p) => readFileSync(p, 'utf8')) {
  let g
  try {
    g = JSON.parse(readFile(CONFIG_JSON))
  } catch (e) {
    throw new TriageShapeError(`分诊配置读不到或非法 JSON(${CONFIG_JSON}):${e?.message ?? e}`)
  }
  if (typeof g.enabled !== 'boolean') throw new TriageShapeError('形状坏:enabled 必须是 boolean')
  if (!Number.isInteger(g.dailyRegistrationQuota) || g.dailyRegistrationQuota <= 0) {
    throw new TriageShapeError('形状坏:dailyRegistrationQuota 必须是正整数')
  }
  if (!Array.isArray(g.sources) || g.sources.length === 0) {
    throw new TriageShapeError('形状坏:sources 必须是非空数组(第一期只吃白名单源)')
  }
  const KNOWN = ['mail-failure', 'index-unmerged', 'api-logs', 'grafana-alerts', 'user-feedback']
  for (const s of g.sources) {
    if (!KNOWN.includes(s))
      throw new TriageShapeError(`形状坏:未知来源「${s}」(白名单闭集:${KNOWN.join('/')})`)
  }
  if (g.clustering !== undefined) {
    if (!g.clustering || typeof g.clustering !== 'object' || Array.isArray(g.clustering)) {
      throw new TriageShapeError('形状坏:clustering 必须是对象')
    }
    for (const k of ['windowHours', 'minOccurrences']) {
      const v = g.clustering[k]
      if (v !== undefined && (!Number.isInteger(v) || v <= 0)) {
        throw new TriageShapeError(`形状坏:clustering.${k} 必须是正整数`)
      }
    }
    if (g.clustering.minOccurrences !== undefined && g.clustering.minOccurrences < 2) {
      throw new TriageShapeError('形状坏:clustering.minOccurrences 不得小于 2(单次不得直接派单)')
    }
  }
  if (g.apiLogs !== undefined && (typeof g.apiLogs !== 'object' || Array.isArray(g.apiLogs))) {
    throw new TriageShapeError('形状坏:apiLogs 必须是对象')
  }
  if (
    g.apiLogs?.rowLimit !== undefined &&
    (!Number.isInteger(g.apiLogs.rowLimit) || g.apiLogs.rowLimit <= 0)
  ) {
    throw new TriageShapeError('形状坏:apiLogs.rowLimit 必须是正整数')
  }
  if (
    g.apiLogs?.minStatus !== undefined &&
    (!Number.isInteger(g.apiLogs.minStatus) ||
      g.apiLogs.minStatus < 400 ||
      g.apiLogs.minStatus > 599)
  ) {
    throw new TriageShapeError('形状坏:apiLogs.minStatus 必须是 400..599 的整数')
  }
  for (const k of ['grafanaAlerts', 'userFeedback']) {
    const v = g[k]
    if (v !== undefined && (typeof v !== 'object' || Array.isArray(v))) {
      throw new TriageShapeError(`形状坏:${k} 必须是对象`)
    }
  }
  return g
}

/** 聚类档位(单源默认值;caller 不得各自写死 24/2) */
export function clusteringOf(cfg) {
  return {
    windowHours: cfg?.clustering?.windowHours ?? CLUSTER_WINDOW_HOURS_DEFAULT,
    minOccurrences: cfg?.clustering?.minOccurrences ?? CLUSTER_MIN_OCCURRENCES_DEFAULT,
  }
}

/** 发现指纹:同源去重的键(与日期无关,靠台账 24h 窗判新旧) */
export function fingerprintOf(source, objectText) {
  return createHash('sha256')
    .update(`${source}|${String(objectText)}`)
    .digest('hex')
    .slice(0, 12)
}

/**
 * 错误签名归一:把「同一缺陷的不同请求」收敛到同一桶。
 * 顺序敏感 —— URL(含查询串)先整段归零,UUID 先于数字,时间戳先于数字,长 hex 先于数字;
 * 之后任何数字段一律 :n。归一后才进 fingerprintOf,判据只有这一份。
 */
export function normalizeSignature(text, maxLen = 240) {
  let s = String(text ?? '')
  s = s.replace(/https?:\/\/[^\s"'<>`]+/gi, ':url')
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ':uuid')
  s = s.replace(
    /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,
    ':ts',
  )
  s = s.replace(/\b[0-9a-f]{16,}\b/gi, ':hash')
  s = s.replace(/\?[^\s#]*/g, '?')
  s = s.replace(/\d+/g, ':n')
  s = s.replace(/\s+/g, ' ').trim().toLowerCase()
  return s.slice(0, maxLen)
}

/**
 * 按归一签名聚类(时间窗 + 阈值单源)。
 * records: [{ at, objectText, label?, evidence? }];at 不可解或落在窗外 ⇒ 不计(不猜)。
 * 返回按 count 降序的桶:register(count >= minOccurrences) / observe。
 */
export function clusterRecords({
  source,
  records,
  windowHours = CLUSTER_WINDOW_HOURS_DEFAULT,
  minOccurrences = CLUSTER_MIN_OCCURRENCES_DEFAULT,
  now = Date.now(),
}) {
  const windowMs = windowHours * 3600_000
  const buckets = new Map()
  for (const r of records ?? []) {
    const ts = Date.parse(String(r?.at ?? ''))
    if (!Number.isFinite(ts)) continue
    if (now - ts > windowMs) continue
    if (ts - now > 3600_000) continue
    const signature = normalizeSignature(r.objectText)
    if (!signature) continue
    const fingerprint = fingerprintOf(source, signature)
    const cur = buckets.get(fingerprint) ?? {
      source,
      signature,
      fingerprint,
      label: String(r.label ?? signature).slice(0, 100),
      count: 0,
      lastAt: null,
      evidence: '',
    }
    cur.count += 1
    if (!cur.lastAt || ts >= cur.lastAt) {
      cur.lastAt = ts
      if (r.label) cur.label = String(r.label).slice(0, 100)
      if (r.evidence) cur.evidence = String(r.evidence).slice(0, 180)
    }
    buckets.set(fingerprint, cur)
  }
  return [...buckets.values()]
    .map((b) => ({
      ...b,
      lastAt: b.lastAt === null ? null : new Date(b.lastAt).toISOString(),
      disposition: b.count >= minOccurrences ? 'register' : 'observe',
    }))
    .sort((a, b) => b.count - a.count || String(a.signature).localeCompare(String(b.signature)))
}

/** 读 JSONL 夹具(坏行跳过;文件读不到由 caller 落未判定) */
export function readJsonlRows(path, readFile = (p) => readFileSync(p, 'utf8')) {
  return readFile(path)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function readAppEnvText() {
  try {
    return readFileSync(APP_ENV, 'utf8')
  } catch {
    return ''
  }
}

/** api_logs 只读查询(单语句;过 psqlSpawn 的只读断言,禁分号) */
export function buildApiLogsSql(limit = API_LOGS_DEFAULT_LIMIT, minStatus = 500) {
  const n = Number.isInteger(limit) && limit > 0 && limit <= 5000 ? limit : API_LOGS_DEFAULT_LIMIT
  const min = Number.isInteger(minStatus) && minStatus >= 400 && minStatus <= 599 ? minStatus : 500
  return [
    'SELECT method,',
    "replace(path, '|', '%7C'),",
    'status_code,',
    "replace(replace(coalesce(error, ''), E'\\n', ' '), '|', '/'),",
    'created_at::text',
    'FROM api_logs',
    "WHERE created_at > now() - interval '24 hours'",
    `AND status_code >= ${min}`,
    'ORDER BY created_at DESC',
    `LIMIT ${n}`,
  ].join(' ')
}

/** psql -At 输出 → 记录(at 用 created_at 原文,解析在聚类层做) */
export function parseApiLogRows(stdout) {
  return String(stdout ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [method, path, statusCode, error, at] = line.split('|')
      return {
        at,
        method,
        path,
        statusCode,
        label: `${method} ${normalizeSignature(path)} ${statusCode}`.trim(),
        objectText: `${method} ${path} ${statusCode} ${error}`,
        evidence: `${method} ${path} → ${statusCode}${error ? ` ${error}` : ''}`,
      }
    })
}

/** 夹具行兼容 DB 列名与驼峰;语义过滤在适配器做(仅 status >= minStatus) */
export function apiLogRowsFromObjects(rows, minStatus = 500) {
  const out = []
  for (const r of rows ?? []) {
    const method = String(r?.method ?? '')
    const path = String(r?.path ?? '')
    const statusCode = r?.statusCode ?? r?.status_code
    const error = String(r?.error ?? '')
    const at = r?.at ?? r?.createdAt ?? r?.created_at
    if (!path || !Number.isFinite(Number(statusCode))) continue
    if (Number(statusCode) < minStatus) continue
    out.push({
      at,
      method,
      path,
      statusCode,
      label: `${method} ${normalizeSignature(path)} ${statusCode}`.trim(),
      objectText: `${method} ${path} ${statusCode} ${error}`,
      evidence: `${method} ${path} → ${statusCode}${error ? ` ${error}` : ''}`,
    })
  }
  return out
}

/**
 * api-logs 适配器:
 *  - 有 JSONL 夹具 ⇒ 只读夹具(测试/离线取证一律走这条,不连库);
 *  - 无夹具 ⇒ 真库只读 SELECT,连接器复用现役 psql 定位 + DSN 解析 + 只读断言 + 回环/8810 守卫。
 * 取不到任何一面 ⇒ 未判定(§0.3)。
 */
export function readApiLogs({
  jsonlPath = '',
  limit = API_LOGS_DEFAULT_LIMIT,
  minStatus = 500,
  readFile = (p) => readFileSync(p, 'utf8'),
} = {}) {
  if (jsonlPath) {
    try {
      return {
        status: 'ok',
        records: apiLogRowsFromObjects(readJsonlRows(jsonlPath, readFile), minStatus),
      }
    } catch (e) {
      return { status: 'undetermined', why: `api_logs 夹具读不到(${jsonlPath}):${e?.message ?? e}` }
    }
  }
  const located = locatePsqlClient()
  if (!located.psql) return { status: 'undetermined', why: psqlLocateMissText(located.tried) }
  const dsnRes = resolveDsn({ envText: readAppEnvText() })
  if (!dsnRes.ok) return { status: 'undetermined', why: dsnRes.why }
  const guarded = guardDbDsn(dsnRes.dsn)
  if (!guarded.ok) return { status: 'undetermined', why: guarded.why }
  let r
  try {
    r = psqlSpawn(located.psql, guarded.dsn, buildApiLogsSql(limit, minStatus))
  } catch (e) {
    return { status: 'undetermined', why: `api_logs 只读查询不可发:${e?.message ?? e}` }
  }
  if (r.status !== 0) {
    return {
      status: 'undetermined',
      why: `api_logs 只读查询失败:${String(r.stderr || r.lost || `exit ${r.status}`)
        .trim()
        .slice(0, 160)}`,
    }
  }
  return { status: 'ok', records: parseApiLogRows(r.stdout) }
}

/** 告警读取地址:配置优先,其次 ALERTMANAGER_URL(与 apps/api/admin-ops-wallboard 同源);皆空 ⇒ 空串 */
export function grafanaAlertsUrlOf(cfg, env = process.env) {
  const fromCfg = String(cfg?.grafanaAlerts?.url ?? '').trim()
  if (fromCfg) return fromCfg
  return String(env.ALERTMANAGER_URL ?? '').trim()
}

/** Alertmanager v2 告警对象 → 聚类记录(纯函数;signature 不含 instance,同缺陷多实例才收敛) */
export function grafanaAlertRecords(alerts, now = Date.now()) {
  const out = []
  for (const a of alerts ?? []) {
    if (!a || typeof a !== 'object') continue
    if (a.status?.state && a.status.state !== 'active') continue
    const labels = a.labels ?? {}
    const annotations = a.annotations ?? {}
    const alertname = String(labels.alertname ?? '(未命名告警)')
    const severity = String(labels.severity ?? 'unknown')
    const instance = String(labels.instance ?? '-')
    const summary = String(annotations.summary ?? annotations.description ?? '').slice(0, 200)
    out.push({
      at: a.startsAt ?? new Date(now).toISOString(),
      label: `${alertname}(${severity})`,
      objectText: `${alertname}|${severity}|${summary}`,
      evidence: `${alertname} severity=${severity} instance=${instance}${summary ? ` summary=${summary}` : ''}`,
    })
  }
  return out
}

async function fetchJsonDefault(url) {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * grafana-alerts 适配器:Alertmanager GET /api/v2/alerts?active=true&silenced=false。
 * 无 URL / 连不上 / 非 JSON ⇒ 未判定(不把读不到当"无告警")。测试注入 fetchJson,不发网络。
 */
export async function readGrafanaAlerts({
  url = '',
  fetchJson = fetchJsonDefault,
  now = Date.now(),
} = {}) {
  const base = String(url ?? '')
    .trim()
    .replace(/\/+$/, '')
  if (!base) {
    return {
      status: 'undetermined',
      why: '无 Grafana/Alertmanager 读取地址(grafanaAlerts.url 与 ALERTMANAGER_URL 皆空),不猜本机默认口',
    }
  }
  let data
  try {
    data = await fetchJson(`${base}/api/v2/alerts?active=true&silenced=false`)
  } catch (e) {
    return { status: 'undetermined', why: `告警接口取不到:${e?.message ?? e}` }
  }
  if (!Array.isArray(data)) return { status: 'undetermined', why: '告警接口返回不是数组,形状未知' }
  return { status: 'ok', records: grafanaAlertRecords(data, now) }
}

/**
 * user-feedback 适配器:feedbacks 表只有 API 路由,scripts 层无既有消费面 ⇒
 * 只吃既有导出面落盘的 JSONL(不新开路由/不迁移)。导出件缺失 ⇒ 未判定并点名。
 */
/**
 * 反馈只读 SQL(单语句,过 psqlSpawn 的只读断言;禁分号)。
 * 刻意不取 user_id / contact / admin_reply —— 本器把候选写进共享台账,隐私列一律不出库。
 */
export function buildFeedbacksSql(limit = FEEDBACKS_DEFAULT_LIMIT) {
  const n = Number.isInteger(limit) && limit > 0 && limit <= 2000 ? limit : FEEDBACKS_DEFAULT_LIMIT
  return [
    'SELECT type,',
    "replace(replace(coalesce(title, ''), E'\\n', ' '), '|', '/'),",
    "replace(replace(coalesce(content, ''), E'\\n', ' '), '|', '/'),",
    'status,',
    'created_at::text',
    'FROM feedbacks',
    "WHERE status NOT IN ('resolved', 'closed')",
    "AND type IN ('bug', 'feature', 'improvement', 'other')",
    'ORDER BY created_at DESC',
    `LIMIT ${n}`,
  ].join(' ')
}

/** psql raw 行(`|` 分隔)→ 聚类记录;与 JSONL 夹具同形,两条通道产出的记录不可区分。 */
export function parseFeedbackRows(stdout) {
  const actionable = new Set(['bug', 'feature', 'improvement', 'other'])
  const out = []
  for (const line of String(stdout ?? '')
    .split(/\r?\n/)
    .filter(Boolean)) {
    const [type, title = '', content = '', status = 'pending', at] = line.split('|')
    if (!actionable.has(type)) continue
    if (status === 'resolved' || status === 'closed') continue
    if (!title && !content) continue
    out.push({
      at,
      label: `${type}:${title || content}`.slice(0, 100),
      objectText: `${type}|${title}|${content}`,
      evidence: `type=${type} status=${status} title=${title}${content ? ` content=${content.slice(0, 120)}` : ''}`,
    })
  }
  return out
}

/**
 * user-feedback 默认取数通道:与 api_logs 走**同一条**出口(locatePsqlClient + resolveDsn +
 * guardDbDsn 的回环/8810 守卫 + psqlSpawn 只读断言),不另起第二份连接实现(§0.6)。
 * 取不到一律 status:'undetermined' 并点名原因 —— 绝不把"读不到"写成"没有反馈"。
 */
export function feedbackRowsByQuery(limit = FEEDBACKS_DEFAULT_LIMIT) {
  const located = locatePsqlClient()
  if (!located.psql)
    return {
      status: 'undetermined',
      why: `user-feedback 直连取数不可发:${psqlLocateMissText(located.tried)}`,
    }
  const dsnRes = resolveDsn({ envText: readAppEnvText() })
  if (!dsnRes.ok) return { status: 'undetermined', why: dsnRes.why }
  const guarded = guardDbDsn(dsnRes.dsn)
  if (!guarded.ok) return { status: 'undetermined', why: guarded.why }
  let r
  try {
    r = psqlSpawn(located.psql, guarded.dsn, buildFeedbacksSql(limit))
  } catch (e) {
    return { status: 'undetermined', why: `user-feedback 只读查询不可发:${e?.message ?? e}` }
  }
  if (r.status !== 0) {
    return {
      status: 'undetermined',
      why: `user-feedback 只读查询失败:${String(r.stderr || r.lost || `exit ${r.status}`)
        .trim()
        .slice(0, 160)}`,
    }
  }
  return { status: 'ok', records: parseFeedbackRows(r.stdout) }
}

export function readUserFeedback({
  jsonlPath = '',
  limit = FEEDBACKS_DEFAULT_LIMIT,
  readFile = (p) => readFileSync(p, 'utf8'),
  query = feedbackRowsByQuery,
} = {}) {
  if (!jsonlPath) {
    return query(limit)
  }
  let rows
  try {
    rows = readJsonlRows(jsonlPath, readFile)
  } catch (e) {
    return { status: 'undetermined', why: `用户反馈导出件读不到(${jsonlPath}):${e?.message ?? e}` }
  }
  const actionable = new Set(['bug', 'feature', 'improvement', 'other'])
  const records = []
  for (const r of rows) {
    const status = String(r?.status ?? 'pending')
    if (status === 'resolved' || status === 'closed') continue
    const type = String(r?.type ?? 'other')
    if (!actionable.has(type)) continue
    const title = String(r?.title ?? '')
    const content = String(r?.content ?? '')
    if (!title && !content) continue
    records.push({
      at: r?.at ?? r?.createdAt ?? r?.created_at,
      label: `${type}:${title || content}`.slice(0, 100),
      objectText: `${type}|${title}|${content}`,
      evidence: `type=${type} status=${status} title=${title}${content ? ` content=${content.slice(0, 120)}` : ''}`,
    })
  }
  return { status: 'ok', records }
}

/** 来源一:邮件投递台账 24h 窗 failed 计数(§5e-3 schema 2;读不到 = 未判定) */
export function readMailFailures(readFile = (p) => readFileSync(p, 'utf8'), now = Date.now()) {
  let rows
  try {
    rows = readFile(MAIL_LEDGER).split(/\r?\n/).filter(Boolean)
  } catch {
    return { status: 'undetermined', why: '投递台账读不到(通道尚未发过信)' }
  }
  let failed24h = 0
  let lastWhy = ''
  for (const line of rows) {
    try {
      const r = JSON.parse(line)
      if (r.disposition !== 'failed') continue
      const ts = Date.parse(r.at)
      if (!Number.isFinite(ts) || now - ts > 24 * 3600_000) continue
      failed24h++
      if (r.why) lastWhy = String(r.why).slice(0, 120)
    } catch {
      /* 坏行跳过,不算发现也不算未判定 */
    }
  }
  return { status: 'ok', failed24h, lastWhy }
}

/** 来源二:index 烂尾哨兵 --json(子进程现跑;取不到 = 未判定) */
export function readIndexUnmerged(spawn = (...a) => spawnSync(...a)) {
  const r = spawn(process.execPath, [INDEX_AGE_SCRIPT, '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 60_000,
    encoding: 'utf8',
  })
  if (r.error || r.status !== 0)
    return { status: 'undetermined', why: `哨兵跑不出(rc=${r.status ?? '?'})` }
  try {
    const j = JSON.parse(
      String(r.stdout ?? '')
        .trim()
        .split(/\r?\n/)
        .pop(),
    )
    // 判据:有未合并条目且龄龄到阈(哨兵自己判 staleMin,分诊器只消费它的机读结论)
    if (j.overall === 'undetermined') return { status: 'undetermined', why: String(j.detail ?? '') }
    const stale = Number(j.count) > 0 && Number(j.ageMin) >= Number(j.staleMin)
    return { status: 'ok', stale, count: Number(j.count) || 0, ageMin: j.ageMin ?? null }
  } catch (e) {
    return { status: 'undetermined', why: `读数解析失败:${e?.message ?? e}` }
  }
}

/** 读本器台账(坏行跳过) */
export function readTriageLedger(readFile = (p) => readFileSync(p, 'utf8')) {
  try {
    return readFile(TRIAGE_LEDGER)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function appendLedger(entry) {
  const lines = readTriageLedger()
  lines.push({ ts: new Date().toISOString(), ...entry })
  writeFileSync(TRIAGE_LEDGER, lines.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
}

/** 今日已登记数(本器台账现读,配额判据;两面都按本地日切,不用 UTC 串直接比本地串) */
export function registeredToday(ledger, now = new Date()) {
  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const key = ymd(now)
  return ledger.filter((e) => {
    if (e.action !== 'registered') return false
    const ts = Date.parse(String(e.ts ?? ''))
    return Number.isFinite(ts) && ymd(new Date(ts)) === key
  }).length
}

/** 24h 窗同指纹去重 */
export function recentlyRegistered(ledger, fp, now = Date.now()) {
  return ledger.some(
    (e) =>
      e.action === 'registered' && e.fingerprint === fp && now - Date.parse(e.ts) < 24 * 3600_000,
  )
}

/**
 * 纯函数:把「已聚类候选」推成「待办动作清单」(不读钟/不写台账/不连登记入口)。
 *
 * 判定口径与 runOnce 原内联循环逐字一致,只是把 IO(appendLedger/registerToPlan/console/exit)
 * 全部挪到执行侧,使「归一 → 聚类 → 产出待办」这一段可独立单测、可重放。
 *
 * 入参:
 *  - findings:    clusterRecords 产出的候选
 *                 [{source, disposition:'register'|'observe', fp, title, evidence}]
 *  - ledger:     本器台账行(用于 24h 同指纹去重与当日配额计数)
 *  - dailyQuota: 每日登记配额(正整数)
 *  - now:        注入时钟(纯函数必需;默认 Date.now(),生产侧传单一时间点)
 * 返回 { quotaUsed, actions }:
 *  - actions[].action ∈ 'register' | 'observed' | 'quota-deferred' | 'skip-dedupe'
 *  - quotaUsed: 若全部 register 真落库后的当日已登记数(供执行侧对账;dry-run 同口径占额)
 */
export function planTriageActions({
  findings = [],
  ledger = [],
  dailyQuota = 0,
  now = Date.now(),
} = {}) {
  let quotaUsed = registeredToday(ledger, new Date(now))
  const actions = []
  for (const f of findings) {
    if (f.disposition !== 'register') {
      actions.push({ ...f, action: 'observed' })
      continue
    }
    if (recentlyRegistered(ledger, f.fp, now)) {
      actions.push({ ...f, action: 'skip-dedupe' })
      continue
    }
    if (quotaUsed >= dailyQuota) {
      actions.push({ ...f, action: 'quota-deferred' })
      continue
    }
    quotaUsed += 1
    actions.push({ ...f, action: 'register', quotaUsed })
  }
  return { quotaUsed, actions }
}

/**
 * 候选族的字母表:由编号族表唯一真相源 `TASK_ID_PATTERN` 现解析,本器不抄第二份族表(§0.6)。
 * 每个备选项取**起始字母串**(G-\d+ → G、WP-?\d+ → WP、守门\s*\d+ → 无起始字母 ⇒ 天然出局),
 * 顺序 = 族表自身顺序(G 居首 ⇒ 与 2026-10-26 接线时的行为逐字同序,族表永远是上游)。
 * 输入坏/为空 ⇒ 空数组(调用方落未判定,不猜族)。
 */
export function idFamilyLetters(pattern = TASK_ID_PATTERN) {
  const out = []
  for (const alt of String(pattern ?? '').split('|')) {
    const m = /^[A-Za-z]+/.exec(alt)
    if (!m) continue
    const fam = m[0].toUpperCase()
    if (!out.includes(fam)) out.push(fam)
  }
  return out
}

/**
 * 单族只读探针:把一行带令牌的登记行交给**唯一分配判据** `resolveIdTokens`,读它当场给的结论。
 * 本器不在此判"什么算一个号 / 哪个号空闲" —— 那些判据一概住在 live-doc-edit + lib 那一份里,
 * 这里只搬运读数(ok / reason / exhaustion),并在族表不认这台机时如实落 undetermined。
 * 返回 { family, ok, label?, status, reason?, exhaustion?, why? }:
 *  - ok ⇒ status='issuable',label = 探针行现算出的编号形状(取自 resolveIdTokens 改写后的行首,
 *    本器不做任何号算术);
 *  - `pool-exhausted:<族>` ⇒ status='exhausted',exhaustion 读数原样交出(成因句由 lib 渲染);
 *  - `no-such-family:<族>` ⇒ status='no-rows'(该族在底稿一条登记行都没有 ⇒ 首行须手填开族,非本器职权);
 *  - 其余 reason / 抛异常 ⇒ status='rejected' 或 'undetermined',绝不冒充"能发"。
 */
export function probeIdFamily(
  family,
  { faceText, worktreeText = null, machineId, resolve = resolveIdTokens } = {},
) {
  const row = `- [ ] {{NEXT_ID:${family}}} ${PROBE_TITLE}`
  let r
  try {
    r = resolve([row], faceText, null, { machineId, worktreeText })
  } catch (e) {
    return {
      family,
      ok: false,
      status: 'undetermined',
      why: `探针异常:${String(e?.message ?? e).slice(0, 160)}`,
    }
  }
  if (!r || typeof r !== 'object')
    return { family, ok: false, status: 'undetermined', why: '探针返回形状未知' }
  if (r.ok) {
    const label = String(r.lines?.[0] ?? '')
      .replace(/^\s*-\s*\[[ x]\]\s*/, '')
      .split(/\s/)[0]
    return { family, ok: true, status: 'issuable', label: label || null }
  }
  const reason = String(r.reason ?? '')
  const status = reason.startsWith('pool-exhausted')
    ? 'exhausted'
    : reason.startsWith('no-such-family')
      ? 'no-rows'
      : 'rejected'
  return { family, ok: false, status, reason, exhaustion: r.exhaustion ?? null, why: reason }
}

/**
 * 按现读挑一族真发得出号的字母族(排序 = 族表顺序,首个探针点头即用,其余仍全部探完 ⇒
 * `--families` 与登记失败后的次名重试都读同一张表,不必再探一遍)。
 * 底稿取不到 ⇒ { ok:false, undetermined:true } 并点名原因(§0.3:没判绝不写成判过);
 * 全部探完无一族可发 ⇒ { ok:false } 带逐族成因(lib 渲染,本器不拼句子)。
 */
export function pickIdFamily({
  faceText,
  worktreeText = null,
  machineId,
  families = idFamilyLetters(),
  resolve = resolveIdTokens,
} = {}) {
  if (typeof faceText !== 'string' || !faceText.trim())
    return {
      ok: false,
      undetermined: true,
      why: '取号底稿面读不到 ⇒ 族未判定(不猜哪一族有空)',
      readings: [],
      faceNotes: [],
    }
  if (!Array.isArray(families) || families.length === 0)
    return {
      ok: false,
      undetermined: true,
      why: `编号族表现解析出 0 枚字母族(TASK_ID_PATTERN 形状坏了 ⇒ 族表本身要先修)`,
      readings: [],
      faceNotes: [],
    }
  const readings = families.map((f) => probeIdFamily(f, { faceText, worktreeText, machineId, resolve }))
  const first = readings.find((r) => r.ok)
  return {
    ok: Boolean(first),
    undetermined: false,
    family: first?.family ?? null,
    token: first ? `{{NEXT_ID:${first.family}}}` : null,
    label: first?.label ?? null,
    readings,
    faceNotes: [],
    why: first
      ? null
      : `无一族现读可发号(${readings
          .map((r) => `${r.family}:${r.status}${r.exhaustion?.stage ? `/${r.exhaustion.stage}` : ''}`)
          .join(' ')})`,
  }
}

/**
 * 从台账现读取号面并挑族(IO 只在这一层:宽面取材走 lib/plan-id-face 那一份、机器标识走 lib 那一份)。
 * `face` 供测试注入(夹具级正控只需一段台账文本,不碰真仓);工作树副本读不到 ⇒ 少一维并出声
 * (与 live-doc-edit / next-plan-id 同一档:新增维度缺席不得把入口堵得比改前更死)。
 */
export function pickRegistrationFamily({
  root = ROOT,
  doc = PLAN_DOC,
  source = 'HEAD',
  face = null,
  resolve = resolveIdTokens,
  machineId = machineIdentity(root),
  collect = collectIdFace,
  readFile = (p) => readFileSync(p, 'utf8'),
} = {}) {
  let faceText = null
  let worktreeText = null
  const notes = []
  if (typeof face?.faceText === 'string') {
    faceText = face.faceText
    if (typeof face.worktreeText === 'string') worktreeText = face.worktreeText
  } else {
    let cf
    try {
      cf = collect({ root, source, doc })
    } catch (e) {
      return {
        ok: false,
        undetermined: true,
        why: `占用面取材异常:${String(e?.message ?? e).slice(0, 160)}`,
        readings: [],
        faceNotes: [],
      }
    }
    if (!cf?.ok || (cf.undetermined ?? []).length > 0)
      return {
        ok: false,
        undetermined: true,
        why: `占用面判不出(${(cf?.undetermined ?? []).join(';') || '面不完整'})⇒ 不猜族`,
        readings: [],
        faceNotes: (cf?.notes ?? []).slice(),
      }
    faceText = cf.text
    try {
      worktreeText = readFile(join(root, doc))
    } catch (e) {
      notes.push(
        `工作树副本 ${doc} 读不到(${String(e?.message ?? e).split(/\r?\n/)[0].slice(0, 120)})⇒ 探针少这一维`,
      )
    }
  }
  const picked = pickIdFamily({ faceText, worktreeText, machineId, resolve })
  return { ...picked, faceNotes: [...notes, ...picked.faceNotes] }
}

/**
 * 登记:构造块文件走 live-doc-edit 子进程(唯一登记入口;它自带取号面/CAS/幂等判据)。
 * 登记行带新鲜日期交代(三选一之一);同题查重由「标题逐字」承担(守门 203),指纹只进台账。
 * 取号写 `{{NEXT_ID:族}}` 令牌,**族字母由 pickRegistrationFamily 现读给出**(2026-10-29 起):
 * 本器仍不自己拼号 —— 号由 live-doc-edit 在每次 CAS 尝试里按当下 HEAD 现算,本器只挑字母族。
 * `family` 缺省 'G' 只为一件事:既有镜像测试与外部调用方对"没给族"的行为逐字不变。
 * 指纹**只留台账**(同源 24h 去重),不写进登记行:实测 12 位十六进制指纹会被守门 117(短 sha)
 * 判住、整块拒落 —— 身份不进文档,明细走台账/提交信息(§1 证据指针纪律)。
 * 〔更正@2026-10-29,上一条写死的「{{NEXT_ID:G}}」是**常量**不是族表,只作改判留痕读〕:2026-10-26
 * 接线当日 G 族对本席可发,四天后它就被 G-14 引用面灭窗(stage=scan-filter),于是产线从"能登记"
 * 退化成"每天写一条 register-failed"(现读分诊台账 375 行:observed 252 / register-failed 123 /
 * **registered 0**)。族字母写死 = 把"哪天这一族满"烘进代码(§0.9 判据要在真跑那一刻才成立)。
 * ⇒ 族字母改由 `pickRegistrationFamily()` 现读:候选字母来自族表唯一真相源,能不能发由第一发号
 *   出口那一份判据当场给,本器仍**一个号都不自算**(手填/自算号在并发仓必撞号,§1 登记铁律不变)。
 */
export function registerToPlan(
  { source, fingerprint, title, evidence, family = 'G' },
  spawn = (...a) => spawnSync(...a),
) {
  const fam = /^[A-Za-z]+$/.test(String(family ?? '')) ? String(family) : 'G'
  mkdirSync(TMP_DIR, { recursive: true })
  const blockFile = join(TMP_DIR, `reg-${fingerprint}.md`)
  const day = new Date().toISOString().slice(0, 10)
  const block = [
    sanitizeHexRuns(
      `- [ ] {{NEXT_ID:${fam}}} [auto-triage] ${title}(登记@${day}/auto-triage;来源:${source} 哨兵;证据:${evidence})`,
    ),
  ].join('\n')
  writeFileSync(blockFile, block, 'utf8')
  const r = spawn(process.execPath, [LIVE_DOC_EDIT], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 120_000,
    encoding: 'utf8',
    env: {
      ...process.env,
      LIVE_DOC: 'PROJECT_PLAN.md',
      LIVE_BLOCK_FILE: blockFile,
      LIVE_MSG: `docs(plan): auto-triage 自动登记(${source};第 1 期感知层产线动作,O65)`,
    },
  })
  try {
    unlinkSync(blockFile)
  } catch {
    /* 用完即删 */
  }
  const okOut = /回读|已在位/.test(String(r.stdout ?? ''))
  if (r.status !== 0 && !okOut) {
    return {
      ok: false,
      family: fam,
      why: `live-doc-edit rc=${r.status}:${String(r.stderr ?? r.stdout ?? '').slice(-160)}`,
    }
  }
  return { ok: true, family: fam }
}

/**
 * 按现读可发族依次登记(出路那一格,2026-10-29):
 *  - 挑族结果不可发 ⇒ 一 spawn 都不发(未判定/pool 全灭都不许拿真登记去试错);
 *  - 首族被拒且属 `pool-exhausted`(探针与真落地之间 HEAD 会动)⇒ 次名族重试,≤3 枚;
 *  - 其余失败原因(同题查重 / 门禁红 / 面取不到)⇒ 不重试:重试不会变,只会把台账淹了。
 * 返回 { ok, family?, tried:[{family, ok, why}], why? },调用方只负责把读数写进分诊台账。
 */
export function registerWithFamilyFallback(
  { source, fingerprint, title, evidence },
  pick,
  spawn = (...a) => spawnSync(...a),
  { maxSpawns = FAMILY_FALLBACK_MAX_SPAWNS } = {},
) {
  if (!pick?.ok)
    return {
      ok: false,
      why: pick?.why ?? '取号族未判定 ⇒ 不发起任何登记',
      undetermined: pick?.undetermined === true,
      tried: [],
    }
  const candidates = (pick.readings ?? []).filter((r) => r.ok).map((r) => r.family)
  const list = candidates.length ? candidates : [pick.family]
  const tried = []
  for (const family of list.slice(0, Math.max(1, maxSpawns))) {
    const reg = registerToPlan({ source, fingerprint, title, evidence, family }, spawn)
    tried.push({ family, ok: reg.ok, why: reg.why ?? null })
    if (reg.ok) return { ok: true, family, tried }
    if (!/pool-exhausted/.test(String(reg.why ?? '')))
      return { ok: false, why: reg.why, tried }
  }
  return {
    ok: false,
    why: `现读可发族依次重试仍被拒(${tried.map((t) => t.family).join('/')}):${tried[tried.length - 1]?.why ?? ''}`,
    tried,
  }
}

async function runOnce({ dryRun = false } = {}) {
  let cfg
  try {
    cfg = loadConfig()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  if (!cfg.enabled && !dryRun) {
    console.log('⏸ 分诊未启用(auto-triage-config.json enabled=false)。')
    return
  }
  const ledger = readTriageLedger()
  console.log(
    `分诊轮:今日已登记 ${registeredToday(ledger)}/${cfg.dailyRegistrationQuota},台账 ${ledger.length} 行`,
  )
  const findings = []
  // 来源一:邮件投递连败
  if (cfg.sources.includes('mail-failure')) {
    const m = readMailFailures()
    if (m.status === 'undetermined') {
      console.log(`  ℹ mail-failure:未判定(${m.why})`)
    } else if (m.failed24h >= 6) {
      console.log(
        `  ⚠ mail-failure:24h failed=${m.failed24h} ≥6 ⇒ 观察类(升级量级,交既有到人链,不重复登记)`,
      )
      findings.push({
        source: 'mail-failure',
        disposition: 'observe',
        fp: fingerprintOf('mail-failure', 'burst'),
        title: '',
        evidence: `24h failed=${m.failed24h}`,
      })
    } else if (m.failed24h >= 2) {
      console.log(`  → mail-failure:24h failed=${m.failed24h} ∈[2,6) ⇒ 可派单(邮件通道排查)`)
      findings.push({
        source: 'mail-failure',
        disposition: 'register',
        fp: fingerprintOf('mail-failure', 'channel'),
        title: '邮件投递通道故障排查(24h 内连续失败 ≥2 封,查 SMTP 出口/进程/配额)',
        evidence: `failed=${m.failed24h}${m.lastWhy ? ` why=${m.lastWhy}` : ''}`,
      })
    } else {
      console.log(`  ✅ mail-failure:24h failed=${m.failed24h} ⇒ 无发现`)
    }
  }
  // 来源二:index 烂尾
  if (cfg.sources.includes('index-unmerged')) {
    const i = readIndexUnmerged()
    if (i.status === 'undetermined') {
      console.log(`  ℹ index-unmerged:未判定(${i.why})`)
    } else if (i.stale) {
      console.log(`  ⚠ index-unmerged:count=${i.count} age=${i.ageMin}min ⇒ 观察类(既有到人链)`)
      findings.push({
        source: 'index-unmerged',
        disposition: 'observe',
        fp: fingerprintOf('index-unmerged', 'stale'),
        title: '',
        evidence: `count=${i.count} age=${i.ageMin}`,
      })
    } else {
      console.log(`  ✅ index-unmerged:无滞留 ⇒ 无发现`)
    }
  }
  const cluster = clusteringOf(cfg)
  // 来源三:api_logs 5xx/error 签名聚类(测试面走 JSONL 夹具;无夹具走真库只读)
  if (cfg.sources.includes('api-logs')) {
    const a = readApiLogs({
      jsonlPath: String(cfg.apiLogs?.jsonl ?? ''),
      limit: cfg.apiLogs?.rowLimit ?? API_LOGS_DEFAULT_LIMIT,
      minStatus: cfg.apiLogs?.minStatus ?? 500,
    })
    if (a.status === 'undetermined') {
      console.log(`  ℹ api-logs:未判定(${a.why})`)
    } else {
      const buckets = clusterRecords({ source: 'api-logs', records: a.records, ...cluster })
      if (buckets.length === 0) console.log('  ✅ api-logs:24h 窗内无 5xx/error 签名 ⇒ 无发现')
      for (const b of buckets) {
        console.log(
          `  ${b.disposition === 'register' ? '→' : '⚠'} api-logs:同签名 ${b.count} 次 ${b.label} ⇒ ${b.disposition === 'register' ? '可派单' : '观察类(单次不够格)'}`,
        )
        findings.push({
          source: 'api-logs',
          disposition: b.disposition,
          fp: b.fingerprint,
          title: `API 5xx 错误签名聚类(${b.label})`,
          evidence: `现象=24h 同签名 ${b.count} 次;归属面=apps/api 路由/中间件(api_logs);最小修法=按签名复现该请求并补参数校验/错误处理;最近样本:${b.evidence}`,
        })
      }
    }
  }
  // 来源四:Grafana/Alertmanager 告警机器可读面(无 URL/连不上 ⇒ 未判定)
  if (cfg.sources.includes('grafana-alerts')) {
    const g = await readGrafanaAlerts({ url: grafanaAlertsUrlOf(cfg) })
    if (g.status === 'undetermined') {
      console.log(`  ℹ grafana-alerts:未判定(${g.why})`)
    } else {
      const buckets = clusterRecords({ source: 'grafana-alerts', records: g.records, ...cluster })
      if (buckets.length === 0) console.log('  ✅ grafana-alerts:无活跃告警 ⇒ 无发现')
      for (const b of buckets) {
        console.log(
          `  ${b.disposition === 'register' ? '→' : '⚠'} grafana-alerts:同签名 ${b.count} 个活跃实例 ${b.label} ⇒ ${b.disposition === 'register' ? '可派单' : '观察类(单实例,已有到人链)'}`,
        )
        findings.push({
          source: 'grafana-alerts',
          disposition: b.disposition,
          fp: b.fingerprint,
          title: `告警簇聚类 ${b.label}`,
          evidence: `现象=24h 同签名 ${b.count} 个活跃实例;归属面=monitoring/prometheus/alerts.yml 与被监控对象;最小修法=按 summary 复核阈值/规则或修复被监控对象;最近样本:${b.evidence}`,
        })
      }
    }
  }
  // 来源五:用户反馈导出件(scripts 层无既有消费面 ⇒ 只吃既有导出 JSONL)
  if (cfg.sources.includes('user-feedback')) {
    const u = readUserFeedback({ jsonlPath: String(cfg.userFeedback?.jsonl ?? '') })
    if (u.status === 'undetermined') {
      console.log(`  ℹ user-feedback:未判定(${u.why})`)
    } else {
      const buckets = clusterRecords({ source: 'user-feedback', records: u.records, ...cluster })
      if (buckets.length === 0) console.log('  ✅ user-feedback:导出件无未结反馈 ⇒ 无发现')
      for (const b of buckets) {
        console.log(
          `  ${b.disposition === 'register' ? '→' : '⚠'} user-feedback:同签名 ${b.count} 条 ${b.label} ⇒ ${b.disposition === 'register' ? '可派单' : '观察类(单条不够格)'}`,
        )
        findings.push({
          source: 'user-feedback',
          disposition: b.disposition,
          fp: b.fingerprint,
          title: `用户反馈聚类 ${b.label}`,
          evidence: `现象=24h 同签名 ${b.count} 条未结反馈;归属面=apps/api feedbacks 路由与对应功能面;最小修法=按反馈内容复现并补处理;最近样本:${b.evidence}`,
        })
      }
    }
  }
  // 「归一→聚类→产出待办」决策层:纯函数推计划,IO 全部在执行侧(runOnce 不读钟/不判去重/不算配额)。
  const now = Date.now()
  const plan = planTriageActions({ findings, ledger, dailyQuota: cfg.dailyRegistrationQuota, now })
  for (const f of plan.actions) {
    if (f.action === 'observed') {
      if (dryRun) {
        console.log(`  · dry-run:观察类不登记(${f.source} ${f.evidence})`)
        continue
      }
      appendLedger({
        mode: 'once',
        action: 'observed',
        source: f.source,
        fingerprint: f.fp,
        why: f.evidence,
      })
      continue
    }
    if (f.action === 'skip-dedupe') {
      console.log(`  ⏭ ${f.source} 24h 内已登记同指纹 ⇒ 跳过`)
      continue
    }
    if (f.action === 'quota-deferred') {
      console.log(`  ⏸ 每日登记配额已满 ⇒ ${f.source} 留台账待明日`)
      if (dryRun) continue
      appendLedger({
        mode: 'once',
        action: 'quota-deferred',
        source: f.source,
        fingerprint: f.fp,
        why: f.evidence,
      })
      continue
    }
    // f.action === 'register'
    // 取号族每次现读:上一枚登记会把 HEAD 推进,族的水位随之内变 —— 烘在轮首就等于又写死一次。
    const pick = pickRegistrationFamily()
    if (dryRun) {
      const how = pick.ok
        ? `族 ${pick.family}(探针现算首号 ${pick.label ?? '未量到'})`
        : `无一族可发号 ⇒ 真跑会落 register-failed(${pick.why})`
      console.log(`  ✅ dry-run:将登记「${f.title}」⇒ ${how}`)
      for (const n of pick.faceNotes ?? []) console.log(`     ℹ ${n}`)
      if (!pick.ok) process.exitCode = pick.undetermined ? 2 : 1
      // 与真跑同口径占配额:否则 dry-run 会把第 4 条也报成"将登记",与实跑配额不符
      continue
    }
    const reg = registerWithFamilyFallback(
      { source: f.source, fingerprint: f.fp, title: f.title, evidence: f.evidence },
      pick,
    )
    if (!reg.ok) {
      const cause = reg.tried?.[0]?.why ?? reg.why ?? ''
      console.error(`  ❌ 登记未判定:${cause}`)
      appendLedger({
        mode: 'once',
        action: 'register-failed',
        source: f.source,
        fingerprint: f.fp,
        why: cause,
        // 2026-10-29:拒发的**真成因**必须进台账,否则下一轮读到的还是"池已满"这句假话。
        // 成因句只住 lib 一份(describeExhaustion 按 stage 分档),本器不拼句子(§0.6)。
        exhaustions: (pick.readings ?? [])
          .filter((r) => r.exhaustion)
          .map((r) => ({ family: r.family, stage: r.exhaustion.stage ?? null })),
        causeNote:
          (pick.readings ?? [])
            .filter((r) => r.exhaustion)
            .map((r) => `${r.family}:${describeExhaustion(r.exhaustion)}`)
            .join(' | ') || null,
      })
      process.exitCode = 2
      continue
    }
    appendLedger({
      mode: 'once',
      action: 'registered',
      source: f.source,
      fingerprint: f.fp,
      why: f.evidence,
      family: reg.family,
      familiesTried: (reg.tried ?? []).map((t) => t.family),
    })
    console.log(`  ✅ 已登记(族 ${reg.family},本轮试过的族:${(reg.tried ?? []).map((t) => t.family).join('/')}):${f.title}`)
  }
}

async function selfTest() {
  let failed = 0
  const ok = (name, cond) => {
    if (cond) console.log(`  ✅ ${name}`)
    else {
      console.error(`  ❌ ${name}`)
      failed++
    }
  }
  console.log('self-test:')
  ok(
    'T1a 形状锁:合法配置过',
    (() => {
      try {
        return (
          loadConfig(() =>
            JSON.stringify({
              enabled: false,
              dailyRegistrationQuota: 3,
              sources: ['mail-failure'],
            }),
          ).enabled === false
        )
      } catch {
        return false
      }
    })(),
  )
  ok(
    'T1b 形状锁:未知来源拒',
    (() => {
      try {
        loadConfig(() =>
          JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['everything'] }),
        )
        return false
      } catch (e) {
        return e instanceof TriageShapeError
      }
    })(),
  )
  ok(
    'T1c 形状锁:配额 0 拒',
    (() => {
      try {
        loadConfig(() =>
          JSON.stringify({ enabled: true, dailyRegistrationQuota: 0, sources: ['mail-failure'] }),
        )
        return false
      } catch {
        return true
      }
    })(),
  )
  ok(
    'T1d 形状锁:新来源白名单过 / minOccurrences<2 拒',
    (() => {
      try {
        loadConfig(() =>
          JSON.stringify({
            enabled: true,
            dailyRegistrationQuota: 3,
            sources: ['api-logs', 'grafana-alerts', 'user-feedback'],
            clustering: { windowHours: 24, minOccurrences: 2 },
          }),
        )
      } catch {
        return false
      }
      try {
        loadConfig(() =>
          JSON.stringify({
            enabled: true,
            dailyRegistrationQuota: 3,
            sources: ['mail-failure'],
            clustering: { minOccurrences: 1 },
          }),
        )
        return false
      } catch {
        return true
      }
    })(),
  )
  ok(
    'T2a mail 台账缺 ⇒ 未判定(不记绿)',
    readMailFailures(() => {
      throw new Error('x')
    }).status === 'undetermined',
  )
  const now = Date.now()
  const rows = [
    JSON.stringify({
      at: new Date(now - 3600_000).toISOString(),
      disposition: 'failed',
      why: 'conn refused',
    }),
    JSON.stringify({
      at: new Date(now - 7200_000).toISOString(),
      disposition: 'failed',
      why: 'timeout',
    }),
    JSON.stringify({ at: new Date(now - 25 * 3600_000).toISOString(), disposition: 'failed' }),
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'delivered' }),
  ]
  const mail = readMailFailures(() => rows.join('\n'), now)
  ok('T2b 24h 窗计数(旧窗/成功不计)', mail.status === 'ok' && mail.failed24h === 2)
  ok('T2c 阈值分档:2 ⇒ register', mail.failed24h >= 2 && mail.failed24h < 6)
  ok(
    'T3 指纹稳定且区分源',
    fingerprintOf('a', 'x') === fingerprintOf('a', 'x') &&
      fingerprintOf('a', 'x') !== fingerprintOf('b', 'x'),
  )
  ok(
    'T6a 签名归一:UUID/数字/URL 查询串/时间戳归零',
    (() => {
      const a = normalizeSignature(
        'GET /api/u/550e8400-e29b-41d4-a716-446655440000?t=123 err at 2026-10-25T10:00:00Z code=42',
      )
      const b = normalizeSignature(
        'GET /api/u/123e4567-e89b-12d3-a456-426614174000?t=999 err at 2026-10-24T09:11:22Z code=7',
      )
      return a === b && a.includes(':uuid') && a.includes(':ts')
    })(),
  )
  ok(
    'T6b 签名归一:不同缺陷不并桶',
    normalizeSignature('boom timeout') !== normalizeSignature('boom conn refused'),
  )
  ok(
    'T7a 聚类:同桶 ≥2 可派单 / 单次观察',
    (() => {
      const recs = [
        {
          at: new Date(now - 3600_000).toISOString(),
          objectText: 'GET /api/a/1 500 boom',
          label: 'GET /api/a/:n 500',
          evidence: 'e1',
        },
        {
          at: new Date(now - 7200_000).toISOString(),
          objectText: 'GET /api/a/2 500 boom',
          label: 'GET /api/a/:n 500',
          evidence: 'e2',
        },
        {
          at: new Date(now - 3 * 3600_000).toISOString(),
          objectText: 'GET /api/b/9 500 timeout',
          label: 'GET /api/b/:n 500',
          evidence: 'e3',
        },
      ]
      const buckets = clusterRecords({
        source: 'api-logs',
        records: recs,
        windowHours: 24,
        minOccurrences: 2,
        now,
      })
      const a = buckets.find((b) => b.signature.includes('/api/a/'))
      const b = buckets.find((b) => b.signature.includes('/api/b/'))
      return (
        buckets.length === 2 &&
        a?.count === 2 &&
        a.disposition === 'register' &&
        b?.count === 1 &&
        b.disposition === 'observe'
      )
    })(),
  )
  ok(
    'T7b 聚类:24h 窗外不计',
    (() => {
      const buckets = clusterRecords({
        source: 'api-logs',
        records: [
          {
            at: new Date(now - 30 * 3600_000).toISOString(),
            objectText: 'GET /api/old/1 500 boom',
          },
        ],
        windowHours: 24,
        minOccurrences: 2,
        now,
      })
      return buckets.length === 0
    })(),
  )
  const gNoUrl = await readGrafanaAlerts({ url: '' })
  ok(
    'T8 grafana-alerts 无 URL ⇒ 未判定',
    gNoUrl.status === 'undetermined' && /读取地址/.test(gNoUrl.why),
  )
  ok(
    'T8b grafana-alerts 夹具:同 alertname 两实例聚成一桶',
    (() => {
      const at = new Date(now - 3600_000).toISOString()
      const recs = grafanaAlertRecords(
        [
          {
            labels: { alertname: 'ApiDown', severity: 'critical', instance: 'a:1' },
            annotations: { summary: 'API 宕机' },
            startsAt: at,
            status: { state: 'active' },
          },
          {
            labels: { alertname: 'ApiDown', severity: 'critical', instance: 'b:2' },
            annotations: { summary: 'API 宕机' },
            startsAt: at,
            status: { state: 'active' },
          },
        ],
        now,
      )
      const buckets = clusterRecords({
        source: 'grafana-alerts',
        records: recs,
        windowHours: 24,
        minOccurrences: 2,
        now,
      })
      return buckets.length === 1 && buckets[0].count === 2 && buckets[0].disposition === 'register'
    })(),
  )
  ok(
    'T9 user-feedback 无导出件 ⇒ 转直连取数;两通道都取不到才未判定并点名',
    (() => {
      const und = readUserFeedback({
        query: () => ({ status: 'undetermined', why: 'psql 不可用(自检夹具)' }),
      })
      const got = readUserFeedback({
        query: () => ({
          status: 'ok',
          records: [
            {
              at: 'x',
              label: 'bug:导出按钮坏了',
              objectText: 'bug|导出按钮坏了|',
              evidence: 'type=bug',
            },
          ],
        }),
      })
      return (
        und.status === 'undetermined' &&
        /psql 不可用/.test(und.why) &&
        got.status === 'ok' &&
        got.records.length === 1
      )
    })(),
  )
  ok(
    'T9b feedbacks SQL 单语句只读、夹住上限且不导出隐私列',
    (() => {
      const sql = buildFeedbacksSql(50)
      return (
        /^SELECT /.test(sql) &&
        !sql.includes(';') &&
        !/user_id|contact|admin_reply/i.test(sql) &&
        /LIMIT 50$/.test(sql) &&
        /NOT IN \('resolved', 'closed'\)/.test(sql) &&
        /LIMIT 200$/.test(buildFeedbacksSql(99999))
      )
    })(),
  )
  ok(
    'T9c parseFeedbackRows 与 JSONL 夹具同形,非可派单型/已结档/空文案一律剔掉',
    (() => {
      const rows = parseFeedbackRows(
        [
          'bug|登录失败|点了没反应|pending|2026-10-28 00:00:00',
          'spam|x|y|pending|z',
          'bug|已解决|c|resolved|w',
          'other|||pending|v',
        ].join('\n'),
      )
      return (
        rows.length === 1 &&
        rows[0].label === 'bug:登录失败' &&
        rows[0].at === '2026-10-28 00:00:00'
      )
    })(),
  )
  ok(
    'T10 api-logs 夹具缺失 ⇒ 未判定',
    readApiLogs({ jsonlPath: join(TMP_DIR, 'missing-fixture.jsonl') }).status === 'undetermined',
  )
  const ledger = [
    { action: 'registered', ts: new Date(now - 3600_000).toISOString(), fingerprint: 'fp1' },
    { action: 'registered', ts: new Date(now - 25 * 3600_000).toISOString(), fingerprint: 'fp2' },
  ]
  ok('T4a 24h 去重:新鲜命中', recentlyRegistered(ledger, 'fp1', now) === true)
  ok('T4b 24h 去重:过期不拦', recentlyRegistered(ledger, 'fp2', now) === false)
  const todayRows = [
    { action: 'registered', ts: new Date().toISOString() },
    { action: 'registered', ts: new Date(now - 25 * 3600_000).toISOString() },
    { action: 'quota-deferred', ts: new Date().toISOString() },
  ]
  ok('T5 配额只数 registered(当日)', registeredToday(todayRows, new Date()) === 1)
  // T6 参数闸(2026-10-28 立):失效方向必须是"多要一次定向说明",绝不能是"多跑一次真轮"
  ok(
    'T6a --help 合法且落用法档',
    parseArgs(['--help']).errors.length === 0 && parseArgs(['--help']).help === true,
  )
  ok(
    'T6b -h 与 --help 同形',
    parseArgs(['-h']).errors.length === 0 && parseArgs(['-h']).help === true,
  )
  ok(
    'T6c 未知旗标当场拒(不回落真轮)',
    parseArgs(['--warp']).errors.some((e) => /未知旗标 --warp/.test(e)),
  )
  ok(
    'T6d 位置参数当场拒',
    parseArgs(['D:/somewhere']).errors.some((e) => /位置参数/.test(e)),
  )
  ok(
    'T6e 零参数当场拒(缺动作旗标)',
    parseArgs([]).errors.some((e) => /缺少动作旗标/.test(e)),
  )
  ok(
    'T6f --dry-run 单给当场拒',
    parseArgs(['--dry-run']).errors.some((e) => /必须与 --once 同给/.test(e)),
  )
  ok(
    'T6g --once --dry-run 合法(只读预演档)',
    parseArgs(['--once', '--dry-run']).errors.length === 0 &&
      parseArgs(['--once', '--dry-run']).dryRun === true,
  )
  ok(
    'T6h 动作旗标互斥:--once --status 拒',
    parseArgs(['--once', '--status']).errors.some((e) => /互斥/.test(e)),
  )
  ok(
    'T6i 闭集对账:KNOWN_FLAGS 每枚都在用法档里点名',
    [...KNOWN_FLAGS].every((f) => usageText().includes(f)),
  )
  ok(
    'T6j 入口形状锁:参数闸排在 runOnce 之前',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      const body = src.slice(src.indexOf('export async function main'))
      const gate = body.indexOf('parseArgs(')
      const round = body.indexOf('runOnce(')
      return (
        gate >= 0 &&
        round > gate &&
        body.includes('args.errors.length > 0') &&
        /未执行任何分诊轮/.test(body)
      )
    })(),
  )
  // T11 取号族现读(2026-10-29 立,L28694 最后一格):挑族必须只认唯一分配判据,且失效方向是"不发号"
  ok(
    'T11a 候选族字母表由 TASK_ID_PATTERN 现解析(G 居首、无"守门"、全是字母)',
    (() => {
      const fs = idFamilyLetters()
      return (
        fs[0] === 'G' &&
        fs.includes('D') &&
        fs.includes('O') &&
        fs.every((f) => /^[A-Za-z]+$/.test(f)) &&
        !fs.some((f) => /守门/.test(f)) &&
        // 族表加一枚字母,本器下一轮就多一枚候选(没有第二份清单可漂)
        idFamilyLetters('G-\\d+|Z\\d+|守门\\s*\\d+').join(',') === 'G,Z'
      )
    })(),
  )
  ok(
    'T11b 首族被扫描灭窗 ⇒ 按现读换到下一枚可发族(令牌由探针给,本器不拼号)',
    (() => {
      const fake = (lines) =>
        lines[0].includes('{{NEXT_ID:G}}')
          ? { ok: false, reason: 'pool-exhausted:G', exhaustion: { stage: 'scan-filter', family: 'G' } }
          : { ok: true, lines: [lines[0].replace('{{NEXT_ID:D}}', 'D-7')] }
      const p = pickIdFamily({
        faceText: '- [ ] D1 既有行\n- [ ] G1 既有行\n- [ ] O1 既有行',
        families: ['G', 'D', 'O'],
        machineId: 'seatA',
        resolve: fake,
      })
      return (
        p.ok === true &&
        p.family === 'D' &&
        p.token === '{{NEXT_ID:D}}' &&
        p.label === 'D-7' &&
        p.readings[0].status === 'exhausted' &&
        p.readings[1].ok === true
      )
    })(),
  )
  ok(
    'T11c 无一族可发 ⇒ ok:false 且一 spawn 都不发(绝不拿真登记去试错)',
    (() => {
      const p = pickIdFamily({
        faceText: '- [ ] G1 既有行',
        families: ['G'],
        resolve: () => ({ ok: false, reason: 'pool-exhausted:G' }),
      })
      let spawns = 0
      const r = registerWithFamilyFallback(
        { source: 's', fingerprint: 'fp', title: 't', evidence: 'e' },
        p,
        () => {
          spawns++
          return { status: 0, stdout: '回读', stderr: '' }
        },
      )
      return r.ok === false && spawns === 0 && /无一族现读可发号/.test(r.why)
    })(),
  )
  ok(
    'T11d 底稿面取不到 ⇒ 未判定(不猜族),不得回落"就用 G"',
    pickRegistrationFamily({ face: { faceText: '' } }).undetermined === true,
  )
  ok(
    'T11e 首族被 live-doc-edit 拒(pool-exhausted)⇒ 次名族重试并成功;非该因绝不重试',
    (() => {
      const p = pickIdFamily({
        faceText: '- [ ] D1 既有行\n- [ ] O1 既有行',
        families: ['D', 'O'],
        resolve: (lines) => ({ ok: true, lines: [lines[0].replace(/{{NEXT_ID:[A-Z]+}}/, 'X1')] }),
      })
      let n = 0
      const r = registerWithFamilyFallback(
        { source: 's', fingerprint: 'fp1', title: 't', evidence: 'e' },
        p,
        () => {
          n++
          return n === 1
            ? { status: 2, stdout: '', stderr: '❌ 拒绝发号(pool-exhausted:D)' }
            : { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
        },
      )
      let m = 0
      const r2 = registerWithFamilyFallback(
        { source: 's', fingerprint: 'fp2', title: 't', evidence: 'e' },
        p,
        () => {
          m++
          return { status: 2, stdout: '', stderr: 'duplicate-title' }
        },
      )
      return r.ok === true && n === 2 && r2.ok === false && m === 1
    })(),
  )
  ok(
    'T11f registerToPlan:没给族逐字仍是 {{NEXT_ID:G}}(既有镜像锁),给了族就按现读写',
    (() => {
      const seen = []
      const spy = (_c, _a, opts) => {
        seen.push(readFileSync(opts.env.LIVE_BLOCK_FILE, 'utf8'))
        return { status: 0, stdout: '✅ 回读', stderr: '' }
      }
      registerToPlan({ source: 's', fingerprint: 'fpa', title: '甲', evidence: 'e' }, spy)
      registerToPlan({ source: 's', fingerprint: 'fpb', title: '乙', evidence: 'e', family: 'D' }, spy)
      return (
        /^- \[ \] \{\{NEXT_ID:G\}\} \[auto-triage\] 甲/.test(seen[0]) &&
        /^- \[ \] \{\{NEXT_ID:D\}\} \[auto-triage\] 乙/.test(seen[1]) &&
        !/^- \[ \] [A-Z]+-?\d+/.test(seen[1])
      )
    })(),
  )
  ok(
    'T11g 探针行标题带 PROBE 字样且不含真登记语义 ⇒ 永远不会被当一条登记抄走',
    PROBE_TITLE.includes('不落台账') && !/^\s*- \[/.test(PROBE_TITLE),
  )
  ok('T11h --families 合法动作旗标且与 --once 互斥', (() => {
    const a = parseArgs(['--families'])
    const b = parseArgs(['--families', '--once'])
    return a.errors.length === 0 && a.families === true && b.errors.some((e) => /互斥/.test(e))
  })())
  if (failed > 0) {
    console.error(`self-test: ${failed} 例红`)
    process.exitCode = 1
  } else {
    console.log('self-test: 全绿')
  }
}

function printStatus() {
  let cfg
  try {
    cfg = loadConfig()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  const ledger = readTriageLedger()
  const cluster = clusteringOf(cfg)
  console.log(
    `分诊配置:enabled=${cfg.enabled} 来源(${cfg.sources.length})=${cfg.sources.join('/')} 每日登记配额 ${cfg.dailyRegistrationQuota} 今日已用 ${registeredToday(ledger)}`,
  )
  console.log(
    `聚类档:窗口 ${cluster.windowHours}h / 同桶下限 ${cluster.minOccurrences} 次(错误签名归一后指纹去重)`,
  )
  console.log(`台账最近 5 条:`)
  for (const e of ledger.slice(-5))
    console.log(
      `  ${e.ts} ${e.mode}/${e.action}${e.source ? ` src=${e.source}` : ''}${e.why ? ` :: ${e.why}` : ''}`,
    )
}

/**
 * `--families`(只读,2026-10-29 立):把编号族表的每一枚字母族喂给唯一分配判据现跑一遍,
 * 打印"哪一族今天真发得出号 / 那一族为什么发不出(成因句由 lib 渲染)"。
 * 立因:L28694 的最后一格卡了 4 天(分诊台账 375 行里 registered=0),而排障时**没有任何一条
 * 命令**能读出各族水位 —— 只能手搓 import 探针(本席本轮就是那么量的)。运维旋钮必须器物化,
 * 否则下一次"发不出号"还是只能靠猜(§0.8:文档不许写跑不通的出路)。
 * 退出码:有一族可发 ⇒ 0;全族被拒(真判出的结论)⇒ 1;底稿面取不到 ⇒ 2 并显式未判定(§0.3)。
 */
function printFamilies() {
  const pick = pickRegistrationFamily()
  console.log(
    `取号族现读(判据 = live-doc-edit.resolveIdTokens 探针,底稿 = git show HEAD:${PLAN_DOC} ⊕ 归档件 ⊕ 工作树副本;` +
      `不含远端那一维 ⇒ 排序器不是担保,真落地仍由 live-doc-edit 每轮 CAS 现算)`,
  )
  console.log(`字母族表(唯一真相源 check-plan-line-loss.TASK_ID_PATTERN)= ${idFamilyLetters().join('/')}`)
  for (const n of pick.faceNotes ?? []) console.log(`ℹ ${n}`)
  for (const r of pick.readings ?? []) {
    if (r.ok) {
      console.log(`  ✅ ${r.family.padEnd(3)} 可发 ⇒ 探针现算首号 ${r.label ?? '未量到'}`)
      continue
    }
    const head = `  ❌ ${r.family.padEnd(3)} ${r.status}(${r.reason ?? r.why ?? '未判定'})`
    console.log(
      r.exhaustion
        ? `${head}\n      成因:${describeExhaustion(r.exhaustion)}`
        : head,
    )
  }
  if (pick.ok) {
    console.log(`✅ 分诊登记本轮将使用族 ${pick.family}:令牌 ${pick.token}(首号 ${pick.label})`)
    return
  }
  if (pick.undetermined) {
    console.log(`❌ 未判定:${pick.why} ⇒ 一 spawn 都不发起,不落任何"未取号"形态`)
    process.exitCode = 2
    return
  }
  console.log(`❌ ${pick.why}`)
  console.log(
    '   ⇒ 出路不在本器:按 2026-10-24 拍板"族满开新字母族、永不升位数"——新字母须先登记进族表唯一真相源,' +
      '再以手填声明位入台账开第一行,之后 {{NEXT_ID:新族}} 令牌恢复可发(取号器对手填行逐字保留)。',
  )
  process.exitCode = 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// ── CLI 参数闸(2026-10-28 立)──────────────────────────────────────────────
// 病理(实测复现):入口原是 `if includes('--self-test') / if includes('--status') / else
// runOnce(...)`,任何未被点名的旗标(取证命令 `--help`、零参数、位置参数)**都不报错、不落用法档,
// 而是当场落进真分诊轮** —— 每次净往 .ihui-agent/state/auto-triage-ledger.jsonl 追写观测行
// (夹具仓实测 0 → 1 行),真跑那一步还会 spawn live-doc-edit 去登记 PROJECT_PLAN.md。
// 失效方向必须是「多要一次定向说明」,绝不能是「多跑一次真轮」(AGENTS.md §0.10/§0.8)。
// 形态照抄同族 `scripts/triage-discovery.mjs` 的 parseArgs(KNOWN_FLAGS 闭集 + errors 收集 +
// 用法 + exit 2),不另发明第二套参数解析。
const KNOWN_FLAGS = new Set([
  '--once',
  '--dry-run',
  '--status',
  '--families',
  '--self-test',
  '--help',
  '-h',
])
/** 动作旗标:互斥且必给其一(`--dry-run` 只是 `--once` 的修饰档,不算动作)。 */
const ACTION_FLAGS = new Set(['--once', '--status', '--families', '--self-test', '--help', '-h'])

export function usageText() {
  return [
    '用法:node scripts/auto-triage.mjs --once [--dry-run] | --status | --families | --self-test | --help',
    '  --once       真跑一轮分诊(写分诊观测账,必要时经 live-doc-edit 唯一入口登记 PROJECT_PLAN.md)',
    '  --dry-run    预演:只打印将要登记/观察的行,不写 PROJECT_PLAN.md、不写分诊台账(只能与 --once 同给)',
    '  --status     只读:打印分诊配置与观测台账最近 5 条',
    '  --families   只读:现读每一枚字母族能否发号(挑族判据 = live-doc-edit 那一份,零写盘)',
    '  --self-test  只读:跑本器自测',
    '  --help / -h  只读:打印本用法',
    '纪律:未知旗标 / 位置参数 / 缺动作旗标 / 多个动作旗标同给 ⇒ 当场拒绝(exit 2),',
    '      绝不回落成"那就跑一轮"。人工排障先跑 --once --dry-run 看将要写什么。',
  ].join('\n')
}

/** CLI 参数解析:纯函数、零 IO;任何歧义落 errors,由调用方据此拒绝执行。 */
export function parseArgs(argv = []) {
  const errors = []
  const tokens = Array.isArray(argv) ? argv : []
  for (const t of tokens) {
    if (typeof t !== 'string') {
      errors.push(`参数必须是字符串,实得 ${JSON.stringify(t) ?? String(t)}`)
      continue
    }
    if (t.startsWith('-')) {
      if (!KNOWN_FLAGS.has(t)) errors.push(`未知旗标 ${t}`)
      continue
    }
    errors.push(`未知参数 ${JSON.stringify(t)}(本器不接受位置参数)`)
  }
  const actions = tokens.filter((t) => ACTION_FLAGS.has(t))
  if (errors.length === 0) {
    if (actions.length === 0) {
      errors.push(
        tokens.length === 0
          ? '缺少动作旗标:显式给 --once / --status / --families / --self-test / --help 之一(--once 是写观测账的真轮,先跑 --once --dry-run 预演)'
          : `缺少动作旗标:只给了修饰旗标 ${tokens.join(' ')},显式点名要跑哪一档`,
      )
    } else if (actions.length > 1) {
      errors.push(`动作旗标互斥,实得 ${actions.join(' ')}`)
    }
    if (tokens.includes('--dry-run') && !actions.includes('--once')) {
      errors.push('--dry-run 只是 --once 的修饰档,必须与 --once 同给(单给不预演任何档)')
    }
  }
  return {
    errors,
    once: actions.includes('--once'),
    dryRun: tokens.includes('--dry-run'),
    status: actions.includes('--status'),
    families: actions.includes('--families'),
    selfTest: actions.includes('--self-test'),
    help: actions.includes('--help') || actions.includes('-h'),
  }
}

export async function main(args = []) {
  const argv = parseArgs(args)
  if (argv.errors.length > 0) {
    for (const e of argv.errors) console.error(`❌ ${e}`)
    console.error(usageText())
    console.error('未判定:参数错误,未执行任何分诊轮、未写分诊台账、未登记 PROJECT_PLAN')
    process.exitCode = 2
    return
  }
  if (argv.help) {
    console.log(usageText())
    return
  }
  if (argv.selfTest) return selfTest()
  if (argv.families) return printFamilies()
  if (argv.status) return printStatus()
  return runOnce({ dryRun: argv.dryRun })
}

if (isDirectRun) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  loadConfig,
  TriageShapeError,
  KNOWN_FLAGS,
  ACTION_FLAGS,
  parseArgs,
  usageText,
  main,
  clusteringOf,
  fingerprintOf,
  normalizeSignature,
  clusterRecords,
  readJsonlRows,
  buildApiLogsSql,
  parseApiLogRows,
  apiLogRowsFromObjects,
  readApiLogs,
  grafanaAlertsUrlOf,
  grafanaAlertRecords,
  readGrafanaAlerts,
  readUserFeedback,
  readMailFailures,
  readIndexUnmerged,
  readTriageLedger,
  registeredToday,
  recentlyRegistered,
  planTriageActions,
  registerToPlan,
  idFamilyLetters,
  probeIdFamily,
  pickIdFamily,
  pickRegistrationFamily,
  registerWithFamilyFallback,
  PROBE_TITLE,
  PLAN_DOC,
  FAMILY_FALLBACK_MAX_SPAWNS,
  sanitizeHexRuns,
  CONFIG_JSON,
  TRIAGE_LEDGER,
  MAIL_LEDGER,
  API_LOGS_DEFAULT_LIMIT,
  FEEDBACKS_DEFAULT_LIMIT,
  buildFeedbacksSql,
  parseFeedbackRows,
  feedbackRowsByQuery,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
