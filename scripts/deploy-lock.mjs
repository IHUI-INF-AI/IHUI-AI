#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * deploy-lock.mjs — 部署/构建流程全局串行化锁(2026-08-09 立,根治多 agent 并发部署)。
 *
 * 事故背景(8-09 实锤):09:48 另一自动化 Agent 与手动部署并行触发 build-next-prod.ps1,
 * 两个构建同时备份/清理/写入 apps/web/.next → 8801 短暂 502 + 监控报警,且产物存在损坏风险。
 * 根因:原 apps/web/scripts/check-lock.js 只有 dev-vs-build 互斥,没有 build-vs-build;
 * 且 build-next-prod.ps1 引用了不存在的 scripts/check-lock.js,锁从未真正生效。
 *
 * 本锁设计:
 *   - 锁 = 项目根 .deploy.lock 目录(mkdir 原子性,不依赖 cwd/平台)
 *   - **初始化必须"写全再原子可见"(2026-09-29 立,G-814425)**:旧形态是 `mkdir(正式目录)` 紧接
 *     `writeMeta`,两步之间那把**空锁目录**已对外可见 = 本文件四态里的 `absent`,而 absent 的自动
 *     出路是"锁龄超 stale ⇒ 归档并抢占",于是**还在初始化中的活锁**可以被抢走。现由唯一实现
 *     `scripts/lib/lock-atomic-init.mjs`(与 git-lock.mjs 共用同一份)收口:唯一 pending 目录 →
 *     写全 meta → 原子 rename 成正式锁;pending 落点见 `lockPendingRoot()`(不落项目根,免留
 *     白名单外残留)。四态认识论、`--owner-pid` 语义、`HARD_CAP_MS` 硬上限与全部抢占判据**一字未动**。
 *   - 覆盖整个「构建+部署」单元:acquire 成功后持有,直到 release
 *   - build 模式:与其他 build、dev、deploy 全部互斥
 *   - dev 模式:与 build/deploy 互斥(dev+dev 放宽,与旧 check-lock 一致)
 *   - stale 清理:持有者进程已退出(锁龄不限)即视为悬挂锁,立即强制抢占
 *     (2026-08-27 收紧:原"锁龄>staleMs 才抢占"在强杀 dev 后立即重启时
 *     死循环轮询 600s,已改为持有者死即抢占,消除启动卡死窗口)
 *   - 超时:acquire 等待 timeoutMs(默认 600s)后抛错退出(不覆盖不打断进行中的部署)
 *
 * 进程身份三元组(2026-09-27 接,机制在 scripts/lib/proc-identity.mjs):
 *   meta 除 pid/ownerPid/ts 外再记 `host` + `pidStart`(= **判活所问那个 pid** 的启动时刻)。
 *   三态里**只有 `mismatch` 多给一条抢占授权**(确证 pid 已被复用 ⇒ 不必等 30min 硬上限);
 *   `unverifiable`(旧 meta 没记 / 量不到启动时间 / 别机持有 / PowerShell 不可达 / 权限不足)
 *   一律**维持改动前行为** —— 抢错的代价是两次构建同时写 `.next`(8-09 那记 502),
 *   少抢的代价只是多等一轮。现测只在"原判据要我等"那一格发生、每次 acquire 至多一次;
 *   ⚠️ 2026-09-28 补一环:**没声明 owner 时不再拿"本次 CLI 自己"当判活主体** —— CLI 打印
 *   "锁已获取"就退 ⇒ 每把锁一落地就等价于"持有者已退出",而本工具的规则是悬挂死锁**不限锁龄立即
 *   抢占**,现象正是"别人正在跑构建,第二条构建秒抢"(当轮现读 `ownerPid=0`)。现改为记
 *   **派生本次调用的父进程**,并在 meta 里打 `ownerPidSource:'inferred-ppid'` 标明它**不是确证**;
 *   两处边界如实登记:`predev` 那条脚本与 dev server 生死无关(仍欠心跳,AGENTS 已记该格),
 *   交互终端手工 acquire 后另起构建则父终端长活 ⇒ 由既有 `--stale` 年龄线收口,**不为此放宽判据**。
 *   `check` 与 `release` **不**现测(只读快路径 / 删锁永远是持有者的动作)。
 *   既有的 30min 硬上限(`--owner-pid` + HARD_CAP_MS)**保留不动**,它现在是第二道兜底
 *   而不是唯一出路:有身份凭据时确证得更早,没凭据时仍按原兜底逃生。
 *
 * 单调量第二判据(2026-09-28 立,G-412;deploy-lock 的"锁龄恒 0"与"锁永远新"都不许没出路):
 *   `age = max(0, now - ts)` 只解决"算出负数"这一半。未来 ts 若只被 clamp 成 0 ⇒ 硬上限
 *   `age > HARD_CAP` 永不触发 ⇒ 叠加"pid 名义存活"就是 2026-09-25 冻结生产 11h50m 的那组条件
 *   (G-193),而"永远新"只是把无限等待换了个形态。现补一条**墙钟之外**的对账:
 *   `writeMeta` 落 `bootMs = now - os.uptime()*1000`(单调钟反推的开机时刻,不受墙钟步进影响);
 *   读取侧 `monotonicAgeVerdict` 三态 —— `contradiction/future-ts`(ts 超容差地在未来,且按单调
 *   推算落在本机当前开机会话内 ⇒ 墙钟在写入后被回拨,**"ts 不可信(未来 N 秒)"必须点名**),
 *   `contradiction/session-ended`(现推开机时刻晚于 meta 记录的锚点超容差 ⇒ 写入后本机重启过
 *   或墙钟被大幅前移 ⇒ 记录的持有者不可能还活过这次开机 —— 这一型墙钟读数完全正常,旧判据只会
 *   一路 wait),`consistent` / `unverifiable`(别机持有 / 旧 meta 无 host / uptime 量不到 ⇒
 *   **维持改动前行为并报名**,不据此抢,也不静默记成"已核过")。
 *   出路(全部先归档现场、二次确认,人工出口 `break-stale --reason "<理由>"`):
 *   contradiction 两支都落在 `steal + immediate:false`(= 与硬上限同档,等效"等待上限已到"),
 *   绝不静默恒等、绝不无限 wait。代价如实登记:墙钟被**前移**超过容差(而非重启)时
 *   session-ended 会误抢一把活锁 —— 那种钟本身已不可信,且现场有档;反向的选择才是已付过
 *   11h50m 学费的那一型。`check` 只读快路径**不派生 PowerShell**(S48 纪律不变),但会现读
 *   `os.uptime()`(进程内调用)把同一结论打印出来。
 *
 * 不可判定三态的时钟倒挂独立档(2026-10-02 立,G-386;孪生登记同号题面亦见 G-779;G-412 未覆盖的那一半):
 *   G-412 治的是 **ok 态** 的未来 ts;本票点名的那个谓词形状 `age > staleMs` 恰好只剩住在**不可判定**分支 ——
 *   该面的锁龄降级取**锁目录 mtime**(见 lockAgeMs 注释),mtime 超容差落在未来时 `ageMs` 钳成 0 ⇒
 *   `0 > staleMs` 恒假 ⇒ 这一格无限 wait 到超时,而文案还写着"唯一自动出路是超 stale"(该形态下是假的,
 *   与 A9-3 登记的旧撒谎同型)。现补第三条独立档(不与"活着/已退出/不可判定即等待"并桶):
 *   `clockAnomalous ⇒ steal + immediate:false` —— 与 ok 面/硬上限同形,**先归档现场再抢**,绝不变秒抢;
 *   容差内(默认 5 分钟)的未来 mtime 仍按读数正常处理(NTP 微步进不得读成倒挂);单调对账在这一面
 *   **无锚点**(不可判定 ⇒ 拿不到 ts/host/bootMs),结论里如实写"无锚点",不硬凑、也不因此回落成无限等。
 *   失效方向照 §5b/G-193 那条规矩:宁可抢一把判不出年龄的锁并先归档现场,不可把"没人能说清"变成
 *   "部署环一直不更新"。真实时钟倒挂事件未在本机复现,该档由构造面(`utimesSync` 造未来 mtime +
 *   注入固定 now)成对证明,不自称"实测抓到过"。
 *
 * 锁的状态认识论(2026-09-26 立,第九轮 ZCode 吸收 A9-3):
 *   `readMeta()` 返回**穷尽四态**,因为"读不到"与"确实没有"是两件不同的事,
 *   把它们混成一态(null)会产出本仓最贵的一类故障——**判不出来就当没人持锁**:
 *     - `absent`     锁目录存在而 meta.json 不存在(acquire 的两步窗口 / 持有者崩于其间)
 *     - `ok`         元数据完好且 pid 可用 ⇒ 只有这一态能判"持有者死/活"
 *     - `invalid`    读到了内容但内容不可用(空文件 / 半个 JSON / 顶层不是对象 / 没有 pid)
 *     - `unreadable` 文件在而读不出内容(EISDIR / EACCES / 并发半写入被占用)
 *   旧实现把这四态全折叠成 `null` ⇒ acquire 的抢占分支要求 `meta &&`,于是
 *   "持有者早已死、但 meta.json 坏了"的锁**永不被抢占**,所有后续构建/部署死等
 *   600s 后抛错,而报错文案还写着"超 stale 时间会自动抢占"(该形态下是假的);
 *   release 一侧的两个 `meta &&` 守卫同时短路 ⇒ **坏锁 = 白拿**,直接删掉别人正在用的锁。
 *   现口径:
 *     1. 不可判定三态**绝不等价于"无人持锁"**,不得凭猜测删锁;
 *     2. 但也不得傻等到超时不给出路 —— 自动出路现为两档(G-386 起):① **锁龄超 stale 阈值**才抢占;
 *        ② 年龄读数被时钟倒挂钉死(`0 > staleMs` 恒假)时走**时钟倒挂档**,与硬上限同档先归档再抢。
 *        两档抢占前都必须把现场**原样归档**(不得静默覆盖);
 *     3. 超时报错文案必须与实际判据一致,不同形态给不同出路;
 *     4. `check` 如实打印"无法判定 + 原因",禁止打印成空字段
 *        (读报告的人会把"读不出"当成"没进程持锁")。
 *
 * 用法(CLI):
 *   node scripts/deploy-lock.mjs acquire [--mode <build|dev>] [--timeout <ms>] [--stale <ms>] [--owner-pid <pid>] [--token <t>]
 *   node scripts/deploy-lock.mjs release [--mode <build|dev>] [--token <t>]
 *   (G-696:meta 自 2026-09-29 起带 owner token —— release 必须凭同一凭据才许释放;
 *    acquire 缺省现生成并打印 token,同进程 API 调用由进程内备忘自动携带。)
 *   node scripts/deploy-lock.mjs check            # 只读:exit 0=无锁 1=有锁(打印持锁信息)
 *   node scripts/deploy-lock.mjs break-stale --reason "<人工确认的理由>"   # G-412 人工出口:先归档再断
 *   node scripts/deploy-lock.mjs --self-test      # 临时夹具内自检,绝不触碰真实 .deploy.lock
 *   通用选项:--lock-dir <path>(默认项目根 .deploy.lock;测试/夹具专用)
 *
 * 集成点:
 *   - scripts/build-next-prod.ps1:构建开始 acquire(build),结束 release
 *   - apps/web 的 dev 启动脚本:启动前 acquire(dev),退出 release
 */
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
  copyFileSync,
  // G-386:自检/夹具用它**造一个未来 mtime 的锁目录**(构造面取证,绝不真改系统时钟)。
  utimesSync,
} from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { hostname, uptime } from 'node:os'
// G-696(2026-09-29):owner token 的生成源。释放侧归属核验的凭据必须不可预测,
// 否则"第二条 CLI 按猜就能删掉第一条正在用的锁"只是换了个更便宜的门。
import { randomBytes } from 'node:crypto'
// 抢占算法的唯一实现(2026-09-26 合并:本脚本与 git-lock.mjs 曾各写一份 claimStaleLock)。
import { claimStaleLockCore } from './lib/stale-lock-claim.mjs'
// 锁目录「写全再原子可见」初始化的唯一实现(2026-09-29 立,G-814425)—— 与 git-lock.mjs 共用同一份。
// 本文件的病灶比 git 侧更直观:创建走 `mkdir(正式目录)` + `writeMeta` 两步,而**第一步之后
// 锁目录就已经对外可见而里面什么都没有**,这恰好是本文件四态里的 `absent`,而 absent 态的
// 自动出路写着"锁龄超 stale 阈值 ⇒ 归档并抢占" —— 于是"还在写 meta 的活锁"是可以被抢走的。
import { createLockDirectoryAtomically } from './lib/lock-atomic-init.mjs'
// meta.json 的**原子替换**唯一出口(2026-09-29 立,G-653):裸 writeFileSync 覆盖写一个已存在的
// 文件是"truncate → 再写"两步,而 check / 心跳判活 / 计划任务随时落在那两步之间 ⇒ 读到半截 JSON。
// 本文件对"读不懂 meta / 读不到 meta"的既有处置恰好是"absent/invalid ⇒ 龄超 stale 即归档抢占",
// 于是**一个活着的持锁者会被读成"已退出"并抢走锁**(§5b/§12d 记过:判活判错 ⇒ 并发写坏 .git)。
// ⚠️ 只换"怎么写",meta 的**内容与后写覆盖前写**的语义一字未动(那套出口若带读后写校验就会改语义)。
import { atomicWriteFileSync } from './lib/atomic-write.mjs'
// 进程身份三元组(pid + pidStart + host)。裸 pid 判活是无效的:
// 2026-09-25 实测 meta.pid=888 当时被 nssm.exe 占着(StartTime 比锁晚 160s)⇒ "活着"恒真
// ⇒ 部署环每轮白等 600s,冻结 11h50m(登记 G-193)。
import { processStartEpoch, verifyHolder } from './lib/proc-identity.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 2026-10-02(补齐部署锁机制票):acquire --with-heartbeat 与 run 子命令都要**派生进程**
// (常驻心跳 + 被包装的真命令)。§5b/守门 52:凡派生控制台程序必带 windowsHide,否则用户桌面反复弹黑窗。
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const POLL_MS = 500
/**
 * 本脚本自己的路径 —— 心跳必须以**独立进程**起(它是一个常驻循环,不能跑在调用方进程里),
 * 派生时只能引用"我自己",不得写死 `scripts/deploy-lock.mjs` 再靠 cwd 拼(那正是守门 70 记过的
 * "扫哪棵树由调用者站哪决定"那一型)。
 */
const SELF_SCRIPT = fileURLToPath(import.meta.url)
/**
 * 被信号终止时的退出码口径(2026-10-02 run 子命令)。`shell.get('close')` 在信号终止时给
 * `code === null` —— 若把它当成 0,一次被 SIGKILL 的构建会在账面报"成功",而 run 的调用方
 * (npm 生命周期 / CI)正是靠这个码判断构建是否落地。取 128+N 与 sh/cmd 的惯例一致
 * (与 scripts/dev-with-warmup.mjs 的 quit(130)/quit(143) 同一条口径)。
 */
const SIGNAL_EXIT_CODE = { SIGHUP: 1, SIGINT: 2, SIGKILL: 9, SIGTERM: 15 }
/**
 * "持有者名义存活"却把锁握过这个时长 ⇒ 只有一种解释:**pid 被复用了**。
 * 取 30 分钟:一次「构建 + 部署」单元实测约 4-10 分钟,30 分钟已是 3 倍余量;
 * 与 `scripts/git-lock.mjs` 的 1800s 硬上限同一条设计(AGENTS §12 ③)。
 * 换机/极端慢机构可用 `IHUI_DEPLOY_LOCK_HARD_CAP_MS` 放宽,但放宽到多大都该先看日志实测时长。
 */
const HARD_CAP_MS = (() => {
  const v = Number(process.env.IHUI_DEPLOY_LOCK_HARD_CAP_MS)
  return Number.isFinite(v) && v > 0 ? v : 1_800_000
})()

/**
 * "时间戳落在多远的未来"才算时钟异常,而不是当成正常读数。
 * 取 5 分钟:跨机持锁时两侧时钟差通常是秒级(NTP),超过 5 分钟不可能是"刚刚建的锁";
 * 而把它夹成 `ageMs=0` 会让硬上限永不触发 —— 那正是把"量不到"写成"没问题"。
 */
const FUTURE_TS_TOLERANCE_MS = 5 * 60_000

/** 锁目录(默认路径:项目根 .deploy.lock,不随 cwd 变化) */
function lockDir() {
  return join(repoRoot, '.deploy.lock')
}

function metaFile(dir) {
  return join(dir, 'meta.json')
}

/**
 * 把 meta.json 的**原始字节**归一为四态判据(纯函数,不碰文件系统,便于镜像测试直接喂夹具)。
 *
 * 为什么 `absent` 与 `invalid` 处置不同:
 *   - `absent`(文件确实不存在)是一个**确定的否定事实**——这个锁从来没写下过元数据。
 *     它仍不等于"无人持锁"(mkdir 与 writeMeta 之间有两步窗口,持有者可能是活的),
 *     所以 acquire 也**不会**凭它立刻删锁;但它的出路是"等 meta 出现或锁龄超 stale"。
 *   - `invalid`/`unreadable` 是一个**未知的判断**——内容在,而我们读不懂/读不到。
 *     此时锁很可能正被活人持有(写坏通常来自崩溃或并发半写),
 *     所以两者的共同底线是:**既不按"无人持锁"抢占,也不傻等到超时不给出路**;
 *     唯一自动出路是"锁龄超 stale 阈值 ⇒ 归档现场后抢占"。
 * 把三态混成"没有元数据"就是旧实现的全部病灶。
 *
 * @param {string|null|undefined} rawText 文件内容文本;传 null 表示"文件不存在"(absent)
 * @returns {{kind:'absent',reason:string}
 *          | {{kind:'ok'},meta:{mode:string,pid:number,ownerPid:number,ts:number,host:string,pidStart:number,bootMs:number,token:string}}
 *          | {kind:'invalid'|'unreadable',raw:string|null,reason:string}}
 */
function classifyMeta(rawText) {
  if (rawText === null || rawText === undefined) {
    return {
      kind: 'absent',
      reason: 'meta.json 不存在(锁从未写下元数据,或持有者崩于 mkdir 与写 meta 之间)',
    }
  }
  if (rawText.trim() === '') {
    return { kind: 'invalid', raw: rawText, reason: 'meta.json 是空文件(0 字节/全空白)' }
  }
  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch (e) {
    return { kind: 'invalid', raw: rawText, reason: `meta.json 不是合法 JSON:${e?.message ?? e}` }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'invalid', raw: rawText, reason: 'meta.json 顶层不是对象,拿不到 mode/pid/ts' }
  }
  const pid = Number(parsed.pid)
  if (!Number.isInteger(pid) || pid <= 0) {
    // pid 是唯一能判"持有者死/活"的东西;缺它 ⇒ 无法判定,不得当成"pid 不存在=进程不存在"
    return {
      kind: 'invalid',
      raw: rawText,
      reason: `meta.json 缺少可用 pid(实得 ${JSON.stringify(parsed.pid)}),无法判定持有者是否存活`,
    }
  }
  const ts = Number(parsed.ts)
  const ownerPid = Number(parsed.ownerPid)
  // 身份两元一并归一(2026-09-27 接线):`pidStart=0` / `host=''` 一律表示"旧 meta 没记",
  // 判读侧据此落 unverifiable ⇒ **维持改动前行为**,而不是"没有凭据就可以抢"。
  // 刻意不进 `lockIdentity` 指纹:那一维的作用是"改名瞬间锁有没有被换成另一把",
  // 把凭据字段塞进去只会让"别人补写了身份字段"被误判成换锁,与抢占原子性无关。
  const host = typeof parsed.host === 'string' ? parsed.host : ''
  const pidStartRaw = Number(parsed.pidStart)
  const pidStart = Number.isFinite(pidStartRaw) && pidStartRaw > 0 ? pidStartRaw : 0
  // 单调量锚点(G-412 第二判据):`bootMs` = 写下这份 meta 那一刻由 `os.uptime()` 反推的**开机时刻**。
  // 缺失/非法 ⇒ 0 ⇒ 判读侧落 unverifiable = **维持改动前行为**(与 host/pidStart 同一纪律:
  // "没有凭据"不等于"可以抢",更不等于"已核过没问题")。
  const bootMsRaw = Number(parsed.bootMs)
  const bootMs = Number.isFinite(bootMsRaw) && bootMsRaw > 0 ? bootMsRaw : 0
  // 持锁凭据(G-696,2026-09-29):`token=''` 一律表示"旧 meta 没记"(与 host 同一纪律)。
  // 判读侧(release)据此走旧格式处置并**报名**"归属无法核验",绝不把"没凭据"读成"已核过"。
  // 与 host/pidStart 同一条理由,刻意**不进** `lockIdentity` 指纹:凭据字段进指纹只会让
  // "补写凭据"被误判成换锁,与抢占原子性无关。
  const token = typeof parsed.token === 'string' ? parsed.token : ''
  return {
    kind: 'ok',
    meta: {
      mode: typeof parsed.mode === 'string' ? parsed.mode : '',
      pid,
      // 真正持锁的**那个构建单元**的 pid(见 writeMeta 的说明);没有它就退回 pid。
      ownerPid: Number.isInteger(ownerPid) && ownerPid > 0 ? ownerPid : 0,
      // ts 缺失/非法不致命:活性判据靠 pid,锁龄可降级用目录 mtime(见 lockAgeMs)
      ts: Number.isFinite(ts) && ts > 0 ? ts : 0,
      host,
      pidStart,
      bootMs,
      token,
    },
  }
}

/**
 * 读取锁元数据 ⇒ 四态。
 * 注意 `unreadable` 与 `absent` 的分界:只有 ENOENT(文件确实没有)才算 absent;
 * EISDIR / EACCES / EBUSY 等一律是"读不到内容"= 无法判定,不是"没有内容"。
 */
