// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活文档编辑器(锚点插入 / EOF 追加,对象空间落地;常驻工具,不在提交链。2026-09-27 立,工程工具收口票)。
 *
 * 为什么在仓里:本会话手写了两份同形器(insert-live-doc.mjs / append-eof.mjs)且都躺在
 * .ihui-agent/tmp/ 不受版本控制。它们防的那一型是本仓 §12 记过一夜三次的事故:活文档
 * (PROJECT_PLAN / AGENTS / README)的工作树副本常年滞后 HEAD,按 pathspec 交工作树 = 把别人
 * 已入库的行整批写回旧态。所以底稿每次尝试都从**当下 HEAD** 现取,判据是**结构等值**
 * (new == HEAD 的前缀 ⊕ 本块 ⊕ 后缀),禁止用"重复行计数"那种启发式 —— 台账里本来就有大量
 * 逐字相同的短行(`- [ ]` 条目、`  },`、空行),启发式会把合法复用误判成"凭空多出"(wire-gate 就死在这上面,
 * 整块一次没落地成功过)。锚点命中数必须**恰好 1**:0 处 = 锚点文案已漂(块在不在位由下面的幂等判据
 * 单独判,不再与这一型混在一句里),>1 处 = 有歧义,两种都拒绝凭猜插。
 *
 * 幂等判据(G-321①,2026-09-28 立 —— 本仓一次真实自伤的落点):"锚点命中恰好 1"**从来不构成**
 * "本块不在位"的证据。上一轮有人对同一锚点跑了两次(第一次其实已成功入库,只是 stdout 末行一句关于
 * 共享主索引的红被读成整体失败),同一段落在 HEAD 里落了两份,还紧贴 Markdown 表格行没有空行分隔。
 * 现在**拼块之前**在**本次调用实际取材的那一面**(该轮 CAS 现取的 HEAD 底稿,不是磁盘)现读
 * "锚点之后紧邻的 N 行(N=块行数)是否已与本块逐行等值"⇒ 等值即判"已在位",不插入、exit 0、并点名依据。
 * 两条不许漂的写法:
 *  ① **禁止**用"已插块清单 / 台账文件"实现 —— 清单必然腐烂(本仓对 `RN_ONLY_BRAND_KEYS`、机器态门 id
 *     清单记过同一条教训),判据必须当场从被审面量出来。
 *  ② 块里的 `{{NEXT_ID:族}}` 会让两次跑产出**不逐字相同**的文本(第一次的号进了底稿,第二次号更大),
 *     所以匹配式只把**编号的数字段**当可变位(形状取自 `usedIdsOfPrefix` 的 `template`,与本器取号
 *     同一个出口,不另写一份"什么算一个编号"),其余字符必须逐字等值。失效方向刻意是"宁可认不出已在位,
 *     也绝不误拦合法插入"(票面第二条成对用例:同锚点、实质不同必须仍插得进去)。
 *     边界:两行**除自动号以外逐字相同**时本判据认作同一块 —— 那与"重跑"在内容上不可区分,而按 §1
 *     "一个编号只能有一行当前状态",这种登记本来就该换一个标题;此时工具拒绝追加并点名落点行号,交人裁决。
 *
 * 退出码分档(G-321②):"内容已落地"与"仅共享主索引没对齐"过去混成同一个失败信号(1),于是调用方
 * 只能在"重跑造双份"与"漏跑留旧态"之间猜。现在前者由上面的幂等判据拦住,后者由 0 档明写(见 `alignOutcome`)。
 *
 * CLI 契约(env 驱动):
 *  LIVE_DOC          必填,仓库相对路径(须在 HEAD 里存在)
 *  LIVE_BLOCK_FILE   插入模式必填,正文块内容文件的绝对路径
 *  LIVE_ANCHOR_FILE  可选,锚点行(可多行)所在文件的绝对路径;缺省 = EOF 追加(对齐 append-eof 的行为)
 *  LIVE_REPLACE_FILE 改写模式(与上面三者互斥):JSON 数组 `[{before, after}]`,每项是一条**整行**
 *                    逐字替换。为什么需要这一档:台账结清的动作是"把某一行从 `- [ ]` 改成
 *                    `- [x] ✅(日期) …`并补证据",插入模式做不到,而按 pathspec 交工作树等于
 *                    把别人已入库的行整批写回旧态(§12 一夜三次自伤)。判据与插入档同源:
 *                    `before` 在 HEAD 版必须**恰好命中 1 次**(0 = 文案已漂,>1 = 有歧义,都不猜),
 *                    除非该项显式带 `all: true` —— 那表示"这份文本在台账里有 N 个逐字相同的孪生副本,
 *                    每一条都要施加同一个改写"(2026-09-28 立:摘过期认领牌/翻勾归并注记对 16/27 行会因
 *                    同文副本被拒,而半新半旧比不改更糟)。`all` 只放宽"命中 N 次",**0 次仍拒**;
 *                    任一 `before` 等于另一项的 `after` 一律拒(顺序替换会把自己刚改出的行再改一遍);
 *                    命中数在成功行里逐条打印,不留静默。
 *                    且替换后"除这些行以外逐行等值、总行数不变" ⇒ 才准落盘。
 *  LIVE_MSG          必填,提交信息
 *  LIVE_ROOT         测试/换仓通道:仓库根(缺省 = 本脚本所在仓根)
 *  LIVE_SHA_ALLOW    可选(G-1079146 取值步骤的**唯一**应急出口):`<token>=<原因>`(多条以 `;`/换行
 *                    分隔)。只对**逐字等值的那枚 token** 放行,原因缺省或为空 ⇒ 不收录(无原因不放行);
 *                    每次放行都打印留痕。它不是"关掉这一步"的开关 —— 这一步没有关掉整档的出口,
 *                    因为 git 问不到时它自己就放行(见上"登记入口取值"③)。
 *  取号令牌(两种模式都可用,只在正文里出现):`{{NEXT_ID:G}}` 会在**每次 CAS 尝试**里由当下
 *  HEAD 底稿**按出现顺序逐个递增**地现算成 `G-<下一个空闲号>`(max+1、max+2…;判据住在
 *  lib/plan-task-index.mjs 的 usedIdsOfPrefix,本器不另写一份"什么算一个编号",行首裸编号不占号段
 *  那条口径也不重抄)。为什么必须在这里算而不是由人先查:2026-09-27 一天内撞了**两次**同号,
 *  "提交前查一次占用"挡不住别人事后取同一个号(与守门编号撞号同族)。为什么必须**递增**而不是
 *  每个令牌都算 max+1:一次登记两件事是常态,那样本器自己就会产出它要防的那一型。
 *  该族一条登记行都没有 ⇒ exit 2 拒绝落地,绝不给 "<族>-1"。
 *  占用面(G-313 续,2026-09-28 补)= **台账 ⊕ `.ihui-agent/archive/PROJECT_PLAN*.md`**,由
 *  `lib/plan-id-face.mjs` 的 `collectIdFace()` 给(与 `next-plan-id.mjs` 共用那一份实现)。理由:
 *  归档器把已完成条目整块搬进归档件、台账只留一行 HTML 注释占位 ⇒ 只看台账的 max 会随每次归档回落,
 *  令牌就会发出**已用过的号**(本仓 2026-09-28 一天内重发两次,登记在 `6b812de31`)。取号与幂等判据的
 *  编号形状**必须吃同一张面** —— 两面不同形时,发出去的号会匹配不上自己编出的匹配式,幂等判据就永远
 *  不命中(那等于把"重复落地"这一型重新放开)。面判不出(台账取不到 / 归档件枚举失败 / 有件取不到)
 *  ⇒ exit 2 拒绝落地,**绝不退回窄面发号**。非 `PROJECT_PLAN.md`(AGENTS/README)⇒ 归档件不适用,
 *  面 = 该文档自身,与改动前逐字同形。
 *
 *  千段租约(G-916936 机主拍板,2026-10-07 落地):取号前先问"本机段" —— 台账里本机的
 *  `〔千段租约〕` 行(done 形态,主键=段尾号)内还有空闲 ⇒ **段内连号**;没有/段满 ⇒ **新占一段**
 *  (max+1 起共 1000 个),租约行随本块一起落账。段尾号进了占用面 ⇒ 无租约感知的出口
 *  (next-plan-id 的建议号、旧版令牌消费方)结构上落在所有已占段之外,跨机撞号从"每个号都可能
 *  撞"收敛为"两侧同刻新占段才可能撞一次,CAS 重试即换下一段"。机器标识 = IHUI_MACHINE_ID env
 *  > 主机名+仓根指纹(同机双 checkout 各占各段);租约行无日期 ⇒ 归档器"无日期不搬"不会把段
 *  还回去。不给 machineId(仅测试用)⇒ 逐字保持旧口径。
 *
 *  号段基准(G-313 出路②,2026-09-28 加):基准 = **max(本地 HEAD 底稿该族 max, 远端那一份该族
 *  max)**。只问 `git ls-remote` + 本机对象库;远端 tip 的对象**本地没有就不 fetch、不写任何 ref**,
 *  如实打印"号段基准未含远端(对象不在本地,原因:…)"后按本地基准落盘。远端**只抬高、不压低**,
 *  所以远端与本地同 max(或远端问不到)时取号与改动前逐字同形。降级一律喊出来,不得静默。
 * 退出码:0 = 已落地且回读证明本块每一条非空行都在 HEAD 里(**共享主索引未对齐只点名不判红**,
 *        含 `.git/index.lock` 锁龄超上限 —— 那是索引副作用,不是"没落地";重跑不会补对齐,只会撞幂等判据),
 *        或 本块已在位(幂等命中:不产生新提交、不写任何东西);
 *        1 = 业务拒绝(锚点命中 0 或 >1 / 结构等值不成立 / 文档不在 HEAD / CAS 12 次未抢到 / 回读缺行 /
 *            编号形状编译不出 ⇒ 无法证明"不在位" / **新行里的 sha 形态指针当场问不到 commit**(G-1079146
 *            取值档;注意"git 问不到"不落这一档 —— 那一档是未判定 ⇒ 放行并打印原因));
 *        2 = 用法或环境错(缺必填 env / 锚点或正文块为空 / 根不可当仓库问)。
 *
 * 已知边界(如实登记,别读成"重复落地这一族已被全覆盖"):
 *  - **EOF 追加档不在幂等射程**:票面 ① 的判据定义在"锚点之后紧邻 N 行"上,EOF 档没有锚点可点名。
 *    既有端到端测试 N4 的第二段恰恰是"同一块再跑一次"来证明号被远端抬高,给 EOF 加幂等会把那条断言
 *    打死(既有断言不许放宽)⇒ 这一格留白,要收它得先改 N4 的取材设计,那是另一票。
 *  - **整行改写档天然不需要**:它的 `before` 命中 0 就是"这条已改过"的信号(`replace-not-found`),
 *    再跑一次产不出双份。
 *  - "已在位"那一支**不动共享主索引**:对齐判据要的是"那枚提交的父",而本次没有新提交、索引此刻归谁
 *    无从判定 ⇒ 只把 0 档的措辞写在上面,不代删别人的锁、不猜。
 *
 * 落地后自带的一次补跑(G-816708,2026-10-05):`LIVE_DOC=PROJECT_PLAN.md` 时,CAS 成功且回读通过后
 *  本器**就地补跑一次守门 71 的台账自愈**(`--heal --commit`)。成因与本器存在的理由同源:每一枚提交都
 *  走 `commit-tree` + CAS ⇒ 钩子结构性不跑 ⇒ 挂在 `.husky/post-commit` 第 6 节的那层自愈对本器从来
 *  不会触发;而本器改的正是登记行(整行改写档把 `- [ ]` 翻成 `- [x] ✅…`),一次误写就是"已入库的登记行
 *  被滞后底稿带回"那一型。派生与失败臂措辞复用 `lib/post-merge-ledger-sync.mjs` 那一份(与两台收敛器
 *  同一个器物,不另发明第二套调用协议);补跑没跑成只喊一行 stderr,**不改本器退出码**。
 *  未闭环的一格:`scripts/plan-tasks-merge.mjs` 是第四台旁路落地器,同样需要自带这一跑,本票开工时它
 *  正被他人持有(` M`)⇒ 未动,登记在这里而不是装作已全覆盖。
 *
 * 登记入口取值(G-1079146,2026-10-08 立 —— 票面原话「优先做的不是新门,是掐住成因」):
 *  写台账之前对**本次要新增的行**里 sha 形态的出处指针当场问一次
 *  `git rev-parse --verify <tok>^{commit}`:解析通过 ⇒ 照旧落;不通过 ⇒ **拒绝落该行**并打印
 *  token / 形状 / 判据命令 / 建议。为什么住在这里而不是等新门:腐烂的**唯一成因**是登记时就用
 *  7-12 位短 sha(权威门现读 35/35 全短写、零枚 40 位;短 sha 的可解析性寄生在本机对象库 +
 *  本机 lineage,别机检出与 CI 上必取不到)。在落库这一刻问 ⇒ 不需要存量清单,也不造恒红面。
 *  四条不可漂的写法:
 *  ① **只吃新行**:插入档吃本块行,整行改写档只吃 `after` 相对 `before` 多出的那一段(把翻勾
 *     行里本来就带着的旧 sha 再判一次,等于拿别人的历史钉红这次的结清动作);**不回扫全文**。
 *  ② **三条放过判在判据侧,不判在措辞侧**(票面实测:抽取式挡不住"设备号""dist/273.x.mjs"
 *     "workbuddy/main-x"任何一种改写 ⇒ "改措辞"结构上摘不出射程):声明表/配置前缀形态 /
 *     文件名形态(紧邻扩展名或路径分隔)/ ref 名内段与非独立 hex token(被 `-` `.` `/` 连着写)。
 *  ③ **git 问不到 ⇒ 一律放行并打印"未判定"**。把"没判成"写成"这就是坏",产出的是一台恒挡的尺子,
 *     而本器挡的是**全队台账写入** —— 恒挡的唯一出路是绕开本器改用 pathspec 硬交(§12 一夜三次自伤
 *     那一型),比放过的代价高。pre-flight(`rev-parse HEAD` 问不到)也整步落未判定档。
 *  ④ **绝不自动补 sha**:票面与 §1/G-191 明令"从同段挑一枚看起来对的 sha 补进去"就是编造。
 *  应急出口只有一条且必须带原因:`LIVE_SHA_ALLOW=<token>=<一句话原因>`(多条以 `;` 或换行分隔,
 *  无原因不放行),放行会打印留痕 —— 它是应急通道不是常规路径,不得拿它当常态把整块放行清账。
 *
 * ⚠️ 头注不写"已接 pre-commit/CI"字样(守门 89 R1/R2 判"声称已接线而零命中")。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  ABSENT,
  alignSharedIndex,
  casUpdateRef,
  commitTreeWithIndex,
  git,
  headBlobOf,
  resolveHeadRef,
  sameLines,
  writeBlob,
  rerunLedgerHeal,
} from './lib/bypass-git.mjs'
import {
  usedIdsOfPrefix,
  MALFORMED_ID_RE,
  MALFORMED_BODY_RE,
  findMalformedIds,
  findMalformedRows,
  newMalformed,
  malformedLine,
} from './lib/plan-task-index.mjs'
import { collectIdFace } from './lib/plan-id-face.mjs'
// G-725:旁路留痕的唯一出口(键名/落点与 safe-commit 那本台账同形,不在本器里另拼 JSON)。
import { recordBypassLanding } from './lib/commit-attestation.mjs'
// G-1079146(2026-10-08):git 派生的唯一 transport(绝对路径 + 显式 stdio + windowsHide + 数字 timeout
// + maxBuffer),本器不在此处再拼一份 execFileSync —— 少写 stdio 在本机是稳定 `spawnSync git EBUSY`。
import { gitRaw } from './lib/face-reader.mjs'
// G-1079146:"什么算一枚 sha 形态串"的判据**只有权威门那一份**。本器 import 它,而不是照它的正则
// 再抄一条 —— 两处算同一件事必漂移(AGENTS §22c);而漂了的那一份会给腐烂发合格证(门 117 那一课)。
import { classifyShape, extractFromLine } from './check-plan-sha-resolvable.mjs'
// 千段租约(G-916936,2026-10-07):段判定/行构造/落账并线只有一份实现,本器只是取号出口的接线方。
import {
  appendLeaseRows,
  buildLeaseRow,
  decideLease,
  machineIdentity,
} from './lib/plan-id-lease.mjs'

