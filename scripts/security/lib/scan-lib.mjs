// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全门共享扫描底座(2026-11-24 立)。
 *
 * 为什么抽一个底座而不是每个门各写一份 git 枚举/基线:
 *   本仓已有 12 道以上"全仓 grep 型"判据,每份都自带一套文件枚举与豁免逻辑,结局是
 *   同一份代码在 A 门被判红、在 B 门被判绿(§0.6 第二份实现必然漂移)。
 *
 * 三条纪律:
 *   · 取材面 = `git ls-files`(已入库文件)。CI checkout 干净树与本地工作树同源;
 *     未跟踪的临时产物不参与判据 —— 否则 `.ihui-agent/tmp` 里的构建副本会把同一处问题
 *     报成几十条。
 *   · 基线指纹 = 文件 + 规则 id + 代码片段哈希(**不含行号**):行号一挪位就全变,
 *     基线会退化成"每次改一行就全量红"。
 *   · 取不到 git / 读不到文件 ⇒ 显式 unjudged + exit 2,绝不用空数组冒充"没有问题"。
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DEFAULT_EXCLUDE = [
  'node_modules/',
  'dist/',
  '.next/',
  'out/',
  'coverage/',
  '.box-agent-scratch/',
  '.ihui-agent/',
  'apps/web/public/',
  'deploy/prod-bundle/',
]

