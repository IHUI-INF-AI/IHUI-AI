#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回收站垃圾分类清理器。
// 动机:这台机的两个卷都写了 NukeOnDelete=1(实测:请求可撤销删除被 shell 拒绝),
// 但 AI 编程工具的"安全删除"自己请求把文件送进回收站,那条路径不受该开关约束,
// 于是回收站无限积累。本工具不解散回收站(那会连带抹掉用户自己的可恢复项),
// 而是只删命中垃圾类前缀的条目;解析失败或认不出类别的条目一律不动。
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const LOG_FILE = 'D:\\DevEnv\\logs\\recycle-junk-purge.log'

// $I 元数据实测布局(2026-10-14 用真仓条目对账得出):
//   0x00 u64 version | 0x08 u64 sizeBytes | 0x10 i64 FILETIME | 0x18 u16 路径字符数(不含终止 null)
//   0x1A 2 字节填充   | 0x1C 起 UTF-16LE 原路径
const I_HEADER_BYTES = 28

/**
 * 垃圾类目录前缀(大小写不敏感、正斜杠归一后比较)。命中才可删,其余全部保留。
 * 收录口径:仅限「重建即可再生」的缓存/临时产物。
 * 刻意不收录:D:\IHUI-AI-git-repo 及其 worktrees 下的任何东西 —— 那里回收站里可能是
 * 某个 git 状态件(refs、MERGE_MSG、sequencer/todo)的最后一份副本,按 §5b/§22 的
 * 提交丢失纪律,宁可留着也不替 git 做删除决定。同理不收录仓库源码树。
 */
export const JUNK_PREFIXES = [
  'c:\\users\\administrator\\appdata\\local\\temp\\',
  'c:\\users\\administrator\\appdata\\local\\npm-cache\\',
  'c:\\users\\administrator\\appdata\\local\\ccache\\',
  'd:\\devenv\\temp\\',
  'd:\\devenv\\cache\\',
  'd:\\devenv\\logs\\',
  'd:\\devenv\\tools\\pnpm\\_tmp_',
  'd:\\ihui-ai\\tmp\\',
  'd:\\ihui-ai\\.ihui-agent\\tmp\\',
  'd:\\ihui-ai\\_tmp_',
  'd:\\ihui-ai\\apps\\mobile-rn\\android\\app\\build\\',
]

