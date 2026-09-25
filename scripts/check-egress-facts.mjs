#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 116(拟号,本票**未接** guardian-runner;登记时以 runner 现最大号 +1 且查重为准 ——
 * 2026-09-25 实测并发会话已把 115 取给 check-tool-arg-validation-wired,故本门顺延 116)
 * —— 厂商出站必须经"带回 egress 事实"的唯一包装函数。
 *
 * 一句话:对外发往第三方/厂商域名的请求,如果绕开了 `apps/api/src/routes/ai-vendors/_shared.ts`
 * 的 `fetchWithTimeout`(或 `proxy-dispatcher` 的 `proxiedFetch`),那这一趟响应上就**没有** `egress`
 * 字段 —— 于是又回到 AGENTS §5b 那三条排查的原点:出事了没人知道"我这趟到底用了哪份代理/CA 配置",
 * 只能人肉 `env | grep proxy`。判据只此一条,不贪多。
 *
 * 判据(EX):一个请求发起点(`fetch(` / `axios*(` / `http(s).request(` / `new XMLHttpRequest` /
 * axios 动词式 `get(`/`post(`…)在同一处窗口(±3 行)内出现**厂商域名字面量**,而该发起点不是包装函数
 * 本身 ⇒ 红。厂商域名表**不是硬编码**:`deriveVendorDomains()` 从仓库既存的三张表推导
 * (`VENDORS` 的 baseUrl、`proxy-dispatcher` 的内置白名单、`apps/cli` 的 provider 内置基址)。
 *
 * 两个刻意的窄口径(宁漏不误报,与守门 52/67 同取向):
 *   1. 动态拼出来的 URL(`vendor.baseUrl + path` 且附近无字面量)结构上判不了 ⇒ 计入 `undetermined`
 *      并如实报数,不判红也绝不静默成"看起来全绿";
 *   2. 判据是**每调用点**,不是"文件里有没有 fetch" —— 同一文件可以既有包装调用也有裸调用。
 *
 * 取材口径(本仓通行):全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;
 * 清单与内容同面同轮;取不到 ⇒ **exit 2「无法判定」**(既不冒红也不记绿);枚举到 0 个文件判死。
 * 棘轮:每文件额度 = **该文件在本次取材面自身的违规数**(`--update-baseline` 收紧),
 * 只拦"这次改动把绕档加回来了",不拦仓库既有债 —— 与改动无关的恒红只会逼人 `--no-verify`。
 *
 * 用法:
 *   node scripts/check-egress-facts.mjs                 # 全量(HEAD)
 *   node scripts/check-egress-facts.mjs --staged        # 提交链(索引)
 *   node scripts/check-egress-facts.mjs --update-baseline
 *   node scripts/check-egress-facts.mjs --self-test
 *   node scripts/check-egress-facts.mjs --json
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const SELF_URL = import.meta.url
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = resolve(ROOT, 'scripts/egress-facts-baseline.json')
const GIT_BIN = process.env.GIT_BIN || 'git'

/** 被认作"已带出口事实"的两个出口名。*/
const WRAPPER_NAMES = ['fetchWithTimeout', 'proxiedFetch']

/** 判定面:本仓实测的对外出口聚集地(覆盖面口径每次由 --json 现报,不在文档里写死)。*/
const SCAN_PREFIXES = ['apps/api/src', 'apps/cli/src/provider']

/** 域名表来源:全部是仓库既有清单,本文件不再抄第二份厂商名。
 *  实测说明:`apps/cli/src/provider/` 下只有 local.ts,厂商基址不在 CLI 侧写死
 *  (git grep 'api.deepseek.com' -- apps/cli 零命中),所以本仓 TS 侧的厂商域名表**就这两张**。 */
const DOMAIN_TABLE_SOURCES = [
  { file: 'apps/api/src/routes/ai-vendors/_shared.ts', kind: 'vendors-baseUrl', note: 'VENDORS 注册表每条 baseUrl 的 hostname' },
  { file: 'apps/api/src/utils/proxy-dispatcher.ts', kind: 'array-literal', constName: 'DEFAULT_PROXY_DOMAINS', note: '被墙厂商域内置白名单' },
]

