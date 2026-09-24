#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-gate-wiring.mjs — 守门脚本「造好没装车」对账门
 *
 * 病理(本仓已三次实证):守门脚本写好了、文档也写了「已接入 pre-commit 第 NN 项 blocking」,
 * 但**实际没有任何调用点**,门禁形同虚设。已知实例:
 *   - 守门 64 族 check-adapter-style-parity / check-adapter-wiring
 *   - 守门 70 scan-hardcoded-zh(2026-07-20 即存在,从未接入守门链)
 *   - 守门 69 同批 check-declared-shortcuts
 * 本门把「声称已接线」与「实际被接线」做机械对账,让这类撒谎在机制层面不可能存活。
 *
 * 权威接线点五处(缺一即漏判 —— 这是结构事实,不是设计偏好):
 *   1. scripts/guardian-runner.mjs 的所有 `script: '<name>.mjs'` 值
 *   2. scripts/lib/pre-commit-hook.js   ← 2026-09-22 起 pre-commit 的真实逻辑在这里
 *   3. .husky/ 下其余钩子(pre-push / commit-msg / post-commit / …)
 *   4. 根 package.json 的 scripts 字段
 *   5. .github/workflows/*.yml 与 scripts/run-8end-consistency-cert.mjs(弱一档:CI 接线)
 *
 * ⚠ 本门必须知道的坑:`.husky/pre-commit` 自 2026-09-22 起已退化成薄壳(只有一行
 *   `wscript //nologo scripts/hook-run-hidden.vbs pre-commit scripts/lib/pre-commit-hook.js`)。
 *   **任何以 .husky/pre-commit 为判据的核查都会得出相反结论**(把有效接线的门判成红,
 *   典型反例 check-pwsh-version.mjs 实际在 scripts/lib/pre-commit-hook.js:560)。
 *   本门把点 2 独立列出,并把薄壳一并纳入点 3 的采集范围(只多不少,不会造成假绿)。
 *
 * 判据(宁漏不误报 —— 本仓教训原话:「刻意只认肯定形态,避免阻塞他人提交」):
 *   R1 blocking:脚本自身**头部注释**用**肯定式**声称已接线(集成位置 / 接入 pre-commit /
 *              pre-push / guardian-runner 第 N 项 / CI 必跑 / CI / pre-commit),但五处全部零命中。
 *              2026-09-24 收紧:声称窗口含「可选/手动/后续项/待接/已废弃…」等**未来时或
 *              如实否定**措辞时不判红(那是「还没接线」的诚实说明,不是撒谎);逐出现点各判,
 *              任一处为肯定式即成立。
 *   R2 blocking:AGENTS.md 点名 scripts/<name>.mjs 且**同一句**(句界 。；;\n)出现
 *              「接入/blocking/BLOCKING/守门/pre-commit/必跑」,但五处全部零命中。
 *              2026-09-24 收紧:原「同一条款」过粗(条款按空行切,bullet 列表整块算一条,
 *              于是块内他句的「守门」会把顺带提到的脚本一并判成撒谎),现要求同句。
 *   R3 只报数 :脚本存在、五处零命中、且没有任何**肯定式**「已接线」声称 → 仅计数(本仓大量
 *              脚本是 CLI 工具或被分发器派生,判红会满天假红)
 *   弱接线    :仅点 5 命中 → 不算红,单独计数如实报出
 *   R4 blocking:**反向**差集 —— 已在五处权威点登记的门,AGENTS.md/README.md 通篇没点名
 *              (文档看不见的门会被重复造或被绕过)。2026-09-24 由"仅报数"升档,前置 =
 *              真仓缺口 48→0 已清零;比对宽松到"出现去后缀同名即算点名",只会漏报不会误拦。
 *   R5 blocking:同一 id 在 guardian-runner 里登记多道门 ⇒ 串 skipEnv 与失败归属(同日实测撞号)。
 *   R6 只报数 :同一 skipEnv 挂两个以上条目(本仓 id 2/2n-web 是刻意共用,故不判红)。
 *   R7 blocking:台账 type=dispatcher 的"依据"文件不存在、或文件里没提被豁免脚本 =
 *              假依据(实测抓到 check-lock.mjs 一条编造的 dispatcher 说明)。
 *   ⚠ 收紧判据只能**更准**,不得为消红整体关掉 R1/R2;每一次收紧必须配「这种提法不得判红」
 *     的负向用例**与**「那种提法必须判红」的阳性用例(双向),见 --self-test P15-P20 与 M7、M8。
 *
 * 取材铁律:一律按 **HEAD 提交内容**判,不读工作区(本机是多会话共享工作区,工作区文件
 *   可能滞后/脏,读它会产出相反结论)。子进程一律 execFileSync(<git 绝对路径>,
 *   ['-c','safe.directory=*','-C',root,…],{ windowsHide:true, timeout, maxBuffer })。
 *   取文件内容**不 .trim()**(尾行曾被吃掉,使一道自愈闸静默失效一整天);只有取 sha 才 trim。
 *
 * 用法:
 *   node scripts/check-gate-wiring.mjs                 全量对账(人类可读)
 *   node scripts/check-gate-wiring.mjs --json          全量对账(JSON,供其它工具消费)
 *   node scripts/check-gate-wiring.mjs --staged        同全量(见下方 --staged 语义说明)
 *   node scripts/check-gate-wiring.mjs --self-test     独立临时假仓库端到端正反对照
 *   node scripts/check-gate-wiring.mjs --root=<dir>    指定仓库根(自测夹具必须显式注入)
 *
 * --staged 语义(明确定义,二选一里选「仍做全量对账」):
 *   本门是**全量对账型**,与守门 78 check-workspace-dep-links 同族同治。理由:破损与
 *   「本次改了什么」无关 —— 接线点固定在那五处文件里,任何一处被并行会话改回旧基线、
 *   或新脚本被提交而无人登记,都不会体现在暂存集里;按暂存收窄恰好放过整类。
 *   暂存集取不到/为空同样按全量判(防「空暂存恒绿」,守门 70 教训)。
 *
 * 反假绿护栏:被测全集为空 → exit 1(绝不报绿)。
 * 自检:--self-test(独立临时仓库,不依赖真仓内容)+ node --test scripts/tests/check-gate-wiring.test.mjs
 * 紧急跳过:HUSKY_SKIP_GATE_WIRING=1
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DEFAULT_ROOT = resolve(__dirname, '..')

/** 本门自身豁免:创建当期 HEAD 里还没有它(鸡生蛋),接线由登记方补齐 */
const SELF_EXEMPT_SCRIPT = 'check-gate-wiring.mjs'

// ─── git 二进制解析(§5b:不得依赖环境) ───────────────────────────────────
let GIT_BIN = 'git'
async function ensureGitBin() {
  try {
    const mod = await import('./lib/gitdir.mjs')
    const p = typeof mod.resolveGitBin === 'function' ? mod.resolveGitBin() : null
    if (p && existsSync(p)) {
      GIT_BIN = p
      return
    }
  } catch {
    /* 落到显式候选 */
  }
  const candidates = [
    'C:/Program Files/Git/bin/git.exe',
    'C:/Program Files/Git/cmd/git.exe',
    'C:/Program Files/Git/mingw64/bin/git.exe',
  ]
  for (const c of candidates) if (existsSync(c)) GIT_BIN = c
}

/** 统一的 git 调用:绝对路径 git + safe.directory + windowsHide + timeout + maxBuffer */
function git(args, root, opts = {}) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, // ja 语言包 1.08MB 曾打爆默认 1MB → 被误判「仓库坏了」
    timeout: 120000,
    stdio: opts.quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    env: opts.env || process.env,
  })
}

/** git grep 在无匹配时 exit 1:区分「无匹配」与「git 自身异常」,绝不静默放行 */
function gitGrep(patterns, rev, paths, root) {
  const args = ['grep', '-o', '-I', '-F']
  for (const p of patterns) args.push('-e', p)
  args.push(rev, '--', ...paths)
  try {
    return { ok: true, out: git(args, root, { quiet: true }) }
  } catch (err) {
    const code = err && typeof err.status === 'number' ? err.status : -1
    if (code === 1) return { ok: true, out: '' } // 1 = 无匹配(git grep 语义)
    return { ok: false, out: '', err: String((err && err.stderr) || (err && err.message) || err) }
  }
}

// ─── 接线点清单(纯数据,供 self-test 复用) ─────────────────────────────
export const WIRING_POINTS = {
  strong: [
    { id: 'runner', label: 'scripts/guardian-runner.mjs', paths: ['scripts/guardian-runner.mjs'] },
    {
      id: 'pre-commit-hook',
      label: 'scripts/lib/pre-commit-hook.js(pre-commit 真实逻辑)',
      paths: ['scripts/lib/pre-commit-hook.js'],
    },
    { id: 'husky', label: '.husky/ 其余钩子(含退化薄壳 pre-commit)', paths: ['.husky'] },
    { id: 'package-json', label: '根 package.json scripts', paths: ['package.json'] },
  ],
  weak: [
    { id: 'ci-workflows', label: '.github/workflows/*.yml(CI:弱一档)', paths: ['.github/workflows'] },
    {
      id: 'cert-runner',
      label: 'scripts/run-8end-consistency-cert.mjs(CI 编排:弱一档)',
      paths: ['scripts/run-8end-consistency-cert.mjs'],
    },
  ],
}

