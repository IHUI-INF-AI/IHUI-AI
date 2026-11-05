// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * push-race-retry.mjs —— 远端 ref 竞态要不要再推一趟(纯判据,零 IO)
 *
 * 立因(2026-11-04 实测):`lib/push-attempt-triage.mjs` 第 291 行早就把出路写明白了 ——
 *   "远端 tip 是本地祖先 ⇒ 本地什么都没丢,直接重推即可(不要动仓库设置、不要跑收敛器)"
 * 但那句话**一直只在文案里,没有任何一处代码走它**。于是这一型每次都以"失败"收尾,
 * 只能等下一条 commit 顺带重推;而下一趟 push 又要先过 pre-push 全量门
 * (本机 worker 日志现读「总耗时: 206.8s」),窗口里别人又推进 ⇒ 再撞一次。
 * 现读后果:`git rev-list --left-right --count origin/main...HEAD` = 远端领先 0 / 本地领先 20,
 * 远端 tip 从 05:20Z 起冻在 c2107d9,而 push-state 一路 running→failed。
 *
 * 本器把那条出路器物化:调用方负责量两件事(远端 tip 取不取得到、它是否已被本地包含),
 * 本器只决定走哪条出口 —— 判据与 IO 分开,才能被测试钉住。
 *
 * 三条不变量(每条各有反向夹具,见 scripts/tests/push-race-retry.test.mjs):
 *   ① 非 remote-ref-race 一律 stop —— 否则 hook-failed 也能借"重试"把跳门洗白;
 *   ② 量不到输入一律 stop 且 converge=false —— 不猜,也不把人支去跑收敛器;
 *   ③ 远端 tip 不在本地 ⇒ 真分叉,唯一出口是 converge —— 本器**永不** merge、永不 force、
 *      永不建议 --no-verify(竞态是服务器侧的 base 校验,跳本地门关不上它)。
 */

/** 默认重试上限。到顶仍撞同一型 ⇒ 停手报红:那说明有别的东西在持续抢同一枚 ref。 */
export const RACE_RETRY_MAX = 4

/**
 * @param {object} p
 * @param {string} p.kind            push-attempt-triage 的分诊结论
 * @param {number} [p.attemptNo]     已经重试过几趟(0 起)
 * @param {number} [p.max]
 * @param {boolean} [p.tipReadable]  现读远端 tip 是否拿到
 * @param {boolean} [p.tipIsAncestorOfLocal] 远端 tip 是否已是本地 HEAD 的祖先
 * @returns {{action:'retry'|'stop',converge:boolean,why:string}}
 */
export function decideRaceRetry({
  kind,
  attemptNo = 0,
  max = RACE_RETRY_MAX,
  tipReadable = false,
  tipIsAncestorOfLocal = false,
} = {}) {
  if (kind !== 'remote-ref-race') {
    return { action: 'stop', converge: false, why: `本器只处理 remote-ref-race,现型 ${String(kind)} ⇒ 交回各自分档处置` }
  }
  if (!tipReadable) {
    return { action: 'stop', converge: false, why: '现读不到远端 tip ⇒ 不猜,维持失败(也不记成"已推上去")' }
  }
  if (!Number.isInteger(attemptNo) || attemptNo < 0 || !Number.isInteger(max) || max < 1) {
    return { action: 'stop', converge: false, why: `重试计数取不到(attemptNo=${String(attemptNo)} max=${String(max)})⇒ 未判定,不猜趟数` }
  }
  if (!tipIsAncestorOfLocal) {
    return { action: 'stop', converge: true, why: '远端新 tip 不是本地 HEAD 的祖先 ⇒ 真分叉,唯一出口是 converge;此处不合并不强推' }
  }
  if (attemptNo >= max) {
    return { action: 'stop', converge: false, why: `重试已到上限(${max} 趟)⇒ 停手报失败:同型反复出现说明有别的东西在持续推进这枚 ref,那不再是竞态` }
  }
  return {
    action: 'retry',
    converge: false,
    why: `远端 tip 已被本地包含(快进可推)⇒ 第 ${attemptNo + 1} 趟重推;门结论已缓存故不再花两百秒,窗口缩到秒级;全程不跳门、不强推`,
  }
}

export const __test__ = { RACE_RETRY_MAX, decideRaceRetry }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
