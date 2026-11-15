// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * disk-root-watch.mjs — 盘根实时哨兵(2026-11-14 立,2026-11-15 v2:外流每拍点名 + 执法闸行为自证)
 *
 * ## 为什么要有它(立因)
 *
 * 盘根外流根治会话把三把事后锁装齐了:门 213(静态锁代码别产新)/ 门 91(实地扫 C 盘)/
 * 卫生尺(check-disk-root-hygiene,H1 盘根白名单对账 + H3 申报目录内容对账)。但三者都是
 * **事后扫描**:生成器跑完到被发现之间有空窗,靠 guardian 巡检档(24h)或提交链门兜。
 * 2026-11-14 实测 D:/.turbo、C:\empty-d1b 两个盘根残留就是这样冒出来的 —— 尺子在,可 24h
 * 才咬一口。机主要的是「一出现就抓」,缺的是**实时哨兵**;11-15 再进一步:发现机制一律只能
 * 缩短窗口不能归零,归零的那层 = NTFS Deny(scripts/disk-root-acl.mjs v2),本腿 v2 起兼做
 * 它的行为自证位(轮询假阴 + 假牙双盲区一起堵)。
 *
 * ## 本腿做什么 / 不做什么
 *
 * 做(两维):
 *   维一·外流点名(节拍 = guardian 每拍,默认):派生 `check-disk-root-hygiene.mjs --json`,
 *     读 `counts.diskRootStray`(盘根一级白名单外条目数)。>0 ⇒ notifyGuardRed 点名。
 *     点名只报,不动手删(清理归机主/清扫器,§26 铁律:删除归归属席)。
 *   维二·执法闸自证(节拍默认 30min,可 env):派生 `scripts/disk-root-acl.mjs` v2 的
 *     `healDiskRootAcl` —— 内核级 Deny 是唯一"根本不可能"层,但它自己也可能被第三方
 *     修复工具/策略回写洗掉;本维 = SDDL 对账 + **行为级 mkdir 探针**双判(只读 SDDL
 *     不算数,2026-11-15 实测 DC 记法假牙教训),缺牙即自愈补装(补装自带备份)。
 * 不做:不抄判据(外流 = 卫生尺,执法 = disk-root-acl.mjs,§22c 各一单一真相源);
 *   不替人判断名字认不出的条目是谁(那是门 91 的"foreign 清单交人"职责);
 *   不因本腿红而改守护退出码(它是巡检哨兵,不是提交链 blocking 门)。
 *
 * ## 判据单一真相源(§22c)
 *
 * 判据全在 check-disk-root-hygiene.mjs,本文件**只派生它**、读它的 --json 读数,零复算。
 * 这与 auditTempLanding 派生 check-temp-landing.mjs、archiveGcDryRun 派生 archive-gc.mjs
 * 是同一挂点语义:调度器只负责"按时问、把读数说出去",不重写判据。
 *
 * ## 纪律
 *   · windowsHide=true(§5b:漏此参在计划任务/守护下必弹控制台窗)。
 *   · timeout 上限(守门 80:热路径派生一律带上限)。
 *   · 取不到 JSON/探针异常 ⇒ 未判定不占节流戳(一次失败不能瞎一整个窗口,同 auditTempLanding)。
 *   · notifyGuardRed 由调用方传入,本文件不直接碰人通道。
 *   · 默认 intervalMs=0(每拍必查):机主定档"10 分钟不是根治"——根治靠 NTFS Deny(维二),
 *     本腿降为兜底点名,不再需要宽节流。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 维一节拍:默认 10min。根治靠 NTFS Deny(维二·内核层)+ 实时 fs.watch(live-watch),本腿是兜底点名,
 *  10min 一拍足够——不必每拍全派生卫生尺(它带申报内容对账,较重);紧急外流由 live-watch 毫秒级抓。 */
