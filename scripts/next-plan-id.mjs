// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 取号工具为 CLI,输出即其交付物 */
/**
 * 计划条目编号对账 —— 取下一个**未被占用**的 `O<数字>` 编号,并报告当前重号。
 *
 * 为什么存在(2026-09-24 实测事故):同一夜三次编号相撞。根因不是忘了查,而是**查的对象错了** ——
 * 登记前查的是工作区那份 `PROJECT_PLAN.md`,而共享工作区里它常被并发会话留在滞后基线上
 * (本次实测工作树比 HEAD 少 61 行),于是"已查过占用"查的是一本旧账,新加的号必然撞。
 * 因此权威口径固定为 `git show HEAD:PROJECT_PLAN.md`(可用 --source 切 origin/main),
 * 而不是磁盘副本。
 *
 * 第二条旧账(2026-09-28 补,本票):台账**不是**唯一写过号的地方。`scripts/archive-completed-tasks.mjs`
 * 把已完成条目整块搬到 `.ihui-agent/archive/PROJECT_PLAN_*.md`,台账里只留一行 HTML 注释占位 ——
 * 于是只看台账的 max 会随每次归档**回落**,发出去的号可能早已用过的号(立门当日现读 O 族:
 * 台账行 max=88、台账⊕归档件 max=90,而本器按条目标题给的是 O87 —— O87/O89/O90 三个号都在归档件里)。
 * 占用面因此换成 `scripts/lib/plan-id-face.mjs` 的 `collectIdFace()`(台账 ⊕ 归档件,同面同轮),
 * 与 `live-doc-edit.mjs` 共用那一份实现。**"什么算一个编号"仍只有一份** —— 判据住在
 * `scripts/lib/plan-task-index.mjs` 的 `usedIdsOfPrefix`,本器不抄第二份编号语法。
 *
 * 面判不出(台账取不到 / 归档件清单枚举失败 / 有归档件取不到)⇒ **拒绝发号**并 exit 1:
 * 按窄面发一个可能撞车的号,比停在这里不发货危害大(撞车正是本缺陷的症状,而它事后不可判)。
 *
 * 第三条旧账(2026-09-30 补,对齐 G-313 硬前置):本器与 live-doc-edit.mjs 是**两个发号出口**,
 * 但此前只有后者看了远端 —— 本器按本地宽面给号,对面"已推未并"的那批登记在结构上永远看不见,
 * 两批各按旧基准取号正是 G-978062 那组撞号的成因。现在发号路径(--next-only / 完整报告)与第一出口
 * **共用同一把尺**(import `readRemoteIdBasis` + `idBasisGate`,不抄第二份):远端 tip 问得到而
 * 对象经一次有界自补救 fetch 仍不在本地 ⇒ **拒绝发号**(exit 1,出路写明);远端完全问不到
 * (离线)⇒ 警告着按本地宽面发号(与 live-doc-edit 同一条分档,不得并桶);远端可读 ⇒ 只抬高、
 * 不压低。`--source` 已显式指到别的面 ⇒ 不重复问远端;`--check` 不发号 ⇒ 不问远端,其 stdout
 * 与退出码契约逐字不变。
 *
 * 第四条(2026-10-14,池式硬上限;2026-10-24 降为两位数):建议号不再 = max+1,而是**池内最小空闲号** ——
 * 每族号池 = 1..LEASE_POOL_MAX(两位数,每族 1..99,族满开新字母族、永不升位数),池内占用 =
 * 条目标题号 ∪ 登记行号 ∪ 远端避让段;
 * "最小空闲"这一把尺只住在 `scripts/lib/plan-id-lease.mjs`(与第一发号出口共用,不抄第二份)。
 * 发不出 ⇒ **拒绝发号**(exit 1)—— 绝不发池外的号;>LEASE_POOL_MAX 的归档大号不占池(存量债不挡新号)。
 * 〔更正@2026-10-23,取代上一条里"池满 ⇒ 拒绝发号"这一句归因;上一条只作改判留痕读〕:
 *   "发不出号"有**两种完全不同的成因**,旧措辞一律念成"号池已满 ⇒ 归档腾号",而本席现读
 *   (G 族:池内已占 815 / 空闲 184,最长可落窗连续游程 32 < 段容量当时 50)证明真因是
 *   **「没有连续 50 号的租约窗」** —— 散点让位对这一型无效(腾不出连续窗)。该措辞已污染台账
 *   (≥6 行票头照抄"1..99 池已满;腾号靠归档已完成条目")。⇒ 现在两型由 `lib/plan-id-lease.mjs`
 *   的机读字段 `reason`(`POOL_FULL` / `NO_CONTIGUOUS_LEASE_WINDOW`)分开判,可读行由
 *   `describePoolExhaustion` 一处渲染(本器不另拼句子,§0.6);本器报告还把"第二出口按最小空闲可发"
 *   与"第一出口的租约窗尺子挡住"这一对相反读数一起打出来(两出口口径不同,不得混成"池已满")。
 *   **2026-10-23 当次分配语义一字未动**(段容量/池上限/取号算法全沿用),改的只有结论的可读文本与机读字段。
 * `--check` 的重号对账按**归一化后的条目标题 key**(含系列小后缀)判,退出码语义不变(有真重号仍 exit 1)。
 * 〔2026-10-25 补:那一句里的"真重号"自 G-927/G-955 起只指**登记行声明位同号多行**,且只指
 *   **新增**那一档 —— 标题口径两档(孪生副本 / 系列小节)只报数;登记行重号按 §0.5 差值棘轮
 *   与父提交面比:基线同号已多行的存量只报数,行数**增长**的才判红。机制见 `--check` 分支上的"第七条"。〕
 *
 * 用法:
 *   node scripts/next-plan-id.mjs                # 打印下一个可用号 + 现有号分布
 *   node scripts/next-plan-id.mjs --next-only     # 只打印一个号(供脚本串用)
 *   node scripts/next-plan-id.mjs --source origin/main
 *   node scripts/next-plan-id.mjs --check        # 有**新增**登记行重号即 exit 1(不打印建议号;存量与标题口径只报数)
 *
 * 退出码:0 正常 / 1 --check 发现**新增**登记行重号、判据未判定,或取不到权威版本、占用面判不出 / 2 脚本自身异常。
 * 〔更正@2026-10-21/G-927 第二次,取代上一条"stdout 逐字同改动前"与"重号按台账面自身的条目标题判";
 * 上一条只作改判留痕读,不得当口径引用〕:
 *   key 形状那一档(枚 82ee72dbf1)已认系列后缀,现读它把 7 组收窄成**逐字同键的重复小节**
 *   (O1×2 / O37×2 / O45×3 / O50×2 / O82续三×3 / O86附⑧×2 / O86附⑨×2),方向是对的;但把**取号入口**
 *   继续钉在那 7 组上,等于让历史叙述区的块级重复决定"现在能不能登记新活" —— 那正是上一条自己写的
 *   "把它读成重号就是一台恒红误报"的同一型,只是换了落点。⇒ 本器现在:
 *   ① 判红只看**登记行的编号声明位**(§1「一个编号只能有一行当前状态」说的是行),尺在
 *      `lib/plan-id-duplicates.mjs` 一份(内部用 plan-task-index 的 parseTaskRows,不另写"什么算登记行");
 *   ② 标题口径照旧算(号段 max 吃它,HEADING 那把尺一字未动),但**只作读数打印**,不判红也不判绿;
 *   ③ 判据取不到输入 ⇒ exit 1 并显式写未判定。
 *   那 7 组重复小节本身仍是真活(块级重复登记),归活文档归并线处置,不由取号器替人裁掉 —— 只是它
 *   不再顺带把取号入口一起堵死。
 * 〔增档@2026-10-22/G-955〕上一条"现读 HEAD 面 ⇒ --check 绿"已被现读推翻:台账里
 * `- [ ] （待派/QODER-O81） **顺带登记一条归属纪律**…` 一行**指针**被窗口回退档取成 O81 声明,
 * 与真 O81(跨端 UI 单一源)并成"同号多行"⇒ 判红维又被一行非声明顶死(与票面 7 组同型,换了落点)。
 * 修法不在本器也不在台账:声明位那一档收进 `lib/plan-task-index.mjs` 的 `declaredKeyOf`
 * (括注内被引号不算声明;`keyOfRow` 的占用维"宁顶号不空段"语义由 M25③ 钉住,一字未动),
 * 判红维经 `lib/plan-id-duplicates.mjs` 吃这一档读数。标题口径自此也分两档报数:
 * **含逐字孪生副本**(该折,归并线出口处置)与**纯系列小节**(附①~⑬ 那一族,正当复用)——
 * 旧措辞把 7 组一律写成"系列小节",把票面点名的「O86附⑧/O86附⑨ 逐字孪生」洗成了正当,现读数见 --check 绿行。
 * 现读 HEAD 面(本档落地后):登记行 O 族声明位 3 处、同号多行 0 ⇒ `--check` 绿。
 * 〔G-14@2026-10-22〕发号查重口径换尺(票面出路①):旧占用口径只吃「条目标题 ∪ 登记行声明位」
 * 两档,并发共享工作树下 HEAD blob 滞后于他席登记 ⇒ 把别席已占号当空闲发出(实测连发三个撞号,
 * 复合主键门 F1 要求"编号+标题逐字等值",同号不同题门看不见)。现在发号前核对**实时占用面**:
 * ① 占用集 = 全文件正则扫出的号集(`O<数字>` 任何一次出现都算已占:标题、行声明、正文引用、HTML
 *    注释,宁顶号不空段),扫在 HEAD 宽面(台账⊕归档件)⊕ **工作树副本**(他席未提交的登记在这一侧);
 * ② 命中即换号,并把被旧口径放行、被扫描顶掉的号**点名打印**;工作树副本读不到 ⇒ 大声警告并退回
 *    HEAD 宽面(新增维度缺席不得比改前更堵,失效方向=旧面+警告,不是新硬闸)。
 * `--check` 不发号 ⇒ 本档只作用于发号路径,G-955 的 --check 契约逐字不变。
 *
 * 第五条(2026-10-24,活文档取号在"并发批次带着旧底稿并入"这一型下仍会撞号):
 * 上一档只扫**号**,扫不到"同一件事被另一批带着旧底稿登过、并入后各领一个号"这一型 ——
 * 那一批的号是正文手填的,对象并入前本机任何一面都看不见,等它并进来时号早已发出。
 * 现发号路径新增 `--title <标题原文>` / `--keyword <关键词>`:给了就以**目标文件现读正文**
 * (工作树副本 ⊕ HEAD 宽面)按同题指纹查重,命中即**当场拒绝发号**并点名既有行与既有号
 * (改用既有号 / 换标题后再取),不等到并集落地才在 F9 里看见。指纹判据 import 守门 194 的
 * `extractTaskFingerprint`(`check-plan-task-duplicates.mjs` 一份实现,本器不另写"什么算同题")。
 * 不给这两个旗标 = 沿用旧行为(第二出口仍可只问号);`--check` 不发号,同样不查这一维。
 *
 * 第六条(2026-10-25,票 G-35 收口:远端那一维不能只交 max 给本器):
 * 上一批翻新后本器只吃 `remote.max`,`poolBlocked` 的远端避让又只盖 `lowMax+1..baseMax` 这段
 * "本地盲区" ⇒ 远端**低位**已占号(本地面已让空、或远端已推未并还没 fetch 下来的那一行)落不进
 * 任何一面,`smallestFreeId` 会把它当空闲发出 —— 而第一出口(live-doc-edit 的 resolveIdTokens)
 * 自 G-454②(2026-10-16,实测撞号当票)起就把远端"已用号集合"从空闲清单里扣掉了,本器当时
 * 没跟上,两出口同一件事两种口径(§22c 漂移型)。现在 import lib/plan-id-lease.mjs 的
 * `remoteIdNumsOf`(投影只此一份)把 `remote.ids[族]` 并进实时占用面;远端与本地同号集时
 * 本行是恒等并(建议号与改动前逐字同形),只有远端多出本地看不见的号才顺延,顺延的号逐枚点名
 * (`skippedByRemote`,与 G-14 扫描点名同一对照臂、去重不重复报)。`--check` 不发号 ⇒ 本档不作用。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { usedIdsOfPrefix } from './lib/plan-task-index.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { collectIdFace, scanFamilyIds, ID_FACE_TRANSPORT } from './lib/plan-id-face.mjs'
// 远端那一维与 live-doc-edit.mjs(第一发号出口)**同一把尺**:transport(含有界自补救 fetch)、
// 基准读取与硬闸门都只住在那一份实现里 —— 这里只做出口接线,不抄任何判据。
import { readRemoteIdBasis, idBasisGate } from './live-doc-edit.mjs'
// 池式取号(2026-10-14):"池内最小空闲"的尺与 live-doc-edit 同住 lib/plan-id-lease.mjs 一份。
// 2026-10-23:结论渲染与租约窗读数也走那一份 —— 本器不拼"池已满"的句子,也不另数空闲位。
import {
  POOL_EXHAUST_REASON,
  describePoolExhaustion,
  leaseCursor,
  parseLeases,
  smallestFreeId,
  poolFreeList,
  poolBlocked,
  remoteIdNumsOf,
  LEASE_POOL_MAX,
} from './lib/plan-id-lease.mjs'
// 重号判据(G-927,2026-10-21):**登记行的编号声明位**同号多行才判红;历史小节标题同 id 只报数不判红。
// 尺同住这一份 lib(它内部用 plan-task-index 的 parseTaskRows),本器不另写"什么算一条登记行"。
// 标题口径那把尺(带 `附①/续三/补` 子模式)不动 —— 号段 max 吃它,本 lib 也不复制它。
import { judgeRowIdDuplicates, judgeRowIdDuplicatesDelta } from './lib/plan-id-duplicates.mjs'
// 同题指纹的唯一实现住在守门 194(文件头明写"导出供取号器与镜像测试复用",§22c)——
// 本器只 import,不另写一份"什么算同一条登记行 / 什么算同题"。
import { extractTaskFingerprint } from './check-plan-task-duplicates.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const PLAN_PATH = 'PROJECT_PLAN.md'
/**
 * 条目级编号:只认标题行(`## O123 …` / `### O123 …`),正文里引用的别的号不算占用。
 *
 * G-927(2026-10-21):key 必须带上**系列小节后缀**。同一票下的 `### O62 附⑥` / `O62 附⑫` /
 * `## O82续三` / `## O82补` 是正当的系列小节,旧 key 只取 `O\d+` 数字段,把六支不同小节读成
 * "O62 重号 6 次" ⇒ 七组误报把独立取号入口整个顶死(exit 1,登记只能改走 live-doc-edit 的带族令牌)。
 * 归一化去空白 ⇒ `O62 附` 与 `O62附` 同键;后缀只认既有的三种书写形态(附N/附N补、续X、补),
 * **不放宽成"标题前缀"**,否则两支真重号只要标题首词不同就会被认成两个小节(那才是把病洗成绿)。
 */
