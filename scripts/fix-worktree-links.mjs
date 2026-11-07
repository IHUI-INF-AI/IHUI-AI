#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fix-worktree-links.mjs —— 把 worktree 里指错门的 `node_modules/@ihui/*` 软链重指回自身
 *
 * 配套判据: scripts/check-worktree-link-integrity.mjs(共用同一套扫描/判定原语)。
 *
 * 行为:
 *   - 默认 **dry-run**:只打印"将改动 N 条 / 跳过 M 条(占用中)/ 白名单 K 条",零写入;
 *   - `--apply` 才真正改;每条改动逐条打印"改前目标 -> 改后目标";
 *   - 只处理 `node_modules/@ihui/<pkg>` 软链,**绝不动仓库文件**;
 *   - 目标优先写成**相对路径**软链(避免盘符/大小写差异);相对软链失败再退绝对 junction;
 *   - 若某 worktree 的 `node_modules` 整目录是指向别的树的 junction(共享依赖布局),树内看到的
 *     链接物理上属于别人,直接重指会改坏别人的树 ⇒ 默认记为 `shared-node-modules` 跳过;
 *     加 `--materialize-shared`(须配合 `--apply`)可安全重建:把该树每个 `node_modules`
 *     改成"真实目录 + 依赖项逐项 junction 到原安装位置 + @ihui 指向本树包",不重装不联网;
 *   - 单条失败不中断,逐条记录,最后汇总失败清单;失败时会尝试恢复原链接;
 *   - 占用中的 worktree 一律不动(node/pnpm/tsc 等进程的 cwd 落在该 worktree 内即算占用;
 *     本脚本自身及其祖先进程不计);
 *   - 受保护 worktree 不动:`D:/IHUI-AI-wt-close`、`D:/IHUI-AI-ci-probe`(本仓纪律明令禁止触碰),
 *     可用 `--protect=` 覆盖、`--no-protect` 关闭内置保护(不推荐)。
 *
 * 用法:
 *   node scripts/fix-worktree-links.mjs                      # dry-run
 *   node scripts/fix-worktree-links.mjs --apply              # 实际修复(仅安全可改的链接)
 *   node scripts/fix-worktree-links.mjs --apply --materialize-shared  # 重建共享 node_modules
 *   node scripts/fix-worktree-links.mjs --apply --skip=D:/a,D:/b
 *   node scripts/fix-worktree-links.mjs --json               # 机器可读(含逐条清单)
 *   node scripts/fix-worktree-links.mjs --no-busy-check      # 跳过占用检测(高风险,慎用)
 *   node scripts/fix-worktree-links.mjs --self-test          # 夹具自测(含阴性对照)
 *
 * 退出码: 0 = dry-run 完成 / 全部成功;1 = --apply 有失败项;2 = 未判定(占用状态取不到、
 *         扫描失败等安全前提不成立)。
 */

/* eslint-disable no-console -- 守门/修复脚本为 CLI 工具,需 console 输出诊断信息 */

import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

import {
  DEFAULT_WHITELIST,
  EXIT_UNKNOWN,
  isInside,
  listScanRoots,
  normalizePath,
  scanWorktree,
} from './check-worktree-link-integrity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXIT_OK = 0
const EXIT_FAILED = 1

/** 本仓纪律明令禁止触碰的检出(项目硬约束)。 */
export const DEFAULT_PROTECTED = [
  'D:/IHUI-AI-wt-close', // 隔离收口树,禁止纳入任何改动
  'D:/IHUI-AI-ci-probe', // CI 探针树,禁止改动
]

/** 会被认作"正在使用某 worktree"的进程名;其余进程即使 cwd 命中也不算占用。 */
const BUSY_PROCESS_RE = /^(node|pnpm|tsc|tsx|vite|next|jest|vitest|esbuild)(\.exe|\.cmd)?$/i

function toDisplayPath(p) {
  return String(p).replace(/\\/g, '/')
}

