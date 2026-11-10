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
 *     线字节一项在"剥掉历史 `ToolParameter` 类型表达不了的键"之后比,且那些键由 `POST_LEGACY_KEYS`
 *     **闭集**把守(新侧多出来的键路径必须恰好落在这个闭集里,多一条即判红)—— 理由见该常量注释:
 *     旧快照取自 `dd5142f2255^`,要求它丢出当时类型里不存在的字段,是把愿望当判据。
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

/**
 * 工厂规格站点的显式登记 —— `createRouteTools(SPECS)` 产出的工具族(hr / relay)。
 *
 * 与 `VARIABLE_NAME_TOOLS` 的差别值得写清:那一条是"名字取自变量",门认得出对象但读不到名字;
 * 这一条是"门**整个看不到**对象" —— `HR_SPECS` 里每条只有 `name` + `description` + `method` + `path`
 * (+ `params`),**没有 `execute` 成员**,而门的 `extractToolLiterals` 要求对象同时具备 `name` 与
 * `execute`。于是在门看来 `hr.ts` 里一枚工具都没有,而运行时 `export const HR_TOOLS =
 * createRouteTools(HR_SPECS)` 天然枚举出 14 枚 ⇒ 不登记就是「两侧数到不同批」的假分叉。
 *
 * 这里登记的**不是豁免**:本清单给出的名字仍要过两重反向验——
 *   ① `runtimeNames == gateNames`(那枚名字哪天不再被运行时枚举 ⇒ 当场红);
 *   ② `factorySpecCount == 登记列表长度`(登记了却在该文件的 SPECS 里抽不到 ⇒ 红)。
 * 抽取面**只**认该文件顶层 `const <X>_SPECS: RouteToolSpec[] = [ … ]` 数组里逐条的 `"name": "…"` 字面量,
 * 不做"猜一个代表全体":条数与运行时枚出的名字逐名相等才放行。
 */
const FACTORY_SPEC_FILES: readonly { file: string; specArray: string }[] = [
  { file: 'apps/cli/src/tools/hr.ts', specArray: 'HR_SPECS' },
  { file: 'apps/cli/src/tools/relay.ts', specArray: 'RELAY_SPECS' },
]

/** 从 `<specArray>: RouteToolSpec[] = [ … ]` 里抽**逐条规格对象顶层**的 `"name": "…"` 字面量。
 *
 * 必须只取顶层:`params` 数组里的参数条目**也**带 `"name"` 键(如 `hr_department_create` 的参数
 * 就叫 `name`),把它们一并抽进来会得到一堆参数名冒充工具名。所以这里按花括号深度筛:只在
 * "数组元素对象的第一层"里认 `"name"`。 */
