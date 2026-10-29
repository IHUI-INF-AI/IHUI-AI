#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/** 〈原 36 行头注已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-24.md#git-guardian-L7〉 git-guardian.mjs — `.git` 存活守护 + 秒级自愈(2026-09-12 立)。 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildAlertIdentity, watchPushDivergence } from './lib/push-divergence-watch.mjs'
import { auditLintStagedPins as pinsAudit } from './lib/lint-staged-pin-audit.mjs'
import { rotateAppendLog } from './lib/log-rotation.mjs'
import { runRegistrySyncHealth } from './lib/registry-sync-audit.mjs'
import { createHash } from 'node:crypto'
import { homedir, hostname } from 'node:os'
import { isInteractiveUserHome } from './check-home-junctions.mjs'
import { judgeTaskForm, taskFormAcceptable } from './lib/schtasks-form.mjs'
// §0.6 单一真相源:PowerShell 解释器候选复用 check-service-binary-paths 的出口,禁抄第二份。
// 2026-10-25 立:本机的 schtasks.exe 在程序黑名单里 —— spawn 它不是报错,而是**把本 node 进程
// 连同守护本身一起杀掉**(RC=143 = 128+SIGTERM,try/catch 救不了)。计划任务的存在性与
// XML 改走 Get-ScheduledTask / Export-ScheduledTask,形态判据仍是 lib/schtasks-form.mjs 那一份。
import { pickPowerShell } from './check-service-binary-paths.mjs'
// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l38(门 103 C1 收口)〉首意: 死值分流必须与 `git-refs-heal.mjs` **共用同一份实现**。本文件原先有一份同名同实现的私有
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
  parseGitdirPointer,
  needsGitdirPointer,
  resolveBackupDir,
  gitdirArchivePath,
  brokenRefsFromSnapshot,
} from './lib/gitdir.mjs'
// 凭据形状脱敏的**唯一实现**住在 lib(G-334 / G-400):本文件原先自带一份逐字相同的副本,
// 两份实现必漂移是本仓记过最多次的失效型,而这一族的失败形态是安静的 —— 漂了的一侧只会让
// 某些告警少打码或多打码,没有任何门会喊。`redactChildOutput` 在本文件里已不再有实现。
import { redactChildOutput } from './lib/secret-shape-redact.mjs'
// AI 自进化调度层(第 0 期)的接线锚点:取票面/闸门/台账/锁全部 import 自器物本身(§0.6 单一真相源),
// 派发层不另写"什么算可派/今日已派几轮/成本还剩多少"的第二份判据 —— 两处各算一次必漂移。
import {
  COST_LEDGER as AE_COST_LEDGER,
  DISPATCH_ARGS as AE_DISPATCH_ARGS,
  LEDGER as AE_LEDGER,
  LOCK_FILE as AE_LOCK_FILE,
  PLAN_TASKS as AE_PLAN_TASKS,
  isPidAlive as isAutoEvolvePidAlive,
  loadGates as loadAutoEvolveGates,
  matchWhitelist as matchAutoEvolveWhitelist,
  parseTicketRows as parseAutoEvolveTicketRows,
  todayKey as autoEvolveTodayKey,
} from './auto-evolve.mjs'
import {
  evaluate as evaluateCostBudget,
  loadCaps as loadCostCaps,
  parseLedger as parseCostLedger,
} from './cost-breaker.mjs'
// 公网探测的**告警身份归一**住在尺子那侧(§0.6 单一真相源,2026-10-17 立):派发层只负责把它填进
// dedupKey,不再自己拼含计数的身份。模块有 §22d 直跑守卫,import 不会触发采样。
import { classifyAlertIdentity } from './check-public-path-probe.mjs'
import { auditProdForeignWork } from './git-guardian-prod-foreign.mjs'
// G-24 事故归档回收器的调度接线臂(2026-10-26,席位 goal-20261026-b14r3):dry-run 只判不删、
// 开关面默认关、读数写日志通道留痕;实现单源在 lib(守门 103 C1 行数上限,主文件只留挂点)。
import {
  archiveGcDryRun,
  archiveGcArmDue,
  loadArchiveGcArmConfig,
  parseArchiveGcSummary,
} from './lib/git-guardian-archive-gc.mjs'
// G-50 DevEnv 搬迁「探测器找静默窗口自动执行」的调度接线(2026-10-28):器物本体
// (scripts/devenv-migrate.mjs)与镜像测试早已在,唯独没有派发点 ⇒ 按 §0.9「造好没装车
// = 没有」票面不成立。窗口三态/待做盘点/apply 判据全部 import 自本体(§0.6 单一真相源),
// 本文件只挂点:默认只 probe 留痕,真搬须 scripts/data/devenv-migrate-arm.json enabled=true。
import { devenvMigratePatrol } from './devenv-migrate.mjs'

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
  parseMergeLossCount,
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
  parseMergeLossCount,
}

// 工作树 / 真实 gitdir / 备份目录动态解析(不再硬编码 D: 盘;见 scripts/lib/gitdir.mjs 2026-09-15)
export const WORKTREE = resolveWorktree()
const GITDIR = resolveGitdir(WORKTREE)
const BACKUP = resolveBackupDir(WORKTREE)
/** origin = GitHub SSH(仓库唯一权威源;严禁改回 https,见 AGENTS.md §5b 铁律) */
const GITHUB_SSH_URL = 'ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git'
// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l132(门 103 C1 收口)〉首意: 2026-10-23 机主令:GitCode/Gitee **代码镜像仓早已弃用**,此处不再保留任何镜像远端常量。
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

// —— 自动修复的节流与熔断(2026-10-04 立,立因与两道护栏明细移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md)——
// 接进本守护已有自愈链(与 heal*/healRefs 同挂点),顺序固定为**先自己修 → 修不好才喊**,两道护栏:
//   ① 节流 ALIGN_HEAL_THROTTLE_MS(对齐器单跑 40–51 秒,每 2 分钟一轮不节流会把「修」变成新负载源);
//   ② 熔断 ALIGN_HEAL_MAX_ATTEMPTS(自愈失败也要有上限,否则只是换更吵的形态)。
// 两道都可用 env 调;设 ALIGN_HEAL_DISABLED=1 可整体关掉自愈(回到纯喊人),便于取证对照。
const ALIGN_HEAL_THROTTLE_MS = Number(process.env.IHUI_ALIGN_HEAL_THROTTLE_MS || 30 * 60 * 1000)
const ALIGN_HEAL_MAX_ATTEMPTS = Number(process.env.IHUI_ALIGN_HEAL_MAX_ATTEMPTS || 3)
const ALIGN_HEAL_ATTEMPT_LOG = join(WORKTREE, '.ihui-agent', 'state', 'converge-align-heal-attempts.json')

// 〈原 24 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-25.md#guardian-l168(门 103 C1 收口)〉首意: // 通用自动修复骨架(2026-10-04 第二批,李总"要 AI 自动修"授权后立)