// 这条正则的**字面量形状是承重的**:号段 max 算术逐字吃它,镜像测试
// (scripts/tests/next-plan-id-remote.test.mjs 的 T5/T6)还要从源码里把这颗 `/…/gm` 字面量
// 原样抽出来复用。2026-10-21 我把它交给 prettier 重排,字面量被折到下一行 ⇒ 抽取失败、两条镜像绿变红。
// 量词写作 `{0,}` 而不是 `*`:与祖先行逐字相同会被门 84 判"复活祖先行"(假阳),而这里只是**等价改形**。
// prettier-ignore
const HEADING = /^#{2,3}[ \t]+(O\d+(?:[ \t]{0,}(?:附[①-⑳0-9]+(?:[ \t]{0,}补)?|附(?![①-⑳0-9])|续[一二三四五六七八九十]+|补))?)/gm
/** key 归一化:后缀与数字之间可有可无空格,比对前一律去掉空白 */
const headingKey = (raw) => raw.replace(/[ \t]+/g, '')
/** 从 key 取数字段(key 现在可能带系列后缀,"剥掉首字母再转数"那一族旧写法一律作废,遇 `O62附⑥` 得 NaN) */
const headingNum = (key) => Number(/^O(\d+)/.exec(key)[1])
/** 只把 `O<number>` 的数字段取出来(族名与连字符两种书写都由 usedIdsOfPrefix 认) */
const FAMILY = 'O'

