// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话库备份(⑦第二刀·备份腿,2026-10-27 立)。
 *
 * 红线(docs/RELAY_SESSION_MIGRATION_DESIGN.md §2):
 * - 源目录只读:只 stat/read,绝不写/删/改名源侧任何路径;
 * - 默认 dry-run:只打印将备份清单(路径+字节,不打印内容),真拷贝必须 --apply;
 * - 零内容回显:输出永不包含 token、消息正文;
 * - 校验后收工:逐文件 sha256 对账,先写临时名、校验过后再改名,不留半写状态。
 */

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, sep } from 'node:path'

/** 快照清单内单文件条目(零内容,只元数据) */
export interface BackupFileEntry {
  /** 相对源根的路径(POSIX 斜杠归一,清单跨机可比) */
  rel: string
  bytes: number
  mtimeMs: number
  sha256: string
}

export interface BackupManifest {
  createdAt: string
  source: { sessionsRoot: string; projectsRoot: string }
  files: BackupFileEntry[]
}

export interface BackupPlan {
  destDir: string
  sessionsRoot: string
  projectsRoot: string
  files: BackupFileEntry[]
  totalBytes: number
  /** 源不存在时 plan 为空但仍成立(空快照合法) */
  sourcePresent: boolean
}

function sha256Of(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** 收集一个目录树下的全部文件(相对路径,POSIX 斜杠);目录不存在返回空 */
function collectFilesUnder(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (dir: string): void => {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const p = join(dir, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(p)
      else if (st.isFile()) out.push(p)
    }
  }
  walk(root)
  return out
}

function toEntry(absPath: string, root: string): BackupFileEntry | null {
  try {
    const st = statSync(absPath)
    const buf = readFileSync(absPath)
    const rel = relative(root, absPath).split(sep).join('/')
    return { rel, bytes: st.size, mtimeMs: st.mtimeMs, sha256: sha256Of(buf) }
  } catch {
    return null
  }
}

/**
 * 计算备份计划(纯只读面)。默认目的地 `~/.wb-switch/backups/sessions/<UTC时间戳>/`,
 * `destOverride` 供测试与 --dest 注入。
 */
export function computeBackupPlan(
  sessionsRoot: string,
  projectsRoot: string,
  now: Date,
  destOverride?: string,
): BackupPlan {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const destDir = destOverride ?? join(homedir(), '.wb-switch', 'backups', 'sessions', stamp)
  const sourcePresent = existsSync(sessionsRoot) || existsSync(projectsRoot)
  const files: BackupFileEntry[] = []
  // 会话库文件加 workspace/ 前缀,与 projects 文件同放一份清单且互不冲突(§4 manifest 形状)
  for (const [root, prefix] of [
    [sessionsRoot, 'workspace/'],
    [projectsRoot, ''],
  ] as const) {
    for (const abs of collectFilesUnder(root)) {
      const e = toEntry(abs, root)
      if (e) files.push({ ...e, rel: prefix + e.rel })
    }
  }
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0)
  return { destDir, sessionsRoot, projectsRoot, files, totalBytes, sourcePresent }
}

/** 预览文本:路径+字节+sha 前 12 位,零内容 */
export function formatPlan(plan: BackupPlan, dryRun: boolean): string {
  const lines: string[] = []
  lines.push(dryRun ? `会话库备份·预览(dry-run;加 --apply 才真拷贝)` : `会话库备份·执行`)
  lines.push(`目的地: ${plan.destDir}`)
  lines.push(
    `源: sessions=${plan.sessionsRoot}(存在=${existsSync(plan.sessionsRoot)}) projects=${plan.projectsRoot}(存在=${existsSync(plan.projectsRoot)})`,
  )
  lines.push(`将备份 ${plan.files.length} 个文件,共 ${plan.totalBytes} 字节`)
  const shown = plan.files.slice(0, 15)
  for (const f of shown) lines.push(`  ${f.rel} (${f.bytes}B, sha:${f.sha256.slice(0, 12)})`)
  if (plan.files.length > shown.length)
    lines.push(`  …其余 ${plan.files.length - shown.length} 个文件见 manifest.json`)
  return lines.join('\n')
}