// ─── 判据常量 ──────────────────────────────────────────────────────────
/** 被测全集:scripts/ 下的守门脚本名(实测真仓 154 枚) */
export const GATE_FILE_RE = /^(check|scan|guard)[a-z0-9-]*\.mjs$/

/** R1:脚本头部注释里的「已接线」表述 */
export const HEADER_CLAIM_PATTERNS = [
  { re: /集成位置/, tag: '集成位置' },
  { re: /接入\s*pre-commit/, tag: '接入 pre-commit' },
  { re: /pre-push/, tag: 'pre-push' },
  { re: /guardian-runner[^\n]{0,40}?第\s*\*{0,2}\s*\d+[a-z]?\s*\*{0,2}\s*项/, tag: 'guardian-runner 第 N 项' },
  { re: /CI\s*必跑/, tag: 'CI 必跑' },
  { re: /CI\s*\/\s*pre-commit/, tag: 'CI / pre-commit' },
]

/** R2:AGENTS.md 条款内的「已接线」表述 */
export const AGENTS_CLAIM_RE = /接入|blocking|BLOCKING|守门|pre-commit|必跑/

/** R2 句界(2026-09-24 收紧):要求接线表述与被点名脚本**同句**,不再是同一条款 */
export const AGENTS_SENTENCE_SPLIT_RE = /[。；;]|\r?\n/

const ZERO_WIDTH_RE = /[​‌‍⁠]/g

/**
 * R1 反向标记(2026-09-24 加严判据时补,修真假红):
 * 声称窗口里出现这些词,说明这句是**如实**陈述「还没接线 / 按需手动跑」,
 * 而不是「已接入」的谎言 —— R1 只拦**肯定式**声称。
 * 真仓实证的两处假红:
 *   - check-ignore-todos.mjs   「集成位置: 可选挂到 pre-commit(不阻塞)或手动 `pnpm …`」
 *   - check-ui-react-usage.mjs 「集成位置: CI / guardian-runner 后续项(暂 FAIL-blocking + WARN-only)」
 * 同形态的阳性对照(必须仍红)见 --self-test P17 与真仓 guard-push-other-agent-changes.mjs 原文。
 */
export const CLAIM_NEGATION_RE =
  /可选|手动|后续项|待接|未接线|尚未|暂未|暂不|计划中|已废弃|已移除|不再|按需|人工触发/

/** 从 git ls-tree 输出里挑出被测守门脚本(纯函数,全集口径) */
export function filterGatePaths(lsTreeOut) {
  return String(lsTreeOut)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((p) => p.startsWith('scripts/'))
    // 只认顶层 scripts/ 直属文件:scripts/lib/check-*.mjs 是库不是门
    .filter((p) => p.slice('scripts/'.length).indexOf('/') === -1)
    .filter((p) => GATE_FILE_RE.test(basename(p)))
    .map((p) => p.replace(/^scripts\//, ''))
    .sort()
}

/**
 * 抽取脚本头部注释区(纯函数)。
 * 结构事实:真仓守门脚本 = shebang + 3 行水印横幅 + eslint-disable + /** ... *\/
 * 一直读到第一个「非注释、非空」行为止(上限 200 行),不去 trim 原文。
 */
export function extractHeaderRegion(text, maxLines = 200) {
  const lines = String(text).split('\n')
  const out = []
  let inBlock = false
  for (let i = 0; i < lines.length && i < maxLines; i += 1) {
    const raw = lines[i]
    const line = raw.replace(ZERO_WIDTH_RE, '')
    const trimmed = line.trim()
    if (inBlock) {
      out.push(line)
      if (trimmed.includes('*/')) inBlock = false
      continue
    }
    if (trimmed === '') {
      out.push(line)
      continue
    }
    if (trimmed.startsWith('#!') || trimmed.startsWith('//')) {
      out.push(line)
      continue
    }
    if (trimmed.startsWith('/*')) {
      out.push(line)
      if (!trimmed.includes('*/')) inBlock = true
      continue
    }
    break
  }
  return out.join('\n')
}

/** R1 判据(纯函数):头部注释里的**肯定式**「已接线」声称 */
export function extractHeaderClaims(headerText) {
  const t = String(headerText).replace(ZERO_WIDTH_RE, '')
  const lines = t.split('\n')
  const hits = []
  for (const { re, tag } of HEADER_CLAIM_PATTERNS) {
    // 逐个出现点各自判:任一处是肯定式声称即算声称
    // (只看第一处会被前文的「可选挂到」吃掉后文的真实谎言)
    const scanner = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    let m
    let affirmative = false
    for (;;) {
      m = scanner.exec(t)
      if (!m) break
      const lineNo = t.slice(0, m.index).split('\n').length - 1
      if (!CLAIM_NEGATION_RE.test(claimWindow(lines, lineNo))) affirmative = true
    }
    if (affirmative) hits.push(tag)
  }
  return hits
}

/**
 * 声称窗口(纯函数):匹配所在行;若该行只是标签行(冒号后无正文),
 * 再把随后连续非空行(至多 6 行)并入 —— 真仓的谎言常写成
 * 「集成位置:\n  - .husky/pre-commit: …\n  - .husky/pre-push: …」的两行形态。
 */
export function claimWindow(lines, lineNo) {
  const first = String(lines[lineNo] ?? '')
  let win = first
  const bodyAfterLabel = first.replace(/^\s*\*+\s*/, '').replace(/^[^:：]*[:：]/, '').trim()
  if (bodyAfterLabel === '') {
    for (let i = lineNo + 1; i < lines.length && i <= lineNo + 6; i += 1) {
      // 注释块里的「*」空行同样算段落结束,否则窗口会一路吞进下一小节
      if (lines[i].replace(/^\s*\*+\s*/, '').trim() === '') break
      win += `\n${lines[i]}`
    }
  }
  return win
}

/**
 * 从接线点原文里提取「模板形态」引用(纯函数)。
 * 真实形态:execSync(`node scripts/scan-${target}-dead-i18n-keys.mjs --exit 1`)
 * 字面文件名不存在,必须把 ${...} 归一成正则通配,否则分发出去的门会全判红。
 * 同时覆盖 join(__dirname,'scripts', …) / path.resolve(…) 拼接后仍带的字面 .mjs 尾巴。
 */
export function buildTemplateMatchers(corpusText) {
  const text = String(corpusText).replace(ZERO_WIDTH_RE, '')
  const tokens = new Set()
  const tokRe = /[A-Za-z0-9_$.\-{}+]*/g
  let idx = 0
  // 逐个 .mjs 出现点,向前吞可构成文件名的字符集(含 ${} 与字符串拼接的引号+空白除外)
  for (;;) {
    const at = text.indexOf('.mjs', idx)
    if (at === -1) break
    let start = at
    while (start > 0 && /[A-Za-z0-9_$.\-{}+]/.test(text[start - 1])) start -= 1
    const tok = text.slice(start, at + 4)
    if (tok.includes('${')) tokens.add(tok)
    idx = at + 4
  }
  const matchers = []
  for (const tok of tokens) {
    let re = ''
    let i = 0
    while (i < tok.length) {
      if (tok[i] === '$' && tok[i + 1] === '{') {
        const close = tok.indexOf('}', i)
        if (close === -1) break
        // 插值段:允许跨多个连字符段,如 scan-${target}-dead → [a-z0-9-]*
        re += '[a-z0-9-]*'
        i = close + 1
        continue
      }
      re += /\w/.test(tok[i]) ? tok[i] : `\\${tok[i]}`
      i += 1
    }
    if (re) matchers.push({ source: tok, re: new RegExp(`(?:^|[a-z0-9-])${re}(?:$|[^a-z0-9-])`) })
  }
  return matchers
}

/** 纯函数:gate 名是否被任一模板 matcher 命中 */
export function gateMatchesTemplates(gateName, matchers) {
  for (const m of matchers) if (m.re.test(gateName)) return m.source
  return null
}

/** 把 git grep -o 的 `HEAD:<path>:<match>` 输出解析成 path→Set(name) */
export function parseGrepHits(grepOut, knownNames) {
  const set = new Set(knownNames)
  const byPath = new Map()
  for (const line of String(grepOut).split('\n')) {
    const t = line.trim()
    if (!t) continue
    const i1 = t.indexOf(':')
    if (i1 === -1) continue
    const i2 = t.indexOf(':', i1 + 1)
    if (i2 === -1) continue
    const path = t.slice(i1 + 1, i2)
    const match = t.slice(i2 + 1).trim()
    const name = match.endsWith('.mjs') ? match : null
    if (!name || !set.has(name)) continue
    if (!byPath.has(path)) byPath.set(path, new Set())
    byPath.get(path).add(name)
  }
  return byPath
}

/**
 * R2 判据(纯函数):AGENTS.md 里点名该脚本、且**同一句**(而非同一条款)含「已接线」表述。
 * 返回命中的句子摘要(最多 3 条)。
 *
 * 2026-09-24 粒度收紧(修真假红):原口径「同一条款」过粗 —— 条款是按**空行**切的,
 * 一个 bullet 列表整块算一条,于是列表里任意一句出现「守门」二字,该块内被**顺带提到**
 * 的每个脚本都被判成「AGENTS 声称它已接线」。真仓两处即此:
 *   - check-task-claims.mjs   §1 只在末句写「扫描工具:`node scripts/check-task-claims.mjs`」,
 *                             「守门」来自同一 bullet 里 `- [ ]（进行中）O20d 守门...` 的**示例代码**。
 *   - check-miniapp-taro-design-tokens.mjs  该句原文是「另有 A 与 B(**后者**为 guardian-runner
 *                             第 36 项实际调用项)」—— 明确说接了的是 B 不是 A。
 * 现要求「接线表述与被点名脚本**同句**」(句界 = 。；;\n)。有效面不削:
 *   「守门:`scripts/x.mjs`(blocking,2026-09-24 立并接入)」这类同句声称照旧判红(P19/M7 阳性对照)。
 */
export function findAgentsClaims(clauses, gateName) {
  const hits = []
  for (const clause of clauses) {
    if (!clause.includes(gateName)) continue
    let claimed = null
    for (const sent of String(clause).split(AGENTS_SENTENCE_SPLIT_RE)) {
      if (!sent.includes(gateName)) continue
      if (!AGENTS_CLAIM_RE.test(sent)) continue
      claimed = sent.trim().slice(0, 160)
      break
    }
    if (claimed !== null) hits.push(claimed)
    if (hits.length >= 3) break
  }
  return hits
}

/** 纯函数:AGENTS.md 切条款(以空行为界;HTML 注释块并入所在条款) */
export function splitAgentClauses(agentsText) {
  return String(agentsText).split(/\r?\n[ \t]*\r?\n/).filter((c) => c.trim().length > 0)
}

/**
 * 纯函数:单个 gate 的最终归类。
 * status: wired | wired-weak | exempt | red-r1 | red-r2 | unwired-unclaimed | self-exempt
 *
 * 顺序即防作弊设计:**台账不得为 R1/R2 开脱**(否则「为消红把撒谎门塞台账」这条
 * 通道一开,本门当场作废)。台账只救 R3 —— 五处零命中且无任何已接线声称时,
 * 用它登记「由 X 分发 / 纯 CLI 工具 / 仅文档」的结构事实。
 */
export function classifyGate({ name, strongPoints, weakPoints, headerClaims, agentsClaims, allowEntry }) {
  if (name === SELF_EXEMPT_SCRIPT) {
    return { status: 'self-exempt', reason: '本门自身:创建当期 HEAD 内无它,接线由登记方补' }
  }
  if (strongPoints && strongPoints.length > 0) return { status: 'wired', reason: strongPoints.join(' + ') }
  if (weakPoints && weakPoints.length > 0) return { status: 'wired-weak', reason: weakPoints.join(' + ') }
  if (headerClaims && headerClaims.length > 0) {
    return { status: 'red-r1', reason: `头部声称[${headerClaims.join(', ')}]但五处权威点全部零命中` }
  }
  if (agentsClaims && agentsClaims.length > 0) {
    return { status: 'red-r2', reason: 'AGENTS.md 点名并声称已接线,但五处权威点全部零命中' }
  }
  if (allowEntry) {
    return { status: 'exempt', reason: `${allowEntry.type}: ${allowEntry.reason || ''}${allowEntry.dispatcher ? `(由 ${allowEntry.dispatcher} 分发)` : ''}` }
  }
  return { status: 'unwired-unclaimed', reason: '五处零命中且无任何已接线声称' }
}

/**
 * 纯函数:台账巡检 —— 登记了但实际已被强接线的条目 = 可撤销豁免。
 * 本仓教训:「幂等守卫只判存在会冻结冗余」。
 */
export function findRevocableExemptions(entries, strongWiredSet) {
  const out = []
  for (const e of entries || []) {
    if (!e || typeof e.script !== 'string') continue
    if (strongWiredSet.has(e.script)) {
      out.push({ script: e.script, type: e.type || '?', reason: e.reason || '' })
    }
  }
  return out
}

/** 纯函数:台账里指向已不存在脚本的僵尸条目 */
export function findStaleExemptions(entries, gateSet) {
  const out = []
  for (const e of entries || []) {
    if (!e || typeof e.script !== 'string') continue
    if (!gateSet.has(e.script)) out.push({ script: e.script, type: e.type || '?' })
  }
  return out
}

/**
 * 纯函数(R5,判红):runner 里出现**两次以上的同一 id**。
 * 成因是结构性的:并发会话都在数组同一位置各加一道门,不查占用必撞号(本仓先例 75/76、79→80,
 * 2026-09-24 实测又撞一次 91 —— 由本维度在撞号当天拦下并改号为 92)。同 id 的两道 blocking 门
 * 会串 skipEnv 与失败归属:跳一次关两道,汇总里也只认第一个匹配项。
 */
export function findDuplicateIds(runnerText) {
  const ids = [...String(runnerText || '').matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])
  const seen = new Set()
  const dup = new Set()
  for (const id of ids) {
    if (seen.has(id)) dup.add(id)
    else seen.add(id)
  }
  return [...dup].sort()
}

/**
 * 纯函数(R6,只报数):同一 skipEnv 挂在两个以上条目上。
 * **不判红**:本仓有一处是**刻意**共用(id 2 与 2n-web 同用 HUSKY_SKIP_I18N_PARITY,runner 里
 * 67-70 行写明理由 —— 两者跑的是同一份 parity 判据)。粒度问题该由门的持有人裁,不是"撒谎"。
 */
export function findSharedSkipEnvs(runnerText) {
  const src = String(runnerText || '')
  const starts = [...src.matchAll(/\n\s*id:\s*'([^']+)'/g)]
  const map = new Map()
  starts.forEach((m, i) => {
    // 条目边界 = 到下一个 id: 之前。不这样切会把"无 skipEnv 的条目"与后一条的 skipEnv 错配。
    const body = src.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : src.length)
    const env = (body.match(/\bskipEnv:\s*'([^']+)'/) || [])[1]
    if (!env) return
    const list = map.get(env) || []
    list.push(m[1])
    map.set(env, list)
  })
  return [...map.entries()]
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([env, ids]) => ({ env, ids: [...new Set(ids)] }))
}