// 〈原 29 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-25.md#guardian-l194(门 103 C1 收口)〉首意: // 全量告警格的**自动修复分档台账**(2026-10-04 第二批,李总"要 AI 自动修"授权后立)
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
    // ⚠ 2026-10-04 复核改判(历史叙述移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md):
    //   该格真实形态是「只喊人 + 人来点」(union-converge --apply 由人执行),并已补对账测试。
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l304(门 103 C1 收口)〉首意: 每次 git 调用显式带 `-c safe.directory=*`:
const GIT_SAFE_ARGS = ['-c', 'safe.directory=*']

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l311(门 103 C1 收口)〉首意: 守护派生 git 的输出预算(256MB)。取名而不逐点写数字:`for-each-ref` 这类**整表枚举**的输出
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
      // 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l331(门 103 C1 收口)〉首意: 2026-10-16 立:缺省 maxBuffer = 1MiB,而 `for-each-ref refs/heads refs/tags refs/remotes`
      maxBuffer: GIT_ENUM_MAX_BUFFER,
      // 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l337(门 103 C1 收口)〉首意: 2026-10-22 立:**守护的 git 派生一律不抢"可选锁"**。
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l351(门 103 C1 收口)〉首意: `.git` 指针文件是否与期望一致。
function pointerOk() {
  if (!needsGitdirPointer()) {
    // 常规仓库:`.git` 即 gitdir 目录,存在即可
    return existsSync(POINTER)
  }
  try {
    return pointerContentOk(readFileSync(POINTER, 'utf8'), EXPECTED_POINTER)
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l385(门 103 C1 收口)〉首意: 工作树视角是否可用 —— 与 gitUsable() **不是同一件事**,这一格此前无人看守。
function worktreeUsable() {
  return git(['rev-parse', '--is-inside-work-tree'], true) === 'true'
}

// 〈原 9 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l402(门 103 C1 收口)〉首意: 核心健康判据 —— main 与 daemon **共用这一份实现**(两处各写必然漂移)。
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

// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l447(门 103 C1 收口)〉首意: 把"活仓库 + 本地恢复源"两侧的 `core.bare` 一起归一为 false。
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

// 〈原 20 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l493(门 103 C1 收口)〉首意: core.bare 翻车的现场取证件(2026-09-29 立)
const BARE_AUDIT_DIR = join(WORKTREE, '.ihui-agent', 'state', 'git-bare-flip-audit')
/** 只留最新 20 份(每小时一次翻车也够看近两天,而运行态目录不得无限长) */
const BARE_AUDIT_KEEP = 20
// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l516(门 103 C1 收口)〉首意: 人读报告里"只被时间窗命中"的条目上限。真机实测一次快照 351 进程 / 83 条时间窗命中,
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

// 〈原 11 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l550(门 103 C1 收口)〉首意: 取进程清单的 PowerShell 脚本。**必须纯 ASCII**(§26:控制台代码页会把非 ASCII 命令串吃掉),
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l574(门 103 C1 收口)〉首意: 跑一次进程快照。返回值刻意是**三态**(不是"要么数组要么空数组"):
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

// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l617(门 103 C1 收口)〉首意: 解析进程 CreationDate。**必须同时认两种形态**:
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

// 〈原 9 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l742(门 103 C1 收口)〉首意: 某一侧 gitdir 的现场读数(path + bare 现值 + config 的 mtime/ctime);取不到的字段一律点名原因 */
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l803(门 103 C1 收口)〉首意: 保留期决策 —— **纯函数**,输入是目录条目(名字 + 是否普通文件 + 是否重解析点)。
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l975(门 103 C1 收口)〉首意: **打印面**的命令行脱敏。落盘的审计件留在 `.ihui-agent/state/`(gitignored、不出机)保留原文 ——
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1071(门 103 C1 收口)〉首意: 重建 `.git` 指针文件(原子写 + 回读校验)。

/**
 * 一行 gitfile 就是几十字节;远超此体积的普通文件**不可能是合法指针**,也没必要把整份读进内存
 * 再判(2026-10-16 00:21 现场那一枚是 25,433,594 字节的 `.git`)。上限取得比 git 自己的
 * `gitfile` 余量宽得多,只为把"垃圾 blob"与"合法指针"分开,不承担精确解析。
 */
export const GITFILE_MAX_BYTES = 4096

/**
 * 「现读到的 `.git` 形态 → 指针腿该怎么处置」的**纯判据**(零 IO,可构造面取证)。
 *
 * 立因(台账票「修复面假定 `.git` 是目录」那一格):两条兜底恢复路径早在 2026-10-16 就都排在
 * `gitdirTargetSafe()` 之后了,`EEXIST … mkdir` 那一型已在 HEAD 不成立;仍然活着的是**指针腿自己**——
 * 旧 `healPointer()` 无条件 `rmSync(POINTER)` + 覆盖,于是那枚 25MB 现场会被守护**静默删掉**
 * (既没归档也没留证),违反 §5b「破坏性覆盖前必须先归档」与票面正解②。
 *
 * 五态各有一条出路,且**失效方向恒为"多要一次定向说明",绝不写成"已修好"也不写成"没救"**(§0.3/§0.10):
 *  - `absent`            ⇒ 直接落指针(没有现场可归档)
 *  - `valid-pointer`     ⇒ 直接重写(内容就是期望那一行,不可损失)
 *  - `stray-file`        ⇒ **先归档现场再落指针**;归档不成 ⇒ 拒绝覆盖
 *  - `directory`         ⇒ 拒绝动它(那是本机形态;覆盖等于删库)
 *  - `unreadable`        ⇒ **未判定**并点名原因,既不覆盖也不删
 * @param {{exists?:boolean,isDirectory?:boolean,sizeBytes?:number,pointerTarget?:string|null,preview?:string,unreadable?:boolean,reason?:string}} input
 */
export function pointerFormVerdict({
  exists = false,
  isDirectory = false,
  sizeBytes = 0,
  pointerTarget = null,
  preview = '',
  unreadable = false,
  reason = '',
} = {}) {
  if (unreadable)
    return {
      state: 'unreadable',
      action: 'refuse',
      writes: false,
      archives: false,
      why: `形态读不出来(${reason || 'stat/read 失败'}) ⇒ 未判定:不猜它是指针也不是猜它是目录,不覆盖不删,交人工`,
    }
  if (!exists)
    return { state: 'absent', action: 'write', writes: true, archives: false, why: '无 `.git` ⇒ 没有现场可归档,直接落指针' }
  if (isDirectory)
    return { state: 'directory', action: 'refuse', writes: false, archives: false, why: '`.git` 是目录形态 ⇒ 指针腿覆盖它等于删库' }
  if (sizeBytes > GITFILE_MAX_BYTES)
    return {
      state: 'stray-file',
      action: 'archive-then-write',
      writes: true,
      archives: true,
      why: `普通文件 ${sizeBytes} 字节 > gitfile 上限 ${GITFILE_MAX_BYTES} ⇒ 不可能是合法指针(2026-10-16 那枚 25,433,594 字节现场同型)`,
    }
  if (!pointerTarget)
    return {
      state: 'stray-file',
      action: 'archive-then-write',
      writes: true,
      archives: true,
      why: `普通文件而内容不含 \`gitdir:\` 行(前 40 字:${JSON.stringify(String(preview).slice(0, 40))})⇒ 形态不认识 ⇒ 按现场归档,不许直接覆盖`,
    }
  return {
    state: 'valid-pointer',
    action: 'write',
    writes: true,
    archives: false,
    why: `合法 gitfile 指针(指向 ${pointerTarget})⇒ 一行文本可由期望值复原,直接重写、不产归档`,
  }
}

/**
 * 现问形态(§5b「gitdir 形态是七类必须每次实测的机器事实」的修复面一侧)。只读不写。
 * @param {string} pointerPath 工作区 `.git`
 * @returns 同 `pointerFormVerdict`
 */
export function inspectGitdirPointer(pointerPath) {
  let st
  try {
    st = statSync(pointerPath)
  } catch (e) {
    if (e && e.code === 'ENOENT') return pointerFormVerdict({ exists: false })
    return pointerFormVerdict({ unreadable: true, reason: `stat ${e && e.code ? e.code : e}` })
  }
  if (st.isDirectory()) return pointerFormVerdict({ exists: true, isDirectory: true, sizeBytes: st.size })
  if (st.size > GITFILE_MAX_BYTES) return pointerFormVerdict({ exists: true, sizeBytes: st.size })
  let raw
  try {
    raw = readFileSync(pointerPath, 'utf8')
  } catch (e) {
    return pointerFormVerdict({ unreadable: true, reason: `read ${e && e.code ? e.code : e}` })
  }
  return pointerFormVerdict({
    exists: true,
    sizeBytes: st.size,
    pointerTarget: parseGitdirPointer(raw),
    preview: String(raw).trim().slice(0, 40),
  })
}

/**
 * 修复面两形态分流(纯判据,`remediate` 消费它):
 * 指针形态机上「真身还在」与「真身没了」是两件事,旧写法靠两条 `if` 各判各的、判序无处取证。
 *  - 目标(gitdir 本体)骨架不全/不在 ⇒ `restore-gitdir`:这才轮到恢复源,恢复前该归档的归档;
 *  - 目标在而指针坏 ⇒ `rewrite-pointer`:**只重写 gitfile,绝不 mkdir、绝不灌整份备份**
 *    (2026-10-16 10:05–10:07 那三次「活仓 config 被覆盖 + 23GB cpSync」就是这一格没分清);
 *  - 两者都好 ⇒ `none`。
 * @param {{gitdirOk?:boolean,pointerOk?:boolean}} input
 * @returns {'restore-gitdir'|'rewrite-pointer'|'none'}
 */
export function gitdirRepairPlan({ gitdirOk = false, pointerOk = false } = {}) {
  if (!gitdirOk) return 'restore-gitdir'
  if (!pointerOk) return 'rewrite-pointer'
  return 'none'
}

/** 指针内容是否与期望一致(纯判据;`pointerOk()` 与夹具侧执行单元共用同一把尺子,§0.6) */
export function pointerContentOk(rawText, expectedPointer) {
  return String(rawText ?? '').trim() === String(expectedPointer ?? '').trim()
}

/**
 * 落 `.git` 指针的**执行单元**(路径全入参 ⇒ 能在夹具上真跑,不碰活仓)。
 * 写前按 `inspectGitdirPointer()` 现读的形态处置:异形现场先归档再覆盖,归档不成 ⇒ 拒绝覆盖。
 *
 * 归档落点两条硬约束(§5b 原文,不是建议):
 *  1. 必须由唯一出口 `gitdirArchivePath()` 给出(生产侧),它返回 null ⇒ **拒绝覆盖**;
 *     不许像 `archiveGitdir()` 那样退回 `${GITDIR}.broken-*`,因为指针文件的同级就是工作区根,
 *     「现场 mv 到一级目录 = 把它送回宿主批量清理层的射程」。
 *  2. 落点目录不得与指针文件同目录(同目录 = 工作区根那一格)⇒ 当场拒绝。
 * @param {{pointer:string,expectedPointer:string,archiveNameFor?:(tag:number)=>string|null,logger?:(msg:string)=>void,notify?:(title:string,detail:string)=>void,inspect?:(p:string)=>object}} opts
 * @returns {{ok:boolean,state:string,archived:string|null,why:string}}
 */
export function writeGitdirPointer({
  pointer,
  expectedPointer,
  archiveNameFor = null,
  logger = () => {},
  notify = () => {},
  // 形态探查可注入:唯一用途是让「读不出来」那一支在夹具上真跑(Windows 上没有可靠的
  // 权限位能造出稳定 EACCES,而"未判定不得写成已修好"这条必须有牙,不能只靠纯函数构造面)。
  inspect = inspectGitdirPointer,
} = {}) {
  const v = inspect(pointer)
  const say = (m) => {
    try {
      logger(m)
    } catch {
      /* 日志层坏了不得把自愈一起带走 */
    }
  }
  const callNotify = (title, detail) => {
    try {
      notify(title, detail)
    } catch (e) {
      say(`通知层异常(不影响自愈判定): ${String((e && e.message) || e)}`)
    }
  }

  if (v.action === 'refuse') {
    say(`⛔ 指针腿让路:${v.why}(${pointer})`)
    if (v.state === 'unreadable')
      callNotify('.git 形态无法判定(指针腿未判定)', `${v.why}\n路径:${pointer}\n期望指针:${String(expectedPointer).trim()}`)
    return { ok: false, state: v.state, archived: null, why: v.why }
  }

  let archived = null
  if (v.archives) {
    let dst = null
    try {
      dst = archiveNameFor ? archiveNameFor(Date.now()) : null
    } catch {
      dst = null
    }
    if (!dst || samePath(dirname(dst), dirname(pointer))) {
      const why = !dst
        ? '现场归档落点取不到(gitdirArchivePath 返回 null)⇒ 拒绝覆盖:宁可仓库继续不可用,不许把唯一现场删掉'
        : `现场归档落点与指针同目录(${dst})⇒ 等于把 .git* 留在工作区根,违反 §5b ⇒ 拒绝覆盖`
      say(`⛔ 拒绝覆盖指针:${why}`)
      callNotify('.git 异形现场未能归档(已拒绝覆盖)', `${why}\n指针路径:${pointer}\n形态:${v.why}`)
      return { ok: false, state: 'refused-no-archive', archived: null, why }
    }
    try {
      mkdirSync(dirname(dst), { recursive: true })
      cpSync(pointer, dst)
      archived = dst
      say(`归档: .git 现场已备份 -> ${dst}(${v.why})`)
      callNotify('.git 是指针位上的异形文件(现场已归档并落指针)', `${v.why}\n归档:${dst}\n指针路径:${pointer}`)
    } catch (e) {
      const why = `归档失败 ⇒ 放弃覆盖,现场必须可回溯: ${String((e && e.message) || e)}`
      say(`⛔ 拒绝覆盖指针:${why}`)
      callNotify('.git 异形现场归档失败(已拒绝覆盖)', `${why}\n指针路径:${pointer}`)
      return { ok: false, state: 'refused-no-archive', archived: null, why }
    }
  }

  const tmp = `${pointer}.tmp-${process.pid}`
  let ok = false
  try {
    writeFileSync(tmp, expectedPointer)
    try {
      rmSync(pointer, { recursive: true, force: true })
    } catch {
      /* 目标可能不存在 */
    }
    renameSync(tmp, pointer)
    ok = pointerContentOk(readFileSync(pointer, 'utf8'), expectedPointer)
  } catch (e) {
    say(`指针落盘异常: ${String((e && e.message) || e)}`)
    ok = false
  } finally {
    try {
      if (existsSync(tmp)) rmSync(tmp, { force: true })
    } catch {
      /* 清不掉不追加噪音 */
    }
  }
  return { ok, state: v.state, archived, why: v.why }
}

function healPointer() {
  if (!needsGitdirPointer()) {
    log('修复跳过: 当前为常规仓库(.git 即 gitdir 目录),无需也不应重建指针文件')
    return true
  }
  const r = writeGitdirPointer({
    pointer: POINTER,
    expectedPointer: EXPECTED_POINTER,
    // 归档落点唯一出口(lib 侧同名函数已带夹具闸:落点 null ⇒ 执行单元拒绝覆盖)
    archiveNameFor: (tag) => gitdirArchivePath(`${basename(GITDIR)}.gitfile-stray-${tag}`),
    logger: log,
    notify: (title, detail) => notifyGuardRed(title, detail),
  })
  log(`${r.ok ? '修复' : '修复失败'}: 重建 .git 指针文件 -> ${GITDIR}`)
  return r.ok
}

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1094(门 103 C1 收口)〉首意: 环境自愈:`git=true` 之外的唯一分支 —— pointer/gitdir 都在但 git 命令不可用。
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1157(门 103 C1 收口)〉首意: ─────────── 嵌套 ref 存续(2026-09-12 立) ───────────
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1183(门 103 C1 收口)〉首意: 当前全部 ref(name → sha),含 packed 与松散。
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

// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1220(门 103 C1 收口)〉首意: 直写松散 ref:`git update-ref` 对嵌套命名空间静默不落盘,故用 node fs。
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

// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1261(门 103 C1 收口)〉首意: ref 自愈:①把当前可见的嵌套 ref 纳入清单(自维护,含 manifest 缺失时的 bootstrap)
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1381(门 103 C1 收口)〉首意: 工作区已跟踪文件存续自愈(2026-09-23 立)。宿主清理层会成批删除工作区目录
function healWorktreeTracked() {
  // 2026-10-04 复核补节流(细节移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md):本函数与收敛对齐
  // 自愈同轮写同一索引,无节流会抢 index.lock 并多花一次 40–51 秒;节流判据用「对齐层跑过的窗口」,
  // 对齐真实动作面而不是随便加个时间戳。
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
/**
 * 家目录改道自愈(§26)。**2026-09-24 重做节流**,起因是实测到的死循环:
 *   守护每 2 分钟一趟 ⇒ 每趟都调修复器 `--apply`;而修复器被给的超时是 **240 秒**,
 *   待搬的最大一项是 `.trae-cn`(实测 371MB / 13973 个文件),robocopy 在 240 秒内搬不完
 *   ⇒ 子进程被 SIGTERM 掐死。冷却文件 `.ihui-agent/state/home-junctions-cooldown.json` 是修复器
 *   **正常结束时才写**的,被杀就等于"没失败也没成功",于是下一轮从头再搬 ——
 *   实测门 96 连续判红 11 分钟、日志里每 2 分钟一条"修复后仍判红",且当时**只有 1 项**
 *   没治好(其余 10 项 16:41 那轮已改道成功),冷却表还是空的 `{}` ⇒ 不是 EBUSY。
 *   而 C 盘上留下了一个半完成现场:`.trae-cn` 是实体目录、`.trae-cn.pre-junction-<08:41:30Z>`
 *   却是指向 `G:\DevEnv\cache\userhome\.trae-cn`(15871 文件)的 junction —— 数据没丢,
 *   但"源已改名 / 链接已建 / 结论没落"这种状态正是 §26 警告过的那一类。
 *
 * 三条改法:
 *  ① **单实例锁**:一轮没跑完前,后来的 tick 直接跳过(2 分钟节奏 × 25 分钟工作量必然重叠,
 *     而重叠就是上面那个半完成现场的制造者)。锁里带 pid + 起始时间,持锁进程已死或超 TTL 才抢。
 *  ② **超时给到能搬完**(240s → 25min),并区分"被掐死"与"修复器自己报错"。
 *  ③ **如实报因**:旧文案写"多为进程占用(EBUSY)",是猜的且方向不对(实测冷却表为空)。
 *     改为统计修复器自己打的 action 标签,并显式区分 timed-out / copy-failed / EBUSY 类。
 */
const HOME_HEAL_LOCK = join(WORKTREE, '.ihui-agent', 'state', 'home-junctions.heal.lock')
const HOME_HEAL_STAMP = join(WORKTREE, '.ihui-agent', 'state', 'home-junctions.last-heal.txt')

function healHomeJunctions() {
  const dir = dirname(fileURLToPath(import.meta.url))
  const judge = join(dir, 'check-home-junctions.mjs')
  const fixer = join(dir, 're-home-junctions.mjs')
  if (!existsSync(judge) || !existsSync(fixer)) return
  // 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1529(门 103 C1 收口)〉首意: ── ⓪ 身份闸(2026-09-27,排在节流与锁之前)──
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

// 〈原 20 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1673(门 103 C1 收口)〉首意: 守门 100 的"别人造好再推来"面(2026-09-24 立)。
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1765(门 103 C1 收口)〉首意: 盘根卫生巡检(2026-09-30 立,尺子本体 = `scripts/check-disk-root-hygiene.mjs`)。
const DISK_ROOT_AUDIT_TICK = join(WORKTREE, '.ihui-agent', 'state', 'disk-root-hygiene-audit-tick.ts')
const DISK_ROOT_AUDIT_INTERVAL_MS = 30 * 60 * 1000

// 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1781(门 103 C1 收口)〉首意: 告警去重的**计数分档**:档内抖动不重报,跨档才算真恶化/真缓解。
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
          // 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1865(门 103 C1 收口)〉首意: 去重身份只取"违规类别 + **计数分档**",明细行不进指纹(2026-10-03 立;
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
// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1896(门 103 C1 收口)〉首意: "这一轮取不到结论"与"对账层真的坏了"在到人信上必须是两件事。2026-10-17 上午共享 git 争用让该
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
    // 取数归 `parseMergeLossCount`(单一真相源):令牌优先、散文兜底。2026-10-26 前这里内联
    // `丢失新增路径` 正则,而对账脚本措辞早已改成「丢失路径或回退内容」⇒ 恒取不到数,
    // 判红信正文写「共 ? 个路径」。
    const n = parseMergeLossCount(res)
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

// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1976(门 103 C1 收口)〉首意: 本地恢复源的增量刷新层(§5b 里那条"唯一空白层")。
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
    // 身份带出口形态与**已持续档**(2026-10-17;实测 21 封平铺、间隔均值 4.05h,细节移
    // .ihui-agent/archive/AGENTS_trim-2026-10-25.md):6h/24h/72h 各升级一次(跨档即新身份 ⇒ 立即到人),
    // 同档内由窗口压住;起点件在追平成功时清除,不拿上一场故障的账续命。
    { severity: 'critical', dedupKey: `backup-refresh-fail;exit=${applied.code};held=${alertHeldTier(noteUndeterminedStreak(join(WORKTREE, '.ihui-agent', 'state', 'backup-refresh-fail-first.json')).firstMs).tier}` },
  )
}

// 〈原 15 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2026(门 103 C1 收口)〉首意: ══ 判红 → 邮件到人层(2026-09-24 立,§5e 唯一通道)═══════════════════════════════
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

// 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2099(门 103 C1 收口)〉首意: 子进程输出转诊断文本:逐行脱敏 + 截断。
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

// 〈原 16 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2164(门 103 C1 收口)〉首意: 守护判红时的唯一出口。**旁路通知,不改自愈行为本身**:整个函数体裹 try,
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
        // 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2259(门 103 C1 收口)〉首意: **自测成功也清 UNDELIVERED 标记**(2026-10-03 补)。原先只有真实告警那条路径清,
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2351(门 103 C1 收口)〉首意: 该不该喊人:**连续失败 ≥ minFails 且 最后失败距今 ≥ minAgeMs** 才 alert。
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2390(门 103 C1 收口)〉首意: 自愈尝试台账(跨轮):读不出/坏 JSON 一律当"空台账"重新开始,**不得**因此永久禁用自愈
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

// 〈原 12 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2418(门 103 C1 收口)〉首意: 纯判据(导出以便独立钉死):这一轮该不该派一次对齐自愈。
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2450(门 103 C1 收口)〉首意: 收尾对齐停摆的**自愈**(2026-10-04 立)。
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

  // 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2483(门 103 C1 收口)〉首意: 先落"已尝试",再跑:这样即使派发器本身把本进程带走(超时/异常),也不会留下一条
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

// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2567(门 103 C1 收口)〉首意: 每轮 tick 的收尾对齐停摆检查。notify 出口可注入(镜像测试用假派发器断言参数,
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
        // 2026-10-04 复核补(细节移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md):熔断/节流两档的 why
        // 也要写进 healNote —— 熔断是「自动修已停手,等人」,最该让人看见;节流档原先既不修也不喊,
        // 现在至少把「为什么这次没修」写进日志与正文,不再是静默重试。
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

// 〈原 5 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2791(门 103 C1 收口)〉首意: 告警正文的唯一拼装处。**只写键名与所用对照面的文件名/mtime**,一个值都不写(§5d)。
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

/**
 * 家宽公网出口 IPv4 ↔ EdgeOne 源站期望 的巡检 + 到人(2026-10-21 立)。
 *
 * 立因(现读):2026-10 起公网链路改为 EdgeOne **源站直填家宽公网 IPv4**(取代 Cloudflare Tunnel
 * 跨境回源,实测回源 ttfb 10~45s → 0.28~0.34s)。该地址是动态的 —— 一变即全公网 5xx,而此前
 * 全仓无任何尺子看守。2026-10-21 立时写"本机无 EO API 凭据 ⇒ 只能量到 + 到人";**2026-10-28
 * 实测证伪**:生产 api 的 `.env` 里 TENCENT_SMS_* 能签名通过 teo.tencentcloudapi.com 且能
 * ModifyAccelerationDomain(同值回写 200 OK)⇒ 漂移先走 `scripts/repair-eo-origin.mjs` 自愈,
 * 自愈不成才到人(信里仍给人工出口,EO 控制台改源站那一格);期望值不再只靠人工台账,而是
 * 由 `refreshEoLiveLedger()` 把 EO 现配投影成运行时台账喂给判据,仓内台账仅作回落。
 * 判据仍住 `scripts/check-egress-ip-drift.mjs`(判机器状态 ⇒ 绝不进提交链 §12e,
 * 唯一调度器 = 本守护)。
 *
 * 三态分流(与尺子退出码同形,互不顶掉):
 *   drift     ⇒ log ❌ + notifyGuardRed(critical)。身份 = `egress-drift;faces=<漂的面>;tier=<持续档>`
 *              —— §5e-1:类别+主体,不含 sha/时刻/原始计数(门 224 射程);起点件钉住起始形状
 *              (§5e-1 型②,同 deploy-stall 教训),4h 窗口 + 跨 6h/24h/72h 档即新身份 ⇒ 同一漂移
 *              不会每轮(2 分钟)重寄,只会越拖越响。
 *   unjudged  ⇒ 走 notifyEnvUndetermined 持续门槛(探测公网有瞬时抖动,单轮不可达不是故障;
 *              连满 30 分钟 ≈ 15 趟才按"这一格瞎了"到人 —— 与 env-drift 同一把量过的尺子,不自拍新数)。
 *   ok        ⇒ 安静,并清掉两本起点账(不得拿上一场抖动的账续命)。
 * run/notify/logger 全可注入(§22c:镜像测试用假派发器断言"哪种结论发哪种身份",绝不真发信)。
 */
const EGRESS_UNDET_FILE = join(WORKTREE, '.ihui-agent', 'state', 'egress-ip-drift-undetermined-first.json')
const EGRESS_DRIFT_FILE = join(WORKTREE, '.ihui-agent', 'state', 'egress-ip-drift-first.json')
const EGRESS_UNDET_HORIZON_MS = Number(process.env.IHUI_EGRESS_UNDET_HORIZON_MS || 30 * 60 * 1000)

/**
 * 自愈腿(2026-10-28 立):EO 源站"可活读、可改写"之后,漂移不再只能到人。
 *
 * 前提变更如实登记:2026-10-21 立巡检时写的"本机无 EO API 凭据",2026-10-28 实测证伪 ——
 * 生产 api 的 `.env` 里 TENCENT_SMS_* 能签名通过 teo.tencentcloudapi.com,
 * 且 ModifyAccelerationDomain 同值回写 200 OK。于是期望值从"人工登记的台账"升级为
 * **EO 现配的投影**(运行时台账,写在 .ihui-agent/state/,不进仓),漂移则直接改回。
 * 唯一器物 = scripts/repair-eo-origin.mjs;本文件只负责派生与解析,判定留在那个脚本里。
 * 任何缺失/失败都返回可判对象并**回落**旧路(台账巡检 + 到人),自愈绝不把巡检本身拖死。
 */
const EGRESS_LIVE_LEDGER_FILE = join(WORKTREE, '.ihui-agent', 'state', 'eo-origin-live-ledger.json')

/** 把 EO 现配写成运行时台账。true = 成功(调用方据此换 --ledger);false = 回落仓内台账。 */
function refreshEoLiveLedger() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'repair-eo-origin.mjs')
  if (!existsSync(script)) return false
  try {
    const stdout = String(
      execFileSync(process.execPath, [script, '--print-ledger'], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 1 << 20,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || '',
    )
    const doc = JSON.parse(stdout)
    if (!doc || !Array.isArray(doc.rows)) return false
    mkdirSync(dirname(EGRESS_LIVE_LEDGER_FILE), { recursive: true })
    writeFileSync(EGRESS_LIVE_LEDGER_FILE, JSON.stringify(doc), 'utf8')
    return true
  } catch {
    return false
  }
}

/** 派生自愈器唯一出口:--apply 漂移即改并从公网入口验证(失败回滚),解析它的结论行。 */
function runEoRepair() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'repair-eo-origin.mjs')
  if (!existsSync(script)) return { missing: true }
  const args = [script, '--apply', '--json']
  try {
    const stdout = String(
      execFileSync(process.execPath, args, {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300000, // 改源站 + 等 EO 部署 + 公网入口验证(默认 180s)的上限 + 富余
        maxBuffer: 1 << 20,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || '',
    )
    return { missing: false, ...JSON.parse(stdout) }
  } catch (e) {
    let parsed = null
    try { parsed = JSON.parse(String(e.stdout || '')) } catch { parsed = null }
    return { missing: false, state: (parsed && parsed.state) || 'failed', reason: (parsed && parsed.reason) || 'repair-crashed', ...(parsed || {}) }
  }
}

/** 派生那把尺子的唯一出口:只读、带超时、不带控制台窗(§5b / 守门 52·80)。 */
function runEgressProbe() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-egress-ip-drift.mjs')
  if (!existsSync(script)) return { missing: true, code: 2, stdout: '' }
  // 2026-10-28:期望改由 EO 现配投影(运行时可读),活读失败才回落仓内台账(旧行为)。
  const live = refreshEoLiveLedger()
  const args = [script, '--check', '--json']
  if (live) args.push('--ledger', EGRESS_LIVE_LEDGER_FILE)
  try {
    const stdout = String(
      execFileSync(process.execPath, args, {
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
    `${kindLabel}:EdgeOne 源站直填的是**家宽动态公网 IPv4**;自愈腿已先尝试改源站,未成功才发这封信(失败形状见下行),现在需要人工接手。\n` +
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
    // 2026-10-28:先自愈,自愈不成才喊人。镜像测试注入 run 时默认不跑真自愈(无 heal 注入 ⇒ null),
    // 旧用例行为不变;生产两条路径都不注入 ⇒ runEoRepair 生效。
    const healFn = Object.prototype.hasOwnProperty.call(opts, 'heal') ? opts.heal : Object.prototype.hasOwnProperty.call(opts, 'run') ? null : runEoRepair
    const heal = healFn ? healFn() : null
    if (heal && !heal.missing && (heal.state === 'repaired' || heal.state === 'ok')) {
      let probeOk = heal.state === 'ok'
      if (heal.state === 'repaired') {
        const again = run()
        try { probeOk = JSON.parse(again.stdout).state === 'ok' } catch { probeOk = false }
      }
      clearUndeterminedStreak(driftFile)
      clearUndeterminedStreak(undetFile)
      logger(
        heal.state === 'repaired'
          ? `✅ 公网出口 IP 漂移已自愈:EO 源站 ${heal.oldOrigin || parsed.expectedSet || '?'} → ${heal.origin}(出口 ${parsed.currentIp}),公网入口已验证${probeOk ? '' : ';运行时台账下轮重读'}`
          : `✅ 公网出口 IP 巡检:EO 现配 == 现测出口(${parsed.currentIp}),链路正常(仓内台账过期不影响判定)`,
      )
      return { state: 'self-healed', healed: heal.state, wan: parsed.currentIp }
    }
    const faces = (parsed.verdicts || []).filter((v) => v.state === 'drift').map((v) => v.face).sort().join('+') || 'na'
    // 起始形状钉 face 集合(同 deploy-stall 型②):事件中途又漂一枚面会进正文,但不另开身份刷屏
    const { firstMs, heldMs } = noteUndeterminedStreak(driftFile, now, { faces })
    const held = alertHeldTier(firstMs, now)
    logger(`❌ 公网出口 IP 与 EdgeOne 源站期望不一致(drift):${faces}(已持续 ${Math.round(heldMs / 60000)} 分钟,持续档=${held.tier})`)
    const healNote = heal && !heal.missing && heal.state ? `\n自愈未完成:${heal.state}${heal.reason ? `(${heal.reason})` : ''}${heal.rolledBack === false ? ' [回滚也失败]' : ''}` : ''
    notify('公网出口 IP 与 EdgeOne 源站期望不一致(全公网链路正在或即将 5xx)', `${egressAlertDetail(parsed, '漂移')}${healNote}\n已持续 ${Math.round(heldMs / 60000)} 分钟;持续档=${held.tier}(跨 6h/24h/72h 档即新身份重报)。`, {
      severity: 'critical',
      dedupKey: `egress-drift;faces=${faces};tier=${held.tier}`,
    })
    clearUndeterminedStreak(undetFile)
    return { state: 'drift', faces, tier: held.tier, heal: heal && !heal.missing ? heal.state : 'skipped' }
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

// 〈原 18 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2949(门 103 C1 收口)〉首意: 生产签出外来工作巡检已外置至 scripts/git-guardian-prod-foreign.mjs
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

// 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3027(门 103 C1 收口)〉首意: 看门人的看守(2026-09-23 立)。凭据/部署停摆巡检靠 schtasks 每 6 小时自跑,而它的故障
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

/**
 * 元运维巡检的**心跳消费者**(2026-10-17 立)。
 *
 * 盲区:巡检由本文件的 `auditOpsPatrol()` 派发,并每轮落 `.ihui-agent/state/ops-patrol-last.json`。
 * 但那份心跳**一直只有写入者、没有读者** —— 巡检自己停摆时(调度器瞎了、auditOpsPatrol
 * 被并发提交整份写回而静默消失、脚本抛错早退),账面没有任何一格会红:它判的是"别的任务
 * 没在跑",而"它自己没在跑"没有任何判据。这正是本仓反复记的那一型:故障形态是**安静**。
 *
 * 与 watchWatchdog 同一条挂点语义、同一套处置:心跳超时(3× 派发周期 = 45 分钟,
 * 避开机器休眠/夜间空档误报)⇒ 写日志 + 当场起跳一轮 `--json`(它自己会决定报不报红),
 * 起跳标记落盘做 6h 冷却,避免每 2 分钟重复拉起。
 *
 * 三态纪律(与 §12 同规矩,**不从"读不到"推"坏了"**):
 *   - 文件不存在 / 内容不可解析 / `at` 不是合法时间 ⇒ 记「未判定」并点名原因,**不喊人**
 *     (新装的机器还没跑过第一轮,那是"没发生"而非"坏了";喊了就是噪音);
 *   - 判定为超时 ⇒ 日志 + 起跳自愈,同样**不直接发信**(起跳那一轮跑完会自己按尺度报);
 *   - 任何异常只写日志,不改本守护退出码(它是调度层,不是判据)。
 */
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

// 〈原 17 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3175(门 103 C1 收口)〉首意: 公网路径与换流窗口的**常驻**探测派发点(台账票 G-301;尺子本体 = `scripts/check-public-path-probe.mjs`)。
const PUBLIC_PROBE_TICK = join(WORKTREE, '.ihui-agent', 'state', 'public-path-probe-tick.ts')
const PUBLIC_PROBE_LAST = join(WORKTREE, '.ihui-agent', 'state', 'public-path-probe-last.json')
const PUBLIC_PROBE_INTERVAL_MS = Number(process.env.IHUI_PUBLIC_PROBE_INTERVAL_MS || 30 * 60 * 1000)
/** 尺子最坏墙钟:90 次公网 × 上限 15s 的极端不可能全中,但一次守护不能被网络拖死 ⇒ 硬超时 */
const PUBLIC_PROBE_TIMEOUT_MS = Number(process.env.IHUI_PUBLIC_PROBE_TIMEOUT_MS || 240_000)
/** 持续性门槛的状态件:按身份记"同一结论连了几轮" */
const PUBLIC_PROBE_STREAK_FILE = join(WORKTREE, '.ihui-agent', 'state', 'public-path-probe-streak.json')
// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3199(门 103 C1 收口)〉首意: 同一身份连续第几轮越阈才到人。**默认 2 = 最长约 30 分钟**(一轮节流 30 分钟)。
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
// 带伤快档(2026-10-29):自愈状态里存在未恢复的 down 链时,下一轮隔这么久而非标称 30 分钟 ——
// 成本按现读取过(自愈一轮实测 5.3 秒 ⇒ 2 分钟档约 4% 占空),窗口封顶 15 分钟:超窗说明已喊过人,
// 不再自行加密(§「抑制告警必须有终态」同一条纪律)。三个旋钮都可 env 覆盖;置 0 即回旧行为。
const SERVICE_HEAL_RETRY_MS = Number(process.env.IHUI_SERVICE_HEAL_RETRY_MS || 2 * 60 * 1000)
const SERVICE_HEAL_RETRY_WINDOW_MS = Number(process.env.IHUI_SERVICE_HEAL_RETRY_WINDOW_MS || 15 * 60 * 1000)

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3216(门 103 C1 收口)〉首意: 工作区写索引动作的节流(2026-10-04 复核补)。
const WORKTREE_HEAL_INTERVAL_MS = Number(process.env.IHUI_WORKTREE_HEAL_INTERVAL_MS || 5 * 60 * 1000)
const WORKTREE_ALIGN_TICK = join(WORKTREE, '.ihui-agent', 'state', 'worktree-align-tick')
const SERVICE_HEAL_TIMEOUT_MS = Number(process.env.IHUI_SERVICE_HEAL_TIMEOUT_MS || 420_000)

// 〈原 24 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-25.md#guardian-l3279(门 103 C1 收口)〉首意: 
export function healUnresponsiveServices(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = SERVICE_HEAL_INTERVAL_MS,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'service-heal-tick.iso'),
    stateFile = join(WORKTREE, '.ihui-agent', 'state', 'service-heal-state.json'),
    retryMs = SERVICE_HEAL_RETRY_MS,
    retryWindowMs = SERVICE_HEAL_RETRY_WINDOW_MS,
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
  // 择档(2026-10-29):带伤 ⇒ 快档,其余一律标称。状态读不到 ⇒ 标称 + mode=undetermined ——
  // 既不猜"还带伤"(那会把节流永久钉死在快档),也不猜"已恢复"(那会维持半小时空档)。
  let stateText = null
  let stateReadError = null
  try {
    stateText = existsSync(stateFile) ? String(readFileSync(stateFile, 'utf8')) : null
  } catch (e) {
    stateReadError = e?.message ?? String(e)
  }
  const cadence = serviceHealCadence({ stateText, readError: stateReadError, nowMs: now, nominalMs: intervalMs, retryMs, retryWindowMs })
  if (!publicProbeDue(now, lastTick, cadence.intervalMs)) return { ran: false, why: '未到节流窗口', mode: cadence.mode, intervalMs: cadence.intervalMs }
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
      return { ran: true, ok: false, why: '结论不可解析', mode: cadence.mode }
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
        `本轮拉起 ${acted.length} 台 / 失败 ${failed.length} 台(实时计数只进正文,不进身份):\n${body}\n\n在册 ${c.checked ?? '?'} 台:应答 ${c.answering ?? '?'} / 设计内停止 ${c.expectedStopped ?? '?'} / 未判定 ${c.undetermined ?? '?'} / 观察 ${c.watch ?? '?'} / 冷却 ${c.cooldown ?? '?'} / 窗口封顶 ${c.capped ?? '?'}\n手动复现:node scripts/heal-unresponsive-services.mjs(只读)`,
        // 2026-10-04 复核补(细节移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md):原传 alertName 被
        // notifyGuardRed 静默丢弃 ⇒ 改传 dedupKey(真正被消费的字段),身份取「哪些服务」集合、有序无关。
        { dedupKey: `service-heal;svcs=${[...acted, ...failed].map((x) => x.name).sort().join('+') || 'fail'};acted=${alertCountTier(acted.length)};failed=${alertCountTier(failed.length)}` },
      )
    }
    // ── "自愈只能交人"这一型终态必须到人(2026-10-21 实测)────────────────────────────
    // 现场:IHUI-API 因 Fastify 重复路由声明在 boot 期抛错,崩溃循环 126 次、8802 从未监听、
    // 登录全量 500 持续 45 分钟,而**一封信都没有**。原因是上面的发信条件只认
    // `restarted` / `restart-failed`,而自愈按 60 分钟窗口最多拉两次(`maxRestartsPerWindow: 2`),
    // 两次都无效之后就进入 `window-capped` —— 既不在 acted 也不在 failed,从此只往日志写一行
    // "请人看"。于是**越是不重启能解决的故障越安静**,恰好把最该喊人的那一型留成静默。
    // 同型的第二个入口是**名单外故障**(`not-in-list` 且真坏了):排除台账的 reason 通篇写着
    // "只喊人",而"只喊人"从来没有生产者 —— 门 153 只是提交链上的 warn,几天没人提交就几天不响。
    // 2026-10-21 现读:IHUI-OLLAMA `STATE=STOPPED`、Application 路径已不存在、11434 无应答,
    // 全仓无一行发信代码看得到它。
    // 两个入口共用一件器物(§0.6 单一真相源):身份 = 服务名集合 × 持续档(跨档即新身份 ⇒
    // 越拖越响,不会被窗口压成静音),解除即摘起点状态件,正文必须带可执行出路(§5e-1)。
    //
    // `firstAlertAfterMs` 是给**第三个入口(量不到)**用的:一轮未判定必须只报名(§0.3 —— 把
    // "没判"读成"坏了"等于让一把量不到的尺子获得重启权与发信权),但"连续六小时量不到"本身
    // 就是一起事故:**看守层瞎了**。这一档原先只写日志,于是"门 153 整个坏了"这件事恰好落在
    // 唯一能发现它的那封信根本没发出来的位置上。门槛取 6h 不另拍新数 = `alertHeldTier` 的第一
    // 条已登记档界(6h/24h/72h),到点第一封就是 6-24h 档,之后照常跨档升级。
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
      mode: cadence.mode,
    }
  } catch (e) {
    logger(`⚠️ 服务自愈异常:${String(e?.message || e).slice(0, 200)}`)
    return { ran: true, ok: false, why: String(e?.message || e) }
  }
}

const OPS_PATROL_INTERVAL_MS = Number(process.env.IHUI_OPS_PATROL_INTERVAL_MS || 15 * 60 * 1000)
// 2026-10-26 由 180s 提到 300s:整轮巡检本机实测 ≈101s(其中 HEAD 类型检查 ≈64s 跑 20 个端),
// 180s 在共享 git 争用/他席并发 tsc 时不够 ⇒ 巡检被 SIGTERM,守护只拿到 `ETIMEDOUT`、
// 拿不到任何一维读数,于是每轮寄一封「元运维巡检红」——报的是巡检自己没跑完,不是哪一维坏了。
// 360s 仍是有界上限(守门 80),且**大于**内层 runHeadTypecheck 的 240s(嵌套超时纪律:
// 内层先超时只会把 P12 降成未判定,不会连根拔掉整轮结论)。
const OPS_PATROL_TIMEOUT_MS = Number(process.env.IHUI_OPS_PATROL_TIMEOUT_MS || 360_000)
// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3429(门 103 C1 收口)〉首意: ── 巡检发信的持续性门槛(2026-10-16 立,与 auditPublicPathProbe 共用 `bumpProbeStreak` 同一份实现)──
const OPS_PATROL_STREAK_FILE = join(WORKTREE, '.ihui-agent', 'state', 'ops-patrol-streak.json')
const OPS_PATROL_STREAK_REQUIRED = Number(process.env.IHUI_OPS_PATROL_STREAK || 3)
const OPS_PATROL_STREAK_TTL_MS = Number(process.env.IHUI_OPS_PATROL_STREAK_TTL_MS || 24 * 60 * 60 * 1000)

