#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PROJECT_PLAN.md 登记行防丢守门(2026-09-22 立,guardian-runner 第 71 项,blocking)
 *
 * 根因(同日实测两次):共享工作区里并发会话按"自己内存里那份旧计划文档"整文件提交,
 * 把别的会话**已经入库**的登记行按旧基线回写掉 —— 一小时内 10 条 G-152/G-166/D107b
 * 进度行被抹两次(第一次我自己也是肇事者,见项目记忆 safe-commit-index-race 第 22 条)。
 * 既有 13c `check-project-plan-archive.mjs` 只守"### XXX(已完成 ✅) 任务条目"这一种行,
 * 进度登记是条目内的 bullet,完全不在它视野内 → 补这一道。
 *
 * 判据(按**标记**而非整行,避免正常改写文案被误判):
 *   1. 基线 = HEAD:PROJECT_PLAN.md 里的"登记行",三种形态:
 *      a) bullet 行含 `**G-<数字>` / `**D<数字>` / `**O<数字>` / `**P<数字>` / `**W<数字>` /
 *         `**守门 NN` / `**第N步` 这类加粗编号 —— 标记取加粗头原文前缀(≤18 字);
 *      b) **复选任务行** `- [ ] O13b 第二段…`(编号紧跟复选框,无加粗)—— 2026-09-23 实测
 *         本会话一枚 `e8d668ad77` 就是把别人的 `- [ ] O13b …`、`- [ ] **Esc 无层栈协议**…`
 *         两族任务行整行抹掉,而只认加粗的门当时报"无缺失";
 *      c) **批次标题行** `### 第十四批(…):…`(标题以中文序号开头)。
 *      且长度 ≥ 40(短行多为小标题,不算登记行)。
 *   2. 取该行的**编号标记**(如 `G-166 第⑤步`),若在待提交内容里完全找不到 → 判丢失。
 *      b/c 两族的标记 = 编号 + 紧随的短标题(遇括号/冒号/星号即停,≤18 字),不吞整段正文 ——
 *      这些行的括注与计数常被正当改写(追加 ⑤、改条数),吞进标记会稳定产假阳;
 *      而只取编号又会撞车(`O14` 在 `O14b2` 那行里也在、`D13` 在别人的引用里也在),
 *      删掉整行仍报不出。编号本身不足 3 字的(`P0`/`D6` 这类两处必撞的短串)直接放过。
 *      ⚠️ b/c 两族**只认"行首编号"这一路判活**(候选里必须仍有某一行登记行以该编号开头),
 *      不再退回全文文本搜索:实测 `O13b 第二段` 这一族的标题被另一条进度行**原样引用**
 *      (`- **进度(2026-09-23 ⑤)**:… O13b 第二段 ①②③⑤ 已落 …`),任务行整行被抹掉后全文
 *      照样搜得到 → 旧判据报"无缺失"、自愈也回捞不到(2026-09-23 注入实锤的残余面)。
 *      刻意**不把这个收紧套到既有 a) 加粗 bullet**(现 214 条):一并改判会把
 *      "把编号挪到句中重写"这类正当编辑判成丢失,误伤面不可估。
 *   2b. **条目标题(`^#{2,3} O<数字>…`)必须仍以"标题形态"判活,不得只认行首编号**
 *      (2026-09-24 补,封 `## O42` 事故残留盲区):标题族虽已进基线,判活却走"该编号还有没有
 *      任何一行登记行以它开头" —— 而同一节里那条加粗 bullet `- **O42 残余…**` 的行首编号
 *      也是 `O42`,于是**删掉整节标题后门照报"无缺失"**(实测真仓 HEAD 抽掉 `## O42` 那一行:
 *      旧判据 0 报)。标题是一个任务在计划里唯一的可寻址入口,丢标题 = 把别人一整节的层级连根
 *      拔掉,比丢一条进度行更严重,故标题族的判活面收窄到"候选里仍有一行**标题**以该编号开头"。
 *      取舍见 `headingIdSet` 与 `selfTest` 里"只删标题、正文还留着"那一条。
 *   3. 允许两种正当情形:
 *      a) 该登记行原文可在 `.ihui-agent/archive/PROJECT_PLAN_*.md` 里找到(§1 归档流程),
 *         且那份副本**在本面里存在**(全量 = HEAD 树、`--staged` = 索引)—— 只躺在本机磁盘上、
 *         从未进任何提交的归档文件不构成删行凭据(2026-09-25 G-183 补,详见 `archivedCopy` 头注);
 *      b) 本次提交同时改动了基线里没有该行的位置(即该行本就不是 HEAD 内容) —— 由
 *         "只从 HEAD 取基线"天然保证。
 *      c) **翻勾后整行删除**(2026-10-18 补,把 447-451 行那条"已勾行不进保护集"落到历史基线):
 *         历史基线按 marker 走一遍**配平**状态机(时间正序):一条开放行的减少,只有同枚提交里
 *         closed 计数相应增加才算"被翻勾了";减了却没配上 ⇒ 记一笔无凭据的减少。判定 =
 *         最新一仍开放 ⇒ 保护(与改前逐字同形) ‖ 无凭据减少 > 翻勾次数 ⇒ 仍保护 ‖ 否则 ⇒ 勾销,
 *         不再回捞。此前历史基线只看开放形态(`markerOf` 对 `[x]` 返回 null),于是"先翻勾、再删行"
 *         这一串必然被读成丢失,自愈层把行以**未勾形态**原样还原(本机 2026-10-18 实测的 D117
 *         那一枚:恢复提交 04e8efe128e),而存档退役后 a) 那条例出通道已无承接件 ⇒ 两令互咬。
 *         ⚠️ 刻意不用"最新形态是不是已勾"这一条粗判:同编号里既有开放行又有已勾行时,它会因为
 *         开放行被吞掉而把整族永久摘出保护集(镜像测试第三条臂实测抓出)—— 那正是本门立项防的事故型。
 *   4. **编号形态维(G-722 接入提交链)**:登记行出现"族名在编号段重复"的畸形号(两形态同视)——
 *      `--staged` / `--worktree` 拿 HEAD 当基准,只判**本次新增**即红;全量档锚点 = 该文件 HEAD
 *      自身存量 ⇒ **只报数不判红**(§12e:与任何提交都无关的红只会逼人 --no-verify 并连带废掉全部守门)。
 *      判据的唯一实现住在 `scripts/lib/plan-task-index.mjs`(`MALFORMED_ID_RE` / `MALFORMED_BODY_RE` /
 *      `findMalformedIds` / `newMalformed`),门内**禁止再抄一份形态正则**(镜像测试有形状锁)。
 *      ⚠️ 2026-09-29 改址:这句话此前写的是"住在 `scripts/live-doc-edit.mjs`",而生产侧与门内**各留了一份**
 *      实现 —— 两份"什么算畸形"必然漂开,漂开的两个方向账面都是绿的;现收口成 lib 那一份,生产侧与门内
 *      都只 import 它。顺带断掉一条循环依赖(门→live-doc-edit→lib→门,模块实例化期读自己的导出 ⇒ TDZ)。
 *      立因:该判据过去只在"经过本器落地"时生效,而 `git add + git commit` / safe-commit 按 pathspec
 *      那条路径上没有任何一道门看编号形态 —— 实测 2026-09-29 一小时内同一批 27 行畸形号被并发旧底稿带回两遍。
 *
 * 用法:
 *   node scripts/check-plan-line-loss.mjs --staged    # pre-commit:审**索引 blob**(提交链真正带走的那份)
 *   node scripts/check-plan-line-loss.mjs             # 手动/审计:审 **HEAD blob**(工作树完全不进判据)
 *   node scripts/check-plan-line-loss.mjs --worktree  # 人工逃生舱:只有带这面旗才按磁盘副本判
 *   node scripts/check-plan-line-loss.mjs --self-test
 * 退出码:0 通过 / 1 检出丢失 / 2 用法错(两面旗同给)或被审面取不到(**无法判定**)
 * 紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1 git commit ...(会把丢失写进历史,先确认为何丢)
 *
 * ── 全量档为什么不得读工作树(2026-09-26 收口,与守门 77/83/94/98/103/118/36/124 同一口径)──────
 * 本仓是多会话共享工作区,`PROJECT_PLAN.md` 的工作树副本**常年滞后/分叉于 HEAD**(AGENTS §12 与
 * 守门 84「一条本门看不见的时间窗」那格都记过同型事实)。旧实现在全量档把"待提交内容"取成磁盘副本,
 * 于是它回答的是一个没人问过的问题 ——「我的工作树比 HEAD 少了哪几行登记」,后果有两个:
 *   ① 门在**与任何提交都无关**的状态上报红(缺的是别人那份在飞的副本,HEAD 里那行明明还在);
 *   ② 它给的出路是"从 HEAD 逐行取回后再提交",照做就是把别人未提交的工作树内容整批覆盖掉(§12 禁止动作)。
 * 恒红门的唯一实际结局是逼人 `--no-verify`,一次绕过等于全部 150+ 道守门对该提交作废(§12e 同型)。
 * 现行三面判据:`--staged` = 索引 vs HEAD(语义一字未动) · 缺省 = **HEAD blob** 对**最近历史里出现过的
 * 登记行**(基线换成 `historyMarkers()`,与 `--heal` 共用同一把尺子 `missingFrom`) · `--worktree` = 人工。
 * 归档豁免(§1 归档 = 正当移除)**跟着被审面**判,不新开磁盘读法(G-183 那条纪律在新面上继续成立:
 * 只躺在本机磁盘、从未入库的归档副本不构成删行凭据)。
 * `--heal` 一层**刻意不收口**:自愈的职责就是看得见工作树,故它继续"工作区与 HEAD 分别判缺失";
 * G-816708(2026-10-05)又把**共享主索引**补成第三个目标面:旁路落地(`commit-tree` + `update-index`)
 * 动的是 HEAD 与索引**两个面同时**,只判前两档时"下一次提交真要带走的那一份"从来不在射程内
 * (那正是"自愈日志写着无缺失、全量档却点名已入库的红"的另一半成因)。三档结论仍**分开**说清
 * —— 同一把尺子 `missingFrom` 喂三个目标面(实现收在 `healLegs`,调用方不得再抄第二份判据),
 * 而"无缺失,无需回捞"这句只有**三档全绿**才准打印;索引面取不到时那一档写"未判定",绝不并进绿档。
 * ⚠️ 本次补的是**比较目标**,不是判据宽严:纯文本搜索那一残余面(`resolveRegistrationLoss` 的 a) 族)
 * 一字未动 —— 把判据放宽/收紧都不解决"判据没在真跑它的那一刻成立",而那属于"为消红削判据"。
 */
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { catBatch, FACE_LABEL, gitBinary, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
// 旁路落地通道(commit-tree + CAS)**结构上不跑钩子** ⇒ 必须留痕,写口只有一份:
// `lib/bypass-git.mjs` 的 `attestBypassCommit`(2026-10-11 立)。此前本器的 `--heal --commit`
// 落的恢复型提交在留痕台账里一行都没有(现读 `plan-bypass-ledger-report.mjs --since 2026-10-09`
// 的 18 枚"本机可疑"里 10 枚是本器产物),总量统计只能把它们留在 unknown ——
// 那与"有人 --no-verify 塞了一枚红"在两行文本上完全同形,而两者该做的处置相反。
import { attestBypassCommit } from './lib/bypass-git.mjs'
// 取证夹具唯一落点(§26:既不得往 os.tmpdir() 写,也不得落在仓库树内)
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// G-307(看守侧):归并器合法翻勾会在行上留注记 —— legacy 形态把注记**前置**在正文之前,
// 于是"剥掉复选框与状态装饰后编号落在正文开头"这一判活路径看不见被翻勾的那一行,
// 防丢层把合法改写读成"整行消失"⇒ 回捞未勾原行 ⇒ F1 再红 ⇒ 再翻勾……(两小时 24 枚恢复型提交)。
// 剥注记的实现与生产者共用一份(scripts/lib/plan-merge-annotation.mjs,§22c 同一条纪律)。
import { stripForkPrefix } from './lib/plan-merge-annotation.mjs'
// 摘除台账单源(与 auto-commit 复洁器同一份解析):整行已被声明摘除的行,本门不得判丢、不得回捞。
// 否则"删副本 → 门 71 判丢 → 自动回捞 → 再删"永不收敛(2026-10-22 实测 G-56 回捞提交 ec4171d119)。
import { declaredRows, titleFpOf } from './scrub-declared-removals.mjs'
// G-722:编号形态判据(畸形号 = 族名在编号段出现两次)的**唯一实现**住在活文档编辑器里 ——
// 判据住在 `scripts/lib/plan-task-index.mjs` 的下沉方案因该文件正被并发会话在飞编辑而未采,
// 按票面指定的 import 方案接。两处各抄一遍形态正则必然漂移(§22c 同一条纪律),镜像形状锁钉死。
import {
  findMalformedIds,
  newMalformed,
  malformedLine,
  MALFORMED_ID_RE,
} from './lib/plan-task-index.mjs'

const GIT_TIMEOUT = 60000
/**
 * 2026-10-08 gitRaw 型 B 批:`const GIT = process.env.IHUI_GIT_BIN || 'git'` ⇒ 兜底改走取材层
 * `gitBinary()`(恒等 `resolveGitBin() || 'git'` —— 同一兜底链的绝对路径优先,正是型 B 要治的
 * "服务账户/GUI 宿主下 PATH 不通")。`IHUI_GIT_BIN` 逃生舱**优先级与语义一字未动**(仍居首),
 * 本文件由此脱离型 B 判据(scripts/tests/face-reader.test.mjs 的 PATH_BOUND_GIT_BASELINE)。
 */
const GIT = process.env.IHUI_GIT_BIN || gitBinary()
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = 'PROJECT_PLAN.md'
const MIN_LEN = 40

/**
 * 统一 git 派生(2026-10-08 迁取材层 gitRaw)。行为面**逐字不变**:-c safe.directory=* 同;
 * cwd 参数与层 `-C <root>` 同面(层另带 core.quotepath=false,对本文件全命令——rev-parse /
 * rev-list / show / hash-object,无路径输出——无涉);stdio 旧 'ignore' 态 = 层无 input 态
 * `['ignore','pipe','pipe']`;encoding utf8 / windowsHide 同;maxBuffer 旧 256MB 显式保留
 * (层默认 64MB,由 opts 抬升);timeout 旧无 ⇒ 取本文件既有的 `GIT_TIMEOUT`(60s,与文件内
 * 其余 gitRaw 调用同档,且各命令均为亚秒级)。返回值同面(未 trim 的 stdout,调用方自行 trim)。
 * 失败语义:Node 的 `Command failed:` ⇒ 层 `Undetermined`(仍带 .status),本文件各调用方
 * 一律 catch 住派生失败并按"无法判定"处置,不 parse 异常文本。
 */
const git = (args, cwd = ROOT) =>
  gitRaw(args, cwd, { timeout: GIT_TIMEOUT, maxBuffer: 256 * 1024 * 1024 })

/**
 * 新两族(裸编号复选任务行 / 批次标题行)的标记 = **编号 + 紧随的短标题**:
 * 遇 `*` `（` `(` `：` `:` 即停,不足 6 字则续到下一个分隔符,上限 18 字。
 * 只取编号本身不够 —— 注入验证实测:`O14`、`D13` 在两处任务行的正文里都能撞见
 * (`O14b2`、"见 D13" 这类),把整行删掉仍报"无丢失",判据空转。
 */
function titleMarker(rest) {
  const stops = []
  for (const m of rest.matchAll(/[*（(：:]/g)) stops.push(m.index)
  let end = stops.length ? stops[0] : rest.length
  if (end < 6) end = stops.find((s) => s >= 6) ?? rest.length
  return rest.slice(0, Math.min(end, 18)).trim()
}

/**
 * 登记行编号族。字母编号形态:G-166 / D107b / O13b2 / P2-F.10 / W18 / B15
 * (字母后缀与点号都要容得下);外加 `守门 NN` 一族 —— 各道闸门在计划里的登记行用的就是这个
 * 前缀(如 `**守门 72 \`scripts/check-dockerfile-copy-paths.mjs\`(sha …)**`),2026-09-23 实测
 * 有一枚并发暂存版本正整块删掉别人的守门登记,只认 G/D/P/W 会完全看不见。
 * `O\d+` / `B\d+` 两族同日补:计划里 O13b/O14b2/O19b/O20c、B15 这类任务行写成
 * `- [ ] O13b …` 裸编号,加粗正则看不见 —— 本会话 `e8d668ad77` 抹掉的第一条正是它。
 * `V3-\d+[a-z]?` 一族 2026-09-26 补:对话流对标线的登记号是 `V3-47a/47b/47c`(一枚提交一条),
 * 它不属于 G/D/O/P/W/B 任何一形,所以当有一枚并行暂存版本的 PROJECT_PLAN 缺这几行时,
 * 本门与 post-commit 自愈**双双看不见** —— 实测本会话落地 47b/c 后,共享索引里那三份副本
 * 只含 47a 一行。判据不能靠"这族恰好是别人写过的形态",族漏了就等于没门。
 * 〔同日按同一条教训复量全表(2026-10-19,`.ihui-agent/tmp/rn-miniapp-zero/unseen-ids.mjs` 现读
 * HEAD 面 345 条未勾登记行):声明位有号而**整族表认不出**的仍有 4 行 ——
 * `A36`(L4453)/ `WP-7`(L4968)/ `H2`(L29125)/ `A4+A10`(L29228)。A 族、H 族、WP 族根本不在表里,
 * 而 `WP-7` 还多带一个横杠(表内 `W\d+` 既认不出 WP 也容不下横杠)。这 4 行今天对防丢面、
 * 复合主键与派单口径**三重隐身**:合并吞掉它们无人报,同题副本/撞号也判不到它们。
 * 补 `A\d+` / `H\d+` / `WP-?\d+` 三族,并把 D 族写成 `D-?\d+`(HEAD 面现读带横杠的 D 声明位 0 行,
 * 所以这一改不减任何存量,只是让台账里已经出现过的"让号注记 D-128/D-172"那种形态下次真挂在声明位时
 * 不再隐身)。**没有改成"任意字母+数字"**:`T1`/`e5`/`ISO8601`/`P2P` 这类正文噪声会被当成编号,
 * 那把"防丢"换成"什么都防"——族要按现读证据逐条加,而不是靠放宽通用式一次到位。
 */
const ID = String.raw`G-\d+[a-z]?|D-?\d+[a-z]?|O\d+[a-z]*\d*|B\d+[a-z]?|P\d+(?:-[A-Za-z]+)?(?:\.\d+)?|W\d+|WP-?\d+[a-z]?|A\d+[a-z]?|H\d+[a-z]?|守门\s*\d+[a-z]?|V3-\d+[a-z]?`
/**
 * 单一真相源出口(2026-09-26):`scripts/lib/plan-task-index.mjs` 按编号收敛任务状态时
 * 必须用**同一族**编号 —— 两处各写一遍必然漂移,而漂移的形态是"一边判孪生、一边判真丢失"
 * (AGENTS §12 与守门 118 记过同型)。此处导出,那边只在其上做"是否为主键位置"的收窄。
 */
export const TASK_ID_PATTERN = ID
const ID_RE = new RegExp(`(${ID})`)
/** 复选框与其后多层状态装饰(`（进行中）` / `✅(日期)`)一起剥掉,露出真正的内容开头 */
function checkboxBody(line) {
  let body = line.replace(/^\s*[-*]\s\[[ xX]\]\s*/, '')
  if (body === line) return null
  for (;;) {
    const deco = body.match(/^(?:[✅⏳☑✔✓🕐⚠]?\s*[（(][^）)]*[）)]\s*)+/)
    if (!deco || !deco[0]) break
    body = body.slice(deco[0].length)
  }
  // G-307(看守侧修法 b):归并器 legacy 前置注记只在这里被剥掉 —— 剥完仍要求**编号在正文开头**,
  // 所以"整段登记被删、只在别处留一句 `**[归并]** …` 引用"依旧不成立(那句引用的"正文"里没有
  // 行首编号,headIdOf 照旧给 null)。识别的是生产者那一句固定形状,不是"任意带注记的行"。
  return stripForkPrefix(body)
}

/**
 * 行首编号(登记行的"身份"):复选任务行裸编号、批次标题行序号,以及加粗头紧跟编号的行。
 * 用途见 `registrationOf` 的注释 —— 单靠"标记字符串还在不在全文里"判丢失会被引用句骗过。
 */
export function headIdOf(line) {
  const cb = checkboxBody(line)
  if (cb !== null) {
    const m = cb.match(ID_RE)
    if (m && m.index === 0 && m[1].length >= 3) return m[1]
    return null
  }
  // 任务标题行也受保护(2026-09-23 实测补):并发会话按旧基线整文件回写,把
  // `## O28 门 53 白名单按新判据重算收紧…` 这一**标题**连同它下一条预警 bullet 一起写没了,
  // 而当时标题族只认"第N批" ⇒ 390 条扫描照报"无缺失"。标题是一个任务在计划里唯一的可寻址
  // 入口,丢了比丢一条进度行更隐蔽(正文条目还在,却挂在别人的章节下)。
  const h = line.match(new RegExp(String.raw`^#{2,4}\s*(第[0-9一二三四五六七八九十百①-⑳]+批|${ID})`))
  if (h && h[1].length >= 3) return h[1]
  const b = line.match(/^\s*[-*]\s(?:✅\s*(?:\([^)]*\)\s*)?|⏳\s*(?:\([^)]*\)\s*)?)?\*\*([^\s*]+)/)
  if (b) {
    const m = b[1].match(ID_RE)
    if (m && m.index === 0 && m[1].length >= 3) return m[1]
  }
  return null
}

/**
 * **族表自检**(2026-10-19 立):登记行的声明位长得像编号,却不认识本表任何一族(或被行首长度门槛
 * 挡在外面)⇒ 这些行对防丢面、复合主键与撞号判据**三重隐身**。
 *
 * 立因是现读证据,不是假想:`TASK_ID_PATTERN` 的 A 族 / WP 族 / H 族从未登记过,而 HEAD 面真有
 * 4 行这样登记(`A36`、`WP-7`、`H2`、`A4+A10`);其中 `A4+A10` 那组正因为隐身,同一件事被记了
 * **两行**而 F9 撞号看不见 —— 本门补上 A 族当天即由 plan-tasks 报出该撞号组,双行现读逐字对照后
 * 按 §1「一个编号只能有一行当前状态」归并(副本翻勾→摘行)。
 * V3 族那一格的教训写在 ID 旁:**族漏了就等于没门**,而"没门"的账面表现永远是安静 ——
 * 所以这一维不靠人来想起来跑一次,它挂在门自己的输出上。
 *
 * 定级:只报数、不判红、不进退出码。新家族随时会出现,当场判红就是一台与本次提交内容无关的
 * 恒红门(§12e);但它必须大声到无法被忽略(逐条点名行号 + 声明位前 24 字)。
 *
 * @param {string} src 被审面正文
 * @returns {Array<{line:number, token:string, head:string}>}
 */
export function unseenRegistrantIds(src) {
  const collected = [] // 族表认不出的声明位收集口:只报数,永不进退出码(定级理由见上方头注)
  const lines = String(src ?? '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (headIdOf(line)) continue // 认得出的不是缺陷
    const cb = checkboxBody(line)
    if (cb === null) continue // 不是登记行
    // 分隔符位**只写 ASCII 连字符**:全角那一形态的定义住在共享判据里,门体内再抄一份分隔符形态
    // 正是镜像形状锁(`门体内不得再抄第二份形态正则`)要拦的事(它连注释里的字面量一起拦 ——
    // 一把会读到自己说明文字的尺子,拦得住抄写、也拦得住我在此处解释它)。真出现全角形态的号,
    // 该改的是族表本身(单一来源),不是让这把尺子自带第二条路。
    const m = /^([A-Za-z]{1,5})-?(\d+[a-z]?)(?![\w-])/.exec(cb)
    if (!m) continue // 声明位不是"字母族+数字"形态
    // **刻意跟着 headIdOf 的 >=3 长度门槛走**:两字符形态在本账里与优先级标签 `P1 残余③` /
    // `P2 新登记` 无法区分(HEAD 面现读:不加这道门槛时 12 条点名里 11 条是 P1 优先级标签,
    // 只有 1 条是真族表缺族 —— 一把九成是噪音的尺子等于没有尺子)。代价如实登记:
    // `H2` / `A4` 这类两字符短号仍对这一维隐身,它们能被发现只因为 plan-tasks 的主键/撞号提取
    // 不受这个门槛约束(A4 那双行就是这样被 F9 抓出来的)。
    if (m[1].length + m[2].length < 3) continue
    // 畸形号(族名重复前缀那一族)已有自己的编号形态维判它(必红档),本维不重复报 ——
        // 同一行被两把尺子点名,读数谁也不认谁,那就等于没有读数。
    if (MALFORMED_ID_RE.test(line)) continue
    collected.push({ line: i + 1, token: `${m[1]}${m[2]}`, head: cb.slice(0, 24) })
  }
  return collected
}

/** 一份文档里"仍作为登记行行首存在"的编号集合 */
export function headIdSet(src) {
  const out = new Set()
  for (const line of src.split(/\r?\n/)) {
    const id = headIdOf(line)
    if (id) out.add(id)
  }
  return out
}

/**
 * 一份文档里"仍作为**标题行行首**存在"的编号集合(2026-09-24 补)。
 * 与 `headIdSet` 唯一的差别是只看 `^#{2,4}` 形态的行 —— 标题族判活用它,不再共用大集合。
 * 为什么必须另开一路:`## O42 …` 这一节里跟着的 `- **O42 残余…**` bullet 行首编号同样是
 * `O42`,共用 headIdSet 时"删标题留正文"照样判活,而计划文档里**每个任务条目几乎都自带
 * 一条同编号 bullet**,等于标题族整族不受保护(真仓实测:抽掉 `## O42` 行 → 0 报)。
 * 这里刻意不加 MIN_LEN 门槛:把 60 字标题正当改写成 30 字仍是合法编辑,不该判丢。
 */
export function headingIdSet(src) {
  const out = new Set()
  for (const line of src.split(/\r?\n/)) {
    if (!/^#{2,4}\s/.test(line)) continue
    const id = headIdOf(line)
    if (id) out.add(id)
  }
  return out
}

/**
 * 一条登记行的完整身份:marker = 用于"整行是否还在"的文本标记;id = 用于"这个编号还有没有
 * 任何一行登记行以它开头"的行首编号(只有新两族与加粗紧跟编号的行才有)。
 * 为什么要 id 这一路:`O13b 第二段` 这一族的标题被另一条进度行**原样引用**
 * (`- **进度(2026-09-23 ⑤)**:… O13b 第二段 ①②③⑤ 已落 …`),于是任务行整行被抹掉后,
 * 纯文本搜索仍命中 → 门报"无缺失"、自愈也回捞不到(2026-09-23 注入实锤的残余面)。
 * 只对"行首编号"这一路收紧,不动既有 214 条加粗 bullet 的判据语义,避免连带误伤。
 */
export function registrationOf(line) {
  return registrationCore(line, false)
}

/**
 * **已勾形态**的登记行身份(2026-10-18 立,只给 `historyMarkers` 判"marker 的最新形态"用)。
 * 与 `registrationOf` 共用同一具身体(`registrationCore`),差别只在放行 `- [x]` 那一行 ——
 * §22c 禁止在这里抄第二份 marker 算式:两份"什么算同一件事"必然漂开,而漂开的方向是
 * "已勾形态认不出来 ⇒ 继续从更深历史捞未勾副本 ⇒ 完成即删每删一行被还原一次"(本机 2026-10-18
 * 实测的 D117 那一枚即此型)。
 * @returns {{marker:string,id:string|null,shape:string}|null} 非 `- [x]` 形态一律 null
 */
export function closedRegistrationOf(line) {
  if (!/^\s*[-*]\s\[[xX]\]/.test(line)) return null
  return registrationCore(line, true)
}

function registrationCore(line, allowChecked) {
  const marker = markerOf(line, allowChecked)
  if (!marker) return null
  // ⚠️ 只有"新两族"才走行首编号判活。既有 214 条加粗 bullet(`- **G-166 第⑤步…**`)保持
  // 原文前缀文本搜索的旧语义 —— 一并收紧会把"把编号挪到句中重写"这类正当编辑判成丢失,
  // 误伤面不可估(本轮刻意按住)。
  const shape = /^\s*[-*]\s\[[ xX]\]/.test(line)
    ? 'checkbox'
    : /^#{2,4}\s/.test(line)
      ? 'heading'
      : 'bold'
  const id = shape === 'bold' ? null : headIdOf(line)
  return { marker, id, shape }
}

/**
 * 该登记行在候选内容里还算不算"存活" —— 单条判活,是 `resolveRegistrationLoss` 在
 * "只喂它自己"时的**投影**(刻意不留第二份实现:两处算同一件事必漂移)。
 * ⚠️ 有行首编号的条目**只认行首编号**,不再退回全文文本搜索 —— 否则"标题被别处原样引用"
 * 那一条正好把文本搜索喂饱,新判据等于没加(本条判据就是为它写的,实测过一遍才发现)。
 * ⚠️ 标题族(`shape === 'heading'`)再收一档:必须候选里**仍有一行标题**以该编号开头才算活。
 * 共用大集合时同一节的 `- **O42 残余…**` bullet 会把 `## O42` 标题"喂活",删标题零报
 * (2026-09-24 真仓实测),而条目正文挂在别人的章节下正是最难发现的一种失真。
 * ⚠️ 此前的 `candidateIds` / `candidateHeadingIds` 两个 `Set<id>` 参数已删:集合语义只能答
 * "还有没有登记点"、答不了"原本有几行",而后者才是 `## O61` 那一节被吞时门报绿的根因
 * (见 `registrationSlots` 的头注)。留着这两个参数,就是给"一行改回旧判据"留门缝。
 */
export function stillRegistered(entry, candidateSrc) {
  return resolveRegistrationLoss([entry], candidateSrc).length === 0
}

/**
 * 登记行的"形态"三档:复选任务行 / 标题行 / 加粗 bullet。
 * 与 `registrationOf` 里的 shape 三元判据**同形** —— 两处各写一遍必然漂移,而漂移的表现是
 * "同一个编号在两条通道里被算成不同名额"。
 */
function shapeOfRegistration(line) {
  if (/^\s*[-*]\s\[[ xX]\]/.test(line)) return 'checkbox'
  if (/^#{2,4}\s/.test(line)) return 'heading'
  return 'bold'
}

const SHAPE_ID_SEP = '\u0000'

/**
 * 候选内容里"每个 (形态,编号) 占了**几行**行首、以及这几行各自的标记"—— 多重集,不是集合。
 *
 * 为什么必须是计数(2026-09-27 现读的本案判据盲区):`headIdSet` / `headingIdSet` 是 `Set<id>`,
 * 只能回答"这个编号还有没有登记点",回答不了"该编号原本有几行登记点"。而活文档里
 * **同一个编号被登记两次是常态**(台账被并发 union 追加、同一任务分节续写、归并前的孪生行)。
 * 于是"吞掉其中一行、另一行还顶着编号"这一型结构上判不出来。真实事故逐字复现:
 * `7c22d68d09b` 入库一整节 `### O61 领票前逐条实测…`,下一枚 `85e07c9e70b` 按旧基线把它整块吞掉;
 * 而 HEAD 里另有一行 `## O61 safe-commit…` 顶着同一个编号 ⇒ 现版判据对着 717 条历史登记行报
 * **"无缺失,无需回捞"**(717 这个读数与台账记录逐字相同 —— 复现现场喂同一判据,旧判据点名 0 条)。
 * 加粗族(`bold`)刻意不参与名额:它按"标记文本是否仍在"判活,本来就没有行首编号
 * (见 `registrationOf` 的 `shape === 'bold' ? null : headIdOf(line)`)。
 */
export function registrationSlots(src) {
  const out = new Map()
  for (const line of src.split(/\r?\n/)) {
    const shape = shapeOfRegistration(line)
    if (shape === 'bold') continue
    const id = headIdOf(line)
    if (!id) continue
    const key = `${shape}${SHAPE_ID_SEP}${id}`
    let slot = out.get(key)
    if (!slot) {
      slot = { count: 0, markers: new Set() }
      out.set(key, slot)
    }
    // count 记的是**行首名额**:短标题(< MIN_LEN)不成 marker,但它仍占着一个名额 ——
    // 这正是"把 60 字标题正当改写成 30 字"不该判丢的依据,所以 marker 缺席不影响 count。
    slot.count += 1
    const reg = registrationOf(line)
    if (reg && reg.marker) slot.markers.add(reg.marker)
  }
  return out
}

/**
 * **判活唯一实现**(2026-09-27 收口)。`--staged`(lostMarkers)、全量/人工档(missingFrom)、
 * 自愈(healContent)三条通道必须共用这一把尺子。此前 healContent 另用"编号还在行首就算活"的
 * 集合判据,于是检测侧刚判出"同编号第二行被吞",回捞侧又说它还活着 —— **门自己顶自己**,
 * 那一行永远捞不回来;而两条判据各自演进之后,连"顶自己"这件事都会消失。
 *
 * 算法(按 (形态,编号) 分组,组内判"名额"):
 *   capacity = 候选里以该编号开头(同形态)的行数
 *   present  = 组内"标记仍作为行首存在"的条数 —— 全文文本命中**不算**,引用句喂饱文本搜索
 *              那一型正是 2026-09-23 注入实锤的残余面,不得在这里还回去
 *   slack    = max(0, capacity − present)  ← 留给"保留编号、只改写文案"的正当编辑名额
 *   判丢     = 组内 present=false 的条目里取 max(0, absent − slack) 条
 * 单条目组退化成旧语义(capacity>0 ⇒ 活 / capacity=0 ⇒ 丢),所以这次收紧**不会**把既有绿灯
 * 变红,只把"同一编号多行登记、被吞其中一行"从盲区里捞出来 —— 存量安全性的现读证明在
 * `--self-test` 的成对用例与交付报告的全量档读数里,不靠这里的措辞。
 */

/** 改号尾注的固定形状(`〔改号(日期):原<旧号>〕`,行尾)。生产者 = 长号回池/让号改写。 */
export const RENUMBER_TAIL_RE = /〔改号\([^)]*\):原[A-Za-z]{1,3}-?\d+[A-Za-z]?〕\s*$/

/**
 * 漂移注释的固定形状(单行 HTML 注释,正文逐字保留)。生产者 = 守门 194 同题多号收拢
 * (枚 0eb3618@2026-10-21,机主授权)与 F9 分叉合并撞号清偿。刻意**不含** `已归档(` 一族:
 * 那一型正文是截断的、完整原文在归档件里,由归档形态(archivedCopy)承接,不靠指纹对账。
 */
export const DRIFT_COMMENT_RE = /^<!--\s*(?:漂移副本|重复副本)\([^)]*\)\s*[:：]\s*(.*?)\s*-->$/

