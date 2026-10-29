// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按"声明式摘除台账"剔除活文档工作树里**已被正当摘除过的行**(2026-10-22 立)。
 *
 * 立因(实测,不是推测):本席摘除 G-689/G-691/G-692/G-694 四枚已结清登记行并落库后,
 * 下一轮 `auto-commit-quiet` 的收编提交又把**四枚全部以未勾形态带回**。链路是:共享工作树里
 * PROJECT_PLAN.md 的副本常年滞后 HEAD ⇒ 那四行在盘上还在 ⇒ 归并档 `merge-live-doc` 只判
 * "不丢行 / 不重复",判不出"这几行是别人已按台账正当删掉的" ⇒ 当成新增内容收编回去。
 * 这正是 AGENTS §1 通道③的同型,但通道是定时任务而不是合并,所以更频繁。
 *
 * 判据两条维;两条都必须"三条件同时成立",任一不成立或取不到输入 ⇒ 一律不剔(§0.3 未判定 ⇒ exit 2):
 *   维一(逐字维,2026-10-22 立,一条不松、一字不改):
 *     ① 该行逐字出现在摘除声明台账里(器物 `strip-stale-claim-marks` 的 rowBefore / 摘行器物写的 before)
 *     ② 该行在**当下 HEAD 面**上逐字不存在(否则说明它仍在册,不得动)
 *     ③ 该行是登记行(`- [ ]` / `- [x]`)—— 只认台账语义,不碰正文其它部分。
 *   维二(正文等值维,2026-10-23 补;四道闸,只加严不放宽):
 *     立因(实测,不是推测):`strip-stale-closed-rows` 摘的是**已勾带结清注记**的那一版,而滞后工作树
 *     副本带回的是**剥掉 `✅(日期)` 与结清注记的旧形态**——两行既不同勾选态、正文也不逐字等值,
 *     于是逐字比对**结构上对不上**。2026-10-23 现读:HEAD 面 `G-878` 出现 0 次、索引/工作树各 1 行未勾形态,
 *     台账第 362 条 `kind=stale-closed-sweep` 的 `rowBefore` 是已勾形态 ⇒ 旧判据 `state=clean dropped=0`,
 *     复洁器、`union-converge` 的 `declaredDropCaps`、`strip-stale-closed-rows`(射程只含已勾行)三件同时够不着。
 *     ①' 台账侧存在**已勾(结清)形态**的同主键行,且其剥装饰后的正文**以本行剥装饰后的正文为前缀**
 *         (主键 = 单源 `compositeKeyOf` = 编号 + 标题前缀逐字等值,题面退化即 null ⇒ 本器也不配剔;
 *          前缀维是"同一件事的结清前形态"的结构性证据,同主键而正文已漂开的行**不吃**——见 held 点名)
 *     ∧ ②' HEAD 面既无逐字同文行、也无同主键行(同主键仍在册 = 别人真在写同题 ⇒ 绝不剔,逐条点名)
 *     ∧ ③' 本行是**未勾**登记行,即勾选态与台账记录的形态**相反**(台账=已勾、盘上=未勾);
 *          同形态一律回到维一的逐字比对,绝不因"看着像"就剔。
 *     失效方向恒为「少剔一行 + 大声点名」(`held=` 逐条报出让路原因),绝不「多剔一行」。
 *   维四(同题形态维·结清族,2026-10-26 立;把维二那把"同主键"的尺子扩到**带回形态也是已勾**的那一族):
 *     立因(实测,不是推测):结清有 14+1 个入口,写留痕的那几个只写**已勾形态**;而滞后副本带回来的
 *     注记与台账里那条**字数不同**(同一行被两个入口分别注记过一次,或一处剥了 `✅(日期)`)⇒ 维一逐字对不上、
 *     维二又因"勾选态必须相反"结构上不吃(盘上=已勾、台账=已勾)。2026-10-26 现读台账本体
 *     (`.ihui-agent/state/plan-row-drop.jsonl` + `stale-claim-strip.jsonl`,1244 枚整行 / 330 个复合主键):
 *     同一主键在台账里就存着 **216 枚多种形态**,其中 **80 枚是"两种以上已勾形态"**,
 *     这 80 里有 12 族的形态差只在注记/装饰(正文两向成前缀)——逐字维对这些**一条都认不出**。
 *     判据(四道闸,与维二同一条让路纪律,只加一档不放宽既有任何一维):
 *     ① 台账侧存在该复合主键的**已勾(结清)形态**(输入面 = 维二同一份 `closed` 索引,零复算);
 *     ② 本行**也是已勾**登记行(只吃"同一件事的两种结清写法";未勾行回到维二/维一,口径一字不动);
 *     ③ 剥装饰后的正文**两向之一成前缀**(台账形态是本行的前缀,或本行是台账形态的前缀)——
 *        题面漂开的行照旧不剔并点名;
 *     ④ HEAD 面既无逐字同文行、也无同主键行 ∧ 本行**不带新鲜租约牌**
 *        (`claimMarkOf` + `resolveTtlHours` 同源;牌龄 ≤ TTL ⇒ 让路,判据取不到 ⇒ 一律让路,§0.3 不猜)。
 *     命中记为 `via='form:<台账形态首 28 字>'`,与 `verbatim`/`body`/`title` 分桶报数。
 * 形态解析一律 import 单源 `scripts/lib/plan-task-index.mjs`(`parseTaskRows`/`bodyOfRow`/`compositeKeyOf`),
 * 本器不写第二份"什么算登记行正文/什么算已勾"的正则(§0.6 单一真相源、§22c)。
 *   维五(归档批次维,2026-10-28 立;票 gb22「活文档被体积清偿压好后又被归并档原样拉回」):
 *     立因(实测,不是推断):2026-10-28 11:40 主席席把 AGENTS.md 从 105115 压到 95336(守门 207 预算
 *     96000),被摘的 30 行逐字迁进 `.ihui-agent/archive/AGENTS_trim-2026-10-28.md`;11:51:57 `auto-commit-quiet`
 *     派生 `merge-live-doc --file AGENTS.md --apply` 把盘上正文顶回 **102352**(备份件
 *     `.ihui-agent/tmp/AGENTS.md.2026-10-28T03-51-57.pre-merge.bak` 逐字节 95336),11:52:00 本器被叫到并
 *     **当场判了个 clean**:日志原文 `活文档摘除台账复洁(AGENTS.md): clean dropped=0`。为什么结构上够不着:
 *     维一/维三/维二/维四的入口条件全带 `/^\s*- \[[ xX]\]/`(第 161 行只把这种形态收进台账、第 226 行
 *     只按这种形态剔行),而 AGENTS.md 的 30 行全是 `- **…**` 正文子弹 —— **0/30 命中,整篇文档不在既有
 *     四道维的射程里**。同批 `活文档归并完成(AGENTS.md):lost=0` 说明归并档把插回当成了"补回丢行",两道
 *     尺子各自都绿 ⇒ 正是 AGENTS §1 通道③ 记过的那一型,只是这次的射程是正文而不是登记行。
 *     出路(判据零复算):凭据仍走 `lib/live-doc-archive-drops.mjs` —— 同族表 / 两条整篇复制件判别 /
 *     通配指针不受理 / `MIN_MOVED_LINE` / "本侧 0 份"全部复用那一份实现,本器不开第二本账(§0.6)。
 *     判据(`archiveCaps` 由 CLI 现算后注入,纯函数面只认这个集合):
 *     ① 该行逐字在"移出批次"里(且该件不是本文件的整篇复制件);
 *     ② 该行在**处置侧文本**(= 归并前那一刻的工作树快照,由调用方经 `--archive-disposition <file>` 传入)
 *        中 0 份 ⇒ 补回它的一定是本轮归并,不是别人真新增的工作;
 *     ③ 该行**不是登记行**(`- [ ]` / `- [x]`):那四道维已有镜像测试钉着,本次红线是不动其语义 ——
 *        结清/摘票族走台账,不走本维;
 *     ④ 位置在 `head.has(l)` 短路**之前**:事故当时 HEAD 面正是那份未压版(它逐字含着被搬走的行),
 *        跟在短路后面就永远走不到。这是"HEAD 落后于本侧处置"的那一格,不是"HEAD 在册即不许动"的反例 ——
 *        ②已经把"本侧从未处置过这一行"挡在外面。
 *     失效方向恒为"多留一份":处置侧文本取不到 / 同族凭据取不到 ⇒ CLI 落 `state=undetermined` **exit 2**
 *     并一个字都不改文档;`archiveCaps` 为空 ⇒ 本维一条不剔,既有四维行为逐字节不变(反控由镜像测试钉)。
 * 方向选择:判不出即**不剔**(宁可留一轮噪音,也不误删别人的行;与 §0.10 一致)。
 *
 * 出口(§0.8 只写跑得通的):
 *   预演:`node scripts/scrub-declared-removals.mjs PROJECT_PLAN.md --dry-run`
 *   写回:`node scripts/scrub-declared-removals.mjs PROJECT_PLAN.md`
 *   带归档批次维:`node scripts/scrub-declared-removals.mjs AGENTS.md --archive-disposition <处置前快照文件>`
 *   自证:`node scripts/scrub-declared-removals.mjs --self-test`
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitRaw } from './lib/face-reader.mjs'
// 登记行形态/勾选态/主键/剥装饰正文的唯一真相源(§0.6):本器只 import,不另写一份正则(§22c)。
import { bodyOfRow, compositeKeyOf, parseTaskRows } from './lib/plan-task-index.mjs'
// 维五(归档批次维,2026-10-28)的凭据同样只 import:`selectMovedOutForDisposition` 是本仓唯一的
// "处置侧归档批次取材 + 判据"出口(同族表 / 整篇复制件两判别 / 通配指针不受理 / MIN_MOVED_LINE /
// "本侧 0 份"全在那一份实现里),本器不得再写第二份(§0.6)。
import { archiveDropCaps, selectMovedOutForDisposition } from './lib/live-doc-archive-drops.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 顶层 export 供 `union-converge` 的复合主键维(G-34/G-43, 2026-10-25)复用同一份文件清单——
// 台账路径若有两份,第二份必然漂移(§0.6);既有 `__test__.LEDGERS` 指向同一数组,语义不变。
export const LEDGERS = [
  '.ihui-agent/state/stale-claim-strip.jsonl',
  '.ihui-agent/state/plan-row-drop.jsonl',
]

