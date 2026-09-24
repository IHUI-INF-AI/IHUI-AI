#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 硬编码中文扫描器(2026-07-20 立)
 *
 * 扫描 apps/web(app + src/components + src/hooks)与 packages/ui-react|shared 下所有 .tsx/.ts 文件,
 * 找出含硬编码中文字符串且未走 t()/next-intl 的代码行,
 * 输出按文件分组的 JSON 清单 + 文本摘要,供 i18n 迁移使用。
 *
 * 用法:
 *   node scripts/scan-hardcoded-zh.mjs                       # 全量扫描,输出到 stdout
 *   node scripts/scan-hardcoded-zh.mjs --json <out.json>     # 输出 JSON 到文件
 *   node scripts/scan-hardcoded-zh.mjs --top 30              # 只显示 TOP N
 *   node scripts/scan-hardcoded-zh.mjs --staged              # 只扫暂存区文件(pre-commit 用)
 *   node scripts/scan-hardcoded-zh.mjs --exit 1              # 越过基线(ratchet)则 exit 1,供 pre-commit 守门
 *   node scripts/scan-hardcoded-zh.mjs --update-baseline     # 用当前全量结果重写基线文件(清理后下调)
 *
 * 基线(ratchet)设计:存量 800+ 文件 / 1.1 万行硬编码中文是历史债,**一次性清不完也不该挡所有提交**;
 * 基线记录"每文件当前命中数",只有 ①暂存文件命中数比基线多 或 ②基线外新文件出现命中 才判违规。
 * 于是清理可增量推进(清完一个文件就 --update-baseline 把它的额度降为 0),而新增永远被拦。
 *
 * 设计:
 *   - 排除 messages/ / i18n / locale 目录
 *   - 排除 admin(后端路由 + 单独的 i18n 流)
 *   - 排除测试文件 __tests__/*.test.tsx(测试用例本就要中文字符串)
 *   - 排除 metadata / description / useTranslations / getTranslations 行
 *   - 排除纯注释 / import / type 声明行
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// ROOT 由脚本自身位置推导:守门链偶发从子包 cwd 调用,写死 process.cwd() 会静默扫不到文件而"恒绿"
// 唯一例外是集成测试:--root 显式注入临时夹具根(测试只改 cwd 时,脚本仍会去扫真仓,
// 于是 14 例断言全在比对真仓数据 → 13 例恒红且无人跑;2026-09-24 实测)。
const rootArgValue = (() => {
  const i = process.argv.indexOf('--root')
  const v = i >= 0 ? process.argv[i + 1] : null
  return v && !v.startsWith('-') ? v : null
})()
const ROOT = rootArgValue
  ? path.resolve(rootArgValue)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = [
  path.join(ROOT, 'apps/web/app'),
  path.join(ROOT, 'apps/web/src/components'),
  path.join(ROOT, 'apps/web/src/hooks'),
  path.join(ROOT, 'packages/ui-react/src'),
  path.join(ROOT, 'packages/shared/src'),
  // 2026-09-24 补三端覆盖:这三处此前**完全不在本棘轮视野内**,于是"新增写死中文"不会红,
  // 而 §4/§9 的跨端一致要求照样适用。直接触发实例:RN 端内 PayButton 的 TYPE_META 四档文案
  // 与 PaymentScreen 的 label="去充值" 全是字面量中文,没有任何一道门看得见(修于 a8da2c2a413,
  // 登记于 PROJECT_PLAN 第十八批)。存量按 HEAD 提交面**首次入账**(不改任何既有额度、只新增条目),
  // 之后与其他端同规则:只拦"比基线更多",清理后下调。
  path.join(ROOT, 'apps/mobile-rn/src'),
  path.join(ROOT, 'apps/extension/entrypoints'),
  path.join(ROOT, 'apps/extension/src'),
  path.join(ROOT, 'apps/extension/lib'),
  path.join(ROOT, 'apps/cli/src'),
]
const BASELINE_FILE = path.join(ROOT, 'scripts/hardcoded-zh-baseline.json')
const EXCLUDE_DIRS = new Set([
  'node_modules', '.next', '.git', 'admin', 'dist', 'build',
  'messages', 'locales', 'i18n', 'locale', '__tests__', 'tests', 'test',
])
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /messages\//,
  /\.d\.ts$/,
]

const ZH_RE = /[\u4e00-\u9fa5]/
const SKIP_LINE_RE = /^\s*(\/\/|\/\*|\*|import |export type|interface |type [A-Z]|: \w+ = \(? useTranslations|useTranslations\(|getTranslations\(|metadata:|description:|@)/
const SKIP_TOKEN_RE = /useTranslations|getTranslations|next-intl|metadata|description:/

/**
 * 内容文案出口(2026-09-24 立)。本门自己的结论文案把"确属内容文案"列为一种真实情形,
 * 但除了"调高基线"(AGENTS 守门 70 明令禁止)之外**没有任何诚实出口**,于是这类文件只能恒红
 * 或被 --no-verify 绕过 —— 两种结果都是把判断权丢掉。现给一个文件级声明:
 *   首 40 行内写 `i18n-content-exempt-file: <不少于 12 字的理由>` 才算数。
 * 生效时该文件不计红,但命中数与理由**必须逐文件打印并进 --json 产物**:
 * 豁免永远是可见、可审计的一行声明,而不是藏在基线数字里的一个计数。
 */
