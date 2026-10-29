#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 台账专项落地工具为 CLI,需 console 输出 */
/**
 * plan-copy-row-purge.mjs —— 同主键副本行**物理归并**(批1,2026-10-08 立)
 *
 * 票:G-1102638。机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕—— §1 规矩2「只登记不删行」
 * 自本票起收窄为「同主键副本行经本器判删,真删不留占位」;可溯性由 git 历史与本器的
 * 逐行留痕 jsonl 共同承担。动因:账面 1623 行未勾里 463 组复合主键摊 ~3.5 行/任务,
 * 大头是 1160 行【归并】副本 + 行首「副本指针(编号…)」族,一行一任务从此成立。
 *
 * 批1删除对象(**逐行独立判,六条全过才删**,宁可漏删不可误删):
 *   ① `isClaimExcludedPointer(raw)` 命中 —— 行自述"我是副本"(行首「副本指针(编号…)」族
 *      ∪ 正文「【归并】重复登记副本」族,判据唯一出口 lib/plan-task-index.mjs);
 *   ② 不带落账注记(`MERGE_NOTE_RE` 不命中)—— 带〔【归并】…落账:复测…〕的行是批2对象:
 *      F5 差值棘轮(grewViolations)是提交链上的拦点,批1删它必红,批2须配套判据修改,不混做;
 *   ③ 无租约(`claim` 假)—— 租约行是活账,永不删;
 *   ④ 副本有"接收方":
 *      - 【归并】族:同复合主键组(`keyOfRow` 编号+标题逐字等值)内存在**幸存者**
 *        (open ∧ 无副本标记 ∧ 无租约 ∧ 异行)—— 组内不删空;
 *      - 行首指针族:自述指向编号 N(`副本指针(编号 N)`),新面仍存在编号 N 的 open 行 —— 指向不悬空;
 *      - 行首指针族**第三档(④c,2026-10-24 设计/2026-10-29 按 HEAD 结构重新接线)**:新面**已无**
 *        编号 N 的 open 行,而归档面(`.ihui-agent/archive/PROJECT_PLAN_*.md`,与台账同取 HEAD 树)上
 *        该编号的登记行**全部已勾** ⇒ 陈旧悬空指针,可删,凭复合主键点名到归档件。归档面上还有
 *        未勾行 ⇒ 删指针 = 丢唯一活登记,拒删;归档面查无此编号或取不全 ⇒ 一律拒删(判不出 ≠ 可删)。
 *        实现唯一出口 = `pointerTargetVerdict`(台账面 → 归档面 → 未判定,三段逐级保守),拒删逐条
 *        进 rejectLog。
 *      - 行首指针族·**枚回执档 ④d**(2026-10-26 立于 `7160346576`/`91ead7dd14`,被 `1fe3a2b42d` 的
 *        −790 行整体回退抹掉;2026-10-30 按 HEAD 结构重施加,判据强度照原设计,不放宽任何一档):
 *        归档面也查不到的指针分两型,不得混为一谈 —— **行号+枚 sha 型**(`副本指针(编号 L6880)` 且
 *        行内自带 `(枚 <shaToken>)`)指向的不是登记编号而是**创建时刻台账快照里的行号**;这型被 ④c
 *        结构性挡死(编号面永远查不到 `L6880` 的登记行),而它的"主行已结清"在 git 对象库里逐字可验:
 *          (a) 指向 token 是行号形态(`/^L\d+$/`,行号只对当时那枚成立,这正是枚凭据存在的理由);
 *          (b) 行内枚 token 经**注入的** `resolveSnapshot` 解析得到台账快照(取不到 ⇒ 判不出=拒删;
 *              判据层不碰真 git 面,与 ④c 不读盘同一条纪律);
 *          (c) 快照该行是真复选框行 ∧ state=done(快照行号会漂,只有"当时确实是它"才作数);
 *          (d) 行内账上编号(四档取材:`keyOfRow` → `keyInWindow(titleOf)` → 首段加粗题面 → 剥行首
 *              副本措辞后的 72 字宽窗;宽窗内 ≥2 个不同 token 判不出)在现行登记面**无本批之外的
 *              open 正主** —— 自述副本行不成正主,与派单出口 `isClaimExcludedPointer` 同一把尺;
 *          (e) 现行面账上编号至少一条**可点名的结清凭据**(`<!--` 注释墓碑 ∧ ✅/已归档,或 done
 *              勾选行)—— "没找到活的"不等于"找到了结清的",凭据取不到 ⇒ 拒删。
 *        任一前提不成立一律维持 archive-absent(拒删)并点名;失效方向恒为"多留一行"。
 *        **裸行号型(无枚 token)照旧不可删** —— 没有可解析的快照,行号无凭据 = 判不出。
 *        判定唯一出口 = `commitReceiptVerdict`(纯函数);通道未注入 ⇒ 行为逐字退回补档前。
 *        (本仓现行只接**指针族**这一格;原设计里的 ④b-rc 同链臂【归并】族现面无其靶行,未接线。)
 *   ⑤ 行所属主键组不在 F9 撞号声明组(撞号组的"同主键"语义被污染,归撞号链管,G-312);
 *   ⑥ 不在 F1 forkOpenLines(与 auditPlan 同口径;现读 0 组,保险档)。
 *
 * 幸存者选择与 F4 既有规则同向(lib :620 "幸存者取正文最长者,等长取行号靠后")——批1只判
 * "存在幸存者"不挑具体行,批2 归并正文时再按同一规则择优。
 *
 * 批2(--include-settled,2026-10-08 同日):判据②反转 —— **只**清带〔【归并】…落账:复测…〕
 * 注记的行(①不再强制:注记本身就是副本自述),③④⑤⑥同守。前置配套(G-1102638 批2 判据面):
 *  - plan-tasks.mjs grewViolations 加 absFloor 绝对下限豁免(gate 调用点传基线 base?.F5,
 *    缺省旧行为逐字不变)+ 基线 F5 21→0 —— 注记形态随物理归并退役,差值 F5 与存续性 F5
 *    同批交出看守职责(登记行防丢归门 71,留痕 md 在豁免面);
 *  - 安全阀 2 的 mergeNotes 对账随档切换:批1"不变"、批2"降幅 === 被删行行级注记和"。
 *
 * **批2 侦察证伪与拍板(2026-10-08,机主拍板〔拍板@2026-10-08 机主:注记留原地,判据退役收口〕)**:
 * dry-run 实测候选 0 行 —— 面级 405 条落账注记**全部住在 109 行「已归档」墓碑注释行内**
 * (`<!-- 已归档(…,随块带走的归并落账注记: …,完整内容在 …md -->`,归档器 placeholderLine
 * :457 刻意"随块带走"的契约产物),不在任何任务行上;早前"405 条行"是把面级注记条数误当行数。
 * 墓碑是归档基础设施的判据锚点(ledger-move-aware 靠"占位代表"防已归档条目整批误回捞;
 * check-delivery-report-consistency 靠它做归档章节豁免),删除 = 破坏防误回捞链,机主拍板
 * **注记留原地**。本器 --include-settled 档保留不删 —— 它面向的是"任务行上真有注记"的未来形态,
 * 对墓碑内注记结构性不命中(selectCopyRowsToPurge 只吃 parseTaskRows 任务行,墓碑注释行不在其中,
 * 双保险)。F5 判据退役照常收口(基线 F5=0 + absFloor),台账清理的真尾巴 = 剩余同键多行逐组裁决
 * (另批)。
 *
 * 批3(--expired-lease,2026-10-08):**六判据联用档** —— 机主硬约束「处理过期租约副本时,仅删除
 * 自述副本行(自述副本/不带落账注记/无租约/有接收方/非F9撞号/非F1分叉六条全过),保留带落账注记
 * 的副本行和租约在飞的副本行」。判据③由「无 claim」收窄为「无**有效**租约」:claim 缺失(批1剩余面)
 * 或租约已过期。过期语义**唯一出口** = 租约门 check-task-claims 的 analyzeLeases(72h 阈值,
 * env IHUI_CLAIM_LEASE_TTL_HOURS 可调;legacy/形态不可辨/有持有者无日期一律视为有效,只保留不判)——
 * 不自拼第二份公式。本器只清过期租约行里的**自述副本**;过期租约的**任务行本体**绝不代摘
 * (CL1 棘轮语义:存量归各行持有者清账/续租/翻勾),删行只是把「过期租约+自述副本」的行从
 * 两者交集里请出账面,主键信息在幸存者行完整保留。批2/批3 两档互斥(①与②的取舍方向相反)。
 *
 * 安全阀(全机器核,不靠人眼;仿 plan-tasks-merge 的四条 + 归档器的对象空间通道):
 *   - 行数对账:new = old − deleted;未删行按行号对齐**逐字不变**;
 *   - 复跑 auditPlan(newContent):F1 必须 === 0;dupPointerRows 必须下降;mergeNotes 必须不变
 *     (批1不碰落账注记);F9 声明组数不得增加(删行不造新键);
 *   - 门71模拟:每个被删行的编号 token 在新面仍有登记行(行首编号或加粗标记,判活同源);
 *   - CAS:parent = 现读 HEAD,`writeBlob → commitTreeWithIndex → casUpdateRef`(plumbing 唯一
 *     实现 lib/bypass-git.mjs;防覆盖:cas 失败即停不重试,交人看面);
 *   - 幂等:删除集为 0 ⇒ 报"无可删行" exit 0(重跑安全)。
 *
 * 留痕:删除清单逐行落 `.ihui-agent/archive/PROJECT_PLAN_copy-purge-<day>.md`(**md 形态**,
 * 守门 71 归档豁免只认该目录 PROJECT_PLAN_*.md;jsonl 留痕被 --heal 回捞过,2026-10-08 实证),
 * 与正文同笔提交 —— 真删不等于无痕,账逐条对得回来。
 *
 * 用法:
 *   node scripts/plan-copy-row-purge.mjs --dry-run                    # 批1档预演
 *   node scripts/plan-copy-row-purge.mjs --apply                      # 批1档对象空间 CAS 真落
 *   node scripts/plan-copy-row-purge.mjs --include-settled --dry-run  # 批2档预演(清落账注记行)
 *   node scripts/plan-copy-row-purge.mjs --include-settled --apply    # 批2档真落
 *   node scripts/plan-copy-row-purge.mjs --expired-lease --dry-run    # 批3档预演(过期租约自述副本)
 *   node scripts/plan-copy-row-purge.mjs --expired-lease --apply      # 批3档真落
 *   node scripts/plan-copy-row-purge.mjs --self-test                  # 判据纯函数自检(零派生、零副作用)
 */

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch } from './lib/face-reader.mjs'
import {
  archiveFaceEntries,
  bodyOfRow,
  COPY_POINTER_ROW_RE,
  DUP_POINTER_RE,
  isClaimExcludedPointer,
  KEY_MAX_OFFSET,
  keyInWindow,
  keyOfRow,
  MERGE_NOTE_RE,
  parseTaskRows,
  titleOf,
  compositeKeyOf,
  findForks,
  f9Faces,
} from './lib/plan-task-index.mjs'
import {
  alignSharedIndex,
  attestBypassCommit,
  casUpdateRef,
  commitTreeWithIndex,
  git,
  resolveHeadRef,
  writeBlob,
} from './lib/bypass-git.mjs'
// 批3:租约过期语义唯一出口(头注「批3」段)—— 不自拼 72h 公式。
import { analyzeLeases, resolveTtlHours, scanTasks, TTL_ENV } from './check-task-claims.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LEDGER = 'PROJECT_PLAN.md'
const LEDGER_REL = `HEAD:${LEDGER}`