/** 窗口:字面量要落在发起点附近才算"这趟打的是厂商"。*/
const WINDOW_LINES = 3

const CALL_RES = [
  /\bfetch\s*\(/g,
  /\baxios(?:\.\w+)?\s*\(/g,
  /\b(?:get|post|put|patch|delete)\s*\(/g,
  /\bhttps?\s*\.\s*request\s*\(/g,
  /\bnew\s+XMLHttpRequest\s*\(/g,
]

// ─────────────────────────────────────────────────────────────────────────────
// 纯判据(用构造输入即可证明,不依赖仓库瞬时状态)
// ─────────────────────────────────────────────────────────────────────────────

/** 剥注释、留字符串(厂商域名就住在字符串里,那正是要看的)。*/
function stripComments(src) {
  let out = ''
  let i = 0
  let state = 'code'
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && n === '*') { state = 'block'; out += '  '; i += 2; continue }
      if (c === "'") state = 'squote'
      else if (c === '"') state = 'dquote'
      else if (c === '`') state = 'template'
      out += c
      i += 1
      continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c } else out += ' '
      i += 1
      continue
    }
    if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? '\n' : ' '
      i += 1
      continue
    }
    if (c === '\\') { out += c + (n ?? ''); i += 2; continue }
    if (
      (state === 'squote' && c === "'") ||
      (state === 'dquote' && c === '"') ||
      (state === 'template' && c === '`')
    )
      state = 'code'
    out += c
    i += 1
  }
  return out
}

/** 一行/一段文本里出现的 hostname 形态(小写;不含端口与路径)。*/
function hostsIn(text) {
  const found = new Set()
  for (const m of text.matchAll(/https?:\/\/([a-z0-9][a-z0-9.-]*[a-z0-9])/gi)) found.add(m[1].toLowerCase())
  for (const m of text.matchAll(/(?<![\w./-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?![\w./-])/gi)) found.add(m[0].toLowerCase())
  return [...found]
}

function isCallSiteLine(line) {
  return CALL_RES.some((re) => { re.lastIndex = 0; return re.test(line) })
}

function callsWrapper(line) {
  return WRAPPER_NAMES.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(line))
}

/** 定义处与包装调用不算绕档(包装函数自己当然要裸 fetch 一次)。*/
function isWrapperDefinition(line) {
  return /(?:^|\s)(?:async\s+)?function\s+(fetchWithTimeout|proxiedFetch)\b/.test(line)
}

function hostInDomainSet(host, domains) {
  for (const d of domains) {
    if (host === d || host.endsWith(`.${d}`)) return d
  }
  return null
}

/**
 * 单文件判据核心:hard(计红) + undetermined(只报数)。
 * @param vendorDomains 厂商域名数组(小写)
 */
function analyzeFile({ path, content, vendorDomains }) {
  const hard = []
  const undetermined = []
  if (!content || content.trim() === '') return { hard, undetermined }
  const lines = stripComments(content).split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!isCallSiteLine(line) || callsWrapper(line) || isWrapperDefinition(line)) continue
    const window = lines.slice(Math.max(0, i - WINDOW_LINES), i + WINDOW_LINES + 1).join('\n')
    let matched = null
    for (const h of hostsIn(window)) {
      const d = hostInDomainSet(h, vendorDomains)
      if (d) { matched = d; break }
    }
    if (matched) {
      hard.push({ line: i + 1, host: matched })
      continue
    }
    if (/\bfetch\s*\(/.test(line) && /(baseUrl|url|URL|endpoint)/.test(line))
      undetermined.push({ line: i + 1, reason: 'dynamic-url' })
  }
  return { hard, undetermined }
}

/** 棘轮:超过该文件在取材面自身的额度 ⇒ 红。*/
function decideRatchet({ file, count, baselineCounts }) {
  const allowed = baselineCounts?.[file] ?? 0
  if (count > allowed) return { file, count, allowed, status: 'red' }
  if (count < allowed) return { file, count, allowed, status: 'improved' }
  return { file, count, allowed, status: 'ok' }
}

