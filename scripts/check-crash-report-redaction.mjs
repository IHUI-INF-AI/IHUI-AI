#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 崩溃上报出口脱敏对账(2026-09-27 立)。
 *
 * 病灶(实测,不是假想):`apps/web/src/components/common/ErrorBoundary.tsx` 把
 * `error.message` / `error.stack` **原样** POST 到 `/api/crash-reports`,而接收端
 * `apps/api/src/routes/crash-reports.ts` 只有 zod 长度上限(`errorMessage.max(4000)` /
 * `stack.max(20000)`),**没有任何脱敏**,并且该端点按设计**匿名可上报**。
 * ⇒ 错误消息里内嵌的 API key / Bearer / JWT / 用户机器绝对路径(`C:\Users\<name>\...`、
 * `/c/Users/<name>/AppData/...`)会明文进入 `crash_reports`(保留 90 天,见
 * `apps/api/src/jobs/pii-retention-cleanup.ts`)并出现在 admin 面板;而且因为端点匿名可写,
 * "客户端自己脱敏"结构上不能当唯一防线。
 *
 * 本门守的是**形状**:崩溃上报链路上的每一处「发射点」与「落库点」都必须调用共享层唯一出口
 * `redactCrashText`(`packages/shared/src/utils/redact.ts`)。为什么必须有尺子:AGENTS 里
 * "脱敏规则只能有一份" 这类散文约束在本仓的失效表现永远是安静(守门 70/76/81/115 同型)。
 *
 * 三条判据:
 *  - **V1 出口施加**:被识别为发射点(向 crash-reports 端点发请求)或落库点
 *    (`insert(crashReports`)的文件,其**代码面**(注释与字符串已遮,注释里的提及不算装车)
 *    必须出现 `redactCrashText(`。违规按「该文件 HEAD 自身存量」棘轮 —— 只拦"这次改动把
 *    脱敏摘掉了 / 新写了个不脱敏的发射点",不把存量变成人人 `--no-verify`(§12e 同型)。
 *    立项现读(**不是现值**,现值一律跑本命令看末行):HEAD 上 4 处站点,全按"该文件 HEAD
 *    自身存量"只报数:
 *    服务端落库点 `apps/api/src/services/crash-report-service.ts`、web 发射点
 *    `apps/web/src/components/common/ErrorBoundary.tsx`(这两处由本票收口),以及两处
 *    **本票文件清单外**的客户端发射点 `apps/miniapp-taro/src/utils/crash-report.ts`、
 *    `apps/mobile-rn/index.js` —— 它们只影响"少把原文送出设备",数据面已由服务端兜住,
 *    收口另计一票;棘轮会自己收紧:谁把它们修好,红线就跟着降一档。
 *  - **V2 出口在位**:只要有文件引用了 `redactCrashText`,被审面上的 `redact.ts` 就必须真的
 *    `export function redactCrashText`。**引用了却导不出来 = 判据没有出路**,当场判红。
 *    (刻意不在"零引用"时判红:那会让本门在修复落地前的 HEAD 上恒红,而恒红门的唯一结局是
 *    各会话走应急跳门、连带全部守门作废。)
 *  - **V3 只许一份实现**:全仓 `export function redactCrashText` 的声明处必须 ≤ 1。
 *    出现第二处就是"两处算同一件事",必漂移 —— 本仓记过最多次的失败型。
 *
 * 取材口径同 70/77/83/98/101/103/118/135:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅作人工逃生舱、两面旗同给判死;候选清单与正文**同面同轮**。
 * 取不到 ⇒ **exit 2 无法判定**(既不冒红也不记绿);枚举到 0 个候选判死(空扫不等于已收口)。
 *
 * 用法:node scripts/check-crash-report-redaction.mjs
 *       [--staged|--worktree|--json|--self-test|--files a b|--root <dir>]
 *       (`--root` 是镜像测试的临时仓通道,生产提交链不带)
 * 紧急跳过:HUSKY_SKIP_CRASH_REDACTION=1
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