/** 行首指针族的指向编号提取:`副本指针(编号 62)` / `(编号 4·观察期)` 全半角括号都收。 */
export function pointedIdOf(raw) {
  const m = /副本指针\s*[（(]编号\s*([^）)\n]{1,24})[）)]/.exec(raw)
  return m ? m[1].trim() : null
}

/**
 * ④d 枚回执:指针行自述的创建时刻枚 token(`(枚 290a26bc1)`/`枚 abc1234def…`,7-40 位十六进制,
 * 取**行内第一个**)。判据只信 sha 不信行号本身 —— 行号只对当时那枚成立,枚凭据就是它的解析坐标。
 */
export function receiptTokenOf(raw) {
  const m = /枚\s*([0-9a-f]{7,40})/.exec(String(raw))
  return m ? m[1] : null
}

const hasCopyMark = (raw) => isClaimExcludedPointer(raw)
// MERGE_NOTE_RE 字面量带 g 标志(lib :1092 归并注记计数同源)⇒ 直接 .test() 会共享 lastIndex,
// 连续调用呈"一次真一次假"的交替漂移 —— 批1判据②用它做排除、批2用它做选择,都吃这一口。
// 每次现拼无 g 正则(仅 source,无状态);面级计数处(new RegExp(source,'g') match)本就无状态。
const hasSettledNote = (raw) => new RegExp(MERGE_NOTE_RE.source).test(raw)

/**
 * 指针里的指向编号拆成「编号 + 题面收窄串」:`副本指针(编号 4·观察期)` ⇒ `{ id:'4', hint:'观察期' }`。
 * `·` 之后是人写的题面前缀,用来挡住**同编号不同议题**的误配(编号一旦复用,只按编号找接收方
 * 会把 A 的指针挂到 B 的主行上 ⇒ 指针被删而活登记丢失)。无 `·` 时 hint=null(整串即编号)。
 */
export function splitPointedId(pointed) {
  const s = String(pointed ?? '').trim()
  if (!s) return { id: null, hint: null }
  const at = s.indexOf('·')
  if (at < 0) return { id: s, hint: null }
  const id = s.slice(0, at).trim()
  const hint = s.slice(at + 1).trim()
  return { id: id || null, hint: hint || null }
}

/**
 * 归档件侧的**字面编号位**:剥掉复选框装饰与前导强调符后的第一段(`62. 会话…` → `62`,
 * `P1-① 扩共享层…` → `P1-①`)。
 *
 * 刻意**不做编号语法判定**:编号是什么的唯一真相源仍是 `keyOfRow`;本函数只解决它给不出键的族
 * (如 `P1-①` —— 现读 keyOfRow 返回 null)在归档面的落点。因此匹配条件恒为**逐字等值**
 * (`token === 指针里的编号`),不含相似度、不含前缀猜测 —— 与 `compositeKeyOf` 同一条纪律。
 */
export function leadingTokenOf(raw) {
  const body = bodyOfRow(raw)
  if (typeof body !== 'string') return null
  const m = /^[\s*_`]*(\S+?)[\s*_`:：.。()（）]/.exec(body) ?? /^[\s*_`]*(\S+)$/.exec(body)
  return m ? m[1] : null
}

/** ④c 的归档面索引:吃 `[{ path, text }]`(与 `archiveFaceEntries().entries` 同形)。
 *
 * 三态纪律(§0.3):任一归档件正文缺席 ⇒ `ok:false`,调用方必须落「未判定」而不是「零份」——
 * 把"取不到"读成"没有"正是本档要防的失效型(那样会判成 archive-absent 而非 archive-undetermined)。
 * 行号是**跨文件累计**的(与 `parseTaskRows` 的单文件行号区分),只用于留痕点名,不参与判据。
 */
export function buildArchiveIndex(entries) {
  const list = Array.isArray(entries) ? entries : []
  const ok = list.every((e) => typeof e?.text === 'string')
  const rows = []
  const byId = new Map()
  let offset = 0
  for (const e of list) {
    if (typeof e?.text !== 'string') continue
    for (const r of parseTaskRows(e.text)) {
      const token = leadingTokenOf(r.raw) ?? r.key
      if (!token) continue
      const rec = {
        path: String(e.path ?? ''),
        line: offset + r.line,
        raw: r.raw,
        state: r.state,
        key: r.key ?? null,
        title: titleOf(r.raw) ?? null,
        composite: compositeKeyOf(r.raw) ?? null,
      }
      rows.push(rec)
      if (!byId.has(token)) byId.set(token, [])
      byId.get(token).push(rec)
    }
    offset += e.text.split(/\r?\n/).length
  }
  return {
    ok,
    rows,
    byId,
    files: list.filter((e) => typeof e?.text === 'string').map((e) => String(e.path ?? '')),
  }
}

/** 题面前缀收窄:有 hint 时标题(唯一取法 = `titleOf`,与复合主键同源)必须**逐字**以它起头;
 *  判不出题面 ⇒ 不算命中(宁可漏删)。台账行由 `parseTaskRows` 产出,不带 title 字段 ⇒ 现算。 */
const titleMatchesHint = (hint, rec) => {
  if (!hint) return true
  const t = rec?.title ?? (typeof rec?.raw === 'string' ? titleOf(rec.raw) : null)
  return typeof t === 'string' && t.startsWith(hint)
}

/**
 * ④d 行首登记面索引(纯函数):现行台账逐行的"是否复选框行 + 缩进去向"。
 * `lineRows` 缺席的档 = 该行不是登记行(注释/散文/空)——注释化墓碑就住在这一档,
 * 墓碑行内的 `✅`/`已归档` 是归档器结清契约的可见证据。
 */
export function buildLedgerFaceIndex(content) {
  const rows = parseTaskRows(String(content ?? ''))
  const lineRows = new Map()
  const lines = String(content ?? '').split(/\r?\n/)
  const openByKey = new Map()
  for (const r of rows) {
    lineRows.set(r.line, r)
    if (r.state === 'open' && r.key) {
      if (!openByKey.has(r.key)) openByKey.set(r.key, [])
      openByKey.get(r.key).push(r)
    }
  }
  return { ok: rows.length > 0 || lineRows.size === 0, lines, lineRows, openByKey, rows }
}

/**
 * ④d 枚回执判定(纯函数,唯一实现;自 `91ead7dd14` 的原设计逐字移植,判据强度不降)。
 * 前提逐条,任一不成立 ⇒ 交回原 archive-absent(拒删):
 *  (a) 指向 token 为行号形态 `L<数字>`;
 *  (b) 行内枚 token 经 `resolveSnapshot` 解析得到台账快照(取不到=判不出);
 *  (c) 快照该行是真复选框行 ∧ state=done(快照行号会漂,只有"当时确实是它"才作数);
 *  (d) 账上 token(行内四档取材的编号):现行登记面**无本批之外的 open 正主**
 *      —— 自述副本行不成正主,与派单出口同一把尺;
 *  (e) 现行面该账上编号至少一条可点名的结清凭据(`<!--` 注释墓碑 ∧ ✅/已归档,或 done 勾选行)。
 * `opts2 = { resolveSnapshot, ledgerFace, deletedRowLines }` 缺 resolveSnapshot/ledgerFace ⇒ 返回
 * null(通道未启用,调用方逐字退回 ④c 原判定)。
 */
export function commitReceiptVerdict(row, pointed, opts2, noPointerCheck = false) {
  if (!opts2?.resolveSnapshot || !opts2?.ledgerFace) return null
  if (!noPointerCheck && !/^L\d+$/.test(pointed)) return null
  const token = receiptTokenOf(row.raw)
  if (!token) return null
  const snapshot = opts2.resolveSnapshot(token)
  if (typeof snapshot !== 'string' || snapshot === '') {
    return { verdict: 'archive-absent', pointed, detail: [`枚 ${token} 快照取不到(判不出)`] }
  }
  // 行号取材:指针行用括注 `（编号 L…）`;自述副本行(没有括注形态,④b-rc 档)退到
  // "同标题登记 LNNNN"字样 —— 两档都是**逐字**的行号 token,不是相似度(取不到 ⇒ null ⇒ 拒删)。
  const pointedLineMatch = pointed
    ? Number(pointed.slice(1))
    : Number((/同标题登记\s+L(\d+)/.exec(String(row.raw))?.[1] ?? Number.NaN))
  if (!Number.isFinite(pointedLineMatch) || pointedLineMatch <= 0) return null
  const snapLine = pointedLineMatch
  const snapRows = parseTaskRows(snapshot)
  const snapRow = snapRows.find((r) => r.line === snapLine)
  if (!snapRow) {
    return { verdict: 'archive-absent', pointed, detail: [`快照 ${token.slice(0, 10)} 的 L${snapLine} 不是登记行`] }
  }
  if (snapRow.state !== 'done') {
    return { verdict: 'archive-absent', pointed, detail: [`快照 ${token.slice(0, 10)}:L${snapLine} 仍未勾(活登记)`] }
  }
  const family = opts2.ledgerFace
  // 账上编号取材四档:行号型指针行的 `keyOfRow` 常交 null(编号写在创建时刻措辞的 48 字窗之后),
  // 且 `titleOf` 把副本措辞里的冒号当题面分界(题面只剩"副本指针")⇒ 正尺都给不出账上号。
  // 宽窗档剥掉行首**副本措辞**后走加宽窗(72 字 = KEY_MAX_OFFSET×1.5,实测真行 51 字入窗),
  // 仍用同一个 `keyInWindow` 出口(§0.6 不抄第二份编号正则);窗口内**唯一命中**才算账上编号,
  // ≥2 个不同 token 一律判不出(宁可不删)。这一维只核验"账结清与否",不参与发号/键空间。
  const stripLeadCopyPhrase = (s) =>
    String(s).replace(
      /^\s*(?:[-*+]\s*\[[ xX]\]\s*)?(?:副本指针\s*[（(][^）)]{0,40}[）)]\s*)?(?:重复登记副本\s*[:：]\s*|副本指针\s*[:：]\s*)?/,
      '',
    )
  const w72 = (s) => keyInWindow(String(s ?? '').slice(0, Math.round(KEY_MAX_OFFSET * 1.5)))
  // 加粗题面档:指针行自述"与**同标题登记** L6880 重复"——它的账上编号就写在自己第一段加粗题面里
  // (`**G-351〔旧号〕. …**`)。取首段 `**…**` 内容过同一个 `keyInWindow`(仍是逐字窗扫描),
  // 段内唯一命中才算;取不出/段里没有号 ⇒ null(拒删)。这是最贴自述语义的一档,排在加宽窗之前。
  const boldLead = /\*\*([^*\n]{4,160})\*\*/.exec(String(row.raw))
  const boldKey = boldLead ? keyInWindow(boldLead[1]) : null
  const wide = w72(stripLeadCopyPhrase(row.raw))
  const ambiguous = wide !== null && w72(row.raw) !== null && w72(row.raw) !== wide
  const accountKey = keyOfRow(row.raw) ?? keyInWindow(titleOf(row.raw) ?? '') ?? boldKey ?? (ambiguous ? null : wide)
  if (accountKey) {
    // (d) "open 正主"必须排除两类:本批删除行 ∧ **自述副本行**(指针行自己就是 `- [ ]` 行,
    // 不排除的话两副本互相当对方的正主 ⇒ 永久互锁拒删;正主与否的尺 = 派单出口同一把 isClaimExcludedPointer)
    const openOthers = (family.openByKey.get(accountKey) ?? []).filter(
      (x) => x.line !== row.line && !opts2.deletedRowLines?.has(x.line) && !hasCopyMark(x.raw),
    )
    if (openOthers.length) {
      return {
        verdict: 'archive-absent',
        pointed,
        detail: [`${accountKey} 在现行面仍有本批之外的 open 正主(L${openOthers[0].line})`],
      }
    }
  }
  // (e) 结清证据的采集(只计数,不拦截):
  //  - `<!--` 注释 ∧ 结清标记(✅/已归档)⇒ 结清墓碑,计数(归档器注释化先例,行内自带结清字面);
  //  - `- [x]` done 登记行 ⇒ 另一种结清证据,计数;
  //  - **其余出现一律不计、不拦** —— (d) 已经用登记面(复选框 open ∧ 非自述副本)拦住唯一危险型
  //    ("活着的正主");正文引用与非结清注释(归并器防误回捞锚)都不改变账的状态,拿它们拒删 =
  //    把判据装成失明(门 71"不对正文引用判活"同纪律)。注释**无**结清标记同样不拦:它们是副本锚
  //    不是结清凭据 —— 凭据要求由下方 tombstones.length≥1 单独把关。
  const tombstones = []
  // 刻意无 g 标志:逐行 .test() 若带 g 会共享 lastIndex,呈"一次真一次假"的交替漂移(本文件 MERGE_NOTE_RE 头注同条纪律)
  const re = accountKey ? new RegExp(`(?<![A-Za-z0-9])${accountKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) : null
  if (re) {
    const lines = family.lines
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!l || !re.test(l)) continue
      const lineNo = i + 1
      if (lineNo === row.line || opts2.deletedRowLines?.has(lineNo)) continue
      if (/^\s*<!--/.test(l)) {
        if (/[✅]|已归档/.test(l)) tombstones.push({ line: lineNo, kind: 'tombstone' })
        continue
      }
      const rr = family.lineRows.get(lineNo)
      if (!rr) continue // 非登记行(散文/清单引用):不计、不拦
      if (rr.state === 'done') {
        tombstones.push({ line: lineNo, kind: 'done-checkbox' })
        continue
      }
      // open 且非副本的正主已在 (d) 拒过;自述副本行不计
    }
  }
  if (accountKey && !tombstones.length) {
    // 结清证据必须**当场至少找到一条**(墓碑或 done 勾选行)——只有"没找到活的"不等于"找到了结清的"
    return { verdict: 'archive-absent', pointed, detail: [`现行面没有 ${accountKey} 的可点名称结清凭据(墓碑/done 行 ≥1)`] }
  }
  if (!accountKey) {
    // 无账上编号可核(keyOfRow/titleOf/加粗题/宽窗四档都给不出)⇒ 只有快照 (b)(c) 不够 —— 拒删
    return { verdict: 'archive-absent', pointed, detail: ['行内取不出可核验的账上编号'] }
  }
  return {
    verdict: 'commit-receipt',
    pointed,
    token,
    snapshotLine: snapLine,
    snapshotState: snapRow.state,
    accountKey: accountKey ?? null,
    tombstones,
  }
}