export function normalizePath(p) {
  return String(p ?? '').replace(/\//g, '\\').trim().toLowerCase()
}

export function classify(originalPath) {
  const n = normalizePath(originalPath)
  if (!n) return null
  for (const prefix of JUNK_PREFIXES) {
    if (n.startsWith(prefix)) return prefix
  }
  return null
}

/** 解析单个 $I 文件。任何异常一律返回 null,由调用方计入「未判定」并保留条目。 */
export function parseIMeta(buf, nameForError = '') {
  try {
    if (!buf || buf.length < I_HEADER_BYTES + 2) return { error: 'too-short', bytes: buf ? buf.length : 0 }
    const sizeBytes = buf.readBigUInt64LE(8)
    const ft = buf.readBigInt64LE(16)
    const chars = buf.readUInt16LE(24)
    if (chars === 0 || chars > 32767) return { error: 'bad-length-field', chars }
    const need = I_HEADER_BYTES + chars * 2
    if (buf.length < need) return { error: 'truncated-name-area', chars, bytes: buf.length, need }
    const raw = buf.subarray(I_HEADER_BYTES, I_HEADER_BYTES + chars * 2).toString('utf16le')
    if (!/[a-z]:\\/i.test(raw.slice(0, 4))) return { error: 'path-not-rooted', head: raw.slice(0, 8) }
    const deletedMs = Number(ft) / 10000 - 11644473600000
    return { originalPath: raw, sizeBytes: Number(sizeBytes), deletedMs, chars }
  } catch (e) {
    return { error: 'exception', message: String(e && e.message ? e.message : e), name: nameForError }
  }
}

/** 构造 $I 字节(自检夹具用)。 */
export function buildIMeta({ originalPath, sizeBytes = 0, deletedMs = Date.now() }) {
  const chars = originalPath.length
  const buf = Buffer.alloc(I_HEADER_BYTES + chars * 2)
  buf.writeBigUInt64LE(1n, 0)
  buf.writeBigUInt64LE(BigInt(sizeBytes), 8)
  buf.writeBigInt64LE(BigInt(Math.round((deletedMs + 11644473600000) * 10000)), 16)
  buf.writeUInt16LE(chars, 24)
  buf.write(originalPath, I_HEADER_BYTES, 'utf16le')
  return buf
}

export function listBinDirs(drives, sid) {
  const out = []
  const skipped = []
  for (const d of drives) {
    const binRoot = join(d, '$Recycle.Bin')
    if (!existsSync(binRoot)) {
      skipped.push({ binRoot, why: 'absent' })
      continue
    }
    let names = []
    try { names = readdirSync(binRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) } catch (e) {
      skipped.push({ binRoot, why: 'readdir-failed: ' + e.message })
      continue
    }
    const mine = names.filter((n) => n.toLowerCase() === String(sid).toLowerCase())
    if (mine.length === 0) skipped.push({ binRoot, why: 'no-directory-for-this-sid', sawSids: names })
    for (const m of mine) out.push(join(binRoot, m))
  }
  return { dirs: out, skipped }
}

/** 只读扫描:把每个条目归类。绝不做任何删除。 */
export function scanBinDirs(dirs) {
  const items = []
  const undetermined = []
  for (const dir of dirs) {
    let names = []
    try { names = readdirSync(dir) } catch (e) { undetermined.push({ dir, binDir: dir, error: 'readdir-failed: ' + e.message }); continue }
    for (const n of names) {
      if (!n.startsWith('$I')) continue
      const iPath = join(dir, n)
      let buf
      try { buf = readFileSync(iPath) } catch (e) { undetermined.push({ iPath, error: 'read-failed: ' + e.message }); continue }
      const meta = parseIMeta(buf, n)
      if (meta.error) { undetermined.push({ iPath, error: meta.error, detail: meta }); continue }
      const suffix = n.slice(2)
      const rPath = join(dir, '$R' + suffix)
      items.push({
        iPath,
        rPath,
        iName: n,
        originalPath: meta.originalPath,
        sizeBytes: meta.sizeBytes,
        deletedMs: meta.deletedMs,
        rule: classify(meta.originalPath),
      })
    }
  }
  return { items, undetermined }
}

export function summarize(items, undetermined) {
  const byRule = new Map()
  const kept = []
  let matched = 0
  let matchedBytes = 0
  for (const it of items) {
    if (it.rule) {
      matched++
      matchedBytes += it.sizeBytes
      byRule.set(it.rule, (byRule.get(it.rule) || 0) + 1)
    } else {
      kept.push(it)
    }
  }
  return {
    entriesTotal: items.length,
    matched: { entries: matched, bytes: matchedBytes, byRule: Object.fromEntries(byRule) },
    keptUnmatched: kept.length,
    keptSamples: kept.slice(0, 20).map((k) => k.originalPath),
    undetermined: undetermined.length,
    undeterminedSamples: undetermined.slice(0, 10),
  }
}

function toExtendedPath(p) {
  if (p.startsWith('\\\\?\\')) return p
  if (/^[a-z]:\\/i.test(p)) return '\\\\?\\' + p
  return p
}

export function purgeItem(it) {
  const errors = []
  if (existsSync(it.rPath)) {
    try {
      rmSync(toExtendedPath(it.rPath), { recursive: true, force: true, maxRetries: 3, retryDelay: 60 })
    } catch (e) {
      errors.push('rm-r:' + e.code + ':' + e.message)
    }
  }
  if (errors.length === 0) {
    try {
      rmSync(toExtendedPath(it.iPath), { force: true, maxRetries: 3, retryDelay: 60 })
    } catch (e) {
      errors.push('rm-i:' + e.code + ':' + e.message)
    }
  }
  return { removed: errors.length === 0, errors }
}

function readMySid() {
  // whoami 是原生件,比拉一个 pwsh 便宜两个数量级;失败才回落 pwsh。
  try {
    const out = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    })
    const m = /"(S-1-5-21-\d+-\d+-\d+-\d+)"/.exec(String(out))
    if (m) return m[1]
  } catch { /* 回落 */ }
  try {
    const out = execFileSync('pwsh.exe', ['-NoProfile', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().Owner.Value'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    })
    const sid = String(out).trim().split(/\r?\n/).pop()
    if (/^S-1-5-21-\d+-\d+-\d+-\d+$/.test(sid)) return sid
    return null
  } catch {
    return null
  }
}

function logRun(record) {
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true })
    appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

