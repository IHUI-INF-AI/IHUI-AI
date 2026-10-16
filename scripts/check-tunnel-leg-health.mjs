#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-tunnel-leg-health.mjs — 隧道腿健康只读哨兵(运维尺子,未接任何提交链/调度器)
 *
 * ## 立项目标
 *
 * 公网入口 aizhs.top 由本机 Windows 服务 `Cloudflared` 承载
 * (`cloudflared.exe tunnel run --protocol http2 --token-file C:\ProgramData\cloudflared\token`)。
 * ImagePath 是裸 `tunnel run`,无日志落点 ⇒ 隧道侧事件级取证在本机结构上拿不到(已知盲区)。
 * 本尺子量的是唯一还能从 OS 面观测到的先行信号:**腿还在不在、腿绑的源地址是不是已退化
 * (deprecated)、以及是不是全吊在同一个源地址上**。
 *
 * ## 定档依据(本机实测读数,取证时刻 2026-10-16 16:01 +0800,非拍脑袋)
 *
 * - cloudflared pid = 1484;`netstat -ano` 现读 4 条 ESTABLISHED 腿,远端口均为 7844,
 *   源地址全部 = `2408:8234:c16:1f44:187:718f:be39:60a3`。
 * - `netsh interface ipv6 show addresses` 现读:
 *   - `…187:718f:be39:60a3` = 临时/首选项,有效寿命 2d10h28m5s,**首选寿命 22h10m2s**(健康态)
 *   - `…284a:8ae6:e432:bb3` = 临时/**反对**,**首选寿命 0s**(= 今天 15:0x 事故型:4 条腿全吊在它上面,
 *     系统随时可删该地址 ⇒ 4 腿同时断 ⇒ 入口直接 530,且没有任何门会提前喊)
 *   - `…a941:20e7:542c:6d2b` = 公用/首选项,首选寿命 1d10h28m5s
 * - 15:4x 重启服务后 4 条腿换到上面第一枚(首选项)地址 ⇒ "腿的源地址 ∈ {0s/反对}" 与 "断流"
 *   的因果链在现场被完整观测到一次,这就是 breach 线的出处:**任一在用源地址首选寿命 0s
 *   或状态含 反对/deprecated ⇒ breach**。
 * - 单点维不判红的依据:实测健康态同样是 4 腿共用 1 个源地址(单点是该部署的常态形态),
 *   判红即恒红门(§12e)⇒ warn-only 报数,仅当与 deprecated 同时成立时在结论里升级为
 *   "放大因子"(4 腿一起断的乘数),不另立 breach。
 * - 远端口认 7843/7844 两档(Cloudflare 隧道端口,实测现值为 7844)。
 *
 * ## 三态纪律(§0.3)
 *
 * 每维独立给 ok / breach / unjudged,各自计未判定,互不顶账。取不到输入(netsh 失败 /
 * tasklist 失败 / netstat 无行 / 解析不出地址 / 腿的源地址查不到)⇒ unjudged 并点名原因,
 * 不记绿也不冒红。腿数枚举为 0 分两种:进程在而无腿 = breach(隧道断了);进程不在 =
 * unjudged 并点名(本尺子不判定"服务本该在跑")。
 * 阳性对照:每轮真跑前先用构造夹具("已知坏":首选寿命 0s 的在用源地址)证明判据有牙,
 * 对照不命中 ⇒ 整轮降 exit 3(判据失效的表现为安静,§12f)。
 *
 * ## 退出码
 *
 * 0 = 已判定且未越阈(warn 不越阈) / 1 = 已判定且越阈 / 2 = 用法错或本器自身异常 /
 * 3 = 未判定(INCOMPLETE)。
 *
 * ## 取材面(守门 118 口径声明)
 *
 * 本器判的是**机器运行时状态**(netsh/netstat/tasklist 三路现读,全是原生命令行工具 —— PowerShell 在守护身份下冷启动超时会把三格洗成永久未判定),不读任何仓库内容 ⇒
 * 没有 HEAD/索引/--staged 档,也不出现 readFileSync + resolve(ROOT…) 组合;输入取不到时
 * 一律落到对应维的 unjudged,不回落、不猜。
 */
