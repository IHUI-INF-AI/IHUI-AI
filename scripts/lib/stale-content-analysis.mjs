// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 行级陈旧内容分析(单一实现,2026-09-28 由 scripts/object-space-land.mjs 提取而来)。
/**
 * scripts/lib/stale-content-analysis.mjs
 *
 * 为什么要有这一层(而不是让第二处再抄一遍):
 * 「落地的内容 = 某个祖先版本 ⊕ 别人后来新增的行」这一型,**整 blob 判据结构上看不见** ——
 * 混合体不等于任何祖先,`cur === ancestor` 那条永假。看得见它的只有行级比对:
 * 一行同时满足 ①不在基准 blob 里 ②在要落地的内容里 ③在该路径某个祖先版本里 ⇒ 它是被搬回来的
 * 旧内容,不是新写的内容(真新编辑只造 ①②,陈旧拼接才造 ①②③ —— 这个不对称就是判据的牙)。
 *
 * 这套判定原本只住在落地器(`object-space-land.mjs`)里,而提交链上的守门 84
 * (`check-stale-revert.mjs`)只有整 blob 那一型,于是"任何人一次 `git add` 陈旧副本 + 一次不带
 * pathspec 的普通提交"在提交链上是**沉默**的(2026-09-28 用私有探针索引实测:该门 RC=0 且打印
 * "✅ 反回退守门通过")。两处要用同一把尺子,就只能有一份实现 —— 本仓记过最多次的失败型就是
 * "两处算同一件事必漂移"(§3、守门 13c 的 CRLF 同型、守门 84 自己的 `linesOf` 形状锁)。
 *
 * ⚠️ 本层**是纯函数层**:不读 git、不读盘、不碰任何"判定面"。内容一律由调用方按自己那一面
 * (索引 blob / HEAD blob / 工作树)取好再喂进来 —— 取材面纪律住在 `scripts/lib/face-reader.mjs`,
 * 把取材塞进这里就会让"判据"与"被审面"在两个地方各选一次(那是自洽却错位的尺子)。
 *
 * 三态不可并桶(这是本层的全部对外语义,调用方不得把任何一态折成"通过"):
 *  - `judged`      量到了数(count 可为 0)。
 *  - `undetermined` 该跑而没跑成(基准正文取不到 / 祖先清单非空却一条正文都没读到 / 批量派生失败)。
 *  - `out-of-scope` 按定义不在这条规则射程(二进制正文 / 超过尺寸护栏 / 祖先窗口里没有该路径的版本)。
 *
 * 证据行门槛(①不含字母的行不算、②短于 RESURRECT_MIN_LINE_LEN 不算)不是审美,那个 12 是
 * 2026-09-28 在真仓在飞脏文件上量出来的拐点,量算过程记在常量旁边 —— 挪动它等于改判据的松紧,
 * 不得为了"让某道门变绿"顺手调。
 */

// 生成物「自述钉起始行」的标记名全仓只许有一份(它住在 `generated-input-pin.mjs`,生成器与门 105
// 都从那里取)。本层只借那个**字面量**来拼自证标记的正则,不引入哈希/取内容逻辑 —— 判据仍是纯函数。
import { PIN_BEGIN } from './generated-input-pin.mjs'

/** 证据采样上限与单行截断宽度:报告要能读,不能把终端刷成一份 diff。 */
export const SAMPLE_LINES = 8
export const SAMPLE_COL = 100

/** 行级祖先比对只服务于"文本行",所以有两条**必须报名**的边界(见 resurrectAnalysis 的三态): */
export const RESURRECT_MAX_BLOB_BYTES = 2 << 20

/**
 * 证据行下限(去首尾空白后)。这个 12 不是审美,是 2026-09-28 在真仓在飞脏文件上量出来的拐点:
 * 同一判据不加下限 ⇒ 33 条待判路径里 17 条被判复活;加 12 ⇒ 15 条,而**真阳性一条不减**
 * (`apps/cli/src/commands/spec-drift.ts` 两种口径下都是 46 行复活、`i18n-key-removals.json` 11 行),
 * 减掉的恰好是 `return (`(9)、`labels:`(7)、`</div>`(6) 这类每个版本都在的骨架行。
 * 20 会继续吃掉真信号(spec-drift 46→39),6 挡不住 `annotations:`(12) —— 所以取 12。
 */
