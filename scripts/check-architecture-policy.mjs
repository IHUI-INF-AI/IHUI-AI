#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:架构契约门(从声明反查违规)
 *
 * 与既有守门链的分工:其余门是**按违规模式堆出来的**(发现一类事故 → 写一条判据);
 * 本门读 config/architecture-policy.yaml 这张**声明表**,反过来从声明查违规:
 *   T1 表自洽性(声明与现实脱节即红)
 *   C1 单文件行上限 / C2 契约文件行上限 / C3 对外公开出口数 / C4 单文件公开方法数(2026-10-07 补,G-815990)
 *   D1 未声明的跨模块依赖 / D2 依赖方向违反层序 / D3 穿透公开入口的深导入 / D4 现实 import 成环
 *   X1 表级例外缺到期日 / X2 表级例外已过期(2026-09-27 补:豁免只有出生、没有死亡)
 *   DC 纳管模块内新增裸 lint 抑制(2026-09-27 补;棘轮锚点 = **该文件 HEAD 自身存量**)
 *
 * 渐进收口(设计前提:**不得造出一台恒红的机器**)
 *   - 违规归属"发起 import 的那个文件所在模块";模块 managed:false ⇒ 只报数、不计退出码。
 *   - 不套 managed 开关、全仓即时的判红:C1(阈值高于 HEAD 实测最大文件)与 T1;本片另加一条同类
 *     X2(例外已过期 —— 现读存量 0 条,且它是时刻事件不是"本次提交改了表",棘轮救不了它)。
 *     DC 是**锚点上升才红**的棘轮判据,在两种档位下都不会把存量转嫁成无关提交的红。
 *   - 翻 managed:true 之前先跑 `--managed-trial <id>` 看看到底几条。
 *
 * X1 的存量与收紧方式(照抄本仓锚点规矩,不另发明):锚点 = **锚点面(HEAD 那份表)里同样没有合法
 *   `until` 的例外 id 集合**。全量档内容与锚点同面 ⇒ 存量恒只报数(HEAD 面因此不新增任何一格红);
 *   `--staged` 档锚点取 HEAD,所以"这一次新登记一条无日期例外"当场判红 —— 要求(必须有到期日)由提交链
 *   强制。存量 EX-C2-1 **已于 2026-10-04 按那把收口票的三步同枚兑现**(拆 `packages/types/src/app.ts`
 *   为 12 个业务域文件 + barrel 再导出 → 删 `EX-C2-1` → 翻 `managed:true` 并把镜像 T13 的
 *   `MANAGED_FALSE_LEDGER` 清空),现读表级例外 0 条 ⇒ 这一维今天没有待裁存量。
 *   留在文中的是**方法**而不是那一笔:一条例外的 reason 若只有**事件条件**而全文没有一个日期,
 *   **不得凭记忆给它编一个到期日**(编出来的日期会替下一个接手人做出"这笔债到某年就自动合法"的判断),
 *   出路只有把收口动作的几步做成**同枚提交** —— 缺任一步都留下一道恒红门。
 *   问责走 `--strict`(它把待裁存量也判红),与本门 E2"未齐备默认只报数"同一套制度。
 *   X2 刻意**不套棘轮**:过期是一个**时刻事件**而不是"本次提交改了表",且现读存量 0 条 ——
 *   与守门 108 的 E2(已过期仍生效 ⇒ 判红、只点名不自动摘除)是同一条口径。
 *
 * DC 为什么进架构判据:`@ts-ignore` / `eslint-disable` 那道守门(34)是 warn 级,而守门 108 的 E3
 *   对这一族**只报数**,所以"每加一条抑制,该文件的规则覆盖永久归零"在账面上是绿的。纳管模块
 *   (managed:true)既然声明了契约,就必须把"契约是否仍被执行"一起报出来。计数实现**只有一份**:
 *   直接 import 守门 108 的 `scanFile()`(同一件事两处各写一遍必漂移,那是本仓记过最多次的失效型),
 *   喂给它的是 `blankStrings(text)` 之后的面 —— 抑制指令住在注释里(所以不能剥注释),但字符串/正则
 *   字面量里的同名样例会被算成抑制(真仓实测:`scripts/tests/check-ts-ignore.test.mjs` 原始面 34 处、
 *   清空字面量后 3 处;门把自己写的散文判成违规那一型,守门 131 同日刚踩过)。
 *
 * 内容口径(与本仓高阶门同取向):**三个面,一次只认一个,取不到就判"无法判定",绝不回落。**
 *   缺省(全量档)   判 HEAD blob
 *   `--staged`      判索引 blob(只咬暂存源文件;暂存集为空 ⇒ 回退 HEAD 全量,并大声写明)
 *   `--worktree`    判磁盘副本 —— **仅人工 / 逃生舱**,路径清单仍是被跟踪的路径(未跟踪文件不在
 *                    任何面的射程内,这一条印在口径行里);该档取不到策略表 ⇒ exit 2,
 *                    **不回落** HEAD/索引 —— 回落就是把"没判到"写成"判过了"。
 *   `--staged` 与 `--worktree` 同给 ⇒ exit 2「矛盾旗标」(任选一面都会让另一面成为假绿)。
 *   共享工作树常年滞后 HEAD,所以问责一律走前两个面;按磁盘判会在恒红/假绿之间来回跳。
 *   DC 与 X1 的**锚点面恒为 HEAD**(棘轮):凡内容面不是 HEAD 的档(暂存窄口径 / 工作树)都按当前面
 *   预筛补读 HEAD,不整面重读;取不到的文件按存量 0 起算 ⇒ 新文件里的裸抑制同样拦。
 *
 * 参数闸门(2026-09-29 与 `--worktree` 同批立):**未知旗标不得掉进默认分支。**
 *   此前 `main(argv)` 只 `argv.includes(已知旗标)`,不认识的 token 被静默忽略,于是
 *   `--worktree`(当时从未实现)直接落进默认 HEAD 档并打出 HEAD 的结论 —— 实测
 *   `--worktree --json` 与 `--json` 输出逐字同形(RC 同为 1),传旗标的人有充分理由以为自己在审
 *   工作树,而实际审的是上一提交态(与本仓 `plan-tasks-merge.mjs`「未知参数降级成无参就是造
 *   合格证」、`i18n-apply --help` 进写盘模式是同一条禁令)。现:不认识的旗标、以及没被值旗标
 *   领着的裸位置参数 ⇒ **exit 2 并原样点名**,且不打印任何一档的结论。
 *   白名单与"谁能吃位置参数"共用 `VALUE_FLAGS` 这一份名单(分两处写必然自相矛盾:旗标认识、
 *   值被当成未知位置参数拒掉,那道拒绝误用的判据就会把自己的合法用法拒了)。
 *
 * 用法:
 *   node scripts/check-architecture-policy.mjs                  # 全量(判 HEAD)
 *   node scripts/check-architecture-policy.mjs --staged         # pre-commit(判索引,只咬暂存文件;暂存集为空 ⇒ 回退全量)
 *   node scripts/check-architecture-policy.mjs --worktree       # 仅人工:判磁盘副本(不回落 HEAD;两面旗同给判死)
 *   node scripts/check-architecture-policy.mjs --json           # 机器可读报告
 *   node scripts/check-architecture-policy.mjs --managed-trial packages/sdk
 *   node scripts/check-architecture-policy.mjs --strict         # 未登记模块/存量债也判红(人工巡检用,默认关)
 *   node scripts/check-architecture-policy.mjs --self-test      # 成对正反例自检
 * 紧急跳过:HUSKY_SKIP_ARCH_POLICY=1 git commit ...
 */
import { readFileSync } from 'node:fs'
import { dirname as pDirname, resolve as pResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { blankStrings, maskCommentsAndStrings } from './lib/code-mask.mjs'
// DC 的计数实现与守门 108 共用**同一份** `scanFile()`(两处算同一件事必漂移,本仓最高频失效型);
// "到期日当天仍有效、次日才判红"这条方向也直接取它那份 `isPast()` —— 守门 108 的作者在写它时
// 恰恰把方向弄反过一次(表现是 9 条自检一起红),所以这里不再抄第二遍判序。
// 生产面跨 check-*.mjs 导入在本仓有先例(check-admin-gate-consistency / check-baseline-freshness /
// heal-worktree-tracked 都 import 兄弟门的导出),且被 import 的这两个函数都是**纯函数**、
// 该模块 import 时零副作用(实测 import 后无任何输出、不读基线、不派生 git)。
import { scanFile as scanExemptionLedger, __test__ as expiryKit } from './check-exemption-expiry.mjs'
// G-406,2026-10-07:缺陷②(--changed/staged 触发面不沿反向依赖)的加宽引擎只有这一份实现
// (scripts/lib/import-graph.mjs,2026-10-04 G-406 ② 在 check-typecheck 先落了消费先例)。
// 本门只**消费** buildFileGraph / widenOverDependents,不自己再写一遍边判定 —— 两处实现必漂移。
import { buildFileGraph, widenOverDependents } from './lib/import-graph.mjs'

const ROOT = pResolve(pDirname(fileURLToPath(import.meta.url)), '..')
const POLICY_REL = 'config/architecture-policy.yaml'
const SELF_SKIP = 'HUSKY_SKIP_ARCH_POLICY'
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const GIT_TIMEOUT = 180000
/**
 * 三个判定面的**唯一**名字。`readFace` / `treePaths` / `declarationContext` 的第三个参数都吃它
 * (兼容旧调用形态的 rev 串见 `revToFace`)。刻意不用布尔 `isStaged` 当参数 ——
 * "多一个面就得记两件事"正是 `--worktree` 掉进默认分支的原因(见头注「参数闸门」)。
 */
const FACES = ['head', 'staged', 'worktree']
/** 面名 → git rev 前缀(工作树面没有 rev,用哨兵串,由 readFace 分流到磁盘读法) */
const FACE_REV = { head: 'HEAD', staged: '', worktree: 'worktree' }
/** 面名 → 报告里用的中文面名(与 `pickPolicySource` 的候选标签同一套词,两处不得各写一份) */
const FACE_LABEL_CN = { head: 'HEAD', staged: '索引', worktree: '工作树' }
/**
 * 认识的旗标 —— **唯一**一份。不在这里的旗标一律拒(见 `inspectArgs`),绝不静默忽略:
 * 静默忽略的结局是把"审 HEAD"打印成看起来像"审工作树",而账面一切正常。
 * `--self-test` 由文件末尾的 CLI 入口先接走,但仍要登记在这里 —— 漏了它,`--self-test`
 * 与别的旗标同给时会被本闸门先拒掉(那等于把自检出口关掉)。
 */
const KNOWN_FLAGS = ['--staged', '--worktree', '--json', '--strict', '--self-test', '--managed-trial']
/** 吃"紧邻下一个 token 作为值"的旗标(与 KNOWN_FLAGS 同一处维护,分两处写必然自相矛盾)。 */
const VALUE_FLAGS = ['--managed-trial']

/** 表级例外到期日的**唯一**格式:`20YY-MM-DD`(年份值域与守门 108 的 `DATE_RE` 逐字同族,两把尺子
 *  不得对"什么叫一个日期"给出两种答案)。非法月日判"没有日期",绝不进 NaN 比较
 *  (NaN 与任何日期比较都是 false ⇒ 一条写歪的到期日会永久不红,守门 108 同一条禁令)。
 *  世纪被钉在 `20` 开头是**刻意的**:`until: '2999-12-31'` 这种"把永久豁免写成有日期"的形态按格式拒绝,
 *  它会落进 X1(无合法到期日)而不是被当成"还有九百多年"放过。 */
const UNTIL_RE = /^(20\d{2})-(\d{2})-(\d{2})$/
/**
 * DC 预筛:必须是判据字面量的**严格超集** —— 守门 108 的 `SUPPRESS_KINDS` 认的两个形态
 * (`eslint-disable[-next-line|-line|-unrestricted]` 与 `@ts-(ignore|nocheck)`)都必然含下面两个串之一。
 * 预筛漏字面量 = 门对整型缺陷全盲而账面报绿(守门 102/113 各记过一次,由"预筛必须是超集"的对账钉住)。
 */
const SUPPRESS_PREFILTER = ['eslint-disable', '@ts-']
const RULES = {
  'table-integrity': 'T1 策略表与现实脱节',
  'file-lines': 'C1 单文件行上限',
  'contract-file-lines': 'C2 契约文件行上限',
  'public-exports': 'C3 对外公开出口数上限',
  'public-methods': 'C4 单文件公开方法数上限',
  'undeclared-dependency': 'D1 未声明的跨模块依赖',
  'layer-direction': 'D2 依赖方向违反层序',
  'deep-import': 'D3 穿透公开入口的深导入',
  'module-cycle': 'D4 现实 import 边成环',
  // ── 声明齐备性两判(2026-09-25 补,MECHANISM-SPEC-2 §4)──
  // 方向与 T1 同源:**表里写了什么,现实里就必须有什么**。此前 T1 只对账 `roots`,
  // 而 `public_entrypoints` 是 D3 深导入的唯一依据 —— 入口被改名/搬走而表没跟上时,
  // D3 就对着空气工作(判据存在而审的是不存在的对象 = 没有)。
  'entrypoint-missing': 'E1 声明的公开入口在取材面里不存在',
  'contract-artifact-missing': 'E2 纳管模块缺契约工件/声明的契约文件不存在',
  // ── 豁免/抑制的"寿命"两判(2026-09-27 补,与守门 108 的 E1/E2 同一个母题型:只有出生、没有死亡)──
  // 表级例外此前只要求 id/rule/reason(见 auditPolicy 的畸形条目判据),登记一次就永久豁免;
  // lint 抑制此前只由守门 34(warn)与 108 的 E3(只报数)看着,加一条等于该文件契约覆盖永久归零而账面全绿。
  'exception-no-until': 'X1 表级例外缺合法到期日 until(存量按锚点棘轮只报数,新增即红;问责走 --strict)',
  'exception-expired': 'X2 表级例外的 until 已过期(即时判红并点名 id)',
  'lint-suppression-growth': 'DC 纳管模块内该文件新增裸 lint 抑制(锚点 = 该文件 HEAD 自身存量)',
}
/** 不受 managed 开关约束、全仓即时判红的规则 */
const ALWAYS_RED = new Set(['table-integrity', 'file-lines'])
/** 入口存在性判据的取用形态:仓库相对路径恒正斜杠,故扩展名表是**唯一**一份(module-context 复用) */
const ENTRY_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.mjs']
/** 模块自述/契约文档名(齐备性判据的合法工件之一;新增名字改这一处) */
const MODULE_DOC_NAMES = ['README.md', 'AGENTS.md', 'CONTEXT.md', 'CONTRACT.md']

/**
 * 一律经 `scripts/lib/face-reader.mjs`。此前本门把 git **硬编码成** `C:/Program Files/Git/cmd/git.exe`,
 * 那是"换机/换安装位置即失效"的一档 —— 层的 `gitBinary()` 认 PortableGit / IHUI_GIT_BIN / 绝对路径探测,
 * 并且 timeout / maxBuffer / quotepath / windowsHide 都在同一处封顶(本门一次要读 512MB 量级)。
 * 预算保持不变:180s / 1<<29,与原实现逐字同档,免得收口顺带把超时口径改了。
 */
const git = (args) => gitRaw(args, ROOT, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 29 })

// ── 受限 YAML 子集解析器 ───────────────────────────────────────────────────────────────
// 只支持策略表实际用到的形态:缩进块、`key: value`、`key:` + 子块、`- 标量`、`- key: value`、
// 行内空列表 `[]`。**认不出的行一律抛错**(上层 exit 2「无法判定」),绝不静默跳行 ——
// 静默跳过的后果是"扫到 0 条却报绿",那是本仓反复踩过的同一类失效。
class YamlError extends Error {}

function parseYaml(src, label = 'policy') {
  const rows = []
  src.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim() || /^\s*#/.test(raw)) return
    if (/^\t/.test(raw)) throw new YamlError(`${label}:${i + 1} 用了 Tab 缩进,YAML 只允许空格`)
    rows.push({ n: i + 1, indent: raw.length - raw.trimStart().length, text: raw.trim() })
  })
  if (!rows.length) throw new YamlError(`${label}:空文档`)
  let p = 0
  const scalar = (s, n) => {
    if (s === '[]') return []
    if (s === '{}') return {}
    if (/^-?\d+$/.test(s)) return Number(s)
    if (s === 'true' || s === 'false') return s === 'true'
    if (s === 'null' || s === '~') return null
    const q = s[0]
    if ((q === "'" || q === '"') && s.length >= 2 && s[s.length - 1] === q) return s.slice(1, -1)
    if (q === "'" || q === '"') throw new YamlError(`${label}:${n} 引号没有闭合: ${s}`)
    if (/[:#]\s/.test(s)) throw new YamlError(`${label}:${n} 裸标量含 ": " 会歧义,请加引号: ${s}`)
    return s
  }
  const parseBlock = (minIndent) => {
    const first = rows[p]
    if (!first || first.indent < minIndent) return null
    return first.text.startsWith('- ') ? parseList(first.indent) : parseMap(first.indent)
  }
  const parseMap = (indent) => {
    const out = {}
    while (p < rows.length) {
      const row = rows[p]
      if (row.indent < indent) break
      if (row.indent > indent) throw new YamlError(`${label}:${row.n} 缩进比父级更深,不是合法键值行: ${row.text}`)
      if (row.text.startsWith('- ')) break
      const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(row.text)
      if (!m) throw new YamlError(`${label}:${row.n} 不是 key: value 形态: ${row.text}`)
      p++
      const rest = m[2].trim()
      if (rest !== '') out[m[1]] = scalar(rest, row.n)
      else {
        const nxt = rows[p]
        if (!nxt) out[m[1]] = null
        else if (nxt.indent > row.indent) out[m[1]] = parseBlock(row.indent + 1)
        // 同缩进列表风格(`requires:` 与 `- 'x'` 齐平)也要认,否则换个写法就整表解析失败
        else if (nxt.indent === row.indent && nxt.text.startsWith('- ')) out[m[1]] = parseList(row.indent)
        else out[m[1]] = null
      }
    }
    return out
  }
  const parseList = (indent) => {
    const out = []
    while (p < rows.length) {
      const row = rows[p]
      if (row.indent < indent) break
      if (row.indent > indent) throw new YamlError(`${label}:${row.n} 列表项缩进异常: ${row.text}`)
      if (!row.text.startsWith('- ')) throw new YamlError(`${label}:${row.n} 期望 "- 项",实得: ${row.text}`)
      const body = row.text.slice(2).trim()
      if (body === '') throw new YamlError(`${label}:${row.n} 不支持裸 "-" 起手的嵌套列表项`)
      const inline = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(body)
      if (!inline) {
        out.push(scalar(body, row.n))
        p++
        continue
      }
      // `- key: value` ⇒ 映射项;其后续键与 "- " 后的列对齐(indent + 2)
      const itemIndent = row.indent + 2
      rows[p] = { n: row.n, indent: itemIndent, text: body }
      const first = rows[p]
      p++
      let item
      {
        const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(first.text)
        item = {}
        const rest = m[2].trim()
        if (rest !== '') item[m[1]] = scalar(rest, row.n)
        else {
          const nxt = rows[p]
          item[m[1]] = nxt && nxt.indent > itemIndent ? parseBlock(itemIndent + 1) : null
        }
      }
      Object.assign(item, parseMap(itemIndent))
      out.push(item)
    }
    return out
  }
  const doc = parseMap(rows[0].indent)
  if (p !== rows.length) throw new YamlError(`${label}:解析在第 ${rows[p].n} 行提前停下,判据不可信`)
  return doc
}

// ── glob:只支持 ** 与 * 两种通配;段内 * 不跨 "/" ──────────────────────────────────────
function globToRe(g) {
  const segs = g.split('/')
  let re = '^'
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    const last = i === segs.length - 1
    if (s === '**') {
      if (last) return `${re}.*$`
      re += '(?:[^/]+/)*'
      continue
    }
    re += s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
    if (!last) re += '/'
  }
  return `${re}$`
}
const mkMatcher = (patterns) => {
  const res = (patterns || []).map((g) => new RegExp(globToRe(g)))
  return (p) => res.some((r) => r.test(p))
}

