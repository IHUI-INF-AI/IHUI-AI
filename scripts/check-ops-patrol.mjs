#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 巡检工具,诊断输出就是它的产品 */
/**
 * 元运维巡检轮 —— 回答"看守者本身还活着吗"。
 *
 * 立因(2026-09-29 运维覆盖面审计,现读实证):本仓 190+ 道门全部在判**仓库内容**,而下面这五型故障
 * 的共同点是"某件事**没有发生**"——它们在账面上完全安静:
 *   P1 Prometheus 的运行副本落后于仓库源,且新加的告警规则从不热加载(实测线上比仓库少一条规则);
 *   P2 Alertmanager 生效副本与仓库模板漂移(实测多一个 `max_alerts: 50`、缺整段维护窗口抑制、分组键不同),
 *      而 AGENTS §5e 定过案"禁止自设总量上限,撞顶即静默丢投递";
 *   P3 时钟:本机 `w32tm` 实测已连续约 12 小时没同步成功,而所有"多久一次/去重窗口/时间轴"判据都踩着它;
 *   P4 D 盘增长:清理脚本只扫 C 盘,D:\DevEnv 下 Temp/logs/archives 三块无任何上限保护;
 *   P5 心跳:部署环不迭代、备份不产出、凭据巡检不跑、网盘同步客户端没开 —— 全部无人判"多久没响"。
 *   P6(2026-09-29 补这一格):告警规则**引用了根本不存在的指标序列** ⇒ 那条规则永远不会响,而台账
 *      读成"这一维已覆盖"。真实现场两条 —— `LlmTokenCostSurge` 取 `ihui_llm_tokens_total`、
 *      `LlmProviderErrorBurst` 取 `ihui_llm_provider_errors_total`,而 ai-service `/metrics` 今天
 *      不产出这两个序列。它们的注释写着"待指标出现即生效",是**已定档的待偿项**,不该被冒判成违规;
 *      所以 P6 产出的不是"把这两条判红",而是"给这一类待偿项一套有死亡机制的裁决账"
 *      (`scripts/data/inert-alert-rules.json`,四件套 anchor+reason+owner+reviewBy,
 *      三条红:字段不齐 / 到期未复裁 / 锚点已不在规则文件里 = 清单腐烂)。
 *
 * 定级与接线:本脚本判的是**机器运行状态**,提交者结构上满足不了,所以它**不进提交链**
 * (挂 blocking 就是每台每次被逼 `--no-verify`、连带全部守门作废,AGENTS §12e 同型)。
 * 它由 `scripts/git-guardian.mjs` 的 `auditOpsPatrol()` 按节流窗口调用,红经守护既有的邮件出口派发。
 *
 * 取材口径(守门 118 需要知道):本脚本**不读任何被 git 跟踪的仓库内容**,读的全是
 * 机器状态与运行副本(按设计只存在于本机),因此不存在"按磁盘判被审内容"那一型 ——
 * 与 check-c-drive-pollution / check-desktop-cache-plaintext 同族。
 * 体积数字的权威口径是 `scripts/c-disk-breakdown.mjs`;本脚本的量算只是**越阈触发器**,
 * 有界、不跟随重解析点,不得拿来当体积账(§26 junction 穿透事故同族)。
 *
 * 用法:
 *   node scripts/check-ops-patrol.mjs                 # 只读巡检
 *   node scripts/check-ops-patrol.mjs --apply         # 顺手修 P1/P2(先归档现场,再热加载)
 *   node scripts/check-ops-patrol.mjs --json          # 机器消费面
 *   node scripts/check-ops-patrol.mjs --strict        # 有"未判定"即拒绝出具合格证(exit 2)
 *   node scripts/check-ops-patrol.mjs --self-test     # 逻辑自检(零副作用)
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  statSync,
  renameSync,
  rmSync,
  mkdtempSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { devEnvRoot } from './seal-c-root-stray.mjs'
import { scratchRoot } from './lib/scratch-dir.mjs'
// 遮噪只许引这一份(AGENTS §3 / 守门 131·135·150 同一条禁令):本文件**不得**再自带
// 一遍注释/字符串状态机 —— 两处实现必漂移,而漂移的表现是安静。
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(SELF_DIR, '..')
const ISO = (ms) => new Date(ms).toISOString()

/** 越阈触发器的档位。写在这里是为了让"为什么是这个数"能被打问。 */
export const LIMITS = {
  /**
   * 部署环日志空窗阈值。**25 分钟,不是 10 分钟** —— 2026-09-29 实测:一次 next 构建 5–10 分钟,
   * "构建尝试 1/4 → 2/4" 之间实测安静 9 分 27 秒(08:38:12→08:47:39),而失败链最多 4 试 + 30 分钟冷却。
   * 10 分钟那一版会把"正在构建"读成"环停了",每 15 分钟造一次误红(重复告警本身就是缺陷)。
   * 真正的"环在失败"由 P5b 读日志尾部的 FAIL 标记判,不靠安静判 —— 安静有两种成因。
   */
  deployLoopLogMin: 25,
  /** P5b:日志尾部出现 FAIL/未切流 且晚于最后一次成功切流 ⇒ 环在跑但跑不成(这才是该喊的)。 */
  deployFailLookbackBytes: 260000,
  /** 备份每日 03:00;留 2 小时抖动余量。 */
  pgDumpMaxAgeHours: 26,
  /** 凭据巡检每 6 小时一轮。 */
  credentialHealthMaxAgeHours: 8,
  /** 公网探测由守护每 30 分钟派一次。 */
  publicProbeMaxAgeHours: 2,
  /** D 盘 Temp 与 archives 的体积/条目触发器(不是体积账,见头注)。 */
  devenvTempBytes: 4 * 1024 ** 3,
  devenvTempEntries: 60000,
  devenvLogsBytes: 3 * 1024 ** 3,
  devenvArchivesBytes: 20 * 1024 ** 3,
  /** 时钟:计划轮询 2048s,连续 3 次失败就该喊。 */
  ntpMaxAgeHours: 8,
}

const PROM_SYNC_SCRIPT = join(SELF_DIR, 'sync-prometheus-live-config.mjs')
const RENDER_SCRIPT = join(SELF_DIR, 'render-alertmanager-config.mjs')

function sha(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

/**
 * 有界目录量算:只统计普通文件,**绝不跟随重解析点**(§26),到预算即停并如实标 truncated。
 * 返回 null = 量不到(目录不存在 / 权限),调用方必须落成"未判定"而不是 0。
 */
export function measureDir(path, { maxEntries = 120000 } = {}) {
  if (!existsSync(path)) return null
  let bytes = 0
  let entries = 0
  let truncated = false
  const stack = [path]
  try {
    if (lstatSync(path).isSymbolicLink() || lstatSync(path).isFile()) return null
  } catch {
    return null
  }
  while (stack.length) {
    const dir = stack.pop()
    let names
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (entries >= maxEntries) {
        truncated = true
        break
      }
      const p = join(dir, name)
      let st
      try {
        st = lstatSync(p)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) continue // 重解析点:断链与穿透都不得发生在这里
      if (st.isDirectory()) {
        stack.push(p)
        continue
      }
      if (st.isFile()) {
        entries += 1
        bytes += st.size
      }
    }
    if (truncated) break
  }
  return { bytes, entries, truncated }
}

/** 年龄判定三态:量不到 → undetermined;超阈 → finding;否则 ok。 */
export function ageVerdict(ageMs, maxAgeMinutes) {
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs)) return 'undetermined'
  return ageMs > maxAgeMinutes * 60_000 ? 'finding' : 'ok'
}