/**
 * 纯函数(R7,判红):台账里 `dispatcher` 类型条目的**依据必须可核验**。
 *
 * 为什么要判红:台账是本门唯一的豁免出口,而"豁免依据"是一句人写的自然语言。依据一旦可以是编的,
 * 整套"台账不得为撒谎门开脱"(M0/M2)的设计就塌了 —— 实测抓到一条:
 * `check-lock.mjs` 写"调用点在 apps/web/package.json prebuild/predev",而该处实际调的是
 * `deploy-lock.mjs` 与 `check-stale-stashes.mjs`,全仓除台账自身外**零引用**该脚本。
 *
 * 核验口径(宁漏不误报,只做结构事实):从 dispatcher 字符串里取**第一个像路径的 token**
 * (含 `/` 或带扩展名),① 该路径必须在 HEAD 里存在;② 该文件内容必须真的提到被豁免脚本的名字
 * (去 `.mjs` 后缀,容忍 `check-lock.js` 这类同 stem 引用)。任一条不满足 ⇒ 判红并说明差在哪。
 *
 * @param entries 台账条目
 * @param readAtHead (relPath) => string | null  (null = HEAD 里没有该路径)
 */
export function validateDispatcherClaims(entries, readAtHead) {
  const problems = []
  for (const e of entries || []) {
    if (!e || typeof e.script !== 'string') continue
    if (e.type !== 'dispatcher' && !e.dispatcher) continue
    const d = String(e.dispatcher || '')
    const token = d.split(/[\s,;]+/).find((t) => t.includes('/') || /\.[a-z]{1,6}$/i.test(t))
    if (!token) {
      problems.push({ script: e.script, dispatcher: d, why: 'dispatcher 字段里没有一个像路径的 token,无法核验' })
      continue
    }
    const content = readAtHead(token)
    if (content === null) {
      problems.push({ script: e.script, dispatcher: d, why: `所指文件不在 HEAD 里:${token}` })
      continue
    }
    const stem = e.script.replace(/\.mjs$/, '')
    if (!content.includes(stem)) {
      problems.push({ script: e.script, dispatcher: d, why: `${token} 里根本没提到 "${stem}" —— 依据与事实不符` })
    }
  }
  return problems
}

/**
 * 纯函数:反向差集(R4)—— 已在权威点登记的门,但 AGENTS.md / README.md 通篇**没点过它的名**。
 *
 * 为什么需要:文档看不到的门,下一个人只会重复造或干脆绕过(实测三例在 hook.js 生效却零见于速查:
 * `check-staged-files-count` / `check-portal-fixed` / `check-agent-engine-parity`;本仓又新增 85–89 五档)。
 * 这与 R1/R2 是同一枚硬币的两面:R1/R2 拦"声称了却没接线",R4 拦"接线了却没声称"。
 *
 * ⚠️ **2026-09-24 起参与退出码**(升档前置 = 缺口清零,实测真仓 48→0 后才动)。失误方向刻意
 * **宽松**:文档任一处出现去后缀的脚本名即算点名,所以只会漏报、不会误拦 —— 不会因为一次
 * 命名漂移就把整条守门链变成"上线即恒红=各会话 --no-verify"(本仓优先级最高的反面教训)。
 * 比对用**去后缀的脚本名**(文档里 `scripts/foo.mjs` 与裸 `foo` 两种写法都出现过)。
 */