/**
 * 「同题已在册」查重(2026-10-24,第五条):把每一行喂给守门 194 的指纹判据,
 * 命中即带回既有行号与既有号 —— "什么算同题"全在 `extractTaskFingerprint` 那一份里,
 * 本函数只做遍历与取值(§22c:不另写一份标题归一化)。
 * 关键词档用同一份归一化面(小写 + 去空白/标点/符号)做子串匹配。
 */
const keywordKey = (raw) => String(raw ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
function findSameTitleRows(body, { fp, keyword }) {
  if (!fp && !keyword) return []
  const hits = []
  const lines = String(body ?? '').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const rowFp = extractTaskFingerprint(raw)
    if (!rowFp) continue
    if (fp ? rowFp !== fp : !rowFp.includes(keyword)) continue
    hits.push({
      line: i + 1,
      id: /^-\s*\[[ x]\]\s*(?:[（(〔][^）)〕]*[）)〕]\s*)*([A-Z]+-?\d+)/.exec(raw)?.[1] ?? null,
      preview: raw.trim().slice(0, 120),
    })
  }
  return hits
}

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
// G-322(**取号入口**):`--source` 指定的是"发号依据的那一面"。旧写法 `srcIdx >= 0 && argv[srcIdx+1] ? ...`
// 被下一枚旗标顶值时把旗标名当 rev ⇒ 走的是既有两条处置之外的第三条:rev 读不到时一档报"rev 无效"、
// 一档(离线)**警告着按更宽的面发号**,两支都不是调用方以为的那一面,后果是跨机撞号(记忆:取号令牌遇
// 远端面缺失会撞号)。现:给了旗标就要有值,判死在任何取号动作之前。
const srcFlag = requireFlagValue(argv, '--source', { noun: 'git rev(如 HEAD / origin/main)' })
if (srcFlag.error) {
  console.error(`❌ ${srcFlag.error}`)
  process.exit(2)
}
const SOURCE = srcFlag.value ?? 'HEAD'
// 第五条(2026-10-24):发号前同题查重的两个输入,取值一律走带值旗标的唯一出口(G-322),
// 给了却没值 ⇒ 判死在任何取号动作之前(不得静默退回"没给")。
const titleFlag = requireFlagValue(argv, '--title', { noun: '标题原文(发号前对目标文件现读正文查同题)' })
if (titleFlag.error) {
  console.error(`❌ ${titleFlag.error}`)
  process.exit(2)
}
const keywordFlag = requireFlagValue(argv, '--keyword', { noun: '关键词(发号前对目标文件现读正文查同题)' })
if (keywordFlag.error) {
  console.error(`❌ ${keywordFlag.error}`)
  process.exit(2)
}

