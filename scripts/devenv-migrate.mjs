#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-50「DevEnv 搬入 G:\IHUI-AI\.DevEnv」—— 静默窗口探测器 + 搬迁执行器(票 G-50 器物化)
 *
 * 票面把「等静默窗口」变成器物自动找窗口:默认档零写盘(探测 + 六步盘点 + 预演),
 * --apply 档在静默窗口(window 态)才按票面 1-6 步顺序执行,顺序不可换。
 *
 * ══ 现状盘点(2026-10-25 实测,依据逐条给出;派单/执行前必须重跑本脚本取现值,§0.1)══
 *
 *  票面步骤                          | 状态       | 依据(当次实测)
 *  ----------------------------------+------------+---------------------------------------------------------
 *  1) 同卷 rename G:\DevEnv→.DevEnv  | 部分已发生 | 主体(cache/tools/Temp/backups)已于 2026-09-30 由
 *                                    |            | G-814433 搬入仓内(.gitignore:591 注释、lib/gitdir.mjs
 *                                    |            | :356 注释);旧根 G:\DevEnv 仍残留实体 Temp\ 与
 *                                    |            | backups\(Temp 10-23 还有写入 ⇒ 仍有生产者在写)。
 *                                    |            | 目标 .DevEnv 已存在 ⇒ 票面「整根 rename」不可行,
 *                                    |            | 既定替代实现 = 逐子树 re-home(复用 re-home-junctions
 *                                    |            | 的 repairOne:镜像复制→内容校验→改名→原位建链→回读,
 *                                    |            | §0.6 单源),旧根一层最终全部为封口链接或消失。
 *  2) 重建 C 盘 8 + 家目录 8 junction | 已发生     | dir /AL C:\ 实测 8 个(c/caches/common_attachment/
 *                                    |            | persistent_data/rn-cxx/temp/tmp/tools)全指
 *                                    |            | G:\IHUI-AI\.DevEnv\…;家目录 8 个(.cache/.codex/
 *                                    |            | .codex-session-delete/.ihui/.m2/.rustup/.trae/.trae-cn)
 *                                    |            | 全指 …\cache\userhome\…。执行器按实测枚举判,不抄死 8。
 *  3) 改 5 脚本 + 3 复核位            | 部分已发生 | 实现面已改(lib/gitdir.mjs G-814433 归档根随仓内、
 *                                    |            | lib/scratch-dir.mjs G-158 scratch 根随仓内);残留 =
 *                                    |            | check-credential-health.mjs:81 活代码候选序 1 处
 *                                    |            | ('G:/DevEnv/secrets'),其余 9 处全是历史叙述注释
 *                                    |            | (按「删副本不删证据」惯例保留,apply 不清注释)。
 *                                    |            | 清单 = HARD_CODED_FILES(5 脚本 + 3 复核位,测试钉在)。
 *  4) .gitignore 加 /.DevEnv/        | 已发生     | .gitignore:593 `.DevEnv/`(git check-ignore 实测命中)。
 *  5) 逐项回读验证                   | apply 总闸 | 仅 --apply 档执行;默认档零写盘。
 *  6) 白名单摘除过渡条目              | 待做       | seal-c-root-stray.mjs devEnvTargetRoots() 仍返回
 *                                    |            | [新根, 旧根] 双根(2026-10-24 过渡候选),搬完摘旧根。
 *
 *  另:.DevEnv\.git 是 G-158 的坏 gitfile 边界哨兵(指向不存在的 .no-git-boundary),
 *  防 git discovery 逃逸与嵌套仓(守门 208),正确形态,本器物不碰。
 *
 * ══ 静默窗口判据(票面;②于 2026-10-29 改口径,原因见下)══
 *  ① 旧根(<盘>:/DevEnv)内 mtime 最新条目距今 ≥ QUIET_MINUTES(60 分钟 = 连续 ≥2 轮
 *     守护派发周期)无新增;枚举跳过重解析点(§26 头号危险:junction 穿透会把别的盘算进来)。
 *  ② 无「正在使用旧根」的并行会话 —— 只判搬迁会真正打断的那几类:
 *     ②-a 活进程面:运行中进程的 CommandLine / ExecutablePath 落在旧根的**路径段**内
 *          (进程面由 pwsh 的 Get-CimInstance Win32_Process 取值;整表取不到 ⇒ undetermined)。
 *          单行两字段读不出(受保护系统进程 / 无权限查询时 CommandLine 与 ExecutablePath 为 null)
 *          ⇒ **该行**计入 unjudged,**不得**读成「这一行没在用旧根」;其余可读行照常判命中/未命中。
 *     ②-b 旧根锁面:旧根内有界枚举 `*.lock`,带 pid 且 pid 存活 ⇒ 占用;pid 读不出 ⇒ 也按
 *          占用(不确定即视为在用);pid 已死 ⇒ 陈旧锁只报数。git 正在刷备份仓时会出现
 *          空内容的 refs/heads/*.lock,正是「搬迁会打断 git 备份」的瞬时证据。
 *  ② 的**旧口径已退役**:「.ihui-agent/tmp 与 <盘>:/tmp-probe 两目录静默 30 分钟」在本仓
 *  结构上永不到达 —— 多会话共享工作树,guardian 自己每轮往 .ihui-agent/tmp 写
 *  index-snapshot-<ts> 与 guardian-timing.json(2026-10-29 实测常驻 1~3 分钟内有写入)⇒ 静默窗
 *  永不开启 = 让路变永久停摆(与 AGENTS §1 护栏③ 同型)。两目录的写入与「旧根搬迁」无因果
 *  关系(scratch 根已随 G-158 迁到新根内),故降为**信息面**(facts.sessionTmp/tmpProbe,
 *  --probe 打印,不参与三态)。覆盖面没有降低:旧口径测不到「有进程正在用旧根」,
 *  新 ②-a/②-b 正是补上这一格,且每次 probe 都能量、能复跑。
 *  ②-c 显式登记面(2026-11-04,**结构性读不出**的正解):受保护系统进程的 CommandLine/
 *      ExecutablePath 恒为 null、无 pid 的依赖清单类 `*.lock` 永远没有 pid —— 这两类此前会把
 *      结论恒钉在 undetermined,迁移窗口理论上拿不到。现改为
 *      scripts/data/devenv-migrate-exemptions.json **逐条显式登记**,每条必须有
 *      kind(process/lock/path)、identity(**进程名+会话 或 旧根相对路径**,禁裸 pid)、
 *      why(为什么它永远读不出)、reviewBy(≤90 天)。
 *      只有「登记命中 ∧ 条目合法 ∧ 未过 reviewBy ∧ 命中数 ≤ maxRows」的**读不出子项**才豁免;
 *      未登记一律保持 fail-closed。表级超限/非法、单条非法、过期条目都进 unjudged ⇒ 自动回红,
 *      不许静默续期。**生产栈真占用旧根不得登记**——那是真实阻塞,如实保留 undetermined/blocked,
 *      登记只解释「读不出」,不发放「允许占用」的许可。
 *  未覆盖面:旧根内**打开的文件句柄**与**进程 cwd**(Windows 纯 Node 取不到,不假装覆盖),
 *  由 re-home-junctions.repairOne 的「占用中目录改名失败 = 安全失败,不建 junction、不删源」兜底。
 *  前置可信度:git-guardian.log 末条 tick 距今 > GUARDIAN_FRESH_MINUTES(15 分钟)⇒ 守护
 *  失明期,「无新增」不可信 ⇒ 整体未判定(§0.3:取不到输入判未判定,绝不猜)。
 *  三态:window(两判据全过 ∧ 守护活着)/ pending(有可判定的活跃写入或占用,reasons 点名)/
 *  undetermined(没有可判定否定、且输入取不到:枚举截断/单条读不到/进程表取不到/留痕过期等)。
 *  未判定子项单列进 unjudged(--probe 逐条打印),不再一票把整条结论抹成 undetermined;
 *  但只要没有可判定否定,undetermined 仍然保留(fail-closed,绝不把「没判」写成「静默」)。
 *
 * ══ 续扫式枚举(2026-11-04,**结构性预算是正解,不是抬阈值**)══
 *  立因:旧根实测远超 ENUM_BUDGET(判①)/ LEGACY_LOCK_SCAN.entryBudget(判②)⇒ 每轮都
 *  走到「预算截断」,未扫部分只能进 unjudged,结论被钉在 undetermined;而每次 probe 又
 *  从树根重扫一遍,扫过的部分永远攒不出完整覆盖(结构性停摆,不是数据没补齐)。
 *  正解:把两面的枚举都改成**分片续扫**——本轮到预算就把游标(目录栈 + 已完成累计)落盘,
 *  下一轮从断点继续,而不是整轮重来。
 *  不撒谎的三条边界:
 *  ① 只要本轮没扫完,结论照旧 undetermined,绝不因为「扫过一大半」就判 window;
 *  ② 游标不可解析 / 根或深度变了 ⇒ 旧游标作废、**重开一环**(如实报 resetWhy,不猜续);
 *  ③ 一期(一环)跨轮完成时,环跨时长必须 ≤ QUIET_MINUTES 才允许拿它判静默:
 *     续扫的盲区 = 整环跨度(已扫过的目录在后续轮次里再被写入是看不见的),跨度超过阈值
 *     的环只能作为「进度」,不能作为「已判定」。
 *  ③-a 环已扫完、另一面还在续扫时,已完成的那面**复用到「环起至今 ≤ QUIET_MINUTES」为止**
 *     (不重扫,否则一面扫完就重开、两面永远对不齐 ⇒ 结构上拿不到 window);复用必须打印
 *     环起时长与环结束后的空窗长度,超过阈值 ⇒ 旧环只作轮数基准、重开一环(不用陈旧证据判静默)。
 *  落盘面:SCAN_STATE_FILE(仓内 .ihui-agent/state,与守护留痕同域);probe 核心
 *  (probeQuietWindow 不注入 scanStore 时)仍然零写盘,只有 main / 巡检臂显式接 store 才写。
 *  可观测:每轮打印「本轮扫多少 / 环内累计 / 游标还剩几个目录 / 按上一完整环估算还需几轮」。
 *
 * ══ 自动臂按需加密(2026-11-04,治「节奏 × 轮数」的结构冲突)══
 *  立因:续扫一环约 13 轮,而本臂原节拍 30 分钟/轮 ⇒ 整环跨度约 6.5 小时 > 静默阈值 60 分钟,
 *  自动臂结构上永远只能给 progress(pending),human 连跑才收敛。机主裁决:选「按需加密」,
 *  **不做常驻加密**(不永久占巡检时间片),也不接受「永远 pending」。
 *  正解:环打开且未闭合 ⇒ 本臂自己的下一轮间隔调到 DENSE_PATROL_INTERVAL_MS(4 分钟);
 *  环闭合 / 游标作废 / 连续加密触顶 ⇒ 立刻回落 PATROL_INTERVAL_MS(30 分钟)。
 *  4 分钟的依据:守护计划任务 2 分钟一 tick,实际可达粒度 = 2 分钟,4 分钟 = 每两 tick 一轮
 *  (不抖、不空转);13 轮 × 4 分钟 = 52 分钟 + 末轮探针(实测 ~70 秒)≈ 53 分钟 ≤ 60,
 *  15 轮滑移余量仍 ≤ 60。只动本臂相位,不改守护轮与任何其它门的 tick ⇒ 其它门节奏不变,
 *  代价只有加密轮里本臂探针占掉的那一次单轮时长(见报告「延迟上限」)。
 *  不无限加密:DENSE_MAX_HOLD_MS(2 小时)到点即回落 + 报警 + **封禁本环加密**
 *  (suppressedFor 落盘),环闭合或重开新环才重新计数 —— 卡死的环不把巡检永久拖进高频。
 *  环态判据单源:scanCycleFacts 只读已落盘的续扫游标(栈非空且 key/root/maxDepth/版本全同),
 *  加密账本只有 denseStartedAt / cycleSignature / suppressedFor 三项,不存被扫内容。
 *  可观测:加密轮日志与 --probe 都打印「是否加密中 / 依据 / 环内已扫几轮 / 预计还需几轮 /
 *  最迟回落时刻(上限)」;回落与触顶各留一行。
 *
 * ══ 用法 ══
 *   node scripts/devenv-migrate.mjs              # 默认:探测 + 盘点 + 预演(只落续扫游标,不碰旧根)
 *   node scripts/devenv-migrate.mjs --probe      # 只打印静默窗口三态(同样只落续扫游标)
 *   node scripts/devenv-migrate.mjs --apply      # 执行搬迁(window 才动手;pending/未判定一律拒绝)
 *   node scripts/devenv-migrate.mjs --self-test  # 判据取证(夹具内,不碰真盘真根)
 *   (自动档)git-guardian 巡检轮每 30 分钟派发 devenvMigratePatrol:默认只 probe 留痕,
 *            真搬须 scripts/data/devenv-migrate-arm.json enabled=true(入库默认 false)。
 *  退出码:0 = window(可执行)/ 已完成;1 = pending / apply 复核不过;2 = 未判定/脚本异常;
 *          3 = --apply 被静默窗口前置闸拒绝。
 *
 * ══ 安全设计 ══
 *  · 派生一律 windowsHide:true + 显式 stdio(§5b/§12g);改含载荷文件走水印三段
 *    clean → 受控替换 → inject(§5c 禁文本级批量改写毁零宽链)。
 *  · 路径由脚本自身位置推导(禁 process.cwd() 定根,守门 70);盘符不写死,parse(ROOT).root。
 *  · 枚举带预算(ENUM_BUDGET),截断 ⇒ 该子项 unjudged 单列(未见 ≠ 不存在,不假静默)。
 *  · --apply 每步失败即停且如实报;repairOne 内建逐级回退,数据不可逆删除前有多道内容闸。
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  utimesSync,
} from 'node:fs'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { plan as reHomePlan, repairOne as reHomeRepair } from './re-home-junctions.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DRIVE_ROOT = parse(ROOT).root

/** 旧外置根(票面搬迁源)与新根(票面搬迁目标)。盘符由脚本自身位置推导,不写死。 */
export const LEGACY_ROOT = join(DRIVE_ROOT, 'DevEnv')
export const NEW_ROOT = join(ROOT, '.DevEnv')
/** 以下六常量 export 供镜像测试作构造面树键(与探测器所问路径逐字同形,§22c 零复制)。 */
export const C_DRIVE = join(process.env.SystemDrive || 'C:', sep)
export const SESSION_TMP = join(ROOT, '.ihui-agent', 'tmp')
export const TMP_PROBE = join(DRIVE_ROOT, 'tmp-probe')
export const GUARDIAN_LOG = join(ROOT, '.ihui-agent', 'state', 'git-guardian.log')
export const GITIGNORE = join(ROOT, '.gitignore')
export const SEAL_SCRIPT = join(ROOT, 'scripts', 'seal-c-root-stray.mjs')

/** 票面判据阈值(分钟)。60 = 连续 ≥2 轮守护派发周期;15 = 守护留痕新鲜度。 */
export const QUIET_MINUTES = 60
export const GUARDIAN_FRESH_MINUTES = 15
/** 两探针目录的静默阈值:2026-10-29 起**只作信息面**(见头注判②),不再参与三态。 */
export const SESSION_IDLE_MINUTES = 30
/** 判② 进程面:进程表派生超时。取不到 ⇒ undetermined(不猜「没人用」)。 */
export const PROC_SCAN_TIMEOUT_MS = 20_000
/** 判② 锁面**单片**枚举预算。2026-10-29 曾读旧根 maxdepth 8 = 36,395 条目;2026-11-04 实测本机
 *  同口径 1,389,790 条目 / *.lock 1,452 个(重解析点 26,049 个跳过),11.6× 预算,全量需 192 秒
 *  —— 预算只是防跑飞护栏,超限按 unjudged 单列。8 层覆盖 backups/git/<repo>/refs/heads/*.lock
 *  这类搬迁会打断的瞬时锁。**自 2026-11-04 起预算按片计**:到片就落游标,下一轮从断点续扫
 *  (见头注「续扫式枚举」),但环未扫完前结论仍是 undetermined。 */
export const LEGACY_LOCK_SCAN = { maxDepth: 8, entryBudget: 120_000 }
/** 判① 全树**单片**枚举预算:超过即截断 ⇒ 该子项标 unjudged(未见 ≠ 不存在)。2026-11-04 实测
 *  本机旧根全树 2,380,836 条目(重解析点 27,494 个全部跳过、零跟随 ⇒ 非重复计数),11.9× 预算;
 *  不抬高预算:全量走完实测 433 秒,每次 probe 都全量 lstat 属「调阈值消灭超限」。
 *  按片续扫同理:预算不抬,靠游标跨轮把覆盖率攒满。 */
export const ENUM_BUDGET = 200000
/** 续扫游标落盘路径(只存「扫到哪 + 已累计读到什么」,不存被扫内容)。 */
export const SCAN_STATE_FILE = join(ROOT, '.ihui-agent', 'state', 'devenv-migrate-scan.json')
/** 续扫环的跨度上限 = 静默阈值:环跨超过它 ⇒ 盲区可能掩盖阈值内的写入,只能当进度、不能判静默。 */
export const SCAN_CYCLE_MAX_SPAN_MINUTES = QUIET_MINUTES
/** 游标状态版本:形状一改就 +1,旧游标一律作废重开环(不许猜着续)。 */
export const SCAN_STATE_VERSION = 1
/** 判① 的「不限深度」用可序列化常量(Infinity 经 JSON 会变 null,续扫就对不上而白重开)。 */
export const SCAN_DEPTH_UNBOUNDED = 1_000_000
/**
 * 显式登记面(2026-11-04):只登记「为什么它永远读不出」,不登记「允许它占用」。
 * 未登记读不出的行一律保持 fail-closed;登记过期自动回红;条目数与每条 maxRows 双上限防扩张。
 */
export const EXEMPTIONS_FILE = join(ROOT, 'scripts', 'data', 'devenv-migrate-exemptions.json')
/**
 * 结构性限制台账(2026-11-04):只登记「结构上判不了」的归属,不登记「现在有人占用」。
 * 与豁免表相反:它**不抑制任何红**——条目齐全只多印一行「谁负责、何时复核」,
 * reviewBy 过期 / 条目非法 ⇒ 反而进 unjudged 点名回红(不许静默续期)。
 */
export const KNOWN_LIMITS_FILE = join(ROOT, 'scripts', 'data', 'devenv-migrate-known-limits.json')
/** 登记表条目硬上限(超过 = 整表非法 ⇒ 回红),防止把它扩张成万能豁免面。 */
export const EXEMPTIONS_MAX_ENTRIES = 24
/** reviewBy 最远不得超过登记时刻 +90 天;到点未复核即自动回红,不许静默续期。 */
export const EXEMPTION_MAX_REVIEW_DAYS = 90
/** 依赖清单类 `*.lock`(Cargo/poetry/uv 等):非运行时锁,不当占用证据;其余无 pid 锁仍按占用。 */
export const DEPENDENCY_LOCK_NAMES = new Set([
  'cargo.lock',
  'poetry.lock',
  'uv.lock',
  'yarn.lock',
  'pipfile.lock',
  'gemfile.lock',
  'composer.lock',
  'flake.lock',
  'podfile.lock',
  'mix.lock',
  'pubspec.lock',
])

/** 票面步骤 3 的硬编码面清单:5 个脚本 + 3 个复核位(G:\DevEnv 字面命中面,2026-10-25 实测)。 */
export const HARD_CODED_FILES = [
  'scripts/check-credential-health.mjs',
  'scripts/pg-restore-drill.mjs',
  'scripts/re-home-junctions.mjs',
  'scripts/retire-git-archive.mjs',
  'scripts/sync-prometheus-live-config.mjs',
  'scripts/lib/gitdir.mjs',
  'scripts/lib/scratch-dir.mjs',
  'scripts/seal-c-root-stray.mjs',
]

/** --apply 步骤 3 的受控替换表(逐字、带预期命中数;活代码面,历史注释不在此列)。
 *  check-credential-health 的密钥候选序里仓内 .DevEnv\secrets 已在首位(G-814433),
 *  摘除旧盘根候选 = 票面「改硬编码」的活代码动作;D:/F:/E: 是其他盘候选,不在射程。 */
export const APPLY_REPLACEMENTS = [
  {
    file: 'scripts/check-credential-health.mjs',
    edits: [{ from: `'G:/DevEnv/secrets', `, to: '', expect: 1 }],
  },
]

/** 判定用只读 io 集;--apply 另需写面(全部经 io 注入,§22c 构造面可证 + 零写盘行为锁)。
 *  2026-10-28 补 export:guardian 巡检臂与镜像测试要拿同一份真实 io,禁另造第二份(§0.6)。 */
export function defaultIO() {
  return {
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
    mkdirSync,
    renameSync,
    rmSync,
    spawnSync,
  }
}

/**
 * 续扫进度的一句话(两个面共用)。口径只写**实得**:
 * 本轮多少 / 环内累计多少 / 游标还剩几个目录(条目数未知,不编造);
 * 只有拿到「上一完整环」基准时才给总轮数与剩余轮数估算,否则如实说「尚无基准」。
 * @param {ReturnType<typeof driveScan>['progress']} p
 */
