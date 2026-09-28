// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
import { hostname } from 'node:os'

/** 同一 pid 的现测结果缓存时长:心跳与巡检会反复问同一个进程。 */
const CACHE_MS = 5000
/** 时间戳量化容差:记录与现测之间允许 clock rounding 造成的小差(秒级)。 */
export const START_TOLERANCE_SEC = 2

const cache = new Map()

/** PowerShell 可执行文件候选(本机 powershell.exe 实测已是 7.6.2,但仍按系统版路径取)。 */
function powershellBin() {
  return process.platform === 'win32'
    ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    : 'powershell'
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
 * 现测某 pid 的启动时间(epoch 秒)。量不到 ⇒ null,并带回原因。
 * `run` 可注入,供镜像测试证真/证伪两条路径而不真的派生 PowerShell。
 */
export function processStartEpoch(pid, { run = defaultRun, now = Date.now() } = {}) {
  const n = Number(pid)
  if (!Number.isFinite(n) || n <= 0) return { epoch: null, why: `pid 不可用(${pid})` }
  // 缓存**只服务真实测量**:键里带上"哪一次注入"结构上做不对(注入的 run 是调用方的桩),
  // 而把桩的结果留在按 pid 建的缓存里,下一个拿不同桩来的调用方会读到**别人的**答案 ——
  // 表现是"判据按夹具给的结论走",比报错更难查。真测才缓存,注入一律现测。
  const cacheable = run === defaultRun
  const key = `${n}`
  if (cacheable) {
    const hit = cache.get(key)
    if (hit && now - hit.at < CACHE_MS) return hit.res
  }
  const res = measure(n, run)
  if (cacheable) cache.set(key, { at: now, res })
  return res
}

function measure(pid, run) {
  try {
    const out = run(pid)
    const epoch = parseStartEpoch(out)
    return epoch === null ? { epoch: null, why: '输出里没有可用的启动时间' } : { epoch, why: null }
  } catch (e) {
    // 进程不存在 / 无权限 / PowerShell 不在,全落 unverifiable —— 三种都不授权抢占
    return { epoch: null, why: `取启动时间失败:${e?.code ?? e?.message ?? e}` }
  }
}

function defaultRun(pid) {
  // 只取 StartTime 的 Unix 秒;进程不存在时 PowerShell 报错 ⇒ 走 catch ⇒ unverifiable。
  const script =
    `$ErrorActionPreference='Stop';$p=Get-Process -Id ${pid} -ErrorAction Stop;` +
    '[int][double]::Parse((Get-Date $p.StartTime.ToUniversalTime() -UFormat %s))'
  return execFileSync(powershellBin(), ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 1 << 20,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

/**
 * 三态判定(纯函数):给记录侧与现测侧两个 epoch,返回结论。
 * 任一侧缺值 ⇒ `unverifiable`,**绝不折成 match 或 mismatch**。
 */
export function judgeIdentity({ recorded, observed }) {
  if (!Number.isFinite(recorded) || recorded <= 0) return { kind: 'unverifiable', why: '锁里没记录启动时间' }
  if (!Number.isFinite(observed) || observed <= 0) return { kind: 'unverifiable', why: '现测取不到启动时间' }
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
 */
export function identityFields({ run, now = Date.now(), host = hostname() } = {}) {
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
  const obs = hasRecorded ? processStartEpoch(meta.pid, opts) : { epoch: null, why: null }
  const verdict = judgeIdentity({ recorded: hasRecorded ? recorded : undefined, observed: obs.epoch })
  if (verdict.kind === 'unverifiable' && obs.why) return { ...verdict, why: `${verdict.why}:${obs.why}` }
  return verdict
}

export const __test__ = { parseStartEpoch, judgeIdentity, processStartEpoch, identityFields, verifyHolder, CACHE_MS, clearCache: () => cache.clear() }
