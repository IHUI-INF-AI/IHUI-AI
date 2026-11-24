// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具大输出 spill（2026-11-23 立，对齐 DSH `dsh-spill` / `dsh-spill-local` / `dsh-spill-policy`）。
 *
 * 立因：`output-budget.ts` 只做“头 + 尾 + 截断标记”，被截掉的中间段**永久丢失**。
 * DSH 的 spill 把全文落到本地文件并返回 `locator + bytes + retrievalHint`，模型看到有界预览，
 * 需要细节时再按 locator 读全文。本模块提供同语义的本地后端，落点固定在工作区
 * `<workspace>/.ihui-agent/tool-spill/<owner>/`，不写系统临时目录、不跨工作区。
 *
 * 边界：
 * - 定位符是**工作区相对路径**（`fs/read` 可直接读），不返回服务器绝对路径。
 * - 只做保存与过期清理，不做替换/检索；预览决策在调用方（`budgetWithSpill`）。
 * - 保存失败不把成功的命令变成失败：返回 `spillError`，内联预览照常返回。
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { truncateBothEnds, type BudgetedText } from './output-budget.js'

/** 工具结果内联预算：与 `run_command` 原 32000 保持同一数值，路由与工具共用一处。 */
export const TOOL_OUTPUT_MAX_CHARS = 32_000

/** 单条 spill 最长保留 7 天；单工作区最多 500 个文件，先到先删。 */
export const SPILL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const SPILL_MAX_FILES = 500

export interface SpillRef {
  /** 工作区相对路径，正斜杠，可直接交给 fs/read */
  locator: string
  /** 精确 UTF-8 字节数 */
  bytes: number
  /** 给模型的取回指引 */
  retrievalHint: string
}

export interface SpillSource {
  toolName: string
  callId?: string
  label?: string
}

export interface SpillSaveOptions {
  workspacePath: string
  owner?: string
  source: SpillSource
  suggestedName?: string
  content: string
}

export interface BudgetedWithSpill extends BudgetedText {
  spill?: SpillRef
  spillError?: string
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]{1,80}$/

/** 客户端给的 name 只当提示：清成单个安全路径段，绝不当可信路径。 */
export function sanitizeSpillName(name: string | undefined, fallback = 'output.txt'): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '')
  return SAFE_SEGMENT.test(cleaned) ? cleaned : fallback
}

function sanitizeOwner(owner: string | undefined): string {
  const cleaned = (owner ?? 'default').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
  return cleaned || 'default'
}

function assertInsideWorkspace(workspacePath: string, target: string): void {
  const realRoot = realpathSync(workspacePath)
  const realTarget = existsSync(target) ? realpathSync(target) : resolve(target)
  const rel = relative(realRoot, realTarget)
  if (rel !== '' && (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) {
    throw new Error('spill 落点越出工作区')
  }
}

/** 过期/超额清理；best-effort，失败不影响保存。 */
export function sweepSpillFiles(
  root: string,
  now = Date.now(),
  maxAgeMs = SPILL_MAX_AGE_MS,
  maxFiles = SPILL_MAX_FILES,
): { removed: number; kept: number } {
  if (!existsSync(root)) return { removed: 0, kept: 0 }
  const entries: Array<{ path: string; mtime: number; size: number }> = []
  const walk = (dir: string) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, item.name)
      if (item.isDirectory()) walk(full)
      else if (item.isFile()) {
        const st = statSync(full)
        entries.push({ path: full, mtime: st.mtimeMs, size: st.size })
      }
    }
  }
  walk(root)
  let removed = 0
  for (const entry of entries) {
    if (now - entry.mtime > maxAgeMs) {
      try {
        rmSync(entry.path, { force: true })
        removed++
      } catch {
        // 清理是 best-effort
      }
    }
  }
  const remaining = entries.filter((e) => existsSync(e.path))
  if (remaining.length > maxFiles) {
    remaining.sort((a, b) => a.mtime - b.mtime)
    for (const entry of remaining.slice(0, remaining.length - maxFiles)) {
      try {
        rmSync(entry.path, { force: true })
        removed++
      } catch {
        // 同上
      }
    }
  }
  return { removed, kept: Math.min(remaining.length, maxFiles) }
}

let lastSweepAt = 0

/** 保存全文并返回定位符；定位符只含工作区相对路径。 */
export function saveToolOutputSpill(options: SpillSaveOptions): SpillRef {
  const workspacePath = resolve(options.workspacePath)
  if (!existsSync(workspacePath)) throw new Error('工作区不存在，无法保存 spill')
  const owner = sanitizeOwner(options.owner)
  const dir = join(workspacePath, '.ihui-agent', 'tool-spill', owner)
  mkdirSync(dir, { recursive: true })
  assertInsideWorkspace(workspacePath, dir)

  const name = sanitizeSpillName(
    options.suggestedName,
    `${sanitizeSpillName(options.source.toolName)}.txt`,
  )
  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const base = `${id}-${name}`
  const target = join(dir, base)
  const tmp = join(dir, `.${base}.tmp`)
  try {
    writeFileSync(tmp, options.content, 'utf8')
    renameSync(tmp, target)
  } catch (e) {
    try {
      rmSync(tmp, { force: true })
    } catch {
      // ignore
    }
    throw e
  }

  const now = Date.now()
  if (now - lastSweepAt > 10 * 60 * 1000) {
    lastSweepAt = now
    try {
      sweepSpillFiles(join(workspacePath, '.ihui-agent', 'tool-spill'), now)
    } catch {
      // 清理失败不影响保存
    }
  }

  const locator = relative(workspacePath, target).split(sep).join('/')
  const bytes = Buffer.byteLength(options.content, 'utf8')
  return {
    locator,
    bytes,
    retrievalHint: `完整输出已落盘 ${bytes} 字节，用 fs/read 读取 ${locator}（可再 grep 该文件）`,
  }
}

/** 头尾预算 + 超限时落全文；保存失败只回 `spillError`，不抛给命令调用方。 */
export function budgetWithSpill(
  raw: string,
  maxChars: number,
  options: Omit<SpillSaveOptions, 'content'>,
): BudgetedWithSpill {
  const budgeted = truncateBothEnds(raw, maxChars)
  if (!budgeted.truncated) return budgeted
  try {
    return { ...budgeted, spill: saveToolOutputSpill({ ...options, content: raw }) }
  } catch (e) {
    return { ...budgeted, spillError: (e as Error).message }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