/**
 * 摘号指针豁免(2026-10-09,F9 批⑤复活竞态根治,归因见 STATE.md 与台账 G-580/D173/G-1058623 组):
 * 台账治理按 §1 把"同号多题"的残行**合法摘号**——整行改写成
 *   `- [ ]〔【归并】重复登记副本·残行摘号(…):…〕<原正文(编号位被摘)> …`
 * 正文逐字保留、只换掉编号位。旧判定把"基线里带编号的行"与"新面里不再以编号开头"简单对账,
 * 于是每一次合法摘号都被判成"行被抹掉"而自动回捞旧态,摘号治理与自愈互搏永不收敛
 * (2026-10-09 实测连发 5 轮:0→3→0→3…,回捞提交 5d0b2392bc/a3276cdb0da)。
 *
 * 豁免判据(从严,不是"见到指针行就放过"):对每条 absent 条目,取基线行剥复选框、剥行首
 * 编号(含粗体包裹)后的**正文指纹**(去空白前 20 字,≥8 字才生效),在被审面的摘号指针行
 * (剥掉前置指针段之后)中查找;命中才算"这行是合法摘号,不是被吞"。真删行(指针行也不存在)
 * 照旧判丢;正当改写(编号行仍在)走原有 slack 名额,不受影响。指纹 20 字撞车概率可忽略,
 * 且同指纹 ⇒ 同题 ⇒ 一起豁免本就是台账治理语义。
 */
export function mergePointerBodyOf(line) {
  // 漂移注释(2026-10-22,L28827):守门 194 的"同题多号收拢"把被收拢的登记行**整行转成注释**
  //   留在 PROJECT_PLAN.md 内(`<!-- 漂移副本(同题多号收拢@…): <原行正文逐字> -->`,同族的
  //   `<!-- 重复副本(…): … -->` 出自 F9 分叉合并撞号清偿)—— 正文逐字保留、登记槽位摘除,
  //   与〔【归并】〕指针行同一性质,只是落点从台账行换成注释。不认这一型时,带行首编号的
  //   收拢行(b 族)只靠归档件/摘除台账两形态兜底;收拢件不在射程(G-69 组:原文只在漂移
  //   注释里、不在 .ihui-agent/archive/PROJECT_PLAN_*.md)⇒ 每轮被判缺失、heal 捞回开放态
  //   ⇒ 同题组回潮、再收拢、再捞回(2026-10-21 实测,同题回潮机器成因的后半块)。
  //   从严面与摘号相同:注释在但正文被换 ⇒ 指纹对不上,照旧判缺失(反向锁见镜像测试);
  //   既有两形态(〔【归并】〕指针行、改号尾注)的行为逐字节不变 —— 本分支只接注释行。
  const drift = line.match(DRIFT_COMMENT_RE)
  if (drift) return drift[1]
  const cb = checkboxBody(line)
  if (cb === null) return null
  // 前缀族放宽(2026-10-13,守门 71 × 守门 194 缝隙):摘号/归并指针段不止"重复登记副本"一族,
  //   守门 194 的"同题多号收拢"(`〔【归并】同题多号收拢(…):本行与 Lxxx 同题,派单以持有行为准…〕`)
  //   同样是 §1 台账治理的合法归并形态 —— 前缀文案写死成单族时,守门 194 收拢的每一行都会被
  //   本闸判"基线行被抹掉"而点名(2026-10-13 HEAD 现读 4 条:G-1018294./G-1018295./G-1038470./
  //   G-1038473.,三档一致缺 ⇒ 每轮自愈红着点名却无从回捞)。放宽为整个 〔【归并】…〕 前缀族;
  //   从严面不变:指纹对账(正文逐字保留)才是豁免的实体条件,前缀只是通道 —— 指针行不在、
  //   正文被换照旧判缺失(反向锁用例见 check-plan-line-loss.test.mjs)。
  if (cb.startsWith('〔【归并】')) {
    const stripped = cb.replace(/^〔【归并】[^〕]*〕/, '')
    return stripped
  }
  // 改号尾注(2026-10-22,长号回池):整行只换编号位、正文逐字保留,行尾留「原<旧号>」。
  // 与摘号同一性质 —— 旧行不是被抹掉,而是换了身份。不认这一型时,每次合法换号都被判丢
  // 而回捞旧号(2026-10-22 实测:换号后自愈补回 D22046/G-957/G-958,HEAD 与工作树来回拉锯)。
  // 从严面与摘号相同:尾注在但正文被换 ⇒ 指纹对不上,照旧判缺失(反向锁见同文件测试)。
  if (RENUMBER_TAIL_RE.test(cb)) {
    return cb
      .replace(RENUMBER_TAIL_RE, '')
      .replace(/^\*{0,2}[A-Za-z]{1,3}-?\d+[A-Za-z]?\*{0,2}\s*/, '')
  }
  return null
}

/**
 * 行首编号(含可选点号/顿号与强调记号)的唯一剥离判据。
 * `G-1018294.` / `D173` / `**G-580 ` 三族都要剥;点号漏剥会让基线侧残留 `.`、
 * 而语料侧因前导空格没剥到编号 ⇒ 全文比较两端不等(2026-10-22 实测的最后一格)。
 */
const LEADING_ROW_ID_RE = /^\s*\*{0,2}[A-Za-z]{1,3}-?\d+[A-Za-z]?[.、]?\*{0,2}\s*/

/** 基线登记行 → 剥编号后的正文指纹(去空白前 20 字;不足 8 字返回 '' 防误配)。 */
export function lossFingerprintOf(line) {
  const cb = checkboxBody(line)
  if (cb === null) return ''
  // 编号两族都要剥:G-580(连字符)与 D173/D1047(D 族无连字符)——只剥连字符形态会让
  // D 族指纹带着编号,而摘号行的正文里没有编号 ⇒ 指纹永远匹配不上,豁免对 D 族整族失效。
  const noId = cb.replace(LEADING_ROW_ID_RE, '').replace(/^\*+/, '')
  const fp = noId.replace(/\s+/g, '').slice(0, 20)
  return fp.length >= 8 ? fp : ''
}

/** 摘除声明集合(模块级缓存:同一进程只读一次;取不到 ⇒ 空集,方向是"照旧判丢"而不是误豁免)。 */
let _declaredRowsCache = null
function declaredRowSet() {
  if (_declaredRowsCache) return _declaredRowsCache
  try {
    _declaredRowsCache = declaredRows()
  } catch {
    _declaredRowsCache = { set: new Set(), dropTitleFps: new Set() }
  }
  return _declaredRowsCache
}

/** 改号行正文归一化:去空白、剥尾部压缩注记、编号统一为占位符(改号本身只动编号)。 */
const normalizeRenumberBody = (s) =>
  String(s)
    // 摘号行剥掉〔【归并】…〕前缀后常以 `**` 开头,而基线行剥编号后没有 ⇒ 开头强调记号归一;
    // 不归一时全文比较会把"同一段正文"判成两端不等(20 字指纹用 includes 恰好掩盖了这一差)。
    .replace(/^\*+/, '')
    .replace(/〔压缩@[^〕]*〕/g, '')
    .replace(/\s+/g, '')
    .replace(/[A-Za-z]{1,8}-?\d+/g, '<ID>')

/**
 * 「已收拢」的**第三形态**(2026-10-24 立,票「line-loss 的『已收拢』判据缺第三形态:漂移注释
 * ⇒ 每轮 heal 把收拢行捞回」)。
 *
 * 为什么前两形态接不住(现读取证,不是推演):
 *  ① `archivedCopy` 只认 `.ihui-agent/archive/PROJECT_PLAN_*.md` 与清偿台账 —— 收拢件不在里面;
 *  ② `pointerExempt`(摘号/改号通道)要求**剥完装饰后的整段正文逐字相等**,且第一道
 *     `checkboxBody(e.line)` 就把非复选形态(加粗 bullet a 族、标题 c 族)整个排除在外。
 *     而真仓 HEAD 面 80 枚漂移注释里,正文**逐字等于原行**的只是少数:生产器把行搬进注释时
 *     会洗断前导装饰(实测 `<!-- 重复副本(…): 进行中） **Esc 无层栈协议**…` —— 原行是
 *     `- [ ] （进行中@2026-09-26/Esc层栈票,主会话第九批） **Esc …**`,左括号连前缀一起没了),
 *     注释尾部还常挂 `〔PROGRESS@…〕` 这类原行没有的进展注记 ⇒ 逐字比较必然不等。
 *  ③ 纪元档的 `liveBodies` 只从 `^\s*[-*]\s` 的 bullet 行取题面 ⇒ **注释行整族不在射程**;
 *     而 marker 退化到只剩编号时(编号后紧跟 `**` ⇒ `titleMarker` 截出空标题)它走「实字 <6 ⇒ 不判」
 *     那一支,是"放过去"而不是"认出已收拢" —— 账面上看不出一枚收拢行被认成什么。
 * 三条合起来的后果 = 收拢行每轮被判缺失 ⇒ `--heal` 把它从历史捞回**开放态** ⇒ 同题组回潮 ⇒
 * 再收拢 ⇒ 再捞回(同题回潮机器成因的后半块)。
 *
 * 判据口径(从严,两条同时成立才算「已收拢」):
 *  甲 **题面**:该登记行剥掉项目符号/复选框/前导成对装饰/行首编号/强调记号后的题面前
 *     `COLLECTED_TITLE_SPAN` 字,去空白与记号归一后,**逐字出现在**同一条漂移注释的归一正文里;
 *     归一后实字不足 `COLLECTED_MIN_JUDGABLE` 字的行**不判**(照旧走原通道,可能仍判缺)——
 *     宁可多要一次人工归并,也不给"任意短行"发免死牌(§0.10)。
 *  乙 **编号**:该行有行首编号时,同一条注释里必须也含该编号(编号可写在正文任意位置,
 *     不必在行首 —— 生产注释普遍写成 `(原编号 G-855…)` / `正主 L7664 G-335` 这种句中形态)。
 *     编号为 null 的加粗族沿用本门既有口径(它按标记文本判活,本来就没有行首编号),只要甲。
 * 只有 `DRIFT_COMMENT_RE` 那两族(`漂移副本` / `重复副本`)算收拢件;`已归档(` 一族正文是截断的,
 * 其完整原文归 `archivedCopy` 承接 —— 与 `mergePointerBodyOf` 头注同一条口径,不新开射程。
 *
 * 为什么不放宽成"注释里有编号就算":同号不同题就是本仓反复登记的撞号形态,单靠编号作证等于
 * 把注释变成万能豁免证(镜像测试 S6 那条反向锁钉着它)。
 * 为什么不抽到 `scripts/lib/` 另立一份:这把尺子的**全部消费方**(检测侧 `resolveRegistrationLoss`
 * = lostMarkers/missingFrom/stillRegistered 三通道,回捞侧 `healContent`)本来就在这一个文件里,
 * 而 `lib/post-merge-ledger-sync.mjs` 结构上不判任何东西 —— 它派生本门 `--heal --commit`。
 * 判据搬家只会多出一个"编号族表"的第二份拷贝(§0.6 要防的正是这个),故就地实现、就地导出。
 */
export const COLLECTED_TITLE_SPAN = 24
export const COLLECTED_MIN_JUDGABLE = 12

/** 行首编号的剥离式(含批次序号族)。**由 `ID` 族表生成,不得再抄一份字面量**(§0.6)。 */
const LEADING_HEAD_ID_RE = new RegExp(String.raw`^(?:${ID}|第[0-9一二三四五六七八九十百①-⑳]+批)[.、]?`)

/** 题面对账用的归一:剥注记段、去空白与强调/引用记号、括号与冒号族折掉、转小写。 */
export function collectedNorm(s) {
  return String(s ?? '')
    .replace(/〔[^〕]*〕/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/[`*_~「」『』“”"'’]/g, '')
    .replace(/[（(）)〔〕\[\]{}]/g, '')
    .replace(/[:：]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * 登记行 → 题面键(前 `span` 个归一字)。前导装饰与行首编号**反复剥**(两者先后顺序在真仓里
 * 两种都有:`- [ ] G-63 **题面**` 与 `- **G-855〔旧号〕 题面**`)。
 * @returns {string} '' = 无法判定(题面实字不足下限),调用方必须照旧判缺
 */
export function collectedTitleKey(line, span = COLLECTED_TITLE_SPAN) {
  let s = String(line ?? '')
  s = s.replace(/^\s*(?:[-*+]\s+|#{2,6}\s*)/, '')
  s = s.replace(/^\[[ xX]\]\s*/, '')
  for (;;) {
    const before = s
    s = s.replace(/^\s*(?:[✅⏳☑✔✓🕐⚠]\s*)?[（(][^）)]*[）)]\s*/, '')
    s = s.replace(/^\s*〔[^〕]*〕\s*/, '')
    s = s.replace(/^\s*【[^】]*】\s*/, '')
    s = s.replace(/^\*+/, '')
    s = s.replace(LEADING_HEAD_ID_RE, '')
    if (s === before) break
  }
  const key = collectedNorm(s).slice(0, span)
  return key.replace(/[^\p{L}\p{N}]/gu, '').length >= COLLECTED_MIN_JUDGABLE ? key : ''
}

/** 被审面上的全部漂移注释 → 归一正文语料(每次判定算一次,与内容同面同轮)。 */
export function driftCollectedCorpus(targetSrc) {
  const out = []
  for (const line of String(targetSrc ?? '').split(/\r?\n/)) {
    const m = line.match(DRIFT_COMMENT_RE)
    if (m) out.push({ body: m[1], text: collectedNorm(m[1]) })
  }
  return out
}

/**
 * 单条缺席登记行是否「已收拢在册」(第三形态)。
 * @returns {{matched:boolean, unjudged:boolean, comment:string|null, key:string}}
 *  `unjudged:true` = 题面太短无法判 ⇒ **不豁免**(照旧走原有通道),绝不读成"已找到"。
 */
export function collectedInDriftComment(entry, corpus) {
  const no = { matched: false, unjudged: false, comment: null, key: '' }
  if (!entry || typeof entry.line !== 'string' || !Array.isArray(corpus) || corpus.length === 0) return no
  const key = collectedTitleKey(entry.line)
  if (key === '') return { ...no, unjudged: true }
  // 编号两写法都认:折算后的新号与面上的裸旧号(纪元档下二者必然同时存在,见 missingFrom 的 idAlt)
  const idKeys = [entry.id, entry.idAlt].filter((x) => typeof x === 'string' && x).map(collectedNorm)
  for (const c of corpus) {
    if (!c.text.includes(key)) continue
    if (idKeys.length && !idKeys.some((k) => c.text.includes(k))) continue
    return { matched: true, unjudged: false, comment: c.body, key }
  }
  return { ...no, unjudged: false, key }
}

export function resolveRegistrationLoss(entries, targetSrc, declared = new Set(), collectedSink = null, retired = new Set()) {
  const declaredSet = declared instanceof Set ? declared : (declared?.set ?? new Set())
  const dropTitleFps = declared instanceof Set ? new Set() : (declared?.dropTitleFps ?? new Set())
  const retiredSet = retired instanceof Set ? retired : new Set()
  const groups = new Map()
  const textOnly = []
  for (const e of entries) {
    if (!e || !e.marker) continue
    if (!e.id) {
      textOnly.push(e)
      continue
    }
    // 形态优先取条目自带的 shape;调用方(手写夹具 / 历史回捞里的旧记录)没带时**从行自身推**。
    // 这不只是宽容:名额按 (形态,编号) 归组,若把缺 shape 的条目挂到 `undefined` 键上,
    // 它就会与目标里那一行的 `checkbox` 键对不上 ⇒ 已存在的行被判成丢失 ⇒ 回捞插出重复行。
    const shape = e.shape || shapeOfRegistration(e.line || '')
    const key = `${shape}${SHAPE_ID_SEP}${e.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ e, shape })
  }
  const lost = new Set()
  const multiSlot = new Set()
  // 摘号/改号豁免语料(2026-10-22 审计加固):被审面全部合法改写行剥指针段/尾注后的
  // **全文归一化**集合(去空白、剥压缩注记、编号归一)。此前用 20 字指纹做子串匹配 ——
  // 实测第 21 字起被改写仍会被判"没丢";统一改成全文逐字比较。
  // `lossFingerprintOf` 只留作 ≥8 字下限,防止极短行的退化解被当语料。
  const pointerCorpus = new Set(
    targetSrc
      .split(/\r?\n/)
      .map((l) => mergePointerBodyOf(l))
      .filter((b) => b !== null)
      // 漂移注释的正文保留了行首编号(`<!-- 漂移副本(...): G-8815945 **… -->`),
      // 而基线侧已剥编号 ⇒ 语料侧也剥一次,两形态(有号注释/无号摘号)才同基准。
      .map((b) => b.replace(LEADING_ROW_ID_RE, ''))
      .map((b) => normalizeRenumberBody(b)),
  )
  const pointerExempt = (e) => {
    if (!e.line) return false
    if (lossFingerprintOf(e.line) === '') return false
    const cb = checkboxBody(e.line)
    if (cb === null) return false
    const body = cb.replace(LEADING_ROW_ID_RE, '')
    return pointerCorpus.has(normalizeRenumberBody(body))
  }
  // 声明摘除豁免(2026-10-22):整行逐字在摘除台账中 ⇒ 这是被主动删掉的副本/结清行,
  // 不判丢、不回捞。方向从严:只认整行逐字相等,不做指纹/相似度;台账取不到 ⇒ declared 为空,
  // 一切照旧(不误免)。与 pointerExempt 并存:两条通道互不替代。
  const declaredExempt = (e) =>
    typeof e.line === 'string' &&
    (declaredSet.has(e.line) || (dropTitleFps.size > 0 && dropTitleFps.has(titleFpOf(e.line))))
  // 已结清短留痕(2026-10-25):窗口外看不见那次翻勾时,按落盘的 retired 拒绝复插。
  // 只对"已观察到的翻勾"生效;没观察到的 ≠ 没结清(空集,行为与改前一致)。
  const retiredExempt = (e) => typeof e.marker === 'string' && retiredSet.has(e.marker)
  /**
   * 第三形态(见 `COLLECTED_TITLE_SPAN` 头注):其余通道都判"这行没了"时,再问一次
   * "它的原文是不是被收拢进漂移注释了"。放在最后一条 = 它只会**减少**误判回捞,
   * 不可能把原本判绿的事翻成判红(§12e 反恒红门);而 `pointerExempt` 留在它后面作兜底
   * (题面短到无法判、而整段正文逐字相等的那一型仍由老通道豁免,行为逐字不变)。
   * sink 只登记"本形态救下来的那些",读数口径 = 本次改动的影响面,不是注释总枚数。
   */
  const collectedCorpus = driftCollectedCorpus(targetSrc)
  const collectedSeenKeys = new Set()
  const collectedExempt = (e) => {
    const cm = collectedInDriftComment(e, collectedCorpus)
    if (cm.matched && collectedSink && !collectedSeenKeys.has(e.marker)) {
      collectedSeenKeys.add(e.marker)
      collectedSink.push({ marker: e.marker, id: e.id ?? null, line: e.line, comment: cm.comment })
    }
    return cm.matched
  }
  // textOnly 档同样要豁免:批⑤的四行真实形态(`- [ ] **G-580 …` 粗体头带空格)headIdOf 给 null,
  // 全走 textOnly —— 只豁免带 id 的组循环等于对这批真实事故行不生效(2026-10-09 端到端探针实证)。
  for (const e of textOnly) {
    if (targetSrc.includes(e.marker) || declaredExempt(e) || retiredExempt(e) || pointerExempt(e)) continue
    // 加粗族(题面文本判活)的收拢件若把编号写成 `G-855〔旧号〕` 这类形态,marker 逐字断链
    // ⇒ 老口径直接判缺(a 族实测);第三形态按题面认它。
    if (collectedExempt(e)) continue
    lost.add(e.marker) // 第三形态放行后仍判缺的那一支:逐枚入账,不得整批静默
  }
  const slots = registrationSlots(targetSrc)
  for (const [key, group] of groups) {
    const slot = slots.get(key)
    const capacity = slot ? slot.count : 0
    const head = slot ? slot.markers : new Set()
    const absent = []
    let present = 0
    for (const { e } of group) {
      if (head.has(e.marker)) present += 1
      else if (collectedExempt(e)) continue // 已收拢进漂移注释(第三形态)⇒ 不判丢、不回捞
      else if (retiredExempt(e)) continue // 窗口外已结清(短留痕)⇒ 不判丢、不回捞
      else if (pointerExempt(e)) continue // 合法摘号/改号(全文归一逐字相等)⇒ 不判丢、不点名、不回捞
      // 已声明摘除**不在这里 continue**:它必须占住 absent 的位置但不消耗 slack,
      // 否则同组后面那条真删行会被 slack 吞掉(2026-10-22 审计实测:台账空报 1、有台账报 0)。
      else absent.push(declaredExempt(e) ? { ...e, declared: true } : e)
    }
    // 名额优先解释"组内靠前的"缺席条目(它们来自较新的历史版本,更可能是被改写而不是被吞)
    const slack = Math.max(0, capacity - present)
    const undecided = absent.filter((e) => !e.declared)
    for (const e of undecided.slice(slack)) lost.add(e.marker)
    /**
     * `multiSlot` = 判丢时该编号**在目标面仍占着行首名额**(capacity > 0)。
     * 这一类的含义不是"这个任务没人登记了",而是"同一编号原本有几行、现在少了一行" —— 少的那行
     * 可能是被吞,也可能是别人正当改了编号 / 归并后另起一行,**两者在内容上不可区分**。
     * 所以它只许**点名交人工**,绝不允许进自动回捞:真仓现读的两条此类样本(G-300 / G-301)
     * 都是"同编号被两件事共用"的台账撞号,自动插回去就是替台账长出一份重复登记(§1 红线)。
     */
    if (capacity > 0) for (const e of undecided.slice(slack)) multiSlot.add(e.marker)
  }
  // 返回顺序 = 输入顺序:判据语义与旧实现一致,也免得回捞插入顺序被分组打乱
  return entries
    // 已声明摘除的条目不得随同 marker 被带进回捞集(同号多行时 lost 是 marker 级集合,
    // 不过滤就会把已声明的行一起插回去 —— 2026-10-22 审计指出的同组吞行面)。
    .filter((e) => e && e.marker && lost.has(e.marker) && !declaredExempt(e) && !retiredExempt(e))
    .map((e) => (multiSlot.has(e.marker) ? { ...e, multiSlot: true } : e))
}

/** 登记行 → 编号标记(找不到返回 null) */
export function markerOf(line, allowChecked = false) {
  // 已勾行不进保护集(2026-10-16 机主令:完成即删,存档机制退役):`- [x]` 行(含 bullet 级
  // `  - [x] ✅(日期) …`)在翻勾后可整行删除,回捞层同样不得把它捞回来 —— 否则"完成即删"
  // 每删一行就被本门拦一次/被自愈还原一次,机制互咬空转(13d 与清偿器 2026-10-14 同型教训)。
  // 未勾行(checkbox `- [ ]`、加粗 bullet、标题族)照旧受保护:防"旧基线整文件回写"
  // 的事故防线保留,与存档退役无关。
  // ⚠️ `allowChecked` 只服务一个用途:让 `historyMarkers` 能**看见**已勾形态,从而判断一个
  // marker 的最新形态到底是开放还是已勾销(2026-10-18 实测:此前已勾形态对扫描完全不可见,
  // 同 marker 在更深历史里的未勾副本照常进保护集,"翻勾后删行"必被自愈还原 ⇒ 上面那条口径
  // 结构上跑不通)。它**不放宽判活**:保护与否由 `historyMarkers` 的配平状态机决定。
  if (!allowChecked && /^\s*[-*]\s\[[xX]\]/.test(line)) return null
  const isBullet = /^\s*[-*]\s/.test(line)
  // 标题行只有"以批次序号开头"这一种受保护形态(见文件头判据 1c),正文标题不进基线
  const isHeading = /^#{2,4}\s/.test(line)
  if (!isBullet && !isHeading) return null
  // 再外加 `第N步` 中文序号一族(数字/汉字/带圈数字) —— `**第⑥步 …**` 这类按步骤自造
  // 序号写的进度登记行此前完全不受保护:被并发旧基线覆写后 273 条扫描仍报"无缺失"
  // (2026-09-23 本会话实锤一枚"第⑥步"登记行被抹)。刻意只认 `步`:
  // "第N次/第N轮/第N阶段"是叙述而非登记序号,纳进必假红。
  if (line.trim().length < MIN_LEN) return null
  const m = isBullet
    ? line.match(new RegExp(`\\*\\*(${ID}|第[0-9一二三四五六七八九十①-⑳]+步)`))
    : null
  if (m) {
    // 标记 = 加粗头的**原文前缀**(不做任何重拼,否则 "D107b" 会被拆成 "D107 b" 这种
    // 源文本里根本不存在的串,导致正常提交被误判为丢失);遇到下一个 `*` 即停 ——
    // 不然 `**P2-F.4**(评估触发)…` 这种"编号后紧跟闭合星号"的行会把 `**` 吃进标记,
    // 于是别人正常改写文案也被判成"登记行消失"(实测 1 例假阳)。
    const tail = line.slice(m.index + 2)
    const star = tail.indexOf('*')
    return (star >= 0 ? tail.slice(0, star) : tail).slice(0, 18)
  }
  if (isBullet) {
    // 复选任务行:编号必须在**内容开头**(剥掉复选框与多层状态装饰之后,见 checkboxBody)。
    const body = checkboxBody(line)
    if (body === null) return null // 不是复选任务行
    const id = body.match(ID_RE)
    return id && id.index === 0 && id[1].length >= 3 ? titleMarker(body) : null
  }
  // 标题行:认开头的批次序号(`### 第十四批(…):…`),以及**以登记编号打头的任务标题**
  // (`## O28 …` / `## D107b …` / `## 守门 79 …`)。后者是 2026-09-23 实测补的一族:并发旧基线
  // 回写抹掉了 `## O28` 标题,而本门当时只认"第N批",390 条扫描照报"无缺失"(判据盲区)。
  // 仍刻意不认"轮/次/阶段"—— `第二轮` 这类串在正文里到处出现,拿它当标记等于永久报不出
  // 丢失,只会往基线里塞空条目。
  const h = line.match(new RegExp(String.raw`^(#{2,4}\s*)(第[0-9一二三四五六七八九十百①-⑳]+批|${ID})`))
  return h && h[2].length >= 3 ? titleMarker(line.slice(h[1].length)) : null
}

/** 从一份计划文档里抽出所有登记行(标记 + 行首编号) */
export function registeredLines(src) {
  return src
    .split(/\r?\n/)
    .map((line) => ({ line, ...(registrationOf(line) || {}) }))
    .filter((x) => x.marker)
}

