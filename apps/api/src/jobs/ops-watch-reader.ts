// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产值守「进程内定时读方」(G-916430③,机主拍板 2026-10-07:
 * 「mail 欠投递读方并入 API 进程内定时读方,不新增服务拓扑」)。
 *
 * 立因(2026-09-29 现读):
 *  ① 各生产者寄不出信时落的 `.workbuddy/*UNDELIVERED*.json`(§5e「失败必须响」)此前
 *     除提交链守门(check-ops-patrol P8)外**没有任何运行时消费者** —— 门只在有人提交时跑,
 *     "有一件事从来没人知道"这件事本身在两次提交之间依然没人知道;
 *  ② :80 图片 CDN 不在任何一班值守眼里(端口清单只查 8801/8802/8803/8810/8811),
 *     进程死了只能等下次重启被发现。nssm 服务 IHUI-IMAGE-CDN 已接管常驻(run-cdn.bat
 *     头注 STATUS 2026-09-29),但"活着"仍需有人看 —— 本读方就是那一眼。
 *
 * 语义(与 check-ops-patrol P8 同一套三态,但按运行时纪律收窄):
 *  - 有标记 / CDN 无应答 ⇒ finding,经 pushAlert 到人(全渠道并行,哪条活着走哪条) + logger.error;
 *  - 目录读不到 / JSON 坏 ⇒ finding(undetermined 口径,逐条点名),**不得**顺带洗成"没有问题";
 *  - 无标记 + CDN 应答 ⇒ 静默(只在 debug 留一行),不制造周期性噪声。
 *
 * 去重(机主明令「重复告警本身就是缺陷」,与 git-guardian notifyGuardRed 同族):
 *  - 标记类:按 finding.key + 内容指纹记上次发送时刻,冷却期内同指纹不重发;标记消失即清键,
 *    再次出现立即重报(内容变化视为新故障)。
 *  - CDN 类(**历史噪声根因,2026-10-15 根治**):**连续失败计数 + 闩锁**——单次要因 CDN 自身重启 /
 *    API 被部署环重启造成的瞬断或探测抖动不再触发邮件;只有连续 N 次(默认 3,即 30 分钟)探测失败才发
 *    一封,发出后在该次宕机 episode 内保持静默,直至 CDN 恢复(探测成功)才重置闩锁、允许下次真实宕机再报。
 *
 * 持久化(根因修复):去重状态落盘到 OPS_WATCH_DEDUP_FILE(默认 D:\DevEnv\state\ops-watch-dedup.json),
 * 原子写 + 内存镜像。API 被部署环重启后状态不丢——这是历史噪声放大器(原实现用内存 Map,随进程死亡而
 * 清零,重启后同一次瞬断又被当成"新故障"重报)的治本。Redis 不可用时自动退回纯内存(本会话内仍去重)。
 *
 * 调度:cron 每 10 分钟一次(Asia/Shanghai)。由 index.ts 接线,ENABLE_OPS_WATCH_READER=false 禁用。
 * 停机:stopOpsWatchReaderScheduler 进 shutdown syncStopPhase 清单。
 */
