// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 进程身份三元组(机制对标 ZCode `packages/services/src/process/processTreeOwnership.ts`)。
 *
 * 要修的故障面是**实测过的**,不是假想:
 *  - 部署锁 2026-09-25 冻结生产 **11h50m**(登记 G-193):`acquire` 是一次性 CLI,meta 里的
 *    `pid` 不是持锁者,拿它判活要么恒真要么被系统复用 —— 实测 `meta.pid=888` 当时被
 *    `C:\Windows\System32\nssm.exe`(StartTime 比锁晚 160 秒)占着 ⇒ "活着"永远成立 ⇒ 每轮
 *    白等 600s 后失败,而 `git status` / typecheck / 154 道门全都看不出来。
 *  - git 写锁同一型:靠"锁龄超 1800s"当 pid 复用的兜底,等于**猜**。
 *
 * 本层给"这个 pid 还是当初那个进程吗"一个**能问的出口**,并严格规定它的三态:
 *   - `match`       记录值与现测值全等 ⇒ 是同一个进程(允许 ±2s 的时间戳量化误差)
 *   - `mismatch`    两边都量到了且不等 ⇒ 记录的那个进程已经不在了(现 pid 被复用)
 *   - `unverifiable` 任一侧量不到 ⇒ **不得据此抢占**(维持改动前的行为)
 * 失效方向刻意是"少抢一把",因为抢错的代价是并发写坏 `.git`(§5b 的历史事故),
 * 而少抢的代价只是多等一轮 —— 与恒红门逼人跳门是同一类权衡。
 *
 * **三态之上另有一维:探针可用性分档(台账 L11519)**。同是 `unverifiable`,成因差着两个
 * 数量级:有的是"这台机器的探针根本不可能成功"(PowerShell 不在 PATH / 被 WDAC 拦
 * ⇒ 硬不可用 ⇒ 记能力位,别再重试),有的是"这一次采样恰好没成"(进程刚退出 / 超时
 * ⇒ 瞬态 ⇒ 留重试),还有一类 errno 自己不区分(如本机实证的 spawn EBUSY)⇒ 落
 * **未判定**并点名。这一维**不参与授权**:三态一条不改,`unverifiable` 仍然不授权抢占,
 * 它只回答"下次还要不要再问一次"。
 *
 * Windows 侧没有轻量的"取任意 pid 启动时间"原生 API:走一次 PowerShell `Get-Process`。
 * 只在**已经决定要判抢占**的稀有路径上调(不在每次心跳、不在每次 check 的快路径),
 * 并且带缓存与超时;派生一律 `windowsHide`(§5b 弹窗根治)与 `timeout`(守门 52 / 80)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { hostname } from 'node:os'

/** 同一 pid 的现测结果缓存时长:心跳与巡检会反复问同一个进程。 */
const CACHE_MS = 5000
/** 时间戳量化容差:记录与现测之间允许 clock rounding 造成的小差(秒级)。 */
export const START_TOLERANCE_SEC = 2

/**
 * 探针可用性四档(**加在三态之上的一维,不替换三态**)。
 *  - `available` 量到了,没有失败要归。
 *  - `permanent` 硬不可用 ⇒ 记能力位,别再重试(`scope='engine'` 的那几档直接闩到模块级
 *    能力位,本进程后续真实测量一律不再派生;`scope='sample'` 的只表示"这个 pid 别再问")。
 *  - `transient` 瞬态 ⇒ 留重试,下一次 acquire 该问还得问。
 *  - `unknown`   未判定 ⇒ **点名,不许猜**;既不闩能力位(没判成硬不可用),也不授权重试
 *    (重试的收益未证成,方向仍然是"少派生一次")。
 */
export const PROBE_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  PERMANENT: 'permanent',
  TRANSIENT: 'transient',
  UNKNOWN: 'unknown',
})

/** 派生层面的 errno(引擎缺失/被拦):只在 `source='engine'` 时才敢当硬不可用判。 */
const SPAWN_ERRNOS = new Set(['ENOENT', 'EPERM', 'EACCES'])
/** PowerShell 侧"进程不存在"的措辞族(退出码非 0 时靠文本分档)。 */
const NOT_FOUND_TEXT = /no such process|cannot find (a )?process|no process|进程不存在/i
/** PowerShell 执行策略 / 签名 / 无权跑脚本:这一类改不了,重试一万次也一样。 */
const POLICY_TEXT = /execution of scripts is disabled|executionpolicy|unauthorizedaccess|not digitally signed|access is denied|拒绝访问|执行策略/i