export function listRepoFiles(root, { exts = [], exclude = DEFAULT_EXCLUDE } = {}) {
  let out
  try {
    out = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (err) {
    return { files: [], error: `git ls-files 失败: ${err?.message ?? err}` }
  }
  const files = String(out ?? '')
    .split('\0')
    .filter(Boolean)
    .filter((p) => !exclude.some((x) => p.startsWith(x)))
    .filter((p) => (exts.length ? exts.some((e) => p.endsWith(e)) : true))
  return { files, error: null }
}

export function readText(root, relPath, maxBytes = 512 * 1024) {
  try {
    const abs = join(root, relPath)
    const buf = readFileSync(abs)
    if (buf.length > maxBytes) return { text: '', skipped: 'too-large' }
    if (buf.includes(0)) return { text: '', skipped: 'binary' }
    return { text: buf.toString('utf8'), skipped: null }
  } catch {
    return { text: '', skipped: 'unreadable' }
  }
}

/** 片段脱敏:疑似密钥值时只留前后各 3 字符,避免把凭据写进报告与 CI 日志。 */
export function redactSnippet(s) {
  const t = String(s ?? '').trim().slice(0, 200)
  return t.replace(/((?:key|secret|token|password|passwd|pwd)[^\w]{0,3}[=:]\s*['"]?)([A-Za-z0-9+/_\-]{12,})/gi, (_, pre, val) => {
    return `${pre}${val.slice(0, 3)}***${val.slice(-2)}`
  })
}

/**
 * 逐行套规则。规则:
 *   { id, severity: 'critical'|'high'|'medium', re: RegExp, message, ignore?: RegExp }
 * `ignore` 命中该行即跳过(用于 `// security-exempt: <原因>` 这类行内豁免 ——
 * 豁免必须带原因,不能空口白免)。
 */
export function scanLines(files, rules, root) {
  const findings = []
  const skipped = []
  for (const file of files) {
    const { text, skipped: why } = readText(root, file)
    if (why) {
      skipped.push({ file, reason: why })
      continue
    }
    const lines = text.split(/\r?\n/)
    // Python docstring 状态:三引号块内是文档,不是代码。不跳会命中大量
    // "为什么不用 eval(...)" 这类反例说明(实测 2 条假红)。
    let inTriple = false
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const trimmed = line.trim()
      if (!trimmed) continue
      const quoteCount = (trimmed.match(/"""/g) || []).length + (trimmed.match(/'''/g) || []).length
      if (quoteCount) {
        if (quoteCount % 2 === 1) inTriple = !inTriple
        continue
      }
      if (inTriple) continue
      // 注释行不参与判据:本仓大量文档注释里写着 `exec()/verify=False` 的反例说明,
      // 把注释判成漏洞会直接制造一片假红(比不判更糟 —— 它会训练人忽略这道门)。
      if (/^(?:\/\/|#|\*|\/\*|\*\/)/.test(trimmed)) continue
      if (/security-exempt\s*:/.test(line)) continue
      // 豁免判定看「本行 + 下一行」:JSX 的 `dangerouslySetInnerHTML={{` 与
      // 真正的 `__html: jsonLdHtml(...)` 天然分两行,只看本行会把已转义的安全写法
      // 判成 XSS(实测 apps/web 的 JSON-LD 全族 40+ 条)。
      const exemptCtx = `${line}\n${lines[i + 1] ?? ''}`
      for (const rule of rules) {
        if (rule.exts && !rule.exts.some((e) => file.endsWith(e))) continue
        if (rule.ignore && rule.ignore.test(exemptCtx)) continue
        rule.re.lastIndex = 0
        if (!rule.re.test(line)) continue
        findings.push({
          file,
          line: i + 1,
          rule: rule.id,
          severity: rule.severity,
          message: rule.message,
          snippet: redactSnippet(line),
        })
      }
    }
  }
  return { findings, skipped }
}

export function fingerprint(finding) {
  const h = createHash('sha256').update(`${finding.file}|${finding.rule}|${finding.snippet}`).digest('hex')
  return h.slice(0, 16)
}

export function findingKey(f) {
  return `${f.file}|${f.rule}|${fingerprint(f)}`
}

export function loadBaseline(path) {
  if (!existsSync(path)) return { version: 1, keys: [], updatedAt: null, missing: true }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    return { version: raw.version ?? 1, keys: Array.isArray(raw.keys) ? raw.keys : [], updatedAt: raw.updatedAt ?? null, missing: false }
  } catch (err) {
    return { version: 1, keys: [], updatedAt: null, missing: true, error: String(err?.message ?? err) }
  }
}

export function saveBaseline(path, findings, now = Date.now()) {
  // 基线目录不会预先存在;不建目录会让 --update-baseline 静默失败,
  // 后续每轮都判「基线不存在 ⇒ 全部新增 ⇒ 恒红」。
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    `${JSON.stringify({ version: 1, updatedAt: new Date(now).toISOString(), keys: findings.map(findingKey).sort() }, null, 2)}\n`,
    'utf8',
  )
}

/** 新增 = 当前 findings 里不在基线的；存量 = 命中的（只报数）。 */
export function splitNew(baselineKeys, findings) {
  const set = new Set(baselineKeys ?? [])
  const fresh = findings.filter((f) => !set.has(findingKey(f)))
  const legacy = findings.filter((f) => set.has(findingKey(f)))
  return { fresh, legacy }
}

export function defaultBaselinePath(root, name) {
  return join(root, '.ihui-agent', 'state', 'security-baseline', `${name}.json`)
}

/**
 * 统一 CLI 出口。等级口径:
 *   0 = 无新增（存量只报数）
 *   1 = 有新增且 --strict（或 --fail-on-new 默认开）
 *   2 = 未判定（git/文件读不到,或 --update-baseline 之外的基线缺失时明确点名）
 */
export function runScanCli({
  name,
  findings,
  skipped = [],
  baselinePath,
  strict = true,
  updateBaseline = false,
  root: _root,
  extraLines = [],
  maxReport = 30,
  unjudged = null,
}) {
  const baseline = loadBaseline(baselinePath)
  const { fresh, legacy } = splitNew(baseline.keys, findings)
  const counts = { total: findings.length, fresh: fresh.length, legacy: legacy.length, skipped: skipped.length }
  // 豁免条目走的是 skipped 通道(便于统一报数),但它证明「读过且判定为已接受」,
  // 与「文件读不到」是两件事 —— 混在一起会把一整片绿的扫描判成 exit 2 未判定。
  const exemptSkips = skipped.filter((s) => String(s.reason ?? '').startsWith('exempt')).length
  const unreadableSkips = skipped.length - exemptSkips

  console.log(
    `[${name}] 扫描命中 ${counts.total} 条（新增 ${counts.fresh} / 存量 ${counts.legacy} / 跳过 ${counts.skipped}${exemptSkips ? `（含豁免 ${exemptSkips}）` : ''}）`,
  )
  for (const line of extraLines) console.log(`  ${line}`)
  if (baseline.missing) console.log(`  ⚠ 基线不存在：${baselinePath}（当前全部计为新增；确认后跑 --update-baseline）`)

  const show = fresh.length ? fresh : legacy
  const list = show.slice(0, maxReport)
  for (const f of list) {
    const mark = fresh.length ? '✗' : '·'
    console.log(`  ${mark} ${f.severity.padEnd(8)} ${f.file}:${f.line} [${f.rule}] ${f.message}`)
    console.log(`      ${f.snippet}`)
  }
  if (show.length > list.length) console.log(`  …另 ${show.length - list.length} 条（见 --json）`)

  if (updateBaseline) {
    saveBaseline(baselinePath, findings)
    console.log(`  已更新基线：${baselinePath}`)
    return { code: 0, counts, fresh, legacy, baselineUpdated: true }
  }
  if (unjudged) {
    console.log(`  ❔ 未判定：${unjudged}`)
    return { code: 2, counts, fresh, legacy, unjudged }
  }
  if (unreadableSkips && !findings.length) {
    console.log('  ❔ 未判定：全部文件读不到（不把"没读到"当成"没问题"）')
    return { code: 2, counts, fresh, legacy }
  }
  if (fresh.length && strict) return { code: 1, counts, fresh, legacy }
  return { code: 0, counts, fresh, legacy }
}

export const __test__ = { listRepoFiles, readText, redactSnippet, scanLines, fingerprint, findingKey, loadBaseline, saveBaseline, splitNew, runScanCli }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
