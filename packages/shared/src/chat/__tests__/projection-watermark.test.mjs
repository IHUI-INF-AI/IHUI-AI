// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816006 票面验收入口(双 runner 装载层;判据全集在 ./projection-watermark.node-test.mjs)。
 *
 * 两种跑法、同一份成对用例:
 *  1. 票面验收(node:test):`node --test packages/shared/src/chat/__tests__/projection-watermark.test.mjs`
 *     —— 本文件被 node:test 直接执行,转装载全集(18 例)。
 *  2. 本包 vitest(turbo test → `vitest run`):include 含 `src/**\/*.test.mjs`,本文件被收集;
 *     此时派生 `node --test` 子进程跑**同一份**全集并断言 RC=0 + pass>0 + fail=0 ——
 *     node:test 用例因此真的进 CI,不是"造好没装车"。
 *
 * 为什么判据不直接写在本文件:本包两把既有尺子(vitest.config 的 assertCollectionSurface 与
 * tests/chat/waiting-keys-collection.test.ts 的"磁盘全集 ⇄ 收集全集"对账)只认 vitest 收集面,
 * 纯 node:test 文件会被 vitest 收集后以 "No test suite found" 打死整包(先例与理由见票面
 * G-816006 的 GOAL-1 进度注记)。本文件按"同一语境只挂同一 runner"分流,两边跑的都是全集。
 */

if (process.env.VITEST === 'true') {
  const { execFile } = await import('node:child_process')
  const { existsSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const { describe, it } = await import('vitest')
  // vite 会把 `new URL('<字面量>', import.meta.url)` 特判成资产 URL 改写(可产出非 file:
  // 协议串,fileURLToPath 必炸)⇒ 用 import.meta.dirname(vite-node 注入)取本文件真实目录;
  // 拿不到再回退包根相对路径(vitest/turbo 的 cwd = 本包根)。
  const suitePath = import.meta.dirname
    ? resolve(import.meta.dirname, 'projection-watermark.node-test.mjs')
    : resolve(process.cwd(), 'src', 'chat', '__tests__', 'projection-watermark.node-test.mjs')
  if (!existsSync(suitePath)) {
    throw new Error(`判据全集不在预期位置: ${suitePath}(解析基准: ${import.meta.url})`)
  }

  describe('G-816006 水位协议:node:test 全集装载(票面验收同一判据)', () => {
    it('node --test 全集通过', { timeout: 60_000 }, async () => {
      const tap = await new Promise((fulfill, reject) => {
        execFile(
          process.execPath,
          ['--test', '--test-reporter', 'tap', suitePath],
          { windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 55_000 },
          (error, stdout) => {
            if (error) {
              reject(new Error(`node --test RC!=0: ${error.message}\n${String(stdout).slice(-2000)}`))
              return
            }
            fulfill(String(stdout))
          },
        )
      })
      const pass = /# pass (\d+)/.exec(tap)
      const fail = /# fail (\d+)/.exec(tap)
      if (pass === null || Number(pass[1]) < 1) {
        throw new Error(`TAP 汇总缺 pass 计数(全集可能没被装载):\n${tap.slice(-2000)}`)
      }
      if (fail === null || Number(fail[1]) !== 0) {
        throw new Error(`TAP 汇总 fail!=0:\n${tap.slice(-2000)}`)
      }
    })
  })
} else {
  // node:test 语境:直接装载全集(node --test 会把这些用例注册进当前 runner)。
  await import('./projection-watermark.node-test.mjs')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
