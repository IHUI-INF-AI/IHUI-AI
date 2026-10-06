#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815966 第二票:百分比裁剪的单一出口对账(镜像判据,本票**不**接提交链)。
//
// 判据:出口之外,任何文件再出现一份内联的 0–100 百分比裁剪形态 ⇒ 记一处站点。
//   --staged   判索引 blob,锚点 = 该文件在 HEAD 自身的站点数(只拦"这次把裁剪加回来");
//   全量档      判 HEAD blob,默认存量只报数(exit 0)—— 真仓现读为 0,所以接线不会造恒红面;
//   --strict   存量也判红(问责档)。
// 出口被摘线 ⇒ 判"尺子失明"并参与退出码(只打印不改退出码 = 下一次没人看,守门 135 同一课)。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const EXIT_FILE = 'packages/shared/src/utils/clamp-percent.ts'
const GIT_TIMEOUT = 60_000

const SELF_EXEMPT = ['scripts/check-percent-clamp-single-source.mjs', 'scripts/tests/check-percent-clamp-single-source']
const SCAN_DIRS = ['apps', 'packages']
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|wxss)$/
const TEST_PATH_RE = /(^|\/)(tests|__tests__|e2e|test)\//

// 形态清单:收窄到票面那一种写法,门就对它自己拦不住的其它写法整族失明(守门 102 左向箭头同型)。
const PATTERNS = [
  { why: 'Math.max(0, Math.min(100, …))', re: /Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\b/ },
  { why: 'Math.min(100, Math.max(0, …))', re: /Math\.min\(\s*100\s*,\s*Math\.max\(\s*0\b/ },
  { why: '三目 > 100 ? 100 : … < 0 ? 0', re: />\s*100\s*\?\s*100\b/ },
  { why: '三目 < 0 ? 0 : … > 100 ? 100', re: /<\s*0\s*\?\s*0\s*:[^?;)]{0,80}>\s*100\s*\?\s*100\b/ },
  { why: 'clamp(x, 0, 100)', re: /\bclamp\(\s*[^,()]{1,60}\s*,\s*0\s*,\s*100\s*\)/ },
]

/**
 * 纯判据:输入 = 原文,返回该行上的形态命中(先取原文行做"确实有字"的对照,再在遮罩面上跑正则)。
 *
 * 为什么遮罩与原文**两把都要**:遮罩只把命中行压白(等长),所以"这一行命中"在遮罩面上看得见,
 * 而"这一行在原文里是不是代码"要拿原文的非空白字符数判 —— 注释与字符串被压成空格后原文那一行的
 * 字符仍在,不能拿遮罩面判空。少这一步,门会把"解释自己的散文"判成违规站点(守门 131 那一课)。
 */
function lineHits(rawLine) {
  const maskedLine = maskCommentsAndStrings(rawLine)
  const codeChars = maskedLine.replace(/\s/g, '').length
  const hits = codeChars === 0 ? [] : PATTERNS.filter(({ re }) => re.test(maskedLine)).map((p) => p.why)
  return { maskedLine, rawLine, hits }
}

/** 逐行判据(等长遮罩 ⇒ 行号直通原文) */
function findSites(text) {
  const rawLines = text.split('\n')
  const out = []
  for (let i = 0; i < rawLines.length; i++) {
    const { hits } = lineHits(rawLines[i])
    for (const why of hits) out.push({ line: i + 1, why, excerpt: rawLines[i].trim().slice(0, 90) })
  }
  return out
}

function isSelfExempt(rel) {
  const norm = rel.split(path.sep).join('/')
  return SELF_EXEMPT.some((p) => norm === p || norm.startsWith(p))
}

function collectScanSet(contents) {
  const files = []
  for (const rel of Object.keys(contents)) {
    if (rel === EXIT_FILE) continue
    if (isSelfExempt(rel)) continue
    files.push(rel)
  }
  return files
}

/** 清单与内容同面同轮:HEAD 档 ls-tree、索引档 diff --cached(清单取索引而内容取 HEAD 会造出自洽的错位尺子) */
function listCandidates(face) {
  const out = new Set()
  for (const dir of SCAN_DIRS) {
    const args =
      face === 'head'
        ? ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', dir]
        : face === 'staged'
          ? ['diff', '--cached', '--name-only', '-z', '--', dir]
          : ['ls-files', '-z', '--', dir]
    const raw = gitRaw(args, ROOT, { timeout: GIT_TIMEOUT })
    if (typeof raw !== 'string') throw new Undetermined(`清单枚举失败:${dir}`)
    for (const p of raw.split('\0')) {
      if (!p) continue
      if (!SRC_EXT.test(p)) continue
      if (TEST_PATH_RE.test(p)) continue
      out.add(p)
    }
  }
  return [...out]
}

function readFace(face) {
  const paths = listCandidates(face)
  if (paths.length === 0) throw new Undetermined(`枚举到 0 个源码文件(${SCAN_DIRS.join(', ')})—— 空扫不记绿`)
  const contents = {}
  const missing = []
  if (face === 'worktree') {
    for (const p of paths) {
      const text = readWorktreeFile(ROOT, p)
      if (typeof text !== 'string') missing.push(p)
      else contents[p] = text
    }
  } else {
    const prefix = face === 'staged' ? '' : 'HEAD'
    const specs = paths.map((p) => `${prefix}:${p}`)
    const got = catBatch(ROOT, specs, { timeout: 120_000 })
    for (let i = 0; i < paths.length; i++) {
      const text = got.get(specs[i])
      if (typeof text !== 'string') missing.push(paths[i])
      else contents[paths[i]] = text
    }
  }
  if (missing.length > 0) {
    throw new Undetermined(`内容取不到 ${missing.length} 个文件,首个:${missing[0]}`)
  }
  return contents
}

function countSites(text) {
  return findSites(text).length
}

/**
 * 汇总:三态不并桶 —— 站点 / 已锚存(只报数)/ 判红(新增或 --strict)。
 * 出口在位性单独判:出口文件不在面上,或 clampPercent 声明不见 ⇒ blind ⇒ 一定参与退出码。
 */
function decide({ contents, anchor, strict }) {
  const exitText = contents[EXIT_FILE]
  const blind = typeof exitText !== 'string' || !/export function clampPercent\b/.test(exitText)
  const sites = []
  for (const rel of collectScanSet(contents)) {
    for (const hit of findSites(contents[rel])) sites.push({ file: rel, ...hit })
  }
  const perFile = {}
  for (const s of sites) perFile[s.file] = (perFile[s.file] || 0) + 1
  const reds = []
  const anchored = []
  for (const s of sites) {
    const cap = anchor[s.file] || 0
    // 棘轮比的是"该文件本次 vs 该文件 HEAD",不是总数 —— 否则别人欠的账会钉红本次提交(§12e)
    if (strict || perFile[s.file] > cap) reds.push(s)
    else anchored.push(s)
  }
  return {
    blind,
    scanned: collectScanSet(contents).length,
    exitScanned: typeof exitText === 'string',
    sites,
    perFile,
    reds,
    anchored,
  }
}

function main(argv) {
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  const face = picked.face
  try {
    const contents = readFace(face)
    // 锚点与内容同面同轮取:staged 档的锚点是 HEAD 面同一批文件的站点数
    const anchorContents = face === 'head' ? contents : readFace('head')
    const anchor = {}
    for (const rel of collectScanSet(anchorContents)) {
      const n = countSites(anchorContents[rel])
      if (n > 0) anchor[rel] = n
    }
    const res = decide({ contents, anchor, strict })
    if (json) console.log(JSON.stringify({ face, strict, ...res }, null, 2))
    else {
      console.log(`判定面 = ${face} · 扫描 ${res.scanned} 文件 · 出口 = ${EXIT_FILE}`)
      console.log(
        `PC0 出口在位:${
          res.blind
            ? '❌ 出口文件或 clampPercent 声明取不到 ⇒ 本门对"第二处真相"整族失明'
            : `在位且仍导出 clampPercent(出口自身也扫了 ${res.exitScanned ? '1' : '0'} 份)`
        }`,
      )
      console.log(`站点 = ${res.sites.length} 处 / ${Object.keys(res.perFile).length} 文件`)
      for (const s of res.sites) console.log(`  - ${s.file}:${s.line} [${s.why}] ${s.excerpt}`)
      console.log(`本次判红 = ${res.reds.length} 处${strict ? '(--strict 含存量)' : '(按该文件 HEAD 棘轮只拦新增)'}`)
      for (const s of res.reds) console.log(`    ✗ ${s.file}:${s.line} [${s.why}] ${s.excerpt}`)
      console.log(
        res.blind
          ? '结论:尺子失明 ⇒ 判红(不得把"看不见"记成"没有第二处")'
          : res.reds.length > 0
            ? `结论:判红 ${res.reds.length} 处 —— 百分比裁剪的唯一出口是 ${EXIT_FILE},请改为 import`
            : `结论:通过(存量 ${res.anchored.length} 处按棘轮只报数;问责跑 --strict)`,
      )
    }
    if (res.blind) return 1
    return res.reds.length > 0 ? 1 : 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(不记为通过):${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e && e.stack ? e.stack : e}`)
    return 2
  }
}

/** 构造面自检:判据有牙只能用"它应当红的夹具"证明,不能只看它此刻的颜色 */
function selfTest() {
  const results = []
  // 判据:cond 必须是已求值布尔(函数对象恒 truthy ⇒ 断言从未求值)
  const t = (name, cond) => results.push({ name, ok: cond === true, isFn: typeof cond === 'function' })
  const exitText = '// 唯一出口\nexport function clampPercent(v: number): number {\n  return Math.max(0, Math.min(100, v))\n}\n'
  const V1 = 'const pct = Math.max(0, Math.min(100, progress))'
  const V2 = 'const pct = Math.min(100, Math.max(0, progress))'
  const V3 = 'const pct = p > 100 ? 100 : p < 0 ? 0 : p'
  const V4 = 'const pct = p < 0 ? 0 : p > 100 ? 100 : p'
  const V5 = 'const pct = clamp(value, 0, 100)'
  const NON_RATIO = 'const r = Math.max(0, Math.min(1, x))'
  const NON_INDEX = 'const i = Math.max(0, Math.min(idx, list.length - 1))'
  const COMMENT = '// 旧写法 Math.max(0, Math.min(100, progress)) 已收口\nconst a = 1'
  const STRING = 'const doc = "Math.max(0, Math.min(100, progress)) 是旧形态"\nconst b = 2'
  const base = { [EXIT_FILE]: exitText }

  // —— 正向:五种书写形态各必须命中 ——
  for (const [tag, src] of [['Math.max 主形态', V1], ['反向嵌套', V2], ['三目 > 100', V3], ['三目 < 0 起', V4], ['clamp(x,0,100)', V5]]) {
    t(`形态必须被看见:${tag}`, findSites(src).length >= 1)
  }
  // —— 反向:非百分比的两型不得混进计数(假阳比漏报更贵) ——
  t('0–1 比例裁剪不属百分比这一维', findSites(NON_RATIO).length === 0)
  t('索引钳位不属百分比这一维', findSites(NON_INDEX).length === 0)
  // —— 反向:注释与字符串里的该形态不得判成站点 ——
  t('注释里的形态不得计入(门不得把解释自己判成违规)', findSites(COMMENT).length === 0)
  t('字符串字面量里的形态不得计入', findSites(STRING).length === 0)
  // —— 出口自身不误伤 ——
  const r0 = decide({ contents: { ...base, 'apps/x/y.ts': 'const z = 1' }, anchor: {}, strict: false })
  t('出口内的 Math.min(100 不算站点', r0.sites.length === 0 && r0.blind === false)
  // —— PC0 失明参与退出码 ——
  const r1 = decide({ contents: { 'apps/x/y.ts': V1 }, anchor: {}, strict: true })
  t('出口整块不在面上 ⇒ 判失明', r1.blind === true)
  const r2 = decide({ contents: { [EXIT_FILE]: 'export const pct = 1\n', 'apps/x/y.ts': 'const z = 1' }, anchor: {}, strict: true })
  t('出口文件在而 clampPercent 声明被摘 ⇒ 仍判失明', r2.blind === true)
  // —— 棘轮四向 ——
  const anchorOne = { 'apps/x/y.ts': 1 }
  t('同文件等锚点的站点 ⇒ 只报数不判红', decide({ contents: { ...base, 'apps/x/y.ts': V1 }, anchor: anchorOne, strict: false }).reds.length === 0)
  t('同文件超出锚点 ⇒ 判红', decide({ contents: { ...base, 'apps/x/y.ts': `${V1}\nconst q = ${V5}` }, anchor: anchorOne, strict: false }).reds.length === 2)
  t('新文件锚点 0 ⇒ 首处即红', decide({ contents: { ...base, 'apps/fresh/n.ts': V1 }, anchor: {}, strict: false }).reds.length === 1)
  t('别的文件欠的账不顶本文件的红(逐文件比,不比总数)', decide({ contents: { ...base, 'apps/a/a.ts': V1, 'apps/b/b.ts': V1 }, anchor: { 'apps/a/a.ts': 1 }, strict: false }).reds.map((s) => s.file).join(',') === 'apps/b/b.ts')
  t('--strict 把存量一起问责', decide({ contents: { ...base, 'apps/x/y.ts': V1 }, anchor: anchorOne, strict: true }).reds.length === 1)
  t('存量与新增两桶不并计(报数仍逐条可见)', (() => {
    const r = decide({ contents: { ...base, 'apps/x/y.ts': V1 }, anchor: anchorOne, strict: false })
    return r.sites.length === 1 && r.anchored.length === 1 && r.reds.length === 0
  })())
  // —— 覆盖面自证:空面必须表现为失明 + scanned=0,不得读成"没有第二处" ——
  t('空面 ⇒ blind 且 scanned=0(空扫不记绿)', (() => {
    const r = decide({ contents: {}, anchor: {}, strict: false })
    return r.blind === true && r.scanned === 0 && r.exitScanned === false
  })())
  t('出口在场而扫描面为空 ⇒ 不 blind 但仍 scanned=0', (() => {
    const r = decide({ contents: { [EXIT_FILE]: exitText }, anchor: {}, strict: false })
    return r.blind === false && r.scanned === 0
  })())
  let failed = 0
  for (const r of results) {
    if (!r.ok) failed++
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.isFn ? ' [cond 是函数 ⇒ 该断言从未求值]' : ''}`)
  }
  console.log(`--self-test 结果:${results.length - failed}/${results.length} 通过`)
  return failed === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  const rc = argv.includes('--self-test') ? selfTest() : main(argv)
  process.exit(rc)
}

export const __test__ = { findSites, decide, EXIT_FILE, SELF_EXEMPT, PATTERNS, countSites }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
