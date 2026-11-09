#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-metric-existence.mjs — 告警/记录规则引用的指标名对账(2026-11-03 立)。
 *
 * 立因(2026-11-03 现读):
 *   把 `monitoring/prometheus/alerts-ai.yml` 里任一指标名改成 `..._totl`,`promtool` 仍 SUCCESS、
 *   reload 200、`/api/v1/status/config` health=ok、lastError 空、即时查询是空 vector。
 *   于是这条规则**从此刻起静默永不触发**,而所有既有守门(Metric 存在性只检查大屏 expr、
 *   P6 只检查 alerts.yml 且把 24h 无样本的规则仍算 live)没有一道会响。
 *   本门补的正是这一维:**规则引用的名字,在 Prometheus 里是否真实存在、且近期有样本**。
 *
 * 判据(三态不并桶,任一命中即 exit 1):
 *   T1 名字打错   —— 名字不在"真实存在"集合里,但与某个已知名字的编辑距离 ≤ 2
 *                    (打印最近名字与距离,便于一眼改回)。
 *   T2 从未产生样本 —— 名字不在"真实存在"集合里,也没有近似候选:
 *                    代码/台账里可能声明过,但 Prometheus 从来没采到过它。
 *   T3 样本过期   —— 名字在 Prometheus 已知指标名里,但最近窗口(默认 24h)内
 *                    `/api/v1/series` 查不到任何序列 ⇒ 规则读的是死序列,同样永不触发。
 *
 * 例外(合法零样本的唯一通道):
 *   事件型计数器只在事件发生时创建标签序列、且刻意不开 0 基线(标签是开放集),
 *   "没事件＝没序列"是事实而非采集停摆。这种只许登记在具名台账
 *   `scripts/data/metric-existence-exemptions.json`,并在运行时**硬验**:
 *     ① emitter 文件里确有该指标名(改名/删除 ⇒ 豁免失效,真缺陷不许借旧条目藏身);
 *     ② `up{job}` == 1(目标掉线不是"合法空闲");离线时只验 ①,并在输出里标明未验采集。
 *   到期 / 空挂(规则已不再引用该指标)的台账条目本身判红,续期必须重新验过(§0.7)。
 *   没有任何"忽略"开关:例外永远绑定到具体 ruleFile+ruleName+metric,且会到期。
 *
 * 数据面(按优先级):
 *   ① 有 Prometheus(`PROMETHEUS_URL` 或本机 8815 → 9090):
 *      `/api/v1/label/__name__/values` 取名字全集;一条 `/api/v1/series?match[]=...&start=...`
 *      批量取"窗口内有序列"集合(避免每个名字一次请求)。
 *   ② 取不到 Prometheus:退到**静态清单** —— exporter 前缀台账
 *      (`scripts/data/panel-external-metrics.json`)+ 代码发射点声明扫描 + recording rule 输出名。
 *      静态清单判不了"样本过期"(没有时序),只打印一条未判定告警;**不得把没证据读成绿**。
 *   ③ 名字全集取到、但新鲜度查询失败 ⇒ exit 2(未判定),不冒充通过。
 *
 * 规则面:`monitoring/**` 下全部 `.yml/.yaml` —— `alerts*.yml` 是主审面,recording rules
 *   (`record:` + `expr:`)同文件同判据;`alerts*.yml` 解析出 0 条规则 ⇒ exit 2(尺子失效)。
 * PromQL 解析复用 `check-ops-patrol.mjs` 的 `parseAlertRules` / `metricRefsFromExpr`
 * (§22c:注释/字符串遮蔽与"标签名不是指标名"这件事只许有一份实现)。
 *
 * 取材面(与仓内其它门同口径,2026-11-03 吸收门 118):
 *   默认判 **HEAD blob**(`--staged` 判索引 blob、`--worktree` 只作人工逃生舱)。
 *   枚举走 `scripts/lib/face-reader.mjs` 的 `listFaceFiles`,正文走 `catBatch` / `readWorktreeFile`
 *   —— 不按磁盘读仓库内容:共享工作树常年滞后 HEAD,按磁盘判会在恒红/假绿之间来回跳。
 *   `--rules-dir` 的临时夹具例外(它读的不是仓库内容,判红是误伤)。
 *
 * 用法:
 *   node scripts/check-metric-existence.mjs                  # 全量档:判 HEAD blob
 *   node scripts/check-metric-existence.mjs --staged         # 提交档:判索引 blob
 *   node scripts/check-metric-existence.mjs --worktree       # 人工逃生舱:判工作树(不作门禁)
 *   node scripts/check-metric-existence.mjs --json
 *   node scripts/check-metric-existence.mjs --offline        # 强制静态清单
 *   node scripts/check-metric-existence.mjs --rules-dir <dir> # 测试用替代监控目录(磁盘面)
 *   node scripts/check-metric-existence.mjs --self-test
 * 跳过(仅注册点用):HUSKY_SKIP_METRIC_EXISTENCE=1
 */

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  Undetermined,
  catBatch,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { parseAlertRules, metricRefsFromExpr } from './check-ops-patrol.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