const DISK_ROOT_WATCH_INTERVAL_MS = Number(
  process.env.IHUI_DISK_ROOT_WATCH_INTERVAL_MS || 10 * 60 * 1000,
)
/** 维二节拍:执法闸行为探针真跑 mkdir,30min 一哨足够(闸本身是内核级常驻,这不贵)。 */
const DISK_ROOT_ACL_SELFTEST_INTERVAL_MS = Number(
  process.env.IHUI_DISK_ROOT_ACL_SELFTEST_INTERVAL_MS || 30 * 60 * 1000,
)
/** 派生卫生尺 --json 的超时上限(守门 80)。 */
const DISK_ROOT_WATCH_TIMEOUT_MS = Number(process.env.IHUI_DISK_ROOT_WATCH_TIMEOUT_MS || 90_000)
/** 节流戳落点(仓内 state,与其它哨兵同格,不外流)。 */
const DISK_ROOT_WATCH_TICK = join(
  process.env.IHUI_WORKTREE || '.',
  '.ihui-agent',
  'state',
  'disk-root-watch-tick.ts',
)
/** 维二节流戳(与维一分戳:一快一慢两节拍各自独立)。 */
const DISK_ROOT_ACL_TICK = join(
  process.env.IHUI_WORKTREE || '.',
  '.ihui-agent',
  'state',
  'disk-root-acl-selftest-tick.ts',
)

/**
 * 派生卫生尺一次,返回解析后的 --json 读数。
 * 返回 { status, parsed?, raw } —— parsed 取不到时不强行猜(交给调用方判未判定)。
 */
export function probeDiskRootHygiene({ scriptPath, cwd, timeoutMs = DISK_ROOT_WATCH_TIMEOUT_MS } = {}) {
  const script = scriptPath || join(dirname(fileURLToPath(import.meta.url)), '..', 'check-disk-root-hygiene.mjs')
  if (!existsSync(script)) return { status: 2, raw: '', why: `尺子脚本不在位:${script}` }
  let stdout = ''
  let stderr = ''
  let status = 0
  try {
    stdout = String(
      execFileSync(process.execPath, [script, '--json'], {
        cwd,
        encoding: 'utf8',
        windowsHide: true, // §5b
        timeout: timeoutMs, // 守门 80
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'pipe'],
      }) || '',
    )
  } catch (e) {
    status = typeof e.status === 'number' ? e.status : 2
    stdout = String(e.stdout || '')
    stderr = String(e.stderr || e?.message || '')
  }
  let parsed = null
  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    /* JSON 取不到,parsed=null ⇒ 调用方判未判定 */
  }
  return { status, parsed, raw: stdout, stderr }
}

/**
 * 盘根外流实时哨兵主入口。挂在 git-guardian 健康轮次(!CHECK_ONLY),照 auditTempLanding 形态。
 *
 * @returns {ran, ok?, stray?, verdict?, why?} — ran=false 表示本轮被节流或尺子不在位。
 */