/** 基线里存在、待提交内容里彻底消失的登记行 */
// 默认 declared = 空集(**刻意**):lostMarkers 是提交链 `--staged` 档的尺子,不得依赖仓外
// 的摘除台账 —— 否则一份被读/写到的 gitignored jsonl 就能让任意登记行在提交链上被误免。
// 本机自愈走 missingFrom(它显式读台账),CI/净检出无台账时照旧判丢(不回捞)。
export function lostMarkers(baselineSrc, candidateSrc, declared = new Set(), collectedSink = null) {
  // 判活只有一份实现(见 resolveRegistrationLoss);`multiSlot` 必须随条目一起传出 ——
  // 报告里"只点名不回捞"那句话与回捞侧的刹车都靠它,在这里 map 成新对象把它抹掉,
  // 等于让提交链那一档退化成"照常自动插回"(镜像用例端到端抓出来的正是这一格)。
  return resolveRegistrationLoss(registeredLines(baselineSrc), candidateSrc, declared, collectedSink).map((e) => ({
    marker: e.marker,
    line: e.line,
    id: e.id,
    shape: e.shape,
    ...(e.multiSlot ? { multiSlot: true } : {}),
  }))
}

/**
 * 归并名额维(2026-10-24 立):同一 `(形态,编号)` 在面上占的**行首名额**变少,但该编号仍活着。
 *
 * 立因是实测而非读码推断(2026-10-24 清 G-871/G-873 同题副本时量出来):`lostMarkers` 的组内
 * 判活按 marker 命中算,而**同题副本两行的 marker 逐字相同**(题面直到第一个分界符才分岔)——
 * 于是基线组里两条 entries 都 `head.has(marker)` ⇒ `present=2`、`absent=0` ⇒ 删掉**任意一份**
 * 都读成"没丢"。真仓 HEAD 面成对实测:`lostMarkers(HEAD, HEAD−副本)` 与
 * `lostMarkers(HEAD, HEAD−信息更全那份)` **两支都返回空集** ⇒ 本闸对"留过时那份、删带进展那份"
 * 结构上失明,而那恰是正当归并每天在做的动作(§1 同题副本清偿、门 71 头注 multiSlot 同型)。
 *
 * 本维刻意**不判"哪一份该留"** —— 被吞与正当归并在内容上不可区分(门 71 头注同一条理由),
 * 所以两份删法一视同仁,只要求当次提交给一次定向说明(§0.10 失效方向恒为"多要一次说明",
 * 绝不是"多放一次跳门")。凭据取 `IHUI_PLAN_MERGE_FOLD` 当次声明,理由有三:
 *  ① 与 `--staged` 的输入面(索引 vs HEAD)同轮同面,不是跨轮可腐烂的白名单;
 *  ② 不新增盘上台账 —— 摘除台账是 gitignored 的,`lostMarkers` 头注已写明提交链一律不得认它
 *     (一份被读写到的 jsonl 就能让任意登记行被误免);
 *  ③ 与"完成即删不留档"(2026-10-16 机主令)不冲突 —— 不要求谁去补归档件。
 *
 * `to === 0` 的那一族(整个编号从面上消失)归 `lostMarkers` 判,**不在本维重复计债** ——
 * 两把尺子互相顶名额是本仓最贵的一类事故(见 resolveRegistrationLoss 头注)。
 * 只给判据,取值与放行由调用方(`runCheck` 的 staged 分支)做;全量/人工档**不接**本维 ——
 * 旁路落地不跑钩子而它正是同号多行的主要生产者,挂上去就是把与本次提交无关的存量钉红(§12e)。
 *
 * ⚠️ 真拿本维落地一次归并时,**摘除要落两次**(2026-10-24 两轮对照实测,不是推理):
 *   旁路落地器(`object-space-land` / `live-doc-edit`)在 CAS 成功后**立刻**补跑
 *   `check-plan-line-loss --heal --commit` 当 post-commit 第 6 段的替身,而 §1 明令留痕必须排在
 *   落地成功之后(先写后落会把"面上还在"说成"已删")⇒ 首轮摘除被自愈按历史面原样插回
 *   (摘除 `e0df0b1edf` ⇒ 同一分钟 `df16afe6b4` 逐字回捞同一行);台账就位后同样内容再落一次才保持住
 *   (`c1259a82800`,那一轮三档均报缺 0 条)。器物侧的正解是"跑自愈之前先按本票**显式声明**的
 *   removed 写台账",而绝不得把行差集自动写成"已声明摘除" —— 那等于替旧基线吞行发免死牌。
 */
export function foldedSlots(baselineSrc, candidateSrc) {
  const base = registrationSlots(baselineSrc)
  const target = registrationSlots(candidateSrc)
  const out = []
  for (const [key, slot] of base) {
    const slot2 = target.get(key)
    const to = slot2 ? slot2.count : 0
    if (to === 0 || to >= slot.count) continue
    const sep = key.indexOf(SHAPE_ID_SEP)
    // 归因:目标面里不再出现的那些 marker 才是"这次没掉的行";而同题副本的 marker 本就逐字相同
    // (这正是本维立项的原因),此时归因不出具体哪一行 ⇒ 留整族 marker,由调用方按既有归档豁免口径问。
    const gone = slot2 ? [...slot.markers].filter((m) => !slot2.markers.has(m)) : [...slot.markers]
    out.push({
      shape: key.slice(0, sep),
      id: key.slice(sep + SHAPE_ID_SEP.length),
      from: slot.count,
      to,
      dropped: slot.count - to,
      markers: gone.length ? gone : [...slot.markers],
    })
  }
  return out
}

/**
 * 归并声明解析:`IHUI_PLAN_MERGE_FOLD` 的逗号/空白清单收成编号集(去重、保持给出顺序)。
 * 缺失/空串 ⇒ 空集 —— 声明必须逐号给出,**环境变量本身不是开关**(给了没命中的号由调用方判红)。
 */
export function parseMergeFoldDeclaration(raw) {
  if (typeof raw !== 'string') return []
  return [...new Set(raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean))]
}

/** 归档豁免的目录(相对仓库根);清单与内容**同面**取,见 archivedCopy。 */
const ARCHIVE_REL = '.ihui-agent/archive'/**
 * 归档副本文件名射程。两种:
 *  ① `PROJECT_PLAN_*.md` —— §1 归档两步走搬走的登记段(既有射程);
 *  ② `plan-pointer-purge-*.md` —— plan-pointer-purge --apply 的清偿台账,内含**被删行的逐字原文**。
 *
 * 为什么 ② 必须进射程(2026-10-14 实测对打两轮):清偿按用户指令把「〔【归并】重复登记副本…〕」
 * 指针行从 HEAD 删掉后,本闸把删除读成"被并发旧基线抹掉的登记行",经 commit-tree 旁路原样回捞
 * (`7826f3b0741` 清零 40 → `2560d82194` 还原 40 → 再清 → `6e8d2e089e` 又还原 40)⇒ 无限空转,
 * 清偿成果永远守不住。回捞器走旁路落地、钩子结构性不跑 ⇒ 守门 13d 的差值棘轮拦不到它。
 * 判据不改宽严:豁免的实体条件仍是 `archivedCopy` 的"原文在已入库归档里找得到",
 * 只是把"归档"的文件名从单一 `PROJECT_PLAN_*` 扩到清偿台账这一同族落点(同目录、同"正当移除"
 * 语义)。现读 40 条缺失经此射程 40/40 豁免;不在台账里的真删照旧判丢(见镜像测试反向锁)。
 */
const ARCHIVE_FILE_RE = /^(?:PROJECT_PLAN_|plan-pointer-purge-).*\.md$/

/** 某一面里真实存在的归档副本路径。归档件(archive/)读 HEAD/索引树(已入库事实);
 *  清偿台账(tmp/,gitignored 常驻)2026-10-16 起从**盘上**读 —— 它们永不入版本控制,
 *  树读射程结构上永远看不到 ⇒ 折并删行被本闸当"丢行"捞回(22:35-22:40 实测两轮对打)。
 *  盘读的安全性:tmp/ 是 gitignored 固定落点,不像归档件会搬家;"原文在台账里找得到"
 *  的实体条件(archivedCopy)一字不改 —— 台账在盘 ⇒ 豁免,台账也没了 ⇒ 照旧判丢。
 *  staged 面加收索引里的归档件;tmp 盘读与面无关(盘只有一份)。
 */
function faceArchiveFiles(face, root = ROOT) {
  const args =
    face === 'staged'
      ? ['ls-files', '-z', '--', ARCHIVE_REL]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ARCHIVE_REL]
  const treePaths = gitRaw(args, root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(Boolean)
    .filter((p) => ARCHIVE_FILE_RE.test(p.split('/').pop()))
  // 清偿台账的现役落点(.ihui-agent/tmp/,gitignored):盘上枚举,射程正则同一把
  // tmpRel 是**判据面路径**:必须保持 POSIX 正斜杠 —— faceArchiveBlobs 按
  // `startsWith('.ihui-agent/tmp/')` 分拣磁盘族,这里若用 path.join 拼,Windows 上会得到
  // 反斜杠 ⇒ 前缀一条都匹配不上 ⇒ 盘读族被静默丢空,豁免失效退回假红(且没人会红)。
  const tmpRel = '.ihui-agent/tmp'
  const tmpDir = path.join(root, '.ihui-agent', 'tmp')
  let diskPaths = []
  try {
    diskPaths = readdirSync(tmpDir)
      .filter((n) => ARCHIVE_FILE_RE.test(n))
      .map((n) => `${tmpRel}/${n}`)
  } catch {
    diskPaths = [] // tmp 目录缺席 = 没有台账 = 无豁免凭据,照旧(§0.3 不冒充)
  }
  return [...treePaths, ...diskPaths]
}

/**
 * 按面缓存「路径 → 该面 blob 内容」,整进程每个 (仓库根, 面) 至多一次批量派生。
 * 逐 marker 各开一次 git 是本仓守门 80 立过的 fork 风暴形态,所以一次读满一批。
 * 缓存键**必须含根**:`--self-test` 会在同一进程里对多个临时仓取证,只按面缓存会让第二个
 * 仓借到第一个仓的归档内容 —— 那是一道自洽却错基准的假绿(守门 118 的"两面同轮"同条纪律)。
 */
const ARCHIVE_BLOB_CACHE = new Map()
function faceArchiveBlobs(face, root = ROOT) {
  const key = `${root}\u0000${face}`
  if (ARCHIVE_BLOB_CACHE.has(key)) return ARCHIVE_BLOB_CACHE.get(key)
  const files = faceArchiveFiles(face, root)
  const rev = face === 'staged' ? ':' : 'HEAD:'
  // 盘读族(.ihui-agent/tmp/ 的清偿台账):不进 catBatch,直接 readFileSync(盘只有一份)
  const treeFiles = files.filter((p) => !p.startsWith('.ihui-agent/tmp/'))
  const diskFiles = files.filter((p) => p.startsWith('.ihui-agent/tmp/'))
  const specs = treeFiles.map((p) => `${rev}${p}`)
  const got = specs.length ? catBatch(root, specs, { timeout: GIT_TIMEOUT }) : new Map()
  const map = new Map()
  for (let i = 0; i < treeFiles.length; i++) {
    const v = got.get(specs[i])
    if (typeof v === 'string') map.set(treeFiles[i], v)
  }
  for (const p of diskFiles) {
    try { map.set(p, readFileSync(path.join(root, ...p.split('/')), 'utf8')) } catch { /* 取不到 ⇒ 不计入凭据 */ }
  }
  ARCHIVE_BLOB_CACHE.set(`${root}\u0000${face}`, map)
  return map
}
// ↓ 旧实现尾部(被上方改写替代,占位以保 replace 唯一性)
function __oldFaceArchiveBlobsTail__() {
  const files = faceArchiveFiles(face, root)
  const rev = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((p) => `${rev}${p}`)
  const got = specs.length ? catBatch(root, specs, { timeout: GIT_TIMEOUT }) : new Map()
  const map = new Map()
  for (let i = 0; i < files.length; i++) {
    const v = got.get(specs[i])
    // 面里有名字却读不到 blob(unmerged / 刚被删)⇒ 不计入凭据,也不抛:
    // 少一条豁免只会多要一次定向说明,而拿不准时放行才是本闸最怕的那一型。
    if (typeof v === 'string') map.set(files[i], v)
  }
  ARCHIVE_BLOB_CACHE.set(key, map)
  return map
}

/**
 * 归档目录里能否找到原文(§1 归档 = 正当删除)。
 *
 * **只认已入库的锚点**(2026-09-25 补,G-183 ③):旧实现是 `readdirSync(ARCHIVE_DIR)` +
 * `readFileSync`,于是本机写一份**从未进任何提交**的 `archive/PROJECT_PLAN_*.md`,就能为
 * 「把别人已入库的登记行从计划文档里删掉」出具归档凭据 —— 而那份原文在另一台检出上不存在,
 * 删掉的行也无从找回。§1 那句「archive 里找得到 ⇒ 不算丢」的前提是「归档过」属于**仓库事实**,
 * 不是本机巧合(与 G-173「可审计锚点必须受版本控制」同一条纪律)。
 * 现清单与内容同面:`--staged` 判索引、全量判 HEAD 树;该面里没有的路径不构成凭据。
 *
 * `list` / `read` 可注入,使三条组合(未入库⇒不放行 / 已入库⇒放行 / 面里有名字但 blob 取不到
 * ⇒ 不放行)能在不往真仓 archive 目录写文件的前提下取证(那正是要防的取证姿势)。
 * `root` 可注入只为**取证**(临时 git 仓构造三面互异的现场);生产调用点一律走默认仓库根。
 */
export function archivedCopy(marker, opts = {}) {
  const face = opts.face ?? 'head'
  const root = opts.root ?? ROOT
  const blobs = opts.list ? null : faceArchiveBlobs(face, root)
  const files = opts.list ? opts.list() : [...blobs.keys()]
  const read = opts.read ?? ((p) => blobs.get(p) ?? null)
  for (const p of files) {
    if (!ARCHIVE_FILE_RE.test(p.split('/').pop())) continue
    const src = read(p)
    if (typeof src === 'string' && src.includes(marker)) return p
  }
  return null
}

/**
 * 按当次判定面选出归档豁免函数:`--staged` 判索引、全量与人工档判 HEAD 树。
 * 与「内容面」同面是刻意的 —— 豁免所依据的归档副本必须是这次提交真的带得走(或已入库)的那份,
 * 而不是盘上随后被谁改过的那份。`--worktree` 也走 HEAD 树:磁盘面从来不是归档凭据(G-183)。
 */
export function archiveExemptFor(isStaged, root = ROOT) {
  const face = isStaged ? 'staged' : 'head'
  return (marker) => archivedCopy(marker, { face, root })
}

/**
 * 丢失清单里排除"已归档"的那些(§1 归档 = 正当移除)。
 * `archived` 可注入,使"归档放行"这条豁免能被取证而不必往真仓 archive 目录写文件。
 */
export function dropArchivedLost(lost, archived = archivedCopy) {
  return lost.filter((x) => !archived(x.marker) && !(x.id && archived(x.id)))
}

/**
 * 丢失清单里的**标题级**条目(`## O42 …` 这种任务条目标题)。
 * 单独点名是因为它的后果与丢一条 bullet 不同:整节层级被连根拔掉,而 --heal 只会逐行回捞,
 * 补不回"标题 + 其下正文"的从属关系 —— 报告必须把这一层能力边界说清楚,不得装作已自愈。
 */
export function headingLosses(lost) {
  return lost.filter((x) => x.shape === 'heading')
}

/**
 * 内容面统一走取材层的 `cat-file --batch`(2026-09-25 迁移)。
 * 规格里 `<rev>:` 前缀决定面:`:PLAN` = 索引、`HEAD:PLAN` = 提交树、`<sha>:PLAN` = 历史版本;
 * **冒号不可省** —— 省了就是拿裸路径问 cat-file,每个版本都"不存在",于是本闸的
 * "从历史回捞"会静默变成"无登记行可回捞"(= 判据对整类丢失失明)。
 */
function readSpec(spec, root = ROOT) {
  const v = catBatch(root, [spec], { timeout: GIT_TIMEOUT }).get(spec)
  if (typeof v !== 'string') throw new Error(`取材面 ${spec} 取不到内容`)
  return v
}

function readSpecOrNull(spec, root = ROOT) {
  try {
    return readSpec(spec, root)
  } catch {
    return null
  }
}

/**
 * 纯选择(自检据此**构造**"索引面 ≠ HEAD 面 ≠ 磁盘面"的现场,不依赖真仓瞬时状态):
 *  - `staged`  取索引 blob —— 那才是这次提交真正带走的一份;
 *  - `head`    取 HEAD blob —— 全量档的**唯一**被审面;
 *  - `worktree` 取磁盘副本 —— 只作人工排查,绝不默认。
 *
 * 为什么全量档不得读磁盘(2026-09-26 收口,与守门 77/83/94/118 同一口径):本仓是多会话
 * 共享工作区,工作树副本常年滞后/分叉于 HEAD。旧实现在全量档把"待提交内容"取成磁盘副本,
 * 于是它回答的是"我的工作树比 HEAD 少了哪几行" —— 一道**与任何提交都无关**的红,
 * 而它给的出路("从 HEAD 逐行取回后再提交")照做就是覆盖别人未提交的在飞内容(§12 禁止动作)。
 * 实测:HEAD 里 `^- [ ] \*\*守门 128` 计数为 1,该档却 rc=1。恒红门的结局永远是 `--no-verify`。
 */
export function pickPlanContent({ face, readIndex, readHead, readDisk }) {
  if (face === 'staged') return readIndex(PLAN)
  if (face === 'worktree') return readDisk(PLAN)
  return readHead(PLAN)
}

function candidateContent(face, root = ROOT) {
  return pickPlanContent({
    face,
    // 暂存区里没有该文件(本次不改计划文档)→ 返回 null,调用方据此无需比对
    readIndex: () => readSpecOrNull(`:${PLAN}`, root),
    readHead: () => readSpecOrNull(`HEAD:${PLAN}`, root),
    // 磁盘面走取材层:它把"读失败"抛成 Undetermined,而不是伪装成"该文件不存在"的业务结论
    readDisk: () => readWorktreeFile(root, PLAN),
  })
}

/**
 * 三面判据的总入口。
 * @param isStaged  提交链形态(索引 vs HEAD)—— 语义与收口前**一字未动**
 * @param faceOverride 非提交链时选 `head`(缺省)或 `worktree`(人工逃生舱)
 * @param opts.root 取证通道:临时 git 仓构造"三面互异"的现场用;生产调用点不传 ⇒ 默认仓库根
 * @returns {{face:string, ok?:boolean, lost?:Array, prose?:{lostCount:number,sample:string[]}|null,
 *            malformed?:{added:Array,preexisting:Array,red:boolean,undetermined?:boolean},
 *            undetermined?:boolean, reason?:string, scanned?:number}}
 */
export function runCheck(isStaged, faceOverride, { root = ROOT, strict = false } = {}) {
  const face = isStaged ? 'staged' : faceOverride || 'head'
  const candidate = candidateContent(face, root)
  if (candidate === null) {
    // 暂存区里根本没有该文件 = 本次提交不动计划文档,无需比对(既有语义,保持不变)
    if (face === 'staged')
      return { ok: true, lost: [], collected: [], face, prose: null, malformed: { added: [], preexisting: [], red: false } }
    // 其余两面取不到 ⇒ **无法判定**:既不记绿也不冒红。无提交 / 浅克隆 / git 失败都落这一支。
    return {
      undetermined: true,
      face,
      reason: `${FACE_LABEL[face] ?? face} 取不到 ${PLAN}(无提交 / 浅克隆 / git 失败)—— 无法判定,不算通过也不算违规`,
    }
  }
  // 归档豁免必须绑**当次判定面 + 当次根**(镜像测试里那条反向锁):staged ⇒ 索引,head/worktree ⇒ HEAD 树
  const archive = archiveExemptFor(face === 'staged', root)
  let lost
  /** 第三形态「已收拢」的当轮读数(2026-10-24):凭漂移注释认下来的那些行,逐条点名用。 */
  const collected = []
  let reportOnly = []
  let prose = null
  let malformed
  let scanned = 0
  /** 归并名额维的结果(2026-10-24 立,**刻意只挂提交链**):
   *  folded=本次掉了名额的编号;foldUndeclared=其中没拿到当次声明的;foldUnused=声明了但本次没掉名额的。
   *  不接全量/人工档:旁路落地(§1 的 live-doc-edit / union-converge / 自愈)不跑钩子,而它们正是
   *  同号多行的主要生产者 ⇒ 挂上去就是把与本次提交内容无关的存量钉红(§12e 恒红门禁令)。 */
  let folded = []
  let foldUndeclared = []
  let foldUnused = []
  let foldDeclaredIds = []
  if (face === 'staged') {
    const baseline = readSpec(`HEAD:${PLAN}`, root)
    lost = dropArchivedLost(lostMarkers(baseline, candidate, new Set(), collected), archive)
    // 叙述行差值:提交链上是"索引 vs HEAD"(与收口前同一对输入,只报数不判红)
    prose = proseLossReport(baseline, candidate)
    // 编号形态维(G-722):同一对输入(索引 ⊖ HEAD),只判本次新增
    malformed = malformedReport(face, candidate, baseline)
    folded = foldedSlots(baseline, candidate).filter(
      // 归档豁免**先行**,且用的是与丢失维 dropArchivedLost 同一把尺子(§0.6 单源):原文在**已入库**
      // 归档件里逐字可寻、或该编号在归档件里出现过 ⇒ 已有正当移除凭据,不得再收第二次费(§12e)。
      (f) => !f.markers.some((m) => archive(m)) && !archive(f.id),
    )
    foldDeclaredIds = parseMergeFoldDeclaration(process.env.IHUI_PLAN_MERGE_FOLD)
    foldUndeclared = folded.filter((f) => !foldDeclaredIds.includes(f.id))
    // 空声明也点名:声明必须是"当次真掉了名额"的那些编号,否则这个 env 就成了万能跳门(§0.10)。
    foldUnused = foldDeclaredIds.filter((d) => !folded.some((f) => f.id === d))
  } else {
    // 全量档问的是本来那个问题:**最近历史里已入库的登记行,在被审面上是否仍在**
    // (与 --heal 共用同一把尺子 missingFrom,不另写一份判据;豁免面同样是当次面)
    let seen
    try {
      seen = historyMarkers(historyDepth(), root)
    } catch (e) {
      // 历史面问不出来(无提交 / 浅克隆 / git 失败)⇒ 无法判定。这里必须 catch 住派生失败:
      // 让它冒到 CLI 会被打成"检查失败",而"我读不到历史"与"读到的历史里没有丢行"是两件事。
      return {
        undetermined: true,
        face,
        reason: `历史面无法取材:${e?.message ?? e} —— 无法判定,不算通过也不算违规`,
      }
    }
    scanned = seen.size
    if (scanned === 0) {
      return {
        undetermined: true,
        face,
        reason: `历史面未枚举到任何受保护登记行(无提交 / 浅克隆 / 该仓计划文档不含编号族)—— 空扫不是通过`,
      }
    }
    const all = missingFrom(seen, candidate, archive, undefined, collected)
    /**
     * 全量/人工档把 `multiSlot` 那一类**分出来只报数**(2026-09-27):同编号仍有登记点的丢失,
     * 机器无从判断是"被吞"还是"正当改号/归并"——判红就是拿别人欠的、且**必须由人工归并才能清**的账
     * 把每次人工问责钉红(§12e 同型);而静默省略又等于"把没判写成判过了"。所以:逐条点名 +
     * 独立计数 + `--strict` 才判红。`--staged` 走不到这里 —— 那一档的基线就是 HEAD,
     * 少一行必然是**本次提交**造成的,照旧判红(镜像用例端到端钉着)。
     */
    const auto = all.filter((e) => !e.multiSlot)
    const manual = all.filter((e) => e.multiSlot)
    lost = strict ? all : auto
    reportOnly = manual
    // 人工档与工作树同问"磁盘 vs HEAD";HEAD 档另把同一差值作为**旁证**报数(不参与判定):
    // 它说的是"你的工作树滞后多少行",与"HEAD 里丢没丢"是两件事,不得混成一个结论。
    const disk = candidateContent('worktree', root)
    const base = readSpecOrNull(`HEAD:${PLAN}`, root)
    if (disk !== null && base !== null) prose = proseLossReport(base, disk)
    /**
     * 编号形态维(G-722)在历史面的两支:head ⇒ 锚点是 HEAD 自身存量,只报数不判红;
     * worktree ⇒ 人工档按"磁盘 ⊖ HEAD"判新增(base 取不到时 malformedReport 判未判定,不记通过)。
     */
    malformed = malformedReport(face, candidate, base)
  }
  return {
    ok:
      lost.length === 0 &&
      !(malformed && malformed.red) &&
      foldUndeclared.length === 0 &&
      foldUnused.length === 0,
    lost,
    collected,
    face,
    prose,
    malformed,
    scanned,
    window: lastHistoryWindow(),
    reportOnly,
    folded,
    foldUndeclared,
    foldUnused,
    foldDeclaredIds,
  }
}

/**
 * 历史面**覆盖范围必须报名**(2026-09-27):本闸只沿最近若干枚"改动过计划文档的提交"扫,
 * 窗口之外被吞掉的行结构上看不见。旧版只印"历史面登记行 N 条",拿到数字的人无从判断
 * "多久以前的丢失已经不在射程内" —— 与本仓反复记过的"只报数不报名"同一条禁令
 * (守门 128 配对判据那一格:射程边界必须跟读数一起说)。
 * 取不到窗口(未跑历史面 / staged 档 / 派生失败)⇒ 明写"未判定",不得静默省略这一句。
 */
export function historyWindowNote(window, face) {
  if (face === 'staged') return ''
  if (!window) return '历史面覆盖范围:未判定(没跑过 historyMarkers,不得据此说"全都看过了")'
  if (!window.commits) return '历史面覆盖范围:未判定(窗口内一枚提交都取不到)'
  // 已勾销计数也必须跟着报名:它说明"这一格里有多少登记是被'完成即删'正当摘掉的",
  // 少了这句话,读数就只回答"还剩几条"、不回答"为什么比上一轮少了"。
  const retiredNote =
    typeof window.retired === 'number' ? `,已按最新形态勾销 ${window.retired} 条` : ',已勾销数未判定'
  return `历史面取材窗口:最近 ${window.commits} 枚改动 ${PLAN} 的提交(至 ${window.oldest ?? '?'}${
    window.oldestDate ? ` @ ${window.oldestDate}` : ''
  };更早的被吞行不在射程内${retiredNote})`
}

/**
 * 人工档的工作树提示 —— 抽成纯函数的理由是"这句话必须能被取证":它写在 CLI 里,而 CLI 只在有人
 * 真跑时才执行;判据改错一次(比如哪天把缺省面又换回磁盘)这句话就会静默消失。故 self-test 直接
 * 钉它的**存在与措辞**,端到端测试再钉"CLI 确实把它打出来了"(两道各管一格,缺一格就是假绿)。
 * @returns {string|null} 只有 worktree 面返回警告语,其余面返回 null(不得替别人发声)
 */
export function faceNoticeFor(face) {
  if (face !== 'worktree') return null
  return (
    '⚠️ [plan-line-loss] 你在审**工作树磁盘副本**:这里报出的红点与任何提交都无关,\n' +
    '   缺的行多半仍在 HEAD 里(自证:`git show HEAD:PROJECT_PLAN.md | grep -c "<标记>"`)。\n' +
    '   **不要照下面的 1) 去"从 HEAD 取回再提交"** —— 那会把别人未提交的在飞内容整批覆盖掉(§12)。\n' +
    '   要判"已入库的登记行还在不在",跑不带旗号的缺省档(HEAD blob)。'
  )
}

/**
 * **编号形态维(G-722)**:畸形登记编号 = 族名在编号段出现两次。判据(两条正则与其编排
 * `findMalformedIds` / `newMalformed`)只在 `scripts/lib/plan-task-index.mjs` 有一份实现,本函数
 * **只做"按面选基准"的编排**,门体内再抄一份形态正则即违反镜像形状锁。
 * 三档口径与本门其余判据同形:
 *  - `staged`   索引 ⊖ HEAD ⇒ 本次新增即判红(提交链真正带走的那一份在这里被审);
 *  - `worktree` 磁盘 ⊖ HEAD ⇒ 人工逃生舱同样判新增;HEAD 基准取不到 ⇒ **未判定**
 *    (不冒红也不记绿 —— 把"没基准"写成"没有新增"就是本仓最高频的失效型);
 *  - `head`     锚点 = 该文件 HEAD 自身存量 ⇒ **结构上不判新增,只报名存量**(§12e:
 *    与任何提交都无关的红唯一结局是逼人 --no-verify、连带废掉全部守门)。
 */
export function malformedReport(face, candidateSrc, baselineSrc) {
  if (face === 'head') {
    // 形状归一(2026-09-29):findMalformedIds 给 `{line: 文本, family}`,而 newMalformed 走
    // findMalformedRows 给 `{line: 数字行号, raw, family}` —— 两个形状共用同一个打印点时,后者会印成
    // **裸行号**(§1 明令行号不得进证据文本:它每次 append 都挪位)。这里把覆盖面保持为文本扫那一把
    // (全行扫,不止条目行 ⇒ 不缩网),只把形状统一成 `{raw, family}` 交给唯一出口 malformedLine 去点名。
    return {
      added: [],
      preexisting: findMalformedIds(candidateSrc).map((x) => ({ raw: x.line, family: x.family })),
      red: false,
    }
  }
  if (typeof baselineSrc !== 'string') {
    return { added: [], preexisting: [], red: false, undetermined: true }
  }
  const m = newMalformed(baselineSrc, candidateSrc)
  return { added: m.added, preexisting: m.preexisting, red: m.added.length > 0 }
}

/**
 * 扫最近 N 个提交的计划版本,收集登记行,找出当前内容里已消失的那些。
 * (并发"旧基线整文件提交"与 git-sync-converge 的索引层合并都可能把别人的行合掉;
 *  本函数是"从历史回捞"的通用手段,不依赖是谁、哪一枚提交弄丢的。)
 * 同时记下每行在历史里的**前一行**,回插时用得上。
 */
/**
 * 扫最近 N 个提交的计划版本,收集登记行(含每行在历史里的**前一行**,回插时用得上)。
 * 单独拆出来是因为同一份历史要和两个目标比对:工作区、HEAD(见 heal)。
 * `root` 只为取证通道(临时仓构造历史)而设;生产调用点一律走默认仓库根。
 */
/**
 * 历史面窗口枚数(2026-09-27 加,默认值刻意不变)。
 * 判"要不要深挖"用的是**实测成本**,不是感觉:本仓每天约 1000 枚提交,而 `PROJECT_PLAN.md`
 * 单份 blob 实测约 1.2 MB —— 窗口从 60 抬到 400 就是约 500 MB 的批量读,挂在 pre-commit 上
 * 等于把每次提交变成磁盘压力测试(守门 80 立的那条"派生不得无界"同型)。所以默认仍是 60,
 * 但把两件事改了:① 窗口按**改动过 PROJECT_PLAN.md 的提交**数(同样成本覆盖约 1.7 倍计划史);
 * ② 覆盖范围必须**报名**(见 lastHistoryWindow),不得让"60 枚之前的事看不见"读成"都看过了"。
 * `IHUI_PLAN_LOSS_HISTORY_DEPTH` 为人工深挖通道(CI / 巡检),非法值回落默认,绝不因配置错而放行。
 */