/** 建立 worktree 内的包名 → 包目录索引(packages/* 与 apps/*)。 */
export function indexLocalPackages(worktreeRoot) {
  const map = new Map()
  for (const area of ['packages', 'apps']) {
    const areaDir = join(worktreeRoot, area)
    if (!existsSync(areaDir)) continue
    let entries = []
    try {
      entries = readdirSync(areaDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      if (!ent.isDirectory() && !ent.isSymbolicLink()) continue
      const pkgJson = join(areaDir, ent.name, 'package.json')
      if (!existsSync(pkgJson)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'))
        if (typeof pkg.name === 'string' && pkg.name && !map.has(pkg.name)) map.set(pkg.name, join(areaDir, ent.name))
      } catch {
        // package.json 损坏 ⇒ 该包视为本地不可用,由调用方按"本地缺包"记录
      }
    }
  }
  return map
}

/**
 * 生成单个 worktree 的修复计划(纯读,不写盘)。
 * @returns {{changes:Array, unfixable:Array, whitelisted:number, violations:number, links:number}}
 */
export function planWorktree(worktreeRoot, { whitelist = new Set(DEFAULT_WHITELIST), knownRoots }) {
  const scan = scanWorktree(worktreeRoot, { whitelist, knownRoots })
  const localIndex = indexLocalPackages(worktreeRoot)
  const changes = []
  const unfixable = []
  for (const v of scan.violations) {
    // 物理归属闸:链接所在的 @ihui 目录若经 junction 落到别的树,改它等于改别人的文件。
    // 这类必须跳过并在报告里点名(共享 node_modules 布局),不能用词法路径假装"在本树内"。
    if (v.physicallyOwned === false) {
      unfixable.push({
        ...v,
        reason: 'shared-node-modules',
        detail: `链接实际位于 ${v.physicalOwner ?? v.physicalLinkDir} 的 node_modules(经 junction 共享),改它会影响该树;需在本树重建 node_modules(pnpm install)`,
      })
      continue
    }
    const localDir = localIndex.get(v.package)
    if (!localDir) {
      unfixable.push({
        ...v,
        reason: 'local-package-missing',
        detail: `本 worktree 内没有名为 ${v.package} 的 package.json`,
      })
      continue
    }
    let localReal = ''
    try {
      localReal = realpathSync(localDir)
    } catch {
      localReal = ''
    }
    if (!localReal || !isInside(worktreeRoot, localReal)) {
      unfixable.push({
        ...v,
        reason: 'local-package-outside',
        detail: `本地包目录解析到 ${toDisplayPath(localReal || localDir)},不在本 worktree 内`,
      })
      continue
    }
    const relTarget = relative(dirname(v.absoluteLink), localReal).replace(/\\/g, '/')
    changes.push({
      worktree: worktreeRoot,
      link: v.link,
      absoluteLink: v.absoluteLink,
      package: v.package,
      beforeTarget: v.target,
      afterTarget: localReal,
      relativeTarget: relTarget,
      category: v.category,
    })
  }
  return {
    changes,
    unfixable,
    whitelisted: scan.whitelisted,
    violations: scan.violations.length,
    links: scan.links,
    externalNodeModules: scan.externalNodeModules ?? [],
  }
}

/** PowerShell 进程 cwd 探针(读 PEB → ProcessParameters → CurrentDirectory)。 */
function psCwdProbeScript(selfPid) {
  return String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class CwdProbe {
  [StructLayout(LayoutKind.Sequential)]
  struct PBI {
    public IntPtr ExitStatus;
    public IntPtr PebBaseAddress;
    public IntPtr AffinityMask;
    public IntPtr BasePriority;
    public IntPtr UniqueProcessId;
    public IntPtr InheritedFromUniqueProcessId;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct US {
    public ushort Length;
    public ushort MaximumLength;
    public IntPtr Buffer;
  }
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int cls, ref PBI pbi, int len, out int ret);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(int access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr size, out IntPtr read);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  public static string Get(int pid) {
    IntPtr h = OpenProcess(0x0410, false, pid);
    if (h == IntPtr.Zero) return "";
    try {
      PBI pbi = new PBI(); int ret;
      int st = NtQueryInformationProcess(h, 0, ref pbi, Marshal.SizeOf(typeof(PBI)), out ret);
      if (st != 0) return "";
      IntPtr pp = ReadPtr(h, pbi.PebBaseAddress + 0x20);
      if (pp == IntPtr.Zero) return "";
      byte[] raw = new byte[16]; IntPtr read;
      if (!ReadProcessMemory(h, pp + 0x38, raw, (IntPtr)16, out read)) return "";
      int len = BitConverter.ToUInt16(raw, 0);
      IntPtr buf = new IntPtr(BitConverter.ToInt64(raw, 8));
      if (buf == IntPtr.Zero || len == 0) return "";
      byte[] data = new byte[len];
      if (!ReadProcessMemory(h, buf, data, (IntPtr)len, out read)) return "";
      return Encoding.Unicode.GetString(data, 0, len);
    } catch { return ""; } finally { CloseHandle(h); }
  }
  static IntPtr ReadPtr(IntPtr h, IntPtr addr) {
    byte[] raw = new byte[IntPtr.Size]; IntPtr read;
    if (!ReadProcessMemory(h, addr, raw, (IntPtr)IntPtr.Size, out read)) return IntPtr.Zero;
    return new IntPtr(BitConverter.ToInt64(raw, 0));
  }
}
'@
Add-Type -TypeDefinition $code -Language CSharp
$selfPid = ${Number(selfPid)}
$ancestors = @()
$cur = $selfPid
for ($i = 0; $i -lt 30; $i++) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -ErrorAction SilentlyContinue
  if (-not $p) { break }
  $parent = [int]$p.ParentProcessId
  if ($parent -le 0) { break }
  $ancestors += $parent
  $cur = $parent
}
$items = @()
foreach ($proc in (Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) {
  if ($proc.Name -notmatch '^(node|pnpm|tsc|tsx|vite|next|jest|vitest|esbuild)(\.exe|\.cmd)?$') { continue }
  if ([int]$proc.ProcessId -eq $selfPid) { continue }
  $cwd = [CwdProbe]::Get([int]$proc.ProcessId)
  if ($cwd -eq '') { continue }
  $items += [pscustomobject]@{ pid = [int]$proc.ProcessId; name = $proc.Name; cwd = $cwd }
}
[pscustomobject]@{ ancestors = $ancestors; processes = $items } | ConvertTo-Json -Depth 4 -Compress
`
}

/**
 * 检测占用中的 worktree。
 * @returns {{ok:boolean, error?:string, busy:Map<string, Array<{pid,name,cwd}>>}}
 */
export function detectBusyWorktrees(worktreeRoots) {
  const busy = new Map()
  if (process.platform !== 'win32') return { ok: false, error: '仅支持 win32 进程 cwd 探测', busy }
  const tmpFile = join(tmpdir(), `ihui-wt-busy-${process.pid}-${Date.now()}.ps1`)
  try {
    writeFileSync(tmpFile, psCwdProbeScript(process.pid), 'utf8')
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpFile],
      { encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    )
    const parsed = JSON.parse(out.trim().replace(/^\uFEFF/, ''))
    const ancestors = new Set((parsed.ancestors ?? []).map(Number))
    ancestors.add(process.pid)
    for (const proc of parsed.processes ?? []) {
      if (ancestors.has(Number(proc.pid))) continue
      if (!BUSY_PROCESS_RE.test(proc.name)) continue
      for (const root of worktreeRoots) {
        if (isInside(root, proc.cwd)) {
          const list = busy.get(normalizePath(root)) ?? []
          list.push({ pid: Number(proc.pid), name: proc.name, cwd: toDisplayPath(proc.cwd) })
          busy.set(normalizePath(root), list)
          break
        }
      }
    }
    return { ok: true, busy }
  } catch (e) {
    return { ok: false, error: e.message, busy }
  } finally {
    try {
      rmSync(tmpFile, { force: true })
    } catch {
      /* 临时探针清理失败不影响结论 */
    }
  }
}

/**
 * 安全替换一条软链:先建临时软链验证权限,再摘旧链、rename 就位;失败恢复原目标。
 * 相对路径优先;相对软链失败退绝对 junction。
 */
export function replaceLink(change) {
  const linkPath = change.absoluteLink
  const tmpLink = `${linkPath}.ihui-fix-${process.pid}`
  let mode = ''
  let removed = false
  const create = (target, type) => {
    if (existsSync(tmpLink) || isLinkAt(tmpLink)) removeLinkOnly(tmpLink)
    symlinkSync(target, tmpLink, type)
  }
  try {
    try {
      create(change.relativeTarget, 'dir')
      mode = 'relative-symlink'
    } catch {
      create(toDisplayPath(change.afterTarget).replace(/\//g, '\\'), 'junction')
      mode = 'absolute-junction'
    }
    const tmpReal = realpathSync(tmpLink)
    if (!isInside(change.worktree, tmpReal)) {
      removeLinkOnly(tmpLink)
      return { ok: false, mode, error: `临时链解析到 ${toDisplayPath(tmpReal)},不在本 worktree 内` }
    }
    removeLinkOnly(linkPath)
    removed = true
    try {
      renameSync(tmpLink, linkPath)
    } catch {
      // rename 失败(少量文件系统不允许覆盖)⇒ 直接在原位置重建
      symlinkSync(mode === 'relative-symlink' ? change.relativeTarget : change.afterTarget, linkPath, mode === 'relative-symlink' ? 'dir' : 'junction')
    }
    const afterReal = realpathSync(linkPath)
    if (!isInside(change.worktree, afterReal)) {
      return { ok: false, mode, error: `改后解析到 ${toDisplayPath(afterReal)},不在本 worktree 内` }
    }
    return { ok: true, mode, afterTarget: toDisplayPath(afterReal) }
  } catch (e) {
    removeLinkOnly(tmpLink)
    if (removed) {
      // 原链已被摘掉 ⇒ 尽力恢复(重建原目标),避免把 worktree 弄成断链
      try {
        symlinkSync(String(change.beforeTarget).replace(/\//g, '\\'), linkPath, 'junction')
      } catch {
        /* 恢复失败已会在 error 里体现 */
      }
    }
    return { ok: false, mode, error: e.message }
  }
}

function isLinkAt(p) {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

/** 只删除软链本身;若目标是真实目录/文件则拒绝(绝不误删仓库内容)。 */
function removeLinkOnly(p) {
  let st
  try {
    st = lstatSync(p)
  } catch {
    return
  }
  if (!st.isSymbolicLink()) throw new Error(`拒绝删除非软链路径: ${p}`)
  unlinkSync(p)
}

function formatBusyReason(list) {
  const sample = list.slice(0, 3).map((p) => `${p.name}#${p.pid}(cwd=${p.cwd})`).join(', ')
  return `${list.length} 个进程占用: ${sample}${list.length > 3 ? ' …' : ''}`
}

/**
 * 共享 node_modules 的重建计划。
 *
 * 背景:这些 worktree 的 `node_modules` 整目录是指向别的树的 junction。树内看到的
 * `@ihui/*` 其实是**别人**的链接,直接重指会把别人的树改坏。安全做法是把本树的每个
 * `node_modules` 从"整目录 junction"改造成"真实目录 + 逐项 junction":
 *   - 非 @ihui 依赖仍 junction 到原已装好的真实路径(不重装、不联网、不占额外磁盘);
 *   - @ihui/<pkg> 重建为指向本树 `packages|apps/<pkg>` 的相对软链。
 * 这样既不碰别的工作树,又让本树的 tsc/测试真正解析到自己的代码。
 */
export function buildMaterializationPlan(worktreeRoot, { knownRoots, whitelist = new Set(DEFAULT_WHITELIST) }) {
  const scan = scanWorktree(worktreeRoot, { whitelist, knownRoots })
  if ((scan.externalNodeModules ?? []).length === 0) return null
  const localIndex = indexLocalPackages(worktreeRoot)
  const items = []
  for (const ext of scan.externalNodeModules) {
    const nodeModules = join(worktreeRoot, ext.path)
    let owner = ''
    try {
      owner = realpathSync(nodeModules)
    } catch {
      items.push({ ...ext, error: '无法解析 node_modules junction 的真实目标' })
      continue
    }
    let ownerEntries = []
    let ownerScope = []
    let ownerScopeReal = ''
    try {
      ownerEntries = readdirSync(owner)
      ownerScopeReal = realpathSync(join(owner, '@ihui'))
      ownerScope = readdirSync(ownerScopeReal)
    } catch (e) {
      items.push({ ...ext, nodeModules, owner, error: `读取原 node_modules 失败:${e.message}` })
      continue
    }
    const links = ownerScope.map((name) => {
      const pkg = `@ihui/${name}`
      const local = localIndex.get(pkg)
      let localReal = ''
      if (local) {
        try {
          localReal = realpathSync(local)
        } catch {
          localReal = ''
        }
      }
      const localOk = Boolean(localReal) && isInside(worktreeRoot, localReal)
      return { package: pkg, name, localDir: localOk ? localReal : '', ownerLink: join(ownerScopeReal, name), fallback: !localOk }
    })
    items.push({
      ...ext,
      worktreeRoot,
      nodeModules,
      owner,
      ownerEntries: ownerEntries.length,
      links,
      localLinks: links.filter((l) => !l.fallback).length,
      fallbackLinks: links.filter((l) => l.fallback).length,
    })
  }
  return { items }
}

/** 逐项复制原 node_modules 的非 @ihui 条目(优先 junction,文件用 file symlink/复制兜底)。 */
function populateShadowNodeModules(item) {
  const tmp = `${item.nodeModules}.ihui-rb-${process.pid}`
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const errors = []
  let entries = 0
  for (const name of readdirSync(item.owner)) {
    if (name === '@ihui') continue
    const src = join(item.owner, name)
    const dest = join(tmp, name)
    try {
      const real = realpathSync(src)
      if (statSync(real).isDirectory()) symlinkSync(real, dest, 'junction')
      else {
        try {
          symlinkSync(real, dest, 'file')
        } catch {
          copyFileSync(real, dest)
        }
      }
      entries++
    } catch (e) {
      errors.push(`${name}: ${e.message}`)
    }
  }
  const scopeDir = join(tmp, '@ihui')
  mkdirSync(scopeDir, { recursive: true })
  let localLinks = 0
  let fallbackLinks = 0
  for (const l of item.links) {
    const dest = join(scopeDir, l.name)
    if (!l.fallback) {
      const rel = relative(scopeDir, l.localDir).replace(/\\/g, '/')
      try {
        symlinkSync(rel, dest, 'dir')
      } catch {
        symlinkSync(l.localDir, dest, 'junction')
      }
      localLinks++
    } else {
      try {
        symlinkSync(realpathSync(l.ownerLink), dest, 'junction')
      } catch (e) {
        errors.push(`@ihui/${l.name}: ${e.message}`)
        continue
      }
      fallbackLinks++
    }
  }
  return { tmp, entries, localLinks, fallbackLinks, errors }
}

/** 对单个 external node_modules 做原子替换:先建 shadow,校验,再 rename 换位。 */
export function rebuildOneSharedNodeModules(item) {
  const shadow = populateShadowNodeModules(item)
  const backup = `${item.nodeModules}.ihui-orig-${process.pid}`
  try {
    // 影子目录里的本地 @ihui 必须真的解析到本树
    for (const l of item.links) {
      if (l.fallback) continue
      const dest = join(shadow.tmp, '@ihui', l.name)
      let real
      try {
        real = realpathSync(dest)
      } catch (e) {
        throw new Error(`影子校验失败 ${l.package}: ${e.message}`)
      }
      if (!isInside(item.worktreeRoot, real)) {
        throw new Error(`影子校验失败 ${l.package}: 解析到 ${toDisplayPath(real)},不在本树内`)
      }
    }
    if (existsSync(backup)) rmSync(backup, { recursive: true, force: true })
    renameSync(item.nodeModules, backup)
    try {
      renameSync(shadow.tmp, item.nodeModules)
    } catch (e) {
      renameSync(backup, item.nodeModules)
      throw new Error(`换位失败已回滚:${e.message}`)
    }
    try {
      removeLinkOnly(backup)
    } catch {
      /* 备份清理失败不影响功能 */
    }
    return { ok: true, ...shadow, errors: shadow.errors }
  } catch (e) {
    try {
      removeLinkOnly(shadow.tmp)
    } catch {
      /* ignore */
    }
    return { ok: false, error: e.message, ...shadow }
  }
}


/**
 * 主流程:扫描 → 计划(不执行)。
 * @param {object} opts
 * @param {Array} [opts.entries] 显式扫描根(测试注入;默认走 git worktree list)
 * @returns {{worktrees:Array, knownRoots:Array}}
 */
export function runFixPlan({ repoRoot = ROOT, whitelist = new Set(DEFAULT_WHITELIST), protectedPaths = DEFAULT_PROTECTED, skip = new Set(), only = new Set(), busy = new Map(), entries = null, materializeShared = false }) {
  entries = entries ?? listScanRoots(repoRoot)
  const knownRoots = [repoRoot]
  for (const e of entries) {
    if (!knownRoots.some((k) => normalizePath(k) === normalizePath(e.path))) knownRoots.push(e.path)
  }
  const protectedSet = [...protectedPaths].map(normalizePath)
  const skipSet = [...skip].map(normalizePath)
  const onlySet = [...only].map(normalizePath)

  const worktrees = []
  for (const entry of entries) {
    const root = entry.path
    if (!existsSync(root)) continue
    const nr = normalizePath(root)
    if (onlySet.length > 0 && !onlySet.includes(nr)) continue
    const plan = planWorktree(root, { whitelist, knownRoots })
    if (plan.changes.length === 0 && plan.unfixable.length === 0) continue
    if (materializeShared && plan.externalNodeModules.length > 0) {
      plan.materializations = buildMaterializationPlan(root, { knownRoots, whitelist })?.items ?? []
    } else {
      plan.materializations = []
    }
    let status = 'planned'
    let reason = ''
    if (protectedSet.includes(nr)) {
      status = 'protected'
      reason = '本仓纪律内置保护清单,禁止改动'
    } else if (skipSet.includes(nr)) {
      status = 'skipped'
      reason = '--skip 显式排除'
    } else if ((busy.get(nr) ?? []).length > 0) {
      status = 'busy'
      reason = formatBusyReason(busy.get(nr))
    }
    worktrees.push({ path: toDisplayPath(root), root, status, reason, plan })
  }
  return { worktrees, knownRoots }
}

function summaryOf(wt) {
  const mats = wt.plan.materializations ?? []
  return {
    path: wt.path,
    status: wt.status,
    reason: wt.reason,
    planned: wt.plan.changes.length,
    whitelisted: wt.plan.whitelisted,
    unfixable: wt.plan.unfixable.length,
    unfixableByReason: wt.plan.unfixable.reduce((acc, u) => {
      acc[u.reason] = (acc[u.reason] ?? 0) + 1
      return acc
    }, {}),
    materializeDirs: mats.length,
    materializeLinks: mats.reduce((n, m) => n + (m.localLinks ?? 0), 0),
    materializeFallbacks: mats.reduce((n, m) => n + (m.fallbackLinks ?? 0), 0),
    externalNodeModules: wt.plan.externalNodeModules ?? [],
  }
}

function countTotals(worktrees) {
  const totals = {
    planned: 0,
    busyLinks: 0,
    protectedLinks: 0,
    skippedLinks: 0,
    whitelisted: 0,
    unfixable: 0,
    unfixableByReason: {},
    sharedNodeModulesWorktrees: 0,
    materializeWorktrees: 0,
    materializeDirs: 0,
    materializeLinks: 0,
    materializeFallbacks: 0,
    worktrees: worktrees.length,
    busyWorktrees: 0,
  }
  for (const wt of worktrees) {
    totals.whitelisted += wt.plan.whitelisted
    totals.unfixable += wt.plan.unfixable.length
    for (const u of wt.plan.unfixable) totals.unfixableByReason[u.reason] = (totals.unfixableByReason[u.reason] ?? 0) + 1
    if ((wt.plan.externalNodeModules ?? []).length > 0) totals.sharedNodeModulesWorktrees++
    const mats = wt.plan.materializations ?? []
    if (wt.status === 'planned') {
      totals.planned += wt.plan.changes.length
      totals.materializeWorktrees += mats.length > 0 ? 1 : 0
      totals.materializeDirs += mats.length
      totals.materializeLinks += mats.reduce((n, m) => n + (m.localLinks ?? 0), 0)
      totals.materializeFallbacks += mats.reduce((n, m) => n + (m.fallbackLinks ?? 0), 0)
    } else if (wt.status === 'busy') {
      // 占用中整树跳过:待处理面 = 可改条数 + 不可安全修复条数(后者同样被跳过)
      totals.busyLinks += wt.plan.changes.length + wt.plan.unfixable.length
      totals.busyWorktrees++
    } else if (wt.status === 'protected') totals.protectedLinks += wt.plan.changes.length + wt.plan.unfixable.length
    else totals.skippedLinks += wt.plan.changes.length + wt.plan.unfixable.length
  }
  return totals
}

function printPlan(report, { apply, limit }) {
  const totals = report.totals
  const reasons = totals.unfixableByReason ?? {}
  console.log(apply ? 'worktree 链接修复(--apply)' : 'worktree 链接修复计划(dry-run,零写入)')
  console.log(
    `  将改动 ${totals.planned} 条 / 跳过 ${totals.busyLinks} 条(占用中)/ 白名单 ${totals.whitelisted} 条` +
      ` / 无法安全修复 ${totals.unfixable} 条(${Object.entries(reasons).map(([k, v]) => `${k}=${v}`).join(', ') || '无'})` +
      ` / 受保护 ${totals.protectedLinks} 条`,
  )
  if (totals.materializeWorktrees > 0) {
    console.log(
      `  重建共享 node_modules:${totals.materializeWorktrees} 个 worktree / ${totals.materializeDirs} 个目录` +
        ` / ${totals.materializeLinks} 条 @ihui 链接转本地(无本地副本回退 ${totals.materializeFallbacks} 条)`,
    )
  }
  console.log(`  涉及 worktree ${totals.worktrees} 个(其中占用中 ${totals.busyWorktrees} 个)`)
  if (totals.sharedNodeModulesWorktrees > 0) {
    console.log(`  根因提示:${totals.sharedNodeModulesWorktrees} 个 worktree 的 node_modules 整目录是外部 junction(共享依赖布局)`)
  }
  for (const wt of report.worktrees) {
    if (wt.status === 'planned') {
      console.log(`\n[${wt.path}] 将改动 ${wt.plan.changes.length} 条`)
    } else {
      const label = wt.status === 'busy' ? '占用中,跳过' : wt.status === 'protected' ? '受保护,跳过' : '显式跳过'
      console.log(`\n[${wt.path}] ${label}: ${wt.reason}`)
      if (wt.plan.changes.length > 0) console.log(`  (本可通过重指解决 ${wt.plan.changes.length} 条,因跳过未执行)`)
      continue
    }
    const shown = wt.plan.changes.slice(0, limit)
    for (const c of shown) {
      console.log(`  - ${c.link}: ${c.beforeTarget}  ->  ${toDisplayPath(c.afterTarget)}  (相对 ${c.relativeTarget})`)
    }
    if (wt.plan.changes.length > shown.length) console.log(`  … 其余 ${wt.plan.changes.length - shown.length} 条省略`)
    const groups = new Map()
    for (const u of wt.plan.unfixable) {
      const key = `${u.reason}|${u.physicalOwner ?? u.physicalLinkDir ?? ''}`
      const g = groups.get(key) ?? { reason: u.reason, owner: u.physicalOwner ?? u.physicalLinkDir ?? '', items: [] }
      g.items.push(u)
      groups.set(key, g)
    }
    for (const g of groups.values()) {
      const ownerText = g.owner ? `;链接物理归属 ${g.owner}` : ''
      console.log(`  ! 无法安全修复 ${g.items.length} 条:${g.reason}${ownerText}`)
      for (const u of g.items.slice(0, limit)) console.log(`      ${u.link} -> ${u.target}`)
      if (g.items.length > limit) console.log(`      … 其余 ${g.items.length - limit} 条省略`)
    }
    for (const m of wt.plan.materializations ?? []) {
      if (m.error) {
        console.log(`  ! 重建跳过 ${m.path}: ${m.error}`)
        continue
      }
      console.log(
        `  [重建] ${m.path}: ${m.ownerEntries} 个依赖项 junction + @ihui 本地化 ${m.localLinks} 条` +
          `${m.fallbackLinks ? ` / 无本地副本回退 ${m.fallbackLinks} 条` : ''}`,
      )
    }
  }
  if (totals.sharedNodeModulesWorktrees > 0) {
    console.log('\n共享 node_modules 明细(改链接会波及下列树,故跳过):')
    for (const wt of report.worktrees) {
      const ext = wt.plan.externalNodeModules ?? []
      if (ext.length === 0) continue
      console.log(`  [${wt.path}] 外部 node_modules ${ext.length} 个,junction 属性来自:${ext[0].ownerWorktree ?? ext[0].physical}`)
      for (const e of ext.slice(0, limit)) console.log(`    - ${e.path} -> ${e.physical}`)
      if (ext.length > limit) console.log(`    … 其余 ${ext.length - limit} 个省略`)
    }
  }
}

function executePlan(report) {
  const results = []
  for (const wt of report.worktrees) {
    if (wt.status !== 'planned') {
      results.push({ ...summaryOf(wt), applied: [], failed: [] })
      continue
    }
    const applied = []
    const failed = []
    const rebuilt = []
    for (const m of wt.plan.materializations ?? []) {
      if (m.error) {
        failed.push({ link: m.path, error: m.error })
        continue
      }
      console.log(`  [重建] ${wt.path} ${m.path}`)
      console.log(`        owner: ${toDisplayPath(m.owner)}`)
      console.log(`        依赖项 ${m.ownerEntries} 个沿用 junction;@ihui 本地化 ${m.localLinks} 条`)
      const res = rebuildOneSharedNodeModules(m)
      if (res.ok) rebuilt.push({ nodeModules: m.path, localLinks: res.localLinks, fallbackLinks: res.fallbackLinks, entries: res.entries })
      else failed.push({ link: m.path, error: res.error })
    }
    for (const change of wt.plan.changes) {
      console.log(`  [改] ${wt.path} ${change.link}`)
      console.log(`        before: ${change.beforeTarget}`)
      console.log(`        after : ${toDisplayPath(change.afterTarget)}  (相对 ${change.relativeTarget})`)
      const res = replaceLink(change)
      if (res.ok) applied.push({ ...change, mode: res.mode, finalTarget: res.afterTarget })
      else failed.push({ ...change, error: res.error })
    }
    // 修完立刻复扫,把残留作为证据,不靠"没报错"推断成功
    const recheck = scanWorktree(wt.root, {
      whitelist: new Set(DEFAULT_WHITELIST),
      knownRoots: report.knownRoots,
    })
    results.push({
      ...summaryOf(wt),
      applied,
      rebuilt,
      failed,
      remainingViolations: recheck.violations.length,
      remainingPhysicallyOwned: recheck.violations.filter((v) => v.physicallyOwned !== false).length,
    })
  }
  return results
}

function buildArgs(argv) {
  const opts = {
    apply: false,
    json: false,
    noBusyCheck: false,
    noProtect: false,
    selfTest: false,
    materializeShared: false,
    whitelist: new Set(DEFAULT_WHITELIST),
    protectedPaths: [...DEFAULT_PROTECTED],
    skip: [],
    only: [],
    limit: 5000,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') opts.apply = true
    else if (a === '--dry-run') opts.apply = false
    else if (a === '--json') opts.json = true
    else if (a === '--no-busy-check') opts.noBusyCheck = true
    else if (a === '--no-protect') opts.noProtect = true
    else if (a === '--materialize-shared') opts.materializeShared = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--skip') addPathList(opts.skip, argv[++i] ?? '')
    else if (a.startsWith('--skip=')) addPathList(opts.skip, a.slice('--skip='.length))
    else if (a === '--only') addPathList(opts.only, argv[++i] ?? '')
    else if (a.startsWith('--only=')) addPathList(opts.only, a.slice('--only='.length))
    else if (a === '--protect') addPathList(opts.protectedPaths, argv[++i] ?? '')
    else if (a.startsWith('--protect=')) addPathList(opts.protectedPaths, a.slice('--protect='.length))
    else if (a === '--whitelist') addWhitelist(opts.whitelist, argv[++i] ?? '')
    else if (a.startsWith('--whitelist=')) addWhitelist(opts.whitelist, a.slice('--whitelist='.length))
    else if (a === '--limit') opts.limit = Number(argv[++i] ?? 5000) || 5000
    else if (a.startsWith('--limit=')) opts.limit = Number(a.slice(8)) || 5000
    else if (a === '--help' || a === '-h') {
      console.log(
        '用法: node scripts/fix-worktree-links.mjs [--apply] [--materialize-shared] [--json] [--skip=p1,p2] [--only=p] [--no-busy-check] [--no-protect] [--self-test]',
      )
      process.exit(EXIT_OK)
    }
  }
  if (opts.noProtect) opts.protectedPaths = []
  return opts
}

function addPathList(list, text) {
  for (const part of String(text).split(/[,;]+/)) if (part.trim()) list.push(resolve(part.trim()))
}

function addWhitelist(set, text) {
  for (const part of String(text).split(/[,;\s]+/)) {
    const v = part.trim()
    if (!v) continue
    set.add(v.startsWith('@') ? v : `@ihui/${v}`)
  }
}

function runSelfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`self-test 失败:${msg}`)
  }
  const base = join(tmpdir(), `ihui-wt-fix-selftest-${process.pid}-${Date.now()}`)
  try {
    const mainRoot = join(base, 'main')
    const wtRoot = join(base, 'wt')
    for (const dir of [join(mainRoot, 'packages', 'app'), join(wtRoot, 'packages', 'app'), join(wtRoot, 'packages', 'shared')]) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(join(mainRoot, 'packages', 'app', 'package.json'), JSON.stringify({ name: '@ihui/rn-app' }))
    writeFileSync(join(wtRoot, 'packages', 'app', 'package.json'), JSON.stringify({ name: '@ihui/rn-app' }))
    writeFileSync(join(wtRoot, 'packages', 'shared', 'package.json'), JSON.stringify({ name: '@ihui/shared' }))
    const scope = join(wtRoot, 'apps', 'web', 'node_modules', '@ihui')
    mkdirSync(scope, { recursive: true })
    const link = join(scope, 'rn-app')
    symlinkSync(join(mainRoot, 'packages', 'app'), link, 'junction')
    const whitelistLink = join(scope, 'eslint-config')
    symlinkSync(join(mainRoot, 'packages', 'app'), whitelistLink, 'junction')
    const missingLink = join(scope, 'i18n')
    symlinkSync(join(mainRoot, 'packages', 'app'), missingLink, 'junction')

    const plan = planWorktree(wtRoot, { whitelist: new Set(DEFAULT_WHITELIST), knownRoots: [mainRoot, wtRoot] })
    assert(plan.changes.length === 1, `应只计划 1 条(rn-app),实际 ${plan.changes.length}`)
    assert(plan.changes[0].package === '@ihui/rn-app', '计划的应是 rn-app')
    assert(
      plan.changes[0].relativeTarget === '../../../../packages/app',
      `相对目标应为 ../../../../packages/app,实际 ${plan.changes[0].relativeTarget}`,
    )
    assert(plan.whitelisted === 1, 'eslint-config 应命中白名单')
    assert(
      plan.unfixable.some((u) => u.package === '@ihui/i18n' && u.reason === 'local-package-missing'),
      '本地缺包必须记 unfixable',
    )

    // 阴性对照:未执行修复时链接仍指向主树
    assert(!isInside(wtRoot, realpathSync(link)), '修复前链接不应指向本 worktree')

    // 占用判定:注入 busy 后必须跳过(此断言必须在真正修复前跑,否则该树已无待改链接)
    const busyReport = runFixPlan({
      repoRoot: wtRoot,
      whitelist: new Set(DEFAULT_WHITELIST),
      protectedPaths: [],
      skip: [],
      only: [],
      busy: new Map([[normalizePath(wtRoot), [{ pid: 1, name: 'node.exe', cwd: wtRoot }]]]),
      entries: [{ path: wtRoot }],
    })
    assert(busyReport.worktrees.some((w) => w.status === 'busy'), '注入 busy 的 worktree 必须标 busy')

    const res = replaceLink(plan.changes[0])
    assert(res.ok, `replaceLink 应成功:${res.error ?? ''}`)
    assert(isInside(wtRoot, realpathSync(link)), '修复后链接必须落在本 worktree 内')
    const rel = readlinkSync(link)
    assert(!rel.startsWith('\\\\') && !/^[a-z]:/i.test(rel), `改后应写相对路径,实际 ${rel}`)

    // 阴性对照:白名单包不得被改
    assert(!isInside(wtRoot, realpathSync(whitelistLink)), '白名单链接不应被重指')

    // 受保护 worktree 不计划改动
    const report = runFixPlan({
      repoRoot: wtRoot,
      whitelist: new Set(DEFAULT_WHITELIST),
      protectedPaths: [wtRoot],
      skip: [],
      only: [],
      busy: new Map(),
      entries: [{ path: wtRoot }],
    })
    assert(report.worktrees.every((w) => w.status === 'protected'), '受保护 worktree 必须全部标 protected')

    // 安全闸阴性对照:node_modules 整目录是外部 junction 时,内侧链接不属于本树,
    // 必须判 shared-node-modules 且 changes=0(否则会把别的树的链接改坏)
    const sharedRoot = join(base, 'shared-wt')
    mkdirSync(join(mainRoot, 'node_modules', '@ihui'), { recursive: true })
    symlinkSync(join(mainRoot, 'packages', 'app'), join(mainRoot, 'node_modules', '@ihui', 'rn-app'), 'junction')
    mkdirSync(sharedRoot, { recursive: true })
    symlinkSync(join(mainRoot, 'node_modules'), join(sharedRoot, 'node_modules'), 'junction')
    const sharedPlan = planWorktree(sharedRoot, { whitelist: new Set(), knownRoots: [mainRoot, sharedRoot] })
    assert(sharedPlan.changes.length === 0, '共享 node_modules 的树不得计划任何改动')
    assert(
      sharedPlan.unfixable.some((u) => u.reason === 'shared-node-modules'),
      '共享 node_modules 必须记 shared-node-modules',
    )
    assert(sharedPlan.externalNodeModules.length > 0, '必须识别外部 node_modules junction')

    // 共享 node_modules 的安全重建:依赖项沿用 junction,@ihui 转本地,不重装
    mkdirSync(join(sharedRoot, 'packages', 'app'), { recursive: true })
    writeFileSync(join(sharedRoot, 'packages', 'app', 'package.json'), JSON.stringify({ name: '@ihui/rn-app' }))
    const matPlan = buildMaterializationPlan(sharedRoot, { knownRoots: [mainRoot, sharedRoot] })
    assert(matPlan && matPlan.items.length === 1, '应计划重建 1 个 node_modules')
    assert(matPlan.items[0].localLinks === 1 && matPlan.items[0].fallbackLinks === 0, '全部 @ihui 都应转本地')
    const rebuild = rebuildOneSharedNodeModules(matPlan.items[0])
    assert(rebuild.ok, `重建应成功:${rebuild.error ?? ''}`)
    assert(
      isInside(sharedRoot, realpathSync(join(sharedRoot, 'node_modules', '@ihui', 'rn-app'))),
      '重建后 @ihui/rn-app 必须解析到本树',
    )
    const afterScan = scanWorktree(sharedRoot, { whitelist: new Set(), knownRoots: [mainRoot, sharedRoot] })
    assert(afterScan.violations.length === 0, `重建后不应再有违规,实际 ${afterScan.violations.length}`)
  } finally {
    try {
      rmSync(base, { recursive: true, force: true })
    } catch {
      /* 清理失败不影响自测结论 */
    }
  }
  console.log('self-test 通过: 17 项断言(含修复前后、白名单、共享 node_modules 安全闸与重建对照)')
}