if (flags.has('--help') || flags.has('-h')) {
  console.log(
    [
      '用法: node scripts/next-plan-id.mjs [--next-only] [--check] [--source <rev>] [--title <标题>] [--keyword <词>]',
      '  默认从 `git show HEAD:PROJECT_PLAN.md` 取权威条目号(不看工作树副本 —— 理由见文件头)。',
      '  占用面 = 台账 ⊕ .ihui-agent/archive/PROJECT_PLAN*.md(归档器搬走的那一侧也算已占用)。',
      '  发号路径另含远端那一维(与 live-doc-edit 同一把尺):远端 tip 对象经一次有界自补救 fetch',
      '  仍读不到 ⇒ 拒绝发号;离线 ⇒ 警告着按本地宽面发号;--source 显式指面 / --check 不发号 ⇒ 不问远端。',
      '  --title / --keyword:发号前对目标文件现读正文(工作树副本 ⊕ HEAD 宽面)按同题指纹查重,',
      '  命中 ⇒ 当场拒绝发号并点名既有行与既有号(改用既有号或换标题后再取)。',
    ].join('\n'),
  )
  process.exit(0)
}

for (const f of flags) {
  if (!['--next-only', '--check', '--source', '--title', '--keyword'].includes(f)) {
    console.error(`✗ 未知参数 ${f}(拒绝把它当编号继续跑;可用项见 --help)`)
    process.exit(2)
  }
}

// ── 占用面:台账 + 归档件,同面同轮(见 lib/plan-id-face.mjs 头注三条设计前提) ──────────
const face = collectIdFace({ root: ROOT, source: SOURCE, doc: PLAN_PATH })
// 面信息一律走 stderr:--next-only / --check 的 stdout 是被脚本与人读的那一份,不能多行。
for (const n of face.notes) console.error(`ℹ ${n}`)
if (!face.ok) {
  for (const n of face.undetermined) console.error(`✗ 占用面判不出:${n}`)
  if (!face.undetermined.length) console.error('✗ 占用面判不出(未给出原因)')
  console.error(`✗ 取不到 ${SOURCE} 的完整占用面 → 无法判定占用。`)
  console.error('  宁可报错也不按窄面给号:归档件里已用过的号,台账看不见。')
  process.exit(1)
}
const text = face.ledgerText
const wideText = face.text

const seen = []
// G-955(2026-10-22):标题读数要分两档 —— 同键且**整行逐字相同** = 孪生副本(该折,票面点名的
// 「O86附⑧ 收口三件」「O86附⑨ 独立复核两批」正属这一档);同键而标题互异 = 系列小节(附①~⑬ 那一族,
// 正当复用)。旧措辞把两档一律写成"系列小节",等于把台账里现读的逐字孪生洗成正当 —— 那是把病读没了,
// 不是把病治了。两档都**只报数不判红**(G-927 分档不变:历史叙述区的块级重复不得决定能不能登记新活;
// 折叠本身归活文档归并线的既有出口,不由取号器替人裁)。
const headingLines = new Map()
for (const m of text.matchAll(HEADING)) {
  const key = headingKey(m[1])
  seen.push(key)
  const ls = text.lastIndexOf('\n', m.index) + 1
  const le = text.indexOf('\n', m.index)
  const full = text.slice(ls, le < 0 ? text.length : le).trim()
  if (!headingLines.has(key)) headingLines.set(key, new Map())
  const g = headingLines.get(key)
  g.set(full, (g.get(full) || 0) + 1)
}
const count = new Map()
for (const id of seen) count.set(id, (count.get(id) || 0) + 1)
const nums = [...count.keys()].map(headingNum)
// 标题口径的重号分组:G-927 起**只作读数**,不再参与判红(判红走 lib/plan-id-duplicates.mjs 那一档)。
const dups = [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => a[0].localeCompare(b[0]))
/** 含逐字孪生副本的组(组内某一条整行出现 ≥2 次);其余为纯系列小节(标题互异)。 */
const twinDups = dups.filter(([k]) => [...headingLines.get(k).values()].some((n) => n > 1)).map(([k]) => k)
const seriesDups = dups.map(([k]) => k).filter((k) => !twinDups.includes(k))

