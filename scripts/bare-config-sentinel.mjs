#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 为什么必须有本件(与守护侧取证不是重复建设):
//   发作是 `git config` 这种几十毫秒的子进程,git-guardian 每 2 分钟一巡、归一时刻抓的
//   进程清单里**瞬态写入者大概率已退场**(票面原话:"靠归一时刻抓进程等于抓不到")。
//   本件以 1s 级轮询盯活仓库/恢复源两侧 config 的 mtime+size+全文哈希,变化瞬间把
//   **变化窗口**(上次观测~本次观测)+ 前后全文哈希 + 当刻进程快照一起落件 ——
//   写入者若是常驻进程(IDE/守护/计划任务)必然在快照里;若是一次性子进程,
//   "变化窗口"本身就把它的作案时间收窄到 ≤interval,与守护 flip-*.json 的规则②
//   (进程生日 ≈ config mtime)在更窄的锚点上互证。
//
// 边界三条(与 §22d / §0.3 对齐):
//   ① 纯读:绝不写 config,绝不调 git 写路径;唯一写面是 .ihui-agent/state/bare-sentinel/(已
//      被 .gitignore 整目录覆盖的运行态落点,与守护 BARE_AUDIT_DIR 同区,互不覆盖)。
//   ② 空清单不得记 ok:进程快照失败/为空一律进 selfCheck.reasons(复用守护
//      bareAuditSelfCheck,同一把尺,不另抄一份)。
//   ③ 量不到不折成判过:哈希读不到记 {sha256:null, reason},绝不印空哈希。
//
// 用法:
//   node scripts/bare-config-sentinel.mjs [--interval=1000] [--once=N] [--daemon]
//        [--gitdir=PATH] [--backup=PATH] [--out=DIR] [--quiet]
//   默认(无参) = --once=1:建立/推进基线一轮即退,便于手动触发与计划任务拉起。
//   --daemon   = 常驻轮询(Ctrl+C 停)。
//
// 事件件形状:.ihui-agent/state/bare-sentinel/event-<ISOstamp>-<side>.json,保留最新 20 份。

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { describeFlagToken, flagValue } from './lib/flag-value.mjs'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'

// —— 单一真相源复用(不另抄第二份实现,两处各写必然漂移):——
// git-guardian.mjs 有 §22d isDirectRun 直跑守卫,import 纯判据不会触发巡检/发信。
// 判据一律从 __test__ 出口取(该模块的镜像测试出口,§22c 约定形态)。
import { __test__ as G } from './git-guardian.mjs'
const { parseProcessSnapshot, selectBareFlipCandidates, bareAuditSelfCheck, BARE_AUDIT_WINDOW_MS } = G
import { resolveWorktree, resolveGitdir, resolveBackupDir } from './lib/gitdir.mjs'

const EVENT_KEEP = 20
const EVENT_FILE_RE = /^event-[0-9A-Za-z._-]+\.json$/
/** 哨兵自留的"该人登记过"日期(报告/件内 SINCE 语义,与守护 BARE_AUDIT_SINCE 分开:两维在位日不同) */
export const SENTINEL_SINCE = '2026-10-18'

// ————————————————————————————————————————————————————————————————
// 纯函数(判据只落在这里,CLI 循环只是取样机;镜像测试只喂构造面,不依赖真仓)
// ————————————————————————————————————————————————————————————————

/**
 * 纯文本解析 config 里的 `bare` 行(轻量轮询为此不 spawn git —— 每秒一次 git 子进程
 * 就不是"轻量"了)。返回三态:`true / false / null(键不存在)` + 读法说明;
 * 解析不出原文一律原样带回,绝不把"没读到"折成"false"(§0.3)。
 * 注:config 里 `bare` 实际只出现在 [core] 段,但纯文本不追段名 —— 段感知交给
 * git 读数(守护 readBareFlag),本函数只做哨兵级初筛,两读数不一致的件会带
 * `bareReader` 字段点名,不冒充 git 的判词。
 */
export function readBareFromConfigText(text) {
  const s = String(text ?? '')
  if (!s) return { bare: null, raw: null, why: 'config 全文为空' }
  const m = s.match(/^[ \t]*bare[ \t]*=[ \t]*(\S+)[ \t]*$/m)
  if (!m) return { bare: null, raw: null, why: 'config 里没有 bare 行(键不存在或被注释)' }
  const v = m[1].toLowerCase()
  if (v !== 'true' && v !== 'false') {
    return { bare: null, raw: m[1], why: `bare 行取到非布尔值:${m[1]}(不猜,原样带回)` }
  }
  return { bare: v === 'true', raw: m[1], why: null }
}