/**
 * 令牌 `{{NEXT_ID:G}}` ⇒ 落成 `G-<下一个空闲号>`。
 *
 * 为什么住在落盘那一刻而不是由人来查:2026-09-27 一天内撞了**两次**同号 ——
 * 一次是我与另一路各登记了一个 `G-262`,另一次是我刚将 `G-266` 落库,同一时刻别人也在按
 * "我查到的空闲号"登记。"提交前查一次占用"在高并发仓里构不成证据(守门 93/103 的编号事故同一课),
 * 唯一可靠的是**把取号放进 CAS 循环里**:每次尝试都从当下 HEAD 重算,撞了就重取底稿再来。
 * 该族一条登记行都没有 ⇒ 判不出(返回 error),不给 "<族>-1" —— 空扫与"真没用过"同形(见 lib 同条注释)。
 */
const ID_TOKEN_RE = /\{\{NEXT_ID:([A-Za-z]+)\}\}/g

/**
 * 号段基准的两条来源:本地 HEAD 底稿 + **远端那一份底稿**(G-313 出路②,2026-09-28 立)。
 *
 * 为什么"每次重试重取本地 HEAD"仍不够(G-313 票面,主会话亲历):本会话两行确实由令牌在 23:50Z
 * 那次 CAS 里按当次 HEAD 现算成 `G-302`/`G-303`(当时该族 max=301),撞号来自**另一侧** —— 那批
 * 作者时刻更早、正文里**手填** `G-300..G-309`,却在本会话之后才并入 HEAD ⇒ 同一号段被两批各自认领。
 * "并发批次带着旧底稿并入"这一型里,本地 HEAD 与远端可以各差一批(本仓 `origin` 常年被后台 worker
 * 推进),只看本地那一份结构上看不见对面那批号。
 *
 * 三条不许漂的写法:
 *  ① 远端 tip 只经 `git ls-remote <remote> <ref>` 问(远端真值唯一来源);判据仍只有一份 ——
 *     远端那份底稿的该族 max 也走 `usedIdsOfPrefix`,不另写"什么算一个号"。
 *  ② 该 tip 的对象**本地没有 ⇒ 先做一次有界自补救 fetch**(`transport.hydrate`:`git fetch
 *     --no-tags <remote> <ref>`,数字 timeout,只取对象与 FETCH_HEAD —— tip 按 SHA 读,不依赖
 *     嵌套 remote-tracking ref,宿主清理层删掉它也不影响本次判定)。旧版"绝不 fetch、不写任何
 *     ref"的补救是把一条 fetch 命令留给调用方,而 §5b 禁手工 fetch/merge/push 循环 ⇒ 拦住不自助
 *     只会把每个调用方逼向应急旗,那才是"警告照样能提交"的活体(2026-09-30 契约升级:自助一次,
 *     补不齐才拦)。transport 没给 hydrate(测试夹具)⇒ 保持旧行为,直接进未补齐档。
 *  ③ 仍问不到的每一步都必须**点名**,但分两档处置、不得并桶(见 idBasisGate):远端完全问不到
 *     (离线/凭据缺失)⇒ 警告着按本地基准落号;tip 问得到而对象补 fetch 后仍不在本地 ⇒ 闸门
 *     **拒绝发号**。把"没判"写成"判过了"是本仓最高频失效型,静默降级就等于伪装成"已与远端对齐"。
 *  远端只用来**抬高**基准,永不用来压低 ⇒ 远端与本地同 max 时取号与改动前逐字同形(镜像 N2/N3 钉住)。
 */
const LS_REMOTE_TIMEOUT_MS = 20_000
const REMOTE_READ_TIMEOUT_MS = 30_000
const REMOTE_FETCH_TIMEOUT_MS = 120_000

/** 远端与 ref 可换(`LIVE_ID_REMOTE` / `LIVE_ID_REMOTE_REF`),缺省 origin/main —— 现读,不在模块期烘死。 */
function remoteTarget() {
  return {
    remote: process.env.LIVE_ID_REMOTE || 'origin',
    ref: process.env.LIVE_ID_REMOTE_REF || 'refs/heads/main',
  }
}

const oneLine = (e) =>
  String(e?.message ?? e)
    .split(/\r?\n/)[0]
    .slice(0, 200)

/**
 * 远端读取的传输面(唯一一处派生)。三个 git 调用各自带数字 `timeout`(本仓实测过无超时挂 80 分钟),
 * `windowsHide` 与绝对路径 git 候选由 `lib/bypass-git.mjs` 的 `git()` 负责 —— 它复用的解析链与
 * `lib/face-reader.mjs` 的 `gitBinary` 同出一份(`lib/gitdir.mjs` 的 `resolveGitBin`),**不再抄第三份候选表**。
 */
export const REMOTE_ID_TRANSPORT = {
  tipSha({ root, remote = remoteTarget().remote, ref = remoteTarget().ref } = {}) {
    const out = git(['ls-remote', remote, ref], { root, timeout: LS_REMOTE_TIMEOUT_MS })
    const sha = String(out ?? '')
      .trim()
      .split(/\s+/)[0]
    if (!sha) return { ok: false, reason: `${remote} 上没有 ${ref}` }
    return { ok: true, sha, remote, ref }
  },
  /** 该 commit 对象本机是否已有;没有就抛(由 readRemoteIdBasis 决定是否自补救)。 */
  hasCommit({ root, sha }) {
    git(['cat-file', '-e', `${sha}^{commit}`], { root, timeout: REMOTE_READ_TIMEOUT_MS })
    return true
  },
  /** 一次有界自补救 fetch(2026-09-30 契约升级):把远端 tip 对象带进本机对象库。失败抛,由调用方记因。 */
  hydrate({ root, remote = remoteTarget().remote, ref = remoteTarget().ref } = {}) {
    git(['fetch', '--no-tags', remote, ref], { root, timeout: REMOTE_FETCH_TIMEOUT_MS })
    return true
  },
  docContent({ root, sha, doc }) {
    return git(['show', `${sha}:${doc}`], { root, raw: true, timeout: REMOTE_READ_TIMEOUT_MS })
  },
}

/**
 * 现读远端那一份底稿的号段基准。返回 `{ max:{族:远端该族 max}, notes:[降级原因], info:[过程注记], tipSha, remote, ref }`。
 * 每条 notes 都对应"远端这一维没判到",调用方必须逐条打印 —— 只印 max 不印 notes,就是把"没判"
 * 写成"判过了"的那一型。info 是**过程注记**(如自补救 fetch 成功),不得混进 notes:把"已读齐"
 * 打成"未对齐"是反向的假话。测试经 `transport` 注入构造值,不真发网络(生产缺省走真 ls-remote)。
 */
export function readRemoteIdBasis({ root, doc, families, transport = REMOTE_ID_TRANSPORT } = {}) {
  const { remote, ref } = remoteTarget()
  const out = { max: {}, notes: [], info: [], tipSha: '', remote, ref, remoteAheadUnfetched: false }
  if (!Array.isArray(families) || families.length === 0) return out
  let tip
  try {
    tip = transport.tipSha({ root, remote, ref })
  } catch (e) {
    out.notes.push(`远端不可问(${remote} ${ref}),原因:${oneLine(e)}`)
    return out
  }
  if (!tip || tip.ok !== true || !tip.sha) {
    out.notes.push(`远端不可问(${remote} ${ref}),原因:${tip?.reason ?? 'tipSha 没给出结论'}`)
    return out
  }
  out.tipSha = tip.sha
  let missingReason = ''
  try {
    transport.hasCommit({ root, sha: tip.sha })
  } catch (e) {
    missingReason = oneLine(e)
    // 这一档与"远端完全问不到"必须分开:tip 已经问到,说明对面确实在推进,只是那些对象
    // 还没进本地库 —— 自补救是一条有界 fetch,而不是猜它没占号(2026-09-29 D168 一手事故)。
    // 旧版把 fetch 留给调用方,而 §5b 禁手工 fetch/merge/push 循环 ⇒ 拦住不自助等于逼人挂应急旗
    // (2026-09-30 契约升级)。transport 没给 hydrate(测试夹具)⇒ 保持旧行为,直接进未补齐档。
    if (typeof transport.hydrate !== 'function') {
      out.notes.push(`对象不在本地,原因:${missingReason}`)
      out.remoteAheadUnfetched = true
      return out
    }
    try {
      transport.hydrate({ root, remote, ref })
    } catch (e2) {
      out.notes.push(`对象不在本地,自补救 fetch 失败,原因:${oneLine(e2)}(首次缺失:${missingReason})`)
      out.remoteAheadUnfetched = true
      return out
    }
    try {
      transport.hasCommit({ root, sha: tip.sha })
    } catch (e3) {
      out.notes.push(`对象不在本地,自补救 fetch 后仍读不到,原因:${oneLine(e3)}`)
      out.remoteAheadUnfetched = true
      return out
    }
    out.info.push(`对象原本不在本地(原因:${missingReason}),已自补救一次 fetch 后读齐远端面`)
  }
  let content
  try {
    content = transport.docContent({ root, sha: tip.sha, doc })
  } catch (e) {
    out.notes.push(`远端 tip ${tip.sha.slice(0, 8)} 里读不到 ${doc},原因:${oneLine(e)}`)
    return out
  }
  if (typeof content !== 'string') {
    out.notes.push(
      `远端 tip ${tip.sha.slice(0, 8)} 里读不到 ${doc},原因:transport 没返回文本(判不出,不算已对齐)`,
    )
    return out
  }
  for (const f of families) {
    const used = usedIdsOfPrefix(content, f)
    if (used === null) {
      out.notes.push(
        `${f} 族在远端那份 ${doc} 里一条登记行都没有 ⇒ 不构成上界(读到了而这一族为空,不是降级)`,
      )
      continue
    }
    out.max[f] = used.max
  }
  return out
}

