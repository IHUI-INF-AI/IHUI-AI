#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-task-claims.mjs — 扫描 PROJECT_PLAN.md 任务认领状态
 *
 * 三态分类(AGENTS.md §1 任务认领机制配套):
 *   - 无人认领: `- [ ]` 开头(不含"进行中")
 *   - 进行中:   `- [ ]（进行中）` 开头(全角括号)
 *   - 已完成:   `- [x]` 开头
 *
 * 用法:
 *   node scripts/check-task-claims.mjs             # 人类可读汇总
 *   node scripts/check-task-claims.mjs --json      # JSON 输出
 *   node scripts/check-task-claims.mjs --unclaimed  # 只列无人认领
 *   node scripts/check-task-claims.mjs --in-progress # 只列进行中(含持有者/年龄列)
 *   node scripts/check-task-claims.mjs --twins     # 列已闭环孪生旧行与"正文骨架相同"的未勾行组(不等同整行逐字节,见 DUP_GROUP_HEADING)
 *   node scripts/check-task-claims.mjs --check-gate [--json]  # 租约判据 CL1/CL2/CL3,违规 exit 1
 *   node scripts/check-task-claims.mjs --self-test # 纯函数夹具自检,不碰真 PROJECT_PLAN
 *   node scripts/check-task-claims.mjs --plan <file>   # 只读注入:改判指定文件(取证/多租约场景用,**磁盘直读**)
 *   node scripts/check-task-claims.mjs --ttl-hours <n> # 覆盖租约年龄阈值(默认 72h,亦可 IHUI_CLAIM_LEASE_TTL_HOURS)
 *
 * 判定面(2026-09-26 收口,口径同 70/77/83/94/98/101/118):
 *   默认判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工/派单扫描的磁盘逃生舱;
 *   两面旗同给 ⇒ exit 2;被审面取不到 ⇒ **exit 2「无法判定」,绝不回退另一个面**(把"没判"
 *   写成"判过了"是守门 94 同型假绿)。此前它无条件 `readFileSync(PLAN_PATH)` —— 共享工作树
 *   常年滞后 HEAD 且含并行会话未提交的在途行,同一份 HEAD 内容会在"恒红/假绿"之间来回跳
 *   (§12e 那条最高反面教训:与改动无关的红门只会逼人 --no-verify,连带废掉全部守门)。
 *   `--plan <file>` 是**注入通道**,读的就是那个磁盘文件本身 —— 判据可取证化的必需通道,
 *   不受面判据管辖(镜像测试 T8-T10/T14 全走它,绝不往真 PROJECT_PLAN 写自测行)。
 *
 * 2026-09-23 立, AGENTS.md §1 任务认领机制配套
 * 2026-09-25 扩租约三要素(MECHANISM-SPEC-3 §2 / A9):认领不再只是文本标记,
 *   `- [ ]（进行中@YYYY-MM-DD/持有者）` 是带到期时间的租约。三条判据:
 *   CL1 租约过期(年龄 > 阈值,默认 72h)→ 点名行号+持有者+年龄;
 *     2026-09-29 起套 **HEAD 面同一时刻量到的过期租约行文本**做棘轮锚点(与 CL3 同一条设计):
 *     这一维是**被时钟判红**的,不是被本次改动判红的 —— 不套棘轮就等于在干净 HEAD 上恒红,
 *     而 PROJECT_PLAN.md 正是本门 stagedTriggers 的文件,恒红唯一结局是各会话走应急跳门
 *     连带约 190 道守门作废(§12e/§12f)。存量逐条报名不静默;新增(本次带进来的)照红。
 *   CL2 有 @日期 而无 /持有者(半个租约比没有租约更危险)→ 红;
 *   CL3 同一行**在勾选框位置**同时出现 `[x]` 与租约形态 `（进行中@…）`(清账方向矛盾)→ 红;
 *     2026-09-26 起套 **HEAD 自身存量**做棘轮锚点(HEAD 里那批残留是归并器修好前种下的
 *     机械垃圾,逐条带 `**[归并]**` 出处;生产者侧已收口并有变异对照)。不套手工豁免清单 ——
 *     锚点会随清偿自己收紧。`--worktree` / `--plan` 两条人工与取证面**不套**,仍全量判。
 *     `[x]` 只算勾选框,不算正文叙述 —— 2026-09-26 实测:用 `**[x] 已落**` 叙述子票进度的
 *     在途行曾被判成矛盾,而那行租约归别的会话持有 ⇒ 恒红面由判据自己造出来(详见该函数注释)。
 *     2026-09-28 把同一条原则补到另一半:`（进行中）` 落在**反引号代码段内**时是在描述这个
 *     形态本身(叙述),不算挂牌;HEAD 面现读 5 处"矛盾行"全部是这一型假阳。反引号配不上对
 *     (截断长行)⇒ 判不出,保守**计入**并打印 `undeterminedCode` —— 这里计错的代价只是报数
 *     多一行,而把真敞口洗成绿是静默放行,更贵。
 *   **向后兼容第一位**:旧的裸 `（进行中）` 一律只计数不判红 —— 落地当天把全仓既有
 *   标记判红 = 恒红门 = 逼人 `--no-verify` = 全部守门作废。到期**只判红只点名,
 *   绝不自动摘除标记**(摘别人的认领是越权,AGENTS §16)。全程只读,无任何 git 写操作。
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 相似度尺子**复用** lib 里的唯一实现(纯函数、零副作用)。
// 不 import `merge-live-doc.mjs`:它顶层就是 CLI 主流程且没有 §22d 的 isDirectRun 守卫,
// 一被 import 就跑参数校验并 `process.exit(2)` —— 本票第一版就这么把扫描器弄死了(实测)。
import {
  SIM_THRESHOLD,
  CONTAIN_MIN,
  jaccard,
  squash,
  tokenize,
} from './lib/live-doc-similarity.mjs'
// 判定面取材的唯一出口(2026-09-26 迁)。计划文档的正文必须由共用层按面读 ——
// git 绝对路径 / stdio[0]='pipe' / maxBuffer 给足 / 未预取即抛不静默,这四件各门自己写必错。
import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const PLAN_PATH = resolve(ROOT, 'PROJECT_PLAN.md')

// ---------- 租约常量(2026-09-25, MECHANISM-SPEC-3 §2 / A9) ----------
const DEFAULT_TTL_HOURS = 72
const TTL_ENV = 'IHUI_CLAIM_LEASE_TTL_HOURS'
const HOUR_MS = 3600000
// ⚠ 全角括号陷阱(本仓记过的坑):「可选标记」若写成 `（进行中）?`，`?` 只作用于最后一个
//   全角字符 `）`，判据会静默退化成「必须含字面前缀 `（进行中`」——对租约行只吃掉
//   `（进行中`，`@日期/持有者）` 残留在正文里，text/bodyOf 全被污染。
//   可选形态**必须整组包住**：`(?:（进行中[^）]*）)?`。正反例由 --self-test S5 与
//   镜像测试 T11 钉死。
const CLAIM_MARKER_SRC = '（进行中[^）]*）' // 裸旧标记 或 租约形（进行中@YYYY-MM-DD/持有者）
const CLAIM_MARKER_RE = new RegExp(`^- \\[ \\]${CLAIM_MARKER_SRC}\\s*`) // 进行中分类(必须含标记)
const CLAIM_MARKER_OPTIONAL_RE = new RegExp(`^- \\[ \\](?:${CLAIM_MARKER_SRC})?\\s*`) // 可选形态
const CLAIM_MARKER_BODY_RE = new RegExp(`^(${CLAIM_MARKER_SRC})\\s*`) // bodyOf 用(已剥掉 `- [ ] `)
// 从行里截出标记本体
const CLAIM_MARK_EXTRACT_RE = new RegExp(`^- \\[ \\](${CLAIM_MARKER_SRC})`)
// 标记内部:（进行中[@YYYY-MM-DD][/持有者]）——两段都可选，组合决定形态
const LEASE_INNER_RE = /^（进行中(?:@(\d{4}-\d{2}-\d{2}))?(?:\/([^）/]+))?）$/

/**
 * 解析一条「进行中」行的租约三要素。
 * @param {string} trimmed 已 trimStart 的整行
 * @returns {{format:'legacy'|'lease'|'unknown', date:string|null, holder:string|null}}
 */
function parseClaim(trimmed) {
  const m = CLAIM_MARK_EXTRACT_RE.exec(trimmed)
  if (!m) return { format: 'none', date: null, holder: null }
  const inner = LEASE_INNER_RE.exec(m[1])
  if (!inner) return { format: 'unknown', date: null, holder: null }
  const [, date, holder] = inner
  if (!date && !holder) return { format: 'legacy', date: null, holder: null }
  if (date && !isValidIsoDate(date))
    return { format: 'unknown', date: null, holder: holder ?? null }
  return { format: 'lease', date: date ?? null, holder: holder ?? null }
}

/** `2026-02-31` 能被 Date.parse 吞成 3 月 2 日 —— 回读同一日历日才算真日期。 */
function isValidIsoDate(iso) {
  const ms = Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === iso
}

/**
 * CL1/CL2 判据。输入 scanTasks 产出的 inProgress 行(带 format/date/holder)。
 * 旧格式(legacy)与形态不可辨(unknown)**一律只计数不判红** —— 向后兼容第一位。
 * @param {Array<{line:number,text:string,full:string,format:string,date?:string|null,holder?:string|null}>} rows
 * @param {{nowMs:number,ttlHours:number}} opts
 */
function analyzeLeases(rows, { nowMs, ttlHours }) {
  const stale = [] // CL1
  const missingHolder = [] // CL2
  let legacy = 0
  let unknown = 0
  let holderNoDate = 0
  for (const r of rows) {
    if (r.format === 'legacy') {
      legacy++
      continue
    }
    if (r.format !== 'lease') {
      unknown++
      continue
    }
    if (r.date && !r.holder) {
      missingHolder.push({ line: r.line, date: r.date, text: r.text })
      continue
    }
    if (r.date && r.holder) {
      const ageHours = (nowMs - Date.parse(`${r.date}T00:00:00Z`)) / HOUR_MS
      r.ageHours = Math.floor(ageHours)
      if (ageHours > ttlHours)
        stale.push({
          line: r.line,
          holder: r.holder,
          date: r.date,
          ageHours: r.ageHours,
          text: r.text,
        })
    } else if (r.holder) {
      holderNoDate++ // 有持有者无日期:年龄无法判定,只报数不判红(判据不猜)
    }
  }
  return { stale, missingHolder, counts: { legacy, unknown, holderNoDate } }
}

