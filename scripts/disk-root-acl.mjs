#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * disk-root-acl.mjs v2 — 盘根新建内核级阻断执法器(2026-11-15 立,同日 v2 重写)
 *
 * 机主定档:"所有项目根目录外可能生成的文件夹都要彻底堵死"。轮询(卫生尺 24h)/哨兵(10min)/
 * fs.watch 全是**发现机制**;唯一能让外泄"不可能"的是 NTFS 求值层显式 Deny。v1→v2 的三条实测教训
 * (2026-11-15 当轮逐通道对照钉死,不是抄文档):
 *
 *   T1 **记法**:SDDL 里 `(D;CI;LC;;;trustee)` 与 `(D;CI;DC;;;trustee)` 文档值同(0x4),但本机实测
 *      **只有 LC 记法咬得住 mkdir**(DC 记法写进去读得回、OS 不执法 —— V0..V5 + L×head 全矩阵
 *      对照,lc-vs-dc.ps1)。icacls 直写能咬,其产物正是 LC 记法。⇒ 本执法器恒用 LC 记法。
 *   T2 **位置**:Deny ACE 必须**置头**。Windows 求值逐 ACE 先命中先裁决,尾置 Deny 会被前位
 *      覆盖同权限位的 Allow 先判通过(V4-tail 实测 NOT-BLOCKED;置头后 OS 还会把完整 DACL 的
 *      Deny 自动排前,手动置头是最稳写法)。
 *   T3 **写通道**:Set-Acl cmdlet / icacls 在**盘根**会触发的继承重算在系统盘尺寸下直接挂死
 *      (实测 60s/300s 超时,半程还会把别的目录 ACL 洗成空壳 —— 已发生过一次:C 影子备份目录
 *      被 icacls 半截动作洗出 null DACL)。唯一快且精准的通道 = `CreateFileW(WRITE_DAC)` +
 *      `SetKernelObjectSecurity(securityInformation=0x4 仅 DACL)`,owner/group/SACL 零触碰。
 *      (顺带:DACL 位的值是 0x4 不是 0x2 —— OWNER=0x1/GROUP=0x2/DACL=0x4/SACL=0x8。v1 在这里
 *      连吃 err=1346/1,这里把真值表写死在旁注,不许再猜。)
 *
 * 拦截语义:`Deny CreateDirectories(CreateDirectory)`,只带 ContainerInherit(作用于"在该容器
 *   里新建子目录"这一步),不传播进任何子对象 ⇒ 现有条目读写删改名全不受连坐,盘根下的合法
 *   子目录(D:\DevEnv\... 等)内部一切照常;子目录里再新建也不受影响(CI ACE 落进子目录后
 *   只作用于子目录自身容器层 —— 实测 mkdir-under-devenv OK)。
 * 拦谁:AU/BU/WD/AC 四个泛身份(覆盖一切非提权进程,含本机全部工具链)。不拦 SY(计划任务
 *   基础设施)与提权 BA(人工出路,见逃生门)。管理员令牌若带 BA 组仍被 AU/BU/WD 命中 ——
 *   实测 Server 2022 内置 Administrator 的 mkdir 同样被拒(final-verify.ps1 mkdir-cmdlet/
 *   mkdir-dotnet 双 BLOCKED)。
 * 逃生门:`--undo`(摘牙,先备份)/ `--rollback <盘根>`(整片还原挂闸前 SDDL)。提权后以 BA
 *   显式 Allow 仍建不了(Deny>Allow 对本机已验证),真需要时在盘根建目录 = 先 --undo 再 --apply。
 *
 * 盘根集合:工作树盘 ∪ config/disk-root-allowlist.json 申报盘(现读,盘符不写死,§0/§15;
 *   盘不存在 ⇒ undetermined 点名,绝不把"枚举到 0"判绿,§0.3)。
 * 备份纪律:任何 apply/undo 前,先把该盘**当前** SDDL 写入 D(或实存批准盘):\DevEnv\backups\
 *   disk-root-acl\bak-<ROOT>-<utc>.sddl.new,原子两跳 rename 后生效;备份失败 ⇒ 拒动。
 *
 * 用法:
 *   node scripts/disk-root-acl.mjs --check [--json]     只读逐盘裁决 enforced/missing/undetermined
 *   node scripts/disk-root-acl.mjs --apply [D:\ ...]    装闸(缺省=全部在位盘根,幂等)
 *   node scripts/disk-root-acl.mjs --undo  [D:\ ...]    摘闸(只摘自家四条 LC-Deny)
 *   node scripts/disk-root-acl.mjs --rollback D:\       从最新备份整片还原
 *   node scripts/disk-root-acl.mjs --self-test          判据夹具(零真盘 IO)
 * env 覆盖:IHUI_DISK_ROOT_ACL_BACKUP_DIR(备份根)/ IHUI_DISK_ROOT_ACL_PS(PS 宿主,缺省自动选 pwsh)。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 本文件住 scripts/,上跳一级即仓根(ROOT 由脚本自身位置推导,§15)
const ROOT = resolve(__dirname, '..')

/** 自家牙的精确指纹:LC 记法 + 仅 CI + Deny + 四 trustee(T1 实测唯一能咬形态)。 */
const DENY_TRUSTEES = ['AU', 'BU', 'WD', 'AC']
const OWN_ACE_RE = /\(D;CI;LC;;;(AU|BU|WD|AC)\)/g
const OWN_ACE_TEXT = DENY_TRUSTEES.map((t) => `(D;CI;LC;;;${t})`).join('')

// ─────────────────────────────── 判据(纯函数) ───────────────────────────────

/**
 * 从一段 SDDL 判"牙齐不齐、在不在头"。
 * 返回 { enforced, present, missing, misplaced, undetermined }。
 * misplaced = 四条都在但没有任何一条落在 DACL 前 6 个 ACE 槽内(v1 尾置死牙专用哨;
 *   前 6 槽是余量:OS 规范化会把 Deny 族整体提前,真·置头不会超出)。
 */
export function judgeDenySddl(sddl) {
  if (typeof sddl !== 'string' || sddl.length === 0) {
    return { enforced: false, present: [], missing: [...DENY_TRUSTEES], misplaced: false, legacyDc: [], undetermined: true }
  }
  // v1 遗留 DC 死牙也算"在位但不执法"——单独点名,引导 --undo 后重挂
  const legacyDc = /\(D;CI;DC;;;(AU|BU|WD|AC)\)/g
  const present = new Set()
  for (const m of sddl.matchAll(OWN_ACE_RE)) present.add(m[1])
  const missing = DENY_TRUSTEES.filter((t) => !present.has(t))
  // 错位判定:直接看 DACL 的**第一个 ACE** 是不是自家 LC 牙(T2:尾置会被前位 Allow 先放行)
  let misplaced = false
  if (missing.length === 0) {
    const dIdx = sddl.indexOf('D:')
    const firstAce = sddl.indexOf('(', dIdx + 2)
    misplaced = firstAce < 0 || !/^\(D;CI;LC;;;(AU|BU|WD|AC)\)/.test(sddl.slice(firstAce))
  }
  const legacy = [...sddl.matchAll(legacyDc)].map((m) => m[1])
  return { enforced: missing.length === 0 && !misplaced, present: [...present], missing, misplaced, legacyDc: legacy, undetermined: false }
}

/** 三态逐盘裁决(green/red/undetermined;枚举不到盘 ⇒ undetermined,不冒绿)。 */
export function judgeDiskRootAclEnforced(targets = null) {
  if (process.platform !== 'win32') return { verdict: 'not-applicable', why: 'NTFS ACL 只对 win32 成立', rows: [] }
  const rows = []
  for (const r of targets || discoverDriveRoots()) {
    if (!existsSync(r)) {
      rows.push({ root: r, state: 'undetermined', why: '盘根不可达(盘不存在或未挂载)' })
      continue
    }
    try {
      const j = judgeDenySddl(readRootSddl(r))
      rows.push({
        root: r,
        state: j.undetermined ? 'undetermined' : j.enforced ? 'enforced' : 'missing',
        missing: j.missing,
        misplaced: j.misplaced,
        legacyDc: j.legacyDc,
        why: j.undetermined ? 'SDDL 读不到' : undefined,
      })
    } catch (e) {
      rows.push({ root: r, state: 'undetermined', why: `读 SD 失败:${String(e?.message || e).slice(0, 180)}` })
    }
  }
  const decisive = rows.filter((x) => x.state !== 'undetermined')
  const verdict = decisive.length === 0 ? 'undetermined' : decisive.some((x) => x.state === 'missing') ? 'red' : 'green'
  return { verdict, rows, undetermined: rows.length - decisive.length }
}

// ─────────────────────────────── 盘根枚举 / PS 宿主 ───────────────────────────────

/** 工作树盘 ∪ allowlist 申报盘(键形归一为 `<X>:\`)。config 读不到 ⇒ 至少含工作树盘。 */
export function discoverDriveRoots() {
  const out = new Set()
  const push = (p) => {
    const m = /^([A-Za-z]:)\\?$/.exec(String(p).trim())
    if (m) out.add(`${m[1].toUpperCase()}\\`)
  }
  try {
    const d = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8', windowsHide: true, timeout: 15_000, cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g 显式 stdio
    }).trim()
    push(d)
  } catch { /* 落回推导 */ }
  if (out.size === 0) push(ROOT)
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'disk-root-allowlist.json'), 'utf8'))
    for (const k of Object.keys(cfg.roots || {})) push(k)
  } catch { /* 申报盘读不到只剩工作树盘(仍是一维在判,不算没判) */ }
  return [...out].sort()
}

