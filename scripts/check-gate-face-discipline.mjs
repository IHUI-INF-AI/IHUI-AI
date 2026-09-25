#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:门脚本的取材面纪律对账(新增判据必须走统一取材层,存量只报数)
//
// 在修什么(2026-09-25 立,第八批吸收线):
//   本仓的守门里有相当一部分**按磁盘判**(`readFileSync(join(ROOT, …))` / `git show` 散写),
//   而 AGENTS §4/§12 反复实测到"共享工作树常年滞后 HEAD" —— 按磁盘判的门会在恒红/假绿之间
//   来回跳,并且会把错的计数写回棘轮基线(守门 83 一天内 R3 登记被整文件回退三次即此型)。
//   统一出口是 `scripts/lib/face-reader.mjs`(全量判 HEAD blob / `--staged` 判索引 blob /
//   取不到 ⇒ exit 2「无法判定」)。实测现走它的是 26 道门,而"读内容却没走它"的有 122 道。
//
// 为什么不一次收紧、也不建豁免清单:
//   ① 当场把 122 道判红就是一台恒红门,唯一结局是各会话 `--no-verify` 连带废掉全部守门
//      (§12e、守门 77/83 同一条教训);
//   ② 手工白名单必然腐烂(守门 77 对 `RN_ONLY_BRAND_KEYS` 的教训)。
//   所以判据锚在**"这次改动"**上:一枚提交如果**新增**了一道按磁盘判的门,或**改**了一道
//   门并把它的取材方式退回散写,就红;存量门不去碰它就只报数。这是结构上的棘轮,
//   不需要清单,也不会因为别人欠债把无关提交钉红。
//
// 三种形态(判据只在能肯定时才判红,宁漏不误报):
//   git 面散写   ⇒ 判红(点名 `cat-file` / `gitRaw(… 'show' …)` / `--batch`)
//   磁盘面散写   ⇒ 判红(`readFileSync(` 且同文件出现 `join(ROOT` / `resolve(ROOT` 这类仓库锚点)
//   只读临时夹具 ⇒ **不计违规也不判红**,归入"未判定"如实报数(它读的不是仓库内容,判红是误伤)
//
// 手动:
//   node scripts/check-gate-face-discipline.mjs            # 全量档:只报数,恒 exit 0(除脚本自身异常)
//   node scripts/check-gate-face-discipline.mjs --staged   # 提交链:改到的门必须走取材层
//   node scripts/check-gate-face-discipline.mjs --self-test
// 紧急跳过:HUSKY_SKIP_GATE_FACE_DISCIPLINE=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
// 遮噪**不复用** `check-compaction-denominator.mjs` 的 `markHidden`:那一档连字符串一起抹,
// 而本门要区分"模块说明符 / git 动词是字符串"(必须保留)与"readFileSync 是调用"(必须抹字符串)。
// 两处判的不是同一件事 —— 下面 maskComments / blankStrings 各管一层。曾经 import 着却没用,
// eslint 的 no-unused-vars 把每一个碰这个文件的人挡在提交链外(HEAD 里躺了几轮没人发现)。

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_GATE_FACE_DISCIPLINE'
export const GATE_GLOB = /^scripts\/(check|scan|guard)[^/]*\.mjs$/
/** 本门自己与取材层必然出现这些标识符(判据模式串),按文件名前缀跳过 */
const SELF_EXEMPT = ['scripts/check-gate-face-discipline.mjs', 'scripts/lib/face-reader.mjs']
const GIT_TIMEOUT = 120000

/** 只是"引了这层"的证据 —— **不再单独构成合规**(判序见 classify) */
const FACE_IMPORT_RE = /from\s*['"][^'"]*lib\/face-reader\.mjs['"]/
/**
 * 走统一取材层的**真**证据:调用这层的读取入口取过内容。只认这两个,是因为 face-reader 的其余导出
 * **不产生内容**:`selectFace` 只选面、`gitBinary` 只给二进制路径、`gitErrText`/`assertRepoRoot` 是错误与
 * 前置检查、`catBatchOids`/`catBatchSizes`/`catBatchCheck` 拿的是 oid/尺寸而不是正文。把门面函数当成
 * 读取凭证,等于给"引了层却自己 git show 读内容"那种形态发通行证 —— 实测 HEAD 面有 6 道门 import 了
 * 层而不走层读内容。命名空间形态(`face.catBatch(`)同视,否则新判据会对合法写法产假阳。
 */
