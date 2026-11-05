// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多端一键切号·交互层(2026-11-05 立,机主需求)。
 *
 * 机主原话:「WorkBuddy 一键切号那个快捷方式根本就不好使,所有我 admin 账号里的号池都没显示」。
 * 实测结论:那条快捷方式没坏 —— 号池里 WorkBuddy 只有 2 枚(令牌签发方逐枚验过:
 * copilot.tencent.com / www.workbuddy.cn),其余 34 枚是豆包/Qoder/Trae/MiniMax/CodeArts/
 * ZCode/OpenCode 各家客户端的号,WorkBuddy 切号器按设计不接管。机主真正要的是
 * 「号池里这些客户端的号都能一键切」,于是本层 = 选客户端 → 列该平台号池 → 切过去。
 *
 * 分层纪律(§0.6 单一真相源):
 *  - 名单与枚数一律取 apps/api/scripts/relay-pool-account-list.ts(唯一只读列池出口);
 *  - 写回一律派 scripts/switch-client-account.mjs(唯一切号编排口);
 *  - 本文件不查库、不碰凭据、不发明任何可用性判据 —— 只有"序号 → 该行 uid"的映射。
 *  - 非交互环境(stdin 不是 TTY)⇒ exit 2 并说明,绝不静默往下走(§0.3)。
 *  - 切号是有副作用的动作(会改本机客户端登录态),每次派发前逐字回显将要执行的命令并要求确认。
 *  - 序号打错可重问 3 次;连续打错 ⇒ rc=1(业务失败),与"非 TTY / 取不到数"的 rc=2(未判定)分档
 *    —— 2026-11-05 真 ConPTY 实测:把这两种混成同一个 rc=2,运维分不清是人打错还是环境没判出来。
 *  - 名单一律带 --mask:双击出来的是会被截图的窗口,手机号全不许在那种格子里裸着(uid 留全值作映射)。
 *  - 两屏之间分两次取数,所以每屏都标注取数时刻 —— 池正被别的会话改时,首屏枚数会过期。
 *
 * 桌面双击入口 = scripts/client-oneclick-switch.cmd(→ 本文件)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const POOL_LIST_TS = path.join(API_DIR, 'scripts', 'relay-pool-account-list.ts')
const SWITCH_MJS = path.join(ROOT, 'scripts', 'switch-client-account.mjs')

function resolveTsx() {
  for (const c of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(c)) return c
  }
  return null
}

/** 跑一次只读列池并解出 JSON(取不到/解不开 ⇒ null,由调用方落未判定) */
export function runPoolListJson(tsx, args) {
  const r = spawnSync(process.execPath, [tsx, POOL_LIST_TS, ...args], {
    cwd: API_DIR,
    encoding: 'utf8',
    windowsHide: true,
    // 显式接管三个通道:输出要解,且不得继承父进程 stdin
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  })
  if (r.error) return { error: `派发失败(未判定): ${r.error.message}` }
  if (r.status !== 0) {
    return {
      error: `列池 exit=${r.status}: ${String(r.stderr || '')
        .trim()
        .slice(0, 200)}`,
    }
  }
  // stdout 可能被建连日志污染:只取能 parse 的那一行
  const lines = String(r.stdout || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('{'))
  for (const l of lines) {
    try {
      return { data: JSON.parse(l) }
    } catch {
      /* 继续找下一行 */
    }
  }
  return { error: '列池输出解不开 JSON(未判定)' }
}

/** 序号(1 起)→ 数组下标;非整数/越界 ⇒ null */
export function pickByOrdinal(raw, length) {
  const n = Number(String(raw).trim())
  if (!Number.isInteger(n) || n < 1 || n > length) return null
  return n - 1
}

/** 打错允许重问的次数(席 3 实测:越界即退把"打错"和"环境未判定"混成同一个 rc=2) */
export const RETRY_LIMIT = 3

/**
 * 问一个序号:空答复 ⇒ {cancel} 正常收手;连续 RETRY_LIMIT 次打错 ⇒ {fail}(rc=1,
 * 与"非 TTY/取不到数"的 rc=2 未判定分开 —— 机主打错一次就被踢出窗口,是本入口最难用的一型)。
 */
export async function askOrdinal(rl, promptText, length, report = (t) => process.stderr.write(t)) {
  // 射程必须是正整数:漏传 length 时 n>undefined 恒 false,会把任意序号都判成合法
  if (!Number.isInteger(length) || length < 1) {
    throw new Error(`askOrdinal 需要正整数射程,收到 ${String(length)}`)
  }
  for (let used = 0; used < RETRY_LIMIT; used++) {
    const ans = (await rl.question(promptText)).trim()
    if (!ans) return { cancel: true }
    const idx = pickByOrdinal(ans, length)
    if (idx !== null) return { idx }
    report(`❌ 无效序号(只认 1-${length}),再试一次;回车取消\n`)
  }
  return { fail: true }
}