export function scanProgressText(p) {
  const bits = [
    `本轮 ${p.scannedThisRound} 条`,
    `环内累计 ${p.scannedInCycle} 条`,
    `游标还剩 ${p.pendingDirs} 个目录待遍历(条目数未知)`,
  ]
  if (p.estimatedRoundsRemaining !== null)
    bits.push(
      `按上一完整环 ${p.estimatedCycleEntries} 条估算:整环约 ${p.estimatedRoundsTotal} 轮,还需约 ${p.estimatedRoundsRemaining} 轮`,
    )
  else bits.push('尚无完整环基准(跑满一环后才有总轮数估算)')
  if (p.resetWhy) bits.push(p.resetWhy)
  return bits.join(';')
}

/**
 * 复用在环的一句话:环起多久 / 环结束后空窗多久。复用只在「环起至今 ≤ 静默阈值」内允许,
 * 所以必须把空窗长度一并印出来 —— 复用不是「又扫了一遍」,盲区是实打实的空窗。
 * @param {ReturnType<typeof driveScan>['progress']} p
 */
export function scanReuseText(p) {
  const span = Number.isFinite(p.cycleSpanMinutes) ? p.cycleSpanMinutes : 0
  const age = Number.isFinite(p.reuseAgeMinutes) ? p.reuseAgeMinutes : 0
  return `复用在环:环起 ${span.toFixed(1)} 分钟前,环结束后 ${age.toFixed(1)} 分钟未复扫(跨度 ≤ 阈值 ${SCAN_CYCLE_MAX_SPAN_MINUTES} 分钟,盲区=该空窗)`
}

/**
 * 新开一环。游标 = 目录栈 [{d,i,dep}];i 表示该目录里**已消费**的条目数,
 * names 不落盘(续扫时重新 readdir 再按 i 跳过,单个目录重读一次远比把整树名单写盘便宜)。
 */
function newScanCycle(key, root, maxDepth, nowMs, makeAcc, lastComplete) {
  return {
    v: SCAN_STATE_VERSION,
    key,
    root,
    maxDepth,
    cycleStartedAt: nowMs,
    updatedAt: nowMs,
    rounds: 0,
    scannedTotal: 0,
    stack: [{ d: root, i: 0, dep: 1 }],
    acc: makeAcc(),
    lastComplete: lastComplete || null,
  }
}

/**
 * 通用分片续扫引擎:显式 DFS(栈可落盘),单片最多消费 budget 个条目。
 * 续扫只允许在 key/root/maxDepth 全同、版本一致、且栈非空时继续;
 * 上一环已扫完(stack 空)⇒ 只把它的条目数当「总轮数基准」,**仍旧重扫**,不复用旧结论。
 * 环未扫完时 `finished=false` —— 调用方必须据此给 undetermined,不得当已判定。
 * @param {{lstatSync:Function, readdirSync:Function}} io
 * @param {{key:string, root:string, maxDepth:number, budget:number, prev:(object|null), nowMs:number,
 *          makeAcc:Function, onEntry:Function, onLink:(Function|undefined), onUnreadable:(Function|undefined)
 *          }} cfg
 */
export function driveScan(io, cfg) {
  const { key, root, maxDepth, nowMs, makeAcc, onEntry, onLink, onUnreadable } = cfg
  const budget = Math.max(1, Number(cfg.budget) || 1)
  const prev = cfg.prev
  let resetWhy = ''
  let state
  const resumable =
    prev &&
    prev.v === SCAN_STATE_VERSION &&
    prev.key === key &&
    prev.root === root &&
    prev.maxDepth === maxDepth &&
    Array.isArray(prev.stack) &&
    // 栈空 = 上一环已扫完:此时必须拿 acc 把旧结论交回去,缺 acc 的游标不认(不许猜着复用)。
    (prev.stack.length > 0 || Boolean(prev.acc && typeof prev.acc === 'object'))
  if (resumable && prev.stack.length > 0) {
    state = { ...prev, stack: prev.stack.map((x) => ({ d: x.d, i: x.i, dep: x.dep })) }
  } else if (resumable) {
    // 上一环已扫完(栈空):环起至今仍在阈值内 ⇒ **复用**该环的实得结论(不重扫),
    // 并把「环结束后空窗」显式报出;超阈值 ⇒ 旧环只作轮数基准,重开一环(不许拿陈旧证据判静默)。
    const spanMin = Number.isFinite(prev.cycleStartedAt) ? (nowMs - prev.cycleStartedAt) / 60000 : Infinity
    if (spanMin <= SCAN_CYCLE_MAX_SPAN_MINUTES) {
      const at = prev.lastComplete && Number.isFinite(prev.lastComplete.at) ? prev.lastComplete.at : prev.updatedAt
      const est = Number.isFinite(prev.scannedTotal) ? prev.scannedTotal : null
      const progress = {
        budget,
        scannedThisRound: 0,
        scannedInCycle: prev.scannedTotal,
        pendingDirs: 0,
        rounds: prev.rounds,
        finished: true,
        reused: true,
        cycleStartedAt: prev.cycleStartedAt,
        cycleSpanMinutes: spanMin,
        reuseAgeMinutes: Math.max(0, (nowMs - at) / 60000),
        estimatedCycleEntries: est,
        estimatedRoundsTotal: est === null ? null : Math.max(1, Math.ceil(est / budget)),
        estimatedRoundsRemaining: 0,
        remainingUnknown: false,
        resetWhy: '',
      }
      return { finished: true, reused: true, scannedThisRound: 0, state: prev, progress }
    }
    resetWhy = `上一环已扫完但环起 ${spanMin.toFixed(
      1,
    )} 分钟前 > 阈值 ${SCAN_CYCLE_MAX_SPAN_MINUTES} 分钟 ⇒ 本轮重开一环(旧环只作轮数基准,不复用陈旧结论)`
    state = newScanCycle(key, root, maxDepth, nowMs, makeAcc, {
      entries: prev.scannedTotal,
      rounds: prev.rounds,
      at: prev.updatedAt,
    })
  } else {
    if (prev) resetWhy = `上一轮游标不可续(key/root/maxDepth/版本对不上)⇒ 本轮重开一环`
    state = newScanCycle(key, root, maxDepth, nowMs, makeAcc, null)
  }

  /** 本轮已读到的目录名单(只活在内存里,不落盘)。 */
  const namesByDir = new Map()
  let scannedThisRound = 0
  while (state.stack.length > 0 && scannedThisRound < budget) {
    const top = state.stack[state.stack.length - 1]
    let names = namesByDir.get(top.d)
    if (!names) {
      try {
        names = io.readdirSync(top.d)
      } catch (e) {
        if (onUnreadable) onUnreadable(top.d, e, state, 'readdir')
        state.stack.pop()
        continue
      }
      namesByDir.set(top.d, names)
    }
    if (top.i >= names.length) {
      state.stack.pop()
      continue
    }
    const name = names[top.i++]
    scannedThisRound++
    state.scannedTotal++
    const p = join(top.d, name)
    let s
    try {
      s = io.lstatSync(p)
    } catch (e) {
      if (e && e.code === 'ENOENT') continue // 并发删除:按当前所见判,不猜多
      if (onUnreadable) onUnreadable(p, e, state, 'lstat')
      continue
    }
    if (s.isSymbolicLink()) {
      if (onLink) onLink(p, state)
      continue
    }
    onEntry({ path: p, name, st: s, depth: top.dep, state })
    if (s.isDirectory() && top.dep < maxDepth) state.stack.push({ d: p, i: 0, dep: top.dep + 1 })
  }

  // 预算恰好吃掉最后一个条目时,栈顶目录已是空壳:本轮顺手收栈,免得下一轮空扫 0 条还报「还剩 1 轮」。
  while (state.stack.length > 0) {
    const top = state.stack[state.stack.length - 1]
    let names = namesByDir.get(top.d)
    if (!names) {
      try {
        names = io.readdirSync(top.d)
      } catch {
        break
      }
      namesByDir.set(top.d, names)
    }
    if (top.i < names.length) break
    state.stack.pop()
  }

  const finished = state.stack.length === 0
  state.rounds += 1
  state.updatedAt = nowMs
  if (finished) state.lastComplete = { entries: state.scannedTotal, rounds: state.rounds, at: nowMs }

  const est = state.lastComplete && Number.isFinite(state.lastComplete.entries) ? state.lastComplete.entries : null
  const progress = {
    budget,
    scannedThisRound,
    scannedInCycle: state.scannedTotal,
    pendingDirs: state.stack.length,
    rounds: state.rounds,
    finished,
    reused: false,
    cycleStartedAt: state.cycleStartedAt,
    cycleSpanMinutes: Math.max(0, (nowMs - state.cycleStartedAt) / 60000),
    estimatedCycleEntries: est,
    estimatedRoundsTotal: est === null ? null : Math.max(1, Math.ceil(est / budget)),
    estimatedRoundsRemaining:
      est === null || state.stack.length === 0
        ? est === null
          ? null
          : 0
        : Math.max(1, Math.ceil((est - state.scannedTotal) / budget)),
    remainingUnknown: est === null,
    resetWhy,
  }
  return { finished, scannedThisRound, state, progress }
}

/** 落盘前剥掉本轮临时字段(目录名单只活在内存)。 */
function persistableScanState(state) {
  return { ...state, stack: state.stack.map((x) => ({ d: x.d, i: x.i, dep: x.dep })) }
}

/**
 * 递归量一棵树的最新写入时刻。**不跟随重解析点**(§26):junction/symlink 条目只计数跳过,
 * 既不递归也不计入 mtime(链接本体的 mtime 是建立时刻,与「写入」无关)。
 * 三态:absent(路径不存在,或本体就是重解析点)/ ok(量到了)/ undetermined(读不到,
 * 显式带 why;枚举截断或单条 lstat 失败也降级 undetermined —— 漏看的那条可能正是最新写入)。
 * 2026-11-04 起支持分片续扫:opts.resume = {state, save, why} 时,到预算就落游标、下一轮续扫;
 * 只有**整环扫完**才可能给 ok,环未扫完一律 undetermined(§头注「续扫式枚举」三条边界)。
 * @param {{lstatSync:Function, readdirSync:Function}} io 只读面
 * @param {string} dir 待量树的根
 * @param {number} now 时刻基准(ms),测试可注入
 * @param {{budget?:number, resume?:{state:object|null, save?:Function, why?:string}}} [opts]
 * @returns {{kind:'absent'|'ok'|'undetermined', quietMinutes:(number|null), truncated:boolean, junctions:number, why:(string|undefined), entries:(number|undefined)}}}
 */
export function latestWrite(io, dir, now, opts = {}) {
  let st
  try {
    st = io.lstatSync(dir)
  } catch (e) {
    if (e && e.code === 'ENOENT')
      return { kind: 'absent', quietMinutes: null, truncated: false, junctions: 0 }
    return {
      kind: 'undetermined',
      quietMinutes: null,
      truncated: false,
      junctions: 0,
      why: `lstat ${dir} 失败(${(e && e.code) || e})`,
    }
  }
  if (st.isSymbolicLink())
    return {
      kind: 'absent',
      quietMinutes: null,
      truncated: false,
      junctions: 1,
      why: `${dir} 本体是重解析点,无实体内容`,
    }
  const resume = opts.resume || null
  const run = driveScan(io, {
    key: 'legacyTree',
    root: dir,
    maxDepth: SCAN_DEPTH_UNBOUNDED,
    budget: opts.budget ?? ENUM_BUDGET,
    prev: resume ? resume.state : null,
    nowMs: now,
    makeAcc: () => ({ maxMs: st.mtimeMs, junctions: 0, unreadable: 0, firstUnreadableCode: '' }),
    onLink: (p, state) => {
      state.acc.junctions++
    },
    onUnreadable: (p, e, state, from) => {
      state.acc.unreadable++
      if (state.acc.unreadable === 1) state.acc.firstUnreadableCode = `${(e && e.code) || String(e)}@${from}`
    },
    onEntry: ({ st: s, state }) => {
      if (s.mtimeMs > state.acc.maxMs) state.acc.maxMs = s.mtimeMs
    },
  })
  if (resume && resume.why && !run.progress.resetWhy) run.progress.resetWhy = resume.why
  const persisted = resume && resume.save ? Boolean(resume.save(persistableScanState(run.state))) : false
  run.progress.persisted = persisted
  const acc = run.state.acc
  const base = {
    truncated: !run.finished,
    reused: Boolean(run.reused),
    junctions: acc.junctions,
    entries: run.state.scannedTotal,
    entriesThisRound: run.scannedThisRound,
    progress: run.progress,
    rounds: run.state.rounds,
    cycleStartedAt: run.state.cycleStartedAt,
    cycleEndedAt: run.finished
      ? (run.state.lastComplete && Number.isFinite(run.state.lastComplete.at) ? run.state.lastComplete.at : now)
      : null,
  }
  if (acc.unreadable > 0)
    return {
      ...base,
      kind: 'undetermined',
      quietMinutes: null,
      why: `${acc.unreadable} 个条目/目录读不到(首个:${acc.firstUnreadableCode}),漏看的可能正是最新写入(${scanProgressText(run.progress)})`,
    }
  if (!run.finished) {
    const partialQuietMinutes = Math.max(0, (now - acc.maxMs) / 60000)
    return {
      ...base,
      kind: 'undetermined',
      quietMinutes: null,
      partialQuietMinutes,
      why: `枚举超过预算 ${run.progress.budget} 条:本轮预算截断(${scanProgressText(run.progress)};已扫部分最新写入 ${partialQuietMinutes.toFixed(
        1,
      )} 分钟前;剩余未见 ≠ 不存在)`,
    }
  }
  if (run.progress.cycleSpanMinutes > SCAN_CYCLE_MAX_SPAN_MINUTES)
    return {
      ...base,
      kind: 'undetermined',
      quietMinutes: null,
      why: `续扫环跨 ${run.progress.cycleSpanMinutes.toFixed(
        1,
      )} 分钟 > 静默阈值 ${SCAN_CYCLE_MAX_SPAN_MINUTES} 分钟:环内盲区(已扫过的目录再被写入)可能掩盖阈值内的写入,只算进度不算判定`,
    }
  return {
    ...base,
    kind: 'ok',
    quietMinutes: Math.max(0, (now - acc.maxMs) / 60000),
    truncated: false,
  }
}

/**
 * 守护 tick 存活判定:git-guardian.log 末条时间戳距今 ≤ GUARDIAN_FRESH_MINUTES 才认「tick 在动」。
 * 读不到 / 无时间戳 / 过期 ⇒ undetermined(守护失明期的「无新增」不构成静默证据,§0.3)。
 * @param {{readFileSync:Function}} io
 * @param {number} now
 * @returns {{state:'alive'|'undetermined', lastIso:(string|null), ageMinutes:(number|null), why:(string|undefined)}}
 */
export function guardianTickAlive(io, now) {
  let text
  try {
    text = io.readFileSync(GUARDIAN_LOG, 'utf8')
  } catch (e) {
    return { state: 'undetermined', lastIso: null, ageMinutes: null, why: `守护留痕读不到(${(e && e.code) || e})` }
  }
  const stamps = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]/
  const lines = String(text).split(/\r?\n/)
  // 实测留痕 28MB / 19.9 万条戳:必须倒序取**末条**,不得 matchAll 全量数组后 Math.max(...ms)
  // (spread 十万级元素即爆栈,2026-10-25 实测 RangeError)。
  let lastIso = null
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(stamps)
    if (m) {
      lastIso = m[1]
      break
    }
  }
  if (lastIso === null)
    return { state: 'undetermined', lastIso: null, ageMinutes: null, why: '守护留痕中无 tick 时间戳' }
  const lastMs = Date.parse(lastIso)
  if (!Number.isFinite(lastMs))
    return { state: 'undetermined', lastIso, ageMinutes: null, why: '守护留痕时间戳不可解析' }
  const ageMinutes = (now - lastMs) / 60000
  if (ageMinutes > GUARDIAN_FRESH_MINUTES)
    return {
      state: 'undetermined',
      lastIso,
      ageMinutes,
      why: `守护留痕已 ${ageMinutes.toFixed(0)} 分钟未 tick(阈值 ${GUARDIAN_FRESH_MINUTES}),失明期静默不可信`,
    }
  return { state: 'alive', lastIso, ageMinutes }
}

/** 单个静默判据的裁决(纯判据,三处探针与汇总共用同一把尺,§0.6)。 */
function quietVerdict(fact, threshold, label) {
  if (fact.kind === 'absent')
    return { pass: true, undetermined: false, note: fact.why ? `${label}:${fact.why}` : `${label}:不存在,天然静默` }
  if (fact.kind === 'undetermined')
    return { pass: false, undetermined: true, note: `${label}:${fact.why}` }
  if (fact.truncated)
    return { pass: false, undetermined: true, note: `${label}:枚举截断,未判定` }
  if (fact.quietMinutes !== null && fact.quietMinutes >= threshold)
    return {
      pass: true,
      undetermined: false,
      note: `${label}:静默 ${fact.quietMinutes.toFixed(0)} 分钟 ≥ ${threshold}(跳过重解析点 ${fact.junctions})`,
    }
  return {
    pass: false,
    undetermined: false,
    note: `${label}:${fact.quietMinutes === null ? '静默时长取不到' : `最新写入距今 ${fact.quietMinutes.toFixed(1)} 分钟 < ${threshold}`}`,
  }
}

/**
 * 路径归一化:分隔符统一 + 去尾缀 + 小写。判据只认「同一路径」,不认书写形态。
 * @param {unknown} p
 * @returns {string}
 */
function normPath(p) {
  return String(p === null || p === undefined ? '' : p)
    .replace(/[\\/]+/g, '\\')
    .replace(/\\+$/, '')
    .toLowerCase()
}

/**
 * 纯函数:candidate 是否落在 root 之内(按**路径段边界**,不是裸子串)。
 * 为什么必须按段边界:本机存在 `D:\DevEnv`(另一盘的合法 DevEnv,`svc-imagecdn`、
 * `editor_sdk` 等 4 个常驻进程在用)—— 裸子串匹配 `DevEnv` 会把它们全判成「在用旧根」
 * ⇒ 恒 pending(§12e 恒红门同型)。判据只认 `<盘>:/DevEnv` 这一段。
 * @param {unknown} candidate
 * @param {string} [root]
 * @returns {boolean}
 */
export function withinRoot(candidate, root = LEGACY_ROOT) {
  const c = normPath(candidate)
  const r = normPath(root)
  if (!c || !r) return false
  return c === r || c.startsWith(r + '\\')
}

/**
 * 纯函数:命令行里是否**以路径段边界**点名了 root 内的路径。
 * 命令行的现实形态:`node "G:\DevEnv\Temp\x.mjs" --a`、`cd /g/DevEnv && …`、`… >| /g/DevEnv/x`;
 * 归一后命中的下一位必须是分隔符 / 引号 / 空白 / 结尾,避免 `G:\DevEnv2` 之类误命中。
 * @param {unknown} cmdline
 * @param {string} [root]
 * @returns {boolean}
 */
export function commandMentionsRoot(cmdline, root = LEGACY_ROOT) {
  const text = normPath(cmdline)
  const r = normPath(root)
  if (!text || !r) return false
  let at = text.indexOf(r)
  while (at >= 0) {
    const next = text[at + r.length]
    if (next === undefined || next === '\\' || /[\s"']/.test(next)) return true
    at = text.indexOf(r, at + 1)
  }
  return false
}

/** 进程表取数命令(只在本机 probe 时派生一次;不写盘根、不引凭据)。
 *  2026-11-04 增 Name/SessionId:登记面要按「进程名 + 会话」稳定定位受保护进程
 *  (它们的 CommandLine/ExecutablePath 恒为 null,只有名字与会话可读),禁登记裸 pid。 */
export const PROCESS_TABLE_PS =
  'Get-CimInstance Win32_Process | Select-Object ProcessId,Name,SessionId,CommandLine,ExecutablePath | ConvertTo-Json -Compress'

/**
 * 纯函数:PowerShell `ConvertTo-Json -Compress` 的输出 → 归一进程行。
 * 单条结果时 PS 返回对象而非数组(实测),两种都认;空输出/非 JSON ⇒ 抛错
 * (调用方据此判 undetermined —— 绝不把「取不到」读成「没人用」)。
 * 注意:null/缺失字段在此归一为空串,但**空串不是「未命中」**——单行缺字段的语义
 * 由 legacyActiveUse 按 unjudged 处理(受保护进程的 CommandLine/ExecutablePath 常态为 null)。
 * name/sessionId 用于登记面匹配;缺 Name 的行 name='' ⇒ 不可能登记命中(仍 fail-closed)。
 * @param {unknown} stdout
 * @returns {Array<{pid:number, name:string, sessionId:(number|null), cmdline:string, exePath:string}>}
 */
export function parseProcessTable(stdout) {
  const text = String(stdout === null || stdout === undefined ? '' : stdout).trim()
  if (!text) throw new Error('进程表输出为空')
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`进程表不是 JSON:${text.slice(0, 80)}`)
  }
  const rows = Array.isArray(data) ? data : [data]
  return rows.map((r) => ({
    pid: Number(r && r.ProcessId),
    name: r && r.Name !== null && r.Name !== undefined ? String(r.Name) : '',
    sessionId:
      r && r.SessionId !== null && r.SessionId !== undefined && Number.isFinite(Number(r.SessionId))
        ? Number(r.SessionId)
        : null,
    cmdline: r && r.CommandLine !== null && r.CommandLine !== undefined ? String(r.CommandLine) : '',
    exePath:
      r && r.ExecutablePath !== null && r.ExecutablePath !== undefined ? String(r.ExecutablePath) : '',
  }))
}