/** 勾选态取自单源解析器(非登记行 ⇒ null;本器不判"什么算复选框行")。 */
export function rowStateOf(line) {
  const rows = parseTaskRows(String(line ?? ''))
  return rows.length ? rows[0].state : null
}

/**
 * 题面前缀指纹:抹掉行首编号、装饰与括号内引用后取正文前 32 个字。
 *
 * 为什么需要它(2026-10-25 实测):让号/清偿会把同一张票改成新号(同一条"生产备份链
 * UTF-8"在半小时内出现过 G-65→G-87→G-63),而摘除台账的逐字维只认整行原文 ⇒
 * `check-plan-line-loss --heal` 每次都能把改号后的同题行当"历史被抹掉"再回捞一次。
 * 题面指纹只用于**已声明为 f11-purge 的摘除**这一族,不改变其它任何桶的逐字语义。
 *
 * 取 32 而不是 16(2026-10-25 A2 实测):16 字会把"机主 2026-09-28 拍板四条"
 * 的 G-99(已退场)与 G-06(归口行)、"VideoPlayerScreen 全屏纯黑" 的 G-72 与 G-15
 * 算成同一指纹,存在把不同票的丢失一并豁免的假阴性;32 字在分歧点之后。
 */
export function titleFpOf(line) {
  const body = bodyOfRow(String(line ?? '')) ?? String(line ?? '')
  return body
    .replace(/^\s*\**\s*/, '')
    .replace(/^[A-Za-z]{1,8}-?\d+[a-z]?\s*[.、:：]?\s*/, '')
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 32)
}