/** 节流判定(纯函数):距上次派发是否已够一个间隔。取不到 tick 文件 ⇒ 视为**该跑了**。 */
export function publicProbeDue(nowMs, tickMs, intervalMs = PUBLIC_PROBE_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/**
 * 服务自愈的**派发节奏**择档(2026-10-29 立;纯函数,零 IO ⇒ 可构造面锁)。
 *
 * 立因是当晚量出来的一个空档:09:31:54 本机重启把 web 入口留在 Manual 态,09:33:15 这一轮自愈
 * 已经看见它 down 了(`strikes=1`),但 `consecutiveRounds=2` 要求下一轮才动手,而下一轮排在
 * **30 分钟之后** ⇒ 从"已经发现"到"真的去拉"要等半小时,期间站点 522。确认轮数不能减(它就是防
 * 瞬时抖动的),能动的只有"一轮隔多久":带伤(有未恢复的 down 链且开账未满 `retryWindowMs`)时压到
 * `retryMs`,恢复或超窗即回 nominal。成本按现读取过:自愈一轮实测 5.3 秒 ⇒ 2 分钟档约占 4%,封顶 15 分钟。
 *
 * 失效方向照 §0.3:状态文件读不到/解不出 ⇒ 回 nominal 并点名 `undetermined`,绝不因为"看不见"就
 * 判定"没有带伤",也绝不反过来把 nominal 当 retry(那会把节流永久钉死在 2 分钟)。
 */
export function serviceHealCadence({ stateText = null, readError = null, nowMs = Date.now(), nominalMs, retryMs, retryWindowMs }) {
  if (readError) return { intervalMs: nominalMs, open: null, mode: 'undetermined', why: `自愈状态读不出(${readError})⇒ 按标称节流,不猜带伤` }
  let parsed = null
  try {
    parsed = stateText === null || stateText === undefined ? null : JSON.parse(String(stateText))
  } catch (e) {
    return { intervalMs: nominalMs, open: null, mode: 'undetermined', why: `自愈状态不可解析(${e?.message ?? e})⇒ 按标称节流,不猜带伤` }
  }
  if (!parsed || typeof parsed !== 'object') return { intervalMs: nominalMs, open: null, mode: 'nominal', why: '还没有跑过任何一轮 ⇒ 无带伤链' }
  const services = parsed.services && typeof parsed.services === 'object' ? parsed.services : {}
  const ages = []
  for (const [name, s] of Object.entries(services)) {
    const strikes = Number(s?.strikes ?? 0)
    if (!(strikes > 0)) continue
    const since = Number(s?.sinceMs)
    // 开账时刻缺失(旧状态文件形态)⇒ 按"本轮才发现"处理:先给一次快档,下一轮 healer 自己会把 sinceMs 写上。
    ages.push({ name, strikes, ageMs: Number.isFinite(since) ? Math.max(0, nowMs - since) : 0 })
  }
  if (ages.length === 0) return { intervalMs: nominalMs, open: null, mode: 'nominal', why: '在册服务均已恢复 ⇒ 回标称节流' }
  const oldest = ages.reduce((a, b) => (a.ageMs >= b.ageMs ? a : b))
  if (oldest.ageMs >= retryWindowMs)
    return { intervalMs: nominalMs, open: oldest, mode: 'window-expired', why: `带伤链已开账 ${Math.round(oldest.ageMs / 60_000)} 分钟,超过快档窗口 ${Math.round(retryWindowMs / 60_000)} 分钟 ⇒ 回标称节流(已经喊过人,不再自行加密)` }
  return { intervalMs: retryMs, open: oldest, mode: 'retry', why: `${oldest.name} 连续 down ${oldest.strikes} 轮 / 开账 ${Math.round(oldest.ageMs / 1000)} 秒 ⇒ 快档 ${Math.round(retryMs / 1000)} 秒后再问一轮` }
}

/**
 * 元运维巡检的**常驻**派发点(尺子本体 = `scripts/check-ops-patrol.mjs`)。
 *
 * 为什么必须挂在这里:这把尺子判的是"某件事**没有发生**"(任务消失、规则没上岗、运行副本漂了、
 * 时钟 13 小时没同步、备份不产出、云同步那条腿的同步客户端根本没开)。这类故障不产生任何一行错误日志,
 * 而它按设计**不能进提交链** —— 判据落在机器状态上,提交者结构上满足不了,挂 blocking 就是每台每次
 * 被逼 `--no-verify`、连带链上全部守门对该提交作废(§12e/§12f)。"留作手动问责"的实际含义是
 * **只有人在跑、没有班次在跑**,而本仓对这一型的名字就叫"造好没装车"。本守护是唯一的调度器。
 *
 * 2026-09-29 实录(本条目自身被这一型咬过,故把教训写在装它的函数头上):本派发点曾于
 * `2dfb456fce` 装好并实测发信成功,一小时内被并发提交 `a3ad07092f`(一枚"扫码死链修复")
 * **按旧基线整份写回** `git-guardian.mjs` 而抹掉(净删 1552 行)—— 尺子还在、判据还对、
 * 账面全绿,而它已经无人调度。镜像测试 T1/T2/T4 就是为抓住这一次而存在的。
 *
 * 三个执行体细节,漏一个都会变成"看起来在跑":
 * - 节流戳与 `--apply` **两个执行体共用**:谁先到谁干活,同窗口内另一个直接跳过;
 * - 红经 `notifyGuardRed` 走邮件,沿用"身份 + 内容指纹 4h 去重",无总量封顶;
 * - 未判定**只写日志不喊人**(与 auditPublicPathProbe 同规矩),但必须报名。
 */
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
          // 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3582(门 103 C1 收口)〉首意: dedupKey(§5e-1 配套,24 封):聚合告警的正文是**逐格 detail 清单**,而每格 detail
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

// 〈原 16 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3617(门 103 C1 收口)〉首意: 持续性门槛的判据(纯函数,镜像测试直接调它,不在测试里复制第二份判据 §22c)。
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
    // 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3743(门 103 C1 收口)〉首意: 判序(2026-10-03 补修,此前是本仓**唯一没修**的一处同型):`runner || (iife())` 在
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
        // 〈原 11 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3819(门 103 C1 收口)〉首意: alert 身份**按序列+目标分开**:A(换流窗口)与 B(常态公网)是两个不同的故障,
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
        // 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3859(门 103 C1 收口)〉首意: 身份 = **成因 × 严重度档 × 已持续档**(归一住在尺子那侧,§0.6),而不是"序列+结论"。
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

// 〈原 16 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3904(门 103 C1 收口)〉首意: 隧道腿健康哨的**常驻**派发点(尺子本体 = `scripts/check-tunnel-leg-health.mjs`)。
const TUNNEL_LEG_TICK = join(WORKTREE, '.ihui-agent', 'state', 'tunnel-leg-tick.ts')
const TUNNEL_LEG_LAST = join(WORKTREE, '.ihui-agent', 'state', 'tunnel-leg-health-last.json')
const TUNNEL_LEG_INTERVAL_MS = Number(process.env.IHUI_TUNNEL_LEG_INTERVAL_MS || 15 * 60 * 1000)
const TUNNEL_LEG_TIMEOUT_MS = Number(process.env.IHUI_TUNNEL_LEG_TIMEOUT_MS || 90_000)

// 〈原 17 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l3925(门 103 C1 收口)〉首意: 隧道指标落台账的**常驻**派发点(尺子本体 = `scripts/record-tunnel-metrics.mjs`)。
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

// 〈原 21 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-25.md#guardian-l4089(门 103 C1 收口)〉首意: 
/** 违禁桶兜底清扫派发层(2026-10-25,与 sweepStaleClosedRows 同型):5 分钟节流 + 器物不在位
 *  明报"跳过不记为已探测"(§0.3),三态读数只认器物自己的 SWEEP-RESULT 结论行。 */
export function sweepBannedBuckets(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = 5 * 60 * 1000,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'banned-bucket-sweep-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'strip-banned-buckets.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 违禁桶清扫:器物不在位(scripts/strip-banned-buckets.mjs)⇒ 本轮跳过,不记为已探测')
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
    logger(`⚠️ 违禁桶清扫:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`)
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
  const resultLine = rows.map((l) => l.match(/SWEEP-RESULT\s+state=([A-Za-z-]+)(.*)$/)).find(Boolean)
  const state = resultLine ? resultLine[1] : null
  const kv = (key) => {
    const m = resultLine ? String(resultLine[2]).match(new RegExp(`\\b${key}=(\\S+)`)) : null
    return m ? m[1] : null
  }
  if (state === 'clean') {
    logger('ℹ️ 违禁桶清扫:干净(waiting-env/waiting-human 未勾行 0,读数来自器物)')
    return { ran: true, judged: true, ok: true, state }
  }
  if (state === 'stripped' && Number(kv('stripped')) > 0) {
    logger(`✅ 违禁桶清扫:摘除 ${kv('stripped')} 条(留痕 f12-purge;禁令循环回潮已自动收敛)`)
    return { ran: true, judged: true, ok: true, state, stripped: Number(kv('stripped')) }
  }
  if (state === 'undetermined') {
    logger('⚠️ 违禁桶清扫:未判定(取材取不到/落地被拒)——不记通过,下轮重试')
    return { ran: true, judged: true, ok: false, state }
  }
  // stripped=0 且非 clean(pending 型 dry-run 语义不应出现在 --apply 档;记一笔不猜)
  logger(`ℹ️ 违禁桶清扫:结论 state=${state ?? '读不到'}(stripped=${kv('stripped') ?? '?'})`)
  return { ran: true, judged: state !== null, ok: state !== null, state }
}

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

// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l4105(门 103 C1 收口)〉首意: 超龄认领牌代摘轮(2026-10-22 立,同日补回:这一层曾被一枚已入库的提交整段删掉而无人发现
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

// 〈原 17 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l4198(门 103 C1 收口)〉首意: 清扫背离巡检(2026-10-23 立,机主令"要"):判"派发在动、留痕静默"这一族空转 ——
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

// 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l4305(门 103 C1 收口)〉首意: index 烂尾(unmerged 条目)滞留哨兵(2026-10-24 立):凌晨一次违规 stash + rebase +
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

// lint-staged stdio 三针盯针(2026-10-27):判据/节流/到人住 lib/lint-staged-pin-audit.mjs;判机器状态 ⇒ 不进提交链(§12e)。
const PIN_TICK = join(WORKTREE, '.ihui-agent', 'state', 'lint-staged-pin-tick.json')
export function auditLintStagedPins(opts = {}) {
  return pinsAudit({ tickFile: PIN_TICK, logger: log, notify: notifyGuardRed, ...opts })
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

/** 短信发送通道健康的**常驻**派发点(尺子本体 = `scripts/check-sms-channel-health.mjs`,2026-10-27 立) */
const SMS_HEALTH_TICK = join(WORKTREE, '.ihui-agent', 'state', 'sms-channel-health-tick.ts')
const SMS_HEALTH_FIRST = join(WORKTREE, '.ihui-agent', 'state', 'sms-channel-health-first.json')
const SMS_HEALTH_LAST = join(WORKTREE, '.ihui-agent', 'state', 'sms-channel-health-last.json')
const SMS_HEALTH_INTERVAL_MS = Number(process.env.IHUI_SMS_HEALTH_INTERVAL_MS || 15 * 60 * 1000)
const SMS_HEALTH_TIMEOUT_MS = Number(process.env.IHUI_SMS_HEALTH_TIMEOUT_MS || 60_000)

export function auditSmsChannelHealth(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = SMS_HEALTH_INTERVAL_MS,
    tickFile = SMS_HEALTH_TICK,
    firstFile = SMS_HEALTH_FIRST,
    lastFile = SMS_HEALTH_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-sms-channel-health.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 短信通道健康:尺子脚本不在位(scripts/check-sms-channel-health.mjs)⇒ 本轮跳过')
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
                windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
                timeout: SMS_HEALTH_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 20,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式接管 stdio
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
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || ''))
    } catch {
      /* 落到未判定 */
    }
    if (!parsed || typeof parsed.verdict !== 'string') {
      logger(
        `⚠️ 短信通道健康未产出结论(未判定,不记为已探测):rc=${call.status} ${(
          [call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)'
        )
          .split(/\r?\n/)[0]
          .slice(0, 140)}`,
      )
      return { ran: true, judged: false, why: '结论不可解析' }
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify(parsed, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响 --status 可见性,不影响告警本身 */
    }
    const verdict = parsed.verdict
    if (verdict === 'breach') {
      // 身份按"类别 + 尝试量档 + 持续档"折叠:明细(失败条数、具体手机号)会抖,写进身份就是风暴。
      const held = alertHeldTier(noteUndeterminedStreak(firstFile, now).firstMs, now)
      notify(
        '短信通道不出量(登录验证码发不出去)',
        `读数:${String(parsed.detail || '(尺子未给原因)')}\n近 24h 尝试=${parsed.attempts} 成功=${parsed.success};近 1h 尝试=${parsed.lastHourAttempts}\n尺子:scripts/check-sms-channel-health.mjs(只读投递审计表 sms_delivery_logs,不碰云端接口)\n取证:node scripts/check-sms-channel-health.mjs --json(或读 .ihui-agent/state/sms-channel-health-last.json)\n出路:去阿里云费用中心充值 / 购买短信套餐包,然后复跑上面那条命令确认转 ok —— 这是本判据唯一能让它转绿的整改动作。`,
        {
          severity: 'warning',
          dedupKey: `verdict=breach;attempts=${alertCountTier(parsed.attempts)};held=${held.tier}`,
        },
      )
      logger(`❌ 短信通道不出量:${String(parsed.detail || '').slice(0, 200)}(已按身份去重发信)`)
      return { ran: true, judged: true, breaches: 1, unjudged: 0 }
    }
    if (verdict === 'unjudged') {
      // 未判定既不续命也不清零(§0.3);只写日志,不喊人 —— 取不到样本不等于通道坏了
      logger(`ℹ️ 短信通道健康:未判定 —— ${String(parsed.detail || '(无原因)').slice(0, 200)}`)
      return { ran: true, judged: false, why: '未判定' }
    }
    clearUndeterminedStreak(firstFile)
    logger(`✅ 短信通道健康:${String(parsed.detail || '').slice(0, 160)}`)
    return { ran: true, judged: true, breaches: 0, unjudged: 0 }
  } catch (e) {
    logger('⚠️ 短信通道健康派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/** 资产路径可达性 + 证书到期的**常驻**派发点(尺子 = `scripts/check-asset-path-health.mjs`,2026-10-28 立) */
const ASSET_PATH_TICK = join(WORKTREE, '.ihui-agent', 'state', 'asset-path-tick.ts')
const ASSET_PATH_FIRST = join(WORKTREE, '.ihui-agent', 'state', 'asset-path-first.json')
const ASSET_PATH_LAST = join(WORKTREE, '.ihui-agent', 'state', 'asset-path-last.json')
const ASSET_PATH_INTERVAL_MS = Number(process.env.IHUI_ASSET_PATH_INTERVAL_MS || 6 * 60 * 60 * 1000)
const ASSET_PATH_TIMEOUT_MS = Number(process.env.IHUI_ASSET_PATH_TIMEOUT_MS || 120_000)

// 反馈闭环断点巡检(2026-10-28 立):闭环器件此前**没有任何自动调用者** ⇒ 链断了没人喊。
const FEEDBACK_CLOSURE_INTERVAL_MS = Number(
  process.env.IHUI_FEEDBACK_CLOSURE_INTERVAL_MS || 30 * 60 * 1000,
)
const FEEDBACK_CLOSURE_TIMEOUT_MS = Number(process.env.IHUI_FEEDBACK_CLOSURE_TIMEOUT_MS || 120_000)
const FEEDBACK_CLOSURE_WINDOW_MS = Number(
  process.env.IHUI_FEEDBACK_CLOSURE_WINDOW_MS || 48 * 60 * 60 * 1000,
)
const FEEDBACK_CLOSURE_TICK = join(
  WORKTREE,
  '.ihui-agent',
  'state',
  'feedback-loop-closure-tick.ts',
)
const FEEDBACK_CLOSURE_LAST = join(
  WORKTREE,
  '.ihui-agent',
  'state',
  'feedback-loop-closure-last.json',
)

export function auditAssetPathHealth(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = ASSET_PATH_INTERVAL_MS,
    tickFile = ASSET_PATH_TICK,
    firstFile = ASSET_PATH_FIRST,
    lastFile = ASSET_PATH_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-asset-path-health.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 资产路径健康:尺子脚本不在位(scripts/check-asset-path-health.mjs)⇒ 本轮跳过,不记为已探测')
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
                windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
                timeout: ASSET_PATH_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式接管 stdio
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
    if (!parsed || typeof parsed.verdict !== 'string') {
      logger(`⚠️ 资产路径健康未产出结论(未判定,不记为已探测):rc=${call.status} ${([call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').split(/\r?\n/)[0].slice(0, 140)}`)
      return { ran: true, judged: false, why: '结论不可解析' }
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify(parsed, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响可见性,不影响告警本身 */
    }
    const missing = Array.isArray(parsed?.env?.missing) ? parsed.env.missing : []
    const certErr = Number(parsed?.certs?.error || 0)
    const certWarn = Number(parsed?.certs?.warning || 0)
    if (parsed.verdict === 'breach') {
      // 身份按"断链数 + 证书错误数 + 持续档"折叠:具体路径会随整改位移,写进身份就是风暴
      const held = alertHeldTier(noteUndeterminedStreak(firstFile, now).firstMs, now)
      const lines = missing.slice(0, 12).map((m) => `· ${m.file}:${m.line} ${m.key} -> ${m.path}`)
      if (missing.length > 12) lines.push(`· …另 ${missing.length - 12} 条(计数已含)`)
      notify(
        `生产资产断链:${missing.length} 条路径不可达 / 证书错误 ${certErr}`,
        `断链清单(.env 指向的文件/目录在当前主机不在位):\n${lines.join('\n') || '(无)'}\n证书:ok=${parsed?.certs?.ok ?? 'n/a'} warn=${certWarn} err=${certErr}\n尺子:scripts/check-asset-path-health.mjs(只读,不打印值,证书到期委托 cert-expiry-check.mjs)\n取证:node scripts/check-asset-path-health.mjs --json(或读 .ihui-agent/state/asset-path-last.json)\n出路:按清单把键值改到真实位置(盘符迁移/同步盘换盘最常见),改完复跑上面那条命令;运行时改了 .env 需重启对应服务才生效。`,
        { severity: 'warning', dedupKey: `verdict=breach;missing=${alertCountTier(missing.length)};certErr=${alertCountTier(certErr)};held=${held.tier}` },
      )
      logger(`❌ 资产路径断链 ${missing.length} 条 / 证书错误 ${certErr}(已按身份去重发信)`)
      return { ran: true, judged: true, breaches: 1, missing: missing.length, certErr }
    }
    if (parsed.verdict === 'warn') {
      logger(`⚠️ 资产路径健康报数(不判红):${String(parsed.why || `证书临近到期 ${certWarn} 张`).slice(0, 180)}`)
      clearUndeterminedStreak(firstFile)
      return { ran: true, judged: true, breaches: 0, warns: 1 }
    }
    if (parsed.verdict === 'unjudged') {
      // 未判定既不续命也不清零(§0.3);取不到输入不等于坏
      logger(`ℹ️ 资产路径健康:未判定 —— ${String(parsed.why || '(无原因)').slice(0, 200)}`)
      return { ran: true, judged: false, why: '未判定' }
    }
    clearUndeterminedStreak(firstFile)
    logger(`✅ 资产路径健康:${parsed?.env?.scanned?.length ?? 0} 份 env 全部可达,证书 ok=${parsed?.certs?.ok ?? 'n/a'}`)
    return { ran: true, judged: true, breaches: 0, unjudged: 0 }
  } catch (e) {
    logger('⚠️ 资产路径健康派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/** 生产依赖漏洞巡检的**常驻**派发点(尺子 = `scripts/check-prod-dep-advisories.mjs`,2026-10-29 立) */
const PROD_DEP_TICK = join(WORKTREE, '.ihui-agent', 'state', 'prod-dep-audit-tick.ts')
const PROD_DEP_FIRST = join(WORKTREE, '.ihui-agent', 'state', 'prod-dep-audit-first.json')
const PROD_DEP_LAST = join(WORKTREE, '.ihui-agent', 'state', 'prod-dep-audit-last.json')
// 6h 一次:新 CVE 的发现延迟上限就是它。快照本身有 30 天宽限,6h 远快于宽限 ⇒
// 正常路径下不会走到「快照过期才想起刷新」,那条只是兜底。
const PROD_DEP_INTERVAL_MS = Number(process.env.IHUI_PROD_DEP_INTERVAL_MS || 6 * 60 * 60 * 1000)
// 实测 `pnpm audit --registry` 6.8s;给 3 分钟余量覆盖网络抖动与首次冷启动。
const PROD_DEP_TIMEOUT_MS = Number(process.env.IHUI_PROD_DEP_TIMEOUT_MS || 180_000)

/**
 * 生产依赖漏洞巡检(2026-10-29 立)。
 *
 * 立因:守门 260 只在提交链/全量档判,而**提交链不会因为「上游发了新 CVE」而触发** ——
 * 没有这个派发点,新 CVE 要等到下一个人恰好提交且恰好跑全量档才会被发现,等于没守。
 *
 * 判定语义照抄资产路径那条(同族):
 *   · red ⇒ 发信(critical):生产可达的 critical/high 出现未豁免项;
 *   · warn ⇒ 发信(warning):豁免临期(30 天内到期)—— 到期本身不是错,「到期没人知道」才是;
 *   · unjudged ⇒ **只写日志不喊人**(§0.3):网络不通/registry 抽风不是缺陷,喊了就是狼来了;
 *   · clean ⇒ 清未判定连击。
 */
export function auditProdDepAdvisories(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = PROD_DEP_INTERVAL_MS,
    tickFile = PROD_DEP_TICK,
    firstFile = PROD_DEP_FIRST,
    lastFile = PROD_DEP_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-prod-dep-advisories.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 生产依赖审计:尺子脚本不在位(scripts/check-prod-dep-advisories.mjs)⇒ 本轮跳过,不记为已探测')
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
                windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
                timeout: PROD_DEP_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式接管 stdio
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
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || ''))
    } catch {
      /* 落到未判定 */
    }
    if (!parsed || typeof parsed.verdict !== 'string') {
      logger(
        `⚠️ 生产依赖审计未产出结论(未判定,不记为已探测):rc=${call.status} ${(
          [call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)'
        )
          .split(/\r?\n/)[0]
          .slice(0, 140)}`,
      )
      return { ran: true, judged: false, why: '结论不可解析' }
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify(parsed, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响可见性,不影响告警本身 */
    }

    if (parsed.verdict === 'red') {
      const red = Array.isArray(parsed.red) ? parsed.red : []
      const held = alertHeldTier(noteUndeterminedStreak(firstFile, now).firstMs, now)
      const lines = red
        .slice(0, 12)
        .map((r) => `· ${r.module} [${r.severity}] ${r.kind}${r.patched ? ` 修复版:${r.patched}` : ''}`)
      if (red.length > 12) lines.push(`· …另 ${red.length - 12} 条(计数已含)`)
      notify(
        `生产依赖出现未豁免的 critical/high:${red.length} 条`,
        `生产可达的 critical/high 必须为 0。当前未豁免项:\n${lines.join('\n') || '(无)'}\n\n` +
          `尺子:scripts/check-prod-dep-advisories.mjs(守门 260)\n` +
          `取证:node scripts/check-prod-dep-advisories.mjs --json(或读 .ihui-agent/state/prod-dep-audit-last.json)\n` +
          `出路只有两条:① 升级到修复版;② 确属运行时不可达 ⇒ 在 scripts/data/dep-audit-policy.json 加 waiver\n` +
          `(三要素 module/reason/expiresAt,reason 必须写清「为什么这个漏洞 API 不可达」,并给硬证据)。`,
        {
          severity: 'critical',
          dedupKey:
            `verdict=red;n=${alertCountTier(red.length)};` +
            `mods=${red
              .slice(0, 3)
              .map((r) => r.module)
              .sort()
              .join(',')};held=${held.tier}`,
        },
      )
      logger(`❌ 生产依赖:未豁免 critical/high ${red.length} 条(已按身份去重发信)`)
      return { ran: true, judged: true, breaches: red.length }
    }

    if (parsed.verdict === 'warn') {
      const soon = Array.isArray(parsed.expiringSoon) ? parsed.expiringSoon : []
      notify(
        `依赖豁免临期:${soon.map((s) => `${s.module}(${s.daysLeft}天)`).join(', ') || '若干枚'}`,
        `以下豁免将在 30 天内到期。到期当天守门 260 会转红,而那时没人记得当初验的是什么:\n` +
          soon.map((s) => `· ${s.module} → ${s.expiresAt}(剩 ${s.daysLeft} 天)`).join('\n') +
          `\n\n处置:重新验证「该漏洞 API 仍不可达」并把 expiresAt 顺延,或直接升级依赖到修复版后删掉豁免。\n` +
          `政策文件:scripts/data/dep-audit-policy.json`,
        {
          severity: 'warning',
          dedupKey: `verdict=warn;soon=${soon
            .map((s) => s.module)
            .sort()
            .join(',')}`,
        },
      )
      logger(`⚠️ 依赖豁免临期 ${soon.length} 枚(不判红,已发提醒)`)
      clearUndeterminedStreak(firstFile)
      return { ran: true, judged: true, breaches: 0, warns: 1 }
    }

    if (parsed.verdict === 'unjudged') {
      // 未判定既不续命也不清零(§0.3);取不到输入不等于坏,不喊人
      logger(`ℹ️ 生产依赖审计:未判定 —— ${String(parsed.why || '(无原因)').slice(0, 200)}`)
      return { ran: true, judged: false, why: '未判定' }
    }

    clearUndeterminedStreak(firstFile)
    logger(
      `✅ 生产依赖:未豁免 0 条,豁免 ${(parsed.waived || []).length} 枚,` +
        `构建链存量 ${parsed.devOnlyTotal || 0} 条(只报数,不拦)`,
    )
    return { ran: true, judged: true, breaches: 0, unjudged: 0 }
  } catch (e) {
    logger('⚠️ 生产依赖审计派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

export function auditFeedbackLoopClosure(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = FEEDBACK_CLOSURE_INTERVAL_MS,
    windowMs = FEEDBACK_CLOSURE_WINDOW_MS,
    tickFile = FEEDBACK_CLOSURE_TICK,
    lastFile = FEEDBACK_CLOSURE_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'feedback-loop-status.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ 反馈闭环巡检:尺子脚本不在位(scripts/feedback-loop-status.mjs)⇒ 本轮跳过,不记为已探测',
    )
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
  } catch {
    /* 刻度写不掉不影响判据本身 */
  }
  const call =
    typeof runner === 'function'
      ? runner()
      : (() => {
          try {
            const out = execFileSync(process.execPath, [script, '--commits', '300', '--json'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
              timeout: FEEDBACK_CLOSURE_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
              maxBuffer: 1 << 23,
              stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式接管 stdio
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
  const jsonLine = String(call.stdout || '')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('{'))
  let parsed = null
  try {
    parsed = jsonLine ? JSON.parse(jsonLine) : null
  } catch {
    parsed = null
  }
  if (!parsed || !Array.isArray(parsed.incidents)) {
    logger(
      `⚠️ 反馈闭环巡检未产出结论(未判定,不记为已探测):rc=${call.status} ${(
        [call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)'
      )
        .split(/\r?\n/)[0]
        .slice(0, 140)}`,
    )
    return { ran: true, judged: false, why: '结论不可解析' }
  }
  const ORDER = ['perceived', 'ticketed', 'dispatched', 'fixed', 'deployed', 'verified']
  const DONE = new Set(['yes', 'bypassed', 'skip', 'not-requested'])
  const stuck = []
  for (const inc of parsed.incidents) {
    if (!inc || typeof inc !== 'object') continue
    if (inc.status === 'verified' || inc.status === 'rolled_back') continue
    const stages = inc.stages || {}
    const at = inc.evidence?.feedbackAt || inc.evidence?.signalAt || ''
    const t = Date.parse(at)
    if (!Number.isFinite(t) || !(now - t > windowMs)) continue // 处置窗口内:先给人时间
    const stage = ORDER.find((k) => !DONE.has(String(stages[k] ?? ''))) || '(未达成)'
    stuck.push({
      identity: String(inc.identity || '(无身份)'),
      stage,
      why: String(inc.why || '').slice(0, 160),
    })
  }
  const summary = parsed.summary || {}
  try {
    mkdirSync(dirname(lastFile), { recursive: true })
    writeFileSync(
      lastFile,
      JSON.stringify(
        {
          at: new Date(now).toISOString(),
          incidents: summary.incidents ?? null,
          closed: summary.closed ?? null,
          open: summary.open ?? null,
          undetermined: summary.undetermined ?? null,
          stuck,
        },
        null,
        1,
      ),
      'utf8',
    )
  } catch {
    /* 状态件写不掉只影响可见性,不影响告警本身 */
  }
  if (stuck.length === 0) {
    logger(
      `✅ 反馈闭环巡检:${summary.incidents ?? 0} 条事故无超窗卡点(closed=${summary.closed ?? 0} open=${summary.open ?? 0} undetermined=${summary.undetermined ?? 0})`,
    )
    return { ran: true, red: 0, stuck: [] }
  }
  const hours = Math.round(windowMs / 3600_000)
  const keys = stuck.map((s) => `${s.identity}@${s.stage}`)
  notify(
    `反馈闭环卡住超 ${hours}h:${stuck.length} 条`,
    `以下事故在处置窗口(${hours} 小时)之后仍卡在同一段,链路没有推进:\n` +
      stuck.map((s) => `· ${s.identity} ⇒ ${s.why || `断在 ${s.stage}`}`).join('\n'),
    { severity: 'warning', now },
  )
  logger(
    `⚠️ 反馈闭环巡检:${stuck.length} 条超窗卡点(${keys.slice(0, 3).join(' / ')}${keys.length > 3 ? ' …' : ''})`,
  )
  return { ran: true, red: stuck.length, stuck }
}

/**
 * 逐字回潮的**常驻**派发点(尺子 = `scripts/check-verbatim-resurrection.mjs`,2026-10-29 立)。
 * 立因 = 当天入库的一枚对象空间嫁接(`1fe3a2b42d`)把 9 枚"祖先已被显式删除"的路径带回主线,其中
 * `mirror-to-cn.yml` 与被删那份逐字节相同;而全链没有一道门为此响过 —— 守门 168 的 `auditMerge()`
 * 要求 ≥2 个父(单父落进它自己的"未判定"档),旁路落地走 commit-tree 结构上不跑钩子,守门 238 的射程
 * 是 10 个文档不含 workflow 本体。三个盲区叠在一起 = 这型**永远不会被提交链看见**,所以班次只能挂在
 * 这个"看得见一切面"的常驻进程上(按 §12e 它是只读尺子,刻意不进提交链)。
 *
 * 三态:hits>0 发信(身份按条数档折叠,具体靶名进正文不进身份,守门 224)、未判定只写日志不喊人
 * (§0.3,既不续命也不清零)、零命中才清连击。
 */
const VERBATIM_TICK = join(WORKTREE, '.ihui-agent', 'state', 'verbatim-resurrection-tick.ts')
const VERBATIM_FIRST = join(WORKTREE, '.ihui-agent', 'state', 'verbatim-resurrection-first.json')
const VERBATIM_LAST = join(WORKTREE, '.ihui-agent', 'state', 'verbatim-resurrection-last.json')
const VERBATIM_INTERVAL_MS = Number(process.env.IHUI_VERBATIM_INTERVAL_MS || 6 * 60 * 60 * 1000)
const VERBATIM_WINDOW = Number(process.env.IHUI_VERBATIM_WINDOW || 300)
const VERBATIM_TIMEOUT_MS = Number(process.env.IHUI_VERBATIM_TIMEOUT_MS || 600_000)

export function auditVerbatimResurrection(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = VERBATIM_INTERVAL_MS,
    tickFile = VERBATIM_TICK,
    firstFile = VERBATIM_FIRST,
    lastFile = VERBATIM_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-verbatim-resurrection.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 逐字回潮巡检:尺子脚本不在位(scripts/check-verbatim-resurrection.mjs)⇒ 本轮跳过,不记为已探测')
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
              const out = execFileSync(process.execPath, [script, '--json', '--window', String(VERBATIM_WINDOW)], {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
                timeout: VERBATIM_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式接管 stdio
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
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || ''))
    } catch {
      /* 落到未判定 */
    }
    if (!parsed || !Array.isArray(parsed.hits) || !Array.isArray(parsed.undetermined)) {
      logger(
        `⚠️ 逐字回潮未产出结论(未判定,不记为已探测):rc=${call.status} ` +
          `${([call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').slice(0, 200)}`,
      )
      return { ran: true, judged: false, why: '结论不可解析' }
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify(parsed, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响可见性,不影响告警本身 */
    }
    const hits = parsed.hits
    const und = parsed.undetermined
    if (hits.length > 0) {
      const held = alertHeldTier(noteUndeterminedStreak(firstFile, now).firstMs, now)
      notify(
        `逐字回潮:${hits.length} 枚"祖先已声明删除"的路径仍在面上`,
        `尺子 = scripts/check-verbatim-resurrection.mjs(被审面 ${parsed.ref},窗口 ${parsed.window})。\n` +
          '每条给出"加回于哪枚 ← 删除于哪枚";逐条读过两侧内容后二选一:\n' +
          '  ① 就地再摘一次:LAND_REMOVE_PATHS="<路径>" LAND_MSG="chore(retire): …" node scripts/object-space-land.mjs\n' +
          '  ② 确应保留:在 scripts/data/deletion-survival-allowlist.json 登记 path+reason+reviewBy(会到期)\n' +
          hits
            .slice(0, 10)
            .map((h) => `· ${h.path} —— ${String(h.why || '').slice(0, 60)}(删于 ${(h.deletedBy || '').slice(0, 11)},加回于 ${(h.addedBy || '').slice(0, 11)})`)
            .join('\n') +
          (hits.length > 10 ? `\n… 其余 ${hits.length - 10} 条见 ${lastFile}` : ''),
        {
          severity: 'warning',
          dedupKey: `verbatim;hits=${alertCountTier(hits.length)};held=${held.tier}`,
        },
      )
      logger(`❌ 逐字回潮:${hits.length} 条活命中(已按身份去重发信)`)
      return { ran: true, judged: true, hits: hits.length }
    }
    if (und.length > 0) {
      // 未判定既不续命也不清零(§0.3):取证取不到不是"没有回潮"
      logger(`ℹ️ 逐字回潮:未判定 ${und.length} 维 —— ${String(und[0] || '').slice(0, 200)}`)
      return { ran: true, judged: false, undetermined: und.length }
    }
    clearUndeterminedStreak(firstFile)
    logger(`✅ 逐字回潮:零命中(提交 ${parsed.commits} 枚 / 在面候选 ${parsed.candidates} 条 / 台账 ${parsed.allowEntries} 条)`)
    return { ran: true, judged: true, hits: 0 }
  } catch (e) {
    logger('⚠️ 逐字回潮派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/**
 * AASA(apple-app-site-association)公网健康的**常驻**派发点(尺子 = `scripts/check-aasa-public-health.mjs`,
 * 2026-10-29 立)。立因:这台尺子造出来时没人按时跑它 —— 只接了 `pnpm check:aasa-health` 一个手工入口,
 * 而它判的是"公网两腿能不能取到与单源同构的 AASA",属机主面之外唯一可自动守的那半格
 * (UniversalLink 控制台填写那一半仍归机主)。按 §12e 它是只读尺子,刻意不进提交链,唯一调度器就是这里。
 *
 * 三态语义照抄资产路径那台:breach 发信、warn 只报数、unjudged 既不续命也不清零(§0.3)、ok 清零。
 * 身份按"breach 条数档"折叠:`alertCountTier` 管计数,具体靶名会随整改位移,写进身份就是风暴(守门 224)。
 */
const AASA_TICK = join(WORKTREE, '.ihui-agent', 'state', 'aasa-health-tick.ts')
const AASA_FIRST = join(WORKTREE, '.ihui-agent', 'state', 'aasa-health-first.json')
const AASA_LAST = join(WORKTREE, '.ihui-agent', 'state', 'aasa-health-last.json')
const AASA_INTERVAL_MS = Number(process.env.IHUI_AASA_INTERVAL_MS || 6 * 60 * 60 * 1000)
const AASA_TIMEOUT_MS = Number(process.env.IHUI_AASA_TIMEOUT_MS || 120_000)

export function auditAasaPublicHealth(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = AASA_INTERVAL_MS,
    tickFile = AASA_TICK,
    firstFile = AASA_FIRST,
    lastFile = AASA_LAST,
    logger = log,
    notify = notifyGuardRed,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-aasa-public-health.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ AASA 公网健康:尺子脚本不在位(scripts/check-aasa-public-health.mjs)⇒ 本轮跳过,不记为已探测')
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
                windowsHide: true, // §5b:漏此参数在守护/计划任务下必弹控制台窗
                timeout: AASA_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式接管 stdio
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
    let parsed = null
    try {
      parsed = JSON.parse(String(call.stdout || ''))
    } catch {
      /* 落到未判定 */
    }
    if (!parsed || typeof parsed.verdict !== 'string') {
      logger(
        `⚠️ AASA 公网健康未产出结论(未判定,不记为已探测):rc=${call.status} ` +
          `${([call.stderr, call.stdout].filter(Boolean).join(' ⊕ ') || '(无输出)').slice(0, 200)}`,
      )
      return { ran: true, judged: false, why: '结论不可解析' }
    }
    try {
      mkdirSync(dirname(lastFile), { recursive: true })
      writeFileSync(lastFile, JSON.stringify(parsed, null, 1), 'utf8')
    } catch {
      /* 状态件写不掉只影响可见性,不影响告警本身 */
    }
    const breach = Array.isArray(parsed?.breach) ? parsed.breach : []
    if (parsed.verdict === 'breach') {
      const held = alertHeldTier(noteUndeterminedStreak(firstFile, now).firstMs, now)
      notify(
        `AASA 公网健康 breach:${breach.length} 维不达标`,
        `不达标维(逐条来自尺子 JSON 的 breach 数组):\n${breach.slice(0, 10).map((b) => `· ${b}`).join('\n') || '(无)'}`,
        {
          severity: 'warning',
          dedupKey: `verdict=breach;breach=${alertCountTier(breach.length)};held=${held.tier}`,
        },
      )
      logger(`❌ AASA 公网健康 breach ${breach.length} 维(已按身份去重发信)`)
      return { ran: true, judged: true, breaches: breach.length }
    }
    if (parsed.verdict === 'warn') {
      logger(`⚠️ AASA 公网健康报数(不判红):${String(parsed.why || '有机主面待办').slice(0, 180)}`)
      clearUndeterminedStreak(firstFile)
      return { ran: true, judged: true, breaches: 0, warns: 1 }
    }
    if (parsed.verdict === 'unjudged') {
      // 未判定既不续命也不清零(§0.3);取不到输入不等于坏,更不等于好
      logger(`ℹ️ AASA 公网健康:未判定 —— ${String(parsed.why || '(无原因)').slice(0, 200)}`)
      return { ran: true, judged: false, why: '未判定' }
    }
    clearUndeterminedStreak(firstFile)
    logger(`✅ AASA 公网健康:${Array.isArray(parsed?.legs) ? parsed.legs.length : 0} 腿可达且与单源同构`)
    return { ran: true, judged: true, breaches: 0, unjudged: 0 }
  } catch (e) {
    logger('⚠️ AASA 公网健康派发失败(不阻断其余守护): ' + String((e && e.message) || e).slice(0, 160))
    return { ran: false, why: '派发异常' }
  }
}

/** 〈原 25 行头注已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-24.md#git-guardian-L4586〉 部署停摆的**高频**派发点(尺子本体 = `scripts/check-credential-health.mjs --stall-only --json`) */
const DEPLOY_STALL_TICK = join(WORKTREE, '.ihui-agent', 'state', 'deploy-stall-tick.ts')
const DEPLOY_STALL_FIRST = join(WORKTREE, '.ihui-agent', 'state', 'deploy-stall-first.json')
/**
 * 「环已停写 + 线上落后」的一次定向升级台账(2026-10-29 Y-1)。身份落在**事件**(线上 sha 前缀)上,
 * 不落在正文上 —— 同一场停摆的静默分钟数每小时都在涨,靠 notify 的内容指纹去重会退化成每窗一封。
 */
const DEPLOY_STALL_ESCALATED = join(WORKTREE, '.ihui-agent', 'state', 'deploy-stall-escalated.json')
const DEPLOY_STALL_INTERVAL_MS = Number(process.env.IHUI_DEPLOY_STALL_INTERVAL_MS || 15 * 60 * 1000)
const DEPLOY_STALL_TIMEOUT_MS = Number(process.env.IHUI_DEPLOY_STALL_TIMEOUT_MS || 120_000)

export function auditDeployStall(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = DEPLOY_STALL_INTERVAL_MS,
    tickFile = DEPLOY_STALL_TICK,
    firstFile = DEPLOY_STALL_FIRST,
    escalatedFile = DEPLOY_STALL_ESCALATED,
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
    // ── 定向升级(2026-10-29 Y-1):"落后 + 环已停写"时,把看不见的那一档升一次到人到得见的通道 ──
    // 资格完全由尺子给(`p.escalate`,判据在 check-credential-health.mjs 的 judgeStallSilence),
    // 派发侧不自立第二套判断 —— 这里只做两件派发层该做的事:去重身份、走既有品牌出口(守门 81)。
    //
    // 为什么两支(unjudged 与 ok)都要问它:现场 27 分钟静默既可能落 unknown(成功史读不到),
    // 也可能落**绿**("线上落后但最近 27 分钟刚成功过,不算停摆"——这正是 45 分钟阈值的盲区)。
    // 只挂 unjudged 就等于换个输入形态又漏一次;真正的护栏是"环自己不再写行"。
    const escalateSilence = (payload) => {
      const esc = payload.escalate && payload.escalate.eligible === true ? payload.escalate : null
      if (!esc) return { escalated: false, why: (payload.escalate && payload.escalate.why) || '尺子未给升级资格' }
      let escalatedKey = ''
      try {
        escalatedKey = String(JSON.parse(readFileSync(escalatedFile, 'utf8')).episodeKey || '')
      } catch {
        /* 没升过 */
      }
      if (escalatedKey && escalatedKey === esc.episodeKey) {
        return { escalated: false, deduped: true, why: '同一停摆事件已定向升级过一次' }
      }
      const outcome = notify(
        '部署停摆(环已停写)· 落后 origin/main 但判据看不见',
        `环本身已经停写 —— 这一次不再留在日志里(读数档位 ${String(payload.level || '?')}):\n${String(payload.why || '')}\n` +
          `线上 ${String(payload.liveSha || '(无)').slice(0, 12)} ≠ tip ${String(payload.tipSha || '?').slice(0, 12)}(来源 ${payload.tipSource || '未标注'})\n` +
          `deploy-loop.log 末行写入 ${payload.lastLogWriteIso || '(取不到)'};已静默 ${esc.silenceMin} 分钟 ≥ 派生阈值 ${esc.thresholdMin} 分钟(${esc.why})\n` +
          `阈值来源:按该日志相邻写入间隔实测分布派生,见读数里的 logGaps / silence 两键(非常数)\n` +
          `取证:node scripts/check-credential-health.mjs --stall-only --json(只读、零写盘、零发信)`,
        { severity: 'critical', dedupKey: `stall-silence;episode=${esc.episodeKey}` },
      )
      // 只在这封信**真的有了归宿**(寄出,或窗口内已由同身份寄出)时才落账:
      // 投递失败必须留给下一轮重试,否则"寄失败"会被记成"已经喊过了"——那正是本票要根治的静默。
      if (outcome && (outcome.sent || outcome.suppressed)) {
        try {
          mkdirSync(dirname(escalatedFile), { recursive: true })
          writeFileSync(
            escalatedFile,
            JSON.stringify({
              episodeKey: esc.episodeKey,
              at: new Date(now).toISOString(),
              silenceMin: esc.silenceMin,
              thresholdMin: esc.thresholdMin,
              liveSha: esc.episodeKey.replace(/^silence:/, ''),
              tipSha: String(payload.tipSha || ''),
              levelAtEscalation: String(payload.level || ''),
            }),
            'utf8',
          )
        } catch (e) {
          logger(`⚠️ 部署停摆:定向升级已寄出但台账写不进(${String((e && e.message) || e).slice(0, 120)})⇒ 下一轮可能重寄一次`)
        }
      }
      logger(
        outcome && outcome.sent
          ? `❌ 部署停摆:环已停写(静默 ${esc.silenceMin} 分钟 ≥ ${esc.thresholdMin} 分钟)⇒ 已定向升级到邮件通道`
          : `⚠️ 部署停摆:定向升级未送达(${(outcome && outcome.why) || '无原因'})⇒ 下一轮重试`,
      )
      return { escalated: true, sent: Boolean(outcome && outcome.sent) }
    }
    if (p.level === 'unjudged') {
      const esc = escalateSilence(p)
      if (esc.escalated) return { ran: true, judged: true, ok: false, escalated: true }
      logger(
        `ℹ️ 部署停摆:未判定 —— ${String(p.why || '(尺子未给原因)').slice(0, 200)}(定向升级不介入:${String(esc.why).slice(0, 160)})`,
      )
      return { ran: true, judged: false, why: esc.deduped ? '同一事件已升级' : '尺子自报未判定' }
    }
    if (p.level === 'ok') {
      clearUndeterminedStreak(firstFile)
      // 升级台账只在**线上追平 tip**时结清:绿档也可能是"落后但刚成功过"(正是 27 分钟静默那一支),
      // 那种绿代表环已停写,结清它等于把下一轮的升级资格白送一次,结果就是每轮重寄。
      if (String(p.liveSha || '').trim() && p.liveSha === p.tipSha) clearUndeterminedStreak(escalatedFile)
      const esc = escalateSilence(p)
      if (esc.escalated) return { ran: true, judged: true, ok: false, escalated: true }
      logger(`✅ 部署停摆:绿(线上 ${String(p.liveSha || '(无)').slice(0, 9)},最近成功 ${p.lastSuccessIso || '?'})`)
      return { ran: true, judged: true, ok: true }
    }
    // 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l4571(门 103 C1 收口)〉首意: 类别只取"人能做的动作"不同的那两种:标记缺失要先查线上产物,落后要先查环为什么不切流。
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

/**
 * 孤儿删除引用巡检的**常驻**派发点(尺子本体 = `scripts/check-orphan-deletion-refs.mjs`)。
 *
 * 为什么必须挂在这里而不是"留作手动问责":这把尺子判的是**此刻索引与 HEAD 的错位**
 * (HEAD 有该路径、索引与磁盘都没有、而树内仍有源码 import 它)—— 它按设计不能进提交链
 * (与某次提交内容无关的 blocking 红 = 每台每次被逼 --no-verify,§12e/§12f),而"手动问责入口"
 * 的实际含义是**只有人在跑、没有班次在跑**:2026-09-29 现读该尺子的五个权威接线点零命中,
 * 而同一型缺陷(HEAD 有 / 索引与磁盘都无 / 源码仍 import)当晚已两次炸构建。挂本守护是
 * 唯一不改提交链、又保证每 30 分钟必有一次现读的落点。
 * 挂点语义与 healWorktreeTracked / auditPublicPathProbe 同一条:**健康轮次的早退之前 + `!CHECK_ONLY`**。
 *
 * 三条不可漂的写法(照抄 auditPublicPathProbe):
 *  ① **节流而非封量**:两次真实巡检之间隔 `ORPHAN_AUDIT_INTERVAL_MS`(默认 30 分钟)是节奏控制,
 *     不是每日封顶 —— §5e 明令不得自设总量上限把"告警静默"再复制一遍。
 *  ② 告警一律经 `notifyGuardRed()`:按 alert 身份 + 内容指纹去重,不在本文件自拼 SMTP(守门 81)。
 *  ③ **判"未判定"不得静默也不得喊人**:尺子 rc=2 / JSON 取不到 ⇒ 只写日志并点名原因 ——
 *     发一封"我什么都没量到"的信是把噪音冒充成告警;但日志必须报名,不得沉默成"跑过了"。
 */
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

// 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l4739(门 103 C1 收口)〉首意: 迁移账本「中间缺口」巡检(尺子 = `scripts/check-db-migration-gaps.mjs`,2026-10-25 立)。
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
 * 资源目录同步停更哨兵(2026-10-25 立)。实测宕型:批内复合键重复触发 PG 21000,
 * 整轮 760 条全军 synced=0,而可见面只有一行 WARN —— "静默"就是这一格的立项理由。
 * 判定住在 lib(守护顶着门 103 C1 的 6000 行天花板,与 sweeper/batch-write 归位 lib 同一先例)。
 */
const REGISTRY_SYNC_AUDIT_TICK = join(WORKTREE, '.ihui-agent', 'state', 'registry-sync-health-tick.ts')

export function auditRegistrySyncHealth(opts = {}) {
  return runRegistrySyncHealth({
    script: join(dirname(fileURLToPath(import.meta.url)), 'check-registry-sync-health.mjs'),
    tickFile: REGISTRY_SYNC_AUDIT_TICK,
    cwd: WORKTREE,
    logger: log,
    notify: notifyGuardRed,
    ...opts,
  })
}

// 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l4856(门 103 C1 收口)〉首意: 把本守护的计划任务确保为 S4U(幂等;已是 S4U 时脚本自己秒退)。
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
  // 两形态分流交给同一把尺子(纯判据 `gitdirRepairPlan`,镜像可在夹具上真跑取证):
  // 真身在 ⇒ 只重写 gitfile;真身没了 ⇒ 才轮到恢复源。旧写法两条 `if` 各判各的,判序无从验证。
  const plan = gitdirRepairPlan({ gitdirOk: before.gitdirOk, pointerOk: before.pointerOk })
  if (plan === 'restore-gitdir') {
    const ok = !!(healFromBackup() || healFromRemote())
    // 恢复源是整份 gitdir 副本 ⇒ cpSync 会把它自己的 core.bare 一起带回来,恢复后必须再归一一次
    if (ok && !worktreeUsable()) return healWorktreeBare()
    return ok
  }
  if (plan === 'rewrite-pointer') healPointer()
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

// 〈原 24 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-25.md#guardian-l5008(门 103 C1 收口)〉首意: 
export function gitdirTargetVerdict({ samePointer = false, exists = false, isDirectory = false, unreadable = false } = {}) {
  if (samePointer)
    return { ok: false, why: 'GITDIR 解析成指针文件自身 —— 自指损坏态,写它等于删库;先修 scripts/lib/gitdir.mjs 的解析,勿在此放行' }
  if (unreadable) return { ok: false, why: 'GITDIR 形态读不出来 ⇒ 不猜它是目录,拒绝恢复(宁可不修,不可误删)' }
  if (exists && !isDirectory) return { ok: false, why: 'GITDIR 已存在却不是目录 ⇒ 先人工确认,勿覆盖' }
  return { ok: true, why: exists && isDirectory ? '已存在且是目录' : '不存在,可安全建目录' }
}

/**
 * 「恢复面按**当次实测**的 gitdir 形态分派」的纯判据(形态三事实 → `gitdirTargetVerdict` 输入)。
 *
 * 立因(台账票「git-guardian 的 `.git` 修复路径在"指针文件那台机"失效」本席收的格):
 * 旧 `gitdirTargetSafe()` 把 `samePath(GITDIR, POINTER)` **无条件**当"自指损坏态"喂给判据。
 * 而 §5b 明令 gitdir 形态属七类必须每次现读的机器事实 —— 工作区 `.git` 本身就是目录的那类机
 * (健康的目录形态仓 `resolveGitdir` 恒返回 `<wt>/.git`,本机当次实测即此型)里该路径恒相等,
 * 于是整条恢复阶梯(`healFromBackup`/`healFromRemote`)对目录形态机**永久死锁**,报错文案还把
 * 合法布局说成「先修 scripts/lib/gitdir.mjs 的解析」。真自指损坏态(2026-09-23 那型:指针文件
 * 内容 `gitdir:` 指回自身、`cpSync(BACKUP, GITDIR)` 把 25MB 备份灌进指针文件)的实测特征是
 * 「路径相同 ∧ 存在 ∧ **不是目录**」—— 只有那一型才禁写。
 * 形态分派只有这一份实现(§0.6):调用方只喂当次实测的三个事实,不得再各自 `if (isDirectory)`。
 * @param {{pathsMatch?:boolean,exists?:boolean,isDirectory?:boolean}} face 当次实测三事实
 */
export function gitdirTargetVerdictFromFace({
  pathsMatch = false,
  exists = false,
  isDirectory = false,
} = {}) {
  return gitdirTargetVerdict({
    // pathsMatch 时只有「存在 ∧ 是目录」(目录形态机的合法布局,当次实测)才不是自指;
    // 「存在但不是目录」= 2026-09-23/10-16 那一型,「不存在」= 无从实测形态 —— 两型照旧拒(§0.10)。
    samePointer: Boolean(pathsMatch) && !(exists === true && isDirectory === true),
    exists,
    isDirectory,
  })
}

function gitdirTargetSafe() {
  let v
  try {
    const exists = existsSync(GITDIR)
    v = gitdirTargetVerdictFromFace({
      pathsMatch: samePath(GITDIR, POINTER),
      exists,
      isDirectory: exists ? statSync(GITDIR).isDirectory() : false,
    })
  } catch (e) {
    const why = gitdirTargetVerdict({ unreadable: true }).why
    log(`⛔ 拒绝恢复:${why}(${GITDIR}): ${String((e && e.message) || e)}`)
    // §0.10:失效方向 = 经既有派发口多要一次定向说明,绝不静默让恢复面停摆(也不跳任何门)
    notifyGuardRed('gitdir 恢复被拒(形态读不出,未判定)', `${why}\n路径: ${GITDIR}\n本轮异常: ${String((e && e.message) || e)}\n「未判定」≠「判过」:既不猜它是目录也不猜它是指针,恢复面不动作`, { dedupKey: 'gitdir-restore-refuse;unreadable' })
    return false
  }
  if (!v.ok) {
    log(`⛔ 拒绝恢复:${v.why}(${GITDIR})`)
    notifyGuardRed('gitdir 恢复被拒(修复面要一次人工定向说明)', `${v.why}\n路径: ${GITDIR}\n工作区 .git: ${POINTER}\n当次实测: pathsMatch=${samePath(GITDIR, POINTER)}, exists=${existsSync(GITDIR)}\n「拒」= 不动作、不是跳门;确认要恢复的先按 §5b 归档现场再人工处理`, { dedupKey: `gitdir-restore-refuse;${String(v.why).slice(0, 12)}` })
  }
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

// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5009(门 103 C1 收口)〉首意: 把 origin(GitHub SSH)+ 部署私钥 sshCommand 写回仓库配置。
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

// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5079(门 103 C1 收口)〉首意: —— 计划任务必须跑在非交互会话(2026-09-22 立「任务漂移自检」,2026-09-23 换 S4U 根治) ——

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

// 〈原 17 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5122(门 103 C1 收口)〉首意: 活任务形态判定 —— 2026-09-23 首立,2026-10-25 换主通道(判定口径不动)。
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5223(门 103 C1 收口)〉首意: 把"探针跑出了结论"与"探针没跑起来"分成三态,退出码**不参与**前者判定:
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5257(门 103 C1 收口)〉首意: 开工前基线新鲜度的**只报数**账(机制规格 MECHANISM-SPEC-2 §2 的守护侧挂点)。
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

// 〈原 13 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5352(门 103 C1 收口)〉首意: 提交窗口期静默(2026-10-22 立,机主要求"提交稳定在 1 分钟内")。
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

const CROSS_END_DRIFT_INTERVAL_MS = Number(
  process.env.IHUI_CROSS_END_DRIFT_INTERVAL_MS || 60 * 60 * 1000,
)

/**
 * 跨端三条腿(漂移尺 / 声明链自愈 / 造页闭环)的「这一轮没判」必须有**存续性门槛 + 到人**。
 *
 * 立因(2026-10-26 实测):`gen-miniapp-mirror.mjs` 里一枚未定义标识符把造页闭环打成
 * ReferenceError,daemon 每 30 分钟撞一次、连撞 8 小时,账面只有日志里同一行 ⚠️ —— 没有人被
 * 叫过,也没有任何一层把"这条腿瞎了"量出来(§5e-3 的教训同型:能看见的才谈得上修)。
 * 单轮取不到输入多半是并发争用 ⇒ 不寄信;连满门槛(默认 3 小时 ≈ 造页 6 轮 / 漂移尺 3 轮)
 * 才按结构性故障到人。取到**任何**确定结论(含倒退)⇒ 起点清零,不背着旧账到人。
 * 判机器状态 ⇒ 不进提交链(§12e)。
 */
const CROSS_END_UNDET_HORIZON_MS = Number(
  process.env.IHUI_CROSS_END_UNDET_HORIZON_MS || 3 * 60 * 60 * 1000,
)
const CROSS_END_LEGS = new Set([
  'drift',
  'mirror-heal',
  'shell-land',
  // 2026-10-27 补:本文件新装的两条腿此前不在册 ⇒ noteCrossEndUndetermined 走「未知腿」分支
  // 当场返回 { mailed:false },瞎了也无人喊(§12f「判据失效的表现永远是安静」)。
  'portal-converge',
  'rn-token-pair',
  // 2026-10-28 立:web→RN 对账腿(尺子 check-web-rn-parity.mjs)。此前不在册 ⇒ 未知腿分支
  // 当场返回 { mailed:false },这条腿瞎了也无人喊(§12f「判据失效的表现永远是安静」)。
  'web-rn-parity',
])
const crossEndUndetFile = (leg) =>
  join(WORKTREE, '.ihui-agent', 'state', `cross-end-${leg}-undetermined-first.json`)

export function noteCrossEndUndetermined(leg, detail, opts = {}) {
  const {
    logger = log,
    notify = notifyGuardRed,
    horizonMs = CROSS_END_UNDET_HORIZON_MS,
    // 只为成对夹具开(测试不得碰真 .ihui-agent/state 的起点件):生产调用一律走默认值
    file = crossEndUndetFile(leg),
  } = opts
  if (!CROSS_END_LEGS.has(leg)) return { mailed: false, why: `未知腿 ${leg}(不代人决定谁该喊)` }
  return notifyEnvUndetermined(
    `跨端对齐·${leg} 这轮取不到结论`,
    detail,
    notify,
    logger,
    file,
    horizonMs,
    `cross-end-${leg}-undet`,
  )
}

export function settleCrossEndLeg(leg, opts = {}) {
  const { logger = log, file = crossEndUndetFile(leg) } = opts
  if (!CROSS_END_LEGS.has(leg)) return false
  // 常态(没有连击在册)⇒ 一声不出:各腿每 30~60 分钟各取一次结论,
  // 每轮都写一行"已清零"会把日志淹成噪声,而这格真正要被看见的是"清掉了一次在册的瞎"
  if (!existsSync(file)) return false
  clearUndeterminedStreak(file)
  logger(`ℹ️ 跨端对齐·${leg} 取到确定结论 ⇒ 撤掉在册的未判定连击起点(${file})`)
  return true
}

/**
 * 派发回写同一枚节流戳(2026-10-27 立):节流戳原先只有 attemptAt(派发前写),于是
 * 「子进程被超时掐死」与「本轮判过、无需动手」在盘面上是同一枚文件、同一句无声 ——
 * 实测 16:11/16:42 两轮造页闭环被掐死,日志只留下一句「未取到 JSON」,而两条新腿连这句都没有。
 * 本函数只在**子进程返回之后**补 finishedAt/rc ⇒ 裸 attemptAt 从此专表示"派发了但没回来"。
 * 写失败不改变判定(它是读数,不是判据),也不回落另一个面。
 */
function stampCrossEndDispatch(tickFile, attemptAtMs, r, stdout, extra = {}) {
  try {
    writeFileSync(
      tickFile,
      JSON.stringify({
        attemptAt: new Date(attemptAtMs).toISOString(),
        finishedAt: new Date().toISOString(),
        rc: typeof r?.status === 'number' ? r.status : null,
        tail: String(stdout ?? '').slice(-220),
        // 2026-10-28:web→RN 腿要把本轮计数快照当下一轮的棘轮基线,写盘格式仍是这一份
        ...extra,
      }),
      'utf8',
    )
    return true
  } catch {
    return false
  }
}

/**
 * 跨端对齐漂移巡检(2026-10-26 立):尺子 `check-cross-end-parity-drift.mjs` 的头注自述
 * 「供 git-guardian 巡检轮派发」,而全仓此前**零派发** —— 判据齐全却无人调度,失效形态是安静
 * (§0.9「造好没装车」= 没有)。本函数是它唯一的调度器。
 *
 * 三态(§0.3):ok 只写一行读数(涨跌都要有证据链);regressed 到人(§5e-1:正文自带可执行
 * 下一步,去重身份 = 倒退维名,不把会抖动的明细清单塞进去重键);undetermined 只写 ⚠️,
 * 不喊人也不记绿。判机器状态 ⇒ 绝不进提交链(§12e);不改本守护退出码(与
 * auditSweeperLiveness 同型)。60 分钟节流:尺子要跑三道子对账器(每次数秒),而漂移是慢变量。
 */
export function auditCrossEndParityDrift(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = CROSS_END_DRIFT_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'cross-end-drift-last.json'),
    logger = log,
    runner = null,
    notify = notifyGuardRed,
    undetFile = crossEndUndetFile('drift'),
    undetHorizonMs = CROSS_END_UNDET_HORIZON_MS,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-cross-end-parity-drift.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ 跨端漂移巡检:尺子不在位(scripts/check-cross-end-parity-drift.mjs)⇒ 本轮跳过,不记为已探测',
    )
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
    logger(
      `⚠️ 跨端漂移巡检:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`,
    )
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--record', '--json'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
              timeout: 5 * 60 * 1000, // 守门 80:热路径派生一律带上限
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { ok: true, out: String(out ?? ''), status: 0 }
          } catch (e) {
            // exit 1 = 判出倒退、exit 2 = 未判定;两种都**不是**"尺子坏了",结论整份在 stdout。
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
            }
          }
        }
  const r = run()
  stampCrossEndDispatch(tickFile, now, r, String(r.out ?? r.stdout ?? ''))
  // runner 两种契约都收:生产派生(`{ok,out,err,status}`)与镜像测试(`{status,stdout,stderr}`)。
  const stdout = String(r.out ?? r.stdout ?? '')
  const stderr = String(r.err ?? r.stderr ?? '')
  let parsed = null
  try {
    const a = stdout.indexOf('{')
    const b = stdout.lastIndexOf('}')
    if (a >= 0 && b > a) parsed = JSON.parse(stdout.slice(a, b + 1))
  } catch {
    /* 落到下面"结论不可用"那一支 */
  }
  if (!parsed || typeof parsed.state !== 'string') {
    logger(
      `⚠️ 跨端漂移巡检:尺子结论不可用:未判定 —— ${stderr.slice(0, 120) || '未取到 JSON'}` +
        ` ⇒ 本轮没判,不等于"没有倒退"`,
    )
    noteCrossEndUndetermined(
      'drift',
      `派生 rc=${r.status ?? '?'};stderr 前 120:${stderr.slice(0, 120) || '(空)'}\n` +
        `这表示**漂移尺这一格现在是瞎的**(对齐倒退没人量得到),不是"没有倒退"。\n` +
        `出路:node scripts/check-cross-end-parity-drift.mjs(只读复跑,看它实际报什么)`,
      { logger, notify, file: undetFile, horizonMs: undetHorizonMs },
    )
    return { ran: true, ok: false, state: 'unparsed' }
  }
  const cur = parsed.cur ?? {}
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons : []
  if (parsed.state === 'undetermined') {
    logger(
      `⚠️ 跨端漂移巡检:未判定(${parsed.why ?? '子对账器取不到结论'})⇒ 本轮没判,` +
        `既不算"对齐了"也不算"倒退了"(§0.3)`,
    )
    noteCrossEndUndetermined(
      'drift',
      `尺子自己报未判定:${String(parsed.why ?? '未附原因').slice(0, 200)}\n` +
        `出路:node scripts/check-cross-end-parity-drift.mjs --json(看三态与 reasons 是否取不到输入)`,
      { logger, notify, file: undetFile, horizonMs: undetHorizonMs },
    )
    return { ran: true, ok: false, state: 'undetermined', why: parsed.why ?? null }
  }
  settleCrossEndLeg('drift', { logger, file: undetFile })
  if (parsed.state === 'regressed') {
    const dims = reasons.map((x) => x?.dim).filter(Boolean)
    const detail =
      `跨端对齐倒退 ${reasons.length} 维:` +
      reasons.map((x) => `\n· ${x?.dim}:${x?.detail}`).join('') +
      `\n\n可执行下一步:① node scripts/check-cross-end-parity-drift.mjs 看三态与 reasons;` +
      `② 账本文档落后(mirror 净增而文档未重生成)⇒ node scripts/report-rn-miniapp-gaps.mjs ` +
      `--write docs/engineering/rn-miniapp-parity-matrix.md;` +
      `③ 镜像/登记真倒退 ⇒ 按 reasons 的维定位本次改动,或 node scripts/repair-cross-end-mirror.mjs 预演补回声明链。`
    logger(`⚠️ 跨端对齐倒退:${dims.join(',') || '未命名维度'} ⇒ 已按稳定身份到人`)
    notify('跨端对齐倒退', detail, {
      severity: 'warning',
      dedupKey: `cross-end-drift;${[...new Set(dims)].sort().join('+')}`,
      logger,
    })
    return { ran: true, ok: false, state: 'regressed', dims, reasons }
  }
  logger(
    `✅ 跨端对齐漂移:无倒退(共享屏镜像 ${cur.mirrored ?? '?'}/${cur.sharedTotal ?? '?'}` +
      ` · web→RN 已登记 ${cur.aligned ?? '?'} / 未映射 ${cur.unmapped ?? '?'}` +
      ` · 门 128 判红 ${cur.coverageRed ?? '?'} · 登记表腐烂 ${cur.mapRot ?? '?'})`,
  )
  return { ran: true, ok: true, state: 'ok', cur }
}

const CROSS_END_WEB_RN_INTERVAL_MS = Number(
  process.env.IHUI_CROSS_END_WEB_RN_INTERVAL_MS || 60 * 60 * 1000,
)

/** web→RN 巡检的五个功能维 + 样式维(维名同时是到人身份,不随计数抖动) */
const WEB_RN_DIMS = [
  ['unmapped', '未映射(web 有路由、台账零判定)'],
  ['rot', '登记腐烂(指针指向不存在的屏/键)'],
  ['contradicted', '渲染推翻(台账判缺而端内实际已渲染)'],
  ['judgedGap', '判过缺口(确缺 RN 承载)'],
  ['navGap', '入口级缺口(侧栏入口无承载)'],
]

/**
 * web→RN 对账巡检(2026-10-28 立):尺子 `check-web-rn-parity.mjs` 的头注自述「已注册进
 * guardian-runner.mjs 每轮自动跑」,而实测全仓**零引用**(guardian-runner 与 git-guardian 皆无)
 * —— 与上一格同一型:判据齐全却无人调度,失效形态是安静(§0.9「造好没装车」= 没有)。
 * AGENTS §44:只读对账尺子**不进提交链**,唯一调度器 = 本函数(健康轮次 + !CHECK_ONLY)。
 *
 * 判据全部读尺子输出(**零复算**):functional 的 unmapped / rot / contradicted / judgedGap
 * 与 nav.counts.gap,样式维读 style.ok。喊人只在**净增**那一档(§12e 棘轮:存量缺口与本次
 * 提交无关,每轮恒响只会把通道喊废);上轮快照作为 baseline 住在 tickFile 里,首轮只立基线。
 * 取不到 JSON 或尺子 exit 2(取不到被审面)⇒ 未判定(§0.3),不记绿也不冒红。60 分钟节流 ——
 * 尺子要扫 886 条 web 路由 + 327 屏并派一道子进程,而漂移是慢变量。
 */
/**
 * 推送通道存续巡检(2026-10-29 立)。
 *
 * 立因(本机实测,不是推测):判据 `scripts/check-push-sync.mjs` 早就认得「diverged / failed
 * 过期 ⇒ 唯一出路是 git-sync-converge」,但它**只挂在 pre-commit 上**。本仓大量落地走
 * `object-space-land`(旁路通道不跑钩子),而守护巡检轮此前**零处**消费 push-state ⇒ 这条判据
 * 在真正会卡住的那条通道上无人调度(§0.9:造好没装车 = 没有)。撞上的现场就是本机 main 与
 * origin 自 2026-10-26 16:14 分叉、后台推送连续判 failed,两天没有任何一处喊过(健康不写行
 * ⇒ 失效表现永远是安静的,§12f)。
 *
 * 为什么不把判据抄进来:§0.6 单一真相源。check-push-sync 是"顶层即执行"的脚本(没有
 * isDirectRun 守卫,门 194 射程内),import 它等于跑它 ⇒ 所以按**进程边界**调它,连它自己的
 * 豁免档(protected-branch / remote-ref-race 的几何判据)一起继承,不在这里造第二份阈值。
 *
 * 档位:判机器状态 ⇒ 不进提交链、不进 CI(§12e)。喊人只在"判据当场判阻塞"这一确定态上喊,
 * 身份 = 腿名(notifyGuardRed 自带窗口去重,§5e-3);rc>1/取不到 ⇒ 未判定只 log,
 * 既不冒绿也不冒红(§0.3);健康不写行(§5b 惯例)。
 */
const PUSH_CHANNEL_INTERVAL_MS = Number(process.env.IHUI_PUSH_CHANNEL_INTERVAL_MS || 10 * 60 * 1000)

export function auditPushChannel(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = PUSH_CHANNEL_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'push-channel-last.json'),
    logger = log,
    notify = notifyGuardRed,
    runner = null,
    script = join(dirname(fileURLToPath(import.meta.url)), 'check-push-sync.mjs'),
  } = opts
  if (!existsSync(script)) {
    logger('ℹ️ 推送通道巡检:判据不在位(scripts/check-push-sync.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '判据不在位' }
  }
  try {
    const prev = JSON.parse(readFileSync(tickFile, 'utf8'))
    const last = Date.parse(String(prev.attemptAt ?? '').trim())
    if (Number.isFinite(last) && now - last < intervalMs) return { ran: false, why: '未到节流窗口' }
  } catch {
    /* 没跑过 */
  }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠️ 推送通道巡检:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`)
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
              timeout: 2 * 60 * 1000, // 守门 80:热路径派生一律带上限
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { status: 0, out: String(out ?? ''), err: '' }
          } catch (e) {
            return {
              status: typeof e?.status === 'number' ? e.status : null,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
            }
          }
        }
  const r = run()
  const stdout = String(r.out ?? r.stdout ?? '')
  const stderr = String(r.err ?? r.stderr ?? '')
  const lastLine =
    stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-1)[0] ?? ''
  if (r.status === null || r.status === undefined || r.status > 1) {
    logger(
      `⚠️ 推送通道巡检:未判定(rc=${r.status ?? 'n/a'})—— ${lastLine.slice(0, 160) || stderr.slice(0, 160) || '无输出'}` +
        ` ⇒ 本轮没判,不等于"推送通道健康"`,
    )
    return { ran: true, ok: false, state: 'undetermined' }
  }
  if (r.status === 0) return { ran: true, ok: true, state: 'ok' }
  logger(`❌ 推送通道巡检:判据当场判阻塞 —— ${lastLine.slice(0, 200)}`)
  notify(
    'push-channel',
    `本地 main 的推送通道不健康(git-guardian 巡检实跑 scripts/check-push-sync.mjs,rc=1)。\n` +
      `现读结论(判据自己的话,本器不复述判据):\n${stdout.slice(-500)}\n` +
      `出路:node scripts/git-sync-converge.mjs --rounds 1(索引层合并,零触碰他人未提交文件);` +
      `本仓规约禁止手工 fetch/merge/push 循环与强推。`,
    { logger, severity: 'warning' },
  )
  return { ran: true, ok: false, state: 'blocked' }
}

export function auditWebRnParity(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = CROSS_END_WEB_RN_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'web-rn-parity-last.json'),
    logger = log,
    runner = null,
    notify = notifyGuardRed,
    undetFile = crossEndUndetFile('web-rn-parity'),
    undetHorizonMs = CROSS_END_UNDET_HORIZON_MS,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-web-rn-parity.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ web→RN 对账巡检:尺子不在位(scripts/check-web-rn-parity.mjs)⇒ 本轮跳过,不记为已探测',
    )
    return { ran: false, why: '尺子不在位' }
  }
  let last = NaN
  let baseline = null
  try {
    const prev = JSON.parse(readFileSync(tickFile, 'utf8'))
    last = Date.parse(String(prev.attemptAt ?? '').trim())
    if (prev.baseline && typeof prev.baseline === 'object') baseline = prev.baseline
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(last) && now - last < intervalMs) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(
      `⚠️ web→RN 对账巡检:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`,
    )
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
            // exit 2 = 未判定;结论(若已打到 stdout)整份仍在 out 里。
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
            }
          }
        }
  const r = run()
  // runner 两种契约都收:生产派生(`{ok,out,err,status}`)与镜像测试(`{status,stdout,stderr}`)。
  const stdout = String(r.out ?? r.stdout ?? '')
  const stderr = String(r.err ?? r.stderr ?? '')
  let parsed = null
  try {
    const a = stdout.indexOf('{')
    const b = stdout.lastIndexOf('}')
    if (a >= 0 && b > a) parsed = JSON.parse(stdout.slice(a, b + 1))
  } catch {
    /* 落到下面「结论不可用」那一支 */
  }
  const fn = parsed?.functional
  const st = parsed?.style
  if (!fn || typeof fn !== 'object' || fn.undetermined === true) {
    stampCrossEndDispatch(tickFile, now, r, stdout, { baseline })
    logger(
      `⚠️ web→RN 对账巡检:尺子结论不可用:未判定 —— ${String(fn?.why ?? '') || stderr.slice(0, 120) || '未取到 JSON'}` +
        ` ⇒ 本轮没判,不等于"RN 已对齐 web"`,
    )
    noteCrossEndUndetermined(
      'web-rn-parity',
      `派生 rc=${r.status ?? '?'};stderr 前 120:${stderr.slice(0, 120) || '(空)'}\n` +
        `这表示**web→RN 对账这一格现在是瞎的**(web 新增路由 / 样式漂移没人量得到),不是"已对齐"。\n` +
        `出路:node scripts/check-web-rn-parity.mjs(只读复跑,看它实际报什么)`,
      { logger, notify, file: undetFile, horizonMs: undetHorizonMs },
    )
    return { ran: true, ok: false, state: 'undetermined' }
  }
  const cur = {
    webRoutes: Number(fn.webRoutes ?? 0),
    rnScreens: Number(fn.rnScreens ?? 0),
    aligned: Number(fn.aligned ?? 0),
    excluded: Number(fn.excluded ?? 0),
    portal: fn.portalKnown === false ? null : Number(fn.portal ?? 0),
    unmapped: Number(fn.unmapped ?? 0),
    rot: Number(fn.rot ?? 0),
    contradicted: Number(fn.contradicted ?? 0),
    judgedGap: Number(fn.judgedGap ?? 0),
    navGap: fn.nav && fn.nav.undetermined !== true ? Number(fn.nav.counts?.gap ?? 0) : null,
    styleOk: st?.ok === true,
  }
  stampCrossEndDispatch(tickFile, now, r, stdout, { baseline: cur })
  settleCrossEndLeg('web-rn-parity', { logger, file: undetFile })
  const risen = []
  if (baseline) {
    for (const [key, label] of WEB_RN_DIMS) {
      const a = Number(baseline[key])
      const b = Number(cur[key])
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) risen.push({ key, label, a, b })
    }
  }
  const styleRegressed = baseline?.styleOk === true && cur.styleOk === false
  if (risen.length || styleRegressed) {
    const dims = [...risen.map((x) => x.key), ...(styleRegressed ? ['token'] : [])]
    const detail =
      `web→RN 对账净增 ${dims.length} 维:` +
      risen.map((x) => `\n· ${x.label}:${x.a} → ${x.b}`).join('') +
      (styleRegressed ? '\n· 颜色令牌:上轮通过 → 本轮不一致(RN 已脱离 tokens.css)' : '') +
      `\n\n可执行下一步:① node scripts/check-web-rn-parity.mjs 看功能维逐条与样式维结论;` +
      `② 新路由零判定 ⇒ 在 scripts/data/web-rn-screen-map.jsonl 补一行(aligned/excluded/gap),` +
      `或用 node scripts/probe-web-rn-gap.mjs 分诊;` +
      `③ 颜色不一致 ⇒ node scripts/check-cross-end-tokens.mjs 定位手抄档,` +
      `再 node scripts/plan-rn-token-pairing.mjs 配对。`
    logger(`⚠️ web→RN 对账净增:${[...new Set(dims)].join(',')} ⇒ 已按稳定身份到人`)
    notify('web→RN 对账净增', detail, {
      severity: 'warning',
      dedupKey: `web-rn-parity;${[...new Set(dims)].sort().join('+')}`,
      logger,
    })
    return { ran: true, ok: false, state: 'regressed', dims, cur, baseline }
  }
  logger(
    `✅ web→RN 对账:无净增(aligned ${cur.aligned}/${cur.webRoutes} · 未映射 ${cur.unmapped}` +
      ` · 判过缺口 ${cur.judgedGap} · 登记腐烂 ${cur.rot} · 入口级缺口 ${cur.navGap ?? '?'}` +
      ` · 令牌 ${cur.styleOk ? '同步' : '不一致(存量)'}${baseline ? '' : ' · 首轮立基线'})`,
  )
  return { ran: true, ok: true, state: 'ok', cur, baseline }
}

const CROSS_END_MIRROR_INTERVAL_MS = Number(
  process.env.IHUI_CROSS_END_MIRROR_INTERVAL_MS || 30 * 60 * 1000,
)

/**
 * 跨端镜像声明链自愈(2026-10-26 立):`repair-cross-end-mirror.mjs` 治的是
 * 「登记表说共享屏 X 已被小程序页 Y 镜像,而代码侧的镜像标记/路由被一次合并削掉了」
 * ——门 128 R1 当场红,而**没有任何调度器**去把它接回去(与漂移尺同一型:造好没装车)。
 * 2026-10-25 实测成因是并发提交顺手带走 5 处标记行 + 1 条 app.config 路由。
 *
 * 为什么这一格可以自动动手:修复器只做「台账已有 ⇒ 代码缺什么补什么」,**不新增声明**;
 * 每个动作幂等;遇到工作树上有他席未入库的行一律拒落(不替人提交)。所以无人值守是安全的。
 * 三态照实登记:补了 N 条 / 一致无需补 / 有拒落(多为他席在飞)或结论不可用 ⇒ 未判定。
 * 只写日志**不喊人**(§5e-1:拒落属常态,收信人无事可做);真倒退由漂移尺按维到人。
 * 判机器状态 ⇒ 不进提交链(§12e);不改守护退出码。
 */
const CROSS_END_SHELL_INTERVAL_MS = Number(
  process.env.IHUI_CROSS_END_SHELL_INTERVAL_MS || 30 * 60 * 1000,
)

/**
 * 跨端造页闭环(2026-10-26 立):`land-cross-end-shell-pages.mjs` 治的是「RN 有这一屏、
 * 小程序没有承载页」——造页器产**壳承载页**(渲染源 = packages/app 共享屏,端内零样式零布局),
 * 而它此前只能人工敲:在共享工作树里它按 §12 正确拒落他人未提交的接缝 ⇒ 缺口永远等人工推。
 *
 * 为什么这一格可以自动动手:落地清单每条 blob = `git show HEAD:<file> ⊕ 本批行`,盘上未提交
 * 字节一字节不读;每轮上限 cap=2(造页会增大主包,一次灌满会把微信 2MB 硬上限顶穿,那是不可
 * 回退的一型);幂等靠插入函数**自拒**(同一枚插第二遍 ⇒ 整批不落,不是静默跳过)。
 *
 * 失效方向:clean(没有可产的屏)⇒ 零写零推,只留一行读数;pending/blocked/unparsed ⇒
 * ⚠️ 点名但**不喊人**(§5e-1:拒落属常态,收信人无事可做;真倒退由门 251 与人读台账判)。
 * 判机器状态 ⇒ 不进提交链(§12e);不改守护退出码。
 */
export function sweepCrossEndShellPages(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = CROSS_END_SHELL_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'cross-end-shell-pages-last.json'),
    logger = log,
    runner = null,
    notify = notifyGuardRed,
    undetFile = crossEndUndetFile('shell-land'),
    undetHorizonMs = CROSS_END_UNDET_HORIZON_MS,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'land-cross-end-shell-pages.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ 跨端造页闭环:器物不在位(scripts/land-cross-end-shell-pages.mjs)⇒ 本轮跳过,不记为已探测',
    )
    return { ran: false, why: '造页器不在位' }
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
    logger(
      `⚠️ 跨端造页闭环:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`,
    )
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--apply', '--json', '--cap=2'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b 派生进程纪律
              // 2026-10-26:240s → 600s。实测手动按同一参数真跑 199s(planBatch 随屏数增长),
              // 距旧上限只剩 41s 余量 ⇒ 机器一忙就超时,而超时与"缺口清零"在日志里长得一样。
              // 2026-10-28:600s 被顶穿(现读一轮 rc:null、attemptAt→finishedAt 正好 10 分钟、tail 空,
              // 16:42 起每轮如此)⇒ 上一轮那条注释的预言成真:屏数一涨就必然越界。抬到 30 分钟并留
              // env 旋钮(值守压节拍不必再改码);死因另由下面 signal 写进结论,不再与"判过"同形。
              timeout: Number(process.env.IHUI_CROSS_END_SHELL_TIMEOUT_MS || 30 * 60 * 1000),
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'], // §12g 显式接管 stdio
            })
            return { ok: true, out: String(out ?? ''), status: 0 }
          } catch (e) {
            // exit 1=blocked、2=undetermined:整份结论仍在 stdout,非零不等于"没判"更不等于"判过"。
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
              signal: typeof e?.signal === 'string' ? e.signal : null,
            }
          }
        }
  const r = run()
  stampCrossEndDispatch(tickFile, now, r, String(r.out ?? r.stdout ?? ''))
  const stdout = String(r.out ?? r.stdout ?? '')
  const stderr = String(r.err ?? r.stderr ?? '')
  let parsed = null
  try {
    const a = stdout.indexOf('{')
    const b = stdout.lastIndexOf('}')
    if (a >= 0 && b > a) parsed = JSON.parse(stdout.slice(a, b + 1))
  } catch {
    /* 落到下面"结论不可用" */
  }
  const summary = parsed?.summary
  if (!summary || typeof summary !== 'object' || typeof summary.state !== 'string') {
    logger(
      `⚠️ 跨端造页闭环:结论不可用:未判定 —— ${
        r.signal
          ? `孩子被 ${r.signal} 掐死(上限 ${Math.round(Number(process.env.IHUI_CROSS_END_SHELL_TIMEOUT_MS || 30 * 60 * 1000) / 60000)} 分钟)⇒ 这是没跑完,不是判定`
          : stderr.slice(0, 120) || '未取到 JSON'
      }` + ` ⇒ 本轮没判,不等于"缺口已清零"`,
    )
    noteCrossEndUndetermined(
      'shell-land',
      `派生 rc=${r.status ?? '?'} signal=${r.signal ?? '-'};stderr 前 120:${stderr.slice(0, 120) || '(空)'}\n` +
        `这表示**自动造页这一格是瞎的**(小程序缺页不会自己长回来),不是"缺口已清零"。\n` +
        `出路:node scripts/land-cross-end-shell-pages.mjs(只读预演,看它实际报什么)`,
      { logger, notify, file: undetFile, horizonMs: undetHorizonMs },
    )
    return { ran: true, ok: false, state: 'unparsed' }
  }
  settleCrossEndLeg('shell-land', { logger, file: undetFile })
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const counts =
    `待产 ${n(summary.planned)} / 本轮 ${n(summary.batch)} / blob ${n(summary.blobs)} / ` +
    `拒 ${n(summary.refused)}(cap=${n(summary.cap)}) / 账本 ${String(summary.doc ?? '?')}`
  if (summary.state === 'clean') logger(`🧭 跨端造页闭环:clean ${counts} —— 无缺口即零写零推`)
  else if (summary.state === 'landed')
    logger(`🧭 跨端造页闭环:landed ${counts} ✅ 已落 HEAD(推送由 post-commit 腿负责)`)
  else if (summary.state === 'pending')
    logger(`⚠️ 跨端造页闭环:pending ${counts} —— 有可产页却没落地,下轮重派`)
  else
    logger(
      `⚠️ 跨端造页闭环:${summary.state} ${counts} —— ` +
        String(summary.why || summary.note || '未附原因').slice(0, 120),
    )
  return {
    ran: true,
    ok: summary.state === 'clean' || summary.state === 'landed',
    state: summary.state,
    planned: n(summary.planned),
    refused: n(summary.refused),
  }
}

/* ═══════════════ 派生产物自走与推送分叉到人(2026-10-27 立,三条腿)═══════════════
 *
 * 三条都判**机器状态** ⇒ 一律不进提交链(§12e),一律自带节流,一律"取不到结论"只写日志不记绿(§0.3)。
 *
 *  A healI18nBundleLeg —— 守门 105 的 G5(小程序离线语言包自述钉)是 blocking 且每次提交都跑,
 *     而这一维此前**只有人肉 `pnpm gen:i18n`** 一条出路:输入或生成器一改并经旁路落地(不跑钩子),
 *     HEAD 上的产物钉就落后,下一枚毫不相干的提交被拦 —— 只判不修的 blocking 门就是恒红门。
 *     器物:`scripts/heal-derived-in-checkout.mjs --family i18n`(在主仓按被审面重生成,复量后才落 blob;
 *     这一族不建检出 —— 2026-10-27 实测:检出要 4-5 分钟而生成只占 12 秒,窗口正好被并发提交跨过去)。
 *  B auditPushDivergenceLeg —— 本地与 origin/main 真分叉时,全仓**零报警腿**:推送状态件只在 push-guard
 *     那一侧写,而"没人推得动"这件事没有任何一层量过(2026-10-26 实测:本地 ahead 121 / 远端 ahead 331
 *     持续移动,账面一声不响)。尺子:`scripts/lib/push-divergence-watch.mjs`,三态 ok/breach/unjudged。
 *     breach 到人(§5e-1:正文自带可照抄的下一步命令;身份 = 分档名 + 持续档,不塞会抖的计数)。
 *  C healMirrorPurgeLeg —— 守门 238(镜像宣传内容不得回潮)是绝对零容忍的 blocking 门,而回潮通道是
 *     "收编滞后工作树副本"那条既有链路(旁路落地不写工作树 ⇒ 别人的旧副本被收编回来)。
 *     门自己现在有 `--fix` 了(在飞副本闸 + 量级闸),本格只是给它一个调度器。
 */
const DERIVED_HEAL_INTERVAL_MS = Number(process.env.IHUI_DERIVED_HEAL_INTERVAL_MS || 30 * 60 * 1000)
// 离线包一族单独收紧到 10 分钟(2026-10-27):它现在是秒级(实测整轮 2m51s,生成只占 12s),
// 而词包输入由造页闭环腿每几分钟动一次 —— 30 分钟节拍意味着 HEAD 上的钉最长落后 30 分钟,
// 那段时间里 CI 的 G5(blocking)与小程序构建拿到的都是旧包。clean 时零写零推,加密度不产生新提交。
const I18N_HEAL_INTERVAL_MS = Number(process.env.IHUI_I18N_HEAL_INTERVAL_MS || 10 * 60 * 1000)
const PUSH_WATCH_INTERVAL_MS = Number(process.env.IHUI_PUSH_WATCH_INTERVAL_MS || 15 * 60 * 1000)
const MIRROR_FIX_INTERVAL_MS = Number(process.env.IHUI_MIRROR_FIX_INTERVAL_MS || 30 * 60 * 1000)
const UI_ROUTES_HEAL_INTERVAL_MS = Number(
  process.env.IHUI_UI_ROUTES_HEAL_INTERVAL_MS || DERIVED_HEAL_INTERVAL_MS,
)
/** 样式派生面一族的节流(默认与检出档同宽 30 分钟;源头没动时一轮零检出零写盘) */
const STYLE_TOKENS_HEAL_INTERVAL_MS = Number(
  process.env.IHUI_STYLE_TOKENS_HEAL_INTERVAL_MS || DERIVED_HEAL_INTERVAL_MS,
)

/** 节流台账:到点就写 attemptAt 并放行;取不到/写不进都不拦派发(宁可多跑一轮,不可静默停摆)。 */
function legThrottle(tickFile, intervalMs, now, logger) {
  let last = NaN
  try {
    last = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(last) && now - last < intervalMs) return false
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠️ 节流台账写入失败(${String(e?.message ?? e).slice(0, 80)})——下轮照旧派发`)
  }
  return true
}

/** 子命令共用电次:显式 stdio(§12g)+ windowsHide(§5b)+ 有界超时(守门 80);非零不抛,结论在 stdout */
function runLegChild(scriptFile, args, timeoutMs, cwd = WORKTREE) {
  try {
    const out = execFileSync(process.execPath, [scriptFile, ...args], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout: String(out ?? ''), stderr: '' }
  } catch (e) {
    return {
      // signal 是"被杀"的唯一凭据:超时 SIGTERM 时 e.status 为 null 且 stdout 为空,
      // 与"跑完了但没打结论行"在日志里长得一模一样 —— 前者要修上限,后者要修器物。
      signal: e?.signal ?? null,
      status: typeof e?.status === 'number' ? e.status : null,
      stdout: String(e?.stdout ?? ''),
      stderr: String(e?.stderr ?? e?.message ?? ''),
    }
  }
}

export function healI18nBundleLeg(opts = {}) {
  return runDerivedHealLeg('i18n', {
    ...opts,
    tickFile: opts.tickFile ?? join(dirname(LOG), 'i18n-bundle-heal-last.json'),
    intervalMs: opts.intervalMs ?? I18N_HEAL_INTERVAL_MS,
  })
}

/**
 * 四端 ui-routes 族走**同一件器物**(见 runDerivedHealLeg 头注)。
 * 2026-10-27 实测:写回档在盘上跑生成器时,web 与小程序两份因"该端输入的工作树副本 ≠ 面副本"被拒落
 * —— 拒落是对的(不许把别人的现场或滞后副本烘进派生件),但拒完没人管 ⇒ G5 把红留给下一枚不相干提交。
 */
export function healUiRoutesLeg(opts = {}) {
  return runDerivedHealLeg('ui-routes', {
    ...opts,
    tickFile: opts.tickFile ?? join(dirname(LOG), 'ui-routes-heal-last.json'),
    intervalMs: opts.intervalMs ?? UI_ROUTES_HEAL_INTERVAL_MS,
  })
}

/**
 * 样式派生面(tokens 族)走**同一件器物**(见 runDerivedHealLeg 头注)。
 * 立因(2026-10-27 现读):样式派生腿在提交链里挂在 pre-commit 的 TOKEN_SYNC_TARGETS,前提是该文件
 * 被 staged;而本仓大量落地走对象空间(commit-tree + CAS,不跑钩子)⇒ HEAD 上留下一格欠派生,
 * 今天由人/代理手工补(近两枚提交标题即「派生产物按 HEAD 面重生成并落地(检出档)」。守护轮此前
 * 对该族**一条腿都没有**(派发自愈只有 i18n / ui-routes),这一格补上才是"样式自动同步"。
 */
export function healStyleTokensLeg(opts = {}) {
  return runDerivedHealLeg('tokens', {
    ...opts,
    tickFile: opts.tickFile ?? join(dirname(LOG), 'style-tokens-heal-last.json'),
    intervalMs: opts.intervalMs ?? STYLE_TOKENS_HEAL_INTERVAL_MS,
  })
}

const DIST_HEAL_INTERVAL_MS = Number(process.env.IHUI_DIST_HEAL_INTERVAL_MS || 30 * 60 * 1000)

/**
 * workspace 包 dist 落后 ⇒ 自动重建腿(2026-10-27 立,器物 = scripts/heal-stale-dist.mjs)。
 *
 * 立因(现读两条):① 消费方按 `package.json` 的 exports 取的是 **dist** 而不是 src,所以
 * 「web 改一笔样式常量」即使已经把 src 与派生面同步好,只要没人跑 `pnpm --filter <pkg> build`,
 * RN/小程序读到的仍是旧值 —— 实测 `@ihui/shared` 落后 21 项全是样式常量(CAROUSEL_DOT_ACTIVE_WIDTH_PX
 * / COLORFUL_LOVER_HUE_STEP 一族)。② 守门 101/103 的 D 维对"清单没把声明入口指到 dist"的包只报数,
 * 所以这条洞**没有任何红**;喊的"修复:pnpm … build"历来靠人想起来敲(§0.9 喊了没人修 = 也没装)。
 *
 * 与样式派生腿的先后是有意义的:派生腿写 src/派生件,本腿编译 src→dist,故必须排在派生之后。
 * 不排队尾(本仓记过队尾静默停摆:前面的腿吃满整轮预算,队尾永远跑不到)。
 *
 * 只写机器态(gitignored dist),不动仓、不落 HEAD、不推 ⇒ 零协作面副作用;判机器状态 ⇒ 不进提交链(§12e)。
 * 一轮上限 6 个包(器物自证),超量按 refused 出声而不自动背书。
 */
export function healStaleDistLeg(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = DIST_HEAL_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'stale-dist-heal-last.json'),
    logger = log,
    runner = null,
    scriptFile = null,
  } = opts
  const script = scriptFile ?? join(dirname(fileURLToPath(import.meta.url)), 'heal-stale-dist.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ dist 新鲜度:器物不在位(scripts/heal-stale-dist.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '器物不在位' }
  }
  if (!legThrottle(tickFile, intervalMs, now, logger)) return { ran: false, why: '未到节流窗口' }
  const r =
    typeof runner === 'function'
      ? { status: 0, stdout: String(runner() ?? ''), stderr: '' }
      : runLegChild(script, ['--apply', '--json'], 12 * 60 * 1000)
  let res = null
  try {
    const lastLine = String(r.stdout ?? '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .pop()
    res = JSON.parse(lastLine ?? '')
  } catch {
    /* 下面统一按"未判定"报 */
  }
  if (!res || typeof res !== 'object' || typeof res.state !== 'string') {
    logger(
      `ℹ️ dist 新鲜度:结论行解析不出(status=${r.status})⇒ 本轮未判定,下轮重试 ${String(r.stderr ?? '').slice(0, 120)}`,
    )
    return { ran: true, ok: false, why: '结论解析失败', status: r.status }
  }
  logger(
    `ℹ️ dist 新鲜度:state=${res.state} 待重建=${(res.targets || []).length} 已消账=${(res.healed || []).length}${
      (res.still || []).length ? ` 仍落后=${res.still.join(',').slice(0, 160)}` : ''
    }${res.why ? ` —— ${String(res.why).slice(0, 140)}` : ''}`,
  )
  return { ran: true, ok: res.state !== 'undetermined', ...res }
}

const MINIAPP_DIST_HEAL_INTERVAL_MS = Number(
  process.env.IHUI_MINIAPP_DIST_HEAL_INTERVAL_MS || 6 * 60 * 60 * 1000,
)

/**
 * 小程序 weapp 产物陈旧 ⇒ 自动重建腿(2026-10-28 立,器物 = scripts/heal-stale-miniapp-dist.mjs)。
 *
 * 立因(现读):`apps/miniapp-taro/dist` 停在 2026-10-26 11:25,而端内源码 10-28 19:50 仍在改 ——
 * 于是 `check-miniapp-css-landing.mjs` 的 C0 结构性判据只能落「未判定」(exit 2),C1 覆盖率尺**恒瞎**。
 * 这是本仓最贵的一型失效(§0.3):「小程序样式有没有真落地」这一格既不算过也不算红,而账面看上去
 * 只是"没消息"。上一格的 healStaleDistLeg 只覆盖 workspace 包 dist(器物 heal-stale-dist.mjs),
 * **不含任何 app 的构建产物**,所以这条洞此前无人负责。
 *
 * 为什么可以无人值守:dist 被 `apps/miniapp-taro/.gitignore` 忽略且**零跟踪**(git check-ignore 命中、
 * git ls-files = 0 件,均实测)⇒ 重建只写机器态,不动仓、不落 HEAD、不推。判机器状态 ⇒ 不进提交链(§12e)。
 *
 * 节拍 6 小时而不是 30 分钟:一轮要跑一次完整 weapp 构建(Taro + tailwind + 后处理),比同族的
 * dist 编译重一个量级;产物陈旧是"天"级现象,30 分钟去敲一次只会白烧 CPU。
 * 取不到尺子判词 ⇒ 器物自报 `undetermined`,本条只记日志不喊人(重建失败属常态,不制造噪声)。
 */
export function healStaleMiniappDist(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = MINIAPP_DIST_HEAL_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'miniapp-dist-heal-last.json'),
    logger = log,
    runner = null,
    scriptFile = null,
  } = opts
  const script =
    scriptFile ?? join(dirname(fileURLToPath(import.meta.url)), 'heal-stale-miniapp-dist.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 小程序产物新鲜度:器物不在位(scripts/heal-stale-miniapp-dist.mjs)⇒ 本轮跳过')
    return { ran: false, why: '器物不在位' }
  }
  if (!legThrottle(tickFile, intervalMs, now, logger)) return { ran: false, why: '未到节流窗口' }
  // 子进程上限必须大于器物内部三个超时之和(构建 25min + 两次尺子各 8min ⇒ 最坏 41min),
  // 否则被掐死时 stdout 是半截,结论行解析不出 → 每轮白判一次。
  const r =
    typeof runner === 'function'
      ? { status: 0, stdout: String(runner() ?? ''), stderr: '' }
      : runLegChild(script, ['--apply', '--json'], 45 * 60 * 1000)
  let res = null
  try {
    const lastLine = String(r.stdout ?? '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .pop()
    res = JSON.parse(lastLine ?? '')
  } catch {
    /* 下面统一按"未判定"报 */
  }
  if (!res || typeof res !== 'object' || typeof res.state !== 'string') {
    logger(
      `ℹ️ 小程序产物新鲜度:结论行解析不出(status=${r.status})⇒ 本轮未判定,下轮重试 ${String(
        r.stderr ?? '',
      ).slice(0, 120)}`,
    )
    return { ran: true, ok: false, why: '结论解析失败', status: r.status }
  }
  logger(
    `ℹ️ 小程序产物新鲜度:state=${res.state}${res.c0 ? ` c0=${res.c0}` : ''}${
      res.after ? ` after=${res.after}` : ''
    }${res.buildMs !== null && res.buildMs !== undefined ? ` 构建=${Math.round(res.buildMs / 1000)}s` : ''}${
      res.why ? ` —— ${String(res.why).slice(0, 140)}` : ''
    }`,
  )
  return { ran: true, ok: res.state !== 'undetermined', ...res }
}