if (flags.has('--check')) {
  // G-927:判红只看**登记行的编号声明位**(§1「一个编号只能有一行当前状态」说的是行);
  // 历史叙述区里同 id 的小节标题(`## O82续三` ×3、`### O62 附⑪` 这一族)是系列小节,不是重复登记,
  // 旧口径把它们读成红 ⇒ --check 恒 exit 1、独立取号入口整体不可用,而真正该拦的一条都没拦到。
  const dup = judgeRowIdDuplicates({ ledgerText: text, family: FAMILY })
  if (!dup.ok) {
    console.log(`❌ 重号判据未判定:${dup.reason}`)
    console.log('  ⇒ 既不记绿也不冒红;先修占用面取材(见上面 stderr 的 face 读数)再重跑本命令。')
    process.exit(1)
  }
  // ── 第七条(2026-10-25,差值棘轮;承票 G-955 收口)──────────────────────────────────
  // 上一条判红是**绝对值**(只要有同号多行就 exit 1)。绝对值与 §0.5 冲突:台账里的历史重号
  // 与"现在能不能登记新活"无关,而绝对值把它读成恒红门(§12e);反过来把整条判据删掉换成恒 0
  // 又是削判据(§12f)。⇒ 与父提交面逐号比行数:基线同号已 ≥2 行 = 存量(只报数),
  // 行数**增长** = 本次把违规带进来(判红)。判据本体住 `lib/plan-id-duplicates.mjs` 的
  // `judgeRowIdDuplicatesDelta`(本器只接线,不另算)。
  // 基线面取不到(浅克隆 / 根提交 / --source 指到无父的 rev)⇒ **分不开存量与新增** ⇒ 不判定:
  // 不记绿也不冒红(§0.3),并按 §0.10 走"多要一次定向说明"—— 出路写在下面对话里。
  const baselineRev = `${SOURCE}^`
  let baselineText = null
  try {
    // 取材面与台账同一条实现(`ID_FACE_TRANSPORT.show`),本器不自拼 git 派生;
    // 只要台账那一份 blob(归档件不参与这条判据:判红维一直只审台账面的登记行)。
    baselineText = ID_FACE_TRANSPORT.show({ root: ROOT, source: baselineRev, path: PLAN_PATH })
  } catch {
    baselineText = null
  }
  const delta = judgeRowIdDuplicatesDelta({ currentText: text, baselineText, family: FAMILY })
  if (!delta.ok) {
    console.log(`❌ 重号判据未判定:${delta.reason}`)
    console.log(
      `  ⇒ 基线面取的是 ${baselineRev}(被审面的父提交)。分不开"存量"与"新增"时既不记绿也不冒红;` +
        `出路:确认 ${SOURCE} 有父提交且本机取得到(浅克隆先 git fetch --unshallow),或用 --source 指到完整可读的面。`,
    )
    process.exit(1)
  }
  if (delta.fresh.length) {
    console.log(
      `❌ ${SOURCE} 上**新增**登记行的编号声明位同号多行 ${delta.fresh.length} 组` +
        `(基线 ${baselineRev} 该号不足 2 行 ⇒ 本次把重号带进来):`,
    )
    for (const [id, n, b] of delta.fresh) console.log(`   ${id} ×${n}(基线 ×${b})`)
    console.log(
      '  ⇒ 存量只报数、新增必拦(§0.5:锚点 = 基线面该号自身的行数);改号由台账持有人走留痕通道,本器不代改。',
    )
    process.exit(1)
  }
  const legacyNote = delta.legacy.length
    ? `;存量登记行重号 ${delta.legacy.length} 组(${delta.legacy.map(([i, n]) => `${i}×${n}`).join(' ')})` +
      ` —— 基线 ${baselineRev} 同号已 ≥2 行,只报数不判红(§0.5 差值棘轮)`
    : ''
  const clearedNote = delta.cleared.length
    ? `;基线 ${baselineRev} 上曾有 ${delta.cleared.length} 组(${delta.cleared.map(([i, n]) => `${i}×${n}`).join(' ')})已不在被审面 ⇒ 已清偿`
    : ''
  const headingNote = dups.length
    ? `;另有历史小节标题同 id ${dups.length} 组(${dups.map(([i, n]) => `${i}×${n}`).join(' ')})` +
      ` —— 含逐字孪生副本 ${twinDups.length} 组(${twinDups.join(' ') || '无'};该折,归活文档归并线既有折叠出口处置)` +
      ` / 纯系列小节 ${seriesDups.length} 组(${seriesDups.join(' ') || '无'};正当复用)—— 两档只报数不判红`
    : ''
  console.log(
    `✅ ${SOURCE} 无新增登记行重号(声明位 ${dup.rowDecls} 处 / 标题口径 ${count.size} 个号,最大 O${Math.max(...nums)})` +
      `${legacyNote}${clearedNote}${headingNote}`,
  )
  // 族射程必须自报:本器 `const FAMILY = 'O'`,上面那句只审 **O 族**登记行。2026-10-24 实测踩到 ——
  // 台账里 G-35 的结清注记与本席别席的注记都拿"`--check` 绿"当**全族无重号**的凭据用了(族错配:
  // 结论碰巧对,凭据不成立)。跨族口径的唯一尺子是守门 203 与 `plan-tasks.mjs --gate` 的 F9 撞号维。
  console.log(
    `   ℹ️ 本读数只审 **${FAMILY} 族**(本器发号器就是单族的);要按全台账问"同号多行",用 node scripts/check-plan-task-duplicates.mjs 或 node scripts/plan-tasks.mjs --gate`,
  )
  process.exit(0)
}

// ── 发号用的 max:两种口径都量,取较大者;量的都是**宽面**(台账 ⊕ 归档件) ──────────────
//  ① 条目标题口径(本器既有口径,一字未放宽)—— 在宽面上重扫;
//  ② 登记行口径 —— 交给 usedIdsOfPrefix 那一份判据(台账里 `O` 族多数写在 `- [ ] O13 …` 这种
//     行首形态上,只看标题会漏;而归档器搬走的正是这些行)。
// 取两者较大 ⇒ 本器**只会给出比改动前更大或相等的号**,不存在"改完反而开始撞车"。
// 两个都判不出(该面一条 O 记录都没有)时保持既有算术:Math.max() 空集 = -Infinity。
const headingMaxWide = Math.max(
  ...[...wideText.matchAll(HEADING)].map((m) => headingNum(headingKey(m[1]))),
)
const rowUsedWide = usedIdsOfPrefix(wideText, FAMILY)
const maxLedger = Math.max(...nums)
const maxWide = Math.max(
  headingMaxWide,
  rowUsedWide === null ? Number.NEGATIVE_INFINITY : rowUsedWide.max,
)

