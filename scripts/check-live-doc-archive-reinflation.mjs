#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活文档归档回灌对账(守门 216,AGENTS.md §1「两步归档」第②步的机器锁)
 *
 * ── 立因(为什么非要有这一道)──────────────────────────────────────────
 * §1 定的归档规矩是两步:①把整区正文**逐字**移进 `.ihui-agent/archive/AGENTS*`;②原位置只留
 * 一行指针注记。第①步有体积门 207 量着,第②步**没有任何尺子** —— 于是"把刚搬走的正文再抄回
 * 活文档"这一型(回灌)只会让 AGENTS.md 重新长回去,而 207 把它读成"又一次超预算"。
 * 2026-10-14 那次压缩把 1,261,607 字节的原文整区搬进归档件,AGENTS.md 里同时留下 3 份**逐字相同**
 * 的"重复登记副本"长注记(摘除时逐字进 `.ihui-agent/archive/AGENTS_dedup-removed-2026-10-15.md`),
 * 说明回灌不是假想:同一段归档正文会在并发会话里被重新抄活。
 * 本门补的就是这一格:**连续 N 行"有信息量"且逐字命中归档面行集 ⇒ 判回灌**。
 *
 * ── 判什么(三条口径都写死,不给"看起来像"留余地)──────────────────────────
 * 被审面(谁的正文被判)= 根 `AGENTS.md` + 根 `README.md`。这两份是逐字注入每轮对话的活文档,
 *   回灌的实际代价就落在这里。
 * 对照面(从哪儿算"已归档")= `.ihui-agent/archive/AGENTS*` 全部跟踪件。只认 AGENTS 族,
 *   不拿 `PROJECT_PLAN_*` 顶账 —— 台账归档件与活文档归档件是两本账,混了就等于用一本的
 *   正文给另一本发通行证。
 * 命中判据 = 从被审面取**连续行段**,段内每一行都同时满足:
 *   ① 有信息量(剥空白后 ≥ MIN_SUBSTANTIVE_CHARS 字符,且含字母/数字);
 *   ② 逐字等值于对照面某一行的归一形态(trimEnd + 去 CRLF,刻意**不**做大小写/空白模糊 ——
 *      归一化一放宽就把"引用归档件的那一行"和"整段抄回正文"混成一桶);
 *   ③ 不是水印行(`IHUI-AI-PROVENANCE` 横幅与纯零宽隐写行在两处逐字相同,是天然假阳源);
 *   ④ 不是归档指针注记(`<!-- 已归档(…完整内容在 … -->` 是 §1 第②步**要求的**形态,
 *      把它判成回灌等于锁死正当出路 —— 反证档,自检专门钉它)。
 * 段长门槛 = `RUN_MIN = 12`(两侧都钉在自检里:11 行必须放过,12 行必须判红)。
 *
 * ── 三面取材(§0.4 同面同轮)────────────────────────────────────────────
 * 缺省 = HEAD blob;`--staged` = 索引 blob;`--worktree` = 仅人工逃生舱。
 * 清单与内容同面同轮:对照面枚举也走同一个面(索引档就用 `git ls-files`,绝不回落到磁盘 readdir)。
 * 两面旗同给 ⇒ exit 2。取不到任何一份被审文档、或对照面**枚举到 0 个文件** ⇒ exit 2 判死,
 * 不记绿也不冒红(§0.3;拿不到归档面就说"没回灌"是最高频的假绿那一型)。
 *
 * ── 定级与注册(本文件**尚未**接入提交链)────────────────────────────────
 * §12e 的硬前置没满足:2026-10-16 机主令「存档机制退役」后,`.ihui-agent/archive/` 已不再承接归档件,
 * 现读 HEAD 面该目录下 `AGENTS*` 形态 = 0 个文件 ⇒ 本门按 §0.3 落 **exit 2 未判定**(既不冒绿也不冒红)。
 * 因此**禁止**把它注册成 blocking —— 对照面为空的机上它会拦下每一条提交(恒红门那一型)。
 * 接线条件写死在这里,两条都到才算:①对照面重新枚举到 ≥1 份 `AGENTS*` 归档件;②`scripts/guardian-runner.mjs`
 * 净面后由该文件持有人加条目,并**同批**把本头注改成与注册条目现值一致(mode/skipEnv 一律以 runner 现读为准)。
 * 在此之前本门只供人工与 CI 只读跑:node scripts/check-live-doc-archive-reinflation.mjs [--staged|--worktree|--self-test|--json]
 *
 * 用法:node scripts/check-live-doc-archive-reinflation.mjs [--staged|--worktree|--self-test|--json]
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { gitRaw, gitErrText, Undetermined } from './lib/face-reader.mjs'

export const RUN_MIN = 12
export const MIN_SUBSTANTIVE_CHARS = 24
export const DOC_PATHS = ['AGENTS.md', 'README.md']
export const ARCHIVE_DIR = '.ihui-agent/archive'
export const ARCHIVE_FILE_RE = /^AGENTS(?:_[^/]*)?\.md$/

