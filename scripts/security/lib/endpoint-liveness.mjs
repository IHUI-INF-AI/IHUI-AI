#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 入口存活判据(2026-11-25 立)。
 *
 * 为什么需要它:
 *   nssm 的 AppExit[Default]=Restart 覆盖的只是「进程退出」——进程死了会被自动拉起。
 *   真正没人管的是另一种: **进程活着、端口在 LISTENING、但请求没人应答**。
 *   僵死(死锁/事件循环堵死/上游后端卡住)时 nssm 看不出任何异常,
 *   服务状态是 SERVICE_RUNNING,Last Result 是 0,而用户侧已经全站不可用。
 *   这种故障只有主动发请求才看得见。
 *
 * 判据刻意极简,只回答一个问题:「它还能不能应答」。
 *   活: 收到任何 HTTP 响应且状态码 < 500 —— 4xx 说明服务在正常工作(限流/权限/404 都算活着)
 *   死: 连接被拒 / 超时 / 主机不可达 / 5xx —— 5xx 说明服务端自己崩了,不能算活
 *   未判定: 取不到状态也不属于上面两类的(比如 HTTP 库报了个我们不认识的错)
 *
 * 本层纯函数零 IO;探测实际怎么发、连续多少次算真故障,都留给执行层。
 */

export const LIVENESS_STATE = Object.freeze({
  OK: 'ok',
  BREACH: 'breach',
  UNDETERMINED: 'undetermined',
})

/** 判定为「连接层面就不通」的错误码 —— 这类一定是死,不需要再看状态码。 */
export const DEAD_ERRORS = Object.freeze([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'ENOTFOUND',
])

const DEAD_ERROR_SET = new Set(DEAD_ERRORS)

/** 5xx 及以上算「服务端不能服务」。4xx 及以下算活着。 */
export const DEAD_STATUS_FROM = 500

/**
 * 判一条探测。
 * @param {{name:string,url:string,status?:number|null,latencyMs?:number|null,error?:string|null,expectStatus?:number|null}} probe
 * @returns {{name:string,url:string,verdict:'alive'|'dead'|'undetermined',reason:string,status:number|null,latencyMs:number|null}}
 */
export function judgeProbe(probe) {
  const name = String(probe?.name || '(unnamed)')
  const url = String(probe?.url || '')
  const status = Number.isFinite(Number(probe?.status)) && probe?.status != null ? Number(probe.status) : null
  const latencyMs = Number.isFinite(Number(probe?.latencyMs)) ? Number(probe.latencyMs) : null
  const error = probe?.error == null ? null : String(probe.error)

  /* 连接层错误:一定是死。 */
  if (error) {
    const code = (error.match(/\b([A-Z_]{4,})\b/) || [])[1] || ''
    if (DEAD_ERROR_SET.has(code)) {
      return { name, url, verdict: 'dead', reason: `连接失败 ${code}`, status, latencyMs }
    }
    if (/timeout|timed out|超时/i.test(error)) {
      return { name, url, verdict: 'dead', reason: `请求超时(${latencyMs ?? '?'}ms)`, status, latencyMs }
    }
    return { name, url, verdict: 'undetermined', reason: `探测异常: ${error.slice(0, 80)}`, status, latencyMs }
  }

  if (status == null) {
    return { name, url, verdict: 'undetermined', reason: '没有状态码也没有错误(探测实现可能没跑)', status, latencyMs }
  }

  if (status >= DEAD_STATUS_FROM) {
    return { name, url, verdict: 'dead', reason: `HTTP ${status}(服务端错误)`, status, latencyMs }
  }

  /* 显式期望:调用方点名要 200,那就只认 200。 */
  const expect = Number.isFinite(Number(probe?.expectStatus)) ? Number(probe.expectStatus) : null
  if (expect != null && status !== expect) {
    return { name, url, verdict: 'undetermined', reason: `HTTP ${status} 与期望 ${expect} 不符(但连接是通的)`, status, latencyMs }
  }

  return { name, url, verdict: 'alive', reason: `HTTP ${status}`, status, latencyMs }
}

/**
 * 汇总多探针 + 连续失败计数。
 * @param {object[]} probes
 * @param {{prevConsecutiveFail?:number}} opts 上一轮的连续失败次数(执行层从台账读)
 * @returns {{state:string,rows:object[],dead:string[],undetermined:string[],total:number,
 *            consecutiveFail:number,reason:string}}
 */
export function judgeLiveness(probes, opts = {}) {
  const rows = (probes || []).map((p) => {
    const r = judgeProbe(p)
    /* counted=false 的是演练端点(临时注入的那个):照判、照显示,但不许把它算进
       「连续几次」—— 演练若污染计数,下一次真故障就会提前触发重启。 */
    return { ...r, counted: p?.counted !== false }
  })
  const dead = rows.filter((r) => r.verdict === 'dead').map((r) => r.name)
  const deadCounted = rows.filter((r) => r.verdict === 'dead' && r.counted).map((r) => r.name)
  const undetermined = rows.filter((r) => r.verdict === 'undetermined').map((r) => r.name)
  const prev = Number.isFinite(Number(opts.prevConsecutiveFail)) ? Number(opts.prevConsecutiveFail) : 0
  const consecutiveFail = deadCounted.length > 0 ? prev + 1 : 0

  let state = LIVENESS_STATE.OK
  let reason
  if (dead.length > 0) {
    state = LIVENESS_STATE.BREACH
    reason = `${dead.length}/${rows.length} 个端点不应答(连续第 ${consecutiveFail} 次): ${dead.join('、')}`
  } else if (undetermined.length > 0) {
    state = LIVENESS_STATE.UNDETERMINED
    reason = `${undetermined.length}/${rows.length} 个端点判不出`
  } else {
    reason = `${rows.length} 个端点全部应答`
  }
  return { state, rows, dead, undetermined, total: rows.length, consecutiveFail, reason }
}

/** 连续失败达到阈值才动服务 —— 一次抖动不重启生产。 */
export const HEAL_THRESHOLD = 2

/**
 * 是否该动手自愈。
 * 只有「连续失败 ≥ 阈值」且「点名了具体端点」才返回动作,其余一律 []。
 * 这条判据单独存在,是为了让「什么时候可以重启生产」这件事有唯一答案。
 */
export function healActions(result, opts = {}) {
  const threshold = Number.isFinite(Number(opts.threshold)) ? Number(opts.threshold) : HEAL_THRESHOLD
  if (!result || result.state !== LIVENESS_STATE.BREACH) return []
  if (Number(result.consecutiveFail || 0) < threshold) return []
  return result.dead.map((name) => ({ name, action: 'restart-service' }))
}

/** 给每条 dead 一句可执行的下一步。 */
export function remediationForLiveness(result) {
  const out = []
  for (const name of result?.dead || []) {
    out.push(
      `${name}: 先 netstat -ano | Select-String ':8801|:8802' 看端口是否还 LISTENING;端口在但不应答 ⇒ 死锁,Stop-Service -Force 后 Start-Service;端口不在 ⇒ nssm 应已自动重启,查 D:\\DevEnv\\logs\\svc-*.log`,
    )
  }
  for (const name of result?.undetermined || []) {
    out.push(`${name}: 判不出原因,先手工 curl 一次确认是探测实现的问题还是服务的问题`)
  }
  return out
}

export const __test__ = { DEAD_ERROR_SET, DEAD_STATUS_FROM, HEAL_THRESHOLD }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