async function selfTest() {
  const scratchMod = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'scratch-dir.mjs')).href)
  const { mkScratch, rmScratch } = scratchMod
  const fails = []
  const dir = mkScratch('rcpurge-selftest')
  try {
    const junkPath = 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\abc\\ssr\\deadbeef'
    const realPath = 'D:\\IHUI-AI\\apps\\web\\src\\keep-me.ts'
    const buf = buildIMeta({ originalPath: junkPath, sizeBytes: 4242, deletedMs: 1791900000000 })
    const parsed = parseIMeta(buf, 'fixture')
    if (parsed.error) fails.push('parse rejected a well-formed fixture: ' + parsed.error)
    if (parsed.originalPath !== junkPath) fails.push('parsed path mismatch: ' + parsed.originalPath)
    if (parsed.sizeBytes !== 4242) fails.push('parsed size mismatch: ' + parsed.sizeBytes)
    if (Math.abs(parsed.deletedMs - 1791900000000) > 1000) fails.push('parsed time drift: ' + parsed.deletedMs)
    if (classify(junkPath) === null) fails.push('POSITIVE CONTROL BROKEN: a junk-class path did not classify')
    if (classify(realPath) !== null) fails.push('REVERSE CONTROL BROKEN: a working-tree path classified as junk')
    // git 状态件是"回收站里可能是最后一份副本"的那一族,任何情况下都不得命中
    for (const gitPath of [
      'D:\\IHUI-AI-git-repo\\refs\\heads\\feat\\d64-store',
      'D:\\IHUI-AI-git-repo\\worktrees\\ag-integ\\MERGE_MSG',
      'D:\\IHUI-AI-git-repo\\packed-refs.lock',
      'D:\\IHUI-AI\\.git\\hooks\\pre-commit',
    ]) {
      if (classify(gitPath) !== null) fails.push('REVERSE CONTROL BROKEN: a git state file classified as junk: ' + gitPath)
    }
    if (classify('d:/devenv/temp/x') === null) fails.push('forward-slash form did not classify')
    const bad = parseIMeta(Buffer.from([1, 2, 3]), 'tiny')
    if (!bad.error) fails.push('a 3-byte blob parsed anyway (fail-open)')
    const half = Buffer.alloc(40)
    half.writeUInt16LE(500, 24)
    if (!parseIMeta(half, 'liar').error) fails.push('length field lying about the buffer was accepted')

    // 判定面回放:把夹具写成一个真的"回收站目录",走 scanBinDirs + purgeItem 全链
    writeFileSync(join(dir, '$IJUNK01'), buildIMeta({ originalPath: junkPath, sizeBytes: 3 }))
    writeFileSync(join(dir, '$RJUNK01'), 'junk payload')
    mkdirSync(join(dir, '$RKEEP01'), { recursive: true })
    writeFileSync(join(dir, '$RKEEP01', 'inner.txt'), 'must survive')
    writeFileSync(join(dir, '$IKEEP01'), buildIMeta({ originalPath: realPath, sizeBytes: 13 }))
    writeFileSync(join(dir, '$IGARBAGE'), Buffer.from([0, 1, 2]))
    const fixtureScan = scanBinDirs([dir])
    if (fixtureScan.items.length !== 2) fails.push('fixture enumeration expected 2 entries, got ' + fixtureScan.items.length)
    if (fixtureScan.undetermined.length !== 1) fails.push('fixture expected 1 undetermined (the 3-byte blob), got ' + fixtureScan.undetermined.length)
    const fixtureSummary = summarize(fixtureScan.items, fixtureScan.undetermined)
    if (fixtureSummary.matched.entries !== 1) fails.push('fixture expected exactly 1 matched, got ' + fixtureSummary.matched.entries)
    if (fixtureSummary.keptUnmatched !== 1) fails.push('fixture expected exactly 1 kept, got ' + fixtureSummary.keptUnmatched)
    const junkItem = fixtureScan.items.find((i) => i.rule)
    const keepItem = fixtureScan.items.find((i) => !i.rule)
    if (junkItem) {
      const r = purgeItem(junkItem)
      if (!r.removed) fails.push('purgeItem reported failure: ' + JSON.stringify(r.errors))
      if (existsSync(junkItem.iPath) || existsSync(junkItem.rPath)) fails.push('purge left junk pair behind')
    } else {
      fails.push('fixture produced no matched item to purge (positive control broken)')
    }
    if (keepItem && !existsSync(keepItem.rPath)) fails.push('REVERSE CONTROL BROKEN: purge ate a non-junk entry')

    // 真实条目回放:拿现存回收站里的一条 $I 逐字段验格式假设
    const sid = readMySid()
    if (sid) {
      const { dirs } = listBinDirs(['C:', 'D:'], sid)
      if (dirs.length > 0) {
        const firstName = readdirSync(dirs[0]).find((n) => n.startsWith('$I'))
        if (firstName) {
          const meta = parseIMeta(readFileSync(join(dirs[0], firstName)), firstName)
          if (meta.error) fails.push('a live bin entry failed to parse: ' + JSON.stringify(meta))
          else if (!/^[a-z]:\\/i.test(meta.originalPath)) fails.push('live entry path is not rooted: ' + meta.originalPath)
        }
      }
    }
  } finally {
    try { rmScratch(dir) } catch { /* 夹具残留由 §26 每日体检兜 */ }
  }
  return { ok: fails.length === 0, fails }
}

