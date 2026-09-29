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
 * 四条硬口径(缺一条就会得出错误结论):
 *   1. **绝不跟随重解析点**。本机盘根 `C:\tmp`/`C:\tools`/`common_attachment`/`persistent_data` 与
 *      `~\.ollama` 等都是指向 D 盘的 junction;跟进去就把 D 盘的量算成 C 盘的债(AGENTS §26 实测)。
 *   2. **量磁盘用量必须用原生口径**(`statfsSync`,与 `fsutil volume diskfree`/`Win32_LogicalDisk` 一致),
 *      且要和遍历所得做**对账**:差值逐项列明(pagefile/休眠/卷存储保留/未授权目录/NTFS 元数据),
 *      差值解释不掉就如实报"未解释",不得让读者以为"没了"。
 *   3. **特殊文件 `fs.statSync` 会 EINVAL**(pagefile.sys 由内存管理器持有),单独走 WMI/Get-Item 口径。
 *   4. **每个分类的条目必须"有界 + 折叠余项点名"**(2026-09-29 立,G-814426)。旧版每层只
 *      `.slice(0, 20)` 并且**静默丢掉余下全部**,再叠一层 `--min-mb` 阈值静默过滤 —— 于是
 *      "第 1 层前 20 项"在读者眼里就是"第 1 层",把两个静默出口读成"已经列全了"。
 *      现由 `foldCategory()` 一份纯函数收口:上限 = `maxEntriesPerCategory`(默认 100),
 *      余下(含低于阈值的)**一律折进 MORE 档**,且必须满足
 *      **`列出 bytes + 折叠 bytes == 该类总量`**(= 票面要求的"折叠项的 bytes = 该类总量减前 N 条");
 *      折叠项按"为什么被折"分列计数(低于阈值 / 超出上限),并**报名**(列出最大的若干条,
 *      `--list-folded` 出全部)—— 只报数不报名,拿数字的人就无从判断被折掉的是什么
 *      (AGENTS 守门速查里"射程边界必须报名、不得只报数"同一条)。
 *
 * 用法:node scripts/c-disk-breakdown.mjs [--root C:] [--depth 4] [--min-mb 100]
 *       [--max-entries-per-category 100] [--top N(同义旧开关)] [--folded-preview 5] [--list-folded] [--json]
 * 退出码:0 正常;2 脚本自身异常(扫描根不可读等)。判据"扫到 0 项"必须自证为未判定而非通过。
 */
import { lstatSync, readdirSync, statfsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const argv = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt
}
const ROOT = flag('root', 'C:/').replace(/\\/g, '/')
const MAX_DEPTH = Number(flag('depth', 4))
const MIN_MB = Number(flag('min-mb', 100))
/**
 * 每个分类(每一层)最多列几条 —— 名字与上限都取自上游证据
 * (`usageAggregate.ts:89-105`:每类前 100 条,余量折进 MORE 档),`--top` 保留为同义旧开关。
 * 旧默认是 20 且**没有折叠档**(超出部分静默消失);这里把默认抬到 100 的同时补上 MORE,
 * 因为"有界"只有在余项被如实折叠进账时才是诚实的,否则只是把静默的口子开小了一点。
 */
const MAX_ENTRIES_PER_CATEGORY = Number(flag('max-entries-per-category', flag('top', 100)))
/** 人读面在 MORE 行下面报名几条折叠项(`--json` 恒带 `largest` 前这么多条)。 */
const FOLDED_PREVIEW = Number(flag('folded-preview', 5))
const LIST_FOLDED = process.argv.includes('--list-folded')
const AS_JSON = argv.includes('--json')

const norm = (p) => p.split(sep).join('/')
/** 根键必须去掉尾斜杠:`C:/` 与逐层 dirname 得出的 `C:` 不是同一个字符串,
 *  留着尾斜杠会让根条目永远查不到 ⇒ 对账行输出"遍历到 0 GB / 未解释 82 GB"的假结论。 */
const ROOTKEY = norm(ROOT).replace(/\/+$/, '')

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

/** 被句柄持有的特殊文件:statfs 已计入用量但遍历量不到,必须单独补上,否则对账永远差 2-3GB。
 *  盘符按入参走(硬编码 C:\ 会让 `--root D:/` 报出"特殊文件 0 MB"的假对账)。
 *  ⚠️ 路径字面量必须是 `'C:\\'`(双反斜杠) —— 实测单反斜杠形态 `Join-Path 'C:\' $n` 会让
 *  PowerShell 报「Cannot find a provider with the name 'C'」并让整段静默无量。 */
