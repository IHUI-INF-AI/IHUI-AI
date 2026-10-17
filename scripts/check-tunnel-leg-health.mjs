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
 * - 〔2026-10-17 补第二路取材〕**腿的源地址也可以是 IPv4**:现读 4 条腿 = 1 条 v4 源 `192.168.1.37` +
 *   3 条 v6 源,`D:\DevEnv\logs\cloudflared.log` 自述 `ICMP proxy will use 192.168.1.37 as source for IPv4`。
 *   此前这一格只查 IPv6 表 ⇒ v4 源恒"查不到"、恒 unjudged、退出码恒 3 —— 立项要防的那一型在 v4 形态下
 *   一轮都判不出来(等于没装车)。故按**地址族分流**:v6 源走 ipv6 寿命表(判据一字不改),v4 源走
 *   `netsh interface ipv4 show addresses`(该表实测**没有**寿命/退化字段 ⇒ 在册即健康;
 *   **两表皆无**且两路采集都成功 ⇒ breach:在用源地址已不在任何接口上,腿随时整组断)。
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
 * 本器判的是**机器运行时状态**(netsh 地址表(ipv6 寿命表 + ipv4 地址表)/netstat/tasklist 多路现读,全是原生命令行工具 —— PowerShell 在守护身份下冷启动超时会把三格洗成永久未判定),不读任何仓库内容 ⇒
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
// "还在抖"与"窗口里抖过、早就停了"的分界,同样取现读量纲:崩溃循环期间 SCM 每 ~20 秒重启一次
// (2026-10-17 02:26:56→02:32:48 实测 15 起 15 停,间隔恒为 20–40s),而守护派发本尺子的节律是 15 分钟
// (`git-guardian.mjs` 的 `TUNNEL_LEG_INTERVAL_MS` 默认值)。还在抖 ⇒ 最新一条生命周期事件必落在最近一个
// tick 之内;超过 15 分钟没有新事件 ⇒ 循环已停。这一格不分家就会把"八小时前恢复"的状态量当成现行犯,
// 每 4 小时(§5e 身份去重窗)重寄一封信,而收信人拿到信能做的动作早就已经做完了。
const CHURN_LIVE_HORIZON_MS = 15 * 60 * 1000

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

/**
 * 第二路取材:`netsh interface ipv4 show addresses`(2026-10-17 立,补 IPv4 源地址的盲区)。
 *
 * 为什么这张表要单独一把尺子:它是**逐接口的键值块**,不是 ipv6 那种五行列表 —— 本机现读
 * `接口 "以太网" 的配置 / DHCP 已启用: 否 / IP 地址: 192.168.1.37 / 子网前缀: 192.168.1.0/24 (掩码 255.255.255.0)
 * / 默认网关: 192.168.1.1 / 网关跃点数: 256 / InterfaceMetric: 25`。守护身份 SYSTEM=en-US 时同一命令的
 * 表头是英文(`IP address` / `Subnet prefix` / `Default gateway`),Administrator=zh-CN 时是中文 ⇒
 * **解析只认 ASCII 形状**:两档身份的"IP 地址"行都以 ASCII 的 `IP` 起头(中文只译了"地址"两字),
 * 而其它带四段点分数字的行(子网前缀/默认网关/掩码括号)都不以 `IP` 起头 ⇒ 中文表头一律不吃,
 * 也不许去匹配"地址/address"这类会随身份换词的文案。
 *
 * 该表实测**没有**寿命/退化字段 ⇒ 在册即健康;`state` 只从行尾括号里捡 ASCII 退化词(为"存在且状态非
 * deprecated"这一条留的口子,当前本机读不到 ⇒ 恒空,不影响在册判 ok)。
 */
const IPV4_LINE_SHAPE = /^IP(?![A-Za-z0-9])[^\r\n]*:/
const IPV4_QUAD_SHAPE = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/

export function isIPv4AddressText(v) {
  const m = IPV4_QUAD_SHAPE.exec(String(v).trim())
  if (!m || m[1] !== String(v).trim()) return false
  return m[1].split('.').every((o) => Number(o) <= 255)
}

