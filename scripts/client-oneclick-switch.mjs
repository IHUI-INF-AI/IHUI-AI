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
 *  - 首屏平台顺序在本层排(机主 2026-11-13 钦定前五 + 其余字母序),号池只读出口的
 *    orderBy(providerCode) 一字不动 —— 那是 admin/CLI/同步腿共用的机读面稳定序,
 *    不跟着某个窗口的展示偏好走(§0.6)。
 *  - 非交互环境(stdin 不是 TTY)⇒ exit 2 并说明,绝不静默往下走(§0.3)。
 *  - 切号是有副作用的动作(会改本机客户端登录态),每次派发前逐字回显将要执行的命令并要求确认。
 *  - 序号打错可重问 3 次;连续打错 ⇒ rc=1(业务失败),与"非 TTY / 取不到数"的 rc=2(未判定)分档
 *    —— 2026-11-05 真 ConPTY 实测:把这两种混成同一个 rc=2,运维分不清是人打错还是环境没判出来。
 *  - 名单一律带 --mask:双击出来的是会被截图的窗口,手机号全不许在那种格子里裸着(uid 留全值作映射)。
 *  - 两屏之间分两次取数,所以每屏都标注取数时刻 —— 池正被别的会话改时,首屏枚数会过期。
 *
 * 入口三层,逻辑只有本文件一份:
 *  - 仓内直接调用(推荐):pnpm switch:oneclick,或 node scripts/client-oneclick-switch.mjs
 *    (须在真终端里跑 —— 本入口要求 stdin 是 TTY,非交互环境会 exit 2 未判定);
 *  - 桌面双击壳:scripts/client-oneclick-switch.cmd → 桌面「AI 客户端一键切号.lnk」。
 *    .lnk 只是 850 字节的指针,删了/换机都不影响功能,重建跑 install-relay-shortcut.ps1;
 *  - 桌面端托盘项 relay_switch(操作员机显式开启)拉起的也是同一个 .cmd。
 * 非交互的程序化切号别走本入口,直接派 scripts/switch-client-account.mjs --to <uid> --provider <code>。
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
/**
 * 每个平台「切号后旧对话还能不能接着用」的结论矩阵(2026-11-10 全平台实测/取证后固化)。
 *
 * 三型:
 *   rebind —— 会话按 uid 绑在本地(现有两平台:Trae、WorkBuddy):本器真重绑。
 *              Trae 含 SQLCipher 正库解密→改 user_id→重加密→逐页自证;
 *              WorkBuddy 见 scripts/lib/workbuddy-chat-carry.mjs(2026-11-12 补)。
 *   local  —— 会话表/记录里**没有账号维度**,切号后历史天然仍在(7 平台实测:
 *              qoder chat_sessions 239 行无账号列、minimax local_runtime_sessions 25 行、
 *              codearts/zcode/opencode session 表同型、loomy IndexedDB 无账号键、codex 按日期分目录)。
 *              另有切前/切后连续性对账兜底(会话条数变了就判 continuity-broken)。
 *   cloud  —— 会话在云端且绑账号、本地 0 字节(仅豆包),本地无迁移路径。
 *
 * 2026-11-12 改判:workbuddy 原登记为 local(注在 58 行的旧文案是错的)。本机现读推翻:
 * workbuddy.db 的 sessions 表**有 user_id 列**,客户端取列表/取详情/做软删全带
 * `AND (user_id = ? OR user_id = '')` ⇒ 切号只换登录态时旧号会话在新号下查询不命中。
 * 机主实报「切号没法携带对话记录」正是这一档,已按 rebind 补实现。
 */
