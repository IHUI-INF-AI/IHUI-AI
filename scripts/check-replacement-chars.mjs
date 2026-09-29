#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 源码里的 U+FFFD(替换符)对账 —— AGENTS §3「字节级 UTF-8 完整性」那一族的缺失维度。
 *
 * 为什么既有门拦不住它(立项凭据,不是推测):守门 4c `check-api-client-utf8.mjs` 判的是
 * **非法 UTF-8 字节序列**,而 `U+FFFD` 编成字节是 `EF BF BD` —— 完全合法。所以"内容已经被
 * 有损解码换掉"这件事在字节合法性上是**看不见的**:2026-09-29 实测 HEAD 面 5 个文件、718 处
 * 替换符,全链百余道门一路报绿,包括那道专管 UTF-8 的门。⇒ 通用规矩:
 * **一个完整性判据若只看编码合法性,就看不见"合法编码承载损坏内容"这一型。**
 *
 * 损坏怎么发生的(实测码位对账):被换掉的总是「多字节字 + 紧随其后的一个低 ASCII(空格/换行/数字)」
 * 这一对,替换成 `U+FFFD` + '?'。所以注释内部的换行与 ASCII 数字会一起没 —— 这决定了找回只能
 * 按注释区间整段搬,不能按行对行搬(--recover 档就是按这条做的)。
 *
 * 判据三条,各有正反例(见 --self-test):
 *  RC1 红 = 被审面某文件的 U+FFFD 处数 **高于该文件在 HEAD 自身的处数**(棘轮)。
 *      存量与本次提交无关,当场判红就是一台恒红门,唯一结局是逼人 --no-verify 连带废掉全部
 *      守门(AGENTS §12e);所以存量只报数、只拦"这次把损坏加回来/新写进去"。
 *  RC2 全量档判 HEAD 面,存量一律**报数并逐文件点名**;`--strict` 只把"未判定"翻成 exit 2,
 *      不把存量翻成红 —— 那等于造一台没人能清的必红机器。
 *  RC3 取材失败的逐文件计「未判定」并点名,**绝不静默少扫**;枚举到 0 个候选文件判死(exit 2),
 *      空扫不等于通过(AGENTS §22c「判据失效的表现永远是安静」同一条禁令)。
 *
 * 已知看不见的一格(如实登记,不假装覆盖):同一场事故还会把非 ASCII 换成**裸 ASCII '?'**
 * (实测 app.ts 里 534 处),那种形态与正当写入的问号**不可区分**,本门不判、也不报"已确认没有"。
 *
 * 用法:
 *   node scripts/check-replacement-chars.mjs                 全量:判 HEAD blob
 *   node scripts/check-replacement-chars.mjs --staged        提交链:判索引 blob,套 RC1 棘轮
 *   node scripts/check-replacement-chars.mjs --worktree      仅人工(与 --staged 同给 ⇒ exit 2)
 *   node scripts/check-replacement-chars.mjs --strict        问责档:有「未判定」即 exit 2
 *   node scripts/check-replacement-chars.mjs --recover <path>  该路径的注释找回方案(只读)
 *   node scripts/check-replacement-chars.mjs --self-test     构造面正反例
 * 修复出口:--recover 打印"最近零损坏祖先 + 每个损坏注释区间的搬运方案";落地一律走
 *   node scripts/object-space-land.mjs 的 LAND_BLOBS 档(共享工作树里别人常在飞,交磁盘字节
 *   等于替别人落地,AGENTS §12)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertRepoRoot, catBatch, gitBinary, gitErrText, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskedSpans } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPL = String.fromCharCode(0xfffd)
const GIT_TIMEOUT_MS = 120_000
const SCAN_DIRS = ['apps', 'packages', 'scripts', 'sdks', 'deploy', 'monitoring']
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|less|py|sh|ps1|bat|html|vue)$/
const SKIP_SEG = /(node_modules|[/\\]\.next[/\\]|[/\\]dist[/\\]|[/\\]build[/\\]|[/\\]tests[/\\]|__tests__|[/\\]\.git[/\\])/
const GIT_MAX = 1 << 29

const git = (args, opts = {}) =>
  execFileSync(gitBinary(), ['-c', 'safe.directory=*', '-c', 'core.quotePath=false', '-C', ROOT, ...args], {
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: GIT_MAX,
    ...opts,
  })

const occ = (t) => (t == null ? null : t.split(REPL).length - 1)
const commentSpans = (t) => maskedSpans(t).filter((s) => s.kind === 'comment')
const skel = (s) => s.replace(/[?\s]/g, '').replace(/[^\x20-\x7e]/g, '')
/** 注释之外的全部字节,按序拼接 —— "只动了注释"的逐字自证就比它 */
const outsideComments = (t) => {
  let out = ''
  let pos = 0
  for (const s of commentSpans(t)) {
    out += t.slice(pos, s.start)
    pos = s.end
  }
  return out + t.slice(pos)
}