/**
 * ④ 接收方判定的**唯一出口**(self-test/镜像测试/`selectCopyRowsToPurge` 共用,零复算)。
 *
 * 指针行 `key=null`(编号只住在括注里)⇒ 台账 open 面按编号查不到接收方,旧判据把这类行
 * **全数**拒删 —— 连"主行早已勾选归档、指针只是陈旧悬空"的那批也一起挡(2026-10-24 实测 10 条
 * 里 7 条属此型)。本函数把接收方分两档:
 *   - `ledger`:新面仍有该编号的 open 行(原语义,逐字不变;有 hint 时并要求题面收窄命中);
 *   - `archive`:新面缺席 ∧ 归档面上该编号的登记行**全部已勾** ⇒ 陈旧悬空指针,可删;
 *   - `archive-live`:归档面上还有该编号的**未勾**行 ⇒ 删指针 = 丢唯一活登记,拒删;
 *   - `archive-absent`:归档面查无此编号(判不出 ⇒ 拒删,不是"可以删");归档缺席的**行号+枚 sha
 *     型**指针先经 ④d `commitReceiptVerdict` 验回执,验通 ⇒ `commit-receipt`(可删,receiver=commit),
 *     验不通 ⇒ 维持 archive-absent 并点名(逐条前提见该函数头注);
 *   - `archive-undetermined`:归档面取不到/没取全(§0.3 未判定,不猜)。
 * 失效方向恒为「多留一行」:先看台账再看归档,任一环判不出就拒删。
 * ④d 需第四参 `opts2 = { resolveSnapshot, ledgerFace, deletedRowLines }`(缺任 ⇒ 一律不启用,
 * 逐字退回 ④c 原判定;判不出恒落"不可删")。
 */
export function pointerTargetVerdict(row, openById, archiveIndex, opts2 = null) {
  const raw = typeof row?.raw === 'string' ? row.raw : ''
  if (!COPY_POINTER_ROW_RE.test(raw))
    return { verdict: 'no-pointer', pointed: null, id: null, hint: null, targets: [], detail: [] }
  const pointed = pointedIdOf(raw)
  if (!pointed)
    return { verdict: 'no-pointer', pointed: null, id: null, hint: null, targets: [], detail: [] }
  const { id, hint } = splitPointedId(pointed)
  const base = { pointed, id, hint }
  if (!id) return { ...base, verdict: 'archive-absent', targets: [], detail: [] }
  const targets = (openById?.get(id) ?? []).filter(
    (x) => x.line !== row.line && titleMatchesHint(hint, x),
  )
  if (targets.length) return { ...base, verdict: 'ledger', targets, detail: [] }
  if (!archiveIndex || archiveIndex.ok !== true)
    return { ...base, verdict: 'archive-undetermined', targets: [], detail: [] }
  const hits = (archiveIndex.byId.get(id) ?? []).filter((rec) => titleMatchesHint(hint, rec))
  if (!hits.length) {
    // ── ④d 枚回执档:归档面缺席,但指针是「行号+枚 sha」型 ⇒ 接收方可以在 git 快照里逐字验 ──
    const v4d = commitReceiptVerdict(row, pointed, opts2)
    if (v4d) return { ...base, targets: [], ...v4d }
    return { ...base, verdict: 'archive-absent', targets: [], detail: [] }
  }
  const live = hits.filter((rec) => rec.state === 'open')
  if (live.length) return { ...base, verdict: 'archive-live', targets: [], detail: live }
  return { ...base, verdict: 'archive-done', targets: [], detail: hits }
}

/**
 * ⑤F9 / ⑥F1 过滤器(纯函数,self-test 直测;main 与本层共用一份,不复制第二份判据)。
 *  · ⑤ 撞号组的"同主键"语义被污染(归撞号链管,G-312)⇒ 同键组判定(④b)不进该组;
 *    行首指针族走的是"指向编号"判定,不是同键组判定,故不查 F9(与补档前的分族口径一致)。
 *  · ⑥ 与 `auditPlan`/`findForks` 同口径的 F1 分叉活行不删(现读 0 组,保险档)。
 */
export function filterCandidates(candidates, { forkOpenLines, f9Keys } = {}) {
  return (candidates ?? []).filter((d) => {
    if (forkOpenLines?.has(d.row.line)) return false
    if (!d.family.startsWith('pointer') && f9Keys?.has(d.key)) return false
    return true
  })
}

/**
 * 删除判定(纯函数,self-test 直测):给定全行集合,返回删除行索引集合与逐行理由。
 * 判据见文件头注 —— 这里是唯一实现,--dry-run/--apply/--self-test 各档共用。
 *
 * 三档(G-1102638 三批路线):
 *  - 批1(缺省):①行自述副本 ∧ ②不带落账注记 —— 清干净的自述副本行;
 *  - 批2(includeSettled):②反转 —— **只**清带〔【归并】…落账:复测…〕注记的行,①不再强制
 *    (注记本身就是副本自述,不必再是「副本指针/重复登记」形态);③租约/④接收方/⑤F9/⑥F1 不变,
 *    由调用方(main 的 candidates filter)与函数内共同承担。
 *  - 批3(expiredLease):六判据联用 —— ①②同批1;③收窄为「无**有效**租约」:
 *    claim 缺失放行,claim 在但行号 ∈ staleLeaseLines(租约门 analyzeLeases 判的过期集)放行,
 *    租约在飞(claim 在但不在过期集)一律保留。staleLeaseLines 由 main 传入(纯函数不派生);
 *    includeSettled 与 expiredLease 互斥,同传即抛(①与②的取舍方向相反,混档=判据自相矛盾)。
 *
 * ④ 接收方:`opts.archiveIndex` 存在时,行首指针族把"主行已勾选归档"那一档也认作接收方
 * (见 `pointerTargetVerdict`);判不出/归档缺失一律拒删并进 `opts.rejectLog` 点名。
 * 传不传 archiveIndex 都不改变"台账 open 面有接收方"的原语义(逐字同形)。
 * `opts.receipt`(④d 枚回执通道,`{ resolveSnapshot, ledgerFace }`):归档缺席的行号型指针经
 * `commitReceiptVerdict` 验"创建枚快照里该行已勾 ∧ 账上编号无 open 正主 ∧ 现面有结清凭据";
 * 未注入通道 ⇒ 行为逐字退回补档前(拒删)。
 */