const CHAT_CARRY = Object.freeze({
  trae: { kind: 'rebind', text: '旧号对话会随新号重绑(含加密正库),切完直接接着聊' },
  qoder: { kind: 'local', text: '对话在本地 main.sqlite、不带账号维度,切号后历史仍在' },
  minimax: { kind: 'local', text: '对话在本地 runtime-state.sqlite、不带账号维度,切号后历史仍在' },
  codearts: { kind: 'local', text: '对话在本地 codearts-data/opencode.db、不带账号维度,切号后历史仍在' },
  zcode: { kind: 'local', text: '任务/会话在本地 ~/.zcode、不带账号维度,切号后历史仍在' },
  loomy: { kind: 'local', text: '对话在本地 IndexedDB、不带账号维度,切号后历史仍在' },
  opencode: { kind: 'local', text: '会话在本地 opencode.db、不带账号维度,切号后历史仍在' },
  workbuddy: {
    kind: 'rebind',
    text:
      '旧号对话会随新号重绑(会话表 sessions.user_id + spaces + automations + 侧边栏快照分片),' +
      '切完打开客户端即可看到旧对话;正文按会话 id 存 projects/*.jsonl,不随账号变',
  },
  codex: { kind: 'local', text: '会话按日期存 ~/.codex/sessions、不带账号维度,切号后历史仍在' },
  doubao: {
    kind: 'cloud',
    text:
      '对话在云端且与账号绑定、本地零副本,豆包没有逐条消息写回的端点 ⇒ 走回放迁移:' +
      '旧号登录态跑 node scripts/doubao-carry.mjs --export --apply 全量归档;' +
      '再切到新号(本机登录新号)跑 node scripts/doubao-carry.mjs --replay <归档目录> --apply,' +
      '旧对话以新会话进新号,打开客户端即可接着聊(指纹防重,复跑自动跳过;--limit n 可先试水)',
  },
})

/** 该平台的对话策略(未知平台如实标未取证,不冒充) */
function chatCarryOf(platform) {
  return CHAT_CARRY[platform] ?? { kind: 'unknown', text: '该平台的对话归属未取证,不做承诺' }
}

/** 每次双击的完整输出留痕(2026-11-10 立):窗口一关就没证据,查不到「跑完了却没切」断在哪 */
const LOG_FILE = path.join(ROOT, 'logs', 'client-oneclick-switch.log')

