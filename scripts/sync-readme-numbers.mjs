#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/sync-readme-numbers.mjs
// ─────────────────────────────────────────────────────────────────────────
// 对外文档数字生成块(BEGIN/END GENERATED NUMBERS)的**唯一写入口**(2026-11-07 收口)。
//
// 病灶:先前不止一个进程会写这段块(提交前/提交后/safe-commit/auto-commit 各调一遍,
// 且有人手工跑 `gen-doc-numbers.mjs --markdown` 粘进 README)。取数面一旦不统一,
// 同一批数字就会同时以 worktree / 索引 / HEAD 三份形态并存,门 173(判索引面)与
// DN2(判 HEAD 面)各算各的 ⇒ 同一轮出现"173 绿 / DN2 红"的互斥读数。
//
// 唯一性由三道闸共同保证,缺一不可:
//   ① 取数面唯一:只按**索引面**(`--face=staged`)取数 —— 索引面就是"提交之后会变成的 HEAD 面",
//      写手与两道判据同面;`--face=worktree|head` 一律 exit 2(未暂存/未跟踪会抬高 trackedFiles,
//      产物谁也满足不了)。面旗不再靠默认值猜,显式传给 gen-doc-numbers。
//   ② 入口唯一:`gen-doc-numbers.mjs --markdown` 需要写手令牌(`--writer=sync-readme-numbers`
//      或 env `IHUI_DOCNUM_WRITER`),其它调用方 exit 2 并报错(fail-loud,不静默覆盖)。
//      本器另持一把 gitdir 下的独占锁(`<git-dir>/ihui-docnum-writer.lock`):
//      并发第二个写手(含手工复跑)exit 2 并打印双方 pid,绝不排队后写。
//   ③ 写盘 CAS:替换前记下目标 sha256/大小/索引 blob,替换前后各复核一次;窗口内若被外部改过
//      ⇒ 判**未判定**(exit 3)、打印双方读数、不写盘 / 不 git add —— 不做「后写者赢」。
//
// 幂等:块内数字未变(忽略"最后核对日期"行)不写盘,不造自激提交。
// 安全闸:仅当"块外内容"相对索引版本无差异时才 git add,绝不吞并他人在飞的 prose 改动;
//        块外有差异 ⇒ 只写盘不 add,并提示单独提交。
// 退出码:0 = 成功(写盘或幂等无变化);2 = 拒绝(面不对 / 非唯一入口 / 锁被活进程持有);
//        3 = 未判定(写入窗口内被并发改过,已放弃写入)。
// ─────────────────────────────────────────────────────────────────────────
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT_ROOT = path.resolve(__dirname, '..')
const GEN = path.join(__dirname, 'gen-doc-numbers.mjs')
/** 唯一写手令牌:gen-doc-numbers 只认这一枚,别处传什么都不写。 */
const SELF_WRITER = 'sync-readme-numbers'
/** 唯一取数面:索引面 == 提交后会变成的 HEAD 面,与门 173 同面。 */
const WRITE_FACE = 'staged'

const ARGV = process.argv.slice(2)
function argValue(name) {
  const eq = ARGV.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const i = ARGV.indexOf(name)
  return i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith('-') ? ARGV[i + 1] : null
}
/** `--root=<dir>`:夹具/子仓用;缺省 = 本脚本所在仓。 */
const ROOT = path.resolve(argValue('--root') ?? SCRIPT_ROOT)

/**
 * 面旗判定:写手只认索引面。未知面 / 多面同给 / `--face=worktree|head` 全部 exit 2,
 * 绝不静默回落默认面(回落就是"另一面成了假绿")。
 */
function resolveWriteFace() {
  const picked = []
  for (let i = 0; i < ARGV.length; i += 1) {
    const a = ARGV[i]
    let name = null
    if (a === '--face' || a.startsWith('--face=')) {
      name = a === '--face' ? ARGV[i + 1] : a.slice('--face='.length)
      if (a === '--face') i += 1
      if (!name || name.startsWith('-')) return { face: null, error: '--face 缺取值(只认 staged / head / worktree)' }
    } else if (['--head', '--staged', '--worktree', '--index'].includes(a)) {
      name = a.slice(2)
    }
    if (name === null) continue
    picked.push(name === 'index' ? 'staged' : name)
  }
  const known = ['staged', 'head', 'worktree']
  if (picked.some((f) => !known.includes(f)))
    return { face: null, error: `未知判定面 ${picked.join('/')}(只认 staged / head / worktree)` }
  if (new Set(picked).size > 1) return { face: null, error: `面旗互斥(${picked.join(' 与 ')}),不许同给` }
  return { face: picked[0] ?? WRITE_FACE, explicit: picked.length > 0 }
}