export function selectCopyRowsToPurge(rows, opts = {}) {
  const includeSettled = Boolean(opts.includeSettled)
  const expiredLease = Boolean(opts.expiredLease)
  if (includeSettled && expiredLease) throw new Error('批2(--include-settled)与批3(--expired-lease)两档互斥,拒')
  // ④d 的"本批副本行"范围:按自述标记现算(行级判据,与 select 同把尺,不依赖删除时序)
  const receipt = opts.receipt
    ? {
        ...opts.receipt,
        // 本批副本集与删除集**同形**(①∧②):批2 对象(带落账注记)不得被当成"已排除的正主"而放掉④d
        deletedRowLines: new Set(
          rows.filter((r) => r.state === 'open' && hasCopyMark(r.raw) && !hasSettledNote(r.raw)).map((r) => r.line),
        ),
      }
    : null
  const openRows = rows.filter((r) => r.state === 'open')
  // 组账:复合主键 → open 行(幸存者判定用)
  const byKey = new Map()
  for (const r of openRows) {
    const k = r.key
    if (!k) continue
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(r)
  }
  // 编号账:编号 → open 行(行首指针族的"指向不悬空"判定用)
  const openById = new Map()
  for (const r of openRows) {
    const id = r.key
    if (!id) continue
    if (!openById.has(id)) openById.set(id, [])
    openById.get(id).push(r)
  }
  const deletes = []
  for (const r of rows) {
    if (r.state !== 'open') continue // 只动未勾行(勾行归归档器)
    if (includeSettled) {
      if (!hasSettledNote(r.raw)) continue // ②批2反转:只清落账注记行
    } else {
      if (!hasCopyMark(r.raw)) continue // ①
      if (hasSettledNote(r.raw)) continue // ② 批2对象
    }
    if (r.claim && !(expiredLease && opts.staleLeaseLines?.has(r.line))) continue // ③(批3收窄:claim 在但已过期 ⇒ 放行;租约在飞 ⇒ 保留)
    const pointed = COPY_POINTER_ROW_RE.test(r.raw) ? pointedIdOf(r.raw) : null
    if (pointed) {
      // ④a/④c/④d 行首指针族:接收方判定只走 `pointerTargetVerdict` 一个出口
      // (台账 open 面 → 归档已勾面 → 枚回执 → 判不出即拒删)。
      const v = pointerTargetVerdict(r, openById, opts.archiveIndex, receipt)
      if (v.verdict === 'ledger') {
        deletes.push({
          row: r,
          family: includeSettled ? 'pointer-note' : expiredLease ? 'pointer-lease' : 'pointer-row',
          key: v.id,
          survivorLine: v.targets[0].line,
          receiver: 'ledger',
        })
      } else if (v.verdict === 'archive-done') {
        const top = v.detail[0]
        deletes.push({
          row: r,
          family: includeSettled ? 'pointer-note' : expiredLease ? 'pointer-lease' : 'pointer-row',
          key: v.id,
          survivorLine: top.line,
          receiver: 'archive',
          receiverPath: top.path,
          composites: v.detail.map((x) => x.composite).filter(Boolean),
        })
      } else if (v.verdict === 'commit-receipt') {
        deletes.push({
          row: r,
          family: includeSettled ? 'pointer-note' : expiredLease ? 'pointer-lease' : 'pointer-row',
          key: v.id,
          survivorLine: v.snapshotLine,
          receiver: 'commit',
          token: v.token,
          accountKey: v.accountKey,
          tombstones: v.tombstones,
        })
      } else if (opts.rejectLog) {
        // 拒删逐条点名(archive-live / archive-absent / archive-undetermined / no-pointer),
        // 让"为什么这行留着"可核 —— 静默跳过是本档最大的误判来源。
        opts.rejectLog.push({
          line: r.line,
          verdict: v.verdict,
          pointed: v.pointed,
          detail: v.detail,
        })
      }
    } else {
      // ④b 【归并】族:同复合主键组内存在幸存者。批3语义收窄:幸存者允许持**已过期**租约
      // (主行本体留在账面不代摘,租约清账归持有者;登记信息不丢 ⇒ 接收方成立);
      // 在飞租约幸存者仍挡(宁可漏删不可误删)。批1/批2 expiredLease=false ⇒ 逐字原判。
      const k = r.key ?? compositeKeyOf(r.raw)
      if (!k) continue
      const group = byKey.get(k) ?? []
      const survivor = group.find(
        (x) =>
          x.line !== r.line &&
          !hasCopyMark(x.raw) &&
          !hasSettledNote(x.raw) &&
          (!x.claim || (expiredLease && opts.staleLeaseLines?.has(x.line))),
      )
      if (!survivor) continue
      deletes.push({
        row: r,
        family: includeSettled ? 'settled-note' : expiredLease ? 'merge-lease' : 'merge-note',
        key: k,
        survivorLine: survivor.line,
      })
    }
  }
  return deletes
}

