// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/lib/ai-service-residency-runtime.mjs — 签到常驻腿的纯判据单源(§0.6)
//
// 立因(2026-11-16 机主裁决):签到调度器与进程保活心跳住在 ai-service 单进程内,
// dev 服务按 11-10 纪律「按需启停」⇒ 服务不在时自动签到静默断代(实测流水停摆 4 天)。
// 判据记录(docs/tickets/2026-11/signin-residency-20261116.md):允许 ai-service 一枚进程
// 最小幂等常驻;本 lib 只做取值/装配/守卫这类**纯判据**,一切 IO 在两个消费方:
//   scripts/ensure-ai-service-residency.mjs   (执行体:探测→拉起→记账)
//   scripts/register-signin-residency-task.mjs(注册器:计划任务装配,闸=policy lib)
// 单 worker 契约:run-ai.ps1 头注(签到风控第五件套,2026-10-16)对 OutboundGate/APScheduler
// 是进程级状态的实证结论 ⇒ uvicorn 参数里出现 --workers/--reload 必须当场拒绝,
// 这条判据从口头注释提升为机器判据(本文件 guardSingleWorker,测试镜像钉住)。

/** 签到常驻腿固定端口(与 docs/port-management.md 8803=AI Service 同源) */
export const AI_SERVICE_PORT = 8803

/** 健康探测 URL(ensure 与 --status 共用同一取值实现,§0.6) */
export function healthProbeUrl({ port = AI_SERVICE_PORT, host = '127.0.0.1' } = {}) {
  return `http://${host}:${port}/health`
}

/** .env 文本 → 键值对(纯函数;注释/空行/无等号行忽略;值去首尾空白与成对双引号) */
export function parseEnvFileText(text) {
  const out = {}
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    const key = line.slice(0, i).trim()
    if (!key) continue
    let value = line.slice(i + 1).trim()
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/**
 * 分层合并(后层覆盖前层)。11-16 实测顺序权威:根 .env 打底、apps/api/.env 覆盖
 * (当日 psql 用根串连库失败、api 串成功 ⇒ 本机 PG 真相在 api 层)。
 */
export function mergeEnvLayers(...layers) {
  const out = {}
  for (const layer of layers) Object.assign(out, layer ?? {})
  return out
}

/**
 * 部署入口注入语义(与 run-ai.ps1 第 59 行「未设置则 true」逐字同源):
 * CHECKIN_CRON_ENABLED 缺省 ⇒ 注入 'true';显式设了(含 'false')原样保留。
 */
export function withResidencyDefaults(env) {
  const out = { ...env }
  if (String(out.CHECKIN_CRON_ENABLED ?? '').trim() === '') {
    out.CHECKIN_CRON_ENABLED = 'true'
  }
  return out
}

/** uvicorn 启动参数(单 worker 形态)。extraArgs 仅用于测试注入禁止项。 */
export function buildUvicornArgs({
  host = '127.0.0.1',
  port = AI_SERVICE_PORT,
  extraArgs = [],
} = {}) {
  return ['uvicorn', 'app.main:app', '--host', host, '--port', String(port), ...extraArgs]
}

/**
 * 单 worker 守卫:args 里出现 --workers/-w/--reload 即违规(nssm run-ai.ps1 头注的
 * 机器化;多进程会让 OutboundGate 与各份每日 job 各跑各的,封号面自杀)。
 */
export function guardSingleWorker(args) {
  for (const a of args.map(String)) {
    if (a === '--workers' || a === '-w' || a.startsWith('--workers=')) {
      return { ok: false, why: `禁止多 worker(命中 ${a}):签到闸门是进程级状态` }
    }
    if (a === '--reload') {
      return { ok: false, why: '禁止 --reload:与单 worker 契约同锁(run-ai.ps1 头注)' }
    }
  }
  return { ok: true, why: '' }
}

/**
 * 运行时二选一(纯判据,存在性由调用方传入):
 * venv python(-m uvicorn,最快、无 uv sync 网络风险)优先;回落 uv run;都没有 ⇒ null。
 */
export function selectRuntimeEntry({ venvPython, uvExe, uvicornImportable } = {}) {
  if (venvPython && uvicornImportable) {
    const args = ['-m', ...buildUvicornArgs()] // ['-m','uvicorn','app.main:app',...]
    const g = guardSingleWorker(args)
    if (!g.ok) return { error: g.why }
    return { command: venvPython, args }
  }
  if (uvExe) {
    const args = ['run', ...buildUvicornArgs()]
    const g = guardSingleWorker(args)
    if (!g.ok) return { error: g.why }
    return { command: uvExe, args }
  }
  return null
}

/** pid 账本文件名(落 .ihui-agent/state/,同 stale-claim-strip 留痕先例)。 */
export const PID_FILE_NAME = 'ai-service-residency.pid'
export const LOG_FILE_NAME = 'ai-service-residency.log'

/** pid 记录序列化/解析:pid + 进程创建时刻(毫秒,CIM);取不到创建时刻 ⇒ null(停止侧据此拒杀) */
export function serializePidRecord({ pid, procStartMs }) {
  if (!Number.isInteger(pid) || pid <= 0) return null
  const start = Number.isFinite(procStartMs) ? String(Math.floor(procStartMs)) : '-'
  return `${pid} ${start}`
}

export function parsePidRecord(text) {
  const m = /^(\d+)\s+(\d+|-)$/.exec(String(text ?? '').trim())
  if (!m) return null
  const pid = Number(m[1])
  if (!Number.isInteger(pid) || pid <= 0) return null // 与写入侧 serialize 同形:pid 必须 ≥1
  return { pid, procStartMs: m[2] === '-' ? null : Number(m[2]) }
}

/** 日志尺寸轮转判据(纯):超限保留尾部 keepBytes 前的完整行;取不到尺寸/坏形状 ⇒ 不动。 */
export function shouldRotateLog({ sizeBytes, limitBytes = 5 * 1024 * 1024 }) {
  return Number.isFinite(sizeBytes) && sizeBytes > limitBytes
}

/** 触发器节拍(分钟):30min = 「断供最坏补位窗口」,不制造 2 分钟复活风暴(§5e 教训)。 */
export const RESIDENCY_INTERVAL_MINUTES = 30
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
