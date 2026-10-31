// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * run manifest —— 每次 CLI 进程启动落一份可追溯清单。
 *
 * 对标外部 agent 运行时的 `logs/runs/<run_id>/manifest.json`(argv/ppid/env_flags/
 * cli_version/node_version/project_id) + `latest` 指针。本仓此前没有"这一次运行
 * 是什么"的落盘载体:排障只能靠 shell 历史,桌面壳/CI/用户机之间无法对账。
 *
 * 落点刻意选工作区状态目录(`.ihui-agent/state/runs/`,gitignored),遵守 §15 卫生;
 * `latest` 用**指针 JSON** 而不是软链/junction —— 避开 §26 的 junction 递归穿透红线。
 * 写失败一律静默降级:启动期的观测件不得挡主流程。
 */

import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { readCliPackage } from '../util/pkg-version.js'

export interface RunManifest {
  runId: string
  startedAt: string
  argv: string[]
  ppid: number | null
  envFlags: {
    ci: boolean
    debug: boolean
    noColor: boolean
    json: boolean
    headless: boolean
  }
  cliVersion: string | null
  nodeVersion: string
  projectId: string | null
  projectRoot: string | null
  cwd: string
}

export interface RunManifestOptions {
  argv?: string[]
  cwd?: string
  ppid?: number | null
  env?: NodeJS.ProcessEnv
  cliVersion?: string | null
  now?: () => Date
  runId?: string
}

const MANIFEST_DIR = join('.ihui-agent', 'state', 'runs')

/** 从 start 向上找带 `.git`(目录或 gitfile)或 `pnpm-workspace.yaml` 的目录。 */
export function findProjectRoot(start: string): string | null {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** 项目身份 = 仓库根路径的 sha256 前 12 位(不暴露绝对路径,可跨机去重)。 */
export function projectIdOf(root: string | null): string | null {
  if (!root) return null
  return createHash('sha256').update(root).digest('hex').slice(0, 12)
}

/** 读 CLI 版本号;任何形态异常(vitest 变换 / SEA / 打包缺失)一律记 null,不拖垮启动。 */
function safeCliVersion(): string | null {
  try {
    return readCliPackage(import.meta.url)?.version ?? null
  } catch {
    return null
  }
}

export function buildRunManifest(options: RunManifestOptions = {}): RunManifest {
  const cwd = options.cwd ?? process.cwd()
  const env = options.env ?? process.env
  const root = findProjectRoot(cwd)
  return {
    runId: options.runId ?? randomUUID(),
    startedAt: (options.now ?? (() => new Date()))().toISOString(),
    argv: options.argv ?? process.argv.slice(2),
    ppid: options.ppid === undefined ? (process.ppid ?? null) : options.ppid,
    envFlags: {
      ci: Boolean(env.CI),
      debug: Boolean(env.DEBUG || env.IHUI_DEBUG),
      noColor: Boolean(env.NO_COLOR),
      json: Boolean(env.IHUI_JSON),
      headless: Boolean(env.IHUI_HEADLESS),
    },
    cliVersion: options.cliVersion === undefined ? safeCliVersion() : options.cliVersion,
    nodeVersion: process.version,
    projectId: projectIdOf(root),
    projectRoot: root,
    cwd,
  }
}

/** 运行清单根:优先工作区状态目录,不在仓库内则落用户目录(仍不进 C 盘约定目录以外)。 */
export function runsRootFor(manifest: RunManifest): string {
  if (manifest.projectRoot) return join(manifest.projectRoot, MANIFEST_DIR)
  return join(homedir(), '.ihui', 'runs')
}

/** 写 run manifest + latest 指针;任何失败返回 null 且不抛(启动期观测件)。 */
export function writeRunManifest(options: RunManifestOptions = {}): { dir: string; manifest: RunManifest } | null {
  try {
    const manifest = buildRunManifest(options)
    const root = runsRootFor(manifest)
    const dir = join(root, manifest.runId)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    writeFileSync(
      join(root, 'latest.json'),
      `${JSON.stringify({ runId: manifest.runId, dir, startedAt: manifest.startedAt }, null, 2)}\n`,
      'utf8',
    )
    return { dir, manifest }
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