/** 同一份文本同时上窗口与日志;日志写不动绝不反过来影响切号主链 */
function emit(stream, text) {
  stream.write(text)
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${text}`, 'utf8')
  } catch {
    /* 日志不可写属旁路,不阻断主链 */
  }
}
const out = (text) => emit(process.stdout, text)
const err = (text) => emit(process.stderr, text)

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
export async function askOrdinal(rl, promptText, length, report = (t) => err(t)) {
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

/**
 * 首屏平台顺序(机主 2026-11-13 钦定):Trae 1 / WorkBuddy 2 / 商汤小浣熊(raccoon) 3 /
 * Loomy 4 / Qoder 5;其余按 providerCode 字母序稳定沉底。
 *
 * 只排"给人看的序号",不改号池只读出口:relay-pool-account-list.ts --counts 的
 * orderBy(providerCode) 是 admin / CLI / 同步腿共用的机读面,动它会把展示偏好渗进
 * 数据契约(§0.6 单一真相源)。本层排序不裁行、不合并、不改 providerCode ——
 * 未登记的平台(含今后新接入的)一律按字母序落到尾部组,绝不因为没背过就藏掉一行。
 *
 * 其余为什么选字母序而非"池内枚数降序":枚数随导入/保活天天变,按枚数排会让同一个
 * 平台在不同天拿到不同序号,双击的人记不住;字母序稳定、可预测,且不引入第二份顺序表。
 */
export const PINNED_PLATFORM_ORDER = Object.freeze([
  'trae',
  'workbuddy',
  'raccoon', // 商汤小浣熊
  'loomy',
  'qoder',
])

/** 稳定排序:钦定前五按登记序,其余按字母序;返回新数组,不动入参 */
export function orderPlatformRows(rows) {
  const rank = (code) => {
    const i = PINNED_PLATFORM_ORDER.indexOf(code)
    return i === -1 ? PINNED_PLATFORM_ORDER.length : i
  }
  return [...rows].sort((a, b) => {
    const diff = rank(a.providerCode) - rank(b.providerCode)
    if (diff !== 0) return diff
    return String(a.providerCode).localeCompare(String(b.providerCode))
  })
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

/** 余额视图 → 单行人话(零凭据)。与 relay-pool-account-list.ts 的 formatQuotaLine 同四态口径。 */
export function fmtQuotaLine(q) {
  if (!q) return '      额度=未拉取(余额查询未返回)'
  if (!q.ok) {
    if (q.unsupported) return '      额度=未支持(该平台无已实证余额端点)'
    if (q.authFailed) {
      // 确凿过期 ⇒ "令牌过期,需重登";否则只说"被上游拒收,可能已失效",
      // 不对已确认废的号暗示"重登就能救"。
      if (q.tokenExpired) return '      额度=未判定(令牌已过期,需重登/刷新)'
      return '      额度=未判定(凭据被上游拒收,可能已失效)'
    }
    return `      额度=未判定(${(q.error ?? '上游未给判定依据').slice(0, 60)})`
  }
  const parts = []
  if (q.remaining !== undefined) parts.push(`剩余=${q.remaining}`)
  if (q.used !== undefined) parts.push(`已用=${q.used}`)
  if (q.total !== undefined) parts.push(`总量=${q.total}`)
  if (q.ratio !== undefined) parts.push(`比例=${(q.ratio * 100).toFixed(1)}%`)
  if (q.subscriptionName) parts.push(`档=${q.subscriptionName}`)
  if (q.unit) parts.push(`单位=${q.unit}`)
  if (q.resetsAt) parts.push(`重置=${String(q.resetsAt).slice(0, 10)}`)
  return `      额度✓ ${parts.join(' ')}`
}

async function main() {
  out(`\n===== 一键切号 ${new Date().toISOString()} =====\n`)
  if (!process.stdin.isTTY) {
    err('❌ 本入口需要交互输入(非 TTY ⇒ 未判定,不静默往下切号)\n')
    return 2
  }
  const tsx = resolveTsx()
  if (!tsx) {
    err('❌ 未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install\n')
    return 2
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    // 冷启要等 tsx 与库连接(实测空白 1.7~2.9s;整条切号往返实测 9.1s)—— 不先给一句话,
    // 双击的人只会看到"没反应",2026-11-05 机主报"根本就不好使"有一半就出在这格。
    out('正在读取号池…(首次冷启约需几秒,整条切号往返实测约 9 秒)\n')
    const counts = runPoolListJson(tsx, ['--counts', '--json'])
    if (counts.error) {
      err(`❌ ${counts.error}\n`)
      return 2
    }
    const counted = counts.data.counts
    if (!Array.isArray(counted) || counted.length === 0) {
      out('号池 0 行 —— 先用 relay-account-pool 导入再来切\n')
      return 0
    }
    // 只排首屏给人看的序号;后面的 --provider 取值仍用排完那一行的 providerCode,不按下标猜平台
    const rows = orderPlatformRows(counted)
    out(
      `号池里各客户端的号(按平台;前 5 位为固定顺序,其余按字母序;` +
        `取数时刻=${counts.data.asOf ?? '?'}):\n`,
    )
    for (const [i, r] of rows.entries()) out(`${fmtCountRow(r, i)}\n`)
    const p = await askOrdinal(rl, '输入序号选客户端(回车取消): ', rows.length)
    if (p.cancel) return 0
    if (p.fail) {
      err('❌ 连续 3 次无效序号,已退出(未改动任何登录态)\n')
      return 1
    }
    const platform = rows[p.idx].providerCode

    const listed = runPoolListJson(tsx, ['--provider', platform, '--json', '--mask', '--with-quota'])
    if (listed.error) {
      err(`❌ ${listed.error}\n`)
      return 2
    }
    const accounts = listed.data.accounts
    if (!Array.isArray(accounts) || accounts.length === 0) {
      out(`${platform} 池内 0 枚\n`)
      return 0
    }
    const quotaMap = listed.data.quota
    out(
      `\n${platform} 号池 ${accounts.length} 枚(按 token 到期新→旧;取数时刻=${listed.data.asOf ?? '?'}` +
        `${quotaMap ? ';额度为实时余额' : ';额度未拉取'}):\n`,
    )
    for (const [i, a] of accounts.entries()) {
      out(`${fmtAccountRow(a, i)}\n`)
      out(`${fmtQuotaLine(quotaMap ? quotaMap[a.uid] : undefined)}\n`)
    }
    const a = await askOrdinal(rl, '输入序号切到该号(回车取消): ', accounts.length)
    if (a.cancel) return 0
    if (a.fail) {
      err('❌ 连续 3 次无效序号,已退出(未改动任何登录态)\n')
      return 1
    }
    const target = accounts[a.idx]
    // Trae 系写回前客户端必须已退出(其余平台由写回腿自己判在跑与否);话术不替它代裁
    const carry = chatCarryOf(platform)
    /**
     * 进程面提示按实测事实改写(2026-11-10):
     * - Trae:写回必须接管进程(客户端退出会用内存态覆写 storage.json)⇒ 本器代关、写完再拉起,
     *   用户不用手动先退;一键入口直接带 --force。
     * - WorkBuddy:客户端自带目录 watcher,外部写 auth 文件 10~20ms 内热切,**不用重启**;
     *   且它是本会话宿主,绝不能关。
     * - 其余 GUI 平台:写回腿自带关端/拉起。
     */
    const procNote =
      platform === 'trae'
        ? 'Trae 在跑时本器会代关、写完自动拉起(--force),不用手动先退。'
        : platform === 'workbuddy'
          ? 'WorkBuddy 会热切生效(客户端 watcher 自动重载),本器不关端。'
          : '写回腿会按需关闭并重新拉起客户端。'
    const cmdLine =
      `node scripts/switch-client-account.mjs --to ${target.uid} --provider ${platform}` +
      (platform === 'trae' ? ' --force' : '')
    out(`\n将执行:\n  ${cmdLine}\n\n对话:${carry.text}\n${procNote}\n`)
    const yes = (await rl.question('确认执行请输入 y(其它任意键取消): ')).trim().toLowerCase()
    if (yes !== 'y') {
      out('已取消,未改动任何登录态。\n')
      return 0
    }
    return await new Promise((resolve) => {
      out(`\n[切号开始 ${new Date().toISOString()}] 平台=${platform} 目标uid=${target.uid}\n`)
      const args = [SWITCH_MJS, '--to', target.uid, '--provider', platform]
      // Trae 在跑时必须代关才写得进去(客户端退出会用内存态覆写);其余平台写回腿自己处理
      if (platform === 'trae') args.push('--force')
      const child = spawn(
        process.execPath,
        args,
        {
          cwd: ROOT,
          windowsHide: true,
          // 两条输出腿都接管:既上窗口,也落日志(写回脚本输出面零凭据)
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (c) => out(c))
      child.stderr.on('data', (c) => err(c))
      let done = false
      const finish = (code, cause) => {
        if (done) return
        done = true
        const banner =
          code === 0
            ? `\n✅ 切号完成。\n📚 对话:${carry.text}\n` +
              `   打开客户端核对当前账号即可;若界面仍显示旧号,看上方有没有「模板缺失」告警 —— ` +
              `缺模板时写回腿会直接拒绝(不再沿用旧号资料),按告警里的一键补模板命令补齐后再切。\n`
            : `\n❌ 切号未成功(exit=${code}${cause ? `,${cause}` : ''}):登录态很可能未被改写,上方最后几行是失败原因。\n`
        out(banner)
        out(`📄 本次完整输出已留痕: ${LOG_FILE}\n`)
        resolve(code)
      }
      child.on('error', (e) => {
        err(`❌ 派发失败(未判定): ${e.message}\n`)
        finish(2, e.message)
      })
      child.on('exit', (code, signal) => finish(signal ? 2 : (code ?? 2), signal || ''))
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
      err(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
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
  fmtQuotaLine,
  PINNED_PLATFORM_ORDER,
  orderPlatformRows,
  POOL_LIST_TS,
  SWITCH_MJS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
