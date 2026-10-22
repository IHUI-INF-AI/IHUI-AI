// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反代号池真上游联调探针 —— CLI 入口(2026-10-22 立,env-gated)。
 *
 * 用途:有真实账号时一条命令逐平台验证反代连通性
 *   (checkHealth → 最小 chat 非流式往返 1 token → 流式 SSE 首包);
 *   未设置 RELAY_LIVE_PROBE=1 时只打印提示即退出,零影响。
 *   探针逻辑全部在 src/services/relay-live-probe.ts(与 vitest 门控用例共用)。
 *
 * 运行方法(PowerShell,仓库根或 apps/api 下均可):
 *   $env:RELAY_LIVE_PROBE='1'
 *   $env:RELAY_PROBE_TRAE_CRED='{"token":"<Trae Cloud-IDE-JWT>","model":"auto"}'
 *   $env:RELAY_PROBE_WORKBUDDY_CRED='{"token":"<access token>","model":"<模型 id>","extraMetadata":{"domain":"copilot.tencent.com"}}'
 *   $env:RELAY_PROBE_CODEARTS_CRED='{"token":"<security_token>","model":"<model_id>","secrets":{"accessKeyId":"...","secretAccessKey":"...","dpopPrivateKeyJwk":{...},"codeVerifier":"...","domainId":"..."}}'
 *   pnpm --filter @ihui/api exec tsx scripts/relay-live-probe.ts
 *
 * 凭据 JSON 字段:token 必填;uid / name / refreshToken / secrets /
 *   extraMetadata / proxyUrl / model / tokenExpiresAt 可选。
 *   Trae 的 model 缺省 "auto";WorkBuddy / CodeArts 必须在凭据里给 model。
 *   未设置对应凭据 env 的平台自动跳过并在报告中提示。
 * 可选:$env:RELAY_PROBE_TIMEOUT_MS='20000'(每请求超时上限,默认 20s)。
 *
 * 注意:适配器导入链会拉起 src/config 的环境校验,脚本先尽力加载 apps/api/.env
 *   (process.loadEnvFile),缺 .env 时需外部注入 DATABASE_URL 等必填项,
 *   否则启动即报「Invalid environment variables」并退出。
 * 退出码:任一执行平台失败 → 1;全通过 / 全跳过 / 未开启 → 0。
 */
try {
  process.loadEnvFile?.()
} catch {
  // .env 不存在:依赖外部已注入的环境变量
}

if (process.env.RELAY_LIVE_PROBE !== '1') {
  console.log(
    '[relay-live-probe] 未开启探针:需显式设置环境变量 RELAY_LIVE_PROBE=1 才会打真实上游。\n' +
      '用法(PowerShell 示例):\n' +
      "  $env:RELAY_LIVE_PROBE='1'\n" +
      `  $env:RELAY_PROBE_TRAE_CRED='{"token":"...","model":"auto"}'   # 可选,缺该变量的平台跳过\n` +
      `  $env:RELAY_PROBE_WORKBUDDY_CRED='{"token":"...","model":"..."}'\n` +
      `  $env:RELAY_PROBE_CODEARTS_CRED='{"token":"...","model":"...","secrets":{...}}'\n` +
      '  pnpm --filter @ihui/api exec tsx scripts/relay-live-probe.ts',
  )
  process.exit(0)
}

// 动态导入:确保上面的门控判断先于适配器/config 导入链执行
const { runLiveProbe, formatProbeReport, probeExitCode } =
  await import('../src/services/relay-live-probe.js')

const report = await runLiveProbe(process.env)
console.log(formatProbeReport(report))
process.exit(probeExitCode(report))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
