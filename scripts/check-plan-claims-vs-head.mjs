#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-plan-claims-vs-head.mjs — 票面声称 ↔ HEAD 实物 对账尺(票 G-1142551 同族教训的机制化出口)
 *
 * 立票理由(2026-10-18 现读):台账里出现过"票面写着已入库 + 实测 N 例全绿,而实现物在
 * **任何 ref 与磁盘上都不存在**"的条目(D35/D36/D43 那一族的 `voice-note.ts` /
 * `prompt-drafts.ts` / `history-projection.ts`)。既有尺子全看不到这一型:
 * `check-task-claims.mjs` 只管认领牌、`check-plan-line-loss.mjs` 只管登记行不丢。
 * 而这一型恰恰最贵:账面说"做完了",于是它留在派单口径外(或不留),别的会话既可能重做,
 * 也可能永远不去做 —— 两边都错。
 *
 * 【2026-10-23 收窄:声称必须长在登记行本体上】
 * 此前 `extractClaims` 的形状是"遇 `- [ ]` 行设 currentId,其后**所有行**都沿用这个 currentId 抽声称"。
 * 于是散文/注释行既冒充了别人的票号,又把"文中明写自己不存在"的叙述算成实物缺口 —— 现读"缺 11 条"
 * 里 11/11 都不在 `- [ ]` 登记行本体上(逐条形态见镜像测试),报出来的"声称方:82/10/35/O81"整串不可用。
 * 分档改为三档,判序单向收窄(只减误报,不减覆盖面):
 *   ① 登记行本体(`^[-*] [ ]`)的声称 ⇒ 照旧走 C1/C2/C3,判缺 ⇒ 进**判红集**;
 *   ② 登记行之外的叙述行(散文、注释、前置段落、已勾行的续行)的声称 ⇒ **仍逐条量 HEAD 实物**,
 *      但缺物只能落 undetermined(reason=narrative-source)并逐条点名:不冒红也不记绿(§0.3)。
 *      这是可追责的一档,不是"从此无人管"——它把出处写成**该行自己的原文片段**(内容锚点),
 *      不再继承任何票号;
 *   ③ 已勾行 `- [x]` ⇒ 按 §1 完成即删,整行不参与判定。
 * 红线没动:②永远吃不到"票面声称已入库而任何 ref 无实物"那一型,因为那一型的定义就是**登记行**
 * 上的声称(D35/D36/D43 一族)—— 判红面仍是①,镜像测试用真 git 探针钉住"登记行上凭空造的路径照红"。
 *
 * 判据(三类可机检声称,只从**未完成条目** `- [ ]` 里抽 —— 已勾行按 §1 完成即删,不该再判):
 *   C1 反引号里的路径形态 `path/file.ext`(ext ∈ 已知源码/迁移扩展名)⇒ 必须 `git cat-file -e HEAD:<path>`
 *   C2 迁移文件名 `NNNN_*.sql` ⇒ 必须在 HEAD 的迁移目录里存在(按 §5/守门 49 的 journal 口径)
 *   C3 点名的具名符号(`def X` / `function X` / 反引号包住的裸标识符且首字母小写、长度 ≥ 6)
 *      ⇒ 必须 `git grep -l` 在 HEAD 任一源文件里命中
 *
 * 三态纪律(§0.3):
 *   - 取不到 HEAD 面 ⇒ exit 2「未判定」,不记绿也不冒红;
 *   - 未抽到任何声称 ⇒ exit 2「未判定」(枚举到 0 判死),不得读成"通过";
 *   - "看着像路径/符号"但判不准的 ⇒ 计入 undetermined 只报数,不判红(误判成本是把别人
 *     的正常叙述改红,那是 §12e 的恒红门成因)。
 *
 * 缺物三问(path 在 HEAD 取不到时按序问,三问皆否才判红 —— 2026-10-23 立,承现读 2 枚误报):
 *   ① `git check-ignore` 判它被 ignore ⇒ 判不准。§5d 那族(密钥只落 .env 与 HKCU,设计上
 *      不入提交面)要它"在 HEAD 有实物"是结构上永远满足不了的条件,挂成红就是 §12e 恒红门。
 *   ② `git log --diff-filter=D` 判它曾在 HEAD 史、后被某枚删除 ⇒ 判不准,并把**删除枚点名**。
 *      这一行到底是"退役叙述"还是"声称已入库后又没了",尺子读语义必然误伤;点名枚就是把
 *      可整改的下一步交出去(5e-1),静默放过才是掩盖。
 *   ③ 父目录也不在 HEAD ⇒ 判不准(别仓引用 / 整树移动,既有规则)。
 *   三问皆否 ⇒ 判红,证据写死"从未在 HEAD 史出现"—— 这正是本门立项时那一型(D35/D36/D43:
 *   账面写"已入库 + N 例全绿",实现物在任何 ref 与磁盘都不存在)。收窄没有放过它。
 *   探针自己取不到结论(git 报错)⇒ 同样落判不准,不得冒红也不得记绿。
 *
 * 【尚未接线】本门**不在提交链上**:未注册进 `scripts/guardian-runner.mjs`(2026-10-18 该文件正被并行会话持有,
 *   按 §12 不往在飞 runner 里加块),也不在 `scripts/lib/pre-commit-hook.js` ⇒ 没有紧急跳过变量生效点。
 *   接线前置(写在这是为了不让下一手顺手升档):① 基线文件先随建门枚落地(基线按 §0.4 取 HEAD 面,
 *   所以建门当轮本门必判"未判定",这是设计而非故障);② C3 具名符号那一维先量过全树 grep 的耗时再决定开不开;
 *   ③ 存量(2026-10-23 收窄前的读数 26 条真缺 + 44 条判不准,只作历史参照;
 *      收窄后的现值以本门当次运行为准)清零才谈 blocking,否则就是 §12e 的恒红门。
 * * 定级:**warn 起步**。存量非零时上 blocking 就是恒红门(§12e);升档前置 = 本门在被审面
 * 现读违规归零,且逐条误报都已被 C1–C3 的收窄规则消化。应急放行:
 * `HUSKY_SKIP_PLAN_CLAIMS_VS_HEAD=1`(注册条目与 skipEnv 一律以 guardian-runner.mjs 现值为准)。
 *
 * 取材面(§0.4 / 守门 118):全量档判 **HEAD blob** 的 PROJECT_PLAN.md,不读滞后的工作树副本;
 * 无 `--worktree` 逃生舱(本门的意义就是"仓库里到底有没有",读盘会自证)。
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOC = process.env.PLAN_CLAIMS_DOC || 'PROJECT_PLAN.md'
/** 差值基线:存量只报数、新增才红(§0.5)。取不到该文件 ⇒ 未判定,不判红也不判绿。 */
const BASELINE_REL = 'scripts/data/plan-claims-baseline.json'
const GIT_TIMEOUT = 120_000
const SKIP_ENV = 'HUSKY_SKIP_PLAN_CLAIMS_VS_HEAD'

