// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * git-guardian 的 TEMP 清扫两族(2026-10-25 从 scripts/git-guardian.mjs 原样搬出)。
 *
 * 搬出动因:守门 103 的 C1 单文件行数上限(6000,无豁免通道)—— git-guardian.mjs 6074 行
 * 判红(越线提交是机主 2026-10-24 的守护增强,已在 origin)。按"不得为消红改阈值"的
 * 设计前提,唯一正解是拆文件。本族是尾部自含单元:判据、常量、调度同住,无外部消费者
 * 按函数名 import(唯一直接 import 方是镜像测试,经主文件原路径再导出覆盖)。
 *
 * 零改动承诺:判据/阈值/节流窗口/文案/返回值形状一字不动。与搬出有关的只有三处:
 *  ① 兄弟脚本路径上跳一级:两把尺子(scrub-temp-fixtures.mjs / check-temp-landing.mjs)
 *     同住 scripts/,函数搬到 lib/ 后须 join(..., '..', <尺子>) 才指得回原位;漏了这一跳
 *     就是"清扫器不在位"恒真 ⇒ 静默永不清扫(判据在、工具在、没人跑 —— 本仓最贵的失效型)。
 *  ② WORKTREE 本模块自取(resolveWorktree(),与主文件共用同一个共享解析函数、同一返回值):
 *     叶子模块纪律 —— 不反向 import 主文件(那会与主文件的 import 形成环)。
 *  ③ logger 默认值绑定 lib/git-guardian-log.mjs 的 log(随同批搬出):主文件三处挂点与
 *     两套镜像测试均显式传 logger,漏传即 TypeError,不静默。
 *
 * 挂点仍住在主文件(健康轮次早退之前 + !CHECK_ONLY;daemon tick 同格),本文件只放实现。
 * 块内头注里"本文件健康轮次"等是搬出前的原文,调度点以主文件为准(镜像测试的挂点锁
 * 读的也是主文件那一份)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveWorktree } from './gitdir.mjs'
import { log } from './git-guardian-log.mjs'

const WORKTREE = resolveWorktree()

/**
 * TEMP 夹具清扫的调度层(G-1058525,2026-10-04 立)。
 *
 * 为什么要有这一层:`scripts/scrub-temp-fixtures.mjs` 的判据与保护面都是对的
 * (落点按**当前生效的** `tmpdir()` 现取、只认本项目命名、账龄闸、跳过重解析点与凭据/备份保护区、
 * 真删必须显式 `--apply`),镜像测试也在,`package.json` 里还有 `pnpm scrub:temp` ——
 * **但它没有任何调度器**:唯一入口要人记得手跑。实测后果就在本轮量到:
 * 这台机的活 TEMP 已经是 `D:\tmp`(HKCU TEMP 现读值,与 §26 文档写的 `D:\DevEnv\Temp` 不一致),
 * 顶层 6410 条目 / 4668 目录 / 900.7MB,其中本项目命名的条目被清扫器判为"账龄未到 362"——
 * 也就是说**只要没人手跑,它们过 7 天就永久留着**,而守门 92 每次都只报一个 ⚠️。
 * 这正是本仓记过最多次的那一型:判据在、工具在、无人调度 ⇒ 账面绿而事实累积(守门 64/70/81/115/138 同族)。
 *
 * 三条不可漂的写法:
 *  ① 挂点 = **健康轮次早退之前 + `!CHECK_ONLY`**(本文件已两次踩过"挂进 CHECK_ONLY 路径等于永不执行");
 *  ② 清扫器自己的名字白名单/账龄/保护区判据**不在本层重抄一遍** —— 本层只负责"什么时候跑 + 把结论落到日志",
 *     两处各写一份"什么算我们的残留"必漂移(§"两处算同一件事"同一条禁令);
 *  ③ 动作失败不改守护退出码、也不发信:它不是判据红,是一次没做成的清理。但**必须留一行 ⚠️**,
 *     因为"这一层根本没跑"与"跑了没候选"在日志里必须不同形。
 */
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
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'scrub-temp-fixtures.mjs')
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
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-temp-landing.mjs')
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