const README_FILES = ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md']
/**
 * `--files=a.md,b.md`:只处理指定文件(2026-10-22 立)。
 * 调用方(safe-commit)只声明了 README.md 时,若本器顺手把 README.en 也 `git add` 进索引,
 * Step 3 的「暂存区精确匹配声明面」会判意外文件并整枚中止 —— 处理面必须与声明面同源。
 * 不带该参数 = 处理全部(独立运行/auto-commit 的既有语义)。
 */
const ONLY_FILES = (() => {
  const arg = process.argv.find((a) => a.startsWith('--files='))
  if (!arg) return null
  const set = new Set(arg.slice('--files='.length).split(',').map((s) => s.trim()).filter(Boolean))
  return set.size ? set : null
})()
const BEGIN = '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->'
const END = '<!-- END GENERATED NUMBERS -->'

/** 跑 git 命令,返回 stdout(utf8)。maxBuffer 放大到 64MB:README 等文件超 1MB 默认缓冲会 ENOBUFS。
 * 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio 由 gitRaw 同源提供。 */
function git(args) {
  return gitRaw(args, ROOT, { maxBuffer: 64 * 1024 * 1024 })
}

/**
 * 重新生成 README 生成块(含 BEGIN/END 标记)。
 * 显式三件套:唯一取数面 `--face=staged`、唯一写手令牌 `--writer=<SELF_WRITER>`、目标仓 `--root`。
 * 少任何一件 gen-doc-numbers 都会 exit 2 —— 本器不给"默认值兜底"留口子。
 */