/** 台账整行原文 → 摘除声明索引。这是维二输入的**唯一构造出口**(self-test 与镜像测试都走它,
 *  不得在别处自己拼 `Map` —— 拼法一旦分叉,"测试绿而生产判据瞎"就是本仓记过的那一型)。
 *
 *  〔2026-10-26 补 `keyIndex`,只加字段、`set`/`closed` 的口径一字不动〕`keyIndex` = 复合主键
 *  (`compositeKeyOf` = 编号 + 标题前缀,与门 203/F1 同一把尺) → 台账原文数组,**open 与 x 两形态都收**。
 *  立因:`set` 是整行逐字,而"结清"这一步会同时改变勾选态并追加注记(`—— 二次结清…`)⇒ 台账里的
 *  x 形态与滞后副本里的 open 形态**哪一侧都对不上**(2026-10-25 实测 B03/G-593/G-115/G-272 各回捞
 *  一次以上)。主键维是"同一件事"的结构证据,与题面措辞/行尾注记无关。
 *  消费方 = `union-converge` 的 `declaredFamilyCaps`(扣回补候选的**第二把键**)与 `scrub` 维二
 *  (`closed`),两处共用这一份构造出口(§0.6 单一真相源)。 */
export function buildDeclared(rowTexts) {
  const set = new Set()
  const closed = new Map()
  const keyIndex = new Map()
  const seenClosed = new Set()
  for (const s of rowTexts) {
    if (typeof s !== 'string' || !/^\s*- \[[ xX]\]/.test(s)) continue
    set.add(s)
    const ck = compositeKeyOf(s)
    if (ck) {
      if (!keyIndex.has(ck)) keyIndex.set(ck, [])
      keyIndex.get(ck).push(s)
    }
    if (rowStateOf(s) !== 'done' || seenClosed.has(s)) continue
    seenClosed.add(s)
    const body = bodyOfRow(s)
    if (!ck || body === null) continue
    if (!closed.has(ck)) closed.set(ck, [])
    closed.get(ck).push({ raw: s, body })
  }
  return { set, closed, keyIndex, closedDeclared: seenClosed.size }
}