function extractSpecNames(text: string, specArray: string): string[] {
  const start = text.indexOf(`const ${specArray}`)
  if (start < 0) return []
  // 注意:`RouteToolSpec[]` 的类型注解里已有一对空 `[]`,直接找第一个 `[` 会落在它上面、当场配对闭合。
  // 所以先定位赋值号 `=`,再从它之后找数组开括号。
  const assign = text.indexOf('=', start)
  if (assign < 0) return []
  const open = text.indexOf('[', assign)
  if (open < 0) return []
  // 括号配对扫出数组闭界
  let depth = 0
  let end = -1
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return []
  const body = text.slice(open + 1, end)
  // 逐字符扫,维护花括号深度;只在深度恰为 1(数组元素对象自身那一层)时认 `"name"`
  const names: string[] = []
  let brace = 0
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '{') {
      brace += 1
      continue
    }
    if (ch === '}') {
      brace -= 1
      continue
    }
    if (brace !== 1) continue
    if (body.startsWith('"name"', i)) {
      const m = /^"name"\s*:\s*"([^"]+)"/.exec(body.slice(i))
      const name = m?.[1]
      if (name !== undefined && !names.includes(name)) names.push(name)
    }
  }
  return names
}

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
  /**
   * 门静态扫描面的具名工具(**不含** FACTORY_SPEC_FILES 补面)——
   * 用于对齐门末行的「注册工具数」读数:那批工厂产出的对象门整个看不到,不在末行里。
   */
  gateVisibleNamed: string[]
  /** 门点到但 name 取自变量的字面量条数(运行时枚举按定义拿不到名字) */
  anonymousOccurrences: number
  /** 上面这些站点里,已在 VARIABLE_NAME_TOOLS 配对成运行时真名的条数 */
  pairedCount: number
  /** 上面这些站点里,已按 FACTORY_SPEC_FILES 从工厂 SPECS 抽出的真名条数(门整个看不到的对象) */
  factorySpecCount: number
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
  let factorySpec = 0
  const seenFactoryFiles = new Set<string>()
  // 门等价面(names,供用例①与门的末行读数逐条对齐)与工厂补面(factoryNames,门整个看不到的对象)
  // 刻意分开:两者混进同一个数组,用例①就会变成"拿门数不到的名字去比门的读数",那是自己把尺子弄歪。
  const factoryNames: string[] = []
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
      // 门整个看不到的对象:`createRouteTools(SPECS)` 的工具族(SPECS 条目没有 execute)。
      // 按登记表从该文件 HEAD 面重导出 SPECS 里的字面量名字,进**工厂补面**(不进 names):
      // 门自己的末行读数里没有这批名字,混进 names 会让用例①的"两侧数到多少"对不上。
      const specReg = FACTORY_SPEC_FILES.filter((f) => f.file === rel)
      if (specReg.length > 0) {
        seenFactoryFiles.add(rel)
        for (const reg of specReg) {
          const specNames = extractSpecNames(text, reg.specArray)
          factoryNames.push(...specNames)
          factorySpec += specNames.length
        }
      }
    }
  }
  // 登记表本身要被验:登记了却在 HEAD 面一条 SPECS 名字都抽不到 ⇒ 清单已不再描述现状,当场红
  expect(
    seenFactoryFiles.size,
    `FACTORY_SPEC_FILES 登记 ${FACTORY_SPEC_FILES.length} 个文件,HEAD 面只扫到 ${seenFactoryFiles.size} 个 —— 文件挪走/改名后清单必须更新`,
  ).toBe(FACTORY_SPEC_FILES.length)
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
    named: [...new Set([...names.filter((n) => n !== NON_LITERAL_NAME), ...factoryNames])],
    gateVisibleNamed: [...new Set(names.filter((n) => n !== NON_LITERAL_NAME))],
    anonymousOccurrences,
    pairedCount: paired,
    factorySpecCount: factorySpec,
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
  /**
   * 新侧比旧侧多出的**历史类型表达不了**的键路径(见 `POST_LEGACY_KEYS`)。
   * 它们不是失配:旧侧快照取自 `dd5142f2255^`,那份 `ToolParameter` 里根本没有这些字段,
   * 旧实现照定义就丢不出它们。单列一栏是为了让"允许的差额"是个**闭集**而不是一张空头豁免:
   * 任何落不进本栏的多余键仍会走 `keyPathsOnlyInProjected` 判红。
   */
  keyPathsOnlyInProjectedBeyondLegacyType: string[]
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

/**
 * 旧侧快照**表达不了**的键 —— 闭集,不得随手加一条。
 *
 * 旧侧是 `dd5142f2255^` 的逐字实现,那份 `ToolParameter` 只有
 * `type / description / enum / items / properties / required` 六个字段
 * (`git show dd5142f2255^:apps/cli/src/tools/index.ts` 第 35-42 行)。
 * 之后生产面新收编的字段,旧实现照定义就丢不出来 —— 把这种"新侧多出来的键"
 * 判成失配,等于要求历史代码预知未来,那不是等价性判据,是一道永不满足的愿望。
 *
 * 判据的牙齿因此改从两处下嘴,而不是靠这条豁免放水:
 *   ① 旧侧**认得的**那些键,值必须逐字节相同(线字节在"剥掉本栏之后的投影"上比);
 *   ② 本栏是**闭集** —— 新侧多出来的键路径必须恰好落在这里面,多一条即 `keyPathsOnlyInProjected` 判红。
 *
 * 现有条目只有 `additionalProperties`:2026-11-09 `7cc2a3c29a` 起 api-bridge 的
 * api_read/api_write/api_delete 首发使用(全仓唯一使用者);它不在历史 `ToolParameter` 上。
 */
const POST_LEGACY_KEYS: readonly string[] = ['additionalProperties']

/** 一条键路径是不是"旧侧类型表达不了"的键(逐段看:任一段落在闭集内即算)。 */
function isPostLegacyKeyPath(keyPath: string): boolean {
  return keyPath.split('.').some((segment) => POST_LEGACY_KEYS.includes(segment))
}

/** 剥掉旧侧类型表达不了的那些键(就地不下手,回一份新对象),用于"旧侧认得的键上比线字节"。 */
function stripPostLegacyKeys(node: unknown): unknown {
  if (Array.isArray(node)) return node.map((item) => stripPostLegacyKeys(item))
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node as SchemaNode)) {
    if (POST_LEGACY_KEYS.includes(k)) continue
    out[k] = stripPostLegacyKeys(v)
  }
  return out
}