const CONTENT_EXEMPT_RE = /i18n-content-exempt-file:[ \t]*(\S[^\n]{11,})/
const CONTENT_EXEMPT_HEAD_LINES = 40

/** 只认文件头 40 行内的声明:防止在命中行附近随手插一句就把债务就地抹掉 */
function contentExemptReason(src) {
  const head = src.split('\n', CONTENT_EXEMPT_HEAD_LINES).join('\n')
  const m = CONTENT_EXEMPT_RE.exec(head)
  return m ? m[1].trim() : null
}

/**
 * 把字符串字面量的**内容**替换成空格(定界符保留、长度不变)。
 * 只用于"这一行是否开了跨行块注释"的判定:避免 `'https://x/*'` 里字符串内的 `//`、`/*`
 * 骗到状态机。命中判定仍走原始行 —— 模板串里的中文是真界面文案,不能掩掉。
 */
function bareOf(line) {
  let out = ''
  let q = null
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (q) {
      if (c === '\\') {
        out += '  '
        i += 1
      } else if (c === q) {
        q = null
        out += c
      } else out += ' '
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      q = c
      out += c
      continue
    }
    out += c
  }
  return out
}

/**
 * 行尾 `//` 行注释的起点(只能在 bareOf 结果上找:字符串里的 `//` 已被空白化,
 * 否则 `'输入//输出'` 的后半截真界面文案会一起被抹掉)。
 * 另外跳过 `://` —— 裸 URL 出现在跨行模板/markdown 行里时,逐行 bareOf 看不见自己
 * 在字符串内(docs/api 的 `https://api-staging…  # 预发` 即此类),把它当注释起点会造假绿。
 */
function lineCommentAt(probe) {
  for (let k = probe.indexOf('//'); k >= 0; k = probe.indexOf('//', k + 1)) {
    if (probe[k - 1] === ':') continue
    return k
  }
  return -1
}

const argv = process.argv.slice(2)
const args = new Set(argv)
const JSON_OUT = args.has('--json') ? argv[argv.indexOf('--json') + 1] : null
const TOP_N = args.has('--top') ? parseInt(argv[argv.indexOf('--top') + 1], 10) : 30
const STRICT = args.has('--exit') && argv[argv.indexOf('--exit') + 1] === '1'
const STAGED = args.has('--staged')
const UPDATE_BASELINE = args.has('--update-baseline')

/** 读基线:缺文件时按"空基线"处理(新文件一律零额度,宁可误拦不可漏拦) */
function readBaseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
    return raw && raw.files ? raw.files : {}
  } catch {
    return {}
  }
}

