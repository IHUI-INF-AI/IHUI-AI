// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * git-guardian-archive-gc.mjs — G-24 事故归档回收器的**调度接线臂**(2026-10-26,席位 goal-20261026-b14r3)。
 *
 * 票面残余唯缺一格:回收器本体(scripts/archive-gc.mjs)与镜像测试都在,唯独没有调度器
 * —— 判据在、工具在、无人调度(守门 64/70/81/115/138 同族,本仓最贵的失效型)。
 * 本臂就是那一格:guardian 巡检轮以 **dry-run** 调 archive-gc,把「待删/保留/未判定」读数
 * 写进 guardian 既有日志通道(留痕)。**绝不自动 --apply** —— 真删留机主核过读数后按下。
 *
 * 三条不可漂的写法(与 scrubTempFixtures 同族纪律):
 *  ① 探测式装车:尺子(archive-gc.mjs)不在位 ⇒ 报名跳过,绝不记为"这一格已巡检";
 *  ② 开关面默认关(scripts/data/archive-gc-arm.json):enabled=false ⇒ 合臂只留一行 ⏸;
 *     **读不到开关配置 ⇒ 如实报未判定**(不得把"没读到"写成"已关"或"已过");
 *  ③ 判据单源:世代/双上限/保护名单/未判定的判法只许住在 archive-gc.mjs 那一份实现里,
 *     本臂只经 CLI(--root 必填 + --dry-run)取它已经大声报出来的汇总读数,不重抄判据、
 *     不 import 它的 planGc/classifyEntry 去自己判。
 * 节流:一个窗口(默认 24h)最多产出一行日志(跑成/合臂/未判定同闸),双执行体
 * (main 单轮 + daemon tick)共用同一枚节流戳 ⇒ 只有先到那一个真派生。
 *
 * 2026-10-27 补两格(席位 g24-archive):
 *  ④ **待删量阈值告警**:`待删 > RETIRE_ALERT_THRESHOLD`(默认 20,env 可调)⇒ ⚠️ 且 ok:false。
 *     立因:合臂时"待删 48"在日志里长得和"待删 0"一模一样,积压只能靠人偶尔翻读数才发现。
 *  ⑤ **零可判射程(结构性空转)**:回收器报 `可判(in-scope)0 件` ⇒ ⏸ 且 ok:false,
 *     **只报一次**(标记文件去重,恢复后自动解除)。立因(本机现读):票面射程
 *     `gitArchiveDir()` 顶层 313 项**全是目录**,回收器结构上无可回收对象 —— 该树归
 *     `scripts/retire-git-archive.mjs`;此前它每天被判成 ✅,是"射程错配"被写成"干净"。
 *     只报一次是因为 24h 一条恒响会把通道喊废(§12e),而这个结论在树形态不变前是常量。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveWorktree } from './gitdir.mjs'
import { log } from './git-guardian-log.mjs'
// 射程落点判据单源:票面点名的 gitArchiveDir() 由回收器本体推导并导出(import 零副作用、零删除)。
import { STD_GIT_ARCHIVE } from '../archive-gc.mjs'

const WORKTREE = resolveWorktree()
const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 回收器本体(唯一射程判据的住处);本臂只经 CLI 调它。 */
export const GC_SCRIPT = join(SCRIPTS_DIR, 'archive-gc.mjs')
/** 开关配置面(照 auto-evolve-gates.json 同一形状:enabled 布尔)。 */
export const ARM_CONFIG = join(SCRIPTS_DIR, 'data', 'archive-gc-arm.json')
const ARM_TICK = join(WORKTREE, '.ihui-agent', 'state', 'archive-gc-arm-tick.iso')
/** 「射程内 0 件可判」只报一次的标记(树形态恢复后由本臂自删,自动重新武装)。 */
const ARM_SCOPE_FLAG = join(WORKTREE, '.ihui-agent', 'state', 'archive-gc-arm-scope-mismatch.flag')
const ARM_INTERVAL_MS = Number(process.env.IHUI_ARCHIVE_GC_ARM_INTERVAL_MS || 24 * 60 * 60 * 1000)
/** 待删量阈值:超过就喊人(合臂/开臂都适用 —— 积压不该只在人翻日志时可见)。 */
export const RETIRE_ALERT_THRESHOLD = Number(process.env.IHUI_ARCHIVE_GC_RETIRE_ALERT || 20)
/** 回收器只列一个目录顶层,给 90 秒硬上限(守门 80:热路径派生一律带上限,挂死不拖垮整轮)。 */
const ARM_TIMEOUT_MS = Number(process.env.IHUI_ARCHIVE_GC_ARM_TIMEOUT_MS || 90_000)

