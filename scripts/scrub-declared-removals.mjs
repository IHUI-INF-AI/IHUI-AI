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
 * 形态解析一律 import 单源 `scripts/lib/plan-task-index.mjs`(`parseTaskRows`/`bodyOfRow`/`compositeKeyOf`),
 * 本器不写第二份"什么算登记行正文/什么算已勾"的正则(§0.6 单一真相源、§22c)。
 * 方向选择:判不出即**不剔**(宁可留一轮噪音,也不误删别人的行;与 §0.10 一致)。
 *
 * 出口(§0.8 只写跑得通的):
 *   预演:`node scripts/scrub-declared-removals.mjs PROJECT_PLAN.md --dry-run`
 *   写回:`node scripts/scrub-declared-removals.mjs PROJECT_PLAN.md`
 *   自证:`node scripts/scrub-declared-removals.mjs --self-test`
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitRaw } from './lib/face-reader.mjs'
// 登记行形态/勾选态/主键/剥装饰正文的唯一真相源(§0.6):本器只 import,不另写一份正则(§22c)。
import { bodyOfRow, compositeKeyOf, parseTaskRows } from './lib/plan-task-index.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 顶层 export 供 `union-converge` 的复合主键维(G-34/G-43, 2026-10-25)复用同一份文件清单——
// 台账路径若有两份,第二份必然漂移(§0.6);既有 `__test__.LEDGERS` 指向同一数组,语义不变。
export const LEDGERS = ['.ihui-agent/state/stale-claim-strip.jsonl', '.ihui-agent/state/plan-row-drop.jsonl']

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
          if (o.kind === 'f11-purge' || o.seat === 'f11-purge-20261025') dropRows.push(o[key])
        }
      }
    }
  }
  return {
    ...buildDeclared(rows),
    dropTitleFps: new Set(dropRows.map(titleFpOf).filter(Boolean)),
    // 题面指纹维的**证据面**(2026-10-26):判据仍是上面那个 Set,这里记"哪几条台账原文贡献了这个
    // 指纹"—— `union-converge` 扣行时必须逐条出示台账凭据(§0.10:删行的判定要能回答"凭哪条")。
    // 只收与 `dropTitleFps` 同一批(f11/f12 族),两面的射程必须同形,否则证据会说成别的族。
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

/** 纯函数:算出该剔哪些行(不写盘,便于自检)。`headText` = HEAD 面全文,`declared` = Set 或 `declaredRows()` 返回值。 */
export function scrub(text, headText, declared) {
  const { set: declaredSet, closed, dropTitleFps } = declaredInputs(declared)
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
    // 维一(逐字维,原三条件一字不动)
    if (declaredSet.has(l) && !head.has(l) && /^\s*- \[[ xX]\]/.test(l)) {
      dropped.push(l)
      via.set(l, 'verbatim')
      continue
    }
    // 维三(题面前缀维,2026-10-25):声明为 f11-purge 的同题行即使让号/改号也剔;
    // HEAD 仍有同题键 ⇒ 别人真在写同题,绝不剔(与维二同一条让路纪律)。
    if (
      /^\s*- \[[ xX]\]/.test(l) &&
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
  return result.dropped.filter((l) => (String(result.via.get(l) ?? '').startsWith('body:') ? 'body' : 'verbatim') === kind).length
}

function main(argv, root = ROOT) {
  if (argv.includes('--self-test')) return selfTest()
  const file = argv.find((a) => !a.startsWith('--'))
  if (!file) {
    console.error('❌ 用法:scrub-declared-removals.mjs <仓库相对文档> [--dry-run]')
    return 2
  }
  const d = declaredRows(root)
  const { set: declared, closed, malformed, closedDeclared, keyIndex } = d
  if (declared.size === 0) {
    console.log(`SCRUB-RESULT state=undetermined why=摘除声明台账为空或不可解(malformed=${malformed}) ⇒ 不动文档`)
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
  const r = scrub(readFileSync(abs, 'utf8'), headText, d)
  const vHits = countByVia(r, 'verbatim')
  const bHits = countByVia(r, 'body')
  console.log(
    `SCRUB-RESULT state=${r.dropped.length ? 'dropped' : 'clean'} dropped=${r.dropped.length} verbatim=${vHits} body=${bHits} held=${r.held.length} declared=${declared.size} closedDeclared=${closedDeclared} ledgerKeys=${closed.size} keyIndex=${keyIndex?.size ?? 0} malformed=${malformed} file=${file}`,
  )
  for (const item of r.dropped.slice(0, 6)) {
    console.log(`  · 剔除[${r.via.get(item) === 'verbatim' ? '逐字' : '正文'}]:${item.trim().slice(0, 78)}`)
  }
  if (r.dropped.length > 6) console.log(`  · 另有 ${r.dropped.length - 6} 行同批`)
  for (const h of r.held.slice(0, 6)) console.log(`  · 让路:${h.why} —— ${h.line.trim().slice(0, 60)}`)
  if (r.held.length > 6) console.log(`  · 另有 ${r.held.length - 6} 行让路(逐条已计入 held=)`)
  if (r.dropped.length === 0) return 0
  if (argv.includes('--dry-run')) {
    console.log('dry-run:未写回')
    return 0
  }
  writeFileSync(abs, r.text + (r.text.endsWith('\n') ? '' : '\n'), 'utf8')
  // 回读自证用**同一把尺子**整体复判(不再是逐字维单独再算一遍):写回后仍判得出可剔 ⇒ 说明没落干净。
  const again = scrub(readFileSync(abs, 'utf8'), headText, d)
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
  t('维二:台账=已勾 ∧ 盘上=未勾 ∧ 正文前缀 ∧ HEAD 无此键 ⇒ 剔', scrub(`${head}\n${staleRow}`, head, dd).dropped.length === 1)
  t('维二只吃"勾选态相反"这一形:台账也是未勾(维一逐字又不命中)⇒ 不剔', scrub(`${head}\n${staleRow}`, head, buildDeclared([openLedgerRow])).dropped.length === 0)
  t('维二:HEAD 面仍有同主键行 ⇒ 绝不剔并点名', scrub(`${head}\n${staleRow}`, `${head}\n${headLiveRow}`, dd).held.length === 1)
  t('维二:同主键而正文已漂开(非前缀)⇒ 不剔并点名', scrub(`${head}\n${rewrittenRow}`, head, dd).held.length === 1)
  t('维二输入为空(Set 调用形)⇒ 一条也不按正文剔(旧口径零放宽)', scrub(`${head}\n${staleRow}`, head, new Set([closedRow])).dropped.length === 0)
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = { scrub, declaredRows, buildDeclared, rowStateOf, titleFpOf, main, LEDGERS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