const LAYER_READ_RE =
  /(?:^|[^.\w$])(?:catBatch|readWorktreeFile)\s*\(|[A-Za-z_$][\w$.]*\.(?:catBatch|readWorktreeFile)\s*\(/
/**
 * 层的读取入口。**必须解析 import 子句里的局部名** —— 只认字面 `catBatch(` 会把合法写法误伤:
 * `import { catBatch as readBlobs }` 之后调 `readBlobs(` 同样是走层(别名与多行导入是 ESM 常见形态,
 * 而"判据看不见门自己允许的写法"本仓记过多次:77 B6 只认点号、门 74 只认对象词表)。
 */
const LAYER_READ_ENTRIES = ['catBatch', 'readWorktreeFile']
const LAYER_CLAUSE_RE = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*lib\/face-reader\.mjs['"]/gs
const LAYER_NS_RE = /import\s*\*\s*as\s*([A-Za-z_$][\w$]*)\s*from\s*['"][^'"]*lib\/face-reader\.mjs['"]/g

/** 这道文件是否**真的**用层的读取入口取过内容(含别名 / 命名空间形态)。纯函数,构造面可证。 */
export function usesLayerRead(code) {
  if (LAYER_READ_RE.test(code)) return true
  const names = new Set()
  for (const m of code.matchAll(LAYER_CLAUSE_RE)) {
    for (const raw of m[1].split(',')) {
      const spec = raw.trim()
      if (!spec) continue
      const parts = spec.split(/\s+as\s+/)
      const imported = parts[0].trim()
      const local = (parts[1] || parts[0]).trim()
      if (LAYER_READ_ENTRIES.includes(imported)) names.add(local)
    }
  }
  for (const n of names) if (new RegExp(`(?:^|[^.\\w$])${n}\\s*\\(`).test(code)) return true
  for (const ns of code.matchAll(LAYER_NS_RE)) {
    for (const e of LAYER_READ_ENTRIES)
      if (new RegExp(`${ns[1]}\\.${e}\\s*\\(`).test(code)) return true
  }
  return false
}
/**
 * 散写 git 内容读取的**结构**特征:以 git 为可执行程序派生,且参数里带内容类动词。
 * 刻意要求"同一处调用里两者都在"(`GIT_SPAWN_RE` 与内容动词在同一段 120 字符窗口内),
 * 否则注释、字符串夹具、以及把动词拼进变量的间接调用都会被当成散写(误伤)。
 */
const GIT_SPAWN_RE = /(?:execFileSync|execSync|spawnSync|spawn)\s*\(\s*(?:GIT_BIN|gitPath|gitBinary\s*\(\s*\)|['"]git['"])/
const GIT_CONTENT_ARG_RE = /['"](?:cat-file|show|ls-tree|grep)['"]|--batch(?:-check)?/
const FS_LOOSE_RE = /readFileSync\s*\(/
const REPO_ANCHOR_RE = /(?:join|resolve|normalize)\s*\(\s*ROOT\b|\bROOT\s*,/

/**
 * 只遮注释、**保留字符串字面量**的那一层遮噪。
 *
 * 为什么不复用现成的 `markHidden`:那一档把字符串内容一起抹掉(它服务的判据是"变量名/调用
 * 不能被注释或夹具字符串冒充"),而本门要认的两样东西**本身就是字符串** ——
 * `from './lib/face-reader.mjs'` 的模块说明符,和 `['cat-file', …]` 的 git 动词。
 * 直接套 `markHidden` 的结果是第一版自检 F1/F2 双双假绿:合规的门被读成"没导入",
 * 散写的门被读成"没读 git"。两处判的不是同一件事,所以各有一层遮噪,`markHidden`
 * 仍用于"是否真的读了文件"那一半(见 classify 里的 noStrings)。
 */
export function maskComments(src) {
  const out = []
  let i = 0
  let inBlock = false
  while (i < src.length) {
    if (inBlock) {
      if (src.startsWith('*/', i)) {
        inBlock = false
        i += 2
        out.push('  ')
      } else {
        out.push(src[i] === '\n' ? '\n' : ' ')
        i += 1
      }
      continue
    }
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }
    if (src.startsWith('/*', i)) {
      inBlock = true
      i += 2
      out.push('  ')
      continue
    }
    const q = src[i]
    if (q === "'" || q === '"' || q === '`') {
      out.push(q)
      i += 1
      while (i < src.length) {
        if (src[i] === '\\') {
          out.push(src[i], src[i + 1] ?? '')
          i += 2
          continue
        }
        if (src[i] === q) {
          out.push(q)
          i += 1
          break
        }
        out.push(src[i])
        i += 1
      }
      continue
    }
    out.push(q)
    i += 1
  }
  return out.join('')
}

/**
 * 在已遮注释的文本上再把三类引号-span 清空。
 * `markHidden` 那一档**刻意保留模板字符串**(守门 112 需要看见模板里的标识符),
 * 而本门要挡的恰恰是"文档串/夹具串里写着 readFileSync(join(ROOT…))"这种假调用(F15),
 * 所以这里自己清 —— 顺序也固定:先遮注释再清字符串,反过来会让注释里的引号把状态机带偏。
 */
export function blankStrings(text) {
  const out = []
  let i = 0
  while (i < text.length) {
    const q = text[i]
    if (q !== "'" && q !== '"' && q !== '`') {
      out.push(q)
      i += 1
      continue
    }
    out.push(q)
    i += 1
    while (i < text.length) {
      if (text[i] === '\\') {
        out.push(' ', text[i + 1] === '\n' ? '\n' : ' ')
        i += 2
        continue
      }
      if (text[i] === q) {
        out.push(q)
        i += 1
        break
      }
      out.push(text[i] === '\n' ? '\n' : ' ')
      i += 1
    }
  }
  return out.join('')
}

/**
 * 单文件定性。返回 `{ kind, why }`:
 *  - `face`        走统一取材层 ⇒ 合规
 *  - `loose-git`   散写 git 内容读取 ⇒ 判红
 *  - `loose-fs`    散写"从仓库锚点读文件" ⇒ 判红
 *  - `no-content`  根本不读仓库内容 ⇒ 不适用(不计违规也不计数)
 *  - `unknown`     读文件但找不到仓库锚点 ⇒ 只报数(临时夹具这一型结构上判不了)
 */
export function classify(rel, src) {
  if (typeof src !== 'string') return { kind: 'unreadable', why: '内容取不到' }
  if (SELF_EXEMPT.includes(rel)) return { kind: 'self', why: '本门/取材层自身' }
  const code = maskComments(src)
  // 判序先认"真调用过层的读取入口",再判"引了层却没用它读内容"(半接线),最后才是原来两档散写。
  // 顺序反了就会把 half-wired 吞进 face —— 那正是旧版行为:FACE_IMPORT_RE 一刀命中即放行。
  const usesLayer = usesLayerRead(code)
  const selfServesGit = GIT_SPAWN_RE.test(code) && GIT_CONTENT_ARG_RE.test(code)
  const noStrings = blankStrings(code)
  const looseFs = FS_LOOSE_RE.test(noStrings) && REPO_ANCHOR_RE.test(noStrings)
  if (usesLayer) return { kind: 'face', why: '调用取材层的读取入口(catBatch / readWorktreeFile)取内容' }
  if (FACE_IMPORT_RE.test(code) && (selfServesGit || looseFs))
    return {
      kind: 'half-wired',
      why:
        '引了 lib/face-reader.mjs 却**没有**用它读内容:内容仍由自己派生 git 或按磁盘 readFileSync 取' +
        '(半接线 —— 这层看起来在用,判定面其实没换)',
    }
  if (selfServesGit)
    return { kind: 'loose-git', why: '自己派生 git 读内容(cat-file / show / ls-tree / grep / --batch)而未经取材层' }
  if (looseFs)
    return { kind: 'loose-fs', why: 'readFileSync + 仓库锚点(join/resolve(ROOT)) ⇒ 按磁盘判' }
  if (FS_LOOSE_RE.test(noStrings)) return { kind: 'unknown', why: '读文件但找不到仓库锚点(可能是临时夹具)' }
  return { kind: 'no-content', why: '不读仓库内容' }
}

/** 判红集只有一处定义 —— decide 与"哪些形态算违规"都从它读,不在别处再抄 kind 名单。 */
const RED_KINDS = new Set(['loose-git', 'loose-fs', 'half-wired'])

/** 聚合(纯函数,自检/镜像靠构造输入证明它有牙)。 */
export function decide({ verdicts, mode }) {
  const red = []
  const counts = { face: 0, loose: 0, halfWired: 0, unknown: 0, noContent: 0, unreadable: 0, self: 0 }
  for (const v of verdicts) {
    if (v.kind === 'face') counts.face++
    // 半接线既计入 loose 总量(它就是散写的一种),也单列计数:报告里必须能看出这次收紧抓到了几道,
    // 否则新档等于不存在 —— 只报 total 的聚合会把"收紧"退化成"多一种没人看的形态"。
    else if (RED_KINDS.has(v.kind)) {
      if (v.kind === 'half-wired') counts.halfWired++
      counts.loose++
      if (mode === 'staged') red.push(v)
    } else if (v.kind === 'unknown') counts.unknown++
    else if (v.kind === 'no-content') counts.noContent++
    else if (v.kind === 'self') counts.self++
    else counts.unreadable++
  }
  const exit = counts.unreadable > 0 ? 2 : red.length > 0 ? 1 : 0
  return { exit, red, counts, mode }
}

/** 取材(与守门 113/77/83 同形):全量判 HEAD blob、`--staged` 判索引 blob、`--worktree` 逃生舱 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function listGates(root, face) {
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
      : ['ls-files', '-z']
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  const paths = out.split('\0').filter(Boolean)
  if (!paths.length && face === 'staged') return []
  return paths.filter((p) => GATE_GLOB.test(p))
}

export function analyze(root, face) {
  const all = listGates(root, face)
  const mode = face === 'staged' ? 'staged' : 'full'
  // 全量面枚举到 0 道门 ⇒ 判据失效,不得表现为"扫 0 记绿"
  if (face === 'head' && all.length === 0) throw new Undetermined('HEAD 面枚举到 0 个门脚本 —— 判据失效不计通过')
  let gates = all
  if (mode === 'staged') {
    // 只审"这次改动动过的门";暂存集为空则退回全量报数(防"空暂存恒绿"的错觉)
    if (all.length === 0) return { ...decide({ verdicts: [], mode: 'full-noop' }), notices: ['--staged 暂存集内没有门脚本改动 ⇒ 本档无事可判(如实说明,不冒充"全部合规")'] }
    gates = all
  }
  const texts = readFace(root, face, gates)
  const verdicts = gates.map((p) => {
    const c = classify(p, texts.get(p))
    return { file: p, ...c }
  })
  return { ...decide({ verdicts, mode }), verdicts, notices: [] }
}

function main(argv) {
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1] || '.') : ROOT
  assertRepoRoot(root, '本门')
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face)
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  for (const n of out.notices || []) console.log(`ℹ️  ${n}`)
  if (out.red.length) {
    console.error(`❌ 检出 ${out.red.length} 道**本次改动动过的**门脚本按磁盘/散写判内容(应经 scripts/lib/face-reader.mjs):`)
    for (const r of out.red) console.error(`   ${r.file} —— ${r.why}`)
    console.error('   出路:改用 face-reader 的 selectFace/readFace(全量判 HEAD blob、--staged 判索引、取不到 exit 2);')
    console.error('         若这道门判的**不是仓库内容**(纯计算/外部输入),改成不读 ROOT 锚点即可,或按 --staged 之外的档只报数。')
  }
  const c = out.counts
  const tag = out.mode === 'staged' ? '本次改动' : '全量(只报数,不判红 —— 存量 122 型一次性判红就是恒红门)'
  console.log(
    `${out.exit === 0 ? '✅' : out.exit === 2 ? '❌ 无法判定' : '❌ 判红'} ${tag}:经取材层 ${c.face} / 散写 ${c.loose} / 判不了(疑临时夹具) ${c.unknown} / 不读内容 ${c.noContent} / 取不到 ${c.unreadable}`,
  )
  return out.exit
}

/** 判据自检:纯函数 + 构造面,零副作用。 */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const OK = "import { catBatch } from './lib/face-reader.mjs'\nconst t = catBatch(ROOT, ['HEAD:a.ts'])\n"
  const NS = "import * as face from './lib/face-reader.mjs'\nconst t = face.catBatch(ROOT, ['HEAD:a.ts'])\n"
  const HALF =
    "import { gitBinary, gitErrText, selectFace } from './lib/face-reader.mjs'\n" +
    "execFileSync(gitBinary(), ['show', 'HEAD:a.ts'])\n"
  const HALF_FS =
    "import { selectFace } from './lib/face-reader.mjs'\nimport { readFileSync } from 'node:fs'\nreadFileSync(join(ROOT, 'a.ts'), 'utf8')\n"
  const HELPER_ONLY =
    "import { assertRepoRoot, gitErrText } from './lib/face-reader.mjs'\nconsole.log('不读仓库内容')\n"
  const GIT = "import { execFileSync } from 'node:child_process'\nexecFileSync('git', ['cat-file', 'blob', h])\n"
  const FS = "import { readFileSync } from 'node:fs'\nreadFileSync(join(ROOT, 'package.json'), 'utf8')\n"
  const FIXTURE = "import { readFileSync } from 'node:fs'\nreadFileSync(join(dir, 'x.json'), 'utf8')\n"
  const PURE = 'export function f(x) { return x + 1 }\n'
  eq('F1 经取材层 ⇒ face', classify('scripts/check-a.mjs', OK).kind, 'face')
  // F6–F9:收紧"import 层 ≠ 走层"的成对证明。四条要一起读 —— F6/F7 的红必须由 F1/F8 的绿
  // 反向钉住,否则"不红"可能只是判据失效;而 F8 防的是新判据把合法写法误伤(命名空间导入)。
  eq('F6 引了层却自己 git show 读内容 ⇒ half-wired(半接线)', classify('scripts/check-f6.mjs', HALF).kind, 'half-wired')
  eq('F7 引了层却按磁盘 readFileSync 读 ⇒ half-wired', classify('scripts/check-f7.mjs', HALF_FS).kind, 'half-wired')
  eq('F8 命名空间导入 face.catBatch( ⇒ 仍算 face(新判据不得产假阳)', classify('scripts/check-f8.mjs', NS).kind, 'face')
  eq(
    'F9 只用层的非读取导出且不读内容 ⇒ no-content(不把门面函数当读取凭证,也不判红)',
    classify('scripts/check-f9.mjs', HELPER_ONLY).kind,
    'no-content',
  )
  // F10:half-wired 必须真的进判红集(staged 档),且单列计数 —— 只报总数等于没做这次收紧
  {
    const hw = decide({ verdicts: [{ file: 'scripts/check-f6.mjs', kind: 'half-wired', why: 'x' }], mode: 'staged' })
    eq('F10a half-wired 在 staged 档判红', hw.exit, 1)
    eq('F10b half-wired 计入 counts.halfWired', hw.counts.halfWired, 1)
    eq('F10c 全量档只报数不判红(存量一次性判红 = 恒红门)', decide({ verdicts: [{ file: 'a', kind: 'half-wired', why: 'x' }], mode: 'full' }).exit, 0)
  }
  eq('F2 散写 git 内容 ⇒ loose-git', classify('scripts/check-b.mjs', GIT).kind, 'loose-git')
  eq('F3 磁盘 + 仓库锚点 ⇒ loose-fs', classify('scripts/check-c.mjs', FS).kind, 'loose-fs')
  eq('F4 只读夹具(无仓库锚点)⇒ unknown,不判红', classify('scripts/check-d.mjs', FIXTURE).kind, 'unknown')
  eq('F5 不读内容 ⇒ no-content', classify('scripts/check-e.mjs', PURE).kind, 'no-content')
  eq('F6 非门脚本文件名不参与 glob', GATE_GLOB.test('apps/cli/src/tools/memory.ts'), false)
  eq('F7 注释里的标识符不算调用(遮噪后不可见)', classify('scripts/check-f.mjs', "// 这里解释 cat-file 是什么\nexport const x = 1\n").kind, 'no-content')
  eq('F8 自豁免在位(本门不得把自己判红)', classify('scripts/check-gate-face-discipline.mjs', GIT).kind, 'self')
  // 聚合的两档方向:同一份散写,提交档判红、全量档只报数
  const v = [{ file: 'scripts/check-b.mjs', kind: 'loose-git', why: 'x' }]
  eq('F9 staged 档:散写判红', decide({ verdicts: v, mode: 'staged' }).exit, 1)
  eq('F10 full 档:同一份散写只报数(存量不得钉红无关提交)', decide({ verdicts: v, mode: 'full' }).exit, 0)
  eq('F11 取不到内容 ⇒ exit 2(不冒红也不记绿)', decide({ verdicts: [{ file: 'x', kind: 'unreadable', why: 'y' }], mode: 'staged' }).exit, 2)
  eq('F12 全合规 ⇒ 0', decide({ verdicts: [{ file: 'x', kind: 'face', why: '' }], mode: 'staged' }).exit, 0)
  eq('F13 unknown 一律不进红(宁漏不误报)', decide({ verdicts: [{ file: 'x', kind: 'unknown', why: '' }], mode: 'staged' }).exit, 0)
  // 遮噪两层各自的方向(第一版就是因为混用一层而 F1/F2 双双假绿)
  eq('F14 注释里写 face-reader 路径不算合规(伪合规必须被拒)', classify('scripts/check-g.mjs', "// 建议改成 from './lib/face-reader.mjs'\n" + FS).kind, 'loose-fs')
  eq('F15 模板串里的 readFileSync 不算调用(遮噪后不可见)', classify('scripts/check-h.mjs', 'const doc = `readFileSync(join(ROOT, x))`\nexport const y = 1\n').kind, 'no-content')
  eq(
    'F16 别名导入读取入口并真调用(as + 多行)⇒ face',
    classify(
      'scripts/check-i.mjs',
      "import {\n  catBatch as readBlobs,\n} from '../lib/face-reader.mjs'\nconst t = readBlobs(ROOT, ['HEAD:a.ts'])\n",
    ).kind,
    'face',
  )
  eq(
    'F16b 别名导入却从不调用 ⇒ 不算 face(收紧的边界:引了名字不等于用了它)',
    classify('scripts/check-i2.mjs', "import {\n  catBatch as readBlobs,\n} from '../lib/face-reader.mjs'\nconsole.log(1)\n").kind,
    'no-content',
  )
  console.log(fail ? `\n❌ 自检 ${fail}/${ran} 例失败` : `\n全部 ${ran} 例通过(四形态分类 + 遮噪反向 + 两档方向对照 + 三态退出码)`)
  process.exit(fail ? 1 : 0)
}

// §22d:被 import 时不得触发 CLI 副作用(镜像测试要 import 判据函数)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv[2] === '--self-test') selfTest()
  else process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  classify,
  decide,
  usesLayerRead,
  GATE_GLOB,
  SELF_EXEMPT,
  analyze,
  listGates,
  SELF_SKIP,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
