#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-brand-email-channel.mjs
/**
 * 守门 81:品牌邮件通道对账(blocking)。
 *
 * 起因(2026-09-23 已确证的静默缺陷,不是假想):邮件"版式模板"只存在于
 *   `apps/api/src/services/email-templates.ts`(renderSystemAlertEmail 等,机械风"智汇通报"),
 *   但存在**第二条绕过模板的自发通道**:`deploy/win/ihui-deploy.ps1` 的 Send-EmailNotify 自拼
 *   传输层 —— `Send-MailMessage -Body $text`(无 `-BodyAsHtml`)与
 *   `Invoke-RestMethod https://api.resend.com/emails`(payload 只有 text、无 html)直发纯文本。
 *   这类代码"能发出去、typecheck 全绿、lint 全绿",但用户收到的邮件没有样式 ——
 *   与守门 72/78 同族的"本地全绿也发现不了"那一类,本门补这个缺口。
 *
 * 扫描范围(刻意收窄,别扩大):`deploy/**` 与 `scripts/**`(不含 scripts/tests)下的
 *   .ps1 / .mjs / .js / .ts,以及 `.github/workflows/*.yml`。apps/ 不在范围内 ——
 *   运行时服务层(apps/api/src/services/**)本就 import 了模板,天然放过。
 *
 * 判据:
 *   R1 PowerShell `Send-MailMessage` 调用语句(含反引号续行)缺 `-BodyAsHtml` → 红。
 *   R2 出现 `api.resend.com/emails`(任意语言/形态,含 host+path 分行形态)而**同一发送
 *      上下文**(命中行前 12 行 / 后 6 行)看不到 html 字段(允许形态 `html:`、'html'、
 *      PS `@{ … html = … }`、Python `"html":`)→ 红。
 *   R3 ops 邮件脚本绕过品牌层:文件里有"发信动作"(createTransport/sendMail/api.resend.com)
 *      却既不引用 `email-templates` 也不调用 `notify-deploy-failure` → 红(每文件一条)。
 *      判据保守:注释行不计,宁漏不误报(本仓守门的一致取向)。
 *
 * 豁免:行内标记 `brand-mail-exempt: <原因>`(命中行或紧邻上行;PS `#`、JS `//`、YAML `#`)。
 *   存量走 `scripts/brand-email-channel-baseline.json`(key=`<path>#<规则>` → 容忍条数),
 *   只减不增棘轮:实发条数 ≤ 基线 → 放行并如实计数;超出 → 只把超出部分判红;基线 key
 *   归零 → 输出"余量提示"提醒下调。基线文件缺失按空基线判定(不静默放行),JSON 解析失败
 *   按脚本自身异常 exit 2。
 *
 * 三模式:
 *   --staged       pre-commit(runner 自动下发):只判**索引里在范围内的文件**(索引 blob
 *                  优先,取不到退回工作区);暂存集为空或取不到 → 按全量判
 *                  (守门 70 的既有教训:防"空暂存恒绿")。
 *   缺省(全量审计) 判所有 git 跟踪文件里在范围路径的工作区内容。
 *   --self-test    判据纯函数正反成对对照 + 临时仓模式取证,不触碰真实仓。
 *
 * 退出码:0 通过 / 1 检出未基线化违规 / 2 脚本自身异常(git 解析失败、基线 JSON 损坏等,
 *   绝不静默放行)。紧急跳过:HUSKY_SKIP_BRAND_MAIL_GUARD=1 git commit ...
 *
 * 当前接入:guardian-runner id '81',blocking,stagedTriggers=['deploy/','scripts/','.github/workflows/']。
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SKIP_ENV = 'HUSKY_SKIP_BRAND_MAIL_GUARD'
export const BASELINE_REL = 'scripts/brand-email-channel-baseline.json'
/** G1 自豁免前缀:本门脚本与其测试必然含违规字面量(判据正则/夹具),按文件名跳过。 */
export const SELF_EXEMPT_PREFIX = 'check-brand-email-channel'
/** 违规清单里每行最多展示的字符数。 */
export const SNIPPET_CHARS = 110
/** R2 "同一发送上下文"窗口:命中行前 12 行 / 后 6 行(实测两处真实形态分别在 -3 / -8 行)。 */
export const R2_WINDOW_BEFORE = 12
export const R2_WINDOW_AFTER = 6
/** R2 端点识别:api.resend.com 之后多远内出现 /emails 算同一端点(host+path 分行形态)。 */
export const R2_ENDPOINT_WINDOW_CHARS = 140

