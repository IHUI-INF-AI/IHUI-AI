#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * C 盘占用分解器(只读,永不删任何东西)。
 *
 * 存在的理由:这台机器上反复出现过同一句质问「C 盘怎么被占了这么多」。而全链没有一件仪器能一次
 * 回答「84.5GB 到底在哪、还剩多少没被解释」:
 *   - `check-c-drive-pollution.mjs` 只认**本项目产物**(按名字 + 内容特征),别人的东西一律进
 *     "未识别清单",它天生不回答"空间去哪了";
 *   - `c-drive-auto-maintain.ps1` 只删,不量;
 *   - Git Bash 的 `df` 在本机给过与原生 API 相反的百分比(实测 77% vs 60%),**不能用作口径**。
 * 于是每次都得现写遍历脚本 —— 而现写的脚本会被任务收尾清掉,下次又从零开始(本工具的第一版就是这么丢的)。
 *
 * 三条硬口径(缺一条就会得出错误结论):
 *   1. **绝不跟随重解析点**。本机盘根 `C:\tmp`/`C:\tools`/`common_attachment`/`persistent_data` 与
 *      `~\.ollama` 等都是指向 D 盘的 junction;跟进去就把 D 盘的量算成 C 盘的债(AGENTS §26 实测)。
 *   2. **量磁盘用量必须用原生口径**(`statfsSync`,与 `fsutil volume diskfree`/`Win32_LogicalDisk` 一致),
 *      且要和遍历所得做**对账**:差值逐项列明(pagefile/休眠/卷存储保留/未授权目录/NTFS 元数据),
 *      差值解释不掉就如实报"未解释",不得让读者以为"没了"。
 *   3. **特殊文件 `fs.statSync` 会 EINVAL**(pagefile.sys 由内存管理器持有),单独走 WMI/Get-Item 口径。
 *
 * 用法:node scripts/c-disk-breakdown.mjs [--root C:] [--depth 4] [--min-mb 100] [--top 20] [--json]
 * 退出码:0 正常;2 脚本自身异常(扫描根不可读等)。判据"扫到 0 项"必须自证为未判定而非通过。
 */
import { lstatSync, readdirSync, statfsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const argv = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}
const ROOT = flag('root', 'C:/').replace(/\\/g, '/')
const MAX_DEPTH = Number(flag('depth', 4))
const MIN_MB = Number(flag('min-mb', 100))
const TOP = Number(flag('top', 20))
const AS_JSON = argv.includes('--json')

const norm = (p) => p.split(sep).join('/')
/** 根键必须去掉尾斜杠:`C:/` 与逐层 dirname 得出的 `C:` 不是同一个字符串,
 *  留着尾斜杠会让根条目永远查不到 ⇒ 对账行输出"遍历到 0 GB / 未解释 82 GB"的假结论。 */
const ROOTKEY = norm(ROOT).replace(/\/+$/, '')
const isLink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

/** 一次遍历,把每个文件的字节滚到它的全部祖先目录(滚到根,不按 depth 截断 —— 截断会让浅层总数偏小)。 */
function rollUp(root) {
  const roll = new Map()
  let denied = 0
  let links = 0
  const stack = [root]
  while (stack.length) {
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      denied++
      continue
    }
    for (const ent of entries) {
      const p = join(cur, ent.name)
      let st
      try {
        st = lstatSync(p)
      } catch {
        // pagefile.sys 这类被内存管理器持有的文件必然走到这里 —— 不静默丢掉,计入 unmeasured。
        denied++
        continue
      }
      if (st.isSymbolicLink()) {
        links++
        continue
      }
      if (st.isDirectory()) {
        stack.push(p)
        if (!roll.has(norm(p))) roll.set(norm(p), { bytes: 0, files: 0 })
      } else if (st.isFile()) {
        let a = norm(p)
        for (;;) {
          const parent = a.slice(0, a.lastIndexOf('/'))
          if (!parent || parent === a) break
          const e = roll.get(parent) || { bytes: 0, files: 0 }
          e.bytes += st.size
          e.files += 1
          roll.set(parent, e)
          if (parent === ROOTKEY) break
          a = parent
        }
      }
    }
  }
  return { roll, denied, links }
}

/** 原生容量口径(与 Explorer 同源)。 */
function volumeBytes(root) {
  const s = statfsSync(root)
  const b = Number(s.bsize)
  return { total: b * Number(s.blocks), avail: b * Number(s.bavail), free: b * Number(s.bfree) }
}