/** 节流判定(纯函数):取不到戳 ⇒ 视为**该跑了**(与 tempScrubDue 同一条失效方向)。 */
export function archiveGcArmDue(nowMs, tickMs, intervalMs = ARM_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/**
 * 开关配置读取(纯注入面,镜像测试喂构造件)。
 * 三态:读到布尔 ⇒ {ok:true, enabled};读不到/坏形 ⇒ {ok:false, why}(未判定,不是"已关");
 * 只有明写 enabled=false 才是"合臂"。
 * 可选 `root`(非空字符串):把本臂的射程换成"回收器真能判的那棵树",缺省仍是票面
 * gitArchiveDir()。给了非法形状 ⇒ 未判定(不猜落点:射程猜错等于巡检一片无关的树)。
 */
export function loadArchiveGcArmConfig({
  configPath = ARM_CONFIG,
  readFile = (p) => readFileSync(p, 'utf8'),
  exists = existsSync,
} = {}) {
  if (!exists(configPath)) return { ok: false, why: `开关配置不在位:${configPath}` }
  let parsed
  try {
    parsed = JSON.parse(readFile(configPath))
  } catch (e) {
    return { ok: false, why: `开关配置不可解析:${String(e?.message ?? e).slice(0, 120)}` }
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.enabled !== 'boolean')
    return { ok: false, why: '开关配置形状不对(需 {"enabled": true|false})' }
  if (
    parsed.root !== undefined &&
    parsed.root !== null &&
    (typeof parsed.root !== 'string' || !parsed.root.trim())
  )
    return { ok: false, why: '开关配置 root 形状不对(可选;给了就必须是非空字符串)' }
  return { ok: true, enabled: parsed.enabled, root: parsed.root ? parsed.root.trim() : null }
}

/**
 * 从回收器 dry-run 的人读面取读数:汇总行 `保留 X / 待删 Y / 未判定 Z`(取不到 ⇒ null)
 * + 可判件行 `可判(in-scope)N 件`(旧版回收器没有该行 ⇒ `inScope:null`,不把"没这行"
 * 读成"0 件";生产面两侧同笔改动,不存在该组合)。
 */
export function parseArchiveGcSummary(text) {
  const t = String(text || '')
  const m = /保留 (\d+) \/ 待删 (\d+) \/ 未判定 (\d+)/.exec(t)
  if (!m) return null
  const s = /可判\(in-scope\)\s*(\d+)/.exec(t)
  return {
    kept: Number(m[1]),
    retire: Number(m[2]),
    undetermined: Number(m[3]),
    inScope: s ? Number(s[1]) : null,
  }
}

/**
 * 巡检轮的接线臂本体。默认零参数即生产形态;镜像测试全部走注入
 * (runner 假派生 ⇒ 零真 spawn;configPath/tickFile 指向 scratch ⇒ 零生产副作用)。
 */
export function archiveGcDryRun(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = ARM_INTERVAL_MS,
    tickFile = ARM_TICK,
    flagFile = ARM_SCOPE_FLAG,
    configPath = ARM_CONFIG,
    root = null,
    threshold = RETIRE_ALERT_THRESHOLD,
    logger = log,
    runner = null,
    exists = existsSync,
    readFile = (p) => readFileSync(p, 'utf8'),
  } = opts
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFile(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!archiveGcArmDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  // 下面每一条会写日志的分支都算"本窗口已留痕"⇒ 先落节流戳(戳写不下去只意味着下轮多报一行)。
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
  } catch {
    /* 盘错不得让本臂失明 */
  }
  if (!exists(GC_SCRIPT)) {
    logger('ℹ️ G-24 归档回收:回收器不在位(scripts/archive-gc.mjs)⇒ 本轮跳过,不记为已判')
    return { ran: false, why: '回收器不在位' }
  }
  const cfg = loadArchiveGcArmConfig({ configPath, readFile, exists })
  if (!cfg.ok) {
    logger(`⚠️ G-24 归档回收:未判定(开关配置读不到:${cfg.why})⇒ 本轮不派生,也不记为已判`)
    return { ran: true, ok: false, why: '开关配置未判定' }
  }
  if (!cfg.enabled) {
    logger('⏸ G-24 归档回收:archive-gc-arm.json enabled=false ⇒ 合臂(默认关;开臂由机主核读数后改配置)')
    return { ran: false, why: '合臂(默认关)' }
  }
  // 射程 = 票面点名的 gitArchiveDir();由回收器自己那份推导(STD_GIT_ARCHIVE)交给它,
  // 本臂不另写第二份落点判据。开关面可显式给 root 覆盖(见 loadArchiveGcArmConfig)。
  // 取不到(夹具闸/盘根推不出)⇒ 未判定,不冒判"无可删"。
  const gcRoot = root || cfg.root || STD_GIT_ARCHIVE
  if (!gcRoot) {
    logger('⚠️ G-24 归档回收:未判定(gitArchiveDir() 落点取不到)⇒ 本轮不派生,也不记为已判')
    return { ran: true, ok: false, why: '射程落点未判定' }
  }
  const argv = [GC_SCRIPT, '--root', gcRoot, '--dry-run']
  let call
  if (typeof runner === 'function') {
    call = runner(argv)
  } else {
    try {
      const out = execFileSync(process.execPath, argv, {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
        timeout: ARM_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      call = { status: 0, stdout: String(out || ''), stderr: '' }
    } catch (e) {
      call = {
        status: typeof e.status === 'number' ? e.status : 2,
        stdout: String(e.stdout || ''),
        stderr: String(e.stderr || e?.message || ''),
      }
    }
  }
  const s = parseArchiveGcSummary(`${call.stdout}\n${call.stderr}`)
  if (!s) {
    logger(
      `⚠️ G-24 归档回收未跑成(rc=${call.status}):读数取不到 ⇒ 不记为已判,` +
        `也别当"无可删"(未跑成≠没有待删)· ${String(call.stderr || call.stdout).replace(/\s+/g, ' ').slice(0, 160)}`,
    )
    return { ran: true, ok: false, why: '未跑成', status: call.status }
  }
  const line =
    `G-24 归档回收 dry-run:保留 ${s.kept} / 待删 ${s.retire} / 未判定 ${s.undetermined} · root=${gcRoot}`
  if (s.undetermined > 0 || call.status === 2) {
    logger(`⚠️ ${line} —— 回收器报未判定(不记绿);真删由机主核读数后手动 --apply`)
    return { ran: true, ok: false, ...s, root: gcRoot }
  }
  // 零可判:回收器对该射程结构上无对象可判(现读 gitArchiveDir 顶层 313 项全是目录)。
  // 只报一次(标记文件去重),否则 24h 一条恒响会把通道喊废;树形态恢复后自动解除。
  if (s.inScope === 0) {
    if (!exists(flagFile)) {
      try {
        mkdirSync(dirname(flagFile), { recursive: true })
        writeFileSync(flagFile, new Date(now).toISOString(), 'utf8')
      } catch {
        /* 标记写不下 ⇒ 下轮还会再报一行(噪声,不是漏报) */
      }
      logger(
        `⏸ G-24 归档回收:射程内可判 0 件(该树全是目录/保护件)⇒ 本器结构上无可回收对象,` +
          `该射程归 scripts/retire-git-archive.mjs;本臂不记绿,也不再重复报 · root=${gcRoot}`,
      )
    }
    return { ran: true, ok: false, why: '射程内无可判对象', ...s, root: gcRoot }
  }
  if (exists(flagFile)) {
    try {
      unlinkSync(flagFile)
    } catch {
      /* 删不掉只意味着下次恢复时少一行"重新武装"的说明 */
    }
  }
  if (s.retire > threshold) {
    logger(
      `⚠️ ${line} —— 待删 ${s.retire} 件超阈值 ${threshold}:积压只能靠人核读数处理,` +
        `请按台账走 --apply(入库树须 git rm + 入库,本器会硬拒)`,
    )
    return { ran: true, ok: false, why: '待删量超阈值', threshold, ...s, root: gcRoot }
  }
  logger(`✅ ${line} —— 只判不删;真删由机主核读数后手动 --apply`)
  return { ran: true, ok: true, root: gcRoot, ...s }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