const SCANNED_EXTS = new Set(['.ps1', '.mjs', '.js', '.ts'])
const EXEMPT_RE = /brand-mail-exempt\s*:/
const SEND_MAIL_RE = /(^|[^-\w])Send-MailMessage\b/i
const BODY_AS_HTML_RE = /-BodyAsHtml\b/i
const RESEND_HOST_RE = /api\.resend\.com/g
/** html 字段允许形态:JS/YAML/Python 的 `html:`、带引号键、PS hashtable 的 `html =`。 */
const HTML_FIELD_RE = /(?:^|[^\w$])["']?html["']?\s*[:=]/m
const SEND_ACTION_RE = /createTransport|sendMail\b|api\.resend\.com/
const BRAND_LAYER_RE = /email-templates|notify-deploy-failure/

// ── git 派生:绝对路径候选解析 + 强制 windowsHide(守门 52)+ timeout(守门 80) ──
let _gitBin = undefined
export function gitBin() {
  if (_gitBin === undefined) _gitBin = resolveGitBin()
  return _gitBin
}

function git(args, opts = {}) {
  const bin = gitBin()
  if (!bin) throw new Error('git 可执行文件候选解析全部失败 —— 判据无法执行(按脚本异常处理)')
  return execFileSync(bin, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    timeout: 60_000,
    ...opts,
    windowsHide: true,
  })
}

/** 路径清单专用:git 输出的 UTF-8 字节按 utf8 解码(中文路径不丢,守门 79 同款教训)。 */
function gitPathList(args) {
  const buf = git(args, { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] })
  return buf.toString('utf8')
}

// ══════════════ 纯函数层(零副作用,经 __test__ 供 §22c 镜像测试直接 import) ══════════════

/** 范围判定:deploy/** 与 scripts/**(不含 scripts/tests)下的脚本扩展名 + workflows/*.yml。 */
export function isScannedPath(rel) {
  const norm = String(rel || '').replace(/\\/g, '/')
  const ext = norm.slice(norm.lastIndexOf('.'))
  if (norm.startsWith('.github/workflows/')) {
    return norm.endsWith('.yml') && !norm.slice('.github/workflows/'.length).includes('/')
  }
  if (!SCANNED_EXTS.has(ext)) return false
  if (norm.startsWith('deploy/')) return true
  if (norm.startsWith('scripts/tests/')) return false
  return norm.startsWith('scripts/')
}

/** G1 自豁免:本门脚本与其测试文件必然含字面量,按文件名前缀跳过。 */
export function isSelfExempt(rel) {
  const norm = String(rel || '').replace(/\\/g, '/')
  const name = norm.slice(norm.lastIndexOf('/') + 1)
  return name.startsWith(SELF_EXEMPT_PREFIX)
}

function langOf(rel) {
  const norm = String(rel || '').toLowerCase()
  if (norm.endsWith('.ps1')) return 'ps'
  if (norm.endsWith('.yml')) return 'yml'
  return 'js'
}

/** 注释行判定(ps/yml 以 # 起,js 以 // 或 * 起)——R3 与端点判据都不吃注释,宁漏不误报。 */
function isCommentLine(line, lang) {
  const t = String(line).trimStart()
  if (lang === 'js') return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
  return t.startsWith('#')
}

/** 豁免标记识别:命中行本身或紧邻上行为 `brand-mail-exempt:` 注释即豁免。 */
export function isExemptAt(lines, idx) {
  if (EXEMPT_RE.test(String(lines[idx] ?? ''))) return true
  if (idx > 0 && EXEMPT_RE.test(String(lines[idx - 1] ?? ''))) return true
  return false
}

/**
 * R1 前置:PS 单条调用语句抽取器。找到每个 `Send-MailMessage`,按反引号续行把逻辑语句
 * 合并成一条(返回 1 基 startLine / endLine / text),供逐条判 `-BodyAsHtml`。
 */