/** 仓库相对路径恒为正斜杠,不得过 node:path 的 win32 语义(那会把分隔符换成反斜杠,
 *  于是 relFrom 的 `..` 归一在 Windows 上永远算不出跨模块路径 —— 判据静默失效)。 */
const relDir = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')

/** 仓库相对路径下的 `..` 归一(不依赖 node:path 的平台语义:表里的路径恒为正斜杠) */
export function relFrom(fromDir, spec) {
  const segs = fromDir.split('/').filter(Boolean)
  for (const s of spec.split('/')) {
    if (s === '' || s === '.') continue
    if (s === '..') segs.pop()
    else segs.push(s)
  }
  return segs.join('/')
}

// ── 导入说明符提取:行首锚定 + 反引号奇偶 + 注释跳过 ─────────────────────────────────────
// 宽松匹配会产出**假边**(2026-09-24 实测 4 类 12 处):JSDoc 里写的示例 import、
// lint 规则的提示文案、代码生成器拼的模板字符串、文档站的示例块。
function braceDepth(line) {
  const s = line.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""')
  return (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length
}
export function extractSpecs(text) {
  const lines = text.split('\n')
  const out = []
  let tick = 0
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i]
    const inTpl = tick % 2 === 1
    tick += (first.match(/(?<!\\)`/g) || []).length
    if (inTpl) continue
    if (/^\s*(\/\/|\*|\/\*)/.test(first)) continue
    if (!/^import\b/.test(first) && !/^export\s+(?:type\s*)?[*{]/.test(first)) continue
    const bare = /^import\s+['"]([^'"]+)['"]/.exec(first)
    if (bare) {
      out.push({ spec: bare[1], line: i + 1 })
      continue
    }
    let stmt = first
    let j = i
    let depth = braceDepth(first)
    // 终止条件允许**行尾注释**:`import { x } from 'y' // arch-exempt: 原因` 是一条真导入,
    // 若只认 `from '...'` 结尾,加了豁免注释反而让这条导入消失 —— 豁免通道自己把判据关掉。
    while (!(depth === 0 && /from\s*['"][^'"]+['"]\s*;?\s*(?:\/\/.*)?$/.test(stmt))) {
      if (depth === 0) {
        stmt = '' // 括号已闭合却没有 from ⇒ 纯本地导出,不是导入语句
        break
      }
      j++
      if (j - i > 30 || j >= lines.length || /^\s*(\/\/|\*|\/\*)/.test(lines[j])) {
        stmt = ''
        break
      }
      stmt += '\n' + lines[j]
      depth += braceDepth(lines[j])
    }
    if (!stmt) continue
    const m = /from\s*['"]([^'"]+)['"]/.exec(stmt)
    if (m) out.push({ spec: m[1], line: i + 1 })
  }
  return out
}

// ── 策略装载 ───────────────────────────────────────────────────────────────────────────
export function loadPolicy(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new YamlError('策略表根节点必须是映射')
  if (typeof doc.version !== 'number') throw new YamlError('策略表缺 version(或不是数字)')
  if (!Array.isArray(doc.layers) || !doc.layers.length) throw new YamlError('策略表缺 layers —— 无层序声明时方向判据不成立,不得记为通过')
  if (!Array.isArray(doc.modules) || !doc.modules.length) throw new YamlError('策略表缺 modules —— 扫描面为空不得记为通过')
  const layers = new Map()
  for (const l of doc.layers) {
    if (!l || typeof l.id !== 'string' || typeof l.rank !== 'number') throw new YamlError(`layers 条目必须带 id 与数字 rank:${JSON.stringify(l)}`)
    layers.set(l.id, l.rank)
  }
  const modules = new Map()
  for (const m of doc.modules) {
    if (!m || typeof m.id !== 'string') throw new YamlError(`modules 条目缺 id:${JSON.stringify(m).slice(0, 60)}`)
    if (modules.has(m.id)) throw new YamlError(`模块 id 重复:${m.id}`)
    const roots = Array.isArray(m.roots) ? m.roots.map((r) => String(r).replace(/\/+$/, '')) : []
    modules.set(m.id, {
      id: m.id,
      pkg: typeof m.package === 'string' && m.package !== '-' ? m.package : null,
      layer: m.layer,
      rank: layers.has(m.layer) ? layers.get(m.layer) : null,
      exported: m.exported === true,
      managed: m.managed === true,
      roots,
      requires: new Set(Array.isArray(m.requires) ? m.requires : []),
      entrypoints: Array.isArray(m.public_entrypoints) ? m.public_entrypoints : [],
      // E2 的最小新增键:模块**显式声明**的契约/自述工件清单(可选)。
      // 语义与 public_entrypoints 同一族 —— 声明了就必须在取材面里存在;没声明的模块
      // 退而认 contract_file_patterns 命中或模块根下的自述文档(见 moduleContractArtifacts)。
      contractFiles: Array.isArray(m.contract_files) ? m.contract_files.map(String) : [],
    })
  }
  const cons = doc.constraints || {}
  for (const k of ['max_file_lines', 'max_contract_file_lines', 'max_public_exports'])
    if (typeof cons[k] !== 'number' || cons[k] <= 0) throw new YamlError(`constraints.${k} 缺失或不是正数`)
  // C4(G-815990)是**声明驱动**的软键:表里没有该键 ⇒ C4 这一维不装载(生产表必须显式声明阈值,
  //   夹具/旧面缺键不炸,否则 HEAD 面上那份旧表会让所有档集体 exit 2);键存在但不是正数 ⇒ 显式抛错,
  //   不静默降级 —— 静默降级的结局是"阈值写歪了却账面全绿"(本仓最高频的失效型)。
  if (cons.max_public_methods !== undefined && (typeof cons.max_public_methods !== 'number' || cons.max_public_methods <= 0))
    throw new YamlError('constraints.max_public_methods 存在但不是正数')
  return {
    version: doc.version,
    modules,
    layers,
    exceptions: Array.isArray(doc.exceptions) ? doc.exceptions : [],
    maxFileLines: cons.max_file_lines,
    maxContractLines: cons.max_contract_file_lines,
    maxPublicExports: cons.max_public_exports,
    maxPublicMethods: typeof cons.max_public_methods === 'number' && cons.max_public_methods > 0 ? cons.max_public_methods : null,
    contractPatterns: cons.contract_file_patterns || [],
    scanExcludes: cons.scan_excludes || [],
    testExempts: cons.deep_import_test_exempts || [],
    forbidCycles: cons.forbid_cycles !== false,
    forbidDeep: cons.forbid_deep_imports !== false,
  }
}

const exHit = (P, rule, file) => (P.exceptions || []).find((e) => e && e.rule === rule && (typeof e.file !== 'string' || e.file === file))
/** 一条都没命中的例外 = 清单腐烂候补(豁免的存在理由已经消失,却还挂在表上)。
 *  只在**全量面**报:暂存面里绝大多数例外天然不命中,按暂存面判会让每次提交都喊。 */
export function unusedExceptions(P, hitIds, face) {
  if (face !== 'HEAD') return []
  return (P.exceptions || []).filter((e) => e && e.id && !hitIds.has(e.id)).map((e) => e.id)
}

/** 例外条目的 `until` 是否是合法日期字符串(格式 + 月日值域;见 UNTIL_RE 的 NaN 禁令)。 */
export function validUntil(v) {
  if (typeof v !== 'string') return false
  const m = UNTIL_RE.exec(v.trim())
  if (!m) return false
  const mo = Number(m[2])
  const dy = Number(m[3])
  return mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31
}

/** 一张表里"没有合法到期日"的例外 id 集合 —— X1 的锚点面与判据面共用这一份实现(两处各算必漂移)。 */
export function undatedExceptionIds(P) {
  return new Set((P.exceptions || []).filter((e) => e && e.id && !validUntil(e.until)).map((e) => e.id))
}

/** DC 的廉价预筛(必须是判据字面量的超集,见 SUPPRESS_PREFILTER)。 */
export function mayHaveSuppression(text) {
  return typeof text === 'string' && SUPPRESS_PREFILTER.some((k) => text.includes(k))
}

/**
 * 一个文件里的 lint 抑制**条数**。
 * 判据面 = `blankStrings(text)`(剥字符串/正则字面量的**体**、保住注释与行号)喂给守门 108 的
 * `scanFile()` 的 `suppressions` 计数 —— 抑制指令住在注释里,所以**不能**剥注释(剥了就等于门对
 * 自己立项那一型全盲);而字面量里的同名样例必须剥,否则"解释这条禁令的散文"会被算成违规
 * (真仓实测:`scripts/tests/check-ts-ignore.test.mjs` 原始面 34 处 / 清空后 3 处)。
 * 与守门 108 的 E3 读数因此**刻意可以不同**(它按原始面只报数),但**计数规则只有一份**。
 */
export function suppressionCount(text) {
  if (!mayHaveSuppression(text)) return 0
  const sup = scanExemptionLedger('virtual', blankStrings(text)).suppressions
  return Object.values(sup).reduce((a, b) => a + (Number(b) || 0), 0)
}

/**
 * 一个文件里的**公开方法**数(G-815990,2026-10-07 新增 C4)。
 * 判据面 = `maskCommentsAndStrings(text)` 之后逐行匹配 `^\s*export\s+(default\s+)?(async\s+)?(function|class|const|let|var)\b`:
 *   注释里的示例与字符串/模板字面量里的同名样例必须剥(与 DC 用 blankStrings 是同一母题 ——
 *   门把自己的散文判成违规那一型,守门 131 同日刚踩过);`export type/interface/enum` 与
 *   `export { … }` 再导出不算方法,`export *` barrel 也不算。
 * 阈值唯一真源在策略表 `constraints.max_public_methods`(表里没声明 ⇒ C4 不装载;键在但非正数
 *   ⇒ loadPolicy 抛错)。阈值取 2026-10-07 HEAD 实测分布上沿,依据写在 yaml 注释里,与 C1 同一做法。
 */
const PUBLIC_METHOD_RE = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\b/

export function publicMethodCount(text) {
  if (typeof text !== 'string' || !text) return 0
  let n = 0
  for (const line of maskCommentsAndStrings(text).split('\n')) if (PUBLIC_METHOD_RE.test(line)) n++
  return n
}

/**
 * X1 / X2:表级例外的寿命判据。纯函数,锚点由调用方注入(证明取材面行为只能用构造面)。
 *
 * 三条判序,每条都由自检成对钉住:
 *  - **合法 until 且已过期** ⇒ X2 判红并点名 id。不套棘轮:过期是**时刻**事件而不是"本次改了表",
 *    棘轮(锚点=HEAD 那份表)会把它洗成"别人欠的、与我无关",而唯一的修复出口(续期或删条目)
 *    恰恰需要有人被拦住一次。现读存量 0 条 ⇒ 今天不产生任何恒红面。
 *  - **没有合法 until** ⇒ 该 id 在锚点面上同样没有合法 until ⇒ 存量,只报数(`--strict` 才判红);
 *    锚点面上不是存量(即本次新增)⇒ X1 判红。锚点取不到(`null`)⇒ **不设基线**,一律按新增问责,
 *    与本门 `filterNewTableDefects` 注释里那句"宁可多报,绝不静默放过"同一条,并且必须大声说明。
 *  - **合法 until 且未过期** ⇒ 不判红,只计数(这条是"到期日当天仍有效、次日才判红"的
 *    `isPast()` 口径的直接投影,方向由守门 108 的 D01–D03 钉着,本门不重抄判序)。
 *  调用方给的 `today` 本身不是合法日期 ⇒ 整条"过期与否"判不了 ⇒ 记 `expiryUndetermined` 并报名,
 *  **既不冒红也不记绿**(把没判写成判过了是本仓最高频的失效型)。
 *
 * @param {ReturnType<loadPolicy>} P 当前取材面的策略表
 * @param {{anchorUndatedIds?:Set<string>|null,today:string,strict?:boolean}} opts
 *   anchorUndatedIds=null 表示锚点面(HEAD 那份表)取不到/解不开
 */
export function auditExceptionExpiry(P, opts = {}) {
  const today = typeof opts.today === 'string' ? opts.today.trim() : ''
  // `today` 自身不合法 ⇒ "过期与否"这一维**判不了**。绝不冒红,也绝不记成"未过期"(那正是把没判
  // 写成判过了);它进 expiryUndetermined 计数并由输出面大声报名(与本仓"取不到判无法判定"同一条)。
  const todayOk = UNTIL_RE.test(today)
  const strict = opts.strict === true
  const anchorMissing = opts.anchorUndatedIds === null || opts.anchorUndatedIds === undefined
  const anchor = anchorMissing ? null : opts.anchorUndatedIds
  const hard = []
  const soft = []
  const counters = { exceptions: 0, dated: 0, undated: 0, undatedStock: 0, expired: 0, anchorMissing: anchorMissing ? 1 : 0, malformed: 0, expiryUndetermined: 0 }
  const push = (rule, msg, isSoft) => {
    const v = { rule, file: POLICY_REL, line: 0, managed: true, msg }
    if (isSoft) v.soft = true
    ;(isSoft ? soft : hard).push(v)
  }
  for (const e of P.exceptions || []) {
    if (!e || !e.id) {
      // 连 id 都没有的条目由 T1 的畸形判据点名(它必须"必须带 id/rule/reason"),这里不重复计债,
      // 但也不能当"没有例外"放过 —— 它进 malformed 计数,由输出面报名。
      counters.malformed++
      continue
    }
    counters.exceptions++
    if (!validUntil(e.until)) {
      counters.undated++
      const stock = anchor ? anchor.has(e.id) : false
      if (stock) counters.undatedStock++
      push(
        'exception-no-until',
        `例外 ${e.id} 没有合法的 until(YYYY-MM-DD)。表级豁免现在等于**永久**豁免 —— ${stock ? '它是锚点面(HEAD 那份表)已有的存量,本片只报数不判红(存量不得转嫁成无关提交的红),要问责跑 --strict;解阻动作是给它一个有出处的到期日,或直接删掉这条已经不需要了的例外' : '它是本次新登记的(锚点面没有同 id 的无日期例外)⇒ 判红:登记一条表级豁免必须同时写下它到什么时候为止(reason 里那句"拆完之前"是事件条件,不是日期)'}`,
        stock && !strict,
      )
      continue
    }
    counters.dated++
    const iso = String(e.until).trim()
    if (!todayOk) {
      counters.expiryUndetermined++
      continue
    }
    if (expiryKit.isPast(iso, today)) {
      counters.expired++
      push('exception-expired', `例外 ${e.id} 的到期日 ${iso} 已过(今天 ${today})却仍挂在表上 ⇒ 判红并点名:id=${e.id}。处置只有两条 —— 续期(改日期并说明为什么还开着)或删除该条;**门不替你勾掉它**`, false)
    }
  }
  return { hard, soft, counters }
}

/** public_entrypoints 是"子路径白名单":'.' 只对应裸包名(不走本判据),'./x' 精确、'./x/*' 前缀 */
export function matchEntrypoint(m, sub) {
  return m.entrypoints.some((p) => {
    const pat = p === '.' ? null : String(p).replace(/^\./, '')
    if (pat === null || pat === '') return false
    if (!pat.includes('*')) return pat === sub
    return new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(sub)
  })
}

// ── T1:表与现实对账 ────────────────────────────────────────────────────────────────────
export function auditPolicy(P, existingPaths) {
  const v = []
  const existing = new Set(existingPaths)
  const push = (msg) => v.push({ rule: 'table-integrity', file: POLICY_REL, line: 0, managed: true, msg })
  for (const m of P.modules.values()) {
    if (m.rank === null) push(`模块 ${m.id} 的 layer "${m.layer}" 不在 layers 清单里`)
    if (!m.roots.length) push(`模块 ${m.id} 没声明 roots —— 它的文件永远不会被本门扫描`)
    for (const r of m.roots) {
      const hit = [...existing].some((p) => p === r || p.startsWith(r + '/') || p.startsWith(r + '.'))
      if (!hit) push(`模块 ${m.id} 声明的 roots/${r} 在当前取材面里不存在(表与现实脱节)`)
    }
    for (const d of m.requires) {
      const t = P.modules.get(d)
      if (!t) {
        push(`模块 ${m.id} requires 了未登记的模块 ${d}`)
        continue
      }
      if (m.rank !== null && t.rank !== null && t.rank > m.rank) push(`模块 ${m.id}(rank ${m.rank})声明依赖更上层的 ${d}(rank ${t.rank}) —— 层序自相矛盾`)
      if (!t.exported) push(`模块 ${m.id} 声明依赖 ${d},但 ${d} 标了 exported:false(端应用/工具不对外),这条声明本身就是违规`)
    }
  }
  const state = new Map()
  const walk = (id, chain) => {
    if (state.get(id) === 2) return
    if (state.get(id) === 1) {
      push(`requires 声明成环:${[...chain, id].join(' → ')}`)
      return
    }
    state.set(id, 1)
    const m = P.modules.get(id)
    for (const d of m ? m.requires : []) walk(d, [...chain, id])
    state.set(id, 2)
  }
  for (const id of P.modules.keys()) walk(id, [])
  const list = [...P.modules.values()]
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      for (const a of list[i].roots)
        for (const b of list[j].roots) {
          if (a === b || a.startsWith(b + '/') || b.startsWith(a + '/')) push(`模块 ${list[i].id} 与 ${list[j].id} 的 roots 重叠(${a} / ${b})—— 文件归属会有歧义`)
        }
    }
  for (const e of P.exceptions) {
    if (!e || !e.id || !e.rule || !e.reason) {
      push(`exceptions 条目必须带 id / rule / reason:${JSON.stringify(e).slice(0, 80)}`)
      continue
    }
    if (!P.modules.has(e.module)) push(`例外 ${e.id} 指向未登记的模块 ${e.module}`)
    if (typeof e.file === 'string' && !existing.has(e.file))
      v.push({ rule: 'table-integrity', file: POLICY_REL, line: 0, soft: true, msg: `例外 ${e.id} 指向的 ${e.file} 已不在取材面里(清单腐烂,请删该条)` })
  }
  return v
}