const HAND_UPGRADE_INTERVAL_MS = Number(process.env.IHUI_HAND_UPGRADE_INTERVAL_MS || 30 * 60 * 1000)

/**
 * 手写镜像页 → 壳承载的自动升级腿(2026-10-27 立)。
 *
 * 为什么要有:小程序端现读 97 枚页仍是端内手写(合计 ~2.9 万行重复实现),而它们声明的共享屏在
 * RN 端全部有承载壳。判定与落地已各有一件器物(判据腿 = plan-hand-mirror-conversion 的相对取差;
 * 落地腿 = upgrade-miniapp-shell-pages --land),此前却只有人肉一条派发路 —— 与「造好没装车 =
 * 没有」同型(§0.9)。这一步接上,「源头改一笔两端同动」才会随时间自走。
 *
 * 节拍 30 分钟;零可落地时零写零推(器物在无 convertible 行时一次都不写盘,连 HEAD 都不读第二遍)。
 * 判机器状态 ⇒ 不进提交链(§12e)。结论只写日志不喊人:CAP=2 且五条安全判据全过才落,失败只报数。
 */
export function sweepHandMirrorUpgrades(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = HAND_UPGRADE_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'hand-mirror-upgrade-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'upgrade-miniapp-shell-pages.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ 手写页升级:器物不在位(scripts/upgrade-miniapp-shell-pages.mjs)⇒ 本轮跳过,不记为已探测',
    )
    return { ran: false, why: '器物不在位' }
  }
  if (!legThrottle(tickFile, intervalMs, now, logger)) return { ran: false, why: '未到节流窗口' }
  const r =
    typeof runner === 'function'
      ? { status: 0, stdout: String(runner() ?? ''), stderr: '', signal: null }
      : runLegChild(
          script,
          ['--land', '--json', '--cap=2'],
          // 2026-10-28:15 分钟被顶穿。现读一趟完整落地(写页 → 对象空间落地 → 按新 HEAD 重生成
          // 壳声明件 → 声明件再落一批)实测 17 分钟以上 —— 超时 SIGTERM 后 e.status=null 且 stdout
          // 空,与"跑完了没打结论行"同形,于是 16:31/17:06 两轮都记成「结论行解析不出」而真因是上限。
          // 抬到 30 分钟并留 env 旋钮(与 sweepCrossEndShellPages 同档)。
          Number(process.env.IHUI_HAND_UPGRADE_TIMEOUT_MS || 30 * 60 * 1000),
        )
  let res = null
  try {
    const lastLine = String(r.stdout ?? '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .pop()
    res = JSON.parse(lastLine ?? '')
  } catch {
    /* 下面统一按"未判定"报 */
  }
  if (!res || typeof res !== 'object') {
    const why = r.signal ? `子进程被 ${r.signal} 杀掉(多为超时)` : '子进程已退出但末行不是结论 JSON'
    logger(
      `ℹ️ 手写页升级:结论行解析不出(${why},status=${r.status})⇒ 本轮未判定,下轮重试 ${String(r.stderr ?? '').slice(0, 120)}`,
    )
    return { ran: true, ok: false, why: '结论解析失败', status: r.status, signal: r.signal }
  }
  const landedN = res.landed?.ok ? res.landed.pages : 0
  logger(
    `ℹ️ 手写页升级:可落地=${res.upgradable ?? 0} 本批=${res.batch?.length ?? 0} 落地=${landedN}${res.landed?.declLanded ? ' + 声明件' : ''}${res.landed?.err ? ` | ${String(res.landed.err).split('\n')[0].slice(0, 120)}` : ''}`,
  )
  return { ran: true, ok: true, ...res }
}