/**
 * 量出一行内的**反引号代码段**区间(行内码 `` `x` `` 与双反引号码段 ``` ``x`` ```;
 * CommonMark:闭合串的反引号个数必须与开启串相等,且码段不得跨行)。
 * 返回 `{ spans, undetermined }`:
 *  - `spans` —— 已配对的 `[起, 止)` 区间(止=闭引串末尾之后);
 *  - `undetermined` —— 有开启串找不到等长的闭引串(截断的长行 / 未闭合码段 / 退化成
 *    裸双反引号空码段的粘连文本)⇒ 这一行"哪些字在代码段内"**判不出来**。
 * 判据失效的表现永远是安静,所以判不出来必须由调用方**打印**,不得静默当成"没有代码段"。
 */
function codeSpanRangesOf(line) {
  // 反斜杠转义的反引号不是定界符(`\`` 在 Markdown 里就是字面反引号)。等长遮罩,索引不变。
  const s = line.replace(/\\[`*_\[\]<>{}()#+\-.!\s]/g, (m) => ' '.repeat(m.length))
  const delims = []
  for (let i = 0; i < s.length; ) {
    if (s[i] !== '`') {
      i++
      continue
    }
    let j = i
    while (j < s.length && s[j] === '`') j++
    delims.push({ start: i, len: j - i })
    i = j
  }
  const spans = []
  let undetermined = false
  let k = 0
  while (k < delims.length) {
    const open = delims[k]
    let closed = -1
    for (let m = k + 1; m < delims.length; m++) {
      const c = delims[m]
      if (c.len !== open.len) continue
      const inner = open.start + open.len
      // CommonMark:开启串与闭引串之间必须有内容(裸 `` 不是空码段,而是粘连文本的一部分)。
      if (c.start > inner) {
        closed = m
        break
      }
    }
    if (closed < 0) {
      undetermined = true
      break
    }
    spans.push([open.start, delims[closed].start + open.len])
    k = closed + 1
  }
  return { spans, undetermined }
}

/** 标记本体(起于 at、长 len)是否**整体**落在某个反引号代码段区间内(含两侧定界符)。 */
function insideCodeSpan(spans, at, len) {
  return spans.some(([a, b]) => at >= a && at + len <= b)
}

/**
 * CL3:同一行同时出现「进行中」与 [x] —— 协议自相矛盾,等价于「释放失败」的现场。
 * 独立于三态分类扫(这类行会被行首规则归进 completed,三态里看不见它)。
 *
 * ⚠ 存量取向(2026-09-25 立项实测):真仓 PROJECT_PLAN 已有 4 行同时含两 token ——
 * 两行是协议叙述文本(`` `- [ ]（进行中）` → `- [x] ✅(日期)` `` 这类带引号的例子),
 * 两行是旧裸标记留下的"翻勾未摘牌"。它们**全是裸 `（进行中）`**。若照字面判红,
 * 本门落地当天即恒红 = 逼人 `--no-verify` = 全部守门作废(本仓最高反面教训)。
 * 所以红判只认**租约形态标记**(`@日期` 或 `/持有者`,即协议新写法)与 [x] 并存;
 * 裸标记的矛盾行只计数(`legacyContradictions`)报数不判红,清账归各行持有者。
 *
 * ⚠ 2026-09-28 补第三维:「进行中」标记也必须落在**结构位** —— 落在反引号代码段里的
 * 是在描述这个形态本身(`` …(`- [ ]（进行中）` → `- [x] ✅(日期)`)… ``),不是有人挂了牌。
 * S13 当年把"叙述不算状态"的原则只应用到 `[x]` 那一半,`（进行中）` 这一半一直误计
 * (HEAD 面现读 5 行全是叙述行、真牌 0 枚 —— 主会话 2026-09-28 清掉 22 枚真牌后剩下的
 * 恰好全是假阳,`7b3030ee5`)。
 * **判不出即计入**:整行反引号配不上对(截断长行 / 未闭合码段)时保守算结构位 ——
 * 这里判错的代价只是多报一行**计数**(矛盾行数是报数口径、不判红,不产生恒红门),
 * 而把真敞口洗成绿是静默放行,更贵。取舍写在这里,由 S16 / T19 成对钉住。
 */
function findContradictions(content) {
  const out = []
  let legacyContradictions = 0
  let undeterminedCode = 0
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart()
    if (!t.includes('（进行中')) continue
    /**
     * `[x]` 必须在**勾选框位置**(行首),不能"整行任意处出现 [x]"。
     * 2026-09-26 实测的假阳性:一条正常的在途登记
     *   `- [ ]（进行中@2026-09-26/O81票）O81 …… ② **[x] 2026-09-26 已落**:几何档 ……`
     * 正文里用 `**[x]**` 叙述"第 2 票已落",于是整条被 CL3 判成"清账方向矛盾"。
     * 后果不是多一行噪音:PROJECT_PLAN.md 是门 109 的 stagedTriggers 文件,而这行的租约
     * 归**另一个会话**持有 ⇒ 谁提交计划文档都被拦,而门 109 又"绝不自动摘除别人的认领"
     * ⇒ 出路只剩 --no-verify(连带废掉全部守门,AGENTS §12e 那条最高反面教训)。
     * 判据把"叙述里的 [x]"当"状态的 [x]",就是它自己造出来的恒红面。
     */
    if (!/^- \[[xX]\]/.test(t)) continue
    const matches = [...t.matchAll(/（进行中[^）]*）/g)]
    if (matches.length === 0) continue
    const { spans, undetermined } = codeSpanRangesOf(t)
    /**
     * 判不出代码段边界(反引号配不上对)⇒ **全部标记按结构位计**，而不是整行放过:
     * 放过就是把真敞口洗成绿,计上只是报数多一行(矛盾行数不判红,不产生恒红门)。
     * 静默的"放过"就是把没判写成判过了(本仓最高频失效型)⇒ undeterminedCode 必须进报数面并被打印。
     */
    if (undetermined) undeterminedCode++
    // 结构位 = 代码段**之外**的标记;代码段内的是叙述(在描述这个形态本身),不计。
    const structural = undetermined
      ? matches
      : matches.filter((m) => !insideCodeSpan(spans, m.index, m[0].length))
    if (structural.length === 0) continue
    const hasLeaseForm = structural.some((m) => m[0] !== '（进行中）')
    if (hasLeaseForm) out.push({ line: i + 1, text: t.slice(0, 120), key: t })
    else legacyContradictions++
  }
  return { contradictions: out, legacyContradictions, undeterminedCode }
}

function resolveTtlHours(flagValue, envValue) {
  if (flagValue !== null && flagValue !== undefined)
    return { ttlHours: flagValue, source: '--ttl-hours' }
  if (envValue !== undefined && envValue !== '') {
    const n = Number(envValue)
    if (Number.isFinite(n) && n > 0) return { ttlHours: n, source: TTL_ENV }
    return {
      ttlHours: DEFAULT_TTL_HOURS,
      source: `${TTL_ENV} 值非正数(${envValue})⇒回落默认`,
      warn: true,
    }
  }
  return { ttlHours: DEFAULT_TTL_HOURS, source: '默认' }
}

/**
 * 汇总租约判据结果。violations 非空即 gate 判红。绝不改动任何文件(只判红只点名)。
 *
 * `cl3Stock` 是 CL3 的**棘轮锚点**(= 同一份文档在 HEAD 自身的矛盾行**行文本多重集**),不是豁免清单:
 * 那批行是归并工具在 2026-09-26 修好之前种进 HEAD 的机械残留(逐条都带 `**[归并]**` 出处标记),
 * 生产者侧已收口并有变异对照钉住。而 PROJECT_PLAN.md 是本门的 stagedTriggers 文件,
 * 照字面判红就是**每一次提交计划文档都被拦**,而门又"绝不自动摘除别人的认领" ⇒ 出路只剩跳门,
 * 一次绕过连带废掉全部守门(§12e 那条本仓最高反面教训)。锚点取 HEAD 自身而不是手工清单,
 * 是为了让它**只会自己收紧**:谁把残留清进 HEAD,下一次的红线就跟着降。
 * `cl3Stock === undefined` ⇒ 不套棘轮(人工/取证面),`null` ⇒ 锚点取不到,判"未判定"而非通过。
 */
function checkLeaseGate(content, { nowMs, ttlHours, cl3Stock, cl1Stock }) {
  const { inProgress } = scanTasks(content)
  const { stale, missingHolder, counts } = analyzeLeases(inProgress, { nowMs, ttlHours })
  const { contradictions, legacyContradictions, undeterminedCode } = findContradictions(content)
  const useRatchet = Array.isArray(cl3Stock)
  const anchorUnknown = cl3Stock === null
  /**
   * CL1 的棘轮(2026-09-29 补,与 CL3 同一条设计、同一个理由):
   * **租约是被时钟判红的,不是被本次改动判红的。**一条 09-26 登记的租约,今天谁提交都过期 ——
   * 于是本门在干净 HEAD 上恒红 27 处,而 PROJECT_PLAN.md 正是它的 stagedTriggers 文件:
   * 与提交内容无关的恒红门唯一结局是各会话走应急跳门、连带约 190 道守门对每次提交作废(§12e/§12f)。
   * 锚点 = **同一份文档在 HEAD 面、用同一个 nowMs 与阈值量到的过期租约行文本多重集**,所以:
   *  - 别人欠的旧账 ⇒ 只报数且逐条点名(绝不静默);
   *  - 本次**带进来**的过期租约(新登记就写旧日期 / 换个文案塞回来)⇒ 判红;
   *  - 谁把一条续租或翻勾清进 HEAD,锚点自己下降 —— 不需要手工清单,因此不会腐烂。
   * `cl1Stock === undefined` ⇒ 不套棘轮(人工/取证面,照旧全量判红);`null` ⇒ 锚点取不到,判"未判定"。
   */
  const useRatchet1 = Array.isArray(cl1Stock)
  const anchor1Unknown = cl1Stock === null
  const stockLeft1 = new Map()
  if (useRatchet1) for (const k of cl1Stock) stockLeft1.set(k, (stockLeft1.get(k) || 0) + 1)
  const cl1StockRows = []
  const cl1NewRows = []
  for (const v of stale) {
    const n = useRatchet1 ? stockLeft1.get(v.text) || 0 : 0
    if (n > 0) {
      stockLeft1.set(v.text, n - 1)
      cl1StockRows.push(v)
    } else cl1NewRows.push(v)
  }
  /**
   * 存量按**行文本多重集**认领,不按"前 N 条"切。计数式棘轮在这里是错的:新塞进文档前面的
   * 一颗矛盾会把后面某颗旧残留顶进"存量名额",于是**新增的那颗被洗成存量、谁也不会红** ——
   * 镜像测试 T17 正是这样抓到第一版实现的。多重集认领让"存量"与"新增"互不替换:
   * 残留吃掉与自己同文的额度,新文案一律落进 fresh。
   */
  const stockLeft = new Map()
  if (useRatchet) for (const k of cl3Stock) stockLeft.set(k, (stockLeft.get(k) || 0) + 1)
  const cl3StockRows = []
  const cl3NewRows = []
  for (const v of contradictions) {
    const n = useRatchet ? stockLeft.get(v.key) || 0 : 0
    if (n > 0) {
      stockLeft.set(v.key, n - 1)
      cl3StockRows.push(v)
    } else cl3NewRows.push(v)
  }
  const violations = [
    ...cl1NewRows.map((v) => ({ kind: 'CL1', ...v })),
    ...missingHolder.map((v) => ({ kind: 'CL2', ...v })),
    ...cl3NewRows.map((v) => ({ kind: 'CL3', ...v })),
  ]
  return {
    violations,
    cl1: {
      total: stale.length,
      stock: cl1StockRows.length,
      fresh: cl1NewRows.length,
      anchorApplied: useRatchet1,
      anchorUnknown: anchor1Unknown,
      stockRows: cl1StockRows,
    },
    cl3: {
      total: contradictions.length,
      stock: cl3StockRows.length,
      fresh: cl3NewRows.length,
      // 锚点取不到 ⇒ 本轮 CL3 **未判定**(既不放行也不判红),由调用方喊出来
      anchorApplied: useRatchet,
      anchorUnknown,
    },
    summary: {
      inProgress: inProgress.length,
      stale: stale.length,
      missingHolder: missingHolder.length,
      contradictions: contradictions.length,
      legacyContradictions,
      undeterminedCode,
      ...counts,
    },
    ttlHours,
  }
}

