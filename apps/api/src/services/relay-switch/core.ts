// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-switch-core —— 本机客户端登录态切换的**通用引擎**。
 *
 * 模型(2026-10-27 本机一手取证):
 *  - 桌面端登录态 = 一组文件(单文件或多文件集),切账号 = 整组换文件;
 *  - 文件组形态分两类:
 *      · content-scan:登录特征键只存在于主文件**文本**里(trae/minimax/zcode/…),
 *        判定靠"主文件里能不能搜到特征键";
 *      · file-count:登录特征键本身**就是文件名**(qoder 的 auth.v1.dat),
 *        文件存在即命中,不读内容;
 *  - 一致性规则(coherence):某些客户端的登录态由多份文件共同构成,各份必须携带
 *    同一个"世代号"(minimax 的 auth.json / auth-state.json 的 generation),
 *    不一致即半切换态 ⇒ 计划阶段直接拒绝(详见 checkCoherence)。
 *
 * 红线(与 relay:switch-account / relay:ide-switch 同款):默认 dry-run;capture/--apply
 * 才写盘;切换/捕获前当前态自动备份(pre-switch 快照,可逆闭环);临时名+改名+逐文件
 * sha256 对账;输出零凭据内容回显。
 *
 * 本文件只管**引擎**:不认识任何具体客户端(内置目标表在 ./profiles.ts,
 * 用户自定义目标从 ~/.wb-switch/switch-profiles/*.json 读)。
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
import { isAbsolute, join } from 'node:path'

/** 目标标识(通用:string,不再限定枚举) */
export type SwitchTargetId = string
/** 目标形态 */
export type SwitchTargetKind = 'ide' | 'cli' | 'desktop'
/** 登录特征命中口径 */
export type SwitchHintMode = 'file-count' | 'content-scan'

/** 一致性规则:一组文件里同名字段必须取同一值(否则是半切换态) */
export interface SwitchCoherenceRule {
  /** 参与比对的相对文件集(相对基址) */
  files: string[]
  /** JSON 字段名(深层同名键都算数) */
  field: string
  /** 人话标签(报错用) */
  label?: string
}

/** 一个可切换目标(客户端)的完整定义 */
export interface SwitchTarget {
  id: SwitchTargetId
  /** 展示名 */
  label: string
  /** 形态 */
  kind: SwitchTargetKind
  /** 登录态候选基址组(主文件在哪个候选下存在就用哪个;全不存在用首个) */
  baseDirCandidates: string[]
  /** 构成登录态的相对文件集(全部存在才算完整) */
  files: string[]
  /** 快照根目录 */
  snapRoot: string
  /** 判定"已登录"的观察键(只报命中数不报值) */
  loginHints: string[]
  /** 命中口径:file-count = 文件存在即命中;content-scan = 主文件文本里搜特征键 */
  hintMode: SwitchHintMode
  /** 切换前是否必须关闭客户端(默认 true;纯 CLI 配置类为 false) */
  requiresStoppedApp?: boolean
  /** 人读提示(形态说明/已知边界) */
  notes?: string[]
  /** 旁证文件(绝对路径或相对基址):仅探测,不参与捕获/替换 */
  auxFiles?: string[]
  /** false = 该目标本轮只做只读探测,capture/--to 直接拒绝 */
  supported?: boolean
  /** 未支持原因(supported === false 时必填) */
  unsupportedReason?: string
  /** 多文件一致性规则(generation 之类) */
  coherence?: SwitchCoherenceRule
}

/** 一次操作的目标 + 快照库目录 */
export interface SwitchPaths {
  target: SwitchTarget
  snapDir: string
}

const sha256 = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex')

/** 双候选环境根:APPDATA 在沙盒可能被重定向;目录级候选交给 baseDirCandidates 按主文件存在性挑 */
export function firstExistingPath(candidates: string[]): string {
  return candidates.find((c) => c && existsSync(c)) ?? candidates.find((c) => c) ?? ''
}

/** 解析生效基址:主文件在哪个候选下存在用哪个;全不存在退回首个候选 */
export function resolveBaseDir(target: SwitchTarget): string {
  const mainRel = target.files[0]
  if (!mainRel) return target.baseDirCandidates[0] ?? ''
  for (const c of target.baseDirCandidates) {
    if (existsSync(join(c, mainRel))) return c
  }
  return target.baseDirCandidates[0] ?? ''
}

/** 旁证文件解析:绝对路径原样用,相对路径挂基址下 */
export function resolveAuxFiles(target: SwitchTarget, baseDir: string): string[] {
  return (target.auxFiles ?? []).map((f) => (isAbsolute(f) ? f : join(baseDir, f)))
}

/** 登录态完整性:全部文件在且可读 ⇒ complete;缺哪些如实报 */
export interface CurrentState {
  installed: boolean
  complete: boolean
  missingFiles: string[]
  /** 每文件的 sha12(审计用,非敏感) */
  sha12s: Record<string, string>
  /** loginHints 命中数(content-scan:主文件命中数;file-count:存在文件数) */
  hintHits: number
  modifiedAt?: string
  /** 旁证文件里已存在的那些(仅探测) */
  auxPresent?: string[]
  /** 一致性判定(仅当目标带 coherence 规则) */
  coherenceOk?: boolean
  coherenceDetail?: string
}

export function readCurrentState(target: SwitchTarget): CurrentState {
  const sha12s: Record<string, string> = {}
  const missingFiles: string[] = []
  let hintHits = 0
  let newest: string | undefined
  const baseDir = resolveBaseDir(target)
  for (const rel of target.files) {
    const abs = join(baseDir, rel)
    if (!existsSync(abs)) {
      missingFiles.push(rel)
      continue
    }
    sha12s[rel] = sha256(abs).slice(0, 12)
    const m = statSync(abs).mtime.toISOString()
    if (!newest || m > newest) newest = m
    if (target.hintMode === 'file-count') hintHits += 1
  }
  if (target.hintMode === 'content-scan') {
    const mainRel = target.files[0]
    if (mainRel) {
      const mainFile = join(baseDir, mainRel)
      if (existsSync(mainFile)) {
        try {
          const text = readFileSync(mainFile, 'utf8')
          hintHits = target.loginHints.filter((h) => text.includes(h)).length
        } catch {
          hintHits = 0
        }
      }
    }
  }
  const probe = target.files[0] ? join(baseDir, target.files[0]) : ''
  // 旁证文件去重:绝对路径候选与相对基址候选可能指向同一物理文件,重复计数会虚报命中数
  const auxPresent = [...new Set(resolveAuxFiles(target, baseDir))].filter((p) => existsSync(p))
  const coherence = checkCoherence(target, baseDir)
  return {
    installed: probe ? existsSync(probe) : false,
    complete: missingFiles.length === 0,
    missingFiles,
    sha12s,
    hintHits,
    ...(newest ? { modifiedAt: newest } : {}),
    ...(target.auxFiles?.length ? { auxPresent } : {}),
    ...(target.coherence ? { coherenceOk: coherence.ok, coherenceDetail: coherence.detail } : {}),
  }
}

export interface CoherenceCheck {
  ok: boolean
  /** 不一致时的原因(字段名/文件名,绝不含字段值) */
  detail: string
}

/** 递归收集 JSON 里某字段名的全部取值 */
function collectFieldValues(node: unknown, field: string, out: unknown[]): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectFieldValues(item, field, out)
    return
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === field) out.push(v)
    else collectFieldValues(v, field, out)
  }
}

/**
 * 一致性判定:coherence.files 里各文件的同名字段必须指向同一个值。
 *
 * 取值口径:字段名在 JSON 里**任意深度**都算数(如 minimax 的
 * auth.json 把 generation 放在 records.<账号键>.generation 下,而 auth-state.json
 * 放在顶层)。多文件取"共有值"口径:各文件取值集合的**交集非空**才算一致
 * —— 这样多账号仓库(auth.json 里并存多份记录)不会误判,而真正的半切换态
 * (两份文件来自不同账号 ⇒ 交集为空)必被拦下。
 *
 * 取不到(缺文件/非 JSON/字段缺失)一律判不一致 —— 判不出 ≠ 判过。
 */
export function checkCoherence(target: SwitchTarget, baseDir: string): CoherenceCheck {
  const rule = target.coherence
  if (!rule) return { ok: true, detail: '' }
  const label = rule.label ?? rule.field
  const sets: Set<string>[] = []
  for (const rel of rule.files) {
    const abs = join(baseDir, rel)
    if (!existsSync(abs)) return { ok: false, detail: `文件缺失:${rel}` }
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(abs, 'utf8'))
    } catch {
      return { ok: false, detail: `非 JSON 或解析失败:${rel}` }
    }
    const values: unknown[] = []
    collectFieldValues(parsed, rule.field, values)
    if (values.length === 0) return { ok: false, detail: `未找到字段 ${label}:${rel}` }
    sets.push(new Set(values.map((v) => JSON.stringify(v))))
  }
  const common = [...sets[0]!].filter((v) => sets.every((s) => s.has(v)))
  if (common.length === 0) {
    return { ok: false, detail: `字段 ${label} 取值不一致(${rule.files.join(' / ')})` }
  }
  return { ok: true, detail: '' }
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

export function listSnapshots(paths: SwitchPaths): SnapshotInfo[] {
  const out: SnapshotInfo[] = []
  if (!existsSync(paths.snapDir)) return out
  const current = readCurrentState(paths.target)
  for (const name of readdirSync(paths.snapDir).sort()) {
    const dir = join(paths.snapDir, name)
    const metaPath = join(dir, 'meta.json')
    if (!existsSync(metaPath)) continue // 非快照目录(半写残留)忽略
    let meta: { capturedAt?: string; sha256s?: Record<string, string> }
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    } catch {
      continue
    }
    const sha12s: Record<string, string> = {}
    let allSame = true
    for (const rel of paths.target.files) {
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
      sameAsCurrent: allSame && Object.keys(sha12s).length === paths.target.files.length,
    })
  }
  return out
}

function writeSnapshotContent(paths: SwitchPaths, snapDir: string): void {
  mkdirSync(snapDir, { recursive: true })
  const sha256s: Record<string, string> = {}
  const baseDir = resolveBaseDir(paths.target)
  for (const rel of paths.target.files) {
    const src = join(baseDir, rel)
    if (!existsSync(src)) continue // 缺失文件记录为缺失,恢复时跳过
    const dest = join(snapDir, rel)
    mkdirSync(dest.replace(/[^/\\]+$/, ''), { recursive: true })
    copyFileSync(src, dest)
    sha256s[rel] = sha256(src)
  }
  writeFileSyncAtomic(
    join(snapDir, 'meta.json'),
    JSON.stringify(
      { capturedAt: new Date().toISOString(), sha256s, target: paths.target.id },
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
  paths: SwitchPaths,
  name: string,
): { ok: boolean; snapshotDir?: string; error?: string } {
  try {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
      return { ok: false, error: '快照名只允许字母数字._-,1~64 位' }
    }
    if (paths.target.supported === false) {
      return { ok: false, error: `目标未支持:${paths.target.unsupportedReason ?? '未实现'}` }
    }
    const current = readCurrentState(paths.target)
    if (!current.installed)
      return {
        ok: false,
        error: `未检测到 ${paths.target.label} 登录态文件(${resolveBaseDir(paths.target)})`,
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

export interface SwitchPlan {
  targetId: SwitchTargetId
  targetName: string
  targetDir: string
  /** 切换前当前态的自动备份落点(pre-switch 快照) */
  preSwitchBackupDir: string
  warnings: string[]
}

/** 生成切换计划(纯函数不落盘);目标与当前逐文件相同拒绝 */
export function planSwitch(paths: SwitchPaths, targetName: string, now = new Date()): SwitchPlan {
  if (paths.target.supported === false) {
    throw new Error(`目标未支持:${paths.target.unsupportedReason ?? '未实现'}`)
  }
  const snaps = listSnapshots(paths)
  const target = snaps.find((s) => s.name === targetName)
  if (!target) {
    const known = snaps.map((s) => s.name).join(', ') || '(快照库为空,先 capture 登记)'
    throw new Error(`快照不存在: ${targetName}。可用: ${known}`)
  }
  const current = readCurrentState(paths.target)
  if (!current.installed) throw new Error(`未检测到当前登录态文件(${resolveBaseDir(paths.target)})`)
  const targetMissing = paths.target.files.filter((rel) => !existsSync(join(target.path, rel)))
  if (targetMissing.length > 0)
    throw new Error(`目标快照文件集不完整,缺: ${targetMissing.join(', ')}`)
  // 目标快照自身必须一致(否则装上去就是半切换态)⇒ 直接拒绝
  // 顺序说明:这是**目标快照的静态属性**,先于"与当前态逐字节相同"这类动态比较判定,
  // 否则半切换态快照会先撞上"逐字节相同"而报出误导性的原因。
  const snapCoh = checkCoherence(paths.target, target.path)
  if (!snapCoh.ok) {
    throw new Error(`目标快照一致性校验未通过(${snapCoh.detail});拒绝切换(防半切换态)`)
  }
  if (
    current.complete &&
    paths.target.files.every((rel) => current.sha12s[rel] === target.sha12s[rel])
  ) {
    throw new Error('目标与当前登录态逐字节相同,无需切换')
  }
  const warnings: string[] = []
  if (paths.target.requiresStoppedApp !== false) {
    warnings.push(`切换前请关闭 ${paths.target.label}(运行中切换可能在客户端退出时被覆盖)`)
  } else {
    warnings.push(`${paths.target.label} 属纯配置文件类目标,无需关闭客户端`)
  }
  warnings.push('当前登录态将自动备份为 pre-switch 快照,切回即恢复')
  warnings.push('目标快照的凭据绑定在本机 machine-id 上时跨机不可用(同机切换不受影响)')
  const liveCoh = checkCoherence(paths.target, resolveBaseDir(paths.target))
  if (!liveCoh.ok) {
    warnings.push(`当前登录态一致性异常(${liveCoh.detail}),切换将以整集覆盖恢复一致`)
  }
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', 'T')
  return {
    targetId: paths.target.id,
    targetName,
    targetDir: target.path,
    preSwitchBackupDir: join(paths.snapDir, `pre-switch-${stamp}Z`),
    warnings,
  }
}

export interface SwitchApplyResult {
  ok: boolean
  preSwitchBackupDir?: string
  newSha12s?: Record<string, string>
  error?: string
}

/** 执行切换:先整集备份当前 → 目标集逐文件临时名拷贝 → 逐文件改名 → sha256 全量对账 */
export function applySwitch(paths: SwitchPaths, plan: SwitchPlan): SwitchApplyResult {
  try {
    writeSnapshotContent(paths, plan.preSwitchBackupDir) // 备份当前(先于一切写)
    const temps: Array<{ tmp: string; dest: string; want: string }> = []
    const baseDir = resolveBaseDir(paths.target)
    for (const rel of paths.target.files) {
      const src = join(plan.targetDir, rel)
      if (!existsSync(src)) continue
      const dest = join(baseDir, rel)
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

/**
 * 零泄漏自检素材:从目标文件里抽出"带引号的长字面量"(凭据最常见的形态),
 * 供 CLI 在打印前过 assertNoSecretLeak。exclude 里的串(路径/文件名)不当作凭据。
 *
 * **二进制文件跳过**:sqlite(secretStorage)之类二进制里正则捞到的"引号字面量"是垃圾,
 * 既有误报风险(键名被当凭据)又漏真凭据 ⇒ 只从文本文件里取材。
 */
export function collectSecretLiterals(
  target: SwitchTarget,
  baseDir: string,
  exclude: string[] = [],
  limit = 200,
): string[] {
  const out: string[] = []
  const skip = exclude.filter(Boolean)
  for (const rel of target.files) {
    const abs = join(baseDir, rel)
    if (!existsSync(abs)) continue
    let text: string
    try {
      text = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    if (text.includes('\u0000')) continue // 二进制(sqlite 等),不做字面量取材
    const matched = text.match(/"[^"\n]{16,}"/g)
    if (!matched) continue
    for (const raw of matched) {
      const v = raw.slice(1, -1)
      if (v.length < 16) continue
      if (skip.some((s) => v.includes(s))) continue
      out.push(v)
      if (out.length >= limit) return out
    }
  }
  return out
}

/** 兼容别名:core 早期按 IDE 语义命名,现语义已泛化(保留旧名以免调用方断裂) */
export const planIdeSwitch = planSwitch
/** 兼容别名:同 planIdeSwitch */
export const applyIdeSwitch = applySwitch

/* ------------------------------------------------------------------ *
 * 外部目标(用户自定义 profile)
 * ------------------------------------------------------------------ */

/** 单个外部 profile 文件的装载结果 */
export interface ExternalTargetError {
  /** 文件名(相对 profileDir) */
  file: string
  /** 失败原因(不含文件内容) */
  error: string
}

/** 外部 profile 装载总结果 */
export interface ExternalTargetLoadResult {
  /** 通过校验的目标 */
  targets: SwitchTarget[]
  /** 被跳过的文件及原因(逐条如实报,不整体崩) */
  errors: ExternalTargetError[]
}

/** 目标 id 规则:与快照名校验同风格(小写字母数字开头,允许 . _ -) */
export const SWITCH_TARGET_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/

/** 相对文件项安全校验:不得是绝对路径、不得含 .. 段(防越界读写) */
function isSafeRelFile(p: unknown): p is string {
  if (typeof p !== 'string' || p.length === 0) return false
  if (isAbsolute(p)) return false
  const norm = p.replace(/\\/g, '/')
  if (norm.includes('\0')) return false
  return !norm.split('/').some((seg) => seg === '..')
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0)
}

/**
 * 从 profileDir 下的 *.json 装载用户自定义目标。
 *
 * 红线:
 *  - profile 文件**只当数据读**(JSON.parse),绝不 eval/执行其中任何内容;
 *  - 非法文件逐条跳过并如实报错误,整体不崩;
 *  - id 与内置目标冲突时外部**不覆盖**内置(跳过 + 报错)。
 */
export function loadExternalTargets(
  profileDir: string,
  options: { reservedIds?: readonly string[] } = {},
): ExternalTargetLoadResult {
  const targets: SwitchTarget[] = []
  const errors: ExternalTargetError[] = []
  const reserved = new Set(options.reservedIds ?? [])
  let files: string[] = []
  try {
    if (!existsSync(profileDir)) return { targets, errors }
    files = readdirSync(profileDir)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .sort()
  } catch {
    return { targets, errors }
  }
  for (const file of files) {
    const abs = join(profileDir, file)
    let raw: string
    try {
      raw = readFileSync(abs, 'utf8')
    } catch (e) {
      errors.push({ file, error: `读取失败:${e instanceof Error ? e.message : String(e)}` })
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      errors.push({ file, error: `非法 JSON:${e instanceof Error ? e.message : String(e)}` })
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push({ file, error: 'profile 必须是 JSON 对象' })
      continue
    }
    const p = parsed as Record<string, unknown>
    const id = typeof p['id'] === 'string' ? p['id'] : ''
    if (!SWITCH_TARGET_ID_RE.test(id)) {
      errors.push({
        file,
        error: `id 非法(只允许小写字母数字开头 + . _ -,1~64 位):${id || '(空)'}`,
      })
      continue
    }
    if (reserved.has(id)) {
      errors.push({ file, error: `id 与内置目标冲突:${id}(外部不覆盖内置,已跳过)` })
      continue
    }
    if (!isStringArray(p['baseDirCandidates']) || p['baseDirCandidates'].length === 0) {
      errors.push({ file, error: 'baseDirCandidates 必须是非空字符串数组' })
      continue
    }
    if (!isStringArray(p['files']) || p['files'].length === 0) {
      errors.push({ file, error: 'files 必须是非空字符串数组' })
      continue
    }
    if (!p['files'].every(isSafeRelFile)) {
      errors.push({ file, error: 'files 含非法路径(必须是基址下的相对路径,禁绝对路径/..)' })
      continue
    }
    const kind = p['kind'] === undefined ? 'desktop' : p['kind']
    if (kind !== 'ide' && kind !== 'cli' && kind !== 'desktop') {
      errors.push({ file, error: `kind 非法(只允许 ide/cli/desktop):${String(kind)}` })
      continue
    }
    const hintMode = p['hintMode'] === undefined ? 'content-scan' : p['hintMode']
    if (hintMode !== 'file-count' && hintMode !== 'content-scan') {
      errors.push({
        file,
        error: `hintMode 非法(只允许 file-count/content-scan):${String(hintMode)}`,
      })
      continue
    }
    if (p['loginHints'] !== undefined && !isStringArray(p['loginHints'])) {
      errors.push({ file, error: 'loginHints 必须是字符串数组' })
      continue
    }
    if (p['auxFiles'] !== undefined && !isStringArray(p['auxFiles'])) {
      errors.push({ file, error: 'auxFiles 必须是字符串数组' })
      continue
    }
    if (p['requiresStoppedApp'] !== undefined && typeof p['requiresStoppedApp'] !== 'boolean') {
      errors.push({ file, error: 'requiresStoppedApp 必须是布尔值' })
      continue
    }
    if (p['notes'] !== undefined && !isStringArray(p['notes'])) {
      errors.push({ file, error: 'notes 必须是字符串数组' })
      continue
    }
    const snapRoot =
      typeof p['snapRoot'] === 'string' && p['snapRoot'].length > 0
        ? p['snapRoot']
        : join(profileDir, '..', 'backups', 'switch', id)
    targets.push({
      id,
      label: typeof p['label'] === 'string' && p['label'].length > 0 ? p['label'] : id,
      kind,
      baseDirCandidates: [...(p['baseDirCandidates'] as string[])],
      files: [...(p['files'] as string[])],
      snapRoot,
      loginHints: [...((p['loginHints'] as string[] | undefined) ?? [])],
      hintMode,
      requiresStoppedApp: p['requiresStoppedApp'] === undefined ? true : p['requiresStoppedApp'],
      ...(p['notes'] ? { notes: [...(p['notes'] as string[])] } : {}),
      ...(p['auxFiles'] ? { auxFiles: [...(p['auxFiles'] as string[])] } : {}),
    })
  }
  return { targets, errors }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