/** 从仓库文本推导厂商域名表(三张表逐条记出处;一条都没有才算表不可用)。*/
function deriveVendorDomains({ sources }) {
  const domains = new Set()
  const provenance = []
  for (const src of sources) {
    let n = 0
    if (!src.text) {
      provenance.push({ file: src.file, kind: src.kind, note: src.note, hosts: 0, status: 'unavailable' })
      continue
    }
    if (src.kind === 'vendors-baseUrl') {
      for (const m of src.text.matchAll(/baseUrl\s*:\s*['"`]([^'"`]+)['"`]/g)) {
        const host = hostsIn(m[1])[0]
        if (host && !host.includes('${')) { domains.add(host.toLowerCase()); n += 1 }
      }
    } else {
      const block = src.text.match(new RegExp(`${src.constName}[\\s\\S]*?=\\s*\\[([\\s\\S]*?)\\]`))
      if (block) {
        for (const m of block[1].matchAll(/['"`]([^'"`]+)['"`]/g)) { domains.add(m[1].toLowerCase()); n += 1 }
      }
    }
    provenance.push({ file: src.file, kind: src.kind, note: src.note, hosts: n, status: n > 0 ? 'ok' : 'empty' })
  }
  return { domains: [...domains].sort(), provenance }
}

/**
 * 汇总为退出码。两条"不得记绿"的硬条件:
 *  - 枚举到 0 个文件(空扫) ⇒ 2
 *  - 三张域名表一条都没推出值(判据失去依据) ⇒ 2
 * 单个来源为空只降级为警告并如实点名(上游改表名不该让本门罢工 —— 那等于把门换成常闭)。
 */
function decide({ verdicts, undetermined, provenance, enumerated, domainCount }) {
  const reasons = []
  if (!enumerated) reasons.push('枚举到 0 个在判范围内的文件 —— 空扫不得记为通过')
  if (domainCount === 0) reasons.push('厂商域名表全部为空 —— 判据没有依据')
  const red = verdicts.filter((v) => v.status === 'red')
  const improved = verdicts.filter((v) => v.status === 'improved')
  if (reasons.length) return { exit: 2, red, improved, undetermined, reasons, fatal: true }
  return { exit: red.length ? 1 : 0, red, improved, undetermined, reasons, fatal: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// git 取材
// ─────────────────────────────────────────────────────────────────────────────

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync(GIT_BIN, ['-C', ROOT, '-c', 'safe.directory=*', ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
      windowsHide: true,
    })
  } catch {
    if (allowFail) return null
    throw new Error(`git ${args.join(' ')} 失败`)
  }
}

/**
 * 预筛:只把"含任一厂商域名字面量"的文件送去逐文件读取。
 *
 * 为什么必须预筛:本仓 HEAD 在判定面内有近 1000 个文件,逐个 `git show` 会让一道门跑到分钟级 ——
 * 慢门的唯一结局和恒红门一样,是逼人 `--no-verify`(§12e 同型)。
 * 安全性:判据要求"窗口内出现的 host 等于表内 d 或以 `.d` 结尾",这种 host 必然**含** d 作为子串,
 * 所以 `--fixed-strings -e d` 的命中集是判据所需内容的**严格超集**(筛不掉任何真违规)。
 * 预筛失败(不可用/报错)⇒ 退回全量读取并**如实说明**,不静默变成"什么都没扫"。
 */
function prefilterArgs({ domains, staged }) {
  const args = ['grep', '-l', '-I', '--fixed-strings']
  if (staged) args.push('--cached')
  for (const d of domains) args.push('-e', d)
  // 顺序必须是 flag → -e 模式 → 修订 → `--` 路径;把 HEAD 放在 -e 之前 git 会把 "-e" 当成修订名
  // 报 `fatal: unable to resolve revision: -e`(本门首跑就是这么红的,判据没错、参数序错)。
  if (!staged) args.push('HEAD')
  args.push('--', ...SCAN_PREFIXES)
  return args
}

function prefilter({ files, domains, staged }) {
  if (!domains.length) return { set: null, note: '域名表为空,跳过预筛' }
  const out = git(prefilterArgs({ domains, staged }), { allowFail: true })
  if (out === null) return { set: null, note: 'git grep 预筛不可用 → 退回全量读取' }
  const hits = new Set(
    out
      .split('\n')
      .map((l) => l.trim().replace(/^HEAD:/, ''))
      .filter(Boolean),
  )
  return { set: hits, note: `预筛 ${files.length} → ${files.filter((f) => hits.has(f)).length} 文件` }
}

function isSource(p) {
  return /\.(ts|tsx|mts)$/.test(p) && !/\.test\./.test(p) && !/[\\/]__tests__[\\/]/.test(p)
}

/** 全量 = HEAD 树;staged = 索引相对 HEAD 有差异的跟踪文件(空则退全量,防"空暂存恒绿")。*/
function enumerate({ staged }) {
  if (!staged) {
    const out = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_PREFIXES], { allowFail: true })
    if (out === null) return { files: null, note: 'HEAD 树读取失败' }
    return { files: out.split('\n').filter(isSource).map((p) => p), note: 'HEAD 全量清单' }
  }
  const out = git(['diff', '--cached', '--name-only', '--diff-filter=ACMRT', 'HEAD', '--', ...SCAN_PREFIXES], {
    allowFail: true,
  })
  if (out === null) return { files: null, note: '索引 diff 读取失败' }
  const list = out.split('\n').filter(isSource)
  if (list.length === 0) {
    const fb = enumerate({ staged: false })
    return { files: fb.files, note: `暂存集为空 → 回退全量(${fb.note})` }
  }
  return { files: list, note: '索引(本次暂存改动)' }
}

function readFace(path, { staged, worktree }) {
  if (worktree) {
    const abs = resolve(ROOT, path)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : undefined
  }
  const out = git(staged ? ['show', `:${path}`] : ['show', `HEAD:${path}`], { allowFail: true })
  return out === null ? undefined : out
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH))
    return { counts: {}, note: '基线文件不存在 → 全部额度按 0 判(首次建基线请跑 --update-baseline)' }
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    if (!parsed || typeof parsed.counts !== 'object' || parsed.counts === null)
      throw new Error('counts 字段不是对象')
    return { counts: parsed.counts, note: '' }
  } catch (err) {
    // 坏 JSON 显式报错:静默当空清单 = 把所有存量一夜判红
    return { counts: null, note: `基线 JSON 不可解析(不静默当空清单):${err.message}` }
  }
}