// ---------- 判定面(2026-09-26 收口,口径同 70/77/83/94/98/101/118) ----------
const PLAN_REL = 'PROJECT_PLAN.md'
const PLAN_FACE_LABEL = {
  head: 'HEAD blob(git cat-file HEAD:PROJECT_PLAN.md)',
  index: '索引 blob(暂存区,:PROJECT_PLAN.md)',
  worktree: '工作树(磁盘,人工/派单扫描逃生舱)',
  plan: '注入文件 --plan(磁盘直读,取证通道 —— 判据可取证化的必需出口,不受面判据管辖)',
}

/**
 * 纯四态面选择:默认 head;`--staged`→index;`--worktree`→worktree;两面旗同给→conflict。
 * 判"两面同给"必须在这里判(而不是在调用处 if)—— 两个面各读一半就是一把自洽却错位的尺子。
 */
function pickPlanFace(flags) {
  const picked = selectFace({
    staged: flags.has('--staged'),
    worktree: flags.has('--worktree'),
    def: 'head',
  })
  if (picked.error) return { face: null, error: picked.error }
  return { face: picked.face === 'staged' ? 'index' : picked.face, error: null }
}

/**
 * 按判定面读计划文档。任何失败都返回 { content:null, error } —— 调用方必须 exit 2,
 * **绝不回退另一个面凑内容**(回落就是把"没判"写成"判过了",守门 94 同型)。
 */
