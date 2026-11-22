#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「带值旗标吞值」族的**只读对账尺子**(G-322 收口过程的度量器,不是提交链门)。
 *
 * 为什么要有它(2026-10-17 实测成因):G-322 的修复要一批批选点,每批都得"对现 HEAD 面重扫一遍",
 * 而这两把尺当时是会话临时脚本(用完就走)。下一席若再自己发明一次,计数口径就会漂(本仓 §22c:
 * 同类判据两份实现必漂移),甚至把上一批已收的站点当"未收"重做。⇒ 把尺子入库,读数只有一个出处。
 *
 * 判的是什么:`scripts/**.mjs` 里"把旗标紧邻的下一个 token 当成该旗标的值"的裸取值形状,两形:
 *   ① 同形     `argv[argv.indexOf('--root') + 1]`
 *   ② 存形     `const i = argv.indexOf('--root')` 之后 `argv[i + 1]`(这一形数量是①的约 9 倍,
 *              只查①会漏掉绝大多数 —— 2026-10-17 实测:113 处候选里①只有 11 处)
 * 判定前一律过 `code-mask`(注释与字符串都遮 —— 本门判的是**代码结构**,不是字面量)。
 *
 * 定级与射程(为什么现在不接提交链):
 *   - 默认档**只报数**(rc=0),`--strict` 才在"还剩裸站点"时 rc=1。现读存量非 0 ⇒ 接进提交链判红
 *     就是 §12e 禁的恒红门;**升 blocking 的前置 = 存量归零 + `guardian-runner` 净面**(本器不自行注册)。
 *   - 命中 ≠ 缺陷:尺子点出的是"这一处需要人读一次失效方向"。已实测为"已经大声"的站点(漏值即 exit 2 /
 *     解析失败即 return 2 的那些)留在计数里由 `--json` 逐条报名,由读的人判,不在这里做语义判定 ——
 *     语义判定要跑那扇门的 CLI,不在一把静态尺里假装做得到。
 *   - 单源纪律:取值形状的"是不是合法值"判据不在此重写,归 `scripts/lib/flag-value.mjs`。
 *
 * 取材面纪律(守门 118):全量档判 **HEAD blob**,`--staged` 判**索引 blob**,`--worktree` 仅人工逃生舱;
 * 两面旗同给 ⇒ exit 2;取不到被审面 ⇒ exit 2「未判定」,不记绿也不冒红(§0.3)。
 * 用法:node scripts/check-flag-value-discipline.mjs [--staged|--worktree] [--strict] [--json] [--top N]
 *       自检:node scripts/check-flag-value-discipline.mjs --self-test
 *       镜像:node --test scripts/tests/check-flag-value-discipline.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const ENUM_PREFIX = 'scripts/'
const SELF_NAME = 'check-flag-value-discipline.mjs'