/** C1:被反引号包住、含斜杠、扩展名在已知集合里 ⇒ 当成"声称某文件存在"。 */
const SOURCE_EXTS = new Set([
  'ts',
  'tsx',
  'mts',
  'cts',
  'js',
  'mjs',
  'cjs',
  'py',
  'sql',
  'rs',
  'kt',
  'swift',
  'json',
  'jsonc',
  'toml',
  'yml',
  'yaml',
  'sh',
  'ps1',
  'css',
  'html',
  'env',
  'lock',
])
/** C2:迁移文件名(`NNNN_...sql`),journal 口径的记账对象。 */
const MIGRATION_RE = /\b(\d{4}_[A-Za-z0-9_\-]+\.sql)\b/
/** 登记行本体(未完成条目)= 抽"可判红声称"的唯一面。行首不允许缩进:
 *  缩进的复选框在台账里是叙述里的示例/子条,归它只会把判红面凭空扩大(收窄必须是减法)。 */
const OPEN_ROW_RE = /^[-*]\s+\[\s]/
/** 已勾行:§1 完成即删,整行(含其续行)不再参与判定。 */
const CLOSED_ROW_RE = /^\s*[-*]\s+\[[xX]\]/
/** C3:具名符号 —— 宁窄勿宽:反引号内裸标识符,小写开头、长度 ≥ 6、不含常见散文词。 */
const SYMBOL_RE = /^[a-z][a-z0-9_]{5,}$/

const PROSE_DENY = new Set([
  'project',
  'HEAD',
  'commit',
  'github',
  'gitee',
  'python',
  'nodejs',
  'sqlite',
  'postgres',
  'mysql',
  'redis',
  'docker',
  'kubernetes',
  'javascript',
  'typescript',
  'monorepo',
  'readme',
  'license',
  'version',
  'metadata',
  'payload',
  'string',
  'number',
  'boolean',
  'object',
  'undefined',
  'runtime',
  'services',
  'packages',
])

