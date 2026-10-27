/**
 * relay:ide-switch —— Trae / Trae Solo / Qoder 桌面端本机登录态一键切换(⑧第二腿)。
 *
 * 模型(2026-10-27 本机一手取证,全文见 PROJECT_PLAN ⑧行与工作区日志):
 *  - Trae CN / TRAE SOLO CN(VSCode fork):登录态存 User/globalStorage/storage.json 的
 *    iCubeAuthInfo://* 键(非 JSON 串,776~2484B);同目录存在多个 storage.json.traereset_bak_*
 *    ⇒ 官方重置登录就是换这个文件,整文件交换即切账号;
 *  - Qoder CN:认证是四件套文件集(Roaming/com.qodercn.app.stable/ 下 auth.v1.dat[加密凭据] +
 *    auth.machine-id + .auth/machine_id + auth-profile-overlays.v1.dat);目录内有
 *    .credential-transaction 空标记 ⇒ 官方本身按事务性写入设计;快照必须整集捕获整集恢复。
 *
 * 红线(与 relay:switch-account 同款):默认 dry-run;capture/--apply 才写盘;
 * 切换/捕获前当前态自动备份(pre-switch 快照,可逆闭环);临时名+改名+逐文件 sha256 对账;
 * 输出零凭据内容回显。快照格式:<snapDir>/<ide>/<name>/ 存原文件集 + meta.json。
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export type IdeId = 'trae' | 'trae-solo' | 'qoder'

export interface IdeProfile {
  id: IdeId
  /** 展示名 */
  label: string
  /** 登录态候选基址组(主文件在哪个候选下存在就用哪个;全不存在用首个) */
  baseDirCandidates: string[]
  /** 构成登录态的相对文件集(全部存在才算完整) */
  files: string[]
  /** 快照根目录 */
  snapRoot: string
  /** 判定当前登录态"已登录"的观察键(只报有无,不报值) */
  loginHints: string[]
}

export interface IdeSwitchPaths {
  profile: IdeProfile
  snapDir: string
}

const sha256 = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex')

/** 双候选环境根:APPDATA 在沙盒可能被重定向;目录级候选交给 baseDirCandidates 按主文件存在性挑 */
function firstExisting(candidates: string[]): string {
  return candidates.find((c) => c && existsSync(c)) ?? candidates.find((c) => c) ?? ''
}

export function resolveProfiles(home = homedir()): Record<IdeId, IdeProfile> {
  const appDataRoaming = firstExisting([
    process.env['APPDATA'] ?? '',
    join(home, 'AppData', 'Roaming'),
  ])
  const snapBase = join(home, '.wb-switch', 'backups', 'ide')
  return {
    trae: {
      id: 'trae',
      label: 'Trae CN',
      baseDirCandidates: [
        join(appDataRoaming, 'Trae CN', 'User', 'globalStorage'),
        join(home, 'AppData', 'Roaming', 'Trae CN', 'User', 'globalStorage'),
      ],
      files: ['storage.json'],
      snapRoot: join(snapBase, 'trae'),
      loginHints: ['iCubeAuthInfo://icube.cloudide', 'iCubeAuthInfo://usertag'],
    },
    'trae-solo': {
      id: 'trae-solo',
      label: 'TRAE SOLO CN',
      baseDirCandidates: [
        join(appDataRoaming, 'TRAE SOLO CN', 'User', 'globalStorage'),
        join(home, 'AppData', 'Roaming', 'TRAE SOLO CN', 'User', 'globalStorage'),
      ],
      files: ['storage.json'],
      snapRoot: join(snapBase, 'trae-solo'),
      loginHints: ['iCubeAuthInfo://icube.cloudide', 'iCubeAuthInfo://usertag'],
    },
    qoder: {
      id: 'qoder',
      label: 'Qoder CN',
      baseDirCandidates: [appDataRoaming, join(home, 'AppData', 'Roaming')].map((root) =>
        join(root, 'com.qodercn.app.stable'),
      ),
      files: [
        'auth.v1.dat',
        'auth.machine-id',
        join('.auth', 'machine_id'),
        'auth-profile-overlays.v1.dat',
      ],
      snapRoot: join(snapBase, 'qoder'),
      loginHints: ['auth.v1.dat'],
    },
  }
}