const RN_HOST_SHELL_INTERVAL_MS = Number(process.env.IHUI_RN_HOST_SHELL_INTERVAL_MS || 30 * 60 * 1000)

/**
 * 共享屏 → RN 宿主薄壳的自动补壳腿(2026-10-29 立)。
 *
 * 立因:`gen-rn-host-shell.mjs`(2026-10-28 立)把「接一枚新共享屏要手抄百行样板」变成一条命令,
 * 但接线当刻全仓检索该器物只命中它自己 —— 零派发点,按 §0.9「造好没装车 = 没有」。
 * 三段造页器(共享屏→RN 壳 / RN 壳→小程序页 / 缺页→镜像页)里只有第一格无人调度,
 * 于是链条在**第一节**就断:新共享屏不出 RN 壳,而下游 gen-miniapp-mirror 的三腿判据要求
 * 「HEAD 面有 RN 屏 import 该共享屏」⇒ 上游不动,下游每轮判「三腿不齐」拒产,整条链安静停摆。
 *
 * 失效方向:无待补壳 ⇒ 零写零推,只留一行读数;needs-manual(必填腿含端上事实)只点名不喊人
 * (§5e-1:那是常态而非事故,收信人无事可做);结论行取不到 ⇒ 记未判定,绝不折成"无需补壳"(§0.3)。
 * 判机器状态 ⇒ 不进提交链(§12e);不改守护退出码。
 */