/**
 * 仓库根。默认由脚本自身位置推导(**不是** `process.cwd()` —— 扫哪棵树由调用者站哪决定,
 * 那是守门 70 的镜像测试 13/14 恒红那一型)。
 * `--root <dir>` 是给镜像测试留的**临时仓通道**(生产提交链不带):判据要的只是"换一个 git 根",
 * 三面仍从同一个根取 ⇒ 不存在"根在夹具、面在真仓"的双根分裂;并强制校验 toplevel 一致。
 */
let ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const GATE_LABEL = 'check-crash-report-redaction'

/** 共享层唯一出口:名字 + 所在文件(出口被摘线时本门必须喊"没有出路",而不是继续报数) */
const EXIT_FILE = 'packages/shared/src/utils/redact.ts'
const EXIT_NAME = 'redactCrashText'

const SCAN_ROOTS = ['apps/', 'packages/']
const SCAN_EXT = /\.(tsx|ts|jsx|js)$/
/** 测试面/夹具:它们故意写含密样本,且结构上不是运行时链路 */
const TEST_NOISE = /(^|\/)(tests?|__tests__|e2e|__mocks__)(\/|$)|\.(test|spec)\.[tj]sx?$/
const BUILD_NOISE = /(^|\/)(dist|\.next|node_modules|build|coverage|\.turbo)\//
/** 自豁免:本门源码与镜像测试里全是判据字面量 */
const SELF_EXEMPT = [
  'scripts/check-crash-report-redaction.mjs',
  'scripts/tests/check-crash-report-redaction.test.mjs',
]

const ENDPOINT_TOKEN = 'crash-reports'
/**
 * 判据真用到的字面量 —— **预筛词面必须覆盖它**(自检 F15/F16 成对钉住)。
 * `redactCrashText` 必须在内:V2 要问"有没有人引用出口"、V3 要数"声明出现几处",
 * 而这两件事的载体文件里可能一个字都不提 crash-reports(比如第二个擅自实现的模块)。
 */