/**
 * 派生进程表(唯一真跑面)。§12g:显式 stdio + windowsHide,不把选项留给调用方顺手删。
 * 换机无 pwsh 时以 IHUI_PWSH_BIN 指路;取不到一律抛错 ⇒ 上层判 undetermined 并点名原因。
 * @param {{spawnSync:Function}} io
 * @param {{pwshBin?:string, timeout?:number}} [opts]
 * @returns {Array<{pid:number, cmdline:string, exePath:string}>}
 */
export function defaultProcessTable(io = defaultIO(), opts = {}) {
  const pwshBin = opts.pwshBin || process.env.IHUI_PWSH_BIN || 'pwsh'
  const timeout = opts.timeout || PROC_SCAN_TIMEOUT_MS
  const r = io.spawnSync(pwshBin, ['-NoProfile', '-NonInteractive', '-Command', PROCESS_TABLE_PS], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout,
  })
  if (r && r.error) throw new Error(`进程表派生失败(${r.error.code || r.error.message};pwsh=${pwshBin})`)
  if (!r || r.status !== 0) {
    const err = String((r && r.stderr) || '').trim().slice(0, 120)
    throw new Error(`进程表派生 rc=${r ? r.status : 'null'}${err ? `:${err}` : ''};pwsh=${pwshBin}`)
  }
  return parseProcessTable(r.stdout)
}

/**
 * 纯函数:锁文件正文里的 pid。本仓锁有三种写法(`{"pid":123,…}` / `pid=123` / `pid: 123`),
 * 外加纯数字文件;git 自己造的瞬时锁(index.lock / refs/…/main.lock)是**空文件** ⇒ null。
 * @param {unknown} text
 * @returns {number|null}
 */
export function pidFromLockText(text) {
  const t = String(text === null || text === undefined ? '' : text)
  const m = t.match(/"pid"\s*:\s*(\d+)/) || t.match(/\bpid\s*[=:]\s*["']?(\d+)/i) || t.match(/^\s*(\d+)\s*$/)
  if (!m) return null
  const pid = Number(m[1])
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

/** 默认 pid 存活判定。EPERM = 进程在但无权限查询,仍算活(方向:多等一轮)。 */
export function defaultPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return Boolean(e && e.code === 'EPERM')
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 登记条目校验。返回 '' = 合法;否则返回非法原因(调用方把它进 rejected,由 probe 点名回红)。
 *  过期不在此判(过期条目保留在册、由 probe 如实报红),这里只拦「字段缺失 / identity 裸 pid /
 *  reviewBy 越界 / maxRows 越界」这类结构性非法。 */
function exemptionProblem(raw, nowMs) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '条目不是对象'
  if (!['process', 'lock', 'path'].includes(raw.kind)) return `kind 非法(${String(raw.kind)})`
  const identity = typeof raw.identity === 'string' ? raw.identity.trim() : ''
  if (!identity) return 'identity 缺失'
  // 裸 pid(含 pid=4 / pid:4 / 4)一律非法:pid 会漂,登记裸 pid 等于把豁免面绑在一个会变的数上。
  if (/^(?:pid\s*[:=]\s*)?\d+$/i.test(identity)) return 'identity 是裸 pid(pid 会漂,禁止)'
  if (raw.kind === 'process' && !/^name=[^|]+(?:\|session=(?:\d+|\*))?$/.test(identity))
    return 'process identity 需形如 name=<进程名>[|session=<会话号|*>]'
  if (raw.kind === 'lock' && !/^lock=[^|]+$/.test(identity)) return 'lock identity 需形如 lock=<旧根相对路径>'
  if (raw.kind === 'path' && !/^path=[^|]+$/.test(identity)) return 'path identity 需形如 path=<旧根相对路径>'
  if (typeof raw.why !== 'string' || raw.why.trim().length < 10) return 'why 缺失或过短(需说明为什么它永远读不出/为什么不是占用)'
  if (typeof raw.reviewBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.reviewBy)) return 'reviewBy 需 YYYY-MM-DD'
  const reviewMs = Date.parse(`${raw.reviewBy}T00:00:00Z`)
  if (!Number.isFinite(reviewMs)) return 'reviewBy 不是合法日期'
  if (reviewMs - nowMs > EXEMPTION_MAX_REVIEW_DAYS * DAY_MS)
    return `reviewBy 超过 ${EXEMPTION_MAX_REVIEW_DAYS} 天上限(不许一次续太久)`
  const maxRows = raw.maxRows === undefined ? 1 : raw.maxRows
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 32) return 'maxRows 需为 1..32 的整数'
  return ''
}

/** 归一旧根相对路径:统一正斜杠 + 小写(NTFS 大小写不敏感,比较面同形)。 */
function relUnderLegacy(p) {
  const abs = String(p)
  if (abs.toLowerCase().startsWith(String(LEGACY_ROOT).toLowerCase() + sep))
    return abs.slice(String(LEGACY_ROOT).length + 1).split(/[\\/]+/).join('/').toLowerCase()
  return abs.split(/[\\/]+/).join('/').toLowerCase()
}

/**
 * 读取显式登记表(纯注入面,零写盘)。三态:
 *  absent  —— 文件不在位:零豁免,行为与未引入登记面时逐字相同(不是错误);
 *  ok      —— 表级合法,entries = 可用条目(entries 里仍保留 expired 标记,由 probe 报红);
 *  invalid —— 整表拒用(不可解析 / 形状不对 / 条目数超上限)⇒ entries=[],probe 必回红。
 * 单条非法不拖垮整表,但进 rejected 且**一律不豁免**,由 probe 逐条点名回红。
 * @param {{readFile?:Function, now?:number, path?:string, maxEntries?:number}} [opts]
 * @returns {{kind:'absent'|'ok'|'invalid', entries:Array<Object>, rejected:Array<{identity:string, why:string}>, why:(string|undefined)}}
 */
export function loadDevenvMigrateExemptions({
  readFile = (p) => readFileSync(p, 'utf8'),
  now = Date.now(),
  path = EXEMPTIONS_FILE,
  maxEntries = EXEMPTIONS_MAX_ENTRIES,
} = {}) {
  let text
  try {
    text = readFile(path)
  } catch (e) {
    if (e && e.code === 'ENOENT')
      return { kind: 'absent', entries: [], rejected: [], why: `登记表不在位:${path}` }
    return { kind: 'invalid', entries: [], rejected: [], why: `登记表读不到(${(e && e.code) || e})` }
  }
  let parsed
  try {
    parsed = JSON.parse(String(text))
  } catch (e) {
    return { kind: 'invalid', entries: [], rejected: [], why: `登记表不可解析:${String((e && e.message) || e).slice(0, 80)}` }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.entries))
    return { kind: 'invalid', entries: [], rejected: [], why: '登记表形状不对(需 {"entries": [...]})' }
  if (parsed.entries.length > maxEntries)
    return {
      kind: 'invalid',
      entries: [],
      rejected: [],
      why: `登记表条目 ${parsed.entries.length} 超过上限 ${maxEntries}(防扩张成万能豁免面)`,
    }
  const entries = []
  const rejected = []
  for (const raw of parsed.entries) {
    const problem = exemptionProblem(raw, now)
    if (problem) {
      rejected.push({ identity: raw && typeof raw.identity === 'string' ? raw.identity : '?', why: problem })
      continue
    }
    const reviewByMs = Date.parse(`${raw.reviewBy}T00:00:00Z`)
    entries.push({
      kind: raw.kind,
      identity: raw.identity.trim(),
      why: raw.why.trim(),
      reviewBy: raw.reviewBy,
      reviewByMs,
      maxRows: raw.maxRows === undefined ? 1 : raw.maxRows,
      // 过 reviewBy 当日即过期(次日零点 UTC 之后);过期条目不再豁免,由 probe 点名回红。
      expired: now >= reviewByMs + DAY_MS,
      relPath: raw.kind === 'process' ? '' : relUnderLegacy(raw.identity.slice(raw.identity.indexOf('=') + 1)),
    })
  }
  return { kind: 'ok', entries, rejected, why: undefined }
}

/** process identity → {name, session('*'|'<n>')};形态已由 exemptionProblem 校验过。 */
function parseProcessIdentity(identity) {
  const m = /^name=([^|]+)(?:\|session=(\d+|\*))?$/.exec(identity)
  return m ? { name: m[1].trim(), session: m[2] || '*' } : null
}

/**
 * 结构性限制台账读取(只读,不写)。五件套 `id + subject + reason(≥10 字) + owner + reviewBy`
 * 缺任一 ⇒ 该条不生效、进 rejected 并由 probe 点名(不是豁免通道,不允许「登记了就变绿」)。
 * `reviewBy` 过期 ⇒ 标 expired,由 probe 点名要求复核;坏 JSON / 形状不对 ⇒ kind='invalid',
 * probe 落未判定 —— 与豁免表同一条纪律:坏账不许静默当空表。
 * @param {{readFile?:Function, now?:number, path?:string}} [opts]
 * @returns {{kind:'absent'|'ok'|'invalid', entries:Array<{id:string,subject:string,reason:string,owner:string,reviewBy:string,expired:boolean}>, rejected:Array<{identity:string, why:string}>, why:(string|undefined)}}
 */
export function loadDevenvMigrateKnownLimits({
  readFile = (p) => readFileSync(p, 'utf8'),
  now = Date.now(),
  path = KNOWN_LIMITS_FILE,
} = {}) {
  let text
  try {
    text = readFile(path)
  } catch (e) {
    if (e && e.code === 'ENOENT')
      return { kind: 'absent', entries: [], rejected: [], why: `结构性限制台账不在位:${path}` }
    return { kind: 'invalid', entries: [], rejected: [], why: `结构性限制台账读不到(${(e && e.code) || e})` }
  }
  let parsed
  try {
    parsed = JSON.parse(String(text))
  } catch (e) {
    return {
      kind: 'invalid',
      entries: [],
      rejected: [],
      why: `结构性限制台账不可解析:${String((e && e.message) || e).slice(0, 80)}`,
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.entries))
    return { kind: 'invalid', entries: [], rejected: [], why: '结构性限制台账形状不对(需 {"entries": [...]})' }
  const entries = []
  const rejected = []
  for (const raw of parsed.entries) {
    const id = raw && typeof raw.id === 'string' ? raw.id.trim() : ''
    const subject = raw && typeof raw.subject === 'string' ? raw.subject.trim() : ''
    const reason = raw && typeof raw.reason === 'string' ? raw.reason.trim() : ''
    const owner = raw && typeof raw.owner === 'string' ? raw.owner.trim() : ''
    const reviewBy = raw && typeof raw.reviewBy === 'string' ? raw.reviewBy.trim() : ''
    const problem =
      !id
        ? '缺 id'
        : !subject
          ? '缺 subject'
          : reason.length < 10
            ? 'reason 少于 10 字'
            : !owner
              ? '缺 owner'
              : !/^\d{4}-\d{2}-\d{2}$/.test(reviewBy) || Number.isNaN(Date.parse(`${reviewBy}T00:00:00Z`))
                ? 'reviewBy 不是 YYYY-MM-DD'
                : ''
    if (problem) {
      rejected.push({ identity: id || '?', why: `结构性限制条目不完整(${problem})` })
      continue
    }
    entries.push({
      id,
      subject,
      reason,
      owner,
      reviewBy,
      expired: now >= Date.parse(`${reviewBy}T00:00:00Z`) + DAY_MS,
    })
  }
  return { kind: 'ok', entries, rejected, why: undefined }
}


/**
 * 旧根锁面:有界、不穿重解析点地找 `*.lock`,逐个判持有 pid 是否还活着。
 * 口径:活 pid ⇒ live(占用);pid 读不出 ⇒ live(不确定即视为占用,方向=多等一轮);
 * 依赖清单(非空且名称在 DEPENDENCY_LOCK_NAMES)⇒ nonRuntime(点名留痕、不计占用);
 * pid 已死 ⇒ stale(陈旧锁只报数,不阻 —— 否则历史残留会把窗口永久锁死);
 * 个别条目读不到 ⇒ 报数不阻(它不是「有人在用」的证据,且永久阻 = 又一种停摆);
 * 枚举截断 ⇒ 该子项 undetermined(未见 ≠ 不存在)。
 * 2026-11-04 起支持分片续扫(opts.resume):到预算落游标、下一轮续;跨轮完成的环若环跨
 * > QUIET_MINUTES,锁是**时点证据**,跨太久同样只能当进度 ⇒ undetermined(不假装「这一小时没人加锁」)。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function}} io
 * @param {string} root
 * @param {{maxDepth?:number, entryBudget?:number, pidAlive?:Function, now?:number,
 *          resume?:{state:object|null, save?:Function, why?:string}}} [opts]
 * @returns {{kind:'ok'|'undetermined', scanned:number, locks:number, live:Array<{path:string,pid:(number|null),why:string}>, stale:Array<{path:string,pid:number}>, nonRuntime:Array<{path:string,why:string}>, truncated:boolean, unreadable:string[], why:(string|undefined)}}}
 */
export function scanLegacyLocks(io, root, opts = {}) {
  const maxDepth = opts.maxDepth ?? LEGACY_LOCK_SCAN.maxDepth
  const entryBudget = opts.entryBudget ?? LEGACY_LOCK_SCAN.entryBudget
  const pidAlive = opts.pidAlive ?? defaultPidAlive
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const resume = opts.resume || null
  const run = driveScan(io, {
    key: 'legacyLocks',
    root,
    maxDepth,
    budget: entryBudget,
    prev: resume ? resume.state : null,
    nowMs: now,
    makeAcc: () => ({
      locks: 0,
      live: /** @type {Array<{path:string,pid:(number|null),why:string}>} */ ([]),
      stale: /** @type {Array<{path:string,pid:number}>} */ ([]),
      nonRuntime: /** @type {Array<{path:string,why:string}>} */ ([]),
      unreadable: /** @type {string[]} */ ([]),
    }),
    onUnreadable: (p, e, state) => {
      state.acc.unreadable.push(`${p}(${(e && e.code) || e})`)
    },
    onEntry: ({ path: p, name, st, state }) => {
      if (!st.isDirectory() && !/\.lock$/i.test(String(name))) return
      if (st.isDirectory()) return
      const acc = state.acc
      acc.locks++
      let text
      try {
        text = io.readFileSync(p, 'utf8')
      } catch (e) {
        acc.unreadable.push(`${p}(${(e && e.code) || e})`)
        return
      }
      const pid = pidFromLockText(text)
      if (pid === null) {
        // 依赖清单(Cargo/poetry/uv…)与运行时锁同名 `.lock`,但无 pid 且非空 ⇒ 非运行时锁:
        // 点名留痕、不计占用。空的 `index.lock`/`refs/…/*.lock` 仍按占用(不确定即视为在用)。
        if (DEPENDENCY_LOCK_NAMES.has(String(name).toLowerCase()) && String(text).trim()) {
          acc.nonRuntime.push({ path: p, why: '依赖清单(*.lock),非运行时锁,不计占用' })
          return
        }
        acc.live.push({ path: p, pid: null, why: '锁内容读不出 pid,不确定即视为占用' })
        return
      }
      let alive = true
      try {
        alive = Boolean(pidAlive(pid))
      } catch {
        alive = true // 判活抛错 ⇒ 按占用处理(方向:多等一轮)
      }
      if (alive) acc.live.push({ path: p, pid, why: `持有 pid ${pid} 存活` })
      else acc.stale.push({ path: p, pid })
    },
  })
  if (resume && resume.why && !run.progress.resetWhy) run.progress.resetWhy = resume.why
  const persisted = resume && resume.save ? Boolean(resume.save(persistableScanState(run.state))) : false
  run.progress.persisted = persisted
  const acc = run.state.acc
  const out = {
    kind: /** @type {'ok'|'undetermined'} */ ('ok'),
    scanned: run.state.scannedTotal,
    scannedThisRound: run.scannedThisRound,
    locks: acc.locks,
    live: acc.live,
    stale: acc.stale,
    nonRuntime: acc.nonRuntime,
    truncated: !run.finished,
    reused: Boolean(run.reused),
    unreadable: acc.unreadable,
    why: /** @type {(string|undefined)} */ (undefined),
    progress: run.progress,
    rounds: run.state.rounds,
    cycleStartedAt: run.state.cycleStartedAt,
    cycleEndedAt: run.finished
      ? (run.state.lastComplete && Number.isFinite(run.state.lastComplete.at) ? run.state.lastComplete.at : now)
      : null,
  }
  if (out.truncated) {
    out.kind = 'undetermined'
    out.why = `锁面枚举超过预算 ${entryBudget} 条:本轮预算截断(${scanProgressText(
      run.progress,
    )};已扫部分 *.lock ${acc.locks} 个;剩余未见 ≠ 不存在)`
  } else if (run.progress.cycleSpanMinutes > SCAN_CYCLE_MAX_SPAN_MINUTES) {
    out.kind = 'undetermined'
    out.why = `锁面续扫环跨 ${run.progress.cycleSpanMinutes.toFixed(
      1,
    )} 分钟 > 静默阈值 ${SCAN_CYCLE_MAX_SPAN_MINUTES} 分钟:跨轮期间新加的锁可能在已扫目录里没被看到,只算进度不算判定`
  }
  return out
}

/**
 * 判② 活使用面(票面 ② 的可满足口径):旧根上是否真有「搬迁会打断」的使用者。
 * 两面:②-a 活进程(命令行 / 可执行路径落在旧根路径段内)、②-b 旧根锁(活 pid 或读不出 pid)。
 * 三态:busy(有命中,reasons 点名)/ undetermined(进程表或锁面取不到,或单行字段读不出)/ idle(可放行)。
 * 逐行口径:两字段都可读 ⇒ 照常判命中/未命中;命中优先(可判定否定)。
 * 未命中且**任一字段为空/缺失** ⇒ 该行无法判定(受保护进程的 CommandLine/ExecutablePath
 * 常态为 null),计入 unreadable,PID 留痕;**绝不**把这种行读成「它没在用旧根」。
 * 2026-11-04 登记面(opts.exemptions):只对「读不出」的行/锁生效,且必须同时满足
 * 登记命中 ∧ 条目合法 ∧ 未过 reviewBy ∧ 命中数 ≤ maxRows;真命中/真 pid 占用永不豁免。
 * 未登记读不出的行保持 fail-closed。过期/超限/非法条目进 blockedExemptions,由 probe 回红。
 * 两面都可注入(§22c 构造面),生产默认面 = 进程表派生 + 真锁扫描。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function, spawnSync:Function}} io
 * @param {{listProcesses?:Function, pidAlive?:Function, lockScan?:Object, exemptions?:Object}} [opts]
 * @returns {{state:'idle'|'busy'|'undetermined', reasons:string[], facts:{processes:Object, locks:Object, exemptions:Object, blockedExemptions:string[]}}}
 */
