// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * safe-commit 的"钩子失败归因"判据(2026-09-25 立)。
 *
 * 要修的那个缺陷:safe-commit 在首次 commit 失败后原样打印
 *   「按用户规则"hook 失败因其他 agent 代码 → --no-verify 重试"」
 * 并直接 `--no-verify`。问题是**它从未计算过归因** —— "其他 agent 代码"是抄来的结论,不是量出来的。
 * 实测(2026-09-25 00:4x):一轮 134 道门跑完 111 通过 / 2 警告 / **1 失败**,红的是
 * `check-push-sync`(判的是"本地是否领先远端"这种远端态,与提交内容无关),而输出照样写成
 * "因其他 agent 代码"。三种不相干的成因被压成同一条措辞:
 *   ① 我的内容真红  → 本该修完再提,却跳门把违规送进主干;
 *   ② 别人的内容红  → 跳门是对的(AGENTS §12),措辞也该如此;
 *   ③ 门判的是机器/远端态 → 提交者结构上无法满足,跳门合法,但写成"他人代码"会让人以为
 *      门在别人的问题上生效过。
 *
 * 为什么不维护一张"机器态门 id 清单":清单必然腐烂(AGENTS 对 `RN_ONLY_BRAND_KEYS` 的教训是
 * "豁免项若已不存在同样算红")。这里改成**按当次证据判定**:
 *   - 先把 runner 汇总里的 blocking 失败门逐条解析出来(格式与 `printSummary` 同源);
 *   - 再逐道复跑该门,拿它**自己这次的输出**去比对本次声明的文件集:
 *     点名了我的文件 ⇒ 判"我的",拒绝跳门;
 *     复跑已过关 ⇒ 更强的一条:该红不在本次内容里;
 *     仍红且未点名 ⇒ **不再一句话裁定**,改走"差分"(见下方四态)。
 *
 * ── 四态差分(2026-09-27 立)────────────────────────────────────────────
 * 上面那句"仍红且未点名 ⇒ not-ours"是一句**做不到的承诺**:很多门的失败行只点名符号、
 * 不点名文件,于是"因本次改动而红"与"HEAD 上早就红"在判据手里长得一模一样,而措辞写的是
 * 「红不在本次提交内容里」—— 把"我没看见路径"写成了"它不是我的"。
 * 实测载体:`scripts/check-tool-name-display-coverage.mjs` 的红行是
 *   `[tool-name-coverage] ❌ 覆盖率 86/87` + `  未映射工具名(1):probe_zz_missing_tool`
 * 通篇没有任何文件路径(留痕 ts=2026-09-27T09:05:40Z 那枚自引入的红就是这样被放过去、
 * 27 分钟后由 fa9e4e64d 补的)。
 * 所以"仍红且未点名"这一支按**同一道门在基线面(HEAD)上的读数**再分三档:
 *   ② 基线面 exit 0 而我的面红 ⇒ **introduced** ⇒ 判 mine(堵住本型的那一态);
 *   ③ 基线面同样红        ⇒ **stock**     ⇒ not-ours,措辞只能是「HEAD 面亦红 ⇒ 存量/机器态,非本次引入」;
 *   ④ 基线面跑不出去      ⇒ **undetermined-red** ⇒ 仍可落地(应急路径不能删,否则"别人把我挡在
 *      门外"的出路消失会更糟),但措辞**禁止**出现"不在本次提交内容里",必须明写"未能差分,归属未知"。
 * 失效方向只允许"多要一次定向说明",绝不允许"多放一次跳门"(AGENTS §12 原话)。
 * 基线面由调用方注入 `runGateBaseline(script)`,本模块**自己不碰 git**;它在隔离面跑不通时
 * 必须落到 ④,不得伪装成 ③ —— 这是 `baselineUsable()` 存在的全部理由。
 * ⚠️ 同样刻意**不建**"哪些门可差分"的门 id 清单:可差分区由"基线面这一次跑得出跑不出"现读,
 * 清单必然腐烂(见上)。
 *
 * 本模块是纯判定 + 注入式复跑(`runGate` / `runGateBaseline`),因此可在不 spawn git 的前提下自测。
 */

const ANSI_RE = /\x1b\[[0-9;]*m/g

/**
 * "长得像结论的行"的标记。
 * ⚠️ 为什么必须逐行筛而不是整段 includes:守门脚本常在开头**回显本次触发它的文件清单**
 * (门 35 mypy 实测就打 `[mypy 守门] staged 检测到 2 个 Python 文件改动:\n - apps/ai-service/...`)。
 * 整段子串匹配会把这行清单当成"该门点名了我的违规"⇒ 误判 `mine` ⇒ 把别人一次本该合法的提交
 * 拒死(2026-09-25 02:22 真实发生,留痕 kind=mine,而 mypy 真正报错的是另外两个文件)。
 * 结论行必带定位或错误字样;纯清单行不带,故排除。
 */
const FINDING_LINE_RE = /(error|错误|违规|failure|failed|❌|✗|:\d+\b|报数|判定)/i

/** 汇总块之后才是"批外步骤"的输出(pre-commit-hook 在 runner 之后还有若干独立 blocking 步)。 */
function tailAfterSummary(text) {
  const clean = stripAnsi(text || '')
  const at = clean.lastIndexOf('守门脚本批量检查汇总')
  return at < 0 ? null : clean.slice(at)
}

/** 钩子里"某一步失败并阻止提交"的打印(lint-staged / 各独立步骤都用这一形状)。 */
const STEP_FAIL_RE = /❌\s*([^\n]{2,120}?)失败[，,]\s*提交已阻止/g
/** 明显是"内容错"而非"清单回显"的形状。 */
const ERROR_SHAPE_RE = /\d+:\d+\s+error|SyntaxError|Cannot find module|not defined|failed|✖/

/**
 * 从"没有守门汇总块"的钩子输出里做**最后一级**归因:找出把提交挡住的那一步,
 * 取它自己那一段输出(失败标记之前 ≤45 行),看它有没有点名本次声明的文件。
 *
 * 为什么必须有这一级(2026-09-25 实测,提交 9bd6748ba):`lint-staged` 跑在守门批**之前**,
 * 它一失败就没有任何汇总块产生 ⇒ 本模块的解析与逐道复跑全都没有输入 ⇒ 判 `unattributed`
 * ⇒ safe-commit 走应急路径落地。而那一轮点名的是**我自己刚写出来的 eslint 错误**
 * (`'Undetermined' is defined but never used` in 我本次提交的文件)。这与 48ac2c03e 是同一条
 * 事故路径的第二个入口:第一个入口是"借了别人那轮的汇总"(已由轮次绑定关掉),这一个入口是
 * "根本没有汇总,于是连尝试归因都没有"。判据仍然保守 —— 只在该步输出**同时**含错误形状
 * (eslint 的 `行:列 error` / SyntaxError / Cannot find module …)且含本次声明的文件路径时才定责,
 * 纯清单回显(`📋 staged 文件清单`)不含错误形状,不会被读成点名。
 */
export function blameFromFailedStep(text, stagedFiles) {
  const clean = stripAnsi(text || '')
  if (!clean.trim()) return null
  const marks = [...clean.matchAll(STEP_FAIL_RE)]
  for (const m of marks) {
    const block = clean.slice(Math.max(0, m.index - 6000), m.index).split(/\r?\n/)
    const window = block.slice(-45).join('\n')
    if (!ERROR_SHAPE_RE.test(window)) continue
    const win = window.replace(/\\/g, '/')
    // 归一与"结论行点名"共用一份实现(lineNamesFile),否则两处判据必然漂移。
    const named = (stagedFiles || []).filter((f) =>
      win.split(/\r?\n/).some((l) => lineNamesFile(l, f)),
    )
    if (named.length > 0) return { step: m[1].trim(), named }
  }
  return null
}

/**
 * 批外步骤名 —— 只在"汇总已跑完且批内 0 blocking 失败"时才有意义。
 *
 * 为什么要单独认这一型(2026-09-25 实测):钩子里 `i18n 死 key 扫描` 这类步骤跑在 runner **之后**,
 * 它一红就 `process.exit(1)`,于是 `safe-commit` 拿到的是"批没红、提交却红了"的组合。
 * 旧版把它归成 `unattributed`(措辞:汇总里没列出 blocking 失败门),然后照样 `--no-verify` 落地
 * —— 而实测那一轮 154 道门**全部跑完、失败 0、警告 1**,即批内结论本来是拿得到的,却被丢掉。
 * 现在点名是哪一步,并照旧按"它的结论行有没有点名本次文件"决定归因方向。
 */
export function outsideBatchStep(text) {
  const tail = tailAfterSummary(text)
  if (!tail) return null
  const m = tail.match(/❌\s*([^\n]+?)\s*(?:失败|,提交已阻止)[^\n]*提交已阻止/)
  return m ? m[1].trim() : null
}

/**
 * 只在"结论行(含其缩进续行)"里找本次声明的文件。
 *
 * ⚠️ 为什么必须带续行(2026-09-25 实测逼出来):不少门把**结论**与**定位**拆成两行 ——
 * 守门 84 的正文就是
 *   `❌ 检出 1 个文件的暂存内容等于其**历史提交版本**…`   ← 只有 ❌,没有路径
 *   `   - apps/…/remote-locales.gen.ts  ==  307afd6c3`      ← 只有路径,没有 FINDING 字样
 * 逐行匹配时第二行不算结论行 ⇒ 本函数看不见被点名的文件 ⇒ 判 `not-ours` ⇒ **允许跳门**。
 * 也就是"门说得越具体,铰链越松",方向正好错。取续行的判据是"缩进比结论行更深且非空",
 * 最多 3 行;宁可将清单回显一并计入(至多多要求一次定向说明),也不放过一次本任务自己的红。
 */
export function findingLines(output) {
  const lines = stripAnsi(output).split(/\r?\n/)
  const found = []
  for (let i = 0; i < lines.length; i++) {
    if (!FINDING_LINE_RE.test(lines[i])) continue
    found.push(lines[i])
    const baseIndent = /^\s*/.exec(lines[i])[0].length
    for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
      const cont = lines[j]
      if (!cont.trim()) break
      if (/^\s*/.exec(cont)[0].length <= baseIndent) break
      found.push(cont)
    }
  }
  return found
}

export function stripAnsi(text) {
  return String(text ?? '').replace(ANSI_RE, '')
}

/**
 * 路径归一的**唯一实现**(2026-09-27 立)。
 *
 * 为什么要抽出来:本模块有**三处**"这一行有没有点名本次文件"(结论行、批外步骤尾、无汇总时
 * 报错正文),而 2026-09-26 之前只有第三处做了反斜杠归一(`blameFromFailedStep`),前两处直接
 * `l.includes(f)` ⇒ 门打 `app\services\x.py` / `D:\IHUI-AI\scripts\x.mjs` 这两形态时**匹配不上**。
 * 两处算同一件事必须共用一份实现(AGENTS 记过多次:各写一遍必然在窗口/深度/形态上漂移)。
 * 归一只做三件可判的事:反斜杠→正斜杠、去首尾空白、去行首 `./`。**不猜仓库根** ——
 * 绝对路径形态由"允许 `/` 作为前导"覆盖,不需要知道根在哪。
 */
export function normGatePath(p) {
  return String(p ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

/** 段边界判据:命中处前后不得仍是路径字符,否则 `xscripts/foo.mjs` 会被读成点名了 `scripts/foo.mjs`。 */
const PATH_CHAR_BEFORE = /[A-Za-z0-9_.\-/]/
const PATH_CHAR_AFTER = /[A-Za-z0-9_]/

/**
 * `hay` 里是否存在一个**独立成段**的 `needle`。
 * `allowSlashBefore` 只在"声明路径整体被包含"时开:那正是门打绝对路径
 * (`D:/IHUI-AI/scripts/x.mjs`)的形态,前面的 `/` 是根分隔符而不是同名目录。
 */
function containsPathSegment(hay, needle, allowSlashBefore) {
  if (!hay || !needle) return false
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = at === 0 ? '' : hay[at - 1]
    const after = at + needle.length >= hay.length ? '' : hay[at + needle.length]
    if (before && (PATH_CHAR_BEFORE.test(before) && !(allowSlashBefore && before === '/'))) continue
    if (after && PATH_CHAR_AFTER.test(after)) continue
    return true
  }
  return false
}

/**
 * "这一行有没有点名本次声明的第 `declared` 个文件"—— 三形态同判(2026-09-27):
 *  ① 仓根相对全路径 `scripts/x.mjs`(最常见);
 *  ② 绝对路径里含该相对段 `D:/IHUI-AI/scripts/x.mjs`;
 *  ③ **端内相对** `app/services/mcp_server.py`(门在端目录里跑,打的是端内路径)——
 *     从第二段起构造后缀,**至少两段**:裸文件名会撞上无数无关输出,那是造假 mine。
 * 失效方向:② ③ 只会让铰链**多要求一次定向说明**(判 mine),绝不放宽跳门。
 */
export function lineNamesFile(line, declared) {
  const l = normGatePath(line)
  const d = normGatePath(declared)
  if (!l || !d) return false
  if (containsPathSegment(l, d, true)) return true
  const segs = d.split('/')
  for (let i = 1; i < segs.length - 1; i++) {
    if (containsPathSegment(l, segs.slice(i).join('/'), false)) return true
  }
  return false
}

/**
 * 基线面(HEAD)这一次读数**能不能拿来当证据**。
 *
 * 为什么这是差分判据的生死线:基线面是在一棵隔离树里跑的 —— 缺 `node_modules`、
 * 可能不在 git 检出里、门自身可能按设计"取不到判无法判定"(exit 2)。这些情形如果一律
 * 按"基线面也红"归档,铰链就会产出本仓最贵的那一型假账:**把"没跑到"写成"跑过且没问题"**。
 * 所以三态必须分开:能用 / 不能用(落第④态 undetermined-red)/ 未提供出口(同样不能用)。
 */
const BASELINE_UNUSABLE_OUT_RE =
  /Cannot find module|MODULE_NOT_FOUND|ENOENT|EACCES|EPERM|不是内部或外部命令|command not found|not a git repository|No such file or directory|无法判定|未判定/i

export function baselineUsable(b) {
  if (!b || typeof b !== 'object') return { ok: false, why: '未提供基线面出口 ⇒ 无从差分' }
  if (b.ran === false) return { ok: false, why: b.why || '基线面未产出结论(ran=false 且未给原因)' }
  if (b.status === null || b.status === undefined)
    return { ok: false, why: `基线面退出码取不到(${b.why || '被中断或超时'})` }
  if (b.status === 2)
    return { ok: false, why: '基线面按本仓约定判"无法判定"(exit 2)—— 那是"没判",不是"判过且没问题"' }
  if (BASELINE_UNUSABLE_OUT_RE.test(String(b.output ?? '')))
    return { ok: false, why: `基线面在隔离面跑不通(缺依赖 / 非 git 检出 / 门按磁盘判),不得读成"存量"` }
  if (b.ran !== true) return { ok: false, why: `基线面未声明 ran:true(实得 ${JSON.stringify(b.ran)})` }
  return { ok: true, why: null }
}

/**
 * 解析 guardian-runner 的汇总块。
 * 返回 { batchReported, executed, total, earlyAbort, failed:[{id,label,script}] }
 *
 * ⚠️ 格式锚点必须与 `scripts/guardian-runner.mjs` 的 printSummary / failedGates 输出一致:
 *   `  总检查数: 134(已执行 134)`
 *   `🚫 1 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:`
 *   `   · [29] 🚀 Push 同步兜底(...)`
 *   `     单独复现:node scripts/check-push-sync.mjs --staged`
 * 格式漂了必须落到 `batchReported:false`(= 未归因),**绝不**静默当成"没有失败门"。
 */
export function parseGateSummary(text) {
  const clean = stripAnsi(text)
  const totalM = /总检查数:\s*(\d+)\s*[（(](?:已执行\s*(\d+))?/.exec(clean)
  const executed = totalM ? Number(totalM[2] ?? totalM[1]) : null
  const total = totalM ? Number(totalM[1]) : null
  const earlyAbort = /←\s*提前中止/.test(clean)
  const failed = []
  const seen = new Set()
  for (const m of clean.matchAll(
    /·\s*\[([^\]]+)\]\s*([^\n]*)\n\s*单独复现:node\s+scripts\/(\S+)/g,
  )) {
    const id = m[1].trim()
    // 去重:真实钩子日志是多轮追加的(取样时同一道门出现 4 次),不去重就会把该门复跑 N 遍,
    // 明细里全是重复行。单次调用的输出本不含重复,这一条是防御性的。
    if (seen.has(id)) continue
    seen.add(id)
    failed.push({ id, label: m[2].trim(), script: m[3].trim() })
  }
  const batchReported = totalM !== null || /道\s*blocking\s*门失败/.test(clean)
  return { batchReported, executed, total, earlyAbort, failed }
}

/** 一句提示:钩子常把汇总只写进日志文件,stdout 里根本没有 —— 那是本判据的第二输入源 */
const SUMMARY_HEAD_RE = /🛡️\s*守门脚本批量检查汇总/g

/**
 * 取某一轮汇总块**之前**最近一次的 `staged 文件清单(N 个):` 回显,解析成文件集合。
 * 这是本仓唯一能把一段日志输出**绑定到具体某一枚提交**的内容证据 —— 日志没有时间戳、
 * 也没有轮次号(实测按 `^YYYY-MM-DD` 抓时间戳零命中),而这份回显是钩子入口自己打的。
 * @returns {string[]|null} null = 该块之前找不到回显(无从判定归属)
 */
export function parseStagedEcho(text, beforeIndex = String(text || '').length) {
  const seg = String(text || '').slice(0, beforeIndex)
  // 只锚 "staged 文件清单" 这段前缀:钩子真实措辞是 `staged 文件清单(N 个):`(实测 149/158 轮
  // 有回显),而本模块的夹具历史上写成不带计数的 `staged 文件清单:` —— 两种都要认,
  // 否则判据会因为"自己 fixtures 与线上不同形"而恒判"无回显"(=永远未归因,等于没有第二输入源)。
  const at = seg.lastIndexOf('staged 文件清单')
  if (at < 0) return null
  const files = []
  for (const line of seg.slice(at).split('\n').slice(1)) {
    const m = line.match(/^\s*-\s+(\S+)\s*$/)
    if (m) {
      files.push(m[1].trim())
      continue
    }
    // 第一个非 `- ` 行即清单结束(再往后属于别的段,不是本轮的暂存集)
    break
  }
  return files.length ? [...new Set(files)].sort() : null
}

/**
 * 从一整段日志(多轮追加)里取**最后一轮**的汇总文本,并把它**绑定到本次声明的文件集**。
 *
 * 为什么需要它:实测 2026-09-25 那次 --no-verify,`hookOutput` 里只有到 `[30a]` 为止的进度行,
 * 真正的汇总块(134 项跑完 / 3 道红:30c 71 84)只落在 `.workbuddy/hook-logs/pre-commit.log`。
 * 没有这一层,归因在真仓里的实际命中率是"永远未归因"。
 *
 * 为什么第二道锁必须换掉(同日晚间实测):旧写法只要求"窗口里出现过本次声明的**任一**文件名"
 * (`.some()`)。而那段窗口实测有 48KB–202KB,里头几乎必然提到 `PROJECT_PLAN.md` / `AGENTS.md`
 * (守门 71/13c 的结论行就点名它们)⇒ **任何一次借用上一轮汇总都能过锁**。后果不是少跑一道门,
 * 而是把"我自己的红"洗成 `not-ours` 并合法 --no-verify:实测提交 `48ac2c03e`(4 文件,红在
 * eslint `no-unused-vars`)就是这样跳掉了整批 152 道门 —— 它借用的那一轮属于别人一次 2 文件的
 * 提交,两次的声明集**互不相交**,可窗口里那句 `PROJECT_PLAN.md` 就让旧锁放行了。
 * 现改成对**本轮 staged 清单回显**做**包含**判定:本次声明的每个文件都必须出现在该回显里
 * (回显由钩子入口 `auditStagingFiles()` 打,是唯一能把一段日志绑定到具体某枚提交的信号)。
 * 不相交 ⇒ 拒;只相交一部分(极端情形 = 256KB 尾部把回显截断了)⇒ 也拒 ⇒ 结论落到
 * `unattributed`。**失效方向刻意是"多要一次定向说明",绝不是"多放一次跳门"**(§12d 同一条禁令)。
 *
 * @param {string} logText 日志全文(调用方负责截尾,别把整份 33KB×N 喂进来)
 * @param {string[]} mustMention 本次声明并暂存的文件清单(仓库根相对路径)
 * @returns {{text:string|null, why:string}}
 */
export function pickLastSummaryRun(logText, mustMention) {
  const clean = stripAnsi(logText)
  const heads = [...clean.matchAll(SUMMARY_HEAD_RE)]
  if (heads.length === 0) return { text: null, why: '日志里没有任何汇总块' }
  const start = heads[heads.length - 1].index
  const seg = clean.slice(start)
  if (!/道\s*blocking\s*门失败|失败:\s*\d+/.test(seg))
    return { text: null, why: '最后一轮汇总块不完整' }
  const mine = [...new Set((mustMention ?? []).map((f) => String(f).trim()).filter(Boolean))].sort()
  if (mine.length === 0) return { text: null, why: '本次声明清单为空 ⇒ 无从绑定轮次,不用于归因' }
  const echo = parseStagedEcho(clean, start)
  if (echo === null)
    return { text: null, why: '该汇总块之前没有 staged 清单回显 ⇒ 无法证明属于本轮,不用于归因' }
  const absent = mine.filter((f) => !echo.includes(f))
  if (absent.length) {
    return {
      text: null,
      why:
        `该汇总块之前的 staged 清单(${echo.length} 项)未完整包含本次声明集(${mine.length} 项),` +
        `缺 ${absent.length} 项(${absent.slice(0, 3).join(' , ')})⇒ 不能证明是本轮,不用于归因` +
        `(旧锁只看"窗口里出现过任一文件名",而窗口里必然有 PROJECT_PLAN.md/AGENTS.md,正是被这种重名放过的)`,
    }
  }
  return { text: seg, why: 'ok' }
}

/**
 * 归因主判据。
 * @param text        首次 commit 的 stdout+stderr(可含 ANSI)
 * @param fallbackText 可选:同一轮的钩子日志尾部(stdout 未带汇总时的第二输入源)
 * @param stagedFiles 本次声明并暂存的文件清单(仓库根相对路径)
 * @param runGate     (script) => {status:number, output:string} —— 注入式复跑,便于自测
 * @param runGateBaseline 可选:(script) => {ran:boolean, status:number|null, output:string, why:string|null}
 *        —— **基线面(HEAD)**的同一道门读数。缺这一个出口时,"仍红未点名"这一支只能落
 *        `undetermined-red`(态④),因为没有任何证据能区分"本枚引入"与"HEAD 早就红"。
 * @returns kind ∈ 'mine'(点名本次文件 **或** 差分证明本枚引入 ⇒ 拒跳)
 *          | 'not-ours'(有证据表明红不在本次内容 ⇒ 可跳:复跑过关,或 HEAD 面亦红)
 *          | 'undetermined-red'(仍红且基线面跑不出去 ⇒ 可跳,但不得声称与本次无关,2026-09-27 新增)
 *          | 'unattributed'(批未跑完 / 解析不到 / 复跑不可用 ⇒ 保守可跳,但如实说未归因)
 */
export function classifyHookFailure({ text, fallbackText, stagedFiles, runGate, runGateBaseline }) {
  let parsed = parseGateSummary(text)
  let source = '钩子标准输出'
  if (parsed.failed.length === 0 && fallbackText) {
    const picked = pickLastSummaryRun(fallbackText, stagedFiles)
    if (picked.text) {
      const p2 = parseGateSummary(picked.text)
      if (p2.failed.length > 0) {
        parsed = p2
        source = '同一轮钩子日志尾部(stdout 未带汇总;该轮 staged 清单已含本次声明集)'
      }
    }
  }
  const detail = [parsed.failed.length > 0 ? `失败门清单取材:${source}` : '']
  if (parsed.batchReported && parsed.failed.length === 0) {
    const step = outsideBatchStep(text) ?? outsideBatchStep(fallbackText)
    if (step) {
      const tail = tailAfterSummary(text) ?? tailAfterSummary(fallbackText) ?? ''
      const tailLines = tail.split(/\r?\n/)
      const named = stagedFiles.filter((f) => tailLines.some((l) => lineNamesFile(l, f)))
      const batchLine = `批内结论:总检查数已跑完、blocking 失败 0(该结论此前被整块丢弃)`
      if (named.length > 0)
        return {
          kind: 'mine',
          ranFullBatch: !parsed.earlyAbort,
          failed: parsed.failed,
          outsideStep: step,
          detail: [batchLine, `批外步骤「${step}」的结论行点名本次文件:${named.join(' , ')}`],
          reason: `守门批虽 0 失败,但批外步骤「${step}」点名了本次声明的文件 —— 这是本任务自己的红,必须修,禁止 --no-verify`,
        }
      return {
        kind: 'not-ours',
        ranFullBatch: !parsed.earlyAbort,
        failed: parsed.failed,
        outsideStep: step,
        detail: [
          batchLine,
          `红在守门批**之外**的那一步「${step}」,其输出未点名本次任何文件`,
          `该步仍会挡住后续提交,须由能改的人清理;本枚提交按应急路径落地,但不得读成"那个问题不存在"`,
        ],
        reason: `守门批已跑完且 blocking 失败 0,红在批外步骤「${step}」(其结论未点名本次文件)`,
      }
    }
  }
  if (!parsed.batchReported || parsed.failed.length === 0) {
    // 最后一道:没有汇总块时,仍然试一次"把提交挡住的那一步自己有没有点名我"。
    const blame = blameFromFailedStep(text, stagedFiles) ?? blameFromFailedStep(fallbackText, stagedFiles)
    if (blame) {
      return {
        kind: 'mine',
        ranFullBatch: false,
        failed: parsed.failed,
        detail: [
          '本轮**没有**守门汇总块(该步跑在批量检查之前),归因来自那一步自己的输出',
          `阻塞步骤「${blame.step}」的报错正文点名本次声明的文件:${blame.named.join(' , ')}`,
        ],
        reason: `钩子未跑守门批,但阻塞步骤「${blame.step}」的报错点名了本任务声明的文件 —— 这是本任务自己的红,必须修,禁止 --no-verify`,
      }
    }
    return {
      kind: 'unattributed',
      ranFullBatch: false,
      failed: parsed.failed,
      detail: ['未能从钩子输出解析出守门汇总块 —— 归因未计算,不得声称"因他人代码"'],
      reason: parsed.batchReported
        ? '汇总里没列出 blocking 失败门(可能红在守门批量检查之外)'
        : '钩子未产出守门汇总(可能提前退出)',
    }
  }
  if (parsed.earlyAbort) {
    detail.push(
      `本轮提前中止(已执行 ${parsed.executed}/${parsed.total}),其后各门未跑 ⇒ 不得称"全批已跑"`,
    )
  }

  let mine = 0
  let nowPassing = 0
  let unrunnable = 0
  // 差分三档(2026-09-27):"仍红且未点名"不再一句话裁定,按基线面(HEAD)读数分档。
  let introduced = 0
  let stock = 0
  let deltaUnknown = 0
  let myFaceUndetermined = 0
  let noBaselineOutlet = false
  for (const g of parsed.failed) {
    let r = null
    try {
      r = runGate(g.script)
    } catch (e) {
      r = null
      unrunnable++
      detail.push(`[${g.id}] 复跑异常:${e?.message ?? e}`)
    }
    if (!r) continue
    if (r.status === 0) {
      nowPassing++
      detail.push(`[${g.id}] ${g.label} —— 复跑已通过(exit 0),该红不在本次内容里`)
      continue
    }
    const lines = findingLines(r.output)
    const named = stagedFiles.filter((f) => lines.some((l) => lineNamesFile(l, f)))
    if (named.length > 0) {
      mine++
      detail.push(
        `[${g.id}] ${g.label} —— 复跑仍红,且**结论行**点名本次文件:${named.join(' , ')}` +
          `(取证行:${lines
            .filter((l) => named.some((f) => lineNamesFile(l, f)))
            .slice(0, 2)
            .join(' ⏎ ')})`,
      )
      continue
    }
    // ── 态①b(2026-09-27,G-268):门在**我自己这一侧**就判了"无法判定" ──
    // exit 2 在本仓是约定("取不到判无法判定,不冒红也不记绿",守门 94/103/118 同一条),
    // 它压根没对"这枚提交"下结论 ⇒ 既不能据差分判我引入红,也不能据它说我与红无关。
    // 为什么不放在点名判据之前:一道既喊"判不出"又**点名了本次文件**的门,按"多要一次定向
    // 说明"处理(走上面的 mine),绝不因为退出码是 2 就放它过去 —— 归因失效的方向从来不该是"多放一次跳门"。
    if (r.status === 2) {
      myFaceUndetermined++
      deltaUnknown++
      detail.push(
        `[${g.id}] ${g.label} —— 复跑 exit 2:该门自己判"无法判定",未对本枚提交下任何结论` +
          `(取证行:${lines.slice(0, 2).join(' ⏎ ')})`,
      )
      continue
    }
    // ── 态①之后的一切"仍红但未点名"都走差分 ——
    const echo = stagedFiles.filter((f) => normGatePath(r.output).includes(normGatePath(f)))
    detail.push(
      `[${g.id}] ${g.label} —— 复跑仍红,但未点名本次任何文件` +
        (echo.length ? `(输出里出现过 ${echo.join(' , ')},但只出现在清单/回显行,不算点名)` : ''),
    )
    if (!runGateBaseline) {
      noBaselineOutlet = true
      deltaUnknown++
      detail.push(
        `[${g.id}] 未能差分:调用方未注入基线面出口(runGateBaseline)⇒ 归属未知,` +
          `不得据此断言这枚提交与那道红无关`,
      )
      continue
    }
    let b = null
    try {
      b = runGateBaseline(g.script)
    } catch (e) {
      b = { ran: false, status: null, output: '', why: `基线面复跑抛异常:${e?.message ?? e}` }
    }
    const use = baselineUsable(b)
    if (!use.ok) {
      deltaUnknown++
      detail.push(
        `[${g.id}] 未能差分:${use.why}(我的面 exit ${r.status})—— 基线面这一次没跑出可用读数,` +
          `按"未判定"处理,不得读成"HEAD 面亦红"`,
      )
      continue
    }
    if (b.status === 0) {
      introduced++
      detail.push(
        `[${g.id}] ${g.label} —— 差分:基线面(HEAD)不红(exit 0)/ 我的面 exit ${r.status}` +
          ` ⇒ 这枚提交把它原本跑绿的东西改红了`,
      )
      continue
    }
    stock++
    detail.push(
      `[${g.id}] ${g.label} —— 差分:基线面(HEAD)同样红(exit ${b.status})/ 我的面 exit ${r.status}` +
        ` ⇒ HEAD 面亦红(存量或机器态),两面读数已列`,
    )
  }

  if (mine > 0) {
    return {
      kind: 'mine',
      ranFullBatch: !parsed.earlyAbort,
      failed: parsed.failed,
      detail,
      reason: `${mine} 道失败门在复跑时点名了本次声明的文件 —— 这是本任务自己的红,必须修,禁止 --no-verify`,
    }
  }
  if (introduced > 0) {
    return {
      kind: 'mine',
      ranFullBatch: !parsed.earlyAbort,
      failed: parsed.failed,
      detail,
      reason:
        `${introduced} 道失败门在基线面(HEAD)不红、而在我这个面上红 —— 差分证明这枚提交引入了红,` +
        `即使门没有点名文件也必须修,禁止 --no-verify`,
    }
  }
  if (unrunnable === parsed.failed.length) {
    return {
      kind: 'unattributed',
      ranFullBatch: !parsed.earlyAbort,
      failed: parsed.failed,
      detail,
      reason: '失败门全部无法复跑,归因未计算',
    }
  }
  if (deltaUnknown > 0) {
    // 态④:未能差分。仍可落地(应急路径不能删),但措辞不得给出"与本次无关"这种它没证明过的结论。
    return {
      kind: 'undetermined-red',
      ranFullBatch: !parsed.earlyAbort,
      failed: parsed.failed,
      detail,
      delta: { introduced, stock, deltaUnknown, noBaselineOutlet, myFaceUndetermined },
      reason:
        `${deltaUnknown} 道失败门仍红但未点名本次文件,而` +
        (myFaceUndetermined > 0
          ? `其中 ${myFaceUndetermined} 道**在本枚提交的面上就判"无法判定"(exit 2)**、基线面(HEAD)`
          : '基线面(HEAD)') +
        (noBaselineOutlet
          ? '无从差分(调用方未注入 runGateBaseline)'
          : '在隔离面跑不通(缺依赖 / 门按磁盘判 / exit 2)') +
        ` ⇒ 未能差分,归属未知${stock > 0 ? `;另有 ${stock} 道已证 HEAD 面亦红` : ''}`,
    }
  }
  return {
    kind: 'not-ours',
    ranFullBatch: !parsed.earlyAbort,
    failed: parsed.failed,
    detail,
    delta: { introduced, stock, deltaUnknown, noBaselineOutlet },
    reason:
      nowPassing === parsed.failed.length
        ? `${parsed.failed.length} 道失败门复跑后全部通过 ⇒ 红不在本次提交内容里`
        : `${stock} 道失败门复跑仍红且均未点名本次文件,基线面(HEAD)同样红 ⇒ HEAD 面亦红 ⇒ 存量/机器态,非本次引入(两面读数见明细)`,
  }
}

/** 给提交者看的一句话:只说量到的事,不做没做过的归因 */
export function verdictLine(v) {
  if (v.kind === 'mine') return `❌ ${v.reason}`
  // 态④:未能差分。它可以落地,但它**没有**证明"这道红不是我带的",所以措辞必须把
  // 这个差别喊出来 —— 禁止出现"不在本次提交内容里"(由镜像测试的反向锁钉死,不靠自觉)。
  if (v.kind === 'undetermined-red')
    return `⚠️ ${v.reason} —— 按应急路径落地,已留痕;归属未经差分证明,请勿把它读成"通过了守门"或"因他人代码"${
      v.batchSelfRun ? '(safe-commit 自跑取证也未取得门级结论)' : ''
    }`
  if (v.kind === 'not-ours' && v.outsideStep)
    return `✅ ${v.reason} —— 批内 0 失败这一条是**量出来的**,不是"没跑";批外那一步请随后清偿,别把它当成可以长期忽略的背景噪音`
  // 自跑那一轮的 not-ours:证据是真的,但**来源**必须点名 —— 钩子里那一轮从未跑到批量检查。
  // 不写清来源,下一行日志读起来就和"守门在提交链上跑过、没点名本次文件"完全同形。
  if (v.kind === 'not-ours' && v.batchSelfRun)
    return `✅ ${v.reason} —— 取证来自 **safe-commit 自跑**的那一轮守门批(钩子内那一轮从未跑到批量检查);据此走应急跳门。不得把这行读成"守门没跑",也不得读成"钩子里跑过了"`
  if (v.kind === 'not-ours') return `✅ ${v.reason}(据此走应急跳门,守门结论以下方逐道复跑记录为准)`
  return `⚠️ ${v.reason} —— 按应急路径落地,已留痕;请勿把它读成"通过了守门"或"因他人代码"${
    v.batchSelfRun ? '(safe-commit 自跑取证也未取得门级结论)' : ''
  }`
}

// ─────────────────────────────────────────────────────────────────────────────
//  「批没跑完」从**中性事实**改成**必须先补证据的分支**(2026-09-26 立)
//
//  现场(2026-09-26 05:3x 实测,提交 scripts/check-gate-face-discipline.mjs 时):
//    ❌ 🎨 运行 lint-staged...失败，提交已阻止
//    🔒   · 未能从钩子输出解析出守门汇总块 —— 归因未计算,不得声称"因他人代码"
//    ⚠️  已用 --no-verify 落地(归因=unattributed)
//  成因是**结构性**的:`scripts/lib/pre-commit-hook.js` 里 lint-staged 跑在
//  `node scripts/guardian-runner.mjs --staged` **之前**(实测 :97 与 :266),任一 lint/prettier
//  失败即 `process.exit(1)` ⇒ **整批守门一道都不跑**。归因层于是永远拿不到汇总块,只能记
//  `unattributed`,然后照旧 `--no-verify` 落地。
//  后果:一次 lint 错误 = 全部守门被静默跳过,而账面读起来像"跑过了、只是与本次无关"。
//  这正是本仓最恨的那一型 —— **判据失效的表现永远是"安静"**(守门 70/76/81 同型)。
//
//  本节的解法不是"调整钩子顺序"(那是另一张票,且动的是所有会话的提交路径),而是**补证据**:
//  归因层取不到门级结论时,由 safe-commit 自己把 `guardian-runner.mjs --staged` 跑一遍,
//  再按**完全相同的铰链**(classifyHookFailure)分流。三条出口:
//    点名本次文件 ⇒ mine ⇒ 拒绝跳门;
//    一个都没点名(含"批跑完且 blocking 失败 0"这一结构性证据)⇒ 可跳,但措辞必须交代取证来源;
//    自跑本身也没成功 ⇒ 照旧落地,而 unattributed 的措辞必须带上**具体原因**。
//  ⚠️ 刻意**不**把 unattributed 改成拒绝跳门:那会让"别人把我挡在 lint 外"的应急路径消失,
//  逼人手工 `git commit --no-verify` —— 绕得更彻底,还不留痕。
//
//  三个函数都是纯判定(runBatch / runGate 注入),因此可用构造输入证明,不依赖真仓瞬时状态。
//
//  一条如实登记的局限:自跑发生在**首次 commit 失败之后**,而 lint-staged 失败时会回滚它自己
//  动过的暂存区 ⇒ 新加的文件此刻已退回未跟踪,所以自跑那一轮 `--staged` 看到的暂存集**可能少于**
//  声明集。这与既有"逐道复跑失败门"处于同一刻、同一索引态(两份证据因此可互相比较),但它是
//  自跑结论覆盖面的一条真实上限 —— 不得把它读成"等价于钩子里那一轮全批"。
// ─────────────────────────────────────────────────────────────────────────────

/** `run()` 的失败打印形态:`❌ <label>失败，提交已阻止`(.husky 薄壳同样转印这一行)。 */
const PRE_BATCH_BLOCKER_RE = /❌\s*(.+?)\s*失败[，,]\s*提交已阻止/g

/**
 * 取"跑在守门批**之前**的那一步"的点名(最后一个命中)。
 *
 * 为什么只看汇总块**之前**:同一段钩子尾部也可能带着 `❌ 🛡️ 运行守门脚本批量检查...失败，提交已阻止`,
 * 那是"批跑了且有红"的形态,归因层本该拿得到汇总;把它误当成"批前拦截"会写出一句反过来的措辞。
 * 批量检查那一行本身也排除掉(它不是"批之前"的步骤)。
 * @returns {string|null} null = 没能点名(措辞里必须如实写"未点名",不得编一个)
 */
export function blockedBeforeBatch(text) {
  const clean = stripAnsi(text)
  if (!clean) return null
  const at = clean.lastIndexOf('守门脚本批量检查汇总')
  const seg = at < 0 ? clean : clean.slice(0, at)
  let last = null
  for (const m of seg.matchAll(PRE_BATCH_BLOCKER_RE)) {
    const label = m[1].trim()
    if (!label) continue
    if (/^🛡️?\s*运行守门脚本批量检查/.test(label)) continue
    last = label
  }
  return last
}

/**
 * 该不该自跑一遍守门批 —— 判"归因层手里有没有可用的门级结论",不判"红是谁的"。
 *
 * 反向锁的落点就在这一行:`kind ∈ {mine, not-ours} ∧ ranFullBatch === true`
 * (即"批跑完了且解析到汇总")**必须**返回 false,否则新分支会截走 C0–C3 钉住的那条旧链。
 * `mine` 一并返回 false:它的出口已经是"拒绝跳门、exit 1",再跑一遍只多花几分钟、不改结论。
 */
export function needsBatchSelfRun(verdict) {
  if (!verdict || typeof verdict !== 'object') return false
  if (verdict.kind === 'mine') return false
  return verdict.kind === 'unattributed' || verdict.ranFullBatch === false
}

/**
 * 把自跑那一轮接回**同一把铰链**。
 *
 * @param verdict    classifyHookFailure 在钩子那一轮上的结论
 * @param stagedFiles 本次声明并暂存的文件清单(与首轮同一个数组)
 * @param runBatch   () => {ran:boolean, status:number|null, output:string, why:string|null}
 *                   —— 非纯的那一半由调用方提供(spawn guardian-runner);本函数**只在
 *                   needsBatchSelfRun 为真时才调用它**,这是"汇总块存在时绝不自跑"的可证形式
 * @param runGate    与首轮同一个逐道复跑出口(铰链必须是同一份实现)
 * @param runGateBaseline 与首轮同一个**基线面**出口 —— 缺了它,自跑那一轮的"仍红未点名"
 *        同样只能落 undetermined-red(差分没有第二条路可走)
 * @param hookText   首次 commit 的 stdout+stderr,用于点名"红在批之前的哪一步"
 */
export function decideWithSelfRunBatch({
  verdict,
  stagedFiles,
  runBatch,
  runGate,
  hookText,
  runGateBaseline,
}) {
  const blocker = blockedBeforeBatch(hookText)
  const sourceNote = blocker
    ? `红在守门批**之前**的那一步「${blocker}」⇒ 批量检查在钩子里一道都没跑`
    : '钩子那一轮从未跑到守门批量检查(未能从输出点名具体步骤)'
  if (!needsBatchSelfRun(verdict)) return { ...verdict, batchSelfRun: false }

  let selfRun = null
  let failure = null
  try {
    selfRun = runBatch ? runBatch() : null
  } catch (e) {
    failure = `自跑抛异常:${e?.message ?? e}`
  }
  if (!selfRun || !selfRun.ran) {
    // 原因取值顺序刻意是「自跑自己报的 → 抛的异常 → 没给出口」:
    // 自跑闭包最清楚它为什么没跑成(ENOENT / 超时 / 被中断),拿外层猜测覆盖它会写出一条错解释。
    const reason =
      selfRun?.why ?? failure ?? (runBatch ? '自跑未产出结论(既无 ran 也无 why)' : '未提供自跑出口')
    return {
      ...verdict,
      kind: 'unattributed',
      batchSelfRun: true,
      selfRunOk: false,
      blockerBeforeBatch: blocker,
      detail: [...(verdict.detail ?? []), sourceNote, `自跑取证也未成功:${reason}`],
      reason: `${verdict.reason};${sourceNote},而 safe-commit 自跑 guardian-runner 同样未成功(${reason})`,
    }
  }

  const provenance = `门级结论取自 safe-commit 自跑的那一轮 guardian-runner --staged(exit ${selfRun.status}),不是钩子内那一轮`
  // 同一把铰链:把自跑的输出当成"另一轮的钩子输出"喂回 classifyHookFailure
  const hinge = classifyHookFailure({ text: selfRun.output, stagedFiles, runGate, runGateBaseline })
  const summary = parseGateSummary(selfRun.output)

  if (hinge.kind === 'mine') {
    return {
      ...hinge,
      batchSelfRun: true,
      selfRunOk: true,
      blockerBeforeBatch: blocker,
      detail: [sourceNote, provenance, ...hinge.detail],
      reason: `${hinge.reason}(取证来自自跑的那一轮守门批,非钩子内那一轮)`,
    }
  }
  if (hinge.kind === 'undetermined-red') {
    // 自跑拿到了门级结论(确有门红),只是那道门的基线面跑不出去 ⇒ 这一支既不是"没结论"
    // (那才该落 unattributed),也不是"证明与本次无关"。原样保留 kind,补取证来源。
    return {
      ...hinge,
      batchSelfRun: true,
      selfRunOk: true,
      blockerBeforeBatch: blocker,
      detail: [sourceNote, provenance, ...hinge.detail],
      reason: `${hinge.reason}(取证来自自跑的那一轮守门批,非钩子内那一轮)`,
    }
  }
  if (hinge.kind === 'not-ours') {
    return {
      ...hinge,
      batchSelfRun: true,
      selfRunOk: true,
      blockerBeforeBatch: blocker,
      detail: [sourceNote, provenance, ...hinge.detail],
    }
  }
  /**
   * 批跑完、blocking 失败 0、退出码 0 ⇒ **结构上没有任何一门点名本次文件**(红门数为 0)。
   * 这正是"一个都没点名"那一支,只是它由"全绿"而不是由"逐道复跑未点名"证明。
   * 首轮的 classifyHookFailure 对这种输入会给 unattributed(它只认"解析到失败门清单"),
   * 所以这一格必须在这里显式升级 —— 而升级的依据是 `failed.length === 0` 这个量出来的数,
   * 不是"我看它像绿的"。
   */
  if (
    summary.batchReported &&
    !summary.earlyAbort &&
    summary.failed.length === 0 &&
    selfRun.status === 0
  ) {
    return {
      kind: 'not-ours',
      ranFullBatch: true,
      failed: [],
      batchSelfRun: true,
      selfRunOk: true,
      blockerBeforeBatch: blocker,
      detail: [
        sourceNote,
        provenance,
        `自跑批已跑完全部 ${summary.total ?? '?'} 道门、blocking 失败 0 ⇒ 没有一门点名本次文件(红不在守门批内,在批外那一步)`,
      ],
      reason: `safe-commit 自跑守门批:总检查数 ${summary.total ?? '?'}、blocking 失败 0 ⇒ 红不在守门批(${sourceNote})`,
    }
  }
  // 自跑了但仍拿不到门级结论(超时后仍有部分输出 / 格式漂了解析不出 / 复跑不可用)
  return {
    ...verdict,
    kind: 'unattributed',
    batchSelfRun: true,
    selfRunOk: false,
    blockerBeforeBatch: blocker,
    detail: [...(verdict.detail ?? []), sourceNote, provenance, `自跑那一轮的结论:${hinge.reason}`],
    reason: `${verdict.reason};safe-commit 自跑守门批后仍无法归因 —— 自跑也未成功(${hinge.reason})`,
  }
}

// ------------------------------------------------------------------ 自检

const SUMMARY = `
🛡️ 守门脚本批量检查汇总
  总检查数: 134(已执行 134)
  通过: 111
  警告: 2
  失败: 1
  跳过: 20
`
const FAIL_29 = `
🚫 1 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:
   · [29] 🚀 Push 同步兜底(防"commit 后忘记 push"复发)
     单独复现:node scripts/check-push-sync.mjs --staged
`
const MY_FILES = ['scripts/foo.mjs', 'PROJECT_PLAN.md']

/**
 * 基线面(HEAD)"同样红"的桩 —— 2026-09-27 起"仍红且未点名"必须有这条证据才配判 not-ours。
 * 住在模块级而不是某个用例里:多个用例共用(声明在前的用例也要能拿到,否则 const 有 TDZ)。
 */
const stockBaseline = () => ({ ran: true, status: 1, output: 'HEAD 面同样红(存量)', why: null })

/**
 * 真仓格式取样:锚点必须与 guardian-runner 的实际打印同源。
 * 这条不是"测试跑自己的夹具" —— 它从 runner 源码里把格式串抠出来,格式漂了即红,
 * 从而在 safe-commit 静默退化成"永不归因"**之前**就暴露。
 */
function formatPinnedFromRunner(assert, runnerSource) {
  assert(
    /总检查数:\s*\$\{effectiveChecks\.length\}\(已执行\s*\$\{executed\}/.test(runnerSource),
    'runner 的「总检查数」打印格式已漂移 ⇒ parseGateSummary 的锚点失效',
  )
  assert(
    /道 blocking 门失败/.test(runnerSource),
    'runner 的「N 道 blocking 门失败」打印已漂移 ⇒ 失败清单解析失效',
  )
  assert(
    /·\s*\[\$\{g\.id\}\]\s*\$\{g\.label\}/.test(runnerSource),
    'runner 的「· [id] label」失败行格式已漂移 ⇒ 逐门归因失效',
  )
  assert(
    /单独复现:node scripts\/\$\{g\.script\}/.test(runnerSource),
    'runner 的「单独复现:」行格式已漂移 ⇒ 拿不到 script ⇒ 归因整段停摆',
  )
}

export function selfTest(assert, runnerSource) {
  formatPinnedFromRunner(assert, runnerSource)

  // --- P0 阳性对照:上面那两条夹具必须真能被解析(否则后面全是空断言) ---
  const p = parseGateSummary(SUMMARY + FAIL_29)
  assert(p.batchReported === true, 'P0 夹具未被识别为"跑过守门批"')
  assert(p.failed.length === 1, `P0 应解析出 1 道失败门,实得 ${p.failed.length}`)
  assert(p.failed[0]?.id === '29', `P0 门编号应为 29,实得 ${p.failed[0]?.id}`)
  assert(
    p.failed[0]?.script === 'check-push-sync.mjs',
    `P0 script 应为 check-push-sync.mjs,实得 ${p.failed[0]?.script}`,
  )
  assert(p.earlyAbort === false, 'P0 不该把"未提前中止"读成提前中止')

  // --- P0b 去重:同一道门列两次只算一次(否则逐道复跑会重复跑,明细全是重复行) ---
  const dup = parseGateSummary(SUMMARY + FAIL_29 + FAIL_29)
  assert(dup.failed.length === 1, `P0b 重复失败行应去重为 1 道,实得 ${dup.failed.length}`)
  assert(
    parseGateSummary(SUMMARY + FAIL_29 + FAIL_29.replace('[29]', '[77]')).failed.length === 2,
    'P0b 去重不得把**不同**门吃掉',
  )

  // --- P-R 轮次绑定:汇总块必须靠"本轮 staged 清单回显 == 本次声明集"才算属于本轮 ---
  // 立因是实测:提交 48ac2c03e 红在 eslint no-unused-vars(我自己的红),而 lint-staged 失败
  // 使守门批**根本没跑** ⇒ stdout 无汇总 ⇒ 旧实现去日志尾部借了上一轮的汇总块,旧锁只要求
  // "窗口里出现过任一本次文件名"—— 那段窗口 48KB–202KB 里必然提到 PROJECT_PLAN.md/AGENTS.md
  // (守门 71/13c 的结论行就点名它们),于是我的红被洗成 not-ours,合法跳掉整批 152 道门。
  const roundLog = (files, tail) =>
    `  ℹ️  staged 文件清单(${files.length} 个):\n` +
    files.map((f) => `     - ${f}`).join('\n') +
    `\n\n${tail}`
  const four = ['AGENTS.md', 'PROJECT_PLAN.md', 'scripts/a.mjs', 'scripts/b.mjs']
  // 回显比声明集多几项也算本轮(钩子按磁盘实际暂存打,可能含同一枚提交的其它路径)
  const r1 = pickLastSummaryRun(
    roundLog(four, SUMMARY + FAIL_29),
    four.map((f) => f),
  )
  assert(r1.text !== null, `P-R1 声明集与回显全等时必须取到本轮汇总(实得 why=${r1.why})`)
  // P-R2 = 48ac2c03e 的实测形态:本轮没跑批(无回显、无汇总),日志里只剩别人那一轮的汇总块,
  // 而该轮的清单是**本次的真子集**(活文档重名)。旧锁放过 ⇒ 新锁必须拒。
  const otherRound = roundLog(['PROJECT_PLAN.md'], SUMMARY + FAIL_29)
  const r2 = pickLastSummaryRun(otherRound, four)
  assert(
    r2.text === null && /未完整包含/.test(r2.why),
    `P-R2 声明集的真子集重名(旧 .some() 会放过)必须判"不是本轮",实得 ${JSON.stringify(r2.why)}`,
  )
  assert(
    pickLastSummaryRun(SUMMARY + FAIL_29, four).text === null,
    'P-R3 没有 staged 清单回显时不得用于归因(宁可未归因,绝不借用)',
  )
  assert(
    pickLastSummaryRun(roundLog([], SUMMARY + FAIL_29), []).text === null,
    'P-R4 声明集为空 ⇒ 无从绑定轮次,不用于归因',
  )
  // P-R5 反向锁:旧的"任一命中"写法不得回来 —— 它在活文档上必然恒真,等于没有这道锁
  assert(
    !/some\(\(f\) => window\.includes\(f\)\)/.test(String(pickLastSummaryRun)) &&
      !/const window = clean\.slice/.test(String(pickLastSummaryRun)),
    'P-R5 不得回退到"窗口里出现过任一本次文件名"的弱锁(实测会被 PROJECT_PLAN.md/AGENTS.md 放过)',
  )

  // --- A1 实测那一轮:红的是远端态门,复跑过关 ⇒ not-ours ---
  const a1 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({
      status: 0,
      output: '⏭ 本地与 origin/main HEAD 不同但无 ahead commit(可能 behind,跳过)',
    }),
  })
  assert(a1.kind === 'not-ours', `A1 应判 not-ours,实得 ${a1.kind}`)

  // --- A2 我的内容真红 ⇒ 必须判 mine(旧版在这一型上说"他人代码") ---
  const a2 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '  ✗ scripts/foo.mjs:12 违规' }),
  })
  assert(a2.kind === 'mine', `A2 失败门点名本次文件时必须判 mine,实得 ${a2.kind}`)
  assert(/禁止 --no-verify/.test(a2.reason), 'A2 mine 的措辞必须落到"禁止跳门"')

  // --- A2b 结论与定位拆两行(守门 84 的真实形态)⇒ 仍须判 mine ---
  // 旧实现逐行匹配,只看第一行有没有 FINDING 字样:那正是本函数上线后第一次实战里
  // 判错的方向(门点名了本次文件,却被说成"未点名"),所以这条不是补充用例,是补漏洞。
  const a2b = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({
      status: 1,
      output:
        '❌ 检出 1 个文件的暂存内容等于其**历史提交版本**:\n   - scripts/foo.mjs  ==  307afd6c3\n',
    }),
  })
  assert(
    a2b.kind === 'mine',
    `A2b 两行形态的点名必须判 mine(旧版在这里判成 not-ours ⇒ 放行跳门),实得 ${a2b.kind}`,
  )

  // --- A3b 反向对照:续行点名的是**别人的**文件 ⇒ 不得因"带了续行"就判 mine ---
  const a3b = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({
      status: 1,
      output:
        '❌ 检出 1 个文件的暂存内容等于其**历史提交版本**:\n   - apps/web/src/other.tsx  ==  307afd6c3\n',
    }),
    runGateBaseline: stockBaseline,
  })
  assert(a3b.kind === 'not-ours', `A3b 续行未涉及本次文件时应仍为 not-ours,实得 ${a3b.kind}`)

  // --- A3 别人的内容红(未点名我的文件)⇒ not-ours,但 detail 要如实说"仍红" ---
  // ⚠️ 2026-09-27 起这一型必须有**基线面同红**的证据才配叫 not-ours:
  // 旧写法只要"未点名"就下这个结论,而那正是把"我没看见路径"写成"它不是我的"。
  // 所以夹具现在显式喂一条 `ran:true, status:1` 的基线读数(= HEAD 面上这道门本来就红)。
  const a3 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '  ✗ apps/web/src/other.tsx:3 类型错误' }),
    runGateBaseline: stockBaseline,
  })
  assert(a3.kind === 'not-ours', `A3 应判 not-ours,实得 ${a3.kind}`)
  assert(/未点名本次任何文件/.test(a3.detail.join('\n')), 'A3 必须如实记录"该门复跑仍红"')

  // --- A4 输出带 ANSI 色码也要能点名(否则 mine 会被色码打断而漏判) ---
  const a4 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '\x1b[31m  ✗ scripts/foo.mjs:1 \x1b[0m' }),
  })
  assert(a4.kind === 'mine', `A4 ANSI 色码不得让归因失明,实得 ${a4.kind}`)

  // --- A5 解析不到汇总 ⇒ unattributed,且不得谎称 not-ours ---
  const a5 = classifyHookFailure({
    text: 'fatal: 钩子提前退出',
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(a5.kind === 'unattributed', `A5 无汇总块必须判未归因,实得 ${a5.kind}`)

  // --- A6 汇总说"失败 0"而没有任何失败行 ⇒ 未归因(不能当成"已证明不是我的") ---
  const a6 = classifyHookFailure({
    text: SUMMARY,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(a6.kind === 'unattributed', `A6 解析不到失败门清单时必须未归因,实得 ${a6.kind}`)
  // 归因失效的**原因也必须说对**:把"没解析到汇总"写成"复跑不可用",下一个读的人会去查
  // spawn 而不是查格式漂移 —— 本票整张票就是为了不再出现这种"结论碰巧对、解释是错的"记录。
  assert(
    /汇总里没列出|未产出守门汇总/.test(a6.reason),
    `A6b reason 须指向解析失败,实得:${a6.reason}`,
  )
  assert(a6.detail.join('\n').includes('归因未计算'), 'A6b 未归因须留明细,不得只给一个 kind 值')

  // --- A7 复跑全抛异常 ⇒ 未归因,不是 not-ours ---
  const a7 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => {
      throw new Error('spawn 失败')
    },
  })
  assert(a7.kind === 'unattributed', `A7 复跑不可用必须未归因,实得 ${a7.kind}`)

  // --- A8 提前中止(GUARDIAN_STOP_ON_FIRST)⇒ 如实标注,不称"全批已跑" ---
  const a8 = classifyHookFailure({
    text: SUMMARY.replace('(已执行 134)', '(已执行 3 ← 提前中止)') + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(a8.ranFullBatch === false, 'A8 提前中止轮次不得记为"全批已跑"')
  assert(/提前中止/.test(a8.detail.join('\n')), 'A8 必须把提前中止写进明细')

  // --- A9 多门混合:一门过关、一门点名我 ⇒ 整体仍须 mine(一条证据就够定责) ---
  const a9 = classifyHookFailure({
    text:
      SUMMARY +
      FAIL_29 +
      FAIL_29.replace('[29]', '[77]').replace('check-push-sync', 'check-radius-single-source'),
    stagedFiles: MY_FILES,
    runGate: (script) =>
      script.startsWith('check-push-sync')
        ? { status: 0, output: '' }
        : { status: 1, output: 'apps/mobile-rn/x.tsx:4 scripts/foo.mjs:9 绕档' },
  })
  assert(a9.kind === 'mine', `A9 任一门点名本次文件即须判 mine,实得 ${a9.kind}`)
  assert(a9.failed.length === 2, `A9 应解析出 2 道失败门,实得 ${a9.failed.length}`)
  // --- A10 措辞层:三种 kind 各说各的话,不得互相冒充 ---
  assert(/❌/.test(verdictLine(a2)), 'A10 mine 的措辞必须是失败口吻')

  // --- A11 真实误伤回归:门回显"触发我的文件清单"不得被当成点名 ---
  // 文本取自 2026-09-25 02:22 门 35 (check-mypy) 的真实输出:它回显了本次 staged 的 Python 文件,
  // 而 mypy 真正报错的是另外两个文件。旧实现用整段 includes ⇒ 判成 mine ⇒ 拒掉了别人一次合法提交。
  const MYPY_REAL = `[mypy 守门] staged 检测到 2 个 Python 文件改动,触发 mypy 检查:
  - apps/ai-service/app/core/llm_gateway.py
  - apps/ai-service/tests/test_model_router_wiring.py

❌ mypy 守门失败(1.7s)
--- mypy 输出 ---
app\\services\\tool_input_scanner.py:32: error: Module "app.services.sandbox" has no attribute "_DANGEROUS_PATTERNS"  [attr-defined]
app\\services\\mcp_server.py:1954: error: Module "app.services.sandbox" has no attribute "sandbox_executor"  [attr-defined]
Found 2 errors in 2 files (checked 548 source files)
--- end ---`
  const a11 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: [
      'apps/ai-service/app/core/llm_gateway.py',
      'apps/ai-service/tests/test_model_router_wiring.py',
    ],
    runGate: () => ({ status: 1, output: MYPY_REAL }),
    runGateBaseline: stockBaseline,
  })
  assert(a11.kind === 'not-ours', `A11 清单回显不得判成 mine,实得 ${a11.kind}`)
  assert(
    /只出现在清单\/回显行/.test(a11.detail.join('\n')),
    'A11 必须把"为什么不算点名"写进明细,不得静默',
  )
  // 反向:若 mypy 真报在本人声明的文件上,必须立刻判 mine(本条防"修过头变成永不归责")
  const a11b = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: ['apps/ai-service/app/core/llm_gateway.py'],
    runGate: () => ({
      status: 1,
      output:
        'apps/ai-service/app/core/llm_gateway.py:88: error: Missing type annotation  [no-any-return]',
    }),
  })
  assert(a11b.kind === 'mine', `A11b 真报在本人文件上时必须仍判 mine,实得 ${a11b.kind}`)

  // --- B1 第二输入源:stdout 没有汇总(实测真仓就是这样),必须从同一轮日志尾部取到 ---
  // 真实日志的顺序是「上一轮汇总 … 本轮 staged 清单 … 本轮汇总」,清单夹在两轮之间。
  const ROUND_PREV = `🛡️ 守门脚本批量检查汇总
  总检查数: 134(已执行 134)
  失败: 1
🚫 1 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:
   · [57] 上一轮别人的门
     单独复现:node scripts/check-chat-element-coverage.mjs --staged
`
  const ROUND_MINE = `🛡️ 守门脚本批量检查汇总
  总检查数: 134(已执行 134)
  失败: 3
🚫 3 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:
   · [30c] 陈旧副本守门
     单独复现:node scripts/check-stale-copy.mjs --staged
   · [71] 计划登记行防丢
     单独复现:node scripts/check-plan-line-loss.mjs --staged
   · [84] 反回退守门
     单独复现:node scripts/check-stale-revert.mjs --staged
`
  const b1 = classifyHookFailure({
    // stdout 停在半路(真仓实测形态):只有进度行,没有汇总
    text: '[30a] 🛡️ Commit 丢失防护…\n(完整日志: .workbuddy/hook-logs/pre-commit.log)',
    fallbackText: `${ROUND_PREV}\nstaged 文件清单:\n - scripts/foo.mjs\n - PROJECT_PLAN.md\n${ROUND_MINE}`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '别的文件 red' }),
    runGateBaseline: stockBaseline,
  })
  assert(b1.kind === 'not-ours', `B1 应经日志尾部完成归因,实得 ${b1.kind}`)
  assert(b1.failed.length === 3, `B1 应取到最后一轮的 3 道门,实得 ${b1.failed.length}`)
  assert(/日志尾部/.test(b1.detail.join('\n')), 'B1 必须写明清单取材自日志尾部,不得伪装成 stdout')

  // --- B2 不得拿"上一轮(别人)"的清单给自己归因 ---
  const b2 = classifyHookFailure({
    text: '没有汇总块',
    // 本轮清单里完全没提本次声明的文件 ⇒ 只能算别人的那一轮
    fallbackText: `${ROUND_MINE}\nstaged 文件清单:\n - apps/other/theirs.ts\n`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: 'x' }),
  })
  assert(b2.kind === 'unattributed', `B2 清单未点名本次文件时必须拒绝使用该轮,实得 ${b2.kind}`)

  // --- B3 同一轮里点名我 ⇒ 仍须 mine(第二输入源不得把责任洗掉) ---
  const b3 = classifyHookFailure({
    text: '',
    fallbackText: `staged 文件清单(2 个):\n - scripts/foo.mjs\n - PROJECT_PLAN.md\n${ROUND_MINE}`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '  ✗ scripts/foo.mjs:3 历史版本回写' }),
  })
  assert(b3.kind === 'mine', `B3 通过日志归因后仍须能定责,实得 ${b3.kind}`)
  // 未归因必须自带"不许当成过门"的警示(整句含该词是合法的,故判前缀与警示词,不判子串)
  const unattr = verdictLine(a5)
  assert(/^\s*⚠️/.test(unattr), `A10 未归因必须以警示口吻开头,实得:${unattr}`)
  assert(/请勿/.test(unattr), 'A10 未归因必须自带"不得当成已通过"的警示')
  assert(/复跑/.test(verdictLine(a1)), 'A10 not-ours 必须把结论指向复跑记录,而不是任何"过门"式断言')

  // --- C 族:红在守门批**之外**的那一步(实测 2026-09-25 提交 46a4c18ed) ---
  // 那一轮 154 道门全部跑完、blocking 失败 0,而 runner 之后跑的 `i18n 死 key 扫描` 判 3 枚孤儿键
  // 直接 exit 1 ⇒ 钩子红。旧实现把这一型归成 unattributed("汇总里没列出 blocking 失败门"),
  // 然后照样 --no-verify 落地 —— 结果是**已经量到的批内结论被整块丢掉**,而账面读起来像"没跑守门"。
  const SUMMARY_CLEAN = `
🛡️ 守门脚本批量检查汇总
  总检查数: 154(已执行 154)
  通过: 153
  警告: 1
  失败: 0
  跳过: 0
`
  const DEADKEY_TAIL = `
🌐 i18n 死 key 扫描(死 key > 0 阻断 commit,2026-07-26 立)
  死 key: 3 (0.0%)
[scan-dead-i18n-keys] --exit 1:发现 3 个死 key
❌ 🌐 i18n 死 key 扫描(死 key > 0 阻断 commit,2026-07-26 立)失败，提交已阻止
❌ i18n 死 key 扫描发现死 key,提交已阻止(请清理 packages/i18n/messages/* 中未引用的 key 后再 commit)
`
  assert(
    outsideBatchStep(SUMMARY_CLEAN + DEADKEY_TAIL) ===
      '🌐 i18n 死 key 扫描(死 key > 0 阻断 commit,2026-07-26 立)',
    `C0 批外步骤名解析失效,实得:${String(outsideBatchStep(SUMMARY_CLEAN + DEADKEY_TAIL))}`,
  )
  assert(outsideBatchStep(DEADKEY_TAIL) === null, 'C0b 没有汇总块时不得凭空指认批外步骤')
  const c1 = classifyHookFailure({
    text: SUMMARY_CLEAN + DEADKEY_TAIL,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(c1.kind === 'not-ours', `C1 批内 0 失败而红在批外 ⇒ 应能归因,实得 ${c1.kind}`)
  assert(c1.outsideStep && /死 key/.test(c1.outsideStep), 'C1 必须点名是哪一步')
  assert(c1.ranFullBatch === true, 'C1 批已跑完,不得记成"全批未跑"')
  assert(/批内结论/.test(c1.detail.join('\n')), 'C1 明细必须把"批内 0 失败"这条量到的结论写下来')
  assert(/批内 0 失败/.test(verdictLine(c1)), 'C1 措辞须与"没跑守门"区分开,不得冒充未归因')
  // 反向:批外那一步点名了本次文件 ⇒ 仍是本任务自己的红,禁止跳门(失效方向必须是"多要一次说明")
  const c2 = classifyHookFailure({
    text: `${SUMMARY_CLEAN}❌ 🌐 i18n 死 key 扫描失败，提交已阻止:scripts/foo.mjs 引用的键已不存在`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(c2.kind === 'mine', `C2 批外步骤点名本次文件时必须仍判 mine,实得 ${c2.kind}`)
  assert(/禁止 --no-verify/.test(c2.reason), 'C2 的出口必须是"修",不是跳门')
  // 反向对照:批内**有**失败时不得走这一支(否则批内那道的责任被批外步骤洗掉)
  const c3 = classifyHookFailure({
    text: `${SUMMARY.replace('失败: 1', '失败: 1')}${FAIL_29}${DEADKEY_TAIL}`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '别的门 red' }),
  })
  assert(
    c3.failed.length === 1 && !c3.outsideStep,
    `C3 批内已有失败门时须按逐道复跑归因,实得 failed=${c3.failed.length} outsideStep=${c3.outsideStep}`,
  )

  // --- C4 无汇总块时的最后一级归因:报错正文点名本次文件 ⇒ mine(文本逐字取自 9bd6748ba 那轮真实钩子输出) ---
  const LINT_STAGED_FAIL = `⋯ eslint --fix ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
D:\\IHUI-AI\\scripts\\check-project-plan-archive.mjs
  36:10  error  'Undetermined' is defined but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)
❌ 🎨 运行 lint-staged...失败，提交已阻止
   (完整日志: .workbuddy/hook-logs/pre-commit.log)
`
  const BLAMED = 'scripts/check-project-plan-archive.mjs'
  assert(
    blameFromFailedStep(LINT_STAGED_FAIL, [BLAMED, 'PROJECT_PLAN.md'])?.named[0] === BLAMED,
    'C4 真实 lint 失败形状必须被认出(Windows 反斜杠路径要先归一再比)',
  )
  const c4 = classifyHookFailure({
    text: LINT_STAGED_FAIL,
    stagedFiles: [BLAMED, 'PROJECT_PLAN.md'],
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(c4.kind === 'mine', `C4 报错点名本次文件时不得落到 unattributed,实得 ${c4.kind}`)
  assert(/lint-staged/.test(c4.reason), `C4 必须点名是哪一步,实得:${c4.reason}`)
  // C5 反向对照:失败步骤的输出里没有本次文件 ⇒ 仍走 unattributed(不得把别人的红算到我头上)
  const c5 = classifyHookFailure({
    text: LINT_STAGED_FAIL.replace('check-project-plan-archive', 'some-other-file'),
    stagedFiles: [BLAMED, 'PROJECT_PLAN.md'],
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(c5.kind === 'unattributed', `C5 未点名本次文件时必须仍是"未归因",实得 ${c5.kind}`)
  // C6 反向对照:纯 staged 清单回显(无错误形状)不得被读成点名 —— 与 A11 同一条禁令的另一半
  const c6 = classifyHookFailure({
    text: `📋 staged 文件清单(2 个):\n - scripts/foo.mjs\n - PROJECT_PLAN.md\n❌ 某步骤失败，提交已阻止`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(c6.kind === 'unattributed', `C6 清单回显不得定责,实得 ${c6.kind}`)
  // ───────────────────────────────────────────────────────────────────────────
  // D 族:差分四态(2026-09-27 立)。立因是留痕 ts=2026-09-27T09:05:40Z 那枚被放行的自引入红
  // —— 门(55 工具名本地化)的失败行**通篇不含文件路径**,旧铰链得到"复跑仍红 ∧ 未点名"
  // 就直接裁 not-ours,措辞还是「红不在本次提交内容里」。下面每一条都在量一个新态,
  // 且都配一条**反向对照**:证明结论是"差分给的",不是夹具碰巧。
  // ───────────────────────────────────────────────────────────────────────────
  // 门 55 的真实打印形态(逐字取自 scripts/check-tool-name-display-coverage.mjs:108-116 的模板):
  // 只有符号名和计数,没有任何仓根相对路径 ⇒ 点名判据结构上看不见。
  const GATE55_REAL = `[tool-name-coverage] ❌ 覆盖率 86/87
  未映射工具名(1):generate_report
  缺 i18n 值(5):taskStatus.toolGenerateReport
  修法:在 packages/shared/src/chat/tool-display.ts 的 TOOL_DISPLAY_KEYS 补 name → toolXxx,并给五语言补文案。`
  const DECL_MCP = ['apps/ai-service/app/services/mcp_server.py', 'PROJECT_PLAN.md']
  const greenBaseline = () => ({ ran: true, status: 0, output: '✅ 覆盖率 87/87', why: null })

  // --- D1 端到端可达性回归:门不点名 + 基线绿 + 我的面红 ⇒ **必须 mine**(这就是修复的证明) ---
  const d1 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: DECL_MCP,
    runGate: () => ({ status: 1, output: GATE55_REAL }),
    runGateBaseline: greenBaseline,
  })
  assert(d1.kind === 'mine', `D1 基线面绿而我的面红时必须判 mine,实得 ${d1.kind}`)
  assert(/禁止 --no-verify/.test(d1.reason), 'D1 的出口必须是"修",不是跳门')
  assert(/差分:基线面\(HEAD\)不红/.test(d1.detail.join('\n')), 'D1 明细要写下两面读数,不得只给一个 kind')
  // D1b 反向对照:同一份输入只把基线换成"同样红" ⇒ 不得再判 mine(证明 D1 是差分给的)
  const d1b = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: DECL_MCP,
    runGate: () => ({ status: 1, output: GATE55_REAL }),
    runGateBaseline: stockBaseline,
  })
  assert(d1b.kind === 'not-ours', `D1b 两面同红时必须落存量档,实得 ${d1b.kind}`)
  assert(d1.kind !== d1b.kind, 'D1/D1b 唯一差别是基线读数 ⇒ 两态必须可分,否则差分是空转')

  // --- D2 两面同红 ⇒ not-ours,措辞只能是"HEAD 面亦红",**不得**出现旧那句谎言 ---
  assert(/HEAD 面亦红/.test(d1b.reason), `D2 存量档措辞必须含"HEAD 面亦红",实得:${d1b.reason}`)
  assert(
    !/不在本次提交内容里/.test(verdictLine(d1b)),
    `D2 存量档不得再写"红不在本次提交内容里"(那是"我没看见路径"的误写),实得:${verdictLine(d1b)}`,
  )
  assert(/基线面\(HEAD\)同样红/.test(d1b.detail.join('\n')), 'D2 明细必须留下基线面那一次的读数')

  // --- D3 基线面跑不出去 ⇒ undetermined-red(仍可落地),措辞禁止冒充"已证明与本次无关" ---
  const undeterminedShapes = [
    ['抽取树缺依赖', () => ({ ran: true, status: 1, output: "Error: Cannot find module 'typescript'", why: null })],
    ['派生失败', () => ({ ran: false, status: null, output: '', why: '派生失败 ENOENT' })],
    ['超时/被中断', () => ({ ran: true, status: null, output: 'partial', why: '被中断或超时(900000ms)' })],
    ['门自判无法判定', () => ({ ran: true, status: 2, output: '无法判定:取不到被审面', why: null })],
    ['未注入出口', null],
  ]
  for (const [name, mk] of undeterminedShapes) {
    const v = classifyHookFailure({
      text: SUMMARY + FAIL_29,
      stagedFiles: DECL_MCP,
      runGate: () => ({ status: 1, output: GATE55_REAL }),
      ...(mk ? { runGateBaseline: mk } : {}),
    })
    assert(
      v.kind === 'undetermined-red',
      `D3[${name}] 基线面无可用读数时必须落 undetermined-red(不得伪装成存量),实得 ${v.kind}`,
    )
    const line = verdictLine(v)
    assert(
      !/不在本次提交内容里/.test(line),
      `D3[${name}] 该支放行措辞里不得出现"不在本次提交内容里"(反向锁),实得:${line}`,
    )
    assert(/未经差分证明/.test(line), `D3[${name}] 必须明写"归属未经差分证明",实得:${line}`)
    assert(/^⚠️/.test(line), `D3[${name}] 未差分必须以警示口吻开头,不得读起来像已过门`)
  }
  // D3b 它仍然**可以落地**(应急路径不能被删):needsBatchSelfRun 不得因它多跑一遍全批
  assert(
    needsBatchSelfRun({ ...d1, kind: 'undetermined-red', ranFullBatch: true }) === false,
    'D3b 已跑到全批的未差分档不应再触发自跑(那是几分钟成本换不到新证据)',
  )

  // --- D4 差分优先于"点的是谁":门点名了**别人的**文件、而基线面绿 ⇒ 仍是我引入的 ⇒ mine ---
  const d4 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: DECL_MCP,
    runGate: () => ({ status: 1, output: '❌ apps/web/src/other.tsx:3 类型错误' }),
    runGateBaseline: greenBaseline,
  })
  assert(d4.kind === 'mine', `D4 基线绿而我的面红 ⇒ 即使门点的是别人文件也应判 mine,实得 ${d4.kind}`)

  // --- D5 反斜杠 / 端内相对形态必须归一后判(与同文件 blameFromFailedStep 共用一份实现) ---
  // 真实形态取自本模块自带的 MYPY_REAL:门在端目录里跑,打的是 `app\services\x.py`。
  assert(
    lineNamesFile('app\\services\\mcp_server.py:1954: error: boom', 'apps/ai-service/app/services/mcp_server.py'),
    'D5a 端内相对 + 反斜杠形态必须被认成点名(旧铰链在这一型上恒盲)',
  )
  assert(
    lineNamesFile('D:/IHUI-AI/scripts/foo.mjs:12 违规', 'scripts/foo.mjs'),
    'D5b 绝对路径形态必须被认成点名',
  )
  assert(
    !lineNamesFile('xscripts/foo.mjs 违规', 'scripts/foo.mjs') &&
      !lineNamesFile('scripts/foo.mjsx 违规', 'scripts/foo.mjs'),
    'D5c 前后粘连的路径不得算点名(否则铰链会把无关输出算成我的责任)',
  )
  assert(
    !lineNamesFile('README 里提到 app/services 目录', 'apps/ai-service/app/services/mcp_server.py'),
    'D5d 裸目录名(不含文件名)不得算点名 —— 至少两段是这条判据的下限',
  )

  // --- D6 baselineUsable 的分支必须成对:能用的读数才算数,"跑过"不等于"能用" ---
  assert(baselineUsable({ ran: true, status: 0, output: '', why: null }).ok === true, 'D6a exit 0 可用')
  assert(baselineUsable({ ran: true, status: 1, output: 'x', why: null }).ok === true, 'D6b exit 1 可用(存量)')
  assert(baselineUsable(undefined).ok === false, 'D6c 没给出口不可用')
  assert(baselineUsable({ ran: true, status: 0, output: "Cannot find module '@ihui/x'" }).ok === false, 'D6d 输出形态判不可用')
  assert(baselineUsable({ ran: true, status: undefined, output: '' }).ok === false, 'D6e 退出码取不到不可用')
  assert(baselineUsable({ ran: false, status: 0, output: '', why: '抽取失败' }).ok === false, 'D6f ran:false 时 exit 0 也不算数')

  // --- D7 反向锁:不得为差分建"机器态门 id 清单"(AGENTS 明文:豁免清单必然腐烂) ---
  assert(
    !/MACHINE_STATE_GATES|STOCK_ONLY_GATES|BASELINE_EXEMPT/.test(String(classifyHookFailure)),
    'D7 出现了按门 id 写死的清单 ⇒ 本判据改回"现读差分"的实现,不得留清单',
  )
  return { parsedFixture: p }
}

/** §22c 约定:核心判据一律经 __test__ 暴露,镜像测试直接 import,不再抄第二份实现 */
export const __test__ = {
  stripAnsi,
  normGatePath,
  lineNamesFile,
  baselineUsable,
  findingLines,
  parseGateSummary,
  pickLastSummaryRun,
  parseStagedEcho,
  outsideBatchStep,
  blameFromFailedStep,
  classifyHookFailure,
  verdictLine,
  blockedBeforeBatch,
  needsBatchSelfRun,
  decideWithSelfRunBatch,
  SUMMARY,
  FAIL_29,
  MY_FILES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
