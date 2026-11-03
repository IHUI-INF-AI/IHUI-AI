// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dev-db-rotation-policy.mjs — 本机 dev 库口令轮换的**派发决定器**(票 O69,2026-11-01)。
 *
 * 为什么单抽一层:轮换器自己已 fail-closed(8801/8802/8803 任一活服务 ⇒ exit 2 窗口未到),
 * 但没人调度它 ⇒ 窗口只能靠人盯。挂进 guardian 巡检要能回答三个问题,且必须可被测试钉死:
 *   ① 有没有**未结清**条目(没有 ⇒ 零动作,不许空转「假装巡检过」);
 *   ② 窗口判定取不到(未判定)⇒ **绝不派生**(§0.3:不拿「没看见服务」当「没有服务」);
 *   ③ 冷却中不反复派发(失败只冷却不硬试)。
 *
 * 纯函数、零 IO:本层只出 `{ act, state, why }`;读挂起标记/节流戳/端口的 IO 归调用方。
 */

export const DEV_DB_ROTATION_COOLDOWN_MS = 60 * 60 * 1000

/**
 * @param {object} input
 * @param {boolean} input.pending 是否有未结清条目
 * @param {number[]|null} input.livePorts 活服务端口;null = 取不到(未判定)
 * @param {string|null} input.lastAttemptIso 上一次尝试时刻(ISO)
 * @param {number} input.nowMs 当前毫秒
 * @param {number} [input.cooldownMs]
 * @returns {{act:boolean,state:string,why:string}}
 */
export function decideDevDbRotation({
  pending,
  livePorts,
  lastAttemptIso = null,
  nowMs,
  cooldownMs = DEV_DB_ROTATION_COOLDOWN_MS,
} = {}) {
  if (!pending) return { act: false, state: 'no-pending', why: '登记面无未结清条目' }
  if (!Array.isArray(livePorts))
    return { act: false, state: 'undetermined', why: '窗口探测取不到(不猜成空闲)' }
  if (livePorts.length > 0)
    return { act: false, state: 'window-busy', why: `活服务在听:${livePorts.join(',')}` }
  if (lastAttemptIso) {
    const last = Date.parse(String(lastAttemptIso))
    if (Number.isFinite(last) && nowMs - last < cooldownMs)
      return { act: false, state: 'throttled', why: '冷却窗口内(失败只冷却不硬试)' }
  }
  return { act: true, state: 'act', why: '有未结清条目且窗口空闲' }
}

export const __test__ = { decideDevDbRotation, DEV_DB_ROTATION_COOLDOWN_MS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