export const HISTORY_DEPTH_DEFAULT = 60
export const HISTORY_DEPTH_MAX = 400
export function historyDepth() {
  const raw = process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH
  if (raw === undefined || raw === '') return HISTORY_DEPTH_DEFAULT
  const v = Number(raw)
  return Number.isInteger(v) && v > 0 && v <= HISTORY_DEPTH_MAX ? v : HISTORY_DEPTH_DEFAULT
}

/**
 * 已结清短留痕(2026-10-25 立,承 10f2378e 的 G-61 诊断)。
 *
 * 病型:`historyMarkers` 的 `retired` 只在**最近 60 枚改动过台账的提交**窗口内可见。
 * 多会话并发时一分钟能推十几枚,一次翻勾几分钟就掉出射程;窗口里只剩更早的未勾形态 ⇒
 * 被当成"最新开放形态"复插成未勾,结清态**静默丢失**且无人喊。
 *
 * 处置:把每次 heal 在窗口里观察到的 `retired` 落盘(短 TTL 30 天),heal 在窗口外也按它
 * 拒绝复插。留痕只服务"已勾销"这一个方向,不改变窗口内配平状态机的任何判据。
 * 取不到/坏行 ⇒ 空集(该维不生效,窗口内行为与改前逐字一致),不把"没读到"读成"没结清"。
 */
export const RETIRED_LEDGER_REL = path.join('.ihui-agent', 'state', 'plan-retired.jsonl')
export const RETIRED_LEDGER_TTL_DAYS = 30
let LAST_HISTORY_RETIRED = null
export function lastHistoryRetired() {
  return LAST_HISTORY_RETIRED
}
function retiredLedgerAbs(root) {
  return path.join(String(root || ROOT), RETIRED_LEDGER_REL)
}
export function retiredMarkerSet(root = ROOT) {
  let text = ''
  try {
    text = readFileSync(retiredLedgerAbs(root), 'utf8')
  } catch {
    return new Set()
  }
  const cutoff = Date.now() - RETIRED_LEDGER_TTL_DAYS * 24 * 3600 * 1000
  const out = new Set()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const o = JSON.parse(line)
      if (typeof o?.marker !== 'string' || !o.marker) continue
      const t = Date.parse(o.at)
      if (Number.isFinite(t) && t < cutoff) continue
      out.add(o.marker)
    } catch {
      /* 坏行不改变判据:短留痕是加速器,不是唯一真相 */
    }
  }
  return out
}
export function recordRetiredMarkers(markers, root = ROOT) {
  const list = [...(markers ?? [])].filter((m) => typeof m === 'string' && m)
  if (!list.length) return 0
  const have = retiredMarkerSet(root)
  const add = list.filter((m) => !have.has(m))
  if (!add.length) return 0
  try {
    const abs = retiredLedgerAbs(root)
    mkdirSync(path.dirname(abs), { recursive: true })
    appendFileSync(abs, add.map((m) => JSON.stringify({ at: new Date().toISOString(), marker: m })).join('\n') + '\n', 'utf8')
    return add.length
  } catch {
    return 0
  }
}

/** 上一次 historyMarkers 实际覆盖到的窗口(供报告"报名");没跑过就是 null,不得伪造。 */
let LAST_HISTORY_WINDOW = null
export function lastHistoryWindow() {
  return LAST_HISTORY_WINDOW
}

export function historyMarkers(depth = historyDepth(), root = ROOT) {
  // 只枚举**改动过计划文档**的提交 ⇒ 同样的 blob 读量覆盖更长的计划史(未改动的那些枚
  // 与前一枚同 blob,读它们是白付钱)。HEAD 自己也单独喂进去一次:计划文档在 HEAD 上
  // 未改动时它不在 path-filter 清单里,而"当次面上仍在本闸射程内"这句话必须以 HEAD 为准。
  const shas = [
    ...new Set(
      [
        (() => {
          try {
            return git(['rev-parse', 'HEAD'], root).trim()
          } catch {
            return ''
          }
        })(),
        ...git(['rev-list', `--max-count=${depth}`, 'HEAD', '--', PLAN], root)
          .trim()
          .split(/\r?\n/)
          .filter(Boolean),
      ].filter(Boolean),
    ),
  ]
  const seen = new Map()
  // 每个 marker 的"最新开放形态"那一行(基线候选);是否真进 `seen` 由下面的配平状态机决定。
  const newest = new Map()
  // 已勾销的 marker(2026-10-18 立):窗口内每一条开放行的消失都被"翻勾成已勾行"配平了 ⇒
  // 这条登记已按"完成即删"结案,更深历史里的未勾副本不得再把它种回保护集(否则每删一行被还原一次)。
  const retired = new Set()
  // 一次批量读满整个窗口(迁移前是逐 sha 各开一次 `git show`,60 次派生)
  const specs = shas.map((sha) => `${sha}:${PLAN}`)
  let historic
  try {
    historic = catBatch(root, specs, { timeout: GIT_TIMEOUT })
  } catch {
    historic = new Map()
  }
  // 覆盖范围报名:窗口最旧那一枚的时刻,让人一眼看出"多久以前的丢失已经看不见"
  LAST_HISTORY_WINDOW = {
    depth,
    commits: shas.length,
    oldest: null,
    oldestDate: null,
    retired: 0,
  }
  if (shas.length) {
    LAST_HISTORY_WINDOW.oldest = shas[shas.length - 1].slice(0, 9)
    try {
      LAST_HISTORY_WINDOW.oldestDate = git(['show', '-s', '--format=%ci', shas[shas.length - 1]], root)
        .trim()
        .slice(0, 10)
    } catch {
      LAST_HISTORY_WINDOW.oldestDate = null
    }
  }
  // 每枚提交的 marker → {开放行数, 已勾行数} 计数表(与 shas 同序 = 由新到旧);
  // 供下面那台"配平"状态机按时间正序走一遍用。
  const countsPerCommit = []
  for (let i = 0; i < shas.length; i++) {
    const sha = shas[i]
    const src = historic.get(specs[i])
    countsPerCommit.push(new Map())
    if (typeof src !== 'string') continue
    const rows = src.split(/\r?\n/)
    // 一趟解析(每行只算一次身份):开放形态与已勾形态各归一路。
    const parsed = rows.map((line) => {
      const reg = registrationOf(line)
      if (reg) return { reg, closed: null }
      const closed = closedRegistrationOf(line)
      return closed ? { reg: null, closed } : null
    })
    const counts = countsPerCommit[i]
    // 内层索引刻意命名 k:批量读迁移时外层丢掉了 `const sha`,而 forEach 的 `i` 又把外层计数器
    // 遮住 ⇒ `sha` 未定义 ⇒ `--heal` 每次抛 ReferenceError。post-commit 写着 || true,于是整条
    // 自愈层静默失效(本节下方那段"自愈提交自上线起从未成功过"的同型)。
    parsed.forEach((p, k) => {
      if (!p) return
      const marker = (p.reg || p.closed).marker
      const e = counts.get(marker) || { open: 0, closed: 0 }
      if (p.reg) {
        e.open += 1
        // 由新到旧:第一枚含该 marker 开放形态的面即为"最新开放形态",留作基线条目(现行为不变)
        if (!newest.has(marker)) {
          let prev = null
          for (let j = k - 1; j >= 0; j--) {
            if (rows[j].trim()) {
              prev = rows[j]
              break
            }
          }
          newest.set(marker, {
            line: rows[k],
            marker,
            id: p.reg.id,
            shape: p.reg.shape,
            sha,
            prev,
          })
        }
      } else {
        e.closed += 1
      }
      counts.set(marker, e)
    })
  }
  // 配平状态机(2026-10-18 立,按时间**正序**走窗口):一条开放行的消失只允许两种正当去处 ——
  // 要么还在(计数不减),要么被翻勾成已勾行(同一枚提交里 closed 配上 open 的减量)。
  // 减了却没配上 ⇒ 记一笔"无凭据的减少"。判定:
  //   最新一仍开放 ⇒ 保护(与改前逐字同形);
  //   无凭据减少 > 翻勾次数 ⇒ 仍保护(例:同编号里那条开放行被摘走、已勾行本来就在 ⇒ 这不是翻勾);
  //   否则 ⇒ 勾销(翻勾后整行删除 = 机主 2026-10-16「完成即删」的正当移除,不再回捞)。
  // ⚠️ 刻意不用"最新形态是不是已勾"这一条粗判:它在"同族里一条开放行被吞、已勾行仍在"这一型上
  // 会把整族永久摘出保护集(镜像测试第三条臂实测抓出),而那正是本门立项要防的事故型。
  for (const [marker, entry] of newest) {
    let open = 0
    let closed = 0
    let unexplained = 0
    let flips = 0
    for (let i = countsPerCommit.length - 1; i >= 0; i--) {
      const c = countsPerCommit[i].get(marker)
      const nowOpen = c ? c.open : 0
      const nowClosed = c ? c.closed : 0
      const drop = open - nowOpen
      if (drop > 0) {
        const rise = Math.max(0, nowClosed - closed)
        const paired = Math.min(drop, rise)
        flips += paired
        unexplained += drop - paired
      }
      open = nowOpen
      closed = nowClosed
    }
    if (open > 0 || unexplained > flips) seen.set(marker, entry)
    else retired.add(marker)
  }
  LAST_HISTORY_WINDOW.retired = retired.size
  LAST_HISTORY_RETIRED = retired
  return seen
}

/**
 * 编号纪元(2026-10-24):被审面自带 `<!-- 编号纪元:YYYY-MM-DD … map=<路径> -->` 时,
 * 本门的身份尺从"编号字符串逐字"换成"编号按映射折算后的字符串"。
 *
 * 为什么必须换:全量重排后**同一任务的编号必然变**,而本门的基线(最近历史里的登记行)拿的是
 * 旧号 —— 不折算就会把每一条在册行都读成"被别人吞了";后果不止报红:自愈层(`--heal`)会按
 * 同一把尺子把旧号行**回插**进工作树,于是重排成果被自己的守护链反复回滚(本机 2026-10-24
 * 实测:重排落盘后 5 分钟内被 heal 整篇还原成旧号混合态,三次)。
 *
 * 折算方向与门 211/234 一致:只换"号",正文其余逐字不动 ⇒ 正文改一个字仍判新/判丢。
 * 无标记 ⇒ `null` ⇒ 与改动前逐字同行为(自测含反向锁)。
 */
export function epochMapOf(src) {
  const m = /<!--\s*编号纪元[:：][^>]*?map=([^\s>)(]+)/.exec(String(src || ''))
  if (!m) return null
  try {
    const doc = JSON.parse(readFileSync(path.resolve(ROOT, m[1]), 'utf8'))
    const pairs = Object.entries(doc?.map ?? {})
    return pairs.length ? new Map(pairs) : null
  } catch {
    // 映射读不到 ⇒ 不假装能折算(§0.3):照旧按逐字口径判,红也红得明白
    return null
  }
}

const EPOCH_ID_RE = /\b(?:G|WP|V3|D|O|A|B|P|W)-?\d{1,6}\b/g

/**
 * 抹掉退役标记、把编号按映射折算;正文其余字符一字不动。
 *
 * `bareIds` 是**方向**而不是风格:历史面(纪元前的原文)的号全是裸号 ⇒ 必须整体折算;
 * 被审面(纪元后的正文)里**裸号是新号**,只有紧跟 `〔旧号〕` 的那些才是退役引用 ⇒
 * 整体折算会把 `G-17` 这种"老号新用"的新号一起改掉,两端立刻对不上(实测 1 枚误报)。
 */
export function translateIds(text, map, { bareIds = null } = {}) {
  if (!map) return String(text ?? '')
  let s = String(text ?? '')
  const hasMark = /〔旧号/.test(s)
  s = s.replace(/((?:G|WP|V3|D|O|A|B|P|W)-?\d{1,6})〔旧号[^〕]*〕/g, (_m, id) => map.get(id) ?? id)
  // 标记被 18 字截断时可能只剩 `〔旧号…` 或裸 `〔`(没有收口括号)⇒ 连未收口的尾括号一起抹,
  // 否则折算后两端对不上(实测 5 枚误报全属这一型:标记截断点落在退役标记或注记中间)
  s = s.replace(/〔旧号[^〕〕]*〕/g, '')
  s = s.replace(/〔[^〕]*$/g, '')
  // 裸号只在**整段都没有退役标记**时才整体折算(那段必是纪元前原文);一段里只要出现过
  // `〔旧号〕`,它的裸号就是新号 —— 整体折算会改掉"老号新用"的新号(实测 1 枚误报)。
  if (bareIds === true || (bareIds === null && !hasMark))
    s = s.replace(EPOCH_ID_RE, (t) => map.get(t) ?? t)
  return s
}

/**
 * 题面前缀身份(纪元档专用):抹掉复选框、注记、行内标头、退役标记与所有任务号,再去掉
 * 标点/加粗/空白,取前 12 字。号与标头怎么变都不影响,**正文首句一变就换身份**。
 */