function readPlanOnFace(face) {
  if (face === 'worktree') {
    let text
    try {
      text = readWorktreeFile(ROOT, PLAN_REL)
    } catch (e) {
      return {
        content: null,
        error: `读不到 ${PLAN_FACE_LABEL[face]} 版 ${PLAN_REL}:${String(e?.message ?? e).split('\n')[0]}`,
      }
    }
    if (text === null)
      return {
        content: null,
        error: `读不到 ${PLAN_FACE_LABEL[face]} 版 ${PLAN_REL}(磁盘上没有此文件 / 非文本)`,
      }
    return { content: text, error: null }
  }
  // 冒号在两种面都必须保留(索引规格是 `:path`,不是裸路径):`cat-file --batch` 会把裸
  // 路径当对象名解析并回 missing —— 照 `${cond ? '' : 'HEAD:'}${rel}` 那种把冒号并进三元的
  // 写法,暂存区口径会永远"读不到"。形状由镜像测试 T17 的规格字面量锁钉死。
  const spec = `${face === 'index' ? '' : 'HEAD'}:${PLAN_REL}`
  let got
  try {
    got = catBatch(ROOT, [spec], { maxBuffer: 1 << 29, timeout: 120000 })
  } catch (e) {
    return {
      content: null,
      error: `读不到 ${PLAN_FACE_LABEL[face]} 版 ${PLAN_REL}:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
  const text = got.get(spec)
  if (typeof text !== 'string')
    return {
      content: null,
      error:
        `读不到 ${PLAN_FACE_LABEL[face]} 版 ${PLAN_REL}(该面没有此对象 —— missing / unmerged / 非 blob)。` +
        `工作树侧${existsSync(PLAN_PATH) ? '存在该文件' : '也不存在该文件'} —— 不回退磁盘`,
    }
  return { content: text, error: null }
}

// ---------- CLI 参数白名单 ----------
// 未知开关不得静默落进默认分支(本仓在 sync-lost-commit-tags.mjs 踩过 `--push` 掉进
// `--check` 还 exit 0)——白名单外一律 exit 2。
const BOOLEAN_FLAGS = new Set([
  '--json',
  '--unclaimed',
  '--in-progress',
  '--twins',
  '--check-gate',
  '--self-test',
  '--staged',
  // 2026-09-26:面纪律要求工作树档必须是**显式**入口,不得继续让未知开关静默落进
  // head 面 —— 以前 `--worktree` 会被 parseArgs 判死,而"判死"又和"想读磁盘"是两回事。
  '--worktree',
])
const VALUE_FLAGS = new Set(['--plan', '--ttl-hours'])

/**
 * @param {string[]} argv
 * @returns {{ok:true, flags:Set<string>, plan:string|null, ttlHours:number|null}|{ok:false,error:string}}
 */
function parseArgs(argv) {
  const flags = new Set()
  let plan = null
  let ttlHours = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) return { ok: false, error: `不支持位置参数: ${a}` }
    if (VALUE_FLAGS.has(a)) {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) return { ok: false, error: `${a} 需要一个值` }
      if (a === '--plan') plan = v
      else {
        const n = Number(v)
        if (!Number.isFinite(n) || n <= 0)
          return { ok: false, error: `--ttl-hours 需要正数,实得 ${v}` }
        ttlHours = n
      }
      continue
    }
    if (!BOOLEAN_FLAGS.has(a)) return { ok: false, error: `未知开关: ${a}` }
    flags.add(a)
  }
  return { ok: true, flags, plan, ttlHours }
}

const USAGE = [
  '用法: node scripts/check-task-claims.mjs [--json|--unclaimed|--in-progress|--twins|--check-gate|--self-test]',
  '      [--plan <file>] [--ttl-hours <n>] [--staged | --worktree]',
  `      租约年龄阈值亦可经 ${TTL_ENV} 覆盖(默认 ${DEFAULT_TTL_HOURS}h)。全程只读。`,
  '      判定面:默认 HEAD blob;--staged 判索引 blob;--worktree 人工磁盘档;两面旗同给 exit 2。',
].join('\n')

/**
 * 扫描 PROJECT_PLAN.md 内容,按三态分类任务行。
 *
 * 每行同时留 `text`(展示用的 120 字截断)与 `full`(**整行**)。相似度一律用 `full`:
 * 只比前 120 字会把"同名不同尾"的两件事判成孪生(台账里 D64/D90 这类条目在 120 字之后才分叉),
 * 而本工具的孪生标记会把那条从"可认领"里**摘掉** —— 误判的代价是藏掉一件真活。
 * 要复现这个陷阱:把 `bodyOf` 里的 `row.full || row.text` 改成 `row.text`,孪生数当场涨一批
 * (本票第一版就是这样,靠"逐对眼检"才发现多出来的是不同任务)。
 * @param {string} content - PROJECT_PLAN.md 文件内容
 * @returns {{ unclaimed: Array<{line:number,text:string,full:string}>, inProgress: Array<{}>, completed: Array<{}> }}
 */
function scanTasks(content) {
  const lines = content.split('\n')
  const unclaimed = []
  const inProgress = []
  const completed = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    // 每条规则各推一类:顺序即优先级(进行中必须先于"无人认领"判,否则会被后一条通吃)。
    // 进行中规则用 CLAIM_MARKER_RE(含标记体,兼容旧裸 `（进行中）` 与新租约 `（进行中@日期/持有者）`),
    // 它同时把整段标记从 text 里剥掉 —— 若按 `（进行中）?` 那种写法,租约行会残留 `@日期/持有者）`。
    const kinds = [
      [/^- \[[xX]\]\s*/, completed],
      [CLAIM_MARKER_RE, inProgress],
      [/^- \[ \]\s*/, unclaimed],
    ]
    for (const [re, arr] of kinds) {
      if (!re.test(trimmed)) continue
      const row = { line: i + 1, text: trimmed.replace(re, '').slice(0, 120), full: trimmed }
      if (arr === inProgress) Object.assign(row, parseClaim(trimmed))
      arr.push(row)
      break
    }
  }

  return { unclaimed, inProgress, completed }
}

/**
 * 剥掉行首的认领标记与"已完成"注解,得到可比的**正文骨架**。
 * 必须先剥:翻勾的仓库写法是「改前缀 + 追加证据」(`- [ ] X` → `- [x] ✅(日期) X,取证…`),
 * 不剥前缀时两条同文的行开头就分叉,相似度被凭空拉低 ⇒ 孪生漏判。
 */
function bodyOf(row) {
  return (row.full || row.text)
    .replace(/^- \[[ xX]\]\s*/, '')
    .replace(CLAIM_MARKER_BODY_RE, '') // 旧裸标记与租约标记都整段剥掉(见 S5 全角括号正反例)
    .replace(/^✅\s*(（[^）]*）|\([^)]*\))?\s*/, '')
    .trim()
}

/**
 * 揪出"内容已经有一条 `[x]` 近亲"的未勾行。
 *
 * 为什么必须有(2026-09-25 实测):三态分类只看行首,而 §1 的翻勾写法会在同文件留下
 * **改写前的旧副本**(并集合并也会),于是 `- [ ]` 与 `- [x] ✅…同文…` 并存 ——
 * 派活的人(以及照清单行事的 agent)把已闭环的项当成"无人认领"接着做。本会话就被
 * 「另有 7 个脚本的 --self-test 仍走 os.tmpdir()」那一对带偏过一次。
 *
 * 尺子一律复用 `scripts/lib/live-doc-similarity.mjs` 的导出(字符二元组 Jaccard + `SIM_THRESHOLD`
 * + 容器下界 `CONTAIN_MIN`),**不在这里再抄一份** —— 两处算同一个相似度,迟早分叉成
 * "一边判孪生、一边判真丢失"。
 * 第二条通道是**包含**:未勾行骨架被 `[x]` 行逐字包住(对方只是追加了取证),
 * 这种形态 Jaccard 会随追加长度单调掉到阈值以下,只靠阈值就会漏。
 * 下界 CONTAIN_MIN 个非空白字符:再短的裸标记行在满屏清单里必然互含,会把无关项判成孪生。
 */
function findClosedTwins(rows, completed) {
  const doneBodies = completed.map((c) => ({
    line: c.line,
    body: bodyOf(c),
    sq: squash(bodyOf(c)),
    /** 门 203 那一份指纹(同题不同编号的**可证**通道)要的原始行,不能只带骨架。 */
    full: c.full,
  }))
  const twins = []
  for (const r of rows) {
    const body = bodyOf(r)
    if (squash(body).length < CONTAIN_MIN) continue
    const tb = tokenize(body)
    let best = null
    for (const d of doneBodies) {
      const score = jaccard(tb, tokenize(d.body))
      const contained = d.sq.includes(squash(body))
      // 第三条**可证**通道:剥掉主键位置的编号之后**逐字节相同**(= 让号遗留那一型:同一条活
      // 登记在两个号下)。它既不被包住(编号字节挡在中间),又常因这几枚字节掉到阈值附近 ——
      // 只用那两条通道会把可证的副本降级成猜。这条比指纹强:除编号外一字不差才算。
      const sameTitle = keyIdStripped(r.full) === keyIdStripped(d.full)
      if (score < SIM_THRESHOLD && !contained && !sameTitle) continue
      const eff = Math.max(score, contained || sameTitle ? 1 : 0)
      if (!best || eff > best.score) {
        best = {
          line: d.line,
          score,
          via: contained
            ? score >= SIM_THRESHOLD
              ? 'both'
              : 'contain'
            : sameTitle
              ? 'same-title'
              : 'jaccard',
        }
      }
    }
    if (best)
      twins.push({
        line: r.line,
        text: r.text.slice(0, 120),
        twinLine: best.line,
        score: best.score,
        via: best.via,
      })
  }
  return twins
}

/**
 * 同一件事被写了好几遍的**未勾**行(与上面的"已闭环孪生"是两种形态):三条一模一样的
 * `- [ ]（进行中）` 会被数成三件活。这里只按**正文骨架逐字相同**归组,不做模糊匹配 ——
 * 误判成本是把两件活并成一件,所以宁可只认骨架逐字相同。注意口径边界:骨架 = 剥掉行首状态与
 * 认领/租约标记及空白之后的正文,**两行整行可以并不相等**(差的那几枚字节正是租约),
 * 所以报名不得自称"整行逐字重复" —— 文案与出路见下面的 `DUP_GROUP_HEADING`(S17 钉这一条)。
 */
/**
 * 孪生旧行按**证据强度**分档(2026-10-16,S18 钉这一条):
 *  - `contain`(含 `both`)= 未勾行的骨架被那条 `[x]` 行**逐字包住**,对方只是追加了取证 ⇒ 可证;
 *  - `same-title` = 与那条 `[x]` 行**除主键位置的编号外逐字节相同**(让号遗留那一型)⇒ 同样可证:
 *    它不被包住(编号字节挡在中间),相似度又常因那几枚字节掉到阈值附近,只用那两条会降级成猜;
 *  - `jaccard` 单通道 = 字符二元组相似度过了 `SIM_THRESHOLD`(现读 0.6)就配成一对 ⇒ **弱证据**。
 *
 * 只有可证那两档才从"可认领"里扣名额。理由:0.6 的相似度足以把两条**不同的活**判成一对
 * (同族票的题面前几十字几乎总是一模一样),而扣名额的后果是那条真待办从派单面**永久隐形** ——
 * 与本仓记过的"台账里 N 族待办对派单永久隐形"同型,方向还更坏(那型是重复认领,这型是没人认领)。
 * 与 `plan-tasks.mjs` 派单口径同取向:**拿不准的留在清单里、只点名,不踢掉**。
 */
/**
 * 剥掉**主键位置**上的编号(行首第一个 `G-147` / `G-998128` / `D1047` / `82.` 之类的 token),
 * 其余一字不动 —— 供 `same-title` 那条可证通道用:两条行只有在这一步之后**逐字节相同**,才敢说
 * 它们是"同一条活登记在两个号下"(§9b 让号、门 203 同题多号那一族)。
 * 刻意只碰行首那一枚:任何"顺手把所有数字都抹掉"的写法都会把 `web 86 处` 与 `web 99 处` 这种
 * **不同的活**洗成同一条(本仓 T2 型禁令就是防这个)。
 */
export function keyIdStripped(full) {
  const body = bodyOf({ full })
  return squash(body.replace(/^\s*(?:\*\*)?[A-Za-z]{1,3}-?\d{1,}(?:[①-⑳])?[.、:：]?\s*/, ''))
}

export function splitTwinsByProof(twins) {
  const proven = twins.filter((t) => t.via === 'contain' || t.via === 'both' || t.via === 'same-title')
  const suspect = twins.filter((t) => t.via === 'jaccard')
  return { proven, suspect }
}

/**
 * 从"无人认领"里扣名额 —— **只扣逐字可证那一档**(理由见 `splitTwinsByProof`)。
 * 抽成函数不是为好看:镜像测试要判的是**同一份减法**,而不是在测试里再抄一遍 filter(§22c)。
 */
export function subtractProvenTwins(unclaimed, proven) {
  const lines = new Set(proven.map((t) => t.line))
  return unclaimed.filter((t) => !lines.has(t.line))
}

/**
 * `--twins` 第二段与汇总行共用的报名文案(2026-10-16 改正,取证见 S17)。
 *
 * 旧文案写"逐字重复的未勾行组",而判据 `findDuplicateGroups` 的键是 `squash(bodyOf(row))`:
 * 行首状态、认领/租约标记与空白**都被剥掉**。真仓 HEAD 面现读被归组的 15 组里 14 组两行并不
 * 逐字节相同,差的字节正是 `（进行中…）` 租约 ⇒ 文案比判据强一档。危害不是难看:有人照着"逐字
 * 重复"去删行,就会把别人的租约删掉,而 §1 明令"门绝不自动摘除任何人的认领"。
 * 所以报名只说"正文骨架逐字相同",并把**整行逐字节**那条真出路(`--fold-identical-open-rows`)点名。
 */
export const DUP_GROUP_HEADING =
  '正文骨架逐字相同的未勾行组(键已剥行首状态与认领/租约标记及空白 ⇒ **不等于整行逐字节相同**,差的那几枚字节常是别人的租约,§1 明令不得代摘;整行逐字节相同的折叠走 `node scripts/plan-tasks-merge.mjs --fold-identical-open-rows`) —— 会把一件事数成多件:'

function findDuplicateGroups(rows) {
  const byKey = new Map()
  for (const r of rows) {
    const key = squash(bodyOf(r))
    if (key.length < CONTAIN_MIN) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(r.line)
  }
  return [...byKey.entries()].filter(([, ls]) => ls.length > 1).map(([, ls]) => ls)
}

function claimDisplaySuffix(row) {
  if (row.format === 'lease' && row.holder) {
    const age = typeof row.ageHours === 'number' ? ` · ${row.ageHours}h` : ''
    return `  【持有者 ${row.holder} @ ${row.date ?? '无日期'}${age}】`
  }
  if (row.format === 'lease' && row.date) return `  【⚠ 有日期无持有者 @ ${row.date}】`
  if (row.format === 'legacy') return '  【旧格式·无租约】'
  return '  【标记形态不可辨】'
}

function runCheckGate(flags, content, { nowMs, ttlHours, ttlSource, faceLabel, cl3Stock, cl1Stock }) {
  const gate = checkLeaseGate(content, { nowMs, ttlHours, cl3Stock, cl1Stock })
  if (flags.has('--json')) {
    console.log(
      JSON.stringify(
        {
          checkGate: true,
          exit: gate.violations.length > 0 ? 1 : 0,
          ttlHours,
          // 判定面必须进 JSON(镜像测试靠它断"读的是哪一面",而人类末行只对文本输出负责)
          face: faceLabel,
          leases: gate.summary,
          cl1: gate.cl1,
          cl3: gate.cl3,
          violations: gate.violations,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`任务认领租约对账(阈值 ${ttlHours}h,来源:${ttlSource})`)
    if (gate.violations.length === 0) {
      console.log(
        `  ✅ 0 红。进行中 ${gate.summary.inProgress} 条全部为旧格式无日期标记(只计数不判红)或有效租约。`,
      )
    } else {
      for (const v of gate.violations) {
        if (v.kind === 'CL1')
          console.log(
            `  ❌ CL1 租约过期  L${v.line}  持有者 ${v.holder}  认领于 ${v.date}  年龄 ${v.ageHours}h > ${ttlHours}h  ${v.text}`,
          )
        if (v.kind === 'CL2')
          console.log(`  ❌ CL2 半个租约(有日期无持有者)  L${v.line}  @${v.date}  ${v.text}`)
        if (v.kind === 'CL3')
          console.log(`  ❌ CL3 同行同时出现「进行中」与 [x](清账方向矛盾)  L${v.line}  ${v.text}`)
      }
      console.log(
        '  出路三选一(本门**绝不自动摘除别人的认领**,AGENTS §16):持有者续租改日期 / 完成后翻勾并删标记 / 显式让渡改写持有者。',
      )
    }
    console.log(
      `  报数(不判红):旧格式 ${gate.summary.legacy} · 形态不可辨 ${gate.summary.unknown} · 有持有者无日期 ${gate.summary.holderNoDate} · 裸标记×[x] 矛盾行 ${gate.summary.legacyContradictions}(存量翻勾未摘牌,归各行持有者清账)`,
    )
    // "判不出即计入"那一侧必须**打印**,不得静默(判据失效的表现永远是安静):
    // 这些行的反引号配不上对 ⇒ 代码段内外判不出来,按保守方向计进了矛盾行。
    if (gate.summary.undeterminedCode > 0)
      console.log(
        `  ⚠️ 反引号配不对的行 ${gate.summary.undeterminedCode} 处:代码段内外**判不出** ⇒ 已保守计入矛盾行报数(宁多计,不把真敞口洗成绿)`,
      )
    /**
     * CL3 的锚点三态必须分开说,不得都写成"通过":
     *  套了棘轮 ⇒ 报"存量 N 只报数 / 新增 M 判红";没套(人工/取证面)⇒ 报"本轮未套棘轮";
     *  锚点取不到 ⇒ 报"**未判定**"。把"看不见"写成"没问题"是本仓反复登记过的那一类失效。
     */
    if (gate.cl3.anchorUnknown) {
      console.log(
        `  ⚠️ CL3 **未判定**:HEAD 版 ${PLAN_REL} 取不到 ⇒ 没有棘轮锚点。矛盾行逐条列出(共 ${gate.cl3.total} 处)但本轮不据此判红,也不记为通过。`,
      )
    } else if (gate.cl3.anchorApplied) {
      console.log(
        `  CL3 棘轮:锚点 = HEAD 自身的矛盾行(按行文本认领,换个文案就落进新增)⇒ 本轮存量 ${gate.cl3.stock} 处只报数、新增 ${gate.cl3.fresh} 处判红(残留生产者已在 2026-09-26 收口:归并器翻勾前先摘牌)`,
      )
    } else {
      console.log(`  CL3 本轮未套棘轮(人工/取证面,全量判)：矛盾行 ${gate.cl3.total} 处`)
    }
    /**
     * CL1 的锚点三态同形(见 checkLeaseGate 里的理由:**被时钟判红的那一型必须套棘轮**)。
     * 存量必须**逐条报名**(持有者 + 认领日 + 年龄),不得只印一个计数 —— 拿到计数的人无法判断
     * "该谁续租",而这一格恰恰需要人来清(守门 70/76/81 同族:只报数不报名等于把账锁死)。
     */
    if (gate.cl1.anchorUnknown) {
      console.log(
        `  ⚠️ CL1 **锚点取不到**:HEAD 版 ${PLAN_REL} 读不到 ⇒ 没有棘轮锚点。此时按**最严方向**处理:过期租约 ${gate.cl1.total} 处全部判红并逐条点名(把"看不见"写成"没问题"是本仓反复登记过的那一类失效),但这**不是**一条通过结论 —— 请先修取材面。`,
      )
    } else if (gate.cl1.anchorApplied) {
      console.log(
        `  CL1 棘轮:锚点 = HEAD 面同一时刻量到的过期租约行文本(换个文案/改日期就落进新增)⇒ 本轮存量 ${gate.cl1.stock} 处只报数、新增 ${gate.cl1.fresh} 处判红。存量归各行持有者清账(续租改日期 / 翻勾摘牌 / 显式让渡),本门绝不代摘。`,
      )
      for (const v of gate.cl1.stockRows)
        console.log(`    · 存量过期租约  L${v.line}  持有者 ${v.holder}  认领于 ${v.date}  年龄 ${v.ageHours}h`)
    } else {
      console.log(`  CL1 本轮未套棘轮(人工/取证面,全量判)：过期租约 ${gate.cl1.total} 处`)
    }
    console.log(`  判定面:${faceLabel}`)
  }
  process.exitCode = gate.violations.length > 0 ? 1 : 0
}

/**
 * 纯函数夹具自检(绝不含真 PROJECT_PLAN —— 它是多会话共写的活文档,自测行写进去
 * 就可能被别人提交带走或造成误读)。返回失败例数,0 = 全绿。
 */
function selfTest(realNow = Date.now()) {
  // 固定"当前时刻"喂判据,不依赖 realNow —— 夹具的相对年龄必须可复现。
  const NOW = Date.UTC(2026, 8, 25, 12, 0, 0) // 2026-09-25T12:00Z
  void realNow
  let failures = 0
  const results = []
  const check = (name, fn) => {
    try {
      fn()
      results.push(`✅ ${name}`)
    } catch (e) {
      failures++
      results.push(`❌ ${name}: ${e?.message ?? e}`)
    }
  }
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg ?? ''} 期望 ${JSON.stringify(b)} 实得 ${JSON.stringify(a)}`)
  }
  const gate = (doc, ttlHours = DEFAULT_TTL_HOURS) => checkLeaseGate(doc, { nowMs: NOW, ttlHours })

  // S1 旧格式不误伤(正) / 有效新租约也不红(反 pair)
  check('S1 旧裸标记与新鲜租约都 0 红', () => {
    const g = gate('- [ ]（进行中）老任务\n- [ ]（进行中@2026-09-25/qa）新任务\n')
    eq(g.violations.length, 0)
    eq(g.summary.legacy, 1, '旧格式应计 1')
  })
  // S2 新格式过期必红(正) / 同文但日期新鲜必绿(反) —— CL1
  check('S2 CL1 过期租约点名行号+持有者,新鲜的不红', () => {
    const g = gate('- [ ]（进行中@2020-01-01/tester）自测行\n')
    eq(g.violations.length, 1)
    eq(g.violations[0].kind, 'CL1')
    eq(g.violations[0].holder, 'tester')
    eq(g.violations[0].line, 1)
    eq(gate('- [ ]（进行中@2026-09-25/tester）x\n').violations.length, 0, '新鲜租约不该红')
  })
  // S3 缺持有者必红(正) / 持有者齐备必绿(反) —— CL2
  check('S3 CL2 有日期无持有者必红,补齐即绿', () => {
    const g = gate('- [ ]（进行中@2026-09-24）\n')
    eq(g.violations.length, 1)
    eq(g.violations[0].kind, 'CL2')
    eq(gate('- [ ]（进行中@2026-09-24/qa）\n').violations.length, 0)
  })
  // S4 三态矛盾必红(正) / 正常翻勾与存量裸标记矛盾只报数(反) —— CL3
  check('S4 CL3 租约标记+[x] 必红;裸标记矛盾行与正常翻勾不红', () => {
    eq(gate('- [x]（进行中@2026-09-25/qa）翻勾未摘牌\n').violations[0].kind, 'CL3')
    /**
     * 2026-09-26 改判(原断言:这一型必须 CL3 红)。**未勾选**的行,正文里出现 `[x]`
     * 不再算矛盾 —— 真仓实测那条误判是
     *   `- [ ]（进行中@2026-09-26/O81票）O81 跨端 UI 单一源…… ② **[x] 2026-09-26 已落**:几何档……`
     * 即"用 `**[x]**` 叙述子票进度",完全合法。而它造成的后果不是多一行噪音:
     * PROJECT_PLAN.md 是本门 stagedTriggers 文件,那行租约又归**另一个会话**持有,
     * 本门又"绝不自动摘除别人的认领" ⇒ 谁提交计划文档都被这台自己造出来的恒红门拦住,
     * 出路只剩 --no-verify(AGENTS §12e)。矛盾只在**勾选框位置**才是状态。
     */
    eq(gate('- [ ]（进行中@2026-09-25/qa）正文混进 [x] 的矛盾行\n').violations.length, 0, '未勾选行正文里的 [x] 是叙述,不得判矛盾')
    eq(gate('- [ ]（进行中@2026-09-25/qa）真在途,租约未过期\n').violations.length, 0)
    eq(gate('- [x] ✅(2026-09-25) 正常闭环\n').violations.length, 0)
    // 存量兼容:裸 `（进行中）` 与 [x] 并存只计数(真仓实测有 2 行这种历史形态,判红即恒红门)
    const g = gate('- [x] ✅(2026-09-25)（进行中）旧双态行\n')
    eq(g.violations.length, 0, '裸标记矛盾行不得判红')
    eq(g.summary.legacyContradictions, 1, '裸标记矛盾行必须如实报数')
  })
  // S4c CL1 棘轮(2026-09-29):被时钟判红的那一型必须套 HEAD 存量锚点,且**四态各有一条用例**
  check('S4c CL1 棘轮:存量只报数、新增判红、锚点空全红、锚点缺失未判定', () => {
    const a = '- [ ]（进行中@2026-09-20/qa）A 任务正文\n'
    const b = '- [ ]（进行中@2026-09-21/qa）B 任务正文\n'
    const doc = a + b
    const texts = (d) =>
      analyzeLeases(scanTasks(d).inProgress, { nowMs: NOW, ttlHours: DEFAULT_TTL_HOURS }).stale.map((v) => v.text)
    const st = texts(doc)
    // 不套棘轮(人工/取证面)⇒ 两条都红,这一档不得被棘轮改动语义
    eq(checkLeaseGate(doc, { nowMs: NOW, ttlHours: DEFAULT_TTL_HOURS }).violations.length, 2, '未套棘轮必须全量判红')
    // ① 锚点 = 同一份内容 ⇒ 0 红,但存量必须**逐条报名**(只印计数等于把账锁死)
    const gStock = checkLeaseGate(doc, { nowMs: NOW, ttlHours: DEFAULT_TTL_HOURS, cl1Stock: st })
    eq(gStock.violations.length, 0, 'HEAD 存量不得判红(恒红门唯一出路是跳门)')
    eq(gStock.cl1.stock, 2, '存量必须计 2')
    eq(gStock.cl1.stockRows.length, 2, '存量必须逐条带着持有者/日期/年龄交出去,不得只给计数')
    eq(gStock.cl1.stockRows.every((v) => v.holder === 'qa' && Number.isFinite(v.ageHours)), true, '报名要素必须齐')
    // ② 锚点只覆盖一条 ⇒ 另一条是"本次带进来的新账",必红且点的是**没被覆盖**的那条
    const gFresh = checkLeaseGate(doc, { nowMs: NOW, ttlHours: DEFAULT_TTL_HOURS, cl1Stock: [st[0]] })
    eq(gFresh.violations.length, 1, '新增过期租约必须判红')
    eq(gFresh.violations[0].kind, 'CL1')
    eq(gFresh.violations[0].text === st[1], true, '红的必须是没被锚点覆盖的那条')
    // ③ 锚点为空数组 ⇒ 全红(空锚点不是"没有存量",是"HEAD 里一条都没有")
    eq(checkLeaseGate(doc, { nowMs: NOW, ttlHours: DEFAULT_TTL_HOURS, cl1Stock: [] }).violations.length, 2, '空锚点⇒全红')
    // ④ 锚点取不到(null)⇒ 按**最严方向**判红(绝不把"看不见"写成"没问题"),并如实标 anchorUnknown
    const gUn = checkLeaseGate(doc, { nowMs: NOW, ttlHours: DEFAULT_TTL_HOURS, cl1Stock: null })
    eq(gUn.violations.length, 2, '锚点缺失必须走最严方向(判红),不得静默放行')
    eq(gUn.cl1.anchorUnknown, true, '锚点缺失必须标 anchorUnknown,报告措辞不得写成通过')
    eq(gUn.cl1.total, 2, '同时把量到的条数报出来')
    // ⑤ 反向锁:换个文案塞回同一件事 ⇒ 行文本不同 ⇒ 落进新增(棘轮不是"数量够就行")
    const rewritten = '- [ ]（进行中@2026-09-20/qa）A 任务正文改写过一遍\n' + b
    const g5 = checkLeaseGate(rewritten, { nowMs: NOW, ttlHours: DEFAULT_TTL_HOURS, cl1Stock: st })
    eq(g5.violations.length, 1, '换文案必须落进新增(计数式棘轮在这里会洗白)')
    eq(g5.violations[0].text.includes('改写过一遍'), true, '红的必须是新写的那条')
  })
  // S5 全角括号可选性正反例(本仓记过的坑:`（进行中）?` 的 `?` 只管最后一个全角字符)
  check('S5 可选标记整组包住:`（进行中）?` 陷阱有牙证明', () => {
    const bare = '- [ ] 没有标记的任务'
    const lease = '- [ ]（进行中@2026-09-25/qa）带租约的任务'
    // 正例:可选形态对裸行与租约行都成立(剥完剩正文)
    eq(bare.replace(CLAIM_MARKER_OPTIONAL_RE, ''), '没有标记的任务', '可选形态漏掉裸行')
    eq(lease.replace(CLAIM_MARKER_OPTIONAL_RE, ''), '带租约的任务', '可选形态漏掉租约行')
    // 反例(陷阱实证):naive `（进行中）?` 判据在租约行上退化成"必须含字面前缀",
    // 只吃到 `（进行中` 就停,`@日期/持有者）` 残留 —— 若分类器/剥皮器这么写,text 与 bodyOf 全被污染。
    const naive = /^- \[ \]（进行中）?\s*/
    if (lease.replace(naive, '') === '带租约的任务')
      throw new Error('naive 形态竟然正确 ⇒ 本对照失去意义,夹具需重做')
    // 我们的真实判据不受其害:
    eq(lease.replace(CLAIM_MARKER_RE, ''), '带租约的任务')
    eq(bodyOf({ full: lease }), '带租约的任务', 'bodyOf 没剥净租约标记')
    eq(bodyOf({ full: '- [x]（进行中）foo' }), 'foo', 'bodyOf 对矛盾行也没剥净')
  })
  // S6/S7 不可辨形态与假日历日:只报数不判红(判据不猜)
  check('S6 不可辨标记/假日历日计 unknown 不红', () => {
    const g = gate('- [ ]（进行中@乱码）怪行\n- [ ]（进行中@2026-02-31/qa）假日历日\n')
    eq(g.violations.length, 0)
    eq(g.summary.unknown, 2)
  })
  check('S7 有持有者无日期:只报数(年龄不可判即不猜)', () => {
    const g = gate('- [ ]（进行中/qa）只有名字的半成品\n')
    eq(g.violations.length, 0)
    eq(g.summary.holderNoDate, 1)
  })
  // S8 阈值可调:同一枚 3 天前的租约,ttl=1 红 / ttl=720 绿
  check('S8 CL1 阈值生效(ttl 收紧即红、放宽即绿)', () => {
    const doc = '- [ ]（进行中@2026-09-22/qa）三天前认领\n'
    eq(gate(doc, 1).violations.length, 1, 'ttl=1h 应红')
    eq(gate(doc, 720).violations.length, 0, 'ttl=720h 应绿')
  })
  // S9 未来日期不算过期(年龄为负)
  check('S9 未来日期不红', () => {
    eq(gate('- [ ]（进行中@2030-01-01/qa）\n').violations.length, 0)
  })
  // S10 CLI 白名单:未知开关/缺值/位置参数一律判死
  check('S10 parseArgs 白名单不静默落默认分支', () => {
    eq(parseArgs(['--push']).ok, false, '未知开关竟被放过')
    eq(parseArgs(['--plan']).ok, false, '--plan 缺值竟被放过')
    eq(parseArgs(['--ttl-hours', '0']).ok, false)
    eq(parseArgs(['--staged', '--check-gate', '--plan', 'x.md']).ok, true)
    eq(resolveTtlHours(null, '24').ttlHours, 24)
    eq(resolveTtlHours(null, 'abc').ttlHours, DEFAULT_TTL_HOURS)
    eq(resolveTtlHours(null, 'abc').warn, true, '坏 env 必须带警告,不得静默回落')
  })
  // S14 CL3 棘轮三态:同文存量只报数 / 换文案判红 / 锚点取不到判"未判定"而非通过
  check('S14 CL3 按 HEAD 存量套棘轮:存量放过、新增判红、锚点取不到不记绿', () => {
    const two = '- [x]（进行中@2026-09-25/a）甲\n- [x]（进行中@2026-09-25/b）乙\n'
    const keys = findContradictions(two).contradictions.map((v) => v.key)
    eq(keys.length, 2, '夹具本身就该含两处矛盾')
    // 锚点含两处 ⇒ 都算存量,只报数不判红(这正是 HEAD 现在的情形:归并器修好前的机械残留)
    eq(
      checkLeaseGate(two, { nowMs: NOW, ttlHours: 72, cl3Stock: keys }).violations.length,
      0,
      '存量应放过',
    )
    const g3 = checkLeaseGate(two, { nowMs: NOW, ttlHours: 72, cl3Stock: [keys[0]] })
    eq(g3.violations.length, 1, '换了文案的一处必须判红')
    eq(g3.violations[0].kind, 'CL3')
    eq(g3.cl3.stock, 1, '存量计数错位')
    eq(g3.cl3.fresh, 1, '新增计数错位')
    // 锚点取不到 ⇒ 不判红**也不得记为通过**:必须显式标 anchorUnknown
    const u = checkLeaseGate(two, { nowMs: NOW, ttlHours: 72, cl3Stock: null })
    eq(u.cl3.anchorUnknown, true, '锚点取不到必须标未判定')
    eq(u.cl3.anchorApplied, false, '未判定不得被读成"套过棘轮"')
    eq(u.cl3.total, 2, '未判定时仍要把矛盾行数量报出来,不能静默')
    // 不套棘轮(人工/取证面)⇒ 全量判红
    eq(checkLeaseGate(two, { nowMs: NOW, ttlHours: 72 }).violations.length, 2, '取证面必须全量判')
  })
  // S15 存量必须按行文本认领,不得按"前 N 条"切(镜像测试 T17 抓到过计数式切法的替换漏洞)
  check('S15 棘轮按同文认领:新增的一颗不能顶掉旧残留的名额', () => {
    const three =
      '- [x]（进行中@2026-09-25/a）甲\n- [x]（进行中@2026-09-25/b）乙\n- [x]（进行中@2026-09-25/c）丙\n'
    const ks = findContradictions(three).contradictions.map((v) => v.key)
    eq(checkLeaseGate(three, { nowMs: NOW, ttlHours: 72, cl3Stock: [] }).violations.length, 3, '锚点空 ⇒ 全红')
    eq(
      checkLeaseGate(three, { nowMs: NOW, ttlHours: 72, cl3Stock: ks }).violations.length,
      0,
      '锚点覆盖全部 ⇒ 全存量',
    )
    // 关键反例:锚点只有 乙/丙 两颗(数量=2,少于本轮 3 颗)。按"前 N 条"切 ⇒ 判红的是**丙**
    // (旧残留被算成新增)而新塞进来的甲得绿 —— 方向完全反了。按同文认领 ⇒ 红的必须是甲。
    const g = checkLeaseGate(three, { nowMs: NOW, ttlHours: 72, cl3Stock: [ks[1], ks[2]] })
    eq(g.violations.length, 1, '只该新增的那一颗红')
    eq(g.violations[0].text.includes('甲'), true, '红的必须是锚点里没有的甲,不能是旧残留')
  })
  // S11 三态向后兼容:旧输出字段一个不少
  check('S11 scanTasks 三态字段向后兼容', () => {
    const s = scanTasks(
      '- [ ] 甲\n- [ ]（进行中）乙\n- [x] ✅(2026-01-01) 丙\n- [ ]（进行中@2026-09-25/qa）丁\n',
    )
    eq(s.unclaimed.length, 1)
    eq(s.completed.length, 1)
    eq(s.inProgress.length, 2)
    eq(s.inProgress[0].format, 'legacy')
    eq(s.inProgress[1].format, 'lease')
    eq(s.inProgress[1].holder, 'qa')
    eq(s.inProgress[1].text, '丁', '租约标记没被剥进 text')
  })
  // S12 判定面四态(纯函数,构造面证明,不碰仓库):默认 head;--staged→index;
  // --worktree→worktree;两面旗同给 ⇒ 判死(不猜哪一面)。
  check('S12 pickPlanFace 四态:默认/索引/工作树/两面旗同给判死', () => {
    const f = (...flags) => pickPlanFace(new Set(flags))
    eq(f().face, 'head', '默认面必须是 HEAD')
    eq(f('--staged').face, 'index', '--staged 必须落 index 面')
    eq(f('--worktree').face, 'worktree', '--worktree 必须落磁盘人工档')
    eq(f('--staged', '--worktree').face, null, '两面旗同给不得选出一个面')
    eq(typeof f('--staged', '--worktree').error, 'string', '判死必须带原因,不静默')
    // 注入通道不参与面选择(--plan 由 main 直读磁盘文件,见其注释)。
    eq(f('--plan').face, 'head', '--plan 不该改变默认面')
  })
  /**
   * S13 CL3 的 `[x]` 必须在勾选框位置,不能"整行任意处出现 [x]"。
   * 真仓实测的假阳性把一条**合法的在途租约**判成矛盾,而 PROJECT_PLAN.md 是本门的
   * stagedTriggers 文件、那行租约又归别的会话持有 ⇒ 恒红面由判据自己造出来。
   */
  check('S13 CL3 只认勾选框位置的 [x],正文叙述里的 **[x]** 不算矛盾', () => {
    const r = findContradictions(
      [
        '- [x] ✅(2026-09-26) 翻勾未摘牌 （进行中@2026-09-25/甲票） 真矛盾必须判红。',
        '- [ ]（进行中@2026-09-26/乙票） 合法在途,正文用 **[x] 2026-09-26 已落** 叙述第 2 票。',
        '- [ ]（进行中@2026-09-26/丙票） 普通在途,不该被任何判据点名。',
      ].join('\n'),
    )
    eq(r.contradictions.length, 1, `矛盾应恰好 1 条,实到 ${r.contradictions.length}`)
    eq(r.contradictions[0].line, 1, '被点名的必须是第 1 行(真矛盾)')
    // 阳性对照:若判据被改回"整行找 [x]",第 2 行也会进来 ⇒ 本条红。这条断言就是那把尺子的牙。
    const loose = (t) => /\[[xX]\]/.test(t)
    eq(loose('- [ ]（进行中@2026-09-26/乙票） 正文 **[x] 已落**'), true, '旧写法必须命中第 2 行,否则 S13 无牙')
  })
  /**
   * S16 = S13 的同一条原则补到另一半:`（进行中…）` 落在**反引号代码段内**是在描述这个形态
   * 本身(叙述),不是挂牌。2026-09-28 HEAD 面现读 5 处"矛盾行"全是这一型假阳(真牌 0 枚)。
   * 成对断言:结构位标记**照计**(a)(c),码段内**不计**(b)(d)(e);反引号配不成对 ⇒
   * 判不出,**保守计入**并报 undeterminedCode(f)——"矛盾行 0"单独不构成证据:
   * 判据失明和仓库干净在账面上长得一模一样,所以每支"不计"都配一支"剥掉包裹必计"。
   */
  check('S16 CL3 只认结构位标记:反引号代码段内的（进行中）是叙述不计;结构位照计;判不出保守计入并点名', () => {
    // (a) 正例:结构位裸标记 × 已勾 ⇒ 仍计矛盾行(报数口径,不判红)
    eq(gate('- [x] ✅(2026-09-27)（进行中）真挂牌\n').summary.legacyContradictions, 1, '结构位标记必须照计')
    // (b) 反例:同一标记被反引号包住 ⇒ 叙述,一行都不许计
    const b = gate('- [x] ✅(2026-09-26) 说明:正文里引用 `（进行中）` 这个形态\n')
    eq(b.summary.legacyContradictions, 0, '码段内的裸标记被计成了矛盾行')
    eq(b.cl3.total, 0)
    eq(b.summary.undeterminedCode, 0, '反引号成对不该落"判不出"')
    // (c) 正例:结构位租约形态 ⇒ CL3 照红(只减误判,不放过真牌)
    eq(gate('- [x]（进行中@2026-09-25/qa）翻勾未摘牌\n').violations[0].kind, 'CL3')
    // (d) 反例:租约形态整个在码段内 ⇒ 不红;其"剥掉反引号"变体必须红 —— 否则 (d) 只是把判据调瞎
    const d = '- [x] ✅(2026-09-26) 叙述:`（进行中@2026-09-25/qa）` 是协议新写法的形式,不是挂牌'
    eq(gate(d + '\n').violations.length, 0, '码段内的租约形态被判成 CL3')
    eq(gate(d.replace(/`/g, '') + '\n').violations.length, 1, '剥掉包裹后必须计回真牌(阳性对照)')
    // (e) 双反引号码段(CommonMark 闭合串须等长)同属叙述
    eq(gate('- [x] 样例见 ``（进行中@2026-09-25/qa）`` 这种写法\n').cl3.total, 0, '双反引号码段未认')
    // (f) 反引号配不成对(截断长行)⇒ 判不出:保守计入报数,且 undeterminedCode 如实报出
    const f = gate('- [x] ✅(2026-09-26) 这行被截断:前面有个 `（进行中） 没有闭引号\n')
    eq(f.summary.undeterminedCode, 1, '配不成对的行必须计入 undeterminedCode,不得静默')
    eq(f.summary.legacyContradictions, 1, '判不出必须按"计入"处置 —— 放过就是把真敞口洗成绿')
    // 同文反引号配成对 ⇒ 计 0:证明 (f) 的红来自"判不出"的保守方向,不是判据在数反引号个数
    eq(gate('- [x] ✅(2026-09-26) 这行被截断:前面有个 `（进行中）` 结尾\n').summary.legacyContradictions, 0)
    // 混合行:码段内叙述 + 结构位真牌并存 ⇒ 结构位那颗照判(叙述不得替真牌顶名额)
    const mix = gate('- [x] ✅(2026-09-26) 形如 `（进行中）` 的写法之外,（进行中@2026-09-26/qa） 是真牌\n')
    eq(mix.violations.length, 1, '混合行里结构位的租约牌被码段里的叙述顶掉了')
    eq(mix.violations[0].kind, 'CL3')
  })
  /**
   * S17(2026-10-16 补):`--twins` 第二段旧文案自称"**逐字重复**的未勾行组",而判据
   * `findDuplicateGroups` 归组用的键是 `squash(bodyOf(row))` —— 行首状态、认领/租约标记与空白
   * 都被剥掉了。真仓 HEAD 面现读:被归组的 15 组里 **14 组两行并不逐字节相同**,差的字节正是
   * `（进行中…）` 租约。谎称"逐字相同"的代价是有人照着这句话去删行,而 §1 明令"门绝不自动摘除
   * 任何人的认领" —— 租约字节正是要害证据。成对断言:骨架同而字节异 ⇒ **照归组**(证明文案不得
   * 自称整行逐字),骨架异 ⇒ 不归组(证明归组不是恒真);再锁报名本身含骨架口径与逐字节档的出路。
   */
  check('S17 骨架相同组不得谎称整行逐字相同(租约字节是 §1 活证据)', () => {
    // 正文必须长过容器下界 CONTAIN_MIN(现读 20 个非空白字符)—— 短正文被下界挡掉是**设计**,
    // 拿它当夹具只会量到下界而不是量到归组判据(2026-10-16 首轮就踩在这上面:期望 1 实得 0)。
    const BODY = '冷启动抢跑全仓盘点余量甲任务的正文骨架需要长过容器下界'
    const OTHER = '冷启动抢跑全仓盘点余量乙任务的正文骨架需要长过容器下界'
    eq(BODY.replace(/\s/g, '').length >= 20, true, '夹具长度不足容器下界,本臂无牙')
    const same = scanTasks(`- [ ] ${BODY}\n- [ ]（进行中） ${BODY}\n`)
    const groups = findDuplicateGroups([...same.unclaimed, ...same.inProgress])
    eq(groups.length, 1, '骨架相同而一枚带裸标记的两行未被归组')
    const fulls = [...same.unclaimed, ...same.inProgress].map((r) => r.full)
    eq(fulls.length, 2, '夹具两行都得被 scanTasks 认出来')
    eq(fulls[0] === fulls[1], false, '夹具本身必须确实不等字节,否则本臂无牙')
    const diff = scanTasks(`- [ ] ${BODY}\n- [ ] ${OTHER}\n`)
    eq(findDuplicateGroups([...diff.unclaimed, ...diff.inProgress]).length, 0, '不同正文竟被归成一组')
    eq(DUP_GROUP_HEADING.includes('骨架'), true, '报名未说明量的是正文骨架')
    eq(DUP_GROUP_HEADING.includes('fold-identical-open-rows'), true, '报名未点名整行逐字节相同那条出路')
    eq(DUP_GROUP_HEADING.includes('逐字重复的未勾行组'), false, '那句谎话仍在报名文案里')
  })
  check('S18 弱相似(只到 SIM_THRESHOLD 而未逐字包住)不得从可认领里扣名额', () => {
    const t = [
      { line: 1, twinLine: 9, via: 'contain', score: 0.4 },
      { line: 2, twinLine: 8, via: 'both', score: 0.8 },
      { line: 3, twinLine: 7, via: 'jaccard', score: 0.61 },
      { line: 4, twinLine: 6, via: 'jaccard', score: 0.75 },
      { line: 5, twinLine: 5, via: 'same-title', score: 0.42 },
    ]
    const { proven, suspect } = splitTwinsByProof(t)
    eq(proven.map((r) => r.line).join(','), '1,2,5', '可证两通道(逐字包住 / 同题不同编号)都必须进可证档')
    eq(suspect.map((r) => r.line).join(','), '3,4', '只到相似度的两条必须落弱证据档')
    eq(proven.length + suspect.length, t.length, '两档不穷尽 ⇒ 要么名额被悄悄扣掉,要么孪生漏报')
    const rows = [{ line: 1 }, { line: 2 }, { line: 3 }, { line: 4 }, { line: 5 }, { line: 6 }]
    eq(
      subtractProvenTwins(rows, proven).map((r) => r.line).join(','),
      '3,4,6',
      '弱证据那两条被扣了名额 —— 那条真待办就此对派单永久隐形(本臂防的就是这一型)',
    )
    // same-title 那条通道的取材取证:除主键位置编号外**逐字节相同** ⇒ 可证(真仓 L15375↔L10358 那一型)
    const twin =
      `- [ ] G-998128 票 4（观察）Windows Path 双键收口:往子进程 env 塞大写 PATH 的两处站点无归一层 —— 机制与出处略
- [x] ✅(2026-10-16) G-147 票 4（观察）Windows Path 双键收口:往子进程 env 塞大写 PATH 的两处站点无归一层 —— 机制与出处略
`
    const st = splitTwinsByProof(findClosedTwins([...scanTasks(twin).unclaimed], scanTasks(twin).completed))
    eq(st.proven.length, 1, '除编号外逐字节相同的让号遗留没被判成可证孪生(该通道取材断了)')
    eq(st.proven[0].via, 'same-title', '同题不同编号必须走 same-title 档,不得冒充逐字包住')
    eq(st.suspect.length, 0, '可证那对掉进了弱证据档')
    // 反向(镜像 T2 同型):同一前缀、尾部讲另一件事 ⇒ 两档可证通道都不许接上
    const near =
      `- [ ] G-301 冷启动抢跑全仓盘点余量:甲线已清完 A 类 23 页并登记了回执行号
- [x] ✅(2026-10-16) G-118 冷启动抢跑全仓盘点余量:乙线只剩 C 类 42 处待按需推进
`
    const stN = splitTwinsByProof(findClosedTwins([...scanTasks(near).unclaimed], scanTasks(near).completed))
    eq(stN.proven.length, 0, '同前缀而尾部讲另一件事的两条被证成了"同一条活" —— 真活就此被扣掉名额')
    // 只剥主键位置那一枚,绝不抹掉正文里的数字(web 86 处 vs web 99 处 必须是两条活)
    eq(
      keyIdStripped('- [ ] G-147 票 4 甲正文') === keyIdStripped('- [ ] G-998128 票 4 甲正文'),
      true,
      '除编号外逐字节相同的两行没被判等 ⇒ same-title 通道无牙',
    )
    eq(
      keyIdStripped('- [ ] web 86 处内的键名对齐') === keyIdStripped('- [ ] web 99 处内的键名对齐'),
      false,
      '编号剥法越界:正文里的数字也被抹掉了 ⇒ 两条不同的活会被洗成一条',
    )
    // 端到端正向对照:被 [x] 行**逐字包住**的未勾行仍照扣 —— 放宽只砍弱通道,没把可证那一档也放行
    const BODY = '冷启动抢跑全仓盘点余量甲任务的正文骨架需要长过容器下界'
    const e2e = scanTasks(`- [ ] ${BODY}\n- [x] ✅(2026-10-16) ${BODY},取证:末行原文 RC=0\n`)
    const tw = findClosedTwins([...e2e.unclaimed, ...e2e.inProgress], e2e.completed)
    const e2eSplit = splitTwinsByProof(tw)
    eq(e2eSplit.proven.length, 1, '逐字包住的那条没被判成可证孪生')
    eq(
      subtractProvenTwins(e2e.unclaimed, e2eSplit.proven).length,
      0,
      '可证孪生没从可认领里扣掉(那"接了就是白干"这一维就失效了)',
    )
  })
  for (const r of results) console.log(r)
  console.log(`--self-test: ${results.length - failures}/${results.length} 通过`)
  return failures
}

function main(argv = process.argv.slice(2), nowMs = Date.now()) {
  const parsed = parseArgs(argv)
  if (!parsed.ok) {
    console.error(`❌ ${parsed.error}\n${USAGE}`)
    process.exit(2)
  }
  if (parsed.flags.has('--self-test')) {
    process.exitCode = selfTest(nowMs) === 0 ? 0 : 1
    return
  }
  const planPath = parsed.plan ? resolve(process.cwd(), parsed.plan) : PLAN_PATH
  let content
  let faceLabel
  let planFace = null
  if (parsed.plan) {
    // 注入通道:读的就是那个磁盘文件本身(取证夹具的唯一合法形态,见文件头判定面一节)。
    try {
      content = readFileSync(planPath, 'utf-8')
    } catch (e) {
      console.error(
        `❌ 无法读取注入文档 ${planPath}: ${e.message}(输入取不到 = 无法判定,不冒红也不记绿)`,
      )
      process.exit(2)
    }
    faceLabel = `${PLAN_FACE_LABEL.plan} ${parsed.plan}`
    planFace = 'plan'
  } else {
    const picked = pickPlanFace(parsed.flags)
    if (picked.error) {
      console.error(`❌ ${picked.error}(两个判定面互斥,取哪一面都会让另一面成为假绿)\n${USAGE}`)
      process.exit(2)
    }
    const read = readPlanOnFace(picked.face)
    if (read.error) {
      console.error(`❌ ${read.error}(输入取不到 = 无法判定,不冒红也不记绿)`)
      process.exit(2)
    }
    content = read.content
    faceLabel = PLAN_FACE_LABEL[picked.face]
    planFace = picked.face
  }
  const ttl = resolveTtlHours(parsed.ttlHours, process.env[TTL_ENV])
  if (ttl.warn) console.warn(`⚠ ${ttl.source}`)
  const { unclaimed, inProgress, completed } = scanTasks(content)
  const { counts: leaseCounts } = analyzeLeases(inProgress, { nowMs, ttlHours: ttl.ttlHours })

  if (parsed.flags.has('--check-gate')) {
    /**
     * CL3 棘轮锚点。`head` 面**直接用本轮已读到的那份内容**取,而不是另开一次 `HEAD:` 读 ——
     * 那等于拿被审判的内容当它自己的对照基准:内容里多出几颗矛盾行,锚点会跟着一起涨,
     * 棘轮当场变成一台"永远追不上"的尺子(镜像测试 T17 抓到的是另一型:按"前 N 条"切存量
     * 会让新增的那颗顶掉一颗旧残留的名额,两者都得绿)。
     * `index` 面才需要真读 HEAD;读不到 ⇒ 传 null,门会喊"未判定"而不是冒绿。
     */
    let cl3Stock
    if (planFace === 'head') cl3Stock = findContradictions(content).contradictions.map((v) => v.key)
    else if (planFace === 'index') {
      const h = readPlanOnFace('head')
      cl3Stock = h.error ? null : findContradictions(h.content).contradictions.map((v) => v.key)
    } else cl3Stock = undefined
    /**
     * CL1 棘轮锚点(2026-09-29):同一套面规则,取的是"HEAD 面、同一个 nowMs 与阈值量到的过期租约行文本"。
     * 判据本身一字未放宽(阈值、租约形态、点名内容全部照旧),只是**把时钟自己造出来的那批红**
     * 归成存量报数 —— 否则本门在干净 HEAD 上恒红,而它是 PROJECT_PLAN.md 的 blocking 触发门。
     */
    const staleTextsOf = (text) =>
      analyzeLeases(scanTasks(text).inProgress, { nowMs, ttlHours: ttl.ttlHours }).stale.map((v) => v.text)
    let cl1Stock
    if (planFace === 'head') cl1Stock = staleTextsOf(content)
    else if (planFace === 'index') {
      const h = readPlanOnFace('head')
      cl1Stock = h.error ? null : staleTextsOf(h.content)
    } else cl1Stock = undefined
    runCheckGate(parsed.flags, content, {
      nowMs,
      ttlHours: ttl.ttlHours,
      ttlSource: ttl.source,
      faceLabel,
      cl3Stock,
      cl1Stock,
    })
    return
  }

  const twins = findClosedTwins([...unclaimed, ...inProgress], completed)
  const { proven: provenTwins, suspect: suspectTwins } = splitTwinsByProof(twins)
  const claimable = subtractProvenTwins(unclaimed, provenTwins)
  const dupGroups = findDuplicateGroups([...unclaimed, ...inProgress])
  const dupExtra = dupGroups.reduce((n, g) => n + g.length - 1, 0)

  if (parsed.flags.has('--twins')) {
    console.log(
      `已闭环 [x] 行的未勾孪生旧行 —— 可证(骨架被那条 [x] 行逐字包住,或**除主键位置编号外逐字节相同**) ${provenTwins.length} 条 ⇒ 接了就是白干,已从"可认领"扣名额:`,
    )
    for (const t of provenTwins) {
      console.log(
        `  L${t.line} ↔ 已勾 L${t.twinLine}  (${t.via}${t.via === 'both' ? ` ${t.score.toFixed(2)}` : ''}) ${t.text}`,
      )
    }
    console.log(
      `  ⚠️ 相似度只到 SIM_THRESHOLD(现读 ${SIM_THRESHOLD})而**两档可证通道都没接上**的 ${suspectTwins.length} 条 —— 弱证据:照点名,**不扣名额**(拿不准的留在派单面,同 plan-tasks 的"剔除按正文推导,拿不准的留在清单里").要结清它:两行除编号外仍有一字之差 ⇒ 无法机器证明是同一条,与那条 [x] 行按**标题锚点**人工对齐后再走 node scripts/plan-tasks-merge.mjs --fold-twins(同题不同编号折叠);相似度不得替"同一条活"作证:`,
    )
    for (const t of suspectTwins) {
      console.log(`  L${t.line} ↔ 已勾 L${t.twinLine}  (jaccard ${t.score.toFixed(2)}) ${t.text}`)
    }
    console.log(
      `\n${DUP_GROUP_HEADING} (${dupGroups.length} 组,多出 ${dupExtra} 条)`,
    )
    for (const g of dupGroups) console.log(`  ${g.map((l) => `L${l}`).join(' = ')}`)
    console.log(`判定面:${faceLabel}`)
    return
  }

  if (parsed.flags.has('--json')) {
    console.log(
      JSON.stringify(
        {
          face: faceLabel,
          unclaimed,
          inProgress,
          completed,
          closedTwins: twins,
          closedTwinsProven: provenTwins,
          closedTwinsSuspect: suspectTwins,
          duplicateGroups: dupGroups,
          totals: {
            unclaimed: unclaimed.length,
            inProgress: inProgress.length,
            completed: completed.length,
            closedTwins: twins.length,
            closedTwinsProven: provenTwins.length,
            closedTwinsSuspect: suspectTwins.length,
            duplicateExtra: dupExtra,
            claimable: claimable.length,
          },
          leases: { ttlHours: ttl.ttlHours, ...leaseCounts },
        },
        null,
        2,
      ),
    )
    return
  }

  if (parsed.flags.has('--unclaimed')) {
    console.log(
      `无人认领任务 (${claimable.length};另有 ${unclaimed.length - claimable.length} 条可证为已闭环行的旧副本(骨架被逐字包住 / 除编号外逐字节相同)⇒ 已扣名额;相似度只到阈值而未被逐字包住的仍在本清单内,见 --twins):`,
    )
    for (const t of claimable) console.log(`  L${t.line}: ${t.text}`)
    console.log(`判定面:${faceLabel}`)
    return
  }

  if (parsed.flags.has('--in-progress')) {
    console.log(`进行中任务 (${inProgress.length}):`)
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}${claimDisplaySuffix(t)}`)
    console.log(`判定面:${faceLabel}`)
    return
  }

  // 默认: 汇总
  console.log('='.repeat(60))
  console.log('  PROJECT_PLAN.md 任务认领状态')
  console.log('='.repeat(60))
  console.log()
  console.log(
    `  无人认领:  ${unclaimed.length}(其中 ${unclaimed.length - claimable.length} 条**可证**为已闭环 [x] 行的旧副本(骨架被逐字包住 / 除编号外逐字节相同)⇒ **可认领 ${claimable.length}**;弱相似而两档可证通道都没接上的 ${suspectTwins.length} 条**不扣名额**、仍在清单内(见 --twins);正文骨架相同组 ${dupGroups.length},不等同整行逐字节 —— 见 --twins)`,
  )
  console.log(
    `  进行中:    ${inProgress.length}(旧格式无租约 ${leaseCounts.legacy} / 形态不可辨 ${leaseCounts.unknown} / 有持有者无日期 ${leaseCounts.holderNoDate};租约到期判红见 --check-gate)`,
  )
  console.log(`  已完成:    ${completed.length}`)
  console.log(`  合计:      ${unclaimed.length + inProgress.length + completed.length}`)
  if (twins.length || dupGroups.length) {
    console.log('  ⚠️ 按行首分类会把"翻勾后留下的旧副本"当成一件活 —— 派单前先跑 --twins 看一眼,')
    console.log(
      '     否则已闭环的项会被重复认领(2026-09-25 实测:未认领 115 条里 22 条有已勾近亲)。',
    )
  }
  console.log()

  if (inProgress.length > 0) {
    console.log('─ 进行中 ─')
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  }

  if (unclaimed.length > 0 && unclaimed.length <= 30) {
    console.log('─ 无人认领 ─')
    for (const t of unclaimed) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  } else if (unclaimed.length > 30) {
    console.log(`─ 无人认领 (${unclaimed.length} 项,前 15) ─`)
    for (const t of unclaimed.slice(0, 15)) console.log(`  L${t.line}: ${t.text}`)
    console.log(`  ... 还有 ${unclaimed.length - 15} 项`)
    console.log()
  }
  console.log(`判定面:${faceLabel}`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}

// G-1102638 批3(2026-10-08):租约过期语义的**唯一出口** —— plan-copy-row-purge 的批3档复用
// 本门的 scanTasks / analyzeLeases / resolveTtlHours / TTL_ENV 判「租约已过期」,
// 不自拼第二份 72h 公式(同一规矩两份实现必漂,本仓三条头注都记过这一型事故)。
// 纯增量导出:零行为面变化(main / self-test / __test__ 一字未动)。
export { scanTasks, analyzeLeases, resolveTtlHours, TTL_ENV }

export const __test__ = {
  scanTasks,
  findClosedTwins,
  findDuplicateGroups,
  /** S17 锁的是"报名文案不得比判据强一档",镜像测试要读同一份文案,不许在测试里另写一句。 */
  DUP_GROUP_HEADING,
  /** S18:证据分档与"只扣可证那一档"的减法,镜像测试走同一份实现(§22c)。 */
  splitTwinsByProof,
  keyIdStripped,
  subtractProvenTwins,
  bodyOf,
  parseClaim,
  analyzeLeases,
  findContradictions,
  codeSpanRangesOf,
  insideCodeSpan,
  checkLeaseGate,
  parseArgs,
  resolveTtlHours,
  isValidIsoDate,
  selfTest,
  pickPlanFace,
  readPlanOnFace,
  PLAN_FACE_LABEL,
  CLAIM_MARKER_RE,
  CLAIM_MARKER_OPTIONAL_RE,
  DEFAULT_TTL_HOURS,
  TTL_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