export function legacyActiveUse(io, opts = {}) {
  const listProcesses = opts.listProcesses || (() => defaultProcessTable(io))
  const pidAlive = opts.pidAlive || defaultPidAlive
  const lockScan = opts.lockScan || {}
  const exemptions =
    opts.exemptions && typeof opts.exemptions === 'object'
      ? opts.exemptions
      : { kind: 'absent', entries: [], rejected: [] }
  const exEntries = Array.isArray(exemptions.entries) ? exemptions.entries : []
  const processes = {
    kind: /** @type {'ok'|'undetermined'} */ ('ok'),
    total: 0,
    hits: /** @type {Array<{pid:(number|null), why:string}>} */ ([]),
    unreadable: 0,
    unreadablePids: /** @type {(number|null)[]} */ ([]),
    unreadableRows: /** @type {Array<{pid:(number|null), name:string, sessionId:(number|null), why:string}>} */ ([]),
    exempted: 0,
    why: /** @type {(string|undefined)} */ (undefined),
  }
  try {
    const rows = listProcesses()
    if (!Array.isArray(rows)) throw new Error(`进程表形态不对(${rows === null ? 'null' : typeof rows})`)
    processes.total = rows.length
    for (const row of rows) {
      const cmdline = row && row.cmdline ? String(row.cmdline) : ''
      const exePath = row && row.exePath ? String(row.exePath) : ''
      const pid = row && Number.isFinite(Number(row.pid)) ? Number(row.pid) : null
      const name = row && row.name ? String(row.name) : ''
      const sessionId =
        row && row.sessionId !== null && row.sessionId !== undefined && Number.isFinite(Number(row.sessionId))
          ? Number(row.sessionId)
          : null
      // 可读字段先判命中(命中是可判定否定,优先级高于「读不出」)
      if (commandMentionsRoot(cmdline, LEGACY_ROOT) || withinRoot(exePath, LEGACY_ROOT)) {
        processes.hits.push({ pid, why: String(cmdline || exePath).slice(0, 160) })
        continue
      }
      // 未命中 + 任一字段读不出 ⇒ 无法排除它落在旧根内 ⇒ 该行先记「读不出」,稍后只按登记面豁免
      if (!cmdline || !exePath) {
        processes.unreadableRows.push({
          pid,
          name,
          sessionId,
          why: String(cmdline || exePath ? '单字段可读、另一字段读不出' : '命令行与路径都读不出').slice(0, 160),
        })
      }
    }
  } catch (e) {
    processes.kind = 'undetermined'
    processes.why = `进程表取不到(${(e && e.message) || e})`
  }
  // 续扫:只有显式注入 scanStore 才落游标(probe 核心保持零写盘;main / 巡检臂会注入)。
  const scanStore = opts.scanStore || null
  const lockResume = scanStore
    ? (() => {
        const loaded = scanStore.load('legacyLocks')
        return { state: loaded.state, why: loaded.why, save: (s) => scanStore.save('legacyLocks', s) }
      })()
    : null
  const locks = scanLegacyLocks(io, LEGACY_ROOT, {
    pidAlive,
    ...lockScan,
    now: Number.isFinite(opts.now) ? opts.now : Date.now(),
    resume: lockResume,
  })
  const exempted = { processes: [], locks: [], paths: [] }
  const blocked = /** @type {string[]} */ ([])

  // ②-a 读不出的进程行:按登记条目分组;命中数超 maxRows 或无登记 ⇒ 全部退回 unreadable(fail-closed)。
  const groups = new Map()
  const leftovers = []
  for (const row of processes.unreadableRows) {
    const entry = row.name
      ? exEntries.find((e) => {
          if (e.kind !== 'process' || e.expired) return false
          const id = parseProcessIdentity(e.identity)
          if (!id || id.name !== row.name) return false
          return id.session === '*' || id.session === String(row.sessionId)
        })
      : undefined
    if (!entry) {
      leftovers.push(row)
      continue
    }
    if (!groups.has(entry)) groups.set(entry, [])
    groups.get(entry).push(row)
  }
  for (const [entry, rows] of groups) {
    if (rows.length > entry.maxRows) {
      leftovers.push(...rows)
      blocked.push(`${entry.identity} 命中 ${rows.length} 行,超过 maxRows=${entry.maxRows}(不豁免)`)
      continue
    }
    exempted.processes.push({ identity: entry.identity, pids: rows.map((r) => r.pid) })
  }
  processes.unreadableRows = leftovers
  processes.unreadable = leftovers.length
  processes.unreadablePids = leftovers.slice(0, 8).map((r) => r.pid)
  processes.exempted = exempted.processes.reduce((n, g) => n + g.pids.length, 0)

  // ②-b 无 pid 的锁:只有「根相对路径逐字命中登记且未过期未超限」才豁免;
  // 带活 pid 的锁是可判定占用,登记永远不豁免(登记解释「读不出」,不发放占用许可)。
  const lockCounts = new Map()
  const liveLocks = []
  for (const h of locks.live) {
    if (h.pid !== null) {
      liveLocks.push(h)
      continue
    }
    const rel = relUnderLegacy(h.path)
    const entry = exEntries.find((e) => e.kind === 'lock' && !e.expired && e.relPath === rel)
    if (!entry) {
      liveLocks.push(h)
      continue
    }
    const n = (lockCounts.get(entry) || 0) + 1
    if (n > entry.maxRows) {
      liveLocks.push(h)
      blocked.push(`${entry.identity} 命中 ${n} 个锁,超过 maxRows=${entry.maxRows}(不豁免)`)
      continue
    }
    lockCounts.set(entry, n)
    exempted.locks.push({ path: h.path, identity: entry.identity })
  }
  locks.live = liveLocks

  // path 类:登记只清理「枚举/stat 读不到」的信息面(该面本来就不阻,不能把红变绿)。
  if (Array.isArray(locks.unreadable) && locks.unreadable.length) {
    const keep = []
    for (const item of locks.unreadable) {
      const abs = String(item).replace(/\([A-Z0-9_]+\)$/i, '')
      const rel = relUnderLegacy(abs)
      const entry = exEntries.find(
        (e) => e.kind === 'path' && !e.expired && (rel === e.relPath || rel.startsWith(`${e.relPath}/`)),
      )
      if (entry) exempted.paths.push({ path: abs, identity: entry.identity })
      else keep.push(item)
    }
    locks.unreadable = keep
  }

  const reasons = []
  if (processes.kind === 'undetermined') reasons.push(`判② 活进程面:${processes.why}`)
  for (const h of processes.hits) reasons.push(`判② 活进程面:pid ${h.pid === null ? '?' : h.pid} 点名旧根 —— ${h.why}`)
  if (locks.kind === 'undetermined') reasons.push(`判② 旧根锁面:${locks.why}`)
  for (const h of locks.live) reasons.push(`判② 旧根锁面:${h.path} —— ${h.why}`)
  // 命中/占用是可判定否定 ⇒ busy 优先;没有可判定否定时,读不出的行 + 取不到的面 ⇒ undetermined。
  const state = reasons.length
    ? 'busy'
    : processes.kind === 'undetermined' || processes.unreadable > 0 || locks.kind === 'undetermined'
      ? 'undetermined'
      : 'idle'
  return { state, reasons, facts: { processes, locks, exemptions: exempted, blockedExemptions: blocked } }
}

/**
 * --probe 的判② 明细行(信息面与覆盖面自述,不参与三态)。
 * 立因:判据换口径时必须把「新面测了什么、旧面为什么退役、哪一面仍未覆盖」当场印出来,
 * 否则下一个人只看到一行 `pending`,又会误判成「结构上到不了」。
 * @param {{activeUse:Object, sessionTmp:Object, tmpProbe:Object}} facts
 * @returns {string[]}
 */
export function activityNotes(facts) {
  const a = facts.activeUse
  const p = a.facts.processes
  const l = a.facts.locks
  const x = a.facts.exemptions || { processes: [], locks: [], paths: [] }
  const fmtQuiet = (f) => {
    if (!f) return '取不到'
    if (f.kind === 'absent') return '不存在'
    if (f.kind === 'ok' && f.quietMinutes !== null) return `${f.quietMinutes.toFixed(1)} 分钟前`
    return `未判定(${f.why || '?'})`
  }
  const notes = [
    p.kind === 'ok'
      ? `判② 活进程面:已枚举 ${p.total} 个进程,命中旧根 ${p.hits.length} 个${
          p.unreadable ? `;其中 ${p.unreadable} 个命令行/路径读不出(无法判定)` : ''
        }${p.exempted ? `;按登记豁免 ${p.exempted} 个` : ''}`
      : `判② 活进程面:${p.why}`,
    `判② 旧根锁面:扫 ${l.scanned} 条目 / *.lock ${l.locks} 个(占用 ${l.live.length}、陈旧 ${l.stale.length}${
      l.unreadable.length ? `、读不到 ${l.unreadable.length}` : ''
    }${x.locks.length ? `、按登记豁免 ${x.locks.length}` : ''}${
      l.nonRuntime && l.nonRuntime.length
        ? `;非运行时锁 ${l.nonRuntime.length} 个(依赖清单,不计占用):${l.nonRuntime
            .slice(0, 8)
            .map((x) => x.path)
            .join(', ')}${l.nonRuntime.length > 8 ? ` …等 ${l.nonRuntime.length} 个` : ''}`
        : ''
    })`,
    '判② 未覆盖面:旧根内打开句柄与进程 cwd(纯 Node 取不到)⇒ 由 repairOne 改名安全失败兜底(不建 junction、不删源)',
    `信息面(不参与三态):${SESSION_TMP} ${fmtQuiet(facts.sessionTmp)};${TMP_PROBE} ${fmtQuiet(
      facts.tmpProbe,
    )}(旧口径阈值 ${SESSION_IDLE_MINUTES} 分钟已退役,见头注判②)${
      facts.knownLimits && facts.knownLimits.kind === 'ok' && facts.knownLimits.entries.length
        ? `;结构性限制登记 ${facts.knownLimits.entries.length} 条(${facts.knownLimits.entries
            .map((e) => `${e.id} owner=${e.owner} reviewBy=${e.reviewBy}`)
            .join('、')})`
        : ''
    }`,
  ]
  // 复用在环必须单独印出来(tree 面平时没有独立行,且复用不产生新扫描 ⇒ 不印就看不见空窗)。
  // 注意顺序:先给「旧根锁面」那一行追加(unshift 之前 notes[1] 才是锁面),再插入树面行。
  if (l && l.reused) notes[1] += `;${scanReuseText(l.progress)}`
  if (facts.legacyRoot && facts.legacyRoot.reused)
    notes.unshift(
      `判① 旧根树面:${scanReuseText(facts.legacyRoot.progress)}(实得 ${facts.legacyRoot.entries} 条)`,
    )
  const tr = facts.legacyRoot && facts.legacyRoot.progress
  const lp = l && l.progress
  const treePartial = Boolean(tr && !tr.finished)
  const lockPartial = Boolean(lp && !lp.finished)
  if (treePartial || lockPartial) {
    const bits = []
    if (treePartial) bits.push(`判① ${scanProgressText(tr)}${tr.persisted === false ? '(游标未落盘)' : ''}`)
    else if (tr) bits.push(`判① 已扫完一环(${tr.scannedInCycle} 条 / ${tr.rounds} 轮)`)
    if (lockPartial) bits.push(`判② ${scanProgressText(lp)}${lp.persisted === false ? '(游标未落盘)' : ''}`)
    else if (lp) bits.push(`判② 已扫完一环(${lp.scannedInCycle} 条 / ${lp.rounds} 轮)`)
    notes.push(`续扫进度(预算按片,下一轮从游标续,不整轮重来):${bits.join(';')}`)
  }
  return notes
}

/**
 * 静默窗口三态(票面判据 ①② + 守护存活前置)。
 * 判② 走 legacyActiveUse(活使用面),两探针目录的静默读数只作信息面。
 * 登记面(activity.exemptions 可注入;缺省读 EXEMPTIONS_FILE,零写盘):只豁免登记命中的
 * 「读不出」子项;表级非法 / 单条非法 / 过期条目一律进 unjudged ⇒ 回红(fail-closed)。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function, spawnSync:Function}} io
 * @param {number} [now]
 * @param {{listProcesses?:Function, pidAlive?:Function, lockScan?:Object, exemptions?:Object, scanStore?:Object}} [activity] 判② 注入面(测试用)
 * @returns {{state:'window'|'pending'|'undetermined', reasons:string[], unjudged:string[], facts:Object}}
 */
export function probeQuietWindow(io, now = Date.now(), activity = {}) {
  const exemptions =
    activity.exemptions && typeof activity.exemptions === 'object'
      ? activity.exemptions
      : loadDevenvMigrateExemptions({ readFile: (p) => io.readFileSync(p, 'utf8'), now })
  // 结构性限制台账:只登记「归属/复核期」,不抑制任何红;坏账/过期反而进 unjudged。
  const knownLimits =
    activity.knownLimits && typeof activity.knownLimits === 'object'
      ? activity.knownLimits
      : loadDevenvMigrateKnownLimits({ readFile: (p) => io.readFileSync(p, 'utf8'), now })
  // 续扫:只有调用方显式注入 scanStore(main / 巡检臂)才落游标;不注入 ⇒ 核心仍旧零写盘。
  const scanStore = activity.scanStore || null
  const treeResume = scanStore
    ? (() => {
        const loaded = scanStore.load('legacyTree')
        return { state: loaded.state, why: loaded.why, save: (s) => scanStore.save('legacyTree', s) }
      })()
    : null
  const facts = {
    legacyRoot: latestWrite(io, LEGACY_ROOT, now, { resume: treeResume }),
    activeUse: legacyActiveUse(io, { ...activity, exemptions, now }),
    sessionTmp: latestWrite(io, SESSION_TMP, now),
    tmpProbe: latestWrite(io, TMP_PROBE, now),
    guardian: guardianTickAlive(io, now),
    exemptions,
    knownLimits,
    scanStore: scanStore ? { path: scanStore.path } : null,
  }
  const v1 = quietVerdict(facts.legacyRoot, QUIET_MINUTES, `判① 旧根 ${LEGACY_ROOT}`)
  const p = facts.activeUse.facts.processes
  const l = facts.activeUse.facts.locks
  // 可判定否定(有写入 / 有占用)与输入未判定(截断/取不到/单行字段读不出)分开攒:
  // 前者足以把结论钉成 pending;后者只在「没有可判定否定」时才让整条结论 undetermined。
  // 这样截断与读不出的进程行不再把整条结论抹成未判定,但也没有把它们读成「静默」(两态方向不变)。
  const reasons = []
  const unjudged = []
  if (!v1.pass) {
    if (v1.undetermined) unjudged.push(v1.note)
    else reasons.push(v1.note)
  }
  if (p.kind === 'undetermined') unjudged.push(`判② 活进程面:${p.why}`)
  if (p.unreadable > 0)
    unjudged.push(
      `判② 活进程面:${p.unreadable} 个进程的命令行/路径读不出,无法判定(pid ${
        p.unreadablePids.map((x) => (x === null ? '?' : x)).join(',') || '?'
      }${p.unreadable > p.unreadablePids.length ? ' …' : ''})`,
    )
  for (const h of p.hits)
    reasons.push(`判② 活进程面:pid ${h.pid === null ? '?' : h.pid} 点名旧根 —— ${h.why}`)
  if (l.kind === 'undetermined') unjudged.push(`判② 旧根锁面:${l.why}`)
  for (const h of l.live) reasons.push(`判② 旧根锁面:${h.path} —— ${h.why}`)
  // 登记表自身的账:表级非法 / 单条非法 / 过期 / 命中超 maxRows 一律回红,不许静默续期或静默扩张。
  if (exemptions.kind === 'invalid') unjudged.push(`判② 登记表:${exemptions.why}`)
  for (const r of exemptions.rejected || []) unjudged.push(`判② 登记表:非法条目 ${r.identity} —— ${r.why}`)
  for (const e of exemptions.entries || [])
    if (e.expired) unjudged.push(`判② 登记表:过期条目 ${e.identity}(reviewBy ${e.reviewBy} 已过,须复核,不豁免)`)
  for (const b of facts.activeUse.facts.blockedExemptions || []) unjudged.push(`判② 登记表:${b}`)
  // 结构性限制台账:坏账/非法/过期都点名(它不抑制红,所以这里只会让结论更保守)。
  if (knownLimits.kind === 'invalid') unjudged.push(`结构性限制台账:${knownLimits.why}`)
  for (const r of knownLimits.rejected || []) unjudged.push(`结构性限制台账:非法条目 ${r.identity} —— ${r.why}`)
  for (const e of knownLimits.entries || [])
    if (e.expired)
      unjudged.push(`结构性限制台账:${e.id}(reviewBy ${e.reviewBy} 已过,须复核;不许把「已登记」当作已解决)`)
  if (facts.guardian.state !== 'alive') unjudged.push(`守护存活:${facts.guardian.why}`)
  const state = reasons.length ? 'pending' : unjudged.length ? 'undetermined' : 'window'
  if (state === 'window')
    reasons.unshift(
      `守护存活:末条 tick ${facts.guardian.lastIso}(距今 ${facts.guardian.ageMinutes !== null ? facts.guardian.ageMinutes.toFixed(1) : '?'} 分钟)`,
    )
  return { state, reasons, unjudged, facts }
}

/**
 * 枚举盘根一层的重解析点并按指向分类(new=指新根 / legacy=指旧根 / other=无关 / undetermined)。
 * 只看一层不跟随;readlink 失败 = undetermined 单列,不猜。链接本体的分类不含"动它"的授权。
 * @param {{lstatSync:Function, readdirSync:Function, readlinkSync:Function}} io
 * @param {string} driveRoot 盘根(C:\)
 * @returns {Array<{name:string, pointsTo:string, target:string}>}
 */
function listDriveJunctions(io, driveRoot) {
  let names = []
  try {
    names = io.readdirSync(driveRoot)
  } catch {
    return []
  }
  const legacyPrefix = join(DRIVE_ROOT, 'DevEnv') + sep
  const out = []
  for (const name of names) {
    const p = join(driveRoot, name)
    let st
    try {
      st = io.lstatSync(p)
    } catch {
      continue
    }
    if (!st.isSymbolicLink()) continue
    let target = ''
    try {
      target = resolve(String(io.readlinkSync(p)))
    } catch {
      out.push({ name, pointsTo: 'undetermined', target: '' })
      continue
    }
    if (target === resolve(NEW_ROOT) || target.startsWith(resolve(NEW_ROOT) + sep)) out.push({ name, pointsTo: 'new', target })
    else if (target === resolve(legacyPrefix) || target.startsWith(legacyPrefix)) out.push({ name, pointsTo: 'legacy', target })
    else out.push({ name, pointsTo: 'other', target })
  }
  return out
}

/**
 * 家目录侧 junction 现状:登记面复用 re-home 的 plan()(门 96 registryOf + targetFor +
 * devEnvRoot 单源,§0.6),形态判经 io 注入。points-new / points-legacy / real-dir / n-a。
 * @param {{lstatSync:Function, readlinkSync:Function}} io
 * @returns {Array<{src:string, state:string, note:string}>}
 */
function homeJunctionStates(io) {
  let rows = []
  try {
    rows = reHomePlan()
  } catch {
    return []
  }
  const out = []
  for (const it of rows) {
    let st
    try {
      st = io.lstatSync(it.src)
    } catch {
      out.push({ src: it.src, state: 'n-a', note: '不存在' })
      continue
    }
    if (!st.isSymbolicLink()) {
      out.push({ src: it.src, state: st.isDirectory() ? 'real-dir' : 'n-a', note: st.isDirectory() ? '实体目录,待 re-home' : '非目录' })
      continue
    }
    let target = ''
    try {
      target = resolve(String(io.readlinkSync(it.src)))
    } catch (e) {
      out.push({ src: it.src, state: 'n-a', note: `readlink 失败(${(e && e.code) || e})` })
      continue
    }
    if (target === resolve(it.dst) || target.startsWith(resolve(it.dst) + sep))
      out.push({ src: it.src, state: 'points-new', note: target })
    else out.push({ src: it.src, state: 'points-legacy', note: `${target}(非登记目标 ⇒ 按 apply 步骤 2 重建为 ${it.dst})` })
  }
  return out
}

/**
 * 票面六步逐项盘点(只读)。done = 已发生;todo = 待做;apply-gate = 仅 --apply 档的总闸。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function, readlinkSync:Function}} io
 * @returns {Array<{id:number, title:string, state:'done'|'todo'|'apply-gate', evidence:string}>}
 */
