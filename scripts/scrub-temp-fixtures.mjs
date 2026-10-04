#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TEMP 里本项目测试夹具的清扫器 —— 默认**只报告不删除**。
 *
 * 为什么需要它(2026-09-25 实测):活进程 `os.tmpdir()` = `D:\caches\Temp`,该目录下
 * 本项目前缀条目 450 个 / 27,551 个文件 / 约 13 GB,最旧的 mtime 停在 2026-08-26。
 * 全链没有一个人负责收这些:
 *   - `scripts/check-c-drive-pollution.mjs` 明确"只读,不删除任何文件",且只扫 C 盘;
 *   - `scripts/c-drive-auto-maintain.ps1` 的删除面按设计钉在 C 盘(它是计划任务,扩面=改全机行为);
 *   - `scripts/clean-garbage.mjs` 完全不碰 TEMP;
 *   - `scripts/lib/scratch-dir.mjs` 只提供 mkScratch/rmScratch —— **新写的**测试有出口,
 *     历史遗留与"忘了 rm"的那批没有任何出口。
 * 即"造好没装车"的又一型:落点规约存在,回收入不存在。
 *
 * 三条不可让的护栏:
 *   1. **绝不跟随重解析点**。§26 记过真实事故:`Get-ChildItem -Recurse` / 递归删除会**穿过 junction**
 *      清空 D 盘真实目标,把改道机制变成自毁机制。所以枚举一律 `lstatSync`,遇 `isSymbolicLink()`
 *      (junction 在 Node 侧报 true)只断链或跳过,绝不递归进去。
 *   2. **名字围栏**:只有命中本项目前缀的条目才是候选,他人条目一律不判性、不删除。
 *   3. **账龄闸**:默认只碰 mtime > 7 天的;当天在跑的测试夹具不可能被误删。
 * 另加第四层:`PROTECTED_NAMES` 整目录不碰(secrets/密钥/credentials/backups 等),
 * 与 `check-parent-pollution` 同一套理由 —— 名字含 key/secret 的东西一律先补豁免再谈清理。
 *
 * 用法:
 *   node scripts/scrub-temp-fixtures.mjs                 # 只报告(默认扫多根并集,见下)
 *   node scripts/scrub-temp-fixtures.mjs --older-than 3  # 改账龄
 *   node scripts/scrub-temp-fixtures.mjs --apply         # 真删(显式要求)
 *   node scripts/scrub-temp-fixtures.mjs --root <dir>[;<dir>…] # 显式只扫这些根(测试夹具通道,生产不带)
 *   node scripts/scrub-temp-fixtures.mjs --self-test
 *
 * **为什么不止一个根**(2026-10-04,台账 G-1058525):活进程拿到的 TEMP 与注册表里刚改的 TEMP
 * 会并存很久(Windows 只在进程启动时读一次环境块),而历史残留散在三个根上。当轮现读:
 * `D:\caches\Temp` 顶层 60,805 条里本项目命名 1,616 条 = 98,081 文件 / 18.07 GB,最旧 mtime 1980-01-01;
 * `D:\tmp` 6,428 条里 362 条。只扫 `tmpdir()` 会让"另一个根有 18 GB"在账面上读成"没有残留"——
 * 所以出口只能是并集,不是放宽判据。根一律经 `devEnvRoot()` 推导盘符,不得写死(§15b/§26);
 * 推导失败**不静默少扫**,落「未判定」并让退出码为 2。
 */
import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { devEnvRoot } from './seal-c-root-stray.mjs'

const OUR_PREFIXES = ['ihui-', 'IHUI-', 'next-backup-', 'probe-']
/** 整目录不碰:名字命中即跳过(按 toLowerCase 比对,大小写不敏感) */
const PROTECTED_NAMES = ['secrets', 'secret', 'credentials', 'credential', '密钥', 'backups', 'baidusyncdisk', '.pybcrypt']
const DEFAULT_MIN_AGE_DAYS = 7

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const has = (name) => process.argv.includes(name)