export function sweepRnHostShells(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = RN_HOST_SHELL_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'rn-host-shell-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'gen-rn-host-shell.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ RN 薄壳补壳:器物不在位(scripts/gen-rn-host-shell.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '器物不在位' }
  }
  if (!legThrottle(tickFile, intervalMs, now, logger)) return { ran: false, why: '未到节流窗口' }
  const r =
    typeof runner === 'function'
      ? runner()
      : runLegChild(
          script,
          ['--all', '--write', '--cap=2'],
          Number(process.env.IHUI_RN_HOST_SHELL_TIMEOUT_MS || 10 * 60 * 1000),
        )
  stampCrossEndDispatch(tickFile, now, r, String(r.stdout ?? ''))
  // 结论行是该器物的既有文本档形态,本腿只解析不改它:
  // GEN-RN-HOST-SHELL state=preview|applied 目标=N 写出=N 跳过=N 需人工=N
  const m = /GEN-RN-HOST-SHELL state=(\w+) 目标=(\d+) 写出=(\d+) 跳过=(\d+) 需人工=(\d+)/.exec(
    String(r.stdout ?? ''),
  )
  if (!m) {
    logger(
      `⚠️ RN 薄壳补壳:结论取不到 ⇒ 本轮未判定(${
        r.signal ? `子进程被 ${r.signal} 掐死(上限 ${Math.round((Number(process.env.IHUI_RN_HOST_SHELL_TIMEOUT_MS) || 600000) / 60000)} 分钟)` : `status=${r.status ?? '?'}`
      })—— 这不等于"无需补壳"`,
    )
    return { ran: true, ok: false, state: 'undetermined', status: r.status, signal: r.signal }
  }
  const n = (v) => Number(v) || 0
  const [, state, targets, wrote, skipped, manual] = m
  logger(
    `🧭 RN 薄壳补壳:${state} 待补 ${n(targets)} / 写出 ${n(wrote)} / 跳过 ${n(skipped)} / 需人工 ${n(manual)}`,
  )
  return {
    ran: true,
    ok: true,
    state,
    targets: n(targets),
    wrote: n(wrote),
    skipped: n(skipped),
    manual: n(manual),
  }
}

/**
 * 派生产物自走重生成的共用派发体(两族各一条腿,底下只有一件器物、一条落 HEAD 的接缝)。
 * 器物 = scripts/heal-derived-in-checkout.mjs:按当前 HEAD 建 detached 检出 → 在检出里重跑各端生成器
 * → 逐份复量"新钉 == 面上现算输入哈希" → 只把复量过的 blob 落 HEAD(主工作树一字节不动)。
 * clean = 绝大多数轮次的常态 ⇒ 一声不出(每 30 分钟一行"没问题"只会把守护日志淹成噪声)。
 */
function runDerivedHealLeg(family, opts = {}) {
  const {
    now = Date.now(),
    intervalMs = DERIVED_HEAL_INTERVAL_MS,
    tickFile = join(dirname(LOG), `derived-heal-${family}-last.json`),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'heal-derived-in-checkout.mjs')
  if (!existsSync(script)) {
    logger(
      `ℹ️ 派生产物自走重生成(${family}):器物不在位(scripts/heal-derived-in-checkout.mjs)⇒ 本轮跳过,不记为已探测`,
    )
    return { ran: false, why: '器物不在位' }
  }
  if (!legThrottle(tickFile, intervalMs, now, logger)) return { ran: false, why: '未到节流窗口' }
  const r =
    typeof runner === 'function'
      ? runner()
      : runLegChild(script, ['--family', family, '--json'], 30 * 60 * 1000)
  let summary = null
  try {
    summary = JSON.parse(
      String(r.stdout ?? '')
        .trim()
        .split('\n')
        .pop(),
    )
  } catch {
    /* 取不到结论 = 未判定,下面明写,绝不记绿 */
  }
  if (!summary || typeof summary.state !== 'string') {
    logger(
      `⚠️ 派生产物自走重生成(${family}):结论取不到(status=${r.status})⇒ 未判定,不记绿:${String(r.stderr ?? '').slice(0, 160)}`,
    )
    return { ran: true, state: 'undetermined', family, status: r.status }
  }
  if (summary.state === 'clean') return { ran: true, state: 'clean', family }
  const mark = summary.state === 'landed' ? '✅' : summary.state === 'written' ? 'ℹ️' : '⚠️'
  logger(
    `${mark} 派生产物自走重生成(${family}) state=${summary.state} files=${(summary.files ?? []).length} —— ` +
      String(summary.detail ?? '').slice(0, 300),
  )
  for (const j of summary.judged ?? []) {
    for (const n of Array.isArray(j.notes) ? j.notes : []) {
      if (n.state === 'refused' || n.state === 'undetermined') {
        logger(`   · ${n.rel} —— ${n.state}:${String(n.why ?? '').slice(0, 160)}`)
      }
    }
  }
  return { ran: true, state: summary.state, family, summary }
}

export function auditPushDivergenceLeg(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = PUSH_WATCH_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'push-divergence-last.json'),
    logger = log,
    watcher = null,
    notify = notifyGuardRed,
  } = opts
  if (!legThrottle(tickFile, intervalMs, now, logger)) return { ran: false, why: '未到节流窗口' }
  let verdict
  try {
    const watch = typeof watcher === 'function' ? watcher : watchPushDivergence
    verdict = watch({ now }).verdict
  } catch (e) {
    // 尺子自己抛 = 这一轮没判(§0.3),绝不因为"取不到"就报"没问题"
    logger(`⚠️ 推送分叉探测:尺子异常 ⇒ 未判定:${String(e?.message ?? e).slice(0, 160)}`)
    return { ran: true, state: 'undetermined' }
  }
  if (!verdict || !verdict.state) {
    logger('⚠️ 推送分叉探测:尺子没回结论 ⇒ 未判定,不记绿')
    return { ran: true, state: 'undetermined' }
  }
  if (verdict.state === 'ok') return { ran: true, state: 'ok', band: verdict.band }
  if (verdict.state === 'unjudged') {
    logger(`⚠️ 推送分叉探测:未判定 —— ${String(verdict.text ?? '').slice(0, 200)}`)
    return { ran: true, state: 'unjudged', missing: verdict.missing ?? [] }
  }
  const id = buildAlertIdentity(verdict, { now })
  const sent = notify(id.name, id.detail, { severity: id.severity, dedupKey: id.dedupKey, now })
  logger(
    `📣 推送分叉探测:breach(${verdict.band}) —— ${String(verdict.text ?? '').slice(0, 200)}` +
      ` ⇒ 到人=${sent?.sent ? 'yes' : `no(${String(sent?.why ?? '').slice(0, 60)})`}`,
  )
  return {
    ran: true,
    state: 'breach',
    band: verdict.band,
    mailed: !!sent?.sent,
    identity: id.dedupKey,
  }
}

export function healMirrorPurgeLeg(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = MIRROR_FIX_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'mirror-purge-fix-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'check-mirror-purge-intact.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ 镜像徽章自愈:器物不在位(scripts/check-mirror-purge-intact.mjs)⇒ 本轮跳过,不记为已探测',
    )
    return { ran: false, why: '器物不在位' }
  }
  if (!legThrottle(tickFile, intervalMs, now, logger)) return { ran: false, why: '未到节流窗口' }
  const r = typeof runner === 'function' ? runner() : runLegChild(script, ['--fix'], 5 * 60 * 1000)
  const line = String(r.stdout ?? '')
    .split('\n')
    .find((l) => l.includes('MIRROR-PURGE-FIX-RESULT'))
  if (!line) {
    logger(
      `⚠️ 镜像徽章自愈:结论取不到(status=${r.status})⇒ 未判定,不记绿:${String(r.stderr ?? '').slice(0, 140)}`,
    )
    return { ran: true, state: 'undetermined', status: r.status }
  }
  // fixed=0 是常态(文档本来就是干净的)⇒ 只在这种轮次留一行都不写;有改动/有拒落才值得被看见
  const m = /state=(\S+).*?fixed=(\d+).*?refused=(\d+)/.exec(line)
  if (m && m[1] === 'clean' && Number(m[2]) === 0 && Number(m[3]) === 0)
    return { ran: true, state: 'clean' }
  logger(`ℹ️ 镜像徽章自愈:${line.slice(0, 260)}`)
  return { ran: true, state: m?.[1] ?? 'unknown', line }
}

/**
 * 跨端台账门户维收敛(2026-10-27 立):把 web-rn-screen-map.jsonl 里与 WebView 门户表互斥的
 * 在册判定(gap/excluded 而门户表说承载)自动改写成 portal 行。
 * 为什么必须自动:registeredGap/registeredExcluded 是自动登记链的**跳过集** —— 假判定留在台账里,
 * 那条链就永远不重判这些路由,只能等人逐条翻代码推翻(与"最大化减少开发"正面冲突)。
 * 判据零复算:门户表解析与推翻判据取对账尺那一份(check-web-rn-screen-parity.mjs),本腿只派发并读结论行。
 * 写盘面只有工作树(与 healCrossEndMirror 同族),落库交给仓内收编器 auto-commit-quiet。
 * 失效方向:clean ⇒ 零读数;converged ⇒ 留一行;undetermined/unparsed ⇒ 点名未判定,绝不读成"已收敛"。
 * 判机器状态 ⇒ 不进提交链(§12e);不改守护退出码;收敛属常态不到人(§5e-1)。
 */
