// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 常驻进程监管子进程的纯裁决。本函数不派生任何进程。
 *
 * 只有 start、restart、install 三个命令会派生监管子进程。
 * 没取到的其余命令名不得当成安全跳过，必须未判定。
 * 监管进程失败时拒绝后续请求，正常返回拒绝结论，不把异常抛给发起方。
 * 监管已经活着时，start 与 install 不再派生第二个；restart 仍然派生替换。
 * 失败态不重试派生。
 * 命令或监管状态没量到时，不派生也不接纳。
 *
 * 输入 command、supervisorState。supervisorState 只认 absent、live、failed。
 * 返回 disposition、reason、spawn、accept。spawn 与 accept 恒为布尔。
 */

export const DAEMON_SUPERVISOR_COMMANDS = Object.freeze(['start', 'restart', 'install'])

const KNOWN_SUPERVISOR_STATES = new Set(['absent', 'live', 'failed'])

function verdict(disposition, reason, spawn, accept) {
  return { disposition, reason, spawn, accept }
}

/**
 * @param {{ command?: unknown, supervisorState?: unknown } | null | undefined} input
 * @returns {{
 *   disposition: 'unjudged' | 'refused' | 'admitted',
 *   reason: string,
 *   spawn: boolean,
 *   accept: boolean,
 * }}
 */
export function decideDaemonSupervisor(input) {
  const command = input?.command
  if (typeof command !== 'string' || command.trim() === '') {
    return verdict('unjudged', 'command-unmeasured', false, false)
  }
  if (!DAEMON_SUPERVISOR_COMMANDS.includes(command)) {
    return verdict('unjudged', 'command-unknown', false, false)
  }

  const supervisorState = input?.supervisorState
  if (typeof supervisorState !== 'string' || !KNOWN_SUPERVISOR_STATES.has(supervisorState)) {
    return verdict('unjudged', 'supervisor-unmeasured', false, false)
  }
  if (supervisorState === 'failed') {
    return verdict('refused', 'supervisor-down', false, false)
  }
  if (supervisorState === 'live' && (command === 'start' || command === 'install')) {
    return verdict('admitted', 'supervisor-live', false, true)
  }
  if (supervisorState === 'live' && command === 'restart') {
    return verdict('admitted', 'supervisor-replace', true, true)
  }
  if (supervisorState === 'absent') {
    return verdict('admitted', 'supervisor-create', true, true)
  }
  return verdict('unjudged', 'supervisor-unmeasured', false, false)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