function readMeta(dir) {
  let raw
  try {
    raw = readFileSync(metaFile(dir), 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return classifyMeta(null)
    return {
      kind: 'unreadable',
      raw: null,
      reason: `meta.json 读取失败:${e?.code ?? e?.message ?? e}`,
    }
  }
  return classifyMeta(raw)
}

/**
 * 写下持锁元数据。
 *
 * ⚠️ `pid` 记的**只是本次 CLI 调用自己**的 pid,而 CLI 打印"锁已获取"就退出了 ——
 * 所以单看 `pid` 判活是无效的:要么恒"已退出"(于是别人正在跑的构建被抢),
 * 要么 pid 被系统复用给别的过程(于是本工具永远等一个"活着"的幽灵;2026-09-25 实测
 * 部署环因此冻结 11h50m,每轮白等 600s)。`ownerPid` 才是这段锁的真正主人:
 * 由调用方(构建脚本自己的 `$PID`)经 `--owner-pid` 或 `IHUI_DEPLOY_LOCK_OWNER_PID` 传入。
 *
 * 2026-09-27 接身份三元组:`pidStart` 记的是**判活所问的那个 pid**(有 owner 就是 owner,
 * 没有才退回 CLI pid)的启动时刻。这里绝不能图省事写成"记自己"——一旦主体错位,
 * 每一次对账都必然 `mismatch`,于是"确证复用"变成"确证可以抢",活人的构建会被打断,
 * 比没有身份凭据更糟。量不到就整键不写(undefined 被 JSON.stringify 丢掉)⇒ 与旧 meta
 * 逐字同形,判读侧走 unverifiable = 维持改动前行为。
 *
 * 2026-09-29(G-653):落盘改走唯一出口 `lib/atomic-write.mjs` 的**原子替换**(同目录 tmp + rename)。
 * 上面两段讲的"键集与旧 meta 逐字同形"仍然成立 —— 换的只是怎么写,写出的字节一字未变。
 *
 * 2026-09-29(G-696):meta 多落一个 `token` —— **持锁凭据**,释放侧归属核验的唯一依据。
 * 调用方给定了(opts.token / `IHUI_DEPLOY_LOCK_TOKEN`)就原样用("若已有则不动"),没给就现生成
 * 16 字节随机 hex:同 acquire 的锁各持各的凭据,release 必须凭同一凭据才许删锁(见 release 头注)。
 */
function writeMeta(dir, mode, opts = {}) {
  const declared = Number(opts.ownerPid ?? process.env.IHUI_DEPLOY_LOCK_OWNER_PID) || 0
  // 没声明 owner 时**不再退回"本次 CLI 自己"** —— CLI 打印"锁已获取"就退出,拿它判活等于
  // 每把锁一落地就是死锁主,于是"持有者已退出的悬挂锁不限锁龄立即抢占"这条规则会在**别人正在
  // 跑的构建**上立刻成立(8-09 那两个构建同时写 .next ⇒ 8801 短暂 502 的那一型)。
  // 改问"派生我这一次的父进程":npm 生命周期(prebuild / predev)是 `<shell> -c "acquire && 真活"`
  // 形态,那条 shell 在整个脚本链结束前都活着 ⇒ 它才是这段锁的持有人。
  // 两个已知边界如实登记:① `predev` 是与 dev server **分离**的一条脚本,父 shell 会先退 ⇒ 这一路
  // 与改动前同样落回"按年龄/stale 判",并没有得到心跳(AGENTS 已登记的那格仍然欠着);
  // ② 人工在交互终端里直接 acquire 再另起构建 ⇒ 父进程是那台终端,活得很久 ⇒ 由既有
  // `--stale`(默认 600s)这条年龄线收口,**不得**为它去放宽任何判据。
  const inferred =
    declared > 0 ? 0 : Number(opts.ppid ?? process.ppid) > 0 ? Number(opts.ppid ?? process.ppid) : 0
  const ownerPid = declared > 0 ? declared : inferred
  const subjectPid = holderPid({ pid: process.pid, ownerPid })
  // 刻意不调 lib 的 `identityFields()` —— 它算的是"我自己"的启动时刻,而本锁的判活主体
  // 可以是 ownerPid(见上)。用错主体的话每次对账都必然 mismatch,那条"确证"就成了
  // "确证可以抢",比没有身份更糟。这里只借 lib 的两个更小的出口:host 与量的动作。
  const started = processStartEpoch(subjectPid, opts.run ? { run: opts.run } : {})
  // G-412 第二判据的**记录侧**:开机时刻由单调时钟(`os.uptime()`,不受墙钟跳变影响)反推。
  // 量不到(理论上不该发生)⇒ 整键不写 ⇒ 与旧 meta 同形,判读侧落 unverifiable、维持原判据。
  const nowMs = opts.now ?? Date.now()
  const uptimeMsRaw = opts.uptimeMs ?? uptime() * 1000
  const bootMs =
    Number.isFinite(nowMs) && Number.isFinite(uptimeMsRaw) && uptimeMsRaw > 0
      ? Math.round(nowMs - uptimeMsRaw)
      : undefined
  // G-696:持锁凭据。空串/纯空白/非字符串一律视为"没给"⇒ 落回环境变量 ⇒ 再退回现生成,
  // 绝不把空凭据写进锁里(那等价于把"无凭据"合法化,release 侧的比对会失去意义)。
  const declaredToken =
    typeof opts.token === 'string' && opts.token.trim() ? opts.token.trim() : undefined
  const envToken =
    typeof process.env.IHUI_DEPLOY_LOCK_TOKEN === 'string' && process.env.IHUI_DEPLOY_LOCK_TOKEN.trim()
      ? process.env.IHUI_DEPLOY_LOCK_TOKEN.trim()
      : undefined
  const token = declaredToken ?? envToken ?? randomBytes(16).toString('hex')
  const meta = {
    mode: mode ?? '',
    pid: process.pid,
    ownerPid,
    ts: nowMs,
    host: hostname(),
    // 单调量锚点:见 classifyMeta 的读取侧说明。`ts` 之外的唯一墙钟派生态,
    // 它的价值在**读取时**与当时的 `now - uptime` 对账(墙钟被回拨/机器重启都骗不了这个差)。
    bootMs,
    // 量不到 ⇒ undefined ⇒ JSON.stringify 整键丢掉 ⇒ 与改动前的 meta 形态逐字相同
    pidStart: started.epoch ?? undefined,
    // G-696:持锁凭据,release 侧必比(见 release 头注)
    token,
    // 只在**推断**出来的那一档才多写一个键:调用方自己声明 owner(经 `--owner-pid`)时不写它 ——
    // 判读侧靠它区分"人明确说了 owner 是谁"与"我们按父进程猜的",后者不得被读成确证。
    // (注:G-412 起所有新写 meta 都多出 `bootMs` 键,这是本票新增的单调量锚点;
    //  此前"ownerPidSource 缺席 ⇒ 落盘键集与改动前逐字同形"的说法只对**这一键**成立,不再及整份 meta。)
    ownerPidSource: inferred > 0 && declared === 0 ? 'inferred-ppid' : undefined,
  }
  atomicWriteFileSync(metaFile(dir), JSON.stringify(meta))
  // 返回**写出去的那一份**:readMeta 会把内容归一成已知键的四态投影,新键在归一里被丢掉,
  // 拿归一后的投影当"是否推断"的依据就会把非确证打印成确证(见 acquire 那条日志的注释)。
  return meta
}

/** 判活对象是谁:有 owner 用 owner,没有就退回 CLI 自己(向后兼容旧 meta)。 */
function holderPid(meta) {
  const m = meta || {}
  return Number(m.ownerPid) > 0 ? Number(m.ownerPid) : Number(m.pid) || 0
}

/**
 * 把锁元数据投成 `verifyHolder` 认识的三元组 —— **主体必须是 `holderPid`,不是 `pid`**
 * (与 writeMeta 同一口径;两处各写一遍必然漂移,所以只留这一份)。
 * 旧 meta 没有 host/pidStart ⇒ 投出来就是"没有凭据",判读侧落 unverifiable。
 */
function holderIdentity(meta) {
  const m = meta || {}
  return { host: m.host || undefined, pid: holderPid(m), pidStart: m.pidStart || undefined }
}

/**
 * 删除锁目录 —— **只允许持有者自释时调用**。
 *
 * ⚠️ 抢占路径一律不得用它(2026-09-26 根治):见 `claimStaleLock()` 的注释。
 */
function removeLock(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* 忽略:仅用于持有者自释;抢占路径根本不该走到这里 */
  }
}

/** 同一把锁的指纹:判据比对用的四字段 + 判据本身的状态 kind */
function lockIdentity(state) {
  if (!state || state.kind !== 'ok' || !state.meta) return `!ok:${state?.kind ?? 'null'}`
  const m = state.meta
  return `ok|${m.mode}|${m.pid}|${m.ownerPid}|${m.ts}`
}

// 抢占动作的唯一实现在 scripts/lib/stale-lock-claim.mjs(2026-09-26 合并,
// 出处见 git log --grep 锁抢占 —— 本函数与 git-lock.mjs 的同名函数曾各写一份,
// 算法骨架只留那一份;两侧真实差异(指纹算法、归档落点、现场格式与处置策略)在此注入)。

/**
 * 抢占部署锁的悬挂锁:委托 lib 的「改名→身份回读→只处置改到的那份」骨架,
 * 本函数只负责 ① 注入部署侧差异(四态指纹 lockIdentity、现场 json、归档落点
 *    sceneArchiveRoot()、现场原地保留不搬不删的处置策略),② 把结构化结果逐字渲染回旧日志文案。
 * 语义与合并前逐字等价,算法不变式(改名优先、失败绝不碰原路径)见 lib 头注。
 *
 * @param {string} dir
 * @param {{kind:string,meta?:object,reason?:string}|null} judged 判死时的四态结论(②的比对基准)
 * @param {string} why 判死理由(进现场与日志)
 * @param {{suffix?:string, archiveRoot?:string}} [opts]
 * @returns {{ok:boolean, phase:string, code?:string, restored?:boolean, stagedPath:string|null, archived:string|null, log:string}}
 */
function claimStaleLock(dir, judged, why, { suffix, archiveRoot = sceneArchiveRoot() } = {}) {
  const me = lockIdentity(judged)
  const r = claimStaleLockCore(dir, judged, why, {
    archiveRoot,
    suffix,
    readState: readMeta,
    same: (a, b) => lockIdentity(a) === lockIdentity(b),
    writeNote: (stagedPath, ctx) => {
      // 现场随改名后的目录一起留在归档出口 ⇒ 写进那份目录里即可。
      const note = {
        takenAt: new Date().toISOString(),
        stolenByPid: process.pid,
        lockPath: dir,
        judged: judged?.kind === 'ok' ? judged.meta : null,
        judgedKind: judged?.kind ?? 'null',
        reason: why,
        rawMeta: ctx.rawMeta,
      }
      try {
        writeFileSync(join(stagedPath, 'stale-claim-note.json'), JSON.stringify(note, null, 2), 'utf8')
      } catch (e) {
        console.error(
          `[deploy-lock] ❌ 抢占现场说明写入失败(${e?.code ?? e?.message})——原始 meta 逐字如下,不得静默:\n${ctx.rawMeta ?? '(不可得)'}`,
        )
      }
    },
    // 部署侧处置策略(与合并前逐字同形):改名后的目录**就是**现场,原地保留、不搬不删;
    // git 侧则是"落不进归档就搬运/删除",这一分歧是既有语义,未统一(登记在合并票报告里)。
    placeScene: ({ stagedPath }) => ({ archived: stagedPath }),
  })
  switch (r.cause) {
    case 'dir-gone-early':
      return {
        ok: false,
        phase: 'rename',
        code: 'ENOENT',
        stagedPath: null,
        archived: null,
        log: `[deploy-lock] 抢占放弃:锁目录 ${dir} 此刻已不存在 ⇒ 未删除、未创建任何目录`,
      }
    case 'archive-rename-enoent':
      return {
        ok: false,
        phase: 'rename',
        code: 'ENOENT',
        stagedPath: null,
        archived: null,
        log: `[deploy-lock] 抢占放弃:锁目录 ${dir} 此刻已不存在 ⇒ 未删除任何目录,继续等待`,
      }
    case 'rename-failed':
      return {
        ok: false,
        phase: 'rename',
        code: r.localErr?.code ?? (r.archiveErr?.code ?? 'unknown'),
        stagedPath: null,
        archived: null,
        log: `[deploy-lock] 抢占未成功(改名 ${r.localErr?.code ?? r.localErr?.message})⇒ 原路径 ${dir} 未被触碰,继续等待`,
      }
    case 'identity-mismatch':
      return {
        ok: false,
        phase: 'identity-drift',
        restored: r.restored,
        stagedPath: r.restored ? null : r.stagedPath,
        archived: null,
        log:
          `[deploy-lock] 抢占放弃:${dir} 在改名瞬间已被替换(判死时 ${me},改到的是 ${lockIdentity(r.nowState)})` +
          ` ⇒ ${r.restored ? '已原样放回,未删除任何锁' : `⚠️ 放回失败,现场保留在 ${r.stagedPath}(未删除,请人工处置)`}`,
      }
    default:
      return {
        ok: true,
        phase: 'claimed',
        stagedPath: r.stagedPath,
        archived: r.archived,
        log: `[deploy-lock] 已抢占悬挂锁:被抢的持有者 = ${summarise(judged)};判死理由:${why};现场=${r.archived}`,
      }
  }
}

/** meta 的一行式身份描述(日志用) */
function summarise(state) {
  const m = state?.kind === 'ok' ? state.meta : null
  if (!m) return `无有效元数据(${state?.kind ?? 'null'})`
  return `mode=${m.mode} cliPid=${m.pid} ownerPid=${m.ownerPid || '(未声明)'} ts=${m.ts ? new Date(m.ts).toISOString() : '(无)'}`
}


/**
 * 进程是否存活(跨平台)。
 * 2026-09-26 修一处方向性误判:`process.kill(pid, 0)` 抛 **EPERM** 的含义是
 * "进程存在但不归本用户管",旧实现一律 catch ⇒ 判死 ⇒ **抢占别人正在用的锁**。
 * 服务账户/其他用户的构建进程正落在这一格里。
 */
function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return !!e && e.code === 'EPERM'
  }
}

/**
 * 锁龄(ms)与它的测量来源。
 * `meta.ts` 是首选(持锁者自己写的时间);元数据不可判定时只能降级用**锁目录 mtime**——
 * 这是**降级信号**:它不如 pid 可靠(任何一次写入目录的动作都会刷新它,包括别人的
 * 归档/取证读取以外的写入),所以它**只用于**"不可判定态的 stale 兜底",
 * 绝不反过来用于"判定持有者已死"。
 */
function lockAgeMs(dir, state, now = Date.now()) {
  if (state.kind === 'ok' && state.meta.ts > 0) {
    if (state.meta.ts > now + FUTURE_TS_TOLERANCE_MS) {
      // **未来时间戳不等于"0 岁"**。旧写法 `Math.max(0, now - ts)` 把未来值夹成 0 ⇒ 锁龄恒 0
      // ⇒ 硬上限永远到不了;叠加"pid 名义存活"就是 2026-09-25 冻结部署环 11h50m 的那组条件。
      // 身份三元组(2026-09-27)能治 pid 复用那一半,但旧 meta 没记身份两元、或锁由别机持有时,
      // 只剩"年龄"这一维兜底 —— 所以异常必须显式标出来交给 decideSteal,而不是夹成 0 当正常读数。
      // G-412:把"未来多少秒"量出来随读数一起带走,出路文案与自检都能点名它,不许静默恒等。
      const futureMs = state.meta.ts - now
      return {
        ageMs: 0,
        futureMs,
        source: `ts 不可信(未来 ${Math.round(futureMs / 1000)}s;meta.ts 与墙钟矛盾,锁龄无法由墙钟推得)`,
        clockAnomalous: true,
      }
    }
    return { ageMs: Math.max(0, now - state.meta.ts), source: 'meta.ts' }
  }
  try {
    const m = statSync(dir).mtimeMs
    if (m > now + FUTURE_TS_TOLERANCE_MS)
      return {
        ageMs: 0,
        futureMs: m - now,
        source: `ts 不可信(锁目录 mtime 在未来 ${Math.round((m - now) / 1000)}s)`,
        clockAnomalous: true,
      }
    return {
      ageMs: Math.max(0, now - m),
      source: '锁目录 mtime(降级信号,不如 pid 可靠)',
    }
  } catch {
    return { ageMs: 0, source: '不可测(锁目录 stat 失败)' }
  }
}

/**
 * G-412 第二判据:用**单调量**给这把锁一个墙钟之外的"绝对存活时刻上限"。
 *
 * 为什么 clamp 不够:`age = max(0, now - ts)` 让未来 ts 变成"0 岁"——硬上限不再触发,
 * 于是"无限等待"只是从"锁龄恒 0"换成了"锁永远新"。本函数拿 `os.uptime()`(单调时钟,
 * 不受墙钟步进/回拨影响)反推当前开机时刻 `curBoot = now - uptime`,与 meta 对账出三态:
 *   - `contradiction / future-ts`   ts 超过容差地落在未来,且按单调推算落**在本机当前开机
 *     会话之内**(墙钟说"还没发生",单调说"已经在本次开机之后")⇒ 墙钟在写下这把锁之后被
 *     回拨过 ⇒ ts 不可信(未来 N 秒),年龄维作废。
 *   - `contradiction / session-ended` meta 记着写入时的开机锚点 `bootMs`,而现推开机时刻
 *     **晚于**它超过容差 ⇒ 自写入后本机要么重启过、要么墙钟被大幅前移过;两种解释都说明
 *     "这把锁在本次开机里不可能还活着这么久"⇒ 记录的持有者不可信地存活。
 *   - `consistent`                  墙钟与单调钟没有可判的矛盾(年龄维按原判据走)。
 *   - `unverifiable`                没有凭据可比:uptime 量不到 / 别机持有(host≠本机) /
 *     旧 meta 没记 host。**维持改动前行为,不据此抢,也不静默记为"已核过"**(§5b/G-193
 *     与 verifyHolder 的三态纪律同形:抢错 = 两次构建同写 .next,少抢 = 只多等一轮)。
 *
 * 纯函数:now/uptimeMs/localHost 全部由调用方注入(自检与镜像测试拿假值喂它,
 * 绝不为取证真等待机器重启)。容差**复用** FUTURE_TS_TOLERANCE_MS —— 不得另抄第二个数。
 *
 * @param {{meta:{ts:number,host:string,bootMs:number}, now:number, uptimeMs:number, localHost:string}} in
 * @returns {{kind:'consistent'}
 *          | {kind:'contradiction',mode:'future-ts',futureMs:number,curBootMs:number,why:string}
 *          | {kind:'contradiction',mode:'session-ended',driftMs:number,curBootMs:number,why:string}
 *          | {kind:'unverifiable',reason:string}}
 */
function monotonicAgeVerdict({ meta, now, uptimeMs, localHost }) {
  const m = meta || {}
  const ts = Number(m.ts) || 0
  if (!Number.isFinite(now) || !Number.isFinite(uptimeMs) || !(uptimeMs > 0))
    return { kind: 'unverifiable', reason: 'os.uptime() 量不到 ⇒ 单调推算无从谈起' }
  const host = typeof m.host === 'string' ? m.host : ''
  if (host && host !== localHost)
    return {
      kind: 'unverifiable',
      reason: `锁由别机持有(host=${host} ≠ ${localHost})⇒ 本机单调钟推算对它没有意义`,
    }
  if (!host)
    return {
      kind: 'unverifiable',
      reason: '旧 meta 未记 host ⇒ 无法确认这把锁写在本机上,单调判据不冒用(维持改动前行为)',
    }
  const curBoot = Math.round(now - uptimeMs)
  // ① 未来 ts(超过容差)且按单调推算落在"本机当前开机之后" —— 对同机锁这几乎是必然的
  //   (curBoot < now < ts),它的作用是把"墙钟回拨"这一解释钉成**证据**而不是猜测。
  if (ts > now + FUTURE_TS_TOLERANCE_MS && ts >= curBoot) {
    const futureSec = Math.round((ts - now) / 1000)
    return {
      kind: 'contradiction',
      mode: 'future-ts',
      futureMs: ts - now,
      curBootMs: curBoot,
      why: `ts 不可信(未来 ${futureSec}s):墙钟说这把锁还没被写下,单调推算(开机时刻=${new Date(curBoot).toISOString()} + uptime)说它落在本机当前开机会话内 ⇒ 墙钟在写入后被回拨,锁龄维判不出来`,
    }
  }
  // ② 绝对存活时刻上限:meta.bootMs 是**写入当时**反推的开机时刻;若现推的开机时刻比它晚
  //   超过容差,则自写入起本机已换过开机会话(重启)或墙钟被大幅前移 —— 两种情况下
  //   "pid 名义存活"都与"这把锁还活着"再无因果(重启会把任何 pid 发给新进程)。
  const bootMs = Number(m.bootMs) || 0
  if (bootMs > 0 && curBoot > bootMs + FUTURE_TS_TOLERANCE_MS) {
    return {
      kind: 'contradiction',
      mode: 'session-ended',
      driftMs: curBoot - bootMs,
      curBootMs: curBoot,
      why:
        `这把锁的绝对存活时刻已过:meta 记录写入时开机=${new Date(bootMs).toISOString()},` +
        `而现推开机=${new Date(curBoot).toISOString()} 晚 ${(Math.round((curBoot - bootMs) / 1000))}s(容差 ${FUTURE_TS_TOLERANCE_MS / 1000}s)` +
        ' ⇒ 自写入后本机重启过或墙钟被大幅前移,记录的持有者不可能在本次开机里活着',
    }
  }
  return { kind: 'consistent' }
}

/** 现场归档根目录:只走本仓既有落点(§15b 批准的临时/归档面),禁止硬编码盘符(§5b/§15b 前例)。 */
function sceneArchiveRoot() {
  const override = process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR
  if (override) return resolve(override)
  return join(repoRoot, '.ihui-agent', 'tmp', 'deploy-lock-scene')
}

/**
 * pending 目录的落点(G-814425)—— **刻意不放正式锁的同级兄弟**,即不放项目根。
 *
 * 理由不是美观:`.gitignore` 里那条是 `.deploy.lock`(无斜杠 ⇒ 只匹配这一个**确切名字**),
 * 所以 `.deploy.lock.<nonce>.pending` 这种兄弟名**不被忽略**。一级目录整洁守门(第 44 项)
 * 扫的就是根目录条目,一个残留(进程在 mkdir 与 rename 之间被杀)会以"白名单外隐藏目录 +
 * 未被 git 跟踪"的形态落进它的 exit 2 分支 —— 那是一台与任何提交内容都无关的恒红/恒"未判定",
 * 唯一结局是各会话跳钩子、连带约 185 道门对该提交作废(§12e 同型)。
 * 落进 `sceneArchiveRoot()/pending` 同时满足三件事:被 gitignore、与现场归档同一落点(§15b)、
 * 且与锁目录**同卷**(rename 仍是原子可见;万一不同卷,lib 会自动退回同级 pending 重试一次)。
 */
function lockPendingRoot() {
  const override = process.env.IHUI_DEPLOY_LOCK_PENDING_DIR
  if (override) return resolve(override)
  return join(sceneArchiveRoot(), 'pending')
}

/**
 * 抢占/代为收口前把锁现场**原样归档**(A9-3「抢占保现场」)。
 * 归档的是**字节**不是重新序列化的对象——坏锁的价值恰恰在于"它到底长什么样"。
 * @param {{kind:string,reason?:string,ageMs?:number,ageSource?:string}} state 四态判据(附锁龄,供现场说明)
 * @returns {string|null} 归档目录;null = 归档失败(调用方须把原始内容逐字打到 stderr,绝不静默覆盖)
 */