export const RESURRECT_MIN_LINE_LEN = 12

/**
 * 计行口径**只有一份**(lineDelta 与 resurrectAnalysis 共用)。两处各写一遍必然漂开 ——
 * 剥尾部 `\r` 与"文末换行符不是一行"这两条都是踩过才写进来的,少一条就把同一次落地在两道
 * 判据里读成两种结论(守门 13c 的 CRLF 同型)。
 */
export function linesOf(s) {
  if (s === '') return []
  const parts = s.split('\n')
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return parts.map((l) => l.replace(/\r$/, ''))
}

/** 行 → 重数(多重集,不是集合:同一行被搬回两份就得算两份)。`key` 只做**键变换**,不另起一套分行口径。 */
export function tallyLines(s, key = (l) => l) {
  const m = new Map()
  for (const l of linesOf(s)) {
    const k = key(l)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

/**
 * 复活判据的键:**剥掉行尾逗号**。
 * 实测这一条不是审美 —— 往 JSON / 列表里追加条目时,原本最后一行必然从 `"x"` 变成 `"x",`,
 * 于是那一行的**文本**在 HEAD 里查不到、却在祖先里成串存在,被按"回潮"计数:
 * `scripts/data/i18n-key-removals.json` 这种"纯追加一条声明"的正当编辑会因此被拒,
 * 而拒绝的后果不是拦下缺陷,是使用者开始挂 `LAND_ALLOW_STALE` —— 那道闸连事故那一型也一起放行
 * (AGENTS §12e:逼人来绕的尺子等于没有尺子)。真回潮的形态(整段文本 HEAD 里一个字都没有)
 * 不受这个键变换影响:事故那 5 行 `"quitChecking": "…"` 去逗号后在 HEAD 里照样不存在。
 * 只对 `key` 生效,`lineDelta`(消失/多出计数)仍按原口径,两处不得混用。
 *
 * ② **去行首缩进**(2026-09-28 补,由本门第一次自撞抓到) —— 提交链里 lint-staged 会对 staged 文件跑
 *   `prettier --write`,而本仓有一批文件**在 HEAD 里就不合规**。第一次碰它的提交必然带上整片重排,
 *   重排后的 `        windowsHide: true,`(8 格)会逐字等于**某个祖先**的形态、却不等于 HEAD 的 6 格形态
 *   ⇒ 纯格式化被读成"复活了一行旧内容",整枚提交被拒,而且归因把红**定责到本次文件**(它确实点名了),
 *   于是下一个接手者只会去挂 `LAND_ALLOW_STALE` —— 与①完全同一条失效路径。
 *   真回潮不受影响:事故那 5 行 `"quitChecking": "…"` 去掉缩进与逗号后在 HEAD 里照样不存在。
 *   ⇒ 放宽的是误伤,不是牙;判据的"复活"从此定义为**内容级**(去缩进后的行文本),不是字节级。
 *
 * ② 生成物的**输入指纹注释行**(2026-10-03 实证,门 84 R1r)。本仓生成器把每个输入文件的
 *   sha256 写进产物头注释,便于"产物是否落后于源"一眼可判:
 *     `// input: packages/i18n/messages/shared/en.json 81094d38…`  ← HEAD(旧输入)
 *     `// input: packages/i18n/messages/shared/en.json 335992a6…`  ← 重生成后(新输入)
 *   两行只差那个 hash,而**输入变了正是重生成的原因** —— 每次源语言包/路由文件一改,
 *   这一行必然与所有祖先版本都不同 ⇒ 被 R1r 读成"复活了 N 行旧内容",而它其实是
 *   "如实记录了新输入"。实测两枚:`remote-locales.gen.ts` 复活 4 行(四个语言)、
 *   `ui-routes.generated.ts` 复活 1 行,两个都是门 105 判"产物陈旧"后**按门要求重跑**的结果 ——
 *   也就是说"按门 105 的要求修"必然撞上门 84,两条门互锁(§12f 恒红机的同型)。
 *   ⇒ 判"复活"必须**先把指纹 hash 归一**:同一 `// input: <路径>` 的行,无论 hash 多少都算同一行。
 *   牙不受影响:真回潮搬回来的**内容行**(语言包键值、路由条目)不带 `// input:` 前缀,
 *   归一对它无效;伪造"同一路径配另一个 hash"也会在门 105 的 inputsSha256 对账上另响。
 *   ⚠️ **这一版只修了 hash 旋转那一型,其余同源行(`scanned / skipped / inputsSha256 /
 *   sourceCommit / generatedAt / generator`)当时留作同族盲区 —— 2026-10-14 由下面的 ③ 补齐**
 *   (补齐口径、两条成对对照与复现命令见 `generatedProvenanceResurrectKey`;互锁并未因此变成
 *   "把 84 关掉":门 84 仍判真实内容行,门 105 仍逐条对账 inputsSha256)。
 */
export const resurrectKey = (l) =>
  l
    .replace(/^[ \t　]+/, '')
    .replace(/,+$/, '')
    // 输入指纹注释行:抹掉 hash 只留输入路径,使"同一输入的不同 hash"归为同一行。
    .replace(/^(\/\/[ \t]*(?:#\s*)?input:[ \t]*\S+?)[ \t]+[0-9a-f]{16,}\b/, '$1')

/**
 * ③ 生成物的**同源溯源/计数行**(2026-10-14 补档:把 ② 那一格从 `// input:` 的 hash 旋转
 *   延长到生成器自述的**全部**溯源/计数行)。
 *
 * 立因(2026-10-14 现读复跑,两条门互锁的实测形态):门 105 `check-miniapp-generated.mjs` 判
 * `apps/miniapp-taro/src/constants/ui-routes.generated.ts` 的 `inputsSha256` 钉与 HEAD 面现算不等
 * ⇒ 要求按官方生成器重生成;而重生成写出的 `// scanned: 345 source files(…)` 这一行
 * **HEAD 面没有**(HEAD 现为 `scanned: 344`)、**祖先面记过**(实测 e751a97b01 / 2b1863d4e2 /
 * b892b5362b / ba0123ff6b 四枚都是 345)⇒ 按 ①②③ 三条齐备被 R1r 读成"复活了一行旧内容" ⇒ 红。
 * 也就是说"按门 105 的要求修"必然撞上门 84 —— 与 2026-10-03 登记的那一次同型,当年只修了
 * `// input:` 的 hash 旋转一型,`scanned / inputsSha256 / sourceCommit / generatedAt / generator /
 * skipped` 这些**同源行**留作同族盲区。同一条不对称还有一处实证:门 105 自己的写回档屏蔽了
 * `generatedAt`(`lib/generated-input-pin.mjs` 的 `maskGeneratedAt`),而门 84 不屏蔽。
 *
 * 这一档的**两个必要条件**(缺一不放宽,顺序不可颠倒):
 *  ① 该行是生成器自述溯源行:`//` 注释引导 + 键名逐条点名命中 `RESURRECT_PROVENANCE_KEYS`
 *     (**不是**"整行注释一律放过");
 *  ② 所在文件**自证为生成物**:文件头窗内出现 `GENERATED_SELF_EVIDENCE_RES` 里的自述标记
 *     (现读自仓内既有产物,见该常量旁)。
 * 两条同时成立才把该行的**值**折掉,键名(以及 `input:` 的输入路径)仍然保留。
 *
 * 牙不受影响(成对对照,两条都已进 `--self-test` 例表与 `scripts/tests/check-stale-revert.test.mjs`):
 *  - **反向锁(不红)**:生成物里只有溯源/计数行随重生成变化 ⇒ `resurrectAnalysis().count === 0`。
 *    复现:`node scripts/check-stale-revert.mjs --self-test`(例 11 端到端 + 例 11b 纯函数两臂)
 *    与 `node --test scripts/tests/check-stale-revert.test.mjs`(「生成物溯源行档 · 反向锁」)。
 *  - **阳性对照(仍红)**:①同一枚生成物里把**内容行**(导出常量/路由条目)按祖先版本写回 ⇒
 *    `count > 0`:例 12 与「· 阳性对照一」;②同一批溯源行写在**未自证为生成物**的文件里 ⇒ 照样判红:
 *    例 13 与「· 阳性对照二」;③真 blob(HEAD 面 `ui-routes.generated.ts` 与其 14 枚祖先正文、
 *    `8ef8b65710^` 那批真回滚源码)的两臂读数由本票取证脚本量得,写在本票交付报告里;
 *    可重跑的等价物是上面那四条例(同一把尺子,只是夹具换成可控面)。
 * 放宽的只是"生成器自己怎么写这行",真实内容行一条也不放过 —— 缺条件②时(例 13)连同源行也照旧判红。
 */
export const RESURRECT_PROVENANCE_KEYS = Object.freeze([
  'generator', //   钉块里的生成器路径
  'sourceCommit', //  生成时 HEAD 的 sha
  'inputsSha256', //  整张输入清单的聚合哈希(门 105 的陈旧判据就看这一维)
  'input', //       逐条输入指纹:只折 hash,路径必须保留(不同输入不得归一)
  'generatedAt', // //   唯一非确定性时刻行;门 105 的写回档早已屏蔽它
  'scanned', //     生成器 extraLines 计数行(ui-routes 的"扫了多少源文件")
  'skipped', //     生成器 extraLines 计数行(回落/排除计数)
])

/**
 * 溯源行的行首形态:`//` 注释引导,紧跟一个**逐条点名**的键名与冒号。
 * `(?:#\s*)?` 沿用 ② 那一格的既有形状(`// # input: …` 也认),不新造宽容度。
 */
export const RESURRECT_PROVENANCE_LINE_RE = /^[ \t]*\/\/[ \t]*(?:#\s*)?([A-Za-z][A-Za-z0-9]*)[ \t]*:[ \t]*([\s\S]*)$/

/**
 * 「文件自证为生成物」的标记集 —— **现读**自仓内 HEAD 面(2026-10-14 实测:`*.generated.*` /
 * `.gen.*` 命名族 10 份 + `apps/miniapp-taro/src/constants/style.ts` 这份按 `AUTO-GENERATED by`
 * 自述的派生块,共 11 份自证;另有 13 份手写脚本/生成器只是**提到**这些词,全部保持严格尺),
 * 不是发明出来的名字(实测每条都出现在**注释行行首**):
 *   `// GENERATED FILE — DO NOT EDIT. 由 <生成器>(<命令>)`  ← 四端 ui-routes + 两枚 i18n 离线包
 *   `// @generated by <生成器> — DO NOT EDIT BY HAND。`      ← import-analysis 两份 catalog
 *   `// AUTO-GENERATED by <生成器> — 请勿手动编辑`            ← desktop-feed 与 miniapp 常量表
 *   `// IHUI-GEN-PIN-BEGIN`(= `lib/generated-input-pin.mjs` 的 `PIN_BEGIN`,web 端 ui-routes 只有钉没有横幅)
 * 行首要求不是洁癖:生成器脚本与 `check-declared-shortcuts.mjs` 的**散文注释**里也写着这些词,
 * 按"整篇包含"判会把它们在飞的手写源码一起判成生成物(那是把条件②洗白掉)。
 * 两侧都由镜像测试钉住:「· 自证标记现读对账」条逐份真产物判"必须自证",逐份手写脚本判"不得自证"。
 */
export const GENERATED_SELF_EVIDENCE_RES = Object.freeze([
  /^[ \t]*\/\/[ \t]*(?:GENERATED FILE|AUTO-GENERATED|@generated)(?![\w-])/m,
  // 钉块起始行用 `generated-input-pin.mjs` 导出的那个常量拼,避免同一标记存在两份字面量。
  new RegExp(`^[ \\t]*\\/\\/[ \\t]*${PIN_BEGIN}\\b`, 'm'),
])

/**
 * 自述标记实测都落在文件头(HEAD 面读数:654 / 655 / 834 / 865 / 912 / 950 / 951 字节,均在
 * 三行水印横幅之后)。取 8192 是 ≈8 倍余量,而**刻意不做全篇扫描**:一段恰好抄了标记的正文
 * 不该有权给自己办生成物护照。
 */
export const GENERATED_SELF_EVIDENCE_HEAD_BYTES = 8192

/** 该文本是否"自证为生成物"(条件 ②)。读不到文本一律 false ⇒ 走严格口径,不放宽。 */
export function isGeneratedSelfDescribing(text) {
  if (typeof text !== 'string' || text.length === 0) return false
  const head = text.slice(0, GENERATED_SELF_EVIDENCE_HEAD_BYTES)
  return GENERATED_SELF_EVIDENCE_RES.some((re) => re.test(head))
}

/**
 * 生成物档的键变换(条件 ①∧② 的 ① 半边):命中白名单的溯源行**折掉值**。
 * 调用方必须先过 `isGeneratedSelfDescribing`;非生成物仍走 `resurrectKey`,一格也不放宽。
 */
export function generatedProvenanceResurrectKey(line) {
  const stripped = resurrectKey(line)
  const m = RESURRECT_PROVENANCE_LINE_RE.exec(stripped)
  if (!m) return stripped
  const key = m[1]
  if (!RESURRECT_PROVENANCE_KEYS.includes(key)) return stripped
  if (key === 'input') {
    // 逐条输入指纹:路径留下、值折掉(与 ② 那一格对 hash 的输出逐字同形)。
    const path = /^[^\s]+/.exec(m[2])
    return path ? `// input: ${path[0]}` : '// input:'
  }
  return `//${key}:`
}

/** 该行是否"生成器自述溯源行"形态(条件 ①;是否放宽还取决于条件 ②)。 */
export function isResurrectProvenanceLine(line) {
  const m = RESURRECT_PROVENANCE_LINE_RE.exec(String(line).replace(/^[ \t　]+/, ''))
  return !!m && RESURRECT_PROVENANCE_KEYS.includes(m[1])
}

/**
 * 行级**多重集**差(纯函数,构造面可证)。
 *
 * 刻意不做位置对齐的 diff:判"这次落地会抹掉基线里哪些行"只需要计数,而位置对齐会把
 * "整段搬家"读成大量删除 —— 那是假阳,后果和恒红门一样(人开始怀疑工具、开始加放行)。
 * 计行前剥尾部 `\r`:共享工作树的副本常是 CRLF 而被审 blob 是 LF,不剥会把"整文件换行符不同"
 * 读成"每一行都被删"(守门 13c 记过同一条)。文末换行符同理**不是一行**:不剥就会让
 * "只是少了个行尾换行"的内容凭空多出 1 行消失 ⇒ 把该放行的判成该拒绝(假阳,代价是逼人加放行)。
 *
 * 任一侧取不到正文 ⇒ vanished/appeared 记 **null**(不是 0):"没量到"与"量到零"是两件事,
 * 后者可放行、前者必须按未判定处理 —— 本仓最高频的失效型就是"把没判写成判过了"。
 */
export function lineDeltaMaps(baseText, newText) {
  if (typeof baseText !== 'string' || typeof newText !== 'string') return null
  const base = tallyLines(baseText)
  const next = tallyLines(newText)
  const extras = (from, against) => {
    const out = new Map()
    for (const [line, count] of from) {
      const d = count - (against.get(line) ?? 0)
      if (d > 0) out.set(line, d)
    }
    return out
  }
  return { removed: extras(base, next), added: extras(next, base) }
}

/** 行数组 ⇒ 多重集(声明侧的输入形态;与 tallyLines 同量纲:逐字行文本做键)。 */
export function multisetOfLines(lines) {
  const m = new Map()
  for (const l of lines || []) m.set(l, (m.get(l) ?? 0) + 1)
  return m
}

/** 两个多重集是否逐项等值(键集与每个键的重数都等)。空集之间也等值 ⇒ 调用方自己判"该不该是空"。 */
export function multisetsEqual(a, b) {
  if (!(a instanceof Map) || !(b instanceof Map)) return false
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

/**
 * 把 `lineDeltaMaps` 的那份差集投成**计数 + 截断样本**(报告用形态)。
 * 计数与样本必须由同一份差集导出 —— 两处各算一遍就会在 CRLF / 文末换行这些细节上漂开,
 * 而漂开的表现是"数字合理、样本对不上",没人能发现。
 */
export function lineDelta(baseText, newText, { sampleLines = SAMPLE_LINES, sampleCol = SAMPLE_COL } = {}) {
  const maps = lineDeltaMaps(baseText, newText)
  if (!maps) return { vanished: null, appeared: null, vanishedSample: [], appearedSample: [] }
  const expand = (m) => {
    const out = []
    for (const [line, count] of m) for (let i = 0; i < count; i++) out.push(line)
    return out
  }
  const vanished = expand(maps.removed)
  const appeared = expand(maps.added)
  const clip = (l) => (l.length > sampleCol ? `${l.slice(0, sampleCol)}…` : l)
  return {
    vanished: vanished.length,
    appeared: appeared.length,
    vanishedSample: vanished.slice(0, sampleLines).map(clip),
    appearedSample: appeared.slice(0, sampleLines).map(clip),
  }
}

/**
 * **行级复活**判据(纯函数):待检内容相对基准**多出来**的行里,有多少是"某个祖先版本写过、
 * 而基准已删掉"的旧内容。三条同时成立才算一行复活(缺任一即不算,这是它不误伤人真删除的理由):
 *  ① 该行在待检内容里的重数 > 在基准 blob 里的重数(不是"搬家",是"新增")
 *  ② 该行确实出现在待检内容里(由 ① 隐含)
 *  ③ 该行出现在该路径**某个**祖先版本里(窗口由调用方决定,本层不数祖先)
 * 复活份数取 `min(①的超出重数, 各祖先里该行重数的最大值)` —— 一行落地加 3 份、祖先只有 1 份时,
 * 另 2 份是真新内容,不得跟着算成旧账(把新账算成旧账 = 逼人放行,与恒红门同罪)。
 *
 * 噪声行不计证据,两条门槛都要(缺一即真仓在飞文件上满天误报):
 *  ① 去首尾空白后必须**含至少一个字母**(空行、纯括号/逗号/运算符不算)——它们在几乎每个祖先版本里都在;
 *  ② 去首尾空白后长度 ≥ `RESURRECT_MIN_LINE_LEN`(常量旁记着 12 这个数是**怎么量出来的**)。
 * 这两条只收窄"哪些行算证据",**不改 ①②③ 判据本身**;真仓实测它们减掉的是 `return (`、`labels:`、
 * `</div>` 一类骨架行,而一条真阳性都不减。残余误报如实登记(值同键的 YAML/CSS 行,如
 * `severity: warning`),那一类与事故里的 `"quitSkip": "跳过",` 在行局部信息上同形,不靠更窄的规则硬分。
 *
 * 键变换的三格(比较前把"哪些差异不算差异"归一,详见 `resurrectKey` 与
 * `generatedProvenanceResurrectKey` 各自的立项说明):
 *  剥行尾逗号(纯追加把最后一行改成带逗号) / 去行首缩进(lint-staged 的 prettier 重排) /
 *  生成器自述溯源行(**必须**同时满足「命中 `RESURRECT_PROVENANCE_KEYS` 键名白名单」与
 *  「文件自证为生成物」两条,缺一不放宽;`input:` 那格还额外保留输入路径)。
 * 放宽了多少不静默:命中生成物档时返回值带 `generatedProvenance: true`、`provenanceLineCount`
 * (待检面自述行总数)与 `provenanceValueDrift`(其中值与基准面不同的那些 = 旧尺下的复活候选)。
 * 真实内容行(非 `//` 自述形态)一条也不放宽,由例 12/13/13b 三条成对对照钉住。
 *
 * 三态,不并桶:
 *  - `judged`:count 是量到的数(>0 即参与拒绝/判红)。
 *  - `undetermined`(判据**该跑而没跑成**):基准正文读不到 / 祖先清单非空却一条正文都没读到 /
 *    批量派生失败。调用方**不得**把它读成通过。
 *  - `out-of-scope`(按定义**不在这条规则的射程**):二进制正文、超过尺寸护栏、祖先窗口里没有该路径的
 *    任何版本。不拒,但必须逐条大声报名并写"未覆盖 ≠ 通过"。
 *    为什么不拒(2026-09-28 真仓量出来的):最常见的两条大路径正是 `PROJECT_PLAN.md`(实测 3.9MB)
 *    与 `README.md`(3.09MB),天然超护栏 ⇒ 按拒处理就是每台每次必红,唯一出路是人长期带着
 *    放行开关跑它,那连事故那一型也一起放行(AGENTS §12e 恒红门同型)。
 *    这两个文件仍由整 blob 那一支看守 —— 它比 sha,不读正文,不受尺寸护栏影响。
 */
export function resurrectAnalysis({
  baseText,
  newText,
  ancestors = [],
  maxBlobBytes = RESURRECT_MAX_BLOB_BYTES,
  minLineLen = RESURRECT_MIN_LINE_LEN,
  sampleLines = SAMPLE_LINES,
  sampleCol = SAMPLE_COL,
} = {}) {
  const clip = (l) => (l.length > sampleCol ? `${l.slice(0, sampleCol)}…` : l)
  const noProvenance = { generatedProvenance: false, provenanceLineCount: 0, provenanceValueDrift: 0 }
  const undetermined = (reason) => ({
    status: 'undetermined',
    reason,
    count: null,
    sample: [],
    commits: [],
    ...noProvenance,
  })
  const outOfScope = (reason) => ({
    status: 'out-of-scope',
    reason,
    count: null,
    sample: [],
    commits: [],
    ...noProvenance,
  })
  if (typeof newText !== 'string') return outOfScope('待落地内容不是文本(二进制或取不到)⇒ 行级判据不适用')
  if (typeof baseText !== 'string') return undetermined('基准 blob 正文取不到 ⇒ 无从判"这行是不是新加的"')
  if (!Array.isArray(ancestors) || ancestors.length === 0)
    return outOfScope('祖先窗口里没有该路径的任何版本(浅历史 / 刚建的文件)⇒ 无可对照')
  const usable = ancestors.filter((a) => typeof a?.text === 'string')
  if (usable.length === 0) return undetermined(`祖先清单有 ${ancestors.length} 枚,但正文一枚都没读到`)
  if (baseText.length > maxBlobBytes || newText.length > maxBlobBytes)
    return outOfScope(
      `正文 ${Math.max(baseText.length, newText.length)}B 超过行级扫描尺寸护栏 ${maxBlobBytes}B(整 blob 判据仍照判)`,
    )

  // **先定尺,再量行**:条件②(所在文件自证为生成物)是一次性判定,基准面/待检面/祖先面必须
  // 共用同一把键 —— 两侧各定一次就会出现"同一枚提交在两道尺子下一红一绿"(本层开头那条禁令)。
  // 取"任一面自证即算":这条档只影响命中白名单的**注释自述行**,内容行照旧,放宽面窄到可以点名。
  const generated = isGeneratedSelfDescribing(newText) || isGeneratedSelfDescribing(baseText)
  const key = generated ? generatedProvenanceResurrectKey : resurrectKey

  const baseT = tallyLines(baseText, key)
  const newT = tallyLines(newText, key)
  const ancT = usable.map((a) => ({ commit: a.commit, m: tallyLines(a.text, key) }))
  let count = 0
  const boilerplate = [] // G-587:结构符/样板行单独成档 —— 只报数,不判红(见下)
  const sample = []
  const commits = []
  const seenCommit = new Set()
  const newLines = linesOf(newText)
  const clipBy = new Map(newLines.map((l) => [key(l), l])) // 报名时报**原文**,不报去逗号后的键
  for (const [line, cNew] of newT) {
    // ① 必须是**基准 blob 里根本没有这一行**(按上面的键比)。这里刻意不用"多重集多出"——
    //    实测误伤面正是那一族:往登记表里再加同形条目时,该行的文本在 HEAD 里本来就有,
    //    只是次数变多,而"多出 N 次 + 祖先也含此行"会被算成复活 N 行 ⇒ 正当编辑被拒 ⇒
    //    使用者只能挂放行开关,那连事故那一型也一起放行(AGENTS §12e 恒红门同型)。
    if (baseT.has(line)) continue
    const extra = cNew
    if (extra <= 0) continue
    const rawLine = clipBy.get(line) ?? line
    const t = rawLine.trim()
    // 噪声行/骨架行不配当证据(见上 ①②);G-587 再加一条**内容性**档:
    // 裸键:值 的 YAML/CI 指令形态(`if: failure()` / `uses: foo@v3` / `severity: warning`)
    // 不承载可回写信息 —— 任何人在 ci.yml 加一个失败分支步骤都会撞上祖先旧 workflow 里的
    // 同一行,2026-09-28 落地 CI 失败自述步骤(4f61a35f6)时实测假阳一次。这类行与被
    // 长度/字母门槛挡掉的骨架行(`}` / `fi` / `exit 0` / `return (`)一样**单独成样板档、
    // 只报数不判红**;带引号/花括号的行(`"key": "v"`)不在样板形态里,真阳性不减。
    if (!/\p{L}/u.test(t) || t.length < minLineLen || RESURRECT_BOILER_LINE_RE.test(rawLine)) {
      boilerplate.push(rawLine)
      continue
    }
    let best = 0
    let bestCommit = null
    for (const { commit, m } of ancT) {
      const a = m.get(line) ?? 0
      if (a > best) {
        best = a
        bestCommit = commit
      }
    }
    if (best === 0) continue // ③ 没有任何祖先含这一行 ⇒ 它是真新内容,不是回潮
    count += Math.min(extra, best)
    if (bestCommit && !seenCommit.has(bestCommit)) {
      seenCommit.add(bestCommit)
      commits.push(bestCommit)
    }
    for (let i = 0; i < Math.min(extra, best) && sample.length < sampleLines; i++) sample.push(clip(rawLine))
  }
  // **放宽了多少必须可见**(与 boilerplateCount 同一条纪律:把"少看了"写成"没有"是本仓最高频失效型)。
  //  - provenanceLineCount:待检面里命中白名单的自述行总数;
  //  - provenanceValueDrift:其中"值与基准面文本不同"的那些 —— 旧尺下它们逐条都会成为复活候选
  //    (候选≠必红:还要 ③ 祖先面记过)。只在生成物档生效时才多付一次基准面多重集。
  let provenanceLineCount = 0
  let provenanceValueDrift = 0
  if (generated) {
    const strictBase = tallyLines(baseText, resurrectKey)
    for (const l of newLines) {
      if (!isResurrectProvenanceLine(l)) continue
      provenanceLineCount++
      if (!strictBase.has(resurrectKey(l))) provenanceValueDrift++
    }
  }
  return {
    status: 'judged',
    reason: null,
    count,
    boilerplate,
    boilerplateCount: boilerplate.length,
    sample,
    commits,
    generatedProvenance: generated,
    provenanceLineCount,
    provenanceValueDrift,
  }
}

/**
 * G-587 样板行形态(结构符档的唯一实现,镜像测试钉住不得被复制成第二份):
 * 裸 `键: 值` 且值不带引号/花括号/方括号 —— YAML/CI 指令行
 * (`if: failure()` / `uses: actions/checkout@v4` / `continue-on-error: true`)。
 * 带 `"`/`{`/`[` 的行(`"key": "v"` / `arr: [1,2]`)是真内容形态,不进样板档。
 */
export const RESURRECT_BOILER_LINE_RE = /^\s*(?:-\s+)?[\w.-]+:\s*[^\s"'{}[\]]\S*\s*$/

export const __test__ = {
  linesOf,
  tallyLines,
  resurrectKey,
  generatedProvenanceResurrectKey,
  isGeneratedSelfDescribing,
  isResurrectProvenanceLine,
  RESURRECT_PROVENANCE_KEYS,
  GENERATED_SELF_EVIDENCE_RES,
  GENERATED_SELF_EVIDENCE_HEAD_BYTES,
  RESURRECT_PROVENANCE_LINE_RE,
  lineDelta,
  lineDeltaMaps,
  multisetOfLines,
  multisetsEqual,
  resurrectAnalysis,
  RESURRECT_BOILER_LINE_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