export function bodyKeyOf(text) {
  return String(text ?? '')
    .replace(/^\s*[-*]\s*/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/^\s*（[^）]*）\s*/, '')
    .replace(/^\s*〔[^〕]*〕\s*/, '')
    .replace(/〔旧号[^〕]*〕/g, '')
    // 2026-10-24:族表补 H / I。此前只抹 G|WP|V3|D|O|A|B|P|W —— 编号纪元把 G 族溢出到 H 族
    // (满 99 后开新字母族,永不升位数),H 号不抹 ⇒ 换号后的行题面前缀以 `H0N…` 开头,
    // 与历史标记(已抹旧号)前缀对不上 ⇒ 门 71/自愈把**正常改名**读成"整行丢失",按旧号回捞,
    // 于是同一任务在台账里出现两份(实测 G-38/H04、G-46/H05、G-865/H06 三对,并引出重复登记清偿轮次)。
    // 抹号表与编号纪元实际使用的族表必须同一份;I 是 D 族满池后的溢出族(暂未用,先备齐)。
    // 位数上限同日从 4 放到 6:`D42046` 这类六位号在 {1,4} 下只被吃掉前 5 个字(`D4204`),
    // 余下的末位 `6` 留在题面前缀首位 ⇒ 该行换成 D14 后两面 key 变成 `6断线…` vs `断线…`,
    // 前缀判活当场判"丢失",自愈再按旧号回插(2026-10-24 实测:换号提交被 3f459f3ba4 回捞还原)。
    // ID 族表本身(`TASK_ID_PATTERN`)用的是无上限 `\d+`,此处与之对齐,不再自留一个更窄的位数。
    .replace(/(?:WP|V3|G|D|O|A|B|P|W|H|I)-?\d{1,6}/g, '')
    .replace(/[*`\s]/g, '')
    .slice(0, 12)
}

/** 历史登记行里在 targetSrc 中缺席的那些(归档过的正当移除自动排除) */
export function missingFrom(seen, targetSrc, archived = archivedCopy, declared = declaredRowSet(), collectedSink = null, retired = retiredMarkerSet()) {
  // 编号纪元下按映射折算两面(见 epochMapOf 头注);无标记时 map=null ⇒ 逐字旧行为
  const map = epochMapOf(targetSrc)
  const back = new Map()
  const entries = [...seen.values()].map((v) => {
    if (!map || !v) return v
    const marker = translateIds(v.marker, map)
    back.set(marker, v.marker)
    return {
      ...v,
      marker,
      id: v.id ? (map.get(v.id) ?? v.id) : v.id,
      // 漂移注释里的编号常写成"裸旧号"(纪元折算只动紧跟 `〔旧号〕` 的那些,见 translateIds 头注),
      // 于是折算后的 id 与注释面上的号可能一个是新号、一个是旧号 ⇒ 第三形态两号都认,
      // 认的还是**同一枚编号的两种写法**,不是"任意编号都算"。
      idAlt: v.id,
      line: typeof v.line === 'string' ? translateIds(v.line, map) : v.line,
    }
  })
  const target = map ? translateIds(targetSrc, map, { bareIds: false }) : targetSrc
  // 纪元档按"题面还在不在"判活(2026-10-24):全量重排会把旧号换掉,也允许旧号被新票复用,
  // 于是"号 + 18 字题面逐字相同"不再是同一任务的判据。这里把两面都抹掉号与标头后按题面前缀比 ——
  // 换号/标头增删都不影响,**正文真被吞掉仍会点名**。映射折算于是只服务于 message 还原,
  // 不再决定判活(映射文件每轮重排都会重写,拿它当判活尺子会把历史旧号折算成不存在的号)。
  const liveBodies = map
    ? [...target.matchAll(/^\s*[-*]\s[^\n]*/gm)].map((m) => bodyKeyOf(m[0])).filter(Boolean)
    : null
  // 与 lostMarkers / healContent 同一把尺子(名额判活),否则"检测判丢、回捞说还活着"
  const lost = resolveRegistrationLoss(entries, target, declared, collectedSink, retired)
  // sink 里躺着的是**折算后**的编号;报名必须给读台账的人看面上的原号(与返回集同一口径)。
  if (collectedSink && map)
    for (const s of collectedSink) if (back.has(s.marker)) s.marker = back.get(s.marker)
  // 归档件里存的是**旧号原文** ⇒ 归档通道用折算前的 marker 问,别拿新号去翻旧档
  return lost
    .filter((v) => !(archived(back.get(v.marker) ?? v.marker) || (v.id && archived(v.id))))
    .filter((v) => {
      if (!liveBodies) return true
      const mk = bodyKeyOf(v.marker)
      // 抹号后只剩标点(如 `G-64~G-71` 这种**号段**标记)⇒ 这一枚无法判活:号段在全量重排后
      // 逐个换成新号并加了 `〔旧号段,见快照〕`,按题面比必然找不到。短边 <6 字一律不判,
      // 也不把"没判"写成"判过"(§0.3)—— 号段本身可从映射文件核对。
      if (mk.replace(/[^\p{L}\p{N}]/gu, '').length < 6) return false
      return !liveBodies.some((k) => k.length >= 6 && (k.startsWith(mk) || mk.startsWith(k)))
    })
    .map((v) => (back.has(v.marker) ? { ...v, marker: back.get(v.marker) } : v))
}

/**
 * 自愈的**比较目标**:同一把尺子 `missingFrom` 喂三个目标面(G-816708,2026-10-05 立)。
 *
 * 为什么必须有第三档(索引)而不是"调用方自己再判一次索引":
 * 旁路落地器(`object-space-land` / `live-doc-edit` / `plan-tasks-merge` / 收敛器)走的是
 * `commit-tree` + `update-index` —— 那一刻 HEAD 与共享主索引**同时**变成新内容,钩子结构性不跑。
 * 只看工作树 + HEAD 两档时,下一次提交真正带走的那一份(索引 blob)没有任何人比过;
 * 而判据一旦不在"真跑它的那一刻"覆盖那个面,就等于没有(§1 同一原则)。
 * 把索引档塞进本函数而不是塞进调用方,是为了让"什么算缺一条登记行"只有一份实现(§22c)。
 *
 * 三态纪律:`index === null`(索引面取不到:该路径不在索引里 / unmerged / git 问不到)是**未判定**,
 * 绝不折成"0 条缺失"—— 那正是本仓记过最高频的失效型(把没判写成判过了)。
 *
 * @param {Map} seen `historyMarkers()` 的基线
 * @param {{disk:string, head:string, index:string|null}} faces 三个目标面的正文
 * @returns {{disk:Array, head:Array, index:Array|null, indexUndetermined:boolean, allClean:boolean}}
 */
export function healLegs(seen, { disk, head, index }) {
  // 第三形态的读数逐档单记(与缺失同轮同面):"这一档里有几条是被收拢进漂移注释认下来的"。
  const sinkDisk = []
  const sinkHead = []
  const sinkIndex = []
  const legs = {
    disk: missingFrom(seen, disk, undefined, undefined, sinkDisk),
    head: missingFrom(seen, head, undefined, undefined, sinkHead),
    index: index === null ? null : missingFrom(seen, index, undefined, undefined, sinkIndex),
    indexUndetermined: index === null,
    collected: { disk: sinkDisk, head: sinkHead, index: index === null ? null : sinkIndex },
  }
  legs.allClean =
    legs.disk.length === 0 &&
    legs.head.length === 0 &&
    legs.index !== null &&
    legs.index.length === 0
  return legs
}

/**
 * 三档读数 ⇒ 逐档点名(纯渲染,不再判一次;`healLegs` 是唯一判据出口)。
 *
 * 为什么点名必须上 **stdout**:G-816708 之后自愈被落地器就地补跑,而派生层
 * (`scripts/lib/post-merge-ledger-sync.mjs`)只回读 stdout 里点名登记行的那些行 ——
 * 名字只写在 stderr 的话,落地那一刻的账面就只剩"跑过了"而没有任何缺失证据
 * (= "只报数不报名"那一型换个通道重演)。既有 stderr 那几行详情(回捞出处、处置、能力边界)
 * 一字不动:人读的那一份与机器读的那一份各留各的,读报告的人仍能看到 sha 与出路。
 *
 * @param {number} seenSize 基线登记行条数(射程读数,必须与缺失一起报名)
 * @param {object} legs `healLegs` 的返回值
 * @param {object|null} [loop] `loopTripsForMarkers` 的结果(G-307 票一③ 熔断)。
 *   在场且有命中时,工作树/HEAD 两档的报数行各带 `(可回捞 N / 熔断 M)` —— 报数必须把
 *   "缺多少"与"这轮还能动多少"分开,否则读数看起来像漏做了;**索引档不带**:它是只点名
 *   不写盘的档,既无自动动作可熔断,也照旧只报名。无命中时渲染与接入前逐字节一致。
 * @returns {string[]} 第一行是三档总读数,其后每档非绿一行(未判定单列,不并进"缺 0 条")
 */
export function healLegRoster(seenSize, legs, loop = null) {
  const count = (list) => (list === null ? '未判定' : `${list.length} 条`)
  const trippedSet =
    loop && loop.tripped && loop.tripped.length ? new Set(loop.tripped.map((t) => t.marker)) : null
  const tag = (list) => {
    if (!trippedSet || !list || !list.length) return ''
    const doable = list.filter((m) => !trippedSet.has(m.marker)).length
    return doable === list.length ? '' : `(可回捞 ${doable} / 熔断 ${list.length - doable})`
  }
  const lines = [
    `   [分档] 历史登记行 ${seenSize} 条 ⇒ 工作树副本缺 ${count(legs.disk)}${tag(legs.disk)} / HEAD 提交树缺 ${count(legs.head)}${tag(legs.head)} / 索引副本缺 ${count(legs.index)}` +
      `(三档含义不同:前者多为滞后的在飞副本,HEAD 才是已入库行被合掉,索引是下一次提交真要带走的那份)`,
  ]
  for (const [label, list] of [
    ['工作树', legs.disk],
    ['HEAD', legs.head],
    ['索引', legs.index],
  ]) {
    if (!list || list.length === 0) continue
    const shown = list
      .slice(0, 10)
      .map((m) => m.marker)
      .join(' / ')
    lines.push(
      `   [点名/${label}] 缺 ${list.length} 条登记行:${shown}${
        list.length > 10 ? ` …另有 ${list.length - 10} 条(逐条见本门 stderr 详情)` : ''
      }`,
    )
  }
  if (legs.indexUndetermined)
    lines.push('   [点名/索引] 索引面取不到 ⇒ 该档**未判定**(未判定不是"缺 0 条",更不是"无缺失")')
  /**
   * 第三形态的报名(2026-10-24):"没判成缺失"必须说清是**凭什么**没判 —— 收拢件的枚数与
   * 逐条编号上 stdout,否则读数只剩"缺 0 条",而"缺 0 条"既可能是真在册、也可能是被某条例外
   * 通道吃掉,两者在账面上同形就是本仓最高频的失效型(§12f)。0 枚时不打这一行(渲染逐字不变)。
   */
  const col = legs.collected
  if (col)
    for (const [label, list] of [
      ['工作树', col.disk],
      ['HEAD', col.head],
      ['索引', col.index],
    ]) {
      if (!list || !list.length) continue
      const shown = list
        .slice(0, 10)
        .map((m) => String(m.marker).slice(0, 24))
        .join(' / ')
      lines.push(
        `   [已收拢/${label}] ${list.length} 条登记行的原文只在 PROJECT_PLAN.md 的漂移注释里(编号+题面前 ${COLLECTED_TITLE_SPAN} 字逐字对上)` +
          ` ⇒ 判"在册",不判缺、不回捞:${shown}${list.length > 10 ? ` …另有 ${list.length - 10} 条` : ''}`,
      )
    }
  return lines
}

/**
 * **非登记行**的整行丢失计量(2026-09-24 补,本闸自身的覆盖面缺口)。
 *
 * 本闸只锚"编号登记行"(G-x/Dx/Px/Wx/守门 NN),而并发"按内存里旧计划文档整文件提交"
 * 抹掉的大头恰恰是**不带编号的正文 bullet**(条目内的进度叙述、收口说明)——
 * 实测本机 2026-09-24 04:5x:待提交内容与 HEAD 相比非登记行少 **813 行**,而登记行一条不少,
 * 于是本闸报绿、13c(只认任务标题行)报绿、门 65(只数文件数)报绿 ⇒ **静默**。
 * 门 71 自己的"无登记行丢失"这句绿灯,此前恰恰是这类事故的遮羞布。
 *
 * 刻意**只报数不阻塞**:改写措辞、段落重排、缩进归一都会命中同一形态,判红必然卡死
 * 他人的正常 PLAN 提交(AGENTS §12 明确禁止把他人改动变成全局阻塞)。报数进 stdout,
 * 由人(或后续把阈值接进 CI)决定要不要追。
 */
export function proseLossReport(baseSrc, targetSrc) {
  const kept = new Set(
    targetSrc
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  )
  const lost = []
  for (const raw of baseSrc.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (registrationOf(raw)) continue // 登记行由 missingFrom/lostMarkers 精确判,不重复计
    if (!kept.has(line)) lost.push(line)
  }
  return { lostCount: lost.length, sample: lost.slice(0, 3) }
}

/**
 * 扫最近 N 个提交的计划版本,找出当前内容里已消失的那些。
 * (并发"旧基线整文件提交"与 git-sync-converge 的索引层合并都可能把别人的行合掉;
 *  本函数是"从历史里回捞"的通用手段,不依赖是谁、哪一枚提交弄丢的。)
 */
export function collectMissing(targetSrc, depth = 60) {
  const seen = historyMarkers(depth)
  const missing = missingFrom(seen, targetSrc)
  return { total: seen.size, missing }
}

/**
 * 把丢失行插回:优先插到"它在历史里的前一行"之后(邻居今天还在 → 分组不散),
 * 邻居也没了就直接追加到文件末尾 —— 宁可位置不理想,也绝不丢掉内容。
 * 只改字符串,不碰工作区文件。
 */
/**
 * 规模安全闸阈值:一次回捞的"缺失登记行"占扫描总数超过此比例,即判为**基线异常**而非真丢。
 * 可用 IHUI_PLAN_HEAL_MAX_MISSING_RATIO 覆盖(0<r≤1);非法值回落默认,绝不因配置错而放行。
 */
export function healSuspectRatio() {
  const raw = process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO
  if (raw === undefined || raw === '') return 0.4
  const v = Number(raw)
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.4
}

/**
 * 2026-09-23 立,由本仓一次真实自伤事故反推(登记见 PROJECT_PLAN 的 O24 段):
 * 有会话对活文档做"全量 union 回补",独有行判据用整行文本差集 —— PLAN 在两分钟窗口内被
 * 并发重排改写措辞,使同一内容的新旧两个版本全落到"缺失"一侧,勘察时 59 行、执行时暴涨成
 * 1505 行,插回去就是 1543 行重复入库。**"零损失断言"只保证不删,不保证不重复**。
 * 本闸补的正是这后半句:真丢通常是几条到几十条(本日实测 1/2/4 条),一次丢"四成以上"
 * 几乎必然是比对基线错了,此时写盘的回捞只会把文档搅成两份真相 ⇒ 拒绝,交人工判。
 */
export function assessHealScale(missingCount, seenCount, ratio = healSuspectRatio()) {
  if (!(seenCount > 0)) return { ok: true, ratio: 0, reason: '无登记行可比对,规模闸不启用' }
  const r = missingCount / seenCount
  if (r > ratio) {
    return {
      ok: false,
      ratio: r,
      reason: `缺失 ${missingCount}/${seenCount} 条 = ${(r * 100).toFixed(1)}%,超阈值 ${(ratio * 100).toFixed(0)}%`,
    }
  }
  return { ok: true, ratio: r, reason: '' }
}

/**
 * ── 两层自动化的**互咬熔断**(2026-09-28 立,G-307 票一③)──────────────────
 *
 * 病根(现读复现,不是票面写的"正文截断在 `归因未定:` 处"—— 那一版早被改掉,而循环仍在跑):
 * 归并器翻勾旧形态把**说明插在正文前面** ⇒ 行首不再是编号 ⇒ 本门的 `registrationOf` 对这一行
 * 返回 null、`headIdSet` 里该编号消失 ⇒ `stillRegistered` 判"登记行消失" ⇒ post-commit 回捞层
 * 把**未翻勾原文**补回 ⇒ 门 130 的 F1 再红 ⇒ 再归并再插。两小时 12 枚 `自愈被回写` +
 * 12 枚 `自动回捞`、同一主键 G-256 被 6 枚提交反复回捞就是这么产出的。
 * 修法分两半:① **生产者侧**改写形态(正文留在行首 —— 见 `plan-tasks-merge.mjs` 的 rewriteFork,
 * 并由 `verifyMerge` 的门 71 存续性断言钉住);② 就是本层 —— 给循环本身装刹车,
 * 因为"根因已除"这句话在并发环境里从来不是事实(别人跳门、别的旧形态残留、别的会话带回旧基线
 * 都会让同一 marker 再进循环,而那时没有任何东西喊停)。
 *
 * 定级(§12e 的规矩照抄,不重新发明):熔断**不参与退出码**。自动档少做一件事不是错误,
 * 而一台与任何提交都无关的恒红门唯一结局是逼人 `--no-verify`、连带废掉全部守门。
 * 判不出(git 问不到 / 浅克隆 / 无提交 / 无父)⇒ **未判定**:照旧执行 + 大声点名原因,
 * 绝不把"没量到"读成"没有在循环",也绝不读成"在循环"。
 *
 * 触碰计数只认**两个自动层的产出提交**(提交信息前缀是唯一能把"机器写的提交"与"人写的提交"
 * 分开的信号,且它就在提交对象里,无需额外状态文件 = 无需会腐烂的登记表)。
 */
export const LOOP_WINDOW_COMMITS_DEFAULT = 12
export const LOOP_BREAKER_MIN_TOUCHES_DEFAULT = 3
/** 本仓两层自愈各自的提交信息前缀(唯一真相:两处 `commit-tree` 的 message 首行)。 */
export const AUTO_LAYER_SUBJECT_RE =
  /^(?:docs\(plan\): 自动回捞|fix\(plan\): 自愈被回写的任务状态副本)/
/** 一次熔断检查最多问多少个 marker(超出的照实报"未判定",不猜也不放行不吭声)。 */
export const LOOP_BREAKER_MAX_MARKERS = 24

function numFromEnv(raw, def) {
  if (raw === undefined || raw === '') return def
  const v = Number(raw)
  return Number.isInteger(v) && v > 0 ? v : def
}
export function loopWindowCommits() {
  return numFromEnv(process.env.IHUI_PLAN_LOOP_WINDOW_COMMITS, LOOP_WINDOW_COMMITS_DEFAULT)
}
export function loopBreakerMin() {
  return numFromEnv(process.env.IHUI_PLAN_LOOP_BREAKER_MIN, LOOP_BREAKER_MIN_TOUCHES_DEFAULT)
}

/**
 * 熔断判定的**纯函数部分**:给了触碰清单,是否该停?
 * 只有"来自自动层的提交"才计票(人工/归并出口 `--dedupe-*` 的提交是人在动,不该算循环)。
 * 单独抽出来是因为镜像测试要用**构造面**证明它有牙(真仓的提交数不是判据,是瞬时状态 ——
 * 守门 103 T12 那一课:证明行为只能用纯函数 + 构造面)。
 */
export function loopBreakerDecision(entries, min = loopBreakerMin()) {
  const auto = (entries ?? []).filter((e) => e && AUTO_LAYER_SUBJECT_RE.test(String(e.subject ?? '')))
  return { touches: auto.length, tripped: auto.length >= min, sample: auto.slice(0, 4) }
}

const LOOP_TOUCH_CACHE = new Map()
/**
 * 量某个 marker 在近 W 枚"碰过计划文档的提交"里被**自动层**触碰了几次。
 * 窗口用提交数而不是时间:`--since` 在两台机器时钟不一致时给出的答案会漂,而本判据要的
 * 恰好是"循环在跑"这个节奏感(两小时 24 枚那一型,用 12 枚提交窗口足以看见)。
 */
export function autoTouchesOfMarker(marker, { windowCommits = loopWindowCommits(), root = ROOT } = {}) {
  if (typeof marker !== 'string' || !marker) return { undetermined: 'marker 为空(无从计数)' }
  const key = `${root}\u0000${windowCommits}\u0000${marker}`
  if (LOOP_TOUCH_CACHE.has(key)) return LOOP_TOUCH_CACHE.get(key)
  const out = {}
  try {
    // 窗口取"近 W+1 枚动过计划文档的提交":第 W+1 枚就是左边界(它本身不算在窗口内)。
    // 这样**不需要** `oldest^` —— 而 `oldest^` 在"窗口覆盖到根提交"的仓里(独立仓夹具、新仓)
    // 必然失败,失败就会让熔断在最需要它的现场判不出(第一版就栽在这里:T19 的夹具仓
    // 只有 6 枚提交,窗口左端正是根提交 ⇒ 熔断静默不响,循环照跑)。
    const win = gitRaw(
      ['log', `-n${windowCommits + 1}`, '--format=%H%x09%s', '--', PLAN],
      root,
      { timeout: GIT_TIMEOUT },
    )
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [sha, ...rest] = l.split('\t')
        return { sha, subject: rest.join('\t') }
      })
    if (win.length < 2) {
      out.undetermined = `窗口内只有 ${win.length} 枚提交动过计划文档(浅克隆/新仓,无从判循环)`
      LOOP_TOUCH_CACHE.set(key, out)
      return out
    }
    // 窗口左端只有"它自己也有父提交"时才能用 `<oldest>^..HEAD` 这个 range。
    // 独立仓夹具、新克隆、或整段历史恰好只有 W 枚提交时,oldest 就是根提交 —— `oldest^` 直接
    // 报 unknown revision,取数失败被读成"未判定",于是熔断在**最需要它的现场静默不响**
    // (T19 第一版就是这么跑成"落地"而不是"熔断"的)。此时窗口=整段历史,不加 range。
    const oldest = win[Math.min(windowCommits, win.length) - 1].sha
    const hasParent = (() => {
      try {
        return gitRaw(['rev-parse', '--verify', '-q', `${oldest}^`], root, { timeout: GIT_TIMEOUT }).trim() !== ''
      } catch {
        return false
      }
    })()
    const rangeSpec = win.length >= windowCommits && hasParent ? `${oldest}^..HEAD` : null
    let hits
    try {
      hits = gitRaw(
        ['log', ...(rangeSpec ? [rangeSpec] : []), `-S${marker}`, '--format=%H%x09%s', '--', PLAN],
        root,
        { timeout: GIT_TIMEOUT },
      )
    } catch (e) {
      out.undetermined = `git log 取不到(${String(e?.message ?? e).split('\n')[0].slice(0, 90)})`
      LOOP_TOUCH_CACHE.set(key, out)
      return out
    }
    out.entries = hits
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [sha, ...rest] = l.split('\t')
        return { sha, subject: rest.join('\t') }
      })
    // 窗口首尾两枚都要算:range 的左端 `oldest^..` 含 oldest 本身
    out.window = win.length
    return out
  } finally {
    if (!LOOP_TOUCH_CACHE.has(key)) LOOP_TOUCH_CACHE.set(key, out)
  }
}

/**
 * 一批 marker ⇒ 哪些必须熔断。调用方(两层自愈)据此**跳过这些行的自动动作**并大声点名。
 * @returns {{tripped:Array<{marker:string,touches:number,commits:string[]}>,undetermined:Array<{marker:string,reason:string}>,notTripped:string[],checked:number,capped:number}}
 */
export function loopTripsForMarkers(markers, opts = {}) {
  const uniq = [...new Set((markers ?? []).filter(Boolean))]
  const capped = Math.max(0, uniq.length - LOOP_BREAKER_MAX_MARKERS)
  const tripped = []
  const undetermined = []
  const notTripped = []
  for (const marker of uniq.slice(0, LOOP_BREAKER_MAX_MARKERS)) {
    const got = autoTouchesOfMarker(marker, opts)
    if (got.undetermined) {
      undetermined.push({ marker, reason: got.undetermined })
      continue
    }
    const d = loopBreakerDecision(got.entries)
    if (d.tripped)
      tripped.push({
        marker,
        touches: d.touches,
        commits: d.sample.map((s) => `${String(s.sha).slice(0, 9)} ${s.subject.slice(0, 44)}`),
      })
    else notTripped.push(marker)
  }
  for (const marker of uniq.slice(LOOP_BREAKER_MAX_MARKERS))
    undetermined.push({ marker, reason: `超出单次熔断检查上限 ${LOOP_BREAKER_MAX_MARKERS}` })
  return { tripped, undetermined, notTripped, checked: uniq.length, capped }
}

/**
 * 本门自己的"接线自检"。
 *
 * 为什么必须有(2026-09-24):本门存在的理由就是"并发会话把别人已入库的登记行整文件回写掉",
 * 而它**自己没有任何东西看守注册块**。今天一天内共享工作树就被旧基线回写过多轮,
 * `guardian-runner.mjs` 里那道 id 71 注册块正是这类回写的普通牺牲品 —— 一旦被抹掉:
 *   · pre-commit 不再跑本门(提交裸奔,登记行开始丢);
 *   · CI 也不会发现(它不在提交链上);
 *   · 镜像测试**连红都不是** —— 它断言的是"本门编号在 runner 中恰好一次",摘线后
 *     该测试文件根本不会被调用。
 * 即"防丢门被摘掉"这件事本身不受任何门保护,只能自指。判据口径与守门 89 一致:
 * 按**内容**点名本脚本,且必须查满五处权威点 —— `.husky/pre-commit` 自 2026-09-22 起
 * 只是薄壳,只查它必然得出相反结论。
 */
export const WIRE_POINTS = [
  ['scripts/guardian-runner.mjs', 'guardian-runner 注册表'],
  ['scripts/lib/pre-commit-hook.js', 'pre-commit 真实逻辑'],
  ['.husky/pre-commit', 'pre-commit 薄壳'],
  ['.husky/post-commit', 'post-commit 自愈层'],
  ['package.json', '根 package.json scripts'],
]

export function planLineLossWired(root = ROOT) {
  const present = []
  const missing = []
  let existingPoints = 0
  for (const [rel, label] of WIRE_POINTS) {
    let text = ''
    try {
      text = readFileSync(path.join(root, rel), 'utf8')
    } catch {
      missing.push(`${label}(读不到 ${rel})`)
      continue
    }
    existingPoints++
    if (text.includes('check-plan-line-loss')) present.push(label)
    else missing.push(`${label}(${rel} 未点名本脚本)`)
  }
  /**
   * `applicable` —— 一个注册落点文件都不存在时,这里**不是**本仓,而是被复制出去的夹具
   * (本门的端到端用例就把本脚本 copy 进临时 git 仓跑)。那种场合判"摘线"是错的,
   * 会让一个正常工作的副本以"门被摘掉"的名义 exit 1(第一版就踩了:连带弄红三枚既有端到端用例)。
   * 所以摘线只在"落点文件在、但都不点名本门"时成立。
   */
  return {
    applicable: existingPoints > 0,
    wired: present.length > 0,
    present,
    missing,
  }
}

/** 打印摘线告警;`hard` 时(提交链上的 check 模式)直接判红 exit 1。 */
function guardWiring(hard) {
  const w = planLineLossWired()
  if (w.wired || !w.applicable) return w
  console.warn(
    '\n❌ [plan-line-loss] 本门已从提交链上被摘掉 —— 五处权威接线点无一再点名本脚本' +
      `(登记行正在无人看守地丢失):\n   ${w.missing.join('\n   ')}`,
  )
  console.warn(
    '   修法(一行,立即恢复):在 `scripts/guardian-runner.mjs` 恢复 id 71 注册块' +
      "(`script: 'check-plan-line-loss.mjs'`);\n" +
      '   若同时需要 post-commit 自愈层,还要在 `.husky/post-commit` 恢复对 `--heal` 的调用。\n',
  )
  if (hard) process.exit(1)
  return w
}

/**
 * 「这一条登记本身是否还在被审面上占着行首名额」—— **回捞侧专用**的幂等守卫。
 *
 * ⚠️ 为什么回捞不能直接复用 `resolveRegistrationLoss`(2026-09-27 由本文件自检抓出来):
 * 组判据需要**整组**登记行才能算出"名额被谁占了",而 `healContent` 拿到的已经是检测侧
 * 判完的丢失清单(只剩缺席那几条)。把单条喂回组判据,同编号那行**幸存**的登记会被算成
 * "改写名额"(slack=1),于是刚判出的丢失又被自己吞回去 —— 表现是 `--heal` 报"回捞 1 条"
 * 却一行也没插。检测判活与回捞幂等是**两件事**,各有一份正确形态,混用必然一边错。
 * 加粗族(`id == null`)沿用"标记文本是否仍在"的旧判据,与 `resolveRegistrationLoss` 同形。
 */
export function registrationAlreadyPresent(targetSrc, entry) {
  if (!entry || !entry.marker) return true
  if (!entry.id) return targetSrc.includes(entry.marker)
  const shape = entry.shape || shapeOfRegistration(entry.line || '')
  const slot = registrationSlots(targetSrc).get(`${shape}${SHAPE_ID_SEP}${entry.id}`)
  return !!slot && slot.markers.has(entry.marker)
}

/**
 * 「同编号的**任务行形态**已在被审面吗」—— 回捞侧专用的跨形态兜底判据(G-977954,86H 事故第二道闸)。
 *
 * 为什么 `registrationAlreadyPresent` 不够:它按 **(形态,编号)** 复合主键查行首名额,而重复
 * 登记的真实形态恰恰是**同编号跨形态** —— 面上是 `- [x] 2026-10-08 ✅ **86H. …**`(checkbox,
 * 且编号埋在日期+勾+加粗之后,`headIdOf` 提不出)而缺口副本是 `- [ ]`(bullet)⇒ 形态对不上、
 * 行首名额也不重合 ⇒ 幂等守卫漏过 ⇒ 自愈器把缺口副本又追加一份(86H 重复登记事故成因)。
 *
 * 判据取"编号紧跟标题分隔符(`.`/`、`)"这一**任务行形态**在全面的命中 —— 刻意**不**收编行首
 * 名额语义(`## O42 台账…` 这类不带分隔符的标题、同节 `- **O42 残余…` bullet):同编号在其它
 * 形态的登记点是否占名额,由 `registrationAlreadyPresent` / `multiSlot` 那套组判据管;兜底若连
 * 它们也判"已在面",标题级回捞(O42 事故的正主)就会被同节残余 bullet 误伤,永远捞不回来。
 * 方向上宁可多判"已在面"(少插一条,且 `healContent` 以 `skippedExistingId` 点名,绝不静默),
 * 也不把缺口副本插成第二行。边界用 `(?<![A-Za-z0-9])` 而不是 `\b`:`\b` 以 `[A-Za-z0-9_]` 定义,
 * `守门` 这类中文编号族前后都是非 `\w`,会匹配失败。
 */
export function idExistsOnFace(targetSrc, id) {
  if (!id) return false
  const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![A-Za-z0-9])${escaped}[.、]`).test(targetSrc)
}


export function healContent(targetSrc, missing) {
  const eol = targetSrc.includes('\r\n') ? '\r\n' : '\n'
  const lines = targetSrc.split(eol)
  /**
   * 回捞必须先过**幂等守卫**再插。旧写法在这里另用"编号仍是行首就算活"的**集合**判据
   * (`ids.add(id)` / `headingIds.add(id)` 那套手工记账),于是"同一编号第二行登记被吞"那一型:
   * 检测侧刚判出丢失,回捞侧一看编号还在行首 ⇒ 跳过 ⇒ 永远捞不回来(2026-09-27 现读复现的
   * `## O61` / `### O61` 现场正是这一条)。守卫换成"这一条登记本身在不在行首"之后,
   * 幂等性照旧成立:插回去的那一行此后就以其原 marker 占着行首 ⇒ 二次调用返回 0 条。
   */
  const candidates0 = (missing ?? []).filter((e) => !registrationAlreadyPresent(targetSrc, e))
  /**
   * 第三形态的**回捞侧刹车**(与检测侧同一个谓词,`collectedInDriftComment`,§0.6 单源):
   * 原文已被收拢进漂移注释的那些行不得插回开放态 —— 检测侧本来就不会把它们交给这里,
   * 这一道是给"绕过检测侧直接喂 missing 清单"的调用方(自愈之外的手工/第三方通道)兜底:
   * 插回一行 = 替台账长出一份重复登记(§1「一个编号只能有一行当前状态」),比少插一行更响。
   */
  const collectedCorpusForHeal = driftCollectedCorpus(targetSrc)
  let skippedCollected = 0
  const candidates = candidates0.filter((e) => {
    if (collectedInDriftComment(e, collectedCorpusForHeal).matched) {
      skippedCollected += 1
      return false
    }
    return true
  })

  /**
   * idExistsOnFace 兜底(G-977954,86H 重复登记事故的第二道闸):`registrationAlreadyPresent`
   * 按 **(形态,编号)** 复合主键查,而重复登记的真实形态恰恰是**同编号跨形态** —— 面上是
   * `- [x]`(checkbox)、缺口副本是 `- [ ]`(bullet),形态对不上 ⇒ 幂等守卫漏过 ⇒ 自愈器把
   * 缺口副本又追加一份(86H 事故成因)。所以这里再叠一道**只认编号、跨形态**的兜底:编号仍在
   * 被审面的任何位置 ⇒ 判"这一条已在面" ⇒ 跳过插入并计入 `skippedExistingId`(点名给上层,
   * 绝不静默)。`id == null` 的行(加粗族/无编号)不适用此判据,照旧走旧路径(向后兼容,有测试钉)。
   *
   * `multiSlot` 那一类**只点名不回捞**(见 `resolveRegistrationLoss` 的头注):同编号在目标面
   * 还有登记点,机器无从判断"少掉的那行"是被吞还是被正当改号/归并,自动插回去等于替台账造重复
   * 登记 —— 那比原来的丢行更响(§1"把没做的记成做过的比原病更响"同一条判断)。两道闸都在
   * `candidates` 之后:先计 `skippedExistingId`,再滤 `multiSlot`,`withheld` 只计后者。
   */
  let skippedExistingId = 0
  const pending = candidates.filter((e) => {
    if (e.id && idExistsOnFace(targetSrc, e.id)) {
      skippedExistingId += 1
      return false
    }
    return !e.multiSlot
  })
  const withheld = candidates.length - pending.length - skippedExistingId
  let appended = 0
  let inserted = 0
  for (const entry of pending) {
    const { line, prev } = entry
    const clean = line.replace(/\r$/, '')
    const at = prev ? lines.findIndex((l) => l.replace(/\r$/, '') === prev.replace(/\r$/, '')) : -1
    if (at >= 0) {
      lines.splice(at + 1, 0, clean)
      inserted += 1
    } else {
      lines.splice(lines.length - 1, 0, clean)
      appended += 1
    }
  }
  return { out: lines.join(eol), inserted, appended, withheld, skippedExistingId, skippedCollected }
}

/**
 * 取证夹具:真造一个临时 git 仓,把 **HEAD / 索引 / 磁盘** 三面摆成互不相同的现场。
 *
 * 为什么必须真造而不是拿真仓现读:取材面判据的断言一旦依赖仓库瞬时状态,下一次并发提交就会把它
 * 变成假账(守门 103 把这条写成了硬规矩,守门 83 的 R3 登记一天被回退三次是同一型的反面教材)。
 * 只有"同一棵仓里三面各是什么答案"能证明全量档读的到底是哪一面。
 *
 * @param {{commits?:Array<{plan?:string, extra?:Record<string,string>, msg?:string}>,
 *          index?:string, disk?:string, diskExtra?:Record<string,string>}} spec
 *   `commits` 依序提交(最后一枚即 HEAD);`extra` 里的文件与计划文档**同枚提交入库**(= 已入库的归档锚点);
 *   `index` 只写索引(add,不动 HEAD);`disk` / `diskExtra` 只写磁盘(不 add ⇒ 与任何提交都无关)。
 */
function faceFixtureRepo(spec = {}) {
  const dir = mkScratch('planloss-face-')
  const g = (args) => git(args, dir)
  const put = (rel, body) => {
    const abs = path.join(dir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, body, 'utf8')
  }
  g(['init', '-q', '-b', 'main'])
  g(['config', 'user.email', 'gate71-selftest@local'])
  g(['config', 'user.name', 'gate71-selftest'])
  g(['config', 'commit.gpgsign', 'false'])
  for (const step of spec.commits ?? []) {
    const paths = []
    if (step.plan !== undefined) {
      put(PLAN, step.plan)
      paths.push(PLAN)
    }
    for (const [rel, body] of Object.entries(step.extra ?? {})) {
      put(rel, body)
      paths.push(rel)
    }
    if (paths.length) g(['add', '-A', '--', ...paths])
    g(['commit', '-q', '-m', step.msg ?? 'step'])
  }
  if (spec.index !== undefined) {
    put(PLAN, spec.index)
    g(['add', '-A', '--', PLAN])
  }
  if (spec.disk !== undefined) put(PLAN, spec.disk)
  for (const [rel, body] of Object.entries(spec.diskExtra ?? {})) put(rel, body)
  return dir
}

/** 夹具语料:一条条目标题 + 一条无关登记行(后者三面都在,用于确认只动了要动的那一行) */
const FIX_HEADING =
  '## O42 夹具条目标题(2026-09-26 立并完成 ✅,单端工程治理:scripts 与计划文档登记,内容足够长以入选基线)'
const FIX_PLAN_FULL = [
  '# 计划',
  '',
  FIX_HEADING,
  '',
  '- **G-9001 夹具无关登记行**:这一行三面都在,用来确认现场里只有 O42 标题那一行被挪走。',
  '',
].join('\n')
/** 与 FIX_PLAN_FULL 只差那一行条目标题 —— 即"旧基线整文件提交"的最小可复现形态 */
const FIX_PLAN_NO_HEADING = FIX_PLAN_FULL.split('\n')
  .filter((l) => l !== FIX_HEADING)
  .join('\n')
const FIX_ARCHIVE_REL = '.ihui-agent/archive/PROJECT_PLAN_2099-01-01_selftest.md'
const FIX_ARCHIVE_BODY = ['# 归档(自检夹具)', '', FIX_HEADING, ''].join('\n')
/** 盘读族夹具:.ihui-agent/tmp/ 下的清偿台账 —— gitignored 常驻、**永不入版本控制**,
 *  所以 HEAD 树与索引面都取不到它,只有 faceArchiveFiles 的盘读族认(06943c8c78 的射程)。
 *  缺这一族的覆盖,那次提交把 join/readdirSync 两个未定义名带进 HEAD 都没人发现。 */
const FIX_TMP_LEDGER_NAME = 'plan-pointer-purge-2026-10-16-selftest-ledger.md'
const FIX_TMP_LEDGER_REL = `.ihui-agent/tmp/${FIX_TMP_LEDGER_NAME}`
const FIX_TMP_LEDGER_BODY = ['# 清偿台账(自检夹具)', '', FIX_HEADING, ''].join('\n')

function selfTest() {
  const base = [
    '### 某任务',
    '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
    '  - **D107b 结案(第 57 轮):证据替换推测,该因果链不成立,留下的是防回潮锁而不是待办。**',
    '  - 短行不带编号不该被当成登记行',
    '  - **普通说明**:这行没有编号,丢了也不该报。',
  ].join('\n')
  const cases = []
  const t = (name, fn) => cases.push({ name, pass: !!fn() })

  /**
   * 取材面判据只能用**纯函数 + 构造面**证明(守门 103 的那条教训:依赖仓库瞬时状态的断言
   * 会在下一轮变成假账)。这里把 readDisk 写成"一被调用就抛",就是为了把"全量档偷偷读磁盘"
   * 这一型钉成必然红 —— 旧实现恰好在这一支上恒红(它默认读磁盘)。
   */
  const boom = (what) => () => {
    throw new Error(`不该读${what}`)
  }
  t('全量档必须取 HEAD blob,且结构上不许碰磁盘', () => {
    const got = pickPlanContent({ face: 'head', readIndex: boom('索引'), readHead: () => 'HEAD面', readDisk: boom('磁盘') })
    return got === 'HEAD面'
  })
  t('暂存档必须取索引 blob(提交链真用到的那份)', () =>
    pickPlanContent({ face: 'staged', readIndex: () => '索引面', readHead: boom('HEAD'), readDisk: boom('磁盘') }) === '索引面')
  t('只有显式 --worktree 才允许读磁盘副本', () =>
    pickPlanContent({ face: 'worktree', readIndex: boom('索引'), readHead: boom('HEAD'), readDisk: () => '磁盘面' }) === '磁盘面')
  t('face 缺失(旧调用形态)不得回落到磁盘 —— 回落等于把"没判"写成"判过了"', () =>
    pickPlanContent({ readIndex: boom('索引'), readHead: () => 'HEAD面', readDisk: boom('磁盘') }) === 'HEAD面')

  // ── 端到面:同一棵临时仓里三面各是什么答案(2026-09-26 收口的取证主体)──────────────────
  // 旧实现在「面①」这一支必红(它把全量档的待提交内容取成磁盘副本),所以这四条同时是新判据
  // 有牙的 A/B 证明 —— 变异自证:把 runCheck 的 head 面改回读磁盘,「面①」立即翻红。
  t('面①:磁盘副本缺一条登记行而索引与 HEAD 都在 ⇒ staged 绿、**全量必须绿**、--worktree 才红', () => {
    const dir = faceFixtureRepo({ commits: [{ plan: FIX_PLAN_FULL }], disk: FIX_PLAN_NO_HEADING })
    try {
      const staged = runCheck(true, 'staged', { root: dir })
      const head = runCheck(false, 'head', { root: dir })
      const wt = runCheck(false, 'worktree', { root: dir })
      return (
        staged.ok === true &&
        head.ok === true &&
        head.lost.length === 0 &&
        head.scanned > 0 &&
        wt.ok === false &&
        wt.lost.length === 1 &&
        wt.lost[0].id === 'O42' &&
        wt.lost[0].shape === 'heading'
      )
    } finally {
      rmScratch(dir)
    }
  })
  t('面②:HEAD 真丢了历史里有的登记行 ⇒ 全量必红并点名那一行(此时 staged 仍绿 —— 两问各有答案)', () => {
    const dir = faceFixtureRepo({
      commits: [{ plan: FIX_PLAN_FULL }, { plan: FIX_PLAN_NO_HEADING, msg: '旧基线整文件提交' }],
    })
    try {
      const head = runCheck(false, 'head', { root: dir })
      const staged = runCheck(true, 'staged', { root: dir })
      return (
        head.ok === false &&
        head.lost.length === 1 &&
        head.lost[0].id === 'O42' &&
        head.lost[0].shape === 'heading' &&
        staged.ok === true &&
        headingLosses(head.lost).length === 1
      )
    } finally {
      rmScratch(dir)
    }
  })
  t('面③:该行已逐字进入**已入库**的归档件 ⇒ 全量放行(新面上归档豁免不得做丢)', () => {
    const dir = faceFixtureRepo({
      commits: [
        { plan: FIX_PLAN_FULL },
        { plan: FIX_PLAN_NO_HEADING, msg: '归档搬迁', extra: { [FIX_ARCHIVE_REL]: FIX_ARCHIVE_BODY } },
      ],
    })
    try {
      const head = runCheck(false, 'head', { root: dir })
      return head.ok === true && head.lost.length === 0
    } finally {
      rmScratch(dir)
    }
  })
  t('面③反向对照:同一份归档正文**只写在磁盘**(未 add)⇒ 全量仍判红(G-183 在新面上继续成立)', () => {
    const dir = faceFixtureRepo({
      commits: [{ plan: FIX_PLAN_FULL }, { plan: FIX_PLAN_NO_HEADING, msg: '旧基线整文件提交' }],
      diskExtra: { [FIX_ARCHIVE_REL]: FIX_ARCHIVE_BODY },
    })
    try {
      const head = runCheck(false, 'head', { root: dir })
      return head.ok === false && head.lost.length === 1 && head.lost[0].id === 'O42'
    } finally {
      rmScratch(dir)
    }
  })
  t('面③b:盘读族(tmp/ 清偿台账,结构上永不入库)也能出具归档凭据', () => {
    const dir = faceFixtureRepo({
      commits: [{ plan: FIX_PLAN_FULL }, { plan: FIX_PLAN_NO_HEADING, msg: '旧基线整文件提交' }],
      diskExtra: { [FIX_TMP_LEDGER_REL]: FIX_TMP_LEDGER_BODY },
    })
    try {
      const head = runCheck(false, 'head', { root: dir })
      // 台账只在盘上:HEAD 树与索引都取不到,只有盘读族认。tmpRel 若被拼成反斜杠
      // (Windows 上 path.join 的形态),这里会静默丢空 ⇒ 本档翻红,不给人蒙混过关。
      return head.ok === true && head.lost.length === 0 && head.scanned > 0
    } finally {
      rmScratch(dir)
    }
  })
  t('面③b反向对照:tmp/ 里找不到原文 ⇒ 照旧判丢(§0.3 不冒充,盘读不是免罪金牌)', () => {
    const dir = faceFixtureRepo({
      commits: [{ plan: FIX_PLAN_FULL }, { plan: FIX_PLAN_NO_HEADING, msg: '旧基线整文件提交' }],
      diskExtra: { [FIX_TMP_LEDGER_REL]: '# 清偿台账(夹具里没有原文)' },
    })
    try {
      const head = runCheck(false, 'head', { root: dir })
      return head.ok === false && head.lost.length === 1 && head.lost[0].id === 'O42'
    } finally {
      rmScratch(dir)
    }
  })
  t('面④:被审面取不到(无提交)⇒ 判"无法判定",既不记绿也不冒红,磁盘上有副本也不得救场', () => {
    const dir = faceFixtureRepo({ disk: FIX_PLAN_FULL })
    try {
      const head = runCheck(false, 'head', { root: dir })
      const wt = runCheck(false, 'worktree', { root: dir })
      // 两面都必须落"无法判定":磁盘副本不参与 HEAD 面的判定(面①已证),
      // 而人工档也没有历史可比 —— 报"绿"就是替一个没跑成的判定发合格证。
      return (
        head.undetermined === true &&
        head.ok === undefined &&
        typeof head.reason === 'string' &&
        head.reason.includes('无法判定') &&
        wt.undetermined === true &&
        wt.ok === undefined
      )
    } finally {
      rmScratch(dir)
    }
  })
  t('人工档提示只有 --worktree 面发声,head/staged 面必须为 null(不得替别人喊话)', () => {
    const warn = faceNoticeFor('worktree')
    return (
      typeof warn === 'string' &&
      warn.includes('与任何提交都无关') &&
      warn.includes('不要') &&
      faceNoticeFor('head') === null &&
      faceNoticeFor('staged') === null
    )
  })

  t('登记行被删除 → 报两条', () => {
    const cand = base.replace(/ {2}- \*\*G-166[^\n]*\n/, '').replace(/ {2}- \*\*D107b[^\n]*\n/, '')
    return lostMarkers(base, cand).length === 2
  })
  t(
    '改写文案但保留编号 → 不报(避免误伤正常编辑)',
    () =>
      lostMarkers(base, base.replace('N8n 屏改用共享交代组件并回收 6 个旧取词键', '换了个说法'))
        .length === 0,
  )
  t(
    '无编号行丢失 → 不报(不在本闸职责内)',
    () =>
      lostMarkers(base, base.replace('  - **普通说明**:这行没有编号,丢了也不该报。', '')).length ===
      0,
  )
  t('同一形态由 proseLossReport 如实计量(非登记行丢失此前无任何门可见)', () => {
    const r = proseLossReport(
      base,
      base.replace('  - **普通说明**:这行没有编号,丢了也不该报。', ''),
    )
    return r.lostCount === 1 && r.sample[0].includes('普通说明')
  })
  t('反向对照:内容一致 → prose 计量 0(不得把正常提交报成丢失)', () => {
    return proseLossReport(base, base).lostCount === 0
  })
  t('登记行不重复计入 prose(红灯判据已覆盖,两条通道不得双计)', () => {
    return proseLossReport(base, base.replace(/ {2}- \*\*G-166[^\n]*\n/, '')).lostCount === 0
  })
  t(
    'markerOf 认 G-/D(含字母后缀)/P-x.n 编号并要求 bullet + 长度',
    () =>
      markerOf(
        '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
      ) === 'G-166 第⑤步(第 57 轮续)' &&
      markerOf(
        '  - **D107b 结案(第 57 轮):证据替换推测,该因果链不成立,留下的是防回潮锁而不是待办。**',
      ) === 'D107b 结案(第 57 轮):证' &&
      markerOf(
        '  - **P2-F.10 追加 —— 凭据外泄族收到第 5 处,F 通道两次自我纠正,Python 覆盖落地全绿。**',
      ) === 'P2-F.10 追加 —— 凭据外泄' &&
      markerOf('- **D12 短') === null &&
      markerOf('**G-1 没有 bullet**这是一行足够长的但没有列表符号的内容,不该算登记行。') === null &&
      // `守门 NN` 登记行一族:认编号前缀,但"守门"后无数字的散文行不算
      String(
        markerOf(
          '  - **守门 72 `scripts/check-dockerfile-copy-paths.mjs`(sha `f9a264f25b`)**:提交 `79b9` 给根 package.json 加 postinstall 而镜像没 COPY scripts。',
        ),
      ).startsWith('守门 72') &&
      markerOf(
        '  - **守门链的执行语义**:任一 blocking 门失败都跑完再汇总,这是工程约束不是登记行编号。',
      ) === null,
  )
  t(
    'markerOf / headIdOf 认「以登记编号打头的任务标题」一族(## O28 / ## D107b / ## 守门 79),散文标题不算',
    () =>
      String(
        markerOf(
          '## O28 门 53 白名单按新判据重算收紧 + D71② 真实障碍与"第二张错误表"预警(2026-09-24 立并完成 ✅,单端工程治理:scripts + 勘察)',
        ),
      ).startsWith('O28 门 53 白名单') &&
      String(
        markerOf('## D107b 结案:把"是否真丢 commit"改成按树指纹判,不再靠抽样,并留下可复跑证据。'),
      ).startsWith('D107b') &&
      String(
        markerOf('## 守门 79 提交内容含冲突标记(blocking):成对 <<<< ==== >>>> 三模式的判据与取证口径说明。'),
      ).startsWith('守门 79') &&
      // 批次标题一族必须保持原样(收紧不得把旧语义挤掉)
      String(
        markerOf('### 第十四批(第 61 轮续):登记行防丢守门补任务标题一族,含正反例与真仓零告警回归。'),
      ).startsWith('第十四批') &&
      // 反例:无登记编号的标题不进基线,否则任何改写都会报丢失、基线里塞满空条目
      markerOf('## 关键参考文档') === null &&
      markerOf('## 本会话对守门链执行语义的一次长标题说明,它不带任何登记编号因此不该被当作登记行。') === null &&
      headIdOf('## O28 门 53 白名单按新判据重算收紧 + D71② 真实障碍(2026-09-24)') === 'O28' &&
      headIdOf('## 关键参考文档') === null,
  )
  t(
    '整行判活:任务标题被抹掉必须报丢失;只改写标题文案而保留编号 ⇒ 不报(不误伤正常编辑)',
    () => {
      const base = [
        '## O30 一个任务标题(2026-09-24 立并完成 ✅,单端工程治理:scripts + 计划文档登记)',
        '',
        '- [x] ✅(2026-09-24) **O30① 进度行**:内容足够长足够长足够长足够长足够长足够长。',
        '',
      ].join('\n')
      const dropped = base.replace('## O30 一个任务标题(2026-09-24 立并完成 ✅,单端工程治理:scripts + 计划文档登记)\n\n', '')
      const renamed = base.replace('## O30 一个任务标题', '## O30 任务标题文案已被正常改写')
      const lost = lostMarkers(base, dropped).map((x) => x.marker)
      const kept = lostMarkers(base, renamed).map((x) => x.marker)
      return lost.some((m) => String(m).startsWith('O30')) && !kept.some((m) => String(m).startsWith('O30 一个'))
    },
  )
  // ── 标题级判活(2026-09-24 补,封 `## O42` 事故盲区)正反用例 ──────────────────────
  // 真实事故形态:同一节里既有 `## O42 …` 标题、又有 `- **O42 残余…**` 这类**同编号 bullet**。
  // 旧判据把两者都塞进同一个 headIdSet,于是"删标题留正文"在该编号仍被正文顶着的意义上"没丢"
  // —— 真仓 HEAD 抽掉 `## O42` 那一行实测 0 报。新判据要求候选里仍有**标题**以该编号开头。
  const O42SEC = [
    '## O42 台账也不能撒谎 —— 门 89 新增 R7「豁免依据必须可核验」,并当场抓到一条已入库的假依据(2026-09-24)',
    '- **O42 残余(不写作收口)**:① R7 只核结构事实,自然语言真伪仍无人核 —— 台账 13 条里 8 条是本次新增。',
    '- [x] ✅(2026-09-24) **O42③ 第三处残留**:仓库里根本没有源的那一份,按跟踪文件 grep 的取证路径自身有盲区。',
    '  - **普通说明**:这行没有编号,丢了也不该报,是既有职责边界。',
  ].join('\n')
  t(
    '删整节标题(同节仍有同编号 bullet 顶着编号)必须报丢失 —— 旧判据在此处完全无感',
    () => {
      const noHeading = O42SEC.split('\n')
        .filter((l) => !l.startsWith('## O42 '))
        .join('\n')
      const lost = lostMarkers(O42SEC, noHeading)
      // 旧判据的空转面:编号 O42 在候选里仍作为两行 bullet 的行首存在
      const headingIdsGone = !headingIdSet(noHeading).has('O42') && headIdSet(noHeading).has('O42')
      return (
        headingIdsGone &&
        lost.length === 1 &&
        lost[0].id === 'O42' &&
        lost[0].shape === 'heading' &&
        lost[0].marker.startsWith('O42 台账')
      )
    },
  )
  t(
    '标题族只改写文案 / 缩到更短 / ## 降级 ### 而保留编号 ⇒ 都不报(合法编辑不误伤)',
    () => {
      const reworded = O42SEC.replace(
        '## O42 台账也不能撒谎 —— 门 89 新增 R7「豁免依据必须可核验」,并当场抓到一条已入库的假依据(2026-09-24)',
        '## O42 换个说法:台账不能撒谎,而且这一版还顺手补了依据核验的判据说明文字,足够长所以仍是登记标题',
      )
      const shortened = O42SEC.replace(/^## O42 .*$/m, '## O42 短标题,短到不足 MIN_LEN 门槛的字数要求了')
      const demoted = O42SEC.replace(/^## O42 /m, '### O42 ')
      return (
        lostMarkers(O42SEC, reworded).length === 0 &&
        lostMarkers(O42SEC, shortened).length === 0 &&
        lostMarkers(O42SEC, demoted).length === 0
      )
    },
  )
  t(
    '取舍:只删标题、正文还在 ⇒ 判红(整节被挂到别人章节下正是最难发现的一种失真)',
    () => {
      // 刻意不给"正文仍在即视为搬家"的豁免:那样就等于把本次事故重新放回盲区。
      // 正当移除的两条出口由 dropArchivedLost(§1 归档)与紧急跳过承担,不靠放宽判据。
      const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
      const bodyIntact = noHeading.includes('O42 残余') && noHeading.includes('第三处残留')
      return bodyIntact && lostMarkers(O42SEC, noHeading).length === 1
    },
  )
  t(
    '归档放行对标题族同样成立:archive 里能找到该标题原文 ⇒ 不算丢(§1 归档 = 正当移除)',
    () => {
      const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
      const lost = lostMarkers(O42SEC, noHeading)
      const fakeArchive = (m) => (m.startsWith('O42 台账') ? 'PROJECT_PLAN_2026-09-24.md' : null)
      return lost.length === 1 && dropArchivedLost(lost, fakeArchive).length === 0
    },
  )
  t('headingLosses 只挑标题级并点名条目号(判红输出靠它给可诊断信息)', () => {
    const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
    const lost = lostMarkers(O42SEC, noHeading)
    const hl = headingLosses(lost)
    return hl.length === 1 && hl[0].id === 'O42' && headingLosses([]).length === 0
  })
  t(
    '回归对照:本次收紧只作用于标题族,bullet 三族的判活路由一字未动',
    () => {
      // ① 只删标题:不得连带把同节两条 O42 bullet 报成丢失(它们真的还在)
      const noHeading = O42SEC.split('\n').filter((l) => !l.startsWith('## O42 ')).join('\n')
      const onlyHeading = lostMarkers(O42SEC, noHeading)
      // ② 复选任务行整行消失、且该编号再无别处以它开头 → 仍走老路报丢,shape 未被改道
      const solo = [
        '### 某任务',
        '- [ ] O48 独立任务行(两条子项):① 一条用于验证复选行老判据的登记行,正文可随便改写而不报。',
        '  - **进度(2026-09-24)**:这一行原样引用了 O48 独立任务行 却不在行首,不构成行首编号。',
      ].join('\n')
      const soloDropped = lostMarkers(solo, solo.replace(/^- \[ \] O48[^\n]*\n/m, ''))
      // ③ 加粗 bullet 只改写 marker 之后的文案 → 不报(既有"不误伤正常编辑"语义)
      const boldReworded = lostMarkers(
        O42SEC,
        O42SEC.replace('① R7 只核结构事实,自然语言真伪仍无人核', '① 换成别的说法,长度仍然足够足够长'),
      )
      return (
        onlyHeading.length === 1 &&
        onlyHeading[0].shape === 'heading' &&
        soloDropped.length === 1 &&
        soloDropped[0].shape === 'checkbox' &&
        boldReworded.length === 0
      )
    },
  )
  t(
    'heal 能力边界:标题级条目只回插一行且幂等;输出必须如实标注需人工归并',
    () => {
      const headingLine = O42SEC.split('\n')[0]
      const noHeading = O42SEC.split('\n').slice(1).join('\n')
      const reg = registrationOf(headingLine)
      const entry = {
        line: headingLine,
        marker: reg.marker,
        id: reg.id,
        shape: reg.shape,
        prev: null,
      }
      const first = healContent(noHeading, [entry])
      const second = healContent(first.out, [entry])
      // 回插后判活必须成立(标题集已在 healContent 内同步),否则就是重复插入的循环
      const ids = headIdSet(noHeading)
      return (
        first.inserted + first.appended === 1 &&
        second.inserted === 0 &&
        second.appended === 0 &&
        stillRegistered(entry, first.out, ids, headingIdSet(first.out)) &&
        !first.out.includes(headingLine + '\n' + headingLine)
      )
    },
  )
  t(
    'markerOf 认 `第N步` 中文序号族(阿拉伯/汉字/带圈),且只认"步"不认次数/轮次/阶段',
    () =>
      // 正例:三种序号写法都命中,标记取加粗头原文前缀
      String(
        markerOf(
          '  - **第⑥步(第 58 轮):ACP 侧 z.enum 收紧为 kebab∪camel 双拼写,落库/出参各按规范档与 wire 归一。**',
        ),
      ).startsWith('第⑥步') &&
      String(
        markerOf(
          '  - **第6步(第 58 轮):登记行防丢守门补中文序号族,扫描口径与真实计划做误伤回归后再提交。**',
        ),
      ).startsWith('第6步') &&
      String(
        markerOf(
          '  - **第十二步收口(第 59 轮):权限档派生清单落共享层,400 文案不再从 Partial 派生 undefined。**',
        ),
      ).startsWith('第十二步') &&
      // 反例 1:"第N次/第N轮"是叙述不是步骤登记,行再长也不算
      markerOf(
        '  - **第 58 轮续**:这是一条足够长的进度叙述行,写的是轮次不是步骤,不该受本闸保护。',
      ) === null &&
      markerOf(
        '  - **第③次尝试**:这行足够长但用的是次数序号,属于过程叙述,不该被当成登记行受保护。',
      ) === null &&
      markerOf(
        '  - **第①阶段说明**:这一行足够长,写的是阶段而非步骤,同样不该被当登记行收紧保护。',
      ) === null,
  )
  t('markerOf 对 `第N步` 族仍要求 bullet 与长度(非 bullet / 短行都不算)', () => {
    const long =
      '这是一段足够长的正文说明,里面引用了 **第⑥步** 这个序号来描述前因后果,但它根本不是列表项登记行。'
    return (
      markerOf(long) === null &&
      markerOf('  - **第⑥步**') === null &&
      markerOf('  - **第⑥步补**)') === null
    )
  })
  t(
    'markerOf 认复选任务行的裸编号(`- [ ] O13b …`),标记 = 编号 + 短标题(不吞括注正文)',
    () =>
      // 正例:O/B/D 三族裸编号 + 带 ✅(日期) 前缀都已勾的完成行
      markerOf(
        '- [ ] O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义',
      ) === 'O13b 第二段' &&
      // 复选框后先写状态的写法(计划里真实存在),标记同样是 `O13b 第二段`
      markerOf(
        '- [ ]（进行中） O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**。',
      ) === 'O13b 第二段' &&
      markerOf(
        '- [ ] B15 本目标下**仍未闭环**的两件事(不写作已完成,各自给出解阻判据):健康门禁与迁移账本两处复核。',
      ) === 'B15 本目标下' &&
      markerOf(
        '- [ ] D13 逐消息上下文可解释视图(G-10)。V2 深化口径(2026-09-19 晚):须含 auto_context 命中/RAG chunk 四类。',
      ) === 'D13 逐消息上下文可解释视图' &&
      // 反例 1:已勾行整行不进保护集(2026-10-16 机主令 faa560bf8a「完成即删」:
      // `- [x]`(含 `✅(日期)` 前缀与加粗编号)翻勾后可整行删除,回捞层不得捞回 ——
      // 否则"完成即删"每删一行就被本门拦一次,与 13d/清偿器 2026-10-14 同型互咬空转)
      markerOf(
        '- [x] ✅(2026-09-23) **D44 白名单兜底事件逐个补渲染位(G-62)**:WHITELIST 第 107 行起 10 事件逐个定渲染位。',
      ) === null &&
      // 加粗原文前缀路径的正例(未勾行):`**编号` 仍走"原文前缀"语义,不重拼、遇下一个 `*` 即停
      // —— 这一档是 markerOf 内 `\\*\\*(${ID}|第N步)` 那条分支的唯一覆盖,别退化
      String(
        markerOf(
          '- **D44 白名单兜底事件逐个补渲染位(G-62)**:WHITELIST 第 107 行起 10 事件逐个定渲染位。',
        ),
      ).startsWith('D44 白名单兜底事件') &&
      // 反例 2:两处都够不着的行不算登记行(正文段落 / 编号不在内容开头)
      markerOf(
        '这是一段足够长的正文,里面提到了 O13b 第二段这件事的来龙去脉,但它不是任务登记行,不该进基线。',
      ) === null &&
      markerOf(
        '- [ ] 这一行的内容开头不是编号,虽然正文中段出现了 D107b 之类的串,也不该被当登记行收紧保护。',
      ) === null &&
      // 反例 3:编号本身 <3 字(P0/D6/W1)在两处都能撞见,拿它当标记只会塞永不报丢的空条目 → 放过
      markerOf(
        '- [ ] P0 该项编号只有两个字,标记全文必撞,不做无意义的基线条目。这是足够长的一行说明文字。',
      ) === null &&
      markerOf(
        '- [ ] D6 多 agent 栈收敛(agents-kanban/swarm 四套→AgentLoopV2 单一事实源)方案评审并启动(G-22)。',
      ) === null,
  )
  t(
    'markerOf 认批次标题行 `### 第N批`,刻意不认轮/次/阶段标题',
    () =>
      markerOf(
        '### 第十八批(2026-09-23):目录页输入框垂直居中 —— 单行 Edit 顶对齐文字,并给这条修复立跨文件闸',
      ) === '第十八批(2026-09-23)' &&
      // 冒号紧跟序号时,标记续到下一个分隔符前(仍 ≤18 字,不吞整段标题)
      (() => {
        const v = String(
          markerOf('#### 第七批:main 上属于本路的守门 70 越线清零(2026-09-23,commit `18598f4ac2`)'),
        )
        return v.startsWith('第七批:') && v.length <= 18 && !v.includes('(')
      })() &&
      markerOf('### 第二轮收口(同日续做:把上一节所有待办清零时新查出的 6 项,均已修并取证)') ===
        null &&
      markerOf('### 第十四阶段总结:这一节标题写的是阶段而非批次,纳进必与正文撞车,故不受保护。') ===
        null &&
      // 反例:正文段落里出现"第十四批"不算标题行
      markerOf('本会话第十四批的收尾工作已经全部落地,这一行是正文段落而非章节标题,不该进基线。') ===
        null,
  )
  t('新两族进 lostMarkers:整行消失必报,改写编号后文案不报(误伤回归)', () => {
    const b = [
      '### 第十九批(2026-09-23):一条用于验证批次标题防丢的标题行,正文部分可以随便改写而不该报丢。',
      '- [ ] O13c 第三段(收敛本身,若干条可核算):① 一条用于验证裸编号任务行防丢的登记行,正文随便改写。',
      '  - **普通说明**:这行没有编号,丢了也不该报,是既有职责边界。',
    ].join('\n')
    // 改写正文(保留编号) → 0 报
    const edited = b
      .replace('一条用于验证批次标题防丢的标题行', '换了个说法但编号还在')
      .replace('① 一条用于验证裸编号任务行防丢的登记行', '① 改写了')
    // 整行删除 → 恰好 2 报(第三行无编号不报)
    const removed = b.replace(/^### 第十九批[^\n]*\n/m, '').replace(/^- \[ \] O13c[^\n]*\n/m, '')
    return lostMarkers(b, edited).length === 0 && lostMarkers(b, removed).length === 2
  })
  t('headIdOf 认三种"行首编号"形态,且散文里的引用不算', () => {
    return (
      // 复选任务行裸编号 / 带状态装饰 / 已勾带 ✅(日期)
      headIdOf(
        '- [ ] O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义',
      ) === 'O13b' &&
      headIdOf(
        '- [ ]（进行中） O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**。',
      ) === 'O13b' &&
      headIdOf(
        '- [x] ✅(2026-09-23) D51 对话流元素覆盖守门:新建 `scripts/check-chat-element-coverage.mjs`(注册进 guardian-runner)。',
      ) === 'D51' &&
      // 批次标题行
      headIdOf('### 第二十批(2026-09-23):一条用于验证批次标题行首编号的登记标题,足够长。') ===
        '第二十批' &&
      // 加粗头紧跟编号 ⇒ 也算行首编号(让"改写成加粗形态"不被误判成丢失)
      headIdOf(
        '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键,细节见提交说明。**',
      ) === 'G-166' &&
      // 反例:编号出现在正文中段(散文引用)、或短编号(P0/D6 两处必撞)都不给身份
      headIdOf(
        '  - **进度(2026-09-23 ⑤)**:`admin.ts:124` 的统一 admin preHandler 已收编,O13b 第二段 ①②③⑤ 已落,仅剩 ④。',
      ) === null &&
      headIdOf(
        '- [ ] P0 这一行的编号只有两个字,全文必撞,不给身份也不给保护。足够长的一行说明文字内容。',
      ) === null
    )
  })
  t('残余面根治:任务行整行被抹、但标题被别处原样引用时,行首编号这一路必须报出来', () => {
    const b = [
      '### 某任务',
      '- [ ] O13b 第二段(收敛本身,5 条可核算):① 34 个白名单文件逐个迁移到集中封装并**删条目**;② 删掉 2 处本地重定义。',
      '  - **进度(2026-09-23 ⑤)**:`admin.ts:124` 的统一 admin preHandler 已收编进集中封装,O13b 第二段 ①②③⑤ 已落,仅剩 ④ 升 blocking。',
    ].join('\n')
    // ① 旧判据的空转面:整行删掉后 `O13b 第二段` 仍能在那条进度行里搜到
    const erased = b.replace(/^- \[ \] O13b[^\n]*\n/m, '')
    const byText = erased.includes('O13b 第二段')
    // ② 新判据必须报 1 条
    const lost = lostMarkers(b, erased)
    // ③ 反例 A:改写正文保留行首编号 → 不报
    const reworded = b.replace(
      '① 34 个白名单文件逐个迁移到集中封装并**删条目**',
      '① 换成 31 个文件',
    )
    // ④ 反例 B:整行改成已勾 + ✅(日期) 形态 → 不报(编号仍是行首)
    const done = b.replace(
      '- [ ] O13b 第二段(收敛本身,5 条可核算):',
      '- [x] ✅(2026-09-23) O13b 第二段(收敛本身,5 条可核算):',
    )
    return (
      byText &&
      lost.length === 1 &&
      lost[0].marker === 'O13b 第二段' &&
      lostMarkers(b, reworded).length === 0 &&
      lostMarkers(b, done).length === 0
    )
  })
  t('G-307(b):剥注记识别不得把"只剩注记、正文被截掉"或"整行被删"洗成存活(反洗白成对档)', () => {
    const base =
      '- [ ] G-256 一条**环境相关红**,归因未定:`tests/x.py::t` 在工作树红而在干净检出绿。解阻判据:带与不带 `.env` 各跑一次同一文件即可定性。'
    // ① 注记在位、正文没了 ⇒ 剥完行首没有编号 ⇒ 仍判丢(识别的是形状,不是"见过 [归并] 二字")
    const husk = lostMarkers(
      base,
      '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「G-256 · 一条」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。',
    )
    // ② 整行被删,另一条同族登记行在正文中段提到该编号 ⇒ 带 id 的条目只认行首,必须仍判丢
    const moved = lostMarkers(
      base,
      '- [ ] G-307 一条待办:细节见别处,本行只顺带提到 G-256 一条 的旧登记,不含它的行首形态。',
    )
    return husk.length === 1 && husk[0].id === 'G-256' && moved.length === 1
  })
  t('G-307(b):归并器两代翻勾注记都必须算"该行仍登记"(看守不得与生产者互咬)', () => {
    const base =
      '- [ ] G-256 一条**环境相关红**,归因未定:`tests/x.py::t` 在工作树红而在干净检出绿。解阻判据:带与不带 `.env` 各跑一次同一文件即可定性。'
    // legacy 前置式(2026-09-26..27 归并器产出、HEAD 存量):注记在前、正文逐字在后
    const legacy =
      '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「G-256 · 一条」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 G-256 一条**环境相关红**,归因未定:`tests/x.py::t` 在工作树红而在干净检出绿。解阻判据:带与不带 `.env` 各跑一次同一文件即可定性。'
    // 现行后置式(G-307 修法 a):正文留在行首,注记追加行尾 —— head-id 天然命中,不经剥取也应活
    const suffixed =
      '- [x] ✅(2026-09-28) G-256 一条**环境相关红**,归因未定:`tests/x.py::t` 在工作树红而在干净检出绿。解阻判据:带与不带 `.env` 各跑一次同一文件即可定性。 （[归并] 本行与已完成登记同题(主键 「G-256 · 一条」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账）'
    return (
      lostMarkers(base, legacy).length === 0 &&
      lostMarkers(base, suffixed).length === 0 &&
      // 反向对照 ①:整行真删,只剩一句带同样编号的散文引用 ⇒ 必须仍判丢(剥注记不得洗白丢失)
      lostMarkers(
        base,
        '- 说明:曾登记过 G-256 一条**环境相关红**,后来处理情况见别处,这里只是转述不是登记行。',
      ).length === 1 &&
      // 反向对照 ②:注记还在、正文被截掉 ⇒ 剥完行首没有编号,必须仍判丢
      lostMarkers(
        base,
        '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「G-256 · 一条」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。',
      ).length === 1
    )
  })
  t('healContent 走同一判据:编号仍是行首就不重复插,编号消失才回捞', () => {
    const task =
      '- [ ] O13c 第三段(收敛本身,若干条可核算):① 一条用于验证自愈判据一致性的登记行,正文可随便改写。'
    const ref =
      '  - **进度(第 61 轮)**:这一行原样引用了 O13c 第三段 这件事的前因后果,但它不是登记行的行首形态。'
    const entry = { line: task, marker: 'O13c 第三段', id: 'O13c', prev: ref }
    const target = ['### 段', ref, ''].join('\n')
    const healed = healContent(target, [entry])
    const again = healContent(healed.out, [entry])
    return (
      healed.inserted === 1 &&
      healContent(target + '\n' + task, [entry]).inserted === 0 &&
      again.inserted === 0 &&
      again.appended === 0
    )
  })
  t('归档豁免只认**已入库**的归档副本:四条组合各自成立(G-183 ③)', () => {
    const marker = 'G-998 归档锚点入库可判定性测试条目'
    const name = 'PROJECT_PLAN_2099-01-01_auto-archive.md'
    const body = `# 归档\n\n- [x] ✅(2099-01-01) ${marker}:正文内容\n`
    // ① 面里有这个名字、blob 里有原文 ⇒ 放行(正当归档)
    const onFace = archivedCopy(marker, { list: () => [name], read: () => body })
    // ② 盘上有同名副本但**面里没有**(未 `git add`,或整目录被忽略)⇒ 不构成凭据。
    //    这一条就是本次修的洞:旧实现 readdirSync(磁盘),本机写一份就能授权删别人的登记行。
    const untracked = archivedCopy(marker, { list: () => [], read: () => body })
    // ③ 面里列出了路径、blob 却取不到(unmerged / 已删)⇒ 同样不放行,且不得抛
    const brokenBlob = archivedCopy(marker, { list: () => [name], read: () => null })
    // ④ 清单里混着别的文件名(归档目录同时放审计件)⇒ 仍只认 PROJECT_PLAN_*.md,不误读
    const otherNames = archivedCopy(marker, {
      list: () => ['hollow-backup-tags-2026-09-24.txt', name],
      read: (p) => (p === name ? body : marker),
    })
    return onFace === name && untracked === null && brokenBlob === null && otherNames === name
  })
  t('归档目录豁免路径可达(不抛异常即算通)', () => {
    const v = archivedCopy('一个绝对不存在的标记 XYZ')
    return v === null || typeof v === 'string'
  })
  t('missingFrom 可分别喂工作区与 HEAD(旁路提交把 HEAD 合掉、工作区还留着时仍能发现)', () => {
    const line = '  - **G-777 收口(第 60 轮):一条足够长的登记行,用来验证双目标比对逻辑。**'
    const seen = new Map([['G-777 收口', { marker: 'G-777 收口', line, prev: null }]])
    const withLine = `${base}\n${line}`
    return missingFrom(seen, withLine).length === 0 && missingFrom(seen, base).length === 1
  })
  /**
   * G-816708(2026-10-05):自愈的比较目标从两面扩成三面。这里钉的是**纯函数**(一把尺子喂三个面
   * 与三态分档);端到端那一格(索引带着旧版而 HEAD/工作树都在 ⇒ 真跑 `--heal` 时既点名又不宣布
   * "无缺失")住在 `scripts/tests/check-plan-line-loss.test.mjs`,而"落地那一刻真的有人跑它"住在
   * `scripts/tests/object-space-land.test.mjs` / `live-doc-edit.test.mjs`。三层各管一格,缺一格就是假绿。
   */
  t(
    'healLegs 第三档:索引带旧版而工作树与 HEAD 都在 ⇒ allClean 必须 false(那句"无缺失"不得替索引喊)',
    () => {
      const line = '  - **G-778 收口(第 61 轮):一条足够长的登记行,用来验证三目标比对逻辑。**'
      const seen = new Map([['G-778 收口', { marker: 'G-778 收口', line, prev: null }]])
      const clean = `${base}\n${line}`
      const legs = healLegs(seen, { disk: clean, head: clean, index: base })
      return (
        legs.disk.length === 0 &&
        legs.head.length === 0 &&
        legs.index.length === 1 &&
        legs.allClean === false
      )
    },
  )
  t('healLegs 反向对照:三面都在 ⇒ allClean true;索引面取不到 ⇒ **未判定**而不是"缺 0 条"', () => {
    const line = '  - **G-779 收口(第 62 轮):一条足够长的登记行,用来验证三目标比对的反向臂。**'
    const seen = new Map([['G-779 收口', { marker: 'G-779 收口', line, prev: null }]])
    const clean = `${base}\n${line}`
    const green = healLegs(seen, { disk: clean, head: clean, index: clean })
    const und = healLegs(seen, { disk: clean, head: clean, index: null })
    return (
      green.allClean === true &&
      und.allClean === false &&
      und.indexUndetermined === true &&
      und.index === null
    )
  })
  t('healLegRoster:每一档的缺失都必须逐条点名上 stdout(补跑的派生层只回读 stdout)', () => {
    const line = '  - **G-780 收口(第 63 轮):一条足够长的登记行,用来验证点名渲染。**'
    const seen = new Map([['G-780 收口', { marker: 'G-780 收口', line, prev: null }]])
    const legs = healLegs(seen, { disk: `${base}\n${line}`, head: base, index: base })
    const roster = healLegRoster(seen.size, legs)
    const undRoster = healLegRoster(
      seen.size,
      healLegs(seen, { disk: `${base}\n${line}`, head: base, index: null }),
    )
    return (
      roster[0].includes('[分档]') &&
      roster.some((l) => l.includes('[点名/HEAD]') && l.includes('G-780 收口')) &&
      roster.some((l) => l.includes('[点名/索引]') && l.includes('G-780 收口')) &&
      !roster.some((l) => l.includes('无缺失')) &&
      undRoster.some((l) => l.includes('[点名/索引]') && l.includes('未判定'))
    )
  })
  t('healContent:邻居还在 → 插到邻居之后,分组不散', () => {
    const target = [
      '### 段',
      '  - **G-166 第①步(第 57 轮):新立交代帧持久化,细节见提交说明。**',
      '',
    ].join('\n')
    const missing = [
      {
        marker: 'G-166 第⑤步(第 57',
        line: '  - **G-166 第⑤步(第 57 轮续):N8n 屏改用共享交代组件并回收 6 个旧取词键。**',
        prev: '  - **G-166 第①步(第 57 轮):新立交代帧持久化,细节见提交说明。**',
      },
    ]
    const { out, inserted, appended } = healContent(target, missing)
    const order = out
      .split('\n')
      .map((l) => (l.includes('第①步') ? 1 : l.includes('第⑤步') ? 2 : 0))
      .filter(Boolean)
    return inserted === 1 && appended === 0 && String(order) === '1,2'
  })
  t('healContent:邻居也没了 → 追加而不是丢弃', () => {
    const target = ['### 段', '  - 别的行', ''].join('\n')
    const missing = [
      {
        marker: 'D999z 结案',
        line: '  - **D999z 结案(第 1 轮):这是一条足够长的登记行,邻居已经不存在于当前内容里。**',
        prev: '  - 这一行在当前内容里已经不存在了',
      },
    ]
    const { out, inserted, appended } = healContent(target, missing)
    return inserted === 0 && appended === 1 && out.includes('D999z 结案')
  })
  t('healContent:幂等 —— 已存在的标记不会被二次插入', () => {
    const line = '  - **D999z 结案(第 1 轮):这是一条足够长的登记行,重复插入会被本用例抓到。**'
    const target = ['### 段', line, ''].join('\n')
    const { inserted, appended, out } = healContent(target, [
      { marker: 'D999z 结案', line, prev: null },
    ])
    return inserted === 0 && appended === 0 && out.split('D999z 结案').length - 1 === 1
  })
  // 规模安全闸正反例(2026-09-23 O24 事故反推):"丢得太多"必判基线异常,正常量必放行。
  t('规模闸:缺失占四成以上 → 判基线异常(拒绝回捞)', () => {
    const s = assessHealScale(120, 240, 0.4)
    return s.ok === false && s.reason.includes('50.0%')
  })
  t('规模闸:正常量(几条 / 恰好卡在阈值)→ 放行,不误伤真实丢失', () => {
    return assessHealScale(4, 240, 0.4).ok === true && assessHealScale(96, 240, 0.4).ok === true
  })
  t('规模闸:扫描数为 0 时不得判异常(无分母即不启用,避免空文档恒红)', () => {
    return assessHealScale(7, 0, 0.4).ok === true
  })
  t('规模闸阈值:env 非法值回落 0.4,合法的 0.9 生效', () => {
    const prev = process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO
    try {
      process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = 'not-a-number'
      const bad = healSuspectRatio()
      process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = '5'
      const over = healSuspectRatio()
      process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = '0.9'
      const okv = healSuspectRatio()
      return bad === 0.4 && over === 0.4 && okv === 0.9
    } finally {
      if (prev === undefined) delete process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO
      else process.env.IHUI_PLAN_HEAL_MAX_MISSING_RATIO = prev
    }
  })

  // ── 名额判活(multiset):同编号多处登记、吞其中一行 ────────────────────────────────
  // 现场取自真实事故:`7c22d68d09b` 入库 `### O61 领票前逐条实测…`,下一枚 `85e07c9e70b`
  // 按旧基线整文件回写把它吞掉,而 HEAD 里另有 `## O61 safe-commit…` 顶着同一个编号。
  // 集合判活(Set<id>)只能答"O61 还有登记点",答不了"O61 原本有两行" ⇒ 现版判据对着
  // 717 条历史登记行报"无缺失"。夹具与真实两行的形状同形(同前缀、不同短标题)。
  const MM1 = '### O71 名额判活夹具甲节:这一行是同一编号的第一处登记,正文足够长以入选登记行。'
  const MM2 = '### O71 名额判活夹具乙节:这一行是同一编号的第二处登记,被旧基线整文件回写时最先被吞。'
  const MM_BOTH = ['# 计划', '', MM1, '', MM2, '', '- **G-9001 无关登记行**:这一条与名额判据无关,只是让文档不像空壳。', ''].join('\n')
  const MM_SWALLOWED = MM_BOTH.split('\n').filter((l) => l !== MM2).join('\n')

  t('阳性对照:同编号两处登记、吞掉其一 ⇒ 必须点名那一行(旧集合判据在此处判活 = 本案盲区)', () => {
    const base = registeredLines(MM_BOTH).filter((e) => e.id === 'O71')
    const lost = resolveRegistrationLoss(base, MM_SWALLOWED)
    // 这一句是"改动确实修好了什么"的证据,不是装饰:旧判据的谓词是 headingIdSet(候选).has(id)
    const oldPredicateSaysAlive = headingIdSet(MM_SWALLOWED).has('O71')
    return (
      base.length === 2 &&
      oldPredicateSaysAlive === true &&
      lost.length === 1 &&
      lost[0].marker.includes('乙节') &&
      lost[0].shape === 'heading'
    )
  })

  t('不误伤:两处登记里的一处只改写文案(编号仍占行首、名额不变)⇒ 一条都不报', () => {
    const reworded = MM_BOTH.replace(
      MM2,
      '### O71 名额判活夹具乙节被重写了一遍措辞,编号仍老老实实待在行首,长度也够入选。',
    )
    const base = registeredLines(MM_BOTH).filter((e) => e.id === 'O71')
    return resolveRegistrationLoss(base, reworded).length === 0
  })

  t('退化对照:只有一行登记的编号,新旧判据结论必须逐字一致(收紧不得把既有绿灯变成红)', () => {
    const only = ['# 计划', '', MM1, '', '- 其它正文行:不带登记编号,丢了不归本闸管。', ''].join('\n')
    const gone = only.split('\n').filter((l) => l !== MM1).join('\n')
    const base = registeredLines(only).filter((e) => e.id === 'O71')
    return (
      base.length === 1 &&
      resolveRegistrationLoss(base, only).length === 0 &&
      resolveRegistrationLoss(base, gone).length === 1 &&
      headingIdSet(only).has('O71') === true &&
      headingIdSet(gone).has('O71') === false
    )
  })

  t('归档豁免对"同编号第二行"同样成立:原文逐字在归档件里 ⇒ 正当移除,不判丢', () => {
    const seen = new Map()
    for (const e of registeredLines(MM_BOTH)) if (!seen.has(e.marker)) seen.set(e.marker, { ...e, sha: 's', prev: null })
    const noArchive = missingFrom(seen, MM_SWALLOWED, () => null)
    const withArchive = missingFrom(
      seen,
      MM_SWALLOWED,
      (m) => (typeof m === 'string' && m.includes('乙节') ? 'PROJECT_PLAN_2099-01-02.md' : null),
    )
    return noArchive.length === 1 && withArchive.length === 0
  })

  t('回捞侧不得自己顶自己:编号整体消失那一类必须真插回去,且二次调用幂等', () => {
    const seen = new Map()
    // 现场:MM_BOTH 里只有 O72 一处登记,HEAD 整条没有 ⇒ 无名额可解释,属可自动回捞类
    const sole = '### O72 名额判活夹具丙节:这一处编号只有一行登记,被旧基线整块吞掉时应当自动回捞。'
    const withSole = ['# 计划', '', sole, '', '- **G-9003 无关登记行**:占位行,让文档不显得空,长度也够。', ''].join('\n')
    const gone = withSole.split('\n').filter((l) => l !== sole).join('\n')
    for (const e of registeredLines(withSole)) if (!seen.has(e.marker)) seen.set(e.marker, { ...e, sha: 's', prev: null })
    const missing = missingFrom(seen, gone, () => null)
    const once = healContent(gone, missing)
    const twice = healContent(once.out, missing)
    return (
      missing.length === 1 &&
      missing[0].multiSlot !== true &&
      once.inserted + once.appended === 1 &&
      once.out.includes(sole) &&
      once.withheld === 0 &&
      twice.inserted === 0 &&
      twice.appended === 0
    )
  })

  t('multiSlot 那一类只点名、绝不自动回捞:同编号仍有登记点时插回去就是替台账长重复登记', () => {
    const seen = new Map()
    for (const e of registeredLines(MM_BOTH)) if (!seen.has(e.marker)) seen.set(e.marker, { ...e, sha: 's', prev: null })
    const missing = missingFrom(seen, MM_SWALLOWED, () => null)
    const once = healContent(MM_SWALLOWED, missing)
    return (
      missing.length === 1 &&
      missing[0].multiSlot === true &&
      once.inserted === 0 &&
      once.appended === 0 &&
      once.withheld === 1 &&
      !once.out.includes(MM2) &&
      once.out === MM_SWALLOWED
    )
  })

  t('反向锁:逐字相同的两份副本(台账里天然成对的孪生行)删掉一份 ⇒ 不判丢、不回捞', () => {
    const dup = ['# 计划', '', MM1, '', MM1, '', MM2, ''].join('\n')
    const oneCopy = ['# 计划', '', MM1, '', MM2, ''].join('\n')
    const seen = new Map()
    for (const e of registeredLines(dup)) if (!seen.has(e.marker)) seen.set(e.marker, { ...e, sha: 's', prev: null })
    // seen 按 marker 去重 ⇒ 两份副本合成一条,删掉一份后名额仍在(§1 归并的正当形态)
    return seen.size >= 2 && missingFrom(seen, oneCopy, () => null).length === 0
  })

  t('反向锁:已作废行不得被"历史名额"重新召唤 —— 翻勾 + 注记的改写形态必须认作存活', () => {
    const closed = MM2.replace('### ', '### ').replace(
      '被旧基线整文件回写时最先被吞。',
      '已于 2099-01-02 翻勾结案并写明归并到甲节,正文保留在同一处。',
    )
    const target = ['# 计划', '', MM1, '', closed, ''].join('\n')
    const base = registeredLines(MM_BOTH).filter((e) => e.id === 'O71')
    return base.length === 2 && resolveRegistrationLoss(base, target).length === 0
  })

  t('历史面覆盖范围必须报名:有窗口点名最旧一枚与截止时刻,未跑过喊未判定,staged 档不替历史面发声', () => {
    const withWin = historyWindowNote({ depth: 60, commits: 37, oldest: 'abc123456', oldestDate: '2026-09-27' }, 'head')
    const never = historyWindowNote(null, 'head')
    const empty = historyWindowNote({ depth: 60, commits: 0, oldest: null }, 'head')
    const staged = historyWindowNote({ commits: 37, oldest: 'x' }, 'staged')
    return (
      withWin.includes('abc123456') &&
      withWin.includes('2026-09-27') &&
      withWin.includes('不在射程内') &&
      never.includes('未判定') &&
      empty.includes('未判定') &&
      staged === ''
    )
  })

  t('历史面窗口默认值不得为消红被调大:非法 / 超上限一律回落,合法值生效', () => {
    const prev = process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH
    try {
      delete process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH
      const def = historyDepth()
      process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH = 'not-a-number'
      const bad = historyDepth()
      process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH = String(HISTORY_DEPTH_MAX + 1)
      const over = historyDepth()
      process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH = '120'
      const legal = historyDepth()
      return def === HISTORY_DEPTH_DEFAULT && bad === HISTORY_DEPTH_DEFAULT && over === HISTORY_DEPTH_DEFAULT && legal === 120
    } finally {
      if (prev === undefined) delete process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH
      else process.env.IHUI_PLAN_LOSS_HISTORY_DEPTH = prev
    }
  })

  /**
   * 源码级反向锁:"判活只许一份实现"。三条消费通道只要有一条偷偷改回
   * `headIdSet(候选).has(id)` 这类**集合判活**,本案那一型就原地复活,而行为断言
   * 可能因为夹具恰好只有一处登记而一路报绿(§22c"镜像只复读实现就是复读机"同族)。
   */
  t('判据只许一份实现:检测三通道走 resolveRegistrationLoss,回捞侧走 registrationAlreadyPresent', () => {
    const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    // 按"下一个函数声明"切块,不写死下一个函数名 —— 名字一改本锁就变成空判据(§22c 同族)。
    const body = (name) => {
      const at = src.indexOf(`export function ${name}(`)
      if (at < 0) return ''
      const tail = src.slice(at)
      const stop = tail.slice(1).search(/\n(?:export )?function [A-Za-z]/)
      return stop < 0 ? tail : tail.slice(0, stop + 1)
    }
    const routes = (name, via) => {
      const b = body(name)
      return b.length > 60 && b.includes(`${via}(`) && !/headIdSet\(/.test(b) && !/headingIdSet\(/.test(b)
    }
    const slots = body('registrationSlots')
    return (
      routes('lostMarkers', 'resolveRegistrationLoss') &&
      routes('missingFrom', 'resolveRegistrationLoss') &&
      routes('stillRegistered', 'resolveRegistrationLoss') &&
      // 回捞侧必须是**幂等守卫**而不是组判据:把已判完的丢失清单再喂一次 slack 会自吞(实测)
      routes('healContent', 'registrationAlreadyPresent') &&
      body('registrationAlreadyPresent').includes('registrationSlots(') &&
      slots.includes('slot.count += 1') &&
      slots.includes('slot.markers.add(')
    )
  })

  t('退出码分档:multiSlot 在全量档只报数(--strict 才判红),在提交链那一档照旧判红', () => {
    // ① 全量档:HEAD 已经缺那一行(别人欠的账) ⇒ 不得把每次人工问责钉成恒红门(§12e)
    const swallowedRepo = faceFixtureRepo({ commits: [{ plan: MM_BOTH }, { plan: MM_SWALLOWED }] })
    // ② 提交链档:索引少那一行 = **本次提交**造成的 ⇒ 必须判红,不得跟着降级
    const stagedRepo = faceFixtureRepo({ commits: [{ plan: MM_BOTH }], index: MM_SWALLOWED })
    try {
      const soft = runCheck(false, 'head', { root: swallowedRepo })
      const hard = runCheck(false, 'head', { root: swallowedRepo, strict: true })
      const staged = runCheck(true, 'staged', { root: stagedRepo })
      return (
        soft.ok === true &&
        soft.lost.length === 0 &&
        soft.reportOnly.length === 1 &&
        soft.reportOnly[0].multiSlot === true &&
        hard.ok === false &&
        hard.lost.length === 1 &&
        staged.ok === false &&
        staged.lost.length === 1 &&
        staged.lost[0].id === 'O71'
      )
    } finally {
      rmScratch(swallowedRepo)
      rmScratch(stagedRepo)
    }
  })

  // ── 族表自检维(2026-10-19 立):声明位像编号但族表认不出 ⇒ 必须点名,且不得判红 ──
  t('族表自检:补上的族(WP-7/A36)不点名;真缺族 T12 点名;两字符短号与 P1 优先级标签一律不点名(噪音尺等于没尺);畸形号归编号形态维', () => {
    const doc = [
      '# 计划',
      '',
      '- [ ] WP-7 浏览器语义快照:补上 WP 族后必须被认出来 ⇒ 不进名单。',
      '- [ ] A36 剩下的两步:补 A 族后即被认出 ⇒ 不进名单。',
      '- [ ] P1 残余③:优先级标签不是编号,HEAD 面这种行有 11 条,进名单就是噪音尺。',
      '- [ ] T12 未知族:三字符形态且不在族表里 ⇒ 必须点名。',
      '- [ ] H2 两字符短号:与 P1 那一族无法区分 ⇒ 按门槛不点名(代价写在实现旁)。',
      '- [ ] DD9002 畸形号已有自己的编号形态维,本维不得重复报。',
      '- [ ] 这条没有编号,不该出现在任何名单里。',
    ].join('\n')
    const named = unseenRegistrantIds(doc)
    return (
      named.length === 1 &&
      named[0].line === 6 &&
      named[0].token === 'T12' &&
      headIdOf(doc.split('\n')[2]) === 'WP-7' &&
      headIdOf(doc.split('\n')[3]) === 'A36'
    )
  })
  t('族表自检定级:同一夹具多出一行隐身声明位,runCheck 的 ok 与 lost 读数必须逐字相同(新家族不该挡住任何一次提交)', () => {
    const base = '# 计划\n\n- [ ] G-9100 正常行:三面都在。\n'
    const withUnseen =
      '# 计划\n\n- [ ] G-9100 正常行:三面都在。\n\n- [ ] H2 隐身编号行:两字符编号,族表与长度门槛都不认它。\n'
    const a = faceFixtureRepo({ commits: [{ plan: base }] })
    const b = faceFixtureRepo({ commits: [{ plan: withUnseen }] })
    try {
      const ra = runCheck(false, 'head', { root: a })
      const rb = runCheck(false, 'head', { root: b })
      const n = (r) => `${r.ok}/${r.lost?.length ?? 'no-lost-field'}/${r.prose ?? 'no-prose'}`
      // 只断言"这一维不进结论":两档的读数必须逐字相同;至于 runCheck 在这一型夹具上本来的结论
      // 是什么,由上面那批既有用例管,本条不替它下判断(拿"应当为 true"去断言就是把两维混判)。
      return n(ra) === n(rb)
    } finally {
      rmScratch(a)
      rmScratch(b)
    }
  })


  // 夹具基线自带一行存量畸形号(已在 HEAD)与一行正常登记行:
  //  · 注入档 ⇒ added 点名新增行、preexisting 只剩存量 ⇒ 判红;
  //  · 摘完重复前缀的正常行 ⇒ added=0 ⇒ 判绿(存量仍报名,不得静默)。
  // ── 编号形态维(G-722):本次新增即判红,存量只报数(成对档注入/摘前缀)──────────────
  const MAL_BASE = [
    '# 计划',
    '',
    '- [ ] G-9001 形态维基线行:这一行三面都在,用来确认注入只动了要动的那一行。',
    '',
    '- [ ] DD9002 存量畸形号(台账历史遗留):已在 HEAD ⇒ 只报数;当场判红就是恒红门(§12e)。',
    '',
  ].join('\n')
  const MAL_ADDED = '- [ ] G-G-987 注入的畸形新增行:族名在编号段出现两次,必须被本判据点名,长度足够。'
  const MAL_NORMAL = '- [ ] G-987 摘掉重复族名后的正常登记行:与注入行只差编号形态,必须判绿,长度也够。'
  t('编号形态(必红档):索引新增一行畸形号 ⇒ staged 判红且点名该行;HEAD 里的存量只进 preexisting 不判红', () => {
    const dir = faceFixtureRepo({
      commits: [{ plan: MAL_BASE }],
      index: `${MAL_BASE}\n${MAL_ADDED}\n`,
    })
    try {
      const r = runCheck(true, 'staged', { root: dir })
      return (
        r.ok === false &&
        r.lost.length === 0 &&
        r.malformed.red === true &&
        r.malformed.added.length === 1 &&
        r.malformed.added[0].family === 'G' &&
        r.malformed.preexisting.length === 1 &&
        r.malformed.preexisting[0].family === 'D'
      )
    } finally {
      rmScratch(dir)
    }
  })
  t('编号形态(必绿档/成对反向):同一行摘完重复前缀 ⇒ staged 判绿,存量畸形号仍报名不静默', () => {
    const dir = faceFixtureRepo({
      commits: [{ plan: MAL_BASE }],
      index: `${MAL_BASE}\n${MAL_NORMAL}\n`,
    })
    try {
      const r = runCheck(true, 'staged', { root: dir })
      return (
        r.ok === true &&
        r.malformed.added.length === 0 &&
        r.malformed.red === false &&
        r.malformed.preexisting.length === 1
      )
    } finally {
      rmScratch(dir)
    }
  })
  t('编号形态(全量档):HEAD 自身带着畸形号 ⇒ 缺省档只报数不判红(§12e 恒红门禁令),worktree 才判新增', () => {
    const dir = faceFixtureRepo({ commits: [{ plan: `${MAL_BASE}\n${MAL_ADDED}\n` }] })
    try {
      const head = runCheck(false, 'head', { root: dir })
      // 工作树把新增行删掉 ⇒ 相对 HEAD 没有"新增",worktree 档也不得因此判红(存量在 HEAD 里)
      const wt = runCheck(false, 'worktree', { root: dir })
      return (
        head.ok === true &&
        head.malformed.red === false &&
        head.malformed.preexisting.length === 2 &&
        wt.ok === true &&
        wt.malformed.red === false &&
        wt.malformed.added.length === 0
      )
    } finally {
      rmScratch(dir)
    }
  })

  // 归并名额维(2026-10-24 立):纯函数 + 构造面自证,不碰仓库瞬时状态(承 1863 行那条纪律)
  t('归并名额维(判活):同题副本删任意一份都点名,唯一行被吞归丢失维不点名', () => {
    const A = '- [ ] G-70 同题副本甲态:已接线未配置,凭据已核实填入环境文件(剩余卡点是实名资质零条)'
    const B = '- [ ] G-70 同题副本乙态:待控制台建应用取 AppId 并报签名与四枚场景模板后再填环境键'
    const L = '- [ ] G-71 唯一登记行:整份面上只有这一条带着这个编号,它消失属丢失维而非名额维。'
    const both = ['# 计划', '', A, B, '', L, ''].join('\n')
    const f1 = foldedSlots(both, both.split('\n').filter((l) => l !== B).join('\n'))
    const f2 = foldedSlots(both, both.split('\n').filter((l) => l !== A).join('\n'))
    const f3 = foldedSlots(both, both.split('\n').filter((l) => l !== L).join('\n'))
    return (
      f1.length === 1 &&
      f1[0].id === 'G-70' &&
      f1[0].from === 2 &&
      f1[0].to === 1 &&
      f2.length === 1 &&
      f2[0].id === 'G-70' &&
      f3.length === 0
    )
  })

  t('归并名额维(声明解析):空与缺失得空集,清单去重保序;声明本身不是开关', () => {
    const d1 = parseMergeFoldDeclaration('G-70, G-71')
    const d2 = parseMergeFoldDeclaration('G-70,G-70 G-71')
    return (
      d1.join(',') === 'G-70,G-71' &&
      d2.join(',') === 'G-70,G-71' &&
      parseMergeFoldDeclaration('').length === 0 &&
      parseMergeFoldDeclaration(undefined).length === 0
    )
  })

  /**
   * 「已收拢」第三形态(2026-10-24)。判据口径与立因写在 `COLLECTED_TITLE_SPAN` 的头注里,
   * 这里只钉四件事:① 生产面的注释形状(前导装饰被洗断 + 注释尾部挂原行没有的进展注记)必须
   * 认成"在册";② 加粗族(a 族)的编号被写成句中形态时,老口径逐字断链 ⇒ 必须由新形态接住;
   * ③ 四条反例一条都不许被豁免(同号不同题 / 注释在位而题面被换 / 已归档族 / 题面短到无法判);
   * ④ 检测通道与回捞通道读同一个谓词 —— 同批夹具上"已收拢"与"仍判缺"两个集合必须不相交。
   */
  const D3_HOLDER =
    '- [ ] G-880320 同组持有行 —— 收拢后每组只保留这一行当前状态,正文足够长以越过登记行长度门槛。'
  const D3_CB =
    '- [ ] G-880321 **第三形态夹具甲 —— 生产面漂移注释的正文会把前导装饰洗断还会挂上原行没有的注记。** —— 尾段。'
  const D3_BOLD =
    '- **G-880322 第三形态夹具乙 —— 加粗族编号在注释里写成句中形态老口径逐字断链。** —— 尾段。'
  const D3_TRUE =
    '- [ ] G-880323 第三形态夹具丙 —— 真丢对照:面上没有任何承接,必须照旧判缺并被回捞,不许为消红读成找到了。'
  const D3_NOTE_CB =
    '<!-- 重复副本(第三形态夹具甲系列,正主 L9): 进行中） G-880321 **第三形态夹具甲 —— 生产面漂移注释的正文会把前导装饰洗断还会挂上原行没有的注记。** —— 尾段。 〔PROGRESS@2026-10-24 探针席: 追加了一段原行没有的进展注记〕 -->'
  const D3_NOTE_BOLD =
    '<!-- 漂移副本(同题多号收拢@2026-10-24/夹具): **第三形态夹具乙 —— 加粗族编号在注释里写成句中形态老口径逐字断链。** —— 尾段。 (原编号 G-880322) -->'
  const D3_BASE = [D3_CB, D3_BOLD, D3_TRUE].join('\n')
  const D3_FACE = [D3_HOLDER, D3_NOTE_CB, D3_NOTE_BOLD].join('\n')

  t('第三形态(阳性对照):生产形漂移注释(装饰被洗 + 额外注记 + 句中编号)⇒ 判「已收拢」不判缺', () => {
    const sink = []
    const lost = lostMarkers(D3_BASE, D3_FACE, new Set(), sink)
    const sunk = sink.map((s) => s.id ?? '(无行首编号)')
    return (
      lost.length === 1 &&
      /G-880323/.test(lost[0].marker) &&
      sink.length === 2 &&
      sunk.includes('G-880321') &&
      collectedInDriftComment({ line: D3_BOLD }, driftCollectedCorpus(D3_FACE)).matched === true &&
      collectedInDriftComment({ line: D3_CB, id: 'G-880321' }, driftCollectedCorpus(D3_FACE)).matched === true
    )
  })

  t('第三形态(反向锁四条):同号不同题 / 题面被换 / 已归档族 / 题面短到无法判 ⇒ 一条都不许豁免', () => {
    // ① 同号不同题:注释带着这个编号,但写的是另一件事
    const sameIdOtherTitle = [
      D3_HOLDER,
      '<!-- 漂移副本(同题多号收拢@2026-10-24/夹具): **G-880321 完全不相干的另一件事,题面一个字都对不上。** —— 尾段。 -->',
    ].join('\n')
    const l1 = lostMarkers(D3_CB, sameIdOtherTitle).length
    // ② 注释在位而正文被换(等价于①的另一写法,单独钉:防止有人把"注释存在"当免死牌)
    const l2 = lostMarkers(
      D3_TRUE,
      '<!-- 漂移副本(同题多号收拢@2026-10-24/夹具): **与此探针毫无关系的一段话,题面完全不同不得豁免。** -->',
    ).length
    // ③ 已归档( 一族刻意不进射程(完整原文归 archivedCopy 承接)
    const archivedShape = [
      D3_HOLDER,
      '<!-- 已归档(2026-10-24:G-880321 正文截断,完整内容在 .ihui-agent/archive/PROJECT_PLAN_x.md -->',
    ].join('\n')
    const l3 = lostMarkers(D3_CB, archivedShape).length
    // ④ 题面短到无法判 ⇒ unjudged ⇒ 照旧判缺(§0.3:没判绝不写成判过)
    const shortRow = '- [ ] G-880325 短句甲'
    const shortFace =
      '<!-- 漂移副本(同题多号收拢@2026-10-24/夹具): G-880325 短句甲 -->'
    const cm = collectedInDriftComment({ line: shortRow, id: 'G-880325' }, driftCollectedCorpus(shortFace))
    return l1 === 1 && l2 === 1 && l3 === 1 && cm.matched === false && cm.unjudged === true
  })

  t('第三形态(两把尺同判):检测通道判缺的集合与「已收拢」集合必须不相交,回捞侧刹车按同一谓词放行', () => {
    const sink = []
    const lost = lostMarkers(D3_BASE, D3_FACE, new Set(), sink)
    const both = lost.filter((x) => sink.some((s) => s.marker === x.marker))
    // 回捞侧:把基线三条**原样**当成 missing 清单硬喂进来(模拟任何绕过检测侧的调用方;
    // marker 一律取 registeredLines 的真读数,不手写短 marker —— 手写会把"编号在注释里出现过"
    // 这一型误判成"已在面",测的就不是新谓词了)。已收拢那两条必须一条不插,真丢那条必须插回。
    const before = `${D3_FACE}\n`
    const fake = registeredLines(D3_BASE).map((e) => ({ ...e, prev: D3_HOLDER }))
    const healed = healContent(before, fake)
    const added = healed.out.split(/\r?\n/).filter((l) => !before.split(/\r?\n/).includes(l))
    return (
      both.length === 0 &&
      sink.length === 2 &&
      fake.length === 3 &&
      healed.inserted === 1 &&
      healed.skippedCollected === 2 &&
      added.length === 1 &&
      /G-880323/.test(added[0]) &&
      !added.some((l) => /G-88032[12]/.test(l))
    )
  })

  let failed = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) failed++
  }
  console.log(`\nself-test: ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0 ? 0 : 1
}

/**
 * 回捞 + (可选)前向恢复提交。
 * 返回退出码:0 = 无需恢复或已恢复成功;1 = 恢复失败(不动历史,交人工)。
 */
/**
 * 回捞行的**出处**(该登记行最后出现在哪一枚提交里)。
 * 打印它有两个作用:① 人工核验时不必再跑一遍 `git log -S`;② `historyMarkers` 的 `sha` 字段
 * 由此变成**有消费者**的字段 —— 上一版它只在构造点被引用,批量读迁移时构造点写成未定义标识符,
 * `--heal` 从此每次抛 ReferenceError,而 post-commit 的 `|| true` 把它吞成静默失效。
 * 取不到就如实打印「未知来源」,不把「字段没了」伪装成「这行没有出处」。
 */
function src7(entry) {
  return entry.sha ? String(entry.sha).slice(0, 9) : '未知来源'
}

function heal(commit) {
  // 自愈层只**告警**不拒跑:摘线时它恰恰是唯一还能把行捞回来的东西,拒绝执行等于见死不救
  guardWiring(false)
  const head = git(['show', `HEAD:${PLAN}`])
  const disk = readFileSync(path.join(ROOT, PLAN), 'utf8')
  /**
   * 索引面(共享主索引里那份 blob)—— G-816708 补的第三个比较目标。取法走取材层那一份实现
   * (`cat-file --batch` 的 `:PLAN` 规格),不在本函数里另派一次 git,也不退回磁盘副本:
   * 取不到就是**未判定**(`null`),由 `healLegs` 单独成档,绝不折成"缺 0 条"。
   */
  const index = readSpecOrNull(`:${PLAN}`, ROOT)
  const seen = historyMarkers()
  // 已结清短留痕:窗口内观察到的 retired 落盘,供窗口外轮次拒绝复插(G-61 型)。
  const retiredAdded = recordRetiredMarkers(lastHistoryRetired(), ROOT)
  if (retiredAdded) {
    console.log(
      `ℹ️ [已结清短留痕] 记录 ${retiredAdded} 个已勾销 marker(${RETIRED_LEDGER_REL});窗口外不再把它们复插成未勾`,
    )
  }
  /**
   * 工作区、HEAD、索引**分别**判缺失。只看工作区会留一个洞:并发会话走 commit-tree 旁路
   * (git-sync-converge / 临时索引提交)时钩子根本不跑,它把某行从 HEAD 合掉后,
   * 共享工作区里那一行往往还在 → 单一目标会"无缺失"提前返回,HEAD 从此永远缺着。
   * 只看 HEAD + 工作区又留第二个洞:旁路落地同时动 HEAD 与索引,索引那份旧 blob 是**下一次
   * 提交真要带走**的内容,而它此前从不被比 —— 账面读起来像"每一轮都比过了、什么都没缺"。
   */
  const legs = healLegs(seen, { disk, head, index })
  const diskMissing = legs.disk
  const headMissing = legs.head
  const indexMissing = legs.index
  /**
   * ── 循环熔断(G-307 票一③)──
   * 同一 marker 在近若干枚提交里被**两个自动层**反复触碰 ⇒ 这不是"行丢了",而是两层互咬:
   * 回捞补回的未勾形态会立刻被门 130 再翻勾,再翻勾又被本层读成丢行。此时继续自动动作
   * 只会往共享历史里塞成对的空转提交,并把别人的真实丢失淹在噪声里。
   * 处置:**跳过这些行的自动动作 + 大声点名 + 退出码仍为 0**(自动档少做一件事不是错误;
   * 把它做成 blocking 就是与任何提交无关的恒红门,唯一结局是逼人 --no-verify —— §12e 同型)。
   * 判不出 ⇒ 照旧执行并点名"未判定",绝不把"没量到"读成"在循环"或"不在循环"。
   * 只问工作树 + HEAD 两档的 marker:**索引档是只点名不写盘的档**,没有自动动作可言,
   * 不进熔断筛选、照旧只报名。
   */
  const loop = loopTripsForMarkers([...diskMissing, ...headMissing].map((m) => m.marker), {
    root: ROOT,
  })
  const trippedMarkers = new Set(loop.tripped.map((t) => t.marker))
  const diskDoable = diskMissing.filter((m) => !trippedMarkers.has(m.marker))
  const headDoable = headMissing.filter((m) => !trippedMarkers.has(m.marker))
  if (loop.tripped.length) {
    console.error(
      `🛑 [plan-line-loss] 循环熔断:${loop.tripped.length} 个 marker 在近 ${loopWindowCommits()} 枚提交内被自动层触碰 ≥${loopBreakerMin()} 次 —— **本轮不回捞这些行**(少做一件事不是错误,交人工判):`,
    )
    for (const t of loop.tripped)
      console.error(
        `     · 「${t.marker}」触碰 ${t.touches} 次 —— ${t.commits.join(' / ')}\n       出路:确认归并器的翻勾形态是否又把行首编号挪走(现判据:正文必须留在行首),人工把这行定成"已完成"或"仍在做"并写明归属,而不是让两个自动层继续互相顶。`,
      )
  }
  if (loop.undetermined.length)
    console.error(
      `   ℹ️ 熔断未判定 ${loop.undetermined.length} 个 marker(${loop.undetermined
        .slice(0, 3)
        .map((u) => `${u.reason}`)
        .join(' / ')}${loop.undetermined.length > 3 ? ' …' : ''})—— 照旧回捞,不据"没量到"下结论`,
    )
  /**
   * 三档结论**分开报**,不得合成一个数(2026-09-26):"工作树缺"通常是别人那份滞后的在飞副本,
   * 处置是等它自己的持有者提交;"HEAD 缺"才是已入库的行被旁路提交合掉,处置是前向恢复提交;
   * "索引缺"是下一次提交真要带走的那份,处置是把索引拉回 HEAD(只动暂存面,不动工作树)。
   * 混成一个结论会让人拿工作树去"修"HEAD(= §12 禁止的覆盖),或反之把该恢复的行当成噪音跳过。
   */
  for (const line of healLegRoster(seen.size, legs, loop)) console.log(line)
  // 族表自检:隐身声明位逐条点名(只报数、不进退出码;理由见 unseenRegistrantIds 头注)。
  // 取 **HEAD 面**那份正文(与"下一次提交要带走的内容"同形),不取磁盘 —— 盘上副本常年滞后。
  for (const u of unseenRegistrantIds(head))
    console.log(
      `ℹ️  [族表自检] L${u.line} 声明位 ${u.token} 不被编号族认出 ⇒ 防丢面/复合主键/撞号三重看不见它:${u.head}`,
    )
  if (legs.allClean) {
    console.log(`✅ [plan-line-loss] 扫描 ${seen.size} 条登记行:无缺失,无需回捞`)
    return 0
  }
  /**
   * 熔断命中后 `allClean` 不再是正确的早退判据:它只问"缺不缺",而此刻"缺的那些全在熔断清单里"
   *  ⇒ 缺、但本轮无事可做。所以早退分两句:三面全绿走上面那句既有文案;两档可写盘的缺失
   * 全部落在熔断清单里走这一句(索引档只点名不写盘,不掺进"有没有事可做"的判断)。
   * 退出码恒为 0(§12e):熔断不参与退出码,自动档少做一件事不是错误。
   */
  if (loop.tripped.length && diskDoable.length === 0 && headDoable.length === 0) {
    console.log('🛑 [plan-line-loss] 本轮只发现熔断项 ⇒ 不回捞、不建提交(退出码 0:自动档少做一件事不是错误)')
    return 0
  }
  // 规模安全闸:回捞量异常 ⇒ 判为基线错(活文档被并发重排/改写措辞),拒绝自动写盘。
  // ⚠️ 刻意**只取工作树/HEAD 两档**(G-816708 没有改这一条):共享主索引在本仓常年滞后是常态,
  // 把它算进 max 会让这道闸替别人的暂存面,把真需要回捞的 HEAD 档一起拒掉 —— 那是"该修的没人修",
  // 比多一层保守更坏。索引档只点名、不参与任何写盘判据(见下面那一档的边界说明)。
  const scale = assessHealScale(Math.max(diskMissing.length, headMissing.length), seen.size)
  if (!scale.ok) {
    console.error(
      `❌ [plan-line-loss] 规模安全闸拦截 —— ${scale.reason}` +
        `(取两档较大者判量:工作树缺 ${diskMissing.length} / HEAD 缺 ${headMissing.length};索引档只点名不参与判量)` +
        (indexMissing && indexMissing.length
          ? `(另有索引档缺 ${indexMissing.length} 条,仍需人工收口)`
          : ''),
    )
    console.error(
      '   一次回捞四成以上登记行,几乎不可能是"真的全丢了",而是比对基线已变(并发会话重排了文档、\n' +
        '   或把同一条登记改写了措辞)。此时照单回捞 = 把同一内容的两个版本都留下,造出两份真相。\n' +
        '   请先人工确认:① HEAD 与工作区哪个是期望形态;② 缺失行的原文能否在 archive 里找到(§1 归档)。\n' +
        '   确认确为真实丢失后再临时放行:IHUI_PLAN_HEAL_MAX_MISSING_RATIO=1 node scripts/check-plan-line-loss.mjs --heal\n' +
        '   (紧急跳过整道自愈:HUSKY_SKIP_PLAN_HEAL=1)',
    )
    return 1
  }
  let inserted = 0
  let appended = 0
  if (diskDoable.length) {
    const healed = healContent(disk, diskDoable)
    inserted = healed.inserted
    appended = healed.appended
    console.warn(
      `⚠️  [plan-line-loss] 工作区缺 ${diskDoable.length} 条登记行(另有 ${diskMissing.length - diskDoable.length} 条已熔断不回捞)→ 回插 ${inserted} 条(邻居在)+ ${appended} 条(追加):`,
    )
    for (const m of diskDoable) console.warn(`     · ${m.marker}(回捞自 ${src7(m)})`)
    if (healed.out !== disk) writeFileSync(path.join(ROOT, PLAN), healed.out, 'utf8')
  }
  if (headDoable.length) {
    console.warn(
      `⚠️  [plan-line-loss] HEAD 缺 ${headDoable.length} 条登记行(被旁路提交合掉,工作区可能仍留着;另有 ${headMissing.length - headDoable.length} 条已熔断不回捞):`,
    )
    for (const m of headDoable) console.warn(`     · ${m.marker}(HEAD 侧,回捞自 ${src7(m)})`)
  }
  /**
   * 索引档(G-816708 补的第三个比较目标):**只点名,不回写**。
   * 为什么不回写:共享主索引里那一份可能属于别人尚未提交的暂存内容,替它写 blob = 代收别人的
   * 暂存区(§12 红线),后果比"少一次自动修"重得多;而这一档的后果已经由提交链上的
   * `--staged`(索引 vs HEAD)那一档拦住 —— 前提是它先被**点名**,否则下一次提交的人根本不知道
   * 自己正带着一次写回旧版。所以本层的职责到"报名 + 给出口"为止。
   */
  if (indexMissing && indexMissing.length) {
    console.warn(
      `⚠️  [plan-line-loss] 共享主索引缺 ${indexMissing.length} 条登记行(旁路落地会同时推进 HEAD 与索引 ⇒ 这一档不是"盘上的旧副本"那么无害):`,
    )
    for (const m of indexMissing) console.warn(`     · ${m.marker}(索引侧,回捞自 ${src7(m)})`)
    console.warn(
      '   能力边界:本层**不回写共享主索引** —— 索引里那一份可能是别人尚未提交的暂存内容,\n' +
        '   替它落 blob = 代收别人的暂存区(§12 红线)。先问一句:索引这份是谁的?\n' +
        '   ① 是别人在飞的暂存 ⇒ 由持有者自己重归并,本层不动;\n' +
        '   ② 是一次滞后写回的残留(没有人在飞的暂存)⇒ 只把索引拉回 HEAD、不动工作树:\n' +
        '      ' +
        '`git restore --source=HEAD --staged -- PROJECT_PLAN.md`' +
        `\n   不处理的后果:任何人一枚不带 pathspec 的普通提交就把这 ${indexMissing.length} 行再次抹掉(而提交链上的 --staged 那档会当场判红)。`,
    )
  } else if (legs.indexUndetermined) {
    console.warn(
      '⚠️  [plan-line-loss] 索引面取不到(该路径不在索引里 / unmerged / git 问不到)⇒ **索引那一档未判定**,' +
        '不得据此宣布"无缺失"(未判定与通过不并桶)。',
    )
  }
  /**
   * 标题级丢失的**能力边界必须如实说明**:healContent 只逐行回捞,把 `## O42 …` 这一行插回
   * 邻居之后,但它不知道整节正文去了哪、也无从恢复从属关系(正文多为非登记行,本就不在回捞面)。
   * 所以这里只报"标题行已回插、层级需人工归并",绝不打"整节已恢复"这类做不到的结论。
   */
  const headingLost = new Map()
  for (const m of [...diskDoable, ...headDoable])
    if (m.shape === 'heading' && !headingLost.has(m.marker)) headingLost.set(m.marker, m)
  if (headingLost.size) {
    const ids = [...new Set([...headingLost.values()].map((m) => m.id ?? m.marker))].join('、')
    console.warn(
      `⚠️  [plan-line-loss] 其中 ${headingLost.size} 条是**任务条目标题**(${ids})——\n` +
        `     自愈只能把标题这一行插回去,**无法重建"标题 + 其下整节正文"的从属关系**;\n` +
        `     标题级丢失需人工归并:` +
        '`git log --all -S "<标题>" -- PROJECT_PLAN.md`' +
        ` 定位原提交,\n` +
        `     再 ` +
        '`git show <sha>:PROJECT_PLAN.md`' +
        ` 把**整节**原文一起插回原锚点(AGENTS.md §12b 协作收尾)。`,
    )
  }
  if (!commit) {
    console.log('   (未加 --commit:只写工作区,不建提交)')
    return 0
  }
  if (headDoable.length === 0) {
    console.log(
      headMissing.length > 0
        ? `   HEAD 缺的 ${headMissing.length} 条全部落在熔断清单里 ⇒ 不建恢复提交(交人工,见上面 🛑)`
        : '   HEAD 已含全部登记行,无需建恢复提交' +
          (indexMissing && indexMissing.length
            ? `(但**索引档那 ${indexMissing.length} 行仍未收口** —— 本层不回写共享索引,处置见上面索引档)`
            : ''),
    )
    return 0
  }
  const msgFile = path.join(ROOT, '.ihui-agent/tmp', `plan.heal.${Date.now()}.msg`)
  // post-commit 里这条链是 `... || true`,目录不存在会让恢复提交**静默失败** → 先确保目录在
  mkdirSync(path.dirname(msgFile), { recursive: true })
  // 提交用的基线**必须是 HEAD**,不能用刚写盘的工作区内容 —— 工作区可能带着别人
  // 尚未提交的行,拿去建提交等于代收(§12 暂存区污染红线)。
  const healedHead = healContent(head, headDoable).out
  if (healedHead === head) {
    console.log('   回捞后 HEAD 内容与当前一致,不建空提交')
    return 0
  }
  writeFileSync(
    msgFile,
    // 首行的 `docs(plan): 自动回捞` 前缀是循环熔断认"这一枚出自自动层"的**唯一**凭据
    // (AUTO_LAYER_SUBJECT_RE),改写措辞可以,前缀不许挪 —— 挪了熔断就看不见自己的产出,
    // 而熔断看不见产出等于没有熔断(§22c"判据必须覆盖门自己产出的形态")。
    `docs(plan): 自动回捞 ${headDoable.length} 条被并发旧基线提交抹掉的登记行\n\n` +
      `由 scripts/check-plan-line-loss.mjs --heal --commit 生成:按最近历史逐条取回原文,` +
      `插回各自邻居之后(邻居也缺席则追加到末尾)。只加不减。\n` +
      (headMissing.length - headDoable.length
        ? `(另有 ${headMissing.length - headDoable.length} 条因循环熔断本轮**未回捞**,清单见提交时的 🛑 输出。)\n`
        : '') +
      (diskDoable.length ? `(同轮工作区另回插 ${inserted}+${appended} 条,不入本次提交。)\n` : ''),
    'utf8',
  )
  const tmp = path.join(ROOT, '.ihui-agent/tmp', `plan.heal.${Date.now()}.md`)
  writeFileSync(tmp, healedHead, 'utf8')
  const blob = git(['hash-object', '-w', tmp]).trim()
  const parent = git(['rev-parse', 'HEAD']).trim()
  const idx = path.join(ROOT, '.ihui-agent/tmp', `index-plan-heal-${Date.now()}`)
  const env2 = { ...process.env, GIT_INDEX_FILE: idx }
  /**
   * 2026-10-08 **刻意不迁 gitRaw**(与 scripts/lib/bypass-git.mjs 的 `git()` 同一条不可迁账):
   * 本函数(及紧邻的 commit-tree)必须把 `GIT_INDEX_FILE` 经 opts.env **显式注入**派生 ——
   * 临时索引提交的落地通道,绝不允许从 caller shell 漏进来;而 gitRaw 的 opts 只有
   * {input,timeout,maxBuffer,binary},无 env 形态。派生形态(execFileSync + stdio
   * ['ignore','pipe','pipe'] + 各自 maxBuffer + timeout 缺省)一字未动;二进制取数已随
   * 上方 GIT 绑定改走层 gitBinary()。
   */
  const g2 = (a, o = {}) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: ROOT,
      encoding: 'utf8',
      env: env2,
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      ...o,
    }).trim()
  try {
    g2(['read-tree', parent])
    g2(['update-index', '--add', '--cacheinfo', `100644,${blob},${PLAN}`])
    const tree = g2(['write-tree'])
    const newCommit = execFileSync(
      GIT,
      ['-c', 'safe.directory=*', 'commit-tree', tree, '-p', parent, '-F', msgFile],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: env2,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).trim()
    g2(['update-ref', 'refs/heads/main', newCommit, parent])
    // 留痕失败不得改变"回捞已落地"这一结论(提交已在 refs/heads/main 上),但必须喊出来:
    // 静默少一行留痕,下一次审计就会把这枚当成"绕门塞进来的"。
    const at = attestBypassCommit(newCommit, { root: ROOT, headBefore: parent, source: 'check-plan-line-loss:heal' })
    if (!at.ok) console.error(`⚠️ [plan-line-loss] 旁路留痕未写入(${at.why})⇒ 这一枚在跳门总量台账里仍是 unknown`)
    console.log(
      `   已建前向恢复提交 ${newCommit.slice(0, 11)}` +
        (indexMissing && indexMissing.length
          ? `(只修 HEAD;共享主索引仍缺那 ${indexMissing.length} 条登记行 ⇒ 索引档未收口,处置见上面)`
          : ''),
    )
    try {
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'git-push-guard.mjs')], {
        cwd: ROOT,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
    } catch {
      /* 推送交后台守卫,失败不影响本次恢复 */
    }
  } catch (e) {
    console.error(`❌ [plan-line-loss] 恢复提交失败:${e?.message ?? e}`)
    return 1
  } finally {
    rmSync(idx, { force: true })
    rmSync(tmp, { force: true })
    rmSync(msgFile, { force: true })
  }
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href

if (isDirectRun) {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  if (args.includes('--heal')) {
    // 从最近历史回捞被"旧基线整文件提交 / 索引层合并"抹掉的登记行,写回工作区文件。
    // 默认只改工作区(由调用方决定何时提交);--commit 额外走一次"临时 index + commit-tree"
    // 的前向恢复提交,并交给 git-push-guard 推送(绕过钩子的并发提交模式,与 AGENTS §12 一致)。
    process.exit(heal(args.includes('--commit')))
  }
  if (process.env.HUSKY_SKIP_PLAN_LINE_LOSS === '1') {
    console.warn('⚠️  HUSKY_SKIP_PLAN_LINE_LOSS=1,已跳过计划登记行防丢守门')
    process.exit(0)
  }
  // 提交链/CI 上的 check 模式:**先验自己还在不在链上**。摘线时若照常报"无丢失",
  // 那就是最坏的一种绿 —— 门没跑,却以门的名义宣布通过。
  guardWiring(true)
  /**
   * 选面走取材层的 `selectFace`(三门共用的唯一实现)。两面旗同时给 ⇒ 判死,不猜优先级,也
   * **不回落**到另一个面(回落就是把"没判"写成"判过了" —— 守门 124 的 mobile-rn 那条收口记过同一型)。
   */
  const { face, error: faceError } = selectFace({
    staged: args.includes('--staged'),
    worktree: args.includes('--worktree'),
    def: 'head',
  })
  if (faceError) {
    console.error(`❌ [plan-line-loss] ${faceError}:拒绝判定,取哪一面都会让另一面成为假绿`)
    process.exit(2)
  }
  const notice = faceNoticeFor(face)
  if (notice) console.warn(notice)
  try {
    const {
      ok,
      lost,
      collected,
      prose,
      malformed,
      undetermined,
      reason,
      scanned,
      window,
      reportOnly,
      folded,
      foldUndeclared,
      foldUnused,
    } = runCheck(
      face === 'staged',
      face,
      { root: ROOT, strict: args.includes('--strict') },
    )
    if (undetermined) {
      // 既不记绿也不冒红:结论行必须喊"无法判定"并点名原因(无提交 / 浅克隆 / git 失败 / 空扫)
      console.error(`⚠️  [plan-line-loss] 无法判定:${reason}`)
      process.exit(2)
    }
    /** 非登记行丢失只报数(理由见 proseLossReport 注释);阈值只影响措辞强度,不改变退出码 */
    const reportProse = () => {
      if (!prose?.lostCount) return
      const head =
        prose.lostCount >= 100
          ? `❗ [plan-line-loss] 非登记行丢失 ${prose.lostCount} 行(≥100 高度疑似"旧基线整文件提交")`
          : `ℹ️ [plan-line-loss] 非登记行比 HEAD 少 ${prose.lostCount} 行`
      const srcNote =
        face === 'staged' ? '' : '\n     (该差值量的是**工作树副本 vs HEAD**,只是"你本地滞后"的旁证,不参与判定)'
      console.warn(
        `${head} —— 本闸只锚编号登记行,这类行**不在红灯判据内**。\n` +
          prose.sample.map((l) => `     样例: ${l.slice(0, 88)}`).join('\n') +
          `\n     自查:确认这些行是否已被有意改写/归档(归档须落 .ihui-agent/archive/PROJECT_PLAN_*.md);\n` +
          `           若确属误覆盖,${
            face === 'staged'
              ? '按上面 1) 的三步从 HEAD 逐行取回后再提交。'
              : '走 --heal(只写工作区)或 --heal --commit(建前向恢复提交),不要手工拿 HEAD 覆盖在飞副本。'
          }${srcNote}`,
      )
    }
    /**
     * 编号形态维的两段输出(G-722)。红段(本次新增)进 stderr 并参与退出码;
     * 存量段只报数且**必须报名** —— 静默省略就是把没判写成判过了(本仓最高频失效型)。
     */
    const printMalformedAdded = () => {
      if (!malformed || !malformed.added.length) return
      console.error(
        `❌ [plan-line-loss] 判定面(${FACE_LABEL[face]})上出现本次新增的畸形登记编号 ${malformed.added.length} 行` +
          '(族名在编号段出现两次)⇒ 判红:\n' +
          malformed.added
            .slice(0, 4)
            .map((x) => `   · [族 ${x.family}] ${malformedLine(x)}`)
            .join('\n') +
          (malformed.added.length > 4 ? `\n   …另 ${malformed.added.length - 4} 行未列出` : ''),
      )
      console.error(
        '   改法:删掉编号段里重复的那个族名(例:族名单写两遍 → 只留一遍)。判据与 scripts/live-doc-edit.mjs\n' +
        '   共用同一份实现;经本器落地的内容在写 blob 前已被拦过,这一档补的是 git add + git commit /\n' +
        '   safe-commit 按 pathspec 那条此前无人看守编号形态的路径。存量畸形号只报数不判红(§12e)。\n',
      )
    }
    const printMalformedStock = () => {
      if (!malformed) return
      if (malformed.undetermined) {
        console.warn('⚠️  [plan-line-loss] 编号形态维未判定:HEAD 基准面取不到 ⇒ 不判新增,也不记通过。')
        return
      }
      if (malformed.preexisting.length) {
        console.warn(
          `ℹ️  [plan-line-loss] 判定面上有 ${malformed.preexisting.length} 行畸形登记编号,均为存量(锚点=该文件 HEAD 自身存量)` +
            ' ⇒ 只报数不判红:\n' +
            malformed.preexisting
              .slice(0, 5)
              .map((x) => `   · ${malformedLine(x)}`)
              .join('\n') +
            (malformed.preexisting.length > 5 ? `\n   …另 ${malformed.preexisting.length - 5} 行未列出` : ''),
        )
      }
    }
    /**
     * 三类读数必须逐类报(票面验收第 3 条):
     *  · **本轮不动** = 其余在册条目,判据一条没碰(报总数,不逐条);
     *  · **仍判缺**   = 走完全部通道仍判"原文不在这张面上"的那些(= 上面那份丢失清单);
     *  · **已收拢**   = 凭漂移注释(编号 + 题面前 `COLLECTED_TITLE_SPAN` 字逐字对上)认下来的那些,
     *                   逐条点名 —— "没判成缺"这件事不留下名字就等于没留下证据(§12f)。
     */
    const printCollected = () => {
      const n = collected ? collected.length : 0
      // 三类读数只有**历史面**才量得齐(staged 档的基线就是 HEAD,没有"基线总数"这个数)。
      if (scanned > 0) {
        const manual = reportOnly ? reportOnly.length : 0
        const untouched = Math.max(0, scanned - n - lost.length - manual)
        console.log(
          `ℹ️ [plan-line-loss] [三类读数/${FACE_LABEL[face]}] 历史面登记行 ${scanned} 条 ⇒ ` +
            `本轮不动 ${untouched} / 已收拢(第三形态) ${n} / 仍判缺 ${lost.length}` +
            `${manual ? ` / 同编号仍占名额只报数 ${manual}` : ''}`,
        )
      }
      if (!n) return
      console.warn(
        `ℹ️  [plan-line-loss] 其中 ${collected.length} 条登记行的原文只住在 PROJECT_PLAN.md 的漂移注释里` +
          `(编号 + 题面前 ${COLLECTED_TITLE_SPAN} 字逐字对上)⇒ 判「已收拢在册」,不判缺、不回捞:`,
      )
      for (const c of collected.slice(0, 10))
        console.warn(`     · ${c.id ?? '(无行首编号)'}: ${String(c.marker).slice(0, 30)} ← 注释正文起首 ${String(c.comment).slice(0, 46)}`)
      if (collected.length > 10) console.warn(`     …另 ${collected.length - 10} 条(逐条见 --heal 的 [已收拢/*] 行)`)
    }
    if (ok) {
      const winNote = historyWindowNote(window, face)
      console.log(
        `✅ [plan-line-loss] PROJECT_PLAN.md 无登记行丢失(判定面:${FACE_LABEL[face]}${
          face === 'staged' ? '' : `,历史面登记行 ${scanned} 条`
        })${winNote ? `\n   ${winNote}` : ''}`,
      )
      /**
       * 只报数那一档**必须逐条点名**(2026-09-27):multiSlot 的丢失不参与退出码,是为了
       * 不让"只有人工归并才能清的存量账"把每次问责钉成恒红;但"不参与退出码"绝不等于"不吭声"
       * —— 静默省略就是把没判写成判过了(本仓最高频失效型)。要判红跑 `--strict`。
       */
      if (reportOnly?.length) {
        console.warn(
          `⚠️  [plan-line-loss] 另有 ${reportOnly.length} 条**同编号仍有别的登记行**的丢失(只报数、不进自动回捞、不参与退出码;要问责跑 --strict):`,
        )
        for (const x of reportOnly)
          console.warn(
            `     · ${x.shape}/${x.id}: ${x.marker} —— ${x.line.trim().slice(0, 80)}…`,
          )
      }
      // 归并名额维放行也必须留声(§0.3"没判"绝不写成"判过"的对偶:判过了就得说判了什么)
      if (folded?.length) {
        console.log(
          `ℹ️  [plan-line-loss] 本次归并掉 ${folded.length} 个同编号的行首名额,已由 IHUI_PLAN_MERGE_FOLD 声明:` +
            folded.map((f) => ` ${f.id}(${f.from}→${f.to})`).join('、'),
        )
      }
      reportProse()
      printMalformedStock()
      printCollected()
      process.exit(0)
    }
    // 红灯路径:先点名"本次新增的畸形编号"(可能与登记行丢失同轮出现),再走原有丢失报告。
    printMalformedAdded()
    // 归并名额维红点(2026-10-24 立):先点名、再给单命令出路,不与丢失维混成同一份报告
    if (foldUndeclared.length || foldUnused.length) {
      const undeclaredNote = foldUndeclared
        .map(
          (f) =>
            `   · ${f.shape}/${f.id}:行首名额 ${f.from} → ${f.to}(少 ${f.dropped} 行)—— 未声明本次归并`,
        )
        .join('\n')
      const unusedNote = foldUnused.length
        ? `\n   · 声明里这些编号本次并没有掉名额:${foldUnused.join('、')} —— 空声明不算凭据`
        : ''
      const foldIds = foldUndeclared.map((f) => f.id).join(',') || '<本次实际归并的编号>'
      console.error(
        '❌ [plan-line-loss] 归并名额维(提交链)判红 —— 同一编号在面上占的行首名额变少了,而这次没给说明:\n' +
          undeclaredNote +
          unusedNote +
          '\n' +
          '  💡 这一维补的是丢失维看不见的一格:同题副本两行的 marker 逐字相同(题面到第一个分界符才\n' +
          '     分岔),丢失维把"删掉带进展那一份"与"没删"读成同一张脸(2026-10-24 真仓成对实测 0 报)。\n' +
          '     正解:把两份的进展并成一行、删掉过时那份,并当次逐号给一次定向说明——\n' +
          `       IHUI_PLAN_MERGE_FOLD="${foldIds}" node scripts/safe-commit.mjs --file PROJECT_PLAN.md …\n` +
          '     声明必须与本次改动同轮:没掉名额却声明 ⇒ 同样判红(§0.10 失效方向只能是"多要一次说明")。\n' +
          '     若这次不是归并而是误删 ⇒ 按下面的取回三步从 HEAD 逐行补回。\n',
      )
      if (lost.length === 0) {
        reportProse()
        printMalformedStock()
        process.exit(1)
      }
    }
    if (lost.length === 0) {
      // 登记行一条没丢,只有编号形态这一维判红(本次带进来的新账)——不得打"0 条丢失"的丢失报告
      console.error(
        '  💡 本闸在判定面上未检出登记行丢失,红点只在编号形态维(见上方清单)。\n' +
          '     紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1(会把畸形号写进台账,慎用)\n',
      )
      reportProse()
      printMalformedStock()
      process.exit(1)
    }
    console.error(
      `❌ [plan-line-loss] ${lost.length} 条登记行在判定面(${FACE_LABEL[face]})上已不在,而最近历史里出现过` +
        (face === 'staged' ? '' : `(${historyWindowNote(window, face)})`) +
        ':\n' +
        lost
          .map(
            (x) =>
              `   · ${x.marker}${x.shape === 'heading' ? `   ← 条目标题 ${x.id}` : ''}` +
              // 同编号仍占名额的那一类必须写明"只点名不回捞"——否则读报告的人会以为 --heal 能补回来
              (x.multiSlot
                ? `\n     〔同编号 ${x.id} 在判定面仍有别的登记行 ⇒ **只点名,不进自动回捞**:需人工判定这一行是被吞,还是正当改号/归并〕`
                : '') +
              `\n` +
              `     ${x.line.trim().slice(0, 90)}…`,
          )
          .join('\n'),
    )
    printCollected()
    const hl = headingLosses(lost)
    if (hl.length) {
      console.error(
        `\n  🔴 标题级丢失 ${hl.length} 处,条目号:${[...new Set(hl.map((x) => x.id ?? x.marker))].join('、')} ——\n` +
          '     丢的不是一行,而是那个条目在计划里**唯一的可寻址入口**:其下正文会被挂到上一节,\n' +
          '     而 `--heal` 只回捞单行、补不回整节层级 ⇒ **标题级丢失一律需人工归并**(按下面 1)\n' +
          '     取那一节的**整节**原文插回原锚点,不要只补标题行)。',
      )
    }
    console.error(
      '\n  💡 这几乎总是"按内存里的旧计划文档整文件提交"造成的覆盖,不是有意删除:\n' +
        '     1) 从原始提交逐字取回:`git log --all -S "<标记>" -- PROJECT_PLAN.md` 找到引入它\n' +
        '        的提交,`git show <sha>:PROJECT_PLAN.md` 取整行,插回原锚点后再提交;\n' +
        '        ' +
        (face === 'staged'
          ? '提交链上判的是索引这一份,所以取回后要 `git add` 再提交;\n'
          : '**本面不是提交链**:要恢复已入库的行,走 `--heal`(只写工作区)或\n' +
            '        `--heal --commit`(基线取 HEAD、建前向恢复提交);拿本地工作树副本整文件覆盖 = §12 禁止动作。\n') +
        '     2) 确属归档 → 原文必须出现在**已入库**的 .ihui-agent/archive/PROJECT_PLAN_*.md 里(本闸按\n' +
        '        被审面核对,本机写一份未提交的副本不算凭据;§1 归档流程 + G-183);\n' +
        '     3) 提交计划文档前一律现取 HEAD 版本再插自己的行,别相信自己内存里的那份;\n' +
        '     4) 给**已入库的条目标题改编号**(如 O42 → O45)与本闸要防的"旧基线覆盖"在内容上\n' +
        '        不可区分,同样判红:旧标题必须留在原处(或按 §1 归档),新编号另起一节。\n' +
        '     紧急跳过:HUSKY_SKIP_PLAN_LINE_LOSS=1(会把别人的登记行写没,慎用)\n',
    )
    printMalformedStock()
    process.exit(1)
  } catch (e) {
    console.error(`❌ [plan-line-loss] 检查失败:${e?.message ?? e}`)
    process.exit(2)
  }
}

/**
 * AGENTS.md §22c:镜像测试一律 import 本对象,**禁止**在测试里复制判据实现
 * (复制 = 两套并行真相,源函数一改测试就"假绿",守门形同虚设)。
 * §22d 要求本 export 位于 `if (isDirectRun)` 之后,免得测试 import 时把 CLI 主流程带起来。
 */
export const __test__ = {
  markerOf,
  headIdOf,
  headIdSet,
  headingIdSet,
  registrationOf,
  registeredLines,
  stillRegistered,
  lostMarkers,
  dropArchivedLost,
  archivedCopy,
  archiveExemptFor,
  headingLosses,
  mergePointerBodyOf,
  lossFingerprintOf,
  missingFrom,
  // G-816708:自愈的三目标面(同一把尺子多喂一面)与三档点名的渲染出口
  healLegs,
  healLegRoster,
  healContent,
  // 判活唯一实现与其取材(镜像测试据此证明"名额判活"只有一份,§22c 禁止再抄一份)
  registrationSlots,
  resolveRegistrationLoss,
  // 归并名额维(2026-10-24 立):名额差值判据与当次声明解析,镜像测试直接用生产实现
  foldedSlots,
  parseMergeFoldDeclaration,
  registrationAlreadyPresent,
  idExistsOnFace,
  shapeOfRegistration,
  // 历史面窗口:枚数出口 + 覆盖范围报名
  historyDepth,
  lastHistoryWindow,
  historyWindowNote,
  proseLossReport,
  healSuspectRatio,
  assessHealScale,
  // 取材面三件套:镜像测试据此证明"选面"这件事只有一份实现(§22c 禁止在测试里再抄一份)
  pickPlanContent,
  faceNoticeFor,
  // 编号形态维(G-722):按面选基准的编排出口(判据本体在 live-doc-edit.mjs,门内不抄第二份)
  malformedReport,
  runCheck,
  historyMarkers,
  // 已勾形态身份(2026-10-18):镜像测试据此证明"什么算一条已勾销登记"只有一份实现
  closedRegistrationOf,
  // 「已收拢」第三形态(2026-10-24):漂移注释判活的唯一实现。镜像测试一律 import 这一组,
  // 不得在测试里再抄一份归一式(§22c)—— 两把"什么算同一件事"的尺子必然漂开。
  DRIFT_COMMENT_RE,
  COLLECTED_TITLE_SPAN,
  COLLECTED_MIN_JUDGABLE,
  collectedNorm,
  collectedTitleKey,
  driftCollectedCorpus,
  collectedInDriftComment,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