function psHost() {
  if (process.env.IHUI_DISK_ROOT_ACL_PS) return process.env.IHUI_DISK_ROOT_ACL_PS
  return process.platform === 'win32' ? 'pwsh.exe' : 'pwsh'
}
function psRun(script, timeoutMs = 90_000) {
  const stdout = execFileSync(psHost(), ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 1 << 22,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g
  })
  const out = String(stdout || '')
  // 宿主输出里混 error 记录时(红色 ! 行)也算失败:找我们探针的固定前缀
  if (out.includes('IHUI-ACL-ERR:')) {
    throw new Error(out.slice(out.indexOf('IHUI-ACL-ERR:'), out.indexOf('IHUI-ACL-ERR:') + 240))
  }
  return out.trim()
}

function psConvertAndWrite(root, sddl) {
  const q = (s) => s.replace(/'/g, "''")
  const script =
    // Add-Type 每次新类型名,防同会话重复注册冲突
    `$tn='IhuiAcl' + [guid]::NewGuid().ToString('N').Substring(0,10);` +
    `Add-Type -Namespace $tn -Name N -MemberDefinition '[DllImport(\\"advapi32.dll\\", SetLastError=true)] public static extern bool SetKernelObjectSecurity(IntPtr handle, int securityInformation, [In] byte[] securityDescriptor); [DllImport(\\"kernel32.dll\\", SetLastError=true, CharSet=CharSet.Unicode)] public static extern IntPtr CreateFileW(string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes, uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile); [DllImport(\\"kernel32.dll\\", SetLastError=true)] public static extern bool CloseHandle(IntPtr hObject); [DllImport(\\"advapi32.dll\\", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool ConvertStringSecurityDescriptorToSecurityDescriptorW(string StringSecurityDescriptor, uint StringSDRevision, out IntPtr SecurityDescriptor, out UIntPtr SecurityDescriptorSize); [DllImport(\\"kernel32.dll\\", SetLastError=true)] public static extern void LocalFree(IntPtr hMem);';` +
    `$T=($tn+'::N');` +
    `$sddl='${q(sddl)}';` +
    `$pSD=[IntPtr]::Zero;$sz=[UIntPtr]::Zero;` +
    `$okc=$($T)::ConvertStringSecurityDescriptorToSecurityDescriptorW($sddl,1,[ref]$pSD,[ref]$sz);` +
    `if(-not $okc){Write-Output ('IHUI-ACL-ERR: conv='+[System.Runtime.InteropServices.Marshal]::GetLastWin32Error());exit 0};` +
    `$n=[int]$sz.ToUInt64();` +
    `$b=[byte[]]::new($n);` +
    `[System.Runtime.InteropServices.Marshal]::Copy($pSD,$b,0,$n);` +
    `$T::LocalFree($pSD);` +
    `$h=$($T)::CreateFileW('${q(root)}',0x00040000,7,[IntPtr]::Zero,3,0x02000000,[IntPtr]::Zero);` +
    `if($h -eq [IntPtr](-1)){Write-Output ('IHUI-ACL-ERR: open='+[System.Runtime.InteropServices.Marshal]::GetLastWin32Error());exit 0};` +
    `# 0x4 = DACL_SECURITY_INFORMATION(0x1 OWNER/0x2 GROUP/0x8 SACL 一概不带)` +
    `$oks=$($T)::SetKernelObjectSecurity($h,0x4,$b);` +
    `$e=[System.Runtime.InteropServices.Marshal]::GetLastWin32Error();` +
    `$T::CloseHandle($h)|Out-Null;` +
    `if(-not $oks){Write-Output ('IHUI-ACL-ERR: set='+$e);exit 0};` +
    `Write-Output 'IHUI-ACL-OK';`
  return psRun(script)
}

export function readRootSddl(root) {
  const q = root.replace(/'/g, "''")
  const out = psRun(`(Get-Acl -LiteralPath '${q}').Sddl`)
  if (!out) throw new Error('Get-Acl 返回空')
  return out
}

// ─────────────────────────────── 备份 ───────────────────────────────

export function backupDir() {
  if (process.env.IHUI_DISK_ROOT_ACL_BACKUP_DIR) return process.env.IHUI_DISK_ROOT_ACL_BACKUP_DIR
  let drv = 'D:'
  const cand = discoverDriveRoots().filter((r) => existsSync(r))
  const hit = cand.find((r) => /^D:/.test(r)) || cand.find((r) => !/^C:/.test(r)) || cand[0]
  if (hit) drv = hit.slice(0, 1)
  return join(`${drv}\\`, 'DevEnv', 'backups', 'disk-root-acl')
}

/** 原子备份:写 .new → rename 转正;rename 失败 ⇒ 抛(调用方拒动)。 */
function backupNow(root) {
  const sddl = readRootSddl(root)
  const dir = backupDir()
  mkdirSync(dir, { recursive: true })
  const tag = root.replace(/[^A-Za-z0-9]/g, '')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fin = join(dir, `bak-${tag}-${stamp}.sddl`)
  writeFileSync(fin + '.new', sddl, 'utf8')
  renameSync(fin + '.new', fin)
  return { file: fin, sddl }
}

function latestBackup(root) {
  const tag = root.replace(/[^A-Za-z0-9]/g, '')
  const dir = backupDir()
  if (!existsSync(dir)) return null
  const bks = readdirSync(dir)
    .filter((f) => f.startsWith(`bak-${tag}-`) && f.endsWith('.sddl'))
    .sort()
  return bks.length ? join(dir, bks[bks.length - 1]) : null
}

// ─────────────────────────────── 装 / 摘 / 滚 ───────────────────────────────

function splitDaclAces(sddl) {
  const m = /^([^D]*D:)([A-Z]*)\(/.exec(sddl)
  if (!m) throw new Error('SDDL 无 DACL 段,拒绝盲动:' + sddl.slice(0, 80))
  const flagRun = m[2]
  const bodyStart = sddl.indexOf('(', m.index + m[0].length - 1) // 指向第一个 '('
  return { prefix: sddl.slice(0, bodyStart), acEs: aceList(sddl.slice(bodyStart)), flagRun }
  function aceList(s) {
    const out = []
    let depth = 0
    let cur = ''
    for (const ch of s) {
      if (ch === '(') depth++
      if (depth > 0) cur += ch
      if (ch === ')') {
        depth--
        if (depth === 0) {
          out.push(cur)
          cur = ''
        }
      }
    }
    return out
  }
}

/** 装闸:置头四牙(LC);已齐(含置头校验)⇒ already-enforced。 */
export function applyAclGate(targets = null, { log = () => {} } = {}) {
  const results = []
  for (const r of targets || discoverDriveRoots()) {
    if (!existsSync(r)) {
      results.push({ root: r, action: 'skipped', why: '盘根不可达' })
      continue
    }
    try {
      const cur = readRootSddl(r)
      const j = judgeDenySddl(cur)
      if (j.enforced && j.legacyDc.length === 0) {
        results.push({ root: r, action: 'already-enforced' })
        continue
      }
      const bk = backupNow(r)
      log(`已备份 ${r} 原始 SDDL → ${bk.file}`)
      const { prefix, acEs } = splitDaclAces(bk.sddl)
      const keepOwn = (a) => !(a.startsWith('(D;CI;LC;;;') && DENY_TRUSTEES.some((t) => a.endsWith(`;;;${t})`)))
      const legacy = (a) => /^\(D;CI;DC;;;(AU|BU|WD|AC)\)$/.test(a)
      const stripped = acEs.filter((a) => keepOwn(a) && !legacy(a))
      const head = DENY_TRUSTEES.map((t) => `(D;CI;LC;;;${t})`)
      const next = prefix + head.join('') + stripped.join('')
      const w = psConvertAndWrite(r, next)
      const rb = judgeDenySddl(readRootSddl(r))
      // 行为级自证:真试一把 mkdir,必须被拒(只读 SDDL 不算数,T1 教训:读得回 ≠ 咬得住)
      const behavioral = probeMkdirBlocked(r)
      results.push({
        root: r,
        action: rb.enforced && behavioral ? 'applied-verified' : 'apply-suspect',
        backup: bk.file,
        writeOut: String(w).slice(0, 120),
        judgeAfter: [rb.enforced, rb.missing],
        mkdirBlocked: behavioral,
      })
    } catch (e) {
      results.push({ root: r, action: 'error', why: String(e?.message || e).slice(0, 240) })
    }
  }
  return results
}

/** 摘闸:只 remove 自家四条 LC-Deny(含 DC 遗留一并清),先备份。 */
export function undoAclGate(targets = null) {
  const results = []
  for (const r of targets || discoverDriveRoots()) {
    if (!existsSync(r)) {
      results.push({ root: r, action: 'skipped', why: '盘根不可达' })
      continue
    }
    try {
      const cur = readRootSddl(r)
      const { prefix, acEs } = splitDaclAces(cur)
      const own = (a) => /^\(D;CI;LC;;;(AU|BU|WD|AC)\)$/.test(a) || /^\(D;CI;DC;;;(AU|BU|WD|AC)\)$/.test(a)
      const removed = acEs.filter(own)
      if (removed.length === 0) {
        results.push({ root: r, action: 'nothing-to-remove' })
        continue
      }
      const bk = backupNow(r)
      const next = prefix + acEs.filter((a) => !own(a)).join('')
      psConvertAndWrite(r, next)
      results.push({ root: r, action: 'removed', removed: removed.length, backup: bk.file })
    } catch (e) {
      results.push({ root: r, action: 'error', why: String(e?.message || e).slice(0, 240) })
    }
  }
  return results
}

/** 应急整片还原:最新 bak 备份 SDDL 原样写回(不拆解、不挑牙)。 */
export function rollbackRoot(root) {
  const b = latestBackup(root)
  if (!b) return { root, action: 'no-backup', dir: backupDir() }
  const sddl = readFileSync(b, 'utf8').trim()
  psConvertAndWrite(root, sddl)
  return { root, action: 'restored', from: b, judgeAfter: judgeDenySddl(readRootSddl(root)).enforced }
}

/** 行为探针:在 root 试建一个唯一名绝对路径目录;被拒=true。建成功=闸门没牙(补删+报 false)。 */
export function probeMkdirBlocked(root) {
  const name = `__ihui_acl_probe_${process.pid}_${Date.now()}__`
  // 禁 TrimEnd 拼接:'D:\'+'.x' 会产 `D:.x` = 盘符相对路径(建到 cwd,假 ALLOWED);
  // 统一用 Join-Path 出绝对路径。PS 字面量 'D:\' 的单引号串在 node 端已是 `D:\`。
  const q = (s) => s.replace(/'/g, "''")
  const psRoot = q(root)
  const script =
    `$p=Join-Path '${psRoot}' '${name}';` +
    `if(Test-Path $p){Remove-Item $p -Force -Recurse};` +
    `try{New-Item -ItemType Directory -Path $p -ErrorAction Stop|Out-Null;` +
    `if(Test-Path $p){Remove-Item $p -Force -Recurse};` +
    `Write-Output 'PROBE-ALLOWED'}catch{Write-Output 'PROBE-DENIED'}`
  const out = psRun(script, 60_000)
  if (out.includes('PROBE-DENIED')) return true
  if (out.includes('PROBE-ALLOWED')) return false
  throw new Error('probe 读数异常:' + out.slice(0, 120))
}

// ─────────────────────────────── guardian 自愈腿 ───────────────────────────────

/**
 * 只读对账 + 缺牙补装(幂等)。读不到 ⇒ undetermined,不补装不报错不占绿;
 * 补装前 applyAclGate 自带备份;补装后必须过行为探针,不过 ⇒ apply-suspect 交人。
 */
export function healDiskRootAcl(opts = {}) {
  const { notifyGuardRed = null, logger = () => {}, allowApply = true } = opts
  const r = judgeDiskRootAclEnforced()
  if (r.verdict === 'not-applicable') return { healed: false, verdict: r.verdict }
  if (r.verdict === 'undetermined') {
    logger(`ℹ️ 盘根ACL哨:未判定(${r.undetermined} 盘量不到)—— 不记绿也不补装`)
    return { healed: false, verdict: 'undetermined' }
  }
  const bad = r.rows.filter((x) => x.state === 'missing')
  if (bad.length === 0) return { healed: false, verdict: 'green' }
  const line =
    `盘根 ACL 执法闸缺牙:${bad.map((m) => `${m.root}(缺 ${(m.missing || []).join('/')}${(m.legacyDc || []).length ? ';遗留死牙DC' + m.legacyDc.join('/') : ''})`).join(' ')}` +
    (allowApply ? ' —— 自愈腿补装(先备份)' : ' —— dry-run 不实动')
  if (typeof notifyGuardRed === 'function') notifyGuardRed('盘根ACL执法闸缺牙', line)
  else logger(`⚠️ ${line}`)
  if (!allowApply) return { healed: false, verdict: 'dry-run', missing: bad.map((m) => m.root) }
  const applied = applyAclGate(bad.map((m) => m.root), { log: logger })
  return { healed: true, verdict: 'reapplied', rows: applied }
}

// ─────────────────────────────── self-test(纯判据,零 IO) ───────────────────────────────

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`✅ ${name}`) }
    else { fail++; console.log(`❌ ${name}${detail ? ` —— ${detail}` : ''}`) }
  }
  const FULL4 = DENY_TRUSTEES.map((x) => `(D;CI;LC;;;${x})`).join('')
  const BASE = 'O:SYG:SYD:(A;;FA;;;SY)(A;;FA;;;BA)(A;;0x1200a9;;;BU)'
  t('① 齐四条且在头 ⇒ enforced', judgeDenySddl(BASE.replace('D:(', 'D:' + FULL4 + '(')).enforced)
  t('② 缺 WD ⇒ missing=[WD]', JSON.stringify(judgeDenySddl(BASE.replace('D:(', 'D:(D;CI;LC;;;AU)(D;CI;LC;;;BU)(D;CI;LC;;;AC)(')).missing) === '["WD"]')
  t('③ v1 DC 记法 = 死牙:不算数,legacyDc 点名', (() => {
    const j = judgeDenySddl('O:SYG:SYD:(A;;FA;;;SY)(D;CI;DC;;;AU)(D;CI;DC;;;BU)(D;CI;DC;;;WD)(D;CI;DC;;;AC)')
    return !j.enforced && j.missing.length === 4 && j.legacyDc.length === 4
  })())
  t('④ LC 记法但尾置 ⇒ misplaced ⇒ 不 enforced', (() => {
    const j = judgeDenySddl(BASE + FULL4)
    return !j.enforced && j.misplaced === true
  })())
  t('⑤ OICI 全继承形态不认(防连坐假牙)', !judgeDenySddl('O:SYG:SYD:(A;;FA;;;SY)D:(D;OICI;LC;;;AU)(D;OICI;LC;;;BU)(D;OICI;LC;;;WD)(D;OICI;LC;;;AC)').enforced)
  t('⑥ 空输入 ⇒ undetermined', judgeDenySddl('').undetermined === true && !judgeDenySddl('').enforced)
  t('⑦ splitDaclAces 环 C(带 owner 自定义 SID + D:AI flag)', (() => {
    const s = 'O:S-1-5-80-956G:S-1-5-80-956D:AI(A;;LC;;;AU)(A;OICI;FA;;;SY)'
    const sp = splitDaclAces(s)
    return sp.prefix.endsWith('D:AI') && sp.acEs.length === 2 && sp.acEs[0].startsWith('(A;;LC')
  })())
  t('⑧ 重组恒等:split→重排→join 与原串逐字节同文(不动第三方 ACE)', (() => {
    const s = 'O:SYG:SYD:AI(D;CI;LC;;;AU)(A;;FA;;;SY)(A;;FA;;;BA)'
    const sp = splitDaclAces(s)
    return sp.prefix + sp.acEs.join('') === s
  })())
  t('⑨ C 盘长 trustee(S-1-15-3-…) 不被当自家牙误摘', (() => {
    const s = 'O:BAG:S-1-15-3-1D:(A;;0x1000a1;;;S-1-15-3-1)(A;;FA;;;SY)'
    const sp = splitDaclAces(s)
    const own = (a) => /^\(D;CI;LC;;;(AU|BU|WD|AC)\)$/.test(a) || /^\(D;CI;DC;;;(AU|BU|WD|AC)\)$/.test(a)
    return sp.acEs.filter(own).length === 0
  })())
  console.log(`\nself-test:${pass} pass / ${fail} fail`)
  return fail === 0 ? 0 : 1
}