/** 解析生效基址:主文件在哪个候选下存在用哪个;全不存在退回首个候选 */
export function resolveBaseDir(profile: IdeProfile): string {
  const mainRel = profile.files[0]!
  for (const c of profile.baseDirCandidates) {
    if (existsSync(join(c, mainRel))) return c
  }
  return profile.baseDirCandidates[0]!
}

/** 登录态完整性:全部文件在且可读 ⇒ complete;缺哪些如实报 */
export interface CurrentState {
  installed: boolean
  complete: boolean
  missingFiles: string[]
  /** 每文件的 sha12(审计用,非敏感) */
  sha12s: Record<string, string>
  /** loginHints 命中数(trae: storage.json 内键命中;qoder: 等于文件存在数) */
  hintHits: number
  modifiedAt?: string
}

export function readCurrentState(profile: IdeProfile): CurrentState {
  const sha12s: Record<string, string> = {}
  const missingFiles: string[] = []
  let hintHits = 0
  let newest: string | undefined
  for (const rel of profile.files) {
    const abs = join(resolveBaseDir(profile), rel)
    if (!existsSync(abs)) {
      missingFiles.push(rel)
      continue
    }
    sha12s[rel] = sha256(abs).slice(0, 12)
    const m = statSync(abs).mtime.toISOString()
    if (!newest || m > newest) newest = m
    if (profile.id === 'qoder') hintHits += 1
  }
  if (profile.id !== 'qoder') {
    const mainFile = join(resolveBaseDir(profile), profile.files[0]!)
    if (existsSync(mainFile)) {
      try {
        const text = readFileSync(mainFile, 'utf8')
        hintHits = profile.loginHints.filter((h) => text.includes(h)).length
      } catch {
        hintHits = 0
      }
    }
  }
  const probe = join(resolveBaseDir(profile), profile.files[0]!)
  return {
    installed: existsSync(probe),
    complete: missingFiles.length === 0,
    missingFiles,
    sha12s,
    hintHits,
    ...(newest ? { modifiedAt: newest } : {}),
  }
}

export interface SnapshotInfo {
  name: string
  path: string
  capturedAt: string
  /** 每文件 sha12,与当前逐一比对得出 */
  sha12s: Record<string, string>
  /** 相对当前登录态:全部一致 ⇒ true */
  sameAsCurrent: boolean
}

export function listSnapshots(paths: IdeSwitchPaths): SnapshotInfo[] {
  const out: SnapshotInfo[] = []
  if (!existsSync(paths.snapDir)) return out
  const current = readCurrentState(paths.profile)
  for (const name of readdirSync(paths.snapDir).sort()) {
    const dir = join(paths.snapDir, name)
    const metaPath = join(dir, 'meta.json')
    if (!existsSync(metaPath)) continue // 非()快照目录(半写残留)忽略
    let meta: { capturedAt?: string; sha256s?: Record<string, string> }
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    } catch {
      continue
    }
    const sha12s: Record<string, string> = {}
    let allSame = true
    for (const rel of paths.profile.files) {
      const abs = join(dir, rel)
      if (!existsSync(abs)) {
        allSame = false
        continue
      }
      const s = sha256(abs).slice(0, 12)
      sha12s[rel] = s
      if (current.sha12s[rel] !== s) allSame = false
    }
    out.push({
      name,
      path: dir,
      capturedAt: meta.capturedAt ?? '?',
      sha12s,
      sameAsCurrent: allSame && Object.keys(sha12s).length === paths.profile.files.length,
    })
  }
  return out
}

function writeSnapshotContent(paths: IdeSwitchPaths, snapDir: string): void {
  mkdirSync(snapDir, { recursive: true })
  const sha256s: Record<string, string> = {}
  for (const rel of paths.profile.files) {
    const src = join(resolveBaseDir(paths.profile), rel)
    if (!existsSync(src)) continue // 缺失文件记录为缺失,恢复时跳过
    const dest = join(snapDir, rel)
    mkdirSync(dest.replace(/[^/\\]+$/, ''), { recursive: true })
    copyFileSync(src, dest)
    sha256s[rel] = sha256(src)
  }
  writeFileSyncAtomic(
    join(snapDir, 'meta.json'),
    JSON.stringify(
      { capturedAt: new Date().toISOString(), sha256s, ide: paths.profile.id },
      null,
      2,
    ),
  )
}

function writeFileSyncAtomic(dest: string, content: string): void {
  const tmp = `${dest}.tmp-${Date.now()}`
  writeFileSync(tmp, content)
  renameSync(tmp, dest)
}