function listTracked(face) {
  const args = face === 'head' ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_DIRS] : ['ls-files', '--', ...SCAN_DIRS]
  try {
    return git(args)
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && SRC_EXT.test(s) && !SKIP_SEG.test(s))
  } catch (e) {
    return { error: gitErrText(e) }
  }
}

/** 全量档判 HEAD blob、--staged 判索引 blob、--worktree 只作人工逃生舱;两面旗同给由 selectFace 判死 */
function audit(face, strict) {
  const files = listTracked(face === 'staged' ? 'index' : 'head')
  if (!Array.isArray(files)) {
    console.log(`❌ 无法枚举被审面的文件清单:${files.error}`)
    return 2
  }
  if (files.length === 0) {
    console.log(`❌ 在 ${face} 面枚举到 0 个源码文件 ⇒ 判死(空扫不是"没有违规",是"什么都没看")`)
    return 2
  }
  const specs = files.map((p) => (face === 'head' ? `HEAD:${p}` : `:${p}`))
  let contents
  try {
    contents = face === 'worktree' ? null : catBatch(ROOT, specs, { maxBuffer: GIT_MAX, timeout: GIT_TIMEOUT_MS })
  } catch (e) {
    console.log(`❌ 取材失败,${face} 面无法判定:${gitErrText(e)}`)
    return 2
  }
  const rows = []
  const undetermined = []
  for (const p of files) {
    let text
    if (face === 'worktree') {
      if (!existsSync(join(ROOT, p))) {
        undetermined.push(`${p}(工作树里没有)`)
        continue
      }
      text = readWorktreeFile(ROOT, p)
    } else text = contents.get(specs[files.indexOf(p)])
    if (text == null) {
      undetermined.push(`${p}(${face} 面取不到)`)
      continue
    }
    const n = occ(text)
    if (n > 0) rows.push([p, n])
  }
  // RC1:索引面才算"本次带进来的新账" —— 拿该文件在 HEAD 自身的处数当锚点,只拦上升
  const rising = []
  if (face === 'staged') {
    const headContents = catBatch(
      ROOT,
      rows.map(([p]) => `HEAD:${p}`),
      { maxBuffer: GIT_MAX, timeout: GIT_TIMEOUT_MS },
    )
    for (const [p, n] of rows) {
      const base = occ(headContents.get(`HEAD:${p}`))
      if (base == null) {
        undetermined.push(`${p}(HEAD 面取不到 ⇒ 锚点判不出,按新增对待并报明原因)`)
        rising.push([p, n, null])
        continue
      }
      if (n > base) rising.push([p, n, base])
    }
  }

  rows.sort((a, b) => b[1] - a[1])
  console.log(`[replacement-chars] 面=${face} 扫源码文件 ${files.length} 个 / 含 U+FFFD ${rows.length} 个 / 未判定 ${undetermined.length} 个`)
  for (const [p, n] of rows) {
    const r = rising.find((x) => x[0] === p)
    console.log(`  ${r ? '❌' : '◽'} ${p} 处数=${n}${r ? `(该文件 HEAD 自身=${r[2] == null ? '未判定' : r[2]},上升 ${n - r[2]} 处)` : '(存量,与本次提交无关 ⇒ 只报数)'}`)
  }
  for (const u of undetermined) console.log(`  ◽ 未判定:${u}`)
  if (face === 'head') {
    console.log(
      rows.length
        ? `  ℹ️ 全量档不判红:存量损坏与任何单次提交都无关(恒红门的唯一结局是各会话跳钩子、连带全部对账作废)。要清:` +
          `node scripts/check-replacement-chars.mjs --recover <路径>`
        : '  ✅ HEAD 面零 U+FFFD',
    )
    return undetermined.length && strict ? 2 : 0
  }
  if (rising.length) {
    console.log(`  ❌ RC1:本次把 ${rising.length} 个文件的替换符推高(新增或加回)` + ` —— 出口见 --recover,禁止为过门把损坏留在原地再换个写法`)
    return 1
  }
  console.log('  ✅ RC1:没有任何文件的 U+FFFD 高于其 HEAD 自身存量')
  return strict && undetermined.length ? 2 : 0
}

/** 找该路径最近的"零 U+FFFD"祖先 blob —— 它就是可用的原文来源 */
function newestCleanAncestor(rel) {
  const commits = git(['rev-list', 'HEAD', '--', rel]).split('\n').filter(Boolean)
  const specs = commits.map((c) => `${c}:${rel}`)
  const map = catBatch(ROOT, specs, { maxBuffer: GIT_MAX, timeout: GIT_TIMEOUT_MS })
  for (let i = 0; i < commits.length; i++) {
    const t = map.get(specs[i])
    if (t != null && occ(t) === 0) return { sha: commits[i], text: t, checked: commits.length }
  }
  return { sha: null, text: null, checked: commits.length }
}

