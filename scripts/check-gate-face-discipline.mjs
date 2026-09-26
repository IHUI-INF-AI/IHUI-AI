#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:门脚本的取材面纪律对账(新增判据必须走统一取材层,存量只报数)
//
// 在修什么(2026-09-25 立,第八批吸收线):
//   本仓的守门里有相当一部分**按磁盘判**(`readFileSync(join(ROOT, …))` / `git show` 散写),
//   而 AGENTS §4/§12 反复实测到"共享工作树常年滞后 HEAD" —— 按磁盘判的门会在恒红/假绿之间
//   来回跳,并且会把错的计数写回棘轮基线(守门 83 一天内 R3 登记被整文件回退三次即此型)。
//   统一出口是 `scripts/lib/face-reader.mjs`(全量判 HEAD blob / `--staged` 判索引 blob /
//   取不到 ⇒ exit 2「无法判定」)。实测现走它的是 26 道门,而"读内容却没走它"的有 122 道。
//
// 为什么不一次收紧、也不建豁免清单:
//   ① 当场把 122 道判红就是一台恒红门,唯一结局是各会话 `--no-verify` 连带废掉全部守门
//      (§12e、守门 77/83 同一条教训);
//   ② 手工白名单必然腐烂(守门 77 对 `RN_ONLY_BRAND_KEYS` 的教训)。
//   所以判据锚在**"这次改动"**上:一枚提交如果**新增**了一道按磁盘判的门,或**改**了一道
//   门并把它的取材方式退回散写,就红;存量门不去碰它就只报数。这是结构上的棘轮,
//   不需要清单,也不会因为别人欠债把无关提交钉红。
//
// 四种形态(判据只在能肯定时才判红,宁漏不误报):
//   git 面散写   ⇒ 判红(点名 `cat-file` / `gitRaw(… 'show' …)` / `--batch`)
//   磁盘面散写   ⇒ 判红(`readFileSync(` 且同文件出现 `join(ROOT` / `resolve(ROOT` 这类仓库锚点)
//   磁盘面**预拼常量** ⇒ 判红(锚点被拼进模块作用域的 `const <UPPER_SNAKE>` 里,readFileSync 现场
//                  看不见 ROOT ⇒ 原判据把这一型读成 no-content;2026-09-26 补,见 prejoinedRepoConsts)
//   只读临时夹具 ⇒ **不计违规也不判红**,归入"未判定"如实报数(它读的不是仓库内容,判红是误伤)
//
// 手动:
//   node scripts/check-gate-face-discipline.mjs            # 全量档:只报数,恒 exit 0(除脚本自身异常)
//   node scripts/check-gate-face-discipline.mjs --staged   # 提交链:改到的门必须走取材层
//   node scripts/check-gate-face-discipline.mjs --self-test
// 紧急跳过:HUSKY_SKIP_GATE_FACE_DISCIPLINE=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
// 遮噪**不复用** `check-compaction-denominator.mjs` 的 `markHidden`:那一档连字符串一起抹,
// 而本门要区分"模块说明符 / git 动词是字符串"(必须保留)与"readFileSync 是调用"(必须抹字符串)。
// 两处判的不是同一件事 —— 下面 maskComments / blankStrings 各管一层。曾经 import 着却没用,
// eslint 的 no-unused-vars 把每一个碰这个文件的人挡在提交链外(HEAD 里躺了几轮没人发现)。

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_GATE_FACE_DISCIPLINE'
export const GATE_GLOB = /^scripts\/(check|scan|guard)[^/]*\.mjs$/
/** 本门自己与取材层必然出现这些标识符(判据模式串),按文件名前缀跳过 */
const SELF_EXEMPT = ['scripts/check-gate-face-discipline.mjs', 'scripts/lib/face-reader.mjs']
const GIT_TIMEOUT = 120000

/** 只是"引了这层"的证据 —— **不再单独构成合规**(判序见 classify) */
const FACE_IMPORT_RE = /from\s*['"][^'"]*lib\/face-reader\.mjs['"]/
/**
 * 走统一取材层的**真**证据:调用这层的读取入口取过内容。只认这两个,是因为 face-reader 的其余导出
 * **不产生内容**:`selectFace` 只选面、`gitBinary` 只给二进制路径、`gitErrText`/`assertRepoRoot` 是错误与
 * 前置检查、`catBatchOids`/`catBatchSizes`/`catBatchCheck` 拿的是 oid/尺寸而不是正文。把门面函数当成
 * 读取凭证,等于给"引了层却自己 git show 读内容"那种形态发通行证 —— 实测 HEAD 面有 6 道门 import 了
 * 层而不走层读内容。命名空间形态(`face.catBatch(`)同视,否则新判据会对合法写法产假阳。
 */