/**
 * `w32tm /query /status` 的输出有**两个**本地化陷阱,都由本机当次实测钉出(2026-09-29):
 *   ① 标签随系统语言变(中文"上次成功同步时间" / 英文"Last Successful Sync Time"),且 stdout 是
 *      **GBK** —— Node 按 UTF-8 解会得到乱码,所以下面先试 UTF-8、解不出再按 GBK 回退;
 *   ② 日期是**斜杠 + 单位数月/日/小时**(`2026/9/28 19:52:42`),不是 ISO。按 `\d{4}-\d{2}-\d{2}`
 *      写的正则在真实输出上**永不命中**,而它不报错 —— 只会让这一维长期安静地落在"未判定"。
 *      (§22c 那条红线就是为这一型立的:夹具必须逐字取自真实文件,否则测试是在复读实现。)
 * `w32tm` 打的是**本地时间**,所以按本地解析(不带 Z),换到非 UTC 时区的机器同样成立。
 * 两种标签都解不出 → null(未判定),不得把"解不出"读成"同步正常"。
 */
export function parseLastSync(text) {
  if (!text) return null
  const lines = String(text).split(/\r?\n/)
  const want = /(Last Successful Sync Time|上次成功同步时间)/i
  for (const line of lines) {
    if (!want.test(line)) continue
    const m = line.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T]?(\d{1,2}):(\d{2}):(\d{2})/)
    if (!m) continue
    const pad = (s) => String(s).padStart(2, '0')
    const t = Date.parse(`${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4])}:${m[5]}:${m[6]}`)
    if (Number.isFinite(t)) return t
  }
  return null
}

function runW32tm() {
  let buf
  try {
    buf = execFileSync('w32tm.exe', ['/query', '/status'], {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'buffer',
    })
  } catch (e) {
    return { text: null, why: `w32tm 派生失败:${e?.code || e?.message || '未知'}` }
  }
  const asUtf8 = Buffer.from(buf).toString('utf8')
  const text = parseLastSync(asUtf8) === null ? new TextDecoder('gbk').decode(buf) : asUtf8
  return { text, why: null }
}

function newestMatching(dir, pattern) {
  if (!existsSync(dir)) return null
  let best = null
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return null
  }
  for (const n of names) {
    if (!pattern.test(n)) continue
    try {
      const st = statSync(join(dir, n))
      if (st.isFile() && (!best || st.mtimeMs > best.mtimeMs)) best = { name: n, mtimeMs: st.mtimeMs }
    } catch {
      /* 单项取不到不影响整体判定 */
    }
  }
  return best
}

/**
 * P1b:线上**真加载的告警规则名集合** ↔ 该实例按路径加载的那份规则文件,逐名对账。
 * 为什么不是比 `lastConfigTime`:本脚本第一版就是那么写的,而本机 Prometheus 3.14 的
 * `/api/v1/status/runtimeinfo` **根本没有这个字段**(实测响应只有 startTime/CWD/version…),
 * 于是那条判据只能永久落在"未判定" —— 字段缺席不该变成一格长期没人看的东西,换成名字集合直接对账后,
 * "改了没上岗"能被逐条点名。
 * 取材说明(守门 118 需要知道):这里比的"文件侧"就是**线上进程自己在读的那个路径**,
 * 不是拿磁盘冒充被审内容 —— 运行事实的输入本来长在磁盘上。
 */
export async function checkRulesLoaded({ alertsFile, baseUrl = 'http://127.0.0.1:8815' }) {
  if (!existsSync(alertsFile)) return { id: 'P1b', state: 'undetermined', detail: `规则文件取不到:${alertsFile}` }
  let text
  try {
    text = readFileSync(alertsFile, 'utf8')
  } catch (e) {
    return { id: 'P1b', state: 'undetermined', detail: `规则文件读不到:${e?.message || e}` }
  }
  const declared = [...text.matchAll(/^\s*-\s+alert:\s*([A-Za-z0-9_.:-]+)\s*$/gm)].map((m) => m[1])
  if (!declared.length) {
    return { id: 'P1b', state: 'undetermined', detail: `文件里一条 "-alert" 都没解析到(${alertsFile})⇒ 尺子失效,不读成"线上已同步"` }
  }
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 10000)
  let body
  try {
    const res = await fetch(`${baseUrl}/api/v1/rules?type=alert`, { signal: ac.signal })
    body = await res.json()
  } catch (e) {
    return { id: 'P1b', state: 'undetermined', detail: `线上规则接口不通:${e?.name || e?.message}` }
  } finally {
    clearTimeout(t)
  }
  const loaded = new Set()
  for (const g of body?.data?.groups || []) for (const r of g.rules || []) if (r?.name) loaded.add(String(r.name))
  if (!loaded.size) {
    return { id: 'P1b', state: 'undetermined', detail: '线上返回 0 条告警规则 —— 要么接口形态变了,要么规则整片没上岗,交人工' }
  }
  const missing = declared.filter((n) => !loaded.has(n))
  const extra = [...loaded].filter((n) => !declared.includes(n))
  if (missing.length) {
    return {
      id: 'P1b',
      state: 'finding',
      detail: `声明了但线上没上岗:${missing.join(', ')}(文件 ${declared.length} 条 / 线上 ${loaded.size} 条)`,
    }
  }
  return {
    id: 'P1b',
    state: 'ok',
    detail: `线上 ${loaded.size} 条,文件 ${declared.length} 条全在岗${extra.length ? `;线上多出 ${extra.length} 条(只报数,可能来自别的 rule_files):${extra.join(',')}` : ''}`,
  }
}

/**
 * P5 心跳表:每一项是"某个执行体最近一次产出证据的时刻"。
 * 文件不存在一律 undetermined(它可能是别人那台机才有的形态),**不计为通过也不计为红**。
 */
export function heartbeatRows({ now, devEnv }) {
  const rows = []
  const push = (label, path, maxAgeMinutes, note) => {
    let ageMs = null
    if (!existsSync(path)) rows.push({ label, state: 'undetermined', detail: `取不到:${path}`, note })
    else {
      try {
        ageMs = now - statSync(path).mtimeMs
      } catch {
        ageMs = null
      }
      rows.push({
        label,
        state: ageVerdict(ageMs, maxAgeMinutes),
        ageMin: ageMs === null ? null : Math.round(ageMs / 60000),
        limitMin: maxAgeMinutes,
        detail: ageMs === null ? '时间戳取不到' : `${Math.round(ageMs / 60000)} 分钟前 | 阈 ${maxAgeMinutes * 60} 秒级`,
        note,
      })
    }
  }
  push('部署环迭代', join(REPO, 'deploy/win/deploy-loop.log'), LIMITS.deployLoopLogMin, 'IHUI-DEPLOYLOOP 60s 一轮')
  const dump = newestMatching(join(devEnv, 'backups/pg'), /\.dump$/)
  push(
    '数据库备份产出',
    dump ? join(devEnv, 'backups/pg', dump.name) : join(devEnv, 'backups/pg/__none__'),
    LIMITS.pgDumpMaxAgeHours * 60,
    dump ? `最新 ${dump.name}` : '目录里没有 .dump',
  )
  push('凭据活性巡检', join(REPO, '.workbuddy/credential-health-last.json'), LIMITS.credentialHealthMaxAgeHours * 60, '计划任务 6h')
  push('公网路径探测', join(REPO, '.workbuddy/public-path-probe-last.json'), LIMITS.publicProbeMaxAgeHours * 60, '守护 30min 派一次')
  return rows
}

export function baiduSyncRunning() {
  try {
    const out = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq BaiduNetbox.exe', '/FO', 'CSV', '/NH'], {
      windowsHide: true,
      timeout: 15000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return !/NONE/i.test(String(out)) && String(out).includes('BaiduNetbox')
  } catch {
    return null
  }
}

/**
 * P1:运行副本是否落后于仓库源。判据委托给既有实现 `sync-prometheus-live-config.mjs --check`,
 * 不在这里重写派生逻辑(两处实现必漂移)。rc=0 且输出里没有"落后"才算一致。
 */
