// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一智能体注册表 · 内置定义种子(总管智能体 P1-06,2026-11-27 立)。
 *
 * 事实来源(只读代码,不反向覆盖代码):
 * - 10 个内置角色的提示词:apps/ai-service/app/services/prompt_registry.py 的 DEFAULT_PROMPTS。
 *   直接解析源文件,不在本脚本里复制第二份提示词 —— 代码改了,种子重跑即同步。
 * - master 提示词:apps/ai-service/app/agents/master.md。文件不存在或为空 = 未就绪,
 *   `--include-master` 时**跳过并明说**,绝不写入占位提示词冒充已完成。
 *
 * 幂等口径(验收:重复执行 0 变更):
 * - 已存在且受管字段完全一致 → 不写任何行,updated_at 不变;
 * - 已存在但有差异 → 只更新受管字段(display/description/role/system_prompt/
 *   is_builtin/is_dispatchable),version + 1,提示词变化时 prompt_version + 1,
 *   并落一份 change_kind='update' 的完整快照;
 * - 不存在 → 插入 + 落 change_kind='create' 快照(快照覆盖全部可变字段,I4)。
 *
 * 用法:
 *   pnpm --filter @ihui/api exec tsx src/db/seed-agent-definitions.ts
 *   pnpm --filter @ihui/api exec tsx src/db/seed-agent-definitions.ts --include-master
 *
 * 前置:目标库已应用 packages/database/drizzle/20261127120000_agent_registry.sql。
 * 安全:缺 DATABASE_URL 拒绝执行;库名含 prod/production 拒绝执行。
 */
import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  agentDefinitionVersions,
  agentDefinitions,
  schema,
  type AgentDefinition,
} from '@ihui/database'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../..')
const PROMPT_REGISTRY_PY = resolve(REPO_ROOT, 'apps/ai-service/app/services/prompt_registry.py')
const MASTER_PROMPT_MD = resolve(REPO_ROOT, 'apps/ai-service/app/agents/master.md')

/** master 的可调用工具面；与 apps/ai-service/app/agents/master_profile.py 同源，种子只做落库。 */
const MASTER_TOOLS = ['agent_registry', 'agent_ops', 'master_memory']

/** prompt_registry.py 里的 10 个内置角色(DEFAULT_PROMPTS 的键) */
interface BuiltinPromptSeed {
  name: string
  description: string
  content: string
  /** 显示名缺省沿用 description；master 单独给短名 */
  displayName?: string
  /** 角色缺省沿用 name；master 用 custom（name 不在封闭角色集） */
  role?: string
  /** 工具面缺省为空；master 落三件套 */
  tools?: string[]
  /** 提示词来源；内置角色缺省为 prompt_registry.py，master 为 master.md */
  source?: string
}

/** 种子只接管这些字段;model/skills/budget/... 保持库里既有值,避免覆盖管理员配置 */
type ManagedField =
  'displayName' | 'description' | 'role' | 'systemPrompt' | 'tools' | 'isBuiltin' | 'isDispatchable'

const DEFAULT_PROMPTS_MARKER = 'DEFAULT_PROMPTS: dict[str, dict[str, str]] = {'

/**
 * 从 openIndex 处(必须是 open 字符)截取配对括号内的内容。
 * 只处理 Python 单/双引号(含转义)与 `#` 行注释,足够覆盖 prompt_registry.py 的字面量块。
 */
function sliceBalanced(source: string, openIndex: number, open: string, close: string): string {
  let depth = 0
  let quote: '"' | "'" | null = null
  let i = openIndex
  while (i < source.length) {
    const ch = source.charAt(i)
    if (quote !== null) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }
    if (ch === '#') {
      const nl = source.indexOf('\n', i)
      i = nl === -1 ? source.length : nl + 1
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      i += 1
      continue
    }
    if (ch === open) depth += 1
    if (ch === close) {
      depth -= 1
      if (depth === 0) return source.slice(openIndex + 1, i)
    }
    i += 1
  }
  throw new Error(`括号不配对: 从 ${openIndex} 起的 ${open}${close} 未闭合`)
}

