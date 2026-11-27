// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 智能体定义 · 名称规则（P2-08）。
 *
 * 名称是跨端/跨库的稳定标识，规则对齐 01 §3.1 的 CHECK：
 *   name varchar(64) CHECK (name ~ '^[a-z0-9][a-z0-9_-]{0,31}$')
 * 即：小写字母/数字开头，后续只允许 a-z 0-9 _ -，最长 32。
 *
 * 本文件在 DB 规则之上再加三条产品约束：
 * 1. **规范形态**：统一小写、空格与下划线转连字符、折叠连字符；
 *    `Frontend Dev` / `frontend_dev` 都归一为 `frontend-dev`。
 * 2. **保留名**：`master` + 10 个内置名不可被用户定义占用（`Master` 归一后同样拒绝，
 *    返回 `AGENT_NAME_RESERVED` 的判定依据）。
 * 3. **克隆后缀**：克隆内置/已有定义时自动生成 `coder-copy`，被占用则 `coder-copy-2`、
 *    `coder-copy-3` ……（验收样例：`coder-copy` 可用）。
 *
 * 注意：DB 允许下划线，但规范化输出**只用连字符**；已落库的旧名（含 `_`）仍按 DB 规则判合法，
 * 由 R1 在创建/克隆入口调用 normalize，读取路径不做改写。
 */

import { AGENT_ROLES } from './contracts'

/** 总管人格的保留名。 */
export const MASTER_AGENT_NAME = 'master' as const

/** 10 个内置定义名（与内置角色同名，种子由 F1 写入）。 */
export const BUILTIN_AGENT_NAMES = AGENT_ROLES

/** 保留名 = master + 10 内置。用户定义（personal/team/custom）不得占用。 */
export const RESERVED_AGENT_NAMES = [MASTER_AGENT_NAME, ...AGENT_ROLES] as const

/** 名称最大长度（对齐 DB CHECK 的 32 字符上限）。 */
export const AGENT_NAME_MAX_LENGTH = 32

/** DB 合法形态（含下划线，用于校验已落库旧名）。 */
export const AGENT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/

/** 规范化输出形态（只含连字符，不允许下划线）。 */
export const CANONICAL_AGENT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

/** 名称问题（可多项）。 */
export type AgentNameIssue = 'empty' | 'reserved' | 'taken' | 'invalid-characters'

/** `normalizeAgentName` 选项。 */
export interface NormalizeAgentNameOptions {
  /** 覆盖最大长度（默认 {@link AGENT_NAME_MAX_LENGTH}）。 */
  maxLength?: number
  /**
   * 克隆来源名。给出时忽略 `raw`，以来源名生成 `-copy` / `-copy-N` 后缀；
   * 这是「克隆后缀」的唯一入口。
   */
  cloneOf?: string
  /**
   * 已占用名（大小写/空格/下划线不敏感）。非克隆场景命中 → `taken` 问题；
   * 克隆场景命中 → 自动递增 `-copy-N`。
   */
  taken?: readonly string[]
  /** 保留名处置：`reject`（默认，返回 valid=false）或 `suffix`（追加 `-agent` 规避）。 */
  onReserved?: 'reject' | 'suffix'
  /** `onReserved='suffix'` 时使用的后缀，默认 `-agent`。 */
  reservedSuffix?: string
}

/** 规范化结果。`valid` 为 false 时 `issues` 至少一项。 */
export interface NormalizedAgentName {
  /** 原始输入（未清洗）。 */
  input: string
  /** 规范化后的名称（小写、连字符；可能被截断/加后缀）。 */
  name: string
  /** 是否可用（格式合法 + 非保留 + 未被占用）。 */
  valid: boolean
  /** 归一后是否落在保留名集合。 */
  reserved: boolean
  /** 是否走了克隆后缀。 */
  cloned: boolean
  /** 是否因超长被截断（截断不算失败，但调用方应提示）。 */
  truncated: boolean
  /** 问题清单；valid=true 时为空。 */
  issues: readonly AgentNameIssue[]
}