function parseArgs(argv) {
  const opts = { apply: false, json: false, drives: ['C:', 'D:'], limit: 0, selftest: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') opts.apply = true
    else if (a === '--dry-run') opts.apply = false
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selftest = true
    else if (a === '--drives') opts.drives = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--sid') opts.sid = String(argv[++i] || '').trim()
    else if (a === '--limit') opts.limit = Number(argv[++i] || 0)
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error('unknown argument: ' + a)
  }
  return opts
}

const HELP = `usage: node scripts/recycle-junk-purge.mjs [--self-test] [--dry-run|--apply] [--drives C:,D:] [--limit N] [--json]

只删除原位置命中垃圾类前缀的回收站条目;其余(包括解析失败的)一律保留。
默认 dry-run。--json 时 stdout 只有一个 JSON 对象。`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write(HELP + '\n')
    return 0
  }
  if (opts.selftest) {
    const r = await selfTest()
    if (opts.json) process.stdout.write(JSON.stringify(r) + '\n')
    else process.stdout.write((r.ok ? 'SELF-TEST PASS\n' : 'SELF-TEST FAIL\n') + r.fails.map((f) => '  - ' + f).join('\n') + '\n')
    return r.ok ? 0 : 1
  }

  const sid = opts.sid || readMySid()
  if (!sid) {
    const msg = 'UNDETERMINED: 读不到当前进程 SID,拒绝在未知归属的回收站上动手'
    if (opts.json) process.stdout.write(JSON.stringify({ status: 'undetermined', error: msg }) + '\n')
    else process.stderr.write('x ' + msg + '\n')
    return 2
  }
  const { dirs, skipped } = listBinDirs(opts.drives, sid)
  if (dirs.length === 0) {
    const msg = 'UNDETERMINED: 本 SID 名下没有任何回收站目录'
    if (opts.json) process.stdout.write(JSON.stringify({ status: 'undetermined', error: msg, skipped }) + '\n')
    else process.stderr.write('x ' + msg + '\n')
    return 2
  }

  const { items, undetermined } = scanBinDirs(dirs)
  const summary = summarize(items, undetermined)
  let doomed = items.filter((it) => it.rule)
  // 阳性对照:枚举到 0 个候选不等于"已经干净",必须能点名一个已知存量
  if (doomed.length === 0) {
    const known = 'c:\\users\\administrator\\appdata\\local\\temp\\'
    const sample = items.find((it) => normalizePath(it.originalPath).startsWith(known))
    if (sample) {
      const msg = 'INTERNAL ERROR: 现存条目里有 ' + known + ' 开头的,却没被归类'
      process.stderr.write('x ' + msg + ' (first=' + sample.originalPath + ')\n')
      return 1
    }
  }
  if (opts.limit > 0) doomed = doomed.slice(0, opts.limit)
  let purge = null
  if (opts.apply) {
    const results = doomed.map(purgeItem)
    const okCount = results.filter((r) => r.removed).length
    const failures = results.filter((r) => !r.removed)
    purge = { attempted: results.length, removed: okCount, failed: failures.length, failureSamples: failures.slice(0, 10) }
    // 落地后重扫一遍,用现读数字自证,而不是相信自己的返回值
    const rescan = scanBinDirs(dirs)
    const rescanSummary = summarize(rescan.items, rescan.undetermined)
    purge.afterRescan = rescanSummary
    if (failures.length > 0) {
      process.stderr.write('! ' + failures.length + ' 条目删除失败(未判定,原样保留)\n')
    }
  }

  const record = {
    at: new Date().toISOString(),
    sid,
    mode: opts.apply ? 'apply' : 'dry-run',
    binDirs: dirs,
    binDirsSkipped: skipped,
    scan: summary,
    purge,
  }
  const logged = logRun({ at: record.at, sid, mode: record.mode, entries: summary.entriesTotal, matched: summary.matched.entries, kept: summary.keptUnmatched, undetermined: summary.undetermined, removed: purge ? purge.removed : 0, failed: purge ? purge.failed : 0 })
  record.logWritten = logged

  if (opts.json) {
    process.stdout.write(JSON.stringify(record) + '\n')
  } else {
    process.stdout.write('回收站条目总数 = ' + summary.entriesTotal + '\n')
    process.stdout.write('命中垃圾类 = ' + summary.matched.entries + ' 条 / ' + (summary.matched.bytes / 1048576).toFixed(1) + ' MB\n')
    for (const [rule, n] of Object.entries(summary.matched.byRule)) process.stdout.write('    ' + String(n).padStart(6) + ' x  ' + rule + '\n')
    process.stdout.write('保留不动(不属任何垃圾类) = ' + summary.keptUnmatched + ' 条\n')
    for (const s of summary.keptSamples.slice(0, 10)) process.stdout.write('    keep: ' + s + '\n')
    process.stdout.write('未判定(解析失败,一律保留) = ' + summary.undetermined + ' 条\n')
    for (const u of record.scan.undeterminedSamples) process.stdout.write('    undetermined: ' + (u.iPath || u.dir) + ' ' + u.error + '\n')
    process.stdout.write('模式 = ' + record.mode + (opts.apply ? '' : '(未做任何改动;要落地加 --apply)') + '\n')
    if (purge) process.stdout.write('删除 = 尝试 ' + purge.attempted + ' 成功 ' + purge.removed + ' 失败 ' + purge.failed + ';重扫后总数 ' + purge.afterRescan.entriesTotal + ' 命中 ' + purge.afterRescan.matched.entries + '\n')
    process.stdout.write('日志 = ' + LOG_FILE + ' 写入=' + logged + '\n')
  }
  if (purge && purge.failed > 0) return 1
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error('x ' + (e && e.message ? e.message : e) + '\n' + (e && e.stack ? e.stack : ''))
    process.exit(2)
  })
}

export const __test__ = { parseIMeta, buildIMeta, classify, normalizePath, summarize, scanBinDirs, listBinDirs, purgeItem, JUNK_PREFIXES, I_HEADER_BYTES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