const isOurs = (name) => OUR_PREFIXES.some((p) => name.startsWith(p))
const isProtected = (name) => PROTECTED_NAMES.includes(name.toLowerCase())

/**
 * 该扫哪些根 —— 只许有这一处推导。
 *
 * 三条不可让:
 *  1. **盘符不得写死**:`<盘>\caches\Temp` 与 `<盘>\tmp` 是历史落点,由 `devEnvRoot()` 推出的同盘根拼出来;
 *     `devEnvRoot()` 是 §15b 唯一外置根出口(与备份/审计/恢复演练同一份),本工具不得自派生。
 *  2. **推不出来必须喊**:devEnvRoot 会在工作树位于夹具内时抛错。安静少扫两个根 = 把"没判"写成"判过了",
 *     所以落 `undetermined` 并由 CLI 以退出码 2 拒出合格证。
 *  3. **同一路径只判一次**:活 `tmpdir()` 与派生根在改过注册表之后必然重合,去重按 `resolve()` 后
 *     小写比较(Windows 大小写不敏感),否则同一批条目被删两次、报告读成"两个根各有残留"。
 */
export function defaultRoots({
  env = process.env,
  tmp = tmpdir(),
  devEnv,
  deriveDevEnv = devEnvRoot,
  exists = existsSync,
  platform = process.platform,
} = {}) {
  const roots = []
  const undetermined = []
  const keyOf = (p) => resolve(p).toLowerCase().replace(/[\\/]+$/, '')
  const push = (p) => {
    if (!p) return
    const k = keyOf(p)
    if (!roots.some((r) => keyOf(r) === k)) roots.push(resolve(p))
  }
  push(tmp)
  let dev = devEnv
  if (dev === undefined) {
    try {
      dev = deriveDevEnv()
    } catch (e) {
      dev = null
      undetermined.push(`devEnvRoot() 推导失败:${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 120)}`)
    }
  }
  if (dev) {
    push(join(dev, 'Temp'))
    push(join(parse(resolve(dev)).root, 'caches', 'Temp'))
    push(join(parse(resolve(dev)).root, 'tmp'))
  }
  // **跨盘探测**:TEMP 曾被设在哪块盘,与工作树在哪块盘是两回事。2026-10-04 实测:工作树在 `G:\`
  // 而 1,616 条本项目命名残留(18.07 GB)躺在 `D:\caches\Temp` —— 只按工作树盘推导会安静少扫整块盘,
  // 而"少扫"在这把尺子上表现为候选 0,读起来跟"已清干净"一模一样。
  // 代价是 26 次 `existsSync`(本机实测个位数毫秒);判据(名字/账龄/保护区)一条没放宽。
  if (platform === 'win32') {
    for (let c = 65; c <= 90; c++) {
      const drive = `${String.fromCharCode(c)}:\\`
      if (!exists(drive)) continue
      for (const shape of [['caches', 'Temp'], ['tmp'], ['DevEnv', 'Temp']]) {
        const p = join(drive, ...shape)
        if (exists(p)) push(p)
      }
    }
  }
  for (const extra of String(env.IHUI_TEMP_SCRUB_ROOTS || '').split(';')) if (extra.trim()) push(extra.trim())
  return { roots, undetermined }
}

/** 递归量一个普通目录(调用方已保证它不是重解析点)。
 *  同时找"整条不许删"的硬阻断:目录里藏着别人/用户的凭据或备份子目录 ——
 *  一个测试夹具的内层出现 `密钥`/`secrets`,不是巧合,是它把真数据收在了自己肚子里。*/