import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const REMOTE_TUNNEL_PORTS = [7843, 7844]
// 为什么用 tasklist 而不是 PowerShell 取 pid(2026-10-16 实测,不是偏好问题):守护以 LocalSystem
// 身份跑,Windows PowerShell 5.1 在该身份下冷启动 >15s 会被本器采集超时杀掉 ⇒ 三格全部 unjudged、
// 这把哨永远不会喊人(现场:.workbuddy/tunnel-leg-health-last.json 的 failedCollectSources =
// "powershell(命令超时(15000ms)被杀)")。tasklist 是原生命令行工具,亚秒级,且不依赖控制台代码页
// 与区域(SYSTEM=en-US / Administrator=zh-CN 两档身份的外部程序输出语言不同 —— 解析这类输出的格
// 必须只认 ASCII 字段,同一条教训今天已在别处咬过两次)。
const TASKLIST = 'C:/Windows/System32/tasklist.exe'
// 事件日志走 wevtutil 而不是 Get-WinEvent:后者要拉起 PowerShell,而 PowerShell 在守护身份下冷启动
// 会被本器采集超时杀掉(2026-10-16 实测:`powershell(命令超时(15000ms)被杀)`)。wevtutil 是原生命令,
// `/f:XML` 输出与区域无关(Level 是数字、TimeCreated 是 ISO、cloudflared 的正文恒英文)——
// `/f:CSV` 与 `/f:RD` 在本机实测直接报「选项 f 的值无效」,别改回去。
const WEVTUTIL = 'C:/Windows/System32/wevtutil.exe'
const SPAWN_TIMEOUT_MS = 15000
const TASKLIST_TIMEOUT_MS = 10_000
// 重启账的量纲依据(全部现读,非拍的):14 天内 provider=Cloudflared 共 21 条、**全为 Level 4(信息)**,
// 归类为 starting 7 / arguments 7 / stopped 3 / terminated-without-error 3 / graceful-shutdown 1。
// 而 10-15 出现过「两次 starting 相隔 21 秒」两回(13:23:39→13:24:00、14:18:39→14:19:00)——
// 那是崩溃循环的签名,基线 ≈0.5 次/天,所以双启窗口取 90s(21s 的 4 倍余量),24h 报数线取 4 次(≈8 倍基线)。
const RESTART_EVENT_WINDOW_MS = 24 * 60 * 60 * 1000
const DOUBLE_START_SKEW_MS = 90_000
const STARTS_WARN_24H = 4

function runCapture(cmd, args, timeoutMs = SPAWN_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, encoding: 'buffer', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const killed = Boolean(err && err.killed)
        resolve({
          ok: !err,
          err: err ? (killed ? `命令超时(${timeoutMs}ms)被杀` : err.message) : null,
          killed,
          stdout: toText(stdout),
          stderr: toText(stderr),
        })
      }
    )
  })
}

function toText(buf) {
  if (!buf) return ''
  // 码页是机器事实,不假设:先按 UTF-8 严格解(本窗实测 netsh 已是 UTF-8 输出),
  // 解不动才回落 GBK;两把尺子都不行才软解 UTF-8(至少保住 ASCII 寿命字段)。
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {}
  try {
    return new TextDecoder('gbk').decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

export function normalizeAddr(raw) {
  let v = String(raw).trim().toLowerCase()
  v = v.replace(/^\[/, '').replace(/\]$/, '')
  v = v.replace(/%\d+$/, '')
  return v
}

const IPV6_SHAPE = /^[0-9a-f]*(?::[0-9a-f:.]*)+$/

export function parseNetshAddresses(text) {
  const out = new Map()
  if (typeof text !== 'string' || text.length === 0) return out
  for (const line of text.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/)
    if (cols.length !== 5) continue
    const addr = cols[4]
    const addrKey = normalizeAddr(addr)
    if (!IPV6_SHAPE.test(addrKey)) continue
    out.set(addrKey, {
      kind: cols[0],
      state: cols[1],
      validLifetime: cols[2],
      preferredLifetime: cols[3],
    })
  }
  return out
}

export function isDeprecatedRecord(rec) {
  if (!rec) return false
  if (String(rec.preferredLifetime).trim().toLowerCase() === '0s') return true
  return /反对|deprecated/i.test(String(rec.state || ''))
}

export function parseNetstatLegs(text, pids, ports = REMOTE_TUNNEL_PORTS) {
  const legs = []
  const unparseableTcp = []
  if (typeof text !== 'string' || text.length === 0) return { legs, unparseableTcp }
  const pidSet = new Set((pids || []).map(String))
  if (pidSet.size === 0) return { legs, unparseableTcp }
  for (const line of text.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 5 || cols[0].toUpperCase() !== 'TCP') continue
    const pid = cols[cols.length - 1]
    if (!pidSet.has(pid)) continue
    if (cols[3].toUpperCase() !== 'ESTABLISHED') continue
    const local = cols[1]
    const remote = cols[2]
    const lm = /^(.*):(\d+)$/.exec(local)
    const rm = /^(.*):(\d+)$/.exec(remote)
    if (!lm || !rm) {
      unparseableTcp.push(line.trim())
      continue
    }
    const rport = Number(rm[2])
    if (!ports.includes(rport)) continue
    legs.push({
      source: normalizeAddr(lm[1]),
      sourcePort: Number(lm[2]),
      dest: normalizeAddr(rm[1]),
      destPort: rport,
    })
  }
  return { legs, unparseableTcp }
}

/**
 * 第五维的取材点:cloudflared 自带 metrics 端点在本机回环上 LISTENING(实测 127.0.0.1:20241,
 * 端口**每次启动可能变** ⇒ 一律从 netstat 里按 pid 现读,绝不硬编码)。
 * 只认本 pid 的 LISTENING + 回环地址,避免把别的服务的端口当成隧道的。
 */
export function parseMetricsListenPort(text, pids) {
  const pidSet = new Set((pids || []).map(String))
  if (pidSet.size === 0) return null
  for (const line of String(text || '').split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 5 || cols[0].toUpperCase() !== 'TCP') continue
    if (!pidSet.has(cols[cols.length - 1])) continue
    if (cols[3].toUpperCase() !== 'LISTENING') continue
    const m = /^\[?([^\]:]+)\]?:(\d+)$/.exec(cols[1])
    if (!m) continue
    const host = m[1]
    if (host === '127.0.0.1' || host === '::1') return Number(m[2])
  }
  return null
}