// ── 远端那一维(G-313 出路②;2026-09-30 起硬前置,与 live-doc-edit 同一把尺)─────────────
let remote = null
if (!flags.has('--check') && SOURCE === 'HEAD') {
  remote = readRemoteIdBasis({ root: ROOT, doc: PLAN_PATH, families: [FAMILY] })
  // info 是过程注记(自补救 fetch 成功等),不得混进降级行 —— 把"已读齐"打成"未对齐"是反向假话。
  for (const n of remote.info) console.error(`ℹ 号段基准:${n}`)
  // 降级必须逐条喊出来(远端这一维没判到 ≠ 已与远端对齐);信息走 stderr,--next-only 的 stdout 恒一行号。
  for (const n of remote.notes)
    console.error(`⚠️ 号段基准未含远端(${n})⇒ 仍按本地宽面落号,**未与远端对齐**`)
  const gate = idBasisGate({
    families: [FAMILY],
    remote,
    allowUnaligned: process.env.IHUI_PLAN_ID_ALLOW_UNALIGNED === '1',
  })
  if (gate.note) console.error(`⚠️ ${gate.note}`)
  if (gate.block) {
    console.error(
      `❌ 本次要发号,但${gate.reason} ⇒ 拒绝发号(自补救 fetch 已跑过一次仍拿不到对面那份底稿,` +
        `发号就是猜对面没占过)。出路:查网络/凭据后重跑;确属离线/必须先行则 ` +
        '`IHUI_PLAN_ID_ALLOW_UNALIGNED=1` 重跑,报告会明写"未与远端对齐"。',
    )
    process.exit(1)
  }
}
const remoteWide = Number.isFinite(remote?.max?.[FAMILY]) ? remote.max[FAMILY] : null
// ── 池式取号(2026-10-14;2026-10-24 池上限降到两位数):建议号 = 池内最小空闲;池满 ⇒ 拒绝发号,绝不给池外号 ──────────
// 池内占用 = 条目标题号 ∪ 登记行号(两口径并);>LEASE_POOL_MAX 的归档大号不占池(存量债不挡新号)。
// "最小空闲"的尺只有 lib/plan-id-lease.mjs 那一份(与第一发号出口共用)。
const rowNums = (rowUsedWide?.ids ?? [])
  .map((l) => Number(/(\d+)$/.exec(String(l))?.[1] ?? Number.NaN))
  .filter(Number.isFinite)
const poolUsed = [...new Set([...nums, ...rowNums])]
// ── G-14(2026-10-22,票面出路①):发号前核对实时占用面 = 全文件正则扫出的号集 ────────────
// 旧口径(条目标题 ∪ 登记行声明位)在并发共享工作树下把别席已占号当空闲发出(HEAD blob 滞后、
// 同号不同题过不了复合主键门 ⇒ 门与取号器都看不见)。现在:`O<数字>` 在全文件任何一次出现
// (标题、行声明、正文引用、HTML 注释)都算已占 —— 宁顶号不空段;面 = HEAD 宽面 ⊕ 工作树副本
// (他席未提交的登记活在后者)。命中即换号,被顶掉的号点名打印。`--check` 不发号、不走这一档。
// 扫描只有一份实现(lib/plan-id-face.mjs 的 scanFamilyIds):第一发号出口 live-doc-edit 与
// 本器共用同一把尺,不在两处各抄一条正则(§22c:两处算同一件事必漂移)。
const scanHead = scanFamilyIds(wideText, FAMILY)
// 工作树副本读不到 ⇒ 大声警告并退回 HEAD 宽面:这一维是新增的,它的缺席不得把发号入口
// 堵得比改前更死(失效方向 = 旧面 + 警告,不是新硬闸)。
let worktreeText = ''
try {
  worktreeText = readFileSync(resolve(ROOT, PLAN_PATH), 'utf8')
} catch (e) {
  console.error(
    `⚠️ 工作树副本 ${PLAN_PATH} 读不到(${String(e?.message ?? e).split(/\r?\n/)[0].slice(0, 120)}) ⇒ ` +
      `本轮实时占用面退回 HEAD 宽面,他席未提交的登记不在这一轮尺子里`,
  )
}
const scanWork = scanFamilyIds(worktreeText, FAMILY)
// ── 发号前对目标文件现读正文查同题(第五条,2026-10-24)────────────────────────────────
// 上一档查的是**号**:并发那批正文手填号的登记,并入前在哪个面都不存在 ⇒ 号发出去,撞号在
// 并集落地那一刻才发生。这里补"同一件事已经在册"那一半:给了 --title / --keyword 就按同题指纹
// 在**现读正文**里查一遍,命中即当场拒绝发号并点名既有行/既有号(改用既有号或换标题后再取)。
// 面 = 工作树副本(他席未提交的登记)⊕ HEAD 宽面(台账 ⊕ 归档件,已并入的旧底稿在这一侧)。
// 两处可能命中同一行 ⇒ 按 (既有号, 行首预览) 去重,只报一处,免得把"一处命中"读成"两组冲突"。
const titleFp = titleFlag.value
  ? extractTaskFingerprint(/^-\s*\[[ x]\]/.test(titleFlag.value) ? titleFlag.value : `- [ ] ${titleFlag.value}`)
  : null
const kwKey = keywordFlag.value ? keywordKey(keywordFlag.value) : ''
if (titleFlag.value && !titleFp)
  console.error(
    '⚠️ --title 算不出同题指纹(标题过短 / 无标题段,权重 < 16)⇒ 这一维**未判定**,' +
      '不得把"没拦"读成"已查过";要把这一格判到底,请给含标题正文的整行或更长的标题',
  )