function measure(dir) {
  let files = 0
  let bytes = 0
  let links = 0
  let protectedHit = null
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const f = join(d, e.name)
      let st
      try {
        st = lstatSync(f)
      } catch {
        continue
      }
      if (isProtected(e.name)) {
        protectedHit = protectedHit || f
        continue
      }
      if (st.isSymbolicLink()) {
        links++
        continue // 绝不穿透
      }
      if (st.isDirectory()) stack.push(f)
      else {
        files++
        bytes += st.size
      }
    }
  }
  return { files, bytes, links, protectedHit }
}

/**
 * 一次扫描。返回逐条判定 + 三类"不判但如实报数"的计数,绝不静默成"看起来干净"。
 */
export function scan({ root, minAgeDays = DEFAULT_MIN_AGE_DAYS, now = Date.now() }) {
  const candidates = []
  const protectedPaths = []
  const skipped = { protected: 0, fresh: 0, notOurs: 0, link: 0, unreadable: 0 }
  let names
  try {
    names = readdirSync(root, { withFileTypes: true })
  } catch (e) {
    return { root, error: `取不到目录清单: ${e?.message ?? e}`, candidates, protectedPaths, skipped, totalEntries: 0 }
  }
  for (const e of names) {
    if (!isOurs(e.name)) {
      skipped.notOurs++
      continue
    }
    const full = join(root, e.name)
    let st
    try {
      st = lstatSync(full)
    } catch {
      skipped.unreadable++
      continue
    }
    if (st.isSymbolicLink()) {
      // 链接本体可以断,但**本工具不做断链** —— 指向别处的夹具由持有者决定,只报数
      skipped.link++
      continue
    }
    if (now - st.mtimeMs < minAgeDays * 86400000) {
      skipped.fresh++
      continue
    }
    const m = st.isDirectory() ? measure(full) : { files: 1, bytes: st.size, links: 0, protectedHit: null }
    if (m.protectedHit) {
      // 整条不许删:里面收着凭据/备份目录,报出路径交人核,不做"递归时顺手跳过它"的半删
      skipped.protected++
      // 体积必须一起记:保护闸"恒拒"的那一族若只报名字不报 GB,读报告的人会以为这一格没多少东西,
      // 而实测这一族里最大的一条是 11.14 GB(见台账 G-1058525 ③)。
      protectedPaths.push({ path: m.protectedHit, name: e.name, files: m.files, bytes: m.bytes })
      continue
    }
    candidates.push({ name: e.name, path: full, dir: st.isDirectory(), mtime: new Date(st.mtimeMs).toISOString().slice(0, 10), ...m })
  }
  return { root, candidates, skipped, protectedPaths, totalEntries: names.length, error: null }
}

export function formatReport(r, { apply, minAgeDays }) {
  const lines = []
  if (r.error) return [`❌ 无法判定:${r.error}(不冒红也不记绿)  root=${r.root}`]
  const bytes = r.candidates.reduce((a, c) => a + c.bytes, 0)
  const files = r.candidates.reduce((a, c) => a + c.files, 0)
  lines.push(
    `TEMP 夹具清扫 · root=${r.root} · 账龄闸 ${minAgeDays} 天 · 条目 ${r.totalEntries} → 候选 ${r.candidates.length}` +
      `(文件 ${files} · ${(bytes / 1073741824).toFixed(2)} GB)`,
  )
  lines.push(
    `  跳过(不判但报数):非本项目 ${r.skipped.notOurs} · 账龄未到 ${r.skipped.fresh} · ` +
      `重解析点 ${r.skipped.link} · 保护区 ${r.skipped.protected} · 读不到 ${r.skipped.unreadable}`,
  )
  for (const c of r.candidates.slice(0, apply ? r.candidates.length : 25))
    lines.push(`  ${apply ? 'DEL ' : '·   '} ${c.mtime}  ${(c.bytes / 1048576).toFixed(2)}MB  ${c.dir ? '目录' : '文件'} ${c.name}`)
  for (const p of r.protectedPaths.slice(0, 10))
    lines.push(
      `  ⛔ 整条不删(夹具内收着凭据/备份目录,交人核): ${p.name} · ${p.files} 文件 · ${(p.bytes / 1073741824).toFixed(2)} GB · ${p.path}`,
    )
  if (r.protectedPaths.length > 10) lines.push(`  ⛔ … 另 ${r.protectedPaths.length - 10} 条保护区命中`)
  if (!apply && r.candidates.length > 25) lines.push(`  … 另 ${r.candidates.length - 25} 条(--apply 时逐条列全)`)
  if (!apply) lines.push('  本轮未删除任何东西;要删请加 --apply')
  return lines
}