const JUDGE_LITERALS = [ENDPOINT_TOKEN, 'crashReports', EXIT_NAME]
/** 纯注释行(含块注释与其续行):端点出现在这里只是**叙述**,不是发射动作 */
const PURE_COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/
/** 发射动作的形状:真的往某处发请求。服务端路由注册(server.post)不在列 */
const REQUEST_SHAPE_LINE =
  /\bfetch\s*\(|\bTaro\s*\.\s*request\s*\(|\bwx\s*\.\s*request\s*\(|\bmy\s*\.\s*request\s*\(|\baxios(?:\.\w+)?\s*[.(]|\bhttp\s*\.\s*request\s*\(|\burl\s*:\s*['"`]/
/** 落库动作:drizzle 插入 crash_reports 表(标识符,遮掉注释后仍在) */
const INSERT_RE = /\binsert\s*\(\s*(?:[A-Za-z_$][\w$]*\.)?crashReports\b/
/** 出口调用:必须在**代码面**出现(注释里写一句"这里应该调 redactCrashText"不算装车) */
const CALL_RE = new RegExp(`\\b${EXIT_NAME}\\s*\\(`)
const DECL_RE = new RegExp(`export\\s+function\\s+${EXIT_NAME}\\b`)
/** 端点字面量与发射动作允许的行距:6 行足够覆盖 `Taro.request({\\n url: ...`,再大就跨函数误配 */
const EMIT_LOOKAROUND = 6

/**
 * V1 的形状判定(纯函数,输入一份文件正文):
 * @returns {{role:'emit'|'persist'|'both'|'none', callsExit:boolean, violation:boolean}}
 */
export function classifySite(text) {
  if (typeof text !== 'string') return { role: 'none', callsExit: false, violation: false, unreadable: true }
  const code = maskCommentsAndStrings(text)
  const rawLines = text.split('\n')
  let emit = false
  for (let i = 0; i < rawLines.length && !emit; i++) {
    const line = rawLines[i] ?? ''
    if (!line.includes(ENDPOINT_TOKEN)) continue
    if (PURE_COMMENT_LINE.test(line)) continue // 注释里提一句端点不等于在这里发请求
    const from = Math.max(0, i - EMIT_LOOKAROUND)
    const to = Math.min(rawLines.length - 1, i + EMIT_LOOKAROUND)
    for (let j = from; j <= to; j++) {
      if (REQUEST_SHAPE_LINE.test(rawLines[j] ?? '')) {
        emit = true
        break
      }
    }
  }
  const persist = INSERT_RE.test(code)
  const role = emit && persist ? 'both' : persist ? 'persist' : emit ? 'emit' : 'none'
  const callsExit = CALL_RE.test(code)
  return { role, callsExit, violation: role !== 'none' && !callsExit }
}

/** V2 的出口在位判定(纯函数:给定出口文件正文) */
export function detectExit(text) {
  if (typeof text !== 'string') return 'undetermined'
  return DECL_RE.test(text) ? 'ok' : 'missing'
}

/** V3 的"第二份实现"判定(纯函数:面上各文件的声明处计数) */
export function countExitDecls(perFile) {
  const decls = []
  for (const [file, text] of perFile) {
    if (typeof text !== 'string') continue
    if (DECL_RE.test(maskCommentsAndStrings(text))) decls.push(file)
  }
  return decls
}

/**
 * V2 的"引用了出口而出口不在"判定(纯函数,给镜像测试用):
 * 零引用时**不判红** —— 本门与修复同枚提交,若"出口还没导出"就判红,那台门在落地前的 HEAD 上
 * 就是恒红的,而恒红门的唯一结局是各会话走应急跳门、连带全部守门作废(§12e)。
 */
export function v2IsRed({ anyReference, exitState }) {
  return anyReference === true && exitState === 'missing'
}

/**
 * V1 的棘轮判序(纯函数):cap = 该文件 HEAD 自身是否违规,cur = 被审面上是否违规。
 * 两条都必须被证明:① HEAD 干净而现在违规 ⇒ 红(这是"把脱敏摘掉了");② HEAD 本来就违规 ⇒
 * 只报数(否则存量变成人人跳门)。把判序抽出来是因为它只能靠真索引做端到端,
 * 而共享索引此刻有什么不属于本门能假设的现场(守门 103 T12 那一课)。
 */
export function v1IsRed({ headViolation, currentViolation }) {
  return currentViolation === true && headViolation !== true
}

/**
 * 预筛词面必须是判据字面量的**严格超集**(纯函数,给自检用)。
 * 漏一个词的后果不是"少扫一个文件",而是"门对该形态全盲却一路报绿"—— 本仓记过多次
 * (守门 102 的预筛漏字形、门 118 的枚举面与判据面不同步)。所以这条对账必须常驻在自检里,
 * 而不是写在注释里等人看。
 * @param {string[]} tokens 实际使用的 git grep 固定串
 * @param {string[]} required 判据真用到的字面量
 */
export function prefilterIsSuperset(tokens, required) {
  const has = (needle) =>
    tokens.some((t) => t === needle || (t.length >= 4 && needle.startsWith(t)) || (t.length >= 4 && needle.endsWith(t)))
  return required.every(has) && required.length > 0
}

/**
 * 预筛词面(`git grep --fixed-strings`)。**必须是判据字面量的严格超集**:
 * 判据认的是 `crash-reports`(URL 段)与 `insert(crashReports`(drizzle 符号),再加上
 * `redactCrashText`(V2/V3 的载体)与 `crash_reports`(snake 表名,裸 SQL 形态)——
 * 漏一个词,门就在整型缺陷上失明(守门 102 的"预筛漏字形 = 门对该形态全盲"同一课;
 * 由自检 F15–F18 钉住超集关系,含两条"漏词必须翻红"的成对反例)。
 * 为什么必须预筛而不是全量 catBatch:真仓 HEAD 全扫 6621 个源文件实测 14.6s,挂在提交链上
 * 就是"人人嫌慢 → 跳门";而候选只有个位数文件,一次 git grep + 一次 batch 读 <0.5s。
 */
const PREFILTER_TOKENS = [...JUDGE_LITERALS, 'crash_reports']

/** 暂存变更清单(ACMR):`--staged` 档只判本次提交真正带进来的路径,与门 135/70 同取向 */
function stagedChangedPaths() {
  return new Set(
    gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean),
  )
}

/** 枚举被审面上的候选站点(git grep 无命中时 status=1,那是"没有",不是"问不到") */
function grepCandidates(face) {
  const args = ['grep', '-l', '-z', '--fixed-strings']
  for (const t of PREFILTER_TOKENS) args.push('-e', t)
  if (face === 'staged') args.push('--cached')
  else if (face === 'head') args.push('HEAD')
  let out
  try {
    out = gitRaw(args, ROOT, { timeout: GIT_TIMEOUT })
  } catch (e) {
    if (e?.status === 1) return [] // git 正常回答"零命中"
    throw e
  }
  const found = out
    .split('\0')
    .filter(Boolean)
    .map((l) => (face === 'head' ? l.replace(/^HEAD:/, '') : l))
    .filter(inScope)
  return found
}

function inScope(p) {
  if (!SCAN_EXT.test(p)) return false
  if (!SCAN_ROOTS.some((d) => p.startsWith(d))) return false
  if (TEST_NOISE.test(p) || BUILD_NOISE.test(p)) return false
  if (SELF_EXEMPT.includes(p)) return false
  return true
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function analyze(face, onlyFiles = null) {
  // 三档同一份判据(classifySite/detectExit/countExitDecls 都只吃正文),只有取材面不同:
  // head 判 HEAD blob、staged 判索引 blob、worktree 只作人工与落地前自验的逃生舱。
  const candidates = onlyFiles ? onlyFiles.filter(inScope) : grepCandidates(face)
  const contents = readFace(candidates, face)

  // V1 的两条判据**不在同一个集合上判**,这是本门设计上最容易搞错的一格:
  //  · 「站点有没有施加出口」= 本次提交带进来的东西 ⇒ 暂存档收窄到 `staged ∩ candidates`
  //    (否则一次无关提交会被别人在飞 site 的半编辑态钉红,而恒挡的结局就是各会话跳门 §12e);
  //  · 「出口在不在位 / 有没有第二份实现」= 结构性事实 ⇒ 恒按**整面**判,不收窄。
  //    收窄它就等于:把 redact.ts 的导出删掉、只 stage 那一个文件,门照样全绿 —— 而引用它的
  //    那些文件此刻全都编译不过。把两者混成一个集合是本类门最常见的自失能方式。
  const v1Scope =
    face === 'staged' && !onlyFiles
      ? candidates.filter((p) => stagedChangedPaths().has(p))
      : candidates

  const sites = []
  const unreadable = []
  for (const f of v1Scope) {
    const text = contents.get(f)
    if (typeof text !== 'string') {
      // 工作树档允许"这条路径此刻不在盘上"(别人还没写);其余两面取不到就是判据失败
      if (face !== 'worktree') unreadable.push(f)
      continue
    }
    const c = classifySite(text)
    if (c.role !== 'none') sites.push({ file: f, ...c })
  }

  // 棘轮锚点 = 该文件 HEAD 自身的违规数(全量档天然与自身同面 ⇒ 恒不判红,
  // 这是设计:让"这次改动把脱敏摘掉了"在暂存档才生效,存量绝不变成人人跳门)
  const headContents = readFace(sites.map((s) => s.file), 'head')
  const red = []
  const legacy = []
  for (const s of sites) {
    const headViolation = classifySite(headContents.get(s.file)).violation
    if (v1IsRed({ headViolation, currentViolation: s.violation })) {
      red.push({ file: s.file, role: s.role, cap: headViolation ? 1 : 0, n: s.violation ? 1 : 0 })
    } else if (s.violation) legacy.push({ file: s.file, role: s.role })
  }

  const exitText = contents.get(EXIT_FILE) ?? readFace([EXIT_FILE], face).get(EXIT_FILE)
  const exitState = detectExit(exitText)
  // 引用面 = **整面**的 candidates(见上面那条分集合的说明)。
  // 刻意排除出口文件自身:否则"声明行 `redactCrashText(`"自己就算一次引用",
  // V2 会在"出口存在但无人用"和"出口被摘线"两种完全相反的状态上都翻红 —— 前者不该判红,
  // 后者判红得靠**别的文件**真的在用它。
  const anyReference = candidates.some((p) => {
    if (p === EXIT_FILE) return false
    const t = contents.get(p)
    return typeof t === 'string' && CALL_RE.test(maskCommentsAndStrings(t))
  })
  // V2:没人引用出口时不判红(见 v2IsRed 注释);一旦引用了而出口缺失 ⇒ 判红
  const exitMissingRed = v2IsRed({ anyReference, exitState })
  // V3:第二份实现 —— 出口名已在预筛词面里,所以 candidates 就是声明可能出现的全体
  const decls = countExitDecls(contents)
  const dupDeclRed = decls.length > 1

  // 空扫只在**全量档**判死:暂存档本次没带上崩溃相关路径是常态(一次只改文档或别的端),
  // 把它判成"无法判定"等于替每一次无关提交挡路。V2/V3 仍照判,所以"未判"只作用于 V1。
  const notApplicable = face === 'staged' && v1Scope.length === 0 && !onlyFiles
  const emptyScan = face !== 'staged' && candidates.length === 0 && !onlyFiles
  let exit = 0
  if (unreadable.length || emptyScan || exitState === 'undetermined') exit = 2
  else if (red.length || exitMissingRed || dupDeclRed) exit = 1

  return {
    face,
    scannedFiles: candidates.length,
    v1Scanned: v1Scope.length,
    sites: sites.map((s) => ({ file: s.file, role: s.role, violation: s.violation })),
    red,
    legacy,
    unreadable,
    notApplicable,
    exitFile: EXIT_FILE,
    exitName: EXIT_NAME,
    exitState,
    anyReference,
    exitMissingRed,
    decls,
    dupDeclRed,
    emptyScan,
    exit,
  }
}

/* ----------------------------- 自检(构造面) ----------------------------- */

/** 真仓源码逐字片段:发射点/落库点/纯注释提及/服务端路由 各一,防"夹具复刻实现形状"(§22c) */
const FIXTURES = {
  /** 修复后的 web 发射点:fetch + 端点字面量 + 出口调用 */
  emitFixed: `import { redactCrashText } from '@ihui/shared/utils/redact'
export function go(error) {
  void fetch('/api/crash-reports', {
    method: 'POST',
    body: JSON.stringify({ errorMessage: redactCrashText(error.message) }),
  })
}`,
  /** 修复前的 web 发射点:同一形状,但没有出口 */
  emitBare: `export function go(error) {
  void fetch('/api/crash-reports', {
    method: 'POST',
    body: JSON.stringify({ errorMessage: error.message }),
  })
}`,
  /** 落库点:insert(crashReports) + 出口 */
  persistFixed: `import { redactCrashText } from '@ihui/shared/utils/redact'
export async function recordCrash(input) {
  await db.insert(crashReports).values({ errorMessage: redactCrashText(input.errorMessage) })
}`,
  /** 落库点:同一形状,没有出口 */
  persistBare: `export async function recordCrash(input) {
  await db.insert(crashReports).values({ errorMessage: input.errorMessage })
}`,
  /** 只在注释里提端点(app.tsx 的真实形态)⇒ 不得被认作发射点 */
  commentMention: `// 2026-08-06: 全局崩溃捕获上报(onError → /api/crash-reports)
initCrashReport()
export const x = 1`,
  /** 服务端路由注册:字面量在代码行里,但没有发射形状 ⇒ 不得被认作发射点 */
  serverRoute: `server.post('/crash-reports', async (request, reply) => {
  const parsed = crashBodySchema.safeParse(request.body)
  return reply.send(parsed)
})`,
  /** 出口只在注释里被"提到":不算装车(防"看起来有、其实没接线") */
  exitInCommentOnly: `// 这里应当调用 redactCrashText( 但没写)
export function go(error) {
  void fetch('/api/crash-reports', { body: error.message })
}`,
}

function runSelfTest() {
  const checks = []
  const ok = (name, cond, extra = '') => checks.push({ name, pass: !!cond, extra })
  for (const [k, v] of Object.entries(FIXTURES)) {
    const r = classifySite(v)
    console.log(`· ${k}: role=${r.role} callsExit=${r.callsExit} violation=${r.violation}`)
  }
  ok('F1 发射点已施加出口 ⇒ role=emit 且不违规', classifySite(FIXTURES.emitFixed).role === 'emit' && !classifySite(FIXTURES.emitFixed).violation)
  ok('F2 发射点未施加 ⇒ 判违规(成对)', classifySite(FIXTURES.emitBare).violation)
  ok('F3 落库点已施加 ⇒ role=persist 且不违规', classifySite(FIXTURES.persistFixed).role === 'persist' && !classifySite(FIXTURES.persistFixed).violation)
  ok('F4 落库点未施加 ⇒ 判违规(成对)', classifySite(FIXTURES.persistBare).violation)
  ok('F5 纯注释提及端点 ⇒ 不认作发射点', classifySite(FIXTURES.commentMention).role === 'none')
  ok('F6 服务端路由注册 ⇒ 不认作发射点', classifySite(FIXTURES.serverRoute).role === 'none')
  ok('F7 出口只写在注释里 ⇒ 不算装车(成对反向)', classifySite(FIXTURES.exitInCommentOnly).violation)
  ok('F8 出口导出 ⇒ detectExit=ok', detectExit(`export function ${EXIT_NAME}(t) { return t }`) === 'ok')
  ok('F9 出口未导出 ⇒ detectExit=missing(成对)', detectExit(`function ${EXIT_NAME}x(t) { return t }`) === 'missing')
  ok('F10 出口正文取不到 ⇒ undetermined,不得记 ok', detectExit(null) === 'undetermined')
  const declOne = countExitDecls(
    new Map([
      ['a.ts', `export function ${EXIT_NAME}(t){return t}`],
      ['b.ts', 'const q = 1'],
    ]),
  )
  ok('F11 声明计数:真声明 1 处', declOne.length === 1 && declOne[0] === 'a.ts')
  const importNotDecl = countExitDecls(new Map([['d.ts', FIXTURES.emitFixed]]))
  ok('F12 只有 import 没有定义 ⇒ 不得被数成声明处', importNotDecl.length === 0)
  const declDup = countExitDecls(
    new Map([
      ['a.ts', `export function ${EXIT_NAME}(t){return t}`],
      ['b.ts', `export function ${EXIT_NAME}(t){return t}`],
    ]),
  )
  ok('F13 第二份实现必须数出来(成对)', declDup.length === 2)
  ok(
    'F14 注释里的声明不得计入 V3 计数',
    countExitDecls(new Map([['c.ts', `// export function ${EXIT_NAME} 的说明`]])).length === 0,
  )
  ok('F15 预筛必须是判据字面量的超集', prefilterIsSuperset(PREFILTER_TOKENS, JUDGE_LITERALS))
  ok(
    'F16 预筛漏掉出口名 ⇒ 超集对账必须翻红(成对:V3 会整型失明)',
    !prefilterIsSuperset(['crash-reports', 'crashReports', 'crash_reports'], JUDGE_LITERALS),
  )
  ok('F17 预筛漏掉端点 ⇒ 同样翻红(成对)', !prefilterIsSuperset([EXIT_NAME, 'crashReports'], JUDGE_LITERALS))
  ok('F18 空判据清单不得被读成"已覆盖"', !prefilterIsSuperset(PREFILTER_TOKENS, []))
  ok('F19 非字符串输入不得炸', classifySite(undefined).unreadable === true)
  ok('F20 HEAD 干净而现在违规 ⇒ 判红(摘掉脱敏必须被抓)', v1IsRed({ headViolation: false, currentViolation: true }))
  ok('F21 HEAD 本就违规 ⇒ 只报数(成对:不得造恒红门)', !v1IsRed({ headViolation: true, currentViolation: true }))
  ok('F22 两边都干净 ⇒ 不判红(成对)', !v1IsRed({ headViolation: false, currentViolation: false }))
  ok('F23 新增文件(HEAD 取不到正文 ⇒ 无存量可豁免)未脱敏 ⇒ 判红', v1IsRed({ headViolation: classifySite(undefined).violation, currentViolation: true }))
  ok('F24 引用了出口而面上没导出 ⇒ V2 红', v2IsRed({ anyReference: true, exitState: 'missing' }))
  ok('F25 零引用而出口缺失 ⇒ V2 不判红(成对:否则落地前 HEAD 恒红)', !v2IsRed({ anyReference: false, exitState: 'missing' }))
  ok('F26 引用了且出口在位 ⇒ V2 绿(成对)', !v2IsRed({ anyReference: true, exitState: 'ok' }))
  const allOk = checks.every((c) => c.pass)
  for (const c of checks) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.extra ? ` — ${c.extra}` : ''}`)
  console.log(`--self-test: ${checks.filter((c) => c.pass).length}/${checks.length} 通过`)
  process.exitCode = allOk ? 0 : 1
}

/* ------------------------------- CLI ------------------------------- */

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const ri = argv.indexOf('--root')
  if (ri >= 0) {
    const dir = argv[ri + 1]
    if (!dir) {
      console.error('❌ --root 需要一个目录参数')
      process.exitCode = 2
      return
    }
    ROOT = resolve(dir)
    // 换根后必须确认它确实是该仓 toplevel:root 若是子目录,`git grep` 的路径与拼接基准会错位,
    // 产出的正是"看起来自洽、实则混面"的绿(assertRepoRoot 是全链门的统一做法)。
    assertRepoRoot(ROOT, GATE_LABEL)
  }
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const fi = argv.indexOf('--files')
  const only = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const r = analyze(picked.face, only && only.length ? only : null)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  console.log(
    `[crash-report-redaction] 面:${r.face} · 出口 ${r.exitName}:${r.exitState} · 预筛候选 ${r.scannedFiles} 文件 · 崩溃上报站点 ${r.sites.length} 处`,
  )
  if (r.notApplicable)
    console.log('ℹ️ 本次暂存集不含崩溃上报相关路径 ⇒ 本门**未判**(不是"判过且通过");全量档问责:node scripts/check-crash-report-redaction.mjs')
  for (const s of r.sites) {
    console.log(`  · ${s.file} [${s.role}] ${s.violation ? '❌ 未施加出口' : '✅ 已施加'}`)
  }
  if (r.red.length) {
    console.log(`❌ V1 新增违规 ${r.red.length} 个文件(超出该文件 HEAD 自身存量):`)
    for (const x of r.red) console.log(`   - ${x.file} [${x.role}] HEAD 存量 ${x.cap} → 本次 ${x.n}`)
  }
  if (r.legacy.length) {
    console.log(`⚠️ V1 存量(只报数,不拦;棘轮锚点 = 该文件 HEAD 自身,修好后红线自己下降):`)
    for (const x of r.legacy) console.log(`   - ${x.file} [${x.role}]`)
  }
  if (r.exitMissingRed)
    console.log(`❌ V2 有文件引用 ${r.exitName} 但被审面上没有导出(${EXIT_FILE})—— 判据没有出路,先补出口`)
  if (r.dupDeclRed) console.log(`❌ V3 ${r.exitName} 出现 ${r.decls.length} 处导出声明(${r.decls.join(', ')})—— 两处算同一件事必漂移`)
  if (r.unreadable.length)
    console.log(`❌ 无法判定:${r.unreadable.length} 个候选在本面取不到内容,首个:${r.unreadable[0]}`)
  if (r.emptyScan) console.log('❌ 本面枚举到 0 个崩溃上报站点 —— 判"无法判定",绝不记绿(枚举坏了不等于已收口)')
  if (r.exit === 0 && r.legacy.length === 0)
    console.log('✅ 崩溃上报的发射点与落库点全部经唯一出口脱敏(现读,勿引用文档旧数)')
  else if (r.exit === 0)
    console.log(
      `⚠️ 无新增违规,但仍有 ${r.legacy.length} 处站点**未收口**(按该文件 HEAD 自身存量只报数)—— 这不是"已收口",清完一处红线自己下降一处;客户端那几处只是减损,权威防线在服务端 recordCrash。`,
    )
  console.log('提示:射程 = apps/ 与 packages/ 的 .ts/.tsx/.js/.jsx,不含测试/构建产物/本门自身')
  process.exitCode = r.exit
}

export const __test__ = {
  classifySite,
  detectExit,
  countExitDecls,
  v1IsRed,
  v2IsRed,
  prefilterIsSuperset,
  PREFILTER_TOKENS,
  JUDGE_LITERALS,
  analyze,
  inScope,
  EXIT_FILE,
  EXIT_NAME,
  FIXTURES,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