// ── E1 / E2:声明齐备性(纯函数,取材面由调用方注入) ─────────────────────────
// 与 auditPolicy(T1) 的分工:T1 只对账 `roots`,这里对账**剩下的两格声明** ——
// `public_entrypoints`(E1)与契约工件(E2)。三条判据共用同一个 ctx:
//   ctx = { tracked:Set<路径>, allPaths:路径[], manifestOf:(moduleId)=>清单对象|null }
// 抽成 ctx 注入而不是在函数里派生 git,是为了让 `--self-test` 与镜像测试能**构造面**
// (本仓教训:证明取材面行为只能用纯函数 + 构造面,不得依赖仓库瞬时状态)。
const inRoots = (m, p) => m.roots.some((r) => p === r || p.startsWith(r + '/'))
/**
 * 子路径模式里的 `*` 按 npm exports 语义**跨段**匹配 —— 与 `matchEntrypoint`(D3)同一族口径。
 * 这跟 `globToRe` 的"段内 `*`"不是一回事:拿段内 `*` 去判存在性,会把
 * `./messages/*` → `packages/i18n/messages/api/en.json` 这种多层命中算成"入口不存在",
 * 即**解析口径错**而不是真缺(E1 首跑就抓到这一条,故单列一份实现并在此说明)。
 */
const subPathRe = (pat) => new RegExp(`^${String(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
const stemOf = (p) => p.replace(/\.[^./]+$/, '')

const targetsOfExports = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap((x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.filter((y) => typeof y === 'string') : [])) : [])

/** 一个 public_entrypoints 条目解析到取材面里的真实文件(解析不到即 state:'missing') */
export function resolveEntrypoint(m, ep, ctx) {
  const root = m.roots[0]
  if (!root) return { ep, state: 'missing', path: null, how: '无 roots(该模块由 T1 点名)' }
  const key = ep === '.' ? '.' : ep.startsWith('./') ? ep : './' + ep.replace(/^\//, '')
  const rel = key.replace(/^\.\//, '')
  // 1) 约定式:模块根与根下 src/ 两条前缀,扩展名表逐一试
  if (key !== '.') {
    if (!rel.includes('*')) {
      for (const e of ENTRY_EXTS) {
        for (const base of [`${root}/${rel}${e}`, `${root}/src/${rel}${e}`]) {
          if (ctx.tracked.has(base)) return { ep, state: 'ok', path: base, how: '约定式路径' }
        }
      }
    } else {
      const hit = ctx.allPaths.find((p) => subPathRe(`${root}/${rel}`).test(p) || subPathRe(`${root}/src/${rel}`).test(p))
      if (hit) return { ep, state: 'ok', path: hit, how: '约定式 glob 命中' }
    }
  }
  const j = ctx.manifestOf ? ctx.manifestOf(m.id) : null
  const ex = j && j.exports && typeof j.exports === 'object' ? j.exports : null
  // 2) 主入口:裸包名 '.' 走 package.json 的 exports['.'] / main,再退到 index 约定
  if (key === '.') {
    const vals = ex ? targetsOfExports(ex['.']) : []
    if (typeof j?.main === 'string') vals.push(j.main)
    for (const t of vals) {
      const cand = `${root}/${String(t).replace(/^\.\//, '')}`
      if (ctx.tracked.has(cand)) return { ep, state: 'ok', path: cand, how: '包清单主入口' }
    }
    for (const cand of [`${root}/src/index.ts`, `${root}/index.ts`, `${root}/src/index.tsx`, `${root}/src/index.js`, `${root}/index.js`, `${root}/index.mjs`]) {
      if (ctx.tracked.has(cand)) return { ep, state: 'ok', path: cand, how: '主入口 index 约定' }
    }
    return { ep, state: 'missing', path: null, how: '主入口既无清单也无 index 文件' }
  }
  // 3) 包清单 exports 的显式子路径键(精确键或 glob 键)
  if (ex) {
    const declaredKey = Object.prototype.hasOwnProperty.call(ex, key) ? key : Object.keys(ex).find((k) => k.includes('*') && subPathRe(k).test(key))
    if (declaredKey) {
      for (const t of targetsOfExports(ex[declaredKey])) {
        const rel2 = String(t).replace(/^\.\//, '')
        const cand = `${root}/${rel2}`
        if (rel2.includes('*')) {
          const hit = ctx.allPaths.find((p) => subPathRe(cand).test(p))
          if (hit) return { ep, state: 'ok', path: hit, how: `exports['${declaredKey}'] 映射` }
          continue
        }
        if (ctx.tracked.has(cand)) return { ep, state: 'ok', path: cand, how: `exports['${declaredKey}'] 映射` }
        const alt = ctx.allPaths.find((p) => stemOf(p) === stemOf(cand))
        if (alt) return { ep, state: 'ok', path: alt, how: `exports['${declaredKey}'] 映射(同干换扩展名)` }
      }
      return { ep, state: 'missing', path: null, how: `exports['${declaredKey}'] 映射到的文件不在取材面` }
    }
  }
  return { ep, state: 'missing', path: null, how: '既无约定式文件也无 exports 声明' }
}

/** 模块的契约工件面:显式声明 ∪ contract_file_patterns 命中 ∪ 模块根下的自述文档 */
export function moduleContractArtifacts(m, ctx, P) {
  const declared = m.contractFiles.map((f) => {
    const p = f.startsWith('/') ? f.slice(1) : m.roots.length && !f.startsWith(m.roots[0] + '/') ? `${m.roots[0]}/${f.replace(/^\.\//, '')}` : f.replace(/^\.\//, '')
    return { path: p, exists: ctx.tracked.has(p), source: '声明的 contract_files' }
  })
  const isContract = mkMatcher(P.contractPatterns)
  const patternHits = ctx.allPaths.filter((p) => inRoots(m, p) && isContract(p)).map((p) => ({ path: p, exists: true, source: 'contract_file_patterns 命中' }))
  const docs = []
  for (const r of m.roots) for (const d of MODULE_DOC_NAMES) if (ctx.tracked.has(`${r}/${d}`)) docs.push({ path: `${r}/${d}`, exists: true, source: '模块自述文档' })
  const bad = declared.filter((x) => !x.exists)
  return { declared, patternHits, docs, all: [...declared, ...patternHits, ...docs], sufficient: declared.length > 0 || patternHits.length > 0 || docs.length > 0, bad }
}

/**
 * E1 + E2 的判据面(返回违规数组,形状与 auditPolicy 一致,可直接并进表级报账)。
 * 问责前置(与全门同一条渐进收口制度):**只有 managed:true 的模块**的结果才计红;
 * managed:false / 未收口的模块一律 `soft: true`(只报数)。
 * 「未齐备」这一类**默认恒报数**:HEAD 实测有十几块纳管模块既没有 pattern 命中也没有
 * 自述文档,把它做成即时判红等于造一台恒红门(唯一结局是逼人 --no-verify);
 * 要按这一类问责请跑 `--strict`(人工巡检档),它的语义本就是"存量债也判红"。
 */
export function auditDeclarations(P, ctx, opts = {}) {
  const trial = new Set(opts.trialModules || [])
  const strict = opts.strict === true
  const v = []
  const counters = { entrypointsChecked: 0, entrypointMissing: 0, contractDeclaredMissing: 0, contractAbsentModules: 0 }
  for (const m of P.modules.values()) {
    const held = m.managed || trial.has(m.id)
    for (const ep of m.entrypoints) {
      counters.entrypointsChecked++
      const r = resolveEntrypoint(m, ep, ctx)
      if (r.state === 'ok') continue
      counters.entrypointMissing++
      v.push({ rule: 'entrypoint-missing', file: POLICY_REL, line: 0, module: m.id, managed: held, soft: !held, msg: `模块 ${m.id} 声明的 public_entrypoints "${ep}" 在取材面里解析不到文件(${r.how})—— D3 深导入判据正对着不存在的出口工作` })
    }
    const art = moduleContractArtifacts(m, ctx, P)
    for (const b of art.bad) {
      counters.contractDeclaredMissing++
      v.push({ rule: 'contract-artifact-missing', file: b.path, line: 0, module: m.id, managed: held, soft: !held, msg: `模块 ${m.id} 在 contract_files 里声明了 ${b.path},但取材面里没有这个文件(契约工件失踪)` })
    }
    if (held && !art.sufficient) {
      counters.contractAbsentModules++
      v.push({
        rule: 'contract-artifact-missing',
        file: POLICY_REL,
        line: 0,
        module: m.id,
        managed: held,
        soft: !strict,
        msg: `模块 ${m.id} 已纳管(managed:true)却没有任何契约工件:既未声明 contract_files,也不命中 contract_file_patterns,模块根下也没有 ${MODULE_DOC_NAMES.join('/')} —— 齐备性按 --strict 档问责,默认只报数`,
      })
    }
  }
  return { violations: v, counters }
}

// ── 核心判定(纯函数:files = Map<相对路径, 文本>) ──────────────────────────────────────
export function analyze(P, files, opts = {}) {
  const trial = new Set(opts.trialModules || [])
  const isManaged = (m) => !!m && (m.managed || trial.has(m.id))
  // DC 的锚点面:null ⇒ 锚点与内容同面(全量档 / 空暂存回退档的内容就是 HEAD,因此恒不等值上升);
  //   Map ⇒ 内容取索引、锚点取这份 Map 里的 HEAD 计数(缺项 = 该文件 HEAD 里没有 = 本次新增文件 ⇒ 按 0 起算)。
  const suppressionAnchors = opts.suppressionAnchors === undefined ? null : opts.suppressionAnchors
  const excluded = mkMatcher(P.scanExcludes)
  const isContract = mkMatcher(P.contractPatterns)
  const testExempt = mkMatcher(P.testExempts)
  const byPkg = new Map([...P.modules.values()].filter((m) => m.pkg).map((m) => [m.pkg, m]))
  const rootList = [...P.modules.values()].flatMap((m) => m.roots.map((r) => [r, m])).sort((a, b) => b[0].length - a[0].length)
  const ownerOf = (p) => {
    for (const [r, m] of rootList) if (p === r || p.startsWith(r + '/')) return m
    return null
  }
  const V = []
  const edges = new Map()
  // DC 报账:suppress* = 纳管块(managed:true)射程内;all* = 整面扫到的数,含未收口块 ——
  // 分开计是防"未收口块里的抑制被读成已判过"那一类假账;两个数都必须打进输出面,不得只印一个。
  const stats = {
    scanned: 0,
    unowned: new Set(),
    unknownPkg: new Set(),
    exempted: 0,
    invalidExempt: 0,
    policyExceptions: 0,
    exceptionIds: new Set(),
    foreign: 0,
    suppressions: 0,
    suppressionFiles: 0,
    suppressionsAll: 0,
    suppressionFilesAll: 0,
    suppressionGrowthFiles: 0,
  }
  const add = (rule, path, line, mod, msg) => V.push({ rule, file: path, line, module: mod ? mod.id : null, managed: isManaged(mod), msg })
  /** 表级例外:放过**并计数**,并记下命中的 id —— 一条都不命中的例外就是清单腐烂 */
  const exPass = (rule, path) => {
    const hit = exHit(P, rule, path)
    if (!hit) return false
    stats.policyExceptions++
    if (hit.id) stats.exceptionIds.add(hit.id)
    return true
  }

  for (const [path, text] of files) {
    if (excluded(path)) continue
    stats.scanned++
    const mod = ownerOf(path)
    if (!mod) stats.unowned.add(path.split('/').slice(0, /^(apps|packages)\//.test(path) ? 2 : 1).join('/'))
    const lines = text.split('\n').length
    if (lines > P.maxFileLines) add('file-lines', path, 0, mod, `${lines} 行 > 上限 ${P.maxFileLines}`)
    if (isContract(path) && lines > P.maxContractLines && !exPass('contract-file-lines', path))
      add('contract-file-lines', path, 0, mod, `契约文件 ${lines} 行 > 上限 ${P.maxContractLines}`)
    // ── C4(G-815990):单文件公开方法数(managed-only,与 C2/C3 同一问责口径)──────────────
    // 表里声明了 max_public_methods 才装载(声明驱动:没声明就是"本表尚不含这一维",不静默造绿);
    // 计数实现只有一份(见 publicMethodCount 头注),阈值实测依据在 yaml 注释里。
    if (P.maxPublicMethods !== null) {
      const pubMethods = publicMethodCount(text)
      if (pubMethods > P.maxPublicMethods && !exPass('public-methods', path))
        add('public-methods', path, 0, mod, `单文件公开方法 ${pubMethods} 个 > 上限 ${P.maxPublicMethods}`)
    }
    // ── DC:纳管块内的裸 lint 抑制(棘轮锚点 = 该文件在锚点面自身的条数) ──────────────
    // 计数只在预筛命中后才走重路径(见 SUPPRESS_PREFILTER 的超集要求);未收口块只报数不判红,
    // 但**两个数都要打进输出面**,否则读报告的人会把"纳管块 0 处"看成"全仓 0 处"。
    const suppressOwn = suppressionCount(text)
    if (suppressOwn) {
      stats.suppressionsAll += suppressOwn
      stats.suppressionFilesAll++
      if (isManaged(mod)) {
        stats.suppressions += suppressOwn
        stats.suppressionFiles++
        const suppressAnchor = suppressionAnchors ? (suppressionAnchors.get(path) ?? 0) : suppressOwn
        if (suppressOwn > suppressAnchor) {
          stats.suppressionGrowthFiles++
          add(
            'lint-suppression-growth',
            path,
            0,
            mod,
            `该文件裸 lint 抑制 ${suppressOwn} 处 > 其锚点面(HEAD)自身存量 ${suppressAnchor} 处(本次 +${suppressOwn - suppressAnchor})—— 每加一条 eslint-disable / @ts-ignore,该文件对应规则的覆盖**永久归零**,而 typecheck、lint、其余守门一路报绿。纳管块(managed:true)既然声明了契约,契约是否仍被**执行**必须一起报出来。出口只有两条:修到不需要抑制,或把这次关闭写进策略表 exceptions 并带 until(表级豁免有日期,文件级豁免没有)。`,
          )
        }
      }
    }
    for (const { spec, line } of extractSpecs(text)) {
      if (/[${}]/.test(spec)) continue // 生成器拼出来的占位说明符不是真导入
      let target = null
      let sub = null
      let viaRelative = false
      if (spec.startsWith('@ihui/')) {
        const seg = spec.split('/')
        const top = seg.slice(0, 2).join('/')
        target = byPkg.get(top) || null
        if (!target) {
          stats.unknownPkg.add(top)
          continue
        }
        if (seg.length > 2) sub = '/' + seg.slice(2).join('/')
        if (target === mod) continue // 包内自引用不参与跨模块契约
      } else if (spec.startsWith('.')) {
        const rel = relFrom(relDir(path), spec)
        target = ownerOf(rel)
        if (!target || target === mod) continue
        viaRelative = true
        sub = '/' + rel.slice(target.roots[0].length + 1)
      } else {
        if (/^(https?:|node:|data:)/.test(spec)) continue
        stats.foreign++ // 第三方包名:不在本表射程
        continue
      }
      if (!mod) continue
      const key = `${mod.id}→${target.id}`
      edges.set(key, (edges.get(key) || 0) + 1)
      const blame = (rule, msg) => {
        const src = text.split('\n')
        // 行内豁免只在**导入行本身**或**紧邻上一行**生效;缺原因即不放行(只记数)
        for (const cand of [src[line - 1], src[line - 2]]) {
          if (cand === undefined) continue
          const m = /arch-exempt:\s*(.*)$/.exec(cand)
          if (!m) continue
          if (!m[1].trim()) {
            stats.invalidExempt++
            continue
          }
          stats.exempted++
          return
        }
        if (exPass(rule, path)) return
        add(rule, path, line, mod, msg)
      }
      if (!mod.requires.has(target.id)) blame('undeclared-dependency', `${mod.id} 依赖了未在 requires 里声明的 ${target.id}(${spec})`)
      if (mod.rank !== null && target.rank !== null && target.rank > mod.rank) blame('layer-direction', `${mod.id}(rank ${mod.rank}) 反向依赖更上层的 ${target.id}(rank ${target.rank})`)
      if (!P.forbidDeep) continue
      if (testExempt(path)) continue
      if (viaRelative) blame('deep-import', `相对路径穿透到 ${target.id} 的实现细节:${relFrom(relDir(path), spec)}`)
      else if (target.exported === false) blame('deep-import', `${spec} 指向 ${target.id},但它声明 exported:false(不对外提供)` )
      else if (sub && !matchEntrypoint(target, sub)) blame('deep-import', `${spec} 没命中 ${target.id} 声明的任何 public_entrypoints`)
    }
  }

  // C3:按模块主入口(取 package.json 的 exports['.'] 或 main)统计对外出口数
  for (const m of P.modules.values()) {
    if (!m.pkg) continue
    let pj = null
    for (const r of m.roots) {
      const t = files.get(`${r}/package.json`)
      if (typeof t === 'string') {
        pj = t
        break
      }
    }
    if (!pj) continue
    let entry
    try {
      const j = JSON.parse(pj)
      const e = j.exports && typeof j.exports === 'object' ? j.exports['.'] : null
      entry = (e && (typeof e === 'string' ? e : e.import || e.default)) || j.main
    } catch {
      continue
    }
    if (!entry || String(entry).includes('*')) continue
    const ep = `${m.roots[0]}/${String(entry).replace(/^\.\//, '')}`
    const txt = files.get(ep)
    if (typeof txt !== 'string') continue
    const n = txt.split('\n').filter((l) => /^export\b/.test(l)).length
    if (n > P.maxPublicExports && !exPass('public-exports', ep)) add('public-exports', ep, 0, m, `主入口对外 ${n} 项 > 上限 ${P.maxPublicExports}`)
  }

  // D4:现实 import 边是否成环(声明表已由 T1 保证无环 ⇒ 成环即"表与现实脱节")
  if (P.forbidCycles) {
    const g = new Map()
    for (const k of edges.keys()) {
      const [a, b] = k.split('→')
      if (!g.has(a)) g.set(a, new Set())
      g.get(a).add(b)
    }
    const reported = new Set()
    const walk = (n, stack) => {
      const at = stack.indexOf(n)
      if (at >= 0) {
        const ring = stack.slice(at)
        const id = [...ring].sort().join('|')
        if (!reported.has(id)) {
          reported.add(id)
          add('module-cycle', POLICY_REL, 0, P.modules.get(ring[0]), `现实 import 成环:${[...ring, n].join(' → ')} —— 声明表说它是 DAG,故表与现实脱节`)
        }
        return
      }
      for (const nxt of g.get(n) || []) walk(nxt, [...stack, n])
    }
    for (const n of g.keys()) walk(n, [])
  }

  const red = V.filter((x) => !x.soft && (ALWAYS_RED.has(x.rule) || x.managed))
  return { violations: V, red, stats, edges }
}

// ── 取材 ───────────────────────────────────────────────────────────────────────────────
/**
 * 把"面的说法"归一到 FACES 的三个名字。
 * 刻意**不猜默认面**:拿到认不出的值就抛。理由与 `--worktree` 那次事故同型 ——
 * 一个掉进默认分支的面名,表现不是报错而是"审了另一份内容还打印成审了这一份"。
 * 兼容旧调用:`'HEAD'` / `''`(索引)两种 rev 串仍是合法输入,`scripts/module-context.mjs`
 * 就是用它调 `declarationContext` 的,不得因为换参数形态而把它改坏。
 */
export function revToFace(revOrFace) {
  if (revOrFace === 'HEAD') return 'head'
  if (revOrFace === '') return 'staged'
  if (FACES.includes(revOrFace)) return revOrFace
  throw new Error(`无法识别的取材面:${JSON.stringify(revOrFace)} —— 只认 ${FACES.join('/')} 或旧形态 'HEAD' / ''(索引)`)
}

/** 派生 git 只读调用(带 root 是为了让镜像测试能在**临时仓**里造"索引≠磁盘"的现场)。 */
const gitAt = (root, args) => gitRaw(args, root, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 29 })

/**
 * 某一面的**路径清单**。
 *   head     ⇒ `ls-tree -r HEAD`(已入库的那一份)
 *   staged   ⇒ `ls-files`(索引)
 *   worktree ⇒ `ls-files`(被跟踪的路径)+ 内容取磁盘
 * 工作树档用同一份清单而**不**去枚举磁盘,是为了让"面"只改变内容来源、不改变射程:
 * 未跟踪文件不在任何面的射程内(必须在结论行如实写明),否则读报告的人会把它当成"连新文件也审了"。
 */
export function listFacePaths(root, faceOrRev) {
  const f = revToFace(faceOrRev)
  return f === 'head' ? gitAt(root, ['ls-tree', '-r', '--name-only', 'HEAD', '-z']).split('\0').filter(Boolean) : gitAt(root, ['ls-files', '-z']).split('\0').filter(Boolean)
}

/**
 * 三面取材的**唯一**实现,返回 `{files, missed}`。
 * 工作树档走 `readWorktreeFile`(层的唯一磁盘出口):目录里没有 ⇒ null 进 `missed` 报名,
 * 读失败**原样抛**(一个编码/权限错误不得伪装成"该文件不存在")⇒ 由 main 的 catch 落 exit 2。
 * catBatch 那两档的既有形状不变:**只收命中的**,missing 不占位(`files.size` 直接打进结论行,
 * 把 null 塞进去等于凭空把 N 涨成"所有请求数")。
 */
export function readFaceDetailed(faceOrRev, paths, root = ROOT) {
  const face = revToFace(faceOrRev)
  const out = new Map()
  const missed = []
  if (!paths.length) return { files: out, missed }
  if (face === 'worktree') {
    for (const p of paths) {
      const text = readWorktreeFile(root, p)
      if (typeof text === 'string') out.set(p, text)
      else missed.push(p)
    }
    return { files: out, missed }
  }
  const rev = FACE_REV[face]
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) {
    const text = got.get(specs[i])
    if (typeof text === 'string') out.set(paths[i], text)
  }
  return { files: out, missed }
}

function readFace(rev, paths, root = ROOT) {
  return readFaceDetailed(rev, paths, root).files
}
const treePaths = (rev, root = ROOT) => listFacePaths(root, rev)

/**
 * argv 的参数闸门:`{unknown, notes}` —— `unknown` 非空即**必须拒绝执行**(exit 2),
 * 不得落进任何一档。位置参数只允许"值旗标的紧邻值"(`--managed-trial packages/sdk` 的模块 id),
 * 别的裸位置参数一律拒(它多半是漏写旗标的那个值 —— 同 `plan-tasks-merge.mjs` 的 `inspectArgs`)。
 * 白名单与"谁能吃位置参数"共用 `VALUE_FLAGS` 这一份名单:分两处写迟早出现"旗标认识、
 * 值被当成未知位置参数"的自相矛盾(那道拒绝误用的判据会把自己的合法用法拒了)。
 */
export function inspectArgs(list) {
  const unknown = []
  const notes = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (typeof t !== 'string' || t === '') continue
    if (t.startsWith('-')) {
      if (!KNOWN_FLAGS.includes(t)) unknown.push(t)
      continue
    }
    if (VALUE_FLAGS.includes(list[i - 1])) continue
    unknown.push(t)
    notes.push(`位置参数 ${JSON.stringify(t)} 不是 ${VALUE_FLAGS.join('/')} 的值`)
  }
  return { unknown, notes }
}

/** 面选择(纯函数,便于用构造面证明)。两面旗同给 = 矛盾,由 `selectFace` 给 error。 */
export function pickFace(argv) {
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) return { face: null, error: picked.error }
  if (!FACES.includes(picked.face)) return { face: null, error: `内部错误:面名 ${JSON.stringify(picked.face)} 不在 ${FACES.join('/')}` }
  return { face: picked.face, error: null }
}