export function parseNetshV4Addresses(text) {
  const out = new Map()
  if (typeof text !== 'string' || text.length === 0) return out
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!IPV4_LINE_SHAPE.test(line)) continue
    const after = line.slice(line.indexOf(':') + 1)
    const m = IPV4_QUAD_SHAPE.exec(after)
    if (!m || !isIPv4AddressText(m[1])) continue
    const paren = /\(([^()]*)\)/.exec(after.slice(m.index + m[1].length))
    out.set(m[1], { address: m[1], state: paren ? paren[1].trim() : '', line })
  }
  return out
}

export function isDeprecatedV4Record(rec) {
  if (!rec) return false
  return /deprecated|反对|弃用/i.test(String(rec.state || ''))
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
  // 最新一条 provider=Cloudflared 事件的时刻:用来分"还在抖"与"窗口里抖过但已停"。
  // 一条都取不到时刻 ⇒ null,由判定层按现行论处理(取不到 ⇒ 照拦,不放行)。
  let lastEventMs = null
  for (const e of list) {
    const ms = Number(e?.timeMs)
    if (Number.isFinite(ms) && (lastEventMs === null || ms > lastEventMs)) lastEventMs = ms
  }
  return { total: list.length, starts: starts.length, stops, graceful, nonInfo: nonInfo.length, minStartGapMs: minGapMs, lastEventMs, doubleStart: minGapMs !== null && minGapMs < skew }
}

/**
 * 源地址族分流(2026-10-17 立)。三态纪律在族内独立成立,再取最坏档合流:
 * breach > unjudged > ok —— breach 排在最坏是因为"该喊的时候不喊"才是本仓最高频失效型(§12f),
 * 而两族的读数在 reason 里始终分开点名,谁也不替谁顶账。
 */
const VERDICT_RANK = { ok: 0, warn: 1, unjudged: 2, breach: 3 }
const UNSPECIFIED_V4 = new Set(['0.0.0.0'])

/**
 * v6 族:既有判据**一字未改**(取 netsh interface ipv6 show addresses 的寿命表)。
 * 返回 { verdict, reason, okNote, reading };reason 在 ok 档为 ''(只在合流文案里用 okNote)。
 */
export function judgeV6Family(v6Sources, ctx) {
  if (v6Sources.length === 0) return null
  const { netshProbe, addresses } = ctx
  if (netshProbe !== 'ok') {
    return { verdict: 'unjudged', reason: 'netsh 采集失败,源地址寿命表取不到', okNote: '', reading: null }
  }
  const deprecated = v6Sources.filter((s) => isDeprecatedRecord(addresses.get(s)))
  const missing = v6Sources.filter((s) => !addresses.has(s))
  if (deprecated.length > 0) {
    return {
      verdict: 'breach',
      reason: `在用源地址已退化:${deprecated.map((s) => `${s}(首选寿命 ${addresses.get(s).preferredLifetime},状态 ${addresses.get(s).state})`).join('; ')}`,
      okNote: '',
      reading: { deprecated },
    }
  }
  if (missing.length > 0) {
    return { verdict: 'unjudged', reason: `腿的源地址在 netsh 地址表里查不到,无法判退化:${missing.join(', ')}`, okNote: '', reading: null }
  }
  return {
    verdict: 'ok',
    reason: '',
    okNote: `${v6Sources.length} 枚在册且未退化`,
    reading: { sources: v6Sources.map((s) => ({ addr: s, preferredLifetime: addresses.get(s).preferredLifetime, state: addresses.get(s).state })) },
  }
}