export function assessSteps(io) {
  const now = Date.now()
  const steps = []

  // S1 同卷搬迁:旧根形态即答案
  const legacy = latestWrite(io, LEGACY_ROOT, now)
  if (legacy.kind === 'absent')
    steps.push({ id: 1, title: '同卷搬迁 G:\\DevEnv → 仓内 .DevEnv', state: 'done', evidence: `旧根 ${LEGACY_ROOT} 已不存在${legacy.why ? `(${legacy.why})` : ''}` })
  else if (legacy.kind === 'ok')
    steps.push({
      id: 1,
      title: '同卷搬迁 G:\\DevEnv → 仓内 .DevEnv',
      state: 'todo',
      evidence: `旧根残留:条目 ${legacy.entries !== undefined ? legacy.entries : '?'}(跳过重解析点 ${legacy.junctions}),最新写入距今 ${legacy.quietMinutes !== null ? legacy.quietMinutes.toFixed(0) : '?'} 分钟`,
    })
  else
    steps.push({ id: 1, title: '同卷搬迁 G:\\DevEnv → 仓内 .DevEnv', state: 'todo', evidence: `旧根:${legacy.why}` })

  // S2 junction 指向:C 盘侧按实测枚举(不抄死 8),家目录侧复用门 96 登记表(§0.6)
  const cLinks = listDriveJunctions(io, C_DRIVE)
  const cNew = cLinks.filter((l) => l.pointsTo === 'new').length
  const cOld = cLinks.filter((l) => l.pointsTo === 'legacy').length
  const home = homeJunctionStates(io)
  const homeNew = home.filter((h) => h.state === 'points-new').length
  const homeOld = home.filter((h) => h.state === 'points-legacy').length
  const homeTodo = home.filter((h) => h.state === 'real-dir').length
  const s2Done = cOld === 0 && homeOld === 0 && homeTodo === 0
  steps.push({
    id: 2,
    title: '重建 C 盘与家目录 junction(一律 Junction 类型,指向新根)',
    state: s2Done ? 'done' : 'todo',
    evidence:
      `${C_DRIVE} 实测重解析点:指新根 ${cNew} / 指旧根 ${cOld} / 无关或读不到 ${cLinks.length - cNew - cOld};` +
      `家目录登记 ${home.length} 项:指新根 ${homeNew}、指旧根 ${homeOld}、实体待搬 ${homeTodo}、其余 ${home.filter((h) => h.state === 'n-a').length}`,
  })

  // S3 硬编码面:逐文件计数,活代码才算待清(历史注释按「删副本不删证据」保留)
  const s3rows = []
  let s3Code = 0
  let s3Comment = 0
  for (const rel of HARD_CODED_FILES) {
    const p = join(ROOT, rel)
    let text
    try {
      text = io.readFileSync(p, 'utf8')
    } catch (e) {
      s3rows.push(`${rel}:读不到(${(e && e.code) || e})`)
      continue
    }
    let code = 0
    let comment = 0
    for (const line of String(text).split(/\r?\n/)) {
      if (!/G:[\\/]+DevEnv/i.test(line)) continue
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) comment++
      else code++
    }
    s3Code += code
    s3Comment += comment
    if (code + comment > 0) s3rows.push(`${rel}:活代码 ${code} / 注释 ${comment}`)
  }
  steps.push({
    id: 3,
    title: `改硬编码面(${HARD_CODED_FILES.length} 文件 = 5 脚本 + 3 复核位)`,
    state: s3Code === 0 ? 'done' : 'todo',
    evidence:
      s3rows.length === 0
        ? 'G:\\DevEnv 字面命中 0'
        : `命中 ${s3Code + s3Comment} 行(活代码 ${s3Code} / 历史注释 ${s3Comment},注释按证据保留):${s3rows.join(' ; ')}`,
  })

  // S4 .gitignore
  let s4State = 'todo'
  let s4Evidence = `${GITIGNORE} 读不到`
  try {
    const lines = String(io.readFileSync(GITIGNORE, 'utf8')).split(/\r?\n/)
    const at = lines.findIndex((l) => /^\.?\/?\.DevEnv\/\s*(?:#.*)?$/.test(l.trim()))
    if (at >= 0) {
      s4State = 'done'
      s4Evidence = `${GITIGNORE}:${at + 1} = ${lines[at].trim()}`
    } else s4Evidence = '无 .DevEnv/ 条目'
  } catch {
    /* 保持 todo */
  }
  steps.push({ id: 4, title: '.gitignore 登记 .DevEnv/', state: s4State, evidence: s4Evidence })

  // S5 回读验证 = apply 总闸
  steps.push({ id: 5, title: '逐项回读验证(apply 总闸)', state: 'apply-gate', evidence: '仅 --apply 档执行;默认档零写盘' })

  // S6 白名单摘过渡条目:devEnvTargetRoots 双根在役即 todo
  let s6State = 'todo'
  let s6Evidence = `${SEAL_SCRIPT} 读不到`
  try {
    const text = String(io.readFileSync(SEAL_SCRIPT, 'utf8'))
    if (/\[inRepo,\s*legacy\]/.test(text)) s6Evidence = 'seal-c-root-stray.mjs devEnvTargetRoots() 过渡双根在役(acceptableTargets 仍认旧根)'
    else {
      s6State = 'done'
      s6Evidence = '过渡双根已摘(acceptableTargets 仅新根)'
    }
  } catch {
    /* 保持 todo */
  }
  steps.push({ id: 6, title: '白名单摘除过渡条目(搬迁过渡期双根候选)', state: s6State, evidence: s6Evidence })

  return steps
}

/**
 * 预演:把「将做什么」逐行返回(零写盘)。
 * @param {Array<{id:number,title:string,state:string,evidence:string}>} assessed
 * @param {{state:string, reasons:string[]}} probe
 * @returns {string[]}
 */
export function planSteps(assessed, probe) {
  const lines = []
  const unjudged = probe.unjudged && probe.unjudged.length ? `;未判定子项:${probe.unjudged.join(' ; ')}` : ''
  lines.push(`静默窗口:${probe.state}${probe.reasons.length ? `(${probe.reasons.join(' ; ')})` : ''}${unjudged}`)
  if (probe.state !== 'window') {
    lines.push('--apply 将被拒绝:非 window 态不执行任何搬迁动作。')
    return lines
  }
  for (const s of assessed) {
    if (s.state === 'done') lines.push(`步骤${s.id} 已发生,跳过:${s.title} —— ${s.evidence}`)
    else if (s.state === 'apply-gate') lines.push(`步骤${s.id} 将执行:逐项回读验证(junction 指向 / 硬编码零活代码 / .gitignore 在册 / 旧根清形),任一不符即报 1`)
    else lines.push(`步骤${s.id} 将执行:${s.title} —— 现状:${s.evidence}`)
  }
  return lines
}

/**
 * --apply 执行器(票面 1-6 步,顺序不可换;本轮不真跑,仅供将来窗口期执行)。
 * 前置闸:probe 非 window 一律拒绝(main 落 exit 3)。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function, readlinkSync:Function, writeFileSync:Function, mkdirSync:Function, renameSync:Function, rmSync:Function, spawnSync:Function}} io
 * @param {{state:string, reasons:string[]}} probeResult
 * @returns {{refused:boolean, reason:(string|undefined), rows:Array<{step:number, ok:boolean, note:string}>, verified:boolean}}
 */
export function applyMigration(io, probeResult) {
  if (probeResult.state !== 'window')
    return {
      refused: true,
      reason: `静默窗口判 ${probeResult.state},拒绝执行(${probeResult.reasons.join(' ; ')})`,
      rows: [],
      verified: false,
    }
  const rows = []
  // ── 步骤 1:旧根逐子树 re-home(复用 repairOne:镜像复制→内容校验→改名→原位建链→回读)──
  for (const name of safeReaddir(io, LEGACY_ROOT)) {
    const src = join(LEGACY_ROOT, name)
    let st
    try {
      st = io.lstatSync(src)
    } catch (e) {
      rows.push({ step: 1, ok: false, note: `${src} lstat 失败(${(e && e.code) || e}),跳过交人工` })
      continue
    }
    if (st.isSymbolicLink()) {
      rows.push({ step: 1, ok: true, note: `${src} 是重解析点,不搬不删(封口态)` })
      continue
    }
    const r = repairViaReHome(src, join(NEW_ROOT, name))
    rows.push({ step: 1, ok: r.ok, note: r.note })
  }
  // ── 步骤 2:重建 C 盘与家目录 junction(一律 Junction 类型,指新根)──
  for (const l of listDriveJunctions(io, C_DRIVE)) {
    if (l.pointsTo === 'new') {
      rows.push({ step: 2, ok: true, note: `${l.name} 已指新根,跳过` })
      continue
    }
    if (l.pointsTo !== 'legacy') {
      rows.push({ step: 2, ok: false, note: `${l.name} 指向${l.pointsTo === 'undetermined' ? '读不到' : '无关目标'}(${l.target}),不擅改交人工` })
      continue
    }
    const newTarget = String(l.target).replace(/^([A-Za-z]:)[\\/]DevEnv/i, NEW_ROOT)
    const r = rebuildJunction(io, join(C_DRIVE, l.name), newTarget)
    rows.push({ step: 2, ok: r.ok, note: `${l.name}:${r.note}` })
  }
  for (const h of homeJunctionStates(io)) {
    if (h.state === 'points-new' || h.state === 'n-a') {
      rows.push({ step: 2, ok: true, note: `${h.src}:${h.state === 'points-new' ? '已指新根' : '不存在/非目录'},跳过` })
      continue
    }
    const planRow = reHomePlan().find((p) => p.src === h.src)
    const dst = planRow
      ? planRow.dst
      : join(NEW_ROOT, 'cache', 'userhome', h.src.slice(h.src.lastIndexOf(sep) + 1))
    if (h.state === 'real-dir') {
      const r = repairViaReHome(h.src, dst)
      rows.push({ step: 2, ok: r.ok, note: `${h.src}:${r.note}` })
      continue
    }
    const r = rebuildJunction(io, h.src, dst)
    rows.push({ step: 2, ok: r.ok, note: `${h.src}:${r.note}` })
  }
  // ── 步骤 3:受控替换(水印三段 clean → 替换 → inject;§5c)──
  for (const spec of APPLY_REPLACEMENTS) {
    const r = controlledEdit(io, join(ROOT, spec.file), spec.edits)
    rows.push({ step: 3, ok: r.ok, note: `${spec.file}:${r.note}` })
  }
  rows.push({
    step: 3,
    ok: true,
    note: `历史注释命中保留(删副本不删证据);${HARD_CODED_FILES.length} 文件面由步骤 5 复核兜底`,
  })
  // ── 步骤 4:.gitignore ──
  {
    const r = ensureGitignoreEntry(io)
    rows.push({ step: 4, ok: r.ok, note: r.note })
  }
  // ── 步骤 5:逐项回读验证(总闸)──
  const verify = verifyApplied(io)
  rows.push({ step: 5, ok: verify.ok, note: verify.note })
  if (!verify.ok) return { refused: false, rows, verified: false }
  // ── 步骤 6:摘过渡双根(水印三段)──
  {
    const r = controlledEdit(io, SEAL_SCRIPT, [
      { from: 'resolve(inRepo) === resolve(legacy) ? [inRepo] : [inRepo, legacy]', to: '[inRepo]', expect: 1 },
    ])
    rows.push({ step: 6, ok: r.ok, note: r.note })
  }
  return { refused: false, rows, verified: true }
}

/** @param {{readdirSync:Function}} io @param {string} dir @returns {string[]} */
function safeReaddir(io, dir) {
  try {
    return io.readdirSync(dir)
  } catch {
    return []
  }
}

/**
 * 续扫游标的落盘面(唯一允许在判据路径之外写盘的地方:写在仓内 `.ihui-agent/state`,
 * 不碰旧根、不碰生产目录)。默认档 probe 不注入它 ⇒ 零写盘不变。
 * 读坏 / 形状不对 ⇒ 返回 {state:null, why},由调用方如实报「重开环」,绝不猜着续。
 * 写用「临时文件 + rename」,多进程(守护巡检 + 手工 probe)并发时最多丢一轮进度,不会撕裂 JSON。
 * @param {{readFileSync:Function, writeFileSync:Function, mkdirSync:Function, renameSync:Function}} io
 * @param {{path?:string}} [opts]
 */
export function createScanStateStore({ io: storeIo, path = SCAN_STATE_FILE } = {}) {
  const io = storeIo || defaultIO()
  const readAll = () => {
    let text
    try {
      text = io.readFileSync(path, 'utf8')
    } catch (e) {
      if (e && e.code === 'ENOENT') return { ok: true, all: {}, why: undefined }
      return { ok: false, all: {}, why: `续扫游标读不到(${(e && e.code) || e})` }
    }
    try {
      const parsed = JSON.parse(String(text))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return { ok: false, all: {}, why: '续扫游标形状不对(需顶层对象)' }
      return { ok: true, all: parsed, why: undefined }
    } catch (e) {
      return { ok: false, all: {}, why: `续扫游标不可解析(${String((e && e.message) || e).slice(0, 80)})` }
    }
  }
  return {
    path,
    load(name) {
      const r = readAll()
      const s = r.ok ? r.all[name] : null
      if (!s || typeof s !== 'object' || s.v !== SCAN_STATE_VERSION)
        return { kind: r.ok ? 'absent' : 'invalid', state: null, why: r.why }
      return { kind: 'ok', state: s, why: undefined }
    },
    save(name, state) {
      try {
        const all = readAll().all // 读坏也覆盖写:宁可丢旧游标,也不让坏账永久卡住续扫
        all[name] = state
        io.mkdirSync(dirname(path), { recursive: true })
        const tmp = `${path}.${process.pid}.tmp`
        io.writeFileSync(tmp, JSON.stringify(all), 'utf8')
        io.renameSync(tmp, path)
        return true
      } catch {
        return false
      }
    },
  }
}

/** 步骤 1/2 的搬迁动作:委托 re-home-junctions.repairOne(单源),本层零复算(§0.6)。 */
function repairViaReHome(src, dst) {
  try {
    const r = reHomeRepair(src, dst, { dry: false })
    return { ok: Boolean(r.ok), note: `[${r.action}] ${r.note}` }
  } catch (e) {
    return { ok: false, note: `repairOne 抛错:${(e && e.message) || e}` }
  }
}

/** 断旧链 + 重建指向新根(Junction 类型);失败时尽力恢复旧指向,绝不穿透删除(§26)。 */
function rebuildJunction(io, linkPath, newTarget) {
  let oldTarget = null
  try {
    oldTarget = String(io.readlinkSync(linkPath))
  } catch {
    /* 读不到就当没有 */
  }
  try {
    io.rmSync(linkPath) // 对重解析点只断链不穿透(§26 实测)
  } catch (e) {
    return { ok: false, note: `断链失败(${(e && e.code) || e}),未动` }
  }
  const mk = (target) =>
    io.spawnSync('cmd.exe', ['/c', 'mklink', '/J', linkPath, target], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf8',
    })
  try {
    io.mkdirSync(newTarget, { recursive: true })
  } catch (e) {
    if (oldTarget) mk(oldTarget)
    return { ok: false, note: `建目标失败(${(e && e.code) || e}),已尝试恢复旧指向` }
  }
  mk(newTarget)
  let st = null
  try {
    st = io.lstatSync(linkPath)
  } catch {
    /* 空 */
  }
  if (!st || !st.isSymbolicLink()) {
    if (oldTarget) mk(oldTarget)
    return { ok: false, note: 'mklink 未生效,已尝试恢复旧指向' }
  }
  return { ok: true, note: `已重建 → ${newTarget}` }
}

/** 受控编辑:水印三段(clean → 逐字替换(带命中数断言,不符即整文件不动)→ inject)。§5c。 */
function controlledEdit(io, filePath, edits) {
  let original
  try {
    original = io.readFileSync(filePath, 'utf8')
  } catch (e) {
    return { ok: false, note: `读不到(${(e && e.code) || e})` }
  }
  let next = original
  for (const ed of edits) {
    const count = next.split(ed.from).length - 1
    if (count !== ed.expect)
      return { ok: false, note: `替换靶「${ed.from.slice(0, 40)}」命中 ${count} ≠ 预期 ${ed.expect},整文件未动` }
    next = next.split(ed.from).join(ed.to)
  }
  if (next === original) return { ok: true, note: '无变化,跳过' }
  const wm = (verb) =>
    io.spawnSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), verb, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf8',
    })
  const c = wm('clean')
  if (c.status !== 0)
    return { ok: false, note: `watermark clean 失败(rc=${c.status}):${String(c.stderr || '').trim().slice(0, 120)}` }
  try {
    io.writeFileSync(filePath, next, 'utf8')
  } catch (e) {
    try {
      io.writeFileSync(filePath, original, 'utf8')
    } catch {
      /* 还原也失败,如实报 */
    }
    return { ok: false, note: `写回失败已还原(${(e && e.code) || e})` }
  }
  const inj = wm('inject')
  if (inj.status !== 0)
    return { ok: false, note: `watermark inject 失败(rc=${inj.status}):${String(inj.stderr || '').trim().slice(0, 120)}` }
  return { ok: true, note: `替换 ${edits.length} 处并重新注入水印` }
}