/**
 * 删除。只接受 scan() 产出的候选 —— 判序(重解析点/保护区/账龄)全在 scan 里做一次,
 * 这里不重判也不放宽:两处各判一遍必然漂移,而本函数会毁数据。
 */
export function del(root, candidates) {
  let ok = 0
  let fail = 0
  let bytes = 0
  for (const c of candidates) {
    if (!c.path.startsWith(resolve(root))) {
      fail++
      continue
    }
    try {
      rmSync(c.path, { recursive: c.dir, force: true, maxRetries: 2 })
      ok++
      bytes += c.bytes
    } catch {
      fail++
    }
  }
  return { ok, fail, bytes }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (has('--self-test')) {
    console.log('判据装配证明在镜像测试面:node --test scripts/tests/scrub-temp-fixtures.test.mjs')
    process.exit(0)
  }
  const minAgeDays = Number(arg('--older-than') || DEFAULT_MIN_AGE_DAYS)
  if (!Number.isFinite(minAgeDays) || minAgeDays < 0) {
    console.log(`❌ --older-than 需要非负数字,得到 ${arg('--older-than')}`)
    process.exit(2)
  }
  const apply = has('--apply')
  const only = arg('--root')
  const { roots, undetermined } = only
    ? { roots: only.split(';').map((s) => s.trim()).filter(Boolean).map((s) => resolve(s)), undetermined: [] }
    : defaultRoots()
  let errs = 0
  let absent = 0
  let totalCand = 0
  let totalFiles = 0
  let totalBytes = 0
  let okAll = 0
  let failAll = 0
  for (const root of roots) {
    if (!existsSync(root)) {
      // 根不存在是一个**确定的答案**,但它不是"这一格已清扫":必须点名,否则换一个根又长回来无人知
      absent++
      console.log(`TEMP 夹具清扫 · root=${root} —— 该根不存在,本根跳过(不记残留,也不记为已清扫)`)
      continue
    }
    const r = scan({ root, minAgeDays })
    for (const l of formatReport(r, { apply, minAgeDays })) console.log(l)
    if (r.error) {
      errs++
      continue
    }
    totalCand += r.candidates.length
    totalFiles += r.candidates.reduce((a, c) => a + c.files, 0)
    totalBytes += r.candidates.reduce((a, c) => a + c.bytes, 0)
    if (apply && r.candidates.length) {
      const d = del(resolve(root), r.candidates)
      okAll += d.ok
      failAll += d.fail
      console.log(`  本根已删 ${d.ok} 条 / 失败 ${d.fail} 条 / 释放 ${(d.bytes / 1073741824).toFixed(2)} GB  root=${root}`)
    }
  }
  const judgable = roots.length - absent - errs
  console.log(
    `汇总 · 根 ${roots.length}(可判 ${judgable} / 不存在 ${absent} / 取不到 ${errs}) · 候选 ${totalCand}` +
      ` · 文件 ${totalFiles} · ${(totalBytes / 1073741824).toFixed(2)} GB · 已删 ${okAll} 条 / 失败 ${failAll} 条`,
  )
  for (const u of undetermined) console.log(`  ⚠️ 未判定:${u} —— 派生根没推出来,少扫的根不等于没有残留`)
  if (errs || undetermined.length) process.exit(2)
  if (apply && failAll) process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