function selfTest() {
  const mk = (line, raw, extra = {}) => ({ line, state: 'open', raw, body: raw, key: null, claim: null, ...extra })
  let fail = 0
  const ok = (cond, msg) => {
    if (!cond) {
      fail++
      console.error(`❌ ${msg}`)
    }
  }
  // ① 行首指针族:指向仍在 ⇒ 删
  let d = selectCopyRowsToPurge([
    mk(1, '- [ ] G-10 主任务行(正文最全)', { key: 'G-10' }),
    mk(2, '- [ ] 副本指针(编号 G-10)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见 G-10 那条。'),
  ])
  ok(d.length === 1 && d[0].family === 'pointer-row' && d[0].row.line === 2, '行首指针族应删第2行')
  // ①b 指向悬空 ⇒ 不删
  d = selectCopyRowsToPurge([mk(1, '- [ ] 副本指针(编号 G-99)：状态见 G-99 那条。')])
  ok(d.length === 0, '指向悬空的指针行不得删')
  // ② 落账注记行 ⇒ 不删(批2对象)
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] G-20 主行'),
    mk(2, '- [ ] G-20 同题副本 - 〔【归并】重复登记副本…落账:复测 2026-10-01 机主已拍板,派单以 G-20 主行为准〕'),
  ])
  ok(d.length === 0, '带落账注记的副本行批1不删')
  // ③ 带租约 ⇒ 不删
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] G-30 主行'),
    mk(2, '- [ ] G-30 同题副本(进行中@2026-10-08/某人) - 【归并】重复登记副本,派单以主行为准'),
  ])
  ok(d.length === 0, '带租约行不得删')
  // ④b 【归并】族:同键幸存者在 ⇒ 删;组内全带标记 ⇒ 整组不删。
  // 用例传显式 key(parseTaskRows 的 r.key = keyOfRow = 编号);compositeKeyOf 真实路径
  // 由 HEAD 语料 dry-run 381 行全过(2026-10-08)。
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] **G-40 题面甲** 正文', { key: 'G-40' }),
    mk(2, '- [ ] **G-40 题面甲** 正文 - 【归并】重复登记副本,派单以那条为准', { key: 'G-40' }),
  ])
  ok(d.length === 1 && d[0].row.line === 2, '同键幸存者在,副本行应删')
  d = selectCopyRowsToPurge([
    mk(1, '- [ ] **G-41 题面乙** 副本A - 【归并】重复登记副本', { key: 'G-41' }),
    mk(2, '- [ ] **G-41 题面乙** 副本A - 【归并】重复登记副本', { key: 'G-41' }),
  ])
  ok(d.length === 0, '组内无幸存者(全带标记)整组保留')
  // ③b 无主键正文行(叙述式)不在【归并】判 ⇒ 不删
  d = selectCopyRowsToPurge([mk(1, '随便一行正文没有复选框')])
  ok(d.length === 0, '非复选框行不在视野')
  // —— 批2档(includeSettled):只清落账注记行,判据③④同守 ——
  d = selectCopyRowsToPurge(
    [
      // 主行也显式传 key:组账(byKey)只收 r.key 非 null 的行 —— 真实路径 parseTaskRows
      // 会给行首编号行填 key,构造用例须同形,否则主行进不了组账、幸存者永远找不到。
      mk(1, '- [ ] **G-50 题面丙** 主行正文', { key: 'G-50' }),
      mk(2, '- [ ] **G-50 题面丙** 同题副本 - 〔【归并】G-50 落账:复测 2026-10-01: 取证文案〕', { key: 'G-50' }),
    ],
    { includeSettled: true },
  )
  ok(d.length === 1 && d[0].row.line === 2 && d[0].family === 'settled-note', '批2:带落账注记的副本行应删(settled-note 族)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] G-51 主行'),
      mk(2, '- [ ] 副本指针(编号 G-51)：状态见主行。'),
    ],
    { includeSettled: true },
  )
  ok(d.length === 0, '批2:不带落账注记的行不删(指针行是批1对象,两档互斥)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] G-52 主行'),
      mk(2, '- [ ] G-52 同题副本(进行中@2026-10-08/某人) - 〔【归并】G-52 落账:复测 2026-10-01: 取证〕', { key: 'G-52', claim: { holder: '某人' } }),
    ],
    { includeSettled: true },
  )
  ok(d.length === 0, '批2:租约行仍不删(③不变)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] **G-53 题** 副本A - 〔【归并】G-53 落账:复测 2026-10-01: 取证〕', { key: 'G-53' }),
      mk(2, '- [ ] **G-53 题** 副本A - 〔【归并】G-53 落账:复测 2026-10-01: 取证〕', { key: 'G-53' }),
    ],
    { includeSettled: true },
  )
  ok(d.length === 0, '批2:组内无幸存者(全带注记)整组保留,宁可漏删')
  // —— 批3档(expiredLease):六判据联用,③收窄为「无有效租约」——
  // mk 夹具的 claim 形态只判真值;过期集由 main 经租约门 analyzeLeases 算好后传行号集(纯函数不派生),
  // 这里用行号集直陈「该行租约已过期」的判定结果。
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] **G-60 题** 主行正文', { key: 'G-60' }),
      mk(2, '- [ ] **G-60 题** 同题副本(进行中@2026-09-29/某人) - 【归并】重复登记副本,派单以主行为准', { key: 'G-60', claim: { holder: '某人' } }),
    ],
    { expiredLease: true, staleLeaseLines: new Set([2]) },
  )
  ok(d.length === 1 && d[0].row.line === 2 && d[0].family === 'merge-lease', '批3:过期租约的自述副本行应删(merge-lease 族)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] **G-61 题** 主行正文', { key: 'G-61' }),
      mk(2, '- [ ] **G-61 题** 同题副本(进行中@2026-10-08/某人) - 【归并】重复登记副本,派单以主行为准', { key: 'G-61', claim: { holder: '某人' } }),
    ],
    { expiredLease: true, staleLeaseLines: new Set() },
  )
  ok(d.length === 0, '批3:租约在飞(未过期)的副本行仍不删 —— 「保留租约在飞的副本行」硬约束')
  d = selectCopyRowsToPurge(
    [
      // 主行必须传显式 key:openById 组账只收 r.key 非 null 的行(与批2 G-51 用例同一陷阱)
      mk(1, '- [ ] G-62 主行', { key: 'G-62' }),
      mk(2, '- [ ] 副本指针(编号 G-62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见 G-62 那条。', { claim: { holder: '某人' } }),
    ],
    { expiredLease: true, staleLeaseLines: new Set([2]) },
  )
  ok(d.length === 1 && d[0].family === 'pointer-lease', '批3:过期租约的行首指针行应删(pointer-lease 族,指向仍在)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] G-63 主行'),
      mk(2, '- [ ] G-63 同题副本 - 〔【归并】G-63 落账:复测 2026-10-01: 取证〕'),
    ],
    { expiredLease: true, staleLeaseLines: new Set([2]) },
  )
  ok(d.length === 0, '批3:带落账注记的过期租约副本行仍不删 —— 「保留带落账注记的副本行」硬约束')
  d = selectCopyRowsToPurge([mk(1, '- [ ] G-64 孤行 - 【归并】重复登记副本,派单以主行为准')], { expiredLease: true, staleLeaseLines: new Set() })
  ok(d.length === 0, '批3:无接收方的孤行不删(④不变)')
  // ④b 批3收窄:幸存者持**过期**租约 ⇒ 接收方成立(主行本体保留在账,只清副本);
  // 幸存者持**在飞**租约 ⇒ 仍挡。
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] **G-66 题** 主行(进行中@2026-09-29/某人)', { key: 'G-66', claim: { holder: '某人' } }),
      mk(2, '- [ ] **G-66 题** 同题副本 - 【归并】重复登记副本,派单以主行为准', { key: 'G-66' }),
    ],
    { expiredLease: true, staleLeaseLines: new Set([1]) },
  )
  ok(d.length === 1 && d[0].row.line === 2 && d[0].survivorLine === 1, '批3:幸存者为过期租约主行,副本应删(主行不代摘)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] **G-67 题** 主行(进行中@2026-10-08/某人)', { key: 'G-67', claim: { holder: '某人' } }),
      mk(2, '- [ ] **G-67 题** 同题副本 - 【归并】重复登记副本,派单以主行为准', { key: 'G-67' }),
    ],
    { expiredLease: true, staleLeaseLines: new Set() },
  )
  ok(d.length === 0, '批3:幸存者为在飞租约主行,副本仍不删(宁可漏删)')
  // 批1/批2 档下幸存者判据逐字原状:持任何租约的主行都不能当幸存者
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] **G-68 题** 主行(进行中@2026-09-29/某人)', { key: 'G-68', claim: { holder: '某人' } }),
      mk(2, '- [ ] **G-68 题** 同题副本 - 【归并】重复登记副本,派单以主行为准', { key: 'G-68' }),
    ],
    { staleLeaseLines: new Set([1]) },
  )
  ok(d.length === 0, '批1档:幸存者持租约(哪怕行号在过期集)仍不作数 —— 收窄只在批3档生效')
  // —— ④c 归档接收方档(票面六判据的 ④ 补档;2026-10-24 设计,2026-10-29 按 HEAD 结构接线)——
  const archOf = (text) =>
    buildArchiveIndex([{ path: '.ihui-agent/archive/PROJECT_PLAN_x.md', text }])
  const ARCH_DONE = ['# 归档件', '- [x] ✅(2026-09-27) 62. 会话搜索栏挂载 + 侧栏批量选择', ''].join(
    '\n',
  )
  const ARCH_OPEN = ['# 归档件', '- [ ] 4. 观察期:连续 3 次 main push e2e 稳定绿后收官。', ''].join(
    '\n',
  )
  d = selectCopyRowsToPurge(
    [mk(1, '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本;当前状态见 62 那条。')],
    {
      archiveIndex: archOf(ARCH_DONE),
    },
  )
  ok(
    d.length === 1 && d[0].receiver === 'archive' && d[0].key === '62' && d[0].survivorLine === 2,
    '④c:陈旧悬空指针(归档主行已勾)应删,接收方=archive',
  )
  ok(
    d[0]?.composites?.[0] === '62#会话搜索栏挂载+侧栏批量选择',
    '④c:接收方凭复合主键点名(编号+题面前缀)',
  )
  let rejectLog = []
  d = selectCopyRowsToPurge([mk(1, '- [ ] 副本指针(编号 4·观察期)：同主键第二份未勾选副本。')], {
    archiveIndex: archOf(ARCH_OPEN),
    rejectLog,
  })
  ok(
    d.length === 0 && rejectLog[0]?.verdict === 'archive-live',
    '④c:归档主行未勾 ⇒ 拒删(删指针=丢唯一活登记)',
  )
  ok(
    rejectLog[0]?.pointed === '4·观察期' && rejectLog[0]?.detail?.[0]?.line === 2,
    '④c:拒删须点名指向串与归档行号',
  )
  rejectLog = []
  d = selectCopyRowsToPurge([mk(1, '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本。')], {
    archiveIndex: archOf('# 归档件\n'),
    rejectLog,
  })
  ok(
    d.length === 0 && rejectLog[0]?.verdict === 'archive-absent',
    '④c:归档查无此编号 ⇒ 拒删(判不出 ≠ 可删)',
  )
  rejectLog = []
  d = selectCopyRowsToPurge([mk(1, '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本。')], {
    archiveIndex: buildArchiveIndex([{ path: '.ihui-agent/archive/PROJECT_PLAN_x.md' }]),
    rejectLog,
  })
  ok(
    d.length === 0 && rejectLog[0]?.verdict === 'archive-undetermined',
    '④c:归档面没取全 ⇒ 未判定,拒删',
  )
  d = selectCopyRowsToPurge([mk(1, '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本。')])
  ok(d.length === 0, '④c:未传归档面 ⇒ 与补档前逐字同形(拒删)')
  d = selectCopyRowsToPurge(
    [
      mk(1, '- [ ] G-10 主任务行(正文最全)', { key: 'G-10' }),
      mk(2, '- [ ] 副本指针(编号 G-10)：同主键第二份未勾选副本;当前状态见 G-10 那条。'),
    ],
    { archiveIndex: archOf(ARCH_DONE) },
  )
  ok(
    d.length === 1 && d[0].receiver === 'ledger' && d[0].survivorLine === 1,
    '④c:台账面有接收方 ⇒ 原语义不变(不因归档面在不在而变)',
  )
  rejectLog = []
  d = selectCopyRowsToPurge([mk(1, '- [ ] 副本指针(编号 P1-②)：同主键第二份未勾选副本。')], {
    archiveIndex: archOf('# 归档件\n- [ ] P1-① 扩共享层首批:等容器运行时。\n'),
    rejectLog,
  })
  ok(
    d.length === 0 && rejectLog[0]?.verdict === 'archive-absent',
    '④c:编号逐字等值 —— P1-② 不得被 P1-① 的主行顶替(无相似度匹配)',
  )
  ok(
    pointerTargetVerdict(mk(1, '- [ ] 普通任务行'), new Map(), archOf(ARCH_DONE)).verdict ===
      'no-pointer',
    '④c:verdict 出口单一,非指针行交 no-pointer',
  )
  // —— ④d 枚回执档(2026-10-26 立于 91ead7dd14,本次按 HEAD 结构重施加;夹具全走纯函数入参,
  //    快照经 resolveSnapshot 注入,判据不碰真 git 面 —— 与 ④c 不读盘同一条纪律)——
  // 行号用小号(L1/L2/L3)钉同一形状:快照 L1 是散文头(拒删臂)、L2 是未勾行(拒删臂)、L3 是已勾主行(可删臂)。
  const SNAP_LEDGER =
    '# 快照\n- [ ] **62. 未勾主行** y。\n- [x] ✅(2026-09-24) **污染守门补上第二维并同步文档**:细节。\n'
  const snapOk = (token) => (/^[0-9a-f]{7,40}$/.test(token) ? SNAP_LEDGER : null)
  const RECEIPT_ROW_1 =
    '- [ ] 副本指针（编号 L6880）重复登记副本:本行与同标题登记 L6880(枚 290a26bc1)重复。 **G-351〔旧号〕. 分叉合并丢掉的东西**:① 丢的实现。'
  const RECEIPT_ROW_2 =
    '- [ ] 重复登记副本:本行与同标题登记 L6880(枚 290a26bc1)重复。本行不进派单口径,活账以主行为准。 **G-351〔旧号〕. 分叉合并丢掉的东西**:① 丢的实现。'
  const LEDGER_TOMB = [
    '- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。本行不进派单口径,活账以主行为准。',
    '- [ ] 重复登记副本:见 G-351 那条。本行不进派单口径,活账以主行为准。',
    '<!-- 已归档(2026-10-15:✅(2026-10-15) **G-351. 分叉合并丢掉的东西** 完整内容在 archive -->',
    '- [ ] **G-999 甲题** 无关活行。',
    '',
  ].join('\n')
  const faceT = buildLedgerFaceIndex(LEDGER_TOMB)
  const rcOpt = (resolve) => ({ resolveSnapshot: resolve, ledgerFace: faceT })
  const emptyArch = buildArchiveIndex([{ path: 'x', text: '# 空归档件\n' }])
  // D 型正例:行号+枚 token 指针 ∧ 快照 L3 已勾 ∧ 账上 G-351 只有自述副本+结清墓碑 ⇒ 指针行可删
  d = selectCopyRowsToPurge(
    [mk(1, RECEIPT_ROW_1.replace('L6880', 'L3')), mk(2, RECEIPT_ROW_2), mk(3, LEDGER_TOMB.split('\n')[2]), mk(4, '- [ ] **G-999 甲题** 无关活行。', { key: 'G-999' })],
    { archiveIndex: emptyArch, receipt: rcOpt(snapOk) },
  )
  ok(
    d.length === 1 && d[0].receiver === 'commit' && d[0].token === '290a26bc1' && d[0].accountKey === 'G-351' && d[0].survivorLine === 3,
    '④d D型:行号+枚 token 指针 ∧ 快照 done ∧ 账已结清 ⇒ 可删(receiver=commit;merge-note  twin 行不经此通道,④b 未放宽)',
  )
  ok(
    d.length === 1 && d[0].tombstones.length === 1 && d[0].tombstones[0].line === 3,
    '④d D型:结清墓碑逐处点名(证据进留痕,不只给布尔)',
  )
  // 反例组:每一臂都必须退回 archive-absent(拒删),失效方向恒为"少删"
  let rej4d = []
  d = selectCopyRowsToPurge(
    [mk(1, RECEIPT_ROW_1.replace('L6880', 'L1'))],
    { archiveIndex: emptyArch, rejectLog: rej4d, receipt: rcOpt(snapOk) },
  )
  ok(d.length === 0 && rej4d[0]?.verdict === 'archive-absent', '④d 反例:快照该行不是登记行 ⇒ 判不出,拒删')
  rej4d = []
  d = selectCopyRowsToPurge(
    [mk(1, RECEIPT_ROW_1.replace('L6880', 'L2'))],
    { archiveIndex: emptyArch, rejectLog: rej4d, receipt: rcOpt(snapOk) },
  )
  ok(d.length === 0 && rej4d[0]?.verdict === 'archive-absent', '④d 反例:快照行未勾 ⇒ 活登记,拒删')
  rej4d = []
  d = selectCopyRowsToPurge(
    [mk(1, '- [ ] 副本指针(编号 62)：与 L6880 无关也无关(枚 290a26bc1)。')],
    { archiveIndex: emptyArch, rejectLog: rej4d, receipt: rcOpt(snapOk) },
  )
  ok(d.length === 0 && rej4d[0]?.verdict === 'archive-absent', '④d 反例:指向不是行号形态(裸 62)⇒ 本档不启用,逐字退回 ④c')
  const LEDGER_LIVE = [
    '- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。',
    '- [ ] **G-351 甲题** 主行还挂着未勾。',
    '',
  ].join('\n')
  rej4d = []
  d = selectCopyRowsToPurge([mk(1, RECEIPT_ROW_1.replace('L6880', 'L3'))], {
    archiveIndex: emptyArch,
    rejectLog: rej4d,
    receipt: { resolveSnapshot: snapOk, ledgerFace: buildLedgerFaceIndex(LEDGER_LIVE) },
  })
  ok(
    d.length === 0 && rej4d[0]?.verdict === 'archive-absent' && String(rej4d[0]?.detail?.[0] ?? '').includes('open 正主'),
    '④d 反例:账上编号仍有本批之外的 open 正主 ⇒ 拒删并点名',
  )
  const LEDGER_NOSTOP = [
    '- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。本行不进派单口径,活账以主行为准。',
    '<!-- 重复副本锚(归并器防误回捞措辞),没有 ✅/已归档 -->',
    '  - 复盘清单里提了一嘴 `G-351` 的散文引用行。',
    '',
  ].join('\n')
  rej4d = []
  d = selectCopyRowsToPurge([mk(1, RECEIPT_ROW_1.replace('L6880', 'L3'))], {
    archiveIndex: emptyArch,
    rejectLog: rej4d,
    receipt: { resolveSnapshot: snapOk, ledgerFace: buildLedgerFaceIndex(LEDGER_NOSTOP) },
  })
  ok(
    d.length === 0 && rej4d[0]?.verdict === 'archive-absent' && String(rej4d[0]?.detail?.[0] ?? '').includes('结清凭据'),
    '④d 反例:全文找不到任何结清凭据(墓碑≥1)⇒ 拒删(没找到活的≠找到结清的)',
  )
  const LEDGER_MIX = [
    '- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。本行不进派单口径,活账以主行为准。',
    '<!-- 无结清标的副本锚不拦路 -->',
    '  - 散文引用 `G-351` 不拦路。',
    '<!-- 已归档(✅(2026-10-15) **G-351. 甲** 完整内容在 archive -->',
    '',
  ].join('\n')
  d = selectCopyRowsToPurge([mk(1, RECEIPT_ROW_1.replace('L6880', 'L3'))], {
    archiveIndex: emptyArch,
    receipt: { resolveSnapshot: snapOk, ledgerFace: buildLedgerFaceIndex(LEDGER_MIX) },
  })
  ok(
    d.length === 1 && d[0].tombstones.length === 1 && d[0].tombstones[0].line === 4,
    '④d 正例:非结清注释/散文引用不拦,凭据只要 ≥1 条真墓碑(点名到那条)',
  )
  rej4d = []
  d = selectCopyRowsToPurge([mk(1, RECEIPT_ROW_1.replace('L6880', 'L3')), mk(2, RECEIPT_ROW_2)], {
    archiveIndex: emptyArch,
    rejectLog: rej4d,
    receipt: rcOpt(() => null),
  })
  ok(
    d.length === 0 && rej4d[0]?.verdict === 'archive-absent' && String(rej4d[0]?.detail?.[0] ?? '').includes('快照取不到'),
    '④d 反例:枚 token 解析不出真提交(快照取不到)⇒ 判不出,拒删并点名',
  )
  // 通道关着(未注入 receipt)⇒ 旧判定逐字不变(与 ④c 补档时的形状锁同一条)
  d = selectCopyRowsToPurge(
    [mk(1, RECEIPT_ROW_1.replace('L6880', 'L3')), mk(2, RECEIPT_ROW_2)],
    { archiveIndex: emptyArch },
  )
  ok(d.length === 0, '④d 不注入回执通道 ⇒ 行为逐字退回补档前(不可删)')
  ok(receiptTokenOf('- [ ] x(枚 abc1234def)。') === 'abc1234def' && receiptTokenOf('无枚') === null, '枚 token 提取器:有/无两形各钉')

  // —— ⑤F9 / ⑥F1 过滤器(self-test 首次覆盖:此前两维零测试)——
  const cand = [
    {
      row: mk(1, '- [ ] **G-70 题** 副本 - 【归并】重复登记副本'),
      family: 'merge-note',
      key: 'G-70',
    },
    { row: mk(2, '- [ ] 副本指针(编号 G-71)：x'), family: 'pointer-row', key: 'G-71' },
  ]
  ok(
    filterCandidates(cand, { f9Keys: new Set(['G-70']) }).length === 1,
    '⑤F9:同键组判定进撞号组 ⇒ 删;指针族不查 F9',
  )
  ok(
    filterCandidates(cand, { forkOpenLines: new Set([2]) }).length === 1,
    '⑥F1:分叉活行不删(现读 0 组,保险档)',
  )
  ok(filterCandidates(cand).length === 2, '⑤⑥:两维空集 ⇒ 一条不少(不误杀)')

  let threwBatchClash = false
  try {
    selectCopyRowsToPurge([mk(1, '- [ ] G-65 x')], { includeSettled: true, expiredLease: true })
  } catch {
    threwBatchClash = true
  }
  ok(threwBatchClash, '批3:两档同传必须抛(互斥)')
  if (fail) {
    console.error(`self-test ${fail} 项红`)
    return 1
  }
  console.log('✅ self-test 全绿')
  return 0
}

