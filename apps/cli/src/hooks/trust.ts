// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Hook Trust — Hook 派发前的信任门控(security P0)。
 *
 * 简化策略(做减法):
 *   - 2 个核心 gate:
 *     1. **disabled-hooks file**(每行一个被禁 hook 名,# 注释)
 *        → ~/.ihui/disabled-hooks(用户手动禁用,类似 git-blame-ignore-revs)
 *     2. **folder-trust**(cwd 是否在 ~/.ihui/trusted-folders 列表里)
 *        → git clone 恶意仓库不会自动执行 hooks
 *   - 默认安全策略:不信任任何 <cwd>/.ihui/hooks.json 派生的 hook
 *   - 0 新依赖
 *
 * 安全模型:
 *   - hooks.json 本身可被任何人改写(folder 内),但 hook 派发前必须过 trust gate
 *   - 用户首次执行新 folder 的 hooks 时,IHUI 应打印 "trust this folder?" 提示
 *   - 批准后写入 ~/.ihui/trusted-folders,一行 = 目录 + **当时那份内容的摘要**
 *   - 取消信任:从该文件删除对应行(hooks list 也能看出"这条对应哪份内容 / 内容已变")
 *
 * 为什么摘要不可省(A20):只有目录凭据时,"这个目录被信任过"会一直为真 ——
 * 之后往它的 hooks.json 里塞任何新命令都不再问一次。信任必须绑"当时批准的那份内容",
 * 内容变了就要重新确认,而不是静默放行。
 *
 * API:
 *   - isHookDisabled(name):是否被手动禁用(单条规则)
 *   - isFolderTrusted(absPath):folder 是否在白名单(只看目录级"批过没有")
 *   - trustFolder(path, digests?) / untrustFolder:用户操作(批准 = 目录 + 当时那份内容)
 *   - 摘要口径本身在配置层(index.ts 的 digestOfHooksBundle / digestOfHookDeclaration),
 *     信任层只认不透明字符串 —— 两侧同一份实现的说明写在那儿。
 *   - readTrustedFolderRecord / listTrustedFolderRecords:读记录(含摘要)
 *   - checkFolderContentTrust(folder, bundleDigest, hookName, declDigest):内容判定
 *   - gateHook(spec, absCwd, trustFileText?):组合判断 — 派发前一次性调用
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, isAbsolute } from 'node:path'
import { homedir } from 'node:os'
// 规范化器只认这一份实现(AGENTS「两处算同一 key 必须共用一份实现」):
// apps/cli/src/stream-tool-ledger.ts 的 canonicalizeArgs(递归按 key 排序)。
// 规格 A20 建议把它提到 packages/shared —— 实测该路径在本仓既不在磁盘也不在 git,
// 且共享层不在本票受影响文件清单内,故复用现存唯一实现;外提是另一票的动作。
// 摘要算法本身在配置层(index.ts),这里只用规范化器序列化"逐条摘要表"。
import { canonicalizeArgs } from '../stream-tool-ledger.js'

/**
 * 旧格式信任记录(升级前落盘的裸目录行)的摘要占位值。
 * 它既不是"已信任"也不是"未信任" —— 见 checkFolderContentTrust 的 legacy 分支与注释。
 */
export const LEGACY_DIGEST = 'legacy'

/** ~/.ihui/disabled-hooks — 每行一个被禁 hook 名,# 开头为注释 */
const DISABLED_HOOKS_PATH = join(homedir(), '.ihui', 'disabled-hooks')

/** ~/.ihui/trusted-folders — 每行一个被信任的绝对路径 */
const TRUSTED_FOLDERS_PATH = join(homedir(), '.ihui', 'trusted-folders')

/**
 * 路径规范化:去尾部斜杠 + lowercase(Windows 大小写不敏感)。
 * 导出是为了让展示侧(hooks list 标"当前目录")与判侧(isFolderTrusted)
 * 用同一把尺子 —— 两处各算一次"是不是同一个目录",迟早分叉。
 */
export function normalizeFolderPath(p: string): string {
  let n = resolve(p)
  if (n.length > 1 && (n.endsWith('/') || n.endsWith('\\'))) {
    n = n.slice(0, -1)
  }
  return process.platform === 'win32' ? n.toLowerCase() : n
}

/**
 * 是否手动禁用了某 hook(读 ~/.ihui/disabled-hooks)。
 * 文件不存在 / 读取失败 → 不禁用(默认启用)。
 */
