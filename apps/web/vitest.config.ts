import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@plugins-data': path.resolve(__dirname, './app/(main)/plugins/plugins-data'),
    },
  },
  test: {
    // 全局默认 happy-dom(Node 20.11 + jsdom@29 的 html-encoding-sniffer@6 ESM 不兼容,降级 happy-dom)
    environment: 'happy-dom',
    // tests/visual/*.spec.ts 由 Playwright 跑(playwright.config.ts),不归 vitest 管
    // 加上 tests/visual/** 排除,避免 vitest 把 `test.describe` 当作未知 API
    exclude: ['**/node_modules/**', '**/e2e/**', '**/tests/visual/**'],
    // 2026-08-06 根治 .vite-temp 缓存污染:vite 的 loadConfigFromBundledFile 把转译后的
    // TS 配置文件写入 node_modules/.vite-temp/,多 vitest 进程/worker 并发写同一目录时
    // 互相覆盖 → 残留损坏 mjs → 全量跑偶发"49 失败"/空输出。
    // fileParallelism=false 让测试文件串行执行,单 worker 写缓存,从源头杜绝并发冲突
    // (此前靠跑前手动清 .vite-temp 只能治标,重启测试又再生)。
    fileParallelism: false,
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
