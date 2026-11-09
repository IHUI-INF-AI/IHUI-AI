// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Agent 能力评测基线的独立运行配置（不 import vitest，避免依赖安装位置差异）。
 *
 * 设计要点（每条对应一个"不可比/不可复现"的风险）：
 *  - `root` = 仓库根，但 `include` 只收本目录用例。原因：被测代码在 apps/cli/src 与
 *    packages 各包的 src（Vite root 之外的文件不会被转换，`.js` 后缀的 TS 源导入会退化成
 *    Node 原生解析而失败）；把 root 放到仓库根后，被测源码走 Vite 转换，行为与
 *    apps/cli 自己的测试完全一致。收集面仍被 include 锁死，不会误收其它 worktree。
 *  - `retry: 0`：固定任务集 + 录制回放本应逐次同结果；任何抖动说明被测代码或夹具
 *    引入了不确定性，必须当场红，不能靠重试掩盖。
 *  - `alias.vitest`：vitest 可能只装在 apps/cli（pnpm 非 hoist 布局），测试文件
 *    的 `import { vi } from 'vitest'` 用仓库内真实安装位置解析，避免要求额外的全局安装。
 *  - `env.IHUI_LOCALE` 与 apps/cli 测试同档，避免文案随 runner 语言漂移。
 */
const evalDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = path.resolve(evalDir, '..', '..')

/**
 * 取 `vitest` 的 **ESM** 入口。
 * `require.resolve('vitest')` 会命中 exports 的 `require` 条件（index.cjs），
 * 在 ESM 测试文件里导入会直接报 "Vitest cannot be imported in a CommonJS module"。
 * 因此这里读 package.json 的 exports[".].import，拿到与 `import` 语义一致的入口。
 */
function resolveVitest(): string {
  const bases = [
    path.join(repoRoot, 'apps', 'cli', 'package.json'),
    path.join(repoRoot, 'package.json'),
  ]
  for (const base of bases) {
    try {
      // resolve('vitest') 命中的是 CJS 入口，但它与 ESM 入口在同一包根下，先用它定位包目录
      const cjsPath = createRequire(base).resolve('vitest')
      const pkgPath = path.join(path.dirname(cjsPath), 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
        exports?: Record<string, unknown>
      }
      const entry = pkg.exports?.['.']
      let relative: string | undefined
      if (typeof entry === 'string') {
        relative = entry
      } else if (entry && typeof entry === 'object' && 'import' in entry) {
        const importEntry = (entry as { import?: unknown }).import
        if (typeof importEntry === 'string') relative = importEntry
        else if (importEntry && typeof importEntry === 'object' && 'default' in importEntry) {
          const defaultEntry = (importEntry as { default?: unknown }).default
          if (typeof defaultEntry === 'string') relative = defaultEntry
        }
      }
      if (!relative) continue
      return path.resolve(path.dirname(pkgPath), relative)
    } catch {
      // 换下一个候选位置
    }
  }
  throw new Error('未找到 vitest：请先在仓库根执行 pnpm install')
}

/**
 * 工作区包别名：直接指向 `packages/<name>/src`。
 *
 * 为什么不用 dist：评测要在"干净 worktree + pnpm install"就能一键跑，不能让使用者
 * 先手工构建 7 个 workspace 包；同时直接跑源码才能保证评测覆盖的就是当前分支的包实现
 * （而非某个上次构建残留的 dist）。
 */
function workspaceAliases(): Array<{ find: RegExp; replacement: string }> {
  const packagesDir = path.join(repoRoot, 'packages')
  const aliases: Array<{ find: RegExp; replacement: string }> = []
  for (const dir of fs.readdirSync(packagesDir)) {
    const pkgJson = path.join(packagesDir, dir, 'package.json')
    const srcIndex = path.join(packagesDir, dir, 'src', 'index.ts')
    if (!fs.existsSync(pkgJson) || !fs.existsSync(srcIndex)) continue
    const name = (JSON.parse(fs.readFileSync(pkgJson, 'utf8')) as { name?: string }).name
    if (!name) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    aliases.push({ find: new RegExp(`^${escaped}$`), replacement: srcIndex })
    aliases.push({
      find: new RegExp(`^${escaped}/(.+)$`),
      replacement: `${path.join(packagesDir, dir, 'src')}/$1`,
    })
  }
  return aliases
}

export default {
  root: repoRoot,
  resolve: {
    alias: [
      { find: /^vitest$/, replacement: resolveVitest() },
      // 被测 CLI 源码统一用 @cli/* 别名：评测文件分布在 src/ 与 src/suites/ 两层，
      // 手写相对路径极易出现 ../../../ 与 ../../../../ 的层级错位（曾实测踩坑）。
      { find: /^@cli\/(.+)$/, replacement: `${path.join(repoRoot, 'apps', 'cli', 'src')}/$1` },
      ...workspaceAliases(),
    ],
  },
  test: {
    include: ['benchmarks/agent-capability/tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    retry: 0,
    env: {
      IHUI_LOCALE: 'zh-CN',
      IHUI_EVAL: '1',
    },
    exclude: ['**/node_modules/**', '**/.ihui-agent/**', '**/results/tmp/**'],
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
