// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-03 自举 runner 的「编译态 / 源码态」单源判据(2026-11-23)。
 *
 * 病灶:同一仓两处自举脱离式 runner(`parent-bound.ts` 与 `sandbox/egress/proxy-relay-host.ts`),
 * 一处用 `--import tsx` 补了源码态加载器、另一处**没有** —— 源码/tsx 态下 `spawn(node, ['x.ts'])`
 * 直接失败,只留一句"静默降级"。形态判定散落成两份正则,谁也说不清 SEA / compiled / source
 * 各自该用哪条命令行。
 *
 * 判据四条:
 * - 形态三态封闭:`compiled` / `source` / `unjudged`(按入口扩展名判,别的扩展名不猜);
 * - 执行器身份先判:basename 不是 node ⇒ `exec-path-not-node`(SEA / 打包器下 execPath 不是解释器);
 * - 源码态加载器**有迹可查**:优先 tsx(仓内 devDependency,零新增依赖);取不到再看
 *   Node 自身 `--experimental-strip-types`(22.6+) 是否可用;
 * - 两者都没有 ⇒ **不 spawn 也不冒充成功**,返回 `ok:false` + 点名原因(失效方向是多要一次说明)。
 */

import { createRequire } from 'node:module'
import path from 'node:path'

/** 入口形态:`compiled`(.js/.mjs/.cjs)/ `source`(.ts/.mts/.cts)/ `unjudged`(其他)。 */
export type EntryMode = 'compiled' | 'source' | 'unjudged'

/** 源码态用的加载器来源(compiled 恒 `none`,不需要加载器)。 */
export type RunnerLoader = 'none' | 'tsx' | 'strip-types'

export interface SelfRunnerInput {
  /** 解释器可执行文件(生产传 `process.execPath`)。 */
  execPath: string
  /** 要自举的入口文件绝对路径(生产传 `fileURLToPath(import.meta.url)`)。 */
  entryPath: string
  /** 挂在入口之后的 runner 参数(flag + payload 等)。 */
  runnerArgs: readonly string[]
  /** `canImportTsx()` 的现读结果(注入以便测试;生产不 mock)。 */
  loaderAvailable: boolean
  /** `stripTypesSupported(process.versions.node)` 的现读结果。 */
  stripTypesSupported: boolean
}

export type SelfRunnerPlan =
  | { ok: true; command: string; args: string[]; mode: EntryMode; loader: RunnerLoader }
  | { ok: false; reason: string }

/** 入口扩展名 → 形态。认不出的一律 `unjudged`(不按"猜是 js"处理)。 */
export function detectEntryMode(entryPath: string): EntryMode {
  const lower = entryPath.toLowerCase()
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'compiled'
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) return 'source'
  return 'unjudged'
}

/** `process.execPath` 是否真是 node(SEA / 单文件打包下不是,不能拿它当解释器起任意脚本)。 */
export function isNodeExecutable(execPath: string): boolean {
  const base = path.basename(execPath).toLowerCase().replace(/\.exe$/, '')
  return base === 'node' || base === 'nodejs'
}

/**
 * Node 自身能否用 `--experimental-strip-types`(22.6.0 起有该 flag)。
 * 解析失败的版本串 ⇒ false(未判定不冒充"支持")。
 */
export function stripTypesSupported(nodeVersion: string): boolean {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(nodeVersion.trim())
  if (m === null) return false
  const major = Number(m[1])
  const minor = Number(m[2])
  if (!Number.isInteger(major) || !Number.isInteger(minor)) return false
  return major >= 23 || (major === 22 && minor >= 6)
}

/**
 * 仓内是否装得到 tsx(只解析模块位置,不启动任何进程、不 side-effect 加载)。
 * 解析失败 ⇒ false(源码态会退到 Node 自身 strip-types 或落未判定)。
 */
export function canImportTsx(): boolean {
  try {
    createRequire(import.meta.url).resolve('tsx')
    return true
  } catch {
    return false
  }
}

/**
 * 唯一判据:形态 + 加载器 → 可执行的命令行。
 * 失败一律带原因,调用方据此"不 spawn + 点名",不得静默当成跑过了。
 */
export function planSelfRunner(input: SelfRunnerInput): SelfRunnerPlan {
  if (!isNodeExecutable(input.execPath)) {
    return { ok: false, reason: 'exec-path-not-node(sea-or-bundled)' }
  }
  const mode = detectEntryMode(input.entryPath)
  if (mode === 'unjudged') {
    return { ok: false, reason: `entry-mode-unjudged(${path.extname(input.entryPath) || 'no-ext'})` }
  }
  if (mode === 'compiled') {
    return {
      ok: true,
      command: input.execPath,
      args: [input.entryPath, ...input.runnerArgs],
      mode,
      loader: 'none',
    }
  }
  if (input.loaderAvailable) {
    return {
      ok: true,
      command: input.execPath,
      args: ['--import', 'tsx', input.entryPath, ...input.runnerArgs],
      mode,
      loader: 'tsx',
    }
  }
  if (input.stripTypesSupported) {
    return {
      ok: true,
      command: input.execPath,
      args: ['--experimental-strip-types', input.entryPath, ...input.runnerArgs],
      mode,
      loader: 'strip-types',
    }
  }
  return { ok: false, reason: 'source-entry-without-loader(tsx-absent,strip-types-unsupported)' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