/** 把当前登录态捕获为命名快照(capture 语义:先备份再登记) */
export function captureCurrent(
  paths: IdeSwitchPaths,
  name: string,
): { ok: boolean; snapshotDir?: string; error?: string } {
  try {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
      return { ok: false, error: '快照名只允许字母数字._-,1~64 位' }
    }
    const current = readCurrentState(paths.profile)
    if (!current.installed)
      return {
        ok: false,
        error: `未检测到 ${paths.profile.label} 登录态文件(${resolveBaseDir(paths.profile)})`,
      }
    if (!current.complete)
      return { ok: false, error: `登录态文件集不完整,缺: ${current.missingFiles.join(', ')}` }
    const snapDir = join(paths.snapDir, name)
    if (existsSync(snapDir)) return { ok: false, error: `快照已存在: ${name}(先删或换名)` }
    writeSnapshotContent(paths, snapDir)
    return { ok: true, snapshotDir: snapDir }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export interface IdeSwitchPlan {
  ide: IdeId
  targetName: string
  targetDir: string
  /** 切换前当前态的自动备份落点(pre-switch 快照) */
  preSwitchBackupDir: string
  warnings: string[]
}

/** 生成切换计划(纯函数不落盘);目标与当前逐文件相同拒绝 */
export function planIdeSwitch(
  paths: IdeSwitchPaths,
  targetName: string,
  now = new Date(),
): IdeSwitchPlan {
  const snaps = listSnapshots(paths)
  const target = snaps.find((s) => s.name === targetName)
  if (!target) {
    const known = snaps.map((s) => s.name).join(', ') || '(快照库为空,先 capture 登记)'
    throw new Error(`快照不存在: ${targetName}。可用: ${known}`)
  }
  const current = readCurrentState(paths.profile)
  if (!current.installed)
    throw new Error(`未检测到当前登录态文件(${resolveBaseDir(paths.profile)})`)
  const targetMissing = paths.profile.files.filter((rel) => !existsSync(join(target.path, rel)))
  if (targetMissing.length > 0)
    throw new Error(`目标快照文件集不完整,缺: ${targetMissing.join(', ')}`)
  if (
    current.complete &&
    paths.profile.files.every((rel) => current.sha12s[rel] === target.sha12s[rel])
  ) {
    throw new Error('目标与当前登录态逐字节相同,无需切换')
  }
  const warnings = [
    `切换前请关闭 ${paths.profile.label}(运行中切换可能在客户端退出时被覆盖)`,
    '当前登录态将自动备份为 pre-switch 快照,切回即恢复',
    '目标快照的凭据绑定在本机 machine-id 上时跨机不可用(同机切换不受影响)',
  ]
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T')
  return {
    ide: paths.profile.id,
    targetName,
    targetDir: target.path,
    preSwitchBackupDir: join(paths.snapDir, `pre-switch-${stamp}Z`),
    warnings,
  }
}

export interface IdeSwitchApplyResult {
  ok: boolean
  preSwitchBackupDir?: string
  newSha12s?: Record<string, string>
  error?: string
}

/** 执行切换:先整集备份当前 → 目标集逐文件临时名拷贝 → 逐文件改名 → sha256 全量对账 */
export function applyIdeSwitch(paths: IdeSwitchPaths, plan: IdeSwitchPlan): IdeSwitchApplyResult {
  try {
    writeSnapshotContent(paths, plan.preSwitchBackupDir) // 备份当前(先于一切写)
    const temps: Array<{ tmp: string; dest: string; want: string }> = []
    for (const rel of paths.profile.files) {
      const src = join(plan.targetDir, rel)
      if (!existsSync(src)) continue
      const dest = join(resolveBaseDir(paths.profile), rel)
      mkdirSync(dest.replace(/[^/\\]+$/, ''), { recursive: true })
      const tmp = `${dest}.switching-${Date.now()}.tmp`
      copyFileSync(src, tmp)
      temps.push({ tmp, dest, want: sha256(src) })
    }
    for (const t of temps) renameSync(t.tmp, t.dest)
    const newSha12s: Record<string, string> = {}
    for (const t of temps) {
      const got = sha256(t.dest)
      if (got !== t.want)
        return {
          ok: false,
          error: `写后校验失败: ${t.dest}(pre-switch 备份在 ${plan.preSwitchBackupDir})`,
        }
      newSha12s[t.dest] = got.slice(0, 12)
    }
    return { ok: true, preSwitchBackupDir: plan.preSwitchBackupDir, newSha12s }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 输出脱敏守卫:lines 不得包含任一 secrets(≥12 位才判) */
export function assertNoSecretLeak(lines: string[], secrets: string[]): void {
  for (const line of lines) {
    for (const s of secrets) {
      if (s.length >= 12 && line.includes(s)) {
        throw new Error(`输出泄漏敏感串(前4位 ${s.slice(0, 4)}…),已阻断`)
      }
    }
  }
}

function fmtState(ide: IdeId, label: string, st: CurrentState): string {
  const head = st.installed ? `${ide}(${label})` : `${ide}(${label}) 未检测到`
  if (!st.installed) return head
  const comp = st.complete ? '文件集完整' : `缺:${st.missingFiles.join(',')}`
  return `${head}  ${comp}  登录特征命中=${st.hintHits}  mtime=${st.modifiedAt?.slice(0, 16).replace('T', ' ') ?? '?'}`
}

export function main(argv: string[], profilesOverride?: Record<IdeId, IdeProfile>): number {
  const profiles = profilesOverride ?? resolveProfiles()
  const ideArg = argv.includes('--ide') ? argv[argv.indexOf('--ide') + 1] : undefined
  const lines: string[] = []

  if (!ideArg) {
    lines.push(
      '用法: relay:ide-switch --ide <trae|trae-solo|qoder> [list | capture --name X | --to X [--apply]]',
    )
    lines.push('本机三 profile 现状:')
    for (const id of Object.keys(profiles) as IdeId[]) {
      lines.push('  ' + fmtState(id, profiles[id]!.label, readCurrentState(profiles[id]!)))
    }
    console.log(lines.join('\n'))
    return 0
  }
  const profile = profiles[ideArg as IdeId]
  if (!profile) {
    console.error(`未知 --ide: ${ideArg}(可用: ${Object.keys(profiles).join('|')})`)
    return 2
  }
  const paths: IdeSwitchPaths = { profile, snapDir: profile.snapRoot }

  const capIdx = argv.indexOf('capture')
  if (capIdx !== -1) {
    const nameIdx = argv.indexOf('--name')
    const name = nameIdx !== -1 ? argv[nameIdx + 1] : undefined
    if (!name) {
      console.error('capture 需要 --name <快照名>')
      return 2
    }
    const out = captureCurrent(paths, name)
    if (!out.ok) {
      console.error(`capture 失败: ${out.error}`)
      return 1
    }
    console.log(`✅ 已登记当前登录态为快照 "${name}": ${out.snapshotDir}`)
    return 0
  }

  const toIdx = argv.indexOf('--to')
  if (toIdx === -1) {
    const current = readCurrentState(profile)
    lines.push(`当前(${profile.label}): ${fmtState(profile.id, profile.label, current)}`)
    const snaps = listSnapshots(paths)
    lines.push(`快照库: ${paths.snapDir}(${snaps.length} 份)`)
    for (const s of snaps) {
      lines.push(
        `  ${s.name}  捕获于=${s.capturedAt.slice(0, 16).replace('T', ' ')}${s.sameAsCurrent ? '  ←=当前' : ''}`,
      )
    }
    lines.push('切换: --to <快照名> [--apply];登记: capture --name <名>')
    console.log(lines.join('\n'))
    return 0
  }

  const targetName = argv[toIdx + 1]
  if (!targetName) {
    console.error('--to 需要快照名')
    return 2
  }
  let plan: IdeSwitchPlan
  try {
    plan = planIdeSwitch(paths, targetName)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
  lines.push(`计划(${profile.label}): ${plan.targetDir} → ${resolveBaseDir(profile)}`)
  lines.push(`  当前态自动备份 → ${plan.preSwitchBackupDir}`)
  lines.push(...plan.warnings.map((w) => `  ⚠ ${w}`))
  if (!argv.includes('--apply')) {
    lines.push('(dry-run,未写盘;确认后加 --apply)')
    console.log(lines.join('\n'))
    return 0
  }
  const out = applyIdeSwitch(paths, plan)
  if (!out.ok) {
    console.error(`切换失败: ${out.error}`)
    return 1
  }
  lines.push(`✅ 已切换;pre-switch 备份: ${out.preSwitchBackupDir};请重启 ${profile.label}`)
  console.log(lines.join('\n'))
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