if (keywordFlag.value && !kwKey) console.error('⚠️ --keyword 归一化后为空 ⇒ 这一维**未判定**(关键词须含文字或数字)')
if (titleFp || kwKey) {
  const seenHits = new Map()
  for (const f of [
    { label: '工作树副本(现读)', body: worktreeText },
    { label: `${SOURCE} 宽面(台账 ⊕ 归档件)`, body: wideText },
  ]) {
    for (const h of findSameTitleRows(f.body, { fp: titleFp, keyword: kwKey })) {
      const k = `${h.id ?? '无号'}\u0000${h.preview}`
      if (!seenHits.has(k)) seenHits.set(k, { ...h, face: f.label })
    }
  }
  const titleHits = [...seenHits.values()]
  if (titleHits.length) {
    const cause = [titleFp ? `--title 指纹=${titleFp}` : '', kwKey ? `--keyword 含「${keywordFlag.value}」` : '']
      .filter(Boolean)
      .join(' / ')
    console.error(`❌ 发号前现读正文查重命中「同题已在册」${titleHits.length} 处(${cause}):`)
    for (const h of titleHits.slice(0, 5))
      console.error(`   第 ${h.line} 行(${h.face})既有号 ${h.id ?? '无号'}:${h.preview}`)
    if (titleHits.length > 5) console.error(`   …另 ${titleHits.length - 5} 处`)
    console.error(
      '   ⇒ 拒绝发号:并发批次带着旧底稿并入后,同一件事再按新号登一遍就是撞号 / 同题多号的源头。' +
        '改用上面点名的既有号(不要新取号);若确属另一件事,先换标题(或换关键词)再重跑本命令。',
    )
    process.exit(1)
  }
}
const liveUsed = [...new Set([...poolUsed, ...scanHead, ...scanWork])]
// ── G-454 ② 对齐(2026-10-25,票 G-35):远端那一维不能只交 max 给本器 ──────────────────────
// `poolBlocked` 的远端避让只盖 `lowMax+1..baseMax` 这段"本地盲区";远端**低位**已占号
// (本地面已让空 / 远端已推未并)落不进那一段 ⇒ `smallestFreeId` 会把它当空闲发出。
// 第一出口(live-doc-edit 的 resolveIdTokens)自 2026-10-16 起已把远端号集从空闲清单里扣掉,
// 本器当时没跟上 —— 两出口同一件事两种口径(§22c 漂移型)。现在 import 同一份投影
// (lib/plan-id-lease.mjs 的 remoteIdNumsOf)把远端已用号集并进实时占用面,行为与第一出口对齐:
// 远端与本地同号集时本行是恒等并(建议号与改动前逐字同形),只有远端多出本地看不见的号才顺延。
// `--check` 不发号(在远端读取之前分岔)、`--source` 显式指面(不问远端)⇒ remote 为 null ⇒ 空数组。
const remoteIdNums = remoteIdNumsOf(remote?.ids?.[FAMILY])
if (remoteIdNums.length) liveUsed.push(...remoteIdNums)
const nextNarrow = smallestFreeId({ usedNumbers: poolUsed, baseMax: remoteWide })
const next = smallestFreeId({ usedNumbers: liveUsed, baseMax: remoteWide })
// 「命中即换号」里被扫描顶掉的号:旧口径判空闲、全文件扫描判已占(撞号正病;走 stderr,
// --next-only 的 stdout 仍恒一行号)。
const skippedByScan =
  next === null || nextNarrow === null
    ? []
    : [...new Set([...scanHead, ...scanWork])]
        .filter((n) => n >= nextNarrow && n < next)
        .sort((a, b) => a - b)
if (skippedByScan.length)
  console.error(
    `ℹ G-14 全文件扫描顶掉 ${skippedByScan.length} 个旧口径"空闲"号(实为已占,点名):` +
      skippedByScan.map((n) => `O${n}`).join(', '),
  )
// G-454 ② 对齐(G-35):远端号集顶掉的号同样点名(同一对照臂,但剔除已被扫描点过名的,不重复报)。
const skippedByRemote =
  next === null || nextNarrow === null
    ? []
    : [...new Set(remoteIdNums)]
        .filter((n) => n >= nextNarrow && n < next && !skippedByScan.includes(n))
        .sort((a, b) => a - b)
if (skippedByRemote.length)
  console.error(
    `ℹ 远端已用号集顶掉 ${skippedByRemote.length} 个旧口径"空闲"号(对面仍占着而本地面上已让空/未并,点名):` +
      skippedByRemote.map((n) => `O${n}`).join(', '),
  )
const { lowMax: poolLowMax } = poolBlocked({ usedNumbers: liveUsed, baseMax: remoteWide })
// ── 租约窗读数(2026-10-23 立,只读不改分配)────────────────────────────────────────────
// "发不出号"有两种完全不同的成因,旧措辞把它们一律念成"号池已满 ⇒ 先归档腾号":
//  ① POOL_FULL = 池内一个空闲号都没有(这一型让位才真能腾出号);
//  ② NO_CONTIGUOUS_LEASE_WINDOW = 池内仍有空闲号,却没有连续 segmentSize 个可落窗位
//     (2026-10-23 现读 G 族:已占 815 / 空闲 184 / 最长可落窗游程 32 < 段容量当时 50)。
// ② 靠散点让位腾不出连续窗 ⇒ 旧归因把台账里的票全引向无效出路。这里让**判据自己**把两型量出来
// (尺住 lib/plan-id-lease.mjs,本器不另数空闲位、不拼句子,§0.6),2026-10-23 当次段容量/池上限/算法一字未动。
const leaseView = leaseCursor({
  usedNumbers: liveUsed,
  leases: parseLeases(wideText, FAMILY),
  family: FAMILY,
  baseMax: remoteWide,
})
if (next === null) {
  console.error(`❌ ${FAMILY} 族:${describePoolExhaustion(leaseView)}`)
  console.error(
    `   机读: reason=${leaseView.reason ?? 'UNDETERMINED'} freeInPool=${leaseView.freeInPool ?? '未量到'}` +
      ` largestRun=${leaseView.largestRun ?? '未量到'} segmentSize=${leaseView.segmentSize}` +
      ` poolMax=${leaseView.poolMax}`,
  )
  process.exit(1)
}
// 本器(第二出口)按"池内最小空闲"给号,第一出口按"连续租约窗"给号 ⇒ 两者此刻可以给出相反结论。
// 这个分歧必须喊出来:否则读到本器绿灯的人会以为租约发号也不会挡,而票面上写的"池已满"又是假的。
if (leaseView.mode === 'pool-exhausted')
  console.error(
    `⚠️ ${FAMILY} 族租约窗尺子:${describePoolExhaustion(leaseView)}` +
      ` —— 本器按池内最小空闲仍可发 O${next}` +
      `(两出口口径不同:"无连续租约窗"不等于"池内无闲号",两型出路也不相同)`,
  )