function archiveScene(dir, state, why) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = join(
    sceneArchiveRoot(),
    `${stamp}-by-pid${process.pid}-${Math.random().toString(36).slice(2, 6)}`,
  )
  let rawBuf = null
  try {
    rawBuf = readFileSync(metaFile(dir))
  } catch {
    rawBuf = null
  }
  try {
    mkdirSync(target, { recursive: true })
    // 归档现场同样走原子替换:一半的现场档 = 取证时"这份 meta 到底长什么样"无从判断
    // (rawBuf 是**原始字节**,出口对 Buffer 逐字节写,不重新序列化)。
    if (rawBuf !== null) atomicWriteFileSync(join(target, 'meta.json'), rawBuf)
    else
      writeFileSync(join(target, 'meta.json.unavailable.txt'), `读取失败:${state.reason}\n`, 'utf8')
    // 锁目录里除 meta 之外的任何文件一并原样复制(禁止整棵 rm -rf 前不留档)
    for (const name of readdirSync(dir)) {
      if (name === 'meta.json') continue
      try {
        copyFileSync(join(dir, name), join(target, name))
      } catch {
        /* 单个附属文件复制失败不阻断(主现场已落) */
      }
    }
    writeFileSync(
      join(target, 'scene-note.txt'),
      [
        `归档时间: ${new Date().toISOString()}`,
        `执行进程: pid=${process.pid} 命令=${process.argv.slice(1).join(' ') || '(in-process)'}`,
        `锁目录: ${dir}`,
        `元数据态: ${state.kind}${state.reason ? `(${state.reason})` : ''}`,
        `锁龄: ${state.ageMs ?? '未知'}ms 来源=${state.ageSource ?? '未知'}`,
        `抢占理由: ${why}`,
      ].join('\n'),
      'utf8',
    )
    console.log(`[deploy-lock] 抢占前现场已原样归档: ${target}`)
    return target
  } catch (e) {
    console.error(
      `[deploy-lock] ❌ 归档现场失败(${e?.code ?? e?.message}) —— 不得静默覆盖,meta.json 原始内容逐字如下:`,
    )
    console.error(rawBuf === null ? '(原始内容不可得)' : rawBuf.toString('utf8'))
    return null
  }
}

/**
 * 一次「这锁能不能拿」的勘验(纯判据,不删不改 —— 便于二次确认时复用同一条判据)。
 *
 * 2026-09-27 起多一个**可选**入参 `identity`(调用方现测好再传进来,见 acquire 的 memo):
 * 它不改变任何既有分支的结论,只多授权一条 —— `mismatch`(锁里记的启动时间与现测不符
 * ⇒ 这个 pid 已不是持锁过程)允许在"名义存活且未超硬上限"时抢占,即比 30 分钟硬上限
 * 更早、且**不靠猜**。`match` / `unverifiable` / 不传 ⇒ 与改动前逐字同结论。
 * 之所以由调用方传而不是在这里现测:本函数每 500ms 轮询一次,派生 PowerShell 不得进这条快路径。
 *
 * 返回 action:
 *   - `coexist`   dev+dev 放宽(旧 check-lock 语义)
 *   - `steal`     可抢占(调用方仍须二次确认 + 归档现场)
 *   - `wait`      继续等
 */
function decideSteal({
  dir,
  mode,
  staleMs,
  hardCapMs = HARD_CAP_MS,
  now = Date.now(),
  identity,
  // G-412 单调判据的可注入面:默认现取(uptime 是进程内系统调用,不派生 PowerShell,
  // 因此不违反 S48 那条"快路径不派生"的纪律);自检/镜像测试喂假值,绝不为取证真重启。
  uptimeMs = uptime() * 1000,
  localHost = hostname(),
}) {
  const state = readMeta(dir)
  const age = lockAgeMs(dir, state, now)
  const info = { state, ageMs: age.ageMs, ageSource: age.source }

  if (state.kind === 'ok') {
    const pid = holderPid(state.meta)
    const alive = isProcessAlive(pid)
    const who =
      Number(state.meta.ownerPid) > 0
        ? `owner pid=${state.meta.ownerPid}(CLI pid=${state.meta.pid})`
        : `pid=${state.meta.pid}(无 owner,退回 CLI pid)`
    if (mode === 'dev' && state.meta.mode === 'dev' && alive) {
      return {
        action: 'coexist',
        holderAlive: alive,
        ...info,
        why: `dev+dev 共存(持有者 ${who} 存活)`,
      }
    }
    if (!alive) {
      // 2026-08-27 立的判据,一字不许改回:持有者已退出 ⇒ **不限锁龄**立即抢占。
      return {
        action: 'steal',
        immediate: true,
        holderAlive: alive,
        ...info,
        why: `持有者 ${who} 已退出(锁龄 ${age.ageMs}ms 来源 ${age.source},按 2026-08-27 判据不限锁龄)`,
      }
    }
    /**
     * 身份三元组**确证**被复用 ⇒ 抢占,不必再等锁龄爬到 30 分钟硬上限。
     * 这是本函数唯一新增的一条授权路径,排在硬上限之前(有确据时先说确据);
     * `immediate:false` —— 与硬上限那一档同形:名义存活者不是"已死",所以**先归档现场**再抢,
     * 不走"持有者已退出"的秒抢通道(误判时现场还在,可复核可回滚)。
     */
    if (identity?.kind === 'mismatch') {
      return {
        action: 'steal',
        immediate: false,
        holderAlive: alive,
        identityKind: identity.kind,
        ...info,
        why:
          `持有者 ${who} 名义存活,但身份三元组确证该 pid 已被复用:${identity.why}` +
          `(锁龄 ${age.ageMs}ms / 硬上限 ${hardCapMs}ms ⇒ 不必等年龄兜底,归档现场后抢占)`,
      }
    }
    // G-412 第二判据的现算结果(墙钟之外的绝对存活上限;三态,unverifiable 一律维持原判据)。
    const mono = monotonicAgeVerdict({ meta: state.meta, now, uptimeMs, localHost })
    /**
     * 时钟读数异常(ts 或 mtime 落在未来)⇒ **年龄这一维已经判不出来**,而"无限 wait"不是可接受的
     * 兜底(§5b/G-193 那条判断:宁可抢一把明显超时的锁并先归档现场,不可让生产一直不更新)。
     * 排在身份确据之后、硬上限之前:`immediate:false` ⇒ 与硬上限同形,先归档现场再抢。
     * G-412:单调钟给出的证据(future-ts 时点名"ts 不可信(未来 N 秒)")随 why 一起落到
     * acquire/check/超时文案 —— 不许把这把锁继续读成"刚刚建的、很新",那是无限等待换了个形态。
     */
    if (age.clockAnomalous) {
      const monoNote =
        mono.kind === 'contradiction'
          ? `;单调判据同向:${mono.why}`
          : mono.kind === 'unverifiable'
            ? `;单调判据=无法核对(${mono.reason})⇒ 仅按墙钟异常这一维处置`
            : ';单调判据=一致(仅墙钟读数异常)'
      return {
        action: 'steal',
        immediate: false,
        holderAlive: alive,
        clockAnomalous: true,
        futureMs: age.futureMs,
        monotonic: mono,
        ...info,
        why:
          `持有者 ${who} 名义存活,但 ${age.source}` +
          monoNote +
          ' ⇒ 年龄兜底这一维失效,不能因此无限 wait;出路:归档现场后抢占(等效硬上限已到),人工出口:`deploy-lock.mjs break-stale --reason "<理由>"`',
      }
    }
    /**
     * G-412 新增:单调钟判出"这把锁的绝对存活时刻已过"(写入后本机重启过 / 墙钟被大幅前移),
     * 而墙钟读数本身**没有**越出未来容差 —— 这一格旧判据会一路 wait(锁在墙钟上看起来"正常地旧"、
     * 未超硬上限),pid 名义存活又压着不放手。`immediate:false` ⇒ 与硬上限同形:先归档再抢。
     * 接受的代价如实登记:墙钟在写入后被**前移**超过容差(而非重启)时这里会误抢一把活锁 ——
     * 那种墙钟本身已不可信,且现场有档 + acquire 侧二次确认兜底;反向的选择(继续等)正是
     * G-193 那次 11h50m 冻结的形状,两边不可能都零风险,取"有出路"这一边。
     */
    if (mono.kind === 'contradiction' && mono.mode === 'session-ended') {
      return {
        action: 'steal',
        immediate: false,
        holderAlive: alive,
        monotonic: mono,
        ...info,
        why:
          `持有者 ${who} 名义存活(锁龄 ${age.ageMs}ms / 硬上限 ${hardCapMs}ms),但 ${mono.why}` +
          ' ⇒ 年龄维与存活维矛盾且单调钟站"矛盾"一边;出路:归档现场后抢占,人工出口:`deploy-lock.mjs break-stale --reason "<理由>"`',
      }
    }
    /**
     * "持有者活着" 与 "锁龄超过硬上限" 同时成立 ⇒ 这个 pid 已经不属于持锁的那个过程了
     * (**pid 复用**),没有第二种解释:一次构建+部署单元不会把锁握到几十分钟以上。
     * 这一格就是 2026-09-25 冻结部署环 11h50m 的那一格 —— 旧代码在这里无条件 `wait`,
     * 而"活着"是量出来的、锁龄也是量出来的,两者矛盾时却谁都不肯认账。
     * 与 `scripts/git-lock.mjs` 的 1800s 硬上限是同一条设计(AGENTS §12 心跳机制③)。
     */
    if (age.ageMs > hardCapMs) {
      return {
        action: 'steal',
        immediate: false,
        holderAlive: alive,
        identityKind: identity?.kind,
        ...info,
        why:
          `持有者 ${who} 名义存活,但锁龄 ${age.ageMs}ms 已超硬上限 ${hardCapMs}ms ⇒ 这是被复用的 pid,` +
          `不是持锁过程本身(一次构建+部署不可能握锁这么久)⇒ 归档现场后抢占${identityNote(identity)}`,
      }
    }
    return {
      action: 'wait',
      holderAlive: alive,
      identityKind: identity?.kind,
      monotonic: mono,
      ...info,
      why: `持有者 ${who} 仍在运行(锁龄 ${age.ageMs}ms / 硬上限 ${hardCapMs}ms)${identityNote(identity)}`,
    }
  }

  // —— 不可判定三态:绝不等价于"无人持锁"(A9-3),也不许傻等到超时不给出路
  /**
   * G-386(孪生 G-779):**时钟倒挂在不可判定面必须单独成档**,不得与"活着/已退出/不可判定即等待"并桶。
   * 本票点名的谓词形状 `age > staleMs` 在这一格的结构:不可判定面的锁龄降级取锁目录 mtime,
   * mtime 超容差落在未来 ⇒ `lockAgeMs` 报 `ageMs=0` + `clockAnomalous`(G-412 已把读数标出来,
   * 但 ok 面之外没人消费它)⇒ `0 > staleMs` 恒假 ⇒ 无限 wait 到超时,出路文案还是那句已被钉死的
   * "超 stale 才抢占"。现按 ok 面 clockAnomalous 档与硬上限档的同一条形状处置:`steal + immediate:false`
   * —— **先归档现场再抢**,不是秒抢;失败方向照 §5b/G-193:宁可抢一把年龄判不出而现场有档的锁,
   * 不可让"没人能说清"变成"部署环一直不更新"。单调对账在这一面**无锚点**(拿不到 ts/host/bootMs),
   * 如实写进结论,不硬凑一个"已核过"。容差语义不变:容差内的未来 mtime(NTP 微步进)不进这一档。
   */
  if (age.clockAnomalous) {
    return {
      action: 'steal',
      immediate: false,
      holderAlive: null,
      ...info,
      clockAnomalous: true,
      futureMs: age.futureMs,
      why:
        `元数据不可判定(${state.kind}:${state.reason})且 ${age.source}` +
        ' ⇒ **时钟倒挂档**(与"活着/已退出/不可判定即等待"不同的独立一档):墙钟回拨把下面那条 stale 年龄出路钉成恒假' +
        `(年龄读数被钳在 ${age.ageMs}ms),不得因此无限 wait;单调对账=无锚点(不可判定面拿不到 ts/host/bootMs,` +
        '不硬凑结论)⇒ 出路:与硬上限同档 —— 先归档现场再抢占(非秒抢),二次确认与原子改名照旧;' +
        '人工出口 `deploy-lock.mjs break-stale --reason "<理由>"`',
    }
  }
  if (age.ageMs > staleMs) {
    return {
      action: 'steal',
      immediate: false,
      holderAlive: null,
      ...info,
      why: `元数据不可判定(${state.kind}:${state.reason})且锁龄 ${age.ageMs}ms 已超 stale 阈值 ${staleMs}ms —— 这是 stale 年龄档的出路(年龄读数被钉死那一档本例未触发)`,
    }
  }
  return {
    action: 'wait',
    holderAlive: null,
    ...info,
    why: `元数据不可判定(${state.kind}:${state.reason})⇒ 不凭猜测删锁;锁龄 ${age.ageMs}ms 未超 stale=${staleMs}ms`,
  }
}

/**
 * 把身份对账的实测结论如实带进结论行(与 `scripts/git-lock.mjs` 的 identityNote 同一条设计)。
 * "没做对账"与"对过但判不出来"与"对过且相符"必须写成三样,否则读现场的人会把
 * "没有凭据"当成"已经核过"—— 本仓最高频的失效型。
 */
function identityNote(identity) {
  if (!identity) return ';身份对账=未做(调用方没给结论,这一格只按原判据 —— 不是"已核过身份")'
  if (identity.kind === 'mismatch') return `;身份对账=mismatch(${identity.why})⇒ 确证 pid 已被复用`
  return `;身份对账=${identity.kind}(${identity.why ?? '无原因'})⇒ 不构成额外授权,本条仍按原判据`
}

/** 超时报错:文案必须与该形态的**实际判据**一致(旧文案在这里撒过谎) */
function lockTimeoutMessage({ timeoutMs, decision, staleMs, dir, mkdirErr }) {
  const { state, ageMs, ageSource, holderAlive } = decision
  const holderInfo =
    state.kind === 'ok'
      ? `mode=${state.meta.mode} pid=${state.meta.pid} ${state.meta.ts ? `于 ${new Date(state.meta.ts).toLocaleTimeString()}` : '(无 ts)'}${holderAlive ? '(运行中)' : '(已退出)'}`
      : `无法判定(${state.kind}${state.reason ? `:${state.reason}` : ''})`
  let route
  if (state.kind === 'ok') {
    route = holderAlive
      ? '持有进程仍在运行,本工具不会打断它;它退出后锁会被立即抢占并归档现场'
      : `持有者已退出即可抢占(锁龄 ${ageMs}ms 来源 ${ageSource})——仍未抢到说明删锁目录失败,请查权限/占用`
    // 身份对账的实测结论必须跟着超时文案走:"我等了一把活锁"与"我等了一把**没身份凭据**的锁"
    // 是两句不同的话 —— 后者才是"这一格为什么没出路"的真实答案(判据原文里带身份那一维)。
    route += `;判据原文:${decision.why}`
  } else if (decision.clockAnomalous) {
    // G-386:不可判定面 + 年龄读数被倒挂钉死 ⇒ 走到超时说明**时钟倒挂档**试过而没成(归档失败/改名瞬间被换),
    // 文案不得再复读"唯一出路是超 stale"—— 那句话在本档恒不成立(与旧撒谎文案同一型,只是换了触发面)。
    route =
      `元数据不可判定且年龄读数被时钟倒挂钉死(来源 ${ageSource})⇒ 本格走**时钟倒挂档**自动出路(先归档现场再抢占,与硬上限同档,非秒抢);` +
      '等到超时说明归档未成或改名瞬间锁已被替换 —— 本工具不凭猜测删锁,人工出口:deploy-lock.mjs break-stale --reason "<理由>"'
  } else {
    route = `元数据不可判定,本工具不会凭猜测删锁;stale 年龄档的自动出路是锁龄超 stale=${staleMs}ms 后归档并抢占(当前 ${ageMs}ms,来源 ${ageSource});年龄读数被倒挂钉死时另走时钟倒挂档`
  }
  const mkdirNote =
    mkdirErr && mkdirErr.code !== 'EEXIST' ? `(另:创建锁目录返回 ${mkdirErr.code})` : ''
  return (
    `[deploy-lock] 等待部署锁超时(${timeoutMs}ms)。当前持锁: ${holderInfo}。${route}。${mkdirNote} ` +
    `紧急可人工确认持锁者后删除 ${dir}`
  )
}

/**
 * 获取锁。返回 true 表示获取成功。
 * 规则:
 *   - dev+dev:放宽(多个 dev 可共存,与旧 check-lock 一致)
 *   - build 与其他任何模式:严格互斥
 *   - 元数据完好且持有者进程已退出:**立即抢占(不限锁龄,2026-08-27 判据)**
 *   - 元数据不可判定(absent/invalid/unreadable):只在锁龄超 stale 后抢占,且抢占前归档现场
 *   - 超时未获锁:抛错(不打断进行中的部署),文案按形态给真实出路
 */