function ensureGitignoreEntry(io) {
  let text = ''
  try {
    text = io.readFileSync(GITIGNORE, 'utf8')
  } catch (e) {
    return { ok: false, note: `.gitignore 读不到(${(e && e.code) || e})` }
  }
  if (/^\.?\/?\.DevEnv\/\s*(?:#.*)?$/m.test(text)) return { ok: true, note: '.DevEnv/ 已在册,跳过' }
  try {
    io.writeFileSync(GITIGNORE, text.replace(/\n*$/, '\n') + '\n.DevEnv/\n', 'utf8')
  } catch (e) {
    return { ok: false, note: `追加失败(${(e && e.code) || e})` }
  }
  return { ok: true, note: '已追加 .DevEnv/ 条目' }
}

/** 步骤 5 总闸:四项回读,任一不符即不通过(如实点名;repairOne 内建回退已保数据,不代回滚)。 */
function verifyApplied(io) {
  const problems = []
  const legacy = latestWrite(io, LEGACY_ROOT, Date.now())
  if (legacy.kind === 'ok') {
    const real = safeReaddir(io, LEGACY_ROOT).filter((n) => {
      try {
        return !io.lstatSync(join(LEGACY_ROOT, n)).isSymbolicLink()
      } catch {
        return true
      }
    })
    if (real.length) problems.push(`旧根仍有实体条目:${real.slice(0, 5).join(', ')}`)
  } else if (legacy.kind === 'undetermined') problems.push(`旧根:${legacy.why}`)
  const cOld = listDriveJunctions(io, C_DRIVE).filter((l) => l.pointsTo === 'legacy').length
  if (cOld > 0) problems.push(`${C_DRIVE} 仍有 ${cOld} 个指旧根的 junction`)
  for (const h of homeJunctionStates(io)) {
    if (h.state === 'points-legacy' || h.state === 'real-dir')
      problems.push(`家目录 ${h.src}:${h.state === 'real-dir' ? '仍是实体' : '仍指旧根'}(${h.note})`)
  }
  for (const spec of APPLY_REPLACEMENTS) {
    try {
      const text = String(io.readFileSync(join(ROOT, spec.file), 'utf8'))
      const left = spec.edits.filter((ed) => text.includes(ed.from)).length
      if (left) problems.push(`${spec.file} 仍有 ${left} 处替换靶未清`)
    } catch (e) {
      problems.push(`${spec.file} 复核读不到(${(e && e.code) || e})`)
    }
  }
  try {
    if (!/^\.?\/?\.DevEnv\/\s*(?:#.*)?$/m.test(String(io.readFileSync(GITIGNORE, 'utf8'))))
      problems.push('.gitignore 缺 .DevEnv/ 条目')
  } catch {
    problems.push('.gitignore 复核读不到')
  }
  return problems.length
    ? { ok: false, note: problems.join(' ; ') }
    : { ok: true, note: '四项回读全过(旧根清形 / junction 全指新根 / 硬编码活代码零残留 / .gitignore 在册)' }
}

// ══════════════ 巡检派发臂(git-guardian 挂点,2026-10-28)══════════════
// 票面「探测器找静默窗口自动执行」此前只造好器物、没有调度器(§0.9 造好没装车 = 没有)。
// 本臂就是那一格:挂进 guardian 巡检轮,**默认只探测**(零搬迁动作),真搬必须
// scripts/data/devenv-migrate-arm.json 显式 enabled=true(默认关,照 archive-gc-arm.json 同形)。
// 判据单源:窗口三态只问 probeQuietWindow、待做盘点只问 assessSteps、执行只走 applyMigration
// —— 本层零复算(§0.6;另起一份窗口判据必然漂移)。节流戳双执行体(main 单轮 + daemon tick)
// 共用一枚 ⇒ 同一窗口只有先到那一个真探。

/** 开关配置面(照 archive-gc-arm.json 同形:{"enabled":boolean});入库默认关。 */
export const ARM_CONFIG = join(ROOT, 'scripts', 'data', 'devenv-migrate-arm.json')
/** 节流戳(双执行体共用唯一一枚)。 */
export const ARM_TICK = join(ROOT, '.ihui-agent', 'state', 'devenv-migrate-arm-tick.iso')
/** 节流窗口 30 分钟:窗口判据要求旧根静默 ≥60 分钟,半小时采样足以在窗口出现后抓住它。 */
export const PATROL_INTERVAL_MS = Number(process.env.IHUI_DEVENV_MIGRATE_ARM_INTERVAL_MS || 30 * 60 * 1000)
/**
 * 按需加密(2026-11-04):续扫环一旦**打开且未闭合**,只把**本臂自己**的下一轮派发间隔调密,
 * 环一闭合/游标作废/触顶立刻回落 30 分钟。它是相位调整,不是常驻加密:环不在开就不加密。
 * 4 分钟的依据:守护计划任务 2 分钟一 tick ⇒ 实际可达粒度就是 2 分钟,4 分钟 = 每两 tick 跑一次
 * (既不对着 tick 抖,也不空转);13 轮 × 4 分钟 = 52 分钟,加末轮探针耗时(实测约 70 秒)≈ 53 分钟,
 * 仍在 SCAN_CYCLE_MAX_SPAN_MINUTES=60 之内(留两轮滑移余量:15 轮 × 4 分钟 + 末轮 ≈ 57 分钟仍 ≤ 60)。
 * 只动本臂自己的节流,不改守护轮与任何其它巡检项的 tick 文件 ⇒ 其余门节奏不变(见报告「延迟上限」)。
 */
export const DENSE_PATROL_INTERVAL_MS = Number(
  process.env.IHUI_DEVENV_MIGRATE_ARM_DENSE_INTERVAL_MS || 4 * 60 * 1000,
)
/** 连续加密上限:到点必须回落原节拍并报警,且**本环不再加密**(环闭合/重开后重新计数),防卡死的环把巡检永久拖进高频。 */
export const DENSE_MAX_HOLD_MS = Number(process.env.IHUI_DEVENV_MIGRATE_ARM_DENSE_MAX_MS || 2 * 60 * 60 * 1000)
/** 守护计划任务的实际 tick(2 分钟一轮):加密粒度不得低于它,否则算出来的 due 也跑不起来。 */
export const GUARDIAN_TICK_MS = 2 * 60 * 1000
/** 加密态落盘(只存「从哪一刻开始加密 / 哪一环 / 哪一环已触顶」,不存被扫内容)。 */
export const ARM_DENSE_STATE = join(ROOT, '.ihui-agent', 'state', 'devenv-migrate-arm-dense.json')

/** 节流判定(纯函数):取不到戳 ⇒ 视为**该跑了**(与 archiveGcArmDue 同一条失效方向)。 */
export function devenvArmDue(nowMs, tickMs, intervalMs = PATROL_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/** 续扫两面(判① 全树 / 判② 锁面)的开环身份:与 driveScan 的 key/root/maxDepth 逐字同形,对不上即「游标作废」。 */
const SCAN_FACE_SPECS = [
  { name: 'legacyTree', key: 'legacyTree', maxDepth: SCAN_DEPTH_UNBOUNDED, budget: ENUM_BUDGET },
  { name: 'legacyLocks', key: 'legacyLocks', maxDepth: LEGACY_LOCK_SCAN.maxDepth, budget: LEGACY_LOCK_SCAN.entryBudget },
]

/**
 * 「环是否打开」的**唯一**判据:直接读已落盘的续扫游标,不另立第二份状态。
 * 打开 = 至少一面游标可续(key/root/maxDepth/版本全同)且栈非空(还有目录没遍历完)。
 * 闭合 = 栈空(整环扫完);作废 = 形状/身份对不上(下一轮会重开环,但**现在**不据此加密)。
 * 之所以必须核对 root/maxDepth:游标是跨版本持久件,只凭「栈非空」会把上一个根的残栈当成本环。
 * @param {{load:Function}|null} scanStore
 * @returns {{open:boolean, faces:Array<object>, openFaces:string[], rounds:number|null,
 *            estimatedRoundsRemaining:(number|null), remainingUnknown:boolean,
 *            cycleStartedAt:(number|null), signature:string, why:string}}
 */
export function scanCycleFacts(scanStore) {
  const faces = []
  for (const spec of SCAN_FACE_SPECS) {
    let loaded
    try {
      loaded = scanStore
        ? scanStore.load(spec.name)
        : { kind: 'absent', state: null, why: '未接续扫游标(不猜环态)' }
    } catch (e) {
      loaded = { kind: 'invalid', state: null, why: `续扫游标读不到(${(e && e.message) || e})` }
    }
    const s = loaded && loaded.state
    const shapeOk = Boolean(s) && typeof s === 'object' && s.v === SCAN_STATE_VERSION && s.key === spec.key && s.root === LEGACY_ROOT && s.maxDepth === spec.maxDepth
    const pendingDirs = shapeOk && Array.isArray(s.stack) ? s.stack.length : 0
    const est = shapeOk && s.lastComplete && Number.isFinite(s.lastComplete.entries) ? s.lastComplete.entries : null
    const scannedTotal = shapeOk && Number.isFinite(s.scannedTotal) ? s.scannedTotal : 0
    faces.push({
      name: spec.name,
      open: shapeOk && pendingDirs > 0,
      shapeOk,
      pendingDirs,
      rounds: shapeOk && Number.isFinite(s.rounds) ? s.rounds : null,
      scannedTotal,
      cycleStartedAt: shapeOk && Number.isFinite(s.cycleStartedAt) ? s.cycleStartedAt : null,
      estimatedCycleEntries: est,
      estimatedRoundsRemaining: est === null ? null : Math.max(0, Math.ceil((est - scannedTotal) / spec.budget)),
    })
  }
  const openFaces = faces.filter((f) => f.open)
  const rounds = openFaces.reduce((m, f) => (f.rounds !== null && f.rounds > m ? f.rounds : m), 0)
  const remainKnown = openFaces.map((f) => f.estimatedRoundsRemaining).filter((v) => v !== null)
  const starts = openFaces.map((f) => f.cycleStartedAt).filter((v) => v !== null)
  const signature = openFaces
    .map((f) => `${f.name}@${f.cycleStartedAt === null ? '?' : f.cycleStartedAt}`)
    .sort()
    .join('|')
  const why = openFaces.length
    ? `续扫环未闭合(${openFaces.map((f) => `${f.name} 还剩 ${f.pendingDirs} 个目录`).join(';')})`
    : faces.some((f) => !f.shapeOk && f.pendingDirs === 0 && scanStore)
      ? '游标不可续/作废 ⇒ 环视为未打开(本轮不加密,下一轮重开环后再判)'
      : '环已闭合(栈空)或无游标 ⇒ 不加密'
  return {
    open: openFaces.length > 0,
    faces,
    openFaces: openFaces.map((f) => f.name),
    rounds,
    estimatedRoundsRemaining: remainKnown.length ? Math.max(...remainKnown) : null,
    remainingUnknown: remainKnown.length === 0,
    cycleStartedAt: starts.length ? Math.min(...starts) : null,
    signature,
    why,
  }
}

/**
 * 加密态读取(只读;坏账不致命 —— 当作「未加密」,下一次运行会重写)。
 * @param {{readFile?:Function, path?:string}} [opts]
 */
export function readArmDenseState({ readFile = (p) => readFileSync(p, 'utf8'), path = ARM_DENSE_STATE } = {}) {
  const empty = { v: 1, denseStartedAt: null, cycleSignature: null, suppressedFor: null, why: undefined }
  let text
  try {
    text = readFile(path)
  } catch (e) {
    if (e && e.code === 'ENOENT') return empty
    return { ...empty, why: `加密态读不到(${(e && e.code) || e})` }
  }
  try {
    const p = JSON.parse(String(text))
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { ...empty, why: '加密态形状不对(需顶层对象)' }
    return {
      v: 1,
      denseStartedAt: Number.isFinite(p.denseStartedAt) ? p.denseStartedAt : null,
      cycleSignature: typeof p.cycleSignature === 'string' ? p.cycleSignature : null,
      suppressedFor: typeof p.suppressedFor === 'string' ? p.suppressedFor : null,
      why: undefined,
    }
  } catch (e) {
    return { ...empty, why: `加密态不可解析(${String((e && e.message) || e).slice(0, 60)})` }
  }
}

/**
 * 节拍决策(纯函数,零 io):唯一会缩短本臂间隔的入口。
 * 顺序:环未打开 ⇒ 原节拍(并清加密态);本环已触顶 ⇒ 原节拍(不再加密);持有超上限 ⇒
 * **回落原节拍 + 报警 + 本环封禁**;否则 ⇒ 加密节拍(首轮记 denseStartedAt)。
 * @param {{now:number, tickMs:number, scan:ReturnType<typeof scanCycleFacts>, denseState:object,
 *          baseIntervalMs?:number, denseIntervalMs?:number, maxHoldMs?:number}} cfg
 */
export function armCadenceDecision(cfg) {
  const {
    now,
    tickMs,
    scan,
    denseState,
    baseIntervalMs = PATROL_INTERVAL_MS,
    denseIntervalMs = DENSE_PATROL_INTERVAL_MS,
    maxHoldMs = DENSE_MAX_HOLD_MS,
  } = cfg
  const baseView = {
    dense: false,
    intervalMs: baseIntervalMs,
    denseStartedAt: null,
    holdMs: null,
    fallbackAtMs: null,
    alarm: null,
    scan,
  }
  if (!scan || !scan.open) {
    const hadDense = Boolean(denseState && Number.isFinite(denseState.denseStartedAt))
    return {
      ...baseView,
      due: devenvArmDue(now, tickMs, baseIntervalMs),
      event: hadDense ? 'exit-closed' : 'none',
      reason: (scan && scan.why) || '环态未知',
      nextState: { v: 1, denseStartedAt: null, cycleSignature: null, suppressedFor: null },
      persist: hadDense || Boolean(denseState && denseState.suppressedFor),
    }
  }
  const sig = scan.signature
  if (denseState && denseState.suppressedFor === sig) {
    return {
      ...baseView,
      due: devenvArmDue(now, tickMs, baseIntervalMs),
      event: 'none',
      reason: `本环(${sig})已触达加密上限 ⇒ 不再加密,等环闭合/重开后重置`,
      nextState: { v: 1, denseStartedAt: null, cycleSignature: null, suppressedFor: sig },
      persist: false,
    }
  }
  const carried = denseState && Number.isFinite(denseState.denseStartedAt) && denseState.cycleSignature === sig
  const denseStartedAt = carried ? denseState.denseStartedAt : now
  const holdMs = Math.max(0, now - denseStartedAt)
  if (holdMs >= maxHoldMs) {
    const minutes = Math.round(holdMs / 60000)
    return {
      ...baseView,
      due: devenvArmDue(now, tickMs, baseIntervalMs),
      event: 'exit-cap',
      reason: `连续加密 ${minutes} 分钟 ≥ 上限 ${Math.round(maxHoldMs / 60000)} 分钟 ⇒ 回落原节拍,本环不再加密`,
      alarm: `连续加密 ${minutes} 分钟 ≥ 上限 ${Math.round(maxHoldMs / 60000)} 分钟 ⇒ 回落 ${Math.round(baseIntervalMs / 60000)} 分钟节拍,并封禁本环加密(卡住的环须人工看,不许把巡检永久拖进高频)`,
      nextState: { v: 1, denseStartedAt: null, cycleSignature: null, suppressedFor: sig },
      persist: true,
    }
  }
  const enter = !carried
  return {
    dense: true,
    due: devenvArmDue(now, tickMs, denseIntervalMs),
    intervalMs: denseIntervalMs,
    denseStartedAt,
    holdMs,
    fallbackAtMs: denseStartedAt + maxHoldMs,
    alarm: null,
    event: enter ? 'enter-dense' : 'none',
    reason: `依据 ${scan.why}`,
    scan,
    nextState: { v: 1, denseStartedAt, cycleSignature: sig, suppressedFor: null },
    persist: enter || Boolean(denseState && denseState.suppressedFor),
  }
}

/**
 * 只读面/日志的一句话(加密态、依据、环内轮数、预计剩余、回落时刻)。
 * @param {{scan:object, dense:boolean, denseStartedAt:number|null, now:number,
 *          denseIntervalMs?:number, maxHoldMs?:number, reason?:string}} cfg
 */
export function armDensityText(cfg) {
  const {
    scan,
    dense,
    denseStartedAt = null,
    now,
    denseIntervalMs = DENSE_PATROL_INTERVAL_MS,
    maxHoldMs = DENSE_MAX_HOLD_MS,
    reason = '',
  } = cfg
  const rounds = scan && Number.isFinite(scan.rounds) ? scan.rounds : 0
  const remaining = scan ? scan.estimatedRoundsRemaining : null
  if (!dense)
    return `自动臂节拍:原 ${Math.round(PATROL_INTERVAL_MS / 60000)} 分钟(${reason || (scan && scan.why) || '环未打开'})`
  const started = Number.isFinite(denseStartedAt) ? denseStartedAt : now
  const fallbackAt = started + maxHoldMs
  const remText =
    remaining === null
      ? '预计还需几轮:尚无基准(上一完整环未落账)'
      : `预计还需约 ${remaining} 轮,按现节拍约 ${new Date(now + remaining * denseIntervalMs).toISOString()} 扫完`
  return (
    `自动臂节拍:加密中(${Math.round(denseIntervalMs / 60000)} 分钟/轮)` +
    `;依据 ${(scan && scan.why) || '环未闭合'}` +
    `;环内已扫 ${rounds} 轮;${remText}` +
    `;最迟回落 ${new Date(fallbackAt).toISOString()}(上限 ${Math.round(maxHoldMs / 60000)} 分钟)`
  )
}

/**
 * 开关读取(纯注入面,镜像测试喂构造件)。三态:
 * 读到布尔 ⇒ {ok:true, enabled};读不到/坏形 ⇒ {ok:false, why}(未判定,不是「已关」)。
 * 只有明写 enabled=true 才可能动作。
 */
export function loadDevenvMigrateArm({
  configPath = ARM_CONFIG,
  readFile = (p) => readFileSync(p, 'utf8'),
  exists = existsSync,
} = {}) {
  if (!exists(configPath)) return { ok: false, why: `开关配置不在位:${configPath}` }
  let parsed
  try {
    parsed = JSON.parse(readFile(configPath))
  } catch (e) {
    return { ok: false, why: `开关配置不可解析:${String((e && e.message) || e).slice(0, 120)}` }
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.enabled !== 'boolean')
    return { ok: false, why: '开关配置形状不对(需 {"enabled": true|false})' }
  return { ok: true, enabled: parsed.enabled }
}

/**
 * 巡检轮接线臂本体。默认零参数即生产形态;镜像测试全部走注入(零真搬迁、零生产副作用)。
 * 顺序:加密节拍决策(只读游标) → 节流 → probe(判据单源) → 三态分流 → 待做盘点(既有 assessSteps) → 开关 → apply。
 * 加密只是本臂自己的相位:其余巡检项仍按守护轮各自的节流戳派发,不被本臂牵动(见 DENSE_PATROL_INTERVAL_MS 注释)。
 * 日志纪律:pending 与「window 但六步无待做」静默(常态,写它只会把通道喊废);
 * window 有待做 / undetermined 各留一行(前者要人开档或搬,后者是判据输入取不到);
 * 加密期每轮留一行(进入 / 续扫),回落 / 触顶各留一行(触顶是报警级)。
 * @returns {{ran:boolean, state?:string, ok?:boolean, actions:number, done?:boolean, why?:string, dense:boolean, cadence:Object}}
 */
export function devenvMigratePatrol(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = PATROL_INTERVAL_MS,
    denseIntervalMs = DENSE_PATROL_INTERVAL_MS,
    denseMaxHoldMs = DENSE_MAX_HOLD_MS,
    tickFile = ARM_TICK,
    denseFile = ARM_DENSE_STATE,
    configPath = ARM_CONFIG,
    io = defaultIO(),
    logger = (m) => console.log(m),
    probeFn = probeQuietWindow,
    activity: activityBase = {},
    applyFn = applyMigration,
    scanStore = null,
    readFile = (p) => readFileSync(p, 'utf8'),
    exists = existsSync,
    mkdir = mkdirSync,
    writeTick = writeFileSync,
    writeDense = writeFileSync,
  } = opts
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFile(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  // 续扫游标:巡检臂是常态自动装配面,默认就落盘(否则跨轮进度永远攒不起来);
  // 注入非生产 probeFn(镜像测试)时不自动建 store,避免把测试 io 当磁盘写。
  let activity = activityBase
  const effectiveScanStore = scanStore || (probeFn === probeQuietWindow ? createScanStateStore({ io }) : null)
  if (probeFn === probeQuietWindow) activity = { ...activity, scanStore: activity.scanStore || effectiveScanStore }
  // 加密判据只来自已落盘游标(唯一状态源),再叠加加密态账本;没有任何第二份「环态」记忆。
  const scan = scanCycleFacts(effectiveScanStore)
  const cadence = armCadenceDecision({
    now,
    tickMs: lastTick,
    scan,
    denseState: readArmDenseState({ readFile, path: denseFile }),
    baseIntervalMs: intervalMs,
    denseIntervalMs,
    maxHoldMs: denseMaxHoldMs,
  })
  if (cadence.event === 'exit-cap') logger(`⚠️ G-50 DevEnv 搬迁自动臂:${cadence.alarm}`)
  else if (cadence.event === 'exit-closed') logger('⏸ G-50 DevEnv 搬迁自动臂:续扫环已闭合 ⇒ 加密立刻回落原节拍')
  if (cadence.persist) {
    try {
      mkdir(dirname(denseFile), { recursive: true })
      writeDense(denseFile, JSON.stringify(cadence.nextState), 'utf8')
    } catch {
      /* 账本写不下去只意味着下一轮重算,不得让本臂失明 */
    }
  }
  const cadenceView = {
    intervalMs: cadence.intervalMs,
    dense: cadence.dense,
    reason: cadence.reason,
    denseStartedAt: cadence.denseStartedAt,
    fallbackAtMs: cadence.fallbackAtMs,
    rounds: scan.rounds,
    estimatedRoundsRemaining: scan.estimatedRoundsRemaining,
  }
  if (!cadence.due) return { ran: false, actions: 0, why: '未到节流窗口', dense: cadence.dense, cadence: cadenceView }
  // 本窗口已留痕 ⇒ 先落节流戳(戳写不下去只意味着下轮多探一次,不得让本臂失明)。
  try {
    mkdir(dirname(tickFile), { recursive: true })
    writeTick(tickFile, new Date(now).toISOString(), 'utf8')
  } catch {
    /* 盘错不得让本臂失明 */
  }
  if (cadence.dense)
    logger(
      `⏩ G-50 DevEnv 搬迁自动臂:${cadence.event === 'enter-dense' ? '进入按需加密' : '加密态续扫'} · ` +
        armDensityText({
          scan,
          dense: true,
          denseStartedAt: cadence.denseStartedAt,
          now,
          denseIntervalMs,
          maxHoldMs: denseMaxHoldMs,
        }),
    )
  const probe = probeFn(io, now, activity)
  const tail = { dense: cadence.dense, cadence: cadenceView }
  if (probe.state === 'pending') return { ran: true, state: 'pending', actions: 0, ...tail }
  if (probe.state === 'undetermined') {
    const detail = [...(probe.reasons || []), ...(probe.unjudged || [])].join(' ; ')
    logger(`⚠️ G-50 DevEnv 搬迁:静默窗口未判定 ⇒ 本轮不搬(不记绿也不冒红)· ${detail}`)
    return { ran: true, state: 'undetermined', ok: false, actions: 0, ...tail }
  }
  // window:还有没有待做 —— 复用既有盘点(assessSteps),本层不另写第二份判据。
  const todo = assessSteps(io).filter((s) => s.state === 'todo')
  if (!todo.length) return { ran: true, state: 'window', ok: true, actions: 0, done: true, ...tail }
  const arm = loadDevenvMigrateArm({ configPath, readFile, exists })
  if (!arm.ok) {
    logger(`⚠️ G-50 DevEnv 搬迁:静默窗口已到(待做 ${todo.length} 步),但开关配置未判定(${arm.why})⇒ 只探测不搬`)
    return { ran: true, state: 'window', ok: false, actions: 0, ...tail }
  }
  if (!arm.enabled) {
    logger(
      `⏸ G-50 DevEnv 搬迁:静默窗口已到(待做 ${todo.length} 步:${todo.map((s) => `S${s.id}`).join('/')}),` +
        `devenv-migrate-arm.json enabled=false ⇒ 只探测不搬(开档由机主核过盘点后改配置)`,
    )
    return { ran: true, state: 'window', ok: true, actions: 0, ...tail }
  }
  const r = applyFn(io, probe)
  if (r.refused) {
    logger(`⚠️ G-50 DevEnv 搬迁:开臂但 apply 前置闸拒绝 ⇒ 本轮零动作 · ${r.reason}`)
    return { ran: true, state: 'window', ok: false, actions: 0, ...tail }
  }
  const bad = r.rows.filter((row) => !row.ok)
  for (const row of r.rows) logger(`· G-50 [步骤${row.step}] ${row.ok ? 'ok' : 'FAIL'}: ${row.note}`)
  const pass = r.verified && bad.length === 0
  logger(
    pass
      ? '✅ G-50 DevEnv 搬迁:window 期执行完成且回读验证通过'
      : `⚠️ G-50 DevEnv 搬迁:执行有 ${bad.length} 行不 OK、回读${r.verified ? '通过' : '不过'} ⇒ 交人工裁决(未回滚不可逆步)`,
  )
  return { ran: true, state: 'window', ok: pass, actions: r.rows.length, ...tail }
}

function selfTest() {
  const { t: push, report } = makeRegistrar()
  const NOW = 1_800_000_000_000
  const MIN = 60000
  const f = (minutesAgo) => ({ file: { mtimeMs: NOW - minutesAgo * MIN } })

  /** 构造面:tree = { [绝对路径]: {dir?:string[], file?:{mtimeMs}, link?:string, text?:string, err?:string} } */
  function fakeIO(tree) {
    // norm 必须把 / 与 \ 统一归一(replace 只去尾缀不够):win32 下 path.join('/old','a.txt')
    // 产出 '\old\a.txt',与正斜杠树键逐字不同 ⇒ 构造面全线误报 ENOENT(2026-10-25 实测)。
    // 归一必须**两侧同做**(查找键与树键各自归一后相撞),只归一查找键则正斜杠树键永远 miss。
    const norm = (p) => String(p).split(/[\\/]+/).join('\\')
    const T = {}
    for (const [k, v] of Object.entries(tree)) T[norm(k)] = v
    const get = (p) => T[norm(p)]
    const enoent = () => {
      const err = new Error('ENOENT')
      err.code = 'ENOENT'
      return err
    }
    const io = {
      writes: /** @type {string[]} */ ([]),
      lstatSync(p) {
        const e = get(p)
        if (!e) throw enoent()
        if (e.err) {
          const err = new Error(e.err)
          err.code = e.err
          throw err
        }
        return {
          isSymbolicLink: () => e.link !== undefined,
          isDirectory: () => e.dir !== undefined,
          mtimeMs: e.file !== undefined ? e.file.mtimeMs : 0,
        }
      },
      readdirSync(p) {
        const e = get(p)
        if (!e || e.dir === undefined) throw enoent()
        return e.dir
      },
      readFileSync(p) {
        const e = get(p)
        if (e && e.text !== undefined) return e.text
        throw enoent()
      },
      readlinkSync(p) {
        const e = get(p)
        if (e && e.link !== undefined) return e.link
        const err = new Error('EINVAL')
        err.code = 'EINVAL'
        throw err
      },
      writeFileSync(p) {
        io.writes.push(`write:${p}`)
      },
      mkdirSync() {
        io.writes.push('mkdir')
      },
      renameSync() {
        io.writes.push('rename')
      },
      rmSync(p) {
        io.writes.push(`rm:${p}`)
      },
      spawnSync() {
        io.writes.push('spawn')
        return { status: 0 }
      },
    }
    return io
  }

  // ── latestWrite 三态与阈值 ──
  push('latestWrite:61 分钟静默 ⇒ ok 且 quietMinutes≥60', (() => {
    const r = latestWrite(fakeIO({ '/old': { dir: ['a.txt'] }, '/old/a.txt': f(61) }), '/old', NOW)
    return r.kind === 'ok' && r.quietMinutes >= 60 && r.truncated === false
  })())
  push('latestWrite:59 分钟内有写入 ⇒ ok 但 <60(交给 verdict 判 pending)', (() => {
    const r = latestWrite(fakeIO({ '/old': { dir: ['a.txt'] }, '/old/a.txt': f(59) }), '/old', NOW)
    return r.kind === 'ok' && r.quietMinutes < 60
  })())
  push('latestWrite:目录不存在 ⇒ absent(不猜静默时长)', (() => {
    const r = latestWrite(fakeIO({}), '/nope', NOW)
    return r.kind === 'absent' && r.quietMinutes === null
  })())
  push('latestWrite:枚举截断 ⇒ undetermined(未见 ≠ 不存在)', (() => {
    const io2 = fakeIO({ '/big': { dir: ['x'] } })
    io2.readdirSync = () => Array.from({ length: ENUM_BUDGET + 1 }, (_, i) => `x${i}`)
    io2.lstatSync = () => ({ isSymbolicLink: () => false, isDirectory: () => false, mtimeMs: NOW - 90 * MIN })
    const r = latestWrite(io2, '/big', NOW)
    return (
      r.kind === 'undetermined' &&
      r.truncated === true &&
      r.entries === ENUM_BUDGET &&
      r.progress.scannedThisRound === ENUM_BUDGET &&
      r.progress.scannedInCycle === ENUM_BUDGET &&
      r.partialQuietMinutes >= 0
    )
  })())
  push('latestWrite:预算不足 ⇒ 只给部分进度,仍 undetermined(不许因为扫得多就判静默)', (() => {
    const tree = { '/big': { dir: ['a', 'b', 'c', 'd'] } }
    for (const n of ['a', 'b', 'c', 'd']) tree[`/big/${n}`] = f(90)
    const r = latestWrite(fakeIO(tree), '/big', NOW, { budget: 2 })
    return (
      r.kind === 'undetermined' &&
      r.truncated === true &&
      r.entries === 2 &&
      r.progress.scannedThisRound === 2 &&
      r.progress.pendingDirs > 0 &&
      r.progress.estimatedRoundsRemaining === null
    )
  })())
  push('latestWrite:续扫从落盘游标接着扫,第二轮才看见后段的新写入', (() => {
    let saved = null
    const tree = { '/big': { dir: ['a', 'b', 'c', 'd'] }, '/big/a': f(90), '/big/b': f(90), '/big/c': f(90), '/big/d': f(5) }
    const io2 = fakeIO(tree)
    const save = (s) => {
      saved = JSON.parse(JSON.stringify(s))
    }
    const r1 = latestWrite(io2, '/big', NOW, { budget: 2, resume: { state: null, save } })
    const afterRound1 = saved
    const r2 = latestWrite(io2, '/big', NOW, { budget: 2, resume: { state: saved, save } })
    return (
      r1.kind === 'undetermined' &&
      r1.quietMinutes === null &&
      afterRound1 &&
      afterRound1.stack.length > 0 &&
      r2.kind === 'ok' &&
      r2.entries === 4 &&
      r2.rounds === 2 &&
      r2.progress.scannedThisRound === 2 &&
      Math.round(r2.quietMinutes) === 5
    )
  })())
  push('latestWrite:续扫环跨 > 60 分钟 ⇒ undetermined(跨轮盲区不得当判定)', (() => {
    let saved = null
    const io2 = fakeIO({ '/big': { dir: ['a', 'b'] }, '/big/a': f(90), '/big/b': f(90) })
    latestWrite(io2, '/big', NOW, { budget: 1, resume: { state: null, save: (s) => (saved = JSON.parse(JSON.stringify(s))) } })
    const r2 = latestWrite(io2, '/big', NOW + 90 * MIN, { budget: 5, resume: { state: saved, save: () => {} } })
    return r2.kind === 'undetermined' && r2.rounds === 2 && /续扫环跨/.test(r2.why)
  })())
  push('latestWrite:已扫完的环在阈值内复用(不重扫、如实报空窗);超阈值 ⇒ 重开一环', (() => {
    let saved = null
    const io2 = fakeIO({ '/q': { dir: ['a'] }, '/q/a': f(200) })
    const save = (s) => {
      saved = JSON.parse(JSON.stringify(s))
    }
    const r1 = latestWrite(io2, '/q', NOW, { budget: 1, resume: { state: null, save } })
    const r2 = latestWrite(io2, '/q', NOW + 5 * MIN, { budget: 1, resume: { state: saved, save } })
    const afterReuse = saved
    const r3 = latestWrite(io2, '/q', NOW + 65 * MIN, { budget: 1, resume: { state: afterReuse, save } })
    return (
      r1.kind === 'ok' &&
      r1.entries === 1 &&
      r2.kind === 'ok' &&
      r2.reused === true &&
      r2.progress.scannedThisRound === 0 &&
      Math.abs(r2.progress.reuseAgeMinutes - 5) < 0.01 &&
      r3.kind === 'ok' &&
      r3.reused === false &&
      r3.rounds === 1 &&
      /重开一环/.test(r3.progress.resetWhy)
    )
  })())
  push('latestWrite:复用在环跨过阈值 ⇒ 转 undetermined 前先重开(不许拿陈旧环判静默)', (() => {
    let saved = null
    const io2 = fakeIO({ '/q': { dir: ['a', 'b'] }, '/q/a': f(200), '/q/b': f(200) })
    const save = (s) => {
      saved = JSON.parse(JSON.stringify(s))
    }
    const r1 = latestWrite(io2, '/q', NOW, { budget: 2, resume: { state: null, save } })
    const r2 = latestWrite(io2, '/q', NOW + 61 * MIN, { budget: 1, resume: { state: saved, save } })
    return r1.kind === 'ok' && r2.reused === false && /重开一环/.test(r2.progress.resetWhy) && r2.progress.rounds === 1
  })())
  push('scanLegacyLocks:预算不足 ⇒ undetermined;续扫第二片才看见后段活锁', (() => {
    let saved = null
    const io2 = fakeIO({
      '/old': { dir: ['a', 'b'] },
      '/old/a': { dir: [] },
      '/old/b': { dir: ['index.lock'] },
      '/old/b/index.lock': { text: '12345' },
    })
    const pidAlive = (pid) => pid === 12345
    const save = (s) => {
      saved = JSON.parse(JSON.stringify(s))
    }
    const r1 = scanLegacyLocks(io2, '/old', { entryBudget: 2, now: NOW, pidAlive, resume: { state: null, save } })
    const afterRound1 = saved
    const r2 = scanLegacyLocks(io2, '/old', { entryBudget: 2, now: NOW, pidAlive, resume: { state: saved, save } })
    return (
      r1.kind === 'undetermined' &&
      r1.truncated === true &&
      r1.live.length === 0 &&
      afterRound1.stack.length > 0 &&
      r2.kind === 'ok' &&
      r2.live.length === 1 &&
      r2.locks === 1 &&
      r2.scanned === 3
    )
  })())
  push('latestWrite:单条 lstat 失败 ⇒ undetermined(漏看的可能正是最新写入)', (() => {
    const r = latestWrite(
      fakeIO({ '/old': { dir: ['a.txt', 'bad.bin'] }, '/old/a.txt': f(90), '/old/bad.bin': { err: 'EPERM' } }),
      '/old',
      NOW,
    )
    return r.kind === 'undetermined' && /EPERM/.test(r.why || '')
  })())

  // ── 重解析点穿透防护(§26,真夹具端到端)──
  {
    const root = mkScratch('ihui-devenv-mig-')
    try {
      const j = join(root, 'legacy-root')
      mkdirSync(j, { recursive: true })
      writeFileSync(join(j, 'old.txt'), 'x', 'utf8')
      const inner = join(root, 'inner-target')
      mkdirSync(inner, { recursive: true })
      writeFileSync(join(inner, 'recent.txt'), 'y', 'utf8') // mtime = 现在
      const mk = spawnSync('cmd.exe', ['/c', 'mklink', '/J', join(j, 'linked'), inner], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        encoding: 'utf8',
      })
      // 夹具目录与文件的 mtime 都要拨旧:建夹具/写文件的每一步都会刷新父目录 mtime,
      // 而目录自身 mtime(条目增删时刻)是 latestWrite 的合法「写入」证据 —— 最后统一拨旧。
      const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
      utimesSync(join(j, 'old.txt'), staleAt, staleAt)
      utimesSync(j, staleAt, staleAt)
      const linkOk = (() => {
        try {
          return lstatSync(join(j, 'linked')).isSymbolicLink()
        } catch {
          return false
        }
      })()
      push('夹具 junction 建成(建不出 = 本组穿透判据未被覆盖)', linkOk, `rc=${mk.status} ${mk.stderr || ''}`)
      if (linkOk) {
        const r = latestWrite(defaultIO(), j, Date.now())
        push('§26:junction 内 0 秒前的新文件不得把旧根判成活跃(枚举穿透防护)', r.kind === 'ok' && (r.quietMinutes ?? 0) >= 60, JSON.stringify(r).slice(0, 160))
        push('§26:junction 被计数为跳过项(穿透即 false)', r.junctions === 1, `junctions=${r.junctions}`)
      }
    } finally {
      rmScratch(root)
    }
  }

  // ── guardianTickAlive ──
  push('guardian:留痕新鲜(2 分钟)⇒ alive 且回读末条', (() => {
    const iso = new Date(NOW - 2 * MIN).toISOString()
    const r = guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: `[${iso}] 行\n` } }), NOW)
    return r.state === 'alive' && r.lastIso === iso
  })())
  push('guardian:留痕过期(20 分钟 > 15)⇒ undetermined(失明期静默不可信)', (() => {
    const iso = new Date(NOW - 20 * MIN).toISOString()
    const r = guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: `[${iso}] 行\n` } }), NOW)
    return r.state === 'undetermined' && /未 tick/.test(r.why || '')
  })())
  push('guardian:留痕读不到 ⇒ undetermined(不猜)', guardianTickAlive(fakeIO({}), NOW).state === 'undetermined')
  push(
    'guardian:无时间戳行(中文散文)⇒ undetermined(不猜)',
    guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: '中文散文行,无 ISO 戳\n' } }), NOW).state === 'undetermined',
  )

  // ── probeQuietWindow 汇总三态(tree 键 = 真实常量路径,与探测器所问逐字同形)──
  // 判② 注入面:listProcesses / pidAlive 全构造,零真派生、零真旧根依赖(§22c)。
  const IDLE = { listProcesses: () => [], pidAlive: () => false }
  const K = { legacy: LEGACY_ROOT, tmp: SESSION_TMP, probe: TMP_PROBE, log: GUARDIAN_LOG }
  const probeTree = ({ legacyMin = 90, tmpMin = 40, guardianAgeMin = 2, locks = null } = {}) => {
    const iso = new Date(NOW - guardianAgeMin * MIN).toISOString()
    const names = ['a'].concat(locks ? Object.keys(locks) : [])
    const tree = {
      [K.legacy]: { dir: names },
      [`${K.legacy}\\a`]: f(legacyMin),
      [K.tmp]: { dir: ['t'] },
      [`${K.tmp}\\t`]: f(tmpMin),
      [K.probe]: { dir: ['p'] },
      [`${K.probe}\\p`]: f(120),
      [K.log]: { text: `[${iso}] tick\n` },
    }
    for (const [name, text] of Object.entries(locks || {})) tree[`${K.legacy}\\${name}`] = { text }
    return tree
  }
  push('probe:两判据全过 ∧ 守护活 ⇒ window', probeQuietWindow(fakeIO(probeTree()), NOW, IDLE).state === 'window')
  push('probe:旧根 59 分钟内有写入 ⇒ pending 且点名判①', (() => {
    const r = probeQuietWindow(fakeIO(probeTree({ legacyMin: 59 })), NOW, IDLE)
    return r.state === 'pending' && r.reasons.some((s) => s.includes('判①'))
  })())
  // 阳性对照 ③(旧口径残留项):两探针目录新鲜写入**不得**再阻 —— 只出现在信息面。
  push('probe:会话探针目录 1 分钟前写入不再阻塞(旧口径退役),但信息面仍有读数', (() => {
    const r = probeQuietWindow(fakeIO(probeTree({ tmpMin: 1 })), NOW, IDLE)
    const note = activityNotes(r.facts).find((s) => s.startsWith('信息面'))
    return r.state === 'window' && Boolean(note) && /1\.0 分钟前/.test(note)
  })())
  // 阳性对照 ①:「有人在用」⇒ 活进程点名旧根 ⇒ pending。
  push('probe:旧根有活进程(命令行点名旧根)⇒ pending 且点名判② 活进程面', (() => {
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, {
      listProcesses: () => [
        { pid: 4242, cmdline: `node "${join(LEGACY_ROOT, 'Temp', 'job.mjs')}"`, exePath: '' },
        { pid: 11, cmdline: `node app.js --cwd ${LEGACY_ROOT}-other\\Temp`, exePath: `${LEGACY_ROOT}-other\\node.exe` },
      ],
      pidAlive: () => false,
    })
    return (
      r.state === 'pending' &&
      r.reasons.some((s) => s.includes('判② 活进程面') && s.includes('4242')) &&
      !r.reasons.some((s) => s.includes('pid 11 '))
    )
  })())
  // 阳性对照 ②:「有人在用」⇒ 旧根锁带活 pid ⇒ pending;陈旧锁不阻。
  push('probe:旧根锁 carry 活 pid ⇒ pending;pid 已死 ⇒ 陈旧锁不阻', (() => {
    const busy = probeQuietWindow(fakeIO(probeTree({ locks: { 'x.lock': '{"pid":4242}' } })), NOW, {
      listProcesses: () => [],
      pidAlive: (pid) => pid === 4242,
    })
    const stale = probeQuietWindow(fakeIO(probeTree({ locks: { 'y.lock': '{"pid":999999}' } })), NOW, IDLE)
    const unknown = probeQuietWindow(fakeIO(probeTree({ locks: { 'z.lock': '' } })), NOW, IDLE)
    const manifest = probeQuietWindow(fakeIO(probeTree({ locks: { 'Cargo.lock': '# generated\n[[package]]\n' } })), NOW, IDLE)
    const unknownText = probeQuietWindow(fakeIO(probeTree({ locks: { 'weird.lock': 'not a pid, not a manifest\n' } })), NOW, IDLE)
    return (
      busy.state === 'pending' &&
      busy.reasons.some((s) => s.includes('判② 旧根锁面') && s.includes('4242')) &&
      stale.state === 'window' &&
      unknown.state === 'pending' &&
      manifest.state === 'window' &&
      unknownText.state === 'pending'
    )
  })())
  push('probe:进程表取不到 ⇒ 未判定子项(unjudged 点名,不把"没判"写成"没人用")', (() => {
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, {
      listProcesses: () => {
        throw new Error('pwsh 不在')
      },
      pidAlive: () => false,
    })
    return r.state === 'undetermined' && r.unjudged.some((s) => s.includes('进程表取不到'))
  })())
  // 单行字段为空(null/缺失)⇒ 该行必须进 unjudged;不得因「读不出」被读成「这一行没在用旧根」。
  const psRows = (arr) => parseProcessTable(JSON.stringify(arr))
  push('probe:表内单行 CommandLine/ExecutablePath 为 null ⇒ 不得判 window(该行进 unjudged)', (() => {
    const rows = psRows([{ ProcessId: 4, CommandLine: null, ExecutablePath: null }])
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, { listProcesses: () => rows, pidAlive: () => false })
    return r.state === 'undetermined' && r.unjudged.some((s) => s.includes('读不出'))
  })())
  push('probe:空字段行 + 其余行已判无占用 ⇒ 仍 undetermined,unjudged 带条数与 pid', (() => {
    const rows = psRows([
      { ProcessId: 4, CommandLine: null, ExecutablePath: null },
      { ProcessId: 88, CommandLine: 'notepad.exe', ExecutablePath: 'C:\\Windows\\System32\\notepad.exe' },
    ])
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, { listProcesses: () => rows, pidAlive: () => false })
    return (
      r.state === 'undetermined' &&
      r.reasons.length === 0 &&
      r.unjudged.some((s) => s.includes('1 个进程的命令行/路径读不出') && s.includes('4'))
    )
  })())
  push('probe:全部字段可读且无占用 ⇒ 仍判 window(修过头把正常路径堵死即翻红)', (() => {
    const rows = psRows([
      { ProcessId: 88, CommandLine: 'notepad.exe', ExecutablePath: 'C:\\Windows\\System32\\notepad.exe' },
    ])
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, { listProcesses: () => rows, pidAlive: () => false })
    return r.state === 'window' && r.unjudged.length === 0
  })())

  // ── 显式登记面(2026-11-04):只登记「为什么永远读不出」;过期/非法/超限一律回红 ──
  const exTable = (entries) => loadDevenvMigrateExemptions({ readFile: () => JSON.stringify({ entries }), now: NOW })
  const protectedRows = psRows([
    { ProcessId: 4, Name: 'System', SessionId: 0, CommandLine: null, ExecutablePath: null },
    { ProcessId: 88, Name: 'notepad.exe', SessionId: 1, CommandLine: 'notepad.exe', ExecutablePath: 'C:\\Windows\\System32\\notepad.exe' },
  ])
  const SYSTEM_EX = {
    kind: 'process',
    identity: 'name=System|session=0',
    why: 'Windows 内核伪进程(Name/会话可读,CommandLine 与 ExecutablePath 恒为 null),纯用户态永久读不出',
    reviewBy: '2027-02-10',
    maxRows: 1,
  }
  push('登记①:登记命中的读不出行 ⇒ 该条不再阻挡,结论 window', (() => {
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, {
      listProcesses: () => protectedRows,
      pidAlive: () => false,
      exemptions: exTable([SYSTEM_EX]),
    })
    const p = r.facts.activeUse.facts.processes
    return r.state === 'window' && p.exempted === 1 && p.unreadable === 0 && r.unjudged.length === 0
  })())
  push('登记②:同类读不出的行未登记 ⇒ 仍 undetermined(fail-closed 未被放宽)', (() => {
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, { listProcesses: () => protectedRows, pidAlive: () => false })
    return r.state === 'undetermined' && r.unjudged.some((s) => s.includes('读不出')) && r.facts.activeUse.facts.processes.exempted === 0
  })())
  push('登记③:登记过期(超 reviewBy)⇒ 不豁免且整条回红(不许静默续期)', (() => {
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, {
      listProcesses: () => protectedRows,
      pidAlive: () => false,
      exemptions: exTable([{ ...SYSTEM_EX, reviewBy: '2026-12-01' }]),
    })
    return (
      r.state === 'undetermined' &&
      r.facts.activeUse.facts.processes.exempted === 0 &&
      r.unjudged.some((s) => s.includes('过期条目') && s.includes('name=System'))
    )
  })())
  push('登记④:条目字段缺失 / identity 用裸 pid ⇒ 判非法登记并回红', (() => {
    const ex = exTable([
      { kind: 'process', identity: '4', why: '裸 pid 会漂,不该被接受', reviewBy: '2027-02-10' },
      { kind: 'lock', identity: 'lock=index.lock', reviewBy: '2027-02-10' },
    ])
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, {
      listProcesses: () => protectedRows,
      pidAlive: () => false,
      exemptions: ex,
    })
    return (
      ex.kind === 'ok' &&
      ex.entries.length === 0 &&
      ex.rejected.length === 2 &&
      r.state === 'undetermined' &&
      r.unjudged.some((s) => s.includes('裸 pid')) &&
      r.unjudged.some((s) => s.includes('why 缺失'))
    )
  })())
  push('登记⑤:条目数超过上限 ⇒ 整表非法回红(防扩张成万能豁免面)', (() => {
    const many = Array.from({ length: EXEMPTIONS_MAX_ENTRIES + 1 }, (_, i) => ({
      ...SYSTEM_EX,
      identity: `name=x${i}.exe`,
    }))
    const ex = exTable(many)
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, { listProcesses: () => protectedRows, pidAlive: () => false, exemptions: ex })
    return ex.kind === 'invalid' && r.state === 'undetermined' && r.unjudged.some((s) => s.includes('超过上限'))
  })())
  push('登记⑥:无 pid 的占位 *.lock 登记后不阻;未登记仍按占用(fail-closed 方向不变)', (() => {
    const tree = probeTree({ locks: { '.lock': '' } })
    const idle = probeQuietWindow(fakeIO(tree), NOW, {
      listProcesses: () => [],
      pidAlive: () => false,
      exemptions: exTable([
        {
          kind: 'lock',
          identity: 'lock=.lock',
          why: 'uv 工具链的空占位锁:永不写 pid、也不是依赖清单,结构上永远判不出「占用」的真假',
          reviewBy: '2027-02-10',
          maxRows: 1,
        },
      ]),
    })
    const raw = probeQuietWindow(fakeIO(tree), NOW, IDLE)
    return idle.state === 'window' && idle.facts.activeUse.facts.exemptions.locks.length === 1 && raw.state === 'pending'
  })())
  // 结构性限制台账(2026-11-04):只登记「结构上判不了的归属」,不抑制红;坏账/过期反而回红。
  const knownTable = (entries) =>
    loadDevenvMigrateKnownLimits({ readFile: () => JSON.stringify({ entries }), now: NOW })
  const KNOWN_ONE = {
    id: 'scan-span-vs-patrol-cadence',
    subject: '续扫环跨 vs 巡检周期',
    reason: '单片预算 × 自动巡检周期使整环跨度超过静默阈值,自动臂只能靠人工连续跑压进阈值',
    owner: 'DevEnv 搬迁判据维护席(值守会话,非机主)',
    reviewBy: '2027-02-10',
  }
  push('结构性限制①:合法登记只报归属与复核期,不抑制红(window 照判)', (() => {
    const kl = knownTable([KNOWN_ONE])
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, { ...IDLE, knownLimits: kl })
    const notes = activityNotes(r.facts)
    return (
      r.state === 'window' &&
      kl.kind === 'ok' &&
      kl.entries.length === 1 &&
      /结构性限制登记 1 条/.test(notes[3]) &&
      /reviewBy=2027-02-10/.test(notes[3])
    )
  })())
  push('结构性限制②:缺件/短 reason ⇒ 条目不生效且 probe 点名回红(登记 ≠ 已解决)', (() => {
    const kl = knownTable([{ ...KNOWN_ONE, owner: '' }, { ...KNOWN_ONE, id: 'short', reason: '太短' }])
    const r = probeQuietWindow(fakeIO(probeTree()), NOW, { ...IDLE, knownLimits: kl })
    return (
      kl.entries.length === 0 &&
      kl.rejected.length === 2 &&
      r.state === 'undetermined' &&
      r.unjudged.some((s) => s.includes('结构性限制台账:非法条目'))
    )
  })())
  push('结构性限制③:reviewBy 过期 ⇒ 点名复核回红;坏 JSON ⇒ kind=invalid 进 unjudged', (() => {
    const expired = knownTable([{ ...KNOWN_ONE, reviewBy: '2026-12-01' }])
    const re = probeQuietWindow(fakeIO(probeTree()), NOW, { ...IDLE, knownLimits: expired })
    const broken = loadDevenvMigrateKnownLimits({ readFile: () => '{oops', now: NOW })
    const rb = probeQuietWindow(fakeIO(probeTree()), NOW, { ...IDLE, knownLimits: broken })
    return (
      expired.entries[0].expired === true &&
      re.state === 'undetermined' &&
      re.unjudged.some((s) => /须复核/.test(s)) &&
      broken.kind === 'invalid' &&
      rb.state === 'undetermined' &&
      rb.unjudged.some((s) => s.includes('结构性限制台账'))
    )
  })())
  // 分级降噪:截断(未判定子项)遇到可判定否定(活进程)⇒ 结论钉 pending,未判定子项逐条单列。
  const truncatedIO = (tree) => {
    const io2 = fakeIO(tree)
    io2.readdirSync = () => Array.from({ length: ENUM_BUDGET + 1 }, (_, i) => `x${i}`)
    io2.lstatSync = () => ({ isSymbolicLink: () => false, isDirectory: () => false, mtimeMs: NOW - 90 * MIN })
    return io2
  }
  push('probe:判①截断 + 活进程 ⇒ pending(可判定降级),未判定子项仍在 unjudged', (() => {
    const r = probeQuietWindow(truncatedIO(probeTree()), NOW, {
      listProcesses: () => [{ pid: 4242, cmdline: `node "${join(LEGACY_ROOT, 'Temp', 'job.mjs')}"`, exePath: '' }],
      pidAlive: () => false,
    })
    return r.state === 'pending' && r.unjudged.some((s) => s.includes('枚举超过预算'))
  })())
  push('probe:判①截断 + 无任何占用 ⇒ undetermined 仍保留(fail-closed,截断不读成静默)', (() => {
    const r = probeQuietWindow(truncatedIO(probeTree()), NOW, IDLE)
    return r.state === 'undetermined' && r.unjudged.some((s) => s.includes('枚举超过预算'))
  })())
  push('probe:预算不足 ⇒ 本轮 undetermined;续扫满环 + 复用在环 ⇒ 下一轮才判 window', (() => {
    const io2 = fakeIO(probeTree({ locks: { 'a.lock': '42', 'b.lock': '43' } }))
    const mem = {}
    const memStore = {
      path: 'mem://scan',
      load: (n) => ({ kind: mem[n] ? 'ok' : 'absent', state: mem[n] || null, why: undefined }),
      save: (n, s) => {
        mem[n] = JSON.parse(JSON.stringify(s))
        return true
      },
    }
    const activity = { listProcesses: () => [], pidAlive: () => false, lockScan: { entryBudget: 2 } }
    const r1 = probeQuietWindow(io2, NOW, { ...activity, scanStore: memStore })
    const r2 = probeQuietWindow(io2, NOW, { ...activity, scanStore: memStore })
    const lp = r2.facts.activeUse.facts.locks.progress
    const notes = activityNotes(r2.facts)
    return (
      r1.state === 'undetermined' &&
      r1.facts.legacyRoot.reused === false &&
      r2.state === 'window' &&
      r2.facts.legacyRoot.reused === true &&
      lp.scannedInCycle === 3 &&
      lp.rounds === 2 &&
      lp.finished === true &&
      notes.some((s) => s.startsWith('判① 旧根树面') && /复用在环/.test(s)) &&
      !notes.some((s) => s.startsWith('判② 活进程面') && /复用在环/.test(s))
    )
  })())
  push('probe:守护留痕过期(40 分钟)⇒ undetermined(不是 window 也不是 pending)', (() => {
    return probeQuietWindow(fakeIO(probeTree({ guardianAgeMin: 40 })), NOW, IDLE).state === 'undetermined'
  })())
  push('activityNotes:四面自述齐(活进程/旧根锁/未覆盖面/信息面)', (() => {
    const notes = activityNotes(probeQuietWindow(fakeIO(probeTree()), NOW, IDLE).facts)
    return (
      notes.length === 4 &&
      notes[0].includes('活进程面') &&
      notes[1].includes('旧根锁面') &&
      notes[2].includes('未覆盖面') &&
      notes[3].includes('信息面')
    )
  })())
  push('withinRoot/commandMentionsRoot:按路径段边界,不误伤 D:\\DevEnv', (() => {
    return (
      withinRoot('G:\\DevEnv\\Temp\\x', 'G:\\DevEnv') &&
      commandMentionsRoot('node "G:/DevEnv/Temp/x.mjs"', 'G:\\DevEnv') &&
      !withinRoot('D:\\DevEnv\\Temp', 'G:\\DevEnv') &&
      !commandMentionsRoot('node D:\\DevEnv\\x.mjs', 'G:\\DevEnv') &&
      !commandMentionsRoot('node G:\\DevEnv2\\x.mjs', 'G:\\DevEnv')
    )
  })())

  // ── assessSteps(构造面文本注入 + 真实清单存在性)──
  const fakeWith = (over) => fakeIO({ [GITIGNORE]: { text: '.DevEnv/' }, [SEAL_SCRIPT]: { text: '[inRepo]' }, ...over })
  push('assessSteps S4:.gitignore 有 .DevEnv/ ⇒ done 带行号', (() => {
    const s = assessSteps(fakeWith({ [GITIGNORE]: { text: 'node_modules/\n.DevEnv/\n' } })).find((x) => x.id === 4)
    return s.state === 'done' && /:2 = \.DevEnv\//.test(s.evidence)
  })())
  push('assessSteps S4:无条目 ⇒ todo', assessSteps(fakeWith({ [GITIGNORE]: { text: 'node_modules/\n' } })).find((x) => x.id === 4).state === 'todo')
  push('assessSteps S6:devEnvTargetRoots 双根在役 ⇒ todo', assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: '[inRepo, legacy]' } })).find((x) => x.id === 6).state === 'todo')
  push('assessSteps S6:单根 ⇒ done', assessSteps(fakeWith()).find((x) => x.id === 6).state === 'done')
  push('assessSteps S3:活代码命中(非注释行)⇒ todo;纯注释命中 ⇒ done 且计数如实', (() => {
    const a = assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: "const a = 'G:/DevEnv/secrets'\n" } })).find((x) => x.id === 3)
    const b = assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: '// G:\\DevEnv 历史叙述\n' } })).find((x) => x.id === 3)
    return a.state === 'todo' && /活代码 1/.test(a.evidence) && b.state === 'done' && /注释 1/.test(b.evidence)
  })())
  push('assessSteps:六步齐(1..6)且 S5 恒 apply-gate', (() => {
    const s = assessSteps(fakeWith())
    return s.length === 6 && s.map((x) => x.id).join(',') === '1,2,3,4,5,6' && s.find((x) => x.id === 5).state === 'apply-gate'
  })())
  push('HARD_CODED_FILES 8 个文件真实存在(清单与磁盘同面)', HARD_CODED_FILES.every((rel) => existsSync(join(ROOT, rel))))

  // ── 零写盘行为锁(默认路径函数在记录型 io 上零写族调用)+ apply 前置闸 ──
  push('默认档(probe+assess+plan)零写盘(行为锁:记录型 io 零 write 族调用)', (() => {
    const io2 = fakeIO(probeTree())
    const r1 = probeQuietWindow(io2, NOW, IDLE)
    const r2 = assessSteps(io2)
    planSteps(r2, r1)
    return io2.writes.length === 0
  })())
  push('apply 前置闸:pending/undetermined ⇒ refused 且零写调用', (() => {
    const io2 = fakeIO(probeTree())
    const r1 = applyMigration(io2, { state: 'pending', reasons: ['x'] })
    const r2 = applyMigration(io2, { state: 'undetermined', reasons: ['y'] })
    return r1.refused && r2.refused && io2.writes.length === 0
  })())

  // ── 按需加密(2026-11-04):只动本臂相位,环开则密、环合则回、触顶则封 ──
  const memScanStore = (states) => ({
    path: 'mem://scan',
    load: (n) => ({ kind: states[n] ? 'ok' : 'absent', state: states[n] || null, why: undefined }),
    save: () => true,
  })
  const scanState = (over = {}) => ({
    v: SCAN_STATE_VERSION,
    key: 'legacyTree',
    root: LEGACY_ROOT,
    maxDepth: SCAN_DEPTH_UNBOUNDED,
    cycleStartedAt: NOW - 5 * MIN,
    updatedAt: NOW,
    rounds: 3,
    scannedTotal: 600000,
    stack: [{ d: LEGACY_ROOT, i: 1, dep: 1 }],
    acc: {},
    lastComplete: { entries: 2498828, rounds: 13, at: NOW - 60 * MIN },
    ...over,
  })
  const emptyDense = { v: 1, denseStartedAt: null, cycleSignature: null, suppressedFor: null }
  push('scancycle:环打开 ⇒ 加密 4 分钟/轮(13 轮 + 末轮 ≤ 60 分钟,且可观测五项齐)', (() => {
    const facts = scanCycleFacts(memScanStore({ legacyTree: scanState() }), NOW)
    const d = armCadenceDecision({ now: NOW, tickMs: NOW - 5 * MIN, scan: facts, denseState: emptyDense })
    const text = armDensityText({ scan: facts, dense: true, denseStartedAt: d.denseStartedAt, now: NOW })
    return (
      facts.open === true &&
      facts.rounds === 3 &&
      facts.estimatedRoundsRemaining === 10 &&
      d.dense === true &&
      d.intervalMs === DENSE_PATROL_INTERVAL_MS &&
      d.due === true &&
      d.event === 'enter-dense' &&
      d.nextState.denseStartedAt === NOW &&
      (DENSE_PATROL_INTERVAL_MS / MIN) * 13 + 1.5 <= SCAN_CYCLE_MAX_SPAN_MINUTES &&
      /加密中/.test(text) &&
      /依据/.test(text) &&
      /环内已扫 3 轮/.test(text) &&
      /预计还需约 10 轮/.test(text) &&
      /最迟回落/.test(text)
    )
  })())
  push('scancycle:环闭合(栈空) ⇒ 立刻回落原 30 分钟节拍并清加密态', (() => {
    const facts = scanCycleFacts(memScanStore({ legacyTree: scanState({ stack: [] }) }), NOW)
    const d = armCadenceDecision({
      now: NOW,
      tickMs: NOW - 3 * MIN,
      scan: facts,
      denseState: { ...emptyDense, denseStartedAt: NOW - 10 * MIN, cycleSignature: 'legacyTree@x' },
    })
    return (
      facts.open === false &&
      d.dense === false &&
      d.intervalMs === PATROL_INTERVAL_MS &&
      d.due === false &&
      d.event === 'exit-closed' &&
      d.nextState.denseStartedAt === null &&
      d.persist === true
    )
  })())
  push('scancycle:连续加密超 2 小时 ⇒ 回落 + 报警 + 本环封禁(再跑也不加密)', (() => {
    const facts = scanCycleFacts(memScanStore({ legacyTree: scanState() }), NOW)
    const d = armCadenceDecision({
      now: NOW,
      tickMs: NOW - 3 * MIN,
      scan: facts,
      denseState: { ...emptyDense, denseStartedAt: NOW - 130 * MIN, cycleSignature: facts.signature },
    })
    const again = armCadenceDecision({
      now: NOW + 30 * MIN,
      tickMs: NOW - 3 * MIN,
      scan: facts,
      denseState: d.nextState,
    })
    return (
      d.dense === false &&
      d.intervalMs === PATROL_INTERVAL_MS &&
      d.event === 'exit-cap' &&
      /回落/.test(d.alarm || '') &&
      /封禁本环/.test(d.alarm || '') &&
      d.nextState.suppressedFor === facts.signature &&
      again.dense === false &&
      again.event === 'none' &&
      /已触达加密上限/.test(again.reason)
    )
  })())
  push('scancycle:环未打开 ⇒ 原节拍不受影响(无游标/游标身份对不上都不加密)', (() => {
    const none = scanCycleFacts(memScanStore({}), NOW)
    const stale = scanCycleFacts(memScanStore({ legacyTree: scanState({ root: join(DRIVE_ROOT, 'Other') }) }), NOW)
    const d20 = armCadenceDecision({ now: NOW, tickMs: NOW - 20 * MIN, scan: none, denseState: emptyDense })
    const d31 = armCadenceDecision({ now: NOW, tickMs: NOW - 31 * MIN, scan: none, denseState: emptyDense })
    return (
      none.open === false &&
      stale.open === false &&
      !d20.dense &&
      !d20.due &&
      d31.due === true &&
      d20.intervalMs === PATROL_INTERVAL_MS &&
      d31.intervalMs === PATROL_INTERVAL_MS
    )
  })())
  push('scancycle:加密期其它门不被饿死(4 分钟 = 每两 tick 跑一次,奇数 tick 全留给其它门)', (() => {
    const files = {}
    const store = memScanStore({ legacyTree: scanState() })
    const io2 = fakeIO(probeTree())
    const results = []
    for (const t of [0, 2, 4, 6]) {
      results.push(
        devenvMigratePatrol({
          now: NOW + t * MIN,
          tickFile: 'mem://tick',
          denseFile: 'mem://dense',
          scanStore: store,
          io: io2,
          logger: () => {},
          probeFn: () => ({ state: 'pending', reasons: [], unjudged: [] }),
          readFile: (p) => {
            if (p in files) return files[p]
            const e = new Error('ENOENT')
            e.code = 'ENOENT'
            throw e
          },
          mkdir: () => {},
          writeTick: (p, text) => {
            files[p] = text
          },
          writeDense: (p, text) => {
            files[p] = text
          },
        }),
      )
    }
    const ran = results.map((r) => r.ran)
    return (
      DENSE_PATROL_INTERVAL_MS >= 2 * GUARDIAN_TICK_MS &&
      ran.join(',') === 'true,false,true,false' &&
      results.filter((r) => !r.ran).every((r) => r.dense === true) &&
      results.every((r) => r.cadence.intervalMs === DENSE_PATROL_INTERVAL_MS)
    )
  })())


  // ── 形状锁(§22c 先例:re-home 装车锁)──
  const SRC = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  push('形状锁:io 写族调用只许出现在 applyMigration 起至 selfTest 前的区间(默认档零写盘的静态半边)', (() => {
    const applyStart = SRC.indexOf('export function applyMigration')
    const selfStart = SRC.indexOf('function selfTest')
    if (applyStart < 0 || selfStart < 0 || selfStart < applyStart) return false
    const writeCall = /io\.(writeFileSync|mkdirSync|renameSync|rmSync)\(/
    return !writeCall.test(SRC.slice(0, applyStart)) && !writeCall.test(SRC.slice(selfStart))
  })())
  push('形状锁:isDirectRun 双形态在位(§22d 模板)', /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/.test(SRC) && SRC.includes('main().catch'))
  push('形状锁:--apply 顺序 1→6 编码在位(步骤号逐字出现且递增)', (() => {
    const body = SRC.slice(SRC.indexOf('export function applyMigration'), SRC.indexOf('function safeReaddir'))
    const at = [1, 2, 3, 4, 5, 6].map((n) => body.indexOf(`step: ${n},`))
    return at.every((v) => v > 0) && at.every((v, i) => i === 0 || v > at[i - 1])
  })())
  push('形状锁:受控替换必经水印三段(clean 先于写回先于 inject,§5c)', (() => {
    const body = SRC.slice(SRC.indexOf('function controlledEdit'), SRC.indexOf('function ensureGitignoreEntry'))
    const atClean = body.indexOf("wm('clean')")
    // 字面量拆写:本锁的检索串不得在源码中构成完整的「io 点写族调用」子串,
    // 否则上面的「写族区间锁」会被本锁自己的检索串误触发(2026-10-25 实测,连注释也不豁免)。
    const atWrite = body.indexOf('io.write' + 'FileSync(filePath, next')
    const atInj = body.indexOf("wm('inject')")
    return atClean > 0 && atWrite > atClean && atInj > atWrite
  })())

  const { fail, cases } = report()
  for (const c of cases) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— ${c.got}`}`)
  console.log(`\n${fail ? `❌ ${fail} 例失败` : `全部 ${cases.length} 例通过`}`)
  process.exit(fail ? 1 : 0)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const apply = argv.includes('--apply')
  const probeOnly = argv.includes('--probe')
  const io = defaultIO()
  // 续扫游标:只有 main 显式接 store 才落盘(probeQuietWindow 自身仍可零写盘)。
  const scanStore = createScanStateStore({ io })
  const startedAt = Date.now()
  const probe = probeQuietWindow(io, startedAt, { scanStore })
  console.log(`[G-50 devenv-migrate] 旧根 ${LEGACY_ROOT} → 新根 ${NEW_ROOT}`)
  console.log(`静默窗口:${probe.state}`)
  for (const r of probe.reasons) console.log(`  · ${r}`)
  for (const u of probe.unjudged || []) console.log(`  ⚠ 未判定子项:${u}`)
  for (const n of activityNotes(probe.facts)) console.log(`  ℹ ${n}`)
  // 只读面:自动臂加密态(与巡检臂同一判据 scanCycleFacts + 同一账本,零复算)。
  const scan = scanCycleFacts(scanStore)
  const denseState = readArmDenseState({ readFile: (p) => io.readFileSync(p, 'utf8') })
  const activeDense = Boolean(scan.open) && Number.isFinite(denseState.denseStartedAt) && denseState.cycleSignature === scan.signature
  const suppressed = Boolean(scan.open) && denseState.suppressedFor === scan.signature
  const denseText = activeDense
    ? armDensityText({ scan, dense: true, denseStartedAt: denseState.denseStartedAt, now: startedAt })
    : armDensityText({
        scan,
        dense: false,
        reason: suppressed
          ? `本环已触达加密上限 ⇒ 不再加密(${scan.signature})`
          : scan.open
            ? `环未闭合 ⇒ 下一轮起按 ${Math.round(DENSE_PATROL_INTERVAL_MS / 60000)} 分钟/轮加密(本刻尚未开始)`
            : scan.why,
      })
  console.log(`  ℹ ${denseText}`)
  if (probeOnly) process.exit(probe.state === 'window' ? 0 : probe.state === 'pending' ? 1 : 2)
  const assessed = assessSteps(io)
  console.log('\n票面六步盘点(现读):')
  for (const s of assessed) console.log(`  步骤${s.id} [${s.state}] ${s.title}\n          ${s.evidence}`)
  console.log('\n预演:')
  for (const l of planSteps(assessed, probe)) console.log(`  ${l}`)
  if (!apply) {
    console.log('\n默认档零写盘。要执行:node scripts/devenv-migrate.mjs --apply(仅 window 态放行)')
    process.exit(probe.state === 'window' ? 0 : probe.state === 'pending' ? 1 : 2)
  }
  const r = applyMigration(io, probe)
  if (r.refused) {
    console.error(`❌ --apply 被拒绝:${r.reason}`)
    process.exit(3)
  }
  let bad = 0
  console.log('\n--apply 执行流水:')
  for (const row of r.rows) {
    if (!row.ok) bad++
    console.log(`  ${row.ok ? '·' : '❌'} [步骤${row.step}] ${row.note}`)
  }
  console.log(r.verified ? '\n回读验证通过' : '\n回读验证不过,交人工裁决(未回滚不可逆步)')
  process.exit(bad || !r.verified ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  latestWrite,
  guardianTickAlive,
  probeQuietWindow,
  assessSteps,
  planSteps,
  applyMigration,
  defaultIO,
  // 判② 活使用面(2026-10-29 改口径):镜像测试直接取生产判据,零复制(§22c)。
  withinRoot,
  commandMentionsRoot,
  parseProcessTable,
  defaultProcessTable,
  pidFromLockText,
  defaultPidAlive,
  scanLegacyLocks,
  legacyActiveUse,
  activityNotes,
  // 显式登记面(2026-11-04):镜像测试直接取生产判据,零复制(§22c)。
  loadDevenvMigrateExemptions,
  // 巡检派发臂(2026-10-28):镜像测试直接取生产判据,零复制(§22c)。
  devenvArmDue,
  loadDevenvMigrateArm,
  devenvMigratePatrol,
  // 按需加密(2026-11-04):环态判据 / 节拍决策 / 可观测文本,同一份生产件。
  scanCycleFacts,
  armCadenceDecision,
  armDensityText,
  readArmDenseState,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