async function main(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const asJson = argv.includes('--json')
  const update = argv.includes('--update-baseline')
  if (staged && worktree) {
    console.error('❌ --staged 与 --worktree 同时给出:两个取材面不得并存。')
    return 2
  }
  if (topLevelMismatch()) {
    console.error('❌ 无法判定:仓库根与脚本位置不一致。')
    return 2
  }
  if (worktree) console.warn('⚠️ --worktree 判的是可能滞后的共享工作树,不是提交内容 —— 仅人工排查用。')

  const baseline = loadBaseline()
  if (baseline.counts === null) {
    console.error(`❌ ${baseline.note}`)
    return 2
  }
  if (baseline.note) console.warn(`⚠️ ${baseline.note}`)

  const face = worktree ? 'worktree' : staged ? 'index' : 'HEAD'
  const readOpts = { staged, worktree }
  const { domains, provenance } = deriveVendorDomains({
    sources: DOMAIN_TABLE_SOURCES.map((s) => ({ ...s, text: readFace(s.file, readOpts) })),
  })

  const enumResult = enumerate({ staged })
  if (enumResult.files === null) {
    console.error(`❌ 无法判定:文件清单取不到(${enumResult.note})`)
    return 2
  }
  const files = enumResult.files

  const verdicts = []
  const perFileCounts = {}
  let undetermined = 0
  const pre = prefilter({ files, domains, staged })
  const toRead = pre.set ? files.filter((p) => pre.set.has(p)) : files
  for (const path of toRead) {
    const content = readFace(path, readOpts)
    if (content === undefined) {
      console.error(`❌ 无法判定:取材面 ${face} 上读不到 ${path}`)
      return 2
    }
    const { hard, undetermined: und } = analyzeFile({ path, content, vendorDomains: domains })
    undetermined += und.length
    if (!hard.length) continue
    perFileCounts[path] = hard.length
    const v = decideRatchet({ file: path, count: hard.length, baselineCounts: baseline.counts })
    verdicts.push({ ...v, sites: hard.map((s) => `L${s.line}→${s.host}`).join(' ') })
  }

  const result = decide({ verdicts, undetermined, provenance, enumerated: files.length > 0, domainCount: domains.length })

  if (update) {
    // 只记非零条目:全量登记 0 会让基线随文件数线性膨胀,而 0 与"不在表内"语义相同
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          generatedBy: 'scripts/check-egress-facts.mjs',
          face,
          note: '每文件额度:只减不增。判红锚点 = 该文件在本次取材面自身的违规数;缺条目按 0 计。',
          coverage: `判定面 ${SCAN_PREFIXES.join(' + ')};覆盖面 ${enumResult.note}`,
          counts: perFileCounts,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    const total = Object.values(perFileCounts).reduce((a, b) => a + b, 0)
    console.log(`✅ 基线已按取材面 ${face} 重建:${total} 处 / ${Object.keys(perFileCounts).length} 文件(${pre.note})`)
    return 0
  }

  const summary = {
    face,
    enumerateNote: enumResult.note,
    scanned: files.length,
    domainCount: domains.length,
    domainTables: provenance,
    red: result.red,
    improved: result.improved.map((v) => `${v.file} ${v.count}<${v.allowed}`),
    undetermined,
    exit: result.exit,
  }
  if (asJson) console.log(JSON.stringify(summary, null, 2))
  else {
    for (const p of provenance) console.log(`  · 域名表 ${p.file} [${p.kind}] → ${p.hosts} 条 (${p.status}) — ${p.note}`)
    console.log(`  取材面 ${face} | ${enumResult.note} | 范围内 ${summary.scanned} 文件 | ${pre.note} | 厂商域名 ${summary.domainCount} 个`)
    if (summary.improved.length) console.log(`  ℹ️ 低于额度,建议 --update-baseline 收紧:${summary.improved.join('; ')}`)
    for (const v of result.red) {
      console.log(`❌ ${v.file}:绕开包装函数的厂商出站 ${v.count} 处(该文件自身额度 ${v.allowed})`)
      console.log(`     ${v.sites}`)
    }
    console.log(
      result.exit === 2
        ? `⚠️ 无法判定(不记绿也不冒红):${result.reasons.join(';')}`
        : `结论:${result.red.length ? `${result.red.length} 个文件新增绕档` : '无新增绕档'} | 动态 URL 判不出 ${undetermined} 处(如实报数,不静默放行)`,
    )
  }
  return result.exit
}

