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
// 遮噪实现复用既有那一份(本仓纪律:两处算同一件事必须共用一份实现)。
// 它导出缺失 ⇒ 本门判"无法判定",绝不静默把注释里的标识符当成调用。
import { markHidden } from './check-compaction-denominator.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_GATE_FACE_DISCIPLINE'
export const GATE_GLOB = /^scripts\/(check|scan|guard)[^/]*\.mjs$/
/** 本门自己与取材层必然出现这些标识符(判据模式串),按文件名前缀跳过 */
const SELF_EXEMPT = ['scripts/check-gate-face-discipline.mjs', 'scripts/lib/face-reader.mjs']
const GIT_TIMEOUT = 120000

/** 走统一取材层的证据:导入 face-reader(注释里的名字不算,故在遮噪后判) */
const FACE_IMPORT_RE = /from\s*['"][^'"]*lib\/face-reader\.mjs['"]/
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
  if (FACE_IMPORT_RE.test(code)) return { kind: 'face', why: '已导入 lib/face-reader.mjs' }
  if (GIT_SPAWN_RE.test(code) && GIT_CONTENT_ARG_RE.test(code))
    return { kind: 'loose-git', why: '自己派生 git 读内容(cat-file / show / ls-tree / grep / --batch)而未经取材层' }
  const noStrings = blankStrings(code)
  if (FS_LOOSE_RE.test(noStrings) && REPO_ANCHOR_RE.test(noStrings))
    return { kind: 'loose-fs', why: 'readFileSync + 仓库锚点(join/resolve(ROOT)) ⇒ 按磁盘判' }
  if (FS_LOOSE_RE.test(noStrings)) return { kind: 'unknown', why: '读文件但找不到仓库锚点(可能是临时夹具)' }
  return { kind: 'no-content', why: '不读仓库内容' }
}

const RED_KINDS = new Set(['loose-git', 'loose-fs'])

/** 聚合(纯函数,自检/镜像靠构造输入证明它有牙)。 */
export function decide({ verdicts, mode }) {
  const red = []
  const counts = { face: 0, loose: 0, unknown: 0, noContent: 0, unreadable: 0, self: 0 }
  for (const v of verdicts) {
    if (v.kind === 'face') counts.face++
    else if (v.kind === 'loose-git' || v.kind === 'loose-fs') {
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
  const OK = "import { readFace } from './lib/face-reader.mjs'\nconst t = readFace(ROOT, 'head', ['a.ts'])\n"
  const GIT = "import { execFileSync } from 'node:child_process'\nexecFileSync('git', ['cat-file', 'blob', h])\n"
  const FS = "import { readFileSync } from 'node:fs'\nreadFileSync(join(ROOT, 'package.json'), 'utf8')\n"
  const FIXTURE = "import { readFileSync } from 'node:fs'\nreadFileSync(join(dir, 'x.json'), 'utf8')\n"
  const PURE = 'export function f(x) { return x + 1 }\n'
  eq('F1 经取材层 ⇒ face', classify('scripts/check-a.mjs', OK).kind, 'face')
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
  eq('F16 真导入(带 as 别名/多行)仍认合规', classify('scripts/check-i.mjs', "import {\n  readFace as rf,\n} from '../lib/face-reader.mjs'\n").kind, 'face')
  console.log(fail ? `\n❌ 自检 ${fail}/${ran} 例失败` : `\n全部 ${ran} 例通过(四形态分类 + 遮噪反向 + 两档方向对照 + 三态退出码)`)
  process.exit(fail ? 1 : 0)
}

// §22d:被 import 时不得触发 CLI 副作用(镜像测试要 import 判据函数)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv[2] === '--self-test') selfTest()
  else process.exit(main(process.argv.slice(2)))
}

export const __test__ = { classify, decide, GATE_GLOB, SELF_EXEMPT, analyze, listGates, SELF_SKIP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