/**
 * metrics 文本 → 隧道腿落点。value=1 = 当前在用,value=0 = 上一次的落点(换 PoP 的痕迹)。
 * 解析不出任何一条 ⇒ 交给上层判"落点不可测"(把"读不出"说成"落点近"是本仓禁止的那一型)。
 */
export function parseServerLocations(text) {
  const current = []
  const previous = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^cloudflared_tunnel_server_locations\{connection_id="[^"]+",edge_location="([^"]+)"\}\s+(\d+)/.exec(line.trim())
    if (!m) continue
    ;(m[2] === '1' ? current : previous).push(m[1])
  }
  return { current: [...new Set(current)], previous: [...new Set(previous)] }
}

/**
 * 亚太近端 PoP 前缀表(IATA 三字码)。为什么只认这张表而不拍 RTT 阈值:本机在国内、
 * Cloudflare 无大陆 PoP ⇒ 落点在境外是**常态**,拿 RTT 阈值判红就是 §12e 的恒红门;
 * 而"落点是不是在亚太"是地理事实,可直接从 metrics 读,不随抖动漂移。
 */
const APAC_POP_PREFIXES = ['nrt', 'kix', 'itm', 'ngo', 'fuk', 'icn', 'sin', 'hkg', 'tpe', 'khh', 'bkk', 'cgk', 'mnl', 'syd', 'mel', 'akl', 'blr', 'bom', 'del', 'maa']

export function classifyEdgeLocations(pops) {
  const list = (Array.isArray(pops) ? pops : []).filter(Boolean).map(String)
  if (list.length === 0) return { pops: [], near: [], far: [] }
  const near = list.filter((p) => APAC_POP_PREFIXES.includes((/^([a-z]+)/.exec(p) || [])[1]))
  const far = list.filter((p) => !near.includes(p))
  return { pops: list, near, far }
}

/**
 * tasklist 的 CSV 行 → pid 列表。只认映像名逐字等于 cloudflared.exe 的行。
 * 为什么按列取而不是"抓任意数字":CSV 的内存列本身带千分位逗号("39,780 K"),
 * 全局抓数字会把无关数字当成 pid。提示行(INFO: No tasks…)⇒ 空集 = 进程不在。
 */
export function parseTasklistPids(stdout) {
  const out = []
  for (const raw of String(stdout || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith('"')) continue
    const cols = line.split('","').map((c, i, arr) => (i === 0 ? c.slice(1) : i === arr.length - 1 ? c.slice(0, -1) : c))
    if (String(cols[0] || '').toLowerCase() !== 'cloudflared.exe') continue
    const pid = String(cols[1] || '').trim()
    if (/^\d+$/.test(pid)) out.push(pid)
  }
  return [...new Set(out)]
}

/**
 * wevtutil `/f:XML` 的拼接输出 → 事件数组。只取三样:Level(数字)、SystemTime、`EventData/Data` 正文。
 * 解析不出任何一条 ⇒ 交给上层判"采集失败"(把"读不出来"说成"没有事件"是本仓禁止的那一型)。
 */
export function parseEventLogXml(text) {
  const out = []
  for (const m of String(text || '').matchAll(/<Event\b[\s\S]*?<\/Event>/g)) {
    const level = Number(/<Level>(\d+)<\/Level>/.exec(m[0])?.[1])
    const timeRaw = /<TimeCreated\s+SystemTime='([^']+)'/.exec(m[0])?.[1] || /<TimeCreated\s+SystemTime="([^"]+)"/.exec(m[0])?.[1]
    const msg = (Array.from(m[0].matchAll(/<Data>([\s\S]*?)<\/Data>/g)).map((x) => x[1]).join(' ').trim().slice(0, 200)) || ''
    const timeMs = Date.parse(String(timeRaw || ''))
    if (!Number.isFinite(level) || !Number.isFinite(timeMs)) continue
    out.push({ level, timeMs, msg: msg.replace(/\s+/g, ' ') })
  }
  return out
}

/** 重启账:starting 序列 + 双启间隔 + 非信息级事件数。只算事实,不下结论(结论在 judge 里)。 */
export function summarizeRestarts(events, opt = {}) {
  const skew = opt.doubleStartSkewMs ?? DOUBLE_START_SKEW_MS
  const list = Array.isArray(events) ? events.slice() : []
  const starts = list.filter((e) => /^Cloudflared service starting/i.test(e.msg)).map((e) => e.timeMs).sort((a, b) => a - b)
  const stops = list.filter((e) => /^Cloudflared service stopped/i.test(e.msg)).length
  const graceful = list.filter((e) => /graceful shutdown/i.test(e.msg)).length
  const nonInfo = list.filter((e) => e.level !== 4)
  let minGapMs = null
  for (let i = 1; i < starts.length; i += 1) {
    const gap = starts[i] - starts[i - 1]
    if (minGapMs === null || gap < minGapMs) minGapMs = gap
  }
  return { total: list.length, starts: starts.length, stops, graceful, nonInfo: nonInfo.length, minStartGapMs: minGapMs, doubleStart: minGapMs !== null && minGapMs < skew }
}