export function checkPrometheusLive({ apply, runner }) {
  if (!existsSync(PROM_SYNC_SCRIPT)) {
    return { id: 'P1', state: 'undetermined', detail: '同步器不在位 ⇒ 没判,不读成"一致"' }
  }
  const call = runner || ((args) => {
    try {
      const stdout = execFileSync(process.execPath, [PROM_SYNC_SCRIPT, ...args], {
        cwd: REPO,
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      })
      return { code: 0, out: String(stdout || '') }
    } catch (e) {
      return { code: typeof e.status === 'number' ? e.status : 2, out: String(e.stdout || ''), err: String(e.stderr || e.message) }
    }
  })
  const r = call(['--check'])
  const text = `${r.out || ''}${r.err || ''}`
  const stale = /落后|需要写回|drift/i.test(text)
  if (!stale && r.code === 0) return { id: 'P1', state: 'ok', detail: '运行副本与仓库源一致' }
  if (!stale && r.code !== 0) return { id: 'P1', state: 'undetermined', detail: `同步器 rc=${r.code} 且没报"落后"—— 结论不明,不去猜` }
  if (!apply) return { id: 'P1', state: 'finding', detail: '运行副本落后于仓库源;出路 --apply(它会自带现场归档 + POST /-/reload)' }
  const w = call(['--reload'])
  const wt = `${w.out || ''}${w.err || ''}`
  const reloaded = /热加载|reload/i.test(wt) && w.code === 0
  return {
    id: 'P1',
    state: reloaded ? 'fixed' : 'finding',
    detail: reloaded ? '已写回并热加载' : `已尝试写回但热加载未确认(rc=${w.code}):${wt.split(/\r?\n/).filter(Boolean).pop() || '(无输出)'}`,
  }
}

/** P2:Alertmanager 生效副本 ↔ 模板渲染产物逐字节对账。只报哈希与长度,内容含凭据,永不打印。 */
export function checkAlertmanagerLive({ now, apply, devEnv }) {
  const live = join(devEnv, 'monitor/alertmanager/alertmanager.yml')
  if (!existsSync(RENDER_SCRIPT)) return { id: 'P2', state: 'undetermined', detail: '渲染器不在位 ⇒ 没判' }
  if (!existsSync(live)) return { id: 'P2', state: 'undetermined', detail: `运行副本取不到:${live}` }
  const scratchDir = join(REPO, '.ihui-agent/tmp/ops-patrol')
  const scratch = join(scratchDir, 'alertmanager.rendered.yml')
  let rendered
  try {
    mkdirSync(scratchDir, { recursive: true })
    execFileSync(process.execPath, [RENDER_SCRIPT, '--out', scratch], {
      cwd: REPO,
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 1 << 22,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    rendered = readFileSync(scratch)
  } catch (e) {
    return { id: 'P2', state: 'undetermined', detail: `渲染取不到(不出结论):${e?.message || e}` }
  }
  let liveBuf
  try {
    liveBuf = readFileSync(live)
  } catch (e) {
    return { id: 'P2', state: 'undetermined', detail: `运行副本读不到:${e?.message || e}` }
  }
  if (Buffer.compare(rendered, liveBuf) === 0) return { id: 'P2', state: 'ok', detail: `逐字节等值(${liveBuf.length} B)` }
  const diff = `渲染 ${rendered.length} B sha:${sha(rendered)} | 生效 ${liveBuf.length} B sha:${sha(liveBuf)}`
  if (!apply) return { id: 'P2', state: 'finding', detail: `生效副本与模板漂了(${diff});出路 --apply(先归档现场再热加载)` }
  try {
    const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '')
    renameSync(live, `${live}.stale-${stamp}`)
    copyFileSync(scratch, live)
    return { id: 'P2', state: 'needs-reload', detail: `现场已归档为 ${live}.stale-${stamp},新副本已写入(${diff})` }
  } catch (e) {
    return { id: 'P2', state: 'finding', detail: `写回失败,生效副本原样未动:${e?.message || e}` }
  }
}

async function reloadEndpoint(url) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 8000)
  try {
    const res = await fetch(url, { method: 'POST', signal: ac.signal })
    return res.status
  } catch (e) {
    return `失败:${e?.name || e?.message}`
  } finally {
    clearTimeout(t)
  }
}

export function checkClock({ now }) {
  const { text, why } = runW32tm()
  if (why) return { id: 'P3', state: 'undetermined', detail: why }
  const at = parseLastSync(text)
  if (at === null) return { id: 'P3', state: 'undetermined', detail: '两种标签都没解出"上次成功同步"—— 不猜' }
  const ageH = (now - at) / 3600000
  return {
    id: 'P3',
    state: ageH > LIMITS.ntpMaxAgeHours ? 'finding' : 'ok',
    detail: `上次成功同步 ${ISO(at)}(${ageH.toFixed(1)} 小时前),阈 ${LIMITS.ntpMaxAgeHours} 小时`,
  }
}

export function checkGrowth({ devEnv }) {
  const out = []
  const one = (id, path, bytesLimit, entriesLimit) => {
    const m = measureDir(path)
    if (!m) return void out.push({ id, state: 'undetermined', detail: `量不到:${path}` })
    const over = m.bytes > bytesLimit || (entriesLimit ? m.entries > entriesLimit : false)
    out.push({
      id,
      state: m.truncated ? 'undetermined' : over ? 'finding' : 'ok',
      detail: `${(m.bytes / 1024 ** 3).toFixed(2)} GB / ${m.entries} 项${m.truncated ? '(达预算截断,不计结论)' : ''} | 阈 ${(bytesLimit / 1024 ** 3).toFixed(0)} GB${entriesLimit ? ` / ${entriesLimit} 项` : ''}`,
    })
  }
  one('P4a', join(devEnv, 'Temp'), LIMITS.devenvTempBytes, LIMITS.devenvTempEntries)
  one('P4b', join(devEnv, 'logs'), LIMITS.devenvLogsBytes)
  one('P4c', join(devEnv, 'backups/archives'), LIMITS.devenvArchivesBytes)
  return out
}

/**
 * P5b:部署环"在跑但跑不成"。安静有两种成因(正在构建 / 真的停了),所以心跳那一维**不能**用来判失败 ——
 * 这里读日志尾部最近一次轮询的收尾退出码(实测版式 `———— 部署轮询结束(exit=1) ————`),
 * 并带出最近一条 FAIL 原文当证据。读不到收尾行 ⇒ 未判定(可能正在构建中),不读成"没问题"。
 */
export function checkDeployLoopOutcome({ logFile = join(REPO, 'deploy/win/deploy-loop.log'), tailBytes = 260000 } = {}) {
  let text
  try {
    const st = statSync(logFile)
    const fd = readFileSync(logFile)
    text = fd.subarray(Math.max(0, st.size - tailBytes)).toString('utf8').replace(/\r/g, '')
  } catch (e) {
    return { id: 'P5b', state: 'undetermined', detail: `部署日志取不到:${e?.message || e}` }
  }
  const ends = [...text.matchAll(/部署轮询结束\(exit=(\d+)\)/g)]
  if (!ends.length) return { id: 'P5b', state: 'undetermined', detail: '尾部没有"部署轮询结束"行 ⇒ 可能正在构建中,不据此下结论' }
  const last = ends[ends.length - 1]
  const pos = last.index
  const after = text.slice(Math.max(0, pos - 20000), pos)
  const fails = [...after.matchAll(/FAIL\s+(.+)/g)]
  if (last[1] === '0') {
    return { id: 'P5b', state: 'ok', detail: `最近一轮收尾 exit=0${fails.length ? `(同段有 ${fails.length} 条 FAIL 历史行,只报数)` : ''}` }
  }
  const why = fails.length ? fails[fails.length - 1][1].trim().slice(0, 160) : '(尾部该段没抓到 FAIL 原文)'
  return { id: 'P5b', state: 'finding', detail: `最近一轮 exit=1,未切流。最后一条 FAIL:${why}` }
}