import cron, { type ScheduledTask } from 'node-cron'
import { existsSync, readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '../utils/logger.js'
import { pushAlert } from '../services/alert-notification-service.js'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 仓根:apps/api/src/jobs → 上四级。生产与开发同一 checkout,不依赖 cwd(§5b)。 */
export const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')

/** 告警冷却:同 key+同指纹在窗口内只发一次(重复告警是缺陷,机主明令)。 */
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000

/** CDN 连续探测失败达到该次数才发一封 critical(默认 3 = 30 分钟持续宕机)。 */
const DEFAULT_CDN_FAIL_THRESHOLD = 3

/** 标记文件名形态:与 check-ops-patrol P8 同一条正则(两族生产者都盖住)。 */
const UNDELIVERED_RE = /UNDELIVERED.*\.json$/i

export interface WatchFinding {
  /** 去重键:标记文件按文件名+内容指纹,CDN 按端点。 */
  key: string
  title: string
  detail: string
  severity: 'warning' | 'critical'
}

// ───────────── 去重存储:文件持久化 + 内存镜像 ─────────────
// 根因修复:原实现用模块级 Map,API 进程被部署环重启即清零 → 同一次瞬断被当成"新故障"反复重报。
// 落盘后状态跨重启存活;Redis 不可用 / 目录不存在时自动退回纯内存(本会话内仍去重),不阻断值守。
export interface DedupRecord {
  /** 上次实际推送时刻(ms)。 */
  at: number
  /** 上次推送时的内容指纹。 */
  fp: string
  /** CDN 连续失败计数(标记类恒 0)。 */
  failures: number
  /** CDN 本 outage episode 是否已告警(闩锁),恢复后重置。 */
  alerted: boolean
}

export class OpsWatchDedupStore {
  private mem = new Map<string, DedupRecord>()
  private loaded = false
  private readonly file: string

  constructor(file?: string) {
    // 索引访问在 noUncheckedIndexedAccess 下是 string|undefined;状态目录恒非空,给一个同值兜底
    const [stateDir = 'D:\\DevEnv\\state'] = defaultStateDirs()
    this.file = file ?? join(stateDir, 'ops-watch-dedup.json')
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      if (existsSync(this.file)) {
        const obj = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, DedupRecord>
        for (const [k, v] of Object.entries(obj)) this.mem.set(k, v)
      }
    } catch (e) {
      logger.warn('[ops-watch] 去重文件读取失败,从空状态启动(本会话内仍内存去重)', {
        file: this.file,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.file)
      if (!existsSync(dir)) return // 状态目录不存在 ⇒ 退回纯内存,不强行创建
      const tmp = `${this.file}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.mem)), 'utf8')
      renameSync(tmp, this.file) // 同目录原子替换,避免半写损坏
    } catch (e) {
      logger.warn('[ops-watch] 去重文件写入失败(本轮仅内存态)', {
        file: this.file,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }

  get(key: string): DedupRecord | undefined {
    this.ensureLoaded()
    return this.mem.get(key)
  }

  set(key: string, rec: DedupRecord): void {
    this.ensureLoaded()
    this.mem.set(key, rec)
    this.persist()
  }

  delete(key: string): void {
    this.ensureLoaded()
    if (this.mem.delete(key)) this.persist()
  }

  keys(): string[] {
    this.ensureLoaded()
    return [...this.mem.keys()]
  }

  clear(): void {
    this.mem.clear()
    this.persist()
  }
}

let _store: OpsWatchDedupStore | null = null
function getDedupStore(): OpsWatchDedupStore {
  if (!_store) _store = new OpsWatchDedupStore(process.env.OPS_WATCH_DEDUP_FILE)
  return _store
}

function readCdnFailThreshold(): number {
  const n = Number(process.env.OPS_WATCH_CDN_FAIL_THRESHOLD)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_CDN_FAIL_THRESHOLD
}

/** 与 check-ops-patrol 同款两形取值:pg-backup 族 `producer/alertId/title`,守护族 `name/fp/why`。 */
function pick(o: unknown, keys: string[]): string | null {
  for (const k of keys) {
    const v = (o as Record<string, unknown> | null)?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return null
}

const cap = (v: string | null, n = 90): string =>
  v === null ? '(未记)' : v.replace(/[\r\n]+/g, ' ').slice(0, n)

/**
 * 扫一个目录下的 UNDELIVERED 标记。目录不存在 ⇒ 空(开发机/非本机安静);
 * JSON 坏 ⇒ undetermined 口径 finding(不静默、不洗成通过)。
 */
export function scanUndeliveredDir(dir: string): WatchFinding[] {
  if (!existsSync(dir)) return []
  let files: string[]
  try {
    files = readdirSync(dir).filter((n) => UNDELIVERED_RE.test(n))
  } catch (e) {
    return [
      {
        key: `undelivered-dir:${dir}`,
        title: '未送达标记目录读不到',
        detail: `${dir}: ${(e as NodeJS.ErrnoException)?.code ?? (e as Error)?.message ?? '未知错误'}(未判定,不读成"无未送达")`,
        severity: 'warning',
      },
    ]
  }
  const out: WatchFinding[] = []
  for (const f of files) {
    const p = join(dir, f)
    let parsed: unknown = null
    try {
      parsed = JSON.parse(readFileSync(p, 'utf8'))
    } catch (e) {
      out.push({
        key: `undelivered-broken:${p}`,
        title: '未送达标记 JSON 坏',
        detail: `${f}: ${(e as Error)?.message?.slice(0, 120) ?? '解析失败'}(未判定,不读成"无未送达")`,
        severity: 'warning',
      })
      continue
    }
    const producer = pick(parsed, ['producer', 'name', 'source'])
    const title = pick(parsed, ['title', 'alertId', 'fp'])
    const reason = pick(parsed, ['reason', 'why'])
    const at = pick(parsed, ['at', 'ts'])
    out.push({
      key: `undelivered:${f}:${title ?? ''}`,
      title: `有告警从未到人:${f}`,
      detail:
        `生产者=${cap(producer)} 身份/标题=${cap(title)} 未送达时刻=${cap(at)} 原因=${cap(reason)}(原因截断,永不外传正文;` +
        '标记被下一次成功投递自动清除)',
      severity: 'critical',
    })
  }
  return out
}

/**
 * CDN 活性探测:任何 HTTP 应答(含 404 —— cdn-server 对不存在路径回占位 PNG)都算活着;
 * 只有连接失败/超时算死。默认做 2 次尝试(间隔 800ms)吸收单次抖动,整轮预算仍受 timeoutMs 约束。
 */
export async function probeCdnLiveness(
  url: string,
  timeoutMs = 3_000,
  fetchImpl: typeof fetch = fetch,
  opts: { retries?: number; retryGapMs?: number } = {},
): Promise<boolean> {
  const retries = opts.retries ?? 2
  const retryGapMs = opts.retryGapMs ?? 800
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) })
      return true
    } catch {
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, retryGapMs))
    }
  }
  return false
}

export interface OpsWatchDeps {
  /** 仓根(测试可指到临时目录)。 */
  repoRoot?: string
  /** alertbridge / ihui-monitor 的状态目录(其 UNDEL 标记与 STATE_FILE 同目录)。 */
  stateDirs?: string[]
  /** :80 CDN 探测端点。 */
  cdnUrl?: string
  /** 注入时钟(冷却判定)。 */
  now?: () => number
  /** 注入告警出口(测试断言用;缺省走 pushAlert 全渠道)。 */
  push?: (f: WatchFinding) => Promise<void> | void
  /** 注入 CDN 探测(测试断言用)。 */
  probe?: (url: string) => Promise<boolean>
  /** 注入去重存储(测试隔离用;缺省走落盘单例)。 */
  dedupStore?: OpsWatchDedupStore
  /** 注入 CDN 连续失败阈值(测试用)。 */
  cdnFailThreshold?: number
}

/** 仅供测试:清去重状态(含落盘文件)。生产代码禁调。 */
export function _resetDedupForTests(): void {
  getDedupStore().clear()
}

/** 内容指纹:同一 key 下内容变了 = 新故障,立即重报(不等冷却)。 */
function fingerprint(f: WatchFinding): string {
  return `${f.title}|${f.detail}`
}

async function defaultPush(f: WatchFinding): Promise<void> {
  await pushAlert({
    title: f.title,
    message: f.detail,
    severity: f.severity,
    source: 'ops-watch-reader',
  })
}

/** 状态目录缺省:alertbridge 默认 STATE_FILE 所在目录(其 UNDEL_FILE 与之同目录)。 */
function defaultStateDirs(): string[] {
  const envDir = process.env.OPS_WATCH_STATE_DIR
  return envDir ? [envDir] : ['D:\\DevEnv\\state']
}

/**
 * 跑一轮读方。返回本轮 findings(含被冷却/闩锁拦下的),供测试与手动调用。
 * 单个 finding 的 push 失败不外抛 —— 值守读方自己不能把自己跑死。
 */
export async function runOpsWatchTick(deps: OpsWatchDeps = {}): Promise<WatchFinding[]> {
  const repoRoot = deps.repoRoot ?? REPO_ROOT
  const stateDirs = deps.stateDirs ?? defaultStateDirs()
  const cdnUrl = deps.cdnUrl ?? process.env.OPS_CDN_PROBE_URL ?? 'http://127.0.0.1/'
  const now = deps.now ?? Date.now
  const push = deps.push ?? defaultPush
  const probe = deps.probe ?? ((u: string) => probeCdnLiveness(u))
  const store = deps.dedupStore ?? getDedupStore()
  const failThreshold = deps.cdnFailThreshold ?? readCdnFailThreshold()

  const findings: WatchFinding[] = [
    ...scanUndeliveredDir(join(repoRoot, '.workbuddy')),
    ...stateDirs.flatMap((d) => scanUndeliveredDir(d)),
  ]

  // ── CDN 活性:连续失败计数 + 闩锁(根因修复点)──
  const cdnKey = `cdn:${cdnUrl}`
  const cdnUp = await probe(cdnUrl)
  if (cdnUp) {
    const rec = store.get(cdnKey)
    if (rec && (rec.failures > 0 || rec.alerted)) {
      // 恢复 ⇒ 重置计数与闩锁,下一次真实宕机重新计次(不会因历史 episode 而永久静默)
      store.set(cdnKey, { at: rec.at, fp: rec.fp, failures: 0, alerted: false })
      logger.info('[ops-watch] CDN 探测恢复:连续失败计数清零,告警闩已重置')
    }
  } else {
    const rec = store.get(cdnKey) ?? { at: 0, fp: '', failures: 0, alerted: false }
    rec.failures += 1
    if (rec.failures < failThreshold) {
      store.set(cdnKey, rec)
      logger.warn(
        `[ops-watch] CDN 探测失败(连续第 ${rec.failures}/${failThreshold} 次);未达阈值,静默不告警(可能是 CDN/API 重启或瞬断)`,
      )
    } else {
      store.set(cdnKey, rec) // 达阈值,是否推送交由下方循环按 alerted 闩判定
    }
    findings.push({
      key: cdnKey,
      title: '图片 CDN 无应答',
      detail: `${cdnUrl} 连续 ${rec.failures} 次探测失败/超时(:80 不在传统值守端口清单内,由本读方兜住;进程载体=nssm 服务 IHUI-IMAGE-CDN)`,
      severity: 'critical',
    })
  }

  // ── 推送判定 ──
  const t = now()
  for (const f of findings) {
    const fp = fingerprint(f)
    if (f.key.startsWith('cdn:')) {
      // CDN:仅当达到阈值且该 outage episode 尚未告警时发一封;发出后本 episode 静默
      const rec = store.get(f.key)
      if (!rec || rec.failures < failThreshold || rec.alerted) continue
      try {
        await push(f)
        store.set(f.key, { at: t, fp, failures: rec.failures, alerted: true })
        logger.error(
          `[ops-watch] ${f.title} (连续 ${rec.failures} 次失败,已告警;宕机期间不再重复发送)`,
          {
            key: f.key,
          },
        )
      } catch (e) {
        logger.error('[ops-watch] 告警投递失败(下一轮重试)', {
          key: f.key,
          err: e instanceof Error ? e.message : String(e),
        })
      }
      continue
    }
    // 标记类:冷却去重(内容变 = 新故障立即重报)
    const prev = store.get(f.key)
    if (prev && prev.fp === fp && t - prev.at < ALERT_COOLDOWN_MS) continue
    try {
      await push(f)
      store.set(f.key, { at: t, fp, failures: 0, alerted: false })
      logger.error(`[ops-watch] ${f.title}`, { key: f.key, detail: f.detail })
    } catch (e) {
      logger.error('[ops-watch] 告警投递失败(下一轮重试)', {
        key: f.key,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // 已消失的 finding 清键:标记被成功投递清除后再次出现 = 新故障,必须立即重报。
  const live = new Set(findings.map((f) => f.key))
  for (const k of store.keys()) if (!live.has(k)) store.delete(k)

  if (findings.length === 0) logger.debug('[ops-watch] 本轮无发现(标记 0 枚 + CDN 应答)')
  return findings
}

// ===== 调度器 =====

let scheduledTask: ScheduledTask | null = null

export function startOpsWatchReaderScheduler(): void {
  if (scheduledTask) return
  scheduledTask = cron.schedule(
    '*/10 * * * *',
    async () => {
      try {
        await runOpsWatchTick()
      } catch (e) {
        // 读方自身异常只记日志 —— 值守读方炸了不该带走 API 进程。
        logger.error('[ops-watch] tick 异常', { err: e instanceof Error ? e.message : String(e) })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[ops-watch] scheduler started (cron: "*/10 * * * *" Asia/Shanghai)')
}

export function stopOpsWatchReaderScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    logger.info('[ops-watch] scheduler stopped')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
