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
import { mkdirSync, renameSync, statSync, unlinkSync, type Stats } from 'node:fs'
import { redactSecrets } from '../redact.js'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { readCliPackage } from '../util/pkg-version.js'
// runId 会直接当目录名(manifest/latest 落盘):收敛 + 根内断言统一走 util/path-guard。
import { assertPathInside, safePathSegment } from '../util/path-guard.js'
// F-008:清单里含 argv(可能带一次性凭据),落盘统一走凭据唯一写入口(0600 + chmod 纠偏)。
import { writePrivateFile } from '../lib/private-file.js'
import { redactArgv } from '../util/argv-redact.js'

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
  /** 测试注入。缺省用 statSync。读失败不是缺失时不得当成没有仓库。 */
  stat?: (target: string) => Stats
}

const MANIFEST_DIR = join('.ihui-agent', 'state', 'runs')

function markerState(target: string, stat: (path: string) => Stats): 'present' | 'absent' | 'unreadable' {
  try {
    stat(target)
    return 'present'
  } catch (error) {
    const code = error !== null && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'absent'
    return 'unreadable'
  }
}

/** 从 start 向上找带 `.git`(目录或 gitfile)或 `pnpm-workspace.yaml` 的目录。读不到标记时不改去上一层。 */
export function findProjectRoot(start: string, stat: (path: string) => Stats = statSync): string | null {
  let dir = resolve(start)
  for (;;) {
    const git = markerState(join(dir, '.git'), stat)
    const workspace = markerState(join(dir, 'pnpm-workspace.yaml'), stat)
    if (git === 'unreadable' || workspace === 'unreadable') {
      throw new Error(`项目根标记读不到,不能把它说成没有再写到别的目录: ${dir}`)
    }
    if (git === 'present' || workspace === 'present') return dir
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
  const root = findProjectRoot(cwd, options.stat ?? statSync)
  return {
    runId: safePathSegment(options.runId ?? randomUUID()),
    startedAt: (options.now ?? (() => new Date()))().toISOString(),
    // F-008:argv 原样落盘会把 `-p/--password/--api-key/--token` 的值写进长期可读的
    // 运行清单。先按旗标位置打码(键名保留、其余参数原样),再逐元素走值形状脱敏出口
    // (兜住 `curl -H "Authorization: ..."`、URL query 这类无旗标形态)。
    argv: redactArgv(options.argv ?? process.argv.slice(2)).map((arg) => redactSecrets(arg)),
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
    // runId 已在 buildRunManifest 收敛为单段名,这里再补一次根内/realpath 断言。
    const dir = assertPathInside(root, join(root, manifest.runId), 'run 目录')
    // 0600/0700:清单里含 argv/envFlags,默认 0644 会让同机其他用户可读。
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    // DBG-42 + F-008:tmp+rename 保住原子性(崩溃/并发不会让 `ihui runs` 读到半截
    // manifest),tmp 由 writePrivateFile 以 0600 创建(rename 保留权限位),不允许清单
    // 里的一次性凭据落成 0644。rename 失败时清掉自己的 tmp,不留残件。
    const manifestPath = join(dir, 'manifest.json')
    const manifestTmp = `${manifestPath}.${process.pid}.tmp`
    writePrivateFile(manifestTmp, `${JSON.stringify(manifest, null, 2)}\n`)
    try {
      renameSync(manifestTmp, manifestPath)
    } catch (err) {
      try {
        unlinkSync(manifestTmp)
      } catch {
        // 清 tmp 失败不改判据结论:主错误已在下行抛出
      }
      throw err
    }
    // latest 用「临时文件 + rename」落盘:并发两个 CLI 进程同时启动时,直接覆写
    // 会让读者读到半截 JSON(rename 在同卷上是原子的)。临时名带 pid,互不踩。
    const latest = join(root, 'latest.json')
    const tmp = `${latest}.${process.pid}.tmp`
    writePrivateFile(tmp, `${JSON.stringify({ runId: manifest.runId, dir, startedAt: manifest.startedAt }, null, 2)}\n`)
    renameSync(tmp, latest)
    return { dir, manifest }
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