/** 把任意输入清洗为规范形态（小写、空格/下划线→连字符、去非法字符、折叠连字符）。 */
export function canonicalAgentName(raw: string): string {
  return raw
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function truncateName(name: string, maxLength: number): { name: string; truncated: boolean } {
  if (name.length <= maxLength) return { name, truncated: false }
  const cut = name.slice(0, maxLength).replace(/-+$/, '')
  return { name: cut, truncated: true }
}

/** 在 base 末尾追加 suffix，保证总长 ≤ maxLength（超长先截 base）。 */
function withSuffix(base: string, suffix: string, maxLength: number): string {
  const trimmedBase = base.replace(/-+$/, '')
  const room = maxLength - suffix.length
  if (room <= 0) return suffix.replace(/^-+/, '').slice(0, maxLength)
  return `${truncateName(trimmedBase, room).name}${suffix}`
}

/** 归一后是否为保留名（大小写/空格/下划线不敏感）。 */
export function isReservedAgentName(name: string): boolean {
  return (RESERVED_AGENT_NAMES as readonly string[]).includes(canonicalAgentName(name))
}

/** 是否符合 DB 名称规则（允许下划线，兼容历史落库名）。 */
export function isValidAgentName(name: string): boolean {
  return AGENT_NAME_PATTERN.test(name)
}

/** 名称是否可被新建/克隆使用：格式合法 + 非保留 + 不在 taken 内。 */
export function isAvailableAgentName(name: string, taken: readonly string[] = []): boolean {
  const canonical = canonicalAgentName(name)
  if (!CANONICAL_AGENT_NAME_PATTERN.test(canonical)) return false
  if (isReservedAgentName(canonical)) return false
  const takenSet = new Set(taken.map(canonicalAgentName).filter((item) => item !== ''))
  return !takenSet.has(canonical)
}

/**
 * 规范化名称，并处理保留名与克隆后缀。
 *
 * 样例（验收口径）：
 * - `normalizeAgentName('  Frontend Dev ')` → `frontend-dev`，valid
 * - `normalizeAgentName('Master')` → `master`，reserved，valid=false
 * - `normalizeAgentName('coder', { cloneOf: 'coder' })` → `coder-copy`，valid
 * - `normalizeAgentName('coder', { cloneOf: 'coder', taken: ['coder-copy'] })` → `coder-copy-2`
 */
export function normalizeAgentName(
  raw: string,
  options: NormalizeAgentNameOptions = {},
): NormalizedAgentName {
  const maxLength = options.maxLength ?? AGENT_NAME_MAX_LENGTH
  const cloned = options.cloneOf !== undefined
  const source = options.cloneOf ?? raw

  const issues: AgentNameIssue[] = []
  let truncated = false

  let name = canonicalAgentName(source)
  if (name === '') {
    return {
      input: raw,
      name: '',
      valid: false,
      reserved: false,
      cloned,
      truncated: false,
      issues: ['empty'],
    }
  }

  // 克隆：先加 -copy，再按 maxLength 截断
  if (cloned) {
    name = withSuffix(name, '-copy', maxLength)
  }

  const truncatedOnce = truncateName(name, maxLength)
  name = truncatedOnce.name
  truncated = truncatedOnce.truncated

  // 保留名（master / 10 内置）
  let reserved = isReservedAgentName(name)
  if (reserved && options.onReserved === 'suffix') {
    name = withSuffix(name, options.reservedSuffix ?? '-agent', maxLength)
    reserved = isReservedAgentName(name)
  }
  if (reserved) issues.push('reserved')

  // 占用名：克隆自动 -copy-N；普通创建直接报 taken
  const takenSet = new Set(
    options.taken?.map(canonicalAgentName).filter((item) => item !== '') ?? [],
  )
  if (takenSet.has(name)) {
    if (cloned) {
      const cloneBase = canonicalAgentName(source)
      let index = 2
      let candidate = name
      while (takenSet.has(candidate) && index <= 999) {
        candidate = withSuffix(cloneBase, `-copy-${index}`, maxLength)
        index += 1
      }
      name = candidate
      if (takenSet.has(name)) issues.push('taken')
    } else {
      issues.push('taken')
    }
  }

  if (!CANONICAL_AGENT_NAME_PATTERN.test(name)) {
    issues.push('invalid-characters')
  }

  return {
    input: raw,
    name,
    valid: issues.length === 0,
    reserved,
    cloned,
    truncated,
    issues,
  }
}

/** 克隆名快捷入口：`buildCloneAgentName('coder')` → `coder-copy`。 */
export function buildCloneAgentName(source: string, taken: readonly string[] = []): string {
  return normalizeAgentName(source, { cloneOf: source, taken }).name
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