/** 用同一把尺子比较「旧侧产出的 parameters」与「给定的新侧 parameters」 */
function compareParameters(toolName: string, legacy: SchemaNode, projected: SchemaNode): AbMismatch | null {
  const legacyProps = topPropertyNames(legacy)
  const projectedProps = topPropertyNames(projected)
  const legacyRequired = requiredListOf(legacy)
  const projectedRequired = requiredListOf(projected)
  const legacyPaths = collectKeyPaths(legacy)
  const projectedPaths = collectKeyPaths(projected)
  // 新侧多出来的键路径里,落进闭集的记作"历史类型表达不了",其余照旧判失配
  const projectedBeyond = diffBySet(projectedPaths, legacyPaths)
  const allowedBeyond = projectedBeyond.filter(isPostLegacyKeyPath)
  const unexpectedBeyond = projectedBeyond.filter((p) => !isPostLegacyKeyPath(p))
  const mismatch: AbMismatch = {
    tool: toolName,
    // 线字节在"剥掉历史类型表达不了的键"之后比:旧侧认得的每个键,值必须逐字节相同
    wireBytesEqual:
      JSON.stringify(stripPostLegacyKeys(legacy)) === JSON.stringify(stripPostLegacyKeys(projected)),
    propertiesOnlyInLegacy: diffBySet(legacyProps, projectedProps),
    propertiesOnlyInProjected: diffBySet(projectedProps, legacyProps),
    requiredOnlyInLegacy: diffBySet(legacyRequired, projectedRequired),
    requiredOnlyInProjected: diffBySet(projectedRequired, legacyRequired),
    keyPathsOnlyInLegacy: diffBySet(legacyPaths, projectedPaths),
    keyPathsOnlyInProjected: unexpectedBeyond,
    keyPathsOnlyInProjectedBeyondLegacyType: allowedBeyond,
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
  if (m.keyPathsOnlyInProjectedBeyondLegacyType.length)
    bits.push(`新侧多出历史类型表达不了的键 ${JSON.stringify(m.keyPathsOnlyInProjectedBeyondLegacyType.slice(0, 12))}(按 POST_LEGACY_KEYS 闭集放行)`)
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

      // 门的原始计数必须能被完整解释:门点到的具名工具 + 匿名 name 字面量,一条不多一条不少。
      // 注意:门的具名面**不含** FACTORY_SPEC_FILES 补进来的那批(那批门整个看不到,由本测试
      // 从 SPECS 重导出),所以这里用 `gateVisibleNamed` 而非 `gateNames` 全量来对齐末行读数 ——
      // 逐字复刻门的扫描面,才谈得上"两侧连数到多少都对得上"。
      expect(
        gateSide.reportedCount,
        `末行 ${gateSide.reportedCount} 应等于 门具名 ${gateSide.gateVisibleNamed.length} + 匿名 (non-literal) ${gateSide.anonymousOccurrences}` +
          `(工厂补面 ${gateSide.factorySpecCount} 枚不在门的静态扫描面里,不计入末行)`,
      ).toBe(gateSide.gateVisibleNamed.length + gateSide.anonymousOccurrences)

      // 登记表本身也要被验:登记了却在 HEAD 面配不上(站点改成字面量 / 文件挪走 / 同文件有多处站点),
      // 说明这张清单已经不再描述现状 ⇒ 当场红,不留下没人再核对的登记
      expect(
        gateSide.pairedCount,
        `VARIABLE_NAME_TOOLS 登记 ${VARIABLE_NAME_TOOLS.length} 枚,实际配到 ${gateSide.pairedCount} 枚 —— ` +
          '登记的变量名站点在 HEAD 面不再逐枚命中,清单必须随之更新',
      ).toBe(VARIABLE_NAME_TOOLS.length)

      // 工厂登记表同律:登记了几个文件就该抽出几条 SPECS 名字;抽不到即红(反查见 enumerateGateSide)
      expect(
        gateSide.factorySpecCount,
        `FACTORY_SPEC_FILES 登记 ${FACTORY_SPEC_FILES.length} 个文件,HEAD 面共抽出 ${gateSide.factorySpecCount} 条 SPECS 名字 —— ` +
          '抽不到说明 SPECS 数组名/文件路径已漂,清单或抽取面必须随之更新',
      ).toBeGreaterThan(0)
    },
    180_000,
  )

  it(
    '每个真工具对象:历史 toJsonProperty 与投影器 三项全等(旧侧认得的键上线字节 / properties 键集 / required 集)',
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
      const candidates = [...runtime.tools.values()]
        .filter((t) => Object.keys(t.parameters).length >= 2)
        .sort((a, b) => a.name.localeCompare(b.name))
      const victim = candidates[0]
      expect(victim, '没有任何 ≥2 参数的工具 ⇒ 变异对照无法进行,判据失效').toBeDefined()
      if (victim === undefined) throw new Error('没有任何 ≥2 参数的工具 ⇒ 变异对照无法进行,判据失效')

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
