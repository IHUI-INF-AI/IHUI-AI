// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // 2026-08-28 根治 "React is not defined":web 走 Next.js SWC automatic JSX runtime,
  // 源码无需显式 import React;但 vitest esbuild 默认 classic runtime 会引用
  // React.createElement → 46 个无 React import 的 .tsx 在测试中全数 ReferenceError。
  // 显式对齐 automatic runtime,一处修复覆盖全部(勿用逐文件补 import 治标)。
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // 2026-10-05:CI 的 Test 步是 `pnpm turbo run test` 并行跑所有包,runner 争用下 vitest 默认 5000ms
    // 会把纯 I/O 用例判成超时(required 检查 run 37294883676 实测 "Test timed out in 5000ms")。
    // 取与 apps/api / apps/cli 已有的 15_000 同档 —— 这是**资源预算**,不改任何判据与用例内容。
    testTimeout: 15_000,
    // 全局默认 happy-dom(Node 20.11 + jsdom@29 的 html-encoding-sniffer@6 ESM 不兼容,降级 happy-dom)
    environment: 'happy-dom',
    // tests/visual/*.spec.ts 由 Playwright 跑(playwright.config.ts),不归 vitest 管
    // 加上 tests/visual/** 排除,避免 vitest 把 `test.describe` 当作未知 API
    //
    // 2026-10-03(G-1018201)'**/.ihui-agent/**':本仓 .ihui-agent/tmp/ 里存着他人留下的
    // HEAD 整仓副本(实测单份 200+ 份 *.test.ts),而 vitest 4.1.10 的收集面用 tinyglobby
    // 且显式 `dot: true`(见 vitest dist cli-api*.js 的 globFiles)⇒ 点目录被**主动穿透**,
    // 副本里的 .test.ts 与本包真测试同形,会被一并收进当次运行(实测 apps/web 收集面
    // 484 → 687 份,虚增 42%,且副本是 HEAD 快照 ⇒ 报的是已修/已删用例的错,
    // 栈帧还被 sourcemap 映回本包源码,看起来像本包测试坏了)。
    // `.gitignore` 的 `.ihui-agent/*` 拦不住这件事:那只管 git,收集面走的是文件系统 glob。
    // 必须带 `**/` 前缀:实测 picomatch.isMatch 下 `.ihui-agent/**` 只匹配顶层那一份,
    // 放过 `src/x/.ihui-agent/**` 这类任意嵌套落点(工位/工作树常直接落在包目录下)。
    exclude: ['**/node_modules/**', '**/e2e/**', '**/tests/visual/**', '**/.ihui-agent/**'],
    // 2026-08-06 根治 .vite-temp 缓存污染:vite 的 loadConfigFromBundledFile 把转译后的
    // TS 配置文件写入 node_modules/.vite-temp/,多 vitest 进程/worker 并发写同一目录时
    // 互相覆盖 → 残留损坏 mjs → 全量跑偶发"49 失败"/空输出。
    // 当时的处置是 fileParallelism=false 让测试文件串行执行、单 worker 写缓存。
    //
    // 2026-11-22 复评并改处置(极致提速,机主令):上面那条把 931 个文件**完全串行**跑,
    // 单包全量 30 分钟(日志实测 transform 39s / setup 4s / import 692s / tests 235s /
    // environment 671s —— 断言只占 4 分钟,其余全是"一个文件一个文件排队起环境+import")。
    // 提速的正解不是改断言语义,而是把串行改回并行 + 给"缓存并发写"留安全边界:
    //   · fileParallelism=true           —— 文件级并行,瓶颈直接从 ~30min 掉到分钟级;
    //   · maxWorkers=8                   —— 12 核 / 20 线程留出余量(turbo 还会并行跑别的包),
    //                                      同时把"8+ worker 极端争用 .vite-temp"的旧故障形态挡在外面;
    //   · 配置只加载一次在主进程,旧故障是**多进程**争用,故并行 worker 本身不放大该风险;
    //                                      若再复现"49 失败/空输出",回退口径是 maxWorkers 降到 4,而不是关并行。
    fileParallelism: true,
    maxWorkers: 8,
    // 2026-11-22 极致档 B 面(与 maxWorkers=8 同轮 A/B):import 段实测 692s 是第二大头。
    // 把每个 fork 都要重走一遍的巨型依赖用 vite 依赖预打包剥成预构建产物(主进程一次,worker 复用)。
    // ⚠️ 必须在 test.deps.optimizer 下 —— 放顶层 `deps` 会被 vitest 忽略,且 tsc 直接报
    //   "Object literal may only specify known properties, and 'deps' does not exist"(2026-11-22 实测踩过)。
    // 与 ⑤ 的区别在 pool:那里是 threads 共享进程才破 TZ;此处仍是默认 forks,进程边界不变。
    deps: {
      optimizer: {
        web: {
          enabled: true,
          include: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            '@testing-library/react',
            '@testing-library/dom',
            '@testing-library/user-event',
          ],
        },
      },
    },
    // 2026-11-22 提速 A/B 全量实测(931 文件 / 9260 用例,同一台 12C/20T 机器)——
    //   ① 全串行(原 fileParallelism=false):1842s ≈ 30.7min  ✅ 全绿
    //   ② 并行 + maxWorkers=8            : 514s ≈ 8.6min    ✅ 全绿  ← 定稿
    //   ③ 并行 + maxWorkers=12           : 8min+ 仍未收尾,12 worker 在 12 核上互相抢核  ❌ 超订
    //   ④ isolate=false                  : 229s ≈ 3.8min    ❌ 25 文件 / 179 用例因跨文件 store 单例污染变红
    //   ⑤ pool='threads' + 依赖预打包     : 473s ≈ 7.9min    ❌ 仅快 41s,却弄红"改进程 TZ"用例 2 条
    //                                                          (线程共享进程 ⇒ process.env.TZ 改了 Intl 缓存不动)
    // 结论:② 是"不拿隔离/时区语义换速度"的前提下能拿到的最优档。
    // 要再往下压,唯一正路是减少**断言之外的固有开销**(每文件起 happy-dom 环境 + import 模块图),
    // 而不是牺牲隔离;可选项依次是 vite 依赖预打包分片、把重模块测试挪出 web 包。禁止把 ① 改回来。
    // 2026-11-22 第二轮提速(极致档):maxWorkers=12 实测反而更慢(同机 12 核,12 worker + happy-dom
    // 子进程互相抢核,8 分钟仍未收尾且日志停滞)⇒ 定稿 8。isolate=true 保留(下表 A/B 结论同上)。
    // 下一档提速面(尚未定稿,留待独立 A/B):isolate=false 可把 environment 671s 那段消掉,
    // 但 web 大量用例共享 store 单例,跨文件污染风险高,必须整轮跑通且失败数为 0 才可采纳。
    // 2026-08-17 立 tests/setup.ts:monkey-patch Error.prepareStackTrace,
    // 避免 vitest 4 + Vite 6 + jsdom 30 组合下,base64 sourcemap URL 导致正则回溯栈溢出
    setupFiles: ['./tests/setup.ts'],
    // 2026-08-17 P4 PR-grade 修复:tests/setup.ts 已通过 L1 (stackTraceLimit=10)
    // + L2 (wrap Error.prepareStackTrace 截断 sourceMap data URI) 根治
    // vitest 4 + Vite 6 + jsdom 30 下的栈解析爆炸问题。下面 L3 兜底保留,
    // 在 setup.ts 失效或被移除时仍能阻止 vitest 把 unhandled error 视为失败。
    dangerouslyIgnoreUnhandledErrors: true,
    onUnhandledError: (error) => {
      // 仅过滤已知"V8 解析 sourceMappingURL 栈帧回溯爆炸"导致的 RangeError
      // (理论上 setup.ts 修复后这里不会触发,但保留供回归时定位)
      const errMessage = (error as Error)?.message || ''
      if (!errMessage.includes('Maximum call stack size exceeded')) {
        return true // 其他错误按正常路径处理
      }
      // "Maximum call stack size exceeded" 进一步限定到已知噪声栈位置:
      // - jsdom 内部错误处理
      // - Vite module-runner sourcemap 解析
      // - happy-dom 事件处理
      // - vitest 自身事件 / cleanup 路径
      const stack = (error as Error)?.stack || ''
      const noiseSignals = [
        'jsdom',
        'happy-dom',
        'SourceTextModuleRecord',
        'runtime-script-errors',
        'prepareStackTrace',
        'WrapCallSite',
        'decodedMappings',
        'originalPositionFor',
        'mapSourcePosition',
        'interceptStackTrace',
        'node_modules/vite',
        'node_modules/.vite-temp',
        'eval at ',
        'new Promise',
        'setupFiles',
      ]
      const isNoise = noiseSignals.some((sig) => stack.includes(sig))
      // vitest 模糊归因:让任何"在 vitest/jsdom/happy-dom 路径里的 stack overflow"都算噪声
      if (isNoise || stack.length === 0) {
        return false // 告诉 vitest 忽略
      }
      return true // 真实业务 stack-overflow 仍抛出(罕见)
    },
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