/** 正文里出现了哪些取号族(按出现顺序去重)—— 族集合由正文推得,不在别处硬写清单。 */
export function idTokenFamilies(lines) {
  const found = []
  for (const l of lines)
    for (const m of String(l).matchAll(ID_TOKEN_RE)) {
      const f = m[1].toUpperCase()
      if (!found.includes(f)) found.push(f)
    }
  return found
}

/**
 * "号段基准"那一行的唯一措辞出口:三条读数(本地 max / 远端 max / 采用的基准)一起给 ——
 * 只印最终值就分不清"远端把这一段顶开了"与"远端压根没参与",而后者必须读成**未与远端对齐**。
 */
export function describeIdBasis(b, remote) {
  const head = `   号段基准:${b.family}=${b.chosenMax}(本地 HEAD 该族 max=${b.localMax}`
  if (b.remoteMax === null) return `${head} / 远端未参与:原因见上一行 ⇒ 未与远端对齐)`
  const rel = b.remoteMax > b.localMax ? '⇒ 取较大,新号跳过远端那段' : '⇒ 与本地同值,与改动前同形'
  return `${head} / 远端 ${remote?.ref ?? '?'} max=${b.remoteMax} ${rel})`
}

/**
 * 取号前的"远端对齐"闸门(纯函数)。2026-09-29 立，由 D168 让号枚的一手事故逼出：上一版对
 * "远端 tip 问得到、对象不在本地"只打一行警告就照发号 —— 本器当天真发出 `G-592/G-593` 两枚，
 * 与远端 09-28 的登记同号(其一已 `[x]`)，并集收敛后当场撞出 2 组 F9，须再让一次号才收得住。
 * **两种降级必须分档，不得并桶**：
 *  ① 远端完全问不到(离线 / CI / 凭据缺失)⇒ 照旧"警告着落号"。这一档没有便宜的补救动作，拒了
 *     等于把工具变成"断网就不能用"，而失效方向是逼人改用 pathspec 硬交(§12e 同一条禁令)。
 *  ② tip 已问到、只是对象还没进本地库 ⇒ 本器**自补救一次有界 fetch**(transport.hydrate,
 *     2026-09-30 契约升级 —— 旧版把 fetch 留给调用方，而 §5b 禁手工 fetch/merge/push 循环，拦住
 *     不自助只会把每个调用方逼向应急旗)；补后仍不在本地 ⇒ 拒绝并把出路写明白。
 * 只在"本次真的在发号"时判 —— 正文里没有取号令牌的纯改写落地不受影响(第三条分支返回 block:false)。
 */
export function idBasisGate({ families = [], remote = null, allowUnaligned = false } = {}) {
  if (!families.length || !remote) return { block: false, reason: '', note: '' }
  if (!remote.remoteAheadUnfetched) return { block: false, reason: '', note: '' }
  if (allowUnaligned)
    return {
      block: false,
      reason: '',
      note: `已按 IHUI_PLAN_ID_ALLOW_UNALIGNED 应急放行(远端 tip ${String(remote.tipSha || '').slice(0, 9)} 的对象仍不在本地 ⇒ 本次号**未与远端对齐**)`,
    }
  return {
    block: true,
    reason: `远端 tip ${String(remote.tipSha || '').slice(0, 9)} 已知在推进,而那些对象不在本地库`,
    note: '',
  }
}

/**
 * 第三参 `remote` 缺省 null ⇒ 只看本地底稿,与改动前逐字同形;传入时远端**只能抬高**游标
 * (`max(本地, 远端)`),永不压低 —— 所以镜像 N2 的"同 max"那一条要求行为与旧版完全一致。
 */