/** 仓库面一律写**相对仓库根**的路径:判哪个面由 face-reader 决定,不在这里拼绝对路径。 */
const RULES_DIR = 'monitoring'
const EXTERNAL_LEDGER = 'scripts/data/panel-external-metrics.json'
const EXEMPTIONS_FILE = 'scripts/data/metric-existence-exemptions.json'
const PROM_BASES = [
  ...(process.env.PROMETHEUS_URL ? [process.env.PROMETHEUS_URL] : []),
  'http://127.0.0.1:8815',
  'http://127.0.0.1:9090',
]
const FRESH_WINDOW = process.env.IHUI_METRIC_FRESH_WINDOW || '24h'
const SELF_SKIP_ENV = 'HUSKY_SKIP_METRIC_EXISTENCE'

/** Prometheus 自己产生、任何规则都可以引用的名字(不在 exporter 台账里)。 */
const SYSTEM_NAMES = new Set(['up', 'ALERTS', 'ALERTS_FOR_STATE', 'target_info'])
const SYSTEM_PREFIXES = ['scrape_', 'prometheus_']

/** 代码发射点静态扫描根(仅离线兜底用;带路径的真相仍在 Prometheus)。 */
const EMISSION_ROOTS = ['apps/api/src', 'apps/ai-service/app', 'packages', 'monitoring']
const DECL_RE = /(?:Counter|Gauge|Histogram|Summary|Info|Enum)\(\s*(?:\r?\n\s*)?['"]([a-zA-Z_:][a-zA-Z0-9_:]*)['"]/g
const TS_NAME_RE = /\bname:\s*['"]([a-zA-Z_:][a-zA-Z0-9_:]*)['"]/g
const HELP_RE = /#\s*HELP\s+([a-zA-Z_:][a-zA-Z0-9_:]*)/g
const SKIP_DIR_RE = /(^|[\\/])(node_modules|dist|build|\.venv|venv|__pycache__|\.next|coverage)([\\/]|$)/

// ─── 取材面(HEAD blob / 索引 blob / 工作树;与仓内其它门同口径) ────

/**
 * 读一个仓库面文件的本地 helper。
 * ⚠️ 接口差异:`scripts/lib/face-reader.mjs` 导出的是 `selectFace` 与三个**读取原语**
 * (`catBatch` / `catBatchBinary` / `readWorktreeFile`),**没有** `readFace` 这个导出;
 * 仓内各门的 `readFace(face)` 都是自己按下面几行组合出来的 helper(见 check-agents-doc-size.mjs)。
 * 这里沿用同一口径,不另造一层取数实现。
 */
export function readFace(face, rel) {
  return readFaceBatch(face, [rel]).get(rel) ?? null
}

/** 批量版:`head`/`staged` 一次 `catBatch` 读完,`worktree` 走 `readWorktreeFile`。 */
export function readFaceBatch(face, rels) {
  const list = [...rels]
  if (!list.length) return new Map()
  if (face === 'worktree') {
    return new Map(list.map((rel) => [rel, readWorktreeFile(ROOT, rel)]))
  }
  const specOf = (rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
  const specs = list.map(specOf)
  let raw
  try {
    raw = catBatch(ROOT, specs, { timeout: 120000 })
  } catch (e) {
    throw new Undetermined(`批量读取 ${face} 面 ${specs.length} 个文件失败: ${e?.message || e}`)
  }
  return new Map(list.map((rel, i) => [rel, raw.get(specs[i]) ?? null]))
}

/** 仓库面上某子树下的全部 yml/yaml(清单与内容同一面、同一轮)。 */
export function listFaceYamlFiles(face, dir = RULES_DIR) {
  let rels
  try {
    rels = listFaceFiles(ROOT, face, { paths: [dir] })
  } catch (e) {
    throw new Undetermined(`枚举 ${face} 面的 ${dir}/ 失败: ${e?.message || e}`)
  }
  return rels.filter((rel) => /\.(yml|yaml)$/i.test(rel)).sort()
}

// ─── 规则文件与引用 ───────────────────────────────────────────────

/** 递归列**临时夹具目录**下全部 yml/yaml(只给 `--rules-dir` 用;仓库面走 listFaceYamlFiles)。 */
export function listYamlFiles(dir) {
  const out = []
  const walk = (d) => {
    if (!existsSync(d)) return
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name)
      if (e.isDirectory()) {
        if (!SKIP_DIR_RE.test(abs)) walk(abs)
        continue
      }
      if (/\.(yml|yaml)$/i.test(e.name)) out.push(abs)
    }
  }
  walk(dir)
  return out.sort()
}

/**
 * 把规则文件解析成 `{file, kind, name, expr, metrics}`。
 * `alerts*.yml` 里 0 条规则是**尺子失效**(exit 2),不是"没有规则"——所以单独报出来。
 *
 * 两种取材:给 `face` ⇒ 仓库面(listFaceFiles + catBatch/readWorktreeFile);
 * 不给 ⇒ `--rules-dir` 临时夹具(磁盘面,读的不是仓库内容)。
 */
export function collectRuleRefs(dir = RULES_DIR, { face = null } = {}) {
  const entries = face
    ? listFaceYamlFiles(face, dir).map((rel) => ({ rel, read: rel }))
    : listYamlFiles(dir).map((abs) => ({
        rel: relative(ROOT, abs).split(sep).join('/'),
        read: relative(dir, abs).split(sep).join('/'),
      }))
  const texts = face
    ? readFaceBatch(face, entries.map((e) => e.read))
    : new Map(entries.map((e) => [e.rel, readWorktreeFile(dir, e.read)]))

  const files = []
  const brokenAlertFiles = []
  for (const { rel } of entries) {
    const text = texts.get(rel)
    if (text === null || text === undefined) {
      throw new Undetermined(`${face || '临时夹具'} 面取不到规则文件 ${rel}(清单与内容不同面 ⇒ 不判)`)
    }
    const parsed = parseAlertRules(text)
    if (!parsed.length) {
      if (/alerts[^/]*\.(yml|yaml)$/i.test(rel)) brokenAlertFiles.push(rel)
      continue
    }
    for (const rule of parsed) {
      files.push({
        file: rel,
        kind: rule.kind,
        name: rule.name,
        expr: rule.expr,
        metrics: metricRefsFromExpr(rule.expr),
      })
    }
  }
  return { files, brokenAlertFiles }
}

// ─── 静态清单(离线兜底) ──────────────────────────────────────────

function normalizedNameVariants(name) {
  const base = name.endsWith('_total') ? name.slice(0, -6) : name
  return [name, base, `${base}_total`, `${base}_bucket`, `${base}_count`, `${base}_sum`, `${base}_created`]
}

/** 代码里的指标声明(只做"这个名字有没有人声明"的存在性兜底,不判断是否在采)。 */
function scanEmissionDeclarations(face) {
  const set = new Set()
  let rels
  try {
    rels = listFaceFiles(ROOT, face, { paths: EMISSION_ROOTS })
  } catch (e) {
    throw new Undetermined(`枚举 ${face} 面发射点失败: ${e?.message || e}`)
  }
  const targets = rels
    .filter((rel) => /\.(py|ts|tsx|mjs|cjs|js)$/.test(rel))
    .filter((rel) => !SKIP_DIR_RE.test(rel))
  for (const text of readFaceBatch(face, targets).values()) {
    if (text === null) continue
    for (const re of [DECL_RE, TS_NAME_RE, HELP_RE]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(text)) !== null) {
        for (const v of normalizedNameVariants(m[1])) set.add(v)
      }
    }
  }
  return set
}

