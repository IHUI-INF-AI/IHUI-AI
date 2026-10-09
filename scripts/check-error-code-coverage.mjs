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
// 三条正交规则(2026-10-05 由 G-815963 扩出第四条 R4,原有 R1/R2/R3 的逻辑一字未改):
//   R1 覆盖   —— 我方产出的每个 errorCode 都必须在 catalog 里有条目(零「未知错误」兜底);
//   R2 八类   —— 台账点名的八类(CONTEXT_TOO_LONG / MEDIA_COUNT_EXCEEDED / MODEL_REFUSED /
//                REQUEST_TIMEOUT / INTERNAL_ERROR / VERSION_TOO_LOW / ACCOUNT_RESTRICTED /
//                TOKEN_EXPIRED)必须全部登记;
//   R3 零兜底 —— catalog 内不得出现 category='unknown'、不得出现 UNKNOWN 键,
//                且 zh-CN 词包的 `ai.pane.errorCatalog` 下不得出现「未知错误」字样。
//
// R4(G-815963「未知枚举的兜底档必须是"不再产生副作用"那一档」)判的是**读侧**的同一型失真:
//   R4a `apps/api/src/db/**` 与 `packages/shared/src/**` 里 `as XxxStatus`(含两段式
//       `as unknown as XxxStatus`)直转 —— 未知值原样透传。锚点 = **该文件在 HEAD 面自身的站点数**,
//       所以全量档只报数、`--staged` 只拦"把这一族加回来";HEAD 现读 0 处,今天等价零容忍,
//       但判据不能建在"今天恰好是 0"上(那型红与本次提交无关 ⇒ 恒红门 ⇒ 全队跳钩子,§12e)。
//   R4b `coerceKnownOr(` 调用点必须把安全档给成**读得出的字面量**;能机械判出"安全档 ∉ 它自己的
//       内联全集"时判红(零容忍、不吃棘轮 —— 那一档红是本次改动自己带的),其余判不出的形态
//       一律落**未判定**并逐条点名(既不冒红也不记绿)。
//   R4-OUTLET 唯一出口 `packages/types/src/enum-coerce.ts` 的 `coerceKnownOr` 被摘线或整块消失 ⇒
//       判"尺子失明"**并参与退出码**(只打印不改退出码 = 下一次没人看;同守门 135/144 的规矩)。
//   刻意不做:"兜到初态还是终态"需要 per-enum 终态声明表 = 语义裁决 ⇒ **零判据**,不自建名单、不用
//       名字启发式(把 pending 当"初态"判红会误伤真实业务码)。这一格在结论行里如实报名。
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
//   node scripts/check-error-code-coverage.mjs --strict        # 问责档:R4a 存量按锚点 0 一并问责,
//                                                              #   有未判定 ⇒ exit 2 拒绝出合格证
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
// 遮噪只有这一份实现(§22c / 守门 118:两处各写一遍必然漂开)。本门 R4 要**两遍方向不同的遮噪**:
//   · R4a(判 `as XxxStatus` 直转)用 maskCommentsAndStrings —— 类型断言不住在字符串里,
//     连字符串一起抹是可的,而且必须抹:注释里逐字引用旧写法(HEAD 的 enum-coerce.ts 头注就是这么
//     一句 `as XxxStatus`)若被当代码读,门就会把"解释自己防的是什么"判成仓库违规(守门 131 那一型);
//   · R4b(判 coerceKnownOr 的安全档)**必须保留字符串** —— 要判的那个字面量本身就是字符串,
//     连字符串一起抹等于对 R4b 立项的那一格全盲而账面报"零违规"。
// 两档共用同一台分词器(code-mask 里的 scanSpans),只是取的投影不同。
import { maskComments, maskCommentsAndStrings } from './lib/code-mask.mjs'

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
// R4(G-815963,2026-10-05 加):未知枚举的兜底档必须是"不再产生副作用"那一档
// ---------------------------------------------------------------------------

/**
 * R4 的扫描面:读侧把外部值(数据库行 / HTTP 响应 / 上游 payload)直转成枚举档的两个高发树。
 * 与 R1 的 SCAN_ROOTS **刻意不同面** —— R1 问"产出的错误码在表里没有",R4 问"读进来的枚举值有没有兜底"。
 * 扩面必须先跑一次现读(本门加维度前 HEAD 面 R4a 站点数 = 0,见交付报告),否则新判据一上手就是恒红门。
 */
const R4_SCAN_ROOTS = [
  { dir: 'apps/api/src/db', exts: ['.ts', '.tsx'] },
  { dir: 'packages/shared/src', exts: ['.ts', '.tsx'] },
]

/**
 * R4b 的面比 R4a **宽一棵树**:出口真正被消费的地方是 services(2026-10-10 现读两处
 * `coerceKnownOr(` 都在 `apps/api/src/services/**`,而 R4a 的两棵树里一处都没有)——
 * 只扫 db + shared 时 R4b 恒报"调用点 0",读报告的人会把它当成"没有读侧兜底要做",
 * 而真相是"有兜底、尺子看不见"。R4a 刻意不同步扩:`apps/api/src/services` 现读有 19 处
 * 直转站点(单文件最多 17 处),扩进去当天就会让问责档(`--strict` 锚点按 0)恒红,
 * 那正是本门头注禁止的"新判据一上手就是恒红门";存量清单与不扩的理由写进台账 G-815963。
 */
