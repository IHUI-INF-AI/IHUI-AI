// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * push-state.json 的「在途」判据 —— 唯一实现(guard / check-push-sync / sync-converge 共用)。
 *
 * 要修的故障是 2026-11-07 07:48 的实测现场(DB 席):
 *   worker 子进程在父进程退出同秒死亡,`git-push-guard-async.log` 0 字节,
 *   `push-state.json` 停在 running(pid 3192),远端一动没动。
 * 这种状态一旦被下一轮读成"仍在推",推送就既不发生也不报错 —— fail-open 长在**状态机**上。
 *
 * 判据只有一条:只有「pid 活着 **且** 记录/现测启动时刻一致」的 running 才算在途。
 *   - pid 已不存在                        ⇒ 中止(dead)
 *   - 启动时刻不同(同一 pid 已被复用)     ⇒ 中止(reused)
 *   - 有记录启动时刻、但现测取不到          ⇒ 中止(unverifiable:不把无法核验的身份当在途)
 *   - 旧档没有 pidStart                    ⇒ 维持改动前行为(pid 存活 + 未过期 = 在途)
 *     这是刻意保留的向后兼容:升级期老 worker 还在跑,把旧档一律判死会派第二只 worker
 *     去撞 non-FF。新写的 running 一律带 identityFieldsForPid(),所以再不会有"裸 pid"新档。
 *
 * 方向说明:本判据的目的不是"少推一次",而是"不许静默空转"。因此有凭据却核不上时
 * 选择中止(可能多推一次,由 worker 串行化与 non-FF 兜住),而不是把无法核验当成在途。
 */
import { hostname } from 'node:os'

import { processStartEpoch, verifyHolder } from './proc-identity.mjs'

/** 与三处读取方既有口径一致的过期窗(5 分钟)。 */
export const PUSH_STATE_STALE_MS = 5 * 60 * 1000

/** pid 存活探测(signal 0)。EPERM = 活着但不属于本会话。空 pid 一律判死(旧实现返回 true = fail-open)。 */
export function isPidAlive(pid) {
  const n = Number(pid)
  if (!Number.isFinite(n) || n <= 0) return false
  if (n === process.pid) return true
  try {
    process.kill(n, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/**
 * 写侧身份凭据:记「判活所问那个 pid」的启动时刻 + 主机名(不是当前进程)。
 * `pidStart` 量不到 ⇒ 该键不写(JSON.stringify 会整键丢掉),判读侧按"旧档"处理 ——
 * 绝不写 0 / 假值来冒充"已记录"。
 */
export function identityFieldsForPid(pid, { run, host = hostname(), highPrecision = true } = {}) {
  const res = processStartEpoch(pid, { ...(run ? { run } : {}), highPrecision })
  return {
    host,
    ...(Number.isFinite(res.epoch) && res.epoch > 0 ? { pidStart: res.epoch } : {}),
    ...(typeof res.precise === 'string' && res.precise !== '' ? { pidStartPrecise: res.precise } : {}),
  }
}

/**
 * 判 running 是否仍在途。
 * @param {object} st push-state 读数
 * @param {{headSha?:string|null, now?:number, isAlive?:Function, identity?:Function}} [opts]
 *   `isAlive` / `identity` 供夹具注入,默认走真实探测(identity 即 proc-identity 的 verifyHolder)。
 * @returns {{active:boolean, kind:string, why:string}}
 */
export function judgeRunningState(
  st,
  { headSha = null, now = Date.now(), isAlive = isPidAlive, identity = verifyHolder } = {},
) {
  if (!st || typeof st !== 'object' || st.status !== 'running') {
    return { active: false, kind: 'not-running', why: `状态不是 running(status=${st?.status ?? '无'})` }
  }
  if (headSha && st.headSha !== headSha) {
    return {
      active: false,
      kind: 'other-head',
      why: `状态属于另一 HEAD(${String(st.headSha).slice(0, 7)})`,
    }
  }
  if (!(now - Number(st.ts) < PUSH_STATE_STALE_MS)) {
    return { active: false, kind: 'stale', why: '状态已超过 5 分钟未心跳(视为已中止)' }
  }
  if (!isAlive(st.pid)) {
    return { active: false, kind: 'dead', why: `持有者 pid ${st.pid} 已不存在(退出后未写终态)` }
  }
  const hasRecorded = Number(st.pidStart) > 0
  if (!hasRecorded) {
    return {
      active: true,
      kind: 'legacy',
      why: `pid ${st.pid} 存活(旧档未记启动时刻 ⇒ 维持改动前判据)`,
    }
  }
  const verdict = identity({
    pid: st.pid,
    pidStart: st.pidStart,
    host: st.host,
    pidStartPrecise: st.pidStartPrecise,
  })
  if (verdict.kind === 'match') {
    return { active: true, kind: 'match', why: `pid ${st.pid} 存活且启动时刻一致` }
  }
  if (verdict.kind === 'mismatch') {
    return { active: false, kind: 'reused', why: `pid ${st.pid} 已被复用(${verdict.why ?? '启动时刻不符'})` }
  }
  return {
    active: false,
    kind: 'unverifiable',
    why: `pid ${st.pid} 存活但身份无法核验(${verdict.why ?? '启动时刻取不到'})`,
  }
}

export const __test__ = { isPidAlive, identityFieldsForPid, judgeRunningState }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