/**
 * v4 族逐地址判。三条结论各自都要有成对夹具:
 * - 在册且状态非退化 ⇒ ok;
 * - **两张表都查不到** ⇒ breach(在用 v4 源地址已不在任何接口上,腿随时整组断)。这一档必须
 *   netsh ipv4 与 netsh ipv6 两路采集都 ok 才允许判 —— 少任一路仍是 unjudged(§0.3:没判绝不写成判过);
 * - ipv4 那一路采集失败/未采集 ⇒ unjudged 并点名 `netsh ipv4`(绝不折成 ok,也绝不折成 breach)。
 * 未指定地址 0.0.0.0(套接字没绑具体源)单列 unjudged,不给它造出假 breach。
 */
export function classifyV4Source(src, ctx) {
  if (UNSPECIFIED_V4.has(src)) return { src, verdict: 'unjudged', note: `${src}(v4 未指定地址,套接字未绑到具体源地址 ⇒ 无法判退化,不判 breach)` }
  if (ctx.netshV4Probe !== 'ok') {
    return { src, verdict: 'unjudged', note: `${src}(netsh ipv4 ${ctx.netshV4Probe === 'failed' ? '采集失败' : '未采集'},v4 地址表取不到)` }
  }
  const rec = ctx.v4Addresses.get(src)
  if (rec) {
    return isDeprecatedV4Record(rec)
      ? { src, verdict: 'breach', note: `${src}(ipv4 地址表在册但状态为 ${rec.state})` }
      : { src, verdict: 'ok', note: `${src}(ipv4 地址表在册;该表实测无寿命/退化字段 ⇒ 在册即健康)` }
  }
  if (ctx.netshProbe !== 'ok') {
    return { src, verdict: 'unjudged', note: `${src}(ipv4 表查无,而 netsh ipv6 采集失败 ⇒ 两表未齐,不许判 breach)` }
  }
  // ipv6 地址表的形态判据要求含冒号 ⇒ v4 点分地址结构上不可能在册,"ipv4 表查无"即"两表皆无"
  return { src, verdict: 'breach', note: `${src}(在 netsh ipv4 与 ipv6 两张地址表里都查不到 ⇒ 在用 v4 源地址已不在本机任何接口上,吊在它上面的腿随时整组断)` }
}

/** v4 族合流:逐地址取最坏档。 */
export function judgeV4Family(v4Sources, ctx) {
  if (v4Sources.length === 0) return null
  const items = v4Sources.map((s) => classifyV4Source(s, ctx))
  const speak = items.filter((i) => i.verdict !== 'ok')
  const verdict = speak.length === 0 ? 'ok' : speak.reduce((a, b) => (VERDICT_RANK[b.verdict] > VERDICT_RANK[a.verdict] ? b : a)).verdict
  const reading = { sources: items.map((i) => ({ addr: i.src, verdict: i.verdict })) }
  if (verdict === 'ok') return { verdict, reason: '', okNote: `${v4Sources.length} 枚在册`, reading }
  const reason = speak.map((i) => i.note).join('; ')
  return { verdict, reason, okNote: '', reading: verdict === 'breach' ? { bad: items.filter((i) => i.verdict === 'breach').map((i) => i.src) } : null }
}

/**
 * deprecated-source 两族合流。单族时文案与分流前逐字相同(不许顺手改已有维度的文案),
 * 混合源才走"族分判 + 取最坏档",并把两族读数分开点名。
 */
function combineDeprecatedFamilyParts(parts, amplifying) {
  if (parts.length === 1) {
    const only = parts[0]
    return {
      verdict: only.verdict,
      reason: only.verdict === 'ok' ? undefined : only.reason + (only.verdict === 'breach' && amplifying ? ' —— 且全部腿吊在这一个源地址上,退化即 4 腿同断的乘数(放大因子)' : ''),
      reading: only.verdict === 'breach' || only.verdict === 'ok' ? only.reading : undefined,
    }
  }
  const worst = parts.reduce((a, b) => (VERDICT_RANK[b.verdict] > VERDICT_RANK[a.verdict] ? b : a))
  const body = parts.map((p) => `${p.family}族=${p.verdict}(${p.verdict === 'ok' ? p.okNote : p.reason})`).join(' | ')
  return {
    verdict: worst.verdict,
    reason: `混合源族分判(取最坏档)${body}${worst.verdict === 'breach' && amplifying ? ' —— 且全部腿吊在这一个源地址上,退化即 4 腿同断的乘数(放大因子)' : ''}`,
    reading: { v6: parts.find((p) => p.family === 'v6')?.reading ?? null, v4: parts.find((p) => p.family === 'v4')?.reading ?? null },
  }
}