const R4B_SCAN_ROOTS = [
  ...R4_SCAN_ROOTS,
  { dir: 'apps/api/src/services', exts: ['.ts', '.tsx'] },
]

/** 唯一出口(G-815963 前半已入库)。摘线时本门判"尺子失明"并参与退出码 —— 同守门 135/144 的规矩。 */
const OUTLET_FILE = 'packages/types/src/enum-coerce.ts'
const OUTLET_EXPORT = 'coerceKnownOr'

/**
 * 直转形态:`as ChatMessageStatus` 与两段式 `as unknown as OrderStatus`。
 * 一条合并正则而不是两条,是为了**一次命中只计一个站点** —— 两段式的后半 `as OrderStatus`
 * 单独也能匹配,分两条写会把同一处算成两处,而 R4a 的棘轮锚点按站点数比,重复计数会让
 * "把两段式改成直转"这种无变化看起来像减少违规、反向看起来像新增(守门 134 扩布尔档键时同一课)。
 * 标识符必须以 `Status` 结尾且前面至少有一个字符 ⇒ 裸 `as Status` 不匹配(与票面 `as [A-Za-z]+Status` 同形)。
 */
const CAST_STATUS_RE = /\bas\s+(unknown\s+as\s+)?([A-Za-z_$][\w$]*Status)\b/g

