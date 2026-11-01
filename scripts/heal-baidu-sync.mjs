#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P5 自愈器(尽力而为,非保证):百度网盘同步客户端(云同步腿的出机依赖)没在跑时,把它拉起来。
 *
 * 边界(2026-11-01 实测,接「都要全自动自修复」):
 *  - check-ops-patrol 的 P5 行只检测 `baiduSyncRunning()`(进程族 BaiduNetbox / BaiduNetdiskUnite /
 *    baidunetdiskhost),原设计**故意不启动**它(注:"那是机主专属裁决,本判据不启动它")。
 *  - 实测:守护(服务身份、会话 0)能**拉起**客户端(BaiduNetdisk.exe / BaiduNetdiskUtility 服务都
 *    能 start 成功),但**拉起后进程随即退出**——百度同步盘是用户会话程序,无交互会话/未登录即退。
 *    ⇒ 守护无法把它"长期养活"。若在此做"拉起→等 6s 复检→报成功",会制造"清红→再报警"的横跳(bug)。
 *
 * 因此本器的契约是**尽力拉起 + 不伪造成功**:
 *  - 拉起客户端(或启动 BaiduNetdiskUtility 服务),立即返回"已尝试拉起",**不阻塞等复检**;
 *  - 客户端是否真留得住,由**下一轮 check-ops-patrol 的 P5 判定**独立决定 —— 真在跑 ⇒ P5 转绿,
 *    退出 ⇒ P5 依旧红(且本器按 30 分钟节流重试)。绝不自己报"已修复"。
 *  - 节流:同 tickFile 默认 30 分钟至多试一次,避免重启风暴。
 *  - 复用 `baiduSyncRunning` 作唯一检测真源(不另写进程判定,避免漂移)。
 *
 * 真正的持久解法在机主侧:让百度网盘随会话自启(或登录态常驻);届时本器的拉起会自然留得住,P5 闭环。
 * 若需脱离用户会话的硬性出机,应改走 rclone/Baidu PCSS 这类无头上传通道(另立项,不在本器射程)。
 */

import { baiduSyncRunning } from './check-ops-patrol.mjs'
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKTREE = join(__dirname, '..')

export const DEFAULT_BAIDU_EXES = [
  'D:\\电脑软件\\BaiduNetdisk\\BaiduNetdisk.exe',
  'D:\\电脑软件\\BaiduNetdisk\\module\\BrowserEngine\\baidunetdiskhost.exe',
]

function candidateExes(env = process.env) {
  const override = String(env?.IHUI_BAIDU_SYNC_EXES ?? '').trim()
  if (override) return override.split(';').map((s) => s.trim()).filter(Boolean)
  return DEFAULT_BAIDU_EXES.slice()
}

/**
 * 尝试拉起一个 exe;成功 spawn 返回 true。不抛。
 */
function tryLaunch(exe) {
  if (!existsSync(exe)) return { launched: false, why: `exe 不在:${exe}` }
  try {
    const child = spawn(exe, [], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
      env: process.env,
    })
    child.unref?.() // 立刻解绑,避免守护挂在该子进程句柄上(§5b:否则命令看起来"卡住不返回")。
    return { launched: true, pid: child.pid ?? null, exe }
  } catch (e) {
    return { launched: false, why: `${exe} 派生失败:${e?.message ?? e}` }
  }
}

/**
 * 自愈主入口(同步,守护可直接调用,不阻塞巡逻轮)。
 * @returns {{ok:boolean, alreadyRunning?:boolean, started?:string, attempted?:boolean, verified?:null, why?:string, ran:boolean, throttled?:boolean}}
 */
export function healBaiduSync(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = Number(process.env.IHUI_BAIDU_SYNC_HEAL_INTERVAL_MS || 30 * 60 * 1000),
    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'baidu-sync-heal-tick.json'),
    logger = () => {},
    getExes = candidateExes,
    execNet = (cmd, args) => {
      try {
        execFileSync(cmd, args, { windowsHide: true, timeout: 20000, stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    },
  } = opts

  const before = baiduSyncRunning()
  if (before.running === true) {
    return { ok: true, alreadyRunning: true, ran: true }
  }
  if (before.running === null) {
    // 量不到(tasklist 瞎了):不猜"没跑",也不强行拉起——留给原 P5 未判定档。
    return { ok: false, ran: true, why: `检测不到进程态:${before.why ?? 'tasklist 量不到'}` }
  }

  // 节流:未到窗口不重试(避免反复拉起同一客户端)。
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (Number.isFinite(lastTick) && now - lastTick < intervalMs) {
    return { ok: false, ran: false, why: '未到节流窗口', throttled: true }
  }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
  } catch {
    /* 刻度写不掉不影响动作 */
  }

  // 先尝试把 BaiduNetdiskUtility 服务拉起来(更干净的服务态拉起);失败再退到 exe。
  const svcUp = execNet('net.exe', ['start', 'BaiduNetdiskUtility'])
  if (svcUp) {
    logger('ℹ️ 云同步自愈:已尝试启动 BaiduNetdiskUtility 服务(结果由下一轮 P5 判定确认)')
    return { ok: true, started: 'BaiduNetdiskUtility', attempted: true, verified: null, ran: true }
  }

  const exes = getExes()
  let lastWhy = '无候选 exe 且服务拉起失败'
  for (const exe of exes) {
    const r = tryLaunch(exe)
    if (!r.launched) {
      lastWhy = r.why
      continue
    }
    logger(`ℹ️ 云同步自愈:已派生 ${exe} (pid=${r.pid ?? '?'}),是否留得住由下一轮 P5 判定确认`)
    return { ok: true, started: exe, attempted: true, verified: null, ran: true }
  }
  return { ok: false, ran: true, why: lastWhy }
}

// CLI 自测入口:`node scripts/heal-baidu-sync.mjs [--json]`。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const json = process.argv.includes('--json')
  const r = healBaiduSync({ logger: json ? () => {} : console.error })
  if (json) console.log(JSON.stringify(r, null, 1))
  else console.log(r.ok ? `✅ ${r.alreadyRunning ? '已在跑' : '已尝试拉起'} : ${r.started ?? ''}` : `⚠️ 未修好:${r.why}`)
  process.exit(r.ok ? 0 : 1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