/** 被句柄持有的特殊文件:statfs 已计入用量但遍历量不到,必须单独补上,否则对账永远差 2-3GB。 */
function specialFilesMB(drive) {
  const ps = 'C:/Program Files/PowerShell/7/pwsh.exe'
  const script =
    "foreach($n in 'pagefile.sys','swapfile.sys','hiberfil.sys'){$p=Join-Path 'C:\\' $n;if(Test-Path -LiteralPath $p){" +
    '"{0}={1}" -f $n,(Get-Item -LiteralPath $p -Force).Length}}'
  try {
    const out = execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 40000,
    })
    const map = {}
    for (const line of String(out).split(/\r?\n/)) {
      const m = line.match(/^(\S+?)=(\d+)$/)
      if (m) map[m[1].toLowerCase()] = Number(m[2])
    }
    return { map, error: null }
  } catch (e) {
    return { map: {}, error: e.message }
  }
}

const MB = 1048576
const GB = 1073741824
const drive = ROOT.replace(/\/.*$/, '')

const { roll, denied, links } = rollUp(ROOT)
const vol = volumeBytes(drive + '/')
const usedByVolume = vol.total - vol.avail
const walked = (roll.get(ROOTKEY) || { bytes: 0 }).bytes
const special = specialFilesMB(drive)
const specialBytes = Object.values(special.map).reduce((s, n) => s + n, 0)
const unexplained = usedByVolume - walked - specialBytes

const depthOf = (p) => (p === ROOTKEY ? 0 : relative(ROOTKEY + '/', p).split(/[\\/]/).filter(Boolean).length)
const byDepth = {}
for (const [p, v] of roll.entries()) {
  const d = depthOf(p)
  if (d < 1 || d > MAX_DEPTH) continue
  ;(byDepth[d] ||= []).push([p, v])
}

const out = {
  root: ROOT,
  volume: { totalGB: +(vol.total / GB).toFixed(2), usedGB: +(usedByVolume / GB).toFixed(2), freeGB: +(vol.avail / GB).toFixed(2) },
  accounting: {
    walkedGB: +(walked / GB).toFixed(2),
    specialFilesMB: Object.fromEntries(Object.entries(special.map).map(([k, v]) => [k, Math.round(v / MB)])),
    specialError: special.error,
    unexplainedGB: +(unexplained / GB).toFixed(2),
    deniedOrUnstatable: denied,
    reparsePointsSkipped: links,
  },
  levels: Object.fromEntries(
    Object.entries(byDepth).map(([d, rows]) => [
      `depth${d}`,
      rows
        .sort((a, b) => b[1].bytes - a[1].bytes)
        .filter(([, v]) => v.bytes >= MIN_MB * MB)
        .slice(0, TOP)
        .map(([p, v]) => ({ path: p, mb: Math.round(v.bytes / MB), files: v.files })),
    ]),
  ),
}

if (AS_JSON) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log(`扫描根 ${ROOT} —— 卷口径(与 Explorer/fsutil 同源,不用 df)`)
  console.log(
    `  总 ${out.volume.totalGB} GB | 已用 ${out.volume.usedGB} GB (${((usedByVolume / vol.total) * 100).toFixed(0)}%) | 可用 ${out.volume.freeGB} GB`,
  )
  console.log(`\n账要对平:遍历所得 + 特殊文件 + 未解释 = 已用`)
  console.log(
    `  遍历到 ${out.accounting.walkedGB} GB  +  pagefile 类 ${Object.values(out.accounting.specialFilesMB).reduce((s, n) => s + n, 0)} MB  +  ` +
      `未解释 ${out.accounting.unexplainedGB} GB`,
  )
  console.log(
    `  读不到/不可 stat 的条目 ${denied} 个 | **刻意未跟随的重解析点 ${links} 个**(跟随会把 D 盘目标算成 C 的债)`,
  )
  if (special.error) console.log(`  ⚠️ 特殊文件未量到(${special.error.slice(0, 60)})⇒ 未解释项会偏大,不是垃圾`)
  if (out.accounting.unexplainedGB > 2)
    console.log(`  ⚠️ 未解释 >2GB:可能含卷存储保留/NTFS 元数据/授权受限目录,须人工定性,不得当作"还可以删这么多"`)
  for (let d = 1; d <= MAX_DEPTH; d++) {
    const rows = out.levels[`depth${d}`]
    if (!rows || !rows.length) continue
    console.log(`\n===== 第 ${d} 层(≥${MIN_MB}MB,前 ${TOP}) =====`)
    for (const r of rows) console.log(`  ${String(r.mb).padStart(9)} MB  files=${String(r.files).padStart(7)}  ${r.path}`)
  }
  console.log(`\n(本工具只读:未删除、未移动任何文件。清理入口是 scripts/c-drive-auto-maintain.ps1。`)
}

export const __test__ = { rollUp, volumeBytes, depthOf, specialFilesMB }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