/** `--managed-trial` 的值清单(只吃紧随其后的非旗标 token)。 */
export function trialModulesFrom(argv) {
  const ti = argv.indexOf('--managed-trial')
  return ti >= 0 ? argv.slice(ti + 1).filter((a) => !a.startsWith('--')) : []
}


/**
 * E1/E2 判据的取材上下文:路径清单 + 包清单读取器,**全部来自同一个面**。
 *
 * 做成注入式有两个理由:① 判据与本门的阅读包出口 `scripts/module-context.mjs` 必须共用
 * 同一份解析实现(两处算同一件事不得各写一遍),而两侧取的可以不是同一个面;
 * ② `--self-test` 与镜像测试要能**构造面**来证明判据有牙(本仓教训:证明取材面行为
 * 只能用纯函数 + 构造面,不得依赖仓库瞬时状态)。
 * 坏清单不静默 —— 记进 `unparsed` 由调用方喊出来:JSON.parse 失败会伪装成"入口解析不到",
 * 一个解析错误冒充业务结论正是本门注释里写过的那一型。
 */
export function declarationContext(P, facePaths, rev) {
  const tracked = new Set(facePaths)
  const want = [...new Set([...P.modules.values()].map((m) => (m.pkg && m.roots.length ? `${m.roots[0]}/package.json` : null)).filter(Boolean))].filter((p) => tracked.has(p))
  const byPath = new Map()
  const unparsed = []
  for (const [p, text] of readFace(rev, want)) {
    try {
      byPath.set(p, JSON.parse(text))
    } catch {
      unparsed.push(p)
    }
  }
  return {
    tracked,
    allPaths: facePaths,
    unparsed,
    manifestOf(id) {
      const m = P.modules.get(id)
      const pj = m && m.roots.length ? `${m.roots[0]}/package.json` : null
      return pj && byPath.has(pj) ? byPath.get(pj) : null
    },
  }
}

/** 策略表自身的取材:按 `policyFaceOrder(face)` 给定的顺序,取第一个读得到的。
 *  两档降级(而非 exit 2)的理由仍然成立:新落表的那一枚提交之前,若坚持只认 HEAD
 *  就会在"表还没入库"时把整条提交链打死(= 恒红机器)。
 *  但"表只是输入、不是被审对象"这半句**不成立**(2026-09-25 实测推翻,见
 *  `policyFaceOrder` 的注释):改表恰好是某些提交的唯一内容,故 `--staged` 档必须
 *  索引优先 —— 否则本门对"把 managed 翻错/把 requires 写歪"这类改动全程盲视。
 *  退到工作树仍须**大声说明**,镜像测试钉的是"每个面各自的档位顺序不得回退"。
 *  `--worktree` 档**不降级**:那一档的定义就是"审磁盘这一份",取不到即无法判定,
 *  回落 HEAD 等于把"没判到"写成"判过了"(与本仓对回落的那条禁令同一条)。 */
export function pickPolicySource(cands) {
  for (const [label, text] of cands) if (typeof text === 'string' && text.trim()) return { label, text }
  return null
}

/**
 * 策略表的取材面顺序 —— 与源码内容同向:全量档判 HEAD,`--staged` 档判**索引**,
 * `--worktree` 档**只**判工作树(单元素,无回落)。
 *
 * 单独抽成函数是为了让镜像测试能钉住**行为**而不是注释。它曾经两种情况都 HEAD 优先,
 * 后果不是"少读一份表"而是**改表的那枚提交完全脱离本门审查**:2026-09-25 实测往索引版
 * `apps/cli.requires` 注入一条 `apps/api`(端应用 `exported:false`,T1 必判红),
 * 全量与 `--staged` 双双 exit 0,且 `--staged` 的输出照旧打印旧表的那一行
 * (`managed:true packages/api-client`)。而本文件头"改这张表的规矩 2"恰恰要求
 * "翻 managed:true 之前先试跑" —— 提交链上是唯一无验的一环。
 * 判据存在而永不调用 = 没有。
 *
 * 参数是**面名**而不是布尔。布尔是本函数的前一形态(只有"是不是暂存档"两态),而这一维现在
 * 有三态 —— 若继续收布尔,`--worktree` 就只能被读成 `false`,于是工作树档静默取得 HEAD 顺序,
 * 那正是本函数 2026-09-25 刚修掉的那一型的翻版。**旧形态仍兼容**(true⇒staged / false⇒head),
 * 但除此之外认不出的输入一律抛,绝不落回默认顺序:一条会自己猜的判据,让下一个加面的人
 * 永远拿到"跑通了"而不是"跑错了"。
 * @param {'head'|'staged'|'worktree'|'HEAD'|''|boolean} faceOrRev 面名 / 旧 rev 串 / 旧布尔
 */
export function policyFaceOrder(faceOrRev) {
  const legacy = typeof faceOrRev === 'boolean' ? (faceOrRev ? 'staged' : 'head') : faceOrRev
  const face = revToFace(legacy)
  if (face === 'worktree') return ['工作树']
  return face === 'staged' ? ['索引', 'HEAD', '工作树'] : ['HEAD', '索引', '工作树']
}

/**
 * `--staged` 档**内容**的取材范围决策(纯函数,抽出来是为了让 `--self-test` 与镜像测试能证明它)。
 *
 * 2026-09-25 独立复核实测的缺陷:暂存区里没有源文件时,本门打出
 * `扫描 0 文件 … ✅ 架构契约门通过` —— 依赖面(D1/D2/D3/D4/C2/C3)审了空集却记绿。
 * 本仓同型教训已由守门 70 / 81 收口过一次:**暂存集为空时必须回退全量**,不得静默绿。
 * 刻意不 exit 2:pre-commit 会为任何一次提交跑本门,把提交链打死与静默绿同样错。
 *
 * @param {string[]} srcPathsInFace 当前档(索引)全部源文件路径,已由 SRC_RE 筛过
 * @param {Set<string>} stagedSet   暂存区里 ACMR 形态的路径清单
 * @param {{headSrcPaths?:string[], deletedSet?:Set<string>}} [opts]
 *        headSrcPaths = HEAD 面全部源文件(回退档的候选);deletedSet = 暂存区 **D 形态**清单
 * @returns {{mode:'staged'|'full', paths:string[], keep:string[], droppedDeleted:string[]}}
 *   keep 是回退档**该读的路径集** —— 由本函数算,调用方不得再自己求一次差集
 *   (两处算同一个集合必然漂移:第一版把剔除清单建在索引面上,而 D 形态的路径根本不在索引面里,
 *    于是真实场景下"剔除了什么"永远打印为空,等于静默排除)。
 *
 * 2026-09-25 同日补的第二条缺陷(由本门**自己的修复提交被自己钉红**暴露):回退全量时若不排除
 * "本次提交正删除的路径",则**纯删除型修复永远落不了地** —— 删掉违规文件的那枚提交,暂存集里没有
 * 源文件 ⇒ 回退 HEAD ⇒ HEAD 里那个文件还在 ⇒ 判红 ⇒ 跳门。本门要拦的是"提交后仓库仍违规",
 * 而删除恰恰是修复动作,对着修复前的快照问责等于惩罚修复。排除只认 D 清单(不认任何宽泛条件),
 * 且**必须打印排除了哪些**(静默排除 = 判据失效)。
 */
export function planStagedScope(srcPathsInFace, stagedSet, opts = {}) {
  const { headSrcPaths = [], deletedSet = new Set() } = opts
  const picked = srcPathsInFace.filter((p) => stagedSet.has(p))
  if (picked.length) return { mode: 'staged', paths: picked, keep: picked, droppedDeleted: [] }
  const droppedDeleted = headSrcPaths.filter((p) => deletedSet.has(p))
  const dropped = new Set(droppedDeleted)
  return { mode: 'full', paths: [], keep: headSrcPaths.filter((p) => !dropped.has(p)), droppedDeleted }
}

// ── G-406,2026-10-07:缺陷② —— 暂存触发面沿反向依赖闭包加宽(改契约要红 importer)────────
// 病根(与票面同族):planStagedScope 的暂存面 = **暂存路径本身**(路径清单口径)。当本次暂存了
// 契约表 config/architecture-policy.yaml(且同时暂存了源文件 ⇒ 窄口径生效)时,收口/改表会改变
// **未改动 importer** 的 D1/D2/D3/D4 判定 —— 而 importer 不在暂存集里,判定面看不到它们
// ⇒ 改契约不红 importer,净零逃逸。
//
// 为什么触发条件钉在「契约表被暂存」:importer 的判定输入只有两样 —— 它自己的内容与这张声明表。
//   · 内容面不是 HEAD 的文件必在暂存集里(已判);
//   · 表**未**暂存时,未改动 importer 的判定与 HEAD 全量档逐字同形(全量档本就审它)⇒ 加宽零增益,
//     只白付一次建图成本(实测 index 面建图 ~4.7s / 9039 顶点)且每次提交都付 —— 那是把另一类
//     恒慢换本票的绿,顺手扩触发面正是 §12e 要防的动作;
//   · 表被暂存 ⇒ 表变了 ⇒ 未改动 importer 的旧判定不再可信 —— 这正是「改契约」。
//   (暂存集只有表、没有源文件时 planStagedScope 已回退全量,importer 天然在审,无需加宽。)
//
// 三条边界(沿用 check-typecheck widenScopeOverDependents 的同款教训):
//   1. 图面 = **index**,与暂存档内容面同面 —— 闭包按 HEAD 建图却按索引判责,两套面互相对不上
//      是本仓最高频假绿源(门 103 自己的头注记过)。
//   2. 建图/闭包失败**不静默、也不崩**:退回未加宽的暂存面(= 改前的逐字行为)并给可见 reason,
//      由调用方打 ⚠️。既不假装加宽成功,也不把环境故障升级成提交硬拦。
//   3. `buildGraph` 是**唯一的测试缝**(默认 = import-graph 的 buildFileGraph):建图只认真仓且
//      秒级耗时,单元测试不许真建一次图。生产调用不传该参 —— 缝只开在"怎么建图"这一层。
// @param {string[]} seedPaths 窄口径暂存源文件(已过 SRC_RE)
// @returns {{paths:string[], added:string[], widened:boolean, reason:string}}
export function widenStagedScopeOverDependents(seedPaths, { buildGraph = buildFileGraph, root = ROOT } = {}) {
  const seeds = [...new Set(seedPaths)]
  if (seeds.length === 0) {
    return { paths: [], added: [], widened: false, reason: '暂存源文件为空,无需加宽' }
  }
  let closure
  try {
    const graph = buildGraph({ face: 'index', root })
    closure = widenOverDependents(seeds, graph)
  } catch (e) {
    return {
      paths: seeds,
      added: [],
      widened: false,
      reason: `建图/闭包失败(${(e && e.message) || e})—— 退回未加宽暂存面(=改前行为)`,
    }
  }
  // 闭包 ⊇ 种子(图外种子原样保留);闭包侧只收本门射程内的源文件 —— 图顶点含 .d.ts 等
  // planStagedScope 口径之外的路径,把它们读进来只是白付 catBatch。并集去重后排序,
  // 顺序不稳定会让结论行与红清单在两次运行间抖动。
  const seedSet = new Set(seeds)
  const paths = [...new Set([...seeds, ...closure.closure.filter((p) => SRC_RE.test(p))])].sort()
  return {
    paths,
    added: paths.filter((p) => !seedSet.has(p)),
    widened: true,
    reason: '契约表在本次暂存集里:未改动 importer 的判定不再可信,已沿反向依赖闭包纳入',
  }
}