/** ①同形:旗标与 `+ 1` 下标在同一个方括号表达式里 */
const RAW_INLINE_RE = /\b(?:argv|ARGS|args)\s*\[[^\]\n]{0,60}indexOf\s*\([^)]*\)\s*\+\s*1\s*\]/g
/** ②存形:`<arr>[<变量> + 1]`,且该变量在同文件里由 `<arr>.indexOf(...)` 赋值 */
const RAW_INDEXED_RE = /\b(?:argv|ARGS|args)\s*\[\s*([A-Za-z_$][\w$]*)\s*\+\s*1\s*\]/g
const IDX_ASSIGN_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:argv|ARGS|args)\s*\.\s*indexOf\s*\(/g

/** 找出一个文件里所有裸取值站点(输入必须是**已遮罩**的源码)。 */
export function findRawSites(masked) {
  const lines = masked.split('\n')
  // 先收集"由 indexOf 赋值的下标变量名"(②形要认它,否则会把 `list[i + 1]` 这种无关下标算进来)
  const idxVars = new Set()
  for (const m of masked.matchAll(IDX_ASSIGN_RE)) idxVars.add(m[1])
  const sites = []
  lines.forEach((line, i) => {
    RAW_INLINE_RE.lastIndex = 0
    if (RAW_INLINE_RE.test(line)) {
      sites.push({ line: i + 1, shape: 'inline', text: line.trim().slice(0, 120) })
      return
    }
    if (idxVars.size) {
      RAW_INDEXED_RE.lastIndex = 0
      let m
      while ((m = RAW_INDEXED_RE.exec(line))) {
        if (idxVars.has(m[1])) {
          sites.push({ line: i + 1, shape: 'indexed', text: line.trim().slice(0, 120) })
          break
        }
      }
    }
  })
  return sites
}

/** 该文件是否已引单源出口(信息位:引了还留裸站点 = 半收口状态,读的人最关心这种)。
 *  ⚠ 必须跑在**原文**上:`import … from './lib/flag-value.mjs'` 的路径是字符串字面量,
 *  遮罩后一律变占位符 ⇒ 拿遮罩文本判会把每个"已引单源"的文件都读成没引(2026-10-17 自检当场抓到)。 */
export function usesLib(raw) {
  return /lib\/flag-value\.mjs/.test(raw)
}

/** 枚举被审面的 scripts/**.mjs(排除本器自身与镜像测试、单源 lib 那一枚)。 */
export function listTargets(names) {
  return names
    .split('\n')
    .filter((p) => p.startsWith(ENUM_PREFIX) && p.endsWith('.mjs'))
    .filter((p) => !p.startsWith('scripts/tests/'))
    .filter((p) => !p.endsWith(`/${SELF_NAME}`))
    .filter((p) => p !== 'scripts/lib/flag-value.mjs')
    .sort()
}

/** 逐文件度量:返回 {sites, filesScanned, filesWithSites, filesUsingLib}。 */
export function measure(entries) {
  const out = []
  for (const e of entries) {
    if (e.text === null || e.text === undefined) continue // 取不到内容的文件由调用方计进未判定
    const masked = maskCommentsAndStrings(e.text)
    const sites = findRawSites(masked)
    if (sites.length) out.push({ path: e.path, usesLib: usesLib(e.text), sites })
  }
  return {
    files: out,
    filesWithSites: out.length,
    siteCount: out.reduce((n, f) => n + f.sites.length, 0),
    halfClosed: out.filter((f) => f.usesLib).map((f) => f.path),
  }
}

function selfTest() {
  const cases = []
  const T = (name, fn) => cases.push({ name, ok: (() => {
    try {
      return fn() === true
    } catch {
      return false
    }
  })() })
  T('①同形被点数', () => findRawSites("const r = argv[argv.indexOf('--root') + 1]").length === 1)
  T('②存形被点数(indexOf 赋值过的下标)', () => {
    const src = ['const i = args.indexOf("--kind")', 'const k = args[i + 1]'].join('\n')
    return findRawSites(src).length === 1
  })
  T('②不误伤无关下标(变量不是 indexOf 来的)', () => {
    const src = ['for (let i = 0; i < 5; i++) {}', 'const v = arr[i + 1]'].join('\n')
    return findRawSites(src).length === 0
  })
  T('遮罩后的注释与字符串不算站点', () => {
    const src = maskCommentsAndStrings(
      ['// 旧写法 argv[argv.indexOf("--root") + 1] 会吞值', "const note = 'argv[args.indexOf(x) + 1]'"].join('\n'),
    )
    return findRawSites(src).length === 0
  })
  T('走单源出口的形态不算站点', () => findRawSites('const f = requireFlagValue(argv, "--root")').length === 0)
  T('usesLib 认出单源导入', () => usesLib("import { flagValue } from './lib/flag-value.mjs'") === true)
  // 2026-10-17 自检当场抓到的一型:导入说明符是**字符串字面量**,遮罩后看不见 ⇒
  // usesLib 必须吃原文。这条锁的是"信息位不能反过来把半收口状态读成未收口"。
  T('usesLib 跑在原文上(遮罩后的文本里没有导入路径)', () => {
    const raw = "import { requireFlagValue } from './lib/flag-value.mjs'\nconst a = argv[argv.indexOf('--p') + 1]"
    return usesLib(raw) === true && usesLib(maskCommentsAndStrings(raw)) === false
  })
  T('枚举排除本器/测试/单源自身', () => {
    const names = [
      'scripts/a.mjs',
      'scripts/tests/a.test.mjs',
      'scripts/lib/flag-value.mjs',
      'scripts/check-flag-value-discipline.mjs',
      'apps/web/x.mjs',
    ].join('\n')
    return JSON.stringify(listTargets(names)) === JSON.stringify(['scripts/a.mjs'])
  })
  T('measure 汇总口径(files/siteCount/halfClosed)', () => {
    const m = measure([
      { path: 'x.mjs', text: "const a = argv[argv.indexOf('--p') + 1]" },
      { path: 'y.mjs', text: "import { requireFlagValue } from './lib/flag-value.mjs'\nconst b = argv[argv.indexOf('--q') + 1]" },
      { path: 'z.mjs', text: 'const c = 1' },
    ])
    return m.filesWithSites === 2 && m.siteCount === 2 && JSON.stringify(m.halfClosed) === JSON.stringify(['y.mjs'])
  })
  T('取不到内容(text=null)不进站点,由调用方计未判定', () => measure([{ path: 'w.mjs', text: null }]).filesWithSites === 0)
  const bad = cases.filter((c) => !c.ok)
  for (const c of bad) console.log(`  ✖ ${c.name}`)
  console.log(`--self-test: ${cases.length - bad.length} 通过 / ${bad.length} 失败(共 ${cases.length} 例)`)
  return bad.length ? 1 : 0
}

function readFace(face) {
  const rev = face === 'staged' ? '' : 'HEAD'
  let names
  try {
    names = gitRaw(['-c', 'core.quotePath=false', 'ls-tree', '-r', '--name-only', rev, '--', ENUM_PREFIX], ROOT, {
      timeout: 120_000,
    })
  } catch (e) {
    return { error: `枚举被审面(${face})失败:${String(e?.message ?? e).split('\n')[0]}` }
  }
  const targets = listTargets(names)
  if (!targets.length) return { error: `枚举到 0 个目标(${face} 面 ${ENUM_PREFIX}*.mjs)⇒ 判死,不记绿(§0.3)` }
  const specs = targets.map((p) => `${rev}:${p}`)
  let map
  try {
    map = catBatch(ROOT, specs, { timeout: 180_000, maxBuffer: 1 << 27 })
  } catch (e) {
    return { error: `取 ${face} 面内容失败:${String(e?.message ?? e).split('\n')[0]}` }
  }
  const entries = []
  const unread = []
  for (const p of targets) {
    const text = map.get(`${rev}:${p}`)
    if (typeof text !== 'string') {
      unread.push(p)
      continue
    }
    entries.push({ path: p, text })
  }
  return { face, targets, entries, unread }
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法:node scripts/check-flag-value-discipline.mjs [--staged|--worktree] [--strict] [--json] [--top N]\n' +
        '  只读对账尺:数 scripts/**.mjs 里"旗标吞值"的裸取值形状(①同形 argv[argv.indexOf(f)+1] ②存形 argv[i+1])。\n' +
        '  默认档只报数(rc=0);--strict 在存量非 0 时 rc=1;取不到被审面一律 rc=2 未判定。\n' +
        '  升 blocking 的前置 = 存量归零 + guardian-runner 净面(本器不自行注册,§12e)。',
    )
    return 0
  }
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (sel.error) {
    console.error(`❌ 无法判定:${sel.error}`)
    return 2
  }
  const strict = argv.includes('--strict')
  const asJson = argv.includes('--json')
  let r
  if (sel.face === 'worktree') {
    // 人工逃生舱:整树按磁盘读;仍走同一份判据(不在这里复制第二份形状)
    const targets = listTargets(
      gitRaw(['-c', 'core.quotePath=false', 'ls-files', '--', ENUM_PREFIX], ROOT, { timeout: 60_000 }),
    )
    const entries = []
    const unread = []
    for (const p of targets) {
      try {
        entries.push({ path: p, text: readFileSync(resolve(ROOT, p), 'utf8') })
      } catch {
        unread.push(p)
      }
    }
    r = { face: 'worktree', targets, entries, unread }
  } else {
    r = readFace(sel.face)
  }
  if (r.error) {
    console.error(`❌ 无法判定(未判定 ≠ 通过):${r.error}`)
    return 2
  }
  const m = measure(r.entries)
  // 自己的尺子先守本票的规矩:--top 走单源出口,不给值就点名,不静默当"没给"
  const topFlag = requireFlagValue(argv, '--top', { noun: '正整数' })
  if (topFlag.error) {
    console.error(`❌ ${topFlag.error}`)
    return 2
  }
  const top = topFlag.value ? Number(topFlag.value) : 0
  if (topFlag.value && (!Number.isInteger(top) || top <= 0)) {
    console.error(`❌ --top 需要正整数,实得:${JSON.stringify(topFlag.value)}`)
    return 2
  }
  const shown = top ? m.files.slice(0, top) : m.files
  if (asJson) {
    console.log(JSON.stringify({ face: r.face, ...m, unread: r.unread, shown }, null, 2))
  } else {
    for (const f of shown) {
      const tag = f.usesLib ? '(已引单源仍留裸站点)' : ''
      console.log(`  ${f.path}:${f.sites.map((s) => s.line).join(',')} ${tag}`)
      for (const s of f.sites) console.log(`      ${s.shape} L${s.line} ${s.text}`)
    }
    console.log(
      `吞值裸站点(判定面=${r.face}):站点共 ${m.siteCount} 处 / 命中文件 ${m.filesWithSites} 份 · ` +
        `已引单源仍留裸站点 ${m.halfClosed.length} 份 · 取不到内容 ${r.unread.length} 份${top ? ` · 本次只列前 ${shown.length} 份(--top ${top})` : ''}`,
    )
    if (r.unread.length) console.log(`  ⚠ 取不到内容(不并入读数,逐条点名):${r.unread.slice(0, 8).join(', ')}${r.unread.length > 8 ? ' …' : ''}`)
    console.log(
      strict
        ? m.siteCount > 0
          ? `❌ --strict:${m.siteCount} 处裸站点未收口`
          : '✅ --strict:裸站点已归零'
        : `ℹ 默认档只报数(存量非 0 时接提交链就是 §12e 的恒红门;升档前置 = 存量归零 + runner 净面)`,
    )
  }
  if (strict && m.siteCount > 0) return 1
  return 0
}

// 顶层直执行守卫(§22d:main 必须是同步返回码或自带 Promise;这里用缺省档)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 本器自身异常(不记为通过):${String(e?.message ?? e)}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { findRawSites, usesLib, listTargets, measure, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