/**
 * 核心判定:输入是采集层给出的原始事实(或测试夹具),输出每维独立结论。
 * processProbe: 'ok'(拿到 pid 列表) | 'failed'(探测本身失败 ⇒ 进程存在性未知)
 * netshProbe / netstatProbe: 'ok' | 'failed'
 */
export function judge({ processProbe, pids, netshProbe, netstatProbe, legs, addresses, eventsProbe = 'absent', restarts = null, metricsProbe = 'absent', locations = null }) {
  const dims = {}
  const processPresent = processProbe === 'ok' ? pids.length > 0 : null

  if (processProbe !== 'ok') {
    dims['leg-count'] = { verdict: 'unjudged', reason: 'tasklist 取 pid 失败,进程存在性未知' }
  } else if (processPresent === false) {
    dims['leg-count'] = { verdict: 'unjudged', reason: 'cloudflared 进程不存在 —— 本尺子不判定"服务本该在跑",0 条腿不能记成断流' }
  } else if (netstatProbe !== 'ok') {
    dims['leg-count'] = { verdict: 'unjudged', reason: 'netstat 采集失败,腿数不可测' }
  } else if (legs.length === 0) {
    dims['leg-count'] = { verdict: 'breach', reason: `进程在(pid=${pids.join(',')})而 7843/7844 上 ESTABLISHED 腿数 = 0 —— 隧道断了` }
  } else {
    dims['leg-count'] = { verdict: 'ok', reading: { legs: legs.length, pids } }
  }

  // 第四维:重启账(事件日志 provider=Cloudflared 的生命周期)。为什么值得单立:
  // 15:40 那次重启实测留下约 3 分钟入口中断(监控 15:41 现读到 530),而 10-15 的"21 秒内两次 starting"
  // 是崩溃循环签名 —— 这两件事当时都没有任何一门能提前说。
  if (eventsProbe === 'absent') {
    // 调用方没采这一路(旧夹具/第三方调用)⇒ 整维不产出,不得凭空多出一格 unjudged 把退出码拖成 3
  } else if (eventsProbe === 'failed') {
    dims['restart-churn'] = { verdict: 'unjudged', reason: 'wevtutil 取事件失败,重启账未知(不是「没有重启」)' }
  } else if (!restarts) {
    dims['restart-churn'] = { verdict: 'unjudged', reason: '没有可用的重启账统计 ⇒ 该维不判定' }
  } else if (restarts.total === 0) {
    // 真 0 与「读不出」必须分家:24h 内一条生命周期事件都没有 = 服务没动过(已判定的好态)。
    dims['restart-churn'] = { verdict: 'ok', reading: { starts: 0, stops: 0, note: '24h 内 0 条 Cloudflared 事件(已判定的真 0)' } }
  } else if (restarts.doubleStart) {
    dims['restart-churn'] = { verdict: 'breach', reason: `24h 内两次 service starting 相隔 ${Math.round((restarts.minStartGapMs || 0) / 1000)}s(双启窗口上限 ${Math.round(DOUBLE_START_SKEW_MS / 1000)}s)= 崩溃循环签名;starting=${restarts.starts} stopped=${restarts.stops}`, reading: restarts }
  } else if (restarts.nonInfo > 0) {
    dims['restart-churn'] = { verdict: 'breach', reason: `事件日志里出现 ${restarts.nonInfo} 条非信息级(Level≠4)Cloudflared 事件`, reading: restarts }
  } else if (restarts.starts >= STARTS_WARN_24H) {
    dims['restart-churn'] = {
      verdict: 'warn',
      reason: `24h 内 starting ${restarts.starts} 次(基线 14 天 7 次 ≈0.5/天)—— 抖动但在允许范围内,只报数`,
      reading: restarts,
    }
  } else {
    dims['restart-churn'] = { verdict: 'ok', reading: { starts: restarts.starts, stops: restarts.stops, minStartGapMs: restarts.minStartGapMs } }
  }

  const sources = [...new Set(legs.map((l) => l.source))]
  const legsKnown = processProbe === 'ok' && pids.length > 0 && netstatProbe === 'ok' && legs.length > 0

  if (!legsKnown) {
    dims['deprecated-source'] = {
      verdict: 'unjudged',
      reason: dims['leg-count'].verdict === 'breach' ? '无腿可查在用源地址(腿已全断)' : '没有可判的在用腿,源地址枚举为 0 ⇒ 不记绿',
    }
  } else if (netshProbe !== 'ok') {
    dims['deprecated-source'] = { verdict: 'unjudged', reason: 'netsh 采集失败,源地址寿命表取不到' }
  } else {
    const deprecated = sources.filter((s) => isDeprecatedRecord(addresses.get(s)))
    const missing = sources.filter((s) => !addresses.has(s))
    if (deprecated.length > 0) {
      const amplifying = sources.length === 1 && legs.length >= 2
      dims['deprecated-source'] = {
        verdict: 'breach',
        reason:
          `在用源地址已退化:${deprecated.map((s) => `${s}(首选寿命 ${addresses.get(s).preferredLifetime},状态 ${addresses.get(s).state})`).join('; ')}` +
          (amplifying ? ' —— 且全部腿吊在这一个源地址上,退化即 4 腿同断的乘数(放大因子)' : ''),
        reading: { deprecated },
      }
    } else if (missing.length > 0) {
      dims['deprecated-source'] = { verdict: 'unjudged', reason: `腿的源地址在 netsh 地址表里查不到,无法判退化:${missing.join(', ')}` }
    } else {
      dims['deprecated-source'] = {
        verdict: 'ok',
        reading: { sources: sources.map((s) => ({ addr: s, preferredLifetime: addresses.get(s).preferredLifetime, state: addresses.get(s).state })) },
      }
    }
  }

  if (!legsKnown) {
    dims['single-source-point'] = { verdict: 'unjudged', reason: '腿数不足以评估单点(枚举 <1 条腿 ⇒ 该维不判定)' }
  } else if (legs.length >= 2 && sources.length === 1) {
    dims['single-source-point'] = { verdict: 'warn', reason: `全部 ${legs.length} 条腿共用同一源地址 ${sources[0]}(单点;健康态亦为此形态 ⇒ 只报数不判红,§12e)`, reading: { sources: 1 } }
  } else {
    dims['single-source-point'] = { verdict: 'ok', reading: { legs: legs.length, sources: sources.length } }
  }

  // 第五维:隧道腿落点 PoP(2026-10-16 立,当天实测立案)。
  // 立案事实:公网入口 TTFB 1.3s~16.4s、约一半请求 25s 超时,而 127.0.0.1:8801 同轮 3~17ms;
  // 上行仅 198KB/s(非拥塞)、ICMP 0 丢包、MTU 1500 通、重启 Cloudflared 后 4 分钟依旧 ⇒
  // 慢不在服务、也不在隧道进程,而在"本机 ↔ CF 边缘"这条跨境段(实测到 1.1.1.1 RTT ≈300ms、
  // 到站点 IP ≈700ms、对照阿里 DNS 19ms,TCP 重传率 27%,4 条腿全落 lax05/09/12/13)。
  // 这一维**只报数不判红**:本机在国内而 CF 无大陆 PoP ⇒ 落点在境外是常态,判红即恒红门(§12e)。
  // 它的价值是把"入口慢"的归因钉死在跨境段,让收信人不用再去查 web/api。
  if (metricsProbe === 'absent') {
    // 调用方没采这一路(旧夹具/第三方调用)⇒ 整维不产出,不得凭空多出一格 unjudged 把退出码拖成 3
  } else if (metricsProbe === 'failed') {
    dims['edge-location'] = { verdict: 'unjudged', reason: 'cloudflared metrics 端点取不到(netstat 未枚举到本 pid 的回环监听端口,或 HTTP 失败)⇒ 落点不可测' }
  } else if (!locations || locations.pops.length === 0) {
    dims['edge-location'] = { verdict: 'unjudged', reason: 'metrics 里没有 server_locations 读数 ⇒ 落点不判定(不得记成"近")' }
  } else if (locations.near.length === 0) {
    dims['edge-location'] = {
      verdict: 'warn',
      reason:
        `隧道 ${locations.pops.length} 条腿全部落在非亚太 PoP(${locations.pops.join('/')})—— 本机在国内而 CF 无大陆 PoP,这是常态形态 ⇒ 只报数不判红(§12e);` +
        '入口慢时先归因**跨境段**(RTT/丢包),别去查 web/api(本地对照通常 <20ms);真要动只有两条路:换出口(代理/中转机)或提高边缘缓存命中率以减少回源',
      reading: locations,
    }
  } else {
    dims['edge-location'] = { verdict: 'ok', reading: locations }
  }

  return dims
}

