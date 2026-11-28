// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力清单预检门 —— `capability.json` 进装载链前的 **fail-closed** 关卡(2026-11-26 W4-01/P0-B)。
 *
 * 为什么要有这一层:
 *   对侧(Qoder 0.5.14)的扩展根下各有一份 `.qoder-app-plugin/plugin.json`,把
 *   `permissions` / `contributes` / `agentSdk.plugins[]` / `nativeModules` 一次性声明完;
 *   宿主只认清单里写过的能力。本仓此前的 `plugin.json` 只有 tools/hooks/commands,
 *   权限只做"事后的数据类归属",没有"进链前先验形状"的唯一闸 —— 形状坏的清单要到
 *   运行期才发现,或者半份生效(§12e 的反面)。
 *
 * 落点与判据:
 *   - 旁挂文件 `<pluginRoot>/capability.json`;缺席 = 老插件,零诊断(向后兼容);
 *   - 在场 ⇒ 必须整份通过 `parseCapabilityManifest`,任何一条 issue 都拒整份插件(不降级加载);
 *   - 权限词表 = `DECLARED_PERMISSION_NAME_LIST`(33 条,`permission-names.ts` 单源)。
 *     未知权限 = 拒,不"先放进来再观察" —— 登记新权限必须先改归属表,这是唯一入口;
 *   - `main` 必须是插件目录内的相对路径且真实存在(绝对路径 / `..` 穿越 / 缺文件都拒);
 *   - 清单 `name` 必须与 `plugin.json` 的 `name` 一致(两个身份不许并存)。
 *
 * 刻意不做:不 import 插件代码、不执行任何东西、不读 `%APPDATA%`;本层只做字节与路径判定。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  parseCapabilityManifest,
  type CapabilityManifest,
  type ManifestIssue,
} from '@ihui/agent-sdk'
import { DECLARED_PERMISSION_NAME_LIST } from './permission-names.js'
import { isDefinitePathAbsence } from './path-safety.js'

/** 旁挂能力清单的文件名(固定,不放宽成 glob) */
export const CAPABILITY_FILE_NAME = 'capability.json'

/** 本宿主已登记的权限全集 —— 与归属表同源,不另抄一份名单 */
export const HOST_KNOWN_PERMISSIONS: readonly string[] = DECLARED_PERMISSION_NAME_LIST

/**
 * 预检结果。`rejected` 只回"哪份文件、为什么",不自己造诊断 ——
 * 诊断构造的唯一出口在 `manifest-scan.ts`,本层不 import 它(避免 scan ↔ gate 循环依赖)。
 */
export type CapabilityGateOutcome =
  | { status: 'absent' }
  | { status: 'ok'; capability: CapabilityManifest }
  | { status: 'rejected'; file: string; message: string }

/** issue 列表 → 单行摘要(首条逐字,其余只报数量,避免诊断被 20 条同类刷屏) */
function summarizeIssues(issues: readonly ManifestIssue[]): string {
  const first = issues[0]
  const head = first === undefined ? 'unknown issue' : `${first.code} at ${first.path}: ${first.message}`
  return issues.length > 1 ? `${head} (+${issues.length - 1} more)` : head
}

/**
 * `main` 的路径判定:必须是插件目录内的相对路径,且落点是真实文件。
 * 返回 null 表示通过,否则返回拒收理由(ASCII,便于日志)。
 */
function checkMainEntry(pluginRoot: string, main: string): string | null {
  if (main.trim() === '') return 'main is empty'
  if (path.isAbsolute(main)) return `main must be relative: ${main}`
  // Windows 盘符形态在 path.isAbsolute 之外还会漏(`C:foo`),单独挡一次。
  if (/^[A-Za-z]:/.test(main)) return `main must not carry a drive letter: ${main}`
  const segments = main.split(/[\\/]/)
  if (segments.includes('..')) return `main must not traverse outside the plugin: ${main}`
  const resolved = path.resolve(pluginRoot, main)
  const relative = path.relative(pluginRoot, resolved)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return `main resolves outside the plugin: ${main}`
  }
  try {
    if (!fs.statSync(resolved).isFile()) return `main is not a file: ${main}`
  } catch {
    return `main does not exist: ${main}`
  }
  return null
}

/** 形状 + 身份 + 入口三项一起判;返回 issues 数组(空 = 通过) */
function precheckCapability(raw: unknown, pluginRoot: string, pluginName: string): readonly ManifestIssue[] {
  const parsed = parseCapabilityManifest(raw, { knownPermissions: HOST_KNOWN_PERMISSIONS })
  if (!parsed.ok) return parsed.issues

  const extra: ManifestIssue[] = []
  if (parsed.manifest.name !== pluginName) {
    extra.push({
      path: '$.name',
      code: 'pattern',
      message: `清单 name 与 plugin.json 不一致: ${parsed.manifest.name} != ${pluginName}`,
    })
  }
  const mainProblem = checkMainEntry(pluginRoot, parsed.manifest.main)
  if (mainProblem !== null) {
    extra.push({ path: '$.main', code: 'pattern', message: mainProblem })
  }
  return extra
}

/**
 * 读旁挂 `capability.json` 并预检。
 *
 * 只有 ENOENT / ENOTDIR 视为"没有这份清单";其它读失(权限、竞态、EISDIR)一律拒绝 ——
 * "读不到"不等于"没声明",这正是 fail-closed 与"静默跳过"的分界。
 */
export function loadCapabilityDeclaration(manifestFile: string, pluginName: string): CapabilityGateOutcome {
  const pluginRoot = path.dirname(manifestFile)
  const capabilityFile = path.join(pluginRoot, CAPABILITY_FILE_NAME)

  try {
    fs.statSync(capabilityFile)
  } catch (err) {
    if (isDefinitePathAbsence(err)) return { status: 'absent' }
    const code = (err as NodeJS.ErrnoException).code
    return {
      status: 'rejected',
      file: capabilityFile,
      message: `Cannot read capability manifest: ${code ?? String(err)}`,
    }
  }

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(capabilityFile, 'utf-8'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'rejected',
      file: capabilityFile,
      message: `Capability manifest is unreadable: ${message}`,
    }
  }

  const issues = precheckCapability(raw, pluginRoot, pluginName)
  if (issues.length > 0) {
    return {
      status: 'rejected',
      file: capabilityFile,
      message: `Capability manifest rejected: ${summarizeIssues(issues)}`,
    }
  }
  // issues 为空 ⇒ parseCapabilityManifest 一定 ok;这里再取一次是为了类型收窄,不做第二份判据。
  const parsed = parseCapabilityManifest(raw, { knownPermissions: HOST_KNOWN_PERMISSIONS })
  if (!parsed.ok) {
    return {
      status: 'rejected',
      file: capabilityFile,
      message: `Capability manifest rejected: ${summarizeIssues(parsed.issues)}`,
    }
  }
  return { status: 'ok', capability: parsed.manifest }
}