const LAYER_READ_RE =
  /(?:^|[^.\w$])(?:catBatch|readWorktreeFile)\s*\(|[A-Za-z_$][\w$.]*\.(?:catBatch|readWorktreeFile)\s*\(/
/**
 * 层的读取入口。**必须解析 import 子句里的局部名** —— 只认字面 `catBatch(` 会把合法写法误伤:
 * `import { catBatch as readBlobs }` 之后调 `readBlobs(` 同样是走层(别名与多行导入是 ESM 常见形态,
 * 而"判据看不见门自己允许的写法"本仓记过多次:77 B6 只认点号、门 74 只认对象词表)。
 */
const LAYER_READ_ENTRIES = ['catBatch', 'readWorktreeFile']
const LAYER_CLAUSE_RE = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*lib\/face-reader\.mjs['"]/gs
const LAYER_NS_RE =
  /import\s*\*\s*as\s*([A-Za-z_$][\w$]*)\s*from\s*['"][^'"]*lib\/face-reader\.mjs['"]/g

/** 这道文件是否**真的**用层的读取入口取过内容(含别名 / 命名空间形态)。纯函数,构造面可证。 */
export function usesLayerRead(code) {
  if (LAYER_READ_RE.test(code)) return true
  const names = new Set()
  for (const m of code.matchAll(LAYER_CLAUSE_RE)) {
    for (const raw of m[1].split(',')) {
      const spec = raw.trim()
      if (!spec) continue
      const parts = spec.split(/\s+as\s+/)
      const imported = parts[0].trim()
      const local = (parts[1] || parts[0]).trim()
      if (LAYER_READ_ENTRIES.includes(imported)) names.add(local)
    }
  }
  for (const n of names) if (new RegExp(`(?:^|[^.\\w$])${n}\\s*\\(`).test(code)) return true
  for (const ns of code.matchAll(LAYER_NS_RE)) {
    for (const e of LAYER_READ_ENTRIES)
      if (new RegExp(`${ns[1]}\\.${e}\\s*\\(`).test(code)) return true
  }
  return false
}
/**
 * 散写 git 内容读取的**结构**特征:以 git 为可执行程序派生,且参数里带内容类动词。
 * 刻意要求"同一处调用里两者都在"(`GIT_SPAWN_RE` 与内容动词在同一段 120 字符窗口内),
 * 否则注释、字符串夹具、以及把动词拼进变量的间接调用都会被当成散写(误伤)。
 */
const GIT_SPAWN_RE =
  /(?:execFileSync|execSync|spawnSync|spawn)\s*\(\s*(?:GIT_BIN|gitPath|gitBinary\s*\(\s*\)|['"]git['"])/
// 层的 transport 被拿来自己读内容(`gitRaw(['show', …])`)同样是散写 —— 管子共用不等于面共用。
const GIT_RAW_RE = /\bgitRaw\s*\(/
/**
 * **"读内容"与"枚举"必须分开**,否则判据会把自己立项的口径说歪:本门守的是"判内容取哪个面",
 * 而 `cat-file -e`(存在性)、`ls-tree --name-only`(路径清单)、`rev-list` / `merge-base` / `rev-parse`
 * (提交图)都**不产生 blob 正文**。把它们算成"散写读内容"有两个后果:① 给一道只是枚举文件清单的
 * 门发违规(误伤 ⇒ 逼人绕钩子);② 更要紧的是让"读内容"这个词在报告里失去含义 —— 数字看着多,
 * 其实一格真缺陷都没有。2026-09-26 实测:`check-merge-addition-loss.mjs` 被上一版算成半接线,
 * 它全部 git 调用是 `cat-file -e` / `ls-tree --name-only` / `rev-list`,**没有一处读 blob**。
 */
const GIT_ENUM_ONLY_CALL_RE =
  /'cat-file'\s*,\s*'-e'|'ls-tree'[^)]*?--name-only|'grep'[^)]*?-l|'rev-list'|'rev-parse'|'merge-base'|'symbolic-ref'|'name-rev'/g
const GIT_BLOB_ARG_RE = /['"]cat-file['"]|['"]show['"]|--batch(?!-check)|'cat-file-prompt'/
/** 纯函数:遮噪后的源码里有没有"取 blob 正文"的 git 用法(枚举类调用先剔除)。 */
export function gitContentReads(maskedCode) {
  return GIT_BLOB_ARG_RE.test(maskedCode.replace(GIT_ENUM_ONLY_CALL_RE, ' '))
}
/**
 * 仓库锚点**只认大写 `ROOT`**,这是刻意为之而不是判据漏风(2026-09-26 试过再放宽,数据否决):
 * 把 `join(root, …)` / `join(repoRoot, …)` 也算锚点后,`loose` 从 74 涨到 93,而新增里两格是**假阳** ——
 * `check-merge-addition-loss.mjs` 读的是 `.workbuddy/…-audited.json`(被 gitignore 的运行台账,
 * 结构上没有"面"可言),`check-prod-bundle-shadow.mjs` 读的更是**按设计只存在于部署机**的忽略副本
 * (它的退出码为此专门分了三态)。把"读状态文件"判成"按磁盘判仓库内容",就是把一条好判据做成恒红门。
 * 代价如实登记:小写模块根 + 读盘的门会落进 `unknown`(全量档 16 道),而 `unknown` 不判红 ——
 * 这是**已知判据空档**,不是"没有违规"。补它需要能区分"读被审内容"与"读运行态",那要求判据
 * 认识 gitignore 语义(见 `check-prod-bundle-shadow` 的 S2 判据),不是一行正则的事。
 */
const FS_LOOSE_RE = /readFileSync\s*\(/
/**
 * 仓库锚点 = **ROOT 出现在路径拼装调用里**。旧写法还带一条 `|\bROOT\s*,`,它会把
 * `function audit(limit = 400, cwd = ROOT, p = …)` 这种"把仓库根当默认实参传下去"的形状
 * 当成锚点,于是 `check-merge-addition-loss.mjs` 被判成半接线 —— 而它 git 侧只做
 * `cat-file -e`(存在性)与 `ls-tree --name-only`(路径清单),**一处 blob 都没读**。
 * 判据的口径写歪一格,报告里就多一格假缺陷,而且假阳比漏报更贵:它会让人去"修"没坏的东西。
 * 代价如实登记:锚在路径函数上的写法(join(pathmod, ROOT) 之后自己拼)会落到 `unknown`。
 */
const REPO_ANCHOR_RE = /(?:join|resolve|normalize|dirname|isAbsolute)\s*\([^)]{0,40}\bROOT\b/
/**
 * 曾在本票里试过给上面那条合取加一道"内容限定"否决(只有当文件里的路径字面量**全部**指向
 * 未跟踪位置时才免判)。现读数据否决了它,两种错都犯:
 *  - **该否决的没否决**:`check-artifact-budget.mjs`(唯一真正的产物门)里有一条 `app.json`,
 *    它按根级被跟踪文件的形状被判成"指向被跟踪内容"⇒ 门照常红;
 *  - **不该否决的全否决**:`check-no-divider` / `check-file-size` / `check-pwsh-version` /
 *    `check-portal-fixed` 等 **14 道**盘判的门,其路径全部动态拼(`join(ROOT, rel)`,清单来自
 *    `git ls-files`),字面量里只剩 `.tsx`/`.css` 这类扩展名 ⇒ 被判成"只读未跟踪位置"⇒ 红没了。
 * 教训:**"读被审内容 vs 读机器态"不能靠字面量猜** —— 这条判据要成立必须认识 gitignore 语义
 * (参照 `check-prod-bundle-shadow` 的 S2:哪一侧按设计只存在于部署机),那不是一行正则的事。
 * 因此本文件维持原判据形状,并把那一格**如实登记为已知假阳**(见 classify 的 `loose-fs` 一行),
 * 不拿一台会误伤 14 处的尺子去修一处。
 */

// ─── 预拼常量形态(2026-09-26 补;此前本门对这一型是**漏报**)───────────────────
/**
 * 被报告的缺陷形态:绝对路径在模块作用域**拼好一次**,调用现场旁边没有 ROOT ——
 *
 *   const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
 *   const TOOL_DISPLAY_FILE = join(ROOT, 'packages', 'shared', 'src', 'chat', 'tool-display.ts')
 *   …
 *   readFileSync(TOOL_DISPLAY_FILE, 'utf8')
 *
 * 票面给的归因("readFileSync 旁边没有锚点 ⇒ REPO_ANCHOR_RE 判空")**经现读不成立**,这里按量到的
 * 写:旧 looseFs 判据是**整文件合取**(`FS_LOOSE_RE.test(全文)` && `REPO_ANCHOR_RE.test(全文)`,
 * 不做就近配对),而这类文件里 `join(ROOT,` 明明在场。真正让它沉默的是**遮噪层**:朴素状态机
 * `blankStrings` 不认正则字面量,`const re = /:\s*(["'])…/g` 里那个单引号被当成字符串开头,一路找
 * 不到配对 ⇒ 后半份文件被吞进一个永不闭合的串 ⇒ `readFileSync(` 这个 token 在遮噪后的文本里一个
 * 不剩(实测那道门原文 4 处 → 遮噪后 0 处;HEAD 面共 **24 道门**中招)。归因错了,修法就会错 ——
 * 只补"常量→读取"这一型的话,尺子本身还是盲的。
 * **2026-09-26 本票已把遮噪层收成一份**:`blankStrings` 现在是 `scanLiterals` 的投影,
 * `maskComments` 与它共用同一个 `scanSpans`(见下方遮噪层头注),所以这一型由**两条** loose-fs
 * 现场同时可见:旧合取与预拼常量规则各都能判出来。旧的"新判据自带第二遍遮噪"那种绕法
 * 已删除 —— 两条实现一条规则正是本仓记的最多的漂移成因(§22c)。
 *
 * 判据三条**同时**成立才算:
 *   ① 模块作用域(第 0 列)的 `const <UPPER_SNAKE> = <初值>`:初值按括号深度走到表达式结束,故跨行的
 *      `join(\n  ROOT, …)` 也算;字面量体整体跳过,所以模板串/文档串里的这种写法不会被当成声明
 *      (F15 同一条防线,只是换到声明侧);
 *   ② 初值里有仓库锚点(**沿用 REPO_ANCHOR_RE,一字未放宽**)+ ROOT 是**基参数** + 首个路径段落在
 *      "仓库内容"白名单里;
 *   ③ 内容读取调用(readFileSync / readFile / openSync / createReadStream)的**实参**里出现这个常量名。
 *
 * 为什么要有 ② 的白名单:本节上方已记录两次"把锚点放宽"的否决 —— 一次把 `join(root, …)` 小写根
 * 也算锚点,loose 从 74 涨到 93,其中两格是**假阳**(一格读 `.workbuddy` 运行台账,一格读按设计
 * 只存在于部署机的 gitignore 副本)。同一型东西换成大写常量再出现在新判据里,所以同一条理由必须
 * 在这里再生效一次:判据分不清"读被审内容"与"读运行态/机器态",就不该据此判红。
 * 选白名单而非黑名单是**取向**而非省事:白名单漏配 → 退回本改动之前的 no-content/unknown(漏报,
 * 与现状同形,不会有人被无关的红钉住);黑名单漏配 → 新增一道 blocking 假红 → 逼人 `--no-verify`
 * 连带废掉全部守门(§12e 记过的正是这一型)。两处已知漏报如实钉在自检 P20/P21 与镜像 T22。
 */

/**
 * 仓库里**确定是被跟踪源码树**的首段。`deploy/` 刻意**不在**此列:整目录被 `.gitignore` 忽略的
 * `deploy/prod-bundle/` 正是 §5e/守门 124 记过的那一格"按设计只存在于部署机"的副本 ——
 * 按磁盘读它是**正确行为**,判它红就是把那条决策当漏洞。实测 HEAD 面零个门用
 * `join(ROOT,'deploy',…)` 形态的常量,所以这条排除**不损失任何现有覆盖**(反例见自检 P6)。
 */
export const REPO_CONTENT_DIRS = [
  'apps',
  'packages',
  'config',
  'scripts',
  'docs',
  'sdks',
  'monitoring',
  'products',
  'cert',
  'patches',
  '.github',
  '.husky',
]
const REPO_CONTENT_DIR_RE = new RegExp(
  `^(${REPO_CONTENT_DIRS.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(/|$)`,
)
/** 仓库根上的**被跟踪单文件**(pnpm-lock.yaml / PROJECT_PLAN.md / knip-baseline.json …)。
 *  必须以字母开头且带扩展名 —— 这条同时挡掉 `.workbuddy/`、`.ihui-agent/`(点开头)、
 *  `__gate_result.txt`(下划线开头,CI tee 的运行产物)与任何目录段。 */
export const REPO_CONTENT_FILE_RE =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\.(json|ya?ml|md|ts|tsx|js|mjs|cjs|sql)$/
/** 本规则的读取词汇表:FS_LOOSE_RE 只认 readFileSync,新判据按票面扩到同一族读取(不改旧判据)。 */
const FS_READ_FNS = ['readFileSync', 'readFile', 'openSync', 'createReadStream']
const PREJOINED_DECL_RE = /^(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=/gm

/**
 * ─── 遮噪层:**一份**分词器,两个投影 ────────────────────────────────────────────
 * 本文件只有一台字面量/注释扫描器 `scanSpans`。两层遮噪都是它的投影:
 *  - `maskComments` 只把注释换掉(字符串原文必须保留 —— 模块说明符与 git 动词本身就是字符串);
 *  - `blankStrings` 清空字符串与正则字面量的**体**(标识符还在,串内假调用不可见)。
 *
 * 为什么必须收成一份(2026-09-26 实测缺陷,本票的立项理由):此前这里是**两台机器**,朴素那台
 * `blankStrings` 不认正则字面量 —— 实测 `check-tool-activity-coverage.mjs` 第 75 行写着
 * `const re = /:\s*(["'])((?:tool|action)[A-Za-z0-9_]*)\1/gu`,那个 `'` 被当成字符串开头,
 * 一路找不到配对 ⇒ 后半份文件被吞进一个永不闭合的串 ⇒ `readFileSync(` 这个 token 在遮噪后的文本里
 * **一个都不剩**(原文 4 处 → 遮噪后 0 处;HEAD 面共 **24 道门**中招,全被判成 no-content)。
 * 上一版新判据**自带**一遍认正则的遮噪来绕开它,于是"引了层 / 散写"那一侧仍用着盲掉的尺子 ——
 * 两条实现一条规则 = 本仓记录最多的漂移成因(见 §22c、守门 103 的"取源只能有一份实现")。
 * 现在所有判定都跑在同一台机器上,不存在"这半边看见、那半边瞎"的可能。
 *
 * 判"这个 `/` 是正则还是除法"的方式只看**上一个有效 token**:
 * 落在 `( , = : ; [ ! & | ? { } + - * % ~ ^ < >` 或文首,或刚写完 `return/typeof/case/…` 这类
 * 关键字时才算正则起始;其余(`)` / 标识符 / 字面量之后)按除法处理。字符类 `[...]` 里的 `/`
 * 不闭合(所以 `/[/"']/` 这种形态能正确识别)。**认不出(跨行没闭合)就当除法,且什么都不清** ——
 * 误判方向因此只会是"少遮"(可能多报),绝不会是"把真调用吞掉"。
 * 单引号/双引号串**不许跨行**(JS 里非法):遇换行即当作没开,免得一个奇数 apostrophe 吞掉半份文件。
 */
const REGEX_ALLOWED_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  ';',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  '+',
  '-',
  '*',
  '%',
  '~',
  '^',
  '<',
  '>',
  '',
])
/**
 * 关键字之后 `/` 必为正则(`return /x/`、`case '/':` 除外 —— 后者先被字符串判据接走)。
 * 只看"上一个有效字符"会把 `return /x/` 认成除法(上一字符是 `n`),那不是保守而是**看不见**;
 * 这一小张表是纯语法事实,不是豁免清单(它不描述任何被审内容,不会腐烂成"某个门在名单里")。
 */
const REGEX_ALLOWED_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'case',
  'do',
  'else',
  'yield',
  'await',
])
function isBlankish(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r'
}
/** 纯函数(导出给镜像测试,§22c 禁止在测试里再抄一份判据):该 token 位置上 `/` 是否可为正则起始 */
export function regexCanStart(lastSig, lastWord) {
  return REGEX_ALLOWED_AFTER.has(lastSig) || REGEX_ALLOWED_KEYWORDS.has(lastWord)
}

/** 字符串字面量:从起始引号 i 走到闭合(或换行/EOF)。bodyStart..bodyEnd 是**内部**区间。 */
function readStringSpan(text, i) {
  const q = text[i]
  let j = i + 1
  let body = ''
  while (j < text.length) {
    if (text[j] === '\\') {
      body += text[j] + (text[j + 1] ?? '')
      j += 2
      continue
    }
    if (text[j] === q)
      return { bodyStart: i + 1, bodyEnd: j, end: j + 1, body, closed: true, isTemplate: q === '`' }
    // 非模板串不跨行:判到这里说明引号不成对,宁可放过也不吞掉后半份文件
    if (text[j] === '\n' && q !== '`')
      return { bodyStart: i + 1, bodyEnd: j, end: j, body, closed: false, isTemplate: false }
    body += text[j]
    j += 1
  }
  return { bodyStart: i + 1, bodyEnd: j, end: j, body, closed: false, isTemplate: q === '`' }
}

/** 正则字面量:从起始 `/` 走到闭合 `/` + flags。认不出(closed:false)由调用方按除法处理。 */
function readRegexSpan(text, i) {
  let j = i + 1
  let inClass = false
  while (j < text.length) {
    const d = text[j]
    if (d === '\n') break
    if (d === '\\') {
      j += 2
      continue
    }
    if (inClass) {
      if (d === ']') inClass = false
    } else if (d === '[') inClass = true
    else if (d === '/') {
      j += 1
      let k = j
      while (k < text.length && /[dgimsuvyx]/i.test(text[k])) k += 1
      return { bodyStart: i + 1, bodyEnd: k, end: k, closed: true }
    }
    j += 1
  }
  return { bodyStart: i + 1, bodyEnd: j, end: j, closed: false }
}

/**
 * 单遍分词:产出注释 / 字符串 / 正则三类 span(区间语义统一:`start` 含定界符,
 * `bodyStart..bodyEnd` 是需要清空或需要判定的内部区间)。
 * `//` 与块注释开栏 **无条件**当注释,不受 token 位置影响 —— JS 词法本身如此:空正则必须写成
 * `/(?:)/`,而"`/*` 再补一个斜杠"在 JS 里是未闭合的块注释而不是正则。
 * (这一句本身踩过坑:注释里逐字写出那三个字符会**提前终结本块注释**,于是说明文字变成代码。)
 * 所以注释判定不受 lastSig 影响;正则判定只在字符串之外才问。
 */
export function scanSpans(text) {
  const spans = []
  let i = 0
  let lastSig = ''
  let lastWord = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '/') {
      let j = i
      while (j < text.length && text[j] !== '\n') j += 1
      spans.push({ kind: 'line', start: i, end: j, bodyStart: i, bodyEnd: j })
      i = j
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      let j = i + 2
      while (j < text.length && !text.startsWith('*/', j)) j += 1
      const end = Math.min(j + 2, text.length)
      spans.push({ kind: 'block', start: i, end, bodyStart: i, bodyEnd: end })
      i = end
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const r = readStringSpan(text, i)
      spans.push({ kind: 'string', start: i, ...r })
      i = r.end
      lastSig = c
      lastWord = ''
      continue
    }
    if (
      c === '/' &&
      regexCanStart(lastSig, lastWord) &&
      text[i + 1] !== undefined &&
      text[i + 1] !== ' '
    ) {
      const r = readRegexSpan(text, i)
      if (r.closed) {
        spans.push({ kind: 'regex', start: i, ...r })
        i = r.end
        lastSig = '/'
        lastWord = ''
        continue
      }
      // 闭合不了 ⇒ 按除法,且**不清任何东西**(宁可少遮,绝不吞掉真 token)
      i += 1
      lastSig = '/'
      lastWord = ''
      continue
    }
    if (!isBlankish(c)) {
      lastSig = c
      lastWord = /[\w$]/.test(c) ? lastWord + c : ''
    }
    i += 1
  }
  return spans
}

/**
 * 字面量掩码(遮注释之后的那一遍):产出「该字符是否在**字面量体内**」的掩码,外加字符串原文
 * (供首段白名单判据用)。正则字面量的体同样计入掩码 —— 正则里的 `readFileSync(` 是模式不是调用。
 */
export function scanLiterals(text) {
  const mask = new Uint8Array(text.length)
  const strings = []
  for (const s of scanSpans(text)) {
    if (s.kind === 'string') {
      for (let j = s.bodyStart; j < s.bodyEnd; j++) mask[j] = 1
      strings.push({
        start: s.start,
        end: s.end,
        body: s.body,
        closed: s.closed,
        isTemplate: s.isTemplate,
      })
    } else if (s.kind === 'regex') {
      for (let j = s.bodyStart; j < s.bodyEnd; j++) mask[j] = 1
    }
  }
  return { mask, strings, blanked: blankByMask(text, mask) }
}

/** 按掩码把字面量体清空(保留引号本身与换行),用于"标识符还在、串内假调用不可见"的那一遍。 */
export function blankByMask(text, mask) {
  let out = ''
  for (let i = 0; i < text.length; i++) out += mask[i] && text[i] !== '\n' ? ' ' : text[i]
  return out
}

/**
 * 从 `from` 起走到"这个表达式结束":深度 >0 时跨行继续(所以多行 join(...) 是一个整体),
 * 深度 0 遇换行即止。返回表达式文本。调用方传入的文本必须已把字面量体清空(串内括号不参与配平)。
 */
function takeExpr(text, from) {
  let depth = 0
  let i = from
  for (; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break
      depth -= 1
    } else if (c === '\n' && depth === 0) break
  }
  return text.slice(from, i)
}

/**
 * ROOT 必须是这次路径拼接的**基参数**(`join(ROOT, …)` / `path.join(ROOT, …)` / `resolve(ROOT, …)`)。
 * 这条不是形式主义:`dirname(ROOT)` 也满足 REPO_ANCHOR_RE,但它算出来的是**仓库外**的父目录
 * (check-parent-pollution 那一族的落点),把它拼出来的读取说成"按磁盘判仓库内容"就是假阳。
 */
const ROOT_BASE_RE = /^\s*(?:[A-Za-z_$][\w$]*\.)?(?:join|resolve|normalize)\s*\(\s*ROOT\s*[,)]/
/**
 * ②:锚点 + 基参数 + **首个**路径段落在仓库内容白名单里。
 * 只看首段(不是 `.some()`):`join(ROOT, '.workbuddy', 'push-state.json')` 的末段也是 `*.json`,
 * 按 some() 判就会被放行 —— 而它首段说的是"这是运行台账"。首段才是这条路径**挂在仓库里的位置**。
 */
function isRepoContentInitializer(initText, initStrings) {
  if (!REPO_ANCHOR_RE.test(initText) || !ROOT_BASE_RE.test(initText)) return false
  const first = initStrings.find((s) => s.closed && !s.isTemplate)
  return !!first && (REPO_CONTENT_DIR_RE.test(first.body) || REPO_CONTENT_FILE_RE.test(first.body))
}

/**
 * 纯函数:源码里有哪些**预拼仓库常量**名(① + ②)。导出给镜像测试,不得在测试里再抄一份判据(§22c)。
 * `scanned` 可复用调用方已算好的一次扫描(避免同一文件扫两遍);不给就自己扫。
 * 只收列首(第 0 列)开始的 const 声明 —— 缩进的声明在块作用域里,通常是**动态**路径
 * (实测 `const ZH_CN_PATH = path.join(ROOT, messagesPath)` 正是这种),把它们算进来就把"模块级
 * 拼一次的那个常量"稀释成"任何含 ROOT 的 const",而那已经不是本条要钉的形态。
 */
export function prejoinedRepoConsts(maskedCode, scanned) {
  const scanned2 = scanned || scanLiterals(maskedCode)
  const { mask, strings } = scanned2
  const blanked = scanned2.blanked || blankByMask(maskedCode, mask)
  const names = new Set()
  for (const m of maskedCode.matchAll(PREJOINED_DECL_RE)) {
    if (mask[m.index]) continue
    const from = m.index + m[0].length
    const initText = takeExpr(blanked, from)
    // blankByMask 逐字符等长 ⇒ 字符串记录的偏移在 blanked 上原样可用,按区间取即可(不靠"顺序猜")
    const initStrings = strings.filter((s) => s.start >= from && s.end <= from + initText.length)
    if (isRepoContentInitializer(initText, initStrings)) names.add(m[1])
  }
  return names
}

/** ③:内容读取调用的**实参**里出现该常量名。在遮噪后的文本上判(串内的假调用已被清空)。
 *  实参用括号深度配对取,**不**用 `[^)]*` —— 后者遇到 `readFileSync(resolve(BASE_DIR, 'x'))`
 *  这种嵌套会在第一个 `)` 截断,正好漏掉最常见的一手拼法。 */
export function readsPrejoinedConst(text, names) {
  if (!names.size) return []
  const hit = []
  for (const fn of FS_READ_FNS) {
    const re = new RegExp(`(?:^|[^.\\w$])${fn}\\s*\\(`, 'g')
    for (const m of text.matchAll(re)) {
      const args = takeExpr(text, m.index + m[0].length)
      for (const n of names) if (new RegExp(`\\b${n}\\b`).test(args)) hit.push(`${fn}(${n})`)
    }
  }
  return hit
}

/**
 * 只遮注释、**保留字符串字面量**的那一层遮噪。
 *
 * 为什么不复用现成的 `markHidden`:那一档把字符串内容一起抹掉(它服务的判据是"变量名/调用
 * 不能被注释或夹具字符串冒充"),而本门要认的两样东西**本身就是字符串** ——
 * `from './lib/face-reader.mjs'` 的模块说明符,和 `['cat-file', …]` 的 git 动词。
 * 直接套 `markHidden` 的结果是第一版自检 F1/F2 双双假绿:合规的门被读成"没导入",
 * 散写的门被读成"没读 git"。两处判的不是同一件事,所以各有一层遮噪,`markHidden`
 * 仍用于"是否真的读了文件"那一半(见 classify 里的 noStrings)。
 *
 * **注释区间取自 `scanSpans`(与 `blankStrings` 同一台机器)**,不是另写一遍状态机。
 * 这件事本身修掉一个真实缺陷:旧实现自己追引号且**不认正则字面量**,于是
 * `const re = /["']/g` 里那个 `"` 被当成字符串开头,一路找到下一个真正的 `"` 才罢休 ——
 * 中间那段里的 `//` 注释**不会被遮掉**,而是逐字留在"代码面"上。也就是说,一句写在
 * 注释里的 `execFileSync(GIT_BIN, ['show', …])` 或 `from './lib/face-reader.mjs'` 能让
 * 一道不合规的门被判成合规(**放行方向**,比漏报更贵:它替人做出"这层已经走了"的判断)。
 * 现在两个方向都收在同一份分词结果上。
 */
export function maskComments(src) {
  let out = ''
  let pos = 0
  for (const s of scanSpans(src)) {
    if (s.kind !== 'line' && s.kind !== 'block') continue
    out += src.slice(pos, s.start)
    // 行注释整段删掉(与旧实现同形);块注释逐字符换空白但保住换行,列位与行号不漂
    const body = src.slice(s.start, s.end)
    out += s.kind === 'line' ? '' : body.replace(/[^\n]/g, ' ')
    pos = s.end
  }
  return out + src.slice(pos)
}

/**
 * 在已遮注释的文本上再把**字符串与正则字面量的体**清空(保留引号本身与换行)。
 * 用于"标识符还在、串内假调用不可见"的那一遍。
 *
 * 这一层**以前是另一台不认正则的朴素状态机**,`const re = /["']/g` 会让它把后半份文件吞进
 * 一个永不闭合的串,`readFileSync(` 这种 token 在遮噪后的文本里一个不剩(HEAD 面实测 24 道门
 * 因此被判成 no-content)。现在它是 `scanLiterals` 的一行投影 —— **本文件只剩一台分词器**,
 * 不存在"这一半判定看得见、那一半看不见"的可能(§22c / 守门 103 的"取源只能有一份实现")。
 */
export function blankStrings(text) {
  return scanLiterals(text).blanked
}

/**
 * 单文件定性。返回 `{ kind, why }`:
 *  - `face`        调用过取材层的读取入口取内容 ⇒ 合规
 *  - `half-wired`  **引了这层却没用它读内容**,内容由自派生 git 或磁盘 readFileSync 取 ⇒ 判红
 *                  (2026-09-26 补:旧版把"import 了 face-reader"直接当合规,而实证门 36/124 就是这样
 *                   一边 import 一边默认读磁盘 —— 一门自称守取材面纪律,对半接线全盲)
 *  - `loose-git`   散写 git 取 **blob 正文** ⇒ 判红(存在性/路径清单类调用不算,见 GIT_ENUM_ONLY_CALL_RE)
 *  - `loose-fs`    散写"从仓库锚点读文件" ⇒ 判红。两种现场都算:
 *                  (a) readFileSync 旁边就有仓库锚点(join/resolve(ROOT))——原判据;
 *                  (b) **预拼常量**(绝对路径在模块作用域拼好一次,调用现场没有锚点)——2026-09-26 补,
 *                      见上方 prejoinedRepoConsts;判不出首段是否属仓库内容时一律不判(退回 unknown)
 *                  ⚠️ **已知假阳(2026-09-26 现读登记,不是本票新增)**:(a) 那条合取**整文件**成立,
 *                  既不做就近配对、也不看白名单 ⇒ 一道只读构建产物 / 只读 gitignore 运行台账的门
 *                  (实测 `check-artifact-budget.mjs`:全部磁盘读都在各端 dist 里,那些路径既不在
 *                  HEAD 也不在索引)也会被记成 loose-fs。它**不是**新出现的形状 —— 拿遮噪修复前的
 *                  分类器跑一份不带那行致盲正则的同型夹具,结论同样是 loose-fs。给合取加"字面量
 *                  内容限定"的窄判据已被数据否决(见 REPO_ANCHOR_RE 之后那段:漏判目标、误伤 14 道
 *                  真盘判门),要收这一格必须认识 gitignore 语义(`check-prod-bundle-shadow` 的 S2
 *                  那一族),那是另一票。**不得**为此放宽合取,也不得拿豁免清单冒充修好。
 *  - `no-content`  根本不读仓库内容 ⇒ 不适用(不计违规也不计数)
 *  - `unknown`     读文件但找不到仓库锚点 ⇒ 只报数(临时夹具这一型结构上判不了)
 */
export function classify(rel, src) {
  if (typeof src !== 'string') return { kind: 'unreadable', why: '内容取不到' }
  if (SELF_EXEMPT.includes(rel)) return { kind: 'self', why: '本门/取材层自身' }
  const code = maskComments(src)
  // 判序先认"真调用过层的读取入口",再判"引了层却没用它读内容"(半接线),最后才是原来两档散写。
  // 顺序反了就会把 half-wired 吞进 face —— 那正是旧版行为:FACE_IMPORT_RE 一刀命中即放行。
  const usesLayer = usesLayerRead(code)
  const selfServesGit = (GIT_SPAWN_RE.test(code) || GIT_RAW_RE.test(code)) && gitContentReads(code)
  // **一次**扫描喂全部判定:所有判据(散写 git / 磁盘 readFileSync / 预拼常量 / no-content)
  // 都跑在同一份遮噪上。旧写法在这里另起一台不认正则的机器,于是同一份文件"这半边看得见、
  // 那半边看不见",而看不见的那半边恰好是本票立项要抓的那一型。
  const scanned = scanLiterals(code)
  const noStrings = scanned.blanked
  const looseFs = FS_LOOSE_RE.test(noStrings) && REPO_ANCHOR_RE.test(noStrings)
  // 预拼常量:与 looseFs 平行的第二条 loose-fs 现场。looseFs 已命中就无需再算(结论同形,省一遍匹配)。
  let constReads = []
  if (!looseFs) {
    const names = prejoinedRepoConsts(code, scanned)
    if (names.size) constReads = readsPrejoinedConst(noStrings, names)
  }
  if (usesLayer)
    return { kind: 'face', why: '调用取材层的读取入口(catBatch / readWorktreeFile)取内容' }
  if (FACE_IMPORT_RE.test(code) && (selfServesGit || looseFs || constReads.length))
    return {
      kind: 'half-wired',
      why:
        '引了 lib/face-reader.mjs 却**没有**用它读内容:内容仍由自己派生 git 或按磁盘 readFileSync 取' +
        '(半接线 —— 这层看起来在用,判定面其实没换)' +
        (constReads.length ? ` [预拼常量:${constReads.join(', ')}]` : ''),
    }
  if (selfServesGit)
    return {
      kind: 'loose-git',
      why: '自己派生 git **取 blob 正文**(cat-file / show / --batch)而未经取材层',
    }
  if (looseFs)
    return { kind: 'loose-fs', why: 'readFileSync + 仓库锚点(join/resolve(ROOT)) ⇒ 按磁盘判' }
  if (constReads.length)
    return {
      kind: 'loose-fs',
      why: `按磁盘读**预拼仓库常量**路径(绝对路径在模块作用域拼好一次,调用现场没有 ROOT ⇒ 原判据看不见):${constReads.join(', ')}`,
    }
  if (FS_LOOSE_RE.test(noStrings))
    return { kind: 'unknown', why: '读文件但找不到仓库锚点(可能是临时夹具)' }
  return { kind: 'no-content', why: '不读仓库内容' }
}

/** 判红集只有一处定义 —— decide 与"哪些形态算违规"都从它读,不在别处再抄 kind 名单。 */
const RED_KINDS = new Set(['loose-git', 'loose-fs', 'half-wired'])

/** 聚合(纯函数,自检/镜像靠构造输入证明它有牙)。 */
export function decide({ verdicts, mode }) {
  const red = []
  const counts = {
    face: 0,
    loose: 0,
    halfWired: 0,
    unknown: 0,
    noContent: 0,
    unreadable: 0,
    self: 0,
  }
  for (const v of verdicts) {
    if (v.kind === 'face') counts.face++
    // 半接线既计入 loose 总量(它就是散写的一种),也单列计数:报告里必须能看出这次收紧抓到了几道,
    // 否则新档等于不存在 —— 只报 total 的聚合会把"收紧"退化成"多一种没人看的形态"。
    else if (RED_KINDS.has(v.kind)) {
      if (v.kind === 'half-wired') counts.halfWired++
      counts.loose++
      if (mode === 'staged') red.push(v)
    } else if (v.kind === 'unknown') counts.unknown++
    else if (v.kind === 'no-content') counts.noContent++
    else if (v.kind === 'self') counts.self++
    else counts.unreadable++
  }
  const exit = counts.unreadable > 0 ? 2 : red.length > 0 ? 1 : 0
  return { exit, red, counts, mode }
}

/** 取材(与守门 113/77/83 同形):全量判 HEAD blob、`--staged` 判索引 blob、`--worktree` 逃生舱 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function listGates(root, face) {
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
      : ['ls-files', '-z']
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  const paths = out.split('\0').filter(Boolean)
  if (!paths.length && face === 'staged') return []
  return paths.filter((p) => GATE_GLOB.test(p))
}

export function analyze(root, face) {
  const all = listGates(root, face)
  const mode = face === 'staged' ? 'staged' : 'full'
  // 全量面枚举到 0 道门 ⇒ 判据失效,不得表现为"扫 0 记绿"
  if (face === 'head' && all.length === 0)
    throw new Undetermined('HEAD 面枚举到 0 个门脚本 —— 判据失效不计通过')
  let gates = all
  if (mode === 'staged') {
    // 只审"这次改动动过的门";暂存集为空则退回全量报数(防"空暂存恒绿"的错觉)
    if (all.length === 0)
      return {
        ...decide({ verdicts: [], mode: 'full-noop' }),
        notices: ['--staged 暂存集内没有门脚本改动 ⇒ 本档无事可判(如实说明,不冒充"全部合规")'],
      }
    gates = all
  }
  const texts = readFace(root, face, gates)
  const verdicts = gates.map((p) => {
    const c = classify(p, texts.get(p))
    return { file: p, ...c }
  })
  return { ...decide({ verdicts, mode }), verdicts, notices: [] }
}

function main(argv) {
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1] || '.') : ROOT
  assertRepoRoot(root, '本门')
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face)
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : (e?.message ?? String(e))
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  for (const n of out.notices || []) console.log(`ℹ️  ${n}`)
  if (out.red.length) {
    console.error(
      `❌ 检出 ${out.red.length} 道**本次改动动过的**门脚本按磁盘/散写判内容(应经 scripts/lib/face-reader.mjs):`,
    )
    for (const r of out.red) console.error(`   ${r.file} —— ${r.why}`)
    console.error(
      '   出路:改用 face-reader 的 selectFace/readFace(全量判 HEAD blob、--staged 判索引、取不到 exit 2);',
    )
    console.error(
      '         若这道门判的**不是仓库内容**(纯计算/外部输入),改成不读 ROOT 锚点即可,或按 --staged 之外的档只报数。',
    )
  }
  const c = out.counts
  const tag =
    out.mode === 'staged' ? '本次改动' : '全量(只报数,不判红 —— 存量 122 型一次性判红就是恒红门)'
  console.log(
    `${out.exit === 0 ? '✅' : out.exit === 2 ? '❌ 无法判定' : '❌ 判红'} ${tag}:经取材层 ${c.face} / 散写 ${c.loose} / 判不了(疑临时夹具) ${c.unknown} / 不读内容 ${c.noContent} / 取不到 ${c.unreadable}`,
  )
  return out.exit
}

/** 判据自检:纯函数 + 构造面,零副作用。 */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const OK =
    "import { catBatch } from './lib/face-reader.mjs'\nconst t = catBatch(ROOT, ['HEAD:a.ts'])\n"
  const NS =
    "import * as face from './lib/face-reader.mjs'\nconst t = face.catBatch(ROOT, ['HEAD:a.ts'])\n"
  const HALF =
    "import { gitBinary, gitErrText, selectFace } from './lib/face-reader.mjs'\n" +
    "execFileSync(gitBinary(), ['show', 'HEAD:a.ts'])\n"
  const HALF_FS =
    "import { selectFace } from './lib/face-reader.mjs'\nimport { readFileSync } from 'node:fs'\nreadFileSync(join(ROOT, 'a.ts'), 'utf8')\n"
  const HELPER_ONLY =
    "import { assertRepoRoot, gitErrText } from './lib/face-reader.mjs'\nconsole.log('不读仓库内容')\n"
  const GIT =
    "import { execFileSync } from 'node:child_process'\nexecFileSync('git', ['cat-file', 'blob', h])\n"
  const FS =
    "import { readFileSync } from 'node:fs'\nreadFileSync(join(ROOT, 'package.json'), 'utf8')\n"
  const FIXTURE =
    "import { readFileSync } from 'node:fs'\nreadFileSync(join(dir, 'x.json'), 'utf8')\n"
  const PURE = 'export function f(x) { return x + 1 }\n'
  eq('F1 经取材层 ⇒ face', classify('scripts/check-a.mjs', OK).kind, 'face')
  // G1–G6:2026-09-26 两处收紧的反向锁。"读内容"与"枚举"不分,报告里的数字就失去含义;
  // 锚点只认大写 ROOT,最常见的小写模块根写法就会掉进不判红的 unknown ⇒ 免检票。
  eq(
    'G1 借层的 transport 自己读 blob(gitRaw([show,…]))⇒ half-wired',
    classify(
      'scripts/check-g1.mjs',
      "import { gitRaw } from './lib/face-reader.mjs'\nfunction gs(spec){ return gitRaw(['show', spec], root) }\nconst a = gs(`HEAD:${REL}`)\n",
    ).kind,
    'half-wired',
  )
  eq(
    'G2 只做存在性检查(cat-file -e)不算读内容 ⇒ no-content(不得误伤)',
    classify(
      'scripts/check-g2.mjs',
      "const git=(a)=>execFileSync(GIT_BIN,a)\ngit(['cat-file','-e',`${sha}^{commit}`])\n",
    ).kind,
    'no-content',
  )
  eq(
    'G3 只列路径清单(ls-tree --name-only / rev-list / merge-base)不算读内容 ⇒ no-content',
    classify(
      'scripts/check-g3.mjs',
      "const git=(a)=>execFileSync(GIT_BIN,a)\ngit(['ls-tree','-r','--name-only',oid,'-z'])\ngit(['rev-list',ref])\ngit(['merge-base','--all',...p])\n",
    ).kind,
    'no-content',
  )
  eq(
    'G4 散写 cat-file blob ⇒ 仍 loose-git(收紧不得顺手放过真散写)',
    classify('scripts/check-g4.mjs', "execFileSync(GIT_BIN, ['cat-file', 'blob', oid])\n").kind,
    'loose-git',
  )
  // G5a/G5b 把"为什么不再放宽锚点"变成机器记录:一次放宽把 74 涨到 93,其中两格是假阳 ——
  // `check-merge-addition-loss.mjs` 读 gitignore 的运行台账、`check-prod-bundle-shadow.mjs` 读按设计
  // 只存在于部署机的忽略副本。判据认不出"读被审内容 vs 读运行态",就不该假装认得。
  // G5a/G5b 把「为什么不再放宽锚点」变成机器记录:一次把 join(root,…) 也算锚点,loose 从 74 涨到 93,
  // 其中两格是假阳 —— check-merge-addition-loss 读 gitignore 的运行台账、check-prod-bundle-shadow 读按设计
  // 只存在于部署机的忽略副本。判据认不出"读被审内容 vs 读运行态",就不该假装认得(§12e 同型:恒红门的结局是跳门)。
  eq(
    'G5a 大写 ROOT + 读盘 ⇒ loose-fs(既有口径,本票不动)',
    classify(
      'scripts/check-g5a.mjs',
      "const ROOT = resolve(__dirname, '..')\nreadFileSync(join(ROOT, REL), 'utf8')\n",
    ).kind,
    'loose-fs',
  )
  eq(
    'G5b 小写 root + 读盘 ⇒ unknown(已知空档:不误判红,也不假装看见)',
    classify(
      'scripts/check-g5b.mjs',
      "const root = resolve(__dirname, '..')\nreadFileSync(join(root, REL), 'utf8')\n",
    ).kind,
    'unknown',
  ) // F6–F9:收紧"import 层 ≠ 走层"的成对证明。四条要一起读 —— F6/F7 的红必须由 F1/F8 的绿
  // 反向钉住,否则"不红"可能只是判据失效;而 F8 防的是新判据把合法写法误伤(命名空间导入)。
  eq(
    'F6 引了层却自己 git show 读内容 ⇒ half-wired(半接线)',
    classify('scripts/check-f6.mjs', HALF).kind,
    'half-wired',
  )
  eq(
    'F7 引了层却按磁盘 readFileSync 读 ⇒ half-wired',
    classify('scripts/check-f7.mjs', HALF_FS).kind,
    'half-wired',
  )
  eq(
    'F8 命名空间导入 face.catBatch( ⇒ 仍算 face(新判据不得产假阳)',
    classify('scripts/check-f8.mjs', NS).kind,
    'face',
  )
  eq(
    'F9 只用层的非读取导出且不读内容 ⇒ no-content(不把门面函数当读取凭证,也不判红)',
    classify('scripts/check-f9.mjs', HELPER_ONLY).kind,
    'no-content',
  )
  // F10:half-wired 必须真的进判红集(staged 档),且单列计数 —— 只报总数等于没做这次收紧
  {
    const hw = decide({
      verdicts: [{ file: 'scripts/check-f6.mjs', kind: 'half-wired', why: 'x' }],
      mode: 'staged',
    })
    eq('F10a half-wired 在 staged 档判红', hw.exit, 1)
    eq('F10b half-wired 计入 counts.halfWired', hw.counts.halfWired, 1)
    eq(
      'F10c 全量档只报数不判红(存量一次性判红 = 恒红门)',
      decide({ verdicts: [{ file: 'a', kind: 'half-wired', why: 'x' }], mode: 'full' }).exit,
      0,
    )
  }
  eq('F2 散写 git 内容 ⇒ loose-git', classify('scripts/check-b.mjs', GIT).kind, 'loose-git')
  eq('F3 磁盘 + 仓库锚点 ⇒ loose-fs', classify('scripts/check-c.mjs', FS).kind, 'loose-fs')
  eq(
    'F4 只读夹具(无仓库锚点)⇒ unknown,不判红',
    classify('scripts/check-d.mjs', FIXTURE).kind,
    'unknown',
  )
  eq('F5 不读内容 ⇒ no-content', classify('scripts/check-e.mjs', PURE).kind, 'no-content')
  // ─── P 系列:预拼常量(2026-09-26)────────────────────────────────────────
  // 一条**必须一起读**的设计:P 里除了 P1/P9/P10,都插了 BLIND 那一行。原因不是审美 ——
  // 旧的 looseFs 判据是**整文件合取**(文中任一处 readFileSync( + 任一处 join(ROOT ⇒ loose-fs),
  // 而预拼常量声明本身就把 `join(ROOT` 写进了文本。所以不遮蔽朴素遮噪机的话,这些夹具全部由**旧**
  // 判据判红,新判据一条都不被问到最后"全绿"却毫无牙齿(§22c:判据失效的表现永远是安静)。
  // BLIND = `/(["']/g`:朴素机器把那个单引号当字符串开头,一路找不到配对 ⇒ 此后半份文件被吞掉,
  // `readFileSync(` 这个 token 在遮噪后的文本里一个不剩。这正是 HEAD 面上 24 道门的真实处境。
  const PJ_HEAD =
    "import { readFileSync } from 'node:fs'\nimport { dirname, join, resolve } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nconst ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')\n"
  const PJ_TAIL = "const display = readFileSync(TOOL_FILE, 'utf8')\n"
  const BLIND = 'const qre = /["\']/g\n'
  // P1 用**票面那段原样代码**(不含 BLIND):要的就是"这一型的结果必须是 loose-fs"这个终态。
  eq(
    'P1 票面原样形态(预拼常量 + 调用现场无锚点)⇒ loose-fs',
    classify(
      'scripts/check-p1.mjs',
      PJ_HEAD +
        "const TOOL_FILE = join(ROOT, 'packages', 'shared', 'src', 'chat', 'tool-display.ts')\n" +
        PJ_TAIL,
    ).kind,
    'loose-fs',
  )
  // P2 = P1 去掉旧判据的遮蔽版:证明"loose-fs"这一格是新判据给的,不是旧合取顺手接住的。
  eq(
    'P2 同型 + 朴素遮噪被吞 ⇒ 仍 loose-fs(新判据建在认正则的第二遍上)',
    classify(
      'scripts/check-p2.mjs',
      PJ_HEAD +
        BLIND +
        "const TOOL_FILE = join(ROOT, 'packages', 'shared', 'src', 'chat', 'tool-display.ts')\n" +
        PJ_TAIL,
    ).kind,
    'loose-fs',
  )
  eq(
    'P3 多行初值 join(\\n ROOT, …) 也算声明位 ⇒ loose-fs',
    classify(
      'scripts/check-p3.mjs',
      PJ_HEAD +
        BLIND +
        "const TOOL_FILE = join(\n  ROOT,\n  'apps',\n  'web',\n  'x.ts',\n)\n" +
        PJ_TAIL,
    ).kind,
    'loose-fs',
  )
  eq(
    'P4 嵌套拼法 readFileSync(join(BASE_DIR, f)) ⇒ loose-fs(实参按深度配对,不被 [^)] 截断)',
    classify(
      'scripts/check-p4.mjs',
      PJ_HEAD +
        BLIND +
        "const BASE_DIR = join(ROOT, 'packages', 'database', 'drizzle')\nreadFileSync(join(BASE_DIR, f), 'utf8')\n",
    ).kind,
    'loose-fs',
  )
  // P5–P8 / P20:白名单边界的反向锁。**这两条必须一起读,而且方向要说清**:
  //  ① 预拼常量规则(它才是本票要测的那条)对这些形态**必须一条都不 qualify** —— 由 `pre` 计数钉死;
  //  ② `classify` 的最终档在遮噪修复之后是 **loose-fs**,因为**旧的那条整文件合取**
  //     (`readFileSync(` 任一处 × `join(ROOT` 任一处,不做就近配对)本来就不看白名单。
  // 这不是本票新引入的假阳:用 HEAD 那版分类器跑**不带 BLIND**的同一份夹具,结论同样是
  //  loose-fs(实测 A/B:OLD 无 BLIND=loose-fs / OLD 带 BLIND=no-content / NEW 两种都 loose-fs)。
  // BLIND 那行过去只是**碰巧**把合取的两半一起吞掉了,所以这些夹具测到的一直是遮噪机的失明,
  // 而不是白名单在守门 —— 把它当白名单的胜利会替一个潜在假阳背书。那一格的真正出口是
  // **认识 gitignore 语义**的窄判据(参照 `check-prod-bundle-shadow` 的 S2),已按现读数据登记在
  // REPO_ANCHOR_RE 的头注里,不得用"给白名单再加几个名字"冒充修好它。
  const pShape = (body) => {
    const code = maskComments(PJ_HEAD + body)
    const scanned = scanLiterals(code)
    const names = prejoinedRepoConsts(code, scanned)
    return {
      kind: classify('scripts/p.mjs', PJ_HEAD + body).kind,
      // qual = 预拼规则**登记到**的仓库常量名个数;read = 这些常量真出现在某次读取的**实参**里
      qual: names.size,
      read: readsPrejoinedConst(scanned.blanked, names).length,
    }
  }
  // 阳性对照:同一台 pShape 在"白名单内 + 直接读取"的形态上必须报 qual:1 / read:1。
  // 没有这条,下面那一排 read:0 完全可能只是"helper 根本没跑"(§22c 的复读机教训)。
  eq(
    'P4b pShape 阳性对照(白名单内 + 直接读取 ⇒ qual 1 / read 1)',
    pShape("const PLAN_FILE = join(ROOT, 'PROJECT_PLAN.md')\nreadFileSync(PLAN_FILE, 'utf8')\n"),
    { kind: 'loose-fs', qual: 1, read: 1 },
  )
  eq(
    'P5 .workbuddy 运行台账 ⇒ 预拼规则不 qualify(合取仍判 loose-fs,见上)',
    pShape(
      "const LEDGER = join(ROOT, '.workbuddy', 'push-state.json')\nreadFileSync(LEDGER, 'utf8')\n",
    ),
    { kind: 'loose-fs', qual: 0, read: 0 },
  )
  eq(
    'P6 deploy/prod-bundle(按设计只存在于部署机)⇒ 预拼规则不 qualify',
    pShape(
      "const RUNNING = join(ROOT, 'deploy', 'prod-bundle', 'monitor.ps1')\nreadFileSync(RUNNING, 'utf8')\n",
    ),
    { kind: 'loose-fs', qual: 0, read: 0 },
  )
  eq(
    'P7 CI tee 产物 __gate_result.txt ⇒ 预拼规则不 qualify',
    pShape(
      "const RESULT_FILE = join(ROOT, '__gate_result.txt')\nreadFileSync(RESULT_FILE, 'utf8')\n",
    ),
    { kind: 'loose-fs', qual: 0, read: 0 },
  )
  eq(
    'P8 dirname(ROOT) 逃到父目录(ROOT 不是基参数)⇒ 预拼规则不 qualify',
    pShape("const PARENT = dirname(ROOT)\nreadFileSync(join(PARENT, 'x.txt'), 'utf8')\n"),
    { kind: 'loose-fs', qual: 0, read: 0 },
  )
  eq(
    'P9 路径来自 argv ⇒ 不得 loose-fs(提交者结构上满足不了)',
    classify(
      'scripts/check-p9.mjs',
      "const TARGET = process.argv[2]\nreadFileSync(TARGET, 'utf8')\n",
    ).kind,
    'unknown',
  )
  eq(
    'P10 临时夹具根 ⇒ 不得 loose-fs',
    classify(
      'scripts/check-p10.mjs',
      "const SCRATCH_DIR = mkScratch('t')\nreadFileSync(SCRATCH_DIR, 'utf8')\n",
    ).kind,
    'unknown',
  )
  // P11/P12:判序锁 —— 新判据不许插队到"层"与"半接线"前面。
  eq(
    'P11 走了层的读取入口 + 预拼常量 ⇒ 仍 face',
    classify(
      'scripts/check-p11.mjs',
      "import { catBatch } from './lib/face-reader.mjs'\n" +
        PJ_HEAD +
        BLIND +
        "const TOOL_FILE = join(ROOT, 'packages', 'a.ts')\ncatBatch(ROOT, ['HEAD:a.ts'])\n" +
        PJ_TAIL,
    ).kind,
    'face',
  )
  eq(
    'P12 引了层却按预拼常量读盘 ⇒ half-wired(不是 loose-fs)',
    classify(
      'scripts/check-p12.mjs',
      "import { selectFace } from './lib/face-reader.mjs'\n" +
        PJ_HEAD +
        BLIND +
        "const TOOL_FILE = join(ROOT, 'packages', 'a.ts')\n" +
        PJ_TAIL,
    ).kind,
    'half-wired',
  )
  // P13/P14:遮噪方向 —— 文档串里逐字写着这种调用不得算调用(F15 在新判据上的等价物);
  // P14 是它的阳性对照,否则 P13 可能只是"判据根本没跑"。
  eq(
    'P13 模板串里的 readFileSync(TOOL_FILE) 不算调用 ⇒ no-content',
    classify(
      'scripts/check-p13.mjs',
      PJ_HEAD +
        BLIND +
        "const TOOL_FILE = join(ROOT, 'packages', 'a.ts')\nconst doc = `readFileSync(TOOL_FILE, 'utf8')`\n",
    ).kind,
    'no-content',
  )
  eq(
    'P14 同一份文件真有一处调用 ⇒ loose-fs(P13 不是恒绿的证明)',
    classify(
      'scripts/check-p14.mjs',
      PJ_HEAD +
        BLIND +
        "const TOOL_FILE = join(ROOT, 'packages', 'a.ts')\nconst doc = `readFileSync(TOOL_FILE, 'utf8')`\nreadFileSync(TOOL_FILE, 'utf8')\n",
    ).kind,
    'loose-fs',
  )
  // P15 名单正向证明(门 120 同族规矩):白名单不能是张死表 —— 每个在册首段都必须真能被命中一次。
  for (const d of REPO_CONTENT_DIRS)
    eq(
      `P15 白名单首段 ${d}/ 真能命中`,
      classify(
        'scripts/check-p15.mjs',
        PJ_HEAD +
          BLIND +
          `const ONE_PATH = join(ROOT, '${d}', 'a.ts')\nconst v = readFileSync(ONE_PATH, 'utf8')\n`,
      ).kind,
      'loose-fs',
    )
  // P16 的 `\b` 牙齿现在**必须在单元层测**:classify 的档位由整文件合取给出(文件里同时有
  // `join(ROOT` 与 `readFileSync(`),预拼规则有没有把 TOOLX 误认成 TOOL,合取一点也看不见。
  // 把它留在 classify 层,等于让一条不参与该结论的判据拿合取产出的红去发合格证。
  {
    const body = "const TOOL = join(ROOT, 'packages', 'a.ts')\nreadFileSync(TOOLX, 'utf8')\n"
    const code = maskComments(PJ_HEAD + body)
    const names = prejoinedRepoConsts(code)
    eq('P16a 声明侧认出的常量名恰为 TOOL', [...names].sort(), ['TOOL'])
    eq(
      'P16b 前缀不得误伤 TOOLX(\\b 有牙,单元层证明)',
      readsPrejoinedConst(scanLiterals(code).blanked, names),
      [],
    )
    eq(
      'P16c 同一份文本最终由**合取**判 loose-fs(与预拼规则无关,故牙齿不得放这层)',
      classify('scripts/check-p16.mjs', PJ_HEAD + BLIND + body).kind,
      'loose-fs',
    )
  }
  // P17:反向锁 —— 这条规则**不是**把锚点判据放宽了。REPO_ANCHOR_RE 的源码形态必须逐字未动。
  // 档位由 no-content 变 **unknown**:遮噪修好后 `readFileSync(` 这个 token 回来了,"读文件但找不到
  // 仓库锚点"被如实命中;unknown **不进判红集**,所以"小写 root 不当锚点"这条锁的强度一字未变。
  eq(
    'P17 小写 root 仍不被当锚点(票面"不得放宽 REPO_ANCHOR_RE";落 unknown,不判红)',
    classify(
      'scripts/check-p17.mjs',
      "const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')\n" +
        BLIND +
        "const TOOL_FILE = join(root, 'packages', 'a.ts')\nreadFileSync(TOOL_FILE, 'utf8')\n",
    ).kind,
    'unknown',
  )
  eq(
    'P18 REPO_ANCHOR_RE 源码未被改写',
    REPO_ANCHOR_RE.source,
    '(?:join|resolve|normalize|dirname|isAbsolute)\\s*\\([^)]{0,40}\\bROOT\\b',
  )
  // P19:REPO_CONTENT_FILE_RE 也需要正向证明(门 120 的规矩:只有反向锁的名单可以是死表)。
  eq(
    'P19 根级被跟踪单文件命中 FILE_RE ⇒ loose-fs',
    classify(
      'scripts/check-p19.mjs',
      PJ_HEAD +
        BLIND +
        "const PLAN_FILE = join(ROOT, 'PROJECT_PLAN.md')\nreadFileSync(PLAN_FILE, 'utf8')\n",
    ).kind,
    'loose-fs',
  )
  // P20/P21 记的是**预拼规则自己的两格看不见**,不是"classify 不判红":
  //  遮噪修好后 `readFileSync(` 这个 token 一直在场,而合取判据本来就不看白名单、不做配对,
  //  所以这两格的 classify 终态是 loose-fs。**这两条必须读成"白名单在此不参与"** ——
  //  否则会把合取顺手接住的一格,误记成预拼规则赢下的一格(§22c 的复读机正是这个形状)。
  //  P20 点开头的根级文件被 FILE_RE 挡在外面:点前缀在本仓是机器态的标记(`.workbuddy/`、
  //     `.ihui-agent/`、`.deploy.lock/`、`.env*`),判据不认识 gitignore 就分不开 ⇒ qual 0。
  //     现读实测这一条排除**今天不损失覆盖**:唯一这么写的 `check-api-routes.mjs`(读
  //     `.check-api-routes-ignore.json`)由合取兜住(镜像 T22 把这条前提钉成断言 —— 前提一变就红)。
  //  P21 常量喂给遍历器、真正的读取发生在遍历里(两跳)⇒ 常量**在册**(qual 1)但读取实参里
  //     找不到它(read 0):本规则不追数据流。HEAD 面这两跳门(check-tagsview-visual /
  //     check-i18n-namespace-passing)现在**由合取**判红,所以这一格不再是"整道门看不见",
  //     只是"这一条规则不追"。
  eq(
    'P20 点开头根级文件 ⇒ qual 0(已知漏报,理由见注释;终态由合取给)',
    pShape("const IGNORE_FILE = join(ROOT, '.x-ignore.json')\nreadFileSync(IGNORE_FILE, 'utf8')\n"),
    { kind: 'loose-fs', qual: 0, read: 0 },
  )
  eq(
    'P21 两跳(常量→walker→局部变量)⇒ qual 1 但 read 0(本规则不追数据流)',
    pShape(
      "const WEB_ROOT = resolve(ROOT, 'apps/web')\nwalkFiles(WEB_ROOT, files)\nfor (const file of files) readFileSync(file, 'utf8')\n",
    ),
    { kind: 'loose-fs', qual: 1, read: 0 },
  )
  // ─── R 系列:本票的核心缺陷(遮噪不认正则字面量)───────────────────────────
  // R1 阳性对子:**唯一**一处内容读取藏在一行正则字面量之后。修遮噪之前这里是 no-content
  // (朴素机器把 `'` 当字符串开栏,后半份文件整片被吞),修之后必须是 loose-fs。
  // 这一条就是"24 道门被误判"那一型的最小复现,不得用"给白名单加名字"之类的旁路消掉。
  eq(
    'R1 正则字面量之后的唯一读取 ⇒ loose-fs(修遮噪前 = no-content)',
    classify(
      'scripts/check-r1.mjs',
      "import { readFileSync } from 'node:fs'\nconst re = /[\"']/g\nreadFileSync(join(ROOT, 'apps/web/src/x.ts'), 'utf8')\n",
    ).kind,
    'loose-fs',
  )
  // R1b 遮噪**仍然有效**的反向对照:同一个 token 写在正则**体内**时不得被当成调用。
  // 没有这条,R1 的红可能只是"遮噪被整体关掉"的假象(判据失效的表现永远是安静)。
  eq(
    'R1b 正则体内写着 readFileSync(join(ROOT 不算读取 ⇒ no-content',
    classify('scripts/check-r1b.mjs', 'const re = /readFileSync\\(join\\(ROOT/g\nconst n = 1\n')
      .kind,
    'no-content',
  )
  // R2 阴性对子:**真除法**不得开正则状态。`width / height` 之后同行还有一个字符串字面量,
  // 若那个 `/` 被误认成正则起始,扫描器会把一路到行尾(或到下一个 `/`)都当成正文清掉,
  // `'apps/web'` 就从 strings 清单里消失 —— 消失即"首段白名单再也看不见",判据会静默变宽。
  {
    const div =
      "const ratio = width / height\nconst note = 'apps/web'\nreadFileSync(join(ROOT, note), 'utf8')\n"
    const { strings } = scanLiterals(maskComments(div))
    eq(
      'R2 除法不开正则状态(同行的字符串仍然在册)',
      strings.some((s) => s.body === 'apps/web'),
      true,
    )
    eq(
      'R2b 同份文本仍判 loose-fs(阴性对子不得把真读取也一起吞掉)',
      classify('scripts/check-r2.mjs', div).kind,
      'loose-fs',
    )
    // R2c:除法链不能被当成正则(两个 `/` 都不闭合 ⇒ 任何东西都不许被清)
    eq(
      'R2c 连续除法不误开正则状态',
      scanSpans('const q = a / b / c\n').filter((s) => s.kind === 'regex').length,
      0,
    )
  }
  // R3(不在这里,刻意留空):"只剩一台遮噪机"这件事**不能**用 blankStrings 与
  // scanLiterals 的输出等值来证明 —— 前者本就是后者的投影,那是条恒真式(§22c:测试只复读
  // 实现就是复读机)。锁放在镜像测试里按**源码形状**判(mirror T24)。

  eq('F6 非门脚本文件名不参与 glob', GATE_GLOB.test('apps/cli/src/tools/memory.ts'), false)
  eq(
    'F7 注释里的标识符不算调用(遮噪后不可见)',
    classify('scripts/check-f.mjs', '// 这里解释 cat-file 是什么\nexport const x = 1\n').kind,
    'no-content',
  )
  eq(
    'F8 自豁免在位(本门不得把自己判红)',
    classify('scripts/check-gate-face-discipline.mjs', GIT).kind,
    'self',
  )
  // 聚合的两档方向:同一份散写,提交档判红、全量档只报数
  const v = [{ file: 'scripts/check-b.mjs', kind: 'loose-git', why: 'x' }]
  eq('F9 staged 档:散写判红', decide({ verdicts: v, mode: 'staged' }).exit, 1)
  eq(
    'F10 full 档:同一份散写只报数(存量不得钉红无关提交)',
    decide({ verdicts: v, mode: 'full' }).exit,
    0,
  )
  eq(
    'F11 取不到内容 ⇒ exit 2(不冒红也不记绿)',
    decide({ verdicts: [{ file: 'x', kind: 'unreadable', why: 'y' }], mode: 'staged' }).exit,
    2,
  )
  eq(
    'F12 全合规 ⇒ 0',
    decide({ verdicts: [{ file: 'x', kind: 'face', why: '' }], mode: 'staged' }).exit,
    0,
  )
  eq(
    'F13 unknown 一律不进红(宁漏不误报)',
    decide({ verdicts: [{ file: 'x', kind: 'unknown', why: '' }], mode: 'staged' }).exit,
    0,
  )
  // 遮噪两层各自的方向(第一版就是因为混用一层而 F1/F2 双双假绿)
  eq(
    'F14 注释里写 face-reader 路径不算合规(伪合规必须被拒)',
    classify('scripts/check-g.mjs', "// 建议改成 from './lib/face-reader.mjs'\n" + FS).kind,
    'loose-fs',
  )
  eq(
    'F15 模板串里的 readFileSync 不算调用(遮噪后不可见)',
    classify(
      'scripts/check-h.mjs',
      'const doc = `readFileSync(join(ROOT, x))`\nexport const y = 1\n',
    ).kind,
    'no-content',
  )
  eq(
    'F16 别名导入读取入口并真调用(as + 多行)⇒ face',
    classify(
      'scripts/check-i.mjs',
      "import {\n  catBatch as readBlobs,\n} from '../lib/face-reader.mjs'\nconst t = readBlobs(ROOT, ['HEAD:a.ts'])\n",
    ).kind,
    'face',
  )
  eq(
    'F16b 别名导入却从不调用 ⇒ 不算 face(收紧的边界:引了名字不等于用了它)',
    classify(
      'scripts/check-i2.mjs',
      "import {\n  catBatch as readBlobs,\n} from '../lib/face-reader.mjs'\nconsole.log(1)\n",
    ).kind,
    'no-content',
  )
  console.log(
    fail
      ? `\n❌ 自检 ${fail}/${ran} 例失败`
      : `\n全部 ${ran} 例通过(四形态分类 + 遮噪反向 + 两档方向对照 + 三态退出码)`,
  )
  process.exit(fail ? 1 : 0)
}

// §22d:被 import 时不得触发 CLI 副作用(镜像测试要 import 判据函数)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv[2] === '--self-test') selfTest()
  else process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  classify,
  decide,
  usesLayerRead,
  gitContentReads,
  prejoinedRepoConsts,
  readsPrejoinedConst,
  scanLiterals,
  scanSpans,
  regexCanStart,
  blankByMask,
  blankStrings,
  maskComments,
  REPO_CONTENT_DIR_RE,
  REPO_CONTENT_DIRS,
  REPO_CONTENT_FILE_RE,
  FS_READ_FNS,
  GATE_GLOB,
  SELF_EXEMPT,
  analyze,
  listGates,
  SELF_SKIP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