/** 阳性对照:"已知坏"夹具必须被判 deprecated-source=breach,否则判据无牙。 */
export function positiveControl() {
  const addresses = new Map([['2408::bad', { kind: '临时', state: '反对', validLifetime: '2d', preferredLifetime: '0s' }]])
  const dims = judge({
    processProbe: 'ok',
    pids: ['999'],
    netshProbe: 'ok',
    netstatProbe: 'ok',
    legs: [
      { source: '2408::bad', sourcePort: 1, dest: '2606::1', destPort: 7844 },
      { source: '2408::bad', sourcePort: 2, dest: '2606::2', destPort: 7844 },
    ],
    addresses,
  })
  return {
    passed: dims['deprecated-source'].verdict === 'breach' && dims['leg-count'].verdict === 'ok',
    dims,
  }
}

export function decideExit(dims, controlPassed) {
  const verdicts = Object.values(dims).map((d) => d.verdict)
  if (!controlPassed) return 3
  if (verdicts.includes('breach')) return 1
  if (verdicts.includes('unjudged')) return 3
  return 0
}

async function collect() {
  const [ps, netsh, netstat, ev] = await Promise.all([
    runCapture(TASKLIST, ['/NH', '/FO', 'CSV', '/FI', 'IMAGENAME eq cloudflared.exe'], TASKLIST_TIMEOUT_MS),
    runCapture('netsh', ['interface', 'ipv6', 'show', 'addresses']),
    runCapture('netstat', ['-ano']),
    runCapture(WEVTUTIL, ['qe', 'Application', `/q:*[System[Provider[@Name=\'Cloudflared\'] and TimeCreated[timediff(@SystemTime) <= ${RESTART_EVENT_WINDOW_MS}]]]`, '/f:XML', '/c:200'], SPAWN_TIMEOUT_MS),
  ])
  const processProbe = ps.ok && !ps.killed ? 'ok' : 'failed'
  const pids = processProbe === 'ok' ? parseTasklistPids(ps.stdout) : []
  const netshProbe = netsh.ok && !netsh.killed ? 'ok' : 'failed'
  const netstatProbe = netstat.ok && !netstat.killed ? 'ok' : 'failed'
  const events = parseEventLogXml(ev.stdout || '')
  const eventsProbe = ev.ok && !ev.killed && events.length > 0 ? 'ok' : events.length === 0 && ev.ok && !ev.killed ? 'empty' : 'failed'
  const restarts = eventsProbe === 'failed' ? null : summarizeRestarts(events)
  const addresses = netshProbe === 'ok' ? parseNetshAddresses(netsh.stdout) : new Map()
  const { legs, unparseableTcp } = netstatProbe === 'ok' ? parseNetstatLegs(netstat.stdout, pids) : { legs: [], unparseableTcp: [] }
  // 第五维取材:端口现读(不硬编码),HTTP 只给 5 秒,取不到就如实记 failed(不折成"落点近")。
  const metricsPort = netstatProbe === 'ok' ? parseMetricsListenPort(netstat.stdout, pids) : null
  let metricsProbe = 'failed'
  let locations = null
  if (metricsPort !== null) {
    try {
      const res = await fetch(`http://127.0.0.1:${metricsPort}/metrics`, { signal: AbortSignal.timeout(5000) })
      locations = classifyEdgeLocations(parseServerLocations(await res.text()).current)
      metricsProbe = 'ok'
    } catch {
      metricsProbe = 'failed'
    }
  }
  const failedNames = [
    processProbe === 'failed' ? `tasklist(${ps.err || '无输出'})` : null,
    netshProbe === 'failed' ? `netsh(${netsh.err || '输出异常'})` : null,
    netstatProbe === 'failed' ? `netstat(${netstat.err || '输出异常'})` : null,
    eventsProbe === 'failed' ? `wevtutil(${ev.err || '输出异常或解析不出事件'})` : null,
    metricsProbe === 'failed' ? `cloudflared-metrics(${metricsPort === null ? '未枚举到本 pid 的回环监听端口' : 'HTTP 失败或超时'})` : null,
  ].filter(Boolean)
  return { processProbe, pids, netshProbe, netstatProbe, eventsProbe, restarts, eventTotal: events.length, legs, addresses, unparseableTcp, metricsProbe, locations, metricsPort, failedNames, evidenceAt: new Date().toISOString() }
}