/**
 * 安全阀 2 的**唯一实现**(纯函数,self-test / 镜像测试直测;main 只负责抛与打印)。
 * 复跑 auditPlan 判据面五维,任一维不过即返回 violations(调用方拒绝落地):
 *  - F1:新面分叉组必须 0;
 *  - mergeNotes:批2"必须下降且降幅 === 被删行行级注记和"(注记可横跨两行 ⇒ 面级与行级可能有 ±1
 *    口径差,差非零在此点名交人看面);批1/批3"必须不变"(不碰注记行);
 *  - 副本行全集(`isClaimExcludedPointer` 唯一口径):批1/批3 **必须恰好减去删除数** —— 被删的每一行
 *    都是自述副本行,少减一行 = 有行没删够,多减一行 = 把非副本行算成了副本;
 *  - dupPointerRows / F9 声明组:不得增加(删行不造新键)。
 *
 * 2026-10-29 现读缺陷(实测,非推理):改前该维要求 `dupPointerRows` **严格下降**,而批1 现读
 * 只剩「副本指针(编号 …)」一族(`DUP_POINTER_RE` 的【归并】族已在 2026-10-08 批1 清零)⇒ 删指针行
 * 时该维恒 0→0,「必须下降」当场判红(实测 dry-run:`复跑对账红 ⇒ 拒绝落地:dupPointerRows 0→0`)
 * ⇒ 阀自身恒红(§12e),`--apply` 结构上永远走不到 CAS。改法是**收紧不是放宽**:从"某一族下降"
 * 换成"副本行全集逐行对得上",并把 `DUP_POINTER` 族降为"不得增加"与 F9 同档。
 */