/** 解码 Python 字符串转义(内容里实际只用到 \\ 与 \" 一类) */
function decodePyEscape(char: string): string {
  switch (char) {
    case 'n':
      return '\n'
    case 't':
      return '\t'
    case 'r':
      return '\r'
    case '0':
      return '\0'
    case '\\':
      return '\\'
    case '"':
      return '"'
    case "'":
      return "'"
    default:
      return char
  }
}

/** 读一个 Python 单行字符串字面量;起点不是引号或未闭合时返回 null */
function readLiteralAt(source: string, start: number): { value: string; end: number } | null {
  const quote = source.charAt(start)
  if (quote !== '"' && quote !== "'") return null
  let value = ''
  let i = start + 1
  while (i < source.length) {
    const ch = source.charAt(i)
    if (ch === '\\') {
      value += decodePyEscape(source.charAt(i + 1))
      i += 2
      continue
    }
    if (ch === quote) return { value, end: i + 1 }
    value += ch
    i += 1
  }
  return null
}

/** 拼接 Python 隐式字符串连接(括号内多个相邻字面量) */
function concatLiterals(expression: string): string {
  let result = ''
  let i = 0
  while (i < expression.length) {
    const ch = expression.charAt(i)
    if (ch === '"' || ch === "'") {
      const literal = readLiteralAt(expression, i)
      if (literal) {
        result += literal.value
        i = literal.end
        continue
      }
    }
    i += 1
  }
  return result
}

/** 取 entry 里某个键的字符串值;content 允许 `( "..." "..." )` 隐式连接 */
function readStringField(entry: string, key: string): string | null {
  const keyMatch = new RegExp(`"${key}"\\s*:\\s*`).exec(entry)
  if (!keyMatch) return null
  let i = keyMatch.index + keyMatch[0].length
  while (i < entry.length && /\s/.test(entry.charAt(i))) i += 1
  if (entry.charAt(i) === '(') return concatLiterals(sliceBalanced(entry, i, '(', ')'))
  const literal = readLiteralAt(entry, i)
  return literal ? literal.value : null
}