// ─────────────────────────────── CLI ───────────────────────────────

function main() {
  const args = process.argv.slice(2)
  const has = (f) => args.includes(f)
  if (has('--self-test')) process.exit(selfTest())
  const targets = []
  for (const a of args) {
    const m = /^([A-Za-z]:)\\?$/.exec(a)
    if (m) targets.push(`${m[1].toUpperCase()}\\`)
  }
  const T = targets.length ? targets : null
  if (has('--rollback')) {
    if (!T || T.length !== 1) {
      console.error('用法:--rollback <单一盘根,如 D:\\>')
      process.exit(2)
    }
    console.log(JSON.stringify(rollbackRoot(T[0]), null, 2))
    process.exit(0)
  }
  if (has('--apply')) {
    console.log(JSON.stringify(applyAclGate(T, { log: (s) => console.error(s) }), null, 2))
    process.exit(0)
  }
  if (has('--undo')) {
    console.log(JSON.stringify(undoAclGate(T), null, 2))
    process.exit(0)
  }
  if (has('--probe')) {
    const rows = (T || discoverDriveRoots()).filter(existsSync).map((r) => ({ root: r, mkdirBlocked: probeMkdirBlocked(r) }))
    console.log(JSON.stringify(rows, null, 2))
    process.exit(rows.every((x) => x.mkdirBlocked) ? 0 : 1)
  }
  const r = judgeDiskRootAclEnforced(T)
  if (has('--json')) {
    console.log(JSON.stringify({ verdict: r.verdict, undetermined: r.undetermined, rows: r.rows }))
  } else {
    for (const row of r.rows) {
      const icon = row.state === 'enforced' ? '✅' : row.state === 'missing' ? '🚨' : '⚪'
      console.log(`${icon} ${row.root} ${row.state}${row.missing && row.missing.length ? ` (缺 ${row.missing.join('/')})` : ''}${row.misplaced ? ' [尾置死牙:在但排错位]' : ''}${row.legacyDc && row.legacyDc.length ? ` [v1 遗留 DC 死牙 ×${row.legacyDc.length}]` : ''}${row.why ? ` — ${row.why}` : ''}`)
    }
    console.log(`verdict=${r.verdict}`)
  }
  process.exit(r.verdict === 'red' ? 1 : r.verdict === 'undetermined' ? 2 : 0)
}

export const __test__ = {
  judgeDenySddl,
  judgeDiskRootAclEnforced,
  healDiskRootAcl,
  splitDaclAces,
  discoverDriveRoots,
  backupDir,
  DENY_TRUSTEES,
  OWN_ACE_TEXT,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href // §22d
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