export function extractSendMailStatements(lines) {
  const out = []
  const lang = 'ps'
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i])
    if (isCommentLine(line, lang)) continue
    if (!SEND_MAIL_RE.test(line)) continue
    let j = i
    const parts = [line]
    while (/`\s*$/.test(String(lines[j])) && j + 1 < lines.length) {
      j += 1
      parts.push(String(lines[j]))
    }
    out.push({ startLine: i + 1, endLine: j + 1, startIdx: i, endIdx: j, text: parts.join('\n') })
    i = j
  }
  return out
}

/**
 * R2 前置:Resend 发送端点定位。`api.resend.com` 之后
 * R2_ENDPOINT_WINDOW_CHARS 字符内出现 `/emails` 才算发送端点(覆盖整串 URL 与
 * host+path 分行两种形态);只有裸域名(连通性探测/文档提及)不判。
 * 返回 [{ line(1 基), idx }]。
 */
export function findResendEndpointHits(text) {
  const hits = []
  const s = String(text ?? '')
  RESEND_HOST_RE.lastIndex = 0
  let m
  while ((m = RESEND_HOST_RE.exec(s)) !== null) {
    const idx = m.index
    const window = s.slice(idx, idx + R2_ENDPOINT_WINDOW_CHARS)
    if (window.includes('/emails')) {
      let line = 1
      for (let k = 0; k < idx; k += 1) if (s.charCodeAt(k) === 10) line += 1
      hits.push({ line, idx })
    }
    if (m.index === RESEND_HOST_RE.lastIndex) RESEND_HOST_RE.lastIndex += 1
  }
  return hits
}

/**
 * R2 判据:命中行的发送上下文(前 R2_WINDOW_BEFORE / 后 R2_WINDOW_AFTER 行)内是否存在
 * html 字段。刻意只看窗口 —— 窗口外孤立的 `html`(注释、无关字符串)不构成豁免,
 * 否则任何文件里一句 `// html` 就能赦掉纯文本直发。
 */
export function sendContextHasHtmlField(lines, hitLineIdx0) {
  const from = Math.max(0, hitLineIdx0 - R2_WINDOW_BEFORE)
  const to = Math.min(lines.length - 1, hitLineIdx0 + R2_WINDOW_AFTER)
  return HTML_FIELD_RE.test(lines.slice(from, to + 1).join('\n'))
}

/**
 * 单文件判定(纯函数)。stats 如实累计:judged / selfExempt / exempted / resendNonEmails。
 * 返回 violations:[{ path, rule, line, snippet }]。
 */
export function judgeText(rel, text, stats = newStats()) {
  const violations = []
  const norm = String(rel || '').replace(/\\/g, '/')
  if (isSelfExempt(norm)) {
    stats.selfExempt += 1
    return { violations, stats }
  }
  const lang = langOf(norm)
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  stats.judged += 1

  // ── R1:Send-MailMessage 缺 -BodyAsHtml(cmdlet 只可能出现在 PS / workflow 内联 pwsh) ──
  if (norm.endsWith('.ps1') || norm.endsWith('.yml')) {
    for (const stmt of extractSendMailStatements(lines)) {
      if (BODY_AS_HTML_RE.test(stmt.text)) continue
      let exempt = isExemptAt(lines, stmt.startIdx)
      if (!exempt) {
        for (let k = stmt.startIdx; k <= stmt.endIdx; k += 1) {
          if (EXEMPT_RE.test(String(lines[k]))) {
            exempt = true
            break
          }
        }
      }
      if (exempt) {
        stats.exempted += 1
        continue
      }
      violations.push({ path: norm, rule: 'R1', line: stmt.startLine, snippet: stmt.text })
    }
  }

  // ── R2:Resend /emails 端点且发送上下文无 html 字段 ──
  {
    const cleaned = lines.map((l) => (isCommentLine(l, lang) ? '' : l)).join('\n')
    for (const hit of findResendEndpointHits(cleaned)) {
      const i0 = hit.line - 1
      if (sendContextHasHtmlField(lines, i0)) continue
      if (isExemptAt(lines, i0)) {
        stats.exempted += 1
        continue
      }
      violations.push({ path: norm, rule: 'R2', line: hit.line, snippet: lines[i0] ?? '' })
    }
  }

  // ── R3:ops 邮件脚本绕过品牌层(每文件至多一条,保守:注释行不计) ──
  const whole = lines.join('\n')
  if (!BRAND_LAYER_RE.test(whole)) {
    let first = null
    for (let i = 0; i < lines.length; i += 1) {
      const l = String(lines[i])
      if (isCommentLine(l, lang)) continue
      if (!SEND_ACTION_RE.test(l)) continue
      if (isExemptAt(lines, i)) {
        stats.exempted += 1
        continue
      }
      first = { line: i + 1, snippet: l }
      break
    }
    if (first) violations.push({ path: norm, rule: 'R3', line: first.line, snippet: first.snippet })
  }

  return { violations, stats }
}

export function newStats() {
  return {
    judged: 0,
    selfExempt: 0,
    exempted: 0,
    unreadable: 0,
    baselineTolerated: 0,
    baselineShrinkKeys: [],
    baselineMissing: false,
  }
}

// ══════════════ 基线棘轮(只减不增) ══════════════

/** 基线缺失 → 空基线(照常判定,不静默放行);JSON 损坏 → 抛错由入口转 exit 2。 */
export function parseBaseline(jsonText) {
  const parsed = JSON.parse(jsonText)
  const counts = parsed && typeof parsed.counts === 'object' && parsed.counts !== null ? parsed.counts : {}
  const out = {}
  for (const [k, v] of Object.entries(counts)) out[k] = Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0
  return out
}

/**
 * 应用棘轮:按 `<path>#<rule>` 分组,实发 ≤ 基线 → 全部放行(计 tolerated);
 * 超出 → 只把超出部分判红(按行号升序,基线额度放行靠前的)。
 * 基线里实发归零的 key → 记入 shrink 提示(提醒下调基线,不判红)。
 */
export function applyBaseline(violations, baselineCounts, stats) {
  const byKey = new Map()
  for (const v of violations) {
    const key = `${v.path}#${v.rule}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(v)
  }
  const fresh = []
  for (const [key, list] of byKey) {
    const allow = Number(baselineCounts[key] ?? 0)
    list.sort((a, b) => a.line - b.line)
    const over = list.slice(allow)
    stats.baselineTolerated += list.length - over.length
    fresh.push(...over)
  }
  for (const key of Object.keys(baselineCounts)) {
    if (!byKey.has(key) && baselineCounts[key] > 0) stats.baselineShrinkKeys.push(key)
  }
  fresh.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line))
  return fresh
}

// ══════════════ 输出渲染 ══════════════

function snippet(line) {
  const s = String(line ?? '').replace(/\s+/g, ' ').trim()
  return s.length > SNIPPET_CHARS ? `${s.slice(0, SNIPPET_CHARS)}…` : s
}

const RULE_LABEL = {
  R1: 'R1 Send-MailMessage 缺 -BodyAsHtml(纯文本直发,无品牌版式)',
  R2: 'R2 Resend /emails 发送上下文无 html 字段(绕过模板的纯文本 API)',
  R3: 'R3 ops 邮件脚本绕过品牌层(未引用 email-templates / notify-deploy-failure)',
}

export function render(modeLabel, totalPaths, fresh, stats) {
  const lines = [
    `📧 品牌邮件通道对账(${modeLabel}):判定 ${stats.judged} 个在范围文件(候选 ${totalPaths} 个路径)`,
  ]
  if (fresh.length > 0) {
    lines.push(`❌ 检出 ${fresh.length} 处未基线化违规:`)
    for (const v of fresh.slice(0, 40)) {
      lines.push(`   - ${v.path}:${v.line}  [${RULE_LABEL[v.rule] ?? v.rule}]`)
      lines.push(`       ${snippet(v.snippet)}`)
    }
    if (fresh.length > 40) lines.push(`   ... 另有 ${fresh.length - 40} 处`)
    lines.push('')
    lines.push('   修复的唯一正确姿势:ops 邮件一律经品牌层 ——')
    lines.push('     ① PowerShell / CI / 脚本侧改调 `apps/api/scripts/notify-deploy-failure.ts`')
    lines.push('        (内部走 email-templates 的"智汇通报"版式),不在端内自拼传输层;')
    lines.push('     ② 确需新增模板:在 `apps/api/src/services/email-templates.ts` 加 render* 函数;')
    lines.push('     ③ 仅"确属有意纯文本且不需版式"(如对拍调试)才允许在命中行或紧邻上行加')
    lines.push('        `brand-mail-exempt: <一句话原因>`;存量红进 ' + BASELINE_REL + '(只减不增)。')
  } else {
    lines.push('✅ 未检出未基线化违规')
  }
  const notes = []
  if (stats.baselineTolerated > 0) notes.push(`基线放行=${stats.baselineTolerated}`)
  if (stats.exempted > 0) notes.push(`豁免标记命中=${stats.exempted}`)
  if (stats.selfExempt > 0) notes.push(`自豁免(本门自身与测试,判据含字面量)=${stats.selfExempt}`)
  if (stats.unreadable > 0) notes.push(`取不到内容=${stats.unreadable}`)
  if (notes.length) lines.push(`   计数:${notes.join(' · ')}(均为如实计数,非静默)`)
  if (stats.baselineShrinkKeys.length > 0) {
    lines.push(
      `   💡 基线余量(实发已归零,请下调 ${BASELINE_REL}):${stats.baselineShrinkKeys.slice(0, 10).join(', ')}`,
    )
  }
  return lines
}

// ══════════════ 取材(三种模式的候选清单) ══════════════

/** 暂存区路径(A/C/M/R/D/T/U);删除态无内容由 readIndexBlob 兜底返回 null。 */
export function stagedPaths(repoRoot) {
  return gitPathList(['-C', repoRoot, 'diff', '--cached', '--name-only', '--diff-filter=ACMRTUD', '-z'])
    .split('\0')
    .filter(Boolean)
}

/** 全量模式候选:git 跟踪文件(未跟踪内容不会被提交,不判)。 */
export function trackedPaths(repoRoot) {
  return gitPathList(['-C', repoRoot, 'ls-files', '-z']).split('\0').filter(Boolean)
}

function readIndexBlob(repoRoot, rel) {
  try {
    return git(['-C', repoRoot, 'show', `:${rel}`], {
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8')
  } catch {
    return null
  }
}

function readWorktreeFile(repoRoot, rel) {
  try {
    return readFileSync(join(repoRoot, rel), 'utf8')
  } catch {
    return null
  }
}

function readBaselineCounts(repoRoot) {
  let raw
  try {
    raw = readFileSync(join(repoRoot, BASELINE_REL), 'utf8')
  } catch {
    return { counts: {}, exists: false }
  }
  return { counts: parseBaseline(raw), exists: true }
}

/**
 * 审计入口(repoRoot / baseline 可注入,供 self-test 用临时仓取证)。
 * staged 模式:候选 = 暂存集 ∩ 范围;暂存集为空或取不到 → 退化全量(守门 70 教训,
 * 防"空暂存恒绿")。
 */
export function audit(repoRoot, { staged = false, baseline } = {}) {
  const stats = newStats()
  const { counts: baseCounts, exists: baselineExists } =
    baseline !== undefined ? { counts: baseline, exists: true } : readBaselineCounts(repoRoot)

  let candidates = null
  let modeLabel = null
  if (staged) {
    let list = null
    try {
      list = stagedPaths(repoRoot)
    } catch {
      list = null
    }
    if (list && list.length > 0) {
      candidates = list.filter(isScannedPath)
      modeLabel = 'pre-commit:索引里在范围内的文件'
    } else {
      candidates = trackedPaths(repoRoot).filter(isScannedPath)
      modeLabel = 'pre-commit 退化全量(暂存集为空/取不到,防"空暂存恒绿")'
    }
  } else {
    candidates = trackedPaths(repoRoot).filter(isScannedPath)
    modeLabel = '全量:跟踪文件工作区内容'
  }

  const violations = []
  for (const rel of candidates) {
    let text = null
    if (modeLabel.startsWith('pre-commit:')) {
      text = readIndexBlob(repoRoot, rel)
      if (text === null) text = readWorktreeFile(repoRoot, rel)
    } else {
      text = readWorktreeFile(repoRoot, rel)
    }
    if (text === null) {
      if (!isSelfExempt(rel)) stats.unreadable += 1
      continue
    }
    violations.push(...judgeText(rel, text, stats).violations)
  }
  if (!baselineExists && stats.judged > 0) {
    // 基线缺失不是错误,但必须显式说 —— 否则"全绿"可能只是没人把存量写进来
    stats.baselineMissing = true
  }
  const fresh = applyBaseline(violations, baseCounts, stats)
  if (staged && modeLabel.startsWith('pre-commit:')) {
    // --staged 只判暂存子集:基线 key 不在子集里 ≠ "实发归零",收缩提示只对全量有意义
    stats.baselineShrinkKeys = []
  }
  const label = stats.baselineMissing ? `${modeLabel};⚠️ 基线文件缺失,按空基线判定` : modeLabel
  return {
    code: fresh.length > 0 ? 1 : 0,
    lines: render(label, candidates.length, fresh, stats),
    violations: fresh,
    allViolations: violations,
    stats,
  }
}

// ══════════════ self-test(判据正反成对 + 临时仓模式取证,不触碰真实仓) ══════════════

function selfTestRun() {
  const results = []
  const check = (name, ok) => results.push({ name, ok: Boolean(ok) })
  const judge = (rel, text) => judgeText(rel, text, newStats()).violations

  // ── PS 抽取器 ──
  const ps1Lines = [
    'Send-MailMessage -SmtpServer $h -Body $text -Encoding UTF8',
    'Send-MailMessage -SmtpServer $h `',
    '    -Body $text -Encoding UTF8',
  ]
  const stmts = extractSendMailStatements(ps1Lines)
  check('1 PS 抽取器:两条调用各自成语句', stmts.length === 2)
  check('2 PS 抽取器:反引号续行合并为一条(跨 1-2 行)', stmts[1].startLine === 2 && stmts[1].endLine === 3)

  // ── R1 正反成对 ──
  const r1red = 'x.ps1'
  check(
    '3 R1 红:Send-MailMessage -Body $text 无 -BodyAsHtml',
    judge(r1red, 'Send-MailMessage -SmtpServer $h -Body $text').some((v) => v.rule === 'R1'),
  )
  check(
    '4 R1 绿:补 -BodyAsHtml',
    !judge(r1red, 'Send-MailMessage -SmtpServer $h -BodyAsHtml -Body $text').some((v) => v.rule === 'R1'),
  )
  check(
    '5 R1 绿:-BodyAsHtml 落在续行上同样判绿',
    !judge(r1red, 'Send-MailMessage -SmtpServer $h `\n    -BodyAsHtml -Body $text').some((v) => v.rule === 'R1'),
  )
  check(
    '6 R1 绿:紧邻上行 brand-mail-exempt 豁免',
    !judge(r1red, '# brand-mail-exempt: 有意纯文本\nSend-MailMessage -SmtpServer $h -Body $text').some(
      (v) => v.rule === 'R1',
    ),
  )
  check(
    '7 R1 绿:注释行里的 Send-MailMessage 不判',
    judge(r1red, '# Send-MailMessage 已废弃,不要用').length === 0,
  )

  // ── R2 正反成对 ──
  const psPayload = [
    "$payload = @{ from = 'a@b.c'; to = @($to); subject = $s; text = $t } | ConvertTo-Json",
    "Invoke-RestMethod -Uri 'https://api.resend.com/emails' -Method Post -Body $payload",
  ].join('\n')
  check(
    '8 R2 红:Resend /emails + payload 只有 text',
    judge('x.ps1', psPayload).some((v) => v.rule === 'R2'),
  )
  check(
    '9 R2 绿:payload 补 PS hashtable html 键',
    !judge(
      'x.ps1',
      psPayload.replace('text = $t', 'text = $t; html = $h'),
    ).some((v) => v.rule === 'R2'),
  )
  check(
    '10 R2 绿:JS `html:` 与 Python "html": 两种形态均被识别',
    !judge('x.mjs', "fetch('https://api.resend.com/emails', { body: JSON.stringify({ text: t, html: h }) })").some(
      (v) => v.rule === 'R2',
    ) &&
      !judge('x.py', "post('https://api.resend.com/emails', json={'text': t, \"html\": h})").some(
        (v) => v.rule === 'R2',
      ),
  )
  check(
    '11 R2 红:host+path 分行形态不逃逸(无 html 判红)',
    judge(
      'x.mjs',
      ["const r = await post({", "  host: 'api.resend.com',", "  path: '/emails',", '  body,', '})'].join('\n'),
    ).some((v) => v.rule === 'R2'),
  )
  check(
    '12 R2 红:孤立 html 出现在窗口之外(第 40 行)仍判红',
    judge(
      'x.mjs',
      [
        ...Array.from({ length: 40 }, (_, k) => `const v${k} = ${k}`),
        "fetch('https://api.resend.com/emails', { body: JSON.stringify({ text: t }) })",
      ].join('\n'),
    ).some((v) => v.rule === 'R2'),
  )
  check(
    '13 R2 绿:api.resend.com 后 140 字符内无 /emails(裸域名探测)不判',
    judge('x.mjs', "const ok = probe('api.resend.com') // 仅 TLS 连通性").filter((v) => v.rule === 'R2')
      .length === 0,
  )
  check(
    '14 R2 绿:brand-mail-exempt 标记豁免端点行',
    !judge(
      'x.ps1',
      psPayload.replace("Invoke-RestMethod", "# brand-mail-exempt: 灰度期纯文本\n        Invoke-RestMethod"),
    ).some((v) => v.rule === 'R2'),
  )

  // ── R3 正反 ──
  check(
    '15 R3 红:ops 脚本有 sendMail 且无品牌层引用',
    judge('deploy/send-notify.mjs', "import nodemailer from 'nodemailer'\ntransporter.sendMail(msg)").some(
      (v) => v.rule === 'R3',
    ),
  )
  check(
    '16 R3 绿:import email-templates 即接上品牌层',
    !judge(
      'deploy/send-notify.mjs',
      "import { renderSystemAlertEmail } from '../apps/api/src/services/email-templates'\ntransporter.sendMail(msg)",
    ).some((v) => v.rule === 'R3'),
  )
  check(
    '17 R3 绿:改调 notify-deploy-failure 同样放过',
    !judge('deploy/x.ps1', 'node apps/api/scripts/notify-deploy-failure.ts\nSend-MailMessage -Body $t -BodyAsHtml').some(
      (v) => v.rule === 'R3',
    ),
  )
  check(
    '18 R3 绿:仅注释提到 createTransport 不计发信动作',
    judge('scripts/doc-note.mjs', '// 历史上用过 createTransport,已迁移').length === 0,
  )
  check('19 R3 绿:ps1 无 Send-MailMessage 且无发信 token → 无违规', judge('deploy/clean.ps1', 'Write-Host ok').length === 0)

  // ── 自豁免 / 范围 ──
  const seStats = newStats()
  const se = judgeText(
    'scripts/check-brand-email-channel.mjs',
    "Send-MailMessage -Body $text\nfetch('https://api.resend.com/emails')",
    seStats,
  )
  check('20 自豁免:本门脚本自身含字面量不判红且如实计数', se.violations.length === 0 && seStats.selfExempt === 1)
  check('21 范围:deploy+scripts+workflows 在范围,tests/apps/其他扩展名不在',
    isScannedPath('deploy/win/a.ps1') &&
      isScannedPath('scripts/b.mjs') &&
      isScannedPath('.github/workflows/c.yml') &&
      !isScannedPath('scripts/tests/d.mjs') &&
      !isScannedPath('apps/api/src/services/e.ts') &&
      !isScannedPath('deploy/win/f.log') &&
      !isScannedPath('.github/workflows/nested/g.yml'))

  // ── 基线棘轮 ──
  const mk = (n) => Array.from({ length: n }, (_, k) => ({ path: 'p.ps1', rule: 'R1', line: k + 1, snippet: '' }))
  const stA = newStats()
  const fA = applyBaseline(mk(3), { 'p.ps1#R1': 2 }, stA)
  check('22 棘轮:实发 3 / 基线 2 → 只超出部分判红 1', fA.length === 1 && stA.baselineTolerated === 2)
  const stB = newStats()
  check('23 棘轮:实发 ≤ 基线 → 全放行', applyBaseline(mk(1), { 'p.ps1#R1': 2 }, stB).length === 0)
  const stC = newStats()
  applyBaseline([], { 'p.ps1#R1': 2 }, stC)
  check('24 棘轮:基线 key 实发归零 → 收缩提示不判红', stC.baselineShrinkKeys.length === 1)

  // ── 临时仓:--staged / 全量 / 空暂存退化 ──
  const root = mkdtempSync(join(ROOT, '.ihui-agent', 'tmp', 'brand-mail-drill-'))
  const repo = join(root, 'repo')
  mkdirSync(repo, { recursive: true })
  const g = (args) => git(['-C', repo, ...args])
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    mkdirSync(join(repo, 'deploy'), { recursive: true })
    const BAD = 'Send-MailMessage -SmtpServer $h -Body $text'
    writeFileSync(join(repo, 'deploy', 'a.ps1'), 'Write-Host clean\n')
    writeFileSync(join(repo, 'README.txt'), 'hello\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'init'])

    check('25 干净仓:全量判绿', audit(repo, { baseline: {} }).code === 0)

    // 索引干净、磁盘脏 → --staged 判绿(未暂存内容不会被本次提交带上)
    writeFileSync(join(repo, 'deploy', 'a.ps1'), BAD + '\n')
    writeFileSync(join(repo, 'README.txt'), 'hello 2\n')
    g(['add', 'README.txt'])
    const s1 = audit(repo, { staged: true, baseline: {} })
    check('26 --staged 只判索引:a.ps1 仅磁盘脏 → 本次提交判绿', s1.code === 0)
    check('27 全量模式同一脏文件 → 判红(两种取材面语义相反且各自正确)', audit(repo, { baseline: {} }).code === 1)

    // 暂存进索引 → --staged 判红并点名
    g(['add', 'deploy/a.ps1'])
    const s2 = audit(repo, { staged: true, baseline: {} })
    check(
      '28 --staged 命中索引里的违规并点名文件+规则',
      s2.code === 1 && s2.violations.some((v) => v.path === 'deploy/a.ps1' && v.rule === 'R1'),
    )
    // 基线在位 → 同一条违规被棘轮放行
    const s3 = audit(repo, { staged: true, baseline: { 'deploy/a.ps1#R1': 1 } })
    check('29 基线在位 → 存量放行、不判红', s3.code === 0 && s3.stats.baselineTolerated === 1)

    g(['commit', '-qm', 'bad in'])
    // 暂存集为空 → 必须退化全量(防"空暂存恒绿")
    const s4 = audit(repo, { staged: true, baseline: {} })
    check('30 暂存集为空 → 退化全量仍判红(防"空暂存恒绿")', s4.code === 1)

    let fail = 0
    for (const r of results) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
      if (!r.ok) fail += 1
    }
    console.log(
      fail
        ? `❌ check-brand-email-channel self-test FAILED ${fail}/${results.length}`
        : `✅ check-brand-email-channel self-test 全部通过(${results.length} 例,含正反成对对照)`,
    )
    return fail ? 1 : 0
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════ main ══════════════

const HELP = [
  '用法:node scripts/check-brand-email-channel.mjs [--staged] [--self-test] [--help]',
  '',
  '  缺省        全量审计:deploy/** 与 scripts/**(不含 tests)的 .ps1/.mjs/.js/.ts + workflows/*.yml',
  '  --staged    pre-commit 模式:只判索引里在范围内的文件;暂存集为空/取不到 → 退化全量',
  '  --self-test 判据正反成对对照 + 临时仓模式取证,不触碰真实仓',
  '',
  '判据:R1 Send-MailMessage 缺 -BodyAsHtml / R2 Resend /emails 发送上下文无 html / R3 ops 绕过品牌层',
  `豁免:命中行或紧邻上行 \`brand-mail-exempt: <原因>\`;存量:${BASELINE_REL}(只减不增)`,
  `退出码:0 通过 / 1 检出未基线化违规 / 2 脚本自身异常。紧急跳过:${SKIP_ENV}=1`,
].join('\n')

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.log(HELP)
    return 0
  }
  if (argv.includes('--self-test')) return selfTestRun()
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⚠️  已跳过品牌邮件通道守门(${SKIP_ENV}=1)`)
    return 0
  }
  if (!gitBin()) {
    console.error('❌ 未解析到可用 git 可执行文件(候选全失败)—— 判据无法执行,按异常处理')
    return 2
  }
  const { code, lines } = audit(ROOT, { staged: argv.includes('--staged') })
  console.log(lines.join('\n'))
  return code
}

/** §22d 双形态入口守护:测试 import 时不得触发 CLI 副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  gitBin,
  isScannedPath,
  isSelfExempt,
  isExemptAt,
  extractSendMailStatements,
  findResendEndpointHits,
  sendContextHasHtmlField,
  judgeText,
  newStats,
  parseBaseline,
  applyBaseline,
  audit,
  render,
  SKIP_ENV,
  BASELINE_REL,
  SELF_EXEMPT_PREFIX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
