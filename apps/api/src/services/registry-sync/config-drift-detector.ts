/**
 * 配置漂移检测器(2026-07-24 立)。
 *
 * 对 .env.example / .env.production.example / config.py / package.json /
 * docker-compose.yml 五类配置文件做 SHA-256 基线对比,输出 added/removed/changed
 * 键集合,供管理员判断是否需要触发自动迁移。
 *
 * 基线存储在项目内 .trae-cn/tmp/config-baseline.json(AGENTS.md §15 工作区卫生)。
 * 仅读取配置文件本身,绝不写入(.env / config.py / package.json / docker-compose.yml 只读)。
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  ConfigDriftDetectResponse,
  ConfigDriftReport,
  ConfigFileType,
} from '@ihui/types'

/**
 * 项目根目录解析:cwd 可能是 monorepo 根(根目录运行)或 apps/api(turbo 包内运行)。
 * 以 pnpm-workspace.yaml 作为 monorepo 根标记向上探测;回退到 .env.example 探测。
 */
const PROJECT_ROOT = (() => {
  let dir = process.cwd()
  while (dir) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return existsSync(join(process.cwd(), '.env.example'))
    ? process.cwd()
    : join(process.cwd(), '..', '..')
})()

/** 各类配置文件路径映射(相对项目根) */
export const CONFIG_FILE_PATHS: Record<ConfigFileType, string> = {
  env_example: '.env.example',
  env_production_example: '.env.production.example',
  config_py: 'apps/ai-service/app/core/config.py',
  package_json: 'package.json',
  docker_compose: 'docker-compose.yml',
}

/** 高危键(新增/删除需人工确认,迁移器跳过自动迁移) */
export const HIGH_RISK_KEYS = new Set([
  'DATABASE_URL',
  'DB_PASSWORD',
  'JWT_SECRET',
  'CREDENTIALS_ENCRYPTION_KEY',
  'REDIS_PASSWORD',
  'AI_CALLBACK_SECRET',
])

/** 上游基线 hash 存储(文件版) */
const BASELINE_FILE = '.trae-cn/tmp/config-baseline.json'

interface BaselineEntry {
  hash: string
  content: string
  keys: Record<string, string>
}

type BaselineStore = Partial<Record<ConfigFileType, BaselineEntry>>

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function resolvePath(rel: string): string {
  return join(PROJECT_ROOT, rel)
}

async function readBaseline(): Promise<BaselineStore> {
  try {
    const text = await readFile(resolvePath(BASELINE_FILE), 'utf8')
    return JSON.parse(text) as BaselineStore
  } catch {
    return {}
  }
}

async function writeBaseline(store: BaselineStore): Promise<void> {
  const abs = resolvePath(BASELINE_FILE)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, JSON.stringify(store, null, 2), 'utf8')
}

// =============================================================================
// 解析器(各文件类型 → 扁平 key→value 映射)
// =============================================================================

/** 解析 env 文件的 key 列表(KEY=value,跳过注释/空行) */
export function parseEnvKeys(content: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && m[1]) map.set(m[1], m[2] ?? '')
  }
  return map
}

/** 解析 config.py 的字段(Pydantic Settings 的 `field: type = default` 行) */
export function parseConfigPyKeys(content: string): Map<string, string> {
  const map = new Map<string, string>()
  const re = /^ {4}([a-z_][a-z0-9_]*):\s*[^=\n]+(?:=\s*(.+?))?$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const key = m[1]
    if (key) map.set(key, (m[2] ?? '').trim())
  }
  return map
}

/** 解析 package.json 的 dependencies/devDependencies key 列表 */
export function parsePackageJsonKeys(content: string): {
  deps: Map<string, string>
  devDeps: Map<string, string>
} {
  const deps = new Map<string, string>()
  const devDeps = new Map<string, string>()
  try {
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    for (const [k, v] of Object.entries(pkg.dependencies ?? {})) deps.set(k, v)
    for (const [k, v] of Object.entries(pkg.devDependencies ?? {})) devDeps.set(k, v)
  } catch {
    // 无效 JSON,返回空映射
  }
  return { deps, devDeps }
}

/** 解析 docker-compose.yml 的 services + environment key 列表(键格式 `service:KEY`) */
export function parseDockerComposeKeys(content: string): Map<string, string> {
  const map = new Map<string, string>()
  let currentService = ''
  for (const rawLine of content.split('\n')) {
    const svcMatch = rawLine.match(/^  ([a-zA-Z0-9_-]+):\s*$/)
    if (svcMatch && svcMatch[1]) {
      currentService = svcMatch[1]
      continue
    }
    const envEq = rawLine.match(/^\s+-\s+([A-Z][A-Z0-9_]+)=(.*)$/)
    if (envEq && envEq[1] && currentService) {
      map.set(`${currentService}:${envEq[1]}`, envEq[2] ?? '')
      continue
    }
    const envColon = rawLine.match(/^\s+-\s+([A-Z][A-Z0-9_]+):\s*(.*)$/)
    if (envColon && envColon[1] && currentService) {
      map.set(`${currentService}:${envColon[1]}`, envColon[2] ?? '')
    }
  }
  return map
}