const WATERMARK_MARK = 'IHUI-AI-PROVENANCE'

export function normalizeLine(l) {
  return l.replace(/\r$/, '').trimEnd()
}

/** 这一行够不够"有信息量"—— 空白/分隔/表格骨架/水印/指针注记一律不算 */
export function substantive(l) {
  const t = normalizeLine(l).trim()
  if (t.length < MIN_SUBSTANTIVE_CHARS) return false
  if (t.includes(WATERMARK_MARK)) return false
  if (/^[!--\s]*$/.test(t)) return false
  const PTR_RE = /^<!--[\s\S]*-->$/
  if (PTR_RE.test(t)) return false
  return /[A-Za-z\u4e00-\u9fff0-9]/.test(t)
}

/**
 * 核心判据(纯函数,自检与镜像测试都直接调它,§22c)。
 * 返回每个被审文档里最长的回灌段;段长 >= RUN_MIN 才算违规。
 */
export function findReinflation(docName, docText, archiveSet) {
  const lines = docText.split('\n')
  const runs = []
  let start = -1
  let len = 0
  const flush = () => {
    if (start >= 0 && len >= RUN_MIN) {
      runs.push({ doc: docName, startLine: start + 1, length: len, sample: normalizeLine(lines[start]).slice(0, 120) })
    }
    start = -1
    len = 0
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const hit = substantive(l) && archiveSet.has(normalizeLine(l))
    if (hit) {
      if (start < 0) start = i
      len++
    } else {
      flush()
    }
  }
  flush()
  return runs
}

function headBlob(root, p) {
  return gitRaw(['show', `HEAD:${p}`], root)
}

function stagedBlob(root, p) {
  return gitRaw(['show', `:${p}`], root)
}

/** 对照面清单:按同一个面枚举,绝不 readdirSync 磁盘 */
export function listArchiveFace(root, face) {
  if (face === 'head') {
    const out = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', ARCHIVE_DIR], root)
    return out.split('\n').map((s) => s.trim()).filter((s) => s && ARCHIVE_FILE_RE.test(s.split('/').pop()))
  }
  if (face === 'staged') {
    const out = gitRaw(['ls-files', '--', ARCHIVE_DIR], root)
    return out.split('\n').map((s) => s.trim()).filter((s) => s && ARCHIVE_FILE_RE.test(s.split('/').pop()))
  }
  const out = gitRaw(['ls-files', '--', ARCHIVE_DIR], root)
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && ARCHIVE_FILE_RE.test(s.split('/').pop()))
    .filter((s) => {
      try {
        readFileSync(s, 'utf8')
        return true
      } catch {
        return false
      }
    })
}

export function buildArchiveSet(root, face, files) {
  const set = new Set()
  const read = face === 'staged' ? (p) => stagedBlob(root, p) : face === 'worktree' ? (p) => readFileSync(p, 'utf8') : (p) => headBlob(root, p)
  for (const p of files) {
    let txt
    try {
      txt = read(p)
    } catch {
      continue
    }
    for (const l of String(txt).split('\n')) if (substantive(l)) set.add(normalizeLine(l))
  }
  return set
}

export function audit(root, face) {
  const files = listArchiveFace(root, face)
  if (files.length === 0) return { state: 'undetermined', why: `对照面(${ARCHIVE_DIR}/AGENTS*)在该面枚举到 0 个文件 ⇒ 不判(§0.3)` }
  const archiveSet = buildArchiveSet(root, face, files)
  if (archiveSet.size === 0) return { state: 'undetermined', why: '对照面一行"有信息量"正文都取不到 ⇒ 不判' }
  const read = face === 'staged' ? (p) => stagedBlob(root, p) : face === 'worktree' ? (p) => readFileSync(p, 'utf8') : (p) => headBlob(root, p)
  const runs = []
  const missing = []
  let scanned = 0
  for (const p of DOC_PATHS) {
    let txt
    try {
      txt = String(read(p))
    } catch {
      missing.push(p)
      continue
    }
    scanned++
    runs.push(...findReinflation(p, txt, archiveSet))
  }
  if (scanned === 0) return { state: 'undetermined', why: `被审文档全部取不到(${missing.join(', ')})⇒ 不判` }
  return { state: runs.length ? 'violation' : 'pass', runs, archiveFiles: files.length, archiveLines: archiveSet.size, scanned, missing }
}

