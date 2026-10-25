#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-50「DevEnv 搬入 G:\IHUI-AI\.DevEnv」—— 静默窗口探测器 + 搬迁执行器(票 G-50 器物化)
 *
 * 票面把「等静默窗口」变成器物自动找窗口:默认档零写盘(探测 + 六步盘点 + 预演),
 * --apply 档在静默窗口(window 态)才按票面 1-6 步顺序执行,顺序不可换。
 *
 * ══ 现状盘点(2026-10-25 实测,依据逐条给出;派单/执行前必须重跑本脚本取现值,§0.1)══
 *
 *  票面步骤                          | 状态       | 依据(当次实测)
 *  ----------------------------------+------------+---------------------------------------------------------
 *  1) 同卷 rename G:\DevEnv→.DevEnv  | 部分已发生 | 主体(cache/tools/Temp/backups)已于 2026-09-30 由
 *                                    |            | G-814433 搬入仓内(.gitignore:591 注释、lib/gitdir.mjs
 *                                    |            | :356 注释);旧根 G:\DevEnv 仍残留实体 Temp\ 与
 *                                    |            | backups\(Temp 10-23 还有写入 ⇒ 仍有生产者在写)。
 *                                    |            | 目标 .DevEnv 已存在 ⇒ 票面「整根 rename」不可行,
 *                                    |            | 既定替代实现 = 逐子树 re-home(复用 re-home-junctions
 *                                    |            | 的 repairOne:镜像复制→内容校验→改名→原位建链→回读,
 *                                    |            | §0.6 单源),旧根一层最终全部为封口链接或消失。
 *  2) 重建 C 盘 8 + 家目录 8 junction | 已发生     | dir /AL C:\ 实测 8 个(c/caches/common_attachment/
 *                                    |            | persistent_data/rn-cxx/temp/tmp/tools)全指
 *                                    |            | G:\IHUI-AI\.DevEnv\…;家目录 8 个(.cache/.codex/
 *                                    |            | .codex-session-delete/.ihui/.m2/.rustup/.trae/.trae-cn)
 *                                    |            | 全指 …\cache\userhome\…。执行器按实测枚举判,不抄死 8。
 *  3) 改 5 脚本 + 3 复核位            | 部分已发生 | 实现面已改(lib/gitdir.mjs G-814433 归档根随仓内、
 *                                    |            | lib/scratch-dir.mjs G-158 scratch 根随仓内);残留 =
 *                                    |            | check-credential-health.mjs:81 活代码候选序 1 处
 *                                    |            | ('G:/DevEnv/secrets'),其余 9 处全是历史叙述注释
 *                                    |            | (按「删副本不删证据」惯例保留,apply 不清注释)。
 *                                    |            | 清单 = HARD_CODED_FILES(5 脚本 + 3 复核位,测试钉在)。
 *  4) .gitignore 加 /.DevEnv/        | 已发生     | .gitignore:593 `.DevEnv/`(git check-ignore 实测命中)。
 *  5) 逐项回读验证                   | apply 总闸 | 仅 --apply 档执行;默认档零写盘。
 *  6) 白名单摘除过渡条目              | 待做       | seal-c-root-stray.mjs devEnvTargetRoots() 仍返回
 *                                    |            | [新根, 旧根] 双根(2026-10-24 过渡候选),搬完摘旧根。
 *
 *  另:.DevEnv\.git 是 G-158 的坏 gitfile 边界哨兵(指向不存在的 .no-git-boundary),
 *  防 git discovery 逃逸与嵌套仓(守门 208),正确形态,本器物不碰。
 *
 * ══ 静默窗口判据(票面)══
 *  ① 旧根(<盘>:/DevEnv)内 mtime 最新条目距今 ≥ QUIET_MINUTES(60 分钟 = 连续 ≥2 轮
 *     守护派发周期)无新增;枚举跳过重解析点(§26 头号危险:junction 穿透会把别的盘算进来)。
 *  ② 无活跃并行会话:.ihui-agent/tmp 与 <盘>:/tmp-probe 两探针均 SESSION_IDLE_MINUTES(30
 *     分钟)内无新写入(目录不存在 = 无探针,天然过)。
 *  前置可信度:git-guardian.log 末条 tick 距今 > GUARDIAN_FRESH_MINUTES(15 分钟)⇒ 守护
 *  失明期,「无新增」不可信 ⇒ 整体未判定(§0.3:取不到输入判未判定,绝不猜)。
 *  三态:window(两判据全过 ∧ 守护活着)/ pending(有活跃写入,reasons 点名)/
 *  undetermined(输入取不到:枚举截断/单条读不到/留痕过期等,显式点名原因)。
 *
 * ══ 用法 ══
 *   node scripts/devenv-migrate.mjs              # 默认:探测 + 盘点 + 预演(零写盘)
 *   node scripts/devenv-migrate.mjs --probe      # 只打印静默窗口三态
 *   node scripts/devenv-migrate.mjs --apply      # 执行搬迁(window 才动手;pending/未判定一律拒绝)
 *   node scripts/devenv-migrate.mjs --self-test  # 判据取证(夹具内,不碰真盘真根)
 *  退出码:0 = window(可执行)/ 已完成;1 = pending / apply 复核不过;2 = 未判定/脚本异常;
 *          3 = --apply 被静默窗口前置闸拒绝。
 *
 * ══ 安全设计 ══
 *  · 派生一律 windowsHide:true + 显式 stdio(§5b/§12g);改含载荷文件走水印三段
 *    clean → 受控替换 → inject(§5c 禁文本级批量改写毁零宽链)。
 *  · 路径由脚本自身位置推导(禁 process.cwd() 定根,守门 70);盘符不写死,parse(ROOT).root。
 *  · 枚举带预算(ENUM_BUDGET),截断 ⇒ undetermined 不假静默。
 *  · --apply 每步失败即停且如实报;repairOne 内建逐级回退,数据不可逆删除前有多道内容闸。
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  utimesSync,
} from 'node:fs'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { plan as reHomePlan, repairOne as reHomeRepair } from './re-home-junctions.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DRIVE_ROOT = parse(ROOT).root

/** 旧外置根(票面搬迁源)与新根(票面搬迁目标)。盘符由脚本自身位置推导,不写死。 */
export const LEGACY_ROOT = join(DRIVE_ROOT, 'DevEnv')
export const NEW_ROOT = join(ROOT, '.DevEnv')
/** 以下六常量 export 供镜像测试作构造面树键(与探测器所问路径逐字同形,§22c 零复制)。 */
export const C_DRIVE = join(process.env.SystemDrive || 'C:', sep)
export const SESSION_TMP = join(ROOT, '.ihui-agent', 'tmp')
export const TMP_PROBE = join(DRIVE_ROOT, 'tmp-probe')
export const GUARDIAN_LOG = join(ROOT, '.ihui-agent', 'state', 'git-guardian.log')
export const GITIGNORE = join(ROOT, '.gitignore')
export const SEAL_SCRIPT = join(ROOT, 'scripts', 'seal-c-root-stray.mjs')

/** 票面判据阈值(分钟)。60 = 连续 ≥2 轮守护派发周期;30 = 会话探针静默;15 = 守护留痕新鲜度。 */
export const QUIET_MINUTES = 60
export const SESSION_IDLE_MINUTES = 30
export const GUARDIAN_FRESH_MINUTES = 15
/** 枚举预算:超过即截断 ⇒ 判定降级为 undetermined(未见 ≠ 不存在)。 */
export const ENUM_BUDGET = 200000

/** 票面步骤 3 的硬编码面清单:5 个脚本 + 3 个复核位(G:\DevEnv 字面命中面,2026-10-25 实测)。 */
export const HARD_CODED_FILES = [
  'scripts/check-credential-health.mjs',
  'scripts/pg-restore-drill.mjs',
  'scripts/re-home-junctions.mjs',
  'scripts/retire-git-archive.mjs',
  'scripts/sync-prometheus-live-config.mjs',
  'scripts/lib/gitdir.mjs',
  'scripts/lib/scratch-dir.mjs',
  'scripts/seal-c-root-stray.mjs',
]

/** --apply 步骤 3 的受控替换表(逐字、带预期命中数;活代码面,历史注释不在此列)。
 *  check-credential-health 的密钥候选序里仓内 .DevEnv\secrets 已在首位(G-814433),
 *  摘除旧盘根候选 = 票面「改硬编码」的活代码动作;D:/F:/E: 是其他盘候选,不在射程。 */
export const APPLY_REPLACEMENTS = [
  {
    file: 'scripts/check-credential-health.mjs',
    edits: [{ from: `'G:/DevEnv/secrets', `, to: '', expect: 1 }],
  },
]

/** 判定用只读 io 集;--apply 另需写面(全部经 io 注入,§22c 构造面可证 + 零写盘行为锁)。 */
function defaultIO() {
  return {
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
    mkdirSync,
    renameSync,
    rmSync,
    spawnSync,
  }
}

/**
 * 递归量一棵树的最新写入时刻。**不跟随重解析点**(§26):junction/symlink 条目只计数跳过,
 * 既不递归也不计入 mtime(链接本体的 mtime 是建立时刻,与「写入」无关)。
 * 三态:absent(路径不存在,或本体就是重解析点)/ ok(量到了)/ undetermined(读不到,
 * 显式带 why;枚举截断或单条 lstat 失败也降级 undetermined —— 漏看的那条可能正是最新写入)。
 * @param {{lstatSync:Function, readdirSync:Function}} io 只读面
 * @param {string} dir 待量树的根
 * @param {number} now 时刻基准(ms),测试可注入
 * @returns {{kind:'absent'|'ok'|'undetermined', quietMinutes:(number|null), truncated:boolean, junctions:number, why:(string|undefined), entries:(number|undefined)}}
 */
export function latestWrite(io, dir, now) {
  let st
  try {
    st = io.lstatSync(dir)
  } catch (e) {
    if (e && e.code === 'ENOENT')
      return { kind: 'absent', quietMinutes: null, truncated: false, junctions: 0 }
    return {
      kind: 'undetermined',
      quietMinutes: null,
      truncated: false,
      junctions: 0,
      why: `lstat ${dir} 失败(${(e && e.code) || e})`,
    }
  }
  if (st.isSymbolicLink())
    return {
      kind: 'absent',
      quietMinutes: null,
      truncated: false,
      junctions: 1,
      why: `${dir} 本体是重解析点,无实体内容`,
    }
  let maxMs = st.mtimeMs
  let junctions = 0
  let truncated = false
  let unreadable = 0
  let firstUnreadableCode = ''
  let entries = 0
  /** @param {string} d */
  const walk = (d) => {
    let names
    try {
      names = io.readdirSync(d)
    } catch (e) {
      if (e && e.code === 'ENOENT') return // 并发删除:按当前所见判,不猜多
      truncated = true
      return
    }
    for (const name of names) {
      entries++
      if (entries > ENUM_BUDGET) {
        truncated = true
        return
      }
      const p = join(d, name)
      let s
      try {
        s = io.lstatSync(p)
      } catch (e) {
        if (unreadable === 0) firstUnreadableCode = (e && e.code) || String(e)
        unreadable++
        continue
      }
      if (s.isSymbolicLink()) {
        junctions++
        continue
      }
      if (s.mtimeMs > maxMs) maxMs = s.mtimeMs
      if (s.isDirectory()) walk(p)
    }
  }
  walk(dir)
  if (unreadable > 0)
    return {
      kind: 'undetermined',
      quietMinutes: null,
      truncated,
      junctions,
      why: `${unreadable} 个条目 lstat 失败(首个:${firstUnreadableCode}),漏看的可能正是最新写入`,
    }
  if (truncated)
    return {
      kind: 'undetermined',
      quietMinutes: null,
      truncated,
      junctions,
      why: `枚举超过预算 ${ENUM_BUDGET} 条被截断,未见 ≠ 不存在`,
    }
  return {
    kind: 'ok',
    quietMinutes: Math.max(0, (now - maxMs) / 60000),
    truncated: false,
    junctions,
    entries,
  }
}

/**
 * 守护 tick 存活判定:git-guardian.log 末条时间戳距今 ≤ GUARDIAN_FRESH_MINUTES 才认「tick 在动」。
 * 读不到 / 无时间戳 / 过期 ⇒ undetermined(守护失明期的「无新增」不构成静默证据,§0.3)。
 * @param {{readFileSync:Function}} io
 * @param {number} now
 * @returns {{state:'alive'|'undetermined', lastIso:(string|null), ageMinutes:(number|null), why:(string|undefined)}}
 */
export function guardianTickAlive(io, now) {
  let text
  try {
    text = io.readFileSync(GUARDIAN_LOG, 'utf8')
  } catch (e) {
    return { state: 'undetermined', lastIso: null, ageMinutes: null, why: `守护留痕读不到(${(e && e.code) || e})` }
  }
  const stamps = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]/
  const lines = String(text).split(/\r?\n/)
  // 实测留痕 28MB / 19.9 万条戳:必须倒序取**末条**,不得 matchAll 全量数组后 Math.max(...ms)
  // (spread 十万级元素即爆栈,2026-10-25 实测 RangeError)。
  let lastIso = null
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(stamps)
    if (m) {
      lastIso = m[1]
      break
    }
  }
  if (lastIso === null)
    return { state: 'undetermined', lastIso: null, ageMinutes: null, why: '守护留痕中无 tick 时间戳' }
  const lastMs = Date.parse(lastIso)
  if (!Number.isFinite(lastMs))
    return { state: 'undetermined', lastIso, ageMinutes: null, why: '守护留痕时间戳不可解析' }
  const ageMinutes = (now - lastMs) / 60000
  if (ageMinutes > GUARDIAN_FRESH_MINUTES)
    return {
      state: 'undetermined',
      lastIso,
      ageMinutes,
      why: `守护留痕已 ${ageMinutes.toFixed(0)} 分钟未 tick(阈值 ${GUARDIAN_FRESH_MINUTES}),失明期静默不可信`,
    }
  return { state: 'alive', lastIso, ageMinutes }
}

/** 单个静默判据的裁决(纯判据,三处探针与汇总共用同一把尺,§0.6)。 */
function quietVerdict(fact, threshold, label) {
  if (fact.kind === 'absent')
    return { pass: true, undetermined: false, note: fact.why ? `${label}:${fact.why}` : `${label}:不存在,天然静默` }
  if (fact.kind === 'undetermined')
    return { pass: false, undetermined: true, note: `${label}:${fact.why}` }
  if (fact.truncated)
    return { pass: false, undetermined: true, note: `${label}:枚举截断,未判定` }
  if (fact.quietMinutes !== null && fact.quietMinutes >= threshold)
    return {
      pass: true,
      undetermined: false,
      note: `${label}:静默 ${fact.quietMinutes.toFixed(0)} 分钟 ≥ ${threshold}(跳过重解析点 ${fact.junctions})`,
    }
  return {
    pass: false,
    undetermined: false,
    note: `${label}:${fact.quietMinutes === null ? '静默时长取不到' : `最新写入距今 ${fact.quietMinutes.toFixed(1)} 分钟 < ${threshold}`}`,
  }
}

/**
 * 静默窗口三态(票面判据 ①② + 守护存活前置)。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function}} io
 * @param {number} [now]
 * @returns {{state:'window'|'pending'|'undetermined', reasons:string[], facts:Object}}
 */
export function probeQuietWindow(io, now = Date.now()) {
  const facts = {
    legacyRoot: latestWrite(io, LEGACY_ROOT, now),
    sessionTmp: latestWrite(io, SESSION_TMP, now),
    tmpProbe: latestWrite(io, TMP_PROBE, now),
    guardian: guardianTickAlive(io, now),
  }
  const v1 = quietVerdict(facts.legacyRoot, QUIET_MINUTES, `判① 旧根 ${LEGACY_ROOT}`)
  const v2a = quietVerdict(facts.sessionTmp, SESSION_IDLE_MINUTES, `判② 会话探针 ${SESSION_TMP}`)
  const v2b = quietVerdict(facts.tmpProbe, SESSION_IDLE_MINUTES, `判② 会话探针 ${TMP_PROBE}`)
  const reasons = [v1, v2a, v2b].filter((v) => !v.pass).map((v) => v.note)
  const anyUndetermined = facts.guardian.state !== 'alive' || [v1, v2a, v2b].some((v) => v.undetermined)
  if (facts.guardian.state !== 'alive') reasons.push(`守护存活:${facts.guardian.why}`)
  const state = anyUndetermined ? 'undetermined' : reasons.length === 0 ? 'window' : 'pending'
  if (state === 'window')
    reasons.unshift(
      `守护存活:末条 tick ${facts.guardian.lastIso}(距今 ${facts.guardian.ageMinutes !== null ? facts.guardian.ageMinutes.toFixed(1) : '?'} 分钟)`,
    )
  return { state, reasons, facts }
}

/**
 * 枚举盘根一层的重解析点并按指向分类(new=指新根 / legacy=指旧根 / other=无关 / undetermined)。
 * 只看一层不跟随;readlink 失败 = undetermined 单列,不猜。链接本体的分类不含"动它"的授权。
 * @param {{lstatSync:Function, readdirSync:Function, readlinkSync:Function}} io
 * @param {string} driveRoot 盘根(C:\)
 * @returns {Array<{name:string, pointsTo:string, target:string}>}
 */
function listDriveJunctions(io, driveRoot) {
  let names = []
  try {
    names = io.readdirSync(driveRoot)
  } catch {
    return []
  }
  const legacyPrefix = join(DRIVE_ROOT, 'DevEnv') + sep
  const out = []
  for (const name of names) {
    const p = join(driveRoot, name)
    let st
    try {
      st = io.lstatSync(p)
    } catch {
      continue
    }
    if (!st.isSymbolicLink()) continue
    let target = ''
    try {
      target = resolve(String(io.readlinkSync(p)))
    } catch {
      out.push({ name, pointsTo: 'undetermined', target: '' })
      continue
    }
    if (target === resolve(NEW_ROOT) || target.startsWith(resolve(NEW_ROOT) + sep)) out.push({ name, pointsTo: 'new', target })
    else if (target === resolve(legacyPrefix) || target.startsWith(legacyPrefix)) out.push({ name, pointsTo: 'legacy', target })
    else out.push({ name, pointsTo: 'other', target })
  }
  return out
}

/**
 * 家目录侧 junction 现状:登记面复用 re-home 的 plan()(门 96 registryOf + targetFor +
 * devEnvRoot 单源,§0.6),形态判经 io 注入。points-new / points-legacy / real-dir / n-a。
 * @param {{lstatSync:Function, readlinkSync:Function}} io
 * @returns {Array<{src:string, state:string, note:string}>}
 */
function homeJunctionStates(io) {
  let rows = []
  try {
    rows = reHomePlan()
  } catch {
    return []
  }
  const out = []
  for (const it of rows) {
    let st
    try {
      st = io.lstatSync(it.src)
    } catch {
      out.push({ src: it.src, state: 'n-a', note: '不存在' })
      continue
    }
    if (!st.isSymbolicLink()) {
      out.push({ src: it.src, state: st.isDirectory() ? 'real-dir' : 'n-a', note: st.isDirectory() ? '实体目录,待 re-home' : '非目录' })
      continue
    }
    let target = ''
    try {
      target = resolve(String(io.readlinkSync(it.src)))
    } catch (e) {
      out.push({ src: it.src, state: 'n-a', note: `readlink 失败(${(e && e.code) || e})` })
      continue
    }
    if (target === resolve(it.dst) || target.startsWith(resolve(it.dst) + sep))
      out.push({ src: it.src, state: 'points-new', note: target })
    else out.push({ src: it.src, state: 'points-legacy', note: `${target}(非登记目标 ⇒ 按 apply 步骤 2 重建为 ${it.dst})` })
  }
  return out
}

/**
 * 票面六步逐项盘点(只读)。done = 已发生;todo = 待做;apply-gate = 仅 --apply 档的总闸。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function, readlinkSync:Function}} io
 * @returns {Array<{id:number, title:string, state:'done'|'todo'|'apply-gate', evidence:string}>}
 */
export function assessSteps(io) {
  const now = Date.now()
  const steps = []

  // S1 同卷搬迁:旧根形态即答案
  const legacy = latestWrite(io, LEGACY_ROOT, now)
  if (legacy.kind === 'absent')
    steps.push({ id: 1, title: '同卷搬迁 G:\\DevEnv → 仓内 .DevEnv', state: 'done', evidence: `旧根 ${LEGACY_ROOT} 已不存在${legacy.why ? `(${legacy.why})` : ''}` })
  else if (legacy.kind === 'ok')
    steps.push({
      id: 1,
      title: '同卷搬迁 G:\\DevEnv → 仓内 .DevEnv',
      state: 'todo',
      evidence: `旧根残留:条目 ${legacy.entries !== undefined ? legacy.entries : '?'}(跳过重解析点 ${legacy.junctions}),最新写入距今 ${legacy.quietMinutes !== null ? legacy.quietMinutes.toFixed(0) : '?'} 分钟`,
    })
  else
    steps.push({ id: 1, title: '同卷搬迁 G:\\DevEnv → 仓内 .DevEnv', state: 'todo', evidence: `旧根:${legacy.why}` })

  // S2 junction 指向:C 盘侧按实测枚举(不抄死 8),家目录侧复用门 96 登记表(§0.6)
  const cLinks = listDriveJunctions(io, C_DRIVE)
  const cNew = cLinks.filter((l) => l.pointsTo === 'new').length
  const cOld = cLinks.filter((l) => l.pointsTo === 'legacy').length
  const home = homeJunctionStates(io)
  const homeNew = home.filter((h) => h.state === 'points-new').length
  const homeOld = home.filter((h) => h.state === 'points-legacy').length
  const homeTodo = home.filter((h) => h.state === 'real-dir').length
  const s2Done = cOld === 0 && homeOld === 0 && homeTodo === 0
  steps.push({
    id: 2,
    title: '重建 C 盘与家目录 junction(一律 Junction 类型,指向新根)',
    state: s2Done ? 'done' : 'todo',
    evidence:
      `${C_DRIVE} 实测重解析点:指新根 ${cNew} / 指旧根 ${cOld} / 无关或读不到 ${cLinks.length - cNew - cOld};` +
      `家目录登记 ${home.length} 项:指新根 ${homeNew}、指旧根 ${homeOld}、实体待搬 ${homeTodo}、其余 ${home.filter((h) => h.state === 'n-a').length}`,
  })

  // S3 硬编码面:逐文件计数,活代码才算待清(历史注释按「删副本不删证据」保留)
  const s3rows = []
  let s3Code = 0
  let s3Comment = 0
  for (const rel of HARD_CODED_FILES) {
    const p = join(ROOT, rel)
    let text
    try {
      text = io.readFileSync(p, 'utf8')
    } catch (e) {
      s3rows.push(`${rel}:读不到(${(e && e.code) || e})`)
      continue
    }
    let code = 0
    let comment = 0
    for (const line of String(text).split(/\r?\n/)) {
      if (!/G:[\\/]+DevEnv/i.test(line)) continue
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) comment++
      else code++
    }
    s3Code += code
    s3Comment += comment
    if (code + comment > 0) s3rows.push(`${rel}:活代码 ${code} / 注释 ${comment}`)
  }
  steps.push({
    id: 3,
    title: `改硬编码面(${HARD_CODED_FILES.length} 文件 = 5 脚本 + 3 复核位)`,
    state: s3Code === 0 ? 'done' : 'todo',
    evidence:
      s3rows.length === 0
        ? 'G:\\DevEnv 字面命中 0'
        : `命中 ${s3Code + s3Comment} 行(活代码 ${s3Code} / 历史注释 ${s3Comment},注释按证据保留):${s3rows.join(' ; ')}`,
  })

  // S4 .gitignore
  let s4State = 'todo'
  let s4Evidence = `${GITIGNORE} 读不到`
  try {
    const lines = String(io.readFileSync(GITIGNORE, 'utf8')).split(/\r?\n/)
    const at = lines.findIndex((l) => /^\.?\/?\.DevEnv\/\s*(?:#.*)?$/.test(l.trim()))
    if (at >= 0) {
      s4State = 'done'
      s4Evidence = `${GITIGNORE}:${at + 1} = ${lines[at].trim()}`
    } else s4Evidence = '无 .DevEnv/ 条目'
  } catch {
    /* 保持 todo */
  }
  steps.push({ id: 4, title: '.gitignore 登记 .DevEnv/', state: s4State, evidence: s4Evidence })

  // S5 回读验证 = apply 总闸
  steps.push({ id: 5, title: '逐项回读验证(apply 总闸)', state: 'apply-gate', evidence: '仅 --apply 档执行;默认档零写盘' })

  // S6 白名单摘过渡条目:devEnvTargetRoots 双根在役即 todo
  let s6State = 'todo'
  let s6Evidence = `${SEAL_SCRIPT} 读不到`
  try {
    const text = String(io.readFileSync(SEAL_SCRIPT, 'utf8'))
    if (/\[inRepo,\s*legacy\]/.test(text)) s6Evidence = 'seal-c-root-stray.mjs devEnvTargetRoots() 过渡双根在役(acceptableTargets 仍认旧根)'
    else {
      s6State = 'done'
      s6Evidence = '过渡双根已摘(acceptableTargets 仅新根)'
    }
  } catch {
    /* 保持 todo */
  }
  steps.push({ id: 6, title: '白名单摘除过渡条目(搬迁过渡期双根候选)', state: s6State, evidence: s6Evidence })

  return steps
}

/**
 * 预演:把「将做什么」逐行返回(零写盘)。
 * @param {Array<{id:number,title:string,state:string,evidence:string}>} assessed
 * @param {{state:string, reasons:string[]}} probe
 * @returns {string[]}
 */
export function planSteps(assessed, probe) {
  const lines = []
  lines.push(`静默窗口:${probe.state}${probe.reasons.length ? `(${probe.reasons.join(' ; ')})` : ''}`)
  if (probe.state !== 'window') {
    lines.push('--apply 将被拒绝:非 window 态不执行任何搬迁动作。')
    return lines
  }
  for (const s of assessed) {
    if (s.state === 'done') lines.push(`步骤${s.id} 已发生,跳过:${s.title} —— ${s.evidence}`)
    else if (s.state === 'apply-gate') lines.push(`步骤${s.id} 将执行:逐项回读验证(junction 指向 / 硬编码零活代码 / .gitignore 在册 / 旧根清形),任一不符即报 1`)
    else lines.push(`步骤${s.id} 将执行:${s.title} —— 现状:${s.evidence}`)
  }
  return lines
}

/**
 * --apply 执行器(票面 1-6 步,顺序不可换;本轮不真跑,仅供将来窗口期执行)。
 * 前置闸:probe 非 window 一律拒绝(main 落 exit 3)。
 * @param {{lstatSync:Function, readdirSync:Function, readFileSync:Function, readlinkSync:Function, writeFileSync:Function, mkdirSync:Function, renameSync:Function, rmSync:Function, spawnSync:Function}} io
 * @param {{state:string, reasons:string[]}} probeResult
 * @returns {{refused:boolean, reason:(string|undefined), rows:Array<{step:number, ok:boolean, note:string}>, verified:boolean}}
 */
export function applyMigration(io, probeResult) {
  if (probeResult.state !== 'window')
    return {
      refused: true,
      reason: `静默窗口判 ${probeResult.state},拒绝执行(${probeResult.reasons.join(' ; ')})`,
      rows: [],
      verified: false,
    }
  const rows = []
  // ── 步骤 1:旧根逐子树 re-home(复用 repairOne:镜像复制→内容校验→改名→原位建链→回读)──
  for (const name of safeReaddir(io, LEGACY_ROOT)) {
    const src = join(LEGACY_ROOT, name)
    let st
    try {
      st = io.lstatSync(src)
    } catch (e) {
      rows.push({ step: 1, ok: false, note: `${src} lstat 失败(${(e && e.code) || e}),跳过交人工` })
      continue
    }
    if (st.isSymbolicLink()) {
      rows.push({ step: 1, ok: true, note: `${src} 是重解析点,不搬不删(封口态)` })
      continue
    }
    const r = repairViaReHome(src, join(NEW_ROOT, name))
    rows.push({ step: 1, ok: r.ok, note: r.note })
  }
  // ── 步骤 2:重建 C 盘与家目录 junction(一律 Junction 类型,指新根)──
  for (const l of listDriveJunctions(io, C_DRIVE)) {
    if (l.pointsTo === 'new') {
      rows.push({ step: 2, ok: true, note: `${l.name} 已指新根,跳过` })
      continue
    }
    if (l.pointsTo !== 'legacy') {
      rows.push({ step: 2, ok: false, note: `${l.name} 指向${l.pointsTo === 'undetermined' ? '读不到' : '无关目标'}(${l.target}),不擅改交人工` })
      continue
    }
    const newTarget = String(l.target).replace(/^([A-Za-z]:)[\\/]DevEnv/i, NEW_ROOT)
    const r = rebuildJunction(io, join(C_DRIVE, l.name), newTarget)
    rows.push({ step: 2, ok: r.ok, note: `${l.name}:${r.note}` })
  }
  for (const h of homeJunctionStates(io)) {
    if (h.state === 'points-new' || h.state === 'n-a') {
      rows.push({ step: 2, ok: true, note: `${h.src}:${h.state === 'points-new' ? '已指新根' : '不存在/非目录'},跳过` })
      continue
    }
    const planRow = reHomePlan().find((p) => p.src === h.src)
    const dst = planRow
      ? planRow.dst
      : join(NEW_ROOT, 'cache', 'userhome', h.src.slice(h.src.lastIndexOf(sep) + 1))
    if (h.state === 'real-dir') {
      const r = repairViaReHome(h.src, dst)
      rows.push({ step: 2, ok: r.ok, note: `${h.src}:${r.note}` })
      continue
    }
    const r = rebuildJunction(io, h.src, dst)
    rows.push({ step: 2, ok: r.ok, note: `${h.src}:${r.note}` })
  }
  // ── 步骤 3:受控替换(水印三段 clean → 替换 → inject;§5c)──
  for (const spec of APPLY_REPLACEMENTS) {
    const r = controlledEdit(io, join(ROOT, spec.file), spec.edits)
    rows.push({ step: 3, ok: r.ok, note: `${spec.file}:${r.note}` })
  }
  rows.push({
    step: 3,
    ok: true,
    note: `历史注释命中保留(删副本不删证据);${HARD_CODED_FILES.length} 文件面由步骤 5 复核兜底`,
  })
  // ── 步骤 4:.gitignore ──
  {
    const r = ensureGitignoreEntry(io)
    rows.push({ step: 4, ok: r.ok, note: r.note })
  }
  // ── 步骤 5:逐项回读验证(总闸)──
  const verify = verifyApplied(io)
  rows.push({ step: 5, ok: verify.ok, note: verify.note })
  if (!verify.ok) return { refused: false, rows, verified: false }
  // ── 步骤 6:摘过渡双根(水印三段)──
  {
    const r = controlledEdit(io, SEAL_SCRIPT, [
      { from: 'resolve(inRepo) === resolve(legacy) ? [inRepo] : [inRepo, legacy]', to: '[inRepo]', expect: 1 },
    ])
    rows.push({ step: 6, ok: r.ok, note: r.note })
  }
  return { refused: false, rows, verified: true }
}

/** @param {{readdirSync:Function}} io @param {string} dir @returns {string[]} */
function safeReaddir(io, dir) {
  try {
    return io.readdirSync(dir)
  } catch {
    return []
  }
}

/** 步骤 1/2 的搬迁动作:委托 re-home-junctions.repairOne(单源),本层零复算(§0.6)。 */
function repairViaReHome(src, dst) {
  try {
    const r = reHomeRepair(src, dst, { dry: false })
    return { ok: Boolean(r.ok), note: `[${r.action}] ${r.note}` }
  } catch (e) {
    return { ok: false, note: `repairOne 抛错:${(e && e.message) || e}` }
  }
}

/** 断旧链 + 重建指向新根(Junction 类型);失败时尽力恢复旧指向,绝不穿透删除(§26)。 */
function rebuildJunction(io, linkPath, newTarget) {
  let oldTarget = null
  try {
    oldTarget = String(io.readlinkSync(linkPath))
  } catch {
    /* 读不到就当没有 */
  }
  try {
    io.rmSync(linkPath) // 对重解析点只断链不穿透(§26 实测)
  } catch (e) {
    return { ok: false, note: `断链失败(${(e && e.code) || e}),未动` }
  }
  const mk = (target) =>
    io.spawnSync('cmd.exe', ['/c', 'mklink', '/J', linkPath, target], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf8',
    })
  try {
    io.mkdirSync(newTarget, { recursive: true })
  } catch (e) {
    if (oldTarget) mk(oldTarget)
    return { ok: false, note: `建目标失败(${(e && e.code) || e}),已尝试恢复旧指向` }
  }
  mk(newTarget)
  let st = null
  try {
    st = io.lstatSync(linkPath)
  } catch {
    /* 空 */
  }
  if (!st || !st.isSymbolicLink()) {
    if (oldTarget) mk(oldTarget)
    return { ok: false, note: 'mklink 未生效,已尝试恢复旧指向' }
  }
  return { ok: true, note: `已重建 → ${newTarget}` }
}

/** 受控编辑:水印三段(clean → 逐字替换(带命中数断言,不符即整文件不动)→ inject)。§5c。 */
function controlledEdit(io, filePath, edits) {
  let original
  try {
    original = io.readFileSync(filePath, 'utf8')
  } catch (e) {
    return { ok: false, note: `读不到(${(e && e.code) || e})` }
  }
  let next = original
  for (const ed of edits) {
    const count = next.split(ed.from).length - 1
    if (count !== ed.expect)
      return { ok: false, note: `替换靶「${ed.from.slice(0, 40)}」命中 ${count} ≠ 预期 ${ed.expect},整文件未动` }
    next = next.split(ed.from).join(ed.to)
  }
  if (next === original) return { ok: true, note: '无变化,跳过' }
  const wm = (verb) =>
    io.spawnSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), verb, filePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      encoding: 'utf8',
    })
  const c = wm('clean')
  if (c.status !== 0)
    return { ok: false, note: `watermark clean 失败(rc=${c.status}):${String(c.stderr || '').trim().slice(0, 120)}` }
  try {
    io.writeFileSync(filePath, next, 'utf8')
  } catch (e) {
    try {
      io.writeFileSync(filePath, original, 'utf8')
    } catch {
      /* 还原也失败,如实报 */
    }
    return { ok: false, note: `写回失败已还原(${(e && e.code) || e})` }
  }
  const inj = wm('inject')
  if (inj.status !== 0)
    return { ok: false, note: `watermark inject 失败(rc=${inj.status}):${String(inj.stderr || '').trim().slice(0, 120)}` }
  return { ok: true, note: `替换 ${edits.length} 处并重新注入水印` }
}

function ensureGitignoreEntry(io) {
  let text = ''
  try {
    text = io.readFileSync(GITIGNORE, 'utf8')
  } catch (e) {
    return { ok: false, note: `.gitignore 读不到(${(e && e.code) || e})` }
  }
  if (/^\.?\/?\.DevEnv\/\s*(?:#.*)?$/m.test(text)) return { ok: true, note: '.DevEnv/ 已在册,跳过' }
  try {
    io.writeFileSync(GITIGNORE, text.replace(/\n*$/, '\n') + '\n.DevEnv/\n', 'utf8')
  } catch (e) {
    return { ok: false, note: `追加失败(${(e && e.code) || e})` }
  }
  return { ok: true, note: '已追加 .DevEnv/ 条目' }
}

/** 步骤 5 总闸:四项回读,任一不符即不通过(如实点名;repairOne 内建回退已保数据,不代回滚)。 */
function verifyApplied(io) {
  const problems = []
  const legacy = latestWrite(io, LEGACY_ROOT, Date.now())
  if (legacy.kind === 'ok') {
    const real = safeReaddir(io, LEGACY_ROOT).filter((n) => {
      try {
        return !io.lstatSync(join(LEGACY_ROOT, n)).isSymbolicLink()
      } catch {
        return true
      }
    })
    if (real.length) problems.push(`旧根仍有实体条目:${real.slice(0, 5).join(', ')}`)
  } else if (legacy.kind === 'undetermined') problems.push(`旧根:${legacy.why}`)
  const cOld = listDriveJunctions(io, C_DRIVE).filter((l) => l.pointsTo === 'legacy').length
  if (cOld > 0) problems.push(`${C_DRIVE} 仍有 ${cOld} 个指旧根的 junction`)
  for (const h of homeJunctionStates(io)) {
    if (h.state === 'points-legacy' || h.state === 'real-dir')
      problems.push(`家目录 ${h.src}:${h.state === 'real-dir' ? '仍是实体' : '仍指旧根'}(${h.note})`)
  }
  for (const spec of APPLY_REPLACEMENTS) {
    try {
      const text = String(io.readFileSync(join(ROOT, spec.file), 'utf8'))
      const left = spec.edits.filter((ed) => text.includes(ed.from)).length
      if (left) problems.push(`${spec.file} 仍有 ${left} 处替换靶未清`)
    } catch (e) {
      problems.push(`${spec.file} 复核读不到(${(e && e.code) || e})`)
    }
  }
  try {
    if (!/^\.?\/?\.DevEnv\/\s*(?:#.*)?$/m.test(String(io.readFileSync(GITIGNORE, 'utf8'))))
      problems.push('.gitignore 缺 .DevEnv/ 条目')
  } catch {
    problems.push('.gitignore 复核读不到')
  }
  return problems.length
    ? { ok: false, note: problems.join(' ; ') }
    : { ok: true, note: '四项回读全过(旧根清形 / junction 全指新根 / 硬编码活代码零残留 / .gitignore 在册)' }
}

function selfTest() {
  const { t: push, report } = makeRegistrar()
  const NOW = 1_800_000_000_000
  const MIN = 60000
  const f = (minutesAgo) => ({ file: { mtimeMs: NOW - minutesAgo * MIN } })

  /** 构造面:tree = { [绝对路径]: {dir?:string[], file?:{mtimeMs}, link?:string, text?:string, err?:string} } */
  function fakeIO(tree) {
    // norm 必须把 / 与 \ 统一归一(replace 只去尾缀不够):win32 下 path.join('/old','a.txt')
    // 产出 '\old\a.txt',与正斜杠树键逐字不同 ⇒ 构造面全线误报 ENOENT(2026-10-25 实测)。
    // 归一必须**两侧同做**(查找键与树键各自归一后相撞),只归一查找键则正斜杠树键永远 miss。
    const norm = (p) => String(p).split(/[\\/]+/).join('\\')
    const T = {}
    for (const [k, v] of Object.entries(tree)) T[norm(k)] = v
    const get = (p) => T[norm(p)]
    const enoent = () => {
      const err = new Error('ENOENT')
      err.code = 'ENOENT'
      return err
    }
    const io = {
      writes: /** @type {string[]} */ ([]),
      lstatSync(p) {
        const e = get(p)
        if (!e) throw enoent()
        if (e.err) {
          const err = new Error(e.err)
          err.code = e.err
          throw err
        }
        return {
          isSymbolicLink: () => e.link !== undefined,
          isDirectory: () => e.dir !== undefined,
          mtimeMs: e.file !== undefined ? e.file.mtimeMs : 0,
        }
      },
      readdirSync(p) {
        const e = get(p)
        if (!e || e.dir === undefined) throw enoent()
        return e.dir
      },
      readFileSync(p) {
        const e = get(p)
        if (e && e.text !== undefined) return e.text
        throw enoent()
      },
      readlinkSync(p) {
        const e = get(p)
        if (e && e.link !== undefined) return e.link
        const err = new Error('EINVAL')
        err.code = 'EINVAL'
        throw err
      },
      writeFileSync(p) {
        io.writes.push(`write:${p}`)
      },
      mkdirSync() {
        io.writes.push('mkdir')
      },
      renameSync() {
        io.writes.push('rename')
      },
      rmSync(p) {
        io.writes.push(`rm:${p}`)
      },
      spawnSync() {
        io.writes.push('spawn')
        return { status: 0 }
      },
    }
    return io
  }

  // ── latestWrite 三态与阈值 ──
  push('latestWrite:61 分钟静默 ⇒ ok 且 quietMinutes≥60', (() => {
    const r = latestWrite(fakeIO({ '/old': { dir: ['a.txt'] }, '/old/a.txt': f(61) }), '/old', NOW)
    return r.kind === 'ok' && r.quietMinutes >= 60 && r.truncated === false
  })())
  push('latestWrite:59 分钟内有写入 ⇒ ok 但 <60(交给 verdict 判 pending)', (() => {
    const r = latestWrite(fakeIO({ '/old': { dir: ['a.txt'] }, '/old/a.txt': f(59) }), '/old', NOW)
    return r.kind === 'ok' && r.quietMinutes < 60
  })())
  push('latestWrite:目录不存在 ⇒ absent(不猜静默时长)', (() => {
    const r = latestWrite(fakeIO({}), '/nope', NOW)
    return r.kind === 'absent' && r.quietMinutes === null
  })())
  push('latestWrite:枚举截断 ⇒ undetermined(未见 ≠ 不存在)', (() => {
    const io2 = fakeIO({ '/big': { dir: ['x'] } })
    io2.readdirSync = () => Array.from({ length: ENUM_BUDGET + 1 }, (_, i) => `x${i}`)
    const r = latestWrite(io2, '/big', NOW)
    return r.kind === 'undetermined' && r.truncated === true
  })())
  push('latestWrite:单条 lstat 失败 ⇒ undetermined(漏看的可能正是最新写入)', (() => {
    const r = latestWrite(
      fakeIO({ '/old': { dir: ['a.txt', 'bad.bin'] }, '/old/a.txt': f(90), '/old/bad.bin': { err: 'EPERM' } }),
      '/old',
      NOW,
    )
    return r.kind === 'undetermined' && /EPERM/.test(r.why || '')
  })())

  // ── 重解析点穿透防护(§26,真夹具端到端)──
  {
    const root = mkScratch('ihui-devenv-mig-')
    try {
      const j = join(root, 'legacy-root')
      mkdirSync(j, { recursive: true })
      writeFileSync(join(j, 'old.txt'), 'x', 'utf8')
      const inner = join(root, 'inner-target')
      mkdirSync(inner, { recursive: true })
      writeFileSync(join(inner, 'recent.txt'), 'y', 'utf8') // mtime = 现在
      const mk = spawnSync('cmd.exe', ['/c', 'mklink', '/J', join(j, 'linked'), inner], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        encoding: 'utf8',
      })
      // 夹具目录与文件的 mtime 都要拨旧:建夹具/写文件的每一步都会刷新父目录 mtime,
      // 而目录自身 mtime(条目增删时刻)是 latestWrite 的合法「写入」证据 —— 最后统一拨旧。
      const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
      utimesSync(join(j, 'old.txt'), staleAt, staleAt)
      utimesSync(j, staleAt, staleAt)
      const linkOk = (() => {
        try {
          return lstatSync(join(j, 'linked')).isSymbolicLink()
        } catch {
          return false
        }
      })()
      push('夹具 junction 建成(建不出 = 本组穿透判据未被覆盖)', linkOk, `rc=${mk.status} ${mk.stderr || ''}`)
      if (linkOk) {
        const r = latestWrite(defaultIO(), j, Date.now())
        push('§26:junction 内 0 秒前的新文件不得把旧根判成活跃(枚举穿透防护)', r.kind === 'ok' && (r.quietMinutes ?? 0) >= 60, JSON.stringify(r).slice(0, 160))
        push('§26:junction 被计数为跳过项(穿透即 false)', r.junctions === 1, `junctions=${r.junctions}`)
      }
    } finally {
      rmScratch(root)
    }
  }

  // ── guardianTickAlive ──
  push('guardian:留痕新鲜(2 分钟)⇒ alive 且回读末条', (() => {
    const iso = new Date(NOW - 2 * MIN).toISOString()
    const r = guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: `[${iso}] 行\n` } }), NOW)
    return r.state === 'alive' && r.lastIso === iso
  })())
  push('guardian:留痕过期(20 分钟 > 15)⇒ undetermined(失明期静默不可信)', (() => {
    const iso = new Date(NOW - 20 * MIN).toISOString()
    const r = guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: `[${iso}] 行\n` } }), NOW)
    return r.state === 'undetermined' && /未 tick/.test(r.why || '')
  })())
  push('guardian:留痕读不到 ⇒ undetermined(不猜)', guardianTickAlive(fakeIO({}), NOW).state === 'undetermined')
  push(
    'guardian:无时间戳行(中文散文)⇒ undetermined(不猜)',
    guardianTickAlive(fakeIO({ [GUARDIAN_LOG]: { text: '中文散文行,无 ISO 戳\n' } }), NOW).state === 'undetermined',
  )

  // ── probeQuietWindow 汇总三态(tree 键 = 真实常量路径,与探测器所问逐字同形)──
  const K = { legacy: LEGACY_ROOT, tmp: SESSION_TMP, probe: TMP_PROBE, log: GUARDIAN_LOG }
  const probeTree = ({ legacyMin = 90, tmpMin = 40, guardianAgeMin = 2 } = {}) => {
    const iso = new Date(NOW - guardianAgeMin * MIN).toISOString()
    return {
      [K.legacy]: { dir: ['a'] },
      [`${K.legacy}\\a`]: f(legacyMin),
      [K.tmp]: { dir: ['t'] },
      [`${K.tmp}\\t`]: f(tmpMin),
      [K.probe]: { dir: ['p'] },
      [`${K.probe}\\p`]: f(120),
      [K.log]: { text: `[${iso}] tick\n` },
    }
  }
  push('probe:两判据全过 ∧ 守护活 ⇒ window', probeQuietWindow(fakeIO(probeTree()), NOW).state === 'window')
  push('probe:旧根 59 分钟内有写入 ⇒ pending 且点名判①', (() => {
    const r = probeQuietWindow(fakeIO(probeTree({ legacyMin: 59 })), NOW)
    return r.state === 'pending' && r.reasons.some((s) => s.includes('判①'))
  })())
  push('probe:tmp 探针 29 分钟前写入 ⇒ pending 且点名判②', (() => {
    const r = probeQuietWindow(fakeIO(probeTree({ tmpMin: 29 })), NOW)
    return r.state === 'pending' && r.reasons.some((s) => s.includes('判②'))
  })())
  push('probe:守护留痕过期(40 分钟)⇒ undetermined(不是 window 也不是 pending)', (() => {
    return probeQuietWindow(fakeIO(probeTree({ guardianAgeMin: 40 })), NOW).state === 'undetermined'
  })())

  // ── assessSteps(构造面文本注入 + 真实清单存在性)──
  const fakeWith = (over) => fakeIO({ [GITIGNORE]: { text: '.DevEnv/' }, [SEAL_SCRIPT]: { text: '[inRepo]' }, ...over })
  push('assessSteps S4:.gitignore 有 .DevEnv/ ⇒ done 带行号', (() => {
    const s = assessSteps(fakeWith({ [GITIGNORE]: { text: 'node_modules/\n.DevEnv/\n' } })).find((x) => x.id === 4)
    return s.state === 'done' && /:2 = \.DevEnv\//.test(s.evidence)
  })())
  push('assessSteps S4:无条目 ⇒ todo', assessSteps(fakeWith({ [GITIGNORE]: { text: 'node_modules/\n' } })).find((x) => x.id === 4).state === 'todo')
  push('assessSteps S6:devEnvTargetRoots 双根在役 ⇒ todo', assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: '[inRepo, legacy]' } })).find((x) => x.id === 6).state === 'todo')
  push('assessSteps S6:单根 ⇒ done', assessSteps(fakeWith()).find((x) => x.id === 6).state === 'done')
  push('assessSteps S3:活代码命中(非注释行)⇒ todo;纯注释命中 ⇒ done 且计数如实', (() => {
    const a = assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: "const a = 'G:/DevEnv/secrets'\n" } })).find((x) => x.id === 3)
    const b = assessSteps(fakeWith({ [SEAL_SCRIPT]: { text: '// G:\\DevEnv 历史叙述\n' } })).find((x) => x.id === 3)
    return a.state === 'todo' && /活代码 1/.test(a.evidence) && b.state === 'done' && /注释 1/.test(b.evidence)
  })())
  push('assessSteps:六步齐(1..6)且 S5 恒 apply-gate', (() => {
    const s = assessSteps(fakeWith())
    return s.length === 6 && s.map((x) => x.id).join(',') === '1,2,3,4,5,6' && s.find((x) => x.id === 5).state === 'apply-gate'
  })())
  push('HARD_CODED_FILES 8 个文件真实存在(清单与磁盘同面)', HARD_CODED_FILES.every((rel) => existsSync(join(ROOT, rel))))

  // ── 零写盘行为锁(默认路径函数在记录型 io 上零写族调用)+ apply 前置闸 ──
  push('默认档(probe+assess+plan)零写盘(行为锁:记录型 io 零 write 族调用)', (() => {
    const io2 = fakeIO(probeTree())
    const r1 = probeQuietWindow(io2, NOW)
    const r2 = assessSteps(io2)
    planSteps(r2, r1)
    return io2.writes.length === 0
  })())
  push('apply 前置闸:pending/undetermined ⇒ refused 且零写调用', (() => {
    const io2 = fakeIO(probeTree())
    const r1 = applyMigration(io2, { state: 'pending', reasons: ['x'] })
    const r2 = applyMigration(io2, { state: 'undetermined', reasons: ['y'] })
    return r1.refused && r2.refused && io2.writes.length === 0
  })())

  // ── 形状锁(§22c 先例:re-home 装车锁)──
  const SRC = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  push('形状锁:io 写族调用只许出现在 applyMigration 起至 selfTest 前的区间(默认档零写盘的静态半边)', (() => {
    const applyStart = SRC.indexOf('export function applyMigration')
    const selfStart = SRC.indexOf('function selfTest')
    if (applyStart < 0 || selfStart < 0 || selfStart < applyStart) return false
    const writeCall = /io\.(writeFileSync|mkdirSync|renameSync|rmSync)\(/
    return !writeCall.test(SRC.slice(0, applyStart)) && !writeCall.test(SRC.slice(selfStart))
  })())
  push('形状锁:isDirectRun 双形态在位(§22d 模板)', /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/.test(SRC) && SRC.includes('main().catch'))
  push('形状锁:--apply 顺序 1→6 编码在位(步骤号逐字出现且递增)', (() => {
    const body = SRC.slice(SRC.indexOf('export function applyMigration'), SRC.indexOf('function safeReaddir'))
    const at = [1, 2, 3, 4, 5, 6].map((n) => body.indexOf(`step: ${n},`))
    return at.every((v) => v > 0) && at.every((v, i) => i === 0 || v > at[i - 1])
  })())
  push('形状锁:受控替换必经水印三段(clean 先于写回先于 inject,§5c)', (() => {
    const body = SRC.slice(SRC.indexOf('function controlledEdit'), SRC.indexOf('function ensureGitignoreEntry'))
    const atClean = body.indexOf("wm('clean')")
    // 字面量拆写:本锁的检索串不得在源码中构成完整的「io 点写族调用」子串,
    // 否则上面的「写族区间锁」会被本锁自己的检索串误触发(2026-10-25 实测,连注释也不豁免)。
    const atWrite = body.indexOf('io.write' + 'FileSync(filePath, next')
    const atInj = body.indexOf("wm('inject')")
    return atClean > 0 && atWrite > atClean && atInj > atWrite
  })())

  const { fail, cases } = report()
  for (const c of cases) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— ${c.got}`}`)
  console.log(`\n${fail ? `❌ ${fail} 例失败` : `全部 ${cases.length} 例通过`}`)
  process.exit(fail ? 1 : 0)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const apply = argv.includes('--apply')
  const probeOnly = argv.includes('--probe')
  const io = defaultIO()
  const probe = probeQuietWindow(io)
  console.log(`[G-50 devenv-migrate] 旧根 ${LEGACY_ROOT} → 新根 ${NEW_ROOT}`)
  console.log(`静默窗口:${probe.state}`)
  for (const r of probe.reasons) console.log(`  · ${r}`)
  if (probeOnly) process.exit(probe.state === 'window' ? 0 : probe.state === 'pending' ? 1 : 2)
  const assessed = assessSteps(io)
  console.log('\n票面六步盘点(现读):')
  for (const s of assessed) console.log(`  步骤${s.id} [${s.state}] ${s.title}\n          ${s.evidence}`)
  console.log('\n预演:')
  for (const l of planSteps(assessed, probe)) console.log(`  ${l}`)
  if (!apply) {
    console.log('\n默认档零写盘。要执行:node scripts/devenv-migrate.mjs --apply(仅 window 态放行)')
    process.exit(probe.state === 'window' ? 0 : probe.state === 'pending' ? 1 : 2)
  }
  const r = applyMigration(io, probe)
  if (r.refused) {
    console.error(`❌ --apply 被拒绝:${r.reason}`)
    process.exit(3)
  }
  let bad = 0
  console.log('\n--apply 执行流水:')
  for (const row of r.rows) {
    if (!row.ok) bad++
    console.log(`  ${row.ok ? '·' : '❌'} [步骤${row.step}] ${row.note}`)
  }
  console.log(r.verified ? '\n回读验证通过' : '\n回读验证不过,交人工裁决(未回滚不可逆步)')
  process.exit(bad || !r.verified ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  latestWrite,
  guardianTickAlive,
  probeQuietWindow,
  assessSteps,
  planSteps,
  applyMigration,
  defaultIO,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