export function verifyNewFace({
  beforeContent,
  afterContent,
  candidates = [],
  includeSettled = false,
} = {}) {
  const before = parseTaskRows(beforeContent)
  const after = parseTaskRows(afterContent)
  const countOf = (re, text) => (text.match(new RegExp(re.source, 'g')) ?? []).length
  const copyRowsOf = (list) =>
    list.filter((r) => r.state === 'open' && isClaimExcludedPointer(r.raw)).length
  const stats = {
    beforeF1: findForks(beforeContent).forks.length,
    afterF1: findForks(afterContent).forks.length,
    beforeMergeNotes: countOf(MERGE_NOTE_RE, beforeContent),
    afterMergeNotes: countOf(MERGE_NOTE_RE, afterContent),
    beforeCopyRows: copyRowsOf(before),
    afterCopyRows: copyRowsOf(after),
    beforeDupPointer: before.filter((r) => r.state === 'open' && DUP_POINTER_RE.test(r.raw)).length,
    afterDupPointer: after.filter((r) => r.state === 'open' && DUP_POINTER_RE.test(r.raw)).length,
    beforeF9: f9Faces(beforeContent).collisions.length,
    afterF9: f9Faces(afterContent).collisions.length,
  }
  const violations = []
  if (stats.afterF1 !== 0) violations.push(`F1 分叉 ${stats.afterF1} 组(必须 0)`)
  if (includeSettled) {
    const perRowDeleted = candidates.reduce((n, d) => n + countOf(MERGE_NOTE_RE, d.row.raw), 0)
    if (stats.afterMergeNotes >= stats.beforeMergeNotes)
      violations.push(`mergeNotes ${stats.beforeMergeNotes}→${stats.afterMergeNotes}(批2必须下降)`)
    else if (stats.beforeMergeNotes - stats.afterMergeNotes !== perRowDeleted)
      violations.push(
        `mergeNotes 降幅 ${stats.beforeMergeNotes - stats.afterMergeNotes} ≠ 被删行行级注记和 ${perRowDeleted}(横跨注记口径差或误删 ⇒ 交人看面)`,
      )
    if (stats.afterCopyRows > stats.beforeCopyRows)
      violations.push(`副本行全集 ${stats.beforeCopyRows}→${stats.afterCopyRows}(不得增加)`)
  } else {
    if (stats.afterMergeNotes !== stats.beforeMergeNotes)
      violations.push(`mergeNotes ${stats.beforeMergeNotes}→${stats.afterMergeNotes}(批1必须不变)`)
    if (stats.afterCopyRows !== stats.beforeCopyRows - candidates.length)
      violations.push(
        `副本行全集 ${stats.beforeCopyRows}→${stats.afterCopyRows}(须恰好减 ${candidates.length},被删行全是自述副本行)`,
      )
  }
  if (stats.afterDupPointer > stats.beforeDupPointer)
    violations.push(`dupPointerRows ${stats.beforeDupPointer}→${stats.afterDupPointer}(不得增加)`)
  if (stats.afterF9 > stats.beforeF9)
    violations.push(`F9 声明组 ${stats.beforeF9}→${stats.afterF9}(不得增加)`)
  return { violations, stats }
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  const apply = args.includes('--apply')
  const includeSettled = args.includes('--include-settled') // 批2档:清落账注记行
  const expiredLease = args.includes('--expired-lease') // 批3档:过期租约自述副本
  if (includeSettled && expiredLease) {
    console.error('批2(--include-settled)与批3(--expired-lease)两档互斥,拒')
    process.exit(2)
  }
  if (!apply && !args.includes('--dry-run')) {
    console.error('缺 --apply / --dry-run(默认只读不猜)')
    process.exit(2)
  }

  // 底稿 = 被审面:取材层 catBatch 取 HEAD 正文(归档器同规,不自拼 git show)
  const headRef = resolveHeadRef({ root: ROOT })
  const content = catBatch(ROOT, [LEDGER_REL]).get(LEDGER_REL)
  if (typeof content !== 'string' || !content) throw new Error(`取不到 ${LEDGER_REL} ⇒ 拒绝执行`)
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)

  const rows = parseTaskRows(content)
  const { forks } = findForks(content)
  // G-48(2026-10-26):与 `findForks`/`auditPlan` 同口径 —— 副本三族全集(派单出口那把尺),
  // 不再只认 `DUP_POINTER_RE` 一族;被自述为副本的行不成正主候选,不该再被 ⑥ 当"分叉活行"保护。
  const forkOpenLines = new Set(
    forks.flatMap((g) => g.open.filter((r) => !isClaimExcludedPointer(r.raw)).map((r) => r.line)),
  )
  const f9 = f9Faces(content)
  const f9Keys = new Set(f9.collisions.map((g) => g.key))

  // ④c 归档面(HEAD 树,与台账同面):指针行 `key=null` ⇒ 台账 open 面查不到接收方时,把
  // 「主行已勾选归档」那一档从"陈旧悬空指针"里分出来。面的枚举/取正文归 lib 那份
  // `archiveFaceEntries`;本层只建索引。
  //  - 取不到任何一个归档件正文 / 清单都取不到 ⇒ 以缺正文条目入索引 ⇒ `ok:false` ⇒ 全档落
  //    「未判定」并逐条拒删(判不出 ≠ 零份);
  //  - **排除本器自己的留痕件**(`PROJECT_PLAN_copy-purge-*.md`):那是删除行的账外副本,不是
  //    归档登记;把它当接收方面会让"上一批删过的副本行"反过来当成本批的接收方(假 archive-live)。
  const archiveFace = archiveFaceEntries(ROOT, 'HEAD')
  const TRAIL_SHAPE = /PROJECT_PLAN_copy-purge-.*\.md$/
  const archiveEntries = [
    ...archiveFace.entries.filter((e) => !TRAIL_SHAPE.test(String(e.path ?? ''))),
    ...archiveFace.undetermined
      .filter((p) => !TRAIL_SHAPE.test(String(p)))
      .map((p) => ({ path: p })),
  ]
  if (archiveFace.faceReadFailed) archiveEntries.push({ path: '(archive-face)' })
  const archiveIndex = buildArchiveIndex(archiveEntries)

  // 批3:过期租约集 —— 语义唯一出口 = 租约门 analyzeLeases(同一条 TTL 规则,不自拼第二份)。
  // TTL 解析只认 env/默认(门旗标属于门自己的 CLI);legacy/形态不可辨/有持有者无日期一律不在
  // 过期集里 ⇒ 对应行仍按「租约在飞」保留(判据不猜,与门同口径)。
  let staleLeaseLines = null
  let ttl = null
  let staleLeaseTotal = 0
  if (expiredLease) {
    ttl = resolveTtlHours(null, process.env[TTL_ENV])
    const { inProgress } = scanTasks(content)
    const lease = analyzeLeases(inProgress, { nowMs: Date.now(), ttlHours: ttl.ttlHours })
    staleLeaseLines = new Set(lease.stale.map((v) => v.line))
    staleLeaseTotal = lease.stale.length
  }
  const rejectLog = []
  // ④d 枚回执通道:惰性 —— 只有行首指针行在场才建登记面;快照**按 token 现取**(纯判据层
  // 不预派生,只有"归档面也缺席"的行才会真去解析枚快照)。catBatch 取不到 ⇒ null ⇒ 判不出拒删。
  const hasOpenPointer = rows.some((r) => r.state === 'open' && COPY_POINTER_ROW_RE.test(r.raw) && pointedIdOf(r.raw))
  const ledgerFace = hasOpenPointer ? buildLedgerFaceIndex(content) : null
  const snapshotCache = new Map()
  const resolveSnapshot = (token) => {
    if (snapshotCache.has(token)) return snapshotCache.get(token)
    const spec = `${token}:${LEDGER}`
    let text = null
    try {
      text = catBatch(ROOT, [spec]).get(spec) ?? null
    } catch {
      text = null
    }
    snapshotCache.set(token, text)
    return text
  }
  const selected = selectCopyRowsToPurge(rows, {
    includeSettled,
    expiredLease,
    staleLeaseLines,
    archiveIndex,
    rejectLog,
    receipt: ledgerFace ? { resolveSnapshot, ledgerFace } : null,
  })
  // ⑤ 撞号组"同主键"语义被污染,只辖同键组判定(④b);行首指针族(family 前缀 pointer-*)走指向判定不查 F9。
  // ⑥ 与 auditPlan 同口径的 F1 分叉活行不删。两维的唯一实现 = `filterCandidates`(self-test 直测)。
  const candidates = filterCandidates(selected, { forkOpenLines, f9Keys })

  const batchLabel = includeSettled ? '批2(--include-settled)' : expiredLease ? '批3(--expired-lease)' : '批1'
  const before = { openRows: rows.filter((r) => r.state === 'open').length }
  console.log(`判定面:HEAD(${headRef}) 未勾 ${before.openRows} 行 [${batchLabel}]`)
  console.log(`候选删除 ${candidates.length} 行(${candidates.map((d) => d.family).filter((f, i, a) => a.indexOf(f) === i).join(' / ') || '无'})`)
  console.log(
    `④c 归档接收方判定面:归档件 ${archiveIndex.files.length} 份(ok=${archiveIndex.ok};` +
      `未判定 ⇒ 指针行一律拒删)`,
  )
  if (rejectLog.length) {
    const tally = rejectLog.reduce((m, x) => ((m[x.verdict] = (m[x.verdict] ?? 0) + 1), m), {})
    console.log(
      `拒删点名 ${rejectLog.length} 行(${Object.entries(tally)
        .map(([k, n]) => `${k}:${n}`)
        .join(' / ')})`,
    )
    for (const rj of rejectLog.slice(0, 12)) {
      const dd = rj.detail?.[0]
      // ④c 的 detail 是归档行对象(点名 path/line/state);④d 的 detail 是定向说明字符串(点名前提)。
      const detailTxt =
        typeof dd === 'string'
          ? ` ⇒ ${dd}`
          : dd
            ? ` → ${dd.path || '归档'} L${dd.line}(${dd.state})`
            : ''
      console.log(`  L${rj.line} [${rj.verdict}] 指向 ${rj.pointed ?? '?'}${detailTxt}`)
    }
    if (rejectLog.length > 12) console.log(`  … 其余 ${rejectLog.length - 12} 行同族`)
  }
  const receiptCandidates = candidates.filter((d) => d.receiver === 'commit')
  if (receiptCandidates.length) {
    console.log(
      `④d 枚回执可删 ${receiptCandidates.length} 行(行号型指针 ∧ 快照行已勾 ∧ 账上编号无 open 正主 ∧ 出现处全为副本/结清墓碑):` +
        [...new Set(receiptCandidates.map((d) => `${d.key}→枚${String(d.token ?? '').slice(0, 10)}${d.accountKey ? `/${d.accountKey}` : ''}`))].join('; '),
    )
  }
  for (const d of candidates.slice(0, 12)) {
    const to =
      d.receiver === 'archive'
        ? `归档 ${d.receiverPath} L${d.survivorLine}`
        : d.receiver === 'commit'
          ? `枚 ${String(d.token).slice(0, 10)} 快照:L${d.survivorLine}${d.accountKey ? ` + ${d.accountKey} 账已结清(凭据 ${(d.tombstones ?? []).length} 处)` : ''}`
          : `幸存/指向 L${d.survivorLine}`
    console.log(`  L${d.row.line} [${d.family}] → ${to} ${d.row.raw.slice(0, 80)}`)
  }
  if (candidates.length > 12) console.log(`  … 其余 ${candidates.length - 12} 行见留痕 md`)
  if (expiredLease) {
    const withClaim = candidates.filter((d) => d.row.claim).length
    console.log(
      `租约门语义(TTL=${ttl.ttlHours}h,来源:${ttl.source}):面上过期租约 ${staleLeaseTotal} 处;` +
        `其中自述副本候选 ${withClaim} 行 + 批1剩余无租约候选 ${candidates.length - withClaim} 行;` +
        `过期租约的任务行本体 ${staleLeaseTotal - withClaim} 处**不代摘**(归各行持有者清账/续租/翻勾)`,
    )
  }

  if (!candidates.length) {
    console.log('无可删行(幂等出口)')
    process.exit(0)
  }

  // 组装新面:未删行逐字不变
  const delSet = new Set(candidates.map((d) => d.row.line))
  const kept = lines.filter((_, i) => !delSet.has(i + 1))
  const newContent = kept.join(eol)

  // 安全阀 1:行数对账 + 未删行逐字不变
  if (kept.length !== lines.length - candidates.length) throw new Error('行数对账失败 ⇒ 拒绝落地')
  let j = 0
  for (let i = 0; i < lines.length; i++) {
    if (delSet.has(i + 1)) continue
    if (lines[i] !== kept[j]) throw new Error(`未删行漂移 L${i + 1} ⇒ 拒绝落地`)
    j++
  }

  // 安全阀 2:复跑 auditPlan 判据面 —— 实现唯一出口 = `verifyNewFace`(纯函数,self-test/镜像
  // 测试直测;本处只负责抛与打印)。五维口径与"副本行全集精确减 N"的立因见该函数头注。
  const after = parseTaskRows(newContent)
  const { violations, stats } = verifyNewFace({
    beforeContent: content,
    afterContent: newContent,
    candidates,
    includeSettled,
  })
  if (violations.length) throw new Error(`复跑对账红 ⇒ 拒绝落地:${violations.join(';')}`)
  console.log(
    `复跑对账:F1=0 / mergeNotes ${stats.beforeMergeNotes}→${stats.afterMergeNotes} / ` +
      `副本行全集 ${stats.beforeCopyRows}→${stats.afterCopyRows} / ` +
      `dupPointerRows ${stats.beforeDupPointer}→${stats.afterDupPointer} / F9 ${stats.beforeF9}→${stats.afterF9}`,
  )

  // 安全阀 3:门71模拟 —— 被删行的**主键编号**(merge-note 族 = keyOfRow 的编号)或**指向编号**
  // (pointer-row 族,④a 已判,此处对删除后再复核)在新面仍存在登记行(keyOfRow 同源重扫)。
  // 刻意不对正文里的引用编号判活 —— 那是别人票的号,不是本行的键(dry-run 实证:G-23 等括注
  // 引用会被误报悬空)。
  const newKeys = new Set(after.filter((r) => r.key).map((r) => r.key))
  const newFaceMissing = []
  let archiveReceivers = 0
  let commitReceivers = 0
  for (const d of candidates) {
    if (d.receiver === 'archive') {
      // 归档接收方:编号判活面 = 归档件里那一行(④c 已在选择期逐条核过「编号逐字命中 ∧ 全部已勾」)。
      // 这里只复核**可核验凭据在场**:来源路径 + 至少一枚复合主键(编号 + 题面前缀),缺一即拒落。
      archiveReceivers++
      if (!d.receiverPath || !(d.composites?.length > 0))
        newFaceMissing.push(`L${d.row.line} ${d.key}(归档接收方缺路径/复合主键凭据)`)
      continue
    }
    if (d.receiver === 'commit') {
      // ④d 判活不复用"新面编号仍在"(那恰是本档要豁免的一格),改为**复算回执**:
      // 快照行仍 done ∧ 账上 token 在现行面无本批之外的 open 正主 ∧ 每处结清凭据复验仍在场。
      // 任何一环在落地这一刻不成立 ⇒ 记入 newFaceMissing 拒落(判据复算走同一批纯函数出口,零第二份)。
      commitReceivers++
      const snap = resolveSnapshot(d.token)
      const snapL = parseTaskRows(typeof snap === 'string' ? snap : '').find((r) => r.line === d.survivorLine)
      if (!snap || snapL?.state !== 'done') {
        newFaceMissing.push(`L${d.row.line} ${d.key}(回执复算:枚 ${String(d.token).slice(0, 10)} 快照取不到或行 ${d.survivorLine} 不再是已勾)`)
        continue
      }
      if (d.accountKey && ledgerFace?.openByKey.get(d.accountKey)?.some((x) => !hasCopyMark(x.raw) && !delSet.has(x.line))) {
        newFaceMissing.push(`L${d.row.line} ${d.key}(回执复算:${d.accountKey} 仍存本批之外的 open 正主)`)
        continue
      }
      const badSite = (d.tombstones ?? []).find(
        (s) =>
          s.kind === 'tombstone'
            ? !/^\s*<!--/.test(String(ledgerFace?.lines?.[s.line - 1] ?? ''))
            : ledgerFace?.lineRows.get(s.line)?.state !== 'done',
      )
      if (badSite) {
        newFaceMissing.push(`L${d.row.line} ${d.key}(回执复算:结清凭据 L${badSite.line} 复验不是墓碑/done 行)`)
        continue
      }
      continue
    }
    const id = d.family.startsWith('pointer') ? d.key : d.row.key
    if (id && !newKeys.has(id)) newFaceMissing.push(`L${d.row.line} ${id}`)
  }
  if (newFaceMissing.length) throw new Error(`门71模拟红(编号判活悬空)⇒ 拒绝落地:${newFaceMissing.slice(0, 10).join(';')}`)
  console.log(
    `门71模拟:被删行主键编号在新面全部判活(台账面 ${candidates.length - archiveReceivers - commitReceivers} 行 + ` +
      `归档接收方 ${archiveReceivers} 行,凭复合主键点名 + 枚回执 ${commitReceivers} 行,复算快照/done 正主/结清凭据三维)`,
  )

  if (!apply) {
    console.log(`⚠️  --dry-run,未落地。真跑:node scripts/plan-copy-row-purge.mjs --apply`)
    return
  }

  // 留痕 md + 对象空间 CAS 落地(归档器同通道:writeBlob → commitTreeWithIndex → casUpdateRef)。
  // **留痕必须是 .md 形态**(2026-10-08 实证教训):守门 71 的归档豁免只认
  // `.ihui-agent/archive/PROJECT_PLAN_*.md`(archivedCopy:src.includes(marker)),jsonl 不在
  // 豁免面 ⇒ 批1的 381 行删除被 --heal 当丢失回捞过 1 条(O88)。md 与删行**同笔提交**入库,
  // 豁免按 HEAD 树判(同面)⇒ 自愈不再回捞。文件含历次累计:重读 HEAD 面已有内容再追加本次段。
  const day = new Date().toISOString().slice(0, 10)
  const trailRel = `.ihui-agent/archive/PROJECT_PLAN_copy-purge-${day}.md`
  const existing = catBatch(ROOT, [`HEAD:${trailRel}`]).get(`HEAD:${trailRel}`) ?? ''
  const section = candidates
    .map(
      (d) =>
        `- L${d.row.line} [${d.family}] → ` +
        (d.receiver === 'archive'
          ? `归档 ${d.receiverPath} L${d.survivorLine}(${(d.composites ?? []).join('; ')})`
          : d.receiver === 'commit'
            ? `枚回执 ${String(d.token).slice(0, 12)} 快照:L${d.survivorLine} 已勾` +
              `${d.accountKey ? ` + ${d.accountKey} 现面结清凭据 ${(d.tombstones ?? []).map((s) => `L${s.line}[${s.kind}]`).join(',')}` : ''}`
            : `幸存/指向 L${d.survivorLine}`) +
        ` (head ${headRef.slice(0, 11)})\n${d.row.raw}`,
    )
    .join('\n')
  const header = existing
    ? ''
    : `# PROJECT_PLAN 副本行物理归并留痕(G-1102638)\n\n> 每条 = 删除行原文逐字留痕(守门 71 归档豁免按「原文可在本目录 PROJECT_PLAN_*.md 找到」成立)。\n> 行已真删(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕),本文件是唯一账外副本,git 历史亦可溯。\n\n`
  const trailText = header + existing + (existing ? '\n' : '') + section + '\n'

  // 安全阀 4:留痕逐字在场 —— 删掉的每一行必须能在留痕 md 里找到**原文**(守门 71 的归档豁免
  // 判的就是"原文可在该目录 PROJECT_PLAN_*.md 找到";留痕拼装出问题时这一档当场拦,不靠人眼)。
  const trailGaps = candidates
    .filter((d) => !trailText.includes(d.row.raw))
    .map((d) => `L${d.row.line}`)
  if (trailGaps.length) throw new Error(`留痕缺行 ⇒ 拒绝落地:${trailGaps.slice(0, 10).join(';')}`)

  const ledgerBlob = writeBlob(newContent, { root: ROOT })
  const trailBlob = writeBlob(trailText, { root: ROOT })
  const batchDesc = includeSettled
    ? `批2 落账注记行清偿 — 删 ${candidates.length} 行(注记 ${stats.beforeMergeNotes}→${stats.afterMergeNotes};` +
      `F5 差值棘轮随基线退役 plan-task-state-baseline F5=0,存续性同批改 0;`
    : expiredLease
      ? `批3 过期租约副本行清偿 — 删 ${candidates.length} 行(六判据联用:自述副本/无落账注记/无有效租约` +
        `[TTL=${ttl.ttlHours}h,面上过期 ${staleLeaseTotal} 处]/有接收方/非F9/非F1;租约在飞行与带注记行保留,任务行本体不代摘;`
      : `批1 同主键副本行物理归并 — 删 ${candidates.length} 行` +
        `(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;`
  const msg =
    `chore(plan): G-1102638 ${batchDesc}` +
    `复跑auditPlan对账F1=0/F9不增;逐行留痕 ${trailRel})`
  const committed = commitTreeWithIndex({
    root: ROOT,
    parent: headRef,
    message: msg,
    entries: [
      { path: LEDGER, blob: ledgerBlob },
      { path: trailRel, blob: trailBlob },
    ],
  })
  const okCas = casUpdateRef(committed.commit, headRef, { root: ROOT })
  if (!okCas) throw new Error(`CAS 失败:HEAD 已被推进(${headRef.slice(0, 11)} 不再是当前值)⇒ 不重试,重读面后再跑(幂等)`)
  console.log(`✅ CAS 成功 ${headRef.slice(0, 11)} → ${committed.commit.slice(0, 11)}(删 ${candidates.length} 行,行数 ${lines.length}→${kept.length})`)
  // parentRef 必须传**父提交 sha 字面量**:headRef 是 ref 名,CAS 推进后再解析就指到新提交,
  // 「索引==父提交态」的判据会把自家该动的路径误判成"别人已暂存"而 skip(2026-10-08 批3 实证
  // skipped=2;批2 同型事故同修法)。用新提交的父提交 sha,判据面回到 CAS 前那一格。
  const parentShaLiteral = git(['rev-parse', `${committed.commit}^`], { root: ROOT })
  const aligned = alignSharedIndex({ root: ROOT, paths: [LEDGER, trailRel], parentRef: parentShaLiteral })
  console.log(`✅ 共享索引对齐 moved=${aligned.moved.length} already=${aligned.already.length} skipped=${aligned.skipped.length}(工作树滞后一格,收尾由调用方对齐)`)
  // 旁路 CAS 不跑钩子 ⇒ 必须进跳门留痕台账(2026-10-11:本器是第五家落地器,由 bypass-git 镜像的
  // 「用 casUpdateRef 而不留痕」不变量锁当场点出)。上面的 md 逐行留痕记的是**删了哪些行**,
  // 与本台账记的是**这枚提交绕过了门禁**两件事,后者不可由前者代替。
  const at = attestBypassCommit(committed.commit, { root: ROOT, headBefore: parentShaLiteral, source: 'plan-copy-row-purge' })
  if (!at.ok) console.error(`⚠️ 旁路留痕未写入(${at.why})⇒ 这一枚在跳门总量台账里仍是 unknown`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(String(e?.message ?? e))
    process.exit(1)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
