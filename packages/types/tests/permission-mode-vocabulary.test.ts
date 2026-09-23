// 权限档词汇表单一真相源防漂移闸(G-161 / G-164 收口)。
//
// 与守门第 68 项(scripts/check-permission-mode-vocabulary.mjs)的分工:
//   - 68 号做**跨语言**对账(TS 注册表 ↔ apps/ai-service Python 注册表),这是 TS 测试
//     无法覆盖的;但它的 R4"禁抄第二份清单"只扫 `KNOWN_CONSUMERS` **硬编码清单**。
//   - 本文件把同一形状的检测换成**发现式文件集**(遍历 apps/*/src + packages/*/src),
//     堵住那个洞。实证:残留的第 8 套副本正好长在 68 号的盲区里
//     (apps/api/src/services/clawdbot/permission-guard.ts 第 133/139 行,5 值规范档手抄,
//      从未被咬到),这是本文件存在的全部理由。
//   - 判据有效性用注入自证:见下方 "注入自证" 两个用例 —— 构造一份字面量副本、
//     删掉一条 wire 映射,断言必须红。

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  PERMISSION_MODES,
  PERMISSION_MODE_ALIASES,
  PERMISSION_MODE_WIRE,
  PERMISSION_MODE_WIRE_VALUES,
  normalizePermissionMode,
  permissionModeWire,
} from '../src/permission-mode'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')

/** 唯一允许"自己声明档位清单"的文件(注册表本身)。 */
const REGISTRY_FILE = 'packages/types/src/permission-mode.ts'

/** 刻意放过:跨语言镜像(Python 侧不可能 import TS)+ 各端展示档 i18n 取词表。 */
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '__tests__',
  'tests',
  'e2e',
])

/**
 * 存量基线(棘轮):已知、但**本任务写域之外**的残留副本,逐条点名。
 *
 * 列在这里不是"判据认输",而是把敞口登记在案:该文件**新增**第二份清单不会被放过,
 * 而其他任何文件新增一份都会立刻红。收敛动作需要各端 owner 定档(见交付报告)。
 *
 * - apps/web/src/hooks/use-permission-mode-cycle.ts:27
 *   纯 4 值 wire 数组,但用途是"循环顺序"(Shift+Tab 轮转档位),**顺序是它的语义**,
 *   注册表是无序集合。改 import 需要 owner 决定"顺序归谁定",不属纯代码归一。
 */
const BASELINE_RESIDUAL_COPIES = new Set(['apps/web/src/hooks/use-permission-mode-cycle.ts'])

function listTsSources(dir: string, out: string[]): void {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) listTsSources(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(d|gen|test|spec)\.tsx?$/.test(name)) out.push(full)
  }
}

/** 发现式扫描面:两端源码,不写死文件名清单(写死就是 68 号那个洞)。 */
function collectScanTargets(): { relPath: string; src: string }[] {
  const roots = [join(REPO_ROOT, 'apps'), join(REPO_ROOT, 'packages')]
  const files: string[] = []
  for (const root of roots) {
    for (const entry of readdirSync(root)) {
      const srcDir = join(root, entry, 'src')
      try {
        if (statSync(srcDir).isDirectory()) listTsSources(srcDir, files)
      } catch {
        /* 该包没有 src 目录 */
      }
    }
  }
  return files
    .map((f) => ({
      relPath: relative(REPO_ROOT, f).replace(/\\/g, '/'),
      src: readFileSync(f, 'utf8'),
    }))
    .filter((f) => f.relPath !== REGISTRY_FILE)
}