/**
 * 核心判定:输入是采集层给出的原始事实(或测试夹具),输出每维独立结论。
 * processProbe: 'ok'(拿到 pid 列表) | 'failed'(探测本身失败 ⇒ 进程存在性未知)
 * netshProbe / netstatProbe: 'ok' | 'failed'(netshProbe = netsh interface **ipv6** 寿命表那一路)
 * netshV4Probe: 'ok' | 'failed' | 'blind'(命令成功却解析不出任何 v4 地址 ⇒ 采集失明) | 'absent'(调用方没采)
 * v4Addresses: netsh interface ipv4 show addresses 解析出的地址表
 */
export function judge({ processProbe, pids, netshProbe, netshV4Probe = 'absent', netstatProbe, legs, addresses, v4Addresses = new Map(), eventsProbe = 'absent', restarts = null, metricsProbe = 'absent', locations = null, nowMs = Date.now() }) {
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
  } else if (restarts.doubleStart || restarts.nonInfo > 0) {
    // 崩溃循环签名(双启过近 / 非信息级事件)是**现行犯**才需要喊人;同一件事在 24h 窗口里躺着的
    // 历史,循环停 8 小时后照原样每 4 小时重寄一封信 —— 那是把恢复掉的状态当报警(机主 2026-10-17
    // 就是被这样一封信叫起来的:02:33 已恢复,06:33 又寄一封)。取不到最新时刻 ⇒ 按现行论(照拦)。
    const sig = restarts.doubleStart
      ? `24h 内两次 service starting 相隔 ${Math.round((restarts.minStartGapMs || 0) / 1000)}s(双启窗口上限 ${Math.round(DOUBLE_START_SKEW_MS / 1000)}s)= 崩溃循环签名;starting=${restarts.starts} stopped=${restarts.stops}`
      : `事件日志里出现 ${restarts.nonInfo} 条非信息级(Level≠4)Cloudflared 事件`
    const lastMs = Number(restarts.lastEventMs)
    const sinceMs = Number.isFinite(lastMs) ? Number(nowMs) - lastMs : null
    if (sinceMs === null || sinceMs <= CHURN_LIVE_HORIZON_MS) {
      dims['restart-churn'] = {
        verdict: 'breach',
        reason: `${sig};最新一条 Cloudflared 事件在 ${sinceMs === null ? '(时刻取不到)' : `${Math.round(sinceMs / 1000)}s 前`}⇒ 仍在抖或刚刚才抖(上限 ${Math.round(CHURN_LIVE_HORIZON_MS / 60000)} 分钟 = 守护一个 tick)`,
        reading: restarts,
      }
    } else {
      dims['restart-churn'] = {
        verdict: 'warn',
        reason: `${sig};但最新一条事件在 ${(Math.round((sinceMs / 60000) * 10) / 10).toFixed(1)} 分钟前(超出 ${Math.round(CHURN_LIVE_HORIZON_MS / 60000)} 分钟一个 tick)⇒ **循环已停抖**,24h 窗口内只报数不再寄人。要查成因:wevtutil qe Application "/q:*[System[Provider[@Name='Cloudflared']]]" /f:XML /rd /c:40,再看 D:\\DevEnv\\logs\\cloudflared.log 同一时刻附近`,
        reading: restarts,
      }
    }
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
  } else {
    const amplifying = sources.length === 1 && legs.length >= 2
    const v6Sources = sources.filter((s) => !isIPv4AddressText(s))
    const v4Sources = sources.filter((s) => isIPv4AddressText(s))
    const parts = []
    const f6 = judgeV6Family(v6Sources, { netshProbe, addresses })
    if (f6) parts.push({ family: 'v6', ...f6 })
    const f4 = judgeV4Family(v4Sources, { netshProbe, netshV4Probe, v4Addresses })
    if (f4) parts.push({ family: 'v4', ...f4 })
    dims['deprecated-source'] = combineDeprecatedFamilyParts(parts, amplifying)
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
  // 第二路对照(2026-10-17 立):v6 表采集成功、v4 表也采集成功而在用 v4 源地址两表皆无 ⇒ 必须 breach。
  // 这一枚是新增分支的"有牙证明"——每天真跑前都量一次,新支被摘则整轮降 exit 3(不是放行)。
  const v4Dims = judge({
    processProbe: 'ok',
    pids: ['999'],
    netshProbe: 'ok',
    netshV4Probe: 'ok',
    netstatProbe: 'ok',
    legs: [{ source: '10.99.99.88', sourcePort: 1, dest: '198.41.192.37', destPort: 7844 }],
    addresses: new Map([['2408::ok', { kind: '公用', state: '首选项', validLifetime: '2d', preferredLifetime: '1d' }]]),
    v4Addresses: new Map([['10.0.0.1', { address: '10.0.0.1', state: '', line: 'IP address: 10.0.0.1' }]]),
  })
  return {
    passed: dims['deprecated-source'].verdict === 'breach' && dims['leg-count'].verdict === 'ok' && v4Dims['deprecated-source'].verdict === 'breach',
    dims,
    v4Dims,
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
  const [ps, netsh, netshV4, netstat, ev] = await Promise.all([
    runCapture(TASKLIST, ['/NH', '/FO', 'CSV', '/FI', 'IMAGENAME eq cloudflared.exe'], TASKLIST_TIMEOUT_MS),
    runCapture('netsh', ['interface', 'ipv6', 'show', 'addresses']),
    runCapture('netsh', ['interface', 'ipv4', 'show', 'addresses']),
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
  // v4 那一路独立结账:'failed'(命令本身挂) / 'blind'(命令成功却一枚地址都没解析出来 —— Loopback
  // 恒有 127.0.0.1,一枚都读不出只能是判据被换了表头吃掉,不是"本机没有 v4 地址") / 'ok'。
  const v4Parsed = netshV4.ok && !netshV4.killed ? parseNetshV4Addresses(netshV4.stdout) : new Map()
  const netshV4Probe = !netshV4.ok || netshV4.killed ? 'failed' : v4Parsed.size === 0 ? 'blind' : 'ok'
  const v4Addresses = v4Parsed
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
    netshProbe === 'failed' ? `netsh ipv6(${netsh.err || '输出异常'})` : null,
    netshV4Probe === 'failed' ? `netsh ipv4(${netshV4.err || '输出异常'})` : null,
    netshV4Probe === 'blind' ? 'netsh ipv4(命令成功但解析不出任何 v4 地址 ⇒ 采集失明)' : null,
    netstatProbe === 'failed' ? `netstat(${netstat.err || '输出异常'})` : null,
    eventsProbe === 'failed' ? `wevtutil(${ev.err || '输出异常或解析不出事件'})` : null,
    metricsProbe === 'failed' ? `cloudflared-metrics(${metricsPort === null ? '未枚举到本 pid 的回环监听端口' : 'HTTP 失败或超时'})` : null,
  ].filter(Boolean)
  return { processProbe, pids, netshProbe, netshV4Probe, netstatProbe, eventsProbe, restarts, eventTotal: events.length, legs, addresses, v4Addresses, unparseableTcp, metricsProbe, locations, metricsPort, failedNames, evidenceAt: new Date().toISOString() }
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
        netshV4Probe: collected.netshV4Probe,
        v4AddressCount: collected.v4Addresses.size,
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
  // ───────── IPv4 源地址那一路(2026-10-17 立,补"v6 表判不出 v4 源"的永久未判定盲区)─────────
  const v4TextZh = [
    '接口 "以太网" 的配置',
    '    DHCP 已启用:                          否',
    '    IP 地址:                           192.168.1.37',
    '    子网前缀:                        192.168.1.0/24 (掩码 255.255.255.0)',
    '    默认网关:                         192.168.1.1',
    '    网关跃点数:                       256',
    '    InterfaceMetric:                      25',
    '接口 "Loopback Pseudo-Interface 1" 的配置',
    '    IP 地址:                           127.0.0.1',
    '    子网前缀:                        127.0.0.0/8 (掩码 255.0.0.0)',
  ].join('\n')
  const v4TextEn = [
    'Configuration interface Ethernet (Ethernet)',
    '    DHCP enabled:                          No',
    '    IP address:                         10.8.9.10',
    '    Subnet prefix:                10.8.9.0/24 (mask 255.255.255.0)',
    '    Default gateway:                   10.8.9.1',
    '    InterfaceMetric:                      25',
  ].join('\n')
  const v4In = parseNetshV4Addresses(v4TextZh)
  t('netsh v4 解析:只认 ASCII 形 `IP…:` 起头的行;中文表头不吃、子网/网关/掩码括号一枚都不收', () => {
    eq(v4In.size, 2, 'zh 档地址数')
    eq(v4In.has('192.168.1.37'), true, '在册 v4 源')
    eq(v4In.has('192.168.1.1'), false, '默认网关不是本机地址')
    eq(v4In.has('255.255.255.0'), false, '掩码括号里的数字不是地址')
    const en = parseNetshV4Addresses(v4TextEn)
    eq(en.size, 1, 'en 档地址数(守护身份 SYSTEM=en-US)')
    eq(en.has('10.8.9.10'), true, 'en 档在册')
    eq(parseNetshV4Addresses('').size, 0, '空文本 ⇒ 0 枚(上层落 blind,不判 breach)')
    eq(isIPv4AddressText('192.168.1.301'), false, '八位组越界不当地址')
  })
  const mkV4 = (src, over = {}) =>
    judge({
      processProbe: 'ok',
      pids: ['1'],
      netshProbe: 'ok',
      netshV4Probe: 'ok',
      netstatProbe: 'ok',
      legs: [{ source: src, sourcePort: 5, dest: '198.41.192.37', destPort: 7844 }],
      addresses: parseNetshAddresses(addrText),
      v4Addresses: v4In,
      ...over,
    })
  t('v4 族成对夹具:在册 ⇒ ok;两表皆无且两路采集齐 ⇒ breach', () => {
    eq(mkV4('192.168.1.37')['deprecated-source'].verdict, 'ok', '在册即健康')
    const gone = mkV4('192.168.9.99')['deprecated-source']
    eq(gone.verdict, 'breach', '两表皆无')
    eq(/两张地址表里都查不到/.test(String(gone.reason)), true, 'breach 必须说清依据是两表皆无')
  })
  t('v4 族缺一路采集 ⇒ unjudged 点名 netsh ipv4(绝不折成 ok/breach)', () => {
    for (const probe of ['failed', 'blind', 'absent']) {
      const d = mkV4('192.168.9.99', { netshV4Probe: probe })['deprecated-source']
      eq(d.verdict, 'unjudged', `netshV4Probe=${probe}`)
      eq(/netsh ipv4/.test(String(d.reason)), true, `netshV4Probe=${probe} 必须点名 netsh ipv4`)
    }
    eq(mkV4('192.168.1.37', { netshV4Probe: 'failed' })['deprecated-source'].verdict, 'unjudged', '采集挂时在册也不给绿')
    eq(mkV4('192.168.9.99', { netshProbe: 'failed' })['deprecated-source'].verdict, 'unjudged', 'ipv6 那一路未齐 ⇒ 不许判 breach')
  })
  t('0.0.0.0 这类未指定源地址 ⇒ unjudged 点名,不许造出"两表皆无"的假 breach', () => {
    eq(mkV4('0.0.0.0')['deprecated-source'].verdict, 'unjudged', '未指定地址')
  })
  t('变异自证:同一枚 breach 夹具摘掉新增分支(只喂 v6 表)即翻红 ⇒ breach 确实来自 v4 支', () => {
    const withBoth = mkV4('192.168.9.99')
    eq(withBoth['deprecated-source'].verdict, 'breach', '两表齐 ⇒ breach(分支被摘则本断言翻红)')
    const v6Only = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '192.168.9.99', sourcePort: 5, dest: '198.41.192.37', destPort: 7844 }], addresses: parseNetshAddresses(addrText) })
    eq(v6Only['deprecated-source'].verdict, 'unjudged', '没采 netsh ipv4 ⇒ 只能未判定')
  })
  const mkMix = (over = {}) =>
    judge({
      processProbe: 'ok',
      pids: ['1'],
      netshProbe: 'ok',
      netshV4Probe: 'ok',
      netstatProbe: 'ok',
      legs: [
        { source: '2408:8234::60a3', sourcePort: 1, dest: '2606::1', destPort: 7844 },
        { source: '192.168.1.37', sourcePort: 2, dest: '198.41.192.37', destPort: 7844 },
      ],
      addresses: parseNetshAddresses(addrText),
      v4Addresses: v4In,
      ...over,
    })
  t('混合源两族都判到 ⇒ ok,reason 不硬凑(单族形态仍走既有文案)', () => {
    eq(mkMix()['deprecated-source'].verdict, 'ok', 'v6 在册 + v4 在册')
    const pure6 = judge({ processProbe: 'ok', pids: ['1'], netshProbe: 'ok', netstatProbe: 'ok', legs: [{ source: '2408:8234::bb3', sourcePort: 1, dest: '::', destPort: 7844 }], addresses: parseNetshAddresses(addrText) })
    eq(/^在用源地址已退化:/.test(String(pure6['deprecated-source'].reason)), true, '纯 v6 夹具文案必须与分流前逐字相同')
  })
  t('混合源取最坏档并分族点名:v6 健康 + v4 已消失 ⇒ breach', () => {
    const d = mkMix({ legs: [{ source: '2408:8234::60a3', sourcePort: 1, dest: '2606::1', destPort: 7844 }, { source: '192.168.9.99', sourcePort: 2, dest: '198.41.192.37', destPort: 7844 }] })['deprecated-source']
    eq(d.verdict, 'breach', '最坏档')
    eq(/v6族=ok/.test(String(d.reason)), true, 'v6 读数必须单独点名')
    eq(/v4族=breach/.test(String(d.reason)), true, 'v4 读数必须单独点名')
  })
  t('族间不顶账:v6 失明不折成 v4 的绿;v4 失明不折成 v6 的红', () => {
    const v6Blind = mkMix({ netshProbe: 'failed' })['deprecated-source']
    eq(v6Blind.verdict, 'unjudged', 'v6 采集挂 ⇒ 整格不得记绿')
    eq(/v4族=ok/.test(String(v6Blind.reason)), true, 'v4 判到了什么要照实写出来')
    const v4Blind = mkMix({ netshV4Probe: 'failed', legs: [{ source: '2408:8234::bb3', sourcePort: 1, dest: '2606::1', destPort: 7844 }, { source: '192.168.1.37', sourcePort: 2, dest: '198.41.192.37', destPort: 7844 }] })['deprecated-source']
    eq(v4Blind.verdict, 'breach', 'v6 退化是真 breach,不因 v4 未判定而消音')
    eq(/v4族=unjudged/.test(String(v4Blind.reason)), true, 'v4 那一路的失明必须一起点名')
  })
  t('阳性对照第二路(新增 v4 支)自身必须 breach —— 新支被摘则整轮降 3,不是放行', () => {
    eq(positiveControl().v4Dims['deprecated-source'].verdict, 'breach', 'v4 对照')
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
  parseNetshV4Addresses,
  isIPv4AddressText,
  isDeprecatedV4Record,
  classifyV4Source,
  judgeV4Family,
  judgeV6Family,
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