/**
 * --recover:按"代码括号"给每个损坏注释区间找原文,并把方案落成一个可核对的报告。
 * 判据与本轮实际找回用的同一套(骨架相等 → 括号内区间数相等时按序 → 都收不到就交人工):
 * 括号取"紧邻前一行代码 / 后一行代码",因为代码是纯 ASCII,是损坏唯一吞不掉的那一维。
 * 本档**只读**:产出写到 .ihui-agent/tmp/,落地由人走 object-space-land 的 LAND_BLOBS。
 */
function recover(rel, emitName) {
  const H = catBatch(ROOT, [`HEAD:${rel}`]).get(`HEAD:${rel}`)
  if (H == null) {
    console.log(`❌ HEAD 面取不到 ${rel} ⇒ 无法判定`)
    return 2
  }
  if (occ(H) === 0) {
    console.log(`${rel}:HEAD 面零 U+FFFD,无需找回`)
    return 0
  }
  const anc = newestCleanAncestor(rel)
  if (!anc.sha) {
    console.log(`❌ ${rel}:最近 ${anc.checked} 个 blob 里没有零损坏版本 ⇒ 该文件的原文无从取回(如实登记,不编造)`)
    return 2
  }
  const P = anc.text
  const lineOf = (t, off) => t.slice(0, off).split('\n').length - 1
  const codeLines = (t) => {
    const lines = t.split('\n')
    const inC = new Set()
    for (const s of commentSpans(t)) {
      const a = lineOf(t, s.start)
      const b = lineOf(t, Math.max(s.start, s.end - 1))
      for (let i = a; i <= b; i++) inC.add(i)
    }
    return lines.map((raw, i) => ({ i, raw, text: raw.trim(), code: !!raw.trim() && !inC.has(i) })).filter((l) => l.code)
  }
  const HC = codeLines(H)
  const PC = codeLines(P)
  const skel = (s) => s.replace(/[?\s]/g, '').replace(/[^\x20-\x7e]/g, '')
  const bracket = (t, cls, s) => {
    const a = lineOf(t, s.start)
    const b = lineOf(t, Math.max(s.start, s.end - 1))
    return [cls.filter((c) => c.i < a).slice(-1)[0]?.text || '', cls.filter((c) => c.i > b).slice(0, 1)[0]?.text || '']
  }
  const pByBracket = new Map()
  for (const s of commentSpans(P)) {
    const k = bracket(P, PC, s).join('\u0000')
    const arr = pByBracket.get(k) || []
    arr.push(s)
    pByBracket.set(k, arr)
  }
  // HEAD 侧同括号的区间表:L2「按序取」只在**两面该括号里的区间数相等**时才成立 ——
  // 不等说明中间有注释被吃掉/新加过,按序会整批错位一格,那种情形必须交人工而不是猜。
  const hByBracket = new Map()
  for (const s of commentSpans(H)) {
    const k = bracket(H, HC, s).join('\u0000')
    const arr = hByBracket.get(k) || []
    arr.push(s)
    hByBracket.set(k, arr)
  }
  const edits = []
  const manual = []
  const used = new Set()
  for (const s of commentSpans(H)) {
    const body = H.slice(s.start, s.end)
    if (!body.includes(REPL)) continue
    const key = bracket(H, HC, s).join('\u0000')
    const arr = (pByBracket.get(key) || []).slice().sort((x, y) => x.start - y.start)
    const hArr = (hByBracket.get(key) || []).slice().sort((x, y) => x.start - y.start)
    const sk = skel(body)
    const bySkel = arr.filter((x) => !used.has(x) && skel(P.slice(x.start, x.end)) === sk)
    let chosen = null
    if (bySkel.length === 1) chosen = bySkel[0]
    else if (bySkel.length > 1 && new Set(bySkel.map((x) => P.slice(x.start, x.end))).size === 1) chosen = bySkel[0]
    else if (arr.length && hArr.length === arr.length) {
      const cand = arr[hArr.indexOf(s)]
      if (cand && !used.has(cand)) chosen = cand
    }
    if (!chosen) {
      manual.push(body)
      continue
    }
    used.add(chosen)
    edits.push({ start: s.start, end: s.end, orig: P.slice(chosen.start, chosen.end) })
  }
  let out = H
  for (const e of edits.sort((x, y) => y.start - x.start)) out = out.slice(0, e.start) + e.orig + out.slice(e.end)
  const codeFaceOk = outsideComments(H) === outsideComments(out)
  console.log(
    `[recover] ${rel}  最近零损坏祖先=${anc.sha}  损坏区间=${edits.length + manual.length} 已给方案=${edits.length} 交人工=${manual.length}`,
  )
  console.log(`  注释外字节逐字全等:${codeFaceOk ? '✅' : '❌ ⇒ 方案不可用'}`)
  console.log(`  U+FFFD:${occ(H)} → ${occ(out)}`)
  if (!codeFaceOk) return 1
  const name = emitName || `${rel.replace(/[^\w.]+/g, '_')}.recovered`
  const dir = join(ROOT, '.ihui-agent', 'tmp', 'replacement-chars')
  // 落点固定在专门子目录里:旧写法往 tmp 根写一个 `.keep` 空文件当占位,每跑一次就留一件垃圾
  mkdirSync(dir, { recursive: true })
  const file = join(dir, name)
  writeFileSync(file, out, 'utf8')
  const blob = git(['hash-object', '-w', file]).trim()
  console.log(`  产出:${file}`)
  console.log(
    `  落地命令(先人读 diff 再跑):\n   LAND_PATHS="${rel}" LAND_MSG="…" LAND_BLOBS=<写 {files:[{path:"${rel}",blob:"${blob}"}]} 的清单文件> LAND_BLOB_PROOF="注释区间内部替换,outsideComments 逐字全等" node scripts/object-space-land.mjs`,
  )
  if (manual.length) {
    console.log(`  交人工 ${manual.length} 条(括号收不到唯一原文,禁止编造):`)
    for (const m of manual.slice(0, 5)) console.log(`   - ${m.replace(/\n/g, '\\n').slice(0, 120)}`)
  }
  return 0
}

