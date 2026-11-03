// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A13「等价性证明」的唯一入库载体。
 *
 * AGENTS.md 第 235 行写着:「等价性由 158/158 个真工具对象的同瞬间 A/B 证明(线字节 + 属性名集合 +
 * required 集合三项全等)」。那句话出自提交 `dd5142f2255` 的提交信息,而产出它的一次性脚本
 * (`.ihui-agent/tmp/a13-baseline/ab-equality.mts`)从未入库 ⇒ 仓里没有任何可重跑的等价性判据,
 * 那句"已证明"当时不可复现,今天更不可复现 —— 而且它已经**结构上不可复现**了:那份脚本比的"旧侧"
 * 是当时生产代码里的 `toolsToProviderSchema`,而 A13 已把它改成直接调投影器,照它再跑一遍就是
 * 「投影器 vs 投影器」的恒真式(2026-09-25 实测仍报 158/158,正是这个原因)。
 *
 * 本测试钉两件事,缺一不可:
 *  ① **两边数到同一批** —— 守门 111(`scripts/check-tool-contract-declared.mjs`)按 HEAD 源码字面量
 *     数到的工具名集合,必须与运行时真能枚举到的 Tool 对象集合**逐名相等**。这条才是"158 vs 104"
 *     那种分叉的尺子:数字对不上不再靠人想起来去核,而是测试红点并点名差在哪个名字。
 *  ② **旧侧来自 git 历史的逐字快照**(`tests/fixtures/toJsonProperty.legacy.ts`),不是重写。
 *     逐工具比三项:JSON.stringify 线字节 / properties 键集合 / required 集合;失配必须点名工具与键。
 *
 * 另有一条变异对照(第 ④ 个用例):注入"少投一个字段"的投影变体,判据**必须**变红 ——
 * 没有它,这个测试分不清"两边真等价"与"尺子根本没比"。
 */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { projectToolInputSchema } from '@ihui/types'
import { SKILL_INVOCATION_TOOL_NAME } from '../src/skills/index.js'
import { createFileEditTools } from '../src/tools/file-edit.js'
import { createSpawnParallelTool, createSubagentTool } from '../src/tools/subagent.js'
import { legacyBuildParameters, type LegacyProjectableTool } from './fixtures/toJsonProperty.legacy.js'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(TEST_DIR, '../../..')
const GATE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-tool-contract-declared.mjs')

/** 守门 111 的判据出口(§22c:该模块导出 __test__,且有 isDirectRun 守卫,可安全 import) */
interface GateModule {
  extractToolLiterals(text: string): Array<{ toolName: string; line: number }>
  __test__: {
    extractToolLiterals: (text: string) => Array<{ toolName: string; line: number }>
    SCAN_DIRS: string[]
  }
}

/** 一个 Tool 对象参与 A/B 所需的最小形状(与投影器/旧实现的两处入参一一对应) */
type ProjectableTool = LegacyProjectableTool

/** 门按"名字取自字符串字面量"抽工具;`name:` 接变量时它记为 (non-literal),运行时枚举天然没有这个名字 */
const NON_LITERAL_NAME = '(non-literal)'

/**
 * 变量名站点的显式配对登记 —— 与 materializeFactoryTools 里的工厂清单同型:名字来自变量/工厂的站点,
 * 门在 HEAD 面上抽不到真名,而运行时枚举天然抽得到,不配对就是「两侧数到不同批」的假分叉。
 * 这里登记的**不是豁免**:配对后仍由 `runtimeNames == gateNames` 反向验真(那枚名字哪天不再被
 * 运行时枚举 ⇒ onlyInGate 当场红),并由 `pairedCount == 清单长度` 验登记表是否还描述现状
 * (登记了却不再命中 ⇒ 红)。
 * 一枚登记位要求该文件在 HEAD 面恰好只有 1 处 (non-literal);同文件多处会配出 paired ≠ 清单长度,不静默取第一枚。
 * 真名一律 import 常量本身,不在本文件内联字面量(§0.6:名字只在声明它的那个模块里有一份)。
 */
