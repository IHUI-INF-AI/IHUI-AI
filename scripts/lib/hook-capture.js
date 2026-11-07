// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hook-capture.js — pre-commit 钩子「守门批输出捕获」的唯一实现(2026-11-05 拆出)
 *
 * 为什么单独一份:
 *   ① `scripts/lib/pre-commit-hook.js` 是 CJS 钩子,被 require 时顶层直接跑主流程
 *      (见 pre-commit-hook-no-import-side-effects.test.mjs),所以判据不能留在里面做自检;
 *   ② `runCapturing` 的输出规模判据(尤其是 maxBuffer)必须能**真跑一条大输出**钉住,
 *      否则 ENOBUFS 会把"输出太大"误报成"门失败"(2026-11-05 复核的假红那一型)。
 *
 * maxBuffer 判据(§0.3/§0.10):
 *   默认 64MB —— 与 face-reader 的 GIT_MAX_BUFFER 同量级;Node execSync 默认 1MB,
 *   宽暂存集(合并/大批量)实测会超。`HUSKY_GATE_MAX_BUFFER_BYTES` 只用于极端机型上调,
 *   不下调默认值;取不到合法正整数 ⇒ 回落 64MB(失效方向仍是"装得下",不是"截断")。
 */

'use strict'

const { execSync } = require('node:child_process')

/** 守门批 stdout 捕获的默认上限:64MB(见头注)。 */
const DEFAULT_MAX_BUFFER = 64 << 20

/** 解析本次生效的 maxBuffer;环境变量非法即回落默认,绝不取 0/负数。 */
function captureMaxBuffer() {
  const n = Number(process.env.HUSKY_GATE_MAX_BUFFER_BYTES)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_BUFFER
}

/**
 * 跑一条命令并捕获 stdout/stderr(不写 .log —— 那份日志有 tee 缓冲窗口)。
 * ok 只看退出码;output 原样透传给 parseGateSummary。
 */
function runCapturing(
  label,
  cmd,
  timeoutMs = Number(process.env.HUSKY_GATE_BATCH_TIMEOUT_MS) || 1_800_000,
) {
  console.log(label)
  try {
    const stdout = execSync(cmd, {
      cwd: process.cwd(),
      windowsHide: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      maxBuffer: captureMaxBuffer(),
    })
    process.stdout.write(stdout)
    return { ok: true, output: stdout || '' }
  } catch (error) {
    // execSync 失败时 stdout/stderr 挂在 error 上(stdio: 'pipe')；写出去再返回。
    const stdout = typeof error?.stdout === 'string' ? error.stdout : ''
    const stderr = typeof error?.stderr === 'string' ? error.stderr : ''
    process.stdout.write(stdout)
    process.stderr.write(stderr)
    console.error(`\n❌ ${label}失败，提交已阻止`)
    return { ok: false, output: stdout + '\n' + stderr }
  }
}

module.exports = { DEFAULT_MAX_BUFFER, captureMaxBuffer, runCapturing }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
