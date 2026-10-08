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
  if (!Number.isFinite(n) || n <= 0) return { epoch: null, why: `pid 不可用(${pid})`, precise: null }
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
  }
  const res = highPrecision ? measurePrecise(n, effectiveRun) : measure(n, effectiveRun)
  if (cacheable) cache.set(key, { at: now, res })
  return res
}

function measure(pid, run) {
  try {
    const out = run(pid)
    const epoch = parseStartEpoch(out)
    return epoch === null ? { epoch: null, why: '输出里没有可用的启动时间', precise: null } : { epoch, why: null, precise: null }
  } catch (e) {
    // 进程不存在 / 无权限 / PowerShell 不在,全落 unverifiable —— 三种都不授权抢占
    return { epoch: null, why: `取启动时间失败:${e?.code ?? e?.message ?? e}`, precise: null }
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
        ? { epoch: null, why: '高精度输出里没有可用值', precise: null }
        : { epoch, why: '高精度取值失败,退回秒级量纲', precise: null }
    }
    return epoch === null
      ? { epoch: null, why: '高精度值在但秒级值解析失败', precise }
      : { epoch, why: null, precise }
  } catch (e) {
    // 进程不存在 / CIM 报错 ⇒ 全落 unverifiable —— 高精度档不得把三态收窄
    return { epoch: null, why: `取启动时间失败:${e?.code ?? e?.message ?? e}`, precise: null }
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
  if (!meta || typeof meta !== 'object') return { kind: 'unverifiable', why: 'meta 不可用' }
  if (meta.host && meta.host !== host) {
    return { kind: 'unverifiable', why: `锁由别机持有(${meta.host} ≠ ${host})⇒ 不得据此判 pid 复用` }
  }
  const recorded = Number(meta.pidStart)
  const hasRecorded = Number.isFinite(recorded) && recorded > 0
  // meta 带高精度凭据 ⇒ 现测也走高精度档(量纲对齐才可比;meta 没有 ⇒ 秒级档,旧行为)
  const metaPrecise = typeof meta.pidStartPrecise === 'string' && meta.pidStartPrecise !== '' ? meta.pidStartPrecise : undefined
  const obs = hasRecorded
    ? processStartEpoch(meta.pid, { ...opts, highPrecision: metaPrecise !== undefined })
    : { epoch: null, why: null, precise: null }
  const verdict = judgeIdentity({
    recorded: hasRecorded ? recorded : undefined,
    observed: obs.epoch,
    recordedPrecise: metaPrecise,
    observedPrecise: obs.precise,
  })
  if (verdict.kind === 'unverifiable' && obs.why) return { ...verdict, why: `${verdict.why}:${obs.why}` }
  return verdict
}

export const __test__ = { parseStartEpoch, parsePreciseStart, parseStatStartTicks, judgeIdentity, processStartEpoch, identityFields, verifyHolder, CACHE_MS, clearCache: () => cache.clear() }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