function formatHuman(dims, exitCode, evidenceAt, extra) {
  const lines = [`隧道腿健康(只读)取证时刻 ${evidenceAt}`]
  for (const [name, d] of Object.entries(dims)) {
    const mark = d.verdict === 'ok' ? 'OK' : d.verdict === 'breach' ? 'BREACH' : d.verdict === 'warn' ? 'WARN' : 'UNJUDGED'
    let detail = d.reason || ''
    if (d.reading) detail += (detail ? ' ' : '') + JSON.stringify(d.reading)
    lines.push(`  [${mark}] ${name}${detail ? ': ' + detail : ''}`)
  }
  if (extra && extra.failedNames && extra.failedNames.length > 0) lines.push(`  采集失败源: ${extra.failedNames.join(', ')}`)
  if (extra && extra.unparseableTcp && extra.unparseableTcp.length > 0) lines.push(`  解析不了的本 pid TCP 行: ${extra.unparseableTcp.length} 条`)
  lines.push(`  结论 exit=${exitCode}`)
  return lines.join('\n')
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const known = ['--json']
  const unknown = argv.filter((a) => a.startsWith('-') && !known.includes(a))
  if (unknown.length > 0) {
    console.error(`用法错:未识别参数 ${unknown.join(' ')}(可用:--json / --self-test)`)
    process.exitCode = 2
    return
  }
  let collected
  try {
    collected = await collect()
  } catch (e) {
    console.error(`本器自身异常: ${e && e.message}`)
    process.exitCode = 2
    return
  }
  const dims = judge(collected)
  const control = positiveControl()
  const exitCode = decideExit(dims, control.passed)
  if (!control.passed) dims['positive-control'] = { verdict: 'unjudged', reason: '阳性对照不命中 ⇒ 判据无牙,整轮降未判定' }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify({
        tool: 'check-tunnel-leg-health',
        exitCode,
        evidenceAt: collected.evidenceAt,
        pids: collected.pids,
        legs: collected.legs.length,
        metricsPort: collected.metricsPort ?? null,
        edgeLocations: collected.locations ?? null,
        failedCollectSources: collected.failedNames,
        positiveControl: control.passed ? 'pass' : 'FAIL',
        dims,
      })
    )
  } else {
    console.log(formatHuman(dims, exitCode, collected.evidenceAt, collected))
  }
  process.exitCode = exitCode
}

