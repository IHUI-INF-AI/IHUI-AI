#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/** 〈原 36 行头注已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-24.md#git-guardian-L7〉 git-guardian.mjs — `.git` 存活守护 + 秒级自愈(2026-09-12 立)。 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { rotateAppendLog } from './lib/log-rotation.mjs'
import { createHash } from 'node:crypto'
import { homedir, hostname } from 'node:os'
import { isInteractiveUserHome } from './check-home-junctions.mjs'
import { judgeTaskForm, taskFormAcceptable } from './lib/schtasks-form.mjs'
// §0.6 单一真相源:PowerShell 解释器候选复用 check-service-binary-paths 的出口,禁抄第二份。
// 2026-10-25 立:本机的 schtasks.exe 在程序黑名单里 —— spawn 它不是报错,而是**把本 node 进程
// 连同守护本身一起杀掉**(RC=143 = 128+SIGTERM,try/catch 救不了)。计划任务的存在性与
// XML 改走 Get-ScheduledTask / Export-ScheduledTask,形态判据仍是 lib/schtasks-form.mjs 那一份。
import { pickPowerShell } from './check-service-binary-paths.mjs'
// 死值分流必须与 `git-refs-heal.mjs` **共用同一份实现**。本文件原先有一份同名同实现的私有
// `writeLooseRef`,而 `healRefs()` 直接遍历 broken 无校验地写 —— 于是"修好的那一份"只在人工
// 按文档敲 `node scripts/git-refs-heal.mjs` 时生效,**每 2 分钟真跑的这一个恰恰是无校验的那份**。
// 写出指向不存在对象的 ref 会让每一次 `git fetch` 直接 fatal(§5b:当日 fsck 坏链 83,108 条
// 即这一型),等于把一次 ref 抖动升级成整条推送链死亡。
import { splitDeadRefs, objectExists } from './git-refs-heal.mjs'
import {
  HOME_HEAL_FIXER_TIMEOUT_MS,
  HOME_HEAL_TTL_MS,
  healLockDecision,
  healLockText,
} from './lib/home-heal-lock.mjs'
import {
  resolveGitBin,
  gitVersion,
  resolveWorktree,
  resolveGitdir,
  needsGitdirPointer,
  resolveBackupDir,
  gitdirArchivePath,
  brokenRefsFromSnapshot,
} from './lib/gitdir.mjs'
// 凭据形状脱敏的**唯一实现**住在 lib(G-334 / G-400):本文件原先自带一份逐字相同的副本,
// 两份实现必漂移是本仓记过最多次的失效型,而这一族的失败形态是安静的 —— 漂了的一侧只会让
// 某些告警少打码或多打码,没有任何门会喊。`redactChildOutput` 在本文件里已不再有实现。
import { redactChildOutput } from './lib/secret-shape-redact.mjs'
// 公网探测的**告警身份归一**住在尺子那侧(§0.6 单一真相源,2026-10-17 立):派发层只负责把它填进
// dedupKey,不再自己拼含计数的身份。模块有 §22d 直跑守卫,import 不会触发采样。
import { classifyAlertIdentity } from './check-public-path-probe.mjs'
import { auditProdForeignWork } from './git-guardian-prod-foreign.mjs'

// 纯判据层(2026-10-21 原样搬出:守门 103 C1 行数上限;实现单源在 lib/git-guardian-pure.mjs)
import {
  NOTIFY_DEFAULT_WINDOW_MS,
  NOTIFY_DEFAULT_FAIL_COOLDOWN_MS,
  alertFingerprint,
  stableAlertFingerprint,
  parseNotifyState,
  shouldAlert,
  withAlertMark,
  maskEmail,
  notifyWindowMs,
  notifyFailCooldownMs,
  alertHeldTier,
  noteUndeterminedStreak,
  clearUndeterminedStreak,
  judgeRefsHealth,
  homeHealDue,
  classifyMergeLossOutcome,
} from './lib/git-guardian-pure.mjs'

// 对外出口与搬出前保持一致(原先这些是 export function;实现已单源到 lib,这里只做原路径再导出)。
export {
  alertFingerprint,
  stableAlertFingerprint,
  parseNotifyState,
  shouldAlert,
  withAlertMark,
  maskEmail,
  alertHeldTier,
  noteUndeterminedStreak,
  clearUndeterminedStreak,
  judgeRefsHealth,
  homeHealDue,
  classifyMergeLossOutcome,
}

// 工作树 / 真实 gitdir / 备份目录动态解析(不再硬编码 D: 盘;见 scripts/lib/gitdir.mjs 2026-09-15)
export const WORKTREE = resolveWorktree()
const GITDIR = resolveGitdir(WORKTREE)
const BACKUP = resolveBackupDir(WORKTREE)
/** origin = GitHub SSH(仓库唯一权威源;严禁改回 https,见 AGENTS.md §5b 铁律) */
const GITHUB_SSH_URL = 'ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git'
// 2026-10-23 机主令:GitCode/Gitee **代码镜像仓早已弃用**,此处不再保留任何镜像远端常量。
// 曾经的 gitee/gitcode 两个 URL 常量 + restoreRemoteConfig 里的写回循环,作用是在每次
// gitdir 自愈后把这两个远端**重新加回**仓库配置 —— 那正是"弃用后仍留痕迹"的活体来源:
// 只要自愈跑一轮,`git remote -v` 就又长出两条指向死镜像的远端,后续 fetch/push 会
// 拿它们当候选源,把 HEAD 拖进另一条线。现改为只认 origin(GitHub)一个远端。
/** GitHub 部署私钥;服务账户/交互账户都要用它,故写入仓库级 core.sshCommand */
const SSH_COMMAND =
  'ssh -i C:/Users/Administrator/.ssh/id_ed25519_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20'
const TASK_NAME = 'IHUI-AI git-guardian'
const LOG = join(WORKTREE, '.ihui-agent', 'state', 'git-guardian.log')
const POINTER = join(WORKTREE, '.git')
const EXPECTED_POINTER = `gitdir: ${GITDIR}\n`
// 嵌套 ref( depth>=2 )的期望值清单 —— gitdir 顶层文件,宿主清理不到(2026-09-12 立)
const REFS_MANIFEST = join(GITDIR, 'refs-manifest.json')

// —— 判红 → 邮件到人层(2026-09-24 立,§5e 唯一通道)——
// 此前守护判红只写 .ihui-agent/state/git-guardian.log:实测"合并吞并对账"抓到 38 个路径被合并抹掉
// 那类事,只有去翻日志的人才知道,而它的后果是**已入库功能被静默回滚**。到人一律经品牌派发器
// (apps/api/scripts/notify-deploy-failure.ts),不在本文件自拼 SMTP/Resend(守门 81 硬拦);
// 形态照抄 scripts/check-credential-health.mjs(同为 scripts/ 下 .mjs 的现役生产者)。
const NOTIFY_STATE = join(WORKTREE, '.ihui-agent', 'state', 'git-guardian-notify-state.json')
/** 投递失败标记:邮件寄不出去必须留可诊断痕迹(§5e),下一次成功投递自动清除 */
const NOTIFY_UNDEL = join(WORKTREE, '.ihui-agent', 'state', 'git-guardian-notify-UNDELIVERED.json')
/**
 * 发信台账**不在这里写**(2026-10-18 收口):账记在唯一出口
 * `apps/api/scripts/notify-deploy-failure.ts` 的 `recordMailAttempt` 上。
 * 本层原先也写一份(4 支各一行)—— 那会让每一次经我寄的信在发信量里**被数两遍**,
 * 用一个新谎替换掉旧的盲区;而生产侧的 `name`/`fp` 在出口行里已经有等价物
 * (subject 与 --alert-id),没有信息损失。
 */
const TSX_ENTRY = join(WORKTREE, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const BRAND_MAIL_SCRIPT = join(WORKTREE, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
/** 正文临时文件目录(§15 临时物项目内;§26 服务身份 TEMP 指向不定,不得信任 os.tmpdir) */
const NOTIFY_MSG_DIR = join(WORKTREE, '.ihui-agent', 'tmp', 'git-guardian-notify')
/** 派发器单次调用墙上时钟上限:tsx 冷启 + SMTP 握手最坏叠加(同 check-credential-health 实测值) */
const NOTIFY_DISPATCH_TIMEOUT_MS = 90_000

// —— 收敛器收尾对齐停摆 → 到人(2026-09-25 票 O74)——
// git-sync-converge 的 alignWorktreeAfterHeadMove 失败原先"只记日志":锁被长期占用时,
// 工作区会无声地一直落后 HEAD(§12d 的静默回滚温床)。收敛器本体是一次性进程不适合发信,
// 而本守护每 2 分钟一轮、已是全部自愈告警的派发点 ⇒ 状态由收敛器写
// (.ihui-agent/state/converge-align-state.json),这里读它并按阈值喊人。
// 阈值两个数都可被 env 覆盖(IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS),默认 3 / 600000。
const CONVERGE_ALIGN_STATE = join(WORKTREE, '.ihui-agent', 'state', 'converge-align-state.json')
const ALIGN_STALL_DEFAULT_FAILS = 3
const ALIGN_STALL_DEFAULT_AGE_MS = 10 * 60 * 1000

// —— 自动修复的节流与熔断(2026-10-04 立,回应"要自动修复而不是等人提")——
//
// 立因是实测的一次真停摆:10-03 07:41 失败后 **24.8 小时零动作**,而这段代码
// 原本只负责"喊人"。更糟的是告警文案给的唯一出路在结构上解不掉它
// (`alignWorktreeAfterHeadMove` 只在真推进 HEAD 后才调 ⇒ 本地已同步时跑收敛是空转,
// 台账永不归零)。也就是**这一格既不自愈、给出的出路也不自愈**,只剩人在中间。
//
// 修法是把它接进本守护已有的自愈链(与 heal*/healRefs 同挂点、同分支),顺序固定为
// **先自己修 → 修不好才喊**,且两道护栏:
//   ① 节流 `ALIGN_HEAL_THROTTLE_MS`:对齐器本机实测 40–51 秒(真仓),本守护每 2 分钟一轮,
//      不节流会在一次长故障里反复派生对齐器,把"修"本身变成新的负载源。
//   ② 熔断 `ALIGN_HEAL_MAX_ATTEMPTS`:自愈本身失败也要有上限,否则就是每轮重试一次的
//      无限循环 —— 那与"只喊人"只是换了个更吵的形态。
// 两道都可用 env 调;设 ALIGN_HEAL_DISABLED=1 可整体关掉自愈(回到纯喊人),便于取证对照。
const ALIGN_HEAL_THROTTLE_MS = Number(process.env.IHUI_ALIGN_HEAL_THROTTLE_MS || 30 * 60 * 1000)
const ALIGN_HEAL_MAX_ATTEMPTS = Number(process.env.IHUI_ALIGN_HEAL_MAX_ATTEMPTS || 3)
const ALIGN_HEAL_ATTEMPT_LOG = join(WORKTREE, '.ihui-agent', 'state', 'converge-align-heal-attempts.json')

// 〔归档@2026-10-25/门103 C1〕原 24 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l170-起-24-行


// 〔归档@2026-10-25/门103 C1〕原 29 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l196-起-29-行
export const AUTO_HEAL_LEDGER = {
  'converge-align': {
    mode: 'auto',
    where: 'checkConvergeAlignStall → healConvergeAlignStall',
    why: '幂等(重复跑同形)+ 只读判据(heal-worktree-tracked 自带对齐判据)+ 无回滚需求(只改索引/工作树副本,从不 checkout 别人的未提交文件)',
  },
  'ops-patrol': {
    mode: 'auto',
    where: 'auditOpsPatrol → check-ops-patrol.mjs --apply',
    why: '派发时已带 --apply,且动作自带 .stale-<stamp> 现场归档',
  },
  'merge-addition-loss': {
    // ⚠ 2026-10-04 复核改判:本条原先登记为 auto 且理由写「派发时已带 --apply」——
    //   **与代码事实相反**。全文件 `union-converge` 零处 execFileSync/spawnSync 派发,
    //   auditMergeAdditionLoss(:1717)只派 `[script, '--all-new']`,而 :1539 的设计注释
    //   白纸黑字写着「**只判不修**:自动重做合并的风险远大于收益;出口是
    //   `scripts/union-converge.mjs --apply`(**人来点**)」⇒ 该格真实形态是「只喊人 + 人来点」。
    //   这次错判能溜过,是因为台账的测试只校验**已登记项的形状**,不与代码对账
    //   (见 test 里 why 的正则:写得"对"而"错"的文案完全合规)。已同时补上对账测试。
    mode: 'manual',
    where: 'auditMergeAdditionLoss → check-merge-addition-loss.mjs --all-new(只判);出口由人点 union-converge.mjs --apply',
    why: '代码只判不修、出口由人点(:1539 明写"自动重做合并的风险远大于收益");而 union-converge --apply 实测一次 2–13 分钟且会**改写历史合并内容** —— 误自动执行等于在不可回滚的动作上拿别人的合并赌一把(需人判)',
  },
  'service-heal': {
    mode: 'auto',
    where: 'healUnresponsiveServices → heal-unresponsive-services.mjs --apply',
    why: '派发时已带 --apply,且自带三重封顶(consecutiveRounds/cooldown/maxRestartsPerWindow)',
  },
  // 复核改判(2026-10-04):原先把 7 个动作面塞进一个复合 key、where 只写"remediate() 阶梯",
  // 而其中三项**实际不在 remediate() 内** —— 挂在 main() 健康轮次的独立调用点
  // (worktree :3667 / rootseal :3669 / junction :3672)。台账是权威清单,where 定位不准
  // 会让下一个接手的人按错位置去查。已按真实挂点拆开。
  'pointer/env/refs/head': {
    mode: 'auto',
    where: 'remediate() 分层自愈阶梯(:3218 起,health 判据不通过时进入)',
    why: '幂等 + 由 coreHealthy 健康判据驱动(本仓 :243 记过"造好没装车"的教训,判据已覆盖工作树可用性)',
  },
  worktree: {
    mode: 'auto',
    where: 'main() 健康轮次独立调用点 healWorktreeTracked()(:3667),不在 remediate() 内',
    why: '幂等(索引==HEAD 且工作区内容==某祖先版本才动),任一不成立即放过 ⇒ 不覆盖他人未提交文件',
  },
  rootseal: {
    mode: 'auto',
    where: 'main() 健康轮次独立调用点 healRootSeal()(:3669),不在 remediate() 内',
    why: '幂等(重启会清掉 junction,而第三方重建真目录只需一次启动);只在真恢复时写日志',
  },
  junction: {
    mode: 'auto',
    where: 'main() 健康轮次独立调用点 healHomeJunctions()(:3672),不在 remediate() 内',
    why: '幂等;改道树被清掉后工具会立刻在 C 盘重建实体目录,不自动补回等于逼每一次提交绕过全部守门',
  },
  'recovery-source-refresh': {
    // 2026-10-04 复核补登记(此前**漏登记** —— 台账唯一会漂的方向就是漏登记,因为
    // 新增一格的人不会想到要回来改它,而现有测试遍历的是台账自身,抓不到)。
    mode: 'auto',
    where: 'refreshRecoverySource() 自身重跑(§5b 唯一空白层,15 分钟封顶)',
    why: '已带自动重跑 + 增量追平;恢复源陈旧会让 .git 真坏时**没有可回滚的副本**,故此格必须自己先修',
  },
  'host-timezone': {
    mode: 'manual',
    why: '尺子头注明写「只读:不改时区、不写注册表、不停/启服务」,且定级要求「不得自作主张改」—— 自动改时区会影响全机所有时间戳判读,后果面远超本守护',
  },
  'env-drift': {
    mode: 'manual',
    why: '动作面是生产凭据回填。自动回填等于无人核对地改密钥;错一个值的代价远大于停摆本身,且判据只报键名不给值(脱敏要求),无法在本层完成比对',
  },
  'disk-root-hygiene': {
    mode: 'manual',
    why: '动作面是删除文件,无回滚材料;误删不可逆,属"不可逆 + 无人工确认"这一档',
  },
  'public-path': {
    mode: 'manual',
    why: '告警正文自己要求「先用 --report 确认是目标端慢/失败(而非探针机抖动)」⇒ 判红不蕴含本机可修;此时自动重启本机服务属于在错误判断上动手',
  },
  'orphan-deletion-refs': {
    mode: 'manual',
    why: '命中的是「疑似误删他人文件」,字节归属需人判(§12d 零触碰他人未提交文件);自动回滚会覆盖当前持有者的现场',
  },
  'egress-ip-drift': {
    // 2026-10-21 立档时即登记(台账唯一会漂的方向是漏登记)。
    mode: 'manual',
    why: '可整改动作在腾讯云 EdgeOne 控制台改源站那一格,而本机无 EO API 凭据(实测 D:/DevEnv/secrets/ 无 tencent/edgeone 条目)⇒ 器物只能量到漂了并到人;自动"修"在这里不存在合法形态',
  },
  'prod-foreign-work': {
    // 2026-10-21 立档时即登记(生产签出外来工作,尺子 scripts/check-prod-checkout-foreign-work.mjs)。
    mode: 'manual',
    where: 'auditProdForeignWork → check-prod-checkout-foreign-work.mjs --json(只判不修)',
    why: '生产签出里的外来改动只有两条出路——"把活落进仓"或"确认可丢",都需人判;在别人的签出上代删代提交等于覆盖他人未提交工作(§12d 零触碰),器物绝不代做',
  },
}

const CHECK_ONLY = process.argv.includes('--check')
const STATUS_ONLY = process.argv.includes('--status')
const INSTALL = process.argv.includes('--install')
const DAEMON = process.argv.includes('--daemon')

export function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    mkdirSync(dirname(LOG), { recursive: true })
    appendFileSync(LOG, line + '\n')
  } catch {
    /* 日志失败不影响守护 */
  }
}

// —— git 可执行文件解析:复用共享库(不依赖 PATH,服务账户如 LocalSystem 仍可定位 PortableGit) ——
// 解析结果缓存于共享库;本处仅镜像 GIT_BIN / GIT_VERSION 供日志与 status() 展示。
let GIT_BIN = null
let GIT_VERSION = null
function syncGitMeta() {
  GIT_BIN = resolveGitBin()
  GIT_VERSION = gitVersion()
}

/**
 * 每次 git 调用显式带 `-c safe.directory=*`:
 * 服务账户(如 LocalSystem)与本机账户的 safe.directory 配置互不相通,
 * 显式传入可从根上消除 "dubious ownership" 这一整类失败。git ≥ 2.35.1 均支持。
 */
const GIT_SAFE_ARGS = ['-c', 'safe.directory=*']

/**
 * 守护派生 git 的输出预算(256MB)。取名而不逐点写数字:`for-each-ref` 这类**整表枚举**的输出
 * 体积随 tag 数长(本仓现读 2.3MB,而 `lost-commit/*`+`backup/*` 只会越来越多),任何写死在
 * 调用点的数字都会随时间腐烂成一条假告警。
 */
const GIT_ENUM_MAX_BUFFER = 256 * 1024 * 1024

function git(args, allowFail = false) {
  const bin = resolveGitBin()
  if (!bin) {
    if (allowFail) return null
    throw new Error('git 不可用:候选可执行文件均不可调用')
  }
  try {
    return execFileSync(bin, [...GIT_SAFE_ARGS, '-C', WORKTREE, ...args], {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
      windowsHide: true,
      // 2026-10-16 立:缺省 maxBuffer = 1MiB,而 `for-each-ref refs/heads refs/tags refs/remotes`
      // 在本仓现读 2,321,794 字节(23,695 条)⇒ 必然 ENOBUFS。allowFail 那一支把它吞成 null,
      // 于是"读不到 ref 面"在账面长成"清单里 7149 个 ref 全部缺失"——守护每 2 分钟据此自我修复
      // 一次(按清单撒 7149 枚松散 ref 再 pack),而盘上 ref 其实一枚没少。
      // 与门 99 那次同族:**缓冲区溢出不是"没有",它必须有自己的名字**(见 currentRefs 的 null 档)。
      maxBuffer: GIT_ENUM_MAX_BUFFER,
      // 2026-10-22 立:**守护的 git 派生一律不抢"可选锁"**。
      // 病灶:本守护每 12 秒巡检一轮,`git status`/`diff` 会"顺手"刷新索引 stat 缓存 ⇒ 抢
      // index.lock;而提交链在钩子窗口期(实测 31 门约 30s)一直持有索引 ⇒ 两者反复相撞,
      // safe-commit 撞锁后重试会**重跑整条 pre-commit**(实测同一枚提交出现两轮 31 门,
      // 端到端从 60s 涨到 3 分钟)。
      // GIT_OPTIONAL_LOCKS=0 只关"可选锁",add/commit/checkout 的必需锁不受影响 ⇒ 写路径语义不变。
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

/**
 * `.git` 指针文件是否与期望一致。
 * 关键(2026-09-15):常规仓库的 `.git` 是**真实目录**(非指针文件),此时绝不可按
 * separate-git-dir 逻辑去校验/重建指针,否则 healPointer 会 rm -rf 整个 `.git` 目录 → 删库。
 * 判定:needsGitdirPointer()=true(`.git` 本应是指针)才校验指针内容;
 *       否则只要 `.git` 目录存在即视为 OK。
 */
function pointerOk() {
  if (!needsGitdirPointer()) {
    // 常规仓库:`.git` 即 gitdir 目录,存在即可
    return existsSync(POINTER)
  }
  try {
    return readFileSync(POINTER, 'utf8').trim() === `gitdir: ${GITDIR}`
  } catch {
    return false
  }
}

/** 实体 gitdir 是否具备可用骨架 */
function gitdirOk() {
  return (
    existsSync(join(GITDIR, 'HEAD')) &&
    existsSync(join(GITDIR, 'objects')) &&
    existsSync(join(GITDIR, 'refs'))
  )
}

/** git 命令视角是否可用(最终判据) */
function gitUsable() {
  const head = git(['rev-parse', 'HEAD'], true)
  return !!head
}

/**
 * 工作树视角是否可用 —— 与 gitUsable() **不是同一件事**,这一格此前无人看守。
 *
 * 实测事故(2026-09-28 18:29):`D:/IHUI-AI-git-repo/config` 的 `core.bare` 被翻成 `true`,
 * 于是守护自评 `pointerOk:true / gitdirOk:true / gitUsable:true / dirty:0`,而工作树里
 * **每一条** git 命令都报 `fatal: this operation must be run in a work tree` ——
 * 提交、钩子、落地器、推送门全部不可用,而账面全绿。`rev-parse HEAD` 在裸仓库下照样成功,
 * 所以"git 可用"从来推不出"这个仓库还能被工作树使用"。
 *
 * 为什么会带上裸档:§5b 的恢复是 `cpSync(BACKUP → GITDIR)`,而备份是整份 gitdir 副本 ——
 * 它自己的 `core.bare=true` 会随任何一次恢复**注回**活仓库。故本自愈同时归一两侧,
 * 只修活仓库等于留一颗定时炸弹。
 */
function worktreeUsable() {
  return git(['rev-parse', '--is-inside-work-tree'], true) === 'true'
}

/**
 * 核心健康判据 —— main 与 daemon **共用这一份实现**(两处各写必然漂移)。
 *
 * 漂移的实证:`core.bare=true` 时 `pointerOk / gitdirOk / gitUsable` **三条全绿**
 * (`rev-parse` 在裸档下照样成功),所以旧表达式把这一型判成"健康"、直接进健康分支早退,
 * `remediate()` 结构上到不了 —— 我先前落进 `remediate()` 的自愈**在提交链上生效次数为 0**,
 * 实测活仓库带裸档跑了数小时而守护每 2 分钟一趟、每趟都把其余 heal* 跑完再 return 0。
 * "函数在、判据对、调度路径不经过它"与本仓反复登记的「造好没装车」是同一型(守门 70/76/81)。
 */
function coreHealthy(s) {
  return Boolean(s.pointerOk && s.gitdirOk && s.gitUsable && s.worktreeUsable)
}

/** 用显式 `--git-dir` 读写某个 gitdir 的 core.bare(裸档下 `-C 工作树` 这条路是走不通的) */
function readBareFlag(gitdir = GITDIR) {
  const bin = resolveGitBin()
  if (!bin) return null
  try {
    return execFileSync(bin, [...GIT_SAFE_ARGS, '--git-dir', gitdir, 'config', '--get', 'core.bare'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      windowsHide: true,
    }).trim()
  } catch {
    return null
  }
}

function writeBareFalse(gitdir = GITDIR) {
  const bin = resolveGitBin()
  if (!bin) return false
  try {
    execFileSync(bin, [...GIT_SAFE_ARGS, '--git-dir', gitdir, 'config', 'core.bare', 'false'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      windowsHide: true,
    })
    return readBareFlag(gitdir) === 'false'
  } catch {
    return false
  }
}

/**
 * 把"活仓库 + 本地恢复源"两侧的 `core.bare` 一起归一为 false。
 * 恢复源不修:下一次 cpSync 恢复就把裸档注回来,同一故障必然复发。
 * `gitdir` / `backup` / `probeUsable` 仅供镜像测试在临时仓库上取证 —— 生产调用一律走默认值。
 * `captureAudit` 同为测试通道:传 null 档可避免在临时仓库取证时真去派生 PowerShell /
 * 往运行态目录写件;生产调用不传即走默认的 `captureBareFlipAudit`。
 */
function healWorktreeBare({
  gitdir = GITDIR,
  backup = BACKUP,
  probeUsable = worktreeUsable,
  captureAudit = captureBareFlipAudit,
} = {}) {
  const liveWas = readBareFlag(gitdir)
  const backupWas = existsSync(join(backup, 'config')) ? readBareFlag(backup) : null
  if (liveWas !== 'true' && backupWas !== 'true') return probeUsable()
  // 修复**之前**先取全文指纹(healthy 路径不付这个代价);取证与这里的取样同一时刻两侧。
  const cfgBeforeLive = configFingerprint(gitdir)
  const cfgBeforeBackup = existsSync(join(backup, 'config')) ? configFingerprint(backup) : null
  // —— 取证必须在修复**之前**(2026-09-29 立)——
  // 写回 false 之后,config 的 mtime 就是"我修的那一刻"而非"别人翻车的那一刻",而当时开着的
  // 进程也大概率已经退了;先落一份现场审计,规则②(进程生日 ≈ config mtime)才有锚点。
  // 它不参与任何判定、不改退出码、不改下面的修复与日志(失败也不得拦住修复)。
  try {
    captureAudit({ gitdir, backup, liveWas, backupWas })
  } catch (e) {
    log('现场取证未落盘(不影响修复): ' + String((e && e.message) || e))
  }
  const liveOk = writeBareFalse(gitdir)
  const backupOk = backupWas === 'true' ? writeBareFalse(backup) : true
  const usable = probeUsable()
  // G-111 机主拍板出路②:归一那一刻顺手把**前后 config 全文哈希**落进守护日志。
  // 完整 64 位而不是短前缀 —— 这条行的用途是将来与 `flip-*.json`(修复前那份取证)以及
  // 任何可疑进程的写入痕迹做**逐字比对**,截断就没法比(§1 那条"短 sha 会腐烂"说的是文档指针,
  // 这里是机器取证面,越全越好)。读不到一律印「未判定」,不印空哈希。
  const fpText = (b, a) => `${b.sha256 || '未判定'}→${a.sha256 || '未判定'}(${b.bytes ?? '?'}B→${a.bytes ?? '?'}B)`
  log(
    `${usable && liveOk && backupOk ? '修复' : '修复失败'}: core.bare 归一为 false ` +
      `(活仓库 ${liveWas}→${readBareFlag(gitdir)},恢复源 ${backupWas}→${existsSync(join(backup, 'config')) ? readBareFlag(backup) : '无 config'})` +
      ` | 工作树可用=${usable}` +
      ` | config 全文哈希 live ${fpText(cfgBeforeLive, configFingerprint(gitdir))}` +
      (cfgBeforeBackup ? ` | backup ${fpText(cfgBeforeBackup, configFingerprint(backup))}` : ' | backup 无 config(不参与)'),
  )
  return usable && liveOk && backupOk
}

// 〔归档@2026-10-25/门103 C1〕原 18 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l531-起-18-行

/** 现场审计落点(在 `.ihui-agent/state/` 下,已被 .gitignore 整目录覆盖 —— 实测 `git check-ignore` 命中,故不需要也不应改 .gitignore) */
const BARE_AUDIT_DIR = join(WORKTREE, '.ihui-agent', 'state', 'git-bare-flip-audit')
/** 只留最新 20 份(每小时一次翻车也够看近两天,而运行态目录不得无限长) */
const BARE_AUDIT_KEEP = 20
/**
 * 人读报告里"只被时间窗命中"的条目上限。真机实测一次快照 351 进程 / 83 条时间窗命中,
 * 全打印会把**规则①那一条精确嫌疑**淹掉;件内 candidates 始终是完整清单。
 * 截断必须报名(见 formatBareFlipAuditReport 的"另有 N 条未打印"),静默截断与"没有嫌疑人"同形。
 */
const BARE_AUDIT_REPORT_TIME_ONLY_CAP = 15
/** 规则②时间窗:进程生日落在 config mtime ±10 分钟内即算嫌疑人 */
const BARE_AUDIT_WINDOW_MS = 10 * 60 * 1000
/** 本维在位的日期 —— 报告里"尚无记录"必须带上它,否则读的人会把"零记录"当成"零事故" */
const BARE_AUDIT_SINCE = '2026-09-29'
/** 审计件名形状(唯一的保留判据) */
const BARE_AUDIT_FILE_RE = /^flip-[0-9A-Za-z._-]+\.json$/
/**
 * 规则①(命令行内容)的模式串 **唯一一份**。candidates 的命中判定与写进 JSON 的规则名
 * 都从这个数组推导;在任何一端再抄一份正则就是第二个真相。
 */
const BARE_AUDIT_CMD_RULES = [
  { id: 'cmdline:live-gitdir-name', re: /IHUI-AI-git-repo/i },
  { id: 'cmdline:git-repo-token', re: /git-repo/i },
  { id: 'cmdline:core-bare-arg', re: /core\.bare/i },
  { id: 'cmdline:workbuddy-portable-git', re: /\.workbuddy[\\/]+binaries/i },
]
/** 派生 PowerShell 的绝对路径候选:裸名在本机不在 PATH(计划任务/服务身份下必然落空) */
function resolvePowerShellBin() {
  const roots = []
  if (process.env.SystemRoot) roots.push(join(process.env.SystemRoot, 'System32'))
  roots.push('C:/Windows/System32')
  for (const r of roots) {
    const p = join(r, 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    if (existsSync(p)) return p
  }
  return null
}

/**
 * 取进程清单的 PowerShell 脚本。**必须纯 ASCII**(§26:控制台代码页会把非 ASCII 命令串吃掉),
 * 且刻意**不带**任何中文。输出每行 `Name|ProcessId|ParentProcessId|CreationDate|CommandLine`。
 *
 * 两处由真机探测(`.ihui-agent/tmp/bare-sentinel/probe.mjs`)逼出来的写法,都不是审美:
 *  ① CreationDate **原样吐 CIM 字符串**(`yyyyMMddHHmmss.ffffff±zzz`),不在 PS 侧转换 ——
 *     第一版用 `[System.Management.ManagementDateTimeConverter]`,在本机实测 336 个进程里
 *     **只有 1 个**转成功(该类型在 PowerShell 7 下没被加载),规则②因此整维空转;
 *  ② 命令行内的换行折成空格 —— 否则一条多行命令行会把后面几行变成"没有四个分隔符"的碎片,
 *     实测一次快照 51 行被判 malformed(记录本身还在,但白丢一半可读性)。
 */
const PS_PROCESS_SNAPSHOT = [
  'try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }',
  'Get-CimInstance Win32_Process | ForEach-Object {',
  '  $cd = ""',
  '  if ($_.CreationDate) { $cd = [string]$_.CreationDate }',
  '  $cl = ""',
  '  if ($_.CommandLine) { $cl = ("" + $_.CommandLine) -replace "[\\r\\n\\t]+", " " }',
  '  $pp = ""',
  '  if ($_.ParentProcessId) { $pp = [string]$_.ParentProcessId }',
  '  Write-Output ("" + $_.Name + "|" + $_.ProcessId + "|" + $pp + "|" + $cd + "|" + $cl)',
  '}',
].join('\n')

/**
 * 跑一次进程快照。返回值刻意是**三态**(不是"要么数组要么空数组"):
 * `spawn.state = ok | failed | timeout | enoent | not-win32 | no-powershell`,
 * 三种失败各有各的文案 —— 实现收尾时把"超时"标成"派生失败"就是把没量到写成量到了(§22c)。
 */
function snapshotProcesses() {
  if (process.platform !== 'win32') {
    return { state: 'not-win32', reason: `非 win32 平台(${process.platform}),Windows 进程清单无从取`, stdout: '' }
  }
  const bin = resolvePowerShellBin()
  if (!bin) {
    return { state: 'no-powershell', reason: 'Windows PowerShell 绝对路径候选均不存在', stdout: '' }
  }
  try {
    const stdout = execFileSync(
      bin,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_PROCESS_SNAPSHOT],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 20000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
    )
    return { state: 'ok', reason: null, stdout: String(stdout || '') }
  } catch (e) {
    const code = e && (e.code === 'ENOENT' ? 'ENOENT' : '')
    const killed = Boolean(e && (e.signal === 'SIGTERM' || code === 'ETIMEDOUT' || /timed out|ETIMEDOUT/i.test(String((e && e.message) || ''))))
    if (code === 'ENOENT') {
      return { state: 'enoent', reason: `派生 ${bin} 失败(ENOENT:文件在而不可执行)`, stdout: '' }
    }
    if (killed) {
      return { state: 'timeout', reason: 'PowerShell 被本件自己的 timeout(20s)终止', stdout: '' }
    }
    return {
      state: 'failed',
      reason: `PowerShell 非零退出:${String((e && e.message) || e).split('\n')[0]}`,
      stdout: String((e && e.stdout) || ''),
    }
  }
}

/**
 * 解析进程 CreationDate。**必须同时认两种形态**:
 *  - Windows CIM 原样串 `yyyyMMddHHmmss.ffffff±zzz`(真机实际输出的就是这个,`+480` = 分钟偏移);
 *  - ISO-8601(测试夹具与跨平台取数用)。
 * 解析不出 ⇒ `ms:null` 且把**原文留着**,绝不把"量不到"写成"不在窗口内"(那是两件事)。
 */
function parseProcessCreationDate(raw) {
  const s = String(raw === null || raw === undefined ? '' : raw).trim()
  if (!s) return { iso: null, ms: null }
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d+))?\s*(?:([+-])(\d{1,4}))?$/)
  if (m) {
    if (m[8] === undefined || m[9] === undefined) return { iso: s, ms: null } // 没有偏移 ⇒ 无从定 UTC 时刻,不猜
    const frac = Number((m[7] || '0').slice(0, 3))
    let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], Number.isFinite(frac) ? frac : 0)
    const off = Number(m[9])
    t -= (m[8] === '-' ? -off : off) * 60_000
    return { iso: new Date(t).toISOString(), ms: t }
  }
  const alt = Date.parse(s)
  if (Number.isFinite(alt)) return { iso: new Date(alt).toISOString(), ms: alt }
  return { iso: s, ms: null }
}

/**
 * 解析快照文本 —— **纯函数**,证明判据取材面的用例只喂构造面,不依赖此刻真仓的进程状态
 * (守门 103 T12 那一课:瞬时状态会让断言时对时错)。
 */
function parseProcessSnapshot(stdout) {
  const processes = []
  const malformed = []
  for (const raw of String(stdout || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split('|')
    if (parts.length < 4) {
      malformed.push(line)
      continue
    }
    const name = parts[0].trim()
    const pid = parts[1].trim()
    const ppid = parts[2].trim()
    const created = parseProcessCreationDate(parts[3])
    // 第五段起整体是命令行:命令行自己含 `|` 时不得被切碎(切碎了就把一次 git 调用读成两条)
    const cmdline = parts.slice(4).join('|')
    processes.push({
      Name: name || null,
      ProcessId: pid !== '' && Number.isFinite(Number(pid)) ? Number(pid) : pid || null,
      ParentProcessId: ppid !== '' && Number.isFinite(Number(ppid)) ? Number(ppid) : ppid || null,
      CreationDate: created.iso,
      CommandLine: cmdline,
      // 内部字段:规则②用;不落 JSON 顶层(顶层按规格只留那五个字段名)
      __createdMs: Number.isFinite(created.ms) ? created.ms : null,
      // "命令行取不到(权限)"与"命令行确实为空"是两件事,分开报
      __cmdlineReadable: parts.length >= 5 && cmdline !== '',
    })
  }
  return { processes, malformed }
}

/** 规则①/②的嫌疑人挑选 —— 纯函数;命中任一规则即进名单,并写明是被**哪条**规则命中的 */
function selectBareFlipCandidates(processes, { anchorMs, windowMs = BARE_AUDIT_WINDOW_MS } = {}) {
  const out = []
  for (const p of processes || []) {
    const rules = []
    const cl = typeof p.CommandLine === 'string' ? p.CommandLine : ''
    for (const rule of BARE_AUDIT_CMD_RULES) {
      if (rule.re.test(cl)) rules.push(rule.id)
    }
    if (Number.isFinite(anchorMs) && Number.isFinite(p.__createdMs) && Math.abs(p.__createdMs - anchorMs) <= windowMs) {
      rules.push(`time-window:within-${windowMs}ms-of-config-mtime`)
    }
    if (rules.length > 0) {
      out.push({
        Name: p.Name,
        ProcessId: p.ProcessId,
        ParentProcessId: p.ParentProcessId,
        CreationDate: p.CreationDate,
        CommandLine: cl,
        matchedRules: rules,
      })
    }
  }
  return out
}

/**
 * 这份快照到底成不成立 —— 三种"没量到"各自点名,且**空清单不得记 ok**。
 * `candidates` 为空而清单本身量到了,结论是 `ok`(那说明写入者不在清单里,是**证据**不是故障)。
 */
function bareAuditSelfCheck({ spawn, processes, malformedCount, cmdlineMissing, timeMissing, anchorMs }) {
  const reasons = []
  if (!spawn || spawn.state !== 'ok') {
    reasons.push(`进程清单未取到:${spawn ? spawn.state + '(' + (spawn.reason || '未写原因') + ')' : '取数函数没有返回'}`)
  }
  const count = (processes || []).length
  if (spawn && spawn.state === 'ok' && count === 0) {
    reasons.push('进程清单为空(0 行可解析)—— 空扫不得读成"已确认没有嫌疑人"')
  }
  if (cmdlineMissing > 0) {
    reasons.push(`${cmdlineMissing} 个进程的命令行取不到(多为权限不足:跨会话/受保护进程)⇒ 规则①对这些进程未判定`)
  }
  if (timeMissing > 0) {
    reasons.push(`${timeMissing} 个进程的 CreationDate 量不到/解不出 ⇒ 规则②对这些进程未判定`)
  }
  if (malformedCount > 0) {
    reasons.push(`${malformedCount} 行形态不认(既不是有效记录也不是空行),未计入清单`)
  }
  if (!Number.isFinite(anchorMs)) {
    reasons.push('config mtime 量不到 ⇒ 规则②(进程生日落在 mtime 附近)整维未判定')
  }
  const undetermined = reasons.length > 0
  const partial = undetermined && count > 0 && spawn && spawn.state === 'ok'
  return {
    verdict: undetermined ? (partial ? 'partial' : 'undetermined') : 'ok',
    reasons,
    counts: {
      processes: count,
      malformed: malformedCount || 0,
      cmdlineMissing: cmdlineMissing || 0,
      timeMissing: timeMissing || 0,
      candidates: 0, // 由调用方补
    },
  }
}

/** 某一侧 gitdir 的现场读数(path + bare 现值 + config 的 mtime/ctime);取不到的字段一律点名原因 */
/**
 * 某个 gitdir 的 `config` **全文**指纹(2026-10-16 补,G-111 机主拍板出路②的那半格)。
 * 为什么要全文哈希而不是只记 `core.bare` 的值:翻写者若同时动了别的键(实测有人连 `[core]`
 * 段一起改),只看 bare 一档永远看不见"还改了谁";而 SACL 那条机器级路被机主否了,
 * 邻居名单就只能靠"归一那一刻自己留下前后全文哈希"去对。
 * 三态:读不到 ⇒ `{sha256:null, bytes:null, reason}` —— **绝不**把读不到折成空串哈希
 * (那是 §0.3 明令禁止的"把没判写成判过")。
 */
export function configFingerprint(gitdir) {
  const configFile = gitdir ? join(gitdir, 'config') : null
  if (!configFile || !existsSync(configFile)) {
    return { configFile: configFile || null, sha256: null, bytes: null, reason: 'config 文件取不到' }
  }
  try {
    const buf = readFileSync(configFile)
    return { configFile, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length, reason: null }
  } catch (e) {
    return { configFile, sha256: null, bytes: null, reason: '读 config 全文失败:' + String((e && e.message) || e) }
  }
}

function bareAuditSide(gitdir, { readBare = readBareFlag } = {}) {
  const configFile = gitdir ? join(gitdir, 'config') : null
  const fp = configFingerprint(gitdir)
  const side = {
    path: gitdir || null,
    configFile,
    bare: null,
    configSha256: fp.sha256,
    configBytes: fp.bytes,
    configMtime: null,
    configCtime: null,
    configMtimeMs: null,
    undetermined: [],
  }
  if (fp.sha256 === null) side.undetermined.push('config 全文哈希未判定:' + fp.reason)
  if (!configFile || !existsSync(configFile)) {
    side.undetermined.push('config 文件不存在 ⇒ bare/mtime/ctime 全部未判定(不读成"没有裸档")')
    return side
  }
  try {
    const st = statSync(configFile)
    side.configMtime = new Date(st.mtimeMs).toISOString()
    side.configCtime = new Date(st.ctimeMs).toISOString()
    side.configMtimeMs = st.mtimeMs
  } catch (e) {
    side.undetermined.push('config stat 失败:' + String((e && e.message) || e))
  }
  let v = null
  try {
    v = readBare(gitdir)
  } catch (e) {
    side.undetermined.push('读 core.bare 抛错:' + String((e && e.message) || e))
    return side
  }
  if (v === null || v === undefined) side.undetermined.push('core.bare 取不到(git 不可调用或键不存在)')
  else side.bare = v
  return side
}

/**
 * 保留期决策 —— **纯函数**,输入是目录条目(名字 + 是否普通文件 + 是否重解析点)。
 * 只允许删 `flip-*.json` 且必须是普通文件、且 lstat 不是链接;其余一律进 `skipped` 并点名原因。
 * 名字按 UTC 时间戳字典序即时间序(`flip-YYYYMMDDTHHmmss...Z.json`)。
 */
function decideBareFlipRetention(entries, keep = BARE_AUDIT_KEEP) {
  const matched = []
  const skipped = []
  for (const e of entries || []) {
    const shapeOk = BARE_AUDIT_FILE_RE.test(String(e.name))
    if (!shapeOk) {
      skipped.push({ name: e.name, reason: '不是 flip-*.json 形状(保留期不得碰它)' })
      continue
    }
    if (e.isLink) {
      skipped.push({ name: e.name, reason: '是重解析点/符号链接 —— 删它等于删链接指向的真实文件(§26 同型事故)' })
      continue
    }
    if (!e.isFile) {
      skipped.push({ name: e.name, reason: '不是普通文件(目录/设备),不递归不删' })
      continue
    }
    matched.push(e.name)
  }
  const sorted = [...matched].sort()
  const overflow = Math.max(0, sorted.length - Math.max(0, keep))
  return {
    delete: sorted.slice(0, overflow),
    kept: sorted.slice(overflow),
    skipped,
    overflow,
  }
}

/** 目录条目的实地读取(把 lstat 的判定与"名字形状"分开,便于纯函数取证) */
function readBareFlipEntries(dir) {
  let names = []
  try {
    names = readdirSync(dir)
  } catch (e) {
    return { entries: null, error: String((e && e.message) || e) }
  }
  const entries = []
  for (const name of names) {
    let isFile = false
    let isLink = false
    try {
      const st = lstatSync(join(dir, name)) // lstat:绝不跟随重解析点
      isLink = st.isSymbolicLink() || st.isFIFO() || st.isSocket()
      isFile = st.isFile() && !st.isSymbolicLink()
    } catch {
      isFile = false
      isLink = false
    }
    entries.push({ name, isFile, isLink })
  }
  return { entries, error: null }
}

/** 审计件名(UTC 时间戳,字典序即时间序) */
function bareAuditFileName(now = Date.now()) {
  return 'flip-' + new Date(now).toISOString().replace(/[:]/g, '').replace(/\./g, '') + '.json'
}

/** 最近一份审计件(供 --status 的 bareAudit 字段与报告入口共用);取不到一律 null 并给原因 */
function latestBareFlipAuditFile(dir = BARE_AUDIT_DIR) {
  if (!existsSync(dir)) return { file: null, reason: '目录尚不存在(本维自 ' + BARE_AUDIT_SINCE + ' 起才在位)' }
  const { entries, error } = readBareFlipEntries(dir)
  if (error) return { file: null, reason: '读目录失败:' + error }
  const names = entries.filter((e) => BARE_AUDIT_FILE_RE.test(e.name) && e.isFile).map((e) => e.name)
  if (names.length === 0) return { file: null, reason: '目录里没有 flip-*.json(不等于没翻过 —— 见报告首行)' }
  names.sort()
  return { file: names[names.length - 1], reason: null }
}

/**
 * 检出裸档那一刻的现场取证落盘。**全程 best-effort**:任何一步失败都不抛、不改修复行为,
 * 但**必须留一行可见日志**(§5e 的"失败必须响"—— 静默失败的取证等于没取证)。
 */
function captureBareFlipAudit({
  gitdir = GITDIR,
  backup = BACKUP,
  liveWas = null,
  backupWas = null,
  dir = BARE_AUDIT_DIR,
  now = Date.now(),
  runSnapshot = snapshotProcesses,
  readBare = readBareFlag,
} = {}) {
  const spawn = (() => {
    try {
      return runSnapshot() || { state: 'failed', reason: '取数函数返回空', stdout: '' }
    } catch (e) {
      return { state: 'failed', reason: '取数抛错:' + String((e && e.message) || e), stdout: '' }
    }
  })()
  const live = bareAuditSide(gitdir, { readBare })
  const backupSide = existsSync(join(backup, 'config'))
    ? bareAuditSide(backup, { readBare })
    : { path: backup, configFile: join(backup, 'config'), bare: null, configMtime: null, configCtime: null, configMtimeMs: null, undetermined: ['恢复源没有 config 文件(不参与 mtime 锚点)'] }
  const { processes, malformed } = parseProcessSnapshot(spawn.stdout)
  // 锚点取**被翻坏那一侧**的 config mtime;取不到 ⇒ 规则②整维未判定(不猜、也不记成"没有")
  const anchorMs = Number.isFinite(live.configMtimeMs) ? live.configMtimeMs : null
  const candidates = selectBareFlipCandidates(processes, { anchorMs })
  const cmdlineMissing = processes.filter((p) => !p.__cmdlineReadable).length
  const timeMissing = processes.filter((p) => !Number.isFinite(p.__createdMs)).length
  const selfCheck = bareAuditSelfCheck({
    spawn,
    processes,
    malformedCount: malformed.length,
    cmdlineMissing,
    timeMissing,
    anchorMs,
  })
  selfCheck.counts.candidates = candidates.length
  const payload = {
    schema: 'git-bare-flip-audit/v1',
    detectedAt: new Date(now).toISOString(),
    detectedBy: 'scripts/git-guardian.mjs healWorktreeBare(修复前取证)',
    repairIntent: { liveWas, backupWas },
    sides: {
      liveGitdir: { ...live, undeterminedReasons: live.undetermined },
      backup: { ...backupSide, undeterminedReasons: backupSide.undetermined },
    },
    anchor: {
      configFile: live.configFile,
      configMtimeMs: anchorMs,
      windowMs: BARE_AUDIT_WINDOW_MS,
      rule: '规则①命令行模式命中(见 cmdRules)∨ 规则②进程 CreationDate 落在 config mtime ±windowMs',
    },
    cmdRules: BARE_AUDIT_CMD_RULES.map((r) => ({ id: r.id, pattern: r.re.source })),
    processSnapshot: {
      source: 'Get-CimInstance Win32_Process -> Name|ProcessId|ParentProcessId|CreationDate|CommandLine(CIM 原样串,由本件解析成 ISO-UTC)',
      powershellBin: resolvePowerShellBin(),
      spawnState: spawn.state,
      spawnReason: spawn.reason || null,
      count: processes.length,
      malformedLines: malformed.length,
      processes: processes.map((p) => ({
        Name: p.Name,
        ProcessId: p.ProcessId,
        ParentProcessId: p.ParentProcessId,
        CreationDate: p.CreationDate,
        CommandLine: p.CommandLine,
      })),
    },
    candidates,
    selfCheck,
  }
  try {
    mkdirSync(dir, { recursive: true })
    const file = join(dir, bareAuditFileName(now))
    writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
    const decision = decideBareFlipRetention(readBareFlipEntries(dir).entries || [])
    for (const name of decision.delete) {
      try {
        rmSync(join(dir, name), { force: true })
      } catch (e) {
        log(`保留期清理失败(不递归、不重试别的): ${name} — ${String((e && e.message) || e)}`)
      }
    }
    log(
      `现场取证已落盘: ${basename(file)}(进程 ${processes.length} 条 / 嫌疑 ${candidates.length} 条 / 自证 ${selfCheck.verdict})` +
        (decision.delete.length ? ` | 按保留期删 ${decision.delete.length} 份旧件` : ''),
    )
    return basename(file)
  } catch (e) {
    log('现场取证未落盘(不影响修复): ' + String((e && e.message) || e))
    return null
  }
}

/**
 * **打印面**的命令行脱敏。落盘的审计件留在 `.ihui-agent/state/`(gitignored、不出机)保留原文 ——
 * 那是取证价值所在;而人读报告会被贴进日志/台账/聊天,§5d"凭据不入日志"这一条管的是这一面。
 * 只替值、不替键名,`core.bare true` 这类判据字样逐字保留。
 */
function redactCmdlineForPrint(cl) {
  return String(cl || '')
    .replace(/((?:token|secret|password|passwd|api[_-]?key|access[_-]?key|authorization|bearer)[\w-]*\s*[=:]\s*)\S+/gi, '$1***')
    .replace(/([?&](?:key|token|sig|access_token|password)=)[^&\s]+/gi, '$1***')
}

/**
 * `--bare-audit-report` 的组装 —— 纯格式化(输入是已读出的记录数组),便于零副作用取证。
 * 首行必须回答"零记录 ≠ 零事故",否则读的人会把"这里还没在位"当成"仓库从没翻过车"。
 */
function formatBareFlipAuditReport(records, { dir = BARE_AUDIT_DIR, unreadable = [], missingDir = null } = {}) {
  const lines = []
  lines.push(`core.bare 翻车现场审计(${dir})— 保留最近 ${BARE_AUDIT_KEEP} 份`)
  lines.push('提示:命令行在本报告里已对凭据值脱敏(`--password=xxx` → `--password=***`),审计件内保留原文;件在 .ihui-agent/state 下,gitignored、不出机。')
  if (!records.length) {
    lines.push(
      `尚无记录(不等于没翻过 —— 守护这一维从 ${BARE_AUDIT_SINCE} 起才在位` +
        (missingDir ? ';目录本身还不存在:' + missingDir : '') +
        ')',
    )
  }
  for (const r of records) {
    const cands = Array.isArray(r.candidates) ? r.candidates : []
    let shownTimeOnly = 0
    let hiddenTimeOnly = 0
    lines.push(
      `· ${r.detectedAt || '(无 detectedAt)'} | 活仓库=${r.sides?.liveGitdir?.bare ?? '未判定'}` +
        ` 恢复源=${r.sides?.backup?.bare ?? '未判定'} | 自证=${r.selfCheck?.verdict ?? '未判定'}` +
        ` | 进程=${r.processSnapshot?.count ?? '?'} 嫌疑=${cands.length}`,
    )
    for (const c of cands) {
      // 只被规则②(时间窗)命中的条目可以很多(实测一次 351 进程里 83 条),打印面截断但
      // **必须报名**并指向件内原文 —— 静默截断与"这一族没有嫌疑人"在账面上长得一样。
      const onlyTimeWindow = (c.matchedRules || []).length > 0 && (c.matchedRules || []).every((r) => r.startsWith('time-window'))
      if (onlyTimeWindow && shownTimeOnly >= BARE_AUDIT_REPORT_TIME_ONLY_CAP) {
        hiddenTimeOnly += 1
        continue
      }
      if (onlyTimeWindow) shownTimeOnly += 1
      lines.push(
        `    ↳ ${c.Name || '?'} pid=${c.ProcessId ?? '?'} ppid=${c.ParentProcessId ?? '?'} ` +
          `born=${c.CreationDate || '未判定'} rules=[${(c.matchedRules || []).join(', ')}]`,
      )
      const cl = redactCmdlineForPrint(c.CommandLine)
      if (cl) lines.push(`        cmd: ${cl.length > 240 ? cl.slice(0, 240) + '…' : cl}`)
    }
    if (hiddenTimeOnly > 0) {
      lines.push(
        `    …另有 ${hiddenTimeOnly} 条只被时间窗(规则②)命中的条目未打印(打印上限 ${BARE_AUDIT_REPORT_TIME_ONLY_CAP}),` +
          '全量在件内 candidates 数组里 —— 规则①的命令行命中一律逐条打印',
      )
    }
    for (const why of r.selfCheck?.reasons || []) lines.push(`    ⚠️ ${why}`)
  }
  for (const u of unreadable) lines.push(`⚠️ 无法读取(不计入结论): ${u.name} — ${u.reason}`)
  return lines.join('\n')
}

/** 读那批 JSON(只读问责入口) */
function readBareFlipAuditRecords(dir = BARE_AUDIT_DIR) {
  if (!existsSync(dir)) {
    return { records: [], unreadable: [], missingDir: '目录不存在', dir }
  }
  const { entries, error } = readBareFlipEntries(dir)
  if (error) return { records: [], unreadable: [], missingDir: error, dir }
  const records = []
  const unreadable = []
  const names = entries.filter((e) => BARE_AUDIT_FILE_RE.test(e.name) && e.isFile).map((e) => e.name)
  names.sort()
  for (const name of names) {
    try {
      records.push({ file: name, ...JSON.parse(readFileSync(join(dir, name), 'utf8')) })
    } catch (e) {
      unreadable.push({ name, reason: String((e && e.message) || e) })
    }
  }
  return { records, unreadable, missingDir: null, dir }
}

function bareAuditReportMain(json) {
  const { records, unreadable, missingDir, dir } = readBareFlipAuditRecords()
  if (json) {
    console.log(JSON.stringify({ dir, keep: BARE_AUDIT_KEEP, since: BARE_AUDIT_SINCE, records, unreadable, missingDir }, null, 1))
  } else {
    console.log(formatBareFlipAuditReport(records, { dir, unreadable, missingDir }))
  }
  // 目录本身读不到 ⇒ 这一维**未判定**,不得以 0 冒充"没有翻车"(exit 2 = 无法判定)
  if (missingDir && !String(missingDir).startsWith('目录不存在')) return 2
  return 0
}

/**
 * 重建 `.git` 指针文件(原子写 + 回读校验)。
 * 安全护栏(2026-09-15):仅当 needsGitdirPointer()=true(separate-git-dir 形态)才执行。
 * 常规仓库的 `.git` 是真实目录,若误执行会删除整个 gitdir → 不可逆删库,故直接跳过。
 */
function healPointer() {
  if (!needsGitdirPointer()) {
    log('修复跳过: 当前为常规仓库(.git 即 gitdir 目录),无需也不应重建指针文件')
    return true
  }
  const tmp = `${POINTER}.tmp-${process.pid}`
  writeFileSync(tmp, EXPECTED_POINTER)
  try {
    rmSync(POINTER, { recursive: true, force: true })
  } catch {
    /* 目标可能不存在 */
  }
  renameSync(tmp, POINTER)
  const ok = pointerOk()
  log(`${ok ? '修复' : '修复失败'}: 重建 .git 指针文件 -> ${GITDIR}`)
  return ok
}

/**
 * 环境自愈:`git=true` 之外的唯一分支 —— pointer/gitdir 都在但 git 命令不可用。
 * 两个根因:① git 可执行文件不在 PATH ② 账户级 safe.directory 缺失。
 * ① 由 resolveGitBin() 绝对路径兜住;② 在此幂等补写 system/global 配置。
 */
function healEnv() {
  syncGitMeta()
  const bin = GIT_BIN
  if (!bin) {
    log('环境修复失败: 未找到可调用的 git 可执行文件')
    return false
  }
  log(`环境修复: 使用 git=${bin} (${gitVersion() || 'unknown'})`)
  for (const scope of ['--system', '--global']) {
    for (const p of [WORKTREE, GITDIR]) {
      try {
        const cur = execFileSync(bin, ['config', scope, '--get-all', 'safe.directory'], {
          encoding: 'utf8',
          // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        }).trim()
        const list = cur.split(/\r?\n/).filter(Boolean)
        if (list.includes(p) || list.includes('*')) continue
        execFileSync(bin, ['config', scope, '--add', 'safe.directory', p], {
          // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
        log(`环境修复: ${scope} safe.directory += ${p}`)
      } catch {
        /* 权限不足(非管理员)或无该 scope 配置,忽略 —— 命令行 -c 已兜底 */
      }
    }
  }
  return gitUsable()
}

/** HEAD 文件原文(空串表示读不到) */
function headContent() {
  try {
    return readFileSync(join(GITDIR, 'HEAD'), 'utf8').trim()
  } catch {
    return ''
  }
}

/** HEAD 语法是否合法:`ref: refs/...` 或 40 位 SHA */
function headSyntacticallyOk() {
  const h = headContent()
  return /^ref: refs\/[^\s]+$/.test(h) || /^[0-9a-f]{40}$/.test(h)
}

/** 兜底 0.5:HEAD 内容损坏(截断/乱码)→ 重写为常规分支符号引用(无损) */
function healHead() {
  if (headSyntacticallyOk()) return false
  log(
    `修复: HEAD 内容非法(${JSON.stringify(headContent().slice(0, 60))}) -> 重置为 ref: refs/heads/main`,
  )
  writeFileSync(join(GITDIR, 'HEAD'), 'ref: refs/heads/main\n')
  return gitUsable()
}

// ─────────── 嵌套 ref 存续(2026-09-12 立) ───────────
//
// 事故:`refs/remotes/origin/main` 反复变 `[gone]`、`refs/tags/backup/push4-*` 反复"仅远端",
// 使守门 #30a(commit 丢失防护,blocking)**抖动性阻塞** —— 刚 fetch 完是绿的,宿主一清理又红。
// 机理(对照实验):宿主清理层会删除 gitdir 下 **depth >= 2** 的嵌套命名空间目录
//   refs/heads/main / refs/tags/<tag>     → depth1 文件 → 存活
//   refs/remotes/origin/main / refs/tags/backup/<tag> → depth2 目录 → 被删
//   (且 `git update-ref` 对这类 ref 返回 0 却不落盘 —— 静默失败)
// 解法:把嵌套 ref 固化进 `packed-refs`(gitdir 顶层单文件 → 存活),期望值另存
// `refs-manifest.json`(同为顶层文件),任一时点缺失即可**离线**重建 + 重新 pack。
// 详见 scripts/git-refs-heal.mjs(支持 --refresh-remote 联网校准)。

/** depth>=2 的命名空间才需要固化(refs/heads/* 天然存活) */
function isNestedRef(ref) {
  return !ref.startsWith('refs/heads/') && ref.split('/').length >= 4
}

function readRefsManifest() {
  try {
    const m = JSON.parse(readFileSync(REFS_MANIFEST, 'utf8'))
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

/**
 * 当前全部 ref(name → sha),含 packed 与松散。
 * **三态**:`{}` = 面上真的没有 ref(判过);`null` = 这一面问不到(子进程失败/输出溢出)⇒ 未判定。
 * 把后者折成前者,就是"7149 个 ref 全部缺失"这类假告警的成因(见 git() 里 maxBuffer 那条注)。
 */
function currentRefs() {
  const out = git(
    [
      'for-each-ref',
      '--format=%(refname) %(objectname)',
      'refs/heads',
      'refs/tags',
      'refs/remotes',
    ],
    true,
  )
  const map = {}
  if (out === null) return null
  if (!out) return map
  for (const line of out.split('\n')) {
    const [ref, sha] = line.trim().split(/\s+/)
    if (ref && sha) map[ref] = sha
  }
  return map
}

/** 清单中解析不到(或值与清单不符)的 ref;移动型 remote HEAD 由 lib 统一放过(见 refExpectationSatisfied) */
function missingRefs() {
  const broken = brokenRefsFromSnapshot(readRefsManifest(), currentRefs())
  return broken === null ? null : broken.map(([ref]) => ref)
}

/** 把松散 ref 固化进 packed-refs(顶层单文件, 宿主清理不到) */
function packRefs() {
  git(['pack-refs', '--all', '--prune'], true)
}

/**
 * 直写松散 ref:`git update-ref` 对嵌套命名空间静默不落盘,故用 node fs。
 * **写之前必须证明对象存在** —— 指向不存在对象的 ref 会让每一次 `git fetch` 直接 fatal,
 * 而清单值可能因宿主抹掉 `objects/xx/` 变成死值(§5b 当日实测坏链 83,108 条)。
 * 这道闸与 `healRefs()` 里的 `splitDeadRefs` 是双层防御:分流管"别反复重试",本闸管
 * "任何后来调用者都不能亲手造死指针"。
 */
function writeLooseRef(ref, sha) {
  if (!objectExists(sha)) {
    log(`  ⚠️ 拒绝写 ${ref} = ${String(sha).slice(0, 12)}:该对象不可解析(写下去就是一次 fetch 全死)`)
    return false
  }
  const p = join(GITDIR, ref)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, sha + '\n', 'utf8')
  return true
}

/**
 * 从 FETCH_HEAD(gitdir 顶层文件 → 宿主清理不到)取 `origin/main` 的权威值。
 *
 * 为什么需要:git fetch 把新值写成**松散** refs/remotes/origin/main(嵌套目录),
 * 该文件实测在 1 秒内即被宿主清理;若 packed-refs 里还留着上一次的旧值,
 * git 就回落到旧值 → 明明同 sha 却显示 `## main...origin/main [ahead 1]`。
 */
function fetchHeadMain() {
  let text
  try {
    text = readFileSync(join(GITDIR, 'FETCH_HEAD'), 'utf8')
  } catch {
    return null
  }
  const lines = text.split('\n').filter((l) => /^[0-9a-f]{40}\b/.test(l.trim()))
  if (lines.length === 0) return null
  const mainLine =
    lines.find((l) => /branch\s+'?main'?\b/.test(l)) ?? (lines.length === 1 ? lines[0] : null)
  if (!mainLine) return null
  const m = mainLine.trim().match(/^([0-9a-f]{40})/)
  return m ? m[1] : null
}

/**
 * ref 自愈:①把当前可见的嵌套 ref 纳入清单(自维护,含 manifest 缺失时的 bootstrap)
 *          ②origin/main 以 FETCH_HEAD 为准(松散 ref 被 1s 内清理,packed 可能留旧值)
 *          ③清单里有、当前解析不到或值不符的 → 按清单重建并 pack
 * 返回:true = 清单内全部可解析且与清单一致
 */
function healRefs() {
  const cur = currentRefs()
  if (cur === null) {
    log('  ⚠️ ref 面取不到(for-each-ref 未产出)⇒ 本轮**不重建**:按清单撒数千枚松散 ref 是把"读不到"当"被删了"来治,方向反了')
    return false
  }
  const map = readRefsManifest()
  let learned = 0
  for (const [ref, sha] of Object.entries(cur)) {
    if (!isNestedRef(ref)) continue
    if (map[ref] !== sha) {
      map[ref] = sha
      learned++
    }
  }
  // FETCH_HEAD 是 fetch 自己写的顶层文件,权威度高于残留的 packed 旧值
  const fh = fetchHeadMain()
  if (fh && map['refs/remotes/origin/main'] && map['refs/remotes/origin/main'] !== fh) {
    log(
      `修复: origin/main 以 FETCH_HEAD 为准 ${map['refs/remotes/origin/main'].slice(0, 12)} -> ${fh.slice(0, 12)}`,
    )
    map['refs/remotes/origin/main'] = fh
    learned++
  }
  if (learned) {
    try {
      writeFileSync(REFS_MANIFEST, JSON.stringify(map, null, 1) + '\n', 'utf8')
    } catch (e) {
      log(`refs 清单写入失败: ${String(e.message || e)}`)
    }
  }

  // 合并后清单里"当前不可见或值不符"的即为待修复项
  // (移动型 refs/remotes/<remote>/HEAD 不比 sha,见 lib/gitdir.mjs refExpectationSatisfied)
  // 取上面**同一份** for-each-ref 快照判定:清单与内容同面同轮(§0.4),且不再逐条派 git
  const broken = brokenRefsFromSnapshot(map, cur)
  if (broken.length === 0) return true

  // 先分流:清单值本身可能是死值(宿主抹过 objects/),死值一律不写 ref,
  // 而是从清单剔除并指明恢复途径 —— 与 git-refs-heal.mjs 同口径、同一份纯函数。
  const { dead, rebuildable } = splitDeadRefs(broken, objectExists)
  log(
    `修复: 重建 ${rebuildable.length} 个缺失的嵌套 ref(宿主清理 depth>=2 目录所致)` +
      (dead.length ? `,另 ${dead.length} 个清单值为死值(不写 ref,已从清单剔除)` : ''),
  )
  for (const [ref, sha] of rebuildable) {
    if (writeLooseRef(ref, sha)) log(`  - ${ref} = ${sha.slice(0, 12)}`)
  }
  if (dead.length) {
    for (const [ref] of dead) delete map[ref]
    for (const [ref, sha] of dead) {
      log(
        `  ⚠️ 死值 ${ref} = ${String(sha).slice(0, 12)}:对象不可解析,需联网校准 ` +
          `(node scripts/git-refs-heal.mjs --refresh-remote)`,
      )
    }
    try {
      writeFileSync(REFS_MANIFEST, JSON.stringify(map, null, 1) + '\n', 'utf8')
    } catch (e) {
      log(`refs 清单剔除死值失败: ${String(e.message || e)}`)
    }
  }
  packRefs()
  // 复检口径与旧逐条档一致:旧写法问的是"这条 ref 现在解析得到吗"(值不符也算过),
  // 所以这里按"快照里没有这条"判,不得换成 refExpectationSatisfied —— 那会把 origin/main
  // 这类"清单值取 FETCH_HEAD、packed 值还在滞后"的正常形态每轮报成未达标,连到人通知一起刷。
  const after = currentRefs()
  if (after === null) {
    log('❌ refs 修复后复检面取不到(for-each-ref 未产出)⇒ 本轮判「未判定」,不记成功')
    return false
  }
  const still = Object.keys(map).filter((ref) => !after[ref])
  if (still.length) {
    log(`refs 修复未完全达标: ${still.join(', ')}`)
    return false
  }
  log(`✅ refs 自愈成功(${rebuildable.length} 个已重建并固化进 packed-refs)`)
  return true
}


/** 盘上当前可见的嵌套 ref 个数(只在清单为空这一支量,避免热路径多一次 for-each-ref);null = 面问不到 */
function visibleNestedRefCount() {
  const cur = currentRefs()
  if (cur === null) return null
  let n = 0
  for (const ref of Object.keys(cur)) if (isNestedRef(ref)) n++
  return n
}

/** refs 健康结论的唯一取材点:status()/remediate()/anomalyLine 三处共用这一份,不得各算各的 */
function refsVerdict() {
  const manifestCount = Object.keys(readRefsManifest()).length
  if (manifestCount === 0) {
    const visible = visibleNestedRefCount()
    return judgeRefsHealth({
      manifestCount,
      visibleNestedCount: visible === null ? 0 : visible,
      faceReadable: visible !== null,
    })
  }
  const missing = missingRefs()
  return judgeRefsHealth({
    manifestCount,
    visibleNestedCount: 0,
    missingCount: missing === null ? null : missing.length,
    faceReadable: missing !== null,
  })
}

function refsOk() {
  return refsVerdict().ok
}

/**
 * 工作区已跟踪文件存续自愈(2026-09-23 立)。宿主清理层会成批删除工作区目录
 * (实测同日三轮:137 个 → 27 个 → 1 个,命中 tests/ 与 __tests__/ 整目录、
 * installer-assets 下 assets-NNN 的 bmp、4 个在役守门脚本)。`.git` 与嵌套 ref 早有分层自愈,
 * 工作区存续性此前无人管:缺失只体现为 `git status` 一片 ` D`,下一次提交就把它们从版本树删掉
 * (= 静默回滚)。判据与恢复动作在 scripts/heal-worktree-tracked.mjs:只恢复
 * "索引 blob == HEAD blob 且文件不在"的项,他人已暂存的删除一律不碰。
 * 不改 status()/退出码语义 —— 纯多一层自愈,失败也只记日志不阻断其余守护。
 * 第二层 `--align-drift`(幻影漂移对齐 + 落后索引刷新)在同一趟里跟着跑:只等
 * git-sync-converge 的成功出口才对齐,会让"无人收敛"期间索引一直停在祖先版本,
 * 下一次 `git add <file>` 就交旧基线(实测一次积到 503 文件落后 486 提交)。
 * 逃生舱 IHUI_SKIP_DRIFT_ALIGN=1 只关第二层,不影响恢复层。
 */
function healWorktreeTracked() {
  // 2026-10-04 复核补节流:本函数**每轮都跑**,而收敛对齐的自愈(healConvergeAlignStall →
  // git-sync-converge.mjs --align-only → heal-worktree-tracked.mjs --align-drift --json)
  // 在**同一轮 tick 里排在本函数之后**,两者写的是同一个索引、跑的是同一个脚本
  // (复核实测:本函数 :1324 与收敛器 :1391 派同一组参数)。
  // 无节流时:一轮跑两遍写索引动作 ⇒ 抢 index.lock + 白白多花一次 40–51 秒。
  // 判据用"对齐层跑过的窗口"而不是随便加个时间戳 —— 节流必须对齐真实动作面。
  const now = Date.now()
  let lastAlign = 0
  try {
    lastAlign = Number(readFileSync(WORKTREE_ALIGN_TICK, 'utf8')) || 0
  } catch {
    /* 首次:没有 tick 就是该跑 */
  }
  if (now - lastAlign < WORKTREE_HEAL_INTERVAL_MS) {
    log(
      `ℹ️ 工作区存续自愈跳过:对齐层 ${Math.round((now - lastAlign) / 1000)}s 前刚跑过(同一轮不必跑两遍写索引动作)`,
    )
    return
  }
  try {
    mkdirSync(dirname(WORKTREE_ALIGN_TICK), { recursive: true })
    writeFileSync(WORKTREE_ALIGN_TICK, String(now), 'utf8')
  } catch {
    /* tick 写不下去也要跑:否则一次盘错就永久失明 */
  }
  const script = join(dirname(fileURLToPath(import.meta.url)), 'heal-worktree-tracked.mjs')
  if (!existsSync(script)) return
  // 两层共用一个调用出口:恢复层 `--json`,对齐层 `--align-drift --json`。
  // 做成具名 helper 也是为了镜像测试能按**调用形态**钉装车证明(见
  // scripts/tests/git-guardian-drift-align.test.mjs)。
  const run = (args) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务下必弹控制台窗
        maxBuffer: 1 << 24,
        // 2026-10-04 补:本调用**缺 stdio**。本机派生 git/node 命中 EBUSY 面时,症状是
        // 这里 catch 到 err、只落一行"工作区存续自愈失败" —— 而真正原因是派生通道,
        // 与工作区毫无关系,读日志的人会往错的方向查(本仓反复登记的同型)。
        // 无 input ⇒ ignore 三态(见 MEMORY 派生 git 判据)。
        stdio: ['ignore', 'pipe', 'pipe'],
      })
        .trim()
        .split('\n')
        .pop()
      return { r: JSON.parse(out || '{}'), err: null }
    } catch (e) {
      return { r: null, err: String(e && e.message ? e.message : e).slice(0, 160) }
    }
  }
  const brief = (o) => {
    const paths = o.paths || o.touched || []
    return `${paths.slice(0, 3).join(', ')}${paths.length > 3 ? ' …' : ''}`
  }
  const briefList = (paths) =>
    `${(paths || []).slice(0, 3).join(', ')}${(paths || []).length > 3 ? ' …' : ''}`

  const { r, err } = run(['--json'])
  if (err) log('工作区存续自愈失败(不阻断其余守护): ' + err)
  else if (r.restored)
    log(`✅ 工作区存续自愈:恢复 ${r.restored} 个被外部删除的跟踪文件(${brief(r)})`)
  else if (r.held) log(`ℹ️ 工作区 ${r.held} 个跟踪文件缺失,但索引里已是删除(他人在制)⇒ 不代裁恢复`)
  // G-1018292:删除意图丢失这一档必须单独出声 —— 它与上面那档的差别是本质的:
  // `held` 的证据在索引面(标记还在,只是不碰),这一档的标记**已经被摘掉**
  // (某次 `git reset HEAD` 清空共享索引时没的)。折进 held 或只在 restored 时顺带提一句,
  // 读日志的人就会以为"标记还在、只是没碰",而真相是标记已经没了。
  if (r.intentLost)
    log(
      `⚠️ 工作区 ${r.intentLost} 个跟踪文件缺失且删除意图已丢失(暂存标记被共享索引清空摘掉)⇒ ` +
        `分不清是宿主误删还是有意删除,不代裁恢复(${briefList(r.intentLostPaths)})`,
    )

  // 第二层:幻影漂移对齐 + 落后索引刷新(2026-09-24 立,190730d3a67 交付,
  // 被同日 b805d31da44 整文件回写连带删掉 —— 现按原语义前向恢复)。
  // 只等 git-sync-converge 的成功出口才对齐,意味着"没人跑收敛"期间索引会一直停在
  // 祖先版本,下一次 `git add <file>` 就交旧基线(实测 503 文件落后 486 提交)。
  if (process.env.IHUI_SKIP_DRIFT_ALIGN === '1') return
  const { r: d, err: derr } = run(['--align-drift', '--json'])
  if (derr) log('幻影漂移对齐失败(不阻断其余守护): ' + derr)
  else {
    if (d.aligned)
      log(`✅ 幻影漂移对齐:${d.aligned} 个文件回到 HEAD(内容==祖先版本,零独有数据)(${brief(d)})`)
    if (d.refreshed) log(`✅ 落后索引刷新:${d.refreshed} 个路径的索引回到 HEAD(工作区未触碰)`)
    // 第五层:活文档的"落地欠回写"(2026-10-14 立)。前两层的判据都从"索引里的 blob"出发,
    // 而 ALIGN_EXEMPT_PATHS 刻意把台账整体绕行 —— 于是旁路落地推进 HEAD 后留下的那条脏索引
    // 长期无人负责(实测 22:45:55 那枚 union-converge 之后悬到机主亲自来问)。本层只补那一格,
    // 且**只写索引不写工作区**;判不住的一律点名,不许把"没判"读成"干净"。
    if (d.landingAligned)
      log(
        `✅ 落地欠回写对齐:${d.landingAligned} 个活文档路径的索引回到 HEAD(判据=索引 blob 逐字节等于某枚旁路落地自述的前像,故零独有;工作区未触碰)` +
          `(${(d.landingPaths || []).slice(0, 5).join(', ')})`,
      )
    for (const h of (d.landingHeld || []).slice(0, 3))
      log(`ℹ️ 落地欠回写未对齐:${h.path} —— ${String(h.reason).slice(0, 130)}`)
    for (const u of (d.landingUndetermined || []).slice(0, 3))
      log(`⚠️ 落地欠回写未判定:${u.path} —— ${String(u.reason).slice(0, 130)}`)
    if (d.landingDeferred?.length)
      log(`⚠️ 落地欠回写本轮撞锁延后:${d.landingDeferred.slice(0, 5).join(', ')}`)
  }
}

/** 〈原 10 行头注已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-24.md#git-guardian-L1569〉 盘根封口自愈(2026-09-24 立)。`seal-c-root-stray.mjs` 把"第三方以 CWD=C:\ 写歪"的 */
/** §26 家目录改道自愈:门 96 判红就调修复器。
 *  为什么挂在守护而不是等人跑:2026-09-24 实测 `D:\DevEnv\cache\userhome` 整棵消失,
 *  16 项登记里 9 项退回 C 盘实体目录,而门 96 是 blocking ⇒ **每一次提交都被逼成绕过钩子**,
 *  一次绕过等于约 110 道守门对该提交全部作废(§12e 同型)。每日 03:00 体检兜不住 23 小时空窗
 *  —— 与盘根封口同一个道理(见 healRootSeal 上方 §26 说明)。
 *  两条节流:① 判定用门 96(它把体积遍历封在 8000 条内,便宜),修复器只在判红时才跑;
 *  ② 被进程占用而失败的项目记 30 分钟冷却,避免每轮都重抄一遍 108MB 再去撞 EBUSY。 */
// 〔归档@2026-10-25/门103 C1〕原 19 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l1543-起-19-行
const HOME_HEAL_LOCK = join(WORKTREE, '.ihui-agent', 'state', 'home-junctions.heal.lock')
const HOME_HEAL_STAMP = join(WORKTREE, '.ihui-agent', 'state', 'home-junctions.last-heal.txt')

function healHomeJunctions() {
  const dir = dirname(fileURLToPath(import.meta.url))
  const judge = join(dir, 'check-home-junctions.mjs')
  const fixer = join(dir, 're-home-junctions.mjs')
  if (!existsSync(judge) || !existsSync(fixer)) return
  // ── ⓪ 身份闸(2026-09-27,排在节流与锁之前)──
  // 常驻守护是 NSSM 服务,身份 LocalSystem,它的家目录是 `C:\Windows\System32\config\systemprofile`,
  // 于是 §26 那 16 项登记路径在**这一身份下解析成另一批路径** —— 而那批路径里实测真有一个
  // `AppData\Local\pnpm-cache` 实体目录,门因此恒判红,守护遂每 10 秒叫修复器去把**系统账户的目录**
  // robocopy 进**真人正在用的缓存树**。这不是噪音问题,是"搬运工具拿错了搬运对象"。
  // 判据住在 check-home-junctions.mjs 的 isInteractiveUserHome,此处只调用 —— 不得抄第二份。
  // 静默返回是刻意的:这里 skip 的是"一轮调度",不是一个判定;判定结论仍在修复流程的日志里。
  // 若为 skip 也打日志,就等于用另一种文案把同一条刷屏复制回来。
  if (!isInteractiveUserHome(homedir())) return
  // ── ⓪b 墙钟节流 ──
  let lastRaw = ''
  try {
    lastRaw = readFileSync(HOME_HEAL_STAMP, 'utf8')
  } catch {
    lastRaw = ''
  }
  if (!homeHealDue(lastRaw, Date.now())) return
  try {
    mkdirSync(dirname(HOME_HEAL_STAMP), { recursive: true })
    writeFileSync(HOME_HEAL_STAMP, String(Date.now()), 'utf8')
  } catch {
    /* 时间戳写不进去只失去节流这一层的保护,不得因此不跑本轮 */
  }
  const call = (script, args, timeout) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return { code: 0, out: String(out || ''), timedOut: false }
    } catch (e) {
      const killed = Boolean((e && e.killed) || (e && e.signal === 'SIGTERM'))
      return {
        code: typeof e.status === 'number' ? e.status : 2,
        out: String((e && e.stdout) || ''),
        timedOut: killed,
      }
    }
  }
  const first = call(judge, [], 120000)
  // 残留的 stash(改道中途被掐断留下的 `<原名>.pre-junction-<ts>`)不进门 96 的 blocking 退出码
  // —— 那是机器态,不是提交者能改的东西,拿它判红等于逼人跳门。但它必须有人收:所以守护
  // 单独问一次,体检绿而 stash 非空时照样叫修复器(修复器每轮无条件清,与"有没有项要搬"无关)。
  const stash = call(judge, ['--check-stash'], 60000)
  if (first.code === 0 && stash.code === 0) return
  if (first.code !== 0 && first.code !== 1) {
    log(`家目录改道体检异常(忽略,不阻断其余守护):exit ${first.code}`)
    return
  }
  if (first.code === 0 && stash.code === 1)
    log('ℹ️ 家目录改道体检已绿,但盘上还有改道中断留下的旧名 ⇒ 叫修复器收口')

  // ── ① 单实例锁 ──
  // 用 `wx`(排他创建)而不是"先 existsSync 再写":后者两步之间两个 tick 都能判到"无锁",
  // 于是同时开搬 —— 那正是本票要防的半完成现场。抢不到即读回判定。
  try {
    mkdirSync(dirname(HOME_HEAL_LOCK), { recursive: true })
    try {
      writeFileSync(HOME_HEAL_LOCK, healLockText(process.pid, Date.now()), {
        encoding: 'utf8',
        flag: 'wx',
      })
    } catch (e) {
      if (!e || e.code !== 'EEXIST') throw e
      const raw = readFileSync(HOME_HEAL_LOCK, 'utf8')
      const decision = healLockDecision(raw, Date.now(), HOME_HEAL_TTL_MS)
      if (decision === 'skip') {
        const [pidS, startS] = raw.split('\n')
        log(
          `ℹ️ 家目录改道已有另一轮在修(pid ${pidS},起于 ${Math.max(0, Math.round((Date.now() - Number(startS)) / 60000))} 分钟前)⇒ 本轮跳过,不并发搬同一批目录`,
        )
        return
      }
      log(
        `⚠️ 家目录改道锁判定为接管(持有者已死或超 ${Math.round(HOME_HEAL_TTL_MS / 60000)} 分钟)⇒ 本轮继续`,
      )
      writeFileSync(HOME_HEAL_LOCK, healLockText(process.pid, Date.now()), 'utf8')
    }
  } catch (e) {
    // 拿不到锁不阻断其余守护,但也不能因此并发搬 —— 直接跳过本轮
    log(`家目录改道锁不可用(跳过本轮,不阻断其余守护):${String(e && e.message).slice(0, 120)}`)
    return
  }

  try {
    const applied = call(fixer, ['--apply'], HOME_HEAL_FIXER_TIMEOUT_MS)
    if (applied.timedOut) {
      log(
        `⚠️ 家目录改道修复器跑满 ${Math.round(HOME_HEAL_FIXER_TIMEOUT_MS / 60000)} 分钟被掐断 ⇒ 现场可能停在"已复制未改名"的中间态;下一轮接管前请先看 re-home-junctions --check`,
      )
    } else if (applied.code === 2) {
      log(`⚠️ 家目录改道修复器自身异常(exit 2)⇒ 不重试,需人工看 re-home-junctions 输出`)
    }
    const count = (tag) => (applied.out.match(new RegExp('\\[' + tag + '\\]', 'g')) || []).length
    const moved = count('moved')
    if (moved) log(`✅ 家目录改道自愈:重新改道 ${moved} 项(§26)`)
    const after = call(judge, [], 120000)
    if (after.code === 0) return
    // ③ 报"实测到的原因",不再猜"多为进程占用"
    const whyRows = [
      ['cooldown', '冷却中(上轮 EBUSY/校验失败)'],
      ['copy-failed', 'robocopy 失败(源未动)'],
      ['rename-failed', '源改名失败(通常是被占用)'],
      ['verify-failed', '逐文件校验不一致(仍在被写)'],
    ].filter(([tag]) => count(tag))
    // 正文带条数(`3×robocopy 失败`),身份只带类别标签 —— 下面那句注释说的"身份只取失败原因
    // 类别"在实现里原来没做到:`${count(tag)}×` 被拼进了 why,而 why 又整串进了 dedupKey ⇒
    // 冷却项 0/1/11 各被当成一种身份(实测 09-30/10-01 两天 94 封)。
    const why = whyRows.map(([tag, text]) => `${count(tag)}×${text}`).join(' / ')
    const whyTags = whyRows.map(([tag]) => tag).sort().join('+')
    const cool = (() => {
      try {
        return Object.keys(
          JSON.parse(
            readFileSync(join(WORKTREE, '.ihui-agent', 'state', 'home-junctions-cooldown.json'), 'utf8'),
          ),
        ).length
      } catch {
        return -1
      }
    })()
    log(
      `⚠️ 家目录改道修复后仍判红(exit ${after.code})⇒ 实测原因:${why || '修复器未给出失败标签'};冷却项 ${cool < 0 ? '读不到' : cool} 个${applied.timedOut ? ';本轮被超时掐断' : ''}`,
    )
    // 门 96 是 blocking:这一红若不到人,每一次提交都在被逼成 --no-verify(§12e 同型事故)
    notifyGuardRed(
      '家目录改道修复后仍判红',
      `re-home-junctions --apply 之后 check-home-junctions 仍 exit ${after.code} ⇒ 实测原因:${why || '修复器未给出失败标签'};冷却项 ${cool < 0 ? '读不到' : cool} 个${applied.timedOut ? ';本轮被超时掐断' : ''}。手动:node scripts/re-home-junctions.mjs --check`,
      // dedupKey(§5e-1 配套,102 封同因):detail 里 `冷却项 N 个` 与 `N×…` 都是**实时计数**,
      // 逐轮变动 ⇒ 指纹变 ⇒ shouldAlert 判"新故障"立即重发,4 小时窗口只剩名字
      // (实测 09-30/10-01 两天寄出 94 封,`冷却项 0/1/11 个`各被当成一种身份)。
      // 身份只取"失败原因类别标签",条数与冷却项个数仍进正文(它们是诊断,不是身份)。
      { dedupKey: `home-heal-exit=${after.code};why=${whyTags || 'no-tag'}` },
    )
  } finally {
    try {
      rmSync(HOME_HEAL_LOCK, { force: true })
    } catch {}
  }
}

/** 守门 100 的"别人造好再推来"面(2026-09-24 立)。
 *  提交链上那道门按设计只判 `origin/main..HEAD`(把已入库历史纳入默认面 = 之后每次提交恒红
 *  = 逼人绕过钩子,见其头注"口径是生命线"),而 `git-sync-converge` / `plan-union-merge` /
 *  手工 commit-tree **都不跑钩子** ⇒ "判据存在但永不被调用"这一型必须由守护补一层。
 *  用增量台账(`--all-new`):每枚合并只判一次,老提交不会反复红。
 *  **只判不修**:自动重做合并的风险远大于收益;出口是 `scripts/union-converge.mjs --apply`(人来点)。 */
/**
 * 主机时区漂移问责(2026-09-30 立,尺子本体 = `scripts/check-host-timezone.mjs`)。
 *
 * 为什么必须挂在这一格:2026-09-04 本机时区被一次未登记的改动从东八区改成 UTC,持续 25 天,
 * 期间支付宝网关签名早 8 小时、异常检测把北京高峰当"凌晨可疑"、全库导出落在上午 11:00,
 * 而**没有任何一个执行体问过这台机的时区是什么**。提交链上的门只在有人提交时跑;判的是机器状态,
 * 所以出口只能是这里(守护 tick,每 2 分钟一轮)。
 *
 * 三条不可漂的写法:
 *  ① 挂点带 `!CHECK_ONLY` —— 本文件已两次踩过"挂进 CHECK_ONLY 路径等于永不执行";
 *  ② 节流(默认 30 分钟)且**取不到读数就不发信**:主机时区判不出 ≠ 漂移,把"没判"寄成告警就是
 *     制造噪声(§5e 失败必须响,但响的是量到的红,不是尺子失效);
 *  ③ 发信只经 notify()(→ notify-deploy-failure.ts),不得在本文件自拼 SMTP(守门 81 硬拦)。
 */
const TZ_AUDIT_TICK = join(WORKTREE, '.ihui-agent', 'state', 'host-timezone-audit-tick.ts')
const TZ_AUDIT_INTERVAL_MS = 30 * 60 * 1000

function auditHostTimezone() {
  try {
    let last = 0
    try {
      last = Number(readFileSync(TZ_AUDIT_TICK, 'utf8')) || 0
    } catch {
      /* 首次:没有 tick 就是该跑 */
    }
    if (Date.now() - last < TZ_AUDIT_INTERVAL_MS) return
    try {
      mkdirSync(dirname(TZ_AUDIT_TICK), { recursive: true })
      writeFileSync(TZ_AUDIT_TICK, String(Date.now()))
    } catch {
      /* tick 写不下去也要判一次:否则一次盘错就永久失明 */
    }
    const script = join(dirname(fileURLToPath(import.meta.url)), 'check-host-timezone.mjs')
    if (!existsSync(script)) {
      logger('ℹ️ 主机时区对账:尺子脚本不在位(scripts/check-host-timezone.mjs)⇒ 本轮跳过,不记为已判')
      return
    }
    let parsed = null
    try {
      const out = execFileSync(process.execPath, [script, '--quick', '--json'], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: WORKTREE,
        windowsHide: true,
        timeout: 90_000,
        maxBuffer: 8 * 1024 * 1024,
        encoding: 'utf8',
      })
      parsed = JSON.parse(String(out).trim())
    } catch (e) {
      // 判红也是非零退出:必须先看有没有可解析的载荷,不能把"退出码非零"直接当尺子失效。
      const body = e && e.stdout ? String(e.stdout).trim() : ''
      try {
        parsed = JSON.parse(body)
      } catch {
        logger(`ℹ️ 主机时区对账:未判定(派生失败或载荷不可 parse:${String(e && e.message).slice(0, 120)})—— 不寄信,也别当已判过`)
        return
      }
    }
    if (!parsed || parsed.verdict === 'error') {
      logger(`ℹ️ 主机时区对账:未判定(${(parsed && parsed.reasons && parsed.reasons[0]) || '载荷是 error'})`)
      return
    }
    if (parsed.verdict === 'red') {
      const lines = (parsed.reasons || []).join('\n')
      const h2 = parsed.h2 || {}
      notifyGuardRed(
        '主机时区漂移:本机时钟与声明不符',
        `${lines}\n\n声明:config/host-timezone.json(changedAt ${parsed.changedAt})\n` +
          `实测:${parsed.measured && parsed.measured.registry} / node ${parsed.measured && parsed.measured.nodeIana}\n` +
          `最近一次时区变更归属:${(h2.events || []).slice(0, 2).map((x) => `${x.utc} ← ${x.proc || '?'}`).join(' / ') || '(未取到)'}\n` +
          `H3 落地维逐条:${(parsed.h3 && parsed.h3.rows ? parsed.h3.rows.map((r) => `${r.file}=${r.state}${r.gapHours !== undefined ? `(${r.gapHours}h)` : ''}`).join(', ') : '(无)')}\n` +
          `若是 stale-cache:改完时区必须重启对应常驻服务(进程在启动时就把区读进缓存)。取证:node scripts/check-host-timezone.mjs`,
        // 身份取"实测到的那对时区",这是状态量:同一条漂移持续多久都是同一身份(4h 窗生效);
        // 时钟真的换了一个值才算新事实。此前无 key ⇒ detail 里 `changedAt`/逐文件 gapHours 每分钟在变。
        { severity: 'warning', dedupKey: `tz=${String((parsed.measured && parsed.measured.registry) || '?')};node=${String((parsed.measured && parsed.measured.nodeIana) || '?')}` },
      )
      logger(`⚠️ 主机时区对账判红:${lines}`)
      return
    }
    logger(`✅ 主机时区对账:无漂移(${parsed.measured && parsed.measured.registry};未判定 ${parsed.undeterminedCount} 维)`)
  } catch (e) {
    logger(`⚠️ 主机时区对账自身异常(不改自愈与退出码):${String(e && e.message).slice(0, 160)}`)
  }
}

/**
 * 盘根卫生巡检(2026-09-30 立,尺子本体 = `scripts/check-disk-root-hygiene.mjs`)。
 *
 * 为什么必须挂在这一格:用户拍板"项目产物不外流"(盘根除声明白名单外不允许有项目产物)。
 * 提交链上的门只判仓库根一级(check-root-dir-clean),盘根与 worktree 登记面无人看守
 * ⇒ 清完必回潮(2026-09-30 实测:刚删净的 .pytest_tmp_runs 数小时内被重建)。
 * 判的是磁盘/机器状态 ⇒ 出口只能是守护 tick(warn 尺子,绝不进提交链,§12e)。
 *
 * 三条不可漂的写法(与 auditHostTimezone 同源):
 *  ① 挂点带 `!CHECK_ONLY` —— 挂进 CHECK_ONLY 路径等于永不执行;
 *  ② 节流(默认 30 分钟)且**未判定不发信**:量不到 ≠ 外流,把"没判"寄成告警是制造噪声;
 *  ③ 发信只经 notifyGuardRed(),不得在本文件自拼 SMTP(守门 81 硬拦)。
 */
const DISK_ROOT_AUDIT_TICK = join(WORKTREE, '.ihui-agent', 'state', 'disk-root-hygiene-audit-tick.ts')
const DISK_ROOT_AUDIT_INTERVAL_MS = 30 * 60 * 1000

/**
 * 告警去重的**计数分档**:档内抖动不重报,跨档才算真恶化/真缓解。
 * 为什么必须分档而不是直接用计数 —— 见 auditDiskRootHygiene() 里 dedupKey 的注释。
 * 0 单独成档:"缓解到 0"必须重报一次(那是终态变化,不是抖动)。
 * 2026-10-18 收口:这里原先有第二份实现(`function tier(n)` 返回 0/1/2/3/4,边界与
 * `alertCountTier` 逐字相同),同一把尺子两副面孔正是 §0.6/§22c 立的"第二份必然漂移"。
 * 盘根那一格现在直接调 `alertCountTier`,不再另立一档。
 */
function auditDiskRootHygiene() {
  try {
    let last = 0
    try {
      last = Number(readFileSync(DISK_ROOT_AUDIT_TICK, 'utf8')) || 0
    } catch {
      /* 首次:没有 tick 就是该跑 */
    }
    if (Date.now() - last < DISK_ROOT_AUDIT_INTERVAL_MS) return
    try {
      mkdirSync(dirname(DISK_ROOT_AUDIT_TICK), { recursive: true })
      writeFileSync(DISK_ROOT_AUDIT_TICK, String(Date.now()))
    } catch {
      /* tick 写不下去也要判一次:否则一次盘错就永久失明 */
    }
    const script = join(dirname(fileURLToPath(import.meta.url)), 'check-disk-root-hygiene.mjs')
    if (!existsSync(script)) {
      logger('ℹ️ 盘根卫生:尺子脚本不在位(scripts/check-disk-root-hygiene.mjs)⇒ 本轮跳过,不记为已判')
      return
    }
    let parsed = null
    try {
      const out = execFileSync(process.execPath, [script, '--json'], {
        cwd: WORKTREE,
        windowsHide: true,
        timeout: 90_000,
        maxBuffer: 8 * 1024 * 1024,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      parsed = JSON.parse(String(out).trim())
    } catch (e) {
      const body = e && e.stdout ? String(e.stdout).trim() : ''
      try {
        parsed = JSON.parse(body)
      } catch {
        logger(`ℹ️ 盘根卫生:未判定(派生失败或载荷不可 parse:${String(e && e.message).slice(0, 120)})—— 不寄信,也别当已判过`)
        return
      }
    }
    if (!parsed || !parsed.verdict) {
      logger('ℹ️ 盘根卫生:未判定(载荷缺 verdict)—— 不寄信,也别当已判过')
      return
    }
    const c = parsed.counts || {}
    const uN = Number(c.diskRootUndetermined) || 0
    const wN = Number(c.worktreeUndetermined) || 0
    const nN = Number(c.diskRootNotApplicable) || 0
    if (parsed.verdict === 'undetermined') {
      // 未判定必须**逐维**报名:旧写法只印 worktree 一维,于是"本机盘根没在 config 申报"
      // 这一整格在日志里长得像"盘根那维已经判过了"(把没判写成判过了,同一条禁令)。
      logger(`ℹ️ 盘根卫生:未判定(盘根维 ${uN}、worktree 维 ${wN};不适用盘根 ${nN})—— 不寄信,也别当已判过`)
      return
    }
    if (parsed.verdict === 'red') {
      // 违规类别 → 措辞。未识别的类别**单独报名**,不得顺手当成 worktree 那型渲染
      // (旧写法是 `kind !== 'stray-root-entry'` 一律印 "worktree 落点外: undefined",
      // 那会把"尺子看不懂载荷"伪装成"又有一处落点外",既误导整改方向也污染信文)。
      const LABEL = {
        'stray-root-entry': (v) => `盘根外流: ${v.path || `${v.root}${v.entry}`}`,
        'worktree-outside-sanctioned-root': (v) => `worktree 落点外: ${v.path}${v.prunable ? '(prunable)' : ''}`,
      }
      const lines = (parsed.violations || [])
        .map((v) => (LABEL[v.kind] ? LABEL[v.kind](v) : `未识别的违规类别 kind=${String(v.kind)} ⇒ 请核对尺子与本守护是否同代`))
        .join('\n')
      // 合法落点由本机路径推导:旧信文写死 `G:\IHUI-AI\.worktrees\`,在别的 checkout 上
      // 是一句跑不通的出路(§26 盘符按当次实测取值)。
      const landing = join(WORKTREE, '.worktrees')
      notifyGuardRed(
        '盘根外流:项目产物出现在声明白名单之外',
        `${lines}\n\n白名单:config/disk-root-allowlist.json(封闭集合,新增合法条目必须显式改配置并随 commit 提交)\n` +
          `worktree 合法落点:${landing}(AGENTS §12d);回收前逐条核实归属 —— 不可 prune 的登记项很可能是别的会话**正在用**的隔离检出\n` +
          `⚠️ 本信不构成删除依据:主工作树与 §5b 的外置 gitdir / *.git-backup-* 恢复源**禁止删除**;明细里若出现这类路径,那是尺子又瞎了,先查尺子不要动手\n` +
          `手动问责:node scripts/check-disk-root-hygiene.mjs --strict`,
        {
          severity: 'warning',
          // 去重身份只取"违规类别 + **计数分档**",明细行不进指纹(2026-10-03 立;
          // 2026-10-05 把"计数"改成"分档")。实测 09-30 至 10-05 同一原因寄出 **34 封**,
          // 其中 10-04 20:59 / 21:29 / 21:59 三封**只隔 30 分钟** —— 4 小时窗口形同虚设。
          // 真因不是明细抖动而是**计数本身在抖**:旧判据把"外置 gitdir 被误判成落点外"
          // 恒记 1,再叠加别人在飞的 0~3 个 worktree ⇒ 每轮巡检至少有一个数在变
          // ⇒ shouldAlert 判"新故障"立即重报。分档语义:档内抖动不重报,
          // **跨档才算真恶化/真缓解**;信文照旧逐条点名(信息量没降),判据一字未动(§12e)。
          // 真变化(违规类别或计数变了)仍立即重报。**2026-10-18 再补持续档**:10-16 以来该族 13 封
          // 全是 4h 平窗重发 —— 分档只解决了"计数在抖",没解决"同一批外流条目每隔 4h 再寄一次"。
          // 跨 6h/24h/72h 才重报,清零即摘起点(与隧道腿、部署停摆同一把尺子,§0.6)。
          dedupKey: `stray=${alertCountTier(c.diskRootStray)};wtOutside=${alertCountTier(c.worktreeOutside)};held=${alertHeldTier(noteUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', 'disk-root-stray-first.json')).firstMs).tier}`,
        },
      )
      logger(
        `⚠️ 盘根卫生判红:外流 ${Number(c.diskRootStray) || 0} / worktree 落点外 ${Number(c.worktreeOutside) || 0}` +
          `(未判定 盘根 ${uN}、worktree ${wN};不适用 ${nN})`,
      )
      return
    }
    // 已判干净 ⇒ 摘掉外流持续计时起点(与上面 dedupKey 的 held 档成套,否则起点会背着历史时长)
    clearUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', 'disk-root-stray-first.json'))
    logger(
      `✅ 盘根卫生:0 违规(白名单对账 + worktree 落点全在 ${join(WORKTREE, '.worktrees')})` +
        (nN ? `;另有 ${nN} 个声明盘根在本机不适用(不是"已判干净",是"本机没有这块盘")` : ''),
    )
  } catch (e) {
    logger(`⚠️ 盘根卫生自身异常(不改自愈与退出码):${String(e && e.message).slice(0, 160)}`)
  }
}

const MERGE_LOSS_UNDET_FILE = join(WORKTREE, '.ihui-agent', 'state', 'merge-loss-undetermined-first.json')
// "这一轮取不到结论"与"对账层真的坏了"在到人信上必须是两件事。2026-10-17 上午共享 git 争用让该
// 对账连续几趟取不到,守护当场寄出一封 critical 说"对账层自己没在跑"——而同一枚对账手工复跑
// 0.46 秒即绿(审计 0 枚吞并)。持续性门槛取现读量纲:正常一趟 0.46s、派生上限 240s、守护 2 分钟
// 一趟 ⇒ 连满 30 分钟(≈15 趟)全部取不到才够格按结构性故障喊人;单轮只报名(方向是"多要一次
// 说明",绝不是"多放一次跳门":§0.3)。
const MERGE_LOSS_UNDET_HORIZON_MS = Number(process.env.IHUI_MERGE_LOSS_UNDET_HORIZON_MS || 30 * 60 * 1000)


/** 记"未判定"的起点并返回已持续时长(实现归 `noteUndeterminedStreak`,本格只绑定自己的状态件)。 */
function noteMergeLossUndetermined(nowMs = Date.now(), file = MERGE_LOSS_UNDET_FILE) {
  return noteUndeterminedStreak(file, nowMs)
}

function clearMergeLossUndetermined(file = MERGE_LOSS_UNDET_FILE) {
  clearUndeterminedStreak(file)
}

function auditMergeAdditionLoss() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-merge-addition-loss.mjs')
  if (!existsSync(script)) return
  let res = ''
  let outcome
  let errFirst = ''
  try {
    const out = execFileSync(process.execPath, [script, '--all-new'], {
      cwd: WORKTREE,
      encoding: 'utf8',
      windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
      timeout: 240000, // 守门 80:热路径派生一律带上限
      stdio: ['ignore', 'pipe', 'pipe'], // §12g;stderr 也必须接:否则"取不到输入"的信里连病名都没有(2026-10-17 那封只有结论没有原因)
    })
    res = String(out || '')
    outcome = classifyMergeLossOutcome(null)
  } catch (e) {
    res = String((e && e.stdout) || '')
    errFirst = String((e && e.stderr) || '')
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)[0] || ''
    outcome = classifyMergeLossOutcome(e)
  }
  if (outcome.kind === 'ok') {
    clearMergeLossUndetermined()
    return
  }
  if (outcome.kind === 'breach') {
    clearMergeLossUndetermined()
    const n = (res.match(/丢失新增路径\s+(\d+)/) || [])[1] || '?'
    log(
      `⚠️ 合并吞并对账判红:发现合并抹掉对侧独有新增共 ${n} 个路径 —— 修法:node scripts/union-converge.mjs --apply(文件面零丢失 union,先不带 --apply 看报告)`,
    )
    notifyGuardRed(
      '合并吞并对账判红',
      `发现合并抹掉对侧独有新增共 ${n} 个路径 —— 后果是已入库功能被静默回滚,且这枚合并不产生冲突也不进 diff 报告。修法:node scripts/union-converge.mjs --apply(文件面零丢失 union,先不带 --apply 看报告)`,
      // 身份带**路径数的档位**(型③):多一个少一个路径不算新故障,跨档(含清到 0)才算。
      { severity: 'critical', dedupKey: `merge-loss-breach;tier=${alertCountTier(n)}` },
    )
    return
  }
  const { heldMs, firstMs } = noteMergeLossUndetermined()
  const why = [outcome.why, errFirst].filter(Boolean).join(' ⊕ ').slice(0, 240)
  if (heldMs >= MERGE_LOSS_UNDET_HORIZON_MS) {
    log(`⚠️ 合并吞并对账已连续 ${Math.round(heldMs / 60000)} 分钟取不到结论(${why})⇒ 按结构性故障喊人`)
    // 身份走 `alertHeldTier` 那一把通用尺子(6h/24h/72h)。原先自造 30 分钟一档
    // (`Math.floor(heldMs / 30min)`)⇒ 一场"尺子瞎了"的故障一天最多可寄 48 封,与它自己
    // 想压的那个噪声是同一个形态(§5e-1:实时读数进正文,不进身份)。
    const held = alertHeldTier(firstMs)
    notifyGuardRed(
      '合并吞并对账持续取不到结论',
      `check-merge-addition-loss.mjs --all-new 连续 ${Math.round(heldMs / 60000)} 分钟没有可采信的结论 ⇒ 这一层现在是瞎的(别人机器上推来的合并只有这里判得到,提交链那道门不跑 commit-tree 旁路)。\n最近一次原因:${why}\n本段已持续 ${held.hours ?? '?'} 小时(档 ${held.tier})\n手工复跑取证:node scripts/check-merge-addition-loss.mjs --all-new`,
      { severity: 'warning', dedupKey: `merge-loss-undet;held=${held.tier}` },
    )
  } else {
    log(`ℹ️ 合并吞并对账未判定(${why})⇒ 单轮不冒"尺子坏了"的信;连满 ${Math.round(MERGE_LOSS_UNDET_HORIZON_MS / 60000)} 分钟(≈15 趟)才到人,当前已持续 ${Math.round(heldMs / 60000)} 分钟`)
  }
}

/** 本地恢复源的增量刷新层(§5b 里那条"唯一空白层")。
 *  原设计挂在计划任务 `IHUI Git Backup Refresh`(每 15 分钟),但 2026-09-24 实测
 *  `Get-ScheduledTask` 全量列表里**已经没有它**(与 §26 记的 `IHUI C-Drive AutoMaintain`
 *  凭空消失同型)—— 恢复源因此又落后了 100+ 枚提交,而这正是"宿主再删一次 .git 就等价
 *  回滚 100+ 枚"的那个风险本身。判据不能挂在一个会自己消失的东西上,故并入本守护的 tick:
 *  先 `--check`(零副作用、便宜)早退,只有判后落后才跑增量刷新。 */
function refreshRecoverySource() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'git-backup-refresh.mjs')
  if (!existsSync(script)) return
  const call = (args, timeout) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return { code: 0, out: String(out || '') }
    } catch (e) {
      return { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout || '') }
    }
  }
  const judge = call(['--check'], 180000)
  if (judge.code === 0) return
  if (judge.code !== 1) {
    log(`恢复源体检异常(忽略,不阻断其余守护):exit ${judge.code}`)
    return
  }
  const applied = call([], 15 * 60 * 1000) // 增量 fetch 大 gitdir 可到分钟级
  if (applied.code === 0) {
    const to = (applied.out.match(/→\s*([0-9a-f]{7,})/) || [])[1]
    log(`✅ 本地恢复源已增量追平(§5b 空白层)${to ? ` → ${to}` : ''}`)
    // 追平即清偿"这场故障已经多久"的起点,否则下一场失败会拿上一场的账直接落到最高档。
    clearUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', 'backup-refresh-fail-first.json'))
    return
  }
  log(`⚠️ 本地恢复源刷新失败(exit ${applied.code})⇒ 下次 tick 自动重试;手动:node scripts/git-backup-refresh.mjs`)
  // 恢复源不追平 = 宿主再删一次 .git 时只能恢复到旧提交(§5b 记的"回滚 97 个提交"同型),
  // 属"只有守护看得见"的红 —— 判红必须到人,邮件是旁路,失败不影响下轮重试本身。
  notifyGuardRed(
    '本地恢复源刷新失败',
    `git-backup-refresh.mjs 刷新 exit ${applied.code} ⇒ 本地恢复源正在落后于 main,宿主清除 .git 后从它恢复等价回滚。手动:node scripts/git-backup-refresh.mjs`,
    // 21 封全部落在 4h 窗口之外一点(实测间隔 4.00~4.62h,均值 4.05h)⇒ 指纹其实**稳定**
    // (exit 码已被数字归一),这一格是"稳定指纹 × 零有效出口":出口那条命令本身不含
    // 任何创建备份的代码,重跑 = 同一段代码重跑同一个失败(2026-10-03 审计)。
    // 身份带上出口形态,便于将来判据换出口时能分辨"还是那个故障"vs "换了个出口"。
    // 身份带上**已持续档**(2026-10-17):这一格是"稳定指纹 × 零有效出口",原形态是每 4 小时
    // 平铺一封同样的话(实测 21 封,间隔均值 4.05h)——既不打扰到新人,也不告诉收信人"已经拖多久了"。
    // 带档之后:6h / 24h / 72h 各升级一次(跨档即新身份 ⇒ 立即到人),同档内由窗口压住。
    // 起点件在追平成功时清除,不会拿上一场故障的账续命。
    { severity: 'critical', dedupKey: `backup-refresh-fail;exit=${applied.code};held=${alertHeldTier(noteUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', 'backup-refresh-fail-first.json')).firstMs).tier}` },
  )
}

// ══ 判红 → 邮件到人层(2026-09-24 立,§5e 唯一通道)═══════════════════════════════
// 此前守护判红只写 .ihui-agent/state/git-guardian.log:实测"合并吞并对账"抓到 38 个路径被合并抹掉
// 那类事,只有去翻日志的人才知道,而它的后果是**已入库功能被静默回滚**。发信不在此文件自拼
// SMTP/Resend(守门 81 硬拦),唯一出口 = 派生 apps/api/scripts/notify-deploy-failure.ts;
// 形态照抄 scripts/check-credential-health.mjs(同为 scripts/ 下 .mjs 的现役生产者)。
// 纯判据(指纹/去重/状态读写/argv)export 给镜像测试离线取证(§22c/§22d)。


/**
 * 计数折档(型③通用尺子)。边界 0 / 1 / 2-3 / 4-7 / 8+ 沿用本仓 2026-10-05 已验证过的那一档
 * (盘根卫生那格从"原始计数进指纹"改成档位即此边界),**不另拍新数**。
 * 规矩:凡会随并发抖动而变的量(命中条数、红了几个格、拉起几台、腿几条)一律不许直接进
 * 告警名或去重身份 —— 名称里带计数 = 每轮新身份 = 窗口形同虚设(实测:元运维巡检 34 封/5 天、
 * 服务自愈与隧道腿同型)。实时数字照旧进正文,它属于诊断,不属于身份。
 */
export function alertCountTier(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '0'
  if (v === 1) return '1'
  if (v <= 3) return '2-3'
  if (v <= 7) return '4-7'
  return '8+'
}


/**
 * 收件人 = apps/api/.env 的 ALERT_EMAIL_TO(§5e:缺该键 ⇒ 告警链整条排除)。
 * process.env 优先,便于当场取证;本函数只读,绝不写回任何 env 域。
 */
function resolveAlertTo() {
  const fromEnv = String(process.env.ALERT_EMAIL_TO || '').trim()
  if (fromEnv) return fromEnv
  try {
    for (const line of readFileSync(join(WORKTREE, 'apps', 'api', '.env'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*ALERT_EMAIL_TO\s*=\s*(.+?)\s*$/.exec(line)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env 读不到 = 无收件人,由调用方如实降级并写明原因 */
  }
  return ''
}

/**
 * 拼派发器 argv(纯函数,镜像测试钉契约)。
 * ⚠️ 绝不传 `--env-file`:tsx v4 会把它劫持转发给 node 自身,路径不存在时 node 直接 exit 9
 * (§5e 实测坑;check-credential-health 同款约束)。多行中文正文一律 --message-file。
 */
export function buildGuardMailArgv({ to, title, severity, messageFile, dryRun = false, alertId = '', forceAlert = false }) {
  return [
    TSX_ENTRY,
    BRAND_MAIL_SCRIPT,
    '--to',
    to,
    '--title',
    title,
    '--severity',
    severity,
    '--source',
    'git-guardian',
    '--message-file',
    messageFile,
    // 把本层真正拿去重的那个身份交给出口(2026-10-19):不给它,出口的投递台账只能按标题分组,
    // 于是"元运维巡检红"两条**不同身份**的重报会被量算仪数成"同一身份 15 分钟 2 封"的假风暴。
    // 交出去之后:台账按真身份分桶,真·同一身份重复才叫风暴;而本层与出口窗口同为 4 小时、
    // 键又同为该身份 ⇒ 本层放行时出口必然也放行,不会出现"守护以为寄了、出口悄悄压下"。
    ...(alertId ? ['--alert-id', alertId] : []),
    ...(forceAlert ? ['--force-alert'] : []),
    ...(dryRun ? ['--dry-run'] : []),
    '--strict', // 成功 exit 0 / 失败 exit 1,本层据此写/清 UNDELIVERED 标记
  ]
}

/**
 * 子进程输出转诊断文本:逐行脱敏 + 截断。
 *
 * **实现已迁到 `lib/secret-shape-redact.mjs`(G-334 / G-400 合派一枚)。**
 * 本文件原先自带一份逐字相同的实现(同一条 `SECRETISH_RE` 字面量、同一个 `limit = 300`),
 * 而两侧消费面不同 ⇒ 漂移表现不同:一侧拼进到人邮件正文,一侧写守护日志与 UNDELIVERED 标记。
 * 这条链的失败形态是**安静**的 —— 漂了的一侧只会让某些告警少打码或多打码,没有任何门会喊。
 * 现在改调那一份;下面这行 `export` 只为保住既有出口(镜像测试与外部消费面仍按原路径取这个名字),
 * 实现本身一个字都不在这里 —— 规则字面量再次出现在本文件,就是又抄了一份。
 */
export { redactChildOutput }

/** dry-run 通道判定:派发器自报"至少一条通道齐备"才算可用(与 check-credential-health 同判据) */
export function judgeDryRunChannel(stdout) {
  return /通道判定 (?:SMTP|Resend): 可用/.test(String(stdout ?? ''))
}

/** 品牌派发器的一次调用:异常/超时一律归为失败,绝不抛出(通知层不能把守护带崩) */
function dispatchGuardMail({ title, desp, severity, dryRun = false, alertId = '', forceAlert = false }) {
  if (!existsSync(TSX_ENTRY) || !existsSync(BRAND_MAIL_SCRIPT)) {
    return {
      ok: false,
      why: `品牌派发器缺失(tsx=${existsSync(TSX_ENTRY)} 脚本=${existsSync(BRAND_MAIL_SCRIPT)})`,
    }
  }
  const to = resolveAlertTo()
  if (!to) return { ok: false, why: '无收件人(apps/api/.env 缺 ALERT_EMAIL_TO)' }
  let msgFile = null
  try {
    mkdirSync(NOTIFY_MSG_DIR, { recursive: true })
    // 无 BOM UTF-8 文件:命令行参数要过一层控制台代码页(GBK),多行中文必被截坏(§5e)
    msgFile = join(NOTIFY_MSG_DIR, `${Date.now()}-${process.pid}.txt`)
    writeFileSync(msgFile, desp, 'utf8')
    const r = spawnSync(process.execPath, buildGuardMailArgv({ to, title, severity, messageFile: msgFile, dryRun, alertId, forceAlert }), {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
      timeout: NOTIFY_DISPATCH_TIMEOUT_MS,
    })
    if (r.error) return { ok: false, why: `派发器进程异常(${r.error.code || r.error.name}): ${redactChildOutput(r.error.message)}` }
    if (dryRun) return { ok: judgeDryRunChannel(r.stdout), why: `通道判定: ${redactChildOutput(r.stdout)}` }
    if (r.status === 0) return { ok: true, why: '已送达' }
    return { ok: false, why: `exit=${r.status} ${redactChildOutput(r.stderr || r.stdout)}` }
  } catch (e) {
    return { ok: false, why: `派发器调用异常: ${redactChildOutput((e && e.message) || e)}` }
  } finally {
    // §26:临时物用完必须删 —— 守护身份下落错的临时文件没人回收
    if (msgFile) rmSync(msgFile, { force: true })
  }
}

function readNotifyText(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function writeNotifyJson(file, obj) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(obj, null, 1), 'utf8')
}

/**
 * 守护判红时的唯一出口。**旁路通知,不改自愈行为本身**:整个函数体裹 try,
 * 落盘/派发/状态任一环节炸掉都只降级为日志一行,原调用方(三个自愈层)照常走完。
 * 所有依赖(时间/派发/路径/日志)可注入,离线取证见镜像测试。
 * @returns {{sent:boolean, suppressed?:boolean, why:string}}
 */
/**
 * 派发点身份覆盖自检(纯函数,§22c 由镜像测试直接消费,不在测试里重写一份判据)。
 *
 * 每个 `notify(` / `notifyGuardRed(` 派发点的 options 必须**显式**给出二者之一:
 *   · `dedupKey` —— 稳定语义身份(类×折档),措辞与实时读数只进正文;
 *   · `force: true` —— 主动通道自测(`--notify-test`),按设计绕过当轮窗口。
 * 两者都没有的,身份退回 `alertFingerprint(name, detail)`:那把尺子把 detail 归一成指纹,
 * 今天 detail 恰好是常量时碰巧稳定,但**任何一次改措辞都会静默换身份**、窗口当场作废再寄一轮
 * (§5e-1 型②)。2026-10-19 全量派发点审计实测抓到一枚(`.env 漂移巡检没装车`),已补。
 */
export function auditDispatchSites(src) {
  const lines = String(src || '').split('\n')
  const sites = []
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    // 注释里提到的 `notifyGuardRed()` 不是派发点(§0.3:判据要落在真调用的那一行)
    const t = raw.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    // 调用点:标识符前不得是 `= , : ( ! . & |`(赋值/默认参数/引用都不是派发)
    if (!/(?:^|[^\w.$=,:(!&|?])(?:notify|notifyGuardRed)\(/.test(raw)) continue
    // 选项块 = 本次调用自身:直到出现"整行只有一个右括号"那行为止(多行调用即闭合行)
    let j = i
    while (j < lines.length && j < i + 40 && !/^\s*\)/.test(lines[j])) j += 1
    const block = lines.slice(i, Math.min(j + 1, lines.length)).join('\n')
    const name = (block.match(/(?:notify|notifyGuardRed)\(\s*[`']([^`'\n]+)[`']/) || [])[1] || '?'
    sites.push({
      line: i + 1,
      name,
      hasDedupKey: /dedupKey/.test(block),
      hasForce: /force:\s*true/.test(block),
    })
  }
  return sites
}

export function notifyGuardRed(name, detail, opts = {}) {
  const {
    severity = 'warning',
    now = Date.now(),
    dispatch = dispatchGuardMail,
    stateFile = NOTIFY_STATE,
    undelFile = NOTIFY_UNDEL,
    windowMs = notifyWindowMs(),
    failCooldownMs = notifyFailCooldownMs(),
    dedupKey = '',
    force = false,
    logger = log,
  } = opts
  try {
    if (!force) {
      // --check 是 CI 口径(零副作用),通知归真巡检轮;显式开关只关"要不要发",不关"发几封"
      if (process.env.GIT_GUARDIAN_NOTIFY_DISABLED === '1') return { sent: false, why: 'GIT_GUARDIAN_NOTIFY_DISABLED=1,已关闭' }
      if (CHECK_ONLY) return { sent: false, why: '--check 模式零副作用,不发' }
    }
    const fp = dedupKey ? stableAlertFingerprint(name, dedupKey) : alertFingerprint(name, detail)
    const state = parseNotifyState(readNotifyText(stateFile))
    if (!force && !shouldAlert(state, name, fp, now, { windowMs, failCooldownMs })) {
      return { sent: false, suppressed: true, why: '同一原因窗口内已通报,本轮压住' }
    }
    const title = `【git-guardian】${name}`
    const desp =
      `${detail}\n\n` +
      `来源:git-guardian 周期守护(计划任务 "${TASK_NAME}",每 2 分钟一趟)@ ${hostname()}。\n` +
      `去重:同指纹 ${Math.round(windowMs / 60000)} 分钟窗口内只寄一封(按身份去重、无总量封顶);` +
      `内容变化视为新故障立即重报。投递失败按 ${Math.round(failCooldownMs / 60000)} 分钟退避重试并留 UNDELIVERED 标记。\n` +
      (dedupKey
        ? `本告警按稳定身份去重(判据:违规类别与计数),明细行不进指纹 —— 清单里多一个条目/路径变化不算新故障,` +
          `否则多会话并发建删 worktree 会把窗口绕成虚设。真变化(违规类别或计数变了)仍立即重报。\n`
        : '') +
      `本层只是旁路通知,不改变守护的自愈行为;紧急静音:GIT_GUARDIAN_NOTIFY_DISABLED=1。`
    const callDispatch = () => {
      // 身份交给出口(台账按真身份分桶);force 档必须同时给 --force-alert,否则
      // "人工核验一次通道"会被出口那一侧的窗口悄悄压下,而自测的本意就是"必须真发一封"。
      const alertId = `git-guardian;${name};${fp.slice(0, 12)}`
      // 派发器抛异常 = 投递失败(写 UNDELIVERED、按退避重试),不是"通知层炸了就走人" ——
      // 失败必须响(§5e);真正的兜底是外层 catch,它接的是落盘/状态这类结构性异常。
      try {
        return dispatch({ title, desp, severity, dryRun: false, alertId, forceAlert: force })
      } catch (e) {
        return {
          ok: false,
          why: `派发器调用异常(通知层接住): ${String((e && e.message) || e).slice(0, 160)}`,
        }
      }
    }
    if (force) {
      // 人工核验入口(--notify-test):不读写去重状态(一次手工测试不该污染或抢占窗口)
      const r = callDispatch()
      if (r.ok) {
        // **自测成功也清 UNDELIVERED 标记**(2026-10-03 补)。原先只有真实告警那条路径清,
        // 于是「跑一次 --notify-test 证明通道是好的」之后,P8「投递失败标记」仍红 ——
        // 那格判的是"有故障从未被人看见",而人刚亲眼验过通道通,标记却留着,
        // 等于**唯一能自证清白的那条路被设计堵死**(实测:真投递成功后 P8 仍 findings=1)。
        // 清它不等于承认某条真欠账已还:欠账的真值在 notify-state 的 `delivered` 维,
        // 由 P10 读;这个文件只是"最近一次投递失败"的**瞬时标记**。
        try {
          rmSync(undelFile, { force: true })
        } catch {
          /* 标记清不掉不影响"通道已验通"这个事实,下一轮真实投递还会再清 */
        }
        logger(`✅ 通知自测已送达: ${name} → ${maskEmail(resolveAlertTo())}`)
        // 投递台账由唯一出口 `notify-deploy-failure.ts` 记(`--probe-deliver` 那一趟也算),
        // 本层不再另写一份 —— 两边都写就是把一封数成两封。
      } else {
        writeNotifyJson(undelFile, { ts: now, name, fp, why: r.why })
        logger(`⚠️ 通知自测失败: ${name} — ${r.why}`)
      }
      return { sent: Boolean(r.ok), why: r.why }
    }
    const r = callDispatch()
    if (r.ok) {
      writeNotifyJson(stateFile, withAlertMark(state, name, fp, now, true))
      rmSync(undelFile, { force: true }) // 下一次成功投递自动清除失败标记(§5e)
      logger(`✅ 判红通报已寄出: ${name} → ${maskEmail(resolveAlertTo())}`)
    } else {
      // 失败不记"已送达"⇒ 下轮(退避后)还会重试;标记落盘让人在 --status/日志里看得见
      writeNotifyJson(stateFile, withAlertMark(state, name, fp, now, false))
      writeNotifyJson(undelFile, { ts: now, name, fp, why: r.why })
      logger(`⚠️ 判红通报投递失败: ${name} — ${r.why}(已写 UNDELIVERED 标记,${Math.round(failCooldownMs / 60000)} 分钟后重试)`)
    }
    return { sent: Boolean(r.ok), why: r.why }
  } catch (e) {
    // 兜底:通知层自身任何异常都吞掉 —— 守护崩了比不发邮件严重得多(原自愈与退出码不受影响)
    try {
      logger(`⚠️ 通知层自身异常(已忽略,不影响自愈): ${String((e && e.message) || e).slice(0, 160)}`)
    } catch {}
    return { sent: false, why: '通知层自身异常(已忽略)' }
  }
}

/** 通知层健康摘要(供 --status 如实显示:已配置/无收件人/上次投递失败) */
function notifySummary() {
  try {
    const to = resolveAlertTo()
    const undel = readNotifyText(NOTIFY_UNDEL)
    let undelivered = null
    if (undel) {
      try {
        undelivered = JSON.parse(undel)
      } catch {
        undelivered = { raw: undel.slice(0, 200) }
      }
    }
    const state = parseNotifyState(readNotifyText(NOTIFY_STATE))
    return {
      configured: Boolean(to) && existsSync(TSX_ENTRY) && existsSync(BRAND_MAIL_SCRIPT),
      to: to ? maskEmail(to.split(',')[0].trim()) : '(无收件人:apps/api/.env 缺 ALERT_EMAIL_TO)',
      disabled: process.env.GIT_GUARDIAN_NOTIFY_DISABLED === '1',
      windowMs: notifyWindowMs(),
      alerts: Object.entries(state).map(([k, v]) => ({
        name: k,
        delivered: v.delivered,
        ts: new Date(v.ts).toISOString(),
      })),
      undelivered,
    }
  } catch (e) {
    return { configured: false, error: `通知层状态无法判定(${String((e && e.message) || e).slice(0, 120)})` }
  }
}

// ── 收敛器收尾对齐停摆的阈值判据与检查(2026-09-25 票 O74,纯函数化以便构造输入取证) ──

/** 阈值解析:cfg 显式值 > env(IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS)> 默认 3 / 600000 */
function alignStallThresholds(cfg = {}) {
  const envFails = parseInt(process.env.IHUI_ALIGN_STALL_FAILS ?? '', 10)
  const envAge = parseInt(process.env.IHUI_ALIGN_STALL_AGE_MS ?? '', 10)
  return {
    minFails: Number.isFinite(cfg.minFails)
      ? cfg.minFails
      : Number.isFinite(envFails)
        ? envFails
        : ALIGN_STALL_DEFAULT_FAILS,
    minAgeMs: Number.isFinite(cfg.minAgeMs)
      ? cfg.minAgeMs
      : Number.isFinite(envAge)
        ? envAge
        : ALIGN_STALL_DEFAULT_AGE_MS,
  }
}

/**
 * 该不该喊人:**连续失败 ≥ minFails 且 最后失败距今 ≥ minAgeMs** 才 alert。
 * 状态缺失 / 坏 JSON / consecutiveFailures 不是有限数 ⇒ "无法判定",一律不喊
 * (绝不因为"状态文件不存在"喊人;恢复成功后计数归零,同样不喊)。
 */
export function shouldAlertAlignStall(state, nowMs, cfg = {}) {
  const { minFails, minAgeMs } = alignStallThresholds(cfg)
  if (
    !state ||
    typeof state !== 'object' ||
    Array.isArray(state) ||
    !Number.isFinite(state.consecutiveFailures)
  ) {
    return { alert: false, reason: '状态缺失或不可读(无法判定 ⇒ 不喊)', fails: null, ageMs: null }
  }
  const fails = state.consecutiveFailures
  if (fails < minFails) {
    return { alert: false, reason: `连续失败 ${fails} 次 < 阈值 ${minFails}`, fails, ageMs: null }
  }
  if (!Number.isFinite(state.lastFailAt)) {
    return { alert: false, reason: 'lastFailAt 缺失(无法判定 ⇒ 不喊)', fails, ageMs: null }
  }
  const ageMs = nowMs - state.lastFailAt
  if (ageMs < minAgeMs) {
    return {
      alert: false,
      reason: `最后失败距今 ${Math.round(ageMs / 1000)}s < 阈值 ${minAgeMs}ms`,
      fails,
      ageMs,
    }
  }
  return {
    alert: true,
    reason: `连续失败 ${fails} 次且 ${Math.round(ageMs / 60000)} 分钟未恢复`,
    fails,
    ageMs,
  }
}

/**
/**
 * 自愈尝试台账(跨轮):读不出/坏 JSON 一律当"空台账"重新开始,**不得**因此永久禁用自愈
 * (fail-closed 的方向是"宁可多试",不是"从此不修")。
 */
export function readAlignHealAttempts(p = ALIGN_HEAL_ATTEMPT_LOG) {
  try {
    const v = JSON.parse(readFileSync(p, 'utf8'))
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return v
  } catch {
    return {}
  }
}

/** 写尝试台账:失败只返回 false(自愈记录丢不得让本层抛,抛了会打断整轮 tick) */
export function writeAlignHealAttempts(map, p = ALIGN_HEAL_ATTEMPT_LOG) {
  try {
    mkdirSync(dirname(p), { recursive: true })
    const tmp = `${p}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(map, null, 1), 'utf8')
    renameSync(tmp, p) // 原子替换:与收敛器侧 recordAlignOutcome 同一形态
    return true
  } catch {
    return false
  }
}

/**
 * 纯判据(导出以便独立钉死):这一轮该不该派一次对齐自愈。
 *
 * 提成纯函数而不是埋在 tick 里:这四道判据(总开关 / 已有停摆 / 节流 / 熔断)任意一道写反,
 * 症状都是"要么永不修、要么每 2 分钟重试一次",而这两种在日志上都不报错 ——
 * 只有把判据单独拎出来测,才钉得住。
 *
 * @param state  收敛器写的对齐台账(converge-align-state.json 解析结果)
 * @param ledger 本守护的自愈尝试台账(上一次自愈时间戳 + 已用次数)
 * @param now    当前时刻(ms)
 * @param cfg    测试注入口(阈值/节流/熔断/禁用)
 */
export function decideAlignHeal(state, ledger, now, cfg = {}) {
  const throttleMs = Number.isFinite(cfg.throttleMs) ? cfg.throttleMs : ALIGN_HEAL_THROTTLE_MS
  const maxAttempts = Number.isFinite(cfg.maxAttempts) ? cfg.maxAttempts : ALIGN_HEAL_MAX_ATTEMPTS
  const disabled = Boolean(cfg.disabled)

  if (disabled) return { heal: false, why: '自愈被 ALIGN_HEAL_DISABLED=1 显式关掉' }
  // 计数为 0 = 上轮对齐是好的,没有任何事要修。别在健康时也去派生对齐器。
  const fails = state && Number.isFinite(state.consecutiveFailures) ? state.consecutiveFailures : 0
  if (fails < 1) return { heal: false, why: '对齐台账无失败(无需自愈)' }
  const lastTry = ledger && Number.isFinite(ledger.lastAttemptAt) ? ledger.lastAttemptAt : 0
  const used = ledger && Number.isFinite(ledger.attempts) ? ledger.attempts : 0
  if (used >= maxAttempts) {
    return { heal: false, why: `自愈已用满 ${used}/${maxAttempts} 次 ⇒ 熔断,转人工` }
  }
  if (lastTry && now - lastTry < throttleMs) {
    return { heal: false, why: `距上次自愈 ${Math.round((now - lastTry) / 60000)} 分钟 < 节流 ${Math.round(throttleMs / 60000)} 分钟` }
  }
  return { heal: true, why: `失败 ${fails} 次且可自愈(第 ${used + 1}/${maxAttempts} 次)`, used }
}

/**
 * 收尾对齐停摆的**自愈**(2026-10-04 立)。
 *
 * 派 `git-sync-converge.mjs --align-only`(只跑收尾对齐,不 fetch/不合并/不推送 ——
 * 那个旗标是 2026-10-04 同批加的,正是为了让这一格有"不会顺手做别的事"的最小动作面)。
 *
 * **成败不靠退出码判,靠回读台账**:子进程退出 0 只说明"它跑完了",而这一格真正要的证据是
 * `converge-align-state.json` 的 consecutiveFailures 归零。只信 rc 的话,一个"跑完但没归零"的
 * 状态会被记成已修好,下一轮又去修,于是熔断计数被无意义地消耗光 —— 那就退化成每 2 分钟
 * 试一次,正是本条要防的东西。
 *
 * 返回 `{ healed, ok, why, attempts }`:`ok` = 这次自愈后确实归零。
 */
export function healConvergeAlignStall(opts = {}) {
  const {
    now = Date.now(),
    statePath = CONVERGE_ALIGN_STATE,
    attemptLogPath = ALIGN_HEAL_ATTEMPT_LOG,
    cfg = {},
    // 测试注入口:镜像测试绝不在真仓库里派生对齐器
    run = null,
    log: logFn = log,
  } = opts

  const disabled = cfg.disabled ?? process.env.IHUI_ALIGN_HEAL_DISABLED === '1'
  const state = readAlignStateSafe(statePath)
  const ledger = readAlignHealAttempts(attemptLogPath)
  const d = decideAlignHeal(state, ledger, now, { ...cfg, disabled })
  if (!d.heal) {
    if (d.why && !disabled) logFn(`ℹ️ 收尾对齐自愈未派发:${d.why}`)
    return { healed: false, ok: false, why: d.why, attempts: ledger.attempts ?? 0 }
  }

  // 先落"已尝试",再跑:这样即使派发器本身把本进程带走(超时/异常),也不会留下一条
  // "从没试过"的记录而在下一轮立刻再派一次(那会让节流形同虚设)。
  //
  // ⚠ 2026-10-04 复核补一个**反直觉但必须**的分支:台账写失败时**仍然继续跑**。
  // 直觉上"记不上账就别动手",但那样更糟:台账写不下去(磁盘满 / .ihui-agent/state 权限)时
  // attempts 永远读成 0、lastAttemptAt 永远为空 ⇒ **节流与熔断双双永不触发**
  // ⇒ 每 2 分钟派发一次(每轮都真跑一个 40–51 秒的对齐器),正是本条要防的那件事。
  // 写失败只意味着"本轮记不上账",下轮照旧会派 —— 与其在没护栏的情况下猛跑,
  // 不如把"台账写不进去"这件事喊出来(下面 ok=false + why 点名),让熔断余量不至于
  // 被无声烧光。**判据:哪个方向的失败更危险,选哪个。**
  const nextAttempts = (d.used ?? 0) + 1
  const ledgerWritten = writeAlignHealAttempts(
    { lastAttemptAt: now, attempts: nextAttempts, lastWhy: d.why },
    attemptLogPath,
  )
  if (!ledgerWritten) {
    logFn(
      `⚠️ 收尾对齐自愈台账写入失败(${attemptLogPath}):节流/熔断将从下一轮起失效(每轮都会重派)—— 请修该路径的可写性`,
    )
  }
  // 刻意**不**再写一份进程内副本:跨轮时进程内存不可靠,台账文件才是唯一真凭据 ——
  // 两处各记一次必然漂移(本仓反复登记的同型)。

  const timeoutMs = Number(cfg.runTimeoutMs ?? 15 * 60 * 1000)
  let ran = { ok: false, why: '未执行(注入替身缺席)' }
  try {
    ran = run
      ? run()
      : (() => {
          const r = spawnSync(process.execPath, ['scripts/git-sync-converge.mjs', '--align-only'], {
            cwd: WORKTREE,
            encoding: 'utf8',
            windowsHide: true,
            timeout: timeoutMs,
            stdio: ['ignore', 'pipe', 'pipe'], // 无 input ⇒ ignore 三态(本机派生 git 的既有判据)
          })
          if (r.error) return { ok: false, why: `派发异常:${r.error.code || r.error.name}` }
          if (r.timedOut) return { ok: false, why: `派发超时(${timeoutMs}ms)` }
          return { ok: r.status === 0, why: `exit=${r.status}` }
        })()
  } catch (e) {
    ran = { ok: false, why: `自愈调用异常:${String((e && e.message) || e).slice(0, 120)}` }
  }

  // **回读台账**判成败(见函数头注:不能只信 rc)
  const after = readAlignStateSafe(statePath)
  const failsAfter = after && Number.isFinite(after.consecutiveFailures) ? after.consecutiveFailures : null
  const ok = failsAfter === 0
  // 2026-10-04 复核补:对齐层跑完也写同一个 tick —— 否则 healWorktreeTracked 的节流
  // 永远看不到"对齐层刚跑过",节流形同虚设(两边各写一次才是闭环,单写不读或单读不写都是半拉)。
  // 写失败只记日志:节流戳丢一次的后果是多跑一遍,不是正确性问题。
  try {
    mkdirSync(dirname(WORKTREE_ALIGN_TICK), { recursive: true })
    writeFileSync(WORKTREE_ALIGN_TICK, String(now), 'utf8')
  } catch (e) {
    logFn(`ℹ️ 对齐层节流戳写入失败(下轮可能多跑一遍工作区自愈):${String((e && e.message) || e).slice(0, 100)}`)
  }
  logFn(
    `${ok ? '✅ 自愈成功' : '⚠️ 自愈未修复'}: 收尾对齐(${ran.why}) ⇒ 失败计数 ${
      failsAfter === null ? '读不到' : failsAfter
    }${ok ? '' : ' ⇒ 仍需人工'}`,
  )
  if (ok) {
    // 归零台账:故障已除,留着的计数会让下一轮真故障一开始就撞上熔断余量。
    try {
      writeAlignHealAttempts({ lastAttemptAt: now, attempts: 0, lastWhy: `已恢复:${ran.why}` }, attemptLogPath)
    } catch {
      /* 台账写失败不影响"已恢复"这个结论 */
    }
  }
  return { healed: true, ok, why: ran.why, attempts: nextAttempts, failsAfter }
}

/** 读对齐台账;读不到/坏 JSON 一律返回 null("无法判定"),不抛(同收敛器侧 readAlignState 形态) */
function readAlignStateSafe(p) {
  try {
    const v = JSON.parse(readFileSync(p, 'utf8'))
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    return v
  } catch {
    return null
  }
}

/**
 * 每轮 tick 的收尾对齐停摆检查。notify 出口可注入(镜像测试用假派发器断言参数,
 * 绝不在测试里真发邮件);检查层自身任何异常只降级为一行日志,不改守护自愈与退出码。
 * detail 里的数字(次数/分钟)会被 alertFingerprint 归一为 '#' ⇒ 停摆期间同指纹,
 * 由 notifyGuardRed 的 4h 窗口压住重复轰炸;恢复后计数归零,自然不再触发。
 */
export function checkConvergeAlignStall(opts = {}) {
  const {
    now = Date.now(),
    statePath = CONVERGE_ALIGN_STATE,
    notify = notifyGuardRed,
    cfg = {},
    // 自愈出口可注入(镜像测试绝不在真仓库里派生对齐器)
    heal = healConvergeAlignStall,
  } = opts
  try {
    let state = null
    try {
      state = JSON.parse(readFileSync(statePath, 'utf8'))
    } catch {
      return { alert: false, reason: '状态文件读不到/坏 JSON ⇒ 无法判定,不喊' }
    }
    // 2026-10-04:**先自愈,再判要不要喊**(顺序不能反 —— 反了就还是"先发信再说")。
    // 只有自愈没把失败计数归零、且已用满熔断次数,才升级为喊人;否则等于每轮发一封
    // "正在修"的邮件,那比不修更吵。
    let healNote = ''
    try {
      const h = heal({ now, statePath, cfg: cfg.heal ?? {} })
      if (h?.healed) {
        healNote = `\n自动修复:已派 ${'git-sync-converge.mjs --align-only'}(${h.why}) ⇒ ${
          h.ok ? '失败计数已归零,本条自行解除' : `仍未修复(失败计数 ${h.failsAfter ?? '读不到'}),需人工`
        }`
        if (h.ok) {
          return {
            alert: false,
            reason: `已自动修复(对齐自愈成功,尝试 ${h.attempts} 次)${healNote ? '' : ''}`,
            healed: true,
          }
        }
      } else if (h && h.why) {
        // 2026-10-04 复核补:原实现只在 `h.healed` 为真时写 healNote,于是**熔断/节流**
        // (decideAlignHeal 返回 healed:false,why=「自愈已用满 3/3 次 ⇒ 熔断,转人工」/
        //  「距上次自愈 N 分钟 < 节流 M 分钟」)这两档的 why 被整段丢弃 ——
        // 收信人看到的是一条「从没说有人试过」的告警,与本文件头注
        // 「收信人第一眼就要知道机器已经自己试过几次」**方向相反**。
        // 而熔断恰恰是**最该让人看见**的一档:它意味着"自动修已经停手,等人"。
        // 附带修掉一个静默区间:节流档(fails=1..2 时达不倒告警阈值)原先既不修也不喊,
        // 现在至少把"为什么这次没修"写进日志与正文,不再是一个无声的静默重试。
        healNote = `\n自动修复:本轮未派发(${h.why}) ⇒ 机器已自愈 ${h.attempts ?? 0} 次;仍需人工`
        log(`ℹ️ 收尾对齐自愈未派发:${h.why}`)
      }
    } catch (e) {
      // 自愈自身异常**不得**阻断喊人:这是最后一层,静默退化比抛出去危险得多。
      healNote = `\n自动修复:自愈层自身异常,已跳过(${String((e && e.message) || e).slice(0, 120)})`
    }
    const d = shouldAlertAlignStall(state, now, cfg)
    if (!d.alert) return d
    const detail =
      `收敛器收尾对齐(git-sync-converge → heal-worktree-tracked --align-drift)连续失败 ${d.fails} 次,` +
      `已 ${Math.round((d.ageMs ?? 0) / 60000)} 分钟未恢复。长期失败意味着工作区持续落后 HEAD(§12d 静默回滚温床)。\n` +
      `最后失败时间: ${new Date(state.lastFailAt).toISOString()}\n` +
      `rc/真因(收敛器 alignFailureNote 原文): ${String(state.lastNote ?? '(无)').slice(0, 200)}\n` +
      `状态文件: ${statePath}\n` +
      // 出口 1(§5e-1):此前这一格**连尺子命令都没给**,只给一个状态文件路径 ——
      // 比"手动:xxx"还退一档,收信人拿到信完全无从下手。补三条真能用的:
      // ① 只读复现对齐器这一格;② **只跑对齐**(2026-10-04 新增,见下);
      // ③ 真跑收敛(它自身幂等,失败会留 note)。
      // ② 为什么必需(实测 24.8 小时停摆的结构性原因):`alignWorktreeAfterHeadMove` 只在
      // **真的推进了 HEAD** 之后才被调,而"本地提交已被远端包含"那一轮实测 7 秒 rc=0 且
      // 整段跳过 ⇒ 台账不归零 ⇒ **只给 ③ 时,收信人在本地已同步的常态下怎么跑都解不掉这条告警**。
      `出路:node scripts/git-sync-converge.mjs --align-only(只跑收尾对齐,幂等,台账即归零) / node scripts/git-sync-converge.mjs --status(只读看对齐状态) / node scripts/git-sync-converge.mjs(跑一轮收敛,幂等)` +
      // 自愈痕迹入正文:收信人第一眼就要知道"机器已经自己试过几次、为什么没成",
      // 否则每次都得回头翻日志才知道这封信是自动修复失败后的升级(2026-10-04)。
      healNote
    notify('converge-align-stall', detail, {
      // dedupKey(§5e-1 配套,6 封):正文含 `已 N 分钟未恢复` 与失败时刻,逐轮变。
      // 身份取"失败次数档位 + 真因类别"。原写法 `Math.min(fails,9)` 只**截顶**未折档
      // —— 1→2→…→9 每一档都是新身份(注释却自称"分档"),同一场停摆最多另寄 9 封;
      // 现走 `alertCountTier` 这一把通用尺子(0/1/2-3/4-7/8+,跨档才算真恶化)。
      dedupKey: `align-stall;fails=${alertCountTier(d.fails)}`,
    })
    return d
  } catch (e) {
    log(
      `⚠️ 收敛对齐停摆检查自身异常(已忽略,不影响自愈): ${String((e && e.message) || e).slice(0, 160)}`,
    )
    return { alert: false, reason: '检查异常(已吞)' }
  }
}

/** 〈原 22 行头注已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-24.md#git-guardian-L2743〉 受管 `.env` 的「键值被悄悄清空」巡检 + 到人(2026-09-26 立,PLAN G-223 第三格)。 */
/**
 * `.env` 那一族"这一轮取不到输入"的信(不可判定 / 未判定 / 退出码与结论不符)必须有持续性门槛。
 *
 * 为什么(2026-10-17 同族审计点名的型②残留格):守护每 2 分钟一趟(任务 `IHUI-AI git-guardian`,
 * 本文件 :36/:107 现读),而这把尺子的正常一趟是秒级读数 ⇒ **单轮**取不到输入最常见的成因就是本机
 * 并发争用(别席正在重写 env / 派生被抢),它不是"这一格瞎了",寄信只会把人叫来看一个已经好了的东西。
 * 连满 30 分钟(≈15 趟)全是取不到,才够格按结构性故障到人。方向照 §0.10:短窗只报名并写明已持续多久,
 * 绝不是放行;跨持续档(`alertHeldTier`)即新身份立刻重报,不会被压成静音。
 */
const ENV_UNDET_FILE = join(WORKTREE, '.ihui-agent', 'state', 'env-drift-undetermined-first.json')
const ENV_UNDET_HORIZON_MS = Number(process.env.IHUI_ENV_UNDET_HORIZON_MS || 30 * 60 * 1000)

export function notifyEnvUndetermined(name, detail, notify, logger, file = ENV_UNDET_FILE, horizonMs = ENV_UNDET_HORIZON_MS, keyPrefix = 'env-undet') {
  const { firstMs, heldMs } = noteUndeterminedStreak(file)
  const held = alertHeldTier(firstMs)
  if (heldMs >= horizonMs) {
    notify(
      name,
      `${detail}\n这已连到 ${Math.round(heldMs / 60000)} 分钟(门槛 ${Math.round(horizonMs / 60000)} 分钟 ≈ 守护 15 趟)⇒ 这一格现在是**瞎的**,不再只是"这一轮抢不到"。\n持续档=${held.tier}(跨档即刻重报;起点件 ${file},取到任一确定结论即清零)`,
      { dedupKey: `${keyPrefix};name=${name};tier=${held.tier}` },
    )
    logger(`⚠️ ${name}:连续 ${Math.round(heldMs / 60000)} 分钟取不到结论 ⇒ 已派发到邮件通道`)
    return { mailed: true, heldMs, tier: held.tier }
  }
  logger(`ℹ️ ${name}:单轮取不到输入 ⇒ 只报名不寄信(连满 ${Math.round(horizonMs / 60000)} 分钟才到人;当前已持续 ${Math.round(heldMs / 60000)} 分钟)`)
  return { mailed: false, heldMs, tier: held.tier }
}

export function auditEnvDrift(opts = {}) {
  const {
    notify = notifyGuardRed,
    run = runEnvDriftProbe,
    logger = log,
    // 这两枚只为准成对夹具而开(测试不得碰真 .ihui-agent/state 的台账、也不得等真 30 分钟):
    // 生产调用一律走默认值,语义与不带参数逐字相同。
    undetFile = ENV_UNDET_FILE,
    horizonMs = ENV_UNDET_HORIZON_MS,
  } = opts
  const probe = run()
  if (probe.missing) {
    // 判据被摘线的形态必须能被发现:尺子不在位 ≠ 一切正常(守门 70/76/81 同型)。
    // 两个文件都是被跟踪的,任何检出都该同时在场 ⇒ 这一档不是"机器态",不享受静默未判定。
    logger('⚠️ .env 漂移巡检没装车:scripts/check-env-drift.mjs 不在这台机上 ⇒ 这一格当前无人看守')
    notify(
      '.env 漂移巡检没装车(尺子文件不在这台机上)',
      'check-env-drift.mjs 不存在或被删 ⇒ 这一格当前无人看守,而账面看起来"什么都没发生"。',
      // dedupKey 必填(2026-10-19 全量派发点审计补齐):不写就退回 `alertFingerprint(name, detail)`
      // —— 那把尺子把 detail 归一成指纹,今天这段 detail 是常量所以碰巧稳定,但**任何一次改措辞
      // 都会静默换身份**,窗口当场作废、重寄一轮(§5e-1 型②)。身份只认语义主键,措辞只进正文。
      { dedupKey: 'env-drift;not-installed' },
    )
    return { state: 'not-installed' }
  }
  let parsed = null
  try {
    parsed = JSON.parse(probe.stdout)
  } catch {
    parsed = null
  }
  if (!parsed || !Array.isArray(parsed.verdicts)) {
    logger(
      `⚠️ .env 漂移巡检不可判定(exit ${probe.code},输出不是可解析 JSON)⇒ 手动:node scripts/check-env-drift.mjs`,
    )
    notifyEnvUndetermined(
      '.env 漂移巡检不可判定(尺子输出不是 JSON)',
      `派生 exit ${probe.code} 而 stdout 不可解析 ⇒ 判据本身坏了,不得当作"已通过"。` +
        `\nstdout 前 400 字符:${String(probe.stdout || '').slice(0, 400)}\n手动:node scripts/check-env-drift.mjs`,
      notify,
      logger,
      undetFile,
      horizonMs,
    )
    return { state: 'unreadable', code: probe.code }
  }
  const c = parsed.counts || {}
  if (Number(c.drift || 0) > 0) {
    logger(
      `❌ 受管 .env 检出键值漂移:${parsed.verdicts
        .filter((v) => v.state === 'drift')
        .map((v) => `${v.id}(${v.drift.length} 键)`)
        .join(', ')}`,
    )
    notify('.env 键值漂移(有键从非空变成空/整键缺失)', envDriftDetail(parsed, '漂移'), {
      severity: 'critical',
      // 键集漂移是**状态量**(§5e-1 可整改:收信人能干的事就是回填那一枚键),照旧一轮即到人。
      // 身份只放"漂掉的键名集合",实时条数进正文。
      dedupKey: `env-drift;keys=${parsed.verdicts
        .filter((v) => v.state === 'drift')
        .flatMap((v) => v.drift || [])
        .sort()
        .join('+')
        .slice(0, 600)}`,
    })
    clearUndeterminedStreak(undetFile)
    return { state: 'drift', counts: c }  }
  if (Number(c.undetermined || 0) > 0) {
    logger(
      `❓ 受管 .env 巡检未判定:${parsed.verdicts
        .filter((v) => v.state === 'undetermined')
        .map((v) => v.id)
        .join(', ')}(不记为通过)`,
    )
    notifyEnvUndetermined('.env 漂移巡检未判定(现文件缺失或无同目标备份可比)', envDriftDetail(parsed, '未判定'), notify, logger, undetFile, horizonMs)
    return { state: 'undetermined', counts: c }
  }
  if (Number(probe.code) !== 0) {
    logger(
      `⚠️ .env 漂移巡检退出码与结论不符(exit ${probe.code} 却零漂移零未判定)⇒ 尺子坏了,手动:node scripts/check-env-drift.mjs`,
    )
    notifyEnvUndetermined('.env 漂移巡检自身异常(退出码与结论不符)', envDriftDetail(parsed, '结论与退出码矛盾'), notify, logger, undetFile, horizonMs)
    return { state: 'inconsistent', code: probe.code }
  }
  // 取到任何**确定结论**(绿 / 真漂移)⇒ 清掉"取不到"的起点:不得拿上一场争用的账续命。
  clearUndeterminedStreak(undetFile)
  return { state: 'clean', counts: c }
}

/** 派生那把尺子的唯一出口(可被测试整层替换):只读、带超时、不带控制台窗(§5b / 守门 52·80)。 */
function runEnvDriftProbe() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-env-drift.mjs')
  if (!existsSync(script)) return { missing: true, code: 2, stdout: '' }
  try {
    const stdout = String(
      execFileSync(process.execPath, [script, '--check', '--json'], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout: 60000, // 守门 80:热路径派生一律带上限,挂死不拖垮整轮巡检
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || '',
    )
    return { code: 0, stdout }
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || '') }
  }
}

/**
 * 告警正文的唯一拼装处。**只写键名与所用对照面的文件名/mtime**,一个值都不写(§5d)。
 * 数字会被 alertFingerprint 归一为 '#',所以同一次清空在多轮 tick 里同指纹(4h 窗口压住重复),
 * 而"又漂了一个新键"是指纹变化 ⇒ 立即重报,不会被上一条同因告警挡住。
 */
function envDriftDetail(parsed, kindLabel) {
  const lines = [
    `判定面:${parsed.face || '磁盘运行态'}`,
    `备份目录:${parsed.backupDir || '(未知)'}`,
  ]
  for (const v of parsed.verdicts || []) {
    if (v.state === 'drift') {
      const b = v.backup
        ? `对照=${v.backup.name}@${new Date(v.backup.mtimeMs).toISOString()}`
        : '对照=(无)'
      lines.push(
        `[漂移] ${v.id}(${b})\n  ${v.drift.map((d) => `${d.key}=${d.kind === 'missing' ? '整键缺失' : '值为空'}`).join('、')}`,
      )
    } else if (v.state === 'undetermined') {
      lines.push(`[未判定] ${v.id} —— ${v.reason};现文件:${v.currentPath}`)
    } else if (v.state === 'registered-only') {
      lines.push(`[登记不判] ${v.id} —— ${v.reason}`)
    }
  }
  const c = parsed.counts || {}
  return (
    `${kindLabel}:受管 .env 的目标 ${c.targets ?? 0} 个中,漂移 ${c.drift ?? 0} 个(键合计 ${c.driftKeys ?? 0})、` +
    `未判定 ${c.undetermined ?? 0} 个、登记不判 ${c.registeredOnly ?? 0} 个。\n` +
    `${lines.join('\n')}\n` +
    '这是"键从非空变成空/整键消失"的对账(判机器状态,不判提交内容);本信不含任何凭据值,只列键名。\n' +
    '手动复核:node scripts/check-env-drift.mjs(或 --verbose 追加每个键在备份里的值长度)。'
  )
}

// 〔归档@2026-10-25/门103 C1〕原 20 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l2873-起-20-行
const EGRESS_UNDET_FILE = join(WORKTREE, '.ihui-agent', 'state', 'egress-ip-drift-undetermined-first.json')
const EGRESS_DRIFT_FILE = join(WORKTREE, '.ihui-agent', 'state', 'egress-ip-drift-first.json')
const EGRESS_UNDET_HORIZON_MS = Number(process.env.IHUI_EGRESS_UNDET_HORIZON_MS || 30 * 60 * 1000)

/** 派生那把尺子的唯一出口:只读、带超时、不带控制台窗(§5b / 守门 52·80)。 */
function runEgressProbe() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-egress-ip-drift.mjs')
  if (!existsSync(script)) return { missing: true, code: 2, stdout: '' }
  try {
    const stdout = String(
      execFileSync(process.execPath, [script, '--check', '--json'], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000, // 探测三路公网 endpoint 各 8s 上限 + 富余;挂死不拖垮整轮巡检
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || '',
    )
    return { code: 0, stdout }
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || '') }
  }
}

/** 告警正文唯一拼装处:面/逐源读数/逐行裁决 + 人工出路(EO 控制台改哪一格、端口多少)。 */
export function egressAlertDetail(parsed, kindLabel) {
  const lines = [`判定面:${parsed.face || '本机实时公网探测 vs 台账期望'}`, `台账:${parsed.ledgerPath || '(未知)'}`]
  lines.push(`探测源:${(parsed.sources || []).map((s) => `${s.url} => ${s.ok ? s.ip : `FAIL(${s.why})`}`).join(' | ')}`)
  lines.push(`现测出口 IPv4:${parsed.currentIp || '(未取得)'}`)
  for (const v of parsed.verdicts || []) {
    if (v.state === 'drift')
      lines.push(`[漂移] ${v.face}:期望 ${v.expectedIPv4}:${v.port ?? '?'} ⇒ 现测 ${parsed.currentIp}。人工出路:腾讯云 EdgeOne 控制台 → 站点 ${v.face} → 源站配置,把源站 IP 改为 ${parsed.currentIp}(端口 ${v.port ?? 8801});归属:${v.owner || '(未登记)'}`)
    else if (v.state === 'unjudged') lines.push(`[未判定] ${v.face} —— ${v.reason}`)
    else if (v.state === 'registered') lines.push(`[登记不判] ${v.face} —— ${v.reason}`)
  }
  return (
    `${kindLabel}:EdgeOne 源站直填的是**家宽动态公网 IPv4**,漂了不自动修(本机无 EO API 凭据,实测),这封信就是那格眼睛。\n` +
    `${lines.join('\n')}\n` +
    '手动复核:node scripts/check-egress-ip-drift.mjs(结论行 PROBE-RESULT 恒纯 ASCII;curl 复现须 --noproxy \'*\' 强制 IPv4)。'
  )
}

export function auditEgressIpDrift(opts = {}) {
  const {
    notify = notifyGuardRed,
    run = runEgressProbe,
    logger = log,
    now = Date.now(),
    undetFile = EGRESS_UNDET_FILE,
    driftFile = EGRESS_DRIFT_FILE,
    horizonMs = EGRESS_UNDET_HORIZON_MS,
  } = opts
  const probe = run()
  if (probe.missing) {
    logger('⚠️ 出口 IP 漂移巡检没装车:scripts/check-egress-ip-drift.mjs 不在这台机上 ⇒ 这一格当前无人看守')
    notify(
      '出口 IP 漂移巡检没装车(尺子文件不在这台机上)',
      'check-egress-ip-drift.mjs 不存在或被删 ⇒ EdgeOne 源站直填的家宽动态 IP 无人看守,而账面看起来"什么都没发生"。',
      { dedupKey: 'egress-undet;not-installed' },
    )
    return { state: 'not-installed' }
  }
  let parsed = null
  try {
    parsed = JSON.parse(probe.stdout)
  } catch {
    parsed = null
  }
  if (!parsed || !['ok', 'drift', 'unjudged'].includes(parsed.state)) {
    notifyEnvUndetermined(
      '出口 IP 巡检不可判定(尺子输出不是可解析 JSON 或状态越界)',
      `派生 exit ${probe.code};stdout 前 300 字符:${String(probe.stdout || '').slice(0, 300)}\n手动:node scripts/check-egress-ip-drift.mjs`,
      notify,
      logger,
      undetFile,
      horizonMs,
      'egress-undet',
    )
    return { state: 'unreadable', code: probe.code }
  }
  if (parsed.state === 'drift') {
    const faces = (parsed.verdicts || []).filter((v) => v.state === 'drift').map((v) => v.face).sort().join('+') || 'na'
    // 起始形状钉 face 集合(同 deploy-stall 型②):事件中途又漂一枚面会进正文,但不另开身份刷屏
    const { firstMs, heldMs } = noteUndeterminedStreak(driftFile, now, { faces })
    const held = alertHeldTier(firstMs, now)
    logger(`❌ 公网出口 IP 与 EdgeOne 源站期望不一致(drift):${faces}(已持续 ${Math.round(heldMs / 60000)} 分钟,持续档=${held.tier})`)
    notify('公网出口 IP 与 EdgeOne 源站期望不一致(全公网链路正在或即将 5xx)', `${egressAlertDetail(parsed, '漂移')}\n已持续 ${Math.round(heldMs / 60000)} 分钟;持续档=${held.tier}(跨 6h/24h/72h 档即新身份重报)。`, {
      severity: 'critical',
      dedupKey: `egress-drift;faces=${faces};tier=${held.tier}`,
    })
    clearUndeterminedStreak(undetFile)
    return { state: 'drift', faces, tier: held.tier }
  }
  if (parsed.state === 'unjudged') {
    logger('❓ 出口 IP 巡检未判定(探测源交叉不足或台账不可读/过期),不记为通过')
    notifyEnvUndetermined('出口 IP 巡检未判定(公网探测交叉不足或台账不可读)', egressAlertDetail(parsed, '未判定'), notify, logger, undetFile, horizonMs, 'egress-undet')
    return { state: 'undetermined' }
  }
  clearUndeterminedStreak(driftFile)
  clearUndeterminedStreak(undetFile)
  return { state: 'clean' }
}

/**
 * 生产签出外来工作巡检已外置至 scripts/git-guardian-prod-foreign.mjs
 * (2026-10-21 拆分:本文件加完巡检后 6088 行 > 守门 [103] C1 上限 6000;判据语义零改动,
 * 只换文件归属。挂点仍在本文件 main()/startDaemon() 两处 !CHECK_ONLY 分支。)
 */

/**
 * 追加型运行日志的保留期回收(机制对标 ZCode desktop 的 logRetention:双上限 + 稳定窗 + 留痕)。
 *
 * 实测动因:`.ihui-agent/state/hook-logs/pre-commit.log` 现读 93,344,342 B、`.ihui-agent/state/git-guardian.log`
 * 13,610,246 B,两处都只有追加没有死亡;全仓此前只有 `deploy/win/ihui-deploy-loop.ps1` 一处轮转
 * (53MB 事故后加的),即"同类日志各自腐烂"。
 *
 * 挂点必须在**健康轮次的早退之前、且带 !CHECK_ONLY** —— 与 healWorktreeTracked / healRootSeal
 * 同一格(本文件已两次踩过"挂进 CHECK_ONLY 路径等于永不执行")。
 * 为什么不在钩子内自己滚:钩子日志是 `hook-run-hidden.vbs` 用 `cmd … >> log` 打开句柄后才启动
 * node 的,node 改名自己正被追加的文件必撞 Windows 共享冲突;巡检撞上了也只是本轮跳过。
 */
function rotateRunLogs() {
  const targets = [LOG, join(WORKTREE, '.ihui-agent', 'state', 'hook-logs', 'pre-commit.log')]
  const hookDir = join(WORKTREE, '.ihui-agent', 'state', 'hook-logs')
  try {
    for (const n of readdirSync(hookDir)) {
      if (!n.endsWith('.log')) continue
      const p = join(hookDir, n)
      if (!targets.includes(p)) targets.push(p)
    }
  } catch {
    // 目录不存在 = 还没人写过,不是故障;如实喊一行,免得"没清"和"清完了"长得一样。
    log('ℹ️ 运行日志回收:未找到 hook-logs 目录,本轮跳过')
  }
  let touched = 0
  for (const p of targets) {
    const r = rotateAppendLog(p)
    if (r.rotated) {
      touched += 1
      log(`✅ 运行日志回收:已归档 ${basename(p)} → ${basename(String(r.movedTo))}${r.removed.length ? ` / 删最旧 ${r.removed.length} 份` : ''}`)
    }
    if (r.failed) {
      // 失败必须响:静默失败的表现永远是"看起来只是没到量"
      log(`⚠️ 运行日志回收失败:${r.path} —— ${r.failed}`)
    }
  }
  if (touched === 0) return
  log(`ℹ️ 运行日志回收本轮动了 ${touched} 个文件(其余按尺寸/稳定窗判定为无需动作)`)
}

function healRootSeal() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'seal-c-root-stray.mjs')
  if (!existsSync(script)) return
  const call = (args) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout: 120000, // 守门 80:热路径派生一律带上限,挂死不拖垮整轮巡检
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return { code: 0, out: String(out || '') }
    } catch (e) {
      return { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout || '') }
    }
  }
  const first = call(['--check'])
  if (first.code === 0) return
  if (first.code !== 1) {
    log(`盘根封口体检异常(忽略,不阻断其余守护):exit ${first.code}`)
    return
  }
  const applied = call(['--apply'])
  const resealed = (applied.out.match(/\[(?:MISSING|REAL-DIR)→sealed\]/g) || []).length
  if (resealed) log(`✅ 盘根封口自愈:重封 ${resealed} 个被外部删除/回退的改道点`)
  const after = call(['--check'])
  if (after.code !== 0)
    log(`⚠️ 盘根封口重封后体检仍非 0(exit ${after.code})⇒ 需人工看 seal-c-root-stray 输出`)
}

/**
 * 看门人的看守(2026-09-23 立)。凭据/部署停摆巡检靠 schtasks 每 6 小时自跑,而它的故障
 * 形态是**安静**:任务被删/被停、node 路径失效、计划任务账户看不到代理 —— 任何一种都会让
 * "本该报警的那条链"静默消失,与今天"生产冻结两天无人知"同构。本守护每 2 分钟一趟且自身
 * 分层自愈,由它盯心跳是成本最低的闭环。
 * 心跳 = 巡检 --json 模式写的 .ihui-agent/state/credential-health-last.json(内含 ts)。
 * 超时(18h = 标称周期 3 倍,避开机器休眠/夜间空档误报)时:① 重跑 --install 找回任务
 * (脚本自带"注册前用 cscript 实跑一次 vbs 预检"的护栏),② 就地拉起一轮(它会自己走
 * 邮件单通道告警)。kick 标记落盘做 6h 冷却,避免每 2 分钟重复拉起。
 */
const WATCHDOG_HEARTBEAT = join(WORKTREE, '.ihui-agent', 'state', 'credential-health-last.json')
const WATCHDOG_KICK = join(WORKTREE, '.ihui-agent', 'state', 'credential-health-kick.ts')
const WATCHDOG_STALL_MS = 18 * 3600 * 1000
const WATCHDOG_KICK_COOLDOWN_MS = 6 * 3600 * 1000

function watchWatchdog() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-credential-health.mjs')
  if (!existsSync(script)) return
  try {
    let ageMs = Infinity
    if (existsSync(WATCHDOG_HEARTBEAT)) {
      try {
        const ts = JSON.parse(readFileSync(WATCHDOG_HEARTBEAT, 'utf8')).ts
        const t = Date.parse(ts)
        if (Number.isFinite(t)) ageMs = Date.now() - t
      } catch {
        /* 心跳内容不可解析 ⇒ 等同丢失,走自愈 */
      }
    }
    if (ageMs < WATCHDOG_STALL_MS) return
    if (existsSync(WATCHDOG_KICK)) {
      const k = Date.parse(String(readFileSync(WATCHDOG_KICK, 'utf8')).trim())
      if (Number.isFinite(k) && Date.now() - k < WATCHDOG_KICK_COOLDOWN_MS) return
    }
    mkdirSync(join(WORKTREE, '.ihui-agent', 'state'), { recursive: true })
    writeFileSync(WATCHDOG_KICK, new Date().toISOString(), 'utf8')
    log(
      `⚠️ 凭据/停摆巡检心跳已 ${(ageMs / 3600000).toFixed(1)} 小时未更新(任务被删/停用或 node 路径失效都会是这个形态)⇒ 重注册任务 + 就地拉起一轮`,
    )
    execFileSync(process.execPath, [script, '--install'], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: WORKTREE,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
    execFileSync(process.execPath, [script, '--json'], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: WORKTREE,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 1 << 22,
    })
  } catch (e) {
    log('巡检自愈失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
  }
}

// 〔归档@2026-10-25/门103 C1〕原 18 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l3136-起-18-行
const PATROL_HEARTBEAT = join(WORKTREE, '.ihui-agent', 'state', 'ops-patrol-last.json')
const PATROL_KICK = join(WORKTREE, '.ihui-agent', 'state', 'ops-patrol-kick.ts')
// 阈值在**函数内**按 `OPS_PATROL_INTERVAL_MS` 惰性求值:那个常量定义在本文件更下方(派发点那一节),
// 在模块顶层这里直接引用会踩 TDZ(`Cannot access before initialization`)—— 实测导入即崩。
const PATROL_STALL_FACTOR = 3
const PATROL_KICK_COOLDOWN_MS = 6 * 3600 * 1000

export function watchPatrolHeartbeat(opts = {}) {
  const {
    now = Date.now(),
    heartbeatFile = PATROL_HEARTBEAT,
    kickFile = PATROL_KICK,
    stallMs = OPS_PATROL_INTERVAL_MS * PATROL_STALL_FACTOR,
    cooldownMs = PATROL_KICK_COOLDOWN_MS,
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-ops-patrol.mjs')
  if (!existsSync(script)) return { ok: false, why: '尺子脚本不在位' }
  if (!existsSync(heartbeatFile)) {
    logger('ℹ️ 巡检心跳消费者:还没有 ops-patrol-last.json(尚未跑过第一轮)⇒ 未判定,不喊人')
    return { ok: false, why: '心跳未生成' }
  }
  let atRaw
  try {
    atRaw = JSON.parse(readFileSync(heartbeatFile, 'utf8'))?.at
  } catch (e) {
    logger(`ℹ️ 巡检心跳消费者:心跳内容不可解析(${String(e?.message || e).slice(0, 60)})⇒ 未判定,不喊人`)
    return { ok: false, why: '心跳不可解析' }
  }
  const at = Date.parse(String(atRaw ?? ''))
  if (!Number.isFinite(at)) {
    logger(`ℹ️ 巡检心跳消费者:心跳里没有可解析的 at(${String(atRaw).slice(0, 40)})⇒ 未判定,不喊人`)
    return { ok: false, why: 'at 不可解析' }
  }
  const ageMs = now - at
  if (ageMs < stallMs) return { ok: true, ageMs }
  if (existsSync(kickFile)) {
    const k = Date.parse(String(readFileSync(kickFile, 'utf8')).trim())
    if (Number.isFinite(k) && now - k < cooldownMs)
      return { ok: false, why: '冷却窗口内,已起跳过', ageMs }
  }
  try {
    mkdirSync(dirname(kickFile), { recursive: true })
    writeFileSync(kickFile, new Date(now).toISOString(), 'utf8')
    logger(
      `⚠️ 元运维巡检心跳已 ${(ageMs / 3600000).toFixed(1)} 小时未更新(派发周期 ${(OPS_PATROL_INTERVAL_MS / 60000).toFixed(0)} 分钟,阈值 ${(stallMs / 60000).toFixed(0)} 分钟)⇒ 调度器可能瞎了,就地起跳一轮`,
    )
    const call =
      runner ??
      ((args) =>
        execFileSync(process.execPath, [script, ...args], {
          // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: WORKTREE,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 300000,
          maxBuffer: 1 << 22,
        }))
    call(['--json'])
    logger('✅ 巡检心跳消费者:已起跳一轮(结果由该轮自身按尺度决定是否报红)')
    return { ok: true, kicked: true, ageMs }
  } catch (e) {
    logger('巡检心跳自愈失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ok: false, why: '起跳失败', ageMs }
  }
}

/**
 * 公网路径与换流窗口的**常驻**探测派发点(台账票 G-301;尺子本体 = `scripts/check-public-path-probe.mjs`)。
 *
 * 为什么挂在这里而不是新建计划任务:该机有明令"注册计划任务属影响全机的自动动作,须机主授权",
 * 而本守护已经是全部运维告警的派发点(每 2 分钟一趟、自身分层自愈、已升 S4U)。
 * 挂点语义与 healWorktreeTracked / watchWatchdog 同一条:**健康轮次的早退之前 + `!CHECK_ONLY`** ——
 * 挂进 CHECK_ONLY 分支等于永不执行(本文件已两次踩过,见上方注释)。
 *
 * 三条不可漂的写法:
 *  ① **节流而非封量**:两次真实探测之间隔 `PUBLIC_PROBE_INTERVAL_MS`(默认 30 分钟),
 *     这是"别每 2 分钟打一次公网"的**节奏**控制,**不是**每日封顶 —— §5e 写死了
 *     "第三方额度是别人的配额,自设上限等于把告警静默再复制一遍"。
 *  ② 告警一律经 `notifyGuardRed()`:按 alert 身份 + 内容指纹去重、失败写 UNDELIVERED 标记、
 *     **不在此文件自拼 SMTP/Resend**(守门 81 硬拦的就是这个)。
 *  ③ 判"未判定"与"没跑到"**不得静默**:尺子 exit 3 或 JSON 取不到时只写日志、不发信 ——
 *     发一封"我什么都没量到"的邮件是把噪音冒充成告警;但日志必须点名原因,不得沉默。
 */
const PUBLIC_PROBE_TICK = join(WORKTREE, '.ihui-agent', 'state', 'public-path-probe-tick.ts')
const PUBLIC_PROBE_LAST = join(WORKTREE, '.ihui-agent', 'state', 'public-path-probe-last.json')
const PUBLIC_PROBE_INTERVAL_MS = Number(process.env.IHUI_PUBLIC_PROBE_INTERVAL_MS || 30 * 60 * 1000)
/** 尺子最坏墙钟:90 次公网 × 上限 15s 的极端不可能全中,但一次守护不能被网络拖死 ⇒ 硬超时 */
const PUBLIC_PROBE_TIMEOUT_MS = Number(process.env.IHUI_PUBLIC_PROBE_TIMEOUT_MS || 240_000)
/** 持续性门槛的状态件:按身份记"同一结论连了几轮" */
const PUBLIC_PROBE_STREAK_FILE = join(WORKTREE, '.ihui-agent', 'state', 'public-path-probe-streak.json')
/**
 * 同一身份连续第几轮越阈才到人。**默认 2 = 最长约 30 分钟**(一轮节流 30 分钟)。
 * 这个数不是拍的:2026-10-16 现读的健康轮里,公网 10 次采样已出现 1 条 9971ms(慢样本率正好
 * 压在 10% 这条线上),而同轮本地对照组 9–47ms ⇒ 单轮尖峰既不足以判"持续故障",又足以寄一封
 * 收信人下不了手的信(§5e-1)。设 0/1 = 恢复"越阈即寄"的老语义。
 */
const PUBLIC_PROBE_STREAK_REQUIRED = Number(process.env.IHUI_PUBLIC_PROBE_STREAK || 2)
/** 身份本轮没再出现(改名/换段/不再越阈)时,streak 条目超过这个年龄即回收 —— 工作队列必须有死亡机制 */
const PUBLIC_PROBE_STREAK_TTL_MS = Number(process.env.IHUI_PUBLIC_PROBE_STREAK_TTL_MS || 24 * 60 * 60 * 1000)
/**
 * 元运维巡检节流:尺子要开 PowerShell 问服务/任务/时钟,还要走一遍 Temp(4.8 万条目),
 * 2 分钟一轮太贵、每天一轮又兜不住"环停了 3 小时"这一型 ⇒ 15 分钟。
 * 两个执行体(2 分钟计划任务 + 常驻 daemon)**共用这一个戳**,谁先到谁干活。
 */
const OPS_PATROL_TICK = join(WORKTREE, '.ihui-agent', 'state', 'ops-patrol-tick.ts')
const SERVICE_HEAL_INTERVAL_MS = Number(process.env.IHUI_SERVICE_HEAL_INTERVAL_MS || 30 * 60 * 1000)

/**
 * 工作区写索引动作的节流(2026-10-04 复核补)。
 *
 * 成因:守护自己的 `healWorktreeTracked()` **每轮都跑**,而收敛对齐的自愈
 * (`healConvergeAlignStall → git-sync-converge.mjs --align-only → heal-worktree-tracked
 * .mjs --align-drift --json`)在同一轮 tick 里排在它之后 —— 两者写同一个索引、跑同一个
 * 脚本(实测派发参数相同)。无节流时一轮跑两遍写索引动作:抢 index.lock(heal-worktree-tracked
 * 虽对锁有让路逻辑,但让路只保证不硬拼,不保证不浪费)+ 白白多花一次 40–51 秒。
 *
 * 两侧共用这一个戳(读也写),少任何一边都等于半拉:只写不读 = 永远不跳;只读不写 = 永远跳。
 * 取值 5 分钟:对齐器本机实测 40–51 秒,5 分钟足够隔开两次真动作,又不会让"工作区被删"
 * (§12d 静默回滚温床)迟迟不修。env 可调。
 */
const WORKTREE_HEAL_INTERVAL_MS = Number(process.env.IHUI_WORKTREE_HEAL_INTERVAL_MS || 5 * 60 * 1000)
const WORKTREE_ALIGN_TICK = join(WORKTREE, '.ihui-agent', 'state', 'worktree-align-tick')
const SERVICE_HEAL_TIMEOUT_MS = Number(process.env.IHUI_SERVICE_HEAL_TIMEOUT_MS || 420_000)

// 〔归档@2026-10-25/门103 C1〕原 24 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l3281-起-24-行
export function healUnresponsiveServices(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = SERVICE_HEAL_INTERVAL_MS,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'service-heal-tick.iso'),
    cappedFile = join(WORKTREE, '.ihui-agent', 'state', 'service-heal-capped-first.json'),
    offlistFile = join(WORKTREE, '.ihui-agent', 'state', 'service-offlist-down-first.json'),
    blindFile = join(WORKTREE, '.ihui-agent', 'state', 'service-heal-blind-first.json'),
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'heal-unresponsive-services.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 服务自愈:动作器不在位(scripts/heal-unresponsive-services.mjs)⇒ 本轮跳过,不记为已巡检')
    return { ran: false, why: '动作器不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!publicProbeDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      runner ||
      (() => {
        try {
          const stdout = execFileSync(process.execPath, [script, '--json', '--apply'], {
            cwd: WORKTREE,
            windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
            timeout: SERVICE_HEAL_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
            maxBuffer: 1 << 22,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
          })
          return { status: 0, stdout: String(stdout || ''), stderr: '' }
        } catch (e) {
          return { status: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || '') }
        }
      })
    const r = call()
    let parsed = null
    try {
      parsed = JSON.parse(String(r.stdout || ''))
    } catch {
      /* 落到下面的未判定分支 */
    }
    if (!parsed || !parsed.counts) {
      logger(`⚠️ 服务自愈未拿到可解析结论(rc=${r.status}):${([r.stderr, r.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').split(/\r?\n/).slice(0, 2).join(' | ')}`)
      return { ran: true, ok: false, why: '结论不可解析' }
    }
    const c = parsed.counts
    const acted = (parsed.results || []).filter((x) => String(x.kind).startsWith('restarted'))
    const failed = (parsed.results || []).filter((x) => x.kind === 'restart-failed')
    if (acted.length > 0 || failed.length > 0) {
      const body = [...acted, ...failed].map((x) => `· ${x.name} ${x.kind} — ${x.why}`).join('\n')
      notify(
        // 名字里不许带计数(型③,同元运维巡检那一格):原先每轮拉起/失败台数一变就是新身份,
        // 4 小时窗口形同虚设。计数进正文,身份里只留档位与服务名集合。
        '服务自愈动作',
        `本轮拉起 ${acted.length} 台 / 失败 ${failed.length} 台(实时计数只进正文,不进身份):\n${body}\n\n在册 ${c.checked ?? '?'} 台:应答 ${c.answering ?? '?'} / 未判定 ${c.undetermined ?? '?'} / 观察 ${c.watch ?? '?'} / 冷却 ${c.cooldown ?? '?'} / 窗口封顶 ${c.capped ?? '?'}\n手动复现:node scripts/heal-unresponsive-services.mjs(只读)`,
        // 2026-10-04 复核补:原写 `{ alertName: … }`,而 notifyGuardRed 的 opts 解构里
        // **没有 alertName 这个键**(见其签名:severity/now/dispatch/stateFile/undFile/
        // windowMs/failCooldownMs/dedupKey/force/logger)⇒ 该值被**静默丢弃**,这一格
        // 实际只吃了默认的内容指纹去重。症状:同一个"服务 A 重启失败"与"服务 B 重启失败"
        // 归成同一身份,B 恢复了 A 还在失败时,B 的新事实被压成旧指纹不重报。
        // 改传 dedupKey(那才是真正被消费的字段),身份取"哪些服务"集合、有序无关。
        { dedupKey: `service-heal;svcs=${[...acted, ...failed].map((x) => x.name).sort().join('+') || 'fail'};acted=${alertCountTier(acted.length)};failed=${alertCountTier(failed.length)}` },
      )
    }
    // 〔归档@2026-10-25/门103 C1〕原 18 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l3379-起-18-行
    const alertTerminalHeld = ({ list, kind, file, titleFor, intro, steps, firstAlertAfterMs = 0 }) => {
      if (list.length === 0) {
        // 终态必须会清:恢复应答、不再封顶、或重新量到了,都把起点摘掉,
        // 否则下一次真故障会被算成"已经拖了很久"。
        clearUndeterminedStreak(file)
        // `n` 与 `mailed` 必须分开报:只返回"寄没寄"会把"有事但没到门槛"和"没事"读成同一件事
        // —— 那正是本仓最贵的假绿(§0.3),而这一格本身就是为"安静"而设计的。
        return { n: 0, mailed: 0 }
      }
      const names = [...new Set(list.map((x) => x.name))].sort().join(' / ')
      const streak = noteUndeterminedStreak(file, now, { firstServices: names })
      const held = alertHeldTier(streak.firstMs, now)
      if (firstAlertAfterMs > 0 && now - streak.firstMs < firstAlertAfterMs) {
        // 未到门槛只报名,但**报名必须留痕**:静默 return 与"根本没判"在读数上同形(§0.3)。
        logger(`ℹ️ 服务自愈:${kind} 累计 ${names} 已持续 ${Math.round((now - streak.firstMs) / 60_000)} 分钟,未到人门槛 ${Math.round(firstAlertAfterMs / 60_000)} 分钟 ⇒ 本轮只报名,不寄信`)
        return { n: list.length, mailed: 0 }
      }
      const detail = list.map((x) => `· ${x.name} — ${x.why || '(动作器未给原因)'}`).join('\n')
      notify(
        // 标题与身份里都只放"哪几台 + 档",台数/时刻/原始读数一律进正文(型③、§5e-3、门 224)。
        titleFor(names),
        `${intro}\n` +
          `本轮明细:\n${detail}\n` +
          `起点 ${new Date(streak.firstMs).toISOString()}(已钉为这一段的最初时刻,后续轮次不覆盖);已持续 ${held.hours ?? '?'} 小时(档 ${held.tier}:6h/24h/72h 跨档即新身份 ⇒ 越拖越响,不会被压成静音)\n` +
          `按序判:\n${steps}\n` +
          `在册 ${c.checked ?? '?'} 台:应答 ${c.answering ?? '?'} / 未判定 ${c.undetermined ?? '?'} / 冷却 ${c.cooldown ?? '?'} / 窗口封顶 ${c.capped ?? '?'} / 名单外故障 ${c.offlist ?? '?'}(未登记 ${c.offlistUnregistered ?? 0} / 豁免到期 ${c.offlistAckExpired ?? 0})`,
        { severity: 'critical', dedupKey: `${kind};svcs=${names};held=${held.tier}` },
      )
      return { n: list.length, mailed: 1 }
    }
    // 取的是 **`parsed.actions` 不是 `parsed.results`**:动作器把逐台决策写在 actions,
    // results 里只有"真动过手"的三档(restart-failed / restarted-recovered / restarted-unverified)。
    // 照上面那两个过滤器抄 `results` 会**恒为空**——一把永远不响的铃,比原来更坏。
    const healActions = parsed.actions || []
    const capped = alertTerminalHeld({
      list: healActions.filter((x) => x.kind === 'window-capped'),
      kind: 'service-heal-capped',
      file: cappedFile,
      titleFor: (names) => `服务自愈重启预算用完:${names} 仍无应答(这是启动即崩,不是没起)`,
      intro: '自愈已按窗口上限拉起过仍无应答 ⇒ **"重启"这一维已被排除**,问题在进程自己起不来。',
      steps:
        `  ① 读该机启动日志找抛错(nssm 的 stdout 是 UTF-16):D:\\DevEnv\\logs\\svc-<机名小写>-nssm*.log\n` +
        `  ② 若属启动期抛错(Fastify 路由重复声明 / 缺 env / 插件注册失败)—— **部署环不会自愈**:它的回滚只恢复 web 构建产物,既不回退 api 源码也不重启 api,所以会一直"构建→门禁 api=fail→回滚"活锁(2026-10-21 实测 45 分钟)。\n` +
        `  ③ 出路只有向前修 main:等生产签出前移到含修复的 commit(git -C <生产签出> merge-base --is-ancestor <修复枚> HEAD),再 nssm restart <服务名>。\n` +
        `  ④ 只读复现本判定:node scripts/heal-unresponsive-services.mjs --json`,
    })
    // 名单外故障三档各有各的出路(动作器把 `ackState` 逐台给出来,派发侧不重算台账形态):
    // 未登记 ⇒ 补登记;豁免到期 ⇒ 重新裁定;已登记 ⇒ 按登记的处置。方向恒为**多喊一次**(§0.10)。
    const offDown = alertTerminalHeld({
      list: healActions.filter((x) => x.kind === 'not-in-list'),
      kind: 'service-offlist-down',
      file: offlistFile,
      titleFor: (names) => `服务已停但按台账不得自动重启:${names}(这型自愈不会动,只能交人)`,
      intro: '这台落在自愈白名单**之外** ⇒ "重启它"不是本层的授权动作,而台账对它的原话是"只喊人"。',
      steps:
        `  ① 先分清楚是哪一档:正文每台都带了 ackState —— 已登记排除 / 复核日已过 / 压根没登记。\n` +
        `  ② 只读复现并看全表:node scripts/heal-unresponsive-services.mjs --json(判据一律取门 153,本层不再量一遍)。\n` +
        `  ③ 要它进自动重启名单 ⇒ 在 scripts/data/service-auto-restart.json 的 services 里登记四件(name/reason/owner/reviewBy);\n` +
        `     要它继续"只喊人" ⇒ 在 excluded 里补一行**单台**的排除(一行只许一台、必须带 reason 与可解析 reviewBy,否则不构成豁免)。\n` +
        `  ④ 若这台已经不再需要(实测 IHUI-OLLAMA 的 Application 指向一个不存在的 exe)⇒ 把服务本身摘掉,而不是让它留在表里天天喊。`,
    })
    // 第三个入口:**量不到**。一轮未判定只报名(§0.3 —— 把"没判"当坏了,等于让一把量不到的尺子
    // 获得发信权);但白名单服务连续 6 小时量不到,事故对象是**看守层自己**(门 153 派生不起来、
    // 应答维取不到、台账复核日过了把整台降级),这一型原先只写日志,而写日志没有人看。
    // 判据仍是那一把尺子给的 `kind`,派发侧不自立第二档门槛:6h = `alertHeldTier` 的第一条档界。
    const blind = alertTerminalHeld({
      list: healActions.filter((x) => x.kind === 'undetermined'),
      kind: 'service-heal-blind',
      file: blindFile,
      firstAlertAfterMs: 6 * 3_600_000,
      titleFor: (names) => `服务自愈连续六小时量不到这几台:${names}(本层没判出它是好是坏,报的是看守层瞎了)`,
      intro: '本层**没有判定这几台的好坏** —— 它连"是否 RUNNING / 是否应答"都没读到。这不是"都没事"。',
      steps:
        `  ① 先分清两种"量不到":门 153 自己派生不起来(rc≥2 / ENOENT / 被信号终止),还是这台服务确实取不到值。\n` +
        `  ② 只读复现:node scripts/check-service-binary-paths.mjs --json(看 totals 与这台服务的 blind/hardBlind 各自点名了什么)。\n` +
        `  ③ 若这台是任务型无端口 ⇒ 它不该待在自动重启白名单里,移到 scripts/data/service-auto-restart.json 的 excluded(带 reason 与 reviewBy)。\n` +
        `  ④ 若是台账复核日已过 ⇒ 过期只挡那一条不挡整轮,把 reviewBy 重新拍一个日期即恢复动作权。`,
    })
    if (c.undetermined > 0 || c.planned > 0) {
      logger(`ℹ️ 服务自愈:未判定 ${c.undetermined ?? 0} 台 / 计划未执行 ${c.planned ?? 0} 台(只读档才会留在"计划";单轮未判定不喊人,连续 6 小时才喊 ⇒ 见 service-heal-blind 那一格)`)
    }
    logger(`✅ 服务自愈:在册 ${c.checked ?? 0} 台,应答 ${c.answering ?? 0},拉起 ${acted.length},失败 ${failed.length},封顶 ${capped.n},名单外故障 ${offDown.n},量不到 ${blind.n}${blind.n > 0 && blind.mailed === 0 ? '(未达 6 小时门槛,本轮只报名)' : ''}`)
    return {
      ran: true,
      ok: failed.length === 0,
      checked: c.checked,
      acted: acted.length,
      failed: failed.length,
      capped: capped.n,
      offDown: offDown.n,
      blind: blind.n,
      blindMailed: blind.mailed,
      undetermined: c.undetermined ?? 0,
    }
  } catch (e) {
    logger(`⚠️ 服务自愈异常:${String(e?.message || e).slice(0, 200)}`)
    return { ran: true, ok: false, why: String(e?.message || e) }
  }
}

const OPS_PATROL_INTERVAL_MS = Number(process.env.IHUI_OPS_PATROL_INTERVAL_MS || 15 * 60 * 1000)
const OPS_PATROL_TIMEOUT_MS = Number(process.env.IHUI_OPS_PATROL_TIMEOUT_MS || 180_000)
// ── 巡检发信的持续性门槛(2026-10-16 立,与 auditPublicPathProbe 共用 `bumpProbeStreak` 同一份实现)──
// 门槛取 **3 轮 ≈ 45 分钟**,这个数不是拍的,是当天量出来的:P4a(Temp 条目越阈)今天两场风暴
// 各只持续了 2 轮就自己回绿(05:21Z 64,205>60,000、05:36Z 64,289 ⇒ 05:51Z 已绿;07:52Z 又一模一样),
// 而真待修的那一族(备份停摆 63 小时、规则没上岗、副本没出机)一红就是几十轮。
// ⇒ 3 轮掐得掉"下一轮就没了"的尖峰,压不住真故障;单轮/两轮尖峰只逐轮报名(红档与原因照旧每轮打印、
// 每轮落 `.ihui-agent/state/ops-patrol-last.json`),**不发信 ≠ 不留痕**(§5e-1:红了要能答"收信人能做什么")。
const OPS_PATROL_STREAK_FILE = join(WORKTREE, '.ihui-agent', 'state', 'ops-patrol-streak.json')
const OPS_PATROL_STREAK_REQUIRED = Number(process.env.IHUI_OPS_PATROL_STREAK || 3)
const OPS_PATROL_STREAK_TTL_MS = Number(process.env.IHUI_OPS_PATROL_STREAK_TTL_MS || 24 * 60 * 60 * 1000)

/** 节流判定(纯函数):距上次派发是否已够一个间隔。取不到 tick 文件 ⇒ 视为**该跑了**。 */
export function publicProbeDue(nowMs, tickMs, intervalMs = PUBLIC_PROBE_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

// 〔归档@2026-10-25/门103 C1〕原 19 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l3515-起-19-行
export function auditOpsPatrol(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = OPS_PATROL_INTERVAL_MS,
    tickFile = OPS_PATROL_TICK,
    streakFile = OPS_PATROL_STREAK_FILE,
    requiredStreak = OPS_PATROL_STREAK_REQUIRED,
    streakTtlMs = OPS_PATROL_STREAK_TTL_MS,
    minGapMs = Math.floor(OPS_PATROL_INTERVAL_MS / 2),
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-ops-patrol.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 元运维巡检:尺子脚本不在位(scripts/check-ops-patrol.mjs)⇒ 本轮跳过,不记为已巡检')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(lastTick) && now - lastTick < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      runner ||
      (() => {
        try {
          const stdout = execFileSync(process.execPath, [script, '--json', '--apply'], {
            cwd: WORKTREE,
            windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
            timeout: OPS_PATROL_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
            maxBuffer: 1 << 22,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
          })
          return { status: 0, stdout: String(stdout || ''), stderr: '' }
        } catch (e) {
          return { status: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || '') }
        }
      })
    const r = call()
    let parsed = null
    try {
      parsed = JSON.parse(String(r.stdout || ''))
    } catch {
      /* 落到下面的未判定分支 */
    }
    if (!parsed || !parsed.counts) {
      logger(`⚠️ 元运维巡检未拿到可解析结论(rc=${r.status}):${([r.stderr, r.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').split(/\r?\n/).slice(0, 2).join(' | ')}`)
      return { ran: true, ok: false, why: '结论不可解析' }
    }
    const findings = parsed.findings || []
    const undet = parsed.undetermined || []
    if (undet.length) {
      logger(`ℹ️ 元运维巡检:${undet.length} 格未判定(只登记不喊人)—— ${undet.map((x) => x.id).join(', ')}`)
      // 只报格名等于"下一轮还是同一条无名盲区"(§0.3)。原因逐格带上界 120 字符、最多 5 条,
      // 超出部分指回 `.ihui-agent/state/ops-patrol-last.json`(门在 --json 档也会落盘)——
      // 这一格每 15 分钟一轮,不设界就是往守护日志里堆无限账。
      for (const x of undet.slice(0, 5)) logger(`   · 未判定原因 ${x.id}:${String(x.detail || '(门没给原因)').slice(0, 120)}`)
      if (undet.length > 5) logger(`   · 另有 ${undet.length - 5} 格未判定,原因见 .ihui-agent/state/ops-patrol-last.json`)
    }
    // ── 持续性门槛(与公网探测同一份 `bumpProbeStreak`,不写第二份,§22c)──────────────
    // 身份 = 格 id;`ok` 清零、`unjudged` 不推进也不清零、`breach` +1(不足 minGapMs 的重复测量只报名)。
    // 账本读不出的失效方向钉死为**多喊一次**:除"文件本来就不在(第一轮)"外,任何读失败都按门槛 1
    // 立即到人(§0.10:绝不能因为账本坏了就静默)。
    const verdicts = {}
    for (const x of parsed.ok || []) verdicts[x.id] = { verdict: 'ok' }
    for (const x of parsed.adjudicated || []) verdicts[x.id] = { verdict: 'ok' } // 已裁 = 本轮不需要到人
    for (const x of undet) verdicts[x.id] = { verdict: 'unjudged' }
    for (const x of findings) verdicts[x.id] = { verdict: 'breach' }
    let prevStreak = {}
    let effRequired = requiredStreak
    try {
      const parsedStreak = JSON.parse(readFileSync(streakFile, 'utf8'))
      if (parsedStreak && typeof parsedStreak === 'object' && !Array.isArray(parsedStreak)) prevStreak = parsedStreak
      else effRequired = 1
    } catch (e) {
      if (String(e?.code || '') !== 'ENOENT') effRequired = 1
      logger(`ℹ️ 元运维巡检连击账本:${String(e?.code || e?.message || e).slice(0, 60)}${effRequired === 1 && requiredStreak !== 1 ? ' ⇒ 读不出,本轮按"越阈即寄"处理(宁多勿默)' : ''}`)
    }
    const bump = bumpProbeStreak(prevStreak, verdicts, { now, required: effRequired, ttlMs: streakTtlMs, minGapMs })
    for (const c of bump.cleared) logger(`✅ 元运维巡检连击清零:${c.key}(此前连 ${c.from} 轮,本轮已判定合规)`)
    for (const [key, i] of Object.entries(bump.info))
      if (i.merged) logger(`ℹ️ 元运维巡检重复测量(距上轮 ${Math.round(i.gapMs / 1000)}s < 最小间隔 ${Math.round(minGapMs / 1000)}s,两个执行体撞进同一个节流窗口)⇒ 不推进连击:${key} 仍算连 ${i.streak}/${i.required} 轮`)
    for (const p of bump.pruned) logger(`ℹ️ 元运维巡检连击条目回收(${p.reason}):${p.key} 连 ${p.streak} 轮`)
    if (bump.bogus.length) logger(`⚠️ 元运维巡检连击账本里有 ${bump.bogus.length} 条时刻不可信的条目(在未来):${bump.bogus.join(', ')} —— 已回收,且不参与本轮连击`)
    try {
      mkdirSync(dirname(streakFile), { recursive: true })
      writeFileSync(streakFile, JSON.stringify(bump.state, null, 1), 'utf8')
    } catch (e) {
      logger(`⚠️ 元运维巡检连击账本写不进(不改判定,下一轮按"读不出即多喊"处理):${String(e?.code || e?.message || e).slice(0, 60)}`)
    }
    if (findings.length) {
      const body = findings.map((x) => `· ${x.id} ${x.detail}`).join('\n')
      logger(`❌ 元运维巡检判红 ${findings.length} 格:\n${body}`)
      const due = findings.filter((x) => bump.info[x.id] && bump.info[x.id].due === true)
      if (!due.length) {
        // 未达门槛:红档与原因照旧逐轮打印、照旧落盘,只是这一轮不发信。写明"下一轮约多久、几轮到头",
        // 让抑制有可见的终态,而不是一张静音键。
        logger(
          `ℹ️ 元运维巡检判红但未达持续性门槛:${findings.map((x) => `${x.id} 连 ${bump.info[x.id]?.streak ?? 1}/${effRequired} 轮`).join('、')}` +
            ` ⇒ 本轮只报名不寄信(约 ${Math.round(OPS_PATROL_INTERVAL_MS / 60000)} 分钟一轮;同一身份连续 ${effRequired} 轮即到人)`,
        )
      } else {
      notify(
        // 名字里**不许带计数**(型③):原先 `元运维巡检红(N 格)` 每轮红格数一变就是新身份,
        // 实测 09-30~10-05 同一件事寄了 34 封。计数进正文,身份里只留档位。
        '元运维巡检红',
        `本次红 ${findings.length} 格(实时计数只进正文,不进身份):\n${body}\n\n同一身份连续第 ${due.map((x) => `${x.id}=${bump.info[x.id].streak}`).join('、')} 轮越阈(门槛 ${effRequired} 轮,单轮尖峰不寄信)。` +
          `\n手动复现:node scripts/check-ops-patrol.mjs(只读) / --apply(顺手修可修的)` +
          `\n连击账本:.ihui-agent/state/ops-patrol-streak.json;盲区与逐格读数:.ihui-agent/state/ops-patrol-last.json`,
        {
          severity: 'warning',
          // dedupKey(§5e-1 配套,24 封):聚合告警的正文是**逐格 detail 清单**,而每格 detail
          // 都含实时读数(条目数 67595、时钟距今 N 小时)⇒ 指纹逐轮变 ⇒ 窗口失效。
          // 2026-10-19 再收一格:**"哪几格红了"这个集合本身也是会抖的量**。现读 17:49 / 18:05 / 18:35
          // 三封在 46 分钟内,起因是 P4a 与 P5b 里有一格先愈合了 ⇒ 集合从 `P4a+P5b` 变 `P5b`
          // ⇒ 旧窗口作废、当场再寄一封。"好了一半"不是新故障,按 §5e-1 不该重报。
          // 新身份 = 本段**起点**的格集合(钉住,先到先得)× 起点与本轮里**较坏**的那档计数 × 持续档;
          // 只有"起点里没有的新格红了"(`new=`)才会立刻另开身份 —— 那才是真新增的一一个问题。
          // 逐格明细照旧全量进正文(信息量不降),实时读数照旧不进身份。
          dedupKey: (() => {
            const epFile = join(WORKTREE, '.ihui-agent', 'state', 'ops-patrol-episode-first.json')
            const idsArr = findings.map((x) => x.id).sort()
            const ep = noteUndeterminedStreak(epFile, now, { cells: idsArr.join('+'), count: findings.length })
            const pinnedArr = String(ep.meta.cells || idsArr.join('+')).split('+').filter(Boolean)
            const newIds = idsArr.filter((id) => !pinnedArr.includes(id)).sort()
            const tier = alertCountTier(Math.max(Number(ep.meta.count) || 0, findings.length))
            const held = alertHeldTier(ep.firstMs, now)
            return `cells0=${pinnedArr.join('+')};new=${newIds.join('+') || '-'};tier=${tier};held=${held.tier}`
          })(),
        },
      )
      }
    } else {
      // 零红 ⇒ 这一段结束:摘掉起点件,下一场故障从新起点算(不摘会把上一段的时长算到下一头上,
      // 而那是"刚冒头就直接进高档"的成因 —— 与"愈合半格就重寄"是同一枚硬币的两面)。
      clearUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', 'ops-patrol-episode-first.json'))
      logger(`✅ 元运维巡检:${parsed.counts.ok} 格绿,无红(${undet.length} 格未判定)`)
    }
    return { ran: true, ok: true, findings: findings.length, undetermined: undet.length }
  } catch (e) {
    // 派发点自身异常不得改守护退出码(与 auditPublicPathProbe 同一条禁令):巡检失败不等于 .git 失败。
    logger(`⚠️ 元运维巡检派发异常(忽略,不影响本轮自愈):${e?.message || e}`)
    return { ran: true, ok: false, why: String(e?.message || e) }
  }
}

/**
 * 持续性门槛的判据(纯函数,镜像测试直接调它,不在测试里复制第二份判据 §22c)。
 *
 * 一条身份每被量到一次 breach 就 +1;达到门槛才允许到人。三种结论各有各的账,**不得并桶**:
 *   · `breach` ⇒ 连击 +1(同身份同语义才算连着,换了段就是另一件事);**但距上一次 breach 不足
 *              `minGapMs` 的那一轮算"重复测量",只报名不推进** —— 本机守护有两个执行体共用一个
 *              节流戳,"轮"这个单位必须是时间,否则一次尖峰会被 60 秒内的两次采样凑成"连续两轮"
 *              (2026-10-16 13:19/13:20 实测,门槛就是这么被绕过的);
 *   · `ok`     ⇒ 清零并报名"从第几轮断的"(恢复必须是可见的终态,不是悄悄不留痕);
 *   · `unjudged` ⇒ **不推进也不清零**,且**不刷新 lastSeenAt**:本轮没量到有效结论,
 *                  既不能替故障续命,也不能替它收尸(拿不到输入时永远多要一次,绝不少要)。
 * 本轮没出现的旧条目(改名/换段)按 `ttlMs` 回收 —— 台账不能只进不出。
 * @param {{[k:string]:{streak?:number,firstAt?:string,lastSeenAt?:string}}} prev
 * @param {{[k:string]:{verdict?:string}}} results
 * @returns {{state:object, info:object, cleared:{key:string,from:number}[], pruned:{key:string,streak:number,ageAnchor:string|null,lastSeenAt:string|null}[]}}
 */
export function bumpProbeStreak(prev, results, opt = {}) {
  const now = opt.now ?? Date.now()
  const required = Number.isFinite(Number(opt.required)) ? Math.max(0, Number(opt.required)) : 2
  const ttlMs = Number.isFinite(Number(opt.ttlMs)) ? Number(opt.ttlMs) : 24 * 60 * 60 * 1000
  // 两轮之间至少隔这么久才算"又过了一轮"(0 = 关闭这一维)。见函数头注的 2026-10-16 实测。
  const minGapMs = Number.isFinite(Number(opt.minGapMs)) ? Math.max(0, Number(opt.minGapMs)) : 0
  const iso = (t) => new Date(t).toISOString()
  const src = prev && typeof prev === 'object' ? prev : {}
  const state = {}
  const info = {}
  const cleared = []
  // 本轮**被问到过**的身份(不论结论是哪种)。回填只准动"本轮根本没出现"的条目 ——
  // 少了这一维,`ok` 清零会被下面的回填原样复活(测试抓到过这一型:恢复一轮再尖仍然直接到人)。
  const handled = new Set()
  for (const [key, r] of Object.entries(results || {})) {
    const verdict = String((r && r.verdict) || '')
    if (verdict === 'breach' || verdict === 'ok' || verdict === 'unjudged') handled.add(key)
    const before = src[key] && typeof src[key] === 'object' ? src[key] : null
    // **来历不明的账不拿来加连击**:条目的时刻在未来(实测一例:测试夹具把 `now` 固定成 2027 年
    // 又没覆写状态件路径,污染了生产账本)⇒ 按不可信处理,prior 记 0 并点名。否则同身份真越阈的
    // 第一轮会被这条脏数据顶成"第 2 轮"当场放行,持续性门槛等于被绕过。
    const beforeTs = Date.parse(String(before?.lastSeenAt || before?.firstAt || ''))
    const beforeOk = before !== null && !(Number.isFinite(beforeTs) && beforeTs > now)
    const prior = beforeOk && Number.isFinite(Number(before?.streak)) ? Math.max(0, Number(before.streak)) : 0
    if (verdict === 'breach') {
      const prevLast = Date.parse(String(before?.lastSeenAt || ''))
      // **同一节流窗口里的重复测量不推进连击**:守护在这台机上有两个执行体(2 分钟计划任务 +
      // 常驻 daemon)共用一个节流戳,谁先到谁干活,但"读到戳→写戳"之间没有互斥 ⇒ 实测 2026-10-16
      // 13:19 与 13:20 各派了一轮(相隔 60 秒),把"连续 2 轮"凑成了一次尖峰的两倍采样,
      // 门槛被绕过去、又多寄了一封。连击的计量单位必须是**时间**,不是"进过几次这段代码"。
      const dup = prior > 0 && Number.isFinite(prevLast) && now - prevLast < minGapMs
      if (dup) {
        const firstAt = before?.firstAt || iso(prevLast)
        state[key] = { streak: prior, firstAt, lastSeenAt: before?.lastSeenAt || iso(now) }
        // firstAt 必须**同时进 info**:派发侧读的是 info 那一份(它还要读 `required`,而 required
        // 只住在 info 里)⇒ 只写 state 的话 `Date.parse(st.firstAt)` 恒为 NaN,"已持续档"这一维
        // 结构上永不跨档,同因持续恶化会被 24h 窗口压成同一身份不再重报。
        // 契约与反证:scripts/tests/git-guardian-probe-firstat.test.mjs
        info[key] = { streak: prior, required, due: false, merged: true, gapMs: now - prevLast, minGapMs, firstAt }
        continue
      }
      const streak = prior + 1
      const firstAt = before?.firstAt || iso(now)
      state[key] = { streak, firstAt, lastSeenAt: iso(now) }
      info[key] = { streak, required, due: streak >= required, firstAt }
    } else if (verdict === 'ok') {
      if (prior > 0) cleared.push({ key, from: prior })
      info[key] = { streak: 0, required, due: false }
    } else if (verdict === 'unjudged') {
      const firstAt = before?.firstAt || iso(now)
      if (prior > 0) state[key] = { streak: prior, firstAt, lastSeenAt: before?.lastSeenAt || null }
      info[key] = { streak: prior, required, due: false, unjudged: true, firstAt }
    }
  }
  const pruned = []
  const bogus = []
  for (const [key, entry] of Object.entries(src)) {
    if (state[key] || handled.has(key)) continue
    const first = Date.parse(String(entry?.firstAt || ''))
    const last = Date.parse(String(entry?.lastSeenAt || ''))
    // 年龄锚:有 breach 用 firstAt(从第一次红算起),纯 stale 用 lastSeenAt;两个都读不出 ⇒ 直接回收。
    const ageAnchor = Number.isFinite(first) ? first : Number.isFinite(last) ? last : null
    // **时刻在未来 ⇒ 这条账不可信,必须回收并点名**。实测成因:一版测试夹具的 `now` 固定成
    // 2027-01-15,而它没覆写状态件路径就调了生产派发点 ⇒ 真账本里落了一条"未来"条目;
    // `now - ageAnchor` 为负 ⇒ 永远 ≤ ttl ⇒ 这条永生,并且同身份真越阈第一轮就被它顶成 due。
    const inFuture = ageAnchor !== null && ageAnchor > now
    if (!inFuture && ageMsSafe(ageAnchor, now) <= ttlMs) {
      state[key] = entry
      continue
    }
    pruned.push({ key, streak: Number(entry?.streak) || 0, ageAnchor: ageAnchor === null ? null : iso(ageAnchor), lastSeenAt: entry?.lastSeenAt || null, reason: inFuture ? '时刻在未来(不可信)' : '本轮未再出现且超龄' })
    if (inFuture) bogus.push(key)
  }
  return { state, info, cleared, pruned, bogus }
}

/** 年龄(毫秒);锚点读不出 ⇒ Infinity(按"最坏年龄"处理,直接回收而不是留在册上)。 */
function ageMsSafe(anchor, now) {
  return anchor === null ? Infinity : now - anchor
}

export function auditPublicPathProbe(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = PUBLIC_PROBE_INTERVAL_MS,
    tickFile = PUBLIC_PROBE_TICK,
    lastFile = PUBLIC_PROBE_LAST,
    streakFile = PUBLIC_PROBE_STREAK_FILE,
    requiredStreak = PUBLIC_PROBE_STREAK_REQUIRED,
    streakTtlMs = PUBLIC_PROBE_STREAK_TTL_MS,
    minGapMs = Math.floor(PUBLIC_PROBE_INTERVAL_MS / 2),
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-public-path-probe.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 公网路径探测:尺子脚本不在位(scripts/check-public-path-probe.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!publicProbeDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    // 判序(2026-10-03 补修,此前是本仓**唯一没修**的一处同型):`runner || (iife())` 在
    // 传入函数时会让 `call` **等于那个函数本身**(短路掉调用),而不是它的返回值 ——
    // 于是 `readProbeVerdict(call)` 读到 `status=undefined`,恒报「探针未产出 stdout」。
    // 本函数 2751 行的注释早就写明了这个坑并点名「auditPublicPathProbe 此刻就是这一型」,
    // 但只修了同族的 checkBaselineFreshness,这一处漏了;它此前无镜像测试 ⇒ 一直没暴露。
    // 镜像测试补上后立刻撞红(2026-10-03),按同族正确写法改成"显式注入优先调用"。
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--burst', '--sequence', 'both', '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
                timeout: PUBLIC_PROBE_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'],
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return {
                status: typeof e.status === 'number' ? e.status : 2,
                stdout: String(e.stdout || ''),
                stderr: String(e.stderr || e.message || ''),
              }
            }
          })()
    const v = readProbeVerdict(call)
    if (!v.parsed) {
      // 只写日志不发信:没量到 ≠ 出事了(§5e 的"失败必须响"针对的是**投递失败**,不是"没跑")
      logger(`⚠️ 公网路径探测未产出结论(未判定,不记为已探测):${v.why}`)
      return { ran: true, judged: false, why: v.why }
    }
    const results = v.parsed.results && typeof v.parsed.results === 'object' ? v.parsed.results : {}
    // ── 持续性门槛(2026-10-16 立):同一身份要连着几轮越阈才到人,单轮尖峰只报名。
    // 成因现读:健康轮也会出现 1/10 条 ≥8s(慢样本率正好压在 10% 线上),而这类尖峰下一轮就没了
    // —— 为它寄一封信,收信人除了"刚才那一下很慢"什么也做不了(§5e-1 答不上"红了能做什么")。
    // 账本读不出的失效方向钉死为**多喊一次**:除"文件本来就不在(第一轮)"外,任何读失败都按
    // 门槛 1 立即到人(§0.10:绝不能因为账本坏了就静默)。
    let prevStreak = {}
    let effRequired = requiredStreak
    try {
      const parsedStreak = JSON.parse(readFileSync(streakFile, 'utf8'))
      if (parsedStreak && typeof parsedStreak === 'object' && !Array.isArray(parsedStreak)) prevStreak = parsedStreak
      else effRequired = 1
    } catch (e) {
      if (String(e?.code || '') !== 'ENOENT') effRequired = 1
      logger(`ℹ️ 公网探测连击账本:${String(e?.code || e?.message || e).slice(0, 60)}${effRequired === 1 && requiredStreak !== 1 ? ' ⇒ 读不出,本轮按"越阈即寄"处理(宁多勿默)' : ''}`)
    }
    const bump = bumpProbeStreak(prevStreak, results, { now, required: effRequired, ttlMs: streakTtlMs, minGapMs })
    for (const c of bump.cleared) logger(`✅ 公网探测连击清零:${c.key}(此前连 ${c.from} 轮,本轮已判定合规)`)
    for (const [key, i] of Object.entries(bump.info)) if (i.merged) logger(`ℹ️ 公网探测重复测量(距上轮 ${Math.round(i.gapMs / 1000)}s < 最小间隔 ${Math.round(minGapMs / 1000)}s,两个执行体撞进同一个节流窗口)⇒ 不推进连击:${key} 仍算连 ${i.streak}/${i.required} 轮`)
    for (const p of bump.pruned) logger(`ℹ️ 公网探测连击条目回收(${p.reason},距 ${p.ageAnchor || p.lastSeenAt || '不可知'}):${p.key} 连 ${p.streak} 轮`)
    if (bump.bogus.length) logger(`⚠️ 公网探测连击账本里有 ${bump.bogus.length} 条时刻不可信的条目(在未来):${bump.bogus.join(', ')} —— 已回收,且不参与本轮连击;来历通常是夹具或时钟漂移`)
    try {
      mkdirSync(dirname(streakFile), { recursive: true })
      writeFileSync(streakFile, JSON.stringify(bump.state, null, 1), 'utf8')
    } catch (e) {
      logger(`⚠️ 公网探测连击账本写失败(下轮从第一轮重连,不影响本轮结论):${String(e?.message || e).slice(0, 80)}`)
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      const streakView = {}
      for (const [key, r] of Object.entries(results)) streakView[key] = { ...(bump.info[key] || {}), verdict: String(r?.verdict || '') }
      writeFileSync(lastFile, JSON.stringify({ at: new Date(now).toISOString(), rc: v.parsed.rc, requiredStreak: effRequired, streak: streakView, results }, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响 --status 的可见性,不影响告警本身 */
    }
    let breaches = 0
    let unjudged = 0
    for (const [key, r] of Object.entries(results)) {
      const verdict = String(r?.verdict || '')
      const reasons = Array.isArray(r?.reasons) ? r.reasons : []
      if (verdict === 'breach') {
        breaches += 1
        // alert 身份**按序列+目标分开**:A(换流窗口)与 B(常态公网)是两个不同的故障,
        // 合并成一个身份会让先响的那条把后响的那条压掉 —— 正是票面禁止的"互相掩盖"。
        //
        // **B/本地 这一格不得用「公网路径探测」的名义到人(2026-10-03 立,28 封审计)**。
        // 尺子头注(:769)自己写明「公网是被测对象,本地是对照组」;对照组失真 = 本机服务
        // 没起(实测那 16 封报的是 `127.0.0.1:8801` connRefused,而 8801 = Web/IHUI-WEB,
        // 由 `heal-unresponsive-services.mjs` 那层负责),**与公网可用性无关**。
        // 收信人读着"公网探测越阈值"去查公网永远查不到 ⇒ 这一格是"告的不是信里说的那件事",
        // 属 §5e-1 答不上来就不许挂。正解:本地组只进日志(它是对照组的自检面,不是故障面),
        // 真故障(本机服务没起)归服务自愈层 —— 那层若自己坏了(`check-service-binary-paths`
        // rc=2 派生失败)该修的是它,不是让公网判据替它喊人。
        if (key.includes('本地')) {
          logger(
            `⚠️ 公网探测对照组失真(${key}):${String(r?.numbers || '').slice(0, 160)} —— 本地服务未起,不按公网故障到人(§5e-1);真故障归服务自愈层`,
          )
          continue
        }
        const st = bump.info[key] || { streak: 1, required: effRequired, due: true }
        if (st.due !== true) {
          logger(
            `ℹ️ 公网探测越阈但未达持续性门槛:${key} 连 ${st.streak}/${st.required} 轮 ⇒ 本轮只报名不寄信(下一轮约 ${Math.round(PUBLIC_PROBE_INTERVAL_MS / 60000)} 分钟后;同一身份连续 ${st.required} 轮即到人)`,
          )
          continue
        }
        // 出路按**定位到的那一段**给(§5e-1 出口 1):一封"公网慢"的信没法执行,一封"入口段慢、
        // 对照 20ms"的信才有人能动手。尺子没给定位(A 序列、旧版尺子)时退回原文那条通用出路,
        // 绝不因为新维缺失就把出路那一行省掉。
        const leg = String(r?.leg || '')
        const exitLine =
          leg === 'egress'
            ? '出路:本轮定位是**本机出口 ↔ Cloudflare 边缘**这一跳(握手没完成的样本停在 TCP/TLS 段;本地直连同轮很快,已排除 web;经节点的参照腿可证真实访客不经此路)。按序问:①`node scripts/net-doctor.mjs` 对比直连与节点腿;②看本机上行是否被占(构建/推送/同步);③链路侧丢包要换出口或找运营商 —— **不必**去查隧道或 web 服务。'
            : leg === 'entry'
              ? '出路:本轮定位是**公网入口 ↔ 本机隧道**这一段(web 直连同轮很快,已排除服务本体)。按序问:①`node scripts/check-tunnel-leg-health.mjs --json` 看五维(腿数 / 源地址寿命 / 单点 / 重启账 / **edge-location 落点 PoP**);②若 edge-location 报"全部落在非亚太 PoP" ⇒ 跨境 RTT 与丢包是硬约束,**站点本体无故障,不必查 web/api**,真要动只有换出口(代理/中转机)或提高边缘缓存命中率以减少回源;③`Get-Service Cloudflared` 与隧道日志(该服务以 --protocol http2 跑;运行期错误不落任何文件,是结构性盲区);④`node scripts/net-doctor.mjs` 量出口与代理;⑤看当时上行是否被占(构建/推送/同步)。'
              : leg === 'service'
                ? '出路:本地对照组同轮也越阈 ⇒ 洞在**服务段**(web 本体),查 IHUI-WEB 进程与 8801 自身健康(heal-unresponsive-services 归口),不必查公网链路。'
                : leg === 'unlocated'
                  ? '出路:本轮**定位拿不到**(分阶段读数不全)⇒ 先确认尺子跑的是带 stages 的新传输层(--report 里每条样本应有 stageReached),别按"公网坏了"动手。'
                  : leg === 'undetermined'
                    ? '出路:本轮**定位拿不到**(对照组没样本)⇒ 先问对照组为什么没采到(尺子被掐/8801 未监听/取证未跑完),别按"公网坏了"动手。'
                    : '出路:先用 --report 确认是**目标端**慢/失败(而非探针机抖动);目标真不可用时查该服务自身健康' + '(本机 web/api/ai-service 由 heal-unresponsive-services 自愈;外部目标查其服务端与链路)。'
        // 身份 = **成因 × 严重度档 × 已持续档**(归一住在尺子那侧,§0.6),而不是"序列+结论"。
        // 原写法 `seq;verdict` 仍会每 4 小时重寄同一句话:这件事的成因(跨境段 + 全落 lax 边缘 PoP)
        // 机主短期不会动 ⇒ 同因同档持续 = 同一身份 ⇒ 由下面的日级窗口压住;一旦跨档(恶化到断流级、
        // 或成因从入口段换成服务段)身份即变 ⇒ 立刻重报。绝不靠静音,只靠"没有新事实就别刷屏"。
        // 派发契约里的 `stat` 是**严重度档的唯一输入**(classifyAlertIdentity 只从它取
        // unavailable/longestRunMs/runs/slowRatio)。尺子哪天不带它 ⇒ 档恒 0、断流级恶化不再变成
        // 新身份 ⇒ 24h 窗口把"更坏了"压成"同一件事"。这必须当场喊出来:静默降级成 `{}` 就是
        // 把"没量到"写成"量到了且没问题"(§0.3),而它上一版正是这么无声失效了两周。
        const hasStat = !!r?.stat && typeof r.stat === 'object'
        if (!hasStat)
          logger(`⚠️ 公网探测越阈但身份缺少 stat(尺子未出口序列读数)⇒ 严重度档只能按档 0,本轮「恶化即重报」失明:${key}`)
        const alertId = classifyAlertIdentity(key, hasStat ? r.stat : {}, {
          firstBreachAtMs: Date.parse(String(st.firstAt || '')),
          nowMs: now,
          leg,
        })
        notify(
          `公网路径探测越阈值:${key}`,
          `成因与档位:${alertId.why}\n同一身份连续第 ${st.streak}/${st.required} 轮越阈(门槛 ${st.required} 轮,单轮尖峰不寄信)。\n${String(r?.numbers || '(无读数控)')}\n${reasons.join('\n')}\n` +
            `尺子:scripts/check-public-path-probe.mjs 序列 ${key}。取证回读:node scripts/check-public-path-probe.mjs --report .ihui-agent/tmp/probers/public-path-burst.jsonl\n` +
            exitLine,
          {
            severity: 'warning',
            // dedupKey(§5e-1 配套):numbers 里 `最长连续不可用 13.5s` 这类**带小数点**的值,
            // 数字归一 `\d+ → #` 吃不掉小数点 ⇒ 13s 与 13.5s 撞成两个身份,4 小时窗口被绕成虚设
            // (实测 B/公网 12 封里 7 个间隔短于 4h,最短 0.53h = 两倍 30 分钟节流 = 刚跑完又寄)。
            // 身份只取"序列 + 成因档",实时读数仍进正文。
            dedupKey: `seq=${key};verdict=${verdict};${alertId.identity}`,
            // 同因同档的持续态:日级最多一封(跨档即刻重报,不受本窗口约束 —— 那是另一个身份)。
            windowMs: Math.max(notifyWindowMs(), 24 * 60 * 60 * 1000),
          },
        )
      } else if (verdict === 'unjudged') {
        unjudged += 1
        logger(`ℹ️ 公网路径探测 ${key}:未判定 —— ${reasons.join(' | ') || '(无原因)'}`)
      }
    }
    if (breaches === 0 && unjudged === 0) logger('✅ 公网路径探测:已判定且未越阈值(A/B 两条序列各自的结论见 .ihui-agent/state/public-path-probe-last.json)')
    return { ran: true, judged: true, breaches, unjudged }
  } catch (e) {
    logger('⚠️ 公网路径探测派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/**
 * 隧道腿健康哨的**常驻**派发点(尺子本体 = `scripts/check-tunnel-leg-health.mjs`)。
 *
 * 为什么必须挂在这里(2026-10-16 立项,当天实测到一次真险):cloudflared 的 4 条已建立腿**全部**吊在
 * 同一个已进入 deprecated 的临时 IPv6 源地址上(`首选寿命 0s`)。该地址一旦被系统删除,4 条腿同时断
 * ⇒ 公网入口直接 530,而当天**没有任何一门会提前喊**:监控只会事后报"公网 ERR",公网探测会把这
 * 一跳归进"入口段/出口段"的延迟读数里,谁都不会去看源地址的寿命。这台机是生产机,入口就是这一条隧道。
 *
 * 三条不可漂的写法照抄 `auditPublicPathProbe`:节流而非封量、告警一律经 `notifyGuardRed()`、
 * 未判定只写日志并点名原因(发一封"我什么都没量到"的信是把噪音冒充成告警)。
 *
 * 与公网探测**刻意不同**的一处:这里**不设"连几轮才到人"的持续性门槛**。理由是量纲,不是省事:
 * 公网延迟是**会抖的样本量**(健康轮也会出现 1/10 条 ≥8s,单轮尖峰寄信 = 噪音);而"源地址已废弃 /
 * 进程在而腿数 0"是**状态量**,一轮就是一次事实,而且它是**事前**信号 —— 等第二轮就等于多开 15 分钟
 * "随时可能整组断腿"的危险窗口。
 */
const TUNNEL_LEG_TICK = join(WORKTREE, '.ihui-agent', 'state', 'tunnel-leg-tick.ts')
const TUNNEL_LEG_LAST = join(WORKTREE, '.ihui-agent', 'state', 'tunnel-leg-health-last.json')
const TUNNEL_LEG_INTERVAL_MS = Number(process.env.IHUI_TUNNEL_LEG_INTERVAL_MS || 15 * 60 * 1000)
const TUNNEL_LEG_TIMEOUT_MS = Number(process.env.IHUI_TUNNEL_LEG_TIMEOUT_MS || 90_000)

/**
 * 隧道指标落台账的**常驻**派发点(尺子本体 = `scripts/record-tunnel-metrics.mjs`)。
 *
 * 为什么单立一格而不是塞进隧道腿哨(2026-10-16 实测出来的缺口):
 * 腿哨判的是"此刻"的状态(腿在不在 / 源地址退没退化 / 落点在哪个 PoP),它**不留时间轴**;
 * 而 cloudflared 服务没有 --logfile、monitoring/prometheus 里也没有 cloudflared job ⇒
 * 今天定位"公网入口慢"时只能当场临时抓一次 metrics,回答不了"什么时候开始劣化的、
 * 落点什么时候换的、回源错误率怎么走的"。这一格只做一件事:每 15 分钟把白名单指标
 * **追加一行**到 `.ihui-agent/state/tunnel-metrics.jsonl`,让下次事故有得回放。
 *
 * 三条纪律(与腿哨同格):
 *  ① **只落盘与报数,不判红、不寄信** —— 累计值本身不构成告警语义,落点变化/进程重启
 *     才是有意义的信号,那两档也只进日志;
 *  ② **取不到就点名**(进程不在 / 端口没枚举到 / HTTP 失败 / 抽不出指标)⇒ 写未判定,
 *     绝不落一行"全 0"充数 —— 假台账比没台账更害人;
 *  ③ 节流而非封量,与其余派发点同语义。
 */
const TUNNEL_METRICS_TICK = join(WORKTREE, '.ihui-agent', 'state', 'tunnel-metrics-tick.ts')
const TUNNEL_METRICS_LAST = join(WORKTREE, '.ihui-agent', 'state', 'tunnel-metrics-last.json')
const TUNNEL_METRICS_INTERVAL_MS = Number(process.env.IHUI_TUNNEL_METRICS_INTERVAL_MS || 15 * 60 * 1000)
const TUNNEL_METRICS_TIMEOUT_MS = Number(process.env.IHUI_TUNNEL_METRICS_TIMEOUT_MS || 60_000)

export function auditTunnelMetrics(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = TUNNEL_METRICS_INTERVAL_MS,
    tickFile = TUNNEL_METRICS_TICK,
    lastFile = TUNNEL_METRICS_LAST,
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'record-tunnel-metrics.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 隧道指标台账:尺子脚本不在位(scripts/record-tunnel-metrics.mjs)⇒ 本轮跳过,不记为已落盘')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!publicProbeDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true,
                timeout: TUNNEL_METRICS_TIMEOUT_MS,
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'],
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return { status: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || '') }
            }
          })()
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || ''))
    } catch {
      /* 落到未判定 */
    }
    if (!parsed || typeof parsed !== 'object') {
      logger(`ℹ️ 隧道指标台账:本轮未取到(未判定,不落行)—— ${([call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').split(/\r?\n/)[0].slice(0, 140)}`)
      return { ran: true, judged: false, why: '结论不可解析' }
    }
    if (parsed.ok !== true) {
      logger(`ℹ️ 隧道指标台账:未判定 —— ${String(parsed.reason || '(尺子未给原因)').slice(0, 200)}`)
      return { ran: true, judged: false, why: '尺子未取到' }
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify({ at: new Date(now).toISOString(), ...parsed }, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响 --status 可见性 */
    }
    const d = parsed.diff && typeof parsed.diff === 'object' ? parsed.diff : {}
    if (d.restarted === true) logger(`⚠️ 隧道指标台账报数:cloudflared 进程在本轮与上一轮之间**重启过**(累计计数已归零重来,差分按 null 处理)`)
    if (d.popChanged === true) logger(`⚠️ 隧道指标台账报数:隧道落点 PoP 变了 ⇒ 上一轮 ${String(parsed.previousPops?.join('/') || '(未读)')} → 本轮 ${String((parsed.pops || []).join('/') || '(未读)')}`)
    if (Number.isFinite(d.errorsDelta) && d.errorsDelta > 0) logger(`⚠️ 隧道指标台账报数:本轮新增回源错误 ${d.errorsDelta} 次(累计 ${parsed.requestErrors ?? '(未读)'})`)
    logger(`✅ 隧道指标台账:已落一行(腿 ${parsed.haConnections ?? '?'} 条,落点 ${(parsed.pops || []).join('/') || '(未读)'},累计请求 ${parsed.totalRequests ?? '?'},回源错误 ${parsed.requestErrors ?? '?'})⇒ ${String(parsed.ledger || '.ihui-agent/state/tunnel-metrics.jsonl')}`)
    return { ran: true, judged: true, ok: true, ledger: parsed.ledger || null, diff: d }
  } catch (e) {
    logger('⚠️ 隧道指标台账派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

// 〔归档@2026-10-25/门103 C1〕原 21 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l4091-起-21-行
export function sweepStaleClosedRows(opts = {}) {
  const {
    now = Date.now(),
    // 2026-10-23:30min → 5min(理由见本函数头注)。无滞留那一档零落地,不会刷爆共享仓。
    intervalMs = 5 * 60 * 1000,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'plan-closed-sweep-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'strip-stale-closed-rows.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 完成即删清扫:器物不在位(scripts/strip-stale-closed-rows.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '清扫器不在位' }
  }
  let last = NaN
  try {
    last = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(last) && now - last < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠️ 完成即删清扫:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`)
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--apply'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true,
              timeout: 10 * 60 * 1000,
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { ok: true, out: String(out ?? '') }
          } catch (e) {
            // exit 1 = 只读预演语义"有滞留但未落地"或落地被拒;都按"记一笔、下轮再试"处理
            return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`, err: String(e?.message ?? e) }
          }
        }
  const r = run()
  const rows = String(r.out ?? '').split(/\r?\n/)
  // 三态读数**只认清扫器自己打的机读结论行**(SWEEP-RESULT state=…),不靠中文文案猜:
  //  "摘了 N 条" / "无滞留" / "有滞留但全部被判『仍保护』而一条未摘" 必须长得不一样 ——
  //  把第三种显示成"无需清扫"就是把"没做"写成"做过"(§0.3/§0.10 同一条禁令)。
  const resultLine = rows
    .map((l) => (l.match(/SWEEP-RESULT\s+state=([A-Za-z-]+)(.*)$/) ?? null))
    .find(Boolean)
  const kv = (key) => {
    const m = resultLine ? String(resultLine[2]).match(new RegExp(`\\b${key}=(\\S+)`)) : null
    return m ? m[1] : null
  }
  const keep = rows.filter((l) => /滞留|清扫完成|未判定|拒绝|守恒|跳过|仍保护|SWEEP-RESULT|❌/.test(l))
  const line = keep
    .filter((l) => !/SWEEP-RESULT/.test(l))
    .slice(-2)
    .join(' / ')
  const state = resultLine ? resultLine[1] : null
  let reading = null
  if (state === 'clean') reading = `无跨枚滞留(账面已勾 0 条,读数来自清扫器)`
  else if (state === 'stripped')
    reading = `摘除 ${kv('stripped') ?? '?'} 条(滞留 ${kv('stale') ?? '?'},另跳过 ${kv('held') ?? '?'} 条仍保护者交人工)`
  else if (state === 'all-held')
    reading =
      `有滞留 ${kv('stale') ?? '?'} 条,但**全部**被守门 71 判为「仍保护」⇒ 本轮一条未摘,交人工处置` +
      `(摘了会被按未勾形态还原;这一档不等于"账面干净")`
  else if (state === 'undetermined') reading = `未判定(${kv('why') ?? '尺子取不到'})⇒ 本轮没判,不等于"账面干净"`
  else if (state === 'refused') reading = `整批不落(refused:${kv('why') ?? '守恒/归因不过'})—— 滞留仍在,交人工`
  else if (state === 'preflight') reading = `预演档(不应出现在 --apply 派发里):滞留 ${kv('stale') ?? '?'}`
  logger(
    reading !== null
      ? `${state === 'clean' || state === 'stripped' ? '✅' : '⚠️'} 完成即删清扫轮:${reading}${line ? ` ｜ ${line.slice(0, 160)}` : ''}`
      : `${r.ok ? '✅' : '⚠️'} 完成即删清扫轮:${line || r.err || '未取到清扫器结论行(SWEEP-RESULT)⇒ 本轮读数未判定,不等于"账面干净"'}`,
  )
  return { ran: true, ok: r.ok, state: state ?? 'no-result-line', summary: line, reading }
}

/**
 * 超龄认领牌代摘轮(2026-10-22 立,同日补回:这一层曾被一枚已入库的提交整段删掉而无人发现
 * —— 代摘器物 `strip-stale-claim-marks.mjs` 仍在仓里,但没有派发点就是"造好没装车"(§0.9),
 * 表现是超龄牌永不自清、派单面虚低。接线锁见 scripts/tests/strip-stale-claim-marks.test.mjs)。
 * 只认器物自己打的机读行 `SWEEP-RESULT state=…`,中文文案不参与判定;取不到那一行一律未判定。
 */
export function sweepStaleClaimMarks(opts = {}) {
  const {
    now = Date.now(),
    // 2026-10-23:30min → 5min(与 sweepStaleClosedRows 同档)。此前 30 分钟那一档实测护栏③
    // 整批让路 ⇒ 器物永久空转、45 枚超龄牌从 10-22 07:45 起一枚未摘;护栏收窄后无滞留即
    // 零落地零推送,压到 5 分钟不会刷爆共享仓。
    intervalMs = 5 * 60 * 1000,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'stale-claim-strip-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'strip-stale-claim-marks.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 超龄认领代摘:器物不在位(scripts/strip-stale-claim-marks.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '代摘器不在位' }
  }
  let last = NaN
  try {
    last = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(last) && now - last < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠️ 超龄认领代摘:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`)
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--apply'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true,
              timeout: 10 * 60 * 1000,
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { ok: true, out: String(out ?? '') }
          } catch (e) {
            return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`, err: String(e?.message ?? e) }
          }
        }
  const r = run()
  const rows = String(r.out ?? '').split(/\r?\n/)
  const resultLine = rows
    .map((l) => (l.match(/SWEEP-RESULT\s+state=([A-Za-z-]+)(.*)$/) ?? null))
    .find(Boolean)
  const kv = (key) => {
    const m = resultLine ? String(resultLine[2]).match(new RegExp(`\\b${key}=(\\S+)`)) : null
    return m ? m[1] : null
  }
  const keep = rows.filter((l) => /代摘|释放|认领|超龄|未判定|拒绝|守恒|跳过|SWEEP-RESULT|❌/.test(l))
  const line = keep
    .filter((l) => !/SWEEP-RESULT/.test(l))
    .slice(-2)
    .join(' / ')
  const state = resultLine ? resultLine[1] : null
  let reading = null
  if (state === 'clean') reading = `无超龄认领牌(在册 ${kv('held') ?? '?'} 枚均未超龄,读数来自代摘器)`
  else if (state === 'stripped')
    reading = `代摘 ${kv('stripped') ?? '?'} 枚超龄牌(超龄 ${kv('stale') ?? '?'},仍持租约跳过 ${kv('held') ?? '?'} 枚)`
  else if (state === 'refused') reading = `整批不落(refused:${kv('why') ?? '守恒/工作树不净'})⇒ 牌仍在,交人工`
  logger(
    reading !== null
      ? `${state === 'clean' || state === 'stripped' ? '✅' : '⚠️'} 超龄认领代摘轮:${reading}${line ? ` ｜ ${line.slice(0, 160)}` : ''}`
      : `${r.ok ? '✅' : '⚠️'} 超龄认领代摘轮:${line || r.err || '未取到代摘器结论行(SWEEP-RESULT)⇒ 本轮读数未判定,不等于"账面没有超龄牌"'}`,
  )
  return {
    ran: true,
    ok: r.ok,
    state: state ?? 'undetermined',
    // 机读三键原样带出(测试与问责都读这三枚):把"摘了多少"藏在中文文案里就等于没报
    stale: kv('stale'),
    held: kv('held'),
    stripped: kv('stripped'),
    summary: line,
    reading,
  }
}

const SWEEP_LIVENESS_INTERVAL_MS = Number(process.env.IHUI_SWEEP_LIVENESS_INTERVAL_MS || 30 * 60 * 1000)

/**
 * 清扫背离巡检(2026-10-23 立,机主令"要"):判"派发在动、留痕静默"这一族空转 ——
 * 上面两把清扫器的节流台账都在刷新(只证明"被叫醒过"),而摘除留痕台账最后一条 at
 * 静默超过 2 小时,同时 HEAD 面上还有这一轮真正会动手的可清存量 ⇒ 器物在仓、派发点在、
 * 就是干不成活。两度实证的形态:10-22 护栏③ 整批让路(45 枚超龄牌一枚未摘)、
 * 10-23 摘除成功落地却一行留痕都不写(复洁器与 union 同时瞎掉)。
 *
 * 三条刻意(与 reportBaselineFreshness 同族):
 *  ① **只读探针**:判的是"守护自己的巡检层空转",与提交内容无关 ⇒ 不 notifyGuardRed、
 *     不改任何退出码(§12e 恒红门禁令)。先证明自己不是狼来了,再谈别的。
 *  ② 30 分钟节流:closed 族存量要跑守门 71 尺子(H4 分档),不宜 5 分钟档;间隔内不派生
 *     子进程(本守护每 2 分钟一趟,便宜档零成本)。
 *  ③ 挂在 sweepStaleClaimMarks() 之后:两族 tick 刚被那一轮刷新 ⇒ 同轮即可验证健康。
 *
 * 结论只认尺子自己打的机读行/JSON(`overall` + 逐族 `state`),中文文案不参与判定;
 * 取不到结论一律写"未判定"并带上原因,不读成绿(§0.3)。
 */
export function auditSweeperLiveness(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = SWEEP_LIVENESS_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'sweeper-liveness-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-sweeper-liveness.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 清扫背离巡检:尺子不在位(scripts/check-sweeper-liveness.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '尺子不在位' }
  }
  let last = NaN
  try {
    last = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(last) && now - last < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠️ 清扫背离巡检:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`)
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--json'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
              timeout: 5 * 60 * 1000, // 守门 80:热路径派生一律带上限
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { ok: true, out: String(out ?? ''), status: 0 }
          } catch (e) {
            // 非零退出**不是**"尺子坏了":stalled 就 exit 1、未判定 exit 2,结论整份在 stdout。
            // 把 status/stdout/stderr 全取回来交 readProbeVerdict 分三态(§5e 同型)。
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
            }
          }
        }
  const r = run()
  const v = readProbeVerdict({ status: r.status ?? null, stdout: r.out, stderr: r.err ?? '' })
  if (!v.parsed) {
    // 尺子跑不动 ≠ 有空转;也 ≠ 可以静默。留一行,免得"账没了"和"账绿了"长得一样。
    logger(`⚠️ 清扫背离巡检:尺子结论不可用:未判定 —— ${v.why ?? '原因未取到'},不影响自愈与退出码`)
    return { ran: true, ok: false, why: v.why ?? 'unparsed' }
  }
  const fams = Array.isArray(v.parsed.families) ? v.parsed.families : []
  const stalled = fams.filter((f) => f && f.state === 'stalled')
  const und = fams.filter((f) => f && f.state === 'undetermined')
  if (stalled.length > 0) {
    for (const f of stalled) {
      logger(
        `⚠️ 清扫背离:${f.id}(${f.label})派发在动(节流 ${f.tickAgeMin ?? '?'} 分钟前刚醒)` +
          `但留痕${f.ledgerSilentMin === null ? '从未写过' : `已静默 ${f.ledgerSilentMin} 分钟`},` +
          `可清存量 ${f.stock} ⇒ 器物空转 ｜ ${f.detail} ｜ ${f.stockNote ?? ''}`,
      )
    }
  } else if (und.length > 0) {
    for (const f of und) {
      logger(`⚠️ 清扫背离巡检:${f.id} 未判定(${f.why})—— ${f.detail} ｜ ${f.stockNote ?? ''}`)
    }
  } else {
    // 探针自己的心跳证据:全绿也写行(与 reportBaselineFreshness 的"安静"刻意不同 ——
    // 这一格判的是别的层空转,它自己哑了同样没人知道,参考 watchPatrolHeartbeat)。
    logger(`✅ 清扫背离巡检:两族均无背离(${v.parsed.overall ?? '?'})`)
  }
  return {
    ran: true,
    ok: r.ok,
    overall: v.parsed.overall ?? null,
    stalled: stalled.length,
    undetermined: und.length,
    families: fams,
  }
}

const INDEX_UNMERGED_INTERVAL_MS = Number(process.env.IHUI_INDEX_UNMERGED_INTERVAL_MS || 15 * 60 * 1000)

/**
 * index 烂尾(unmerged 条目)滞留哨兵(2026-10-24 立):凌晨一次违规 stash + rebase +
 * stash pop 冲突会话逃逸,index 挂 2 枚 unmerged + 91 个被删文件 12 小时无人察觉,最终靠
 * foreign-work 对账间接发现。本层把这一格变成专职判据(尺子 = scripts/check-index-unmerged-age.mjs):
 *   clean 静默;fresh(未超龄,正常合并进行中)只写 ℹ️;stale(同批条目滞留 ≥15 分钟)
 *   到人(§5e-1:文案自带可执行下一步);undetermined 只写 ⚠️ 不猜(§0.3)。
 * 判机器状态 ⇒ 不进提交链;不改本守护退出码(§12e)。15 分钟节流,间隔内零派生。
 */
export function auditIndexUnmerged(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = INDEX_UNMERGED_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'index-unmerged-tick.json'),
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-index-unmerged-age.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ index 烂尾哨兵:尺子不在位(scripts/check-index-unmerged-age.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '尺子不在位' }
  }
  let last = NaN
  try {
    last = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(last) && now - last < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠️ index 烂尾哨兵:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})—— 下轮照旧派发`)
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--json'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
              timeout: 60_000,
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { ok: true, out: String(out ?? ''), status: 0 }
          } catch (e) {
            // stale 就 exit 1、未判定 exit 2:非零退出不是尺子坏了,结论整份在 stdout。
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
            }
          }
        }
  const r = run()
  const v = readProbeVerdict({ status: r.status ?? null, stdout: r.out, stderr: r.err ?? '' })
  if (!v.parsed) {
    logger(`⚠️ index 烂尾哨兵:尺子结论不可用:未判定 —— ${v.why ?? '原因未取到'},不影响自愈与退出码`)
    return { ran: true, ok: false, why: v.why ?? 'unparsed' }
  }
  const overall = String(v.parsed.overall ?? 'undetermined')
  const detail = String(v.parsed.detail ?? '')
  if (overall === 'stale') {
    logger(`❌ index 烂尾哨兵:unmerged 条目滞留超龄(${v.parsed.count ?? '?'} 枚 / ${v.parsed.ageMin ?? '?'} 分钟)⇒ 到人`)
    notify('index 烂尾(unmerged)滞留', detail, { dedupKey: 'index-unmerged-stale' })
  } else if (overall === 'fresh') {
    logger(`ℹ️ index 烂尾哨兵:出现 ${v.parsed.count ?? '?'} 枚未合并条目(${v.parsed.ageMin ?? '?'} 分钟,未超龄)—— 若无合并进行中将转 stale 到人`)
  } else if (overall === 'clean') {
    // 心跳证据:全绿也写行(auditSweeperLiveness 同族 —— 这一格判的是"别人的烂尾",
    // 它自己哑了同样没人知道)。
    logger('✅ index 烂尾哨兵:无未合并条目')
  } else {
    logger(`⚠️ index 烂尾哨兵:未判定(${detail.slice(0, 120) || '原因未取到'})—— 只报数不喊人`)
  }
  return { ran: true, ok: r.ok, overall, count: v.parsed.count ?? null, ageMin: v.parsed.ageMin ?? null }
}

export function auditTunnelLegHealth(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = TUNNEL_LEG_INTERVAL_MS,
    tickFile = TUNNEL_LEG_TICK,
    lastFile = TUNNEL_LEG_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-tunnel-leg-health.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 隧道腿健康:尺子脚本不在位(scripts/check-tunnel-leg-health.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!publicProbeDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
                timeout: TUNNEL_LEG_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git/子进程必须显式接管 stdio
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return { status: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || '') }
            }
          })()
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || ''))
    } catch {
      /* 落到未判定 */
    }
    if (!parsed || !parsed.dims || typeof parsed.dims !== 'object') {
      logger(`⚠️ 隧道腿健康未产出结论(未判定,不记为已探测):rc=${call.status} ${([call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').split(/\r?\n/)[0].slice(0, 140)}`)
      return { ran: true, judged: false, why: '结论不可解析' }
    }
    // **尺子自己的阳性对照失手 ⇒ 整轮不采信**:一把抓不到"已知必坏"目标的尺子没资格出具合格证,
    // 更没资格据此寄信(既不寄"坏了",也不寄"没坏")—— 只报名,等人来看。
    if (parsed.positiveControl && parsed.positiveControl !== 'pass') {
      logger(`⚠️ 隧道腿健康阳性对照未命中(${String(parsed.positiveControl).slice(0, 80)})⇒ 该尺子本轮失明,不采信其结论、不派信`)
      return { ran: true, judged: false, why: '阳性对照未命中' }
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify({ at: new Date(now).toISOString(), ...parsed }, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响 --status 可见性,不影响告警本身 */
    }
    let breaches = 0
    let warns = 0
    let unjudged = 0
    for (const [dim, d] of Object.entries(parsed.dims)) {
      const verdict = String(d?.verdict || '')
      const reading = JSON.stringify(d?.reading ?? {}).slice(0, 300)
      if (verdict === 'breach') {
        breaches += 1
        // 身份必须带**持续档**(2026-10-18 补,与 `部署停摆`/`backup-refresh-fail` 同一把尺子):
        // deprecated-source 在本机是**节律性现象** —— 源地址首选寿命实测 ~12h,到期必退化,
        // 而唯一的出路(重启 Cloudflared)代价是 3 分钟 530,按 4h 平窗重报等于每 4 小时逼机主
        // 做一次比故障更贵的操作。现读 10-16 以来该族 8 封全是平窗重发。改后:同一段退化内
        // 只在跨 6h/24h/72h 档时重报,清掉起点即归零。
        const held = alertHeldTier(noteUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', `tunnel-leg-${dim}-first.json`), now).firstMs, now)
        const exit =
          dim === 'deprecated-source'
            ? '出路:重启 `Cloudflared` 服务让腿重选源地址。**实测代价(2026-10-16 15:40 那次)**:优雅关闭到旧进程退出约 3 分钟,期间监控现读到 `530` 与 `StopPending(公网入口将不可达)`;写"10-30 秒"是错的。不重启的后果则是源地址被删时 4 条腿同时断 ⇒ 入口长时间 530。挑低峰做,做完用本尺子复验腿数。'
            : '出路:进程在而腿数 0 ⇒ 隧道没连上 CF 边缘。①`node scripts/check-tunnel-leg-health.mjs --json` 看四维与重启账;②隧道**生命周期**落 Windows 事件日志(provider=`Cloudflared`,只到信息级:starting/stopped/graceful),用 `wevtutil qe Application "/q:*[System[Provider[@Name=\'Cloudflared\']]]" /f:XML /rd /c:20`;**运行期错误(握手/重连)不落任何地方**(stdout 被丢),那一段是结构性盲区;③本机出口 `node scripts/net-doctor.mjs`。'
        notify(
          `公网入口隧道腿异常:${dim}`,
          `读数:${reading}\n原因:${String(d?.reason || '(尺子未给原因)')}\n尺子:scripts/check-tunnel-leg-health.mjs(netsh 地址寿命 + netstat 腿 + 进程三路现读,只读)。\n取证:node scripts/check-tunnel-leg-health.mjs --json(或读 .ihui-agent/state/tunnel-leg-health-last.json)\n${exit}`,
          { severity: 'warning', dedupKey: `dim=${dim};verdict=${verdict};legs=${alertCountTier(parsed.legs)};held=${held.tier}` },
        )
      } else if (verdict === 'warn') {
        // 报数维不影响起点;起点在循环后按 ok/warn 统一清扫 ⇒ 下一轮真退化时从 0 起算
        warns += 1
        logger(`⚠️ 隧道腿健康报数(${dim},不判红):${String(d?.reason || reading).slice(0, 200)}`)
      } else if (verdict === 'unjudged') {
        unjudged += 1
        logger(`ℹ️ 隧道腿健康 ${dim}:未判定 —— ${String(d?.reason || '(无原因)').slice(0, 200)}`)
      }
    }
    // 起点清扫:本轮该维判 ok/warn(即"没在坏")就摘掉它的持续计时;unjudged 既不续命也不清零(§0.3)
    for (const [dim, d] of Object.entries(parsed.dims)) {
      const v = String(d?.verdict || '')
      if (v === 'ok' || v === 'warn') clearUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', `tunnel-leg-${dim}-first.json`))
    }
    if (breaches === 0 && unjudged === 0) logger(`✅ 隧道腿健康:${parsed.legs} 条腿,源地址未见废弃(${warns} 格只报数)`)
    return { ran: true, judged: true, breaches, warns, unjudged, legs: parsed.legs }
  } catch (e) {
    logger('⚠️ 隧道腿健康派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/** 〈原 25 行头注已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-24.md#git-guardian-L4586〉 部署停摆的**高频**派发点(尺子本体 = `scripts/check-credential-health.mjs --stall-only --json`) */
const DEPLOY_STALL_TICK = join(WORKTREE, '.ihui-agent', 'state', 'deploy-stall-tick.ts')
const DEPLOY_STALL_FIRST = join(WORKTREE, '.ihui-agent', 'state', 'deploy-stall-first.json')
const DEPLOY_STALL_INTERVAL_MS = Number(process.env.IHUI_DEPLOY_STALL_INTERVAL_MS || 15 * 60 * 1000)
const DEPLOY_STALL_TIMEOUT_MS = Number(process.env.IHUI_DEPLOY_STALL_TIMEOUT_MS || 120_000)

export function auditDeployStall(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = DEPLOY_STALL_INTERVAL_MS,
    tickFile = DEPLOY_STALL_TICK,
    firstFile = DEPLOY_STALL_FIRST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-credential-health.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 部署停摆:尺子脚本不在位(scripts/check-credential-health.mjs)⇒ 本轮跳过')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!publicProbeDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--stall-only', '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b
                timeout: DEPLOY_STALL_TIMEOUT_MS, // 守门 80
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return { status: typeof e.status === 'number' ? e.status : null, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || ''), killed: Boolean(e && (e.killed || e.code === 'ETIMEDOUT')) }
            }
          })()
    // 超时被读成**未判定**,不是"停摆",也不是"尺子坏了"(型②同一条纪律)。
    if (call.killed === true || call.status === null) {
      logger(`ℹ️ 部署停摆:未判定 —— 派生超时/被杀(${String(call.stderr || '无原因').split(/[\r\n]+/)[0].slice(0, 140)})⇒ 不寄信也不记绿`)
      return { ran: true, judged: false, why: '派生超时' }
    }
    const lines = String(call.stdout || '').split(/[\r\n]+/).filter((x) => x.trim())
    let p = null
    try {
      p = JSON.parse(lines[lines.length - 1] || '')
    } catch {
      /* 落到未判定 */
    }
    if (!p || !['ok', 'fail', 'unjudged'].includes(p.level)) {
      logger(`ℹ️ 部署停摆:未判定(rc=${call.status},读数不可解析)—— ${String(call.stderr || call.stdout || '(无输出)').split(/[\r\n]+/)[0].slice(0, 140)}`)
      return { ran: true, judged: false, why: '读数不可解析' }
    }
    if (p.level === 'unjudged') {
      logger(`ℹ️ 部署停摆:未判定 —— ${String(p.why || '(尺子未给原因)').slice(0, 200)}`)
      return { ran: true, judged: false, why: '尺子自报未判定' }
    }
    if (p.level === 'ok') {
      clearUndeterminedStreak(firstFile)
      logger(`✅ 部署停摆:绿(线上 ${String(p.liveSha || '(无)').slice(0, 9)},最近成功 ${p.lastSuccessIso || '?'})`)
      return { ran: true, judged: true, ok: true }
    }
    // 类别只取"人能做的动作"不同的那两种:标记缺失要先查线上产物,落后要先查环为什么不切流。
    // 其余一切读数(tip、live sha、成功时刻、落后小时数)都只进正文。
    // **身份用起始类别,不用本轮类别**(2026-10-19 现读改正):今晚一次 rebuild 把线上标记
    // `IHUI_BUILD_SHA` 洗掉 ⇒ 同一场停摆的类别从 `behind` 翻成 `no-marker`,而类别在身份里
    // ⇒ 4h 窗当场作废,同一件事换来 3 封(14:35 behind / 16:43 与 19:23 no-marker)。
    // 类别 flipping 是**同一段故障的表征变化**,不是新故障;真要报新的,由持续档(6h/24h/72h)
    // 与起点清除(线上追平)那两格负责。正文照旧写本轮读数,信息量不降。
    const classNow = String(p.liveSha || '').trim() ? 'behind' : 'no-marker'
    const streak = noteUndeterminedStreak(firstFile, now, { stallClass: classNow })
    const stallClass = String(streak.meta.stallClass || classNow)
    const held = alertHeldTier(streak.firstMs, now)
    const outcome = notify(
      '部署停摆(线上构建 vs origin/main)',
      `${String(p.why || '')}\n线上 ${String(p.liveSha || '(无标记)').slice(0, 12)} / tip ${String(p.tipSha || '?').slice(0, 12)}(来源 ${p.tipSource || '未标注'})\n最近一次成功部署 ${p.lastSuccessIso || '(取不到)'}${p.lastSuccessFromClause ? `(${p.lastSuccessFromClause})` : ''};阈值 ${p.thresholdMin} 分钟;本轮已落后 ${p.behindHours ?? '?'} 小时;本段停摆已持续 ${held.hours ?? '?'} 小时(档 ${held.tier});本轮类别 ${classNow}${classNow !== stallClass ? `(身份沿用本段起点类别 ${stallClass} ⇒ 标记被 rebuild 洗掉不再被算成第二场停摆)` : ''}\n取证:node scripts/check-credential-health.mjs --stall-only --json(只读、零写盘、零发信)`,
      { severity: 'critical', dedupKey: `stall;class=${stallClass};held=${held.tier}` },
    )
    // 日志必须分得出"真寄了"与"窗口内压住" —— 原先两支都写"已派发到邮件通道",
    // 于是"这一轮有没有多寄一封"在日志里读不出来,而这正是本格改完之后唯一要看的那件事。
    logger(
      outcome && outcome.suppressed
        ? `ℹ️ 部署停摆:同一场停摆窗口内已通报,本轮压住 —— ${String(p.why || '').slice(0, 140)}`
        : `❌ 部署停摆:已派发到邮件通道 —— ${String(p.why || '').slice(0, 140)}`,
    )
    return { ran: true, judged: true, ok: false, behindHours: p.behindHours }
  } catch (e) {
    logger('⚠️ 部署停摆派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

// 〔归档@2026-10-25/门103 C1〕原 18 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l4691-起-18-行
const ORPHAN_AUDIT_TICK = join(WORKTREE, '.ihui-agent', 'state', 'orphan-audit-tick.ts')
const ORPHAN_AUDIT_INTERVAL_MS = Number(process.env.IHUI_ORPHAN_AUDIT_INTERVAL_MS || 30 * 60 * 1000)
/** 尺子是纯只读 git 问答,正常 <1s;给 2 分钟硬上限只为"一次守护绝不被它拖死"(守门 80 同取向) */
const ORPHAN_AUDIT_TIMEOUT_MS = Number(process.env.IHUI_ORPHAN_AUDIT_TIMEOUT_MS || 120_000)

/** 节流判定(纯函数):距上次巡检是否已够一个间隔。取不到 tick 文件 ⇒ 视为**该跑了**。 */
export function orphanAuditDue(nowMs, tickMs, intervalMs = ORPHAN_AUDIT_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

export function auditOrphanDeletionRefs(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = ORPHAN_AUDIT_INTERVAL_MS,
    tickFile = ORPHAN_AUDIT_TICK,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-orphan-deletion-refs.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ 孤儿删除引用巡检:尺子脚本不在位(scripts/check-orphan-deletion-refs.mjs)⇒ 本轮跳过,不记为已巡检',
    )
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!orphanAuditDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    // 注意判序:`runner || (iife())` 那种写法在传入了假 runner 时会让 `call` **等于函数本身**
    // (短路掉调用),而不是它的返回值 —— 本仓 auditPublicPathProbe 此刻就是这一型(无调用方所以未爆),
    // 本函数按"显式注入优先调用"写,镜像测试才能在不派生真进程的前提下取到三态。
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
                timeout: ORPHAN_AUDIT_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'],
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return {
                status: typeof e.status === 'number' ? e.status : 2,
                stdout: String(e.stdout || ''),
                stderr: String(e.stderr || e.message || ''),
              }
            }
          })()
    if (call.status === 2) {
      logger(
        `ℹ️ 孤儿删除引用巡检:未判定(尺子 rc=2,用法/环境错 —— ${String(call.stderr || '').slice(0, 120)})`,
      )
      return { ran: true, judged: false, why: '尺子 rc=2' }
    }
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || '').trim())
    } catch {
      parsed = null
    }
    if (!parsed || !Array.isArray(parsed.hits)) {
      logger(
        '⚠️ 孤儿删除引用巡检:输出取不到 JSON ⇒ 未判定,不记为已巡检(不得把"没解析出"写成"没有命中")',
      )
      return { ran: true, judged: false, why: 'JSON 取不到' }
    }
    const undet = Array.isArray(parsed.undetermined) ? parsed.undetermined : []
    if (parsed.hits.length) {
      const list = parsed.hits
        .slice(0, 12)
        .map(
          (h) =>
            `  · ${h && h.path ? h.path : '(无名)'} ← 仍被引用于 ${h && h.via ? h.via : '(出处未判定)'}${h && h.kind ? ` [型:${h.kind}]` : ''}`,
        )
        .join('\n')
      const more =
        parsed.hits.length > 12 ? `\n  …另有 ${parsed.hits.length - 12} 条,回读命令见下行` : ''
      notify(
        '孤儿删除引用巡检命中',
        `HEAD 树里还有这些路径,而索引与磁盘都没有它们,且源码仍 import 它们 ⇒ 任何一次干净检出/CI 构建都会 Module not found。\n${list}${more}\n\n尺子:node scripts/check-orphan-deletion-refs.mjs(只读;修法是把该文件补回索引,或改掉那处引用 —— 二者由该路径的持有人定)`,
        // 身份 = 命中数的档位 + **路径集合本身**(排序后拼)。原写法没有 key ⇒ 正文里的
        // "另有 N 条"与 12 条截断清单每轮抖 ⇒ 每次巡检都像新故障(型③)。集合进身份是有意的:
        // 多出一个孤儿路径确实是新事实,该重报;单纯计数抖动不该。
        { severity: 'warning', dedupKey: `orphan-hits;tier=${alertCountTier(parsed.hits.length)};set=${parsed.hits.map((h) => (h && h.path) || '(无名)').sort().join('+').slice(0, 600)}` },
      )
      logger(`❌ 孤儿删除引用巡检:命中 ${parsed.hits.length} 条(已派发到邮件通道)`)
    } else if (undet.length) {
      logger(
        `ℹ️ 孤儿删除引用巡检:零命中,但有 ${undet.length} 条未判定 —— ${undet.slice(0, 3).join(' | ')}`,
      )
    } else {
      logger('✅ 孤儿删除引用巡检:已判定且零命中')
    }
    return { ran: true, judged: true, hits: parsed.hits.length, undetermined: undet.length }
  } catch (e) {
    logger(
      '⚠️ 孤儿删除引用巡检派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160),
    )
    return { ran: false, why: '派发异常' }
  }
}

const MIGRATION_GAPS_TICK = join(WORKTREE, '.ihui-agent', 'state', 'migration-gaps-tick.ts')
const MIGRATION_GAPS_INTERVAL_MS = Number(process.env.IHUI_MIGRATION_GAPS_INTERVAL_MS || 30 * 60 * 1000)
const MIGRATION_GAPS_TIMEOUT_MS = Number(process.env.IHUI_MIGRATION_GAPS_TIMEOUT_MS || 120_000)

/**
 * 迁移账本「中间缺口」巡检(尺子 = `scripts/check-db-migration-gaps.mjs`,2026-10-25 立)。
 *
 * 为什么必须常驻: `drizzle-kit migrate` 只应用 `when > max(账本.created_at)` 的迁移,一个带旧 when
 * 的迁移晚到(并发合并/重排)会被**永久跳过**且 migrate 仍 exit 0;部署侧只看条数差,把“永不补的
 * 中间缺口”与“下轮会补的待应用”混成一档。实测 2026-10-25:D125 协作两表在生产缺建表,日志只报
 * “1-3 档”。本格 30 分钟量一次,缺口集合进 dedupKey(新缺口=新事实该重报,单纯条数抖动不重报)。
 */
export function migrationGapsDue(nowMs, tickMs, intervalMs = MIGRATION_GAPS_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

export function auditMigrationGaps(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = MIGRATION_GAPS_INTERVAL_MS,
    tickFile = MIGRATION_GAPS_TICK,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-db-migration-gaps.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 迁移缺口审计:尺子脚本不在位(scripts/check-db-migration-gaps.mjs)⇒ 本轮跳过,不记为已巡检')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!migrationGapsDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
    const call =
      typeof runner === 'function'
        ? runner()
        : (() => {
            try {
              const out = execFileSync(process.execPath, [script, '--json'], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b
                timeout: MIGRATION_GAPS_TIMEOUT_MS, // 守门 80
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g
              })
              return { status: 0, stdout: String(out || ''), stderr: '' }
            } catch (e) {
              return {
                status: typeof e.status === 'number' ? e.status : 2,
                stdout: String(e.stdout || ''),
                stderr: String(e.stderr || e.message || ''),
              }
            }
          })()
    const lines = String(call.stdout || '').split(/[\r\n]+/).filter((x) => x.trim())
    let p = null
    try {
      p = JSON.parse(lines[lines.length - 1] || '')
    } catch {
      p = null
    }
    if (!p || !Array.isArray(p.lateGap)) {
      logger(
        `ℹ️ 迁移缺口审计:未判定(rc=${call.status},读数不可解析)—— ${String(call.stderr || call.stdout || '(无输出)').split(/[\r\n]+/)[0].slice(0, 140)}`,
      )
      return { ran: true, judged: false, why: '读数不可解析' }
    }
    const late = p.lateGap
    const pending = Array.isArray(p.pending) ? p.pending : []
    const drift = Array.isArray(p.hashDrift) ? p.hashDrift : []
    if (late.length === 0) {
      logger(
        `✅ 迁移缺口审计:无中间缺口(applied=${p.applied ?? '?'} / pending=${pending.length} / hashDrift=${drift.length} 只报数)`,
      )
      return { ran: true, judged: true, ok: true }
    }
    const tags = late.map((x) => (x && x.tag) || '(无名)').sort()
    const outcome = notify(
      'DB 迁移账本存在中间缺口(drizzle 永不应用)',
      `缺口 ${late.length} 条:${tags.join(', ')}\npending=${pending.length}(下轮会补)/ hashDrift=${drift.length}(内容后改或水印,已应用)。\n处置:node scripts/check-db-migration-gaps.mjs --repair --yes(先快照账本,再逐条单事务应用+补账本);不要手改 drizzle.__drizzle_migrations。\n取证:node scripts/check-db-migration-gaps.mjs --json`,
      { severity: 'critical', dedupKey: `migration-gap;set=${tags.join('+').slice(0, 600)}` },
    )
    logger(
      outcome && outcome.suppressed
        ? `ℹ️ 迁移缺口审计:同一缺口窗口内已通报,本轮压住 —— ${tags.join(', ').slice(0, 140)}`
        : `❌ 迁移缺口审计:已派发到邮件通道 —— ${tags.join(', ').slice(0, 140)}`,
    )
    return { ran: true, judged: true, ok: false, lateGap: late.length }
  } catch (e) {
    logger('⚠️ 迁移缺口审计派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/**
 * 把本守护的计划任务确保为 S4U(幂等;已是 S4U 时脚本自己秒退)。
 * 为什么必须做:两个看门任务原先是 InteractiveToken ⇒ **无人登录时它们根本不跑**,
 * 于是 .git 存续守护与凭据告警会在"机器重启后没人登录"这段时间里同时静默 ——
 * 正是今天两天冻结的同族形态。切 S4U 的两条常规路在本机都走不通
 * (`schtasks /RU <u> /NP` 会交互索要密码;pwsh 无 ScheduledTasks cmdlet),
 * 唯一可行形态是 Schedule.Service COM + `NewTask(0)` 可写 XmlText + SID/Null/2,
 * 已由 `scripts/task-set-s4u.vbs` 封装并在真任务上验证(切后 Last Result=0、探针显示
 * HKCU 的用户级环境变量与同步盘凭据文件在 S4U 下依然可读)。
 */
function ensureS4u() {
  const vbs = join(dirname(fileURLToPath(import.meta.url)), 'task-set-s4u.vbs')
  if (!existsSync(vbs)) return
  try {
    const out = execFileSync('cscript.exe', ['//nologo', vbs, TASK_NAME], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 90000,
    })
    if (/switched to S4U/.test(out))
      log('✅ 计划任务已升级为 S4U(无人登录时也照常巡检;已验证弹窗结构上不可能)')
    else if (/register failed|VERIFY FAILED|refusing/i.test(out))
      log('S4U 升级未完成(不阻断守护): ' + out.replace(/\r?\n/g, ' | ').slice(0, 160))
  } catch (e) {
    log('S4U 升级调用失败(不阻断守护): ' + String((e && e.message) || e).slice(0, 160))
  }
}

/** 破坏性覆盖前先归档现场(保留可回溯副本;同一轮只归档一次) */
let ARCHIVED_PATH = null

function archiveGitdir(tag) {
  if (ARCHIVED_PATH) return ARCHIVED_PATH
  // 归档统一落 §15b 唯一备份目录(见 scripts/lib/gitdir.mjs);取不到才退回旧的兄弟命名
  const dst = gitdirArchivePath(`${basename(GITDIR)}.broken-${tag}`) || `${GITDIR}.broken-${tag}`
  try {
    cpSync(GITDIR, dst, { recursive: true, force: true })
    ARCHIVED_PATH = dst
    log(`归档: 现场已备份 -> ${dst}`)
    return dst
  } catch (e) {
    log(`归档失败(放弃破坏性恢复,避免数据不可回溯): ${String(e.message || e)}`)
    return null
  }
}

/**
 * 统一修复阶梯(单例,main 与 daemon 共用):
 *   指针 -> 环境 -> HEAD 语法 -> 备份 -> 远端
 * 任一步成功即止;每次破坏性覆盖前先归档现场。
 */
function remediate(before) {
  if (!before.gitdirOk) {
    const ok = !!(healFromBackup() || healFromRemote())
    // 恢复源是整份 gitdir 副本 ⇒ cpSync 会把它自己的 core.bare 一起带回来,恢复后必须再归一一次
    if (ok && !worktreeUsable()) return healWorktreeBare()
    return ok
  }
  if (!before.pointerOk) healPointer()
  if (!gitUsable()) healEnv()
  if (!gitUsable()) healHead()
  if (!gitUsable()) {
    if (!archiveGitdir(Date.now())) return false
    const ok = !!(healFromBackup() || healFromRemote())
    if (ok && !worktreeUsable()) return healWorktreeBare()
    return ok
  }
  // git 可用 ≠ 工作树可用:core.bare=true 时 rev-parse 成功而每条工作树命令都失败;
  // 放在恢复阶梯之后跑,任何一次 cpSync 恢复带回来的裸档都在这里被归一(活仓库 + 恢复源两侧)
  if (!worktreeUsable()) healWorktreeBare()
  // git 可用 ≠ 健康:宿主会单独清理 depth>=2 的嵌套 ref 目录(见上文事故注释)
  if (!refsOk()) healRefs()
  return true
}

/** 路径同形判定(盘符/分隔符/大小写三处归一化) */
function samePath(a, b) {
  return String(a).replace(/\\/g, '/').toLowerCase() === String(b).replace(/\\/g, '/').toLowerCase()
}

/**
 * `cpSync`/`rmSync` 打在 GITDIR 之前的准入闸(2026-10-16 事故加,勿删):
 *   ① GITDIR 绝不能是工作树里的 `.git` 指针文件本身 —— 那是自指损坏态,往里灌备份 = 删库;
 *   ② GITDIR 存在时必须是目录;是文件 ⇒ 拒绝一切破坏性恢复(先喊人,不自己动手)。
 * 返回 false 时调用方**必须放弃恢复**(保住现场可回溯),不得退而求其次继续写。
 *
 * 事故现场(2026-10-16 00:21):`resolveGitdir()` 当时回退成 `<wt>/.git`,守护判定 gitdir 不健康,
 * 于是每 10 秒 `cpSync(BACKUP, GITDIR)` 一次,25MB 备份内容被灌进 `.git` 指针文件 ⇒
 * `fatal: too large to be a .git file`,整仓不可用。①正是这条链的断口。
 */
/**
 * `gitdirTargetSafe` 的**纯判据层**(§22c:镜像测试直接吃这份,不在测试里复制第二份判据)。
 *
 * 为什么单列:真实现要 stat 本机路径,而这一格的判据本身是"三个输入 ⇒ 一个结论",
 * 把它留在只有 side effect 的函数里,就只能靠"在真仓上把 .git 换成一个大文件"来取证 ——
 * 那台机上每条 git 命令都会失败,而这是一棵**共享工作树**,别人正在提交。
 * 所以形态三态在此判清,现场演练交给人(见 ledger 行 L15556 的残余),不由守护自己制造。
 *
 * @param {{ samePointer?: boolean, exists?: boolean, isDirectory?: boolean }} p
 *   samePointer = GITDIR 解析后与工作树 `.git` 指针文件同路径(自指损坏态);
 *   exists/isDirectory = 对 GITDIR 的 stat 结果投影(读不出来时调用方给 exists:true,isDirectory:false 也不行,
 *   必须走 unreadable 一支)。
 * @returns {{ok:boolean, why:string}} false ⇒ 调用方必须放弃一切破坏性恢复
 */
export function gitdirTargetVerdict({ samePointer = false, exists = false, isDirectory = false, unreadable = false } = {}) {
  if (samePointer)
    return { ok: false, why: 'GITDIR 解析成指针文件自身 —— 自指损坏态,写它等于删库;先修 scripts/lib/gitdir.mjs 的解析,勿在此放行' }
  if (unreadable) return { ok: false, why: 'GITDIR 形态读不出来 ⇒ 不猜它是目录,拒绝恢复(宁可不修,不可误删)' }
  if (exists && !isDirectory) return { ok: false, why: 'GITDIR 已存在却不是目录 ⇒ 先人工确认,勿覆盖' }
  return { ok: true, why: exists && isDirectory ? '已存在且是目录' : '不存在,可安全建目录' }
}

function gitdirTargetSafe() {
  let v
  try {
    const exists = existsSync(GITDIR)
    v = gitdirTargetVerdict({
      samePointer: samePath(GITDIR, POINTER),
      exists,
      isDirectory: exists ? statSync(GITDIR).isDirectory() : false,
    })
  } catch (e) {
    log(`⛔ 拒绝恢复:${gitdirTargetVerdict({ unreadable: true }).why}(${GITDIR}): ${String((e && e.message) || e)}`)
    return false
  }
  if (!v.ok) log(`⛔ 拒绝恢复:${v.why}(${GITDIR})`)
  return v.ok
}

/** 兜底 1:从本地备份恢复实体(快,Gitee 不可达时用) */
function healFromBackup() {
  if (!existsSync(join(BACKUP, 'HEAD'))) return false
  if (!gitdirTargetSafe()) return false
  log('修复: 从本地备份恢复 gitdir <- ' + BACKUP)
  mkdirSync(GITDIR, { recursive: true })
  cpSync(BACKUP, GITDIR, { recursive: true, force: true })
  if (!pointerOk()) healPointer()
  // 备份可能陈旧:补齐远端对象(refs + objects 增量)
  git(['fetch', 'origin', 'main'], true)
  log('恢复后 fetch 增量完成')
  return gitUsable()
}

/** 兜底 2:从远端整仓重建(慢,42 秒实测,保证最新) */
function healFromRemote() {
  log('修复: 从远端重建 gitdir <- ' + GITEE_URL)
  if (!gitdirTargetSafe()) return false
  if (existsSync(GITDIR)) {
    if (!archiveGitdir('remote-' + Date.now())) return false
    try {
      rmSync(GITDIR, { recursive: true, force: true })
    } catch (e) {
      log('清理损坏 gitdir 失败: ' + String(e.message || e))
    }
  }
  git(['init', '--separate-git-dir=' + GITDIR, WORKTREE], true)
  if (!pointerOk()) healPointer()
  const remote = git(['remote', 'get-url', 'origin'], true)
  if (!remote) git(['remote', 'add', 'origin', GITHUB_SSH_URL], true)
  git(['fetch', 'origin', 'main'], true)
  const head = git(['rev-parse', 'FETCH_HEAD'], true)
  if (head) git(['reset', '--mixed', head], true)
  // —— 还原完整远端与仓库配置(2026-09-12 15:30 补齐)——
  // 旧版只设 origin=https,会丢掉部署私钥 sshCommand,
  // 导致「自愈成功后 origin 变成 https」违反 AGENTS.md §5b「严禁改回 https」。
  // 2026-10-23:gitee/gitcode 镜像远端写回已删除(弃用仓,不得由自愈复活)。
  restoreRemoteConfig()
  git(['config', 'core.hooksPath', '.husky'], true)
  git(['config', 'gc.auto', '0'], true)
  git(['config', 'gc.autodetach', 'false'], true)
  git(['config', 'maintenance.auto', 'false'], true)
  return gitUsable()
}

/**
 * 把 origin(GitHub SSH)+ 部署私钥 sshCommand 写回仓库配置。
 * 幂等:已存在则 set-url,不存在才 add。用于远端重建后的配置收口。
 * 2026-10-23:只收口 origin 一个远端 —— gitee/gitcode 镜像已弃用,写回它们等于每次
 * 自愈都重新制造两条指向死镜像的远端(见本文件 GITEE_URL/GITCODE_URL 删除处的说明)。
 */
function restoreRemoteConfig() {
  git(['remote', 'set-url', 'origin', GITHUB_SSH_URL], true)
  if (!git(['remote', 'get-url', 'origin'], true))
    git(['remote', 'add', 'origin', GITHUB_SSH_URL], true)
  git(['config', 'core.sshCommand', SSH_COMMAND], true)
}

function status() {
  syncGitMeta()
  // 一次取材,三处共用(refsOk / refsReason / 计数),不得在同一轮里对同一把尺子问两遍拿两个答案
  const rv = refsVerdict()
  const health = {
    pointerOk: pointerOk(),
    gitdirOk: gitdirOk(),
    gitUsable: gitUsable(),
    // 与 gitUsable 分开的第二把尺子:裸档(config.core.bare=true)下 rev-parse 照样成功,
    // 而工作树里每条 git 命令都失败 —— 只看 gitUsable 会把"仓库不可用"报成"一切正常"。
    worktreeUsable: worktreeUsable(),
    gitBin: GIT_BIN,
    gitVersion: GIT_VERSION,
    head: git(['rev-parse', '--short', 'HEAD'], true),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], true),
    dirty: (git(['status', '--porcelain'], true) || '').split('\n').filter(Boolean).length,
    backupOk: existsSync(join(BACKUP, 'HEAD')),
    refsOk: rv.ok,
    // refs 这一维的"为什么"必须与 ok 同时报出:`missing: []` 在旧实现里既可能是"全部在位",
    // 也可能是"清单为空、根本没判"——只报 ok 就等于把后者写成前者(2026-10-05 实测的正是后者)。
    refsReason: rv.reason,
    refsManifestCount: rv.manifestCount,
    refsNestedVisible: rv.visibleNestedCount,
    refsMissing: missingRefs(),
    // 通知层状态如实进 --status:"已配置/无收件人/上次投递失败"必须能被人工核验,
    // 否则"接线了"只是纸面结论(只读三个小文件,零副作用,--check 口径不变)
    notify: notifySummary(),
    // core.bare 翻车现场审计的最近一份件名(null = 还没有件;含义与"没翻过"不同 ——
    // 该维自 BARE_AUDIT_SINCE 起才在位,逐条原因跑 --bare-audit-report 看)
    bareAudit: latestBareFlipAuditFile().file,
  }
  return health
}

/** 异常行描述(含 HEAD / refs 提示),main 与 daemon 共用 */
function anomalyLine(h) {
  const hint =
    h.pointerOk && h.gitdirOk && !h.gitUsable
      ? ` | HEAD=${JSON.stringify(headContent().slice(0, 60))}`
      : ''
  // refs 不健康的三种成因必须分开点名:"缺 N 个"(有清单、对不上)与"根本没清单"(未 bootstrap)
  // 处置动作完全不同 —— 后者靠学习补齐,前者靠离线重建,写成一句话会让人去查一个不存在的洞。
  const refsHint =
    h.refsOk === false
      ? h.refsReason === 'unbootstrapped'
        ? ` | 嵌套 ref 清单未 bootstrap(盘上 ${h.refsNestedVisible || 0} 个 depth>=2 引用无人看守,本轮离线学习)`
        : h.refsReason === 'undetermined'
          ? ' | 嵌套 ref 清单取不到(未判定,不得记为通过)'
          : h.refsReason === 'face-unreadable'
            ? ' | 嵌套 ref 面取不到(未判定:for-each-ref 未产出,本轮不重建、不报缺失数)'
            : ` | 缺失嵌套 ref ${(h.refsMissing || []).length} 个`
      : ''
  // 单独点名"裸档"这一型:它让其余四项全绿,却是唯一让全队 git 命令失效的那一格
  const bareHint = h.gitUsable && h.worktreeUsable === false ? ' | core.bare=true(工作树不可用)' : ''
  return `⚠️ 检测到 .git 异常: pointer=${h.pointerOk} gitdir=${h.gitdirOk} git=${h.gitUsable} worktree=${h.worktreeUsable}${hint}${refsHint}${bareHint}`
}

// —— 计划任务必须跑在非交互会话(2026-09-22 立「任务漂移自检」,2026-09-23 换 S4U 根治) ——
// 本守护自己就是「弹窗」的高频嫌疑:它以独立进程跑,而计划任务若注册成 InteractiveToken +
// 直跑控制台程序(node.exe)时 Windows 会显示控制台 → 用户桌面每 2 分钟闪一扇黑窗
// (2026-09-20 实测踩坑;2026-09-22 复发:安装器早已修对,但活任务仍是直跑 node.exe 的旧版,
// 没人重注册)。因此除 --install 外,常规巡检也核对活任务的 LogonType,漂移即自动重注册,不靠人记。
// 2026-09-23 起形态改为 S4U(见 registerTask):任务跑在 session 0,没有桌面,弹窗这件事
// 从"每个派生点都要记得隐藏"变成"结构上不可能"。

function registerTask() {
  // 2026-09-23:改注 S4U 非交互任务(session 0,无桌面)取代 InteractiveToken + wscript/VBS。
  // 旧链路靠 SW_HIDE,一旦 Windows Terminal 委托回来(AGENTS.md §5b 记的 09-18 事故)或那个
  // ASCII-only 的 .vbs 被删/被写入非 ASCII 文本(会弹 WSH 错误框),这层保护就连同我们最关键的
  // .git 存续守护一起失效。S4U 是结构性的:无论任务里跑什么程序都开不出窗口。
  const ps = [
    `$action = New-ScheduledTaskAction -Execute '${process.execPath.replace(/'/g, "''")}' -Argument '"${join(WORKTREE, 'scripts', 'git-guardian.mjs').replace(/'/g, "''")}"'`,
    `$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650)`,
    `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)`,
    `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited`,
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null`,
    `$p = (Get-ScheduledTask -TaskName '${TASK_NAME}').Principal`,
    `Write-Output ('LOGON=' + $p.LogonType)`,
  ].join('\n')
  let out = ''
  try {
    out = execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 90_000,
    })
  } catch (e) {
    log(`注册任务计划失败(需管理员权限?): ${String(e.message || e).slice(0, 300)}`)
    return false
  }
  if (!/LOGON=S4U/.test(out)) {
    log(`注册后回读 LogonType 非 S4U,拒绝当成成功:${out.trim().split('\n').slice(-3).join(' | ')}`)
    return false
  }
  log(`已注册任务计划 "${TASK_NAME}"(每 2 分钟自检,LogonType=S4U → session 0,结构上无弹窗)`)
  return true
}

/**
 * 活任务形态判定 —— 2026-09-23 首立,2026-10-25 换主通道(判定口径不动)。
 *
 * 判定口径仍只有一份(`lib/schtasks-form.mjs`):承认**两种合法形态** ——
 *   · S4U(session 0,结构上开不出窗口)—— 首选;
 *   · InteractiveToken + wscript + 我们的 ASCII .vbs —— 回退形态,同样无弹窗,不是漂移。
 * 只有"InteractiveToken 且直跑 node.exe"(必闪黑窗)或任务消失才叫漂移。拿不到数据一律 unknown,
 * 绝不在信息不足时改动任务(§5b 的"宁可不动也不误动")。
 *
 * 2026-10-25 换"怎么读":本机安全策略把 `schtasks.exe` 列入黑名单(与
 * `check-c-drive-pollution.mjs` 同一起事故),而守护是每 2 分钟一 tick 的常驻体 —— 在这里
 * spawn 一个被策略拦的可执行文件,失败形态不是"报错",而是把守护一起带走。计划任务的存在性
 * 与形态改由 PowerShell 的 `Get-ScheduledTask` / `Export-ScheduledTask` 读(同一份任务存储,
 * 只是不碰那个 exe);`schtasks.exe` 降为**默认关**的兜底通道。
 * @returns {'ok'|'ok-vbs'|'missing'|'drift'|'unknown'}
 */
/** schtasks.exe 兜底通道(**默认关**,理由见 taskForm 头注):黑名单机器上 spawn 它会把守护本身带走。 */
const ALLOW_SCHTASKS_EXE = process.env.IHUI_ALLOW_SCHTASKS_EXE === '1'

/** 跑一段 PowerShell,拿不到(解释器不在位/报错/超时/空输出)一律返回 null ⇒ 调用方落 unknown。 */
function runPs(script, { timeoutMs = 30_000, encoding = 'utf8' } = {}) {
  const bin = pickPowerShell()?.bin
  if (!bin) return null
  try {
    const out = execFileSync(bin, ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1 << 24,
    })
    const s = String(out || '').replace(/\0/g, '')
    return s.trim() ? s : null
  } catch {
    return null
  }
}

/** 一次 PowerShell 调用同时回答"在不在"与"形态 XML":守护每 2 分钟一轮,两次冷启动 PS
 *  会把一轮巡检拖长。取不到 ⇒ null(调用方落 unknown);cmdlet 不在位 ⇒ 也 null,
 *  **不得**借此判"任务不存在"(查法失效与产物为空必须分家)。 */
function psTaskProbe() {
  return runPs(
    [
      `if ($null -eq (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {`,
      `  ''`, // cmdlet 不在位 ⇒ **不得**借此判"任务不存在"(查法失效与产物为空必须分家)
      `} else {`,
      `  $t = @(Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue)`,
      `  if ($t.Count -eq 0) { '__MISSING__' } else { ($t[0] | Export-ScheduledTask) -join "\`n" }`,
      `}`,
    ].join('\n'),
  )
}

function taskForm() {
  const flat = (buf) => String(buf || '').replace(/\0/g, '')
  // 主通道:PowerShell(Get-ScheduledTask 读的是同一份任务存储,只是不碰黑名单里的那个 exe)。
  const probe = psTaskProbe()
  if (probe) return probe.trim() === '__MISSING__' ? 'missing' : judgeTaskForm(probe)
  // 兜底通道:schtasks.exe(**默认关** —— 黑名单机器上 spawn 它会把守护本身杀掉);
  // 形态判据一律是 lib/schtasks-form.mjs 那一份,两通道不得各写一版。
  if (!ALLOW_SCHTASKS_EXE) return 'unknown'
  let csv
  try {
    csv = flat(
      execFileSync('schtasks.exe', ['/Query', '/FO', 'CSV', '/NH'], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1 << 24,
      }),
    )
  } catch {
    return 'unknown' // schtasks 本身不可用 ⇒ 不下判断
  }
  if (!csv.includes(TASK_NAME)) return 'missing'
  let xml
  try {
    xml = flat(
      execFileSync('schtasks.exe', ['/Query', '/TN', TASK_NAME, '/XML'], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: 30_000,
        encoding: 'buffer',
      }),
    )
  } catch {
    return 'unknown'
  }
  if (!xml.includes('<Task')) return 'unknown'
  return judgeTaskForm(xml)
}

/** 活任务形态是否可接受(供巡检调用;unknown 一律视为可接受,不在信息不足时改动任务) */
function taskActionOk() {
  return taskFormAcceptable(taskForm())
}

/**
 * 把"探针跑出了结论"与"探针没跑起来"分成三态,退出码**不参与**前者判定:
 *  ① stdout 是可解析对象 ⇒ 采用结论,哪怕 rc=1;
 *  ② stdout 为空 ⇒ 未判定,并点名 rc 与 stderr;
 *  ③ stdout 有内容但不是 JSON / 顶层不是对象 ⇒ 未判定,同样点名 rc。
 *
 * 为什么 rc=1 必须走①:探针轴①②判红时 `process.exit(1)`,而结论整份在 stdout 的 JSON 里。
 * 旧实现只有成功分支能拿到 stdout(execFileSync 在非零退出时抛异常),于是守护每每逢它说出
 * 最响的一条结论,就把整块扔掉、并往日志写"账不可用:未判定"。实测(2026-09-27 现读):
 * 便宜档 rc=1 + stdout 1530 B 合法 JSON,其中 `upstream.status='red'`/`behind=3` ——
 * "本地落后主线 3 个提交"这条信号被这台守护结构上看不见,而它正是值守最该先看的一维。
 * 失效方向照旧是"多写一行未判定",绝不是"顺手当它绿了"。
 */
export function readProbeVerdict({ status, stdout, stderr } = {}) {
  const text = String(stdout ?? '')
  const rc = status ?? '?'
  if (text.trim() === '') {
    const errText = String(stderr ?? '')
      .replace(/\s+/g, ' ')
      .slice(0, 240)
    return { parsed: null, why: `探针未产出 stdout(rc=${rc} stderr=${errText || '(空)'})` }
  }
  try {
    const raw = JSON.parse(text)
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { parsed: raw, why: null }
    return { parsed: null, why: `stdout 顶层不是对象(rc=${rc})` }
  } catch (e) {
    return {
      parsed: null,
      why: `输出不是 JSON(rc=${rc}):${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 120)}`,
    }
  }
}

/**
 * 开工前基线新鲜度的**只报数**账(机制规格 MECHANISM-SPEC-2 §2 的守护侧挂点)。
 *
 * 三条刻意:
 *  ① **只 log 数字,不 notifyGuardRed、不改任何退出码、不改自愈语义。** ③轴(共享工作树相对 HEAD
 *     的漂移)量的是并行会话的未提交状态,**提交者结构上无法满足**;把它接进任何判定面就等于
 *     让每一次提交恒红 ⇒ 逼人 --no-verify ⇒ 全部守门作废(§12e/§4 反复登记的那一型)。
 *  ② 祖先比对是**逐文件 `git log`**(实测 56 个漂移路径约 8s),而本守护每 2 分钟一趟 ⇒ 不节流
 *     就是一台自造 fork 风暴的机器(§5b 的 24.6 万 cmd/2min 同型)。故 30 分钟才跑一次全账,
 *     间隔内走 `--skip-drift-analysis` 的便宜账(漂移面计数照报,旧基线子集不比对)。
 *  ③ 挂点在**健康轮次的早退之前**、且带 `!CHECK_ONLY`(写节流戳是副作用)。本仓已两次踩过
 *     "挂错位置 = 永不执行"(工作区自愈层、盘根封口层各一次)。
 */
function reportBaselineFreshness() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-baseline-freshness.mjs')
  if (!existsSync(script)) return
  const stampFile = join(dirname(LOG), 'baseline-freshness-stamp')
  const THROTTLE_MS = 30 * 60 * 1000
  let lastRun = 0
  try {
    lastRun = Number(readFileSync(stampFile, 'utf8').trim()) || 0
  } catch {
    lastRun = 0
  }
  const full = Date.now() - lastRun > THROTTLE_MS
  const args = ['--json', '--no-fetch']
  if (!full) args.push('--skip-drift-analysis')
  let parsed = null
  let why = null
  {
    let status = null
    let stdout = ''
    let stderr = ''
    try {
      stdout = String(
        execFileSync(process.execPath, [script, ...args], {
          cwd: WORKTREE,
          encoding: 'utf8',
          windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
          timeout: 240000, // 守门 80:热路径派生一律带上限
          stdio: ['ignore', 'pipe', 'pipe'],
        }) ?? '',
      )
      status = 0
    } catch (e) {
      // 非零退出**不是**"探针坏了":判红就 exit 1。把 stdout/stderr/status 全部取回来交给
      // readProbeVerdict 分三态,不得在此直接判定为未判定(成因见该函数头注与 §5e)。
      status = typeof e?.status === 'number' ? e.status : null
      stdout = String(e?.stdout ?? '')
      stderr = String(e?.stderr ?? '')
    }
    const v = readProbeVerdict({ status, stdout, stderr })
    parsed = v.parsed
    why = v.why
  }
  if (!parsed) {
    // 判据自己跑不动 ≠ 基线过期;也 ≠ 可以静默。留一行,免得"账没了"和"账绿了"长得一样。
    // 原因必须上账:stderr 曾被 stdio 第三项 'ignore' 整条丢掉,这条"未判定"连续两天无人能答为什么。
    log(`⚠️ 基线新鲜度账不可用:未判定 —— ${why ?? '原因未取到'},不影响自愈与退出码`)
    return
  }
  if (full) {
    try {
      mkdirSync(dirname(stampFile), { recursive: true })
      writeFileSync(stampFile, String(Date.now()))
    } catch {
      /* 节流戳写失败只意味着下次多跑一遍全账,不影响判定 */
    }
  }
  const a = parsed.axes || {}
  const d = a.drift || {}
  const up = a.upstream || {}
  const mn = a.main || {}
  // 只在"有东西可看"时写行:全绿且零漂移的日子保持安静(健康时不写行是本日志的既有约定)。
  const parts = [
    `①${up.status ?? '?'}${typeof up.behind === 'number' ? `(落后 ${up.behind})` : ''}`,
    `②${mn.status ?? '?'}${typeof mn.behind === 'number' ? `(落后 ${mn.behind}/独有 ${mn.own})` : ''}`,
    `③漂移面 ${d.total ?? '?'} 个路径(源码类 ${d.sourceClass ?? '?'})`,
  ]
  if (full)
    parts.push(
      `旧基线 ${d.stale ?? '?'} 个${
        d.oldest ? `(最旧 ${d.oldest.commit}${typeof d.oldest.span === 'number' ? ` 落后 ${d.oldest.span} 次` : ''})` : ''
      }`,
    )
  const noteworthy =
    (d.total ?? 0) > 0 ||
    up.status === 'red' ||
    mn.status === 'red' ||
    (d.stale ?? 0) > 0 ||
    up.status === 'undetermined' ||
    mn.status === 'undetermined'
  if (noteworthy) log(`ℹ️ 基线新鲜度(只报数,不进提交链)${full ? '全账' : '便宜账'}:${parts.join(';')}`)
}

/**
 * 提交窗口期静默(2026-10-22 立,机主要求"提交稳定在 1 分钟内")。
 *
 * 病灶:本守护由 2 分钟计划任务驱动,每轮派生 `git status` / `diff` / `for-each-ref`,
 * 与提交链抢 CPU 与索引锁。实测**同一份守门代码**耗时在 40s / 69s / 166s / 63.8s 间波动,
 * 波动源就是它 —— 而 `schtasks` 在安全黑名单里停不掉,所以让守护**自己**让路。
 *
 * 判据用既有的 `.git/ihui-git-write.lock`(safe-commit 全程持有),不引入新协调机制:
 *   - 锁不存在            ⇒ 不在窗口期,正常巡检
 *   - 锁存在且持有 PID 活着 ⇒ 在窗口期,本轮静默(跳过,不报错)
 *   - 锁存在但 PID 已死    ⇒ stale 锁,**不**静默(否则一次崩溃能让守护永久闭嘴)
 *   - 读不出 pid / 任何异常 ⇒ 保守当作窗口期,代价只是少跑一轮巡检
 */
function inCommitWindow() {
  try {
    const dotGit = join(process.cwd(), '.git')
    let gitDir = dotGit
    if (!statSync(dotGit).isDirectory()) {
      const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m)
      if (m && m[1]) gitDir = m[1].trim()
    }
    const lock = join(gitDir, 'ihui-git-write.lock')
    if (!existsSync(lock)) return false
    const m = readFileSync(lock, 'utf8').match(/pid=(\d+)/)
    if (!m) return true
    try {
      process.kill(Number(m[1]), 0)
      return true
    } catch {
      return false
    }
  } catch {
    return false // 失效方向是"多跑一轮巡检",不是"漏检一轮"
  }
}

function main() {
  // 提交窗口期静默(2026-10-22):safe-commit 持写锁期间不做巡检,把 CPU 与索引锁全让给提交链。
  if (inCommitWindow()) {
    log('提交窗口期(检测到 git 写锁且持有者存活)⇒ 本轮巡检静默,下轮再来')
    return
  }
  // 通知层人工核验入口(先于 INSTALL):只"真发一次/只问通道齐备",不参与自愈。
  // --notify-test 绕过当轮去重(force),否则"想核验的人"会被上一条同因告警的窗口挡住,
  // 得到一次假阴性;--notify-dry-run 零网络请求、不占收件人。
  const notifyTestAt = process.argv.indexOf('--notify-test')
  if (notifyTestAt >= 0) {
    const label = String(process.argv[notifyTestAt + 1] || '').trim() || 'manual'
    const r = notifyGuardRed(`通知链路自测(${label})`, '这是一条通道自测消息(非故障)。用于验证 git-guardian 唯一到人通道(邮件)是否真能落地。', {
      severity: 'info',
      force: true,
    })
    console.log(`--notify-test: sent=${r.sent} ${r.why}`)
    return r.sent ? 0 : 1
  }
  if (process.argv.includes('--bare-audit-report')) {
    // 只读问责入口:列"每次翻车 + 各自嫌疑人",不派生 PowerShell、不写任何件
    return bareAuditReportMain(process.argv.includes('--json'))
  }
  if (process.argv.includes('--notify-dry-run')) {
    const r = dispatchGuardMail({
      title: '【git-guardian】邮件通道演练(dry-run)',
      desp: '这是一条 dry-run 演练正文,未实际发送。\n第二行用于验证多行中文经文件通道原样送达。',
      severity: 'warning',
      dryRun: true,
    })
    console.log(`邮件通道(dry-run): ok=${r.ok} ${r.why}`)
    return r.ok ? 0 : 1
  }
  if (INSTALL) {
    // 必须注册 wscript 包装而非 node.exe 本身:计划任务以 InteractiveToken 直接执行控制台程序
    // (node.exe)时 Windows 会显示控制台 → 用户桌面每 2 分钟闪一扇黑窗(2026-09-20 实测踩坑)。
    // 与本仓库既有任务(DevProcessCleanup / KillGitSelector)保持同一隐藏启动约定。
    const vbs = join(WORKTREE, 'scripts', 'git-guardian-hidden.vbs')
    if (!existsSync(vbs)) {
      log(`注册失败:找不到隐藏启动包装 ${vbs}(勿改成直接执行 node.exe)`)
      return 1
    }
    // 注册前预检:让包装器真跑一次并看退出码。cscript/wscript 按 ANSI 代码页解码 .vbs,
    // 中文注释会被错切成伪引号导致**编译期**语法错(2026-09-20 实测踩过),而 wscript 下
    // 该错误会弹 "Windows Script Host" 对话框且 schtasks 仍报成功 —— 只能靠这一步拦下。
    let pre
    try {
      pre = execFileSync('cscript.exe', ['//nologo', vbs], {
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        // （`pre` 要被下面的 /error/i 预检吃，stdout 丢不得 ⇒ 只把 stdin 断开）
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60_000,
      })
    } catch (e) {
      log(
        `注册失败:git-guardian-hidden.vbs 预检未通过,勿注册坏包装器\n${e.stdout || ''}${e.stderr || e.message}`,
      )
      return 1
    }
    if (pre && /error/i.test(pre)) {
      log(`注册失败:git-guardian-hidden.vbs 预检报错\n${pre}`)
      return 1
    }
    const tr = `wscript.exe "${vbs}"`
    try {
      execFileSync(
        'schtasks',
        ['/create', '/tn', TASK_NAME, '/tr', tr, '/sc', 'minute', '/mo', '2', '/f'],
        {
          stdio: 'inherit',
          windowsHide: true,
        },
      )
      log(`已注册任务计划 "${TASK_NAME}"(每 2 分钟自检,经 git-guardian-hidden.vbs 静默启动)`)
      // 注册器只能造出 InteractiveToken(schtasks 的 /NP 会索要密码),故紧接着升 S4U,
      // 否则"新机器/重装后"又回到无人登录即停跑的状态。
      ensureS4u()
    } catch (e) {
      log('注册任务计划失败(需管理员权限): ' + String(e.message || e))
      process.exit(1)
    }
    return 0
    return registerTask() ? 0 : 1
  }

  const before = status()
  if (STATUS_ONLY) {
    console.log(JSON.stringify(before, null, 1))
    return 0
  }

  // 任务漂移自检(2026-09-22 立):活任务曾被改回直跑 node.exe → Interactive 会话每 2 分钟
  // 闪一扇可见黑窗。安装器是对的,但任务层没人兜底;常规巡检顺手核对,漂移即静默重注册。
  // --check(CI 口径)不产生副作用;预检派生的子巡检跳过,防递归。
  if (!CHECK_ONLY && !taskActionOk()) {
    log(
      `⚠️ 计划任务形态漂移(实测形态=${taskForm()}:InteractiveToken 直跑 node.exe 会闪黑窗),自动重注册`,
    )
    registerTask()
  }

  const coreOk = coreHealthy(before)
  if (coreOk && before.refsOk) {
    // `.git` 与嵌套 ref 都健康 ≠ 工作区健康:宿主会成批删除工作区里的已跟踪文件
    // (实测同日三轮 137→27→1)。计划任务跑的是本单轮路径(startDaemon 未启用),
    // 健康轮次的早退之前是唯一能挂工作区自愈的位置 —— 不在此处就永远不执行。
    // --check 保持零副作用(CI 口径);真巡检才动手,且只在真恢复/发现他人删除时写日志。
    if (!CHECK_ONLY) healWorktreeTracked()
    // 「完成即删」兜底清扫(2026-10-22 调度加固):原挂在 5386,但它后面的公网探测/隧道健康/
    // 服务自愈等长任务会让整轮在前段结束 —— 实测清扫心跳停在 09:02、已勾行滞留到 10:40 无人清。
    // 本层自带 30 分钟节流,提前到工作区自愈之后不会放大写入频率;判据仍 import 门 229(单一实现)。
    if (!CHECK_ONLY) sweepStaleClosedRows()
    // 盘根封口同理:重启会清掉 junction,而第三方重建真目录只需要一次启动。
    if (!CHECK_ONLY) healRootSeal()
    // §26 家目录改道同理:改道树被清掉后工具会立刻在 C 盘重建实体目录,而门 96 是 blocking
    // ⇒ 不自动补回就等于逼每一次提交绕过全部守门。
    if (!CHECK_ONLY) healHomeJunctions()
    // 合并吞并对账:别人机器上造好推来的合并跑不到提交链那道门(commit-tree 旁路不跑钩子),
    // 由本层按增量台账判到一次(只判不修)。
    if (!CHECK_ONLY) auditMergeAdditionLoss()
    // 主机时区漂移问责:必须与上面同格(健康轮次早退之前 + !CHECK_ONLY)—— 挂进 CHECK_ONLY 路径
    // 等于永不执行,本文件已踩过两次(工作区自愈层、根封口层)。
    if (!CHECK_ONLY) auditHostTimezone()
    // 盘根卫生巡检(G 盘清理收口 2026-09-30):同一挂点语义 —— 健康轮次早退之前 + !CHECK_ONLY。
    if (!CHECK_ONLY) auditDiskRootHygiene()
    // 开工前基线新鲜度:只报数的一层(③轴绝不进提交链,故这里既不判红也不喊人)。
    if (!CHECK_ONLY) reportBaselineFreshness()
    // §5b 的"唯一空白层":恢复源刷新原本挂在计划任务上,而那个任务已实测消失 ⇒ 并入 tick。
    if (!CHECK_ONLY) refreshRecoverySource()
    // 运行日志保留期回收(对标 ZCode logRetention):同一挂点语义 —— 挂进 CHECK_ONLY 分支等于永不执行。
    if (!CHECK_ONLY) rotateRunLogs()
    // 受管 .env 的"键值被悄悄清空"巡检 + 到人(G-223 第三格):判机器状态,所以绝不进提交链;
    // 挂点与 heal*/refreshRecoverySource 同一分支 —— 挂进 CHECK_ONLY 早退路径等于永不执行。
    if (!CHECK_ONLY) auditEnvDrift()
    // 家宽公网出口 IPv4 ↔ EdgeOne 源站期望巡检(2026-10-21 立):同一挂点语义 —— 判机器状态、
    // 绝不进提交链(§12e);EdgeOne 直填的源站地址一变即全公网 5xx,这一格是本仓唯一的眼睛。
    if (!CHECK_ONLY) auditEgressIpDrift()
    // 生产签出外来工作巡检(2026-10-21 立):生产 checkout(独立签出,nssm 现读实跑路径)里的
    // 工作区 blob 不在任何提交链/CI 取材面上,一次 checkout/reset 就静默蒸发。同一挂点语义 ——
    // 判机器状态绝不进提交链(§12e);挂进 CHECK_ONLY 早退分支等于永不执行。
    if (!CHECK_ONLY) auditProdForeignWork()
    // 收敛器收尾对齐停摆喊人(票 O74):收敛器一次性进程只写状态,派发点在此(与
    // heal*/watchWatchdog 同一真正会执行的分支;挂进 CHECK_ONLY 早退分支等于永不执行)。
    if (!CHECK_ONLY) checkConvergeAlignStall()
    // 元运维巡检(尺子 = scripts/check-ops-patrol.mjs):判"没发生"的那一族。它按设计不能进提交链
    // (判机器状态 ⇒ 恒红 ⇒ 每台每次 --no-verify),而本行就是它唯一的调度器。
    if (!CHECK_ONLY) auditOpsPatrol()
    // 巡检**自己**也要有人看(2026-10-17 立):上面那行派发它,而它一旦停摆,账面没有任何一格会红
    // —— 它判的是"别的任务没在跑", "它自己没在跑"没有任何判据。挂点与上面各层同格(健康轮次
    // 早退之前 + !CHECK_ONLY),读它每轮落的 ops-patrol-last.json,超 3 期未更新即就地起跳一轮。
    if (!CHECK_ONLY) watchPatrolHeartbeat()
    // 不响应服务的自愈(三层方案第三层,台账 G-978121):nssm 包装的服务 SCM 看不死,
    // 这一层是"进程在但端口不应答 / 子进程起不来"唯一的动作器。节流与发信见函数头注。
    if (!CHECK_ONLY) healUnresponsiveServices()
    // 公网路径与换流窗口的常驻探测(票 G-301):两条序列互不顶账,节流 30 分钟,
    // 判"未判定"只写日志不喊人;它不改本守护退出码 —— 探测失败不等于 .git 失败。
    if (!CHECK_ONLY) auditPublicPathProbe()
    if (!CHECK_ONLY) auditTunnelLegHealth()
    // 「完成即删」兜底清扫已提前到 healWorktreeTracked 之后(2026-10-22 调度加固,见该处注释):
    // 挂在这一长串探测之后实测整轮到不了,清扫心跳会长期停摆。
    // 超龄认领牌代摘(与上一层同节律):提交链上的门绝不代摘任何人的认领,所以死牌只能由这一层清。
    // 正在干活的席位会续租 ⇒ 天然落在射程外;裸标记由器物自己按 CL4 同批依据代摘。
    if (!CHECK_ONLY) sweepStaleClaimMarks()
    // 清扫背离巡检(2026-10-23 立,机主令"要"):上面两把清扫器的节流台账都在动、摘除留痕
    // 却静默 > 2h 且 HEAD 面还有本轮真会动手的可清存量 ⇒ 器物在仓、派发点在、就是干不成活
    // (10-22 护栏③整批让路 / 10-23 摘除不写留痕,两度实证)。只读探针,不改退出码、不喊人
    // (§12e);挂在两族 tick 刚刷新的这一轮之后,同轮即可验证健康。自带 30 分钟节流。
    if (!CHECK_ONLY) auditSweeperLiveness()
    // index 烂尾哨兵(2026-10-24 立,尺子 = scripts/check-index-unmerged-age.mjs):stash pop
    // 冲突/merge 中断逃逸会让 index 挂 unmerged 条目数小时(实测 12h)。同一挂点语义 ——
    // 判机器状态绝不进提交链(§12e);挂进 CHECK_ONLY 早退分支等于永不执行。15 分钟节流。
    if (!CHECK_ONLY) auditIndexUnmerged()
    if (!CHECK_ONLY) auditTunnelMetrics()
    // 部署停摆:判据写 45 分钟阈值,而凭据巡检那支班每 6 小时才量一趟(现读 09:37/15:37)⇒ 阈值与
    // 节律差两个数量级等于没有判据。本格按 15 分钟量,身份 = tip + 最近一次成功部署时刻。
    if (!CHECK_ONLY) auditDeployStall()
    // 不能进提交链,而"手动问责"等于只有人在跑 —— 本行是它唯一的调度器。挂进 CHECK_ONLY 分支等于永不执行。
    if (!CHECK_ONLY) auditOrphanDeletionRefs()
    // 迁移账本「中间缺口」:drizzle 只按 when>max 应用,晚到的旧 when 会被永久跳过且 migrate exit 0
    // (实测 chat_collab 生产缺建表、部署只报档位)。尺子 = check-db-migration-gaps.mjs;30min 节流。
    if (!CHECK_ONLY) auditMigrationGaps()
    // TEMP 夹具清扫器同理:判据/保护面/镜像测试全在,唯独没人调度 ⇒ 本项目命名的残留过完账龄就永久留着。
    // 节流 24h、失败只写 ⚠️ 不改本守护退出码(它是动作层不是判据),挂点语义与上面各层同格。
    if (!CHECK_ONLY) scrubTempFixtures()
    // 活 TEMP 落点回潮哨兵(尺子 = check-temp-landing.mjs)。那份尺子的文件头早就写着"唯一调度器
    // = 本文件的 auditTempLanding()",而那个函数**从来不存在** —— 判据齐全却无人在调度,
    // 失效形态是安静。与 scrubTempFixtures 同格(健康轮次早退之前 + !CHECK_ONLY),节流 24h。
    if (!CHECK_ONLY) auditTempLanding()
    // 看门人也要有人看:凭据/停摆巡检靠 schtasks 每 6 小时自跑,任务被删/被停/node 路径
    // 看门人也要有人看:凭据/停摆巡检靠 schtasks 每 6 小时自跑,任务被删/被停/node 路径
    // 失效时它**自己不会喊**(故障形态是"安静",正是今天两天冻结的同类)。本守护每 2 分钟
    // 一趟且自身分层自愈,由它盯心跳最省。--check 仍零副作用。
    if (!CHECK_ONLY) watchWatchdog()
    // 幂等确保自身是 S4U(已是则内部秒退,不重建任务、不产生抖动)
    if (!CHECK_ONLY) ensureS4u()
    if (CHECK_ONLY)
      console.log('✅ .git 健康(pointer + gitdir + git 可用 + 工作树可用 + 嵌套 ref 完整)')
    return 0
  }

  if (!coreOk) log(anomalyLine(before))
  if (CHECK_ONLY) {
    console.log(
      coreOk
        ? before.refsReason === 'unbootstrapped'
          ? `❌ 嵌套 ref 清单未 bootstrap(未修复,--check 模式):盘上 ${before.refsNestedVisible || 0} 个 depth>=2 引用无人看守 —— 跑 node scripts/git-refs-heal.mjs 离线补齐`
          : before.refsReason === 'undetermined'
            ? '❌ 嵌套 ref 清单取不到(未判定,--check 模式不得记为通过)'
            : before.refsReason === 'face-unreadable'
              ? '❌ 嵌套 ref 面取不到(for-each-ref 未产出 ⇒ 未判定;本轮不报"缺失 N 个",也不按清单重建)'
              : `❌ 嵌套 ref 异常(未修复,--check 模式):${(before.refsMissing || []).length} 个缺失`
        : '❌ .git 异常(未修复,--check 模式)',
    )
    return 1
  }

  // 分层自愈:指针 -> 环境 -> HEAD 语法 -> refs -> 备份 -> 远端
  remediate(before)

  const after = status()
  const ok =
    after.pointerOk && after.gitdirOk && after.gitUsable && after.refsOk && after.worktreeUsable
  log(ok ? `✅ 自愈成功(HEAD=${after.head})` : '❌ 自愈失败,需人工介入')
  return ok ? 0 : 1
}

/** 常驻守护模式:需自备托管(nssm/服务/计划任务);本机实际用的是 `--install` 注册的计划任务(每 2 分钟),此模式未启用 */
function startDaemon() {
  const intervalMs = Number(process.env.GIT_GUARDIAN_INTERVAL_MS || 10000)
  syncGitMeta()
  const bin = GIT_BIN
  log(`守护模式启动(间隔 ${intervalMs}ms) — 监控 ${POINTER} + ${GITDIR}`)
  log(`git=${bin || '(未找到!)'} ${GIT_VERSION || ''} safe.directory=* (每次调用显式传入)`)
  log(`嵌套 ref 存续守护: 清单 ${REFS_MANIFEST}(缺失即离线重建 + packed-refs 固化)`)
  const tick = () => {
    // 提交窗口期静默(2026-10-22,与 main() 同一判据 inCommitWindow):
    // daemon 常驻时同样要在提交链跑的时候让路,否则它每轮派生的 git 派生会与提交抢锁。
    if (inCommitWindow()) {
      log('daemon:提交窗口期 ⇒ 本轮巡检静默')
      setTimeout(tick, intervalMs)
      return
    }
    try {
      const h = status()
      const coreOk = coreHealthy(h)
      if (!coreOk) {
        log(anomalyLine(h))
        remediate(h)
        const a = status()
        log(
          coreHealthy(a) && a.refsOk ? `✅ 自愈成功(HEAD=${a.head})` : '❌ 自愈失败,需人工介入',
        )
      } else if (!h.refsOk) {
        // 核心健康但嵌套 ref 被宿主清理(实测高频) → 离线重建, 不打扰人
        log(
          h.refsReason === 'face-unreadable'
            ? '⚠️ 嵌套 ref 面取不到(for-each-ref 未产出)⇒ 本轮判「未判定」,不按清单重建(把读不到当被删了治会撒数千枚松散 ref)'
            : `⚠️ 检测到嵌套 ref 缺失 ${(h.refsMissing || []).length} 个: ${(h.refsMissing || []).join(', ')}`,
        )
        healRefs()
      } else {
        // 核心与 ref 都健康时,才轮到工作区存续性(宿主成批删工作区文件,实测高频)
        healWorktreeTracked()
        // 以及盘根封口(重启清掉 junction 后的 2 分钟内自动补回)
        healRootSeal()
        // 以及 §26 家目录改道(改道树被清后 2 分钟内自动补回;占用项 30 分钟冷却)
        healHomeJunctions()
        // 以及受管 .env 的"键值被悄悄清空"巡检(G-223 第三格;与 main() 单轮路径同一挂点语义,
        // notifyGuardRed 内部还有一层 CHECK_ONLY/去重保护,双执行体并存不会翻倍发信)
        auditEnvDrift()
        // 以及 EdgeOne 源站直填地址(家宽动态出口)漂移巡检(2026-10-21 立;与 main() 单轮路径
        // 同一挂点语义,notify 内部的 CHECK_ONLY/去重保护保证双执行体并存不翻倍发信)
        auditEgressIpDrift()
        // 以及生产签出外来工作巡检(2026-10-21 立;与 main() 单轮路径同一挂点语义,notify 内部的
        // CHECK_ONLY/去重保护保证双执行体并存不翻倍发信)
        auditProdForeignWork()
        // 收敛器收尾对齐停摆喊人(票 O74;与 main() 单轮路径同一挂点语义,notify 内部
        // 还有一层 CHECK_ONLY/去重保护,双执行体并存也不会翻倍发信)
        checkConvergeAlignStall()
        // 元运维巡检:与 main() 单轮路径同一挂点语义,共用 .ihui-agent/state/ops-patrol-tick.ts 节流戳
        // ⇒ 双执行体并存时只有先到那一个真跑,不会翻倍发信。
        auditOpsPatrol()
        // 同一挂点语义:与 main() 单轮路径共用 .ihui-agent/state/service-heal-tick.iso 节流戳
        // ⇒ 双执行体并存时只有先到那一个真跑,不会把同一台服务重启两遍。
        healUnresponsiveServices()
        // TEMP 夹具清扫:与 main() 单轮路径共用 .ihui-agent/state/temp-scrub-tick.iso 节流戳
        // ⇒ 双执行体并存时只有先到那一个真删,不会把同一批夹具删两遍(第二遍也只是"无候选",
        // 但日志会多一行噪声,更重要的是节流语义必须与其余各层一致)。
        scrubTempFixtures()
      }
    } catch (e) {
      log('巡检异常(忽略): ' + String(e.message || e))
    }
    setTimeout(tick, intervalMs)
  }
  tick()
}

// 〔归档@2026-10-25/门103 C1〕原 19 行注释逐字移入 .ihui-agent/archive/git-guardian-comments-2026-10-25.md#原-l5783-起-19-行
const TEMP_SCRUB_TICK = join(WORKTREE, '.ihui-agent', 'state', 'temp-scrub-tick.iso')
const TEMP_SCRUB_INTERVAL_MS = Number(process.env.IHUI_TEMP_SCRUB_INTERVAL_MS || 24 * 60 * 60 * 1000)
const TEMP_SCRUB_MIN_AGE_DAYS = Number(process.env.IHUI_TEMP_SCRUB_MIN_AGE_DAYS || 7)
/** 清扫器要遍历整个 TEMP(实测这台机 4.6 万个条目);给 5 分钟硬上限,超时只算"本轮没跑成"。 */
const TEMP_SCRUB_TIMEOUT_MS = Number(process.env.IHUI_TEMP_SCRUB_TIMEOUT_MS || 300_000)

/** 节流判定(纯函数):取不到戳 ⇒ 视为**该跑了**(与 `orphanAuditDue` 同一条失效方向)。 */
export function tempScrubDue(nowMs, tickMs, intervalMs = TEMP_SCRUB_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/** 从清扫器的人类报告里取三个数(不重抄判据,只读它已经大声报出来的结论)。 */
export function parseScrubReport(text) {
  const s = String(text || '')
  // 清扫器现在按"多根并集"跑,每个根各打一行明细、最后一行打汇总。
  // 取首条匹配会只读到**第一个根**的数字 ⇒ 把"另一个根还有 18 GB"读成"只剩这一点"。
  // 所以汇总行优先,且只在它存在时才覆盖;没有汇总行(旧输出/崩在半路)照旧走明细正则。
  const agg = /^汇总 ·.*$/m.exec(s)
  if (agg) {
    const cand = /候选 (\d+)/.exec(agg[0])
    const del = /已删 (\d+) 条 \/ 失败 (\d+) 条/.exec(agg[0])
    const err = /取不到 (\d+)/.exec(agg[0])
    const root = /root=(\S+)/.exec(s)
    return {
      candidates: cand ? Number(cand[1]) : null,
      deleted: del ? Number(del[1]) : null,
      failed: del ? Number(del[2]) : null,
      root: root ? root[1] : null,
      aggregate: true,
      unreadableRoots: err ? Number(err[1]) : 0,
    }
  }
  const cand = /候选 (\d+)/.exec(s)
  const del = /已删 (\d+) 条 \/ 失败 (\d+)/.exec(s)
  const root = /root=(\S+)/.exec(s)
  return {
    candidates: cand ? Number(cand[1]) : null,
    deleted: del ? Number(del[1]) : null,
    failed: del ? Number(del[2]) : null,
    root: root ? root[1] : null,
    aggregate: false,
    unreadableRoots: 0,
  }
}

export function scrubTempFixtures(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = TEMP_SCRUB_INTERVAL_MS,
    minAgeDays = TEMP_SCRUB_MIN_AGE_DAYS,
    tickFile = TEMP_SCRUB_TICK,
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'scrub-temp-fixtures.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ TEMP 夹具清扫:清扫器不在位(scripts/scrub-temp-fixtures.mjs)⇒ 本轮跳过,不记为已清扫')
    return { ran: false, why: '清扫器不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!tempScrubDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
  } catch (_e) {
    /* 戳写失败只意味着下轮多跑一遍清扫,不影响判定 */
  }
  const call =
    typeof runner === 'function'
      ? runner()
      : (() => {
          try {
            const out = execFileSync(
              process.execPath,
              [script, '--apply', '--older-than', String(minAgeDays)],
              {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
                timeout: TEMP_SCRUB_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 24,
                stdio: ['ignore', 'pipe', 'pipe'],
              },
            )
            return { status: 0, stdout: String(out || ''), stderr: '' }
          } catch (e) {
            return {
              status: typeof e.status === 'number' ? e.status : 2,
              stdout: String(e.stdout || ''),
              stderr: String(e.stderr || e?.message || ''),
            }
          }
        })()
  const p = parseScrubReport(`${call.stdout}\n${call.stderr}`)
  if (call.status === 2 || (p.candidates === null && p.deleted === null)) {
    logger(
      `⚠️ TEMP 夹具清扫未跑成(rc=${call.status}):${String(call.stderr || call.stdout).replace(/\s+/g, ' ').slice(0, 160)}` +
        ' —— 未跑成不等于没有残留,下轮重试(不改本守护退出码)',
    )
    return { ran: true, ok: false, why: '未跑成', status: call.status }
  }
  if (p.failed) {
    logger(
      `⚠️ TEMP 夹具清扫:删了 ${p.deleted ?? 0} 条但有 ${p.failed} 条失败(多为在句柄中的夹具,属正常)` +
        ` · root=${p.root} · 候选 ${p.candidates}` +
        (p.deleted ? '' : ' —— 一条都没删掉,残留仍在,下轮重试') +
        (p.unreadableRoots ? ` · 取不到的根 ${p.unreadableRoots}` : ''),
    )
    return { ran: true, ok: true, partial: true, ...p }
  }
  if (p.deleted) {
    logger(`✅ TEMP 夹具清扫:释放 ${p.deleted} 条(账龄闸 ${minAgeDays} 天,root=${p.root},候选 ${p.candidates})`)
  }
  return { ran: true, ok: true, ...p }
}

/**
 * 活 TEMP 落点回潮哨兵的**唯一调度器**(尺子本体 = `scripts/check-temp-landing.mjs`)。
 *
 * 为什么必须补这一格(2026-10-17):那份尺子的文件头早就写下"派生出面的唯一调度器 =
 * 本文件健康轮次 `!CHECK_ONLY` 巡检格(auditTempLanding())",而这个函数**从来不存在** ——
 * 判据、声明表、镜像测试全在,脚本却没有任何人调度 ⇒ 典型"造好没装车"。它的失效形态与
 * 元运维巡检同一类:安静(不是报错,是根本不跑)。
 *
 * 为什么不能进提交链:它读的是**本机注册表 + 本机进程环境**(TEMP/TMP 指向哪),提交者
 * 结构上满足不了 ⇒ 挂 blocking 就是每台每次被逼 `--no-verify`,连带废掉全部守门(§12e/§12f)。
 * 它的文件头也是这么定级的(warn/告警档)。
 *
 * 三态纪律:尺子 exit 3 / JSON 取不到 / 字段缺失 ⇒ 写日志点名、**不发信**(发一封"我什么都
 * 没量到"是把噪音冒充成告警);只有真 drift 或近窗内仍在往旧落点写 >0 才喊人。
 * 节流 24h:落点配置一天也不会变两次,每 2 分钟读一遍注册表纯属白烧。
 */
const TEMP_LANDING_INTERVAL_MS = Number(
  process.env.IHUI_TEMP_LANDING_INTERVAL_MS || 24 * 60 * 60 * 1000,
)
const TEMP_LANDING_TIMEOUT_MS = 60_000
const TEMP_LANDING_TICK = join(WORKTREE, '.ihui-agent', 'state', 'temp-landing-tick.ts')

export function auditTempLanding(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = TEMP_LANDING_INTERVAL_MS,
    tickFile = TEMP_LANDING_TICK,
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-temp-landing.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ TEMP 落点哨兵:尺子脚本不在位(scripts/check-temp-landing.mjs)⇒ 本轮跳过')
    return { ran: false, why: '尺子脚本不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(lastTick) && now - lastTick < intervalMs) return { ran: false, why: '未到节流窗口' }
  const call =
    typeof runner === 'function'
      ? runner()
      : (() => {
          try {
            const out = execFileSync(process.execPath, [script, '--json'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
              timeout: TEMP_LANDING_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { status: 0, stdout: String(out || ''), stderr: '' }
          } catch (e) {
            return {
              status: typeof e.status === 'number' ? e.status : 2,
              stdout: String(e.stdout || ''),
              stderr: String(e.stderr || e?.message || ''),
            }
          }
        })()
  let parsed
  try {
    parsed = JSON.parse(String(call.stdout || '').trim())
  } catch (e) {
    logger(
      `⚠️ TEMP 落点哨兵未判定(rc=${call.status},JSON 取不到):` +
        `${String(call.stderr || call.stdout || e?.message).replace(/\s+/g, ' ').slice(0, 160)}` +
        ' —— 未判定不等于合规,下轮重试(不改本守护退出码)',
    )
    return { ran: true, ok: false, why: '未判定' }
  }
  // 判定有效才推进节流戳:取不到读数时不能把 24h 窗口白占掉(否则一次失败就瞎一整天)。
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
  } catch {
    /* 戳写失败只意味着下轮多跑一遍,不影响判定 */
  }
  const c = parsed.counts || {}
  const drift = Number(c.drift ?? 0)
  const undetermined = Number(c.undetermined ?? 0)
  // 生产者那份 counts 里这一维叫 `writing`(check-temp-landing.mjs 的 probeCounts 四态)。
  // 原先读的是 `recentWrites`/`probeHits` —— 两个**从未被发射过**的键名 ⇒ 恒 0,
  // 于是"注册表看着对、进程照旧在写"这条证据支结构上永不触发(与今天修掉的 firstAt/stat 同一型)。
  const recentWrites = Number(c.writing ?? 0)
  if (drift > 0) {
    const names = (parsed.tiers || [])
      .filter((t) => t.judged && t.state === 'drift')
      .map((t) => t.label || t.name)
      .join(' / ')
    logger(
      `🚨 TEMP 落点回潮:${drift} 层与声明表(config/temp-landing.json)不一致 —— ${names}` +
        ' · 清理归既有清扫器(scrubTempFixtures,24h 档),本格只判不动手',
    )
  } else if (recentWrites > 0) {
    logger(
      `🚨 TEMP 落点回潮证据:近窗内有 ${recentWrites} 个条目仍写在非批准落点(注册表看着对,进程照旧在写)` +
        ' —— 清理归既有清扫器',
    )
  } else if (undetermined > 0) {
    logger(`ℹ️ TEMP 落点哨兵:${undetermined} 层未判定(注册表取不到)⇒ 不记通过,下轮重试`)
  }
  return { ran: true, ok: drift === 0 && recentWrites === 0, drift, undetermined, recentWrites }
}


// §22d isDirectRun:本模块需要"双形态"——CLI 直接跑守护 / 镜像测试 import 纯判据。
// 不守卫的话 `node --test` 一 import 就会把整轮巡检(含真发信)跑起来,这正是 §22d 立的禁忌。
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (DAEMON) {
    startDaemon()
  } else {
    process.exit(main())
  }
}

// §22c 镜像测试出口:通知层"是否应当发信"的全部判据(指纹/去重窗口/退避/状态归一/argv 契约)
// 必须能在零副作用、零网络、零真收件人的前提下取证。
export const __test__ = {
  gitdirTargetVerdict,
  judgeRefsHealth,
  alertFingerprint,
  stableAlertFingerprint,
  auditDispatchSites,
  auditPublicPathProbe,
  auditTunnelLegHealth,
  auditSweeperLiveness,
  auditIndexUnmerged,
  sweepStaleClosedRows,
  sweepStaleClaimMarks,
  auditTunnelMetrics,
  bumpProbeStreak,
  parseNotifyState,
  shouldAlert,
  withAlertMark,
  maskEmail,
  resolveAlertTo,
  buildGuardMailArgv,
  redactChildOutput,
  judgeDryRunChannel,
  notifyGuardRed,
  // 合并吞并对账的派生结论分档(2026-10-17 立):"取不到输入"必须与"对账层坏了"分家,
  // 而分家之后"该不该喊人"落在持续性起点件上 —— 这三格都是判据,不导出的话镜像测试只能
  // import 整模块起巡检(§22d 禁止)。
  classifyMergeLossOutcome,
  noteMergeLossUndetermined,
  clearMergeLossUndetermined,
  // 到人节奏的通用尺子(2026-10-17 立):计数折档 + 持续档 + 未判定起点台账。
  // 不导出的话镜像测试只能读源码字符串,钉不住"同一件事不再每 4 小时刷屏"这条行为。
  alertCountTier,
  alertHeldTier,
  noteUndeterminedStreak,
  clearUndeterminedStreak,
  auditDeployStall,
  // 计划任务形态自检(2026-10-25 导出):通道换到 PowerShell 后,须有一条端到面读数钉住
  // "拿不到数据 ⇒ unknown、绝不改动任务",否则这条 2 分钟一 tick 的路径只能靠肉眼守。
  taskForm,
  taskActionOk,
  auditMigrationGaps,
  migrationGapsDue,
  shouldAlertAlignStall,
  checkConvergeAlignStall,
  // 对齐停摆的自动修复(2026-10-04):与 checkConvergeAlignStall 配套导出,镜像测试据此
  // 断言"先自愈后喊人"这条顺序 —— 这三格不导出的话,那格测试就只能靠 import 整模块起巡检,
  // 而 §22d 明令禁止(import 即跑巡检含真发信)。
  decideAlignHeal,
  healConvergeAlignStall,
  readAlignHealAttempts,
  writeAlignHealAttempts,
  alignStallThresholds,
  // 全量告警格的自动修复分档台账(2026-10-04)。导出是为了让镜像测试**逐格钉住**:
  // 新增告警格若没在此登记,"它默认只喊人且无人察觉"这件事就没人发现 ——
  // 而"漏登记"是这类台账唯一会漂的方向(没人会去改一个已经正确的登记)。
  AUTO_HEAL_LEDGER,
  auditEnvDrift,
  envDriftDetail,
  auditEgressIpDrift,
  egressAlertDetail,
  homeHealDue,
  readProbeVerdict,
  orphanAuditDue,
  auditOrphanDeletionRefs,
  tempScrubDue,
  parseScrubReport,
  scrubTempFixtures,
  // 裸档自愈(2026-09-28 立):测试在临时仓库上取证,不碰活仓库
  readBareFlag,
  writeBareFalse,
  healWorktreeBare,
  configFingerprint,
  coreHealthy,
  // core.bare 翻车现场取证(2026-09-29 立):判据一律以**纯函数 + 构造面**取证,
  // 不得依赖此刻真仓的进程状态/真仓的 gitdir(守门 103 T12 那一课)。
  parseProcessSnapshot,
  parseProcessCreationDate,
  selectBareFlipCandidates,
  bareAuditSelfCheck,
  bareAuditSide,
  decideBareFlipRetention,
  bareAuditFileName,
  redactCmdlineForPrint,
  formatBareFlipAuditReport,
  captureBareFlipAudit,
  BARE_AUDIT_CMD_RULES,
  BARE_AUDIT_FILE_RE,
  BARE_AUDIT_DIR,
  BARE_AUDIT_KEEP,
  BARE_AUDIT_REPORT_TIME_ONLY_CAP,
  BARE_AUDIT_WINDOW_MS,
  BARE_AUDIT_SINCE,
  NOTIFY_DEFAULT_WINDOW_MS,
  NOTIFY_DEFAULT_FAIL_COOLDOWN_MS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