export function isHookDisabled(hookName: string): boolean {
  if (!existsSync(DISABLED_HOOKS_PATH)) return false
  try {
    const content = readFileSync(DISABLED_HOOKS_PATH, 'utf-8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      if (line === hookName) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 列出所有被禁 hook 名(用于 /hooks list 等 UI)。
 */
export function listDisabledHooks(): string[] {
  if (!existsSync(DISABLED_HOOKS_PATH)) return []
  try {
    const content = readFileSync(DISABLED_HOOKS_PATH, 'utf-8')
    const out: string[] = []
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      out.push(line)
    }
    return out
  } catch {
    return []
  }
}

/**
 * 禁用一个 hook(append 一行到 disabled-hooks,已存在则跳过)。
 * 返回 true 表示成功写入, false 表示已存在或写入失败。
 */
export function disableHook(hookName: string): boolean {
  if (isHookDisabled(hookName)) return false
  try {
    // 兜底:确保 ~/.ihui 存在
    const dir = join(homedir(), '.ihui')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const line = hookName.includes('\n') ? JSON.stringify(hookName) : hookName
    appendFileSync(DISABLED_HOOKS_PATH, `${line}\n`, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * 取消禁用(整文件重写,删除对应行)。
 * 返回 true 表示成功移除, false 表示原本未禁用或写入失败。
 */
export function enableHook(hookName: string): boolean {
  if (!isHookDisabled(hookName)) return false
  try {
    const content = readFileSync(DISABLED_HOOKS_PATH, 'utf-8')
    const next = content
      .split('\n')
      .filter((line) => line.trim() !== hookName)
      .join('\n')
    writeFileSync(DISABLED_HOOKS_PATH, next, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * folder 是否在 ~/.ihui/trusted-folders 列表中(绝对路径比较)。
 *
 * 这一句只回答**目录级**"批过没有",不回答"内容还是不是那份" —— 后者是
 * checkFolderContentTrust / gateHook 第 4 道。两者分开是有意的:
 * `ihui hooks list` 要能说出"这个目录批过、但内容已变",合并成一个布尔就再也说不清。
 * 判定统一走 readTrustedFolderRecord(同一份行解析),不得在此另抄一遍 split/trim。
 *
 * @param trustFileText 测试/诊断注入口;缺省读 ~/.ihui/trusted-folders
 */
export function isFolderTrusted(folderPath: string, trustFileText?: string): boolean {
  return readTrustedFolderRecord(folderPath, trustFileText) !== null
}

/**
 * 批准一个目录。
 *
 * 带 `digests` = 新语义(目录 + 当时那份内容);不带 = 落一行 LEGACY_DIGEST,
 * 之后每次派发都会被判"内容未确认"。所以调用方应当传 —— `ihui hooks trust` 就是
 * 用 index.ts 的 computeHookContentDigests 现算现传,保证批准侧与派发侧同一份口径。
 *
 * 走 saveTrustedFolderRecord 而不是裸 append:同一目录已有记录时裸 append 会留下两行,
 * 而读侧只认第一行 —— 写侧必须与读侧同形(否则"重新批准"看起来成功、实际没生效)。
 */
export function trustFolder(
  folderPath: string,
  digests?: { bundleDigest: string; declarations: Record<string, string> },
): boolean {
  const abs = isAbsolute(folderPath) ? folderPath : resolve(folderPath)
  if (!isFolderTrusted(abs)) return saveTrustedFolderRecord(abs, digests?.bundleDigest ?? LEGACY_DIGEST, digests?.declarations ?? {})
  // 已在名单里:旧格式行(或需要刷新摘要)时升级为带摘要的记录,新格式且摘要一致则幂等
  const rec = readTrustedFolderRecord(abs)
  if (!rec) return false
  const nextBundle = digests?.bundleDigest ?? rec.bundleDigest
  const nextDecls = digests?.declarations ?? rec.declarationDigests
  if (!rec.legacy && rec.bundleDigest === nextBundle) {
    // 摘要逐位相同 → 幂等,不重写文件(重写会让"什么也没发生"看起来像一次变更)
    if (canonicalizeArgs(rec.declarationDigests) === canonicalizeArgs(nextDecls)) return false
  }
  return saveTrustedFolderRecord(abs, nextBundle, nextDecls)
}

/**
 * 取消信任(整文件重写)。
 * 逐行走 parseTrustLine 比对 —— 新格式那一行是 `路径\t摘要\t摘要表`,
 * 拿整行去比目录名永远不相等,旧写法会把要删的那行原样留下(撤销静默失效)。
 */
export function untrustFolder(folderPath: string): boolean {
  if (!isFolderTrusted(folderPath)) return false
  const abs = isAbsolute(folderPath) ? folderPath : resolve(folderPath)
  const target = normalizeFolderPath(abs)
  try {
    const content = readFileSync(TRUSTED_FOLDERS_PATH, 'utf-8')
    const next = content
      .split('\n')
      .filter((rawLine) => {
        const rec = parseTrustLine(rawLine)
        return rec === null ? rawLine.trim() !== '' : rec.folder !== target
      })
      .join('\n')
    writeFileSync(TRUSTED_FOLDERS_PATH, next, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * 列出所有被信任的 folder 路径(供 `ihui hooks list` 等 UI)。
 * 只回路径一列 —— 摘要列要看"内容变没变"请用 listTrustedFolderRecords。
 */
export function listTrustedFolders(): string[] {
  return listTrustedFolderRecords().map((r) => r.rawPath)
}

// ==================== 内容信任层(A20:信任绑"当时批准的那份内容",不绑目录) ====================

/**
 * 一条信任记录 = 目录 + **授权那一刻**的内容摘要。
 *
 * 为什么要两级摘要(缺任一级都会退化):
 *   - bundleDigest(整束):覆盖"影响所有钩子的环境"—— 来源文件增删 / 条目顺序 / 根级字段。
 *     只有单条摘要时,往 hooks.json 里**新塞一条**钩子在它第一次派发前完全隐身。
 *   - declarationDigest(单条):覆盖"这一条声明本身"。只有整束摘要时,改一条命令会让
 *     **全部**钩子掉信任,用户被骚扰到无脑点"是" → 信任退化成噪音(A20 明确要防的那条)。
 *
 * 落盘形态(见 readTrustedFolderRecord 的存量迁移语义):
 *   `<原始路径>\t<bundleDigest>\t<声明摘要 JSON>`,制表符分列,第三列由 canonicalizeArgs 生成。
 *   旧格式 = 只有路径一列的裸行。
 */
export interface TrustedFolderRecord {
  /** 写盘的原始路径(展示用);比较一律走 normalizeFolderPath 后的 folder */
  rawPath: string
  folder: string
  /** 整束内容摘要;LEGACY_DIGEST = 升级前的裸目录行(没有摘要位) */
  bundleDigest: string
  /** 键 = 钩子 `name`(与 ~/.ihui/disabled-hooks 同一身份口径;见 index.ts 的注释) */
  declarationDigests: Record<string, string>
  /** true = 旧格式裸目录行 */
  legacy: boolean
  /** true = 这一行读不出摘要(JSON 坏了 / 形态不对)→ 只报"无法判定",绝不冒信任 */
  malformed: boolean
}

/**
 * 内容信任判定结果的状态值域。逐态"谁能让它变成可跑":
 *   - trusted             摘要逐位相符 → 无需任何动作
 *   - untrusted           目录从未被批准 → 只有 `ihui hooks trust <folder>`
 *   - legacy              升级前的记录,内容未知 → 重新跑一次 `ihui hooks trust <folder>`
 *   - bundle-changed      整束变了(含新增/删除条目)→ 同上
 *   - declaration-changed **这一条**声明与批准时不同 → 同上
 *   - unknown-format      信任文件里这一行读不出摘要 → 同上(修文件或用命令重批)
 */
export type ContentTrustState =
  | 'trusted'
  | 'untrusted'
  | 'legacy'
  | 'bundle-changed'
  | 'declaration-changed'
  | 'unknown-format'

export interface ContentTrustVerdict {
  state: ContentTrustState
  allowed: boolean
  /** 可诊断提示里给出的**确切**重新取信命令 */
  remedy: string
  detail: string
}

/** 信任记录列分隔符:目录名里不会出现制表符,且旧裸路径行天然只有一列 */
const RECORD_SEP = '\t'

function decodeDeclarationDigests(text: string): Record<string, string> | null {
  if (text.trim() === '') return {}
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'string') return null
      out[k] = v
    }
    return out
  } catch {
    return null
  }
}

/** 解析一行信任记录;注释 / 空行 / 空路径返回 null(不是违规,只是没有记录) */
function parseTrustLine(rawLine: string): TrustedFolderRecord | null {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) return null
  const cols = line.split(RECORD_SEP)
  const rawPath = (cols[0] ?? '').trim()
  const folder = normalizeFolderPath(rawPath)
  if (!folder) return null
  const bundleDigest = cols[1]
  if (bundleDigest === undefined) {
    // 存量迁移语义:旧格式裸目录行 = "这个目录批过、内容未比对",不是未信任
    return {
      rawPath,
      folder,
      bundleDigest: LEGACY_DIGEST,
      declarationDigests: {},
      legacy: true,
      malformed: false,
    }
  }
  const digests = cols[2] === undefined ? {} : decodeDeclarationDigests(cols[2] as string)
  if (digests === null) {
    return { rawPath, folder, bundleDigest, declarationDigests: {}, legacy: false, malformed: true }
  }
  return { rawPath, folder, bundleDigest, declarationDigests: digests, legacy: false, malformed: false }
}

function readTrustFileText(): string | null {
  if (!existsSync(TRUSTED_FOLDERS_PATH)) return null
  try {
    return readFileSync(TRUSTED_FOLDERS_PATH, 'utf-8')
  } catch {
    return null
  }
}

/** 逐行解析信任文件;`trustFileText` 为测试/诊断注入口,缺省读 ~/.ihui/trusted-folders */
function parseTrustRecords(trustFileText?: string): TrustedFolderRecord[] {
  const content = trustFileText ?? readTrustFileText()
  if (content === null) return []
  const out: TrustedFolderRecord[] = []
  for (const rawLine of content.split('\n')) {
    const rec = parseTrustLine(rawLine)
    if (rec) out.push(rec)
  }
  return out
}

/**
 * 查某个目录的信任记录(含摘要)。目录级判定 isFolderTrusted 与本函数同源,
 * 不得各读一遍文件 —— 两处算同一个"在不在清单里"迟早分叉。
 */
export function readTrustedFolderRecord(
  folderPath: string,
  trustFileText?: string,
): TrustedFolderRecord | null {
  const target = normalizeFolderPath(isAbsolute(folderPath) ? folderPath : resolve(folderPath))
  return parseTrustRecords(trustFileText).find((r) => r.folder === target) ?? null
}

/** 列出全部信任记录(供 `ihui hooks list` 标出"这条对应哪份内容 / 内容是否已变") */
export function listTrustedFolderRecords(trustFileText?: string): TrustedFolderRecord[] {
  return parseTrustRecords(trustFileText)
}

/**
 * 写入 / 覆盖一个目录的信任记录(整文件重写,**保留其它行逐字不动**)。
 * 路径含制表符或换行时拒绝写入 —— 那种路径在本格式下无法表示,静默写进去等于
 * 造一条永远读不回来的信任记录(比不写更糟)。
 */
export function saveTrustedFolderRecord(
  folderPath: string,
  bundleDigest: string,
  declarationDigests: Record<string, string>,
): boolean {
  const abs = isAbsolute(folderPath) ? folderPath : resolve(folderPath)
  if (abs.includes('\t') || abs.includes('\n') || abs.includes('\r')) return false
  const target = normalizeFolderPath(abs)
  const line = `${abs}${RECORD_SEP}${bundleDigest}${RECORD_SEP}${canonicalizeArgs(declarationDigests)}`
  try {
    const dir = join(homedir(), '.ihui')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const existing = readTrustFileText()
    const kept: string[] = []
    let replaced = false
    if (existing !== null) {
      for (const rawLine of existing.split('\n')) {
        const rec = parseTrustLine(rawLine)
        if (rec && rec.folder === target && !replaced) {
          kept.push(line)
          replaced = true
          continue
        }
        kept.push(rawLine)
      }
    }
    if (!replaced) kept.push(line)
    writeFileSync(TRUSTED_FOLDERS_PATH, kept.join('\n'), 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * 内容信任判定 —— 目录已批准之后**必须**再问这一句。
 *
 * 存量迁移语义(硬约束 2,依据与代价):
 *   升级前的记录没有摘要位 ⇒ 既不能当"已信任"(那正是本票要修的洞:往旧信任目录的
 *   hooks.json 里塞命令照样放行),也不能当"未信任"(那会把用户已经做过的授权凭空作废,
 *   且在 CI / 无人值守里表现为钩子静默不跑,和"没接线"同一种安静)。
 *   取中间语义 **legacy = 未确认**:目录级判定照旧为真(`ihui hooks list` 看得见它),
 *   派发侧判红并点名唯一出口 `ihui hooks trust <folder>` —— 一次重批即永久升级成新格式,
 *   之后内容没变的正常路径零打扰。代价:升级后每个旧信任目录的钩子会被拦一次。
 */
export function checkFolderContentTrust(
  folderPath: string,
  bundleDigest: string,
  hookName?: string,
  declarationDigest?: string,
  trustFileText?: string,
): ContentTrustVerdict {
  const folder = normalizeFolderPath(isAbsolute(folderPath) ? folderPath : resolve(folderPath))
  const remedy = `ihui hooks trust "${folder}"`
  const rec = readTrustedFolderRecord(folder, trustFileText)
  if (!rec) {
    return {
      state: 'untrusted',
      allowed: false,
      remedy,
      detail: `目录 "${folder}" 未在 ~/.ihui/trusted-folders 中`,
    }
  }
  if (rec.malformed) {
    return {
      state: 'unknown-format',
      allowed: false,
      remedy,
      detail: `~/.ihui/trusted-folders 中目录 "${folder}" 那一行的摘要字段读不出来(文件被手改坏?),无法判定内容是否仍是批准时那份`,
    }
  }
  if (rec.legacy) {
    return {
      state: 'legacy',
      allowed: false,
      remedy,
      detail: `目录 "${folder}" 是 A20 之前批准的旧记录,没有内容摘要位 → 按"内容未确认"处理,不静默放行`,
    }
  }
  if (rec.bundleDigest !== bundleDigest) {
    return {
      state: 'bundle-changed',
      allowed: false,
      remedy,
      detail: `目录 "${folder}" 已信任,但其钩子配置束与批准时不一致(新增/删除条目或来源文件变化)→ 需重新确认`,
    }
  }
  if (hookName !== undefined && declarationDigest !== undefined) {
    const stored = rec.declarationDigests[hookName]
    if (stored === undefined) {
      return {
        state: 'bundle-changed',
        allowed: false,
        remedy,
        detail: `钩子 "${hookName}" 不在目录 "${folder}" 的信任登记表里(束摘要相符却无此项,属异常形态)→ 需重新确认`,
      }
    }
    if (stored !== declarationDigest) {
      return {
        state: 'declaration-changed',
        allowed: false,
        remedy,
        detail: `钩子 "${hookName}" 的声明内容与批准时那份不一致(命令 / URL / 匹配器 / 超时等任一字段被改过)→ 需重新确认`,
      }
    }
  }
  return { state: 'trusted', allowed: true, remedy, detail: '' }
}

/** 目录级 + 内容级合并判定;`hookName` / `declarationDigest` 省略时只比束摘要 */
export function isFolderContentTrusted(
  folderPath: string,
  bundleDigest: string,
  hookName?: string,
  declarationDigest?: string,
  trustFileText?: string,
): boolean {
  return checkFolderContentTrust(folderPath, bundleDigest, hookName, declarationDigest, trustFileText)
    .allowed
}

// ==================== 派发 gate ====================

export interface HookSpecLite {
  /** hook 唯一名(在 hooks.json 中定义) */
  name: string
  /** 是否启用(spec.enabled) */
  enabled?: boolean
  /**
   * 当前这份钩子配置束的内容摘要(index.ts 的 computeHookContentDigests 算的)。
   * 缺省 = 调用方没有接入内容信任 → gateHook 第 4 道按"无法判定"拒绝,
   * 因为"忘了接摘要"与"内容确实没变"在门内长得一模一样,只能 fail-closed。
   */
  bundleDigest?: string
  /** 本条钩子的身份(= name);与 declarationDigest 成对出现 */
  hookName?: string
  /** digestOfHookDeclaration(该条声明) 的返回值 */
  declarationDigest?: string
}

export interface HookGateResult {
  /** 是否允许派发 */
  allowed: boolean
  /** 不允许的原因 */
  reason?:
    | 'disabled-in-config'
    | 'disabled-by-user'
    | 'folder-not-trusted'
    | 'content-not-confirmed'
  /** 详细说明(给用户/日志看) */
  detail?: string
}

/**
 * 逃生舱(唯一形态:显式环境变量)。IHUI_TRUST_WORKSPACE **不在**这一档 ——
 * 它只免"目录信任"(第一轮立的),不免"内容已变";两个出口各管一类,
 * 否则一个 CI 开关就把本票整个绕过,等于没修。
 */
const CONTENT_TRUST_SKIP_ENV = 'IHUI_HOOK_TRUST_ALLOW_STALE'

/**
 * 派发前一次性 gate:组合 disabled + folder-trust + **内容信任**。
 *
 * 用法:
 *   const r = gateHook({ name: 'block-rm-rf', enabled: true, bundleDigest, digestKey, declarationDigest }, process.cwd())
 *   if (!r.allowed) {
 *     console.warn('hook skipped:', r.reason, r.detail)
 *     return
 *   }
 *   // ... 派发 hook
 *
 * 调用顺序(由轻到重):
 *   1. spec.enabled === false → skip(disabled-in-config)
 *   2. isHookDisabled(name)    → skip(disabled-by-user)
 *   3. !isFolderTrusted(cwd)   → skip(folder-not-trusted)— security P0
 *   4. 内容摘要与批准时那份不符 → skip(content-not-confirmed)— security P0(A20)
 *      第 4 条与第 3 条**不可合并**:目录没批过 = "先决定信不信这个目录";
 *      批过而内容变了 = "你批的那份已经被换掉了"。混成一句提示,用户无从判断该看什么。
 */
export function gateHook(spec: HookSpecLite, absCwd: string, trustFileText?: string): HookGateResult {
  if (spec.enabled === false) {
    return {
      allowed: false,
      reason: 'disabled-in-config',
      detail: `hook "${spec.name}" is disabled in hooks.json`,
    }
  }
  if (isHookDisabled(spec.name)) {
    return {
      allowed: false,
      reason: 'disabled-by-user',
      detail: `hook "${spec.name}" is in ~/.ihui/disabled-hooks`,
    }
  }
  if (!isFolderTrusted(absCwd, trustFileText)) {
    return {
      allowed: false,
      reason: 'folder-not-trusted',
      // 措辞必须给**存在**的出口:`ihui hooks trust <path>` 自 2026-09-25 起是真实子命令
      // (见 commands/hooks.ts);~/.ihui/trusted-folders 只是它背后的落盘文件。
      detail:
        `folder "${absCwd}" is not in ~/.ihui/trusted-folders; ` +
        `执行 \`ihui hooks trust "${absCwd}"\` 即可在本机信任它,` +
        '非交互场景可设 IHUI_TRUST_WORKSPACE=1 让本次运行信任当前工作区',
    }
  }
  // ---- 第 4 道:内容信任(目录已批准,还要问"是不是当初批准的那份") ----
  const { bundleDigest, hookName, declarationDigest } = spec
  if (bundleDigest === undefined) {
    return {
      allowed: false,
      reason: 'content-not-confirmed',
      detail:
        `hook "${spec.name}" 的调用方未提供内容摘要(bundleDigest),无法判定它是否仍是` +
        `批准时那份 → 按不通过处理(fail-closed:忘接摘要与内容被换在门内长得一样)。` +
        `派发侧请走 hooks/index.ts 的 computeHookContentDigests;确需临时放行请显式设 ${CONTENT_TRUST_SKIP_ENV}=1`,
    }
  }
  if (hookName !== undefined && declarationDigest === undefined) {
    return {
      allowed: false,
      reason: 'content-not-confirmed',
      detail: `hook "${spec.name}" 给了 hookName 却没给 declarationDigest(半套摘要)= 无法判定,按不通过处理`,
    }
  }
  if (process.env[CONTENT_TRUST_SKIP_ENV] === '1') {
    return { allowed: true }
  }
  const verdict = checkFolderContentTrust(absCwd, bundleDigest, hookName, declarationDigest, trustFileText)
  if (!verdict.allowed) {
    return {
      allowed: false,
      reason: 'content-not-confirmed',
      detail:
        `${verdict.detail};重新确认这一条请执行 \`${verdict.remedy}\`` +
        `(整目录重批,会同时刷新束摘要与逐条摘要)。无人值守场景的显式出口:` +
        `${CONTENT_TRUST_SKIP_ENV}=1(只对本机本次运行生效,不会写任何文件)`,
    }
  }
  return { allowed: true }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
