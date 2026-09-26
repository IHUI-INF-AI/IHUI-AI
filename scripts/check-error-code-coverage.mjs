#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D71 错误码覆盖率守门(G-98 判据,2026-09-24 立)。
//
// 立因:`attachErrorMeta`(packages/api-client/src/client.ts:1117)把后端 errorCode 原样
// 挂到 Error 上,但 web 侧真正产出标题的 `formatSSEError` **只按 HTTP 码分支**,
// errorCode 从不参与判据 —— 于是后端产出的每一个业务码在界面上都被压成同一句
// 「AI 服务异常」。D71 补了 `packages/shared/src/chat/error-catalog.ts` 这张
// errorCode → 标题/动作 表;本门负责让它**不会悄悄漏码**。
//
// 三条正交规则:
//   R1 覆盖   —— 我方产出的每个 errorCode 都必须在 catalog 里有条目(零「未知错误」兜底);
//   R2 八类   —— 台账点名的八类(CONTEXT_TOO_LONG / MEDIA_COUNT_EXCEEDED / MODEL_REFUSED /
//                REQUEST_TIMEOUT / INTERNAL_ERROR / VERSION_TOO_LOW / ACCOUNT_RESTRICTED /
//                TOKEN_EXPIRED)必须全部登记;
//   R3 零兜底 —— catalog 内不得出现 category='unknown'、不得出现 UNKNOWN 键,
//                且 zh-CN 词包的 `ai.pane.errorCatalog` 下不得出现「未知错误」字样。
//
// 判据有效性靠 --self-test 注入违规自证(不读脚本自己的注释):
// 尤其 R1 带阳性反演 —— 注入一个未收录 code 必须 exit 1,否则这条门形同虚设。
// 全量模式宁漏不误报:只扫 `packages/api-client/src` 与 `apps/ai-service/app` 的
// **显式 errorCode 字面量位**,不做全仓模糊匹配。
//
// 判定面(2026-09-24 起,与守门 70/77/83/98/101 同口径):默认判 **HEAD blob**,`--staged` 判索引
// blob,`--worktree` 仅人工排查逃生舱 —— 同一轮只读一个面,两枚面旗同给直接判"无法判定"。
// 立因(当天实测):共享工作树的 `packages/i18n/messages/web/zh-CN.json` 被并行会话回退成缺
// `ai.pane.errorCatalog` 的旧基线(HEAD 与索引均有 104 键),而本门按磁盘读词包、缺失时抛裸
// Error,顶层 `if (isDirectRun) main()` 无收口 ⇒ uncaught 异常以 exit 1 呈现,一次正常提交被判
// blocking 失败。取材失败与"扫到违规"是两回事:现分别落 exit 2(无法判定,显式点名原因,
// **绝不记为通过**)与 exit 1(判据失败)。
//
// 本门**已注册进 guardian-runner.mjs(blocking,skipEnv=HUSKY_SKIP_ERROR_CODE_COVERAGE;
// 编号以 runner 现值为准,勿照抄文档)**,2026-09-24 由守门接线对账(门 89)从"造好没装车"
// 名单里补装;改这句时请同步改 runner,否则门 89 会把本行判成 R1「声称已接线但五处零命中」。
//   node scripts/check-error-code-coverage.mjs                 # 全量:判 HEAD blob
//   node scripts/check-error-code-coverage.mjs --staged        # 判索引 blob(pre-commit)
//   node scripts/check-error-code-coverage.mjs --worktree      # 磁盘逃生舱
//   node scripts/check-error-code-coverage.mjs --self-test
//   node scripts/check-error-code-coverage.mjs --list
// 反演(真实磁盘注入未收录码,不改仓库任何文件):
//   node scripts/check-error-code-coverage.mjs --scan-extra=<探针文件路径>
// 退出码:0 判据通过 / 1 判据失败 / 2 无法判定(输入取不到或非法,显式说明,绝不记绿)

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判定面取材的原语(绝对路径 git、cat-file --batch 批量读、仓库根校验、磁盘面单文件读)统一来自
// scripts/lib/face-reader.mjs —— 本门不再自带一份。那五处易错点(裸 'git'、stdio[0]='ignore'、
// 逐文件派生、junction 下的仓库根比较、maxBuffer)只在那一处存在,重复一份就是重复一份风险。
import {
  Undetermined,
  assertRepoRoot as assertGitRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 三个判定面;同一轮所有取材(清单/内容/catalog/词包)必须读同一个面。
 * 刻意保留本门的短标签而不是共用层的 FACE_LABEL:后者取值带 "(git show HEAD:<path>)" 后缀,
 * 而结论行 `判定面:HEAD blob` 的措辞已被本门自检与镜像测试逐字钉死(等价重构优先)。
 */
const FACE_LABEL = { staged: '索引 blob', head: 'HEAD blob', worktree: '工作树(磁盘)' }

/** 唯一真相源:catalog 表本身。 */
const CATALOG_FILE = 'packages/shared/src/chat/error-catalog.ts'
/** 词包:零兜底判定要读真实中文串(读 key 判不出来)。 */
const MESSAGE_FILE = 'packages/i18n/messages/web/zh-CN.json'

/**
 * 扫描面:只登记"我方真的会产出 errorCode 的两棵树"。
 * 刻意不含 dist / tests —— dist 是产物(重复计数),tests 里的假码不是产出。
 */
const SCAN_ROOTS = [
  { dir: 'packages/api-client/src', exts: ['.ts', '.tsx'], lang: 'ts' },
  { dir: 'apps/ai-service/app', exts: ['.py'], lang: 'py' },
]

/** 目录 / 文件名排除:产物、测试、缓存。 */
const EXCLUDE_DIR = /(^|\/)(tests?|__tests__|__pycache__|dist|node_modules)(\/|$)/i
const EXCLUDE_FILE = /(^|\/)(test_[^/]*|_test)\.py$|(\.test|\.spec)\.[jt]sx?$/

/**
 * 显式字面量位:`"errorCode": "X"` / `errorCode="X"` / `errorCode: 'X'` / `errorCode 'X'`。
 *
 * 分隔符写成可选是有实证依据的:api-client 只在**注释**里写下 BUDGET_EXHAUSTED
 * (client.ts:925 / :1199,产出方是 apps/api),漏掉它就会让这条漏网。
 * 值形态限定 `^[A-Z][A-Z0-9_]{2,}$` —— 同时挡掉 `...`(docstring 省略号)、小写串与类型声明。
 */
const CODE_RE = /\berrorCode\b["']?\s*[:=]?\s*["']([A-Z][A-Z0-9_]{2,})["']/g

/**
 * api-client 常量位:`export const PROVIDER_QUOTA_EXHAUSTED = 'PROVIDER_QUOTA_EXHAUSTED'`。
 * 该码在 TS 侧只有常量形态(判定靠 `errorCode === PROVIDER_QUOTA_EXHAUSTED`,无引号字面量),
 * 只认含 QUOTA/ERROR/BUDGET/RATE/TIMEOUT/CODE 的常量名,避免咬到无关大写常量。
 */
const CONST_NAME_RE = /QUOTA|ERROR|BUDGET|RATE|TIMEOUT|CODE/
const CONST_RE = /export const ([A-Z][A-Z0-9_]*)\s*=\s*'([A-Z][A-Z0-9_]{3,})'/g

/** catalog 声明的定位:只到对象体的第一个 `{`,体内容由 `catalogBody()` 花括号配平取。
 *  刻意**不按行**解析 —— 2026-09-26 实测:一枚只往表里加两个码的提交,表被写成整表多行形态
 *  (成因不是 prettier:实测两种排版 prettier 都原样保留,是写表那一方换了排版),旧逐行正则
 *  当场读空 106 条,于是 HEAD 上报出 106 处"未收录"—— 一道对全队每次提交恒红的 blocking 门,
 *  唯一结局就是人人 `--no-verify`、约 160 道门一起作废(§12e 同型)。
 *  判据依附在排版上,等于把自己交给"下一个人怎么敲回车"。 */
const CATALOG_DECL_RE = /export const ERROR_CODE_CATALOG\b[^{]*\{/
/** 表内单条目:`CODE: { … }`,三字段各占几行都算(字段级再各自容忍换行)。 */
const CATALOG_ENTRY_RE = /([A-Z][A-Z0-9_]{2,})\s*:\s*\{([^{}]*?)\}/g

/** 八类块解析(TURN_ERROR_CLASSES 数组)。 */
const CLASS_BLOCK_RE = /export const TURN_ERROR_CLASSES = \[([\s\S]*?)\] as const/

/** D92 分类学合法取值(不另立第二套分类学)。 */
const VALID_CATEGORIES = new Set([
  'resourceNotFound',
  'runtimeException',
  'entrypointNotRegistered',
  'entrypointInvalid',
  'dependencyModuleMissing',
  'resourceLimitExceeded',
  'environmentInitFailed',
  'disabled',
  'backendTimeout',
  'backendExited',
  'capabilityNotOffered',
  'backendCrashed',
  'protocolMismatch',
  'authForbidden',
  'invalidResponse',
])
const UNKNOWN_CATEGORY = 'unknown'

// ---------------------------------------------------------------------------
// 判定面(取材层)—— 原语来自 scripts/lib/face-reader.mjs,这里只剩本门特有的形状适配
// ---------------------------------------------------------------------------

/** exit 2 专用异常:输入取不到 / 清单为空 = "本门没能判定",与"判定为违规"(exit 1)严格分开。
 *  类本体就是共用层的 Undetermined(别名再导出,保持对外导出面与本门测试的 `instanceof` 不变)。 */
export const UndeterminedError = Undetermined

function requireNonEmpty(list, label) {
  if (list.length === 0)
    throw new UndeterminedError(
      `${label} 在扫描面(${SCAN_ROOTS.map((s) => s.dir).join(' + ')})枚举到 0 个文件 —— 判据不扫空气,按无法判定处理`,
    )
  return list
}

/** git 面的仓库根校验:清单与内容都按仓库根解释路径,ROOT 若是子目录会产出
 *  "自洽但基准错位"的假绿(守门 101 实测教训),故显式判死,不静默容忍。
 *  共用层只认"ROOT 是仓库根"这一条(且穿过 junction 比较);本门另加两条面特有的前置。 */
function assertRepoRoot(face, root, label) {
  assertGitRepoRoot(root, label)
  if (face === 'head') gitRaw(['rev-parse', '--verify', 'HEAD'], root) // HEAD 面必须有提交,绝不退化成"扫到 0 个文件所以绿"
  if (face === 'staged' && gitRaw(['ls-files', '-u', '-z'], root).length > 0)
    throw new UndeterminedError(
      '索引存在未合并路径(merge/rebase 进行中),:<path> 取材有歧义 ⇒ 无法判定,先收敛 merge',
    )
}

function makeGitReader(face, root) {
  const label = FACE_LABEL[face]
  assertRepoRoot(face, root, label)
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const contents = new Map()
  function fetch(rels) {
    const missing = [...new Set(rels)].filter((r) => !contents.has(r))
    if (missing.length === 0) return
    const map = catBatch(
      root,
      missing.map((r) => prefix + r),
    )
    for (const rel of missing) {
      const text = map.get(prefix + rel)
      if (text === null || text === undefined)
        throw new UndeterminedError(`${label} 取不到 ${rel}(对象缺失 / 非 blob / 未合并)`)
      contents.set(rel, text)
    }
  }
  return {
    label,
    listScanFiles() {
      const out = []
      for (const { dir, exts, lang } of SCAN_ROOTS) {
        // -z 空字节分隔:中文/空格路径不能被换行分帧打断
        const raw =
          face === 'head'
            ? gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', dir], root)
            : gitRaw(['ls-files', '-z', '--', dir], root)
        for (const rel of raw.split('\0')) {
          if (!rel || EXCLUDE_DIR.test(rel) || EXCLUDE_FILE.test(rel)) continue
          if (!exts.some((x) => rel.endsWith(x))) continue
          out.push({ relPath: rel, lang })
        }
      }
      return requireNonEmpty(out, label)
    },
    fetch,
    read(rel) {
      fetch([rel])
      return contents.get(rel)
    },
  }
}

function makeWorktreeReader(root) {
  const label = FACE_LABEL.worktree
  return {
    label,
    listScanFiles() {
      const out = []
      for (const { dir, exts, lang } of SCAN_ROOTS) {
        const walk = (abs) => {
          let entries
          try {
            entries = readdirSync(abs, { withFileTypes: true })
          } catch {
            return // 整棵目录缺失交给"0 文件即无法判定"兜底,不在这里静默当"扫过了"
          }
          for (const e of entries) {
            const p = join(abs, e.name)
            const rel = p.slice(root.length + 1).replace(/\\/g, '/')
            if (e.isDirectory()) {
              if (!EXCLUDE_DIR.test(rel)) walk(p)
              continue
            }
            if (!exts.some((x) => rel.endsWith(x))) continue
            if (EXCLUDE_DIR.test(rel) || EXCLUDE_FILE.test(rel)) continue
            out.push({ relPath: rel, lang })
          }
        }
        walk(join(root, dir))
      }
      return requireNonEmpty(out, label)
    },
    fetch() {},
    read(rel) {
      const text = readWorktreeFile(root, rel)
      // 共用层把"不存在 / 含 NUL"折成 null(它不代替业务结论);本门的口径是"取不到 = 无法判定",
      // 不得让"少扫一个文件"表现为绿。
      if (text === null)
        throw new UndeterminedError(`${label} 取不到 ${rel}(磁盘上不存在 / 二进制含 NUL)`)
      return text
    },
  }
}

/** 单一取材入口。清单、内容、catalog、词包全走同一个 reader —— 混面即假绿。 */
export function makeFaceReader(face = 'head', root = ROOT) {
  if (face === 'worktree') return makeWorktreeReader(root)
  if (face === 'head' || face === 'staged') return makeGitReader(face, root)
  throw new UndeterminedError(`未知判定面 "${face}"(允许 head / staged / worktree)`)
}

// ---------------------------------------------------------------------------
// 扫描器
// ---------------------------------------------------------------------------

/** 收集待扫文件:清单与内容同取自判定面;探针文件(--scan-extra)按磁盘读(它不属于任何判定面)。 */
export function collectFiles(reader, extraFiles = [], root = ROOT) {
  const listed = reader.listScanFiles()
  reader.fetch(listed.map((f) => f.relPath))
  const out = listed.map(({ relPath, lang }) => ({ relPath, lang, src: reader.read(relPath) }))
  for (const p of extraFiles) {
    let src
    try {
      src = readFileSync(resolve(root, p), 'utf8')
    } catch (e) {
      throw new UndeterminedError(`反演探针 ${p} 取不到:${e.message}`)
    }
    out.push({ relPath: p, lang: /\.(ts|tsx)$/.test(p) ? 'ts' : 'py', src })
  }
  return out
}

/** 从单个源文本里抽出 errorCode 字面量(带行号,便于报错定位)。 */
export function extractCodes(relPath, src, lang) {
  const found = []
  const lineOf = (index) => src.slice(0, index).split('\n').length
  for (const m of src.matchAll(CODE_RE)) {
    found.push({ code: m[1], relPath, line: lineOf(m.index), why: 'errorCode 字面量' })
  }
  if (lang === 'ts') {
    for (const m of src.matchAll(CONST_RE)) {
      if (!CONST_NAME_RE.test(m[1])) continue
      found.push({ code: m[2], relPath, line: lineOf(m.index), why: `常量 ${m[1]}` })
    }
  }
  return found
}

/** 全量扫描 → 去重后的 errorCode 全集(排序,便于比对与打印)。 */
export function scanErrorCodes(files) {
  const seen = new Map()
  for (const f of files) {
    for (const hit of extractCodes(f.relPath, f.src, f.lang)) {
      if (!seen.has(hit.code)) seen.set(hit.code, hit)
    }
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code))
}

// ---------------------------------------------------------------------------
// catalog 解析
// ---------------------------------------------------------------------------

/** 取 ERROR_CODE_CATALOG 的对象体(花括号配平)。表内字段值都是单引号短字符串,
 *  不含裸花括号,所以配平不需要真正的 JS 词法器 —— 这一点写在注释里是为了让下一个
 *  往表里塞模板字符串(可能含 `{`)的人知道要先改这里。 */
function catalogBody(src) {
  const m = CATALOG_DECL_RE.exec(src)
  if (!m) return null
  let i = m.index + m[0].length
  const start = i
  let depth = 1
  while (i < src.length) {
    const ch = src[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return src.slice(start, i)
    }
    i += 1
  }
  return null
}

/** 读 catalog 源文件 → { entries, classes }。
 *  取不到表体或一条都解不出来 ⇒ **抛 UndeterminedError(exit 2「无法判定」)**,
 *  而不是返回空清单 —— 空清单会让每一条真实产出的错误码都被判成"未收录",
 *  把"判据失明"伪装成"106 处违规"(2026-09-26 实测形态)。 */
export function parseCatalog(src, label = CATALOG_FILE) {
  const body = catalogBody(src)
  if (body === null) {
    throw new UndeterminedError(
      `catalog 里定位不到 ERROR_CODE_CATALOG 对象体(${label})—— 形状漂了,不等于没有错误码`,
    )
  }
  const entries = []
  for (const m of body.matchAll(CATALOG_ENTRY_RE)) {
    const inner = m[2]
    const field = (name) => {
      const f = new RegExp(`${name}\\s*:\\s*'([^']*)'`).exec(inner)
      return f ? f[1] : ''
    }
    entries.push({
      code: m[1],
      titleKey: field('titleKey'),
      actionKey: field('actionKey'),
      category: field('category'),
    })
  }
  if (entries.length === 0) {
    throw new UndeterminedError(
      `catalog 表体解出 0 条(${label})—— 判据看不见条目时不得把全部错误码判成"未收录"`,
    )
  }
  const block = CLASS_BLOCK_RE.exec(src)
  const classes = block ? [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : []
  return { entries, classes }
}

/** 读 zh-CN 词包的 `ai.pane.errorCatalog` 子树。
 *  缺键/非法 JSON **不再抛成崩溃**:2026-09-24 实测红因是共享工作树的 zh-CN.json 副本
 *  滞后 HEAD(HEAD 有该键、磁盘副本没有),裸 Error 冒烟到顶层被外层当成"判据失败",
 *  既诊断不出成因,也把人推向绕过钩子。现抛 `UndeterminedError`,由 main 以 exit 2
 *  显式报"无法判定",绝不记为通过。 */
export function readCatalogMessages(raw, label = MESSAGE_FILE) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new UndeterminedError(`${label} 不是合法 JSON:${e.message}`)
  }
  const node = parsed?.ai?.pane?.errorCatalog
  if (!node)
    throw new UndeterminedError(`${label} 取不到 ai.pane.errorCatalog —— 既不记通过,也不记违规`)
  return node
}

// ---------------------------------------------------------------------------
// 三条规则
// ---------------------------------------------------------------------------

/** R1:产出的每个码都必须在 catalog 里有条目。 */
export function checkCoverage(scanned, catalog) {
  const known = new Set(catalog.entries.map((e) => e.code))
  return scanned
    .filter((hit) => !known.has(hit.code))
    .map(
      (hit) =>
        `R1 ${hit.relPath}:${hit.line} 产出的 errorCode '${hit.code}'(${hit.why}) 未收录 —— 补 ${CATALOG_FILE} 一行 + 五语言词包`,
    )
}

/** R2:台账点名的八类必须全部登记。 */
export function checkClasses(catalog) {
  const known = new Set(catalog.entries.map((e) => e.code))
  return catalog.classes
    .filter((c) => !known.has(c))
    .map(
      (c) => `R2 台账八类里的 '${c}' 未登记 —— 它是判据的一部分,不得只在 TURN_ERROR_CLASSES 里挂名`,
    )
}

/** R3:零兜底 —— 不许有 unknown 分类、UNKNOWN 键,zh-CN 词包里不许出现「未知错误」。 */
export function checkNoFallback(catalog, messages) {
  const problems = []
  for (const e of catalog.entries) {
    if (e.category === UNKNOWN_CATEGORY) {
      problems.push(
        `R3 catalog 条目 '${e.code}' 的分类是 '${UNKNOWN_CATEGORY}' —— 零兜底判据不允许`,
      )
    }
    if (!VALID_CATEGORIES.has(e.category)) {
      problems.push(`R3 catalog 条目 '${e.code}' 的分类 '${e.category}' 不在 D92 分类学内`)
    }
    if (!e.titleKey || !e.actionKey) {
      problems.push(`R3 catalog 条目 '${e.code}' 缺 titleKey / actionKey`)
    }
    // 只咬**恰恰叫 UNKNOWN** 的兜底条目。UNKNOWN_API_TOOL 这类"不知道是哪个工具"的
    // 真实业务码(标题是「未找到目标资源」)不是兜底 —— 判据宽一格就会误伤真实码。
    if (e.code === 'UNKNOWN') {
      problems.push(`R3 catalog 出现 UNKNOWN 兜底条目 —— 就是「未知错误」兜底,不得存在`)
    }
  }
  for (const [code, node] of Object.entries(messages)) {
    for (const [field, value] of Object.entries(node ?? {})) {
      if (typeof value === 'string' && value.includes('未知错误')) {
        problems.push(`R3 词包 ai.pane.errorCatalog.${code}.${field} 出现「未知错误」兜底文案`)
      }
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function runChecks({ root = ROOT, face = 'head', extraFiles = [] } = {}) {
  const reader = makeFaceReader(face, root)
  const files = collectFiles(reader, extraFiles, root)
  const scanned = scanErrorCodes(files)
  const catalog = parseCatalog(reader.read(CATALOG_FILE))
  const messages = readCatalogMessages(
    reader.read(MESSAGE_FILE),
    `${reader.label} 的 ${MESSAGE_FILE}`,
  )
  const problems = [
    ...checkCoverage(scanned, catalog),
    ...checkClasses(catalog),
    ...checkNoFallback(catalog, messages),
  ]
  // 读的哪一面必须自己说出来:口径不写出来,下一次诊断又要从头猜。
  return { problems, scanned, catalog, files: files.length, face: reader.label }
}

/** 注入违规自证:证明每条规则各自真的咬得住(不靠脚本自述)。 */
function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })

  const reader = makeFaceReader('head', ROOT)
  const base = parseCatalog(reader.read(CATALOG_FILE))
  const msgs = readCatalogMessages(reader.read(MESSAGE_FILE), `HEAD blob 的 ${MESSAGE_FILE}`)

  // —— 扫描器:咬得住的 ——
  t(
    '扫描器咬住 python 字典位 `"errorCode": "X"`',
    extractCodes('a.py', 'return {"ok": False, "errorCode": "NOT_CATALOGED_ONE"}', 'py').some(
      (h) => h.code === 'NOT_CATALOGED_ONE',
    ),
  )
  t(
    '扫描器咬住 python kwarg 位 `errorCode="X"`',
    extractCodes('a.py', 'raise Foo(errorCode="NOT_CATALOGED_TWO")', 'py').some(
      (h) => h.code === 'NOT_CATALOGED_TWO',
    ),
  )
  t(
    "扫描器咬住 TS 对象位 `errorCode: 'X'`",
    extractCodes('a.ts', "const e = { errorCode: 'NOT_CATALOGED_THREE' }", 'ts').some(
      (h) => h.code === 'NOT_CATALOGED_THREE',
    ),
  )
  t(
    "扫描器咬住注释位 `errorCode 'X'`(BUDGET_EXHAUSTED 只存在于注释,放过它就会漏网)",
    extractCodes('a.ts', "* errorCode 'BUDGET_EXHAUSTED'", 'ts').some(
      (h) => h.code === 'BUDGET_EXHAUSTED',
    ),
  )
  t(
    '扫描器咬住 TS 导出常量位(PROVIDER_QUOTA_EXHAUSTED 只有常量形态)',
    extractCodes(
      'a.ts',
      "export const PROVIDER_QUOTA_EXHAUSTED = 'PROVIDER_QUOTA_EXHAUSTED'",
      'ts',
    ).some((h) => h.code === 'PROVIDER_QUOTA_EXHAUSTED'),
  )
  // —— 扫描器:不该咬的 ——
  t(
    '扫描器不吃类型声明 `errorCode?: string`',
    extractCodes('a.ts', 'export interface E { errorCode?: string }', 'ts').length === 0,
  )
  t(
    '扫描器不吃标识符比较 `errorCode === PROVIDER_QUOTA_EXHAUSTED`',
    extractCodes('a.ts', 'if (errorCode === PROVIDER_QUOTA_EXHAUSTED) return', 'ts').length === 0,
  )
  t(
    '扫描器不吃 docstring 省略号 `"errorCode": "..."`',
    extractCodes('a.py', 'SSE_ERROR = "error"  # {"message", "errorCode": "..."}', 'py').length ===
      0,
  )
  t(
    '扫描器不吃无关大写常量(常量名不含 QUOTA/ERROR/BUDGET/RATE/TIMEOUT/CODE 一律放过)',
    extractCodes('a.ts', "export const MAX_RETRY = 'MAX_RETRY'", 'ts').length === 0,
  )
  t(
    `扫描器不吃 typeof 守卫里的 'string'(不是错误码)`,
    !extractCodes('a.ts', "if (typeof json.errorCode === 'string') {}", 'ts').some(
      (h) => h.code === 'string',
    ),
  )

  // —— R1 阳性反演:注入未收录码必须被咬 ——
  const injected = [
    { code: 'D71_PROBE_NOT_CATALOGED', relPath: '<injected>', line: 1, why: '反演探针' },
  ]
  t('R1 咬住未收录码(阳性反演:补表前必红)', checkCoverage(injected, base).length === 1)
  t(
    'R1 放过已收录码(不是恒红判据)',
    checkCoverage([{ code: 'TIMEOUT', relPath: 'x.py', line: 1, why: 'x' }], base).length === 0,
  )

  // —— R2 ——
  t(
    'R2 咬住八类缺登记(从表里删掉一类)',
    checkClasses({
      ...base,
      entries: base.entries.filter((e) => e.code !== 'TOKEN_EXPIRED'),
    }).some((p) => p.includes('TOKEN_EXPIRED')),
  )
  t('R2 现状八类全登记', checkClasses(base).length === 0)
  t('R2 八类数量 = 8', base.classes.length === 8)

  // —— R3 ——
  t(
    'R3 咬住 unknown 分类(零兜底)',
    checkNoFallback(
      {
        ...base,
        entries: [
          ...base.entries,
          { code: 'X_Y_Z', titleKey: 'x', actionKey: 'y', category: 'unknown' },
        ],
      },
      msgs,
    ).some((p) => p.includes("分类是 'unknown'")),
  )
  t(
    'R3 咬住 UNKNOWN 兜底条目',
    checkNoFallback(
      {
        ...base,
        entries: [
          ...base.entries,
          {
            code: 'UNKNOWN',
            titleKey: 'UNKNOWN.title',
            actionKey: 'UNKNOWN.action',
            category: 'runtimeException',
          },
        ],
      },
      msgs,
    ).some((p) => p.includes('UNKNOWN 兜底条目')),
  )
  t(
    'R3 放过 UNKNOWN_API_TOOL(真实业务码,不是兜底 —— 判据宽一格就误伤)',
    checkNoFallback(base, msgs).length === 0 &&
      base.entries.some((e) => e.code === 'UNKNOWN_API_TOOL'),
  )
  t(
    'R3 咬住词包里的「未知错误」兜底文案',
    checkNoFallback(base, { ...msgs, TIMEOUT: { title: '未知错误', action: '重试' } }).some((p) =>
      p.includes('未知错误'),
    ),
  )
  t(
    'R3 咬住空 titleKey',
    checkNoFallback(
      {
        ...base,
        entries: [
          ...base.entries,
          { code: 'A_B_C', titleKey: '', actionKey: 'y', category: 'runtimeException' },
        ],
      },
      msgs,
    ).some((p) => p.includes('缺 titleKey')),
  )
  t(
    'R3 咬住分类越界(不在 D92 分类学内)',
    checkNoFallback(
      {
        ...base,
        entries: [
          ...base.entries,
          { code: 'A_B_C', titleKey: 'x', actionKey: 'y', category: 'madeUp' },
        ],
      },
      msgs,
    ).some((p) => p.includes('不在 D92 分类学内')),
  )
  t('R3 现状零兜底', checkNoFallback(base, msgs).length === 0)

  // —— 排版无关性(2026-09-26 实测教训):同一张表,单行与多行必须解出同一批条目 ——
  const SINGLE = `export const ERROR_CODE_CATALOG = Object.freeze({
  ALPHA_ONE: { titleKey: 'ALPHA_ONE.title', actionKey: 'ALPHA_ONE.action', category: 'runtimeException' },
  BETA_TWO: { titleKey: 'BETA_TWO.title', actionKey: 'BETA_TWO.action', category: 'authForbidden' },
})`
  const MULTI = `export const ERROR_CODE_CATALOG = Object.freeze({
  ALPHA_ONE: {
    titleKey: 'ALPHA_ONE.title',
    actionKey: 'ALPHA_ONE.action',
    category: 'runtimeException',
  },
  BETA_TWO: {
    titleKey: 'BETA_TWO.title',
    actionKey: 'BETA_TWO.action',
    category: 'authForbidden',
  },
})`
  const sEntries = parseCatalog(SINGLE, 'fixture-single').entries
  const mEntries = parseCatalog(MULTI, 'fixture-multi').entries
  t(
    '排版无关:条目写成多行后条目数不变(2026-09-26 整表换排版 ⇒ 旧逐行正则读空,HEAD 上 106 处假红)',
    sEntries.length === 2 && mEntries.length === 2,
  )
  t(
    '排版无关:两种形态解出的 code 与三字段逐条全等(不是"少读几条"而是读法不能依赖排版)',
    JSON.stringify(sEntries) === JSON.stringify(mEntries),
  )
  let noDecl = false
  try {
    parseCatalog('export const SOME_OTHER_TABLE = {}', 'fixture-nodecl')
  } catch (e) {
    noDecl = e instanceof UndeterminedError
  }
  t(
    '无法判定口径:定位不到 catalog 表体 ⇒ 抛 UndeterminedError,不得把全部错误码判成"未收录"',
    noDecl,
  )
  let emptyBody = false
  try {
    parseCatalog('export const ERROR_CODE_CATALOG = Object.freeze({})', 'fixture-empty')
  } catch (e) {
    emptyBody = e instanceof UndeterminedError
  }
  t('无法判定口径:表体解出 0 条 ⇒ 判"无法判定"而非"零条目、全线违规"', emptyBody)

  // —— 无法判定口径(exit 2 面):取材失败必须显式抛,绝不冒烟成判据红/绿 ——
  let subtreeCase = false
  try {
    readCatalogMessages('{"ai":{"pane":{}}}', 'fixture')
  } catch (e) {
    subtreeCase = e instanceof UndeterminedError
  }
  t(
    '无法判定口径:词包缺 ai.pane.errorCatalog 抛 UndeterminedError(2026-09-24 崩溃根因形态)',
    subtreeCase,
  )
  let jsonCase = false
  try {
    readCatalogMessages('{ not json', 'fixture')
  } catch (e) {
    jsonCase = e instanceof UndeterminedError
  }
  t('无法判定口径:词包非法 JSON 同样抛 UndeterminedError(JSON.parse 裸异常曾是崩溃通道)', jsonCase)
  let faceCase = false
  try {
    makeFaceReader('nonsense', ROOT)
  } catch (e) {
    faceCase = e instanceof UndeterminedError
  }
  t('无法判定口径:未知判定面显式报错,不静默退回磁盘', faceCase)

  // —— 现状必须干净:否则本门一上手就红 ——
  const live = runChecks()
  if (live.problems.length > 0) for (const p of live.problems) console.error(`   · ${p}`)
  t('当前 HEAD 零违规(本门默认判定面)', live.problems.length === 0)
  t('扫描面非空(判据没在扫空气)', live.scanned.length > 50)
  t('catalog 条目数 ≥ 扫描到的码数', live.catalog.entries.length >= live.scanned.length)

  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

/** --list:打印扫描到的 errorCode 全集(给测试里的冻结清单做输入)。 */
function listCodes(face) {
  const { scanned, catalog, face: label } = runChecks({ face })
  console.log(`# 判定面:${label}(扫描面:packages/api-client/src + apps/ai-service/app)`)
  console.log(`# 产出的 errorCode:${scanned.length} 个 / catalog 条目:${catalog.entries.length} 条`)
  for (const hit of scanned) console.log(`${hit.code}\t${hit.relPath}:${hit.line}`)
  return 0
}

/** 面旗选择:两枚同给 = 同一轮读两个面,基准错位会产出自洽假绿(守门 101 实测教训)⇒ 判死。
 *  判定逻辑走共用层 selectFace(三门同一条,免得某道门悄悄少一个面);措辞保留本门原句,
 *  因为镜像测试按 `/不得同轮混读/` 断言它。重复枚旗(`--staged --staged`)按原行为同样判死。 */
function pickFace(argv) {
  const wants = argv.filter((a) => a === '--staged' || a === '--worktree')
  if (wants.length > 1)
    throw new UndeterminedError('--staged 与 --worktree 同时给出:两个判定面不得同轮混读')
  const { face, error } = selectFace({
    staged: wants[0] === '--staged',
    worktree: wants[0] === '--worktree',
  })
  if (error) throw new UndeterminedError(error)
  return face
}

function main() {
  const argv = process.argv.slice(2)
  try {
    if (argv.includes('--self-test')) return selfTest()
    if (argv.includes('--list')) return listCodes(pickFace(argv))

    const extraFiles = []
    for (const arg of argv) {
      if (arg.startsWith('--scan-extra=')) extraFiles.push(arg.slice('--scan-extra='.length))
    }

    const { problems, scanned, catalog, files, face } = runChecks({
      face: pickFace(argv),
      extraFiles,
    })
    if (problems.length === 0) {
      console.log(
        `✅ 错误码覆盖率通过(判定面:${face}):扫 ${files} 个文件,产出 ${scanned.length} 个 errorCode,` +
          `catalog ${catalog.entries.length} 条全覆盖,八类齐全,零「未知错误」兜底`,
      )
      return 0
    }
    console.error(`❌ 错误码覆盖率发现 ${problems.length} 处问题(判定面:${face}):`)
    for (const p of problems) console.error(`   · ${p}`)
    console.error(`\n唯一真源:${CATALOG_FILE}`)
    console.error(
      '改法:在 ERROR_CODE_CATALOG 补一行,并同步 packages/i18n/messages/web/*.json 五语言词包',
    )
    return 1
  } catch (e) {
    if (e instanceof UndeterminedError) {
      // exit 2 = "本门没能判定",与 1 = "判定为违规" 严格分开:前者要人去修取材/环境,
      // 后者要改代码。混成一个退出码,下一次没人分得清该改哪一头。
      console.error(`⚠️ 无法判定(exit 2,不记为通过):${e.message}`)
      console.error(
        '   单独复现:node scripts/check-error-code-coverage.mjs;绕过(不推荐):HUSKY_SKIP_ERROR_CODE_COVERAGE=1',
      )
      return 2
    }
    throw e
  }
}

/** 供测试复用(被 import 时不执行 main(),见 isDirectRun 守卫)。 */
export const __test__ = {
  collectFiles,
  extractCodes,
  scanErrorCodes,
  parseCatalog,
  readCatalogMessages,
  checkCoverage,
  checkClasses,
  checkNoFallback,
  makeFaceReader,
  runChecks,
  CATALOG_FILE,
  MESSAGE_FILE,
  UndeterminedError,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
// 顶层无收口时,内部任何异常都以 uncaught 形态 exit 1 —— "门自己的故障"看起来像"判据失败"
// (2026-09-24 实测就是它逼出一次绕过钩子)。未预期异常一律显式 exit 2,绝不冒烟成判据红。
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`⚠️ 无法判定(门自身异常,exit 2 不记为通过):${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