function main() {
  const opts = buildArgs(process.argv.slice(2))
  if (opts.selfTest) {
    runSelfTest()
    process.exit(EXIT_OK)
  }
  let busy = new Map()
  let busyOk = true
  let busyError = ''
  if (opts.noBusyCheck) {
    busyOk = false
    busyError = '--no-busy-check 显式关闭'
  } else {
    let entries
    try {
      entries = listScanRoots(ROOT)
    } catch (e) {
      console.error(`未判定:无法枚举 worktree:${e.message}`)
      process.exit(EXIT_UNKNOWN)
    }
    const probe = detectBusyWorktrees(entries.map((e) => e.path))
    busyOk = probe.ok
    busyError = probe.error ?? ''
    busy = probe.busy
    if (!busyOk && opts.apply) {
      console.error(`未判定:占用状态取不到(${busyError});--apply 拒绝执行(可用 --no-busy-check 显式承担风险)`)
      process.exit(EXIT_UNKNOWN)
    }
    if (!busyOk) console.error(`警告:占用状态未判定(${busyError});dry-run 按未占用展示,--apply 会拒绝执行`)
  }

  let report
  try {
    report = runFixPlan({
      repoRoot: ROOT,
      whitelist: opts.whitelist,
      protectedPaths: opts.protectedPaths,
      skip: opts.skip,
      only: opts.only,
      busy,
      materializeShared: opts.materializeShared,
    })
  } catch (e) {
    console.error(`未判定:扫描/计划失败:${e.message}`)
    process.exit(EXIT_UNKNOWN)
  }
  report.totals = countTotals(report.worktrees)

  if (!opts.apply) {
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({ mode: 'dry-run', busyOk, busyError, totals: report.totals, worktrees: report.worktrees.map(summaryOf) }, null, 2)}\n`,
      )
    } else {
      printPlan(report, { apply: false, limit: opts.limit })
    }
    process.exit(EXIT_OK)
  }

  if (opts.json) {
    const origLog = console.log
    console.log = (...a) => console.error(...a)
    let results
    try {
      results = executePlan(report)
    } finally {
      console.log = origLog
    }
    process.stdout.write(`${JSON.stringify({ mode: 'apply', busyOk, busyError, totals: report.totals, results }, null, 2)}\n`)
    process.exit(results.some((r) => r.failed.length > 0) ? EXIT_FAILED : EXIT_OK)
  }

  printPlan(report, { apply: true, limit: opts.limit })
  const results = executePlan(report)
  const applied = results.reduce((n, r) => n + r.applied.length, 0)
  const failed = results.reduce((n, r) => n + r.failed.length, 0)
  const rebuiltDirs = results.reduce((n, r) => n + (r.rebuilt?.length ?? 0), 0)
  const localLinks = results.reduce((n, r) => n + (r.rebuilt ?? []).reduce((m, x) => m + x.localLinks, 0), 0)
  console.log(`\n修复完成: 重指链接 ${applied} 条 / 重建 node_modules ${rebuiltDirs} 个目录(${localLinks} 条 @ihui 转本地)/ 失败 ${failed} 条`)
  for (const r of results) {
    if (r.failed.length) {
      console.log(`  [失败] ${r.path}`)
      for (const f of r.failed) console.log(`    - ${f.link}: ${f.error}`)
    }
    if (r.remainingViolations > 0) {
      console.log(`  [残留] ${r.path} 仍有 ${r.remainingViolations} 条违规(其中物理归属本树 ${r.remainingPhysicallyOwned ?? 0} 条)`)
    }
  }
  process.exit(failed > 0 ? EXIT_FAILED : EXIT_OK)
}

const isMain = process.argv[1] && normalizePath(process.argv[1]) === normalizePath(fileURLToPath(import.meta.url))
if (isMain) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
