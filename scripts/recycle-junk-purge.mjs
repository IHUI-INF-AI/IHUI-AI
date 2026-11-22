#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回收站垃圾分类清理器。
// 动机(2026-10-21 按当次实测更正,原句"AI 工具送回收站那条路径不受 NukeOnDelete 约束"
// 已被 recycle-bin-policy --verify 的 A/B 两臂推翻:genie-trash 与显式可撤销删除请求
// 都被硬删):卷上 NukeOnDelete 在位时删除不落回收站;但这道闸此前全仓零处维护,一旦被
// 重置,灌入立刻恢复 —— 所以本件保留为兜底清理腿,卷策略的存续由同目录 recycle-bin-policy
// 每轮巡检(见本文件 policyLeg)。本工具不解散回收站(那会连带抹掉用户自己的可恢复项),
// 而是只删命中垃圾类前缀或具名再生缓存的条目;git 状态件与源码文件永不命中,
// 解析失败或认不出类别的条目一律不动。
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
} from 'node:fs'
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
  return String(p ?? '')
    .replace(/\//g, '\\')
    .trim()
    .toLowerCase()
}

/**
 * 树内可再生缓存:路径住在仓库树里,却纯属"删了会被工具自己重建"的那一族。
 * 单靠 JUNK_PREFIXES 收不到它们 —— 前缀表刻意不覆盖源码树(见上),于是这类条目
 * 一律判 KEEP、永久滞留,成了回收站涨的主要来源。
 * 每条必须带 reason + evidence + expires:命中是"验过的豁免",不是默认放行。
 */
export const REGENERABLE = [
  {
    id: 'tsbuildinfo',
    suffix: '.tsbuildinfo',
    reason: 'TypeScript 增量构建缓存,下一次 tsc 自行重建',
    evidence:
      '2026-10-21 实测:15:35 一轮 486 条中 483 条判 KEEP;16:13 那 8 秒连续落地 15 条,原位置全是 apps/*/tsconfig.tsbuildinfo 与 packages/*/tsconfig.tsbuildinfo(最大一枚 2,293,840 字节)',
    expires: '2027-04-21',
  },
]

// 无论后缀多"可再生",这几族永不判垃圾:git 状态件在回收站里可能是最后一份副本。
export function isProtected(normalizedPath) {
  const n = String(normalizedPath || '')
  if (!n) return false
  if (n.includes('\\.git\\')) return true
  if (n.endsWith('\\.git')) return true
  if (n.includes('ihui-ai-git-repo')) return true
  if (n.includes('$recycle.bin')) return true
  return false
}

function activeRegenerable(n, now) {
  for (const r of REGENERABLE) {
    if (!n.endsWith(r.suffix)) continue
    const exp = Date.parse(r.expires + 'T23:59:59')
    if (Number.isNaN(exp)) return null
    if (exp < now) return null
    return 'regenerable:' + r.id
  }
  return null
}

export function classify(originalPath, now = Date.now()) {
  const n = normalizePath(originalPath)
  if (!n) return null
  for (const prefix of JUNK_PREFIXES) {
    if (n.startsWith(prefix)) return prefix
  }
  if (isProtected(n)) return null
  return activeRegenerable(n, now)
}