export function findUndocumentedGates(wiredScripts, docText) {
  const doc = String(docText || '')
  const out = []
  for (const s of wiredScripts || []) {
    if (typeof s !== 'string' || !s) continue
    const stem = s.replace(/\.mjs$/, '')
    if (!doc.includes(stem)) out.push(s)
  }
  return out
}

/** 纯函数:台账格式校验(缺 reason 视为不合规,须报出而非静默放过) */
export function validateAllowlist(raw) {
  const problems = []
  const ALLOWED_TYPES = new Set(['dispatcher', 'standalone-tool', 'doc-only'])
  const entries = Array.isArray(raw && raw.entries) ? raw.entries : null
  if (!entries) return { entries: [], problems: ['台账缺 entries 数组(按空台账继续)'] }
  entries.forEach((e, i) => {
    if (!e || typeof e.script !== 'string' || !/\.mjs$/.test(e.script)) {
      problems.push(`entries[${i}] 缺 script 字段`)
      return
    }
    if (!ALLOWED_TYPES.has(e.type)) problems.push(`entries[${i}](${e.script}) type 非法:${e.type}`)
    if (!e.reason || String(e.reason).trim().length < 8) {
      problems.push(`entries[${i}](${e.script}) 缺依据说明(reason < 8 字)`)
    }
    if (e.type === 'dispatcher' && !e.dispatcher) problems.push(`entries[${i}](${e.script}) dispatcher 类型缺 dispatcher 字段`)
  })
  return { entries, problems }
}

// ─── 主流程 ───────────────────────────────────────────────────────────
async function main(argv = process.argv.slice(2)) {
  const opts = {
    root: DEFAULT_ROOT,
    json: false,
    staged: false,
    selfTest: false,
    help: false,
  }
  for (const a of argv) {
    if (a === '--json') opts.json = true
    else if (a === '--staged') opts.staged = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--root=')) opts.root = resolve(a.slice('--root='.length))
    else if (!a.startsWith('--')) opts.root = resolve(a)
  }
  if (opts.help) {
    console.log(
      '用法: node scripts/check-gate-wiring.mjs [--json|--staged|--self-test|--root=<dir>]\n' +
        '  --staged 语义:仍做全量对账(全量对账型,同守门 78;按暂存收窄会放过整类破损)\n' +
        '  紧急跳过: HUSKY_SKIP_GATE_WIRING=1',
    )
    return 0
  }
  if (opts.selfTest) return runSelfTest()

  if (process.env.HUSKY_SKIP_GATE_WIRING === '1') {
    console.log('⚠️  HUSKY_SKIP_GATE_WIRING=1 —— 已跳过守门脚本接线对账门')
    return 0
  }

  await ensureGitBin()
  const root = opts.root
  if (!existsSync(join(root, '.git'))) {
    console.error(`❌ 非 git 仓库根: ${root}`)
    return 2
  }

  // 1) 被测全集(HEAD 提交内容,绝不读工作区)
  const lsTree = git(['ls-tree', '-r', '--name-only', 'HEAD', 'scripts/'], root)
  const gateNames = filterGatePaths(lsTree)
  if (gateNames.length === 0) {
    console.error('❌ 未取到任何守门脚本(判据失效或仓库异常),拒绝报绿')
    return 1
  }

  const tracked = new Set(git(['ls-tree', '-r', '--name-only', 'HEAD'], root).split('\n').map((l) => l.trim()))
  const pointPathsWithFiles = []
  for (const tier of ['strong', 'weak']) {
    for (const pt of WIRING_POINTS[tier]) {
      const files = [...tracked].filter(
        (p) => pt.paths.some((spec) => p === spec || p.startsWith(`${spec}/`)),
      )
      pointPathsWithFiles.push({ tier, id: pt.id, label: pt.label, files })
    }
  }

  // 2) 点 1-4 与点 5 各跑一次 git grep(-F 全字面,一次覆盖全部 154 枚)
  const hitsByPoint = new Map()
  for (const pt of pointPathsWithFiles) {
    hitsByPoint.set(pt.id, new Set())
    if (pt.files.length === 0) continue
    const pathsForGrep = pt.id === 'husky' ? ['.husky'] : pt.files
    const r = gitGrep(gateNames, 'HEAD', pathsForGrep, root)
    if (!r.ok) {
      console.error(`❌ git grep 失败(${pt.id}): ${r.err}`)
      return 2
    }
    for (const [path, names] of parseGrepHits(r.out, gateNames)) {
      if (pt.id === 'husky' && !path.startsWith('.husky/')) continue
      for (const n of names) hitsByPoint.get(pt.id).add(n)
    }
  }

  // 3) 模板形态(${target} 拼接 / path.join 派生)补判 —— 只补强接线点里未命中的
  const strongCorpus = []
  for (const pt of pointPathsWithFiles) {
    if (pt.tier !== 'strong') continue
    for (const f of pt.files) {
      if (f.endsWith('.mjs') || f.endsWith('.js') || f === 'package.json' || f.startsWith('.husky/')) {
        try {
          strongCorpus.push(git(['show', `HEAD:${f}`], root))
        } catch {
          /* 取不到即如实不加入 */
        }
      }
    }
  }
  const templateMatchers = buildTemplateMatchers(strongCorpus.join('\n'))
  const templateHit = new Map()
  for (const n of gateNames) {
    if ([...hitsByPoint.values()].some((s) => s.has(n))) continue
    const src = gateMatchesTemplates(n, templateMatchers)
    if (src) templateHit.set(n, src)
  }

  // 4) 台账
  let allowEntries = []
  let allowProblems = []
  const allowPath = join(root, 'scripts', 'gate-wiring-allowlist.json')
  if (existsSync(allowPath)) {
    try {
      const v = validateAllowlist(JSON.parse(readFileSync(allowPath, 'utf8')))
      allowEntries = v.entries
      allowProblems = v.problems
    } catch (e) {
      allowProblems = [`台账 JSON 解析失败: ${e.message}`]
    }
  } else {
    allowProblems = ['缺 scripts/gate-wiring-allowlist.json(按空台账继续)']
  }
  const allowByName = new Map(allowEntries.map((e) => [e.script, e]))
  // R7:台账的 dispatcher 依据必须可核验(台账是唯一豁免出口,依据能编 = 反滥用设计塌了)
  const dispatcherProblems = validateDispatcherClaims(allowEntries, (rel) => {
    try {
      return git(['show', `HEAD:${rel}`], root)
    } catch {
      return null
    }
  })

  // 5) R1 头部声称:只对本轮「未接线」候选读 blob(省 spawn 次数)
  const agentsText = git(['show', 'HEAD:AGENTS.md'], root)
  const agentsClauses = splitAgentClauses(agentsText)
  const candidates = gateNames.filter(
    (n) => !templateHit.has(n) && ![...hitsByPoint.values()].some((s) => s.has(n)),
  )
  const headerClaimsByName = new Map()
  for (const n of candidates) {
    if (n === SELF_EXEMPT_SCRIPT) continue
    let blob = ''
    try {
      blob = git(['show', `HEAD:scripts/${n}`], root)
    } catch (e) {
      console.error(`❌ git show HEAD:scripts/${n} 失败: ${e.message}`)
      return 2
    }
    headerClaimsByName.set(n, extractHeaderClaims(extractHeaderRegion(blob)))
  }

  // 6) 归类
  const results = []
  for (const n of gateNames) {
    const strongPoints = []
    const weakPoints = []
    for (const pt of pointPathsWithFiles) {
      if (pt.tier === 'strong' && hitsByPoint.get(pt.id).has(n)) strongPoints.push(pt.id)
    }
    if (templateHit.has(n) && strongPoints.length === 0) strongPoints.push('template')
    for (const pt of pointPathsWithFiles) {
      if (pt.tier === 'weak' && hitsByPoint.get(pt.id).has(n)) weakPoints.push(pt.id)
    }
    const status = classifyGate({
      name: n,
      strongPoints,
      weakPoints,
      headerClaims: headerClaimsByName.get(n) || [],
      agentsClaims: n.startsWith('check-') || n.startsWith('scan-') || n.startsWith('guard')
        ? findAgentsClaims(agentsClauses, n)
        : [],
      allowEntry: allowByName.get(n),
    })
    results.push({ script: n, ...status, strongPoints, weakPoints, headerClaims: headerClaimsByName.get(n) || [] })
  }

  const by = (s) => results.filter((r) => r.status === s)
  const reds = [...by('red-r1'), ...by('red-r2')]
  const revocable = findRevocableExemptions(allowEntries, new Set(by('wired').map((r) => r.script)))
  const staleExempt = findStaleExemptions(allowEntries, new Set(gateNames))
  // R5 重复 id(判红)/ R6 共用 skipEnv(只报数):都是"接线层的结构性自撞",不是内容判据。
  let runnerText = ''
  try {
    runnerText = git(['show', 'HEAD:scripts/guardian-runner.mjs'], root)
  } catch (e) {
    console.error(`❌ 读不到 HEAD:scripts/guardian-runner.mjs ⇒ R5/R6 无法判定(拒绝当作已通过):${e.message}`)
    return 2
  }
  const dupIds = findDuplicateIds(runnerText)
  const sharedEnvs = findSharedSkipEnvs(runnerText)
  if (dispatcherProblems.length) {
    reds.push(
      ...dispatcherProblems.map((p) => ({
        script: p.script,
        status: 'red-r7',
        reason: `台账依据不可核验:${p.why}(dispatcher="${p.dispatcher}")`,
      })),
    )
  }
  if (dupIds.length) {
    reds.push(
      ...dupIds.map((id) => ({
        script: `(runner id '${id}')`,
        status: 'red-r5',
        reason: '同一 id 在 guardian-runner 里登记了多道门 ⇒ 串 skipEnv 与失败归属;后来者必须改号',
      })),
    )
  }
  // R4 反向差集:已接线但文档通篇没点名 ⇒ 文档看不见的门会被重复造或被绕过。
  const readDoc = (p) => {
    try {
      return git(['show', `HEAD:${p}`], root)
    } catch {
      return ''
    }
  }
  const docText = readDoc('AGENTS.md') + '\n' + readDoc('README.md')
  const undocumented = findUndocumentedGates(
    [...by('wired'), ...by('wired-weak')].map((r) => r.script),
    docText,
  )
  // R4 自 2026-09-24 起**参与退出码**(此前只报数)。升档的两个前置都已实证成立:
  // ① 真仓缺口已归零(48→0,AGENTS.md 速查同批补登 46 条);② 判据失误方向是**宽松**的 ——
  // 文档里出现去后缀同名即算点名,所以只会漏报、不会误拦,不会变成"上线即恒红=各会话 --no-verify"。
  // 双向证明钉在自检 M8a/M8b(唯一变量=文档点没点名)。
  // 放在 json 分支之前,保证两种口径下 reds 内容一致(否则 CI 用 --json 会看不见 R4)。
  for (const n of undocumented) {
    reds.push({
      script: n,
      status: 'red-r4',
      reason: '已接线但 AGENTS.md/README.md 通篇未点名(文档看不见的门会被重复造或绕过)',
    })
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          root,
          totalGates: gateNames.length,
          counts: {
            wired: by('wired').length,
            wiredWeak: by('wired-weak').length,
            exempt: by('exempt').length,
            redR1: by('red-r1').length,
            redR2: by('red-r2').length,
            unwiredUnclaimed: by('unwired-unclaimed').length,
            selfExempt: by('self-exempt').length,
            undocumentedR4: undocumented.length,
            duplicateIds: dupIds.length,
            sharedSkipEnvs: sharedEnvs.length,
            dispatcherProblems: dispatcherProblems.length,
          },
          dispatcherProblems,
          duplicateIds: dupIds,
          sharedSkipEnvs: sharedEnvs,
          reds,
          undocumented: undocumented,
          unwiredUnclaimed: by('unwired-unclaimed').map((r) => r.script),
          wired: by('wired').map((r) => ({ script: r.script, where: r.strongPoints })),
          wiredWeak: by('wired-weak').map((r) => ({ script: r.script, where: r.weakPoints })),
          exempt: by('exempt').map((r) => ({ script: r.script, reason: r.reason })),
          revocableExemptions: revocable,
          staleExemptions: staleExempt,
          allowlistProblems: allowProblems,
        },
        null,
        2,
      ),
    )
  } else {
    console.log('🧷 守门脚本接线对账(权威接线点 5 处 · 一律按 HEAD 内容判)')
    console.log(
      `   被测 ${gateNames.length} 枚 | 已接线 ${by('wired').length} | 仅 CI 接线 ${by('wired-weak').length}` +
        ` | 台账豁免 ${by('exempt').length} | 本门自身豁免 ${by('self-exempt').length}`,
    )
    console.log(`   R3(五处零命中且无任何已接线声称,仅报数): ${by('unwired-unclaimed').length} 枚`)
    console.log(
      `   R4(已接线但 AGENTS.md/README.md 通篇未点名,判红): ${undocumented.length ? `${undocumented.length} 枚` : '0 枚'}`,
    )
    console.log(`   R5(重复 id,判红): ${dupIds.length ? dupIds.join(' / ') : '0 枚'}`)
    console.log(
      `   R7(台账 dispatcher 依据不可核验,判红): ${dispatcherProblems.length ? `${dispatcherProblems.length} 条` : '0 条'}`,
    )
    for (const p of dispatcherProblems) console.log(`     ✗ ${p.script} —— ${p.why}`)
    console.log(
      `   R6(同一 skipEnv 挂多个条目,只报数): ${sharedEnvs.length ? sharedEnvs.map((s) => `${s.env}[${s.ids.join(',')}]`).join(' ') : '0 组'}`,
    )
    if (undocumented.length) {
      console.log('     ' + undocumented.slice(0, 14).join(' ') + (undocumented.length > 14 ? ` …等 ${undocumented.length} 枚` : ''))
    }
    if (by('unwired-unclaimed').length) {
      console.log(
        '     ' +
          by('unwired-unclaimed')
            .map((r) => r.script)
            .join(' '),
      )
    }
    if (by('wired-weak').length) {
      console.log('   仅 CI 接线(弱一档,不判红):')
      for (const r of by('wired-weak')) console.log(`     - ${r.script}  ← ${r.weakPoints.join(', ')}`)
    }
    if (allowProblems.length) {
      console.log('   ⚠ 台账问题:')
      for (const p of allowProblems) console.log(`     - ${p}`)
    }
    if (revocable.length) {
      console.log('   ♻ 可撤销豁免(登记了但实际已接线 —— 幂等守卫不得只判存在):')
      for (const e of revocable) console.log(`     - ${e.script}(${e.type})`)
    }
    if (staleExempt.length) {
      console.log('   ✗ 僵尸台账条目(脚本已不在 HEAD):')
      for (const e of staleExempt) console.log(`     - ${e.script}(${e.type})`)
    }
  }

  if (reds.length > 0) {
    if (!opts.json) {
      console.error(`\n❌ 接线层结构性缺陷共 ${reds.length} 枚(R1/R2 撒谎 · R4 文档隐形 · R5 撞号 · R7 假依据)—— 禁止为消红塞台账:`)
      for (const r of reds) console.error(`   [${r.status.toUpperCase()}] ${r.script.startsWith('(') ? r.script : `scripts/${r.script}`} —— ${r.reason}`)
      for (const r of reds) {
        if (r.status === 'red-r2') {
          const clauses = findAgentsClaims(agentsClauses, r.script)
          for (const c of clauses) console.error(`        AGENTS.md: ${c}`)
        }
      }
      console.error('   修复:R1/R2 → 在 scripts/guardian-runner.mjs 注册(或 .husky/、package.json 接线),')
      console.error('         或改正脚本头部/AGENTS.md 里那句撒谎的表述;')
      console.error('         R4 → 在 AGENTS.md「守门脚本速查」或 README 补一行点名(写清判据/自检/跳过变量);')
      console.error('         R5 → 后来者改用空闲编号。紧急跳过 HUSKY_SKIP_GATE_WIRING=1')
    }
    return 1
  }
  if (!opts.json)
    console.log(
      `✅ R1/R2/R4 零红(已接线 ${by('wired').length} / 台账豁免 ${by('exempt').length} / 文档未点名 0)`,
    )
  return 0
}

