// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-switch —— 「本机客户端登录态一键切换」的**统一入口**(通用引擎 CLI)。
 *
 * 与 relay-ide-switch.ts 的关系:
 *  - relay-switch-core.ts     = 引擎(不认识任何具体客户端)
 *  - relay-switch-profiles.ts = 内置目标注册表(路径/形态/命中口径/一致性规则)
 *  - relay-ide-switch.ts      = 历史 IDE 专属入口,现已改为兼容门面(行为不变)
 *  - **本文件** = 面向人的统一 CLI:内置目标 + 用户自定义目标(~/.wb-switch/switch-profiles/*.json)
 *    一条命令切号,不再按客户端各写一套脚本。
 *
 * 命令:
 *   relay-switch list                                列出全部目标现状(未装/未支持如实标)
 *   relay-switch targets                             列出目标定义(路径/形态/是否支持,零凭据)
 *   relay-switch capture --target <id> --name <名>    把当前登录态登记为命名快照
 *   relay-switch --target <id> --to <快照名> [--apply]  切到指定快照(默认 dry-run)
 *
 * 红线(与 relay:switch-account / relay:ide-switch 同款):
 *  - 默认 dry-run;只有 capture 与 --apply 才写盘;
 *  - 写盘前自动备份当前态(pre-switch 快照,可逆闭环);
 *  - 临时名 → rename → 逐文件 sha256 对账;
 *  - 输出零凭据回显:只报命中数与 sha12,过 assertNoSecretLeak 守卫;
 *  - supported === false 的目标(list 如实标注,写操作直接拒绝并说明原因)。
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  assertNoSecretLeak,
  applySwitch,
  captureCurrent,
  collectSecretLiterals,
  listSnapshots,
  loadExternalTargets,
  planSwitch,
  readCurrentState,
  resolveBaseDir,
  type ExternalTargetError,
  type SwitchPaths,
  type SwitchPlan,
  type SwitchTarget,
} from './relay-switch-core.js'
import { resolveTargets } from './relay-switch-profiles.js'

/** CLI 运行参数注入面(测试用临时目录;实机走默认值) */
export interface RelaySwitchOptions {
  /** 用户主目录(默认 homedir()) */
  home?: string
  /** 外部 profile 目录(默认 <home>/.wb-switch/switch-profiles) */
  profileDir?: string
  /** APPDATA 覆盖(默认按环境变量探测;测试注入临时目录以免碰真实 AppData) */
  appDataRoaming?: string
  /** 目标全集覆盖(测试直接喂临时目录下的目标,完全绕开本机路径) */
  targets?: SwitchTarget[]
}

/** 目标总目录(内置 + 外部) */
export interface CatalogResult {
  /** 全部目标(内置在前,外部在后) */
  targets: SwitchTarget[]
  /** 外部 profile 被跳过的文件及原因(逐条如实报) */
  errors: ExternalTargetError[]
  /** 内置目标数 */
  builtinCount: number
  /** 外部目标数(通过校验的) */
  externalCount: number
}

/** 外部 profile 默认目录 */
export function defaultProfileDir(home: string): string {
  return join(home, '.wb-switch', 'switch-profiles')
}

/**
 * 装载目标总目录:内置目标 + 外部自定义目标。
 *
 *  - 外部 profile **只当数据读**(JSON.parse),绝不执行其中任何内容;
 *  - 外部 id 与内置冲突 ⇒ 外部跳过并如实报错(不覆盖内置);
 *  - 外部文件非法 ⇒ 逐条跳过并报错,整体不崩。
 */
export function loadCatalog(options: RelaySwitchOptions = {}): CatalogResult {
  const home = options.home ?? homedir()
  if (options.targets) {
    return {
      targets: options.targets,
      errors: [],
      builtinCount: 0,
      externalCount: options.targets.length,
    }
  }
  const builtin = resolveTargets(home, options.appDataRoaming)
  const profileDir = options.profileDir ?? defaultProfileDir(home)
  const external = loadExternalTargets(profileDir, { reservedIds: builtin.map((t) => t.id) })
  return {
    targets: [...builtin, ...external.targets],
    errors: external.errors,
    builtinCount: builtin.length,
    externalCount: external.targets.length,
  }
}

function findTarget(targets: SwitchTarget[], id: string): SwitchTarget | undefined {
  return targets.find((t) => t.id === id)
}

function pathsOf(target: SwitchTarget): SwitchPaths {
  return { target, snapDir: target.snapRoot }
}

/** 目标当前态的一行摘要(零凭据:只有命中数与文件集状态) */
export function fmtState(target: SwitchTarget): string {
  const st = readCurrentState(target)
  const base = resolveBaseDir(target)
  const unsupported =
    target.supported === false
      ? `未支持(${target.unsupportedReason ?? '未实现'})`
      : st.installed
        ? st.complete
          ? '文件集完整'
          : `缺:${st.missingFiles.join(',')}`
        : '未检测到'
  const head = `${target.id}(${target.label}) [${target.kind}] ${unsupported}`
  if (!st.installed) return `${head}  基址=${base}`
  const aux = st.auxPresent?.length ? `  旁证文件命中=${st.auxPresent.length}` : ''
  const coh = target.coherence
    ? `  一致性=${st.coherenceOk ? '通过' : `不通过(${st.coherenceDetail ?? '?'})`}`
    : ''
  const mtime = st.modifiedAt?.slice(0, 16).replace('T', ' ') ?? '?'
  return `${head}  登录特征命中=${st.hintHits}  mtime=${mtime}${aux}${coh}`
}

/** 目标定义的一行摘要(路径/形态/命中口径/是否支持;零凭据) */
export function fmtDefinition(target: SwitchTarget): string {
  const base = resolveBaseDir(target)
  const support =
    target.supported === false ? `未支持(${target.unsupportedReason ?? '未实现'})` : '支持'
  const aux = [...new Set(target.auxFiles ?? [])]
  const auxLine = aux.length ? `  旁证=${aux.join(' | ')}(只探测,不参与替换)` : ''
  const notes = (target.notes ?? []).map((n) => `    · ${n}`).join('\n')
  return (
    `${target.id}(${target.label})\n` +
    `    kind=${target.kind}  hintMode=${target.hintMode}  需关闭客户端=${target.requiresStoppedApp === false ? '否' : '是'}  ${support}\n` +
    `    基址=${base}\n` +
    `    文件集=${target.files.join(', ')}\n` +
    `    快照根=${target.snapRoot}${auxLine}\n` +
    (notes ? `${notes}\n` : '')
  )
}

/** 收集目标当前文件里的"疑似凭据字面量",供输出前过零泄漏守卫 */
function secretsOf(targets: SwitchTarget[]): string[] {
  const out: string[] = []
  for (const t of targets) {
    const base = resolveBaseDir(t)
    out.push(...collectSecretLiterals(t, base, [base, t.snapRoot]))
  }
  return out
}

/**
 * 打印前过零泄漏守卫:命中敏感串则**不打印**任何一行,并在 stderr 如实报出阻断原因。
 * (守卫是最后一闸;宁可整段不输出,也不漏一个字符。)
 */
function emit(lines: string[], secrets: string[]): boolean {
  try {
    assertNoSecretLeak(lines, secrets)
  } catch (e) {
    console.error(`输出已被零泄漏守卫阻断:${e instanceof Error ? e.message : String(e)}`)
    return false
  }
  console.log(lines.join('\n'))
  return true
}

function usage(ids: string[]): string {
  return [
    '用法:',
    '  relay-switch list                                   列出全部目标现状',
    '  relay-switch targets                                列出目标定义(路径/形态/是否支持)',
    '  relay-switch capture --target <id> --name <快照名>   登记当前登录态为快照',
    '  relay-switch --target <id> --to <快照名> [--apply]    切到指定快照(默认 dry-run)',
    `可用目标: ${ids.join(' | ') || '(无)'}`,
  ].join('\n')
}

function argValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag)
  if (idx === -1) return undefined
  return argv[idx + 1]
}

/**
 * CLI 主体。
 *
 * 退出码:0 成功 / 1 执行失败(捕获、切换、写盘对账失败)/ 2 用法或目标错误。
 */
export function main(argv: string[], options: RelaySwitchOptions = {}): number {
  const catalog = loadCatalog(options)
  const targets = catalog.targets
  const ids = targets.map((t) => t.id)
  const lines: string[] = []

  // 外部 profile 的加载错误:如实列出(不阻断其他目标)
  const errorLines = catalog.errors.map((e) => `  ⚠ 外部 profile 跳过 ${e.file}: ${e.error}`)

  const cmd = argv[0]

  if (cmd === 'targets') {
    lines.push(`目标定义(内置 ${catalog.builtinCount} + 外部 ${catalog.externalCount}):`)
    for (const t of targets) lines.push(fmtDefinition(t))
    if (errorLines.length) {
      lines.push('外部 profile 装载问题:')
      lines.push(...errorLines)
    }
    return emit(lines, secretsOf(targets)) ? 0 : 1
  }

  if (cmd === 'list') {
    lines.push(`目标现状(内置 ${catalog.builtinCount} + 外部 ${catalog.externalCount}):`)
    for (const t of targets) lines.push('  ' + fmtState(t))
    if (errorLines.length) {
      lines.push('外部 profile 装载问题:')
      lines.push(...errorLines)
    }
    return emit(lines, secretsOf(targets)) ? 0 : 1
  }

  if (cmd === 'capture') {
    const targetId = argValue(argv, '--target')
    const name = argValue(argv, '--name')
    if (!targetId || !name) {
      console.error('capture 需要 --target <id> --name <快照名>')
      return 2
    }
    const target = findTarget(targets, targetId)
    if (!target) {
      console.error(`未知 --target: ${targetId}(可用: ${ids.join(' | ')})`)
      return 2
    }
    if (target.supported === false) {
      console.error(`目标未支持:${target.unsupportedReason ?? '未实现'}(${target.label})`)
      return 2
    }
    const out = captureCurrent(pathsOf(target), name)
    if (!out.ok) {
      console.error(`capture 失败: ${out.error}`)
      return 1
    }
    lines.push(`✅ 已登记当前登录态为快照 "${name}": ${out.snapshotDir}`)
    return emit(lines, secretsOf([target])) ? 0 : 1
  }

  const targetId = argValue(argv, '--target')
  if (!targetId) {
    console.log(usage(ids))
    if (errorLines.length) {
      console.log('外部 profile 装载问题:')
      console.log(errorLines.join('\n'))
    }
    return 0
  }
  const target = findTarget(targets, targetId)
  if (!target) {
    console.error(`未知 --target: ${targetId}(可用: ${ids.join(' | ')})`)
    return 2
  }
  if (target.supported === false) {
    console.error(`目标未支持:${target.unsupportedReason ?? '未实现'}(${target.label})`)
    return 2
  }

  const paths = pathsOf(target)
  const toName = argValue(argv, '--to')
  if (!toName) {
    lines.push(`当前(${target.label}): ${fmtState(target)}`)
    const snaps = listSnapshots(paths)
    lines.push(`快照库: ${paths.snapDir}(${snaps.length} 份)`)
    for (const s of snaps) {
      const captured = s.capturedAt.slice(0, 16).replace('T', ' ')
      lines.push(`  ${s.name}  捕获于=${captured}${s.sameAsCurrent ? '  ←=当前' : ''}`)
    }
    lines.push('切换: --to <快照名> [--apply];登记: capture --name <名>')
    return emit(lines, secretsOf([target])) ? 0 : 1
  }

  let plan: SwitchPlan
  try {
    plan = planSwitch(paths, toName)
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
  lines.push(`计划(${target.label}): ${plan.targetDir} → ${resolveBaseDir(target)}`)
  lines.push(`  当前态自动备份 → ${plan.preSwitchBackupDir}`)
  lines.push(...plan.warnings.map((w) => `  ⚠ ${w}`))
  if (!argv.includes('--apply')) {
    lines.push('(dry-run,未写盘;确认后加 --apply)')
    return emit(lines, secretsOf([target])) ? 0 : 1
  }
  const out = applySwitch(paths, plan)
  if (!out.ok) {
    console.error(`切换失败: ${out.error}`)
    return 1
  }
  const tail =
    target.requiresStoppedApp === false ? '配置类目标,无需重启客户端' : `请重启 ${target.label}`
  lines.push(`✅ 已切换;pre-switch 备份: ${out.preSwitchBackupDir};${tail}`)
  return emit(lines, secretsOf([target])) ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