const VARIABLE_NAME_TOOLS = [{ file: 'apps/cli/src/tools/skill-tool.ts', toolName: SKILL_INVOCATION_TOOL_NAME }]

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listTsFiles(abs))
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(abs)
  }
  return out
}

/** Tool 的形状判据:直接成员含字符串 name + 函数 execute(与守门 111 的静态判据同语义) */
function isProjectableTool(value: unknown): value is ProjectableTool {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.name === 'string' &&
    typeof v.execute === 'function' &&
    typeof v.parameters === 'object' &&
    v.parameters !== null &&
    Array.isArray(v.required)
  )
}

/** 工厂产出的工具只有被调用才存在(生产路径 = commands/agent.ts 的 registerTools(createXxxTools(ctx))) */
function materializeFactoryTools(into: Map<string, ProjectableTool>): string[] {
  const editCtx = { workspacePath: REPO_ROOT } as unknown as Parameters<typeof createFileEditTools>[0]
  const subagentOpts = {
    modelId: 'a13-eq-probe-model',
    apiUrl: 'http://127.0.0.1:0/a13-eq-probe',
    workspacePath: REPO_ROOT,
  } as unknown as Parameters<typeof createSubagentTool>[0]
  const produced = [...createFileEditTools(editCtx), createSubagentTool(subagentOpts), createSpawnParallelTool(subagentOpts)]
  const added: string[] = []
  for (const tool of produced) {
    if (!isProjectableTool(tool)) continue
    if (!into.has(tool.name)) added.push(tool.name)
    into.set(tool.name, tool)
  }
  return added
}

interface RuntimeEnumeration {
  tools: Map<string, ProjectableTool>
  failedImports: string[]
  factoryAdded: string[]
}

async function enumerateRealTools(scanDirs: string[]): Promise<RuntimeEnumeration> {
  const tools = new Map<string, ProjectableTool>()
  const failedImports: string[] = []
  for (const relDir of scanDirs) {
    const absDir = path.join(REPO_ROOT, relDir)
    for (const file of listTsFiles(absDir)) {
      let mod: Record<string, unknown>
      try {
        mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>
      } catch (e) {
        failedImports.push(`${path.relative(REPO_ROOT, file)}: ${(e as Error).message.split('\n')[0]}`)
        continue
      }
      for (const value of Object.values(mod)) {
        for (const candidate of Array.isArray(value) ? value : [value]) {
          if (!isProjectableTool(candidate)) continue
          // 按 name 去重:同名 Tool 在 provider 侧本来就只有一个(注册表是 Map<name, Tool>)
          if (!tools.has(candidate.name)) tools.set(candidate.name, candidate)
        }
      }
    }
  }
  const factoryAdded = materializeFactoryTools(tools)
  return { tools, failedImports, factoryAdded }
}

interface GateEnumeration {
  /** 末行「注册工具数 N」—— 门的权威读数 */
  reportedCount: number
  /** 测试侧按同一 SCAN_DIRS + 同一 HEAD 面重导出的字面量出现次数 */
  derivedOccurrences: number
  /** 门点到的具名工具(去掉仍配不上的 (non-literal);变量名站点按 VARIABLE_NAME_TOOLS 配成真名) */
  named: string[]
  /** 门点到但 name 取自变量的字面量条数(运行时枚举按定义拿不到名字) */
  anonymousOccurrences: number
  /** 上面这些站点里,已在 VARIABLE_NAME_TOOLS 配对成运行时真名的条数 */
  pairedCount: number
}