/** exporter 侧静态前缀台账(带 until 的条目才算数;过期条目不是通行证)。 */
export function readExternalPrefixes({ file = EXTERNAL_LEDGER, face = 'head' } = {}) {
  const text = readFace(face, file)
  if (text === null) return []
  const parsed = JSON.parse(text)
  const now = Date.now()
  return (parsed.entries || [])
    .filter((e) => typeof e.prefix === 'string' && (!e.until || Date.parse(e.until) > now))
    .map((e) => e.prefix)
}

// ─── 例外台账(合法零样本的唯一通道) ──────────────────────────────

/** 读具名台账。台账坏了返回 error(调用方 exit 2),不把"坏台账"读成"没有例外"。 */
export function readExemptions({ file = EXEMPTIONS_FILE, face = 'head' } = {}) {
  const text = readFace(face, file)
  if (text === null) return { entries: [], error: null }
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed.entries)) return { entries: [], error: 'entries 不是数组' }
    return { entries: parsed.entries, error: null }
  } catch (e) {
    return { entries: [], error: `台账解析失败: ${e?.message || e}` }
  }
}

/** 台账条目的唯一键:同一规则同一条指标只许一条例外。 */
export function exemptionKey(e) {
  return `${e?.ruleFile ?? ''}\u0000${e?.ruleName ?? ''}\u0000${e?.metric ?? ''}`
}

const EXEMPTION_REQUIRED = ['metric', 'ruleFile', 'ruleName', 'job', 'emitter', 'until']

/**
 * 硬验台账条目,返回 Map<key, {ok, why, entry}>。三条不成立都判红,不静默跳过:
 *   ① 形状/到期 —— until 必须晚于 now(§0.7:豁免必须验过才免且会到期);
 *   ② 发射点 —— emitter 文件里确有该指标名(改名/删发射点 ⇒ 豁免失效,真缺陷不许借例外藏身);
 *   ③ 采集 —— up{job} == 1(目标掉线不是"合法空闲")。
 * scrapeUp=null 只代表整次运行拿不到 Prometheus(离线回退),此时只验 ①② 并在 why 里标明未验采集。
 */
export function evaluateExemptions(
  entries,
  { readFile, scrapeUp = null, nowIso = new Date().toISOString() } = {},
) {
  const out = new Map()
  for (const e of entries) {
    const key = exemptionKey(e)
    const fail = (why) => out.set(key, { ok: false, why, entry: e })
    const missing = EXEMPTION_REQUIRED.find((f) => typeof e?.[f] !== 'string' || !e[f].trim())
    if (missing) {
      fail(`条目缺 ${missing}(形状不合法)`)
      continue
    }
    if (!(Date.parse(e.until) > Date.parse(nowIso))) {
      fail(`豁免已到期(${e.until}) —— 续期须重新验过`)
      continue
    }
    const text = typeof readFile === 'function' ? readFile(e.emitter) : null
    if (text === null || text === undefined) {
      fail(`发射点文件不存在: ${e.emitter}`)
      continue
    }
    if (!text.includes(e.metric)) {
      fail(`发射点 ${e.emitter} 里找不到 ${e.metric}(已改名/删除 ⇒ 豁免失效)`)
      continue
    }
    if (scrapeUp) {
      if (scrapeUp.get(e.job) !== true) {
        fail(`采集目标 job=${e.job} 不在 up 状态(掉线不是合法空闲)`)
        continue
      }
      out.set(key, { ok: true, why: `发射点+采集双验通过(job=${e.job})`, entry: e })
      continue
    }
    out.set(key, { ok: true, why: `发射点在位;离线未验采集(job=${e.job})`, entry: e })
  }
  return out
}