function specialFilesMB(driveLetter) {
  const ps = 'C:/Program Files/PowerShell/7/pwsh.exe'
  // 入参可能是 'C:' 或 'C' —— 归一到字母再拼,否则 PS 会收到 `C::\` 这种废路径,
  // 表现是 Test-Path 全 false ⇒ 静默返回空表 ⇒ 对账行印出"特殊文件 0 MB"的**假结论**。
  const letter = String(driveLetter || 'C').replace(/[:\\/].*$/, '')
  const script =
    `foreach($n in 'pagefile.sys','swapfile.sys','hiberfil.sys'){$p=Join-Path '${letter}:\\\\' $n;if(Test-Path -LiteralPath $p){` +
    '"{0}={1}" -f $n,(Get-Item -LiteralPath $p -Force).Length}}'
  try {
    const out = execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 40000,
      // stderr 必须吃掉:PS 的报错原文会直接泄进工具输出,读者会把它当成本工具的结论。
      stdio: ['ignore', 'pipe', 'ignore'],
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

/** 纯函数,单独放外面给镜像测试直接用(它不碰磁盘)。 */
const depthOf = (p) => (p === ROOTKEY ? 0 : relative(ROOTKEY + '/', p).split(/[\\/]/).filter(Boolean).length)

/**
 * MORE 档在报告里的固定标识(借上游 `usageAggregate.ts` 的 `STORAGE_MORE_ENTRIES_PATH` 写法:
 * 它是一个**档名形态**的东西,读者一眼能看出"这一行不是真目录,是折叠余项")。
 * 定义必须在 `foldCategory` 之前 —— 它是 const,函数在模块求值期被调用就会撞 TDZ。
 */
export const MORE_ENTRIES_SUFFIX = '⋯ MORE(折叠余项,非真实目录)'

/**
 * 一个分类(一层目录)的「有界 + 折叠余项点名」—— **纯函数,不碰磁盘**,镜像测试直接喂夹具。
 * 唯一实现:报告层与 `--json` 层都读这一份结果,不得两处各算一遍(两处算同一件事必漂移)。
 *
 * 恒等式(本票的全部价值,镜像 T8 逐字钉死):
 *
 *     listedBytes + more.bytes === totalBytes        且 more.bytes === totalBytes − Σ前 N 条
 *
 * 两个**静默丢项**的出口都折进 MORE,并按"为什么被折"分列计数:
 *   - `belowThreshold`:低于 `--min-mb`(旧版直接 filter 掉,读者看不见有几个、有多大);
 *   - `beyondCap`:过了阈值但排在 `maxEntriesPerCategory` 之后(旧版 `.slice(TOP)` 直接丢)。
 * 折叠项还**报名**:`largest` 带前 `previewCount` 条(按字节降序,即被折掉的最大的几个),
 * `truncated` 说明名单本身也被截了;`--list-folded` 在人读面打全量。
 * 只报"还有 N 个"不报名,拿数字的人就无从判断那 N 个是什么 —— 与"未判定不得记为通过"
 * 是同一条禁令的两个方向。
 *
 * @param {Array<{path:string,bytes:number,files:number}>} rows 该类全部条目(可未排序)
 * @param {{cap:number,minBytes:number,previewCount?:number}} opts
 */
export function foldCategory(rows, { cap, minBytes, previewCount = 5 }) {
  const all = Array.isArray(rows) ? rows : []
  const totalBytes = all.reduce((s, r) => s + (Number(r.bytes) || 0), 0)
  const passing = all
    .filter((r) => (Number(r.bytes) || 0) >= minBytes)
    .sort((a, b) => b.bytes - a.bytes)
  const belowThreshold = all.length - passing.length
  const limit = Number.isFinite(cap) && cap >= 0 ? cap : all.length
  const entries = passing.slice(0, limit)
  const beyondCap = passing.length - entries.length
  const listedBytes = entries.reduce((s, r) => s + (Number(r.bytes) || 0), 0)
  const foldedCount = all.length - entries.length
  // 折叠量**由总量减列出量得出**,不是再累加一遍余项:两个口径在实现里同时存在时,
  // 谁漂了都不会被发现(本仓"两处算同一件事必漂移"记过太多次)。
  const foldedBytes = totalBytes - listedBytes
  if (foldedCount <= 0) {
    return { entries, more: null, totalBytes, listedBytes, foldedBytes: 0, closureOk: true }
  }
  const foldedRows = passing
    .slice(limit)
    .concat(all.filter((r) => (Number(r.bytes) || 0) < minBytes))
    .sort((a, b) => b.bytes - a.bytes)
  return {
    entries,
    more: {
      path: MORE_ENTRIES_SUFFIX,
      count: foldedCount,
      belowThreshold,
      beyondCap,
      bytes: foldedBytes,
      largest: foldedRows.slice(0, previewCount).map((r) => ({ path: r.path, bytes: r.bytes })),
      truncated: foldedRows.length > previewCount,
      // 全量名单(不默认打印,供 --json / --list-folded 取用):折叠 ≠ 丢弃
      items: foldedRows,
    },
    totalBytes,
    listedBytes,
    foldedBytes,
    closureOk: listedBytes + foldedBytes === totalBytes,
  }
}

// §22d 双形态入口守卫:下面整段是**全盘遍历** + 一趟带 40s 超时的 PowerShell 派生 + 打印。
// 没这道守卫时,测试只要 import 本模块就得把整盘走一遍才算加载完。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
const { roll, denied, links } = rollUp(ROOT)
const vol = volumeBytes(drive + '/')
const usedByVolume = vol.total - vol.avail
const walked = (roll.get(ROOTKEY) || { bytes: 0 }).bytes
const special = specialFilesMB(drive)
const specialBytes = Object.values(special.map).reduce((s, n) => s + n, 0)
const unexplained = usedByVolume - walked - specialBytes

const byDepth = {}
for (const [p, v] of roll.entries()) {
  const d = depthOf(p)
  if (d < 1 || d > MAX_DEPTH) continue
  ;(byDepth[d] ||= []).push({ path: p, bytes: v.bytes, files: v.files })
}

// 每个分类都过**同一份** foldCategory —— 人读面与 --json 面读同一份结果,不得两处各算一遍
// (两处算同一件事必漂移,本仓记过最多次的那一型)。
const foldedByDepth = Object.fromEntries(
  Object.entries(byDepth).map(([d, rows]) => [
    `depth${d}`,
    foldCategory(rows, { cap: MAX_ENTRIES_PER_CATEGORY, minBytes: MIN_MB * MB, previewCount: FOLDED_PREVIEW }),
  ]),
)
// 折叠对账逐类必须闭合(列出 + 折叠 == 该类总量)。不闭合只可能是判据自己漂了 ——
// 那种情况下最危险的处置是继续出报告:读者会拿一张不闭合的表去做删除决策。
const closureBreaks = Object.entries(foldedByDepth)
  .filter(([, f]) => !f.closureOk)
  .map(([k, f]) => ({ level: k, listedMb: Math.round(f.listedBytes / MB), foldedMb: Math.round(f.foldedBytes / MB), totalMb: Math.round(f.totalBytes / MB) }))

const out = {
  root: ROOT,
  limits: {
    maxEntriesPerCategory: MAX_ENTRIES_PER_CATEGORY,
    minMb: MIN_MB,
    foldedPreview: FOLDED_PREVIEW,
    listFolded: LIST_FOLDED,
  },
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
    Object.entries(foldedByDepth).map(([k, f]) => [
      k,
      {
        // 三个数写在一起,读者不需要自己加(旧版只给"前 20 条",加出来的是假总量)。
        // ⚠️ **mb 是各自独立四舍五入的展示档**,不能拿来核恒等式;闭合判据一律看 `*Bytes`
        //    那三个字节数(closureOk 也是按字节算的)—— 否则会出现"8+0≠9"这种纯舍入假不闭合。
        totalMb: Math.round(f.totalBytes / MB),
        listedMb: Math.round(f.listedBytes / MB),
        foldedMb: f.more ? Math.round(f.more.bytes / MB) : 0,
        totalBytes: f.totalBytes,
        listedBytes: f.listedBytes,
        foldedBytes: f.foldedBytes,
        closureOk: f.closureOk,
        entries: f.entries.map((e) => ({ path: e.path, mb: Math.round(e.bytes / MB), bytes: e.bytes, files: e.files })),
        more: f.more
          ? {
              path: f.more.path,
              count: f.more.count,
              belowThreshold: f.more.belowThreshold,
              beyondCap: f.more.beyondCap,
              mb: Math.round(f.more.bytes / MB),
              bytes: f.more.bytes,
              largest: f.more.largest.map((i) => ({ path: i.path, mb: Math.round(i.bytes / MB), bytes: i.bytes })),
              truncated: f.more.truncated,
              // 全量名单默认不进产物(一层可有上千项,全塞进去会把报告本身变成噪音),
              // 但它**不是被丢掉**:带 `--list-folded` 就来。这一维必须自己报名。
              itemsIncluded: LIST_FOLDED,
              ...(LIST_FOLDED ? { items: f.more.items.map((i) => ({ path: i.path, mb: Math.round(i.bytes / MB), bytes: i.bytes })) } : {}),
            }
          : null,
      },
    ]),
  ),
  closureBreaks,
}

if (AS_JSON) {
  console.info(JSON.stringify(out, null, 2))
} else {
  console.info(`扫描根 ${ROOT} —— 卷口径(与 Explorer/fsutil 同源,不用 df)`)
  console.info(
    `  总 ${out.volume.totalGB} GB | 已用 ${out.volume.usedGB} GB (${((usedByVolume / vol.total) * 100).toFixed(0)}%) | 可用 ${out.volume.freeGB} GB`,
  )
  console.info(`\n账要对平:遍历所得 + 特殊文件 + 未解释 = 已用`)
  const spCount = Object.keys(out.accounting.specialFilesMB).length
  console.info(
    `  遍历到 ${out.accounting.walkedGB} GB  +  pagefile 类 ${Object.values(out.accounting.specialFilesMB).reduce((s, n) => s + n, 0)} MB(量到 ${spCount} 个)  +  ` +
      `未解释 ${out.accounting.unexplainedGB} GB`,
  )
  if (spCount === 0)
    console.info('  ⚠️ 特殊文件一个都没量到:若该盘确有 pagefile.sys,则上面"未解释"里含它,别当成可删垃圾')
  console.info(
    `  读不到/不可 stat 的条目 ${denied} 个 | **刻意未跟随的重解析点 ${links} 个**(跟随会把 D 盘目标算成 C 的债)`,
  )
  if (special.error) console.info(`  ⚠️ 特殊文件未量到(${special.error.slice(0, 60)})⇒ 未解释项会偏大,不是垃圾`)
  if (out.accounting.unexplainedGB > 2)
    console.info(`  ⚠️ 未解释 >2GB:可能含卷存储保留/NTFS 元数据/授权受限目录,须人工定性,不得当作"还可以删这么多"`)
  if (out.accounting.unexplainedGB < -1)
    console.info(
      '  ⚠️ 未解释为**负**数:遍历有重复计数(硬链接如 pnpm store、或某 junction 目标被两侧各算一次)' +
        ' ⇒ 含硬链接的盘上"遍历所得"只是上界,不得据此推算可回收量',
    )
  if (closureBreaks.length > 0)
    console.info(
      `  ⚠️⚠️ 折叠对账**不闭合**(${closureBreaks.length} 层:列出 + 折叠 ≠ 该类总量)⇒ 是这把尺子自己漂了,` +
        `下面的数字不得用于删除决策:${JSON.stringify(closureBreaks)}`,
    )
  for (let d = 1; d <= MAX_DEPTH; d++) {
    const f = foldedByDepth[`depth${d}`]
    if (!f || (f.entries.length === 0 && !f.more)) continue
    console.info(
      `\n===== 第 ${d} 层(每类上限 ${MAX_ENTRIES_PER_CATEGORY} 条,展示阈值 ≥${MIN_MB}MB;该类总量 ${Math.round(f.totalBytes / MB)} MB) =====`,
    )
    for (const r of f.entries) console.info(`  ${String(Math.round(r.bytes / MB)).padStart(9)} MB  files=${String(r.files).padStart(7)}  ${r.path}`)
    if (f.more) {
      console.info(
        `  ${MORE_ENTRIES_SUFFIX}:${f.more.count} 项 ${Math.round(f.more.bytes / MB)} MB` +
          ` ⇒ 闭合核对:${Math.round(f.listedBytes / MB)} MB(列出)+ ${Math.round(f.more.bytes / MB)} MB(折叠)= ${Math.round(f.totalBytes / MB)} MB` +
          ` —— 按**字节**闭合 = ${f.closureOk}(上面三个 MB 是各自四舍五入的展示档,相加可能差 1,不得拿它们判账)` +
          `${f.closureOk ? '' : ' ❌不闭合'}`,
      )
      console.info(
        `     被折掉的两类来源分列:低于展示阈值 ${f.more.belowThreshold} 项 / 超出每类上限 ${f.more.beyondCap} 项` +
          `(⇒ "看不全"与"不够大"是两件事,处置动作也不同)`,
      )
      const listed = LIST_FOLDED ? f.more.items : f.more.largest
      const head = LIST_FOLDED
        ? `     --list-folded:全量 ${f.more.count} 项报名如下`
        : `     被折掉的最大的 ${f.more.largest.length} 项报名(${f.more.truncated ? '名单已截断,加 --list-folded 出全部' : '即全部'})`
      console.info(head)
      for (const it of listed) console.info(`       ${String(Math.round((it.bytes ?? 0) / MB || 0)).padStart(9)} MB  ${it.path}`)
    }
  }
  console.info(`\n(本工具只读:未删除、未移动任何文件。清理入口是 scripts/c-drive-auto-maintain.ps1。`)
}
}

export const __test__ = {
  rollUp,
  volumeBytes,
  depthOf,
  specialFilesMB,
  norm,
  ROOTKEY,
  // G-814426:折叠判据是纯函数,镜像测试直接喂夹具(§22c:不得在测试里抄第二份折叠算法)。
  foldCategory,
  MORE_ENTRIES_SUFFIX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