export function convergeCrossEndPortalVerdicts(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = CROSS_END_SHELL_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'cross-end-portal-converge-last.json'),
    logger = log,
    runner = null,
    notify = notifyGuardRed,
    undetFile = crossEndUndetFile('portal-converge'),
    undetHorizonMs = CROSS_END_UNDET_HORIZON_MS,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'auto-register-cross-end.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 门户维收敛:器物不在位(scripts/auto-register-cross-end.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '登记器不在位' }
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
    logger(`⚠️ 门户维收敛:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`)
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(
              process.execPath,
              [script, '--converge-portal', '--converge-render', '--only=portal', '--apply'],
              {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b 派生进程纪律
                timeout: 10 * 60 * 1000,
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'], // §12g 显式接管 stdio
              },
            )
            return { ok: true, out: String(out ?? ''), status: 0 }
          } catch (e) {
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
            }
          }
        }
  const r = run()
  stampCrossEndDispatch(tickFile, now, r, String(r.out ?? r.stdout ?? ''))
  const stdout = String(r.out ?? r.stdout ?? '')
  const line = stdout.split('\n').find((l) => l.includes('AUTO-REGISTER-PORTAL'))
  if (!line) {
    const detail =
      `派生 rc=${r.status ?? '?'};stderr 前 120:${String(r.err ?? r.stderr ?? '').slice(0, 120) || '(空)'}\n` +
      `这表示**门户维收敛这一格是瞎的**(台账里该翻成 portal 的行没人翻),不是"台账已收敛"。\n` +
      `出路:node scripts/auto-register-cross-end.mjs --converge-portal --converge-render --only=portal --apply`
    logger(
      `⚠️ 门户维收敛:结论行取不到(rc=${r.status ?? '?'})⇒ 本轮没判,既不读成"台账已收敛"也不读成"无需收敛"`,
    )
    noteCrossEndUndetermined('portal-converge', detail, {
      logger,
      notify,
      file: undetFile,
      horizonMs: undetHorizonMs,
    })
    return { ran: true, state: 'unparsed', status: r.status ?? null }
  }
  const m = /state=(\S+)\s+candidates=(\d+)\s+applied=(\d+)/.exec(line)
  const state = m?.[1] ?? 'unknown'
  const candidates = Number(m?.[2] ?? -1)
  const applied = Number(m?.[3] ?? -1)
  if (state === 'undetermined') {
    logger(`⚠️ 门户维收敛:未判定(门户表取不到)⇒ 台账一条未改:${line.slice(0, 200)}`)
    noteCrossEndUndetermined(
      'portal-converge',
      `结论行自报未判定 ⇒ 这一格没判:\n${line.slice(0, 300)}`,
      { logger, notify, file: undetFile, horizonMs: undetHorizonMs },
    )
    return { ran: true, state, candidates, applied }
  }
  settleCrossEndLeg('portal-converge', { logger, file: undetFile })
  // 渲染复判(①b)与门户收敛同一条派发 ⇒ 它的出账也必须上同一块仪表板。
  // 只转述 PORTAL 那行的后果是:这条腿每轮改了判、留了几条 gap、几条量不到,日志里一个字都没有
  // —— 装了指纹采集器却不接指示灯,等于没装(§0.9/§12f:能看见的才谈得上修)。
  const renderLine = stdout.split('\n').find((l) => l.includes('AUTO-REGISTER-RENDER'))
  if (renderLine && !/state=off/.test(renderLine)) logger(`ℹ️ 渲染复判:${renderLine.slice(0, 240)}`)
  // 反向牙:整行都不出现 ⇒ 旗掉了或 child 在 PORTAL 行之后就死 ⇒ 这一维**没判**,不许读成"无事"。
  // (off 是"这条派发刻意不做收敛",不在射程;缺行才是安静失效。)
  if (!renderLine)
    logger('⚠️ 渲染复判:结论行缺失 ⇒ 这一维本轮没判(旗 --converge-render 是否还在派发里?),不读成"无需改判"')
  if (state === 'clean' && candidates === 0 && applied === 0)
    return { ran: true, state, candidates, applied }
  logger(`ℹ️ 门户维收敛:${line.slice(0, 260)}`)
  return { ran: true, state, candidates, applied, line }
}

/**
 * RN 色档同源配对自动入表(2026-10-27 立):跑 scripts/plan-rn-token-pairing.mjs --apply,
 * 把「亮暗两面与某个源变量各自等值」的 RN 手抄色档自动登记进守门 93 的 MAPPINGS。
 * 为什么这一格可以自动动手:**判据是等值**,登记后派生器写回的值与现值逐位同色 —— 本会话实测
 * 8 档入表后 rn-tokens.ts 零 diff。也就是说这条腿永远不改颜色,它只把"手抄字面量"变成"派生态",
 * 从此 web 改这一档 RN 自动跟随。风险面与"改颜色"的腿不同源,故不需要人先点头。
 * 判据零复算(§0.6):等值/命名推导/色阶不挂角色档/在册分歧不再冒充未判,全部住在计划器那一份实现里,
 * 本腿只派发并读它打的结论行。写盘面只有工作树(与 healCrossEndMirror / convergeCrossEndPortalVerdicts
 * 同族),落库交给仓内收编器。
 * 护栏:计划器在守门件挂着**他席不在 HEAD 的行**时整批拒落(不替别人提交)⇒ 本腿把 refused 记一行、
 * 不到人(§5e-1:拒落属常态);state=undetermined/unparsed ⇒ 显式未判定,绝不读成"已同源"。
 * 判机器状态 ⇒ 不进提交链(§12e);不改守护退出码。
 */
export function autoRegisterRnTokenPairs(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = Number(process.env.IHUI_RN_TOKEN_PAIR_INTERVAL_MS || 60 * 60 * 1000),
    tickFile = join(dirname(LOG), 'rn-token-pair-apply-last.json'),
    logger = log,
    runner = null,
    notify = notifyGuardRed,
    undetFile = crossEndUndetFile('rn-token-pair'),
    undetHorizonMs = CROSS_END_UNDET_HORIZON_MS,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'plan-rn-token-pairing.mjs')
  if (!existsSync(script)) {
    logger(
      'ℹ️ RN 色档同源入表:器物不在位(scripts/plan-rn-token-pairing.mjs)⇒ 本轮跳过,不记为已探测',
    )
    return { ran: false, why: '计划器不在位' }
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
    logger(
      `⚠️ RN 色档同源入表:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`,
    )
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--apply'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b 派生进程纪律
              timeout: 10 * 60 * 1000,
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'], // §12g 显式接管 stdio
            })
            return { ok: true, out: String(out ?? ''), status: 0 }
          } catch (e) {
            // exit 1 = refused(他席在飞,属常态)、2 = 未判定:结论行仍在 stdout,非零不等于没判。
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
            }
          }
        }
  const r = run()
  stampCrossEndDispatch(tickFile, now, r, String(r.out ?? r.stdout ?? ''))
  const line = String(r.out ?? r.stdout ?? '')
    .split('\n')
    .find((l) => l.includes('PLAN-RN-PAIRING-APPLY'))
  if (!line) {
    logger(
      `⚠️ RN 色档同源入表:结论行取不到(rc=${r.status ?? '?'})⇒ 本轮没判,` +
        `既不读成"已同源"也不读成"无档可配":${String(r.err ?? r.stderr ?? '').slice(0, 120)}`,
    )
    noteCrossEndUndetermined(
      'rn-token-pair',
      `派生 rc=${r.status ?? '?'};stderr 前 120:${String(r.err ?? r.stderr ?? '').slice(0, 120) || '(空)'}\n` +
        `这表示**RN 色档同源入表这一格是瞎的**(web 改档后 RN 侧该跟随的档没人登记),不是"无档可配"。\n` +
        `出路:node scripts/plan-rn-token-pairing.mjs --apply`,
      { logger, notify, file: undetFile, horizonMs: undetHorizonMs },
    )
    return { ran: true, state: 'unparsed', status: r.status ?? null }
  }
  const m = /state=(\S+)\s+inserted=(\d+)/.exec(line)
  const state = m?.[1] ?? 'unknown'
  const inserted = Number(m?.[2] ?? -1)
  if (state === 'undetermined') {
    logger(`⚠️ RN 色档同源入表:计划器自报未判定 ⇒ 本轮没判:${line.slice(0, 240)}`)
    noteCrossEndUndetermined(
      'rn-token-pair',
      `结论行自报未判定 ⇒ 这一格没判:\n${line.slice(0, 300)}`,
      {
        logger,
        notify,
        file: undetFile,
        horizonMs: undetHorizonMs,
      },
    )
    return { ran: true, state, inserted }
  }
  settleCrossEndLeg('rn-token-pair', { logger, file: undetFile })
  if (state === 'nochange' && inserted === 0) return { ran: true, state, inserted }
  // applied:真改了守门件 ⇒ 留读数(收编器据此落库);refused:点名但不喊人。
  logger(`ℹ️ RN 色档同源入表:${line.slice(0, 240)}`)
  return { ran: true, state, inserted, line }
}

export function healCrossEndMirror(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = CROSS_END_MIRROR_INTERVAL_MS,
    tickFile = join(dirname(LOG), 'cross-end-mirror-last.json'),
    logger = log,
    runner = null,
    notify = notifyGuardRed,
    undetFile = crossEndUndetFile('mirror-heal'),
    undetHorizonMs = CROSS_END_UNDET_HORIZON_MS,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), 'repair-cross-end-mirror.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ 跨端镜像自愈:器物不在位(scripts/repair-cross-end-mirror.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '修复器不在位' }
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
    logger(
      `⚠️ 跨端镜像自愈:节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})——下轮照旧派发`,
    )
  }
  const run =
    typeof runner === 'function'
      ? runner
      : () => {
          try {
            const out = execFileSync(process.execPath, [script, '--apply', '--json'], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b
              timeout: 5 * 60 * 1000, // 守门 80
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { ok: true, out: String(out ?? ''), status: 0 }
          } catch (e) {
            // exit 1 = 判定成立但有拒落(常见:他席在飞);结论整份仍在 stdout。
            return {
              ok: false,
              out: String(e?.stdout ?? ''),
              err: String(e?.stderr ?? ''),
              status: typeof e?.status === 'number' ? e.status : null,
            }
          }
        }
  const r = run()
  stampCrossEndDispatch(tickFile, now, r, String(r.out ?? r.stdout ?? ''))
  const stdout = String(r.out ?? r.stdout ?? '')
  const stderr = String(r.err ?? r.stderr ?? '')
  let parsed = null
  try {
    const a = stdout.indexOf('{')
    const b = stdout.lastIndexOf('}')
    if (a >= 0 && b > a) parsed = JSON.parse(stdout.slice(a, b + 1))
  } catch {
    /* 落到下面"结论不可用" */
  }
  const summary = parsed?.summary
  if (!summary || typeof summary !== 'object') {
    logger(
      `⚠️ 跨端镜像自愈:结论不可用:未判定 —— ${stderr.slice(0, 120) || '未取到 JSON'}` +
        ` ⇒ 本轮没判,不等于"声明链一致"`,
    )
    noteCrossEndUndetermined(
      'mirror-heal',
      `派生 rc=${r.status ?? '?'};stderr 前 120:${stderr.slice(0, 120) || '(空)'}\n` +
        `这表示**声明链自愈这一格是瞎的**(镜像标记被合并削掉后没人接回),不是"声明链一致"。\n` +
        `出路:node scripts/repair-cross-end-mirror.mjs --json(只读预演)`,
      { logger, notify, file: undetFile, horizonMs: undetHorizonMs },
    )
    return { ran: true, ok: false, state: 'unparsed' }
  }
  settleCrossEndLeg('mirror-heal', { logger, file: undetFile })
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const findings = num(summary.findings) ?? 0
  const applied = num(summary.applied) ?? 0
  const refused = num(summary.refused) ?? 0
  const registryEntries = num(summary.registryEntries)
  if (refused > 0) {
    const names = (Array.isArray(parsed.refused) ? parsed.refused : [])
      .slice(0, 3)
      .map((x) => `${x?.shared ?? x?.kind ?? '?'}(${String(x?.why ?? '').slice(0, 60)})`)
      .join(' / ')
    logger(
      `⚠️ 跨端镜像自愈:补回 ${applied} 条、拒落 ${refused} 条(多为他席在飞,不替人提交)` +
        `${names ? ` ｜ ${names}` : ''} ⇒ 未修完,下轮再试`,
    )
    return { ran: true, ok: false, state: 'partial', findings, applied, refused }
  }
  if (applied > 0) {
    logger(`✅ 跨端镜像自愈:补回 ${applied} 条声明链(登记表说有、代码侧标记/路由被合并削掉)`)
    return { ran: true, ok: true, state: 'healed', findings, applied, refused, registryEntries }
  }
  logger(`✅ 跨端镜像自愈:声明链一致(登记表 ${registryEntries ?? '?'} 条,无缺口可补)`)
  return { ran: true, ok: true, state: 'clean', findings, applied, refused, registryEntries }
}


/**
 * 单实例闸(2026-10-28 立)。计划任务每 2 分钟拉一轮,而一轮巡检经常超过 2 分钟(腿多、派生腿慢),
 * 于是两轮并存 ⇒ 它们抢同一个临时检出槽位 `.worktrees/derived-heal`:一条刚 `worktree add`,
 * 另一条 `remove` 就把它删掉,留下 EPERM 与 `already exists` 交替出现 —— 实测样式派生腿(tokens)
 * 从 2026-10-28 15:49 起每轮 refused,而日志里只写「检出残留摘不掉…交人工」,真因没人看得见。
 * 失效方向:抢不到闸就静默退出(下一轮 2 分钟后还会来),绝不让锁本身停摆巡检。
 */
const GUARDIAN_PID_FILE = join(dirname(LOG), 'git-guardian.pid')

function acquireSingleInstance(pidFile = GUARDIAN_PID_FILE) {
  try {
    const prev = Number(String(readFileSync(pidFile, 'utf8')).match(/pid=(\d+)/)?.[1] ?? 0)
    if (prev && prev !== process.pid) {
      try {
        process.kill(prev, 0)
        return { ok: false, pid: prev }
      } catch {
        /* 前一进程已退出 ⇒ 接管 */
      }
    }
  } catch {
    /* 没跑过 */
  }
  try {
    mkdirSync(dirname(pidFile), { recursive: true })
    writeFileSync(pidFile, `pid=${process.pid} at=${new Date().toISOString()}`, 'utf8')
    process.on('exit', () => {
      try {
        if (Number(String(readFileSync(pidFile, 'utf8')).match(/pid=(\d+)/)?.[1]) === process.pid)
          unlinkSync(pidFile)
      } catch {
        /* 退不掉就留着,下轮按 pid 存活判定 */
      }
    })
  } catch {
    return { ok: true, degraded: 'pid 文件写不了' }
  }
  return { ok: true }
}

function main() {
  // 手工/只读入口不参与单实例闸:它们要么不写盘,要么是人在等结果
  const manual = process.argv.includes('--check') || process.argv.includes('--notify-test')
  const inst = manual ? { ok: true } : acquireSingleInstance()
  if (!inst.ok) {
    if (
      legThrottle(
        join(dirname(LOG), 'guardian-overlap-last.json'),
        30 * 60 * 1000,
        Date.now(),
        log,
      )
    )
      log(
        `ℹ️ 上一轮巡检仍在跑(pid=${inst.pid})⇒ 本轮静默退出:两轮并存会抢同一临时检出槽位(.worktrees/derived-heal),互相删对方的目录(本行 30 分钟最多一条)`,
      )
    return
  }
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
    // 违禁桶兜底清扫(2026-10-25,等条件/待拍板两道机主禁令的执行器物化):union 收敛器与
    // 复翻席不走提交链 ⇒ F11/F12 基线棘轮拦不到"主动写回";本层派发 strip-banned-buckets
    // 自动摘 HEAD 面违禁未勾行并留痕,循环回潮 5 分钟级自动收敛(判据 import 单源,零复算)。
    if (!CHECK_ONLY) sweepBannedBuckets()
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
    // lint-staged stdio 三针盯针:与上一行同挂点语义(判机器状态 ⇒ 不进提交链,§12e),45 分钟节流。
    if (!CHECK_ONLY) auditLintStagedPins()
    // 反馈闭环断点(2026-10-28 立,尺子 = scripts/feedback-loop-status.mjs):闭环器件此前零自动
    // 调用者,链断了没人喊。30 分钟节流;超 48 小时处置窗口仍卡同一段才喊,窗口内只写日志。
    // 判机器状态 ⇒ 不进提交链(§12e);挂进 CHECK_ONLY 早退分支等于永不执行。
    if (!CHECK_ONLY) auditFeedbackLoopClosure()
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
    // 短信通道健康(2026-10-27 立,尺子 = scripts/check-sms-channel-health.mjs):判机器状态 ⇒
    // 不进提交链(§12e)。立因 = 当天阿里云欠费停机一整天、用户拿不到登录验证码,而全仓零门喊过。
    if (!CHECK_ONLY) auditSmsChannelHealth()
    // 资产路径可达性 + 证书到期(2026-10-28 立,尺子 = scripts/check-asset-path-health.mjs):立因 =
    // 生产 .env 四条支付宝证书路径写在已不存在的 F: 盘上,SDK 静默读不到证书,全仓零门喊过。6h 节流。
    if (!CHECK_ONLY) auditAssetPathHealth()
    // AASA 公网健康(2026-10-29 立):这台尺子造出来时只接了手工入口 `pnpm check:aasa-health`,
    // 没人按时跑它 —— 而它守的是"AASA 两腿公网可达且与单源同构",属机主面之外唯一能自动守的半格。
    if (!CHECK_ONLY) auditAasaPublicHealth()
    // 生产依赖漏洞巡检(2026-10-29 立,尺子 = scripts/check-prod-dep-advisories.mjs,6h 节流):
    // 立因 = 守门 260 只在提交链/全量档判,而**上游发新 CVE 不会触发提交** —— 没有这个派发点,
    // 新 CVE 要等下一个人恰好提交且恰好跑全量档才会被发现,等于没守。
    // red 发信(critical)/ 临期发提醒(warning)/ 未判定只写日志不喊人(§0.3,网络抖动不是缺陷)。
    if (!CHECK_ONLY) auditProdDepAdvisories()
    // 逐字回潮巡检(2026-10-29 立,尺子 = scripts/check-verbatim-resurrection.mjs,6h 节流):立因 =
    // 同日的嫁接枚 1fe3a2b42d 把 9 枚已声明删除的路径带回主线,而 168 要 ≥2 个父、旁路落地不跑钩子、
    // 238 只管文档面 —— 这型在提交链上结构上无人能看见,只能由常驻班次在"一切面"上判。
    if (!CHECK_ONLY) auditVerbatimResurrection()
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
    // 资源目录同步停更哨兵(尺子 = check-registry-sync-health.mjs;判定住 lib/registry-sync-audit)。
    // 30min 节流;psql/DSN 取不到 = 未判定不喊人(§12e:与提交内容无关的恒响只会废掉通道)。
    if (!CHECK_ONLY) auditRegistrySyncHealth()
    // TEMP 夹具清扫器同理:判据/保护面/镜像测试全在,唯独没人调度 ⇒ 本项目命名的残留过完账龄就永久留着。
    // 节流 24h、失败只写 ⚠️ 不改本守护退出码(它是动作层不是判据),挂点语义与上面各层同格。
    if (!CHECK_ONLY) scrubTempFixtures()
    // G-24 事故归档回收器调度接线(2026-10-26,席位 goal-20261026-b14r3):以 dry-run 调
    // scripts/archive-gc.mjs 并把「保留/待删/未判定」读数写进本守护日志通道(留痕);
    // 开关面 scripts/data/archive-gc-arm.json 默认关,真 --apply 由机主核过读数后按下。同一挂点语义。
    if (!CHECK_ONLY) archiveGcDryRun()
    // G-50 DevEnv 搬迁静默窗口探测(2026-10-28):票面「探测器找静默窗口自动执行」的调度格。
    // 与上一层同挂点语义(健康轮次 + !CHECK_ONLY);默认只 probe,真搬由
    // scripts/data/devenv-migrate-arm.json 显式开档(入库默认关)。30 分钟节流。
    if (!CHECK_ONLY) devenvMigratePatrol({ logger: log })
    // 活 TEMP 落点回潮哨兵(尺子 = check-temp-landing.mjs)。那份尺子的文件头早就写着"唯一调度器
    // = 本文件的 auditTempLanding()",而那个函数**从来不存在** —— 判据齐全却无人在调度,
    // 失效形态是安静。与 scrubTempFixtures 同格(健康轮次早退之前 + !CHECK_ONLY),节流 24h。
    if (!CHECK_ONLY) auditTempLanding()
    // 看门人也要有人看:凭据/停摆巡检靠 schtasks 每 6 小时自跑,任务被删/被停/node 路径
    // 看门人也要有人看:凭据/停摆巡检靠 schtasks 每 6 小时自跑,任务被删/被停/node 路径
    // 失效时它**自己不会喊**(故障形态是"安静",正是今天两天冻结的同类)。本守护每 2 分钟
    // 一趟且自身分层自愈,由它盯心跳最省。--check 仍零副作用。
    if (!CHECK_ONLY) watchWatchdog()
    // AI 自进化调度层(第 0 期 / 第 1 期 / 第 3 期②③,2026-10-26 接线):四层器物此前零派发点,
    // 属 §0.9「造好没装车 = 没有」。全部自带节流,判机器状态/产出台账 ⇒ 不进提交链(§12e)。
    // 顺序:先感知(分诊/腐烂/依赖)→ 再派发,同轮登记的票下一轮即可被自进化取到。
    if (!CHECK_ONLY) dispatchGateRot()
    if (!CHECK_ONLY) dispatchRelayCapacity()
    if (!CHECK_ONLY) dispatchAutoTriage()
    if (!CHECK_ONLY) dispatchDeployOutcomeIntake()
    if (!CHECK_ONLY) dispatchDeployFeedback()
    if (!CHECK_ONLY) dispatchExportUserFeedback()
    if (!CHECK_ONLY) dispatchE2eAutofill()
    if (!CHECK_ONLY) dispatchDepAdvisoryRadar()
    if (!CHECK_ONLY) dispatchAutoEvolve()
    if (!CHECK_ONLY) auditCrossEndParityDrift()
    if (!CHECK_ONLY) auditWebRnParity()
    if (!CHECK_ONLY) auditPushChannel()
    if (!CHECK_ONLY) healCrossEndMirror()
    if (!CHECK_ONLY) convergeCrossEndPortalVerdicts()
    if (!CHECK_ONLY) autoRegisterRnTokenPairs()
    // 链条按依赖序派:先补 RN 薄壳,再落小程序页 —— 下游三腿判据要问的就是"RN 腿在不在"。
    if (!CHECK_ONLY) sweepRnHostShells()
    if (!CHECK_ONLY) sweepCrossEndShellPages()
    if (!CHECK_ONLY) sweepHandMirrorUpgrades()
    if (!CHECK_ONLY) healI18nBundleLeg()
    if (!CHECK_ONLY) auditPushDivergenceLeg()
    if (!CHECK_ONLY) healMirrorPurgeLeg()
    if (!CHECK_ONLY) healStyleTokensLeg()
    if (!CHECK_ONLY) healStaleDistLeg()
    if (!CHECK_ONLY) healStaleMiniappDist()
    if (!CHECK_ONLY) healUiRoutesLeg()
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
        auditLintStagedPins()
        // 反馈闭环六段巡检(2026-10-28 立;与 main() 单轮路径同一挂点语义,共用
        // .ihui-agent/state/feedback-loop-closure-tick.ts 节流戳 ⇒ 双执行体并存只有先到那一个真跑,
        // 不会翻倍发信)。为什么必须挂在 tick 而不是只挂 main():startDaemon 是内存常驻的
        // setTimeout 链,不重读本文件;只挂 main() 一次性路径的话,常驻守护**永远跑不到**这一格,
        // 闭环就退回"器件在、没人看"。挂上后本改动需重启守护进程才生效(常驻不重读)。
        auditFeedbackLoopClosure()
        // 同一挂点语义:与 main() 单轮路径共用 .ihui-agent/state/service-heal-tick.iso 节流戳
        // ⇒ 双执行体并存时只有先到那一个真跑,不会把同一台服务重启两遍。
        healUnresponsiveServices()
        // TEMP 夹具清扫:与 main() 单轮路径共用 .ihui-agent/state/temp-scrub-tick.iso 节流戳
        // ⇒ 双执行体并存时只有先到那一个真删,不会把同一批夹具删两遍(第二遍也只是"无候选",
        // 但日志会多一行噪声,更重要的是节流语义必须与其余各层一致)。
        scrubTempFixtures()
        // G-24 归档回收 dry-run 接线臂:与 main() 单轮路径同一挂点语义,共用
        // .ihui-agent/state/archive-gc-arm-tick.iso 节流戳 ⇒ 双执行体并存只有一边真派生。
        archiveGcDryRun()
        // G-50 DevEnv 搬迁探测:与 main() 单轮路径同一挂点语义,共用
        // .ihui-agent/state/devenv-migrate-arm-tick.iso 节流戳 ⇒ 双执行体只有一边真探。
        devenvMigratePatrol({ logger: log })
        // AI 自进化调度层(第 0 期 / 第 1 期 / 第 3 期②③,2026-10-26 接线;2026-10-26 补装 daemon 腿):
        // 这四个派发现在只挂在 main() 那条**单轮**路径上,而本机实际载体是 nssm 服务跑 `--daemon`
        // ⇒ main() 从不执行,四层器物等于装了个没有车跑的车站(§0.9「造好没装车 = 没有」再犯一次)。
        // 节流戳与 main() 共用(同一 tick 文件),双执行体并存也只会有一边真跑;顺序先感知后派发,
        // 同轮登记的票下一轮即被自进化取到。仿 main() 同格:健康轮次内 + 提交窗口外(函数开头已让路)。
        dispatchGateRot()
        dispatchRelayCapacity()
        dispatchAutoTriage()
        dispatchDepAdvisoryRadar()
        dispatchAutoEvolve()
      }
    } catch (e) {
      log('巡检异常(忽略): ' + String(e.message || e))
    }
    setTimeout(tick, intervalMs)
  }
  tick()
}

// 〈原 19 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-25.md#guardian-l5738(门 103 C1 收口)〉首意: 
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


// 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5942(门 103 C1 收口)〉首意: ─── AI 自进化调度层派发点(2026-10-26 接线:第 0 期 + 第 1 期 + 第 3 期②③) ───────────
const AUTO_EVOLVE_INTERVAL_MS = Number(process.env.IHUI_AUTO_EVOLVE_INTERVAL_MS || 60 * 60 * 1000)
const AUTO_TRIAGE_INTERVAL_MS = Number(process.env.IHUI_AUTO_TRIAGE_INTERVAL_MS || 30 * 60 * 1000)
const DEP_RADAR_INTERVAL_MS = Number(process.env.IHUI_DEP_RADAR_INTERVAL_MS || 24 * 60 * 60 * 1000)
const GATE_ROT_INTERVAL_MS = Number(process.env.IHUI_GATE_ROT_INTERVAL_MS || 6 * 60 * 60 * 1000)
/** 号池容量哨兵节拍(默认 5 分钟:容量归零是要立刻知道的事,而哨兵只读、零落地) */
const RELAY_CAPACITY_INTERVAL_MS = Number(process.env.IHUI_RELAY_CAPACITY_INTERVAL_MS || 5 * 60 * 1000)
const GUARDIAN_SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))

function dispatchDue(tickFile, now, intervalMs) {
  let last = NaN
  try {
    last = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过 */
  }
  return !(Number.isFinite(last) && now - last < intervalMs)
}

function stampDispatchTick(tickFile, now, logger) {
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now).toISOString() }), 'utf8')
  } catch (e) {
    logger(`⚠ 派发节流台账写入失败(${String(e?.message ?? e).slice(0, 90)})—— 下轮照旧派发`)
  }
}

