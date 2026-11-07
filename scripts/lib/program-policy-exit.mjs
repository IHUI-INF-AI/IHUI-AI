// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 程序策略检查的退出码裁决。
 *
 * 对照契约是三码：0 表示允许或未配置，126 表示禁用程序，13 表示策略检查不可用并因此拒绝。
 * 取不到 broker 就拒绝执行，不放行。
 *
 * 超越：对照把「未配置」也映射成退出码 0，看起来像允许。
 * 本仓把未配置、以及没量到的值都记为 unjudged，exitCode 为 null，不得执行。
 * 只有三件同时成立才给退出码 0：broker 可达、已配置、程序未被禁用。
 *
 * 判定顺序固定。先遇到的缺口先落结论，后面的字段不再改写。
 */

/**
 * @param {object} [input]
 * @param {unknown} [input.brokerReachable]
 * @param {unknown} [input.configured]
 * @param {unknown} [input.programDisabled]
 * @returns {{
 *   disposition: 'unjudged' | 'refused' | 'admitted',
 *   reason: string,
 *   exitCode: 0 | 13 | 126 | null,
 *   action: 'none' | 'execute',
 * }}
 */
export function judgeProgramPolicy(input) {
  const src = input !== null && typeof input === 'object' ? input : {}
  const { brokerReachable, configured, programDisabled } = src

  if (typeof brokerReachable !== 'boolean') {
    return { disposition: 'unjudged', reason: 'broker-unmeasured', exitCode: null, action: 'none' }
  }
  if (brokerReachable === false) {
    return { disposition: 'refused', reason: 'policy-unavailable', exitCode: 13, action: 'none' }
  }
  if (typeof programDisabled !== 'boolean') {
    return { disposition: 'unjudged', reason: 'program-unmeasured', exitCode: null, action: 'none' }
  }
  if (programDisabled === true) {
    return { disposition: 'refused', reason: 'program-disabled', exitCode: 126, action: 'none' }
  }
  if (typeof configured !== 'boolean') {
    return { disposition: 'unjudged', reason: 'config-unmeasured', exitCode: null, action: 'none' }
  }
  if (configured === false) {
    return { disposition: 'unjudged', reason: 'policy-unconfigured', exitCode: null, action: 'none' }
  }
  return { disposition: 'admitted', reason: 'policy-allow', exitCode: 0, action: 'execute' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
