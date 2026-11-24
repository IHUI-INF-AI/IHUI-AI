// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 测试环境启动前加载 .env.test(指向 ihui_test 库)
    setupFiles: ['./tests/setup-env.ts', './tests/setup-redis-stub.ts'],
    // 默认跑 mock 测试:test/(单数) + tests/(复数) + src/{routes,services,jobs,plugins,utils}/__tests__/ 下的 *.test.ts
    include: [
      'test/**/*.test.ts',
      'tests/**/*.test.ts',
      'src/routes/__tests__/**/*.test.ts',
      'src/services/__tests__/**/*.test.ts',
      'src/jobs/__tests__/**/*.test.ts',
      'src/plugins/__tests__/**/*.test.ts',
      'src/utils/__tests__/**/*.test.ts',
      'src/db/__tests__/**/*.test.ts',
    ],
    // 排除真实 DB 集成测试(用 vitest.real.config.ts 单独跑)
    // 2026-10-03(G-1018201)'**/.ihui-agent/**':.ihui-agent/tmp/ 里存着他人留下的 HEAD
    // 整仓副本,而 vitest 4.1.10 收集面显式 `dot: true` ⇒ 点目录被主动穿透,副本里与本包
    // 同形的 *.test.ts 会被收进当次运行。`.gitignore` 只管 git,拦不住文件系统 glob。
    // 带 `**/` 前缀才覆盖任意嵌套落点(实测 picomatch 下 `.ihui-agent/**` 放过 `src/x/.ihui-agent/**`)。
    exclude: [
      'dist/**',
      'node_modules/**',
      'tests/**/*.real.test.ts',
      'src/routes/__tests__/**/*.real.test.ts',
      '**/.ihui-agent/**',
    ],
    // 2026-11-22 提速复评:15s 预算在"web 8 worker + api 并行 + cli 并行"的争核形态下被打穿
    // (第 16 轮全仓实测 5 条纯 I/O 用例 —— terminal-confinement / f-519 全仓扫描 / g261 起 app /
    //  relay-task-center 真模块 / v1-latency 落库 —— 全部 "Test timed out in 15000ms" 且 retry×2 仍红)。
    // 这是**资源预算不足**,不是断言强弱,故抬到 30s;并给本包 maxWorkers=8,让 api 与 web(8)
    // 合计 16 < 20 逻辑核,不再把对方挤到超时。
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 2026-11-22 A/B(全量 1870 文件 / 20203 用例,同一台 12C/20T):
    //   8 worker  : 850s ≈ 14.2min  ✅
    //   12 worker : 453s ≈ 7.6min   ✅ (首轮出现过 1 个文件级 teardown EBUSY,已在用例侧兜底)
    //   16 worker : 331s ≈ 5.5min   ✅  ← 定稿
    // import 段是最大头(16 worker 累加 3556s),它吃的是模块图重建 + 磁盘/CPU 混合等待,
    // 所以在物理核上超订才有收益;再往上把核挤干会退回"争核超时"那一族。
    maxWorkers: 16,
    // mock 测试不连真实 DB,可并行跑(真实 DB 测试在 vitest.real.config.ts 中串行)
    fileParallelism: true,
    // 全局重试 2 次:容忍 admin-missing-routes.test.ts 等套件在全量并发时偶发的资源争抢失败
    // vitest 2.1.9 不支持 it.retry() 方法,只能通过 test.retry 全局配置
    retry: 2,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