export async function auditDiskRootWatch(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = DISK_ROOT_WATCH_INTERVAL_MS,
    tickFile = DISK_ROOT_WATCH_TICK,
    logger = () => {},
    notifyGuardRed = null, // 调用方注入的人通道;不给则只落 logger(纯 --check 零副作用)
    runner = null, // 测试注入:返回 { status, parsed, raw, stderr } 绕过真实派生
    scriptPath = null,
    cwd = null,
  } = opts

  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(lastTick) && now - lastTick < intervalMs) {
    return { ran: false, why: '未到节流窗口' }
  }

  const script = scriptPath || join(dirname(fileURLToPath(import.meta.url)), '..', 'check-disk-root-hygiene.mjs')
  if (!runner && !existsSync(script)) {
    logger('ℹ️ 盘根外流哨兵:尺子脚本不在位(scripts/check-disk-root-hygiene.mjs)⇒ 本轮跳过')
    return { ran: false, why: '尺子脚本不在位' }
  }

  const call =
    typeof runner === 'function'
      ? runner()
      : probeDiskRootHygiene({ scriptPath: script, cwd, timeoutMs: DISK_ROOT_WATCH_TIMEOUT_MS })

  const parsed = call?.parsed
  if (!parsed || typeof parsed !== 'object' || !parsed.counts) {
    logger(
      `⚠️ 盘根外流哨兵未判定(rc=${call?.status ?? '?'},JSON 取不到):` +
        `${String(call?.stderr || call?.raw || '')
          .replace(/\s+/g, ' ')
          .slice(0, 160)}` +
        ' —— 未判定不等于合规,下轮重试(不改本守护退出码)',
    )
    return { ran: true, ok: false, why: '未判定' }
  }

  // 判定有效才推进节流戳:取不到读数时不能把节流窗口白占掉(否则一次失败就瞎一个窗口)。
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
  } catch {
    /* 戳写失败只意味着下轮多跑一遍,不影响判定 */
  }

  const c = parsed.counts || {}
  const stray = Number(c.diskRootStray ?? 0)
  const contentStray = Number(c.declaredContentStray ?? 0)
  const wtOutside = Number(c.worktreeOutside ?? 0)
  const verdict = String(parsed.verdict ?? 'undetermined')
  const violations = Array.isArray(parsed.violations) ? parsed.violations : []

  if (stray > 0) {
    // 盘根一级外流 —— 这是机主要堵死的那一维,最高优先级点名。
    const entries = violations
      .filter((v) => v.kind === 'stray-root-entry')
      .map((v) => v.path || join(String(v.root ?? ''), String(v.entry ?? '')))
    const who = entries.slice(0, 8).join(' · ')
    const more = entries.length > 8 ? ` …(+${entries.length - 8})` : ''
    const line =
      `🚨 盘根外流实时哨兵:检测到 ${stray} 个盘根一级条目不在 config/disk-root-allowlist.json 申报白名单 —— ` +
      `${who}${more}` +
      ' · 先验明身份再决定(门 91 铁律:名字不认识的只登记、不定性、不顺手删)。' +
      '本格只判不动手;申报走 config 显式审批,清理归归属席。'
    if (typeof notifyGuardRed === 'function') notifyGuardRed('盘根外流实时哨兵', line)
    else logger(line)
  } else if (contentStray > 0) {
    // 申报目录内容外流(H3)—— 次优先级,已由卫生尺巡检,哨兵这里也顺口报(同一次派生白拿)。
    logger(`🚨 盘根外流实时哨兵:申报目录内项目外流 ${contentStray} 件(超龄点名,见卫生尺清单)`)
  } else if (verdict === 'undetermined') {
    logger(`ℹ️ 盘根外流哨兵:卫生尺 verdict=undetermined ⇒ 不记通过,下轮重试(某维量不到)`)
  }
  // 全绿(stray=0 ∧ contentStray=0 ∧ verdict=green)⇒ 静默通过,不刷屏(与其它哨兵同哲学)。

  // ── 维二:执法闸行为自证(判据/补装全在 disk-root-acl.mjs,§22c;本腿只调度与点名)──
  let acl = null
  try {
    // 惰性 import:尺子不在位/非 win 平台上维一照常跑,维二落 undetermined 点名
    const mod = await importAclLib(logger)
    if (typeof opts.aclRunner === 'function') {
      acl = opts.aclRunner()
    } else if (mod) {
      const nowMs = Date.now()
      const aclOk = shouldRunAclSelftest(nowMs, opts.aclTickFile, aclIntervalMsOf(opts))
      if (aclOk) {
        acl = mod.healDiskRootAcl({ notifyGuardRed, allowApply: opts.aclAllowApply !== false, logger })
        markAclSelftest(opts.aclTickFile, nowMs)
      } else {
        acl = { ran: false, why: '执法闸自证未到 30min 窗口' }
      }
    }
  } catch (e) {
    acl = { ran: true, healed: false, verdict: 'undetermined', why: String(e?.message || e).slice(0, 160) }
    logger(`⚠️ 盘根执法闸自证未判定:${acl.why} —— 不记绿,下窗重试`)
  }

  return {
    ran: true,
    ok: stray === 0 && contentStray === 0 && verdict === 'green' && (!acl || acl.verdict !== 'red' || acl.healed === true),
    stray,
    contentStray,
    wtOutside,
    verdict,
    acl,
  }
}

/** 惰性拿执法尺(测试可整体注入 aclRunner 绕过)。 */
async function importAclLib(logger) {
  try {
    return await import('../disk-root-acl.mjs')
  } catch (e) {
    logger(`ℹ️ 盘根执法闸尺子不可用(${String(e?.message || e).slice(0, 120)})⇒ 维二本轮跳过`)
    return null
  }
}

function aclIntervalMsOf(opts) {
  return Number(opts.aclSelftestIntervalMs ?? DISK_ROOT_ACL_SELFTEST_INTERVAL_MS)
}

function shouldRunAclSelftest(nowMs, tickFile, intervalMs) {
  if (!(intervalMs > 0)) return true
  const f = tickFile || DISK_ROOT_ACL_TICK
  try {
    const last = Date.parse(String(readFileSync(f, 'utf8')).trim())
    return !(Number.isFinite(last) && nowMs - last < intervalMs)
  } catch {
    return true
  }
}

function markAclSelftest(tickFile, nowMs) {
  try {
    const f = tickFile || DISK_ROOT_ACL_TICK
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, new Date(nowMs).toISOString(), 'utf8')
  } catch {
    /* 戳写失败只意味着下轮多跑一遍 */
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
