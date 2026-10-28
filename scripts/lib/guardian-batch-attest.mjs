// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 批次留痕 attest(2026-10-16 自 guardian-executor.mjs 外置,[11e] 单文件 800 行上限的余量拉开)。
//
// G-1059139:守门批的结构化留痕(批次跑了 / 逐道 env 自跳 / 暂存区未触及 / 当次索引的树指纹)。
// 归一函数与读写出口只住 attestation-tree-digest.mjs 一处,runner 不自己拼台账路径、也不自己算 digest。
//
// 执行逻辑逐字搬入;函数体原先闭包引用的 checks/pushGateChecks/passStaged/effectiveChecks/
// failedGates/selfSkippedGates/notTriggeredGates/C 与计数器 passed/warned/failed/skipped
// 改为 ctx 参数传递(计数器是 executor 的 let 变量,调用时构造 ctx 即取当下值)。
// 注意:selfSkippedGates / notTriggeredGates 两个数组的**本体仍住 executor**(applyGateResult 与
// 主循环对它们 push),此处仅持引用 —— push 进来的条目与 attest 读到的是同一份。

import { appendGateBatchRecord, indexTreeDigest, indexVsHeadPaths, stepLevelSkipHits } from './attestation-tree-digest.mjs'

/**
 * 往台账落一行 kind=gate-batch-run。**永不抛、永不改退出码** —— 一次正常的守门批不得因为记账写失败而变红,
 * 但写失败必须响亮(stderr 一行),因为台账静默失踪是本仓最高频失效型。
 * ranFullBatch:早退路径(逃生舱 stopOnFirst)为 false,跑完为 true。
 */
export function attestGateBatchRun(
  { C, checks, pushGateChecks, passStaged, effectiveChecks, failedGates, selfSkippedGates, notTriggeredGates, passed, warned, failed, skipped },
  ranFullBatch,
) {
  try {
    const dg = indexTreeDigest()
    const df = indexVsHeadPaths()
    const declaredEnvs = [
      ...new Set([...checks, ...pushGateChecks].map((c) => c.skipEnv).filter(Boolean)),
    ]
    const step = stepLevelSkipHits({ declared: declaredEnvs })
    const w = appendGateBatchRecord({
      mode: passStaged ? 'staged' : 'full',
      totalChecks: effectiveChecks.length,
      executed: passed + warned + failed + skipped,
      blockingFailed: failedGates.length,
      selfSkipped: selfSkippedGates,
      notTriggered: notTriggeredGates.map((g) => ({ ...g, reason: 'stagedTriggers 未触及' })),
      undeclaredSkipHits: step.count,
      undeclaredSkipHitsUndetermined: step.undetermined,
      declaredFiles: df.ok ? df.files : [],
      declaredFilesTruncated: df.truncated === true,
      declaredFilesTotalSeen: df.ok ? df.totalSeen : 0,
      ranFullBatch,
      treeDigest: dg.digest,
      treeDigestWhy: dg.ok ? null : dg.why,
    })
    if (!w.ok) {
      console.error(`⚠️  [attest] 本轮守门批**未落批次留痕**:${w.why}`)
    } else if (!dg.ok) {
      console.error(
        `⚠️  [attest] 批次留痕已落,但 treeDigest 取不到 ⇒ 统计器把这一枚绑不回本轮(${dg.why})`,
      )
    } else {
      console.info(
        `${C.dim}🧾 [attest] 批次留痕 kind=gate-batch-run(treeDigest=${dg.digest.slice(0, 12)}…,selfSkipped=${selfSkippedGates.length},undeclaredSkipHits=${step.count})${C.reset}`,
      )
    }
    if (step.undetermined.length > 0) {
      console.error(
        `ℹ️  [attest] 步骤级门有 ${step.undetermined.length} 个面读不到(${step.undetermined
          .map((u) => u.file)
          .join(', ')})⇒ undeclaredSkipHits 只覆盖扫得动的面,**不得读成"该面已覆盖"**,也不得折成 0`,
      )
    }
    if (!df.ok) console.error(`ℹ️  [attest] declaredFiles 取不到:${df.why}(落空数组并点名,不伪造)`)
  } catch (e) {
    console.error(
      `⚠️  [attest] 批次留痕流程异常:${String(e?.message ?? e).slice(0, 200)} —— 不影响门禁结论与退出码`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