/** 摘除声明集合:
 *  · `set` = 整行原文集(维一逐字比对用;字段口径与 2026-10-22 立版逐字节不变,调用方 `union-converge`
 *    的 `declaredDropCaps` 与门 71 都只读它,新增维度必须是**加字段**而不是改语义);
 *  · `closed` = 台账里**已勾形态**的行按复合主键建好的索引(维二输入;同主键可能多枚,存数组);
 *  · `closedDeclared` = 已勾形态枚数(维二的输入面;0 枚只说明"台账里没有结清行",不是判据坏了)。
 *  解不开的行长跳过并计数。
 *  〔G-34/G-43 补字段@2026-10-25,只加不改语义〕`malformedLines` = 解不开的那些行的**原文清单**
 *  (`union-converge` 的复合主键维要靠它做"坏行含该候选编号 ⇒ 未判定不回补"的归因;本器自身不读);
 *  `filesSeen` = 两份台账中**实际在位**的份数(0 = 台账整体缺失,调用方不得当成"没有声明过",§0.3)。
 *  〔2026-10-26 再补两字段,同样只加不改语义〕`keyIndex`(见 `buildDeclared`)与
 *  `dropTitleRows`(题面指纹 → 台账原文,证据面;判据面仍是 `dropTitleFps`)。 */
export function declaredRows(root = ROOT, files = LEDGERS) {
  const rows = []
  const dropRows = []
  let malformed = 0
  const malformedLines = []
  let filesSeen = 0
  for (const f of files) {
    const p = path.join(root, f)
    if (!existsSync(p)) continue
    filesSeen++
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (line.trim() === '') continue
      let o
      try {
        o = JSON.parse(line)
      } catch {
        malformed++
        malformedLines.push(line)
        continue
      }
      for (const key of ['rowBefore', 'before']) {
        if (typeof o[key] === 'string' && /^\s*- \[[ xX]\]/.test(o[key])) {
          rows.push(o[key])
          // f12-purge(2026-10-25,等条件禁令清偿批)与 f11-purge 同一条兜底射程:摘的是未勾行,
          // 回捞通道(收编器/union 行级回补)同一批,射程不同就会像 f11 立项前一样 100% 回潮。
          // 〔2026-10-29 补第三型 producers〕`form === 'dropped'` 是**声明为删除**的具名终态(写口 =
          // `lib/plan-drop-record.mjs` 的删除档,要求 `drop:true ∧ after:null ∧ 前像是未勾登记行`)。
          // 为什么非补不可:逐字维只认整行等值,而守门 71 的回捞腿插回的是它自己从历史面采集的那份
          // 字节形态(实测同一枚票 600 → 599),与被摘那一刻不同字 ⇒ 逐字维结构上命中不了,于是
          // "正当摘除 ⇒ 建前向恢复提交补回"可以无限循环(当天两轮实测复现)。维三只认"声明为删除"
          // 这一族,按**形态**取而不是按**生产者名字**枚举 —— 名字枚举正是每发现一次回潮就得补一个
          // kind 的那一型漂移。翻勾前像(`form:'open'`)照旧不进维三:那行还在面上,只是改了勾选态,
          // 给它题面级豁免等于把"没结清"写成"已处置"(§0.3/§0.10)。
          if (
            o.kind === 'f11-purge' ||
            o.seat === 'f11-purge-20261025' ||
            o.kind === 'f12-purge' ||
            o.seat === 'f12-purge-20261025' ||
            o.form === 'dropped'
          )
            dropRows.push(o[key])
        }
      }
    }
  }
  return {
    ...buildDeclared(rows),
    dropTitleFps: new Set(dropRows.map(titleFpOf).filter(Boolean)),
    // 题面指纹维的**证据面**(2026-10-26):判据仍是上面那个 Set,这里记"哪几条台账原文贡献了这个
    // 指纹"—— `union-converge` 扣行时必须逐条出示台账凭据(§0.10:删行的判定要能回答"凭哪条")。
    // 只收与 `dropTitleFps` 同一批(声明为删除的那一族:f11/f12-purge ∧ `form:'dropped'`),两面的
    // 射程必须同形,否则证据会说成别的族。
    dropTitleRows: (() => {
      const m = new Map()
      for (const raw of dropRows) {
        const tf = titleFpOf(raw)
        if (!tf) continue
        if (!m.has(tf)) m.set(tf, [])
        m.get(tf).push(raw)
      }
      return m
    })(),
    malformed,
    malformedLines,
    filesSeen,
  }
}

/** 兼容旧调用方:只给 `Set` 的调用只有逐字维(维二/维三输入为空 ⇒ 不按正文/题面剔)。 */
function declaredInputs(declared) {
  if (declared instanceof Set) return { set: declared, closed: new Map(), dropTitleFps: new Set() }
  return {
    set: declared?.set ?? new Set(),
    closed: declared?.closed ?? new Map(),
    dropTitleFps: declared?.dropTitleFps ?? new Set(),
  }
}

/** 纯函数:算出该剔哪些行(不写盘,便于自检)。`headText` = HEAD 面全文,`declared` = Set 或 `declaredRows()` 返回值。
 *  `archiveCaps`(2026-10-28 立的维五)= 本侧已按 §1「整区逐字移入 archive」处置过、且**处置侧文本里已为
 *  0 份**的正文行集合(`archiveDropCaps` 的返回值,原始行不是 trim 后的)。缺省/空集 ⇒ 四维行为逐字节不变。 */
