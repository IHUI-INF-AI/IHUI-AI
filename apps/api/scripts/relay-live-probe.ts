// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池上游实弹探针的 CLI 入口(2026-10-29 立)。
 *
 * 为什么单独有这一枚文件:`src/services/relay-live-probe.ts` 早就导出
 * `runLiveProbe` / `formatProbeReport` / `probeExitCode`,但全仓 **零 import** ——
 * 判据造好却没装车就等于没有(AGENTS §0.9),运维想知道"trae/workbuddy/codearts 三平台
 * 现在到底还通不通"时没有任何可发现的命令入口,只能去读源码猜 env 名。本文件把
 * 既有判据接成一条可跑的命令,判据本身一律不在这里复算(§0.6 单一真相源)。
 *
 * 跑法:`pnpm --filter @ihui/api relay:live-probe`(凭据取自 apps/api/.env)
 * 未开启 `RELAY_LIVE_PROBE=1` ⇒ 零网络调用,并显式声明"未判定"而不是"已验证"(§0.3)。
 */
import 'dotenv/config'
import {
  formatProbeReport,
  probeExitCode,
  PROBE_CRED_ENV,
  PROBE_PROVIDERS,
  runLiveProbe,
} from '../src/services/relay-live-probe.js'

async function main(): Promise<number> {
  const report = await runLiveProbe(process.env)
  console.log(formatProbeReport(report))
  if (!report.enabled) {
    console.log(
      [
        '本轮未发出任何真实请求:RELAY_LIVE_PROBE 未置 1 ⇒ 结论=未判定(不是"已验证")。',
        `开启需同时给凭据 env:${PROBE_PROVIDERS.map((p) => PROBE_CRED_ENV[p]).join(' / ')}`,
        '注意:探针只覆盖 ' + PROBE_PROVIDERS.join('/') + ' 三平台,其余平台无实弹判据。',
      ].join('\n'),
    )
  }
  return probeExitCode(report)
}

main()
  .then((code) => {
    process.exit(code)
  })
  .catch((err: unknown) => {
    // 探针自己崩了不算"平台失败",算"没判出来" ⇒ exit 2 并点名原因,不记绿也不冒红
    console.error(`探针执行异常(未判定):${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