/** 调用点定位:`coerceKnownOr(` —— 带左括号才算调用,`import { coerceKnownOr }` 与声明处不算。 */
const COERCE_CALL_RE = /\bcoerceKnownOr\s*\(/g

/** 安全档字面量:整段就是一个引号串(单/双引号,允许转义)。 */
const STRING_LITERAL_RE = /^(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")$/

/** 安全档是裸标识符时,允许在**同一文件**里把它读成一个字面量(不是第二份名单,是同文件的一处直读)。 */
const IDENT_RE = /^[A-Za-z_$][\w$]*$/

/**
 * 刻意的能力边界(必须写在这里,免得下一个人把"没判"读成"判过了"):
 *   **"兜到初态还是终态"这一维零判据。** 判它需要一张 per-enum 的"哪一档是终态/只读/禁用"声明表,
 *   那是语义裁决;本票不自建第二份名单(登记表必然腐烂,AGENTS §4 对 RN_ONLY_BRAND_KEYS 记过同型),
 *   也不得用启发式猜(把 `pending`/`running` 这类名字当"初态"判红,第一版就会咬到真实业务码)。
 *   R4b 能机械判的只有一件事:**安全档必须是个能读出来的字面量,而且得落在它自己的全集之内**
 *   (第二参写成内联字符串数组时才可判;写成 `as const` 具名元组时,追那张表要跨文件解析 ⇒ 未判定)。
 */

// ---------------------------------------------------------------------------
// 判定面(取材层)—— 原语来自 scripts/lib/face-reader.mjs,这里只剩本门特有的形状适配
// ---------------------------------------------------------------------------

/** exit 2 专用异常:输入取不到 / 清单为空 = "本门没能判定",与"判定为违规"(exit 1)严格分开。
 *  类本体就是共用层的 Undetermined(别名再导出,保持对外导出面与本门测试的 `instanceof` 不变)。 */
export const UndeterminedError = Undetermined

function requireNonEmpty(list, label, scopeDesc) {
  if (list.length === 0)
    throw new UndeterminedError(
      `${label} 在扫描面(${scopeDesc || SCAN_ROOTS.map((s) => s.dir).join(' + ')})枚举到 0 个文件 —— 判据不扫空气,按无法判定处理`,
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
  /** 按根枚举一棵树上的路径(与 R1 共用同一套排除,所以只写一遍)。
   *  `lang` 必须照根描述符传下去 —— R1 的 py 树靠它决定要不要跑常量正则,写死成 ts 就是改 R1 的行为。 */
  function listIn(roots) {
    const out = []
    for (const { dir, exts, lang = 'ts' } of roots) {
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
    return out
  }
  return {
    label,
    listScanFiles() {
      return requireNonEmpty(listIn(SCAN_ROOTS), label)
    },
    listEnumScanFiles() {
      return requireNonEmpty(
        listIn(R4_SCAN_ROOTS),
        label,
        R4_SCAN_ROOTS.map((s) => s.dir).join(' + '),
      )
    },
    listCoerceScanFiles() {
      return requireNonEmpty(
        listIn(R4B_SCAN_ROOTS),
        label,
        R4B_SCAN_ROOTS.map((s) => s.dir).join(' + '),
      )
    },
    fetch,
    read(rel) {
      fetch([rel])
      return contents.get(rel)
    },
    /**
     * "取不到 ⇒ null 而不抛"的那一档,只服务**锚点面**(HEAD 的同一文件)与出口存续性。
     * 判据面照旧用 read() —— 被判的内容取不到必须 exit 2,不得把"少读一个文件"读成"没违规";
     * 而锚点侧的文件在 HEAD 里本就可能不存在(本次新加的文件),那是一条**合法**的锚点 0,不是故障。
     * 出口文件同理:它被删掉时应当由 R4-OUTLET 大声判红,而不是在这里抛出去把整轮结论作废。
     * 存在性与内容走同一个原语(catBatch 的 null),不另立第二份"这个路径在不在面上"的账。
     */
    readIfPresent(rel) {
      const text = catBatch(root, [prefix + rel]).get(prefix + rel)
      return text === null || text === undefined ? null : text
    },
  }
}

function makeWorktreeReader(root) {
  const label = FACE_LABEL.worktree
  function walkIn(roots) {
    const out = []
    for (const { dir, exts, lang = 'ts' } of roots) {
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
          // lang 必须照根描述符传下去(与 git 面的 listIn 同形):R1 的 py 树靠它决定要不要跑
          // 常量正则,写死成 'ts' 就是**改了 R1 的行为** —— 而 worktree 档是人工取证面,
          // 这种偏差不会在提交链上现形,只会在下一次有人用逃生舱时对不上数。
          out.push({ relPath: rel, lang })
        }
      }
      walk(join(root, dir))
    }
    return out
  }
  return {
    label,
    listScanFiles() {
      return requireNonEmpty(walkIn(SCAN_ROOTS), label)
    },
    listEnumScanFiles() {
      return requireNonEmpty(
        walkIn(R4_SCAN_ROOTS),
        label,
        R4_SCAN_ROOTS.map((s) => s.dir).join(' + '),
      )
    },
    listCoerceScanFiles() {
      return requireNonEmpty(
        walkIn(R4B_SCAN_ROOTS),
        label,
        R4B_SCAN_ROOTS.map((s) => s.dir).join(' + '),
      )
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
    /** 与 git 面同名的软读档:出口文件在磁盘上不在 ⇒ null,交给 R4-OUTLET 定性,而不是崩。 */
    readIfPresent(rel) {
      return readWorktreeFile(root, rel)
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
// R4 判据
// ---------------------------------------------------------------------------

/** 行号按"该遍遮噪后的文本"算:两档遮噪都保换行,所以行号与原文一致(列位不保证,故从不报列)。 */
function lineAt(text, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) if (text[i] === '\n') line += 1
  return line
}

/** R4 的文件集:清单与内容同取自判定面。刻意**不吃 --scan-extra 探针** ——
 *  探针是磁盘面,而 R4a 走"该文件 HEAD 自身存量"棘轮,混面会产出与提交无关的假红/假绿。 */
export function collectEnumFiles(reader) {
  const listed = reader.listEnumScanFiles()
  reader.fetch(listed.map((f) => f.relPath))
  return listed.map(({ relPath }) => ({ relPath, src: reader.read(relPath) }))
}

/**
 * R4b 的文件集:比 R4a **宽一棵树**(见 R4B_SCAN_ROOTS 的头注),并按 relPath 去重 ——
 * R4B 由 R4_SCAN_ROOTS 展开而来,若哪天有人往里加一棵与已有根重叠的目录,不去重就会把同一个
 * 调用点数两遍,而"通过 N"是要给人读的量,虚高比漏判更难发现。
 * 读不到 `listCoerceScanFiles` 时退回窄面而不是抛错:镜像与注入式夹具只实现旧的那把清单出口,
 * 让它们当场崩会把"判据变宽"误报成"判据坏了"。
 */
export function collectCoerceFiles(reader) {
  const listed =
    typeof reader.listCoerceScanFiles === 'function'
      ? reader.listCoerceScanFiles()
      : reader.listEnumScanFiles()
  const uniq = []
  const seen = new Set()
  for (const f of listed) {
    if (seen.has(f.relPath)) continue
    seen.add(f.relPath)
    uniq.push(f)
  }
  reader.fetch(uniq.map((f) => f.relPath))
  return uniq.map(({ relPath }) => ({ relPath, src: reader.read(relPath) }))
}

/** R4a 站点提取:遮注释 + 字符串之后的代码面上找 `as XxxStatus` / `as unknown as XxxStatus`。 */
export function extractEnumCastSites(relPath, src) {
  const face = maskCommentsAndStrings(src)
  const sites = []
  for (const m of face.matchAll(CAST_STATUS_RE)) {
    sites.push({
      relPath,
      line: lineAt(face, m.index),
      type: m[2],
      twoStage: Boolean(m[1]),
    })
  }
  return sites
}

/**
 * R4a:读侧直转枚举档。锚点 = **该文件在 HEAD 面自身的站点数**。
 * 为什么必须带棘轮而不是零容忍:HEAD 现读这一族是 0 处(见交付报告的现读命令),但"0"是今天的读数,
 * 不是判据 —— 一旦有人在别人尚未合入的文件里加了一处,当场判红就是与本次改动无关的恒红,
 * 而恒红 blocking 门的唯一结局是各会话 `--no-verify`、连带链上全部守门对该提交作废(AGENTS §12e)。
 * 所以:全量档(判 HEAD)只报数;`--staged` 档拿索引面与 HEAD 锚点比,新增/加回才红。
 */
export function checkEnumCastRatchet(files, { anchorOf, ratcheted }) {
  const sites = []
  for (const f of files) sites.push(...extractEnumCastSites(f.relPath, f.src))
  const byFile = new Map()
  for (const s of sites) {
    if (!byFile.has(s.relPath)) byFile.set(s.relPath, [])
    byFile.get(s.relPath).push(s)
  }
  const problems = []
  const reported = []
  for (const [rel, list] of [...byFile.entries()].sort()) {
    const anchor = ratcheted ? anchorOf(rel) : null
    if (anchor === null) {
      // 没有可比的锚点(全量档 / worktree 逃生舱):如实报数,不冒红也不冒充"已判无违规"
      reported.push(`${rel}(${list.length} 处)`)
      continue
    }
    if (list.length <= anchor) continue
    const where = list.map((s) => `${s.line}:${s.twoStage ? 'as unknown as' : 'as'} ${s.type}`)
    problems.push(
      `R4a ${rel} 把外部值直转成枚举档 ${list.length} 处(HEAD 自身存量 ${anchor})—— ${where.join(' / ')} ` +
        `⇒ 未知值会原样透传;改走 ${OUTLET_FILE} 的 ${OUTLET_EXPORT}(值, 全集, 安全档),安全档逐枚举显式声明为终态/只读/禁用`,
    )
  }
  return { problems, sites, reported }
}

/** 从 `(` 的下标起做括号配平;认引号与模板串,不被字符串里的括号带偏。 */
function matchParen(text, openIndex) {
  let depth = 0
  let i = openIndex
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuote(text, i)
      if (i < 0) return -1
      continue
    }
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return i
    }
    i += 1
  }
  return -1
}

/** 跳到引号串结束之后的下标;串未闭合返回 -1。 */
function skipQuote(text, start) {
  const q = text[start]
  let i = start + 1
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2
      continue
    }
    if (text[i] === q) return i + 1
    i += 1
  }
  return -1
}