function stagedFiles() {
  try {
    return new Set(
      execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) {
      if (EXCLUDE_FILE_PATTERNS.some(re => re.test(full))) continue
      out.push(full)
    }
  }
  return out
}

const allFiles = []
for (const t of TARGETS) walk(t, allFiles)

// --staged 且暂存集为空时保持全量口径(手动裸跑的情形),否则"暂存集空 ⇒ 零命中 ⇒ 恒绿"是假通过
const stagedSet = STAGED ? stagedFiles() : null
const scopeFiles =
  stagedSet && stagedSet.size > 0
    ? allFiles.filter((f) => stagedSet.has(path.relative(ROOT, f).replace(/\\/g, '/')))
    : allFiles

let totalHits = 0
const fileHits = []
// 内容文案豁免清单(见 contentExemptReason):只报数不判红,但必须逐文件可见
const contentExempts = []

for (const f of scopeFiles) {
  const src = fs.readFileSync(f, 'utf8')
  if (!ZH_RE.test(src)) continue
  const lines = src.split('\n')
  const hits = []
  let inBlockComment = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false
      continue
    }
    // 判"是否开了跨行块注释"之前,必须先剥字符串与行注释:
    // 否则 `// 见 /api/ai-tutor/*` 里的 `/*` 会把状态机永久卡进"块注释中",
    // 该文件后续真实命中全被判 0(假绿)。2026-09-23 由 learn 族代理变异自检抓到。
    const probe = bareOf(line)
    const codeForBlock = probe.split('//')[0]
    if (codeForBlock.includes('/*') && !codeForBlock.includes('*/')) { inBlockComment = true; continue }
    // 剥掉**同行成对**的块注释:`{/* JSX 注释 */}` 与 `/* … */` 都是注释。
    // 原实现只跟踪"跨行块注释",整行成对的形态会漏剥 ⇒ 中文注释被算成命中
    // (实测 swarm-topology-view 18 处假阳),进而污染基线额度。
    // 中文命中判定**剥掉行尾 `//` 之后的内容**:免检说明(radius-exempt、左滑宽度等)
    // 挂在代码行尾是合法写法,原实现漏剥这一形态,使 PriceChart / TerminalTab /
    // TerminalStatusIndicators 各多出 2/1/1 处假阳,把它们顶过基线额度
    // (门 70 在 HEAD 上恒红,谁碰这三个文件谁被拦)。
    // 切点索引属于**原始行**,故先按原始行切、再剥成对块注释(在剥完的长度上切会错位)。
    const commentAt = lineCommentAt(probe)
    const code = (commentAt >= 0 ? line.slice(0, commentAt) : line)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    if (!ZH_RE.test(code)) continue
    // 豁免判定仍看**含行尾注释**的整行:有些行靠行尾 `next-intl` / `metadata` 标记声明自己
    // 是"词表缺键时的兜底译文"(实测 preview-degradation-copy.ts 整表 7 行即此写法),
    // 连标记一起剥掉等于咬断别人的豁免通道 ⇒ 该文件凭空多出 7 处红。
    const codeFull = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    if (SKIP_LINE_RE.test(codeFull)) continue
    if (SKIP_TOKEN_RE.test(codeFull)) continue
    hits.push({ line: i + 1, text: code.trim().slice(0, 200) })
  }
  if (hits.length > 0) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/')
    const reason = contentExemptReason(src)
    if (reason) {
      // 内容文案声明生效:不入 fileHits(不参与基线/越线判定),但逐文件报数与理由,
      // 并写进 --json 产物 —— 豁免必须可见,否则这道门就退化成"谁都会写一行注释"。
      contentExempts.push({ file: rel, count: hits.length, reason })
      continue
    }
    totalHits += hits.length
    fileHits.push({
      // 归一为正斜杠:基线要入仓,Windows 的 path.relative 给反斜杠会跨平台漂移
      file: rel,
      count: hits.length,
      samples: hits,
    })
  }
}

fileHits.sort((a, b) => b.count - a.count)

