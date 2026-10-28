// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay:ide-switch —— Trae / Trae Solo / Qoder 桌面端本机登录态一键切换(⑧第二腿)。
 *
 * ⚠ 本文件自 2026-10-27 起是**兼容门面**:真正的引擎在 relay-switch-core.ts
 *   (通用「客户端登录态切换」引擎),内置目标注册表在 relay-switch-profiles.ts。
 *   本文件保留**全部历史导出与 CLI 行为**(既有测试零改动通过),
 *   内部改为委托 core;新增能力走新的统一入口 relay-switch.ts。
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
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'

import {
  applySwitch as applyCoreSwitch,
  assertNoSecretLeak as assertNoSecretLeakCore,
  captureCurrent as captureCoreCurrent,
  listSnapshots as listCoreSnapshots,
  planSwitch as planCoreSwitch,
  readCurrentState as readCoreCurrentState,
  resolveBaseDir as resolveCoreBaseDir,
  type CurrentState,
  type SnapshotInfo,
  type SwitchHintMode,
  type SwitchPaths,
  type SwitchTarget,
  type SwitchTargetKind,
} from './relay-switch-core.js'
import { resolveTargets } from './relay-switch-profiles.js'

export type { CurrentState, SnapshotInfo }

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
  /** 目标形态(兼容扩展,缺省 ide) */
  kind?: SwitchTargetKind
  /** 命中口径(兼容扩展;缺省按内置注册表推断,再缺省 content-scan) */
  hintMode?: SwitchHintMode
  /** 切换前是否须关闭客户端(兼容扩展,缺省 true) */
  requiresStoppedApp?: boolean
  /** 人读提示(兼容扩展) */
  notes?: string[]
  /** 旁证文件(兼容扩展,只探测不替换) */
  auxFiles?: string[]
}

export interface IdeSwitchPaths {
  profile: IdeProfile
  snapDir: string
}

export interface IdeSwitchPlan {
  ide: IdeId
  targetName: string
  targetDir: string
  /** 切换前当前态的自动备份落点(pre-switch 快照) */
  preSwitchBackupDir: string
  warnings: string[]
}

export interface IdeSwitchApplyResult {
  ok: boolean
  preSwitchBackupDir?: string
  newSha12s?: Record<string, string>
  error?: string
}

/**
 * 命中口径推断:历史行为等价于「id === 'qoder' ⇒ file-count,否则 content-scan」。
 * 引擎侧已泛化为配置(hintMode),此处只保留兼容层推断,行为与历史逐字一致。
 */
function hintModeOf(profile: IdeProfile): SwitchHintMode {
  if (profile.hintMode) return profile.hintMode
  const builtin = resolveTargets().find((t) => t.id === profile.id)
  return builtin?.hintMode ?? 'content-scan'
}

/** 兼容层:历史 IdeProfile ⇒ 引擎 SwitchTarget */
function toTarget(profile: IdeProfile): SwitchTarget {
  return {
    id: profile.id,
    label: profile.label,
    kind: profile.kind ?? 'ide',
    baseDirCandidates: profile.baseDirCandidates,
    files: profile.files,
    snapRoot: profile.snapRoot,
    loginHints: profile.loginHints,
    hintMode: hintModeOf(profile),
    requiresStoppedApp: profile.requiresStoppedApp ?? true,
    ...(profile.notes ? { notes: profile.notes } : {}),
    ...(profile.auxFiles ? { auxFiles: profile.auxFiles } : {}),
  }
}

/** 兼容层:历史 IdeSwitchPaths ⇒ 引擎 SwitchPaths */
function toPaths(paths: IdeSwitchPaths): SwitchPaths {
  return { target: toTarget(paths.profile), snapDir: paths.snapDir }
}

export function resolveProfiles(home = homedir()): Record<IdeId, IdeProfile> {
  const out = {} as Record<IdeId, IdeProfile>
  for (const target of resolveTargets(home)) {
    if (target.id !== 'trae' && target.id !== 'trae-solo' && target.id !== 'qoder') continue
    out[target.id] = {
      id: target.id,
      label: target.label,
      baseDirCandidates: target.baseDirCandidates,
      files: target.files,
      snapRoot: target.snapRoot,
      loginHints: target.loginHints,
      kind: target.kind,
      hintMode: target.hintMode,
      requiresStoppedApp: target.requiresStoppedApp,
      ...(target.notes ? { notes: target.notes } : {}),
    }
  }
  return out
}

/** 解析生效基址:主文件在哪个候选下存在用哪个;全不存在退回首个候选 */
export function resolveBaseDir(profile: IdeProfile): string {
  return resolveCoreBaseDir(toTarget(profile))
}

export function readCurrentState(profile: IdeProfile): CurrentState {
  return readCoreCurrentState(toTarget(profile))
}

export function listSnapshots(paths: IdeSwitchPaths): SnapshotInfo[] {
  return listCoreSnapshots(toPaths(paths))
}

/** 把当前登录态捕获为命名快照(capture 语义:先备份再登记) */
export function captureCurrent(
  paths: IdeSwitchPaths,
  name: string,
): { ok: boolean; snapshotDir?: string; error?: string } {
  return captureCoreCurrent(toPaths(paths), name)
}

/** 生成切换计划(纯函数不落盘);目标与当前逐文件相同拒绝 */
export function planIdeSwitch(
  paths: IdeSwitchPaths,
  targetName: string,
  now = new Date(),
): IdeSwitchPlan {
  const plan = planCoreSwitch(toPaths(paths), targetName, now)
  return {
    ide: paths.profile.id,
    targetName: plan.targetName,
    targetDir: plan.targetDir,
    preSwitchBackupDir: plan.preSwitchBackupDir,
    warnings: plan.warnings,
  }
}

/** 执行切换:先整集备份当前 → 目标集逐文件临时名拷贝 → 逐文件改名 → sha256 全量对账 */
export function applyIdeSwitch(paths: IdeSwitchPaths, plan: IdeSwitchPlan): IdeSwitchApplyResult {
  return applyCoreSwitch(toPaths(paths), {
    targetId: plan.ide,
    targetName: plan.targetName,
    targetDir: plan.targetDir,
    preSwitchBackupDir: plan.preSwitchBackupDir,
    warnings: plan.warnings,
  })
}

export function assertNoSecretLeak(lines: string[], secrets: string[]): void {
  assertNoSecretLeakCore(lines, secrets)
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
    const ids = Object.keys(profiles) as IdeId[]
    lines.push(
      `用法: relay:ide-switch --ide <${ids.join('|')}> [list | capture --name X | --to X [--apply]]`,
    )
    lines.push(`本机 ${ids.length} profile 现状:`)
    for (const id of ids) {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
