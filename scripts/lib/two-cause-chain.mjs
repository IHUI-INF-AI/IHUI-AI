// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * two-cause-chain —— 双因果链合成器(G-697,2026-10-03 立,唯一一份实现)。
 *
 * 防的形态(上游 remote/deploy.ts:437-469 的 :457 注释直述):
 *   `finally { await release() }` 里**释放失败若直接抛**,会顶掉真正的临界区失败 ——
 *   调用方只看到"释放失败",不知道主体到底做没做成;反过来只报主体失败,
 *   锁为什么没交还又没人知道。两条因果链**谁也不顶掉谁**,都进 AggregateError.errors。
 *
 * 取证先例:egress-retry-safety.ts:128-139 已沿 `AggregateError.errors` 取证;
 * 接线点:scripts/deploy-lock.mjs 的 `runUnderLock`(catch 路径原来只 warn 后丢掉
 * 释放失败)、scripts/git-lock.mjs(同出口 re-export 供其消费方 git-backup-refresh 等
 * 自己写 finally 的脚本取用 —— 各脚本自己的 finally 接线归 F5 改造,不得由本票顺手改)。
 *
 * message 契约(镜像测试钉死):聚合 message 必须同时点名两条链 ——
 * 含「主体」与「释放」两个词和两条链各自的 message,人读日志时不需展开 errors 也能定位。
 */

/** 两条链各自的读面:为什么失败、失败的是什么。 */
function describe(err) {
  if (err === null || err === undefined) return String(err)
  if (err instanceof Error) return err.message
  return String(err)
}

/**
 * 双失败 ⇒ 抛 AggregateError(errors[0]=主体失败、errors[1]=释放失败,
 * message 点名两条因果链);单失败 ⇒ 原样抛该错误(**同一实例**,不得包一层
 * 丢掉调用方的 instanceof 判据);无失败 ⇒ 不该被调用。
 *
 * @param {{mainError: Error|unknown, releaseError: Error|unknown, label?: string}} p
 */
export function throwTwoCauseChain({ mainError, releaseError, label = '' } = {}) {
  const tag = label ? `[${label}] ` : ''
  if (mainError && releaseError) {
    throw new AggregateError(
      [mainError, releaseError],
      `${tag}主体失败与释放失败同时发生(两条因果链都在 errors 里,谁也不顶掉谁)` +
        ` —— ① 主体: ${describe(mainError)};② 释放: ${describe(releaseError)}`,
    )
  }
  if (mainError) throw mainError
  if (releaseError) throw releaseError
  throw new Error(`${tag}throwTwoCauseChain 在无失败时被调用 —— 调用方判据有误,不得静默吞`)
}

/**
 * 包装「临界区 + 释放」:work 先跑(成败都记),release 必跑(成败都记),
 * 再经 throwTwoCauseChain 合成 —— 释放失败不顶掉主体失败。
 *
 * @param {{work: () => Promise<unknown>|unknown, release: () => Promise<unknown>|unknown, label?: string}} p
 */
export async function runWithRelease({ work, release, label } = {}) {
  let mainError = null
  let result
  try {
    result = await work()
  } catch (e) {
    mainError = e
  }
  let releaseError = null
  try {
    await release()
  } catch (e) {
    releaseError = e
  }
  if (!mainError && !releaseError) return result
  throwTwoCauseChain({ mainError, releaseError, label })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