// 〈原 6 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l5977(门 103 C1 收口)〉首意: 自进化派发(第 0 期装车):取票面/白名单/预算/成本/单实例锁全部复用器物判据,
export function dispatchAutoEvolve(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = AUTO_EVOLVE_INTERVAL_MS,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'auto-evolve-dispatch-last.json'),
    ledgerFile = AE_LEDGER,
    lockFile = AE_LOCK_FILE,
    costLedgerFile = AE_COST_LEDGER,
    logger = log,
    readFile = (p) => readFileSync(p, 'utf8'),
    exists = existsSync,
    probe = null,
    launcher = null,
    gatesLoader = null,
  } = opts
  const script = join(GUARDIAN_SCRIPTS_DIR, 'auto-evolve.mjs')
  if (!exists(script)) {
    logger('ℹ 自进化派发:器物不在位(scripts/auto-evolve.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '自进化器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)

  let gates
  try {
    gates = (gatesLoader ?? (() => loadAutoEvolveGates((p) => readFile(p))))()
  } catch (e) {
    logger(`❓ 自进化派发:闸门配置未判定(${String(e?.message ?? e).slice(0, 160)})⇒ 本轮不派发(§0.3)`)
    return { ran: true, ok: false, why: '闸门配置未判定' }
  }
  if (!gates.enabled) {
    logger('⏸ 自进化派发:auto-evolve-gates.json enabled=false ⇒ 不派发(观察期)')
    return { ran: true, ok: true, why: '未启用' }
  }

  // ① 今日预算:只认器物自己的派发台账(同一判据,不另算)
  let todayDispatched = 0
  try {
    const dayKey = autoEvolveTodayKey(new Date(now))
    for (const line of readFile(ledgerFile).split(/\r?\n/)) {
      if (!line.trim()) continue
      let e
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      if (e?.action === 'dispatched' && String(e.ts ?? '').startsWith(dayKey)) todayDispatched += 1
    }
  } catch {
    /* 台账不存在 = 今日 0 轮(器物首跑同口径) */
  }
  if (todayDispatched >= gates.dailyDispatchBudget) {
    logger(
      `⏸ 自进化派发:今日已派 ${todayDispatched}/${gates.dailyDispatchBudget} 轮达上限 ⇒ 不 spawn` +
        '(否则 runOnce 每小时寄一封「预算耗尽」逃生邮件)',
    )
    return { ran: true, ok: true, why: '预算耗尽' }
  }

  // ② 成本熔断:判据 import 自 cost-breaker 同一份(单源,不在此处另写阈值)
  try {
    const caps = loadCostCaps(readFile(join(WORKTREE, 'scripts', 'data', 'cost-caps.json')))
    const events = exists(costLedgerFile) ? parseCostLedger(readFile(costLedgerFile)) : []
    const cost = evaluateCostBudget({ caps, events, kind: 'session', now })
    if (!cost.allowed) {
      logger(`⏸ 自进化派发:成本熔断(${cost.breaches.join(';')})⇒ 本轮不 spawn`)
      return { ran: true, ok: true, why: '成本熔断' }
    }
  } catch (e) {
    logger(`❓ 自进化派发:成本熔断判不了(${String(e?.message ?? e).slice(0, 160)})⇒ 本轮不派发(§0.3)`)
    return { ran: true, ok: false, why: '成本熔断未判定' }
  }

  // ③ 单实例闸:器物锁在且持有者活着 ⇒ 让路(不让第二个会话抢同一张票)
  try {
    const { pid } = JSON.parse(readFile(lockFile))
    if (isAutoEvolvePidAlive(pid)) {
      logger(`⏭ 自进化派发:上一轮仍在跑(pid=${pid})⇒ 本轮让路`)
      return { ran: true, ok: true, why: '上一轮在跑' }
    }
  } catch {
    /* 无锁/锁坏 = 无有效持有者,继续 */
  }

  // ④ 取票面:plan-tasks 唯一入口 + 器物自己的白名单判据
  let rows = []
  let candidates = []
  try {
    const p = probe
      ? probe()
      : spawnSync(process.execPath, [AE_PLAN_TASKS, ...AE_DISPATCH_ARGS], {
          cwd: WORKTREE,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 120_000,
          maxBuffer: 1 << 24,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
    if (p?.error) throw new Error(p.error?.message ?? String(p.error))
    rows = parseAutoEvolveTicketRows(p?.stdout)
    if (rows.length === 0 && Number(p?.status) !== 0) {
      throw new Error(`派单面未判定(status=${p?.status ?? '?'}):${String(p?.stderr ?? p?.stdout ?? '').slice(-160)}`)
    }
    candidates = rows.filter((r) => matchAutoEvolveWhitelist(r.text, gates.ticketWhitelist))
  } catch (e) {
    logger(`❓ 自进化派发:派单面未判定(${String(e?.message ?? e).slice(0, 160)})⇒ 本轮不派发`)
    return { ran: true, ok: false, why: '派单面未判定' }
  }
  if (candidates.length === 0) {
    logger(`✅ 自进化派发:派单面 ${rows.length} 行、白名单命中 0 ⇒ 无活可派(零落地零推送)`)
    return { ran: true, ok: true, why: '无票可派', rows: rows.length }
  }

  // ⑤ 异步 spawn(§12g:显式 stdio + windowsHide;detached 让子进程活过本轮 tick)
  let child
  let logFd = null
  try {
    child = launcher
      ? launcher({ script, args: [script, '--once', '--no-triage'] })
      : (() => {
          const logFile = join(WORKTREE, '.ihui-agent', 'state', 'auto-evolve-run.log')
          mkdirSync(dirname(logFile), { recursive: true })
          logFd = openSync(logFile, 'a')
          return spawn(process.execPath, [script, '--once', '--no-triage'], {
            cwd: WORKTREE,
            detached: true,
            windowsHide: true,
            stdio: ['ignore', logFd, logFd],
          })
        })()
    if (typeof child?.unref === 'function') child.unref()
  } catch (e) {
    logger(`⚠ 自进化派发:spawn 失败(${String(e?.message ?? e).slice(0, 160)})`)
    return { ran: true, ok: false, why: 'spawn 失败' }
  } finally {
    if (logFd !== null) {
      try {
        closeSync(logFd)
      } catch {
        /* 已关 */
      }
    }
  }
  logger(
    `🚀 自进化派发:白名单命中 ${candidates.length} 枚(派单面 ${rows.length} 行,今日已派 ${todayDispatched}/${gates.dailyDispatchBudget})` +
      ' ⇒ 已异步起一轮(日志 .ihui-agent/state/auto-evolve-run.log)',
  )
  return { ran: true, ok: true, spawned: true, candidates: candidates.length }
}

/**
 * 感知层分诊轮(第 1 期装车):分诊与自进化拆成两个派发点,理由 = 自进化的 spawn 会被
 * 「预算耗尽 / 成本熔断」前置闸按住,而分诊恰恰要在那种时候照常感知(它只写自己的台账 +
 * 受每日登记配额约束,不花会话额度)。
 */
export function dispatchAutoTriage(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = AUTO_TRIAGE_INTERVAL_MS,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'auto-triage-dispatch-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(GUARDIAN_SCRIPTS_DIR, 'auto-triage.mjs')
  if (!existsSync(script)) {
    logger('ℹ 感知层分诊:器物不在位(scripts/auto-triage.mjs)⇒ 本轮跳过')
    return { ran: false, why: '分诊器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run =
    runner ??
    (() => {
      try {
        const out = execFileSync(process.execPath, [script, '--once'], {
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
    })
  const r = run()
  const text = String(r.out ?? '')
  const registered = (text.match(/已登记[:：]/g) ?? []).length
  const undetermined = (text.match(/未判定/g) ?? []).length
  const keep = text
    .split(/\r?\n/)
    .filter((l) => /登记|未判定|配额|可派单|观察|无发现|❌|⏸/.test(l))
    .slice(-2)
    .join(' / ')
  logger(
    `${r.ok ? '✅' : '⚠️'} 感知层分诊轮:登记 ${registered} 枚 / 未判定 ${undetermined} 处` +
      `${keep ? ` ｜ ${keep.slice(0, 220)}` : ''}${r.ok ? '' : ` ｜ ${String(r.err ?? '').slice(0, 120)}`}`,
  )
  return { ran: true, ok: r.ok, registered, undetermined }
}

// ── 自进化闭环装车腿(goal-b21/W2) ──────────────────────────────────────────
// 以下四件器件已在 HEAD 且单测全绿,但此前零生产引用(§0.9「造好没装车=没有」)。
// 本批把它们接进派发轮:默认开启、可经 IHUI_GUARDIAN_DISABLE_<NAME>=1 关闭、
// 失败不阻断主轮、节流各自独立。每函数均接受 exists/runner 注入以便测试钉行为。

export function dispatchDeployOutcomeIntake(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = Number(process.env.IHUI_DEPLOY_OUTCOME_INTERVAL_MS || 20 * 60 * 1000),
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'deploy-outcome-intake-dispatch-last.json'),
    logger = log,
    exists = existsSync,
    runner = null,
  } = opts
  if (process.env.IHUI_GUARDIAN_DISABLE_DEPLOY_OUTCOME === '1') {
    logger('⏸ 部署结果入库派发:IHUI_GUARDIAN_DISABLE_DEPLOY_OUTCOME=1 ⇒ 跳过')
    return { ran: false, why: '被 env 关闭' }
  }
  const script = join(GUARDIAN_SCRIPTS_DIR, 'deploy-outcome-intake.mjs')
  if (!exists(script)) {
    logger('ℹ 部署结果入库派发:器物不在位(scripts/deploy-outcome-intake.mjs)⇒ 本轮跳过')
    return { ran: false, why: '器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run = runner ?? (() => {
    try {
      const out = execFileSync(process.execPath, [script], {
        cwd: WORKTREE, encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 1 << 22, stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, out: String(out ?? '') }
    } catch (e) {
      return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`, err: String(e?.message ?? e) }
    }
  })
  const r = run()
  logger(`${r.ok ? '✅' : '⚠️'} 部署结果入库派发:${r.ok ? '完成' : '异常'}｜${String(r.out ?? '').split(/\r?\n/).filter(Boolean).slice(-1).join('').slice(0, 200)}${r.ok ? '' : ` ｜ ${String(r.err ?? '').slice(0, 120)}`}`)
  return { ran: true, ok: r.ok }
}

export function dispatchDeployFeedback(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = Number(process.env.IHUI_DEPLOY_FEEDBACK_INTERVAL_MS || 20 * 60 * 1000),
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'deploy-feedback-dispatch-last.json'),
    logger = log,
    exists = existsSync,
    runner = null,
  } = opts
  if (process.env.IHUI_GUARDIAN_DISABLE_DEPLOY_FEEDBACK === '1') {
    logger('⏸ 部署反馈派发:IHUI_GUARDIAN_DISABLE_DEPLOY_FEEDBACK=1 ⇒ 跳过')
    return { ran: false, why: '被 env 关闭' }
  }
  const script = join(GUARDIAN_SCRIPTS_DIR, 'deploy-feedback.mjs')
  if (!exists(script)) {
    logger('ℹ 部署反馈派发:器物不在位(scripts/deploy-feedback.mjs)⇒ 本轮跳过')
    return { ran: false, why: '器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run = runner ?? (() => {
    try {
      const out = execFileSync(process.execPath, [script, '--once'], {
        cwd: WORKTREE, encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 1 << 22, stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, out: String(out ?? '') }
    } catch (e) {
      return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`, err: String(e?.message ?? e) }
    }
  })
  const r = run()
  logger(`${r.ok ? '✅' : '⚠️'} 部署反馈派发:${r.ok ? '完成(--once 仅扫描)' : '异常'}｜${String(r.out ?? '').split(/\r?\n/).filter(Boolean).slice(-1).join('').slice(0, 200)}${r.ok ? '' : ` ｜ ${String(r.err ?? '').slice(0, 120)}`}`)
  return { ran: true, ok: r.ok }
}

export function dispatchExportUserFeedback(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = Number(process.env.IHUI_USER_FEEDBACK_EXPORT_INTERVAL_MS || 20 * 60 * 1000),
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'user-feedback-export-dispatch-last.json'),
    logger = log,
    exists = existsSync,
    runner = null,
  } = opts
  if (process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_EXPORT === '1') {
    logger('⏸ 用户反馈导出派发:IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_EXPORT=1 ⇒ 跳过')
    return { ran: false, why: '被 env 关闭' }
  }
  const script = join(GUARDIAN_SCRIPTS_DIR, 'export-user-feedback.mjs')
  if (!exists(script)) {
    logger('ℹ 用户反馈导出派发:器物不在位(scripts/export-user-feedback.mjs)⇒ 本轮跳过')
    return { ran: false, why: '器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run = runner ?? (() => {
    try {
      const out = execFileSync(process.execPath, [script], {
        cwd: WORKTREE, encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 1 << 22, stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, out: String(out ?? '') }
    } catch (e) {
      return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`, err: String(e?.message ?? e) }
    }
  })
  const r = run()
  logger(`${r.ok ? '✅' : '⚠️'} 用户反馈导出派发:${r.ok ? '完成(只读查库→导出件)' : '异常'}｜${String(r.out ?? '').split(/\r?\n/).filter(Boolean).slice(-1).join('').slice(0, 200)}${r.ok ? '' : ` ｜ ${String(r.err ?? '').slice(0, 120)}`}`)
  return { ran: true, ok: r.ok }
}

export function dispatchE2eAutofill(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = Number(process.env.IHUI_E2E_AUTOFILL_INTERVAL_MS || 30 * 60 * 1000),
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'e2e-autofill-dispatch-last.json'),
    logger = log,
    exists = existsSync,
    runner = null,
  } = opts
  if (process.env.IHUI_GUARDIAN_DISABLE_E2E_AUTOFILL === '1') {
    logger('⏸ E2E 自动补测派发:IHUI_GUARDIAN_DISABLE_E2E_AUTOFILL=1 ⇒ 跳过')
    return { ran: false, why: '被 env 关闭' }
  }
  const script = join(GUARDIAN_SCRIPTS_DIR, 'e2e-autofill.mjs')
  if (!exists(script)) {
    logger('ℹ E2E 自动补测派发:器物不在位(scripts/e2e-autofill.mjs)⇒ 本轮跳过')
    return { ran: false, why: '器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run = runner ?? (() => {
    try {
      const out = execFileSync(process.execPath, [script, '--check'], {
        cwd: WORKTREE, encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 1 << 22, stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, out: String(out ?? '') }
    } catch (e) {
      return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`, err: String(e?.message ?? e) }
    }
  })
  const r = run()
  logger(`${r.ok ? '✅' : '⚠️'} E2E 自动补测派发(--check 只读):${r.ok ? '完成' : '异常'}｜${String(r.out ?? '').split(/\r?\n/).filter(Boolean).slice(-1).join('').slice(0, 200)}${r.ok ? '' : ` ｜ ${String(r.err ?? '').slice(0, 120)}`}`)
  return { ran: true, ok: r.ok }
}

/** 依赖安全通告派发(第 3 期③装车):每日一轮,`--register` 走 live-doc-edit 唯一登记入口。 */
export function dispatchDepAdvisoryRadar(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = DEP_RADAR_INTERVAL_MS,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'dep-radar-dispatch-last.json'),
    logger = log,
    runner = null,
  } = opts
  const script = join(GUARDIAN_SCRIPTS_DIR, 'dep-advisory-radar.mjs')
  if (!existsSync(script)) {
    logger('ℹ 依赖安全通告:器物不在位(scripts/dep-advisory-radar.mjs)⇒ 本轮跳过')
    return { ran: false, why: '依赖通告器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run =
    runner ??
    (() => {
      try {
        const out = execFileSync(process.execPath, [script, '--json', '--register', '--max-tickets', '3'], {
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
    })
  const r = run()
  const text = String(r.out ?? '').trim()
  const line = text
    .split(/\r?\n/)
    .reverse()
    .find((l) => l.trim().startsWith('{'))
  let parsed = null
  try {
    parsed = line ? JSON.parse(line) : null
  } catch {
    parsed = null
  }
  if (!parsed) {
    logger(
      `${r.ok ? '⚠️' : '❓'} 依赖安全通告轮:结论不可解析 ⇒ 本轮未判定(不改结论、不冒充已检查)` +
        `${r.err ? ` ｜ ${r.err.slice(0, 120)}` : ''}`,
    )
    return { ran: true, ok: false, why: '结论不可解析' }
  }
  if (parsed.overall === 'undetermined') {
    logger(`❓ 依赖安全通告轮:未判定 —— ${String(parsed.why ?? '(尺子未给原因)').slice(0, 200)}(不改结论,下轮再试)`)
    return { ran: true, ok: false, why: '尺子未取到' }
  }
  const reg = Array.isArray(parsed.registered) ? parsed.registered.length : 0
  logger(
    `✅ 依赖安全通告轮:通告 ${parsed.advisories ?? '?'} 条 / 可修候选 ${parsed.candidates ?? '?'} 枚 / 本轮票 ` +
      `${(parsed.tickets ?? []).length} 枚(受日配额截断 ${parsed.suppressed ?? 0})/ 已登记 ${reg} 枚`,
  )
  return { ran: true, ok: true, tickets: (parsed.tickets ?? []).length, registered: reg }
}

/**
 * 守门判据腐烂轮(第 3 期②装车):读 `check-gate-rot --json --ratchet` 的机读结论,
 * **只把相对基线新增的腐烂**当失败喊人(存量只报数,§12e 同族);未判定不冒绿。
 * 本器不进提交链(判机器状态),邮件身份 = 类别 + 新增计数(§5e-1,明细不进指纹)。
 */
export function dispatchGateRot(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = GATE_ROT_INTERVAL_MS,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'gate-rot-dispatch-last.json'),
    logger = log,
    runner = null,
    notifier = notifyGuardRed,
  } = opts
  const script = join(GUARDIAN_SCRIPTS_DIR, 'check-gate-rot.mjs')
  if (!existsSync(script)) {
    logger('ℹ 判据腐烂自检:器物不在位(scripts/check-gate-rot.mjs)⇒ 本轮跳过')
    return { ran: false, why: '判据腐烂器物缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run =
    runner ??
    (() => {
      try {
        const out = execFileSync(process.execPath, [script, '--json', '--ratchet'], {
          cwd: WORKTREE,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 5 * 60 * 1000,
          maxBuffer: 1 << 22,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return { ok: true, out: String(out ?? '') }
      } catch (e) {
        // exit 1 = 有新增腐烂(JSON 照常输出),不是「跑不起来」;照常解析 stdout
        return { ok: true, out: `${e?.stdout ?? ''}`, err: String(e?.message ?? e) }
      }
    })
  const r = run()
  let parsed = null
  try {
    parsed = JSON.parse(
      String(r.out ?? '')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .pop(),
    )
  } catch {
    parsed = null
  }
  if (!parsed || typeof parsed.overall !== 'string') {
    logger('❓ 判据腐烂自检:结论不可解析 ⇒ 本轮未判定(不记绿、不冒红)')
    return { ran: true, ok: false, why: '结论不可解析' }
  }
  if (parsed.overall === 'undetermined') {
    const why = (parsed.undetermined ?? []).map((u) => u?.why).filter(Boolean).join(' / ')
    logger(`❓ 判据腐烂自检:未判定(${String(why || '(尺子未给原因)').slice(0, 200)})⇒ 本轮没判,不等于清单干净`)
    return { ran: true, ok: false, why: '未判定' }
  }
  const rot = Array.isArray(parsed.rot) ? parsed.rot : []
  const newRot = Array.isArray(parsed.newRot) ? parsed.newRot : []
  const known = rot.length - newRot.length
  if (newRot.length === 0) {
    logger(`✅ 判据腐烂自检:无新增腐烂(存量 ${known} 条只报数,差值为 0)`)
    return { ran: true, ok: true, known }
  }
  const names = newRot.map((x) => x?.resolved ?? x?.ref ?? '?').slice(0, 5)
  logger(
    `⚠️ 判据腐烂自检:新增腐烂 ${newRot.length} 条 ⇒ ${names.join(', ')}` +
      `${newRot.length > names.length ? ` …(共 ${newRot.length})` : ''}(存量 ${known} 条只报数)`,
  )
  try {
    notifier(
      '守门判据腐烂(新增)',
      `相对基线新增 ${newRot.length} 条判据指向不存在的路径:\n${names.join('\n')}\n\n` +
        `修法:node scripts/check-gate-rot.mjs --suggest。存量 ${known} 条不喊(差值档只拦新增)。`,
      { severity: 'warning', dedupKey: `gate-rot:new:${newRot.length}` },
    )
  } catch {
    /* 通知层失败只影响喊人,不改本轮判定 */
  }
  return { ran: true, ok: false, why: '新增腐烂', known, fresh: newRot.length }
}

// 〈原 12 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l6337(门 103 C1 收口)〉首意: 号池容量哨兵轮(2026-10-26 装车,差值档同格 check-gate-rot):读
export function dispatchRelayCapacity(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = RELAY_CAPACITY_INTERVAL_MS,
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'relay-capacity-dispatch-last.json'),
    logger = log,
    runner = null,
    notifier = notifyGuardRed,
  } = opts
  const script = join(GUARDIAN_SCRIPTS_DIR, 'check-relay-capacity-zero.mjs')
  if (!existsSync(script)) {
    logger('ℹ 号池容量哨兵:器物不在位(scripts/check-relay-capacity-zero.mjs)⇒ 本轮跳过')
    return { ran: false, why: '容量哨兵缺席' }
  }
  if (!dispatchDue(tickFile, now, intervalMs)) return { ran: false, why: '未到节流窗口' }
  stampDispatchTick(tickFile, now, logger)
  const run =
    runner ??
    (() => {
      try {
        const out = execFileSync(process.execPath, [script, '--json', '--ratchet'], {
          cwd: WORKTREE,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 5 * 60 * 1000,
          maxBuffer: 1 << 22,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return { ok: true, out: String(out ?? '') }
      } catch (e) {
        // exit 1 = breach(JSON 照常输出);exit 2 = 未判定,同样解析 stdout
        return { ok: true, out: `${e?.stdout ?? ''}`, err: String(e?.message ?? e) }
      }
    })
  const r = run()
  let parsed = null
  try {
    parsed = JSON.parse(
      String(r.out ?? '')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .pop(),
    )
  } catch {
    parsed = null
  }
  if (!parsed || typeof parsed.state !== 'string') {
    logger('❓ 号池容量哨兵:结论不可解析 ⇒ 本轮未判定(不记绿、不冒红)')
    return { ran: true, ok: false, why: '结论不可解析' }
  }
  if (parsed.state === 'unjudged') {
    logger(
      `❓ 号池容量哨兵:未判定(${String(parsed.reason ?? '(尺子未给原因)').slice(0, 160)})⇒ 本轮没判,不等于容量正常`,
    )
    return { ran: true, ok: false, why: '未判定' }
  }
  const breaches = Array.isArray(parsed.breaches) ? parsed.breaches : []
  if (breaches.length === 0) {
    logger(`✅ 号池容量哨兵:未见归零(${String(parsed.reason ?? '').slice(0, 120)})`)
    return { ran: true, ok: true, breaches: 0 }
  }
  const newBreaches = Array.isArray(parsed.newBreaches) ? parsed.newBreaches : breaches // 版本漂移⇒按全量喊(失效方向=多喊一次,§0.10)
  if (newBreaches.length === 0) {
    logger(
      `✅ 号池容量哨兵:无新增归零(存量 ${breaches.length} 处只报数,差值为 0;显式认账:node scripts/check-relay-capacity-zero.mjs --write-baseline)`,
    )
    return { ran: true, ok: true, breaches: breaches.length, known: breaches.length }
  }
  const known = breaches.length - newBreaches.length
  const names = newBreaches
    .slice(0, 5)
    .map((b) => `${b?.kind ?? '?'}:${b?.providerCode ?? '?'}`)
    .join(', ')
  logger(
    `⚠️ 号池容量哨兵:新增归零 ${newBreaches.length} 处 ⇒ ${names}` +
      `${newBreaches.length > 5 ? ` …(共 ${newBreaches.length})` : ''}(存量 ${known > 0 ? known : 0} 处只报数)`,
  )
  try {
    notifier(
      '号池容量归零(新增,静默回落中)',
      `相对上轮新增 ${newBreaches.length} 处 provider 有 enabled 号但可调度为 0:\n${newBreaches
        .map((b) => String(b?.detail ?? `${b?.kind}:${b?.providerCode}`))
        .join('\n')}\n\n` +
        '修法:后台「中转-号池」看该 provider 的号是冷却(temp_unschedulable,等或手工解除)还是被停用(is_enabled=false);' +
        '若确属停用则容量归零是预期态,可跑 node scripts/check-relay-capacity-zero.mjs --write-baseline 显式认账(此后存量不再喊)。',
      { severity: 'warning', dedupKey: `relay-capacity-zero:new:${newBreaches.length}` },
    )
  } catch {
    /* 通知层失败只影响喊人,不改本轮判定 */
  }
  return { ran: true, ok: false, why: '新增容量归零', known, fresh: newBreaches.length }
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
  // 恢复面的"当次实测形态分派"唯一出口(gitdir-pointer 票本席收的格,镜像只 import 这一份)
  gitdirTargetVerdictFromFace,
  // `.git` 指针形态的修复面(2026-10-27 票面第③格补的口):判据、现读形态、两形态分流、
  // 执行单元与"内容是否一致"那把尺子全部导出,镜像只 import 这一份,不复制判据(§22c)。
  GITFILE_MAX_BYTES,
  pointerFormVerdict,
  inspectGitdirPointer,
  gitdirRepairPlan,
  pointerContentOk,
  writeGitdirPointer,
  judgeRefsHealth,
  alertFingerprint,
  stableAlertFingerprint,
  // 跨端漂移巡检的派发腿(镜像测试 cross-end-parity-drift-dispatch 的 T6 装车锁按名 import)。
  // 此前函数已 export 而未登记进本台账 ⇒ 那道锁自本票立日起结构上打不到这一格(恒红,§0.2)。
  auditCrossEndParityDrift,
  auditDispatchSites,
  auditPublicPathProbe,
  auditTunnelLegHealth,
  auditSweeperLiveness,
  auditIndexUnmerged,
  auditLintStagedPins,
  sweepStaleClosedRows,
  sweepBannedBuckets,
  sweepStaleClaimMarks,
  // AI 自进化调度层派发点(2026-10-26 导出):镜像测试据此逐条钉「节流 / 无票不 spawn /
  // 预算耗尽不 spawn / 锁在让路 / 结论不可解析落未判定」—— 不导出的话只能读源码字符串,
  // 钉不住行为,而这一族的失效形态全是安静(多 spawn 一次 = 多派一个会话)。
  dispatchAutoEvolve,
  dispatchAutoTriage,
  dispatchDeployOutcomeIntake,
  dispatchDeployFeedback,
  dispatchExportUserFeedback,
  dispatchE2eAutofill,
  dispatchDepAdvisoryRadar,
  dispatchGateRot,
  dispatchRelayCapacity,
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
  parseMergeLossCount,
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
  // G-24 归档回收接线臂(2026-10-26):实现单源在 lib,这里原路径再导出供镜像测试 import(§22c)。
  archiveGcDryRun,
  archiveGcArmDue,
  loadArchiveGcArmConfig,
  parseArchiveGcSummary,
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