/** stat 读数,取不到的字段点名原因(不折成 0) */
function statSide(configFile) {
  if (!configFile || !existsSync(configFile)) {
    return { configFile: configFile || null, exists: false, mtimeMs: null, size: null, why: 'config 文件不存在' }
  }
  try {
    const st = statSync(configFile)
    return { configFile, exists: true, mtimeMs: st.mtimeMs, size: st.size, why: null }
  } catch (e) {
    return { configFile, exists: true, mtimeMs: null, size: null, why: 'stat 失败:' + String((e && e.message) || e) }
  }
}

/** 全文读数(哈希 + bare 行),读不到记 reason,不折空 */
function contentSide(configFile) {
  if (!configFile || !existsSync(configFile)) {
    return { configFile: configFile || null, sha256: null, bytes: null, bare: null, bareRaw: null, why: 'config 文件不存在' }
  }
  try {
    const buf = readFileSync(configFile)
    const bareRead = readBareFromConfigText(buf.toString('utf8'))
    return {
      configFile,
      sha256: createHash('sha256').update(buf).digest('hex'),
      bytes: buf.length,
      bare: bareRead.bare,
      bareRaw: bareRead.raw,
      bareWhy: bareRead.why,
      why: null,
    }
  } catch (e) {
    return { configFile, sha256: null, bytes: null, bare: null, bareRaw: null, why: '读全文失败:' + String((e && e.message) || e) }
  }
}

/**
 * 两轮读数的变化分档 —— 纯函数。分档语义:
 *   content-change ⇒ 真写入(哈希变),severity 最低 'change';
 *   mtime-only     ⇒ 哈希同而 mtime/size 变(touch/重写同内容),severity 'touch';
 *   appear/vanish  ⇒ 文件出现/消失,'change'(vanish 对活仓库是重伤,翻 'critical');
 *   bare-true      ⇒ 任一时刻 bare 读成 true ⇒ 'flip-true'(发作件);
 *   none           ⇒ 无变化。
 * 顺序刻意是:bare-true 盖过 content-change(发作优先定名),vanish 盖过 bare(文件都没了,bare 无从谈起)。
 */
export function classifySideChange(before, after) {
  const b = before || null
  const a = after || null
  if (b && b.exists === false && a && a.exists === true) return { kind: 'appear', severity: 'change' }
  if (b && b.exists === true && a && a.exists === false) return { kind: 'vanish', severity: 'critical' }
  if (!b || !a) return { kind: 'none', severity: 'none' } // 首轮建基线,没有 before 可言
  if (a.bare === true) return { kind: 'flip-true', severity: 'flip-true' }
  if (b.sha256 && a.sha256 && b.sha256 !== a.sha256) {
    // true→false 的归一也是写入者(那是守护自己),单独定名,免得把守护当嫌疑人冤判
    const kind = b.bare === true && a.bare === false ? 'heal-false' : 'content-change'
    return { kind, severity: 'change' }
  }
  if (
    (b.mtimeMs !== null && a.mtimeMs !== null && b.mtimeMs !== a.mtimeMs) ||
    (b.size !== null && a.size !== null && b.size !== a.size)
  ) {
    return { kind: 'mtime-only', severity: 'touch' }
  }
  return { kind: 'none', severity: 'none' }
}

/**
 * 快照候选锚 —— 把"变化窗口"翻译成 selectBareFlipCandidates 的 anchor/window 语义:
 * anchor=窗口中点,window=窗口半宽 + BARE_AUDIT_WINDOW_MS(±10 分钟,与守护规则②同窗)。
 * 传入窗口两端取不到(null)时退化为 anchor=now、window=BARE_AUDIT_WINDOW_MS,并在件里
 * 报 `anchorDegraded`(窗口量不到 ≠ 窗口无限宽,两件事)。
 */
export function anchorForWindow(windowStartMs, windowEndMs, nowMs) {
  if (Number.isFinite(windowStartMs) && Number.isFinite(windowEndMs)) {
    return { anchorMs: (windowStartMs + windowEndMs) / 2, windowMs: (windowEndMs - windowStartMs) / 2 + BARE_AUDIT_WINDOW_MS, anchorDegraded: false }
  }
  return { anchorMs: Number.isFinite(nowMs) ? nowMs : null, windowMs: BARE_AUDIT_WINDOW_MS, anchorDegraded: true }
}