// ── 基线(ratchet)判定 ─────────────────────────────────────────────────────
// 只拦"比基线更多"的命中:存量额度冻结在 scripts/hardcoded-zh-baseline.json,
// 不在基线里的新文件额度为 0(新文件出现硬编码即拦)。
const baseline = readBaseline()
const violations = fileHits
  .map((h) => ({ file: h.file, count: h.count, allowed: baseline[h.file] ?? 0 }))
  .filter((v) => v.count > v.allowed)
  .sort((a, b) => b.count - b.allowed - (a.count - a.allowed))

if (UPDATE_BASELINE) {
  if (STAGED) {
    console.error('[scan-hardcoded-zh] --update-baseline 必须不带 --staged(要用全量结果重写基线)')
    process.exit(2)
  }
  const files = {}
  for (const h of fileHits) files[h.file] = h.count
  fs.writeFileSync(
    BASELINE_FILE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targets: TARGETS.map((t) => path.relative(ROOT, t).replace(/\\/g, '/')),
        total: totalHits,
        files,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  console.log(
    `[scan-hardcoded-zh] 基线已重写:${fileHits.length} 文件 / ${totalHits} 行 → scripts/hardcoded-zh-baseline.json`,
  )
  process.exit(0)
}

if (JSON_OUT) {
  fs.writeFileSync(
    JSON_OUT,
    JSON.stringify({
      scannedAt: new Date().toISOString(),
      totalFiles: fileHits.length,
      totalHits,
      targets: TARGETS.map(t => path.relative(ROOT, t)),
      // 内容文案豁免必须进产物:审计面看不到"哪些文件被谁免了",等于没有豁免制度
      contentExempts,
      files: fileHits,
    }, null, 2),
    'utf8',
  )
  console.log(`[scan-hardcoded-zh] Wrote ${fileHits.length} files / ${totalHits} hits to ${JSON_OUT}`)
  if (STRICT && violations.length > 0) process.exit(1)
  process.exit(0)
}

console.log('=== 硬编码中文 TOP ' + TOP_N + ' 文件(待 i18n) ===')
fileHits.slice(0, TOP_N).forEach(h => {
  console.log(`\n  ${String(h.count).padStart(4)} 处 | ${h.file}`)
  h.samples.slice(0, 2).forEach(s => console.log(`        L${s.line}: ${s.text}`))
})
console.log('\n=== 总计 ===')
console.log(`  含硬编码中文的文件: ${fileHits.length}`)
console.log(`  硬编码中文行数: ${totalHits}`)
console.log(`  扫描路径: ${TARGETS.map(t => path.relative(ROOT, t)).join(' + ')}`)
console.log(`  排除目录: ${[...EXCLUDE_DIRS].join(', ')}`)
if (contentExempts.length > 0) {
  const n = contentExempts.reduce((a, e) => a + e.count, 0)
  console.log(`\n=== 内容文案豁免(声明式,不计红) ===`)
  console.log(`  共 ${contentExempts.length} 个文件 / ${n} 处中文按声明放行,逐文件列出理由供人工复核:`)
  for (const e of contentExempts) console.log(`    ${e.file} (${e.count} 处) ← ${e.reason}`)
}

if (violations.length > 0) {
  console.error(`\n[scan-hardcoded-zh] 越过基线(${violations.length} 个文件新增硬编码中文):`)
  for (const v of violations.slice(0, 10)) {
    console.error(`  ${v.file}: ${v.count} 处 > 基线 ${v.allowed} 处(新增 ${v.count - v.allowed})`)
  }
  if (violations.length > 10) console.error(`  …另有 ${violations.length - 10} 个文件`)
  console.error('  正解:界面文案走 t()/语言包(见 AGENTS.md §19);确属内容文案或已取词的误报,')
  console.error('  先跑 node scripts/scan-hardcoded-zh.mjs 定位,再 node scripts/scan-hardcoded-zh.mjs --update-baseline 下调基线。')
}
if (STRICT && violations.length > 0) {
  console.error('\n[scan-hardcoded-zh] --exit 1:本次改动新增了硬编码中文,pre-commit 拒绝通过')
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