/**
 * 执行备份(写面,仅 --apply 路径可达)。逐文件:读源 → 写 `<目标>.copying-<ts>` 临时名
 * → sha256 校验 → rename 去后缀 → 记账。任一文件对不上即整批中止(已成功的保留,
 * 失败清单随错误抛出),绝不留"对不上的半写状态"。
 */
export function applyBackup(
  plan: BackupPlan,
  sourceRoots: { sessionsRoot: string; projectsRoot: string },
): BackupManifest {
  const ts = Date.now()
  mkdirSync(plan.destDir, { recursive: true })
  const placed: BackupFileEntry[] = []
  const failures: string[] = []
  for (const f of plan.files) {
    const srcAbs = f.rel.startsWith('workspace/')
      ? join(sourceRoots.sessionsRoot, f.rel.slice('workspace/'.length))
      : join(sourceRoots.projectsRoot, f.rel)
    // rel 前缀:plan 构造时 workspace/sessions → "workspace/...", projects → 原样相对 projectsRoot
    const dstAbs = join(plan.destDir, f.rel)
    const tmpAbs = `${dstAbs}.copying-${ts}`
    try {
      const buf = readFileSync(srcAbs)
      const got = sha256Of(buf)
      if (got !== f.sha256) {
        failures.push(`${f.rel}: 源内容与计划快照不一致(sha256 漂移)`)
        continue
      }
      mkdirSync(join(dstAbs, '..'), { recursive: true })
      writeFileSync(tmpAbs, buf)
      if (sha256Of(readFileSync(tmpAbs)) !== f.sha256) {
        failures.push(`${f.rel}: 临时文件校验不过`)
        continue
      }
      renameSync(tmpAbs, dstAbs)
      placed.push(f)
    } catch (err) {
      failures.push(`${f.rel}: ${(err as Error).message}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `备份未完成: ${failures.length} 个文件失败(已成功 ${placed.length} 个保留在目的地,可重跑补齐):\n` +
        failures.slice(0, 10).join('\n'),
    )
  }
  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    source: { sessionsRoot: sourceRoots.sessionsRoot, projectsRoot: sourceRoots.projectsRoot },
    files: plan.files,
  }
  writeFileSync(join(plan.destDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

/** 从 rel 反推源绝对路径(与 collectFilesUnder 的收集顺序一致) */
export function relToSourceAbs(rel: string, sessionsRoot: string, projectsRoot: string): string {
  return rel.startsWith('workspace/')
    ? join(sessionsRoot, rel.slice('workspace/'.length))
    : join(projectsRoot, rel)
}

function computePlanForCli(now: Date, destArg?: string): BackupPlan {
  const home = homedir()
  return computeBackupPlan(
    join(home, '.workbuddy', 'workspace', 'sessions'),
    join(home, '.workbuddy', 'projects'),
    now,
    destArg,
  )
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const apply = argv.includes('--apply')
  const destIdx = argv.indexOf('--dest')
  const destArg = destIdx >= 0 ? argv[destIdx + 1] : undefined
  try {
    const plan = computePlanForCli(new Date(), destArg)
    if (!apply) {
      console.log(formatPlan(plan, true))
      console.log('\n(dry-run;未写入任何路径。确认后加 --apply 执行)')
      return 0
    }
    const manifest = applyBackup(plan, {
      sessionsRoot: plan.sessionsRoot,
      projectsRoot: plan.projectsRoot,
    })
    console.log(
      `备份完成: ${manifest.files.length} 个文件,共 ${plan.totalBytes} 字节 → ${plan.destDir}\nmanifest.json 已写入(含逐文件 sha256,恢复腿将按它校验)`,
    )
    return 0
  } catch (err) {
    console.error(`会话备份失败: ${(err as Error).message}`)
    return 1
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