/** 事件件名与保留决策(形状唯一一份;清理不跟随重解析点,与守护同型禁令) */
export function eventFileName(now = new Date()) {
  return 'event-' + now.toISOString().replace(/[:.]/g, '-') + '.json'
}
export function decideEventRetention(entries, keep = EVENT_KEEP) {
  const matched = []
  const skipped = []
  for (const e of entries || []) {
    if (EVENT_FILE_RE.test(String(e.name || ''))) matched.push(e)
    else skipped.push({ name: String(e.name || ''), reason: '不是 event-*.json 形状(保留期不得碰它)' })
  }
  matched.sort((x, y) => String(x.name).localeCompare(String(y.name)))
  const keepSet = new Set(matched.slice(-keep).map((e) => e.name))
  return { remove: matched.filter((e) => !keepSet.has(e.name)).map((e) => e.name), keep: [...keepSet], skipped }
}

/** 事件件原子落盘(tmp + rename),失败只报名不抛(取证失败不得拦住轮询) */
function writeEventAtomic(dir, name, obj) {
  const final = join(dir, name)
  const tmp = join(dir, '.' + name + '.tmp')
  try {
    writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n')
    renameSync(tmp, final)
    return { ok: true, file: final }
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp) } catch { /* 清不掉就留着,.开头不进保留判据 */ }
    return { ok: false, why: String((e && e.message) || e) }
  }
}

// ————————————————————————————————————————————————————————————————
// CLI 循环(取样机)
// ————————————————————————————————————————————————————————————————

function argValue(flag, def) {
  // 两种形态都认:`--flag value` 与 `--flag=value`。只认前者的话,等号形态会被静默
  // 当成"没传"而 fallback 到默认(真仓 gitdir/落点)—— 对本件等价于"夹具测试把事件
  // 件写进活仓运行态目录",这是高危静默失效,所以两形态必须都显式认。
  const eq = process.argv.find((a) => a.startsWith(flag + '='))
  if (eq !== undefined) {
    const v = eq.slice(flag.length + 1)
    // 等号形空值(`--out=`)旧写法与"没给"同形 ⇒ 静默落到默认落点。判死,不猜意图。
    if (v === '') {
      console.error(`用法错:${flag} 需要一个值 —— 等号后为空(不得静默回落默认)`)
      process.exit(2)
    }
    return v
  }
  // 空格形态走 G-322 单源:紧邻 token 是另一枚旗标或结尾无值不得当值吞掉,也不得回落默认
  // (采样器的 gitdir/落点错位 = 事件写进别的仓还报正常)。点名叫用法错并 exit 2。
  const f = flagValue(process.argv, flag)
  if (f.present && !f.valid) {
    console.error(`用法错:${flag} 需要一个值,紧邻的 token 实得:${describeFlagToken(f)}(不得吞掉相邻旗标/回落默认)`)
    process.exit(2)
  }
  return f.valid ? f.value : def
}
function hasFlag(flag) {
  return process.argv.includes(flag)
}

function outDir(worktree) {
  return join(worktree, '.ihui-agent', 'state', 'bare-sentinel')
}