/** 从一段字面量文本里抽出字符串字面量取值。 */
function literalsOf(chunk: string): string[] {
  return [...chunk.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

/**
 * 检测"第二份完整清单"。
 *
 * 形状一:类型别名 `type *PermissionMode* = 'a' | 'b' | ...` **覆盖**整套规范档或整套 wire 档。
 *   命名刻意限定 PermissionMode —— `PromptMode`(提示模式)是另一个概念,恰好共用同一组
 *   kebab 拼写,计划里明确**不合并**(合并会把两个语义绑死),故不参与本判据。
 * 形状二:`z.enum([...])` / `new Set([...])` / `X = [...]`,**不看变量名**(68 号正是
 *   因为只认 `VALID_MODES|PERMISSION_MODE_VALUES|...` 这几个名字,才漏掉了
 *   `VALID_PERMISSION_MODES` 这类命名)。
 *   判据是"整套覆盖 **且** 数组内不含外词汇":一张同时写着 `mode.plan`(i18n 取词键)、
 *   `low/medium/high`(风险级)的表是**展示档**,与 wire 档是不同角色,按本任务口径
 *   "三种角色不得合并",不得当副本咬 —— 咬了就是把判据做成假红。
 *   子集声明(各端只暴露部分档位)同样放过。
 */
export function findSecondListCopies(
  files: { relPath: string; src: string }[],
  canonical: readonly string[],
  wire: readonly string[],
): string[] {
  const problems: string[] = []
  const vocab = new Set<string>([...canonical, ...wire, ...Object.keys(PERMISSION_MODE_ALIASES)])
  const sets = [
    { name: '规范档', members: canonical, pureListOnly: false },
    { name: 'wire 档', members: wire, pureListOnly: true },
  ]
  const typeUnionRe = /\btype\s+\w*PermissionMode\w*\s*=\s*([^;\n]*\|[^;\n]*)/g
  const arrayRe = /(?:\bnew\s+Set\s*\(|\bz\.enum\(|[=(]\s*)(\[[^\]]*\])/g
  for (const { relPath, src } of files) {
    if (BASELINE_RESIDUAL_COPIES.has(relPath)) continue
    const lineOf = (idx: number) => src.slice(0, idx).split('\n').length
    const hits: { idx: number; lits: string[]; pure: boolean }[] = []
    for (const m of src.matchAll(typeUnionRe))
      hits.push({ idx: m.index ?? 0, lits: literalsOf(m[1] ?? ''), pure: false })
    for (const m of src.matchAll(arrayRe))
      hits.push({ idx: m.index ?? 0, lits: literalsOf(m[1] ?? ''), pure: true })
    for (const { idx, lits, pure } of hits) {
      if (lits.length === 0) continue
      for (const set of sets) {
        if (!set.members.every((v) => lits.includes(v))) continue
        // wire 档只有 4 个值,极易与展示档表混形,故额外要求"纯词汇表"
        if ((pure || set.pureListOnly) && !lits.every((v) => vocab.has(v))) continue
        problems.push(
          `${relPath}:${lineOf(idx)} 抄了第二份完整${set.name}清单 [${lits.join(', ')}]`,
        )
      }
    }
  }
  return problems
}

/**
 * wire ↔ 规范档映射完整性:双射 + 无遗漏 + 无多余 + 差异显式声明。
 * 返回问题列表(空 = 通过)。
 */
export function findMappingDefects(
  canonical: readonly string[],
  wireValues: readonly string[],
  wireMap: Readonly<Partial<Record<string, string>>>,
): string[] {
  const problems: string[] = []
  const mappedIds = Object.keys(wireMap)
  const mapEntries = Object.entries(wireMap).filter(
    (e): e is [string, string] => typeof e[1] === 'string',
  )

  // 1. 每个 wire 值必须是某个规范档映射来的值(无多余)
  for (const w of wireValues) {
    if (!mappedIds.some((id) => wireMap[id] === w)) {
      problems.push(`wire 值 "${w}" 没有任何规范档映射到它 —— 清单与映射脱钩`)
    }
  }
  // 2. 每条映射的目标值必须在 wire 清单里(无遗漏)
  for (const [id, w] of Object.entries(wireMap)) {
    if (!wireValues.includes(w)) {
      problems.push(`规范档 "${id}" 映射到 wire "${w}",但它不在 PERMISSION_MODE_WIRE_VALUES 里`)
    }
  }
  // 3. 双射:两个不同规范档不得落到同一 wire 值(否则读回来分不出是哪档)
  const seen = new Map<string, string>()
  for (const [id, w] of Object.entries(wireMap)) {
    const prev = seen.get(w)
    if (prev) problems.push(`wire "${w}" 同时被 "${prev}" 与 "${id}" 使用 —— 映射不是单射`)
    seen.set(w, id)
  }
  // 4. 差异必须显式声明:无落库语义的档位只能是 manual;
  //    新增第 6 档时必须在这里显式表态(给它 wire 或登记进例外),不得静默漂移。
  const withoutWire = canonical.filter((id) => !(id in wireMap))
  const DECLARED_NO_WIRE_SEMANTICS = ['manual']
  for (const id of withoutWire) {
    if (!DECLARED_NO_WIRE_SEMANTICS.includes(id)) {
      problems.push(`规范档 "${id}" 既无 wire 映射也未登记在"无落库语义"例外表 —— 必须显式声明`)
    }
  }
  for (const id of DECLARED_NO_WIRE_SEMANTICS) {
    if (id in wireMap) {
      problems.push(`规范档 "${id}" 被登记为"无落库语义"却又有 wire 映射 —— 例外表已过期`)
    }
  }
  // 5. 归一化往返:wire 拼写必须能解回它自己的规范档
  for (const [id, w] of Object.entries(wireMap)) {
    if (normalizePermissionMode(w) !== id) {
      problems.push(`wire "${w}" 归一化后得到 "${normalizePermissionMode(w)}",不等于 "${id}"`)
    }
    if (permissionModeWire(id) !== w) {
      problems.push(`规范档 "${id}" 转 wire 得到 "${permissionModeWire(id)}",不等于 "${w}"`)
    }
  }
  return problems
}

describe('权限档 wire 词汇:单一真相源防漂移(G-161/G-164)', () => {
  it('全仓 TS 源码不存在第二份完整档位清单(发现式扫描,非硬编码清单)', () => {
    const targets = collectScanTargets()
    // 扫描面本身要有量,否则"空集恒绿"会让这条断言形同虚设
    expect(targets.length).toBeGreaterThan(200)
    const problems = findSecondListCopies(targets, PERMISSION_MODES, PERMISSION_MODE_WIRE_VALUES)
    expect(problems).toEqual([])
  })

  it('wire ↔ 规范档映射是双射,无遗漏无多余,差异已显式声明', () => {
    const problems = findMappingDefects(
      PERMISSION_MODES,
      PERMISSION_MODE_WIRE_VALUES,
      PERMISSION_MODE_WIRE,
    )
    expect(problems).toEqual([])
  })

  it('wire 清单与映射值集合逐字相等(顺序无关)', () => {
    expect([...PERMISSION_MODE_WIRE_VALUES].sort()).toEqual(
      [...new Set(Object.values(PERMISSION_MODE_WIRE))].sort(),
    )
  })

  // --- 注入自证:判据必须能咬住它声称要咬的东西 -----------------------------
  it('注入自证 A:凭空造一份第二套字面量清单 → 检测必须红', () => {
    const fake = [
      {
        relPath: 'apps/api/src/some-new-place/fake-modes.ts',
        src: `const VALID_ANY_NAME = new Set(['default','acceptEdits','bypassPermissions','plan','manual'])\n`,
      },
      {
        relPath: 'apps/api/src/routes/fake-wire.ts',
        src: `const parsed = z.enum(['default','plan','accept-edits','bypass-permissions'])\n`,
      },
      {
        relPath: 'packages/types/src/fake-union.ts',
        src: `export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'manual'\n`,
      },
    ]
    const problems = findSecondListCopies(fake, PERMISSION_MODES, PERMISSION_MODE_WIRE_VALUES)
    expect(problems.length).toBe(3)
    expect(problems.join('\n')).toContain('fake-modes.ts')
    expect(problems.join('\n')).toContain('fake-wire.ts')
  })

  it('注入自证 B:子集声明不是副本(不得假红,否则各端真实契约会误伤)', () => {
    const subset = [
      {
        relPath: 'apps/web/src/components/permission-picker.ts',
        src: `export const modeOptions = ['default','plan','accept-edits'] as const\n`,
      },
      {
        // PromptMode 是"提示模式",与权限档是两个概念,刻意不合并
        relPath: 'packages/types/src/workspace.ts',
        src: `export type PromptMode = 'default' | 'plan' | 'accept-edits' | 'bypass-permissions'\n`,
      },
    ]
    expect(findSecondListCopies(subset, PERMISSION_MODES, PERMISSION_MODE_WIRE_VALUES)).toEqual([])
  })

  it('注入自证 C:删掉一条 wire 映射 / 塞进重复映射 → 映射完整性必须红', () => {
    const broken = {
      default: 'default',
      acceptEdits: 'accept-edits',
      bypassPermissions: 'bypass-permissions',
    } as const
    const missing = findMappingDefects(PERMISSION_MODES, PERMISSION_MODE_WIRE_VALUES, broken)
    expect(missing.some((p) => p.includes('plan'))).toBe(true)

    const duplicated = {
      default: 'default',
      acceptEdits: 'accept-edits',
      bypassPermissions: 'bypass-permissions',
      plan: 'accept-edits',
    } as const
    const collide = findMappingDefects(PERMISSION_MODES, PERMISSION_MODE_WIRE_VALUES, duplicated)
    expect(collide.some((p) => p.includes('不是单射'))).toBe(true)
  })
})