/**
 * 策略表取材面的提示语 —— **只在真的错位时喊**(2026-09-25 修第二处缺陷)。
 *
 * 旧写法是 `if (policyFace !== 'HEAD')`,于是"索引与 HEAD 逐字节同一版"时(实测
 * `git rev-parse :表` == `git rev-parse HEAD:表`)也照样打印"尚未入库",把人支去找一个
 * 根本不存在的错位;而 `--staged` 档读索引本就是 `policyFaceOrder` 规定的**正常行为**
 * (它正是上一轮为"改表那枚提交不被审"而定的)。现按 oid 比对分四档:
 *   HEAD                ⇒ 安静(与全量口径同向)
 *   索引 且 oid==HEAD   ⇒ 安静(读的就是那份已入库的表)
 *   索引 且 oid!=HEAD   ⇒ info:本次提交正在改这张表,审将要落地的那份
 *   索引 而 HEAD 无此表 ⇒ warn:表尚未入库,落表提交必须与本门注册同批
 *   工作树              ⇒ **看是哪一档要求的**:
 *                          · `--worktree` 档要求的就是它 ⇒ 安静(这是本档的定义,不是降级 ——
 *                            把它打成"退到"就是把正常行为喊成异常,而人会对警告脱敏);
 *                          · 其余档位落到工作树 ⇒ warn:HEAD 与索引都取不到,既没入库也没暂存
 *
 * @param {string} pickedLabel pickPolicySource 选中的面名
 * @param {{HEAD?:string|null, 索引?:string|null}} oids 各面 blob oid(取不到给 null)
 * @param {{requestedFace?:string}} [opts] 本次调用要求的档(决定"工作树"是正常取材还是降级)
 * @returns {null|{level:'info'|'warn', msg:string}}
 */
export function policyFaceNotice(pickedLabel, oids = {}, opts = {}) {
  const head = oids.HEAD ?? null
  const index = oids['索引'] ?? null
  if (pickedLabel === 'HEAD') return null
  if (pickedLabel === '索引') {
    if (head === null) return { level: 'warn', msg: `策略表只在索引里(HEAD 还没有它)—— 落表提交必须与本门的注册同批,否则审的不是那份已生效的表` }
    if (index !== null && index === head) return null
    return { level: 'info', msg: `策略表取自索引且与 HEAD 不同版(${String(index).slice(0, 8)} ≠ ${String(head).slice(0, 8)})—— 本次提交正在改这张表,审的是将要落地的那份,属正常形态` }
  }
  if (pickedLabel === '工作树') {
    if (opts.requestedFace === 'worktree') return null
    return { level: 'warn', msg: `策略表退到工作树副本 —— HEAD 与索引都取不到它,这张表既没入库也没暂存` }
  }
  return { level: 'warn', msg: `策略表取自「${pickedLabel}」而非 HEAD,请核对取材面` }
}

/** 各面策略表的 blob oid(取不到给 null)。
 *  为什么问 oid 而不是"读没读到内容":缺陷 2 的误报形态正是"读了索引就喊表没入库",
 *  而索引与 HEAD 常常是同一版 —— 只有 oid 能区分"同版(安静)"与"HEAD 没有这张表(该喊)"。 */
function readPolicyOids() {
  const oid = (spec) => {
    try {
      return git(['rev-parse', '--verify', '-q', spec]).trim() || null
    } catch {
      return null
    }
  }
  return { HEAD: oid(`HEAD:${POLICY_REL}`), 索引: oid(`:${POLICY_REL}`) }
}

function main(argv) {
  // ── 参数闸门(在任何一个面的判定之前)──────────────────────────────────────────────
  // 不认识的旗标 / 裸位置参数 ⇒ exit 2 并原样点名,**不打印任何一档的结论**。
  // 旧形态 `argv.includes('--worktree')` 根本没解析过这个 token,于是它被静默忽略、
  // 落回默认 HEAD 档并打出 HEAD 的结论 —— 传旗标的人以为在审工作树,实际审的是上一提交态
  // (实测 `--worktree --json` 与 `--json` 输出逐字同形)。见头注「参数闸门」。
  const { unknown, notes } = inspectArgs(argv)
  if (unknown.length) {
    console.error(`❌ 未识别的参数:${unknown.map((u) => JSON.stringify(u)).join(' ')}`)
    for (const n of notes) console.error(`   ${n}`)
    console.error(`   本门**不会**把未知参数当"无参"降级执行(那等于替人做出一张合格证)。可用旗标:${KNOWN_FLAGS.join(' ')};值旗标:${VALUE_FLAGS.join('(其后跟模块 id)')}`)
    return 2
  }
  const pickedFace = pickFace(argv)
  if (pickedFace.error) {
    console.error(`❌ 矛盾旗标:${pickedFace.error} —— 取哪一面都会让另一面成为假绿,故不判定、不出结论`)
    return 2
  }
  const face = pickedFace.face
  const isStaged = face === 'staged'
  const isWorktree = face === 'worktree'
  const json = argv.includes('--json')
  const strict = argv.includes('--strict')
  const trialModules = trialModulesFrom(argv)
  const rev = FACE_REV[face]
  let policyText
  let policyFace = FACE_LABEL_CN[face]
  let policyOids = { HEAD: null, 索引: null }
  try {
    // **只**按本档的顺序去取表 —— 工作树档因此连 HEAD/索引都不读,结构上不可能回落。
    const order = policyFaceOrder(face)
    const texts = {}
    for (const label of order) {
      if (label === '工作树') {
        try {
          texts[label] = readFileSync(pResolve(ROOT, POLICY_REL), 'utf8')
        } catch {
          texts[label] = null
        }
      } else {
        texts[label] = readFace(label === '索引' ? 'staged' : 'head', [POLICY_REL]).get(POLICY_REL)
      }
    }
    const picked = pickPolicySource(order.map((label) => [label, texts[label]]))
    if (!picked) {
      console.error(
        isWorktree
          ? `❌ 无法判定:--worktree 档在工作树取不到 ${POLICY_REL} —— 本档**不回落** HEAD / 索引(回落就是把"没判到"写成"判过了")`
          : `❌ 无法判定:HEAD / 索引 / 工作树三处都取不到 ${POLICY_REL}`,
      )
      return 2
    }
    policyFace = picked.label
    policyText = picked.text
    policyOids = readPolicyOids()
  } catch (e) {
    console.error(`❌ 无法判定:取策略表时 git 派生失败 —— ${e.message}`)
    return 2
  }

  let P
  try {
    P = loadPolicy(parseYaml(policyText, POLICY_REL))
  } catch (e) {
    console.error(`❌ 无法判定:策略表解析失败 —— ${e.message}`)
    return 2
  }
  let files
  let existing
  let faceDesc
  let scopeMode = 'full'
  let missedOnFace = []
  try {
    existing = treePaths(rev)
    const srcAll = existing.filter((p) => SRC_RE.test(p))
    if (isWorktree) {
      // 工作树档:清单仍是被跟踪路径(与索引同一份),内容换成磁盘副本。
      // 读不到的路径**必须报名**并把"未跟踪文件不在射程内"说清楚 —— 只报数不报名,
      // 下一个人就会把"工作树档"读成"连没 add 的新文件也审了"。
      const detail = readFaceDetailed('worktree', srcAll)
      files = detail.files
      missedOnFace = detail.missed
      faceDesc = `工作树磁盘(被跟踪的源文件 ${srcAll.length} 个,磁盘上取到 ${files.size} 个${missedOnFace.length ? `,**缺 ${missedOnFace.length} 个**:${missedOnFace.slice(0, 5).join(' ')}` : ''};未跟踪文件不在任何面的射程内 —— 仅人工档,不回落 HEAD/索引)`
      if (files.size === 0) {
        console.error(`❌ 无法判定:--worktree 档一个源文件都取不到(被跟踪源文件 ${srcAll.length} 个,磁盘上 0 个)—— 审 0 个文件不得记为通过,也不得回落到 HEAD`)
        return 2
      }
    } else if (isStaged) {
      scopeMode = 'staged'
      const staged = new Set(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean))
      // D 形态单独取:回退全量时要把"本次提交正删掉的路径"剔出去(否则纯删除型修复永远落不了地)
      const deleted = new Set(git(['diff', '--cached', '--name-only', '--diff-filter=D']).split('\n').filter(Boolean))
      // 回退档的候选面 = HEAD 全部源文件;一次算清"该读哪些 / 剔除了哪些"(单一真相源,拆两处必漂移)
      const headSrcAll = treePaths('HEAD').filter((p) => SRC_RE.test(p))
      const scope = planStagedScope(srcAll, staged, { headSrcPaths: headSrcAll, deletedSet: deleted })
      if (scope.mode === 'staged') {
        // G-406,2026-10-07:缺陷② —— 契约表被暂存时,未改动 importer 的判定不再可信,
        // 触发面沿反向依赖闭包加宽(引擎与边界见 widenStagedScopeOverDependents 的头注)。
        let judgedPaths = scope.paths
        let widenNote = ''
        if (staged.has(POLICY_REL)) {
          const widened = widenStagedScopeOverDependents(scope.paths)
          if (widened.widened) {
            judgedPaths = widened.paths
            widenNote = `,反向依赖加宽 +${widened.added.length} 个未暂存 importer(G-406 ②)`
          } else {
            // 加宽失败必须可见:既不冒充加宽成功,也不静默吞掉(判据增强失败 ≠ 判据失效)
            console.error(`[arch-policy] ⚠️ G-406 ②:反向依赖加宽未生效 —— ${widened.reason}`)
          }
        }
        files = readFace('', judgedPaths)
        faceDesc = `索引 blob(暂存源文件 ${files.size} 个${widenNote};表自洽性按全索引面判)`
      } else {
        // 暂存集为空 ⇒ 回退全量(HEAD blob)。不回退就等于"审 0 个文件却记绿"(守门 70 同型)。
        // 策略表本身**仍按 --staged 档的索引优先**取材(见 policyFaceOrder)—— 内容面与表面
        // 各自的方向是两件事,顺手把表面也换成 HEAD 就会让"改表那枚提交"重新脱离审查。
        files = readFace('HEAD', scope.keep)
        scopeMode = 'staged-empty-fallback-full'
        const dropNote = scope.droppedDeleted.length
          ? `;已剔除本次提交删除的 ${scope.droppedDeleted.length} 个源文件(${scope.droppedDeleted.slice(0, 5).join(' ')})`
          : ''
        faceDesc = `暂存集为空 ⇒ 回退全量(HEAD blob,${files.size} 个源文件;防"空暂存恒绿",守门 70 同型${dropNote})`
        if (files.size === 0) {
          console.error('❌ 无法判定:暂存集为空且全量面(HEAD)也取不到任何源文件 —— 回退后仍审 0 个文件,不得记为通过')
          return 2
        }
      }
    } else {
      const detail = readFaceDetailed('head', srcAll)
      files = detail.files
      missedOnFace = detail.missed
      faceDesc = `HEAD blob(${files.size} 个源文件)`

    }
  } catch (e) {
    console.error(`❌ 无法判定:git 取材失败 —— ${e.message}`)
    return 2
  }
  const declCtx = declarationContext(P, existing, rev)
  const decl = auditDeclarations(P, declCtx, { trialModules, strict })
  const policyTable = auditPolicy(P, existing)
  const table = [...policyTable, ...decl.violations]
  // 表自洽性的提交链棘轮(见 filterNewTableDefining 的注释):HEAD 那份表**已有**的缺陷
  // 不得转嫁给本次提交;HEAD 那份读不出/解不开时不设基线(宁可多报,绝不静默放过)。
  // X1 的锚点与它同一条制度:锚点面 = HEAD 那份表里"同样没有合法 until"的例外 id 集合。
  //   全量档内容与锚点同面(都是 HEAD)⇒ 无日期存量恒只报数;`--staged` 档取 HEAD 那份表 ⇒ 本次新登记的
  //   无日期例外当场判红(所以"必须有到期日"这条要求在提交链上是生效的,不是散文)。
  //   HEAD 那份取不到/解不开 ⇒ anchorUndated 留 null = **不设基线**,一律按新增问责并大声说明。
  //
  // 这里要分开的两件事(合成一个条件就会有一件静默失效,`--worktree` 落地时逐条对过):
  //   · **表锚点**问的是「P 这份表是不是 HEAD 那一份」⇒ 由 `policyFace` 决定。
  //     `--staged` 而暂存集为空时内容会回退到 HEAD,但表仍取自索引 —— 这一支必须照常设基线,
  //     否则 HEAD 已有的表缺陷全被算成"本次新增",每一次提交都红(§12e 同型)。
  //   · **DC 锚点**问的是「内容面是不是 HEAD」⇒ 由 `contentIsHead` 决定(见下一段)。
  const tableNeedsHeadBaseline = policyFace !== 'HEAD'
  const contentIsHead = face === 'head' || scopeMode === 'staged-empty-fallback-full'
  let baselineMsgs = new Set()
  let anchorUndated = tableNeedsHeadBaseline ? null : undatedExceptionIds(P)
  if (tableNeedsHeadBaseline) {
    try {
      const headText = readFace('HEAD', [POLICY_REL]).get(POLICY_REL)
      if (typeof headText === 'string') {
        const PH = loadPolicy(parseYaml(headText, `${POLICY_REL}@HEAD`))
        const headPaths = treePaths('HEAD')
        for (const v of auditPolicy(PH, headPaths)) if (!v.soft) baselineMsgs.add(v.msg)
        // 齐备性(E1/E2)同样走棘轮:HEAD 那份表本来就解析不到的入口,不得转嫁给本次提交
        for (const v of auditDeclarations(PH, declarationContext(PH, headPaths, 'HEAD'), { trialModules, strict }).violations) if (!v.soft) baselineMsgs.add(v.msg)
        anchorUndated = undatedExceptionIds(PH)
      }
    } catch {
      baselineMsgs = new Set()
      anchorUndated = null
    }
  }
  // DC 的锚点面**恒为 HEAD**。内容面本身就是 HEAD 时不二次读(一遍 catBatch 约 500MB,
  // 一个"比较"不该付两遍);只有**内容面不是 HEAD** 的那几档(暂存窄口径 / 工作树)才需要为
  // "当前面确有抑制"的文件补一次 HEAD 读,按预筛挑文件而不是整面重读。
  // 取不到的文件 = HEAD 里没有这一份 ⇒ 按存量 0 起算(新文件里的裸抑制照判)。
  let suppressionAnchors = null
  let suppressionAnchorNote = contentIsHead
    ? '与内容同面(HEAD ⇒ 恒等,不产生增长红)'
    : `HEAD(内容面不是 HEAD,按当前面预筛补读${isWorktree && missedOnFace.length ? `;磁盘上还缺 ${missedOnFace.length} 个被跟踪源文件,已如实报名` : ''})`
  if (!contentIsHead) {
    const need = [...files.keys()].filter((p) => mayHaveSuppression(files.get(p)))
    suppressionAnchors = new Map()
    try {
      for (const [p, t] of readFace('HEAD', need)) suppressionAnchors.set(p, suppressionCount(t))
    } catch (e) {
      console.error(`❌ 无法判定:DC 锚点面(HEAD)取不到 —— ${e.message};DC 判据在缺锚点时不得冒判"没有增长",也不得静默跳过`)
      return 2
    }
    suppressionAnchorNote = `HEAD(按当前面预筛补读 ${need.length} 个文件,取到的 ${suppressionAnchors.size} 个;其余按存量 0 起算${isWorktree && missedOnFace.length ? `;工作树磁盘上缺 ${missedOnFace.length} 个被跟踪源文件,已如实报名` : ''})`
  }
  const exc = auditExceptionExpiry(P, { anchorUndatedIds: anchorUndated, today: new Date().toISOString().slice(0, 10), strict })
  // 表棘轮的开关跟着**表在哪一面**(见上方 tableNeedsHeadBaseline 的注释),不跟着 isStaged 走:
  // 工作树档的表来自磁盘,同样要以 HEAD 那份为基线,否则"别人已入库的表缺陷"被每一档新面算成新账。
  const hardTable = [...(tableNeedsHeadBaseline ? filterNewTableDefects(table, baselineMsgs) : table.filter((x) => !x.soft)), ...exc.hard]
  const res = analyze(P, files, { trialModules, suppressionAnchors })
  const hard = [...hardTable, ...res.red]
  // 被棘轮放过的那几条表缺陷也必须出现在报数面里,不得静默;X1 的待裁存量同理(它进 soft 面,不静默)。
  const softTable = [...table.filter((x) => x.soft), ...table.filter((x) => !x.soft && !hardTable.includes(x)), ...exc.soft]
  const soft = res.violations.filter((x) => !hard.includes(x))
  const tally = (arr) => arr.reduce((o, x) => ((o[x.rule] = (o[x.rule] || 0) + 1), o), {})
  const managedIds = [...P.modules.values()].filter((m) => m.managed).map((m) => m.id)
  if (strict && (res.stats.unowned.size || res.stats.unknownPkg.size)) hard.push({ rule: 'table-integrity', file: POLICY_REL, line: 0, msg: '--strict:存在含源文件却未登记的模块' })

  const fellBack = scopeMode === 'staged-empty-fallback-full'
  if (json) {
    console.log(JSON.stringify({ face: face === 'head' ? 'HEAD' : face === 'worktree' ? 'worktree' : fellBack ? 'index-fallback-head' : 'index', contentFace: face, missedOnFace: missedOnFace.slice(0, 40), missedOnFaceTotal: missedOnFace.length, stagedFallback: fellBack, policyFace, modules: P.modules.size, managed: managedIds, scanned: res.stats.scanned, edges: res.edges.size, byRule: tally(res.violations), redByRule: tally(hard), hard: hard.slice(0, 80), softTotal: soft.length, unowned: [...res.stats.unowned], unknownPkg: [...res.stats.unknownPkg], exempted: res.stats.exempted, policyExceptions: res.stats.policyExceptions, invalidExempt: res.stats.invalidExempt, staleExceptions: softTable.filter((x) => x.rule === 'table-integrity').length, softTableTotal: softTable.length, exceptionLifetime: exc.counters, lintSuppressions: { managedTotal: res.stats.suppressions, managedFiles: res.stats.suppressionFiles, allTotal: res.stats.suppressionsAll, allFiles: res.stats.suppressionFilesAll, growthFiles: res.stats.suppressionGrowthFiles, anchorFace: suppressionAnchorNote }, declarations: decl.counters, unparsedManifests: declCtx.unparsed }, null, 2))
    return hard.length ? 1 : 0
  }
  console.log(`[arch-policy] 内容取材口径:${faceDesc}`)
  const notice = policyFaceNotice(policyFace, policyOids, { requestedFace: face })
  if (notice) console.log(`[arch-policy] ${notice.level === 'warn' ? '⚠️' : 'ℹ️'} ${notice.msg}`)
  console.log(`[arch-policy] 模块 ${P.modules.size} 个 | managed:true ${managedIds.length ? managedIds.join(', ') : '0 个(存量一律只报数)'} | 扫描 ${res.stats.scanned} 文件 | 跨模块边 ${res.edges.size} 条 | 非本表射程的说明符 ${res.stats.foreign} 处(第三方/别名,不判但如实计数)`)
  console.log(`[arch-policy] 违规合计 ${res.violations.length + table.length + exc.hard.length + exc.soft.length} 处:` + Object.entries({ ...tally(res.violations), ...tally(table), ...tally([...exc.hard, ...exc.soft]) }).map(([k, n]) => ` ${(RULES[k] || k).split(' ')[0]}=${n}`).join(''))
  console.log(`[arch-policy] 齐备性对账:E1 公开入口 ${decl.counters.entrypointsChecked} 条已核 → 解析不到 ${decl.counters.entrypointMissing} 条 | E2 契约工件:声明失踪 ${decl.counters.contractDeclaredMissing} 处、未齐备模块 ${decl.counters.contractAbsentModules} 块(未齐备这一档默认只报数 —— HEAD 实测存量十几块,即时判红就是恒红门;要按它问责跑 --strict)`)
  console.log(
    `[arch-policy] 例外寿命对账(X1/X2):表级例外 ${exc.counters.exceptions} 条 | 带合法 until ${exc.counters.dated} 条 | 无到期日 ${exc.counters.undated} 条(其中锚点面已是存量 ${exc.counters.undatedStock} 条 → 默认只报数、--strict 才判红;非存量 = 本次新增 → X1 判红)| 已过期 ${exc.counters.expired} 条(X2 即时判红,不套棘轮)` +
      (exc.counters.anchorMissing ? ' | ⚠️ 锚点面(HEAD 那份表)取不到 ⇒ X1 不设基线,一律按新增问责(宁可多报,绝不静默放过)' : '') +
      (exc.counters.expiryUndetermined ? ` | ⚠️ ${exc.counters.expiryUndetermined} 条带日期的例外**判不了过期与否**(today=${JSON.stringify(new Date().toISOString().slice(0, 10))} 不是合法日期)—— 未判定不得读成未过期` : '') +
      (exc.counters.malformed ? ` | 连 id 都没有的畸形条目 ${exc.counters.malformed} 条(由 T1 点名,这里不重复计债)` : ''),
  )
  console.log(`[arch-policy] lint 抑制对账(DC):纳管块内 ${res.stats.suppressions} 处 / ${res.stats.suppressionFiles} 文件(判红口径:该文件当前数 > 其锚点面自身存量,只拦新增;本次上升 ${res.stats.suppressionGrowthFiles} 文件)| 含未收口块全量 ${res.stats.suppressionsAll} 处 / ${res.stats.suppressionFilesAll} 文件(未收口块不在 DC 射程,但必须报名 —— 不得把"纳管块 0 处"读成"全仓 0 处")| 锚点面:${suppressionAnchorNote}`)
  if (declCtx.unparsed.length) console.log(`[arch-policy] ⚠️ ${declCtx.unparsed.length} 份包清单 JSON.parse 失败(会被算成"入口解析不到",先修清单再看 E1):${declCtx.unparsed.join(', ')}`)
  const staleExc = softTable.filter((x) => x.rule === 'table-integrity').length
  console.log(`[arch-policy] 判红 ${hard.length} 处(C1/T1 全仓即时 + 已收口模块的契约违规 + X2 例外已过期;E1/E2 的红只按 managed:true 问责;DC 只在"该文件当前数 > 其锚点面存量"时红)| 报数 ${soft.length} 处(managed:false 存量,不判红)` + (res.stats.exempted ? ` | 行内 arch-exempt 放过 ${res.stats.exempted} 处` : '') + (res.stats.policyExceptions ? ` | 策略表 exceptions 放过 ${res.stats.policyExceptions} 处` : '') + (res.stats.invalidExempt ? ` | arch-exempt 缺原因(不生效)${res.stats.invalidExempt} 处` : '') + (staleExc ? ` | 待清理的失效例外 ${staleExc} 条` : '') + (exc.soft.length ? ` | 待裁的无到期日例外 ${exc.soft.length} 条` : '') + (decl.counters.contractAbsentModules ? ` | E2 未齐备模块 ${decl.counters.contractAbsentModules} 块(默认只报数)` : ''))
  if (res.stats.unowned.size) console.log(`[arch-policy] ⚠️ 含源文件却未登记进表的目录 ${res.stats.unowned.size} 个(只报数):${[...res.stats.unowned].slice(0, 12).join(', ')}${res.stats.unowned.size > 12 ? ' …' : ''}`)
  // 清单腐烂只在**已入库的审面**上报(全量档与人工工作树档);暂存档绝大多数例外天然不命中,
  // 按它判会让每一次提交都喊 —— 与 unusedExceptions 内部那条 face 守卫同一个理由。
  const staleIds = unusedExceptions(P, res.stats.exceptionIds, isStaged ? 'index' : 'HEAD')
  if (staleIds.length) console.log(`[arch-policy] ⚠️ 本轮一条都没命中的例外 ${staleIds.length} 条(清单腐烂候补,确认后可删):${staleIds.join(', ')}`)
  if (res.stats.unknownPkg.size) console.log(`[arch-policy] ⚠️ 被 import 但未登记的 @ihui 包 ${res.stats.unknownPkg.size} 个(只报数):${[...res.stats.unknownPkg].join(', ')}`)
  if (hard.length) {
    console.log(`❌ 架构契约判红 ${hard.length} 处:`)
    for (const v of hard.slice(0, 60)) console.log(`   ${v.file}${v.line ? ':' + v.line : ''} [${(RULES[v.rule] || v.rule).split(' ')[0]}] ${v.msg}`)
    if (hard.length > 60) console.log(`   …另 ${hard.length - 60} 处,用 --json 看全量`)
    console.log(`   策略表:${POLICY_REL}(翻 managed:true 之前先 --managed-trial <id> 试跑)`)
    console.log(`   单独复现:node scripts/check-architecture-policy.mjs${isStaged ? ' --staged' : isWorktree ? ' --worktree' : ''}`)
    console.log(`   紧急跳过:${SELF_SKIP}=1 git commit ...`)
    return 1
  }
  console.log(`✅ 架构契约门通过(面:${faceDesc})—— managed:false 的存量违规以报数形式留痕,不判红`)
  for (const s of [...softTable, ...soft].slice(0, 24)) console.log(`   · 报数 ${s.file}${s.line ? ':' + s.line : ''} [${(RULES[s.rule] || s.rule).split(' ')[0]}] ${s.msg}`)
  if (soft.length + softTable.length > 24) console.log(`   · …另 ${soft.length + softTable.length - 24} 条,用 --json 看全量`)
  return 0
}