/** 解析单个 $I 文件。任何异常一律返回 null,由调用方计入「未判定」并保留条目。 */
export function parseIMeta(buf, nameForError = '') {
  try {
    if (!buf || buf.length < I_HEADER_BYTES + 2)
      return { error: 'too-short', bytes: buf ? buf.length : 0 }
    const sizeBytes = buf.readBigUInt64LE(8)
    const ft = buf.readBigInt64LE(16)
    const chars = buf.readUInt16LE(24)
    if (chars === 0 || chars > 32767) return { error: 'bad-length-field', chars }
    const need = I_HEADER_BYTES + chars * 2
    if (buf.length < need) return { error: 'truncated-name-area', chars, bytes: buf.length, need }
    const raw = buf.subarray(I_HEADER_BYTES, I_HEADER_BYTES + chars * 2).toString('utf16le')
    if (!/[a-z]:\\/i.test(raw.slice(0, 4)))
      return { error: 'path-not-rooted', head: raw.slice(0, 8) }
    const deletedMs = Number(ft) / 10000 - 11644473600000
    return { originalPath: raw, sizeBytes: Number(sizeBytes), deletedMs, chars }
  } catch (e) {
    return {
      error: 'exception',
      message: String(e && e.message ? e.message : e),
      name: nameForError,
    }
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
    try {
      names = readdirSync(binRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    } catch (e) {
      skipped.push({ binRoot, why: 'readdir-failed: ' + e.message })
      continue
    }
    const mine = names.filter((n) => n.toLowerCase() === String(sid).toLowerCase())
    if (mine.length === 0)
      skipped.push({ binRoot, why: 'no-directory-for-this-sid', sawSids: names })
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
    try {
      names = readdirSync(dir)
    } catch (e) {
      undetermined.push({ dir, binDir: dir, error: 'readdir-failed: ' + e.message })
      continue
    }
    for (const n of names) {
      if (!n.startsWith('$I')) continue
      const iPath = join(dir, n)
      let buf
      try {
        buf = readFileSync(iPath)
      } catch (e) {
        undetermined.push({ iPath, error: 'read-failed: ' + e.message })
        continue
      }
      const meta = parseIMeta(buf, n)
      if (meta.error) {
        undetermined.push({ iPath, error: meta.error, detail: meta })
        continue
      }
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
  // kept 必须带路径形态,不能只带条数:2026-10-21 之前这里只落计数,于是"回收站里 1.6 万条
  // 到底是什么"结构上无人能答,涨到当天才有人肉眼发现 —— 观测盲区本身就是故障的一层。
  const keptTop = new Map()
  for (const it of kept) {
    const seg = normalizePath(it.originalPath).split('\\').filter(Boolean)
    const key = seg.slice(0, Math.min(seg.length, 4)).join('\\')
    keptTop.set(key, (keptTop.get(key) || 0) + 1)
  }
  return {
    entriesTotal: items.length,
    matched: { entries: matched, bytes: matchedBytes, byRule: Object.fromEntries(byRule) },
    keptUnmatched: kept.length,
    keptSamples: kept.slice(0, 20).map((k) => k.originalPath),
    keptTop: [...keptTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
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
      rmSync(toExtendedPath(it.rPath), {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 60,
      })
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

export function readMySid() {
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
  } catch {
    /* 回落 */
  }
  try {
    const out = execFileSync(
      'pwsh.exe',
      ['-NoProfile', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().Owner.Value'],
      {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
      },
    )
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

/**
 * 回收站存续腿之三:目录可写性(2026-10-29 立)。
 * 立因是机主当天的一次肉眼现场 —— 删除任何文件都弹「回收站」模态错误框。量出来的是:
 * 两盘 `\$Recycle.Bin\<本机SID>` 上挂着三条显式 Deny(Everyone / Authenticated Users / 本机
 * Administrator)且 ContainerInherit|ObjectInherit,而 Windows 的 ACL 求值是 Deny 恒压 Allow,
 * 于是登录账号对"自己的"回收站目录既不能建也不能删 ⇒ 任何请求可撤销删除的路径必然报错。
 * 卷策略(NukeOnDelete)与条目分类都判不出这一格:它们一个管"落不落",一个管"落了怎么清",
 * 都没管"想落的时候落得进去吗",所以这道闸坏了三天没有任何门响。
 * 判据主面是真写一次再删掉,不是解析 ACL 文本 —— 出厂 Windows 也在 SID 目录上留 Deny,
 * 只有量出来的失败才是坏;ACL 读数只当证据与修法输入。
 */
const RB_SID_DIR = /^([a-z]):\\\$recycle\.bin\\(s-1-[0-9-]+)$/i
const SID_SHAPE = /^S-1-[0-9-]+$/i

export function isBinSidDir(p, mySid) {
  const m = RB_SID_DIR.exec(String(p || '').replace(/\//g, '\\'))
  if (!m || !mySid) return false
  return m[2].toLowerCase() === String(mySid).toLowerCase()
}

export function explicitDenies(access) {
  const out = []
  for (const a of access || []) {
    if (!a || a.type !== 'Deny' || a.inherited) continue
    if (!SID_SHAPE.test(String(a.sid))) continue
    out.push({
      sid: a.sid,
      name: String(a.name || ''),
      rights: String(a.rights || ''),
      flags: String(a.flags || ''),
    })
  }
  return out
}

const ACL_PS = [
  '$ErrorActionPreference="Stop"',
  '$a = Get-Acl -LiteralPath $env:IHUI_RB_DIR',
  '$acc = @($a.Access | ForEach-Object {',
  '  $sid = ""',
  '  try { $sid = (New-Object System.Security.Principal.SecurityIdentifier($_.IdentityReference)).Value } catch { $sid = "" }',
  '  [pscustomobject]@{ type=$_.AccessControlType.ToString(); sid=$sid; name=$_.IdentityReference.Value; rights=$_.FileSystemRights.ToString(); flags=$_.InheritanceFlags.ToString(); inherited=[bool]$_.IsInherited }',
  '})',
  '[pscustomobject]@{ sddl=$a.Sddl; owner=$a.Owner; protected=$a.AreAccessRulesProtected; access=$acc } | ConvertTo-Json -Compress',
].join('; ')

function firstLine(v) {
  return (
    String((v && (v.stderr || v.message)) || v || '')
      .trim()
      .split(/\r?\n/)
      .pop() || ''
  )
}

export function readBinAcl(dir) {
  try {
    const out = execFileSync('pwsh.exe', ['-NoProfile', '-Command', ACL_PS], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      env: { ...process.env, IHUI_RB_DIR: dir },
    })
    const j = JSON.parse(String(out).trim().split(/\r?\n/).pop())
    if (!j || typeof j.sddl !== 'string') return { error: 'pwsh 未回显 SDDL' }
    if (!Array.isArray(j.access)) return { error: 'pwsh 未回显 ACE 清单' }
    return j
  } catch (e) {
    return { error: firstLine(e) }
  }
}

const PROBE_PREFIX = 'ihui-rb-probe-'

/** 探针名刻意不以 $I 开头:扫描器把 $I* 一律当回收站条目解析,一条探针会让 undetermined 假涨。 */
export function probeBinDir(dir) {
  const fp = join(dir, PROBE_PREFIX + process.pid + '-' + Date.now() + '.tmp')
  try {
    writeFileSync(fp, 'probe')
  } catch (e) {
    return {
      canWrite: false,
      canDelete: false,
      step: 'create',
      code: e && e.code ? e.code : null,
      error: firstLine(e),
    }
  }
  try {
    rmSync(fp, { force: true, maxRetries: 3, retryDelay: 60 })
    return { canWrite: true, canDelete: true }
  } catch (e) {
    return {
      canWrite: true,
      canDelete: false,
      step: 'delete',
      code: e && e.code ? e.code : null,
      error: firstLine(e),
      leftover: fp,
    }
  }
}

function sweepStaleProbes(dir) {
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return 0
  }
  let n = 0
  for (const name of names) {
    if (!name.startsWith(PROBE_PREFIX)) continue
    try {
      rmSync(join(dir, name), { force: true })
      n++
    } catch {
      /* 清不掉就留着,下轮再来;这里不是删除判据 */
    }
  }
  return n
}

export function planAclRepair(dir, denySids, mySid) {
  const good = []
  const skipped = []
  for (const s of denySids || []) {
    if (SID_SHAPE.test(String(s))) good.push('*' + String(s))
    else skipped.push(String(s))
  }
  return {
    dir,
    remove: good,
    grant: SID_SHAPE.test(String(mySid)) ? '*' + mySid + ':(OI)(CI)F' : null,
    skipped,
  }
}

/** 唯一写动作 = icacls 改本 SID 名下回收站目录的显式 Deny;形状核验不住就一个参数都不发。 */
export function runAclRepair(plan, mySid) {
  if (!isBinSidDir(plan.dir, mySid))
    return { attempted: 0, refused: '路径不是本 SID 名下的回收站目录:' + plan.dir }
  const bad = (plan.remove || []).filter((a) => !/^\*S-1-[0-9-]+$/.test(String(a)))
  if (bad.length > 0)
    return { attempted: 0, refused: 'Deny 主体形态不合格,拒绝下发:' + bad.join(',') }
  if (!plan.grant && !plan.remove.length) return { attempted: 0, refused: '无可执行项' }
  const steps = []
  const runIcacls = (args) => {
    try {
      const text = execFileSync('icacls.exe', [plan.dir, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
      })
      steps.push({ args, rc: 0, tail: String(text).trim().split(/\r?\n/).pop() })
    } catch (e) {
      steps.push({ args, rc: typeof e.status === 'number' ? e.status : null, error: firstLine(e) })
    }
  }
  if (plan.remove.length > 0) runIcacls(['/remove:d', ...plan.remove])
  if (plan.grant) runIcacls(['/grant:r', plan.grant])
  return { attempted: steps.length, steps, refused: null }
}

function accessLeg(binDirs, mySid, mayRepair) {
  const rows = []
  for (const dir of binDirs) {
    sweepStaleProbes(dir)
    const first = probeBinDir(dir)
    const row = { dir, first }
    if (first.canWrite && first.canDelete) {
      row.state = 'ok'
      rows.push(row)
      continue
    }
    const acl = readBinAcl(dir)
    if (acl.error) {
      row.state = 'undetermined'
      row.aclError = acl.error
      rows.push(row)
      continue
    }
    row.acl = {
      owner: acl.owner,
      protected: acl.protected,
      sddl: acl.sddl,
      denies: explicitDenies(acl.access),
    }
    if (!isBinSidDir(dir, mySid)) {
      row.state = 'refused'
      rows.push(row)
      continue
    }
    if (!mayRepair) {
      row.state = 'breach-unrepaired'
      rows.push(row)
      continue
    }
    row.repair = runAclRepair(
      planAclRepair(
        dir,
        row.acl.denies.map((d) => d.sid),
        mySid,
      ),
      mySid,
    )
    if (row.repair.refused) {
      row.state = 'refused'
      rows.push(row)
      continue
    }
    row.after = probeBinDir(dir)
    row.state = row.after.canWrite && row.after.canDelete ? 'self-healed' : 'breach'
    rows.push(row)
  }
  return rows
}

export function judgeAccess(rows) {
  if (!Array.isArray(rows) || rows.length === 0)
    return {
      status: 'undetermined',
      code: 2,
      why: '枚举到 0 个本 SID 的回收站目录 ⇒ 不记绿也不冒红',
    }
  const count = (s) => rows.filter((r) => r.state === s).length
  const out = {
    status: 'ok',
    code: 0,
    ok: count('ok'),
    healed: count('self-healed'),
    breach: count('breach'),
    unrepaired: count('breach-unrepaired'),
    undetermined: count('undetermined'),
    refused: count('refused'),
  }
  if (out.breach > 0) {
    out.status = 'breach'
    out.code = 1
    out.why = out.breach + ' 个回收站目录修完仍不可写,需人工看 sddl 证据'
  } else if (out.undetermined > 0 || out.refused > 0) {
    out.status = 'undetermined'
    out.code = 2
    out.why = '有 ' + (out.undetermined + out.refused) + ' 个目录取不到 ACL 或不在射程内,不得记绿'
  } else if (out.unrepaired > 0) {
    out.status = 'breach-unrepaired'
    out.code = 0
    out.why = out.unrepaired + ' 个目录不可写;本轮是 dry-run,修法:加 --apply'
  } else if (out.healed > 0) {
    out.status = 'self-healed'
    out.why = out.healed + ' 个目录的显式 Deny 已摘除并复验可写'
  }
  return out
}

/**
 * 回收站策略腿(2026-10-21 接进本任务)。卷上的 NukeOnDelete 才是"删除不落回收站"的那道闸,
 * 而它此前全仓零处维护 —— 只有两行注释声称"写了 =1",于是它哪天被重置,灌入立刻恢复,
 * 唯一的发现方式却是有人肉眼打开回收站。这里每轮问一次策略器,不自建第二份判据。
 * 走子进程而非 import:策略器反向依赖本件的 scanBinDirs,直接 import 会成环。
 */
function policyLeg(mayRepair) {
  const script = join(ROOT, 'scripts', 'recycle-bin-policy.mjs')
  if (!existsSync(script)) return { status: 'undetermined', why: '策略器不存在:' + script }
  const call = (args) => {
    try {
      const out = execFileSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 90000,
      })
      return { json: JSON.parse(String(out).trim().split(/\r?\n/).pop()), code: 0 }
    } catch (e) {
      const tail = String(e.stdout || '')
        .trim()
        .split(/\r?\n/)
        .pop()
      let json = null
      try {
        json = tail ? JSON.parse(tail) : null
      } catch {}
      if (json) return { json, code: e.status ?? 1 }
      return { json: null, code: e.status ?? 2, error: String(e.message).split(/\r?\n/)[0] }
    }
  }
  const first = call(['--check', '--json'])
  if (first.error) return { status: 'undetermined', why: first.error }
  if (!first.json)
    return { status: 'undetermined', why: '策略器 --check 未给出 JSON(exit ' + first.code + ')' }
  if (first.json.status === 'ok') return { status: 'ok', rows: first.json.rows }
  if (first.json.status === 'undetermined') {
    return {
      status: 'undetermined',
      why: first.json.why || '策略器 --check 落未判定',
      before: first.json,
    }
  }
  if (!mayRepair) return { status: 'breach-unrepaired', before: first.json }
  const applied = call(['--apply', '--json'])
  const after = call(['--check', '--json'])
  return {
    status: after.json ? (after.json.status === 'ok' ? 'self-healed' : 'breach') : 'undetermined',
    before: first.json,
    apply: applied.json || { error: applied.error },
    after: after.json || null,
  }
}

async function selfTest() {
  const scratchMod = await import(
    pathToFileURL(join(ROOT, 'scripts', 'lib', 'scratch-dir.mjs')).href
  )
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
    if (Math.abs(parsed.deletedMs - 1791900000000) > 1000)
      fails.push('parsed time drift: ' + parsed.deletedMs)
    if (classify(junkPath) === null)
      fails.push('POSITIVE CONTROL BROKEN: a junk-class path did not classify')
    if (classify(realPath) !== null)
      fails.push('REVERSE CONTROL BROKEN: a working-tree path classified as junk')
    // git 状态件是"回收站里可能是最后一份副本"的那一族,任何情况下都不得命中
    for (const gitPath of [
      'D:\\IHUI-AI-git-repo\\refs\\heads\\feat\\d64-store',
      'D:\\IHUI-AI-git-repo\\worktrees\\ag-integ\\MERGE_MSG',
      'D:\\IHUI-AI-git-repo\\packed-refs.lock',
      'D:\\IHUI-AI\\.git\\hooks\\pre-commit',
    ]) {
      if (classify(gitPath) !== null)
        fails.push('REVERSE CONTROL BROKEN: a git state file classified as junk: ' + gitPath)
    }
    if (classify('d:/devenv/temp/x') === null) fails.push('forward-slash form did not classify')
    // 树内可再生缓存:这一族住在源码树里,前缀表结构上收不到(2026-10-21 现场抓到 8 秒内 15 条连续落地)
    const cacheHit = 'D:\\IHUI-AI\\apps\\web\\tsconfig.tsbuildinfo'
    if (classify(cacheHit) !== 'regenerable:tsbuildinfo')
      fails.push(
        'POSITIVE CONTROL BROKEN: an in-tree .tsbuildinfo did not classify, got ' +
          String(classify(cacheHit)),
      )
    if (classify('D:\\IHUI-AI\\.git\\objects\\pack.tsbuildinfo') !== null)
      fails.push('REVERSE CONTROL BROKEN: a protected .git path classified as junk')
    if (classify('D:\\IHUI-AI\\apps\\web\\index.tsx') !== null)
      fails.push('REVERSE CONTROL BROKEN: a source file classified as junk')
    if (classify(cacheHit, Date.parse('2035-01-01T00:00:00')) !== null)
      fails.push('REVERSE CONTROL BROKEN: an expired REGENERABLE entry still classified')
    if (REGENERABLE.some((r) => !r.reason || !r.evidence || !r.expires))
      fails.push('REGENERABLE entry lacks reason/evidence/expires — 豁免必须验过才免且会到期')
    const bad = parseIMeta(Buffer.from([1, 2, 3]), 'tiny')
    if (!bad.error) fails.push('a 3-byte blob parsed anyway (fail-open)')
    const half = Buffer.alloc(40)
    half.writeUInt16LE(500, 24)
    if (!parseIMeta(half, 'liar').error)
      fails.push('length field lying about the buffer was accepted')

    // 判定面回放:把夹具写成一个真的"回收站目录",走 scanBinDirs + purgeItem 全链
    writeFileSync(join(dir, '$IJUNK01'), buildIMeta({ originalPath: junkPath, sizeBytes: 3 }))
    writeFileSync(join(dir, '$RJUNK01'), 'junk payload')
    mkdirSync(join(dir, '$RKEEP01'), { recursive: true })
    writeFileSync(join(dir, '$RKEEP01', 'inner.txt'), 'must survive')
    writeFileSync(join(dir, '$IKEEP01'), buildIMeta({ originalPath: realPath, sizeBytes: 13 }))
    writeFileSync(join(dir, '$IGARBAGE'), Buffer.from([0, 1, 2]))
    const fixtureScan = scanBinDirs([dir])
    if (fixtureScan.items.length !== 2)
      fails.push('fixture enumeration expected 2 entries, got ' + fixtureScan.items.length)
    if (fixtureScan.undetermined.length !== 1)
      fails.push(
        'fixture expected 1 undetermined (the 3-byte blob), got ' + fixtureScan.undetermined.length,
      )
    const fixtureSummary = summarize(fixtureScan.items, fixtureScan.undetermined)
    if (fixtureSummary.matched.entries !== 1)
      fails.push('fixture expected exactly 1 matched, got ' + fixtureSummary.matched.entries)
    if (fixtureSummary.keptUnmatched !== 1)
      fails.push('fixture expected exactly 1 kept, got ' + fixtureSummary.keptUnmatched)
    if (!Array.isArray(fixtureSummary.keptTop) || fixtureSummary.keptTop.length !== 1) {
      fails.push(
        'keptTop must carry the path shape of what is being kept, got ' +
          JSON.stringify(fixtureSummary.keptTop),
      )
    }
    const junkItem = fixtureScan.items.find((i) => i.rule)
    const keepItem = fixtureScan.items.find((i) => !i.rule)
    if (junkItem) {
      const r = purgeItem(junkItem)
      if (!r.removed) fails.push('purgeItem reported failure: ' + JSON.stringify(r.errors))
      if (existsSync(junkItem.iPath) || existsSync(junkItem.rPath))
        fails.push('purge left junk pair behind')
    } else {
      fails.push('fixture produced no matched item to purge (positive control broken)')
    }
    if (keepItem && !existsSync(keepItem.rPath))
      fails.push('REVERSE CONTROL BROKEN: purge ate a non-junk entry')

    // 真实条目回放:拿现存回收站里的一条 $I 逐字段验格式假设
    const sid = readMySid()
    if (sid) {
      const { dirs } = listBinDirs(['C:', 'D:'], sid)
      if (dirs.length > 0) {
        const firstName = readdirSync(dirs[0]).find((n) => n.startsWith('$I'))
        if (firstName) {
          const meta = parseIMeta(readFileSync(join(dirs[0], firstName)), firstName)
          if (meta.error) fails.push('a live bin entry failed to parse: ' + JSON.stringify(meta))
          else if (!/^[a-z]:\\/i.test(meta.originalPath))
            fails.push('live entry path is not rooted: ' + meta.originalPath)
        }
      }
    }
    // 存续腿夹具:2026-10-29 真盘读数原样搬入(坏 ACL 的三枚显式 Deny 与修完的形状)
    const ownSid = 'S-1-5-21-2945910849-4211772035-520136427-500'
    const badRights = 'DeleteSubdirectoriesAndFiles, Write, Delete'
    const liveAccess = [
      {
        type: 'Deny',
        sid: 'S-1-1-0',
        name: 'Everyone',
        rights: badRights,
        flags: 'ContainerInherit, ObjectInherit',
        inherited: false,
      },
      {
        type: 'Deny',
        sid: 'S-1-5-11',
        name: 'NT AUTHORITY\\Authenticated Users',
        rights: badRights,
        flags: 'ContainerInherit, ObjectInherit',
        inherited: false,
      },
      {
        type: 'Deny',
        sid: ownSid,
        name: 'MACHINE\\Administrator',
        rights: badRights,
        flags: 'ContainerInherit, ObjectInherit',
        inherited: false,
      },
      {
        type: 'Allow',
        sid: 'S-1-5-18',
        name: 'NT AUTHORITY\\SYSTEM',
        rights: 'FullControl',
        flags: 'ContainerInherit, ObjectInherit',
        inherited: false,
      },
      {
        type: 'Allow',
        sid: 'S-1-5-32-544',
        name: 'BUILTIN\\Administrators',
        rights: 'FullControl',
        flags: 'ContainerInherit, ObjectInherit',
        inherited: false,
      },
    ]
    const denies = explicitDenies(liveAccess)
    if (denies.length !== 3)
      fails.push('POSITIVE CONTROL BROKEN: 真盘那三枚显式 Deny 应全部命中,实得 ' + denies.length)
    if (explicitDenies([{ type: 'Deny', sid: 'S-1-1-0', inherited: true }]).length !== 0)
      fails.push('REVERSE CONTROL BROKEN: 继承来的 Deny 被当成可摘项(icacls /remove:d 只摘显式)')
    if (explicitDenies([{ type: 'Allow', sid: 'S-1-1-0' }]).length !== 0)
      fails.push('REVERSE CONTROL BROKEN: Allow 被当成 Deny')
    if (explicitDenies([{ type: 'Deny', sid: 'O:PAI<Lgarbage>' }]).length !== 0)
      fails.push('REVERSE CONTROL BROKEN: 形态不合格的受托人被放进摘除清单')

    const binDir = 'D:\\$Recycle.Bin\\' + ownSid
    if (!isBinSidDir(binDir, ownSid))
      fails.push('POSITIVE CONTROL BROKEN: 本 SID 的回收站目录没被认出')
    if (!isBinSidDir('D:\\$RECYCLE.BIN\\' + ownSid.toUpperCase(), ownSid))
      fails.push('POSITIVE CONTROL BROKEN: 大写形态没被认出(Windows 路径不区分大小写)')
    for (const notMine of [
      'C:\\$Recycle.Bin',
      'D:\\$Recycle.Bin\\S-1-5-18',
      'D:\\$Recycle.Bin\\S-1-5-21-1-1-1-500',
      'D:\\IHUI-AI\\' + ownSid,
      'D:/$Recycle.Bin/' + ownSid + '/sub',
    ]) {
      if (isBinSidDir(notMine, ownSid))
        fails.push('REVERSE CONTROL BROKEN: 不该被认成本 SID 回收站目录:' + notMine)
    }

    const plan = planAclRepair(
      binDir,
      denies.map((d) => d.sid),
      ownSid,
    )
    if (plan.remove.length !== 3 || plan.remove[0] !== '*S-1-1-0')
      fails.push('摘除清单错:' + JSON.stringify(plan.remove))
    if (plan.grant !== '*' + ownSid + ':(OI)(CI)F') fails.push('授权参数错:' + String(plan.grant))
    const dirtyPlan = planAclRepair(binDir, ['<bogus>', 'S-1-1-0'], ownSid)
    if (dirtyPlan.remove.length !== 1 || dirtyPlan.skipped.length !== 1)
      fails.push('坏受托人未被剔出下发清单:' + JSON.stringify(dirtyPlan))

    // 执行面只能碰本 SID 的回收站目录,且只走 icacls;这些反例必须在调用 icacls 之前就拒掉
    for (const hostile of [
      { dir: 'D:\\IHUI-AI', remove: ['*S-1-1-0'], grant: null },
      { dir: 'C:\\Windows', remove: [], grant: '*S-1-1-0:(OI)(CI)F' },
      { dir: binDir, remove: ['S-1-1-0'], grant: null },
    ]) {
      const r = runAclRepair(hostile, ownSid)
      if (r.attempted !== 0 || !r.refused)
        fails.push(
          'REVERSE CONTROL BROKEN: 该拒的下发了:' +
            JSON.stringify(hostile) +
            ' ⇒ ' +
            JSON.stringify(r),
        )
    }

    // 探针有牙:写进真目录应通过,写进不存在的路径必须报失败而不是静默 ok
    const liveProbe = probeBinDir(dir)
    if (!liveProbe.canWrite || !liveProbe.canDelete)
      fails.push('POSITIVE CONTROL BROKEN: 可写目录上的探针失败:' + JSON.stringify(liveProbe))
    if (readdirSync(dir).some((n) => n.startsWith('ihui-rb-probe-')))
      fails.push('探针文件没被自己清掉')
    const deadProbe = probeBinDir(join(dir, 'no-such-bin-dir'))
    if (deadProbe.canWrite || deadProbe.step !== 'create')
      fails.push('REVERSE CONTROL BROKEN: 不存在的目录上探针没报失败:' + JSON.stringify(deadProbe))

    const jOk = judgeAccess([{ state: 'ok' }, { state: 'ok' }])
    if (jOk.status !== 'ok' || jOk.code !== 0) fails.push('全 ok 应判 ok:' + JSON.stringify(jOk))
    const jHeal = judgeAccess([{ state: 'ok' }, { state: 'self-healed' }])
    if (jHeal.status !== 'self-healed' || jHeal.code !== 0)
      fails.push('修好应判 self-healed 且不红:' + JSON.stringify(jHeal))
    const jBreach = judgeAccess([{ state: 'ok' }, { state: 'breach' }])
    if (jBreach.status !== 'breach' || jBreach.code !== 1)
      fails.push('修完仍不可写必须红:' + JSON.stringify(jBreach))
    const jDry = judgeAccess([{ state: 'breach-unrepaired' }])
    if (jDry.code !== 0 || jDry.status !== 'breach-unrepaired')
      fails.push('dry-run 检出不该把任务顶红(它结构上修不了):' + JSON.stringify(jDry))
    const jEmpty = judgeAccess([])
    if (jEmpty.status !== 'undetermined' || jEmpty.code !== 2)
      fails.push(
        'REVERSE CONTROL BROKEN: 枚举到 0 个目录被判成 ' + jEmpty.status + ' —— 空集不是健康',
      )
    for (const st of ['undetermined', 'refused']) {
      const j = judgeAccess([{ state: 'ok' }, { state: st }])
      if (j.status !== 'undetermined' || j.code !== 2)
        fails.push(st + ' 不得记绿也不得冒红:' + JSON.stringify(j))
    }
  } finally {
    try {
      rmScratch(dir)
    } catch {
      /* 夹具残留由 §26 每日体检兜 */
    }
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
    else if (a === '--drives')
      opts.drives = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
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
    else
      process.stdout.write(
        (r.ok ? 'SELF-TEST PASS\n' : 'SELF-TEST FAIL\n') +
          r.fails.map((f) => '  - ' + f).join('\n') +
          '\n',
      )
    return r.ok ? 0 : 1
  }

  const sid = opts.sid || readMySid()
  if (!sid) {
    const msg = 'UNDETERMINED: 读不到当前进程 SID,拒绝在未知归属的回收站上动手'
    if (opts.json)
      process.stdout.write(JSON.stringify({ status: 'undetermined', error: msg }) + '\n')
    else process.stderr.write('x ' + msg + '\n')
    return 2
  }
  const { dirs, skipped } = listBinDirs(opts.drives, sid)
  if (dirs.length === 0) {
    const msg = 'UNDETERMINED: 本 SID 名下没有任何回收站目录'
    if (opts.json)
      process.stdout.write(JSON.stringify({ status: 'undetermined', error: msg, skipped }) + '\n')
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
    purge = {
      attempted: results.length,
      removed: okCount,
      failed: failures.length,
      failureSamples: failures.slice(0, 10),
    }
    // 落地后重扫一遍,用现读数字自证,而不是相信自己的返回值
    const rescan = scanBinDirs(dirs)
    const rescanSummary = summarize(rescan.items, rescan.undetermined)
    purge.afterRescan = rescanSummary
    if (failures.length > 0) {
      process.stderr.write('! ' + failures.length + ' 条目删除失败(未判定,原样保留)\n')
    }
  }

  const policy = policyLeg(opts.apply)
  const accessRows = accessLeg(dirs, sid, opts.apply)
  const access = judgeAccess(accessRows)
  const record = {
    at: new Date().toISOString(),
    sid,
    mode: opts.apply ? 'apply' : 'dry-run',
    binDirs: dirs,
    binDirsSkipped: skipped,
    scan: summary,
    purge,
    policy,
    access,
    accessRows,
  }
  const logged = logRun({
    at: record.at,
    sid,
    mode: record.mode,
    entries: summary.entriesTotal,
    matched: summary.matched.entries,
    kept: summary.keptUnmatched,
    undetermined: summary.undetermined,
    removed: purge ? purge.removed : 0,
    failed: purge ? purge.failed : 0,
    byRule: summary.matched.byRule,
    keptTop: summary.keptTop,
    access,
    accessRows: accessRows.map((r) => ({
      dir: r.dir,
      state: r.state,
      denies: r.acl ? r.acl.denies.length : null,
      firstError: r.first.error || null,
      repair: r.repair ? r.repair.refused || r.repair.attempted : null,
    })),
  })
  record.logWritten = logged

  if (opts.json) {
    process.stdout.write(JSON.stringify(record) + '\n')
  } else {
    process.stdout.write('回收站条目总数 = ' + summary.entriesTotal + '\n')
    process.stdout.write(
      '命中垃圾类 = ' +
        summary.matched.entries +
        ' 条 / ' +
        (summary.matched.bytes / 1048576).toFixed(1) +
        ' MB\n',
    )
    for (const [rule, n] of Object.entries(summary.matched.byRule))
      process.stdout.write('    ' + String(n).padStart(6) + ' x  ' + rule + '\n')
    process.stdout.write('保留不动(不属任何垃圾类) = ' + summary.keptUnmatched + ' 条\n')
    for (const s of summary.keptSamples.slice(0, 10)) process.stdout.write('    keep: ' + s + '\n')
    process.stdout.write('未判定(解析失败,一律保留) = ' + summary.undetermined + ' 条\n')
    for (const u of record.scan.undeterminedSamples)
      process.stdout.write('    undetermined: ' + (u.iPath || u.dir) + ' ' + u.error + '\n')
    process.stdout.write(
      '卷回收站策略 = ' +
        policy.status +
        (policy.rows
          ? ' (' +
            policy.rows.map((r) => r.drive + ':NukeOnDelete=' + r.nukeOnDelete).join(' ') +
            ')'
          : '') +
        '\n',
    )
    if (policy.why) process.stdout.write('  策略腿未判定:' + policy.why + '\n')
    process.stdout.write(
      '模式 = ' + record.mode + (opts.apply ? '' : '(未做任何改动;要落地加 --apply)') + '\n',
    )
    if (purge)
      process.stdout.write(
        '删除 = 尝试 ' +
          purge.attempted +
          ' 成功 ' +
          purge.removed +
          ' 失败 ' +
          purge.failed +
          ';重扫后总数 ' +
          purge.afterRescan.entriesTotal +
          ' 命中 ' +
          purge.afterRescan.matched.entries +
          '\n',
      )
    process.stdout.write(
      '目录可写性 = ' +
        access.status +
        ' (ok=' +
        access.ok +
        ' healed=' +
        access.healed +
        ' breach=' +
        access.breach +
        ' unrepaired=' +
        access.unrepaired +
        ' undetermined=' +
        access.undetermined +
        ' refused=' +
        access.refused +
        ')\n',
    )
    for (const r of accessRows) {
      if (r.state === 'ok') continue
      process.stdout.write(
        '    ' +
          r.dir +
          ' state=' +
          r.state +
          (r.first && r.first.error ? ' first=' + r.first.error : '') +
          (r.acl && r.acl.denies
            ? ' 显式Deny=' + r.acl.denies.map((d) => d.name || d.sid).join(',')
            : '') +
          (r.aclError ? ' 取不到ACL=' + r.aclError : '') +
          (r.repair && r.repair.refused ? ' 拒绝修=' + r.repair.refused : '') +
          '\n',
      )
    }
    if (access.why) process.stdout.write('  存续腿:' + access.why + '\n')
    process.stdout.write('日志 = ' + LOG_FILE + ' 写入=' + logged + '\n')
  }
  if (purge && purge.failed > 0) return 1
  if (access.code === 1) return 1
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  // 退出码必须真传出去:此前 main() 的返回值被丢掉,于是自检红、清理失败、未判定在
  // 计划任务的 LastTaskResult 上统统读成 0 —— 失效表现彻底安静(§0.3/§12f)。
  main()
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error('x ' + (e && e.message ? e.message : e) + '\n' + (e && e.stack ? e.stack : ''))
      process.exit(2)
    })
}

export const __test__ = {
  parseIMeta,
  buildIMeta,
  classify,
  isProtected,
  REGENERABLE,
  normalizePath,
  summarize,
  scanBinDirs,
  listBinDirs,
  purgeItem,
  readMySid,
  JUNK_PREFIXES,
  I_HEADER_BYTES,
  isBinSidDir,
  explicitDenies,
  planAclRepair,
  runAclRepair,
  probeBinDir,
  judgeAccess,
  readBinAcl,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