export function fmtCountRow(r, i) {
  return `  [${i + 1}] ${r.providerCode}  池内 ${r.total} 行(启用 ${r.enabled})`
}

export function fmtAccountRow(r, i) {
  const exp = r.tokenExpiresAt ? String(r.tokenExpiresAt).slice(0, 10) : '无到期'
  const pool = r.ownerUserId ? '个人池' : '运营池'
  return (
    `  [${i + 1}] ${r.name}  健康=${r.healthStatus} 启用=${r.isEnabled ? '是' : '否'}` +
    ` 摘除=${r.tempUnschedulable ? '是' : '否'} token到期=${exp} 归属=${pool}`
  )
}

async function main() {
  if (!process.stdin.isTTY) {
    process.stderr.write('❌ 本入口需要交互输入(非 TTY ⇒ 未判定,不静默往下切号)\n')
    return 2
  }
  const tsx = resolveTsx()
  if (!tsx) {
    process.stderr.write('❌ 未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install\n')
    return 2
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    // 冷启要等 tsx 与库连接(实测空白 1.7~2.9s)—— 不先给一句话,双击的人只会看到"没反应"
    process.stdout.write('正在读取号池…(首次冷启要等一会儿)\n')
    const counts = runPoolListJson(tsx, ['--counts', '--json'])
    if (counts.error) {
      process.stderr.write(`❌ ${counts.error}\n`)
      return 2
    }
    const rows = counts.data.counts
    if (!Array.isArray(rows) || rows.length === 0) {
      process.stdout.write('号池 0 行 —— 先用 relay-account-pool 导入再来切\n')
      return 0
    }
    process.stdout.write(`号池里各客户端的号(按平台;取数时刻=${counts.data.asOf ?? '?'}):\n`)
    for (const [i, r] of rows.entries()) process.stdout.write(`${fmtCountRow(r, i)}\n`)
    const p = await askOrdinal(rl, '输入序号选客户端(回车取消): ', rows.length)
    if (p.cancel) return 0
    if (p.fail) {
      process.stderr.write('❌ 连续 3 次无效序号,已退出(未改动任何登录态)\n')
      return 1
    }
    const platform = rows[p.idx].providerCode

    const listed = runPoolListJson(tsx, ['--provider', platform, '--json', '--mask'])
    if (listed.error) {
      process.stderr.write(`❌ ${listed.error}\n`)
      return 2
    }
    const accounts = listed.data.accounts
    if (!Array.isArray(accounts) || accounts.length === 0) {
      process.stdout.write(`${platform} 池内 0 枚\n`)
      return 0
    }
    process.stdout.write(
      `\n${platform} 号池 ${accounts.length} 枚(按 token 到期新→旧;取数时刻=${listed.data.asOf ?? '?'}):\n`,
    )
    for (const [i, a] of accounts.entries()) process.stdout.write(`${fmtAccountRow(a, i)}\n`)
    const a = await askOrdinal(rl, '输入序号切到该号(回车取消): ', accounts.length)
    if (a.cancel) return 0
    if (a.fail) {
      process.stderr.write('❌ 连续 3 次无效序号,已退出(未改动任何登录态)\n')
      return 1
    }
    const target = accounts[a.idx]
    // Trae 系写回前客户端必须已退出(其余平台由写回腿自己判在跑与否);话术不替它代裁
    const note =
      platform === 'trae'
        ? '⚠ Trae 客户端需先退出,否则写回会被它退出时的内存态覆盖;切完请重启客户端。'
        : '⚠ 写回只改本机客户端登录态;切完请重启客户端生效。'
    const cmdLine = `node scripts/switch-client-account.mjs --to ${target.uid} --provider ${platform}`
    process.stdout.write(`\n将执行:\n  ${cmdLine}\n${note}\n`)
    const yes = (await rl.question('确认执行请输入 y(其它任意键取消): ')).trim().toLowerCase()
    if (yes !== 'y') {
      process.stdout.write('已取消,未改动任何登录态。\n')
      return 0
    }
    return await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [SWITCH_MJS, '--to', target.uid, '--provider', platform],
        {
          cwd: ROOT,
          windowsHide: true,
          // 凭据只在子进程内存里流动,本层 stdio 全 inherit 直出
          stdio: 'inherit',
        },
      )
      child.on('error', (e) => {
        process.stderr.write(`❌ 派发失败(未判定): ${e.message}\n`)
        resolve(2)
      })
      child.on('exit', (code, signal) => resolve(signal ? 2 : (code ?? 2)))
    })
  } finally {
    rl.close()
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = {
  runPoolListJson,
  pickByOrdinal,
  askOrdinal,
  RETRY_LIMIT,
  fmtCountRow,
  fmtAccountRow,
  POOL_LIST_TS,
  SWITCH_MJS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