/** 拼出用于"点名"的错误摘要(message + stderr),截断以免把整页报错塞进 meta/日志。 */
function errTextOf(e) {
  return [e?.message, e?.stderr]
    .map((v) => (typeof v === 'string' ? v : ''))
    .join(' ')
    .slice(0, 200)
}

/**
 * 从失败形态反推**失败发生在哪一层**(这是分档能不能判的前提,不是可选项):
 *  - `engine` 派生引擎这一层(node spawn 失败)—— 实测 `err.syscall` 形如 `spawnSync C:\...\pwsh.exe`;
 *  - `procfs` 读 `/proc/<pid>/stat` 这一层(仅非 win32 高精度档);
 *  - `unknown` 两层都对不上 ⇒ 交给下面落"未判定",不许按 errno 硬猜。
 */
function inferProbeSource(e) {
  if (typeof e?.syscall === 'string' && e.syscall.startsWith('spawnSync')) return 'engine'
  if (typeof e?.path === 'string' && /^\/proc\/\d+\//.test(e.path)) return 'procfs'
  return 'unknown'
}

/**
 * 把一次**现测失败**归到永久 / 瞬态 / 未判定(纯函数,可单测)。
 *
 * 分档依据(每一档都写清它凭什么这么归):
 *  | 失败形态                                   | 档位      | 依据                                                     |
 *  |--------------------------------------------|-----------|----------------------------------------------------------|
 *  | 超时(killed / signal / ETIMEDOUT)          | 瞬态      | 被时间盒截断的是**这一次采样**,机制本身还在;负载下去就成  |
 *  | spawn ENOENT(engine)                      | 永久      | PowerShell 不在 PATH:引擎缺失,重试多少次都是同一个 ENOENT |
 *  | spawn EPERM/EACCES(engine)                | 永久      | WDAC/应用控制策略对同一会话稳定(本仓开发机实证)⇒ 重试不改 |
 *  | 非零退出 + 文本像"进程不存在"               | 瞬态      | **进程恰好退出**:pid 会被复用给新进程,下一轮该问还得问    |
 *  | 非零退出 + 文本像"执行策略/签名拦截"        | 永久      | 策略不改,PowerShell 就跑不起来                            |
 *  | procfs ENOENT(/proc/<pid>/stat 没了)       | 瞬态      | 同上:进程恰好退出                                         |
 *  | procfs EACCES/EPERM                        | 永久(单 pid)| 对该 pid 重试无意义;但换 pid 可能可读 ⇒ **不闩整机能力位** |
 *  | spawn EBUSY(errno -4082)                   | **未判定** | 本仓实证:超时与非零退出在本机会撞出同一个 EBUSY,errno 自己不区分"持续拦截"与"瞬时占用" ⇒ 点名,不猜 |
 *  | 其它 errno / 无 code 的裸 Error / 非零退出但文本两不像 | **未判定** | 归不到任一类,点名原始 code/退出码,不许猜                  |
 *
 * 归不了的档一律 `unknown` + `why` 点名原始形态 —— 判不出来却写成 permanent,等于替
 * 调用方把"这台机器以后都别问了"这个结论猜了出来。
 *
 * @param {unknown} e 现测抛出的错误
 * @param {{source?:'auto'|'engine'|'procfs'|'unknown'}} [opts] 调用方确知失败层时可显式给
 * @returns {{availability:string,scope:string,retryable:boolean,code:string,why:string}}
 */
export function classifyProbeFailure(e, { source = 'auto' } = {}) {
  const src = source === 'auto' ? inferProbeSource(e) : source
  const code = typeof e?.code === 'string' ? e.code : ''
  const text = errTextOf(e)
  const named = code || (Number.isInteger(e?.status) ? `exit=${e.status}` : '') || String(e?.message ?? e).slice(0, 120)
  const mk = (availability, scope, why) => ({
    availability,
    scope,
    retryable: availability === PROBE_AVAILABILITY.TRANSIENT,
    code: named,
    why,
  })
  // ① 超时:采样被时间盒截断 ⇒ 瞬态(负载/CIM 慢,下一次可能成)。
  if (e?.killed === true || typeof e?.signal === 'string' || code === 'ETIMEDOUT') {
    return mk(
      PROBE_AVAILABILITY.TRANSIENT,
      'sample',
      `探针超时(${named})⇒ 瞬态:被时间盒截断的是这一次采样,探针机制本身还在`,
    )
  }
  // ② EBUSY:本会话实测"超时"与"非零退出"两种形态都撞出同一个 EBUSY(errno -4082)
  //    ⇒ errno 自己不区分"平台对原生 exe 的持续拦截(硬)"与"并发瞬时占用(瞬态)"
  //    ⇒ 落未判定并点名,不许猜。
  if (code === 'EBUSY' || e?.errno === -4082) {
    return mk(
      PROBE_AVAILABILITY.UNKNOWN,
      'unknown',
      `未判定:spawn 返回 EBUSY(${named})—— 可能是平台/策略对原生 exe 的持续拦截(硬),也可能是并发瞬时占用(瞬态),errno 不区分`,
    )
  }
  // ③ 引擎缺失 / 被拦(派生层,ENOENT|EPERM|EACCES)⇒ 硬不可用,记能力位。
  if (src === 'engine' && SPAWN_ERRNOS.has(code)) {
    return code === 'ENOENT'
      ? mk(PROBE_AVAILABILITY.PERMANENT, 'engine', `PowerShell 不在 PATH(${named})⇒ 硬不可用:引擎缺失,重试多少次都是同一个 ENOENT`)
      : mk(PROBE_AVAILABILITY.PERMANENT, 'engine', `PowerShell 被策略拦截 ${code}(${named})⇒ 硬不可用:WDAC/权限策略对同一会话稳定,重试不改变`)
  }
  // ④ procfs 读取失败(仅非 win32 高精度档)。
  if (src === 'procfs') {
    if (code === 'ENOENT') {
      return mk(PROBE_AVAILABILITY.TRANSIENT, 'sample', `进程恰好退出(/proc 下已无该 pid,${named})⇒ 瞬态:pid 会被复用给新进程,下一轮该问还得问`)
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return mk(PROBE_AVAILABILITY.PERMANENT, 'sample', `无权读该进程的 /proc 条目(${named})⇒ 对该 pid 永久(重试无意义),但换 pid 可能可读 ⇒ 不闩整机能力位`)
    }
    return mk(PROBE_AVAILABILITY.UNKNOWN, 'unknown', `未判定:procfs 读取失败(${named})—— 归不到"进程退出"或"无权限"任一类,不许猜`)
  }
  // ⑤ 引擎跑起来了但非零退出:按输出文本分档,两不像 ⇒ 未判定。
  if (Number.isInteger(e?.status) && e.status !== 0) {
    if (NOT_FOUND_TEXT.test(text)) {
      return mk(PROBE_AVAILABILITY.TRANSIENT, 'sample', `进程不存在(引擎退出码 ${e.status},${named})⇒ 瞬态:进程恰好退出,pid 会被复用`)
    }
    if (POLICY_TEXT.test(text)) {
      return mk(PROBE_AVAILABILITY.PERMANENT, 'engine', `PowerShell 执行策略/签名拦截(退出码 ${e.status},${named})⇒ 硬不可用:策略不改就跑不起来`)
    }
    return mk(PROBE_AVAILABILITY.UNKNOWN, 'unknown', `未判定:探针非零退出(${named})—— 输出文本既不像"进程不存在"也不像"策略拦截",不许猜`)
  }
  // ⑥ 派生层 errno 但没有层标记 / 其它形态 ⇒ 未判定(层都认不出来就谈不上永久还是瞬态)。
  if (SPAWN_ERRNOS.has(code)) {
    return mk(PROBE_AVAILABILITY.UNKNOWN, 'unknown', `未判定:${code} 但认不出失败发生在哪一层(path=${e?.path ?? '?'})⇒ 不许猜是引擎缺失还是进程退出`)
  }
  return mk(PROBE_AVAILABILITY.UNKNOWN, 'unknown', `未判定:未登记的失败形态(${named})⇒ 不许猜`)
}

/**
 * 模块级**能力位**:真实测量(非注入桩)撞上 `permanent + engine` 时闩上,之后本进程
 * 对任何 pid 的真实测量一律不再派生 —— 这就是"硬不可用 ⇒ 别再重试"的出口。
 * 只闩 `scope='engine'`(整机/本会话这一档探针废了);`scope='sample'` 的 permanent
 * (某个 pid 无权读)不闩,因为换一个 pid 完全可能读得到。
 */
let hardUnavailable = null

/** 读能力位(调用方据此决定"还要不要再问一次")。 */
export function probeCapability() {
  return hardUnavailable === null
    ? { hardUnavailable: false, at: null, why: null }
    : { hardUnavailable: true, at: hardUnavailable.at, why: hardUnavailable.why }
}

/** 能力位的布尔出口。 */
export function isProbeHardUnavailable() {
  return hardUnavailable !== null
}

/** 显式复位(仅供测试与"环境已修复后"手动放行);生产路径不得调。 */
export function resetProbeCapability() {
  hardUnavailable = null
}

/**
 * 记能力位(硬不可用)。两个来源:① 本模块真实测量撞上 `permanent + engine`;
 * ② 调用方**从别处确证**了这台机器没有可用 PowerShell 引擎(如 `scripts/check-pwsh-version.mjs`
 * 判过)⇒ 主动告知本层"别再派生了"。反过来,单 pid 的永久档(无权读某个 /proc 条目)
 * 不闩 —— 换一个 pid 完全可能读得到。
 */
export function noteProbeHardUnavailable(why = '外部确证探针硬不可用') {
  if (hardUnavailable === null) hardUnavailable = { at: Date.now(), why: String(why) }
  return probeCapability()
}

/**
 * 高精度可选档(机制对标上游 processTreeSnapshot.ts:146-184):
 * 秒级容差 `delta <= 2` 把"同一秒内被复用"这一档从未证伪过 —— 上游恰是为这一档
 * 把量纲抬到 tick/微秒:Windows 用 CreationDate.Ticks 换算微秒串
 * `windows-utc-us:<µs>`,Linux 用 /proc/<pid>/stat 第 22 字段 boot-tick 覆盖
 * 秒级 lstart(PID 同秒复用也不会被误认成旧 runtime 成员)。
 * 高精度值一律是**带前缀的字符串**(.NET ticks ≈ 6.4e17,超出 JS 安全整数),
 * 判定时按字符串全等比对,不做数值减法。
 */

const cache = new Map()

/**
 * PowerShell 引擎候选(全部绝对路径,win32):pwsh(PS7)在前 —— WDAC/应用控制策略
 * 可能拦截 node 派生的 powershell.exe(5.1)而放行 PS7(本仓开发机实证 spawn EPERM;
 * apps/api kill-verified.ts 与 mcp-credentials.ts 的 DPAPI 引擎链同款结论),
 * powershell.exe 兜底覆盖未装 PS7 的常规镜像。存在性预筛;非 win32 走 PATH 短名。
 */
function powershellBins() {
  if (process.platform !== 'win32') return ['pwsh', 'powershell']
  const list = []
  const localAppData = process.env.LOCALAPPDATA ?? ''
  for (const candidate of [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    localAppData === '' ? '' : `${localAppData}\\Microsoft\\WindowsApps\\pwsh.exe`,
  ]) {
    if (candidate !== '' && existsSync(candidate)) list.push(candidate)
  }
  list.push('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  return list
}

/**
 * 偏好序上的同步执行口:Get-Process / CIM 两档探针共用。仅 spawn 即时失败
 * (WDAC 拦截 EPERM / 未装 ENOENT / 无权 EACCES)回退下一候选;超时/非零退出
 * 原样抛(调用方按 unverifiable 处理,不得放大采样时长)。
 */
function runPowerShellSync(script) {
  let lastError
  for (const bin of powershellBins()) {
    try {
      return execFileSync(bin, ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15_000,
        maxBuffer: 1 << 20,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch (e) {
      lastError = e
      const code = e?.code
      if (code === 'EPERM' || code === 'ENOENT' || code === 'EACCES') continue
      throw e
    }
  }
  throw lastError
}

/** 从 PowerShell 输出里解出 epoch 秒;解不出 ⇒ null(不是 0,0 会被当成合法时间)。 */
export function parseStartEpoch(raw) {
  const s = String(raw ?? '').trim()
  if (!s || s === '') return null
  // 取最后一段纯数字行(前面可能有 profile 噪音)
  const nums = s.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\d+$/.test(l))
  if (nums.length === 0) return null
  const n = Number(nums[nums.length - 1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * 从高精度档的输出里解出带前缀的微秒/tick 串;解不出 ⇒ null。
 * 只认两种形态:`windows-utc-us:<µs>`(Windows CreationDate.Ticks 归一)与
 * `boot-ticks:<n>`(Linux /proc/<pid>/stat field 22)。其他输出(含报错噪音)
 * 一律 null —— 高精度值解不出就走秒级档,**不得猜**。
 */
export function parsePreciseStart(raw) {
  const s = String(raw ?? '').trim()
  for (const line of s.split(/\r?\n/)) {
    const l = line.trim()
    const m = l.match(/^(windows-utc-us|boot-ticks):(\d+)$/)
    if (m) return `${m[1]}:${m[2]}`
  }
  return null
}

/**
 * 从 /proc/<pid>/stat 内容里解出第 22 字段(starttime,boot 后的 clock tick 数)。
 * comm 字段(第 2 字段)可含空格与括号 ⇒ 以**最后一个** ')' 为界,其后的 token
 * 从第 3 字段(state)起算,starttime 是其后第 20 个 token(0-based 19)。
 * 解不出 ⇒ null。
 */
export function parseStatStartTicks(text) {
  const s = String(text ?? '')
  const close = s.lastIndexOf(')')
  if (close < 0) return null
  const rest = s.slice(close + 1).trim().split(/\s+/)
  const v = rest[19]
  if (!v || !/^\d+$/.test(v) || Number(v) <= 0) return null
  return `boot-ticks:${v}`
}

/**
 * 现测某 pid 的启动时间(epoch 秒)。量不到 ⇒ null,并带回原因。
 * `run` 可注入,供镜像测试证真/证伪两条路径而不真的派生 PowerShell。
 * `highPrecision: true` 走高精度档(默认 run 换成 CIM Ticks/stat field 22 的
 * 带前缀取值);返回值多带 `precise`(字符串,量不到为 null)。
 */
export function processStartEpoch(pid, { run, highPrecision = false, now = Date.now() } = {}) {
  const n = Number(pid)
  if (!Number.isFinite(n) || n <= 0) {
    return {
      epoch: null,
      why: `pid 不可用(${pid})`,
      precise: null,
      // 探针根本没跑 ⇒ 谈不上永久还是瞬态,落未判定并点名(不许拿"取不到"冒充"硬不可用")
      availability: PROBE_AVAILABILITY.UNKNOWN,
      retryable: false,
      scope: 'unknown',
      probeWhy: `未判定:pid 本身不可用(${pid})⇒ 探针没跑`,
    }
  }
  // highPrecision 档的默认 run 必须随档切换(文档承诺"默认 run 换成 CIM Ticks/stat
  // field 22");此前实现漏了这一步 —— 不注入 run 的调用方 highPrecision=true 依旧跑
  // 秒级 Get-Process,parsePreciseStart 恒 null ⇒ 精确档在生产从未生效(测试靠注入
  // run 才绿,盖住了这 bug)。显式注入的 run 仍最高优先,供测试/特殊调用方钉死。
  const effectiveRun = run ?? (highPrecision ? defaultPreciseRun : defaultRun)
  // 缓存**只服务真实测量**:键里带上"哪一次注入"结构上做不对(注入的 run 是调用方的桩),
  // 而把桩的结果留在按 pid 建的缓存里,下一个拿不同桩来的调用方会读到**别人的**答案 ——
  // 表现是"判据按夹具给的结论走",比报错更难查。真测才缓存,注入一律现测。
  // 高精度档与秒级档的答案形状不同 ⇒ 缓存键必须分档,否则两档互相顶掉。
  const cacheable = effectiveRun === defaultRun || effectiveRun === defaultPreciseRun
  const key = `${n}|${highPrecision ? 'precise' : 'sec'}`
  if (cacheable) {
    const hit = cache.get(key)
    if (hit && now - hit.at < CACHE_MS) return hit.res
    // 能力位已闩(此前真实测量撞上"引擎缺失/被拦"这类硬不可用)⇒ 直接短路,不再派生。
    // 只对真实测量生效:注入桩是调用方的夹具,不该被上一次真测的结论掐掉。
    if (hardUnavailable !== null) {
      return {
        epoch: null,
        why: `取启动时间失败:探针硬不可用(${hardUnavailable.why})`,
        precise: null,
        availability: PROBE_AVAILABILITY.PERMANENT,
        retryable: false,
        scope: 'engine',
        probeWhy: hardUnavailable.why,
        fromCapability: true,
      }
    }
  }
  const res = highPrecision ? measurePrecise(n, effectiveRun) : measure(n, effectiveRun)
  if (cacheable) {
    // 硬不可用记账:只有"整机这一档探针废了"才闩能力位(别再重试),单 pid 的永久档不闩。
    if (res.availability === PROBE_AVAILABILITY.PERMANENT && res.scope === 'engine' && hardUnavailable === null) {
      hardUnavailable = { at: now, why: res.probeWhy ?? res.why ?? '探针硬不可用' }
    }
    cache.set(key, { at: now, res })
  }
  return res
}

function measure(pid, run) {
  try {
    const out = run(pid)
    const epoch = parseStartEpoch(out)
    if (epoch === null) {
      return {
        epoch: null,
        why: '输出里没有可用的启动时间',
        precise: null,
        // 引擎跑完了(没抛错)却解不出时间戳 ⇒ 既不是"引擎不在"也不是"进程退出"的确证,
        // 可能是 profile 噪音也可能是进程没了而脚本没报错 ⇒ 未判定,点名,不许猜。
        availability: PROBE_AVAILABILITY.UNKNOWN,
        retryable: false,
        scope: 'unknown',
        probeWhy: '未判定:探针有输出但解不出启动时间(噪音/空结果),errno 层面无失败可归',
      }
    }
    return { epoch, why: null, precise: null, availability: PROBE_AVAILABILITY.AVAILABLE, retryable: false, scope: 'sample' }
  } catch (e) {
    // 三态一条不改:进程不存在 / 无权限 / PowerShell 不在,**仍全落 unverifiable**
    // (都不授权抢占);新增的一维只答"还要不要再问一次",见 classifyProbeFailure 的分档表。
    const c = classifyProbeFailure(e)
    return {
      epoch: null,
      why: `取启动时间失败:${e?.code ?? e?.message ?? e}`,
      precise: null,
      availability: c.availability,
      retryable: c.retryable,
      scope: c.scope,
      probeWhy: c.why,
    }
  }
}

function measurePrecise(pid, run) {
  try {
    const out = run(pid)
    const precise = parsePreciseStart(out)
    const epoch = parseStartEpoch(out)
    if (precise === null) {
      // 高精度取值失败不装成功:epoch 即便有值也只当秒级档用(precise 留 null)
      return epoch === null
        ? {
            epoch: null,
            why: '高精度输出里没有可用值',
            precise: null,
            availability: PROBE_AVAILABILITY.UNKNOWN,
            retryable: false,
            scope: 'unknown',
            probeWhy: '未判定:高精度档有输出但解不出带前缀值(errno 层面无失败可归)',
          }
        : {
            epoch,
            why: '高精度取值失败,退回秒级量纲',
            precise: null,
            availability: PROBE_AVAILABILITY.AVAILABLE,
            retryable: false,
            scope: 'sample',
          }
    }
    return epoch === null
      ? {
          epoch: null,
          why: '高精度值在但秒级值解析失败',
          precise,
          availability: PROBE_AVAILABILITY.UNKNOWN,
          retryable: false,
          scope: 'unknown',
          probeWhy: '未判定:高精度值在而秒级值解析失败(两侧量纲不齐),errno 层面无失败可归',
        }
      : { epoch, why: null, precise, availability: PROBE_AVAILABILITY.AVAILABLE, retryable: false, scope: 'sample' }
  } catch (e) {
    // 三态一条不改:进程不存在 / CIM 报错 ⇒ **仍全落 unverifiable**,高精度档不得把三态
    // 收窄;同样只多加一维"永久/瞬态/未判定",见 classifyProbeFailure 的分档表。
    const c = classifyProbeFailure(e)
    return {
      epoch: null,
      why: `取启动时间失败:${e?.code ?? e?.message ?? e}`,
      precise: null,
      availability: c.availability,
      retryable: c.retryable,
      scope: c.scope,
      probeWhy: c.why,
    }
  }
}

function defaultRun(pid) {
  // 只取 StartTime 的 Unix 秒;进程不存在时 PowerShell 报错 ⇒ 走 catch ⇒ unverifiable。
  // win32 与 defaultPreciseRun 同源走 CIM CreationDate.Ticks:Get-Process 的 StartTime
  // 在 PS7 下 Kind 标注与值不一致(实测恒偏 -28800s ⇒ 跨引擎比对会出假 mismatch ⇒
  // 误抢占),Get-Date -UFormat %s 同样按引擎/时区解释漂移。Ticks 纪元差是纯 UTC
  // 数学,引擎无关。非 win32 才走 Get-Process(pwsh/linux 下 Kind 正确,且无 CIM)。
  if (process.platform === 'win32') {
    const script =
      `$ErrorActionPreference='Stop';` +
      `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}";` +
      `if($null -eq $p){throw New-Object System.Exception('no such process')}` +
      `[string][long](($p.CreationDate.Ticks - 621355968000000000)/10000000)`
    return runPowerShellSync(script)
  }
  const script =
    `$ErrorActionPreference='Stop';$p=Get-Process -Id ${pid} -ErrorAction Stop;` +
    '[long](($p.StartTime.ToUniversalTime().Ticks - 621355968000000000)/10000000)'
  return runPowerShellSync(script)
}

/** .NET DateTime(0001-01-01)与 Unix 纪元之间的 Ticks 差(100ns 单位)。 */
const NET_TICKS_TO_UNIX = 621_355_968_000_000_000

function defaultPreciseRun(pid) {
  if (process.platform === 'win32') {
    // CreationDate.Ticks(100ns,自 0001-01-01)归一成 Unix 微秒串:
    // µs = (Ticks − 621355968000000000) / 10。整串留在 PowerShell 侧算好,
    // 以 `windows-utc-us:<µs>` 原样回传 —— 6.4e17 量级超出 JS 安全整数,不得进 JS 数值域。
    const script =
      `$ErrorActionPreference='Stop';` +
      `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}";` +
      `if($null -eq $p){throw New-Object System.Exception('no such process')}` +
      `$t=[long]$p.CreationDate.Ticks - ${NET_TICKS_TO_UNIX};` +
      `'windows-utc-us:'+([long]($t/10));` +
      `[string][long]($t/10000000)`
    return runPowerShellSync(script)
  }
  // Linux:field 22(starttime,boot tick)精度高于 ps lstart 的秒级时间。
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
  return parseStatStartTicks(stat) ?? ''
}

/**
 * 三态判定(纯函数):给记录侧与现测侧两个 epoch,返回结论。
 * 任一侧缺值 ⇒ `unverifiable`,**绝不折成 match 或 mismatch**。
 *
 * 高精度可选档(同秒可分辨):两侧都带 precise 串时,字符串全等才 match,
 * 不等 ⇒ mismatch —— **即便秒级 delta 在容差内**(这正是本档要钉住的
 * "同一秒内被复用"档,秒级量纲对它结构性失明)。只一侧带 precise ⇒
 * 量纲不对齐,按秒级档判(退回旧结论,不得单侧凭空翻案)。
 */
export function judgeIdentity({ recorded, observed, recordedPrecise, observedPrecise }) {
  if (!Number.isFinite(recorded) || recorded <= 0) return { kind: 'unverifiable', why: '锁里没记录启动时间' }
  if (!Number.isFinite(observed) || observed <= 0) return { kind: 'unverifiable', why: '现测取不到启动时间' }
  const bothPrecise = typeof recordedPrecise === 'string' && recordedPrecise !== '' && typeof observedPrecise === 'string' && observedPrecise !== ''
  if (bothPrecise) {
    if (recordedPrecise === observedPrecise) return { kind: 'match', delta: 0, precise: true }
    const delta = Math.abs(recorded - observed)
    return {
      kind: 'mismatch',
      delta,
      precise: true,
      why: `高精度身份不符(记录 ${recordedPrecise} vs 现测 ${observedPrecise},秒级差 ${Math.round(delta)}s)⇒ 该 pid 已被复用`,
    }
  }
  const delta = Math.abs(recorded - observed)
  if (delta <= START_TOLERANCE_SEC) return { kind: 'match', delta }
  return { kind: 'mismatch', delta, why: `记录 ${recorded} vs 现测 ${observed}(差 ${Math.round(delta)}s)⇒ 该 pid 已被复用` }
}

/** 取"当前进程自己"的启动时间,供 acquire 时写进 meta(取不到 ⇒ 记 null,不记假值)。 */
export function selfStartEpoch(opts = {}) {
  return processStartEpoch(process.pid, opts).epoch ?? null
}

/**
 * 把身份三元组装进 meta 记录(与 pid / ts 并列的第三要素 + 主机名)。
 * 主机名是**故意**的:meta 只在本机有效,但共享工作区可能被别的机器 checkout,
 * 跨机比对 pid 毫无意义 —— 主机名不等时一律 unverifiable,而不是判"pid 被复用"。
 * `highPrecision: true` 时量纲抬到 tick/微秒并落 `pidStartPrecise`(量不到不落键)。
 */
export function identityFields({ run, now = Date.now(), host = hostname(), highPrecision = false } = {}) {
  if (highPrecision) {
    const res = processStartEpoch(process.pid, { run, now, highPrecision })
    return {
      host,
      pidStart: res.epoch ?? undefined,
      ...(res.precise ? { pidStartPrecise: res.precise } : {}),
    }
  }
  return { host, pidStart: selfStartEpoch({ run, now }) ?? undefined }
}

/**
 * 现测 + 记录对账,返回 `{ kind, why? }`(调用方只在 `mismatch` 时才允许抢占)。
 *
 * 两条省/加判据的顺序化(都不是三态改动):
 *  1. **锁里没记 `pidStart` 就根本不派生** —— 结论已经是 `unverifiable` 了,再去跑一次
 *     PowerShell 只是给每一次"旧 meta 的等待"白加一次派生(旧 meta 在升级期是多数)。
 *  2. 现测失败的原因必须跟着结论走:`judgeIdentity` 只会说"现测取不到启动时间",
 *     而"为什么取不到"(进程已不存在 / PowerShell 不可达 / 权限不足)下一步动作各不相同。
 *     只补文案,**不改三态** —— 三种失败全都仍然落 `unverifiable`(不授权抢占)。
 */
export function verifyHolder(meta, opts = {}) {
  const host = opts.host ?? hostname()
  // 这两条都在派生**之前**短路,所以没有"探针失败"可归 ⇒ 可用性一律未判定,并点名"没跑探针"
  // (不许让调用方把"根本没问"读成"问过且是硬不可用")。
  if (!meta || typeof meta !== 'object') {
    return {
      kind: 'unverifiable',
      why: 'meta 不可用',
      availability: PROBE_AVAILABILITY.UNKNOWN,
      retryable: false,
      scope: 'unknown',
      probeWhy: '未判定:没跑探针(meta 不可用)',
    }
  }
  if (meta.host && meta.host !== host) {
    return {
      kind: 'unverifiable',
      why: `锁由别机持有(${meta.host} ≠ ${host})⇒ 不得据此判 pid 复用`,
      availability: PROBE_AVAILABILITY.UNKNOWN,
      retryable: false,
      scope: 'unknown',
      probeWhy: '未判定:没跑探针(跨机锁不得派生本机启动时间)',
    }
  }
  const recorded = Number(meta.pidStart)
  const hasRecorded = Number.isFinite(recorded) && recorded > 0
  // meta 带高精度凭据 ⇒ 现测也走高精度档(量纲对齐才可比;meta 没有 ⇒ 秒级档,旧行为)
  const metaPrecise = typeof meta.pidStartPrecise === 'string' && meta.pidStartPrecise !== '' ? meta.pidStartPrecise : undefined
  const obs = hasRecorded
    ? processStartEpoch(meta.pid, { ...opts, highPrecision: metaPrecise !== undefined })
    : {
        epoch: null,
        why: null,
        precise: null,
        availability: PROBE_AVAILABILITY.UNKNOWN,
        retryable: false,
        scope: 'unknown',
        probeWhy: '未判定:没跑探针(锁里没记 pidStart,问了也不构成判据)',
      }
  const verdict = judgeIdentity({
    recorded: hasRecorded ? recorded : undefined,
    observed: obs.epoch,
    recordedPrecise: metaPrecise,
    observedPrecise: obs.precise,
  })
  // 可用性一维跟着结论出账(调用方据此决定"下一轮还问不问"):三态本身一个字不改。
  const availability = {
    availability: obs.availability ?? PROBE_AVAILABILITY.UNKNOWN,
    retryable: obs.retryable === true,
    scope: obs.scope ?? 'unknown',
    ...(obs.probeWhy ? { probeWhy: obs.probeWhy } : {}),
  }
  if (verdict.kind === 'unverifiable' && obs.why) return { ...verdict, ...availability, why: `${verdict.why}:${obs.why}` }
  return { ...verdict, ...availability }
}

export const __test__ = {
  parseStartEpoch,
  parsePreciseStart,
  parseStatStartTicks,
  judgeIdentity,
  processStartEpoch,
  identityFields,
  verifyHolder,
  classifyProbeFailure,
  probeCapability,
  isProbeHardUnavailable,
  noteProbeHardUnavailable,
  resetProbeCapability,
  PROBE_AVAILABILITY,
  CACHE_MS,
  clearCache: () => cache.clear(),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