function topLevelMismatch() {
  const out = git(['rev-parse', '--show-toplevel'], { allowFail: true })
  if (out === null) return true
  return out.trim().replace(/\\/g, '/').toLowerCase() !== ROOT.replace(/\\/g, '/').toLowerCase()
}

export const __test__ = {
  stripComments,
  hostsIn,
  analyzeFile,
  decideRatchet,
  deriveVendorDomains,
  decide,
  prefilterArgs,
  isCallSiteLine,
  callsWrapper,
  SCAN_PREFIXES,
  WRAPPER_NAMES,
  DOMAIN_TABLE_SOURCES,
  WINDOW_LINES,
}

if (process.argv[1] && SELF_URL === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest())
  }
  main(argv)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`❌ ${err?.message ?? err}\n${err?.stack ?? ''}`)
      process.exit(2)
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 逻辑自检(成对正反例 + "空枚举不得记绿"反向对照;零副作用、不碰真仓)
// ─────────────────────────────────────────────────────────────────────────────

function runSelfTest() {
  let pass = 0
  let fail = 0
  const ok = (name, cond) => {
    if (cond) { pass += 1; console.log(`  ✅ ${name}`) }
    else { fail += 1; console.log(`  ❌ ${name}`) }
  }
  const DOMAINS = ['api.openai.com', 'api.groq.com', 'api.stepfun.com']

  // ── S1 取材/判据基础
  ok('S1a 注释里的域名不计(只判真代码)', analyzeFile({ path: 'a.ts', content: '// 走 api.openai.com\n// const r = await fetch(x)', vendorDomains: DOMAINS }).hard.length === 0)
  ok('S1b 字符串里的域名要计', analyzeFile({ path: 'a.ts', content: "const r = await fetch('https://api.openai.com/v1')", vendorDomains: DOMAINS }).hard.length === 1)
  ok('S1c 块注释剥净且行号不漂', stripComments('/* api.openai.com\nx */\nconst y = 1').split('\n').length === 3)

  // ── S2 绕档 vs 已包装(成对)
  const raw = "const r = await fetch('https://api.groq.com/openai/v1/models')"
  const wrapped = "const r = await fetchWithTimeout('https://api.groq.com/openai/v1/models')"
  ok('S2a 裸 fetch 打厂商 ⇒ 计一处', analyzeFile({ path: 'a.ts', content: raw, vendorDomains: DOMAINS }).hard.length === 1)
  ok('S2b 走包装函数 ⇒ 不计(反向对照)', analyzeFile({ path: 'a.ts', content: wrapped, vendorDomains: DOMAINS }).hard.length === 0)
  ok(
    'S2c 包装函数自己的定义处不计',
    analyzeFile({ path: '_shared.ts', content: "export async function fetchWithTimeout(url) {\n  return await fetch(url)\n}", vendorDomains: DOMAINS }).hard.length === 0,
  )
  ok('S2d 非厂商域不计', analyzeFile({ path: 'a.ts', content: "await fetch('https://images.example.com/a.png')", vendorDomains: DOMAINS }).hard.length === 0)
  ok(
    'S2e 子域按后缀归到厂商表',
    analyzeFile({ path: 'a.ts', content: "await fetch('https://sub.api.openai.com/x')", vendorDomains: DOMAINS }).hard[0]?.host === 'api.openai.com',
  )
  ok(
    'S2f 窗口外的域名不算这一趟',
    analyzeFile({ path: 'a.ts', content: "const D='api.openai.com'\nconst a=1\nconst b=2\nconst c=3\nconst d=4\nawait fetch('/local')", vendorDomains: DOMAINS }).hard.length === 0,
  )

  // ── S3 判不出如实报数
  const dyn = analyzeFile({ path: 'a.ts', content: 'const r = await fetch(vendor.baseUrl + p)', vendorDomains: DOMAINS })
  ok('S3a 动态 URL ⇒ 不判红但计 undetermined', dyn.hard.length === 0 && dyn.undetermined.length === 1)
  ok(
    'S3b 动态 URL 附近有字面量则回到 hard(不隐身)',
    analyzeFile({ path: 'a.ts', content: "const base='https://api.stepfun.com/v1'\nawait fetch(base+path)", vendorDomains: DOMAINS }).hard.length === 1,
  )

  // ── S4 棘轮方向
  ok('S4a 超过自身额度 ⇒ red', decideRatchet({ file: 'a', count: 2, baselineCounts: { a: 1 } }).status === 'red')
  ok('S4b 等于自身额度 ⇒ ok(存量不追)', decideRatchet({ file: 'a', count: 1, baselineCounts: { a: 1 } }).status === 'ok')
  ok('S4c 低于额度 ⇒ improved 且提示收紧', decideRatchet({ file: 'a', count: 0, baselineCounts: { a: 1 } }).status === 'improved')
  ok('S4d 未登记文件按 0 额度(新增绕档即红)', decideRatchet({ file: 'new', count: 1, baselineCounts: {} }).status === 'red')

  // ── S5 域名表推导(不硬编码)
  const derived = deriveVendorDomains({
    sources: [
      { file: 'V', kind: 'vendors-baseUrl', note: '', text: "export const VENDORS = { a: { baseUrl: 'https://api.x.ai/v1' }, b: { baseUrl: '' } }" },
      { file: 'P', kind: 'array-literal', constName: 'DEFAULT_PROXY_DOMAINS', note: '', text: "const DEFAULT_PROXY_DOMAINS = [\n  'api.mistral.ai',\n]" },
      { file: 'C', kind: 'array-literal', constName: 'BUILTIN_DOMAINS', note: '', text: 'const BUILTIN_DOMAINS = ["api.deepseek.com"]' },
    ],
  })
  ok('S5a 三张表都被读到', derived.domains.includes('api.x.ai') && derived.domains.includes('api.mistral.ai') && derived.domains.includes('api.deepseek.com'))
  ok('S5b 空 baseUrl 不产域名', !derived.domains.includes(''))
  ok('S5c 出处逐条计数(表空要看得见)', derived.provenance.every((p) => p.status === 'ok') && derived.provenance.length === 3)
  ok(
    'S5d 单个表不可用只降级不判死',
    deriveVendorDomains({ sources: [{ file: 'X', kind: 'array-literal', constName: 'NOPE', note: '', text: undefined }, { file: 'C', kind: 'array-literal', constName: 'BUILTIN_DOMAINS', note: '', text: 'const BUILTIN_DOMAINS=["a.test"]' }] }).provenance.some((p) => p.status === 'unavailable'),
  )

  // ── S6 退出码:两条"不得记绿"
  ok('S6a 有红 ⇒ 1', decide({ verdicts: [{ status: 'red', file: 'a', count: 2, allowed: 1, sites: '' }], undetermined: 0, provenance: [], enumerated: true, domainCount: 3 }).exit === 1)
  ok('S6b 无红 ⇒ 0', decide({ verdicts: [], undetermined: 0, provenance: [], enumerated: true, domainCount: 3 }).exit === 0)
  ok('S6c 空枚举 ⇒ 2(反向对照,绝不记绿)', decide({ verdicts: [], undetermined: 0, provenance: [], enumerated: false, domainCount: 3 }).exit === 2)
  ok('S6d 域名表全空 ⇒ 2(判据没有依据)', decide({ verdicts: [{ status: 'red', file: 'a', count: 9, allowed: 0, sites: '' }], undetermined: 0, provenance: [], enumerated: true, domainCount: 0 }).exit === 2)
  ok('S6e 无法判定优先于判红', decide({ verdicts: [{ status: 'red', file: 'a', count: 9, allowed: 0, sites: '' }], undetermined: 0, provenance: [], enumerated: false, domainCount: 0 }).fatal === true)

  // ── S7 预筛参数序(判据的超集性 + 首跑真实踩过的 `unable to resolve revision: -e`)
  const headArgs = prefilterArgs({ domains: ['api.openai.com'], staged: false })
  const idxArgs = prefilterArgs({ domains: ['api.openai.com'], staged: true })
  ok('S7a HEAD 档:修订在 -e 模式之后、`--` 之前', headArgs.indexOf('HEAD') > headArgs.indexOf('-e') && headArgs.indexOf('HEAD') < headArgs.indexOf('--'))
  ok('S7b 索引档:--cached 且不带修订(git 会把它当路径)', !idxArgs.includes('HEAD') && idxArgs.includes('--cached'))
  ok(
    'S7c 预筛串是判据字面量的超集:每个域名都作为 -e 原样出现',
    ['api.x.ai', 'api.mistral.ai'].every((d) => prefilterArgs({ domains: [d], staged: true }).includes(d)),
  )
  ok('S7d 扫描面不为空(空面 = 门对整仓盲视)', __selfScanPrefixes().length > 0)

  console.log(`\n自检结束:通过 ${pass} 条,失败 ${fail} 条`)
  return fail === 0 ? 0 : 1
}

/** S7d 用:把 SCAN_PREFIXES 的"非空"变成可判定的断言面(而不是让门悄悄退化成零文件)。*/
function __selfScanPrefixes() {
  return SCAN_PREFIXES.filter((p) => typeof p === 'string' && p.trim() !== '')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