function selfTest() {
  let pass = 0
  let total = 0
  const t = (name, fn) => {
    total += 1
    try {
      fn()
      pass += 1
    } catch (e) {
      console.log(`  ✗ ${name}: ${e && e.message}`)
    }
  }
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg || ''} 期望 ${b} 实得 ${a}`)
  }
  // 报数格也必须答得出"收信人能干什么"(§5e-1),否则就是只会喊、不会指路的噪声。
  const assertWarnHasExit = (reason) => {
    const s = String(reason || '')
    if (!/跨境段/.test(s)) throw new Error('落点报数必须点名归因是跨境段')
    if (!/换出口/.test(s) || !/提高边缘缓存/.test(s)) throw new Error('落点报数必须给出可动手的两条路')
  }
  const addrText = [
    '地址类型   DAD 状态    有效寿命   首选寿命   地址',
    '临时         首选项         2d10h28m5s   22h10m2s 2408:8234::60a3',
    '临时         反对          2d10h28m5s         0s 2408:8234::bb3',
    '公用         首选项         2d10h28m5s 1d10h28m5s 2408:8234::6d2b',
    '其他         首选项           infinite   infinite ::1',
    '---------  ----------- ---------- ---------- ----',
  ].join('\n')
  t('netsh 解析:表头/分隔行被拒,4 条地址收下', () => {
    eq(parseNetshAddresses(addrText).size, 4, '地址数')
  })
  t('netsh 解析:0s 与 反对 都判 deprecated(正/反)', () => {
    const m = parseNetshAddresses(addrText)
    eq(isDeprecatedRecord(m.get('2408:8234::bb3')), true, '0s 枚')
    eq(isDeprecatedRecord(m.get('2408:8234::60a3')), false, '健康枚')
    eq(isDeprecatedRecord(m.get('2408:8234::6d2b')), false, '公用枚')
  })
  const nsText = [
    '  TCP    127.0.0.1:20241        0.0.0.0:0              LISTENING       1484',
    '  TCP    [::1]:51730            [::1]:22               ESTABLISHED     1484',
    '  TCP    [2408:8234::60a3]:49167  [2606:4700:a0::6]:7844  ESTABLISHED     1484',
    '  TCP    [2408:8234::60a3]:49175  [2606:4700:a8::10]:7844  ESTABLISHED     1484',
    '  TCP    [2408:8234::60a3]:49177  [2606:4700:a0::1]:7843  ESTABLISHED     9999',
    '  UDP    0.0.0.0:53             *:*                                    1484',
  ].join('\n')
  t('netstat 解析:只收本 pid + 7843/7844 + ESTABLISHED', () => {
    const { legs } = parseNetstatLegs(nsText, ['1484'])
    eq(legs.length, 2, '腿数')
    eq(legs[0].source, '2408:8234::60a3', '方括号剥净')
  })
  t('leg-count:进程在而无腿 = breach;进程不在 = unjudged(不并桶)', () => {
    const d1 = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [], addresses: new Map() })
    eq(d1['leg-count'].verdict, 'breach', '无腿')
    const d2 = judge({ processProbe: 'ok', pids: [], netshProbe: 'ok', netstatProbe: 'ok', legs: [], addresses: new Map() })
    eq(d2['leg-count'].verdict, 'unjudged', '进程缺席')
    const d3 = judge({ processProbe: 'failed', pids: [], netshProbe: 'failed', netstatProbe: 'failed', legs: [], addresses: new Map() })
    eq(d3['leg-count'].verdict, 'unjudged', '探测失败')
  })
  t('deprecated:在用源 0s ⇒ breach;健康 ⇒ ok;查不到 ⇒ unjudged(点名)', () => {
    const addresses = parseNetshAddresses(addrText)
    const mk = (src) => judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: src, sourcePort: 5, dest: '2606::1', destPort: 7844 }], addresses })
    eq(mk('2408:8234::bb3')['deprecated-source'].verdict, 'breach', '0s 源')
    eq(mk('2408:8234::60a3')['deprecated-source'].verdict, 'ok', '健康源')
    eq(mk('2408:dead::beef')['deprecated-source'].verdict, 'unjudged', '查无此源')
  })
  t('单点:≥2 腿同源 = warn(不是 breach);双源 = ok;0 腿 = unjudged', () => {
    const addresses = parseNetshAddresses(addrText)
    const one = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }, { source: '2408:8234::60a3', sourcePort: 2, dest: '::', destPort: 7844 }], addresses })
    eq(one['single-source-point'].verdict, 'warn', '同源')
    const two = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }, { source: '2408:8234::6d2b', sourcePort: 2, dest: '::', destPort: 7844 }], addresses })
    eq(two['single-source-point'].verdict, 'ok', '双源')
  })
  t('netsh 采集失败时 deprecated 维 unjudged,不拿 leg-count 的绿顶账', () => {
    const d = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'failed', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses: new Map() })
    eq(d['deprecated-source'].verdict, 'unjudged', 'netsh 挂')
    eq(d['leg-count'].verdict, 'ok', '腿数维不受累')
  })
  t('阳性对照夹具必须 breach(摘掉 deprecated 支即翻红的形状锁)', () => {
    eq(positiveControl().passed, true, '对照')
  })
  t('退出码映射:breach=1 / 仅warn=0 / 未判定=3 / 对照失手=3', () => {
    const addresses = parseNetshAddresses(addrText)
    const breach = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::bb3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses })
    eq(decideExit(breach, true), 1, 'breach')
    const warn = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }, { source: '2408:8234::60a3', sourcePort: 2, dest: '::', destPort: 7844 }], addresses })
    eq(decideExit(warn, true), 0, '仅 warn')
    const unj = judge({ processProbe: 'failed', pids: [], netshProbe: 'failed', netstatProbe: 'failed', legs: [], addresses: new Map() })
    eq(decideExit(unj, true), 3, '全未判定')
    eq(decideExit(warn, false), 3, '对照失手')
  })
  const metricsText = [
    '# HELP cloudflared_tunnel_server_locations Where each tunnel is connected to.',
    'cloudflared_tunnel_server_locations{connection_id="0",edge_location="lax09"} 1',
    'cloudflared_tunnel_server_locations{connection_id="0",edge_location="lax12"} 0',
    'cloudflared_tunnel_server_locations{connection_id="1",edge_location="lax13"} 1',
    'cloudflared_tunnel_server_locations{connection_id="2",edge_location="lax05"} 1',
  ].join('\n')
  t('metrics 端口:只认本 pid 的回环 LISTENING,别的服务端口不许被当成隧道的', () => {
    eq(parseMetricsListenPort(nsText, ['1484']), 20241, '回环 LISTENING')
    eq(parseMetricsListenPort('  TCP    192.168.1.37:5000     0.0.0.0:0   LISTENING   1484', ['1484']), null, '非回环不认')
    eq(parseMetricsListenPort(nsText, ['777']), null, '别的 pid 不认')
  })
  t('server_locations:只收 value=1 的当前落点,0 归到 previous(换 PoP 的痕迹)', () => {
    const r = parseServerLocations(metricsText)
    eq(r.current.length, 3, '当前落点数')
    eq(r.previous.length, 1, '上一次落点')
    eq(parseServerLocations('').current.length, 0, '空文本 ⇒ 0(不是"近")')
  })
  t('落点分档:全在非亚太 ⇒ near 空;含亚太 ⇒ near 非空', () => {
    eq(classifyEdgeLocations(['lax09', 'lax13']).near.length, 0, 'lax 不在亚太表')
    eq(classifyEdgeLocations(['nrt01', 'hkg02']).near.length, 2, 'nrt/hkg 在亚太表')
    eq(classifyEdgeLocations([]).pops.length, 0, '空 ⇒ 空(交给上层判不可测)')
  })
  t('edge-location:全落境外只报数不判红(§12e,常态形态判红即恒红);取不到 ⇒ unjudged 点名', () => {
    const far = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses: parseNetshAddresses(addrText), metricsProbe: 'ok', locations: classifyEdgeLocations(['lax09', 'lax13']) })
    eq(far['edge-location'].verdict, 'warn', '境外落点')
    assertWarnHasExit(far['edge-location'].reason)
    const nearP = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses: parseNetshAddresses(addrText), metricsProbe: 'ok', locations: classifyEdgeLocations(['nrt01']) })
    eq(nearP['edge-location'].verdict, 'ok', '亚太落点')
    const failed = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses: parseNetshAddresses(addrText), metricsProbe: 'failed' })
    eq(failed['edge-location'].verdict, 'unjudged', 'metrics 取不到')
    eq(/落点不可测/.test(String(failed['edge-location'].reason)), true, 'unjudged 必须点名,不得折成"近"')
    const empty = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses: parseNetshAddresses(addrText), metricsProbe: 'ok', locations: classifyEdgeLocations([]) })
    eq(empty['edge-location'].verdict, 'unjudged', '无 server_locations 读数')
    const absent = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses: parseNetshAddresses(addrText) })
    eq(absent['edge-location'], undefined, '调用方没采这一路 ⇒ 不得凭空多一格 unjudged 拖 exit 3')
  })
  t('解析失败形态:空文本/乱表头 ⇒ 枚举 0 地址/0 腿,配合 judge 落 unjudged', () => {
    eq(parseNetshAddresses('').size, 0, '空')
    eq(parseNetshAddresses('nothing useful').size, 0, '无地址形态')
    eq(parseNetstatLegs('', ['1']).legs.length, 0, '空 netstat')
    eq(parseTasklistPids('"cloudflared.exe","42","Console","1","39,780 K"').join(), '42', 'CSV 第二列才是 pid(内存列带千分位逗号,不许乱抓数字)')
    eq(parseTasklistPids('INFO: No tasks are running which match the specified criteria.').join(), '', '无匹配 ⇒ 空集(进程不在),不吃提示行')
    eq(parseTasklistPids('"notepad.exe","7","Console","1","1,000 K"').join(), '', '别的映像名不许被算成隧道进程')
  })
  console.log(`${pass}/${total} 通过`)
  process.exitCode = pass === total ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  normalizeAddr,
  parseNetshAddresses,
  parseNetstatLegs,
  isDeprecatedRecord,
  parseTasklistPids,
  parseMetricsListenPort,
  parseServerLocations,
  classifyEdgeLocations,
  APAC_POP_PREFIXES,
  parseEventLogXml,
  summarizeRestarts,
  judge,
  positiveControl,
  decideExit,
  REMOTE_TUNNEL_PORTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