function readHeadBlob(gitPath: string): string {
  return execFileSync('git', ['-C', REPO_ROOT, 'show', `HEAD:${gitPath}`], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function enumerateGateSide(gate: GateModule, scanDirs: string[]): Promise<GateEnumeration> {
  const names: string[] = []
  let paired = 0
  for (const relDir of scanDirs) {
    for (const abs of listTsFiles(path.join(REPO_ROOT, relDir))) {
      const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, '/')
      let text: string
      try {
        text = readHeadBlob(rel)
      } catch {
        // HEAD 里没有这个文件(别人未提交的在飞文件)⇒ 门同样不判它,跳过而非算失配
        continue
      }
      for (const literal of gate.__test__.extractToolLiterals(text)) {
        if (literal.toolName !== NON_LITERAL_NAME) {
          names.push(literal.toolName)
          continue
        }
        // name 取自变量的站点:按所在文件去登记表配对,配到就用运行时那枚真名(交给
        // runtimeNames == gateNames 反向验真);没登记就保持 (non-literal),不猜、不静默丢弃
        const registered = VARIABLE_NAME_TOOLS.find((t) => t.file === rel)
        if (!registered) {
          names.push(NON_LITERAL_NAME)
          continue
        }
        names.push(registered.toolName)
        paired += 1
      }
    }
  }
  const out = execFileSync(process.execPath, [GATE_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const matched = /注册工具数\s+(\d+)/.exec(out)
  if (!matched) throw new Error(`守门 111 输出里解析不到「注册工具数 N」(末行原文:${out.trim().split('\n').pop() ?? ''})`)
  const anonymousOccurrences = names.filter((n) => n === NON_LITERAL_NAME).length
  return {
    reportedCount: Number(matched[1]),
    derivedOccurrences: names.length,
    named: [...new Set(names.filter((n) => n !== NON_LITERAL_NAME))],
    anonymousOccurrences,
    pairedCount: paired,
  }
}

// ============================ 等价性尺子(真实 A/B 与变异对照共用同一把) ============================

interface AbMismatch {
  tool: string
  wireBytesEqual: boolean
  propertiesOnlyInLegacy: string[]
  propertiesOnlyInProjected: string[]
  requiredOnlyInLegacy: string[]
  requiredOnlyInProjected: string[]
  /** 递归键路径集合(含 items/properties 深层)的差异,用于点名"差在哪个键" */
  keyPathsOnlyInLegacy: string[]
  keyPathsOnlyInProjected: string[]
}

type SchemaNode = Record<string, unknown>

function collectKeyPaths(node: unknown, prefix = ''): string[] {
  if (!node || typeof node !== 'object') return []
  const out: string[] = []
  for (const [k, v] of Object.entries(node as SchemaNode)) {
    if (v === undefined) continue
    const label = prefix ? `${prefix}.${k}` : k
    if (k === 'properties' || k === 'items' || k === 'additionalProperties') out.push(...collectKeyPaths(v, label))
    else out.push(label)
  }
  return out
}

function topPropertyNames(parameters: SchemaNode): string[] {
  const props = parameters.properties
  if (!props || typeof props !== 'object') return []
  return Object.keys(props as SchemaNode).sort()
}

function requiredListOf(parameters: SchemaNode): string[] {
  const req = parameters.required
  return Array.isArray(req) ? [...req].sort() : []
}

function diffBySet(a: string[], b: string[]): string[] {
  const inB = new Set(b)
  return a.filter((x) => !inB.has(x))
}

/** 用同一把尺子比较「旧侧产出的 parameters」与「给定的新侧 parameters」 */
function compareParameters(toolName: string, legacy: SchemaNode, projected: SchemaNode): AbMismatch | null {
  const legacyProps = topPropertyNames(legacy)
  const projectedProps = topPropertyNames(projected)
  const legacyRequired = requiredListOf(legacy)
  const projectedRequired = requiredListOf(projected)
  const legacyPaths = collectKeyPaths(legacy)
  const projectedPaths = collectKeyPaths(projected)
  const mismatch: AbMismatch = {
    tool: toolName,
    wireBytesEqual: JSON.stringify(legacy) === JSON.stringify(projected),
    propertiesOnlyInLegacy: diffBySet(legacyProps, projectedProps),
    propertiesOnlyInProjected: diffBySet(projectedProps, legacyProps),
    requiredOnlyInLegacy: diffBySet(legacyRequired, projectedRequired),
    requiredOnlyInProjected: diffBySet(projectedRequired, legacyRequired),
    keyPathsOnlyInLegacy: diffBySet(legacyPaths, projectedPaths),
    keyPathsOnlyInProjected: diffBySet(projectedPaths, legacyPaths),
  }
  const equal =
    mismatch.wireBytesEqual &&
    mismatch.propertiesOnlyInLegacy.length === 0 &&
    mismatch.propertiesOnlyInProjected.length === 0 &&
    mismatch.requiredOnlyInLegacy.length === 0 &&
    mismatch.requiredOnlyInProjected.length === 0
  return equal ? null : mismatch
}

function projectSide(tool: ProjectableTool): SchemaNode {
  return projectToolInputSchema(
    tool.parameters as unknown as Parameters<typeof projectToolInputSchema>[0],
    tool.required as unknown as Parameters<typeof projectToolInputSchema>[1],
  ) as unknown as SchemaNode
}

function describeMismatch(m: AbMismatch): string {
  const bits: string[] = [`工具 ${m.tool}:`]
  if (!m.wireBytesEqual) bits.push('线字节不同')
  if (m.propertiesOnlyInLegacy.length) bits.push(`顶层属性仅旧侧有 ${JSON.stringify(m.propertiesOnlyInLegacy)}`)
  if (m.propertiesOnlyInProjected.length) bits.push(`顶层属性仅新侧有 ${JSON.stringify(m.propertiesOnlyInProjected)}`)
  if (m.requiredOnlyInLegacy.length) bits.push(`required 仅旧侧有 ${JSON.stringify(m.requiredOnlyInLegacy)}`)
  if (m.requiredOnlyInProjected.length) bits.push(`required 仅新侧有 ${JSON.stringify(m.requiredOnlyInProjected)}`)
  if (m.keyPathsOnlyInLegacy.length) bits.push(`键路径仅旧侧有 ${JSON.stringify(m.keyPathsOnlyInLegacy.slice(0, 12))}`)
  if (m.keyPathsOnlyInProjected.length) bits.push(`键路径仅新侧有 ${JSON.stringify(m.keyPathsOnlyInProjected.slice(0, 12))}`)
  return bits.join(' ')
}

/** 旧侧:逐字取自 git dd5142f2255^ 的那份手搓实现(见 tests/fixtures/toJsonProperty.legacy.ts) */
function legacySide(tool: ProjectableTool): SchemaNode {
  return legacyBuildParameters(tool) as unknown as SchemaNode
}

// ============================ 用例 ============================

interface EnumerationOnce {
  runtime: RuntimeEnumeration
  gateSide: GateEnumeration
}
/** 枚举一次、四个用例共用(避免重复 import 50+ 模块,也避免各用例看着不同的瞬间) */
let enumerationOnce: Promise<EnumerationOnce> | undefined
function loadOnce(): Promise<EnumerationOnce> {
  if (!enumerationOnce) {
    enumerationOnce = (async () => {
      const gate = (await import(pathToFileURL(GATE_SCRIPT).href)) as GateModule
      const scanDirs = gate.__test__.SCAN_DIRS
      const runtime = await enumerateRealTools(scanDirs)
      const gateSide = await enumerateGateSide(gate, scanDirs)
      return { runtime, gateSide }
    })()
  }
  return enumerationOnce
}

describe('A13 投影等价性(AGENTS.md:235 的可重跑载体)', () => {
  it(
    '门 111 末行注册数 == 测试侧按同一 SCAN_DIRS / 同一 HEAD 面重导的字面量出现次数',
    async () => {
      const { gateSide } = await loadOnce()
      expect(
        gateSide.derivedOccurrences,
        `测试侧重导 ${gateSide.derivedOccurrences} 条,门末行报 ${gateSide.reportedCount} 条 —— 两侧连"数到多少"都对不上,说明扫描面或取材面漂了`,
      ).toBe(gateSide.reportedCount)
      expect(gateSide.reportedCount).toBeGreaterThan(0)
    },
    180_000,
  )

  it(
    '两侧数到同一批工具(门点名的具名工具集 == 运行时真能枚举到的 Tool 集)',
    async () => {
      const { runtime, gateSide } = await loadOnce()
      expect(runtime.failedImports, `有工具模块 import 失败,枚举面不完整:${JSON.stringify(runtime.failedImports)}`).toHaveLength(0)

      const runtimeNames = [...runtime.tools.keys()].sort()
      const gateNames = [...gateSide.named].sort()
      const onlyInGate = diffBySet(gateNames, runtimeNames)
      const onlyInRuntime = diffBySet(runtimeNames, gateNames)
      expect(
        onlyInGate,
        `门数到而测试枚举不到的工具(${onlyInGate.length}):${JSON.stringify(onlyInGate)} —— 多为工厂产出且未在本测试登记的工厂清单里`,
      ).toEqual([])
      expect(
        onlyInRuntime,
        `测试枚举到而门数不到的工具(${onlyInRuntime.length}):${JSON.stringify(onlyInRuntime)} —— 多为 name 取自变量(门记 (non-literal))`,
      ).toEqual([])
      expect(runtimeNames).toEqual(gateNames)

      // 门的原始计数必须能被完整解释:具名工具 + 匿名 name 字面量,一条不多一条不少
      expect(
        gateSide.reportedCount,
        `末行 ${gateSide.reportedCount} 应等于 具名 ${gateNames.length} + 匿名 (non-literal) ${gateSide.anonymousOccurrences}`,
      ).toBe(gateNames.length + gateSide.anonymousOccurrences)

      // 登记表本身也要被验:登记了却在 HEAD 面配不上(站点改成字面量 / 文件挪走 / 同文件有多处站点),
      // 说明这张清单已经不再描述现状 ⇒ 当场红,不留下没人再核对的登记
      expect(
        gateSide.pairedCount,
        `VARIABLE_NAME_TOOLS 登记 ${VARIABLE_NAME_TOOLS.length} 枚,实际配到 ${gateSide.pairedCount} 枚 —— ` +
          '登记的变量名站点在 HEAD 面不再逐枚命中,清单必须随之更新',
      ).toBe(VARIABLE_NAME_TOOLS.length)
    },
    180_000,
  )

  it(
    '每个真工具对象:历史 toJsonProperty 与投影器 三项全等(线字节 / properties 键集 / required 集)',
    async () => {
      const { runtime } = await loadOnce()
      const tools = [...runtime.tools.values()]
      expect(tools.length, '枚举到 0 个工具 ⇒ 判据失明,不得当作通过').toBeGreaterThan(0)
      const mismatches = tools
        .map((tool) => compareParameters(tool.name, legacySide(tool), projectSide(tool)))
        .filter((m): m is AbMismatch => m !== null)
      expect(
        mismatches,
        `${tools.length - mismatches.length}/${tools.length} 等价;不等价清单:\n${mismatches.map(describeMismatch).join('\n')}`,
      ).toEqual([])
    },
    180_000,
  )

  it(
    '变异对照:少投一个顶层字段的投影变体必须被判不等价,并点名是哪个工具差在哪个键',
    async () => {
      const { runtime } = await loadOnce()
      // 取一个确定有多参数的工具做靶子,按名排序保证可复现
      const victim = [...runtime.tools.values()]
        .filter((t) => Object.keys(t.parameters).length >= 2)
        .sort((a, b) => a.name.localeCompare(b.name))[0]
      expect(victim, '没有任何 ≥2 参数的工具 ⇒ 变异对照无法进行,判据失效').toBeDefined()

      const droppedKey = Object.keys(victim.parameters).sort()[0] as string
      const mutated = { ...projectSide(victim) } as SchemaNode
      mutated.properties = { ...(mutated.properties as SchemaNode) }
      delete (mutated.properties as SchemaNode)[droppedKey]

      const m = compareParameters(victim.name, legacySide(victim), mutated)
      expect(m, `变异(丢掉 ${victim.name}.${droppedKey})未被判出 ⇒ 这把尺子根本没比`).not.toBeNull()
      expect(m?.wireBytesEqual, '变异后线字节仍相等 ⇒ 线字节判据无牙').toBe(false)
      expect(m?.propertiesOnlyInLegacy, `变异应被点名"顶层属性仅旧侧有 ${droppedKey}"`).toEqual([droppedKey])
      expect(describeMismatch(m as AbMismatch)).toContain(droppedKey)

      // 反向对照:同一工具用未变异的投影结果必须判为等价(否则上面那条红毫无意义)
      expect(compareParameters(victim.name, legacySide(victim), projectSide(victim))).toBeNull()
    },
    60_000,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