async function acquire({
  mode = 'build',
  timeoutMs = 600_000,
  staleMs = 600_000,
  hardCapMs = HARD_CAP_MS,
  ownerPid,
  token,
  dir = lockDir(),
  identityRun,
} = {}) {
  const deadline = Date.now() + timeoutMs
  const identityOpts = identityRun ? { run: identityRun } : {}
  // 身份现测**一次**就够:它是关于"这把锁的 pid 还是不是当初那个进程"的一个事实,
  // 而 acquire 每 500ms 轮询一次 —— 不设这道闸就是把 PowerShell 派生放进等待快路径。
  // 键 = 锁指纹(pid|ownerPid|ts):持有者换锁或心跳改 ts ⇒ 重问。
  let asked = null
  const askIdentity = (meta) => {
    const key = `${meta?.pid ?? ''}|${meta?.ownerPid ?? ''}|${meta?.ts ?? ''}`
    if (!asked || asked.key !== key) {
      asked = { key, verdict: verifyHolder(holderIdentity(meta), identityOpts) }
      if (asked.verdict.kind === 'unverifiable') {
        // 判不出来必须喊出来,否则读日志的人把它当成"身份已核过、没问题"
        console.warn(
          `[deploy-lock] 身份无法核对(pid=${meta?.pid ?? ''}):${asked.verdict.why} ⇒ 维持改动前判据(存活 + 锁龄),不据此抢占`,
        )
      }
    }
    return asked.verdict
  }
  for (;;) {
    let mkdirErr = null
    // G-814425:锁目录必须**写全再对外可见**(唯一实现 scripts/lib/lock-atomic-init.mjs,
    // 与 git-lock.mjs 共用同一份,禁止各写一遍)。旧形态是 `mkdirSync(dir)` 紧接 `writeMeta(dir)`,
    // 这两步之间那把空锁目录已经是"锁存在"的证据,而本文件对它的判读就是四态里的 `absent`,
    // absent 的自动出路是"锁龄超 stale ⇒ 归档并抢占" ⇒ **还在写 meta 的活锁可以被抢走**,
    // 抢到的人再 mkdir、原持有者随后把 meta 写进别人的锁目录,账面两个构建都认为自己持锁
    // (8-09 那两个构建同时写 .next ⇒ 8801 短暂 502 的那一型,只是这次由"初始化窗口"触发)。
    // 现在正式路径出现即等于内容已写全;pending 落点见 lockPendingRoot()(不落项目根,不留残留)。
    const made = createLockDirectoryAtomically({
      dir,
      pendingRoot: lockPendingRoot(),
      writePayload: (staged) => writeMeta(staged, mode, { ownerPid, token, ...identityOpts }),
    })
    if (made.ok) {
      // 用 writeMeta 的**返回值**而不是 readMeta:readMeta 会把 meta 归一成已知键的四态投影,
      // 新加的 ownerPidSource 在归一里被丢掉 —— 拿它当"是否推断"的依据就会打印成"调用方声明",
      // 把一条我们刻意标成"非确证"的凭据说成确证(本行日志正是给别人看的判读依据)。
      const written = made.payload
      // G-696:记下本进程为**这个目录**写下的凭据 —— 同进程内 acquire⇒release 无需显式传 token
      // (键按目录,多把锁互不串;dev+dev 共存不写 meta 也就不记,共存的第二方本就没有凭据)。
      if (typeof written?.token === 'string' && written.token) {
        ownerTokenMemo.set(resolve(dir), written.token)
      }
      const owner =
        Number(written?.ownerPid) > 0
          ? written.ownerPidSource === 'inferred-ppid'
            ? `owner pid=${written.ownerPid}(未声明 ⇒ 按派生本次调用的父进程判活,非确证)`
            : `owner pid=${written.ownerPid}(调用方声明)`
          : 'owner 无从确定(父进程也量不到)⇒ 退回 CLI pid 判活,与改动前同形'
      // token 打全量:这是**本调用方自己**的凭据,CLI 场景 acquire/release 不同进程,
      // 调用方(构建脚本)要从这里把它带给 release(--token / IHUI_DEPLOY_LOCK_TOKEN)。
      console.log(
        `[deploy-lock] ${mode} 锁已获取 (cli pid=${process.pid};${owner};token=${written?.token ?? '(未生成)'})`,
      )
      return true
    }
    // 只有"目录已存在"(contended,lib 一律归一成 code=EEXIST)才是"别人持锁"。
    // 其余故障(mkdir pending 的 ENOENT、写 meta 的 ENOSPC/权限、rename 失败而正式路径不在)
    // 必须当场报错:旧实现把两步全裹在同一个 catch 里,写不进 meta 时会退化成
    // "死等一把自己刚建的锁",600s 后抛错还把责任推给"残留锁"。
    if (made.kind === 'error') {
      // 刻意**不**在这里删锁:非 EEXIST 证明不了"这个目录是我刚建的",
      // 而证明不了的删除就可能是在删别人的锁(本票红线)。留下的空锁目录会被后续
      // acquire 按 absent 态走"超 stale ⇒ 归档 ⇒ 抢占"这条自愈路,不需要未证明的破坏动作。
      throw new Error(
        `[deploy-lock] 创建/写入锁 ${dir} 失败(${made.code}:${made.message ?? '无原因'})。` +
          '因无法证明该目录为本次所建,本工具不代删;请查磁盘空间/权限后重试。',
      )
    }
    mkdirErr = { code: made.code, originCode: made.originCode ?? null }
    // 锁已存在:判断是否可共存 / 是否可抢占
    let decision = decideSteal({ dir, mode, staleMs, hardCapMs })
    /**
     * 只有一格需要现测身份:**原判据要我等**(名义存活、未超硬上限)。
     * `steal`/`coexist`/不可判定三态本来就有结论,多问一次 PowerShell 只是把派生
     * 搬到不该在的地方(语义硬要求 2)。传完 identity 后 `decision` 会被重算一遍 ——
     * 除"身份确证复用"这一条外不会产生新结论(见 decideSteal 头注与镜像测试的反向锁)。
     */
    if (decision.action === 'wait' && decision.holderAlive === true && decision.state.kind === 'ok') {
      decision = decideSteal({ dir, mode, staleMs, hardCapMs, identity: askIdentity(decision.state.meta) })
    }
    if (decision.action === 'coexist') {
      console.log(`[deploy-lock] dev+dev 共存,继续 (持有者 ${decision.why})`)
      return true
    }
    if (decision.action === 'steal') {
      // 二次确认:判据必须仍然成立(这一轮与上一轮之间持有者可能已换人/已复活)。
      // **必须带上同一个 identity**:不带的话"只靠身份确证成立"的那一次抢占会在
      // 二次确认时被读成"判据不再成立",于是新通道永远只喊不抢 —— 接线接了个寂寞。
      const again = decideSteal({
        dir,
        mode,
        staleMs,
        hardCapMs,
        identity: asked?.key ? asked.verdict : undefined,
      })
      if (again.action !== 'steal') {
        console.warn(`[deploy-lock] 抢占判据在二次确认时不再成立(${again.why}),继续等待`)
      } else {
        console.warn(`[deploy-lock] 检测到可抢占锁:${again.why}`)
        const archived = archiveScene(
          dir,
          { ...again.state, ageMs: again.ageMs, ageSource: again.ageSource },
          again.why,
        )
        if (archived === null) {
          // 归档失败时**不**删锁:现场不得静默覆盖(原始内容已逐字打到 stderr,不丢判据)。
          // 例外:immediate(持有者已死)那一型若因归档失败而卡住,会把 2026-08-27 修的启动死循环
          // 换回来 —— 故仅在该型继续删锁(现场已在 stderr 留痕),不可判定型仍保守等待。
          if (!again.immediate) {
            await new Promise((r) => setTimeout(r, POLL_MS))
            if (Date.now() > deadline)
              throw new Error(
                lockTimeoutMessage({ timeoutMs, decision: again, staleMs, dir, mkdirErr }),
              )
            continue
          }
          console.warn(
            '[deploy-lock] ⚠️ 归档失败但持有者已退出,按 2026-08-27 判据继续抢占(现场已逐字打印到 stderr)',
          )
        }
        // 抢占动作:**原子改名,只处置自己改到的那一份**(见 claimStaleLock)。
        // 旧写法是 `removeLock(dir)`:在"我判它已死"与"我删它"之间,别人可以已删掉旧锁并
        // mkdir 拿到新锁 ⇒ 删掉的是别人的活锁 ⇒ 两次构建同时写 .next(8-09 的 502 那一型)。
        // 上面 `archiveScene` 的 existsSync 回读只判"删没删掉",不判"删的是不是刚看过的那把"。
        const claim = claimStaleLock(dir, again.state, again.why)
        console.log(claim.log)
        if (!claim.ok) {
          // 没抢到(锁已不见 / 改名瞬间被替换 / 改到了别人的活锁)⇒ 什么都没删,继续轮询。
          // 仍受 deadline 约束:不能因为"这轮没成功"就无限等下去。
          await new Promise((r) => setTimeout(r, POLL_MS))
          if (Date.now() > deadline)
            throw new Error(lockTimeoutMessage({ timeoutMs, decision: again, staleMs, dir, mkdirErr }))
          continue
        }
        // 2026-08-14 那道的替代版:抢占成功后原路径若又出现目录,那是**新持有者**的锁,
        // 该等就等(绝不再删);旧实现在这里抛错,是把"别人动作快"误报成"我删不掉"。
        if (existsSync(dir)) {
          console.warn(
            `[deploy-lock] 抢占成功后 ${dir} 已被重建 ⇒ 那是新持有者的锁,按正常等待处理(本工具不删它)`,
          )
        }
        continue

      }
    }
    if (Date.now() > deadline) {
      throw new Error(lockTimeoutMessage({ timeoutMs, decision, staleMs, dir, mkdirErr }))
    }
    // 轮询等待
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

/** 凭据只打掩码:拒绝文案会进日志,把整枚凭据打进去等于把 release 的钥匙贴在门上。 */
function maskToken(t) {
  return typeof t === 'string' && t ? `${t.slice(0, 4)}…` : '(未提供)'
}

/**
 * 本进程为各目录写下的持锁凭据(G-696):键 = resolve 后的锁目录。
 * 同进程 acquire⇒release 无需显式传 token;CLI 场景(acquire/release 不同进程)靠
 * `--token` / `IHUI_DEPLOY_LOCK_TOKEN` 带凭据。dev+dev 共存不写 meta 也就不记 ——
 * 共存的第二方本就没有凭据,release 时被拒是正确行为。
 */
const ownerTokenMemo = new Map()

/**
 * 释放锁。G-696(2026-09-29)收紧归属核验:旧口径是"CLI acquire/release 不同进程,
 * 按 mode 匹配(+pid 判 self/死活)即视为可释放" ⇒ 同 mode 的第二条 CLI 能把第一条
 * 正在用的锁当"悬挂锁"删掉(predev 的父 shell 先退、pid 被复用都是现成入口)。
 * 现口径:**带 token 的锁必须凭同一 token 才许释放** ——
 *   - 凭据来源:显式入参 `token` > 进程内备忘(acquire 写下那份)> 环境变量 `IHUI_DEPLOY_LOCK_TOKEN`;
 *   - 不匹配(**含"根本没提供"**)⇒ 拒绝并点名,绝不静默成功;
 *   - 锁 meta **没有** token(旧格式锁)⇒ 无凭据可比,维持改动前判据处置,但必须**报名**
 *     "归属无法核验"——不把它读成"已核过"(与 host/pidStart 缺失同一纪律;旧锁随
 *     acquire 侧全部带 token 后自然绝迹)。
 * A9-3 收紧(沿用):**元数据不可判定时拒绝释放**——旧实现在此处两个 `meta &&` 守卫全短路,
 * 于是"坏锁 = 白拿",一次 release 就能删掉别人正在用的锁。
 */
function release({ mode, token, dir = lockDir() } = {}) {
  if (!existsSync(dir)) return { released: false, why: '无锁目录' }
  const state = readMeta(dir)
  if (state.kind !== 'ok') {
    console.error(
      `[deploy-lock] ❌ 拒绝释放:锁元数据无法判定(${state.kind}:${state.reason})。` +
        `此刻删锁可能删掉别人正在用的锁。请人工确认持锁者后删除 ${dir};` +
        '自动出路是 acquire 侧「锁龄超 stale 后归档抢占」。',
    )
    return { released: false, why: `无法判定:${state.kind}` }
  }
  // 若调用方指定 mode,要求锁的 mode 一致才释放(避免误删他人不同类型的锁)
  if (mode && state.meta.mode !== mode)
    return { released: false, why: `mode 不匹配(锁=${state.meta.mode} 调用=${mode})` }
  // G-696 归属核验:带 token 的锁,凭据对不上(含没带)就拒绝 —— 删锁是持有者的动作。
  const lockToken = state.meta.token || ''
  if (lockToken) {
    const callerToken =
      (typeof token === 'string' && token.trim()) ||
      ownerTokenMemo.get(resolve(dir)) ||
      (typeof process.env.IHUI_DEPLOY_LOCK_TOKEN === 'string' &&
      process.env.IHUI_DEPLOY_LOCK_TOKEN.trim()
        ? process.env.IHUI_DEPLOY_LOCK_TOKEN.trim()
        : '')
    if (callerToken !== lockToken) {
      console.error(
        `[deploy-lock] ❌ 拒绝释放:owner token 不匹配(锁=${maskToken(lockToken)} 调用=${maskToken(callerToken)})。` +
          `此刻删锁可能删掉别人正在用的锁。确是本锁持有者,请带上 acquire 时给出的凭据` +
          `(--token <t> 或环境变量 IHUI_DEPLOY_LOCK_TOKEN);` +
          '悬挂锁的自动出路是 acquire 侧「锁龄超 stale 后归档抢占」,或 `deploy-lock.mjs break-stale --reason "<理由>"`。',
      )
      return { released: false, why: 'owner token 不匹配(归属核验失败),拒绝释放' }
    }
  } else {
    console.warn(
      `[deploy-lock] ⚠️ 锁 meta 无 owner token(旧格式,归属无法核验)⇒ 按既有判据处置,` +
        '新锁自 G-696 起均带 token;旧锁随下一次 acquire 抢占/重写自然绝迹。',
    )
  }
  const self = state.meta.pid === process.pid || Number(state.meta.ownerPid) === process.pid
  const holder = holderPid(state.meta)
  if (!self && isProcessAlive(holder)) {
    // 锁持有进程还活着且不是自己 → 不释放(尊重持有者)
    const age = lockAgeMs(dir, state)
    if (age.ageMs > HARD_CAP_MS) {
      // 2026-09-25 实测就卡在这一格:pid 被复用 ⇒ "活着"是假的,而 release 不敢删,
      // acquire 那边旧判据又会无限 wait ⇒ 部署环冻结 11h50m。这里**仍然不删**(删锁是
      // 持有者的动作),但必须把真实出路说清楚:acquire 侧现在会按硬上限归档并抢占。
      console.warn(
        `[deploy-lock] 名义持有者 pid=${holder} 存活,但锁龄 ${age.ageMs}ms 已超硬上限 ${HARD_CAP_MS}ms` +
          ` ⇒ 该 pid 极可能已被复用。本命令不代删别人的锁;` +
          `自动出路是下一次 \`deploy-lock.mjs acquire\`(它会先归档现场再抢占)。`,
      )
      return { released: false, why: 'pid 疑似被复用(超硬上限),交 acquire 归档抢占' }
    }
    console.warn(`[deploy-lock] 锁由 pid=${holder} 持有且仍在运行,拒绝释放`)
    return { released: false, why: '他人持锁且存活' }
  }
  if (!self) {
    // 非持有者代为收口 = 破坏性动作:先留现场,再二次确认持有者确实已退出
    if (isProcessAlive(holderPid(state.meta))) {
      console.warn(`[deploy-lock] 二次确认:pid=${state.meta.pid} 已恢复存活,拒绝释放`)
      return { released: false, why: '二次确认持有者存活' }
    }
    const age = lockAgeMs(dir, state)
    archiveScene(
      dir,
      { ...state, ageMs: age.ageMs, ageSource: age.source },
      `代为释放非本进程持有的悬挂锁(pid=${state.meta.pid})`,
    )
    // 代为收口在语义上就是**抢占** ⇒ 必须原子改名、只处置自己改到的那一份(见 claimStaleLock)。
    // 旧写法直接 removeLock(dir):二次确认与删除之间别人可已新建锁,那一下删的是别人的活锁。
    const claim = claimStaleLock(
      dir,
      state,
      `代为收口非本进程持有的悬挂锁(cliPid=${state.meta.pid} ownerPid=${state.meta.ownerPid || '(未声明)'})`,
    )
    console.log(claim.log)
    if (claim.ok) ownerTokenMemo.delete(resolve(dir))
    return claim.ok
      ? { released: true, why: '悬挂锁代为收口(原子改名,现场已留档)' }
      : { released: false, why: `抢占未成功:${claim.phase}${claim.ok ? '' : `(${claim.code ?? claim.stagedPath ?? '身份已变'})`}` }
  }
  // 走到这里 = self(本进程就是持有者,内容凭据已验明这把是我的)⇒ 按原语义直接删
  removeLock(dir)
  ownerTokenMemo.delete(resolve(dir))
  console.log(`[deploy-lock] 锁已释放 (pid=${process.pid})`)
  return { released: true, why: self ? '持有者自释' : '悬挂锁代为收口' }
}

/**
 * ── 心跳续期(2026-10-01 立,补 AGENTS §12「部署锁」登记着的那格空白)────────────────
 *
 * 登记的空白原文:「真正的解是心跳续期(照 git-lock 每 5s 写 meta.ts),而那需要一个能看见
 * dev server 生死的常驻方 —— 现在没有」。本函数就是那个常驻方的**判据部分**:由真正长命的
 * 启动器(`scripts/dev-with-warmup.mjs`,它 spawn 并等待 `next dev`)派生,盯它的 pid。
 *
 * 心跳买到两件事,都不是新功能,而是把既有判据从"猜"变成"量":
 *   ① 续 `ts` —— 锁龄不再被误读成"pid 已被复用"(2026-09-25 冻结生产 11h50m 正是这一格:
 *      名义存活 + 锁龄超硬上限 ⇒ 谁都不敢动,谁也没在动);
 *   ② 主人一退出就**交还锁**,而不是等下一位按 stale/硬上限来抢(中间那段是无人保护窗口)。
 *
 * 三条不可漂的写法,每条各由自检的一档钉住:
 *   A. **没有凭据就不续**。心跳写的是别人那把锁上的 `ts`,所以归属核验比 release 更要紧:
 *      凭据缺失/不符、mode 或 ownerPid 漂了 ⇒ 立即停手且**不删锁**。防的是"心跳替别人
 *      把一把本该让位的锁永久续下去"。
 *   B. **到寿命只停手,不删锁**。12h 上限防的是泄漏的常驻进程,不是"dev 到点该让位";
 *      dev 还活着时删锁 = 自己撤掉保护,比不续期更坏。停手后锁按既有年龄线让位。
 *   C. 判活用裸 pid(`process.kill(pid,0)`,零派生),**身份三元组只定期现测**。
 *      把 PowerShell 派生放进每 30s 的轮询,正是 acquire 那侧明令禁止的"把派生搬到不该在的地方"。
 */
export const HEARTBEAT_DEFAULTS = {
  intervalMs: Number(process.env.IHUI_DEPLOY_LOCK_HEARTBEAT_MS || 30_000),
  maxLifetimeMs: Number(process.env.IHUI_DEPLOY_LOCK_HEARTBEAT_MAX_MS || 12 * 3600_000),
  identityEveryTicks: 10,
}

/**
 * 单轮心跳的处置判据 —— 纯函数,不碰文件系统也不派生进程,自检直接喂构造面。
 * @returns {{action:'renew'|'stop'|'release', why:string}}
 */
export function heartbeatAction({
  state,
  mode,
  token,
  watchPid,
  watchAlive,
  identityKind = null,
  ageMs = 0,
  maxLifetimeMs = HEARTBEAT_DEFAULTS.maxLifetimeMs,
} = {}) {
  if (!state || state.kind !== 'ok')
    return { action: 'stop', why: `锁已不在或元数据读不懂(${state?.kind ?? 'no-state'}:${state?.reason ?? ''})⇒ 不重建、不猜` }
  const meta = state.meta
  if (meta.mode !== mode)
    return { action: 'stop', why: `mode 漂了(锁=${meta.mode} 我=${mode})⇒ 已易主,不替别人续期` }
  if (!meta.token)
    return { action: 'stop', why: '旧格式锁没有凭据 ⇒ 归属无从核验,停手(也不删别人的锁)' }
  if (!token)
    return { action: 'stop', why: '调用方没带凭据 ⇒ 无从证明这把锁归我,停手' }
  if (meta.token !== token)
    return { action: 'stop', why: `凭据不符(锁=${maskToken(meta.token)} 我=${maskToken(token)})⇒ 不是我这把锁` }
  if (Number(meta.ownerPid) !== Number(watchPid))
    return { action: 'stop', why: `ownerPid 已漂(锁=${meta.ownerPid} 我盯的=${watchPid})⇒ 已被别人接管` }
  if (watchAlive !== true) return { action: 'release', why: `主人 pid=${watchPid} 已退出 ⇒ 交还锁` }
  if (identityKind === 'mismatch')
    return { action: 'release', why: `pid=${watchPid} 的启动时刻与锁里记的不符 ⇒ 该 pid 已被复用,交还锁` }
  if (ageMs > maxLifetimeMs)
    return {
      action: 'stop',
      why: `心跳已跑满 ${Math.round(ageMs / 3600_000)}h 上限 ⇒ 停止续期(锁按既有年龄线让位;不删 —— 删等于在 dev 仍活着时自己撤保护)`,
    }
  return { action: 'renew', why: `主人 pid=${watchPid} 存活、凭据与归属逐条对上` }
}

/**
 * 心跳主循环。`once: true` 只走一轮(自检与人工排障用),生产档才常驻。
 * 依赖全部可注入(alive / identityOf / sleep / log / dir),所以自检能在临时锁目录上
 * 把五个现场都造出来,而不必真起一个 dev server。
 */
async function heartbeat({
  mode = 'dev',
  token,
  watchPid,
  dir = lockDir(),
  intervalMs = HEARTBEAT_DEFAULTS.intervalMs,
  maxLifetimeMs = HEARTBEAT_DEFAULTS.maxLifetimeMs,
  identityEveryTicks = HEARTBEAT_DEFAULTS.identityEveryTicks,
  once = false,
  now = () => Date.now(),
  alive = isProcessAlive,
  identityOf = null,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = (...a) => console.log(...a),
} = {}) {
  const startedAt = now()
  let ticks = 0
  for (;;) {
    ticks += 1
    const state = readMeta(dir)
    const meta = state.kind === 'ok' ? state.meta : null
    // 只在"归属已对上、正要继续等"的那一格现测身份(identityOf 没注入 ⇒ null ⇒ 维持原判据,
    // 绝不凭"量不到"就多删一把锁)。
    const needIdentity =
      typeof identityOf === 'function' &&
      meta !== null &&
      Number(meta.ownerPid) === Number(watchPid) &&
      (ticks - 1) % Math.max(1, identityEveryTicks) === 0
    const decision = heartbeatAction({
      state,
      mode,
      token,
      watchPid,
      watchAlive: alive(Number(watchPid)),
      identityKind: needIdentity ? identityOf(Number(watchPid)) ?? null : null,
      ageMs: now() - startedAt,
      maxLifetimeMs,
    })
    if (decision.action === 'renew') {
      // 只刷 ts 与身份锚点;ownerPid 与 token 必须原样带回 —— writeMeta 拿不到凭据会现生成
      // 一枚新的,那等于把归属凭据换掉,下一轮自己就不认自己了。
      writeMeta(dir, mode, { ownerPid: Number(watchPid), token })
      log(`[deploy-lock] 心跳已续(${mode} 锁,owner pid=${watchPid},第 ${ticks} 轮):${decision.why}`)
    } else if (decision.action === 'release') {
      const r = release({ mode, token, dir })
      log(
        `[deploy-lock] 心跳收口:${decision.why} ⇒ ${r.released ? '锁已释放' : `没释放(${r.why}),交既有年龄线让位`}`,
      )
      return { action: 'release', why: decision.why, released: r.released }
    } else {
      log(`[deploy-lock] 心跳停止:${decision.why}`)
      return { action: 'stop', why: decision.why }
    }
    if (once) return { action: 'renew', why: decision.why }
    await sleep(intervalMs)
  }
}

/**
 * 只读:这把锁现在是不是这个凭据写下的。
 * 给**生产调用方**用(dev-with-warmup 据此决定要不要派心跳 / 要不要负责释放)——
 * `acquire()` 在"dev+dev 共存"那一档也返回 true 而**没有写 meta**,所以拿到 true
 * 不等于"这把锁是我的"。把归属判据留在锁这一侧,不让调用方去 parse 自己的输出。
 */
export function lockOwnedBy(token, dir = lockDir()) {
  if (typeof token !== 'string' || !token.trim()) return false
  const st = readMeta(dir)
  return st.kind === 'ok' && st.meta.token === token.trim()
}

/**
 * ── 心跳派生的唯一出口(2026-10-02 立,补齐部署锁机制票)──────────────────────────────
 *
 * 2026-10-01 那一轮把"自己持锁 → 派心跳 → 退出交还"整套落在了 `scripts/dev-with-warmup.mjs`
 * (它是 `pnpm dev` 的入口)。本票把**同一套**补到剩下两个入口:`apps/web` 的 `build`(生产构建的
 * npm 入口)与 `dev:clean` / `dev:stable`(手工 dev 逃生档)。派生逻辑只许有这一份 ——
 * 在两个入口各写一遍 spawn 就是本仓记过最多次的"两处算同一件事必漂移"(§22c),而漂移的形态
 * 不是报错,是**其中一个入口的心跳静默没起来、账面却写着"已加心跳"**。
 *
 * 三条不可漂的判读,每条各由自检的一档钉住:
 *  ① **`--watch-pid` 取落盘 meta 里的 ownerPid(现读)**,不是 CLI 自己的 pid、也不是猜的。
 *     `heartbeatAction` 的判序里"`ownerPid` 已漂 ⇒ 已被别人接管 → stop"排在存活判定**之前**,
 *     主体给错就等于心跳每轮都落在 stop:进程真起来了、也真在跑,却一秒都没续过(HB13/HB-M2
 *     的夹具曾以另一种写法踩过这一格,注释留案)。
 *  ② **共存档不派、不释放**:`acquire()` 在 dev+dev 那一档同样返回 true 而**不写 meta**,
 *     所以"拿到 true"不等于"这把锁是我写的"。归属只认 `ownerTokenMemo`(本次进程为这个目录
 *     写下的那份)∧ `lockOwnedBy` 两者同时成立 —— 缺这一层就是替别人的锁永久续期,而那把锁
 *     本来该按年龄线让位。
 *  ③ **legacy 无凭据的锁不派**:meta 里没有 token 时心跳第一轮就因无从核验归属而 stop(HB3),
 *     派它等于白起一个常驻进程,而账面读起来像"这一端已有心跳"。
 *
 * 派生失败**不得**让 acquire / run 本身失败:没有心跳时锁退回既有的"stale + 30min 硬上限"兜底,
 * 那仍然是受保护的,只是保护得粗 —— 把加固的失败变成"不干活"才是把改进做成事故
 * (与 dev-with-warmup 里"心跳起不来照样起 dev"同一条取舍)。但**必须点名**"心跳未起来:<原因>",
 * 不得静默,也不得写成"已续期"(本仓铁律:不能把"没做成"记成"做好了")。
 */

/**
 * 纯判据:这一轮 acquire 之后**该不该**派心跳、派的话 argv 是什么。
 * 不碰文件系统也不派生进程 ⇒ 自检能把"共存档 / legacy / ownerPid 取不出"三个现场都构造出来,
 * 而不必真起一个常驻进程(镜像测试也直接 import 这一份,禁止在测试里重写"什么算该派")。
 */
export function heartbeatSpawnPlan({ mode, dir, token, meta, owned } = {}) {
  const dirResolved = resolve(dir ?? lockDir())
  if (!owned)
    return {
      spawn: false,
      kind: 'not-owned',
      why: '本次没有真的写下这把锁(共存档 / 抢占未成)⇒ 不替别人的锁续期、也不负责释放',
    }
  if (typeof token !== 'string' || !token.trim())
    return {
      spawn: false,
      kind: 'no-credential',
      why: '这把锁没有归属凭据(旧格式)⇒ 心跳第一轮就无从核验归属而停手,不派白跑的进程',
    }
  const watchPid = Number(meta?.ownerPid)
  if (!(watchPid > 0))
    return {
      spawn: false,
      kind: 'no-watch-pid',
      why: `落盘 meta 里取不出有效 ownerPid(${meta?.ownerPid ?? '(缺)'}),判活主体不明 ⇒ 派了也只会每一轮判错`,
    }
  return {
    spawn: true,
    kind: 'spawn',
    watchPid,
    dir: dirResolved,
    file: process.execPath,
    args: [
      SELF_SCRIPT,
      'heartbeat',
      '--mode',
      String(mode ?? ''),
      '--lock-dir',
      dirResolved,
      '--token',
      token.trim(),
      '--watch-pid',
      String(watchPid),
    ],
  }
}

/** 按 plan 真派生(detached + windowsHide + stdio ignore + unref);失败只喊不抛。 */
function spawnHeartbeat({
  mode,
  dir,
  token,
  meta,
  owned,
  spawnFn = spawn,
  log = (...a) => console.log(...a),
  warn = (...a) => console.warn(...a),
} = {}) {
  const plan = heartbeatSpawnPlan({ mode, dir, token, meta, owned })
  if (!plan.spawn) {
    // 共存档那一格是**设计如此**(不是故障)⇒ 中性一行;其余两档是真没起来,必须喊出来。
    if (plan.kind === 'not-owned') log(`[deploy-lock] 未派心跳:${plan.why}`)
    else warn(`[deploy-lock] ⚠️ 心跳未起来:${plan.why}`)
    return { ...plan, spawned: false }
  }
  try {
    const child = spawnFn(plan.file, plan.args, {
      cwd: repoRoot,
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    })
    child?.unref?.()
    log(
      `[deploy-lock] ${mode} 锁心跳已派出(盯 owner pid=${plan.watchPid},主人退出即交还锁;量不到时由硬上限兜底)`,
    )
    return { ...plan, spawned: true, childPid: child?.pid }
  } catch (e) {
    warn(
      `[deploy-lock] ⚠️ 心跳未起来:派生失败(${e?.code ?? e?.message ?? e})⇒ 本轮回到既有"stale + 硬上限"兜底判据(不是已续期)`,
    )
    return { ...plan, spawned: false, error: e }
  }
}

/**
 * CLI 档的 acquire:先按**既有判据**拿锁,然后在"确实是自己写下的那把"时补一个常驻心跳。
 *
 * `withHeartbeat` 为假时**一次额外的读盘、一次派生都不做** —— 这是向后兼容的硬要求:
 * 不带旗的调用方(含 build-next-prod.ps1 与一切历史脚本)必须拿到与改动前逐字同形的落盘 meta
 * 和零派生行为,由自检 AH2/AH3 两档钉住。`dev-with-warmup.mjs` 直接 import `acquire`,
 * 根本不走这个出口,所以它那份心跳不受本票影响。
 */
export async function acquireWithHeartbeatOption(
  {
    mode = 'build',
    timeoutMs = 600_000,
    staleMs = 600_000,
    ownerPid,
    token,
    dir,
    identityRun,
  } = {},
  {
    withHeartbeat = false,
    spawnFn = spawn,
    log = (...a) => console.log(...a),
    warn = (...a) => console.warn(...a),
  } = {},
) {
  await acquire({
    mode,
    timeoutMs,
    staleMs,
    ownerPid,
    token,
    ...(dir ? { dir } : {}),
    ...(identityRun ? { identityRun } : {}),
  })
  if (!withHeartbeat) return { withHeartbeat: false, spawned: false, kind: 'flag-off' }
  const dirResolved = resolve(dir ?? lockDir())
  // 凭据只能来自"本次进程为这个目录写下的那份"(memo),或调用方**显式声明**的那份。
  // 刻意不写"把盘上的 token 读回来再 lockOwnedBy" —— 那把盘上有什么就当什么归我,
  // 归属判据当场归零(共存档那档就会替别人的锁永久续期)。
  const myToken =
    ownerTokenMemo.get(dirResolved) ??
    (typeof token === 'string' && token.trim() ? token.trim() : undefined)
  const st = readMeta(dirResolved)
  const owned = !!myToken && lockOwnedBy(myToken, dirResolved)
  return spawnHeartbeat({
    mode,
    dir: dirResolved,
    token: myToken,
    meta: st.kind === 'ok' ? st.meta : null,
    owned,
    spawnFn,
    log,
    warn,
  })
}

/**
 * 被包装命令的派生与退出码收口(纯 IO,不做任何锁判据)。
 *
 * 三条收口路径必须**共用同一个 settled 闸**,否则会出现"子进程起不来而锁留在原地"
 * 或"close 与 error 各释放一次":
 *   - `spawnFn` 同步抛(参数/路径不可能成立)⇒ 127;
 *   - 子进程 `error` 事件(ENOENT / EACCES,Node 对 spawn 不抛而是发事件)⇒ 不另造码,
 *     等它的 `close`(拿不到 close 时由 signal 分支兜)。**只发 error 不 close** 的极端形态
 *     由这里的 `finish` 兜底:error 里若子进程从没 start 成功,close 仍会跟着来
 *     (Node 文档行为),所以这里只把 error 当"喊出来",不当结论 —— 结论只从 close 取,
 *     避免同一件事被记成两个不同的退出码;
 *   - `close(code, signal)`:code 为 null ⇒ **128+N**,绝不当 0(被 SIGKILL 的构建在账面上
 *     必须是失败,否则 npm 生命周期与 CI 会把"没构建出来"读成"构建成功")。
 * 自己收到 SIGINT/SIGTERM 时把信号转给子进程并走**同一条 finish**(同一次 release)。
 */
function spawnAndCollectRc({ command, env, spawnFn = spawn, warn = () => {} }) {
  return new Promise((res) => {
    let settled = false
    let child = null
    const finish = (rc) => {
      if (settled) return
      settled = true
      for (const sig of Object.keys(handlers)) process.off(sig, handlers[sig])
      res(rc)
    }
    const handlers = {
      SIGINT: () => {
        try {
          child?.kill('SIGINT')
        } catch {
          /* 子进程可能已退:没关系,收口照常走 */
        }
        finish(128 + SIGNAL_EXIT_CODE.SIGINT)
      },
      SIGTERM: () => {
        try {
          child?.kill('SIGTERM')
        } catch {
          /* 同上 */
        }
        finish(128 + SIGNAL_EXIT_CODE.SIGTERM)
      },
    }
    try {
      // 不带 shell:命令与参数逐字传给 spawn,免得 `--` 后面那些本是要给真命令的引号/竖线
      // 被 shell 二次解释(而 run 的语义恰恰是"我要跑的就是这几个 argv")。
      child = spawnFn(command[0], command.slice(1), { stdio: 'inherit', windowsHide: true, env })
    } catch (e) {
      warn(
        `[deploy-lock] run:命令派生失败(${e?.code ?? e?.message ?? e})⇒ 不跑命令,直接把锁收口`,
      )
      finish(127)
      return
    }
    child.on?.('error', (e) => {
      warn(`[deploy-lock] run:子进程异常(${e?.code ?? e?.message ?? e})——退出码取自它的 close`)
    })
    child.on?.('close', (code, signal) => {
      if (typeof code === 'number') return finish(code)
      finish(128 + (SIGNAL_EXIT_CODE[signal] ?? 1))
    })
    for (const [sig, h] of Object.entries(handlers)) process.on(sig, h)
  })
}

/**
 * `run` 子命令的内核:**自己持锁 → 派心跳 → 跑命令 → 命令一退出就带凭据交还**。
 *
 * 补的是 `pnpm --filter @ihui/web build` 那条入口上的实测缺陷(2026-10-02 核实现形):
 * 它原先在 `prebuild` 里 acquire,而 prebuild 是**另一条**npm 生命周期脚本 —— 它的 shell
 * 在 `build` 开始之前就退了,于是整个 `next build` 期间那把锁的 owner 是个已死进程,
 * 按"持有者已退出的悬挂锁不限锁龄立即抢占"这条**现行**规则,任何后来者都能秒抢 ——
 * 即这条入口上的构建**实际上没有被保护**(8-09 那两个构建同时写 `.next` ⇒ 8801 短暂 502
 * 的那一型今天在这条入口上仍可发生),而账面看起来有锁。
 * 把锁与命令放进同一个进程,才让"锁活着"与"构建活着"变成同一件事。
 *
 * 再入守卫(`IHUI_DEPLOY_LOCK_HELD`,由本函数注入子进程环境,值 = `mode:token`):
 * 上层已经持这把锁时,子层**绝不再 acquire 第二次** —— 同 mode 互斥 ⇒ 它会等自己,
 * 600s 后超时抛错,即一次纯粹的自锁。与根 `package.json` 的 typecheck 再入守卫
 * (`IHUI_TYPECHECK_FULL_CHILD`,§5b 记的 24.6 万 cmd/2min fork 风暴)是同一条设计。
 *
 * Linux/CI 兼容:身份探针(PowerShell)拿不到时 writeMeta 整键不写 ⇒ 读侧落
 * `unverifiable` = **维持改动前判据**,不因此判失败(自检/镜像都不为此开绿灯也不开红灯)。
 */
export async function runUnderLock({
  mode = 'build',
  timeoutMs = 600_000,
  staleMs = 600_000,
  dir,
  command,
  env = process.env,
  spawnFn = spawn,
  heartbeatSpawnFn = spawnFn,
  pid = process.pid,
  log = (...a) => console.log(...a),
  warn = (...a) => console.warn(...a),
} = {}) {
  if (
    !Array.isArray(command) ||
    command.length === 0 ||
    command.some((x) => typeof x !== 'string' || x === '')
  ) {
    throw new Error(
      '[deploy-lock] run:`--` 之后必须给出要执行的命令与参数(至少一个非空项)。本次未拿锁。',
    )
  }
  const dirResolved = resolve(dir ?? lockDir())
  const held = typeof env.IHUI_DEPLOY_LOCK_HELD === 'string' && env.IHUI_DEPLOY_LOCK_HELD.trim() !== ''
  if (held) {
    log(
      `[deploy-lock] run:检测到 IHUI_DEPLOY_LOCK_HELD=${env.IHUI_DEPLOY_LOCK_HELD.trim()} ⇒ 上层已持这把锁,本次不再 acquire、也不负责释放`,
    )
    return {
      rc: await spawnAndCollectRc({ command, env: { ...env }, spawnFn, warn }),
      owned: false,
      reentrant: true,
    }
  }
  const myToken = randomBytes(16).toString('hex')
  await acquire({
    mode,
    timeoutMs,
    staleMs,
    ownerPid: pid,
    token: myToken,
    ...(dir ? { dir } : {}),
  })
  const st = readMeta(dirResolved)
  const owned = lockOwnedBy(myToken, dirResolved)
  const heartbeat = spawnHeartbeat({
    mode,
    dir: dirResolved,
    token: myToken,
    meta: st.kind === 'ok' ? st.meta : null,
    owned,
    spawnFn: heartbeatSpawnFn,
    log,
    warn,
  })
  let released = false
  const releaseOnce = () => {
    if (released) return
    released = true
    try {
      const r = release({ mode, token: myToken, ...(dir ? { dir } : {}) })
      if (!r.released)
        warn(
          `[deploy-lock] run:锁没有释放(${r.why})⇒ 交既有年龄线 / break-stale 收口,本命令不把它读成已收口`,
        )
      else log(`[deploy-lock] run:锁已交还(${mode})`)
    } catch (e) {
      warn(
        `[deploy-lock] run:释放抛异常(${e?.code ?? e?.message ?? e})——锁留在原地等下一位按 stale 收口`,
      )
    }
  }
  // 最后一道网:任何一条**绕过**上面 try/finally 的退出路径(process.exit、未捕获异常)
  // 也不能把锁留在原地。release 是同步的 ⇒ 'exit' 阶段跑得动;released 闸保证不重复。
  process.on('exit', releaseOnce)
  try {
    const rc = await spawnAndCollectRc({
      command,
      env: { ...env, IHUI_DEPLOY_LOCK_HELD: `${mode}:${myToken}` },
      spawnFn,
      warn,
    })
    releaseOnce()
    process.off('exit', releaseOnce)
    return { rc, owned, heartbeat, reentrant: false }
  } catch (e) {
    releaseOnce()
    process.off('exit', releaseOnce)
    throw e
  }
}

/** 只读检查:exit 0=无锁,1=有锁(不可判定态必须如实喊出"无法判定",禁止打印成空字段) */
function check({
  dir = lockDir(),
  log = (...a) => console.log(...a),
  // G-412:单调对账只读 `os.uptime()`(进程内系统调用,**不派生 PowerShell**,与 S48
  // "check 不现测身份"的纪律不冲突 —— 那条禁的是派生,不是本地读数)。可注入仅供测试。
  now = Date.now(),
  uptimeMs = uptime() * 1000,
  localHost = hostname(),
} = {}) {
  if (!existsSync(dir)) return 0
  const state = readMeta(dir)
  const age = lockAgeMs(dir, state, now)
  if (state.kind === 'ok') {
    const alive = isProcessAlive(holderPid(state.meta))
    const mono = monotonicAgeVerdict({ meta: state.meta, now, uptimeMs, localHost })
    // 身份两元**只如实打印锁里记着什么**,不在这里现测(见头注:check 是只读快路径)。
    const id = ` host=${state.meta.host || '(未记)'} pidStart=${state.meta.pidStart || '(未记)'} bootMs=${state.meta.bootMs || '(未记)'}`
    // G-412 红线:ts 不可信不得被读成"锁很新"。点名未来多少秒 + 出路,不许静默恒等。
    const clockNote = age.clockAnomalous
      ? ` ⇒ ⚠️ ${age.source};出路:下一次 acquire 会按"年龄维失效"归档现场后抢占,人工出口 \`deploy-lock.mjs break-stale --reason "<理由>"\``
      : mono.kind === 'contradiction' && mono.mode === 'session-ended'
        ? ` ⇒ ⚠️ 单调判据:${mono.why};这把锁在本次开机里不可能还活着,下一次 acquire 会归档并抢占`
        : ''
    log(
      `locked: mode=${state.meta.mode} pid=${state.meta.pid}${Number(state.meta.ownerPid) > 0 ? ` ownerPid=${state.meta.ownerPid}` : ''} 判活对象=${holderPid(state.meta)}${id} alive=${alive} ts=${state.meta.ts ? new Date(state.meta.ts).toISOString() : '(无)'} age=${age.ageMs}ms 锁龄来源=${age.source}` +
        (age.clockAnomalous
          ? clockNote
          : alive && age.ageMs > HARD_CAP_MS
            ? ` ⇒ ⚠️ 名义存活而锁龄超硬上限 ${HARD_CAP_MS}ms:该 pid 极可能已被复用,acquire 侧会归档并抢占`
            : mono.kind === 'contradiction' && mono.mode === 'session-ended'
              ? clockNote
              : state.meta.pidStart
                ? '(check 只读:未现测启动时间,身份未对账)'
                : '(旧 meta 无 pidStart ⇒ 身份无从对账,acquire 侧维持原判据)') +
        (mono.kind === 'unverifiable' && !age.clockAnomalous
          ? `;单调对账=无法核对(${mono.reason})⇒ 不据此下任何结论,不是"已核过没问题"`
          : ''),
    )
    return 1
  }
  log(
    `locked: 无法判定(${state.kind})——原因:${state.reason}。` +
      `锁龄 ${age.ageMs}ms(来源:${age.source})。` +
      `注意:这不是"没有进程持锁",也不是"持锁进程已退出";` +
      'acquire 侧不会凭猜测删锁;自动出路:锁龄超 stale 阈值后归档并抢占(年龄读数被倒挂钉死时另走独立档,同样先归档再抢)。' +
      (age.clockAnomalous
        ? `另:锁目录 mtime 的读数本身异常(${age.source})——年龄维被**时钟倒挂档**接管而非无限 wait:下一次 acquire 会先归档现场再抢占;人工出口 \`deploy-lock.mjs break-stale --reason "<理由>"\`。`
        : ''),
  )
  return 1
}

/**
 * G-412 人工出口 `break-stale` —— **显式、带理由、留现场**的断锁动作。
 *
 * 为什么自动出路之外还要这一格:单调/墙钟判据把"不可信"喊出来之后,出路仍要过 acquire 的
 * 轮询与二次确认;而当判据落在 unverifiable(别机持有、旧 meta 无凭据)时自动档**刻意**不抢
 * —— 那时现场只剩两条路:继续无限等(= G-193 那一型),或人确认后显式断锁。
 * 红线:① 必须带 `--reason`(空理由即拒绝,一个字都不碰锁);② 动手前先归档现场,归档失败
 * 即放弃(与 acquire 同一条"不得静默覆盖"的纪律);③ 删除只走 `claimStaleLock` 的原子改名,
 * 绝不 `removeLock`(判与删之间别人可能已换新锁 —— 8-09 两个构建同写 .next 的那一型)。
 */
function breakStale({ dir = lockDir(), reason, log = (...a) => console.log(...a) } = {}) {
  const why = typeof reason === 'string' ? reason.trim() : ''
  if (!why)
    return {
      ok: false,
      why: '拒绝:断锁是破坏性动作,必须给 --reason "<人读得懂的理由>"(空理由不改任何状态)',
    }
  if (!existsSync(dir))
    return { ok: true, why: `无锁可断:${dir} 不存在,未创建、未删除任何东西` }
  const state = readMeta(dir)
  const age = lockAgeMs(dir, state)
  // 现场说明里带上此刻的单调对账结论 —— 人工断的往往正是"判不出"的锁,现场档必须说清当时看到了什么。
  const mono =
    state.kind === 'ok'
      ? monotonicAgeVerdict({ meta: state.meta, now: Date.now(), uptimeMs: uptime() * 1000, localHost: hostname() })
      : { kind: 'unverifiable', reason: `元数据不可判定(${state.kind})⇒ 单调对账无从下手` }
  const archived = archiveScene(
    dir,
    { ...state, ageMs: age.ageMs, ageSource: age.source },
    `人工 break-stale(理由:${why};单调对账=${mono.kind}${mono.reason ? `:${mono.reason}` : mono.why ? `:${mono.why}` : ''})`,
  )
  if (archived === null)
    return { ok: false, why: `拒绝:归档现场失败,不得静默覆盖(原始 meta 已逐字打到 stderr),锁 ${dir} 未被触碰` }
  const claim = claimStaleLock(
    dir,
    state,
    `人工 break-stale:${why}(执行前四态=${state.kind},锁龄 ${age.ageMs}ms 来源 ${age.source})`,
    { suffix: 'break-stale' },
  )
  log(claim.log)
  return { ok: claim.ok, why: claim.ok ? `已断锁,现场=${claim.archived}` : `未断:${claim.log}` }
}

/**
 * 自检:全部在临时夹具里跑(scripts/lib/scratch-dir.mjs),
 * **绝不允许**触碰真实仓库根的 .deploy.lock(那是并发会话正在用的锁)。
 * 归档面也用 IHUI_DEPLOY_LOCK_ARCHIVE_DIR 指进夹具,避免测试往仓库写现场。
 */
async function runSelfTest() {
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const base = mkScratch('deploy-lock-selftest-')
  process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = join(base, 'scene')
  const results = []
  let seq = 0
  const freshDir = () => {
    const d = join(base, `lock-${++seq}`)
    mkdirSync(d, { recursive: true })
    return d
  }
  const putMeta = (dir, text) => {
    // 夹具也走**同一个出口**(2026-09-29,G-653):用例写出的那份 meta 必须与生产写出的那份
    // 同一条落盘路径,否则"四态判据对真实写入形态成立"这件事从来没被测过。
    atomicWriteFileSync(metaFile(dir), text)
    return text
  }
  const findDeadPid = () => {
    for (let p = 999_000; p < 1_200_000; p += 11) if (!isProcessAlive(p)) return p
    throw new Error('夹具需要一个确定已死的 pid,但未找到')
  }
  const DEAD_PID = findDeadPid()
  const t = (name, cond, detail = '') => {
    results.push({ name, ok: !!cond, detail })
    console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` — ${detail || '断言不成立'}`}`)
  }
  const elapsed = async (fn) => {
    const s = Date.now()
    const r = await fn()
    return { ms: Date.now() - s, r }
  }

  try {
    // —— 1) 四态勘验(纯判据)
    t('S01 absent:meta.json 不存在 ⇒ absent', classifyMeta(null).kind === 'absent')
    t(
      'S02 ok:完好元数据 ⇒ ok',
      classifyMeta(JSON.stringify({ mode: 'build', pid: 4321, ts: 1_700_000_000_000 })).kind ===
        'ok',
    )
    t('S03 invalid:空文件 ⇒ invalid(不得当成 absent)', classifyMeta('').kind === 'invalid')
    t('S04 invalid:全空白 ⇒ invalid', classifyMeta('   \n').kind === 'invalid')
    t('S05 invalid:半个 JSON ⇒ invalid', classifyMeta('{"mode":"build","pid":').kind === 'invalid')
    t('S06 invalid:顶层是数组 ⇒ invalid', classifyMeta('[1,2]').kind === 'invalid')
    t(
      'S07 invalid:缺 pid ⇒ invalid(无法判定持有者)',
      classifyMeta('{"mode":"build"}').kind === 'invalid',
    )
    t(
      'S08 invalid:pid 非法(0/字符串) ⇒ invalid',
      classifyMeta('{"pid":"abc"}').kind === 'invalid' &&
        classifyMeta('{"pid":0}').kind === 'invalid',
    )
    t(
      'S09 ok:缺 ts 仍算 ok(活性靠 pid,锁龄可降级)',
      classifyMeta('{"mode":"dev","pid":99}').kind === 'ok',
    )
    t(
      'S10 absent 与 invalid 必须是不同态(处置动作不同)',
      classifyMeta(null).kind !== classifyMeta('x').kind,
    )

    // —— 2) unreadable 与 absent 的分界:meta.json 位置放一个目录
    const unDir = freshDir()
    mkdirSync(metaFile(unDir), { recursive: true })
    t(
      'S11 unreadable:meta.json 是目录 ⇒ unreadable(不是 absent)',
      readMeta(unDir).kind === 'unreadable',
    )
    // S11b 是"把 invalid/unreadable 在 readMeta 层折叠成 absent"这一变异**唯一能看见**的地方:
    // classifyMeta 仍分得清,而 check 的 else 分支对三态都喊"无法判定" —— 只有态名会露馅。
    const collapseDir = freshDir()
    putMeta(collapseDir, '{"mode":"build","pid":')
    t(
      'S11b readMeta 层也不得把 invalid 折叠成 absent(变异对照的落点)',
      readMeta(collapseDir).kind === 'invalid',
    )
    const collapse2 = freshDir()
    putMeta(collapse2, '')
    t('S11c 空文件在 readMeta 层仍是 invalid(不是 absent)', readMeta(collapse2).kind === 'invalid')

    // —— 3) 无锁 ⇒ 直接获取
    const d3 = join(base, 'no-lock')
    const r3 = await elapsed(() => acquire({ mode: 'build', timeoutMs: 3000, dir: d3 }))
    t('S12 absent(连锁目录都没有)⇒ acquire 秒成功', r3.r === true && r3.ms < 2000, `ms=${r3.ms}`)
    t('S13 获取后 meta.json 记录了自己 pid', readMeta(d3).meta?.pid === process.pid)
    t(
      'S13b acquire 写下的 meta 带 owner token(G-696:release 归属核验的凭据必须落盘)',
      typeof readMeta(d3).meta?.token === 'string' && readMeta(d3).meta.token.length >= 16,
      JSON.stringify(readMeta(d3).meta?.token),
    )

    // —— 4) 完好 + 持有者存活 ⇒ 等待并超时,且**绝不覆盖别人的锁**
    const d4 = freshDir()
    const raw4 = putMeta(d4, JSON.stringify({ mode: 'build', pid: process.pid, ts: Date.now() }))
    let err4 = null
    const r4 = await elapsed(async () => {
      try {
        await acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir: d4 })
        return 'no-throw'
      } catch (e) {
        err4 = e
        return 'threw'
      }
    })
    t(
      'S14 活持有者 ⇒ 不抢占(等待后超时)',
      r4.r === 'threw' && r4.ms >= 900,
      `r=${r4.r} ms=${r4.ms}`,
    )
    t('S15 活持有者 ⇒ 锁的字节一字未变', readFileSync(metaFile(d4), 'utf8') === raw4)
    t(
      'S16 超时文案不得出现"会自动抢占"的假承诺',
      !/会自动抢占/.test(err4?.message ?? ''),
      err4?.message,
    )

    // —— 5) 回归对照:强杀 dev 树后立即重启(持有者已退出 + 锁龄 1s ⇒ 必须秒抢占)
    const d5 = freshDir()
    putMeta(d5, JSON.stringify({ mode: 'dev', pid: DEAD_PID, ts: Date.now() - 1000 }))
    const r5 = await elapsed(() =>
      acquire({ mode: 'dev', timeoutMs: 600_000, staleMs: 600_000, dir: d5 }),
    )
    t(
      'S17 持有者已退出 + 锁龄 1s + stale=600s ⇒ 秒抢占(2026-08-27 行为保住)',
      r5.r === true && r5.ms < 4000,
      `ms=${r5.ms}`,
    )
    t(
      'S18 秒抢占前已归档现场',
      existsSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR) &&
        readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).length >= 1,
    )

    // —— 6/7) invalid:半截 JSON ⇒ 不得立即抢占;超 stale 才归档抢占
    for (const [tag, bad] of [
      ['JSON6', '{"mode":"build","pid":'],
      ['EMPTY', ''],
      ['NOPID', JSON.stringify({ mode: 'build', ts: 1 })],
    ]) {
      const dirA = freshDir()
      putMeta(dirA, bad)
      const ageA = lockAgeMs(dirA, readMeta(dirA)).ageMs
      let errA = null
      await acquire({ mode: 'build', timeoutMs: 900, staleMs: ageA + 600_000, dir: dirA }).catch(
        (e) => (errA = e),
      )
      t(`S19-${tag} 不可判定 + 未超 stale ⇒ 不抢占(超时)`, !!errA && existsSync(metaFile(dirA)))
      t(
        `S20-${tag} 超时文案如实写"无法判定"、点名真实出路、且不得谎称"文件不存在"`,
        /无法判定/.test(errA?.message ?? '') &&
          /stale/.test(errA?.message ?? '') &&
          !/不存在/.test(errA?.message ?? ''),
        errA?.message,
      )

      const dirB = freshDir()
      const rawB = putMeta(dirB, bad)
      const ageB = lockAgeMs(dirB, readMeta(dirB)).ageMs
      const rB = await acquire({
        mode: 'build',
        timeoutMs: 5000,
        staleMs: Math.max(-1, ageB - 1),
        dir: dirB,
      })
      t(`S21-${tag} 不可判定 + 已超 stale ⇒ 归档后抢占成功`, rB === true)
      const archived = readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).some((n) => {
        const f = join(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR, n, 'meta.json')
        try {
          return readFileSync(f, 'utf8') === rawB
        } catch {
          return false
        }
      })
      t(`S22-${tag} 现场按**原字节**归档(坏内容原样留档)`, archived)
    }

    // —— 8) unreadable 与 invalid 同样不得白拿
    const d8 = freshDir()
    mkdirSync(metaFile(d8), { recursive: true })
    let err8 = null
    await acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir: d8 }).catch(
      (e) => (err8 = e),
    )
    t(
      'S23 unreadable ⇒ 不立即抢占且文案给真实出路',
      !!err8 && /无法判定/.test(err8.message),
      err8?.message,
    )

    // —— 9) 目录在而 meta 从未写下(absent 态):不得当成"无人持锁"秒删
    const d9 = freshDir()
    let err9 = null
    await acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir: d9 }).catch(
      (e) => (err9 = e),
    )
    t(
      'S24 空锁目录(absent)未超 stale ⇒ 不等价于"无人持锁",不删别人正在创建的锁',
      !!err9 && existsSync(d9),
    )

    // —— 10) check 三态如实输出
    const lineOf = (dir) => {
      let out = ''
      check({ dir, log: (s) => (out += s) })
      return out
    }
    t('S25 check:无锁 ⇒ exit 0', check({ dir: join(base, 'nothing'), log: () => {} }) === 0)
    t('S26 check:ok+存活 ⇒ exit 1 且打印 pid/alive', lineOf(d4).includes('alive=true'))
    const badChk = freshDir()
    putMeta(badChk, '{"mode":"build","pid":')
    const chk = lineOf(badChk)
    t(
      'S27 check:invalid ⇒ 输出含"无法判定"与原因**且点名态名**',
      chk.includes('无法判定') && chk.includes('invalid') && chk.includes('JSON'),
      chk,
    )
    t(
      'S28 check:invalid ⇒ 禁止打印成空字段形态(旧版 "mode= pid= ts=")',
      !/mode=\s+pid=\s+alive=/.test(chk) && !/ts=\s*$/.test(chk),
      chk,
    )
    t('S29 check:unreadable ⇒ 同样喊"无法判定"', lineOf(d8).includes('无法判定'))

    // —— 30) release 不得"坏锁白拿"
    const d10 = freshDir()
    putMeta(d10, 'not json at all')
    const rel10 = release({ mode: 'build', dir: d10 })
    t(
      'S30 release:元数据不可判定 ⇒ 拒绝释放,锁目录仍在',
      rel10.released === false && existsSync(d10),
    )
    const rel11 = release({ mode: 'build', dir: d3 })
    t('S31 release:持有者是自己 ⇒ 释放成功', rel11.released === true && !existsSync(d3))
    const d12 = freshDir()
    putMeta(d12, JSON.stringify({ mode: 'build', pid: DEAD_PID, ts: Date.now() }))
    const rel12 = release({ mode: 'build', dir: d12 })
    t('S32 release:悬挂锁(持有者已死)可代为收口', rel12.released === true && !existsSync(d12))

    // —— 32b..e) G-696:release 必须比对 owner token(旧口径"按 mode 匹配即视为可释放"
    // 让同 mode 的第二条 CLI 能把第一条正在用的锁当悬挂锁删掉 —— predev 父 shell 先退、
    // pid 被复用都是现成入口)。带 token 的锁,凭据对不上(**含根本没带**)就必须拒绝且不删锁。
    const TOKEN_OK = 'selftest-token-ok-696'
    const d12b = freshDir()
    putMeta(
      d12b,
      JSON.stringify({ mode: 'build', pid: DEAD_PID, ts: Date.now(), token: TOKEN_OK }),
    )
    const rel12b = release({ mode: 'build', dir: d12b, token: 'selftest-token-wrong' })
    t(
      'S32b release:token 不匹配 ⇒ 拒绝且锁仍在(不得静默成功)',
      rel12b.released === false && existsSync(d12b) && /owner token 不匹配/.test(rel12b.why),
      JSON.stringify(rel12b),
    )
    const rel12c = release({ mode: 'build', dir: d12b, token: TOKEN_OK })
    t(
      'S32c release:token 匹配 ⇒ 悬挂锁凭凭据代为收口成功',
      rel12c.released === true && !existsSync(d12b),
      JSON.stringify(rel12c),
    )
    const d12d = freshDir()
    putMeta(
      d12d,
      JSON.stringify({ mode: 'build', pid: DEAD_PID, ts: Date.now(), token: TOKEN_OK }),
    )
    const rel12d = release({ mode: 'build', dir: d12d })
    t(
      'S32d release:锁带 token 而调用方未带 ⇒ 同样视为不匹配,拒绝且锁仍在',
      rel12d.released === false && existsSync(d12d) && /owner token 不匹配/.test(rel12d.why),
      JSON.stringify(rel12d),
    )
    const d12e = freshDir()
    putMeta(d12e, JSON.stringify({ mode: 'build', pid: DEAD_PID, ts: Date.now() }))
    const rel12e = release({ mode: 'build', dir: d12e, token: TOKEN_OK })
    t(
      'S32e release:旧格式锁(无 token 字段)⇒ 归属无法核验,按既有判据处置(此处 = 悬挂锁代为收口)',
      rel12e.released === true && !existsSync(d12e),
      JSON.stringify(rel12e),
    )

    // —— 33) dev+dev 共存语义不得回归
    const d13 = freshDir()
    putMeta(d13, JSON.stringify({ mode: 'dev', pid: process.pid, ts: Date.now() }))
    const r13 = await acquire({ mode: 'dev', timeoutMs: 900, dir: d13 })
    t('S33 dev+dev 共存仍然放行', r13 === true)
    // —— 34) 创建锁本身失败(非 EEXIST)必须当场报错,不得退化成"死等一把自己建不出来的锁"
    let err34 = null
    await acquire({
      mode: 'build',
      timeoutMs: 1500,
      dir: join(base, 'no-such-parent', 'lock'),
    }).catch((e) => (err34 = e))
    t(
      'S34 mkdir 非 EEXIST 失败 ⇒ 立刻报错并点名错误码(不进死等)',
      !!err34 && /创建\/写入锁/.test(err34.message) && /ENOENT/.test(err34.message),
      err34?.message ?? '未抛错',
    )

    // —— 35) pid 复用:名义存活 + 锁龄超硬上限 ⇒ 不得无限 wait(2026-09-25 部署环冻结 11h50m 那一格)
    const d35 = freshDir()
    putMeta(
      d35,
      JSON.stringify({ mode: 'build', pid: process.pid, ts: Date.now() - HARD_CAP_MS - 10_000 }),
    )
    const dec35 = decideSteal({ dir: d35, mode: 'build', staleMs: 600_000, hardCapMs: HARD_CAP_MS })
    t(
      'S35 持有者是自己 CLI pid 且"存活",但锁龄超硬上限 ⇒ steal(pid 复用兜底)而不是 wait',
      dec35.action === 'steal' && /硬上限/.test(dec35.why),
      `${dec35.action} / ${dec35.why}`,
    )
    // —— 36) 同一把锁在硬上限**之内**不得被抢(否则就是把活人的构建打断)
    const d36 = freshDir()
    putMeta(d36, JSON.stringify({ mode: 'build', pid: process.pid, ts: Date.now() - 60_000 }))
    const dec36 = decideSteal({ dir: d36, mode: 'build', staleMs: 600_000, hardCapMs: HARD_CAP_MS })
    t('S36 锁龄在上限内且持有者存活 ⇒ wait(硬上限不得变成新的秒抢判据)', dec36.action === 'wait', dec36.why)
    // —— 37) ownerPid 才是判活对象:CLI pid 已退而 owner 仍活 ⇒ 不得抢占
    const d37 = freshDir()
    putMeta(
      d37,
      JSON.stringify({ mode: 'build', pid: DEAD_PID, ownerPid: process.pid, ts: Date.now() }),
    )
    const dec37 = decideSteal({ dir: d37, mode: 'build', staleMs: 600_000, hardCapMs: HARD_CAP_MS })
    t(
      'S37 有 ownerPid 时按 owner 判活:CLI pid 死了而 owner 活着 ⇒ wait',
      dec37.action === 'wait' && /owner pid/.test(dec37.why),
      `${dec37.action} / ${dec37.why}`,
    )
    // —— 38) writeMeta 必须把 owner 落进 meta.json(否则判活退化成 CLI 自己那把死 pid)
    const d38 = freshDir()
    mkdirSync(d38, { recursive: true })
    writeMeta(d38, 'build', { ownerPid: 4242 })
    const m38 = JSON.parse(readFileSync(metaFile(d38), 'utf8'))
    t('S38 writeMeta 记录 ownerPid', m38.ownerPid === 4242 && Number(m38.pid) === process.pid, JSON.stringify(m38))
    t('S39 holderPid:有 owner 用 owner,没有退回 CLI pid', holderPid({ pid: 7, ownerPid: 4242 }) === 4242 && holderPid({ pid: 7, ownerPid: 0 }) === 7)

    // —— 39a..39c) 未声明 owner 时**不得**再拿"本次 CLI 自己"当判活主体(2026-09-28 实测
    // `ownerPid=0` 的锁一落地就是"持有者已退出",而悬挂死锁不限锁龄立即抢占 ⇒ 别人正在跑的构建被秒抢,
    // 正是 8-09 两次构建同时写 .next 那一型)。现改为按派生本次调用的父进程判活,并显式标明非确证。
    const d39a = freshDir()
    mkdirSync(d39a, { recursive: true })
    writeMeta(d39a, 'build', { ownerPid: 4242, ppid: 999, run: () => null })
    const m39a = JSON.parse(readFileSync(metaFile(d39a), 'utf8'))
    t(
      'S39a 声明了 owner ⇒ 推断不得覆盖它,且不写 ownerPidSource(落盘键集与改动前同形)',
      m39a.ownerPid === 4242 && m39a.ownerPidSource === undefined,
      JSON.stringify(m39a),
    )
    const d39b = freshDir()
    mkdirSync(d39b, { recursive: true })
    writeMeta(d39b, 'build', { ppid: 999, run: () => null })
    const m39b = JSON.parse(readFileSync(metaFile(d39b), 'utf8'))
    t(
      'S39b 未声明 owner ⇒ 按父进程判活并打 inferred-ppid(不是确证)',
      m39b.ownerPid === 999 && m39b.ownerPidSource === 'inferred-ppid' && holderPid(m39b) === 999,
      JSON.stringify(m39b),
    )
    const d39c = freshDir()
    mkdirSync(d39c, { recursive: true })
    writeMeta(d39c, 'build', { ppid: 0, run: () => null })
    const m39c = JSON.parse(readFileSync(metaFile(d39c), 'utf8'))
    t(
      'S39c 父进程也量不到 ⇒ 退回改动前形态(ownerPid=0 / 无 source 键 / 判活问 CLI pid),不得凭空造主体',
      m39c.ownerPid === 0 && m39c.ownerPidSource === undefined && holderPid(m39c) === Number(m39c.pid),
      JSON.stringify(m39c),
    )

    // —— 40..45) 进程身份三元组的接线(2026-09-27;全部用注入的假 run,绝不为取证真派生 PowerShell)
    const SELF_START = 1_780_000_000
    const fakeRun = (offsetSec = 0) => () => String(SELF_START + offsetSec)
    // 40 写侧:self 主体 ⇒ pidStart 落盘且等于注入值;host 落盘
    const d40 = freshDir()
    mkdirSync(d40, { recursive: true })
    writeMeta(d40, 'build', { run: fakeRun(0) })
    const m40 = JSON.parse(readFileSync(metaFile(d40), 'utf8'))
    t(
      'S40 writeMeta 落身份三元组(host + pidStart),且 pidStart 是"判活主体"的而非随便谁的',
      m40.pidStart === SELF_START && typeof m40.host === 'string' && m40.host.length > 0,
      JSON.stringify(m40),
    )
    // 41 owner 主体:ownerPid 存在 ⇒ pidStart 必须量 owner(假 run 按 pid 分支,能验出错位)
    const d41 = freshDir()
    mkdirSync(d41, { recursive: true })
    writeMeta(d41, 'build', {
      ownerPid: 4242,
      run: (pid) => {
        if (Number(pid) !== 4242) throw new Error(`量错了主体:${pid}`)
        return String(SELF_START + 7)
      },
    })
    const m41 = JSON.parse(readFileSync(metaFile(d41), 'utf8'))
    t(
      'S41 有 ownerPid 时 pidStart 量的是 owner(量 CLI 自己会让每次对账都假报 mismatch)',
      m41.pidStart === SELF_START + 7,
      JSON.stringify(m41),
    )
    // 42 读侧:classifyMeta 必须把 host/pidStart 归一带出,否则判据拿不到凭据
    const m42 = classifyMeta(JSON.stringify({ mode: 'build', pid: 4321, ts: 1, host: 'H', pidStart: 99 }))
    t(
      'S42 classifyMeta 带出 host/pidStart(旧 meta 则归零 = 无从对账)',
      m42.kind === 'ok' && m42.meta.host === 'H' && m42.meta.pidStart === 99,
      JSON.stringify(m42),
    )
    const m42b = classifyMeta('{"mode":"build","pid":4321,"ts":1}')
    t(
      'S42b 旧 meta(无身份两元)⇒ host="" pidStart=0 ⇒ 只可能落 unverifiable,不得被读成"已核过"',
      m42b.meta.host === '' && m42b.meta.pidStart === 0,
      JSON.stringify(m42b.meta),
    )
    // 43 判据侧:mismatch ⇒ steal(且不秒抢,先归档)
    const d43 = freshDir()
    putMeta(
      d43,
      JSON.stringify({
        mode: 'build',
        pid: process.pid,
        ts: Date.now(),
        host: hostname(),
        pidStart: SELF_START - 600,
      }),
    )
    const dec43 = decideSteal({
      dir: d43,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      identity: { kind: 'mismatch', why: '夹具注入:记录与现测差 600s' },
    })
    t(
      'S43 名义存活 + 未超硬上限 + 身份确证复用 ⇒ steal(新授权)',
      dec43.action === 'steal' && /身份三元组确证/.test(dec43.why),
      `${dec43.action} / ${dec43.why}`,
    )
    t('S43b 这一档必须先归档现场(immediate:false),不走"持有者已退出"的秒抢通道', dec43.immediate === false)
    // 44 反向对照:同一个夹具,把 mismatch 换成 match ⇒ 必须回到 wait(证明红的是身份,不是夹具)
    const dec44 = decideSteal({
      dir: d43,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      identity: { kind: 'match', delta: 0 },
    })
    t('S44 同面 identity=match ⇒ wait(身份不得变成秒抢判据)', dec44.action === 'wait', dec44.why)
    const dec44b = decideSteal({ dir: d43, mode: 'build', staleMs: 600_000, hardCapMs: HARD_CAP_MS })
    t(
      'S44b 不传 identity ⇒ 与改动前逐字同结论(wait),新接线不得自己长出授权',
      dec44b.action === 'wait' && /身份对账=未做/.test(dec44b.why),
      dec44b.why,
    )
    // 45 端到端:acquire 真跑一次"确证复用 ⇒ 抢占并归档",以及"量不到 ⇒ 不抢且喊出原因"
    const d45 = freshDir()
    putMeta(
      d45,
      JSON.stringify({
        mode: 'build',
        pid: process.pid,
        ts: Date.now(),
        host: hostname(),
        pidStart: SELF_START - 900,
      }),
    )
    const r45 = await acquire({
      mode: 'build',
      timeoutMs: 5000,
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      ownerPid: process.pid,
      dir: d45,
      identityRun: fakeRun(0),
    })
    t(
      'S45 端到端:注入假 run 现测出不同启动时间 ⇒ 立即抢占成功(不必等 30min 硬上限)',
      r45 === true,
      String(r45),
    )
    t(
      'S45b 抢占后 meta 是自己的、且现场已归档',
      readMeta(d45).kind === 'ok' &&
        readMeta(d45).meta.pid === process.pid &&
        existsSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR) &&
        readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).length >= 1,
    )
    const d46 = freshDir()
    putMeta(
      d46,
      JSON.stringify({
        mode: 'build',
        pid: process.pid,
        ts: Date.now(),
        host: hostname(),
        pidStart: SELF_START,
      }),
    )
    let err46 = null
    await acquire({
      mode: 'build',
      timeoutMs: 900,
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      dir: d46,
      identityRun: () => {
        // 刻意不设 e.code:verifyHolder 拼原因时 `e.code ?? e.message` 会优先取 code,
        // 那会把"夹具:PowerShell 不可达"这句真实原因换成一个代号 —— 断言就白写了。
        throw new Error('夹具:PowerShell 不可达')
      },
    }).catch((e) => (err46 = e))
    t(
      'S46 端到端反向:现测不到启动时间 ⇒ **不**抢占,锁原样在位,且原因进了超时文案',
      !!err46 && existsSync(metaFile(d46)) && /PowerShell 不可达/.test(err46.message),
      err46?.message ?? '未抛错',
    )
    const d47 = freshDir()
    putMeta(
      d47,
      JSON.stringify({
        mode: 'build',
        pid: process.pid,
        ts: Date.now(),
        host: '别的机器',
        pidStart: SELF_START,
      }),
    )
    let err47 = null
    await acquire({
      mode: 'build',
      timeoutMs: 900,
      staleMs: 600_000,
      dir: d47,
      identityRun: fakeRun(5000),
    }).catch((e) => (err47 = e))
    t(
      'S47 别机持有的锁:即使现测值差很远也**不得**据此判复用(unverifiable 而非 mismatch)',
      !!err47 && existsSync(metaFile(d47)) && /别机持有/.test(err47.message),
      err47?.message ?? '未抛错',
    )
    // 48 check 的快路径不得现测:注入一个会抛的 run,check 必须照样跑完
    let chk48Threw = false
    try {
      check({ dir: d43, log: () => {} })
    } catch {
      chk48Threw = true
    }
    t('S48 check 不派生身份现测(它是只读快路径)', chk48Threw === false)
    t(
      'S49 holderIdentity 的主体是 ownerPid(投影错主体 = 把别人的启动时刻当成持锁者的)',
      holderIdentity({ pid: 7, ownerPid: 4242, pidStart: 9, host: 'H' }).pid === 4242 &&
        holderIdentity({ pid: 7, ownerPid: 0, pidStart: 9, host: 'H' }).pid === 7 &&
        holderIdentity({ pid: 7, ownerPid: 0, pidStart: 0, host: '' }).pidStart === undefined &&
        holderIdentity({ pid: 7, ownerPid: 0, pidStart: 0, host: '' }).host === undefined,
    )

    // —— 50..57) G-412 第二判据:单调量"绝对存活时刻上限"与"ts 不可信(未来 N 秒)"的人工出口。
    // 全部用**固定 now + 注入 uptimeMs**,绝不为取证真改系统时钟或真重启机器。
    const NOW_FIX = 1_800_000_000_000
    const MIN = 60_000
    const HOST_L = hostname()
    const UP_1H = 3_600_000 // 假 uptime:1 小时 ⇒ curBoot = NOW_FIX - 1h
    const CUR_BOOT = NOW_FIX - UP_1H

    // —— 50) 注入未来 ts ⇒ 判"不可信"并给出出路(红线:不得判成"锁很新所以继续无界等")
    const d50 = freshDir()
    putMeta(
      d50,
      JSON.stringify({ mode: 'build', pid: process.pid, ownerPid: process.pid, ts: NOW_FIX + 10 * MIN }),
    )
    const age50 = lockAgeMs(d50, readMeta(d50), NOW_FIX)
    t(
      'S50a 未来 ts ⇒ clockAnomalous 且读数点名"ts 不可信(未来 N 秒)",N 就是量到的 futureMs',
      age50.clockAnomalous === true &&
        Math.abs(age50.futureMs - 10 * MIN) < 1_000 &&
        /ts 不可信\(未来 600s/.test(age50.source),
      JSON.stringify(age50),
    )
    const dec50 = decideSteal({
      dir: d50,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
    })
    t(
      'S50b 未来 ts ⇒ 有出路(steal,先归档再抢),绝不 wait;why 带"未来 N 秒"与人工出口 break-stale',
      dec50.action === 'steal' &&
        (dec50.immediate ?? false) === false &&
        /ts 不可信\(未来 600s/.test(dec50.why) &&
        /break-stale/.test(dec50.why),
      `${dec50.action} / ${dec50.why}`,
    )
    t(
      'S50c 旧 meta(无 host)⇒ 单调对账必须在结论里喊"无法核对",不得静默当成已核',
      /单调判据=无法核对/.test(dec50.why),
      dec50.why,
    )

    // —— 51) 回归对照:正常 ts ⇒ 与改动前**逐字同结论**(clamp 语义、来源、wait 全部不变)
    const d51 = freshDir()
    putMeta(
      d51,
      JSON.stringify({ mode: 'build', pid: process.pid, ownerPid: process.pid, ts: NOW_FIX - 60_000 }),
    )
    const age51 = lockAgeMs(d51, readMeta(d51), NOW_FIX)
    t(
      'S51a 正常 ts ⇒ ageMs 精确按 meta.ts 计、来源仍是 "meta.ts"、不标异常(改动前语义原样)',
      age51.ageMs === 60_000 && age51.source === 'meta.ts' && !age51.clockAnomalous,
      JSON.stringify(age51),
    )
    const dec51 = decideSteal({
      dir: d51,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
    })
    t(
      'S51b 正常 ts + 持有者存活 ⇒ wait,文案与改动前同形(新判据不得自己长出授权)',
      dec51.action === 'wait' && /仍在运行\(锁龄 60000ms/.test(dec51.why),
      `${dec51.action} / ${dec51.why}`,
    )

    // —— 52) 单调判据纯函数:三态成对(contradiction / consistent / unverifiable 各带正反)
    const mv = (meta, over = {}) =>
      monotonicAgeVerdict({ meta: { ts: 0, host: HOST_L, bootMs: 0, ...meta }, now: NOW_FIX, uptimeMs: UP_1H, localHost: HOST_L, ...over })
    t(
      'S52a 同机 + 未来 ts ⇒ contradiction/future-ts,why 给出"未来 N 秒"与墙钟回拨这一解释',
      (() => {
        const v = mv({ ts: NOW_FIX + 10 * MIN })
        return v.kind === 'contradiction' && v.mode === 'future-ts' && /ts 不可信\(未来 600s/.test(v.why)
      })(),
    )
    t(
      'S52b 同机 + 正常 ts + 开机锚点与现推一致 ⇒ consistent(单调判据不得凭空造抢占授权)',
      mv({ ts: NOW_FIX - 1000, bootMs: CUR_BOOT }).kind === 'consistent',
    )
    t(
      'S52c 别机持有的锁 ⇒ unverifiable(本机单调钟推算对它没有意义;维持原判据)',
      (() => {
        const v = mv({ ts: NOW_FIX + 10 * MIN, host: '别的机器-不匹配' })
        return v.kind === 'unverifiable' && /别机持有/.test(v.reason)
      })(),
    )
    t(
      'S52d 旧 meta 没记 host ⇒ unverifiable(无法确认写在本机,不冒用单调判据)',
      (() => {
        const v = mv({ ts: NOW_FIX - 1000, host: '' })
        return v.kind === 'unverifiable' && /host/.test(v.reason)
      })(),
    )
    t(
      'S52e uptime 量不到 ⇒ unverifiable(判不出必须报名,不得折叠成 consistent)',
      mv({ ts: NOW_FIX - 1000 }, { uptimeMs: NaN }).kind === 'unverifiable' &&
        mv({ ts: NOW_FIX - 1000 }, { uptimeMs: 0 }).kind === 'unverifiable',
    )
    t(
      'S52f 墙钟完全正常,但开机锚点前移超容差 ⇒ contradiction/session-ended(第二判据独立生效,点名"绝对存活时刻")',
      (() => {
        const v = mv({ ts: NOW_FIX - 1000, bootMs: CUR_BOOT - 10 * MIN })
        return v.kind === 'contradiction' && v.mode === 'session-ended' && /绝对存活时刻/.test(v.why)
      })(),
    )
    t(
      'S52g 开机锚点漂移在容差之内(NTP 微步进)⇒ consistent(不得把秒级校时读成重启)',
      mv({ ts: NOW_FIX - 1000, bootMs: CUR_BOOT - 60_000 }).kind === 'consistent',
    )

    // —— 53) 端到端判据接线:session-ended ⇒ steal(归档后抢,非秒抢),且带人工出口
    const d53 = freshDir()
    putMeta(
      d53,
      JSON.stringify({
        mode: 'build',
        pid: process.pid,
        ownerPid: process.pid,
        ts: NOW_FIX - 1000, // 墙钟读数完全正常(不触发 clockAnomalous)
        host: HOST_L,
        bootMs: CUR_BOOT - 10 * MIN, // 写入时的开机锚点比现推早 10 分钟 ⇒ 已换会话
      }),
    )
    const dec53 = decideSteal({
      dir: d53,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
      uptimeMs: UP_1H,
      localHost: HOST_L,
    })
    t(
      'S53 单调第二判据:墙钟正常而开机锚点前移 ⇒ steal + immediate:false + why 点名绝对存活上限与 break-stale',
      dec53.action === 'steal' &&
        dec53.immediate === false &&
        /绝对存活时刻/.test(dec53.why) &&
        /break-stale/.test(dec53.why),
      `${dec53.action} / ${dec53.why}`,
    )
    // —— 54) 成对反向对照:同一夹具只把锚点改回同会话 ⇒ 必须回到 wait
    const d54 = freshDir()
    putMeta(
      d54,
      JSON.stringify({
        mode: 'build',
        pid: process.pid,
        ownerPid: process.pid,
        ts: NOW_FIX - 1000,
        host: HOST_L,
        bootMs: CUR_BOOT, // 与现推开机时刻一致 = 同会话、钟没大步
      }),
    )
    const dec54 = decideSteal({
      dir: d54,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
      uptimeMs: UP_1H,
      localHost: HOST_L,
    })
    t('S54 反向对照:bootMs 与现推开机一致 ⇒ wait(第二判据不得变成秒抢判据)', dec54.action === 'wait', dec54.why)

    // —— 55) 记录侧:writeMeta 落 bootMs;量不到 ⇒ 整键不写(读侧落 unverifiable,不造假锚点)
    const d55 = freshDir()
    writeMeta(d55, 'build', { ownerPid: process.pid, now: NOW_FIX, uptimeMs: UP_1H, run: () => null })
    const m55 = JSON.parse(readFileSync(metaFile(d55), 'utf8'))
    t(
      'S55a writeMeta 落单调锚点 bootMs = now - uptime(可注入,自检不依赖真时钟)',
      m55.bootMs === CUR_BOOT && m55.ts === NOW_FIX,
      JSON.stringify(m55),
    )
    const d56 = freshDir()
    writeMeta(d56, 'build', { ownerPid: process.pid, now: NOW_FIX, uptimeMs: NaN, run: () => null })
    const m56 = JSON.parse(readFileSync(metaFile(d56), 'utf8'))
    t(
      'S55b uptime 量不到 ⇒ bootMs 键整体不写(回落旧形态;读侧据此 unverifiable,绝不伪造锚点)',
      m56.bootMs === undefined,
      JSON.stringify(m56),
    )
    const c56 = classifyMeta(JSON.stringify({ mode: 'build', pid: 4321, ts: 1, host: HOST_L, bootMs: CUR_BOOT }))
    t(
      'S55c classifyMeta 归一 bootMs;缺省 ⇒ 0(被读成"没有锚点",不是"锚点是 0 时刻")',
      c56.meta.bootMs === CUR_BOOT && classifyMeta('{"pid":7,"ts":1}').meta.bootMs === 0,
    )

    // —— 57) break-stale 人工出口成对:空理由 ⇒ 拒绝且一字不动;带理由 ⇒ 先归档再原子断锁
    const d57 = freshDir()
    const raw57 = putMeta(
      d57,
      JSON.stringify({ mode: 'build', pid: process.pid, ownerPid: process.pid, ts: Date.now() }),
    )
    const br57a = breakStale({ dir: d57, reason: '   ', log: () => {} })
    t(
      'S57a 空/纯空白 reason ⇒ 拒绝,锁的字节与目录一字未动(破坏性动作没有理由就不许发生)',
      br57a.ok === false && existsSync(metaFile(d57)) && readFileSync(metaFile(d57), 'utf8') === raw57,
      JSON.stringify(br57a),
    )
    const br57b = breakStale({ dir: d57, reason: '自检夹具:人工断锁出路对照', log: () => {} })
    const sceneHasBreak = (() => {
      try {
        return readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).some((n) => n.includes('break-stale'))
      } catch {
        return false
      }
    })()
    t(
      'S57b 带 reason ⇒ 断锁成功:原路径消失(原子改名,不是 removeLock)且现场已入归档面',
      br57b.ok === true && !existsSync(d57) && sceneHasBreak,
      JSON.stringify(br57b),
    )
    const br57c = breakStale({ dir: join(base, 'no-such-lock-57c'), reason: '自检:无锁面', log: () => {} })
    t(
      'S57c 无锁可断 ⇒ ok 且**未创建任何东西**(出路不是"造一把锁再删")',
      br57c.ok === true && !existsSync(join(base, 'no-such-lock-57c')),
      JSON.stringify(br57c),
    )
    t(
      'S57d 单调对账进 check 的打印面:未来 ts 的锁在 check 输出里必须喊"ts 不可信"并给出路',
      (() => {
        let out57 = ''
        check({ dir: d50, log: (s) => (out57 += s), now: NOW_FIX })
        return /ts 不可信\(未来 600s/.test(out57) && /break-stale/.test(out57)
      })(),
    )

    // —— 58..61) G-814425 初始化「写全再原子可见」(唯一实现在 scripts/lib/lock-atomic-init.mjs)。
    // 这四条钉的是创建侧那一格:旧形态 mkdir(正式目录)+writeMeta 的两步窗口里,锁目录已经
    // 对外可见而里面什么都没有 ⇒ 它恰好是本文件四态里的 absent ⇒ 而 absent 的自动出路是
    // "锁龄超 stale ⇒ 归档抢占" ⇒ **还在初始化中的活锁**可以被别人抢走。
    const pendingRootNow = lockPendingRoot()
    const d58 = join(base, `lock-${++seq}`)
    const r58 = await acquire({ mode: 'build', timeoutMs: 3000, dir: d58, ownerPid: process.pid })
    t('S58a 无锁在场 ⇒ 原子初始化直接取得', r58 === true && readMeta(d58).kind === 'ok')
    t(
      'S58b 取得即完整:正式锁目录里当场就读得到 ok 态 meta(不存在"目录在而 meta 不在"的窗口)',
      readMeta(d58).kind === 'ok' && Number(readMeta(d58).meta.pid) === process.pid,
      JSON.stringify(readMeta(d58)),
    )
    t(
      'S58c 不留残留:锁目录同级**没有** .pending,而 pending 落点跑完是空的(残留会喂给下一次判读)',
      readdirSync(base).filter((n) => n.includes('.pending')).length === 0 &&
        (!existsSync(pendingRootNow) || readdirSync(pendingRootNow).length === 0),
      `${base} / ${pendingRootNow}`,
    )
    // S59: pending 落点被一个**文件**占住 ⇒ 初始化必然失败。红线是"失败得干净":
    // 绝不能在正式路径上留下一把看起来存在的锁(那正是旧形态会留下的东西)。
    const d59 = join(base, `lock-${++seq}`)
    const badPending = join(base, `pending-blocked-${seq}`)
    writeFileSync(badPending, 'not a dir', 'utf8')
    let err59 = null
    process.env.IHUI_DEPLOY_LOCK_PENDING_DIR = join(badPending, 'sub')
    await acquire({ mode: 'build', timeoutMs: 1500, dir: d59, ownerPid: process.pid }).catch((e) => {
      err59 = e
    })
    delete process.env.IHUI_DEPLOY_LOCK_PENDING_DIR
    t(
      'S59 pending 落点不可用 ⇒ 当场报错并点名错误码,正式锁目录**根本没被创建**(不留下半成品锁)',
      !!err59 && /创建\/写入锁/.test(err59.message) && !existsSync(d59),
      err59?.message ?? '未抛错',
    )
    // S60: 锁目录的父目录不存在 ⇒ 与改动前同一条出路(立刻报错,不进死等)。
    let err60 = null
    await acquire({ mode: 'build', timeoutMs: 1500, dir: join(base, 'no-such-parent-60', 'lock') }).catch(
      (e) => (err60 = e),
    )
    t(
      'S60 父目录不存在 ⇒ 立刻报错(ENOENT)而不是死等一把自己建不出来的锁(既有 S34 那一条的形状)',
      !!err60 && /创建\/写入锁/.test(err60.message) && /ENOENT/.test(err60.message),
      err60?.message ?? '未抛错',
    )
    // S61: 正式路径已是**空目录**(旧形态的产物 / 人工留下的 absent 态)⇒ 新初始化**绝不 rename 覆盖它**
    // (POSIX 的 rename 会直接替换空目录,那就等于把"别人的在建锁"抹掉),仍按 absent 态等 stale。
    const d61 = freshDir()
    let err61 = null
    await acquire({ mode: 'build', timeoutMs: 900, staleMs: 600_000, dir: d61 }).catch((e) => (err61 = e))
    t(
      'S61 已存在的空锁目录(absent 态)未被 rename 替换、未被删 ⇒ 仍走既有"等 stale"判据',
      !!err61 && existsSync(d61) && readdirSync(d61).length === 0,
      err61?.message ?? '未抛错',
    )

    // —— 62..66) G-386(孪生 G-779):**不可判定三态**的时钟倒挂必须单独成档(G-412 只修了 ok 面)。
    // 本票点名的谓词形状 `age > staleMs` 只剩住在这里:不可判定面的年龄降级取锁目录 mtime,
    // mtime 超容差落在未来 ⇒ ageMs 钳成 0 ⇒ `0 > staleMs` 恒假 ⇒ 旧行为是无限 wait 到超时。
    // 取证一律用 utimesSync 造未来 mtime + 注入固定 now —— **绝不真改系统时钟**(那是拿生产当夹具)。
    const FUTURE_10MIN = 10 * MIN
    // ⚠️ 本机实测(Windows 10.0.26200 / Node v24.19.0)的坑:`utimesSync` 的数值参数按**秒**(epoch
    //   seconds)解释,传 ms 会被换算成远超 FILETIME 上限的时刻 ⇒ 文件和目录一律 EINVAL,报错形状
    //   像"这台机不许设时间"而实际是单位错(错误形状≠原因,G-412 取证那一轮的同一条禁令)。这里显式换算。
    const utimesSec = (d, ms) => {
      const sec = Math.round(ms / 1000)
      utimesSync(d, sec, sec)
    }
    const mkUndeterminedWithMtime = (metaText, deltaMs) => {
      const d = freshDir()
      if (metaText !== null) putMeta(d, metaText)
      utimesSec(d, NOW_FIX + deltaMs)
      return d
    }
    const d62 = mkUndeterminedWithMtime('{"mode":"build","pid":', FUTURE_10MIN)
    const age62 = lockAgeMs(d62, readMeta(d62), NOW_FIX)
    t(
      'S62a 不可判定面未来 mtime ⇒ clockAnomalous 且 ageMs 被钳 0(正是本票点名的"锁龄恒 0"形状)',
      age62.clockAnomalous === true &&
        age62.ageMs === 0 &&
        Math.abs(age62.futureMs - FUTURE_10MIN) < 1_000 &&
        /mtime 在未来/.test(age62.source),
      JSON.stringify(age62),
    )
    const dec62 = decideSteal({
      dir: d62,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
    })
    t(
      'S62b 不可判定面时钟倒挂 ⇒ 独立档:steal + immediate:false(归档后抢非秒抢),why 点名档位/态名/无锚点/人工出口',
      dec62.action === 'steal' &&
        dec62.immediate === false &&
        dec62.clockAnomalous === true &&
        /时钟倒挂档/.test(dec62.why) &&
        /break-stale/.test(dec62.why) &&
        /invalid/.test(dec62.why) &&
        /单调对账=无锚点/.test(dec62.why),
      `${dec62.action} / ${dec62.why}`,
    )
    // —— 63) 成对反向对照(只有正向没有反向的断言等于没有断言):三种正常形态一律按原判据
    const dec63w = decideSteal({
      dir: mkUndeterminedWithMtime('{"mode":"build","pid":', -1000),
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
    })
    t(
      'S63a mtime 刚刚(正常新建)⇒ 仍 wait 且文案"未超 stale"(新档不得触达;改动前语义原样)',
      dec63w.action === 'wait' && /未超 stale/.test(dec63w.why) && !dec63w.clockAnomalous,
      `${dec63w.action} / ${dec63w.why}`,
    )
    const dec63s = decideSteal({
      dir: mkUndeterminedWithMtime('{"mode":"build","pid":', -(600_000 + 60_000)),
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
    })
    t(
      'S63b mtime 已超 stale(正常陈旧)⇒ 仍走原 stale 档且 why 不出现"时钟倒挂档"(新档不得顶掉旧出路)',
      dec63s.action === 'steal' &&
        /stale 阈值/.test(dec63s.why) &&
        !/时钟倒挂档/.test(dec63s.why) &&
        !dec63s.clockAnomalous,
      `${dec63s.action} / ${dec63s.why}`,
    )
    const dec63t = decideSteal({
      dir: mkUndeterminedWithMtime('{"mode":"build","pid":', Math.floor(FUTURE_TS_TOLERANCE_MS / 2)),
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
    })
    t(
      'S63c 未来 mtime 在容差之内(半容差,如 NTP 微步进)⇒ 不记异常仍 wait(容差语义未放宽)',
      dec63t.action === 'wait' && !dec63t.clockAnomalous,
      `${dec63t.action} / ${dec63t.why}`,
    )
    // —— 64) absent 面同档:三态都覆盖,且"先归档再抢"对 absent 同样是底线(不得折成秒抢)
    const dec64 = decideSteal({
      dir: mkUndeterminedWithMtime(null, FUTURE_10MIN),
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: HARD_CAP_MS,
      now: NOW_FIX,
    })
    t(
      'S64 absent + 未来 mtime ⇒ 同一时钟倒挂档(steal + immediate:false)并点名 absent',
      dec64.action === 'steal' &&
        dec64.immediate === false &&
        /absent/.test(dec64.why) &&
        /时钟倒挂档/.test(dec64.why),
      `${dec64.action} / ${dec64.why}`,
    )
    // —— 65) 端到端:acquire 真的走出这一格(改前该形态必在 600s 后抛错,现场还会被归档保住)
    const d65 = mkUndeterminedWithMtime('{"mode":"build","pid":', 0)
    const raw65 = readFileSync(metaFile(d65), 'utf8')
    // acquire 内部的 now=Date.now() 不可注入 ⇒ 这一臂按**真实时钟**造未来 mtime(仍走秒语义)。
    utimesSec(d65, Date.now() + FUTURE_TS_TOLERANCE_MS + 120_000)
    const r65 = await acquire({ mode: 'build', timeoutMs: 5000, staleMs: 600_000, dir: d65 })
    t(
      'S65 端到端:不可判定 + 未来 mtime ⇒ acquire 经时钟倒挂档成功(有出路,而不是 wait 到超时)',
      r65 === true,
      String(r65),
    )
    const scene65 = (() => {
      try {
        return readdirSync(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR).some((n) => {
          try {
            return readFileSync(join(process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR, n, 'meta.json'), 'utf8') === raw65
          } catch {
            return false
          }
        })
      } catch {
        return false
      }
    })()
    t(
      'S65b 端到端现场按**原字节**归档(immediate:false 的"先归档"契约没有被顺手削掉)',
      scene65,
    )
    // —— 66) check 文案:异常面点名"时钟倒挂档"+人工出口;正常不可判定面**不得**出现这句
    let out66a = ''
    check({ dir: d62, log: (s) => (out66a += s), now: NOW_FIX })
    let out66b = ''
    check({ dir: mkUndeterminedWithMtime('{"mode":"build","pid":', -1000), log: (s) => (out66b += s), now: NOW_FIX })
    t(
      'S66a check:不可判定 + 未来 mtime ⇒ 喊"时钟倒挂档"并给自动+人工两条出路',
      /时钟倒挂档/.test(out66a) && /break-stale/.test(out66a),
      out66a,
    )
    t(
      'S66b check 反向对照:正常不可判定面不得被印成倒挂档(否则 S66a 是恒真断言)',
      !/时钟倒挂档/.test(out66b),
      out66b,
    )
  } finally {
    rmScratch(base)
  }

  // ── 2026-10-01 心跳(补 §12 登记的那格空白:dev 侧此前"没有活着的 owner")──────────
  // 判据是纯函数 heartbeatAction ⇒ 九档构造面各有正反例;端到端三档在真锁目录上真写真删。
  // 只用 **t()** 登记断言 —— 直接 results.push([...]) 会绕过 harness(打不出名字、
  // r.ok 恒 undefined),这一族断言就会以"通过"的名义从未被求值过。
  {
    const TOKEN = 'T'.repeat(32)
    const meta = (over = {}) => ({ kind: 'ok', meta: { mode: 'dev', pid: process.pid, ownerPid: process.pid, ts: 1, token: TOKEN, ...over } })
    const A = (x = {}) => heartbeatAction({ state: meta(), mode: 'dev', token: TOKEN, watchPid: process.pid, watchAlive: true, ...x })
    t('HB1 归属与凭据全对 ⇒ 续期', A().action === 'renew', JSON.stringify(A()))
    t('HB2 凭据不符 ⇒ 只停手,绝不删(摘掉归属核验就是替别人的锁永久续期)', A({ state: meta({ token: 'O'.repeat(32) }) }).action === 'stop')
    t('HB3 旧格式锁(无凭据)⇒ 停手,不猜归属', A({ state: meta({ token: '' }) }).action === 'stop')
    t('HB4 调用方没带凭据 ⇒ 停手', A({ token: undefined }).action === 'stop')
    t('HB5 ownerPid 已漂(别人接管了这把锁)⇒ 停手', A({ watchPid: process.pid + 1 }).action === 'stop')
    t('HB6 主人退出 ⇒ release(不等下一位按 stale 来抢)', A({ watchAlive: false }).action === 'release')
    t('HB7 身份三元组确证复用 ⇒ release(裸 pid 活着不算活着)', A({ identityKind: 'mismatch' }).action === 'release')
    t('HB8 身份量不到 ⇒ 维持原判据继续续,不得多删一把锁', A({ identityKind: 'unverifiable' }).action === 'renew')
    t(
      'HB9 到寿命上限 ⇒ 停止续期但**不删**(dev 还活着时删锁等于自己撤保护)',
      A({ ageMs: HEARTBEAT_DEFAULTS.maxLifetimeMs + 1000 }).action === 'stop',
    )
    t('HB10 mode 漂了(build 锁不被 dev 心跳接管)', A({ state: meta({ mode: 'build' }) }).action === 'stop')
    t('HB11 锁不存在 ⇒ 停手且说不清就报名,不重建', heartbeatAction({ state: { kind: 'absent', reason: 'x' }, mode: 'dev', token: TOKEN, watchPid: process.pid, watchAlive: true }).action === 'stop')

    // 端到端:真写、真刷、真交还(锁目录用夹具,绝不碰项目根的 .deploy.lock)
    const d1 = join(base, 'hb-renew')
    mkdirSync(d1, { recursive: true })
    const wrote = writeMeta(d1, 'dev', { ownerPid: process.pid, token: TOKEN })
    const before = readMeta(d1).meta.ts
    const r1 = await heartbeat({ mode: 'dev', token: TOKEN, watchPid: process.pid, dir: d1, once: true, alive: () => true, log: () => {} })
    const after = readMeta(d1).meta
    t(
      'HB12 端到端一轮:ts 真被刷新,而凭据/mode/owner 逐字不变(换凭据=下一轮自己都不认自己)',
      r1.action === 'renew' && after.ts >= before && after.token === wrote.token && after.mode === 'dev' && Number(after.ownerPid) === process.pid,
      JSON.stringify({ before, after: { ts: after.ts, token: after.token, mode: after.mode, ownerPid: after.ownerPid } }),
    )
    // 主人判死那一档必须让**锁的 owner 就是那个死掉的 pid** —— heartbeatAction 的判序是
    // "ownerPid 漂了 ⇒ 已被别人接管,停手"排在"主人退出 ⇒ 交还"之前,拿活着的 process.pid
    // 当 watchPid 去配一个死 pid 只会走到 stop 那一档(这一格第一版就是这么错的)。
    const dDead = join(base, 'hb-dead')
    mkdirSync(dDead, { recursive: true })
    writeMeta(dDead, 'dev', { ownerPid: DEAD_PID, token: TOKEN })
    const r2 = await heartbeat({ mode: 'dev', token: TOKEN, watchPid: DEAD_PID, dir: dDead, once: true, alive: () => false, log: () => {} })
    t('HB13 端到端:主人判死 ⇒ 锁真被交还(目录消失)', r2.action === 'release' && r2.released === true && !existsSync(dDead), JSON.stringify({ a: r2.action, released: r2.released }))

    const d2 = join(base, 'hb-other')
    mkdirSync(d2, { recursive: true })
    writeMeta(d2, 'dev', { ownerPid: process.pid, token: 'o'.repeat(32) })
    const r3 = await heartbeat({ mode: 'dev', token: 'm'.repeat(32), watchPid: process.pid, dir: d2, once: true, alive: () => true, log: () => {} })
    t(
      'HB14 拿别人的凭据来续 ⇒ 停手且锁原样在(不续、不删)',
      r3.action === 'stop' && existsSync(d2) && readMeta(d2).meta.token === 'o'.repeat(32),
      JSON.stringify({ a: r3.action, why: r3.why }),
    )

    // 接线锁:启动器必须真持锁、真派心跳、退出真交还 —— 判据在而无人调 = 本仓最高频失效型。
    const warm = readFileSync(join(repoRoot, 'scripts', 'dev-with-warmup.mjs'), 'utf8')
    t('HB15 接线锁:dev 启动器必须 acquire(带自己的凭据)后才起 next dev', /await acquire\(\{[\s\S]{0,200}mode: 'dev'[\s\S]{0,200}token: LOCK_TOKEN/.test(warm))
    t('HB15b 接线锁:心跳必须被真的派出去,且盯的是启动器自己的 pid', /'heartbeat'[\s\S]{0,400}--watch-pid[\s\S]{0,80}String\(process\.pid\)/.test(warm))
    t('HB15c 接线锁:退出路径必须走 quit() 交锁,不许裸 process.exit(dev 退出后锁还挂着)', /dev\.on\('exit',\s*\(code\)\s*=>\s*quit\(/.test(warm) && /const quit = \(code\)/.test(warm))
    t(
      'HB15d 接线锁:共存档(别的 dev 已持锁)时不得派心跳也不得释放 —— 归属判据现读,不靠猜',
      /lockOwnedBy\(LOCK_TOKEN\)/.test(warm) && /if \(ownsDevLock\)/.test(warm),
    )
  }

  // ── 2026-10-02 补锁票:`acquire --with-heartbeat` 与 `run` 子命令 ──────────────────
  // 立票理由是实测:`pnpm --filter @ihui/web build` 原先在 **prebuild** 里 acquire,而
  // prebuild 是另一条 npm 生命周期脚本 —— 它的 shell 在 `build` 开始之前就退了 ⇒ 整个
  // `next build` 期间那把锁的主人是个已死进程,按现行"持有者已退出的悬挂锁不限锁龄立即
  // 抢占"这条,任何后来者都能秒抢:**账面有锁,实际没保护**(8-09 那两个构建同时写 .next
  // ⇒ 8801 短暂 502 的那一型在这条入口上今天仍可发生)。把锁与命令放进同一个进程,
  // "锁活着"与"构建活着"才真的是同一件事。
  // 判档分工:heartbeatSpawnPlan 是纯判据(构造面,不起任何进程);另两档跑端到端,
  // 派生一律换成假 spawnFn 只记 argv —— 自检里绝不派真常驻心跳进程。
  {
    const TK = 'A'.repeat(32)
    const metaOk = { mode: 'dev', pid: process.pid, ownerPid: process.pid, ts: 1, token: TK }
    const planDir = join(base, 'ah-plan-only')
    const P = (x = {}) =>
      heartbeatSpawnPlan({ mode: 'dev', dir: planDir, token: TK, meta: metaOk, owned: true, ...x })
    const argvOf = P()
    t(
      'AH1 派生 argv 逐字钉死:必须带 --lock-dir 且指向**这把锁自己的**目录(漏了它心跳会去刷项目根的真锁)',
      argvOf.args.includes('--lock-dir') &&
        argvOf.args[argvOf.args.indexOf('--lock-dir') + 1] === resolve(planDir) &&
        argvOf.file === process.execPath,
      argvOf.args.join(' '),
    )
    t('AH2 共存档(本次没写下这把锁)⇒ 一次派生都不做 —— 否则就是替别人的锁永久续期', P({ owned: false }).spawn === false)
    t('AH3 无归属凭据 ⇒ 不派(第一轮就因无从核验而 stop,派一个白跑的进程装作"已有心跳")', P({ token: '  ' }).spawn === false)
    const noPid = P({ meta: { ...metaOk, ownerPid: 0 } })
    t('AH4 落盘 meta 取不出 ownerPid ⇒ 不派并点名"判活主体不明"', noPid.spawn === false && noPid.kind === 'no-watch-pid')

    const mkFake = () => {
      const calls = []
      const fn = (file, args) => {
        calls.push({ file, args })
        return { pid: 4242, unref() {}, on() {} }
      }
      return { calls, fn }
    }
    // 自检里所有 acquire 一律带**短超时**:判据前提写错时,必须当场失败并点名,
    // 而不是等 600s —— 一台会挂住的自检会把这台机上每一次提交都堵住。
    const FAST = { timeoutMs: 3000, staleMs: 3000 }
    const dOff = join(base, 'ah-flag-off')
    const fOff = mkFake()
    const rOff = await acquireWithHeartbeatOption(
      { mode: 'dev', dir: dOff, ownerPid: process.pid, token: TK, ...FAST },
      { withHeartbeat: false, spawnFn: fOff.fn, log: () => {}, warn: () => {} },
    )
    t(
      'AH5 不带 --with-heartbeat ⇒ 零派生(向后兼容硬要求:现存调用方一律不受本票影响)',
      rOff.kind === 'flag-off' && fOff.calls.length === 0 && existsSync(dOff),
    )
    const dOn = join(base, 'ah-flag-on')
    const fOn = mkFake()
    const rOn = await acquireWithHeartbeatOption(
      { mode: 'dev', dir: dOn, ownerPid: process.pid, token: TK, ...FAST },
      { withHeartbeat: true, spawnFn: fOn.fn, log: () => {}, warn: () => {} },
    )
    const onArgs = fOn.calls[0]?.args ?? []
    t(
      'AH6 带旗且确实是自己写下的锁 ⇒ 真派出心跳,盯的是落盘 ownerPid、带的是自己的凭据',
      rOn.spawned === true &&
        fOn.calls.length === 1 &&
        onArgs.includes('heartbeat') &&
        String(onArgs[onArgs.indexOf('--watch-pid') + 1]) === String(process.pid) &&
        onArgs[onArgs.indexOf('--token') + 1] === TK,
      onArgs.join(' '),
    )
    const dCo = join(base, 'ah-coexist')
    mkdirSync(dCo, { recursive: true })
    writeMeta(dCo, 'dev', { ownerPid: process.pid, token: 'B'.repeat(32) })
    const fCo = mkFake()
    const rCo = await acquireWithHeartbeatOption(
      { mode: 'dev', dir: dCo, ownerPid: process.pid, token: TK, ...FAST },
      { withHeartbeat: true, spawnFn: fCo.fn, log: () => {}, warn: () => {} },
    )
    t(
      'AH7 共存档端到端:不派心跳,而且**别人那把锁的凭据一字未动**(把盘上有什么当什么归我 = 归属判据归零)',
      rCo.spawned === false && fCo.calls.length === 0 && readMeta(dCo).meta.token === 'B'.repeat(32),
      JSON.stringify({ kind: rCo.kind, head: readMeta(dCo).meta.token?.slice(0, 1) }),
    )
    const dBoom = join(base, 'ah-spawn-throws')
    const warns = []
    const rBoom = await acquireWithHeartbeatOption(
      { mode: 'dev', dir: dBoom, ownerPid: process.pid, token: TK, ...FAST },
      {
        withHeartbeat: true,
        spawnFn: () => {
          throw Object.assign(new Error('夹具:派生不了'), { code: 'EMOCK' })
        },
        log: () => {},
        warn: (...a) => warns.push(a.join(' ')),
      },
    )
    t(
      'AH8 心跳起不来 ⇒ 拿锁照样成功(退回既有 stale + 硬上限),但必须喊出"心跳未起来",不得静默',
      rBoom.spawned === false && existsSync(dBoom) && warns.some((w) => /心跳未起来/.test(w)),
      warns.join(' | ') || '(一条 warn 都没打)',
    )
    for (const d of [dOff, dOn, dCo, dBoom]) rmSync(d, { recursive: true, force: true })
  }

  // ── `run` 子命令:把"拿锁 + 跑命令 + 交还"收进同一个进程 ──────────────────────────
  // 四条收口路径各有正反例:退出码透传 / 结束即交还 / 再入守卫(不套第二把锁 = 不自锁) /
  // 命令根本起不来也必须把锁收掉。锁判据仍只住在 heartbeatSpawnPlan,这里只做 IO。
  {
    const fakeChild = () => ({ pid: 4243, unref() {}, on() {} })
    const dRu = join(base, 'ru-ok')
    const rRu = await runUnderLock({
      mode: 'build',
      dir: dRu,
      timeoutMs: 3000,
      staleMs: 3000,
      command: [process.execPath, '-e', 'process.exit(3)'],
      heartbeatSpawnFn: fakeChild,
      log: () => {},
      warn: () => {},
    })
    t(
      'RU1 被包装命令的退出码原样传播(3 就是 3 —— 把失败读成成功等于 npm/CI 认为构建过了)',
      rRu.rc === 3 && rRu.owned === true,
      JSON.stringify({ rc: rRu.rc, owned: rRu.owned }),
    )
    t('RU2 命令一结束锁就交还(锁活着与构建活着是同一件事,不留尸体给下一位秒抢)', !existsSync(dRu))
    const dRe = join(base, 'ru-reentrant')
    const rRe = await runUnderLock({
      mode: 'build',
      dir: dRe,
      timeoutMs: 3000,
      staleMs: 3000,
      env: { ...process.env, IHUI_DEPLOY_LOCK_HELD: 'build:上层已持' },
      command: [process.execPath, '-e', 'process.exit(0)'],
      heartbeatSpawnFn: fakeChild,
      log: () => {},
      warn: () => {},
    })
    t(
      'RU3 再入守卫:上层持着这把锁时子层绝不再 acquire(同 mode 互斥 ⇒ 它会等自己,600s 后自锁)',
      rRe.reentrant === true && rRe.rc === 0 && !existsSync(dRe),
      JSON.stringify({ reentrant: rRe.reentrant, rc: rRe.rc }),
    )
    const dTh = join(base, 'ru-spawn-throw')
    const rTh = await runUnderLock({
      mode: 'build',
      dir: dTh,
      timeoutMs: 3000,
      staleMs: 3000,
      command: ['__这条命令在夹具里派生不出来__'],
      spawnFn: () => {
        throw Object.assign(new Error('夹具'), { code: 'EMOCK' })
      },
      heartbeatSpawnFn: fakeChild,
      log: () => {},
      warn: () => {},
    })
    t(
      'RU4 命令根本起不来 ⇒ rc=127 且锁照样收口("子进程起不来而锁留在原地"是最坏的一格)',
      rTh.rc === 127 && !existsSync(dTh),
      JSON.stringify({ rc: rTh.rc, left: existsSync(dTh) }),
    )
    const dBad = join(base, 'ru-empty-cmd')
    let threw = null
    try {
      await runUnderLock({ mode: 'build', dir: dBad, command: [] })
    } catch (e) {
      threw = e
    }
    t(
      'RU5 `--` 之后没给命令 ⇒ 当场报错且**未拿锁**(空 argv 会被 npm 生命周期读成"这一步过了")',
      !!threw && !existsSync(dBad),
    )
    // 接线锁:判据改了而没人把它接上 = 本仓最高频失效型(守门 70/76/81 同族)。
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'apps', 'web', 'package.json'), 'utf8'))
    const sBuild = String(pkg.scripts?.build ?? '')
    const sPre = String(pkg.scripts?.prebuild ?? '')
    t(
      'RU6 接线锁:apps/web 的 build 必须走 run(锁与命令同进程),prebuild 不再 acquire',
      /deploy-lock\.mjs run --mode build/.test(sBuild) && !/deploy-lock\.mjs acquire/.test(sPre),
      JSON.stringify({ build: sBuild.slice(0, 64), prebuild: sPre.slice(0, 64) }),
    )
    t(
      'RU6b 接线锁:dev:clean / dev:stable 的 acquire 必须带 --with-heartbeat(它们的 shell 与 next dev 同生死,是有效持有者)',
      /--with-heartbeat/.test(String(pkg.scripts?.['dev:clean'] ?? '')) &&
        /--with-heartbeat/.test(String(pkg.scripts?.['dev:stable'] ?? '')),
    )
    // 反向对照:上面两条必须有牙 —— 把 build 换回裸命令,断言就该读不出来。
    t(
      'RU6c 反向对照:build 退回"裸 next build"时 RU6 必须读得出(否则那条接线锁是恒真断言)',
      !/deploy-lock\.mjs run/.test(sBuild.replace('deploy-lock.mjs run', 'node')),
    )
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `自检 ${results.length} 条:pass ${results.length - failed.length} / fail ${failed.length}`,
  )
  for (const f of failed) console.log(`  ❌ ${f.name} — ${f.detail}`)
  return failed.length === 0 ? 0 : 1
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  const getOpt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const dir = getOpt('--lock-dir') ? resolve(getOpt('--lock-dir')) : undefined

  try {
    if (cmd === '--self-test' || args.includes('--self-test')) {
      try {
        process.exit(await runSelfTest())
      } catch (e) {
        // 自检脚本自身异常 ≠ 判据失败:按 §22d/§22b 约定用 exit 2 显式"无法判定"
        console.error(`❌ 自检脚本异常(非判据失败):${e?.message ?? e}\n${e?.stack ?? ''}`)
        process.exit(2)
      }
    } else if (cmd === 'acquire') {
      // --with-heartbeat:拿到锁后补一个常驻心跳(2026-10-02 补锁票)。不带这面旗时走的是
      // acquireWithHeartbeatOption 里 `flag-off` 那一档 ⇒ 与改动前**逐字同形**(不多读一次盘、
      // 不派任何进程),所以任何现存调用方都不会因为本票而换行为。
      const r = await acquireWithHeartbeatOption(
        {
          mode: getOpt('--mode') ?? 'build',
          timeoutMs: Number(getOpt('--timeout') ?? 600_000),
          staleMs: Number(getOpt('--stale') ?? 600_000),
          // 调用方(构建脚本)自己的 pid 才是这段锁的主人;CLI 自己会立刻退出。
          ownerPid: getOpt('--owner-pid') ? Number(getOpt('--owner-pid')) : undefined,
          // G-696:调用方预先约定的凭据(缺省由 writeMeta 现生成并打印,release 侧须凭同一凭据)。
          token: getOpt('--token'),
          ...(dir ? { dir } : {}),
        },
        { withHeartbeat: args.includes('--with-heartbeat') },
      )
      // 派生失败不改变 acquire 的退出码(锁已拿到,心跳没起来只是退回既有兜底判据)——
      // 但它**必须**出现在输出里,见 spawnHeartbeat 的两条 warn。
      if (r.spawned === false && (r.kind === 'no-credential' || r.kind === 'no-watch-pid')) {
        console.warn(`[deploy-lock] 已拿到锁,但本轮没有心跳:${r.why}`)
      }
    } else if (cmd === 'run') {
      // 把"拿锁 + 跑命令 + 交还"放进同一个进程:见 runUnderLock 头注(prebuild 那条入口
      // 的锁在整个 next build 期间是悬挂锁 —— 账面有锁、实际没被挡住,那一型的根治)。
      const sep = args.indexOf('--')
      const command = sep >= 0 ? args.slice(sep + 1) : []
      const r = await runUnderLock({
        mode: getOpt('--mode') ?? 'build',
        timeoutMs: Number(getOpt('--timeout') ?? 600_000),
        staleMs: Number(getOpt('--stale') ?? 600_000),
        ...(dir ? { dir } : {}),
        command,
      })
      process.exit(r.rc)
    } else if (cmd === 'release') {
      release({
        mode: getOpt('--mode') ?? 'build',
        // G-696:归属核验 —— 带 token 的锁必须凭同一凭据才许释放(见 release 头注)。
        token: getOpt('--token'),
        ...(dir ? { dir } : {}),
      })
    } else if (cmd === 'heartbeat') {
      // 常驻心跳:由**真正长命的那个进程**的启动器派生(见 heartbeat 头注)。
      // --watch-pid 不给就盯派生我的父进程 —— 与 writeMeta 的 owner 推断同一口径:
      // 判活问的必须是"这段锁真正的主人",问错了每一次对账都必然 mismatch。
      const r = await heartbeat({
        mode: getOpt('--mode') ?? 'dev',
        token: getOpt('--token'),
        watchPid: getOpt('--watch-pid') ? Number(getOpt('--watch-pid')) : process.ppid,
        intervalMs: Number(getOpt('--interval') ?? '') || HEARTBEAT_DEFAULTS.intervalMs,
        maxLifetimeMs: Number(getOpt('--max-lifetime') ?? '') || HEARTBEAT_DEFAULTS.maxLifetimeMs,
        once: args.includes('--once'),
        ...(dir ? { dir } : {}),
      })
      process.exit(r.action === 'release' && r.released === false ? 1 : 0)
    } else if (cmd === 'break-stale') {
      // G-412 人工出口:显式断锁必须带理由;判据见 breakStale 头注(空理由不碰任何状态)。
      const r = breakStale({ ...(dir ? { dir } : {}), reason: getOpt('--reason') })
      console.log(`[deploy-lock] break-stale ⇒ ${r.ok ? '✅' : '🚫'} ${r.why}`)
      process.exit(r.ok ? 0 : 1)
    } else if (cmd === 'check' || args.includes('--check')) {
      // `--check` 与裸 `check` 同形(对称于 `--self-test` 的两形态接受史):G-412 的票面
      // 验证命令写的就是 `--check`,判据不因写法不同而换答案。
      process.exit(check(dir ? { dir } : {}))
    } else {
      console.error(
        '用法: deploy-lock.mjs acquire|release|check [--mode <build|dev>] [--timeout <ms>] [--stale <ms>] [--lock-dir <path>]\n' +
          '      acquire/release 另可带 --token <t>(G-696:锁的归属凭据;acquire 缺省会现生成并打印,\n' +
          '      release 必须凭同一凭据才许释放,也可用环境变量 IHUI_DEPLOY_LOCK_TOKEN 传递)\n' +
          '      deploy-lock.mjs heartbeat --mode dev --token <t> [--watch-pid <pid>] [--interval <ms>]\n' +
          '             [--max-lifetime <ms>] [--once]  —— 常驻续期:见 heartbeat 头注(A 无凭据不续 /\n' +
          '             B 到寿命只停手不删锁 / C 身份只定期现测);--once 是自检与人工排障档\n' +
          '      deploy-lock.mjs break-stale --reason "<人工确认的理由>" [--lock-dir <path>]\n' +
          '      deploy-lock.mjs --self-test',
      )
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
}

// §22d:双形态入口守护 —— 被测试 import 时绝不触发 CLI 副作用
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// §22c:暴露给镜像测试,禁止在测试里复制第二份判据实现
/**
 * 生产调用方的稳定出口(不是测试专用面):真正长命的启动器要**自己持锁**,
 * 而不是从 stdout 里把别人打印的凭据抠回来。见 scripts/dev-with-warmup.mjs 的第 0 步。
 * `heartbeat` 不在此列 —— 它是要 detached 常驻的循环,只能作为独立进程起(CLI 子命令)。
 */
export { acquire, release }

export const __test__ = {
  lockDir,
  metaFile,
  classifyMeta,
  readMeta,
  writeMeta,
  isProcessAlive,
  holderPid,
  HARD_CAP_MS,
  lockAgeMs,
  decideSteal,
  acquire,
  release,
  check,
  sceneArchiveRoot,
  // G-814425:pending 落点也是判据的一部分(镜像测试要问同一把尺子它落在哪,不得在测试里另拼一遍)。
  lockPendingRoot,
  claimStaleLock,
  lockIdentity,
  repoRoot,
  // 2026-09-27 身份三元组接线面(镜像测试直接判这三件,不得在测试里抄第二份判据 —— §22c):
  holderIdentity,
  identityNote,
  // 时钟容差也是判据的一部分:测试必须引这一份,不得在测试里另抄一个 5 分钟(§22c 同源理由)。
  FUTURE_TS_TOLERANCE_MS,
  // G-412 第二判据(单调量"绝对存活时刻上限")与人工出口:镜像测试直接判这两件,不得抄第二份。
  monotonicAgeVerdict,
  breakStale,
  // 2026-10-01 心跳:判据是纯函数,镜像测试必须引这一份(在测试里重写"什么算停手"= 两份真相)。
  heartbeat,
  heartbeatAction,
  // 2026-10-02 补锁票:派生判据与两条新出口(镜像测试必须引这一份,不得在测试里重写
  // "什么算该派心跳 / 命令退出码怎么收口" —— 两处实现必漂移,§22c 同一条理由)。
  heartbeatSpawnPlan,
  acquireWithHeartbeatOption,
  runUnderLock,
  HEARTBEAT_DEFAULTS,
  lockOwnedBy,
  readMeta,
  writeMeta,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
