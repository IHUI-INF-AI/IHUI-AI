// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时合规临时根 —— 跨端唯一落点（AGENTS.md §15b 铁律）。
 *
 * 问题：各端业务源码里散落 `os.tmpdir()`，而 TEMP 环境变量可能钉在
 * `C:\Users\...\AppData\Local\Temp`，导致 agent 运行时把中间文件外泄到
 * 项目文件夹之外。scratch-dir.mjs（`mkScratch`/`rmScratch`）是**开发
 * 夹具专用**（`DevEnv/Temp/ihui-scratch`），不适用于运行时业务路径。
 *
 * 本工厂把运行时临时根收敛到 `~/.ihui/tmp`（优先 `IHUI_HOME` 环境变量
 * > `HOME` > `USERPROFILE` > `os.homedir()`，与 plugins/paths.ts 保持
 * 一致的优先级链）。在生产机上 `~/.ihui` 是 junction → `D:\DevEnv\cache\
 * userhome\.ihui`，**不写 C 盘**、普通用户可写、不依赖 TEMP 环境变量。
 *
 * 单一真相源：apps/cli 与 apps/api 的 6 个运行时落盘点全部改道此处，
 * 端内不得再新建第二份 `os.tmpdir()` / `mkdtempSync(join(os.tmpdir()…))`。
 *
 * 安全闸性质（三档）：
 *   · `getRuntimeTempRoot()`     — 纯计算，不建目录，只返回绝对路径
 *   · `ensureRuntimeTempRoot()`  — 建目录（recursive），幂等，失败抛错
 *   · `runtimeTempPath(...segments)` — 追加段名，仍不建目录
 */

import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs'

/** 测试用 home 覆盖环境变量（优先级最高，与 plugins/paths.ts HOME_OVERRIDE_ENV 同名） */
const HOME_OVERRIDE_ENV = 'IHUI_HOME'

/**
 * 获取用户 home 目录。
 * 优先级：IHUI_HOME > HOME > USERPROFILE > os.homedir()。
 * （与 apps/cli/src/plugins/paths.ts 保持同链，但独立实现避免跨层循环依赖）
 */
export function resolveUserHome(): string {
  return (
    process.env[HOME_OVERRIDE_ENV] || process.env.HOME || process.env.USERPROFILE || os.homedir()
  )
}

/**
 * 运行时合规临时根的绝对路径（纯计算，不建目录）。
 * 落点：`~/.ihui/tmp`（junction 到 D: 卷，不写 C 盘）。
 */
export function getRuntimeTempRoot(): string {
  return path.join(resolveUserHome(), '.ihui', 'tmp')
}

/**
 * 确保运行时临时根存在（recursive mkdir，幂等），返回绝对路径。
 * 失败抛错而非静默回落 —— 调用方不得因建目录失败而退回 os.tmpdir()。
 */
export function ensureRuntimeTempRoot(): string {
  const root = getRuntimeTempRoot()
  fs.mkdirSync(root, { recursive: true })
  return root
}

/**
 * 在运行时临时根下拼出目标路径（纯计算，不建目录）。
 * 例：runtimeTempPath('ihui-mermaid-123.png') → `<root>/ihui-mermaid-123.png`
 */
export function runtimeTempPath(...segments: string[]): string {
  return path.join(getRuntimeTempRoot(), ...segments)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