/** 顶层逗号切分实参:嵌套 ()/[]/{} 与字符串内部的逗号不算分隔。 */
function splitTopLevelArgs(inner) {
  if (inner.trim() === '') return []
  const parts = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipQuote(inner, i)
      if (end < 0) return null // 串未闭合 ⇒ 参数边界判不出
      cur += inner.slice(i, end)
      i = end - 1
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1
    if (depth === 0 && ch === ',') {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
    if (depth < 0) return null // 括号形状不对,不猜
  }
  parts.push(cur.trim())
  return parts
}

/** 第二参写成内联字符串数组时,把它的成员读出来(唯一能在不建名单的前提下判"安全档 ∈ 全集"的形态)。 */
function inlineStringArray(text) {
  const t = (text || '').trim()
  if (!t.startsWith('[') || !t.endsWith(']')) return null
  const inner = t.slice(1, -1)
  const items = []
  for (const piece of splitTopLevelArgs(inner) || []) {
    const m = STRING_LITERAL_RE.exec(piece)
    if (!m) return null // 数组里混了非字面量 ⇒ 全集读不出,不猜
    items.push(m[1] ?? m[2])
  }
  return items
}

/** 在同一文件里把一个标识符读成字面量(`const SAFE = 'cancelled'`)。这是同文件直读,不是第二份登记表。 */
function resolveLocalLiteral(src, ident) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${ident}\\s*(?::[^=\\n]+)?=\\s*(['"])([^'"]*)\\1`)
  const m = re.exec(src)
  return m ? m[2] : null
}

/**
 * R4b:`coerceKnownOr(` 调用点的安全档必须**显式给且读得出来**。三态绝不并桶:
 *   ok         —— 第三参是字面量(或本文件可解析成字面量的常量),且(第二参是内联数组时)在集合内;
 *   red        —— 第三参是字面量、第二参是内联字符串数组、而它不在全集里 ⇒ 兜底值落在枚举外,
 *                 与"不直转"的初衷相反(这条机械可判,零容忍、不吃棘轮);
 *   undetermined —— 缺第三参 / 括号配平不到 / 第三参是需要跨文件才知道的那张表。
 * 为什么"缺第三参"落未判定而不是判红:票面把这一形态写成"既不冒红也不记绿"的点名项,而 TS 侧
 * `safe: T` 是必填形参 ⇒ 少参在 `tsc` 那侧已经是硬错误,本门重复判红只会把同一件事计两遍;
 * 反过来把它写成未判定并**逐条点名**,才是"这一格本门没判"的诚实说法。
 */
export function checkCoerceSafeArg(files) {
  const ok = []
  const red = []
  const undetermined = []
  for (const f of files) {
    const face = maskComments(f.src) // 保留字符串:安全档本身就是字符串字面量
    for (const m of [...face.matchAll(COERCE_CALL_RE)]) {
      const line = lineAt(face, m.index)
      const openIndex = face.indexOf('(', m.index)
      const close = openIndex < 0 ? -1 : matchParen(face, openIndex)
      const at = `${f.relPath}:${line}`
      if (close < 0) {
        undetermined.push({
          at,
          why: '括号配平不到(正则字面量或未闭合字符串在 R4b 这一遍是可见的)',
        })
        continue
      }
      const args = splitTopLevelArgs(face.slice(openIndex + 1, close))
      if (!args) {
        undetermined.push({ at, why: '实参边界切不出来(嵌套形状超出本判据)' })
        continue
      }
      if (args.length < 3) {
        undetermined.push({ at, why: `只给出 ${args.length} 个实参,第三参(安全档)取不出` })
        continue
      }
      const thirdRaw = args[2]
      const lit = STRING_LITERAL_RE.exec(thirdRaw)
      let safe = lit ? (lit[1] ?? lit[2]) : null
      if (!lit && IDENT_RE.test(thirdRaw)) {
        safe = resolveLocalLiteral(face, thirdRaw)
        if (safe === null) {
          undetermined.push({
            at,
            why: `安全档是变量 ${thirdRaw},本文件读不出那张表 ⇒ 需要 per-enum 终态声明,本门不猜`,
          })
          continue
        }
      }
      if (safe === null) {
        undetermined.push({
          at,
          why: `安全档形态判不出(${thirdRaw.slice(0, 40) || '空'})`,
        })
        continue
      }
      const known = inlineStringArray(args[1])
      if (known && !known.includes(safe)) {
        red.push(
          `R4b ${at} 的安全档 '${safe}' 不在它自己的全集 [${known.join(', ')}] 之内 —— ` +
            '兜底值落在枚举外,与「as XxxStatus」直转同害(零容忍,不吃棘轮)',
        )
        continue
      }
      ok.push({ at, safe, domainChecked: Boolean(known) })
    }
  }
  return { ok, red, undetermined }
}

/**
 * 出口存续性:`packages/types/src/enum-coerce.ts` 必须真的导出 coerceKnownOr。
 * 出口被摘线时**判红并参与退出码** —— 只打印不改退出码 = 下一次没人看(守门 135/144 同一条规矩)。
 * 文件整体不在面上 ⇒ null ⇒ 同样判红并点名,因为"唯一出口消失了"正是本维要防的失效型。
 */
export function checkOutletLiveness(text) {
  if (text === null)
    return [
      `R4-OUTLET 唯一出口 ${OUTLET_FILE} 在被审面上取不到 —— 出口没了,R4 判据对这一型失明(尺子失明即红)`,
    ]
  const exported =
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${OUTLET_EXPORT}\\b`).test(text) ||
    new RegExp(`export\\s+(?:const|let)\\s+${OUTLET_EXPORT}\\b`).test(text) ||
    new RegExp(`export\\s*\\{[^}]*\\b${OUTLET_EXPORT}\\b[^}]*\\}`).test(text)
  return exported
    ? []
    : [
        `R4-OUTLET ${OUTLET_FILE} 不再导出 ${OUTLET_EXPORT}() —— 出口被摘线,R4 的修复出口不存在(尺子失明即红)`,
      ]
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * R4 的一条取材纪律:锚点面**永远是 HEAD**,与判定档无关。
 *   · 判 `--staged`(索引)⇒ 判据面与锚点面是两个不同的面,这是棘轮的定义(同守门 152 的
 *     "--staged 档比 HEAD"),锚点侧文件在 HEAD 不存在 ⇒ 锚点 0(新文件的正当形态),不判"无法判定"。
 *   · 判 HEAD / worktree ⇒ 没有独立锚点可比(自己减自己恒 0),所以只报数不判红。
 * 两档不得混成一个"随便取个数"的循环:把 HEAD 当成被审内容来判,就等于把上一次提交的红
 * 天天重判一遍(恒红门,§12e)。
 */
function buildAnchorProvider(root) {
  const anchorReader = makeFaceReader('head', root)
  const cache = new Map()
  return (rel) => {
    if (cache.has(rel)) return cache.get(rel)
    const src = anchorReader.readIfPresent(rel)
    const n = src === null ? 0 : extractEnumCastSites(rel, src).length
    cache.set(rel, n)
    return n
  }
}

export function runChecks({ root = ROOT, face = 'head', extraFiles = [], strict = false } = {}) {
  const reader = makeFaceReader(face, root)
  const files = collectFiles(reader, extraFiles, root)
  const scanned = scanErrorCodes(files)
  const catalog = parseCatalog(reader.read(CATALOG_FILE))
  const messages = readCatalogMessages(
    reader.read(MESSAGE_FILE),
    `${reader.label} 的 ${MESSAGE_FILE}`,
  )
  // —— R4(G-815963):枚举兜底档 ——
  const enumFiles = collectEnumFiles(reader)
  // 问责档(--strict)与提交链的差别只有一处:缺省的全量/工作树档对"该文件 HEAD 自身存量"**只报数**,
  // 而 --strict 把锚点当 0 问责(这一族站点本来就该是 0 处,存量也是债,该有人清偿)。
  // 这不新增恒红面:提交链的注册条目 args 为空(runner 现值),拿不到 --strict;
  // 次序同守门 117 —— 先现读存量归零,再谈把问责档挂进提交链,而不是反过来。
  const ratcheted = face === 'staged' || strict
  // 问责档只把**全量/工作树面**的锚点收成 0(存量一并问责);`--staged` 面的锚点照旧是"该文件 HEAD
  // 自身存量" —— 棘轮语义不因为多带一枚旗就变严,否则同一次提交会被"别人欠的 + 我加的"混成一堆红。
  // 两档共用同一条 --strict 后果:有未判定 ⇒ 拒绝出具合格证(exit 2)。
  const anchorOf = face === 'staged' ? buildAnchorProvider(root) : () => (strict ? 0 : null)
  // 锚点从哪儿来必须跟着读数一起说:三种模式的红含义不同(别人的存量 / 本次加回来 / 问责存量),
  // 印成同一句话就会让读报告的人把"这次新加的一处"读成"别人欠的债"。
  const anchorMode =
    face === 'staged'
      ? '锚点面=HEAD 自身存量,棘轮生效'
      : strict
        ? '问责档:锚点按 0(存量也问责)'
        : '全量/工作树档:存量只报数,不判红'
  const cast = checkEnumCastRatchet(enumFiles, { anchorOf, ratcheted })
  // R4b 用宽面:出口的消费点住在 services,而 R4a 的两棵树里一处都没有(见 R4B_SCAN_ROOTS 头注)。
  const coerceFiles = collectCoerceFiles(reader)
  const coerce = checkCoerceSafeArg(coerceFiles)
  const outlet = checkOutletLiveness(reader.readIfPresent(OUTLET_FILE))
  const problems = [
    ...checkCoverage(scanned, catalog),
    ...checkClasses(catalog),
    ...checkNoFallback(catalog, messages),
    ...cast.problems,
    ...coerce.red,
    ...outlet,
  ]
  // 读的哪一面必须自己说出来:口径不写出来,下一次诊断又要从头猜。
  return {
    problems,
    scanned,
    catalog,
    files: files.length,
    face: reader.label,
    r4: {
      enumFiles: enumFiles.length,
      castScope: R4_SCAN_ROOTS.map((s) => s.dir).join(' + '),
      castSites: cast.sites.length,
      castReported: cast.reported,
      ratcheted,
      anchorMode,
      strict,
      coerceFiles: coerceFiles.length,
      coerceScope: R4B_SCAN_ROOTS.map((s) => s.dir).join(' + '),
      coerceOk: coerce.ok.length,
      coerceUndetermined: coerce.undetermined,
      outletProblems: outlet.length,
    },
  }
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

  // —— R4a(G-815963):读侧直转枚举档 —— 成对正反例 ——
  const castFile = (src) => [{ relPath: 'packages/shared/src/db/x.ts', src }]
  const straight = 'const s = (row.status ?? "") as ChatMessageStatus\n'
  t(
    'R4a 咬住代码面的 as ChatMessageStatus(阳性:注入必被认出)',
    extractEnumCastSites('a.ts', straight).some((s) => s.type === 'ChatMessageStatus'),
  )
  t(
    'R4a 不咬同一形态只写在注释里(门不得把自己立项那一型的说明判成仓库违规)',
    extractEnumCastSites('a.ts', `// 旧写法:${straight.trim()}\n`).length === 0,
  )
  t(
    'R4a 不咬字符串字面量里的同名散文(类型断言不住在字符串里)',
    extractEnumCastSites('a.ts', 'const doc = "cast it as ChatMessageStatus please"\n').length ===
      0,
  )
  const twoStage = extractEnumCastSites('a.ts', 'const s = raw as unknown as OrderStatus\n')
  t(
    'R4a 认两段式 as unknown as,且**一次命中只计一个站点**(分两条写会让棘轮锚点虚高)',
    twoStage.length === 1 && twoStage[0].twoStage === true,
  )
  t(
    'R4a 不吃裸 as Status(标识符必须以 Status 结尾且前面有字符,与票面 as [A-Za-z]+Status 同形)',
    extractEnumCastSites('a.ts', 'const s = x as Status\n').length === 0,
  )
  // 棘轮三态:锚点面 = 该文件 HEAD 自身存量
  const oneSiteFiles = castFile(straight)
  t(
    'R4a 棘轮:索引 1 处 / HEAD 锚点 1 处 ⇒ 不判红(存量不是本次的债)',
    checkEnumCastRatchet(oneSiteFiles, { anchorOf: () => 1, ratcheted: true }).problems.length ===
      0,
  )
  t(
    'R4a 棘轮:索引 2 处 / HEAD 锚点 1 处 ⇒ 判红并点名文件(把同一型加回来才是新增)',
    checkEnumCastRatchet(castFile(straight + straight), {
      anchorOf: () => 1,
      ratcheted: true,
    }).problems.some((p) => p.includes('R4a') && p.includes('packages/shared/src/db/x.ts')),
  )
  t(
    'R4a 棘轮:新文件锚点 0 ⇒ 一处即红(锚点取不到不等于免检)',
    checkEnumCastRatchet(oneSiteFiles, { anchorOf: () => 0, ratcheted: true }).problems.length ===
      1,
  )
  t(
    'R4a 全量档(判 HEAD)只报数不判红 —— 否则同一条红每天重判一遍,就是恒红门(§12e)',
    (() => {
      const r = checkEnumCastRatchet(oneSiteFiles, { anchorOf: null, ratcheted: false })
      return r.problems.length === 0 && r.reported.length === 1
    })(),
  )

  // —— R4b:coerceKnownOr 调用点的安全档 —— 三态不并桶 ——
  const coerceRun = (src) => checkCoerceSafeArg(castFile(src))
  const missThird = coerceRun('const v = coerceKnownOr(row.status, DEMO_STATUSES)\n')
  t(
    'R4b 缺第三参 ⇒ 落「未判定」并逐条点名(既不冒红也不记绿)',
    missThird.red.length === 0 &&
      missThird.ok.length === 0 &&
      missThird.undetermined.length === 1 &&
      missThird.undetermined[0].why.includes('第三参'),
  )
  const withThird = coerceRun("const v = coerceKnownOr(row.status, DEMO_STATUSES, 'cancelled')\n")
  t(
    'R4b 补上第三参字面量 ⇒ 不再计未判定(同一条夹具只差那一参 ⇒ 差的就是判据的牙)',
    withThird.undetermined.length === 0 && withThird.ok.length === 1,
  )
  const varSafe = coerceRun('const v = coerceKnownOr(row.status, DEMO_STATUSES, SAFE_STATUS)\n')
  t(
    'R4b 安全档是变量且本文件读不出那张表 ⇒ 未判定(不猜、也不放行)',
    varSafe.undetermined.length === 1 && varSafe.red.length === 0,
  )
  const varResolvable = coerceRun(
    "const SAFE_STATUS = 'cancelled'\nconst v = coerceKnownOr(row.status, DEMO_STATUSES, SAFE_STATUS)\n",
  )
  t(
    'R4b 同文件把该常量写成字面量 ⇒ 认它(同文件直读,不是第二份 per-enum 登记表)',
    varResolvable.undetermined.length === 0 && varResolvable.ok.length === 1,
  )
  const outOfDomain = coerceRun(
    "const v = coerceKnownOr(raw, ['completed', 'cancelled'], 'admitted')\n",
  )
  t(
    'R4b 安全档不在它自己的内联全集 ⇒ 判红(兜底值落在枚举外,和直转同害)',
    outOfDomain.red.length === 1 && outOfDomain.red[0].includes('R4b'),
  )
  const inDomain = coerceRun(
    "const v = coerceKnownOr(raw, ['completed', 'cancelled'], 'cancelled')\n",
  )
  t(
    'R4b 安全档在内联全集内 ⇒ 通过且带 domainChecked',
    inDomain.ok.length === 1 && inDomain.ok[0].domainChecked === true,
  )
  t(
    'R4b 括号配平不到 ⇒ 未判定,绝不静默丢弃也不判红',
    coerceRun('const v = coerceKnownOr(a, (b, )\n').undetermined.length === 1,
  )
  t(
    'R4b 不吃 import 与注释里的提及(mobile-rn 那份 __mocks__ 的注释就是这一型)',
    coerceRun(
      'import { coerceKnownOr } from "@ihui/types"\n// coerceKnownOr( 只是散文\nconst x = 1\n',
    ).ok.length === 0,
  )
  t(
    'R4b 刻意不判"兜到初态还是终态":安全档取初态且在全集内 ⇒ 不判红(那需要 per-enum 终态表,本票不自建名单、不用启发式猜)',
    (() => {
      const r = coerceRun("const v = coerceKnownOr(raw, ['pending', 'done'], 'pending')\n")
      return r.red.length === 0 && r.undetermined.length === 0
    })(),
  )

  // —— 出口存续性:摘线必须参与退出码,不得只打印 ——
  t(
    'R4-OUTLET 出口被摘线(文件在、导出不见)⇒ 判红并进问题清单',
    checkOutletLiveness('export function somethingElse(a, b, c) { return a }\n').length === 1,
  )
  t(
    'R4-OUTLET 出口文件整块消失 ⇒ 同样判红并点名(取不到不等于没违规)',
    checkOutletLiveness(null).some((p) => p.includes('R4-OUTLET') && p.includes(OUTLET_FILE)),
  )
  t(
    'R4-OUTLET 认 function / const / 再导出三种声明形态(判据必须覆盖门自己产出的形态)',
    [
      'export function coerceKnownOr(a, b, c) { return c }',
      'export const coerceKnownOr = (a, b, c) => c',
      "export { coerceKnownOr } from './x.js'",
    ].every((s) => checkOutletLiveness(s).length === 0),
  )

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
  // R4 的三条"现状"必须各判一件事:枚举面非空 / 出口在位 / 全量档不因存量判红。
  // 刻意不断言"HEAD 站点数 == 0" —— 那一维在存量非零那天会把自检变成恒红(与本次改动无关的红)。
  t('R4 枚举扫描面非空(两棵树真的在面上,不是枚举到 0 而后报绿)', live.r4.enumFiles > 50)
  t(
    'R4 唯一出口在 HEAD 面上真的导出(出口摘线时本门会判红,自检先证明它现在没红)',
    live.r4.outletProblems === 0,
  )
  t(
    'R4 全量档对存量只报数:HEAD 面直转站点哪怕 >0 也不得进 problems(否则每次提交被逼 --no-verify)',
    live.problems.every((p) => !p.startsWith('R4a')),
  )
  // —— R4b 的射程(G-815963 续):"造好没装车"是这一族最常见的死法,所以先证"宽面真的接到了判据上"。
  // 旧自检只把 src 喂 checkCoerceSafeArg(它收文件数组),于是"清单从哪来"这一维**没有任何用例** ——
  // 把 runCheck 里的入参写回 enumFiles,自检照样全绿而读数永久是 0。
  {
    const narrowSrc = 'export const x = 1\n'
    const wideSrc = "const v = coerceKnownOr(row.status, ['active', 'closed'], 'closed')\n"
    const fakeReader = {
      label: '构造面',
      fetch() {},
      read: (rel) => (rel.endsWith('narrow.ts') ? narrowSrc : wideSrc),
      listEnumScanFiles: () => [{ relPath: 'apps/api/src/db/narrow.ts' }],
      listCoerceScanFiles: () => [
        { relPath: 'apps/api/src/db/narrow.ts' },
        { relPath: 'apps/api/src/services/wide.ts' },
        { relPath: 'apps/api/src/services/wide.ts' }, // 根重叠:同一文件不得数两遍
      ],
    }
    const wideRun = checkCoerceSafeArg(collectCoerceFiles(fakeReader))
    t(
      'R4b 真的读宽面(窄面 0 处、宽面 1 处 ⇒ 必须数到 1;并且重复根不得把同一调用点数两遍)',
      wideRun.ok.length === 1 && wideRun.red.length === 0 && wideRun.undetermined.length === 0,
    )
    const legacyRun = collectCoerceFiles({
      label: '构造面',
      fetch() {},
      read: () => wideSrc,
      listEnumScanFiles: () => [{ relPath: 'apps/api/src/db/narrow.ts' }],
    })
    t(
      'R4b 对只实现窄清单出口的 reader 退回窄面而不是抛错(注入式夹具不得被"扩面"当成判据坏了)',
      legacyRun.length === 1,
    )
  }
  t(
    'R4b 射程含 services 而 R4a 不含(这是分工不是疏忽:同步扩 R4a 会让问责档当场变恒红门)',
    R4B_SCAN_ROOTS.some((s) => s.dir === 'apps/api/src/services') &&
      !R4_SCAN_ROOTS.some((s) => s.dir === 'apps/api/src/services'),
  )
  t(
    'R4b 宽面在真判定面上确实被**判据**消费(HEAD 现读两处读侧兜底调用点都在 services:' +
      'agent-runtime/session-store.ts 与 clawdbot/session-manager.ts ⇒ 通过数必须 ≥2;' +
      '只报 coerceFiles 数量而不判它,读数会显示"扫到了"而判据仍在看窄面)。' +
      '出口条件:若哪天这两处被迁走导致归零,要改的是这条断言的期望值并写下新消费点,不得删断言',
    live.r4.coerceOk >= 2,
  )
  // 问责档的接线必须被证明"真的传到了",而不是只写在 main 里 —— 用与全量档同一份数据比:
  // 今天 HEAD 零站点,所以两档都该是 0 条 R4a 红;差值只在锚点(0 vs null),那条差值由
  // 上面"新文件锚点 0 ⇒ 一处即红"那条构造面用例证明有牙(全量档走的就是这一支)。
  t(
    '--strict 全量档同样零违规(HEAD 现读零站点 ⇒ 问责档不凭空造红),且锚点模式真的换成问责档',
    (() => {
      const strictLive = runChecks({ strict: true })
      return (
        strictLive.r4.strict === true &&
        strictLive.r4.anchorMode.includes('问责档') &&
        strictLive.problems.every((p) => !p.startsWith('R4a'))
      )
    })(),
  )

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

    const strict = argv.includes('--strict')
    const { problems, scanned, catalog, files, face, r4 } = runChecks({
      face: pickFace(argv),
      extraFiles,
      strict,
    })
    // R4 的三态必须各说各的:把"没判"写成"判过了"是本仓最高频的失效型。
    // R4a 与 R4b 现在**扫的不是同一批文件**,所以两个数各自带自己的面 —— 印成"扫 N 个文件 ·
    // 调用点通过 M"会让人以为 M 是从 N 里数出来的,而那是两把不同射程的尺子。
    const r4line =
      `R4 枚举兜底:R4a 扫 ${r4.enumFiles} 个文件(${r4.castScope}) · 直转站点 ${r4.castSites} 处(${r4.anchorMode}) · ` +
      `R4b 扫 ${r4.coerceFiles} 个文件(${r4.coerceScope}) · coerceKnownOr 调用点 通过 ${r4.coerceOk} / 未判定 ${r4.coerceUndetermined.length} · 出口摘线 ${r4.outletProblems}`
    const r4detail = [
      ...r4.castReported.map((s) => `   · R4a 存量只报数:${s}`),
      ...r4.coerceUndetermined.map((u) => `   · R4b 未判定:${u.at} —— ${u.why}`),
    ]
    if (problems.length === 0) {
      console.log(
        `✅ 错误码覆盖率通过(判定面:${face}):扫 ${files} 个文件,产出 ${scanned.length} 个 errorCode,` +
          `catalog ${catalog.entries.length} 条全覆盖,八类齐全,零「未知错误」兜底`,
      )
      console.log(`   ${r4line}`)
      for (const line of r4detail) console.log(line)
      if (r4detail.length > 0) {
        console.log(
          '   ⚠️ 以上「未判定」不是「已确认没问题」——逐条需要人工或语义裁决(本门不建 per-enum 终态表)',
        )
        // 问责档:把"未判定"当合格证交出去,等于把没看清写成没问题(守门 94/103/118 同一条禁令)。
        if (strict) {
          console.log('   --strict:有未判定 ⇒ exit 2,拒绝出具合格证')
          return 2
        }
      }
      return 0
    }
    console.error(`❌ 错误码覆盖率发现 ${problems.length} 处问题(判定面:${face}):`)
    console.error(`   ${r4line}`)
    for (const line of r4detail) console.error(line)
    for (const p of problems) console.error(`   · ${p}`)
    console.error(`\n唯一真源:${CATALOG_FILE}`)
    console.error(
      '改法:在 ERROR_CODE_CATALOG 补一行,并同步 packages/i18n/messages/web/*.json 五语言词包',
    )
    console.error(
      `     枚举兜底(R4)的改法:改走 ${OUTLET_FILE} 的 ${OUTLET_EXPORT}(值, 全集, 安全档),安全档逐枚举显式声明为终态/只读/禁用`,
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
  collectEnumFiles,
  collectCoerceFiles,
  extractEnumCastSites,
  checkEnumCastRatchet,
  checkCoerceSafeArg,
  checkOutletLiveness,
  makeFaceReader,
  runChecks,
  CATALOG_FILE,
  MESSAGE_FILE,
  OUTLET_FILE,
  R4_SCAN_ROOTS,
  R4B_SCAN_ROOTS,
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