export function scrub(text, headText, declared, archiveCaps = null) {
  const { set: declaredSet, closed, dropTitleFps } = declaredInputs(declared)
  const caps =
    archiveCaps instanceof Set
      ? archiveCaps
      : archiveCaps && archiveCaps.caps instanceof Set
        ? archiveCaps.caps
        : new Set()
  const isLedgerRow = (l) => /^\s*- \[[ xX]\]/.test(l)
  const headLines = String(headText ?? '').split('\n')
  const head = new Set(headLines)
  /** HEAD 面在册的复合主键(维二的②'):同主键仍在册 ⇒ 别人真在写同题,绝不剔。 */
  const headKeys = new Set()
  for (const r of parseTaskRows(String(headText ?? ''))) {
    const k = compositeKeyOf(r.raw)
    if (k) headKeys.add(k)
  }
  const lines = String(text ?? '').split('\n')
  const kept = []
  const dropped = []
  const via = new Map()
  const held = []
  for (const l of lines) {
    // 维五(归档批次维,2026-10-28):必须排在下面 `head.has(l)` 短路**之前** —— 事故当时 HEAD 面就是那份
    // 未压版正文,它逐字含着刚被搬走的每一行;排在短路后本维结构上永远走不到(实测 clean dropped=0)。
    // ③非登记行:那四道维有镜像测试钉着,本次红线是不动其语义(结清/摘票族走台账)。
    if (caps.size > 0 && caps.has(l) && !isLedgerRow(l)) {
      dropped.push(l)
      via.set(l, 'archive')
      continue
    }
    // 维一(逐字维,原三条件一字不动)
    if (declaredSet.has(l) && !head.has(l) && isLedgerRow(l)) {
      dropped.push(l)
      via.set(l, 'verbatim')
      continue
    }
    // 维三(题面前缀维,2026-10-25):声明为 f11-purge 的同题行即使让号/改号也剔;
    // HEAD 仍有同题键 ⇒ 别人真在写同题,绝不剔(与维二同一条让路纪律)。
    if (
      isLedgerRow(l) &&
      !head.has(l) &&
      dropTitleFps.size > 0 &&
      dropTitleFps.has(titleFpOf(l)) &&
      !headKeys.has(compositeKeyOf(l))
    ) {
      dropped.push(l)
      via.set(l, 'title')
      continue
    }
    if (head.has(l)) {
      kept.push(l)
      continue
    }
    // 维二(正文等值维)——四道闸,任一不过就留行;该点名的点名
    if (rowStateOf(l) !== 'open') {
      kept.push(l)
      continue
    }
    const key = compositeKeyOf(l)
    if (!key) {
      kept.push(l)
      continue
    }
    const cands = closed.get(key)
    if (!cands) {
      kept.push(l)
      continue
    }
    if (headKeys.has(key)) {
      held.push({ line: l, why: 'HEAD 面仍有同主键行(别人真在写同题)⇒ 不剔' })
      kept.push(l)
      continue
    }
    const body = bodyOfRow(l)
    const hit = cands.find((c) => c.body.startsWith(body))
    if (!hit) {
      held.push({ line: l, why: '同主键而正文非台账形态的前缀(题面已漂开)⇒ 不剔,交人工' })
      kept.push(l)
      continue
    }
    dropped.push(l)
    via.set(l, `body:${hit.raw.trim().slice(0, 28)}`)
  }
  return { text: kept.join('\n'), dropped, held, via }
}

function countByVia(result, kind) {
  return result.dropped.filter((l) => viaBucket(result.via.get(l)) === kind).length
}

/** `via` 分桶:`body:`/`archive` 各归各,其余(含 `title`、`verbatim`)留在 verbatim 桶 —— 与 2026-10-22
 *  立版口径逐字不变,维五只是**加**一个桶,不改任何既有桶的归属。 */
function viaBucket(v) {
  const s = String(v ?? '')
  if (s.startsWith('body:')) return 'body'
  if (s === 'archive' || s.startsWith('archive:')) return 'archive'
  return 'verbatim'
}

/** `--archive-disposition <file>` 的值(2026-10-28 维五输入);未给 ⇒ null(本维整维不生效)。 */
export function dispositionArg(argv) {
  const i = argv.indexOf('--archive-disposition')
  return i >= 0 ? String(argv[i + 1] ?? '') : null
}