/** 从 guardian-runner 的注册表里按**结构位**取出某道门的注册块。
 *  镜像测试要钉的是"凡登记的都必须被判定成立"这类不变量,而不是"第 N 行有这句话" ——
 *  整块文本搜、相邻文本搜都会在合规代码上恒红(本仓踩过),故这里按数组元素边界切块。 */
export function registrationOf(runnerText, scriptName) {
  const lines = runnerText.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`^\\s*script:\\s*'${scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*,?$`).test(lines[i])) continue
    let start = i
    while (start > 0 && !/^\s*\{\s*$/.test(lines[start])) start--
    let end = i
    while (end < lines.length - 1 && !/^\s*\},?\s*$/.test(lines[end])) end++
    const block = lines.slice(start, end + 1)
    const key = (k) => {
      const m = block.map((l) => new RegExp(`^\\s*${k}:\\s*(.*)$`).exec(l)).find(Boolean)
      return m ? m[1].replace(/,\s*$/, '').trim() : null
    }
    hits.push({ id: key('id'), mode: key('mode'), skipEnv: key('skipEnv'), label: key('label'), script: key('script'), block: block.join('\n') })
  }
  return hits
}

/** 提交链上的表自洽性棘轮:只拦"这次暂存的表**新增**的缺陷"。
 *  为什么必须有这一层:T1 判的是策略表这份文件,而 pre-commit 会为**任何**一次提交跑它。
 *  若某人上一枚提交把表改坏了却没人再碰它,此后每一枚无关提交都会被这道门拦红 ——
 *  与本仓"存量红不得转嫁给无关提交"的同一条铁律(守门 77/83/98 的锚点都是 HEAD 自身)。
 *  全量档不套这层:它跑在 check:all / CI,正是"表又坏了"的哨兵。 */
export function filterNewTableDefects(violations, baselineMessages) {
  return violations.filter((v) => !v.soft && !baselineMessages.has(v.msg))
}