/**
 * P6 —— 告警规则引用的指标**根本不存在**,于是那条规则永远不会响,而账面读起来像"这一格已有人看守"。
 *
 * 立因(2026-09-29 现读):`monitoring/prometheus/alerts.yml` 的 `LlmTokenCostSurge` 取
 * `ihui_llm_tokens_total`、`LlmProviderErrorBurst` 取 `ihui_llm_provider_errors_total`,而
 * `GET /api/v1/label/__name__/values`(1876 个名字)里两个都没有 ⇒ 两条规则的表达式恒不评估。
 * 这两条**不是要判红的违规**:它们的注释明确写着"待指标出现即生效",是本仓已定档的**待偿项**
 * (`or on() vector(0)` 兜底保证指标缺席时不误报)。所以本判据产出的不是"把它们判红",而是
 * **给这一类待偿项一套有死亡机制的裁决账**(AGENTS「工作队列必须有死亡机制」那条原文照抄):
 * 每条四件套 `anchor(内容锚 = 规则名,不含行号)+ reason + owner + reviewBy`,三条红 =
 * 字段不齐 / 到期未复裁(站点回到队列)/ 锚点在被审面已找不到(清单腐烂)。
 * **裁决账不是豁免通道** —— 它只登记"这一处证据不足,由具名的人限期再看",不裁"这一处不算错"。
 *
 * 四态不并桶:`live`(至少一个引用指标在采)/ `inert`(引用全部不在 ⇒ 候选永不触发)/
 * `undetermined`(接口取不到 / 提不出候选名 / 引用的是 recording rule 派生名)/
 * `deferred`(inert 且台账在裁未到期 ⇒ **只报数不判红**)。
 * 判红只发生在:inert 且无台账 / 台账过期 / 台账腐烂。接口不可达时整条 P6 落未判定**不判红**
 * —— 它判的是机器状态,机器态判红就是与任何提交无关的恒红门(§12e 同型)。
 */

/**
 * PromQL 里"裸出现但不是指标名"的关键字。
 * 只收**不带括号也会出现在式子里**的那些(`on`/`ignoring`/`bool`/`offset`/`and` …);
 * 函数一律由"后面跟左括号"那条规则摘掉,不在这张表里重复登记 —— 两处摘同一件事必漂移。
 */
const PROM_NON_METRIC_WORDS = new Set([
  'and',
  'or',
  'unless',
  'bool',
  'offset',
  'on',
  'ignoring',
  'group_left',
  'group_right',
  'by',
  'without',
  'inf',
  'nan',
])

/**
 * 从规则文本里取每条 `alert:` / `record:` 的名字与它的 `expr:`。
 * 版式只认本仓实际写法(两种都真在 `alerts.yml` 里):单行 `expr: …` 与块标量 `expr: |` + 缩进续行。
 * 解析不出任何一条 ⇒ 调用方落未判定,**不得把"没解析到"读成"没有规则"**(本仓最高频失效型)。
 */
export function parseAlertRules(yamlText) {
  const rules = []
  const lines = String(yamlText || '').split(/\r?\n/)
  let cur = null
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ')
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const named = line.match(/^\s*-\s+(alert|record):\s*([A-Za-z0-9_:.]+)\s*$/)
    if (named) {
      cur = { name: named[2], kind: named[1], expr: '', block: false, exprIndent: -1 }
      rules.push(cur)
      continue
    }
    // 另一个列表项(组名等)⇒ 当前规则结束;此后不再有 expr 归属它
    if (/^\s*-\s+/.test(line)) {
      cur = null
      continue
    }
    if (!cur) continue
    const eM = line.match(/^(\s+)expr:\s*(.*)$/)
    if (eM) {
      const rest = eM[2]
      if (rest === '|' || rest === '|-' || rest === '>' || rest === '>-') {
        cur.block = true
        cur.exprIndent = eM[1].length
      } else {
        cur.block = false
        cur.expr = rest
      }
      continue
    }
    if (!cur.block) continue
    const indent = line.match(/^(\s*)/)[1].length
    // 块标量只收比 `expr:` 更缩进的续行;一遇同级/更浅(如 `for:`)就结束 —— 否则会把
    // `for`、`annotations` 整段吞进表达式,凭空造出候选名。
    if (indent > cur.exprIndent) cur.expr += (cur.expr ? '\n' : '') + t
    else cur.block = false
  }
  return rules
}

/**
 * 从一段 PromQL 里取"疑似指标名"。
 * 三条摘噪顺序不能换:① **遮噪走唯一实现** `scripts/lib/code-mask.mjs`(本文件不得再抄一份
 * 注释/字符串遮蔽 —— 两处实现必漂移,§3/§22c 记过最多次),标签值 `"api"` 里的字必须消失;
 * ② 摘掉标签选择器 `{…}` 与范围选择器 `[…]`、以及 `by (…) / on (…) / group_left (…)` 这类
 * **集合修饰的括号组** —— 其中是标签名不是指标名(任务书点名的 `sum by (...)` 那一型);
 * ③ 名字后紧跟左括号 ⇒ 函数调用(`rate`/`sum`/`vector`/`histogram_quantile`),不是指标。
 * 另外要求候选左邻不是 `[A-Za-z0-9_.]`,否则 `15m` 里的 `m`、小数尾巴会被当名字。
 */
export function metricRefsFromExpr(expr) {
  const masked = maskCommentsAndStrings(String(expr || ''))
  const cleaned = masked
    .replace(/#[^\n]*/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(?:by|without|on|ignoring|group_left|group_right)\s*\([^()]*\)/g, ' ')
  const out = []
  const seen = new Set()
  const re = /[A-Za-z_:][A-Za-z0-9_:]*/g
  let m
  while ((m = re.exec(cleaned)) !== null) {
    const prev = m.index > 0 ? cleaned[m.index - 1] : ''
    if (prev && /[A-Za-z0-9_.]/.test(prev)) continue
    let j = m.index + m[0].length
    while (j < cleaned.length && (cleaned[j] === ' ' || cleaned[j] === '\t')) j += 1
    if (cleaned[j] === '(') continue
    if (PROM_NON_METRIC_WORDS.has(m[0])) continue
    if (!seen.has(m[0])) {
      seen.add(m[0])
      out.push(m[0])
    }
  }
  return out
}

/** reviewBy 的"到期"按**当天结束**算(UTC),所以 2026-10-29 在 10-29 当天仍未到期。 */
function reviewDeadlineMs(reviewBy) {
  if (typeof reviewBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reviewBy.trim())) return null
  const at = Date.parse(`${reviewBy.trim()}T23:59:59Z`)
  return Number.isFinite(at) ? at : null
}

/**
 * P6 的判定核心 —— **纯函数**,YAML 文本 / 指标名集合 / 台账条目 / now 全部由调用方喂进来,
 * 所以自检与镜像测试能拿构造面判四态,不连 Prometheus 也不读盘。
 * 返回 `{ rows, counts }`:`rows` 是 `{id,state,detail}` 数组(与 patrol 现有条目同格式),
 * 判红与未判定**逐条点名**,live/deferred 收在汇总行里(deferred 按口径只报数)。
 */
export function scanInertAlertRules({ yamlText, liveNames, ledgerEntries, now = Date.now(), ledgerWhy = null }) {
  const rules = parseAlertRules(yamlText)
  const names = liveNames instanceof Set ? liveNames : new Set(liveNames || [])
  if (!rules.length) {
    return {
      rows: [{ id: 'P6', state: 'undetermined', detail: '规则文件里一条 alert/record 都没解析到 ⇒ 尺子失效,不读成"没有永不触发的规则"' }],
      counts: { live: 0, inert: 0, deferred: 0, undetermined: 1, red: 0 },
    }
  }
  if (!names.size) {
    return {
      rows: [{ id: 'P6', state: 'undetermined', detail: '指标名集合为空(0 个名字)⇒ 枚举到 0 不记绿,整维未判定' }],
      counts: { live: 0, inert: 0, deferred: 0, undetermined: 1, red: 0 },
    }
  }
  const recordNames = new Set(rules.filter((r) => r.kind === 'record').map((r) => r.name))
  const rows = []
  const counts = { live: 0, inert: 0, deferred: 0, undetermined: 0, red: 0 }
  const deferredNames = []
  const verdictOf = new Map() // 规则名 → 结论,给台账腐烂/多余条目对账用

  const take = (key, rank, next) => {
    const prev = verdictOf.get(key)
    if (!prev || rank > prev.rank) verdictOf.set(key, { rank, ...next })
  }

  for (const r of rules) {
    const name = r.name
    const refs = metricRefsFromExpr(r.expr)
    if (!String(r.expr || '').trim() || !refs.length) {
      counts.undetermined += 1
      rows.push({
        id: `P6·${name}`,
        state: 'undetermined',
        detail: `${r.kind} 表达式里提不出任何候选指标名(expr=${JSON.stringify(String(r.expr || '').slice(0, 80))})⇒ 未判定,不记绿`,
      })
      take(name, 3, { state: 'undetermined' })
      continue
    }
    const live = refs.filter((n) => names.has(n))
    const absent = refs.filter((n) => !names.has(n))
    if (live.length) {
      counts.live += 1
      take(name, 0, { state: 'live' })
      continue
    }
    const derived = absent.filter((n) => recordNames.has(n))
    if (derived.length) {
      counts.undetermined += 1
      rows.push({
        id: `P6·${name}`,
        state: 'undetermined',
        detail: `引用的是本文件内 recording rule 的派生名(${derived.join(', ')}),而它此刻也不在指标名集合里 —— 派生序列是否真在产出本判据看不见,未判定而非判红`,
      })
      take(name, 3, { state: 'undetermined' })
      continue
    }
    // inert:先查台账
    const entry = (ledgerEntries || []).find((e) => e && e.anchor === name)
    const inertText = `引用的指标全部不在 Prometheus 已知指标名里(${absent.join(', ')})⇒ 该规则结构上永不触发`
    if (!entry) {
      counts.inert += 1
      counts.red += 1
      rows.push({
        id: `P6·${name}`,
        state: 'finding',
        detail: `${inertText};出路二选一:① 把表达式改成真在采的指标名,② 在 scripts/data/inert-alert-rules.json 按四件套登记裁决(anchor + reason + owner + reviewBy,reason 里带可核验的取证命令)`,
      })
      take(name, 2, { state: 'finding' })
      continue
    }
    const problems = []
    for (const f of ['anchor', 'reason', 'owner', 'reviewBy']) {
      const v = entry[f]
      if (typeof v !== 'string' || !v.trim()) problems.push(`${f} 缺失/为空`)
    }
    if (problems.length) {
      counts.inert += 1
      counts.red += 1
      rows.push({
        id: `P6·${name}`,
        state: 'finding',
        detail: `台账条目字段不齐(${problems.join(';')})⇒ 站点继续可见、不因写坏而免检。${inertText}`,
      })
      take(name, 2, { state: 'finding' })
      continue
    }
    const due = reviewDeadlineMs(entry.reviewBy)
    if (due === null) {
      counts.inert += 1
      counts.red += 1
      rows.push({
        id: `P6·${name}`,
        state: 'finding',
        detail: `台账 reviewBy=${JSON.stringify(entry.reviewBy)} 不是 YYYY-MM-DD ⇒ 等于没有到期日 = 没有死亡机制。${inertText}`,
      })
      take(name, 2, { state: 'finding' })
      continue
    }
    if (now > due) {
      counts.inert += 1
      counts.red += 1
      rows.push({
        id: `P6·${name}`,
        state: 'finding',
        detail: `裁决已到期未复裁(reviewBy=${entry.reviewBy},持有者=${entry.owner})⇒ 站点回到队列。${inertText};出路:续进展(改 reviewBy + 写明新证据)或把表达式改到真在采的指标上`,
      })
      take(name, 2, { state: 'finding' })
      continue
    }
    counts.inert += 1
    counts.deferred += 1
    deferredNames.push(`${name}(到期 ${entry.reviewBy})`)
    take(name, 1, { state: 'deferred' })
  }

  // 台账侧两型腐烂:锚点指向的规则已不在被审面 / 条目在裁而规则其实已 live(只报数)
  for (const e of ledgerEntries || []) {
    const a = typeof e?.anchor === 'string' ? e.anchor.trim() : ''
    if (a && !verdictOf.has(a)) {
      counts.red += 1
      rows.push({
        id: `P6·${a}`,
        state: 'finding',
        detail: '台账腐烂:该锚点在规则文件里已经找不到条目(规则被改名或删掉而账没跟着清)⇒ 登记表过期比没有表更糟,它会替人做出"这一条已被想过"的判断',
      })
    } else if (a && verdictOf.get(a)?.state === 'live') {
      rows.push({
        id: `P6·${a}`,
        state: 'ok',
        detail: '台账仍在裁而该规则引用的指标其实已在采(只报数):裁完请把条目撤掉,免得账变成第二份现状',
      })
    }
  }

  const summaryState = counts.red ? 'finding' : counts.undetermined ? 'undetermined' : 'ok'
  rows.unshift({
    id: 'P6',
    state: summaryState,
    detail: `规则 ${rules.length} 条:在采 ${counts.live} / 永不触发 ${counts.inert}(其中台账在裁 ${counts.deferred})/ 判红 ${counts.red} / 未判定 ${counts.undetermined}${deferredNames.length ? `;deferred:${deferredNames.join('、')}` : ''}${ledgerWhy ? `;台账:${ledgerWhy}` : ''}`,
  })
  return { rows, counts }
}

/** 现读"这台 Prometheus 真知道哪些指标名"。取不到 ⇒ 返回 {err},由调用方落未判定(不得当成空集判红)。 */
async function fetchLiveMetricNames(baseUrl, timeoutMs = 10000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(`${baseUrl}/api/v1/label/__name__/values`, { signal: ac.signal })
    if (!res.ok) return { err: `接口返回 ${res.status}` }
    const body = await res.json()
    const values = Array.isArray(body?.data) ? body.data : null
    if (!values) return { err: '响应里没有 data 数组(接口形态变了?)' }
    return { names: new Set(values.map(String)) }
  } catch (e) {
    return { err: `${e?.name || 'Error'}:${e?.message || e}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * P6 的装配层:读规则文件 + 读裁决台账 + 现读指标名,再交给纯函数判。
 * 台账文件缺失/坏 JSON **不当空表用**:照样按"无台账"判红(fail-closed,判决方向是"多要一次交代"),
 * 但一定把原因写在汇总行里 —— 否则读报告的人会以为"没人登记过这两条"。
 */
export async function checkInertAlertRules({
  alertsFile = join(REPO, 'monitoring/prometheus/alerts.yml'),
  ledgerFile = join(REPO, 'scripts/data/inert-alert-rules.json'),
  baseUrl = 'http://127.0.0.1:8815',
  now = Date.now(),
  probe = null,
} = {}) {
  let yamlText = null
  let readWhy = null
  try {
    yamlText = readFileSync(alertsFile, 'utf8')
  } catch (e) {
    readWhy = `规则文件取不到:${e?.message || e}`
    return {
      rows: [{ id: 'P6', state: 'undetermined', detail: `${readWhy} ⇒ 未判定,不判红` }],
      counts: { live: 0, inert: 0, deferred: 0, undetermined: 1, red: 0 },
    }
  }
  const got = probe ? await probe() : await fetchLiveMetricNames(baseUrl)
  if (got.err) {
    return {
      rows: [{ id: 'P6', state: 'undetermined', detail: `指标名接口取不到(${got.err})⇒ 整条 P6 未判定;它判的是机器状态,取不到不判红也不记绿` }],
      counts: { live: 0, inert: 0, deferred: 0, undetermined: 1, red: 0 },
    }
  }
  let ledgerEntries = []
  let ledgerWhy = null
  try {
    const parsed = JSON.parse(readFileSync(ledgerFile, 'utf8'))
    const list = Array.isArray(parsed?.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : null
    if (!list) ledgerWhy = `台账里没有 rules 数组(按零条目判)`
    else ledgerEntries = list
  } catch (e) {
    ledgerWhy = `台账 JSON 取不到/解析失败:${e?.message || e}(按零条目判 ⇒ 站点回到队列,这是刻意方向)`
  }
  const out = scanInertAlertRules({ yamlText, liveNames: got.names, ledgerEntries, ledgerWhy, now })
  if (ledgerWhy) out.rows.push({ id: 'P6·台账', state: 'undetermined', detail: ledgerWhy })
  return out
}

export async function patrol({ now = Date.now(), apply = false, strict = false, devEnv = devEnvRoot(REPO) } = {}) {
  const amUrl = 'http://127.0.0.1:9093/-/reload'
  const promUrl = 'http://127.0.0.1:8815/-/reload'
  const rows = []
  // 分档一律按**最终状态**算(见文件末尾),不在推入时定死 —— 本脚本有几条判据是
  // "先判出 finding/needs-reload,执行修复后再改写结论",推入时分桶会让失败的条目留在绿档里。
  const add = (r) => {
    rows.push(r)
    return r
  }

  add(checkPrometheusLive({ apply }))
  const rules = await checkRulesLoaded({ alertsFile: join(REPO, 'monitoring/prometheus/alerts.yml') })
  if (rules.state === 'finding') {
    if (!apply) {
      rules.detail += ' —— 本轮只读未触发'
    } else {
      const code = await reloadEndpoint(promUrl)
      const after = await checkRulesLoaded({ alertsFile: join(REPO, 'monitoring/prometheus/alerts.yml') })
      rules.state = after.state === 'ok' ? 'fixed' : after.state
      rules.detail =
        after.state === 'ok'
          ? `已 POST ${promUrl}(返回 ${code})并复验:规则文件不晚于加载时刻`
          : `重载返回 ${code} 但复验仍${after.state === 'finding' ? '未上岗' : '判不出'}:${after.detail}`
    }
  }
  add(rules)
  // P6:规则引用的指标序列在不在。取不到一律未判定(机器态),不判红 —— 见该判据头注。
  const p6 = await checkInertAlertRules({ now })
  p6.rows.forEach(add)
  const am = add(checkAlertmanagerLive({ now, apply, devEnv }))
  if (am.state === 'needs-reload') {
    const code = await reloadEndpoint(amUrl)
    const hit = code === 200 || code === '200'
    am.state = hit ? 'fixed' : 'finding'
    am.detail = hit
      ? `新副本已写入并热加载(POST ${amUrl} = 200)`
      : `新副本已写入但热加载返回 ${code} —— 需人工重启 ihui-alertmanager 才生效,别让"写了文件"冒充"生效了"`
    // 注意:上面 add() 已把这一条计入分档,这里只就地改写结论,**不得再 add 一次**
    // (同一条被计两遍会让"红/绿"计数同时虚高 —— 报数失真与判据失明同样贵)。
  }
  add(checkClock({ now }))
  checkGrowth({ devEnv }).forEach(add)
  heartbeatRows({ now, devEnv }).forEach((r) => add({ id: `P5·${r.label}`, state: r.state, detail: `${r.detail}${r.note ? ` | ${r.note}` : ''}` }))
  add(checkDeployLoopOutcome())
  const baidu = baiduSyncRunning()
  add({
    id: 'P5·网盘同步客户端',
    state: baidu === null ? 'undetermined' : baidu ? 'ok' : 'finding',
    detail:
      baidu === false
        ? 'BaiduNetbox 进程不在 ⇒ "异地容灾"这一腿此刻不成立(备份复制到网盘目录,而同步没在跑),且全仓没有"同步是否完成"的判据'
        : baidu === true
          ? '进程在位(注:同步**完成与否**仍无判据,这里只判进程)'
          : 'tasklist 派生失败 ⇒ 未判定',
  })

  const findings = rows.filter((r) => r.state === 'finding')
  const undetermined = rows.filter((r) => r.state === 'undetermined')
  const ok = rows.filter((r) => r.state !== 'finding' && r.state !== 'undetermined')
  const rc = findings.length ? 1 : strict && undetermined.length ? 2 : 0
  return {
    at: ISO(now),
    devEnv,
    counts: { findings: findings.length, undetermined: undetermined.length, ok: ok.length },
    rc,
    findings,
    undetermined,
    ok,
  }
}

async function main(argv) {
  const apply = argv.includes('--apply')
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  if (argv.includes('--self-test')) return selfTest()
  const r = await patrol({ apply, strict })
  if (json) {
    console.info(JSON.stringify(r, null, 2))
  } else {
    for (const x of r.findings) console.log(`❌ ${x.id} ${x.detail}`)
    for (const x of r.undetermined) console.log(`⚠️ 未判定 ${x.id} ${x.detail}`)
    for (const x of r.ok) console.log(`✓ ${x.id} ${x.detail}`)
    console.log(`—— 巡检完 ${r.at} | 红 ${r.counts.findings} / 未判定 ${r.counts.undetermined} / 绿 ${r.counts.ok}${apply ? ' | 已 --apply' : ''}`)
    if (!r.findings.length && r.counts.undetermined) console.log('   (没有红不等于健康:上面那些"未判定"是本脚本没看见的格子)')
  }
  if (!json) {
    try {
      mkdirSync(join(REPO, '.workbuddy'), { recursive: true })
      writeFileSync(join(REPO, '.workbuddy/ops-patrol-last.json'), JSON.stringify({ at: r.at, counts: r.counts, rc: r.rc }), 'utf8')
    } catch {
      /* 心跳自记失败不改判定:它只影响下一轮看没看到这一轮 */
    }
  }
  return r.rc
}

/**
 * 自检全部走**构造面**与纯函数,零副作用、不派生任何外部进程:
 * 每条判据都配"它应当红"与"它应当绿"两个输入 —— 只留一条,尺子就可能只是把实现复读一遍。
 */
/**
 * 真造一个重解析点来证明"不跟随":目标目录里放一个 1000 B 的文件,链接目录里除链接外再放一个
 * 10 B 的文件 —— 若跟随了链接,字节数会 ≥1010;不跟随则恰为 10。
 * 这条必须有**反向对照**(直接量目标目录要能读到 1000),否则"恒 0"会被读成"不跟随"。
 * 夹具落在 §26 规定的 scratch 根,不用 os.tmpdir()。
 */
function junctionNotFollowed() {
  const root = scratchRoot()
  mkdirSync(root, { recursive: true })
  const base = mkdtempSync(join(root, 'ops-patrol-'))
  try {
    const target = join(base, 'target')
    const holder = join(base, 'holder')
    mkdirSync(target, { recursive: true })
    mkdirSync(holder, { recursive: true })
    writeFileSync(join(target, 'big.bin'), Buffer.alloc(1000, 1))
    writeFileSync(join(holder, 'small.bin'), Buffer.alloc(10, 2))
    const link = join(holder, 'link')
    symlinkSync(target, link, 'junction')
    const viaLink = measureDir(holder)
    const direct = measureDir(target)
    return !!viaLink && viaLink.bytes === 10 && !!direct && direct.bytes >= 1000
  } catch {
    return false
  } finally {
    // §26:递归删除前先断链 —— 让 rmSync 没有"顺着 junction 穿透到真实目标"的机会。
    try {
      const l = join(base, 'holder', 'link')
      if (existsSync(l) && lstatSync(l).isSymbolicLink()) rmSync(l)
    } catch {
      /* 断链失败下面整目录删也会带走它 */
    }
    try {
      rmSync(base, { recursive: true, force: true, filter: (p) => !/link$/.test(p) || !lstatSync(p).isSymbolicLink() })
    } catch {
      /* 清理失败不改判定 */
    }
  }
}

/** P5b 的三态成对:红/绿/未判定各喂一份构造日志(只测其中一态等于没测)。 */
function p5bThreeStates() {
  const root = scratchRoot()
  mkdirSync(root, { recursive: true })
  const base = mkdtempSync(join(root, 'p5b-'))
  try {
    const bad = join(base, 'bad.log')
    const good = join(base, 'good.log')
    const busy = join(base, 'busy.log')
    writeFileSync(bad, '[09:08:34] FAIL  git merge --ff-only 本轮远端 tip 分叉需人工收敛\n———— 部署轮询结束(exit=1) ————\n', 'utf8')
    writeFileSync(good, '———— 部署轮询结束(exit=0) ————\n', 'utf8')
    writeFileSync(busy, '[09:14:56] 构建尝试 1/4 -> .next-staging\n', 'utf8')
    const a = checkDeployLoopOutcome({ logFile: bad })
    const b = checkDeployLoopOutcome({ logFile: good })
    const c = checkDeployLoopOutcome({ logFile: busy })
    return a.state === 'finding' && a.detail.includes('分叉') && b.state === 'ok' && c.state === 'undetermined'
  } catch {
    return false
  } finally {
    try {
      rmSync(base, { recursive: true, force: true })
    } catch {
      /* 清理失败不改判定 */
    }
  }
}

/**
 * P6 的端到端夹具(只走构造文件 + 注入的 probe,**不真连 Prometheus**):
 * A 臂 = 接口不可达 ⇒ 整条 P6 必须落"未判定"且**一条红都不产**(机器态判红 = 恒红门,§12e);
 * B 臂 = 同一份构造规则 + 同一份指标名 + 带未到期台账 ⇒ deferred,不判红。
 * 两臂各写一份临时规则文件/台账落在 §26 规定的 scratch 根,跑完即删(零副作用)。
 */
async function p6EndToEnd() {
  const root = scratchRoot()
  mkdirSync(root, { recursive: true })
  const base = mkdtempSync(join(root, 'p6-'))
  try {
    const alertsFile = join(base, 'alerts.yml')
    const ledgerFile = join(base, 'ledger.json')
    const yaml = ['groups:', '  - name: t', '    rules:', '      - alert: GhostRule', '        expr: ghost_metric_total > 0', '        for: 5m'].join('\n')
    writeFileSync(alertsFile, yaml, 'utf8')
    writeFileSync(
      ledgerFile,
      JSON.stringify(
        { rules: [{ anchor: 'GhostRule', reason: '预留待指标出现', owner: 'LLM 指标面持有人', reviewBy: '2026-10-29' }] },
        null,
        2,
      ),
      'utf8',
    )
    const a = await checkInertAlertRules({
      alertsFile,
      ledgerFile,
      now: Date.parse('2026-10-01T00:00:00Z'),
      probe: async () => ({ err: '模拟:接口不可达' }),
    })
    const b = await checkInertAlertRules({
      alertsFile,
      ledgerFile,
      now: Date.parse('2026-10-01T00:00:00Z'),
      probe: async () => ({ names: new Set(['up', 'process_start_time_seconds']) }),
    })
    const aOk = a.counts.red === 0 && a.rows.length === 1 && a.rows[0].state === 'undetermined'
    const bOk = b.counts.red === 0 && b.counts.deferred === 1 && b.rows.every((r) => r.state !== 'finding')
    return aOk && bOk
  } catch {
    return false
  } finally {
    try {
      rmSync(base, { recursive: true, force: true })
    } catch {
      /* 清理失败不改判定 */
    }
  }
}

export async function selfTest() {
  const cases = []
  const t = (name, cond) => cases.push({ name, pass: (() => { if (typeof cond === 'function') throw new Error(`${name}: cond 是函数 ⇒ 断言从未求值`); return cond === true })() })
  const DAY = 86400000
  t('年龄超阈必判红', ageVerdict(3 * DAY, 10) === 'finding')
  t('年龄未超阈必判绿', ageVerdict(60000, 10) === 'ok')
  t('量不到不得冒充结论', ageVerdict(NaN, 10) === 'undetermined' && ageVerdict(undefined, 10) === 'undetermined')
  // 下面三行夹具**逐字取自本机 `w32tm /query /status` 的当次实测输出**(GBK 解码后),
  // 不是我按实现编的形状 —— 第一版就是拿"连字符两位月"的自造串测过的,真机那行一个都匹配不上。
  const REAL_ZH = '客户端配置:\r\n记录源: time.windows.com,0x9\r\n上次成功同步时间: 2026/9/28 19:52:42\r\n查询频率: 11 (2048s)'
  const EN = 'Client configuration:\nLast Successful Sync Time:2026/9/29 3:37:00 AM\nStratum :5'
  t('真实中文输出(斜杠+单位数月)能解出时刻', parseLastSync(REAL_ZH) === Date.parse('2026-09-28T19:52:42'))
  t('英文标签 + 斜杠 + 单位数小时能解出时刻', parseLastSync(EN) === Date.parse('2026-09-29T03:37:00'))
  t('缺标签不得编造时刻', parseLastSync('没有这一行\nStratum :5') === null)
  t('有标签但日期形态认不出 ⇒ 未判定而非猜', parseLastSync('上次成功同步时间: 未知') === null)
  const dir = join(REPO, 'scripts')
  const m = measureDir(dir)
  t('能量到真实目录且非空', !!m && m.entries > 0 && m.bytes > 0)
  t('预算截断必须自己喊出来', (() => { const s = measureDir(dir, { maxEntries: 2 }); return s.truncated === true })())
  t('重解析点不得被跟随(真造 junction 测)', junctionNotFollowed())
  t('不存在的目录量不到(返回 null 而非 0)', measureDir(join(REPO, '__no_such_dir__')) === null)
  t('P5b 三态成对(exit=1 红 / exit=0 绿 / 正在构建 未判定)', p5bThreeStates())
  // ── P6(2026-09-29 补):规则引用的指标序列在不在。以下**全部是构造面** —— 自己造 YAML 文本、
  //    自己造指标名集合、自己造台账数组,既不读 monitoring/prometheus/alerts.yml 也不连 Prometheus。
  //    核心四对成对喂:同一段文本换台账/换日期/换锚点,结论必须翻(只测一态 = 把实现复读一遍)。
  const P6_GHOST_YAML = [
    'groups:',
    '  - name: llm',
    '    rules:',
    '      - alert: GhostSurge',
    '        expr: (sum(rate(ghost_metric_total{job="svc"}[15m])) or on() vector(0)) > 100',
    '        for: 5m',
    '        labels:',
    '          severity: warning',
  ].join('\n')
  const P6_NOW = Date.parse('2026-09-29T08:00:00Z')
  // 完整四件套、且 reviewBy 恰取"今天" —— 顺带锁死"到期按当天 23:59:59 算,当天不算过期"这条口径
  const P6_GOOD_LEDGER = [{ anchor: 'GhostSurge', reason: '预留待指标出现(引用注释)', owner: 'LLM 指标面持有人', reviewBy: '2026-09-29' }]
  const P6_LIVE_THIN = new Set(['up', 'process_start_time_seconds'])
  const P6_LIVE_HAS = new Set(['ghost_metric_total', 'up'])
  const p6go = (liveNames, ledgerEntries, extra = {}) => scanInertAlertRules({ yamlText: P6_GHOST_YAML, liveNames, ledgerEntries, now: P6_NOW, ...extra })
  // 判红**逐条点名**才是 P6 的产出;'P6' 是维度的汇总行(它自己也会随子条目变红,所以这里
  // 必须把它从"站点"名单里摘出去 —— 混在一起会让"有几条规则坏了"这个数虚高一行)。
  const p6red = (r) => r.rows.filter((x) => x.state === 'finding' && x.id !== 'P6').map((x) => x.id)
  const p6row = (r, id) => r.rows.find((x) => x.id === id) || {}

  t('P6 成对①:引用不存在的指标 + 无台账 ⇒ 必判红(点名到规则名)', (() => {
    const r = p6go(P6_LIVE_THIN, [])
    return (
      r.counts.inert === 1 && r.counts.red === 1 && p6red(r).join() === 'P6·GhostSurge' && p6row(r, 'P6').state === 'finding' && p6row(r, 'P6·GhostSurge').detail?.includes('ghost_metric_total') === true
    )
  })())
  t('P6 成对②:同一段文本 + 未过期四件套台账 ⇒ 一条不判红,但汇总行逐条报名(只报数)', (() => {
    const r = p6go(P6_LIVE_THIN, P6_GOOD_LEDGER)
    return (
      r.counts.red === 0 &&
      r.counts.deferred === 1 &&
      r.rows.every((x) => x.state !== 'finding') &&
      p6row(r, 'P6').state === 'ok' &&
      p6row(r, 'P6').detail.includes('GhostSurge(到期 2026-09-29)') === true
    )
  })())
  t('P6 成对③:台账 reviewBy 改成过去日期 ⇒ 必判红(到期未复裁,站点回到队列)', (() => {
    const r = p6go(P6_LIVE_THIN, [{ ...P6_GOOD_LEDGER[0], reviewBy: '2026-09-01' }])
    return r.counts.red === 1 && p6red(r).join() === 'P6·GhostSurge' && p6row(r, 'P6·GhostSurge').detail.includes('已到期未复裁') === true
  })())
  t('P6 成对④:台账锚点指向不存在的规则名 ⇒ 必判红(清单腐烂)', (() => {
    const r = p6go(P6_LIVE_HAS, [{ anchor: 'GhostRuleWasDeleted', reason: '构造', owner: '构造', reviewBy: '2026-09-29' }])
    return (
      r.counts.live === 1 && r.counts.red === 1 && p6red(r).join() === 'P6·GhostRuleWasDeleted' && p6row(r, 'P6·GhostRuleWasDeleted').detail.includes('腐烂') === true
    )
  })())
  t('P6 反向对照:引用的指标真在采 ⇒ 不判红也不判未判定(绿)', (() => {
    const r = p6go(P6_LIVE_HAS, [])
    return r.counts.live === 1 && r.counts.red === 0 && r.counts.undetermined === 0 && r.rows.length === 1 && r.rows[0].state === 'ok'
  })())
  t('P6 死亡机制①:台账字段不齐(缺 owner)⇒ 判红,写坏的条目不得免检', (() => {
    const bad = [{ anchor: 'GhostSurge', reason: '构造', reviewBy: '2026-09-29' }]
    const r = p6go(P6_LIVE_THIN, bad)
    return r.counts.red === 1 && p6row(r, 'P6·GhostSurge').detail.includes('字段不齐') === true
  })())
  t('P6 死亡机制②:reviewBy 不是 YYYY-MM-DD ⇒ 判红(等于没有到期日)', (() => {
    const r = p6go(P6_LIVE_THIN, [{ anchor: 'GhostSurge', reason: '构造', owner: '构造', reviewBy: '30 天后再说' }])
    return r.counts.red === 1 && p6row(r, 'P6·GhostSurge').detail.includes('没有死亡机制') === true
  })())
  t('P6 台账记的是已经采上的指标 ⇒ 只报数不判红,并催撤条目', (() => {
    const r = p6go(P6_LIVE_HAS, P6_GOOD_LEDGER)
    return r.counts.red === 0 && p6row(r, 'P6·GhostSurge').state === 'ok' && p6row(r, 'P6·GhostSurge').detail.includes('只报数') === true
  })())
  t('P6 提不出候选指标名的规则 ⇒ 逐条点名未判定(不得读成"这维干净")', (() => {
    const yaml = ['groups:', '  - name: n', '    rules:', '      - alert: NoRefRule', '        expr: vector(0) > 0'].join('\n')
    const r = scanInertAlertRules({ yamlText: yaml, liveNames: P6_LIVE_THIN, ledgerEntries: [], now: P6_NOW })
    return r.counts.red === 0 && r.counts.undetermined === 1 && p6row(r, 'P6·NoRefRule').state === 'undetermined' && p6row(r, 'P6').state === 'undetermined'
  })())
  t('P6 引用 recording rule 派生名而它此刻也不在 ⇒ 未判定而非判红', (() => {
    const yaml = [
      'groups:',
      '  - name: rec',
      '    rules:',
      '      - record: job:ghost_rate:5m',
      '        expr: sum(rate(ghost_metric_total[5m]))',
      '      - alert: DerivedGhost',
      '        expr: job:ghost_rate:5m > 0',
    ].join('\n')
    const r = scanInertAlertRules({ yamlText: yaml, liveNames: P6_LIVE_HAS, ledgerEntries: [], now: P6_NOW })
    return r.counts.red === 0 && r.counts.undetermined === 1 && p6row(r, 'P6·DerivedGhost').state === 'undetermined'
  })())
  t('P6 解析不到任何规则 ⇒ 未判定(尺子失效,不是"没有永不触发的规则")', (() => {
    const r = scanInertAlertRules({ yamlText: '# 空文件\n', liveNames: P6_LIVE_THIN, ledgerEntries: [], now: P6_NOW })
    return r.counts.red === 0 && r.counts.undetermined === 1 && r.rows.length === 1 && r.rows[0].state === 'undetermined'
  })())
  t('P6 指标名集合为空 ⇒ 未判定(枚举到 0 不记绿)', (() => {
    const r = scanInertAlertRules({ yamlText: P6_GHOST_YAML, liveNames: new Set(), ledgerEntries: P6_GOOD_LEDGER, now: P6_NOW })
    return r.counts.red === 0 && r.counts.deferred === 0 && r.rows.length === 1 && r.rows[0].state === 'undetermined'
  })())
  t('P6 台账读坏了 ⇒ 仍按零条目判红,但把原因写进汇总行(fail-closed + fail-loud)', (() => {
    const r = p6go(P6_LIVE_THIN, [], { ledgerWhy: '台账 JSON 取不到/解析失败' })
    return r.counts.red === 1 && p6row(r, 'P6').detail.includes('台账:台账 JSON 取不到/解析失败') === true
  })())
  t('P6 摘噪:函数名 / 标签名 / 范围选择器都不得当成指标名', (() => {
    const a = metricRefsFromExpr('(sum(rate(ghost_metric_total{job="svc"}[15m])) or on() vector(0)) > 100')
    const b = metricRefsFromExpr('histogram_quantile(0.95, sum by (route, code) (rate(http_server_requests_seconds_count{uri=~"/api/.*"}[5m]))) / sum by (route) (rate(http_server_requests_seconds_count[5m]))')
    return a.join() === 'ghost_metric_total' && b.join() === 'http_server_requests_seconds_count'
  })())
  t('P6 版式:块标量 expr(`>-` 续行)也能取到规则名与指标名', (() => {
    const yaml = [
      'groups:',
      '  - name: api',
      '    rules:',
      '      - alert: BlockGhost',
      '        expr: >-',
      '          sum(rate(block_ghost_total{job="api"}[5m]))',
      '            > 10',
      '        for: 10m',
    ].join('\n')
    const got = parseAlertRules(yaml)
    return got.length === 1 && got[0].name === 'BlockGhost' && metricRefsFromExpr(got[0].expr).join() === 'block_ghost_total'
  })())
  t('P6 端到端(构造文件 + 注入 probe):接口不可达 ⇒ 整条未判定且零红;可达+有台账 ⇒ deferred', await p6EndToEnd())
  let pass = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (c.pass) pass += 1
  }
  console.log(`—— 自检 ${pass}/${cases.length}`)
  return pass === cases.length ? 0 : 1
}

/** §22d 标准形态:只有被直接 node 执行才跑 CLI,被测试 import 时零副作用。 */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ 巡检脚本自身异常(不是仓库结论):${e?.message}\n${e?.stack}`)
      process.exitCode = 2
    })
}

export const __test__ = {
  measureDir,
  ageVerdict,
  parseLastSync,
  LIMITS,
  patrol,
  selfTest,
  checkDeployLoopOutcome,
  checkRulesLoaded,
  parseAlertRules,
  metricRefsFromExpr,
  scanInertAlertRules,
  checkInertAlertRules,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