export function resolveIdTokens(lines, baseContent, remote = null, opts = {}) {
  const machineId =
    typeof opts?.machineId === 'string' && opts.machineId.trim() ? opts.machineId.trim() : null
  const families = idTokenFamilies(lines)
  if (families.length === 0) return { ok: true, lines, assigned: null, basis: [] }
  const cursor = new Map()
  const template = new Map()
  const basis = []
  // 千段租约(G-916936,2026-10-07):machineId 给定 ⇒ 每族先问租约 —— 自有段有空闲就段内连号,
  // 没有/段满就新占一段([max+1, max+1000],租约行由 main 随本块落账)。段尾号在占用面 ⇒ 无租约
  // 感知的 max+1 出口结构上落在段外。不给 machineId ⇒ startAt 与旧口径逐字同形(镜像 N2/N3 的面)。
  const leaseBounds = new Map()
  const leaseClaims = []
  const leaseNotes = []
  for (const f of families) {
    const used = usedIdsOfPrefix(baseContent, f)
    if (used === null) return { ok: false, reason: `no-such-family:${f}` }
    const remoteMax = Number.isFinite(remote?.max?.[f]) ? remote.max[f] : null
    const chosenMax = remoteMax !== null && remoteMax > used.max ? remoteMax : used.max
    let startAt = chosenMax
    if (machineId) {
      const cur = decideLease({ baseContent, family: f, used, baseMax: chosenMax, machineId })
      const lbl = (n) => used.template.replace('%d', String(n))
      if (cur.mode === 'in-lease') {
        startAt = cur.next - 1
        leaseBounds.set(f, cur.lease.end)
        leaseNotes.push(
          `号段租约:本机=${machineId} 在自有段 ${lbl(cur.lease.start)}~${lbl(cur.lease.end)} 内连号(本次首号=${lbl(cur.next)})`,
        )
      } else {
        startAt = cur.start - 1
        leaseBounds.set(f, cur.end)
        leaseClaims.push({ family: f, template: used.template, start: cur.start, end: cur.end })
        leaseNotes.push(
          `号段租约:本机=${machineId} 新占段 ${lbl(cur.start)}~${lbl(cur.end)}(主键=段尾号,随本块落账;段满由后续取号另立下一段)`,
        )
      }
    }
    cursor.set(f, startAt)
    template.set(f, used.template)
    // 三条读数一起交出:报告里"号段基准"那一行必须能说清号是从哪一侧算出来的,
    // 只印最终值就分不清"远端把这一段顶开了"与"远端压根没参与"。
    basis.push({ family: f, localMax: used.max, remoteMax, chosenMax })
  }
  const got = []
  let exhaustedFamily = null
  const out = lines.map((l) =>
    String(l).replace(ID_TOKEN_RE, (_, raw) => {
      const f = raw.toUpperCase()
      const next = cursor.get(f) + 1
      cursor.set(f, next)
      const bound = leaseBounds.get(f)
      if (machineId && bound !== undefined && next > bound && exhaustedFamily === null)
        exhaustedFamily = f
      const id = template.get(f).replace('%d', String(next))
      got.push(id)
      return id
    }),
  )
  if (exhaustedFamily !== null)
    return { ok: false, reason: `lease-exhausted-mid-edit:${exhaustedFamily}` }
  return {
    ok: true,
    lines: out,
    assigned: [...new Set(got)].join(','),
    basis,
    leaseClaims,
    leaseNotes,
  }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const MAX_CAS_ATTEMPTS = 12

const norm = (s) => s.replace(/\r\n/g, '\n')

/** 读 env + 输入文件并判用法;不合法 ⇒ {error}(调用方折 exit 2)。 */
export function readInputs(env = process.env) {
  const doc = env.LIVE_DOC ?? ''
  const blockFile = env.LIVE_BLOCK_FILE ?? ''
  const anchorFile = env.LIVE_ANCHOR_FILE ?? ''
  const replaceFile = env.LIVE_REPLACE_FILE ?? ''
  const msg = env.LIVE_MSG ?? ''
  const root = env.LIVE_ROOT ? resolve(env.LIVE_ROOT) : REPO_ROOT
  if (!doc || !msg) return { error: '缺 LIVE_DOC / LIVE_MSG ⇒ 拒绝执行' }
  if (replaceFile !== '' && (blockFile !== '' || anchorFile !== ''))
    return {
      error:
        '改写档(LIVE_REPLACE_FILE)与插入档(LIVE_BLOCK_FILE / LIVE_ANCHOR_FILE)互斥 ⇒ 一次只做一件事',
    }
  if (replaceFile !== '') {
    let pairs
    try {
      pairs = JSON.parse(readFileSync(replaceFile, 'utf8'))
    } catch (e) {
      return { error: `读不到/解析不了 LIVE_REPLACE_FILE(${replaceFile}):${e?.message ?? e}` }
    }
    if (!Array.isArray(pairs) || pairs.length === 0)
      return { error: 'LIVE_REPLACE_FILE 必须是非空数组 [{before, after}]' }
    for (const [i, p] of pairs.entries()) {
      if (typeof p?.before !== 'string' || typeof p?.after !== 'string')
        return { error: `第 ${i + 1} 项缺 before/after 或不是字符串 ⇒ 拒绝执行` }
      if (p.before.includes('\n') || p.after.includes('\n'))
        return { error: `第 ${i + 1} 项含换行 ⇒ 本档只作**整行**替换(多行请拆成多项)` }
      if (p.before === p.after)
        return { error: `第 ${i + 1} 项 before == after ⇒ 无事可做,剔除后再跑` }
      if ('all' in p && p.all !== true)
        return { error: `第 ${i + 1} 项的 all 只允许写 true(缺省=恰好命中 1 次;放宽成任意真值就等于没有这条锁)` }
    }
    if (!resolveHeadRef({ root }))
      return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
    return { root, doc, msg, block: null, anchorLines: null, replacements: pairs }
  }
  if (!blockFile) return { error: '缺 LIVE_BLOCK_FILE(或改用 LIVE_REPLACE_FILE 走整行改写档)' }
  let block
  try {
    block = norm(readFileSync(blockFile, 'utf8'))
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
      .split('\n')
  } catch (e) {
    return { error: `读不到 LIVE_BLOCK_FILE(${blockFile}):${e?.message ?? e}` }
  }
  if (block.length === 0 || block.every((l) => l.trim() === ''))
    return { error: '待插入正文块为空,拒绝执行' }
  let anchorLines = null
  if (anchorFile !== '') {
    let anchor
    try {
      anchor = norm(readFileSync(anchorFile, 'utf8')).replace(/\n+$/, '')
    } catch (e) {
      return { error: `读不到 LIVE_ANCHOR_FILE(${anchorFile}):${e?.message ?? e}` }
    }
    if (anchor === '') return { error: '锚点文件为空 ⇒ EOF 追加请干脆不传 LIVE_ANCHOR_FILE' }
    anchorLines = anchor.split('\n')
  }
  if (!resolveHeadRef({ root }))
    return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
  return { root, doc, msg, block, anchorLines }
}

/** 锚点命中数与末位命中起点(恰好 1 才可继续;0 / >1 一律交调用方拒绝)。 */
export function locateAnchor(baseLines, anchorLines) {
  let hits = 0
  let idx = -1
  for (let i = 0; i + anchorLines.length <= baseLines.length; i++) {
    if (baseLines[i] === anchorLines[0] && anchorLines.every((l, k) => baseLines[i + k] === l)) {
      hits += 1
      idx = i
    }
  }
  return { hits, idx }
}

/** 正则字面量转义:块文本里任何字符都可能是元字符(`.` `(` `[` `*` `$` `\` …),一律按字面判。 */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 幂等判据(①)的匹配式编译面:把**模板行**(仍带 `{{NEXT_ID:族}}`)编成整行锚定的正则,
 * 令牌的数字段是唯一可变位,其余字符逐字等值。
 *
 * 为什么必须放开这一位:同一块第二次跑产出的文本**不逐字相同**(第一次的号已进底稿,第二次号更大),
 * 纯逐行等值会漏掉的恰恰是台账记下的那一型;而把"逐字不同"一律读成"内容不同"就又回到重复落地。
 * 为什么形状只取 `usedIdsOfPrefix` 的 `template`(与本器取号同一个出口):本仓纪律是"两处算同一件事
 * 必漂移",`G-265` 带连字符而 `O4` 不带这类书写差异由该族自己现读决定,不在这里再抄一张族表。
 * 无令牌的块 ⇒ 匹配式就是逐字面 ⇒ 等价于票面 ① 原文那句"逐行等值"(这是缺省形态,不是特例)。
 * 编不出形状 ⇒ `ok:false`(调用方拒绝落地,不退化成"逐字等值再判一次"——那会把这一型洗成"未在位")。
 */
export function compileBlockMatchers(templateLines, baseContent) {
  const shapes = {}
  for (const f of idTokenFamilies(templateLines)) {
    const used = usedIdsOfPrefix(baseContent, f)
    if (!used || typeof used.template !== 'string' || !used.template.includes('%d'))
      return { ok: false, reason: `family-shape-unreadable:${f}` }
    const at = used.template.indexOf('%d')
    shapes[f] =
      escapeRegExp(used.template.slice(0, at)) + '\\d+' + escapeRegExp(used.template.slice(at + 2))
  }
  const matchers = []
  for (const l of templateLines) {
    const line = String(l)
    let src = ''
    let last = 0
    for (const m of line.matchAll(ID_TOKEN_RE)) {
      src += escapeRegExp(line.slice(last, m.index))
      const shape = shapes[m[1].toUpperCase()]
      if (!shape) return { ok: false, reason: `family-shape-unreadable:${m[1].toUpperCase()}` }
      src += `(?:${shape})`
      last = m.index + m[0].length
    }
    src += escapeRegExp(line.slice(last))
    matchers.push(new RegExp(`^${src}$`))
  }
  return { ok: true, matchers, families: Object.keys(shapes) }
}

/**
 * 幂等判据(①)的判据本体:在**本轮实际取材的那一面**(= 传进来的 `baseLines`,由该次 CAS 从 HEAD
 * 现取)上现读"锚点之后紧邻 N 行"是否已是本块。
 * 三条不冒充:锚点命中数 ≠ 1 ⇒ 本函数**不表态**(`anchor-not-unique`),交给 `assemble` 那条既有判据去
 * 区分"文案已漂"与"有歧义" —— 同一件事在两处各判一次必然漂移(本仓"两处算同一件事"记过多次)。
 * EOF 追加档(`anchorLines` 缺省)⇒ 一律 `no-anchor`,原因写在头注"已知边界"那一格(N4 的既有断言依赖
 * EOF 档可重复追加),不是"忘了做"。
 */
export function blockInPlaceCheck({ baseLines, anchorLines, matchers }) {
  const n = Array.isArray(matchers) ? matchers.length : 0
  if (!anchorLines) return { inPlace: false, verdict: 'no-anchor', need: n }
  if (n === 0) return { inPlace: false, verdict: 'no-matcher' }
  const { hits, idx } = locateAnchor(baseLines, anchorLines)
  if (hits !== 1) return { inPlace: false, verdict: 'anchor-not-unique', hits }
  const at = idx + anchorLines.length
  const seen = baseLines.slice(at, at + n)
  if (seen.length < n)
    return { inPlace: false, verdict: 'too-short', need: n, got: seen.length, at, anchorAt: idx + 1 }
  for (let i = 0; i < n; i++)
    if (!matchers[i].test(seen[i]))
      return {
        inPlace: false,
        verdict: 'content-differs',
        need: n,
        at,
        anchorAt: idx + 1,
        firstDiffAt: at + i + 1,
        expected: String(matchers[i].source),
        actual: seen[i],
      }
  return { inPlace: true, at, lines: n, anchorAt: idx + 1 }
}

/**
 * "已在位"那一档的唯一措辞出口(纯函数,便于镜像测试把依据逐字钉住)。
 * 必须点名:锚点(第几行 + 原文前缀)、块行数、落点行号、编号位这一维怎么判的 —— 让读的人知道为什么没动。
 */
export function describeInPlace({ chk, anchorLines, head, families }) {
  const where = anchorLines
    ? `锚点 = 被审面第 ${chk.anchorAt} 行「${String(anchorLines[0]).slice(0, 60)}」`
    : '锚点 = 无'
  const idDim =
    families && families.length
      ? `编号位按族形状视作可变段(${families.join(',')} 族,形状现取自 usedIdsOfPrefix),其余字符逐字等值`
      : '本块无取号令牌 ⇒ 逐字等值'
  return [
    `✅ 本块已在位 ⇒ 不插入、不产生新提交(退出码 0 = 交付事实,不是失败 ⇒ **不要重跑**)`,
    `   判定依据:${where};块行数 ${chk.lines};被审面第 ${chk.at + 1}..${chk.at + chk.lines} 行与本块逐行等值(现读 HEAD=${String(head).slice(0, 12)} 的那一面,不读磁盘)`,
    `   ${idDim}`,
  ].join('\n')
}

/**
 * 畸形登记编号的判据**不在这里**(2026-09-29 收口)。本器是这一形态的生产者(取号令牌展开值已含族名,
 * 正文再手写一个字面族名就产出 `DD128` / `G-G-334`),而判据此前在生产侧与 lib 各写了一份 ——
 * 两份"什么算畸形"必然漂开,且漂开的两个方向账面都是绿的。现只留 lib `plan-task-index.mjs` 那一份实现,
 * 下面这行纯转发就是镜像测试 `plan-tasks-f9b.test.mjs` ③ 的**对象同一性**断言所要求的东西
 * (`LDE.MALFORMED_ID_RE === LIB.MALFORMED_ID_RE` 比"两条正则长得像"强:改一处必然两把尺子同时动)。
 * 为什么这一族必须在生产侧兑现:防丢门(守门 71)结构上只查"行消失",对编号形态完全失明。
 */
export {
  MALFORMED_ID_RE,
  MALFORMED_BODY_RE,
  findMalformedIds,
  findMalformedRows,
  newMalformed,
  malformedLine,
}

/**
 * 索引对齐这一步的结论 ⇒ 退出码与措辞的唯一出口(纯函数 —— 这类"两个方向"的行为只能在构造面上钉,
 * 端到端一次只能造出一个方向;头注 G-321② 那条分档判据的全部牙齿都在这里)。
 *  ① 没落地 ⇒ 1:这一档绝不能被 ② 顺手洗绿(否则"内容没进库"读起来像"只是索引的事")。
 *    `main()` 的"CAS 12 次未抢到"那一支也走这里 ⇒ 失败措辞与退出码同源,不留第二份。
 *  ② 内容已入库、仅共享主索引未对齐 ⇒ **0** + 点名 sha 与原因:非零退出会被调用方读成"没落",而"没落"
 *    的唯一反应就是重跑 —— 重跑正是 G-321 那次造出重复段落的一步。同时把"重跑不会补对齐"与后果写清楚。
 *  ③ 已对齐 ⇒ 沿用改动前那行措辞**逐字不变**(既有断言 T4/T13 钉着它,漂了就等于放宽既有判据)。
 */
export function alignOutcome({ landedSha = '', doc = '', align = {}, detail = '' } = {}) {
  if (!landedSha)
    return {
      code: 1,
      lines: [
        `❌ 内容未落地${detail ? `(${detail})` : ''}⇒ 退出码 1:这不是"仅索引未对齐",不得读成已交付`,
      ],
    }
  const tail = [
    ...(align.skipped ?? []).map((s) => `⚠️ 未动(归属他人):${s.path}(${s.reason})`),
    ...(align.undetermined ?? []).map((u) => `⚠️ 未判定:${u.path}(${u.reason})`),
  ]
  if (align.lockAbandoned || align.failed) {
    const reason = align.lockAbandoned
      ? '.git/index.lock 锁龄超上限 ⇒ 不代删别人的锁'
      : String(align.error ?? '轮次耗尽')
    return {
      code: 0,
      lines: [
        `⚠️ 内容已入库 ${landedSha}(doc=${doc})⇒ 交付完成;**仅共享主索引未对齐**(原因:${reason})`,
        `   这一档不是失败:退出码 0。重跑本工具会被幂等判据判成"已在位"而**不会**把索引对齐,所以别用重跑修它。`,
        `   后果与出口:主索引仍停在父提交 blob ⇒ 任何人一枚不带 pathspec 的普通提交就会把本次交付写回旧版;人工确认锁的归属后,按 alignSharedIndex 同一条判据(索引 blob == 父提交 blob 或索引里没有该路径 ⇒ 才动)单独对齐。`,
        ...tail,
      ],
    }
  }
  const moved = align.moved?.length ?? 0
  const already = align.already?.length ?? 0
  return {
    code: 0,
    lines: [`✅ 主索引已对齐 ${moved + already}/1 路径(移动 ${moved} / 已就位 ${already})`, ...tail],
  }
}

/**
 * 组装 + 结构等值自证(唯一的零损失判据,禁止换成重复行计数):
 *  anchor 模式:next == base[0..insertAt) ⊕ block ⊕ base[insertAt..)
 *  eof    模式:next == base(剥尾部空行) ⊕ [''] ⊕ block ⊕ ['']
 * 返回 { ok, next, insertAt, blockLen } —— ok=false 表示组装后前后缀不再逐字相等(内部错位)。
 */
export function assemble(baseLinesIn, block, anchorLines) {
  const baseLines = baseLinesIn.slice()
  if (anchorLines) {
    const { hits, idx } = locateAnchor(baseLines, anchorLines)
    if (hits !== 1)
      return { ok: false, reason: hits === 0 ? 'not-found' : `multi-hit:${hits}`, next: null }
    const insertAt = idx + anchorLines.length
    const next = [...baseLines.slice(0, insertAt), ...block, ...baseLines.slice(insertAt)]
    const tailOk = sameLines(next.slice(insertAt + block.length), baseLines.slice(insertAt))
    const headOk = sameLines(next.slice(0, insertAt), baseLines.slice(0, insertAt))
    return { ok: headOk && tailOk, next, insertAt, blockLen: block.length }
  }
  while (baseLines.length > 0 && baseLines[baseLines.length - 1].trim() === '') baseLines.pop()
  const next = [...baseLines, '', ...block, '']
  const headOk = sameLines(next.slice(0, baseLines.length), baseLines)
  return { ok: headOk, next, insertAt: baseLines.length, blockLen: block.length }
}

/**
 * 整行改写档:默认每项 `before` 必须**恰好命中 1 次**;带 `all: true` 的那项允许命中 N 次并**全部**替换
 * (0 次仍然拒 —— "文案已漂"与"有歧义"是两件事,只有前者在任何档下都不可猜)。
 * 为什么需要 `all`(2026-09-28 由活文档清账逼出):台账里有一批**逐字相同的孪生登记行**(同一句话被并发
 * 并集复制成 2..10 份),要施加的改写对每一份都完全相同(摘掉过期认领牌 / 翻勾归并注记)。此时"改哪一份"
 * 语义上没有区别,而按"必须命中 1 次"就会 16/27 行落不了地,只能留成半新半旧的两个面孔 —— 那比不改更糟。
 * 三条护栏:① `all` 必须显式声明,缺省仍是恰好 1 次(旧的"不猜"语义一字未松);② 任一 `before` 不得等于
 * 另一项的 `after`(逐项顺序替换,否则前一项的产物会被后一项再改一遍,而声明里没这件事);③ 命中数如实
 * 打印并计入 `hits`,所以"除被改的行以外逐行等值 + 总行数不变"这条结构等值照旧全覆盖。
 * 两条自证各防一型:命中数防"锚点文案已漂"(0 一律拒);逐位等值防"替换式顺手把别的行顶掉"。
 */
export function applyReplacements(baseLines, pairs) {
  const next = baseLines.slice()
  const hits = new Set()
  for (const [i, p] of pairs.entries()) {
    for (const [j, q] of pairs.entries()) {
      if (i === j) continue
      if (p.before === q.after) return { ok: false, reason: `chain-hit#${i + 1}<-${j + 1}`, next: null }
    }
  }
  const multi = []
  for (const [i, p] of pairs.entries()) {
    const idxs = []
    for (let k = 0; k < next.length; k++) if (next[k] === p.before) idxs.push(k)
    if (idxs.length === 0) return { ok: false, reason: `replace-not-found#${i + 1}`, next: null }
    if (idxs.length !== 1 && !p.all)
      return { ok: false, reason: `replace-multi-hit#${i + 1}:${idxs.length}`, next: null }
    if (idxs.length > 1) multi.push({ item: i + 1, count: idxs.length })
    for (const at of idxs) {
      next[at] = p.after
      hits.add(at)
    }
  }
  if (next.length !== baseLines.length)
    return { ok: false, reason: 'line-count-changed', next: null }
  for (let k = 0; k < baseLines.length; k++)
    if (!hits.has(k) && next[k] !== baseLines[k])
      return { ok: false, reason: `untouched-line-drift@${k + 1}`, next: null }
  return { ok: true, next, hits: [...hits], multi }
}

// ---------------------------------------------------------------------------
// G-1079146 登记入口取值(2026-10-08):新行里的 sha 形态指针,落库前当场问一次
// ---------------------------------------------------------------------------

/**
 * 单枚探测的预算。为什么逐枚问而不是一次 `cat-file --batch-check`:那条批量口问的是**对象存在性**,
 * 而票面钉的判据是 `rev-parse --verify <tok>^{commit}` —— 存在 ≠ 是 commit(blob/tree  oid 也会"在"),
 * 借批量口就等于把判据换成另一件东西。一次登记通常 1-3 枚,枚数上限只是"某行抄了一整段 git log"
 * 那种病态输入的护栏(超上限**放行并报名**,不判红 —— 与"未判定 ⇒ 放行"同一条失效方向)。
 */
const SHA_PROBE_TIMEOUT_MS = 15_000
const SHA_PROBE_MAX_BUFFER = 8 << 20
const SHA_PROBE_MAX = 40

/** 探测用的 transport:与 `REMOTE_ID_TRANSPORT` 同一套注入形态,测试换它而不换判据。 */
export const SHA_PROBE_TRANSPORT = {
  ask: (args, root, opts) => gitRaw(args, root, opts),
}

/**
 * 判据命令文本(打印给人看的那一行)。**必须与 `makeShaProber` 真跑的 args 同形** ——
 * 报告里写一条跑不通的命令,就等于让下一个人照着一条不存在的路子查(本仓"文档不得写跑不通的出路")。
 */
export function shaProbeCommand(token) {
  return `git rev-parse --verify ${token}^{commit}`
}

/**
 * 生产探测器的三态,和它存在的理由:
 *  - `ok`            ⇒ git 答得出这枚 commit(带全量 40 位回显)⇒ 放行;
 *  - `bad`           ⇒ git **明确答了**"不是单个 revision"(`rev-parse --verify` 实测回 rc=128;
 *                      个别 git 形态回 rc=1)⇒ 拒绝落该行;
 *  - `undetermined`  ⇒ 根本没答(超时被信号杀 ⇒ 无 status;ENOENT;派生故障),或 pre-flight 就没过
 *                      ⇒ **放行**。把"没答"折叠成 `bad` 就是把"没判"写成"判过了"(本仓最高频失效型),
 *                      而这里折叠的代价是挡死全队台账写入。
 * rc 是从 `gitRaw` 抛上来的 `e.status`(Node 直接给的机器事实)取的,**不是** parse 错误文本
 * —— 拿异常消息字符串当判据,消息一改整档就静默改判。
 */
export function makeShaProber({ root, transport = SHA_PROBE_TRANSPORT, timeout = SHA_PROBE_TIMEOUT_MS } = {}) {
  const cache = new Map()
  let preflight = null
  const ask = (args) => transport.ask(args, root, { timeout, maxBuffer: SHA_PROBE_MAX_BUFFER })
  return function probe(token) {
    if (cache.has(token)) return cache.get(token)
    if (preflight === null) {
      try {
        ask(['rev-parse', '--verify', 'HEAD'])
        preflight = true
      } catch (e) {
        preflight = false
        // pre-flight 失败原因留着报出去,别让它读成"什么都没发生"
        cache.set('__preflight__', { state: 'undetermined', why: `仓库/git 不可问:${e?.message ?? e}` })
      }
    }
    let r
    if (!preflight) {
      r = cache.get('__preflight__') || {
        state: 'undetermined',
        why: '仓库/git 不可问(rev-parse HEAD 未成功)⇒ 本步整档放行',
      }
    } else {
      try {
        r = { state: 'ok', sha: String(ask(['rev-parse', '--verify', `${token}^{commit}`])).trim() }
      } catch (e) {
        const status = typeof e?.status === 'number' ? e.status : null
        r =
          status === 1 || status === 128
            ? { state: 'bad', status }
            : {
                state: 'undetermined',
                why: `git 派生未拿到结论(status=${status === null ? '无' : status}):${String(e?.message ?? e).slice(0, 160)}`,
              }
      }
    }
    cache.set(token, r)
    return r
  }
}

/**
 * 三条放过(票面要求第 2 条)。顺序即优先级,命中任一条 ⇒ **不判**(不是"判不出",是"不归这一型")。
 * 为什么必须在判据侧:票面 ③ 实测 13/35 是**形状撞车**(设备序列号 / bundle contenthash /
 * pnpm store 哈希 / ref 名片段 / 外部仓 revision),而"把这几种写法换个说法"摘不出任何一种 ——
 * 措辞侧的排除只是把同一枚 token 换个皮再判一次,或者干脆永远判不到。
 * 三条都刻意窄到"不可能盖住 `提交 \`abc1234\`` / `落地 abc1234` / 反引号裸写`这三型目标形态"。
 */
export const SHA_PASS_CONFIG_PREFIX_RE =
  /(?:integrity|content-?hash|digest|checksum|md5|sha\d+|revision|serial(?:no|number)?|keyid|kid|version|ver|build-id|buildid)[\s"'`:=_./-]{0,6}$/i
export const SHA_PASS_FILE_EXT_RE = /^\.[A-Za-z0-9]{1,8}/
export const SHA_PASS_REF_PATH_RE =
  /(?:^|[\s"'`(])((?:refs|remotes|heads|tags|origin|upstream)\/)/i
export const SHA_PASS_ATTACHED_RE = /[-.]$/

export function shaPassReason({ before = '', after = '' } = {}) {
  const tail = String(before).slice(-60)
  const head = String(after).slice(0, 20)
  const seg = tail.slice(Math.max(tail.lastIndexOf(' '), tail.lastIndexOf('\t')) + 1)
  // ③ ref 名内段:处在 `refs/` `heads/` `tags/` `origin/` `upstream/` 这条路径里。
  //    必须排在"路径分隔"之前判 —— 否则 `origin/<hex>` 被 ② 抢去标成文件名,两型在账面上分不开。
  if (SHA_PASS_REF_PATH_RE.test(tail) || /(?:refs|remotes|heads|tags|origin|upstream)\//i.test(seg))
    return 'ref-segment(处在 ref 名路径里)'
  // ② 文件名形态:紧邻扩展名(`.chunk.mjs`)/ 紧邻路径分隔(左侧是 `/`)
  if (SHA_PASS_FILE_EXT_RE.test(head)) return 'file-name(右侧紧邻扩展名)'
  if (/\/$/.test(tail)) return 'file-name(左侧紧邻路径分隔)'
  // ③ 非独立 hex token:被 `-` / `.` 连进一个名字里(HEX_RUN 已排除紧邻字母数字与 `_`,这里补两种)
  if (SHA_PASS_ATTACHED_RE.test(tail) || /^[-]/.test(head)) return 'attached(不是独立 hex token)'
  // ① 声明表/配置前缀形态:键名紧跟分隔符再跟这串(`serial=` / `integrity sha512-` / `revision: `)
  if (SHA_PASS_CONFIG_PREFIX_RE.test(tail)) return 'config-prefix(声明表/配置键值位)'
  return null
}

/**
 * 整行改写档的"多出的部分"(票面要求第 1 条)用 **token 级携带**算,不用字符级公共前后缀:
 * 实测翻勾的形状是 `- [ ] … 落地 aaaa1111 待办` → `- [x] … 落地 aaaa1111 已完成(补 bbbb2222)`,
 * 公共前缀只到 `- [`、公共后缀为 0 —— 按前后缀切会把存量那枚 `aaaa1111` 也算成"新增",于是
 * **别人三周前落的指针把这次的结清动作钉红**(恒挡同一条,§12e)。抽取判据仍是同一份(权威门),
 * 这里只是把 `before` 里已在的候选记成 skip 集合,由 judge 记"携带"而不判。
 */
export function rewriteEntryOf(before, after) {
  const skip = new Set()
  for (const c of extractFromLine(String(before ?? ''), 1))
    if (classifyShape(c.token).kind === 'candidate') skip.add(c.token)
  const text = String(after ?? '')
  return { text, from: 0, to: text.length, skip }
}

/** token 在一行里的全部起点(用于把"判的范围"限到新增段;不是第二套抽取判据 —— 抽取仍走权威门)。 */
function tokenOffsets(line, token) {
  const at = []
  let i = String(line).indexOf(token)
  while (i !== -1) {
    at.push(i)
    i = String(line).indexOf(token, i + token.length)
  }
  return at
}

/**
 * `LIVE_SHA_ALLOW=<token>=<原因>[;<token2>=<原因2>…]` ⇒ Map(token → 原因)。
 * 无 `=`、原因为空、token 为空一律**不收录**(无原因不放行);收进来的每一条都会被打印出来。
 */
export function parseShaAllow(raw) {
  const m = new Map()
  for (const part of String(raw ?? '').split(/[;\n]+/)) {
    const s = part.trim()
    if (!s) continue
    const eq = s.indexOf('=')
    if (eq <= 0) continue
    const token = s.slice(0, eq).trim().toLowerCase()
    const reason = s.slice(eq + 1).trim()
    if (!token || !reason) continue
    m.set(token, reason)
  }
  return m
}

/**
 * 取值判据本体(纯函数:抽取与形状走权威门那一份,git 由注入的 `probe` 给 ⇒ 测试能造三态)。
 * @param {Array<{text:string,from?:number,to?:number}>} entries 只含**本次新增/新增段**的行
 * @returns {{blocked:Array,allowed:Array,undetermined:Array,exempt:Array,resolved:Array,overCap:Array,probed:number}}
 *  `blocked` 非空 ⇒ 调用方 exit 1;`undetermined` / `overCap` 永不参与判红(失效方向是放行 + 报名)。
 */
export function judgeNewLineShas(entries, { probe, allow = new Map(), maxProbes = SHA_PROBE_MAX } = {}) {
  const out = {
    blocked: [],
    allowed: [],
    undetermined: [],
    exempt: [],
    carriedOver: [],
    resolved: [],
    overCap: [],
    probed: 0,
  }
  const memo = new Map()
  for (const [ei, e] of (entries ?? []).entries()) {
    const text = String(e?.text ?? '')
    if (text === '') continue
    const from = Math.max(0, Number(e?.from) || 0)
    const to = Math.min(text.length, e?.to === undefined ? text.length : Number(e.to))
    // 抽取与形状判定都只有一份实现(权威门),本器不抄第二条 hex 正则。
    for (const c of extractFromLine(text, ei + 1)) {
      const shape = classifyShape(c.token)
      if (shape.kind !== 'candidate') continue
      const spots = tokenOffsets(text, c.token).filter(
        (i) => i >= from && i + c.token.length <= to,
      )
      if (spots.length === 0) continue // 只出现在存量段 ⇒ 不回判
      if (e.skip && e.skip.has(c.token)) {
        // 整行改写档:before 里就有这枚 token ⇒ 它是被这次改写"携带"过来的存量,不是新写的指针
        out.carriedOver.push({ token: c.token, line: c.line })
        continue
      }
      const before = text.slice(Math.max(0, spots[0] - 60), spots[0])
      const after = text.slice(spots[0] + c.token.length, spots[0] + c.token.length + 20)
      const pass = shaPassReason({ before, after })
      if (pass) {
        out.exempt.push({ token: c.token, pass, line: c.line, lineText: c.lineText })
        continue
      }
      const why = allow.get(c.token)
      if (why) {
        out.allowed.push({ token: c.token, reason: why, line: c.line })
        continue
      }
      let st = memo.get(c.token)
      if (st === undefined) {
        if (out.probed >= maxProbes) {
          out.overCap.push({ token: c.token, line: c.line })
          continue
        }
        out.probed += 1
        st = probe(c.token) || { state: 'undetermined', why: 'probe 没给结论' }
        memo.set(c.token, st)
      }
      if (st.state === 'ok') out.resolved.push({ token: c.token, sha: st.sha, line: c.line })
      else if (st.state === 'bad')
        out.blocked.push({
          token: c.token,
          shape: `${c.token.length} 位 hex(${shape.kind})`,
          cmd: shaProbeCommand(c.token),
          status: st.status ?? null,
          line: c.line,
          lineText: c.lineText,
        })
      else out.undetermined.push({ token: c.token, why: st.why || 'probe 未给状态', line: c.line })
    }
  }
  return out
}

/** 拒绝/放行/未判定的措辞唯一出口(纯函数 ⇒ 两个方向都能在构造面上钉,端到端一次只能造一个)。 */
export function shaGateReport(v) {
  const lines = []
  for (const a of v.allowed)
    lines.push({ kind: 'info', text: `ℹ 取值放行留痕(G-1079146 应急通道 LIVE_SHA_ALLOW):${a.token} ⇒ 原因:${a.reason}` })
  for (const u of v.undetermined)
    lines.push({
      kind: 'warn',
      text: `⚠️ 取值未判定:${u.token} ⇒ ${u.why} ⇒ **放行**(判不出 ≠ 坏;这一步挡的是全队台账写入,恒挡逼人绕回 pathspec)`,
    })
  if (v.overCap.length)
    lines.push({
      kind: 'warn',
      text: `⚠️ 取值探测到上限(单轮 ${SHA_PROBE_MAX} 枚)⇒ 其余 ${v.overCap.length} 枚未问 ⇒ 放行并只报名,不判红`,
    })
  if (v.carriedOver.length)
    lines.push({
      kind: 'info',
      text: `ℹ 取值:整行改写携带存量 sha ${v.carriedOver.length} 枚(${v.carriedOver.map((c) => c.token).join(' ')}),before 里本来就有 ⇒ 不回判、不拦这次的结清动作;存量清偿另计批`,
    })
  if (v.blocked.length === 0 && v.probed > 0)
    lines.push({
      kind: 'info',
      text: `✅ 取值:新行 ${v.probed} 枚 sha 形态指针全部可解析(放过 ${v.exempt.length} / 携带存量 ${v.carriedOver.length} / 放行 ${v.allowed.length} / 未判定 ${v.undetermined.length})`,
    })
  if (v.blocked.length > 0) {
    lines.push({
      kind: 'error',
      text: `❌ 本次要新增的行里有 ${v.blocked.length} 枚 sha 形态指针**当场问不到 commit** ⇒ 拒绝落该行(G-1079146:短 sha 的可解析性寄生在本机对象库 + 本机 lineage,登记这一刻问才不会留腐烂)`,
    })
    for (const b of v.blocked.slice(0, 8)) {
      lines.push({
        kind: 'error',
        text: `   · token=${b.token}(形状 ${b.shape})判据 \`${b.cmd}\` ⇒ 不通过${b.status === null ? '' : `(git rc=${b.status})`}`,
      })
      lines.push({ kind: 'error', text: `     所在行:${b.lineText}` })
      lines.push({
        kind: 'error',
        text: `     建议:① 先跑 git fetch origin main 再重跑(§5b 的 .git 事故链 / 别机交付形态,本机结构上不可能解析);② 该对象在本机确能解析就写全量 40 位,否则换内容锚点(编号 + 标题原文);③ 它本来就不是 commit(设备序列号 / contenthash / ref 名片段 / 外部仓 revision)而三条放过没盖住这一种 ⇒ 用 LIVE_SHA_ALLOW=${b.token}=<一句话原因>。`,
      })
    }
    lines.push({
      kind: 'error',
      text: `   **禁止**从同段挑一枚"看起来对的 sha"自动补进去(§1 / G-191:那是编造,不是找回)。`,
    })
  }
  return lines
}

async function main() {
  const inputs = readInputs()
  if (inputs.error) {
    console.error(`❌ ${inputs.error}`)
    process.exit(2)
  }
  const { root, doc, msg, block, anchorLines, replacements } = inputs
  const mode = replacements ? '整行改写' : anchorLines ? '锚点插入' : 'EOF 追加'
  // 千段租约的机器标识(取号主体):env IHUI_MACHINE_ID > 主机名+仓根指纹。只取一次,
  // CAS 各轮重算的是"面",标识本身不随轮次变。
  const machineId = machineIdentity(root)
  // G-1079146 取值探测器:cache 跨 CAS 各轮复用(同一枚 token 问一次就够,对象库不会在一次运行里
  // 凭空多出来);root 用 readInputs 解析过的那一个,不猜调用方位置。
  const shaProbe = makeShaProber({ root })
  const shaAllow = parseShaAllow(process.env.LIVE_SHA_ALLOW)

  let landed = ''
  let parentSha = ''
  let rejectReason = ''
  let baseCount = 0
  let nextCount = 0
  // 每次尝试都可能重算令牌 ⇒ 生效版本必须活到循环外给回读用
  let effBlock = block
  let effReplacements = replacements
  let assigned = null
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = git(['rev-parse', 'HEAD'], { root })
    if (headBlobOf(head, doc, { root }) === ABSENT) {
      console.error(`❌ 目标文档 ${doc} 不在 HEAD 里(${mode})⇒ 不猜,拒绝落地`)
      process.exit(1)
    }
    const baseLines = norm(git(['show', `${head}:${doc}`], { root, raw: true })).split('\n')
    baseCount = baseLines.length
    const ledgerText = baseLines.join('\n')
    // ── 取号的**占用面**:台账 ⊕ `.ihui-agent/archive/PROJECT_PLAN*.md`(2026-09-28 补)──
    // 为什么必须宽面:归档器把已完成条目整块搬进归档件、台账只留一行 HTML 注释占位,于是只看
    // 台账的 max 会随每次归档**回落**,令牌就会发出已用过的号(立门当日现读 O 族:台账 88 / 宽面 90;
    // 一天内重发两次号登记在 6b812de31)。判据仍只有一份 —— 本器不抄第二份编号语法,宽面由
    // lib/plan-id-face.mjs 给,取号/形状都走 lib/plan-task-index.mjs 的 usedIdsOfPrefix。
    // 为什么它**必须在 CAS 循环内**:与远端基准同理 —— HEAD 每轮在动,归档件也随归档提交增长,
    // 提到循环外就把"这一轮看到的面"烘成一次性读数(N5 那条锁判的就是同一型)。
    // 为什么拒绝而不是退回窄面:按窄面发号**正是本缺陷的症状**,而撞号事后结构上判不了
    // (lib usedIdsOfPrefix 头注记过);停在这里只贵一次重试。
    // 非 PROJECT_PLAN.md(AGENTS/README)⇒ 归档件不适用,面 = 该文档自身,与改动前逐字同形。
    const idFace = collectIdFace({ root, source: head, doc, ledgerText })
    for (const n of idFace.notes) console.log(`ℹ 占用面:${n}`)
    if (!idFace.ok || idFace.undetermined.length > 0) {
      for (const n of idFace.undetermined) console.error(`❌ 占用面判不出:${n}`)
      console.error(
        `❌ 无法算出完整占用面(${mode})⇒ 拒绝落地:宁可报错,也不按"只有台账"的窄面发号。` +
          `归档件里已用过的号,台账看不见。`,
      )
      process.exit(2)
    }
    const baseContent = idFace.text
    // 令牌**在每次尝试里重算**:别人先推进了 HEAD,下一轮算出的空闲号自然跟着变 ——
    // 这正是把取号放进 CAS 的意义(提交前"查一次占用"在高并发仓里不构成证据)。
    const targetLines = replacements ? replacements.map((p) => p.after) : block
    const families = idTokenFamilies(targetLines)
    // 号段基准**也在每次尝试里重算**:HEAD 会动,远端 tip 也会动(origin 常年被后台 worker 推进)。
    // 提到循环外就等于把"远端那一份"烘成一次性读数 —— 镜像测试 N5 用源码锁钉住这一型。
    const remote = families.length ? readRemoteIdBasis({ root, doc, families }) : null
    const tok = resolveIdTokens(targetLines, baseContent, remote, { machineId })
    if (!tok.ok) {
      if (String(tok.reason).startsWith('lease-exhausted-mid-edit:')) {
        console.error(
          `❌ 千段租约段内容量不足(${tok.reason})⇒ 拒绝落地:单次编辑的取号令牌数超过了段容量(1000),` +
            `把登记拆成多块再落`,
        )
        process.exit(2)
      }
      console.error(
        `❌ 令牌取号判不出(${tok.reason})⇒ 拒绝落地:该族在这份 HEAD 底稿里一条登记行都没有,` +
          `给 "<族>-1" 就是把"没查到"写成"这是空闲号"`,
      )
      process.exit(2)
    }
    // 降级必须逐条喊出来(远端这一维没判到 ≠ 已与远端对齐);顺序在基准行之前,便于"见上一行"指代。
    // info 是过程注记(自补救 fetch 成功等),不得混进降级行 —— 把"已读齐"打成"未对齐"是反向假话。
    for (const n of remote?.info ?? []) console.log(`ℹ 号段基准:${n}`)
    for (const n of remote?.notes ?? [])
      console.log(`⚠️ 号段基准未含远端(${n})⇒ 仍按本地 HEAD 底稿落号,**未与远端对齐**`)
    for (const b of tok.basis ?? []) console.log(describeIdBasis(b, remote))
    // 租约读数逐条交出:段内连号还是新占段、段界在哪,报告必须能对上"号为什么是这一个"。
    for (const n of tok.leaseNotes ?? []) console.log(`ℹ ${n}`)
    {
      const gate = idBasisGate({
        families,
        remote,
        allowUnaligned: process.env.IHUI_PLAN_ID_ALLOW_UNALIGNED === '1',
      })
      if (gate.note) console.log(`⚠️ ${gate.note}`)
      if (gate.block) {
        console.error(
          `❌ 本次要取号,但${gate.reason} ⇒ 拒绝落地(自补救 fetch 已跑过一次,那些对象仍不在本地,` +
            `拿不到对面那一份底稿时发号就是猜对面没占过)。\n` +
            '   一手成因(2026-09-29):同一种降级上一版只警告不拒,当天发出的两枚号与远端 09-28 的登记同号' +
            '(其一已完成),并集收敛后当场撞出 2 组 F9,须再让一次号才收得住。\n' +
            '   出路:查网络/凭据后重跑(每次重读都会再自助 fetch 一次);' +
            '确属离线/必须先行则 `IHUI_PLAN_ID_ALLOW_UNALIGNED=1` 重跑,报告会明写"未与远端对齐"。',
        )
        process.exit(1)
      }
    }
    if (tok.assigned) assigned = tok.assigned
    effBlock = tok.assigned && !replacements ? tok.lines : block
    effReplacements =
      tok.assigned && replacements
        ? replacements.map((p, i) => ({ ...p, after: tok.lines[i] }))
        : replacements
    // 幂等判据(G-321①):**拼块之前**在**本轮实际取材的那一面**(`baseLines` = 该次 CAS 从 HEAD 现取,
    // 不读磁盘)现读"锚点之后紧邻 N 行是否已是本块"。锚点命中恰好 1 从来不是"块没在位"的证据 ——
    // 上一轮同一锚点跑了两次就是从这里漏过去的,而同一段落落两份之后锚点命中数**仍然是 1**。
    // 只判插入档的锚点形态:改写档的 `before` 命中 0 已经是"这条已改过"的信号;EOF 档没有锚点可点名
    // (既有断言 N4 还依赖"同一块再跑一次"来证明号被远端抬高)⇒ 两条都写在头注"已知边界"里,不是遗漏。
    if (!effReplacements && anchorLines) {
      const cm = compileBlockMatchers(block, baseContent)
      if (!cm.ok) {
        console.error(
          `❌ 编号形状编译不出(${cm.reason})⇒ 无法证明"本块不在位",不猜、拒绝落地` +
            `(与本器取号共用 usedIdsOfPrefix 那一个出口;退化成"逐字等值再判一次"就是把这一型洗成"未在位")`,
        )
        process.exit(1)
      }
      const chk = blockInPlaceCheck({ baseLines, anchorLines, matchers: cm.matchers })
      if (chk.inPlace) {
        console.log(describeInPlace({ chk, anchorLines, head, families: cm.families }))
        process.exit(0)
      }
    }
    const built = effReplacements
      ? applyReplacements(baseLines, effReplacements)
      : assemble(baseLines, effBlock, anchorLines)
    if (!built.ok) {
      rejectReason = built.reason || '结构等值不成立'
      // not-found / multi-hit 与"内容已漂移后重试"无关的形态也会随 HEAD 移动而变;一律当场拒绝,不重试猜测
      console.error(
        built.reason === 'not-found'
          ? `❌ HEAD 版里找不到锚点(锚点文案已漂 ⇒ 幂等判据也无从判"已在位";块在不在位从来不靠这一句猜)⇒ 不猜,拒绝写盘`
          : String(built.reason || '').startsWith('chain-hit')
            ? `❌ 第 ${String(built.reason).replace('chain-hit#', '').split('<')[0]} 项的 before 等于另一项的 after ⇒ 逐项顺序替换会把前一项刚改出的行再改一遍,而声明里没有这件事,拒绝写盘(${built.reason})`
            : String(built.reason || '').startsWith('replace-not-found')
              ? `❌ 第 ${String(built.reason).replace('replace-not-found#', '')} 项的 before 在 HEAD 版里找不到(该行已被别人改写或本来不逐字等值)⇒ 不猜,拒绝写盘`
            : String(built.reason || '').startsWith('replace-multi-hit')
              ? `❌ 第 ${String(built.reason).replace('replace-multi-hit#', '').replace(/:.*/, '')} 项的 before 命中 ${String(built.reason).split(':').pop()} 次 ⇒ 无法确定改哪一行,交人工`
              : String(built.reason || '').startsWith('untouched-line-drift') ||
                  built.reason === 'line-count-changed'
                ? `❌ 改写动了声明之外的行(或改变了总行数)⇒ 这不是"整行替换",拒绝写盘`
                : String(built.reason || '').startsWith('multi-hit')
                  ? `❌ 锚点在 HEAD 版里命中 ${String(built.reason).slice(10)} 处 ⇒ 不猜,拒绝写盘`
                  : `❌ 新内容不等于"HEAD ⊕ 本块插入/追加"⇒ 拒绝写盘`,
      )
      process.exit(1)
    }
    // 千段租约落账:本块若新占了段,租约行(done 形态,主键=段尾号)必须随本块**同一次提交**进面 ——
    // 分两次提交会在两枚 commit 之间留下"号已实占而段未登记"的窗口。它必须在畸形判据之前并进
    // next,让同一批写前守卫看到的就是将要提交的内容;CAS 失败重试时随底稿整批重算,无残留。
    const nextLines =
      tok.leaseClaims && tok.leaseClaims.length
        ? appendLeaseRows(built.next, tok.leaseClaims.map((c) => buildLeaseRow({ ...c, machineId })))
        : built.next
    nextCount = nextLines.length
    // 畸形登记编号防线(2026-09-28 立;同一行 D128↔DD128 第四次来回逼出)。
    // 为什么必须在**写 blob 之前**而不是落地之后:内容一旦 commit,再 exit 1 就是把"已入库"谎报成
    // "没落地",而"没落地"的唯一反应就是重跑 —— 那正是本器 G-321 花两档退出码要消灭的混淆。
    // 为什么存量只报数:由他人历史留下的畸形号钉红每一次落地,结局是逼人绕开本器改用 pathspec 硬交,
    // 那是拿一个更危险的出口换一个账面好看(§12e 恒红门同一条)。
    {
      const mal = newMalformed(baseContent, nextLines.join('\n'))
      if (mal.added.length > 0) {
        console.error(`❌ 本次要写入的内容里有 ${mal.added.length} 行畸形登记编号(族名在编号段出现两次)⇒ 拒绝落地:`)
        for (const x of mal.added.slice(0, 4)) console.error(`   · ${malformedLine(x)}`)
        console.error(
          `   成因固定:取号令牌 {{NEXT_ID:X}} 展开值**本身已含族名**,正文再手写一个字面 X 就产出 XX123` +
            `(本仓在案另一形态 G-G-334 同源)。改法:删掉正文里那一个字面族名,只留令牌。`,
        )
        process.exit(1)
      }
      if (mal.preexisting.length > 0)
        console.log(
          `ℹ 台账存量畸形编号 ${mal.preexisting.length} 行(父提交里已在 ⇒ 只报数不拦,与本次落地无关;逐条清偿另计批)`,
        )
    }
    // ── G-1079146 登记入口取值(票面「优先做的不是新门,是掐住成因」)──
    // 只吃**本次新增的行**:插入档 = 本块每一行(含令牌展开后的形态);整行改写档 = `after` 相对
    // `before` 多出的那一段。为什么不回扫全文:把存量里本来就带着的旧 sha 再判一次,等于拿别人三周
    // 前落的那行钉红这次的翻勾动作(§12e 恒挡同一条)。为什么在 writeBlob 之前而不是落地之后:
    // 与上面畸形号守卫同一条理由 —— 内容一旦 commit,再 exit 1 就是把"已入库"谎报成"没落地"。
    // 千段租约行**不在射程**:它由 `appendLeaseRows` 生成、不是作者写下的出处指针(机器指纹是 hash
    // 形态,判它就是把工具自己的产物当仓库违规)。
    {
      const entries = effReplacements
        ? effReplacements.map((p) => rewriteEntryOf(p.before, p.after))
        : effBlock.map((l) => ({ text: l, from: 0, to: l.length }))
      const v = judgeNewLineShas(entries, { probe: shaProbe, allow: shaAllow })
      for (const l of shaGateReport(v)) {
        if (l.kind === 'error') console.error(l.text)
        else if (l.kind === 'warn') console.log(l.text)
        else console.log(l.text)
      }
      if (v.blocked.length > 0) process.exit(1)
    }
    const blob = writeBlob(nextLines.join('\n'), { root })
    const { commit } = commitTreeWithIndex({
      root,
      parent: head,
      message: msg,
      entries: [{ path: doc, blob }],
      baseRef: head,
    })
    if (casUpdateRef(commit, head, { root })) {
      landed = commit
      parentSha = head
      console.log(
        `✅ 第 ${attempt} 次 CAS 成功 HEAD=${commit}(${mode}) ${doc} 行数 ${baseCount} → ${nextCount}` +
          (assigned === null ? '' : ` / 令牌取号(由该次 HEAD 底稿现算)=${assigned}`),
      )
      // 同文全改必须点名:命中 1 次与命中 9 次在"总行数不变"这条断言上完全同形,不印出来就等于
      // 让"顺手多改了别人那份"没有证人(与"失效方向必须是多要一次说明"同一条禁令)。
      if (built.multi && built.multi.length)
        console.log(
          `   声明为 all 的项共 ${built.multi.length} 项,逐条命中数:` +
            built.multi.map((m) => `第${m.item}项×${m.count}`).join(' ') +
            `(合计改写 ${built.hits.length} 行)`,
        )
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),重取 HEAD 底稿重试`)
  }
  if (landed === '') {
    const fail = alignOutcome({
      landedSha: '',
      doc,
      detail: `${MAX_CAS_ATTEMPTS} 次均未抢到 CAS${rejectReason ? `(最后一轮拒绝原因:${rejectReason})` : ''}`,
    })
    for (const line of fail.lines) console.error(line)
    process.exit(fail.code)
  }

  // 回读证明:插入档要求"本块每一条非空行都在 HEAD 里";改写档要求"每一条 after 都在、
  // 且每一条 before 都不在了"—— 后半句才是"改成了"的证据,只查前半句等于什么都没判。
  const now = norm(git(['show', `${landed}:${doc}`], { root, raw: true }))
  const missing = effReplacements
    ? effReplacements.filter((p) => !now.includes(p.after)).map((p) => p.after)
    : effBlock.filter((l) => l.trim() !== '' && !now.includes(l))
  if (missing.length > 0) {
    console.error(
      `❌ 回读有 ${missing.length} 行不在 HEAD 里:\n  ${missing.slice(0, 4).join('\n  ')}`,
    )
    process.exit(1)
  }
  if (replacements) {
    // 旧形态必须按**整行等值**归零,而不是按子串归零:改写档有两种形态 —— 翻勾(前缀变了)和
    // 追加注记(原行文字成为新行的前缀)。用 `doc.includes(before)` 判第二种会**误报"没生效"**,
    // 而误报的代价不只是难看:本函数在这句之后才做主索引对齐,判错的 exit 1 会把对齐整段跳过,
    // 于是共享索引停在父提交 blob ⇒ 别人一次不带 pathspec 的普通提交就把这次交付写回旧版(§12d 第三层)。
    const nowLines = now.split('\n')
    const stale = replacements.filter((p) => nowLines.includes(p.before))
    if (stale.length > 0) {
      console.error(`❌ 回读仍有 ${stale.length} 行的旧形态整行在位 ⇒ 改写没有真生效,不记为成功`)
      process.exit(1)
    }
    console.log(
      `✅ 回读:${replacements.length} 行已改成新形态(旧形态整行归零;追加注记型的原文字成为新行前缀,属正当)`,
    )
  } else console.log('✅ 回读:本块每一条非空行都在 HEAD 里')

  /**
   * G-725 留痕:回读已证明"这枚旁路提交带着期望内容进了 HEAD",所以从这一刻起它就是既成事实。
   * 主索引对齐(下一步)成功与否都不改变"它绕过了提交链"这一点 ⇒ 留痕必须写在对齐之前;
   * 写失败只喊一行 WARN,绝不把一次成功落地判红(它记的是账,不是门禁)。
   */
  const attest = recordBypassLanding({
    root,
    source: 'live-doc-edit',
    landedSha: landed,
    headBefore: parentSha,
    declaredFiles: [doc],
    reason: `旁路落地(commit-tree + CAS,${mode})不触发钩子 ⇒ 提交链上的门禁对本枚未执行`,
  })
  if (!attest.ok)
    console.log(
      `⚠️ 跳门留痕未写入(落地已成功 HEAD=${landed.slice(0, 11)},不改退出码):${attest.why}`,
    )
  else console.log(`✅ 跳门留痕 1 行已写入 ${attest.path}(kind=bypass-landing,gatesRun=false)`)

  /**
   * G-816708(2026-10-05):落地的是台账(`LIVE_DOC=PROJECT_PLAN.md`)⇒ **就地补跑一次守门 71 自愈**。
   * 本器每一枚提交都走 `commit-tree` + CAS ⇒ 钩子结构性不跑,挂在 `.husky/post-commit` 第 6 节的
   * 自愈对本器从来不会触发;而本器改的正是登记行(整行改写档把 `- [ ]` 翻成 `- [x] ✅…`),
   * 一次误写就是"已入库的登记行被滞后底稿带回"那一型。判据必须在真跑它的那一刻才成立。
   * 位置与 object-space-land 同形:回读已证明内容入库(不满足就早退了)→ 留痕 → **补跑** → 索引对齐
   * (自愈若建了恢复提交,随后的对齐会把共享索引对齐到恢复后的 blob,而不是把缺行那份写进索引)。
   * 提交档而非报告档 + 为什么不成环:见 `lib/bypass-git.mjs` 的 `rerunLedgerHeal` 头注
   * (这一跑是 post-commit 那节的替身,必须与原件同形;替身自己不跑钩子,且只在 HEAD 真缺行时建提交)。
   * 补跑失败只喊一行(stderr),不改本器退出码。
   */
  rerunLedgerHeal({ root, paths: [doc] })

  const align = alignSharedIndex({ root, paths: [doc], parentRef: parentSha })
  // G-321②:走到这里内容**已经**入库并过了回读 ⇒ 索引没对齐只是副作用,不得冒充整次失败。
  // 退出码与措辞的唯一出口是纯函数 `alignOutcome`(构造面上双向钉:没落地仍判 1)。
  const verdict = alignOutcome({ landedSha: landed, doc, align })
  for (const line of verdict.lines) console.log(line)
  process.exit(verdict.code)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // `--self-test` 是纯函数档(零 git、零写盘)⇒ 必须在 main() 之前分叉,否则会被 readInputs
  // 判成"缺 LIVE_DOC/LIVE_MSG"而 exit 2。既有调用方一律不带 argv(env 驱动)⇒ 行为逐字不变。
  if (process.argv.slice(2).includes('--self-test')) process.exit(selfTest())
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  readInputs,
  locateAnchor,
  assemble,
  applyReplacements,
  resolveIdTokens,
  readRemoteIdBasis,
  idTokenFamilies,
  describeIdBasis,
  idBasisGate,
  remoteTarget,
  REMOTE_ID_TRANSPORT,
  compileBlockMatchers,
  blockInPlaceCheck,
  describeInPlace,
  alignOutcome,
  findMalformedIds,
  newMalformed,
  MALFORMED_ID_RE,
  MALFORMED_BODY_RE,
  // G-1079146 取值档:判据全部从这里出去(镜像测试禁止再抄一份,§22c)。
  judgeNewLineShas,
  shaPassReason,
  rewriteEntryOf,
  parseShaAllow,
  makeShaProber,
  shaGateReport,
  shaProbeCommand,
  SHA_PROBE_TRANSPORT,
  SHA_PROBE_MAX,
}

/**
 * `--self-test`:纯函数档,**零 git、零写盘、零副作用**(判据输入全部构造面给)。
 * 三条硬规矩(本仓同日实测过):① 每条 cond 必须是**已求值布尔** —— 传箭头函数进去会被 `!!cond`
 * 读成恒真,账面"全绿"而一条都没判(守门 150 票㉛ 那一格);② 用例体内不要写"无分号语句后紧跟
 * 裸块"那种形状 —— V8 过而 TS 解析器报 Parsing error,提交链的 lint-staged 会拦死,一律用 IIFE;
 * ③ 正反成对:每条"必红"都得配一条"必须不红"的放过对照,否则判据过宽也一路绿灯。
 */
function selfTest() {
  const got = []
  const ok = (name, cond) => got.push({ name, pass: cond === true, got: cond })
  const probeBy = (table) => (t) => (t in table ? table[t] : { state: 'bad', status: 128 })

  // 1) 目标形态:短 sha 问不到 ⇒ 必须拦住(有牙的正例)
  ok(
    'S1 `提交 \`deadcafe12\`` 问不到 ⇒ blocked',
    (() => {
      const v = judgeNewLineShas([{ text: '登记:提交 `deadcafe12` 那枚' }], {
        probe: probeBy({}),
      })
      return v.blocked.length === 1 && v.blocked[0].token === 'deadcafe12'
    })(),
  )
  // 2) 成对反例:同一行同一形状,可解析 ⇒ 不得拦
  ok(
    'S2 同一形状而 probe=ok ⇒ 不拦,并带回全量 40 位',
    (() => {
      const v = judgeNewLineShas([{ text: '登记:提交 `deadcafe12` 那枚' }], {
        probe: probeBy({ 'deadcafe12': { state: 'ok', sha: '0'.repeat(40) } }),
      })
      return v.blocked.length === 0 && v.resolved.length === 1 && v.resolved[0].sha === '0'.repeat(40)
    })(),
  )
  // 3) 保命分支:git 问不到(无 status)⇒ **放行并报名**,绝不得判红
  ok(
    'S3 probe=undetermined ⇒ 放行 + 逐条点名(把"没判"写成"坏"就是恒挡台账)',
    (() => {
      const v = judgeNewLineShas([{ text: '落地 deadbeef12 那次' }], {
        probe: () => ({ state: 'undetermined', why: '超时' }),
      })
      return v.blocked.length === 0 && v.undetermined.length === 1
    })(),
  )
  // 4) 超上限 ⇒ 放行不判红(病态输入不得变成挡路)
  ok(
    'S4 超出单轮探测上限 ⇒ 放行并报名 overCap,不进 blocked',
    (() => {
      const line = `一串:${Array.from({ length: 60 }, (_, i) => (i + 10 ** 8).toString(16)).join(' ')}`
      const v = judgeNewLineShas([{ text: line }], { probe: probeBy({}), maxProbes: 3 })
      return v.blocked.length === 3 && v.overCap.length > 0
    })(),
  )
  // 5-7) 三条放过:票面实测的三型改写,任何一种都不得误伤(每条各自一条反例)
  for (const [name, text, want] of [
    ['S5 文件名形态 dist/<hex>.chunk.mjs', '产物 apps/web/dist/6f7a8b9c.chunk.mjs 已重建', 'file-name'],
    ['S5b 路径分隔左侧', '见 origin/6f7a8b9c 那一支', 'ref-segment'],
    ['S6 ref/分支连字符非独立 token', '分支 workbuddy/main-6f7a8b9c 已并', 'attached'],
    ['S7 配置/声明表键值位', '设备 serial=d1f8e3a7b9 的读数', 'config-prefix'],
  ])
    ok(
      name,
      (() => {
        const v = judgeNewLineShas([{ text }], { probe: probeBy({}) })
        return v.blocked.length === 0 && v.exempt.length === 1 && v.exempt[0].pass.startsWith(want)
      })(),
    )
  // 8) 票面点名的两型"根本没有候选"的写法:不得炸也不得拦
  ok(
    'S8 dist/273.x.mjs 与 workbuddy/main-x 无 hex 候选 ⇒ 空判定(不回扫、不报错)',
    (() => {
      const v = judgeNewLineShas(
        [{ text: '跑 dist/273.x.mjs 与 workbuddy/main-x 两条' }],
        { probe: probeBy({}) },
      )
      return v.blocked.length === 0 && v.probed === 0
    })(),
  )
  // 9) 全数字同形(日期 / CI run id / adb 号)由权威门的形状档摘掉 ⇒ 不判
  ok(
    'S9 全数字 20260926 ⇒ 权威门判 ambiguous ⇒ 不探不问',
    (() => {
      const v = judgeNewLineShas([{ text: '窗口 20260926 的读数' }], { probe: probeBy({}) })
      return v.probed === 0 && v.blocked.length === 0
    })(),
  )
  // 10) 40 位全量按同一判据问(票面要求第 4 条):问不到同样拒
  ok(
    'S10 全量 40 位走同一判据 ⇒ 问不到即 blocked',
    (() => {
      const tok = 'f'.repeat(40)
      const v = judgeNewLineShas([{ text: `复现:\`${tok}\`` }], { probe: probeBy({}) })
      return v.blocked.length === 1 && v.blocked[0].token === tok
    })(),
  )
  // 11) 整行改写档只吃多出的部分:存量 sha 随翻勾携带过来 ⇒ 不得重判(否则结清动作被历史钉红)
  ok(
    'S11 rewriteEntryOf:before 里已有的 token 记携带不判,before 里没有的才判',
    (() => {
      const before = '- [ ] G-1 落地 aaaa1111 待办'
      const after = '- [x] G-1 落地 aaaa1111 已完成(补 bbbb2222)'
      const v = judgeNewLineShas([rewriteEntryOf(before, after)], { probe: probeBy({}) })
      const both = judgeNewLineShas([{ text: after }], { probe: probeBy({}) })
      return (
        v.blocked.length === 1 &&
        v.blocked[0].token === 'bbbb2222' &&
        v.carriedOver.length === 1 &&
        v.carriedOver[0].token === 'aaaa1111' &&
        both.blocked.length === 2 &&
        shaGateReport(v)
          .map((l) => l.text)
          .join('\n')
          .includes('携带存量')
      )
    })(),
  )
  // 12) 应急出口:无原因不放行,带原因才放行且留痕(两臂同一条判据)
  ok(
    'S12 LIVE_SHA_ALLOW 无原因 ⇒ 不收录照旧拦;带原因 ⇒ 放行且打印',
    (() => {
      const bare = judgeNewLineShas([{ text: '落地 deadbeef12 那次' }], {
        probe: probeBy({}),
        allow: parseShaAllow('deadbeef12'),
      })
      const withWhy = judgeNewLineShas([{ text: '落地 deadbeef12 那次' }], {
        probe: probeBy({}),
        allow: parseShaAllow('deadbeef12=外部仓 revision,非本机 commit'),
      })
      const rep = shaGateReport(withWhy)
      return (
        bare.blocked.length === 1 &&
        withWhy.blocked.length === 0 &&
        withWhy.allowed.length === 1 &&
        rep.some((l) => l.text.includes('取值放行留痕') && l.text.includes('外部仓 revision'))
      )
    })(),
  )
  // 13) 报告里给出去的判据命令必须就是真跑的那条(出路不得跑不通)
  ok(
    'S13 拒绝文案给出 token/形状/判据命令/建议,且命令与 args 同形',
    (() => {
      const v = judgeNewLineShas([{ text: '提交 `deadcafe12`' }], { probe: probeBy({}) })
      const txt = shaGateReport(v)
        .map((l) => l.text)
        .join('\n')
      return (
        v.blocked[0].cmd === shaProbeCommand('deadcafe12') &&
        txt.includes('deadcafe12') &&
        txt.includes('git rev-parse --verify deadcafe12^{commit}') &&
        txt.includes('建议') &&
        txt.includes('禁止') &&
        txt.includes('全量 40 位')
      )
    })(),
  )
  // 14) 生产探测器的三态(注入 transport,不打真 git)
  ok(
    'S14 prober:rc0⇒ok / rc128⇒bad / 抛错无 status⇒undetermined / 同 token 只问一次',
    (() => {
      let n = 0
      const mk = (t) =>
        makeShaProber({
          root: 'x',
          transport: {
            ask: (args) => {
              n += 1
              if (args[2] === 'HEAD') return 'h'
              if (t === 'ok') return '0'.repeat(40)
              if (t === 'bad') {
                const e = new Error('Needed a single revision')
                e.status = 128
                throw e
              }
              if (t === 'one') {
                const e = new Error('usage')
                e.status = 1
                throw e
              }
              throw new Error('ENOENT')
            },
          },
        })
      const a = mk('ok')
      const b = mk('bad')
      const c = mk('crash')
      const d = mk('one')
      const p = a('deadbeef12')
      a('deadbeef12')
      return (
        p.state === 'ok' &&
        // 2 = 1 次 pre-flight + 1 次该 token 探测;同 token 第二次命中缓存(不得重复问 git)
        n === 2 &&
        b('deadbeef12').state === 'bad' &&
        b('deadbeef12').status === 128 &&
        d('deadbeef12').state === 'bad' &&
        c('deadbeef12').state === 'undetermined'
      )
    })(),
  )
  // 15) pre-flight 不过 ⇒ 整档未判定(不得把"仓库问不到"折叠成"每枚都是坏")
  ok(
    'S15 pre-flight 失败 ⇒ 该 token 落 undetermined 并放行,不是 bad',
    (() => {
      const pr = makeShaProber({
        root: 'x',
        transport: {
          ask: () => {
            throw new Error('not a git repository')
          },
        },
      })
      const v = judgeNewLineShas([{ text: '提交 `deadcafe12`' }], { probe: pr })
      return v.blocked.length === 0 && v.undetermined.length === 1 && pr('deadcafe12').state === 'undetermined'
    })(),
  )
  // 16) 空/无候选的常规落地:一行话都不必多打(每次台账落地都不该被这一步刷屏)
  ok(
    'S16 没有 sha 形态的块 ⇒ 零探测、零输出、不改既有行为',
    (() => {
      const v = judgeNewLineShas([{ text: '- [ ] 新增一条普通登记,不含指针' }], {
        probe: () => ({ state: 'bad' }),
      })
      return v.probed === 0 && v.blocked.length === 0 && shaGateReport(v).length === 0
    })(),
  )
  // 17) 形状档只认权威门:门那一份把 32 位判成 ambiguous ⇒ 本器不得自己判成候选
  ok(
    'S17 32 位 hex ⇒ 权威门 ambiguous ⇒ 本器不探(不抄第二条形状判据)',
    (() => {
      const v = judgeNewLineShas(
        [{ text: '摘要 97fef424f841ab997b161bc4ead93cbe' }],
        { probe: () => ({ state: 'bad', status: 128 }) },
      )
      return v.probed === 0 && classifyShape('97fef424f841ab997b161bc4ead93cbe').kind === 'ambiguous'
    })(),
  )
  let fail = 0
  for (const g of got) {
    if (g.pass) console.log(`  ✅ ${g.name}`)
    else {
      fail += 1
      console.log(`  ❌ ${g.name}(实得:${String(g.got)})`)
    }
  }
  console.log(`自检 ${got.length - fail}/${got.length} 通过 · 失败 ${fail} · 零 git 零写盘`)
  return fail === 0 ? 0 : 1
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