// ── 自检:成对正反例 ────────────────────────────────────────────────────────────────────
function selfTest() {
  const yamlFor = (managed) => `
version: 1
constraints:
  max_file_lines: 100
  max_contract_file_lines: 40
  max_public_exports: 5
  contract_file_patterns:
    - 'packages/schema/src/**'
  scan_excludes:
    - '**/*.config.js'
    - '**/dist/**'
  deep_import_test_exempts:
    - '**/tests/**'
layers:
  - id: 'contract'
    rank: 10
  - id: 'composite'
    rank: 30
  - id: 'product'
    rank: 40
modules:
  - id: 'packages/schema'
    package: '@ihui/schema'
    layer: 'contract'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/schema'
    requires: []
    public_entrypoints:
      - '.'
      - './chat/*'
  - id: 'packages/kit'
    package: '@ihui/kit'
    layer: 'composite'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/kit'
    requires:
      - 'packages/schema'
    public_entrypoints:
      - '.'
  - id: 'apps/demo'
    package: '@ihui/demo'
    layer: 'product'
    exported: false
    managed: ${managed}
    roots:
      - 'apps/demo'
    requires:
      - 'packages/kit'
    public_entrypoints: []
exceptions:
  - id: 'EX-STALE-1'
    rule: 'deep-import'
    module: 'apps/demo'
    file: 'apps/demo/tests/gone.ts'
    status: 'debt'
    reason: '自检夹具:指向已不存在的文件,用来验"清单腐烂"只报数不判红'
  - id: 'EX-DEBT-1'
    rule: 'undeclared-dependency'
    module: 'apps/demo'
    file: 'apps/demo/src/debt.ts'
    status: 'debt'
    reason: '自检夹具:已登记的现实债,用来验"放过必须计数",不得静默'
`
  const ON = loadPolicy(parseYaml(yamlFor(true), 'ON'))
  const OFF = loadPolicy(parseYaml(yamlFor(false), 'OFF'))
  const F = (o) => new Map(Object.entries(o))
  const imp = (spec, extra = '') => `import { x } from '${spec}'${extra}\nexport const a = x`
  const cases = [
    { n: '合法跨模块导入必须放过(沿 requires 声明 + 裸包名走主入口)', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/kit') }), red: 0, all: 0 },
    { n: 'D1 未声明依赖必判红(demo 没声明 schema 却 import 了它)', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema') }), red: 1, all: 1 },
    { n: '与上条成对:同一份 import 放在声明了的 kit 里不违规', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/schema') }), red: 0, all: 0 },
    { n: 'D2 依赖方向(层序倒挂)必判红:contract 层 import composite 层', p: ON, f: F({ 'packages/schema/src/a.ts': imp('@ihui/kit') }), red: 2, all: 2 },
    { n: 'D3 深导入必判红(子路径没命中 public_entrypoints)', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/schema/internal/thing') }), red: 1, all: 1 },
    { n: '与上条成对:命中 ./chat/* 的写法放行', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/schema/chat/message') }), red: 0, all: 0 },
    { n: 'D3 相对路径穿透别的模块实现细节必判红', p: ON, f: F({ 'apps/demo/src/a.ts': imp('../../../packages/kit/src/deep/helper') }), red: 1, all: 1 },
    { n: '与上条成对:同一形态落在 tests/ 下按 D3 豁免(且 D1/D2 都不成立)', p: ON, f: F({ 'apps/demo/tests/a.test.ts': imp('../../../packages/kit/src/deep/helper') }), red: 0, all: 0 },
    { n: 'D3 端应用不对外:按包名 import 一个 exported:false 的模块必判红(D1+D2+D3 三条)', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/demo') }), red: 3, all: 3 },
    { n: 'C1 单文件行上限对 managed:false 也判红(全仓即时)', p: OFF, f: F({ 'packages/kit/src/big.ts': 'const x = 1\n'.repeat(120) }), red: 1, all: 1 },
    { n: 'C2 契约行上限:managed:false 只报数不判红', p: OFF, f: F({ 'packages/schema/src/wide.ts': 'const y = 1\n'.repeat(45) }), red: 0, all: 1 },
    { n: '与上条成对:同一份文件在 managed:true 下判红', p: ON, f: F({ 'packages/schema/src/wide.ts': 'const y = 1\n'.repeat(45) }), red: 1, all: 1 },
    { n: 'managed:false 整模块只报数:同样的 D1 违规不判红', p: OFF, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema') }), red: 0, all: 1 },
    { n: 'C3 主入口对外出口数超上限:managed:true 判红', p: ON, f: F({ 'packages/kit/package.json': JSON.stringify({ exports: { '.': './src/index.ts' } }), 'packages/kit/src/index.ts': 'export const a=1\nexport const b=2\nexport const c=3\nexport const d=4\nexport const e=5\nexport const f=6\n' }), red: 1, all: 1 },
    { n: '与上条成对:同样内容在 managed:false 下只报数', p: OFF, f: F({ 'packages/kit/package.json': JSON.stringify({ exports: { '.': './src/index.ts' } }), 'packages/kit/src/index.ts': 'export const a=1\nexport const b=2\nexport const c=3\nexport const d=4\nexport const e=5\nexport const f=6\n' }), red: 0, all: 1 },
    { n: '行内 arch-exempt 带原因才生效(放过)', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema', " // arch-exempt: 自检夹具,原因写在同一行") }), red: 0, all: 0 },
    { n: '与上条成对:arch-exempt 缺原因 ⇒ 不生效,违规照计', p: ON, f: F({ 'apps/demo/src/a.ts': imp('@ihui/schema', ' // arch-exempt:') }), red: 1, all: 1 },
    { n: '模板字符串里拼出来的 import 不算边(防假边的关键一条)', p: ON, f: F({ 'apps/demo/src/gen.ts': "export const out = `\nimport { x } from '@ihui/schema'\n`\nexport const a = out" }), red: 0, all: 0 },
    { n: '注释里的示例 import 不算边', p: ON, f: F({ 'apps/demo/src/doc.ts': "/**\n * import { x } from '@ihui/schema'\n */\nexport const a = 1" }), red: 0, all: 0 },
    { n: 'scan_excludes 命中的装配文件不入依赖图(*.config.js)', p: ON, f: F({ 'apps/demo/eslint.config.js': "import base from '@ihui/schema'\nexport default [base]" }), red: 0, all: 0 },
    { n: 'D4 现实 import 成环必判红(managed 侧:3 条边违规 + 1 条环)', p: ON, f: F({ 'packages/kit/src/a.ts': imp('@ihui/demo'), 'apps/demo/src/b.ts': imp('@ihui/kit') }), red: 4, all: 4 },
    { n: '与上条成对:同一环在 managed:false 下只报数(全仓即时判红只剩 C1/T1)', p: OFF, f: F({ 'packages/kit/src/a.ts': imp('@ihui/demo'), 'apps/demo/src/b.ts': imp('@ihui/kit') }), red: 0, all: 4 },
  ]
  let fail = 0
  let ran = 0
  const eq = (name, got, want, detail) => {
    ran++
    const ok = got === want
    if (!ok) {
      fail++
      console.log(`❌ ${name}(实得 ${got},期望 ${want})${ok ? '' : '\n   ' + detail}`)
    } else console.log(`✅ ${name}`)
  }
  for (const c of cases) {
    const r = analyze(c.p, c.f, {})
    eq(c.n, r.red.length, c.red, JSON.stringify(r.red.map((x) => `${x.rule} ${x.file} ${x.msg}`), null, 0))
    if (r.violations.length !== c.all) {
      fail++
      console.log(`   ↳ 违规总数 ${r.violations.length} ≠ 期望 ${c.all}:${JSON.stringify(r.violations.map((x) => x.rule))}`)
    }
  }
  // 行内豁免的三条边界:缺原因记数、上一行生效、都不静默
  eq('arch-exempt 缺原因必须被记数(不得静默当成没有豁免标记)', analyze(ON, F({ 'apps/demo/src/a.ts': imp('@ihui/schema', ' // arch-exempt:') }), {}).stats.invalidExempt, 1)
  eq('豁免标记写在紧邻上一行同样生效', analyze(ON, F({ 'apps/demo/src/a.ts': "// arch-exempt: 自检夹具,写在上一行\n" + imp('@ihui/schema') }), {}).violations.length, 0)
  eq('与上条成对:写在上一行**再上一行**就不生效(豁免面不得无限扩张)', analyze(ON, F({ 'apps/demo/src/a.ts': "// arch-exempt: 离得太远\n\n" + imp('@ihui/schema') }), {}).violations.length, 1)
  // 表级 exceptions:放过必须留痕,且只对登记的那一条生效
  eq('已登记 exceptions 放过时必须计数(不得静默)', analyze(ON, F({ 'apps/demo/src/debt.ts': imp('@ihui/schema') }), {}).stats.policyExceptions, 1)
  eq('与上条成对:登记之外的那条 import 照判红(例外不得扩散)', analyze(ON, F({ 'apps/demo/src/other.ts': imp('@ihui/schema') }), {}).red.length, 1)
  // 清单腐烂的两面:一条没命中的例外必须被点名;命中了就不该点名
  const hitOnce = analyze(ON, F({ 'apps/demo/src/debt.ts': imp('@ihui/schema') }), {})
  eq('unusedExceptions:本轮没命中的例外必须点名(EX-STALE-1 永不命中)', unusedExceptions(ON, hitOnce.stats.exceptionIds, 'HEAD').join(','), 'EX-STALE-1')
  eq('与上条成对:命中的那条不再被点名', unusedExceptions(ON, analyze(ON, F({ 'apps/demo/src/debt.ts': imp('@ihui/schema'), 'apps/demo/tests/gone.ts': imp('@ihui/kit') }), {}).stats.exceptionIds, 'HEAD').includes('EX-DEBT-1') ? 1 : 0, 0)
  eq('暂存面不得报清单腐烂(绝大多数例外天然不命中)', unusedExceptions(ON, new Set(), 'index').length, 0)
  // --managed-trial 的试跑语义:翻 true 前就能看见有几条会红
  const trialFiles = F({ 'apps/demo/src/a.ts': imp('@ihui/schema') })
  eq('--managed-trial 让未收口模块照判红(试跑)', analyze(OFF, trialFiles, { trialModules: ['apps/demo'] }).red.length, 1)
  eq('与上条成对:不试跑时只报数', analyze(OFF, trialFiles, {}).red.length, 0)
  // 两面取材口径不同形:同一策略,暂存面只见 1 个文件、全量面见 2 个 ⇒ 结论必须不同
  const stagedFace = F({ 'apps/demo/src/a.ts': imp('@ihui/schema') })
  const fullFace = F({ 'apps/demo/src/a.ts': imp('@ihui/schema'), 'packages/kit/src/b.ts': imp('@ihui/demo') })
  eq('--staged 面与全量面必须不同形(取材面决定结论)', analyze(ON, fullFace, {}).red.length > analyze(ON, stagedFace, {}).red.length ? 1 : 0, 1)
  // 空暂存回退(2026-09-25 缺陷 1):暂存集为空时必须回退全量,不得"审 0 个文件却记绿"
  eq('planStagedScope:暂存面有源文件 ⇒ 只咬暂存集(窄口径,不回退)', JSON.stringify(planStagedScope(['apps/web/src/a.ts', 'packages/x/index.ts'], new Set(['packages/x/index.ts']))), JSON.stringify({ mode: 'staged', paths: ['packages/x/index.ts'], keep: ['packages/x/index.ts'], droppedDeleted: [] }))
  eq('planStagedScope:与上条成对,暂存集为空 ⇒ 回退全量', planStagedScope(['apps/web/src/a.ts'], new Set()).mode, 'full')
  eq('planStagedScope:暂存集里只有非源文件 ⇒ 同样算空、同样回退(守门 70 同型)', planStagedScope(['apps/web/src/a.ts'], new Set(['README.md'])).mode, 'full')
  eq('planStagedScope:回退态不得把空 paths 当结果交出去(否则 analyze 照跑 ⇒ 又是一次"扫 0 记绿")', planStagedScope(['a.ts'], new Set()).paths.length, 0)
  // 「纯删除型修复不得被自己钉红」两条成对(2026-09-25,由本门的修复提交被本门拦下这一现场暴露)
  eq(
    '回退全量必须剔掉本次提交删除的路径(否则删除违规文件的那枚提交永远落不了地)',
    JSON.stringify(planStagedScope(['a.ts'], new Set(), { headSrcPaths: ['a.ts', 'bad.ts'], deletedSet: new Set(['bad.ts']) }).keep),
    JSON.stringify(['a.ts']),
  )
  eq(
    '与上条成对:剔除动作必须**可见**(静默排除 = 判据失效,清单要交出来给 faceDesc 打印)',
    JSON.stringify(planStagedScope(['a.ts'], new Set(), { headSrcPaths: ['a.ts', 'bad.ts'], deletedSet: new Set(['bad.ts']) }).droppedDeleted),
    JSON.stringify(['bad.ts']),
  )
  eq(
    '剔除清单必须算在 **HEAD 面**上而不是索引面(D 形态的路径根本不在索引源文件清单里 —— 第一版就错在此处,导致真实场景永远打印"剔除了 0 个")',
    planStagedScope([], new Set(), { headSrcPaths: ['bad.ts'], deletedSet: new Set(['bad.ts']) }).droppedDeleted.length,
    1,
  )
  eq(
    '与上三条成对:没有删除时不得凭空剔除(剔除面只认 D 清单,不接受任何宽泛条件)',
    planStagedScope(['a.ts'], new Set(), { headSrcPaths: ['a.ts', 'b.ts'], deletedSet: new Set() }).keep.length,
    2,
  )
  // 取材面提示语(2026-09-25 缺陷 2):只有 oid 真的不等才喊,"读了索引"不等于"表没入库"
  eq('policyFaceNotice:索引==HEAD ⇒ 安静(旧写法 `!== HEAD` 在这里误报)', policyFaceNotice('索引', { HEAD: 'aaaa', 索引: 'aaaa' }), null)
  eq('policyFaceNotice:与上条成对,索引≠HEAD ⇒ 提示,且是 info 不是 warn(--staged 读索引属正常行为)', policyFaceNotice('索引', { HEAD: 'aaaa', 索引: 'bbbb' }).level, 'info')
  eq('policyFaceNotice:HEAD 根本没有这张表 ⇒ warn(只有这一型才允许说"尚未入库")', policyFaceNotice('索引', { HEAD: null, 索引: 'bbbb' }).level, 'warn')
  eq('policyFaceNotice:退到工作树 ⇒ warn(既没入库也没暂存)', policyFaceNotice('工作树', { HEAD: null, 索引: null }).level, 'warn')
  // 2026-09-29 补(--worktree 落地时本门自己踩到的误报):同一份"取自工作树",在 **要求的**就是
  // 工作树那一档时是正常取材,不是降级。把它继续喊成"退到"就是把正常行为打成异常,
  // 而人对警告脱敏之后,真降级那次也没人看了。
  eq('policyFaceNotice:--worktree 档取到工作树 ⇒ 安静(那是本档的定义,不是降级)', policyFaceNotice('工作树', { HEAD: null, 索引: null }, { requestedFace: 'worktree' }), null)
  eq('与上条成对:同一输入而要求的是全量档 ⇒ 仍 warn(证明安静只关那一格,不是把警告整条关掉)', policyFaceNotice('工作树', { HEAD: null, 索引: null }, { requestedFace: 'head' })?.level, 'warn')
  eq('与上两条成对:不传 opts(旧调用形态)必须仍是 warn(默认档不得被顺手放宽)', policyFaceNotice('工作树', { HEAD: 'h', 索引: 'i' })?.level, 'warn')
  eq('requestedFace 不得影响 HEAD / 索引两档的既有结论(只允许改"工作树"那一格)', `${policyFaceNotice('HEAD', {}, { requestedFace: 'worktree' })}|${policyFaceNotice('索引', { HEAD: 'a', 索引: 'a' }, { requestedFace: 'worktree' })}`, 'null|null')
  eq('policyFaceNotice:全量档取 HEAD ⇒ 完全安静', policyFaceNotice('HEAD', { HEAD: 'aaaa', 索引: 'bbbb' }), null)
  // T1:表与现实脱节的四种形态(变异锚点必须唯一命中,否则本自检就是在测空气)
  const existing = ['packages/schema/src/a.ts', 'packages/kit/src/a.ts', 'apps/demo/src/a.ts', 'apps/demo/src/debt.ts', 'apps/demo/package.json']
  const mutate = (yaml, from, to, name) => {
    const hits = yaml.split(from).length - 1
    if (hits !== 1) {
      fail++
      console.log(`❌ 自检锚点失效:${name} 的锚点命中 ${hits} 次(要求恰好 1 次)—— 变异根本没作用到被测实现`)
      return yaml
    }
    return yaml.replace(from, to)
  }
  const T = (yaml) => auditPolicy(loadPolicy(parseYaml(yaml, 'T1')), existing).filter((x) => !x.soft)
  const KIT_ROOTS = "    roots:\n      - 'packages/kit'\n    requires:\n      - 'packages/schema'\n"
  const DEMO_REQ = "    requires:\n      - 'packages/kit'\n    public_entrypoints: []\n"
  const SCHEMA_REQ = '    requires: []\n'
  eq('T1 roots 指向不存在的路径必拦', T(mutate(yamlFor(false), KIT_ROOTS, "    roots:\n      - 'packages/nope'\n    requires:\n      - 'packages/schema'\n", 'roots')).length, 1)
  eq('T1 requires 未登记模块必拦', T(mutate(yamlFor(false), DEMO_REQ, "    requires:\n      - 'packages/kit'\n      - 'packages/ghost'\n    public_entrypoints: []\n", 'ghost')).length, 1)
  eq('T1 requires 声明成环必拦(环 + 层序倒挂各 1 条)', T(mutate(yamlFor(false), SCHEMA_REQ, "    requires:\n      - 'packages/kit'\n", 'cycle')).length, 2)
  eq('T1 与上条成对:原表不报 T1', T(yamlFor(false)).length, 0)
  eq('T1 例外清单腐烂(指向已不存在的文件)只报数不判红', auditPolicy(ON, existing).filter((x) => x.soft).length, 1)
  // 解析器必须**大声失败**:静默跳行等于造一台扫到 0 条却报绿的机器
  const throws = (yaml, label) => {
    try {
      parseYaml(yaml, label)
      return false
    } catch {
      return true
    }
  }
  eq('解析器:Tab 缩进必抛', throws('version: 1\n\tfoo: bar', 'x'), true)
  eq('解析器:无缩进标量含 ": " 必抛(要求加引号)', throws('version: 1\nnote: a: b', 'x'), true)
  eq('解析器:与上条成对,加引号即通过', throws('version: 1\nnote: "a: b"', 'x'), false)
  eq('解析器:未闭合引号必抛', throws("version: 1\nnote: 'abc", 'x'), true)
  eq('装载器:空模块清单不得记为通过', (() => { try { loadPolicy(parseYaml('version: 1\nlayers:\n  - id: c\n    rank: 1\n', 'x')) ; return 0 } catch { return 1 } })(), 1)
  // glob 语义
  const gm = mkMatcher(['packages/types/src/**', '**/*.test.ts', 'benchmarks/**', 'scripts/**'])
  eq('glob:前缀 ** 命中任意深度子路径', gm('packages/types/src/a/b.ts') ? 1 : 0, 1)
  eq('glob:与上条成对,不吃兄弟目录', gm('packages/types/index.ts') ? 1 : 0, 0)
  eq('glob:中缀 ** 匹配任意目录深度', gm('a/b/c.test.ts') ? 1 : 0, 1)
  eq('glob:与上条成对,段内 * 不跨文件名(错拼不命中)', gm('a/b/cxtest.ts') ? 1 : 0, 0)
  eq('glob:目录前缀式在末段仍要求边界', gm('benchmarks/x/y.mjs') ? 1 : 0, 1)
  eq('glob:与上条成对,同名前缀的文件不误命中', gm('benchmarksx/y.mjs') ? 1 : 0, 0)
  // relFrom
  eq('relFrom:仓库相对路径下的 .. 归一', relFrom('apps/demo/src', '../../../packages/kit/src/x') === 'packages/kit/src/x' ? 1 : 0, 1)
  eq('relFrom:与上条成对,不越界时原地解析', relFrom('packages/kit/src', './a/b') === 'packages/kit/src/a/b' ? 1 : 0, 1)
  // ── E1 / E2 声明齐备性:全部用**构造面**(判据不得依赖仓库瞬时状态) ─────────────────
  const eYaml = (managed) => `
version: 1
constraints:
  max_file_lines: 100
  max_contract_file_lines: 40
  max_public_exports: 5
  contract_file_patterns:
    - 'packages/kinds/src/schema/**'
layers:
  - id: 'contract'
    rank: 10
modules:
  - id: 'packages/kinds'
    package: '@ihui/kinds'
    layer: 'contract'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/kinds'
    requires: []
    public_entrypoints:
      - '.'
      - './alpha'
      - './beta/*'
    contract_files:
      - 'src/schema.ts'
  - id: 'packages/loose'
    package: '@ihui/loose'
    layer: 'contract'
    exported: true
    managed: ${managed}
    roots:
      - 'packages/loose'
    requires: []
    public_entrypoints: []
  - id: 'packages/off'
    package: '@ihui/off'
    layer: 'contract'
    exported: true
    managed: false
    roots:
      - 'packages/off'
    requires: []
    public_entrypoints:
      - './gone'
`
  const EON = loadPolicy(parseYaml(eYaml(true), 'E1-ON'))
  const EOFF = loadPolicy(parseYaml(eYaml(false), 'E1-OFF'))
  const faceOf = (list, manifests = {}) => ({ tracked: new Set(list), allPaths: list, unparsed: [], manifestOf: (id) => manifests[id] || null })
  const GOOD_FACE = ['packages/kinds/src/index.ts', 'packages/kinds/src/alpha.ts', 'packages/kinds/src/beta/one.ts', 'packages/kinds/src/schema.ts', 'packages/loose/src/index.ts']
  const hardOf = (r) => r.violations.filter((x) => !x.soft)
  const declGood = auditDeclarations(EON, faceOf(GOOD_FACE), {})
  eq('E1 齐备面:纳管块 packages/kinds 的 . / ./alpha / ./beta/* 三条入口全部解析得到(0 判红)', hardOf(declGood).filter((x) => x.rule === 'entrypoint-missing' && x.module === 'packages/kinds').length, 0)
  eq('E1 未收口模块的缺失入口只报数:packages/off 的 ./gone 计 1 条 missing、0 条判红', `${declGood.counters.entrypointMissing}/${hardOf(declGood).length}`, '1/0')
  eq('E2 已声明 contract_files 的模块不算"未齐备"(loose 才是)', declGood.counters.contractAbsentModules, 1)
  eq('E2 未齐备档默认只报数(恒红门禁开关)', hardOf(declGood).length, 0)
  eq('与上条成对:--strict 档对同一份面把未齐备升成判红', hardOf(auditDeclarations(EON, faceOf(GOOD_FACE), { strict: true })).length, 1)
  const noAlpha = auditDeclarations(EON, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/alpha.ts')), {})
  eq('E1 变异:入口文件从面里消失 ⇒ 判红并点名该模块', `${hardOf(noAlpha).length}:${hardOf(noAlpha)[0] ? hardOf(noAlpha)[0].rule : '-'}`, '1:entrypoint-missing')
  eq('与上条成对:同一份缺面放在 managed:false 表里只报数(渐进收口不得被新判据绕过)', hardOf(auditDeclarations(EOFF, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/alpha.ts')), {})).length, 0)
  const noSchema = auditDeclarations(EON, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/schema.ts')), {})
  eq('E2 变异:contract_files 声明的文件失踪 ⇒ 判红(这就是"缺工件要进退出码"那一半)', `${noSchema.counters.contractDeclaredMissing}:${hardOf(noSchema).filter((x) => x.rule === 'contract-artifact-missing').length}`, '1:1')
  eq('--managed-trial 让未收口模块的齐备性照样试跑出条数', auditDeclarations(EOFF, faceOf(GOOD_FACE.filter((p) => p !== 'packages/kinds/src/alpha.ts')), { trialModules: ['packages/kinds'] }).violations.filter((x) => x.rule === 'entrypoint-missing' && !x.soft).length, 1)
  // 解析口径的三条独立形态(每条都是"少一条就漏判整类")
  const mKinds = EON.modules.get('packages/kinds')
  eq('E1 约定式解不到时须回落到包清单 exports 映射', resolveEntrypoint(mKinds, './zeta', faceOf(['packages/kinds/lib/zeta.ts'], { 'packages/kinds': { exports: { './zeta': './lib/zeta.ts' } } })).state, 'ok')
  eq('与上条成对:约定式与 exports 都指不到 ⇒ missing(不得当成"判不出"静默放过)', resolveEntrypoint(mKinds, './zeta', faceOf(['packages/kinds/lib/zeta.ts'], { 'packages/kinds': { exports: { './other': './lib/other.ts' } } })).state, 'missing')
  eq('E1 子路径 * 必须按 npm exports 语义跨段(段内 * 会把 messages/api/en.json 判成失踪)', resolveEntrypoint(mKinds, './messages/*', faceOf(['packages/kinds/messages/api/en.json'])).state, 'ok')
  eq('与上条成对:主入口 "." 无清单时按 index 约定命中', resolveEntrypoint(mKinds, '.', faceOf(['packages/kinds/src/index.ts'])).path, 'packages/kinds/src/index.ts')
  eq('E2 模块根下的自述文档(README/AGENTS/CONTEXT)是合法契约工件', moduleContractArtifacts(EON.modules.get('packages/loose'), faceOf(['packages/loose/AGENTS.md']), EON).sufficient ? 1 : 0, 1)
  eq('E1 报账拆分:纳管块的红与未纳管块的报数各归各(不得互相顶替)', `${hardOf(noAlpha).filter((x) => x.module === 'packages/kinds').length}/${noAlpha.violations.filter((x) => x.soft && x.rule === 'entrypoint-missing').length}`, '1/1')
  // ── X1 / X2:表级例外的寿命(2026-09-27 补)。全部走**构造面**,不拿仓库瞬时状态当前提 ──
  const exTable = (entries) => `
version: 1
constraints:
  max_file_lines: 100
  max_contract_file_lines: 40
  max_public_exports: 5
layers:
  - id: 'contract'
    rank: 10
modules:
  - id: 'packages/a'
    package: '@ihui/a'
    layer: 'contract'
    exported: true
    managed: true
    roots:
      - 'packages/a'
    requires: []
    public_entrypoints: []
exceptions:
${entries}
`
  const EX = (entries) => loadPolicy(parseYaml(exTable(entries), 'X'))
  const exOf = (id) => `  - id: '${id}'\n    rule: 'file-lines'\n    module: 'packages/a'\n    status: 'debt'\n`
  const withUntil = (id, until) => `${exOf(id)}    until: '${until}'\n    reason: '自检夹具:带到期日的例外'\n`
  const noUntil = (id) => `${exOf(id)}    reason: '自检夹具:没有到期日的例外'\n`
  const X = (P, o) => auditExceptionExpiry(P, { today: '2026-09-28', ...o })
  const xRules = (r) => [...r.hard.map((x) => x.rule), ...r.soft.map((x) => `soft:${x.rule}`)]
  eq('X2 已过期 ⇒ 判红并点名 id(不是只报数)', xRules(X(EX(withUntil('EX-GONE', '2020-01-01')), {})).join(','), 'exception-expired')
  eq('X2 的判红必须把 id 打进消息里(否则修复者不知道该续哪一条)', /EX-GONE/.test(X(EX(withUntil('EX-GONE', '2020-01-01')), {}).hard[0].msg) ? 1 : 0, 1)
  const okRun = X(EX(withUntil('EX-OK', '2099-12-31')), {})
  eq('与上条成对:未过期 ⇒ 0 判红、只计数(dated=1)', `${okRun.hard.length}/${okRun.counters.dated}`, '0/1')
  eq('到期日**当天仍有效**(与守门 108 的 isPast 同一条方向)', X(EX(withUntil('EX-D', '2020-01-01')), { today: '2020-01-01' }).hard.length, 0)
  eq('与上条成对:次日即判红(方向反了就等于永久豁免)', X(EX(withUntil('EX-D', '2020-01-01')), { today: '2020-01-02' }).hard.length, 1)
  eq('X1 缺 until + 锚点面(HEAD 那份表)已有同一条 ⇒ 存量只报数(不得转嫁成无关提交的红)', xRules(X(EX(noUntil('EX-STOCK')), { anchorUndatedIds: new Set(['EX-STOCK']) })).join(','), 'soft:exception-no-until')
  eq('与上条成对:同一份表而锚点面没有该 id(= 本次新登记)⇒ X1 判红 —— "必须有到期日"在提交链上是生效的', xRules(X(EX(noUntil('EX-NEW')), { anchorUndatedIds: new Set() })).join(','), 'exception-no-until')
  eq('--strict 把待裁存量也判红(默认只报数不是永久豁免;解阻动作见门头的 EX-C2-1 段)', X(EX(noUntil('EX-STOCK')), { anchorUndatedIds: new Set(['EX-STOCK']), strict: true }).hard.length, 1)
  eq('锚点面取不到(null)⇒ 不设基线:无日期一律按新增问责,并在 counters 里留下 anchorMissing=1', `${X(EX(noUntil('EX-STOCK')), { anchorUndatedIds: null }).hard.length}/${X(EX(noUntil('EX-STOCK')), { anchorUndatedIds: null }).counters.anchorMissing}`, '1/1')
  eq('非法月日判"没有日期"而不是 NaN 比较(NaN 与任何日期比较都是 false ⇒ 写歪一条就永不红)', xRules(X(EX(withUntil('EX-BAD', '2026-13-40')), { anchorUndatedIds: new Set() })).join(','), 'exception-no-until')
  eq('把"永久"伪装成日期(2999-12-31)同样按格式拒绝 ⇒ 落 X1,不进 dated 计数', `${xRules(X(EX(withUntil('EX-FOREVER', '2999-12-31')), { anchorUndatedIds: new Set() })).join(',')}/${X(EX(withUntil('EX-FOREVER', '2999-12-31')), {}).counters.dated}`, 'exception-no-until/0')
  eq('无 id 的畸形条目由 T1 点名,X1 只计 malformed、不重复判红(两道判据不得互相顶名额)', xRules(X(EX(`  - rule: 'file-lines'\n    module: 'packages/a'\n    reason: '自检夹具:缺 id 的畸形条目'\n`)), { anchorUndatedIds: new Set() }).join(','), '')
  eq('与上条成对:同一条畸形在 T1 那里必须仍是红', auditPolicy(EX(`  - rule: 'file-lines'\n    module: 'packages/a'\n    reason: '自检夹具:缺 id 的畸形条目'\n`), ['packages/a/src/x.ts']).filter((x) => !x.soft).length, 1)
  // 三条判据互不顶替:同一条例外可以既"永不命中"又"没有到期日",两边都必须各自报名
  const bothP = ON
  const bothX = X(bothP, { anchorUndatedIds: undatedExceptionIds(bothP) })
  eq('既有行为不回退:永不命中的例外仍由 unusedExceptions 点名(X1/X2 不接管它)', unusedExceptions(bothP, new Set(['EX-DEBT-1']), 'HEAD').join(','), 'EX-STALE-1')
  eq('既有行为不回退:同一张表里 X1 的存量档只报数(ON 的两条例外都无 until)', xRules(bothX).join(','), 'soft:exception-no-until,soft:exception-no-until')
  eq('undatedExceptionIds 只收无合法 until 的 id(它是锚点与判据共用的唯一一份实现)', [...undatedExceptionIds(EX(`${withUntil('EX-A', '2099-01-01')}${noUntil('EX-B')}`))].join(','), 'EX-B')
  eq('today 自身不是合法日期 ⇒ 整条"过期与否"判不了:记 expiryUndetermined 并报名,既不冒红也不记成未过期', (() => { const r = X(EX(withUntil('EX-EVIL', '2000-01-01')), { today: 'not-a-date' }); return `${r.hard.length}/${r.counters.expiryUndetermined}/${r.counters.expired}` })(), '0/1/0')
  eq('与上条成对:同一份表给一个合法 today ⇒ 立刻判红(证明上一条的 0 是"判不了",不是"判了说没问题")', X(EX(withUntil('EX-EVIL', '2000-01-01')), { today: '2026-09-28' }).hard.length, 1)
  // ── DC:纳管块内的 lint 抑制棘轮(锚点 = 该文件在锚点面自身的条数) ─────────────────
  const dcPath = 'packages/kit/src/dc.ts'
  const dcComment = "// eslint-disable-next-line no-console\nexport const a = 1\n"
  const dcBlock = "/* eslint-disable */\nexport const a = 1\n"
  const dcTsIgnore = "// @ts-ignore 自检夹具\nexport const a = 1\n"
  const dcTsNocheck = "// @ts-nocheck\nexport const a = 1\n"
  const dcInString = "export const s = '@ts-ignore'\nexport const re = /eslint-disable/\n"
  const dcReds = (r) => r.red.filter((x) => x.rule === 'lint-suppression-growth').length
  eq('DC 纳管块新增裸 eslint-disable(锚点面该文件 0 处 = 新文件)⇒ 判红', dcReds(analyze(ON, F({ [dcPath]: dcComment }), { suppressionAnchors: new Map() })), 1)
  eq('与上条成对:同一份内容而锚点面已有 1 处 ⇒ 只报数不判红(存量不得转嫁)', dcReds(analyze(ON, F({ [dcPath]: dcComment }), { suppressionAnchors: new Map([[dcPath, 1]]) })), 0)
  eq('DC 下降(别人删了抑制)同样不判红 —— 棘轮只拦上升', dcReds(analyze(ON, F({ [dcPath]: dcComment }), { suppressionAnchors: new Map([[dcPath, 5]]) })), 0)
  eq('全量档(锚点与内容同面 ⇒ 恒等)不得因存量判红:这一条就是"真仓 HEAD 面不新增红"的机制证明', dcReds(analyze(ON, F({ [dcPath]: dcComment.repeat(4) }), {})), 0)
  eq('报账不被静默:未判红也要把条数打进 stats(否则"没看见"与"没有"在账面上同形)', analyze(ON, F({ [dcPath]: dcComment }), { suppressionAnchors: new Map([[dcPath, 1]]) }).stats.suppressions, 1)
  eq('块级豁免:未收口块(managed:false)的抑制不在 DC 射程 ⇒ 0 判红、0 纳管计数,但全量计数必须报名', (() => { const r = analyze(OFF, F({ [dcPath]: dcComment }), { suppressionAnchors: new Map() }); return `${dcReds(r)}/${r.stats.suppressions}/${r.stats.suppressionsAll}` })(), '0/0/1')
  eq('字面量里的同名样例不得算抑制(门不得把自己写的散文判成违规;守门 131 同型)', suppressionCount(dcInString), 0)
  eq('与上条成对:同一批字样写进注释必须算(证明清空只关掉字符串那一格,不是把判据关掉)', `${suppressionCount(dcTsIgnore)}/${suppressionCount(dcTsNocheck)}`, '1/1')
  eq('块注释形态必须被看见(与行注释同权)', suppressionCount(dcBlock), 1)
  eq('预筛必须是判据字面量的超集:@ts-nocheck 也得进重路径(漏了它,门对该形态全盲而一路报绿)', mayHaveSuppression(dcTsNocheck) ? 1 : 0, 1)
  eq('与上条成对:不含任何判据字面量的文本必须被预筛挡下(否则预筛等于没筛)', mayHaveSuppression('export const a = 1\n') ? 1 : 0, 0)
  eq('预筛串必须逐字覆盖守门 108 认的两族字面量(它扩族而本门不跟,DC 就对新形态失明)', `${SUPPRESS_PREFILTER.join(',')}|${scanExemptionLedger('virtual', blankStrings(dcTsNocheck + dcComment)).suppressions['ts-ignore']}/${scanExemptionLedger('virtual', blankStrings(dcTsNocheck + dcComment)).suppressions['eslint-disable']}`, 'eslint-disable,@ts-|1/1')
  eq('计数实现只有一份:DC 的数必须等于守门 108 scanFile 在同一个遮罩面上的读数', suppressionCount(dcComment + dcTsIgnore) === Object.values(scanExemptionLedger('virtual', blankStrings(dcComment + dcTsIgnore)).suppressions).reduce((a, b) => a + b, 0) ? 1 : 0, 1)
  eq('analyze 未收口块也不得把增长红算进 red:同一份 import 违规 + 抑制上升,两类各归各', analyze(OFF, F({ [dcPath]: dcComment }), { suppressionAnchors: new Map() }).red.length, 0)
  // ── 三面取材 + 参数闸门(`--worktree` 落地那一批,AGENTS §118 口径:面旗同给判死、不回落)──────
  // 立因(实测):`--worktree` 在 AGENTS 里被 42 行提到,而本门 `main(argv)` 只解析四个旗标,
  // 于是它被**静默忽略并落回默认 HEAD 档** —— `--worktree --json` 与 `--json` 输出逐字同形。
  // 读的人以为在审工作树,实际审的是上一提交态;这与本仓"未知参数降级成无参就是造合格证"同型。
  eq('policyFaceOrder(head):HEAD 优先,再降级索引/工作树', policyFaceOrder('head').join('>'), 'HEAD>索引>工作树')
  eq('policyFaceOrder(staged):索引优先(改表那枚提交必须被审)', policyFaceOrder('staged').join('>'), '索引>HEAD>工作树')
  eq('policyFaceOrder(worktree):**只有**工作树一个候选 —— 单元素就是"不回落"的结构保证', policyFaceOrder('worktree').join('>'), '工作树')
  eq('与上条成对:工作树档磁盘没有表 ⇒ pickPolicySource 给 null(由 main 落 exit 2,不得借 HEAD 凑数)',
    pickPolicySource(policyFaceOrder('worktree').map((l) => [l, { 工作树: null }[l]])) === null ? 1 : 0, 1)
  eq('旧形态兼容:true/false 仍映射到 staged/head(镜像测试 T12 的调用面)', `${policyFaceOrder(true).join('>')}|${policyFaceOrder(false).join('>')}`, '索引>HEAD>工作树|HEAD>索引>工作树')
  eq('revToFace 认旧 rev 串', `${revToFace('HEAD')}|${revToFace('')}|${revToFace('worktree')}`, 'head|staged|worktree')
  eq('revToFace 认不出的输入必须抛(绝不猜默认面 —— 猜一次就把新面静默降回 HEAD)',
    (() => {
      try {
        revToFace('nope')
        return 'no-throw'
      } catch (e) {
        return /无法识别的取材面/.test(e.message) ? 'throws' : `wrong:${e.message}`
      }
    })(),
    'throws')
  eq('与上条成对:布尔不得被 revToFace 直接接受(它是 policyFaceOrder 的历史形态,不是面名)',
    (() => {
      try {
        revToFace(true)
        return 'no-throw'
      } catch {
        return 'throws'
      }
    })(),
    'throws')
  eq('pickFace:默认 head', pickFace([]).face, 'head')
  eq('pickFace:--staged ⇒ staged', pickFace(['--staged']).face, 'staged')
  eq('pickFace:--worktree ⇒ worktree(这次新增的那一档)', pickFace(['--worktree']).face, 'worktree')
  eq('pickFace:两面旗同给 ⇒ error 且不给面名(不得任选一面)', `${pickFace(['--staged', '--worktree']).face}|/error=${pickFace(['--staged', '--worktree']).error ? 1 : 0}`, 'null|/error=1')
  eq('inspectArgs:四个既有旗标 + 新旗标全部放行', inspectArgs(['--staged', '--json', '--strict', '--worktree', '--self-test']).unknown.length, 0)
  eq('inspectArgs:拼错的旗标必须被点名(它曾掉进默认分支而账面一切正常)', inspectArgs(['--wroktree']).unknown.join(','), '--wroktree')
  eq('与上条成对:同一批合法旗标在尺子下为 0(证明上一条不是"只要带旗标就红")', inspectArgs(['--worktree']).unknown.length, 0)
  eq('inspectArgs:值旗标的紧邻值放行(--managed-trial 的模块 id)', inspectArgs(['--managed-trial', 'apps/demo', '--strict']).unknown.length, 0)
  eq('inspectArgs:没有被值旗标领着的裸位置参数必须拒(它多半是漏写旗标的那个值)', inspectArgs(['apps/demo']).unknown.join(','), 'apps/demo')
  eq('trialModulesFrom:只吃 --managed-trial 之后的非旗标 token', trialModulesFrom(['--managed-trial', 'apps/demo', 'packages/sdk', '--strict']).join(','), 'apps/demo,packages/sdk')
  eq('trialModulesFrom:没有该旗标时给空(不得把位置参数当试跑模块)', trialModulesFrom(['--strict']).length, 0)
  eq('KNOWN_FLAGS 与 VALUE_FLAGS 成套:值旗标必须同时在 KNOWN_FLAGS 里(否则"旗标认识、值被拒"= 自相矛盾)',
    VALUE_FLAGS.every((f) => KNOWN_FLAGS.includes(f)) ? 1 : 0, 1)
  eq('FACE_REV/FACE_LABEL_CN 必须覆盖 FACES 全集(漏一个面 = 那一面拿到 undefined rev 而静默读错面)',
    FACES.every((f) => typeof FACE_REV[f] === 'string' && typeof FACE_LABEL_CN[f] === 'string') ? 1 : 0, 1)
  eq('readFaceDetailed:空清单既不读也不报 missed(不得凭空派生 git)', `${readFaceDetailed('head', []).files.size}/${readFaceDetailed('head', []).missed.length}`, '0/0')
  eq('工作树档的表顺序与工作树面的中文标签必须同词(pickPolicySource 按标签取,两处各写必漂移)',
    policyFaceOrder('worktree').includes(FACE_LABEL_CN.worktree) ? 1 : 0, 1)
  console.log(fail ? `\n❌ 自检 ${fail} 例失败` : `\n全部 ${ran} 例通过(成对正反例 + T1 表自洽 + E1/E2 声明齐备性 + X1/X2 例外寿命 + DC lint 抑制棘轮 + 三面取材与参数闸门(--worktree / 矛盾旗标 / 未知旗标)+ 两面口径差异 + 空暂存回退 + 取材面提示语 + 解析器大声失败 + glob/relFrom)`)
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    selfTest()
  } else if (process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):架构契约门未执行`)
  } else {
    try {
      process.exit(main(argv))
    } catch (e) {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    }
  }
}

export const __test__ = { parseYaml, loadPolicy, analyze, auditPolicy, auditDeclarations, resolveEntrypoint, moduleContractArtifacts, declarationContext, extractSpecs, globToRe, mkMatcher, matchEntrypoint, relFrom, pickPolicySource, policyFaceOrder, planStagedScope, widenStagedScopeOverDependents, policyFaceNotice, registrationOf, unusedExceptions, validUntil, undatedExceptionIds, mayHaveSuppression, suppressionCount, auditExceptionExpiry, publicMethodCount, RULES, ALWAYS_RED, POLICY_REL, SUPPRESS_PREFILTER, UNTIL_RE,
  // ── 三面取材 + 参数闸门(2026-09-29 补 `--worktree` 时新增的出口)──
  // 镜像测试必须**import 这些判据**,不得在测试里再抄一份(§22c:两份真相必然漂移)。
  // `listFacePaths` / `readFaceDetailed` 带 root 形参,是为了让取证在**临时 git 仓**里造
  // "索引≠磁盘"的现场 —— 本门的 ROOT 由脚本自身位置推导(生产不可注入),而拿真仓瞬时状态
  // 当前提正是本文件 T8/T12 记过的那一型。
  revToFace, listFacePaths, readFaceDetailed, inspectArgs, pickFace, trialModulesFrom, FACES, FACE_REV, FACE_LABEL_CN, KNOWN_FLAGS, VALUE_FLAGS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
