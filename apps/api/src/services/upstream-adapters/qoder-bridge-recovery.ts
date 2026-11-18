// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桥接恢复策略(2026-11-18 立)。
 *
 * 立因:Qoder chat 只能走本机 CLI 桥接(HTTP 直连要求私有签名,已否决)。桥接是**子进程**,
 * 失败形态比 HTTP 多:端口被占、进程找不到、SDK 路径缺、登录态过期、连续失败把池拖垮。
 * 此前这些判断散在 adapter 的分支里,无法单测也无法解释"为什么这一轮不再重试"。
 *
 * 本层把它抽成**纯判定**:给定失败形态,输出下一步动作与理由,零 IO。
 * 上层(adapter / 调度)只执行,不再各自发明阈值。
 *
 * 纪律:判不出动作就返回 `stop` + 原因,绝不"随便再试一次"。
 */

export type BridgeRecoveryAction = 'retry' | 'cooldown' | 'drop-session' | 'stop'

export interface BridgeRecoveryInput {
  /** 失败语义码:401=登录态,0=网络/进程,其它=上游码 */
  statusCode: number
  /** 连续失败次数(含本次) */
  consecutiveFailures: number
  /** 失败正文(用于识别端口占用/进程缺失) */
  failureText?: string | null
  /** 是否已知端口被占 */
  portConflict?: boolean
  /** 是否已知 runner/SDK 路径缺失 */
  missingArtifact?: boolean
}

export interface BridgeRecoveryDecision {
  action: BridgeRecoveryAction
  delayMs: number
  reason: string
}

/** 退避:1s 起,指数到 60s 封顶(仅用于 retry/cooldown) */
export function bridgeBackoffMs(attempt: number): number {
  const n = Math.max(0, Math.min(6, Math.floor(attempt)))
  return Math.min(60_000, 1_000 * 2 ** n)
}

export function planBridgeRecovery(input: BridgeRecoveryInput): BridgeRecoveryDecision {
  const failures = Math.max(1, Math.floor(input.consecutiveFailures || 1))
  const text = typeof input.failureText === 'string' ? input.failureText : ''

  if (input.missingArtifact) {
    return {
      action: 'stop',
      delayMs: 0,
      reason: 'runner / SDK / CLI 路径缺失:重试不会让文件出现,必须先补配置(env QODER_BRIDGE_RUNNER / QODER_SDK_PATH / QODER_CLI_PATH)',
    }
  }

  if (input.portConflict || /EADDRINUSE|address already in use|端口.*占用/i.test(text)) {
    return {
      action: 'stop',
      delayMs: 0,
      reason: '端口被占:继续重试只会反复失败,须先定位占用进程或换端口',
    }
  }

  if (input.statusCode === 401 || /unauthorized|not logged in|登录|凭证过期/i.test(text)) {
    return {
      action: 'drop-session',
      delayMs: 0,
      reason: '登录态失效:冷却没有意义,应把该账号从调度摘除并提示重新登录',
    }
  }

  if (failures >= 5) {
    return {
      action: 'stop',
      delayMs: 0,
      reason: `连续 ${failures} 次失败:已超过自愈阈值,停止重试并转人工,避免拖垮同池其它账号`,
    }
  }

  if (failures >= 3) {
    return {
      action: 'cooldown',
      delayMs: bridgeBackoffMs(failures),
      reason: `连续 ${failures} 次失败:进入冷却,退避 ${bridgeBackoffMs(failures)}ms 后再试`,
    }
  }

  if (input.statusCode === 0) {
    return {
      action: 'retry',
      delayMs: bridgeBackoffMs(failures - 1),
      reason: `进程/网络类失败(第 ${failures} 次):退避 ${bridgeBackoffMs(failures - 1)}ms 后重试`,
    }
  }

  return {
    action: 'cooldown',
    delayMs: bridgeBackoffMs(failures),
    reason: `上游返回 ${input.statusCode}:不在本层可自愈范围,冷却后交调度判`,
  }
}

export const __test__ = { bridgeBackoffMs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