/**
 * 文档名参数:`argv` 里第一个非旗标项,**但旗标自己的值不算**。
 *
 * 为什么单独成函数(2026-10-28 实测踩过一次):`--archive-disposition` 后面那个路径同样"不以 `--` 开头",
 * 第一版用 `i !== argv.indexOf('--archive-disposition') + 1` 排除它 —— 而旗标**不在位**时 `indexOf` 返回
 * `-1`,`-1 + 1 = 0` 恰好把下标 0 的文档名一起排除 ⇒ `file` 取空、走"用法错误"分支,而这条分支只
 * `console.error`。镜像测试 (d2) 捕获的是 stdout ⇒ 读出空串,红语变成"没打印 HEAD 面未判定",与真实
 * 故障(参数移位)隔着两层。判据抽成一个函数,自检与镜像测试都调它,不再在测试里重算(§22c)。
 */
export function docArg(argv) {
  const di = argv.indexOf('--archive-disposition')
  const valueIdx = di >= 0 ? di + 1 : -1
  return argv.find((a, i) => i !== valueIdx && !String(a).startsWith('--')) ?? null
}

function main(argv, root = ROOT) {
  if (argv.includes('--self-test')) return selfTest()
  const disp = dispositionArg(argv)
  const file = docArg(argv)
  if (!file) {
    console.error(
      '❌ 用法:scrub-declared-removals.mjs <仓库相对文档> [--dry-run] [--archive-disposition <处置前快照>]',
    )
    return 2
  }
  const d = declaredRows(root)
  const { set: declared, closed, malformed, closedDeclared, keyIndex } = d
  if (declared.size === 0 && !disp) {
    console.log(
      `SCRUB-RESULT state=undetermined why=摘除声明台账为空或不可解(malformed=${malformed}) ⇒ 不动文档`,
    )
    return 2
  }
  let headText
  try {
    // 派生 git 走脚本层 gitRaw(G-927 2026-10-22):裸起 'git' 会被 face-reader.test 棘轮记为新增者;
    // 层内失败抛 Undetermined,仍被本 try 的通用 catch 折成「未判定 ⇒ 不动文档」,语义不变。
    headText = gitRaw(['show', `HEAD:${file}`], root, { maxBuffer: 1 << 28 })
  } catch {
    console.log(`SCRUB-RESULT state=undetermined why=取不到 HEAD 面 ${file} ⇒ 不动文档`)
    return 2
  }
  const abs = path.join(root, file)
  if (!existsSync(abs)) {
    console.log(`SCRUB-RESULT state=undetermined why=工作树无 ${file} ⇒ 不动文档`)
    return 2
  }
  // —— 维五输入:处置侧文本(归并前的工作树快照)→ 同族归档批次 → 可扣集合 ——
  // 取不到一律 exit 2「未判定」并一个字都不改文档(§0.3),绝不"当作没有归档行"直接跑四维。
  let caps = new Set()
  let credNote = 'archiveRequested=0'
  if (disp) {
    let dispositionText = null
    try {
      dispositionText = readFileSync(path.isAbsolute(disp) ? disp : path.join(root, disp), 'utf8')
    } catch {
      dispositionText = null
    }
    if (typeof dispositionText !== 'string' || dispositionText.trim() === '') {
      console.log(
        `SCRUB-RESULT state=undetermined why=取不到处置侧文本(${disp})⇒ 维五不生效、四维也不动文档`,
      )
      return 2
    }
    // faceFiles 传 null:磁盘归档目录已由 lib 并进来(在飞窗口的凭据恰恰只在盘上);
    // 调用方另有某一面的清单时可以传进来,lib 只做并集,不改变判据。
    let movedOut = selectMovedOutForDisposition(root, file, null, dispositionText)
    // 旁路落地型补的一格(2026-10-29 实测:AGENTS 的 R4⑨ 第三次被同一条收编通道带回,门 207 顶红全仓)。
    // 这一型下 `dispositionText`(归并前的工作树快照)恰恰逐字含着被处置的那几行,gb22 的两步判据**同时**失效:
    //   ① `selectMovedOutForDisposition` 把同族件算成 overlap=1 的整篇复制件 ⇒ ok=false,凭据根本取不到;
    //   ② 即便取到,`archiveDropCaps(副本)` 的"处置侧 0 份"也永假。
    // 所以必须**连取材一起换面**,只换扣减用的文本救不回来(探针实测:副本面 overlap=1 判复制件 ⇒ 0/0;
    // 以 HEAD 面重算则 ok=true trimmed=2,且 XCONTROL 那一型不在归档批次里 ⇒ 绝不会被误命中)。
    // HEAD 面 0 份 = 该行的消失已是**入库事实**,凭据形状与维一的 ②(`!head.has(l)`)同形,不是放宽的那一型。
    // 原面取到"对本文档真能扣"的集合就完全不重算(gb22 既有现场逐字节不变);
    // `state=undetermined` 那道出口因此挪到两面都试过之后 —— 两面都不成立仍照旧 exit 2 且一个字不改文档。
    const docText = readFileSync(abs, 'utf8')
    const docLines = new Set(String(docText).split('\n'))
    // 触发条件不是"caps 为空",而是"caps 咬不动本文档任何一行"。
    // 实测踩坑:同目录里另一份无关批次件(上一轮清偿的旧批)会给出一个对本文件毫无作用的元素,
    // 按 size===0 判就等于"原面已生效"⇒ 换面永不发生、本维照旧零扣(读数 caps=1 archive=0)。
    // 这里与 `scrub()` 第 265 行的 `caps.has(l)` 用同一把整行逐字尺,不另写形状(§0.6)。
    const bites = (s) => [...s].some((l) => docLines.has(l))
    caps = movedOut.ok ? archiveDropCaps(dispositionText, movedOut) : new Set()
    if (!bites(caps)) {
      const headTextForCaps = gitRaw(['show', `HEAD:${file}`], root)
      if (typeof headTextForCaps === 'string' && headTextForCaps.trim() !== '') {
        const movedOutHead = selectMovedOutForDisposition(root, file, null, headTextForCaps)
        if (movedOutHead.ok) {
          const capsHead = archiveDropCaps(headTextForCaps, movedOutHead)
          // 替换而非并入:能走到这里说明原面那个集合对本文档一行都扣不动,留着它不会少扣任何有效行;
          // 而并入会让"副本面"的无关元素继续混在凭据读数里,把 archiveBatch 报成一个没人能核的数。
          if (bites(capsHead)) {
            caps = capsHead
            movedOut = movedOutHead
          }
        }
      }
    }
    if (!movedOut.ok && caps.size === 0) {
      console.log(
        `SCRUB-RESULT state=undetermined why=归档批次凭据未取得(${movedOut.reason})⇒ 维五一条不扣、整轮不动文档`,
      )
      return 2
    }
    credNote = `archiveRequested=1 archiveBatch=${movedOut.trimmed.size}行 archiveFrom=${movedOut.used.map((u) => u.path.split('/').pop()).join('+')}`
  }
  const r = scrub(readFileSync(abs, 'utf8'), headText, d, caps)
  const vHits = countByVia(r, 'verbatim')
  const bHits = countByVia(r, 'body')
  const aHits = countByVia(r, 'archive')
  console.log(
    `SCRUB-RESULT state=${r.dropped.length ? 'dropped' : 'clean'} dropped=${r.dropped.length} verbatim=${vHits} body=${bHits} held=${r.held.length} declared=${declared.size} closedDeclared=${closedDeclared} ledgerKeys=${closed.size} keyIndex=${keyIndex?.size ?? 0} malformed=${malformed} file=${file} archive=${aHits} caps=${caps.size} ${credNote}`,
  )
  for (const item of r.dropped.slice(0, 6)) {
    const b = viaBucket(r.via.get(item))
    console.log(
      `  · 剔除[${b === 'archive' ? '归档批次' : b === 'body' ? '正文' : '逐字'}]:${item.trim().slice(0, 78)}`,
    )
  }
  if (r.dropped.length > 6) console.log(`  · 另有 ${r.dropped.length - 6} 行同批`)
  for (const h of r.held.slice(0, 6))
    console.log(`  · 让路:${h.why} —— ${h.line.trim().slice(0, 60)}`)
  if (r.held.length > 6) console.log(`  · 另有 ${r.held.length - 6} 行让路(逐条已计入 held=)`)
  if (r.dropped.length === 0) return 0
  if (argv.includes('--dry-run')) {
    console.log('dry-run:未写回')
    return 0
  }
  writeFileSync(abs, r.text + (r.text.endsWith('\n') ? '' : '\n'), 'utf8')
  // 回读自证用**同一把尺子**整体复判(不再是逐字维单独再算一遍):写回后仍判得出可剔 ⇒ 说明没落干净。
  const again = scrub(readFileSync(abs, 'utf8'), headText, d, caps)
  if (again.dropped.length !== 0) {
    console.log(`❌ 写回后仍有 ${again.dropped.length} 行未剔 ⇒ 回滚写回(用 HEAD 面复原本轮不判)`)
    return 2
  }
  console.log(`✅ 回读核对:0 行残留(写回 ${r.dropped.length} 行剔除已生效)`)
  return 0
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const row = '- [ ]（进行中@2026-10-18/甲） G-900 已摘除的登记行'
  const declared = new Set([row])
  const head = '- [ ] G-901 在册行\n- [ ] G-902 另一在册行'
  const wt = `${head}\n${row}\n- [ ] G-903 别人本轮真新增的行`
  const r = scrub(wt, head, declared)
  t('声明摘除且 HEAD 已无的行被剔', r.dropped.length === 1 && !r.text.includes('G-900'))
  t('在册行与真新增行一字不动', r.text.includes('G-901') && r.text.includes('G-903'))
  const still = scrub(wt, `${head}\n${row}`, declared)
  t('HEAD 面上还在的行不得动(那叫复活是另一件事,不归本器)', still.dropped.length === 0)
  const prose = scrub(`普通正文 ${row}`, head, new Set([`普通正文 ${row}`]))
  t('非登记行一律不剔(只认台账语义)', prose.dropped.length === 0)
  const d = declaredRows(ROOT, ['.ihui-agent/tmp/nonexistent-ledger.jsonl'])
  t('台账不在位 ⇒ 空集(调用方须判未判定,不得当成"没有声明过")', d.set.size === 0)
  // —— 维二(正文等值维)自带四例:命中能剔、四道闸各挡一次 ——
  const closedRow = '- [x] ✅(2026-10-23) G-905 复洁维二的靶行:判据已重写 —— **已结清**:45 处全换'
  const staleRow = '- [ ] G-905 复洁维二的靶行:判据已重写'
  const rewrittenRow = '- [ ] G-905 复洁维二的靶行:题面被改写过的另一版'
  const headLiveRow = '- [ ] G-905 复洁维二的靶行:别人本轮在册的另一版'
  const openLedgerRow = '- [ ]（进行中@2026-10-18/甲） G-905 复洁维二的靶行:判据已重写'
  const dd = buildDeclared([closedRow])
  t(
    '维二:台账=已勾 ∧ 盘上=未勾 ∧ 正文前缀 ∧ HEAD 无此键 ⇒ 剔',
    scrub(`${head}\n${staleRow}`, head, dd).dropped.length === 1,
  )
  t(
    '维二只吃"勾选态相反"这一形:台账也是未勾(维一逐字又不命中)⇒ 不剔',
    scrub(`${head}\n${staleRow}`, head, buildDeclared([openLedgerRow])).dropped.length === 0,
  )
  t(
    '维二:HEAD 面仍有同主键行 ⇒ 绝不剔并点名',
    scrub(`${head}\n${staleRow}`, `${head}\n${headLiveRow}`, dd).held.length === 1,
  )
  t(
    '维二:同主键而正文已漂开(非前缀)⇒ 不剔并点名',
    scrub(`${head}\n${rewrittenRow}`, head, dd).held.length === 1,
  )
  t(
    '维二输入为空(Set 调用形)⇒ 一条也不按正文剔(旧口径零放宽)',
    scrub(`${head}\n${staleRow}`, head, new Set([closedRow])).dropped.length === 0,
  )
  // —— 维五(归档批次维,2026-10-28;票 gb22):正控 + 三条反控,全部走生产 `scrub`,不在这里复算判据 ——
  const movedProse =
    '- **清偿批**:这一整行已按 §1 逐字移入 `.ihui-agent/archive/AGENTS_trim-测试.md`'
  const keptProse = '- 本侧仍在册的一行正文,维五不得连坐'
  const freshProse = '- 别人本轮真新增的一行正文,不在任何归档批次里'
  const caps5 = new Set([movedProse])
  t(
    '维五:逐字在移出批次 ∧ 处置侧 0 份 ∧ 非登记行 ⇒ 剔(事故那一格的靶行)',
    scrub(
      `${head}\n${keptProse}\n${movedProse}`,
      `${head}\n${keptProse}\n${movedProse}`,
      new Set([row]),
      caps5,
    ).dropped.length === 1,
  )
  t(
    '维五反控一:不传 caps(旧三维调用形)⇒ 一行不剔,既有口径零放宽',
    scrub(`${head}\n${movedProse}`, head, new Set([row])).dropped.length === 0,
  )
  t(
    '维五反控二:登记行形(`- [ ]`/`- [x]`)即便在 caps 里也不由维五剔 —— 台账一族语义不动(红线)',
    scrub(`${head}\n${row}`, head, new Set(), new Set([row])).dropped.length === 0,
  )
  t(
    '维五反控三:正向对照 —— 不在归档批次里的行(别人真新增)一字不动',
    scrub(`${head}\n${freshProse}`, head, new Set(), caps5).text.includes('别人本轮真新增'),
  )
  t(
    '维五分桶:archive 自成一桶,verbatim/body 桶的归属逐字不变',
    viaBucket('archive') === 'archive' &&
      viaBucket('title') === 'verbatim' &&
      viaBucket('body:甲') === 'body',
  )
  t(
    '维五参数解析:`--archive-disposition` 的值不得被当成文档名;旗标不在位时下标 0 仍是文档名',
    docArg(['AGENTS.md', '--archive-disposition', 'x/y.txt']) === 'AGENTS.md' &&
      dispositionArg(['AGENTS.md', '--archive-disposition', 'x/y.txt']) === 'x/y.txt' &&
      docArg(['PROJECT_PLAN.md', '--dry-run']) === 'PROJECT_PLAN.md' &&
      docArg(['--dry-run', 'README.md']) === 'README.md',
  )
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = {
  scrub,
  declaredRows,
  buildDeclared,
  rowStateOf,
  titleFpOf,
  main,
  LEDGERS,
  // 维五(2026-10-28)的分桶与参数解析也必须由生产实现提供:镜像测试不得自己再写一份(§22c)。
  viaBucket,
  dispositionArg,
  docArg,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