/** 台账空挂:条目指向的规则/指标已不在被审面(删规则/改名后必须摘掉,否则例外会永久漂移)。 */
export function findDanglingExemptions(entries, refs) {
  const referenced = new Set()
  for (const r of refs) {
    for (const m of r.metrics) {
      referenced.add(exemptionKey({ ruleFile: r.file, ruleName: r.name, metric: m }))
    }
  }
  return entries
    .filter((e) => !referenced.has(exemptionKey(e)))
    .map((e) => ({
      category: 'dangling-exemption',
      rule: { kind: 'exempt', name: e?.ruleName || '?', file: e?.ruleFile || '?' },
      metric: e?.metric,
      reason: `例外空挂 —— ${e?.ruleFile}::${e?.ruleName} 已不再引用「${e?.metric}」(删规则/改名后必须摘掉台账)`,
    }))
}

// ─── 判据(纯函数,自检/测试的构造面) ─────────────────────────────

/** 标准 Levenshtein(指标名很短,不加阈值优化)。 */
export function levenshtein(a, b) {
  const s = String(a)
  const t = String(b)
  const prev = new Array(t.length + 1)
  for (let j = 0; j <= t.length; j += 1) prev[j] = j
  for (let i = 1; i <= s.length; i += 1) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= t.length; j += 1) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (s[i - 1] === t[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[t.length]
}

function nearestName(name, candidates) {
  let best = null
  for (const c of candidates) {
    if (c === name) continue
    const d = levenshtein(name, c)
    if (!best || d < best.distance) best = { name: c, distance: d }
  }
  return best
}

function isSystemName(name) {
  return SYSTEM_NAMES.has(name) || SYSTEM_PREFIXES.some((p) => name.startsWith(p))
}

/**
 * 三态判定核心。入参全部由调用方喂进来(自检不连 Prometheus):
 *   refs            collectRuleRefs(...).files
 *   liveNames       Prometheus 已知名字集合(null = Prometheus 不可达)
 *   freshNames      窗口内有样本的名字集合(null = 新鲜度未判定)
 *   staticNames     代码声明集合(离线兜底 / 近似名字候选)
 *   derivedNames    recording rule 输出名(alert 引用它们时不算幽灵)
 *   externalPrefixes exporter 前缀台账(离线兜底)
 *   exemptions      例外台账条目(只对硬验通过的合法零样本放行)
 *   exemptionChecks evaluateExemptions(...) 的结果
 * 返回 `{ violations, checked, derivedBroken, exempted }`。
 */
export function classifyRules({
  refs,
  liveNames = null,
  freshNames = null,
  staticNames = new Set(),
  derivedNames = new Set(),
  externalPrefixes = [],
  exemptions = [],
  exemptionChecks = new Map(),
  freshWindow = FRESH_WINDOW,
}) {
  const violations = []
  const exempted = []
  const live = liveNames instanceof Set ? liveNames : liveNames ? new Set(liveNames) : null
  const fresh = freshNames instanceof Set ? freshNames : freshNames ? new Set(freshNames) : null
  const statics = staticNames instanceof Set ? staticNames : new Set(staticNames)
  const derived = derivedNames instanceof Set ? derivedNames : new Set(derivedNames)
  const prefixHit = (name) => externalPrefixes.some((p) => name.startsWith(p))
  const exemptByKey = new Map(exemptions.map((e) => [exemptionKey(e), e]))
  // 合法零样本只放行台账里硬验通过的条目;条目存在但校验失败 ⇒ 照常判红并把失效原因附在理由后。
  const pushViolation = (rule, metric, category, reason) => {
    const key = exemptionKey({ ruleFile: rule.file, ruleName: rule.name, metric })
    if (!exemptByKey.has(key)) {
      violations.push({ category, rule, metric, reason })
      return
    }
    const check = exemptionChecks.get(key)
    if (check?.ok) {
      exempted.push({ rule, metric, category, why: check.why })
      return
    }
    violations.push({
      category,
      rule,
      metric,
      reason: `${reason}；例外失效:${check?.why || '台账条目未通过硬验'}`,
    })
  }
  // 近似候选:在线时用"真在采的名字",离线时退到代码声明名 —— 打错一个字符仍能抓到。
  const candidates = [...(live || statics)].filter((n) => n.length >= 6)
  let checked = 0
  const seen = new Set()

  for (const rule of refs) {
    for (const metric of rule.metrics) {
      const key = `${rule.file}\u0000${rule.kind}:${rule.name}\u0000${metric}`
      if (seen.has(key)) continue
      seen.add(key)
      checked += 1
      if (isSystemName(metric)) continue
      // alert 引用 recording rule 的输出名:它不是幽灵,输入名由产生它的 record 规则自检。
      if (rule.kind === 'alert' && derived.has(metric)) continue

      if (live) {
        if (!live.has(metric)) {
          const near = nearestName(metric, candidates)
          if (near && near.distance <= 2) {
            pushViolation(
              rule,
              metric,
              'typo',
              `名字打错 —— 不在 Prometheus 已知指标名里;最近已知「${near.name}」,编辑距离 ${near.distance}`,
            )
          } else {
            pushViolation(
              rule,
              metric,
              'never-produced',
              '从未产生样本 —— Prometheus 不认识这个名字(代码/规则改名后从未被采集,或发射点从未注册)',
            )
          }
          continue
        }
        if (fresh && !fresh.has(metric)) {
          pushViolation(
            rule,
            metric,
            'stale',
            `样本过期 —— 该名字在 Prometheus 里存在,但最近 ${freshWindow} 的 /api/v1/series 查不到任何序列(采集已停/目标掉线/序列只有陈旧点),规则读数恒为空`,
          )
        }
        continue
      }

      // 离线:前缀台账 + 代码声明 + recording 输出 = 静态存在性。
      if (prefixHit(metric) || statics.has(metric) || derived.has(metric)) continue
      const near = nearestName(metric, candidates)
      if (near && near.distance <= 2) {
        pushViolation(
          rule,
          metric,
          'typo',
          `名字打错 —— 静态清单里没有,最近已知「${near.name}」,编辑距离 ${near.distance}(Prometheus 不可达,按静态清单判)`,
        )
      } else {
        pushViolation(
          rule,
          metric,
          'never-produced',
          '从未产生样本 —— 静态清单(代码声明 + exporter 前缀台账 + recording 输出)里找不到这个名字(Prometheus 不可达,无法进一步复核)',
        )
      }
    }
  }

  // recording rule 的**输出名**本身是否真的在产出(SQL 式的"规则存在但从不评估")。
  const derivedBroken = []
  if (live) {
    for (const rule of refs.filter((r) => r.kind === 'record')) {
      if (!live.has(rule.name)) {
        derivedBroken.push({
          category: 'never-produced',
          rule,
          metric: rule.name,
          reason: `recording rule 输出从未产生 —— Prometheus 已知指标名里没有「${rule.name}」⇒ 该规则从未被评估或被配置排除`,
        })
      } else if (fresh && !fresh.has(rule.name)) {
        derivedBroken.push({
          category: 'stale',
          rule,
          metric: rule.name,
          reason: `recording rule 输出样本过期 —— 最近 ${freshWindow} 内无样本 ⇒ 规则已停止评估(表达式可能引用了坏指标)`,
        })
      }
    }
  }

  return { violations: [...violations, ...derivedBroken], checked, derivedBroken, exempted }
}

// ─── Prometheus 数据面 ───────────────────────────────────────────

async function getJson(url, timeoutMs = 8000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (body.status !== 'success') throw new Error(body.error || 'status != success')
    return body.data
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 批量取"窗口内有样本"的名字。
 * 用 `/api/v1/series` 而不是 `count_over_time`:后者会把 `__name__` 从结果标签里丢掉,
 * 多个指标塞进同一条查询时直接 `vector cannot contain metrics with the same labelset`(422)。
 * `/api/v1/series` 按时间范围返回序列元数据,`__name__` 仍在 ⇒ 一次拿到名字 + 新鲜度。
 */
export async function fetchFreshNames(base, names, window = FRESH_WINDOW) {
  const fresh = new Set()
  const chunks = []
  for (let i = 0; i < names.length; i += 80) chunks.push(names.slice(i, i + 80))
  const seconds = windowToSeconds(window)
  const end = Math.floor(Date.now() / 1000)
  const start = end - seconds
  for (const chunk of chunks) {
    const match = `{__name__=~"${chunk.join('|')}"}`
    const url = new URL('/api/v1/series', base)
    url.searchParams.set('match[]', match)
    url.searchParams.set('start', String(start))
    url.searchParams.set('end', String(end))
    const data = await getJson(url)
    for (const row of data || []) {
      const name = row?.__name__
      if (name) fresh.add(name)
    }
  }
  return fresh
}

/**
 * 取 `up{job=~"..."}` 的当前健康态:Map(job → bool)。
 * 查不到对应 job 的 up 序列按 false(目标已不在采集面也是"采集不健康"),例外因此失效 —— fail-closed。
 */
export async function fetchUpByJob(base, jobs) {
  const out = new Map(jobs.map((j) => [j, false]))
  if (!jobs.length) return out
  const pattern = jobs.map((j) => String(j).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const url = new URL('/api/v1/query', base)
  url.searchParams.set('query', `up{job=~"${pattern}"}`)
  const data = await getJson(url)
  for (const row of data?.result || []) {
    const job = row?.metric?.job
    if (out.has(job) && Number(row?.value?.[1]) === 1) out.set(job, true)
  }
  return out
}

/** `24h` / `1d` / `6h30m` → 秒;认不出就按 24h(并保留原文给输出)。 */
export function windowToSeconds(window) {
  const m = String(window || '').trim().match(/^(\d+(?:\.\d+)?)([smhdw])$/)
  if (!m) return 24 * 3600
  const n = Number(m[1])
  const unit = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2]]
  return Math.round(n * unit)
}

/** 依次探测候选 base,拿到名字全集与新鲜度;返回错误链而不是假装成功。 */
export async function loadPrometheus({ bases = PROM_BASES, names, window = FRESH_WINDOW } = {}) {
  const errors = []
  for (const base of bases) {
    try {
      const data = await getJson(new URL('/api/v1/label/__name__/values', base))
      const liveNames = new Set(Array.isArray(data) ? data : [])
      if (!liveNames.size) throw new Error('名字全集为 0 条')
      const freshNames = await fetchFreshNames(base, names || [], window)
      return { base, liveNames, freshNames, error: null, errors }
    } catch (e) {
      errors.push(`${base}: ${e?.message || e}`)
    }
  }
  return { base: null, liveNames: null, freshNames: null, error: errors.join(' | '), errors }
}

// ─── 主流程 ─────────────────────────────────────────────────────

async function main(argv) {
  const json = argv.includes('--json')
  const offline = argv.includes('--offline')
  const selfTest = argv.includes('--self-test')
  const dirArg = argv.indexOf('--rules-dir')
  const scratchDir = dirArg >= 0 ? argv[dirArg + 1] : null
  const promArg = argv.indexOf('--prometheus-url')
  const bases = promArg >= 0 ? [argv[promArg + 1]] : PROM_BASES
  const { face, error: faceError } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })

  if (selfTest) return runSelfTest()
  if (faceError) {
    console.error(`[check-metric-existence] ❌ 未判定:${faceError}(不替调用方挑一个面)`)
    return 2
  }
  if (process.env[SELF_SKIP_ENV] === '1') {
    console.log(`[check-metric-existence] ⏭️  ${SELF_SKIP_ENV}=1 ⇒ 跳过(应急放行)`)
    return 0
  }

  // 仓库内容一律走取材层:HEAD blob / 索引 blob / 工作树。
  // `--rules-dir` 是盘上临时夹具(读的不是仓库内容,门 118 口径下的例外)。
  let files = []
  let brokenAlertFiles = []
  let staticNames = new Set()
  let externalPrefixes = []
  let ledgerEntries = []
  let exemptionError = null
  try {
    const collected = scratchDir
      ? collectRuleRefs(scratchDir)
      : collectRuleRefs(RULES_DIR, { face })
    files = collected.files
    brokenAlertFiles = collected.brokenAlertFiles
    if (offline) staticNames = scanEmissionDeclarations(face)
    externalPrefixes = readExternalPrefixes({ face })
    const ledger = readExemptions({ face })
    ledgerEntries = ledger.entries
    exemptionError = ledger.error
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`[check-metric-existence] ❌ 未判定:${e.message}(不把取不到读成通过)`)
      return 2
    }
    throw e
  }
  if (!files.length || brokenAlertFiles.length) {
    console.error(
      `[check-metric-existence] ❌ 未判定:规则解析失败 —— ${
        brokenAlertFiles.length
          ? `alerts 文件解析出 0 条规则: ${brokenAlertFiles.join(', ')}`
          : `${scratchDir || `${face} 面 ${RULES_DIR}`} 下没有解析到任何 alert/record 规则`
      }(不把"没解析到"读成"没有规则")`,
    )
    return 2
  }
  if (exemptionError) {
    console.error(
      `[check-metric-existence] ❌ 未判定:例外台账不可用 —— ${exemptionError}(不把坏台账读成"没有例外")`,
    )
    return 2
  }

  const derivedNames = new Set(files.filter((r) => r.kind === 'record').map((r) => r.name))
  const referenced = [...new Set(files.flatMap((r) => r.metrics))].filter((n) => !isSystemName(n))
  // --rules-dir 是测试替代面:真台账的发射点/空挂判定只对真实 monitoring/** 生效,否则夹具必然误报空挂。
  const exemptions = scratchDir ? [] : ledgerEntries

  let prom = { base: null, liveNames: null, freshNames: null, error: null, errors: [] }
  if (!offline) {
    prom = await loadPrometheus({ bases, names: [...new Set([...referenced, ...derivedNames])] })
  }

  // 例外台账的采集健康态:在线时硬验 up{job};离线时留 null(只验发射点,输出会标明未验采集)。
  let scrapeUp = null
  if (!offline && prom.liveNames && exemptions.length) {
    const jobs = [...new Set(exemptions.map((e) => e?.job).filter((j) => typeof j === 'string' && j))]
    try {
      scrapeUp = await fetchUpByJob(prom.base, jobs)
    } catch (e) {
      scrapeUp = new Map() // fail-closed:up 查不出来 ⇒ 例外一律失效,照常判红
      console.error(
        `[check-metric-existence] ⚠️  例外采集健康查询失败(${e?.message || e})⇒ 例外按失效处理`,
      )
    }
  }
  let exemptionChecks
  try {
    exemptionChecks = evaluateExemptions(exemptions, {
      readFile: (rel) => readFace(face, rel),
      scrapeUp,
    })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`[check-metric-existence] ❌ 未判定:${e.message}(不把取不到读成"发射点不存在")`)
      return 2
    }
    throw e
  }

  const { violations, checked, exempted } = classifyRules({
    refs: files,
    liveNames: prom.liveNames,
    freshNames: prom.freshNames,
    staticNames,
    derivedNames,
    externalPrefixes,
    exemptions,
    exemptionChecks,
    freshWindow: FRESH_WINDOW,
  })
  const allViolations = [...violations, ...findDanglingExemptions(exemptions, files)]

  const counts = { typo: 0, 'never-produced': 0, stale: 0, 'dangling-exemption': 0 }
  for (const v of allViolations) counts[v.category] += 1

  if (json) {
    console.log(
      JSON.stringify(
        {
          status: allViolations.length ? 'red' : prom.liveNames ? 'green' : 'green-static',
          checked,
          rules: files.length,
          freshWindow: FRESH_WINDOW,
          prometheus: prom.base,
          prometheusError: prom.error,
          counts,
          exemptions: {
            total: exemptions.length,
            applied: exempted.map((e) => ({
              rule: `${e.rule.kind}:${e.rule.name}`,
              metric: e.metric,
              why: e.why,
            })),
            failed: [...exemptionChecks.values()]
              .filter((c) => !c.ok)
              .map((c) => ({ metric: c.entry?.metric, why: c.why })),
            dangling: findDanglingExemptions(exemptions, files).length,
          },
          violations: allViolations,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `[check-metric-existence] 规则 ${files.length} 条(alert ${files.filter((r) => r.kind === 'alert').length} / record ${
        files.filter((r) => r.kind === 'record').length
      }),引用指标 ${checked} 处`,
    )
    if (prom.base) {
      console.log(
        `[check-metric-existence] 数据面 Prometheus ${prom.base}(名字全集 ${prom.liveNames.size} 条,新鲜窗口 ${FRESH_WINDOW})`,
      )
    } else if (offline) {
      console.log(`[check-metric-existence] ⚠️  强制离线:退到静态清单(代码声明 ${staticNames.size} 名 + exporter 前缀 ${externalPrefixes.length} 个)`)
    } else {
      console.log(`[check-metric-existence] ⚠️  Prometheus 不可达(${prom.error || '未知原因'})⇒ 退到静态清单;**无法判"样本过期"**`)
    }
    if (!prom.liveNames) {
      console.log('[check-metric-existence] ⚠️  新鲜度未判定(没有可用时序)⇒ 本次只判名字存在性')
    }
    if (exemptions.length) {
      const failed = [...exemptionChecks.values()].filter((c) => !c.ok).length
      console.log(
        `[check-metric-existence] 例外台账 ${exemptions.length} 条(硬验放行 ${exempted.length} / 失效判红 ${failed} / 空挂 ${
          allViolations.filter((v) => v.category === 'dangling-exemption').length
        })`,
      )
      exempted.forEach((e) => console.log(`  ↪ 例外放行 [${e.rule.kind}:${e.rule.name}] ${e.metric} —— ${e.why}`))
      if (!scrapeUp) {
        console.log('  ⚠️  本次未验采集健康(离线/无 Prometheus):例外只做了发射点静态校验')
      }
    }
    if (allViolations.length) {
      console.log(`[check-metric-existence] ❌ 判红 ${allViolations.length} 处(打错 ${counts.typo} / 从未产生 ${counts['never-produced']} / 过期 ${counts.stale} / 例外空挂 ${counts['dangling-exemption']}):`)
      allViolations.forEach((v, i) => {
        console.log(`  ${i + 1}. [${v.rule.kind}:${v.rule.name}] ${v.metric} —— ${v.reason}`)
        console.log(`     @ ${v.rule.file}`)
      })
      console.log('[check-metric-existence] ❌ exit 1(任一规则命中即非零退出)')
    } else {
      console.log(
        `[check-metric-existence] ✅ 规则引用的 ${checked} 处指标全部存在${
          prom.liveNames ? `且最近 ${FRESH_WINDOW} 有样本` : '(静态清单判定)'
        }${exempted.length ? `;${exempted.length} 处合法零样本已按台账硬验放行` : ''}`,
      )
    }
  }

  if (allViolations.length) return 1
  // 线上取到名字全集但新鲜度查询失败 ⇒ 未判定(exit 2),不冒充绿。
  if (!prom.liveNames && prom.error && !offline) return 2
  return 0
}

// ─── 自检(零副作用;三态各一例) ─────────────────────────────────

function runSelfTest() {
  const yaml = [
    'groups:',
    '  - name: selftest',
    '    rules:',
    '      - alert: TypoRule',
    '        expr: rate(ihui_llm_requests_totl[5m]) > 0',
    '      - alert: RealRule',
    '        expr: sum(rate(ihui_llm_requests_total[5m])) > 0',
    '      - alert: StaleRule',
    '        expr: increase(some_stale_metric_total[1h]) > 0',
    '      - record: job:real_rule:rate5m',
    '        expr: rate(ihui_llm_requests_total[5m])',
  ].join('\n')
  const refs = parseAlertRules(yaml).map((r) => ({
    file: 'selftest.yml',
    kind: r.kind,
    name: r.name,
    expr: r.expr,
    metrics: metricRefsFromExpr(r.expr),
  }))
  const liveNames = new Set(['ihui_llm_requests_total', 'some_stale_metric_total', 'job:real_rule:rate5m'])
  const freshNames = new Set(['ihui_llm_requests_total', 'job:real_rule:rate5m'])
  const derived = new Set(['job:real_rule:rate5m'])
  const base = classifyRules({ refs, liveNames, freshNames, derivedNames: derived })

  const cases = []
  const add = (name, fn, expectPass) => {
    try {
      cases.push({ name, ok: fn() === expectPass, got: fn() })
    } catch (e) {
      cases.push({ name, ok: false, got: `throw: ${e?.message || e}` })
    }
  }
  add('真实指标 + 有样本 ⇒ 不判红(RealRule)', () => base.violations.filter((v) => v.rule.name === 'RealRule').length === 0, true)
  add('打错一个字符 ⇒ 判 typo(TypoRule)', () => base.violations.find((v) => v.rule.name === 'TypoRule')?.category || '', 'typo')
  add('名字存在但窗口内无样本 ⇒ 判 stale(StaleRule)', () => base.violations.find((v) => v.rule.name === 'StaleRule')?.category || '', 'stale')
  add('recording 输出仍新鲜 ⇒ 不判红(record)', () => base.violations.filter((v) => v.rule.name === 'job:real_rule:rate5m').length === 0, true)
  // 反向:名字完全陌生(无近似) ⇒ never-produced,不得洗成 typo
  add(
    '陌生名字(无近似)⇒ never-produced',
    () =>
      classifyRules({
        refs: [{ file: 'x.yml', kind: 'alert', name: 'GhostRule', expr: 'x', metrics: ['totally_unknown_metric_xyz'] }],
        liveNames: new Set(['ihui_llm_requests_total']),
        freshNames: new Set(['ihui_llm_requests_total']),
      }).violations[0]?.category || '',
    'never-produced',
  )
  // 反向:在线时近似名字必须只判 typo,不得判 never-produced
  add(
    '近似名字必须判 typo,不得落 never-produced',
    () =>
      classifyRules({
        refs: [{ file: 'x.yml', kind: 'alert', name: 'NearRule', expr: 'x', metrics: ['ihui_llm_requests_totl'] }],
        liveNames: new Set(['ihui_llm_requests_total']),
        freshNames: new Set(['ihui_llm_requests_total']),
      }).violations[0]?.category || '',
    'typo',
  )

  // 例外台账:硬验通过才放行;发射点改名 / 采集掉线 / 到期 / 空挂 任一都必须判红,不许静默跳过。
  const exRefs = [{ file: 'ex.yml', kind: 'alert', name: 'EventRule', expr: 'x', metrics: ['event_only_total'] }]
  const exEntry = {
    metric: 'event_only_total',
    ruleFile: 'ex.yml',
    ruleName: 'EventRule',
    job: 'j',
    emitter: 'em.ts',
    until: '2999-01-01',
  }
  const checksOf = (text, up) =>
    evaluateExemptions([exEntry], { readFile: () => text, scrapeUp: new Map([['j', up]]) })
  const classifiedWith = (checks) =>
    classifyRules({
      refs: exRefs,
      liveNames: new Set(['ihui_llm_requests_total']),
      freshNames: new Set(),
      exemptions: [exEntry],
      exemptionChecks: checks,
    })
  add(
    '例外台账:发射点+采集双验通过 ⇒ 放行',
    () => classifiedWith(checksOf("Counter('event_only_total')", true)).violations.length,
    0,
  )
  add(
    '例外失效:发射点里已改名 ⇒ 判红(不许拿旧例外盖住改名)',
    () => classifiedWith(checksOf("Counter('renamed_total')", true)).violations.length,
    1,
  )
  add(
    '例外失效:采集掉线(up=0)⇒ 判红(掉线不是合法空闲)',
    () => classifiedWith(checksOf("Counter('event_only_total')", false)).violations.length,
    1,
  )
  const expiredChecks = evaluateExemptions([{ ...exEntry, until: '2000-01-01' }], {
    readFile: () => "Counter('event_only_total')",
    scrapeUp: new Map([['j', true]]),
  })
  add('例外失效:已到期 ⇒ 判红(续期须重新验过)', () => classifiedWith(expiredChecks).violations.length, 1)
  add(
    '例外空挂:规则已不再引用该指标 ⇒ 判红',
    () =>
      findDanglingExemptions(
        [exEntry],
        [{ file: 'other.yml', kind: 'alert', name: 'OtherRule', expr: 'x', metrics: ['x_total'] }],
      ).length,
    1,
  )

  let bad = 0
  for (const c of cases) {
    console.log(`${c.ok ? '✅' : '❌'} ${c.name} → ${c.got}`)
    if (!c.ok) bad += 1
  }
  console.log(`自检 ${cases.length - bad}/${cases.length} 通过`)
  return bad === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 不能 process.exit():fetch 的 socket/定时器仍在飞时强退会在 Windows 触发 libuv
  // `UV_HANDLE_CLOSING` 断言(2026-11-03 实测)。设 exitCode,让事件循环自然收尾。
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
}

export const __test__ = {
  listYamlFiles,
  listFaceYamlFiles,
  readFace,
  readFaceBatch,
  collectRuleRefs,
  classifyRules,
  levenshtein,
  readExternalPrefixes,
  readExemptions,
  evaluateExemptions,
  findDanglingExemptions,
  loadPrometheus,
  fetchFreshNames,
  fetchUpByJob,
  windowToSeconds,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