function selfTest() {
  const cases = []
  const t = (name, ok, detail) => cases.push({ name, ok, detail })
  const body = (n, tag) => Array.from({ length: n }, (_, i) => `第 ${tag} 段第 ${i + 1} 行 —— 这一段是搬进归档件后又抄回活文档的正文,长度足够有信息量`).join('\n')
  const archiveLines = Array.from({ length: 40 }, (_, i) => `第 A 段第 ${i + 1} 行 —— 这一段是搬进归档件后又抄回活文档的正文,长度足够有信息量`)
  const set = new Set(archiveLines.map((l) => normalizeLine(l)))
  t('① 11 行同文 ⇒ 放过(门槛之下)', findReinflation('AGENTS.md', body(11, 'A'), set).length === 0, '边界下沿必须绿')
  t('② 12 行同文 ⇒ 判回灌', findReinflation('AGENTS.md', body(12, 'A'), set).length === 1, '边界上沿必须红,否则门槛形同虚设')
  t('③ 段中间断一行 ⇒ 不连续即不判', findReinflation('AGENTS.md', body(8, 'A') + '\n这一行是活文档自己的新内容,归档面里没有它\n' + body(8, 'A'), set).length === 0, '回灌的形态是整段搬回,夹一行新正文就不是')
  t('④ 命中长度写进结论', (() => { const r = findReinflation('AGENTS.md', body(13, 'A'), set); return r.length === 1 && r[0].length === 13 && r[0].startLine === 1 })(), 'startLine/length 是问责依据,必须报得出')
  const wm = `// [${WATERMARK_MARK}]:⁠​‌​​‌​ 零宽载荷那一行在两个文件里逐字相同,天然假阳,长度也够`
  t('⑤ 水印行反证:整段水印不算回灌', findReinflation('AGENTS.md', Array.from({ length: 20 }, () => wm).join('\n'), new Set([wm].map((l) => normalizeLine(l)))).length === 0, '摘掉这条反证,门会把每份带水印的文件互判成回灌')
  const ptr = '<!-- 已归档(2026-10-14:整区逐字归档于 .ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md,完整内容在归档件) -->'
  t('⑥ 指针注记反证:§1 第②步要求的形态不得判红', substantive(ptr) === false, '这是正当出路本身,判红等于锁死出路')
  t('⑦ 短行不算信息量(表格骨架/空行)', substantive('   ') === false && substantive('| --- | --- |') === false && substantive('—'.repeat(30)) === false, '纯装饰行不参与段长')
  t('⑧ CRLF 与行尾空格归一后仍逐字命中', findReinflation('AGENTS.md', archiveLines.map((l) => l + '  \r').join('\n'), set).length === 1, '归一只剥换行与行尾空白,不做模糊')
  t('⑨ 一行之差(键名被改)不再命中 ⇒ 刻意不放宽', findReinflation('AGENTS.md', archiveLines.map((l) => l.replace('第 ', '第')).join('\n'), set).length === 0, '归一化一旦模糊,引用与抄回就分不开')
  t('⑩ 段长常量与两侧用例一致', RUN_MIN === 12, '门槛改动必须同步改 ①② 两格,否则两侧反证失效')
  let fail = 0
  for (const c of cases) {
    if (!c.ok) fail++
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : ' —— ' + c.detail}`)
  }
  console.log(`—— 自检 ${cases.length - fail}/${cases.length}`)
  return fail === 0 ? 0 : 1
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  const root = process.cwd()
  const has = (f) => argv.includes(f)
  if (has('--staged') && has('--worktree')) {
    console.error('❌ 无法判定:--staged 与 --worktree 互斥(同面同轮的纪律,不给混面留口子)')
    return 2
  }
  const face = has('--staged') ? 'staged' : has('--worktree') ? 'worktree' : 'head'
  let r
  try {
    r = audit(root, face)
  } catch (e) {
    console.error(`❌ 无法判定(不记绿也不冒红):${e instanceof Undetermined ? e.message : gitErrText(e)}`)
    return 2
  }
  if (r.state === 'undetermined') {
    console.error(`❌ 未判定 —— ${r.why}`)
    return 2
  }
  if (has('--json')) {
    console.log(JSON.stringify({ face, ...r }))
    return r.state === 'violation' ? 1 : 0
  }
  console.log(`[live-doc-archive-reinflation] 判定面=${face} 对照面=${r.archiveFiles} 份归档件 / ${r.archiveLines} 行有信息量正文,被审 ${r.scanned} 份活文档(缺 ${r.missing.length})`)
  if (r.state === 'violation') {
    for (const run of r.runs) console.log(`  ✗ 回灌 ${run.length} 行 @ ${run.doc}:${run.startLine} —— ${run.sample}`)
    console.log(`结论:判红(连续 ≥${RUN_MIN} 行逐字命中归档面 ⇒ §1 第②步没做,正文被抄回活文档)`)
    return 1
  }
  console.log(`结论:通过(无连续 ≥${RUN_MIN} 行的同文段;水印与指针注记各按其反证不计)`)
  return 0
}

export const __test__ = { RUN_MIN, MIN_SUBSTANTIVE_CHARS, DOC_PATHS, ARCHIVE_FILE_RE, substantive, normalizeLine, findReinflation, audit, listArchiveFace, buildArchiveSet }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
