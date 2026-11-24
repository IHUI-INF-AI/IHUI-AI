// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * registry-sync-audit.mjs — 守护巡检"资源目录同步停更"格的**审计层**(2026-10-25 立)。
 *
 * 为什么住 lib:git-guardian.mjs 顶着门 103 C1 的 6000 行天花板(现读 5960),本格按
 * `auditSweeperLiveness`/`check-batch-write` 的同一条先例把逻辑归位 lib,守护只留薄接线
 * (§0.6:判据一份实现;§12e:挂的是"停更才响"的增量档,DSN/psql 取不到一律未判定,
 * 绝不让缺库的机器恒响)。
 *
 * 尺子 = `scripts/check-registry-sync-health.mjs`(判据与三态退出码住那里);本层只做:
 * 节流(默认 30min)→ 派发 `--json` → 读数分档 → 红档经**唯一到人通道** notifyGuardRed,
 * 身份=类别+**当前停更episode 的锚**(lastSuccessAt 或 never-success),连续轮数只进出正文
 * 不进身份(224 V1:抖量不进身份,否则每轮一封新信)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const REGISTRY_SYNC_INTERVAL_MS = Number(
  process.env.IHUI_REGISTRY_SYNC_INTERVAL_MS || 30 * 60 * 1000,
)
export const REGISTRY_SYNC_TIMEOUT_MS = 95_000 // 尺子内 psql 60s + 进程起停余量(守门 80 同族)

/** 节流纯函数:取不到 tick ⇒ 该跑(与 publicProbeDue 同一条底线)。 */
export function registrySyncHealthDue(nowMs, tickMs, intervalMs = REGISTRY_SYNC_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

export function parseSyncHealthVerdict(stdout) {
  const lines = String(stdout ?? '')
    .split(/[\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  try {
    const p = JSON.parse(lines[lines.length - 1])
    if (!p || typeof p.state !== 'string') return null
    if (!['ok', 'finding', 'undetermined'].includes(p.state)) return null
    return p
  } catch {
    return null
  }
}

/**
 * 一跳审计。全部依赖注入(镜像测试不打真 psql/不发真邮件):
 *   runner: () => {status, stdout, stderr} | null(缺省 execFileSync 派生尺子)
 *   logger(text) / notify(name, detail, opts) —— notify 只在 state=finding 时被调。
 */
export function runRegistrySyncHealth({
  now = Date.now(),
  intervalMs = REGISTRY_SYNC_INTERVAL_MS,
  script,
  tickFile,
  cwd,
  execPath = process.execPath,
  logger = console.log,
  notify = () => ({ sent: false, why: 'notify 未注入 ⇒ 默认不声张(测试通道)' }),
  runner = null,
} = {}) {
  if (!script || !existsSync(script)) {
    logger(
      'ℹ️ 目录同步哨兵:尺子不在位(scripts/check-registry-sync-health.mjs)⇒ 本轮跳过,不记为已巡检',
    )
    return { ran: false, why: '尺子不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!registrySyncHealthDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, new Date(now).toISOString(), 'utf8')
  } catch {
    /* 台账写不进不拦巡检本体 */
  }
  const call =
    typeof runner === 'function'
      ? runner()
      : (() => {
          try {
            const out = execFileSync(execPath, [script, '--json'], {
              cwd,
              encoding: 'utf8',
              windowsHide: true, // §5f
              timeout: REGISTRY_SYNC_TIMEOUT_MS, // 守门 80
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'], // §12g
            })
            return { status: 0, stdout: String(out || ''), stderr: '' }
          } catch (e) {
            return {
              status: typeof e?.status === 'number' ? e.status : 2,
              stdout: String(e?.stdout || ''),
              stderr: String(e?.stderr || e?.message || ''),
            }
          }
        })()
  const p = parseSyncHealthVerdict(call.stdout)
  if (!p) {
    logger(
      `ℹ️ 目录同步哨兵:未判定(rc=${call.status})—— ${String(
        call.stderr || call.stdout || '(无输出)',
      )
        .split(/[\r\n]+/)[0]
        .slice(0, 140)}`,
    )
    return { ran: true, judged: false, why: '读数不可解析' }
  }
  if (p.state === 'undetermined') {
    // 机器态缺库/缺 psql 不喊人(§12e:与提交内容无关的恒响只会废掉通道);留一行可见。
    logger(`ℹ️ 目录同步哨兵:未判定 —— ${String(p.reason ?? '').slice(0, 140)}`)
    return { ran: true, judged: false, state: p.state }
  }
  if (p.state === 'ok') {
    logger(
      `✅ 目录同步哨兵:健康 —— ${String(p.reason ?? '')}${p.consecutiveBad ? `(其前连续 fail/skipped=${p.consecutiveBad},已恢复)` : ''}`,
    )
    return { ran: true, judged: true, state: 'ok' }
  }
  const episodeAnchor = p.lastSuccessAt ? `last=${p.lastSuccessAt}` : 'never-success'
  const outcome = notify(
    '资源目录同步停更(registry-sync)',
    `判据: ${String(p.reason ?? '').slice(0, 300)}\n取证: node scripts/check-registry-sync-health.mjs(三态);明细在 registry_sync_logs(source_name='all')的 error_message 与 svc-api 日志 "registry-sync:" 行。\n处置: 先读最近一轮 errorMessage —— 批内 21000 已修(33cf83062e1 批内去重);上游全空手(每轮 skipped)是网络段问题,可按 apps/api/.env 配 IHUI_REGISTRY_EGRESS_PROXY 借道(见 apps/api/src/services/registry-sync/types.ts 头注)。`,
    { dedupKey: `stale;${episodeAnchor}` },
  )
  logger(
    outcome && outcome.suppressed
      ? `ℹ️ 目录同步哨兵:同一停更窗口已通报,本轮压住 —— ${String(p.reason ?? '').slice(0, 120)}`
      : `❌ 目录同步哨兵:停更已派发到邮件通道 —— ${String(p.reason ?? '').slice(0, 120)}`,
  )
  return { ran: true, judged: true, state: 'finding' }
}

export const __test__ = { registrySyncHealthDue, parseSyncHealthVerdict, runRegistrySyncHealth }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