// ─── self-test:独立临时假仓库端到端(绝不依赖真仓内容) ───────────────
function makeFixtureRepo(baseDir, extra = {}) {
  const dir = mkdtempSync(join(baseDir, 'gate-wiring-fixture-'))
  const files = {
    'scripts/guardian-runner.mjs':
      "#!/usr/bin/env node\nconst GATES = [\n  { id: 1, script: 'check-wired.mjs' },\n]\n",
    'scripts/lib/pre-commit-hook.js':
      '#!/usr/bin/env node\nexecSync(`node scripts/scan-${target}-dead-i18n-keys.mjs --exit 1`)\n' +
      "execFileSync(node, [join(__dirname, 'scripts', 'check-joined.mjs')])\n",
    '.husky/pre-push': '#!/bin/sh\nnode scripts/check-prepush.mjs\n',
    '.husky/pre-commit':
      '#!/bin/sh\nwscript //nologo scripts/hook-run-hidden.vbs pre-commit scripts/lib/pre-commit-hook.js\n',
    'package.json': '{ "name":"x", "scripts": { "check:pkg": "node scripts/check-pkg.mjs" } }\n',
    '.github/workflows/ci.yml': 'name: ci\njobs:\n  a:\n    steps:\n      - run: node scripts/check-ci-only.mjs\n',
    'scripts/run-8end-consistency-cert.mjs': "#!/usr/bin/env node\nconst L = ['check-cert.mjs']\n",
    'scripts/check-wired.mjs': '#!/usr/bin/env node\n/**\n * check-wired.mjs — 已接线\n */\n',
    'scripts/check-joined.mjs': '#!/usr/bin/env node\n/**\n * 由 path.join 派生\n */\n',
    'scripts/check-prepush.mjs': '#!/usr/bin/env node\n',
    'scripts/check-pkg.mjs': '#!/usr/bin/env node\n',
    'scripts/check-ci-only.mjs': '#!/usr/bin/env node\n/**\n * 只在 CI 跑\n */\n',
    'scripts/check-cert.mjs': '#!/usr/bin/env node\n',
    'scripts/scan-web-dead-i18n-keys.mjs': '#!/usr/bin/env node\n',
    'scripts/scan-desktop-dead-i18n-keys.mjs': '#!/usr/bin/env node\n',
    'scripts/check-lying-r1.mjs':
      '#!/usr/bin/env node\n/**\n * check-lying-r1.mjs — 撒谎门\n *\n * 集成位置: scripts/guardian-runner.mjs 第 999 项(blocking)\n */\n',
    'scripts/check-tool-only.mjs': '#!/usr/bin/env node\n/**\n * 纯 CLI 工具,手动跑\n */\n',
    'scripts/check-lying-r2.mjs': '#!/usr/bin/env node\n/**\n * 头部什么都没声称\n */\n',
    'AGENTS.md':
      '# 假 AGENTS\n\n## 某规则\n\n- 守门:`scripts/check-lying-r2.mjs`(blocking,2026-09-24 立并接入)\n\n' +
        '## 守门脚本速查(R4 要求"已接线的门必须在文档点名"，夹具因此要写全)\n\n' +
        '- 已接线:`scripts/check-wired.mjs`(blocking)\n' +
        '- 已接线:`scripts/check-joined.mjs`(blocking)\n' +
        '- 已接线:`scripts/check-prepush.mjs`(blocking)\n' +
        '- 已接线:`scripts/check-pkg.mjs`(blocking)\n' +
        '- 已接线:`scripts/check-ci-only.mjs`(仅 CI)\n' +
        '- 已接线:`scripts/check-cert.mjs`(仅 CI)\n' +
        '- 已接线:`scripts/scan-web-dead-i18n-keys.mjs`(仅 CI)\n' +
        '- 已接线:`scripts/scan-desktop-dead-i18n-keys.mjs`(仅 CI)\n' +
        // 变异夹具(repo2/repo4/repo7)会把下面两枚转为"已接线",R4 判红后它们必须在基线里点名,
        // 否则 M1/M3/M6 会把 R4 红误读成"接线仍未被识别"。
        '- 已接线:`scripts/check-lying-r1.mjs`(blocking)\n' +
        '- 已接线:`scripts/check-pwsh-form.mjs`(blocking)\n\n' +
        '## 无关条款\n\n- 这里只讲别的,scripts/some-doc.mjs 不参与对账。\n',
    ...(extra.files || {}),
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf8')
  }
  const env = { ...process.env, GIT_CONFIG_COUNT: '0' }
  git(['init', '-q'], dir, { env, quiet: true })
  git(['add', '-A'], dir, { env, quiet: true })
  git(
    ['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '-m', 'fixture'],
    dir,
    { env, quiet: true },
  )
  return dir
}

function runGateCli(args) {
  try {
    const out = execFileSync(process.execPath, [join(__dirname, 'check-gate-wiring.mjs'), ...args], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      timeout: 180000,
    })
    return { code: 0, out }
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 2, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

function runSelfTest() {
  const cases = []
  const assert = (name, cond, detail = '') => cases.push({ name, ok: !!cond, detail })

  // 纯函数层
  assert(
    'P1 filterGatePaths 只认 basename 锚定 + 顶层 scripts/ 直属',
    JSON.stringify(filterGatePaths('scripts/check-a.mjs\nscripts/_i18n-scan-helpers.mjs\nscripts/lib/check-b.mjs\nscripts/check-c.test.mjs\nscripts/check-d.ts')) ===
      '["check-a.mjs"]',
  )
  assert(
    'P2 模板 ${target} → 通配命中分发出去的子门',
    !!gateMatchesTemplates('scan-miniapp-taro-dead-i18n-keys.mjs', buildTemplateMatchers('scripts/scan-${target}-dead-i18n-keys.mjs')),
  )
  assert(
    'P3 模板不误伤无关名',
    !gateMatchesTemplates('check-other.mjs', buildTemplateMatchers('scripts/scan-${target}-dead-i18n-keys.mjs')),
  )
  assert(
    'P4 头部区在第一个非注释行前截断',
    (() => {
      const h = extractHeaderRegion('/**\n * 头\n */\nconst claimsWiring = "集成位置: pre-commit 第 3 项"\n')
      return !h.includes('claimsWiring')
    })(),
  )
  assert(
    'P5 代码里的字符串常量不得被当作 R1 声称',
    extractHeaderClaims(extractHeaderRegion('/**\n * 正常头\n */\nconst x = "guardian-runner 第 5 项"')).length === 0,
  )
  assert(
    'P6 R1 声称识别(guardian-runner 第 N 项 + 集成位置)',
    extractHeaderClaims('集成位置: scripts/guardian-runner.mjs 第 **77** 项,blocking').length >= 2,
  )
  assert(
    'P7 classifyGate:仅弱接线不判红',
    classifyGate({ name: 'check-x.mjs', strongPoints: [], weakPoints: ['ci-workflows'], headerClaims: ['集成位置'], agentsClaims: [], allowEntry: null }).status === 'wired-weak',
  )
  assert(
    'P8 classifyGate:零接线 + 头部声称 = R1',
    classifyGate({ name: 'check-x.mjs', strongPoints: [], weakPoints: [], headerClaims: ['pre-push'], agentsClaims: [], allowEntry: null }).status === 'red-r1',
  )
  assert(
    'P9 classifyGate:零接线 + 无声称 = R3 只报数',
    classifyGate({ name: 'check-x.mjs', strongPoints: [], weakPoints: [], headerClaims: [], agentsClaims: [], allowEntry: null }).status === 'unwired-unclaimed',
  )
  assert(
    'P10 classifyGate:本门自身豁免',
    classifyGate({ name: SELF_EXEMPT_SCRIPT, strongPoints: [], weakPoints: [], headerClaims: ['集成位置'], agentsClaims: ['x'], allowEntry: null }).status === 'self-exempt',
  )
  assert(
    'P11 台账可撤销豁免识别(幂等守卫只判存在会冻结冗余)',
    findRevocableExemptions([{ script: 'check-wired.mjs', type: 'standalone-tool', reason: 'x x x x x x x x' }], new Set(['check-wired.mjs'])).length === 1,
  )
  assert(
    'P12 台账缺依据说明被报出',
    validateAllowlist({ entries: [{ script: 'check-a.mjs', type: 'dispatcher' }] }).problems.length === 2,
  )
  assert(
    'P13 parseGrepHits 解析 HEAD:<path>:<match>',
    parseGrepHits('HEAD:scripts/guardian-runner.mjs:check-a.mjs\nHEAD:package.json:check-b.mjs', ['check-a.mjs', 'check-b.mjs', 'check-z.mjs']).get('package.json').has('check-b.mjs'),
  )
  assert(
    'P14 AGENTS 条款含 blocking+点名才构成 R2 声称',
    findAgentsClaims(['守门:`scripts/check-q.mjs`(blocking)'], 'check-q.mjs').length === 1 &&
      findAgentsClaims(['只是提到 scripts/check-q.mjs 的历史'], 'check-q.mjs').length === 0,
  )

  // ── 2026-09-24 判据收紧的**双向**用例(负向:这种提法不得判红 / 正向:那种提法必须判红) ──
  // R1 负向 1:真仓 check-ignore-todos.mjs 原文形态 —— 「可选挂到 / 手动」是如实陈述
  assert(
    'P15 R1 负向:「集成位置: 可选挂到 pre-commit…或手动 pnpm …」不得判红',
    extractHeaderClaims('集成位置: 可选挂到 pre-commit(不阻塞)或手动 `pnpm check:routes:ignore`').length === 0,
  )
  // R1 负向 2:真仓 check-ui-react-usage.mjs 原文形态 —— 「后续项」= 还没接
  assert(
    'P16 R1 负向:「集成位置: CI / guardian-runner 后续项」不得判红',
    extractHeaderClaims('集成位置: CI / guardian-runner 后续项(暂 FAIL-blocking + WARN-only)').length === 0,
  )
  // R1 正向:标签行换行后的**肯定式**两行子弹必须判红(真仓 guard-push 原文形态)
  assert(
    'P17 R1 正向:「集成位置:」换行 + 肯定式 .husky/pre-commit、pre-push 子弹必须判红',
    JSON.stringify(
      extractHeaderClaims(
        '集成位置:\n *   - .husky/pre-commit: 集成 whitelist 模式,在 commit 前检测\n *   - .husky/pre-push: 集成 baseline 模式,在 push 前检测\n *\n * 设计权衡:\n',
      ),
    ) === '["集成位置","pre-push"]',
  )
  // R1 正向:同一 header 内「先如实、后撒谎」不得被第一处的否定吞掉
  assert(
    'P18 R1 正向:同文件前句「可选」后句肯定式声称,仍须判红(逐出现点各判)',
    extractHeaderClaims('集成位置: 可选手动跑\n\n另一段\n\n集成位置: .husky/pre-push 已集成').includes('集成位置'),
  )
  // R2 负向:真仓 §1 原文形态 —— 同一条款他句(示例代码里的「守门」)不得算到本脚本头上
  assert(
    'P19 R2 负向:「…O20d 守门…」示例 + 末句「扫描工具:node scripts/check-task-claims.mjs」不得判红',
    findAgentsClaims(
      [
        '- **任务认领**:在 `- [ ]` 后追加 `（进行中）`,例 `- [ ]（进行中）O20d 守门...`;完成后改 `[x] ✅(日期)`。派单前先扫进行中项。扫描工具:`node scripts/check-task-claims.mjs`。',
      ],
      'check-task-claims.mjs',
    ).length === 0 &&
      findAgentsClaims(
        ['- 另有 `scripts/check-a.mjs` 与 `scripts/check-b.mjs`(后者为 guardian-runner 第 36 项实际调用项)校验同步一致性。'],
        'check-a.mjs',
      ).length === 0,
  )
  // R2 正向:接线表述与被点名脚本**同句**照旧判红(收窄没削掉有效面)
  assert(
    'P20 R2 正向:同句含守门/blocking 的点名必须判红(含 bullet 列表内)',
    findAgentsClaims(
      ['- 另有 `scripts/check-a.mjs`(守门,blocking)与 `scripts/check-b.mjs`。', '- **守门**:`scripts/check-c.mjs`(接入 pre-commit 第 87 项)'],
      'check-a.mjs',
    ).length === 1 &&
      findAgentsClaims(['- 别的说明。另见 `scripts/check-d.mjs`,该门 blocking。'], 'check-d.mjs').length === 1,
  )

  assert(
    'P21 R4 负向:文档点过名的已接线门不得进"未覆盖"名单(含裸名与 scripts/ 前缀两种写法)',
    findUndocumentedGates(
      ['check-named.mjs', 'check-also-named.mjs'],
      '本仓守门:`scripts/check-named.mjs`(blocking)。另见 check-also-named.mjs 的说明。',
    ).length === 0,
  )
  assert(
    'P22 R4 正向:接线了但两份文档通篇没点名的门必须进名单(名单由 M8 端到端证明参与退出码)',
    findUndocumentedGates(['check-silent.mjs', 'check-named.mjs'], '只有 `scripts/check-named.mjs` 被写到。').join(
      ',',
    ) === 'check-silent.mjs',
  )

  assert(
    'P23 R5 重复 id 必判红(2026-09-24 实测撞号:两会话同日各加一道 91)',
    findDuplicateIds(
      [{ id: '91', s: 'a' }, { id: '91', s: 'b' }, { id: '92', s: 'c' }]
        .map((x) => `\n  {\n    id: '${x.id}',\n    script: '${x.s}.mjs',`)
        .join('\n'),
    ).join(',') === '91',
  )
  assert(
    'P24 R5 负向 + R6 语义:编号唯一不得报红;共用 skipEnv 只计数不判红',
    findDuplicateIds("\n  {\n    id: '91',\n    script: 'a.mjs',\n  },\n  {\n    id: '92',\n    script: 'b.mjs',\n  },").length === 0 &&
      // 两处共用同一 skipEnv ⇒ R6 报 1 组,但 R5 仍为 0(本仓 id 2 / 2n-web 是**刻意**共用,runner 里写明理由)
      findSharedSkipEnvs(
        "\n  {\n    id: '2',\n    script: 'a.mjs',\n    skipEnv: 'HUSKY_SKIP_X',\n  },\n  {\n    id: '2n-web',\n    script: 'a.mjs',\n    skipEnv: 'HUSKY_SKIP_X',\n  },",
      ).length === 1 &&
        findDuplicateIds(
          "\n  {\n    id: '2',\n    skipEnv: 'HUSKY_SKIP_X',\n  },\n  {\n    id: '2n-web',\n    skipEnv: 'HUSKY_SKIP_X',\n  },",
        ).length === 0,
  )

  assert(
    'P25 R7 负向:依据可核验的 dispatcher 不得报问题(文件存在且真提到被豁免脚本)',
    validateDispatcherClaims(
      [{ script: 'check-tool.mjs', type: 'dispatcher', dispatcher: 'scripts/host.ps1 prebuild', reason: 'x x x x x x x x' }],
      (rel) => (rel === 'scripts/host.ps1' ? "node scripts/check-tool.mjs --check\n" : null),
    ).length === 0,
  )
  assert(
    'P26 R7 正向:文件不存在 / 文件里没提该脚本 两种假依据都必须报(实测抓到 check-lock 那条)',
    validateDispatcherClaims(
      [
        { script: 'check-a.mjs', type: 'dispatcher', dispatcher: 'scripts/ghost.ps1', reason: 'y y y y y y y y' },
        { script: 'check-b.mjs', type: 'dispatcher', dispatcher: 'apps/web/package.json prebuild', reason: 'z z z z z z z z' },
      ],
      (rel) => (rel === 'apps/web/package.json' ? 'node ../../scripts/deploy-lock.mjs acquire\n' : null),
    ).length === 2,
  )

  // 端到端层(独立临时假仓库 + 显式 --root 注入:自测只改 cwd 会静默扫真仓)
  const base = mkdtempSync(join(tmpdir(), 'ihui-gate-wiring-selftest-'))
  try {
    const repo = makeFixtureRepo(base)
    const r1 = runGateCli([`--root=${repo}`, '--json'])
    const j1 = JSON.parse(r1.out.slice(r1.out.indexOf('{')))
    const reds1 = j1.reds.map((x) => x.script).sort()
    assert(`E1 基线假仓 exit 1(实得 ${r1.code})`, r1.code === 1)
    assert(
      `E2 基线红点恰为两枚撒谎门(实得 ${reds1.join('|')})`,
      JSON.stringify(reds1) === JSON.stringify(['check-lying-r1.mjs', 'check-lying-r2.mjs']),
    )
    assert('E3 强接线四形态全部识别(runner/husky/package.json/path.join)', j1.counts.wired >= 5, JSON.stringify(j1.counts))
    assert('E4 模板分发子门算强接线', j1.counts.wired >= 5 && !j1.reds.some((x) => x.script.startsWith('scan-')))
    assert('E5 仅 CI 算弱接线不判红', j1.wiredWeak.some((x) => x.script === 'check-ci-only.mjs'))
    assert('E6 R3 只报数不判红', j1.counts.unwiredUnclaimed >= 1 && !j1.reds.some((x) => x.script === 'check-tool-only.mjs'))

    // 变异 0:台账只救 R3(五处零命中且无声称),绝不救 R1/R2
    const repoA = makeFixtureRepo(base, {
      files: {
        'scripts/gate-wiring-allowlist.json': JSON.stringify(
          { entries: [{ script: 'check-tool-only.mjs', type: 'standalone-tool', reason: '纯 CLI 工具,人工按需跑' }] },
          null,
          2,
        ),
      },
    })
    const rA = runGateCli([`--root=${repoA}`, '--json'])
    const jA = JSON.parse(rA.out.slice(rA.out.indexOf('{')))
    assert(
      'M0 台账把 R3 转 exempt 且仍不掩盖两枚撒谎红点',
      jA.exempt.some((x) => x.script === 'check-tool-only.mjs') &&
        jA.counts.unwiredUnclaimed === j1.counts.unwiredUnclaimed - 1 &&
        jA.reds.length === j1.reds.length &&
        rA.code === 1,
    )

    // 变异 1:给 check-lying-r1 造假接线(guardian-runner 注册)→ 该红点必须消失
    const repo2 = makeFixtureRepo(base, {
      files: {
        'scripts/guardian-runner.mjs':
          "#!/usr/bin/env node\nconst GATES = [\n  { id: 1, script: 'check-wired.mjs' },\n  { id: 2, script: 'check-lying-r1.mjs' },\n]\n",
      },
    })
    const r2 = runGateCli([`--root=${repo2}`, '--json'])
    const j2 = JSON.parse(r2.out.slice(r2.out.indexOf('{')))
    assert('M1 补上真实接线后该红点消失', !j2.reds.some((x) => x.script === 'check-lying-r1.mjs'))

    // 变异 2:给 check-lying-r1 塞台账(dispatcher)→ 门必须仍红(禁止为消红塞台账)
    const repo3 = makeFixtureRepo(base)
    writeFileSync(
      join(repo3, 'scripts', 'gate-wiring-allowlist.json'),
      JSON.stringify({ entries: [{ script: 'check-lying-r1.mjs', type: 'dispatcher', dispatcher: 'guardian-runner.mjs', reason: '为消红而登记' }] }, null, 2),
      'utf8',
    )
    git(['add', '-A'], repo3, { quiet: true })
    git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '-m', 'allow'], repo3, { quiet: true })
    const r3 = runGateCli([`--root=${repo3}`, '--json'])
    const j3 = JSON.parse(r3.out.slice(r3.out.indexOf('{')))
    assert(
      `M2 dispatcher 台账不得为撒谎门开脱(实得 status=${(j3.reds.find((x) => x.script === 'check-lying-r1.mjs') || {}).status || 'exempt'})`,
      j3.exempt.some((x) => x.script === 'check-lying-r1.mjs') === false,
    )

    // 变异 3:红点全部真接线 → 必须变绿
    const repo4 = makeFixtureRepo(base, {
      files: {
        'scripts/guardian-runner.mjs':
          "#!/usr/bin/env node\nconst GATES = [\n  { id: 1, script: 'check-wired.mjs' },\n  { id: 2, script: 'check-lying-r1.mjs' },\n  { id: 3, script: 'check-lying-r2.mjs' },\n]\n",
      },
    })
    const r4 = runGateCli([`--root=${repo4}`, '--json'])
    const j4 = JSON.parse(r4.out.slice(r4.out.indexOf('{')))
    assert(`M3 全部真接线后 exit 0(实得 ${r4.code})`, r4.code === 0 && j4.reds.length === 0)

    // 变异 4:台账登记了实际已接线的门 → 必须报「可撤销豁免」
    writeFileSync(
      join(repo4, 'scripts', 'gate-wiring-allowlist.json'),
      JSON.stringify({ entries: [{ script: 'check-wired.mjs', type: 'standalone-tool', reason: '已接线却仍挂着豁免' }] }, null, 2),
      'utf8',
    )
    git(['add', '-A'], repo4, { quiet: true })
    git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '-m', 'allow2'], repo4, { quiet: true })
    const r5 = runGateCli([`--root=${repo4}`, '--json'])
    const j5 = JSON.parse(r5.out.slice(r5.out.indexOf('{')))
    assert('M4 已接线条目仍挂台账 → 报可撤销豁免', (j5.revocableExemptions || []).some((x) => x.script === 'check-wired.mjs'))

    // 变异 5:以 .husky/pre-commit 薄壳为判据的反例 —— check-pwsh-version 形态
    const repo6 = makeFixtureRepo(base, {
      files: {
        'scripts/check-pwsh-form.mjs': '#!/usr/bin/env node\n/**\n * 集成位置: .husky/pre-commit(blocking)\n */\n',
      },
    })
    const r6 = runGateCli([`--root=${repo6}`, '--json'])
    const j6 = JSON.parse(r6.out.slice(r6.out.indexOf('{')))
    assert('M5 薄壳未含门名 → 仍判 R1 红(证明薄壳不是判据)', j6.reds.some((x) => x.script === 'check-pwsh-form.mjs'))
    const repo7 = makeFixtureRepo(base, {
      files: {
        'scripts/check-pwsh-form.mjs': '#!/usr/bin/env node\n/**\n * 集成位置: scripts/lib/pre-commit-hook.js 直接调用\n */\n',
        'scripts/lib/pre-commit-hook.js':
          '#!/usr/bin/env node\nrun(\'x\', \'node scripts/check-pwsh-form.mjs --staged\')\n' +
          'execSync(`node scripts/scan-${target}-dead-i18n-keys.mjs --exit 1`)\n',
      },
    })
    const r7 = runGateCli([`--root=${repo7}`, '--json'])
    const j7 = JSON.parse(r7.out.slice(r7.out.indexOf('{')))
    assert('M6 真实逻辑在 pre-commit-hook.js → 必须判已接线(反例 check-pwsh-version)', !j7.reds.some((x) => x.script === 'check-pwsh-form.mjs'))

    // 变异 7:2026-09-24 判据收紧的端到端**双向**对照 —— 同一 bullet 块里「他句」的守门
    // 不得算到被顺带提到的脚本头上(负向:三枚都不得红);**同句**声称照旧必须红(正向)。
    const repoM7 = makeFixtureRepo(base, {
      files: {
        'AGENTS.md':
          '# 假 AGENTS\n\n## §1 任务计划\n\n' +
          '- **任务认领**:例 `- [ ]（进行中）O20d 守门...`;完成后改 `[x]`。派单前先扫进行中项。扫描工具:`node scripts/check-claim-tool.mjs`。\n' +
          '- 另有 `scripts/check-dup-a.mjs` 与 `scripts/check-dup-b.mjs`(后者为 guardian-runner 第 36 项实际调用项)校验同步一致性。\n' +
          '- **守门**:`scripts/check-dup-c.mjs`(blocking,同日立)\n\n' +
          '## 撒谎门\n\n- 守门:`scripts/check-lying-r2.mjs`(blocking,2026-09-24 立并接入)\n',
        'scripts/check-claim-tool.mjs': '#!/usr/bin/env node\n',
        'scripts/check-dup-a.mjs': '#!/usr/bin/env node\n',
        'scripts/check-dup-b.mjs': '#!/usr/bin/env node\n',
        'scripts/check-dup-c.mjs': '#!/usr/bin/env node\n',
      },
    })
    const rM7 = runGateCli([`--root=${repoM7}`, '--json'])
    const jM7 = JSON.parse(rM7.out.slice(rM7.out.indexOf('{')))
    const redsM7 = jM7.reds.map((x) => x.script)
    assert(
      `M7 同块他句「守门」不算声称(负向 3 枚不红)+ 同句 blocking 必红(正向)(实得 ${redsM7.join('|')})`,
      !redsM7.includes('check-claim-tool.mjs') &&
        !redsM7.includes('check-dup-a.mjs') &&
        !redsM7.includes('check-dup-b.mjs') &&
        redsM7.includes('check-dup-c.mjs') &&
        redsM7.includes('check-lying-r1.mjs') &&
        redsM7.includes('check-lying-r2.mjs'),
    )

    // 变异 8:R4 升 blocking 的**双向端到端**证明 —— 唯一变量是"文档点没点名"。
    // 该夹具里所有门都已真接线(两枚撒谎门也补进了 runner),所以基线零红;
    // 只把 AGENTS.md 里 check-joined 那一行删掉 ⇒ 必须单独因 R4 变红(exit 1),
    // 补回那一行并入库 ⇒ 必须回到 exit 0。缺一半都不算证明(只证"会红"不证"红是因为它")。
    const m8Doc = (withJoined) =>
      '# 假 AGENTS\n\n## 某规则\n\n- 守门:`scripts/check-lying-r2.mjs`(blocking,2026-09-24 立并接入)\n\n' +
      '## 守门脚本速查\n\n' +
      '- 已接线:`scripts/check-wired.mjs`(blocking)\n' +
      (withJoined ? '- 已接线:`scripts/check-joined.mjs`(blocking)\n' : '') +
      '- 已接线:`scripts/check-prepush.mjs`(blocking)\n' +
      '- 已接线:`scripts/check-pkg.mjs`(blocking)\n' +
      '- 已接线:`scripts/check-lying-r1.mjs`(blocking)\n' +
      '- 已接线:`scripts/check-ci-only.mjs`(仅 CI)\n' +
      '- 已接线:`scripts/check-cert.mjs`(仅 CI)\n' +
      '- 已接线:`scripts/scan-web-dead-i18n-keys.mjs`(仅 CI)\n' +
      '- 已接线:`scripts/scan-desktop-dead-i18n-keys.mjs`(仅 CI)\n\n'
    const repoM8 = makeFixtureRepo(base, {
      files: {
        'scripts/guardian-runner.mjs':
          "#!/usr/bin/env node\nconst GATES = [\n  { id: 1, script: 'check-wired.mjs' },\n  { id: 2, script: 'check-lying-r1.mjs' },\n  { id: 3, script: 'check-lying-r2.mjs' },\n]\n",
        'AGENTS.md': m8Doc(false),
      },
    })
    const rM8a = runGateCli([`--root=${repoM8}`, '--json'])
    const jM8a = JSON.parse(rM8a.out.slice(rM8a.out.indexOf('{')))
    const r4a = (jM8a.reds || []).filter((x) => x.status === 'red-r4')
    assert(
      `M8a 已接线但文档未点名 → 单独因 R4 变红(实得 code=${rM8a.code} reds=${jM8a.reds.map((x) => x.script).join('|')})`,
      rM8a.code === 1 && r4a.length === 1 && r4a[0].script === 'check-joined.mjs' && jM8a.reds.length === 1,
    )
    writeFileSync(join(repoM8, 'AGENTS.md'), m8Doc(true), 'utf8')
    git(['add', '-A'], repoM8, { quiet: true })
    git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '-m', 'doc-m8'], repoM8, {
      quiet: true,
    })
    const rM8b = runGateCli([`--root=${repoM8}`, '--json'])
    const jM8b = JSON.parse(rM8b.out.slice(rM8b.out.indexOf('{')))
    assert(
      `M8b 补上文档点名(同 HEAD 侧)后必须回到 exit 0(实得 ${rM8b.code})`,
      rM8b.code === 0 && jM8b.reds.length === 0,
    )
  } catch (e) {
    assert(`EX 端到端异常: ${e && e.message}`, false)
  } finally {
    try {
      rmSync(base, { recursive: true, force: true, maxRetries: 5 })
    } catch {
      /* Windows 偶发句柄占用:临时目录自清 */
    }
  }

  const failed = cases.filter((c) => !c.ok)
  for (const c of cases) console.log(`${c.ok ? '  ok' : '  FAIL'} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ''}`)
  console.log(`\n自检 ${cases.length} 例:${cases.length - failed.length} 通过 / ${failed.length} 失败`)
  return failed.length === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      // 必须显式传播退出码:异步 main() 自然返回时 Node 一律按 0 收工(自检 E1 抓出的真缺陷)
      process.exitCode = typeof code === 'number' ? code : 0
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  WIRING_POINTS,
  GATE_FILE_RE,
  HEADER_CLAIM_PATTERNS,
  CLAIM_NEGATION_RE,
  AGENTS_CLAIM_RE,
  AGENTS_SENTENCE_SPLIT_RE,
  SELF_EXEMPT_SCRIPT,
  filterGatePaths,
  extractHeaderRegion,
  extractHeaderClaims,
  claimWindow,
  buildTemplateMatchers,
  gateMatchesTemplates,
  parseGrepHits,
  splitAgentClauses,
  findAgentsClaims,
  classifyGate,
  findRevocableExemptions,
  findStaleExemptions,
  validateAllowlist,
  makeFixtureRepo,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