function git(args, input) {
  // 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio(带 input
  // 走 ['pipe','pipe','pipe'])由 gitRaw 同源提供;timeout/maxBuffer 沿用本文件原值。
  return gitRaw(args, ROOT, {
    timeout: GIT_TIMEOUT,
    maxBuffer: 256 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
  })
}

function headBlob(rel) {
  try {
    return git(['show', `HEAD:${rel}`])
  } catch {
    return null
  }
}

/** 从一行的正文里抽出全部反引号片段(不跨行,不匹配空串)。 */
function backticked(text) {
  const out = []
  const re = /`([^`\n]+)`/g
  let m
  while ((m = re.exec(text)) !== null) out.push(m[1].trim())
  return out
}

/** 本仓顶层目录白名单:票面常逐字引用**上游/别仓**路径(如 `apps/zcode-cli/...`),
 *  那些不是"我方声称的实物",按我方 HEAD 判就会批量假阳(把别人的代码当成我们缺的文件)。 */
const OUR_ROOTS = new Set(['apps', 'packages', 'scripts', 'docs', 'deploy', 'e2e'])

/** 花括号集合 `a/{b,c}.ts` 是"多条路径的缩写",不是单一路径:展开后逐条判。
 *  不展开就会把 15 条正常引用一口气判成缺(第一版就这么误判了 79 条里的绝大多数)。 */
export function expandBraces(token, cap = 16) {
  const m = token.match(/^(.*?)\{([^{}]*)\}(.*)$/)
  if (!m) return [token]
  const [, pre, inner, post] = m
  const parts = inner
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  if (parts.length === 0) return [token]
  const out = []
  for (const p of parts) {
    for (const more of expandBraces(pre + p + post, cap)) {
      out.push(more)
      if (out.length >= cap) return out
    }
  }
  return out
}

function isPathClaim(token) {
  if (!token.includes('/') || token.startsWith('/') || token.includes(' ')) return false
  if (/\*/.test(token) || token.includes('<') || token.includes('…')) return false
  const bases = expandBraces(token).length ? expandBraces(token) : [token]
  if (!bases.every((b) => OUR_ROOTS.has(b.split('/')[0]))) {
    // 任一条展开落在别仓顶层 ⇒ 整串是上游/别仓引用,不作我方声称
    if (!bases.some((b) => OUR_ROOTS.has(b.split('/')[0]))) return false
  }
  const base = token.split('/').pop()
  const ext = base.includes('.') ? base.split(/[{}.]/).pop().toLowerCase() : ''
  if (!SOURCE_EXTS.has(ext)) return false
  // 带行号锚 `a/b.ts:12` 或 glob 尾巴的一律不当声称(那是引用写法,不是路径断言)
  if (/:\d+$/.test(token) || /\.\.\./.test(token)) return false
  return true
}

function isSymbolClaim(token) {
  if (token.includes('/') || token.includes(' ') || !SYMBOL_RE.test(token)) return false
  if (PROSE_DENY.has(token.toLowerCase())) return false
  return true
}

/**
 * 从台账 HEAD 面抽声称。返回 `{claims,stat}`,claims 里每条带 `source`:
 *   - `'row'`       ⇒ 声称长在**未完成登记行本体**(`^[-*] [ ]`)上,`rowId` 是该行自己的编号;
 *   - `'narrative'` ⇒ 长在登记行之外(散文/注释/前置段落/已勾行的续行),`rowId` 恒为空,
 *                     出处只用该行原文片段 `anchor` —— **绝不继承上一登记行的编号**(那是本门
 *                     现读"缺 11 条"全部误报的机制:11/11 都不在登记行本体上)。
 * 已勾行 `- [x]` 整行不参与判定(§1 完成即删)。
 */
export function extractClaims(docText) {
  const claims = []
  const stat = { openRows: 0, withClaims: 0, undetermined: 0, symbolsSkipped: 0, narrativeClaims: 0 }
  const rows = docText.split(/\r?\n/)
  for (const line of rows) {
    if (CLOSED_ROW_RE.test(line)) continue
    const isOpen = OPEN_ROW_RE.test(line)
    let owner = ''
    if (isOpen) {
      stat.openRows += 1
      // 行身份:取 G-NNN / DNN / 纯数字编号,取不到就用行首 40 字
      const idm = line.match(/\b(G-\d+|D\d+[a-z]?|O\d+[a-z]?|P\d+-F\.\d+|W\d+|B\d+|\d{1,3})\b/)
      owner = idm ? idm[1] : line.slice(0, 40).trim()
    }
    // 叙述行的出处锚点 = 该行自己的原文片段(内容锚点,不用行号:行号一次 append 就挪位)
    const anchor = isOpen ? '' : line.trim().slice(0, 80)
    const source = isOpen ? 'row' : 'narrative'
    let found = 0
    for (const tok of backticked(line)) {
      if (isPathClaim(tok)) {
        for (const one of expandBraces(tok)) {
          if (!OUR_ROOTS.has(one.split('/')[0])) continue
          claims.push({ rowId: owner, anchor, kind: 'path', target: one, source })
          found += 1
        }
      } else if (MIGRATION_RE.test(tok)) {
        claims.push({ rowId: owner, anchor, kind: 'migration', target: tok.match(MIGRATION_RE)[1], source })
        found += 1
      } else if (isSymbolClaim(tok)) {
        // C3 默认**不判**:每条具名符号都要在 HEAD 全树跑一次 git grep(本仓 2.5G),
        // 未收窄前几百条 = 几百次全树扫,装下去就是一把慢门(§12e 之外的另一种恒红:
        // 超时被跳)。要开走 `PLAN_CLAIMS_SYMBOLS=1`,开之前先量耗时再谈接线。
        stat.symbolsSkipped += 1
        if (process.env.PLAN_CLAIMS_SYMBOLS === '1') {
          claims.push({ rowId: owner, anchor, kind: 'symbol', target: tok, source })
          found += 1
        }
      } else if (MIGRATION_RE.test(tok.replace(/\s/g, ''))) {
        stat.undetermined += 1
      }
    }
    if (found > 0) {
      if (isOpen) stat.withClaims += 1
      else stat.narrativeClaims += found
    }
  }
  return { claims, stat }
}

/** 去重:同一 target 在多条行里被反复引用时只判一次,但保留全部出处。
 *  归属取**登记行优先**:同一 target 只要在任何登记行本体上出现过一次,它就归 `'row'`
 *  (判红射程内);只在叙述里出现过的才归 `'narrative'`(判不准档,点名不判红)。 */
export function groupClaims(claims) {
  const byTarget = new Map()
  for (const c of claims) {
    const key = `${c.kind}:${c.target}`
    if (!byTarget.has(key)) {
      byTarget.set(key, { kind: c.kind, target: c.target, rows: [], anchors: [], source: c.source })
    }
    const e = byTarget.get(key)
    if (c.source === 'row') e.source = 'row'
    if (c.rowId && !e.rows.includes(c.rowId)) e.rows.push(c.rowId)
    if (c.anchor && e.anchors.length < 6 && !e.anchors.includes(c.anchor)) e.anchors.push(c.anchor)
  }
  return [...byTarget.values()]
}

/**
 * 分档单源(§22c:这条归属规则只许写在这里,main 与测试都 import 它)。
 * 叙述行上的"缺实物"降为判不准,**保留原始 evidence**(不许把"从未在 HEAD 史出现"洗掉),
 * 登记行上的照原样返回 —— 判红面一条不减,只是不再让散文替别人背票号。
 */
export function resolveVerdict(entry, verdict) {
  if (entry.source === 'narrative' && verdict.verdict === 'missing') {
    return {
      verdict: 'undetermined',
      reason: 'narrative-source',
      evidence: verdict.evidence,
    }
  }
  return verdict
}

/**
 * 打印选择单源(§5e-1:挂到人眼前的每一行,收信人必须能据此动手)。
 * 旧写法 `added.length > 0 ? added : missing.slice(0, 0)` 让"无新增但有存量"这一档
 * **一行都不印** ⇒ 读的人既不知道存量是谁,也无从整改。现在三档都点名(有界):
 *   - 新增全列(它们是拦截项,不能被截断藏起来),存量补到 `cap`;
 *   - 只有存量 ⇒ 存量逐条点名前 `cap` 条 + 其余计数;
 *   - 无基线 ⇒ 只列事实,不据以判红判绿。
 */
export function chooseListing({ added, missing, cap = 15 }) {
  const addedSet = new Set(added)
  const limit = added.length > 0 ? added.length + cap : cap
  const order =
    added.length > 0 ? [...added, ...missing.filter((m) => !addedSet.has(m))] : missing
  const shown = order.slice(0, limit)
  return {
    shown,
    omitted: order.length - shown.length,
    isAdded: (m) => addedSet.has(m),
    mode: added.length > 0 ? 'added+stock' : missing.length > 0 ? 'stock-only' : 'clean',
  }
}

/**
 * 实物核对:path/migration 走 blob 存在性,symbol 走 HEAD grep。
 * path 在 HEAD 取不到时按"缺物三问"逐档问(见头注),三问皆否才判 missing。
 * 两个探针是**注入**的:judge 层不碰 git,镜像测试才能既验命中也验"探针哑了"那一档(§22c)。
 * 探针约定返回 true|false|null,`undefined` 视为探针未接线(跳过该问,不改变既有判序)。
 */
export function judgeEntry(entry, { catFile, grepHead, migrationDirs, isIgnored, removedSha }) {
  const t = entry.target
  if (entry.kind === 'path') {
    if (catFile(t)) return { verdict: 'ok' }
    // 问①:设计上就不在提交面(§5d 那族)。要求它"在 HEAD"永远满足不了 ⇒ 判不准,不冒红。
    if (isIgnored) {
      const ig = isIgnored(t)
      if (ig === true) {
        return { verdict: 'undetermined', reason: 'gitignored', evidence: '被 .gitignore 覆盖(按设计不入提交面)' }
      }
      if (ig === null) {
        return { verdict: 'undetermined', reason: 'probe-silent', evidence: 'git check-ignore 取不到结论' }
      }
    }
    // 问②:HEAD 史里曾有、后被删 ⇒ 语义分不出"退役叙述"还是"声称背离",但必须点名删除枚。
    if (removedSha) {
      const rm = removedSha(t)
      if (rm === null) {
        return { verdict: 'undetermined', reason: 'probe-silent', evidence: 'git log 删除史取不到结论' }
      }
      if (rm) {
        return {
          verdict: 'undetermined',
          reason: 'retired',
          evidence: `HEAD 史里被枚 ${rm} 删除(退役叙述 or 声称背离,看枚面判)`,
        }
      }
    }
    // 问③:父目录也不在 HEAD ⇒ 大概率是别仓/上游引用的路径(票面常逐字抄上游出处),或整棵树移动过
    // —— 这两种都不是"我方声称有个文件而它不存在",判"未判定"交人工看,不冒红(§0.3/§12e)。
    const dir = t.includes('/') ? t.slice(0, t.lastIndexOf('/')) : ''
    if (dir && !catFile(dir)) {
      return {
        verdict: 'undetermined',
        reason: 'parent-dir-absent',
        evidence: `父目录 HEAD:${dir} 也不存在(疑似别仓引用或整树移动)`,
      }
    }
    // 三问皆否 = 本门立项时那一型:声称有实物,而它在 HEAD 史任何位置都没出现过。
    return { verdict: 'missing', evidence: `HEAD:${t}(从未在 HEAD 史出现)` }
  }
  if (entry.kind === 'migration') {
    for (const dir of migrationDirs) {
      if (catFile(`${dir}/${t}`)) return { verdict: 'ok' }
    }
    return { verdict: 'missing', evidence: `迁移 ${t} 不在 HEAD 的任一迁移目录` }
  }
  const hits = grepHead(t)
  if (hits === null) {
    return { verdict: 'undetermined', reason: 'probe-silent', evidence: 'git grep 取不到结论' }
  }
  if (hits.length > 0) return { verdict: 'ok' }
  return { verdict: 'missing', evidence: `符号 ${t} 在 HEAD 面零命中` }
}

function main() {
  const text = headBlob(DOC)
  if (text === null) {
    console.log(`⚠️  取不到 HEAD 面的 ${DOC} ⇒ 未判定(不记绿也不冒红;§0.3)`)
    process.exit(2)
  }
  const migrationDirs = (
    process.env.PLAN_CLAIMS_MIGRATION_DIRS ||
    'packages/database/migrations,apps/ai-service/migrations'
  ).split(',')
  const { claims, stat } = extractClaims(text)
  const grouped = groupClaims(claims)
  if (grouped.length === 0 || !grouped.some((g) => g.source === 'row')) {
    console.log(
      `⚠️ 登记行本体上未抽到任何可机检声称(未完成条目 ${stat.openRows} 行 / 叙述行声称 ${stat.narrativeClaims} 处 / 判不准 ${stat.undetermined} 处)` +
        `⇒ 未判定,不得读成"通过"(§0.3:枚举到 0 判死;判红面只有登记行本体)`,
    )
    process.exit(2)
  }
  const cache = new Map()
  const catFile = (p) => {
    if (!cache.has(p)) {
      try {
        git(['cat-file', '-e', `HEAD:${p}`])
        cache.set(p, true)
      } catch {
        cache.set(p, false)
      }
    }
    return cache.get(p)
  }
  const grepCache = new Map()
  const grepHead = (sym) => {
    if (!grepCache.has(sym)) {
      try {
        const out = git(['grep', '-l', sym, 'HEAD', '--', 'apps', 'packages', 'scripts'])
        grepCache.set(sym, out.split(/\r?\n/).filter(Boolean))
      } catch (e) {
        if (e.status === 1) grepCache.set(sym, [])
        else grepCache.set(sym, null)
      }
    }
    return grepCache.get(sym)
  }
  const ignoreCache = new Map()
  // 三态:ignore 命中 ⇒ true;未命中 ⇒ false;git 自己出错(含 rc>1)⇒ null(交判不准,不猜)
  const isIgnored = (p) => {
    if (!ignoreCache.has(p)) {
      try {
        git(['check-ignore', '-q', '--', p])
        ignoreCache.set(p, true)
      } catch (e) {
        ignoreCache.set(p, e.status === 1 ? false : null)
      }
    }
    return ignoreCache.get(p)
  }
  const removedCache = new Map()
  // 三态:HEAD 史里有过删除 ⇒ 返回那枚短 sha;从未出现 ⇒ '';git 出错 ⇒ null
  const removedSha = (p) => {
    if (!removedCache.has(p)) {
      try {
        const out = git(['log', '-1', '--format=%h', '--diff-filter=D', 'HEAD', '--', p])
        removedCache.set(p, out.trim() || '')
      } catch {
        removedCache.set(p, null)
      }
    }
    return removedCache.get(p)
  }
  /*
   * 差值棘轮(§0.5 + §12e):台账里现成有 71 条"路径写法与仓库不符"的存量(移动过、改名过,
   * 或干脆不存在 —— 后者正是本门要抓的那一型)。一上来全判红 = 每次提交刷 71 行,那正是
   * 逼人跳门的形态。所以:基线内的只报数,**新增**的那条才红;基线取不到 ⇒ 判"未判定"
   * (不得把"没基线"读成"全通过",也不得读成"全红")。
   */
  function loadBaseline() {
    let raw
    try {
      raw = JSON.parse(headBlob(BASELINE_REL) ?? '')
    } catch {
      return null
    }
    if (!raw || !Array.isArray(raw.missing)) return null
    return raw.missing.filter((x) => typeof x === 'string')
  }
  const missing = []
  const undetermined = []
  let ok = 0
  let rowClaims = 0
  for (const e of grouped) {
    if (e.source === 'row') rowClaims += 1
    const raw = judgeEntry(e, { catFile, grepHead, migrationDirs, isIgnored, removedSha })
    const r = resolveVerdict(e, raw)
    if (r.verdict === 'missing') missing.push({ ...e, evidence: r.evidence })
    else if (r.verdict === 'undetermined')
      undetermined.push({ ...e, evidence: r.evidence, reason: r.reason })
    else ok += 1
  }
  const baseline = loadBaseline()
  const baseSet = new Set(baseline ?? [])
  const added =
    baseline === null ? [] : missing.filter((m) => !baseSet.has(`${m.kind}:${m.target}`))
  const carried = missing.length - added.length
  console.log(
    `[plan-claims] 判定面=HEAD blob(${DOC}) · 未完成条目 ${stat.openRows} 行 · 声称 ${grouped.length} 条` +
      `(登记行本体 ${rowClaims} 条 = 判红射程 / 叙述行 ${grouped.length - rowClaims} 条 = 只点名不判红)` +
      ` · 在 ${ok} / 缺 ${missing.length} / 判不准 ${undetermined.length}` +
      ` · C3 具名符号 ${stat.symbolsSkipped} 处默认不判(全树 grep 耗时未量;开档 PLAN_CLAIMS_SYMBOLS=1)`,
  )
  if (baseline === null) {
    console.log(`⚠️  基线 ${BASELINE_REL} 取不到或形状不对 ⇒ 未判定(下方只列事实,不据以判红判绿)`)
  } else {
    const hit = missing.filter((m) => baseSet.has(`${m.kind}:${m.target}`)).length
    console.log(
      `  [差值] 基线 ${baseSet.size} 条(本次仍命中 ${hit} 条,余 ${baseSet.size - hit} 条已不在缺集:口径收窄或已补齐 ⇒ 不作放行依据,基线需随口径重造) · 存量只报数 ${carried} · 新增判红 ${added.length}`,
    )
  }
  const listing = chooseListing({ added, missing })
  for (const m of listing.shown) {
    console.log(
      `  ${listing.isAdded(m) ? '❌ 新增' : '⚠️ 存量'} [${m.kind}] ${m.target} — ${m.evidence} · 声称方(登记行):${m.rows.slice(0, 4).join(',')}`,
    )
  }
  if (listing.omitted > 0) console.log(`  · … 其余 ${listing.omitted} 条未点名`)
  if (listing.mode === 'stock-only') {
    console.log(
      `  ↳ 上面这些是**基线内存量**:只报数、不拦提交(§12e 恒红门禁令);整改出口 = 把该行改成真实路径,或补齐实物,或从基线 ${BASELINE_REL} 里显式剔除该条`,
    )
  } else if (listing.mode === 'clean' && baseline !== null) {
    console.log('  ↳ 本次既无新增也无存量缺物,故无逐条点名。')
  }
  if (undetermined.length > 0) {
    const REASON_LABEL = {
      gitignored: '按设计不入提交面(.gitignore 命中)',
      retired: 'HEAD 史里被删(点名删除枚)',
      'parent-dir-absent': '父目录不在 HEAD(疑似别仓引用)',
      'probe-silent': '探针取不到结论',
      'narrative-source': '叙述行(非登记行本体)提到而 HEAD 无实物',
    }
    const byReason = new Map()
    for (const u of undetermined) {
      const k = u.reason || 'unclassified'
      if (!byReason.has(k)) byReason.set(k, [])
      byReason.get(k).push(u)
    }
    console.log(
      `  ℹ️ 判不准 ${undetermined.length} 条:既不记绿也不冒红(§0.3)· ` +
        [...byReason.entries()]
          .map(([k, v]) => `${REASON_LABEL[k] ?? k} ${v.length}`)
          .join(' / '),
    )
    // 判不准也要逐条点名:只报计数 = 下一手既不知道是谁,也无从判"这行是不是真声称存在"
    // (5e-1 可整改性:挂到人的通道前必须答得出"看了之后能做什么")。
    for (const [k, v] of byReason) {
      const cap = k === 'retired' || k === 'gitignored' || k === 'narrative-source' ? 12 : 4
      for (const u of v.slice(0, cap)) {
        // 有票号 ⇒ 声称方是登记行;没票号 ⇒ 该 target 只出现在叙述里,出处必须用该行原文片段
        const src =
          u.rows.length > 0
            ? `声称方(登记行):${u.rows.slice(0, 3).join(',')}`
            : `出处(叙述行原文锚点,不占票号):${(u.anchors[0] ?? '').slice(0, 60)}`
        console.log(`     · [${k}] ${u.target} — ${u.evidence} · ${src}`)
      }
      if (v.length > cap) console.log(`     · … [${k}] 其余 ${v.length - cap} 条未点名`)
    }
  }
  if (baseline === null) process.exit(2)
  if (added.length === 0) {
    console.log(
      `✅ 无新增"票面声称 ↔ HEAD 实物"缺口(存量 ${carried} 条只报数;升 blocking 前置 = 存量归零,§12e)`,
    )
    process.exit(0)
  }
  console.log(
    `❌ 新增 ${added.length} 条票面声称在 HEAD 面没有实物 —— 这类条目不得留在派单口径外,也不得被读成已完成`,
  )
  process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.log(`⚠️  本门自身异常 ⇒ 按未判定处理:${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  extractClaims,
  groupClaims,
  judgeEntry,
  resolveVerdict,
  chooseListing,
  isPathClaim,
  isSymbolClaim,
  expandBraces,
  backticked,
  OUR_ROOTS,
  SKIP_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