function genBlockMarkdown() {
  return execFileSync(process.execPath, [GEN, '--markdown', `--face=${WRITE_FACE}`, `--writer=${SELF_WRITER}`, `--root=${ROOT}`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 写盘 CAS 与唯一锁要用到的原语:sha256 / 读数 / 索引 blob / 带 stdin 的 git。 */
function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
/** 从文本里取"跟踪文件"读数 —— 并发判未判定时,双方读数必须可比。 */
function trackedOf(text) {
  const m = /\|\s*跟踪文件\s*\|\s*(\d+)\s*\|/.exec(text)
  return m ? m[1] : '<无生成块>'
}
/** 目标文件的现场读数:sha256 + 大小 + mtime + trackedFiles。 */
function readingsOf(p) {
  const text = fs.readFileSync(p, 'utf8')
  const st = fs.statSync(p)
  return { text, sha: sha256(text), size: st.size, mtime: st.mtimeMs, tracked: trackedOf(text) }
}
function fmtReading(r) {
  return `sha256=${r.sha.slice(0, 16)}… size=${r.size} mtime=${new Date(r.mtime).toISOString()} trackedFiles=${r.tracked}`
}
/** 索引面 blob;文件不在索引里 ⇒ null(新建文件是合法态,不算失败)。 */
function indexBlob(f) {
  try {
    return git(['rev-parse', `:${f}`]).trim()
  } catch {
    return null
  }
}
/** 带 stdin 的 git(校验 git add 后的 blob 与写盘内容一致)。 */
function gitInput(args, input) {
  const r = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout.trim()
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
function readHolder(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8').trim()
    try {
      const j = JSON.parse(raw)
      return { pid: Number(j.pid), at: j.at ?? null, raw }
    } catch {
      const pid = Number((raw.match(/\d+/) ?? [])[0])
      return { pid, at: null, raw }
    }
  } catch {
    return null
  }
}
/**
 * 唯一写手锁:gitdir 下 `ihui-docnum-writer.lock`。
 * 用 `open(wx)` 原子抢占;已存在且持有者 pid 仍活 ⇒ 拒绝(exit 2),绝不排队后写;
 * 持有者已死(崩溃残留)⇒ 删掉重抢一次,不让一枚死锁永久堵死整条链。
 */
function acquireLock() {
  let gitDir
  try {
    gitDir = git(['rev-parse', '--git-dir']).trim()
  } catch (e) {
    return { ok: false, error: `无法定位 git 目录:${e.message}` }
  }
  const lockPath = path.resolve(ROOT, gitDir, 'ihui-docnum-writer.lock')
  const payload = JSON.stringify({ pid: process.pid, at: new Date().toISOString(), writer: SELF_WRITER })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx')
      fs.writeSync(fd, payload)
      fs.closeSync(fd)
      return { ok: true, lockPath }
    } catch (e) {
      if (e.code !== 'EEXIST') return { ok: false, error: `抢锁失败:${e.message}` }
      const holder = readHolder(lockPath)
      if (holder && pidAlive(holder.pid)) return { ok: false, lockPath, holder }
      try {
        fs.unlinkSync(lockPath)
      } catch {
        /* 已被别人清掉 ⇒ 下一轮重抢 */
      }
    }
  }
  return { ok: false, lockPath, holder: readHolder(lockPath) }
}
function releaseLock(lockPath) {
  try {
    const holder = readHolder(lockPath)
    if (holder && holder.pid === process.pid) fs.unlinkSync(lockPath)
  } catch {
    /* 已经不在 ⇒ 无需释放 */
  }
}

/** 剥离"最后核对日期"行,用于忽略日期滚动的纯 cosmetic 差异;trim 归一化块末换行避免行数差 1。 */
function stripDateLine(s) {
  return s
    .split('\n')
    .filter((l) => !/上表由 .*生成,最后核对日期/.test(l))
    .join('\n')
    .trim()
}

/** 取块外内容(标记之前 + 标记之后);用于判断除生成块外是否另有改动。 */
function outsideBlock(text) {
  const bi = text.indexOf(BEGIN)
  const ei = text.indexOf(END)
  if (bi === -1 || ei === -1) return text
  return text.slice(0, bi) + '\n' + text.slice(ei + END.length)
}

/** 并发写判定:打印双方读数,绝不覆盖别人刚写的那一份。 */
function reportConcurrent(f, mine, theirs, when) {
  console.error(
    `❌ 未判定(并发写):${f} 在${when}被外部改动 —— 本轮不写盘、不 git add,绝不做「后写者赢」。\n` +
      `   写手读数:${fmtReading(mine)}\n` +
      `   现场读数:${fmtReading(theirs)}\n` +
      `   处置:确认现场那一份是谁写的(它才是有效版本),停掉另一个写手后再重跑本器。`,
  )
  console.log(`UNDETERMINED:${f}`)
}

// ── 闸①:面旗只许索引面(写手与门 173 同面)─────────────────────────────
const faceInfo = resolveWriteFace()
if (faceInfo.error) {
  console.error(`❌ 拒绝写入:${faceInfo.error}`)
  process.exit(2)
}
if (faceInfo.face !== WRITE_FACE) {
  console.error(
    `❌ 拒绝写入:本器是生成块的唯一写入口,只按索引面(--face=${WRITE_FACE})取数。\n` +
      `   收到 --face=${faceInfo.face} —— 工作树/HEAD 面写出的数会与门 173 判的面不同,同一份文件会出现两段互斥读数。\n` +
      `   人工排查请改用:node scripts/gen-doc-numbers.mjs --face=${faceInfo.face} --json(只读、不产出可入库块)`,
  )
  process.exit(2)
}

// ── 闸②:唯一写手锁(并发第二个写手 fail-loud)────────────────────────────
const lock = acquireLock()
if (!lock.ok) {
  if (lock.holder) {
    console.error(
      `❌ 拒绝写入:另一个写手正在写 README 生成块(不许并发覆盖,也不排队后写)。\n` +
        `   持锁进程 pid=${lock.holder.pid} at=${lock.holder.at ?? '<未知>'} 锁=${lock.lockPath}\n` +
        `   本进程 pid=${process.pid} —— 等持锁进程结束后再重跑本器。`,
    )
  } else {
    console.error(`❌ 拒绝写入:${lock.error ?? `无法抢到写手锁 ${lock.lockPath ?? ''}`}`)
  }
  process.exit(2)
}

let exitCode = 0
let touched = 0
try {
  // 先给所有目标文件拍快照,**再**跑生成器 —— 这样 CAS 窗口覆盖整轮运行(含生成器耗时),
  // 而不是只覆盖"读文件到写文件"的几微秒;别人在本轮任意时刻写盘都能被判未判定。
  const pre = new Map()
  for (const f of README_FILES) {
    if (ONLY_FILES && !ONLY_FILES.has(f)) continue
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    pre.set(f, { p, snap: readingsOf(p) })
  }

  const freshFull = genBlockMarkdown()
  const freshCmp = stripDateLine(freshFull)

  for (const [f, { p, snap }] of pre) {
    const wtText = snap.text
    const bi = wtText.indexOf(BEGIN)
    const ei = wtText.indexOf(END)
    if (bi === -1 || ei === -1 || ei < bi) continue // 无生成块 → 跳(ko/ja 由 AI 定期刷新)
    const embedded = wtText.slice(bi, ei + END.length)
    if (stripDateLine(embedded) === freshCmp) continue // 数字未变 → 幂等跳过

    const idxBefore = indexBlob(f)

    // 重建:保留块前/块后原文,用现算块替换块内。freshFull 末尾自带一个换行,
    // 而 wtText.slice(ei+END.length) 起头已是 END 标记后的换行 —— 去掉 freshFull 尾部换行,
    // 避免 END 标记后重复空行(那会被"块外差异"安全闸误判为吞并他人 prose)。
    const newText = wtText.slice(0, bi) + freshFull.replace(/\n+$/, '') + wtText.slice(ei + END.length)

    // 闸③-a:替换前复核(窗口 = 本轮快照 → 此刻,含生成器耗时)。期间被改过 ⇒ 未判定,放弃写入。
    const before = readingsOf(p)
    if (before.sha !== snap.sha) {
      reportConcurrent(f, snap, before, '生成期间')
      exitCode = 3
      continue
    }

    // 闸③-b:同目录 tmp + rename,rename 前最后一刻再复核,把窗口压到最小。
    const tmp = `${p}.docnum-${process.pid}.tmp`
    fs.writeFileSync(tmp, newText)
    const gate = readingsOf(p)
    if (gate.sha !== snap.sha) {
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* tmp 已被清 ⇒ 无需再删 */
      }
      reportConcurrent(f, snap, gate, '替换瞬间')
      exitCode = 3
      continue
    }
    fs.renameSync(tmp, p)

    // 闸③-c:写完复核。若第三方在我们落盘后立刻覆盖,这一份不是我们的 ⇒ 未判定。
    const after = readingsOf(p)
    if (after.sha !== sha256(newText)) {
      reportConcurrent(f, { ...snap, tracked: trackedOf(newText) }, after, '替换后')
      exitCode = 3
      continue
    }
    touched += 1

    // 闸③-d:索引面并发(别的进程在本轮窗口内 git add 了同一文件)⇒ 未判定,不 add。
    const idxAfter = indexBlob(f)
    if (idxBefore !== null && idxAfter !== null && idxBefore !== idxAfter) {
      reportConcurrent(f, { ...snap, sha: sha256(newText) }, after, '写盘期间(索引 blob 被改)')
      exitCode = 3
      continue
    }

    // 安全闸:仅当"块外内容"相对索引版本无差异时,才 git add,避免吞并他人在飞 prose 改动。
    let idxText = null
    try {
      idxText = git(['show', `:${f}`])
    } catch {
      idxText = null
    }
    const safe = idxText !== null && outsideBlock(wtText) === outsideBlock(idxText)
    if (safe) {
      git(['add', f])
      // add 后复核:索引 blob 必须等于我们刚写盘的那份内容,否则说明索引被别人动过。
      const addedBlob = git(['rev-parse', `:${f}`]).trim()
      const expectBlob = gitInput(['hash-object', '--stdin'], newText)
      if (addedBlob !== expectBlob) {
        console.error(
          `❌ 未判定(并发写):${f} 已写盘,但 git add 后索引 blob(${addedBlob.slice(0, 12)}…)≠ 本轮内容(${expectBlob.slice(0, 12)}…)` +
            ` —— 索引在窗口内被别的进程改过,本轮不声明 STAGED。`,
        )
        console.log(`UNDETERMINED:${f}`)
        exitCode = 3
        continue
      }
      console.log(`  ✅ ${f}: 生成块已刷新并加入 staged`)
      console.log(`STAGED:${f}`)
    } else {
      console.log(
        `  ⚠️  ${f}: 生成块已写盘,但块外另有未提交差异,已跳过 git add(请单独提交,避免吞并他人在飞改动)`,
      )
      console.log(`SKIP_PROSE:${f}`)
    }
  }

  if (touched === 0 && exitCode === 0) console.log('  ✅ README 生成块数字无变化,跳过')
} catch (e) {
  console.error(`❌ 生成器失败:${e?.message ?? e}`)
  exitCode = 2
} finally {
  releaseLock(lock.lockPath)
}
process.exit(exitCode)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