/** 解析 DEFAULT_PROMPTS 的 10 个条目(解析失败/数量不对一律抛错,绝不半量种子) */
function parseBuiltinPrompts(pythonSource: string): BuiltinPromptSeed[] {
  const markerAt = pythonSource.indexOf(DEFAULT_PROMPTS_MARKER)
  if (markerAt < 0) throw new Error(`未找到 ${DEFAULT_PROMPTS_MARKER}`)
  const braceAt = pythonSource.indexOf('{', markerAt + DEFAULT_PROMPTS_MARKER.length - 1)
  const body = sliceBalanced(pythonSource, braceAt, '{', '}')

  const seeds: BuiltinPromptSeed[] = []
  const entryRe = /"([a-z0-9][a-z0-9-]*)"\s*:\s*\{/g
  for (const match of body.matchAll(entryRe)) {
    const name = match[1]
    if (!name) continue
    const entryOpen = body.indexOf('{', (match.index ?? 0) + match[0].length - 1)
    const entry = sliceBalanced(body, entryOpen, '{', '}')
    const content = readStringField(entry, 'content')
    const description = readStringField(entry, 'description')
    if (!content) throw new Error(`内置 ${name}: content 解析为空`)
    if (!description) throw new Error(`内置 ${name}: description 解析为空`)
    seeds.push({ name, description, content })
  }

  const uniqueNames = new Set(seeds.map((s) => s.name))
  if (seeds.length !== 10 || uniqueNames.size !== 10) {
    throw new Error(
      `DEFAULT_PROMPTS 解析结果应为 10 个唯一角色,实际 ${seeds.length}/${uniqueNames.size}`,
    )
  }
  return seeds
}

interface SeedRow {
  scope: 'system'
  name: string
  displayName: string
  description: string
  role: string
  systemPrompt: string
  promptVersion: number
  model: null
  tools: string[]
  skills: string[]
  permissions: Record<string, unknown>
  memoryPolicy: Record<string, unknown>
  budget: Record<string, unknown>
  concurrencyLimit: number
  status: 'active'
  isBuiltin: true
  isDispatchable: boolean
  marketAgentId: null
  metadata: Record<string, unknown>
  version: number
}

function buildSeedRow(seed: BuiltinPromptSeed, isDispatchable: boolean): SeedRow {
  return {
    scope: 'system',
    name: seed.name,
    displayName: seed.displayName ?? seed.description,
    description: seed.description,
    role: seed.role ?? seed.name,
    systemPrompt: seed.content,
    promptVersion: 1,
    model: null,
    tools: seed.tools ?? [],
    skills: [],
    permissions: {},
    memoryPolicy: {},
    budget: {},
    concurrencyLimit: 2,
    status: 'active',
    isBuiltin: true,
    isDispatchable,
    marketAgentId: null,
    metadata: {
      source: seed.source ?? 'apps/ai-service/app/services/prompt_registry.py',
      promptName: seed.name,
      seed: 'agent-registry-v1',
    },
    version: 1,
  }
}

/** 快照必须覆盖全部可变字段;缺一个就会让回滚不完整 */
function buildSnapshot(
  row: AgentDefinition,
  changeKind: 'create' | 'update',
): {
  snapshot: Record<string, unknown>
  changeSummary: string
} {
  return {
    snapshot: {
      name: row.name,
      displayName: row.displayName,
      description: row.description,
      role: row.role,
      systemPrompt: row.systemPrompt,
      promptVersion: row.promptVersion,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      tools: row.tools,
      skills: row.skills,
      permissions: row.permissions,
      memoryPolicy: row.memoryPolicy,
      budget: row.budget,
      concurrencyLimit: row.concurrencyLimit,
      isDispatchable: row.isDispatchable,
      status: row.status,
      metadata: row.metadata,
    },
    changeSummary: changeKind === 'create' ? 'seed:内置定义首次写入' : 'seed:内置定义提示词同步',
  }
}

type ManagedPatch = Partial<Pick<AgentDefinition, ManagedField>>

function diffManaged(existing: AgentDefinition, next: SeedRow): ManagedPatch {
  const patch: ManagedPatch = {}
  if (existing.displayName !== next.displayName) patch.displayName = next.displayName
  if (existing.description !== next.description) patch.description = next.description
  if (existing.role !== next.role) patch.role = next.role
  if (existing.systemPrompt !== next.systemPrompt) patch.systemPrompt = next.systemPrompt
  if (JSON.stringify(existing.tools) !== JSON.stringify(next.tools)) patch.tools = next.tools
  if (existing.isBuiltin !== next.isBuiltin) patch.isBuiltin = next.isBuiltin
  if (existing.isDispatchable !== next.isDispatchable) patch.isDispatchable = next.isDispatchable
  return patch
}

interface SeedCounts {
  created: number
  updated: number
  unchanged: number
}

async function main(): Promise<void> {
  const includeMaster = process.argv.includes('--include-master')

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    console.error('[seed-agent-definitions] 拒绝执行:DATABASE_URL 未设置')
    process.exitCode = 1
    return
  }
  const url = new URL(databaseUrl)
  const databaseName = url.pathname.replace(/^\//, '') || '(unknown)'
  if (/prod|production/i.test(databaseName)) {
    console.error(`[seed-agent-definitions] 拒绝执行:目标库 "${databaseName}" 含 prod/production`)
    process.exitCode = 1
    return
  }

  if (!existsSync(PROMPT_REGISTRY_PY)) {
    console.error(`[seed-agent-definitions] 提示词源文件不存在: ${PROMPT_REGISTRY_PY}`)
    process.exitCode = 2
    return
  }

  let builtinSeeds: BuiltinPromptSeed[]
  try {
    builtinSeeds = parseBuiltinPrompts(readFileSync(PROMPT_REGISTRY_PY, 'utf-8'))
  } catch (err) {
    console.error(
      '[seed-agent-definitions] 解析 prompt_registry.py 失败:',
      err instanceof Error ? err.message : err,
    )
    process.exitCode = 2
    return
  }

  const masterSeed: BuiltinPromptSeed | null = (() => {
    if (!includeMaster) return null
    if (!existsSync(MASTER_PROMPT_MD)) {
      console.info('[seed-agent-definitions] --include-master: master.md 不存在,跳过(不写占位数据)')
      return null
    }
    const content = readFileSync(MASTER_PROMPT_MD, 'utf-8').trim()
    if (content.length === 0) {
      console.info('[seed-agent-definitions] --include-master: master.md 为空,跳过(不写占位数据)')
      return null
    }
    return {
      name: 'master',
      displayName: '总管',
      description: '总管:唯一有管理权限的常驻主智能体人格(不可被派发为 worker)',
      role: 'custom',
      tools: MASTER_TOOLS,
      source: 'apps/ai-service/app/agents/master.md',
      content,
    }
  })()

  console.info(
    `[seed-agent-definitions] 目标 ${url.hostname}:${url.port || 5432}/${databaseName} · ` +
      `内置 ${builtinSeeds.length} 个 · master ${includeMaster ? (masterSeed ? '纳入' : '跳过') : '未请求'}`,
  )

  const sql = postgres(databaseUrl, { max: 1 })
  const db = drizzle(sql, { schema })
  const builtinCounts: SeedCounts = { created: 0, updated: 0, unchanged: 0 }
  // 用 const 对象而不是 let 变量:计数在事务回调内累加,回调外读属性不受控制流收窄影响
  const masterCounts: SeedCounts | null = masterSeed
    ? { created: 0, updated: 0, unchanged: 0 }
    : null

  try {
    await db.transaction(async (tx) => {
      const upsert = async (
        seed: BuiltinPromptSeed,
        isDispatchable: boolean,
        counts: SeedCounts,
      ) => {
        const next = buildSeedRow(seed, isDispatchable)
        const existingRows = await tx
          .select()
          .from(agentDefinitions)
          .where(and(eq(agentDefinitions.scope, 'system'), eq(agentDefinitions.name, seed.name)))
          .limit(1)
        const existing = existingRows[0]

        if (!existing) {
          const insertedRows = await tx.insert(agentDefinitions).values(next).returning()
          const inserted = insertedRows[0]
          if (!inserted) throw new Error(`插入 ${seed.name} 未返回行`)
          const snapshot = buildSnapshot(inserted, 'create')
          await tx.insert(agentDefinitionVersions).values({
            definitionId: inserted.id,
            version: inserted.version,
            changeKind: 'create',
            snapshot: snapshot.snapshot,
            changeSummary: snapshot.changeSummary,
            actorUserId: null,
          })
          counts.created += 1
          return
        }

        const patch = diffManaged(existing, next)
        if (Object.keys(patch).length === 0) {
          counts.unchanged += 1
          return
        }

        const updatedRows = await tx
          .update(agentDefinitions)
          .set({
            ...patch,
            version: existing.version + 1,
            promptVersion:
              patch.systemPrompt !== undefined
                ? existing.promptVersion + 1
                : existing.promptVersion,
            updatedAt: new Date(),
          })
          .where(eq(agentDefinitions.id, existing.id))
          .returning()
        const updated = updatedRows[0]
        if (!updated) throw new Error(`更新 ${seed.name} 未返回行`)
        const snapshot = buildSnapshot(updated, 'update')
        await tx.insert(agentDefinitionVersions).values({
          definitionId: updated.id,
          version: updated.version,
          changeKind: 'update',
          snapshot: snapshot.snapshot,
          changeSummary: snapshot.changeSummary,
          actorUserId: null,
        })
        counts.updated += 1
      }

      for (const seed of builtinSeeds) {
        await upsert(seed, true, builtinCounts)
      }

      if (masterSeed && masterCounts) {
        await upsert(masterSeed, false, masterCounts)
      }
    })

    console.info(
      `[seed-agent-definitions] 内置 ${builtinSeeds.length}: 新增 ${builtinCounts.created} · ` +
        `更新 ${builtinCounts.updated} · 不变 ${builtinCounts.unchanged}`,
    )
    if (masterCounts) {
      console.info(
        `[seed-agent-definitions] master: 新增 ${masterCounts.created} · 更新 ${masterCounts.updated} · ` +
          `不变 ${masterCounts.unchanged}`,
      )
    }
    console.info('[seed-agent-definitions] ✅ 种子完成')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/relation .*agent_definitions.* does not exist|42P01/i.test(message)) {
      console.error(
        '[seed-agent-definitions] 目标库缺少 agent_definitions:请先应用 ' +
          'packages/database/drizzle/20261127120000_agent_registry.sql',
      )
    }
    console.error('[seed-agent-definitions] ❌ 失败:', message)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('[seed-agent-definitions] ❌ 未捕获错误:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