/** 按文件类型解析为扁平 key→value 映射(package_json 加 deps:/devDeps: 前缀避免冲突) */
function parseKeys(fileType: ConfigFileType, content: string): Map<string, string> {
  switch (fileType) {
    case 'env_example':
    case 'env_production_example':
      return parseEnvKeys(content)
    case 'config_py':
      return parseConfigPyKeys(content)
    case 'docker_compose':
      return parseDockerComposeKeys(content)
    case 'package_json': {
      const { deps, devDeps } = parsePackageJsonKeys(content)
      const flat = new Map<string, string>()
      for (const [k, v] of deps) flat.set(`deps:${k}`, v)
      for (const [k, v] of devDeps) flat.set(`devDeps:${k}`, v)
      return flat
    }
  }
}

/** 简易行级差异(新增+删除行数),用于 changedLines 近似值 */
function countChangedLines(current: string, baseline: string): number {
  const cur = current.split('\n')
  const base = baseline.split('\n')
  const baseSet = new Set(base)
  const curSet = new Set(cur)
  let added = 0
  let removed = 0
  for (const l of cur) if (!baseSet.has(l)) added++
  for (const l of base) if (!curSet.has(l)) removed++
  return added + removed
}

// =============================================================================
// 公共 API
// =============================================================================

/** 检测单个文件类型漂移 */
export async function detectDrift(fileType: ConfigFileType): Promise<ConfigDriftReport> {
  const filePath = CONFIG_FILE_PATHS[fileType]
  const abs = resolvePath(filePath)
  const baseline = await readBaseline()
  const baseEntry = baseline[fileType]

  let currentContent = ''
  let currentHash = ''
  try {
    currentContent = await readFile(abs, 'utf8')
    currentHash = await sha256(currentContent)
  } catch {
    // 文件读取失败:视为内容为空,若有基线则判定为漂移(文件被删除)
    const drifted = !!baseEntry
    return {
      fileType,
      filePath,
      currentHash: '',
      upstreamHash: baseEntry?.hash ?? '',
      drifted,
      changedLines: 0,
      addedKeys: [],
      removedKeys: [],
      changedKeys: [],
    }
  }

  const upstreamHash = baseEntry?.hash ?? ''
  const drifted = !!baseEntry && currentHash !== upstreamHash

  const currentKeys = parseKeys(fileType, currentContent)
  const baselineKeys = new Map<string, string>(
    Object.entries(baseEntry?.keys ?? {}),
  )

  const addedKeys: string[] = []
  const removedKeys: string[] = []
  const changedKeys: string[] = []
  for (const k of currentKeys.keys()) {
    if (!baselineKeys.has(k)) addedKeys.push(k)
    else if (baselineKeys.get(k) !== currentKeys.get(k)) changedKeys.push(k)
  }
  for (const k of baselineKeys.keys()) {
    if (!currentKeys.has(k)) removedKeys.push(k)
  }

  return {
    fileType,
    filePath,
    currentHash,
    upstreamHash,
    drifted,
    changedLines: baseEntry ? countChangedLines(currentContent, baseEntry.content) : 0,
    addedKeys,
    removedKeys,
    changedKeys,
  }
}

/** 检测所有配置文件漂移 */
export async function detectAllDrift(): Promise<ConfigDriftDetectResponse> {
  const types = Object.keys(CONFIG_FILE_PATHS) as ConfigFileType[]
  const reports = await Promise.all(types.map((t) => detectDrift(t)))
  return {
    reports,
    hasDrift: reports.some((r) => r.drifted),
    detectedAt: new Date().toISOString(),
  }
}

/** 更新基线 hash(管理员手动确认后调用,标记当前为"已知良好"基线) */
export async function updateBaseline(fileType?: ConfigFileType): Promise<void> {
  const store = await readBaseline()
  const types: ConfigFileType[] = fileType
    ? [fileType]
    : (Object.keys(CONFIG_FILE_PATHS) as ConfigFileType[])
  for (const t of types) {
    const abs = resolvePath(CONFIG_FILE_PATHS[t])
    let content = ''
    try {
      content = await readFile(abs, 'utf8')
    } catch {
      // 文件不存在则跳过该类型
      continue
    }
    const hash = await sha256(content)
    const keys: Record<string, string> = {}
    for (const [k, v] of parseKeys(t, content)) keys[k] = v
    store[t] = { hash, content, keys }
  }
  await writeBaseline(store)
}

/** 读取基线条目(迁移器复用:获取"已知良好"上游内容) */
export async function readBaselineEntry(
  fileType: ConfigFileType,
): Promise<BaselineEntry | undefined> {
  const store = await readBaseline()
  return store[fileType]
}