const freeList = poolFreeList({ usedNumbers: liveUsed, baseMax: remoteWide })

// 两面(标题口径 + 登记行口径)与两文件(台账 + 归档件)都读不到任何 O 记录 ⇒ maxWide = -Infinity。
// 池式下这不影响发号(真空池 ⇒ 从 O1 起),但必须喊出来:整族在用却"面全空"通常意味着
// 族名写错或面读窄了 —— 把可疑当正常,比停在这里难查得多。
if (!Number.isFinite(maxWide))
  console.error(
    `⚠️ ${SOURCE} 的占用面(台账 ⊕ ${face.archiveFiles.length} 份归档件)里一条 O 记录都没有 ⇒ ` +
      `池式口径将按真空池从 O1 起发;若该族实际在用,先查这份面为什么是空的(整族归档/族名写错),` +
      `不要按它登记。`,
  )

if (flags.has('--next-only')) {
  console.log(`O${next}`)
  process.exit(0)
}

const fmt = (n) => (Number.isFinite(n) ? `O${n}` : '无(该面一条 O 记录都没有)')
console.log(
  `权威口径 = git show ${SOURCE}:${PLAN_PATH} ⊕ ${face.archiveFiles.length} 份归档件(台账条目标题 ${seen.length} 行 / 去重 ${count.size} 个号)`,
)
console.log(`已占用的最大号 = ${fmt(maxWide)}   下一个号 = O${next}(池内最小空闲)`)
console.log(
  `  G-14 实时占用面:全文件扫描 HEAD 宽面 ${scanHead.size} 号 ⊕ 工作树副本 ${scanWork.size} 号` +
    ` ⊕ 远端已用号集 ${remoteIdNums.length} 号(G-454② 对齐,票 G-35)⇒ ` +
    `池内占用 ${liveUsed.filter((n) => n >= 1 && n <= LEASE_POOL_MAX).length} 号(旧口径 ${poolUsed.length});` +
    `本轮顶掉 ${skippedByScan.length + skippedByRemote.length} 个旧口径假空闲号` +
    `${skippedByScan.length ? `(扫描:${skippedByScan.map((n) => `O${n}`).join(', ')})` : ''}` +
    `${skippedByRemote.length ? `(远端:${skippedByRemote.map((n) => `O${n}`).join(', ')})` : ''}`,
)
console.log(
  `  取号口径:池式 1..${LEASE_POOL_MAX}(2026-10-14 硬上限)⇒ 池内空闲 ${freeList.length} 号;` +
    `拒绝发号按成因分档(机读 reason 单源 lib/plan-id-lease.mjs):` +
    `${POOL_EXHAUST_REASON.poolFull}=池内一个空闲号都没有 / ` +
    `${POOL_EXHAUST_REASON.noContiguousWindow}=仍有空闲号却无连续租约窗` +
    `(绝不发 >${LEASE_POOL_MAX} 的号;>${LEASE_POOL_MAX} 的归档大号不占池)`,
)
console.log(
  `  两面对账:仅台账 max=${fmt(maxLedger)} / 台账⊕归档件 max=${fmt(maxWide)} ⇒ 差 ${Number.isFinite(maxWide) && Number.isFinite(maxLedger) ? maxWide - maxLedger : '?'} 档(只看台账会少让这么多)`,
)
if (remote) {
  const rel =
    remoteWide === null
      ? '远端未参与(原因见上方 stderr)⇒ 未与远端对齐'
      : remoteWide > LEASE_POOL_MAX
        ? `⇒ 池外大号(>${LEASE_POOL_MAX}),池式取号不参考(硬上限 ${LEASE_POOL_MAX})`
        : remoteWide > poolLowMax
          ? `⇒ 池内避让远端已占号(${poolLowMax + 1}..${remoteWide} 不发)`
          : '⇒ 与本地池内占用同值'
  console.log(
    `  号段基准(含远端):${remote.remote} ${remote.ref} 该族 max=${remoteWide === null ? '未判到' : fmt(remoteWide)} ${rel}`,
  )
}
if (freeList.length)
  console.log(
    `(池内空闲 ${freeList.length} 个,如实报:${freeList
      .slice(0, 12)
      .map((n) => `O${n}`)
      .join(', ')}${freeList.length > 12 ? ' …' : ''})`,
  )
// G-927:发号路径的重号读数与 `--check` 用**同一个判据**(lib/plan-id-duplicates.mjs 一份)。
// 旧版这里按"同日『追加』续写"豁免、`--check` 那支却按编号计数不豁免 ⇒ 同一把尺在两个面上
// 给出互相打脸的结论(§0.6)。历史小节标题同 id 只报数,不再冒充相撞。
const dupRow = judgeRowIdDuplicates({ ledgerText: text, family: FAMILY })
if (dupRow.ok && dupRow.rowDups.length) {
  console.log(`⚠️  该版本自身已有登记行重号 ${dupRow.rowDups.length} 组(登记时没查权威版本所致):`)
  for (const [id, n] of dupRow.rowDups) console.log(`   ${id} ×${n}`)
  console.log(
    '  按本仓既有口径"后来者改号"处理;改别人已入库的号会牵动 README/commit 引用,须由人决定。',
  )
} else if (!dupRow.ok) {
  console.log(
    `⚠️  重号这一维未判定:${dupRow.reason} —— 建议号照常给,但不得把"没报"读成"没有重号"。`,
  )
}
if (dups.length) {
  console.log(
    `ℹ️  历史小节标题同 id ${dups.length} 组(${dups.map(([i, n]) => `${i}×${n}`).join(' ')}):` +
      `含逐字孪生副本 ${twinDups.length} 组(${twinDups.join(' ') || '无'}—— 该折,归活文档归并线既有折叠出口处置,不判相撞也不判绿)` +
      ` / 纯系列小节 ${seriesDups.length} 组(${seriesDups.join(' ') || '无'}—— 同一票下的正当复用)(G-927 分档 + G-955 两档读数)。`,
  )
}
console.log(`建议本次使用:${fmt(next)}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
