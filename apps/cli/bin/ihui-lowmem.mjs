#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ihui-lowmem` — 低内存 V8 启动档(对齐 WorkBuddy `codebuddy-lowmem`)。
 *
 * 只改启动参数,不改一行业务代码:
 *   node --optimize-for-size --max-semi-space-size=2 <dist/index.js> <args...>
 *
 * `--optimize-for-size` 让 V8 优先压缩内存占用;`--max-semi-space-size=2`
 * 把新生代半空间压到 2MB,降低常驻 RSS。**不设 `--max-old-space-size`**:
 * 老年代上限一加,大任务会从"慢"变成"OOM 崩溃",与"低内存但不改行为"相悖。
 *
 * 独立 bin 的原因:V8 参数必须在进程启动前生效,进程内 `process.execArgv` 改不了。
 * Windows / POSIX 都走同一份 `process.execPath`,不依赖 shell shebang 解析。
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** 低内存档只允许这两枚 V8 参数;新增必须同笔更新测试与报告。 */
export const LOW_MEMORY_NODE_FLAGS = [
  '--optimize-for-size',
  '--max-semi-space-size=2',
]

/** 默认入口:与本文件同包的 `dist/index.js`(构建产物;dev 下可用 `IHUI_CLI_ENTRY` 覆盖)。 */
export function defaultEntry() {
  const override = process.env.IHUI_CLI_ENTRY
  if (override) return resolve(override)
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js')
}

/** 纯函数:返回要交给 `spawnSync` 的 `[command, ...args]`。 */
export function buildLowMemoryArgv(entry, argv, execPath = process.execPath) {
  return [execPath, ...LOW_MEMORY_NODE_FLAGS, resolve(entry), ...argv]
}

/**
 * 执行低内存档。注入 `spawn` / `exit` 便于单测,不在测试里真的拉起 CLI。
 * 返回退出码:子进程 status 数字则透传;被信号杀掉 / 启动失败统一 1(与 POSIX 习惯一致)。
 */
export function runLowMemory({
  entry = defaultEntry(),
  argv = process.argv.slice(2),
  spawn = spawnSync,
  stderr = process.stderr,
} = {}) {
  const [command, ...args] = buildLowMemoryArgv(entry, argv)
  const result = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  })
  if (result.error) {
    stderr.write(`[ihui-lowmem] 启动失败: ${result.error.message}\n`)
    return 1
  }
  return typeof result.status === 'number' ? result.status : 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exit(runLowMemory())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