/** 构造面正反例:判据的牙只能用"它应当红的构造输入"和"它应当绿的当前输入"各喂一次来证明 */
function selfTest() {
  const cases = []
  const t = (name, cond) => cases.push([name, (() => Boolean(cond))()])
  const damaged = '// 中文 ' + REPL + ' 尾巴\nconst a = 1\n'
  const clean = '// 中文说明\nconst a = 1\n'
  t('T1 判得出替换符(阳性对照)', occ(damaged) === 1)
  t('T2 完好文本不计(反向对照)', occ(clean) === 0)
  t('T3 取不到不得冒充 0(未判定是 null)', occ(null) === null)
  t('T4 只动注释 ⇒ 注释外字节全等(把完好注释换成损坏版)', outsideComments(clean) === outsideComments(clean.replace('中文说明', '中文' + REPL + '说明')))
  t('T5 动了代码 ⇒ 注释外字节必不等', outsideComments('const a = 1\n') !== outsideComments('const a = 2\n'))
  t('T6 损坏会吞掉换行(实测形态:区间数因此两面不等)', commentSpans('/* a' + REPL + '? b */').length === 1)
  t('T7 骨架尺看得见 ASCII 幸存部分', skel('契约 ' + REPL + '?@ihui') === '@ihui')
  // 这条断言要证的是"骨架尺对纯中文注释没有分辨力"(所以按序档 L2 必须存在),
  // 而不是钉住某个字面结果 —— 写成一串"或"就等于永远绿,那是本仓明令禁止的恒绿断言。
  t('T8 纯中文注释的骨架里不含任何字母 ⇒ 骨架尺对它无分辨力', !/[A-Za-z]/.test(skel('/** 已解析配色方案 */')))
  t('T9 扩展名判据认 .ts 与 .py', SRC_EXT.test('a.ts') && SRC_EXT.test('b.py') && !SRC_EXT.test('c.json'))
  t('T10 生成物/测试面被排除(判据不得对着夹具判红)', SKIP_SEG.test('packages/x/dist/y.ts') && SKIP_SEG.test('apps/x/tests/y.ts'))
  let pass = 0
  let fail = 0
  for (const [n, ok] of cases) {
    console.log(`${ok ? '✅' : '❌'} ${n}`)
    ok ? pass++ : fail++
  }
  console.log(`self-test: ${pass} 通过 / ${fail} 失败 / 共 ${cases.length}`)
  return fail ? 1 : 0
}

export const __test__ = { occ, outsideComments, skelJudge: (s) => s.replace(/[?\s]/g, '').replace(/[^\x20-\x7e]/g, ''), SRC_EXT, SKIP_SEG }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  let rc
  try {
    assertRepoRoot(ROOT, 'check-replacement-chars')
    if (argv.includes('--self-test')) rc = selfTest()
    else if (argv.includes('--recover')) {
      const i = argv.indexOf('--recover')
      rc = recover(argv[i + 1], argv[i + 2])
    } else {
      const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
      if (sel.error) {
        console.log(`❌ ${sel.error}`)
        rc = 2
      } else rc = audit(sel.face, argv.includes('--strict'))
    }
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    rc = 2
  }
  process.exit(rc)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
