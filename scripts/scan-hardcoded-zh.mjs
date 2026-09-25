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
import { fileURLToPath } from 'node:url'
// 判定面取材的唯一出口(2026-09-26 迁,守门 118 的 loose-git 档收口)。此前本门有两处自己派生:
//   · `execFileSync('git', ['diff','--cached',…])` —— 裸 `'git'` 依赖 PATH(服务账户/GUI 宿主不通);
//   · `headCountOf()` 的 `execFileSync(GIT_BIN, ['show', 'HEAD:<rel>'])` —— 写死 C:/Program Files/Git
//     且**逐文件一次派生**(HEAD 面有命中的文件 ~899 个 ⇒ fork 风暴),任何一次 git 失败被 catch 折成
//     `n = 0`,于是"GIT_BIN 不在这台机上"会表现成"每个文件额度都是基线值"的假红/假绿。
// 现在一律经 scripts/lib/face-reader.mjs:绝对 git + stdio[0]=pipe + **一次 cat-file --batch 读完整批**
// + maxBuffer 给足 + 取不到 ⇒ 抛 Undetermined ⇒ 对外 exit 2「无法判定」。
import { Undetermined, catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

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
const WORKTREE_FLAG = args.has('--worktree')
if (STAGED && WORKTREE_FLAG) {
  console.error('[scan-hardcoded-zh] 无法判定(exit 2): --staged 与 --worktree 不得同用(两个判定面互斥)')
  process.exit(2)
}

/** 读 git 输出的通用出口(经共用层:绝对 git 二进制 + quotepath + windowsHide + 数字 timeout)。
 *  裸 `'git'` 依赖 PATH,服务账户 / GUI 宿主的 PATH 与交互终端不通(AGENTS §5b)。 */
function gitLines(gitArgs, root = ROOT) {
  try {
    return gitRaw(gitArgs, root, { timeout: 120000 })
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    throw new Undetermined(`git ${gitArgs[0]} 未能真正运行,判定面无法枚举:${msg}`)
  }
}

/**
 * 暂存文件集合(只是**枚举路径**,内容一律另按索引 blob 取)。
 * 返回 `null` = 暂存面**不可用**(git 问不到),与"可用且确实为空"是两件事 ——
 * 前者必须喊出来;把"没问成"表现成"没有暂存改动"再回退全量,是一把在故障现场报绿的尺子。
 */
function stagedFiles() {
  try {
    return new Set(gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR']))
  } catch {
    return null
  }
}

/**
 * 一次 `cat-file --batch` 读一批 blob 正文(逐文件派生 = fork 风暴,§5b 同型;
 * 本门原先的 `headCountOf` 就是每台命中文件一次 `git show`,HEAD 面近 900 次派生)。
 * @param {string} rev '' = 索引;HEAD = 提交树
 */
function readBlobs(root, rev, rels, batch = null) {
  const out = new Map()
  if (rels.length === 0) return out
  const specs = rels.map((r) => `${rev}:${r}`)
  const opts = { maxBuffer: 1 << 29, timeout: 120000 }
  // 显式写 `catBatch(...)`:守门 118 只认"真的调用层的读取入口",
  // 把 catBatch 当形参默认值再调 `batch(...)` 会被判成 half-wired(引了层却没用它读)。
  const got = batch ? batch(root, specs, opts) : catBatch(root, specs, opts)
  for (let i = 0; i < rels.length; i++) out.set(rels[i], got.get(specs[i]) ?? null)
  return out
}


/** 读基线:缺文件时按"空基线"处理(新文件一律零额度,宁可误拦不可漏拦) */
function readBaseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
    return raw && raw.files ? raw.files : {}
  } catch {
    return {}
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
    ? allFiles.filter((f) => stagedSet.has(relOf(f)))
    : allFiles

/** 判定面(2026-09-26 全部经 scripts/lib/face-reader.mjs,口径与本门自己的判据同形):
 *   · 缺省(全量)⇒ **工作树磁盘**。本门的"新增即拦"要求看得见**尚未 git add** 的在途中文,
 *     这一条由镜像测试「HEAD 锚点:既有中文不被判新增」的正反成对两条钉着;
 *     它的夹具还是**非 git 目录**,所以全量档不得改判 HEAD blob —— 那会让 13 例夹具当场失效。
 *   · `--staged` 且暂存集非空 ⇒ **索引 blob**(一次 `cat-file --batch`;盘上随后改对不算修好)。
 *   · `--worktree` 只是把缺省面写成显式旗标(人工逃生舱),与缺省同值。
 *   · 棘轮**额度**那一维恒取 **HEAD blob**(与命中面是两件事:额度问的是"仓库里本来有多少")。
 * 暂存集为空 / git 不可用时退回全量口径 —— 这是既有设计("空暂存 ⇒ 零命中 ⇒ 恒绿"是假通过),
 * 但**退回必须喊出来**,不许静默把人换成另一把尺子。 */
const FACE_LABEL = { worktree: '工作树磁盘(缺省全量档)', staged: '索引 blob', head: 'HEAD blob' }
let face = 'worktree'
let faceNotice = null
if (STAGED) {
  if (stagedSet === null)
    faceNotice = '暂存面不可用(git 问不到)⇒ 已退回全量口径按工作树判;这不是"没有暂存改动"'
  else if (stagedSet.size === 0)
    faceNotice = '--staged 暂存集为空 ⇒ 已退回全量口径按工作树判(与 scopeFiles 同一条兜底)'
  else face = 'staged'
}
if (faceNotice) console.log(`⚠️  [scan-hardcoded-zh] 判定面退回提示:${faceNotice}`)

/** 对一份源码文本跑同一套命中判定(磁盘/索引/HEAD 三种取材共用一份判据,不得有两套真相)。
 *  本文件是"全顶层 + process.exit"的 CLI 脚本,没有 isDirectRun 守卫,故不 export ——
 *  镜像测试改用**真 git 临时仓夹具**(--root 指过去)从外部证明这条判据。 */
function scanSource(src) {
  if (!ZH_RE.test(src)) return []
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
  return hits
}

let totalHits = 0
const fileHits = []
// 内容文案豁免清单(见 contentExemptReason):只报数不判红,但必须逐文件可见
const contentExempts = []

function relOf(f) {
  // 归一为正斜杠:基线要入仓,Windows 的 path.relative 给反斜杠会跨平台漂移
  return path.relative(ROOT, f).replace(/\\/g, '/')
}

function dieUndetermined(e) {
  const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
  console.error(`[scan-hardcoded-zh] 无法判定(exit 2): ${msg}`)
  if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
  process.exit(2)
}

/**
 * 判定面的内容(2026-09-26 迁):
 *  - `--staged` ⇒ **索引 blob**,一次 `cat-file --batch` 读完整批(原先读磁盘:盘上随后改对不算修好)
 *  - 缺省 ⇒ **工作树磁盘**,但经共用层的 `readWorktreeFile`(存在性 / 编码错误不得伪装成"这文件没中文")
 * 枚举面仍是按 TARGETS 目录树发现候选 —— 那是**枚举路径**,不是被审内容;本门的"新增即拦"要求
 * 看得见尚未 git add 的在途中文(镜像夹具「HEAD 锚点」的正反成对两条就钉着这件事)。
 */
let indexTexts = new Map()
try {
  if (face === 'staged') indexTexts = readBlobs(ROOT, '', scopeFiles.map(relOf))
} catch (e) {
  dieUndetermined(e)
}

for (const f of scopeFiles) {
  const rel = relOf(f)
  let src
  if (face === 'staged') {
    const t = indexTexts.get(rel)
    if (typeof t !== 'string') {
      dieUndetermined(new Undetermined(`${rel}: 索引 blob 取不到 —— --staged 面无法判定(不回退磁盘)`))
    }
    src = t
  } else {
    const t = readWorktreeFile(ROOT, rel)
    if (typeof t !== 'string') continue // 磁盘面取不到 = 与改判前一样跳过(walk 已保证存在,此处只兜竞态)
    src = t
  }
  const hits = scanSource(src)
  if (hits.length > 0) {
    const reason = contentExemptReason(src)
    if (reason) {
      // 内容文案声明生效:不入 fileHits(不参与基线/越线判定),但逐文件报数与理由,
      // 并写进 --json 产物 —— 豁免必须可见,否则这道门就退化成"谁都会写一行注释"。
      contentExempts.push({ file: rel, count: hits.length, reason })
      continue
    }
    totalHits += hits.length
    fileHits.push({
      file: rel,
      count: hits.length,
      samples: hits,
    })
  }
}

fileHits.sort((a, b) => b.count - a.count)

// ── 基线(ratchet)判定 ─────────────────────────────────────────────────────
// 只拦"比额度更多"的命中。**额度 = max(静态清单, 该文件 HEAD 版本自身的命中数)**。
//
// 为什么必须带 HEAD 这一维(2026-09-24 实测事故):`cd505a4374` 把 apps/cli/src 等三端加进
// 扫描面时,注释写着"存量按 HEAD 提交面首次入账",但基线 JSON 从未为它们生成条目
// (targets 仍是 5 个旧根、apps/cli 条目数 **0**)⇒ 这些端里**每个**既有中文文件额度都是 0,
// 任何人碰一下就被拦 —— 本次实例:只把 `interface ReplState` 改成 `export interface ReplState`
// (中文命中 250 → 250,差值 0)仍被判"新增 245"。静态清单漏入账 = 该端永久红灯 = 逼人绕过钩子,
// 连带废掉全部守门(与守门 77 换锚点同一条教训:**锚点必须能让它自己说话**)。
// 新文件不在 HEAD ⇒ headCount 取 0,额度仍为 0,"新文件写死中文即拦"的语义不变。
const baseline = readBaseline()
const headCountCache = new Map()
/**
 * 额度那一维的取材(2026-09-26 迁):原先是**逐文件** `execFileSync(GIT_BIN, ['show', 'HEAD:<rel>'])`
 * —— 写死 `C:/Program Files/Git/cmd/git.exe`(不在那台机上就每次抛错、被 catch 折成 `n = 0`,
 * 于是"我自己的 git 路径不对"表现成"这些文件都不在 HEAD"),且 HEAD 面有命中的文件近 900 个
 * ⇒ 900 次进程派生(§5b fork 风暴同型)。现在一次 `cat-file --batch` 读完,内容仍是同一批 HEAD blob。
 *
 * 一条必须分清的界:"这个仓根本没有"(镜像夹具 / 无 VCS 检出)与"这个路径不在 HEAD"是两件事。
 * 后者按既有语义取 0(新文件零额度,"新文件写死中文即拦"不变);前者整面不适用 ⇒ 也取 0,
 * 但**必须打印出来** —— 旧实现两种都静默,于是"额度维度整个失效"和"确实都是新文件"长得一模一样。
 */
let headFaceNotice = null
function headFaceAvailable(root) {
  try {
    gitRaw(['rev-parse', '--git-dir'], root, { timeout: 60000 })
    return true
  } catch {
    return false
  }
}
function prefetchHeadAnchor(rels, batch = catBatch) {
  const set = [...new Set(rels)]
  if (set.length === 0) return
  if (!headFaceAvailable(ROOT)) {
    headFaceNotice = `${ROOT} 不是 git 仓库 ⇒ 棘轮的 HEAD 额度维度整面不适用,一律按 0 计(与逐文件 git show 失败时的旧行为同值,但现在喊出来了)`
    for (const r of set) headCountCache.set(r, 0)
    return
  }
  const specs = set.map((r) => `HEAD:${r}`)
  let got
  try {
    got = batch(ROOT, specs, { maxBuffer: 1 << 29, timeout: 120000 })
  } catch (e) {
    dieUndetermined(e)
  }
  for (let i = 0; i < set.length; i++) {
    const t = got.get(specs[i]) ?? null
    let n = 0 // 该路径不在 HEAD(新文件)⇒ 额度 0,"新文件写死中文即拦"的语义不变
    if (typeof t === 'string') n = scanSource(t).length
    headCountCache.set(set[i], n)
  }
}
function headCountOf(rel) {
  if (!headCountCache.has(rel)) headCountCache.set(rel, 0)
  return headCountCache.get(rel)
}
prefetchHeadAnchor(fileHits.map((h) => h.file))
if (headFaceNotice) console.log(`⚠️  [scan-hardcoded-zh] ${headFaceNotice}`)
const violations = fileHits
  .map((h) => ({
    file: h.file,
    count: h.count,
    allowed: Math.max(baseline[h.file] ?? 0, headCountOf(h.file)),
  }))
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
console.log(`  判定面(命中数取的是哪一份): ${FACE_LABEL[face]} —— 棘轮额度那一维恒取 ${FACE_LABEL.head}`)
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
  console.error('  正解:界面文案走 t()/语言包(见 AGENTS.md §19)。')
  console.error('  确属**内容文案**(对外 payload/示例数据,不是界面 chrome)时,用声明式出口而不是调基线:')
  console.error('    在文件**头 40 行内**写 `// i18n-content-exempt-file: <不少于 12 字的理由>`,')
  console.error('    该文件即不计红,且会在"内容文案豁免"段逐文件报出命中数与理由供人工复核。')
  console.error('  只是清理后下调存量额度时,才跑 node scripts/scan-hardcoded-zh.mjs --update-baseline(禁止为过门调高)。')
}
if (STRICT && violations.length > 0) {
  console.error('\n[scan-hardcoded-zh] --exit 1:本次改动新增了硬编码中文,pre-commit 拒绝通过')
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
