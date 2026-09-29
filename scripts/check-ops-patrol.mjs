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

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(SELF_DIR, '..')
const ISO = (ms) => new Date(ms).toISOString()

/** 越阈触发器的档位。写在这里是为了让"为什么是这个数"能被打问。 */
export const LIMITS = {
  /** 部署环 60s 一轮;10 分钟没新行 = 至少 9 轮没产出。 */
  deployLoopLogMin: 10,
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

export function selfTest() {
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

export const __test__ = { measureDir, ageVerdict, parseLastSync, LIMITS, patrol, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