/** 进程快照:win32 走 PowerShell(与守护同一形态,三态失败各自点名);其他平台不取 */
function snapshotProcesses() {
  if (process.platform !== 'win32') {
    return { state: 'not-win32', reason: `非 win32 平台(${process.platform}),进程清单无从取`, stdout: '' }
  }
  // PowerShell 脚本与守护 PS_PROCESS_SNAPSHOT 同形;此处独立持有是因为守护未导出该常量,
  // 改守护理由见交付说明:本件刻意不复制其**判据**(parse/select/selfCheck 全部 import),
  // 只复制**取样文本** —— 取样文本的两份实现若漂移,只影响可读性不影响判词,而判据只有一份。
  const PS = [
    'try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }',
    'Get-CimInstance Win32_Process | ForEach-Object {',
    '  $cd = ""',
    '  if ($_.CreationDate) { $cd = [string]$_.CreationDate }',
    '  $cl = ""',
    '  if ($_.CommandLine) { $cl = ("" + $_.CommandLine) -replace "[\\r\\n\\t]+", " " }',
    '  $pp = ""',
    '  if ($_.ParentProcessId) { $pp = [string]$_.ParentProcessId }',
    '  Write-Output ("" + $_.Name + "|" + $_.ProcessId + "|" + $pp + "|" + $cd + "|" + $cl)',
    '}',
  ].join('\n')
  const bin = join(process.env.SystemRoot || 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  if (!existsSync(bin)) return { state: 'no-powershell', reason: 'Windows PowerShell 绝对路径不存在:' + bin, stdout: '' }
  try {
    const stdout = execFileSync(bin, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    return { state: 'ok', reason: null, stdout: String(stdout || '') }
  } catch (e) {
    const code = e && e.code
    if (code === 'ENOENT') return { state: 'enoent', reason: '派生 powershell 失败(ENOENT)', stdout: '' }
    const killed = Boolean(e && (e.signal === 'SIGTERM' || /timed out|ETIMEDOUT/i.test(String((e && e.message) || ''))))
    if (killed) return { state: 'timeout', reason: 'PowerShell 被本件 timeout(20s) 终止', stdout: '' }
    return { state: 'failed', reason: 'PowerShell 非零退出:' + String((e && e.message) || e).split('\n')[0], stdout: String((e && e.stdout) || '') }
  }
}

/** 一轮观测:两侧各出一行读数;return 格式供 CLI 打印与事件件共用 */
function observeSide(side, configFile) {
  const st = statSide(configFile)
  const ct = contentSide(configFile)
  return {
    side,
    path: configFile,
    exists: st.exists,
    mtimeMs: st.mtimeMs,
    size: st.size,
    statWhy: st.why,
    sha256: ct.sha256,
    bytes: ct.bytes,
    bare: ct.bare,
    bareRaw: ct.bareRaw,
    bareWhy: ct.bareWhy ?? ct.why,
    readWhy: ct.why ?? st.why,
  }
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log('用法: node scripts/bare-config-sentinel.mjs [--interval=1000] [--once=N] [--daemon] [--gitdir=PATH] [--backup=PATH] [--out=DIR] [--quiet]')
    return 0
  }
  const worktree = resolveWorktree()
  const gitdir = argValue('--gitdir', null) || resolveGitdir(worktree)
  const backup = argValue('--backup', null) || resolveBackupDir(worktree)
  const dir = argValue('--out', null) || outDir(worktree)
  const interval = Math.max(200, Number(argValue('--interval', '1000')))
  const daemon = hasFlag('--daemon')
  const once = daemon ? Infinity : Math.max(1, Number(argValue('--once', '1')))
  const quiet = hasFlag('--quiet')

  const sides = [
    { side: 'live', configFile: join(gitdir, 'config') },
    { side: 'backup', configFile: join(backup, 'config') },
  ]
  mkdirSync(dir, { recursive: true })
  /** 基线:上一轮读数(持久化,让"手动跑一轮"也能与上次构成窗口) */
  const stateFile = join(dir, 'state.json')
  let baseline = {}
  try {
    baseline = JSON.parse(readFileSync(stateFile, 'utf8'))
  } catch { /* 无基线 = 首轮 */ }

  let rounds = 0
  const tick = () => {
    rounds += 1
    const nowMs = Date.now()
    const events = []
    for (const { side, configFile } of sides) {
      const prev = baseline[side] || null
      const cur = observeSide(side, configFile)
      const change = classifySideChange(prev, cur)
      if (change.kind !== 'none') {
        const winStart = prev && Number.isFinite(prev.observedAtMs) ? prev.observedAtMs : null
        const { anchorMs, windowMs, anchorDegraded } = anchorForWindow(winStart, nowMs, nowMs)
        const snap = snapshotProcesses()
        const parsed = parseProcessSnapshot(snap.stdout)
        const candidates = selectBareFlipCandidates(parsed.processes, { anchorMs, windowMs })
        const cmdlineMissing = parsed.processes.filter((p) => !p.__cmdlineReadable).length
        const timeMissing = parsed.processes.filter((p) => p.__createdMs === null).length
        const selfCheck = bareAuditSelfCheck({
          spawn: { state: snap.state, reason: snap.reason },
          processes: parsed.processes,
          malformedCount: parsed.malformed.length,
          cmdlineMissing,
          timeMissing,
          anchorMs,
        })
        selfCheck.counts.candidates = candidates.length
        const event = {
          schema: 'bare-config-sentinel-event/v1',
          since: SENTINEL_SINCE,
          detectedAt: new Date(nowMs).toISOString(),
          side,
          configFile,
          kind: change.kind,
          severity: change.severity,
          window: {
            startMs: winStart,
            endMs: nowMs,
            startIso: winStart ? new Date(winStart).toISOString() : null,
            endIso: new Date(nowMs).toISOString(),
            widthMs: winStart ? nowMs - winStart : null,
            undetermined: winStart === null ? '上次观测时刻取不到 ⇒ 窗口未判定(不读成"窗口无限宽")' : null,
          },
          before: prev
            ? { exists: prev.exists, sha256: prev.sha256 ?? null, bytes: prev.bytes ?? null, bare: prev.bare ?? null, observedAt: prev.observedAtIso ?? null }
            : null,
          after: { exists: cur.exists, sha256: cur.sha256, bytes: cur.bytes, bare: cur.bare, bareRaw: cur.bareRaw, bareWhy: cur.bareWhy ?? null },
          anchor: { anchorMs, windowMs, anchorDegraded },
          snapshot: { state: snap.state, reason: snap.reason },
          selfCheck,
          candidates,
          malformed: parsed.malformed.slice(0, 20),
          note: '候选名单只列"命中规则"的进程;规则②窗口已按本件变化窗口放宽。写入者若是一次性子进程且已退场,快照里不会有它 —— 那时定名靠窗口宽度 + 守护 flip-*.json 规则②互证。',
        }
        const name = eventFileName(new Date(nowMs)).replace('.json', `-${side}.json`)
        const w = writeEventAtomic(dir, name, event)
        events.push({ side, kind: change.kind, severity: change.severity, file: w.file || null, writeWhy: w.ok ? null : w.why, candidates: candidates.length })
        if (!quiet) {
          const line = `[bare-sentinel] ${event.detectedAt} ${side}: ${change.kind}(severity=${change.severity}) ` +
            `bare ${prev ? prev.bare ?? '未判定' : '—'}→${cur.bare ?? '未判定'} | 快照=${snap.state} 候选=${candidates.length}` +
            (w.ok ? '' : ` | 落件失败:${w.why}`)
          console.log(line)
        }
      }
      baseline[side] = {
        exists: cur.exists,
        mtimeMs: cur.mtimeMs,
        size: cur.size,
        sha256: cur.sha256,
        bytes: cur.bytes,
        bare: cur.bare,
        observedAtMs: nowMs,
        observedAtIso: new Date(nowMs).toISOString(),
      }
    }
    // 基线原子写回(首轮也写,让 --once=1 手动跑就把起点立起来)
    try {
      const tmp = stateFile + '.tmp'
      writeFileSync(tmp, JSON.stringify(baseline, null, 2) + '\n')
      renameSync(tmp, stateFile)
    } catch (e) {
      if (!quiet) console.log(`[bare-sentinel] 基线写回失败(下轮窗口会变宽): ${String((e && e.message) || e)}`)
    }
    // 保留期清理:只认 event-*.json 形状
    try {
      const ret = decideEventRetention(readdirSync(dir).map((name) => ({ name })), EVENT_KEEP)
      for (const name of ret.remove) {
        try { unlinkSync(join(dir, name)) } catch { /* 别的持有者先删了就算了 */ }
      }
    } catch { /* 目录读不到不拦轮询 */ }
    return events
  }

  if (!quiet && daemon) console.log(`[bare-sentinel] 常驻轮询启动: interval=${interval}ms gitdir=${gitdir} backup=${backup} 落件=${dir}`)
  // 首轮立即执行,daemon 则 setInterval
  tick()
  if (daemon) {
    const timer = setInterval(() => {
      try { tick() } catch (e) { console.log(`[bare-sentinel] 本轮异常(下轮继续): ${String((e && e.message) || e)}`) }
    }, interval)
    const stop = () => { clearInterval(timer); process.exit(0) }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    return undefined // daemon 不退出
  }
  // once=N 模式:首轮已跑,再补 N-1 轮(轮间停 interval)。--once=2 就是"立基线后隔一个
  // interval 再观测一轮",给手动触发一个能构成短窗口的形态。async 等待 —— 主线程没有
  // 同步 sleep,Atomics.wait 在主线程是被禁的(实测直接抛 TypeError)。
  while (rounds < once) {
    await new Promise((r) => setTimeout(r, interval))
    try { tick() } catch (e) { console.log(`[bare-sentinel] 本轮异常(下轮继续): ${String((e && e.message) || e)}`) }
  }
  if (!quiet) console.log(`[bare-sentinel] 完成 ${rounds} 轮观测(once 模式);基线已写 ${basename(stateFile)}`)
  return 0
}

// §22d 直跑守卫:import 只取纯函数,不进轮询
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((rc) => { if (rc !== undefined) process.exit(rc) })
    .catch((e) => { console.error('[bare-sentinel] fatal:', e); process.exit(1) })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
